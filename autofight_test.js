/* 无头测试：自动战斗按钮（默认关；开启后队长技能自动施放；Space 手动保留） */
"use strict";

/* ---- DOM / Canvas 桩（与 skill_module_test 相同的最小桩） ---- */
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
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
global.fs = fs;   // driver 内读 index.html 用
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  var ok = true;
  UI.toast = () => { };   // 屏蔽 toast（避免其 setTimeout 在测试进程退出前触发 DOM 桩崩溃）

  // ---- 配置与元素静态检查 ----
  const html = fs.readFileSync("index.html", "utf8");
  check("index.html 存在 #btn-autofight", html.includes('id="btn-autofight"'));
  check("CFG.skills2.autoCast 默认 false（由局内按钮接管）", CFG.skills2.autoCast === false);

  // ---- 场景准备：DOM 桩不解析 HTML，需先手工预置风格按钮子节点（bindEvents 才能绑上 onclick） ----
  const styleRowPre = document.getElementById("autofight-styles");
  const mkStyleBtn = (s) => ({ dataset: { style: s }, classList: { toggle() { }, add() { }, remove() { }, contains: () => false }, onclick: null, textContent: "" });
  styleRowPre.children.push(mkStyleBtn("berserk"), mkStyleBtn("balanced"), mkStyleBtn("cautious"));

  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);

  // ---- 默认状态 ----
  check("开局 run.autoFight = false（默认关闭）", G.run.autoFight === false);
  check("开局按钮文案为「自动战斗：关」", document.getElementById("btn-autofight").textContent.includes("关"));

  // ---- 场景：场上有怪、能量够、冷却好 ----
  const w = G.activeWorld, p = G.player;
  const m = new Monster("NM0010", p.x + 200, p.y, 1);
  w.monsters.push(m);
  const sk = G.run.weapon.skill;
  const setReady = () => { G.run.energy = G.run.energyMax; p.skillTimer = 0; G.keys[" "] = false; };

  // 1. 关闭态：技能不自动施放（普攻仍自动开火）
  setReady();
  const bullets0 = w.playerBullets.length;
  p.update(w, 0.016);
  check("关闭态：普攻自动开火（弹池增加）", w.playerBullets.length > bullets0);
  check("关闭态：技能未自动施放（能量未被扣除）", G.run.energy >= G.run.energyMax - 0.01);

  // 2. 关闭态：Space 手动施法仍可用（H001 技能耗能 = 能量上限 100，施放后能量归 0 且进入冷却）
  setReady(); G.keys[" "] = true;
  p.update(w, 0.016);
  check("关闭态：Space 手动施法生效（能量归 0 + 进入冷却）", G.run.energy < sk.energy && p.skillTimer > 0);
  G.keys[" "] = false;

  // 3. 开启自动战斗：按钮状态翻转 + 技能自动施放
  const afBtn = document.getElementById("btn-autofight");
  afBtn.onclick();
  check("点击按钮 → autoFight = true", G.run.autoFight === true);
  check("按钮文案翻转为「开」", afBtn.textContent.includes("开"));
  setReady();
  p.update(w, 0.016);
  check("开启态：技能能量够即自动施放", G.run.energy < sk.energy && p.skillTimer > 0);

  // 4. 开启态：能量不足不施放、冷却中不施放
  G.run.energy = sk.energy - 1; p.skillTimer = 0;
  p.update(w, 0.016);
  check("开启态：能量不足不施放", G.run.energy < sk.energy);
  setReady(); p.skillTimer = 1;
  p.update(w, 0.016);
  check("开启态：冷却中不施放", G.run.energy >= G.run.energyMax - 0.01);

  // 5. 再次点击关闭
  afBtn.onclick();
  check("再次点击 → autoFight = false", G.run.autoFight === false);

  // ============ 托管 AI（转向力叠加：躲避 > 走位 > 索敌） ============
  check("CFG.autoFight 三风格齐备", CFG.autoFight && CFG.autoFight.styles.berserk && CFG.autoFight.styles.balanced && CFG.autoFight.styles.cautious);
  check("开局默认风格 = balanced", G.run.autoStyle === "balanced");
  const step = (n) => { for (let i = 0; i < n; i++) p.update(w, 0.016); };
  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);

  // 6. 风格选择器 UI
  afBtn.onclick();   // 开启
  const styleRow = document.getElementById("autofight-styles");
  check("开启后风格选择器展开", !styleRow.classList.contains("hidden"));
  const styleBtns = styleRow.children;
  styleBtns[0].onclick();
  check("点击「疯狂」→ autoStyle = berserk", G.run.autoStyle === "berserk");
  styleBtns[2].onclick();
  check("点击「冷静」→ autoStyle = cautious", G.run.autoStyle === "cautious");

  // 7. 索敌：远处怪物 → AI 自动逼近（先清空场景自带雕像/掉落，避免资源目标干扰）
  w.monsters.length = 0; w.altars.length = 0; w.groundChests.length = 0; w.pickups.length = 0;
  const far = new Monster("NM0010", p.x + 500, p.y, 1);
  w.monsters.push(far);
  const d0 = distTo(far.x, far.y);
  step(30);   // ~0.5s
  check("索敌：远处怪物自动逼近", distTo(far.x, far.y) < d0 - 30);

  // 8. 风筝：冷静档贴脸怪 → 拉开距离
  G.run.autoStyle = "cautious";
  const close = new Monster("NM0010", p.x + 60, p.y, 1);
  w.monsters.length = 0; w.monsters.push(close);
  const d1 = distTo(close.x, close.y);
  step(30);
  check("风筝：贴脸怪被拉开距离", distTo(close.x, close.y) > d1 + 20);

  // 9. 预判躲避：Boss 爆炸预警圈（warnT > 0）→ 径向逃离
  w.monsters.length = 0;
  const boss = { dead: false, d: { type: "boss" }, ak: { boomRadius: 200, boomWarn: 1 }, warnT: 1, x: p.x, y: p.y, r: 40 };
  w.monsters.push(boss);
  const d2 = distTo(boss.x, boss.y);
  step(30);
  check("预判：Boss 预警圈内向圈外逃离", distTo(boss.x, boss.y) > d2 + 40);

  // 10. 预判躲避：精英冲锋 telegraph → 侧闪拉开
  w.monsters.length = 0;
  const charger = { dead: false, d: { type: "charger" }, ak: { chargeRange: 300 }, state: "telegraph", x: p.x, y: p.y, r: 20 };
  w.monsters.push(charger);
  const d3 = distTo(charger.x, charger.y);
  step(30);
  check("预判：精英冲锋预警期侧闪/拉开", distTo(charger.x, charger.y) > d3 + 20);

  // 11. 躲子弹：场上无怪 + 一发敌方子弹直射 → AI 移动避开弹道（清空资源目标避免干扰）
  w.monsters.length = 0; w.enemyBullets.length = 0; w.altars.length = 0; w.groundChests.length = 0; w.pickups.length = 0;
  p.aiStrafeSide = 1;
  const bx = p.x + 150, by = p.y;   // 从右侧直射玩家
  w.enemyBullets.push(new Bullet(bx, by, Math.PI, 200, 5, "enemy"));
  const px0 = p.x, py0 = p.y;
  step(20);
  const moved = Math.hypot(p.x - px0, p.y - py0);
  check("躲子弹：直射弹逼近时 AI 移动规避", moved > 10);

  // 12. 撤离读条：圈内暂停走位（站桩不打断读条）
  G.run.extractChanneling = true;
  const px1 = p.x, py1 = p.y;
  step(10);
  check("撤离读条期间站桩不移动", p.x === px1 && p.y === py1);
  G.run.extractChanneling = false;

  // 13. 手动让权：按键期间 AI 不接管，记录 aiHoldT
  G.keys["d"] = true;
  step(3);
  check("手动操作时 AI 让权（aiHoldT 刷新）", G.run.aiHoldT > 0);
  G.keys["d"] = false;

  // ============ 边界保命 + 资源目标（拾取/雕像激活） ============
  check("三风格 loot/altar 配置齐备（对象结构）",
    CFG.autoFight.styles.berserk.loot.range === 100 && CFG.autoFight.styles.berserk.loot.chests === true && CFG.autoFight.styles.berserk.loot.gate === "path" &&
    CFG.autoFight.styles.balanced.loot.range === 220 && CFG.autoFight.styles.balanced.loot.gate === "gap" &&
    CFG.autoFight.styles.cautious.loot.range === 520 && CFG.autoFight.styles.cautious.loot.gate === "clear" &&
    CFG.autoFight.styles.berserk.altar.evil === true && CFG.autoFight.styles.balanced.altar.evil === false &&
    CFG.autoFight.styles.berserk.altar.goddessHp === 0.30 && CFG.autoFight.styles.balanced.altar.goddessHp === 0.60 &&
    CFG.autoFight.styles.cautious.altar.goddessHp === 0.60 && CFG.autoFight.styles.balanced.altar.artisan === false);

  // 14. 角落自救：玩家贴左上角 + 近距离怪 → 风筝想往角落退，边界力把队长推离角落
  G.run.autoStyle = "cautious";
  w.monsters.length = 0; w.pickups.length = 0; w.altars.length = 0; w.groundChests.length = 0;
  w.enemyBullets.length = 0;
  p.x = 25; p.y = 25; p.aiMvX = 0; p.aiMvY = 0; G.run.aiHoldT = 0;
  const cornerMob = new Monster("NM0010", 150, 150, 1);
  w.monsters.push(cornerMob);
  step(40);
  check("角落自救：贴角风筝不再深入角落（离角落更远）", p.x + p.y > 50);
  check("角落自救：坐标始终在地图内", p.x >= 0 && p.y >= 0 && p.x <= w.w && p.y <= w.h);

  // 15. 拾取：冷静档战后清扫——远处金币主动去捡；疯狂档只捡 100px 内（远处无视）
  w.monsters.length = 0;
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  w.pickups.push({ type: "coin", value: 10, x: 800, y: 480, vx: 0, vy: 0, life: 30 });
  const pd0 = Math.hypot(p.x - 800, p.y - 480);
  step(40);
  check("冷静档：战后清扫主动走向远处掉落", Math.hypot(p.x - 800, p.y - 480) < pd0 - 60);
  w.pickups.length = 0;
  w.pickups.push({ type: "coin", value: 10, x: 800, y: 480, vx: 0, vy: 0, life: 30 });
  G.run.autoStyle = "berserk";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  step(30);
  check("疯狂档：320px 外掉落无视（超出 100px 顺路半径）", Math.abs(p.x - 480) < 3 && Math.abs(p.y - 480) < 3);

  // 16. 雕像激活：冷静档走向雕像圈并进圈站桩读条
  G.run.autoStyle = "cautious";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;
  const altar = { cfg: { name: "T", radius: 80, channel: 1.2 }, x: 800, y: 480, id: "T1", progress: 0, holder: null };
  w.altars.push(altar);
  step(60);   // ~0.96s，320px 路程足够进圈（圈内判定半径 80×1.2=96）
  check("雕像：走进交互圈（进圈判定）", !!heroInCircle(altar.x, altar.y, altar.cfg.radius));
  const ax0 = p.x, ay0 = p.y;
  step(10);
  check("雕像：圈内站桩读条不移动", Math.hypot(p.x - ax0, p.y - ay0) < 1);

  // 17. 危险时让位：站桩读条中出现 Boss 预警圈 → 继续躲避（进度保留可回来续读）
  const boss2 = { dead: false, d: { type: "boss" }, ak: { boomRadius: 150, boomWarn: 1 }, warnT: 1, x: p.x, y: p.y, r: 40 };
  w.monsters.push(boss2);
  step(30);
  check("雕像：危险时中断站桩躲避预警", distTo(boss2.x, boss2.y) > 60);
  w.monsters.length = 0; w.altars.length = 0; w.pickups.length = 0;
  G.run.aiAltar = null; G.run.aiAltarT = 0;

  // 18. 女神 HP 门槛 + 女神优先：冷静档满血不踩女神；残血（≤60%）时女神优先于更近的战争雕像
  G.run.autoStyle = "cautious";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;
  G.run.hp = G.run.hpMax;   // 满血
  const goddess = { cfg: { name: "G", radius: 80, channel: 1.2, effects: [{ type: "heal", pct: 0.25 }] }, x: 700, y: 480, id: "ALTAR_001", progress: 0, holder: null };
  const war = { cfg: { name: "W", radius: 80, channel: 1.2, effects: [{ type: "randomBuff", pool: "war", duration: 20 }] }, x: 560, y: 480, id: "ALTAR_002", progress: 0, holder: null };
  w.altars.push(war, goddess);
  step(40);
  check("满血：不踩女神，改踩战争雕像", !!heroInCircle(war.x, war.y, war.cfg.radius));
  w.altars.length = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  G.run.hp = G.run.hpMax * 0.4;   // 残血 40% ≤ 60% 门槛
  w.altars.push(war, goddess);
  step(50);
  check("残血：女神优先（无视更近的战争雕像直奔女神）", !!heroInCircle(goddess.x, goddess.y, goddess.cfg.radius));
  w.altars.length = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;

  // 19. 邪神雕像：疯狂档主动踩，冷静档无视
  const evil = { cfg: { name: "E", radius: 80, channel: 1.2, effects: [{ type: "adjustMonsters", target: "小怪数量", range: [-100, 100], duration: 30 }] }, x: 640, y: 480, id: "ALTAR_004a", progress: 0, holder: null };
  w.altars.push(evil);
  G.run.autoStyle = "berserk";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  step(50);
  check("疯狂档：主动踩邪神雕像", !!heroInCircle(evil.x, evil.y, evil.cfg.radius));
  G.run.autoStyle = "cautious";
  G.run.aiAltar = null; G.run.aiAltarT = 0;
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  step(40);
  check("冷静档：无视邪神雕像（不进圈）", !heroInCircle(evil.x, evil.y, evil.cfg.radius));
  w.altars.length = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;

  // 20. 工匠雕像：任何风格都不主动踩（留给玩家手动）
  const art = { cfg: { name: "工匠雕像", radius: 80, channel: 1.2, effects: [] }, x: 700, y: 480, id: "ALTAR_005", progress: 0, holder: null };
  w.altars.push(art);
  G.run.autoStyle = "balanced";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  step(40);
  check("工匠雕像：AI 不主动踩（留给玩家）", !heroInCircle(art.x, art.y, art.cfg.radius));
  w.altars.length = 0; G.run.aiAltar = null; G.run.aiAltarT = 0;

  // 21. 疯狂档顺路捡：100px 内金币主动去捡（gate=path）
  G.run.autoStyle = "berserk";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  w.pickups.push({ type: "coin", value: 10, x: 555, y: 480, vx: 0, vy: 0, life: 30 });
  step(30);
  check("疯狂档：100px 内顺路捡金币", Math.hypot(p.x - 555, p.y - 480) < 40);
  w.pickups.length = 0;

  // 22. 平衡档战斗间隙才捡：近战怪在旁时不去捡远处掉落（风筝优先，gate=gap 拦截）
  G.run.autoStyle = "balanced";
  p.x = 480; p.y = 480; p.aiMvX = 0; p.aiMvY = 0;
  const nearMob = new Monster("NM0010", p.x + 120, p.y, 1);   // 120px < 期望距离 230 → 战斗中
  w.monsters.push(nearMob);
  w.pickups.push({ type: "coin", value: 10, x: 480, y: 260, vx: 0, vy: 0, life: 30 });   // 正上方 220px
  const pd1 = Math.hypot(p.x - 480, p.y - 260);
  step(30);
  check("平衡档：战斗中不为远处掉落分心（距离不缩小）", Math.hypot(p.x - 480, p.y - 260) > pd1);
  w.monsters.length = 0; w.pickups.length = 0;

  afBtn.onclick();   // 收尾关闭
  check("收尾：按钮翻回「关」", afBtn.textContent.includes("关") && G.run.autoFight === false);
`, ctx, { filename: "driver" });

if (!ok) { console.error("AUTO FIGHT TEST FAILED"); process.exit(1); }
console.log("AUTO FIGHT TEST OK");
