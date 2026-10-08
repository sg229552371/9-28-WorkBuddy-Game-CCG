/* ============================================================================
 * 21.19 深渊层级（Tier）系统 —— W1 波次模块（js/endless-tier.js）
 * ----------------------------------------------------------------------------
 * 契约（消费冻结的 CFG.endless.tier，见 js/config.js:2186）：
 *   · Endless.tier            当前层级（number，初值 CFG.endless.tier.defaultSelected / 1）
 *   · Endless.tierMul()       难度系数：按 anchors 分段线性插值（锚点外自然封端）
 *   · Endless.rewardMul()     奖励倍率：1 + (tier-1) * rewardMulPerTier
 *   · Endless.setTier(n)      Clamp 到 [min,max] 后设值，返回生效值
 *   · Endless.maxUnlockedTier() 读 Meta.data.abyss.bestTier+1，兜底 unlock.startMax
 *   · Endless.tierList()      [{n, mul, locked}]（min..max 全层一览）
 *   · Endless.tierLabel(n)    labelPrefix + " · 第 N 层"
 * 接线（猴子补丁，幂等）：包装 Endless.hpMul / Endless.dmgMul，各乘 tierMul()。
 *   · tierMul 只放大**怪物**强度（hpMul/dmgMul 只被怪物生成路径消费），不影响玩家；
 *   · 仅深渊世界生效（G.inEndless / G.activeWorld.kind === "endless"），否则乘 1（主线零影响）；
 *   · 重复加载不叠加：__tierWrapped 标记防重。
 *
 * 项目铁律对齐（G_docs/waves/endless_21_19_waves.md 全体硬约束）：
 *   · 纯全局脚本（var/function），无 DOM 依赖，无头可跑；
 *   · 数值全读 CFG，CFG 缺失时用内置兜底常量安全降级；
 *   · 非深渊世界零影响。
 * ========================================================================== */
"use strict";

/* ---------- 内置兜底常量（仅当 CFG.endless.tier 缺失/残缺时降级使用） ---------- */
var _TIER_FALLBACK = {
  min: 1, max: 20, defaultSelected: 1,
  anchors: [[1, 1.0], [5, 1.6], [10, 2.4], [15, 3.2], [20, 4.0]],
  rewardMulPerTier: 0.12,
  startMax: 3,
  labelPrefix: "深渊",
};

/* ---------- 配置安全读取 ---------- */
function _tierCfg() {
  var t = (typeof CFG !== "undefined" && CFG && CFG.endless && CFG.endless.tier) ? CFG.endless.tier : {};
  var out = {};
  out.min = (typeof t.min === "number") ? t.min : _TIER_FALLBACK.min;
  out.max = (typeof t.max === "number") ? t.max : _TIER_FALLBACK.max;
  out.defaultSelected = (typeof t.defaultSelected === "number") ? t.defaultSelected : _TIER_FALLBACK.defaultSelected;
  out.anchors = (t.anchors && t.anchors.length) ? t.anchors : _TIER_FALLBACK.anchors;
  out.rewardMulPerTier = (typeof t.rewardMulPerTier === "number") ? t.rewardMulPerTier : _TIER_FALLBACK.rewardMulPerTier;
  out.startMax = (t.unlock && typeof t.unlock.startMax === "number") ? t.unlock.startMax : _TIER_FALLBACK.startMax;
  out.labelPrefix = (typeof t.labelPrefix === "string") ? t.labelPrefix : _TIER_FALLBACK.labelPrefix;
  return out;
}

/* ---------- 读取当前是否处于深渊世界（供包装层判定；非深渊 → 因子 1） ---------- */
function _tierInEndless() {
  var g = (typeof G !== "undefined" && G) ? G : null;
  if (!g) return false;
  if (g.inEndless === true) return true;
  return !!(g.activeWorld && g.activeWorld.kind === "endless");
}

/* 深渊难度因子：非深渊世界恒 1（主线 / 主城 / 裂缝零影响） */
function _tierFactor() {
  if (!_tierInEndless()) return 1;
  return (typeof Endless !== "undefined" && Endless && typeof Endless.tierMul === "function")
    ? Endless.tierMul() : 1;
}

/* ---------- 契约方法（挂到既有 Endless 对象上；endless.js 在本文件之前加载） ---------- */
(function _installTierApi() {
  if (typeof Endless === "undefined" || !Endless) return;

  /* 当前层级：初值 defaultSelected；重复加载时保留现值（幂等，不重置玩家所选层） */
  var cfg0 = _tierCfg();
  if (typeof Endless.tier !== "number") Endless.tier = cfg0.defaultSelected;

  /* 任意层级的难度系数（分段线性插值，锚点外封端；与 Endless._lerpAnchors 同口径，独立实现避免耦合） */
  Endless._tierMulAt = function (n) {
    var c = _tierCfg();
    var a = c.anchors;
    var x = Math.max(c.min, Math.min(c.max, (typeof n === "number") ? n : this.tier));
    if (!a || !a.length) return 1;
    var m = a.length;
    if (x <= a[0][0]) return a[0][1];
    if (x >= a[m - 1][0]) return a[m - 1][1];
    for (var i = 0; i < m - 1; i++) {
      var x0 = a[i][0], x1 = a[i + 1][0];
      if (x >= x0 && x <= x1) {
        var t = (x1 === x0) ? 0 : (x - x0) / (x1 - x0);
        return a[i][1] + t * (a[i + 1][1] - a[i][1]);
      }
    }
    return a[m - 1][1];
  };

  /* 当前层级难度系数（只影响怪物强度；怪物生成路径独占消费 hpMul/dmgMul） */
  Endless.tierMul = function () {
    return this._tierMulAt(this.tier);
  };

  /* 奖励倍率：1 + (tier-1) * rewardMulPerTier */
  Endless.rewardMul = function () {
    var c = _tierCfg();
    return 1 + Math.max(0, this.tier - 1) * c.rewardMulPerTier;
  };

  /* 设层：Clamp 到 [min,max] 后设值，返回生效值 */
  Endless.setTier = function (n) {
    var c = _tierCfg();
    var v = (typeof n === "number" && isFinite(n)) ? n : c.defaultSelected;
    v = Math.max(c.min, Math.min(c.max, v));
    this.tier = v;
    return v;
  };

  /* 最高可选层：Meta.data.abyss.bestTier + 1（sequential 解锁）；无存档/无字段 → startMax。
   * 结果夹到 [1, max]。Meta 缺失（老存档 / 沙箱）时安全降级，不抛错。 */
  Endless.maxUnlockedTier = function () {
    var c = _tierCfg();
    var best = null;
    try {
      if (typeof Meta !== "undefined" && Meta && Meta.data && Meta.data.abyss
        && typeof Meta.data.abyss.bestTier === "number") {
        best = Meta.data.abyss.bestTier;
      }
    } catch (e) { best = null; }
    var n = (best !== null) ? Math.max(1, best + 1) : c.startMax;
    return Math.max(1, Math.min(c.max, n));
  };

  /* 全层一览：[{n, mul, locked}]，n 从 min 到 max；locked = n > maxUnlockedTier() */
  Endless.tierList = function () {
    var c = _tierCfg();
    var unlocked = this.maxUnlockedTier();
    var out = [];
    for (var n = c.min; n <= c.max; n++) {
      out.push({ n: n, mul: this._tierMulAt(n), locked: n > unlocked });
    }
    return out;
  };

  /* 层级显示名："深渊 · 第 N 层"（prefix 读 CFG.endless.tier.labelPrefix） */
  Endless.tierLabel = function (n) {
    var c = _tierCfg();
    var v = (typeof n === "number") ? n : this.tier;
    return c.labelPrefix + " · 第 " + v + " 层";
  };
})();

/* ---------- 猴子补丁接线：hpMul / dmgMul 各乘 tierMul()（幂等，__tierWrapped 防重） ---------- */
(function _installTierPatch() {
  if (typeof Endless === "undefined" || !Endless) return;
  if (Endless.__tierWrapped) return;                 // 重复加载不叠加（幂等闸门）

  var _baseHpMul = Endless.hpMul;
  var _baseDmgMul = Endless.dmgMul;

  /* 血量倍率 = 原波次曲线 × 层级系数（仅深渊世界；非深渊因子恒 1） */
  Endless.hpMul = function (wave) {
    return _baseHpMul.call(this, wave) * _tierFactor();
  };
  /* 伤害倍率 = 原曲线 × 层级系数（同上） */
  Endless.dmgMul = function (wave) {
    return _baseDmgMul.call(this, wave) * _tierFactor();
  };

  Endless.__tierWrapped = true;
})();

/* ---------- 暴露到全局（纯全局脚本） ---------- */
if (typeof globalThis !== "undefined") {
  globalThis.Endless = Endless;
  globalThis.EndlessTier = { version: "21.19-W1", inEndless: _tierInEndless };
}
