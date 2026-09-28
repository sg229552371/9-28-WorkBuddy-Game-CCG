/* 界面流程回归测试：主菜单 / 关卡选择 / 角色选择 / 局外成长（node ui_flow_test.js）
 * 真实加载 index.html 的 id 清单 + ui.js + main.js，覆盖新增的主菜单与局外成长界面。
 * 注意：DOM 桩的 getElementById 会自动造元素，所以"元素是否存在"必须另查 index.html 原文。 */
"use strict";

/* ---- DOM 桩（classList 真实行为；querySelector 按实例缓存，保证事件绑定可被验证） ---- */
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
    this.width = 300; this.height = 300;
  }
  // 真实 DOM 里 innerHTML="" 会清空子节点；桩必须同样行为，否则重复渲染会读到旧卡片
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  // 按实例缓存：renderMeta 里 card.querySelector(".up-lv").onclick = ... 需要拿到稳定对象
  querySelector(sel) { this._q = this._q || {}; return this._q[sel] || (this._q[sel] = new FakeEl(sel)); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
const winHandlers = {};
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
const path = require("path");

/* ---- 1) index.html id 清单核对（DOM 桩抓不到缺失元素，必须查原文） ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const requiredIds = [
  "screen-main", "btn-main-start", "btn-main-meta",           // 主菜单
  "screen-level", "level-list", "btn-level-back",             // 关卡选择
  "screen-character", "char-list", "btn-char-back", "btn-char-start",
  "screen-meta", "meta-crystals", "meta-char-list", "btn-meta-back",   // 局外成长
  "hud", "toast-area", "panel-backpack", "panel-artisan",
];
for (const id of requiredIds) {
  console.assert(htmlIds.has(id), `index.html 缺少元素 id="${id}"`);
}
console.log("index.html 元素清单 OK:", requiredIds.length, "个必需 id 全部存在");

/* ---- 2) 空值健壮性：所有元素都查不到时，界面方法不得抛异常 ---- */
{
  const ctx0 = vm.createContext({
    window: { addEventListener() { } }, document: { getElementById: () => null, createElement: () => new FakeEl("x"), addEventListener() { } },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
  });
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
    vm.runInContext(fs.readFileSync(f, "utf8"), ctx0, { filename: f });
  }
  vm.runInContext(`
    UI.showScreen("screen-main"); UI.showHudOnly(); UI.toast("t");
    UI.buildLevelList(); UI.buildCharList(); UI.renderMeta();
    UI.metaUpgradeLevel(CFG.heroes[0].id); UI.metaUpgradeWeapon(CFG.heroes[0].id);
    Game.bindEvents(); Game.toMainMenu(); Game.openLevelSelect(); Game.openMeta(); Game.backToMenu();
    console.log("空 DOM 健壮性 OK：全部界面方法在元素缺失时未抛异常");
  `, ctx0, { filename: "null-dom" });
}

/* ---- 3) 真实流程：主菜单 → 关卡 → 主菜单 → 局外成长 → 升级 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  const shown = (id) => !get(id).classList.contains("hidden");
  const onlyShown = (id) => UI.SCREEN_IDS.every(s => shown(s) === (s === id));
  const click = (id) => { const b = get(id); console.assert(typeof b.onclick === "function", id + " 应已绑定 onclick"); b.onclick({}); };

  UI.selectedLevel = CFG.levels[0];
  Game.bindEvents();

  // --- 启动落点：主菜单 ---
  UI.showScreen("screen-main");
  console.assert(onlyShown("screen-main"), "启动应只显示主菜单");
  console.log("主菜单显示 OK");

  // --- 主菜单 →「开始游戏」→ 关卡选择 ---
  click("btn-main-start");
  console.assert(onlyShown("screen-level"), "「开始游戏」应落到关卡选择");
  console.log("主菜单 → 关卡选择 OK（关卡条目 " + get("level-list").children.length + " 个）");

  // --- 关卡选择 →「返回主菜单」 ---
  click("btn-level-back");
  console.assert(onlyShown("screen-main"), "「返回主菜单」应回到主菜单");
  console.log("关卡选择 → 主菜单 OK");

  // --- 主菜单 →「局外成长」→ 角色列表渲染 ---
  click("btn-main-meta");
  console.assert(onlyShown("screen-meta"), "「局外成长」应落到局外成长界面");
  const list = get("meta-char-list");
  console.assert(list.children.length === CFG.heroes.length,
    "局外成长应列出全部角色, got " + list.children.length + " / " + CFG.heroes.length);
  console.assert(get("meta-crystals").innerHTML.indexOf(String(Meta.data.crystals)) >= 0, "应显示当前结晶数");
  console.log("局外成长界面 OK：角色行 " + list.children.length + " 个，结晶 " + Meta.data.crystals);

  // 按钮的 disabled / 文案是写在 innerHTML 字符串里的，桩不解析 HTML → 直接断言渲染结果
  const btnOf = (cardHtml, cls) => {
    const m = [...cardHtml.matchAll(/<button class="([^"]*)"([^>]*)>([^<]*)<\\/button>/g)]
      .find(x => x[1].indexOf(cls) >= 0);
    return m ? { disabled: /\\bdisabled\\b/.test(m[2]), text: m[3] } : null;
  };

  // --- 升级按钮：结晶充足可点 → 扣结晶 + 等级 +1 ---
  const hero = CFG.heroes[0];
  Meta.data.heroes = Meta.data.heroes || {};
  Meta.data.heroes[hero.id] = { level: 1, weaponLv: 1 };
  Meta.data.crystals = 100000;
  UI.renderMeta();
  const card = list.children[0];
  const lvBtn = card.querySelector(".up-lv"), wpBtn = card.querySelector(".up-wp");
  const bLv0 = btnOf(card.innerHTML, "up-lv"), bWp0 = btnOf(card.innerHTML, "up-wp");
  console.assert(bLv0 && bWp0 && !bLv0.disabled && !bWp0.disabled, "结晶充足时两个升级按钮都不应禁用");
  console.assert(bLv0.text.indexOf("升级") === 0 && bWp0.text.indexOf("升级") === 0, "按钮应显示「升级 ◆cost」");

  const c0 = Meta.data.crystals, lvCost = Meta.levelUpCost(hero.id);
  lvBtn.onclick();
  console.assert(Meta.heroLevel(hero.id) === 2, "局外等级应升到 2, got " + Meta.heroLevel(hero.id));
  console.assert(Meta.data.crystals === c0 - lvCost, "局外升级应扣 " + lvCost + " 结晶");
  console.log("局外升级 OK：LV1→LV2，扣结晶 " + lvCost);

  const c1 = Meta.data.crystals, wpCost = Meta.weaponUpCost(hero.id);
  card.querySelector(".up-wp").onclick();
  console.assert(Meta.weaponLv(hero.id) === 2, "武器/技能等级应升到 2, got " + Meta.weaponLv(hero.id));
  console.assert(Meta.data.crystals === c1 - wpCost, "武器升级应扣 " + wpCost + " 结晶");
  console.log("武器（=技能）升级 OK：LV1→LV2，扣结晶 " + wpCost);

  // --- 结晶不足 → 按钮置灰且点击无效 ---
  Meta.data.crystals = 0;
  UI.renderMeta();
  const card2 = get("meta-char-list").children[0];
  console.assert(card2.children.length === 0, "重渲染应清空旧卡片（innerHTML='' 语义）");
  const bLv2 = btnOf(card2.innerHTML, "up-lv");
  console.assert(bLv2 && bLv2.disabled, "结晶不足时升级按钮应禁用");
  const lvBefore = Meta.heroLevel(hero.id);
  const cBefore = Meta.data.crystals;
  card2.querySelector(".up-lv").onclick();
  console.assert(Meta.heroLevel(hero.id) === lvBefore && Meta.data.crystals === cBefore, "结晶不足时点击不应生效");
  console.log("结晶不足置灰 OK");

  // --- 满级 → 按钮文案「已满级」且禁用 ---
  Meta.data.crystals = 100000;
  Meta.data.heroes[hero.id] = { level: CFG.outLevel.maxLevel, weaponLv: CFG.weaponLevel.maxLv };
  UI.renderMeta();
  const card3 = get("meta-char-list").children[0];
  const bLv3 = btnOf(card3.innerHTML, "up-lv"), bWp3 = btnOf(card3.innerHTML, "up-wp");
  console.assert(bLv3 && bLv3.disabled && bLv3.text === "已满级", "满级时局外按钮应为「已满级」且禁用, got " + JSON.stringify(bLv3));
  console.assert(bWp3 && bWp3.disabled && bWp3.text === "已满级", "满级时武器按钮应为「已满级」且禁用, got " + JSON.stringify(bWp3));
  console.log("满级按钮 OK");

  // --- 局外成长 →「返回主菜单」 ---
  click("btn-meta-back");
  console.assert(onlyShown("screen-main"), "局外成长「返回主菜单」应回到主菜单");
  console.log("局外成长 → 主菜单 OK");

  // --- 角色选择 →「返回」应回到关卡选择（落点在关卡选择，不越级回主菜单） ---
  UI.showScreen("screen-character");
  click("btn-char-back");
  console.assert(onlyShown("screen-level"), "角色选择「返回」应回到关卡选择");
  console.log("角色选择 → 关卡选择 OK");

  // --- 结算/死亡确认按钮仍落回关卡选择（语义未被主菜单改动破坏） ---
  click("btn-settle-ok");
  console.assert(onlyShown("screen-level"), "结算「确认返回选关」应回到关卡选择");
  click("btn-death-ok");
  console.assert(onlyShown("screen-level"), "死亡「返回选关」应回到关卡选择");
  console.log("结算/死亡返回落点 OK（仍是关卡选择）");

  console.log("UI FLOW TEST OK");
`, ctx, { filename: "inline" });
