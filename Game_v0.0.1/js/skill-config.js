/* ============================================================
 * skill-config.js — SkillConfig（能量水晶技能系统 · W1）
 * 职责（合同 §4）：原始表 → 校验后的定义索引；原因码枚举；策略表解析 + schema 默认值。
 * 边界：**不操作世界、不碰 UI**；不依赖 CFG 之外的任何运行态。
 * 契约：G_docs/skill_system_interface_v1.md 第三节 / 第五节
 * 真源：G_docs/skill_system_development_contract_v1.0.md §4/§5/§6/§7/§9/§17
 *
 * 设计要点：
 *   - 顶层 `const SkillConfig`（项目惯例）；额外暴露 `SKILL_REASON`。
 *   - 校验器只产出**原因码**（code）+ 中文 message；业务分支只判 code，不判文案。
 *   - 可选字段默认值统一在本文件 schema 定义（合同 §6），不散落执行器。
 *   - 缺失**必需**字段一律报错，**不得把缺失当无限**。
 *   - 配置禁止携带函数 / eval 字符串 / 任意 JS 表达式 / 文件路径（合同 §6）。
 *   - 品质档数 = qualityDefs 数组长度，**代码不写死任何档数**。
 * ============================================================ */
"use strict";

/* ------------------------------------------------------------------
 * 原因码枚举（接口文档第五节「冻结」）
 *   —— 上半 = 游戏内原因码（业务分支只判这些）
 *   —— 下半 = W1 配置诊断码（加载校验专用；业务分支不消费）
 * ------------------------------------------------------------------ */
const SKILL_REASON = {
  /* —— 游戏内（接口文档第五节，逐字冻结）—— */
  NO_COMPATIBLE_NODE: "NO_COMPATIBLE_NODE",
  NO_GAIN: "NO_GAIN",
  SLOTS_FULL: "SLOTS_FULL",
  MAX_LEVEL: "MAX_LEVEL",
  MOTION_CONFLICT: "MOTION_CONFLICT",
  EXISTING_CRYSTAL_INACTIVE: "EXISTING_CRYSTAL_INACTIVE",
  INVALID_REFERENCE: "INVALID_REFERENCE",
  UNKNOWN_EXECUTOR: "UNKNOWN_EXECUTOR",
  UNKNOWN_STAT: "UNKNOWN_STAT",
  CYCLE_DEPENDENCY: "CYCLE_DEPENDENCY",
  EVENT_BUDGET_EXCEEDED: "EVENT_BUDGET_EXCEEDED",
  DERIVED_DEPTH_EXCEEDED: "DERIVED_DEPTH_EXCEEDED",
  BUDGET_EXCEEDED: "BUDGET_EXCEEDED",
  ALREADY_COMMITTED: "ALREADY_COMMITTED",
  NO_CANDIDATE: "NO_CANDIDATE",
  PENDING: "PENDING",
  TARGET_ALREADY_HIT: "TARGET_ALREADY_HIT",
  INACTIVE_OPERATION: "INACTIVE_OPERATION",
  NOT_MIGRATED: "NOT_MIGRATED",
  UNKNOWN_ID: "UNKNOWN_ID",
  LEVEL_OVERFLOW: "LEVEL_OVERFLOW",
  REGION_MAX_DPS: "REGION_MAX_DPS",
  /* —— W1 配置诊断码（加载校验；不属于游戏内决策分支）—— */
  DUPLICATE_ID: "DUPLICATE_ID",
  REQUIRED_FIELD: "REQUIRED_FIELD",
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  LEVELS_INVALID: "LEVELS_INVALID",
  INVALID_EXPRESSION: "INVALID_EXPRESSION",
  PLACEHOLDER_TEXT: "PLACEHOLDER_TEXT",
  UNREACHABLE_REWARD: "UNREACHABLE_REWARD",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
};

/* ------------------------------------------------------------------
 * 内部工具（结构性；不含业务数值常量）
 * ------------------------------------------------------------------ */
function _isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function _isArr(v) { return Array.isArray(v); }
function _isStr(v) { return typeof v === "string"; }
function _isFiniteNum(v) { return typeof v === "number" && isFinite(v); }
function _isNonNegInt(v) { return _isFiniteNum(v) && Math.floor(v) === v && v >= 0; }
function _isPosInt(v) { return _isNonNegInt(v) && v > 0; }
function _isProb(v) { return _isFiniteNum(v) && v >= 0 && v <= 1; }
function _nonEmptyStr(v) { return _isStr(v) && v.length > 0; }
function _has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

/** 深冻结（Definition 加载后只读，合同 §5）。 */
function _deepFreeze(o) {
  if (o === null || typeof o !== "object") return o;
  if (Object.isFrozen(o)) return o;
  const keys = Object.keys(o);
  for (let i = 0; i < keys.length; i++) _deepFreeze(o[keys[i]]);
  return Object.freeze(o);
}

/* 文案占位符标记（命中即视为未填） */
const _PLACEHOLDER = /TODO|FIXME|XXX|待填|待定|占位|\?\?\?|__NAME__/i;
/* 疑似可执行代码/表达式/文件路径的字符串（配置禁令，合同 §6） */
const _CODE_TOKENS = ["eval(", "Function(", "require(", "=>", "javascript:", "process.env", "import ", "new Function"];
function _looksLikeCode(s) {
  for (let i = 0; i < _CODE_TOKENS.length; i++) {
    if (s.indexOf(_CODE_TOKENS[i]) >= 0) return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;              // 盘符绝对路径
  if (/(^|[\\/])\.\.[\\/]/.test(s)) return true;            // ../ 路径穿越
  if (/\.(js|json|exe|bat|sh|cmd|dll)$/i.test(s)) return true; // 可执行/脚本文件
  return false;
}

/* ------------------------------------------------------------------
 * 结构注册表（机制标识符；非平衡数值，允许在本文件声明）
 *   —— raw.capabilityRegistry / raw.tagRegistry 可扩展
 * ------------------------------------------------------------------ */
const _CAPABILITIES = {
  flightProjectile: 1, orbitContact: 1, instantArea: 1, persistentArea: 1,
  pierceCounter: 1, homing: 1, multishot: 1, split: 1, explosion: 1,
  areaRadius: 1, hitEvent: 1, expireEvent: 1, motionResource: 1,
  regionTick: 1, projectileSweep: 1,
  /* v2（H007 召唤）：唯一新增能力，与 orbitContact 并用（召唤物复用环绕运动）。 */
  summonUnit: 1,
};
const _TAGS = {
  "物理": 1, "魔法": 1, "投射物": 1, "范围": 1, "持续区域": 1,
  "环绕": 1, "爆炸": 1, "火焰": 1, "雷电": 1, "技能": 1, "主效果": 1, "派生": 1,
  /* v2 新增标签（与 CFG.skills / 模板表同源） */
  "召唤物": 1, "陷阱": 1, "嘲讽": 1, "治疗": 1, "光环": 1, "护罩": 1,
};

/* 执行器 / 阶段 / 合并算子 / 读取阶段（冻结枚举） */
/* 22.x 集成对齐（W6）：执行器/阶段白名单必须以**编译器的可执行实现**为准（编译器是真源）。
 * 编译器的 _EXECUTORS = modifyParameter / convertNode / addNode / removeNode / modifyStat；
 * 编译器的 _PHASE_ORDER = base → shape → distribute → derive → nodeModify（+ cast 语义标记）。 */
const _EXECUTORS = { modifyParameter: 1, convertNode: 1, addNode: 1, removeNode: 1, modifyStat: 1 };
/* phase：节点修饰/派生/形态阶段 + 「cast」施放层统计语义标记（modifyStat 用，不参与结构阶段）。 */
const _PHASE_ORDER = { base: 0, shape: 1, distribute: 2, derive: 3, nodeModify: 4, cast: 5 };
const _MERGES = { add: 1, multiply: 1, min: 1, max: 1, exclusive: 1 };
const _READS = { base: 1, final: 1 };

/* 施放层统计白名单（modifyStat 执行器 stat 硬闸门；与编译器 _STATS 同源，编译器为真源）。
 *   首版仅开 cdMul（冷却倍率，越小越快）；不在表内的 stat = 编译失败（UNKNOWN_STAT），
 *   防「配了不生效」的静默 bug。 */
const _STATS = { cdMul: 1 };

/* 模板类型 → 参数名 → 约束 (pos|nonneg|count|prob) */
const _TEMPLATE_KINDS = {
  flightProjectile: { speed: "pos", life: "pos", radius: "pos", pierce: "count" },
  orbitContact: { radius: "pos", angularSpeed: "pos", count: "count", hitInterval: "pos" },
  instantArea: { radius: "pos", life: "pos" },
  persistentArea: { radius: "pos", duration: "pos", tick: "pos", dps: "nonneg" },
  /* v2 新增（H007 召唤师）：召唤物本体属性 + 环绕半径。非伤害模板 → 见 _NON_DAMAGE_KINDS。 */
  summonUnit: { orbit: "pos", hp: "pos", atk: "pos", fireCd: "pos" },
};

/* 🔴 非伤害模板集合（白名单，不是黑名单）：**只有**在此集合内的模板 kind 允许节点缺省 damageBasis。
 * 新增模板默认仍要求伤害（fail-closed）——放行必须先显式登记到这里。 */
const _NON_DAMAGE_KINDS = { summonUnit: 1 };

/* 参数名 → 约束（跨模板/等级/节点通用） */
const _PARAM_RULES = {
  speed: "pos", life: "pos", radius: "pos", duration: "pos", tick: "pos",
  hitInterval: "pos", angularSpeed: "pos", cooldown: "pos", castTime: "nonneg",
  maxRange: "pos", radiusMul: "pos",
  count: "count", pierce: "count", extraPierceCount: "count", projectileCount: "count",
  splitCount: "count", optionCount: "count", minLevel: "count", maxLevel: "count",
  dps: "nonneg", damage: "nonneg", coefficient: "nonneg", damageRatio: "nonneg",
  more: "nonneg", lessMult: "nonneg", weight: "nonneg", rank: "nonneg",
  probability: "prob", chance: "prob", procChance: "prob", critChance: "prob",
  /* v2 附加效果数值（effect.*）：与接口文档 §1.1 字段清单逐字对应 */
  healBase: "nonneg", healPerAdd: "nonneg", scalePct: "nonneg",
  auraPct: "nonneg", auraDuration: "pos",
  barrierDef: "nonneg", barrierDuration: "pos",
  tauntDuration: "pos", armDelay: "nonneg", trapCount: "count",
  summonCount: "count", summonDuration: "pos",
  /* v2 召唤物参数（TP_SUMMON_UNIT / 节点 parameters 同源）：补强节点级正数约束 */
  orbit: "pos", hp: "pos", atk: "pos", fireCd: "pos",
};

/* v2 效果类型白名单（节点可选字段 effect.kind） */
const _EFFECT_KINDS = { heal: 1, aura: 1, barrier: 1, taunt: 1, trap: 1, summon: 1 };
/* 效果缩放/增益属性白名单（effect.scaleStat / effect.auraStats），与旧表 scaleBy.stat 同源 */
const _EFFECT_STATS = { atk: 1, def: 1, spd: 1, energyMax: 1 };

/* 各类定义的字段白名单（未知字段 = UNKNOWN_FIELD） */
const _FIELDS = {
  skill: ["id", "nameKey", "levels", "baseGraph", "targetPolicyId", "castPolicyId", "rewardPoolIds", "detailKey"],
  template: ["id", "kind", "params", "defaults", "nameKey", "detailKey", "capabilities", "tags"],
  crystal: ["id", "nameKey", "qualityId", "eligibility", "operations", "levels", "conflicts", "hidden", "presentation", "tags"],
  quality: ["id", "nameKey", "rank", "color", "weight", "placement"],
  pool: ["id", "entries", "nameKey"],
  node: ["nodeId", "templateId", "role", "tags", "capabilities", "parameters", "damageBasis", "hitPolicyId", "effect"],
  op: ["id", "executor", "phase", "selector", "field", "parameter", "merge", "event",
    "sourceSelector", "spawnTemplateId", "damageBasisRef", "inheritFactors", "routePolicyId", "dependsOn", "value",
    /* 22.x 集成新增（编译器 convertNode/addNode 使用）：资源组声明、派生节点参数与命中策略 */
    "resource", "hitPolicyId", "coefficient", "parameters", "newNodeId", "capabilities", "role",
    /* 22.4 #12 新增：convertNode 声明施放策略覆盖（环绕 → CAST_ORBIT），编译产物携带、调度器优先读取 */
    "castPolicyId",
    /* 施放层统计新增：modifyStat 目标字段名（白名单见 _STATS） */
    "stat",
    /* 22.8 扩容新增（运行时消费，编译器不解释）：
     *   targeting → 派生目标选择（"nearestOther" = 朝另一个敌人；缺省 = 现状）
     *   attach    → 效果附着（"target" = 跟随目标坐标；缺省 = 现状） */
    "targeting", "attach"],
  eligibility: ["read", "capabilitiesAny", "capabilitiesAll", "tagsAny", "tagsAll", "cond"],
  selector: ["read", "capabilitiesAll", "capabilitiesAny", "tagsAll", "tagsAny"],
  damageBasis: ["baseRef", "coefficient", "inheritFactorKeys"],
  presentation: ["nameKey", "detailKey"],
  /* v2 节点可选字段 effect 的字段白名单（跨 kind 全集；逐 kind 的必需性在 _validateEffect 判定） */
  effect: ["kind",
    "healBase", "healPerAdd", "scaleStat", "scalePct",
    "auraDuration", "auraPct", "auraStats",
    "barrierDuration", "barrierDef",
    "tauntDuration",
    "armDelay", "trapCount",
    "summonId", "summonCount", "summonDuration"],
};

/* 策略 schema：可选字段默认值（合同 §6，缺失必需字段另报错，不得默认无限）*/
const _POLICY_DEFAULTS = {
  hit: { limitPerTarget: 1 },
  stack: { sharedClock: true },
  event: {},
  budget: { overloadPolicy: "reject" },
  reward: { optionCount: 1, weights: {}, fallback: "attribute", dedupeBy: "id" },
  target: { mode: "nearest", tieBreak: "stableId" },
  cast: { requiresTarget: true, trigger: "cooldown" },
};
const _POLICY_TABLE = {
  hit: "hitPolicies", stack: "stackPolicies", event: "eventPolicies", budget: "budgetPolicies",
  reward: "rewardPolicies", target: "targetPolicies", cast: "castPolicies",
};

/* ==================================================================
 * 校验子过程（全部通过 D(code, defId, opId, field, message) 汇报）
 * ================================================================== */

/** 必需字段存在性（缺失 = REQUIRED_FIELD，绝不默认为无限）。 */
function _requireFields(def, required, did, opId, D) {
  for (let i = 0; i < required.length; i++) {
    const f = required[i];
    if (!_has(def, f) || def[f] === undefined) {
      D(SKILL_REASON.REQUIRED_FIELD, did, opId, f, "缺失必需字段: " + f);
    }
  }
}

/** 未知字段（不在白名单 = UNKNOWN_FIELD）。 */
function _allowFields(def, allowed, did, opId, D) {
  const keys = Object.keys(def);
  for (let i = 0; i < keys.length; i++) {
    if (allowed.indexOf(keys[i]) < 0) {
      D(SKILL_REASON.UNKNOWN_FIELD, did, opId, keys[i], "未知字段: " + keys[i]);
    }
  }
}

/** 单个参数值按名称规则校验：返回 null 通过，否则返回中文原因。 */
function _paramFail(name, value, rules) {
  const rule = rules[name];
  if (rule === "pos") { return (_isFiniteNum(value) && value > 0) ? null : "必须为大于 0 的有限数值"; }
  if (rule === "nonneg") { return (_isFiniteNum(value) && value >= 0) ? null : "必须为非负有限数值"; }
  if (rule === "count") { return _isNonNegInt(value) ? null : "必须为非负整数"; }
  if (rule === "prob") { return _isProb(value) ? null : "必须为 0~1 的概率"; }
  /* 未登记名称：只禁止 NaN/Infinity（含隐式字符串当数值）*/
  if (typeof value === "number" && !isFinite(value)) { return "数值不得为 NaN/Infinity"; }
  return null;
}

/** 参数袋校验（模板 params / 节点 parameters / 等级 parameters）。 */
function _validateParams(params, did, opId, field, D, extraRules) {
  if (!_isObj(params)) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field, field + " 必须为对象"); return; }
  const rules = extraRules ? Object.assign({}, _PARAM_RULES, extraRules) : _PARAM_RULES;
  const keys = Object.keys(params);
  for (let i = 0; i < keys.length; i++) {
    const why = _paramFail(keys[i], params[keys[i]], rules);
    if (why) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field + "." + keys[i], "参数 " + keys[i] + " " + why); }
  }
}

/** 标签引用（非空字符串数组 + 注册表命中）。 */
function _validateTagList(list, did, opId, field, D, tags) {
  if (list === undefined) return;
  if (!_isArr(list)) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field, field + " 必须为字符串数组"); return; }
  for (let i = 0; i < list.length; i++) {
    if (!_nonEmptyStr(list[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field, field + " 元素必须为非空字符串"); }
    else if (!tags[list[i]]) { D(SKILL_REASON.INVALID_REFERENCE, did, opId, field, "未知标签: " + list[i]); }
  }
}

/** 能力引用（非空字符串数组 + 注册表命中）。 */
function _validateCapList(list, did, opId, field, D, caps) {
  if (list === undefined) return;
  if (!_isArr(list)) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field, field + " 必须为字符串数组"); return; }
  for (let i = 0; i < list.length; i++) {
    if (!_nonEmptyStr(list[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, field, field + " 元素必须为非空字符串"); }
    else if (!caps[list[i]]) { D(SKILL_REASON.INVALID_REFERENCE, did, opId, field, "未知能力: " + list[i]); }
  }
}

/** 伤害基准（baseRef 非空字符串 / coefficient 非负有限 / inheritFactorKeys 字符串数组）。 */
function _validateDamageBasis(db, did, opId, D) {
  if (!_isObj(db)) { D(SKILL_REASON.REQUIRED_FIELD, did, opId, "damageBasis", "damageBasis 必须为对象"); return; }
  _allowFields(db, _FIELDS.damageBasis, did, opId, D);
  if (!_nonEmptyStr(db.baseRef)) { D(SKILL_REASON.REQUIRED_FIELD, did, opId, "damageBasis.baseRef", "damageBasis.baseRef 必须为非空字符串"); }
  if (!_isFiniteNum(db.coefficient) || db.coefficient < 0) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, "damageBasis.coefficient", "damageBasis.coefficient 必须为非负有限数值"); }
  if (!_isArr(db.inheritFactorKeys)) { D(SKILL_REASON.REQUIRED_FIELD, did, opId, "damageBasis.inheritFactorKeys", "inheritFactorKeys 必须为字符串数组"); }
  else {
    for (let i = 0; i < db.inheritFactorKeys.length; i++) {
      if (!_nonEmptyStr(db.inheritFactorKeys[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, opId, "damageBasis.inheritFactorKeys", "继承系数名必须为非空字符串"); }
    }
  }
}

/** 表达式树（只允许 all/any/not/tag/capability/paramXX，禁止函数与任意表达式）。 */
function _validateExpression(node, did, opId, field, D, caps, tags, depth) {
  depth = depth || 0;
  if (depth > 32) { D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, "表达式嵌套过深"); return; }
  if (typeof node === "function") { D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, "表达式不得为函数"); return; }
  if (_isStr(node)) {
    const why = _looksLikeCode(node) ? "表达式不得为可执行字符串" : "表达式节点不得为裸字符串";
    D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, why); return;
  }
  if (!_isObj(node)) { D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, "表达式必须为对象"); return; }
  const keys = Object.keys(node);
  if (keys.length !== 1) { D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, "表达式节点必须恰有一个键"); return; }
  const k = keys[0], v = node[k];
  if (k === "all" || k === "any") {
    if (!_isArr(v) || v.length === 0) { D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, k + " 必须为非空数组"); return; }
    for (let i = 0; i < v.length; i++) _validateExpression(v[i], did, opId, field, D, caps, tags, depth + 1);
  } else if (k === "not") {
    _validateExpression(v, did, opId, field, D, caps, tags, depth + 1);
  } else if (k === "tag") {
    if (!_nonEmptyStr(v) || !tags[v]) { D(SKILL_REASON.INVALID_REFERENCE, did, opId, field, "未知标签引用: " + v); }
  } else if (k === "capability") {
    if (!_nonEmptyStr(v) || !caps[v]) { D(SKILL_REASON.INVALID_REFERENCE, did, opId, field, "未知能力引用: " + v); }
  } else if (/^param(Lte|Lt|Gte|Gt|Eq)$/.test(k)) {
    if (!_isArr(v) || v.length !== 2 || !_nonEmptyStr(v[0]) || !_isFiniteNum(v[1])) {
      D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, k + " 必须为 [路径, 有限数值]");
    }
  } else {
    D(SKILL_REASON.INVALID_EXPRESSION, did, opId, field, "未知表达式算子: " + k);
  }
}

/** eligibility 块。 */
function _validateEligibility(e, did, D, caps, tags) {
  if (!_isObj(e)) { D(SKILL_REASON.REQUIRED_FIELD, did, null, "eligibility", "eligibility 必须为对象"); return; }
  _allowFields(e, _FIELDS.eligibility, did, null, D);
  if (!_READS[e.read]) { D(SKILL_REASON.REQUIRED_FIELD, did, null, "eligibility.read", "eligibility.read 必须为 base 或 final"); }
  _validateCapList(e.capabilitiesAny, did, null, "eligibility.capabilitiesAny", D, caps);
  _validateCapList(e.capabilitiesAll, did, null, "eligibility.capabilitiesAll", D, caps);
  _validateTagList(e.tagsAny, did, null, "eligibility.tagsAny", D, tags);
  _validateTagList(e.tagsAll, did, null, "eligibility.tagsAll", D, tags);
  if (e.cond !== undefined) _validateExpression(e.cond, did, null, "eligibility.cond", D, caps, tags, 0);
}

/** selector 块。 */
function _validateSelector(sel, did, opId, D, caps, tags) {
  if (!_isObj(sel)) { D(SKILL_REASON.REQUIRED_FIELD, did, opId, "selector", "selector 必须为对象"); return; }
  _allowFields(sel, _FIELDS.selector, did, opId, D);
  if (!_READS[sel.read]) { D(SKILL_REASON.REQUIRED_FIELD, did, opId, "selector.read", "selector.read 必须为 base 或 final"); }
  _validateCapList(sel.capabilitiesAll, did, opId, "selector.capabilitiesAll", D, caps);
  _validateCapList(sel.capabilitiesAny, did, opId, "selector.capabilitiesAny", D, caps);
  _validateTagList(sel.tagsAll, did, opId, "selector.tagsAll", D, tags);
  _validateTagList(sel.tagsAny, did, opId, "selector.tagsAny", D, tags);
}

/** 效果节点。 */
function _validateNode(n, did, templates, hits, D, caps, tags, nodeIds, local) {
  if (!_isObj(n)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "baseGraph.nodes[]", "节点必须为对象"); return; }
  _allowFields(n, _FIELDS.node, did, null, D);
  /* damageBasis 条件必填（v2 §3 变更 6，**唯一放宽的既有硬约束**）：
   *   模板 kind ∈ _NON_DAMAGE_KINDS（非伤害白名单）→ 允许缺省；
   *   其余模板（含全部既有 4 类）→ 仍强制必填。
   * ⚠️ 用白名单而非黑名单：模板非法/未知时 tplDef 为空 → nonDamage=false → 仍要求伤害（fail-closed）。 */
  const tplDef = _nonEmptyStr(n.templateId) ? templates[n.templateId] : null;
  const nonDamage = !!(tplDef && _NON_DAMAGE_KINDS[tplDef.kind]);
  const required = ["nodeId", "templateId", "role", "tags", "capabilities", "parameters", "hitPolicyId"];
  if (!nonDamage) required.push("damageBasis");
  _requireFields(n, required, did, null, D);
  if (_nonEmptyStr(n.nodeId)) {
    if (nodeIds[n.nodeId]) { D(SKILL_REASON.DUPLICATE_ID, did, n.nodeId, "nodeId", "同一图内 nodeId 重复: " + n.nodeId); }
    else { nodeIds[n.nodeId] = true; }
  } else { D(SKILL_REASON.REQUIRED_FIELD, did, null, "nodeId", "nodeId 必须为非空字符串"); }
  if (n.role !== "primary" && n.role !== "derived") { D(SKILL_REASON.INVALID_PARAMETER, did, n.nodeId, "role", "role 必须为 primary 或 derived"); }
  if (!templates[n.templateId]) { D(SKILL_REASON.INVALID_REFERENCE, did, n.nodeId, "templateId", "模板不存在: " + n.templateId); }
  _validateTagList(n.tags, did, n.nodeId, "tags", D, tags);
  _validateCapList(n.capabilities, did, n.nodeId, "capabilities", D, caps);
  _validateParams(n.parameters, did, n.nodeId, "parameters", D, null);
  if (n.damageBasis !== undefined) _validateDamageBasis(n.damageBasis, did, n.nodeId, D);
  if (n.effect !== undefined) _validateEffect(n.effect, did, n.nodeId, D);
  if (!hits[n.hitPolicyId]) { D(SKILL_REASON.INVALID_REFERENCE, did, n.nodeId, "hitPolicyId", "命中策略不存在: " + n.hitPolicyId); }
}

/** 效果字段（v2 增量 · 节点可选字段 effect）。
 *   校验：kind ∈ _EFFECT_KINDS；字段白名单；逐 kind 必需字段；scaleStat/auraStats 取值白名单。
 *   缺省 effect = 纯伤害（与 v1 的 H001~H006 完全一致，向后兼容）。 */
function _validateEffect(e, did, nodeId, D) {
  if (!_isObj(e)) { D(SKILL_REASON.REQUIRED_FIELD, did, nodeId, "effect", "effect 必须为对象"); return; }
  _allowFields(e, _FIELDS.effect, did, nodeId, D);
  if (!_nonEmptyStr(e.kind) || !_EFFECT_KINDS[e.kind]) {
    D(SKILL_REASON.INVALID_PARAMETER, did, nodeId, "effect.kind", "未知效果类型: " + e.kind);
    return;
  }
  const kind = e.kind;
  const req = function (f) {
    if (e[f] === undefined) D(SKILL_REASON.REQUIRED_FIELD, did, nodeId, "effect." + f, "effect(" + kind + ") 缺少必需字段: " + f);
  };
  const cfg = function (f) {
    if (e[f] === undefined) return;
    const why = _paramFail(f, e[f], _PARAM_RULES);
    if (why) D(SKILL_REASON.INVALID_PARAMETER, did, nodeId, "effect." + f, "effect." + f + " " + why);
  };
  if (e.scaleStat !== undefined && (!_nonEmptyStr(e.scaleStat) || !_EFFECT_STATS[e.scaleStat])) {
    D(SKILL_REASON.INVALID_REFERENCE, did, nodeId, "effect.scaleStat", "未知缩放属性: " + e.scaleStat);
  }
  cfg("scalePct");
  if (kind === "heal") {
    req("healBase"); cfg("healBase"); cfg("healPerAdd");
  } else if (kind === "aura") {
    req("auraPct"); req("auraDuration"); cfg("auraPct"); cfg("auraDuration");
    if (e.auraStats !== undefined) {
      if (!_isArr(e.auraStats)) { D(SKILL_REASON.INVALID_PARAMETER, did, nodeId, "effect.auraStats", "auraStats 必须为字符串数组"); }
      else for (let i = 0; i < e.auraStats.length; i++) {
        if (!_nonEmptyStr(e.auraStats[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, nodeId, "effect.auraStats", "auraStats 元素必须为非空字符串"); }
        else if (!_EFFECT_STATS[e.auraStats[i]]) { D(SKILL_REASON.INVALID_REFERENCE, did, nodeId, "effect.auraStats", "未知增益属性: " + e.auraStats[i]); }
      }
    }
  } else if (kind === "barrier") {
    req("barrierDef"); req("barrierDuration"); cfg("barrierDef"); cfg("barrierDuration");
  } else if (kind === "taunt") {
    req("tauntDuration"); cfg("tauntDuration");
  } else if (kind === "trap") {
    req("armDelay"); cfg("armDelay"); cfg("trapCount");
  } else if (kind === "summon") {
    if (!_nonEmptyStr(e.summonId)) D(SKILL_REASON.REQUIRED_FIELD, did, nodeId, "effect.summonId", "effect(summon) 缺少必需字段: summonId");
    req("summonCount"); cfg("summonCount"); cfg("summonDuration");
  }
}

/** 单个 operation。 */
function _validateOperation(op, did, templates, events, D, caps, tags, opIds) {
  if (!_isObj(op)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "operations[]", "operation 必须为对象"); return; }
  _allowFields(op, _FIELDS.op, did, op.id, D);
  /* selector：节点修饰/派生/换形类执行器必填；施放层统计（modifyStat）不匹配节点 → 可省。 */
  if (op.executor === "modifyStat") {
    _requireFields(op, ["id", "executor", "phase"], did, op.id, D);
  } else {
    _requireFields(op, ["id", "executor", "phase", "selector"], did, op.id, D);
  }
  if (_nonEmptyStr(op.id)) {
    if (opIds[op.id]) { D(SKILL_REASON.DUPLICATE_ID, did, op.id, "id", "同一水晶内 operation id 重复: " + op.id); }
    else { opIds[op.id] = true; }
  } else { D(SKILL_REASON.REQUIRED_FIELD, did, null, "id", "operation id 必须为非空字符串"); }
  if (!op.executor || !_EXECUTORS[op.executor]) { D(SKILL_REASON.UNKNOWN_EXECUTOR, did, op.id, "executor", "未知执行器: " + op.executor); }
  if (!_isStr(op.phase) || !_has(_PHASE_ORDER, op.phase)) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "phase", "未知阶段: " + op.phase); }
  /* modifyStat 省略 selector 时跳过校验；显式给出则照常校验（保持既有执行器行为不变）。 */
  if (op.executor !== "modifyStat" || op.selector !== undefined) {
    _validateSelector(op.selector, did, op.id, D, caps, tags);
  }
  if (op.merge !== undefined && !_MERGES[op.merge]) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "merge", "未知合并算子: " + op.merge); }
  if (op.executor === "modifyParameter") {
    if (!_nonEmptyStr(op.field)) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "field", "modifyParameter 必须提供 field"); }
    if (!_nonEmptyStr(op.parameter)) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "parameter", "modifyParameter 必须提供 parameter"); }
    if (op.merge === undefined) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "merge", "modifyParameter 必须提供 merge"); }
  }
  /* 施放层统计（modifyStat）：写入编译产物 build.castStats，不作用于节点。
   * stat 必须落在 _STATS 白名单内（硬闸门），parameter 为等级表取值键，merge 必填。 */
  if (op.executor === "modifyStat") {
    if (!_nonEmptyStr(op.stat)) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "stat", "modifyStat 必须提供 stat"); }
    else if (!_STATS[op.stat]) { D(SKILL_REASON.UNKNOWN_STAT, did, op.id, "stat", "未知施放层统计: " + op.stat); }
    if (!_nonEmptyStr(op.parameter)) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "parameter", "modifyStat 必须提供 parameter"); }
    if (op.merge === undefined) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "merge", "modifyStat 必须提供 merge"); }
  }
  /* 22.x 集成对齐：派生/换形执行器（编译器的 addNode / convertNode）必须给出存在的模板 */
  if ((op.executor === "addNode" || op.executor === "convertNode") && !templates[op.spawnTemplateId]) {
    D(SKILL_REASON.INVALID_REFERENCE, did, op.id, "spawnTemplateId", "派生/换形模板不存在: " + op.spawnTemplateId);
  }
  /* 事件操作必须声明终止策略（合同 §6 §9：事件终止必填）*/
  if (op.event !== undefined) {
    if (!_nonEmptyStr(op.event)) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "event", "event 必须为非空字符串"); }
    if (!_nonEmptyStr(op.routePolicyId)) { D(SKILL_REASON.REQUIRED_FIELD, did, op.id, "routePolicyId", "事件操作必须提供 routePolicyId"); }
    else if (!events[op.routePolicyId]) { D(SKILL_REASON.INVALID_REFERENCE, did, op.id, "routePolicyId", "routePolicyId 不存在: " + op.routePolicyId); }
  }
  if (op.sourceSelector !== undefined) _validateSelector(op.sourceSelector, did, op.id, D, caps, tags);
  if (op.inheritFactors !== undefined) {
    if (!_isArr(op.inheritFactors)) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "inheritFactors", "inheritFactors 必须为字符串数组"); }
    else for (let i = 0; i < op.inheritFactors.length; i++) {
      if (!_nonEmptyStr(op.inheritFactors[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "inheritFactors", "继承系数名必须为非空字符串"); }
    }
  }
  if (op.dependsOn !== undefined) {
    if (!_isArr(op.dependsOn)) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "dependsOn", "dependsOn 必须为数组"); }
    else for (let i = 0; i < op.dependsOn.length; i++) {
      if (!_nonEmptyStr(op.dependsOn[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, op.id, "dependsOn", "依赖项必须为 operation id 字符串"); }
    }
  }
}

/** 阶段依赖环检测（合同 §6/§8：禁循环依赖）→ CYCLE_DEPENDENCY。 */
function _checkOpCycles(ops, did, D) {
  const byId = {};
  for (let i = 0; i < ops.length; i++) { if (_isObj(ops[i]) && _nonEmptyStr(ops[i].id)) byId[ops[i].id] = ops[i]; }
  const state = {};            // 0=未访问 1=在栈 2=完成
  let cyclic = false;
  function visit(op) {
    const id = op.id;
    if (state[id] === 1) { cyclic = true; return; }
    if (state[id] === 2) return;
    state[id] = 1;
    const deps = _isArr(op.dependsOn) ? op.dependsOn : [];
    for (let i = 0; i < deps.length; i++) {
      const dep = byId[deps[i]];
      if (!dep) { D(SKILL_REASON.INVALID_REFERENCE, did, id, "dependsOn", "依赖的 operation 不存在: " + deps[i]); continue; }
      visit(dep);
    }
    state[id] = 2;
  }
  for (let i = 0; i < ops.length; i++) { if (_isObj(ops[i]) && _nonEmptyStr(ops[i].id)) visit(ops[i]); }
  if (cyclic) { D(SKILL_REASON.CYCLE_DEPENDENCY, did, null, "operations.dependsOn", "阶段依赖成环（operation 依赖图存在环）"); }
}

/** 资源冲突：同一水晶内同字段多来源 exclusive → MOTION_CONFLICT（合同 §9）。 */
function _checkExclusiveConflicts(ops, did, D) {
  const seen = {};
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!_isObj(op) || op.merge !== "exclusive" || !_nonEmptyStr(op.field)) continue;
    if (seen[op.field]) {
      D(SKILL_REASON.MOTION_CONFLICT, did, op.id, "field", "同一水晶内字段 " + op.field + " 存在多个 exclusive 来源");
    } else { seen[op.field] = true; }
  }
}

/** 等级数组：数组须非空且无空洞；亦支持 {1:..,2:..} 映射并要求连续。 */
function _validateLevelsShape(levels, did, D, section) {
  let arr = null;
  if (_isArr(levels)) {
    if (levels.length === 0) { D(SKILL_REASON.LEVELS_INVALID, did, null, section, section + " 不能为空数组"); return null; }
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] === undefined) { D(SKILL_REASON.LEVELS_INVALID, did, null, section + "[" + i + "]", "等级数组存在跳号（下标 " + i + " 为空）"); return null; }
    }
    arr = levels;
  } else if (_isObj(levels)) {
    const nums = Object.keys(levels).map(Number).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; });
    if (nums.length === 0) { D(SKILL_REASON.LEVELS_INVALID, did, null, section, section + " 不能为空"); return null; }
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) { D(SKILL_REASON.LEVELS_INVALID, did, null, section, section + " 等级必须从 1 起连续"); return null; }
    }
    arr = nums.map(function (n) { return levels[String(n)]; });
  } else {
    D(SKILL_REASON.REQUIRED_FIELD, did, null, section, section + " 必须为等级数组"); return null;
  }
  return arr;
}

/** 技能等级：每级为完整参数字袋。 */
function _validateSkillLevels(levels, did, D) {
  const arr = _validateLevelsShape(levels, did, D, "levels");
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    if (!_isObj(arr[i])) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "levels[" + (i + 1) + "]", "每级必须为完整参数对象"); continue; }
    _validateParams(arr[i], did, null, "levels[" + (i + 1) + "]", D, null);
  }
}

/** 水晶等级：每级为 { parameters: {...} }。 */
function _validateCrystalLevels(levels, did, D) {
  const arr = _validateLevelsShape(levels, did, D, "levels");
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    const lv = arr[i];
    if (!_isObj(lv) || !_isObj(lv.parameters)) { D(SKILL_REASON.REQUIRED_FIELD, did, null, "levels[" + (i + 1) + "].parameters", "每级必须包含 parameters 对象"); continue; }
    _allowFields(lv, ["parameters"], did, null, D);
    _validateParams(lv.parameters, did, null, "levels[" + (i + 1) + "].parameters", D, null);
  }
}

/** 收集「对象映射」定义（键应等于 id；重复逻辑 id = DUPLICATE_ID）。 */
function _collectMap(map, section, D) {
  const out = {};
  if (map === undefined || map === null) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section, "配置缺少章节: " + section); return out; }
  if (!_isObj(map)) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section, section + " 必须为对象映射"); return out; }
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i], def = map[key];
    if (!_isObj(def)) { D(SKILL_REASON.REQUIRED_FIELD, key, null, section + "." + key, "定义必须为对象"); continue; }
    if (!_nonEmptyStr(def.id)) { D(SKILL_REASON.REQUIRED_FIELD, key, null, "id", "定义缺少非空 id"); continue; }
    const id = def.id;
    if (out[id]) { D(SKILL_REASON.DUPLICATE_ID, id, null, section, "重复 ID: " + id); continue; }
    out[id] = def;
    if (key !== id) { D(SKILL_REASON.INVALID_REFERENCE, id, null, "id", "映射键与定义 id 不一致: " + key); }
  }
  return out;
}

/** 收集「数组」定义（品质表）。 */
function _collectList(arr, section, D) {
  const list = [], byId = {};
  if (arr === undefined || arr === null) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section, "配置缺少章节: " + section); return { list: list, byId: byId }; }
  if (!_isArr(arr)) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section, section + " 必须为数组"); return { list: list, byId: byId }; }
  if (arr.length === 0) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section, section + " 不能为空数组"); return { list: list, byId: byId }; }
  for (let i = 0; i < arr.length; i++) {
    const def = arr[i];
    if (!_isObj(def)) { D(SKILL_REASON.REQUIRED_FIELD, null, null, section + "[" + i + "]", "定义必须为对象"); continue; }
    if (!_nonEmptyStr(def.id)) { D(SKILL_REASON.REQUIRED_FIELD, null, null, "id", "定义缺少非空 id"); continue; }
    if (byId[def.id]) { D(SKILL_REASON.DUPLICATE_ID, def.id, null, section, "重复 ID: " + def.id); continue; }
    byId[def.id] = def; list.push(def);
  }
  return { list: list, byId: byId };
}

/** 文案键校验（存在 + 非占位）。 */
function _nameKey(key, field, did, D, local, section) {
  if (!_nonEmptyStr(key)) { D(SKILL_REASON.PLACEHOLDER_TEXT, did, null, field, field + " 必须为非空字符串"); return; }
  const v = local[key];
  if (!_nonEmptyStr(v)) { D(SKILL_REASON.PLACEHOLDER_TEXT, did, null, field, "文案键未在 localization 提供: " + key); return; }
  if (_PLACEHOLDER.test(v)) { D(SKILL_REASON.PLACEHOLDER_TEXT, did, null, field, "文案含占位符: " + key); }
}

/** 深度扫描配置：禁止函数 / 可执行字符串（合同 §6）。 */
function _scanForbidden(o, D, path, seen, depth) {
  depth = depth || 0;
  if (depth > 48 || o === null || typeof o !== "object") {
    if (typeof o === "string" && _looksLikeCode(o)) { D(SKILL_REASON.INVALID_EXPRESSION, null, null, path, "配置不得携带可执行字符串"); }
    if (typeof o === "function") { D(SKILL_REASON.INVALID_EXPRESSION, null, null, path, "配置不得携带函数"); }
    return;
  }
  if (typeof o === "function") { D(SKILL_REASON.INVALID_EXPRESSION, null, null, path, "配置不得携带函数"); return; }
  if (seen.indexOf(o) >= 0) return;
  seen.push(o);
  const keys = Object.keys(o);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], v = o[k];
    if (typeof v === "function") { D(SKILL_REASON.INVALID_EXPRESSION, null, null, path ? path + "." + k : k, "配置不得携带函数"); continue; }
    if (typeof v === "string") {
      if (_looksLikeCode(v)) { D(SKILL_REASON.INVALID_EXPRESSION, null, null, path ? path + "." + k : k, "配置不得携带可执行字符串"); }
      continue;
    }
    if (v !== null && typeof v === "object") _scanForbidden(v, D, path ? path + "." + k : k, seen, depth + 1);
  }
}

/** 策略表校验（必需字段缺失 = REQUIRED_FIELD；上限一律不得缺省）。 */
function _validatePolicies(raw, D, knownTemplateSkillIds) {
  const numKeys = function (tbl, name, keys, sec) {
    const ids = Object.keys(tbl);
    for (let i = 0; i < ids.length; i++) {
      const p = tbl[ids[i]], pid = p.id;
      _requireFields(p, ["id"].concat(keys), pid, null, D);
      for (let j = 0; j < keys.length; j++) {
        if (_has(p, keys[j]) && !_isPosInt(p[keys[j]])) { D(SKILL_REASON.INVALID_PARAMETER, pid, null, keys[j], keys[j] + " 必须为正整数"); }
      }
    }
  };
  const hitIds = Object.keys(raw.hitPolicies);
  for (let i = 0; i < hitIds.length; i++) {
    const p = raw.hitPolicies[hitIds[i]];
    if (_has(p, "limitPerTarget") && !_isNonNegInt(p.limitPerTarget)) { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "limitPerTarget", "limitPerTarget 必须为非负整数"); }
    if (!_nonEmptyStr(p.keyTemplate)) { D(SKILL_REASON.REQUIRED_FIELD, p.id, null, "keyTemplate", "keyTemplate 必须为非空字符串"); }
    if (!_nonEmptyStr(p.scope)) { D(SKILL_REASON.REQUIRED_FIELD, p.id, null, "scope", "scope 必须为非空字符串"); }
  }
  /* 栈策略：mode 必填，sharedClock 缺省来自 schema */
  const stkIds = Object.keys(raw.stackPolicies);
  for (let i = 0; i < stkIds.length; i++) {
    const p = raw.stackPolicies[stkIds[i]];
    _requireFields(p, ["id", "mode"], p.id, null, D);
    if (_has(p, "sharedClock") && typeof p.sharedClock !== "boolean") { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "sharedClock", "sharedClock 必须为布尔值"); }
  }
  /* 事件策略：终止条件必填（深度/次数/预算） */
  const evIds = Object.keys(raw.eventPolicies);
  for (let i = 0; i < evIds.length; i++) {
    const p = raw.eventPolicies[evIds[i]];
    _requireFields(p, ["id", "sourceWhitelist", "allowedOps", "maxDepth", "maxCount", "perCastBudget", "terminateCond"], p.id, null, D);
    const nums = { maxDepth: p.maxDepth, maxCount: p.maxCount, perCastBudget: p.perCastBudget };
    const nk = Object.keys(nums);
    for (let j = 0; j < nk.length; j++) {
      if (_has(p, nk[j]) && !_isPosInt(nums[nk[j]])) { D(SKILL_REASON.EVENT_BUDGET_EXCEEDED, p.id, null, nk[j], "事件上限 " + nk[j] + " 必须为正整数"); }
    }
    if (!_nonEmptyStr(p.terminateCond)) { D(SKILL_REASON.REQUIRED_FIELD, p.id, null, "terminateCond", "terminateCond 必须为非空字符串"); }
    if (_isArr(p.sourceWhitelist)) {
      for (let j = 0; j < p.sourceWhitelist.length; j++) {
        if (!_nonEmptyStr(p.sourceWhitelist[j])) { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "sourceWhitelist", "来源白名单元素必须为非空字符串"); }
        else if (!knownTemplateSkillIds[p.sourceWhitelist[j]] && /^(TP_|SK_)/.test(p.sourceWhitelist[j])) { D(SKILL_REASON.INVALID_REFERENCE, p.id, null, "sourceWhitelist", "未知来源: " + p.sourceWhitelist[j]); }
      }
    }
    if (_isArr(p.allowedOps)) {
      for (let j = 0; j < p.allowedOps.length; j++) {
        if (!_EXECUTORS[p.allowedOps[j]]) { D(SKILL_REASON.UNKNOWN_EXECUTOR, p.id, null, "allowedOps", "事件策略允许了未知执行器: " + p.allowedOps[j]); }
      }
    }
  }
  /* 预算策略：上界全部必填 */
  numKeys(raw.budgetPolicies, "budgetPolicies", ["maxEffectsPerHero", "maxEffectsPerCast", "maxDerivedPerEvent", "maxEventDepth", "maxEventPerStep"], "budgetPolicies");
  /* 奖励策略 */
  const rwIds = Object.keys(raw.rewardPolicies);
  for (let i = 0; i < rwIds.length; i++) {
    const p = raw.rewardPolicies[rwIds[i]];
    _requireFields(p, ["id", "source", "fallback"], p.id, null, D);
    if (_has(p, "optionCount") && !_isPosInt(p.optionCount)) { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "optionCount", "optionCount 必须为正整数"); }
    if (_has(p, "dedupeBy") && !_nonEmptyStr(p.dedupeBy)) { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "dedupeBy", "dedupeBy 必须为非空字符串"); }
  }
  /* 索敌策略 */
  const tgIds = Object.keys(raw.targetPolicies);
  for (let i = 0; i < tgIds.length; i++) {
    const p = raw.targetPolicies[tgIds[i]];
    _requireFields(p, ["id", "maxRange"], p.id, null, D);
    if (_has(p, "maxRange") && !(_isFiniteNum(p.maxRange) && p.maxRange > 0)) { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "maxRange", "maxRange 必须为大于 0 的有限数值"); }
  }
  /* 施放策略 */
  const csIds = Object.keys(raw.castPolicies);
  for (let i = 0; i < csIds.length; i++) {
    const p = raw.castPolicies[csIds[i]];
    _requireFields(p, ["id"], p.id, null, D);
    if (_has(p, "requiresTarget") && typeof p.requiresTarget !== "boolean") { D(SKILL_REASON.INVALID_PARAMETER, p.id, null, "requiresTarget", "requiresTarget 必须为布尔值"); }
  }
}

/* ==================================================================
 * SkillConfig —— 对外模块对象（保持顶层 const 结构）
 * ================================================================== */
const SkillConfig = {
  /** 原因码枚举（业务分支只判 code，不判中文文案）。 */
  Reason: SKILL_REASON,

  /** 取 CFG.skillSystem 数据表（未加载时返回 null，静默降级）。 */
  tables() {
    return (typeof CFG !== "undefined" && CFG.skillSystem) ? CFG.skillSystem : null;
  },

  /** 配置版本字符串（用于构建缓存键 configVersion 段）。 */
  version() {
    const t = this.tables();
    return t ? (t.configVersion || null) : null;
  },

  /** 按类别取定义：kind ∈ skill|template|crystal|quality|pool|policy。 */
  get(kind, id) {
    const t = this.tables();
    if (!t) return null;
    if (kind === "quality") {
      return _isArr(t.qualityDefs) ? (t.qualityDefs.find(function (q) { return q && q.id === id; }) || null) : null;
    }
    const map = {
      skill: t.skillDefs, template: t.effectTemplates, crystal: t.crystalDefs, pool: t.rewardPools,
    };
    if (_has(map, kind)) { return (map[kind] && map[kind][id]) || null; }
    if (kind === "policy") {
      const tables = ["hitPolicies", "stackPolicies", "eventPolicies", "budgetPolicies", "rewardPolicies", "targetPolicies", "castPolicies"];
      for (let i = 0; i < tables.length; i++) {
        const tb = t[tables[i]];
        if (_isObj(tb) && tb[id]) return tb[id];
      }
      return null;
    }
    return null;
  },

  /** 取策略并套用 schema 默认值（合同 §6：可选字段默认值统一在 schema）。 */
  policy(kind, id) {
    const t = this.tables();
    if (!t) return null;
    const tableKey = _POLICY_TABLE[kind];
    if (!tableKey) return null;
    const tb = t[tableKey];
    if (!_isObj(tb) || !_isObj(tb[id])) return null;
    const defaults = _POLICY_DEFAULTS[kind] || {};
    const out = Object.assign({}, defaults, tb[id]);
    return _deepFreeze(out);
  },

  /** 深冻结定义索引（合同 §5：Definition 加载后只读）。 */
  freezeDefinitions(defs) {
    return _deepFreeze(defs);
  },

  /** 校验原始配置表：{ ok, definitions, diagnostics }。诊断 message 一律中文。 */
  validate(raw) {
    const diagnostics = [];
    const D = function (code, definitionId, opId, field, message) {
      diagnostics.push({
        code: code,
        definitionId: (definitionId === undefined) ? null : definitionId,
        opId: (opId === undefined) ? null : opId,
        field: (field === undefined) ? null : field,
        message: message,
      });
    };

    if (!_isObj(raw)) {
      D(SKILL_REASON.REQUIRED_FIELD, null, null, "raw", "配置根必须为普通对象");
      return { ok: false, definitions: null, diagnostics: diagnostics };
    }

    /* 0) 禁令：函数 / 可执行字符串 / 文件路径（合同 §6） */
    _scanForbidden(raw, D, "", [], 0);

    /* 1) 注册表（可被 raw 扩展） */
    const caps = Object.assign({}, _CAPABILITIES, _isObj(raw.capabilityRegistry) ? raw.capabilityRegistry : {});
    const tags = Object.assign({}, _TAGS, _isObj(raw.tagRegistry) ? raw.tagRegistry : {});

    /* 2) 定义索引 */
    const templates = _collectMap(raw.effectTemplates, "effectTemplates", D);
    const skills = _collectMap(raw.skillDefs, "skillDefs", D);
    const crystals = _collectMap(raw.crystalDefs, "crystalDefs", D);
    const pools = _collectMap(raw.rewardPools, "rewardPools", D);
    const hitPolicies = _collectMap(raw.hitPolicies, "hitPolicies", D);
    const stackPolicies = _collectMap(raw.stackPolicies, "stackPolicies", D);
    const eventPolicies = _collectMap(raw.eventPolicies, "eventPolicies", D);
    const budgetPolicies = _collectMap(raw.budgetPolicies, "budgetPolicies", D);
    const rewardPolicies = _collectMap(raw.rewardPolicies, "rewardPolicies", D);
    const targetPolicies = _collectMap(raw.targetPolicies, "targetPolicies", D);
    const castPolicies = _collectMap(raw.castPolicies, "castPolicies", D);
    const qualities = _collectList(raw.qualityDefs, "qualityDefs", D);

    /* 3) 文案表 */
    const local = {};
    if (raw.localization === undefined || raw.localization === null) {
      D(SKILL_REASON.REQUIRED_FIELD, null, null, "localization", "配置缺少章节: localization");
    } else if (!_isObj(raw.localization)) {
      D(SKILL_REASON.REQUIRED_FIELD, null, null, "localization", "localization 必须为对象");
    } else {
      const lk = Object.keys(raw.localization);
      for (let i = 0; i < lk.length; i++) {
        const v = raw.localization[lk[i]];
        if (!_nonEmptyStr(v)) { D(SKILL_REASON.PLACEHOLDER_TEXT, null, null, "localization." + lk[i], "文案值必须为非空字符串"); continue; }
        if (_PLACEHOLDER.test(v)) { D(SKILL_REASON.PLACEHOLDER_TEXT, null, null, "localization." + lk[i], "文案含占位符"); continue; }
        local[lk[i]] = v;
      }
    }

    /* 4) 模板 */
    const tIds = Object.keys(templates);
    for (let i = 0; i < tIds.length; i++) {
      const t = templates[tIds[i]];
      _allowFields(t, _FIELDS.template, t.id, null, D);
      _requireFields(t, ["id", "kind", "params"], t.id, null, D);
      if (!_TEMPLATE_KINDS[t.kind]) { D(SKILL_REASON.INVALID_PARAMETER, t.id, null, "kind", "未知模板类型: " + t.kind); }
      _validateParams(t.params, t.id, null, "params", D, _TEMPLATE_KINDS[t.kind]);
      if (t.nameKey !== undefined) _nameKey(t.nameKey, "nameKey", t.id, D, local);
      if (t.detailKey !== undefined) _nameKey(t.detailKey, "detailKey", t.id, D, local);
    }

    /* 5) 技能 */
    const sIds = Object.keys(skills);
    for (let i = 0; i < sIds.length; i++) {
      const s = skills[sIds[i]], did = s.id;
      _allowFields(s, _FIELDS.skill, did, null, D);
      _requireFields(s, ["id", "nameKey", "levels", "baseGraph", "targetPolicyId", "castPolicyId", "rewardPoolIds"], did, null, D);
      _nameKey(s.nameKey, "nameKey", did, D, local);
      if (s.detailKey !== undefined) _nameKey(s.detailKey, "detailKey", did, D, local);
      _validateSkillLevels(s.levels, did, D);
      if (!_isObj(s.baseGraph)) {
        D(SKILL_REASON.REQUIRED_FIELD, did, null, "baseGraph", "baseGraph 必须为对象");
      } else {
        _allowFields(s.baseGraph, ["nodes", "edges"], did, null, D);
        const nodes = s.baseGraph.nodes;
        if (!_isArr(nodes) || nodes.length === 0) {
          D(SKILL_REASON.REQUIRED_FIELD, did, null, "baseGraph.nodes", "baseGraph.nodes 必须为非空数组");
        } else {
          const nodeIds = {};
          for (let j = 0; j < nodes.length; j++) _validateNode(nodes[j], did, templates, hitPolicies, D, caps, tags, nodeIds, local);
          if (s.baseGraph.edges !== undefined) {
            if (!_isArr(s.baseGraph.edges)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "baseGraph.edges", "edges 必须为数组"); }
            else for (let j = 0; j < s.baseGraph.edges.length; j++) {
              const e = s.baseGraph.edges[j];
              if (!_isObj(e)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "baseGraph.edges[" + j + "]", "边必须为对象"); continue; }
              const from = (_has(e, "from") ? e.from : e.src), to = (_has(e, "to") ? e.to : e.dst);
              if (!_nonEmptyStr(from) || !nodeIds[from]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "baseGraph.edges[" + j + "].from", "边起点引用不存在的 nodeId"); }
              if (!_nonEmptyStr(to) || !nodeIds[to]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "baseGraph.edges[" + j + "].to", "边终点引用不存在的 nodeId"); }
            }
          }
        }
      }
      if (!targetPolicies[s.targetPolicyId]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "targetPolicyId", "targetPolicyId 未定义: " + s.targetPolicyId); }
      if (!castPolicies[s.castPolicyId]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "castPolicyId", "castPolicyId 未定义: " + s.castPolicyId); }
      if (!_isArr(s.rewardPoolIds) || s.rewardPoolIds.length === 0) {
        D(SKILL_REASON.REQUIRED_FIELD, did, null, "rewardPoolIds", "rewardPoolIds 必须为非空数组");
      } else for (let j = 0; j < s.rewardPoolIds.length; j++) {
        if (!pools[s.rewardPoolIds[j]]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "rewardPoolIds", "奖励池不存在: " + s.rewardPoolIds[j]); }
      }
    }

    /* 6) 水晶 */
    const cIds = Object.keys(crystals);
    for (let i = 0; i < cIds.length; i++) {
      const c = crystals[cIds[i]], did = c.id;
      _allowFields(c, _FIELDS.crystal, did, null, D);
      _requireFields(c, ["id", "nameKey", "qualityId", "eligibility", "operations", "levels", "presentation"], did, null, D);
      if (!qualities.byId[c.qualityId]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "qualityId", "品质不存在: " + c.qualityId); }
      _nameKey(c.nameKey, "nameKey", did, D, local);
      _validateEligibility(c.eligibility, did, D, caps, tags);
      if (_isObj(c.presentation)) {
        _allowFields(c.presentation, _FIELDS.presentation, did, null, D);
        _requireFields(c.presentation, ["nameKey", "detailKey"], did, null, D);
        _nameKey(c.presentation.nameKey, "presentation.nameKey", did, D, local);
        _nameKey(c.presentation.detailKey, "presentation.detailKey", did, D, local);
      } else { D(SKILL_REASON.REQUIRED_FIELD, did, null, "presentation", "presentation 必须为对象"); }
      _validateCrystalLevels(c.levels, did, D);
      if (!_isArr(c.operations) || c.operations.length === 0) {
        D(SKILL_REASON.REQUIRED_FIELD, did, null, "operations", "operations 必须为非空数组");
      } else {
        const opIds = {};
        for (let j = 0; j < c.operations.length; j++) _validateOperation(c.operations[j], did, templates, eventPolicies, D, caps, tags, opIds);
        _checkOpCycles(c.operations, did, D);
        _checkExclusiveConflicts(c.operations, did, D);
      }
      if (c.conflicts !== undefined) {
        if (!_isArr(c.conflicts)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "conflicts", "conflicts 必须为资源组字符串数组"); }
        else for (let j = 0; j < c.conflicts.length; j++) {
          if (!_nonEmptyStr(c.conflicts[j])) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "conflicts", "资源组必须为非空字符串"); }
        }
      }
      if (c.hidden !== undefined && typeof c.hidden !== "boolean") { D(SKILL_REASON.INVALID_PARAMETER, did, null, "hidden", "hidden 必须为布尔值"); }
      if (c.tags !== undefined) _validateTagList(c.tags, did, null, "tags", D, tags);
    }

    /* 7) 品质（档数 = 数组长度，禁止写死） */
    for (let i = 0; i < qualities.list.length; i++) {
      const q = qualities.list[i];
      _allowFields(q, _FIELDS.quality, q.id, null, D);
      _requireFields(q, ["id", "nameKey", "rank", "color", "weight", "placement"], q.id, null, D);
      if (!_isFiniteNum(q.rank)) { D(SKILL_REASON.INVALID_PARAMETER, q.id, null, "rank", "rank 必须为有限数值"); }
      if (!_nonEmptyStr(q.color)) { D(SKILL_REASON.INVALID_PARAMETER, q.id, null, "color", "color 必须为非空字符串"); }
      if (!(_isFiniteNum(q.weight) && q.weight >= 0)) { D(SKILL_REASON.INVALID_PARAMETER, q.id, null, "weight", "weight 必须为非负有限数值"); }
      if (!_nonEmptyStr(q.placement)) { D(SKILL_REASON.INVALID_PARAMETER, q.id, null, "placement", "placement 必须为非空字符串"); }
      _nameKey(q.nameKey, "nameKey", q.id, D, local);
    }

    /* 8) 奖励池（可达性） */
    const referencedCrystal = {};
    const pIds = Object.keys(pools);
    for (let i = 0; i < pIds.length; i++) {
      const p = pools[pIds[i]], did = p.id;
      _allowFields(p, _FIELDS.pool, did, null, D);
      _requireFields(p, ["id", "entries"], did, null, D);
      if (p.nameKey !== undefined) _nameKey(p.nameKey, "nameKey", did, D, local);
      if (!_isArr(p.entries) || p.entries.length === 0) { D(SKILL_REASON.REQUIRED_FIELD, did, null, "entries", "entries 必须为非空数组"); continue; }
      let hasBase = false, totalWeight = 0;
      for (let j = 0; j < p.entries.length; j++) {
        const e = p.entries[j];
        if (!_isObj(e)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "entries[" + j + "]", "池条目必须为对象"); continue; }
        if (!crystals[e.crystalId]) { D(SKILL_REASON.INVALID_REFERENCE, did, null, "entries[" + j + "].crystalId", "水晶不存在: " + e.crystalId); }
        else { referencedCrystal[e.crystalId] = true; }
        if (!(_isFiniteNum(e.weight) && e.weight >= 0)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "entries[" + j + "].weight", "权重必须为非负有限数值"); }
        else { totalWeight += e.weight; }
        if (e.minLevel !== undefined && !_isNonNegInt(e.minLevel)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "entries[" + j + "].minLevel", "minLevel 必须为非负整数"); }
        if (e.maxLevel !== undefined && !_isPosInt(e.maxLevel)) { D(SKILL_REASON.INVALID_PARAMETER, did, null, "entries[" + j + "].maxLevel", "maxLevel 必须为正整数"); }
        if (e.minLevel === undefined || e.minLevel <= 1) hasBase = true;
      }
      if (!hasBase) { D(SKILL_REASON.UNREACHABLE_REWARD, did, null, "entries", "奖励池无首级可达项（全部 minLevel>1）"); }
      if (totalWeight <= 0) { D(SKILL_REASON.UNREACHABLE_REWARD, did, null, "entries", "奖励池总权重为 0，不可达"); }
    }
    /* 每个非隐藏水晶都应可达（至少被一个池引用） */
    for (let i = 0; i < cIds.length; i++) {
      const c = crystals[cIds[i]];
      if (c.hidden === true) continue;
      if (!referencedCrystal[c.id]) { D(SKILL_REASON.UNREACHABLE_REWARD, c.id, null, "id", "水晶未被任何奖励池引用（不可达）: " + c.id); }
    }

    /* 9) 策略表 */
    const knownSrc = {};
    for (let i = 0; i < tIds.length; i++) knownSrc[tIds[i]] = true;
    for (let i = 0; i < sIds.length; i++) knownSrc[sIds[i]] = true;
    _validatePolicies({
      hitPolicies: hitPolicies, stackPolicies: stackPolicies, eventPolicies: eventPolicies,
      budgetPolicies: budgetPolicies, rewardPolicies: rewardPolicies,
      targetPolicies: targetPolicies, castPolicies: castPolicies,
    }, D, knownSrc);

    /* 10) 顶层预算 / 默认值 */
    if (!_isObj(raw.budgets)) {
      D(SKILL_REASON.REQUIRED_FIELD, null, null, "budgets", "配置缺少 budgets 区块");
    } else {
      const bKeys = ["maxEffectsPerHero", "maxEffectsPerCast", "maxDerivedPerEvent", "maxEventDepth", "maxEventPerStep"];
      for (let i = 0; i < bKeys.length; i++) {
        if (!_has(raw.budgets, bKeys[i])) { D(SKILL_REASON.REQUIRED_FIELD, null, null, "budgets." + bKeys[i], "缺失预算上限: " + bKeys[i]); }
        else if (!_isPosInt(raw.budgets[bKeys[i]])) { D(SKILL_REASON.BUDGET_EXCEEDED, null, null, "budgets." + bKeys[i], "预算上限必须为正整数: " + bKeys[i]); }
      }
    }
    if (!_isObj(raw.defaults)) { D(SKILL_REASON.REQUIRED_FIELD, null, null, "defaults", "配置缺少 defaults 区块"); }

    /* 11) 返回结果（definitions 一律深冻结） */
    const definitions = _deepFreeze({
      configVersion: raw.configVersion || null,
      skills: skills, templates: templates, crystals: crystals, pools: pools,
      qualities: qualities.list, qualityById: qualities.byId,
      policies: {
        hit: hitPolicies, stack: stackPolicies, event: eventPolicies, budget: budgetPolicies,
        reward: rewardPolicies, target: targetPolicies, cast: castPolicies,
      },
      localization: local,
      migratedHeroIds: _isArr(raw.migratedHeroIds) ? raw.migratedHeroIds.slice() : [],
    });
    return { ok: diagnostics.length === 0, definitions: definitions, diagnostics: diagnostics };
  },
};




