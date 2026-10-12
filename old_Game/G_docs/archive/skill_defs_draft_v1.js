/* ============================================================================
 * skill_defs_draft_v1.js —— 模块水晶技能系统 首批内容草稿（W1 产出，**已归档**）
 * ----------------------------------------------------------------------------
 * ⚠️ 归档声明（W6 起）：本文件是 W1 波次的交付快照，**不再是任何真源**。
 *    真源 = js/config.js 的 `CFG.skillSystem`（W6 已对齐编译器可执行词表）。
 *    本文件中的词汇表（countDistribution / mainForm / deriveTemplate / spawnTemplate /
 *    structuralForm）为 W1 旧命名，**已废弃**，请勿据此改代码。
 *    测试也已改为直连真源（见 skill_config_test.js），不再加载本文件。
 * ----------------------------------------------------------------------------
 * 用法（历史）：本文件曾是一个「字段块」，粘贴进 js/config.js 末尾的 `CFG.skillSystem`。
 * 契约：G_docs/skill_system_interface_v1.md 第四节「冻结数据形状」。
 * 真源：G_docs/design_crystal_skill_system_v0.5.md §7/§10（首轮验证范围）。
 *
 * 覆盖范围：2 技能（火球=碰撞飞行弹 / 震荡波=瞬时魔法范围）· 4 模板 · 9 水晶
 *           （8 颗机制 + CR_ARCANE_AMP 通用魔法增幅）· 品质 4 档 · 全部策略表。
 *
 * ⚠️ 数值一律为「首轮占位」，待策划按真实基线平衡，**不是上线数值**。
 * ⚠️ 伤害类型只认 physical / magical（本项目首轮无元素转换；火焰仅作表现主题）。
 * ========================================================================== */

  /* ---- 配置版本（构建缓存键 configVersion 段）---- */
  configVersion: "skill-v1.1.0-draft",

  /* ---- 效果模板（首批 4 类，v0.5 §3）---- */
  effectTemplates: {
    TP_FLIGHT_PROJECTILE: {
      id: "TP_FLIGHT_PROJECTILE", kind: "flightProjectile", nameKey: "template.flightProjectile",
      /* 占位数值：速度/寿命/半径/贯穿数，待策划平衡 */
      params: { speed: 480, life: 1.6, radius: 8, pierce: 0 },
    },
    TP_ORBIT_CONTACT: {
      id: "TP_ORBIT_CONTACT", kind: "orbitContact", nameKey: "template.orbitContact",
      params: { radius: 70, angularSpeed: 2.2, count: 3, hitInterval: 0.35 },
    },
    TP_INSTANT_AREA: {
      id: "TP_INSTANT_AREA", kind: "instantArea", nameKey: "template.instantArea",
      params: { radius: 110, life: 0.12 },
    },
    TP_PERSISTENT_AREA: {
      id: "TP_PERSISTENT_AREA", kind: "persistentArea", nameKey: "template.persistentArea",
      params: { radius: 120, duration: 4.0, tick: 0.25, dps: 0 },
    },
  },

  /* ---- 技能定义（首批 2 个，验证不同能力）----
   * baseGraph 节点显式声明：火球 1 个 flightProjectile primary；震荡波 1 个 instantArea primary。
   * 派生节点（分裂弹 / 爆炸 / 火场）由水晶操作的 spawnTemplateId 引入，不预置进基础图。*/
  skillDefs: {
    SK_FIREBALL: {
      id: "SK_FIREBALL", nameKey: "skill.fireball",
      /* 每级完整参数（占位，待平衡）。level N 取 levels[N-1]。*/
      levels: [
        { cooldown: 0.90, castTime: 0, coefficient: 1.40, count: 1, speed: 480, life: 1.6, radius: 8, extraPierceCount: 0 },
        { cooldown: 0.90, castTime: 0, coefficient: 1.55, count: 1, speed: 490, life: 1.6, radius: 8, extraPierceCount: 0 },
        { cooldown: 0.85, castTime: 0, coefficient: 1.70, count: 1, speed: 500, life: 1.7, radius: 9, extraPierceCount: 0 },
      ],
      baseGraph: {
        nodes: [
          {
            nodeId: "n_fireball",
            templateId: "TP_FLIGHT_PROJECTILE",
            role: "primary",
            tags: ["魔法", "投射物", "火焰"],
            capabilities: ["flightProjectile", "pierceCounter", "homing", "multishot", "split", "motionResource", "hitEvent", "expireEvent"],
            parameters: { count: 1, extraPierceCount: 0 },
            damageBasis: { baseRef: "hero.atk", coefficient: 1.4, inheritFactorKeys: ["coefficient", "count"] },
            hitPolicyId: "HP_MAIN_BOLT",
          },
        ],
        edges: [],
      },
      targetPolicyId: "TGT_NEAREST",
      castPolicyId: "CAST_COOLDOWN",
      rewardPoolIds: ["POOL_LEVELUP"],
    },
    SK_SHOCKWAVE: {
      id: "SK_SHOCKWAVE", nameKey: "skill.shockwave",
      levels: [
        { cooldown: 2.40, castTime: 0.15, coefficient: 1.10, radius: 110, life: 0.12 },
        { cooldown: 2.40, castTime: 0.15, coefficient: 1.22, radius: 120, life: 0.12 },
        { cooldown: 2.20, castTime: 0.12, coefficient: 1.35, radius: 130, life: 0.14 },
      ],
      baseGraph: {
        nodes: [
          {
            nodeId: "n_shockwave",
            templateId: "TP_INSTANT_AREA",
            role: "primary",
            tags: ["魔法", "范围", "技能"],
            capabilities: ["instantArea", "areaRadius", "hitEvent", "expireEvent"],
            parameters: { radius: 110 },
            damageBasis: { baseRef: "hero.atk", coefficient: 1.1, inheritFactorKeys: ["coefficient"] },
            hitPolicyId: "HP_INSTANT_AREA",
          },
        ],
        edges: [],
      },
      targetPolicyId: "TGT_NEAREST",
      castPolicyId: "CAST_COOLDOWN",
      rewardPoolIds: ["POOL_LEVELUP"],
    },
  },

  /* ---- 水晶定义（8 机制 + 1 通用增幅，v0.5 §7 表格）----
   * 注释中「适用」= eligibility；「操作」= operations；数值为占位，待策划平衡。*/
  crystalDefs: {
    /* 贯穿：增加额外贯穿目标数。适用：主/派生飞行弹；不改变环绕接触。*/
    CR_PIERCE: {
      id: "CR_PIERCE", nameKey: "crystal.pierce", qualityId: "Q_COMMON",
      eligibility: { read: "base", capabilitiesAny: ["flightProjectile"] },
      operations: [{
        id: "pierce.count", executor: "modifyParameter", phase: "nodeModify",
        selector: { read: "final", capabilitiesAll: ["pierceCounter"] },
        field: "extraPierceCount", parameter: "count", merge: "add",
      }],
      levels: [{ parameters: { count: 1 } }, { parameters: { count: 2 } }, { parameters: { count: 3 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.pierce", detailKey: "crystal.pierce.detail" },
    },
    /* 扇射：增加主效果数量、降低单体基准系数。适用：支持数量分布的主生成器。*/
    CR_MULTISHOT: {
      id: "CR_MULTISHOT", nameKey: "crystal.multishot", qualityId: "Q_RARE",
      eligibility: { read: "base", capabilitiesAny: ["multishot"] },
      operations: [
        {
          id: "multishot.count", executor: "modifyParameter", phase: "countDistribution",
          selector: { read: "final", capabilitiesAll: ["multishot"] },
          field: "count", parameter: "count", merge: "add",
        },
        {
          id: "multishot.less", executor: "modifyParameter", phase: "countDistribution",
          selector: { read: "final", capabilitiesAll: ["multishot"] },
          field: "coefficient", parameter: "lessMult", merge: "multiply",
        },
      ],
      levels: [{ parameters: { count: 1, lessMult: 0.80 } }, { parameters: { count: 2, lessMult: 0.72 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.multishot", detailKey: "crystal.multishot.detail" },
    },
    /* 追踪：主飞行弹持续转向索敌。适用：支持转向的主飞行弹；与环绕互斥（争主运动资源）。*/
    CR_HOMING: {
      id: "CR_HOMING", nameKey: "crystal.homing", qualityId: "Q_RARE",
      eligibility: { read: "base", capabilitiesAny: ["homing"] },
      operations: [{
        id: "homing.mode", executor: "structuralForm", phase: "mainForm",
        selector: { read: "base", capabilitiesAll: ["homing"] },
        field: "motionMode", value: "homing", merge: "exclusive",
      }],
      levels: [{ parameters: { turnRate: 3.0 } }, { parameters: { turnRate: 4.0 } }],
      conflicts: ["mainMotion"], hidden: false,
      presentation: { nameKey: "crystal.homing", detailKey: "crystal.homing.detail" },
    },
    /* 分裂：首次伤害命中产生小弹。适用：主投射物；小弹不再触发事件水晶。*/
    CR_SPLIT: {
      id: "CR_SPLIT", nameKey: "crystal.split", qualityId: "Q_EPIC",
      eligibility: { read: "base", capabilitiesAny: ["split"] },
      operations: [{
        id: "split.spawn", executor: "spawnTemplate", phase: "deriveTemplate",
        selector: { read: "final", capabilitiesAll: ["split"] },
        event: "onHit", spawnTemplateId: "TP_FLIGHT_PROJECTILE",
        parameter: "count", merge: "add", damageBasisRef: "parent",
        inheritFactors: ["coefficient"], routePolicyId: "EP_DERIVED_ONCE",
      }],
      levels: [{ parameters: { count: 2 } }, { parameters: { count: 3 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.split", detailKey: "crystal.split.detail" },
    },
    /* 爆破：主实体自然消失产生瞬时范围伤害。不由清理触发。*/
    CR_EXPLOSION: {
      id: "CR_EXPLOSION", nameKey: "crystal.explosion", qualityId: "Q_EPIC",
      eligibility: { read: "base", capabilitiesAny: ["expireEvent"] },
      operations: [{
        id: "explosion.spawn", executor: "spawnTemplate", phase: "deriveTemplate",
        selector: { read: "final", capabilitiesAll: ["expireEvent"] },
        event: "onExpire", spawnTemplateId: "TP_INSTANT_AREA",
        parameter: "damageRatio", merge: "multiply", damageBasisRef: "parent",
        inheritFactors: ["coefficient"], routePolicyId: "EP_DERIVED_ONCE",
      }],
      levels: [{ parameters: { damageRatio: 0.60 } }, { parameters: { damageRatio: 0.75 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.explosion", detailKey: "crystal.explosion.detail" },
    },
    /* 余焰：主实体自然消失产生持续区域。不另加瞬时伤害；重叠按最高 DPS。*/
    CR_AFTERFLAME: {
      id: "CR_AFTERFLAME", nameKey: "crystal.afterflame", qualityId: "Q_RARE",
      eligibility: { read: "base", capabilitiesAny: ["expireEvent"] },
      operations: [{
        id: "afterflame.spawn", executor: "spawnTemplate", phase: "deriveTemplate",
        selector: { read: "final", capabilitiesAll: ["expireEvent"] },
        event: "onExpire", spawnTemplateId: "TP_PERSISTENT_AREA",
        parameter: "damageRatio", merge: "multiply", damageBasisRef: "parent",
        inheritFactors: ["coefficient"], routePolicyId: "EP_DERIVED_ONCE",
      }],
      levels: [{ parameters: { damageRatio: 0.22 } }, { parameters: { damageRatio: 0.30 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.afterflame", detailKey: "crystal.afterflame.detail" },
    },
    /* 扩域：扩大最终图中的伤害范围半径（爆炸、火场）。read=final，可作用于派生出的范围节点。*/
    CR_EXPANSE: {
      id: "CR_EXPANSE", nameKey: "crystal.expanse", qualityId: "Q_COMMON",
      eligibility: { read: "final", capabilitiesAny: ["instantArea", "persistentArea"] },
      operations: [{
        id: "expanse.radius", executor: "modifyParameter", phase: "nodeModify",
        selector: { read: "final", capabilitiesAny: ["instantArea", "persistentArea"] },
        field: "radius", parameter: "radiusMul", merge: "multiply",
      }],
      levels: [{ parameters: { radiusMul: 1.20 } }, { parameters: { radiusMul: 1.35 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.expanse", detailKey: "crystal.expanse.detail" },
    },
    /* 环绕：主弹改为围绕英雄的接触实体。一批实体、共享目标间隔；与追踪互斥。*/
    CR_ORBIT: {
      id: "CR_ORBIT", nameKey: "crystal.orbit", qualityId: "Q_EPIC",
      eligibility: { read: "base", capabilitiesAny: ["motionResource"] },
      operations: [{
        id: "orbit.mode", executor: "structuralForm", phase: "mainForm",
        selector: { read: "base", capabilitiesAny: ["motionResource"] },
        field: "motionMode", value: "orbit", merge: "exclusive",
      }],
      levels: [{ parameters: { orbitCount: 3 } }, { parameters: { orbitCount: 4 } }],
      conflicts: ["mainMotion"], hidden: false,
      presentation: { nameKey: "crystal.orbit", detailKey: "crystal.orbit.detail" },
    },
    /* 通用魔法增幅：证明跨能力共享（同时辅助火球与震荡波），不扩大首轮正式内容承诺。*/
    CR_ARCANE_AMP: {
      id: "CR_ARCANE_AMP", nameKey: "crystal.arcaneAmp", qualityId: "Q_COMMON",
      eligibility: { read: "base", tagsAny: ["魔法"] },
      operations: [{
        id: "arcane.more", executor: "modifyParameter", phase: "nodeModify",
        selector: { read: "final", tagsAny: ["魔法"] },
        field: "moreDamageMul", parameter: "more", merge: "multiply",
      }],
      levels: [{ parameters: { more: 1.12 } }, { parameters: { more: 1.20 } }, { parameters: { more: 1.28 } }],
      conflicts: [], hidden: false,
      presentation: { nameKey: "crystal.arcaneAmp", detailKey: "crystal.arcaneAmp.detail" },
    },
  },

  /* ---- 品质定义（档数 = 数组长度，可扩到 100+；禁止代码写死档数）---- */
  qualityDefs: [
    { id: "Q_COMMON", nameKey: "quality.common", rank: 1, color: "#b8c4d0", weight: 60, placement: "common" },
    { id: "Q_RARE", nameKey: "quality.rare", rank: 2, color: "#4aa3ff", weight: 25, placement: "rare" },
    { id: "Q_EPIC", nameKey: "quality.epic", rank: 3, color: "#a05cff", weight: 12, placement: "epic" },
    { id: "Q_LEGEND", nameKey: "quality.legend", rank: 4, color: "#ffb545", weight: 3, placement: "legend" },
  ],

  /* ---- 奖励池（只控来源与权重，不控辅助对象）---- */
  rewardPools: {
    POOL_LEVELUP: {
      id: "POOL_LEVELUP", nameKey: "pool.levelup",
      entries: [
        { crystalId: "CR_PIERCE", weight: 10, minLevel: 1 },
        { crystalId: "CR_MULTISHOT", weight: 10, minLevel: 1 },
        { crystalId: "CR_HOMING", weight: 8, minLevel: 1 },
        { crystalId: "CR_SPLIT", weight: 8, minLevel: 1 },
        { crystalId: "CR_EXPLOSION", weight: 8, minLevel: 1 },
        { crystalId: "CR_AFTERFLAME", weight: 8, minLevel: 1 },
        { crystalId: "CR_EXPANSE", weight: 8, minLevel: 1 },
        { crystalId: "CR_ORBIT", weight: 8, minLevel: 1 },
        { crystalId: "CR_ARCANE_AMP", weight: 12, minLevel: 1 },
      ],
    },
  },

  /* ---- 奖励策略（雕像概率/选项数/兜底均为参数，不硬编码在场景对象）---- */
  rewardPolicies: {
    RP_LEVELUP: { id: "RP_LEVELUP", source: "levelup", optionCount: 3, weights: {}, fallback: "attribute", dedupeBy: "id" },
    RP_STATUE: { id: "RP_STATUE", source: "statue", optionCount: 1, weights: {}, fallback: "attribute", dedupeBy: "id" },
  },

  /* ---- 装配/升级合法性规则（不可拆用途保护等，v0.5 §3）---- */
  supportGroupRules: {
    slotCount: 4,
    cannotUnequip: true,
    upgradeBySameId: true,
    requireNewGain: true,
    protectExistingUsage: true,
    qualityCountFromArray: true,
  },

  /* ---- 命中额度策略（合同 §10 / v0.5 §5 冻结）---- */
  hitPolicies: {
    HP_MAIN_BOLT: { id: "HP_MAIN_BOLT", scope: "cast+mainGroup+target", keyTemplate: "castId+mainGroup+targetId", limitPerTarget: 1 },
    HP_SPLIT_CHILD: { id: "HP_SPLIT_CHILD", scope: "cast+derivedTemplate+target", keyTemplate: "castId+derivedGroup+targetId", limitPerTarget: 1, excludeBornTarget: true },
    HP_EXPLOSION: { id: "HP_EXPLOSION", scope: "cast+explosionTemplate+target", keyTemplate: "castId+explosionGroup+targetId", limitPerTarget: 1 },
    HP_INSTANT_AREA: { id: "HP_INSTANT_AREA", scope: "cast+areaTemplate+target", keyTemplate: "castId+instantAreaGroup+targetId", limitPerTarget: 1 },
    HP_ORBIT_CONTACT: { id: "HP_ORBIT_CONTACT", scope: "owner+skill+contactTemplate+target", keyTemplate: "ownerId+skillId+contactGroup+targetId", limitPerTarget: 1, sharedIntervalField: "nextAllowedHitTime" },
    HP_PERSISTENT_REGION: { id: "HP_PERSISTENT_REGION", scope: "owner+skill+regionGroup+target", keyTemplate: "ownerId+skillId+regionGroup", limitPerTarget: 1, mode: "maxDps" },
  },

  /* ---- 持续区域重叠策略（最高有效 DPS，共享结算时钟）---- */
  stackPolicies: {
    SP_REGION_MAX_DPS: { id: "SP_REGION_MAX_DPS", mode: "maxDps", sharedClock: true },
  },

  /* ---- 事件路由策略（来源白名单/允许操作/深度/次数/预算/终止条件，全部必填）---- */
  eventPolicies: {
    EP_DERIVED_ONCE: {
      id: "EP_DERIVED_ONCE",
      sourceWhitelist: ["TP_FLIGHT_PROJECTILE", "TP_INSTANT_AREA", "TP_PERSISTENT_AREA"],
      allowedOps: ["spawnTemplate"],
      maxDepth: 2, maxCount: 4, perCastBudget: 8,
      terminateCond: "derivedCount>=maxCount",
    },
  },

  /* ---- 预算策略（每施放/每英雄上限，全部进配置）---- */
  budgetPolicies: {
    BP_DEFAULT: {
      id: "BP_DEFAULT",
      maxEffectsPerHero: 240, maxEffectsPerCast: 64, maxDerivedPerEvent: 16,
      maxEventDepth: 2, maxEventPerStep: 256, overloadPolicy: "reject",
    },
  },

  /* ---- 索敌策略（最近有效敌人，距离相同按稳定目标 ID）---- */
  targetPolicies: {
    TGT_NEAREST: { id: "TGT_NEAREST", mode: "nearest", maxRange: 520, tieBreak: "stableId" },
  },

  /* ---- 施放策略（无目标保持就绪，不消耗冷却；环绕类无目标可施放）---- */
  castPolicies: {
    CAST_COOLDOWN: { id: "CAST_COOLDOWN", requiresTarget: true, trigger: "cooldown" },
    CAST_ORBIT: { id: "CAST_ORBIT", requiresTarget: false, trigger: "cooldown" },
  },

  /* ---- 旧模块 → 水晶 逐项映射（合同 §14；需人工审核，不按名称相似自动匹配）---- */
  migrationMaps: {},

  /* ---- 文案表（键 → 中文；不得含占位符）---- */
  localization: {
    "skill.fireball": "火球",
    "skill.shockwave": "震荡波",
    "template.flightProjectile": "飞行弹模板",
    "template.orbitContact": "环绕接触模板",
    "template.instantArea": "瞬时范围模板",
    "template.persistentArea": "持续区域模板",
    "pool.levelup": "升级奖励池",
    "quality.common": "普通",
    "quality.rare": "稀有",
    "quality.epic": "史诗",
    "quality.legend": "传说",
    "crystal.pierce": "贯穿",
    "crystal.pierce.detail": "为具备贯穿计数的主/派生飞行弹增加额外贯穿目标数，不改变环绕接触。",
    "crystal.multishot": "扇射",
    "crystal.multishot.detail": "增加主效果数量并降低单体基准系数，飞行呈扇形分布，不增加分裂数量。",
    "crystal.homing": "追踪",
    "crystal.homing.detail": "主飞行弹持续转向索敌；与环绕互斥，两者争用主运动资源。",
    "crystal.split": "分裂",
    "crystal.split.detail": "主投射物首次伤害命中产生小弹；小弹不再触发事件水晶。",
    "crystal.explosion": "爆破",
    "crystal.explosion.detail": "主实体自然消失时产生瞬时范围伤害；不由场景清理触发。",
    "crystal.afterflame": "余焰",
    "crystal.afterflame.detail": "主实体自然消失时产生持续区域，不另加瞬时伤害；重叠按最高 DPS 结算。",
    "crystal.expanse": "扩域",
    "crystal.expanse.detail": "扩大最终图中的伤害范围半径，不改弹体、扇角、索敌或环绕距离。",
    "crystal.orbit": "环绕",
    "crystal.orbit.detail": "主弹改为围绕英雄的接触实体；一批实体共享目标间隔，与追踪互斥。",
    "crystal.arcaneAmp": "奥术增幅",
    "crystal.arcaneAmp.detail": "通用魔法伤害增幅，可共享辅助多个魔法技能，只占一个槽位。",
  },
