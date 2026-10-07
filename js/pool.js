/* ============================================================================
 * js/pool.js —— 通用对象池（预分配 + 空闲链表 + 紧凑存活数组）
 * ----------------------------------------------------------------------------
 * 为什么需要它：本项目此前**全库没有任何实体对象池**，每帧 new 出 >2 万对象
 * （粒子、飘字、索敌临时数组……），是 GC 卡顿/帧毛刺的元凶。本文件提供一个
 * 与业务无关的通用池，把「每帧 new + filter 重建」换成「复用 + 原地尾部交换删除」。
 *
 * 设计要点（对应任务书的硬性要求）：
 *   ① `obtain()` 取一个（池空则新建）、`release(obj)` 归还、`forEachAlive(fn)` 遍历、
 *      `compact()` 可选裁剪；
 *   ② 用 `alive` 标记区分存活/空闲，`release` 走**尾部交换删除**（swap-remove）——
 *      不 `splice` 搬移整段、不新建数组；
 *   ③ `buf` 是**紧凑的存活数组**（存活对象恒在 [0, count)）：可直接当作 `FX.parts`
 *      暴露给渲染循环，且 `buf.length = 0` 能像普通数组一样清空；
 *   ④ `highWater` 记录峰值占用数（性能埋点）；
 *   ⑤ 预分配 `cap` 个对象，避免启动后再次分配（cap 只是**初始**容量，非硬上限——
 *      池空时 `obtain` 自动扩容，保证任何时刻都能取到对象）。
 *
 * ⚠️ 本文件是全局脚本（无模块化），挂 `Pool` 到全局；game.js 在加载时若检测到
 *    `typeof Pool !== "undefined"` 才启用池化，否则**降级**为 `[] + push/filter` 旧逻辑
 *    （见 game.js 末尾 §5.45 区块），因此某些只加载 game.js 的测试桩也能正常跑。
 * ============================================================================ */
"use strict";

var Pool = (function () {
  /* 一个池实现的构造函数（工厂函数 makePool 返回它的实例）。
   * 不直接暴露给业务，业务统一走 makePool(...) 拿池。 */
  function PoolImpl(factory, reset, cap) {
    this.factory = factory;            // 新建对象的工厂：function () => obj
    this.reset = reset || null;        // 复用前的复位钩子：function (obj) => void（可空）
    this.freeStack = [];               // 空闲对象栈（LIFO → 缓存友好）
    this.buf = [];                     // ★ 紧凑存活数组（存活恒在 [0, len)）
    this.alive = [];                   // 与 buf 平行：buf[i].__alive 的镜像（此处仅存布尔，避免污染对象）
    this.highWater = 0;                // 峰值占用（buf.length 的历史最大值）
    this.created = 0;                  // 累计新建对象数（诊断用：衡量池是否真的在复用）
    // 预分配 cap 个空闲对象（cap<=0 则不预热，按需增长）
    var n = (cap | 0) > 0 ? (cap | 0) : 0;
    for (var i = 0; i < n; i++) this.freeStack.push(this._make());
  }

  PoolImpl.prototype._make = function () {
    this.created++;
    return this.factory();
  };

  /* 取一个对象：优先复用空闲对象（复位后返回），池空则新建。
   * 返回的对象会被压入紧凑存活数组 buf（尾插，O(1)）。 */
  PoolImpl.prototype.obtain = function () {
    var obj = this.freeStack.length ? this.freeStack.pop() : this._make();
    if (this.reset) this.reset(obj);   // 清掉上一轮残留字段（本池约定：字段全量写回，故通常可省）
    this.buf.push(obj);
    if (this.buf.length > this.highWater) this.highWater = this.buf.length;
    return obj;
  };

  /* 归还一个对象：尾部交换删除（swap-remove）把它从存活数组中摘除，再压入空闲栈。
   * 用「取下标 → 与末位交换 → 弹尾」而非 splice，避免整段搬移；不产生任何新数组。
   * 返回 true 表示确实移除成功（重复 release 同一对象会返回 false，天然防重）。 */
  PoolImpl.prototype.release = function (obj) {
    var i = this.buf.indexOf(obj);
    if (i < 0) return false;                 // 已不在存活集合（重复归还）→ 忽略
    var last = this.buf.length - 1;
    if (i !== last) this.buf[i] = this.buf[last];   // 末位补到空洞
    this.buf.pop();
    this.freeStack.push(obj);
    return true;
  };

  /* 仅回收对象到空闲栈，**不动 buf**（调用方已自行从存活数组摘除，例如稳定就地压缩后）。
   * 与 release 的区别：release 负责「摘除 + 回收」，recycle 只「回收」——
   * updateFX 用「写指针压缩」保持顺序，压缩后再逐颗 recycle，避免二次 indexOf。
   * ⚠️ 调用方必须保证该对象已不在 buf 中，否则会出现「对象既在存活数组又在空闲栈」。 */
  PoolImpl.prototype.recycle = function (obj) {
    if (!obj) return false;
    this.freeStack.push(obj);
    return true;
  };

  /* 遍历当前存活对象（fn(obj, index)）。回调内**禁止** obtain/release 改变 buf 长度，
   * 否则会漏遍历/越界——本池的使用者（updateFX）只在遍历后统一 release。 */
  PoolImpl.prototype.forEachAlive = function (fn) {
    for (var i = 0; i < this.buf.length; i++) fn(this.buf[i], i);
  };

  /* 可选：把紧凑数组真实容量裁到当前存活数（释放多余的数组容量）。
   * ⚠️ 只在帧间空闲点调用——它会新建一次数组，不适合每帧跑。 */
  PoolImpl.prototype.compact = function () {
    if (this.buf.length !== 0) {
      var trimmed = this.buf.slice(0, this.buf.length);
      this.buf.length = 0;
      for (var i = 0; i < trimmed.length; i++) this.buf.push(trimmed[i]);
    }
    return this.buf.length;
  };

  /* 存活数（= 紧凑数组长度，与 buf.length 同义，语义化别名）。 */
  PoolImpl.prototype.size = function () { return this.buf.length; };

  /* 清空存活集合，全部对象回收到空闲栈（重置场景用，例如重新开局）。
   * 不销毁对象，仅摘除引用 → 之后 obtain 仍走复用，不产生分配。 */
  PoolImpl.prototype.clear = function () {
    for (var i = this.buf.length - 1; i >= 0; i--) this.freeStack.push(this.buf[i]);
    this.buf.length = 0;
  };

  /* 工厂：创建并返回一个池实例。
   *   factory —— 无参工厂，返回一个新对象；可为 null（退化为返回 {}）
   *   reset   —— 可选复位钩子，obtain 复用旧对象前调用
   *   cap     —— 预分配对象数（初始容量，非硬上限；池空自动扩容） */
  function makePool(factory, reset, cap) {
    var f = (typeof factory === "function") ? factory : function () { return {}; };
    return new PoolImpl(f, reset, cap);
  }

  return {
    makePool: makePool,
    PoolImpl: PoolImpl,   // 暴露实现类：测试可直接 new，或业务方高级定制
    version: "21.14-pool"
  };
})();
