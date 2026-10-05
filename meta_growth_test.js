/* 无头测试：方向 3——局外成长落地（升级曲线 / 分段增益表 / 英雄解锁 / 结晶口径回归）（node meta_growth_test.js） */
"use strict";

/* ---- DOM / Canvas 桩（与 econ_test 相同的最小桩；Meta.load 只读 localStorage，null 桩够用） ---- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { }
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });
global.EventBus = undefined;
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };   // Meta 顶层 load() 即读存档

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---- 断言都在 driver 内跑（const CFG 等在 vm 作用域，driver 可访问；主进程拿不到） ---- */
const driver = `
let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

/* ============ 一、升级花费曲线（指数递增 + 兼容回落 + 边界） ============ */
check("一1 LV1→2 花费 = costBase（50）", outLevelCost("H001") === 50);
check("一2 LV2→3 花费 = round(50×1.3) = 65（20.10 曲线 1.3，与配平口径同源）", (() => { Meta.data.heroes.H001 = { level: 2 }; return Meta.levelUpCost("H001"); })() === 65);
let prev = 0, mono = true, sum = 0;
for (let lv = 1; lv < CFG.outLevel.maxLevel; lv++) {
  Meta.data.heroes.H001 = { level: lv };
  const c = outLevelCost("H001");
  if (!(c > prev)) mono = false;
  prev = c; sum += c;
}
check("一3 曲线随等级严格单调递增（LV1→9 每级花费递增）", mono);
check("一4 满级总花费 " + sum + " 在合理区间 [1000, 2500]（20.10 配平：≈21 局升满，见 out_level_flow_test）", sum >= 1000 && sum <= 2500);
check("一5 满级总花费仍显著高于旧线性前 3 级累加（曲线有指数感）", sum > 50 + 90 + 130);
Meta.data.heroes.H001 = { level: CFG.outLevel.maxLevel };
check("一6 边界：满级（LV10）花费 = 0（不可再升）", outLevelCost("H001") === 0);
check("一7 边界：满级 Meta.levelUp 返回 false 且不扣结晶", (() => { Meta.data.crystals = 99999; const r = Meta.levelUp("H001"); return !r && Meta.heroLevel("H001") === CFG.outLevel.maxLevel; })());
// 兼容回落：删掉 growthRate → 旧线性公式
const _rate = CFG.outLevel.growthRate; CFG.outLevel.growthRate = undefined;
Meta.data.heroes.H001 = { level: 1 };
check("一8 兼容：无 growthRate 时回落旧线性（LV1→2 = 50）", outLevelCost("H001") === 50);
Meta.data.heroes.H001 = { level: 5 };
check("一9 兼容：无 growthRate 时回落旧线性（LV5→6 = 50+4×40 = 210）", outLevelCost("H001") === 50 + 4 * CFG.outLevel.costStep);
CFG.outLevel.growthRate = _rate;
Meta.data.heroes.H001 = { level: 1 };

/* ============ 二、分段增益表（LV1=基础值 / LV10 上限 / 定位差异 / 兼容回落） ============ */
const base = CFG.heroes[0];   // H001 猎手 = output 定位
const lv1 = applyOutLevel(base);
check("二1 LV1 = 基础值（hp/atk/def/outLevel 原样，不污染 CFG）", lv1.hp === base.hp && lv1.atk === base.atk && lv1.def === base.def && lv1.outLevel === 1 && CFG.heroes[0].hp === base.hp);
Meta.data.heroes.H001 = { level: 2 };
const lv2 = applyOutLevel(base);
check("二2 LV2（平缓期首级）加成 = 定位成长 ×1.0：hp+8 / atk+2 / def+1", lv2.hp === base.hp + 8 && lv2.atk === base.atk + 2 && lv2.def === base.def + 1);
Meta.data.heroes.H001 = { level: 7 };
const lv7 = applyOutLevel(base);
check("二3 LV7 跨入陡峭期（段位 ×1.8 生效，加成 > 旧线性 6 级累计）", lv7.atk - base.atk > CFG.outLevel.growth.atk * 6);
Meta.data.heroes.H001 = { level: CFG.outLevel.maxLevel };
const lv10 = applyOutLevel(base);
check("二4 LV10 属性为整数（分段倍率小数经 round 收口）", Number.isInteger(lv10.hp) && Number.isInteger(lv10.atk) && Number.isInteger(lv10.def));
check("二5 LV10 atk 上限：提升 ≤ 3 倍初始（" + lv10.atk + " ≤ " + base.atk * 3 + "）", lv10.atk <= base.atk * 3);
check("二6 LV10 atk 实际提升 ≥ 2 倍初始（成长有感知）", lv10.atk >= base.atk * 2);
check("二7 LV10 hp 上限：≤ 3 倍初始（" + lv10.hp + " ≤ " + base.hp * 3 + "）", lv10.hp <= base.hp * 3);
check("二8 LV10 全英雄扫描：atk ≤ 3×初始（满级不刷到离谱）", CFG.heroes.every(h => {
  const d = applyOutLevel(h); return d.atk <= h.atk * 3 + 1e-9;
}));
check("二9 定位差异：防御角 H004 每级 hp 成长(12) > 输出角 H001(8)", (() => {
  const g4 = outLevelGrowthOf(CFG.heroes.find(h => h.id === "H004"));
  const g1 = outLevelGrowthOf(base); return g4.hp > g1.hp && g4.def > g1.def && g4.atk < g1.atk;
})());
check("二10 定位差异：恢复角 H007 hp 成长(10) 介于输出(8)与防御(12)之间", (() => {
  const g7 = outLevelGrowthOf(CFG.heroes.find(h => h.id === "H007"));
  const g4 = outLevelGrowthOf(CFG.heroes.find(h => h.id === "H004"));
  const g1 = outLevelGrowthOf(base);
  return g7.hp === 10 && g7.hp > g1.hp && g7.hp < g4.hp;
})());
// 兼容回落：删掉 growthTable → 旧线性
const _gt = CFG.outLevel.growthTable; CFG.outLevel.growthTable = undefined;
Meta.data.heroes.H001 = { level: 2 };
const lv2lin = applyOutLevel(base);
check("二11 兼容：无 growthTable 时回落旧线性（LV2 = +8/+2/+1）", lv2lin.hp === base.hp + 8 && lv2lin.atk === base.atk + 2 && lv2lin.def === base.def + 1);
Meta.data.heroes.H001 = { level: 10 };
const lv10lin = applyOutLevel(base);
check("二12 兼容：无 growthTable 时 LV10 = 基础 + growth×9（旧口径精确相等）", lv10lin.hp === base.hp + 8 * 9 && lv10lin.atk === base.atk + 2 * 9 && lv10lin.def === base.def + 1 * 9);
CFG.outLevel.growthTable = _gt;
Meta.data.heroes.H001 = { level: 1 };

/* ============ 三、英雄解锁（首发 6 角 + 局外条件） ============ */
check("三1 CFG.unlockOrder 与 starterCount 结构就位", Array.isArray(CFG.unlockOrder) && CFG.unlockOrder.length === 12 && CFG.starterCount === 6);
check("三2 首发 6 角（H001~H006）默认解锁", [1,2,3,4,5,6].every(i => Meta.isHeroUnlocked("H00" + i)));
check("三3 第 7/8 个（H007/H008）默认未解锁", !Meta.isHeroUnlocked("H007") && !Meta.isHeroUnlocked("H008"));
check("三4 unlockedHeroes() 长度 = 6 且只含前 6 个", (() => { const u = Meta.unlockedHeroes(); return u.length === 6 && u.join() === "H001,H002,H003,H004,H005,H006"; })());
check("三5 边界：unlockOrder 之外 id / 无规则 → 未解锁", !Meta.isHeroUnlocked("H999"));
// heroLv 条件：H007 需 H006 局外 LV3
Meta.data.heroes.H006 = { level: 2 };
check("三6 heroLv 条件未达标（H006 LV2 < 3）→ H007 未解锁", !Meta.isHeroUnlocked("H007"));
Meta.data.heroes.H006 = { level: 3 };
check("三7 heroLv 条件达成（H006 ≥ LV3）→ H007 自动解锁", Meta.isHeroUnlocked("H007"));
check("三8 unlockedHeroes() 随条件达成变为 7 个", Meta.unlockedHeroes().length === 7);
Meta.data.heroes.H006 = { level: 2 };
check("三9 heroLv 条件回退（H006 重置 LV2 < 3）→ H007 重新未解锁（查询式，无残留状态）", !Meta.isHeroUnlocked("H007"));
delete Meta.data.heroes.H006;
// crystal 条件：H008 需 300 结晶
Meta.data.crystals = 100;
check("三9 结晶不足 unlockHero 失败且不落档", !Meta.unlockHero("H008") && !Meta.isHeroUnlocked("H008"));
Meta.data.crystals = 300;
check("三10 结晶足够 unlockHero 成功：扣款 300 + 落档", Meta.unlockHero("H008") && Meta.data.crystals === 0 && Meta.isHeroUnlocked("H008"));
check("三11 unlockHero 幂等（已解锁再调返回 true 不重复扣款）", (() => { Meta.data.crystals = 50; const r = Meta.unlockHero("H008"); return r === true && Meta.data.crystals === 50; })());
check("三12 解锁记录持久化字段 unlockExtra 在 Meta.data 上", Meta.data.unlockExtra && Meta.data.unlockExtra.H008 === true);
check("三13 全解锁条件满足 + unlockedHeroes() 最终 = 12 角全开", (() => {
  Meta.data.heroes.H006 = { level: 3 };       // H007 条件
  Meta.data.heroes.H004 = { level: 5 };        // H009 条件
  Meta.data.heroes.H010 = { level: 6 };        // H011 条件
  Meta.data.unlockExtra.H010 = true;           // H010 结晶解锁
  Meta.data.unlockExtra.H012 = true;           // H012 结晶解锁
  return Meta.unlockedHeroes().length === 12;
})());

/* ============ 四、结晶口径回归（20.10：crystalKill 退役 / crystalBoss 重新配平 60 / deathRatio 不变） ============ */
check("四1 CFG.outLevel.crystalKill 配置口径不变（=1，仅存档兼容，逻辑不引用）", CFG.outLevel.crystalKill === 1);
check("四2 CFG.outLevel.crystalBoss 配平值（20.10：=60，与折算源同量级）", CFG.outLevel.crystalBoss === 60);
check("四3 CFG.outLevel.deathRatio 口径不变（=0.3）", CFG.outLevel.deathRatio === 0.3);
Meta.data.crystals = 0;
check("四4 awardRun：999 杀无 BOSS → 0 结晶（小怪击杀退役）", Meta.awardRun(999, false, true) === 0);
check("四5 awardRun：999 杀 + BOSS 撤离 → 仅 crystalBoss（60）", Meta.awardRun(999, true, true) === 60);
check("四6 awardRun：死亡（打过 BOSS）→ floor(60×0.3) = 18", Meta.awardRun(999, true, false) === 18);
check("四7 awardRun：死亡且无 BOSS → 0", Meta.awardRun(999, false, false) === 0);
check("四8 升级扣款 = levelUpCost 动态一致（LV1→2 扣 50）", (() => {
  Meta.data.heroes.H002 = { level: 1 }; Meta.data.crystals = 1000;
  const c = Meta.levelUpCost("H002");
  const pre = outLevelCost("H002");          // 升级前比对（升级后等级已变，花费随曲线变化）
  const r = Meta.levelUp("H002");
  return r && Meta.data.crystals === 1000 - c && c === pre;
})());

console.log(ok ? "ALL PASS" : "HAS FAIL");
if (!ok) process.exit(1);
`;

try {
  vm.runInContext(driver, ctx, { filename: "meta_growth_driver.js" });
} catch (e) {
  console.error("Error:", e && e.stack || e);
  process.exit(1);
}
