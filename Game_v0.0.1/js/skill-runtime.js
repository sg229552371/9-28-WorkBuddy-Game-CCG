/* ============================================================
 * skill-runtime.js — SkillRuntime（EffectRuntime · W3b 实现）
 * 职责：快照 + 世界 → 效果实例与事件；四类节点（flightProjectile / orbitContact /
 *       instantArea / persistentArea）的生成与单步主序；新旧路径分流判定。
 * 边界（合同 §4）：**不自行识别水晶 ID**（一切来自编译产物 snapshot.graph）。
 * 契约：G_docs/skill_system_interface_v1.md 第三节 / 第四节 / 第六节 / 第七节；合同 §9/§11/§15。
 *
 * 单步九段（合同 §9 冻结）：到期处理 → 自动施放请求 → 实体生成 → 运动与碰撞 →
 *   合法伤害 → 首次命中事件 → 贯穿/结束 → 消失事件 → 事件队列派生 → 回收。
 *   ⚠️ 新派生本步创建，首次运动/碰撞从下一模拟步开始（bornStep 守卫）。
 * ============================================================ */
"use strict";

/* 四类模板类别 → CFG 默认值键（结构性映射，非玩法数值）。 */
const _SR_CAT_DEFAULT_KEY = {
  flightProjectile: "projectile",
  orbitContact: "orbit",
  instantArea: "instantArea",
  persistentArea: "persistentArea",
};

const SkillRuntime = {
  /** 效果实例 ID 单调递增（本局唯一；回收后不复用为存活去重键）。 */
  _effectSeq: 0,
  /** operationId → 操作定义 的惰性缓存（C 路行为字段兜底；配置对象变更时重建）。 */
  _opCache: null,
  _opCacheSrc: null,

  /* ================= 配置 / 容器基础 ================= */

  _t() {
    return (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
  },
  _reason(name) {
    if (typeof SKILL_REASON !== "undefined" && SKILL_REASON && SKILL_REASON[name]) return SKILL_REASON[name];
    return name;
  },
  /** 内部结束原因 → 事件路由器枚举（SkillEvents.EndReasons；未加载时回落内部字符串）。 */
  _endReason(code) {
    if (typeof SkillEvents !== "undefined" && SkillEvents && typeof SkillEvents.EndReasons === "function") {
      const E = SkillEvents.EndReasons() || {};
      if (code === "life" && E.LIFETIME) return E.LIFETIME;
      if (code === "hit" && E.NATURAL_HIT) return E.NATURAL_HIT;
      if (code === "distance" && E.DISTANCE) return E.DISTANCE;
    }
    return code;
  },
  _budgets() {
    const t = SkillRuntime._t();
    return (t && t.budgets) ? t.budgets : {};
  },
  _effects(world) {
    if (!world.__skillEffects) world.__skillEffects = [];
    return world.__skillEffects;
  },
  _snapshots(world) {
    if (!world.__skillSnapshots) world.__skillSnapshots = {};
    return world.__skillSnapshots;
  },
  _eventQueue(world) {
    if (!world.__skillEvents) world.__skillEvents = [];
    return world.__skillEvents;
  },
  _orbitGate(world) {
    if (!world.__skillOrbitHit) world.__skillOrbitHit = {};
    return world.__skillOrbitHit;
  },
  /** 每施放一份命中额度状态（对接 SkillDamage.newHitState / beginCast / endCast）。 */
  _hitStates(world) {
    if (!world.__skillHitState) world.__skillHitState = {};
    return world.__skillHitState;
  },
  _castCounts(world) {
    if (!world.__skillCastCount) world.__skillCastCount = {};
    return world.__skillCastCount;
  },
  _castCount(world, castId) {
    const m = SkillRuntime._castCounts(world);
    const v = m[castId == null ? "null" : castId];
    return typeof v === "number" ? v : 0;
  },
  _bumpCastCount(world, castId, n) {
    const m = SkillRuntime._castCounts(world);
    const k = castId == null ? "null" : castId;
    m[k] = (typeof m[k] === "number" ? m[k] : 0) + n;
  },
  _advanceStep(world) {
    world.__skillStep = (world.__skillStep || 0) + 1;
    return world.__skillStep;
  },
  _simTime(world, dt) {
    world.__skillSimTime = (world.__skillSimTime || 0) + dt;
    return world.__skillSimTime;
  },

  /** 本世界的英雄集合（玩家 + 存活队友 + 测试注入 world.__skillHeroes）。 */
  _heroesOf(world) {
    const out = [];
    const seen = {};
    const add = (h) => {
      if (!h) return;
      const key = (h.id != null) ? ("id:" + h.id) : h;
      if (seen[key]) return;
      seen[key] = true;
      out.push(h);
    };
    if (typeof G !== "undefined" && G) {
      add(G.player);
      if (G.run && Array.isArray(G.run.companions)) {
        for (const c of G.run.companions) if (c && c.alive !== false) add(c);
      }
    }
    if (world && Array.isArray(world.__skillHeroes)) for (const h of world.__skillHeroes) add(h);
    return out;
  },
  _heroOwner(world, ownerId) {
    if (ownerId == null) return null;
    for (const h of SkillRuntime._heroesOf(world)) if (h && h.id === ownerId) return h;
    return null;
  },
  _ownedEffects(effects, ownerId) {
    const out = [];
    for (const e of effects) if (e && e.ownerId === ownerId) out.push(e);
    return out;
  },
  _countOwner(effects, ownerId) {
    let n = 0;
    for (const e of effects) if (e && e.ownerId === ownerId) n++;
    return n;
  },

  /** 取英雄的编译产物（多来源兼容，未找到返回 null）。 */
  _buildFor(hero, skillId) {
    if (!hero) return null;
    if (hero.skillBuild && hero.skillBuild[skillId]) return hero.skillBuild[skillId];
    if (hero.builds && hero.builds[skillId]) return hero.builds[skillId];
    if (hero.skillState && hero.skillState.builds && hero.skillState.builds[skillId]) return hero.skillState.builds[skillId];
    if (hero.build && hero.build.skillId === skillId) return hero.build;
    return null;
  },
  _statsOf(hero) {
    if (hero && hero.stats && typeof hero.stats === "object") return hero.stats;
    if (typeof computeStats === "function") {
      try { return computeStats(); } catch (e) { return {}; }
    }
    return {};
  },

  /* 22.8 扩容接线：把编译产物的 `castStats`（水晶贡献的**施放层统计**，如 cdMul 冷却倍率）
   * 合并进英雄属性，供 `SkillScheduler.cooldownFor` 消费 —— 没有这一步，「循环」水晶
   * 只会写进产物、不会真正改变冷却（B 路实测发现的缺口）。
   * 合成语义 = **乘法**（水晶倍率 × 角色自身倍率），不是覆盖：水晶不该抹掉角色属性。
   * 缺失 / 空对象 / 非有限数 → 原样返回 `_statsOf(hero)`，未通电与旧产物**零影响**。 */
  _castStatsOf(hero, build) {
    const base = SkillRuntime._statsOf(hero);
    const cs = build && build.castStats;
    if (!cs) return base;
    const keys = Object.keys(cs);
    if (!keys.length) return base;
    const out = {};
    for (const k in base) out[k] = base[k];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = cs[k];
      if (typeof v !== "number" || !isFinite(v)) continue;
      const cur = (typeof out[k] === "number" && isFinite(out[k])) ? out[k] : null;
      out[k] = (cur == null) ? v : (cur * v);
    }
    return out;
  },
  /** 图的节点列表（归一化三种形状：数组 / 对象映射（编译器的 CompiledSkillGraph）/ 图本体数组）。
   *  编译器把 nodes 存成 `{ nodeId: node }` 映射 → 必须在此转换成稳定顺序的数组。 */
  _nodeList(g) {
    if (!g) return [];
    if (Array.isArray(g.nodes)) return g.nodes;
    if (g.nodes && typeof g.nodes === "object") {
      return Object.keys(g.nodes).sort().map(function (k) { return g.nodes[k]; });
    }
    if (Array.isArray(g)) return g;
    return [];
  },
  _nodeById(snapshot, nodeId) {
    const g = snapshot && snapshot.graph;
    if (!g) return null;
    const nodes = SkillRuntime._nodeList(g);
    if (!nodes.length) return null;
    for (const n of nodes) if (n && n.nodeId === nodeId) return n;
    // 桥接：事件派生的描述符可能只携带 templateId（无 nodeId）→ 按**派生节点**的模板兜底匹配。
    // 22.4 #11 收紧：只匹配派生节点（derived/role=derived）——否则会命中主节点，
    // 产生「幻影主弹」（消失事件再生成一发主弹，且 role=derived 时伤害双重相乘 ×2.25）。
    for (const n of nodes) {
      if (n && n.templateId === nodeId && (n.derived === true || n.role === "derived")) return n;
    }
    return null;
  },
  /** 按 effectId 找存活实体（派生定位用父实体位置）。 */
  _effectById(world, id) {
    const effects = SkillRuntime._effects(world);
    for (const e of effects) if (e.effectId === id) return e;
    return null;
  },
  /** 主效果节点（role === primary 或未标注 role）。 */
  _rootNodes(snapshot) {
    const g = snapshot && snapshot.graph;
    if (!g) return [];
    if (Array.isArray(g.rootNodeIds)) {
      const out = [];
      for (const id of g.rootNodeIds) { const n = SkillRuntime._nodeById(snapshot, id); if (n) out.push(n); }
      return out;
    }
    const out = [];
    for (const n of SkillRuntime._nodeList(g)) if (n && (n.role == null || n.role === "primary")) out.push(n);
    return out;
  },
  /** 模板解析：类别 + 默认参数（全部来自 CFG.skillSystem.effectTemplates / defaults）。 */
  _resolveTemplate(t, node) {
    const tplDef = (t && t.effectTemplates && t.effectTemplates[node.templateId]) || null;
    let category = tplDef ? (tplDef.template || tplDef.kind || tplDef.category) : null;
    if (!category) category = node.category || node.templateKind || null;
    if (!category && _SR_CAT_DEFAULT_KEY[node.templateId]) category = node.templateId;
    if (!category || !_SR_CAT_DEFAULT_KEY[category]) return null;
    const dk = _SR_CAT_DEFAULT_KEY[category];
    const defaults = (tplDef && tplDef.defaults) ? tplDef.defaults
      : ((t && t.defaults && t.defaults[dk]) ? t.defaults[dk] : {});
    return { category, defaults: defaults || {} };
  },
  _params(t, node, tpl) {
    const p = {};
    if (tpl && tpl.defaults) for (const k in tpl.defaults) p[k] = tpl.defaults[k];
    if (node && node.parameters) for (const k in node.parameters) p[k] = node.parameters[k];
    return p;
  },

  /* ================= C 路：效果行为字段（配置字段驱动，缺失 = 现状，零影响） ================= */

  /** 按 operationId 取操作定义（惰性缓存；配置对象变更时重建）。仅在节点字段缺失时兜底。
   *  运行时不识别水晶 ID（合同 §18）——这里只按 operationId 取字段，不做水晶分支。 */
  _opById(id) {
    if (id == null) return null;
    const t = SkillRuntime._t();
    const defs = t && t.crystalDefs;
    if (!defs || typeof defs !== "object") return null;
    if (SkillRuntime._opCacheSrc !== defs) {
      const map = {};
      for (const cid in defs) {
        const cd = defs[cid];
        if (!cd || !Array.isArray(cd.operations)) continue;
        for (const op of cd.operations) if (op && op.id != null && map[op.id] == null) map[op.id] = op;
      }
      SkillRuntime._opCache = map;
      SkillRuntime._opCacheSrc = defs;
    }
    return SkillRuntime._opCache[id] || null;
  },
  /** 读取效果的「行为字段」（targeting / attach / chainLeft）。
   *  优先级：节点 parameters → 节点直挂字段 → 操作定义（operationId）→ 操作 parameters。
   *  全部缺失 → undefined（保持现状行为）。 */
  _behaviorField(node, key) {
    if (!node || !key) return undefined;
    const p = node.parameters;
    if (p && p[key] !== undefined && p[key] !== null) return p[key];
    if (node[key] !== undefined && node[key] !== null) return node[key];
    const op = SkillRuntime._opById(node.operationId);
    if (op) {
      if (op[key] !== undefined && op[key] !== null) return op[key];
      if (op.parameters && op.parameters[key] !== undefined && op.parameters[key] !== null) return op.parameters[key];
    }
    return undefined;
  },
  /** 节点声明的链式次数初值（等级表 count 值，编译器写入 parameters.chainLeft；缺失回落 op.count）。 */
  _chainLeftOfNode(node) {
    const v = SkillRuntime._behaviorField(node, "chainLeft");
    if (typeof v === "number" && isFinite(v)) return Math.floor(v);
    const op = SkillRuntime._opById(node && node.operationId);
    if (op) {
      if (typeof op.count === "number" && isFinite(op.count)) return Math.floor(op.count);
      if (op.parameters && typeof op.parameters.count === "number" && isFinite(op.parameters.count)) return Math.floor(op.parameters.count);
    }
    return null;
  },
  /** 契约 A：效果所属路由策略是否「每次命中都派生」（缺失 = false）。 */
  _everyHit(eff) {
    if (!eff || !eff.rt) return false;
    if (eff.rt.everyHit === true) return true;                 // 节点内联覆盖（可测）
    const t = SkillRuntime._t();
    const pol = (t && t.eventPolicies && eff.rt.routePolicyId) ? t.eventPolicies[eff.rt.routePolicyId] : null;
    return !!(pol && pol.everyHit === true);
  },
  /** 契约 B：最近的、且不是 bornTargetId 的存活敌人（复用 TGT_NEAREST.maxRange，同距按稳定 ID）。 */
  _nearestOther(world, bornTargetId, x, y) {
    const t = SkillRuntime._t();
    const tp = (t && t.targetPolicies) ? t.targetPolicies.TGT_NEAREST : null;
    const maxRange = (tp && typeof tp.maxRange === "number" && isFinite(tp.maxRange)) ? tp.maxRange : 520;
    const r2 = maxRange * maxRange;
    const monsters = Array.isArray(world.monsters) ? world.monsters : [];
    let best = null, bd = Infinity;
    for (const m of monsters) {
      if (!m || m.dead) continue;
      if (bornTargetId != null && m.id === bornTargetId) continue;   // 排除本次命中目标
      const dx = m.x - x, dy = m.y - y;
      const d = dx * dx + dy * dy;
      if (d > r2) continue;
      if (d < bd || (d === bd && best && m.id < best.id)) { bd = d; best = m; }
    }
    return best;
  },
  /** 契约 C：附着目标的持续区域每帧同步坐标（目标死亡 → 找不到存活者 → 停在最后坐标）。 */
  _attachSync(world, eff) {
    if (!eff || !eff.rt) return;
    const id = eff.rt.attachTargetId;
    if (id == null) return;
    const monsters = Array.isArray(world.monsters) ? world.monsters : [];
    for (const m of monsters) {
      if (m && m.id === id && !m.dead) {
        eff.x = m.x; eff.y = m.y; eff.px = eff.x; eff.py = eff.y;
        return;
      }
    }
  },

  /* ================= 命中几何（扫掠优先用既有 segCircleHit） ================= */
  _pointSegDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 0) return Math.sqrt((px - x0) * (px - x0) + (py - y0) * (py - y0));
    let t = ((px - x0) * dx + (py - y0) * dy) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return Math.sqrt((px - (x0 + t * dx)) * (px - (x0 + t * dx)) + (py - (y0 + t * dy)) * (py - (y0 + t * dy)));
  },
  /** 线段-圆扫掠命中（禁用只查终点）：存在既有 segCircleHit 则用，否则自实现点到线段距离。 */
  _hitSeg(px, py, x, y, cx, cy, r) {
    if (typeof segCircleHit === "function") return segCircleHit(px, py, x, y, cx, cy, r);
    return SkillRuntime._pointSegDist(cx, cy, px, py, x, y) < r;
  },
  /** 线段参数 t（碰撞时间，用于同一步多碰撞排序）。 */
  _segT(px, py, x, y, cx, cy) {
    const dx = x - px, dy = y - py;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 0) return 0;
    let t = ((cx - px) * dx + (cy - py) * dy) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return t;
  },

  /* ================= 分流判定 ================= */

  /** 该英雄是否走新路径（迁移英雄且总开关开启）。 */
  ownsHero(hero) {
    const t = SkillRuntime._t();
    if (!t || !t.enabled) return false;
    if (!hero || hero.id == null) return false;
    return Array.isArray(t.migratedHeroIds) && t.migratedHeroIds.indexOf(hero.id) >= 0;
  },

  /* ================= 主入口 ================= */

  /** main.js 主循环单行入口（World.update 之后调用）：推进本世界全部迁移英雄。 */
  updateAll(world, dt) {
    const t = SkillRuntime._t();
    if (!t || !t.enabled) return;                 // 总开关关闭 → 零介入
    if (!world) return;
    const step = SkillRuntime._advanceStep(world);
    const simTime = SkillRuntime._simTime(world, dt);
    const heroes = SkillRuntime._heroesOf(world);
    for (const h of heroes) {
      if (!SkillRuntime.ownsHero(h)) continue;
      SkillRuntime._updateHeroStep(world, h, step, simTime, dt);
    }
  },

  /** 单英雄推进（独立入口，自行推进一步）：{ requests, spawned, derived }。 */
  updateHeroSkills(world, hero, dt) {
    if (!world || !hero) return { requests: [], spawned: 0, derived: 0 };
    const step = SkillRuntime._advanceStep(world);
    const simTime = SkillRuntime._simTime(world, dt);
    return SkillRuntime._updateHeroStep(world, hero, step, simTime, dt);
  },

  /* ================= 单步九段 ================= */

  _updateHeroStep(world, hero, step, simTime, dt) {
    const res = { requests: [], spawned: 0, derived: 0 };
    const effects = SkillRuntime._effects(world);

    /* ① 到期处理：推进 age/life，标记自然到期（不立即删除） */
    const owned = SkillRuntime._ownedEffects(effects, hero.id);
    for (const eff of owned) {
      if (eff.state !== "active") continue;
      eff.age += dt;
      eff.life -= dt;
      if (eff.life <= 0) { eff.state = "expiring"; eff.endReason = "life"; }
    }

    /* ② 自动施放请求 */
    const tickRes = (typeof SkillScheduler !== "undefined" && SkillScheduler && typeof SkillScheduler.tick === "function")
      ? SkillScheduler.tick(world, hero, dt)
      : { requests: [] };
    if (tickRes.stopped) {
      SkillRuntime._cleanupHero(world, hero, tickRes.reason || "DEAD");   // 强制清理：不触发消失派生
      return res;
    }
    res.requests = tickRes.requests || [];

    /* ③ 实体生成（主效果） */
    for (const req of res.requests) {
      const snap = SkillRuntime._snapshotFor(world, hero, req, simTime);
      if (!snap) continue;
      const roots = SkillRuntime._rootNodes(snap);
      for (const node of roots) {
        const sp = SkillRuntime.spawnEffect(world, snap, node.nodeId, {
          role: "primary", step, target: req.target, angle: null,
        });
        if (sp.accepted) res.spawned += sp.count;
      }
    }

    /* ④ 运动与碰撞（bornStep 守卫：新派生本步不碰撞） */
    const collisions = SkillRuntime._phaseSweep(world, hero, step, dt);

    /* ⑤ 合法伤害（按 碰撞时间 → 距离 → 目标稳定 ID 已排序） */
    const firstHits = SkillRuntime._phaseDamage(world, hero, collisions, simTime);

    /* ⑥ 首次命中事件 */
    for (const c of firstHits) {
      SkillRuntime._enqueueEvent(world, SkillRuntime._makeEvent(world, c.effect, c.target, null, simTime, "hit"));
    }

    /* ⑦ 贯穿 / 结束判定 */
    for (const c of collisions) {
      if (!c.resolved) continue;
      SkillRuntime._applyPierce(c.effect);
    }

    /* ⑧ 消失事件（自然结束才派生；每实例一次） */
    SkillRuntime._phaseDisappear(world, hero.id, simTime);

    /* ⑨ 事件队列派生（有限；出生步守卫 → 本步创建、下一步才动） */
    res.derived = SkillRuntime._phaseDerive(world, step);

    /* ⑩ 回收（本步已引用事件完成后） */
    SkillRuntime._phaseRecycle(world, hero.id);

    return res;
  },

  /** 追踪转向（22.x）：把速度方向朝最近有效目标旋转，角速度 = defaults.homing.turnRate × homingMode。
   *  失去目标 → 沿原方向（v0.5 §7）；同距按稳定目标 ID 决胜。 */
  _steerHoming(world, eff, mode, dt) {
    const monsters = Array.isArray(world.monsters) ? world.monsters : [];
    let best = null, bd = Infinity;
    for (const m of monsters) {
      if (!m || m.dead) continue;
      const dx = m.x - eff.x, dy = m.y - eff.y;
      const d = dx * dx + dy * dy;
      if (d < bd || (d === bd && best && m.id < best.id)) { bd = d; best = m; }
    }
    if (!best) return;
    const t = SkillRuntime._t();
    const baseTurn = (t && t.defaults && t.defaults.homing && t.defaults.homing.turnRate) || 3.0;
    const spd = Math.sqrt(eff.vx * eff.vx + eff.vy * eff.vy);
    if (spd <= 0) return;
    let ang = Math.atan2(eff.vy, eff.vx);
    const want = Math.atan2(best.y - eff.y, best.x - eff.x);
    let diff = want - ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = baseTurn * mode * dt;
    if (diff > maxTurn) diff = maxTurn; else if (diff < -maxTurn) diff = -maxTurn;
    ang += diff;
    eff.vx = Math.cos(ang) * spd; eff.vy = Math.sin(ang) * spd;
  },

  /** ④ 运动 + 扫掠碰撞；返回已按「时间→距离→目标ID」排序的碰撞列表。 */
  _phaseSweep(world, hero, step, dt) {
    const collisions = [];
    const effects = SkillRuntime._effects(world);
    const monsters = Array.isArray(world.monsters) ? world.monsters : [];
    for (const eff of effects) {
      if (eff.ownerId !== hero.id || eff.state !== "active") continue;
      if (eff.bornStep >= step) continue;                       // 出生步守卫
      const cat = eff.rt.category;

      if (cat === "flightProjectile") {
        eff.px = eff.x; eff.py = eff.y;
        /* 追踪（22.x）：主飞行弹持续转向最近目标。形态由编译产物参数 homingMode 驱动
         * （来自 CR_HOMING 的 operations.field="homingMode"），**不按水晶 ID 判定**（合同 §18）。 */
        const hm = eff.rt.params.homingMode;
        if (hm >= 1) SkillRuntime._steerHoming(world, eff, hm, dt);
        eff.x += eff.vx * dt; eff.y += eff.vy * dt;
      } else if (cat === "orbitContact") {
        eff.px = eff.x; eff.py = eff.y;
        const owner = SkillRuntime._heroOwner(world, eff.ownerId);
        const spd = eff.rt.params.angularSpeed != null ? eff.rt.params.angularSpeed : 0;
        eff.rt.angle += spd * dt;
        const od = eff.rt.params.orbitRadius != null ? eff.rt.params.orbitRadius
          : (eff.rt.params.radius != null ? eff.rt.params.radius : 0);
        if (owner) { eff.x = owner.x + Math.cos(eff.rt.angle) * od; eff.y = owner.y + Math.sin(eff.rt.angle) * od; }
      }

      if (cat === "flightProjectile") {
        for (const m of monsters) {
          if (!m || m.dead) continue;
          if (eff.hitMap[m.id] != null) continue;
          const rr = (m.r || 0) + eff.radius;
          if (SkillRuntime._hitSeg(eff.px, eff.py, eff.x, eff.y, m.x, m.y, rr)) {
            const dx = m.x - eff.x, dy = m.y - eff.y;
            collisions.push({
              effect: eff, target: m,
              time: SkillRuntime._segT(eff.px, eff.py, eff.x, eff.y, m.x, m.y),
              dist: Math.sqrt(dx * dx + dy * dy), resolved: false,
            });
          }
        }
      } else if (cat === "orbitContact" || cat === "instantArea") {
        for (const m of monsters) {
          if (!m || m.dead) continue;
          if (eff.hitMap[m.id] != null) continue;
          const dx = m.x - eff.x, dy = m.y - eff.y;
          const rr = (m.r || 0) + eff.radius;
          if (dx * dx + dy * dy <= rr * rr) {
            collisions.push({ effect: eff, target: m, time: 0, dist: Math.sqrt(dx * dx + dy * dy), resolved: false });
          }
        }
      } else if (cat === "persistentArea") {
        /* 契约 C（C 路）：attach === "target" 的持续区域每帧跟随生成时目标坐标
         * （目标死亡 → 停在最后坐标，自然走完 duration）。缺省 attach → 不进入本分支逻辑。 */
        SkillRuntime._attachSync(world, eff);
        const tick = (eff.rt.params.tick != null && eff.rt.params.tick > 0) ? eff.rt.params.tick : dt;
        eff.rt.tickAcc = (eff.rt.tickAcc || 0) + dt;
        if (eff.rt.tickAcc >= tick) {
          eff.rt.tickAcc = 0;
          for (const m of monsters) {
            if (!m || m.dead) continue;
            const dx = m.x - eff.x, dy = m.y - eff.y;
            const rr = (m.r || 0) + eff.radius;
            if (dx * dx + dy * dy <= rr * rr) {
              collisions.push({ effect: eff, target: m, time: 0, dist: Math.sqrt(dx * dx + dy * dy), resolved: false });
            }
          }
        }
      }
    }
    collisions.sort((a, b) => (a.time - b.time) || (a.dist - b.dist) || ((a.target.id || 0) - (b.target.id || 0)));
    return collisions;
  },

  /** ⑤ 合法伤害：命中去重 / 环绕共享间隔 / 额度；返回本步首次命中的碰撞。 */
  _phaseDamage(world, hero, collisions, simTime) {
    const firstHits = [];
    for (const c of collisions) {
      const eff = c.effect, m = c.target;
      if (eff.state !== "active" || m.dead) continue;
      const cat = eff.rt.category;

      if (cat === "orbitContact") {
        // 环绕：ownerId+skillId+接触模板组+targetId 共享 nextAllowedHitTime（多枚不绕过间隔）
        const group = eff.rt.params.hitGroup || eff.nodeId;
        const key = eff.ownerId + "|" + eff.skillId + "|" + group + "|" + m.id;
        const gate = SkillRuntime._orbitGate(world);
        const interval = eff.rt.params.hitInterval != null ? eff.rt.params.hitInterval : 0;
        const next = gate[key];
        if (next != null && simTime < next) continue;
        gate[key] = simTime + interval;
      } else if (cat !== "persistentArea") {
        if (eff.hitMap[m.id] != null) continue;
      }

      const applied = SkillRuntime._applyDamage(world, eff, m, simTime);
      if (!applied) continue;
      c.resolved = true;
      if (cat !== "persistentArea") eff.hitMap[m.id] = simTime;
      /* 契约 A（C 路）：EP_DERIVED_EACH_HIT（everyHit=true）→ 每次合法命中都推入派生列表；
       * 否则维持现状 EP_DERIVED_ONCE（每实例仅首次命中派生一次，split/explosion/afterflame 依赖）。 */
      if (SkillRuntime._everyHit(eff)) {
        eff.rt.firstHitDone = true;
        firstHits.push(c);
      } else if (!eff.rt.firstHitDone) {
        eff.rt.firstHitDone = true;
        firstHits.push(c);
      }
    }
    return firstHits;
  },

  /** ⑦ 贯穿 / 结束：飞行弹命中后按贯穿额度递减，耗尽即结束。 */
  _applyPierce(eff) {
    if (eff.rt.category !== "flightProjectile") return;
    const pierce = (eff.rt.params.pierce != null) ? eff.rt.params.pierce : 0;
    if (eff.rt.pierced == null) eff.rt.pierced = 0;
    if (eff.rt.pierced < pierce) eff.rt.pierced += 1;
    else { eff.state = "dead"; eff.endReason = "hit"; }
  },

  /** ⑧ 消失事件（仅自然结束；每实例一次；强制回收不走此处）。 */
  _phaseDisappear(world, ownerId, simTime) {
    const effects = SkillRuntime._effects(world);
    for (const eff of effects) {
      if (eff.ownerId !== ownerId) continue;
      if (!eff.rt || eff.rt.disappearEmitted) continue;
      const natural = (eff.state === "expiring") || (eff.state === "dead" && eff.endReason && eff.endReason !== "forced");
      if (!natural) continue;
      eff.rt.disappearEmitted = true;
      eff.state = "dead";
      SkillRuntime._enqueueEvent(world, SkillRuntime._makeEvent(world, eff, null, SkillRuntime._endReason(eff.endReason || "life"), simTime, "vanish"));
    }
  },

  /** ⑨ 事件队列派生（有限；预算 + 深度 + 每事件上限）。 */
  _phaseDerive(world, step) {
    const budgets = SkillRuntime._budgets();
    const drained = SkillRuntime._drainEvents(world);
    const requests = drained.requests || [];
    const perEvent = {};
    let derived = 0;
    for (const req of requests) {
      if (!req) continue;
      const nodeId = (req.nodeId != null) ? req.nodeId : req.templateId;   // 路由器可能只给 templateId
      if (nodeId == null) continue;
      const depth = (req.depth != null) ? req.depth : 0;
      if (budgets.maxEventDepth != null && depth > budgets.maxEventDepth) continue;  // 深度超限
      const snap = SkillRuntime._snapshots(world)[req.castId];
      if (!snap) continue;
      const key = (req.eventId != null) ? ("e" + req.eventId) : ((req.sourceEventId != null) ? ("e" + req.sourceEventId) : (req.castId + "|" + nodeId));
      const cap = (budgets.maxDerivedPerEvent != null) ? budgets.maxDerivedPerEvent : Infinity;
      const used = perEvent[key] || 0;
      if (used >= cap) continue;                                                     // 单事件派生上限
      let sx = req.x, sy = req.y;
      let parent = null;
      if (sx == null && req.parentId != null) {                                      // 缺位置 → 用父实体位置
        parent = SkillRuntime._effectById(world, req.parentId);
        if (parent) { sx = parent.x; sy = parent.y; }
      }
      /* 分裂方向（22.4 #11）：沿父弹命中前方向展开（v0.5 §7），有速度才覆盖。 */
      let spawnAngle;
      if (!parent && req.parentId != null) parent = SkillRuntime._effectById(world, req.parentId);
      if (parent && (parent.vx || parent.vy)) spawnAngle = Math.atan2(parent.vy, parent.vx);

      /* 解析派生节点：C 路行为字段（chainLeft / targeting / attach）与类别判定均需它。 */
      const node = SkillRuntime._nodeById(snap, nodeId);
      if (!node) continue;

      /* 契约 A（C 路）·链式次数预算：派生节点携带 chainLeft（初值 = 等级表 count）。
       * - 主效果无预算 → 用首个派生节点初值「播种」，使一条弹射/链锁链 = count 跳；
       * - 每派生一次 chainLeft -= 1，归零 → 停止派生（terminateCond: chainLeft<=0）；
       * - 子效果继承父效果派生后的剩余值，保证链可终止（否则每代重读 count 会无界）。 */
      if (parent && parent.rt) {
        if (parent.rt.chainLeft == null) {
          const seed = SkillRuntime._chainLeftOfNode(node);
          if (seed != null) parent.rt.chainLeft = seed;
        }
        if (parent.rt.chainLeft != null && parent.rt.chainLeft <= 0) continue;   // 次数用尽 → 不得再派生
      }

      /* 契约 B（C 路）·派生目标选择：targeting === "nearestOther" → 朝最近的、非本次命中目标的敌人。
       * 飞行弹 → 初速方向指向该敌人；瞬时范围 → 生成位置设在该敌人坐标；找不到 → 不生成。 */
      let spawnX = sx, spawnY = sy, spawnAng = spawnAngle;
      const targeting = SkillRuntime._behaviorField(node, "targeting");
      if (targeting === "nearestOther") {
        const t = SkillRuntime._t();
        const tpl = SkillRuntime._resolveTemplate(t, node);
        const cat = tpl ? tpl.category : null;
        const other = SkillRuntime._nearestOther(world, req.targetId, (sx != null ? sx : (parent ? parent.x : 0)), (sy != null ? sy : (parent ? parent.y : 0)));
        if (!other) continue;                                   // 找不到目标 → 不生成（不得原地空爆）
        if (cat === "flightProjectile") {
          spawnX = (sx != null) ? sx : other.x;
          spawnY = (sy != null) ? sy : other.y;
          spawnAng = Math.atan2(other.y - spawnY, other.x - spawnX);   // 初速方向指向该敌人
        } else {
          spawnX = other.x; spawnY = other.y;                   // 瞬时范围直接生成在该敌人坐标（链锁传导）
        }
      }

      /* 契约 C（C 路）·附着：attach === "target" → 子效果记录生成时目标（其后每帧跟随）。 */
      const attachMode = SkillRuntime._behaviorField(node, "attach");
      const attachTargetId = (attachMode === "target") ? req.targetId : undefined;
      /* 子效果继承父效果派生后的剩余次数（pre-decrement 值 = 父减 1）。 */
      const childChainLeft = (parent && parent.rt && parent.rt.chainLeft != null) ? (parent.rt.chainLeft - 1) : undefined;

      const sp = SkillRuntime.spawnEffect(world, snap, nodeId, {
        role: "derived", step, target: null,
        spawnX: spawnX, spawnY: spawnY, targetId: req.targetId,
        depth: depth + 1, parentId: req.parentId,
        angle: spawnAng,
        chainLeft: childChainLeft,
        attachTargetId: attachTargetId,
      });
      if (sp.accepted) {
        perEvent[key] = used + sp.count;
        derived += sp.count;
        if (parent && parent.rt && parent.rt.chainLeft != null) parent.rt.chainLeft -= 1;   // 每派生一次 -1
      }
    }
    return derived;
  },

  /** ⑩ 回收：从容器移除已结束实体，并清空全部运行字段。 */
  _phaseRecycle(world, ownerId) {
    const effects = SkillRuntime._effects(world);
    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i];
      if (eff.ownerId !== ownerId) continue;
      if (eff.state !== "dead" && eff.state !== "recycled") continue;
      SkillRuntime._recycleEffect(eff);
      effects.splice(i, 1);
    }
    SkillRuntime._releaseDeadCasts(world, ownerId);
  },
  /** 释放「已无存活实体」的施放去重键（对接 SkillDamage.endCast；不做永久全局集合）。 */
  _releaseDeadCasts(world, ownerId) {
    const effects = SkillRuntime._effects(world);
    const live = {};
    for (const e of effects) if (e.ownerId === ownerId) live[e.castId] = true;
    const hs = SkillRuntime._hitStates(world);
    for (const k in hs) {
      if (live[k]) continue;
      if (typeof SkillDamage !== "undefined" && SkillDamage && typeof SkillDamage.endCast === "function") {
        SkillDamage.endCast(hs[k], k);
      }
      delete hs[k];
    }
  },
  _recycleEffect(eff) {
    eff.state = "recycled";
    eff.castId = null; eff.hitMap = null; eff.damageBasis = null;
    eff.x = 0; eff.y = 0; eff.px = 0; eff.py = 0; eff.vx = 0; eff.vy = 0;
    eff.life = 0; eff.age = 0; eff.radius = 0;
    eff.bornStep = null; eff.endReason = null; eff.rt = null;
  },
  /** 死亡 / 失活 / 离局：强制回收（清场不触发消失派生）。 */
  _cleanupHero(world, hero, reason) {
    const effects = SkillRuntime._effects(world);
    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i];
      if (eff.ownerId !== hero.id) continue;
      eff.endReason = reason || "forced";
      eff.state = "dead";
      SkillRuntime._recycleEffect(eff);
      effects.splice(i, 1);
    }
    SkillRuntime._releaseDeadCasts(world, hero.id);
  },

  /* ================= 快照 / 事件 / 伤害 对接 ================= */

  _snapshotFor(world, hero, req, simTime) {
    const build = SkillRuntime._buildFor(hero, req.skillId);
    const b = build ? Object.assign({}, build) : { skillId: req.skillId };
    /* 兼容两种编译产物形状：① 编译器返回「图本体」（含 nodes）② 外层包装（含 graph）。
     * 编译器的 CompiledSkillGraph 即图本体 → 让 snapshot.graph 直接指向它（否则取不到根节点）。 */
    if (b.graph == null && b.nodes) b.graph = b;
    if (b.skillId == null) b.skillId = req.skillId;
    if (b.simTime == null) b.simTime = simTime;
    if (b.level == null) {
      const st = hero.skillState && hero.skillState.skills && hero.skillState.skills[req.skillId];
      b.level = (st && st.level != null) ? st.level : 1;
    }
    const stats = SkillRuntime._castStatsOf(hero, b);
    const snap = SkillScheduler.createCastSnapshot(hero, b, stats, req.castId);
    SkillRuntime._snapshots(world)[req.castId] = snap;    // 派生复用同一快照
    // 每施放一份命中额度状态（去重键随施放生命周期释放，见 _releaseDeadCasts）
    const hs = SkillRuntime._hitStates(world);
    if (hs[req.castId] == null && typeof SkillDamage !== "undefined" && SkillDamage
        && typeof SkillDamage.newHitState === "function") {
      hs[req.castId] = SkillDamage.newHitState();
      if (typeof SkillDamage.beginCast === "function") SkillDamage.beginCast(hs[req.castId], req.castId);
    }
    return snap;
  },

  _makeEvent(world, eff, target, endReason, simTime, eventType) {
    /* 派生描述（22.4 #11）：按编译图边解析「本节点在该事件类型上挂了哪些派生节点」，
     * 随事件上报 → 路由器透传 → 派生请求按 nodeId 精确解析（不再按模板兜底错配主节点）。
     * hit → 边事件 onHit；vanish（含寿命/距离/自然命中结束）→ 边事件 onExpire。 */
    let derive = null;
    if (world) {
      const snap = SkillRuntime._snapshots(world)[eff.castId];
      const edges = (snap && snap.graph && Array.isArray(snap.graph.edges)) ? snap.graph.edges : null;
      if (edges && edges.length) {
        const wantEv = (eventType === "hit") ? "onHit" : "onExpire";
        const list = [];
        for (const e of edges) {
          if (e && e.from === eff.nodeId && e.to && (e.event || "onExpire") === wantEv) {
            if (!list.some(d => d.nodeId === e.to)) list.push({ nodeId: e.to });
          }
        }
        if (list.length) derive = list;
      }
    }
    return {
      castId: eff.castId, ownerId: eff.ownerId, skillId: eff.skillId,
      effectId: eff.effectId, parentId: eff.rt ? eff.rt.parentId : null,
      nodeId: eff.nodeId, templateId: eff.templateId, operationId: eff.rt ? eff.rt.operationId : null,
      routePolicyId: eff.rt ? eff.rt.routePolicyId : null,           // 22.4 #11：操作 → 节点 → 事件
      targetId: target ? target.id : (eff.rt ? eff.rt.targetId : null),
      depth: eff.rt ? (eff.rt.depth || 0) : 0,
      simulationTime: simTime, endReason: endReason, eventType: eventType || null,
      x: eff.x, y: eff.y, role: eff.role,
      derive: (eff.rt && eff.rt.derive) || derive,        // 编译图边派生描述（优先节点内联）
    };
  },
  _enqueueEvent(world, ev) {
    if (typeof SkillEvents !== "undefined" && SkillEvents && typeof SkillEvents.enqueue === "function") {
      const r = SkillEvents.enqueue(world, ev);
      return !!(r && r.accepted !== false);
    }
    const budgets = SkillRuntime._budgets();
    const q = SkillRuntime._eventQueue(world);
    const lim = (budgets.maxEventPerStep != null) ? budgets.maxEventPerStep : Infinity;
    if (q.length >= lim) return false;                    // 有界
    ev.eventId = (world.__skillEventSeq = (world.__skillEventSeq || 0) + 1);
    q.push(ev);
    return true;
  },
  _drainEvents(world) {
    if (typeof SkillEvents !== "undefined" && SkillEvents && typeof SkillEvents.drain === "function") {
      const r = SkillEvents.drain(world) || {};
      const list = r.requests || r.derivedRequests || r.derived || [];
      return { processed: r.processed || 0, requests: Array.isArray(list) ? list : [] };
    }
    const budgets = SkillRuntime._budgets();
    const lim = (budgets.maxEventPerStep != null) ? budgets.maxEventPerStep : Infinity;
    const q = SkillRuntime._eventQueue(world);
    const requests = [];
    let processed = 0;
    while (q.length && processed < lim) {
      const ev = q.shift(); processed++;
      if (!ev || !ev.derive) continue;
      const list = Array.isArray(ev.derive) ? ev.derive : [ev.derive];
      for (const one of list) { if (one) { if (one.eventId == null) one.eventId = ev.eventId; requests.push(one); } }
    }
    return { processed, requests };
  },
  /** 伤害基准解析（22.x 集成）：把节点的 `damageBasis`（引用形式）解析成结算器要的**数值形态**。
   *  v0.5 §5 公式：伤害 = 原始基准 × 形态系数 × 派生比例 × (1+外部Increased) × Π(独立水晶More) × 暴击 × 敌方修正
   *   - 原始基准：`baseRef` 支持稳定引用字符串（如 "hero.atk" → 快照 stats.atk）或直接数值；
   *   - 形态系数：节点参数 `coefficient`（水晶修正后，如扇射 1.4×0.8=1.12）；
   *   - 派生比例：派生节点自带 `damageBasis.coefficient`（如爆破 0.60），主效果为 1；
   *   - 独立水晶 More：节点参数 `moreDamageMul`（如通用增幅 1.12）；
   *   - 持续区域默认不暴击（v0.5 §5）。 */
  _resolveBasis(eff, snapshot) {
    const nb = eff.damageBasis || {};
    const stats = (snapshot && snapshot.stats) || {};
    const params = (eff.rt && eff.rt.params) || {};
    let base = 0;
    const ref = nb.baseRef;
    if (typeof ref === "number" && isFinite(ref)) base = ref;
    else if (typeof ref === "string") {
      const key = ref.split(".").pop();
      base = (typeof stats[key] === "number" && isFinite(stats[key])) ? stats[key] : 0;
    }
    const nodeCoeff = (params.coefficient != null && isFinite(params.coefficient)) ? params.coefficient : 1;
    const derivedRatio = (eff.role === "derived" && typeof nb.coefficient === "number" && isFinite(nb.coefficient))
      ? nb.coefficient : 1;
    const more = (params.moreDamageMul != null && isFinite(params.moreDamageMul)) ? params.moreDamageMul : 1;
    return {
      baseRef: base,
      coefficient: nodeCoeff * derivedRatio,
      ratio: 1,
      mores: more,
      increased: 0,
      critMul: 1,
      enemyMul: 1,
      isDoT: eff.rt && eff.rt.category === "persistentArea",
    };
  },

  _applyDamage(world, eff, target, simTime) {
    if (typeof SkillDamage !== "undefined" && SkillDamage && typeof SkillDamage.resolve === "function") {
      const hs = SkillRuntime._hitStates(world)[eff.castId] || null;
      const snap = SkillRuntime._snapshots(world)[eff.castId] || null;
      const r = SkillDamage.resolve(world, {
        world: world, target: target,
        damageBasis: SkillRuntime._resolveBasis(eff, snap),   // 引用 → 数值（22.x 集成）
        snapshot: snap,
        nodeId: eff.nodeId, templateId: eff.templateId,
        hitPolicyId: eff.rt.hitPolicyId, hitState: hs,
        castId: eff.castId, ownerId: eff.ownerId, skillId: eff.skillId,
        groupId: eff.rt.groupId, excludeTargetId: (eff.role === "derived") ? eff.rt.targetId : null,
        hitInterval: eff.rt.params.hitInterval, dps: eff.rt.dps, simTime: simTime,
      });
      return !!(r && r.applied);
    }
    return SkillRuntime._fallbackDamage(world, eff, target);   // 无模块时最小兜底（不改碰撞/公式）
  },
  _fallbackDamage(world, eff, target) {
    if (!target) return false;
    const db = eff.damageBasis;
    let dmg = 0;
    if (db) {
      if (typeof db.value === "number") dmg = db.value;
      else if (typeof db.base === "number") dmg = db.base;
    }
    if (typeof damageMonster === "function") { damageMonster(world, target, dmg, null); return true; }
    if (typeof target.hp === "number") { target.hp -= dmg; return true; }
    return false;
  },

  /* ================= 效果生成（四类节点模板） ================= */

  /** 生成效果实例：{ accepted, effectId, count, reason }。
   *  预算：超限时 reject 整体拒绝 / truncate 按稳定创建顺序保留前 N 个（绝不删已有实体）。 */
  spawnEffect(world, snapshot, nodeId, ctx) {
    const R = SkillRuntime._reason;
    if (!world || !snapshot) return { accepted: false, effectId: null, count: 0, reason: R("INVALID_REFERENCE") };
    const node = SkillRuntime._nodeById(snapshot, nodeId);
    if (!node) return { accepted: false, effectId: null, count: 0, reason: R("INVALID_REFERENCE") };
    const t = SkillRuntime._t();
    const tpl = SkillRuntime._resolveTemplate(t, node);
    if (!tpl || !tpl.category) return { accepted: false, effectId: null, count: 0, reason: R("UNKNOWN_EXECUTOR") };

    ctx = ctx || {};
    const budgets = SkillRuntime._budgets();
    const policy = budgets.overloadPolicy || "reject";
    const effects = SkillRuntime._effects(world);
    const heroCount = SkillRuntime._countOwner(effects, snapshot.ownerId);
    const castCount = SkillRuntime._castCount(world, snapshot.castId);
    const params = SkillRuntime._params(t, node, tpl);

    let want = (ctx.count != null) ? ctx.count : ((params.count != null) ? params.count : 1);
    if (!(want > 0)) want = 1;
    want = Math.floor(want);

    const capByCast = (budgets.maxEffectsPerCast != null ? budgets.maxEffectsPerCast : Infinity) - castCount;
    const capByHero = (budgets.maxEffectsPerHero != null ? budgets.maxEffectsPerHero : Infinity) - heroCount;
    const cap = Math.min(capByCast, capByHero);
    if (cap <= 0) return { accepted: false, effectId: null, count: 0, reason: R("BUDGET_EXCEEDED") };
    if (want > cap) {
      if (policy === "reject") return { accepted: false, effectId: null, count: 0, reason: R("BUDGET_EXCEEDED") };
      want = cap;                                   // truncate
    }

    const made = [];
    for (let i = 0; i < want; i++) {
      const eff = SkillRuntime._makeEffect(world, snapshot, node, tpl, params, ctx, i, want);
      if (!eff) continue;
      effects.push(eff); made.push(eff);
    }
    if (made.length) SkillRuntime._bumpCastCount(world, snapshot.castId, made.length);
    return { accepted: true, effectId: made.length ? made[0].effectId : null, count: made.length, reason: null };
  },

  _makeEffect(world, snapshot, node, tpl, params, ctx, i, want) {
    const owner = SkillRuntime._heroOwner(world, snapshot.ownerId);
    const ox = (ctx.spawnX != null) ? ctx.spawnX : ((owner && typeof owner.x === "number") ? owner.x : 0);
    const oy = (ctx.spawnY != null) ? ctx.spawnY : ((owner && typeof owner.y === "number") ? owner.y : 0);
    const target = ctx.target || null;
    const eff = {
      effectId: ++SkillRuntime._effectSeq,
      castId: snapshot.castId, ownerId: snapshot.ownerId,
      skillId: snapshot.skillId, nodeId: node.nodeId, templateId: node.templateId,
      role: ctx.role || node.role || "primary",
      x: ox, y: oy, px: ox, py: oy, vx: 0, vy: 0,
      life: 0, age: 0, radius: 0,
      damageBasis: node.damageBasis || null,
      hitMap: {}, bornStep: (ctx.step != null) ? ctx.step : 0,
      state: "active", endReason: null, simTime: snapshot.simTime || 0,
      rt: {
        category: tpl.category, params: params, angle: 0, tickAcc: 0,
        targetId: (ctx.targetId != null) ? ctx.targetId : (target ? target.id : null),
        depth: ctx.depth || 0, parentId: (ctx.parentId != null) ? ctx.parentId : null,
        operationId: node.operationId || null, routePolicyId: node.routePolicyId || null,
        derive: node.derive || null,
        hitPolicyId: node.hitPolicyId || null, groupId: node.nodeId,
        dps: (params.dps != null) ? params.dps : null,
        firstHitDone: false, disappearEmitted: false, pierced: 0,
        /* C 路运行字段：链式剩余次数（null = 无预算）＋附着目标（null = 静态）。 */
        chainLeft: (ctx.chainLeft !== undefined) ? ctx.chainLeft
          : ((typeof params.chainLeft === "number" && isFinite(params.chainLeft)) ? Math.floor(params.chainLeft) : null),
        attachTargetId: (ctx.attachTargetId !== undefined) ? ctx.attachTargetId : null,
      },
    };
    const cat = tpl.category;
    if (cat === "flightProjectile") {
      const spd = (params.speed != null) ? params.speed : 0;
      const base = target ? Math.atan2(target.y - oy, target.x - ox) : ((ctx.angle != null) ? ctx.angle : 0);
      const spread = (params.spread != null) ? params.spread : 0;
      const ang = base + (want > 1 ? (i - (want - 1) / 2) * spread : 0);
      eff.vx = Math.cos(ang) * spd;
      eff.vy = Math.sin(ang) * spd;
      eff.radius = (params.radius != null) ? params.radius : 0;
      eff.life = (params.life != null) ? params.life : 0;
    } else if (cat === "orbitContact") {
      eff.rt.angle = (i / Math.max(1, want)) * Math.PI * 2;
      const od = (params.orbitRadius != null) ? params.orbitRadius : ((params.radius != null) ? params.radius : 0);
      eff.x = ox + Math.cos(eff.rt.angle) * od;
      eff.y = oy + Math.sin(eff.rt.angle) * od;
      eff.px = eff.x; eff.py = eff.y;
      eff.radius = (params.contactRadius != null) ? params.contactRadius : 0;
      eff.life = (params.duration != null) ? params.duration : ((params.life != null) ? params.life : 0);
    } else if (cat === "instantArea") {
      eff.radius = (params.radius != null) ? params.radius : 0;
      eff.life = (params.life != null) ? params.life : 0;
    } else if (cat === "persistentArea") {
      eff.radius = (params.radius != null) ? params.radius : 0;
      eff.life = (params.duration != null) ? params.duration : ((params.life != null) ? params.life : 0);
    }
    return eff;
  },
};

/** 旧路径守卫（供 game.js 单行插入：迁移英雄跳过旧施放逻辑）。 */
function skillV2Owns(hero) {
  return typeof SkillRuntime !== "undefined" && SkillRuntime.ownsHero(hero);
}
