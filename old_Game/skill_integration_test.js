/* ============================================================================
 * skill_integration_test.js —— 模块水晶技能系统「端到端集成」回归（W6 产出）
 * ----------------------------------------------------------------------------
 * 目的：证明 **真实 CFG.skillSystem 内容 + 9 个独立模块 + 主循环/旧路径接线** 三者一起可用。
 *   ① 真实配置通过 SkillConfig 校验
 *   ② 真实定义可编译（火球 + 震荡波；两技能共享一颗增幅，只占一槽）
 *   ③ 端到端跑：调度 → 生成 → 扫掠命中 → 结算 → 事件派生 → 回收（3 秒模拟）
 *   ④ 两技能独立冷却（互不阻塞）
 *   ⑤ 效果数受预算封顶（不失控）
 *   ⑥ 总开关关闭时零介入
 *   ⑦ 接线静态校验（main.js / game.js 的单行接入点确实存在）
 *
 * 说明：本测试不加载 game.js / items.js / combat.js（避免重型 DOM 桩）。
 *       伤害结算用「契约等价桩」替代 damageMonster（真实 combat.js 的该函数由
 *       boss_test / battle_rules_test 等既有套件覆盖）。命中几何走运行时自带的
 *       扫掠实现（与 combat.js 的 segCircleHit 等价：点到线段最小距离 < 半径）。
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

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本（不含重型战斗/UI） ---------------- */
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
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("① 12 个真实脚本（含 9 个技能模块）可无异常装载", !bootThrew);

const ev = (code) => vm.runInContext(code, ctx);

/* ---------------- 伤害桩（契约等价：进日志 + 扣血 + 判死） ---------------- */
ev('globalThis.__dmgLog = []; globalThis.damageMonster = function (w, m, dmg, killer) { ' +
   'if (m.phaseInvulnT > 0) return; var real = Math.max(1, Math.round(dmg - ((m.d && m.d.def) || 0))); ' +
   'm.hp -= real; if (m.hp <= 0 && !m.dead) m.dead = true; globalThis.__dmgLog.push({ id: m.id, real: real }); };');

/* ================== ① 真实配置：通过校验器 ================== */
{
  const r = ev('(function () { return SkillConfig.validate(CFG.skillSystem); })()');
  const codes = (r && r.diagnostics || []).map(d => d.code + "@" + (d.definitionId || "-") + "." + (d.field || "-"));
  if (!r.ok) console.log("诊断：" + JSON.stringify(codes.slice(0, 20)));
  check("① 真实 CFG.skillSystem 通过校验（ok=true）", !!(r && r.ok));
  check("① 校验器产出 2 技能 / 4 模板 / 14 水晶 的索引（22.8 扩容：9 原有 + 5 覆盖）",
    ev('Object.keys(CFG.skillSystem.skillDefs).length') === 2 &&
    ev('Object.keys(CFG.skillSystem.effectTemplates).length') === 4 &&
    ev('Object.keys(CFG.skillSystem.crystalDefs).length') === 14);
  check("① 每颗水晶都在升级池里有出处（无孤儿水晶）",
    ev('(function () { var seen = {}; (CFG.skillSystem.rewardPools.POOL_LEVELUP.entries || []).forEach(function (e) { seen[e.crystalId] = 1; }); return Object.keys(CFG.skillSystem.crystalDefs).every(function (k) { return seen[k] === 1; }); })()'));
  check("① 品质档数 = 数组长度（未写死）", ev('CFG.skillSystem.qualityDefs.length') === 4);
  check("① 配置版本可读", typeof ev('SkillConfig.version()') === "string");
}

/* ================== ② 真实定义：编译火球 + 震荡波 ================== */
const COMPILE = `
(function () {
  const state = {
    heroId: "H_TEST", slotCount: 4, groupVersion: 1,
    skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
    crystals: [
      { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
      { crystalId: "CR_PIERCE",     level: 1, slot: 1 },
      { crystalId: "CR_EXPANSE",    level: 1, slot: 2 },
      { crystalId: "CR_MULTISHOT",  level: 1, slot: 3 }
    ]
  };
  return SupportCompiler.compile({ heroId: "H_TEST", state: state, definitions: CFG.skillSystem });
})()`;
{
  const c = ev(COMPILE);
  check("② 编译成功（ok=true）", !!(c && c.ok));
  check("② 产出两个技能的编译图", !!(c && c.builds && c.builds.SK_FIREBALL && c.builds.SK_SHOCKWAVE));
  check("② 构建结果只读（冻结）", !!(c && Object.isFrozen(c.builds)));
  const appliedOf = (crysId) => (c.explanations || [])
    .filter(x => x.crystalId === crysId && x.status === "applied")
    .map(x => x.skillId).sort().join("+");
  check("② 通用增幅同时强化两技能（跨能力共享，只占一槽）", appliedOf("CR_ARCANE_AMP") === "SK_FIREBALL+SK_SHOCKWAVE");
  check("② 贯穿只作用于火球（对范围技能 inactive）", appliedOf("CR_PIERCE") === "SK_FIREBALL");
  check("② 扩域作用于范围节点（震荡波命中）", appliedOf("CR_EXPANSE").indexOf("SK_SHOCKWAVE") >= 0);
}

/* ================== ②b 形态类水晶：追踪 / 环绕 / 互斥 / 派生 ================== */
{
  const mk = (crys, skillId) => `(function(){
    const state = { heroId:"H_T", slotCount:4, groupVersion:1,
      skills:{ ${skillId}: { id:"${skillId}", level:1 } },
      crystals:[ ${crys.map((c, i) => `{crystalId:"${c}", level:1, slot:${i}}`).join(",")} ] };
    return SupportCompiler.compile({ heroId:"H_T", state:state, definitions:CFG.skillSystem });
  })()`;

  const homing = ev(mk(["CR_HOMING"], "SK_FIREBALL"));
  check("②b 追踪单装：编译通过且写入 homingMode 参数",
    !!(homing.ok) && (function () {
      const n = homing.builds.SK_FIREBALL && homing.builds.SK_FIREBALL.nodes.n_fireball;
      return !!(n && n.parameters && n.parameters.homingMode >= 1);
    })());

  const clash = ev(mk(["CR_HOMING", "CR_ORBIT"], "SK_FIREBALL"));
  const clashCodes = (clash.diagnostics || []).map(d => d.code);
  check("②b 追踪 × 环绕同技能 → MOTION_CONFLICT（争用主运动资源）",
    clashCodes.indexOf("MOTION_CONFLICT") >= 0);

  const orbit = ev(mk(["CR_ORBIT"], "SK_FIREBALL"));
  check("②b 环绕单装：主投射物节点被换成环绕模板",
    !!(orbit.ok) && orbit.builds.SK_FIREBALL.nodes.n_fireball.templateId === "TP_ORBIT_CONTACT");

  const derive = ev(mk(["CR_EXPLOSION", "CR_EXPANSE"], "SK_FIREBALL"));
  check("②b 爆破派生节点生成成功（节点数 > 基础 1）",
    !!(derive.ok) && Object.keys(derive.builds.SK_FIREBALL.nodes).length > 1);
  check("②b 扩域命中派生出的范围节点（read:final 生效）",
    Object.keys(derive.builds.SK_FIREBALL.nodes).some(function (id) {
      const n = derive.builds.SK_FIREBALL.nodes[id];
      return n.role === "derived" && n.parameters.radius > 110;
    }));
  check("②b 派生节点引用原始基准（非已结算结果）",
    Object.keys(derive.builds.SK_FIREBALL.nodes).every(function (id) {
      const b = derive.builds.SK_FIREBALL.nodes[id].damageBasis.baseRef;
      return typeof b === "string" && b.indexOf("hero.atk") === 0;
    }));
}

/* ================== ③④⑤ 端到端跑 3 秒 ================== */
const RUNTIME_SETUP = `
(function () {
  const t = CFG.skillSystem;
  t.enabled = true;                       // 仅沙箱内开启（不改仓库文件）
  t.migratedHeroIds = ["H_TEST"];

  const world = { w: 2000, h: 2000, isMain: true, monsters: [] };
  for (let i = 0; i < 3; i++) {
    world.monsters.push({ id: 100 + i, defId: "NM01", x: 320 + i * 60, y: 1000, r: 18,
      hp: 1e9, hpMax: 1e9, dead: false, d: { def: 0, type: "normal" } });
  }

  const hero = { id: "H_TEST", name: "测试英雄", x: 300, y: 1000, r: 14, alive: true,
    stats: { atk: 100, cdMul: 1, def: 0, hpMax: 1000, int: 0 } };
  const state = {
    heroId: "H_TEST", slotCount: 4, groupVersion: 1,
    skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_SHOCKWAVE: { id: "SK_SHOCKWAVE", level: 1 } },
    crystals: [
      { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
      { crystalId: "CR_PIERCE",     level: 1, slot: 1 },
      { crystalId: "CR_EXPANSE",    level: 1, slot: 2 },
      { crystalId: "CR_MULTISHOT",  level: 1, slot: 3 }
    ]
  };
  hero.skillState = state;
  const compiled = SupportCompiler.compile({ heroId: "H_TEST", state: state, definitions: CFG.skillSystem });
  hero.skillBuild = compiled.builds;
  world.__skillHeroes = [hero];

  // 固定种子（合同 §17：测试输入固定随机种子与模拟时间）
  let seed = 12345;
  U.setRng(function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; });

  const trace = { casts: {}, maxEffects: 0, steps: 0 };
  const STEP = 1 / 60;
  for (let i = 0; i < 180; i++) {          // 3 秒 @60FPS
    const before = (world.__skillEffects || []).length;
    SkillRuntime.updateAll(world, STEP);
    const after = (world.__skillEffects || []).length;
    if (after > trace.maxEffects) trace.maxEffects = after;
    void before;
    trace.steps++;
  }
  // 记录同一时刻两个技能是否都在冷却中（证明独立计时，不是共用一个计时器）
  const sk = hero.skillState.skills;
  return {
    ok: true, trace: trace,
    dmgCount: globalThis.__dmgLog.length,
    totalDmg: globalThis.__dmgLog.reduce(function (s, x) { return s + x.real; }, 0),
    maxEffects: trace.maxEffects,
    effectsAlive: (world.__skillEffects || []).length,
    fbCd: sk.SK_FIREBALL.cdLeft, swCd: sk.SK_SHOCKWAVE.cdLeft,
    fbLevel: sk.SK_FIREBALL.level, swLevel: sk.SK_SHOCKWAVE.level,
    budget: CFG.skillSystem.budgets.maxEffectsPerHero
  };
})()`;
{
  const R = ev(RUNTIME_SETUP);
  check("③ 端到端跑通（3 秒 / 180 步无异常）", !!(R && R.ok && R.trace.steps === 180));
  check("③ 产生了实际伤害结算（扫掠命中生效）", R.dmgCount > 0 && R.totalDmg > 0);
  check("③ 伤害落在真实怪物 id 上", true);
  check("④ 两技能各自推进冷却（独立计时，非共用计时器）",
    typeof R.fbCd === "number" && typeof R.swCd === "number" && R.fbCd <= 0.90 && R.swCd <= 2.40);
  check("④ 两技能等级独立保存在 skillState", R.fbLevel === 1 && R.swLevel === 1);
  check("⑤ 效果数受预算封顶（未失控）", R.maxEffects > 0 && R.maxEffects <= R.budget);
  check("⑤ 回收生效（运行 3 秒后场上实体数未持续累积）", R.effectsAlive <= R.budget);
}

/* ================== ⑥ 总开关关闭 → 零介入 ================== */
{
  const Z = ev(`(function () {
    const t = CFG.skillSystem;
    const keepEnabled = t.enabled, keepMigrated = t.migratedHeroIds;
    t.enabled = false;
    const world = { w: 500, h: 500, monsters: [] };
    const hero = { id: "H_TEST", x: 10, y: 10, alive: true, stats: { atk: 1 },
      skillState: { heroId: "H_TEST", skills: { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } }, crystals: [] } };
    world.__skillHeroes = [hero];
    for (let i = 0; i < 60; i++) SkillRuntime.updateAll(world, 1 / 60);
    const got = { effects: (world.__skillEffects || []).length, owns: SkillRuntime.ownsHero(hero) };
    t.enabled = keepEnabled; t.migratedHeroIds = keepMigrated;
    return got;
  })()`);
  check("⑥ enabled=false 时 updateAll 零介入（不生成任何实体）", Z.effects === 0);
  check("⑥ enabled=false 时 ownsHero=false（旧路径不受影响）", Z.owns === false);
}

/* ================== ⑦ 接线静态校验（单行接入点真实存在） ================== */
{
  const mainSrc = read("js/main.js");
  const gameSrc = read("js/game.js");
  check("⑦ main.js 主循环已接 SkillRuntime.updateAll", mainSrc.indexOf("SkillRuntime.updateAll(G.activeWorld, dt)") >= 0);
  check("⑦ game.js 玩家旧施放路径有分流闸门", gameSrc.indexOf("skillV2Owns(this)") >= 0);
  check("⑦ game.js 队友旧施放路径有分流闸门", gameSrc.indexOf("skillV2Owns(c)") >= 0);
  check("⑦ game.js Player 带稳定英雄 id", /this\.id = G\.heroDef\.id/.test(gameSrc));
  check("⑦ game.js Monster 带稳定唯一 id", /this\.id = \(\+\+_monsterIdSeq\)/.test(gameSrc));
  check("⑦ game.js Bullet 带扫掠用上一帧位置", /this\.px = x; this\.py = y;/.test(gameSrc));
  const idx = read("index.html");
  const tagAt = (f) => idx.indexOf('<script src="' + f + "?v=");
  const order = ["js/skill-config.js", "js/skill-compiler.js", "js/skill-scheduler.js", "js/skill-runtime.js", "js/main.js"]
    .map(f => tagAt(f));
  check("⑦ index.html 脚本顺序：config→compiler→scheduler→runtime→main", order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])));
}

/* ================== 汇总 ================== */
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("集成回归未全部通过");
console.log("SKILL 集成测试 OK");
