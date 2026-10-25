/* 无头测试：SkillSave 存档迁移（node skill_save_test.js）
 * 覆盖合同 §14/§17：serialize→migrate 往返；未知 ID / 等级越界 / 冲突组合有报告且原数据保留；
 * 重复迁移不重复补偿；configVersion 不匹配被标记；saveTo/loadFrom 只动 Meta.data.skillSystem。 */
"use strict";

/* Meta 桩（模块用 typeof Meta 守卫；补齐 data 字段） */
global.Meta = {
  data: { crystals: 3, heroes: { H001: { level: 5 } }, unlockedLevels: 2 },
  commit() { this._committed = true; },
};

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-save.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  let passCount = 0, failCount = 0;
  const check = (name, cond) => { if (cond) { passCount++; console.log("PASS " + name); } else { failCount++; console.log("FAIL " + name); } };
  const R = SKILL_REASON;
  const J = (o) => JSON.stringify(o);
  CFG.skillSystem.configVersion = "skill-test-1.0";

  /* 目标配置表（新表）*/
  const defs = {
    configVersion: "skill-test-1.0",
    crystalDefs: { CR_A: { id: "CR_A", levels: [{}, {}] }, CR_B: { id: "CR_B", levels: [{}, {}] },
      CR_C: { id: "CR_C", levels: [{}, {}] }, CR_D: { id: "CR_D", levels: [{}, {}] } },
    skillDefs: {},
    slotCount: 4,
    migrationMaps: { crystals: { CR_LEGACY: "CR_A" } },
    supportGroupRules: { motionConflictGroups: [["CR_A", "CR_B"]] },
  };

  /* ============ 一、serialize → migrate 往返（干净存档）============ */
  {
    const clean = { heroId: "H001", slotCount: 4, groupVersion: 2,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 3, cd: 1.2, cdLeft: 0.4 } },
      crystals: [ { crystalId: "CR_C", level: 1, slot: 0 }, { crystalId: "CR_D", level: 2, slot: 1 } ] };
    const saved = SkillSave.serialize(clean);
    check("序列化-schemaVersion / configVersion 齐备", saved.schemaVersion === 2 && saved.configVersion === "skill-test-1.0");
    check("序列化-含每英雄技能与水晶/等级/冷却/槽位",
      saved.heroes.H001.skills.SK_FIREBALL.cdLeft === 0.4 && saved.heroes.H001.crystals.length === 2);
    const m = SkillSave.migrate(saved, defs);
    check("迁移-往返后水晶数一致", m.state.heroes.H001.crystals.length === 2);
    check("迁移-干净存档无未知/越界/冲突", m.report.unknownIds.length === 0 && m.report.levelOverflow.length === 0 && m.report.conflicts.length === 0);
    check("迁移-保留原始存档（preservedOriginal 原样）", J(m.preservedOriginal) === J(saved));
  }

  /* ============ 二、未知 ID / 等级越界 / 冲突旧组合：有报告且原数据保留 ============ */
  {
    const legacy = {
      schemaVersion: 1, configVersion: "skill-old-0.5",
      heroes: { H001: { heroId: "H001", slotCount: 4, groupVersion: 2,
        skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1, cd: 1, cdLeft: 0.3 } },
        crystals: [
          { crystalId: "CR_A", level: 9, slot: 0 },        // 旧九级 > 新表 2 级
          { crystalId: "CR_LEGACY", level: 1, slot: 1 },   // 走映射 → CR_A（重复）
          { crystalId: "CR_B", level: 1, slot: 2 },
          { crystalId: "CR_GONE", level: 1, slot: 3 },     // 未知 ID
        ],
        rewardTransactions: { RW1: { rewardId: "RW1", heroId: "H001", groupVersion: 2, randomState: 12345, options: [], committed: false, status: "OPEN" } },
      } },
    };
    const m = SkillSave.migrate(legacy, defs);
    const out = m.state.heroes.H001;

    check("报告-未知 ID 被记录", m.report.unknownIds.length === 1 && m.report.unknownIds[0].crystalId === "CR_GONE");
    check("报告-等级越界被记录（9 > 2）", m.report.levelOverflow.length === 1 && m.report.levelOverflow[0].originalLevel === 9 && m.report.levelOverflow[0].maxLevel === 2);
    check("报告-映射逐项生效（CR_LEGACY → CR_A）", m.report.migrated.some(x => x.from === "CR_LEGACY" && x.to === "CR_A"));
    check("报告-冲突旧组合被记录（重复 CR_A + 形态互斥）",
      m.report.conflicts.some(c => c.type === "DUPLICATE_CRYSTAL") && m.report.conflicts.some(c => c.type === R.MOTION_CONFLICT));

    check("保留-未知 ID 水晶原样保留在输出", out.crystals.some(c => c.crystalId === "CR_GONE" && c.unknown === true));
    check("保留-等级越界水晶原值 9 未被截断", out.crystals.some(c => c.crystalId === "CR_A" && c.level === 9));
    check("保留-奖励事务与随机状态随存档保留", out.rewardTransactions.RW1 && out.rewardTransactions.RW1.randomState === 12345);
    check("保留-原始存档完整备份（含被保留的未知资产）",
      m.preservedOriginal.heroes.H001.crystals.some(c => c.crystalId === "CR_GONE" && c.level === 1));
    check("保留-未静默删除资产（输出水晶数 = 输入 4）", out.crystals.length === 4);
  }

  /* ============ 三、重复迁移不重复补偿（幂等）============ */
  {
    const legacy = { schemaVersion: 1, configVersion: "skill-test-1.0",
      heroes: { H001: { heroId: "H001", slotCount: 4, crystals: [ { crystalId: "CR_LEGACY", level: 1, slot: 0 } ] } } };
    const m1 = SkillSave.migrate(legacy, defs);
    check("幂等-首次迁移有 1 条 compensated（CR_LEGACY→CR_A）", m1.report.migrated.length === 1);
    const m2 = SkillSave.migrate(m1.state, defs);
    check("幂等-二次迁移标记 alreadyMigrated", m2.report.alreadyMigrated === true);
    check("幂等-二次迁移不再重复补偿", m2.report.migrated.length === 0);
    check("幂等-二次迁移输出与首次一致", J(m2.state.heroes.H001.crystals) === J(m1.state.heroes.H001.crystals));
  }

  /* ============ 四、configVersion 不匹配被标记 ============ */
  {
    const legacy = { schemaVersion: 1, configVersion: "skill-old-0.5", heroes: { H001: { heroId: "H001", crystals: [ { crystalId: "CR_A", level: 1, slot: 0 } ] } } };
    const m = SkillSave.migrate(legacy, defs);
    check("版本-configVersionMismatch 置位", m.report.configVersionMismatch === true);
    check("版本-给出原因标记（不得把新表直接套到旧实体快照）",
      m.report.notes.some(n => n.code === R.NOT_MIGRATED && String(n.message).indexOf("configVersion 不匹配") >= 0));
    check("版本-仍按映射逐项翻译并保留原值", m.state.heroes.H001.crystals[0].crystalId === "CR_A");
  }

  /* ============ 五、saveTo / loadFrom 只动 Meta.data.skillSystem ============ */
  {
    const beforeCrystals = Meta.data.crystals, beforeHeroes = J(Meta.data.heroes), beforeCount = Object.keys(Meta.data).length;
    const clean = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1, cd: 1, cdLeft: 0 } },
      crystals: [ { crystalId: "CR_A", level: 1, slot: 0 } ] };
    const ok = SkillSave.saveTo(Meta, clean);
    check("存档-saveTo 返回 true", ok === true);
    check("存档-Meta.data.skillSystem 被写入", !!(Meta.data.skillSystem && Meta.data.skillSystem.heroes.H001));
    check("存档-Meta 其它字段未被改动（crystals / heroes）",
      Meta.data.crystals === beforeCrystals && J(Meta.data.heroes) === beforeHeroes);
    check("存档-新增字段仅 skillSystem（键数 +1）",
      Object.keys(Meta.data).length === beforeCount + 1 && !!Meta.data.skillSystem);
    const loaded = SkillSave.loadFrom(Meta);
    check("读档-loadFrom 深拷贝返回且内容一致", J(loaded) === J(Meta.data.skillSystem));
    check("读档-loadFrom 返回独立副本（改副本不污染 Meta）", (function () { loaded.heroes.H001.crystals[0].level = 99; return Meta.data.skillSystem.heroes.H001.crystals[0].level === 1; })());
    // 无 state 参数时使用最近一次 serialize 结果
    SkillSave.serialize(clean);
    const ok2 = SkillSave.saveTo(Meta);
    check("存档-saveTo(Meta) 无参复用最近序列化结果", ok2 === true && Meta.data.skillSystem.schemaVersion === 2);
    // 入参守卫（meta 结构缺失时安全返回，不抛异常）
    check("守卫-meta 无 data 时 saveTo 返回 false", SkillSave.saveTo({}, clean) === false);
    check("守卫-meta 无 data 时 loadFrom 返回 null", SkillSave.loadFrom({}) === null);
  }

  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  if (failCount > 0) throw new Error("skill_save_test 失败数 " + failCount);
`;
vm.runInContext(driver, ctx, { filename: "driver" });
