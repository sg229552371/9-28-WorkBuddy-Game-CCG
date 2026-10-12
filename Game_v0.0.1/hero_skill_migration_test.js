/* ============================================================================
 * hero_skill_migration_test.js —— 12 英雄技能「全量迁移」守卫（批 1：H001~H006）
 * ----------------------------------------------------------------------------
 * 目的：把「英雄技能迁移」的验收口径固化成断言，防三类回归：
 *   ① 漏搬（英雄进了 migratedHeroIds，但没有技能定义 / 没有武器绑定）
 *   ② 结构坏（主节点缺 moreDamageMul:1 → 伤害恒 0；派生边指向不存在节点）
 *   ③ 分流串台（未迁移英雄出现在名单里 → 新旧两路并发）
 *
 * 🔒 口径铁律（本文件全程遵守）：
 *   - 一律直读**真实 CFG.skillSystem**（禁止自造桩；桩与读取方自洽会永远绿）。
 *   - 空真陷阱：对所有可能为空的 filter 结果，先断言长度再 every。
 *   - PASS 文案不得含英文 FAIL / Error（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：真实脚本（表 + 校验器 + 编译器 + 9 模块） ---------------- */
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
];
let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("① 真实脚本无异常装载", !bootThrew);
const ev = (code) => vm.runInContext(code, ctx);

/* ================== ① 真实配置校验 + 名单/绑定一致性 ================== */
{
  const r = ev("(function () { return SkillConfig.validate(CFG.skillSystem); })()");
  if (!r.ok) console.log("诊断：" + JSON.stringify((r.diagnostics || []).slice(0, 12).map(d => d.code + "@" + (d.definitionId || "-") + "." + (d.field || "-"))));
  check("① 真实 CFG.skillSystem 通过校验器（ok=true）", !!(r && r.ok));

  const migrated = ev("CFG.skillSystem.migratedHeroIds.slice()");
  check("① 迁移名单非空（空名单会让后续断言全变空真）", Array.isArray(migrated) && migrated.length > 0);
  check("① 迁移名单 = 技能绑定表键集（两个真源不得分叉）",
    migrated.length === ev("Object.keys(CFG.skillSystem.initialSkillBindings).length") &&
    migrated.every(h => ev("Object.keys(CFG.skillSystem.initialSkillBindings).indexOf('" + h + "')") >= 0));

  /* 逐个英雄：绑定存在 + 技能定义存在 + 武器 id 真实存在 */
  const missing = migrated.filter(h => ev(
    "(function () { var b = CFG.skillSystem.initialSkillBindings['" + h + "']; " +
    "return !b || !b.skillId || !CFG.skillSystem.skillDefs[b.skillId] || !CFG.weapons[b.weaponId]; })()"));
  check("① 每个迁移英雄都有 武器绑定 + 技能定义（漏搬守卫，检 " + migrated.length + " 人）", missing.length === 0);
  if (missing.length) console.log("   漏搬：" + missing.join(","));

  /* 双技能上限：每个英雄初始技能唯一 */
  const skillIds = migrated.map(h => ev("CFG.skillSystem.initialSkillBindings['" + h + "'].skillId"));
  check("① 初始技能 id 互不重复（" + skillIds.length + " 个）",
    skillIds.length > 0 && new Set(skillIds).size === skillIds.length);
}

/* ================== ② 分流铁律：名单 = 英雄全量 / 绑定键集逐位一致 ================== */
{
  const allHeroes = ev("CFG.heroes.map(function (h) { return h.id; })");
  const migrated = ev("CFG.skillSystem.migratedHeroIds.slice()");
  const pending = allHeroes.filter(h => migrated.indexOf(h) < 0);
  /* 批 2（2026-10-12 · 决策 D012）：12 英雄已**全量迁移** → pending 必须为空。
   * ⚠️ 空真陷阱：这里断言的是「pending 为空」，若将来有人回退部分迁移会如实报红；
   *    下方绑定键集一致性断言在两侧都做（防漏登记 / 防幽灵英雄）。 */
  check("② 迁移名单 = 英雄全量（" + migrated.length + " / 全 " + allHeroes.length + " 人，无未迁移）",
    allHeroes.length > 0 && pending.length === 0);
  if (pending.length) console.log("   未迁移：" + pending.join(","));
  const bindKeys = ev("Object.keys(CFG.skillSystem.initialSkillBindings)");
  const onlyMigrated = bindKeys.filter(k => migrated.indexOf(k) < 0);
  const onlyBound = migrated.filter(h => bindKeys.indexOf(h) < 0);
  check("② 绑定键集 = 迁移名单（绑 " + bindKeys.length + " / 迁 " + migrated.length + "，双向比对）",
    bindKeys.length > 0 && onlyMigrated.length === 0 && onlyBound.length === 0);
  if (onlyMigrated.length) console.log("   有绑定未进名单：" + onlyMigrated.join(","));
  if (onlyBound.length) console.log("   进名单无绑定：" + onlyBound.join(","));
  /* 旧路径技能仍在（不能被误删——迁移是「新增新路径」，不是「删旧表」） */
  const oldGone = allHeroes.filter(h => {
    const w = ev("(CFG.weapons[CFG.heroes.filter(function (x) { return x.id === '" + h + "'; })[0].weapon] || {}).skills");
    return !w || !w.skill || !ev("CFG.skills['" + w.skill + "']");
  });
  check("② 全部英雄的旧路径技能仍在（" + allHeroes.length + " 人检完）",
    allHeroes.length > 0 && oldGone.length === 0);
  if (oldGone.length) console.log("   旧路径缺技能：" + oldGone.join(","));
}

/* ================== ③ 每个迁移英雄的技能可独立编译 ================== */
{
  const migrated = ev("CFG.skillSystem.migratedHeroIds.slice()");
  const bad = [];
  for (const h of migrated) {
    const sid = ev("CFG.skillSystem.initialSkillBindings['" + h + "'].skillId");
    const res = ev(`(function () {
      var state = { heroId: "${h}", slotCount: 4, groupVersion: 1,
        skills: { ${sid}: { id: "${sid}", level: 1 } }, crystals: [] };
      return SupportCompiler.compile({ heroId: "${h}", state: state, definitions: CFG.skillSystem });
    })()`);
    if (!res || !res.ok || !res.builds || !res.builds[sid]) bad.push(h + "(" + sid + ")");
  }
  check("③ 每个迁移英雄的初始技能单独编译成功（" + migrated.length + " 人）", bad.length === 0);
  if (bad.length) console.log("   编译失败：" + bad.join(","));
}

/* ================== ④ 结构铁律（静态扫真实定义） ================== */
{
  const migrated = ev("CFG.skillSystem.migratedHeroIds.slice()");
  const ids = migrated.map(h => ev("CFG.skillSystem.initialSkillBindings['" + h + "'].skillId"));

  /* ④1 主节点必须显式 moreDamageMul = 1（乘法归并基准；缺省 0 → 伤害恒 0，本仓踩过）。
   * 批 2 豁免：**非伤害模板**（SupportCompiler._NON_DAMAGE_KINDS，如 summonUnit）的主节点不参与伤害归并。 */
  const badMul = ids.filter(id => ev(
    "(function () { var s = CFG.skillSystem.skillDefs['" + id + "']; var nd = SupportCompiler._NON_DAMAGE_KINDS || {}; " +
    "var tpls = CFG.skillSystem.effectTemplates; " +
    "var p = s.baseGraph.nodes.filter(function (n) { return n.role === 'primary'; }); " +
    "if (p.length === 0) return true; " +
    "var dmg = p.filter(function (n) { var t = tpls[n.templateId]; return !(t && nd[t.kind]); }); " +
    "return !dmg.every(function (n) { return n.parameters && n.parameters.moreDamageMul === 1; }); })()"));
  check("④ 每个技能的主节点都声明 parameters.moreDamageMul === 1（" + ids.length + " 个技能，非伤害主节点豁免）", badMul.length === 0);
  if (badMul.length) console.log("   缺基准：" + badMul.join(","));

  /* ④2 每个节点 damageBasis 三字段齐；**非伤害节点必须恰好没有 damageBasis**（双向断言，防绕过） */
  const badDb = ids.filter(id => ev(
    "(function () { var nd = SupportCompiler._NON_DAMAGE_KINDS || {}; var tpls = CFG.skillSystem.effectTemplates; " +
    "return CFG.skillSystem.skillDefs['" + id + "'].baseGraph.nodes.every(function (n) { " +
    "var t = tpls[n.templateId]; " +
    "if (t && nd[t.kind]) return n.damageBasis === undefined; " +
    "return n.damageBasis && typeof n.damageBasis.baseRef === 'string' && n.damageBasis.baseRef.length > 0 && " +
    "typeof n.damageBasis.coefficient === 'number' && Array.isArray(n.damageBasis.inheritFactorKeys); }); })()") !== true);
  check("④ 每个节点 damageBasis 三字段齐（" + ids.length + " 个技能；非伤害节点则须无）", badDb.length === 0);

  /* ④3 派生节点必须由边可达（否则是死节点 / 或模板兜底会命中主节点 → 幻影） */
  const orphan = ids.filter(id => ev(
    "(function () { var g = CFG.skillSystem.skillDefs['" + id + "'].baseGraph; " +
    "var derived = g.nodes.filter(function (n) { return n.role === 'derived'; }); " +
    "if (derived.length === 0) return false; " +
    "var tos = (g.edges || []).map(function (e) { return e.to; }); " +
    "return !derived.every(function (n) { return tos.indexOf(n.nodeId) >= 0; }); })()"));
  check("④ 派生节点一律由边可达（无死节点）", orphan.length === 0);
  if (orphan.length) console.log("   孤立派生节点：" + orphan.join(","));

  /* ④4 每个技能 nameKey 都能在 localization 解析出非空中文（UI 不硬写中文的前提） */
  const badName = ids.filter(id => {
    const k = ev("CFG.skillSystem.skillDefs['" + id + "'].nameKey");
    const v = ev("CFG.skillSystem.localization['" + k + "']");
    return !(typeof v === "string" && v.length > 0);
  });
  check("④ 每个技能 nameKey 都能解析出文案（" + ids.length + " 个）", badName.length === 0);
  if (badName.length) console.log("   文案缺：" + badName.join(","));
}

/* ================== ⑤ 技能身份回归：H001 爆炸 / H006 攻城爆破 ================== */
{
  /* H001 SK_FIREBALL：onHit → 派生范围爆炸（旧 AT102 净效果） */
  check("⑤ H001 SK_FIREBALL 保留 命中→范围爆炸 结构",
    ev('(function () { var g = CFG.skillSystem.skillDefs.SK_FIREBALL.baseGraph; ' +
       'return g.edges.some(function (e) { return e.event === "onHit"; }) && ' +
       'g.nodes.some(function (n) { return n.role === "derived" && n.hitPolicyId === "HP_EXPLOSION"; }); })()'));

  /* H006 SK_SIEGEBLAST：同样 命中→巨型爆炸，且半径 ≥ H001（攻城炮身份） */
  check("⑤ H006 SK_SIEGEBLAST 有 命中→爆炸 且半径 ≥ 130（重炮身份）",
    ev('(function () { var g = CFG.skillSystem.skillDefs.SK_SIEGEBLAST.baseGraph; ' +
       'var b = g.nodes.filter(function (n) { return n.role === "derived" && n.hitPolicyId === "HP_EXPLOSION"; }); ' +
       'return g.edges.some(function (e) { return e.event === "onHit"; }) && b.length === 1 && b[0].parameters.radius >= 130; })()'));

  /* 迁移基准表完整性：H002~H006 五个新技能都在 skillDefs 中 */
  const newIds = ["SK_SCATTER", "SK_RAILGUN", "SK_RINGBARRAGE", "SK_VOLLEY", "SK_SIEGEBLAST"];
  check("⑤ 批 1 的 5 个新技能定义齐备（" + newIds.length + " 个）",
    newIds.every(id => ev("!!CFG.skillSystem.skillDefs['" + id + "']")));
}

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("英雄技能迁移守卫未全部通过");
