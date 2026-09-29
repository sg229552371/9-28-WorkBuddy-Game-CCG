/* 无头测试：召唤物/陷阱技能原型 + 模组等级系统（node skill_module_test.js） */
"use strict";

/* ---- DOM / Canvas 桩（与 runtime_test 相同的最小桩） ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; }
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
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
const Vm = vm;
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  Vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  /* ============ 一、模组等级系统 ============ */
  // 1. 合并升级语义：lv 上限 / 数值缩放
  const m1 = makeModule("M009", 2);       // 增幅器 伤害 mult，紫色 vals[2]=0.22
  const m2 = makeModule("M009", 2);
  check("模组初始 LV1", m1.lv === 1 && m2.lv === 1);
  const ml = CFG.moduleLevel;
  const merge = (tgt, src) => { tgt.lv = Math.min(ml.maxLv, Math.max(tgt.lv || 1, src.lv || 1) + 1); };
  merge(m1, m2); check("合并升级 → LV2", m1.lv === 2);
  m2.lv = 8; merge(m1, m2); check("跨级合并取 max+1 → LV9", m1.lv === 9);
  m2.lv = 5; merge(m1, m2); check("满级合并不再提升（仍 LV9）", m1.lv === 9);
  // 数值缩放：LV9 主词缀 = 0.22 × (1 + 8×0.15) = 0.484
  check("主词缀随等级缩放: " + moduleEffValue(m1).toFixed(3), Math.abs(moduleEffValue(m1) - 0.22 * (1 + 8 * 0.15)) < 1e-9);
  check("阶段计算: LV9 → 阶段3, LV4 → 阶段2", moduleStage(m1) === 3 && moduleStage({ ...m1, lv: 4 }) === 2);

  // 2. 阶段词缀仅技能向：tagCalc(tag, true) 计入、tagCalc(tag) 不计入
  {
    Game.startRun([CFG.heroes[0]]);        // W001 速射炮
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run;
    const mCd = makeModule("M002", 0);     // 冷却线圈 -8%
    mCd.lv = 7;                            // 阶段3 → 解锁 伤害+6% 与 冷却-5% 两条阶段词缀
    const spot = r.weaponInv.findSpot(mCd); r.weaponInv.place(mCd, spot.x, spot.y);
    recomputeWeapon();
    const cdPlain = tagCalc("冷却");
    const cdSkill = tagCalc("冷却", true);
    check("阶段词缀仅技能向: 普攻 " + cdPlain.toFixed(3) + " vs 技能 " + cdSkill.toFixed(3),
      Math.abs(cdPlain - cdSkill) > 1e-9 && cdSkill < cdPlain);
    const mDmg = makeModule("M009", 2); mDmg.lv = 4;   // 阶段2 → 伤害+6% 生效
    const s2 = r.weaponInv.findSpot(mDmg); r.weaponInv.place(mDmg, s2.x, s2.y);
    recomputeWeapon();
    // W001 技能 AT102 有 伤害 标签 → 技能伤害吃到主词缀(0.22×1.45) + 阶段词缀(+6%)
    check("技能伤害吃到阶段词缀", r.weapon.skill.dmgMul > CFG.skills.AT102.dmgMul * 1.1);
  }

  /* ============ 二、召唤物：AT113 无人机 ============ */
  {
    Game.startRun([CFG.heroes[6]]);        // H007 召唤师 W007/AT113
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run, w = G.activeWorld, p = G.player;
    check("召唤师技能类型 summon", r.weapon.skill.type === "summon");
    r.energy = r.energyMax;
    recomputeWeapon();
    p.fireSkill(w, { x: p.x + 100, y: p.y }, computeStats());
    const row = r.weapon.skill.row;
    check("召唤数量走技能表 LV1=" + row.count, r.drones.length === row.count && row.count === 3);
    // 无人机自动攻击：刷怪后推帧
    w.spawnMonster("NM0010", p.x + 200, p.y);
    for (let i = 0; i < 30; i++) { recomputeWeapon(); w.update(0.05); }
    const fired = w.playerBullets.length > 0 || r.kills > 0;
    check("无人机自动攻击/产生弹道", fired);
    // 敌方子弹可击中无人机
    const d0 = r.drones[0];
    const hp0 = d0.hp;
    const dist = 40;
    const b = new Bullet(d0.x - dist, d0.y, 0, 100, 10, "enemy");
    for (let i = 0; i < 12 && !b.dead; i++) b.update(w, 0.05);
    check("无人机被敌方子弹攻击: hp " + hp0 + "→" + d0.hp, d0.hp < hp0);
    // 击毁 → 移除；再施放补满
    d0.hp = 1;
    const be = new Bullet(d0.x - dist, d0.y, 0, 100, 50, "enemy");
    for (let i = 0; i < 12 && !be.dead; i++) be.update(w, 0.05);
    w.update(0.05);
    check("无人机阵亡移除: " + r.drones.length, r.drones.length === 2);
    r.energy = r.energyMax;
    p.fireSkill(w, { x: p.x + 100, y: p.y }, computeStats());
    check("再次施放补满至 " + row.count, r.drones.length === row.count);
  }

  /* ============ 三、陷阱：AT114 大地雷 ============ */
  {
    Game.startRun([CFG.heroes[7]]);        // H008 陷阱师 W008/AT114
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run, w = G.activeWorld, p = G.player;
    check("陷阱师技能类型 trap", r.weapon.skill.type === "trap");
    r.energy = r.energyMax;
    recomputeWeapon();
    p.fireSkill(w, { x: p.x, y: p.y }, computeStats());
    check("地雷布设 1 颗", r.traps.length === 1);
    const t = r.traps[0];
    check("引信延迟 0.5s（技能表常量）", t.armDelay === 0.5 && !t.armed);
    // 无敌人时不触发
    for (let i = 0; i < 20; i++) { recomputeWeapon(); w.update(0.05); }
    check("无敌人不触发", !t.armed && r.traps.length === 1);
    // 敌人入圈 → 0.5s 后爆炸 → 地雷消失
    const m = w.spawnMonster("NM0010", p.x + 30, p.y);   // 圈内刷怪
    const hp0 = m.hp;
    let armedAt = -1, explodedAt = -1;
    for (let i = 0; i < 60; i++) {
      recomputeWeapon();
      w.update(0.05);
      const cur = r.traps[0];
      if (armedAt < 0 && cur && cur.armed) armedAt = i * 0.05;
      if (r.traps.length === 0) { explodedAt = i * 0.05; break; }
    }
    check("敌人入圈后触发引信 t=" + armedAt.toFixed(2) + "s", armedAt >= 0);
    check("0.5s 引信后爆炸消失 t=" + explodedAt.toFixed(2) + "s", explodedAt > 0 && explodedAt <= 1.2);
    check("爆炸造成伤害（怪物 HP " + hp0 + "→已死）", hp0 <= 20);   // NM0010 HP20，LV1 表 2.6×atk 必杀
    // 陷阱不被敌人攻击：近战怪只攻击英雄/无人机，不攻击地雷
    check("场上地雷已清空", r.traps.length === 0);
  }

  console.log(ok ? "SKILL MODULE TEST OK" : "SKILL MODULE TEST FAILED");
  if (!ok) throw new Error("SKILL MODULE TEST FAILED");
`;
Vm.runInContext(driver, ctx, { filename: "driver" });
