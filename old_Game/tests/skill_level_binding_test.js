/* ============================================================================
 * skill_level_binding_test.js —— 「技能等级 = 武器等级」接线回归（W1）
 * ----------------------------------------------------------------------------
 * 背景（真缺口）：新路径技能实例的等级**硬编码为 1**，而规则是
 *   「武器等级 = 技能等级」（合同 §101「技能等级成长来源沿用项目实际路径，先审查，
 *   不额外发明第二套升级经济」→ 项目实际路径 = 局外 `Meta.weaponLv(heroId)`，1~100）。
 * 后果：即使启用能量水晶系统，技能也**永不随武器成长**。
 *
 * 修复后的取级链（三处必须同值）：
 *   ① 注入方 `SkillPlaytest.skillLevelFor(heroId, skillId)` —— 唯一读 `Meta` 的地方，
 *      并**钳制到 `def.levels.length`**（编译器对越界等级按 LEVEL_OVERFLOW 硬失败）；
 *   ② `SupportCompiler.skillLevelOf(state)` —— 纯函数，新装技能继承本英雄已有等级；
 *   ③ `SkillReward._applySkillInstall` / `SupportCompiler.preview(installSkill)` 走 ②。
 *
 * 覆盖：
 *   ① skillLevelOf 纯函数矩阵（排序稳定 / 跳过非法 / 不改入参）
 *   ② skillLevelFor 读 Meta + 越界钳制 + 异常回落
 *   ③ 三处一致性（试装 = 候选模拟 = 落地）
 *   ④ 端到端通电：初始技能等级跟随武器等级且编译通过
 *   ⑤ 回归护栏：无 Meta（无头沙箱）→ 等级 1，等价于接线前行为
 * 注意：PASS 行禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = require("path").join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本 ---------------- */
const FILES = [
  "js/config.js",
  "js/core.js",
  "js/pool.js",
  "js/skill-config.js",
  "js/skill-compiler.js",
  "js/skill-damage.js",
  "js/skill-events.js",
  "js/skill-scheduler.js",
  "js/skill-runtime.js",
  "js/skill-reward.js",
  "js/skill-presenter.js",
  "js/skill-save.js",
  "js/skill-playtest.js",
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {}, warn() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("⓪ 13 个脚本（含接线改动）可无异常装载", !bootThrew && ctx !== null);

const ev = (code) => vm.runInContext(code, ctx);

/* ============================================================
 * ① SupportCompiler.skillLevelOf —— 纯函数矩阵
 * ============================================================ */
console.log("---- ① SupportCompiler.skillLevelOf（纯函数）----");
check("①1 空 state / 无 skills → 1",
  ev("SupportCompiler.skillLevelOf(null)") === 1 &&
  ev("SupportCompiler.skillLevelOf({})") === 1 &&
  ev("SupportCompiler.skillLevelOf({skills:{}})") === 1);
check("①2 单个技能 level=3 → 3",
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{id:'SK_A',level:3}}})") === 3);
check("①3 多技能：按技能 ID 规范排序取第一个有效等级（结果与插入顺序无关）",
  ev("SupportCompiler.skillLevelOf({skills:{SK_B:{level:5},SK_A:{level:2}}})") === 2 &&
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{level:2},SK_B:{level:5}}})") === 2);
check("①4 非法等级（0 / 字符串 / 缺失）被跳过 → 回落 1",
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{level:0}}})") === 1 &&
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{level:'x'}}})") === 1 &&
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{}}})") === 1);
check("①5 跳过非法项、取下一个有效项",
  ev("SupportCompiler.skillLevelOf({skills:{SK_A:{level:0},SK_B:{level:4}}})") === 4);
check("①6 纯函数：不改写入参",
  ev("(function(){var s={skills:{SK_A:{level:3}}};SupportCompiler.skillLevelOf(s);return s.skills.SK_A.level===3;})()") === true);

/* ============================================================
 * ② SkillPlaytest.skillLevelFor —— 读 Meta + 越界钳制
 * ============================================================ */
console.log("---- ② SkillPlaytest.skillLevelFor（Meta 真源 + 钳制）----");
const lvOf = (hid, sid) => ev("SkillPlaytest.skillLevelFor(" + JSON.stringify(hid) + "," + JSON.stringify(sid) + ")");
const setWeaponLv = (n) => { ctx.Meta = { weaponLv: function () { return n; } }; };

check("②1 无 Meta（无头沙箱）→ 1", lvOf("H001", "SK_FIREBALL") === 1);

setWeaponLv(1);
check("②2 武器 LV1 → 1", lvOf("H001", "SK_FIREBALL") === 1);

setWeaponLv(3);
check("②3 武器 LV3 → 3（= 首批 levels 数组长度）", lvOf("H001", "SK_FIREBALL") === 3);

const LMAX = ev("CFG.skillSystem.skillDefs.SK_FIREBALL.levels.length");

setWeaponLv(10);
check("②4 武器 LV10 → 10（22.8 等级表已扩到 " + LMAX + " 级，不再钳到 3）", lvOf("H001", "SK_FIREBALL") === 10);

setWeaponLv(99);
check("②5 武器 LV99 → 99（表内取值，不触发钳制）", lvOf("H001", "SK_FIREBALL") === 99);

setWeaponLv(150);
check("②5b 武器 LV150 → 钳制到等级表长度 " + LMAX + "（越界保护仍然有效）",
  lvOf("H001", "SK_FIREBALL") === LMAX);

setWeaponLv(0);
check("②6 武器 LV0 → 回落 1（不取 0 级）", lvOf("H001", "SK_FIREBALL") === 1);
setWeaponLv(-5);
check("②7 武器 LV 负数 → 回落 1", lvOf("H001", "SK_FIREBALL") === 1);

setWeaponLv(2);
check("②8 未知技能 id（无 def）→ 钳制到 1（不抛错）", lvOf("H001", "SK_NOT_EXIST") === 1);

setWeaponLv(3);
check("②9 另一技能 SK_SHOCKWAVE 同样跟随武器等级", lvOf("H002", "SK_SHOCKWAVE") === 3);

ctx.Meta = { weaponLv: function () { throw new Error("boom"); } };
check("②10 Meta.weaponLv 抛异常 → 回落 1（绝不影响通电）", lvOf("H001", "SK_FIREBALL") === 1);
setWeaponLv(3);

check("②11 与水晶槽位无关：等级只看武器等级与技能定义",
  lvOf("H007", "SK_FIREBALL") === 3);

/* ============================================================
 * ③ 三处一致性：编译试装 / 候选组合模拟 / 落地
 * ============================================================ */
console.log("---- ③ 三处一致性（试装 = 候选模拟 = 落地）----");
ev("var S3 = {heroId:'H001',slotCount:4,groupVersion:1," +
   "skills:{SK_FIREBALL:{id:'SK_FIREBALL',level:3}},crystals:[],definitions:CFG.skillSystem};");
check("③1 试装 preview(installSkill)：新技能继承等级 3",
  ev("(function(){var r=SupportCompiler.preview(S3,{kind:'installSkill',skillId:'SK_SHOCKWAVE',definitions:CFG.skillSystem});return r.nextGroup.skills.SK_SHOCKWAVE.level;})()") === 3);
check("③2 试装判定合法（legal = true）",
  ev("(function(){var r=SupportCompiler.preview(S3,{kind:'installSkill',skillId:'SK_SHOCKWAVE',definitions:CFG.skillSystem});return r.legal===true;})()") === true);
check("③3 候选组合模拟 SkillReward._applySkillInstall：同等级 3",
  ev("(function(){var s=SkillReward._applySkillInstall(S3,'SK_SHOCKWAVE');return s.skills.SK_SHOCKWAVE.level;})()") === 3);
check("③4 落地侧 SupportCompiler.skillLevelOf：同等级 3",
  ev("SupportCompiler.skillLevelOf(S3)") === 3);
check("③5 英雄尚无技能时试装 → 回落 1（等价接线前）",
  ev("(function(){var s={heroId:'H001',slotCount:4,groupVersion:1,skills:{},crystals:[],definitions:CFG.skillSystem};" +
     "var r=SupportCompiler.preview(s,{kind:'installSkill',skillId:'SK_SHOCKWAVE',definitions:CFG.skillSystem});return r.nextGroup.skills.SK_SHOCKWAVE.level;})()") === 1);

/* ============================================================
 * ④ 端到端：通电后初始技能等级跟随武器等级且编译通过
 * ============================================================ */
console.log("---- ④ 端到端通电（?skill=H001）----");
setWeaponLv(3);
ev("SkillPlaytest.reset(); SkillPlaytest.install('?skill=H001');" +
   "var H4 = { id:'H001' }; var ST4 = SkillPlaytest.ensureState(H4);");
check("④1 初始技能 SK_FIREBALL 等级 = 武器等级 3",
  ev("ST4 && ST4.skills.SK_FIREBALL.level") === 3);
check("④2 编译通过（builds.SK_FIREBALL 存在）",
  ev("!!(ST4 && ST4.builds && ST4.builds.SK_FIREBALL)") === true);
check("④3 用同状态再编译仍 ok（无 LEVEL_OVERFLOW 诊断）",
  ev("(function(){var r=SupportCompiler.compile({heroId:'H001',state:{heroId:'H001',slotCount:ST4.slotCount," +
     "groupVersion:1,skills:ST4.skills,crystals:ST4.crystals},definitions:CFG.skillSystem});return r.ok===true;})()") === true);

setWeaponLv(88);
ev("SkillPlaytest.reset(); SkillPlaytest.install('?skill=H001');" +
   "var H5 = { id:'H001' }; var ST5 = SkillPlaytest.ensureState(H5);");
check("④4 武器 LV88 → 技能取 88 且通电成功（等级表已扩到 100 级）",
  ev("(ST5 && ST5.skills.SK_FIREBALL.level)") === 88 &&
  ev("!!(ST5 && ST5.builds && ST5.builds.SK_FIREBALL)") === true);

/* ============================================================
 * ⑤ 回归护栏：无 Meta → 等级 1（等价接线前）
 * ============================================================ */
console.log("---- ⑤ 回归护栏（无 Meta = 接线前行为）----");
delete ctx.Meta;
check("⑤1 无 Meta：skillLevelFor → 1", lvOf("H001", "SK_FIREBALL") === 1);
ev("SkillPlaytest.reset(); SkillPlaytest.install('?skill=H001');" +
   "var H6 = { id:'H001' }; var ST6 = SkillPlaytest.ensureState(H6);");
check("⑤2 无 Meta：通电仍成功且初始技能等级 = 1",
  ev("!!(ST6 && ST6.builds && ST6.builds.SK_FIREBALL)") === true &&
  ev("ST6 && ST6.skills.SK_FIREBALL.level") === 1);
ev("SkillPlaytest.reset();");

console.log("----------------------------------------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
console.log("SKILL LEVEL BINDING TEST OK");
process.exit(failCount ? 1 : 0);
