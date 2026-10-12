/* ============================================================
 * skill-scheduler.js — SkillScheduler（能量水晶技能系统 · W3b 实现）
 * 职责：英雄状态 + 模拟时间 → 施放请求；快照创建；每技能独立冷却；索敌。
 * 边界（合同 §4）：**不直接结算伤害**（只产请求，结算交给 SkillRuntime/SkillDamage）。
 * 契约：G_docs/skill_system_interface_v1.md 第三节 / 第四节；合同 §11；v0.5 §2。
 *
 * 规则（v0.5 §2 / 合同 §11）：
 *   - 每技能独立冷却（hero.skillState.skills[skillId].cdLeft），两技能彼此不阻塞
 *   - 默认索敌 = 范围内最近有效敌人；距离相同按稳定目标 ID（m.id）决定
 *   - 无目标不消耗普通技能冷却；环绕类允许无目标（castPolicy.requiresTarget=false）
 *   - 两技能同时就绪 → 按稳定技能 ID 顺序执行
 *   - 冷却缩减下限 / 持续上限 / 索敌范围全部来自策略表，不硬编码
 *   - 死亡 / 失活 / 离局 → 停止施放并报告清理原因
 * ============================================================ */
"use strict";

const SkillScheduler = {
  /** 施放 ID 单调递增（本局内唯一；回收后不复用为存活去重键）。 */
  _castSeq: 0,

  /* ---------- 配置读取（全部来自 CFG.skillSystem，逻辑侧零硬编码） ---------- */

  /** 取 CFG.skillSystem 数据表（未加载时返回 null，静默降级）。 */
  _tables() {
    return (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  },
  /** 施放策略：优先策略表 castPolicies[id]，回落技能定义内联 castPolicy。 */
  _castPolicy(t, def) {
    const id = def && def.castPolicyId;
    if (id && t && t.castPolicies && t.castPolicies[id]) return t.castPolicies[id];
    return (def && def.castPolicy) || {};
  },
  /** 索敌策略：优先策略表 targetPolicies[id]，回落技能定义内联 targetPolicy。 */
  _targetPolicy(t, def) {
    const id = def && def.targetPolicyId;
    if (id && t && t.targetPolicies && t.targetPolicies[id]) return t.targetPolicies[id];
    return (def && def.targetPolicy) || {};
  },
  /** 取技能某等级的完整参数行（levels[level-1]，越界钳制）。 */
  _levelRow(def, level) {
    const ls = def && def.levels;
    if (!Array.isArray(ls) || !ls.length) return null;
    let i = (level || 1) - 1;
    if (i < 0) i = 0;
    if (i > ls.length - 1) i = ls.length - 1;
    return ls[i] || null;
  },

  /** 冷却纯函数（供测试）：冷却 = 基础冷却 × 冷却倍率，倍率不小于策略下限（冷却缩减下限）。
   *  字段名：配置真源（CFG.skillSystem.skillDefs[*].levels[]）用 `cooldown`；
   *          兼容运行时/旧短名 `cd`（HeroSkillState 亦用 cd 表示基础冷却值）。 */
  cooldownFor(def, level, stats, policy) {
    if (!def) return 0;
    const readCd = function (o) {
      if (!o) return null;
      if (o.cooldown != null) return o.cooldown;
      if (o.cd != null) return o.cd;
      return null;
    };
    const row = SkillScheduler._levelRow(def, level);
    const rowCd = readCd(row);
    const defCd = readCd(def);
    const baseCd = (rowCd != null) ? rowCd : (defCd != null ? defCd : 0);
    const cp = policy || {};
    const floor = (cp.cdMulFloor != null) ? cp.cdMulFloor : 0;
    let mul = (stats && typeof stats.cdMul === "number") ? stats.cdMul : 1;
    if (!(mul > floor)) mul = floor;                 // 冷却缩短不得低于下限
    const cd = baseCd * mul;
    return cd > 0 ? cd : 0;
  },

  /* ---------- 策略字段名对齐（22.3 复核修复）----------
   * 血泪坑：调度器曾读 `tp.range` / `cp.allowNoTarget`，而配置真源（且被
   * SkillConfig 校验器强制的字段名）是 `targetPolicies[].maxRange` 与
   * `castPolicies[].requiresTarget` —— 两边永不相等 → 索敌范围退化为 Infinity（全图锁敌）、
   * 环绕类「无目标可施放」永久失效。此处按**配置真源优先、旧短名兼容**读取。 */

  /** 索敌范围（世界单位）：真源 maxRange；兼容旧短名 range；缺失 = Infinity（不限制）。 */
  rangeOf(tp) {
    if (!tp) return Infinity;
    if (typeof tp.maxRange === "number" && isFinite(tp.maxRange)) return tp.maxRange;
    if (typeof tp.range === "number" && isFinite(tp.range)) return tp.range;
    return Infinity;
  },
  /** 无目标是否可施放：真源 requiresTarget（false = 允许无目标）；兼容旧短名 allowNoTarget。 */
  allowNoTargetOf(cp) {
    if (!cp) return false;
    if (typeof cp.requiresTarget === "boolean") return !cp.requiresTarget;
    return cp.allowNoTarget === true;
  },

  /** 有效施放间隔（供测试）：环绕类 = max(冷却, 持续时间)；持续受 durationCap 上限约束。
   *  持续时间来源（22.4 #12 单源）：castPolicy.duration 显式配置优先，
   *  否则回落 CFG.skillSystem.defaults.orbit.duration（与运行时环绕寿命同源，改表一处生效）。 */
  intervalFor(def, level, stats, policy) {
    const cp = policy || {};
    let cd = SkillScheduler.cooldownFor(def, level, stats, cp);
    if (SkillScheduler.allowNoTargetOf(cp)) {
      let dur = null;
      if (cp.duration != null) dur = cp.duration;
      else {
        const t = SkillScheduler._tables();
        const od = (t && t.defaults && t.defaults.orbit) ? t.defaults.orbit.duration : null;
        if (od != null) dur = od;
      }
      if (dur == null) dur = 0;
      if (cp.durationCap != null && dur > cp.durationCap) dur = cp.durationCap;   // 持续上限
      if (dur > cd) cd = dur;
    }
    return cd;
  },

  /** 英雄进攻属性（快照来源）：优先 hero.stats，其次既有 computeStats（守卫），最后空表。 */
  _statsOf(hero) {
    if (hero && hero.stats && typeof hero.stats === "object") return hero.stats;
    if (typeof computeStats === "function") {
      try { return computeStats(); } catch (e) { return {}; }
    }
    return {};
  },

  /** 死亡 / 失活 / 离局判定（合同 §11：停止施放并按清理原因回收）。 */
  _inactive(hero) {
    if (!hero) return "DEAD";
    if (hero.alive === false || hero.dead === true) return "DEAD";
    if (hero.left === true) return "LEFT";
    if (hero.active === false) return "INACTIVE";
    if (typeof G !== "undefined" && G && hero === G.player && G.run &&
        typeof G.run.hp === "number" && G.run.hp <= 0) return "DEAD";
    return null;
  },

  /** 索敌：范围内最近有效敌人；距离相同按稳定目标 ID（m.id）决定。
   *  ⚠️ 故意不用既有全局 nearestMonster()：它忽略索敌范围、且不按 id 平距决胜，
   *     无法满足「索敌范围来自策略表 / 同距按稳定 ID」两条铁律 → 这里自实现（遍历 world.monsters）。 */
  _acquireTarget(world, hero, range, tp) {
    if (!world || !Array.isArray(world.monsters)) return null;
    const hx = hero.x, hy = hero.y;
    let best = null, bd = Infinity;
    for (const m of world.monsters) {
      if (!m || m.dead) continue;
      if (tp && tp.excludeBoss && m.d && m.d.type === "boss") continue;
      const dx = m.x - hx, dy = m.y - hy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > range) continue;
      // 更近者胜；距离相同 → 稳定目标 ID 更小者胜（保证确定性）
      if (d < bd || (d === bd && best && m.id < best.id)) { bd = d; best = m; }
    }
    return best;
  },

  /** 每帧推进：{ requests: [ { skillId, target, castId } ], stopped, reason }。
   *  stopped=true 表示英雄已死亡/失活/离局 → 调用方按清理原因回收其效果。 */
  tick(world, hero, dt) {
    const out = { requests: [], stopped: false, reason: null };
    const t = SkillScheduler._tables();
    if (!t || !t.enabled) return out;

    const inactive = SkillScheduler._inactive(hero);
    if (inactive) { out.stopped = true; out.reason = inactive; return out; }

    const hs = hero && hero.skillState;
    if (!hs || !hs.skills) return out;

    const stats = SkillScheduler._statsOf(hero);
    const ids = Object.keys(hs.skills).sort();          // 两技能同时就绪 → 按稳定技能 ID 顺序
    for (const sid of ids) {
      const st = hs.skills[sid];
      if (!st) continue;
      const def = (t.skillDefs && t.skillDefs[sid]) || null;
      if (!def) continue;

      // 每技能独立冷却推进（互不阻塞）
      st.cdLeft = (typeof st.cdLeft === "number" ? st.cdLeft : 0) - dt;
      if (st.cdLeft > 0) continue;
      st.cdLeft = 0;

      const cp0 = SkillScheduler._castPolicy(t, def);
      /* 施放策略覆盖（22.4 #12）：编译产物（builds[sid].castPolicyId，来自环绕等
       * 形态转换操作声明）优先于技能定义的 castPolicyId —— 环绕类无目标可施放。 */
      const b = hs.builds && hs.builds[sid];
      const cp = (b && b.castPolicyId && t.castPolicies && t.castPolicies[b.castPolicyId])
        ? t.castPolicies[b.castPolicyId] : cp0;
      const tp = SkillScheduler._targetPolicy(t, def);
      const range = SkillScheduler.rangeOf(tp);                          // 真源 maxRange
      const allowNoTarget = SkillScheduler.allowNoTargetOf(cp);          // 真源 requiresTarget

      const target = SkillScheduler._acquireTarget(world, hero, range, tp);
      if (!target && !allowNoTarget) continue;          // 无目标 → 保持就绪，不消耗冷却

      const castId = ++SkillScheduler._castSeq;
      st.cdLeft = SkillScheduler.intervalFor(def, st.level, stats, cp);   // 环绕 = max(冷却, 持续)
      out.requests.push({ skillId: sid, target: target || null, castId });
    }
    return out;
  },

  /** 创建只读快照（一次施放锁定构建 / 进攻属性 / 水晶等级 / 派生配置）。
   *  冻结：snapshot 本体 Object.freeze；stats / crystals / derivedCfg 浅冻结。 */
  createCastSnapshot(hero, build, stats, castId) {
    const snapStats = {};
    if (stats && typeof stats === "object") {
      for (const k in stats) snapStats[k] = stats[k];
    }
    const crystals = [];
    if (build && Array.isArray(build.crystals)) {
      for (const c of build.crystals) {
        if (c) crystals.push(Object.freeze({ crystalId: c.crystalId, level: c.level }));
      }
    }
    const derived = {};
    if (build && build.derivedCfg && typeof build.derivedCfg === "object") {
      for (const k in build.derivedCfg) derived[k] = build.derivedCfg[k];
    }
    const snap = {
      castId: (castId != null) ? castId : null,
      ownerId: (hero && hero.id != null) ? hero.id : null,
      skillId: (build && build.skillId != null) ? build.skillId : null,
      level: (build && build.level != null) ? build.level
        : ((hero && hero.skillState && hero.skillState.skills) ? 1 : 1),
      stats: Object.freeze(snapStats),
      crystals: Object.freeze(crystals),
      derivedCfg: Object.freeze(derived),
      graph: (build && build.graph) || null,            // 编译产物：引用，不冻结（编译器所有）
      simTime: (build && build.simTime != null) ? build.simTime : 0,
    };
    return Object.freeze(snap);
  },
};

/** 别名：接口文档写作 createSnapshot（与 createCastSnapshot 等价）。 */
SkillScheduler.createSnapshot = function (hero, build, stats, castId) {
  return SkillScheduler.createCastSnapshot(hero, build, stats, castId);
};
