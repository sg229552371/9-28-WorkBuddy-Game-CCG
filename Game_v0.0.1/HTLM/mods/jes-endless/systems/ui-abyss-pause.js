/* ============================================================
 * ui-abyss-pause.js —— 21.19 W5 深渊局内「暂停菜单 + 主动退出」
 * ------------------------------------------------------------
 * 契约（消费冻结的 #screen-abyss-pause 屏，index.html 已就绪）：
 *   • UI.abyssPaused        —— 暂停状态标记（bool）
 *   • UI.showAbyssPause()   —— 弹暂停面板 + Game.paused = true
 *   • UI.hideAbyssPause()   —— 关面板 + Game.paused = false
 *   • UI.toggleAbyssPause() —— 翻转（供 W8 的 ESC / 按钮接线）
 *   • UI.initAbyssPause()   —— 绑定 #btn-abyss-resume（继续）/ #btn-abyss-quit（放弃回主城）
 *   • UI.quitAbyssPause()   —— 放弃：先收面板再调 exitEndlessToCity()（modes.js 既有）
 * 暂停闸门复用 Game.paused（同 ui-panels.js showEndlessIntro 口径 21.18）：
 *   主循环据此跳过世界/玩家/同伴更新 —— 怪物静止、不结算伤害。
 * 安全守卫：Game / G / DOM 全部 typeof 探测；仅在 G.inEndless 时生效，
 *   非深渊（主线 / 主城）调用一律无副作用早退。无 DOM 安全早退（无头测试可跑）。
 * 加载顺序：ui-panels.js 之后、main.js 之前（W8 集成统一接线）。
 * ============================================================ */
"use strict";

(function () {
  /* UI 未就绪（异常加载序）→ 静默放弃，不抛异常 */
  if (typeof UI === "undefined" || !UI) return;
  /* 幂等防重：重复 <script> 引入不叠加绑定 */
  if (UI.__abyssPauseLoaded) return;
  UI.__abyssPauseLoaded = true;

  /* ---------- 内部工具（全守卫） ---------- */
  function el(id) {
    if (typeof document === "undefined" || !document || !document.getElementById) return null;
    return document.getElementById(id);
  }
  /* 仅深渊局内可用（硬约束 #6：非深渊世界零影响） */
  function inAbyss() {
    return typeof G !== "undefined" && !!G && G.inEndless === true;
  }
  /* Game.paused 闸门（typeof 守卫兼容测试桩：无 Game 时静默） */
  function setPaused(v) {
    if (typeof Game !== "undefined" && Game) Game.paused = v;
  }

  /* ---------- 状态 ---------- */
  UI.abyssPaused = false;

  /* ---------- 显示暂停面板 ---------- */
  UI.showAbyssPause = function () {
    if (!inAbyss()) return false;           // 非深渊：无副作用早退
    setPaused(true);                        // 复用主循环暂停闸门
    UI.abyssPaused = true;
    var scr = el("screen-abyss-pause");
    if (scr && scr.classList) scr.classList.remove("hidden");
    var info = el("abyss-pause-info");
    if (info) {
      /* 面板信息：只做展示，读不到就留占位文案（不耦合运行时字段） */
      var wave = (typeof Endless !== "undefined" && Endless && Endless.wave !== undefined) ? Endless.wave : null;
      var tier = (typeof Endless !== "undefined" && Endless && Endless.tier !== undefined) ? Endless.tier : null;
      var parts = [];
      if (tier !== null) parts.push("当前层级 · 第 " + tier + " 层");
      if (wave !== null) parts.push("已推进至第 " + wave + " 波");
      parts.push("怪物已静止，时间不会流逝");
      info.innerHTML = parts.map(function (s) { return '<div class="tip-line">◆ ' + s + "</div>"; }).join("");
    }
    var hud = el("hud");
    if (hud && hud.classList) hud.classList.add("hidden");
    return true;
  };

  /* ---------- 关闭暂停面板（继续游戏） ---------- */
  UI.hideAbyssPause = function () {
    if (!inAbyss()) return false;           // 非深渊：不动 Game.paused（无副作用）
    setPaused(false);
    UI.abyssPaused = false;
    var scr = el("screen-abyss-pause");
    if (scr && scr.classList) scr.classList.add("hidden");
    var hud = el("hud");
    if (hud && hud.classList) hud.classList.remove("hidden");
    return true;
  };

  /* ---------- 翻转（W8 接线口：ESC / 暂停按钮） ---------- */
  UI.toggleAbyssPause = function () {
    if (!inAbyss()) return false;
    return UI.abyssPaused ? UI.hideAbyssPause() : UI.showAbyssPause();
  };

  /* ---------- 放弃并返回主城（调 modes.js 既有 exitEndlessToCity） ---------- */
  UI.quitAbyssPause = function () {
    if (!inAbyss()) return false;
    UI.hideAbyssPause();                    // 先收面板恢复 paused（此时仍 inEndless）
    if (typeof exitEndlessToCity === "function") {
      exitEndlessToCity();
      return true;
    }
    return false;
  };

  /* ---------- 事件绑定（幂等；按钮动作自身带深渊守卫，绑定无条件安全） ---------- */
  UI.initAbyssPause = function () {
    var resume = el("btn-abyss-resume");
    if (resume) resume.onclick = function () { UI.hideAbyssPause(); };
    var quit = el("btn-abyss-quit");
    if (quit) quit.onclick = function () { UI.quitAbyssPause(); };
    return true;
  };
})();

/* 暴露（UI 本为全局对象，这里确保沙箱环境可见） */
if (typeof globalThis !== "undefined" && typeof UI !== "undefined") globalThis.UI = UI;
