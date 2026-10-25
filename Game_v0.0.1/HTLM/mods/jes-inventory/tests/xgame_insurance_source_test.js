/* ============================================================
 * xgame_insurance_source_test.js —— X-GAMe 专项：C3 局内保险来源（保险雕像 ALTAR_007）
 * 真源：G_docs/economy_insurance_design_v1.md §2.3 / §4.1
 * 目标：核验「保险雕像」这条局内确定性来源落库后：
 *   ① CFG.altars.ALTAR_007 存在、weight===0（不自动进池）、effects[0].type==="giveInsurance"；
 *   ② World.execEffect({type:"giveInsurance",count:2}) 后背包/待入包保险契约数 +2（真实 startRun 造 run）；
 *   ③ CFG.insuranceSource 默认值齐全（altar/artisan/chestDrop 开，eliteDrop/assured 关）；
 *   ④ 默认（未接线）下 weight:0 → 祭坛池投放不含 ALTAR_007（abyssAltarPool + 全部关卡时间轴）。
 * 做法：真解析 index.html 的 <script src="js/..."> 顺序，用 node vm 全量装载（DOM 桩，沿用既有 xgame_*_test.js 写法）。
 * 约束：不伪造桩数据、不放宽断言、不空数组恒真。
 * 运行：node xgame_insurance_source_test.js
 * 注意：PASS 文案禁用英文 error/FAIL；失败行用中文「未通过」；末尾输出 PASS 合计 / 失败数，退出码反映结果。
 * ============================================================ */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");

/* ---------- ① 真解析 index.html —— 提取 <script src="js/..."> 有序序列 ---------- */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scriptTagRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const allSrc = [];
let mm;
while ((mm = scriptTagRe.exec(html)) !== null) allSrc.push(mm[1]);
const files = allSrc
  .map((s) => String(s).split("?")[0].split("#")[0].replace(/^\.\//, ""))
  .filter((s) => s.indexOf("js/") === 0)
  .filter((f, i, a) => a.indexOf(f) === i);

/* ---------- ② DOM / Canvas 桩 ---------- */
const ctxCalls = [];
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 200000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 200000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  removeEventListener() { }
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
  addEventListener() { }, removeEventListener() { },
  querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { }, removeEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
try { global.location = { search: "", href: "", reload() { } }; } catch (e) { /* 只读则忽略 */ }
const _store = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
};
global.UI = new Proxy({}, { get: () => () => { } });

/* ---------- ③ 按 index.html 脚本顺序加载全部 js（真实文件读取） ---------- */
const ctx = vm.createContext(global);
let loadFail = null;
try {
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
} catch (e) {
  loadFail = e;
}
global.__loadFailMsg = loadFail ? String((loadFail && loadFail.message) || loadFail) : "";
global.__loadedFileCount = loadFail ? -1 : files.length;
global.__indexedFileCount = files.length;

/* ---------- ④ 断言驱动（const CFG/Game 在 vm 作用域内可见） ---------- */
const driver = `
global.__pass = 0; global.__fail = 0;
const check = (name, cond) => {
  if (cond) { global.__pass++; console.log("PASS " + name); }
  else { global.__fail++; console.log("未通过 " + name); }
};

if (__loadedFileCount < 0) {
  check("加载全部 js（按 index.html 顺序，共 " + __indexedFileCount + " 个）", false);
} else {
  check("加载全部 js（按 index.html 顺序，共 " + __indexedFileCount + " 个）", __loadedFileCount === __indexedFileCount);

  /* ---------- 环境 ---------- */
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: { width: 60, height: 60 }, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } };

  /* ============ 一、CFG.altars.ALTAR_007 结构 ============ */
  const A7 = CFG.altars.ALTAR_007;
  check("一1 CFG.altars.ALTAR_007 存在", !!A7);
  check("一2 ALTAR_007.weight === 0（不自动进池）", A7 && A7.weight === 0);
  check("一3 ALTAR_007.effects[0].type === \\"giveInsurance\\"", !!(A7 && A7.effects && A7.effects[0] && A7.effects[0].type === "giveInsurance"));
  check("一4 ALTAR_007.effects[0].count === 1", !!(A7 && A7.effects && A7.effects[0] && A7.effects[0].count === 1));
  check("一5 ALTAR_007.name === \\"保险雕像\\"", !!(A7 && A7.name === "保险雕像"));

  /* ============ 二、execEffect 真实入包（startRun 造 G.run） ============ */
  const insTotal = () => {
    let n = 0;
    const scan = (arr) => { if (!arr) return; for (const it of arr) if (it && it.kind === "insurance") n += (it.count || 0); };
    scan(G.run && G.run.backpack && G.run.backpack.items);
    scan(G.run && G.run.pendingItems);
    return n;
  };
  Game.startRun([CFG.heroes[0]]);
  if (typeof Game.skipIntroFreeze === "function") Game.skipIntroFreeze();
  if (typeof Game.skipLevelUpChoice === "function") Game.skipLevelUpChoice();
  check("二0 前置：真实 startRun 造出 G.run 与主世界", !!(G.run && G.mainWorld));
  {
    const before = insTotal();
    G.mainWorld.execEffect({ type: "giveInsurance", count: 2 });
    const after = insTotal();
    check("二1 execEffect({type:\\"giveInsurance\\",count:2}) → 保险契约数 +2（前=" + before + " 后=" + after + "）", (after - before) === 2);
    /* 契约 item 价值 = CFG.insurance.value × count = 120（走既有 makeInsurance） */
    let maxVal = 0;
    for (const it of G.run.backpack.items) if (it.kind === "insurance" && it.value > maxVal) maxVal = it.value;
    check("二2 保险契约 value === CFG.insurance.value × 2（=" + maxVal + "）", maxVal === CFG.insurance.value * 2);
    check("二3 insuranceCount(G.run) 与背包口径一致（=" + insuranceCount(G.run) + "）", insuranceCount(G.run) >= 2);
  }
  {
    const before = insTotal();
    G.mainWorld.execEffect({ type: "giveInsurance" });   // 缺省 count → 1
    const after = insTotal();
    check("二4 缺省 count → 保险契约数 +1（前=" + before + " 后=" + after + "）", (after - before) === 1);
  }

  /* ============ 三、CFG.insuranceSource 默认值 ============ */
  const src = CFG.insuranceSource;
  check("三1 CFG.insuranceSource 存在", !!src);
  check("三2 altar 默认 {enabled:true, id:ALTAR_007, count:1}",
    !!(src && src.altar && src.altar.enabled === true && src.altar.id === "ALTAR_007" && src.altar.count === 1));
  check("三3 artisan.enabled === true 且 chestDrop.enabled === true",
    !!(src && src.artisan && src.artisan.enabled === true && src.chestDrop && src.chestDrop.enabled === true));
  check("三4 eliteDrop 默认关闭（enabled:false, chance:0）",
    !!(src && src.eliteDrop && src.eliteDrop.enabled === false && src.eliteDrop.chance === 0));
  check("三5 assured 默认关闭（enabled:false, count:0）",
    !!(src && src.assured && src.assured.enabled === false && src.assured.count === 0));
  check("三6 CFG.insurance.protectItems === 1（P1 按件）", CFG.insurance.protectItems === 1);

  /* ============ 四、默认（未接线）下 weight:0 → 祭坛池投放不含 ALTAR_007 ============ */
  const abyssPool = (typeof abyssAltarPool === "function") ? abyssAltarPool("endless") : null;
  check("四1 abyssAltarPool(\\"endless\\") 不含 ALTAR_007", !!abyssPool && !("ALTAR_007" in abyssPool));
  /* 全量关卡时间轴（主线各关 + 无尽）：声明的 id / pool 均不含 ALTAR_007 */
  let timelineHit = false, timelineCount = 0;
  const scanTimeline = (tl) => {
    if (!Array.isArray(tl)) return;
    for (const e of tl) {
      timelineCount++;
      if (!e) continue;
      if (e.id === "ALTAR_007") timelineHit = true;
      if (Array.isArray(e.pool) && e.pool.indexOf("ALTAR_007") >= 0) timelineHit = true;
    }
  };
  if (Array.isArray(CFG.levels)) for (const lv of CFG.levels) scanTimeline(lv && lv.altarTimeline);
  if (CFG.endless && CFG.endless.altarTimeline) scanTimeline(CFG.endless.altarTimeline.pool ? [{ pool: CFG.endless.altarTimeline.pool }] : null);
  check("四2 已扫描到关卡/无尽祭坛时间轴条目（" + timelineCount + " 条）", timelineCount > 0);
  check("四3 全部祭坛时间轴（id/pool）均不含 ALTAR_007", !timelineHit);
}
`;

let driverErr = null;
try {
  vm.runInContext(driver, ctx, { filename: "xgame_insurance_source_test-driver" });
} catch (e) {
  driverErr = e;
  console.log("未通过 驱动执行期异常：" + String((e && e.message) || e));
}

const pass = global.__pass | 0;
const fail = (global.__fail | 0) + (driverErr ? 1 : 0);

console.log("PASS 合计 = " + pass + "   失败数 = " + fail);
process.exit(fail === 0 ? 0 : 1);
