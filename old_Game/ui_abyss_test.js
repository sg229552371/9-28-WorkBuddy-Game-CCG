/* 深渊战绩榜界面测试（21.20 · js/ui-abyss.js）—— node ui_abyss_test.js
 * 范式照抄 ui_flow_test.js：DOM 桩 + Node vm 沙箱加载脚本链。
 * 覆盖：index.html 冻结 id、战绩列表渲染/选中切换、逐角色明细表、摘要行、
 *       开始/返回按钮（桩记录，charSel 来源回选角）、init 幂等、无 DOM 不抛错。
 * 汇总行中文，全文不含 FAIL / Error 字样（门禁口径）。 */
"use strict";

/* ---- DOM 桩（classList 真实行为；innerHTML="" 清空子节点；按实例缓存 querySelector） ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
  }
  // className 与 classList 双向同步（真实 DOM 语义：card.className = "a locked" 后 classList.contains("locked") 为真）
  get className() { return [...this.classList.set].join(" "); }
  set className(v) {
    this.classList.set.clear();
    String(v || "").split(/\s+/).filter(Boolean).forEach(c => this.classList.set.add(c));
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector(sel) { this._q = this._q || {}; return this._q[sel] || (this._q[sel] = new FakeEl(sel)); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const ctxProxy = new Proxy({}, {
  get(t, p) { if (p in t) return t[p]; return (...a) => undefined; },
  set(t, p, v) { t[p] = v; return true; },
});
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  body: new FakeEl("body"),
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 结果记录（门禁口径：汇总行中文；不输出 FAIL/Error 字样） ---- */
global.__T = { pass: 0, fail: 0 };
global.__check = function (name, cond) {
  if (cond) { global.__T.pass++; console.log("PASS " + name); }
  else { global.__T.fail++; console.log("【未通过】" + name); }
};

/* ---- 0) index.html 冻结 id 清单核对（DOM 桩抓不到缺失元素，必须查原文） ---- */
{
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const need = ["screen-abyss", "abyss-tier-list", "abyss-tier-info", "abyss-best", "btn-abyss-back", "btn-abyss-start", "btn-abyss-records"];
  __check("index.html 冻结 id 清单齐全（screen-abyss 等 7 个）", need.every(id => ids.has(id)));
}

/* ---- 1) 完整脚本链 + 被测模块（主线流程范式） ---- */
const CHAIN = ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js",
  "js/modes.js", "js/render.js", "js/stress.js", "js/endless.js", "js/hud_endless.js",
  "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js",
  "js/endless-record.js", "js/ui-abyss.js", "js/main.js"];
const ctx = vm.createContext(global);
for (const f of CHAIN) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
vm.runInContext(`
const get = (id) => document.getElementById(id);
const hidden = (id) => get(id).classList.contains("hidden");

/* --- A. 契约函数齐全 + 兼容别名 --- */
__check("契约函数齐全（show/hide/render/明细/init）",
  typeof UI.showAbyssRecords === "function" && typeof UI.hideAbyssRecords === "function" &&
  typeof UI.renderAbyssRecords === "function" && typeof UI.renderAbyssRecDetail === "function" &&
  typeof UI.renderAbyssBest === "function" && typeof UI.initAbyssSelect === "function");
__check("兼容别名保留（showAbyssSelect / hideAbyssSelect）",
  typeof UI.showAbyssSelect === "function" && typeof UI.hideAbyssSelect === "function");

/* --- B. 空战绩开屏 --- */
UI.showAbyssRecords("city");
__check("开屏后 #screen-abyss 显示且其余屏幕隐藏", !hidden("screen-abyss") && hidden("screen-level") && hidden("hud"));
__check("空战绩 → 列表显示引导文案", get("abyss-tier-list").innerHTML.indexOf("还没有战绩") >= 0);
__check("无记录 → #abyss-best 隐藏", hidden("abyss-best"));

/* --- C. 有战绩：onSettle 两次 → 渲染 2 行 + 选中首行 + 明细表 --- */
G.inEndless = true;
EndlessRecord.onSettle({ wave: 30, kills: 120, elapsed: 200, extracted: true, reason: "extract" });
EndlessRecord.onSettle({ wave: 45, kills: 260, elapsed: 350, extracted: false, reason: null });
G.inEndless = false;
UI.showAbyssRecords("city");
const rows = get("abyss-tier-list").children;
__check("战绩行数 = 2", rows.length === 2);
__check("全部行含 .abyss-rec-row 基础类", rows.every(r => r.classList.contains("abyss-rec-row")));
__check("排序：波次降序（45 在前）", rows[0].innerHTML.indexOf("45") >= 0 && rows[0].classList.contains("selected"));
__check("明细默认显示首条（含「第 45 关」）", get("abyss-tier-info").innerHTML.indexOf("第 45 关") >= 0);
__check("明细含逐角色表头（角色/伤害/占比/承伤）",
  get("abyss-tier-info").innerHTML.indexOf("承伤") >= 0 && get("abyss-tier-info").innerHTML.indexOf("占比") >= 0);
__check("无队伍快照 → 明细显示占位行", get("abyss-tier-info").innerHTML.indexOf("本局无队伍明细") >= 0);
rows[1].onclick({});
__check("点击第 2 行 → 选中切换 + 明细切到第 30 关",
  get("abyss-tier-list").children[1].classList.contains("selected") &&
  get("abyss-tier-info").innerHTML.indexOf("第 30 关") >= 0 &&
  get("abyss-tier-info").innerHTML.indexOf("撤离成功") >= 0);

/* --- D. 摘要行（runs 落盘后） --- */
UI.renderAbyssBest();
__check("摘要显示最深纪录 + 挑战次数", !hidden("abyss-best") &&
  get("abyss-best").innerHTML.indexOf("第 45 关") >= 0 && get("abyss-best").innerHTML.indexOf("2 次挑战") >= 0);

/* --- E. 队伍快照：模拟带 run 的结算 → 明细含角色伤害/承伤/合计 --- */
G.inEndless = true;
G.heroDef = { id: "H001", name: "影刃" };
G.run = { heroDef: G.heroDef, companions: [
  { id: "H002", name: "霜语", dmgDealt: 700, dmgTaken: 111 },
  { id: "H003", name: "晨曦", dmgDealt: 300, dmgTaken: 222 },
] };
G.player = { dmgDealt: 1000, dmgTaken: 55 };
EndlessRecord.onSettle({ wave: 50, kills: 300, elapsed: 400, extracted: true, reason: "extract" });
G.inEndless = false;
UI._abyssRecSel = 0;   // 明细锚定最新一条（wave 50，带队伍快照）
UI.showAbyssRecords("city");
const det = get("abyss-tier-info").innerHTML;
__check("明细含队长（★）与两名队友名", det.indexOf("★ 影刃") >= 0 && det.indexOf("霜语") >= 0 && det.indexOf("晨曦") >= 0);
__check("伤害数值与占比正确（影刃 1000 / 50%）", det.indexOf("1000") >= 0 && det.indexOf("50%") >= 0);
__check("承伤与合计正确（55 / 111 / 222 · 合计 2000/388）",
  det.indexOf("55") >= 0 && det.indexOf("111") >= 0 && det.indexOf("222") >= 0 && det.indexOf("2000") >= 0 && det.indexOf("388") >= 0);
G.run = null; G.player = null; G.heroDef = null;

/* --- F. 按钮：去选角出战 / 返回（charSel 来源回选角，city 来源回主城） --- */
UI.initAbyssSelect();
const charCalls = [], cityCalls = [];
Game.enterAbyssCharSelect = function () { charCalls.push(1); return true; };
Game.returnToCity = function () { cityCalls.push(1); };
get("btn-abyss-start").onclick({});
__check("「去选角出战」→ enterAbyssCharSelect 被调用且屏隐藏", charCalls.length === 1 && hidden("screen-abyss"));
UI._abyssRecFrom = "charSel";
get("btn-abyss-back").onclick({});
__check("charSel 来源返回 → 回选角（不回主城）", charCalls.length === 2 && cityCalls.length === 0);
UI.showAbyssRecords("city");
UI._abyssRecFrom = "city";
get("btn-abyss-back").onclick({});
__check("city 来源返回 → 回主城", cityCalls.length === 1 && hidden("screen-abyss"));

/* --- G. init 幂等：重复绑定不叠加 --- */
UI.initAbyssSelect(); UI.initAbyssSelect();
get("btn-abyss-start").onclick({});
__check("initAbyssSelect 重复调用不叠加（charSel 仍只多 1 次）", charCalls.length === 3);
`, ctx, { filename: "abyss-ui" });

/* ---- 2) 无 DOM 沙箱：关键逻辑不抛错（document 缺失 + 元素缺失两种口径） ---- */
{
  // 2a) typeof document === "undefined"
  const c0 = vm.createContext({ console, localStorage: global.localStorage });
  for (const f of ["js/config.js", "js/ui.js", "js/ui-abyss.js"]) {
    vm.runInContext(fs.readFileSync(f, "utf8"), c0, { filename: f });
  }
  let okA = true;
  try {
    vm.runInContext(`
      UI.showAbyssSelect(); UI.hideAbyssSelect(); UI.showAbyssRecords("city");
      UI.hideAbyssRecords(); UI.renderAbyssRecords(); UI.renderAbyssRecDetail(0);
      UI.renderAbyssBest(); UI.initAbyssSelect();
    `, c0, { filename: "no-dom" });
  } catch (e) { okA = false; console.log("无 DOM 口径 A 异常：" + e.message); }
  __check("无 DOM（document 未定义）→ 全部函数安全早退", okA);

  // 2b) document 存在但全部 getElementById → null
  const c1 = vm.createContext({
    window: { addEventListener() { } },
    document: { getElementById: () => null, createElement: () => new FakeEl("x"), addEventListener() { }, body: null },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
  });
  for (const f of CHAIN) vm.runInContext(fs.readFileSync(f, "utf8"), c1, { filename: f });
  let okB = true;
  try {
    vm.runInContext(`
      UI.showAbyssSelect(); UI.hideAbyssSelect(); UI.showAbyssRecords("charSel");
      UI.hideAbyssRecords(); UI.renderAbyssRecords(); UI.renderAbyssRecDetail(0);
      UI.renderAbyssBest(); UI.initAbyssSelect();
    `, c1, { filename: "null-dom" });
  } catch (e) { okB = false; console.log("无 DOM 口径 B 异常：" + e.message); }
  __check("无 DOM（元素全缺失）→ 全部函数不抛异常", okB);
}

/* ---- 汇总（中文，无 FAIL/Error 字样） ---- */
console.log("----------------------------------------");
console.log("深渊战绩榜界面测试完成：通过 " + __T.pass + " 项，未通过 " + __T.fail + " 项");
if (__T.fail > 0) process.exit(1);
