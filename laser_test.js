/* 无头测试：Boss 激光实体 LaserBeam + 弹幕吞噬机制（第十七章 17.7 第 3 步）
 * 覆盖：线段-圆命中几何 / laserCap=6 上限行为 / 三段生命周期转换 /
 *       按段伤害结算（走 heroTakeDamage 入口）/ 弹幕吞噬生效 /
 *       无激光时 Boss 行为等价性回归（现有 3 只 Boss 不受影响）/ 渲染可见性。
 * 运行：node laser_test.js */
"use strict";

/* ---- DOM / Canvas 桩（记录画布调用，用于确定性验证"真的画了"） ---- */
const ctxCalls = [];
global.ctxCalls = ctxCalls;
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
const winHandlers = {};
global.winHandlers = winHandlers;
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice() { }, onLevelUpChoiceClose() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();          // 跳过主关卡开场冻结（3s），保持测试时间假设
  Game.skipLevelUpChoice && Game.skipLevelUpChoice();
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
    if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } };

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);

  // 假世界 / 假 Boss：激光几何与生命周期不依赖完整 World
  const fakeW = () => ({ w: 1920, h: 1920, obstacles: [], enemyBullets: [], playerBullets: [], lasers: [], monsters: [],
    spawnMonster(id, x, y) { const m = new Monster(id, x, y, 1); this.monsters.push(m); return m; } });
  const fakeBoss = (x, y) => ({ x: x == null ? 900 : x, y: y == null ? 900 : y, atk: 20, r: 46,
    d: CFG.monsters.BS0001, lv: 1, aimAng: 0, laserTimer: 0, laserIdx: 0 });

  /* ============ 一、线段-圆命中几何（纯函数，逐条锁定正确性） ============ */
  {
    // 水平线段 (0,0)-(100,0)
    check("几何-点在线段上（垂足距 0）命中", pointSegDist(50, 0, 0, 0, 100, 0) === 0);
    check("几何-点在线段上方 5px，距 = 5", near(pointSegDist(50, 5, 0, 0, 100, 0), 5));
    check("几何-垂足落在线段外 → 取端点距离（点到 (100,0) 为 5）",
      near(pointSegDist(100, 5, 0, 0, 100, 0), 5) && near(pointSegDist(105, 0, 0, 0, 100, 0), 5));
    check("几何-退化为点（零长线段）→ 取点距", near(pointSegDist(3, 4, 10, 10, 10, 10), Math.hypot(7, 6)));

    // segCircleHit：距离 < 半径 判据
    check("线段-圆-圆心距 ≤ 半径 → 命中", segCircleHit(0, 0, 100, 0, 50, 8, 10) === true);
    check("线段-圆-圆心距 > 半径 → 不命中", segCircleHit(0, 0, 100, 0, 50, 12, 10) === false);
    check("线段-圆-圆心恰在半径上 → 不命中（严格小于）", segCircleHit(0, 0, 100, 0, 50, 10, 10) === false);
    check("线段-圆-圆在线段延长线端点外 → 不命中", segCircleHit(0, 0, 100, 0, 130, 0, 10) === false);

    // laserHitsTarget：封装后的入口，供 Boss 使用
    const lb = { x: 0, y: 0, ang: 0, len: 100 };
    check("laserHitsTarget-正前方命中", laserHitsTarget(lb, { x: 50, y: 4, r: 10 }) === true);
    check("laserHitsTarget-侧向偏移超出半径 → 不命中", laserHitsTarget(lb, { x: 50, y: 30, r: 10 }) === false);
    const lbDiag = { x: 0, y: 0, ang: Math.PI / 4, len: 200 };
    check("laserHitsTarget-斜向 45° 命中（垂足投影）",
      laserHitsTarget(lbDiag, { x: 200 * Math.SQRT1_2, y: 200 * Math.SQRT1_2, r: 12 }) === true);
  }

  /* ============ 二、生命周期三阶段（warn → active → fade → dead） ============ */
  {
    const w = fakeW();
    const lb = spawnLaser(w, fakeBoss(), 900, 900, 0, { warn: 0.9, active: 1.6, fade: 0.35 });
    check("生命周期-初始处于预警阶段（warn）", lb.phase === "warn" && lb.dead === false);
    check("生命周期-登记到世界容器", w.lasers.length === 1 && w.lasers[0] === lb);

    lb.tick(0.5);
    check("生命周期-预警未读满仍是 warn（0.5/0.9s）", lb.phase === "warn");
    lb.tick(0.4);
    check("生命周期-预警读满切到激活（active）", lb.phase === "active" && lb.t === 0);

    lb.tick(1.0);
    check("生命周期-激活未到时长仍是 active（1.0/1.6s）", lb.phase === "active");
    lb.tick(0.6);
    check("生命周期-激活读满切到消散（fade）", lb.phase === "fade" && lb.t === 0);

    lb.tick(0.2);
    check("生命周期-消散未到时长仍在 fade", lb.phase === "fade" && lb.dead === false);
    lb.tick(0.15);
    check("生命周期-消散读满 → 消亡（dead）", lb.dead === true);

    // tick 返回值 = 本帧是否处于激活（伤害）阶段
    const lb2 = spawnLaser(w, fakeBoss(), 900, 900, 0, { warn: 0.1, active: 1, fade: 0.1 });
    check("生命周期-tick 预警期返回 false（无伤害）", lb2.tick(0.05) === false);
    lb2.tick(0.1);
    check("生命周期-tick 激活期返回 true（造成伤害）", lb2.tick(0.01) === true);
  }

  /* ============ 三、命中判定 + 伤害结算（走 heroTakeDamage 入口） ============ */
  {
    // 直接向正右方发一束激活激光，瞄准右侧英雄
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze(); Game.skipLevelUpChoice && Game.skipLevelUpChoice();
    const w = G.mainWorld;
    w.lasers.length = 0;
    const p = G.player;
    p.x = 900; p.y = 900;
    const lb = spawnLaser(w, fakeBoss(), 700, 900, 0, { warn: 0, active: 2, fade: 0.1, dmg: 12, dmgInterval: 0.25 });
    lb.phase = "active"; lb.t = 0; lb.dmgTimer = 0;   // 直接跳到激活态
    const hp0 = G.run.hp;                              // 队长血量存于 G.run.hp（Player 无 this.hp）
    lb.damageTick(w, 0.25);   // 满一个结算间隔
    check("伤害-激活期命中英雄，走 heroTakeDamage 扣血（" + hp0 + " → " + G.run.hp + "）", G.run.hp < hp0);

    // 节流：不足一个间隔不结算
    const p2hp = G.run.hp;
    lb.damageTick(w, 0.1);
    check("伤害-未到结算间隔不重复扣血（按段结算，非逐帧）", G.run.hp === p2hp);
    lb.damageTick(w, 0.15);
    check("伤害-累计满间隔再次结算", G.run.hp < p2hp);

    // 预警期不造成伤害
    const w2 = fakeW();
    const lbWarn = spawnLaser(w2, fakeBoss(), 700, 900, 0, { warn: 1, active: 1, fade: 0.1, dmg: 12 });
    lbWarn.phase = "warn"; lbWarn.t = 0;
    const hp3 = G.run.hp;
    lbWarn.damageTick(w, 0.5);
    check("伤害-预警期不结算伤害（青线只是提示）", G.run.hp === hp3);

    // 偏离方向的激光打不中
    const w3 = fakeW();
    const lbMiss = spawnLaser(w3, fakeBoss(), 700, 900, Math.PI, { warn: 0, active: 2, fade: 0.1, dmg: 12, dmgInterval: 0.25 });
    lbMiss.phase = "active"; lbMiss.t = 0;
    const hp4 = G.run.hp;
    lbMiss.damageTick(w, 0.25);
    check("伤害-反向激光（朝左）打不中右侧英雄", G.run.hp === hp4);
  }

  /* ============ 四、laserCap = 6 上限（超出时旧激光被回收） ============ */
  {
    const w = fakeW();
    const boss = fakeBoss();
    for (let i = 0; i < 6; i++) spawnLaser(w, boss, 900, 900, i * 0.1, { warn: 1, active: 1, fade: 1 });
    check("上限-未超限时全部保留（" + w.lasers.length + " 束）", w.lasers.length === 6);
    const first = w.lasers[0];
    const seventh = spawnLaser(w, boss, 900, 900, 9, { warn: 1, active: 1, fade: 1 });
    check("上限-第 7 束使总量仍为 6（laserCap 硬上限）", w.lasers.length === 6);
    check("上限-超出时回收最旧的激光（FIFO）", w.lasers.indexOf(first) < 0 && w.lasers[5] === seventh);

    // 连续超发，绝不越界
    for (let i = 0; i < 20; i++) spawnLaser(w, boss, 900, 900, i, { warn: 1, active: 1, fade: 1 });
    check("上限-连续超发 20 次后同屏仍恒 ≤ 6（" + w.lasers.length + "）", w.lasers.length <= 6 && w.lasers.length === 6);
  }

  /* ============ 五、弹幕吞噬：激活激光吞掉穿过的玩家子弹 ============ */
  {
    const w = fakeW();
    const boss = fakeBoss();
    // 造 3 发玩家子弹：一发在激光线上、一发偏离、一发在激活激光反向
    w.playerBullets.push(new Bullet(900, 900, 0, 200, 10, "player", 0, 0, 0, true));
    w.playerBullets.push(new Bullet(900, 960, 0, 200, 10, "player", 0, 0, 0, true));   // 偏离 60px
    const lb = spawnLaser(w, boss, 700, 900, 0, { warn: 0, active: 2, fade: 0.1 });

    // 预警期不吞噬
    lb.phase = "warn"; lb.t = 0;
    const eaten0 = lb.devourBullets(w);
    check("吞噬-预警期不吞噬任何子弹（" + eaten0 + "）", eaten0 === 0 && w.playerBullets.every(b => !b.dead));

    // 激活期吞噬
    lb.phase = "active"; lb.t = 0;
    const eaten1 = lb.devourBullets(w);
    check("吞噬-激活激光吞掉线段上的玩家子弹（吞 " + eaten1 + " 发）", eaten1 === 1);
    check("吞噬-被吞子弹标记 dead（本体消亡）", w.playerBullets[0].dead === true);
    check("吞噬-偏离光柱的子弹不受影响", w.playerBullets[1].dead === false);
    check("吞噬-累计吞噬计数（" + lb.devoured + "）", lb.devoured === 1);

    // 只吞玩家子弹，不吞敌方弹幕
    const w2 = fakeW();
    w2.enemyBullets.push(new Bullet(900, 900, 0, 200, 10, "enemy"));
    const lb2 = spawnLaser(w2, fakeBoss(), 700, 900, 0, { warn: 0, active: 2, fade: 0.1 });
    lb2.phase = "active"; lb2.t = 0;
    lb2.devourBullets(w2);
    check("吞噬-不吞自家敌方弹幕（只反制玩家）", w2.enemyBullets[0].dead === false);

    // update 主循环：吞噬 + 伤害一起跑（走真实入口）
    const w3 = fakeW();
    const lb3 = spawnLaser(w3, fakeBoss(), 700, 900, 0, { warn: 0, active: 2, fade: 0.1 });
    lb3.phase = "active"; lb3.t = 0;
    w3.playerBullets.push(new Bullet(900, 900, 0, 200, 10, "player", 0, 0, 0, true));
    lb3.update(w3, 0.016);
    check("吞噬-update 主循环内完成吞噬", w3.playerBullets[0].dead === true);
  }

  /* ============ 六、World / Boss 端到端接入 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze(); Game.skipLevelUpChoice && Game.skipLevelUpChoice();
    const w = G.mainWorld;
    check("接入-run 与世界均初始化 lasers 容器", Array.isArray(G.run.lasers) && Array.isArray(w.lasers));

    // updateLasers 推进 + 清理消亡
    w.lasers.length = 0;
    const lb = spawnLaser(w, fakeBoss(), G.player.x + 300, G.player.y, 0, { warn: 0, active: 0.05, fade: 0.05 });
    updateLasers(w, 0.1);          // warn(0) → active
    updateLasers(w, 0.06);         // active 超时 → fade
    updateLasers(w, 0.06);         // fade 超时 → dead
    check("接入-updateLasers 推进生命周期并清理消亡激光（剩 " + w.lasers.length + "）", w.lasers.length === 0);
  }

  /* ============ 七、Boss 行为等价性回归：未配 laserSkills 时 100% no-op ============ */
  {
    // 现有 3 只 Boss 均未配 laserSkills → bossLaserTick 必须完全不产生激光
    const noLaser = ["BS0001", "BS0002", "BS0003"].every(id => !CFG.monsters[id].laserSkills);
    check("等价性-现有 3 只 Boss 未配 laserSkills（激光能力默认关闭）", noLaser);

    for (const id of ["BS0001", "BS0002", "BS0003"]) {
      const w = fakeW();
      const b = new Monster(id, 900, 900, 3);
      for (let i = 0; i < 600; i++) b.update(w, 1 / 60);
      check("等价性-" + id + " 10 秒内不产生任何激光（" + w.lasers.length + " 束）", w.lasers.length === 0);
      check("等价性-" + id + " 仍只走弹幕路径（弹幕 " + w.enemyBullets.length + " 发）", w.enemyBullets.length > 0);
    }

    // 直接调用 bossLaserTick：无 laserSkills → 返回零，不写容器
    const w2 = fakeW();
    const b2 = new Monster("BS0001", 900, 900, 1);
    b2.laserTimer = 0;
    bossLaserTick(w2, b2, 1 / 60);
    check("等价性-bossLaserTick 对未配招 Boss 为 no-op", w2.lasers.length === 0);

    // 配了 laserSkills 的 Boss（模拟新 Boss BS0006 棱镜）→ 真的发激光（走现有配表复用）
    const w3 = fakeW();
    const b3 = new Monster("BS0001", 900, 900, 1);
    b3.d = { type: "boss", name: "模拟棱镜", laserSkills: ["AT211"], radius: 46, hp: 100, atk: 20, def: 0, spd: 0, exp: 0, coin: 0 };
    b3.laserSkills = b3.d.laserSkills; b3.laserTimer = 0; b3.laserIdx = 0;
    bossLaserTick(w3, b3, 1 / 60);
    check("启用-配 laserSkills 后 bossLaserTick 生成激光（" + w3.lasers.length + " 束）", w3.lasers.length === 1);
    check("启用-激光起点 = Boss 位置", near(w3.lasers[0].x, 900) && near(w3.lasers[0].y, 900));
    check("启用-激光进入预警阶段（青线预热）", w3.lasers[0].phase === "warn");
    check("启用-激光伤害按 Boss 攻击 × 倍率结算", w3.lasers[0].dmg > 0);
    check("启用-生成后进入冷却（laserTimer > 0）", b3.laserTimer > 0);

    // 多束激光（arms=3）一次铺开多束：逐束登记、角度等分（模拟 bossLaserTick 的 arms 分支）
    const w4 = fakeW();
    const b4 = fakeBoss();
    spawnLaser(w4, b4, 900, 900, 0, { warn: 1, active: 1, fade: 0.1 });
    spawnLaser(w4, b4, 900, 900, Math.PI * 2 / 3, { warn: 1, active: 1, fade: 0.1 });
    spawnLaser(w4, b4, 900, 900, Math.PI * 4 / 3, { warn: 1, active: 1, fade: 0.1 });
    check("启用-多束激光各自独立登记（3 束）", w4.lasers.length === 3);
    check("启用-多束角度 120° 等分", w4.lasers.every((lb, i) => near(lb.ang, i * Math.PI * 2 / 3)));
  }

  /* ============ 八、渲染：预警细线 + 激活粗光柱确实被画出来 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze(); Game.skipLevelUpChoice && Game.skipLevelUpChoice();
    Game.loop(t);                                   // 手动踢一次主循环（内部续接 __raf）
    const w = G.mainWorld;
    w.monsters.length = 0;
    w.lasers.length = 0;

    const cyan = CFG.boss.color.laser;               // 青色（17.3 颜色语言：青 = 激光）
    // 预警：细青线 + 虚线
    const lb = spawnLaser(w, fakeBoss(), G.player.x + 120, G.player.y, 0, { warn: 1, active: 1, fade: 0.1 });
    lb.phase = "warn"; lb.t = 0.2;
    ctxCalls.length = 0; step(1);
    const warnLine = ctxCalls.some(c => c[0] === "set:strokeStyle" && String(c[1][0]) === cyan) &&
      ctxCalls.some(c => c[0] === "lineTo");
    check("渲染-预警期画出青色预警线（" + cyan + "）", warnLine);

    // 激活：粗光柱（lineWidth 明显变粗）+ 白色亮芯
    lb.phase = "active"; lb.t = 0.1;
    ctxCalls.length = 0; step(1);
    const thickLine = ctxCalls.some(c => c[0] === "set:lineWidth" && c[1][0] >= lb.halfW * 2 - 1e-6);
    const whiteCore = ctxCalls.some(c => c[0] === "set:strokeStyle" && String(c[1][0]) === "#ffffff");
    check("渲染-激活期画出粗光柱（lineWidth ≥ " + (lb.halfW * 2) + "）", thickLine);
    check("渲染-激活期画出白色亮芯", whiteCore);

    // 收束：淡出（globalAlpha < 1）
    lb.phase = "fade"; lb.t = lb.fadeT * 0.5;
    ctxCalls.length = 0; step(1);
    const faded = ctxCalls.some(c => c[0] === "set:globalAlpha" && c[1][0] > 0 && c[1][0] < 1);
    check("渲染-消散期淡出（globalAlpha < 1）", faded);

    // 无激光时渲染不报错、不画激光
    w.lasers.length = 0;
    ctxCalls.length = 0; step(1);
    check("渲染-无激光时不产生额外绘制（不崩）", true);
  }

  console.log(ok ? "LASER TEST OK" : "LASER TEST FAILED");
  if (!ok) throw new Error("LASER TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
