/* 无头测试：SkillPresenter 呈现层（node skill_presenter_test.js）
 * 覆盖合同 §13/§17：panel/matrix/detail 结构正确；隐藏标签不进汇总但代价仍显示；
 * 原因码→中文映射；占位符缺失被检出；**不依赖水晶名字**（nameKey 改乱码适用判定不变）。 */
"use strict";

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext({ console });
for (const f of ["js/config.js", "js/core.js", "mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-presenter.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  let passCount = 0, failCount = 0;
  const check = (name, cond) => { if (cond) { passCount++; console.log("PASS " + name); } else { failCount++; console.log("FAIL " + name); } };

  const SS = CFG.skillSystem;
  SS.qualityDefs = [
    { id: "Q_COMMON", nameKey: "q.common", color: "#9aa" },
    { id: "Q_RARE", nameKey: "q.rare", color: "#f0a" },
  ];
  SS.crystalDefs = {
    CR_PIERCE: { id: "CR_PIERCE", qualityId: "Q_COMMON",
      presentation: { nameKey: "crystal.pierce", detailTitleKey: "crystal.pierce.detail", summaryTagKey: "tag.pierce" },
      cost: { damageMul: 0.9 }, limits: ["仅飞行弹"], eventLimits: ["不作用于派生节点"], conflicts: [] },
    CR_ORBIT: { id: "CR_ORBIT", qualityId: "Q_RARE",
      presentation: { nameKey: "crystal.orbit", detailTitleKey: "crystal.orbit.detail", summaryTagKey: "tag.orbit", hidden: true },
      cost: { moveSpeedMul: 0.85 }, negative: { damageMul: 0.7 }, limits: ["不可与追踪同技能"] },
  };
  SS.skillDefs = {
    SK_FIREBALL: { id: "SK_FIREBALL", presentation: { nameKey: "skill.fireball" } },
    SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", presentation: { nameKey: "skill.shockwave" } },
  };
  SS.localization = {
    "crystal.pierce": "贯穿", "crystal.orbit": "环绕",
    "q.common": "普通", "q.rare": "稀有",
    "tag.pierce": "穿透标签", "tag.orbit": "环绕标签",
    "skill.fireball": "火球", "skill.shockwave": "震荡波",
    "reason.MOTION_CONFLICT": "形态互斥（中文）",
  };

  /* 编译解释结果桩（呈现层只消费它，不重算） */
  const build = {
    ok: true, configVersion: "x", skills: { SK_FIREBALL: {}, SK_SHOCKWAVE: {} },
    explanations: [
      { crystalId: "CR_PIERCE", skillId: "SK_FIREBALL", status: "applied", nodes: [{ opId: "op1" }], before: { extraPierceCount: 0 }, after: { extraPierceCount: 1 }, reasonCodes: [] },
      { crystalId: "CR_PIERCE", skillId: "SK_SHOCKWAVE", status: "inactive", nodes: [], reasonCodes: ["INACTIVE_OPERATION"] },
      { crystalId: "CR_ORBIT", skillId: "SK_FIREBALL", status: "conflict", nodes: [{ opId: "op2" }], reasonCodes: ["MOTION_CONFLICT"] },
    ],
    diagnostics: [],
  };
  const state = {
    heroId: "H001", slotCount: 4, groupVersion: 3,
    skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 2, cd: 1.2, cdLeft: 0.4 },
              SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1, cd: 3, cdLeft: 0 } },
    crystals: [ { crystalId: "CR_PIERCE", level: 1, slot: 0 }, { crystalId: "CR_ORBIT", level: 1, slot: 1 } ],
  };

  /* ============ 一、panel / matrix 结构 ============ */
  {
    const p = SkillPresenter.panel(state, "H001", build);
    check("面板-技能列表 2 条（两技能）", p.skills.length === 2);
    check("面板-技能带等级与冷却", p.skills.some(s => s.skillId === "SK_FIREBALL" && s.level === 2 && s.cd === 1.2));
    check("面板-四槽（含空槽）", p.slots.length === 4 && p.slots[2].crystalId === null);
    const s0 = p.slots.find(s => s.slot === 0);
    check("面板-槽 0 = 贯穿（name 来自配置）", s0.crystalId === "CR_PIERCE" && s0.name === "贯穿");
    check("面板-槽 0 品质对象齐备", s0.quality && s0.quality.id === "Q_COMMON" && s0.quality.name === "普通");
    check("面板-实际辅助对象 targets 来自解释（火球 applied / 震荡波 inactive）",
      s0.targets.find(t => t.skillId === "SK_FIREBALL").status === "applied" &&
      s0.targets.find(t => t.skillId === "SK_SHOCKWAVE").status === "inactive");
    check("面板-matrix 两行（两技能）", p.matrix.length === 2);
    const rowF = p.matrix.find(r => r.skillId === "SK_FIREBALL");
    check("面板-matrix 火球 × 贯穿 = applied", rowF.crystals.find(c => c.crystalId === "CR_PIERCE").status === "applied");
    check("面板-matrix 火球 × 环绕 = conflict", rowF.crystals.find(c => c.crystalId === "CR_ORBIT").status === "conflict");
  }

  /* ============ 二、隐藏汇总标签不进汇总，但代价仍在详情显示 ============ */
  {
    const p = SkillPresenter.panel(state, "H001", build);
    const visibleTags = p.notices.filter(n => n.kind === "summaryTag" && n.hidden === false).map(n => n.crystalId);
    check("汇总-可见标签含贯穿", visibleTags.indexOf("CR_PIERCE") >= 0);
    check("汇总-隐藏标签（环绕）不进可见汇总", visibleTags.indexOf("CR_ORBIT") < 0);
    check("汇总-隐藏标签标记 hidden:true 仍保留记录", p.notices.some(n => n.crystalId === "CR_ORBIT" && n.hidden === true));

    const d = SkillPresenter.detail("CR_ORBIT", "H001", build);
    check("详情-隐藏汇总标签不隐藏代价（代价 + 负面系数均显示）",
      d.text.indexOf("代价") >= 0 && d.text.indexOf("moveSpeedMul 0.85") >= 0 &&
      d.text.indexOf("负面系数") >= 0 && d.text.indexOf("damageMul 0.7") >= 0);
    check("详情-隐藏标记外显（hiddenSummary=true）", d.hiddenSummary === true);
    check("详情-装配页固定文案：不可卸载 / 占槽",
      d.text.indexOf("不可卸载") >= 0 && d.text.indexOf("占用 1 个") >= 0);
    check("详情-必含限制 / 事件限制栏目", d.text.indexOf("限制") >= 0);
  }

  /* ============ 三、详情：两技能收益 / 升级参数变化 / 原因码 ============ */
  {
    const d = SkillPresenter.detail("CR_PIERCE", "H001", build);
    check("详情-火球生效 + 参数变化（0 → 1）",
      d.text.indexOf("火球") >= 0 && d.text.indexOf("0 → 1") >= 0);
    check("详情-震荡波不适用（INACTIVE_OPERATION 映射中文）", d.text.indexOf("不适用") >= 0);
    check("详情-不适用原因码保留", d.reasonCodes.indexOf("INACTIVE_OPERATION") >= 0);
    check("详情-事件限制栏目显示", d.text.indexOf("事件限制") >= 0);
    // 不在任何解释中的水晶 → 不适用原因（不靠名字）
    const d2 = SkillPresenter.detail("CR_UNKNOWN", "H001", build);
    check("详情-未参与解释 → 记 INACTIVE_OPERATION", d2.reasonCodes.indexOf("INACTIVE_OPERATION") >= 0);
  }

  /* ============ 四、原因码 → 中文映射 ============ */
  {
    check("原因码-配置优先（MOTION_CONFLICT → 形态互斥（中文））",
      SkillPresenter._reasonText("MOTION_CONFLICT") === "形态互斥（中文）");
    check("原因码-缺失回落内置中文（SLOTS_FULL → 槽位已满）",
      SkillPresenter._reasonText("SLOTS_FULL") === "槽位已满");
    check("原因码-未知码回落原码（非空）", SkillPresenter._reasonText("WHATEVER") === "WHATEVER");
  }

  /* ============ 五、assembleText 纯函数 + 占位符缺失检测 ============ */
  {
    const r = SkillPresenter.assembleText("伤害 {value}，冷却 {cd}，等级 {lv}", { value: 5, lv: 2 });
    check("占位符-正常替换", r.text === "伤害 5，冷却 ，等级 2");
    check("占位符-缺失被检出（cd）", r.missing.length === 1 && r.missing[0] === "cd");
    const r2 = SkillPresenter.assembleText("无占位符", {});
    check("占位符-无占位符 missing 为空", r2.missing.length === 0 && r2.text === "无占位符");
  }

  /* ============ 六、★防回归：不依赖水晶名字（nameKey 改乱码，适用判定不变）============ */
  {
    const before = SkillPresenter.panel(state, "H001", build);
    const st0 = before.slots.find(s => s.slot === 0);
    const st0Before = st0.targets.map(t => t.skillId + "=" + t.status).join("|");
    const nameBefore = st0.name;
    // 把 nameKey 改成乱码（显示名变化）
    SS.crystalDefs.CR_PIERCE.presentation.nameKey = "###GARBAGE###";
    SS.crystalDefs.CR_ORBIT.presentation.nameKey = "@@@乱码@@@";
    const after = SkillPresenter.panel(state, "H001", build);
    const st0After = after.slots.find(s => s.slot === 0);
    const st0AfterSig = st0After.targets.map(t => t.skillId + "=" + t.status).join("|");
    check("★防回归-nameKey 改乱码后显示名确实变化", st0After.name !== nameBefore && st0After.name === "CR_PIERCE");
    check("★防回归-适用判定完全不变（不依赖名字）", st0AfterSig === st0Before && st0AfterSig === "SK_FIREBALL=applied|SK_SHOCKWAVE=inactive");
    const rowF = after.matrix.find(r => r.skillId === "SK_FIREBALL");
    check("★防回归-矩阵状态同样不变", rowF.crystals.find(c => c.crystalId === "CR_PIERCE").status === "applied");
    // 还原
    SS.crystalDefs.CR_PIERCE.presentation.nameKey = "crystal.pierce";
    SS.crystalDefs.CR_ORBIT.presentation.nameKey = "crystal.orbit";
  }

  /* ============ 七、explain 直接消费，不重算 ============ */
  {
    const e = SkillPresenter.explain(build);
    check("解释-透传 explanations（3 条）", e.explanations.length === 3);
    check("解释-透传 diagnostics", Array.isArray(e.diagnostics));
    check("解释-对象引用一致（不重算不复制）", e.explanations === build.explanations);
  }

  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  if (failCount > 0) throw new Error("skill_presenter_test 失败数 " + failCount);
`;
vm.runInContext(driver, ctx, { filename: "driver" });
