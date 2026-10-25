/* ============================================================
 * skill-save.js — SkillSaveAdapter（能量水晶技能系统 · W4b 开发）
 * 职责：存档版本 → 可恢复状态与迁移报告；未知 ID / 等级越界 / 旧冲突必须保留原始备份。
 * 边界（合同 §4）：**禁止静默丢弃资产**。
 * 契约：G_docs/skill_system_interface_v1.md 第三节；合同 §14；v0.5 §13。
 * ------------------------------------------------------------------
 * 迁移铁律：
 *   - 必须备份原始有效存档（preservedOriginal 原样保留）
 *   - 按版本执行一次；可重复运行而不重复补偿（幂等：__migratedTo 标记）
 *   - 未知 ID / 旧九级越界 / 冲突旧组合 → 进 report 并**保留原值**，不静默删除
 *   - migrationMaps 由入参提供（逐项审核，禁止按名称相似自动匹配）
 *   - configVersion 不匹配 → 不得把新表直接套到旧实体快照（打标记 + 原因）
 * ============================================================ */
"use strict";

const SkillSave = {
  SCHEMA_VERSION: 2,
  _lastSerialized: null,   // 供无参 saveTo(meta) 使用（serialize 时写入）

  /* ---- 深拷贝（纯数据，JSON 往返；失败回落浅引用）---- */
  _deep(v) {
    if (v == null) return v;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  },
  _tables() { return (typeof CFG !== "undefined" && CFG.skillSystem) ? CFG.skillSystem : null; },
  _configVersion() {
    if (typeof SkillConfig !== "undefined" && SkillConfig && typeof SkillConfig.version === "function") {
      const v = SkillConfig.version();
      if (v) return v;
    }
    const t = this._tables();
    return (t && t.configVersion) || null;
  },
  /* 统一英雄列表（支持单英雄 HeroSkillState 或容器 { heroes }）。 */
  _heroList(state) {
    if (!state) return [];
    if (state.heroes && typeof state.heroes === "object") {
      return Object.keys(state.heroes).map(id => Object.assign({}, state.heroes[id], { heroId: state.heroes[id].heroId || id }));
    }
    if (state.heroId) return [state];
    return [];
  },

  /* ============================================================
   * serialize(state) -> 可序列化对象（含 schemaVersion / configVersion / 每英雄状态）
   * ============================================================ */
  serialize(state) {
    const out = {
      schemaVersion: this.SCHEMA_VERSION,
      configVersion: this._configVersion(),
      heroes: {},
    };
    for (const h of this._heroList(state)) {
      const skills = {};
      for (const sid in (h.skills || {})) {
        const s = h.skills[sid] || {};
        skills[sid] = { id: sid, level: s.level || 1, cd: s.cd || 0, cdLeft: s.cdLeft || 0 };
      }
      const crystals = (h.crystals || []).map(c => ({ crystalId: c.crystalId, level: c.level || 1, slot: (c.slot != null ? c.slot : null) }));
      // 奖励事务与随机状态（取消保留该事务 → 必须可持久化）
      const txns = {};
      for (const rid in (h.rewardTransactions || {})) {
        const t = h.rewardTransactions[rid];
        txns[rid] = { rewardId: t.rewardId || rid, heroId: t.heroId || h.heroId,
          source: t.source || null, groupVersion: t.groupVersion || 0, randomState: (t.randomState != null ? t.randomState : null),
          options: this._deep(t.options || []), committed: !!t.committed, status: t.status || "OPEN" };
      }
      out.heroes[h.heroId] = {
        heroId: h.heroId, slotCount: h.slotCount, groupVersion: h.groupVersion || 0,
        skills: skills, crystals: crystals,
        attrRewards: this._deep(h.attrRewards || []), attrGain: this._deep(h.attrGain || {}),
        rewardTransactions: txns,
      };
    }
    this._lastSerialized = out;
    return out;
  },

  /* ============================================================
   * migrate(saved, definitions) -> { state, report, preservedOriginal }
   * definitions = CFG.skillSystem 或 { crystalDefs, skillDefs, migrationMaps, configVersion, ... }
   * ============================================================ */
  migrate(saved, definitions) {
    const R = (typeof SKILL_REASON !== "undefined") ? SKILL_REASON : {};
    const defs = definitions || this._tables() || {};
    const targetConfig = defs.configVersion || null;
    const targetSchema = this.SCHEMA_VERSION;

    /* ① 备份原始有效存档（原样保留，永不覆盖）*/
    const preservedOriginal = this._deep(saved);

    const report = {
      schemaVersionFrom: (saved && saved.schemaVersion != null) ? saved.schemaVersion : null,
      schemaVersionTo: targetSchema,
      configVersionFrom: (saved && saved.configVersion != null) ? saved.configVersion : null,
      configVersionTo: targetConfig,
      configVersionMismatch: false,
      alreadyMigrated: false,
      migrated: [], unknownIds: [], levelOverflow: [], conflicts: [], notes: [],
    };

    if (!saved) {
      report.notes.push({ code: R.NO_CANDIDATE, message: "空存档：无内容可迁移" });
      return { state: null, report: report, preservedOriginal: preservedOriginal };
    }

    /* ② 幂等：已按目标版本迁移过 → 不再重复补偿 */
    if (saved.__migratedTo != null && saved.__migratedTo === targetConfig
        && saved.schemaVersion === targetSchema) {
      report.alreadyMigrated = true;
      report.notes.push({ code: null, message: "存档已是目标版本，跳过重复迁移（不重复补偿）" });
      return { state: this._deep(saved), report: report, preservedOriginal: preservedOriginal };
    }

    /* ③ configVersion 不匹配 → 标记 + 原因（不得把新表直接套到旧实体快照）*/
    if (saved.configVersion != null && targetConfig != null && saved.configVersion !== targetConfig) {
      report.configVersionMismatch = true;
      report.notes.push({ code: R.NOT_MIGRATED,
        message: "configVersion 不匹配（" + saved.configVersion + " → " + targetConfig +
          "）：标记旧实体快照，不做直接套表；按 migrationMaps 逐项翻译并保留原值" });
    }

    const crystalDefs = defs.crystalDefs || {};
    const maps = defs.migrationMaps || {};
    const mapCrystals = maps.crystals || {};
    const motionGroups = (defs.supportGroupRules && defs.supportGroupRules.motionConflictGroups) || maps.motionConflictGroups || [];

    const outState = { schemaVersion: targetSchema, configVersion: targetConfig, heroes: {} };

    for (const h of this._heroList(saved)) {
      const heroId = h.heroId;
      const outHero = { heroId: heroId, slotCount: h.slotCount, groupVersion: h.groupVersion || 0,
        skills: {}, crystals: [], attrRewards: this._deep(h.attrRewards || []),
        attrGain: this._deep(h.attrGain || {}), rewardTransactions: this._deep(h.rewardTransactions || {}) };
      for (const sid in (h.skills || {})) {
        const s = h.skills[sid] || {};
        outHero.skills[sid] = { id: sid, level: s.level || 1, cd: s.cd || 0, cdLeft: s.cdLeft || 0 };
      }

      const seen = {};
      for (const c of (h.crystals || [])) {
        const oldId = c && c.crystalId;
        if (!oldId) continue;
        /* 映射：逐项审核（mapCrystals[oldId]），缺失且新表无该 ID → 未知资产，保留原值 */
        let newId = null, mapped = false;
        if (mapCrystals[oldId] != null) { newId = mapCrystals[oldId]; mapped = true; }
        else if (crystalDefs[oldId]) { newId = oldId; }
        if (!newId) {
          report.unknownIds.push({ heroId: heroId, crystalId: oldId, level: c.level || 1, action: "preserved" });
          outHero.crystals.push({ crystalId: oldId, level: c.level || 1, slot: (c.slot != null ? c.slot : null), unknown: true });
          continue;
        }
        const def = crystalDefs[newId];
        const maxLv = (def && Array.isArray(def.levels) && def.levels.length) || null;
        let level = c.level || 1;
        /* 等级越界：不直接截断成示例等级 → 进 levelOverflow 并保留原值 */
        if (maxLv != null && level > maxLv) {
          report.levelOverflow.push({ heroId: heroId, crystalId: newId, originalLevel: level, maxLevel: maxLv, action: "preserved" });
          outHero.crystals.push({ crystalId: newId, level: level, slot: (c.slot != null ? c.slot : null), overflow: true });
        } else {
          outHero.crystals.push({ crystalId: newId, level: level, slot: (c.slot != null ? c.slot : null) });
        }
        if (mapped) report.migrated.push({ heroId: heroId, from: oldId, to: newId, level: level, kind: "crystal" });
        /* 结构冲突：同 ID 重复 */
        if (seen[newId]) {
          report.conflicts.push({ heroId: heroId, crystalId: newId, type: "DUPLICATE_CRYSTAL", action: "preserved" });
        }
        seen[newId] = true;
      }

      /* 形态互斥冲突（配置驱动的动作组）*/
      for (const grp of motionGroups) {
        const present = (grp || []).filter(id => outHero.crystals.some(c => c.crystalId === id));
        if (present.length >= 2) {
          report.conflicts.push({ heroId: heroId, type: R.MOTION_CONFLICT, crystals: present, action: "preserved" });
        }
      }

      outState.heroes[heroId] = outHero;
    }

    /* ④ 迁移完成标记（幂等：重复迁移不再重复补偿）*/
    outState.__migratedTo = targetConfig;
    if (!report.migrated.length && !report.unknownIds.length && !report.levelOverflow.length && !report.conflicts.length) {
      report.notes.push({ code: null, message: "无需要迁移的水晶资产" });
    }
    return { state: outState, report: report, preservedOriginal: preservedOriginal };
  },

  /* ============================================================
   * saveTo(meta, state?) / loadFrom(meta)：只读写 Meta.data.skillSystem 子对象
   * （不改 Meta 其它字段，不改 SAVE_KEY）
   * ============================================================ */
  saveTo(meta, state) {
    if (typeof Meta === "undefined" || !meta || !meta.data) return false;
    const payload = state ? this.serialize(state) : this._lastSerialized;
    if (!payload) return false;
    meta.data.skillSystem = payload;   // 只写这一个子对象
    return this._persist(meta);        // 单行挂点：写入后触发宿主持久化（实现见下方独立区块）
  },
  loadFrom(meta) {
    if (typeof Meta === "undefined" || !meta || !meta.data) return null;
    const s = meta.data.skillSystem;
    return s != null ? this._deep(s) : null;
  },

  /* ============================================================
   * 宿主持久化触发（W4b 接线 · 文件末尾独立区块）
   * 语义：saveTo 把装配写入 meta.data.skillSystem 后调用本方法落盘。
   *   - meta 提供 commit（= 宿主 Meta）→ 立即调用，把 SAVE_KEY 存档写盘；
   *   - 无 commit 的桩环境（无头/无宿主）→ 仅内存写入，容错不抛；
   *   - commit 抛异常 → 吞掉并返回 false（明确布尔），内存写入已发生不回滚。
   * 边界：不改 SAVE_KEY、不改 Meta 其它字段、不发明新的 save/asset 接口。
   * ============================================================ */
  _persist(meta) {
    if (meta && typeof meta.commit === "function") {
      try { meta.commit(); } catch (e) { return false; }
    }
    return true;
  },
};

/* ---- 顶层函数（接口文档第三节）---- */
/** 序列化每英雄技能状态（合同 §7 serializeHeroSkills）。 */
function serializeHeroSkills(state) { return SkillSave.serialize(state); }
/** 迁移存档（合同 §7 migrateHeroSkills）。 */
function migrateHeroSkills(saved, definitions) { return SkillSave.migrate(saved, definitions); }
