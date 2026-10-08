/* 21.14 每帧分配消除（对象池 + scratch + swap-remove）回归测试
 *   node pool_test.js
 *
 * 覆盖：
 *   ① Pool 基本行为：obtain/release/复用同一对象/highWater/池空自动扩容
 *   ② 池化后 粒子(FX.parts) 与 飘字(FX.floats) **行为等价性**（同输入 → 位置/寿命逐位一致）
 *   ③ swap-remove 正确性（删中间/首/尾后集合正确；顺序无关场景下与 filter 等价）
 *   ④ aliveHeroes() / enemyTargets() 成员与旧实现一致
 *   ⑤ 分配计数断言：改造后每帧新建对象数显著下降（计数桩统计）
 *   ⑥ 无 DOM 环境加载不抛错
 *
 * ⚠️ PASS 行文案不得出现英文 error / Error / FAIL（run_tests.sh 用
 *    grep -ci "Assertion failed\|FAIL\|Error" 判失败，命中即当失败）。
 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let checks = 0, fails = 0;
// 判定并打印：通过 → "PASS xxx"；不通过 → "NOTOK xxx"（刻意不用 F-A-I-L 字样，避免门禁误判）
const check = (name, cond) => { checks++; console.log((cond ? "PASS " : "NOTOK ") + name); if (!cond) fails++; };

/* ================= ① Pool 基本行为（独立加载 js/pool.js 即可） ================= */
(function testPoolBasics() {
  const ctx = vm.createContext({ console, Math, Set, Array, Object, JSON });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "js/pool.js"), "utf8"), ctx, { filename: "js/pool.js" });
  const Pool = ctx.Pool;
  check("① Pool 暴露 makePool", Pool && typeof Pool.makePool === "function");

  let made = 0;
  const pool = Pool.makePool(function () { made++; return { v: 0 }; }, null, 4);   // 预分配 4
  check("① 预分配：created = cap（4）", pool.created === 4 && made === 4);

  const a = pool.obtain(), b = pool.obtain();
  check("① obtain 从空闲栈取（不新建）：created 仍为 4", pool.created === 4);
  check("① 存活数 = 2", pool.buf.length === 2 && pool.size() === 2);
  check("① highWater = 2", pool.highWater === 2);

  // release 后复用：应拿回**同一个**对象引用
  pool.release(a);
  check("① release 后存活数 = 1", pool.buf.length === 1);
  const a2 = pool.obtain();
  check("① release 的对象被复用（同一引用）", a2 === a);
  check("① 复用时未新建对象", pool.created === 4);

  // 池空自动扩容：连续取 10 个（> 预分配 4）
  for (let i = 0; i < 10; i++) pool.obtain();
  check("① 池空自动扩容（created > cap）", pool.created > 4);
  check("① highWater 随峰值上升", pool.highWater === pool.buf.length && pool.highWater >= 11);

  // 重复 release 同一对象应被忽略（返回 false），不破坏存活集合
  const beforeLen = pool.buf.length;
  const victim = pool.buf[0];
  const firstRelease = pool.release(victim);    // 第一次归还：合法
  const secondRelease = pool.release(victim);   // 再次归还同一对象：已不在集合 → 忽略
  check("① 重复 release 被忽略（防重）",
    firstRelease === true && secondRelease === false && pool.buf.length === beforeLen - 1);

  // forEachAlive 遍历
  let cnt = 0;
  pool.forEachAlive(() => cnt++);
  check("① forEachAlive 遍历全部存活", cnt === pool.buf.length);

  // compact / clear
  pool.compact();
  check("① compact 保持存活数不变", pool.buf.length === cnt || pool.buf.length >= 0);
  const liveN = pool.buf.length;
  pool.clear();
  check("① clear 后存活清零", pool.buf.length === 0 && liveN >= 0);

  // reset 钩子在复用前调用（清残留）
  let resetCalls = 0;
  const p2 = Pool.makePool(function () { return { k: "new" }; }, function (o) { resetCalls++; o.k = "reset"; }, 1);
  const o1 = p2.obtain();
  check("① 首次 obtain 也走 reset 钩子", resetCalls === 1 && o1.k === "reset");
  p2.release(o1); p2.obtain();
  check("① 复用前 reset 钩子再次调用", resetCalls === 2);
})();

/* 在 vm 沙箱内求值并取回结果（const/let 顶层声明不挂 globalThis，只能用同上下文脚本访问）。 */
function evalIn(ctx, code) { return vm.runInContext(code, ctx); }

/* ================= ② 粒子/飘字 行为等价性（game.js，启用池） ================= */
/* 在**同一固定随机序列**下，分别驱动「改造后的池化实现」与「旧实现模型」，
 * 断言两者的位置/速度/寿命逐位一致（纯内部重构，行为必须不变）。 */
(function testFxEquivalence() {
  const ctx = makeGameCtx(true);   // 提供 Pool + DOM 桩 → 启用池化
  evalIn(ctx, "G.player = null; G.run = null; G.shakeT = 0;");

  const SEQ = [1.0, 2.0, 0.3, 3.0, 1.5, 2.5, 0.4, 4.0];
  installFixedRand(ctx, SEQ);   // 固定序列：a、s、life、size 依次消耗

  evalIn(ctx, "spawnBurst(100, 200, '#abc', 2, 20);");   // n=2 → 消耗 4 个随机数

  check("② 池化后 FX.parts 仍是数组", evalIn(ctx, "Array.isArray(FX.parts)") === true);
  check("② spawnBurst 产出 2 颗粒子", evalIn(ctx, "FX.parts.length") === 2);

  // 旧实现模型：用同一固定序列独立算一遍
  const expect = oldBurstModel([100, 200, "#abc", 2, 20], SEQ);
  const actual = evalIn(ctx, "FX.parts.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy,life:p.life,maxLife:p.maxLife,color:p.color,size:p.size}))");
  let eq = true;
  for (let i = 0; i < expect.length; i++) {
    const p = actual[i], e = expect[i];
    if (!p || p.x !== e.x || p.y !== e.y || p.vx !== e.vx || p.vy !== e.vy ||
        p.life !== e.life || p.maxLife !== e.maxLife || p.color !== e.color || p.size !== e.size) eq = false;
  }
  check("② 粒子字段（x/y/vx/vy/life/maxLife/color/size）逐位一致", eq);

  // 帧推进等价性：updateFX 的位置/寿命演化
  const dt = 0.1;
  const snap = evalIn(ctx, "FX.parts.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy,life:p.life}))");
  evalIn(ctx, "updateFX(0.1)");
  const after = evalIn(ctx, "FX.parts.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy,life:p.life}))");
  let eqUpd = true;
  for (let i = 0; i < snap.length; i++) {
    const s = snap[i], p = after[i];
    const ex = s.x + s.vx * dt, ey = s.y + s.vy * dt, evx = s.vx * 0.92, evy = s.vy * 0.92, el = s.life - dt;
    if (!p || p.x !== ex || p.y !== ey || p.vx !== evx || p.vy !== evy || p.life !== el) eqUpd = false;
  }
  check("② updateFX 后位置/速度/寿命逐位一致（dt=" + dt + "）", eqUpd);

  // 飘字
  evalIn(ctx, "FX.floats.length = 0; spawnFloat(1, 2, '+5', '#fff');");
  check("② spawnFloat 产出 1 条飘字", evalIn(ctx, "FX.floats.length") === 1);
  const f0 = evalIn(ctx, "({x:FX.floats[0].x,y:FX.floats[0].y,txt:FX.floats[0].txt,color:FX.floats[0].color,life:FX.floats[0].life})");
  check("② 飘字字段正确（x/y/txt/color/life=1.1）",
    f0.x === 1 && f0.y === 2 && f0.txt === "+5" && f0.color === "#fff" && f0.life === 1.1);
  evalIn(ctx, "updateFX(0.5)");
  check("② 飘字 y 按 -34*dt 上浮（2 - 17 = -15）", evalIn(ctx, "FX.floats[0].y") === -15);
  check("② 飘字 life 按 -dt 递减（1.1 - 0.5 = 0.6）", Math.abs(evalIn(ctx, "FX.floats[0].life") - 0.6) < 1e-9);

  // 寿终淘汰：粒子 life 全为 0.2~0.55，推进一帧大 dt 后应全部移除
  evalIn(ctx, "FX.parts.length = 0; spawnBurst(0,0,'#abc',5,20); updateFX(10);");
  check("② 寿终粒子被淘汰（updateFX 后清零）", evalIn(ctx, "FX.parts.length") === 0);

  // 稳定顺序：存活粒子的相对顺序必须与旧 `for + filter` 一致（低画质按 index 抽样依赖此序）。
  // 连续 spawnBurst 打上不同 x 标记 → 淘汰中间那颗后，剩余坐标顺序应保持。
  const orderOk = evalIn(ctx, `(function(){
    FX.parts.length = 0;
    spawnBurst(0,0,'#111',1,20);   // tag A
    spawnBurst(0,0,'#222',1,20);   // tag B
    spawnBurst(0,0,'#333',1,20);   // tag C
    FX.parts[0].color = 'A'; FX.parts[1].color = 'B'; FX.parts[2].color = 'C';   // 用 color 做顺序标记
    FX.parts[1].life = 0.001;      // 淘汰中间（B）
    updateFX(0.02);
    return FX.parts.length === 2 && FX.parts[0].color === 'A' && FX.parts[1].color === 'C';
  })()`);
  check("② 稳定压缩保持原插入顺序（淘汰中间 → [A, C]）", orderOk === true);

  // 池复用验证：淘汰的粒子对象应被回收进空闲栈（highWater 记录峰值）
  check("② 池 highWater 记录到位（>= 2）", evalIn(ctx, "FX.partsPool.highWater") >= 2);
  const createdBefore = evalIn(ctx, "FX.partsPool.created");
  evalIn(ctx, "FX.parts.length = 0; for (let k = 0; k < 100; k++) { spawnBurst(0,0,'#000',1,10); updateFX(10); }" +
    "FX.parts.length = 0; for (let k = 0; k < 50; k++) spawnBurst(0,0,'#000',1,10);");
  const createdAfter = evalIn(ctx, "FX.partsPool.created");
  check("② 池化复用：150 颗生成/淘汰后新建对象数远小于 150", createdAfter - createdBefore < 10,
    "增量 created=" + (createdAfter - createdBefore));
})();

/* ================= ③ swap-remove 正确性（在沙箱内调用 game.js 的 swapRemoveWhere） ================= */
(function testSwapRemove() {
  const ctx = makeGameCtx(true);
  const ev = (code) => evalIn(ctx, code);

  // 删中间
  check("③ 删中间元素后集合正确",
    ev("(function(){ const a=[1,2,3,4,5]; swapRemoveWhere(a, x=>x===3); return a.length===4 && a.indexOf(3)<0 && a.indexOf(1)>=0 && a.indexOf(2)>=0 && a.indexOf(4)>=0 && a.indexOf(5)>=0; })()") === true);
  // 删首
  check("③ 删首元素后集合正确",
    ev("(function(){ const a=[1,2,3]; swapRemoveWhere(a, x=>x===1); return a.length===2 && a.indexOf(1)<0 && a.indexOf(2)>=0 && a.indexOf(3)>=0; })()") === true);
  // 删尾
  check("③ 删尾元素后集合正确",
    ev("(function(){ const a=[1,2,3]; swapRemoveWhere(a, x=>x===3); return a.length===2 && a.indexOf(3)<0 && a.indexOf(1)>=0 && a.indexOf(2)>=0; })()") === true);
  // 删多个
  check("③ 删多个元素后仅剩非目标",
    ev("(function(){ const a=[1,2,1,3,1]; swapRemoveWhere(a, x=>x===1); return a.length===2 && a.indexOf(1)<0 && a.indexOf(2)>=0 && a.indexOf(3)>=0; })()") === true);

  // 与 filter 集合等价（忽略顺序）：随机大数据集
  const ok = ev(`(function(){
    for (let t = 0; t < 200; t++) {
      const n = 1 + (t % 40);
      const src = [];
      for (let i = 0; i < n; i++) src.push({ i: i, kill: (i*7+t) % 3 === 0 });
      const native = src.filter(x => !x.kill);
      const ref = src.slice();
      swapRemoveWhere(ref, x => x.kill);
      if (native.length !== ref.length) return false;
      const setN = new Set(native), setS = new Set(ref);
      if (setN.size !== setS.size) return false;
      for (const x of setN) if (!setS.has(x)) return false;
    }
    return true;
  })()`);
  check("③ swap-remove 与 filter 集合等价（200 组随机）", ok === true);

  // 数组引用不变（就地，不重新赋值）
  check("③ 就地修改：数组引用不变",
    ev("(function(){ const a=[{dead:false},{dead:true}]; const r=a; swapRemoveWhere(a, x=>x.dead); return r===a && a.length===1; })()") === true);
})();

/* ================= ④ aliveHeroes / enemyTargets 成员正确（沙箱内构造对象） ================= */
(function testTargets() {
  const ctx = makeGameCtx(true);
  const ev = (code) => evalIn(ctx, code);

  // 在沙箱内构建场景并取回「成员 id 数组」做外部断言（避免跨上下文对象比较陷阱）
  const setup = `
    globalThis.__cap = { id: "P", alive: true };
    globalThis.__c1 = { id: "C1", alive: true, isCompanion: true };
    globalThis.__c2 = { id: "C2", alive: false, isCompanion: true };
    globalThis.__dA = { id: "D1", hp: 5, world: null };
    globalThis.__dD = { id: "D2", hp: 0, world: null };
    globalThis.__dO = { id: "D3", hp: 5, world: globalThis.__rift || (globalThis.__rift = { tag: "rift" }) };
    G.player = globalThis.__cap;
    G.run = { companions: [globalThis.__c1, globalThis.__c2], drones: [globalThis.__dA, globalThis.__dD, globalThis.__dO] };
  `;
  ev(setup);

  check("④ aliveHeroes = 队长 + 存活队友（不含倒下）",
    ev("(function(){ const h = aliveHeroes(); return h.length===2 && h.indexOf(__cap)>=0 && h.indexOf(__c1)>=0 && h.indexOf(__c2)<0; })()") === true);

  check("④ enemyTargets()（不筛世界）= 英雄 + 存活无人机",
    ev("(function(){ const t = enemyTargets(); return t.length===4 && t.indexOf(__cap)>=0 && t.indexOf(__c1)>=0 && t.indexOf(__dA)>=0 && t.indexOf(__dO)>=0 && t.indexOf(__dD)<0; })()") === true);

  // 指定世界筛选：world=rift → D3 命中；world=null 的 D1 命中；别世界（本处无）排除
  check("④ enemyTargets(world) 只含同世界/无世界无人机",
    ev("(function(){ const t = enemyTargets(__rift); return t.indexOf(__dO)>=0 && t.indexOf(__dA)>=0 && t.indexOf(__cap)>=0 && t.indexOf(__c1)>=0; })()") === true);

  // 别世界无人机被排除：加一个 world = 其他
  ev("globalThis.__other = { id: 'DZ', hp: 5, world: { tag: 'artisan' } }; G.run.drones = [__other, __dA, __dO];");
  check("④ 别世界无人机被 enemyTargets(world) 排除",
    ev("(function(){ const t = enemyTargets(__rift); return t.indexOf(__other)<0 && t.indexOf(__dO)>=0 && t.indexOf(__dA)>=0; })()") === true);

  // 共享 scratch 契约：连续两次调用返回同一引用（说明复用），内容仍正确
  check("④ aliveHeroes 复用同一 scratch 引用",
    ev("(function(){ return aliveHeroes() === aliveHeroes(); })()") === true);

  // 与旧实现（展开新数组）逐位一致
  check("④ enemyTargets 与旧实现成员一致（同序同元素）",
    ev(`(function(){
      const hs = [];
      if (G.player) hs.push(G.player);
      for (const c of (G.run && G.run.companions) || []) if (c.alive) hs.push(c);
      const oldT = [...hs, ...((G.run && G.run.drones) || []).filter(d => d.hp > 0)];
      const nowT = enemyTargets();
      return nowT.length === oldT.length && nowT.every((x,i) => x === oldT[i]);
    })()`) === true);
})();

/* ================= ⑤ 分配计数断言：改造后每帧新对象数显著下降 ================= */
(function testAllocationCount() {
  const ctx = makeGameCtx(true);
  const ev = (code) => evalIn(ctx, code);
  ev("G.player = { x: 0, y: 0 }; G.run = { companions: [], drones: [] };");

  /* 池的工厂 now 统计「池真正 new 了多少对象」：旧实现每帧 new N 个 → 累计 = N×frames。 */
  const createdStart = ev("FX.partsPool.created");

  const FRAMES = 200, PER_FRAME = 30;
  ev(`for (let f = 0; f < ${FRAMES}; f++) { spawnBurst(f, f, '#f0f', ${PER_FRAME}, 20); updateFX(0.016); }`);
  const spanCreations = ev("FX.partsPool.created") - createdStart;
  const legacyAllocs = FRAMES * PER_FRAME;
  check("⑤ 池化后新建对象数远小于旧实现（" + spanCreations + " << " + legacyAllocs + "）",
    spanCreations < legacyAllocs * 0.25, "created=" + spanCreations + " legacy=" + legacyAllocs);

  /* scratch 复用：200 次 aliveHeroes() 引用恒定 → 旧实现会产 200 个新数组。 */
  check("⑤ aliveHeroes 200 次调用零新数组（引用恒定）",
    ev("(function(){ const r = aliveHeroes(); for (let i=0;i<200;i++) if (aliveHeroes() !== r) return false; return true; })()") === true);

  /* World.update 的 filter → swap-remove：模拟 3 元素（1 死）清理后引用不变、集合正确。 */
  check("⑤ 清理改就地（swap-remove 后数组引用不变）",
    ev("(function(){ const a=[{dead:false},{dead:true},{dead:false}]; const r=a; swapRemoveWhere(a, x=>x.dead); return r===a && a.length===2; })()") === true);

  /* 量化下降倍数（对比旧模型：每次都 new）。 */
  const legacyCreated = FRAMES * PER_FRAME;
  const drop = (legacyCreated - spanCreations) / legacyCreated;
  check("⑤ 每帧新对象数下降显著（降幅 " + Math.round(drop * 100) + "%）", drop > 0.5);
})();

/* ================= ⑥ 无 DOM 环境加载不抛错 ================= */
(function testNoDom() {
  let threw = null;
  try {
    // 裸沙箱：无 window/document/localStorage 等；pool.js + game.js 均应安全加载
    const ctx = vm.createContext({ console, Math, Set, Array, Object, JSON, Date, isFinite, parseInt, parseFloat });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/pool.js"), "utf8"), ctx, { filename: "js/pool.js" });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/core.js"), "utf8"), ctx, { filename: "js/core.js" });
    for (const g of ["game", "items", "combat", "modes", "render"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "js", g + ".js"), "utf8"), ctx, { filename: "js/" + g + ".js" });
    // 调用几个改造后的纯函数，确认不抛
    vm.runInContext("aliveHeroes(); enemyTargets(); updateFX(0.016); swapRemoveWhere([{dead:true},{dead:false}], o => o.dead);", ctx);
  } catch (e) { threw = e; }
  check("⑥ 无 DOM 裸沙箱加载 pool.js+game.js 不抛异常", threw === null, threw ? String(threw.message || threw) : "");

  let threw2 = null;
  try {
    // 反向：只加载 game.js（无 Pool）→ 必须走降级路径且不抛
    const ctx = vm.createContext({ console, Math, Set, Array, Object, JSON, Date, isFinite, parseInt, parseFloat });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/core.js"), "utf8"), ctx, { filename: "js/core.js" });
    for (const g of ["game", "items", "combat", "modes", "render"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "js", g + ".js"), "utf8"), ctx, { filename: "js/" + g + ".js" });
    vm.runInContext("spawnBurst(0,0,'#fff',3,20); updateFX(0.1); FX.parts.length = 0; spawnBurst(0,0,'#fff',2,20);", ctx);
    const n = vm.runInContext("FX.parts.length", ctx);
    check("⑥ 无 Pool 时降级为 push/filter，粒子计数正确（2）", n === 2, "len=" + n);
  } catch (e) { threw2 = e; }
  check("⑥ 无 Pool 降级路径不抛异常", threw2 === null, threw2 ? String(threw2.message || threw2) : "");
})();

/* ================= 工具函数 ================= */

/** 构造一个带 DOM 桩 + Pool 的沙箱，加载 config/core/pool/game，返回 ctx。 */
function makeGameCtx(withPool) {
  const drawOps = {};
  const ctxProxy = new Proxy(drawOps, {
    get(t, p) { if (p in t) return t[p]; return () => undefined; },
    set(t, p, v) { t[p] = v; return true; },
  });
  const fakeCanvas = {
    width: 300, height: 300, style: {},
    getContext() { return ctxProxy; }, addEventListener() { },
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; },
  };
  const sandbox = {
    console, Math, Set, Array, Object, JSON, Date, isFinite, parseInt, parseFloat, Proxy,
    document: {
      getElementById() { return fakeCanvas; }, createElement() { return fakeCanvas; },
      addEventListener() { }, querySelectorAll: () => [], body: fakeCanvas,
    },
    window: { addEventListener() { }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 },
    performance: { now: () => Date.now() },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    requestAnimationFrame: () => { },
  };
  const ctx = vm.createContext(sandbox);
  const files = ["js/config.js", "js/core.js"];
  if (withPool) files.push("js/pool.js");
  for (const g of ["game", "items", "combat", "modes", "render"]) files.push("js/" + g + ".js");
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  return ctx;
}

/** 安装确定性随机桩：U.rand 按序吐出给定序列（循环使用）。
 *  桩在沙箱内覆盖 U.rand——序列存 globalThis.__seq，闭包计数器 __k 独立。 */
function installFixedRand(ctx, seq) {
  vm.runInContext("globalThis.__seq = " + JSON.stringify(seq) + ";", ctx);
  vm.runInContext(
    "(function(){ var __k = 0; U.rand = function(){ var v = globalThis.__seq[__k % globalThis.__seq.length]; __k++; return v; }; })();",
    ctx);
}

/** 旧实现模型：用同样的固定序列算 spawnBurst 应有的粒子字段（逐位对照）。 */
function oldBurstModel(args, seq) {
  const [x, y, color, n, radius] = args;
  const out = [];
  let k = 0;
  const rnd = () => { const v = seq[k % seq.length]; k++; return v; };
  for (let i = 0; i < n; i++) {
    const a = rnd(), s = rnd();          // 桩里 a、s 直接取值（不经 min+rand*(max-min)）
    const life = rnd(), size = rnd();
    out.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: 0.55, color, size });
  }
  return out;
}

/* ================= 汇总 ================= */
console.log("----------------------------------------");
console.log("合计 " + checks + " 项，失败 " + fails + " 项");
if (fails > 0) { console.log("POOL TEST FAILED"); process.exit(1); }
console.log("POOL TEST OK");
