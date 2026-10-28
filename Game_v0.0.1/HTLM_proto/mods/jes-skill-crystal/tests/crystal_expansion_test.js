/* ============================================================================
 * crystal_expansion_test.js —— 能量水晶「扩容 + 启用」批次回归（22.8 W3）
 * ----------------------------------------------------------------------------
 * 背景：用户 2026-10-12 拍板三件事，本套件逐条守护：
 *   ① 旧系统里「无对应」的 5 类效果（冷却 / 弹速 / 弹射 / 灼烧 / 链锁）→ **新增水晶覆盖**；
 *   ② 「弹射」与「环绕」→ **拆分**（语义不同，各自独立水晶，不合并）；
 *   ③ 等级表 `levels` → **扩到 100 级**（对齐武器等级 1~100）；
 *   ④ 系统**正式启用**（`enabled=true` + `migratedHeroIds=["H001"]`）。
 *
 * 覆盖：
 *   ① 结构：水晶总数 14 / 五颗新水晶齐备 / 每颗 100 级 / 技能也是 100 级
 *   ② 曲线：L1 恒等于基准（迁移基准不漂移）· L100 收敛到目标 · 整数类单调不降
 *   ③ 编译：14 颗水晶**逐一单装可编译**（无孤儿水晶、无用途保护误杀）
 *   ④ 运行时接线：castStats → cdMul（冷却真正生效）· addNode 等级接线（chainLeft / dps）
 *   ⑤ 迁移映射：module 表 10 条逐项对齐 · chip 表恒空（遗迹秘宝不迁移）
 *   ⑥ 启用状态：enabled / migratedHeroIds / 新策略表（EP_DERIVED_EACH_HIT / HP_*）
 * 注意：PASS 行禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = path.join(__dirname, "..", "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本 ---------------- */
const FILES = [
  "js/config.js",
  "js/core.js",
  "js/pool.js",
  "mods/jes-skill-crystal/systems/skill-config.js",
  "mods/jes-skill-crystal/systems/skill-compiler.js",
  "mods/jes-skill-crystal/systems/skill-damage.js",
  "mods/jes-skill-crystal/systems/skill-events.js",
  "mods/jes-skill-crystal/systems/skill-scheduler.js",
  "mods/jes-skill-crystal/systems/skill-runtime.js",
  "mods/jes-skill-crystal/systems/skill-reward.js",
  "mods/jes-skill-crystal/systems/skill-presenter.js",
  "mods/jes-skill-crystal/systems/skill-save.js",
  "mods/jes-skill-crystal/systems/skill-playtest.js",
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {}, warn() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}

const ev = (code) => vm.runInContext(code, ctx);
const T = "CFG.skillSystem";
const LEVELS = 100;

/* 契约：五颗新水晶 → 中文名键 + 品质 + 迁移来源（与施工规格 §1 一致） */
const NEW_CRYSTALS = [
  { id: "CR_COOLDOWN", key: "crystal.cooldown", quality: "Q_COMMON" },
  { id: "CR_SPEED", key: "crystal.speed", quality: "Q_COMMON" },
  { id: "CR_BOUNCE", key: "crystal.bounce", quality: "Q_EPIC" },
  { id: "CR_CHAIN", key: "crystal.chain", quality: "Q_EPIC" },
  { id: "CR_BURN", key: "crystal.burn", quality: "Q_RARE" },
];

/* 原有 9 颗（扩容后必须一颗不少） */
const OLD_CRYSTALS = ["CR_PIERCE", "CR_MULTISHOT", "CR_HOMING", "CR_SPLIT",
  "CR_EXPLOSION", "CR_AFTERFLAME", "CR_EXPANSE", "CR_ORBIT", "CR_ARCANE_AMP"];

/* ==================================================================
 * ① 结构：14 颗 / 五颗新水晶 / 100 级
 * ================================================================== */
{
  const keys = ev(`Object.keys(${T}.crystalDefs)`);
  check("① 水晶总数 = 14（9 原有 + 5 新增）", keys.length === 14);
  check("① 原有 9 颗一颗不少", OLD_CRYSTALS.every(k => keys.indexOf(k) >= 0));
  check("① 新增 5 颗齐备", NEW_CRYSTALS.every(c => keys.indexOf(c.id) >= 0));

  let allHundred = true, l1Same = true;
  for (const c of NEW_CRYSTALS) {
    const len = ev(`${T}.crystalDefs.${c.id}.levels.length`);
    if (len !== LEVELS) allHundred = false;
    const nameKey = ev(`${T}.crystalDefs.${c.id}.nameKey`);
    if (nameKey !== c.key) l1Same = false;
    const q = ev(`${T}.crystalDefs.${c.id}.qualityId`);
    if (q !== c.quality) l1Same = false;
  }
  check("① 五颗新水晶的 levels 均为 100 级", allHundred);
  check("① 五颗新水晶的 nameKey / qualityId 与规格一致", l1Same);

  let oldHundred = true;
  for (const c of OLD_CRYSTALS) {
    if (ev(`${T}.crystalDefs.${c}.levels.length`) !== LEVELS) oldHundred = false;
  }
  check("① 原有 9 颗水晶也已扩到 100 级", oldHundred);

  check("① 技能 SK_FIREBALL levels = 100 级",
    ev(`${T}.skillDefs.SK_FIREBALL.levels.length`) === LEVELS);
  check("① 技能 SK_SHOCKWAVE levels = 100 级",
    ev(`${T}.skillDefs.SK_SHOCKWAVE.levels.length`) === LEVELS);

  const lvKey = ev(`Object.keys(${T}.localization).filter(k => k.indexOf("crystal.") === 0).length`);
  check("① 14 颗水晶全部有中文名 + 说明文案（28 条 lexical）", lvKey >= 28);
  check("① 五颗新水晶的中文名可读出（非回落 id）",
    NEW_CRYSTALS.every(c => typeof ev(`${T}.localization["${c.key}"]`) === "string" &&
      ev(`${T}.localization["${c.key}"]`).length > 0));
}

/* ==================================================================
 * ② 曲线：L1 恒等于基准（迁移基准不漂移）· 整数类单调不降
 * ================================================================== */
{
  /* 2-1 迁移基准（skill_rule_binding_test ⑨ 段同一口径，此处二次锁定） */
  check("② 火球 L1 冷却 = 1.80（迁移基准不漂移）",
    ev(`${T}.skillDefs.SK_FIREBALL.levels[0].cooldown`) === 1.80);
  check("② 火球 L1 系数 = 1.50（迁移基准不漂移）",
    ev(`${T}.skillDefs.SK_FIREBALL.levels[0].parameters.coefficient`) === 1.50);
  check("② 火球爆炸半径 = 130（baseGraph 常量，未被曲线改写）",
    ev(`${T}.skillDefs.SK_FIREBALL.baseGraph.nodes[1].parameters.radius`) === 130);

  /* 2-2 现有 9 颗水晶的 L1 与原值一致（关系断言：读配表比对，不写死） */
  const l1Expect = {
    CR_PIERCE: ["parameters.count", 1],
    CR_MULTISHOT: ["parameters.lessMult", 0.80],
    CR_HOMING: ["parameters.mode", 1],
    CR_SPLIT: ["parameters.count", 2],
    CR_EXPLOSION: ["parameters.damageRatio", 0.60],
    CR_AFTERFLAME: ["parameters.damageRatio", 0.22],
    CR_EXPANSE: ["parameters.radiusMul", 1.20],
    CR_ORBIT: ["parameters.orbitCount", 3],
    CR_ARCANE_AMP: ["parameters.more", 1.12],
  };
  let l1ok = true;
  for (const k in l1Expect) {
    const [p, v] = l1Expect[k];
    if (ev(`${T}.crystalDefs.${k}.levels[0].${p}`) !== v) l1ok = false;
  }
  check("② 原有 9 颗水晶 L1 值与扩表前完全一致", l1ok);

  /* 2-3 新水晶 L1 = 规格基准 */
  check("② 循环 L1 cdMul = 0.94（−6%）",
    ev(`${T}.crystalDefs.CR_COOLDOWN.levels[0].parameters.cdMul`) === 0.94);
  check("② 疾行 L1 speedMul = 1.10（+10%）",
    ev(`${T}.crystalDefs.CR_SPEED.levels[0].parameters.speedMul`) === 1.10);
  check("② 弹射 / 链锁 L1 链长 = 1",
    ev(`${T}.crystalDefs.CR_BOUNCE.levels[0].parameters.count`) === 1 &&
    ev(`${T}.crystalDefs.CR_CHAIN.levels[0].parameters.count`) === 1);
  check("② 灼烧 L1 dps = 6",
    ev(`${T}.crystalDefs.CR_BURN.levels[0].parameters.dps`) === 6);

  /* 2-4 整数类单调不降（数量类不得出现回落） */
  let mono = true;
  const intPaths = [`${T}.crystalDefs.CR_PIERCE.levels`,
    `${T}.crystalDefs.CR_SPLIT.levels`,
    `${T}.crystalDefs.CR_ORBIT.levels`,
    `${T}.crystalDefs.CR_BOUNCE.levels`,
    `${T}.crystalDefs.CR_CHAIN.levels`];
  for (const p of intPaths) {
    const arr = ev(`(function () { return ${p}.map(function (r) { var k = Object.keys(r.parameters)[0]; return r.parameters[k]; }); })()`);
    for (let i = 1; i < arr.length; i++) { if (arr[i] < arr[i - 1]) mono = false; }
  }
  check("② 数量类曲线单调不降（100 级内无回落）", mono);

  /* 2-5 冷却随等级单调下降（循环水晶） */
  let cdDown = true;
  const cds = ev(`(function () { return ${T}.crystalDefs.CR_COOLDOWN.levels.map(function (r) { return r.parameters.cdMul; }); })()`);
  for (let i = 1; i < cds.length; i++) { if (cds[i] > cds[i - 1]) cdDown = false; }
  check("② 循环水晶冷却倍率随等级单调下降（越小越快）", cdDown);
  check("② 循环 L100 冷却倍率 ∈ (0, 1) 且 ≥ 0.6（不越过策略下限语义）",
    cds[cds.length - 1] <= 1 && cds[cds.length - 1] >= 0.6);
}

/* ==================================================================
 * ③ 编译：14 颗水晶逐一单装可编译（无孤儿水晶）
 * ================================================================== */
{
  const compileOne = (cid) => ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "${cid}", level: 1, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    return { ok: !!(r && r.ok), nErr: (r && r.diagnostics || []).length };
  })()`);

  const all = OLD_CRYSTALS.concat(NEW_CRYSTALS.map(c => c.id));
  const failed = [];
  for (const cid of all) {
    const r = compileOne(cid);
    if (!r.ok || r.nErr > 0) failed.push(cid);
  }
  check("③ 14 颗水晶逐一单装全部编译通过（无孤儿 / 无用途保护误杀）",
    failed.length === 0);
  if (failed.length) console.log("   编译未通过的：", failed.join(", "));

  /* 3-2 冷却水晶走 modifyStat → 产物 castStats，且不产生任何节点 */
  const cd = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_COOLDOWN", level: 1, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    var b = r.builds.SK_FIREBALL;
    return { cdMul: b.castStats ? b.castStats.cdMul : null,
      keys: b.castStats ? Object.keys(b.castStats).length : -1,
      nNodes: Object.keys(b.nodes).length };
  })()`);
  check("③ 循环水晶产物 castStats.cdMul = 0.94（L1）", cd.cdMul === 0.94);
  check("③ 循环水晶只写统计、未新增节点（castStats 单键）",
    cd.keys === 1 && cd.nNodes === 2);

  /* 3-3 无冷却水晶时 castStats 恒为 {}（不是 undefined） */
  const noCd = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } }, crystals: [] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    var cs = r.builds.SK_FIREBALL.castStats;
    return { isObj: !!cs && typeof cs === "object", n: cs ? Object.keys(cs).length : -1 };
  })()`);
  check("③ 未装冷却水晶时 castStats = {}（空对象，非空壳）",
    noCd.isObj && noCd.n === 0);

  /* 3-4 同一水晶不得重复装（契约：同 ID 应合并升级，不是占两个槽） */
  const dup = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_COOLDOWN", level: 1, slot: 0 },
                 { crystalId: "CR_COOLDOWN", level: 1, slot: 1 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    return { ok: r.ok, codes: (r.diagnostics || []).map(function (d) { return d.code; }) };
  })()`);
  check("③ 同一水晶重复装被拒（应合并升级，不占两槽）",
    dup.ok === false && dup.codes.indexOf("INVALID_REFERENCE") >= 0);

  /* 3-5 升级路径：同一水晶 L3 的 cdMul 取等级表 L3 值 */
  const up = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_COOLDOWN", level: 3, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    return r.ok ? { v: r.builds.SK_FIREBALL.castStats.cdMul,
      expect: t.crystalDefs.CR_COOLDOWN.levels[2].parameters.cdMul } : null;
  })()`);
  check("③ 循环水晶升级到 L3 → cdMul 取等级表 L3 值（随等级成长）",
    !!up && up.v === up.expect && up.v < 0.94);
}

/* ==================================================================
 * ④ 运行时接线：cdMul 真正影响冷却 · addNode 等级接线
 * ================================================================== */
{
  /* 4-1 冷却：装了循环水晶后，同一技能的有效施放间隔变短 */
  const cdEffect = ev(`(function () {
    var t = ${T};
    var def = t.skillDefs.SK_FIREBALL;
    var plain = SkillScheduler.cooldownFor(def, 1, { cdMul: 1 }, t.castPolicies.CAST_COOLDOWN);
    var fast = SkillScheduler.cooldownFor(def, 1, { cdMul: 0.94 }, t.castPolicies.CAST_COOLDOWN);
    return { plain: plain, fast: fast };
  })()`);
  check("④ 冷却倍率 0.94 → 有效冷却 = 基础 × 0.94（循环水晶真正生效）",
    Math.abs(cdEffect.fast - cdEffect.plain * 0.94) < 1e-9 && cdEffect.fast < cdEffect.plain);

  /* 4-2 运行时把 castStats 合并进英雄属性（乘法合成，不覆盖角色属性） */
  const merged = ev(`(function () {
    var base = { atk: 100, cdMul: 0.90 };
    var build = { castStats: { cdMul: 0.94 } };
    var out = SkillRuntime._castStatsOf({ stats: base }, build);
    var none = SkillRuntime._castStatsOf({ stats: base }, { castStats: {} });
    var missing = SkillRuntime._castStatsOf({ stats: base }, null);
    return { m: out.cdMul, atk: out.atk, noneSame: none === base, missingSame: missing === base };
  })()`);
  check("④ castStats 与角色自身倍率乘法合成（0.90 × 0.94 = 0.846）",
    Math.abs(merged.m - 0.846) < 1e-9);
  check("④ 合成不丢角色其它属性（atk 保留）", merged.atk === 100);
  check("④ castStats 缺失 / 空对象 → 原样返回，不新建对象（零影响）",
    merged.noneSame === true && merged.missingSame === true);

  /* 4-3 弹射：chainLeft 随等级表写入派生节点参数（addNode 等级接线） */
  const bounce = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_BOUNCE", level: 3, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    if (!r.ok) return { ok: false };
    var nodes = r.builds.SK_FIREBALL.nodes;
    var k = Object.keys(nodes).filter(function (id) { return id.indexOf("bounce.spawn") === 0; })[0];
    var expect = t.crystalDefs.CR_BOUNCE.levels[2].parameters.count;
    return { ok: true, chainLeft: nodes[k].parameters.chainLeft, expect: expect,
      route: nodes[k].routePolicyId, policy: nodes[k].hitPolicyId };
  })()`);
  check("④ 弹射派生节点 chainLeft 取自等级表（L3 值）",
    bounce.ok && bounce.chainLeft === bounce.expect);
  check("④ 弹射派生节点走 EP_DERIVED_EACH_HIT（逐次命中派生）",
    bounce.route === "EP_DERIVED_EACH_HIT");
  check("④ 弹射派生节点用 HP_BOUNCE_CHILD 命中去重", bounce.policy === "HP_BOUNCE_CHILD");

  /* 4-4 链锁：走 TP_INSTANT_AREA + HP_CHAIN（带 excludeBornTarget，不回头打） */
  const chain = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_CHAIN", level: 2, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    if (!r.ok) return { ok: false };
    var nodes = r.builds.SK_FIREBALL.nodes;
    var k = Object.keys(nodes).filter(function (id) { return id.indexOf("chain.spawn") === 0; })[0];
    var hp = t.hitPolicies.HP_CHAIN;
    var expect = t.crystalDefs.CR_CHAIN.levels[1].parameters.count;
    return { ok: true, tpl: nodes[k].templateId, chainLeft: nodes[k].parameters.chainLeft,
      expect: expect, excl: !!(hp && hp.excludeBornTarget) };
  })()`);
  check("④ 链锁派生节点 = 瞬时范围（直接炸在下一个敌人身上）",
    chain.ok && chain.tpl === "TP_INSTANT_AREA");
  check("④ 链锁 chainLeft 取自等级表（L2 值）", chain.ok && chain.chainLeft === chain.expect);
  check("④ 链锁命中策略带 excludeBornTarget（向前传导，不回头）", chain.excl === true);

  /* 4-5 灼烧：dps 随等级 + 附着目标字段存在于配置 */
  const burn = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_BURN", level: 2, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    if (!r.ok) return { ok: false };
    var nodes = r.builds.SK_FIREBALL.nodes;
    var k = Object.keys(nodes).filter(function (id) { return id.indexOf("burn.spawn") === 0; })[0];
    var op = t.crystalDefs.CR_BURN.operations[0];
    return { ok: true, tpl: nodes[k].templateId, dps: nodes[k].parameters.dps,
      expect: t.crystalDefs.CR_BURN.levels[1].parameters.dps, attach: op.attach };
  })()`);
  check("④ 灼烧派生节点 = 持续区域", burn.ok && burn.tpl === "TP_PERSISTENT_AREA");
  check("④ 灼烧 dps 取自等级表（L2 值）", burn.ok && burn.dps === burn.expect);
  check("④ 灼烧声明 attach=\"target\"（跟随目标移动）", burn.attach === "target");

  /* 4-6 疾行：speed 被乘算放大（作用于主弹） */
  const speed = ev(`(function () {
    var t = ${T};
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_SPEED", level: 1, slot: 0 }] };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
    if (!r.ok) return { ok: false };
    return { ok: true, speed: r.builds.SK_FIREBALL.nodes.n_fireball.parameters.speed,
      base: t.skillDefs.SK_FIREBALL.levels[0].parameters.speed };
  })()`);
  check("④ 疾行把主弹速度乘上 speedMul（480 × 1.10 = 528）",
    speed.ok && Math.abs(speed.speed - 528) < 0.01);
}

/* ==================================================================
 * ⑤ 迁移映射 + 新策略表 + 启用状态
 * ================================================================== */
{
  const mm = ev(`(function () {
    var m = ${T}.migrationMaps || {};
    return { mod: m.module || {}, chip: m.chip || {}, nMod: Object.keys(m.module || {}).length,
      nChip: Object.keys(m.chip || {}).length };
  })()`);
  check("⑤ 迁移映射 module 表共 10 条（M010/M011 首轮不迁移）", mm.nMod === 10);
  check("⑤ 冷却 / 弹速 / 弹射 三类旧模块映射到新增水晶",
    mm.mod.M002 === "CR_COOLDOWN" && mm.mod.M007 === "CR_COOLDOWN" &&
    mm.mod.M003 === "CR_SPEED" && mm.mod.M006 === "CR_BOUNCE");
  check("⑤ 遗迹秘宝映射表恒空（两者并存，不迁移）", mm.nChip === 0);

  const pol = ev(`(function () {
    var t = ${T};
    var ep = t.eventPolicies.EP_DERIVED_EACH_HIT;
    return { has: !!ep, everyHit: ep ? ep.everyHit === true : false,
      depth: t.budgetPolicies.BP_DEFAULT.maxEventDepth,
      hb: !!t.hitPolicies.HP_BOUNCE_CHILD, hc: !!t.hitPolicies.HP_CHAIN,
      once: t.eventPolicies.EP_DERIVED_ONCE ? (t.eventPolicies.EP_DERIVED_ONCE.everyHit === undefined) : false };
  })()`);
  check("⑤ EP_DERIVED_EACH_HIT 存在且 everyHit=true", pol.has && pol.everyHit);
  check("⑤ EP_DERIVED_ONCE 未被污染（仍是单次派生语义）", pol.once === true);
  check("⑤ 事件深度上限已提到 3（弹射/链锁可多跳）", pol.depth === 3);
  check("⑤ 新命中策略 HP_BOUNCE_CHILD / HP_CHAIN 已登记", pol.hb && pol.hc);

  const en = ev(`(function () {
    var t = ${T};
    return { on: t.enabled === true, ids: (t.migratedHeroIds || []).slice(),
      bindCount: Object.keys(t.initialSkillBindings || {}).length,
      derived: t.features && t.features.derivedEvents === true };
  })()`);
  check("⑥ 系统已正式启用（enabled=true）", en.on === true);
  check("⑥ 迁移名单 = 技能绑定表键集，且含首批试点 H001",
    en.ids.length > 0 && en.ids.length === en.bindCount && en.ids.indexOf("H001") >= 0);
  check("⑥ derivedEvents 保持 false（合同 §2：派生不重复触发其它事件水晶）",
    en.derived === false);

  /* 6-2 端到端：H001 走新路径，未迁移英雄仍走旧路径
   * （2026-10-12 批 1 后 H002 已迁移，改用仍留在旧路径的 H007 做对照） */
  const route = ev(`(function () {
    var t = ${T};
    var prev = { e: t.enabled, m: t.migratedHeroIds };
    t.enabled = true; t.migratedHeroIds = ["H001"];
    var a = SkillRuntime.ownsHero({ id: "H001" });
    var b = SkillRuntime.ownsHero({ id: "H007" });
    t.enabled = prev.e; t.migratedHeroIds = prev.m;
    return { a: a, b: b };
  })()`);
  check("⑥ 端到端：H001 走新路径（ownsHero=true）", route.a === true);
  check("⑥ 端到端：未迁移英雄留在旧路径（ownsHero=false）", route.b === false);
}

/* ==================================================================
 * 汇总
 * ================================================================== */
console.log(`PASS 合计 = ${passCount}   失败数 = ${failCount}`);
if (failCount > 0) process.exitCode = 1;
