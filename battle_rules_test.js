/* 无头测试：26.x 战斗/数值规则（node battle_rules_test.js）
 * 覆盖：
 *   一、掉落物停留时间可配（coin/crystal life=-1、exp 30、未登记回落 defaultLife）+ spawnPickup 读表
 *   二、同屏掉落物上限自动磁吸（超 maxPickups → 最旧的直接结算，价值不掉）
 *   三、敌人体型分层（NM 0.7 / ED 0.9 / BS 1.35；BOSS 逐只 sizeMul 覆盖；半径同步缩放）
 *   四、属性加成积木 scaleBy + 嘲讽技能 AT120（半径加成 / 强制锁定 / 超时与倒下解除）
 *   五、敌人构成远程:近战 ≈ 7:3（主关卡刷怪圆池 + 深渊普通怪池加权抽样）
 *   六、定位改名 auxiliary 口径（aux）+ 英雄 role/range 结构化字段 + statNames
 * 运行：node battle_rules_test.js
 * ⚠️ PASS 文案只含中文，禁止出现英文 error/FAIL（门禁口径，坑 4）。 */
"use strict";

/* ---- DOM / Canvas 桩（与 level_content_test.js 同款） ---- */
const ctxCalls = [];
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 300000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 300000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
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
global.window = { addEventListener() { }, innerWidth: 1920, innerHeight: 1080 };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice() { }, onLevelUpChoiceClose() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js", "js/endless.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);

  /* ============ 一、掉落物停留时间可配 ============ */
  check("一1 coin.life = -1（永不消失）", CFG.pickup.coin.life === -1);
  check("一2 crystal.life = -1（永不消失）", CFG.pickup.crystal.life === -1);
  check("一3 exp.life = 30（经验保持 30 秒）", CFG.pickup.exp.life === 30);
  check("一4 maxPickups 为正整数（性能兜底）", CFG.pickup.maxPickups > 0 && Number.isInteger(CFG.pickup.maxPickups));
  check("一5 pickupLife 读表：coin -1 / exp 30 / 未登记回落 defaultLife",
    pickupLife("coin") === -1 && pickupLife("exp") === 30 && pickupLife("gem") === CFG.pickup.defaultLife);
  check("一6 pickupAlive：-1 永存 / 0 已消 / >0 在场",
    pickupAlive({ life: -1 }) === true && pickupAlive({ life: 0 }) === false && pickupAlive({ life: 3 }) === true);

  /* startRun 建全量上下文 */
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  if (Game.skipLevelUpChoice) Game.skipLevelUpChoice();
  const w = G.mainWorld;

  w.pickups.length = 0;
  spawnPickup(w, 100, 100, "coin", 5);
  spawnPickup(w, 100, 100, "exp", 5);
  check("一7 spawnPickup 按表设 life（coin -1 / exp 30）",
    w.pickups[0].life === -1 && w.pickups[1].life === 30);

  /* ============ 二、同屏上限自动磁吸 ============ */
  w.pickups.length = 0; w.monsters.length = 0;
  G.run.coin = 0;
  const CAP = CFG.pickup.maxPickups;
  for (let i = 1; i <= CAP + 5; i++) w.pickups.push({ type: "coin", value: i, x: 10, y: 10, vx: 0, vy: 0, life: -1 });
  w.update(0.016);
  check("二1 超上限自动磁吸：最旧 5 枚直接入账（coin=" + G.run.coin + "）", G.run.coin === 1 + 2 + 3 + 4 + 5);
  check("二2 磁吸后同屏掉落物 = 上限（" + w.pickups.length + "）", w.pickups.length === CAP);
  check("二3 磁吸保留的是「较新的」掉落物（含 value=" + (CAP + 5) + "）",
    w.pickups.some(function (p) { return p.value === CAP + 5; }));

  /* ============ 三、敌人体型分层 ============ */
  check("三1 tier 表：normal 0.7 / elite 0.9 / boss 1.35",
    CFG.monsterSizeTier.normal === 0.7 && CFG.monsterSizeTier.elite === 0.9 && CFG.monsterSizeTier.boss === 1.35);
  check("三2 NM→normal / ED→elite / BS→boss 默认",
    monsterSizeTierMul("NM0010", CFG.monsters.NM0010) === 0.7
    && monsterSizeTierMul("ED0001", CFG.monsters.ED0001) === 0.9
    && monsterSizeTierMul("BS0004", CFG.monsters.BS0004) === 1.35);
  check("三3 BS 逐只覆盖 sizeMul（BS0001=1.2 / BS0003=1.5，落在 1.2~1.5）",
    monsterSizeTierMul("BS0001", CFG.monsters.BS0001) === 1.2
    && monsterSizeTierMul("BS0003", CFG.monsters.BS0003) === 1.5);
  const nm = new Monster("NM0010", 300, 300, 1);
  check("三4 普通怪半径 = 基础 × monsterSizeMul × 0.7（" + nm.r + "）",
    near(nm.r, CFG.monsters.NM0010.radius * CFG.monsterSizeMul * 0.7, 1e-9) && nm.sizeMul === 0.7);
  const bs = new Monster("BS0001", 300, 300, 1);
  check("三5 BOSS 半径 = 基础 × monsterSizeMul × 1.2（逐只覆盖）",
    near(bs.r, CFG.monsters.BS0001.radius * CFG.monsterSizeMul * 1.2, 1e-9) && bs.sizeMul === 1.2);
  const ed = new Monster("ED0001", 300, 300, 1);
  check("三6 精英半径 = 基础 × monsterSizeMul × 0.9（" + ed.r + "）",
    near(ed.r, CFG.monsters.ED0001.radius * CFG.monsterSizeMul * 0.9, 1e-9));

  /* ============ 四、scaleBy + 嘲讽 ============ */
  const syn = { dmgMul: 1, cdMul: 1, bullets: 0 };
  const sk120 = resolveSkill(CFG.skills.AT120, 1, syn);
  check("四1 AT120 锚点固定半径 LV1 = 180", sk120.radius === 180 && sk120.type === "taunt");
  const sb1 = SkillSystem.withScaleBy({ radius: 180, lv: 1, scaleBy: { stat: "def", pct: 0.02 } }, { def: 20 });
  check("四2 withScaleBy LV1：180 + 20×0.02×1 = 180.4", near(sb1.radius, 180.4, 1e-9));
  const exp100 = 340 + 20 * 0.02 * (1 + 99 * CFG.skillScaleBy.levelGrowth);
  const sb100 = SkillSystem.withScaleBy({ radius: 340, lv: 100, scaleBy: { stat: "def", pct: 0.02 } }, { def: 20 });
  check("四3 withScaleBy LV100：等级系数 1+99×0.06 = 6.94（半径 " + sb100.radius + "）", near(sb100.radius, exp100, 1e-9));
  check("四4 未声明 scaleBy → 原样返回（零足迹）", SkillSystem.withScaleBy({ radius: 100, lv: 5 }, { def: 9 }).radius === 100);

  w.monsters.length = 0;
  const m1 = w.spawnMonster("NM0010", G.player.x + 120, G.player.y);
  const m2 = w.spawnMonster("NM0010", G.player.x + 4000, G.player.y);   // 远超嘲讽半径
  const tgt = resolveSkill(CFG.skills.AT120, 1, syn);
  const res = SkillSystem.cast(w, G.player, tgt, null, { side: "player", isSkill: true, atk: 20, statSrc: { def: 30 } });
  check("四5 castTaunt 返回 kind=taunt，半径含防御加成（" + res.radius + "）",
    res.kind === "taunt" && near(res.radius, 180 + 30 * 0.02, 1e-9));
  check("四6 圈内怪被嘲讽（tauntedBy=施法者 / tauntT=" + m1.tauntT + "）",
    m1.tauntedBy === G.player && m1.tauntT === tgt.duration);
  check("四7 圈外怪不被嘲讽", m2.tauntedBy == null && m2.tauntT === 0);
  check("四8 AI 选目标优先嘲讽者", monsterTarget(w, m1) === G.player);
  m1.tauntT = 0.005;
  m1.update(w, 0.1);
  check("四9 嘲讽超时解除（tauntT 归零 / tauntedBy 清空）", m1.tauntT === 0 && m1.tauntedBy === null);

  const fakeHero = { x: 500, y: 500, hp: 10, alive: true, isCompanion: true, name: "队友" };
  m2.tauntedBy = fakeHero; m2.tauntT = 5;
  check("四10 嘲讽者存活 → 锁定嘲讽者", monsterTarget(w, m2) === fakeHero);
  fakeHero.alive = false;
  check("四11 嘲讽者倒下 → 解除锁定（回落最近目标）", monsterTarget(w, m2) !== fakeHero);

  /* ============ 五、7:3 池比例 ============ */
  const typeOf = (id) => CFG.monsters[id].type;
  const parse = (s) => { const o = {}; for (const p of s.split("/")) { const q = p.split(":"); o[q[0]] = Number(q[1]); } return o; };
  const rRatio = (s) => { const o = parse(s); let r = 0, m = 0; for (const id in o) { if (typeOf(id) === "ranged") r += o[id]; else m += o[id]; } return r / (r + m); };
  let poolsOk = true; const detail = [];
  for (const k of ["SC01", "SC02", "SC03", "SC04"]) { const x = rRatio(CFG.spawnCircles[k].pool); detail.push(k + "=" + (x * 100).toFixed(0) + "%"); if (Math.abs(x - 0.7) > 0.02) poolsOk = false; }
  check("五1 四刷怪圆池 远程占比 ≈ 70%（" + detail.join(" ") + "）", poolsOk);
  let rng = 0; const tot = 4000;
  for (let i = 0; i < tot; i++) { if (typeOf(Endless._pickNormalId(Endless._normalPool())) === "ranged") rng++; }
  const pr = rng / tot;
  check("五2 深渊普通怪池加权抽样 远程占比 ≈ 70%（" + (pr * 100).toFixed(1) + "%）", Math.abs(pr - 0.7) < 0.05);
  const nPool = Endless._normalPool();
  check("五3 深渊普通怪池同时含远程与近战",
    nPool.some((id) => typeOf(id) === "ranged") && nPool.some((id) => typeOf(id) !== "ranged"));

  /* ============ 六、定位 / 属性表 ============ */
  check("六1 heroRoles：aux 存在、recovery 已移除、name=辅助",
    !!CFG.heroRoles.aux && !CFG.heroRoles.recovery && CFG.heroRoles.aux.name === "辅助");
  check("六2 requireAll = output/defense/aux", CFG.heroRoles.requireAll.join() === "output,defense,aux");
  check("六3 12 英雄 role/range 齐全且合法",
    CFG.heroes.length === 12 && CFG.heroes.every((h) => ["output", "defense", "aux"].indexOf(h.role) >= 0 && ["ranged", "melee"].indexOf(h.range) >= 0));
  check("六4 英雄 role 与 heroRoles.byHero 一致", CFG.heroes.every((h) => CFG.heroRoles.byHero[h.id] === h.role));
  check("六5 statNames 四项中文齐备",
    CFG.statNames.atk === "攻击" && CFG.statNames.hp === "生命" && CFG.statNames.def === "防御" && CFG.statNames.spd === "速度");
  check("六6 growthByRole 键与定位同步（aux，无 recovery）",
    !!CFG.outLevel.growthByRole.aux && !CFG.outLevel.growthByRole.recovery);
  check("六7 W009 技能绑定嘲讽 AT120（防御定位载体）", CFG.weapons.W009.skills.skill === "AT120");

  if (!ok) throw new Error("battle_rules_test 存在失败断言");
  console.log("BATTLE RULES TEST OK");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
