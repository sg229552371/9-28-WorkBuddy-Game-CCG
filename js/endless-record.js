/* ============================================================================
 * 21.19 W6 · 深渊最高记录 + 首通奖励（js/endless-record.js）
 * ----------------------------------------------------------------------------
 * 契约（消费 CFG.endless.records；写 Meta.data.abyss）：
 *   · EndlessRecord.ensure()            → 惰性补全 Meta.data.abyss（不改 game.js）
 *   · EndlessRecord.onSettle(settle)    → 结算上报：更新 bestWave / fastestSec /
 *                                         bestTier + clearedTiers / firstExtract /
 *                                         firstFinalBoss
 *   · EndlessRecord.grantFirstRewards() → 首次撤离 / 首杀最终 BOSS 各给一次额外
 *                                         结晶（写 Meta.data.crystals，严格幂等）
 *   · EndlessRecord.best()              → 返回摘要（供 W4 #abyss-best 展示）
 * 设计要点：
 *   · 无 Meta 环境（无头测试 / 沙箱降级）用模块内内存兜底对象，保证可测不抛错。
 *   · 结晶入账口径与 rewards.js bank() 一致：Meta.data.crystals += n; Meta.commit()。
 *   · 幂等标记（firstExtractGranted / firstFinalBossGranted）随 abyss 落盘。
 *   · 非深渊世界（G.inEndless === false）零影响，早退返回 null。
 * ========================================================================== */
"use strict";

var EndlessRecord = (function () {

  /* abyss 缺省字段（CFG 缺失时的安全降级基线） */
  var ABYSS_KEYS = ["bestWave", "bestTier", "fastestSec", "firstExtract", "firstFinalBoss"];
  function freshAbyss() {
    return { bestWave: 0, bestTier: 0, fastestSec: 0, firstExtract: false, firstFinalBoss: false, clearedTiers: {} };
  }

  /* 无 Meta 时的内存兜底根（含 abyss + crystals，保证链路可测） */
  var _fallback = null;

  function hasMeta() {
    return typeof Meta !== "undefined" && !!Meta && !!Meta.data;
  }

  /* 记录配置：只读 CFG.endless.records，缺失时内置兜底常量安全降级 */
  function recCfg() {
    var r = (typeof CFG !== "undefined" && CFG && CFG.endless && CFG.endless.records) || {};
    return {
      firstExtractReward: (typeof r.firstExtractReward === "number") ? r.firstExtractReward : 200,
      firstFinalBossReward: (typeof r.firstFinalBossReward === "number") ? r.firstFinalBossReward : 100,
    };
  }

  /* 惰性补全：确保 abyss 六要素齐全；已存字段一律不覆盖（幂等） */
  function ensure() {
    var a;
    if (hasMeta()) {
      a = Meta.data.abyss;
      if (!a || typeof a !== "object") a = Meta.data.abyss = {};
    } else {
      if (!_fallback) _fallback = { abyss: freshAbyss(), crystals: 0, __fallback: true };
      a = _fallback.abyss;
    }
    var i, k;
    for (i = 0; i < ABYSS_KEYS.length; i++) {
      k = ABYSS_KEYS[i];
      if (a[k] === undefined) a[k] = freshAbyss()[k];
    }
    if (!a.clearedTiers || typeof a.clearedTiers !== "object") a.clearedTiers = {};
    return a;
  }

  function commit() {
    if (hasMeta() && typeof Meta.commit === "function") {
      try { Meta.commit(); } catch (e) { /* 持久化失败不影响内存记录 */ }
    }
  }

  /* 结晶加账（与 rewards.js bank() 同一唯一口径） */
  function addCrystals(n) {
    if (!(n > 0)) return 0;
    if (hasMeta()) {
      Meta.data.crystals = (Meta.data.crystals || 0) + n;
      commit();
      return n;
    }
    if (_fallback) { _fallback.crystals = (_fallback.crystals || 0) + n; return n; }
    return 0;
  }

  /* ============ 结算上报 ============
   * settle 形如 { wave, kills, crystals, elapsed, extracted, reason, timedOut, tier, bossKills }
   * 规则：
   *   · bestWave     → 任意结算都更新（取最大）
   *   · fastestSec   → 仅撤离成功且有 elapsed>0（取最小，0 表示尚无记录）
   *   · bestTier / clearedTiers[tier] → 仅撤离成功
   *   · firstExtract → 首次撤离成功
   *   · firstFinalBoss → reason==="extract" 或 bossKills>0（首次即标记）
   * 非深渊世界（G.inEndless === false）直接早退返回 null，零副作用。 */
  function onSettle(settle) {
    var s = settle || {};
    if (typeof G !== "undefined" && G && G.inEndless === false) return null;

    var a = ensure();
    var extracted = !!s.extracted;
    var elapsed = Number(s.elapsed) || 0;
    var wave = Number(s.wave) || 0;
    var tier = Number(s.tier) || 0;

    if (wave > a.bestWave) a.bestWave = wave;

    if (extracted && elapsed > 0) {
      a.fastestSec = (a.fastestSec > 0) ? Math.min(a.fastestSec, elapsed) : elapsed;
    }

    if (extracted && tier > 0) {
      if (tier > a.bestTier) a.bestTier = tier;
      a.clearedTiers[tier] = true;
      if (!a.firstExtract) a.firstExtract = true;
    }

    if (!a.firstFinalBoss && (s.reason === "extract" || (Number(s.bossKills) || 0) > 0)) {
      a.firstFinalBoss = true;
    }

    commit();
    return a;
  }

  /* ============ 首通额外结晶 ============
   * 首次撤离成功 / 首杀最终 BOSS 各给一次；标记（*Granted）随 abyss 落盘，
   * 二次调用不再给（严格幂等）。返回本次实际发放数。 */
  function grantFirstRewards() {
    var a = ensure();
    var rc = recCfg();
    var total = 0;
    if (a.firstExtract && !a.firstExtractGranted) {
      total += rc.firstExtractReward;
      a.firstExtractGranted = true;
    }
    if (a.firstFinalBoss && !a.firstFinalBossGranted) {
      total += rc.firstFinalBossReward;
      a.firstFinalBossGranted = true;
    }
    if (total > 0) addCrystals(total);
    commit();
    return total;
  }

  /* 摘要（供 UI；返回副本语义的字段，clearedTiers 引用只读使用） */
  function best() {
    var a = ensure();
    var cleared = 0, k;
    for (k in a.clearedTiers) { if (a.clearedTiers[k]) cleared++; }
    return {
      bestWave: a.bestWave || 0,
      bestTier: a.bestTier || 0,
      fastestSec: a.fastestSec || 0,
      firstExtract: !!a.firstExtract,
      firstFinalBoss: !!a.firstFinalBoss,
      clearedTiers: a.clearedTiers || {},
      clearedCount: cleared,
      crystals: hasMeta() ? (Meta.data.crystals || 0) : (_fallback ? (_fallback.crystals || 0) : 0),
    };
  }

  return {
    ensure: ensure,
    onSettle: onSettle,
    grantFirstRewards: grantFirstRewards,
    best: best,
    __isFallback: function () { return !hasMeta() && !!_fallback; },
  };
})();

if (typeof globalThis !== "undefined") globalThis.EndlessRecord = EndlessRecord;
