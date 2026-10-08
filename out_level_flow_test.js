/* 局外成长闭环回归测试：升级曲线 / 分段增益 / 兼容回落 / 产出自检 / 结算报告（node out_level_flow_test.js）
 * 风格参考 meta_growth_test.js（DOM 桩 + Node vm 沙箱加载 js/config.js、js/core.js、js/game.js）。
 * 覆盖：
 *   一、outLevelCost 指数曲线：单调递增、前平后陡、具体数值断言、满级返回 0
 *   二、兼容回落：缺 growthRate → 旧线性公式；测完恢复
 *   三、outLevelStats 分段增益：LV1 恒基础值、逐级递增、缺 growthTable 回落旧线性
 *   四、配平自检（核心）：满级累计花费 / 预期单局产出 → 预期局数落在 15~25 区间
 *   五、Meta.awardRun 三条路径（杀 BOSS 撤离 / 未杀 BOSS 撤离 / 死亡）结晶数值正确
 *   六、结算报告 buildCrystalReport：撤离/死亡文案与总计（产出可见化）
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）——用中文「错误」。 */
"use strict";

/* ---- DOM / Canvas 桩（与 meta_growth_test 相同的最小桩；Meta.load 只读 localStorage，null 桩够用） ---- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { }
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });
global.EventBus = undefined;
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---- 断言都在 driver 内跑（const CFG 等在 vm 作用域，driver 可访问；主进程拿不到） ---- */
const driver = `
let passCount = 0, failCount = 0;
const check = (name, cond) => { if (cond) { passCount++; console.log("PASS " + name); } else { failCount++; console.log("FAIL " + name); } };
const o = CFG.outLevel;

/* 逐级花费（LV n→n+1，n=1..maxLevel-1）快照：借 Meta.heroLevel 读等级，跑完复原 */
function costSeq() {
  const save = Meta.data.heroes.H001;
  const arr = [];
  for (let lv = 1; lv < o.maxLevel; lv++) {
    Meta.data.heroes.H001 = { level: lv };
    arr.push(outLevelCost("H001"));
  }
  if (save === undefined) delete Meta.data.heroes.H001; else Meta.data.heroes.H001 = save;
  return arr;
}

/* ============ 一、指数曲线（单调 + 前平后陡 + 具体数值 + 满级边界） ============ */
const seq = costSeq();
check("一1 逐级花费数量 = maxLevel-1 = " + (o.maxLevel - 1), seq.length === o.maxLevel - 1);
let mono = true;
for (let i = 1; i < seq.length; i++) if (!(seq[i] > seq[i - 1])) mono = false;
check("一2 曲线随等级严格单调递增（" + seq.join("→") + "）", mono);
check("一3 LV1→2 花费 = costBase（" + o.costBase + "）", seq[0] === o.costBase);
const c1 = Math.round(o.costBase * Math.pow(o.growthRate, 0));       // LV1→2
const c9 = Math.round(o.costBase * Math.pow(o.growthRate, 8));       // LV9→10
check("一4 LV9→10 花费 = round(costBase×growthRate^8) = " + c9, seq[seq.length - 1] === c9);
check("一5 前期平缓：LV2→3（" + seq[1] + "）< LV1→2（" + seq[0] + "）× 2", seq[1] < seq[0] * 2);
check("一6 后期陡峭：LV9→10（" + c9 + "）> LV1→2（" + c1 + "）× 6（指数加速）", c9 > c1 * 6);
check("一7 无平级/塌陷（首尾比 " + (c9 / c1).toFixed(2) + " > 4）", c9 / c1 > 4);
Meta.data.heroes.H001 = { level: o.maxLevel };
check("一8 边界：满级（LV" + o.maxLevel + "）花费 = 0（不可再升）", outLevelCost("H001") === 0);
delete Meta.data.heroes.H001;

/* ============ 二、兼容回落：缺 growthRate → 旧线性公式 ============ */
const _rate = o.growthRate; o.growthRate = undefined;
Meta.data.heroes.H001 = { level: 1 };
check("二1 兼容：无 growthRate 时回落旧线性（LV1→2 = costBase = " + o.costBase + "）", outLevelCost("H001") === o.costBase);
Meta.data.heroes.H001 = { level: 5 };
check("二2 兼容：无 growthRate 时回落旧线性（LV5→6 = costBase+4×costStep = " + (o.costBase + 4 * o.costStep) + "）",
  outLevelCost("H001") === o.costBase + 4 * o.costStep);
Meta.data.heroes.H001 = { level: o.maxLevel };
check("二3 兼容：回落线性下满级仍返回 0", outLevelCost("H001") === 0);
o.growthRate = _rate;   // 恢复
delete Meta.data.heroes.H001;
check("二4 兼容契约保持：恢复 growthRate 后回到指数曲线（LV1→2 = " + seq[0] + "）", outLevelCost("H001") === seq[0]);

/* ============ 三、分段增益 outLevelStats（LV1 基础值 / 逐级递增 / 回落线性） ============ */
const base = CFG.heroes[0];
const s1 = outLevelStats(base, 1);
check("三1 LV1 恒等于基础值（hp/atk/def 与 CFG 原表相等，不污染）",
  s1.hp === base.hp && s1.atk === base.atk && s1.def === base.def && CFG.heroes[0].hp === base.hp);
let rise = true;
for (let lv = 2; lv <= o.maxLevel; lv++) {
  const a = outLevelStats(base, lv - 1), b = outLevelStats(base, lv);
  if (!(b.hp >= a.hp && b.atk >= a.atk && b.def >= a.def)) rise = false;
}
check("三2 逐级加成单调不减（LV1→LV" + o.maxLevel + " 不缩水）", rise);
const s10 = outLevelStats(base, o.maxLevel);
check("三3 LV" + o.maxLevel + " 属性为整数（分段倍率小数经 round 收口）",
  Number.isInteger(s10.hp) && Number.isInteger(s10.atk) && Number.isInteger(s10.def));
check("三4 LV" + o.maxLevel + " 提升有感知（atk ≥ 2 倍初始 " + s10.atk + " ≥ " + base.atk * 2 + "）", s10.atk >= base.atk * 2);
check("三5 LV" + o.maxLevel + " 不刷爆（atk ≤ 3 倍初始 " + s10.atk + " ≤ " + base.atk * 3 + "）", s10.atk <= base.atk * 3);
// 兼容回落：缺 growthTable → 旧线性（每级 growth 累加）
const _gt = o.growthTable; o.growthTable = undefined;
const lin2 = outLevelStats(base, 2), lin10 = outLevelStats(base, o.maxLevel);
check("三6 兼容：无 growthTable 回落旧线性（LV2 = 基础 + growth×1）",
  lin2.hp === base.hp + o.growth.hp && lin2.atk === base.atk + o.growth.atk && lin2.def === base.def + o.growth.def);
check("三7 兼容：无 growthTable 时 LV" + o.maxLevel + " = 基础 + growth×" + (o.maxLevel - 1),
  lin10.hp === base.hp + o.growth.hp * (o.maxLevel - 1) && lin10.atk === base.atk + o.growth.atk * (o.maxLevel - 1));
o.growthTable = _gt;   // 恢复

/* ============ 四、配平自检（核心）：累计花费 / 单局产出 / 预期局数 ============ */
const sumCost = seq.reduce((a, b) => a + b, 0);
// 单局预期产出 = 击杀 BOSS + 典型剩余物资（30 价值）× 折算率
const SALVAGE_VALUE = 30;
const perRun = o.crystalBoss + SALVAGE_VALUE * CFG.settleConvert.valueRate;
const runs = sumCost / perRun;
check("四1 满级累计花费 = " + sumCost + " 结晶（Σ 逐级花费）", sumCost === seq.reduce((a, b) => a + b, 0) && sumCost > 0);
check("四2 单局预期产出 = " + perRun + "（crystalBoss " + o.crystalBoss + " + 折算 " + (SALVAGE_VALUE * CFG.settleConvert.valueRate) + "）", perRun > 0);
check("四3 升满预期局数 = " + runs.toFixed(1) + " 落在设计区间 [15, 25]", runs >= 15 && runs <= 25);
check("四4 累计花费不再失控（" + sumCost + " < 旧指数 1.8 曲线的 12336 一半 6000）", sumCost < 6000);
check("四5 产出来源同源：crystalBoss/deathRatio/valueRate 均在 CFG 且为正数",
  o.crystalBoss > 0 && o.deathRatio > 0 && o.deathRatio <= 1 && CFG.settleConvert.valueRate > 0);

/* ============ 五、Meta.awardRun 三条路径 ============ */
Meta.data.crystals = 0;
const vA = Meta.awardRun(999, true, true);       // 杀 BOSS 撤离
check("五1 杀 BOSS 撤离 → crystalBoss = " + o.crystalBoss + "（kills 不参与）", vA === o.crystalBoss && Meta.data.crystals === vA);
Meta.data.crystals = 0;
const vB = Meta.awardRun(999, false, true);      // 未杀 BOSS 撤离（撤离折算由 main.js 另加，不经本函数）
check("五2 未杀 BOSS 撤离 → 0（小怪击杀退役，折算另计）", vB === 0 && Meta.data.crystals === 0);
Meta.data.crystals = 0;
const vC = Meta.awardRun(999, true, false);      // 死亡（打过 BOSS）
check("五3 死亡（打过 BOSS）→ floor(crystalBoss×deathRatio) = " + Math.floor(o.crystalBoss * o.deathRatio),
  vC === Math.floor(o.crystalBoss * o.deathRatio) && Meta.data.crystals === vC);
Meta.data.crystals = 0;
const vD = Meta.awardRun(999, false, false);     // 死亡且无 BOSS
check("五4 死亡且无 BOSS → 0", vD === 0 && Meta.data.crystals === 0);

/* ============ 六、结算报告 buildCrystalReport（产出可见化） ============ */
const repA = buildCrystalReport({ kills: 20, bossDefeated: true, extracted: true, convertTotal: 15 });
check("六1 杀 BOSS 撤离：总计 = crystalBoss + 折算 = " + (o.crystalBoss + 15), repA.total === o.crystalBoss + 15 && repA.died === false);
check("六2 明细含「击杀首领 +" + o.crystalBoss + "」「物资折算 +15」「本局合计」三行",
  repA.lines.some(l => l.indexOf("击杀首领 +" + o.crystalBoss) >= 0)
  && repA.lines.some(l => l.indexOf("物资折算 +15") >= 0)
  && repA.lines.some(l => l.indexOf("本局合计 +" + repA.total) >= 0));
const repB = buildCrystalReport({ kills: 5, bossDefeated: true, extracted: false });
check("六3 阵亡：文案含「阵亡 · 仅保留 " + Math.round(o.deathRatio * 100) + "%」，到手 = floor(crystalBoss×deathRatio)",
  repB.died === true && repB.total === Math.floor(o.crystalBoss * o.deathRatio)
  && repB.lines.some(l => l.indexOf("阵亡 · 仅保留") >= 0));
check("六4 阵亡明细展示打折过程（+crystalBoss → 保留 +" + repB.total + "）",
  repB.lines.some(l => l.indexOf("保留 +" + repB.total) >= 0));
const repC = buildCrystalReport({ kills: 3, bossDefeated: false, extracted: true });
check("六5 未杀 BOSS 撤离：总计 0 且有兜底文案", repC.total === 0 && repC.lines.length >= 2);
const repD = buildCrystalReport({});
check("六6 空入参不抛错（防御式，返回结构完整）并显示阵亡档", !!repD && Array.isArray(repD.lines) && repD.total === 0 && repD.died === true);

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("局外成长闭环测试未全绿：失败 " + failCount + " 项");
}
console.log("OUT LEVEL FLOW TEST OK");
`;

try {
  vm.runInContext(driver, ctx, { filename: "out_level_flow_driver.js" });
} catch (e) {
  console.error("错误:", e && e.stack || e);
  process.exit(1);
}
