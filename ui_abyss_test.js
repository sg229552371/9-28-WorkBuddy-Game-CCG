/* 深渊入口 / 选层界面测试（W4 · js/ui-abyss.js）—— node ui_abyss_test.js
 * 范式照抄 ui_flow_test.js：DOM 桩 + Node vm 沙箱加载脚本链。
 * 覆盖：index.html 冻结 id、tierList 渲染条数、锁定判定、选中切换、词缀预览、
 *       最高记录三级降级、开始/返回按钮（桩记录）、init 幂等、无 DOM 不抛错。
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
  const need = ["screen-abyss", "abyss-tier-list", "abyss-tier-info", "abyss-best", "btn-abyss-back", "btn-abyss-start"];
  __check("index.html 冻结 id 清单齐全（screen-abyss 等 6 个）", need.every(id => ids.has(id)));
}

/* ---- 1) 完整脚本链 + 被测模块（主线流程范式） ---- */
const CHAIN = ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js",
  "js/modes.js", "js/render.js", "js/stress.js", "js/endless.js", "js/hud_endless.js",
  "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js",
  "js/ui-abyss.js", "js/main.js"];
const ctx = vm.createContext(global);
for (const f of CHAIN) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  const hidden = (id) => get(id).classList.contains("hidden");

  /* --- A. 契约函数齐全 + 初值 --- */
  __check("契约函数齐全（abyssTier / show / hide / render / init）",
    typeof UI.abyssTier === "number" && typeof UI.showAbyssSelect === "function" &&
    typeof UI.hideAbyssSelect === "function" && typeof UI.renderAbyssTiers === "function" &&
    typeof UI.initAbyssSelect === "function");
  __check("UI.abyssTier 初值 = CFG.endless.tier.defaultSelected", UI.abyssTier === CFG.endless.tier.defaultSelected);

  /* --- B. 开屏渲染：条数 / class / 屏幕切换 --- */
  UI.showAbyssSelect();
  __check("开屏后 #screen-abyss 显示且其余屏幕隐藏", !hidden("screen-abyss") && hidden("screen-level") && hidden("hud"));
  const cards = get("abyss-tier-list").children;
  const expectN = CFG.endless.tier.max - CFG.endless.tier.min + 1;
  __check("层级卡片条数 = max-min+1（" + expectN + " 张）", cards.length === expectN);
  __check("全部卡片含 .abyss-tier-card 基础类", cards.every(c => c.classList.contains("abyss-tier-card")));
  const lockedCnt = cards.filter(c => c.classList.contains("locked")).length;
  const startMax = CFG.endless.tier.unlock.startMax;
  __check("锁定判定：默认 startMax=" + startMax + " → 锁定 " + (expectN - startMax) + " 张", lockedCnt === expectN - startMax);
  __check("未锁层无 .locked、锁层无 onclick",
    !cards[0].classList.contains("locked") && cards[startMax].classList.contains("locked") &&
    typeof cards[0].onclick === "function" && !cards[startMax].onclick);
  __check("默认选中首层（第 1 张 .selected）", cards[0].classList.contains("selected"));

  /* --- C. 选中切换 --- */
  cards[2].onclick({});                       // 点第 3 层（未锁）
  __check("点击未锁层 → UI.abyssTier 切换为 3 且卡片 .selected",
    UI.abyssTier === 3 && get("abyss-tier-list").children[2].classList.contains("selected"));
  __check("旧选中卡 .selected 已移除", !get("abyss-tier-list").children[0].classList.contains("selected"));
  cards[9].onclick && cards[9].onclick({});   // 点第 10 层（锁定，应无 onclick / 不切换）
  __check("点击锁定层不切换（仍为 3）", UI.abyssTier === 3);

  /* --- D. 信息区：难度系数 + 词缀预览 --- */
  const info = get("abyss-tier-info").innerHTML;
  __check("信息区含难度系数与预览标注", info.indexOf("难度系数") >= 0 && info.indexOf("预览") >= 0);
  __check("层 3 词缀条数 = 1（countAnchors）且预览含首词缀名", info.indexOf("1 条") >= 0 && info.indexOf("迅捷") >= 0);
  UI.abyssTier = 1; UI.renderAbyssTierInfo();
  __check("层 1 无词缀（显示「本层无词缀」）", get("abyss-tier-info").innerHTML.indexOf("本层无词缀") >= 0);
  UI.abyssTier = 10; UI.renderAbyssTierInfo();
  __check("层 10 词缀条数 = 2", get("abyss-tier-info").innerHTML.indexOf("2 条") >= 0);

  /* --- E. 最高记录三级降级 --- */
  UI.showAbyssSelect();
  __check("无记录 → #abyss-best 隐藏", hidden("abyss-best"));
  Meta.data.abyss = { bestTier: 5, bestWave: 30, fastestSec: 120 };
  UI.renderAbyssBest();
  __check("Meta.data.abyss 兜底 → 显示第 5 层记录", !hidden("abyss-best") && get("abyss-best").innerHTML.indexOf("第 5 层") >= 0);
  EndlessRecord = { best: function () { return { bestTier: 9, bestWave: 50, fastestSec: 99 }; } };
  UI.renderAbyssBest();
  __check("EndlessRecord.best() 优先于 Meta 兜底（显示第 9 层）", get("abyss-best").innerHTML.indexOf("第 9 层") >= 0);
  EndlessRecord = undefined; delete Meta.data.abyss;
  UI.renderAbyssBest();
  __check("记录清空 → #abyss-best 重新隐藏", hidden("abyss-best"));

  /* --- F. 解锁进度联动（Meta.data.abyss.bestTier=5 → 最高可选 6） --- */
  Meta.data.abyss = { bestTier: 5 };
  UI.renderAbyssTiers();
  const cs2 = get("abyss-tier-list").children;
  __check("bestTier=5 → 第 6 层可选、第 7 层锁定",
    !cs2[5].classList.contains("locked") && cs2[6].classList.contains("locked") && cs2.filter(c => c.classList.contains("locked")).length === expectN - 6);
  delete Meta.data.abyss;

  /* --- G. 开始 / 返回按钮（桩记录调用） --- */
  UI.initAbyssSelect();
  const setCalls = [], charCalls = [], cityCalls = [];
  Endless.setTier = function (n) { setCalls.push(n); return n; };            // W1 未落地 → 桩
  Game.enterAbyssCharSelect = function () { charCalls.push(1); return true; }; // 桩记录
  Game.returnToCity = function () { cityCalls.push(1); };
  UI.abyssTier = 3;
  get("btn-abyss-start").onclick({});
  __check("「挑战此层」→ setTier(3) 被调用", setCalls.length === 1 && setCalls[0] === 3);
  __check("「挑战此层」→ enterAbyssCharSelect 被调用", charCalls.length === 1);
  get("btn-abyss-back").onclick({});
  __check("「返回主城」→ Game.returnToCity 被调用", cityCalls.length === 1);
  __check("返回后 #screen-abyss 隐藏", hidden("screen-abyss"));

  /* --- H. init 幂等：重复绑定不叠加 --- */
  UI.initAbyssSelect(); UI.initAbyssSelect();
  get("btn-abyss-start").onclick({});
  __check("initAbyssSelect 重复调用不叠加（setTier 仍只多 1 次）", setCalls.length === 2 && charCalls.length === 2);
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
      UI.showAbyssSelect(); UI.hideAbyssSelect(); UI.renderAbyssTiers();
      UI.renderAbyssTierInfo(); UI.renderAbyssBest(); UI.initAbyssSelect();
      if (typeof UI.abyssTier !== "number") throw new Error("abyssTier 类型异常");
    `, c0, { filename: "no-dom" });
  } catch (e) { okA = false; console.log("无 DOM 口径 A 异常：" + e.message); }
  __check("无 DOM（document 未定义）→ 全部函数安全早退且 UI.abyssTier 保持 number", okA);

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
      UI.showAbyssSelect(); UI.hideAbyssSelect(); UI.renderAbyssTiers();
      UI.renderAbyssTierInfo(); UI.renderAbyssBest(); UI.initAbyssSelect();
    `, c1, { filename: "null-dom" });
  } catch (e) { okB = false; console.log("无 DOM 口径 B 异常：" + e.message); }
  __check("无 DOM（元素全缺失）→ 全部函数不抛异常", okB);
}

/* ---- 汇总（中文，无 FAIL/Error 字样） ---- */
console.log("----------------------------------------");
console.log("深渊选层界面测试完成：通过 " + __T.pass + " 项，未通过 " + __T.fail + " 项");
if (__T.fail > 0) process.exit(1);
