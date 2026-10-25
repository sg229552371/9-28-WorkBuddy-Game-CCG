/* 无头测试：模块水晶技能系统 · SupportCompiler（W2）
 * 运行：node skill_compiler_test.js  （或 bash run_tests.sh --suite=skill）
 * 风格参考 skill_module_test.js：vm 沙箱加载真实脚本，自建夹具定义，不依赖 config.js 内容。
 * 覆盖合同 §17：共享增幅 / 范围技能 inactive / 全排列一致 / 爆破+扩域顺序 / 升级不重复 /
 *   衍生用途保护 / 形态互斥 / 满槽满级坏引用未知执行器 / 只读冻结 / signature 稳定与变化。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---- 最小 vm 上下文（只加载 W1 的 config 桩 + W2 编译器） ---- */
const sandbox = { console: console };
vm.createContext(sandbox);
for (const f of ["mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-compiler.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
}
vm.runInContext("globalThis.__SC = SupportCompiler; globalThis.__R = SKILL_REASON;", sandbox, { filename: "export" });
const SC = sandbox.__SC;
const R = sandbox.__R;

/* ============================================================
 * 夹具定义（完全自建，不读 config.js）
 * ============================================================ */
function templateDefs() {
  return {
    TP_FLIGHT_PROJECTILE: { id: "TP_FLIGHT_PROJECTILE", kind: "template",
      capabilities: ["flightProjectile", "projectileGenerator", "steerable", "orbitAdaptable", "pierceCounter", "magicDamage"],
      tags: ["projectile", "magic", "direct"] },
    TP_ORBIT_CONTACT: { id: "TP_ORBIT_CONTACT", kind: "template",
      capabilities: ["orbitContact", "orbitGenerator", "magicDamage"],
      tags: ["orbit", "magic", "contact"] },
    TP_INSTANT_AREA: { id: "TP_INSTANT_AREA", kind: "template",
      capabilities: ["instantArea", "areaDamage", "magicDamage"],
      tags: ["area", "magic"] },
    TP_PERSISTENT_AREA: { id: "TP_PERSISTENT_AREA", kind: "template",
      capabilities: ["persistentArea", "areaDamage", "magicDamage"],
      tags: ["area", "magic", "dot"] },
  };
}

function fireballDef(withTrail) {
  const nodes = [{
    nodeId: "n_bolt", templateId: "TP_FLIGHT_PROJECTILE", role: "primary",
    capabilities: ["flightProjectile", "projectileGenerator", "steerable", "orbitAdaptable", "pierceCounter", "magicDamage"],
    tags: ["projectile", "magic", "direct"],
    parameters: { speed: 480, life: 1.6, damageMul: 1.0, count: 1, extraPierceCount: 0 },
    damageBasis: { baseRef: "SK_FIREBALL.base", coefficient: 1.0 },
    hitPolicyId: "HP_MAIN_BOLT",
  }];
  if (withTrail) {
    nodes.push({
      nodeId: "n_trail", templateId: "TP_FLIGHT_PROJECTILE", role: "derived",
      capabilities: ["flightProjectile", "pierceCounter", "magicDamage"],
      tags: ["projectile", "magic"],
      parameters: { speed: 400, life: 1.0, damageMul: 0.5 },
      damageBasis: { baseRef: "SK_FIREBALL.base", coefficient: 0.5 },
      hitPolicyId: "HP_DERIVED_BOLT",
    });
  }
  return {
    id: "SK_FIREBALL", kind: "skill", nameKey: "skill.fireball",
    levels: [
      { nodeParameters: { n_bolt: { damageMul: 1.0 } } },
      { nodeParameters: { n_bolt: { damageMul: 1.2 } } },
    ],
    targetPolicyId: "SP_NEAREST", castPolicyId: "SP_CD", rewardPoolIds: ["POOL_FIREBALL"],
    baseGraph: { nodes: nodes, edges: [] },
  };
}

function shockwaveDef() {
  return {
    id: "SK_SHOCKWAVE", kind: "skill", nameKey: "skill.shockwave",
    levels: [
      { nodeParameters: { n_area: { radius: 110 } } },
      { nodeParameters: { n_area: { radius: 130 } } },
    ],
    targetPolicyId: "SP_NEAREST", castPolicyId: "SP_CD", rewardPoolIds: ["POOL_SHOCK"],
    baseGraph: {
      nodes: [{
        nodeId: "n_area", templateId: "TP_INSTANT_AREA", role: "primary",
        capabilities: ["instantArea", "areaDamage", "magicDamage"],
        tags: ["area", "magic"],
        parameters: { radius: 110, damageMul: 1.0 },
        damageBasis: { baseRef: "SK_SHOCKWAVE.base", coefficient: 1.0 },
        hitPolicyId: "HP_AREA",
      }],
      edges: [],
    },
  };
}

function crystalDefs() {
  return {
    CR_ARCANE_AMP: { id: "CR_ARCANE_AMP", kind: "crystal", nameKey: "crystal.amp", qualityId: "Q_COMMON",
      eligibility: { read: "base", capabilitiesAny: ["magicDamage"] },
      operations: [{ id: "amp.damage", executor: "modifyParameter", phase: "nodeModify",
        selector: { capabilitiesAll: ["magicDamage"] }, field: "damageMul", parameter: "mul", merge: "multiply" }],
      levels: [{ parameters: { mul: 1.25 } }, { parameters: { mul: 1.5 } }], presentation: {} },

    CR_PIERCE: { id: "CR_PIERCE", kind: "crystal", nameKey: "crystal.pierce", qualityId: "Q_COMMON",
      operations: [{ id: "pierce.count", executor: "modifyParameter", phase: "nodeModify",
        selector: { capabilitiesAll: ["pierceCounter"] }, field: "extraPierceCount", parameter: "count", merge: "add" }],
      levels: [{ parameters: { count: 1 } }, { parameters: { count: 2 } }], presentation: {} },

    CR_MULTISHOT: { id: "CR_MULTISHOT", kind: "crystal", nameKey: "crystal.multi", qualityId: "Q_COMMON",
      operations: [
        { id: "multi.count", executor: "modifyParameter", phase: "distribute",
          selector: { capabilitiesAll: ["projectileGenerator"] }, field: "count", parameter: "count", merge: "add" },
        { id: "multi.cost", executor: "modifyParameter", phase: "nodeModify",
          selector: { capabilitiesAll: ["projectileGenerator"] }, field: "damageMul", parameter: "cost", merge: "multiply" },
      ],
      levels: [{ parameters: { count: 2, cost: 0.7 } }], presentation: {} },

    CR_ORBIT: { id: "CR_ORBIT", kind: "crystal", nameKey: "crystal.orbit", qualityId: "Q_RARE",
      operations: [{ id: "orbit.convert", executor: "convertNode", phase: "shape",
        resource: "motion.primaryProjectile",
        selector: { capabilitiesAll: ["flightProjectile", "orbitAdaptable"] },
        templateId: "TP_ORBIT_CONTACT" }],
      levels: [{ parameters: {} }, { parameters: {} }], presentation: {} },

    CR_TRACK: { id: "CR_TRACK", kind: "crystal", nameKey: "crystal.track", qualityId: "Q_RARE",
      operations: [{ id: "track.steer", executor: "modifyParameter", phase: "shape",
        resource: "motion.primaryProjectile",
        selector: { capabilitiesAll: ["steerable"] }, field: "turnRate", parameter: "turnRate", merge: "exclusive" }],
      levels: [{ parameters: { turnRate: 3.0 } }], presentation: {} },

    CR_BLAST: { id: "CR_BLAST", kind: "crystal", nameKey: "crystal.blast", qualityId: "Q_COMMON",
      operations: [{ id: "blast.spawn", executor: "addNode", phase: "derive",
        selector: { capabilitiesAll: ["flightProjectile"] }, event: "onExpire",
        spawnTemplateId: "TP_INSTANT_AREA", parameters: { radius: 90, damageMul: 1.0 },
        hitPolicyId: "HP_DERIVED_AREA" }],
      levels: [{ parameters: {} }], presentation: {} },

    CR_WIDEN: { id: "CR_WIDEN", kind: "crystal", nameKey: "crystal.widen", qualityId: "Q_COMMON",
      operations: [{ id: "widen.radius", executor: "modifyParameter", phase: "nodeModify",
        selector: { capabilitiesAll: ["areaDamage"] }, field: "radius", parameter: "mul", merge: "multiply" }],
      levels: [{ parameters: { mul: 1.5 } }], presentation: {} },

    CR_DEAD: { id: "CR_DEAD", kind: "crystal", nameKey: "crystal.dead", qualityId: "Q_COMMON",
      operations: [{ id: "dead.op", executor: "modifyParameter", phase: "nodeModify",
        selector: { capabilitiesAll: ["zzz_nope"] }, field: "x", parameter: "v", merge: "add" }],
      levels: [{ parameters: { v: 1 } }], presentation: {} },

    CR_BADREF: { id: "CR_BADREF", kind: "crystal", nameKey: "crystal.badref", qualityId: "Q_COMMON",
      operations: [{ id: "badref.spawn", executor: "addNode", phase: "derive",
        selector: { capabilitiesAll: ["flightProjectile"] }, spawnTemplateId: "TP_MISSING" }],
      levels: [{ parameters: {} }], presentation: {} },

    CR_BADEXEC: { id: "CR_BADEXEC", kind: "crystal", nameKey: "crystal.badexec", qualityId: "Q_COMMON",
      operations: [{ id: "badexec.op", executor: "frobnicate", phase: "nodeModify",
        selector: { capabilitiesAll: ["magicDamage"] }, field: "damageMul", parameter: "mul", merge: "multiply" }],
      levels: [{ parameters: { mul: 2 } }], presentation: {} },
  };
}

function makeDefs(opts) {
  opts = opts || {};
  return {
    configVersion: opts.configVersion || "skill-test-v1",
    slotCount: 4,
    budgets: { maxEffectsPerCast: 64, maxEventDepth: 2, maxEffectsPerHero: 240 },
    supportGroupRules: {},
    hitPolicies: { HP_MAIN_BOLT: {}, HP_DERIVED_BOLT: {}, HP_AREA: {}, HP_DERIVED_AREA: {} },
    skillDefs: { SK_FIREBALL: fireballDef(!!opts.withTrail), SK_SHOCKWAVE: shockwaveDef() },
    effectTemplates: templateDefs(),
    crystalDefs: crystalDefs(),
    qualityDefs: [{ id: "Q_COMMON" }, { id: "Q_RARE" }],
    rewardPools: { POOL_FIREBALL: { id: "POOL_FIREBALL" }, POOL_SHOCK: { id: "POOL_SHOCK" } },
  };
}

/* 状态构造：skills 数组 [{id,level}]，crystals 数组 [{crystalId,level}]（不排序，按传入顺序存放） */
function mkState(skills, crystals) {
  const st = { heroId: "H_TEST", slotCount: 4, skills: {}, crystals: [], groupVersion: 1 };
  for (const s of (skills || [])) st.skills[s.id] = { id: s.id, level: s.level || 1, cd: 0, cdLeft: 0 };
  for (const c of (crystals || [])) st.crystals.push({ crystalId: c.crystalId, level: c.level || 1, slot: 0 });
  return st;
}
const TWO = function () { return [{ id: "SK_FIREBALL" }, { id: "SK_SHOCKWAVE" }]; };

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutations(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}
function findExp(result, cid, sid) {
  return (result.explanations || []).find(function (e) { return e.crystalId === cid && e.skillId === sid; });
}

/* ============================================================
 * 断言工具
 * ============================================================ */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ============================================================
 * 1. 两技能共享一颗增幅（只占一槽，两条 explanation 都 applied）
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const st = mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("共享增幅：编译成功", r.ok === true);
  check("共享增幅：两技能各有构建", !!(r.builds.SK_FIREBALL && r.builds.SK_SHOCKWAVE));
  const eF = findExp(r, "CR_ARCANE_AMP", "SK_FIREBALL");
  const eS = findExp(r, "CR_ARCANE_AMP", "SK_SHOCKWAVE");
  check("共享增幅：火球 applied", eF && eF.status === "applied");
  check("共享增幅：震荡波 applied", eS && eS.status === "applied");
  check("共享增幅：火球 damageMul=1.25",
    Math.abs(r.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul - 1.25) < 1e-9);
  check("共享增幅：震荡波 damageMul=1.25",
    Math.abs(r.builds.SK_SHOCKWAVE.nodes.n_area.parameters.damageMul - 1.25) < 1e-9);
})();

/* ============================================================
 * 2. 贯穿对范围技能 inactive，且不影响它对火球的 applied
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const st = mkState(TWO(), [{ crystalId: "CR_PIERCE", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("贯穿：编译成功", r.ok === true);
  const eF = findExp(r, "CR_PIERCE", "SK_FIREBALL");
  const eS = findExp(r, "CR_PIERCE", "SK_SHOCKWAVE");
  check("贯穿：火球 applied", eF && eF.status === "applied");
  check("贯穿：震荡波 inactive", eS && eS.status === "inactive");
  check("贯穿：震荡波原因码 NO_COMPATIBLE_NODE",
    eS && eS.reasonCodes.indexOf(R.NO_COMPATIBLE_NODE) >= 0);
  check("贯穿：火球 extraPierceCount=1",
    r.builds.SK_FIREBALL.nodes.n_bolt.parameters.extraPierceCount === 1);
})();

/* ============================================================
 * 3. 所有槽位排列 → 相同构建、参数与解释（4! = 24 种装配顺序）
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const items = [
    { crystalId: "CR_ARCANE_AMP", level: 1 },
    { crystalId: "CR_PIERCE", level: 1 },
    { crystalId: "CR_WIDEN", level: 1 },
    { crystalId: "CR_BLAST", level: 1 },
  ];
  const perms = permutations(items);
  let refSig = null, refBuilds = null, refExp = null, allOk = true, sameSig = true, sameBuilds = true, sameExp = true;
  for (const p of perms) {
    const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), p), definitions: defs });
    if (!r.ok) { allOk = false; continue; }
    const bs = JSON.stringify(r.builds);
    const ex = JSON.stringify(r.explanations);
    if (refSig == null) { refSig = r.signature; refBuilds = bs; refExp = ex; }
    else {
      if (r.signature !== refSig) sameSig = false;
      if (bs !== refBuilds) sameBuilds = false;
      if (ex !== refExp) sameExp = false;
    }
  }
  check("全排列：24 种排列 " + perms.length + " 全部编译成功", perms.length === 24 && allOk);
  check("全排列：signature 逐位一致", sameSig);
  check("全排列：构建与参数逐位一致", sameBuilds);
  check("全排列：解释逐位一致", sameExp);
  /* 抽查：爆破派生节点被扩域影响（90×1.5=135） */
  const r1 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), items), definitions: defs });
  const derived = r1.builds.SK_FIREBALL.nodes["blast.spawn@n_bolt"];
  check("爆破派生范围节点存在且被扩域(135)", derived && Math.abs(derived.parameters.radius - 135) < 1e-9);
  check("扩域同时作用于震荡波(110×1.5=165)",
    Math.abs(r1.builds.SK_SHOCKWAVE.nodes.n_area.parameters.radius - 165) < 1e-9);
})();

/* ============================================================
 * 4. 爆破 + 扩域两种获取顺序结果一致
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const a = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_BLAST", level: 1 }, { crystalId: "CR_WIDEN", level: 1 }]), definitions: defs });
  const b = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_WIDEN", level: 1 }, { crystalId: "CR_BLAST", level: 1 }]), definitions: defs });
  check("爆破/扩域：两种顺序均成功", a.ok === true && b.ok === true);
  check("爆破/扩域：signature 一致", a.signature === b.signature);
  check("爆破/扩域：构建一致", JSON.stringify(a.builds) === JSON.stringify(b.builds));
  check("爆破/扩域：解释一致", JSON.stringify(a.explanations) === JSON.stringify(b.explanations));
})();

/* ============================================================
 * 5. 升级不重复叠加：同水晶 lv1→lv2 只升一级的量
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const r1 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 1 }]), definitions: defs });
  const r2 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 2 }]), definitions: defs });
  const v1 = r1.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul;
  const v2 = r2.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul;
  check("升级：lv1=1.25", Math.abs(v1 - 1.25) < 1e-9);
  check("升级：lv2=1.5（只升一级的量）", Math.abs(v2 - 1.5) < 1e-9);
  check("升级：不是 lv1×lv2 叠加（非 1.875）", Math.abs(v2 - v1 * 1.5) > 1e-9);
})();

/* ============================================================
 * 6. 衍生用途保护：环绕后贯穿唯一用途消失 → 拒绝
 * ============================================================ */
(function () {
  const defs = makeDefs({ withTrail: false });
  const st = mkState(TWO(), [{ crystalId: "CR_PIERCE", level: 1 }, { crystalId: "CR_ORBIT", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("用途保护（拒绝）：编译失败", r.ok === false);
  check("用途保护（拒绝）：原因码 EXISTING_CRYSTAL_INACTIVE",
    r.reasonCodes.indexOf(R.EXISTING_CRYSTAL_INACTIVE) >= 0);
  check("用途保护（拒绝）：不发布半成品（builds 为空）", Object.keys(r.builds).length === 0);
  const eP = findExp(r, "CR_PIERCE", "SK_FIREBALL");
  check("用途保护（拒绝）：贯穿对火球已 inactive", eP && eP.status === "inactive");
})();

/* ============================================================
 * 7. 衍生用途保护：保留派生节点或第二技能 → 允许
 * ============================================================ */
(function () {
  const defs = makeDefs({ withTrail: true });
  const st = mkState(TWO(), [{ crystalId: "CR_PIERCE", level: 1 }, { crystalId: "CR_ORBIT", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("用途保护（允许）：编译成功", r.ok === true);
  const eP = findExp(r, "CR_PIERCE", "SK_FIREBALL");
  check("用途保护（允许）：贯穿经派生节点仍 applied", eP && eP.status === "applied");
  check("用途保护（允许）：派生节点被强化 extraPierceCount=1",
    r.builds.SK_FIREBALL.nodes.n_trail.parameters.extraPierceCount === 1);
})();

/* ============================================================
 * 8. 追踪与环绕同技能冲突 → MOTION_CONFLICT
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const st = mkState(TWO(), [{ crystalId: "CR_TRACK", level: 1 }, { crystalId: "CR_ORBIT", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("形态互斥：编译失败", r.ok === false);
  check("形态互斥：原因码 MOTION_CONFLICT", r.reasonCodes.indexOf(R.MOTION_CONFLICT) >= 0);
  check("形态互斥：不发布半成品（builds 为空）", Object.keys(r.builds).length === 0);
  const eT = findExp(r, "CR_TRACK", "SK_FIREBALL");
  const eO = findExp(r, "CR_ORBIT", "SK_FIREBALL");
  check("形态互斥：追踪标记 conflict", eT && eT.status === "conflict");
  check("形态互斥：环绕标记 conflict", eO && eO.status === "conflict");
})();

/* ============================================================
 * 9. 满槽 / 满级 / 坏引用 / 未知执行器 → 对应原因码且 builds 为空
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const full = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_ARCANE_AMP" }, { crystalId: "CR_PIERCE" }, { crystalId: "CR_WIDEN" },
    { crystalId: "CR_BLAST" }, { crystalId: "CR_MULTISHOT" }]), definitions: defs });
  check("满槽：编译失败", full.ok === false);
  check("满槽：原因码 SLOTS_FULL", full.reasonCodes.indexOf(R.SLOTS_FULL) >= 0);
  check("满槽：builds 为空", Object.keys(full.builds).length === 0);

  const max = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 3 }]), definitions: defs });
  check("满级：编译失败且 MAX_LEVEL", max.ok === false && max.reasonCodes.indexOf(R.MAX_LEVEL) >= 0);
  check("满级：builds 为空", Object.keys(max.builds).length === 0);

  const badref = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_BADREF" }]), definitions: defs });
  check("坏引用：编译失败且 INVALID_REFERENCE", badref.ok === false && badref.reasonCodes.indexOf(R.INVALID_REFERENCE) >= 0);
  check("坏引用：builds 为空", Object.keys(badref.builds).length === 0);

  const badexec = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_BADEXEC" }]), definitions: defs });
  check("未知执行器：编译失败且 UNKNOWN_EXECUTOR", badexec.ok === false && badexec.reasonCodes.indexOf(R.UNKNOWN_EXECUTOR) >= 0);
  check("未知执行器：builds 为空", Object.keys(badexec.builds).length === 0);

  const missSkill = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_MISSING_CRYSTAL" }]), definitions: defs });
  check("未知水晶引用：INVALID_REFERENCE", missSkill.ok === false && missSkill.reasonCodes.indexOf(R.INVALID_REFERENCE) >= 0);
})();

/* ============================================================
 * 10. 只读冻结 + 定义未被修改
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const snapshot = JSON.stringify(defs);
  const st = mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 1 }, { crystalId: "CR_BLAST", level: 1 }]);
  const r = SC.compile({ heroId: "H_TEST", state: st, definitions: defs });
  check("只读：builds 冻结", r.ok === true && Object.isFrozen(r.builds));
  check("只读：单技能图冻结", Object.isFrozen(r.builds.SK_FIREBALL));
  check("只读：节点对象冻结", Object.isFrozen(r.builds.SK_FIREBALL.nodes.n_bolt));
  check("只读：definitions 未被原地修改", JSON.stringify(defs) === snapshot);
})();

/* ============================================================
 * 11. signature：装配顺序稳定、等级变化则变化
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const p1 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_PIERCE" }, { crystalId: "CR_ARCANE_AMP" }]), definitions: defs });
  const p2 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_ARCANE_AMP" }, { crystalId: "CR_PIERCE" }]), definitions: defs });
  const lv2 = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_PIERCE", level: 2 }, { crystalId: "CR_ARCANE_AMP" }]), definitions: defs });
  const other = SC.compile({ heroId: "H_OTHER", state: mkState(TWO(), [
    { crystalId: "CR_PIERCE" }, { crystalId: "CR_ARCANE_AMP" }]), definitions: defs });
  check("signature：同配置不同顺序稳定", p1.signature === p2.signature);
  check("signature：等级变化则变化", p1.signature !== lv2.signature);
  check("signature：英雄差异进入缓存键", p1.signature !== other.signature);
})();

/* ============================================================
 * 12. 参数与代价：扇射 +count 且 -damage（负代价不单独算收益）
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_MULTISHOT", level: 1 }]), definitions: defs });
  check("扇射：编译成功", r.ok === true);
  check("扇射：数量 1+2=3", r.builds.SK_FIREBALL.nodes.n_bolt.parameters.count === 3);
  check("扇射：代价 damageMul×0.7", Math.abs(r.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul - 0.7) < 1e-9);
  const e = findExp(r, "CR_MULTISHOT", "SK_FIREBALL");
  check("扇射：对火球 applied（含合法收益）", e && e.status === "applied");
  const eS = findExp(r, "CR_MULTISHOT", "SK_SHOCKWAVE");
  check("扇射：对震荡波 inactive（无生成器）", eS && eS.status === "inactive");
})();

/* ============================================================
 * 13. preview：装配/升级前模拟
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const three = mkState(TWO(), [{ crystalId: "CR_PIERCE" }, { crystalId: "CR_WIDEN" }, { crystalId: "CR_BLAST" }]);
  const pv = SC.preview(three, { kind: "install", crystalId: "CR_ARCANE_AMP", definitions: defs });
  check("preview 装配：合法", pv.legal === true && pv.result && pv.result.ok === true);
  check("preview 装配：nextGroup 含新水晶", pv.nextGroup.crystals.length === 4);
  check("preview 装配：groupVersion 已 +1", pv.nextGroup.groupVersion === three.groupVersion + 1);

  const fullState = mkState(TWO(), [{ crystalId: "CR_PIERCE" }, { crystalId: "CR_WIDEN" },
    { crystalId: "CR_BLAST" }, { crystalId: "CR_ARCANE_AMP" }]);
  const pvFull = SC.preview(fullState, { kind: "install", crystalId: "CR_MULTISHOT", definitions: defs });
  check("preview 满槽：拒绝且 SLOTS_FULL", pvFull.legal === false && pvFull.reasonCodes.indexOf(R.SLOTS_FULL) >= 0);

  const atMax = mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 2 }]);
  const pvMax = SC.preview(atMax, { kind: "upgrade", crystalId: "CR_ARCANE_AMP", definitions: defs });
  check("preview 满级：拒绝且 MAX_LEVEL", pvMax.legal === false && pvMax.reasonCodes.indexOf(R.MAX_LEVEL) >= 0);

  const pvUp = SC.preview(atMax, { kind: "upgrade", crystalId: "CR_PIERCE", definitions: defs });
  check("preview 升级：对未装水晶升级 → INVALID_REFERENCE", pvUp.legal === false && pvUp.reasonCodes.indexOf(R.INVALID_REFERENCE) >= 0);

  const pvDead = SC.preview(three, { kind: "install", crystalId: "CR_DEAD", definitions: defs });
  check("preview 无收益新装：拒绝且 NO_GAIN", pvDead.legal === false && pvDead.reasonCodes.indexOf(R.NO_GAIN) >= 0);
})();

/* ============================================================
 * 14. 附加 API：buildOne / explain
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const st = mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 1 }]);
  const one = SC.buildOne(st, "SK_FIREBALL", defs);
  check("buildOne：成功返回单技能图", one.ok === true && one.graph && one.graph.skillId === "SK_FIREBALL");
  check("buildOne：增幅已应用", Math.abs(one.graph.nodes.n_bolt.parameters.damageMul - 1.25) < 1e-9);
  const ex = SC.explain(one.graph, defs);
  check("explain：逐水晶输出 applied", ex.length === 1 && ex[0].status === "applied" && ex[0].skillId === "SK_FIREBALL");
  const exFull = SC.explain(null, defs);
  check("explain：空图返回空数组", Array.isArray(exFull) && exFull.length === 0);
})();

/* ============================================================
 * 15. 空槽装配：无水晶 → 基础图原样、解释为空
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), []), definitions: defs });
  check("空槽：编译成功", r.ok === true);
  check("空槽：解释为空", r.explanations.length === 0);
  check("空槽：基础参数未变(damageMul=1, pierce=0)",
    r.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul === 1 &&
    r.builds.SK_FIREBALL.nodes.n_bolt.parameters.extraPierceCount === 0);
})();

/* ============================================================
 * 16. 派生引用原始基准（不复制父节点最终伤害）
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [
    { crystalId: "CR_ARCANE_AMP", level: 1 }, { crystalId: "CR_BLAST", level: 1 }]), definitions: defs });
  const parent = r.builds.SK_FIREBALL.nodes.n_bolt;
  const derived = r.builds.SK_FIREBALL.nodes["blast.spawn@n_bolt"];
  check("派生基准：引用原始 baseRef", derived && derived.damageBasis.baseRef === "SK_FIREBALL.base");
  check("派生基准：父节点已被增幅(1.25)但派生自持基准",
    parent.parameters.damageMul === 1.25 && derived.damageBasis.baseRef === "SK_FIREBALL.base");
})();

/* ============================================================
 * 17. 事件终止：基础图成环 → CYCLE_DEPENDENCY
 * ============================================================ */
(function () {
  const defs = makeDefs();
  defs.skillDefs.SK_SHOCKWAVE.baseGraph.edges = [{ from: "n_area", to: "n_area" }];
  const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), []), definitions: defs });
  check("事件终止：编译失败", r.ok === false);
  check("事件终止：原因码 CYCLE_DEPENDENCY", r.reasonCodes.indexOf(R.CYCLE_DEPENDENCY) >= 0);
  check("事件终止：builds 为空", Object.keys(r.builds).length === 0);
})();

/* ============================================================
 * 18. 预算超限：单施放节点预算 → BUDGET_EXCEEDED
 * ============================================================ */
(function () {
  const defs = makeDefs();
  defs.budgets.maxEffectsPerCast = 1;
  const r = SC.compile({ heroId: "H_TEST", state: mkState(TWO(), [{ crystalId: "CR_BLAST", level: 1 }]), definitions: defs });
  check("预算超限：编译失败", r.ok === false);
  check("预算超限：原因码 BUDGET_EXCEEDED", r.reasonCodes.indexOf(R.BUDGET_EXCEEDED) >= 0);
  check("预算超限：builds 为空", Object.keys(r.builds).length === 0);
})();

/* ============================================================
 * 19. 每英雄不串效果：两套状态各自独立编译
 * ============================================================ */
(function () {
  const defs = makeDefs();
  const A = SC.compile({ heroId: "H_A", state: mkState(TWO(), [{ crystalId: "CR_ARCANE_AMP", level: 1 }]), definitions: defs });
  const B = SC.compile({ heroId: "H_B", state: mkState(TWO(), [{ crystalId: "CR_PIERCE", level: 1 }]), definitions: defs });
  check("英雄隔离：A 只带增幅", A.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul === 1.25 &&
    A.builds.SK_FIREBALL.nodes.n_bolt.parameters.extraPierceCount === 0);
  check("英雄隔离：B 只带贯穿", B.builds.SK_FIREBALL.nodes.n_bolt.parameters.damageMul === 1 &&
    B.builds.SK_FIREBALL.nodes.n_bolt.parameters.extraPierceCount === 1);
  check("英雄隔离：signature 不同", A.signature !== B.signature);
})();

/* ============================================================
 * 汇总
 * ============================================================ */
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("compiler suite 存在未通过项：" + failCount);
}
