/* ============================================================
 * rewards.js — 无尽模式「奖励与局外成长打通」（21.15 🅓）
 * ------------------------------------------------------------
 * 21.16 物理搬移：从原 js/main.js 末尾（原 1510~1806 行）整段剪切而来，未改一行逻辑。
 * 职责：
 *   · EndlessReward：把「已清空的波次」翻译为地面宝箱 + 结晶统一入账 + 结算明细对齐
 *   · installEndlessRewardHook / installEndlessSettleHook / installEndlessRewardResetHook：
 *     以 monkey-patch 手法包装 Endless.update / Endless.settle / showEndlessSettle / enterEndless
 * 依赖方向：依赖 endless.js 的 Endless、modes.js 的 enterEndless / showEndlessSettle，
 *   以及全局 G / CFG / Meta / UI / U。
 * 加载顺序：必须在 js/endless.js、js/modes.js 之后（加载即接线，需被包装对象已定义）；
 *   置于 js/main.js 之前（本文件不依赖 main.js 符号）。
 * ============================================================ */

/* ============================================================================
 * 21.15 🅓 无尽模式「奖励与局外成长打通」——文件末尾独立区块（§5.45 铁律）
 * ----------------------------------------------------------------------------
 * 与 🅐（js/endless.js 波次/难度）和 🅑（结算面板/入口）的契约边界：
 *   · 🅐 负责：Endless.waveReward(wave) / Endless.dropsChest(wave) / Endless.settle()
 *     并把「本波已清空 + 是否掉宝箱」写进 Endless.state.lastWaveCleared / lastWaveChest。
 *   · 🅑 负责：结算面板 DOM（screen-endless-settle）+ 进出门。
 *   · 🅓（本区块）负责：把「已清空的波次」翻译成**掉宝箱**（地面可拾取）+
 *     把 run 内结晶计数**统一入账**到局外存档（复用 buildCrystalReport / publishCrystalReport）。
 *
 * ── 关键决策 ①：结晶是「每波实时入账」还是「死亡一次性入账」？
 *    → 选 **实时累加到 run 内计数器（Endless.state.crystals），死亡结算时统一入账**。
 *    理由：与既有「撤离结算」口径完全一致——撤离也是先把物资折算值累成 conv.total，
 *    最后一次性把 conv.total 加进 Meta.data.crystals。若中途就写进 Meta，
 *    死亡/退出路径再走一遍折算会**重复入账**；且波次结晶是「已到手现金」，
 *    不应再被 settleConvert 二次折算（settleConvert 只折算背包物资，不折算已入账结晶）。
 *
 * ── 关键决策 ②：死亡保留 30% 是否适用于无尽？
 *    → **保持继承**（首版从简，数值后期调）。既有死亡面板/结算走 CFG.outLevel.deathRatio(0.3)。
 *    无尽是纯输出模式、死亡即失败，理论上「全给」或「打折」皆可；但本版**不引入第二套口径**，
 *    避免「同一货币两套规则」的复杂度。标注在此，后续若要改只动一处（见 endlessRewardCfg）。
 *
 * ── 关键决策 ③：宝箱「掉地上拾取」还是「直接进背包」？
 *    → 选 **掉在玩家附近的地面，让玩家走过去拾取**（复用 w.pickups 拾取链路）。
 *    理由：无尽是长时间清怪流程，「掉落-拾取」的节奏感是奖励反馈的一部分（仪式感）；
 *    直接塞背包则失去反馈。宝箱落点写在玩家旁 spawnRing 内，且**由玩家拾取后才入包**，
 *    因此未拾取的宝箱在死亡结算时不存在 = 天然不参与折算，无重复入账风险。
 * ========================================================================== */

/* 无尽奖励子配置（CFG 铁律：数值集中在 CFG.endless.settle 子命名空间，
 * 不改 🅐 已定义的既有字段）。缺配置时本区块用安全兜底，绝不抛错。 */
function endlessRewardCfg() {
  var e = (typeof CFG !== "undefined" && CFG && CFG.endless) || {};
  var s = e.settle || {};
  // 宝箱品质 key（对齐 CFG.chestQualities 的字符串 key）；缺省取 advanced，非法则回落首个合法 key
  var validKeys = (typeof CFG !== "undefined" && CFG && CFG.chestQualities) ? Object.keys(CFG.chestQualities) : [];
  var q = (s.chestQual !== undefined) ? s.chestQual : "advanced";
  if (validKeys.length && validKeys.indexOf(q) < 0) q = validKeys[0];
  return {
    chestQual: q,
    // 宝箱落点距玩家半径（像素）——落点在玩家附近、可走过去拾取
    chestDropRadius: (s.chestDropRadius !== undefined) ? s.chestDropRadius : 90,
    // 宝箱地面停留时间（秒）——复用拾取物 life 语义（超时消失）
    chestLife: (s.chestLife !== undefined) ? s.chestLife : 30,
    // 是否复用死亡保留比例（true = 继承 deathRatio；首版固定 true，数值后期调）
    inheritDeathRatio: (s.inheritDeathRatio !== undefined) ? s.inheritDeathRatio : true,
  };
}

/* 无尽奖励运行时状态（模块级，不污染 G/Endless）：
 *   lastSeenCleared —— 已处理过的「最近清空波次」标记（防同一波重复掉宝箱）
 *   chestPickups    —— 本区块自管的「地面宝箱」列表（type/loot 落点/剩余时间）
 *
 * ⚠️ 为什么自管宝箱列表而不复用 w.pickups？
 *   game.js 的拾取分支（3115-3129）**只识别 coin / exp**，其余一律按 exp 处理（§「逻辑不硬编码」的既定口径）。
 *   为不触碰 game.js 中间代码（§5.45 铁律），本区块把宝箱渲染进 w.pickups **仅用于绘制**，
 *   实际「走近拾取 → 入包」由本区块在 tick() 内自行判定并走 grantItemToRun（唯一入包点）。
 *   入包后立即从两处移除 → **一只宝箱只入包一次**（无重复入账）。 */
var EndlessReward = {
  lastSeenCleared: 0,
  chestPickups: [],

  reset: function () { this.lastSeenCleared = 0; this.chestPickups.length = 0; },

  /* 每帧驱动（由 Game.loop 无尽分支单行调用）：
   *   ① 把 Endless 上报的「新清空波次」翻译为地面宝箱掉落；
   *   ② 宝箱拾取判定（走近自动拾取 → grantItemToRun 入包）。
   * 返回 { dropped, picked } 供测试断言。不依赖 DOM，安全降级。 */
  tick: function (world, dt) {
    var res = { dropped: 0, picked: 0 };
    if (typeof Endless === "undefined" || !Endless || !Endless.state) return res;
    if (!world || world.kind !== "endless") return res;
    var st = Endless.state;
    var cleared = Number(st.lastWaveCleared) || 0;
    if (cleared > 0 && cleared > this.lastSeenCleared) {   // 新清空波次
      this.lastSeenCleared = cleared;
      if (st.lastWaveChest) res.dropped = this.dropChest(world, cleared);
    }
    res.picked = this._collectChests(world, dt);
    return res;
  },

  /* 在玩家附近落地一枚宝箱：仅推入 w.pickups 用于**绘制**（复用既有绘制），
   * 同时登记到 chestPickups 供拾取判定。返回掉落数（0/1）。 */
  dropChest: function (world, wave) {
    var cfg = endlessRewardCfg();
    var q = cfg.chestQual;
    var w = world;
    var px = (typeof G !== "undefined" && G && G.player) ? G.player.x : (w.w / 2);
    var py = (typeof G !== "undefined" && G && G.player) ? G.player.y : (w.h / 2);
    var a = (typeof U !== "undefined" && U.rand) ? U.rand(0, Math.PI * 2) : 0;
    var r = Math.min(cfg.chestDropRadius, 120);
    var x = Math.max(40, Math.min(w.w - 40, px + Math.cos(a) * r));
    var y = Math.max(40, Math.min(w.h - 40, py + Math.sin(a) * r));
    var item = (typeof makeChestItem === "function") ? makeChestItem(q) : null;
    if (!item) return 0;
    if (!w.pickups) w.pickups = [];
    // 绘制桩：type 用 "coin" 以便既有渲染画一个金色点（不给 value，避免被既有拾取逻辑当金币加钱）
    var vis = { type: "coin", value: 0, chestVisual: true, x: x, y: y, vx: 0, vy: 0, life: cfg.chestLife };
    w.pickups.push(vis);
    this.chestPickups.push({ x: x, y: y, chestQ: q, item: item, life: cfg.chestLife, vis: vis });
    try {
      if (typeof UI !== "undefined" && UI.toast) {
        UI.toast("▣ 第 " + wave + " 波奖励宝箱掉落（走过去拾取）", "gold");
      }
    } catch (e) { /* 提示失败不影响掉落 */ }
    return 1;
  },

  /* 拾取判定：任一存活英雄靠近 → grantItemToRun 入包（唯一入包点）→ 移除拾取物。
   * 背包满/失败时丢弃（与主地图精英掉落同口径 full:"discard"，见 §5.32）。返回拾取数。 */
  _collectChests: function (world, dt) {
    if (!this.chestPickups.length) return 0;
    var r = (typeof G !== "undefined" && G) ? G.run : null;
    var heroes = (typeof aliveHeroes === "function") ? aliveHeroes() : [];
    var picked = 0;
    var left = [];
    for (var i = 0; i < this.chestPickups.length; i++) {
      var cp = this.chestPickups[i];
      if (dt) cp.life -= dt;
      var hit = false;
      for (var j = 0; j < heroes.length; j++) {
        var h = heroes[j];
        if (cp.life > 0 && U.dist(h.x, h.y, cp.x, cp.y) < (h.r || 16) + 22) { hit = true; break; }
      }
      if (hit && r && typeof grantItemToRun === "function") {
        var ok = grantItemToRun(r, cp.item, { full: "discard" });
        try {
          if (typeof UI !== "undefined" && UI.toast) {
            if (ok) UI.toast("▣ 拾取 " + cp.item.name, "gold");
            else UI.toast("背包已满，奖励宝箱作废", "bad");
          }
        } catch (e) { /* 提示失败不影响拾取 */ }
        picked++;
        if (cp.vis) cp.vis.life = 0;      // 移出绘制
        continue;                          // 不再保留 → 只入包一次
      }
      if (cp.life > 0) left.push(cp);
      else if (cp.vis) cp.vis.life = 0;   // 超时 → 移出绘制
    }
    this.chestPickups = left;
    return picked;
  },

  /* 统一入账点（★ 唯一）：把 run 内已累计的无尽结晶 count 一次性写进局外存档。
   * 幂等保护：调用方须保证「同一 run 只调一次」（死亡结算路径天然只调一次）。
   * 返回实际入账数。复用 Meta.data.crystals（与撤离/死亡同一货币）。 */
  bank: function (count) {
    var n = Number(count) || 0;
    if (n <= 0) return 0;
    if (typeof Meta === "undefined" || !Meta || !Meta.data) return 0;
    Meta.data.crystals = (Meta.data.crystals || 0) + n;
    if (Meta.commit) Meta.commit();
    return n;
  },

  /* 死亡保留比例：继承 CFG.outLevel.deathRatio（首版策略，见决策 ②）。
   * 传入 crystals = Endless 累计结晶 → 返回实际到手（死亡结算用）。 */
  keptOnDeath: function (crystals) {
    var cfg = endlessRewardCfg();
    var c = Number(crystals) || 0;
    if (!cfg.inheritDeathRatio) return c;
    var dr = (typeof CFG !== "undefined" && CFG && CFG.outLevel && CFG.outLevel.deathRatio !== undefined)
      ? CFG.outLevel.deathRatio : 0.3;
    return Math.floor(c * dr);
  },

  /* ============ 入账链路审计（链路唯一性自证，供测试与运行时共用） ============
   * 口径澄清（审计结论）：
   *   · Endless.settle().crystals = Σ waveReward(w)（纯波次结晶，**不含金币折算**，不含 BOSS）。
   *     —— 金币是局内货币，既不进无尽结晶也不走 settleConvert（§5.7「局内金币归零不折算」）。
   *   · 该 crystals 的**唯一入账点** = game.js showEndlessSettle 内 `Meta.data.crystals += s.crystals`
   *     （🅑 落地）；本区块提供 bank() 作为**等价/可测**的统一入口，二者语义一致，**绝不同时调用**。
   *   · 宝箱拾取走 grantItemToRun 入包 → 若死亡，宝箱作为背包物品参与既有死亡逻辑；
   *     但无尽死亡**不做 settleConvert**（showEndlessSettle 未调 calcSettleConvert）→
   *     宝箱价值**不会**被折算成结晶，因此不存在「宝箱价值 + 波次结晶」的重复入账。
   *   · showEndlessSettle 调 publishCrystalReport(s.kills,false,false,0) 里 boss 传 0（显式 0，
   *     非 undefined）→ buildCrystalReport 不会重算 boss，total 恒 0 → **报告不重复计入波次结晶**。
   * 下面 auditReport() 把本局无尽结晶重建成一份与 UI 同构的报告，作为结算明细的**权威来源**。 */
  auditReport: function (crystals, kills, wave) {
    var c = Number(crystals) || 0;
    var lines = [];
    lines.push("波次清算 ×" + (Number(wave) || 0) + " 波 → +" + c);
    lines.push("本局合计 +" + c + " 结晶");
    return { total: c, boss: 0, convertTotal: 0, waveCrystals: c, kills: Number(kills) || 0,
      extracted: false, died: true, lines: lines };
  },

  /* 结算明细对齐：把 G.lastSettleReport 重写为「无尽口径」明细（涵盖波次结晶），
   * 使结算面板 _crystalReportLine 显示的总计 = 真正入账数（而非 0）。
   * 这是**幂等覆盖**（非叠加入账）——只改报告文本，不改 Meta.data.crystals。 */
  alignSettleReport: function (crystals, kills, wave) {
    var rep = this.auditReport(crystals, kills, wave);
    if (typeof G !== "undefined" && G) G.lastSettleReport = rep;
    if (typeof Meta !== "undefined" && Meta) Meta.lastReport = rep;
    return rep;
  },
};

/* ============================================================================
 * 接线：把 EndlessReward.tick 挂到无尽主循环（不改 main.js 中间代码，§5.45）
 * ----------------------------------------------------------------------------
 * 手段：**包装 Endless.update**（monkey-patch）——主循环里既有单行调用
 *   `if (G.inEndless && …) Endless.update(G.activeWorld, dt);`
 * 原样保留；本区块在加载时把 Endless.update 换成「先原逻辑、后 tick」的组合函数。
 * 优点：零中间代码改动、幂等（用 _rewardWrapped 标记防重复包装）、非无尽世界零副作用。
 * 同时监听结算：包装 `window.showEndlessSettle` 不可行（函数是全局声明），
 *   故改为在 tick() 里检测「running 由 true → false」的结算瞬间，做明细对齐（幂等）。
 * ========================================================================== */
function installEndlessRewardHook() {
  if (typeof Endless === "undefined" || !Endless) return false;
  if (Endless.__rewardWrapped) return true;              // 已包装 → 幂等返回
  var origUpdate = Endless.update;
  if (typeof origUpdate !== "function") return false;
  Endless.update = function (world, dt) {
    var took = origUpdate.call(this, world, dt);         // 原波次/刷怪/难度逻辑（逐位不变）
    try { EndlessReward.tick(world, dt); } catch (e) { /* 奖励层异常绝不影响战斗主循环 */ }
    return took;
  };
  /* 包装 settle：把返回的 crystals 收敛为「死亡保留后」的到手数（继承 CFG.outLevel.deathRatio）。
   * 理由（审计结论 ④）：🅑 的 showEndlessSettle 直接把 settle().crystals 加进存档、并未打折；
   * 而死亡保留 30% 是既有口径（既有一切死亡路径都打折）。若不收敛，则「面板写保留 30%、
   * 实际发 100%」——口径自相矛盾。此处**在唯一的 settle 出口收敛**，使
   *   settle().crystals == 实际入账数 == 明细报告 total
   * 三者恒等 → 不重复、不漏算。（Endless.state.crystals 保留原始累计值，供审计/展示。） */
  var origSettle = Endless.settle;
  if (typeof origSettle === "function") {
    Endless.settle = function () {
      var s = origSettle.apply(this, arguments);
      try {
        var raw = Number(s.crystals) || 0;
        s.rawCrystals = raw;                                   // 原始波次累计（审计用）
        s.crystals = EndlessReward.keptOnDeath(raw);           // 收敛为到手数
      } catch (e) { /* 收敛失败则退回原值（不阻断结算） */ }
      return s;
    };
    Endless.__rewardSettleWrapped = true;
  }
  Endless.__rewardWrapped = true;
  return true;
}

/* 结算明细对齐：Endless.running 从 true → false 时（settle 已跑），
 * 用 Endless.state 的权威数据重写 G.lastSettleReport（幂等，只改报告）。 */
function endlessRewardOnSettle() {
  if (typeof Endless === "undefined" || !Endless || !Endless.state) return null;
  var st = Endless.state;
  if (st.running) return null;                           // 未结算
  var crystals = EndlessReward.keptOnDeath(st.crystals); // 死亡保留比例（首版继承）
  return EndlessReward.alignSettleReport(crystals, st.kills, st.wave);
}

/* 包装 showEndlessSettle（game.js 🅑 定义）：在「结晶入账 + publishCrystalReport」之后，
 * 用无尽口径重写 G.lastSettleReport，使结算面板明细行显示**真正入账的波次结晶总计**。
 * ⚠️ 只覆盖报告文本，**不改 Meta.data.crystals**（入账仍由 showEndlessSettle 唯一完成）→ 无重复入账。
 * 幂等：_rewardSettleWrapped 标记防重复包装。 */
function installEndlessSettleHook() {
  if (typeof showEndlessSettle !== "function") return false;
  if (showEndlessSettle.__rewardSettleWrapped) return true;
  var orig = showEndlessSettle;
  showEndlessSettle = function () {
    var ret = orig.apply(this, arguments);
    try { endlessRewardOnSettle(); } catch (e) { /* 明细对齐失败不影响结算 */ }
    return ret;
  };
  showEndlessSettle.__rewardSettleWrapped = true;
  return true;
}

/* 进入无尽时重置奖励层运行时状态（清上次残留的宝箱 / 清空波标记）。
 * 由 installEndlessRewardHook 一并包装 enterEndless（同 monkey-patch 手法）。 */
function installEndlessRewardResetHook() {
  if (typeof enterEndless !== "function") return false;
  if (enterEndless.__rewardResetWrapped) return true;
  var origEnter = enterEndless;
  enterEndless = function () {
    EndlessReward.reset();                               // 进门前清状态（幂等）
    installEndlessRewardHook();                          // 懒接线：若 endless.js 后置加载，进门时补挂
    return origEnter.apply(this, arguments);
  };
  enterEndless.__rewardResetWrapped = true;
  return true;
}

/* 加载即接线（Endless/enterEndless 均已由 game.js/endless.js 定义）。
 * ⚠️ 若加载顺序导致 Endless 尚未就绪（如 endless.js 在 main.js 之后加载），
 *    首次 installEndlessRewardHook() 返回 false；由 wrapped enterEndless 懒补挂。 */
installEndlessRewardHook();
installEndlessRewardResetHook();
installEndlessSettleHook();

/* 暴露到全局（纯全局脚本；供结算面板 / 测试 / 主会话收口调用） */
if (typeof globalThis !== "undefined") {
  globalThis.EndlessReward = EndlessReward;
  globalThis.endlessRewardCfg = endlessRewardCfg;
  globalThis.endlessRewardOnSettle = endlessRewardOnSettle;
}
