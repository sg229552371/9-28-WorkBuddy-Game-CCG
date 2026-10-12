/* ============================================================
 * skill-compiler.js — SupportCompiler（能量水晶技能系统 · W2 开发）
 * 职责：技能定义 + 等级 + 水晶实例 → BuildResult（只读）；解释器逐水晶逐技能输出。
 * 边界（合同 §4）：**不做随机、不做碰撞、不改 run 状态、不改 CFG、不碰 UI**。
 *   定义与策略一律由入参传入（SkillConfig.get 或测试夹具），本文件不硬编码具体水晶/技能 ID。
 * 契约：G_docs/skill_system_interface_v1.md 第三节 / 第七节；合同 §5/§8/§17。
 * 编译 6 阶段（固定顺序，禁回退、禁试算到稳定）：
 *   校验实例 → 展开基础图 → 读基础能力筛结构操作 → 主形态/数量分布/派生 → 最终图匹配修饰
 *   → 归并/校验 → 解释 → 用途保护 → 只读输出。
 * 排列不变性：同一字段的操作先按「固定算子顺序 add|multiply|min|max|exclusive」分批，
 *   批内再按稳定 operationId 排序后归并 → 槽位装配顺序不改变结果。
 * ============================================================ */
"use strict";

const SupportCompiler = {
  /* 编译策略版本（进入 signature，策略变更必须 bump）。 */
  STRATEGY_VERSION: "sc-v1.0.0",

  /* 阶段固定顺序（合同 §8）。 */
  _PHASE_ORDER: ["base", "shape", "distribute", "derive", "nodeModify"],
  /* 结构阶段（在最终图匹配前完成；只读本阶段以前的图）。 */
  _STRUCT_PHASES: ["base", "shape", "distribute", "derive"],
  /* 已声明合并算子的固定归并顺序（合同 §8 / v0.5 §4）。 */
  _OP_ORDER: ["add", "multiply", "min", "max", "exclusive"],
  /* 已声明执行器白名单（未列入 → UNKNOWN_EXECUTOR）。 */
  _EXECUTORS: {
    modifyParameter: true, convertNode: true, addNode: true, removeNode: true,
    modifyStat: true,                              // 施放层统计（写 build.castStats）
  },
  /* 施放层统计白名单（modifyStat 目标字段；与 skill-config.js 的 _STATS 同源，此处为真源）。
   *   better = 该统计「变好」的方向（供用途保护/UI 判定真实收益）；base = 无贡献基准值。
   *   首版仅开 cdMul（冷却倍率，越小越快）。 */
  _STATS: {
    cdMul: { better: "lower", base: 1 },
  },

  /* 🔴 非伤害模板集合（白名单）：与 skill-config.js 的 _NON_DAMAGE_KINDS 同源，此处为编译侧副本。
   *   **只有**在此集合内的模板 kind 允许节点缺省 damageBasis（其余一律强制必填，fail-closed）。
   *   ⚠️ 两处必须同步；hero_nondamage_skill_test.js 有「两侧一致」守卫断言。 */
  _NON_DAMAGE_KINDS: { summonUnit: true },

  /* 最近一次归一化后的定义（供 preview 在未显式传入时兜底）。 */
  _lastDefs: null,

  /* ============================================================
   * 公共 API
   * ============================================================ */

  /** 编译整组：{ ok, builds, explanations, diagnostics, signature }。
   *  input = { heroId, state: HeroSkillState, definitions, stats?, baseline? }。
   *  ok=false 时不发布半成品：builds 必为空对象。 */
  compile(input) {
    const I = input || {};
    const state = I.state || {};
    const defs = SupportCompiler._defs(I.definitions);
    SupportCompiler._lastDefs = defs.raw;

    const diagnostics = [];
    const signature = SupportCompiler._signature(I, state, defs);

    /* 阶段 1：校验实例引用、等级、槽位限制 */
    const skillIds = SupportCompiler._validateInstances(state, defs, diagnostics);
    if (diagnostics.length) {
      return SupportCompiler._fail(signature, diagnostics, []);
    }

    /* 阶段 2~7：逐技能构建完整图 */
    const builds = {};
    const conflictCrystals = {};
    for (const sid of skillIds) {
      const g = SupportCompiler._buildSkillGraph(state, sid, defs, diagnostics);
      builds[sid] = g;
      for (const cid of (g.conflictCrystals || [])) conflictCrystals[cid] = true;
    }

    /* 阶段 8：逐水晶逐技能解释（失败也产出，供 UI 展示失效项）。
     * 解释按水晶 ID 规范排序遍历 → 装配顺序不改变解释顺序。 */
    const explanations = [];
    const crysSorted = (Array.isArray(state.crystals) ? state.crystals : [])
      .slice().sort(SupportCompiler._byCrystalId);
    for (const sid of skillIds) {
      const g = builds[sid];
      for (const c of crysSorted) {
        explanations.push(SupportCompiler._explainCrystalSkill(g, c, defs, conflictCrystals));
      }
    }

    if (diagnostics.length) {
      return SupportCompiler._fail(signature, diagnostics, explanations);
    }

    /* 阶段 9：收益与用途保护（每颗已装水晶必须仍至少对一个已有技能有实际收益） */
    SupportCompiler._checkPurpose(builds, skillIds, state, diagnostics);
    if (diagnostics.length) {
      return SupportCompiler._fail(signature, diagnostics, explanations);
    }

    /* 阶段 10：冻结只读构建 */
    SupportCompiler._deepFreeze(builds);
    return {
      ok: true, builds: builds, explanations: explanations,
      diagnostics: [], signature: signature, reasonCodes: [],
    };
  },

  /** 变更预览：{ legal, nextGroup, result, reasonCodes }（装配/升级前模拟完整新组合）。 */
  preview(state, change) {
    const ch = change || {};
    const defs = SupportCompiler._defs(
      ch.definitions || state.definitions || state.defs || SupportCompiler._lastDefs);

    /* 技能安装试装（稀有技能授予，v0.5 §1）：与「水晶装/升级」并列的第三种装配变更。
     * 技能表 +1 项 → 走全量编译校验（技能数上限 / 与已装形态冲突）。
     * 缺此分支时，SkillReward.rollStatueGrant 的技能候选恒判非法 → 永远走属性兜底、
     * 稀有技能永不授予（本轮修复的跨模块缺口）。 */
    if (ch.kind === "installSkill") {
      const sid = ch.skillId;
      const skills = {};
      for (const k of Object.keys(state.skills || {})) skills[k] = state.skills[k];
      if (!sid || skills[sid]) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("INVALID_REFERENCE")] };
      }
      const rawT = (defs.raw && defs.raw.skillDefs) ? defs.raw
        : ((typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : defs.raw);
      const maxSkills = (state.maxSkillsPerHero != null) ? state.maxSkillsPerHero
        : ((rawT && rawT.maxSkillsPerHero != null) ? rawT.maxSkillsPerHero : 2);
      if (Object.keys(skills).length >= maxSkills) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("SLOTS_FULL")] };
      }
      /* 新装技能等级 = 本英雄现有技能等级（= 武器等级，见 skillLevelOf 注释）。
       * 与 _applySkillInstall / _installRareSkill 取同一函数，保证试装结果 == 落地结果。 */
      skills[sid] = { id: sid, level: SupportCompiler.skillLevelOf(state) };
      const nextGroupS = SupportCompiler._extend(state, {
        skills: skills, groupVersion: (state.groupVersion || 0) + 1,
      });
      const resultS = SupportCompiler.compile({ heroId: state.heroId, state: nextGroupS, definitions: rawT });
      const rcS = [];
      if (resultS && !resultS.ok) {
        for (const code of (resultS.reasonCodes || [])) {
          if (rcS.indexOf(code) < 0) rcS.push(code);
        }
      }
      return { legal: !!(resultS && resultS.ok), nextGroup: nextGroupS, result: resultS, reasonCodes: rcS };
    }

    const cd = defs.crystalDef(ch.crystalId);
    if (!cd) {
      return { legal: false, nextGroup: state, result: null,
        reasonCodes: [SupportCompiler._R("INVALID_REFERENCE")] };
    }
    const slotCount = state.slotCount || defs.slotCount;
    const crystals = (state.crystals || []).map(function (c) {
      return { crystalId: c.crystalId, level: c.level || 1 };
    });
    let idx = -1;
    for (let i = 0; i < crystals.length; i++) {
      if (crystals[i].crystalId === ch.crystalId) { idx = i; break; }
    }

    let nextCrystals;
    if (ch.kind === "install") {
      if (idx >= 0) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("INVALID_REFERENCE")] };
      }
      if (crystals.length >= slotCount) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("SLOTS_FULL")] };
      }
      nextCrystals = crystals.concat([{ crystalId: ch.crystalId, level: 1 }]);
    } else if (ch.kind === "upgrade") {
      if (idx < 0) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("INVALID_REFERENCE")] };
      }
      const max = Array.isArray(cd.levels) ? cd.levels.length : 1;
      if (crystals[idx].level >= max) {
        return { legal: false, nextGroup: state, result: null,
          reasonCodes: [SupportCompiler._R("MAX_LEVEL")] };
      }
      nextCrystals = crystals.slice();
      nextCrystals[idx] = { crystalId: crystals[idx].crystalId, level: crystals[idx].level + 1 };
    } else {
      return { legal: false, nextGroup: state, result: null,
        reasonCodes: [SupportCompiler._R("INVALID_REFERENCE")] };
    }

    /* 槽位按 ID 规范排序后重排（槽位排列不影响结果） */
    nextCrystals.sort(SupportCompiler._byCrystalId);
    for (let i = 0; i < nextCrystals.length; i++) nextCrystals[i].slot = i;
    const nextGroup = SupportCompiler._extend(state, {
      crystals: nextCrystals, groupVersion: (state.groupVersion || 0) + 1,
    });

    const result = SupportCompiler.compile({ heroId: state.heroId, state: nextGroup, definitions: defs.raw });

    const reasonCodes = [];
    if (ch.kind === "install" && !SupportCompiler._crystalHasGain(result, ch.crystalId)) {
      reasonCodes.push(SupportCompiler._R("NO_GAIN"));
    }
    if (result && !result.ok) {
      for (const code of (result.reasonCodes || [])) {
        if (reasonCodes.indexOf(code) < 0) reasonCodes.push(code);
      }
    }
    const legal = !!(result && result.ok) && reasonCodes.indexOf(SupportCompiler._R("NO_GAIN")) < 0;
    return { legal: legal, nextGroup: nextGroup, result: result, reasonCodes: reasonCodes };
  },

  /** 单技能图（供运行时/测试）：{ ok, skillId, graph, diagnostics }。 */
  buildOne(state, skillId, definitions) {
    const defs = SupportCompiler._defs(definitions);
    const diagnostics = [];
    const inst = (state && state.skills) ? state.skills[skillId] : null;
    if (!inst || !defs.skillDef(inst.id)) {
      diagnostics.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: skillId,
        opId: null, field: null, message: "技能实例或技能定义缺失" });
      return { ok: false, skillId: skillId, graph: null, diagnostics: diagnostics };
    }
    const graph = SupportCompiler._buildSkillGraph(state, skillId, defs, diagnostics);
    const ok = diagnostics.length === 0;
    return {
      ok: ok, skillId: skillId,
      graph: ok ? SupportCompiler._deepFreeze(graph) : graph,
      diagnostics: diagnostics,
    };
  },

  /** 逐水晶逐技能解释（对单技能图）。
   *  返回 [{ crystalId, skillId, status, nodes, before, after, reasonCodes }] */
  explain(build, definitions) {
    if (!build) return [];
    const defs = SupportCompiler._defs(definitions);
    const conflict = {};
    for (const cid of (build.conflictCrystals || [])) conflict[cid] = true;
    const out = [];
    for (const c of (build.crystals || [])) {
      out.push(SupportCompiler._explainCrystalSkill(build, c, defs, conflict));
    }
    return out;
  },

  /* ============================================================
   * 内部：定义归一化
   * ============================================================ */

  /** 归一化入参定义：支持 SkillConfig 式访问器（含 get/tables/version）或纯表对象。 */
  _defs(raw) {
    if (!raw && typeof SkillConfig !== "undefined" && SkillConfig) raw = SkillConfig;
    raw = raw || {};
    const isAcc = typeof raw.get === "function";
    let meta = raw;
    if (typeof raw.tables === "function") {
      try { const t = raw.tables(); if (t) meta = t; } catch (e) { /* 无 CFG 时静默降级 */ }
    }
    let ver = meta.configVersion || raw.configVersion || "cfg-unknown";
    if (typeof raw.version === "function") {
      try { const v = raw.version(); if (v) ver = v; } catch (e2) { /* 保持默认 */ }
    }
    const skillDefs = raw.skillDefs || meta.skillDefs || {};
    const crystalDefs = raw.crystalDefs || meta.crystalDefs || {};
    const effectTemplates = raw.effectTemplates || meta.effectTemplates || {};
    const hitPolicies = raw.hitPolicies || meta.hitPolicies || {};
    return {
      raw: raw,
      configVersion: String(ver),
      slotCount: raw.slotCount || meta.slotCount || 4,
      budgets: raw.budgets || meta.budgets || {},
      rules: raw.supportGroupRules || meta.supportGroupRules || {},
      hasHitPolicies: Object.keys(hitPolicies).length > 0,
      skillDef: function (id) { return (isAcc ? raw.get("skill", id) : skillDefs[id]) || null; },
      crystalDef: function (id) { return (isAcc ? raw.get("crystal", id) : crystalDefs[id]) || null; },
      templateDef: function (id) { return (isAcc ? raw.get("template", id) : effectTemplates[id]) || null; },
      hitPolicy: function (id) { return (isAcc ? raw.get("policy", id) : hitPolicies[id]) || null; },
    };
  },

  /* ============================================================
   * 内部：阶段 1 校验 + signature
   * ============================================================ */

  _validateInstances(state, defs, diag) {
    const skillIds = [];
    const skills = (state && state.skills) ? state.skills : {};
    for (const sid of Object.keys(skills).sort()) {
      const inst = skills[sid];
      const defId = (inst && inst.id) ? inst.id : sid;
      const def = defs.skillDef(defId);
      if (!inst || !def) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: defId,
          opId: null, field: null, message: "技能实例或技能定义缺失" });
        continue;
      }
      const lv = inst.level || 1;
      if (!Array.isArray(def.levels) || lv < 1 || lv > def.levels.length) {
        diag.push({ code: SupportCompiler._R("LEVEL_OVERFLOW"), definitionId: defId,
          opId: null, field: "level", message: "技能等级越界" });
      }
      skillIds.push(sid);
    }

    const crystals = Array.isArray(state.crystals) ? state.crystals : [];
    const slotCount = state.slotCount || defs.slotCount;
    if (crystals.length > slotCount) {
      diag.push({ code: SupportCompiler._R("SLOTS_FULL"), definitionId: null,
        opId: null, field: "slotCount", message: "水晶实例数超过槽位上限" });
    }
    const seen = {};
    for (const c of crystals) {
      const cid = c ? (c.crystalId || c.id) : null;
      const cd = cid ? defs.crystalDef(cid) : null;
      if (!cid || !cd) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: cid || null,
          opId: null, field: "crystalId", message: "水晶引用缺失" });
        continue;
      }
      if (seen[cid]) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: cid,
          opId: null, field: "crystalId", message: "重复水晶实例（同 ID 应合并升级）" });
      }
      seen[cid] = true;
      const lv = c.level || 1;
      if (!Array.isArray(cd.levels) || lv < 1 || lv > cd.levels.length) {
        diag.push({ code: SupportCompiler._R("MAX_LEVEL"), definitionId: cid,
          opId: null, field: "level", message: "水晶等级越界或已达上限" });
      }
      for (const op of (cd.operations || [])) {
        if (!SupportCompiler._EXECUTORS[op.executor]) {
          diag.push({ code: SupportCompiler._R("UNKNOWN_EXECUTOR"), definitionId: cid,
            opId: op.id || null, field: op.field || null, message: "未知执行器：" + String(op.executor) });
        }
      }
    }
    return skillIds;
  },

  /** signature = 缓存键：configVersion + 英雄基础差异 + 技能 ID/等级 + 水晶 ID/等级（按 ID 规范排序）+ 编译策略版本。 */
  _signature(input, state, defs) {
    const heroId = (input && input.heroId != null) ? input.heroId : state.heroId;
    const baseline = (input && input.baseline) || state.baseline || null;
    const skills = Object.keys(state.skills || {}).sort().map(function (id) {
      const lv = ((state.skills[id] || {}).level) || 1;
      return id + "@" + lv;
    });
    const crystals = (state.crystals || []).slice().sort(SupportCompiler._byCrystalId).map(function (c) {
      return (c.crystalId || c.id) + "@" + (c.level || 1);
    });
    return [
      "cfg=" + defs.configVersion,
      "strategy=" + SupportCompiler.STRATEGY_VERSION,
      "hero=" + (heroId == null ? "-" : String(heroId)),
      "slots=" + (state.slotCount || defs.slotCount),
      "baseline=" + (baseline ? SupportCompiler._stableStringify(baseline) : "-"),
      "skills=" + skills.join(","),
      "crystals=" + crystals.join(","),
    ].join("|");
  },

  /* ============================================================
   * 技能等级真源（合同 §101「技能等级成长来源沿用项目实际路径，先审查，不额外发明第二套升级经济」）
   * ------------------------------------------------------------
   * 项目实际路径 = **武器等级 = 技能等级**（局外 `Meta.weaponLv(heroId)`，1~100)。
   * 本函数是**纯函数**：只读入参 state，**不读 CFG、不读 Meta**（保持编译器可独立测试）。
   *
   * 用途（三处必须取同一等级，否则「预览用 L1、落地用 L3」会让候选合法性与结果不一致）：
   *   ① `preview({ kind:"installSkill" })` —— 稀有技能试装；
   *   ② `SkillReward._applySkillInstall` —— 候选组合模拟；
   *   ③ `SkillPlaytest._installRareSkill` —— 真正落地。
   * 新装技能一律**继承本英雄已有技能的等级**（英雄的技能共享同一武器等级）。
   *
   * 取「按技能 ID 规范排序的第一个有效等级」，保证同状态多次调用结果稳定。
   * 无技能 / 无有效等级 → 1（**等价于接入前行为**，老调用点零影响）。
   * ⚠️ 越界钳制不在这里做：等级上限 = `def.levels.length`，由**注入方**（`SkillPlaytest.skillLevelFor`）
   *    钳制；编译器对越界等级仍按 `LEVEL_OVERFLOW` 硬失败（这是契约要求，不做静默修正）。 */
  skillLevelOf(state) {
    const sk = (state && state.skills) || {};
    for (const id of Object.keys(sk).sort()) {
      const lv = sk[id] && sk[id].level;
      if (typeof lv === "number" && lv >= 1) return lv;
    }
    return 1;
  },

  /* ============================================================
   * 内部：阶段 2~7 单技能图构建
   * ============================================================ */

  _buildSkillGraph(state, skillId, defs, diag) {
    const inst = state.skills[skillId];
    const skill = defs.skillDef(inst.id);
    const level = inst.level || 1;
    const lvSpec = (skill.levels && skill.levels[level - 1]) || {};
    /* 施放策略覆盖（22.4 #12）：convertNode 类操作可声明 castPolicyId（环绕 → CAST_ORBIT），
     * 编译产物携带，调度器优先于技能定义的 castPolicyId 读取。 */
    let castPolicyOverride = null;

    /* 阶段 2：展开基础图（克隆，绝不改 definitions） */
    const baseGraph = skill.baseGraph || { nodes: [], edges: [] };
    const nodes = {};
    for (const n of (baseGraph.nodes || [])) {
      const node = SupportCompiler._cloneNode(n, lvSpec);
      nodes[node.nodeId] = node;
    }
    const edges = (baseGraph.edges || []).map(function (e) {
      return { from: e.from, to: e.to, event: e.event || null };
    });

    /* 合法原始基准集合（派生只能引用未经外部加成的 baseRef） */
    const baseRefs = {};
    for (const id of Object.keys(nodes)) {
      const bref = nodes[id].damageBasis && nodes[id].damageBasis.baseRef;
      if (bref) baseRefs[bref] = true;
    }
    const baseCaps = SupportCompiler._capPool(nodes);

    /* 收集全部操作（含等级参数快照） */
    const crystals = Array.isArray(state.crystals) ? state.crystals : [];
    const opsAll = [];
    for (const c of crystals) {
      const cid = c.crystalId || c.id;
      const cd = defs.crystalDef(cid);
      if (!cd) continue; /* 引用错误已在阶段 1 报出 */
      const lv = c.level || 1;
      const lvP = (cd.levels && cd.levels[lv - 1] && cd.levels[lv - 1].parameters) || {};
      for (const op of (cd.operations || [])) {
        opsAll.push({ crystalId: cid, crystal: cd, level: lv, lvParams: lvP, op: op });
      }
    }

    const contributions = [];
    const conflicts = [];
    const resourceClaims = {};
    const conflictCrystals = {};

    /* 阶段 4：结构阶段（base → shape → distribute → derive）。
     * 每阶段在开始处快照节点「视图」：操作只读本阶段以前的结构，
     * 同阶段内后一操作看不到前一操作新增/改造的结果（不得靠自身新增能力过前置检查）。 */
    for (const phase of SupportCompiler._STRUCT_PHASES) {
      const views = Object.keys(nodes).map(function (id) { return SupportCompiler._view(nodes[id]); });
      const stageOps = opsAll.filter(function (x) { return x.op.phase === phase; })
        .sort(SupportCompiler._byOpId);
      for (const item of stageOps) {
        const cpOvr = SupportCompiler._applyOp(nodes, edges, views, item, contributions, resourceClaims, defs, diag);
        if (cpOvr) castPolicyOverride = cpOvr;
      }
    }

    /* 阶段 5：nodeModify 在最终图匹配（含派生节点） */
    const finalViews = Object.keys(nodes).map(function (id) { return SupportCompiler._view(nodes[id]); });
    const modifyOps = opsAll.filter(function (x) { return x.op.phase === "nodeModify"; })
      .sort(SupportCompiler._byOpId);
    for (const item of modifyOps) {
      SupportCompiler._applyOp(nodes, edges, finalViews, item, contributions, resourceClaims, defs, diag);
    }

    /* 阶段 5.5：施放层统计（modifyStat）—— 不匹配节点、不改节点，直接累积到 castStats。
     * 按执行器收集（phase 为语义标记「cast」，编译器不把它当结构阶段）；
     * 归并与 _addParamContribution 同源；产物进 build.castStats（无贡献 = {}，不得为 undefined）。 */
    const castStats = {};
    const statOps = opsAll.filter(function (x) { return x.op.executor === "modifyStat"; })
      .sort(SupportCompiler._byOpId);
    if (statOps.length) SupportCompiler._applyStatOps(castStats, statOps, contributions, diag);

    /* 阶段 6：按字段固定算子顺序归并（来源按稳定 operationId 排序） */
    SupportCompiler._resolveMerges(nodes, contributions, conflicts);

    /* 阶段 7：资源互斥（资源组 + 技能作用域）+ 结构/引用/预算校验 */
    for (const res of Object.keys(resourceClaims)) {
      const claims = resourceClaims[res];
      if (claims.length >= 2) {
        for (const cl of claims) conflictCrystals[cl.crystalId] = true;
        diag.push({ code: SupportCompiler._R("MOTION_CONFLICT"), definitionId: claims[0].crystalId,
          opId: claims[0].opId, field: res, message: "资源组互斥：同技能多来源争用 " + res });
      }
    }
    for (const cf of conflicts) {
      for (const cid of cf.crystals) conflictCrystals[cid] = true;
      diag.push({ code: SupportCompiler._R("MOTION_CONFLICT"), definitionId: cf.crystals[0],
        opId: null, field: cf.field, message: "exclusive 字段多来源：" + cf.nodeId + "." + cf.field });
    }

    SupportCompiler._validateGraph(nodes, edges, baseRefs, defs, diag);

    const crystalsSnapshot = crystals.map(function (c) {
      return { crystalId: c.crystalId || c.id, level: c.level || 1 };
    }).sort(SupportCompiler._byCrystalId);
    const graph = {
      skillId: skillId, skillDefId: inst.id, level: level,
      nodes: nodes, edges: edges, contributions: contributions,
      capabilities: { base: baseCaps, final: SupportCompiler._capPool(nodes) },
      crystals: crystalsSnapshot,
      conflictCrystals: Object.keys(conflictCrystals).sort(),
      castPolicyId: castPolicyOverride || null,     // 22.4 #12：操作声明的施放策略覆盖
      castStats: castStats,                          // 施放层统计（modifyStat 产物；无贡献 = {}）
    };
    return graph;
  },

  /* ============================================================
   * 内部：单个操作应用（结构/参数统一入口）
   * ============================================================ */

  _applyOp(nodes, edges, views, item, contributions, resourceClaims, defs, diag) {
    const op = item.op;
    if (!SupportCompiler._EXECUTORS[op.executor]) return null; /* 未知执行器已在阶段 1 报出 */

    /* 施放层统计（modifyStat）：不参与节点匹配、不修改任何节点。
     * castStats 累积在 _buildSkillGraph 的专用循环（本函数无 castStats 出口）→ 此处早退，
     * 避免落入下方节点匹配分支产生副作用。 */
    if (op.executor === "modifyStat") return null;

    const matched = [];
    for (const v of views) {
      if (SupportCompiler._matchSelector(op.selector, v)) {
        const node = nodes[v.nodeId];
        if (node) matched.push(node);
      }
    }
    if (!matched.length) return;

    if (op.resource) SupportCompiler._claimResource(resourceClaims, op.resource, item.crystalId, op.id);

    if (op.executor === "modifyParameter") {
      for (const node of matched) SupportCompiler._addParamContribution(node, item, contributions);
      return;
    }

    if (op.executor === "convertNode") {
      const newTemplate = op.spawnTemplateId || op.templateId;
      const tdef = newTemplate ? defs.templateDef(newTemplate) : null;
      if (newTemplate && !tdef) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: item.crystalId,
          opId: op.id, field: "templateId", message: "未知模板引用：" + String(newTemplate) });
        return;
      }
      for (const node of matched) {
        const before = node.templateId;
        node.templateId = newTemplate;
        if (tdef && tdef.capabilities) node.capabilities = tdef.capabilities.slice();
        else if (op.capabilities) node.capabilities = op.capabilities.slice();
        if (tdef && tdef.tags) node.tags = tdef.tags.slice();
        if (op.role) node.role = op.role;
        /* 形态转换参数重置（22.4 #12）：防旧形态参数泄漏——环绕曾拿到投射物的
         * radius=8（贴身转圈）/ life=1.6（秒退）/ count=1（单球）。
         * 规则：保留伤害恒等参数（coefficient / moreDamageMul），其余形态参数
         * （速度/寿命/半径/数量/贯穿/追踪）一律回落模板默认（CFG.skillSystem.defaults.*）。 */
        const oldParams = node.parameters || {};
        const fresh = {};
        if (oldParams.coefficient != null) fresh.coefficient = oldParams.coefficient;
        if (oldParams.moreDamageMul != null) fresh.moreDamageMul = oldParams.moreDamageMul;
        if (op.parameters) Object.assign(fresh, op.parameters);
        /* 等级参数接线：与 modifyParameter 同源语义（op.field ← lvParams[op.parameter] | op.value），
         * 供 CR_ORBIT 等以等级表驱动形态数量（orbitCount → count）。 */
        const cvField = SupportCompiler._fieldName(op.field);
        if (cvField) {
          let cvValue = null;
          if (op.parameter != null && item.lvParams[op.parameter] != null) cvValue = item.lvParams[op.parameter];
          else if (op.value != null) cvValue = op.value;
          if (cvValue != null) fresh[cvField] = cvValue;
        }
        node.parameters = fresh;
        /* 施放策略随形态切换（22.4 #12）：环绕等无目标形态由操作声明 castPolicyId，
         * 编译产物（图）携带覆盖值，调度器优先读取（def 的 castPolicyId 退为缺省）。 */
        contributions.push({ crystalId: item.crystalId, opId: op.id, nodeId: node.nodeId,
          field: "templateId", kind: "structural", value: newTemplate, merge: "exclusive",
          benefit: before !== newTemplate, before: before, after: newTemplate });
      }
      return op.castPolicyId || null;
    }

    if (op.executor === "addNode") {
      const newTemplate = op.spawnTemplateId || op.templateId;
      const tdef = newTemplate ? defs.templateDef(newTemplate) : null;
      if (!newTemplate || !tdef) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: item.crystalId,
          opId: op.id, field: "spawnTemplateId", message: "派生节点模板引用无效" });
        return;
      }
      for (const src of matched) {
        const newId = op.newNodeId || (op.id + "@" + src.nodeId);
        if (!nodes[newId]) {
          const basisRef = op.damageBasisRef || (src.damageBasis && src.damageBasis.baseRef) || null;
          /* 22.8 扩容：等级表 → 派生节点参数（与 convertNode 同源语义：op.field ← lvParams[op.parameter]）。
           * 用途：弹射/链锁的「链长」chainLeft、灼烧的「持续伤害」dps 等派生参数随水晶等级成长。
           * 缺 field 或等级表无该键 → 不写入，保持操作里的静态 parameters（零影响）。 */
          const derivedParams = Object.assign({}, op.parameters || {});
          const dvField = SupportCompiler._fieldName(op.field);
          if (dvField) {
            let dvValue = null;
            if (op.parameter != null && item.lvParams[op.parameter] != null) dvValue = item.lvParams[op.parameter];
            else if (op.value != null) dvValue = op.value;
            if (dvValue != null) derivedParams[dvField] = dvValue;
          }
          nodes[newId] = {
            nodeId: newId, templateId: newTemplate, role: op.role || "derived",
            capabilities: (tdef.capabilities || []).slice(),
            tags: (tdef.tags || []).slice(),
            parameters: derivedParams,
            damageBasis: {
              baseRef: basisRef,
              coefficient: (typeof op.coefficient === "number" ? op.coefficient : 1),
              inheritFactorKeys: (op.inheritFactors || []).slice(),
            },
            hitPolicyId: op.hitPolicyId || tdef.hitPolicyId || "HP_DERIVED_AREA",
            /* 事件路由身份（22.4 #11）：操作 → 派生节点 → 事件。
             * operationId / routePolicyId 随节点进入运行时效果实例，再随事件上报，
             * 使 eventPolicies（EP_DERIVED_ONCE 的白名单/次数/预算）真正命中。 */
            operationId: op.id,
            routePolicyId: op.routePolicyId || null,
            derived: true, parentNodeId: src.nodeId,
          };
        }
        edges.push({ from: src.nodeId, to: newId, event: op.event || "onExpire" });
        contributions.push({ crystalId: item.crystalId, opId: op.id, nodeId: newId,
          field: "__node__", kind: "structural", value: newId, merge: "add",
          benefit: true, before: null, after: newId });
      }
      return;
    }

    if (op.executor === "removeNode") {
      for (const node of matched) {
        contributions.push({ crystalId: item.crystalId, opId: op.id, nodeId: node.nodeId,
          field: "__remove__", kind: "structural", value: null, merge: "exclusive",
          benefit: true, before: node.nodeId, after: null });
        delete nodes[node.nodeId];
      }
      for (let i = edges.length - 1; i >= 0; i--) {
        if (!nodes[edges[i].from] || !nodes[edges[i].to]) edges.splice(i, 1);
      }
      return;
    }
  },

  /** 参数操作 → 贡献项（延迟到阶段 6 统一归并）。 */
  _addParamContribution(node, item, contributions) {
    const op = item.op;
    const field = SupportCompiler._fieldName(op.field);
    if (!field) return;
    let value = null;
    if (op.parameter != null && item.lvParams[op.parameter] != null) value = item.lvParams[op.parameter];
    else if (op.value != null) value = op.value;
    else if (item.lvParams[field] != null) value = item.lvParams[field];
    if (typeof value !== "number" || !isFinite(value)) return;
    const merge = op.merge || "add";
    contributions.push({
      crystalId: item.crystalId, opId: op.id, nodeId: node.nodeId, field: field,
      kind: "param", value: value, merge: merge,
      benefit: SupportCompiler._isBenefit(merge, value), before: null, after: null,
    });
  },

  /** 施放层统计操作（modifyStat）→ 累积到 castStats；贡献项 kind="stat"。
   *  与 _addParamContribution 同源：
   *    multiply → acc = (acc == null ? 1 : acc) × value
   *    add      → acc = (acc == null ? 0 : acc) + value
   *    min/max  → 取最值；exclusive 多来源 → MOTION_CONFLICT（与 _resolveMerges 同口径）。
   *  取值优先级：lvParams[op.parameter] → op.value。
   *  stat 白名单越界 → UNKNOWN_STAT 诊断（编译失败，防静默无效）。 */
  _applyStatOps(castStats, statItems, contributions, diag) {
    /* 按 stat 分组（同 stat 的来源合并；不同 stat 互不干扰） */
    const byStat = {};
    for (const item of statItems) {
      const stat = item.op.stat;
      if (!SupportCompiler._STATS[stat]) {
        diag.push({ code: SupportCompiler._R("UNKNOWN_STAT"), definitionId: item.crystalId,
          opId: item.op.id || null, field: "stat", message: "未知施放层统计：" + String(stat) });
        continue;
      }
      (byStat[stat] || (byStat[stat] = [])).push(item);
    }
    /* stat 名按字典序（结果与装配顺序无关；数值归并本身可交换） */
    for (const stat of Object.keys(byStat).sort()) {
      const items = byStat[stat].slice().sort(SupportCompiler._byOpId);
      let exclCount = 0;
      for (const x of items) if ((x.op.merge || "multiply") === "exclusive") exclCount++;
      const exclConflict = exclCount > 1;
      if (exclConflict) {
        diag.push({ code: SupportCompiler._R("MOTION_CONFLICT"), definitionId: items[0].crystalId,
          opId: items[0].op.id || null, field: stat, message: "施放层统计 exclusive 多来源争用：" + stat });
      }
      let acc = null;
      for (const item of items) {
        const value = SupportCompiler._statValue(item);
        if (typeof value !== "number" || !isFinite(value)) continue;
        const merge = item.op.merge || "multiply";
        const before = acc;
        if (merge === "multiply") acc = (acc == null ? 1 : acc) * value;
        else if (merge === "add") acc = (acc == null ? 0 : acc) + value;
        else if (merge === "min") acc = (acc == null ? value : Math.min(acc, value));
        else if (merge === "max") acc = (acc == null ? value : Math.max(acc, value));
        else if (merge === "exclusive") { if (!exclConflict) acc = value; }
        contributions.push({
          crystalId: item.crystalId, opId: item.op.id, nodeId: null, field: stat,
          kind: "stat", value: value, merge: merge,
          benefit: !exclConflict && SupportCompiler._statBenefit(stat, acc),
          before: before, after: acc,
        });
      }
      if (acc != null) castStats[stat] = acc;
    }
  },

  /** modifyStat 取值：lvParams[op.parameter] → op.value；均缺 → null。 */
  _statValue(item) {
    const op = item.op;
    if (op.parameter != null && item.lvParams && item.lvParams[op.parameter] != null) return item.lvParams[op.parameter];
    if (op.value != null) return op.value;
    return null;
  },

  /** 施放层统计是否有真实收益（供用途保护/UI）。按 _STATS.better 判定方向；越界或无元数据 → false。 */
  _statBenefit(stat, acc) {
    const meta = SupportCompiler._STATS[stat];
    if (!meta || typeof acc !== "number" || !isFinite(acc)) return false;
    const base = (meta.base != null) ? meta.base : 1;
    if (meta.better === "lower") return acc < base;
    if (meta.better === "higher") return acc > base;
    return acc !== base;
  },

  _claimResource(map, res, crystalId, opId) {
    if (!map[res]) map[res] = [];
    for (const x of map[res]) if (x.crystalId === crystalId) return;
    map[res].push({ crystalId: crystalId, opId: opId });
  },

  /** 阶段 6：按字段固定算子顺序归并；同算子批内按 operationId 排序（浮点同序）。 */
  _resolveMerges(nodes, contributions, conflicts) {
    const groups = {};
    for (const c of contributions) {
      if (c.kind !== "param") continue;
      const key = c.nodeId + "|" + c.field;
      (groups[key] || (groups[key] = [])).push(c);
    }
    for (const key of Object.keys(groups)) {
      const list = groups[key];
      const node = nodes[list[0].nodeId];
      if (!node) continue;
      const field = list[0].field;
      const base = SupportCompiler._num(node.parameters[field], 0);
      let v = base;
      for (const opName of SupportCompiler._OP_ORDER) {
        const xs = list.filter(function (x) { return x.merge === opName; }).sort(SupportCompiler._byOpId);
        if (!xs.length) continue;
        if (opName === "add") {
          for (const x of xs) v += x.value;
        } else if (opName === "multiply") {
          for (const x of xs) v *= x.value;
        } else if (opName === "min") {
          for (const x of xs) v = Math.min(v, x.value);
        } else if (opName === "max") {
          for (const x of xs) v = Math.max(v, x.value);
        } else if (opName === "exclusive") {
          if (xs.length > 1) {
            conflicts.push({ field: field, nodeId: node.nodeId, crystals: xs.map(function (x) { return x.crystalId; }) });
            for (const x of xs) x.benefit = false;
          } else {
            v = xs[0].value;
          }
        }
      }
      for (const x of list) { x.before = base; x.after = v; }
      node.parameters[field] = v;
    }
  },

  /* ============================================================
   * 内部：阶段 7 校验
   * ============================================================ */

  _validateGraph(nodes, edges, baseRefs, defs, diag) {
    const ids = Object.keys(nodes);
    /* 事件终止：无环 */
    if (SupportCompiler._hasCycle(ids, edges)) {
      diag.push({ code: SupportCompiler._R("CYCLE_DEPENDENCY"), definitionId: null,
        opId: null, field: "edges", message: "事件派生边成环" });
    }
    /* 预算：单技能节点数 */
    const maxCast = SupportCompiler._num(defs.budgets.maxEffectsPerCast, Infinity);
    if (ids.length > maxCast) {
      diag.push({ code: SupportCompiler._R("BUDGET_EXCEEDED"), definitionId: null,
        opId: null, field: "nodeCount", message: "节点数超单施放预算" });
    }
    /* 派生深度 */
    const maxDepth = SupportCompiler._num(defs.budgets.maxEventDepth, 2);
    const depth = SupportCompiler._nodeDepths(ids, edges);
    for (const id of Object.keys(depth)) {
      if (depth[id] > maxDepth) {
        diag.push({ code: SupportCompiler._R("DERIVED_DEPTH_EXCEEDED"), definitionId: null,
          opId: null, field: "depth", message: "派生深度超限：" + id });
      }
    }
    /* 伤害基准 + 命中策略 + 引用 */
    for (const id of ids) {
      const node = nodes[id];
      const bref = node.damageBasis && node.damageBasis.baseRef;
      /* v2：非伤害模板（_NON_DAMAGE_KINDS）允许缺省 damageBasis —— 唯一放宽的既有硬约束。
       * 其余模板（含全部既有 4 类）仍强制必填；模板未知 → tpl 为空 → 仍按必填报（fail-closed）。 */
      const tpl = node.templateId ? defs.templateDef(node.templateId) : null;
      const nonDamage = !!(tpl && tpl.kind && SupportCompiler._NON_DAMAGE_KINDS[tpl.kind]);
      if (nonDamage && !bref) {
        /* 非伤害节点：无伤害基准 → 跳过三类基准校验（召唤物等） */
      } else if (!bref) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: null,
          opId: null, field: "damageBasis.baseRef", message: "节点缺少原始伤害基准引用：" + id });
      } else if (SupportCompiler._referencesSettledResult(bref)) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: null,
          opId: null, field: "damageBasis.baseRef", message: "派生不得引用已结算结果：" + id });
      } else if (baseRefs && !baseRefs[bref]) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: null,
          opId: null, field: "damageBasis.baseRef", message: "未知原始基准引用：" + bref });
      }
      if (defs.hasHitPolicies && node.hitPolicyId && !defs.hitPolicy(node.hitPolicyId)) {
        diag.push({ code: SupportCompiler._R("INVALID_REFERENCE"), definitionId: null,
          opId: null, field: "hitPolicyId", message: "未知命中策略：" + String(node.hitPolicyId) });
      }
    }
  },

  /* ============================================================
   * 内部：阶段 8~9 解释与用途保护
   * ============================================================ */

  _explainCrystalSkill(graph, crystalEntry, defs, conflictCrystals) {
    const crystalId = crystalEntry.crystalId || crystalEntry.id;
    const cd = defs.crystalDef(crystalId);
    const cs = (graph.contributions || []).filter(function (x) { return x.crystalId === crystalId; });
    const nodes = [];
    const before = {};
    const after = {};
    let benefit = false;
    let matched = false;
    for (const c of cs) {
      matched = true;
      if (c.benefit) benefit = true;
      /* 施放层统计贡献无节点（nodeId = null）→ 不进入 nodes 列表；键用 "castStats" 归类。 */
      if (c.nodeId != null && nodes.indexOf(c.nodeId) < 0) nodes.push(c.nodeId);
      const key = (c.nodeId == null ? "castStats" : c.nodeId) + "." + (c.field === "__node__" ? "derived" : c.field);
      before[key] = c.before;
      after[key] = c.after;
    }
    let status = "inactive";
    const reasonCodes = [];
    if (conflictCrystals && conflictCrystals[crystalId]) {
      status = "conflict";
      reasonCodes.push(SupportCompiler._R("MOTION_CONFLICT"));
    } else if (cd && !SupportCompiler._eligibilityOk(cd, graph)) {
      status = "inactive";
      reasonCodes.push(SupportCompiler._R("INACTIVE_OPERATION"));
    } else if (benefit) {
      status = "applied";
    } else if (matched) {
      status = "inactive";
      reasonCodes.push(SupportCompiler._R("NO_GAIN"));
    } else {
      status = "inactive";
      reasonCodes.push(SupportCompiler._R("NO_COMPATIBLE_NODE"));
    }
    return {
      crystalId: crystalId, skillId: graph.skillId, status: status,
      nodes: nodes, before: before, after: after, reasonCodes: reasonCodes,
    };
  },

  _checkPurpose(builds, skillIds, state, diag) {
    const crystals = Array.isArray(state.crystals) ? state.crystals : [];
    for (const c of crystals) {
      const cid = c.crystalId || c.id;
      let gain = false;
      for (const sid of skillIds) {
        const cs = (builds[sid].contributions || []).filter(function (x) { return x.crystalId === cid; });
        if (cs.some(function (x) { return x.benefit; })) { gain = true; break; }
      }
      if (!gain) {
        diag.push({ code: SupportCompiler._R("EXISTING_CRYSTAL_INACTIVE"), definitionId: cid,
          opId: null, field: null, message: "已装水晶对全部已有技能均无实际收益" });
      }
    }
  },

  _crystalHasGain(result, crystalId) {
    if (!result || !result.builds) return false;
    for (const sid of Object.keys(result.builds)) {
      const cs = result.builds[sid].contributions || [];
      if (cs.some(function (x) { return x.crystalId === crystalId && x.benefit; })) return true;
    }
    return false;
  },

  /* ============================================================
   * 内部：小工具
   * ============================================================ */

  /** 阶段开始处的只读节点视图（供本阶段选择器匹配，屏蔽同阶段内后续变更）。 */
  _view(node) {
    return {
      nodeId: node.nodeId, templateId: node.templateId, role: node.role,
      capabilities: (node.capabilities || []).slice(), tags: (node.tags || []).slice(),
    };
  },

  _cloneNode(n, lvSpec) {
    const node = {
      nodeId: n.nodeId,
      templateId: n.templateId,
      role: n.role || "primary",
      capabilities: (n.capabilities || []).slice(),
      tags: (n.tags || []).slice(),
      parameters: Object.assign({}, n.parameters || {}),
      damageBasis: {
        baseRef: (n.damageBasis && n.damageBasis.baseRef) || null,
        coefficient: (n.damageBasis && typeof n.damageBasis.coefficient === "number") ? n.damageBasis.coefficient : 1,
        inheritFactorKeys: ((n.damageBasis && n.damageBasis.inheritFactorKeys) || []).slice(),
      },
      hitPolicyId: n.hitPolicyId || null,
    };
    /* v2（接口冻结 v2 §4）：effect 为**节点自定义字段** → 随节点克隆透传；
     *   convertNode **不重置** effect（与重置形态参数区分），故无需在 convertNode 处特殊处理。 */
    if (n.effect) node.effect = Object.assign({}, n.effect);
    const override = lvSpec && lvSpec.nodeParameters && lvSpec.nodeParameters[node.nodeId];
    if (override) Object.assign(node.parameters, override);
    /* 等级行参数只并入主节点（22.4 #13）：levels[].parameters 语义 = 主生成器/施放层参数。
     * 多节点基础图（能量爆发 = 载体弹 + 命中爆炸）中，若把整行参数覆盖进派生节点，
     * 派生会被主弹参数污染（爆炸拿到 radius=8 / life=1.6）。派生节点专属等级参数走
     * lvSpec.nodeParameters[nodeId]（per-node 覆盖仍全节点可用）。 */
    if (lvSpec && lvSpec.parameters && (node.role || "primary") === "primary") {
      Object.assign(node.parameters, lvSpec.parameters);
    }
    return node;
  },

  _matchSelector(sel, node) {
    if (!sel) return true;
    if (sel.nodeId && sel.nodeId !== node.nodeId) return false;
    if (sel.templateId && sel.templateId !== node.templateId) return false;
    if (sel.role && sel.role !== node.role) return false;
    const caps = node.capabilities || [];
    if (sel.capabilitiesAll && !sel.capabilitiesAll.every(function (c) { return caps.indexOf(c) >= 0; })) return false;
    if (sel.capabilitiesAny && sel.capabilitiesAny.length && !sel.capabilitiesAny.some(function (c) { return caps.indexOf(c) >= 0; })) return false;
    const tags = node.tags || [];
    if (sel.tagsAll && !sel.tagsAll.every(function (t) { return tags.indexOf(t) >= 0; })) return false;
    if (sel.tagsAny && sel.tagsAny.length && !sel.tagsAny.some(function (t) { return tags.indexOf(t) >= 0; })) return false;
    return true;
  },

  _eligibilityOk(cd, graph) {
    const e = cd.eligibility;
    if (!e) return true;
    const pool = (e.read === "final") ? graph.capabilities.final : graph.capabilities.base;
    const caps = pool.caps || [];
    const tags = pool.tags || [];
    if (e.capabilitiesAll && !e.capabilitiesAll.every(function (c) { return caps.indexOf(c) >= 0; })) return false;
    if (e.capabilitiesAny && e.capabilitiesAny.length && !e.capabilitiesAny.some(function (c) { return caps.indexOf(c) >= 0; })) return false;
    if (e.tagsAll && !e.tagsAll.every(function (t) { return tags.indexOf(t) >= 0; })) return false;
    if (e.tagsAny && e.tagsAny.length && !e.tagsAny.some(function (t) { return tags.indexOf(t) >= 0; })) return false;
    return true;
  },

  _capPool(nodes) {
    const caps = [];
    const tags = [];
    for (const id of Object.keys(nodes)) {
      const node = nodes[id];
      for (const c of (node.capabilities || [])) if (caps.indexOf(c) < 0) caps.push(c);
      for (const t of (node.tags || [])) if (tags.indexOf(t) < 0) tags.push(t);
    }
    caps.sort(); tags.sort();
    return { caps: caps, tags: tags };
  },

  _hasCycle(ids, edges) {
    const state = {};
    const adj = {};
    for (const id of ids) { adj[id] = []; state[id] = 0; }
    for (const e of edges) if (adj[e.from] && adj[e.to]) adj[e.from].push(e.to);
    const dfs = function (u) {
      if (state[u] === 1) return true;
      if (state[u] === 2) return false;
      state[u] = 1;
      for (const v of adj[u]) if (dfs(v)) return true;
      state[u] = 2;
      return false;
    };
    for (const id of ids) if (dfs(id)) return true;
    return false;
  },

  _nodeDepths(ids, edges) {
    const indeg = {};
    const adj = {};
    for (const id of ids) { indeg[id] = 0; adj[id] = []; }
    for (const e of edges) if (adj[e.from] && indeg[e.to] != null) { adj[e.from].push(e.to); indeg[e.to]++; }
    const depth = {};
    const queue = [];
    for (const id of ids) if (indeg[id] === 0) { depth[id] = 0; queue.push(id); }
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      for (const v of adj[u]) {
        depth[v] = Math.max(depth[v] == null ? 0 : depth[v], depth[u] + 1);
        indeg[v]--;
        if (indeg[v] === 0) queue.push(v);
      }
    }
    return depth;
  },

  _referencesSettledResult(bref) {
    const s = String(bref).toLowerCase();
    return s.indexOf("final") >= 0 || s.indexOf("result") >= 0 || s.indexOf("settled") >= 0;
  },

  _isBenefit(merge, value) {
    if (typeof value !== "number" || !isFinite(value)) return false;
    if (merge === "add") return value > 0;
    if (merge === "multiply") return value > 1;
    if (merge === "max") return value > 0;
    if (merge === "exclusive") return true; /* 行为/资源改变 = 合法收益 */
    return false;
  },

  _fieldName(field) {
    if (!field) return null;
    let f = String(field);
    if (f.indexOf("parameters.") === 0) f = f.slice("parameters.".length);
    return f || null;
  },

  _num(v, d) {
    return (typeof v === "number" && isFinite(v)) ? v : d;
  },

  _byOpId(a, b) {
    const x = SupportCompiler._opOrderKey(a);
    const y = SupportCompiler._opOrderKey(b);
    return x < y ? -1 : (x > y ? 1 : 0);
  },

  /** 稳定排序键：operationId → crystalId → 节点（全序，杜绝并列导致的顺序歧义）。 */
  _opOrderKey(o) {
    if (!o) return "";
    const opId = (o.opId != null) ? o.opId : (o.op && o.op.id != null ? o.op.id : "");
    const cid = o.crystalId != null ? o.crystalId : "";
    const nid = o.nodeId != null ? o.nodeId : "";
    return String(opId) + "\u0001" + String(cid) + "\u0001" + String(nid);
  },

  _byCrystalId(a, b) {
    const x = String(a.crystalId || a.id || "");
    const y = String(b.crystalId || b.id || "");
    return x < y ? -1 : (x > y ? 1 : 0);
  },

  _stableStringify(obj) {
    const seen = [];
    const walk = function (o) {
      if (o === null || typeof o !== "object") return o;
      if (seen.indexOf(o) >= 0) return null;
      seen.push(o);
      if (Array.isArray(o)) return o.map(walk);
      const out = {};
      for (const k of Object.keys(o).sort()) out[k] = walk(o[k]);
      return out;
    };
    try { return JSON.stringify(walk(obj)); } catch (e) { return String(obj); }
  },

  _extend(base, patch) {
    const out = {};
    for (const k of Object.keys(base || {})) out[k] = base[k];
    for (const k of Object.keys(patch || {})) out[k] = patch[k];
    return out;
  },

  _deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const k of Object.keys(o)) SupportCompiler._deepFreeze(o[k]);
    }
    return o;
  },

  /** 原因码：优先取 SkillConfig 的冻结枚举，缺失时回退字面量（业务只判码，不判文案）。 */
  _R(name) {
    if (typeof SKILL_REASON !== "undefined" && SKILL_REASON && SKILL_REASON[name]) return SKILL_REASON[name];
    return name;
  },

  _fail(signature, diagnostics, explanations) {
    const codes = [];
    for (const d of (diagnostics || [])) {
      if (d && d.code && codes.indexOf(d.code) < 0) codes.push(d.code);
    }
    return {
      ok: false, builds: Object.freeze({}), explanations: explanations || [],
      diagnostics: diagnostics || [], signature: signature, reasonCodes: codes,
    };
  },
};
