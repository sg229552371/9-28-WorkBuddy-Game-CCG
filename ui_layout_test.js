/* 选关 / 选人「单屏布局」回归测试（node ui_layout_test.js）
 * 覆盖：
 *   静态 ① js/ui.js 存在 12 宫格头像渲染逻辑（遍历 CFG.heroes 生成头像卡）；
 *   静态 ② js/ui.js 存在「默认选中第一个已解锁英雄」的逻辑；
 *   静态 ③ css 存在 12 宫格 / 选关紧凑网格样式；
 *   行为 ④ buildCharList() 后 selectedChars 长度为 1 且是首个已解锁英雄（进入选人界面语义）；
 *   行为 ⑤ 未解锁英雄不可被选中（点击后 selectedChars 不含它）；
 *   行为 ⑥ 选中项变化 → 详情区 #char-detail 文本更新含该英雄名；
 *   行为 ⑦ #char-list 子元素数量 === CFG.heroes.length；
 *   行为 ⑧ 无 DOM 沙箱下 buildCharList() / renderCharDetail() 不抛错；
 *   回归 ⑨ 未选中时 #btn-char-start 仍 disabled；默认选中后应为可用。
 * DOM 桩参考同目录 hero_portrait_test.js / unlock_ui_test.js。
 * 断言输出：PASS/FAIL 每行，末尾「PASS 合计 / 失败数」，失败则 throw。
 * 注意：PASS 文案里不含英文 error/Error（run_tests.sh 的 bad 统计口径）。 */
"use strict";

/* ---------- 断言工具 ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

const fs = require("fs"), vm = require("vm"), path = require("path");
const root = __dirname;

/* ============================================================
 * 静态检查：源码文本（不依赖沙箱）
 * ============================================================ */
const uiSrc = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const cssSrc = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const htmlSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssFlat = cssSrc.split(String.fromCharCode(10)).join(" ");

// ① 12 宫格头像渲染逻辑：buildCharList 内遍历 CFG.heroes + 生成头像 canvas
check("静态：buildCharList 遍历 CFG.heroes", /buildCharList\s*\(\s*\)[\s\S]*?for\s*\(\s*const\s+h\s+of\s+CFG\.heroes/.test(uiSrc));
check("静态：头像渲染含 .char-face 画布", uiSrc.indexOf("char-face") >= 0);
check("静态：头像卡渲染调用立绘绘制函数（drawHeroPortrait）", /buildCharList[\s\S]*?drawHeroPortrait\(/.test(uiSrc));
// ② 默认选中第一个已解锁英雄逻辑
check("静态：存在默认选中首个已解锁英雄的逻辑",
  /默认选中[\s\S]{0,40}已解锁[\s\S]{0,40}英雄/.test(uiSrc) && /find\(h\s*=>\s*Meta\.isHeroUnlocked/.test(uiSrc));
check("静态：默认选中受进入选人界面语义（charSel）约束", uiSrc.indexOf('G.state === "charSel"') >= 0);
// ③ CSS：选人宫格 + 选关紧凑网格
check("静态：CSS 存在选人 6 列宫格（#char-list grid 6 列，20.9 缩小 50%）",
  /#char-list\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*6/.test(cssFlat));
check("静态：CSS 存在选关紧凑网格（#level-list 3 列 grid，20.10 苹果风小而美）",
  /#level-list\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*3\s*,\s*1fr\s*\)/.test(cssFlat));
check("静态：CSS 详情区 #char-detail 固定高度（max-height）", /\.char-detail\s*\{[^}]*max-height/.test(cssFlat));
check("静态：CSS 选关/选人面板锁定单屏（max-height 视口约束）",
  /\.char-panel\s*\{[^}]*max-height\s*:\s*(min\([^)]*844px|calc\(100dvh[^)]*\))/.test(cssFlat));
// 静态：index.html 保留关键 id 且新增 #char-detail
for (const id of ["char-list", "btn-char-start", "btn-char-back", "level-list", "btn-level-back", "meta-line", "char-detail"]) {
  check("静态：index.html 含 id=" + id, htmlSrc.indexOf('id="' + id + '"') >= 0);
}

/* ============================================================
 * 沙箱：DOM 桩（与 hero_portrait_test 同款）
 * ============================================================ */
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
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]);
      el.className = m[3];
      el._parent = this;
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

/* 造沙箱。opts.imageKeys 控制 Assets.images 里放哪些键。 */
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
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
  }
  // ⚗️ 26.x：本套件要断言「未解锁置灰/拦截」链路，须在正式解锁规则下运行（临时关掉测试期全解锁开关）
  vm.runInContext("CFG.testUnlockAllHeroes = false;", ctx);
  vm.runInContext(`
    Assets.images = {};
    const keys = ${JSON.stringify(imageKeys)};
    for (const k of keys) Assets.images[k] = { width: 256, height: 512, __mock: true };
  `, ctx);
  return { ctx, store };
}

/* ============================================================
 * ④⑤⑥⑦⑨ 行为：进入选人界面 → 默认选中首个已解锁英雄 + 交互
 * ============================================================ */
const { ctx, store } = makeSandbox({ imageKeys: ["hero", "hero01", "hero02", "hero03", "hero04", "hero05"] });
const heroCount = vm.runInContext("CFG.heroes.length", ctx);
const firstUnlockedId = vm.runInContext(
  "(function(){var h=CFG.heroes.find(function(x){return Meta.isHeroUnlocked(x.id);});return h?h.id:null;})()", ctx);
const firstLockedId = vm.runInContext(
  "(function(){var h=CFG.heroes.find(function(x){return !Meta.isHeroUnlocked(x.id);});return h?h.id:null;})()", ctx);

// 模拟「进入选人界面」：Game.enterCharSelect 的语义 = state=charSel + 清空组队 + buildCharList
vm.runInContext("G.state = 'charSel'; UI.selectedChars = []; UI.buildCharList();", ctx);

// ⑦ 子元素数量 === CFG.heroes.length
const charBox = store["char-list"];
check("行为：选人头像卡数量 = CFG.heroes.length（" + heroCount + "）", charBox.children.length === heroCount);
check("行为：每张头像卡带 .char-card 类", charBox.children[0] && charBox.children[0].classList.contains("char-card"));
// 头像画布尺寸放大（≥80px 宽，视觉主角）
const firstFace = charBox.children[0].querySelector(".char-face");
check("行为：头像画布存在且为大尺寸（≥80px）", !!firstFace && firstFace.width >= 80);

// ④ 默认选中首个已解锁英雄，长度 1
const selIds = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("行为：默认选中数量 = 1", selIds.length === 1);
check("行为：默认选中 = 首个已解锁英雄（" + firstUnlockedId + "）", selIds[0] === firstUnlockedId);
// 默认选中卡带 selected 类
const selCard = charBox.children.find(c => c.classList.contains("selected"));
check("行为：默认选中卡带 selected 类", !!selCard && selCard.innerHTML.indexOf(firstUnlockedId) >= 0);

// ⑨ 开始按钮：默认选中 1 人 → 可用
const startBtn = store["btn-char-start"];
check("行为：默认选中后开始按钮可用（未 disabled）", startBtn && startBtn.disabled === false);
check("行为：开始按钮文案含人数（1/3）", startBtn && String(startBtn.textContent).indexOf("1/") >= 0);

// ⑤ 未解锁英雄不可被选中（点击后 selectedChars 不含它）
let toastMsg = "";
vm.runInContext("UI.__origToast = UI.toast; UI.toast = function(m){ UI.__lastToast = m; };", ctx);
const lockedCard = charBox.children.find(c => c.classList.contains("locked"));
const firstLockedName = vm.runInContext(
  "(function(){var h=CFG.heroes.find(function(x){return x.id===" + JSON.stringify(firstLockedId) + ";});return h?h.name:'';})()", ctx);
check("行为：存在未解锁头像卡（"+ firstLockedId +"）", !!lockedCard && lockedCard.innerHTML.indexOf(firstLockedId) >= 0);
lockedCard.onclick({});
toastMsg = vm.runInContext("UI.__lastToast || ''", ctx);
check("行为：点击未解锁卡 → toast 提示解锁条件",
  toastMsg.indexOf(firstLockedName) >= 0 || toastMsg.indexOf(firstLockedId) >= 0);
const afterLockClick = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("行为：点击未解锁卡 → selectedChars 不含该英雄", afterLockClick.indexOf(firstLockedId) < 0);

// ⑥ 选中项变化 → 详情区内容更新含该英雄名
// 点击第二个已解锁英雄 → 其进入组队并成为详情焦点
const secondUnlockedId = vm.runInContext(
  "(function(){var a=CFG.heroes.filter(function(x){return Meta.isHeroUnlocked(x.id);});return a[1]?a[1].id:null;})()", ctx);
const secondUnlockedName = vm.runInContext(
  "(function(){var a=CFG.heroes.filter(function(x){return Meta.isHeroUnlocked(x.id);});return a[1]?a[1].name:'';})()", ctx);
const secondCard = charBox.children.find(c => c.innerHTML.indexOf(secondUnlockedId) >= 0);
check("行为：找到第二个已解锁英雄卡（" + secondUnlockedId + "）", !!secondCard);
secondCard.onclick({});
const detailHtml = store["char-detail"].innerHTML;
check("行为：选中变化后详情区更新含该英雄名", detailHtml.indexOf(secondUnlockedName) >= 0);
check("行为：详情区含技能说明（含「技能 LV」）", detailHtml.indexOf("技能 LV") >= 0);
check("行为：详情区含角色说明（定位徽章或属性行）",
  detailHtml.indexOf("role-badge") >= 0 || detailHtml.indexOf("HP ") >= 0);
// 组队语义保持：点击第二个已解锁英雄 → 追加为第 2 人
const teamAfter = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("行为：多选组队语义保持（默认 1 人 + 点第 2 人 = 2 人）", teamAfter.length === 2 && teamAfter.indexOf(firstUnlockedId) >= 0 && teamAfter.indexOf(secondUnlockedId) >= 0);
// 取消选中后回落显示（不空窗）—— 再点第 2 人取消
secondCard.onclick({});
const teamCancel = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("行为：再次点击 → 取消该英雄（回到 1 人）", teamCancel.length === 1 && teamCancel.indexOf(secondUnlockedId) < 0);
check("行为：取消后详情区回落显示队首英雄（不空窗）",
  store["char-detail"].innerHTML.indexOf(firstUnlockedNameOf(ctx)) >= 0);

function firstUnlockedNameOf(c) {
  return vm.runInContext(
    "(function(){var h=CFG.heroes.find(function(x){return Meta.isHeroUnlocked(x.id);});return h?h.name:'';})()", c);
}

// 回归：清空选中且非 charSel（裸调）→ 不默认选中、按钮 disabled（保持旧行为）
vm.runInContext("G.state = 'boot'; UI.selectedChars = []; UI.buildCharList();", ctx);
check("回归：非选人界面裸调 buildCharList → 不默认选中", vm.runInContext("UI.selectedChars.length", ctx) === 0);
const sb2 = store["btn-char-start"];
check("回归：未选中时开始按钮仍 disabled", sb2 && sb2.disabled === true);
check("回归：空选中时详情区显示空态提示", store["char-detail"].innerHTML.indexOf("点击上方头像") >= 0);

/* ============================================================
 * ⑦ 队伍满员仍可查看详情（26.x 体验修复）
 *    旧版满员时点击非队员会直接 return，连详情渲染一起跳过 → 点谁都「点不动」。
 *    修正后：满员点击 = 不入队 + toast 提示 + **详情照常切到该英雄**。
 * ============================================================ */
vm.runInContext("UI.__lastToast = '';", ctx);
// 队伍填满到 maxSize（用已解锁英雄；首发 6 角 ≥ 3）
vm.runInContext(`(function(){
  var a = CFG.heroes.filter(function(x){ return Meta.isHeroUnlocked(x.id); });
  UI.selectedChars = a.slice(0, CFG.team.maxSize);
  UI.buildCharList();
})();`, ctx);
const MAXSZ = vm.runInContext("CFG.team.maxSize", ctx);
const teamIds = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("⑦1 队伍已填满 = CFG.team.maxSize（" + teamIds.length + " 人）", teamIds.length === MAXSZ);
const outsiderId = vm.runInContext(`(function(){
  var a = CFG.heroes.filter(function(x){ return Meta.isHeroUnlocked(x.id); });
  var sel = UI.selectedChars.map(function(s){ return s.id; });
  var out = a.find(function(x){ return sel.indexOf(x.id) < 0; });
  return out ? out.id : null;
})();`, ctx);
const outsiderName = vm.runInContext(`(function(){
  var a = CFG.heroes.filter(function(x){ return Meta.isHeroUnlocked(x.id); });
  var sel = UI.selectedChars.map(function(s){ return s.id; });
  var out = a.find(function(x){ return sel.indexOf(x.id) < 0; });
  return out ? out.name : '';
})();`, ctx);
const outsiderCard = charBox.children.find(c => c.innerHTML.indexOf(outsiderId) >= 0);
check("⑦2 存在一名未入选的已解锁英雄（" + outsiderId + "）", !!outsiderCard);
outsiderCard.onclick({});
check("⑦3 满员点击非队员 → 详情区仍更新为该英雄（修复点：不再无反应）",
  store["char-detail"].innerHTML.indexOf(outsiderName) >= 0);
check("⑦4 满员点击非队员 → toast 明确提示队伍已满（含 3/3 与「移出」指引）", (() => {
  const t = vm.runInContext("UI.__lastToast || ''", ctx);
  return t.indexOf("队伍已满") >= 0 && t.indexOf(String(MAXSZ) + "/" + String(MAXSZ)) >= 0 && t.indexOf("移出") >= 0;
})());
const afterFullClick = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("⑦5 满员点击非队员 → 不入队（人数不变、不含该英雄）",
  afterFullClick.length === MAXSZ && afterFullClick.indexOf(outsiderId) < 0);
// 满员点击「队员」→ 正常移出（选中态可取消，不被上限挡住）
const memberCard = charBox.children.find(c => c.innerHTML.indexOf(teamIds[0]) >= 0);
memberCard.onclick({});
const afterKick = vm.runInContext("UI.selectedChars.map(function(s){return s.id;})", ctx);
check("⑦6 满员点击队员 → 正常移出（人数 -1，上限不阻断取消）",
  afterKick.length === MAXSZ - 1 && afterKick.indexOf(teamIds[0]) < 0);
// 上限读 CFG 单点：文案与拦截都随 CFG.team.maxSize 变化（扩容不改代码）
check("⑦7 上限为单点配置（CFG.team.maxSize 为正整数，扩容只改这一处）",
  Number.isInteger(MAXSZ) && MAXSZ >= 1 && vm.runInContext("CFG.team.maxSize", ctx) === MAXSZ);

/* ============================================================
 * 选关：单屏列表渲染（行为回归：卡数 = 关卡数 + 未解锁锁标）
 * ============================================================ */
const levelCount = vm.runInContext("CFG.levels.length", ctx);
vm.runInContext("Meta.data.unlockedLevels = 1; UI.buildLevelList();", ctx);
const levelBox = store["level-list"];
check("选关：关卡卡数量 = CFG.levels.length（" + levelCount + "）", levelBox.children.length === levelCount);
check("选关：首关未锁（可点）", !levelBox.children[0].classList.contains("locked"));
check("选关：第 2 关起锁定（unlockedLevels=1）", levelBox.children[1].classList.contains("locked"));
check("选关：锁定卡含 🔒 标识", levelBox.children[1].innerHTML.indexOf("🔒") >= 0);
check("选关：已解锁卡含目标击杀/时限信息", levelBox.children[0].innerHTML.indexOf("🎯") >= 0 && levelBox.children[0].innerHTML.indexOf("⏱") >= 0);
check("选关：已解锁卡含 BOSS 名", levelBox.children[0].innerHTML.indexOf("BOSS") >= 0);

/* ============================================================
 * ⑧ 无 DOM 沙箱：buildCharList / renderCharDetail 不抛错
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
    const c = vm.createContext(sandbox);
    for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js"]) {
      vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), c, { filename: f });
    }
    vm.runInContext("G.state = 'charSel'; UI.buildCharList(); UI.renderCharDetail(CFG.heroes[0]); UI.renderCharDetail(null);", c);
  } catch (e) { ok = false; console.log("无 DOM 沙箱异常：" + e.message); }
  check("无 DOM 沙箱下 buildCharList / renderCharDetail 不抛错", ok);
})();

/* ---------- 汇总 ---------- */
console.log("----------------------------------------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("布局测试未通过，失败数 = " + failCount);
