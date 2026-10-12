/* ============================================================================
 * skill_rule_binding_test.js —— 技能系统「两条核心规则」自检（22.3 复核产出）
 * ----------------------------------------------------------------------------
 * 用户口径（本轮复核目标）：
 *   规则 1：**武器绑定 1 个「初始主动技能」**（无普攻）
 *   规则 2：**4 颗水晶同时影响 初始技能 + 稀有技能**（同一组水晶、两技能共享、只占 1 槽）
 *
 * 与既有套件的分工：
 *   · skill_integration_test —— 端到端可用性（跑通、独立冷却、预算、接线静态校验）
 *   · 本文件 —— **只盯这两条规则的"真源一致性"**，用真实 CFG.skillSystem 断言，
 *     不用自造桩字段名（血泪教训：桩里写 allowNoTarget，真配置写 requiresTarget，
 *     字段名不匹配被绿着过门禁 —— 本轮即抓到该类缺陷）。
 *
 * 覆盖：
 *   ① 规则 1 真源：initialSkillBindings / 武器溯源 / 明确定义 / 无普攻 / 单技能注入
 *   ② 规则 1 行为：迁移英雄只走新路径（旧技能停用）、未迁移英雄不受影响
 *   ③ 规则 2 真源：同一颗水晶对两技能同时 applied（只占 1 槽）
 *   ④ 规则 2 结构：两技能图共享同一组水晶快照；槽位排列不改变结果
 *   ⑤ 规则 2 保护：已装水晶对全部技能无收益 → 整组拒绝（EXISTING_CRYSTAL_INACTIVE）
 *   ⑥ 规则 2 流程：雕像授予 1 个稀有技能 → 重编译后 4 水晶仍同时作用于两技能；重复雕像不重授
 *   ⑦ 回归：索敌范围（maxRange）与无目标施放（requiresTarget）字段名对齐（本轮修复项）
 *
 * 注意：PASS 行禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本 ---------------- */
const FILES = [
  "js/config.js",
  "js/core.js",
  "js/pool.js",
  "js/skill-config.js",
  "js/skill-compiler.js",
  "js/skill-damage.js",
  "js/skill-events.js",
  "js/skill-scheduler.js",
  "js/skill-runtime.js",
  "js/skill-reward.js",
  "js/skill-presenter.js",
  "js/skill-save.js",
  "js/skill-playtest.js",
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {}, warn() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("① 真实 13 脚本可无异常装载", !bootThrew);

const ev = (code) => vm.runInContext(code, ctx);

/* 伤害桩：契约等价（进日志 + 扣血 + 判死） */
ev('globalThis.__dmgLog = []; globalThis.damageMonster = function (w, m, dmg, killer) { ' +
   'if (m.phaseInvulnT > 0) return; var real = Math.max(1, Math.round(dmg - ((m.d && m.d.def) || 0))); ' +
   'm.hp -= real; if (m.hp <= 0 && !m.dead) m.dead = true; ' +
   'globalThis.__dmgLog.push({ id: m.id, real: real, killer: killer || null }); };');

const T = "CFG.skillSystem";

/* ================== ① 规则 1 真源：武器绑定唯一初始主动技能 ================== */
{
  const bindings = ev(T + ".initialSkillBindings");
  check("① 初始技能绑定表存在且非空", !!bindings && typeof bindings === "object" && Object.keys(bindings).length > 0);

  const H = ev(T + ".initialSkillBindings.H001");
  check("① H001 已登记初始技能绑定", !!H);
  check("① H001 绑定恰好 1 个技能（skillId 为单值字符串，不是数组）",
    !!H && typeof H.skillId === "string" && H.skillId.length > 0);
  check("① H001 绑定武器 W001（速射炮）可溯源", !!H && H.weaponId === "W001" && ev('!!(CFG.weapons && CFG.weapons.W001)'));
  check("① 绑定的初始技能在 skillDefs 中存在",
    !!H && ev('!!(' + T + '.skillDefs["' + H.skillId + '"])'));
  check("① 武器 W001 的旧路径技能与绑定同源（武器→技能 一对一）",
    !!H && typeof ev('CFG.weapons.W001.skills && CFG.weapons.W001.skills.skill') === "string");

  check("① 无普攻：CFG.basicAttack.removed === true", ev("CFG.basicAttack && CFG.basicAttack.removed") === true);
  check("① 英雄技能上限 = 2（初始 + 至多 1 稀有）", ev(T + ".maxSkillsPerHero") === 2);
  check("① 共享水晶槽位 = 4", ev(T + ".slotCount") === 4);
  check("① 稀有技能池已配置且非空",
    ev("Array.isArray(" + T + ".rareSkillPool) && " + T + ".rareSkillPool.length > 0"));

  /* 试玩注入口径 = 只给 1 个技能（且必须是武器绑定的那一个） */
  const preset = ev("SkillPlaytest._presetFor('H001')");
  const pkeys = Object.keys((preset && preset.skills) || {});
  check("① 试玩注入只给 1 个技能（不是一次给两个）", pkeys.length === 1);
  check("① 试玩注入的技能 = 武器绑定的初始技能",
    pkeys.length === 1 && pkeys[0] === (H && H.skillId));
  check("① 试玩注入 4 颗水晶、四槽全开",
    Array.isArray(preset.crystals) && preset.crystals.length === 4 &&
    preset.crystals.map(c => c.slot).sort().join(",") === "0,1,2,3");
  check("① 初始技能解析真源 = CFG 绑定（非硬编码）",
    ev("SkillPlaytest.initialSkillFor('H001')") === (H && H.skillId));

  /* 单技能 + 4 水晶可编译，且只产出 1 张图 */
  const one = ev(`(function () {
    var p = SkillPlaytest._presetFor("H001");
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1, skills: JSON.parse(JSON.stringify(p.skills)), crystals: JSON.parse(JSON.stringify(p.crystals)) };
    var r = SupportCompiler.compile({ heroId: "H001", state: st, definitions: CFG.skillSystem });
    return { ok: !!r.ok, ids: Object.keys(r.builds || {}).sort(), diag: (r.diagnostics || []).map(function (d) { return d.code; }) };
  })()`);
  check("① 单初始技能 + 4 水晶编译通过", one.ok === true && one.diag.length === 0);
  check("① 编译产物只有 1 个技能图（没有凭空多出普攻/第二技能）",
    one.ids.length === 1 && one.ids[0] === (H && H.skillId));
}

/* ================== ② 规则 1 行为：迁移英雄旧技能停用 ================== */
{
  /* 分流闸门：迁移英雄在 game.js 的旧施放路径被拦（静态接线校验） */
  const gameSrc = read("js/game.js");
  check("② game.js 玩家旧施放路径有分流闸门（skillV2Owns(this)）", gameSrc.indexOf("skillV2Owns(this)") >= 0);
  check("② game.js 队友旧施放路径有分流闸门（skillV2Owns(c)）", gameSrc.indexOf("skillV2Owns(c)") >= 0);

  /* 行为：未迁移英雄 ownsHero=false（旧路径不受影响）；迁移英雄=true */
  const own = ev(`(function () {
    var t = CFG.skillSystem;
    var keepOn = t.enabled, keepList = t.migratedHeroIds;
    t.enabled = true; t.migratedHeroIds = ["H001"];
    var a = SkillRuntime.ownsHero({ id: "H001" });
    var b = SkillRuntime.ownsHero({ id: "H002" });
    var c = SkillRuntime.ownsHero({ });
    t.enabled = false; t.migratedHeroIds = keepList; t.enabled = keepOn;
    return { migrated: a, other: b, noId: c };
  })()`);
  check("② 迁移英雄走新路径（ownsHero=true）", own.migrated === true);
  check("② 未迁移英雄走旧路径（ownsHero=false）", own.other === false);
  check("② 无 id 英雄不受影响（ownsHero=false）", own.noId === false);
  check("② 总开关已正式启用（22.8 启用批次：enabled=true）", ev(T + ".enabled") === true);
}

/* ================== ③ 规则 2 真源：同一颗水晶同时作用于两技能 ================== */
const TWO_SKILL_STATE = `
(function () {
  return { heroId: "H001", slotCount: 4, groupVersion: 1,
    skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
    crystals: [
      { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
      { crystalId: "CR_PIERCE", level: 1, slot: 1 },
      { crystalId: "CR_HOMING", level: 1, slot: 2 },
      { crystalId: "CR_MULTISHOT", level: 1, slot: 3 }
    ] };
})()`;

{
  const r = ev(`(function () {
    var st = ${TWO_SKILL_STATE};
    var out = SupportCompiler.compile({ heroId: "H001", state: st, definitions: CFG.skillSystem });
    var m = {};
    (out.explanations || []).forEach(function (e) { (m[e.crystalId] = m[e.crystalId] || {})[e.skillId] = e.status; });
    return { ok: !!out.ok, matrix: m, diag: (out.diagnostics || []).map(function (d) { return d.code; }),
      fbCrys: JSON.stringify(out.builds.SK_FIREBALL.crystals),
      swCrys: JSON.stringify(out.builds.SK_SHOCKWAVE.crystals),
      nSlots: out.builds.SK_FIREBALL.crystals.length };
  })()`);

  check("③ 两技能 + 4 水晶编译通过", r.ok === true && r.diag.length === 0);
  check("③ 同一颗水晶（奥术增幅）同时作用于初始技能与稀有技能",
    r.matrix.CR_ARCANE_AMP && r.matrix.CR_ARCANE_AMP.SK_FIREBALL === "applied" &&
    r.matrix.CR_ARCANE_AMP.SK_SHOCKWAVE === "applied");
  check("③ 该水晶只占 1 个槽位（4 水晶 → 4 槽，不因两技能翻倍）", r.nSlots === 4);

  /* 规则 2 的如实口径：不适用形态的水晶对另一技能为 inactive（不强行生效，也不报错） */
  check("③ 形态不匹配的水晶对另一技能如实标 inactive（贯穿 × 范围技能）",
    r.matrix.CR_PIERCE && r.matrix.CR_PIERCE.SK_FIREBALL === "applied" &&
    r.matrix.CR_PIERCE.SK_SHOCKWAVE === "inactive");

  /* ④ 结构：两技能图共享同一组水晶快照 */
  check("④ 两技能图共享同一组水晶快照（同源同序）", r.fbCrys === r.swCrys);

  /* ④ 槽位排列不改变结果：打乱 slot 重排 → signature/解释一致 */
  const perm = ev(`(function () {
    var mk = function (order) {
      var all = [
        { crystalId: "CR_ARCANE_AMP", level: 1 }, { crystalId: "CR_PIERCE", level: 1 },
        { crystalId: "CR_HOMING", level: 1 }, { crystalId: "CR_MULTISHOT", level: 1 }
      ];
      var cs = order.map(function (idx, i) { var c = all[idx]; return { crystalId: c.crystalId, level: 1, slot: i }; });
      var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
        skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
        crystals: cs };
      return SupportCompiler.compile({ heroId: "H001", state: st, definitions: CFG.skillSystem });
    };
    var a = mk([0, 1, 2, 3]), b = mk([3, 2, 1, 0]);
    return { same: a.signature === b.signature,
      expSame: JSON.stringify(a.explanations) === JSON.stringify(b.explanations) };
  })()`);
  check("④ 槽位排列不改变构建（signature 一致）", perm.same === true);
  check("④ 槽位排列不改变逐水晶逐技能解释", perm.expSame === true);
}

/* ================== ⑤ 规则 2 保护：每颗水晶至少对一个技能有收益 ================== */
{
  const r = ev(`(function () {
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
      crystals: [
        { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
        { crystalId: "CR_PIERCE", level: 1, slot: 1 },
        { crystalId: "CR_HOMING", level: 1, slot: 2 },
        { crystalId: "CR_MULTISHOT", level: 1, slot: 3 }
      ] };
    var out = SupportCompiler.compile({ heroId: "H001", state: st, definitions: CFG.skillSystem });
    return { ok: !!out.ok, codes: (out.diagnostics || []).map(function (d) { return d.code; }),
      ids: (out.diagnostics || []).map(function (d) { return d.definitionId; }).sort() };
  })()`);
  check("⑤ 已装水晶对全部技能都无收益 → 整组拒绝（不得静默失效）", r.ok === false);
  check("⑤ 拒绝原因码 = EXISTING_CRYSTAL_INACTIVE", r.codes.indexOf("EXISTING_CRYSTAL_INACTIVE") >= 0);
  check("⑤ 报告可定位到具体失效水晶（贯穿/追踪/扇射）",
    r.ids.join(",") === "CR_HOMING,CR_MULTISHOT,CR_PIERCE");
}

/* ================== ⑥ 规则 2 流程：雕像授予稀有技能后仍两技能共享 ================== */
{
  const r = ev(`(function () {
    var t = CFG.skillSystem;
    var pol = t.rewardPolicies.RP_STATUE;
    /* 初始状态 = 试玩注入（1 技能 + 4 水晶） */
    var p = SkillPlaytest._presetFor("H001");
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: JSON.parse(JSON.stringify(p.skills)), crystals: JSON.parse(JSON.stringify(p.crystals)) };
    var r1 = SkillReward.rollStatueGrant(st, pol, function () { return 0.0; });   // 固定种子：必中
    var granted = !!(r1 && r1.granted);
    var sid = r1 && r1.skillId;
    /* 装入并重编译（与 skill-playtest.js 的 _installRareSkill 同口径） */
    var okAfter = false, matrix = null, nSkills = 0, sharedCrys = false;
    if (granted) {
      st.skills[sid] = { id: sid, level: 1, cd: 0, cdLeft: 0 };
      st.groupVersion++;
      var c = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t });
      okAfter = !!c.ok; nSkills = Object.keys(c.builds || {}).length;
      var m = {};
      (c.explanations || []).forEach(function (e) { (m[e.crystalId] = m[e.crystalId] || {})[e.skillId] = e.status; });
      matrix = m;
      sharedCrys = JSON.stringify(c.builds.SK_FIREBALL.crystals) === JSON.stringify(c.builds[sid].crystals);
    }
    /* 重复雕像：已 2 技能 → 不得再授予第 3 个 */
    var r2 = SkillReward.rollStatueGrant(st, pol, function () { return 0.0; });
    /* 技能上限试装：临时造第 3 个技能定义（仅内存）→ 应被 SLOTS_FULL 拒绝 */
    var third = JSON.parse(JSON.stringify(t.skillDefs.SK_SHOCKWAVE));
    third.id = "SK_TEST3"; third.nameKey = "skill.shockwave";
    t.skillDefs.SK_TEST3 = third;
    var pv = SupportCompiler.preview(st, { kind: "installSkill", skillId: "SK_TEST3", definitions: t });
    delete t.skillDefs.SK_TEST3;
    return { granted: granted, sid: sid, okAfter: okAfter, nSkills: nSkills, sharedCrys: sharedCrys,
      matrix: matrix, dupKind: r2 && r2.kind, pvReason: (pv.reasonCodes || []).join(",") };
  })()`);

  check("⑥ 雕像授予 1 个稀有技能（不是一次给两个）", r.granted === true && r.sid === "SK_SHOCKWAVE");
  check("⑥ 授予后重编译通过，技能数 = 2（初始 + 稀有）", r.okAfter === true && r.nSkills === 2);
  check("⑥ 授予后 4 颗水晶仍同时作用于两技能（奥术增幅 → 两技能）",
    !!r.matrix && r.matrix.CR_ARCANE_AMP && r.matrix.CR_ARCANE_AMP.SK_FIREBALL === "applied" &&
    r.matrix.CR_ARCANE_AMP.SK_SHOCKWAVE === "applied");
  check("⑥ 稀有技能与初始技能共享同一组水晶（不是各配一套）", r.sharedCrys === true);
  check("⑥ 重复雕像不重复授予（转为其他奖励）", r.dupKind !== "skill");
  check("⑥ 技能达上限时试装被拒（SLOTS_FULL）", r.pvReason.indexOf("SLOTS_FULL") >= 0);
}

/* ================== ⑦ 回归：本轮修复的两处字段名对齐 ================== */
{
  /* 纯函数口径：真源字段名必须被读取 */
  check("⑦ 索敌范围读取真源 maxRange（TGT_NEAREST → 520）",
    ev("SkillScheduler.rangeOf(CFG.skillSystem.targetPolicies.TGT_NEAREST)") === 520);
  check("⑦ 无目标施放读取真源 requiresTarget（CAST_ORBIT requiresTarget:false → 允许无目标）",
    ev("SkillScheduler.allowNoTargetOf(CFG.skillSystem.castPolicies.CAST_ORBIT)") === true);
  check("⑦ 常规施放仍需目标（CAST_COOLDOWN requiresTarget:true → 不允许无目标）",
    ev("SkillScheduler.allowNoTargetOf(CFG.skillSystem.castPolicies.CAST_COOLDOWN)") === false);
  check("⑦ 兼容旧短名（range / allowNoTarget 仍可用，不回归旧测试桩）",
    ev("SkillScheduler.rangeOf({ range: 100 })") === 100 &&
    ev("SkillScheduler.allowNoTargetOf({ allowNoTarget: true })") === true);

  /* 行为①：超出索敌范围的目标不得被锁定（修复前：3800px 外仍施放） */
  const farCase = ev(`(function () {
    var t = CFG.skillSystem;
    var keepOn = t.enabled, keepList = t.migratedHeroIds;
    t.enabled = true; t.migratedHeroIds = ["H001"];
    var w = { w: 9000, h: 9000, monsters: [{ id: 1, defId: "NM01", x: 4000, y: 100, r: 18, hp: 1e9, dead: false, d: { def: 0, type: "normal" } }] };
    var hero = { id: "H001", x: 100, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    var p = SkillPlaytest._presetFor("H001");
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1, skills: JSON.parse(JSON.stringify(p.skills)), crystals: JSON.parse(JSON.stringify(p.crystals)) };
    st.builds = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t }).builds;
    hero.skillState = st;
    w.__skillHeroes = [hero];
    var spawned = 0;
    for (var i = 0; i < 300; i++) { var r = SkillRuntime.updateHeroSkills(w, hero, 1 / 60); spawned += (r.spawned || 0); }
    t.enabled = keepOn; t.migratedHeroIds = keepList;
    return spawned;
  })()`);
  check("⑦ 行为：3800px 外的敌人（> maxRange 520）不被索敌 → 零施放", farCase === 0);

  /* 行为②：范围内目标照常施放（确保上面的 0 不是"整体不工作"） */
  const nearCase = ev(`(function () {
    var t = CFG.skillSystem;
    var keepOn = t.enabled, keepList = t.migratedHeroIds;
    t.enabled = true; t.migratedHeroIds = ["H001"];
    var w = { w: 4000, h: 4000, monsters: [{ id: 1, defId: "NM01", x: 300, y: 100, r: 18, hp: 1e9, dead: false, d: { def: 0, type: "normal" } }] };
    var hero = { id: "H001", x: 100, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    var p = SkillPlaytest._presetFor("H001");
    var st = { heroId: "H001", slotCount: 4, groupVersion: 1, skills: JSON.parse(JSON.stringify(p.skills)), crystals: JSON.parse(JSON.stringify(p.crystals)) };
    st.builds = SupportCompiler.compile({ heroId: "H001", state: st, definitions: t }).builds;
    hero.skillState = st;
    w.__skillHeroes = [hero];
    var spawned = 0, dmg = 0;
    for (var i = 0; i < 180; i++) { var r = SkillRuntime.updateHeroSkills(w, hero, 1 / 60); spawned += (r.spawned || 0); }
    dmg = (globalThis.__dmgLog || []).length;
    t.enabled = keepOn; t.migratedHeroIds = keepList;
    return { spawned: spawned, dmg: dmg };
  })()`);
  check("⑦ 行为：范围内目标照常施放并结算（确认上一条不是整体失效）",
    nearCase.spawned > 0 && nearCase.dmg > 0);

  /* 行为③：无目标时，requiresTarget=false 的技能仍施放；true 的技能保持就绪。
   * ⚠️ A4 落库（2026-10-12）：SK_SHOCKWAVE 带前摇 castTime=0.15（config.js skillLevels cast 层），
   *    故「照常施放」= 走完前摇后施放，**不是**首帧即放 —— 须逐帧推进到读条满再断言。 */
  const noTarget = ev(`(function () {
    var t = CFG.skillSystem;
    var keepOn = t.enabled, keepList = t.migratedHeroIds, keepCast = t.skillDefs.SK_SHOCKWAVE.castPolicyId;
    t.enabled = true; t.migratedHeroIds = ["H001"];                        // 必须通电：否则 tick 恒空转（空真陷阱）
    var w = { w: 2000, h: 2000, monsters: [] };
    var hero = { id: "H001", x: 100, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 },
      skillState: { heroId: "H001", skills: { SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1, cdLeft: 0 } }, crystals: [] } };
    var enabled = !!SkillScheduler._tables().enabled;
    var ct = SkillScheduler.castTimeFor(t.skillDefs.SK_SHOCKWAVE, 1);      // 前摇真源（>0 才有下列语义）
    var a = SkillScheduler.tick(w, hero, 1 / 60).requests.length;          // requiresTarget:true → 0
    t.skillDefs.SK_SHOCKWAVE.castPolicyId = "CAST_ORBIT";                  // 临时改绑（仅内存）
    hero.skillState.skills.SK_SHOCKWAVE.cdLeft = 0;
    hero.skillState.skills.SK_SHOCKWAVE.castLeft = null;
    var firstFree = SkillScheduler.tick(w, hero, 1 / 60).requests.length;  // 前摇首帧 → 0（读条中）
    var free = 0, idle = 0;
    for (var i = 0; i < 60 && free === 0; i++) { free += SkillScheduler.tick(w, hero, 1 / 60).requests.length; }
    t.skillDefs.SK_SHOCKWAVE.castPolicyId = keepCast;
    t.enabled = keepOn; t.migratedHeroIds = keepList;
    return { enabled: enabled, ct: ct, locked: a, firstFree: firstFree, free: free, idle: idle };
  })()`);
  check("⑦ 前提：调度器已通电（防「恒空转」造成空真）", noTarget.enabled === true);
  check("⑦ 前提：SK_SHOCKWAVE 前摇真源 > 0（A4 生效前提，防「无前摇」造成空真）", noTarget.ct > 0);
  check("⑦ 行为：无目标时 requiresTarget:true 技能保持就绪（不空放）", noTarget.locked === 0);
  check("⑦ 行为：前摇读条中（castTime 未满）不施放", noTarget.firstFree === 0);
  check("⑦ 行为：无目标时 requiresTarget:false 技能走完前摇照常施放", noTarget.free === 1);
}

/* ================== ⑧ 静态接线自检（单行接入点确实存在） ================== */
{
  const mainSrc = read("js/main.js");
  const renderSrc = read("js/render.js");
  const idx = read("index.html");
  check("⑧ main.js 主循环已接 SkillRuntime.updateAll", mainSrc.indexOf("SkillRuntime.updateAll(G.activeWorld, dt)") >= 0);
  check("⑧ render.js 有受守卫的叠加层调用点", renderSrc.indexOf("SkillPlaytest.draw(ctx, w)") >= 0);
  check("⑧ index.html 顺序：9 模块 → 试玩块 → main.js",
    idx.indexOf("js/skill-save.js?v=") < idx.indexOf("js/skill-playtest.js?v=") &&
    idx.indexOf("js/skill-playtest.js?v=") < idx.indexOf("js/main.js?v="));
  /* 2026-10-12 起迁移名单动态扩展（批 1 = H001~H006）；断言改为「与技能绑定表一致」，
   * 避免每加一批英雄就要改测试（空真陷阱规避：先断言非空）。 */
  check("⑧ 配置已正式启用（enabled=true / 迁移名单 = 技能绑定表键集，且含 H001）",
    ev(T + ".enabled") === true &&
    ev(T + ".migratedHeroIds.length") > 0 &&
    ev(T + ".migratedHeroIds.length") === ev("Object.keys(" + T + ".initialSkillBindings).length") &&
    ev(T + '.migratedHeroIds.indexOf("H001")') >= 0);
}

/* ================== ⑨ 22.4 批次：能量爆发基准 / 派生路由 / 环绕参数 ================== */
{
  /* --- ⑨-1 #13 真源：SK_FIREBALL 以旧 AT102「能量爆发」为迁移基准 --- */
  const fb = ev(T + '.skillDefs.SK_FIREBALL');
  const lv1 = fb.levels[0];
  check("⑨ 真源：冷却 1.8s（旧 AT102 基准）", lv1.cooldown === 1.8);
  check("⑨ 真源：伤害 150%攻击（coefficient 1.5）", lv1.parameters.coefficient === 1.5);
  const g = fb.baseGraph;
  const burst = (g.nodes || []).find(n => n.nodeId === "n_burst");
  check("⑨ 结构：内置命中爆炸节点 n_burst（TP_INSTANT_AREA / 半径 130）",
    !!burst && burst.templateId === "TP_INSTANT_AREA" && burst.parameters.radius === 130);
  check("⑨ 结构：载体弹 → 爆炸由 onHit 边连接",
    (g.edges || []).some(e => e.from === "n_fireball" && e.to === "n_burst" && e.event === "onHit"));

  /* --- ⑨-1 #13 行为：一次施放 = 被击者 150 一次 + 半径内邻者 150 + 半径外 0 --- */
  const burstCase = ev(`(function () {
    var t = CFG.skillSystem; t.enabled = true; t.migratedHeroIds = ["H001"];
    globalThis.damageMonster = function (w, m, d, k) { m.hp -= d; if (m.hp <= 0) m.dead = true; };
    var struck = { id: 1, defId: "NM01", x: 300, y: 100, r: 18, hp: 10000, dead: false, d: { def: 0, type: "normal" } };
    var nearby = { id: 2, defId: "NM01", x: 380, y: 130, r: 18, hp: 10000, dead: false, d: { def: 0, type: "normal" } };
    var faraway = { id: 3, defId: "NM01", x: 900, y: 900, r: 18, hp: 10000, dead: false, d: { def: 0, type: "normal" } };
    var w = { w: 4000, h: 4000, monsters: [struck, nearby, faraway] };
    var hero = { id: "H001", x: 200, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    hero.skillState = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } }, crystals: [] };
    var c = SupportCompiler.compile({ heroId: "H001", state: hero.skillState, definitions: t });
    hero.skillState.builds = c.builds;
    w.__skillHeroes = [hero];
    var casts = 0, prevCd = 99;
    for (var i = 0; i < 40; i++) { SkillRuntime.updateHeroSkills(w, hero, 1 / 60); }
    t.enabled = false;
    return { struck: 10000 - struck.hp, nearby: 10000 - nearby.hp, far: 10000 - faraway.hp };
  })()`);
  check("⑨ 前提：无水晶直击结算生效（前提防空真）", burstCase.struck > 0);
  check("⑨ 行为：被击中目标只受 150%（直击一次，爆炸不重复结算出生目标）", burstCase.struck === 150);
  check("⑨ 行为：爆炸半径 130 内邻目标受 150%", burstCase.nearby === 150);
  check("⑨ 行为：爆炸半径外目标零伤害", burstCase.far === 0);

  /* --- ⑨-2 #11 派生路由：操作 → 节点 → 事件 → 精确派生 --- */
  const route = ev(`(function () {
    var t = CFG.skillSystem; t.enabled = true; t.migratedHeroIds = ["H001"];
    globalThis.damageMonster = function (w, m, d, k) { m.hp -= d; if (m.hp <= 0) m.dead = true; };
    var w = { w: 4000, h: 4000, monsters: [{ id: 1, defId: "NM01", x: 300, y: 100, r: 18, hp: 1e9, dead: false, d: { def: 0, type: "normal" } }] };
    var hero = { id: "H001", x: 200, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    hero.skillState = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_EXPLOSION", level: 1, slot: 0 }] };
    var c = SupportCompiler.compile({ heroId: "H001", state: hero.skillState, definitions: t });
    hero.skillState.builds = c.builds;
    var dn = c.builds.SK_FIREBALL.nodes["explosion.spawn@n_fireball"];
    w.__skillHeroes = [hero];
    var areaFrames = 0;
    for (var i = 0; i < 240; i++) {
      SkillRuntime.updateHeroSkills(w, hero, 1 / 60);
      (w.__skillEffects || []).forEach(function (e) {
        if (e.templateId === "TP_INSTANT_AREA") areaFrames++;
      });
    }
    t.enabled = false;
    return { opId: dn && dn.operationId, rpId: dn && dn.routePolicyId, area: areaFrames };
  })()`);
  check("⑨ 结构：水晶派生节点携带 operationId（split/explosion 操作身份）", route.opId === "explosion.spawn");
  check("⑨ 结构：水晶派生节点携带 routePolicyId（EP_DERIVED_ONCE）", route.rpId === "EP_DERIVED_ONCE");
  check("⑨ 行为：爆破水晶生效（场上出现过爆炸实体）", route.area > 0);

  /* 幻影主弹：主弹命中后消失事件若按模板兜底命中主节点 → 再生成一发「幻影主弹」并无限续链。
   * 修复后：模板兜底只匹配派生节点 → 4s（3 次施放）恰 3 个独立主弹实例。 */
  const phantom = ev(`(function () {
    var t = CFG.skillSystem; t.enabled = true; t.migratedHeroIds = ["H001"];
    globalThis.damageMonster = function (w, m, d, k) { m.hp -= d; if (m.hp <= 0) m.dead = true; };
    var w = { w: 4000, h: 4000, monsters: [{ id: 1, defId: "NM01", x: 300, y: 100, r: 18, hp: 1e9, dead: false, d: { def: 0, type: "normal" } }] };
    var hero = { id: "H001", x: 200, y: 100, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    hero.skillState = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_EXPLOSION", level: 1, slot: 0 }] };
    var c = SupportCompiler.compile({ heroId: "H001", state: hero.skillState, definitions: t });
    hero.skillState.builds = c.builds;
    w.__skillHeroes = [hero];
    var ids = {};
    for (var i = 0; i < 240; i++) {
      SkillRuntime.updateHeroSkills(w, hero, 1 / 60);
      (w.__skillEffects || []).forEach(function (e) {
        if (e.role !== "derived" && e.templateId === "TP_FLIGHT_PROJECTILE") ids[e.effectId] = true;
      });
    }
    t.enabled = false;
    var n = 0; for (var k in ids) n++;
    return n;
  })()`);
  check("⑨ 行为：主弹命中/寿命结束不再生成「幻影主弹」（4s = 3 次施放 → 恰 3 个主弹实例）",
    phantom === 3);

  /* --- ⑨-3 #12 环绕参数：模板默认回落 + orbitCount 接线 --- */
  const orbit = ev(`(function () {
    var t = CFG.skillSystem; t.enabled = true; t.migratedHeroIds = ["H001"];
    globalThis.damageMonster = function (w, m, d, k) { m.hp -= d; if (m.hp <= 0) m.dead = true; };
    var w = { w: 4000, h: 4000, monsters: [] };
    var hero = { id: "H001", x: 500, y: 500, r: 14, alive: true, stats: { atk: 100, cdMul: 1 } };
    hero.skillState = { heroId: "H001", slotCount: 4, groupVersion: 1,
      skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } },
      crystals: [{ crystalId: "CR_ORBIT", level: 2, slot: 0 }] };
    var c = SupportCompiler.compile({ heroId: "H001", state: hero.skillState, definitions: t });
    hero.skillState.builds = c.builds;
    var n = c.builds.SK_FIREBALL.nodes.n_fireball;
    w.__skillHeroes = [hero];
    SkillRuntime.updateHeroSkills(w, hero, 1 / 60);
    var eff = (w.__skillEffects || []).find(function (e) { return e.templateId === "TP_ORBIT_CONTACT"; });
    var def = SkillScheduler;
    var interval = SkillScheduler.intervalFor(
      CFG.skillSystem.skillDefs.SK_FIREBALL, 1, { cdMul: 1 }, CFG.skillSystem.castPolicies.CAST_ORBIT);
    t.enabled = true;
    return { p: n.parameters, rt: eff ? eff.rt.params : null, nLive: eff ? 1 : 0, interval: interval,
      expect: t.crystalDefs.CR_ORBIT.levels[1].parameters.orbitCount };
  })()`);
  check("⑨ 结构：环绕数量来自等级表 orbitCount（LV2 取配表值，等级扩表后不写死）",
    orbit.p.count === orbit.expect);
  check("⑨ 结构：旧形态参数不泄漏（转换后无 speed/life/extraPierceCount）",
    orbit.p.speed === undefined && orbit.p.life === undefined && orbit.p.extraPierceCount === undefined);
  check("⑨ 结构：伤害恒等参数保留（coefficient / moreDamageMul）",
    orbit.p.coefficient === 1.5 && orbit.p.moreDamageMul === 1);
  check("⑨ 前提：环绕实体已生成", orbit.nLive === 1);
  check("⑨ 行为：环绕半径取模板默认 70 / 角速度 2.2（不再拿到投射物 radius=8）",
    orbit.rt && orbit.rt.radius === 70 && orbit.rt.angularSpeed === 2.2);
  check("⑨ 行为：接触判定半径生效（contactRadius 16，非 0）", orbit.rt && orbit.rt.contactRadius === 16);
  check("⑨ 行为：一批环绕持续 6s（duration 来自 defaults.orbit）", orbit.rt && orbit.rt.duration === 6);
  check("⑨ 行为：环绕有效施放间隔 = max(冷却, 持续) = 6s", orbit.interval === 6);
}

/* ================== 汇总 ================== */
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("技能规则自检未全部通过");
console.log("SKILL 规则自检 OK");
