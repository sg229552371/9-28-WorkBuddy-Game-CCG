/* 无头测试：技能附加效果派发（v2 · skill-runtime.js 文件末尾独立区块）
 * 运行：node skill_effect_runtime_test.js
 * 加载：vm 沙箱 config.js → skill-damage.js → skill-events.js → skill-scheduler.js →
 *       skill-compiler.js → skill-runtime.js（照抄 skill_runtime_test.js 的加载方式）。
 * 目的（黑盒行为）：证明 _applySpawnEffects / _applyEffect / _effectHeal / _effectAura /
 *       _effectBarrier / _effectTaunt / _effectTrap / _effectSummon 的真实行为。
 * 说明：不加载 game.js / combat.js（含 DOM / 音频依赖）。只向沙箱注入最小宿主桩
 *       G / world / Drone（只补环境，不改被测逻辑语义）。所有数值与字段名**直读真实
 *       CFG.skillSystem / CFG.heroes / CFG.skillScaleBy**，不写死、不自造契约。
 * 注意：PASS 文案禁用英文 FAIL / Error 字样（run_tests.sh 以 grep 计 bad）。 */
"use strict";

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext({ console: console });
for (const f of ["js/config.js", "mods/jes-skill-crystal/systems/skill-damage.js", "mods/jes-skill-crystal/systems/skill-events.js", "mods/jes-skill-crystal/systems/skill-scheduler.js", "mods/jes-skill-crystal/systems/skill-compiler.js", "mods/jes-skill-crystal/systems/skill-runtime.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
/* ---- 宿主桩：G（局内状态）----
 * 真实 game.js 定义；此处最小实现：player（队长实体，HP 不放这里）+ run（HP 在 run.hp）。*/
var G = { player: null, run: null };

/* 被测逻辑只读 CFG.skillSystem.enabled 之外的开关走 ownsHero；本测试直接调 spawnEffect，
 * 不经过调度门禁，但保持 enabled:true 以贴近真机。 */
CFG.skillSystem.enabled = true;

/* ---- Drone 桩：真实类在 game.js / combat.js；此处只补构造签名（字段名来自 _effectSummon 调用点）。
 *      默认留空（undefined）→ 用于验证「未注入 Drone」的优雅降级。 */
var Drone = undefined;

/* ---- 计数与断言 ---- */
var passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---- 真源读取助手（全部从真实 CFG 取值，不写死）---- */
function defOf(sid) { return CFG.skillSystem.skillDefs[sid]; }
function nodeOf(sid) { var d = defOf(sid); return (d.baseGraph.nodes || [])[0]; }
function effectOf(sid) { var n = nodeOf(sid); return n ? n.effect : null; }

/* ---- 真实编译：单技能 → 编译图（含 L1 等级参数并入 + effect 透传）---- */
function compileOne(sid, level) {
  var state = { heroId: "HX", slotCount: 4, groupVersion: 1, skills: {}, crystals: [] };
  state.skills[sid] = { id: sid, level: level || 1 };
  var r = SupportCompiler.compile({ heroId: "HX", state: state, definitions: CFG.skillSystem });
  return (r && r.builds) ? (r.builds[sid] || null) : null;
}
function rootId(sid) { var g = compileOne(sid); return g ? Object.keys(g.nodes)[0] : null; }

/* ---- 最小真实宿主：world（monsters + __skillHeroes）；每次用例新建，避免相互污染 ---- */
function mkW(monsters) {
  return { w: 1000, h: 1000, isMain: false, kind: "test", obstacles: [], monsters: monsters || [], __skillHeroes: [] };
}
function setEnv(owner, run) {
  G.player = owner;
  G.run = run || { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] };
  return G.run;
}
function snapOf(owner, sid, stats, castId) {
  return SkillScheduler.createCastSnapshot(owner, { skillId: sid, level: 1, graph: compileOne(sid) }, stats || {}, castId);
}

/* ---- 复算助手：治疗量独立复算（读真实 effect 字段与 CFG.skillScaleBy）----
 * 公式（v2 §1.2，与旧 combat.js castSupport 同源）：healBase + (属性×scalePct×等级系数) × healPerAdd。
 * ⚠️ 属性只经 scalePct 生效**一次**；不可再叠加「属性×healPerAdd」原始项（曾为重复计数缺陷）。 */
function healExpect(statVal, lv, e) {
  var growth = 1 + (lv - 1) * CFG.skillScaleBy.levelGrowth;
  var amount = statVal * (e.scalePct || 0) * growth;
  return Math.max(1, Math.round((e.healBase || 0) + amount * (e.healPerAdd != null ? e.healPerAdd : 1)));
}

/* ================= 0. 加载 / 编译健全性 ================= */
{
  var sids = ["SK_LIFEPULSE", "SK_WARSONG", "SK_PSYSHIELD", "SK_TAUNTROAR", "SK_MINEFIELD", "SK_DRONESWARM", "SK_FIREBALL"];
  var allOk = sids.every(function (s) { return !!compileOne(s); });
  check("0.1 真实 CFG 可编译全部被测技能（附加效果节点可达）", allOk);
}

/* ================= 1. 施放级「恰好一次」（effectDone 守卫）================= */
/* spawnEffect = 施放级接线点：一次施放只生成一份 instantArea 效果实例 → 全队效果只派发一次。
 * 把 3 个怪放进半径内作为触发场景，并额外断言同一实例重复派发被守卫拦住。 */
{
  var sid = "SK_LIFEPULSE";
  var o = { id: "H010", x: 0, y: 0, atk: 100 };
  var run = setEnv(o, { hp: 0, hpMax: 10000, companions: [], buffs: [], traps: [], drones: [] });
  var w = mkW([
    { id: 1, x: 50, y: 0, r: 10, dead: false, hp: 500 },
    { id: 2, x: -50, y: 0, r: 10, dead: false, hp: 500 },
    { id: 3, x: 0, y: 60, r: 10, dead: false, hp: 500 }
  ]);
  var node = nodeOf(sid);
  var R = node.parameters.radius;    // 直读真实 CFG 半径（L1）
  check("1.0 前提：instantArea 半径内确有 3 个怪",
    w.monsters.length === 3 && w.monsters.every(function (m) { return Math.hypot(m.x - o.x, m.y - o.y) <= R + m.r; }));

  var exp = healExpect(o.atk, 1, effectOf(sid));
  var snap = snapOf(o, sid, { atk: 100 }, 1);
  SkillRuntime.spawnEffect(w, snap, "n_lifepulse", { step: 1 });
  check("1.1 施放级全队治疗恰好一次（hp = 单次量；且 hpMax 足以容纳 3 次 → 非被夹取掩盖）",
    run.hp === exp && exp * 3 <= run.hpMax);

  var eff = w.__skillEffects[0];
  check("1.2 效果实例被标记 effectDone（守卫标志已置位）", !!eff && eff.rt.effectDone === true);

  var made = w.__skillEffects.slice();
  var again = SkillRuntime._applySpawnEffects(w, snap, made);
  check("1.3 effectDone 守卫：同一实例重复派发 → 0，且 HP 不再增长", again === 0 && run.hp === exp);
}

/* ================= 2. heal（SK_LIFEPULSE / H010，双通道）================= */
{
  var sid = "SK_LIFEPULSE";
  var e = effectOf(sid);
  var exp = healExpect(100, 1, e);

  // 2a 队长通道：HP 在 G.run.hp
  var o1 = { id: "H010", x: 0, y: 0, atk: 100 };
  var run1 = setEnv(o1, { hp: 40, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o1, sid, { atk: 100 }, 2), "n_lifepulse", { step: 1 });
  check("2.1 队长通道：G.run.hp 上升且不超过 hpMax", run1.hp > 40 && run1.hp <= run1.hpMax && run1.hp === Math.min(1000, 40 + exp));
  check("2.2 治疗量 = round(atk×scalePct×等级系数 + healBase + atk×healPerAdd)（复算）", run1.hp === 40 + exp);

  // 2b 队友通道：HP 在实体 hp（队长/队友同一次施放双路生效）
  var o2 = { id: "H010", x: 0, y: 0, atk: 100 };
  var c1 = { id: "C1", x: 0, y: 0, hp: 0, hpMax: 1000, alive: true };
  var run2 = setEnv(o2, { hp: 0, hpMax: 1000, companions: [c1], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o2, sid, { atk: 100 }, 3), "n_lifepulse", { step: 1 });
  check("2.3 队友通道：实体 hp 上升（与队长同一次施放双路生效）", c1.hp === Math.min(1000, 0 + exp) && run2.hp === exp);

  // 2c 满血队长不涨
  var o3 = { id: "H010", x: 0, y: 0, atk: 100 };
  var run3 = setEnv(o3, { hp: 1000, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o3, sid, { atk: 100 }, 4), "n_lifepulse", { step: 1 });
  check("2.4 满血队长不涨", run3.hp === 1000);

  // 2d 满血队友不涨
  var o4 = { id: "H010", x: 0, y: 0, atk: 100 };
  var c2 = { id: "C2", x: 0, y: 0, hp: 800, hpMax: 800, alive: true };
  var run4 = setEnv(o4, { hp: 0, hpMax: 1000, companions: [c2], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o4, sid, { atk: 100 }, 5), "n_lifepulse", { step: 1 });
  check("2.5 满血队友不涨", c2.hp === 800);

  // 2e 夹取：不超过 hpMax
  var o5 = { id: "H010", x: 0, y: 0, atk: 100 };
  var run5 = setEnv(o5, { hp: 995, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o5, sid, { atk: 100 }, 6), "n_lifepulse", { step: 1 });
  check("2.6 回血夹取在 hpMax（超出部分丢弃）", run5.hp === 1000);
}

/* ================= 3. aura（SK_WARSONG / H011）================= */
{
  var sid = "SK_WARSONG";
  var e = effectOf(sid);
  check("3.0 前提：节点 effect.kind = aura 且 auraStats 含 atk / spd",
    !!e && e.kind === "aura" && e.auraStats.indexOf("atk") >= 0 && e.auraStats.indexOf("spd") >= 0);

  var o = { id: "H011", x: 0, y: 0, def: 50 };
  var run = setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o, sid, {}, 10), "n_warsong", { step: 1 });

  var atkB = run.buffs.filter(function (b) { return b && b.stat === "atk"; });
  var spdB = run.buffs.filter(function (b) { return b && b.stat === "spd"; });
  check("3.1 施放后 G.run.buffs 出现 atk 与 spd 两条", atkB.length === 1 && spdB.length === 1);
  check("3.2 两条 mul 均 > 1（乘法增益通道）", (atkB[0] || {}).mul > 1 && (spdB[0] || {}).mul > 1);
  check("3.3 remain === auraDuration（直读 CFG）", (atkB[0] || {}).remain === e.auraDuration && (spdB[0] || {}).remain === e.auraDuration);

  var len1 = run.buffs.length;
  SkillRuntime.spawnEffect(mkW([]), snapOf(o, sid, {}, 11), "n_warsong", { step: 1 });
  check("3.4 重复施放同一 id → 刷新而非叠加（buffs 长度不增长）", run.buffs.length === len1 && len1 === 2);
}

/* ================= 4. barrier（SK_PSYSHIELD / H012）================= */
{
  var sid = "SK_PSYSHIELD";
  var e = effectOf(sid);
  check("4.0 前提：节点 effect.kind = barrier", !!e && e.kind === "barrier");

  var o = { id: "H012", x: 0, y: 0, def: 20 };
  var run = setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  SkillRuntime.spawnEffect(mkW([]), snapOf(o, sid, {}, 20), "n_psyshield", { step: 1 });

  var defB = run.buffs.filter(function (b) { return b && b.stat === "def"; });
  check("4.1 施放后出现 stat = def 的护罩记录", defB.length === 1);
  var rec = defB[0] || {};
  var statVal = o[e.scaleStat || "def"];   // E-β/D029：scaleStat 已由 energyMax 改为 def（数据驱动读取）
  var expDef = Math.max(1, Math.round(e.barrierDef + statVal * (e.scalePct || 0)));
  check("4.2 mul 为平坦加值（整数且 > 1），非防御倍率",
    typeof rec.mul === "number" && rec.mul > 1 && Math.floor(rec.mul) === rec.mul);
  check("4.3 护罩加值 = 复算值 = barrierDef + 属性×scalePct（直读 CFG 占位参数）", rec.mul === expDef);
  check("4.4 remain === barrierDuration（直读 CFG）", rec.remain === e.barrierDuration);
}

/* ================= 5. taunt（SK_TAUNTROAR / H009）================= */
{
  var sid = "SK_TAUNTROAR";
  var e = effectOf(sid);
  var node = nodeOf(sid);
  var o = { id: "H009", x: 0, y: 0, def: 50 };
  setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });

  var inM = { id: 1, x: 100, y: 0, r: 10, dead: false, hp: 100 };
  var outM = { id: 2, x: 300, y: 0, r: 10, dead: false, hp: 100 };
  var w = mkW([inM, outM]);
  var snap = snapOf(o, sid, {}, 30);
  SkillRuntime.spawnEffect(w, snap, "n_tauntroar", { step: 1 });

  var eff = w.__skillEffects[0];
  var R = SkillRuntime._effectRadius(w, snap, eff);
  check("5.0 前提：半径内确有 1 个怪、半径外确有 1 个怪",
    (Math.hypot(inM.x - o.x, inM.y - o.y) <= R + inM.r) && (Math.hypot(outM.x - o.x, outM.y - o.y) > R + outM.r));
  check("5.1 半径内怪被写 tauntedBy === 施放者实体", inM.tauntedBy === o);
  check("5.2 tauntT === tauntDuration（直读 CFG）", inM.tauntT === e.tauntDuration);
  check("5.3 半径外怪不被写（tauntedBy / tauntT 均缺省）", outM.tauntedBy === undefined && outM.tauntT === undefined);
  check("5.4 嘲讽半径 > 节点基础半径（scaleStat/scalePct 属性加成生效）", R > node.parameters.radius);
}

/* ================= 6. trap（SK_MINEFIELD / H008）================= */
{
  var sid = "SK_MINEFIELD";
  var e = effectOf(sid);
  var node = nodeOf(sid);
  /* B1 落库（2026-10-12）：布雷数从「节点静态 effect.trapCount=3」改为**等级驱动**
   * （levels[].parameters.trapCount，1→3）。前提断言必须同时锁住「等级表里真有该参数」，
   * 否则会退化成「断言一个永不被消费的静态字段」的空真陷阱。 */
  var lvTbl = defOf(sid).levels;
  var lv1Trap = lvTbl[0].parameters.trapCount;
  var maxTrap = lvTbl[lvTbl.length - 1].parameters.trapCount;
  check("6.0 前提：节点 effect.kind = trap，且布雷数由**等级表**驱动（LV1=" + lv1Trap + " / LV100=" + maxTrap + "）",
    !!e && e.kind === "trap" && lv1Trap === 1 && maxTrap === 3);

  var o = { id: "H008", x: 0, y: 0 };
  var run = setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  var mon = { id: 1, x: 0, y: 0, r: 10, dead: false, hp: 777 };
  var w = mkW([mon]);
  var snap = snapOf(o, sid, { atk: 100 }, 40);
  var before = run.traps.length;
  SkillRuntime.spawnEffect(w, snap, "n_minefield", { step: 1 });
  var added = run.traps.slice(before);

  check("6.1 布雷数量 = 等级表 trapCount（LV1 → G.run.traps 增加 " + lv1Trap + " 条）", added.length === lv1Trap);

  var shapeOk = added.length === lv1Trap && added.every(function (t) {
    return typeof t.x === "number" && typeof t.y === "number" && typeof t.radius === "number" &&
      typeof t.armDelay === "number" && t.armed === false && t.fuse === 0 &&
      t.owner === o && t.world === w && typeof t.dmg === "number";
  });
  check("6.2 每条含 x/y/radius/armDelay/armed:false/fuse:0/owner/world/dmg", shapeOk);

  var cnode = compileOne(sid).nodes["n_minefield"];
  var expDmg = Math.max(1, Math.round(snap.stats.atk * cnode.parameters.coefficient));
  check("6.3 dmg > 0 且 = round(快照 atk × 节点系数)（复算）",
    added.length > 0 && added.every(function (t) { return t.dmg > 0 && t.dmg === expDmg; }));
  check("6.4 radius === 节点 parameters.radius（直读 CFG）",
    added.length > 0 && added.every(function (t) { return t.radius === cnode.parameters.radius; }));

  /* 6.7 等级驱动复核：编译到 LV100 后该参数必须真的变大（否则「等级驱动」只是口号） */
  var cnode100 = compileOne(sid, 100).nodes["n_minefield"];
  check("6.7 等级驱动复核：LV100 编译后 parameters.trapCount = " + cnode100.parameters.trapCount + "（LV1 = " + lv1Trap + "）",
    cnode100.parameters.trapCount === maxTrap && cnode100.parameters.trapCount !== lv1Trap);

  var eff = w.__skillEffects[0];
  check("6.5 布雷不立即结算：效果实例 state = dead", !!eff && eff.state === "dead");
  check("6.6 布雷不立即结算：范围内怪未掉血", mon.hp === 777);
}

/* ================= 7. summon（SK_DRONESWARM / H007）================= */
{
  var sid = "SK_DRONESWARM";
  var raw = nodeOf(sid);                                            // 原始 CFG 节点
  var tpl = CFG.skillSystem.effectTemplates[raw.templateId];
  check("7.0 前提：节点原始定义无 damageBasis，且模板 kind = summonUnit",
    !raw.damageBasis && !!tpl && tpl.kind === "summonUnit");

  var e = effectOf(sid);
  var o = { id: "H007", x: 0, y: 0 };
  var cnode = compileOne(sid).nodes["n_droneswarm"];

  // 7a 注入 Drone 类桩（字段名来自 _effectSummon 的构造调用）
  Drone = function (x, y, ang, hp, atk, fireCd, orbit, owner, isRepair) {
    this.x = x; this.y = y; this.ang = ang; this.hp = hp; this.atk = atk;
    this.fireCd = fireCd; this.orbit = orbit; this.owner = owner;
    this.isRepair = isRepair; this.world = null;
  };
  var run = setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  var w = mkW([]);
  SkillRuntime.spawnEffect(w, snapOf(o, sid, {}, 50), "n_droneswarm", { step: 1 });

  check("7.1 注入 Drone：G.run.drones 增加 params.count 条",
    run.drones.length === cnode.parameters.count && cnode.parameters.count === 3);

  /* 7.1b 等级驱动复核（B1 落库）：LV100 编译后 count 必须变大（3→6），
   * 否则「等级曲线」只是配置上的装饰字段。 */
  var cnode100 = compileOne(sid, 100).nodes["n_droneswarm"];
  check("7.1b 等级驱动复核：LV100 编译后 parameters.count = " + cnode100.parameters.count + "（LV1 = " + cnode.parameters.count + "）",
    cnode100.parameters.count === 6 && cnode100.parameters.count !== cnode.parameters.count);
  check("7.2 每架 d.world === world 且 d.owner === 施放者实体",
    run.drones.length > 0 && run.drones.every(function (d) { return d.world === w && d.owner === o; }));
  check("7.3 召唤物数值来自节点 parameters（hp / atk / fireCd）",
    run.drones.length > 0 && run.drones.every(function (d) {
      return d.hp === cnode.parameters.hp && d.atk === Math.max(1, Math.round(cnode.parameters.atk)) && d.fireCd === cnode.parameters.fireCd;
    }));

  // 7b 未注入 Drone → 优雅降级（不抛异常、drones 不变）
  Drone = null;
  var o2 = { id: "H007", x: 0, y: 0 };
  var run2 = setEnv(o2, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  var w2 = mkW([]);
  var threw = false;
  try { SkillRuntime.spawnEffect(w2, snapOf(o2, sid, {}, 51), "n_droneswarm", { step: 1 }); }
  catch (ex) { threw = true; }
  check("7.4 未注入 Drone：优雅降级（不抛异常、drones 不变）", !threw && run2.drones.length === 0);

  var eff2 = { effect: e, ownerId: o2.id, x: 0, y: 0, rt: { params: cnode.parameters } };
  var direct = SkillRuntime._effectSummon(w2, snapOf(o2, sid, {}, 52), eff2);
  check("7.5 未注入 Drone：_effectSummon 直接返回 false", direct === false);
}

/* ================= 8. 零回归（effect 缺省 = 纯伤害，v1 语义）================= */
{
  var sid = "SK_FIREBALL";
  var raw = nodeOf(sid);
  check("8.0 前提：SK_FIREBALL 节点 effect 缺省（未声明附加效果）", raw.effect === undefined);

  var o = { id: "H001", x: 0, y: 0 };
  var run = setEnv(o, { hp: 0, hpMax: 1000, companions: [], buffs: [], traps: [], drones: [] });
  var w = mkW([]);
  var snap = snapOf(o, sid, { atk: 100 }, 60);
  SkillRuntime.spawnEffect(w, snap, "n_fireball", { step: 1 });
  var made = w.__skillEffects.slice();
  check("8.1 effect 缺省 → _applySpawnEffects 零介入（返回 0）", SkillRuntime._applySpawnEffects(w, snap, made) === 0);
  check("8.2 effect 缺省 → G.run.buffs / traps / drones 三容器不变",
    run.buffs.length === 0 && run.traps.length === 0 && run.drones.length === 0);
}

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("skill_effect_runtime_test 存在失败用例");
`;

vm.runInContext(driver, ctx, { filename: "driver" });
