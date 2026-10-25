/* ============================================================
 * xgame_save_integration_test.js —— X-GAMe 专项核验（只读）
 * 目标：独立复核/证伪「技能存档未接入宿主持久化闭环」。
 *   逐入口核验 saveTo/loadFrom → Meta.data.skillSystem → Meta.commit → localStorage(SAVE_KEY)
 *   并分别证明「写入对象 / 持久化 / 刷新读取 / 恢复可运行技能」四步各自成立与否。
 * 约束：不伪造桩数据；除 skill-save.js 外不臆造任何 save/asset 接口；
 *       使用真实模块对象（config/core/game/skill-config/skill-save）与真实调用。
 * 运行：node xgame_save_integration_test.js
 * ============================================================ */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---------- 真实可存取的 localStorage（用于检验持久化链路，非空桩） ---------- */
const _store = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
};

/* ---------- 最小 DOM / Canvas 桩（沿用既有套件口径；Meta.load 只读 localStorage） ---------- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { },
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });
global.EventBus = undefined;

/* ---------- 静态调用点扫描（真实文件读取，非人工填写） ---------- */
const JS_DIR = path.join(path.join(__dirname, "..", "..", ".."), "js");
const SKILL_DIR = path.join(JS_DIR, "..", "mods", "jes-skill-crystal", "systems"); // 2026-10-24 mods 归档：技能 js 已迁入 mods
const jsFiles = [...fs.readdirSync(JS_DIR), ...fs.readdirSync(SKILL_DIR)].filter(f => f.endsWith(".js"));
const scan = {
  SkillSaveToken: [],       // "SkillSave" 引用（排除 skill-save.js）
  wrapperFns: [],           // serializeHeroSkills / migrateHeroSkills（排除 skill-save.js）
  saveToCalls: [],          // .saveTo(（排除 skill-save.js）
  loadFromCalls: [],        // .loadFrom(（排除 skill-save.js）
  dataSkillSystemRefs: [],  // Meta/data 上的 skillSystem 读写（排除 skill-save.js）
};
for (const f of jsFiles) {
  if (f === "skill-save.js") continue;
  const abs = path.join([JS_DIR, SKILL_DIR].find(d => fs.existsSync(path.join(d, f))) || JS_DIR, f);
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  lines.forEach((ln, i) => {
    const at = f + ":" + (i + 1);
    if (/\bSkillSave\b/.test(ln)) scan.SkillSaveToken.push(at + "  " + ln.trim());
    if (/\bserializeHeroSkills\b|\bmigrateHeroSkills\b/.test(ln)) scan.wrapperFns.push(at + "  " + ln.trim());
    if (/\.saveTo\s*\(/.test(ln)) scan.saveToCalls.push(at + "  " + ln.trim());
    if (/\.loadFrom\s*\(/.test(ln)) scan.loadFromCalls.push(at + "  " + ln.trim());
    // data.skillSystem —— 注意排除 CFG.skillSystem（配置表，非 Meta 持久化子对象）
    if (/(Meta\.)?data\.skillSystem/.test(ln) && !/CFG\.skillSystem/.test(ln)) scan.dataSkillSystemRefs.push(at + "  " + ln.trim());
  });
}
global.__scan = scan;
/* SkillRuntime 源码片段（供驱动内做「运行时消费口」事实断言；驱动内无 require） */
global.__runtimeSrc = fs.readFileSync(path.join(SKILL_DIR, "skill-runtime.js"), "utf8");

/* ---------- 加载真实模块（加载顺序与 index.html 一致的关键子集） ---------- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-save.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---------- 断言驱动（const Meta/CFG/SkillSave 在 vm 作用域内可见） ---------- */
const driver = `
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("未通过 " + name); }
};
const J = (o) => JSON.stringify(o);
const S = __scan;
const SAVE_KEY_VALUE = "bagrogue_save_v1";

/* ================= 零、基线事实核对 ================= */
check("基线0.1 SAVE_KEY 实为 bagrogue_save_v1（非 bagrouge）", SAVE_KEY === SAVE_KEY_VALUE);
check("基线0.2 Meta.commit 为函数（宿主持久化出口存在）", typeof Meta.commit === "function");
check("基线0.3 SkillSave 四入口齐备 serialize/migrate/saveTo/loadFrom",
  typeof SkillSave.serialize === "function" && typeof SkillSave.migrate === "function" &&
  typeof SkillSave.saveTo === "function" && typeof SkillSave.loadFrom === "function");
check("基线0.4 SkillSave.SCHEMA_VERSION = 2", SkillSave.SCHEMA_VERSION === 2);

/* ================= 一、调用点静态核验（除自身外 0 命中） ================= */
check("一1 js/ 内除 skill-save.js 外 SkillSave 引用 0 处（实测 " + S.SkillSaveToken.length + "）",
  S.SkillSaveToken.length === 0);
check("一2 顶层包装 serializeHeroSkills/migrateHeroSkills 除定义外 0 调用（实测 " + S.wrapperFns.length + "）",
  S.wrapperFns.length === 0);
check("一3 js/ 内除 skill-save.js 外 .saveTo( 调用 0 处（实测 " + S.saveToCalls.length + "）", S.saveToCalls.length === 0);
check("一4 js/ 内除 skill-save.js 外 .loadFrom( 调用 0 处（实测 " + S.loadFromCalls.length + "）", S.loadFromCalls.length === 0);
check("一5 js/ 内除 skill-save.js 外 Meta.data.skillSystem 读写 0 处（实测 " + S.dataSkillSystemRefs.length + "）",
  S.dataSkillSystemRefs.length === 0);

/* ================= 二、写入对象：saveTo 写入子对象并触发宿主持久化 ================= */
let storedBefore = localStorage.getItem(SAVE_KEY);
check("二0 加载期 Meta.load() 后存储为空（无任何技能数据）", storedBefore === null);

const crystalsBefore = Meta.data.crystals, heroesBefore = J(Meta.data.heroes || {});
const cleanState = {
  heroId: "H001", slotCount: 4, groupVersion: 2,
  skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 3, cd: 1.2, cdLeft: 0.4 } },
  crystals: [ { crystalId: "CR_A", level: 1, slot: 0 } ],
};
const r1 = SkillSave.saveTo(Meta, cleanState);
check("二1 真实调用 SkillSave.saveTo(Meta,state) 返回 true", r1 === true);
check("二2 写入对象成立：Meta.data.skillSystem 出现且含 H001 技能",
  !!(Meta.data.skillSystem && Meta.data.skillSystem.heroes && Meta.data.skillSystem.heroes.H001));
check("二3 写入内容含技能等级/冷却与水晶（序列化格式生效）",
  Meta.data.skillSystem.heroes.H001.skills.SK_FIREBALL.level === 3 &&
  Meta.data.skillSystem.heroes.H001.crystals.length === 1);
check("二4 saveTo 不改 Meta 其它字段（crystals/heroes 原样）",
  Meta.data.crystals === crystalsBefore && J(Meta.data.heroes || {}) === heroesBefore);
/* 20.10 修订：saveTo 内部改为调用 meta.commit（宿主持久化）→ 调用后存储即已写入 skillSystem。 */
const storedAfterSave = localStorage.getItem(SAVE_KEY);
check("二5 saveTo 触发持久化：调用后存储即含 skillSystem（实测 " + (storedAfterSave === null ? "存储为空" : "存储已写入") + "）",
  typeof storedAfterSave === "string" && storedAfterSave.indexOf("skillSystem") >= 0);

/* ================= 三、持久化：仅显式 Meta.commit 才落盘 ================= */
Meta.commit();
const rawAfter = localStorage.getItem(SAVE_KEY);
let parsedAfter = null;
try { parsedAfter = JSON.parse(rawAfter); } catch (e) { parsedAfter = null; }
check("三1 Meta.commit 后存储存在（写入 SAVE_KEY）", typeof rawAfter === "string" && rawAfter.length > 0);
check("三2 持久化成立（前提：先 saveTo 再 commit）：落盘 JSON 含 skillSystem.heroes.H001",
  !!(parsedAfter && parsedAfter.skillSystem && parsedAfter.skillSystem.heroes && parsedAfter.skillSystem.heroes.H001));
check("三3 落盘技能等级随存档保留（level=3）",
  !!(parsedAfter && parsedAfter.skillSystem && parsedAfter.skillSystem.heroes.H001.skills.SK_FIREBALL.level === 3));

/* 反面：真实宿主路径（从不调用 saveTo）——commit 落盘不含 skillSystem 键 */
delete Meta.data.skillSystem;
localStorage.removeItem(SAVE_KEY);
Meta.commit();
let parsedHost = null;
try { parsedHost = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { parsedHost = null; }
check("三4 宿主真实路径：无 saveTo 时 commit 落盘不含 skillSystem 键",
  !!(parsedHost && !Object.prototype.hasOwnProperty.call(parsedHost, "skillSystem")));

/* ================= 四、刷新读取：Meta.load 的恢复成立与否 ================= */
/* 4a 正向：存储中确有 skillSystem（模拟「若曾 saveTo+commit」）→ load 可恢复 */
localStorage.setItem(SAVE_KEY, JSON.stringify({
  crystals: 0, heroes: {}, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {},
  skillSystem: { schemaVersion: 2, configVersion: "skill-test", heroes: { H001: { heroId: "H001", skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 3, cd: 1.2, cdLeft: 0 } }, crystals: [ { crystalId: "CR_A", level: 1, slot: 0 } ] } } },
}));
Meta.data = { crystals: 0, heroes: {}, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {} };
Meta.load();
check("四1 刷新读取成立（前提：存储内有数据）：Meta.load 后 skillSystem 恢复",
  !!(Meta.data.skillSystem && Meta.data.skillSystem.heroes.H001));
check("四2 恢复内容可被 loadFrom 深拷贝读出",
  (function () { const s = SkillSave.loadFrom(Meta); return !!(s && s.heroes.H001 && s.heroes.H001.skills.SK_FIREBALL.level === 3); })());

/* 4b 反面：真实宿主存储（无 skillSystem）→ 刷新后技能数据丢失 */
delete Meta.data.skillSystem;   // 宿主从不写入该字段：还原真实宿主内存状态
localStorage.removeItem(SAVE_KEY);
Meta.commit();  // 落盘当前 Meta.data（此刻确无 skillSystem）
Meta.data = { crystals: 0, heroes: {}, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {} };
Meta.load();
check("四3 宿主真实存储（无 skillSystem）刷新后 Meta.data.skillSystem 缺失（技能数据不可恢复）",
  Meta.data.skillSystem === undefined);
check("四4 上述缺失下 loadFrom(Meta) 返回 null（无内容可读）", SkillSave.loadFrom(Meta) === null);

/* ================= 五、恢复可运行技能：有无消费者 ================= */
/* 5a 消费者证据：除 skill-save.js 外，无任何模块读取 Meta.data.skillSystem（见 一5） */
check("五1 无恢复消费者：Meta.data.skillSystem 在宿主侧 0 读取（不成立）", S.dataSkillSystemRefs.length === 0);

/* 5b 载荷形状：saveTo 写出的是「技能状态」（level/cd/crystals），非可运行的编译产物 builds */
const payload = SkillSave.loadFrom(Meta) || SkillSave.serialize(cleanState);
const heroPayload = payload.heroes && payload.heroes.H001;
check("五2 存档载荷为技能状态（含 skills/crystals），不含可运行 builds",
  !!(heroPayload && heroPayload.skills && heroPayload.crystals) && heroPayload.builds === undefined);
/* 5c 运行时消费口：SkillRuntime 读的是 hero.builds / hero.skillState.builds（源码事实） */
const runtimeSrc = __runtimeSrc;
check("五3 运行时消费口为 hero.builds / skillState.builds（源码事实），与存档载荷无接线",
  /hero\.builds/.test(runtimeSrc) && /skillState\.builds/.test(runtimeSrc));
check("五4 全 js 无 SkillSave→SkillRuntime 的恢复/装配调用（除 skill-save.js 外 0）",
  S.saveToCalls.length === 0 && S.loadFromCalls.length === 0 && S.SkillSaveToken.length === 0);

/* ================= 六、入口守卫（真实调用，不抛异常） ================= */
check("六1 saveTo({},state) 返回 false（meta 无 data）", SkillSave.saveTo({}, cleanState) === false);
check("六2 loadFrom({}) 返回 null（meta 无 data）", SkillSave.loadFrom({}) === null);

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
`;

try {
  vm.runInContext(driver, ctx, { filename: "xgame_save_integration_driver.js" });
} catch (e) {
  /* 驱动异常 = 一次失败：打印中文汇总并置失败退出码 */
  console.log("");
  console.log("驱动执行中断：" + (e && e.message));
  console.log("PASS 合计 = 0   失败数 = 1");
  process.exit(1);
}
