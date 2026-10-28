/* ============================================================
 * skill-damage.js — DamageResolver（能量水晶技能系统 · W3a 开发）
 * 职责：节点伤害 × 目标状态 → 伤害结果；命中额度（hitPolicies）与持续区域积分。
 * 边界（合同 §4）：**不生成奖励、不改世界结构、不碰 UI**。
 * 契约：G_docs/skill_system_interface_v1.md 第七节；合同 §4/§9/§10/§15；v0.5 §5。
 *
 * 关键口径（冻结，勿改）：
 *   ① 伤害公式 = 原始基准 × 形态系数 × 派生比例 × (1 + 匹配 Increased 总和)
 *                             × Π(各独立 More) × 暴击 × 敌方修正
 *   ② 防御扣减与取整**沿用既有 damageMonster**，本文件只调用它，绝不重复减伤。
 *   ③ 派生引用「未经外部加成的原始基准」，不复制父节点最终伤害（见 buildBasis）。
 *   ④ 持续伤害默认不暴击；瞬时命中每次合法结算独立暴击。
 *   ⑤ 去重键用**稳定 targetId**（怪物 W5 已加 m.id），绝不拿对象引用做键。
 * ============================================================ */
"use strict";

/* 全部内部辅助函数收进 IIFE，使本文件对外**只暴露 SkillDamage 一个全局符号**
 * （契约 §8：每个 skill-*.js 只暴露一个顶层符号，避免多文件辅助名互相覆盖）。 */
const SkillDamage = (function () {

/* 原因码读取：定义处 = skill-config.js 的顶层 const SKILL_REASON（契约第五节）。
 * 本文件**不得**重复声明 SKILL_REASON（顶层 const 重复声明会 SyntaxError）；
 * 未加载时（裁剪测试桩）直接返回大写下划线字符串本身 —— 枚举值即其字符串。 */
function _sdR(name) {
  if (typeof SKILL_REASON !== "undefined" && SKILL_REASON && SKILL_REASON[name] !== undefined) {
    return SKILL_REASON[name];
  }
  return name;
}

/* 取 CFG.skillSystem 数据表（未加载时 null）。 */
function _sdTables() {
  return (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
}

/* 数值规整：仅接受 number（含 NaN/Infinity 透传以便上层拒绝）；其它类型取保守默认。
 * 契约 §6 禁止隐式字符串转数值 —— 故字符串一律不解析。 */
function _sdNum(v, def) {
  if (typeof v === "number") return v;
  return (def === undefined) ? NaN : def;
}

/* 全局对象池复用后不会残留旧目标：这里兼容 W5 尚未合并 m.id 的情况 ——
 * 给目标对象挂**一次性稳定代理 ID**（存字段，不是拿对象引用做键）。
 * 正常路径优先用 target.id。 */
var _sdFallbackIdSeq = 0;
function _sdTargetId(target) {
  if (!target) return null;
  if (target.id !== undefined && target.id !== null) return target.id;
  if (target.__sdHitId === undefined) target.__sdHitId = "obj#" + (++_sdFallbackIdSeq);
  return target.__sdHitId;
}

/* 命中策略 → 类型（main|split|explode|orbit|region）。
 * 阈值来自 CFG.skillSystem.hitPolicies[policyId].type；缺失时保守默认 "main"（一次施放一次）。 */
function _sdPolicyType(hitPolicyId) {
  const t = _sdTables();
  const hp = (t && t.hitPolicies) ? t.hitPolicies[hitPolicyId] : null;
  if (hp && typeof hp.type === "string" && hp.type) return hp.type;
  return "main";
}

/* 环绕接触间隔保守默认（秒）：优先 CFG.skillSystem.defaults.orbit.hitInterval，缺失取 0.35。 */
function _sdOrbitInterval() {
  const t = _sdTables();
  const o = t && t.defaults ? t.defaults.orbit : null;
  if (o && typeof o.hitInterval === "number") return o.hitInterval;
  return 0.35;
}

/* 持续区域 tick 保守默认（秒）：优先 CFG.skillSystem.defaults.persistentArea.tick，缺失取 0.25。 */
function _sdRegionTick(region) {
  if (region && typeof region.tick === "number") return Math.max(1e-6, region.tick);
  const t = _sdTables();
  const p = t && t.defaults ? t.defaults.persistentArea : null;
  if (p && typeof p.tick === "number") return Math.max(1e-6, p.tick);
  return 0.25;
}

/* 计算伤害公式（不接触目标/世界，纯函数）。返回可为 NaN（上层拒绝）。 */
function _sdComputeDamage(basis) {
  if (!basis || typeof basis !== "object") return NaN;
  const base = _sdNum(basis.baseRef !== undefined ? basis.baseRef
                : (basis.base !== undefined ? basis.base : basis.raw));
  const coeff = _sdNum(basis.coefficient !== undefined ? basis.coefficient : basis.coeff, 1);
  const ratio = _sdNum(basis.derivedRatio !== undefined ? basis.derivedRatio
                : (basis.inheritFactor !== undefined ? basis.inheritFactor : basis.inherit), 1);

  // 匹配外部 Increased：累加（同一节点只应用一次，聚合值由编译期给出）
  let inc = 0;
  const incSrc = (basis.increased !== undefined ? basis.increased : basis.inc);
  if (Array.isArray(incSrc)) { for (let i = 0; i < incSrc.length; i++) inc += _sdNum(incSrc[i], 0); }
  else inc = _sdNum(incSrc, 0);

  // 各独立水晶 More：相乘
  let more = 1;
  const moreSrc = (basis.mores !== undefined ? basis.mores : basis.more);
  if (Array.isArray(moreSrc)) { for (let i = 0; i < moreSrc.length; i++) more *= _sdNum(moreSrc[i], 1); }
  else if (moreSrc !== undefined) more *= _sdNum(moreSrc, 1);

  // 暴击：持续伤害默认不暴击（v0.5 §5）
  const isDoT = basis.isDoT === true || basis.dot === true || basis.canCrit === false;
  let crit = 1;
  if (!isDoT) {
    const c = (basis.critMul !== undefined ? basis.critMul : basis.crit);
    if (c !== undefined) crit = _sdNum(c, 1);
  }

  const enemy = _sdNum(basis.enemyMul !== undefined ? basis.enemyMul : basis.enemy, 1);
  return base * coeff * ratio * (1 + inc) * more * crit * enemy;
}

/* 命中额度键：稳定 targetId + 分组键；绝不含对象引用。 */
function _sdHitKey(req, target) {
  const type = _sdPolicyType(req.hitPolicyId);
  const groupId = (req.groupId !== undefined && req.groupId !== null) ? req.groupId
                : ((req.nodeId !== undefined && req.nodeId !== null) ? req.nodeId : req.templateId);
  return {
    type: type,
    policyId: req.hitPolicyId,
    castId: (req.castId !== undefined) ? req.castId : null,
    ownerId: (req.ownerId !== undefined) ? req.ownerId : null,
    skillId: (req.skillId !== undefined) ? req.skillId : null,
    groupId: groupId,
    targetId: _sdTargetId(target),
    excludeTargetId: (req.excludeTargetId !== undefined) ? req.excludeTargetId : null,
    interval: req.hitInterval,
    dps: req.dps,
  };
}

/* 初始化命中额度状态（缺字段则补齐，原地就地补，便于调用方传 {} 即用）。 */
function _sdEnsureState(state) {
  if (!state || typeof state !== "object") state = {};
  if (!state.main) state.main = {};
  if (!state.split) state.split = {};
  if (!state.explode) state.explode = {};
  if (!state.orbit) state.orbit = {};
  if (!state.region) state.region = {};
  if (!state._casts) state._casts = {};
  return state;
}

/* 登记去重键到某施放，供 endCast 释放（生命周期到点即整批释放，不做永久全局集合）。 */
function _sdTrackCast(st, castId, dk) {
  const key = (castId === undefined || castId === null) ? "" : castId;
  const c = st._casts[key] || (st._casts[key] = { keys: [] });
  c.keys.push(dk);
}

/* 主弹 / 分裂 / 爆炸：一次施放一次（per castId + 分组 + targetId）。 */
function _sdOncePerCast(st, key, type, simTime) {
  const map = st[type];
  const castId = (key.castId === undefined || key.castId === null) ? "" : key.castId;
  const groupId = (key.groupId === undefined || key.groupId === null) ? "" : key.groupId;
  const targetId = (key.targetId === undefined || key.targetId === null) ? "?" : key.targetId;

  // 出生目标排除（22.4 #13 数据驱动）：split 默认排除（历史行为）；
  // 其余类型按策略声明 hitPolicies[*].excludeBornTarget === true 生效（爆炸命中点不重复结算被击中者）。
  const pol = (key.policyId && typeof CFG !== "undefined" && CFG.skillSystem && CFG.skillSystem.hitPolicies)
    ? CFG.skillSystem.hitPolicies[key.policyId] : null;
  const excludeBorn = (type === "split") || !!(pol && pol.excludeBornTarget === true);
  if (excludeBorn && key.excludeTargetId !== undefined && key.excludeTargetId !== null
      && String(key.excludeTargetId) === String(targetId)) {
    return { allowed: false, nextState: st, reason: _sdR("TARGET_ALREADY_HIT") };
  }

  const dk = castId + "|" + type + "|" + groupId + "|" + targetId;
  if (map[dk] !== undefined) {
    return { allowed: false, nextState: st, reason: _sdR("TARGET_ALREADY_HIT") };
  }
  map[dk] = { t: simTime, castId: castId };
  _sdTrackCast(st, castId, dk);
  return { allowed: true, nextState: st, reason: null };
}

/* 环绕：ownerId+skillId+接触模板组+targetId 共享 nextAllowedHitTime（多枚环绕体不绕过间隔）。 */
function _sdOrbitPolicy(st, key, simTime) {
  const ownerId = (key.ownerId === undefined || key.ownerId === null) ? "" : key.ownerId;
  const skillId = (key.skillId === undefined || key.skillId === null) ? "" : key.skillId;
  const groupId = (key.groupId === undefined || key.groupId === null) ? "" : key.groupId;
  const targetId = (key.targetId === undefined || key.targetId === null) ? "?" : key.targetId;
  const interval = _sdNum(key.interval, _sdOrbitInterval());
  const dk = "orbit|" + ownerId + "|" + skillId + "|" + groupId + "|" + targetId;
  const rec = st.orbit[dk];
  if (rec && simTime < rec.nextAllowedHitTime) {
    return { allowed: false, nextState: st, reason: _sdR("TARGET_ALREADY_HIT") };
  }
  st.orbit[dk] = { nextAllowedHitTime: simTime + interval, castId: key.castId };
  _sdTrackCast(st, key.castId, dk);
  return { allowed: true, nextState: st, reason: null };
}

/* 持续区域：ownerId+skillId+区域模板组，对该目标取**有效最高 DPS**（低者不结算，非错误）。 */
function _sdRegionPolicy(st, key, simTime) {
  const ownerId = (key.ownerId === undefined || key.ownerId === null) ? "" : key.ownerId;
  const skillId = (key.skillId === undefined || key.skillId === null) ? "" : key.skillId;
  const groupId = (key.groupId === undefined || key.groupId === null) ? "" : key.groupId;
  const targetId = (key.targetId === undefined || key.targetId === null) ? "*" : key.targetId;
  const dps = _sdNum(key.dps, 0);
  const dk = "region|" + ownerId + "|" + skillId + "|" + groupId + "|" + targetId;
  const rec = st.region[dk];
  if (rec && dps <= rec.bestDps) {
    return { allowed: false, nextState: st, reason: _sdR("REGION_MAX_DPS") };
  }
  st.region[dk] = { bestDps: dps, castId: key.castId, targetId: targetId };
  _sdTrackCast(st, key.castId, dk);
  return { allowed: true, nextState: st, reason: null };
}

/* ============================================================
 * 对外唯一 API（本 IIFE 的返回值 = 顶层 const SkillDamage）
 * ============================================================ */
return {
  /** 结算一次伤害请求：{ applied, amount, killed, reason }。
   *  req = { target, damageBasis, snapshot, nodeId, hitPolicyId, simTime, hitState,
   *          castId, ownerId, skillId, groupId, excludeTargetId, killer, dps }
   *  说明：amount = **结算前**伤害值（原始基准×各系数）；防御扣减与取整由 damageMonster 完成，
   *        本文件不重复减伤。killed 依据调用 damageMonster 前后 target.dead 变化判定。 */
  resolve(world, req) {
    req = req || {};
    const target = req.target;
    if (!target || typeof target !== "object") {
      return { applied: false, amount: 0, killed: false, reason: _sdR("INVALID_REFERENCE") };
    }
    if (target.dead) {
      return { applied: false, amount: 0, killed: false, reason: _sdR("TARGET_ALREADY_HIT") };
    }

    // 命中额度（合同 §10）：只有携带 hitState + hitPolicyId 时才做去重
    if (req.hitState && req.hitPolicyId) {
      const key = _sdHitKey(req, target);
      const hp = SkillDamage.applyHitPolicy(req.hitState, key, _sdNum(req.simTime, 0));
      if (hp.nextState) req.hitState = hp.nextState;
      if (!hp.allowed) {
        return { applied: false, amount: 0, killed: false,
                 reason: hp.reason || _sdR("TARGET_ALREADY_HIT") };
      }
    }

    const dmg = _sdComputeDamage(req.damageBasis);
    if (typeof dmg !== "number" || !isFinite(dmg)) {
      return { applied: false, amount: 0, killed: false, reason: _sdR("INVALID_REFERENCE") };
    }
    if (dmg <= 0) {
      return { applied: false, amount: 0, killed: false, reason: _sdR("NO_GAIN") };
    }

    const wasDead = !!target.dead;
    if (typeof damageMonster === "function") {
      // 对接既有结算：只调用，不复制其防御/护盾/无敌逻辑（合同禁重复减伤）
      damageMonster(world, target, dmg, req.killer);
    } else {
      // 降级（无头/裁剪环境无 damageMonster）：直接扣血并计入 dead 判定
      target.hp -= dmg;
      if (target.hp <= 0) target.dead = true;
    }
    const killed = !wasDead && !!target.dead;
    return { applied: true, amount: dmg, killed: killed, reason: null };
  },

  /** 命中额度判定（五类策略，合同 §10 冻结）：返回 { allowed, nextState, reason }。
   *  key = { type, castId, ownerId, skillId, groupId, targetId, excludeTargetId, interval, dps }。
   *  type 缺失时经 hitPolicies 解析，仍缺失保守默认 "main"。 */
  applyHitPolicy(state, key, simTime) {
    const st = _sdEnsureState(state);
    if (!key || typeof key !== "object" || !key.type) {
      return { allowed: false, nextState: st, reason: _sdR("INVALID_REFERENCE") };
    }
    const t0 = _sdNum(simTime, 0);
    const type = key.type;
    if (type === "orbit") return _sdOrbitPolicy(st, key, t0);
    if (type === "region") return _sdRegionPolicy(st, key, t0);
    if (type === "main" || type === "split" || type === "explode") return _sdOncePerCast(st, key, type, t0);
    // 未知类型：保守按主弹处理（一次施放一次）
    return _sdOncePerCast(st, key, "main", t0);
  },

  /** 持续区域按模拟时间积分：{ ticks, damage }。
   *  damage = DPS × **有效时间**（与渲染帧无关）；固定 tick 只决定结算批次 ticks，
   *  结束时补齐最后不足一个 tick 的有效时间；错开出生时间不会额外叠 tick（见下）。 */
  integrateRegion(region, fromTime, toTime) {
    if (!region || typeof region !== "object") return { ticks: 0, damage: 0 };
    const dps = _sdNum(region.dps, 0);
    const tick = _sdRegionTick(region);
    const start = (region.startTime !== undefined && region.startTime !== null) ? _sdNum(region.startTime, 0)
                : ((region.bornTime !== undefined && region.bornTime !== null) ? _sdNum(region.bornTime, 0) : 0);
    const end = (region.endTime !== undefined && region.endTime !== null) ? _sdNum(region.endTime, start)
              : ((region.duration !== undefined && region.duration !== null) ? start + _sdNum(region.duration, 0) : Infinity);
    if (!isFinite(dps)) return { ticks: 0, damage: 0 };

    const from = Math.max(_sdNum(fromTime, start), start);
    const to = Math.min(_sdNum(toTime, end), end);
    const eff = to - from;
    if (!(eff > 1e-9) || !isFinite(eff)) return { ticks: 0, damage: 0 };

    // 固定 tick 只决定「结算批次」（向上取整含末尾不足一 tick 的余量）
    const ticks = Math.ceil(eff / tick - 1e-9);
    return { ticks: ticks, damage: dps * eff };
  },

  /** 纯函数：以**原始基准**构造伤害基准（派生引用原始 baseRef，不复制父节点最终伤害）。
   *  baseRef = 原始数值；coeff = 形态系数（默认 1）；inherit = 派生比例（默认 1）。 */
  buildBasis(baseRef, coeff, inherit) {
    return {
      baseRef: _sdNum(baseRef, NaN),
      coefficient: _sdNum(coeff, 1),
      derivedRatio: _sdNum(inherit, 1),
      increased: 0,     // 匹配外部 Increased 总和（聚合值，编译期给出）
      mores: [],        // 各独立水晶 More 因子
      critMul: 1,       // 暴击倍率（瞬时命中由调用方按本次掷骰传入）
      enemyMul: 1,      // 敌方修正（防御扣减仍由 damageMonster 内部处理）
      isDoT: false,     // 持续伤害置 true → 不暴击
    };
  },

  /** 便捷构造一次伤害请求（字段与 resolve(req) 对齐）。 */
  damageRequest(opts) {
    opts = opts || {};
    const nodeId = (opts.nodeId !== undefined) ? opts.nodeId : null;
    return {
      target: opts.target || null,
      damageBasis: opts.damageBasis || opts.basis || null,
      snapshot: opts.snapshot || null,
      nodeId: nodeId,
      hitPolicyId: opts.hitPolicyId || null,
      simTime: _sdNum(opts.simTime, 0),
      hitState: opts.hitState || null,
      castId: (opts.castId !== undefined) ? opts.castId : null,
      ownerId: (opts.ownerId !== undefined) ? opts.ownerId : null,
      skillId: (opts.skillId !== undefined) ? opts.skillId : null,
      groupId: (opts.groupId !== undefined && opts.groupId !== null) ? opts.groupId : nodeId,
      templateId: (opts.templateId !== undefined) ? opts.templateId : null,
      excludeTargetId: (opts.excludeTargetId !== undefined) ? opts.excludeTargetId : null,
      hitInterval: opts.hitInterval,
      dps: opts.dps,
      killer: opts.killer || null,
    };
  },

  /** 新建命中额度状态（测试/运行时可用；也可直接传 {}）。 */
  newHitState() {
    return _sdEnsureState({});
  },

  /** 开始一次施放的生命周期：登记其额度集合（后续 endCast 可整批释放）。 */
  beginCast(state, castId) {
    const st = _sdEnsureState(state);
    const key = (castId === undefined || castId === null) ? "" : castId;
    const c = st._casts[key] || (st._casts[key] = { keys: [] });
    c.keys = [];
    return { castId: castId, ok: true };
  },

  /** 结束一次施放：释放该施放登记的**全部**去重键（避免永久全局集合，防对象池复用误认）。 */
  endCast(state, castId) {
    const st = _sdEnsureState(state);
    const key = (castId === undefined || castId === null) ? "" : castId;
    const c = st._casts[key];
    let released = 0;
    if (c && c.keys) {
      for (let i = 0; i < c.keys.length; i++) {
        const dk = c.keys[i];
        if (st.main[dk] !== undefined) { delete st.main[dk]; released++; }
        if (st.split[dk] !== undefined) { delete st.split[dk]; released++; }
        if (st.explode[dk] !== undefined) { delete st.explode[dk]; released++; }
        if (st.orbit[dk] !== undefined) { delete st.orbit[dk]; released++; }
        if (st.region[dk] !== undefined) { delete st.region[dk]; released++; }
      }
    }
    delete st._casts[key];
    return { castId: castId, released: released };
  },

  /** 命中策略 → 类型解析（供运行时/测试探查；缺失保守默认 "main"）。 */
  policyType(hitPolicyId) {
    return _sdPolicyType(hitPolicyId);
  },
};

})();   // IIFE 结束：仅 SkillDamage 泄漏到全局
