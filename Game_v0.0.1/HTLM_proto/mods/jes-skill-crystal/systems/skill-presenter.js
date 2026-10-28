/* ============================================================
 * skill-presenter.js — SkillPresenter（能量水晶技能系统 · W4b 开发）
 * 职责：编译解释 + 配置文案 → UI 数据（只消费解释结果，不重算一套适用规则）。
 * 边界（合同 §4）：**不再次计算适用规则**（合同 §13：禁用名字判定"能否用"）。
 * 契约：G_docs/skill_system_interface_v1.md 第三节；合同 §13；v0.5 §11。
 * ------------------------------------------------------------------
 * 适用判定（applied|inactive|conflict）**只来自 build.explanations**，
 *   与水晶 nameKey / 显示名完全解耦（防回归关键约束）。
 * 文案从「配置 + 解释结果」生成；原因码 → 中文映射；中文不得用于逻辑分支。
 * ============================================================ */
"use strict";

const SkillPresenter = {
  _compileFn: null,   // 可注入编译器（测试 / W2 未就绪时对接桩）

  /** 注入编译器：fn(state, heroId) -> BuildResult。 */
  setCompiler(fn) { this._compileFn = (typeof fn === "function") ? fn : null; return this; },
  configure(opts) { if (opts && "compilerFn" in opts) this.setCompiler(opts.compilerFn); return this; },

  /* ---- 惰性表访问 ---- */
  _tables() { return (typeof CFG !== "undefined" && CFG.skillSystem) ? CFG.skillSystem : null; },
  _crystalDef(id) { const t = this._tables(); return (t && t.crystalDefs && t.crystalDefs[id]) || null; },
  _skillDef(id) { const t = this._tables(); return (t && t.skillDefs && t.skillDefs[id]) || null; },
  _qualityDef(qid) {
    const t = this._tables();
    if (!t || !Array.isArray(t.qualityDefs)) return null;
    return t.qualityDefs.find(q => q && q.id === qid) || null;
  },
  /* 文案键 → 中文（配置优先，缺失回落 key 或指定兜底）。 */
  _text(key, fallback) {
    const t = this._tables();
    const loc = (t && t.localization) || {};
    if (key && loc[key] != null) return loc[key];
    if (fallback != null) return fallback;
    return key || "";
  },

  /* 原因码 → 中文（配置 localization["reason.CODE"] 优先；缺省内置兜底表）。 */
  _reasonText(code) {
    if (!code) return "";
    const t = this._tables();
    const loc = (t && t.localization) || {};
    const k = "reason." + code;
    if (loc[k] != null) return loc[k];
    return this.ReasonText[code] || code;
  },
  /* 冻结原因码中文兜底表（仅展示用，禁止用于逻辑分支）。 */
  ReasonText: {
    NO_COMPATIBLE_NODE: "无节点匹配（不产生收益）",
    NO_GAIN: "收益为零",
    SLOTS_FULL: "槽位已满",
    MAX_LEVEL: "已达等级上限",
    MOTION_CONFLICT: "形态互斥（争用主运动资源）",
    EXISTING_CRYSTAL_INACTIVE: "已装水晶将全部失效",
    INVALID_REFERENCE: "引用缺失",
    UNKNOWN_EXECUTOR: "未知执行器",
    CYCLE_DEPENDENCY: "阶段依赖成环",
    EVENT_BUDGET_EXCEEDED: "事件预算超限",
    DERIVED_DEPTH_EXCEEDED: "派生深度超限",
    BUDGET_EXCEEDED: "实体/事件预算超限",
    ALREADY_COMMITTED: "事务已兑现",
    NO_CANDIDATE: "无合法候选",
    PENDING: "提交处理中",
    TARGET_ALREADY_HIT: "同目标已消耗本次命中额度",
    INACTIVE_OPERATION: "该操作对目标技能不适用",
    NOT_MIGRATED: "英雄未迁移",
    UNKNOWN_ID: "旧存档未知 ID",
    LEVEL_OVERFLOW: "旧存档等级越界",
    REGION_MAX_DPS: "持续区域重叠取最高 DPS",
  },

  /* ---- 编译（可选注入；否则用 SupportCompiler）---- */
  compile(state, heroId) {
    if (typeof this._compileFn === "function") return this._compileFn(state, heroId);
    if (typeof SupportCompiler !== "undefined" && SupportCompiler && typeof SupportCompiler.compile === "function") {
      return SupportCompiler.compile({ heroId: heroId, state: state, definitions: this._tables() });
    }
    return { ok: false, configVersion: null, signature: null, skills: {}, explanations: [], diagnostics: [] };
  },

  /* ============================================================
   * panel(state, heroId) -> { heroId, skills, slots, matrix, notices }
   * ============================================================ */
  panel(state, heroId) {
    const R = (typeof SKILL_REASON !== "undefined") ? SKILL_REASON : {};
    const out = { heroId: heroId, skills: [], slots: [], matrix: [], notices: [] };
    if (!state) return out;
    const build = (arguments.length > 2 && arguments[2]) ? arguments[2] : this.compile(state, heroId);
    const explanations = (build && build.explanations) || [];
    const diagnostics = (build && build.diagnostics) || [];

    /* 技能列表（两技能 / 等级 / 冷却）*/
    const skillIds = Object.keys(state.skills || {});
    for (const sid of skillIds) {
      const inst = state.skills[sid] || {};
      const def = this._skillDef(sid);
      const nameKey = (def && def.presentation && def.presentation.nameKey) || def && def.nameKey || null;
      out.skills.push({ skillId: sid, level: inst.level || 1, cd: inst.cd || 0, cdLeft: inst.cdLeft || 0,
        nameKey: nameKey, name: this._text(nameKey, sid) });
    }

    /* 四槽（实际辅助对象：crystalId/level/quality/targets）*/
    const slotCount = (state.slotCount != null) ? state.slotCount : ((this._tables() && this._tables().slotCount) || 4);
    for (let i = 0; i < slotCount; i++) {
      const c = (state.crystals || []).find(x => x && x.slot === i) || null;
      if (!c) { out.slots.push({ slot: i, crystalId: null, name: "", level: 0, quality: null, targets: [] }); continue; }
      const cd = this._crystalDef(c.crystalId);
      const nameKey = (cd && cd.presentation && cd.presentation.nameKey) || null;
      const q = cd ? this._qualityDef(cd.qualityId) : null;
      out.slots.push({
        slot: i, crystalId: c.crystalId, level: c.level || 1,
        name: this._text(nameKey, c.crystalId),
        quality: q ? { id: q.id, name: this._text(q.nameKey, q.id), color: q.color || null } : (cd ? cd.qualityId : null),
        targets: this._targetsOf(explanations, c.crystalId, skillIds),   // 实际辅助对象（来自解释，不重算）
      });
    }

    /* 矩阵：两技能 × 各水晶的 applied|inactive|conflict */
    for (const sid of skillIds) {
      const row = { skillId: sid, crystals: [] };
      for (const c of (state.crystals || [])) {
        row.crystals.push({ crystalId: c.crystalId, level: c.level || 1,
          status: this._statusOf(explanations, c.crystalId, sid) });
      }
      out.matrix.push(row);
    }

    /* 汇总标签（notices）：隐藏标签只控制外显，不影响详情代价 */
    for (const c of (state.crystals || [])) {
      const cd = this._crystalDef(c.crystalId);
      const p = (cd && cd.presentation) || {};
      const summaryTagKey = p.summaryTagKey || p.tagKey || null;
      if (summaryTagKey) {
        const hidden = p.hidden === true;
        out.notices.push({ code: null, crystalId: c.crystalId,
          text: this._text(summaryTagKey, summaryTagKey), hidden: hidden, kind: "summaryTag" });
      }
      if (p.hidden === true) {
        out.notices.push({ code: null, crystalId: c.crystalId,
          text: this._text("skill.presenter.hiddenSummary", "（汇总标签已隐藏）"), hidden: true, kind: "hiddenNotice" });
      }
    }
    for (const d of diagnostics) {
      out.notices.push({ code: d.code || R.INVALID_REFERENCE, crystalId: d.definitionId || null,
        text: this._reasonText(d.code) + (d.message ? "：" + d.message : ""), hidden: false, kind: "diagnostic" });
    }
    return out;
  },
  /* 取某水晶对某技能的状态（只读解释结果）。 */
  _statusOf(explanations, crystalId, skillId) {
    for (const e of explanations) if (e && e.crystalId === crystalId && e.skillId === skillId) return e.status || "inactive";
    return "inactive";
  },
  /* 取某水晶的辅助目标列表。 */
  _targetsOf(explanations, crystalId, skillIds) {
    const out = [];
    for (const sid of skillIds) out.push({ skillId: sid, status: this._statusOf(explanations, crystalId, sid) });
    return out;
  },

  /* ============================================================
   * explain(build) -> { explanations, diagnostics }（直接消费，不重算）
   * ============================================================ */
  explain(build) {
    if (!build) return { explanations: [], diagnostics: [] };
    return { explanations: build.explanations || [], diagnostics: build.diagnostics || [] };
  },

  /* ============================================================
   * detail(crystalId, heroId, build) -> { crystalId, heroId, text, reasonCodes, sections }
   * 必含：代价 / 限制 / 事件限制 / 冲突 / 不适用原因。hidden 不隐藏代价。
   * ============================================================ */
  detail(crystalId, heroId, build) {
    const cd = this._crystalDef(crystalId);
    const p = (cd && cd.presentation) || {};
    const explanations = (build && build.explanations) || [];

    /* 该水晶在各技能下的解释条目 */
    const mine = explanations.filter(e => e && e.crystalId === crystalId);
    const reasonCodes = [];
    for (const e of mine) for (const rc of (e.reasonCodes || [])) if (reasonCodes.indexOf(rc) < 0) reasonCodes.push(rc);
    if (!mine.length) {
      // 不在任何技能解释中 → 不适用（不依赖名字，仅按解释缺失判定）
      const R = (typeof SKILL_REASON !== "undefined") ? SKILL_REASON : {};
      reasonCodes.push(R.INACTIVE_OPERATION || "INACTIVE_OPERATION");
    }

    const lines = [];
    /* 标题 + 装配规则固定文案（不可卸载 / 占槽）*/
    lines.push(this._text(p.detailTitleKey, this._text(p.nameKey, crystalId)));
    lines.push(this._text("skill.presenter.cannotRemove", "本局不可卸载、不可替换；重复获取按定义 ID 合并升级，不占新槽。"));
    lines.push(this._text("skill.presenter.occupiesSlot", "占用 1 个共享水晶槽（两技能共享四槽）。"));

    /* 代价（hidden 不影响代价展示）*/
    const costLines = this._kv(this._costOf(cd));
    if (costLines.length) lines.push(this._text("skill.presenter.cost", "代价") + "：" + costLines.join("；"));
    /* 负面系数 */
    const negLines = this._kv(cd && cd.negative);
    if (negLines.length) lines.push(this._text("skill.presenter.negative", "负面系数") + "：" + negLines.join("；"));

    /* 两技能收益 / 失效操作 */
    const gainLines = [];
    for (const e of mine) {
      const sname = this._skillName(e.skillId);
      if (e.status === "applied") gainLines.push(sname + "：" + this._text("skill.presenter.applied", "生效") + this._paramDelta(e));
      else if (e.status === "conflict") gainLines.push(sname + "：" + this._text("skill.presenter.conflict", "冲突") + this._opNames(e));
      else gainLines.push(sname + "：" + this._text("skill.presenter.inactive", "不适用") + this._opNames(e));
    }
    if (gainLines.length) lines.push(this._text("skill.presenter.gains", "两技能收益") + "：" + gainLines.join("；"));

    /* 限制 */
    const limitLines = this._kv(cd && cd.limits);
    if (limitLines.length) lines.push(this._text("skill.presenter.limits", "限制") + "：" + limitLines.join("；"));
    /* 事件限制 */
    const evtLines = this._kv(cd && (cd.eventLimits || cd.events));
    if (evtLines.length) lines.push(this._text("skill.presenter.eventLimits", "事件限制") + "：" + evtLines.join("；"));
    /* 冲突 */
    const conflictLines = this._kv(cd && cd.conflicts);
    if (conflictLines.length) lines.push(this._text("skill.presenter.conflicts", "冲突") + "：" + conflictLines.join("；"));
    /* 不适用原因（原因码 → 中文）*/
    if (reasonCodes.length) {
      lines.push(this._text("skill.presenter.notApplicable", "不适用原因") + "：" +
        reasonCodes.map(c => this._reasonText(c)).join("；"));
    }

    return {
      crystalId: crystalId, heroId: heroId || null,
      text: lines.join("\n"), reasonCodes: reasonCodes,
      hiddenSummary: p.hidden === true,
      sections: { cost: costLines, limits: limitLines, eventLimits: evtLines,
        conflicts: conflictLines, notApplicable: reasonCodes.slice() },
    };
  },
  _costOf(cd) { return cd ? (cd.cost || cd.costs || null) : null; },
  _skillName(skillId) {
    const def = this._skillDef(skillId);
    const nameKey = (def && def.presentation && def.presentation.nameKey) || def && def.nameKey || null;
    return this._text(nameKey, skillId);
  },
  _opNames(e) {
    const ids = (e && e.nodes ? e.nodes : []).map(n => (n && (n.opId || n.nodeId)) || n).filter(Boolean);
    return ids.length ? "（操作：" + ids.join("、") + "）" : "";
  },
  /* 升级页：该级 → 下一等级的参数变化。 */
  _paramDelta(e) {
    if (!e) return "";
    const fmt = (v) => { if (v == null) return "-"; if (typeof v === "number") return String(Math.round(v * 1000) / 1000); return String(v); };
    let s = "";
    if (e.fromLevel != null && e.toLevel != null) s += "（Lv" + e.fromLevel + " → Lv" + e.toLevel + "）";
    if (e.before || e.after) {
      const keys = {};
      for (const k in (e.before || {})) keys[k] = true;
      for (const k in (e.after || {})) keys[k] = true;
      const parts = [];
      for (const k in keys) {
        const b = (e.before || {})[k], a = (e.after || {})[k];
        if (fmt(b) !== fmt(a)) parts.push(k + " " + fmt(b) + " → " + fmt(a));
      }
      if (parts.length) s += "（" + parts.join("，") + "）";
    }
    return s;
  },
  /* {key: value} → ["key value", ...]（文案键优先走 localization["kv.KEY"]）。 */
  _kv(obj) {
    if (!obj || typeof obj !== "object") return [];
    const out = [];
    for (const k in obj) {
      const isNum = typeof obj[k] === "number";
      const val = isNum ? String(Math.round(obj[k] * 1000) / 1000) : this._text(obj[k], String(obj[k]));
      out.push(this._text("kv." + k, k) + " " + val);
    }
    return out;
  },

  /* ============================================================
   * assembleText(template, vars) -> { text, missing }（纯函数）
   * 含占位符缺失检测。
   * ============================================================ */
  assembleText(template, vars) {
    const tpl = (template == null) ? "" : String(template);
    const v = vars || {};
    const missing = [];
    const text = tpl.replace(/\{([a-zA-Z0-9_.]+)\}/g, (m, key) => {
      if (Object.prototype.hasOwnProperty.call(v, key)) return String(v[key]);
      if (missing.indexOf(key) < 0) missing.push(key);
      return "";
    });
    return { text: text, missing: missing };
  },
};

/* 说明：UI 层按接口文档「模块对象命名空间」直接调用
 *   SkillPresenter.panel / explain / detail / assembleText，
 * 故本文件不再额外暴露顶层函数（避免与集成者命名冲突）。 */
