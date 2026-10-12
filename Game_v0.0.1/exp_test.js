/* 无头测试：第 1 步战斗主链路（第十九章 19.1 / 19.4 / 19.8）
 * 覆盖：普攻移除（英雄/队友都不再有 basic 发射）/ 主动技能全自动释放（无需 autoFight 或 Space）/
 *       经验曲线 fastEarly 公式化 / 升级不再发卡牌、改为全队即时属性（baseStatGain）/
 *       结晶口径：小怪击杀退役，只留 BOSS 结晶（撤离/死亡两态）（node exp_test.js）
 */
"use strict";

/* ---- DOM / Canvas 桩（与 freeze_test 同款） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { ctxCalls.push([p, a]); };
  },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }
  const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);

  /* ============ 一、配置存在（19.1 / 19.4 / 19.8） ============ */
  check("CFG.basicAttack.removed = true（普攻已移除）", CFG.basicAttack && CFG.basicAttack.removed === true);
  check("敌人侧 basic 条目保留（keepEntriesForMonster）", CFG.basicAttack.keepEntriesForMonster === true);
  check("CFG.levelUp.expSource = participation", CFG.levelUp && CFG.levelUp.expSource === "participation");
  check("CFG.levelUp.curve.shape = fastEarly", CFG.levelUp.curve && CFG.levelUp.curve.shape === "fastEarly");
  check("CFG.levelUp.baseStatGain 存在（hp/atk/def）", !!(CFG.levelUp.baseStatGain && CFG.levelUp.baseStatGain.hp != null && CFG.levelUp.baseStatGain.atk != null && CFG.levelUp.baseStatGain.def != null));

  /* ============ 二、经验曲线：fastEarly 公式驱动（19.4） ============ */
  {
    const c = CFG.levelUp.curve;
    const want = (lv) => { let v = c.base * Math.pow(c.growth, lv - 1); if (lv <= c.softCapLv) v *= c.softCapMul; return Math.max(1, Math.round(v)); };
    check("LV1→2 需求 = base×softCap = " + want(1), typeof expNextFor === "function" && expNextFor(1) === want(1));
    check("LV12→13 仍在 softCap 内（×0.7）", expNextFor(12) === want(12) && expNextFor(12) < c.base * Math.pow(c.growth, 11));
    check("LV13→14 起脱离 softCap", expNextFor(13) === want(13) && expNextFor(13) > expNextFor(12));
    let mono = true;
    for (let lv = 1; lv < 30; lv++) if (expNextFor(lv + 1) <= expNextFor(lv)) { mono = false; break; }
    check("曲线单调递增（LV1~30）", mono);
    check("LV99 曲线不溢出（有限值）", Number.isFinite(expNextFor(99)) && expNextFor(99) > 0);
    // startRun 初始 expNext 用新曲线
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    check("开局 expNext = expNextFor(1)", G.run.expNext === expNextFor(1));
  }

  /* ============ 三、升级奖励：不发卡牌，改全队即时属性（19.4） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    const r = G.run, g = CFG.levelUp.baseStatGain;
    check("开局 cardAssets = 0", r.cardAssets === 0);
    // 升 2 级（喂足经验）
    gainExp(r.expNext + expNextFor(2) + 1);
    check("升级后 LV = 3", r.lv === 3);
    check("升级不再发放卡牌资产（cardAssets 恒 0）", r.cardAssets === 0);
    const bo = runBonus();
    check("全队即时属性：hp 加成 = baseStatGain.hp×2", near(bo.add.hp, g.hp * 2));
    check("全队即时属性：atk 加成 = baseStatGain.atk×2", near(bo.add.atk, g.atk * 2));
    check("全队即时属性：def 加成 = baseStatGain.def×2", near(bo.add.def, g.def * 2));
    // 队长 computeStats 真的吃到（hpMax 变大）
    const st = computeStats();
    check("队长 hpMax 含升级成长（> 英雄基础值）", st.hpMax > CFG.heroes[0].hp);
  }

  /* ============ 四、结晶口径：小怪退役，只留 BOSS（19.8） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    const before = Meta.data.crystals;
    check("撤离：999 杀无 BOSS → 0 结晶（crystalKill 退役）", Meta.awardRun(999, false, true) === 0);
    check("撤离：999 杀 + BOSS → 仅 crystalBoss（kills 不参与）", Meta.awardRun(999, true, true) === CFG.outLevel.crystalBoss);
    check("死亡：BOSS 击杀过 → floor(crystalBoss × deathRatio)", Meta.awardRun(999, true, false) === Math.floor(CFG.outLevel.crystalBoss * CFG.outLevel.deathRatio));
    check("死亡：无 BOSS → 0 结晶", Meta.awardRun(999, false, false) === 0);
    check("结晶确实入账（存档增加）", Meta.data.crystals > before);
  }

  /* ============ 五、普攻移除 + 技能全自动（19.1） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    Game.loop(t);   // 注册主循环后 step() 才可用（同 freeze_test：DOMContentLoaded 桩不触发，需手动续帧一次）
    const w = G.mainWorld, p = G.player;
    // 造一只怪在射程内（有目标）
    const m = new Monster("NM0010", p.x + 220, p.y, G.levelCfg.monsterLevel || 1);
    w.monsters.push(m);
    // ① 无普攻：多帧后玩家侧不存在 isSkill=false 子弹
    w.playerBullets.length = 0;
    p.skillTimer = 999;   // 普攻冷却已无意义（fireTimer 已退役）；压技能冷却 → 若仍有普攻路径会露馅
    step(30);
    const basicShots = w.playerBullets.filter(b => !b.isSkill).length;
    check("普攻已移除：30 帧内无 isSkill=false 玩家子弹", basicShots === 0);
    // ② 技能全自动：不开 autoFight、不按 Space，冷却好即释放（19.3 冷却制，无能量门槛）
    check("前置：autoFight 未开启", G.run.autoFight === false);
    check("前置：Space 未按下", !G.keys[" "]);
    G.run.energy = G.run.energyMax;
    p.skillTimer = 0;
    w.playerBullets.length = 0;
    step(3);
    const skillShots = w.playerBullets.filter(b => b.isSkill).length;
    check("技能全自动释放（无需 autoFight / Space）", skillShots > 0 || G.run.drones.length > 0 || G.run.traps.length > 0);
    check("施放后进入冷却（skillTimer > 0）", p.skillTimer > 0);
    check("施放后能量不再被消耗（冷却制已生效，19.3）", G.run.energy === G.run.energyMax);
  }

  /* ============ 六、队友：无普攻，技能照旧自动放 ============ */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[2]]);
    Game.skipIntroFreeze();
    const w = G.mainWorld, p = G.player;
    const m = new Monster("NM0010", p.x + 220, p.y, G.levelCfg.monsterLevel || 1);
    w.monsters.push(m);
    const c = G.run.companions[0];
    check("队友存在", !!c);
    // 队友不普攻
    c.skillTimer = 999; c.energy = 0;   // 压技能冷却（19.3 后能量不再参与门槛）
    w.playerBullets.length = 0;
    step(30);
    const cBasic = w.playerBullets.filter(b => !b.isSkill && b.owner === c).length;
    check("队友普攻已移除（无 isSkill=false 且 owner=队友 的子弹）", cBasic === 0);
    // 队友技能照常（19.3 冷却制：能量为 0 也能释放）
    c.energy = 0; c.skillTimer = 0;
    w.playerBullets.length = 0;
    step(5);
    const cSkill = w.playerBullets.filter(b => b.isSkill && b.owner === c).length;
    check("队友技能照常自动释放（冷却制：能量为 0 也释放，19.3）", cSkill > 0 || G.run.drones.length > 0 || G.run.traps.length > 0);
  }

  /* ============ 七、经验宝石仍为中立掉落 → 队池（参与伤害语义，19.4） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    const w = G.mainWorld, p = G.player;
    const m = new Monster("NM0010", p.x + 100, p.y, 1);
    w.monsters.push(m);
    const lv0 = G.run.lv;
    // 直接击杀（模拟参与伤害后的死亡结算）：宝石掉落为中立拾取物
    m.hp = 1; damageMonster(w, m, 999);
    const gem = w.pickups.find(pk => pk.type === "exp");
    check("怪死亡掉落经验宝石（中立拾取物，任何成员拾取均入队池）", !!gem);
    // 拾取 → gainExp → 队池
    const exp0 = G.run.exp;
    if (gem) { gainExp(gem.value); }
    check("经验入队池（r.exp 增加，无个人归属）", G.run.exp !== exp0 || G.run.lv !== lv0);
  }

  /* ============ 八、第 2 步：冷却制 + 三定位 + 维修无人机（19.2 / 19.3） ============ */
  {
    // ① 技能资源 = 冷却制
    check("CFG.skillResource.mode = cooldown", CFG.skillResource && CFG.skillResource.mode === "cooldown");
    check("CFG.skillResource.startReady = true", CFG.skillResource.startReady === true);
    // ② 英雄三定位映射锁定
    const by = CFG.heroRoles.byHero;
    check("定位-H001/H002/H003/H006 = output",
      by.H001 === "output" && by.H002 === "output" && by.H003 === "output" && by.H006 === "output");
    check("定位-H004/H005/H008 = defense", by.H004 === "defense" && by.H005 === "defense" && by.H008 === "defense");
    check("定位-H007 = aux（辅助型）", by.H007 === "aux");
    // ③ requireAll 三定位齐全
    const need = CFG.heroRoles.requireAll || [];
    const got = new Set(Object.keys(by).map(k => by[k]));
    check("定位-requireAll 三定位齐全（output/defense/aux）",
      need.every(r => got.has(r)) && need.indexOf("output") >= 0 && need.indexOf("defense") >= 0 && need.indexOf("aux") >= 0);
    check("定位-三定位定义均有 name/color", need.every(r => CFG.heroRoles[r] && CFG.heroRoles[r].name && CFG.heroRoles[r].color));

    // ④ 冷却制：能量为 0 时队长技能仍释放（无能量门槛）
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();
    const w = G.mainWorld, p = G.player;
    w.monsters.length = 0;
    w.monsters.push(new Monster("NM0010", p.x + 200, p.y, 1));
    G.run.energy = 0; p.skillTimer = 0;
    w.playerBullets.length = 0;
    for (let i = 0; i < 3; i++) p.update(w, 0.016);
    check("冷却制-队长能量为 0 仍释放技能（无能量门槛）",
      w.playerBullets.filter(b => b.isSkill).length > 0 || G.run.drones.length > 0 || G.run.traps.length > 0);
    // 冷却好 → 立即再放；冷却未到 → 不放
    p.skillTimer = 0; w.playerBullets.length = 0;
    for (let i = 0; i < 3; i++) p.update(w, 0.016);
    check("冷却制-冷却好即再放（skillTimer 重置 > 0）", p.skillTimer > 0);
    p.skillTimer = 1.0; w.playerBullets.length = 0;
    for (let i = 0; i < 3; i++) p.update(w, 0.016);
    check("冷却制-冷却中不释放（skillTimer 仍 > 0 且无新弹）",
      p.skillTimer > 0 && w.playerBullets.filter(b => b.isSkill).length === 0);

    // ⑤ skillTimer 语义正确（界面冷却环契约：剩余秒 = cd × cdMul，逐帧递减）
    p.skillTimer = 0; w.playerBullets.length = 0;
    p.update(w, 0.016);
    const cd0 = G.run.weapon.skill.cd * computeStats().cdMul;
    check("冷却环契约-skillTimer 释放后 = cd × cdMul（≈" + cd0.toFixed(3) + "）", near(p.skillTimer, cd0 - 0.016, 0.02));
    const before = p.skillTimer; p.update(w, 0.016);
    check("冷却环契约-skillTimer 逐帧递减", p.skillTimer < before);

    // ⑥ 维修无人机：技能表挂了 repair 标记 + CFG 数值齐全
    check("维修-AT113 技能表标 repair:true", CFG.skills.AT113 && CFG.skills.AT113.repair === true);
    check("维修-CFG.skills2.repairDrone 数值齐全（healPerSec/repairInterval）",
      CFG.skills2 && CFG.skills2.repairDrone && CFG.skills2.repairDrone.healPerSec > 0 && CFG.skills2.repairDrone.repairInterval > 0);
    check("维修-AT113 ID 在 repairDrone.skillIds 内", (CFG.skills2.repairDrone.skillIds || []).indexOf("AT113") >= 0);
  }

  /* ============ 九、维修无人机行为：治疗 HP 比例最低的己方成员（19.2） ============ */
  {
    // 召唤师 H007 为队长（AT113 = 维修无人机）
    Game.startRun([CFG.heroes[6], CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const w = G.mainWorld, r = G.run, p = G.player;
    r.drones.length = 0;
    const sk = resolveSkill(CFG.skills.AT113, 1, { dmgMul: 1, cdMul: 1, bullets: 0 });
    SkillSystem.cast(w, p, sk, null, { atk: 10 });
    check("维修-无人机已召唤（" + r.drones.length + " 架）", r.drones.length > 0);
    check("维修-无人机带 repair 标记（AT113 判定）", r.drones.every(d => d.repair === true));

    // 队长（召唤师）残血：治疗应给 HP 比例最低者 = 队长
    const c0 = r.companions[0];
    r.hp = Math.max(1, r.hpMax - 50);         // 队长残血
    c0.hp = c0.hpMax;                          // 队友满血
    const hpB = r.hp;
    const dr = r.drones[0];
    dr.repairTimer = 0;                        // 立即触发一次修理
    dr.update(w, 0.016);
    check("维修-为 HP 比例最低者（队长）回血（" + hpB + " → " + r.hp + "）", r.hp > hpB);
    check("维修-治疗量 = healPerSec（单次结算）", near(r.hp - hpB, CFG.skills2.repairDrone.healPerSec, 0.001));
    // 绿字提示（spawnFloat 走 #7de08a）
    const greens = global.__ctxCalls.filter(c => c[0] === "set:fillStyle" && c[1][0] === "#7de08a").length;
    check("维修-走 spawnFloat 绿字提示（#7de08a）", greens > 0);

    // 队友残血更狠 → 切给队友
    r.hp = r.hpMax; c0.hp = Math.max(1, c0.hpMax - 80);
    const chpB = c0.hp;
    dr.repairTimer = 0; dr.update(w, 0.016);
    check("维修-改治 HP 比例更低的队友（" + chpB + " → " + c0.hp + "）", c0.hp > chpB);

    // 不超 hpMax：全员接近满血时按缺口夹紧
    r.hp = r.hpMax; c0.hp = c0.hpMax - 1;
    dr.repairTimer = 0; dr.update(w, 0.016);
    check("维修-治疗不超 hpMax（缺口 1 → 回复 1）", c0.hp === c0.hpMax);

    // 全员满血：不治疗
    r.hp = r.hpMax; c0.hp = c0.hpMax;
    const beforeFull = global.__ctxCalls.length;
    dr.repairTimer = 0; dr.update(w, 0.016);
    const newGreen = global.__ctxCalls.slice(beforeFull).filter(c => c[0] === "set:fillStyle" && c[1][0] === "#7de08a").length;
    check("维修-全员满血不治疗（无绿字）", newGreen === 0);

    // 非维修型无人机（H001 的 AT113 手工施放）不带 repair 标记也不治疗
    const skNoRepair = resolveSkill(CFG.skills.AT113, 1, { dmgMul: 1, cdMul: 1, bullets: 0 });
    skNoRepair.repair = false;    // 模拟非维修技能
    r.drones.length = 0;
    SkillSystem.cast(w, p, skNoRepair, null, { atk: 10 });
    check("维修-未标 repair 的召唤物不带维修行为", r.drones.every(d => d.repair === false));
  }

  console.log(ok ? "EXP OK" : "EXP FAILED");
  if (!ok) throw new Error("exp_test FAILED");
`;

try {
  vm.runInContext(driver, ctx, { filename: "exp_test-driver" });
} catch (e) {
  console.error(e && e.stack || e);
  process.exit(1);
}
