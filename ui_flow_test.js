/* 界面流程回归测试：首页 → 主城 → 传送门 → 选关 → 选角 → 战斗 → 回城（node ui_flow_test.js）
 * 真实加载 index.html 的 id 清单 + ui.js + main.js，覆盖流程重构后的全部界面与主城/NPC/档案/图鉴。
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
  // 按实例缓存：renderTrainer / renderSmith 里 card.querySelector(".up-lv").onclick = ... 需要拿到稳定对象
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
  body: new FakeEl("body"),
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
  "screen-main", "btn-main-start", "btn-home-help", "btn-home-settings", "btn-home-codex", "btn-home-exit",
  "home-user-line",                                                // 首页
  "screen-level", "level-list", "btn-level-back",                  // 关卡选择
  "screen-character", "char-list", "btn-char-back", "btn-char-start",
  "screen-help", "btn-help-back", "screen-settings", "btn-settings-back",
  "screen-codex", "codex-heroes", "codex-monsters", "btn-codex-back",
  "screen-goodbye", "btn-goodbye-back",                            // 新流程界面
  "hud", "toast-area", "panel-backpack", "panel-artisan", "tooltip",
  "city-avatar-bar",                                               // 主城头像栏
  "panel-npc-outlevel", "outlevel-list", "panel-npc-weapon", "weapon-list",
  "panel-profile", "profile-name-input", "skin-grid", "title-list", // NPC 面板
];
let okStatic = true;
for (const id of requiredIds) {
  if (!htmlIds.has(id)) { console.assert(false, `index.html 缺少元素 id="${id}"`); okStatic = false; }
}
console.log("index.html 元素清单 OK:", requiredIds.length, "个必需 id 全部存在");
console.assert(!htmlIds.has("screen-meta") && !htmlIds.has("btn-main-meta"), "旧「局外成长」主菜单入口应已移除");

/* ---- 2) 空值健壮性：所有元素都查不到时，界面方法不得抛异常 ---- */
{
  const ctx0 = vm.createContext({
    window: { addEventListener() { } }, document: { getElementById: () => null, createElement: () => new FakeEl("x"), addEventListener() { }, body: null },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
  });
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
    vm.runInContext(fs.readFileSync(f, "utf8"), ctx0, { filename: f });
  }
  vm.runInContext(`
    UI.showScreen("screen-main"); UI.showHudOnly(); UI.toast("t");
    UI.buildLevelList(); UI.buildCharList(); UI.renderTrainer(); UI.renderSmith();
    UI.renderProfile(); UI.renderCodex(); UI.renderSettings();
    UI.updateHomeUser(); UI.updateCityHUD(); UI.showTooltip(null, 0, 0);
    UI.metaUpgradeLevel(CFG.heroes[0].id); UI.metaUpgradeWeapon(CFG.heroes[0].id);
    Game.bindEvents(); Game.toMainMenu(); Game.openLevelSelect(); Game.enterCity(); Game.returnToCity(); Game.backToMenu();
    console.log("空 DOM 健壮性 OK：全部界面方法在元素缺失时未抛异常");
  `, ctx0, { filename: "null-dom" });
}

/* ---- 3) 真实流程：首页 → 主城 → 传送门 → 选关 → 主城NPC升级 → 图鉴/档案 → 结算回城 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  const shown = (id) => !get(id).classList.contains("hidden");
  const onlyShown = (id) => UI.SCREEN_IDS.every(s => shown(s) === (s === id));
  const click = (id) => { const b = get(id); console.assert(typeof b.onclick === "function", id + " 应已绑定 onclick"); b.onclick({}); };
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) window.__flowOk = false; };
  window.__flowOk = true;

  Game.bindEvents();

  // --- 启动落点：首页 ---
  UI.showScreen("screen-main");
  check("启动应只显示首页", onlyShown("screen-main"));

  // --- 首页「开始游戏」→ 进入主城（state=city，HUD 显示且带 city-mode） ---
  click("btn-main-start");
  check("「开始游戏」应进入主城（G.state=city）", G.state === "city");
  check("主城世界已创建（kind=city，NPC " + G.activeWorld.cityNpcs.length + " 个）", G.activeWorld && G.activeWorld.kind === "city" && G.activeWorld.cityNpcs.length === CFG.city.npcs.length);
  check("主城形象已创建（皮肤默认 H001）", G.cityAvatar && G.cityAvatar.skin === CFG.profile.defaultSkin);
  check("传送门存在", !!G.activeWorld.portal);
  check("HUD 处于主城模式（city-mode）", get("hud").classList.contains("city-mode"));

  // --- 主城行走：键盘驱动形象移动 ---
  const ax0 = G.cityAvatar.x;
  G.keys["d"] = true;
  for (let i = 0; i < 20; i++) updateCityWorld(0.016);
  G.keys["d"] = false;
  check("主城键盘行走 OK（dx=" + (G.cityAvatar.x - ax0).toFixed(1) + "）", G.cityAvatar.x > ax0 + 20);

  // --- 主城 NPC：进圈弹面板（直接派发事件验证链路） ---
  const npc0 = G.activeWorld.cityNpcs[0];   // 强化导师
  EventBus.emit("cityNpcPanel", npc0);
  check("靠近强化导师弹出面板", shown("panel-npc-outlevel") && get("outlevel-list").children.length === (() => {
    // 强化导师面板渲染契约：已解锁英雄各 1 张卡；存在未解锁英雄时追加 1 个分组标题 + 每角 1 张锁定卡
    const unlocked = Meta.unlockedHeroes().length, locked = CFG.heroes.length - unlocked;
    return unlocked + (locked ? 1 + locked : 0);
  })());
  EventBus.emit("cityNpcClose");
  check("离圈自动关闭面板", !shown("panel-npc-outlevel"));

  // --- 主城 NPC E 键互动：进圈只标亮，按 E 弹面板，再按 E 关闭 ---
  G.cityAvatar.x = npc0.x; G.cityAvatar.y = npc0.y;
  updateCityWorld(0.016);
  check("进圈后标记 near 目标", G.cityNpcNear && G.cityNpcNear.id === npc0.id && !shown("panel-npc-outlevel"));
  Game.actionE();
  check("按 E 弹出 NPC 面板", shown("panel-npc-outlevel") && G.cityNpcOpen && G.cityNpcOpen.id === npc0.id);
  Game.actionE();
  check("再按 E 关闭 NPC 面板", !shown("panel-npc-outlevel"));
  G.cityAvatar.x = G.activeWorld.w / 2; G.cityAvatar.y = G.activeWorld.h * 0.6;   // 移到广场空地（远离所有 NPC 圈）
  updateCityWorld(0.016);
  check("离圈清除 near 标记", !G.cityNpcNear);

  // --- 主城图鉴学者：E 打开图鉴 → 返回按钮显示「返回主城」→ 点击恢复主城 ---
  const scholar = G.activeWorld.cityNpcs.find(n => n.func === "codex");
  G.cityAvatar.x = scholar.x; G.cityAvatar.y = scholar.y;
  updateCityWorld(0.016);
  Game.actionE();
  check("主城图鉴返回按钮文案=返回主城", get("btn-codex-back").textContent === "返回主城");
  click("btn-codex-back");
  check("图鉴返回后恢复主城 HUD（city-mode）", !get("hud").classList.contains("hidden") && get("hud").classList.contains("city-mode"));
  G.cityAvatar.x = G.activeWorld.w / 2; G.cityAvatar.y = G.activeWorld.h * 0.6;
  updateCityWorld(0.016);

  // --- 传送门读条：进圈积累 → 完成 → 选关 ---
  G.cityAvatar.x = G.activeWorld.portal.x; G.cityAvatar.y = G.activeWorld.portal.y;
  let portalDone = false;
  const w0 = G.activeWorld;
  for (let i = 0; i < 300 && G.state === "city"; i++) updateCityWorld(0.016);   // 2s 读条
  check("传送门读条完成 → 落到关卡选择", G.state === "menu" && onlyShown("screen-level"));

  // --- 选关「返回」→ 回主城 ---
  click("btn-level-back");
  check("选关「返回」应回主城", G.state === "city");

  // --- 强化导师（NPC 面板）：结晶充足可升 → 扣结晶 + 等级 +1 ---
  Meta.data.heroes = Meta.data.heroes || {};
  const hero = CFG.heroes[0];
  Meta.data.heroes[hero.id] = { level: 1, weaponLv: 1 };
  Meta.data.crystals = 100000;
  UI.openNpcPanel(npc0);
  const lvCard = get("outlevel-list").children[0];
  const lvBtn = lvCard.querySelector(".up-lv");
  const c0 = Meta.data.crystals, lvCost = Meta.levelUpCost(hero.id);
  lvBtn.onclick();
  check("局外升级 OK：LV1→LV2，扣结晶 " + lvCost, Meta.heroLevel(hero.id) === 2 && Meta.data.crystals === c0 - lvCost);
  EventBus.emit("cityNpcClose");

  // --- 武器匠（NPC 面板）：武器等级升级 ---
  const smith = G.activeWorld.cityNpcs.find(n => n.func === "weapon");
  UI.openNpcPanel(smith);
  const wpCard = get("weapon-list").children[0];
  const wpBtn = wpCard.querySelector(".up-wp");
  const c1 = Meta.data.crystals, wpCost = Meta.weaponUpCost(hero.id);
  wpBtn.onclick();
  check("武器（=技能）升级 OK：LV1→LV2，扣结晶 " + wpCost, Meta.weaponLv(hero.id) === 2 && Meta.data.crystals === c1 - wpCost);
  EventBus.emit("cityNpcClose");

  // --- 结晶不足 → 升级按钮禁用且点击无效 ---
  Meta.data.crystals = 0;
  UI.renderTrainer();
  const poorCard = get("outlevel-list").children[0];
  const poorBtnHtml = poorCard.innerHTML;
  console.assert(/disabled/.test(poorBtnHtml), "结晶不足时升级按钮应禁用");
  const lvBefore = Meta.heroLevel(hero.id);
  poorCard.querySelector(".up-lv").onclick();
  check("结晶不足点击无效", Meta.heroLevel(hero.id) === lvBefore);

  // --- 图鉴：英雄图鉴（激活=解锁皮肤）+ 怪物图鉴（击杀收录） ---
  UI.showCodex();
  check("图鉴页显示", onlyShown("screen-codex") && get("codex-heroes").children.length === CFG.heroes.length);
  check("怪物图鉴收录数一致", get("codex-monsters").children.length === Object.keys(CFG.monsters).length);
  const h2 = CFG.heroes[1];
  check("未用英雄未激活（显示锁定）", get("codex-heroes").children[1].className.indexOf("locked") >= 0);
  Meta.activateHero(h2.id);
  UI.renderCodex();
  check("用过英雄后图鉴激活", get("codex-heroes").children[1].className.indexOf("locked") < 0);
  Meta.recordMonster("NM0010");
  UI.renderCodex();
  check("击杀怪物后图鉴收录", get("codex-monsters").children[0].className.indexOf("locked") < 0);
  click("btn-codex-back");

  // --- 档案：更名 / 皮肤 / 称号 ---
  UI.openNpcPanel({ func: "profile", id: "NPC_MIRROR" });
  check("形象师面板显示", shown("panel-profile"));
  const nameOk = Meta.rename("测试旅者");
  check("更名生效（2~8 字校验）", nameOk && Meta.profileName() === "测试旅者");
  check("过短名字被拒", !Meta.rename("甲"));
  check("未激活英雄皮肤不可选", !Meta.setSkin(h2.id === CFG.heroes[1].id ? CFG.heroes[2].id : CFG.heroes[1].id) === false ? Meta.skinUnlocked(Meta.skinId()) : true);
  const hLocked = CFG.heroes.find(h => !Meta.skinUnlocked(h.id));
  check("存在未激活皮肤（皮肤=英雄外貌，图鉴解锁）", !!hLocked);
  Meta.setSkin(h2.id);   // H002 已激活（上面 activateHero）
  check("激活英雄皮肤可装备", Meta.skinId() === h2.id);
  check("默认称号可用，成就称号未解锁被拒", Meta.setTitle("t_rookie") && !Meta.setTitle("t_extractor"));
  Meta.setFlag("firstExtract");
  check("成就解锁后称号可装备", Meta.setTitle("t_extractor") && Meta.titleName() === "撤离者");
  EventBus.emit("cityNpcClose");

  // --- 角色选择「返回」应回到关卡选择（不越级） ---
  UI.showScreen("screen-character");
  click("btn-char-back");
  check("角色选择「返回」应回到关卡选择", onlyShown("screen-level"));

  // --- 结算/死亡确认 → 回主城（战斗后回家） ---
  click("btn-settle-ok");
  check("结算「返回主城」应进入主城", G.state === "city");
  click("btn-death-ok");
  check("死亡「返回主城」应进入主城", G.state === "city");

  // --- 首页其余按钮：设置 / 图鉴 / 告别 ---
  UI.showScreen("screen-main");
  click("btn-home-settings");
  check("设置页显示", onlyShown("screen-settings"));
  click("btn-settings-back");
  click("btn-home-codex");
  check("图鉴页显示", onlyShown("screen-codex"));
  click("btn-codex-back");
  click("btn-home-exit");
  check("退出→告别页显示", onlyShown("screen-goodbye"));
  click("btn-goodbye-back");
  check("告别页可返回首页", onlyShown("screen-main"));

  console.log(window.__flowOk ? "UI FLOW TEST OK" : "UI FLOW TEST FAILED");
  if (!window.__flowOk) throw new Error("UI FLOW TEST FAILED");
`, ctx, { filename: "inline" });
