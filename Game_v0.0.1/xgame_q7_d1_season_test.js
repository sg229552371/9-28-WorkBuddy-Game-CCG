/* 无头测试：本轮 6 项拍板落库回归（node xgame_q7_d1_season_test.js）
 * 覆盖（G_docs/decision_log_v1.md D029~D034）：
 *   D029 E-β：英雄能量字段物理退役（heroes / baseStats.int / statNames / statDesc / gearDefs / AT124）
 *   D030 C1-Q5：H007 定位维持 aux（4/4/4 分组不破）
 *   D031 C1-Q7：playtag / difficulty / statBias 三字段全覆盖 + UI 消费点静态存在
 *   D032 D1：skillCurve 改为线性插值（端点不变、等间隔；不再是指数幂曲线）
 *   D033：CFG.season 为赛季数值唯一来源（modes.js 不再硬编码）
 * 判绿 = exit 0 且无 FAIL 文案。
 * 运行：node xgame_q7_d1_season_test.js
 */
"use strict";

/* ---- DOM / Canvas 桩（与 hero_roster_test 同款最小桩） ---- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null; }, dataset: {} }; },
  addEventListener() { }
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });
global.EventBus = undefined;
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

let okMain = true;
const checkMain = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okMain = false; };

/* ================= 静态检查（源文件级） ================= */
const uiSrc = fs.readFileSync("js/ui.js", "utf8");
const cssSrc = fs.readFileSync("css/style.css", "utf8");
const modesSrc = fs.readFileSync("js/modes.js", "utf8");
const confSrc = fs.readFileSync("js/config.js", "utf8");

checkMain("D031 UI 消费点：ui.js 含 _diffStars / _statBiasHtml，且卡片 / 详情渲染新字段",
  uiSrc.indexOf("_diffStars") >= 0 && uiSrc.indexOf("_statBiasHtml") >= 0 && uiSrc.indexOf("hero-playtag") >= 0);
checkMain("D031 样式存在：css 含 .hero-playtag 与 .cd-bias（深色主题新增类）",
  cssSrc.indexOf("hero-playtag") >= 0 && cssSrc.indexOf("cd-bias") >= 0);
checkMain("D033 modes.js 的赛季数值改为数据驱动（SEASON_CFG 读 CFG.season；保留同值兜底）",
  modesSrc.indexOf("CFG.season") >= 0 && modesSrc.indexOf("var SEASON_CFG = (typeof CFG") >= 0);
checkMain("D029 config.js 已无 energyMax / energyRegen 键（注释说明除外）",
  confSrc.indexOf("energyMax:") < 0 && confSrc.indexOf("energyRegen:") < 0);

/* ================= CFG 检查（vm 作用域，driver 内跑） ================= */
const driver = `
let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

/* ---- D029 E-β：能量字段物理退役 ---- */
check("D029 12 角均无 energyMax / energyRegen 字段",
  CFG.heroes.every(h => h.energyMax === undefined && h.energyRegen === undefined));
check("D029 baseStats.int 只剩 powPct（能量折算已删）",
  CFG.baseStats.int.energyMax === undefined && CFG.baseStats.int.powPct > 0);
check("D029 statNames 无能量键", CFG.statNames.energyMax === undefined && CFG.statNames.energyRegen === undefined);
check("D029 statDesc 无能量键", CFG.statDesc.energyMax === undefined && CFG.statDesc.energyRegen === undefined);
check("D029 装备 G005 / G008 词条改为 hp+def（无能量键）",
  !!CFG.gearDefs.find(g => g.id === "G005") && CFG.gearDefs.find(g => g.id === "G005").stats.energyMax === undefined
  && CFG.gearDefs.find(g => g.id === "G005").stats.def > 0
  && !!CFG.gearDefs.find(g => g.id === "G008") && CFG.gearDefs.find(g => g.id === "G008").stats.energyMax === undefined);
check("D029 AT124 灵能护罩 scaleBy 改吃 def",
  CFG.skills.AT124.scaleBy.stat === "def" && CFG.skills.AT124.scaleBy.pct > 0);

/* ---- D030 C1-Q5：H007 定位维持 aux ---- */
check("D030 H007 定位维持 aux", CFG.heroRoles.byHero.H007 === "aux");
check("D030 4 / 4 / 4 定位分组仍成立",
  ["output", "defense", "aux"].every(r => CFG.heroes.filter(h => h.role === r).length === 4));

/* ---- D031 C1-Q7：三字段全覆盖 ---- */
check("D031 12 角 playtag 均为非空字符串",
  CFG.heroes.every(h => typeof h.playtag === "string" && h.playtag.length > 0));
check("D031 12 角 difficulty 均为 1~5 整数",
  CFG.heroes.every(h => typeof h.difficulty === "number" && h.difficulty >= 1 && h.difficulty <= 5 && Math.floor(h.difficulty) === h.difficulty));
check("D031 12 角 statBias 结构为 { high:[], low:[] }",
  CFG.heroes.every(h => h.statBias && Array.isArray(h.statBias.high) && Array.isArray(h.statBias.low)));
check("D031 statBias 键名全可在 statNames 查到（不出现已退役的能量键）",
  CFG.heroes.every(h => h.statBias.high.concat(h.statBias.low).every(k => !!CFG.statNames[k])));

/* ---- D032 D1：skillCurve 线性 ---- */
{
  const c = skillCurve(100, 10, 20, 2);
  check("D032 skillCurve 端点不变（LV1 = 10 / LV100 = 20）", c[0] === 10 && c[99] === 20);
  const d1 = c[1] - c[0], d2 = c[2] - c[1], d50 = c[50] - c[49];
  check("D032 skillCurve 为等间隔线性（首段 / 次段 / 第 51 段步长一致）",
    Math.abs(d1 - d2) < 1e-9 && Math.abs(d1 - d50) < 0.011);
  const flat = skillCurve(100, 7, 7, 2);
  check("D032 base === target 时全曲线恒为 base", flat.every(v => v === 7));
  const rng = skillCurve(100, 5, 30, 2);
  check("D032 全曲线单调不减且不越界", rng.every((v, i) => v >= 5 && v <= 30 && (i === 0 || v >= rng[i - 1])));
}

/* ---- D033 赛季配置唯一来源 ---- */
check("D033 CFG.season 存在且核心字段齐全",
  !!CFG.season && CFG.season.maxLv === 10 && CFG.season.expBase === 1000 && CFG.season.expStep === 200
  && !!CFG.season.weekly && CFG.season.weekly.killGoal === 200 && CFG.season.weekly.extractGoal === 3
  && CFG.season.weekly.levelUpGoal === 10);
check("D033 SEASON_CFG 由 CFG.season 派生（数值逐项一致）",
  SEASON_CFG.expBase === CFG.season.expBase && SEASON_CFG.expStep === CFG.season.expStep
  && SEASON_CFG.maxLv === CFG.season.maxLv && SEASON_CFG.weeklyKillGoal === CFG.season.weekly.killGoal);
check("D033 赛季入口条件已落库（unlock.afterLevels > 0）",
  !!CFG.season.unlock && CFG.season.unlock.afterLevels > 0);
check("D033 赛季奖励表已落库（rewards 非空）",
  Array.isArray(CFG.season.rewards) && CFG.season.rewards.length > 0);

ok;
`;
const driverOk = vm.runInContext(driver, ctx, { filename: "q7-d1-season-driver" });
if (!(okMain && driverOk)) { throw new Error("xgame_q7_d1_season_test 存在失败用例"); }
console.log("xgame_q7_d1_season_test OK");
