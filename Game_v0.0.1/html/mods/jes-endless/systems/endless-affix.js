/* ============================================================================
 * 21.19 深渊秘境「词缀系统」（W2）—— js/endless-affix.js
 * ----------------------------------------------------------------------------
 * 契约（消费 CFG.endless.affixes，配置已冻结只读）：
 *   · Endless.state.affixes = []        本局词缀 id 数组（运行时）
 *   · Endless.rollAffixes(tier)         按 countAnchors 分段线性求条数，
 *                                       按 list[].weight 加权「无重复」抽取，写 state.affixes
 *   · Endless.activeAffixes()           本局词缀对象数组（list 条目引用）
 *   · Endless.affixMods()               聚合倍率（缺省 1），必含全部 8 键：
 *       monsterSpdMul / monsterHpMul / monsterAtkMul / waveCapMul /
 *       rewardMul / playerHpMul / timeLimitMul / expMul
 *   · Endless.affixTimeLimitMul()       供 W8 集成读取时限倍率（见下方「待 W8 接线」）
 *
 * 接线（猴子补丁，幂等：包装函数带 __affixWrapped 标记，重复加载不叠加）：
 *   · Endless.hpMul      × monsterHpMul（非深渊世界早退，零影响）
 *   · Endless.dmgMul     × monsterAtkMul
 *   · Endless.waveCap    × waveCapMul（取整：每波只数为整数）
 *   · Endless.waveReward × rewardMul（取整：结晶为整数）
 *   · Endless.begin / Endless.reset  清空 state.affixes（防跨局残留）
 *
 * 待 W8 接线（本模块只暴露接口，不改 timeLeft 状态机）：
 *   · timeLimit：进入深渊首帧 timeLimit × affixTimeLimitMul()（只乘一次）。
 *     原因：Endless.state.timeLeft 是有状态倒计时，包装读取侧会反复乘算/需记录
 *     「已乘」标记，与 W8 的开局时序耦合 → 统一由 W8 在 begin 后一次性折算。
 *   · monsterSpdMul（swift）：包装 Monster 速度字段较复杂 → 只登记不接线（效果待接线）。
 *   · playerHpMul / expMul：由 W8 在建玩家 / 掉落经验处接入（affixMods 已返回）。
 *
 * 设计原则（对齐任务卡硬约束）：
 *   · 纯全局脚本："use strict" + var/function，末尾暴露 globalThis。
 *   · 无 DOM 依赖（不读 document/window），无头可测。
 *   · 数值全读 CFG.endless.affixes；CFG 缺失时安全降级（0 条词缀 / 全 1 倍率）。
 *   · 非深渊世界零影响：倍率包装先判 Endless.isActive()，否则原值直通。
 * ========================================================================== */
"use strict";

(function () {

  /* ---------- 内部工具 ---------- */

  /* 词缀配置（CFG 缺失 → null，全程安全降级） */
  function affixCfg() {
    return (typeof CFG !== "undefined" && CFG.endless && CFG.endless.affixes) ? CFG.endless.affixes : null;
  }

  /* 分段线性插值：优先复用 endless.js 末尾区块的 Endless._lerpAnchors；
   * 该函数不存在时用本地兜底实现（同口径）。 */
  function lerpAnchors(anchors, x, fallback) {
    if (typeof Endless._lerpAnchors === "function") return Endless._lerpAnchors(anchors, x, fallback);
    if (!anchors || !anchors.length) return fallback;
    var n = anchors.length;
    if (x <= anchors[0][0]) return anchors[0][1];
    if (x >= anchors[n - 1][0]) return anchors[n - 1][1];
    for (var i = 0; i < n - 1; i++) {
      var x0 = anchors[i][0], x1 = anchors[i + 1][0];
      if (x >= x0 && x <= x1) {
        var t = (x1 === x0) ? 0 : (x - x0) / (x1 - x0);
        return anchors[i][1] + t * (anchors[i + 1][1] - anchors[i][1]);
      }
    }
    return anchors[n - 1][1];
  }

  /* 确保运行时字段存在（不改 endless.js，惰性补齐）。
   * 用 Array.isArray 而非 instanceof（vm 沙箱跨 realm 字面量数组 instanceof 会误判）。 */
  function ensureState() {
    if (!Endless.state) Endless.state = {};
    if (!Array.isArray(Endless.state.affixes)) Endless.state.affixes = [];
    return Endless.state.affixes;
  }

  /* idempotent 包装器：已带标记则跳过（重复加载 / 双重接入不叠加） */
  function wrapOnce(obj, key, makeWrapper) {
    var orig = obj[key];
    if (typeof orig !== "function" || orig.__affixWrapped) return false;
    var wrapped = makeWrapper(orig);
    wrapped.__affixWrapped = true;              // 幂等标记（任务卡口径）
    wrapped.__affixOrig = orig;                 // 留调试口（不参与行为）
    obj[key] = wrapped;
    return true;
  }

  /* ---------- 契约方法 ---------- */

  /* 词缀条数：按 countAnchors 分段线性插值后取整，夹到 [0, maxActive] 与词缀池大小内。
   *   层 1~2 → 0｜层 3~7 → 1｜层 8~14 → 2｜层 ≥15 → 3（来自冻结配置）。 */
  Endless.affixCountFor = function (tier) {
    var cfg = affixCfg();
    if (!cfg || !cfg.countAnchors || !cfg.countAnchors.length) return 0;
    var n = Math.round(lerpAnchors(cfg.countAnchors, Math.max(1, tier | 0), 0));
    var cap = (typeof cfg.maxActive === "number") ? cfg.maxActive : 3;
    if (cfg.list && cfg.list.length) cap = Math.min(cap, cfg.list.length);
    return Math.max(0, Math.min(n, cap));
  };

  /* 抽取本局词缀：按 weight 加权、无重复；结果写 state.affixes 并返回（id 数组副本）。
   * 纯逻辑，不依赖世界；非深渊调用也只是写 state（全局行为零影响由倍率包装层把关）。 */
  Endless.rollAffixes = function (tier) {
    var cfg = affixCfg();
    var picked = [];
    if (cfg && cfg.list && cfg.list.length) {
      var count = this.affixCountFor(tier);
      var pool = cfg.list.slice();                    // 本局候选（抽取后移除 → 天然无重复）
      var guard = pool.length;                        // 保险：至多抽池大小次
      while (picked.length < count && pool.length && guard-- > 0) {
        var total = 0, i;
        for (i = 0; i < pool.length; i++) total += (pool[i].weight > 0 ? pool[i].weight : 0);
        var idx = 0;
        if (total <= 0) {
          idx = Math.floor(Math.random() * pool.length);   // 全零权重 → 退化为均匀
        } else {
          var r = Math.random() * total, acc = 0;
          for (i = 0; i < pool.length; i++) {
            acc += (pool[i].weight > 0 ? pool[i].weight : 0);
            if (r < acc) { idx = i; break; }
          }
          if (r >= acc) idx = pool.length - 1;             // 浮点边界兜底
        }
        picked.push(pool[idx].id);
        pool.splice(idx, 1);
      }
    }
    ensureState();
    Endless.state.affixes = picked;
    return picked.slice();
  };

  /* 本局词缀对象数组（CFG.list 条目引用；未知 id 跳过，防脏数据抛错） */
  Endless.activeAffixes = function () {
    ensureState();
    var cfg = affixCfg();
    if (!cfg || !cfg.list) return [];
    var byId = {};
    for (var i = 0; i < cfg.list.length; i++) byId[cfg.list[i].id] = cfg.list[i];
    var out = [];
    for (var j = 0; j < Endless.state.affixes.length; j++) {
      var a = byId[Endless.state.affixes[j]];
      if (a) out.push(a);
    }
    return out;
  };

  /* 聚合倍率：缺省全 1；activeAffixes 的 mods 逐键连乘。
   * ⚠️ 必含全部 8 键（含 swift 的 monsterSpdMul / frail 的 playerHpMul / famine 的 expMul，
   *    即便部分效果尚未接线 —— 供 W8 统一消费）。 */
  Endless.affixMods = function () {
    var mods = {
      monsterSpdMul: 1, monsterHpMul: 1, monsterAtkMul: 1, waveCapMul: 1,
      rewardMul: 1, playerHpMul: 1, timeLimitMul: 1, expMul: 1,
    };
    var list = this.activeAffixes();
    for (var i = 0; i < list.length; i++) {
      var m = list[i].mods;
      if (!m) continue;
      for (var k in m) {
        if (typeof m[k] === "number") mods[k] = (mods[k] || 1) * m[k];
      }
    }
    return mods;
  };

  /* 时限倍率（催命 haste）：W8 在进入深渊首帧用 timeLimit × 本值折算（只乘一次）。 */
  Endless.affixTimeLimitMul = function () {
    return this.affixMods().timeLimitMul;
  };

  /* ---------- 猴子补丁接线（幂等，非深渊早退） ---------- */

  /* 血量：原曲线 × 词缀 monsterHpMul */
  wrapOnce(Endless, "hpMul", function (orig) {
    return function (wave) {
      var base = orig.call(this, wave);
      if (typeof this.isActive !== "function" || !this.isActive()) return base;   // 非深渊零影响
      return base * this.affixMods().monsterHpMul;
    };
  });

  /* 伤害：原曲线 × 词缀 monsterAtkMul */
  wrapOnce(Endless, "dmgMul", function (orig) {
    return function (wave) {
      var base = orig.call(this, wave);
      if (typeof this.isActive !== "function" || !this.isActive()) return base;
      return base * this.affixMods().monsterAtkMul;
    };
  });

  /* 每波只数：原曲线 × 词缀 waveCapMul（取整，只数为整数口径） */
  wrapOnce(Endless, "waveCap", function (orig) {
    return function (wave) {
      var base = orig.call(this, wave);
      if (typeof this.isActive !== "function" || !this.isActive()) return base;
      return Math.round(base * this.affixMods().waveCapMul);
    };
  });

  /* 每波结晶：原公式 × 词缀 rewardMul（取整，结晶为整数口径） */
  wrapOnce(Endless, "waveReward", function (orig) {
    return function (wave) {
      var base = orig.call(this, wave);
      if (typeof this.isActive !== "function" || !this.isActive()) return base;
      return Math.round(base * this.affixMods().rewardMul);
    };
  });

  /* 生命周期：开局 / 重置清空词缀（防跨局残留；幂等标记同上） */
  wrapOnce(Endless, "begin", function (orig) {
    return function (world) {
      ensureState();
      Endless.state.affixes = [];
      return orig.call(this, world);
    };
  });
  wrapOnce(Endless, "reset", function (orig) {
    return function () {
      var r = orig.apply(this, arguments);
      ensureState();
      Endless.state.affixes = [];
      return r;
    };
  });

  /* 载入即补齐运行时字段（早于任何 begin/reset 的读取也安全） */
  ensureState();

})();

/* 暴露到全局（纯全局脚本；Endless 本就全局，这里补本模块名供调试 / W8 检测） */
if (typeof globalThis !== "undefined") globalThis.EndlessAffix = { version: "21.19-W2" };
