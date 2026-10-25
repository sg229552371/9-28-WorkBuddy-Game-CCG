/* ============================================================
 * xgame_skill_save_wire_test.js —— 技能存档持久化接线核验
 * 目的：验证「先把局外装配写进宿主存档、再真正落盘」这条接线成立。
 *
 * 口径（用户已裁决）：局内技能**不跨局保留** ——
 *   · 局内战斗态（冷却 / 前摇 / 效果实例）**不落盘**；
 *   · 需持久化的是**局外装配**（哪个英雄装了哪些水晶/技能 = 装配快照）；
 *   · 载荷里的 cdLeft 属战斗态，恢复时视为非权威（由恢复方归零，本测试不改 serializer）。
 *
 * 方法：node vm 按 index.html 脚本顺序加载 js 关键子集；
 *   使用**真实 SkillSave 模块对象** + **忠实镜像「建议 hook」的宿主桩**（含 data / commit，
 *   commit 落 SAVE_KEY = bagrogue_save_v1，与 game.js 的 Meta 同形）。
 * 四步验证：①写入对象 ②持久化 ③刷新读取 ④恢复可运行技能（证据 / 形态缺口）。
 *
 * 约束：不伪造桩数据、不放宽断言、不以空数组恒真；PASS 文案不含英文 error/FAIL。
 * 运行：node xgame_skill_save_wire_test.js
 * ============================================================ */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const JS_DIR = path.join(path.join(__dirname, "..", "..", ".."), "js");
const SKILL_DIR = path.join(JS_DIR, "..", "mods", "jes-skill-crystal", "systems"); // 2026-10-24 mods 归档：技能 js 已迁入 mods
const SAVE_KEY_VALUE = "bagrogue_save_v1";

/* ---------- 真实可存取的 localStorage（供宿主桩 commit 落盘，非空桩） ---------- */
const _store = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
};

/* ---------- 最小 DOM / Canvas 桩（沿用既有 xgame_*_test 口径） ---------- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { },
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });

/* ---------- 忠实镜像「建议 hook」的宿主桩 ----------
 * 镜像 game.js 的 Meta：SAVE_KEY 不变、data 默认字段同形、commit = 落盘 JSON。
 * commit 计数（__hostStats.commits）供「持久化」步断言。 */
global.__hostStats = { commits: 0 };
global.Meta = {
  data: { crystals: 7, heroes: { H001: { level: 2, weaponLv: 3 } }, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {} },
  load() { try { const raw = localStorage.getItem(SAVE_KEY_VALUE); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* 无存储则用默认值 */ } },
  commit() { global.__hostStats.commits++; localStorage.setItem(SAVE_KEY_VALUE, JSON.stringify(this.data)); },
};

/* ---------- 供 vm 驱动读取的宿主侧常量 / 源码事实（在 Node 侧读取，驱动内无 require） ---------- */
global.__SAVE_KEY = SAVE_KEY_VALUE;
global.__runtimeSrc = fs.readFileSync(path.join(SKILL_DIR, "skill-runtime.js"), "utf8");
/* 静态接线扫描：js/ 与 mods 技能系统目录内除 skill-save.js 外是否出现 SkillSave（真实文件读取，非人工填写） */
{
  const hits = [];
  for (const dir of [JS_DIR, SKILL_DIR]) for (const f of fs.readdirSync(dir).filter(n => n.endsWith(".js"))) {
    if (f === "skill-save.js") continue;
    const lines = fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/);
    lines.forEach((ln, i) => { if (/\bSkillSave\b/.test(ln)) hits.push(f + ":" + (i + 1)); });
  }
  global.__wireHits = hits;
}

/* ---------- 加载真实模块（index.html 顺序的关键子集：#1 → #2 → #23 → #24 → #31） ---------- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-compiler.js", "mods/jes-skill-crystal/systems/skill-save.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---------- 断言驱动（const SkillSave / CFG / SupportCompiler / Meta 在 vm 作用域内可见） ---------- */
const driver = `
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("未通过 " + name); }
};
const J = (o) => JSON.stringify(o);
const SAVE_KEY = __SAVE_KEY;

/* ================= 基线：真实模块对象到位 ================= */
check("基线 SkillSave 为真实模块对象且四入口齐备",
  typeof SkillSave === "object" && typeof SkillSave.serialize === "function" &&
  typeof SkillSave.saveTo === "function" && typeof SkillSave.loadFrom === "function");
check("基线 宿主桩 commit 为函数（可落盘）", typeof Meta.commit === "function");

/* 局外装配样本（= 英雄 skillState 的装配快照：技能等级 + 水晶；不含 builds） */
const ASSEMBLY = {
  heroId: "H001", slotCount: 4, groupVersion: 3,
  skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 2 } },
  crystals: [
    { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
    { crystalId: "CR_PIERCE", level: 1, slot: 1 },
    { crystalId: "CR_HOMING", level: 1, slot: 2 },
    { crystalId: "CR_MULTISHOT", level: 1, slot: 3 },
  ],
};

/* ================= 一、写入对象（saveTo → Meta.data.skillSystem） ================= */
const otherBefore = { crystals: Meta.data.crystals, heroes: J(Meta.data.heroes || {}) };
const r1 = SkillSave.saveTo(Meta, ASSEMBLY);
check("写入-1 真实 SkillSave.saveTo(Meta, 装配) 返回 true", r1 === true);
check("写入-2 Meta.data.skillSystem 被写入", !!(Meta.data.skillSystem && Meta.data.skillSystem.heroes));
check("写入-3 写入对象为 H001 装配（含 SK_FIREBALL 与 4 颗水晶）",
  !!(Meta.data.skillSystem.heroes.H001 &&
     Meta.data.skillSystem.heroes.H001.skills.SK_FIREBALL && Meta.data.skillSystem.heroes.H001.skills.SK_FIREBALL.level === 2 &&
     Meta.data.skillSystem.heroes.H001.crystals.length === 4));
check("写入-4 载荷含 schemaVersion/configVersion 版本头",
  typeof Meta.data.skillSystem.schemaVersion === "number" && ("configVersion" in Meta.data.skillSystem));
check("写入-5 saveTo 不改 Meta 其它字段（crystals/heroes 原样）",
  Meta.data.crystals === otherBefore.crystals && J(Meta.data.heroes || {}) === otherBefore.heroes);

/* ================= 二、持久化（saveTo 触发宿主 commit → 落 SAVE_KEY） ================= */
const commitsBefore = __hostStats.commits;
const r2 = SkillSave.saveTo(Meta, ASSEMBLY);
check("持久化-1 saveTo 后宿主 commit 被调用（计数增量 = " + (__hostStats.commits - commitsBefore) + "）",
  __hostStats.commits === commitsBefore + 1);
const raw = localStorage.getItem(SAVE_KEY);
let parsed = null;
try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
check("持久化-2 落盘内容存在（写入 SAVE_KEY = " + SAVE_KEY + "）", typeof raw === "string" && raw.length > 0);
check("持久化-3 落盘 JSON 含 skillSystem.heroes.H001（真正写盘，非仅内存）",
  !!(parsed && parsed.skillSystem && parsed.skillSystem.heroes && parsed.skillSystem.heroes.H001));
check("持久化-4 落盘技能等级随存档保留（level = 2）",
  !!(parsed && parsed.skillSystem.heroes.H001.skills.SK_FIREBALL.level === 2));
check("持久化-5 落盘水晶装配完整（4 颗）",
  !!(parsed && parsed.skillSystem.heroes.H001.crystals.length === 4));

/* 容错 A：无 commit 的桩（无头环境）→ 仍写内存且返回 true，不抛 */
const noCommitMeta = { data: {} };
let noCommitOk = null;
try { noCommitOk = SkillSave.saveTo(noCommitMeta, ASSEMBLY); } catch (e) { noCommitOk = "threw"; }
check("持久化-6 无 commit 桩：saveTo 容错返回 true 且写入内存",
  noCommitOk === true && !!(noCommitMeta.data.skillSystem && noCommitMeta.data.skillSystem.heroes.H001));

/* 容错 B：commit 抛异常 → saveTo 返回 false（明确布尔），内存写入已发生且不向外抛 */
const throwMeta = { data: {}, commit() { throw new Error("persist-fail"); } };
let throwOk = null;
try { throwOk = SkillSave.saveTo(throwMeta, ASSEMBLY); } catch (e) { throwOk = "threw"; }
check("持久化-7 commit 抛异常：saveTo 返回 false 且不向外抛，内存写入仍在",
  throwOk === false && !!(throwMeta.data.skillSystem && throwMeta.data.skillSystem.heroes.H001));

/* ================= 三、刷新读取（loadFrom 深拷贝 + 新会话重载） ================= */
const a = SkillSave.loadFrom(Meta);
check("读取-1 loadFrom 取回含 H001 技能等级（level = 2）",
  !!(a && a.heroes && a.heroes.H001 && a.heroes.H001.skills.SK_FIREBALL.level === 2));
a.heroes.H001.crystals[0].level = 99;
check("读取-2 深拷贝成立：改返回值不污染源（源仍为 1）",
  Meta.data.skillSystem.heroes.H001.crystals[0].level === 1);

/* 模拟刷新：新会话（data 为空）→ load() 从 SAVE_KEY 重载 → loadFrom 复得 */
const fresh = {
  data: { crystals: 0, heroes: {}, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {} },
  load() { try { const r = localStorage.getItem(SAVE_KEY); if (r) Object.assign(this.data, JSON.parse(r)); } catch (e) { /* 空存储忽略 */ } },
};
fresh.load();
const b = SkillSave.loadFrom(fresh);
check("读取-3 刷新后（新会话 load）loadFrom 复得技能装配（level = 2）",
  !!(b && b.heroes && b.heroes.H001 && b.heroes.H001.skills.SK_FIREBALL.level === 2));
check("读取-4 刷新后水晶装配完整（4 颗）", !!(b && b.heroes.H001.crystals.length === 4));

/* ================= 四、恢复可运行技能（证据 / 形态缺口） ================= */
/* 4a 载荷形态：落盘的是「装配状态」，不含编译产物 builds —— 而运行时消费口是 builds */
check("恢复-1 载荷为装配状态（skills/crystals）且不含可运行 builds",
  !!(b && b.heroes.H001.skills && b.heroes.H001.crystals) && b.heroes.H001.builds === undefined);
/* 4b 运行时消费口（源码事实）：SkillRuntime 读 hero.skillState.builds */
check("恢复-2 运行时消费口为 skillState.builds（skill-runtime.js 源码事实）",
  /skillState\\.builds/.test(__runtimeSrc));
/* 4c 可编译证据：用真实编译器 + 真实 CFG.skillSystem 把「从存档取回的装配」编成可运行 builds */
let cmp = null;
try { cmp = SupportCompiler.compile({ heroId: "H001", state: b.heroes.H001, definitions: CFG.skillSystem }); }
catch (e) { cmp = null; }
check("恢复-3 真实 SupportCompiler 可由存档装配编出 builds（ok = true）", !!(cmp && cmp.ok === true && cmp.builds));
check("恢复-4 编出的 builds 含 SK_FIREBALL（可运行技能单元）", !!(cmp && cmp.builds && cmp.builds.SK_FIREBALL));
/* 4d 形态缺口（本轮事实）：js/ 内除 skill-save.js 外无 SkillSave 接线 → 无 loadFrom→skillState 的自动恢复 */
check("恢复-5 形态缺口（本轮）：js/ 内除 skill-save.js 外 SkillSave 接线 0 处（实测 " + __wireHits.length + "）",
  __wireHits.length === 0);

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
`;

try {
  vm.runInContext(driver, ctx, { filename: "xgame_skill_save_wire_driver.js" });
} catch (e) {
  /* 驱动异常 = 一次失败：打印中文汇总并置失败退出码 */
  console.log("");
  console.log("驱动执行中断：" + (e && e.message));
  console.log("PASS 合计 = 0   失败数 = 1");
  process.exit(1);
}
