/* ============================================================================
 * hero_nondamage_skill_test.js —— 12 英雄技能「批 2」非伤害技能结构守卫
 * ----------------------------------------------------------------------------
 * 范围：H007~H012 的 6 个新技能 + 节点可选字段 `effect` 的**结构合同**，
 *       外加「非伤害模板」条件必填规则（既有的 4 类模板仍强制 damageBasis）。
 *
 * 🔒 口径铁律（本文件全程遵守）：
 *   - 一律直读**真实 CFG.skillSystem**（vm 加载真实脚本链，禁止自造桩对象）。
 *   - 空真陷阱：对所有可能为空的 filter 结果，先断言长度再 every（反例必测）。
 *   - PASS 文案不得含英文单词 error（run_tests.sh 以 grep -ci 计 bad，大小写不敏感）。
 *   - 反向断言：故意弄坏深拷贝 → 断言校验器如实报错（证明校验规则仍在生效）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = path.join(__dirname, "..", "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：真实脚本（表 + 校验器 + 编译器 + 9 模块） ----------------
 * 只加载 js，不碰 document/window 的真实 API（可在 file:// 无 DOM 环境下运行）。 */
const FILES = [
  "js/config.js",
  "js/core.js",
  "js/pool.js",
  "mods/jes-skill-crystal/systems/skill-config.js",
  "mods/jes-skill-crystal/systems/skill-compiler.js",
  "mods/jes-skill-crystal/systems/skill-damage.js",
  "mods/jes-skill-crystal/systems/skill-events.js",
  "mods/jes-skill-crystal/systems/skill-scheduler.js",
  "mods/jes-skill-crystal/systems/skill-runtime.js",
  "mods/jes-skill-crystal/systems/skill-reward.js",
  "mods/jes-skill-crystal/systems/skill-presenter.js",
  "mods/jes-skill-crystal/systems/skill-save.js",
];
let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("⓪ 真实脚本链无异常装载", !bootThrew);
const ev = (code) => vm.runInContext(code, ctx);

/* 读取真实配置（跨 realm 对象：用 Array.isArray / typeof，不用 instanceof）。 */
const SS = ev("CFG.skillSystem");

/* 6 个新技能 → 期望的 effect.kind（批 2 铁律） */
const NEW_SKILLS = [
  ["SK_TAUNTROAR", "taunt", "H009"],
  ["SK_LIFEPULSE", "heal", "H010"],
  ["SK_WARSONG", "aura", "H011"],
  ["SK_PSYSHIELD", "barrier", "H012"],
  ["SK_MINEFIELD", "trap", "H008"],
  ["SK_DRONESWARM", "summon", "H007"],
];
const EFFECT_STATS_WHITELIST = ["atk", "def", "spd", "energyMax"];

const nodesOf = (sid) => (SS.skillDefs[sid] && SS.skillDefs[sid].baseGraph && SS.skillDefs[sid].baseGraph.nodes) || [];
const primaryOf = (sid) => nodesOf(sid).filter((n) => n && n.role === "primary");
const effectOf = (sid) => { const p = primaryOf(sid); return p.length === 1 ? p[0].effect : undefined; };

/* ==========================================================================
 * A. 绑定与名单完整性
 * ======================================================================== */
console.log("--- A. 绑定与名单完整性 ---");
{
  const bindKeys = Object.keys(SS.initialSkillBindings);
  const EXPECTED = ["H001", "H002", "H003", "H004", "H005", "H006", "H007", "H008", "H009", "H010", "H011", "H012"];

  check("A1 绑定表恰有 12 条（实 " + bindKeys.length + "）", bindKeys.length === EXPECTED.length);
  check("A1 绑定表键集 === [H001..H012]（逐位一致）", JSON.stringify(bindKeys) === JSON.stringify(EXPECTED));

  const migrated = SS.migratedHeroIds.slice();
  const sortedMig = migrated.slice().sort();
  const sortedBind = bindKeys.slice().sort();
  check("A2 migratedHeroIds 非空（空名单会让后续断言变空真）", Array.isArray(migrated) && migrated.length > 0);
  check("A2 迁移名单排序后 === 绑定键集排序后（防漏登记，真源不得分叉）",
    JSON.stringify(sortedMig) === JSON.stringify(sortedBind));
  if (JSON.stringify(sortedMig) !== JSON.stringify(sortedBind)) {
    console.log("   迁移=" + JSON.stringify(sortedMig) + " 绑定=" + JSON.stringify(sortedBind));
  }

  const badSkill = bindKeys.filter((h) => !SS.skillDefs[SS.initialSkillBindings[h].skillId]);
  check("A3 每个绑定的 skillId 都在 skillDefs 里存在（检 " + bindKeys.length + " 条）", badSkill.length === 0);
  if (badSkill.length) console.log("   缺定义：" + badSkill.join(","));

  const badWeapon = bindKeys.filter((h) => {
    const w = SS.initialSkillBindings[h].weaponId;
    return !(typeof w === "string" && w.length > 0);
  });
  check("A3 每个绑定的 weaponId 均为非空字符串（检 " + bindKeys.length + " 条）", badWeapon.length === 0);
  if (badWeapon.length) console.log("   缺武器：" + badWeapon.join(","));
}

/* ==========================================================================
 * B. 6 个新技能的结构铁律
 * ======================================================================== */
console.log("--- B. 6 个新技能结构铁律 ---");
{
  const sids = NEW_SKILLS.map((x) => x[0]);
  const present = sids.filter((id) => !!SS.skillDefs[id]);
  check("B4 6 个新技能定义全部存在（检 " + sids.length + " 个）", present.length === sids.length);
  if (present.length !== sids.length) console.log("   缺：" + sids.filter((id) => present.indexOf(id) < 0).join(","));

  const emptyNodes = sids.filter((id) => nodesOf(id).length === 0);
  check("B4 每个新技能的 baseGraph.nodes 非空（空图会让后续 every 恒真）", emptyNodes.length === 0);
  if (emptyNodes.length) console.log("   空图：" + emptyNodes.join(","));

  const REQUIRED_NODE_FIELDS = ["nodeId", "templateId", "role", "tags", "capabilities", "parameters", "hitPolicyId"];
  const badField = [];
  sids.forEach((id) => nodesOf(id).forEach((n) => {
    const miss = REQUIRED_NODE_FIELDS.filter((f) => n[f] === undefined || n[f] === null);
    if (miss.length) badField.push(id + ":" + (n.nodeId || "?") + " 缺 " + miss.join("/"));
  }));
  const totalNodes = sids.reduce((a, id) => a + nodesOf(id).length, 0);
  check("B4 每个节点 7 项基础字段齐备（检 " + totalNodes + " 个节点）", totalNodes > 0 && badField.length === 0);
  if (badField.length) console.log("   " + badField.slice(0, 8).join(" | "));

  const badTpl = [];
  sids.forEach((id) => nodesOf(id).forEach((n) => {
    if (!SS.effectTemplates[n.templateId]) badTpl.push(id + ":" + n.nodeId + "→" + n.templateId);
  }));
  check("B4 每个节点 templateId 都在 effectTemplates 里存在（检 " + totalNodes + " 个节点）", badTpl.length === 0);
  if (badTpl.length) console.log("   未知模板：" + badTpl.join(","));

  const badName = sids.filter((id) => {
    const k = SS.skillDefs[id].nameKey;
    const v = SS.localization[k];
    if (!(typeof v === "string" && v.length > 0)) return true;
    if (v === k) return true;
    if (/[{}]/.test(v)) return true;
    if (v.indexOf("TODO") >= 0 || v.indexOf("%s") >= 0) return true;
    return false;
  });
  check("B5 6 个新技能 nameKey 均解析出非空、无占位符文案（检 " + sids.length + " 个）", badName.length === 0);
  if (badName.length) console.log("   文案缺/占位：" + badName.join(","));

  /* 派生节点由边可达：若技能有边，则边的 from/to 必须都指向真实节点 */
  const badEdge = [];
  sids.forEach((id) => {
    const g = SS.skillDefs[id].baseGraph;
    const nodeIds = nodesOf(id).map((n) => n.nodeId);
    (g.edges || []).forEach((e) => {
      if (nodeIds.indexOf(e.from) < 0) badEdge.push(id + " from=" + e.from);
      if (nodeIds.indexOf(e.to) < 0) badEdge.push(id + " to=" + e.to);
    });
  });
  const hasAnyEdge = sids.some((id) => (SS.skillDefs[id].baseGraph.edges || []).length > 0);
  check("B6 全部边的 from/to 均指向真实节点（" + (hasAnyEdge ? "存在边，已逐条校验" : "6 个技能均无边，规则空真已声明") + "）",
    badEdge.length === 0);

  /* damageBasis 三字段齐：仅对**声明了** damageBasis 的节点；并防空真 */
  const dbNodes = [];
  sids.forEach((id) => nodesOf(id).forEach((n) => { if (n.damageBasis !== undefined) dbNodes.push([id, n]); }));
  const badDb = dbNodes.filter((pair) => {
    const db = pair[1].damageBasis;
    return !(db && typeof db.baseRef === "string" && db.baseRef.length > 0 &&
      typeof db.coefficient === "number" && isFinite(db.coefficient) && db.coefficient >= 0 &&
      Array.isArray(db.inheritFactorKeys));
  });
  check("B7 声明了 damageBasis 的节点三字段齐（检 " + dbNodes.length + " 个，>0 防空真）",
    dbNodes.length > 0 && badDb.length === 0);
  if (badDb.length) console.log("   坏基准：" + badDb.map((p) => p[0] + ":" + p[1].nodeId).join(","));
}

/* ==========================================================================
 * C. effect 字段合同（本批核心）
 * ======================================================================== */
console.log("--- C. effect 字段合同 ---");
{
  const sids = NEW_SKILLS.map((x) => x[0]);

  /* C8-a：每个新技能恰有 1 个 primary 节点且带 effect */
  const badPrimary = sids.filter((id) => {
    const p = primaryOf(id);
    return !(p.length === 1 && p[0].effect && typeof p[0].effect === "object");
  });
  check("C8 每个新技能恰有 1 个主节点且带 effect 对象（检 " + sids.length + " 个）", badPrimary.length === 0);
  if (badPrimary.length) console.log("   " + badPrimary.join(","));

  /* C8-b：kind 逐技能对齐 */
  const badKind = NEW_SKILLS.filter(([id, kind]) => {
    const e = effectOf(id);
    return !(e && e.kind === kind);
  });
  check("C8 6 个 effect.kind 逐技能对齐（taunt/heal/aura/barrier/trap/summon）", badKind.length === 0);
  if (badKind.length) console.log("   " + badKind.map((x) => x[0] + "=" + ((effectOf(x[0]) || {}).kind)).join(","));

  const isNonNeg = (v) => typeof v === "number" && isFinite(v) && v >= 0;
  const isPos = (v) => typeof v === "number" && isFinite(v) && v > 0;
  const isNonNegInt = (v) => isNonNeg(v) && Math.floor(v) === v;
  const isNonEmptyStr = (v) => typeof v === "string" && v.length > 0;

  /* C9：逐 kind 必需字段（照 _validateEffect 真实实现） */
  {
    const e = effectOf("SK_LIFEPULSE") || {};
    check("C9 heal.requiredField · healBase 非负数（实 " + e.healBase + "）",
      e.kind === "heal" && isNonNeg(e.healBase));
  }
  {
    const e = effectOf("SK_WARSONG") || {};
    const statsOk = Array.isArray(e.auraStats) && e.auraStats.length > 0 &&
      e.auraStats.every((s) => isNonEmptyStr(s) && EFFECT_STATS_WHITELIST.indexOf(s) >= 0);
    check("C9 aura.requiredField · auraPct 非负 且 auraDuration 正数（实 " + e.auraPct + "/" + e.auraDuration + "）",
      e.kind === "aura" && isNonNeg(e.auraPct) && isPos(e.auraDuration));
    check("C9 aura.auraStats 为非空字符串数组且每项 ∈ {atk,def,spd,energyMax}（实 " + JSON.stringify(e.auraStats) + "）", statsOk);
  }
  {
    const e = effectOf("SK_PSYSHIELD") || {};
    check("C9 barrier.requiredField · barrierDef 非负 且 barrierDuration 正数（实 " + e.barrierDef + "/" + e.barrierDuration + "）",
      e.kind === "barrier" && isNonNeg(e.barrierDef) && isPos(e.barrierDuration));
  }
  {
    const e = effectOf("SK_TAUNTROAR") || {};
    check("C9 taunt.requiredField · tauntDuration 正数（实 " + e.tauntDuration + "）",
      e.kind === "taunt" && isPos(e.tauntDuration));
  }
  {
    const e = effectOf("SK_MINEFIELD") || {};
    check("C9 trap.requiredField · armDelay 非负数（实 " + e.armDelay + "）",
      e.kind === "trap" && isNonNeg(e.armDelay));
  }
  {
    const e = effectOf("SK_DRONESWARM") || {};
    check("C9 summon.requiredField · summonId 非空字符串（实 " + e.summonId + "）",
      e.kind === "summon" && isNonEmptyStr(e.summonId));
    check("C9 summon.requiredField · summonCount 非负整数（实 " + e.summonCount + "）",
      e.kind === "summon" && isNonNegInt(e.summonCount));
  }

  /* C10：effect.scaleStat（若有）∈ 白名单 */
  const effects = sids.map((id) => effectOf(id)).filter((e) => e && typeof e === "object");
  const badScale = effects.filter((e) => e.scaleStat !== undefined &&
    !(isNonEmptyStr(e.scaleStat) && EFFECT_STATS_WHITELIST.indexOf(e.scaleStat) >= 0));
  check("C10 effect.scaleStat（若有）∈ {atk,def,spd,energyMax}（检 " + effects.length + " 个 effect）",
    effects.length > 0 && badScale.length === 0);
}

/* ==========================================================================
 * D. 非伤害模板与条件必填（必须含反向断言）
 * ======================================================================== */
console.log("--- D. 非伤害模板与条件必填（含反向） ---");
{
  const tpl = SS.effectTemplates.TP_SUMMON_UNIT;
  check("D11 TP_SUMMON_UNIT.kind === \"summonUnit\"（实 " + (tpl && tpl.kind) + "）", !!(tpl && tpl.kind === "summonUnit"));

  const droneNodes = nodesOf("SK_DRONESWARM");
  const allNoDb = droneNodes.length > 0 && droneNodes.every((n) => n.damageBasis === undefined);
  const allSummonTpl = droneNodes.length > 0 && droneNodes.every((n) => n.templateId === "TP_SUMMON_UNIT");
  check("D12 SK_DRONESWARM 节点均无 damageBasis（非伤害模板允许缺省，检 " + droneNodes.length + " 个）",
    droneNodes.length > 0 && allNoDb && allSummonTpl);

  /* D13 反向：删 SK_FIREBALL 主节点 damageBasis → 既有投射模板仍强制必填 */
  const r13 = ev(`(function () {
    var c = JSON.parse(JSON.stringify(CFG.skillSystem));
    var ns = c.skillDefs.SK_FIREBALL.baseGraph.nodes;
    for (var i = 0; i < ns.length; i++) { if (ns[i].role === "primary") { delete ns[i].damageBasis; } }
    return SkillConfig.validate(c);
  })()`);
  const d13 = r13.diagnostics.filter((d) => d.code === "REQUIRED_FIELD" && d.definitionId === "SK_FIREBALL" &&
    String(d.field).indexOf("damageBasis") === 0);
  check("D13[反向] 删除 SK_FIREBALL 主节点 damageBasis → 报 REQUIRED_FIELD@damageBasis（实 " + d13.length + " 条）",
    !!(r13 && r13.ok === false) && d13.length > 0);

  /* D14 反向：effect.kind 改成非法值 → INVALID_PARAMETER */
  const r14 = ev(`(function () {
    var c = JSON.parse(JSON.stringify(CFG.skillSystem));
    c.skillDefs.SK_TAUNTROAR.baseGraph.nodes[0].effect.kind = "bogusKind";
    return SkillConfig.validate(c);
  })()`);
  const d14 = r14.diagnostics.filter((d) => d.code === "INVALID_PARAMETER" && d.definitionId === "SK_TAUNTROAR" &&
    d.field === "effect.kind");
  check("D14[反向] effect.kind 设为非法值 → 报 INVALID_PARAMETER@effect.kind（实 " + d14.length + " 条）",
    !!(r14 && r14.ok === false) && d14.length > 0);

  /* D15 反向：删掉某 effect 的必需字段 → REQUIRED_FIELD */
  const r15 = ev(`(function () {
    var c = JSON.parse(JSON.stringify(CFG.skillSystem));
    delete c.skillDefs.SK_LIFEPULSE.baseGraph.nodes[0].effect.healBase;
    return SkillConfig.validate(c);
  })()`);
  const d15 = r15.diagnostics.filter((d) => d.code === "REQUIRED_FIELD" && d.definitionId === "SK_LIFEPULSE" &&
    d.field === "effect.healBase");
  check("D15[反向] 删 heal 的必需字段 healBase → 报 REQUIRED_FIELD@effect.healBase（实 " + d15.length + " 条）",
    !!(r15 && r15.ok === false) && d15.length > 0);

  /* 正向基线：真实 CFG 整表通过校验器（证明上述反向确由「改动」触发而非配置本已坏） */
  const rReal = ev("(function () { return SkillConfig.validate(CFG.skillSystem); })()");
  check("D-基线 真实 CFG.skillSystem 通过校验器 ok=true（反向断言的对照）", !!(rReal && rReal.ok === true));
}

/* ==========================================================================
 * E. 两处白名单同步（源码级守卫，防漂移）
 * ======================================================================== */
console.log("--- E. 两处 _NON_DAMAGE_KINDS 同步 ---");
{
  const extractKeys = (src) => {
    const m = src.match(/_NON_DAMAGE_KINDS\s*[:=]\s*\{([\s\S]*?)\}/);
    if (!m) return null;
    const out = [];
    const re = /([A-Za-z_$][\w$]*)\s*:/g;
    let x;
    while ((x = re.exec(m[1]))) out.push(x[1]);
    return out;
  };
  const cfgKeys = extractKeys(read("mods/jes-skill-crystal/systems/skill-config.js"));
  const cmpKeys = extractKeys(read("mods/jes-skill-crystal/systems/skill-compiler.js"));

  check("E16 两侧源码均可提取 _NON_DAMAGE_KINDS 键集（防提取失败变空真）",
    Array.isArray(cfgKeys) && cfgKeys.length > 0 && Array.isArray(cmpKeys) && cmpKeys.length > 0);
  check("E16 两处 _NON_DAMAGE_KINDS 键集一致（config=" + JSON.stringify(cfgKeys) + " compiler=" + JSON.stringify(cmpKeys) + "）",
    Array.isArray(cfgKeys) && Array.isArray(cmpKeys) &&
    cfgKeys.slice().sort().join(",") === cmpKeys.slice().sort().join(","));
  check("E16 两处白名单均含 summonUnit（本批唯一非伤害模板）",
    Array.isArray(cfgKeys) && cfgKeys.indexOf("summonUnit") >= 0 &&
    Array.isArray(cmpKeys) && cmpKeys.indexOf("summonUnit") >= 0);

  check("E17 CFG.skillSystem.defaults 含 summonUnit 键（非伤害模板缺省值）",
    !!(SS.defaults && Object.prototype.hasOwnProperty.call(SS.defaults, "summonUnit")));
}

/* ==========================================================================
 * F. 零回归守卫：H001~H006 仍在且可编译
 * ======================================================================== */
console.log("--- F. 零回归（H001~H006） ---");
{
  const old = [["H001", "SK_FIREBALL"], ["H002", "SK_SCATTER"], ["H003", "SK_RAILGUN"],
    ["H004", "SK_RINGBARRAGE"], ["H005", "SK_VOLLEY"], ["H006", "SK_SIEGEBLAST"]];

  const missing = old.filter(([, sid]) => !SS.skillDefs[sid]);
  check("F18 H001~H006 的 6 个技能定义仍存在", old.length > 0 && missing.length === 0);
  if (missing.length) console.log("   丢失：" + missing.map((x) => x[1]).join(","));

  const bad = [];
  for (const [h, sid] of old) {
    const res = ev(`(function () {
      var state = { heroId: "${h}", slotCount: 4, groupVersion: 1,
        skills: { ${sid}: { id: "${sid}", level: 1 } }, crystals: [] };
      return SupportCompiler.compile({ heroId: "${h}", state: state, definitions: CFG.skillSystem });
    })()`);
    if (!res || !res.ok || !res.builds || !res.builds[sid]) bad.push(h + "(" + sid + ")");
  }
  check("F18 H001~H006 初始技能逐个编译 ok=true（检 " + old.length + " 个）", bad.length === 0);
  if (bad.length) console.log("   编译未过：" + bad.join(","));
}

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("非伤害技能结构守卫未全部通过");
