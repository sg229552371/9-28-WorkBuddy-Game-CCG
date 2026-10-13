/* xgame_milestone_test.js — X-GAMe C1 首发名单接线 + C3/C4 里程碑/保险来源回归
 * 运行：node xgame_milestone_test.js
 * 依赖：vm 沙箱加载真实 js/*（config/core/game/items/combat/modes/render/quality/rewards/main）。
 *
 * 覆盖：
 *   item2  CFG.starterHeroIds 接线 —— 首发集合 / H002·H003 规则解锁 / H007~H012 仍可解锁 /
 *          缺省（空数组）回落旧行为（unlockOrder 前 starterCount 个）。
 *   item3c CFG.outLevel.unlockMilestones 达成判定（账号进度 = 全部英雄局外等级最大值）
 *          + insuranceSlot 开局发放（startRun 件数）。
 *   item3b CFG.insuranceSource 开关（insuranceSourceEnabled）+ assured 开局发放 + starterInsuranceSlots 纯查询。
 *
 * 判绿 = exit 0 且末行 MILESTONE TEST OK；
 * PASS 文案严禁出现英文 error/FAIL/Error 子串（门禁 run_tests.sh 以 grep 计 bad；dev_guide 坑 4）。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---- 断言器：PASS 文案只含中文，避免门禁 grep 误判 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
}

/* ---- 最小 DOM / UI 桩（game.js 顶层与 startRun 需要；核心逻辑本身不读 DOM） ---- */
const noop = () => { };
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  children: [], innerHTML: "", textContent: "", disabled: false, width: 300, height: 300, value: "",
  appendChild(c) { this.children.push(c); return c; }, remove: noop,
  addEventListener: noop, setAttribute: noop, getAttribute: () => null,
  getContext: () => ({}), querySelector: () => fakeEl(), querySelectorAll: () => [],
  closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
});
const UI = {
  selectedLevel: null, selectedChars: [],
  toast: noop, showScreen: noop, showHudOnly: noop, updateHUD: noop, renderBackpack: noop,
  toggleBackpack: noop, clearBattleHud: noop, updateHomeUser: noop, closeNpcPanels: noop,
  buildLevelList: noop, buildCharList: noop, onLevelUpChoice: noop, onLevelUpChoiceClose: noop,
  hideEndlessSettle: noop, showEndlessSettle: noop, hideEndlessIntro: noop, showEndlessIntro: noop,
  updateAutoFightBtn: noop, renderItemInfo: noop, toggleArtisan: noop, showSettlement: noop, showDeath: noop,
};
const sandbox = {
  console: { log: (...a) => console.log(...a), warn: noop, error: noop, info: noop },
  Math, Date, JSON, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat,
  UI,
  document: { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop, querySelectorAll: () => [], elementFromPoint: () => null, execCommand: () => true, body: fakeEl() },
  window: { addEventListener: noop, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: "", href: "http://x/", protocol: "http:" } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: noop,
  Image: class { constructor() { this.width = 100; this.height = 100; } set src(v) { } },
  performance: { now: () => Date.now() },
  Audio: class { constructor() { } play() { } pause() { } cloneNode() { return new this.constructor(); } addEventListener() { } },
};
vm.createContext(sandbox);

let loadOk = true, loadMsg = "";
try {
  for (const f of ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sandbox, { filename: f });
  }
} catch (e) {
  loadOk = false; loadMsg = (e && e.message) ? e.message : String(e);
}

check("00 沙箱内加载 config/core/pool/game/items/combat/modes/render/quality/rewards/main 不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常：" + loadMsg);
  console.log("MILESTONE TEST FAILED");
  process.exit(1);
}

/* ---- 断言逻辑全部在沙箱内跑（const CFG / Meta / G 在 vm 作用域；主进程拿不到） ---- */
vm.runInContext(`
  var checks = 0, fails = 0;
  var check = function (name, cond) { checks++; console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails++; };

  /* 关卡/画布桩：startRun 需要 UI.selectedLevel 与 G.canvas 上下文 */
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: { width: 60, height: 60 }, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  UI.selectedLevel = CFG.levels[0];

  CFG.testUnlockAllHeroes = false;   // ⚗️ 本套件专测正式解锁链路，临时关掉全解锁开关（不改 js/config.js 默认值）

  function resetAccount() { Meta.data.heroes = {}; Meta.data.unlockExtra = {}; Meta.data.crystals = 0; }
  function setLv(id, lv) { Meta.data.heroes[id] = { level: lv }; }
  function runInsCount() { return insuranceCount(G.run); }

  /* ================= item2：starterHeroIds 接线 ================= */
  var STARTERS = ["H001", "H006", "H004", "H005", "H010", "H012"];
  resetAccount();
  check("m01 首发集合 = starterHeroIds（6 角在空账号下即解锁）",
    STARTERS.length === 6 && STARTERS.every(function (id) { return Meta.isHeroUnlocked(id); }));

  var nonStarters = ["H002", "H003", "H007", "H008", "H009", "H011"];
  resetAccount();
  check("m02 非首发（空账号）默认锁定", nonStarters.every(function (id) { return !Meta.isHeroUnlocked(id); }));

  resetAccount(); setLv("H001", 3);
  check("m03 H002 可由规则解锁（H001 局外 LV3）", Meta.isHeroUnlocked("H002"));
  resetAccount(); setLv("H006", 4);
  check("m04 H003 可由规则解锁（H006 局外 LV4）", Meta.isHeroUnlocked("H003"));

  resetAccount(); setLv("H006", 3);
  var h007 = Meta.isHeroUnlocked("H007");
  resetAccount(); setLv("H004", 5);
  var h009 = Meta.isHeroUnlocked("H009");
  resetAccount(); setLv("H010", 6);
  var h011 = Meta.isHeroUnlocked("H011");
  resetAccount(); Meta.data.crystals = 300; var h008 = Meta.unlockHero("H008") && Meta.isHeroUnlocked("H008");
  resetAccount(); Meta.data.crystals = 500; var h010 = Meta.unlockHero("H010") && Meta.isHeroUnlocked("H010");
  resetAccount(); Meta.data.crystals = 800; var h012 = Meta.unlockHero("H012") && Meta.isHeroUnlocked("H012");
  check("m05 H007~H012 仍可解锁（heroLv 型 + crystal 型两通道）", !!(h007 && h009 && h011 && h008 && h010 && h012));

  resetAccount();
  var bakStarter = CFG.starterHeroIds;
  CFG.starterHeroIds = [];
  var legacyIds = ["H001", "H002", "H003", "H004", "H005", "H006"];
  var legacyOk = legacyIds.every(function (id) { return Meta.isHeroUnlocked(id); }) && !Meta.isHeroUnlocked("H007");
  CFG.starterHeroIds = bakStarter;
  check("m06 无 starterHeroIds（空数组）时回落旧行为（unlockOrder 前 starterCount 个）", legacyOk);

  resetAccount();
  check("m07 恢复 starterHeroIds 后首发判定生效（H010 首发解锁 / H002 仍锁定）",
    Meta.isHeroUnlocked("H010") === true && Meta.isHeroUnlocked("H002") === false);

  /* ================= item3c：unlockMilestones 达成判定 ================= */
  resetAccount();
  check("m08 默认（全员局外 LV1）未达成任何里程碑", unlockedMilestones(Meta.data).length === 0);

  resetAccount(); setLv("H001", 3);
  var m3 = unlockedMilestones(Meta.data);
  check("m09 账号进度 LV3 → 命中 LV3 里程碑 insuranceSlot+1",
    m3.length === 1 && m3[0].unlock === "insuranceSlot" && m3[0].amount === 1);

  resetAccount(); setLv("H006", 6);
  var m6 = unlockedMilestones(Meta.data);
  check("m10 账号进度 LV6 → 命中 LV3+LV6 两条 insuranceSlot",
    m6.length === 2 && m6.every(function (m) { return m.unlock === "insuranceSlot"; }));

  resetAccount(); setLv("H009", 9);
  var m9 = unlockedMilestones(Meta.data);
  check("m11 账号进度 LV9 → 追加 altarWeight 里程碑（ALTAR_007 权重 +6）",
    m9.length === 3 && altarWeightOf("ALTAR_007", Meta.data) === 6);

  check("m12 accountLevel = 全部英雄局外等级最大值（H003 LV4 / H009 LV9 → 9）",
    (function () { resetAccount(); setLv("H003", 4); setLv("H009", 9); var v = accountLevel(Meta.data); resetAccount(); return v === 9; })());

  /* ================= item3c：insuranceSlot 开局发放（startRun 件数） ================= */
  resetAccount(); UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  check("m13 默认开局自带 0 份保险（零行为变更）", runInsCount() === 0);

  resetAccount(); setLv("H001", 3); UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  check("m14 里程碑 LV3 → 开局自带 1 份保险", runInsCount() === 1);

  resetAccount(); setLv("H001", 6); UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  check("m15 里程碑 LV6 → 开局自带 2 份保险", runInsCount() === 2);

  /* ================= item3b：insuranceSource 开关 + assured / 纯查询 ================= */
  check("m16 insuranceSourceEnabled：缺省/未知 kind = true，显式 false 生效",
    insuranceSourceEnabled("chestDrop") === true && insuranceSourceEnabled("noSuchKind") === true &&
    insuranceSourceEnabled("eliteDrop") === false);

  resetAccount();
  check("m17 starterInsuranceSlots 纯查询：默认 0 / LV3=1 / LV6=2 / LV9=2（altarWeight 不加份）",
    (function () {
      var a0 = starterInsuranceSlots(Meta.data);
      setLv("H001", 3); var a1 = starterInsuranceSlots(Meta.data);
      setLv("H001", 6); var a2 = starterInsuranceSlots(Meta.data);
      setLv("H001", 9); var a3 = starterInsuranceSlots(Meta.data);
      resetAccount();
      return a0 === 0 && a1 === 1 && a2 === 2 && a3 === 2;
    })());

  var bakAssured = CFG.insuranceSource.assured;
  CFG.insuranceSource.assured = { enabled: true, count: 2 };
  resetAccount(); setLv("H001", 6); UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  var assuredCount = runInsCount();
  CFG.insuranceSource.assured = bakAssured;
  check("m18 assured.enabled → 开局 +count 份保险（assured 2 + 里程碑 2 = 4）", assuredCount === 4);

  resetAccount();
  check("m19 cfg 开关复位后 assured 关闭 → 开局自带 0 份（无残留）",
    starterInsuranceSlots(Meta.data) === 0 && insuranceSourceEnabled("assured") === false);

  window.__msFail = function () { return fails; };
  window.__msChecks = function () { return checks; };
`, sandbox, { filename: "xgame_milestone_driver.js" });

/* ---- 汇总 ---- */
const fails = sandbox.window.__msFail();
const checks = sandbox.window.__msChecks();
console.log("----------------------------------------");
console.log("PASS 统计 = " + passCount + " 项文件级断言 + 沙箱内 " + checks + " 项；失败 = " + (failCount + fails));
if (fails > 0 || failCount > 0) {
  console.log("MILESTONE TEST FAILED");
  process.exit(1);
}
console.log("MILESTONE TEST OK");
process.exit(0);
