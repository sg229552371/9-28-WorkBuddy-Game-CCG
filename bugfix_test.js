/* Bugfix 回归测试：① 陷阱/召唤物世界归属（传送子地图不跟随、不跨图引爆/更新）
 *                   ② 视线判定（远程怪不朝障碍物开火、索敌优先视线可达）
 *                   ③ 障碍物切向滑动（近战怪不再卡死在障碍边缘）
 *                   ④ 主城 NPC 与传送门不重叠 + 画布跨端自适应（垂直视野固定）
 * 运行：node bugfix_test.js（真实加载 config/core/game/ui/main，DOM 桩 + 帧推进） */
"use strict";

/* ---- DOM 桩（同 extract_test） ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300;
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
const ctxCalls = [];
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 300000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 300000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
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

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* check 挂到 global：大段用例运行在 vm 上下文里，模块作用域函数不可见 */
global.__bfFail = 0;
global.check = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) global.__bfFail++; };

vm.runInContext(`
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites.hero = { width: 60, height: 60 };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
  Game.loop(0);
  let T = 0;
  function step(n) { for (let i = 0; i < n; i++) { T += 16.7; global.__raf(T); } }

  const W = G.mainWorld, P = G.player;
  W.monsters.length = 0; W.enemyBullets.length = 0; W.playerBullets.length = 0;
  W.altars.length = 0; W.groundChests.length = 0; W.pickups.length = 0;

  /* ============ ① 陷阱 / 召唤物世界归属 ============ */
  {
    // 主图布一颗「已引信」陷阱（fuse=0.05，在本世界 1 帧内必炸）+ 一架无人机
    G.run.traps.length = 0; G.run.drones.length = 0;
    G.run.traps.push({ x: 500, y: 500, r: 10, radius: 110, armDelay: 0.5, armed: true, fuse: 0.05,
      owner: P, world: W, dmg: 5 });
    const dr = new Drone(520, 500, 0, 40, 6, 0.8, 70, P);
    dr.world = W;
    G.run.drones.push(dr);

    // 进入子世界（工匠世界等价：非主图安全区）
    const sub = new World(1920, 1920, false);
    sub.monsters.length = 0;
    G.activeWorld = sub;
    P.x = 300; P.y = 300;
    step(60);                                     // ~1 秒：若跨图更新，陷阱已炸、无人机已飞向玩家
    check("世界归属-子世界内陷阱不引爆（不跨图处理）", G.run.traps.length === 1 && G.run.traps[0].fuse > 0);
    check("世界归属-子世界内无人机冻结（坐标不变）",
      G.run.drones.length === 1 && G.run.drones[0].x === 520 && G.run.drones[0].y === 500);

    // 子世界内再布陷阱：主图那颗不占上限、不被回收（计数按世界隔离）
    const skTrap = resolveSkill(CFG.skills.AT114, 1, { dmgMul: 1, cdMul: 1 });
    G.run.traps.push({ x: 1500, y: 1500, r: 10, radius: 110, armDelay: 0.5, armed: false, fuse: 0,
      owner: P, world: sub, dmg: 5 });            // 先在子图补一颗，保证「本图已有 1 颗」
    G.activeWorld = sub;
    SkillSystem.castTrap(sub, P, skTrap, 10);
    check("世界归属-跨图布陷阱：主图陷阱不被顶掉",
      G.run.traps.some(t => t.world === W) && G.run.traps.some(t => t.world === sub));

    // 回到主图：陷阱正常引爆、无人机恢复跟随
    G.activeWorld = W; P.x = 800; P.y = 800;
    step(30);
    check("世界归属-回到主图后陷阱正常引爆", !G.run.traps.some(t => t.world === W));
    const d0x = G.run.drones[0].x, d0y = G.run.drones[0].y;
    P.x = 200; P.y = 200;
    step(30);
    const dd = Math.hypot(G.run.drones[0].x - d0x, G.run.drones[0].y - d0y);
    check("世界归属-回到主图后无人机恢复跟随（位移 " + dd.toFixed(0) + "px）", dd > 30);
    G.run.traps.length = 0; G.run.drones.length = 0;
  }

  /* ============ ② 视线判定（losClear / 索敌偏好 / 远程怪不开盲火） ============ */
  {
    const rangedId = Object.keys(CFG.monsters).find(id => CFG.monsters[id].type === "ranged");
    const meleeId = Object.keys(CFG.monsters).find(id => CFG.monsters[id].type === "melee");
    // 墙：x 600~660, y 400~700；玩家在左侧 (420,550)
    W.obstacles = [{ x: 600, y: 400, w: 60, h: 300 }];
    W.monsters.length = 0; W.enemyBullets.length = 0;

    // ②a 索敌偏好：近处怪在墙后（视线被挡），远处怪可见 → 选可见的
    const mA = new Monster(meleeId, 760, 550, 1);   // dist≈340，被墙挡
    const mB = new Monster(rangedId, 950, 100, 1);  // dist≈695，视线可达
    W.monsters.push(mA, mB);
    P.x = 420; P.y = 550;
    const picked = nearestMonster(W, P.x, P.y);
    check("视线-索敌优先视线可达（选 " + (picked === mB ? "远处可见怪" : "近处被挡怪") + "）", picked === mB);
    W.monsters.length = 0;

    // ②b 远程怪在距离带内但被墙挡 → 不开火（不朝障碍物倾泻弹药）
    const m = new Monster(rangedId, 900, 550, 1);
    m.hp = m.hpMax = 1e6;
    W.monsters.push(m);
    const kd = m.ak.keepDist || 260;
    P.x = 420; P.y = 550;                          // dist=480，保证 > keepDist 下限带（怪物会先走进带内）
    const px = P.x, py = P.y;
    step(150);                                     // ~2.5 秒：无视线 → 应保持 0 弹
    check("视线-被墙挡住时远程怪不开火（敌弹 " + W.enemyBullets.length + " 发）", W.enemyBullets.length === 0);
    // ②c 墙拆掉 → 立刻开火（fireCd≈2.6s > 窗口，取 45 帧 ≈0.75s：子弹在飞、正好被看到）
    W.obstacles = [];
    P.x = px; P.y = py;
    step(45);
    check("视线-拆墙后远程怪恢复开火（敌弹 " + W.enemyBullets.length + " 发）", W.enemyBullets.length > 0);
    W.monsters.length = 0; W.enemyBullets.length = 0; W.obstacles = [];
  }

  /* ============ ③ 障碍物切向滑动（不卡死） ============ */
  {
    const meleeId = Object.keys(CFG.monsters).find(id => CFG.monsters[id].type === "melee");
    // 竖墙：x 820~900, y 0~420；怪在左侧 (620,210) 直线冲墙，玩家在墙另一侧 (1050,210)
    W.obstacles = [{ x: 820, y: 0, w: 80, h: 420 }];
    W.monsters.length = 0; W.enemyBullets.length = 0;
    const m = new Monster(meleeId, 788, 210, 1);   // 贴近墙：0.1s 内撞墙，其余时间验证滑动
    m.hp = m.hpMax = 1e6;
    W.monsters.push(m);
    P.x = 1050; P.y = 210;
    step(300);                                     // ~5 秒：撞墙 → 沿墙绕行（目标在墙正后方，需绕过墙角）
    const slid = Math.abs(m.y - 210);
    const inWall = m.x > 820 - m.r && m.x < 900 + m.r && m.y > -m.r && m.y < 420 + m.r;
    check("滑动-冲墙怪沿表面滑动（末位置 " + m.x.toFixed(0) + "," + m.y.toFixed(0) + "，y 偏移 " + slid.toFixed(0) + "px），未卡死", slid > 30);
    check("滑动-怪物未穿进障碍物", !inWall);
    W.monsters.length = 0; W.obstacles = [];
  }

  /* ============ ④ 主城 NPC 与传送门不重叠 ============ */
  {
    const cw = new World(CFG.city.mapW, CFG.city.mapH, false, "city");
    const jm = CFG.altarJudgeMul || 1.2;
    const pt = cw.portal;
    let minNpcPortal = Infinity, minNpcNpc = Infinity;
    for (const n of cw.cityNpcs) {
      minNpcPortal = Math.min(minNpcPortal, U.dist(n.x, n.y, pt.x, pt.y));
    }
    for (let i = 0; i < cw.cityNpcs.length; i++)
      for (let j = i + 1; j < cw.cityNpcs.length; j++)
        minNpcNpc = Math.min(minNpcNpc, U.dist(cw.cityNpcs[i].x, cw.cityNpcs[i].y, cw.cityNpcs[j].x, cw.cityNpcs[j].y));
    check("主城-NPC 与传送门判定圈分离（最近 " + minNpcPortal.toFixed(0) + " > " +
      ((pt.radius + CFG.city.npcRadius) * jm).toFixed(0) + "）",
      minNpcPortal > (pt.radius + CFG.city.npcRadius) * jm);
    check("主城-NPC 两两判定圈不重叠（最近 " + minNpcNpc.toFixed(0) + " > " + (2 * CFG.city.npcRadius * jm).toFixed(0) + "）",
      minNpcNpc > 2 * CFG.city.npcRadius * jm);
  }

  /* ============ ⑤ 画布跨端自适应（垂直视野固定 → 角色大小一致） ============ */
  {
    window.innerWidth = 390; window.innerHeight = 844;    // 手机竖屏
    Game.fitCanvas();
    const hPhone = G.H, wPhone = G.W;
    check("画布-竖屏：画布高固定（" + hPhone + " = viewH×zoom）", hPhone === Math.round((CFG.camera.viewH || 720) * (CFG.camera.zoom || 1.5)));
    check("画布-竖屏：宽按 minAspect 钳制（" + wPhone + "）", wPhone === Math.round(hPhone * (CFG.camera.minAspect || 0.75)));
    window.innerWidth = 1920; window.innerHeight = 1080;  // PC 全屏 16:9
    Game.fitCanvas();
    check("画布-PC 16:9：宽 = 高 × 比例（" + G.W + "）", G.W === Math.round(G.H * 1920 / 1080));
    check("画布-跨端：画布高一致 → 角色大小一致", G.H === hPhone);
    check("画布-画布分辨率已写入 canvas 元素", G.canvas.width === G.W && G.canvas.height === G.H);
  }

  console.log(global.__bfFail === 0 ? "BUGFIX TEST OK" : "BUGFIX TEST FAILED");
  if (global.__bfFail > 0) throw new Error("BUGFIX TEST FAILED");
`, ctx, { filename: "inline" });
process.exitCode = global.__bfFail > 0 ? 1 : 0;
