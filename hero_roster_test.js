/* 无头测试：线 A —— 英雄 12 角铺量（node hero_roster_test.js）
 * 覆盖：12 英雄字段齐全 / 4 新武器结构 + 技能引用 / unlockOrder 12 项一致无重复 /
 *       unlockRules H007~H012 类型被 Meta.isHeroUnlocked 支持（实测条件达成前后）/
 *       新英雄同定位数值带（≤15% 偏差）/ byHero 12 角映射 / H001~H008 数值回归。 */
"use strict";

/* ---- DOM / Canvas 桩（与 meta_growth_test 相同的最小桩；Meta 顶层 load() 即读存档，桩必须先就位） ---- */
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
for (const f of ["js/config.js", "js/core.js", "js/game.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---- 断言都在 driver 内跑（const CFG 等在 vm 作用域，driver 可访问；主进程拿不到） ---- */
const driver = `
let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

const HERO_FIELDS = ["id", "name", "desc", "sprite", "hp", "def", "atk", "energyMax", "energyRegen", "spd", "radius", "weapon", "summonMax", "trapMax"];

/* ============ 一、12 英雄全部存在、字段齐全无 undefined（逐字段断言） ============ */
const ids = CFG.heroes.map(h => h.id);
check("一1 CFG.heroes 恰 12 个", CFG.heroes.length === 12);
/* 21.6：物理顺序保持 H001~H012（heroes[i] 索引是全库隐性契约，重排会让技能解析错位——真机回归教训） */
check("一2 id 序列 = H001~H012 且无重复", ids.join() === "H001,H002,H003,H004,H005,H006,H007,H008,H009,H010,H011,H012" && new Set(ids).size === 12);
/* 21.6 新契约：选人界面展示顺序 = heroDisplayOrder 组合后 4 轮「输出→防御→治疗」循环，类内 id 升序轮转 */
{
  const role = CFG.heroRoles.byHero;
  const byId = {}; for (const h of CFG.heroes) byId[h.id] = h;
  const disp = CFG.heroDisplayOrder.map(id => byId[id]);
  check("一2a heroDisplayOrder 恰含 12 角无重复", disp.length === 12 && new Set(disp.map(h => h.id)).size === 12);
  const rounds = [0, 1, 2, 3].map(r => disp.slice(r * 3, r * 3 + 3).map(h => role[h.id]));
  check("一2b 展示顺序 4 轮循环（输出→防御→治疗）",
    rounds.every(r4 => r4[0] === "output" && r4[1] === "defense" && r4[2] === "recovery"));
  const idsByRole = { output: [], defense: [], recovery: [] };
  for (const h of disp) idsByRole[role[h.id]].push(h.id);
  check("一2c 输出类内 id 升序（H001,H002,H003,H006）", idsByRole.output.join() === "H001,H002,H003,H006");
  check("一2d 防御类内 id 升序（H004,H005,H008,H009）", idsByRole.defense.join() === "H004,H005,H008,H009");
  check("一2e 治疗类内 id 升序（H007,H010,H011,H012）", idsByRole.recovery.join() === "H007,H010,H011,H012");
  check("一2f 物理首角仍 H001（默认队长契约）", CFG.heroes[0].id === "H001");
  check("一2g unlockOrder 首发逻辑不受影响（前 6 = H001~H006）",
    CFG.unlockOrder.slice(0, CFG.starterCount).join() === "H001,H002,H003,H004,H005,H006");
}
CFG.heroes.forEach(h => {
  const missing = HERO_FIELDS.filter(f => h[f] === undefined || h[f] === null || h[f] === "");
  check("一3 " + h.id + " 字段齐全（缺：" + (missing.join(",") || "无") + "）", missing.length === 0);
  check("一4 " + h.id + " 数值字段为正数（hp/atk/def/spd/radius）",
    h.hp > 0 && h.atk > 0 && h.def > 0 && h.spd > 0 && h.radius > 0 && h.energyMax > 0 && h.energyRegen > 0);
  check("一5 " + h.id + " sprite 引用 ASSET_MANIFEST 有效键", !!ASSET_MANIFEST[h.sprite]);
  check("一6 " + h.id + " desc 为非空中文描述", typeof h.desc === "string" && h.desc.length >= 6);
});

/* ============ 二、4 把新武器存在、结构合法、技能引用在 CFG.skills 中存在 ============ */
["W009", "W010", "W011", "W012"].forEach(wid => {
  const w = CFG.weapons[wid];
  check("二1 " + wid + " 存在且结构合法（id/name/desc/tags/skills）",
    !!w && w.id === wid && typeof w.name === "string" && typeof w.desc === "string"
    && Array.isArray(w.tags) && w.skills && typeof w.skills === "object");
  check("二2 " + wid + " skills.basic 引用 CFG.skills 存在", !!w && !!CFG.skills[w.skills.basic]);
  check("二3 " + wid + " skills.skill 引用 CFG.skills 存在（主动技能）", !!w && !!CFG.skills[w.skills.skill]);
  const sk = w && CFG.skills[w.skills.skill];
  check("二4 " + wid + " 主动技能带伤害（dmgMul > 0）", !!sk && typeof sk.dmgMul === "number" && sk.dmgMul > 0);
});
check("二5 每英雄 weapon 指向本人对应新武器（H009~H012）",
  CFG.heroes.find(h => h.id === "H009").weapon === "W009" && CFG.heroes.find(h => h.id === "H010").weapon === "W010"
  && CFG.heroes.find(h => h.id === "H011").weapon === "W011" && CFG.heroes.find(h => h.id === "H012").weapon === "W012");
check("二6 全部 12 英雄的武器都在 CFG.weapons 中存在",
  CFG.heroes.every(h => !!CFG.weapons[h.weapon]));

/* ============ 三、unlockOrder 恰 12 项且与 heroes id 集合一致、无重复 ============ */
check("三1 unlockOrder 恰 12 项", Array.isArray(CFG.unlockOrder) && CFG.unlockOrder.length === 12);
check("三2 unlockOrder 无重复", new Set(CFG.unlockOrder).size === CFG.unlockOrder.length);
/* 21.6：unlockOrder（解锁链序）独立于展示序（输出/防御/治疗循环），物理序恢复后仍同序 */
check("三3 unlockOrder 与 heroes id 序列一致（同序）", CFG.unlockOrder.join() === ids.join());
check("三4 starterCount = 6（首发 6 角不变）", CFG.starterCount === 6);

/* ============ 四、unlockRules：H007~H012 全有条目，且条件类型被 isHeroUnlocked 支持（实测） ============ */
const heroLvPassed = new Set(["H007", "H009", "H011"]);   // 配置为 heroLv 条件的英雄
const crystalPassed = new Set(["H008", "H010", "H012"]);  // 配置为 crystal 条件的英雄

["H007", "H008", "H009", "H010", "H011", "H012"].forEach(id => {
  const rule = CFG.unlockRules[id];
  check("四0 " + id + " unlockRules 有条目", !!rule);
  const isHeroLv = !!(rule && rule.heroLv);
  const isCrystal = !!(rule && typeof rule.crystal === "number");
  // 只允许 isHeroUnlocked 已支持的两种条件类型（不造新机制）
  check("四1 " + id + " 条件类型为 heroLv 或 crystal（不造新类型）", isHeroLv !== isCrystal);
  check("四2 " + id + " 条件类型与设计分配一致",
    (heroLvPassed.has(id) && isHeroLv) || (crystalPassed.has(id) && isCrystal));
  check("四3 " + id + " rule 带中文 desc", typeof rule.desc === "string" && rule.desc.length > 0);
});

/* ---- 实测：heroLv 条件（达成 / 未达成） ---- */
["H007", "H009", "H011"].forEach(id => {
  const cond = CFG.unlockRules[id].heroLv;
  delete Meta.data.unlockExtra[id];
  Meta.data.heroes[cond.heroId] = { level: cond.lv - 1 };
  check("四4 " + id + " heroLv 未达标（" + cond.heroId + " LV" + (cond.lv - 1) + " < " + cond.lv + "）→ 未解锁", !Meta.isHeroUnlocked(id));
  Meta.data.heroes[cond.heroId] = { level: cond.lv };
  check("四5 " + id + " heroLv 达标（" + cond.heroId + " ≥ LV" + cond.lv + "）→ 自动解锁", Meta.isHeroUnlocked(id));
  delete Meta.data.heroes[cond.heroId];
  check("四6 " + id + " 条件回退后重新未解锁（查询式无残留）", !Meta.isHeroUnlocked(id));
});

/* ---- 实测：crystal 条件（结晶不足 / 足够主动解锁） ---- */
["H008", "H010", "H012"].forEach(id => {
  const need = CFG.unlockRules[id].crystal;
  delete Meta.data.unlockExtra[id];
  Meta.data.crystals = need - 1;
  check("四7 " + id + " 结晶不足（" + (need - 1) + " < " + need + "）→ unlockHero 失败且未解锁",
    !Meta.unlockHero(id) && !Meta.isHeroUnlocked(id));
  Meta.data.crystals = need;
  check("四8 " + id + " 结晶足够 → unlockHero 成功扣款 + 落档解锁",
    Meta.unlockHero(id) && Meta.data.crystals === 0 && Meta.isHeroUnlocked(id));
  check("四9 " + id + " unlockHero 幂等（已解锁再调不重复扣款）",
    (() => { Meta.data.crystals = 50; const r = Meta.unlockHero(id); return r === true && Meta.data.crystals === 50; })());
  delete Meta.data.unlockExtra[id];
});

/* ============ 五、新英雄与同定位旧英雄数值带对比（≤15% 偏差） ============ */
/* 数值带 = 同定位现有旧英雄（H001~H008）的 [min×0.85, max×1.15]；新角每项落在带内即视为同带。 */
const OLD_IDS = ids.filter(id => id <= "H008");
const STAT_KEYS = ["hp", "atk", "def", "energyMax", "spd"];
function bandOf(role) {
  const peers = CFG.heroes.filter(h => h.id <= "H008" && CFG.heroRoles.byHero[h.id] === role);
  return peers;
}
["H009", "H010", "H011", "H012"].forEach(id => {
  const h = CFG.heroes.find(x => x.id === id);
  const role = CFG.heroRoles.byHero[id];
  const peers = bandOf(role);
  check("五0 " + id + " 同定位（" + role + "）存在旧英雄参照", peers.length > 0);
  STAT_KEYS.forEach(k => {
    const vals = peers.map(p => p[k]);
    const lo = Math.min.apply(null, vals) * 0.85, hi = Math.max.apply(null, vals) * 1.15;
    check("五1 " + id + "." + k + " = " + h[k] + " 落在 " + role + " 带 [" + lo.toFixed(1) + "," + hi.toFixed(1) + "]",
      h[k] >= lo && h[k] <= hi);
  });
});
check("五2 三定位分布：output/defense/recovery 齐全且新角补稀缺 recovery",
  (() => { const got = new Set(ids.map(id => CFG.heroRoles.byHero[id])); return got.has("output") && got.has("defense") && got.has("recovery"); })());
check("五3 新角 3 为 recovery / 1 为 defense（补稀缺定位）",
  CFG.heroRoles.byHero.H010 === "recovery" && CFG.heroRoles.byHero.H011 === "recovery" && CFG.heroRoles.byHero.H012 === "recovery"
  && CFG.heroRoles.byHero.H009 === "defense");

/* ============ 六、定位映射 byHero 对 12 角全有条目 ============ */
check("六1 byHero 恰 12 条", Object.keys(CFG.heroRoles.byHero).length === 12);
check("六2 byHero 覆盖全部英雄 id", CFG.heroes.every(h => !!CFG.heroRoles.byHero[h.id]));
check("六3 byHero 取值均为合法定位",
  CFG.heroes.every(h => ["output", "defense", "recovery"].indexOf(CFG.heroRoles.byHero[h.id]) >= 0));

/* ============ 七、回归：H001~H008 数值与既有口径不变 ============ */
/* ⚠️ 这些数值是 smoke/exp/meta_growth 等既有测试锁定的平衡基线，改动会破坏其它线。 */
const BASE = {
  H001: { hp: 100, def: 2, atk: 14, energyMax: 100, spd: 300, weapon: "W001" },
  H002: { hp: 110, def: 3, atk: 8, energyMax: 100, spd: 290, weapon: "W002" },
  H003: { hp: 90, def: 1, atk: 16, energyMax: 100, spd: 295, weapon: "W003" },
  H004: { hp: 95, def: 2, atk: 11, energyMax: 110, spd: 305, weapon: "W004" },
  H005: { hp: 85, def: 1, atk: 7, energyMax: 100, spd: 330, weapon: "W005" },
  H006: { hp: 120, def: 4, atk: 26, energyMax: 120, spd: 265, weapon: "W006" },
  H007: { hp: 90, def: 1, atk: 12, energyMax: 120, spd: 300, weapon: "W007" },
  H008: { hp: 95, def: 2, atk: 15, energyMax: 110, spd: 295, weapon: "W008" },
};
Object.keys(BASE).forEach(id => {
  const h = CFG.heroes.find(x => x.id === id), b = BASE[id];
  check("七1 " + id + " 基础数值不变（hp/def/atk/energyMax/spd/weapon）",
    !!h && h.hp === b.hp && h.def === b.def && h.atk === b.atk && h.energyMax === b.energyMax && h.spd === b.spd && h.weapon === b.weapon);
});
check("七2 H001~H008 武器表 W001~W008 技能绑定不变",
  CFG.weapons.W001.skills.skill === "AT102" && CFG.weapons.W002.skills.skill === "AT104"
  && CFG.weapons.W003.skills.skill === "AT106" && CFG.weapons.W004.skills.skill === "AT108"
  && CFG.weapons.W005.skills.skill === "AT110" && CFG.weapons.W006.skills.skill === "AT112"
  && CFG.weapons.W007.skills.skill === "AT113" && CFG.weapons.W008.skills.skill === "AT114");
check("七3 H007/H008 解锁规则口径不变（H006 LV3 / 300 结晶）",
  CFG.unlockRules.H007.heroLv.heroId === "H006" && CFG.unlockRules.H007.heroLv.lv === 3 && CFG.unlockRules.H008.crystal === 300);
check("七4 定位基线不变（H001~H008 定位映射）",
  CFG.heroRoles.byHero.H001 === "output" && CFG.heroRoles.byHero.H004 === "defense"
  && CFG.heroRoles.byHero.H007 === "recovery" && CFG.heroRoles.byHero.H008 === "defense");

console.log(ok ? "ALL PASS" : "HAS FAIL");
if (!ok) process.exit(1);
`;

try {
  vm.runInContext(driver, ctx, { filename: "hero_roster_driver.js" });
} catch (e) {
  console.error("Error:", e && e.stack || e);
  process.exit(1);
}
