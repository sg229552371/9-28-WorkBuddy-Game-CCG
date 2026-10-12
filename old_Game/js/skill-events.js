/* ============================================================
 * skill-events.js — SkillEventRouter（能量水晶技能系统 · W3a 开发）
 * 职责：合法事件 + 路由策略 → 派生请求；有界队列，禁同步递归。
 * 边界（合同 §4）：**禁止无界递归调用**（深度 / 次数 / 预算三重护栏）。
 * 契约：G_docs/skill_system_interface_v1.md 第七节；合同 §9/§15；v0.5 §6。
 *
 * 冻结口径：
 *   ① enqueue 只做「预算 / 深度 / 白名单」校验并入队，**绝不在此同步递归派生**。
 *   ② drain 按**稳定序号**（FIFO）消费，单步上限来自 budgets.maxEventPerStep。
 *   ③ 默认只有主效果（depth 0）触发事件水晶；派生（depth>0）默认不触发（features.derivedEvents）。
 *   ④ 只有「自然命中结束 / 寿命结束 / 距离结束」可派生；
 *      「批次替换 / 场景清理 / 离局 / 强制回收」不可派生。
 *   ⑤ 每实例「首次命中」与「消失」各只发一次。
 *   ⑥ 阈值全部来自 CFG.skillSystem.budgets / eventPolicies；缺失用**保守默认**（缺失≠无限）。
 * ============================================================ */
"use strict";

/* 全部内部辅助函数收进 IIFE，使本文件对外**只暴露 SkillEvents 一个全局符号**
 * （契约 §8：每个 skill-*.js 只暴露一个顶层符号）。 */
const SkillEvents = (function () {

/* 原因码读取：定义处 = skill-config.js 的顶层 const SKILL_REASON（契约第五节）。
 * 本文件不得重复声明 SKILL_REASON；未加载时返回大写下划线字符串本身。 */
function _seR(name) {
  if (typeof SKILL_REASON !== "undefined" && SKILL_REASON && SKILL_REASON[name] !== undefined) {
    return SKILL_REASON[name];
  }
  return name;
}

/* 结束原因枚举（v0.5 §6）——可派生 3 类，不可派生 4 类。 */
var _SE_END = {
  NATURAL_HIT: "NATURAL_HIT",       // 自然命中结束（可派生）
  LIFETIME: "LIFETIME",             // 寿命结束（可派生）
  DISTANCE: "DISTANCE",             // 距离结束（可派生）
  BATCH_REPLACE: "BATCH_REPLACE",   // 批次替换（不可派生）
  SCENE_CLEANUP: "SCENE_CLEANUP",   // 场景清理（不可派生）
  LEAVE_MATCH: "LEAVE_MATCH",       // 离局（不可派生）
  FORCE_RECYCLE: "FORCE_RECYCLE",   // 强制回收（不可派生）
};
var _SE_DERIVABLE = [_SE_END.NATURAL_HIT, _SE_END.LIFETIME, _SE_END.DISTANCE];
var _SE_NON_DERIVABLE = [_SE_END.BATCH_REPLACE, _SE_END.SCENE_CLEANUP, _SE_END.LEAVE_MATCH, _SE_END.FORCE_RECYCLE];
var _SE_ERROR_CAP = 128;   // 诊断容量上限（合同 §15：禁止无界诊断/日志）

function _seTables() {
  return (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
}

function _seNum(v, def) {
  if (typeof v === "number" && isFinite(v)) return v;
  return (def === undefined) ? NaN : def;
}

/* ---- 保守默认（缺失≠无限；均来自 CFG.skillSystem.budgets，缺失时取标注值）---- */
function _seBudget(name, fallback) {
  const t = _seTables();
  const b = t && t.budgets ? t.budgets : null;
  if (b && typeof b[name] === "number" && isFinite(b[name])) return b[name];
  return fallback;
}
function _seMaxDepth() { return _seBudget("maxEventDepth", 2); }              // 保守默认 2 层
function _seMaxPerStep() { return _seBudget("maxEventPerStep", 256); }        // 保守默认 256
function _seMaxDerivedPerEvent() { return _seBudget("maxDerivedPerEvent", 16); } // 保守默认 16
function _sePerCastBudget(pol) {
  if (pol && typeof pol.perCastBudget === "number" && isFinite(pol.perCastBudget)) return pol.perCastBudget;
  // 保守默认：单次施放事件预算 = maxEffectsPerCast（缺省 64）
  return _seBudget("maxEffectsPerCast", 64);
}
/* 默认派生不触发事件水晶（合同 §2 已确认玩法）。 */
function _seDerivedEventsEnabled() {
  const t = _seTables();
  return !!(t && t.features && t.features.derivedEvents === true);
}
/* 22.8 扩容：`everyHit` 策略（弹射 / 链锁）**本身就是链式派生机制** ——
 * 它描述的是「这一发弹自己的下一次命中」，不是「另一个水晶作用在派生节点上」，
 * 因此豁免「派生不触发事件水晶」闸门；否则链长永远只有 1 跳。
 * 链长与深度仍受节点 `parameters.chainLeft`、策略 `maxDepth`、预算三重约束。 */
function _seEveryHitPolicy(pol) {
  return !!(pol && pol.everyHit === true);
}

/* 事件种类：显式 eventType 优先；否则有 endReason → 消失事件，无 → 首次命中事件。 */
function _seKind(ev) {
  if (ev && ev.eventType === "hit") return "hit";
  if (ev && ev.eventType === "vanish") return "vanish";
  if (ev && ev.endReason !== undefined && ev.endReason !== null) return "vanish";
  return "hit";
}

/* 路由策略解析：优先 ev.routePolicyId → operationId → templateId → EP_DEFAULT。 */
function _sePolicy(ev) {
  const t = _seTables();
  const pol = (t && t.eventPolicies) ? t.eventPolicies : null;
  if (!pol || !ev) return null;
  if (ev.routePolicyId && pol[ev.routePolicyId]) return pol[ev.routePolicyId];
  if (ev.operationId && pol[ev.operationId]) return pol[ev.operationId];
  if (ev.templateId && pol[ev.templateId]) return pol[ev.templateId];
  if (pol.EP_DEFAULT) return pol.EP_DEFAULT;
  return null;
}

/* 事件队列状态存在 world 上（效果实例/world 所有）。world 为空时退化到模块级状态（测试便利）。 */
var _seOrphan = null;
function _seState(world) {
  if (!world || typeof world !== "object") {
    if (!_seOrphan) _seOrphan = _seFreshState();
    return _seOrphan;
  }
  if (!world._skillEvents) world._skillEvents = _seFreshState();
  return world._skillEvents;
}
function _seFreshState() {
  return {
    queue: [],          // 待处理事件（FIFO = 稳定序号）
    seq: 0,             // 稳定序号发生器
    step: 0,            // 当前模拟步
    firstHit: {},       // effectId → 首次命中已发
    vanish: {},         // effectId → 消失已发
    perCast: {},        // castId → 已入队事件数
    stepConsumed: 0,    // 本步已消费事件数
    errors: [],         // 被拒记录（容量上限 _SE_ERROR_CAP）
  };
}

/* 记录被拒原因（有容量上限）。 */
function _seRecord(s, reason, ev) {
  if (s.errors.length >= _SE_ERROR_CAP) return;
  s.errors.push({ reason: reason, eventId: ev ? ev.eventId : null,
                  castId: ev ? ev.castId : null, operationId: ev ? ev.operationId : null });
}

/* ============================================================
 * 对外唯一 API（本 IIFE 的返回值 = 顶层 const SkillEvents）
 * ============================================================ */
return {
  /** 入队（不同步递归派生）：{ accepted, eventId, reason }。
   *  ev = { castId, ownerId, skillId, effectId, parentId, templateId, operationId,
   *         targetId, depth, simulationTime, endReason }（+可选 eventType / routePolicyId）。 */
  enqueue(world, ev) {
    const s = _seState(world);
    if (!ev || typeof ev !== "object") {
      return { accepted: false, eventId: null, reason: _seR("INVALID_REFERENCE") };
    }
    const depth = _seNum(ev.depth, 0);

    // ① 深度护栏
    if (depth > _seMaxDepth()) {
      return { accepted: false, eventId: null, reason: _seR("DERIVED_DEPTH_EXCEEDED") };
    }

    // ② 每实例首次命中 / 消失各只发一次
    const kind = _seKind(ev);
    const eid = (ev.effectId !== undefined && ev.effectId !== null) ? ev.effectId : null;
    /* 契约 A（C 路）：路由策略 everyHit=true 的效果「每次命中都派生」——同一实例的每个
     * hit 事件都必须放行（否则第 2 次起被 ALREADY_COMMITTED 拦下，每命中派生失效）。
     * 消失事件仍只发一次；everyHit 缺失 = false → 保持现状（EP_DERIVED_ONCE 零影响）。 */
    const polHit = _sePolicy(ev);
    const everyHit = !!(polHit && polHit.everyHit === true);
    if (eid !== null) {
      if (kind === "hit" && !everyHit && s.firstHit[eid]) {
        return { accepted: false, eventId: null, reason: _seR("ALREADY_COMMITTED") };
      }
      if (kind === "vanish" && s.vanish[eid]) {
        return { accepted: false, eventId: null, reason: _seR("ALREADY_COMMITTED") };
      }
    }

    // ③ 队列容量（单步消费上限兼作队列上限，防无界增长）
    const maxStep = _seMaxPerStep();
    if (s.queue.length >= maxStep) {
      return { accepted: false, eventId: null, reason: _seR("BUDGET_EXCEEDED") };
    }

    // ④ 每施放事件预算
    const pol = polHit;
    const castKey = (ev.castId === undefined || ev.castId === null) ? "" : ev.castId;
    const used = s.perCast[castKey] || 0;
    if (used >= _sePerCastBudget(pol)) {
      return { accepted: false, eventId: null, reason: _seR("EVENT_BUDGET_EXCEEDED") };
    }

    // ⑤ 白名单（仅派生事件 depth>0，且策略显式配置 sourceWhitelist 时生效）
    if (depth > 0 && pol && Array.isArray(pol.sourceWhitelist) && pol.sourceWhitelist.length) {
      /* 22.4 #11：白名单语义 = 「来源效果模板」。此前优先取 operationId（如 split.spawn），
       * 而白名单值是模板 ID（TP_*）→ 运行时开始携带 operationId 后必被拒。改为模板优先。 */
      const src = (ev.templateId !== undefined && ev.templateId !== null) ? ev.templateId : ev.operationId;
      if (pol.sourceWhitelist.indexOf(src) < 0) {
        return { accepted: false, eventId: null, reason: _seR("BUDGET_EXCEEDED") };
      }
    }

    // 接受：分配稳定序号并入队（FIFO 顺序即稳定序号顺序）
    const eventId = ++s.seq;
    const rec = {
      eventId: eventId,
      castId: ev.castId, ownerId: ev.ownerId, skillId: ev.skillId, effectId: ev.effectId,
      parentId: ev.parentId,       templateId: ev.templateId, operationId: ev.operationId,
      targetId: ev.targetId, depth: depth, simulationTime: _seNum(ev.simulationTime, 0),
      endReason: (ev.endReason !== undefined) ? ev.endReason : null,
      eventType: kind,
      routePolicyId: ev.routePolicyId,
      derive: (Array.isArray(ev.derive) && ev.derive.length) ? ev.derive : null,   // 22.4 #11：编译图边派生描述透传
    };
    s.queue.push(rec);
    s.perCast[castKey] = used + 1;
    if (eid !== null) {
      if (kind === "hit") s.firstHit[eid] = true;
      else s.vanish[eid] = true;
    }
    return { accepted: true, eventId: eventId, reason: null };
  },

  /** 别名（接口文档第七节命名空间列出）：语义等同 enqueue —— 「触发一个事件」。
   *  仍只入队、不同步递归派生。 */
  emit(world, ev) {
    return SkillEvents.enqueue(world, ev);
  },

  /** 按稳定序号消费队列（有限）：{ processed, derived, derivedCount, errors }。
   *  合法派生请求写入 derived 列表交给运行时创建；本函数**不**同步递归派生。 */
  drain(world) {
    const s = _seState(world);
    const maxStep = _seMaxPerStep();
    const derived = [];
    let processed = 0;
    while (s.queue.length > 0 && processed < maxStep) {
      const ev = s.queue.shift();
      processed++;
      s.stepConsumed++;
      _seDerive(s, ev, derived);
    }
    return { processed: processed, derived: derived, derivedCount: derived.length, errors: s.errors.slice() };
  },

  /** 每个模拟步开始时重置步计数（每步预算）。 */
  resetStep(world) {
    const s = _seState(world);
    s.step++;
    s.stepConsumed = 0;
    return { step: s.step };
  },

  /** 每次施放开始时重置该施放的事件预算。 */
  beginCast(world, castId) {
    const s = _seState(world);
    const key = (castId === undefined || castId === null) ? "" : castId;
    s.perCast[key] = 0;
    return { castId: castId, ok: true };
  },

  /** 探查用：可派生结束原因副本。 */
  derivableEndReasons() { return _SE_DERIVABLE.slice(); },
  /** 探查用：不可派生结束原因副本。 */
  nonDerivableEndReasons() { return _SE_NON_DERIVABLE.slice(); },
  /** 探查用：结束原因常量表副本。 */
  EndReasons() { return Object.assign({}, _SE_END); },
};

/* 单事件派生决策：合法则向 out 压入派生请求描述符（depth+1）。 */
function _seDerive(s, ev, out) {
  const er = ev.endReason;
  // ① 结束原因白名单：不可派生 / 未知 → 一律不派生（保守）
  if (er !== undefined && er !== null) {
    if (_SE_NON_DERIVABLE.indexOf(er) >= 0) return;
    if (_SE_DERIVABLE.indexOf(er) < 0) return;
  }

  // ② 默认只有主效果（depth 0）触发事件水晶；派生默认不触发（features.derivedEvents）
  //    22.8 例外：everyHit 策略（弹射/链锁）豁免本闸门（理由见 _seEveryHitPolicy）。
  const pol = _sePolicy(ev);
  if (ev.depth > 0 && !_seDerivedEventsEnabled() && !_seEveryHitPolicy(pol)) return;

  // ③ 深度上限（策略 maxDepth 可更严格）
  const polMaxDepth = (pol && typeof pol.maxDepth === "number" && isFinite(pol.maxDepth))
    ? pol.maxDepth : _seMaxDepth();
  if (ev.depth + 1 > _seMaxDepth()) { _seRecord(s, _seR("DERIVED_DEPTH_EXCEEDED"), ev); return; }
  if (ev.depth + 1 > polMaxDepth) { _seRecord(s, _seR("DERIVED_DEPTH_EXCEEDED"), ev); return; }

  // ④ 允许操作白名单（策略显式配置时）
  if (pol && Array.isArray(pol.allowedOps) && pol.allowedOps.length) {
    const op = ev.operationId;
    if (op !== undefined && op !== null && pol.allowedOps.indexOf(op) < 0) return;
  }

  // ⑤ 终止条件：terminateCond === "always" 表示永不派生
  if (pol && pol.terminateCond === "always") return;

  // ⑥ 次数上限：默认 1（保守，单个派生），受 budgets.maxDerivedPerEvent 约束
  const cap = _seMaxDerivedPerEvent();
  let maxCount = (pol && typeof pol.maxCount === "number" && isFinite(pol.maxCount)) ? pol.maxCount : 1;
  if (maxCount > cap) maxCount = cap;
  if (!(maxCount > 0)) return;

  // ⑦ 每施放派生预算（含已入队事件）
  const castKey = (ev.castId === undefined || ev.castId === null) ? "" : ev.castId;
  const perCast = _sePerCastBudget(pol);
  let used = s.perCast[castKey] || 0;

  const spawnTemplateId = (pol && pol.spawnTemplateId) ? pol.spawnTemplateId : ev.templateId;
  const damageBasisRef = (pol && pol.damageBasisRef) ? pol.damageBasisRef : null;

  /* 22.4 #11：事件携带编译图边派生描述（derive = [{nodeId}, ...]）时，
   * **每个描述符恰好推送 1 个派生请求**（语义即 EP_DERIVED_ONCE：每事件每派生节点派生一次），
   * maxCount 只作描述符数量上限；不再按 maxCount 复制同型请求（会 N× 放大实体）。 */
  const descriptors = (Array.isArray(ev.derive) && ev.derive.length) ? ev.derive.slice(0, maxCount) : null;

  const pushOne = function (nodeId) {
    if (used >= perCast) { _seRecord(s, _seR("EVENT_BUDGET_EXCEEDED"), ev); return false; }
    used++;
    s.perCast[castKey] = used;   // 派生请求同样占用该施放的事件预算（防无界）
    out.push({
      sourceEventId: ev.eventId,
      parentId: (ev.effectId !== undefined && ev.effectId !== null) ? ev.effectId : ev.parentId,
      castId: ev.castId, ownerId: ev.ownerId, skillId: ev.skillId,
      operationId: ev.operationId, templateId: spawnTemplateId,
      nodeId: nodeId,                                                   // 精确派生节点（可空 → 运行时按模板兜底）
      depth: ev.depth + 1, simulationTime: ev.simulationTime, targetId: ev.targetId,
      damageBasisRef: damageBasisRef, reason: null,
    });
    return true;
  };

  if (descriptors) {
    for (const d of descriptors) {
      if (!d || d.nodeId == null) continue;
      if (!pushOne(d.nodeId)) break;
    }
    return;
  }

  for (let i = 0; i < maxCount; i++) {
    if (!pushOne(null)) break;
  }
}

})();   // IIFE 结束：仅 SkillEvents 泄漏到全局
