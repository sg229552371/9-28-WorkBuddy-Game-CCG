/* ============================================================================
 * 21.21 深渊局内 HUD 补齐 + 升级属性包卡面属性名 回归测试
 * （node endless_hud_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   一、源码级：26.x 统一战斗 UI —— 深渊独立 #abyss-hud 已删除，主线块保留（深渊复用）
 *   二、源码级：CSS 已清空 #abyss-hud 全部规则；abyss-mode 不再隐藏主线块
 *   三、源码级：深渊模式只隐藏自动战斗按钮（布局不动）+ ui.js 深渊推进分支
 *   四、行为级（规则 1）：升级「属性包」卡面 desc 显示「属性名 +N」+ 小字说明 + lu-num 高亮保留
 *   五、行为级（规则 1）：CFG.statNames 优先级 + 缺失回落本地映射（容错）
 *   六、行为级（规则 2）：深渊复用统一 HUD —— abyss-mode 开关 + updateHUD 数据照常写入
 *   七、行为级（规则 2）：逐英雄武器技能栏（主角 + 队友 = N 栏，含技能名 + 冷却态）
 *   八、空值保护：G / G.run / companions / DOM 缺失时全部不抛错
 *
 * 桩：复用 endless_flow_test.js 的 FakeEl / ClassList + ui_v2_test 的 DOM 语义。
 * ⚠️ PASS 行文案不得出现英文 error / Error / FAIL（run_tests.sh 以 grep -ci 统计失败）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- DOM / Canvas 桩 ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) {
    if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); }
    else if (f) this.set.add(c); else this.set.delete(c);
  }
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
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector(sel) { this._q = this._q || {}; return this._q[sel] || (this._q[sel] = new FakeEl(sel)); }
  querySelectorAll(sel) {
    // 仅服务 .ps-slot 计数：按 _html 里 class 出现次数粗算（技能栏每条固定 4 槽由 createElement 建，见下）
    return this._qsAll || (this._qsAll = {});
  }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const ctxProxy = new Proxy({}, {
  get(t, p) { if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(400) }); if (p in t) return t[p]; return () => undefined; },
  set(t, p, v) { t[p] = v; return true; },
});
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  body: new FakeEl("body"), documentElement: new FakeEl("html"),
};
global.window = {
  addEventListener() { }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
global.performance = { now: () => Date.now() };

/* ============================================================
 * 一 / 二 / 三：静态源码级断言（不依赖运行时）
 * ============================================================ */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
const uiSrc = fs.readFileSync(path.join(__dirname, "js", "ui.js"), "utf8");

let okStatic = true;
const sc = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };

/* 一、index.html：26.x 统一战斗 UI —— 深渊独立 #abyss-hud 已删除，主线块保留（深渊复用） */
sc("一1 index.html 已删除深渊独立容器 #abyss-hud（统一战斗 UI）", !htmlIds.has("abyss-hud"));
sc("一2 经验条四件套元素已随之移除（与 #hud-tr 重复）",
  !htmlIds.has("abyss-exp-lv") && !htmlIds.has("abyss-exp-bar") && !htmlIds.has("abyss-exp-fill") && !htmlIds.has("abyss-exp-txt"));
sc("一3 深渊 HUD 元素 id 不与现有冲突（各自唯一）", (() => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const uniq = new Set(ids);
  return uniq.size === ids.length;
})());
sc("一4 主线 HUD 块仍在（#hud-top / #hud-tr —— 深渊复用同一布局）",
  htmlIds.has("hud-top") && htmlIds.has("hud-tr"));
sc("一5 自动战斗按钮仍在 index.html（主线需要；仅深渊隐藏）", htmlIds.has("btn-autofight"));
sc("一6 统一口径注释落位（index.html 标注深渊复用同一战斗 UI）", html.indexOf("深渊复用与主线") >= 0);

/* 二、CSS：#abyss-hud 全部规则已清空；abyss-mode 不再隐藏主线块 */
sc("二1 CSS 不再有任何 #abyss-hud / #abyss-exp 选择器规则（样式随元素一起删除；注释提及不计）",
  !/#abyss-hud\s*\{/.test(css) && !/abyss-exp-/.test(css));
sc("二2 body.portrait 钩子同步清理（无残留定位规则）", !/body\.portrait\s+#abyss-hud/.test(css));

/* 三、深渊模式：只隐藏自动战斗（布局不动）+ ui.js 深渊推进分支 */
sc("三1 #hud.abyss-mode 隐藏 #btn-autofight", /#hud\.abyss-mode\s+#btn-autofight[\s\S]{0,80}display:\s*none/.test(css));
sc("三2 #hud.abyss-mode 隐藏风格选择器 #autofight-styles", /#hud\.abyss-mode\s+#autofight-styles[\s\S]{0,80}display:\s*none/.test(css));
sc("三3 abyss-mode 不再隐藏主线击杀进度条 #hud-top（统一布局，只换数据文案）",
  !/#hud\.abyss-mode\s+#hud-top/.test(css));
sc("三4 abyss-mode 不再隐藏主线等级·货币行 #hud-tr（统一布局）",
  !/#hud\.abyss-mode\s+#hud-tr/.test(css));
sc("三5 ui.js 声明 updateAbyssHud / clearAbyssHud", /updateAbyssHud\s*\(/.test(uiSrc) && /clearAbyssHud\s*\(/.test(uiSrc));
sc("三6 ui.js 已无 #abyss-hud / #abyss-exp 的 DOM 读写（getElementById 点随元素一起删除；注释提及不计）",
  uiSrc.indexOf('getElementById("abyss-hud")') < 0 && uiSrc.indexOf("abyss-exp-") < 0);
sc("三7 updateHUD 有深渊推进分支（复用 Endless 阈值，不另算一份数据）",
  uiSrc.indexOf("深渊推进") >= 0 && uiSrc.indexOf("bossThreshold") >= 0);

/* ============================================================
 * 运行时：加载脚本链
 * ============================================================ */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js",
  "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

let checks = 0, fails = 0;
const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };

/* ---- 基础现场：可渲染的 run 上下文（沿用 endless_flow_test 手法） ---- */
vm.runInContext(`(function(){
  G.heroDef = CFG.heroes[0];
  G.team = [CFG.heroes[0]];
  G.state = "playing";
  G.inEndless = false;
  G.run = {
    lv: 4, exp: 12, expNext: 30, coin: 55,
    companions: [], heroModules: {},
    backpack: { totalWeight: function () { return 0; }, items: [] }, weaponInv: null,   // updateHUD 负重行需要
    weapon: { skill: { name: "测试技能", cd: 1.0 }, basic: null },
    buffs: [], drones: [], traps: [], scale: null, cardAssets: 0,
    bossSpawned: false, bossDefeated: false, kills: 0, runTime: 0,
  };
  G.player = { heroDef: CFG.heroes[0], x: 100, y: 100, skillTimer: 0 };
  G.levelCfg = { progressGoal: 60, timeLimit: 180 };   // 主线进度条文案需要
  G.mainWorld = { altars: [] };                        // updateHUD 中央提示需要
  G.inRift = false;
})();`, ctx, { filename: "setup" });

/* ============================================================
 * 四、规则 1：属性包卡面「属性名 +N」
 * ============================================================ */
vm.runInContext(`(function(){
  CFG.statNames = { atk: "攻击", hp: "生命", def: "防御", spd: "速度" };
  var cands = [{ kind: "statPack", packId: "pack_atk", name: "强攻包", stat: "atk", value: 3 }];
  UI.onLevelUpChoice(cands, function () {}, { heroId: "H001", heroName: "猎手" });
  window.__packHtml = document.getElementById("levelup-cards").children[0].innerHTML;
})();`, ctx, { filename: "pack" });
const packHtml = ctx.window.__packHtml;
check("四1 属性包 desc 显示「攻击 +3」（属性名 + 数值）", packHtml.indexOf("攻击 +3") >= 0 || (packHtml.indexOf("攻击") >= 0 && packHtml.indexOf("+3") >= 0));
check("四2 数值高亮保留（lu-num 包裹 +3，未破坏原正则逻辑）",
  /<b class="lu-num">\+3<\/b>/.test(packHtml));
check("四3 补充说明小字（全队攻击提升 3 点）", packHtml.indexOf("lu-sub") >= 0 && packHtml.indexOf("全队攻击提升 3 点") >= 0);
check("四4 卡面仍标注「属性小包 / 属性包」", packHtml.indexOf("属性包") >= 0);

/* 五、CFG.statNames 优先级 + 缺失回落 */
vm.runInContext(`(function(){
  CFG.statNames = { atk: "物攻" };   // 覆盖：应优先用 CFG.statNames
  UI.onLevelUpChoice([{ kind: "statPack", packId: "pack_atk", name: "强攻包", stat: "atk", value: 3 }], function () {});
  window.__packCustom = document.getElementById("levelup-cards").children[0].innerHTML;
  delete CFG.statNames;              // 缺失：应回落本地映射（不空白、不抛错）
  UI.onLevelUpChoice([{ kind: "statPack", packId: "pack_def", name: "铁壁包", stat: "def", value: 1 }], function () {});
  window.__packFallback = document.getElementById("levelup-cards").children[0].innerHTML;
  // 极值：stat/value 缺失也不能抛错
  UI.onLevelUpChoice([{ kind: "statPack", name: "空包" }], function () {});
  window.__packEmpty = document.getElementById("levelup-cards").children[0].innerHTML;
})();`, ctx, { filename: "pack-name" });
check("五1 CFG.statNames 存在时优先使用（物攻 +3）", ctx.window.__packCustom.indexOf("物攻 +3") >= 0 || (ctx.window.__packCustom.indexOf("物攻") >= 0 && ctx.window.__packCustom.indexOf("+3") >= 0));
check("五2 CFG.statNames 缺失 → 回落本地映射（防御 +1）", ctx.window.__packFallback.indexOf("防御") >= 0 && ctx.window.__packFallback.indexOf("+1") >= 0);
check("五3 stat/value 缺失 → 降级为「属性 +0」不抛错", ctx.window.__packEmpty.indexOf("属性") >= 0);

/* ============================================================
 * 六 / 七、规则 2：深渊 HUD（经验条 + 多英雄技能栏 + abyss-mode）
 * ============================================================ */
/* 六、深渊复用统一战斗 HUD（26.x）：abyss-mode 开关 + updateHUD 数据照常写入同一条 HUD */
vm.runInContext(`(function(){
  G.inEndless = true;
  G.run.lv = 4; G.run.exp = 12; G.run.expNext = 30; G.run.coin = 55;
  G.run.kills = 7; G.run.runTime = 42;
  G.run.bossSpawned = false; G.run.bossDefeated = false;
  UI.updateAbyssHud();
  window.__abyssMode = document.getElementById("hud").classList.contains("abyss-mode");
  UI.updateHUD();
  window.__progTxt = document.getElementById("progress-txt").textContent;
  window.__lvNum = document.getElementById("lv-num").textContent;
  window.__coinNum = document.getElementById("coin-num").textContent;
  window.__expFill = document.getElementById("bar-exp").style.width;
})();`, ctx, { filename: "abyss-on" });
check("六1 深渊：#hud 挂上 .abyss-mode（CSS 据此隐藏自动战斗）", ctx.window.__abyssMode === true);
check("六2 深渊进度条走「深渊推进」文案（同一条 #hud-top，布局不动）",
  String(ctx.window.__progTxt).indexOf("深渊推进") >= 0);
check("六3 深渊推进读数 = 击杀/阈值（7/300，阈值复用 CFG.endless.bossProgressBase）",
  String(ctx.window.__progTxt).indexOf("7/300") >= 0);
check("六4 等级·货币照常写入同一 #hud-tr（LV 4 / 货币 55）",
  ctx.window.__lvNum === 4 && String(ctx.window.__coinNum) === "55");
check("六5 经验条宽度 = exp/expNext = 40%（同一 #hud-tr 内）", ctx.window.__expFill === "40%");

/* 非深渊：abyss-mode 摘除 + 文案回主线（同一布局，只换数据源） */
vm.runInContext(`(function(){
  G.inEndless = false;
  UI.updateAbyssHud();
  window.__abyssModeOff = document.getElementById("hud").classList.contains("abyss-mode");
  UI.updateHUD();
  window.__progTxtOff = document.getElementById("progress-txt").textContent;
  UI.clearAbyssHud();
  window.__cleared = !document.getElementById("hud").classList.contains("abyss-mode");
  UI.clearAbyssHud();
})();`, ctx, { filename: "abyss-off" });
check("六6 非深渊：#hud 无 .abyss-mode（自动战斗按钮在主线的显示不受影响）", ctx.window.__abyssModeOff === false);
check("六7 非深渊：进度条文案回主线「击杀进度」（同一布局）",
  String(ctx.window.__progTxtOff).indexOf("击杀进度") >= 0);
check("六8 clearAbyssHud 幂等摘类（可重复调用）", ctx.window.__cleared === true);

/* 七、逐英雄技能栏：主角 + 2 队友 = 3 栏，各自含技能名 */
vm.runInContext(`(function(){
  G.inEndless = true;
  G.heroDef = CFG.heroes[0];
  const comp = [CFG.heroes[1], CFG.heroes[2]].map(function (hd, i) {
    return { heroDef: hd, id: hd.id, name: hd.name, alive: true, skillTimer: i * 0.6 };
  });
  G.run.companions = comp;
  G.run.heroModules = {};
  for (const h of [CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]]) G.run.heroModules[h.id] = [null, null, null, null];
  UI.renderPartySkillbar();
  const bar = document.getElementById("party-skillbar");
  window.__barCount = bar.children.length;
  window.__infoHtml = bar.children.map(function (r) { return r.children[1] ? r.children[1].innerHTML : ""; });
  window.__iconCount = bar.children.filter(function (r) {
    return r.children[0] && String(r.children[0].className).indexOf("ps-icon") >= 0;
  }).length;
})();`, ctx, { filename: "skillbar" });
check("七1 深渊技能栏：主角 + 2 队友 = 3 栏（逐英雄一条）", ctx.window.__barCount === 3);
check("七2 每栏含英雄名（猎手）", ctx.window.__infoHtml[0].indexOf("猎手") >= 0);
check("七3 每栏含主动技能名小字（ps-skill 且非空）",
  ctx.window.__infoHtml.every(h => h.indexOf("ps-skill") >= 0 && /ps-skill[^>]*>[^<]+</.test(h)));
check("七4 技能栏图标元素存在（冷却环载体）",
  ctx.window.__iconCount === 3);

/* 冷却态：主角技能冷却中 → 技能栏冷却环被更新（不抛错且弧长非 0） */
vm.runInContext(`(function(){
  G.player.skillTimer = 5.0;
  UI.updatePartySkillbar();
  const row = document.getElementById("party-skillbar").children[0];
  window.__cdOffset = row.children[0].querySelector(".ps-arc").style.strokeDashoffset;
})();`, ctx, { filename: "skillbar-cd" });
check("七5 技能栏冷却环随 skillTimer 更新（弧长非 0，冷却中）", parseFloat(ctx.window.__cdOffset) > 0 || ctx.window.__cdOffset === "");

/* ============================================================
 * 八、空值保护（headless 空值调用不得抛错）
 * ============================================================ */
vm.runInContext(`(function(){
  let ok = true;
  // 8A：G.run 为空
  const savedRun = G.run;
  G.run = null; G.inEndless = true;
  try { UI.updateAbyssHud(); } catch (e) { ok = false; }
  // 8B：非深渊但 run 为空
  G.inEndless = false;
  try { UI.updateAbyssHud(); } catch (e) { ok = false; }
  G.run = savedRun;
  // 8C：companions / heroDef 为空
  const savedHero = G.heroDef, savedComp = G.run.companions;
  G.heroDef = null; G.run.companions = null;
  try { UI.renderPartySkillbar(); UI.updatePartySkillbar(); } catch (e) { ok = false; }
  G.heroDef = savedHero; G.run.companions = savedComp;
  // 8D：clearAbyssHud 幂等
  try { UI.clearAbyssHud(); UI.clearAbyssHud(); } catch (e) { ok = false; }
  window.__nullOk = ok;
})();`, ctx, { filename: "null-safe" });
check("八1 G.run / companions / heroDef 缺失时 HUD 方法不抛异常", ctx.window.__nullOk === true);

/* 8E：整个 getElementById 失效（无 DOM）时也不抛错 */
vm.runInContext(`(function(){
  let ok = true;
  const realGet = document.getElementById;
  document.getElementById = function () { return null; };
  try { UI.updateAbyssHud(); UI.clearAbyssHud(); } catch (e) { ok = false; }
  document.getElementById = realGet;
  window.__nullDomOk = ok;
})();`, ctx, { filename: "null-dom" });
check("八2 DOM 元素全缺失时 updateAbyssHud / clearAbyssHud 不抛异常", ctx.window.__nullDomOk === true);

/* 8F：属性包卡面无 CFG.statNames / 无 G.run 时也不抛错 */
vm.runInContext(`(function(){
  let ok = true;
  const savedRun = G.run;
  G.run = null;
  try {
    UI.onLevelUpChoice([{ kind: "statPack", stat: "spd", value: 8 }], function () {});
  } catch (e) { ok = false; }
  G.run = savedRun;
  window.__packNullOk = ok;
})();`, ctx, { filename: "pack-null" });
check("八3 G.run 为空时属性包卡面渲染不抛异常", ctx.window.__packNullOk === true);

console.log("----------------------------------------");
console.log("行为断言 " + checks + " 项，失败 " + fails + " 项");
if (!okStatic || fails > 0) { console.log("ENDLESS HUD TEST FAILED"); process.exit(1); }
console.log("ENDLESS HUD TEST OK");
