/* ============================================================
 * ui-abyss.js — 21.20 深渊「战绩榜」界面（层级退役后的 #screen-abyss 复用）
 * ------------------------------------------------------------
 * 21.20 变更（用户口径「深渊大秘境不需要层级」）：
 *   · 层级选择退役（endless-tier.js 删除，进门直通选角，见 modes.js enterAbyssFromPortal）；
 *   · #screen-abyss 复用为「深渊战绩榜」：记录每局 第 N 关 / 耗时 / 结局 /
 *     队伍逐角色 伤害与承伤（数据源 = EndlessRecord.runs()，落盘 Meta.data.abyss.runs）；
 *   · 入口 = 深渊选角界面「深渊战绩」按钮（#btn-abyss-records，main.js 绑定）；
 *   · #btn-abyss-start 语义改为「去选角出战」。
 *
 * 契约：
 *   UI.showAbyssRecords(from)   打开战绩榜（from="charSel" → 返回键回选角；缺省回主城）
 *   UI.hideAbyssRecords()       关闭战绩榜
 *   UI.renderAbyssRecords()     渲染 #abyss-tier-list（.abyss-rec-row，选中 .selected）
 *   UI.renderAbyssRecDetail(i)  渲染 #abyss-tier-info：第 i 条战绩的逐角色明细
 *   UI.renderAbyssBest()        渲染 #abyss-best 摘要（兼容旧方法名）
 *   UI.showAbyssSelect()        兼容别名 = showAbyssRecords("city")
 *   UI.initAbyssSelect()        绑定按钮（幂等）
 * 元素 id 沿用 21.19（#abyss-tier-list / #abyss-tier-info / #abyss-best），CSS 复用 + 新增。
 * 无 DOM（typeof document === "undefined" 或元素缺失）时全部函数安全早退。
 * ============================================================ */
"use strict";

/* 秒 → MM:SS（与 HUD 同口径；缺模块时本地兜底） */
function abyssRecFmtTime(sec) {
  if (typeof formatEndlessTime === "function") return formatEndlessTime(sec);
  var s = (typeof sec === "number" && isFinite(sec)) ? Math.floor(sec) : 0;
  if (s < 0) s = 0;
  var mm = Math.floor(s / 60), ss = s % 60;
  return (mm < 10 ? "0" + mm : "" + mm) + ":" + (ss < 10 ? "0" + ss : "" + ss);
}
if (typeof globalThis !== "undefined") globalThis.abyssRecFmtTime = abyssRecFmtTime;

/* 结局徽标文案 */
function abyssRecOutcome(r) {
  if (!r) return { txt: "—", cls: "" };
  if (r.extracted || r.reason === "extract") return { txt: "撤离成功", cls: "ok" };
  if (r.reason === "timeout") return { txt: "时限耗尽", cls: "bad" };
  return { txt: "深渊阵亡", cls: "bad" };
}

/* 时间戳 → "MM-DD hh:mm"（本地时区） */
function abyssRecFmtDate(t) {
  var d = (typeof t === "number" && t > 0) ? new Date(t) : null;
  if (!d || isNaN(d.getTime())) return "--";
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

/* ---------- 挂载到 UI（重复加载幂等覆盖） ---------- */
if (typeof UI !== "undefined" && UI) {

  UI._abyssRecSel = 0;        // 当前查看的战绩下标
  UI._abyssRecFrom = "city";  // 来源（决定返回键行为）

  /* ---------- 战绩列表 ---------- */
  UI.renderAbyssRecords = function () {
    if (typeof document === "undefined" || !document.getElementById) return [];
    var box = document.getElementById("abyss-tier-list");
    if (!box) return [];
    box.innerHTML = "";
    var list = (typeof EndlessRecord !== "undefined" && EndlessRecord && typeof EndlessRecord.runs === "function")
      ? EndlessRecord.runs() : [];
    UI._abyssRecSel = Math.max(0, Math.min(UI._abyssRecSel || 0, list.length - 1));
    if (!list.length) {
      box.innerHTML = '<div class="abyss-rec-empty">还没有战绩——进一次深渊，记录就来了</div>';
      return [];
    }
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var oc = abyssRecOutcome(r);
      var row = document.createElement("div");
      row.className = "abyss-rec-row" + (i === UI._abyssRecSel ? " selected" : "");
      row.dataset.idx = String(i);
      row.innerHTML =
        '<span class="arr-rank">' + (i + 1) + '</span>' +
        '<span class="arr-wave">第 ' + (r.wave || 0) + ' 关</span>' +
        '<span class="arr-time">⏱ ' + abyssRecFmtTime(r.elapsed) + '</span>' +
        '<span class="arr-kills">击杀 ' + (r.kills || 0) + '</span>' +
        '<span class="arr-out ' + oc.cls + '">' + oc.txt + '</span>' +
        '<span class="arr-date">' + abyssRecFmtDate(r.t) + '</span>';
      row.onclick = (function (idx) {
        return function () { UI._abyssRecSel = idx; UI.renderAbyssRecords(); UI.renderAbyssRecDetail(idx); };
      })(i);
      box.appendChild(row);
      rows.push(row);
    }
    return rows;
  };

  /* ---------- 逐角色明细（伤害 / 占比 / 承伤） ---------- */
  UI.renderAbyssRecDetail = function (idx) {
    if (typeof document === "undefined" || !document.getElementById) return;
    var box = document.getElementById("abyss-tier-info");
    if (!box) return;
    var list = (typeof EndlessRecord !== "undefined" && EndlessRecord && typeof EndlessRecord.runs === "function")
      ? EndlessRecord.runs() : [];
    var r = list[idx];
    if (!r) { box.innerHTML = '<div class="ati-title">选择一条战绩查看队伍明细</div>'; return; }
    var oc = abyssRecOutcome(r);
    var team = Array.isArray(r.team) ? r.team : [];
    var totalDmg = 0, totalTaken = 0, i;
    for (i = 0; i < team.length; i++) { totalDmg += team[i].dmg || 0; totalTaken += team[i].taken || 0; }
    function pct(v, total) { return total > 0 ? Math.round(v / total * 100) : 0; }
    var rows = team.length
      ? team.map(function (m, k) {
          return '<tr>' +
            '<td class="ard-name">' + (k === 0 ? "★ " : "") + m.name + '</td>' +
            '<td class="ard-num">' + (m.dmg || 0) + '</td>' +
            '<td class="ard-pct">' + pct(m.dmg || 0, totalDmg) + '%</td>' +
            '<td class="ard-num taken">' + (m.taken || 0) + '</td>' +
            '</tr>';
        }).join("")
      : '<tr><td colspan="4" class="ard-name">（本局无队伍明细）</td></tr>';
    box.innerHTML =
      '<div class="ati-title">第 ' + (r.wave || 0) + ' 关 · ' + oc.txt +
      ' · 用时 ' + abyssRecFmtTime(r.elapsed) + '</div>' +
      '<table class="abyss-rec-detail">' +
      '<thead><tr><th>角色</th><th>伤害</th><th>占比</th><th>承伤</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      (team.length ? '<tfoot><tr><td>合计</td><td class="ard-num">' + totalDmg + '</td><td></td><td class="ard-num taken">' + totalTaken + '</td></tr></tfoot>' : "") +
      '</table>';
  };

  /* ---------- 摘要行（兼容旧方法名 renderAbyssBest） ---------- */
  UI.renderAbyssBest = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var el = document.getElementById("abyss-best");
    if (!el) return;
    var best = null;
    if (typeof EndlessRecord !== "undefined" && EndlessRecord && typeof EndlessRecord.best === "function") {
      try { best = EndlessRecord.best(); } catch (e) { best = null; }
    }
    if (!best && typeof Meta !== "undefined" && Meta.data && Meta.data.abyss) best = Meta.data.abyss;
    if (best && (best.bestWave || 0) > 0) {
      var runN = (typeof best.runCount === "number") ? best.runCount : ((best.runs && best.runs.length) || 0);
      el.classList.remove("hidden");
      el.innerHTML = '最深纪录：第 ' + (best.bestWave || 0) + ' 关' +
        ((best.fastestSec || 0) > 0 ? ' · 最快撤离 ' + abyssRecFmtTime(best.fastestSec) : '') +
        ' · 共 ' + runN + ' 次挑战';
    } else {
      el.classList.add("hidden");
      el.innerHTML = "";
    }
  };

  /* ---------- 开屏 / 关屏 ---------- */
  UI.showAbyssRecords = function (from) {
    if (typeof document === "undefined" || !document.getElementById) return;
    UI._abyssRecFrom = (from === "charSel") ? "charSel" : "city";
    // 借 UI.showScreen 收起全部已登记屏幕与 HUD（screen-abyss 不在 SCREEN_IDS，随后单独亮出）
    if (typeof UI.showScreen === "function") UI.showScreen("screen-abyss");
    UI.renderAbyssRecords();
    UI.renderAbyssRecDetail(UI._abyssRecSel);
    UI.renderAbyssBest();
    var scr = document.getElementById("screen-abyss");
    if (scr) scr.classList.remove("hidden");
  };

  UI.hideAbyssRecords = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var scr = document.getElementById("screen-abyss");
    if (scr) scr.classList.add("hidden");
  };

  /* 兼容别名（21.19 旧调用点 / 测试） */
  UI.showAbyssSelect = function () { UI.showAbyssRecords("city"); };
  UI.hideAbyssSelect = function () { UI.hideAbyssRecords(); };

  /* ---------- 按钮绑定（幂等：重复调用只覆盖 onclick，不叠加） ---------- */
  UI.initAbyssSelect = function () {
    if (typeof document === "undefined" || !document.getElementById) return;
    var back = document.getElementById("btn-abyss-back");
    if (back) back.onclick = function () {
      UI.hideAbyssRecords();
      if (UI._abyssRecFrom === "charSel" && typeof Game !== "undefined" && Game &&
          typeof Game.enterAbyssCharSelect === "function") {
        Game.enterAbyssCharSelect();          // 从选角界面进来 → 回选角
        return;
      }
      if (typeof Game !== "undefined" && Game) {
        if (typeof Game.returnToCity === "function") Game.returnToCity();
        else if (typeof Game.enterCity === "function") Game.enterCity();
      }
    };
    var start = document.getElementById("btn-abyss-start");
    if (start) start.onclick = function () {
      UI.hideAbyssRecords();
      if (typeof Game !== "undefined" && Game && typeof Game.enterAbyssCharSelect === "function") {
        Game.enterAbyssCharSelect();          // 去选角出战
        return;
      }
      if (typeof enterEndless === "function") enterEndless();   // 无选角宿主时兜底直进
    };
  };
}

if (typeof globalThis !== "undefined" && typeof UI !== "undefined") globalThis.UI = UI;


/* ============================================================
 * 以下为 2026-10-12 文件归并：原独立模块 js/ui-abyss-pause.js 合并进本文件。
 * 代码逐字保留；拼接顺序与原 index.html 加载顺序一致。
 * ============================================================ */

/* ---------------- 合并自 js/ui-abyss-pause.js ---------------- */
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
