/* ============================================================
 * ui-abyss.js — 21.19 深渊「入口 / 选层」界面（W4 · 并行波次）
 * ------------------------------------------------------------
 * 契约（消费冻结的 #screen-abyss 屏 + CFG.endless.tier / affixes，只读）：
 *   UI.abyssTier            当前选中的层级（number，初值 CFG.endless.tier.defaultSelected）
 *   UI.showAbyssSelect()    渲染层级列表 + 所选层信息（含词缀预览）+ 最高记录，显示屏幕
 *   UI.hideAbyssSelect()    隐藏屏幕
 *   UI.renderAbyssTiers()   渲染 #abyss-tier-list（.abyss-tier-card，锁定层 .locked，选中 .selected）
 *   UI.initAbyssSelect()    绑定 #btn-abyss-back（回主城）/ #btn-abyss-start（置层 → 进选角）
 * 附加：UI.renderAbyssTierInfo() / UI.renderAbyssBest()（showAbyssSelect 内部调用，供测试单独验证）。
 *
 * 降级策略（并行波次硬约束 #5）：
 *   · Endless.setTier / maxUnlockedTier / tierList 尚未落地（W1）→ 缺失时本地按 CFG 兜底计算；
 *   · EndlessRecord.best（W6）不存在 → 读 Meta.data.abyss；两者都无 → 隐藏 #abyss-best。
 * 词缀预览：只按 countAnchors 求条数并展示前 N 条词缀说明，**仅为预览**，
 *   与运行时 Endless.rollAffixes 的按权重随机结果不保证一致（界面已注明）。
 * 无 DOM（typeof document === "undefined" 或元素缺失）时全部函数安全早退。
 * ============================================================ */
"use strict";

/* ---------- 内置兜底常量（仅 CFG 缺失时使用，正常路径一律读 CFG） ---------- */
var ABYSS_TIER_FB = { min: 1, max: 20, defaultSelected: 1, startMax: 3, labelPrefix: "深渊",
  anchors: [[1, 1.0], [20, 4.0]], rewardMulPerTier: 0.12, maxActive: 3 };

/* 读 CFG.endless.tier（缺失安全降级） */
function abyssTierCfg() {
  return (typeof CFG !== "undefined" && CFG.endless && CFG.endless.tier) || ABYSS_TIER_FB;
}

/* 分段线性插值（与 waveCapAnchors / tier.anchors 同口径）：x 低于首锚取首值、高于末锚取末值 */
function abyssAnchorInterp(anchors, x, fallback) {
  if (!anchors || !anchors.length) return fallback(x);
  if (x <= anchors[0][0]) return anchors[0][1];
  for (var i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) {
      var a = anchors[i - 1], b = anchors[i];
      var t = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return anchors[anchors.length - 1][1];
}

/* 当前最高可选层：优先 W1 的 Endless.maxUnlockedTier()；否则 Meta.data.abyss.bestTier+1；
 * 再无 → CFG.endless.tier.unlock.startMax。 */
function abyssMaxUnlocked() {
  if (typeof Endless !== "undefined" && Endless && typeof Endless.maxUnlockedTier === "function") {
    var v = Endless.maxUnlockedTier();
    if (typeof v === "number" && isFinite(v)) return v;
  }
  var cfg = abyssTierCfg();
  var startMax = (cfg.unlock && cfg.unlock.startMax) || ABYSS_TIER_FB.startMax;
  var best = (typeof Meta !== "undefined" && Meta.data && Meta.data.abyss &&
    typeof Meta.data.abyss.bestTier === "number") ? Meta.data.abyss.bestTier : 0;
  return Math.max(startMax, best + 1);
}

/* 层 n 难度系数（展示用）：Endless.tierList 可用则取其值，否则本地插值 CFG.endless.tier.anchors */
function abyssTierMulOf(n) {
  if (typeof Endless !== "undefined" && Endless && typeof Endless.tierList === "function") {
    try {
      var list = Endless.tierList();
      var hit = list && list.find(function (t) { return t.n === n; });
      if (hit && typeof hit.mul === "number") return hit.mul;
    } catch (e) { /* 落到本地插值 */ }
  }
  var cfg = abyssTierCfg();
  return abyssAnchorInterp(cfg.anchors, n, function (x) {
    var min = cfg.min || 1, max = cfg.max || 20;
    var lo = ABYSS_TIER_FB.anchors[0][1], hi = ABYSS_TIER_FB.anchors[1][1];
    return lo + (hi - lo) * (x - min) / Math.max(1, max - min);
  });
}

/* 层 n 奖励倍率：1 + (tier-1) * rewardMulPerTier */
function abyssTierRewardMulOf(n) {
  var cfg = abyssTierCfg();
  return 1 + (n - 1) * ((typeof cfg.rewardMulPerTier === "number") ? cfg.rewardMulPerTier : ABYSS_TIER_FB.rewardMulPerTier);
}

/* 层 n 词缀条数（按 countAnchors 插值取整，Clamp 到 [0, maxActive]） */
function abyssAffixCountOf(n) {
  var af = (typeof CFG !== "undefined" && CFG.endless && CFG.endless.affixes) || null;
  var anchors = (af && af.countAnchors) || [[1, 0], [3, 1], [8, 2], [15, 3]];
  var cap = (af && af.maxActive) || ABYSS_TIER_FB.maxActive;
  var c = abyssAnchorInterp(anchors, n, function () { return 0; });
  return Math.max(0, Math.min(cap, Math.floor(c)));
}

/* 层 n 显示名：labelPrefix + " · 第 N 层" */
function abyssTierLabelOf(n) {
  var cfg = abyssTierCfg();
  return (cfg.labelPrefix || ABYSS_TIER_FB.labelPrefix) + " · 第 " + n + " 层";
}

/* ---------- 挂载到 UI（沿用 UI.xxx = function(){} 风格；重复加载幂等覆盖） ---------- */
if (typeof UI !== "undefined" && UI) {

  UI.abyssTier = (function () {
    var cfg = abyssTierCfg();
    return (typeof cfg.defaultSelected === "number") ? cfg.defaultSelected : ABYSS_TIER_FB.defaultSelected;
  })();

  /* ---------- 层级列表 ---------- */
  UI.renderAbyssTiers = function () {
    if (typeof document === "undefined" || !document.getElementById) return [];
    var box = document.getElementById("abyss-tier-list");
    if (!box) return [];
    box.innerHTML = "";
    var cfg = abyssTierCfg();
    var min = cfg.min || 1, max = cfg.max || 20;
    var maxUnlocked = abyssMaxUnlocked();
    UI.abyssTier = Math.max(min, Math.min(maxUnlocked, UI.abyssTier || min));   // 选中层失效（被锁）→ 回落到最高可选
    var cards = [];
    for (var n = min; n <= max; n++) {
      var locked = n > maxUnlocked;
      var card = document.createElement("div");
      card.className = "abyss-tier-card" + (locked ? " locked" : "") + (n === UI.abyssTier ? " selected" : "");
      card.dataset.tier = String(n);
      card.innerHTML = locked
        ? '<div class="at-name">' + abyssTierLabelOf(n) + '</div><div class="at-lock">🔒 通关第 ' + (n - 1) + ' 层解锁</div>'
        : '<div class="at-name">' + abyssTierLabelOf(n) + '</div><div class="at-mul">难度 ×' + abyssTierMulOf(n).toFixed(2) + '</div>';
      if (!locked) {
        card.onclick = (function (tier) {
          return function () { UI.abyssTier = tier; UI.renderAbyssTiers(); UI.renderAbyssTierInfo(); };
        })(n);
      }
      box.appendChild(card);
      cards.push(card);
    }
    return cards;
  };

  /* ---------- 所选层信息（难度系数 + 词缀预览） ---------- */
  UI.renderAbyssTierInfo = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var box = document.getElementById("abyss-tier-info");
    if (!box) return;
    var n = UI.abyssTier;
    var count = abyssAffixCountOf(n);
    var affixes = (typeof CFG !== "undefined" && CFG.endless && CFG.endless.affixes && CFG.endless.affixes.list) || [];
    var preview = [];
    for (var i = 0; i < affixes.length && preview.length < count; i++) preview.push(affixes[i]);
    var affixHtml = count <= 0
      ? '<div class="ati-affix-none">本层无词缀</div>'
      : '<div class="ati-affix-list">' + preview.map(function (a) {
          return '<div class="ati-affix-item">◆ <b>' + a.name + '</b>：' + a.desc + '</div>';
        }).join("") + '</div>';
    box.innerHTML =
      '<div class="ati-title">' + abyssTierLabelOf(n) + '</div>' +
      '<div class="ati-diff">难度系数 ×' + abyssTierMulOf(n).toFixed(2) +
      ' · 奖励倍率 ×' + abyssTierRewardMulOf(n).toFixed(2) + '</div>' +
      '<div class="ati-affix">词缀预览（' + count + ' 条 · 仅供预览，实际进入时按权重随机抽取）</div>' +
      affixHtml;
  };

  /* ---------- 最高记录：EndlessRecord.best() → Meta.data.abyss → 隐藏 ---------- */
  UI.renderAbyssBest = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var el = document.getElementById("abyss-best");
    if (!el) return;
    var best = null;
    if (typeof EndlessRecord !== "undefined" && EndlessRecord && typeof EndlessRecord.best === "function") {
      try { best = EndlessRecord.best(); } catch (e) { best = null; }
    }
    if (!best && typeof Meta !== "undefined" && Meta.data && Meta.data.abyss) best = Meta.data.abyss;
    if (best && ((best.bestTier || 0) > 0 || (best.bestWave || 0) > 0)) {
      el.classList.remove("hidden");
      el.innerHTML = '最高记录：第 ' + (best.bestTier || 0) + ' 层 · 最深波次 ' + (best.bestWave || 0) +
        ((best.fastestSec || 0) > 0 ? ' · 最快通关 ' + Math.round(best.fastestSec) + 's' : '');
    } else {
      el.classList.add("hidden");
      el.innerHTML = "";
    }
  };

  /* ---------- 开屏 / 关屏 ---------- */
  UI.showAbyssSelect = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    // 借 UI.showScreen 收起全部已登记屏幕与 HUD（screen-abyss 不在 SCREEN_IDS，随后单独亮出）
    if (typeof UI.showScreen === "function") UI.showScreen("screen-abyss");
    UI.renderAbyssTiers();
    UI.renderAbyssTierInfo();
    UI.renderAbyssBest();
    var scr = document.getElementById("screen-abyss");
    if (scr) scr.classList.remove("hidden");
  };

  UI.hideAbyssSelect = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var scr = document.getElementById("screen-abyss");
    if (scr) scr.classList.add("hidden");
  };

  /* ---------- 按钮绑定（幂等：重复调用只覆盖 onclick，不叠加） ---------- */
  UI.initAbyssSelect = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var back = document.getElementById("btn-abyss-back");
    if (back) back.onclick = function () {
      UI.hideAbyssSelect();
      if (typeof Game !== "undefined" && Game) {
        if (typeof Game.returnToCity === "function") Game.returnToCity();
        else if (typeof Game.enterCity === "function") Game.enterCity();
      }
    };
    var start = document.getElementById("btn-abyss-start");
    if (start) start.onclick = function () {
      if (typeof Endless !== "undefined" && Endless && typeof Endless.setTier === "function") {
        Endless.setTier(UI.abyssTier);   // W1 契约：Clamp + 设值
      }
      if (typeof Game !== "undefined" && Game && typeof Game.enterAbyssCharSelect === "function") {
        Game.enterAbyssCharSelect();     // 既有入口：进选角（来源标记 endless）
      }
    };
  };
}

if (typeof globalThis !== "undefined" && typeof UI !== "undefined") globalThis.UI = UI;
