/* 主城 12 角立绘升级回归测试（node hero_portrait_test.js）
 * 覆盖：
 *   ① 图鉴英雄卡渲染为「放大立绘」（canvas 尺寸 > 100）而非 56×56 小脸；
 *   ② 未解锁英雄仍显示 ??? 且带 locked 类（放大不得破坏解锁语义）；
 *   ③ 素材缺失（Assets.images 空）→ 走占位兜底，不抛错；
 *   ④ 点击卡片 → 英雄详情层显示（#hero-detail 去 hidden + 详情立绘画布）；
 *   ⑤ 无 DOM 沙箱下 renderCodex() / renderCodexHeroPortraits() 不抛错；
 *   ⑥ 静态检查：css 含新样式类。
 * DOM 桩参考同目录 unlock_ui_test.js / boot_guard_test.js。
 * 断言输出：PASS/FAIL 每行，末尾「PASS 合计 / 失败数」，失败则 throw。
 * 注意：PASS 文案里不含英文 error/Error（run_tests.sh 的 bad 统计口径）。 */
"use strict";

/* ---------- 断言工具（PASS/FAIL 计数） ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---------- DOM 桩（含 closest / 按 class 解析 innerHTML） ---------- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) {
    this._cls = v; this.classList = new ClassList();
    String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v;
    this.children.length = 0;
    this._q = null; this._qa = null;
    // 解析带 class 的元素为子节点（扁平收集，_findAll 再递归即可命中嵌套）
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]);
      el.className = m[3];
      el._parent = this;
      // 同步解析 width/height 属性（canvas 尺寸断言用）
      const wh = /width\s*=\s*"(\d+)"/.exec(m[2]), hh = /height\s*=\s*"(\d+)"/.exec(m[2]);
      if (wh) el.width = parseInt(wh[1], 10);
      if (hh) el.height = parseInt(hh[1], 10);
      this.children.push(el);
    }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  _findAll(cls, acc) {
    acc = acc || [];
    for (const c of this.children) {
      if (c.classList && c.classList.contains(cls)) acc.push(c);
      if (c._findAll) c._findAll(cls, acc);
    }
    return acc;
  }
  querySelectorAll(sel) {
    this._qa = this._qa || {};
    if (!this._qa[sel]) this._qa[sel] = this._findAll(sel.replace(/^\./, ""));
    return this._qa[sel];
  }
  closest(sel) {
    const sels = String(sel).split(",").map(s => s.trim()).filter(Boolean);
    let el = this;
    while (el) {
      for (const s of sels) {
        if (s.charAt(0) === ".") { if (el.classList && el.classList.contains(s.slice(1))) return el; }
        else if (s.charAt(0) === "#") { if (el._id === s.slice(1)) return el; }
      }
      el = el._parent;
    }
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}

function makeDocument(store) {
  const doc = {
    getElementById(id) { const el = store[id] || (store[id] = new FakeEl(id)); el._id = id; return el; },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  };
  Object.defineProperty(doc, "body", { get() { return this.getElementById("body"); }, configurable: true });
  return doc;
}

/* ---------- 沙箱工厂：注入 config/core/game/ui 桩 + 脚本 ---------- */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = __dirname;

/* 造一个完整沙箱。opts.imageKeys 控制 Assets.images 里放哪些键（模拟素材就绪/缺失）。 */
function makeSandbox(opts) {
  opts = opts || {};
  const store = {};
  const imageKeys = opts.imageKeys || [];
  const doc = makeDocument(store);
  const sandbox = {
    console, Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Map, Set,
    Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: doc,
    window: { addEventListener() { }, innerWidth: 390, innerHeight: 844 },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    requestAnimationFrame: (cb) => cb,
  };
  sandbox.globalThis = sandbox;
  sandbox.Image = class { constructor() { this.width = 256; this.height = 512; } set src(v) { if (this.onload) this.onload(); } };
  const ctx = vm.createContext(sandbox);
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  }
  // 素材桩：从真实 Assets.images 结构里只放指定键（宽度 256，高度 512 的假图）
  vm.runInContext(`
    Assets.images = {};
    const keys = ${JSON.stringify(imageKeys)};
    for (const k of keys) Assets.images[k] = { width: 256, height: 512, __mock: true };
  `, ctx);
  return { ctx, store };
}

/* ============================================================
 * ① 有素材：图鉴英雄卡应渲染为「放大立绘」
 * ============================================================ */
const { ctx: ctxA, store: storeA } = makeSandbox({ imageKeys: ["hero", "hero01", "hero02"] });
vm.runInContext(`
  UI._skillSummary = UI._skillSummary;   // 保持原有技能摘要函数
  UI.renderCodex();
`, ctxA);
const heroBoxA = storeA["codex-heroes"];
check("图鉴英雄卡数量 = 英雄总数", heroBoxA.children.length === vm.runInContext("CFG.heroes.length", ctxA));
const firstCard = heroBoxA.children[0];
check("英雄卡为立绘卡（带 portrait-card 类）", firstCard.classList.contains("portrait-card"));
const portraitCanvas = firstCard.querySelector(".codex-portrait");
check("卡片含立绘画布 .codex-portrait", !!portraitCanvas && portraitCanvas.tag === "canvas");
check("立绘画布高度 > 100（放大非 56 小脸）", portraitCanvas.height > 100);
check("立绘画布宽度 > 100（放大非 56 小脸）", portraitCanvas.width > 100);
// 旧小脸类不应再出现在英雄图鉴卡里
const faceCount = heroBoxA.children.filter(c => c.innerHTML.indexOf("codex-face") >= 0).length;
check("英雄图鉴卡不再使用 56×56 小脸（codex-face）", faceCount === 0);
// 已解锁英雄显示真名（默认皮肤 hero 对应 H001）
check("已解锁英雄卡显示英雄名（非 ???）",
  firstCard.innerHTML.indexOf(vm.runInContext("CFG.heroes[0].name", ctxA)) >= 0);

/* ============================================================
 * ② 未解锁英雄：仍显示 ??? 且带 locked 类
 * ============================================================ */
// 默认仅 defaultSkin 解锁；第二个英雄（H002）未解锁
const secondCard = heroBoxA.children[1];
check("未解锁英雄卡带 locked 类", secondCard.classList.contains("locked"));
check("未解锁英雄卡显示 ???", secondCard.innerHTML.indexOf("???") >= 0);
check("未解锁英雄卡含 🔒 锁形标识", secondCard.innerHTML.indexOf("🔒") >= 0);
check("未解锁英雄卡不泄露英雄名",
  secondCard.innerHTML.indexOf(vm.runInContext("CFG.heroes[1].name", ctxA)) < 0);

/* ============================================================
 * ③ 素材缺失：走占位兜底，不抛错
 * ============================================================ */
const { ctx: ctxB, store: storeB } = makeSandbox({ imageKeys: [] });   // 空素材
let renderOk = true;
try { vm.runInContext("UI.renderCodex();", ctxB); } catch (e) { renderOk = false; console.log("素材缺失渲染异常：" + e.message); }
check("素材全缺失时 renderCodex 不抛错", renderOk);
const heroBoxB = storeB["codex-heroes"];
check("素材缺失仍渲染出全部英雄卡", heroBoxB.children.length === vm.runInContext("CFG.heroes.length", ctxB));
const cardB = heroBoxB.children[0];
const cvB = cardB.querySelector(".codex-portrait");
check("素材缺失仍有立绘画布（占位）", !!cvB && cvB.tag === "canvas");
check("素材缺失卡片名不空白（含英雄名）",
  cardB.innerHTML.indexOf(vm.runInContext("CFG.heroes[0].name", ctxB)) >= 0);

/* ============================================================
 * ④ 点击卡片 → 详情层显示
 * ============================================================ */
let clickOk = true, overlay = null, detailCanvas = null;
try {
  firstCard.onclick({});   // 点击已解锁英雄卡（沙箱 A）
  overlay = storeA["hero-detail"];
  detailCanvas = overlay.querySelector(".hero-detail-panel").querySelector(".detail-portrait");
} catch (e) { clickOk = false; console.log("点击详情异常：" + e.message); }
check("点击英雄卡 → 详情层创建且去掉 hidden", clickOk && !!overlay && !overlay.classList.contains("hidden"));
check("详情层为大图立绘画布（.detail-portrait）", !!detailCanvas && detailCanvas.tag === "canvas");
check("详情立绘高度 > 卡片立绘（更放大）", detailCanvas && detailCanvas.height > firstCard.querySelector(".codex-portrait").height);
check("详情层含关闭按钮 .hero-detail-close",
  !!overlay && !!overlay.querySelector(".hero-detail-panel").querySelector(".hero-detail-close"));
// 详情包含完整属性
const detailPanelHtml = overlay ? overlay.querySelector(".hero-detail-panel").innerHTML : "";
check("详情层含属性说明（HP / 攻击）",
  detailPanelHtml.indexOf("HP ") >= 0 && detailPanelHtml.indexOf("攻击 ") >= 0);
// 关闭
vm.runInContext("UI.closeHeroDetail();", ctxA);
check("closeHeroDetail → 详情层重新 hidden", overlay.classList.contains("hidden"));

/* ============================================================
 * ⑤ 无 DOM 沙箱：renderCodex / renderCodexHeroPortraits 不抛错
 * ============================================================ */
(function noDomCheck() {
  const sandbox = {
    console, Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Map, Set,
    Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    window: { addEventListener() { } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  };
  sandbox.globalThis = sandbox;
  let ok = true;
  try {
    const ctx = vm.createContext(sandbox);
    for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js"]) {
      vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
    }
    // 无 document：两个入口都必须静默返回，不抛
    vm.runInContext("UI.renderCodexHeroPortraits(); UI.openHeroDetail('H001'); UI.closeHeroDetail();", ctx);
  } catch (e) { ok = false; console.log("无 DOM 沙箱异常：" + e.message); }
  check("无 DOM 沙箱下立绘入口不抛错", ok);
})();

/* ============================================================
 * ⑤b 真实浏览器式：getElementById 首次返回 null → 自建 #hero-detail 并挂 body
 * ============================================================ */
(function realDomLikeCheck() {
  const sandbox = {
    console, Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Map, Set,
    Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    window: { addEventListener() { } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  };
  sandbox.globalThis = sandbox;
  const cache = {};
  const bodyEl = new FakeEl("body"); bodyEl._id = "body";
  sandbox.document = {
    getElementById(id) { return cache[id] || null; },   // ← 首次返回 null（模拟 index.html 无此 id）
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() { }, querySelectorAll: () => [],
  };
  Object.defineProperty(sandbox.document, "body", { get() { return bodyEl; }, configurable: true });
  let ok = true, overlay = null;
  try {
    const ctx = vm.createContext(sandbox);
    for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js"]) {
      vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
    }
    overlay = vm.runInContext("UI.openHeroDetail('H001');", ctx);
  } catch (e) { ok = false; console.log("真实 DOM 式详情异常：" + e.message); }
  check("getElementById 返回 null 时自建详情层并打开", ok && !!overlay && !overlay.classList.contains("hidden"));
  check("自建详情层已挂到 body", bodyEl.children.indexOf(overlay) >= 0);
})();

/* ============================================================
 * ⑥ 静态检查：css 含新样式类
 * ============================================================ */
const cssSrc = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const cssFlat = cssSrc.split(String.fromCharCode(10)).join(" ");
const cssNeed = [
  [".portrait-card", "图鉴立绘卡"],
  [".codex-portrait", "立绘画布"],
  [".hero-detail-overlay", "详情层遮罩"],
  [".hero-detail-panel", "详情层面板"],
  [".hero-detail-close", "详情关闭按钮"],
];
let cssOk = true;
for (const [tok, desc] of cssNeed) {
  if (cssFlat.indexOf(tok) < 0) { console.log("FAIL css 缺少规则 " + tok + "（" + desc + "）"); cssOk = false; }
}
check("css 含立绘/详情层新样式（" + cssNeed.length + " 项）", cssOk);

/* ---------- 汇总 ---------- */
console.log("----------------------------------------");
console.log("PASS 合计 = " + (passCount + failCount) + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("HERO PORTRAIT TEST FAILED");
console.log("HERO PORTRAIT TEST OK");
