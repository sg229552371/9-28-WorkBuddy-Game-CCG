/* ============================================================
 * skill_save_session_test.js —— 守卫测试：技能构筑「不跨局保存（每局重置）」
 * ----------------------------------------------------------------------------
 * 口径真源：决策 D013 / G_docs/decision_log_v1.md
 *           G_docs/game_design_proposal.md §20.10 存档
 *           G_docs/skill_system_master_v1.md §3.10
 *   技能 / 水晶**实例不跨局保存** —— 每局开局从零重建（武器绑定的初始技能 + 本局
 *   获得的水晶）；撤离成功 / 死亡后**不写入局外 Meta**；`SkillSave` 只服务局内快照 /
 *   迁移报告 / 幂等补偿。
 *
 * 本文件是**守卫**：现状已是局内（见报告实测），本测试锁死该事实，防止未来有人
 * 把技能 / 水晶接上跨局持久化（例如让局开局 loadFrom(Meta) 恢复、或结算时 saveTo）。
 *
 * 方法：node vm 按 index.html 顺序加载**真实脚本链**（config/core/pool/game/items/
 *   combat/modes/skill-*），使用**真实** G / Meta / Player / SkillSave / SkillRuntime /
 *   SkillPlaytest —— 无合成契约桩、无恒真 / 空真断言；凡 `every` 前先断言长度 > 0。
 *   「局开始重建」用**真实** `SkillRuntime.ownsHero(hero)` 触发真实懒注入；
 *   「局结束」用**真实** `Meta.awardRun / setFlag / commit`（撤离成功 + 死亡两种）。
 *
 * 约束：PASS 文案禁用英文 error / FAIL（门禁 grep -ci 误判）；文本一律 LF。
 * 运行：node skill_save_session_test.js
 * ============================================================ */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const JS_DIR = path.join(__dirname, "js");
const SAVE_KEY_VALUE = "bagrogue_save_v1";

/* ---------- 真实可存取的 localStorage（供 Meta.commit 落盘，非空桩） ---------- */
const _store = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
};
global.__SAVE_KEY = SAVE_KEY_VALUE;

/* ---------- 最小 DOM / Canvas 桩（沿用既有 xgame_*_test 口径；真实 Meta.load 只读 localStorage） ---------- */
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { },
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });
global.EventBus = undefined;

/* ---------- 静态扫描（真实文件读取，非人工填写）：证明无「技能/水晶→局外」接线 ---------- */
const scan = {
  skillSaveToken: [],   // "SkillSave" 引用（排除 skill-save.js）
  saveToCalls: [],      // .saveTo( 调用（排除 skill-save.js）
  loadFromCalls: [],    // .loadFrom( 调用（排除 skill-save.js）
  dataSkillSystem: [],  // Meta/data 上的 skillSystem 读写（排除 skill-save.js；排除 CFG.skillSystem）
};
for (const f of fs.readdirSync(JS_DIR).filter(n => n.endsWith(".js"))) {
  if (f === "skill-save.js") continue;
  const lines = fs.readFileSync(path.join(JS_DIR, f), "utf8").split(/\r?\n/);
  lines.forEach((ln, i) => {
    const at = f + ":" + (i + 1);
    if (/\bSkillSave\b/.test(ln)) scan.skillSaveToken.push(at);
    if (/\.saveTo\s*\(/.test(ln)) scan.saveToCalls.push(at);
    if (/\.loadFrom\s*\(/.test(ln)) scan.loadFromCalls.push(at);
    if (/(Meta\.)?data\.skillSystem/.test(ln) && !/CFG\.skillSystem/.test(ln)) scan.dataSkillSystem.push(at);
  });
}
global.__scan = scan;
/* skill-save.js 内写 Meta.data.skillSystem 的赋值行数（证明「唯一写入口」；真实文件读取） */
global.__skillSaveSrc = fs.readFileSync(path.join(JS_DIR, "skill-save.js"), "utf8");
/* 源码事实：整合层（skill-playtest.js）+ 结算宿主（main.js） */
global.__playtestSrc = fs.readFileSync(path.join(JS_DIR, "skill-playtest.js"), "utf8");
global.__mainSrc = fs.readFileSync(path.join(JS_DIR, "main.js"), "utf8");
global.__indexSrc = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

/* ---------- 加载真实脚本链（顺序与 index.html 一致的关键子集 + 结算所在 modes.js） ---------- */
const FILES = [
  "js/config.js", "js/core.js", "js/pool.js", "js/game.js",
  "js/items.js", "js/combat.js", "js/modes.js",
  "js/skill-config.js", "js/skill-compiler.js", "js/skill-damage.js", "js/skill-events.js",
  "js/skill-scheduler.js", "js/skill-runtime.js", "js/skill-reward.js", "js/skill-presenter.js",
  "js/skill-save.js", "js/skill-playtest.js",
];
const ctx = vm.createContext(global);
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

/* ---------- 断言驱动（const G / Meta / Player / CFG / SkillSave / SkillRuntime 在 vm 作用域内可见） ---------- */
const driver = `
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("未通过 " + name); }
};
const J = (o) => JSON.stringify(o);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const S = __scan;
const SKEY = __SAVE_KEY;

/* ================= 零、基线：真实对象与真实 CFG（直读，非合成契约） ================= */
check("基线0.1 SkillSave 为真实模块且 serialize/saveTo/loadFrom 齐备",
  typeof SkillSave === "object" && typeof SkillSave.serialize === "function" &&
  typeof SkillSave.saveTo === "function" && typeof SkillSave.loadFrom === "function");
check("基线0.2 真实宿主 G / Meta / Player / Meta.commit 就位",
  typeof G === "object" && typeof Meta === "object" && typeof Player === "function" &&
  typeof Meta.commit === "function");

const MIG = CFG.skillSystem.migratedHeroIds[0];
const BIND = CFG.skillSystem.initialSkillBindings[MIG] && CFG.skillSystem.initialSkillBindings[MIG].skillId;
check("基线0.3 直读真实 CFG：迁移英雄 " + MIG + " 的初始技能 " + BIND + " 在 skillDefs 中存在",
  !!MIG && !!BIND && !!(CFG.skillSystem.skillDefs && CFG.skillSystem.skillDefs[BIND]));
check("基线0.4 直读真实 CFG：总开关已启用且技能系统版本非空",
  CFG.skillSystem.enabled === true && typeof CFG.skillSystem.configVersion === "string" && CFG.skillSystem.configVersion.length > 0);

/* 干净键集（真实 Meta 默认键；后面据它证明结算不新增任何键） */
const CLEAN_KEYS = Object.keys(Meta.data).sort().join(",");

/* ================= 一、局开始：不存在「从存档恢复技能/水晶」的路径 ================= */
check("一1 静态：js/ 内除 skill-save.js 外 SkillSave 引用 0 处（实测 " + S.skillSaveToken.length + "）",
  S.skillSaveToken.length === 0);
check("一2 静态：js/ 内除 skill-save.js 外 .saveTo( / .loadFrom( 调用 0 处（实测 " +
  S.saveToCalls.length + " / " + S.loadFromCalls.length + "）",
  S.saveToCalls.length === 0 && S.loadFromCalls.length === 0);
check("一3 静态：js/ 内除 skill-save.js 外 Meta.data.skillSystem 读写 0 处（实测 " + S.dataSkillSystem.length + "）",
  S.dataSkillSystem.length === 0);
check("一4 源码事实：整合层 skill-playtest.js 不引用 SkillSave / loadFrom / data.skillSystem",
  !/SkillSave/.test(__playtestSrc) && !/loadFrom/.test(__playtestSrc) && !/data\\.skillSystem/.test(__playtestSrc));
check("一5 源码事实：整合层唯一的局外读取是 Meta.weaponLv（等级数），非技能/水晶实例",
  /Meta\\.weaponLv/.test(__playtestSrc));

/* 用真实 SkillSave.saveTo 埋入一份「上局存档」（含假技能 + 假水晶）→ 证明安全、可读出 */
const DECOY_SKILL = "SK_ZZ_DECOY_NOT_IN_CFG";
const DECOY_CRYSTAL = "CR_ZZ_DECOY_NOT_IN_CFG";
const decoyState = { heroId: MIG, slotCount: 4, groupVersion: 9,
  skills: {}, crystals: [ { crystalId: DECOY_CRYSTAL, level: 3, slot: 0 } ] };
decoyState.skills[DECOY_SKILL] = { id: DECOY_SKILL, level: 7, cd: 1.0, cdLeft: 0.5 };
SkillSave.saveTo(Meta, decoyState);   // 真实写入 Meta.data.skillSystem（局外）
Meta.commit();
const decoyReadBack = SkillSave.loadFrom(Meta);
check("一6 真实 SkillSave.saveTo 埋入「上局存档」后可由 loadFrom 读出（假技能 level = 7）",
  !!(decoyReadBack && decoyReadBack.heroes && decoyReadBack.heroes[MIG] &&
     decoyReadBack.heroes[MIG].skills[DECOY_SKILL] && decoyReadBack.heroes[MIG].skills[DECOY_SKILL].level === 7));

/* ★局开始：真实 Player（真实英雄定义）经真实懒注入重建 skillState —— 只由真实 CFG 绑定决定 */
const heroDef = CFG.heroes.filter(h => h && h.id === MIG)[0];
G.heroDef = heroDef;
const hero = new Player(100, 100);
const owns = SkillRuntime.ownsHero(hero);      // 真实分流入口（已被整合层包装 → 懒注入）
const st = hero.skillState;
check("一7 ★真实 Player 经 SkillRuntime.ownsHero 懒注入 skillState（owns = true 且已编 builds）",
  owns === true && !!st && !!st.builds && st.heroId === MIG);
check("一8 ★局开始重建=从零（先断长度=1）：技能恰为 CFG 绑定的初始技能，且不含存档里的假技能",
  Object.keys(st.skills).length === 1 && !!st.skills[BIND] && !st.skills[DECOY_SKILL]);
check("一9 局开始重建：4 槽水晶（先断长度=4），全部为真实 CFG 定义，且不含存档里的假水晶",
  (st.crystals || []).length === 4 &&
  st.crystals.every(c => !!(CFG.skillSystem.crystalDefs && CFG.skillSystem.crystalDefs[c.crystalId])) &&
  !st.crystals.some(c => c.crystalId === DECOY_CRYSTAL));
check("一10 ★重建过程未把「上局存档」读进来：Meta.data.skillSystem 原样保留（假技能仍在，level 仍 7）",
  !!(Meta.data.skillSystem && Meta.data.skillSystem.heroes && Meta.data.skillSystem.heroes[MIG] &&
     Meta.data.skillSystem.heroes[MIG].skills[DECOY_SKILL] &&
     Meta.data.skillSystem.heroes[MIG].skills[DECOY_SKILL].level === 7));

/* ================= 二、局结束（撤离成功 / 死亡）后：局外 Meta 不含技能 / 水晶字段 ================= */
delete Meta.data.skillSystem;                 // 还原「真实宿主从不写 skillSystem」的内存状态
Meta.data.crystals = 5;
Meta.commit();
const decoyGone = !hasOwn(Meta.data, "skillSystem");
check("二1 清场后：真实 Meta.data 无 skillSystem 键（宿主内存态）", decoyGone);

/* 撤离成功：真实结算方法（与 main.js extractSuccess 处理器同口径：发结晶 + 解锁 + 标记） */
const extractGain = Meta.awardRun(12, true, true);
Meta.setFlag("firstExtract");
Meta.data.unlockedLevels = 2;
Meta.commit();
check("二2 撤离成功结算（真实 Meta.awardRun/setFlag/commit）后：Meta.data 键集不变（实测 " +
  Object.keys(Meta.data).length + " 键）",
  Object.keys(Meta.data).sort().join(",") === CLEAN_KEYS);
check("二3 撤离成功后：Meta.data 无 skillSystem 键、无任何键名匹配 /skill/i",
  !hasOwn(Meta.data, "skillSystem") && !Object.keys(Meta.data).some(k => /skill/i.test(k)));
check("二4 撤离成功后：Meta.data 无任何「技能/水晶实例」容器（skills + crystals 并存的子对象）",
  !Object.keys(Meta.data).some(k => {
    const v = Meta.data[k];
    return v && typeof v === "object" && v.skills && v.crystals;
  }));

/* 死亡：真实结算方法（与 main.js playerDied 处理器同口径） */
const deathGain = Meta.awardRun(0, false, false);
Meta.commit();
check("二5 死亡结算（真实 Meta.awardRun/commit）后：Meta.data 键集仍不变、仍无 skillSystem / /skill/i 键",
  Object.keys(Meta.data).sort().join(",") === CLEAN_KEYS &&
  !hasOwn(Meta.data, "skillSystem") && !Object.keys(Meta.data).some(k => /skill/i.test(k)));

/* 落盘证据：SAVE_KEY 持久化内容与内存键集一致，且不含技能 / 水晶字段 */
const raw = localStorage.getItem(SKEY);
let parsed = null;
try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
check("二6 落盘（真实 Meta.commit → SAVE_KEY）存在且键集与 Meta.data 一致（无新增键）",
  !!parsed && typeof raw === "string" && raw.length > 0 &&
  Object.keys(parsed).sort().join(",") === CLEAN_KEYS);
check("二7 落盘 JSON 不含 skillSystem 键，且英雄记录内无技能/水晶实例",
  !!parsed && !hasOwn(parsed, "skillSystem") &&
  (function () { const rec = (parsed.heroes && parsed.heroes[MIG]) || {};
    return rec.skills === undefined && rec.crystals === undefined; })());
check("二8 源码事实：结算宿主 main.js 不含 SkillSave / .saveTo( / .loadFrom( / Meta.data.skillSystem",
  !/SkillSave/.test(__mainSrc) && !/\\.saveTo\\s*\\(/.test(__mainSrc) &&
  !/\\.loadFrom\\s*\\(/.test(__mainSrc) && !/Meta\\.data\\.skillSystem/.test(__mainSrc));

/* ================= 三、SkillSave.serialize 只作用局内对象，不触碰 Meta ================= */
const metaSnap = J(Meta.data);
const payload = SkillSave.serialize(hero.skillState);   // 输入 = 局内英雄对象上的 skillState
check("三1 serialize（输入=局内 skillState）前后：Meta.data 逐字未变",
  J(Meta.data) === metaSnap);
check("三2 serialize 载荷含版本头与真实英雄内容（schemaVersion / configVersion=真实 CFG 版本 / 含 " + BIND + "）",
  payload.schemaVersion === SkillSave.SCHEMA_VERSION &&
  payload.configVersion === CFG.skillSystem.configVersion &&
  !!(payload.heroes[MIG] && payload.heroes[MIG].skills[BIND]));
const lvBefore = hero.skillState.skills[BIND].level;
payload.heroes[MIG].skills[BIND].level = 999;
check("三3 serialize 为深拷贝：改载荷不污染局内 skillState（局内仍为 " + lvBefore + "）",
  hero.skillState.skills[BIND].level === lvBefore);
check("三4 serialize 不落 Meta：未经 saveTo 时 Meta.data 仍无 skillSystem，loadFrom 返回 null",
  !hasOwn(Meta.data, "skillSystem") && SkillSave.loadFrom(Meta) === null);

/* ================= 四、铁律守卫 ================= */
const writers = (__skillSaveSrc.match(/meta\\.data\\.skillSystem\\s*=/g) || []).length;
check("四1 全仓唯一写入口：仅 skill-save.js 内 1 行 meta.data.skillSystem 赋值（实测 " + writers + "）",
  writers === 1);
check("四2 index.html 仅以 <script> 加载 skill-save.js，无内联 saveTo / loadFrom 调用",
  __indexSrc.indexOf("js/skill-save.js") >= 0 &&
  __indexSrc.indexOf(".saveTo(") < 0 && __indexSrc.indexOf(".loadFrom(") < 0);

console.log("");
console.log("PASS 合计 = " + passCount + "   未通过数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
`;

try {
  vm.runInContext(driver, ctx, { filename: "skill_save_session_driver.js" });
} catch (e) {
  console.log("");
  console.log("驱动执行中断：" + (e && e.message));
  console.log("PASS 合计 = 0   未通过数 = 1");
  process.exit(1);
}
