/* 无头测试：SkillConfig 配置层（node skill_config_test.js）
 * 契约：G_docs/skill_system_interface_v1.md 第三节/第五节
 * 合同：§6/§7/§9/§17（配置层必要案例）
 * 风格：vm 沙箱（参考 skill_module_test.js）。
 * ⚠️ 模板字符串内禁用反引号；console.assert 不抛异常（用显式计数）。
 */
"use strict";

const fs = require("fs"), vm = require("vm");
const NODE = process.execPath;
const ctx = vm.createContext(global);

/* 加载真源：配置表 + 被测模块 */
vm.runInContext(fs.readFileSync("js/config.js", "utf8"), ctx, { filename: "js/config.js" });
vm.runInContext(fs.readFileSync("mods/jes-skill-crystal/systems/skill-config.js", "utf8"), ctx, { filename: "mods/jes-skill-crystal/systems/skill-config.js" });

/* fixture 直连配置真源（js/config.js 的 CFG.skillSystem）。
 * 说明：W1 的字段块草稿 G_docs/archive/skill_defs_draft_v1.js 在 W6 词汇表对齐后已归档为历史文档，
 *       本测试不再加载它，避免「测试 fixture 与集成真源分叉」——校验的必须是真正上线的表。 */

const driver = `
  var R = SkillConfig.Reason;
  var reasonVals = [];
  for (var rk in R) { if (Object.prototype.hasOwnProperty.call(R, rk)) reasonVals.push(R[rk]); }

  var passCount = 0, failCount = 0;
  function check(name, cond) {
    if (cond) { passCount++; console.log("PASS " + name); }
    else { failCount++; console.log("FAIL " + name); }
  }
  function clone(o) {
    if (o === null || typeof o !== "object") return o;
    if (Array.isArray(o)) { var a = []; for (var i = 0; i < o.length; i++) a[i] = clone(o[i]); return a; }
    var r = {}; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = clone(o[k]); } return r;
  }
  function codes(diags) { var out = []; for (var i = 0; i < diags.length; i++) out.push(diags[i].code); return out; }
  function hasCode(diags, c) { return codes(diags).indexOf(c) >= 0; }

  /* fixture：配置真源深拷贝（版本号保留草稿值，用于覆盖 version() 断言） */
  var skeleton = CFG.skillSystem;
  var DRAFT = clone(skeleton);
  DRAFT.configVersion = "skill-v1.1.0-draft";
  var raw = clone(DRAFT);
  CFG.skillSystem = clone(DRAFT);   // 供 get()/policy() 使用

  /* ============ 一、合法完整表 ============ */
  var v1 = SkillConfig.validate(raw);
  check("合法完整表 ok=true", v1.ok === true);
  check("合法完整表 无诊断（零条）", v1.diagnostics.length === 0);
  if (!v1.ok) {
    console.log("--- 诊断预览（共 " + v1.diagnostics.length + " 条）---");
    for (var vi = 0; vi < v1.diagnostics.length && vi < 30; vi++) {
      var vd = v1.diagnostics[vi];
      console.log("  [" + vd.code + "] " + vd.definitionId + " / " + vd.opId + " / " + vd.field + " : " + vd.message);
    }
  }

  /* ============ 二、定义索引冻结（合同 §5） ============ */
  check("validate.definitions 深冻结",
    Object.isFrozen(v1.definitions) && Object.isFrozen(v1.definitions.skills) &&
    Object.isFrozen(v1.definitions.skills.SK_FIREBALL) && Object.isFrozen(v1.definitions.skills.SK_FIREBALL.levels));
  var frozenProbe = SkillConfig.freezeDefinitions({ a: { b: [1, 2] } });
  check("freezeDefinitions 深冻结嵌套", Object.isFrozen(frozenProbe) && Object.isFrozen(frozenProbe.a) && Object.isFrozen(frozenProbe.a.b));

  /* ============ 三、get(kind,id) 索引命中/未命中 ============ */
  check("get 命中 skill", SkillConfig.get("skill", "SK_FIREBALL") !== null);
  check("get 命中 template", SkillConfig.get("template", "TP_FLIGHT_PROJECTILE") !== null);
  check("get 命中 crystal", SkillConfig.get("crystal", "CR_PIERCE") !== null);
  check("get 命中 quality", SkillConfig.get("quality", "Q_COMMON") !== null);
  check("get 命中 pool", SkillConfig.get("pool", "POOL_LEVELUP") !== null);
  check("get 命中 policy", SkillConfig.get("policy", "HP_MAIN_BOLT") !== null);
  check("get 未命中 skill", SkillConfig.get("skill", "SK_NOPE") === null);
  check("version() 取到草稿版本", SkillConfig.version() === "skill-v1.1.0-draft");

  /* ============ 四、逐条非法配置 → 预期原因码 ============ */
  // 重复 ID
  var rDup = clone(raw);
  rDup.skillDefs.DUP = { id: "SK_FIREBALL", nameKey: "skill.fireball", levels: clone(raw.skillDefs.SK_FIREBALL.levels),
    baseGraph: clone(raw.skillDefs.SK_FIREBALL.baseGraph), targetPolicyId: "TGT_NEAREST", castPolicyId: "CAST_COOLDOWN", rewardPoolIds: ["POOL_LEVELUP"] };
  var dDup = SkillConfig.validate(rDup).diagnostics;
  check("重复 ID → DUPLICATE_ID", hasCode(dDup, R.DUPLICATE_ID));

  // 未知执行器
  var rEx = clone(raw); rEx.crystalDefs.CR_PIERCE.operations[0].executor = "doMagic";
  check("未知执行器 → UNKNOWN_EXECUTOR", hasCode(SkillConfig.validate(rEx).diagnostics, R.UNKNOWN_EXECUTOR));

  // 坏引用：templateId
  var rT = clone(raw); rT.skillDefs.SK_FIREBALL.baseGraph.nodes[0].templateId = "TP_NOPE";
  check("坏 templateId → INVALID_REFERENCE", hasCode(SkillConfig.validate(rT).diagnostics, R.INVALID_REFERENCE));

  // 坏引用：nodeId（边终点）
  var rE = clone(raw); rE.skillDefs.SK_FIREBALL.baseGraph.edges = [{ from: "n_fireball", to: "n_missing" }];
  check("坏 nodeId（边）→ INVALID_REFERENCE", hasCode(SkillConfig.validate(rE).diagnostics, R.INVALID_REFERENCE));

  // 坏引用：poolId
  var rP = clone(raw); rP.skillDefs.SK_FIREBALL.rewardPoolIds = ["POOL_NOPE"];
  check("坏 poolId → INVALID_REFERENCE", hasCode(SkillConfig.validate(rP).diagnostics, R.INVALID_REFERENCE));

  // 坏引用：capability
  var rC = clone(raw); rC.skillDefs.SK_FIREBALL.baseGraph.nodes[0].capabilities = ["flightProjectile", "teleport"];
  check("坏 capability → INVALID_REFERENCE", hasCode(SkillConfig.validate(rC).diagnostics, R.INVALID_REFERENCE));

  // NaN / Infinity
  var rN = clone(raw); rN.effectTemplates.TP_FLIGHT_PROJECTILE.params.speed = NaN;
  check("NaN 参数 → INVALID_PARAMETER", hasCode(SkillConfig.validate(rN).diagnostics, R.INVALID_PARAMETER));
  var rInf = clone(raw); rInf.effectTemplates.TP_FLIGHT_PROJECTILE.params.radius = Infinity;
  check("Infinity 参数 → INVALID_PARAMETER", hasCode(SkillConfig.validate(rInf).diagnostics, R.INVALID_PARAMETER));

  // 负持续时间 / 零 tick
  var rNeg = clone(raw); rNeg.effectTemplates.TP_PERSISTENT_AREA.params.duration = -1;
  check("负持续时间 → INVALID_PARAMETER", hasCode(SkillConfig.validate(rNeg).diagnostics, R.INVALID_PARAMETER));
  var rTick = clone(raw); rTick.effectTemplates.TP_PERSISTENT_AREA.params.tick = 0;
  check("零 tick → INVALID_PARAMETER", hasCode(SkillConfig.validate(rTick).diagnostics, R.INVALID_PARAMETER));

  // 概率越界
  var rProb = clone(raw); rProb.crystalDefs.CR_ARCANE_AMP.levels[0].parameters = { more: 1.12, probability: 1.5 };
  check("概率越界 → INVALID_PARAMETER", hasCode(SkillConfig.validate(rProb).diagnostics, R.INVALID_PARAMETER));

  // 等级数组：空 / 空洞 / 跳号
  var rL0 = clone(raw); rL0.skillDefs.SK_FIREBALL.levels = [];
  check("等级数组为空 → LEVELS_INVALID", hasCode(SkillConfig.validate(rL0).diagnostics, R.LEVELS_INVALID));
  var rLh = clone(raw); rLh.skillDefs.SK_SHOCKWAVE.levels.length = rLh.skillDefs.SK_SHOCKWAVE.levels.length + 1;   // 制造空洞（长度 +1，不写死级数）
  check("等级数组跳号（空洞）→ LEVELS_INVALID", hasCode(SkillConfig.validate(rLh).diagnostics, R.LEVELS_INVALID));
  var rLm = clone(raw); rLm.skillDefs.SK_SHOCKWAVE.levels = { "1": { cooldown: 2.4, coefficient: 1.1 }, "3": { cooldown: 2.1, coefficient: 1.3 } };
  check("等级映射跳号 → LEVELS_INVALID", hasCode(SkillConfig.validate(rLm).diagnostics, R.LEVELS_INVALID));

  // 缺失必需字段（不得当默认无限）
  var rM = clone(raw); delete rM.skillDefs.SK_FIREBALL.targetPolicyId;
  check("缺失必需字段(targetPolicyId) → REQUIRED_FIELD", hasCode(SkillConfig.validate(rM).diagnostics, R.REQUIRED_FIELD));
  var rBd = clone(raw); delete rBd.budgetPolicies.BP_DEFAULT.maxEffectsPerHero;
  check("预算上限缺失 → REQUIRED_FIELD", hasCode(SkillConfig.validate(rBd).diagnostics, R.REQUIRED_FIELD));

  // 未知字段
  var rU = clone(raw); rU.skillDefs.SK_FIREBALL.bogusField = 1;
  check("未知字段 → UNKNOWN_FIELD", hasCode(SkillConfig.validate(rU).diagnostics, R.UNKNOWN_FIELD));

  // 阶段依赖环
  var rCyc = clone(raw);
  rCyc.crystalDefs.CR_SPLIT.operations = [
    { id: "a", executor: "spawnTemplate", phase: "deriveTemplate", selector: { read: "final" }, spawnTemplateId: "TP_FLIGHT_PROJECTILE", event: "onHit", routePolicyId: "EP_DERIVED_ONCE", dependsOn: ["b"] },
    { id: "b", executor: "spawnTemplate", phase: "deriveTemplate", selector: { read: "final" }, spawnTemplateId: "TP_FLIGHT_PROJECTILE", event: "onHit", routePolicyId: "EP_DERIVED_ONCE", dependsOn: ["a"] }
  ];
  check("阶段依赖环 → CYCLE_DEPENDENCY", hasCode(SkillConfig.validate(rCyc).diagnostics, R.CYCLE_DEPENDENCY));

  // 资源冲突：同字段多来源 exclusive
  var rXc = clone(raw);
  rXc.crystalDefs.CR_ORBIT.operations = [
    { id: "o1", executor: "structuralForm", phase: "mainForm", selector: { read: "base" }, field: "motionMode", value: "orbit", merge: "exclusive" },
    { id: "o2", executor: "structuralForm", phase: "mainForm", selector: { read: "base" }, field: "motionMode", value: "homing", merge: "exclusive" }
  ];
  check("exclusive 多来源 → MOTION_CONFLICT", hasCode(SkillConfig.validate(rXc).diagnostics, R.MOTION_CONFLICT));

  // 事件终止：事件操作缺 routePolicyId
  var rEv = clone(raw); delete rEv.crystalDefs.CR_SPLIT.operations[0].routePolicyId;
  check("事件操作缺 routePolicyId → REQUIRED_FIELD", hasCode(SkillConfig.validate(rEv).diagnostics, R.REQUIRED_FIELD));

  // 文案占位符
  var rPh = clone(raw); rPh.localization["skill.fireball"] = "TODO 火球";
  check("文案占位符 → PLACEHOLDER_TEXT", hasCode(SkillConfig.validate(rPh).diagnostics, R.PLACEHOLDER_TEXT));

  // 奖励池可达性：水晶未被任何池引用
  var rUr = clone(raw);
  rUr.rewardPools.POOL_LEVELUP.entries = rUr.rewardPools.POOL_LEVELUP.entries.filter(function (e) { return e.crystalId !== "CR_ORBIT"; });
  check("水晶不可达 → UNREACHABLE_REWARD", hasCode(SkillConfig.validate(rUr).diagnostics, R.UNREACHABLE_REWARD));

  // 诊断结构 + code ∈ Reason
  check("诊断结构字段完整(code/definitionId/opId/field/message)",
    dDup.length > 0 && dDup.every(function (d) {
      return typeof d.code === "string" && typeof d.message === "string" &&
        ("definitionId" in d) && ("opId" in d) && ("field" in d);
    }));
  check("诊断 code 均属 Reason 枚举", dDup.every(function (d) { return reasonVals.indexOf(d.code) >= 0; }));

  // 非法表整体 ok=false
  var vBad = SkillConfig.validate(null);
  check("非对象配置 ok=false 且 definitions=null", vBad.ok === false && vBad.definitions === null && vBad.diagnostics.length > 0);

  /* ============ 五、可选字段默认值来自 schema（合同 §6） ============ */
  var rDef = clone(raw);
  rDef.hitPolicies.HP_TEST_DEFAULT = { id: "HP_TEST_DEFAULT", scope: "cast+target", keyTemplate: "castId+targetId" };
  check("可选字段缺省仍合法（hit limitPerTarget 走默认）", SkillConfig.validate(rDef).ok === true);
  CFG.skillSystem = Object.assign({}, skeleton, rDef);
  var pol = SkillConfig.policy("hit", "HP_TEST_DEFAULT");
  check("policy 套用 schema 默认 limitPerTarget=1", !!(pol && pol.limitPerTarget === 1));
  check("policy 返回冻结副本", !!(pol && Object.isFrozen(pol)));
  CFG.skillSystem = clone(raw);

  /* ============ 六、表达式树拒绝函数 / eval 字符串（合同 §6） ============ */
  var rX1 = clone(raw); rX1.crystalDefs.CR_ARCANE_AMP.eligibility.cond = { all: [{ tag: "魔法" }, "eval(1)"] };
  check("表达式携带 eval 字符串 → INVALID_EXPRESSION", hasCode(SkillConfig.validate(rX1).diagnostics, R.INVALID_EXPRESSION));
  var rX2 = clone(raw); rX2.crystalDefs.CR_ARCANE_AMP.eligibility.cond = { any: [function () { return true; }] };
  check("表达式携带函数 → INVALID_EXPRESSION", hasCode(SkillConfig.validate(rX2).diagnostics, R.INVALID_EXPRESSION));
  var rX3 = clone(raw); rX3.crystalDefs.CR_ARCANE_AMP.eligibility.cond = { magic: [1] };
  check("表达式未知算子 → INVALID_EXPRESSION", hasCode(SkillConfig.validate(rX3).diagnostics, R.INVALID_EXPRESSION));

  /* ============ 七、品质档数 = 数组长度（证明未写死） ============ */
  var rQ = clone(raw);
  rQ.qualityDefs.push({ id: "Q_MYTH", nameKey: "quality.myth", rank: 5, color: "#ff5ad0", weight: 1, placement: "myth" });
  rQ.localization["quality.myth"] = "神话";
  var dQ = SkillConfig.validate(rQ);
  check("品质加第 5 档后仍 ok=true（未写死档数）", dQ.ok === true && rQ.qualityDefs.length === 5);

  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  if (failCount > 0) throw new Error("skill_config_test 失败 count=" + failCount);
`;

vm.runInContext(driver, ctx, { filename: "driver" });
