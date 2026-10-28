/* ============================================================
 * skill-reward.js — SkillRewardService（能量水晶技能系统 · W4a 开发）
 * 职责：实例 + 池 + 随机源 → 固定候选事务；提交只生效一次（防重复点击）。
 * 边界（合同 §4）：**不修改已飞出的效果**。
 * 契约：G_docs/skill_system_interface_v1.md 第三节 / 第四节；合同 §12；v0.5 §8。
 * ------------------------------------------------------------------
 * 冻结流程（v0.5 §8）：合并获取池 → 按 ID 去重 → 新装/升级分类 → 完整组合模拟
 *                        → 权重抽取 → 属性兜底 → （等待）确认并原子提交。
 * 随机源必须可注入：build(state, source, rng)。rng 可为函数 () => [0,1)，
 *   或对象 { random(): number, state?(): any }；randomState 存入事务以便复现。
 * 组合模拟函数优先级：SkillReward.configure({previewFn}) > rewardPolicies.previewFn
 *    > SupportCompiler.preview（存在则用）> 无（视为合法，仅做结构校验）。
 * ============================================================ */
"use strict";

/* 顶层模块对象（顶层 const 共享全局词法环境，不进 window）。 */
const SkillReward = {
  /* ---- 可注入钩子（属性存储避免与其它文件顶层变量重名）---- */
  _previewFn: null,   // 显式注入的组合模拟函数（优先级最高，供并行开发 / 测试对接桩）
  _seq: 0,            // rewardId 递增序号（本进程内稳定唯一）

  /** 注入组合模拟函数（可选）与策略覆盖。previewFn(state, change) -> {legal,nextGroup,result,reasonCodes} */
  configure(opts) {
    if (opts && typeof opts.previewFn === "function") this._previewFn = opts.previewFn;
    if (opts && opts.previewFn === null) this._previewFn = null;
    return this;
  },
  /** 单独注入组合模拟函数（便于测试与 W2 未就绪时对接桩）。 */
  setPreview(fn) { this._previewFn = (typeof fn === "function") ? fn : null; return this; },

  /* ---- 内部小工具（惰性读取，避免无头环境缺文件时抛错）---- */
  _reason() { return (typeof SKILL_REASON !== "undefined") ? SKILL_REASON : {}; },
  _tables() { return (typeof CFG !== "undefined" && CFG.skillSystem) ? CFG.skillSystem : null; },
  _policies() { const t = this._tables(); return (t && t.rewardPolicies) || {}; },
  _crystalDef(id) { const t = this._tables(); return (t && t.crystalDefs && t.crystalDefs[id]) || null; },
  _skillDef(id) { const t = this._tables(); return (t && t.skillDefs && t.skillDefs[id]) || null; },

  /* 取随机数（可注入）。 */
  _nextRandom(rng) {
    if (rng) {
      if (typeof rng === "function") return rng();
      if (typeof rng.random === "function") return rng.random();
    }
    if (typeof U !== "undefined" && U._random) return U._random();
    return Math.random();
  },
  /* 捕获随机状态（供事务复现）；rng 无 state() 时返回 null。 */
  _captureRandomState(rng) {
    if (rng && typeof rng.state === "function") return rng.state();
    return null;
  },
  /* 组合模拟函数解析（见文件头优先级）。 */
  _resolvedPreview() {
    if (typeof this._previewFn === "function") return this._previewFn;
    const pol = this._policies();
    if (pol && typeof pol.previewFn === "function") return pol.previewFn;
    if (typeof SupportCompiler !== "undefined" && SupportCompiler
        && typeof SupportCompiler.preview === "function") return SupportCompiler.preview.bind(SupportCompiler);
    return null;
  },
  /* 完整组合模拟；无模拟器时退化为「结构校验通过即合法」。 */
  _preview(state, change, fallbackNext) {
    const fn = this._resolvedPreview();
    if (!fn) return { legal: true, nextGroup: fallbackNext || state, result: null, reasonCodes: [] };
    let res;
    try { res = fn(state, change); } catch (e) { return { legal: false, nextGroup: state, result: null, reasonCodes: [this._reason().INVALID_REFERENCE] }; }
    if (!res || typeof res !== "object") return { legal: false, nextGroup: state, result: null, reasonCodes: [this._reason().INVALID_REFERENCE] };
    return res;
  },

  /* ---- 状态克隆与结构读取 ---- */
  _cloneState(state) {
    return {
      heroId: state.heroId || null,
      slotCount: state.slotCount,
      skills: Object.assign({}, state.skills || {}),
      crystals: (state.crystals || []).map(c => Object.assign({}, c)),
      groupVersion: state.groupVersion || 0,
      attrRewards: (state.attrRewards || []).slice(),
      attrGain: Object.assign({}, state.attrGain || {}),
      rewardTransactions: Object.assign({}, state.rewardTransactions || {}),
    };
  },
  _slotCount(state) {
    if (state && state.slotCount != null) return state.slotCount;
    const t = this._tables();
    if (t && t.slotCount != null) return t.slotCount;
    return 4;
  },
  _slotUsed(state) { return (state.crystals || []).filter(c => c && c.crystalId).length; },
  _installed(state, crystalId) { return (state.crystals || []).find(c => c && c.crystalId === crystalId) || null; },
  _firstFreeSlot(state) {
    const sc = this._slotCount(state);
    const used = {};
    (state.crystals || []).forEach(c => { if (c) used[c.slot] = true; });
    for (let i = 0; i < sc; i++) if (!used[i]) return i;
    return sc;
  },
  _maxLevel(crystalDef) {
    return (crystalDef && Array.isArray(crystalDef.levels) && crystalDef.levels.length) || 1;
  },

  /* ---- 获取池合并（同 ID 默认取 max，不自动相加；策略可配置）---- */
  _poolsForSource(source) {
    const t = this._tables(); const pools = t && t.rewardPools;
    if (!pools) return [];
    const out = [];
    for (const pid in pools) {
      const p = pools[pid]; if (!p) continue;
      const srcs = p.sources || p.source;
      if (!srcs) { out.push(p); continue; }
      const arr = Array.isArray(srcs) ? srcs : [srcs];
      if (arr.indexOf(source) >= 0) out.push(p);
    }
    return out;
  },
  _mergePoolWeights(source) {
    const pools = this._poolsForSource(source);
    const merge = this._policies().weightMerge || "max";
    const acc = {};
    for (const p of pools) {
      const w = p.weights || {};
      for (const cid in w) {
        const v = Number(w[cid]) || 0;
        if (merge === "sum") acc[cid] = (acc[cid] || 0) + v;
        else acc[cid] = Math.max(acc[cid] || 0, v);
      }
    }
    return acc;
  },
  /* 品质控制「定位与出现权重」，不单独再乘伤害（v0.5 §8）。 */
  _qualityAppearWeight(crystalDef) {
    const t = this._tables();
    if (!t || !Array.isArray(t.qualityDefs) || !crystalDef) return 1;
    const q = t.qualityDefs.find(x => x && x.id === crystalDef.qualityId);
    if (!q) return 1;
    if (q.appearWeight != null) return q.appearWeight;
    if (q.weight != null) return q.weight;
    return 1;
  },

  /* ---- 分类：新装 / 升级 / 排除（满槽未装、满级）---- */
  _classifyCandidate(state, crystalId, crystalDef) {
    const R = this._reason();
    const inst = this._installed(state, crystalId);
    const maxLv = this._maxLevel(crystalDef);
    if (inst) {
      const from = inst.level || 1;
      if (from >= maxLv) return { usable: false, reason: R.MAX_LEVEL };       // 满级移出候选
      return { usable: true, option: { kind: "upgrade", crystalId: crystalId, fromLevel: from, toLevel: from + 1 } };
    }
    if (this._slotUsed(state) >= this._slotCount(state)) return { usable: false, reason: R.SLOTS_FULL };   // 满槽：非法新装不占位
    return { usable: true, option: { kind: "install", crystalId: crystalId, fromLevel: 0, toLevel: 1 } };
  },

  /* ---- 属性兜底池（配置驱动）---- */
  _attrPool(policy) {
    const pol = policy || this._policies();
    let list = pol.attrFallback || pol.statPacks || null;
    if (!list) return [];
    if (!Array.isArray(list)) list = [list];
    return list.filter(a => a && (a.attr || a.stat));
  },
  _finalizeAttr(a, idx) {
    const attr = a.attr || a.stat;
    return { optionId: "A_" + attr + (idx != null ? "_" + idx : ""), kind: "attr", crystalId: null,
      attr: attr, value: (a.value != null) ? a.value : 0, nameKey: a.nameKey || null, attrKey: a.key || null };
  },
  _finalizeOption(opt) {
    const id = (opt.kind === "upgrade" ? "U_" : "I_") + opt.crystalId;
    return Object.assign({ optionId: id }, opt);
  },

  /* ---- 权重抽取（不放回，尊重权重）---- */
  _weightedDraw(list, count, rng) {
    const pool = list.slice();
    const out = [];
    while (out.length < count && pool.length) {
      let total = 0;
      for (const it of pool) total += Math.max(0, it.weight || 0);
      let picked = -1;
      if (total <= 0) {
        picked = 0;
      } else {
        let r = this._nextRandom(rng) * total;
        for (let i = 0; i < pool.length; i++) { r -= Math.max(0, pool[i].weight || 0); if (r <= 0) { picked = i; break; } }
        if (picked < 0) picked = pool.length - 1;
      }
      out.push(pool.splice(picked, 1)[0]);
    }
    return out;
  },

  /* ---- 纯变更应用（不改 groupVersion；commit 时单独 +1）---- */
  _applyOptionInPlace(s, option) {
    if (!option) return s;
    if (option.kind === "install") {
      const slot = this._firstFreeSlot(s);
      s.crystals.push({ crystalId: option.crystalId, level: option.toLevel || 1, slot: slot });
      // 按 crystalId 规范排序（槽位记录保留，排列不改变组合 → 合同 §17）
      s.crystals.sort((a, b) => a.crystalId < b.crystalId ? -1 : (a.crystalId > b.crystalId ? 1 : 0));
    } else if (option.kind === "upgrade") {
      const c = (s.crystals || []).find(x => x.crystalId === option.crystalId);
      if (c) c.level = option.toLevel;
    } else if (option.kind === "attr") {
      if (!s.attrRewards) s.attrRewards = [];
      s.attrRewards.push({ attr: option.attr, value: option.value, nameKey: option.nameKey || null });
      if (!s.attrGain) s.attrGain = {};
      s.attrGain[option.attr] = (s.attrGain[option.attr] || 0) + (option.value || 0);
    }
    return s;
  },
  _applyOption(state, option) {
    const s = this._cloneState(state);
    return this._applyOptionInPlace(s, option);
  },
  /* 稀有技能试装（用于雕像候选组合模拟）。 */
  _applySkillInstall(state, skillId) {
    const s = this._cloneState(state);
    /* 新装技能等级 = 本英雄现有技能等级（= 武器等级，合同 §101「沿用项目实际路径」）。
     * 与 SupportCompiler.skillLevelOf（试装路径）/ SkillPlaytest._installRareSkill（落地路径）
     * 必须取同一值，否则候选合法性判定与实际落地结果不一致。 */
    const lv = (typeof SupportCompiler !== "undefined" && SupportCompiler
      && typeof SupportCompiler.skillLevelOf === "function")
      ? SupportCompiler.skillLevelOf(s) : 1;
    s.skills[skillId] = { id: skillId, level: lv, cd: 0, cdLeft: 0 };
    return s;
  },

  /* ---- 事务登记与替代流程标记 ---- */
  _nextRewardId(heroId, source) {
    this._seq = (this._seq || 0) + 1;
    return "RW_" + (heroId || "H") + "_" + (source || "src") + "_" + this._seq;
  },
  _markReplacement(txn, reasonCodes) {
    txn.replacement = { needed: true, reasonCodes: (reasonCodes || []).slice(),
      noteKey: "skill.reward.staleReplacement", note: "状态已变化，候选失效 → 保留本事务记录，需重新生成替代候选（不改动原已选收益）" };
    return txn.replacement;
  },

  /* ============================================================
   * build(state, source, rng) -> RewardTransaction（冻结候选）
   * ============================================================ */
  build(state, source, rng) {
    const R = this._reason();
    const src = source || "levelup";
    if (!state) {
      return { rewardId: null, heroId: null, source: src, groupVersion: 0, randomState: null,
        options: [], committed: false, status: "OPEN", reason: R.INVALID_REFERENCE, rejected: [] };
    }
    const heroId = state.heroId || null;
    const groupVersion = state.groupVersion || 0;
    const randomState = this._captureRandomState(rng);
    const policy = this._policies();
    const optionCount = (policy.optionCount != null) ? policy.optionCount : 3;

    /* ① 合并获取池 + 按 ID 去重（对象键天然去重）② 分类 ③ 完整组合模拟 */
    const merged = this._mergePoolWeights(src);
    const candidates = [];   // 合法水晶候选（含权重）
    const rejected = [];     // 被排除原因（供解释 / 诊断）
    for (const cid of Object.keys(merged)) {
      const cd = this._crystalDef(cid);
      if (!cd) { rejected.push({ crystalId: cid, reason: R.INVALID_REFERENCE }); continue; }
      const cls = this._classifyCandidate(state, cid, cd);
      if (!cls.usable) { rejected.push({ crystalId: cid, reason: cls.reason }); continue; }
      const next = this._applyOption(state, cls.option);
      const pv = this._preview(state, cls.option, next);
      if (!pv.legal) {
        rejected.push({ crystalId: cid, reason: (pv.reasonCodes && pv.reasonCodes[0]) || R.NO_GAIN, reasonCodes: pv.reasonCodes || [] });
        continue;
      }
      candidates.push({ option: cls.option, weight: (merged[cid] || 0) * this._qualityAppearWeight(cd) });
    }

    /* ④ 权重抽取（不放回，最多 optionCount 项） */
    const drawn = this._weightedDraw(candidates, optionCount, rng);
    const options = drawn.map(it => this._finalizeOption(it.option));

    /* ⑤ 属性兜底：不足选项数则补合法属性奖励；仍不足则显示实际数量（不生造废选项） */
    const attrPool = this._attrPool(policy);
    const attrCap = (policy.attrFallbackCount != null) ? policy.attrFallbackCount : attrPool.length;
    let ai = 0;
    while (options.length < optionCount && ai < attrPool.length && ai < attrCap) {
      options.push(this._finalizeAttr(attrPool[ai], ai)); ai++;
    }

    const crystalOptionCount = options.filter(o => o.kind !== "attr").length;
    let reason = null;
    if (candidates.length === 0) reason = R.NO_CANDIDATE;    // 无合法水晶 → 走属性兜底

    const txn = {
      rewardId: this._nextRewardId(heroId, src),
      heroId: heroId, source: src, groupVersion: groupVersion, randomState: randomState,
      options: options, committed: false, status: "OPEN", reason: reason,
      rejected: rejected, legalCount: candidates.length, attrCount: options.length - crystalOptionCount,
      displayCount: options.length,
    };
    if (!state.rewardTransactions) state.rewardTransactions = {};
    state.rewardTransactions[txn.rewardId] = txn;
    return txn;
  },

  /* ============================================================
   * commit(state, rewardId, optionId) -> { committed, nextState, reason }
   * 单线程防重复点击：先标记 PENDING → 原子更新 → 返回结果。
   * ============================================================ */
  commit(state, rewardId, optionId) {
    const R = this._reason();
    if (!state) return { committed: false, nextState: state, reason: R.INVALID_REFERENCE };
    const txns = state.rewardTransactions || {};
    const txn = txns[rewardId];
    if (!txn) return { committed: false, nextState: state, reason: R.INVALID_REFERENCE };
    if (txn.committed || txn.status === "COMMITTED") return { committed: false, nextState: state, reason: R.ALREADY_COMMITTED };
    if (txn.status === "PENDING") return { committed: false, nextState: state, reason: R.PENDING };

    txn.status = "PENDING";   // 处理中闸门（单线程也防重复点击）
    const fail = (reason) => { txn.status = "OPEN"; return { committed: false, nextState: state, reason: reason }; };

    /* 校验：组版本匹配（状态已变化 → 事务失效，保留记录 + 替代流程，不偷偷改收益） */
    if ((state.groupVersion || 0) !== (txn.groupVersion || 0)) {
      txn.status = "OPEN";
      this._markReplacement(txn, [R.ALREADY_COMMITTED]);
      return { committed: false, nextState: state, reason: R.ALREADY_COMMITTED, replacement: txn.replacement };
    }
    /* 校验：选项有效 */
    const option = (txn.options || []).find(o => o.optionId === optionId);
    if (!option) return fail(R.INVALID_REFERENCE);

    /* 校验：完整新组合仍合法（attr 无结构影响，跳过结构模拟） */
    if (option.kind !== "attr") {
      const probe = this._applyOption(state, option);
      const pv = this._preview(state, option, probe);
      if (!pv.legal) return fail((pv.reasonCodes && pv.reasonCodes[0]) || R.NO_GAIN);
    }

    /* 原子提交：克隆 → 应用 → 递增组版本 → 标记事务（失败不消耗奖励、不重复随机） */
    const nextState = this._cloneState(state);
    this._applyOptionInPlace(nextState, option);
    nextState.groupVersion = (state.groupVersion || 0) + 1;
    const ntxn = nextState.rewardTransactions[rewardId];
    ntxn.committed = true; ntxn.status = "COMMITTED"; ntxn.committedOptionId = optionId;
    return { committed: true, nextState: nextState, reason: null, option: option };
  },

  /* ============================================================
   * rollStatueGrant(state, policy, rng) -> 稀有技能授予结果
   * 候选加入当前组试编译，与已装形态冲突则过滤；候选不足 → 其他合法奖励兜底并给原因。
   * 概率/交互条件/选项数量/重复雕像处理全部来自 rewardPolicies。
   * ============================================================ */
  rollStatueGrant(state, policy, rng) {
    const R = this._reason();
    const pol = policy || this._policies();
    const result = { granted: false, kind: "none", skillId: null, candidates: [],
      options: [], reasonCodes: [], reason: null };
    if (!state) { result.reasonCodes.push(R.INVALID_REFERENCE); result.reason = R.INVALID_REFERENCE; return result; }

    /* ① 概率（来自 rewardPolicies）*/
    const prob = (pol && pol.statueProb != null) ? pol.statueProb : 0;
    if (this._nextRandom(rng) >= prob) {
      result.reasonCodes.push(R.NO_CANDIDATE); result.reason = R.NO_CANDIDATE; return result;
    }

    /* ② 交互条件：稀有技能上限（来自 rewardPolicies / CFG，不硬编码在场景）*/
    const owned = state.skills || {};
    let maxSkills = (pol && pol.maxSkillsPerHero);
    if (maxSkills == null) { const t = this._tables(); maxSkills = (t && t.maxSkillsPerHero) || 2; }
    let cands = ((pol && (pol.rareSkillPool || pol.rareSkills)) || []).filter(id => !owned[id]);
    const duplicateHandling = (pol && pol.duplicateStatueHandling) || null;
    if (Object.keys(owned).length >= maxSkills) {
      cands = [];   // 重复雕像 / 已满技能位 → 走其他奖励兜底
      result.reasonCodes.push(R.NO_CANDIDATE);
    }

    /* ③ 试编译过滤：与已装形态冲突（MOTION_CONFLICT 等）则过滤 */
    const filtered = [];
    for (const sid of cands) {
      const change = { kind: "installSkill", skillId: sid };
      const next = this._applySkillInstall(state, sid);
      const pv = this._preview(state, change, next);
      if (pv.legal) filtered.push(sid);
      else { const rc = pv.reasonCodes || []; for (const c of rc) result.reasonCodes.push(c); }
    }

    /* ④ 候选可用 → 授予稀有技能 */
    if (filtered.length) {
      let total = 0; for (const sid of filtered) total += this._skillWeight(pol, sid);
      let picked = filtered[filtered.length - 1];
      if (total > 0) {
        let r = this._nextRandom(rng) * total;
        for (const sid of filtered) { r -= this._skillWeight(pol, sid); if (r <= 0) { picked = sid; break; } }
      }
      result.granted = true; result.kind = "skill"; result.skillId = picked;
      result.candidates = filtered.slice();
      return result;
    }

    /* ⑤ 候选不足 → 其他合法奖励兜底并给原因 */
    const attrPool = this._attrPool(pol);
    if (attrPool.length) {
      result.kind = "fallback"; result.options = [this._finalizeAttr(attrPool[0], 0)];
      result.reason = R.NO_CANDIDATE; result.reasonCodes.push(R.NO_CANDIDATE);
      if (duplicateHandling) result.duplicateHandling = duplicateHandling;
      return result;
    }
    result.reason = R.NO_CANDIDATE; result.reasonCodes.push(R.NO_CANDIDATE);
    return result;
  },
  _skillWeight(pol, skillId) {
    if (pol && pol.skillWeights && pol.skillWeights[skillId] != null) return pol.skillWeights[skillId];
    return 1;
  },
};

/* ---- 顶层函数（接口文档第三节：每个函数只在一个文件里定义）---- */
/** 生成固定候选事务（合同 §7 buildSkillRewards）。 */
function buildSkillRewards(state, source, rng) { return SkillReward.build(state, source, rng); }
/** 原子提交奖励（合同 §7 commitSkillReward）。 */
function commitSkillReward(state, rewardId, optionId) { return SkillReward.commit(state, rewardId, optionId); }
