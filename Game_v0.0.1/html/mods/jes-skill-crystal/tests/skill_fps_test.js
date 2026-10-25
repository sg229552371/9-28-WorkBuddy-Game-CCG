/* ============================================================================
 * skill_fps_test.js —— 模块水晶技能系统「帧率一致性」测试（W6 产出 · 合同 §17）
 * ----------------------------------------------------------------------------
 * 目的：证明技能系统是 **dt 驱动** 而非步驱动 —— 同一场景在固定 30 / 60 / 120 FPS
 *       以及抖动 dt 下，累计伤害 / 施放数 / 实体数 / 结束状态在允许离散误差内一致。
 * 方法：同随机种子、同目标布置、同模拟总时长 T；三种固定帧率 + 一段抖动 dt。
 * 口径：PASS 行禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * 说明：本测试用「契约等价伤害桩」替代 damageMonster（与 combat.js 的该函数同义：
 *       扣血 + 判死）；真实战斗结算由 battle_rules_test / boss_test 覆盖。
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

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本（不含重型战斗/UI） ---------------- */
const FILES = [
  "js/config.js", "js/core.js", "js/pool.js",
  "mods/jes-skill-crystal/systems/skill-config.js", "mods/jes-skill-crystal/systems/skill-compiler.js", "mods/jes-skill-crystal/systems/skill-damage.js",
  "mods/jes-skill-crystal/systems/skill-events.js", "mods/jes-skill-crystal/systems/skill-scheduler.js", "mods/jes-skill-crystal/systems/skill-runtime.js",
  "mods/jes-skill-crystal/systems/skill-reward.js", "mods/jes-skill-crystal/systems/skill-presenter.js", "mods/jes-skill-crystal/systems/skill-save.js",
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("帧率测试：12 个真实脚本可无异常装载", !bootThrew);

const ev = (code) => vm.runInContext(code, ctx);

/* ---------------- 伤害桩（契约等价：进日志 + 扣血 + 判死） ---------------- */
ev('globalThis.__dmgLog = []; globalThis.damageMonster = function (w, m, dmg, killer) { ' +
   'if (m.phaseInvulnT > 0) return; var real = Math.max(1, Math.round(dmg - ((m.d && m.d.def) || 0))); ' +
   'm.hp -= real; if (m.hp <= 0 && !m.dead) m.dead = true; globalThis.__dmgLog.push({ id: m.id, real: real }); };');

/* ---------------- 场景运行器（在 vm 内执行；mode=fixed 用 fps，mode=jitter 用抖动 dt） ---------------- */
const RUNNER = `
globalThis.__runScenario = function (mode, fps, T) {
  const t = CFG.skillSystem;
  t.enabled = true;
  t.migratedHeroIds = ["H_FPS"];

  // 固定随机种子（合同 §17：输入固定随机种子与模拟时间）
  let seed = 987654321;
  U.setRng(function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; });

  globalThis.__dmgLog = [];

  const world = { w: 3000, h: 3000, isMain: true, monsters: [] };
  for (let i = 0; i < 5; i++) {
    world.monsters.push({ id: 200 + i, defId: "NM01",
      x: 300 + (i % 3) * 40, y: 900 + Math.floor(i / 3) * 40, r: 18,
      hp: 1e12, hpMax: 1e12, dead: false, d: { def: 0, type: "normal" } });
  }
  const hero = { id: "H_FPS", name: "帧率英雄", x: 260, y: 940, r: 14, alive: true,
    stats: { atk: 100, cdMul: 1, def: 0, hpMax: 100000, int: 0 } };
  const state = {
    heroId: "H_FPS", slotCount: 4, groupVersion: 1,
    skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
    crystals: [
      { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
      { crystalId: "CR_PIERCE",     level: 1, slot: 1 },
      { crystalId: "CR_EXPANSE",    level: 1, slot: 2 },
      { crystalId: "CR_MULTISHOT",  level: 1, slot: 3 }
    ]
  };
  hero.skillState = state;
  hero.skillBuild = SupportCompiler.compile({ heroId: "H_FPS", state: state, definitions: CFG.skillSystem }).builds;
  world.__skillHeroes = [hero];

  // 施放计数：轻量包装调度器（统计每步产生的施放请求数）
  let castCount = 0;
  const origTick = SkillScheduler.tick;
  SkillScheduler.tick = function (w, h, dt) {
    const r = origTick.call(this, w, h, dt);
    castCount += (r.requests ? r.requests.length : 0);
    return r;
  };

  let elapsed = 0, steps = 0, maxEffects = 0;
  while (elapsed < T - 1e-9) {
    let dt;
    if (mode === "jitter") dt = U.rand(1 / 120, 1 / 60);                     // [1/120, 1/60] 抖动
    else dt = 1 / fps;
    if (elapsed + dt > T) dt = T - elapsed;
    SkillRuntime.updateAll(world, dt);
    elapsed += dt; steps++;
    const n = (world.__skillEffects || []).length;
    if (n > maxEffects) maxEffects = n;
  }
  SkillScheduler.tick = origTick;

  const sk = hero.skillState.skills;
  let total = 0;
  for (let i = 0; i < globalThis.__dmgLog.length; i++) total += globalThis.__dmgLog[i].real;
  return {
    mode: mode, fps: fps, steps: steps, elapsed: elapsed,
    castCount: castCount,
    dmgCount: globalThis.__dmgLog.length,
    totalDmg: total,
    maxEffects: maxEffects,
    effectsAlive: (world.__skillEffects || []).length,
    fbCd: sk.SK_FIREBALL.cdLeft, swCd: sk.SK_SHOCKWAVE.cdLeft,
    budget: t.budgets.maxEffectsPerHero
  };
};
`;

ev(RUNNER);

const T = 12;   // 模拟总时长（秒）——足够覆盖多次冷却循环
const r30 = ev("__runScenario('fixed', 30, " + T + ")");
const r60 = ev("__runScenario('fixed', 60, " + T + ")");
const r120 = ev("__runScenario('fixed', 120, " + T + ")");
const rJit = ev("__runScenario('jitter', 0, " + T + ")");

console.log("--- 帧率一致性原始数据（T=" + T + "s）---");
for (const r of [r30, r60, r120, rJit]) {
  console.log("  " + (r.mode === "jitter" ? "jitter      " : ("fps=" + String(r.fps).padEnd(4))) +
    " steps=" + String(r.steps).padEnd(5) +
    " casts=" + String(r.castCount).padEnd(3) +
    " dmgHits=" + String(r.dmgCount).padEnd(5) +
    " totalDmg=" + r.totalDmg +
    " maxFx=" + r.maxEffects + " aliveFx=" + r.effectsAlive +
    " fbCd=" + (Math.round(r.fbCd * 1000) / 1000) + " swCd=" + (Math.round(r.swCd * 1000) / 1000));
}

/* ---------------- 断言 1：三种固定帧率都跑通且产生伤害 ---------------- */
check("① 30 FPS 跑通并产生伤害", r30.steps === T * 30 && r30.totalDmg > 0);
check("① 60 FPS 跑通并产生伤害", r60.steps === T * 60 && r60.totalDmg > 0);
check("① 120 FPS 跑通并产生伤害", r120.steps === T * 120 && r120.totalDmg > 0);

/* ---------------- 断言 2：施放数跨帧率一致（冷却按 dt 累计；帧边界最多差 1 次） ---------------- */
const castMin = Math.min(r30.castCount, r60.castCount, r120.castCount);
const castMax = Math.max(r30.castCount, r60.castCount, r120.castCount);
check("② 施放数跨帧率一致（极差 ≤ 1：" + castMin + "~" + castMax + "）", castMax - castMin <= 1);

/* ---------------- 断言 3：累计伤害跨帧率一致（相对离散误差 ≤ 10%） ---------------- */
const dmgArr = [r30.totalDmg, r60.totalDmg, r120.totalDmg];
const dmgMin = Math.min.apply(null, dmgArr), dmgMax = Math.max.apply(null, dmgArr);
const dmgMid = dmgArr.slice().sort((a, b) => a - b)[1];
const spread = (dmgMax - dmgMin) / dmgMid;
check("③ 累计伤害跨帧率一致（相对离散 ≤ 10%，实测 " + (Math.round(spread * 1000) / 10) + "%）", spread <= 0.10);

/* ---------------- 断言 4：实体数上限跨帧率一致（同受预算约束，且不失控） ---------------- */
const fxMax = Math.max(r30.maxEffects, r60.maxEffects, r120.maxEffects);
check("④ 峰值实体数不超预算（max=" + fxMax + " ≤ " + r60.budget + "）", fxMax > 0 && fxMax <= r60.budget);
check("④ 终态活动实体数有限（30/60/120 分别 " + r30.effectsAlive + "/" + r60.effectsAlive + "/" + r120.effectsAlive + "）",
  r30.effectsAlive <= r60.budget && r60.effectsAlive <= r60.budget && r120.effectsAlive <= r60.budget);

/* ---------------- 断言 5：抖动 dt 与固定帧率同量级（不因帧长波动而放大结果） ---------------- */
const jitDev = Math.abs(rJit.totalDmg - dmgMid) / dmgMid;
check("⑤ 抖动 dt 累计伤害与固定帧率同量级（偏差 " + (Math.round(jitDev * 1000) / 10) + "% ≤ 15%）", jitDev <= 0.15);
check("⑤ 抖动 dt 施放数一致（" + rJit.castCount + " ∈ " + castMin + "~" + castMax + "，极差 ≤ 2）",
  rJit.castCount >= castMin - 1 && rJit.castCount <= castMax + 1);

/* ---------------- 断言 6：结束状态一致（终态冷却均可读、非负） ---------------- */
const cdOk = [r30, r60, r120, rJit].every(function (r) {
  return typeof r.fbCd === "number" && r.fbCd >= 0 && typeof r.swCd === "number" && r.swCd >= 0;
});
check("⑥ 结束状态一致（终态两技能冷却可读且非负）", cdOk);

/* ---------------- 汇总 ---------------- */
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("帧率一致性测试未全部通过");
console.log("SKILL 帧率测试 OK");
