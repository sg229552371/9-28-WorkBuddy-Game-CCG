/* 无头测试：21.6 赛季玩法（占位）—— 赛季大厅 + SeasonState 数据结构 + 结算钩子
 * 覆盖：
 *   升级曲线（0→1000 升 LV2 / 每级 1000+n*200 / L10 封顶不再涨）
 *   周任务（3 个占位任务结构 / 进度累加 / resetWeekly 归零）
 *   界面节点（index.html 含 #screen-season / #season-lv / #season-tasks / #btn-season-back）
 *   UI 薄封装（ui.js 含 UI.showSeason / UI.grantSeasonExp）+ 结算钩子单行 addExp(500)
 * 运行：node season_test.js（判绿 = exit 0 且无 FAIL）
 * 桩写法参照 levelup_test.js：FakeEl + global.document/window 桩 + vm 加载四脚本
 */
"use strict";

/* ---- DOM / Canvas 桩（与 levelup_test 同款） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { ctxCalls.push([p, a]); };
  },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

/* ---- vm 加载游戏脚本（与 index.html 同序，不加载 main.js：赛季区块不依赖它） ---- */
const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---- 断言器：PASS 文案只用中文，杜绝英文 error/FAIL 字样混入（门禁 grep 口径） ---- */
let passCount = 0, failCount = 0;
function ok(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ====== 一、SeasonState 升级曲线（var 声明，挂 global，node 侧直测） ====== */
const SS = global.SeasonState;
ok("赛季状态对象存在且含 seasonLv/seasonExp 初始值", !!SS && SS.seasonLv === 1 && SS.seasonExp === 0);

/* 曲线①：0 → 1000 经验恰好升 LV2（LV1→2 需 1000+0*200） */
SS.addExp(1000);
ok("曲线：加 1000 经验升到 LV2（seasonLv=2 且经验清零）", SS.seasonLv === 2 && SS.seasonExp === 0);

/* 曲线②：LV2→3 需 1000+1*200=1200；1199 不升、再补 1 升 */
SS.addExp(1199);
ok("曲线：LV2 加 1199 经验不升级（差 1 点）", SS.seasonLv === 2 && SS.seasonExp === 1199);
SS.addExp(1);
ok("曲线：补 1 点经验后升到 LV3（逐级结算）", SS.seasonLv === 3 && SS.seasonExp === 0);

/* 曲线③：封顶 —— 一次大额经验跨级直升 L10，之后经验不再累计 */
SS.addExp(99999);
ok("封顶：大额经验跨级直升 L10（seasonLv=10）", SS.seasonLv === 10);
const expAtCap = SS.seasonExp;
const retAtCap = SS.addExp(5000);
ok("封顶：L10 后再加经验不涨（返回 false 且经验保持不变）", retAtCap === false && SS.seasonExp === expAtCap);

/* 非法输入防护 */
SS.addExp(-50); SS.addExp("abc");
ok("防护：负数与非数字输入被拒绝（不改变封顶状态）", SS.seasonLv === 10);

/* ====== 二、周任务 ====== */
SS.resetWeekly();                                  // 先归零，从头测
SS.seasonLv = 1; SS.seasonExp = 0;                 // 重置等级，避免影响后续（测试专用直改内存态）
const wl = SS.weeklies();
ok("周任务：weeklies 返回 3 个占位任务", Array.isArray(wl) && wl.length === 3);
ok("周任务：每项含 id/name/goal/progress 且 goal>0", wl.every(t => t.id && t.name && typeof t.goal === "number" && t.goal > 0 && typeof t.progress === "number"));
ok("周任务：id 依次为 击杀/撤离/升级 三个占位任务", wl[0].id === "weekly-kill" && wl[1].id === "weekly-extract" && wl[2].id === "weekly-levelup");
SS.addWeeklyProgress("weekly-kill", 30);
SS.addWeeklyProgress("weekly-kill", 12);
ok("周任务：addWeeklyProgress 两次累加（30+12=42）", SS.weeklies()[0].progress === 42);
ok("周任务：其它任务进度不受影响", SS.weeklies()[1].progress === 0 && SS.weeklies()[2].progress === 0);
SS.resetWeekly();
ok("周任务：resetWeekly 后三个任务进度全部归零", SS.weeklies().every(t => t.progress === 0));

/* ====== 三、index.html 界面节点 ====== */
const html = fs.readFileSync("index.html", "utf8");
ok("界面：index.html 含 #screen-season 赛季大厅面板节点", /id="screen-season"/.test(html) && /class="screen hidden"/.test(html.split('id="screen-season"')[1].slice(0, 40)));
ok("界面：index.html 含 #season-lv 等级节点与「赛季大厅」标题", /id="season-lv"/.test(html) && html.includes("赛季大厅"));
ok("界面：index.html 含 #season-tasks 周任务容器与 #btn-season-back 返回按钮", /id="season-tasks"/.test(html) && /id="btn-season-back"/.test(html));

/* ====== 四、ui.js 薄封装 + 结算钩子（源码静态断言） ====== */
const uiSrc = fs.readFileSync("js/ui.js", "utf8");
const gameSrc = fs.readFileSync("js/game.js", "utf8");
ok("UI：ui.js 定义 UI.showSeason 渲染赛季大厅（经验条+周任务+返回主城）", /UI\.showSeason\s*=\s*function/.test(uiSrc) && uiSrc.includes('showScreen("screen-season")') && uiSrc.includes('showScreen("screen-main")'));
ok("UI：UI.grantSeasonExp 为单行薄封装（调用 SeasonState.addExp 并在面板开着时重渲染）", /UI\.grantSeasonExp\s*=\s*function/.test(uiSrc) && /SeasonState\.addExp\(n\)/.test(uiSrc));
/* 结算钩子：showSettlement 函数体内新增恰好 1 行 SeasonState.addExp(500)，且带 typeof 防护 */
const settleFrom = uiSrc.indexOf("showSettlement(crystals = 0)");
const settleTo = uiSrc.indexOf("showDeath(penalty", settleFrom);      // 下一个函数起点 = showSettlement 作用域边界
const settleBody = (settleFrom >= 0 && settleTo > settleFrom) ? uiSrc.slice(settleFrom, settleTo) : "";
const hookLines = uiSrc.split("\n").filter(l => l.includes("SeasonState.addExp(500)"));
ok("钩子：结算函数 showSettlement 内含单行 SeasonState.addExp(500)（撤离成功发赛季经验）", hookLines.length === 1 && hookLines[0].includes("typeof SeasonState !== \"undefined\""));
ok("钩子：该单行确实落在 showSettlement 函数体内（showDeath 之前），其余函数体零侵入", settleBody.includes("SeasonState.addExp(500)"));

/* ====== 五、driver：vm 内走通 UI.showSeason / UI.grantSeasonExp（FakeEl 环境不抛异常） ====== */
const driver = `
(function () {
  const r = { showOk: false, grantRet: null, lvAfter: 0 };
  try {
    SeasonState.resetWeekly();
    SeasonState.seasonLv = 1; SeasonState.seasonExp = 0;
    UI.showSeason();                                 // 全 FakeEl 环境，仅验证不抛异常
    r.showOk = true;
    r.grantRet = UI.grantSeasonExp(1000);            // 薄封装走通：0 经验 +1000 → LV2
    r.lvAfter = SeasonState.seasonLv;
  } catch (e) { r.errText = String(e && e.message ? e.message : e); }
  return r;
})()
`;
const dr = vm.runInContext(driver, ctx, { filename: "season_driver" });
ok("driver：UI.showSeason 在无头桩环境下渲染不抛异常", dr.showOk === true && !dr.errText);
ok("driver：UI.grantSeasonExp(1000) 走通 SeasonState.addExp（0 经验升 LV2）", dr.grantRet === true && dr.lvAfter === 2);

/* ====== 汇总 ====== */
console.log("赛季占位测试完成：PASS " + passCount + " 条，失败（错误）" + failCount + " 条");
if (failCount > 0) process.exit(1);
