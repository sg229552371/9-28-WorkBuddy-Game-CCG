/* 无头测试：队友（AI）触发金币拾取与祭坛判定圈 + 身后编队 */
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
const Vm = vm;   // 防止被上下文脚本意外遮蔽
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  Vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
console.log("ctx type:", typeof ctx, "| vm type:", typeof vm);
const driverSrc = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  // 3 人队伍
  Game.startRun([CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]]);
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
  const w = G.activeWorld, r = G.run, p = G.player;

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  // ---- 1. 蛇形尾迹跟随：队长是蛇头，队友踩队长的历史路径 ----
  p.mvx = 1; p.mvy = 0;
  // 模拟队长向右走 300px（留出尾迹），期间正常更新队友
  const startX = p.x;
  const c0 = r.companions[0], c1 = r.companions[1];
  c0.alive = true; c1.alive = true;
  c0.x = p.x + 200; c0.y = p.y;     // 队友先放在队长前方（不在线上）
  c1.x = p.x + 200; c1.y = p.y + 40;
  for (let i = 0; i < 30; i++) {
    p.x = startX + 10 * (i + 1);                 // 队长匀速右移（每帧 10px）
    trailPush(w);
    updateCompanions(w, 0.05);
  }
  // 队友应收敛到队长左后方（尾迹上），且排在队长与出发点之间
  check("蛇形跟随: 队友在队长身后 c0.x=" + c0.x.toFixed(0) + " < p.x=" + p.x.toFixed(0), c0.x < p.x - 20);
  check("蛇形跟随: 队友在历史路径附近 |c0.y-p.y|=" + Math.abs(c0.y - p.y).toFixed(0), Math.abs(c0.y - p.y) < 60);
  check("蛇形跟随: 纵深分层 c1 更靠后 c1.x=" + c1.x.toFixed(0) + " < c0.x=" + c0.x.toFixed(0), c1.x < c0.x);
  // 尾迹目标点单测：深度 = 队头位置回溯
  const tt = trailTarget(trailPush(w), TEAM_DEPTH, 0);
  check("蛇形跟随: 目标点回溯深度正确 " + (p.x - tt.x).toFixed(0) + "px", p.x - tt.x >= TEAM_DEPTH - 10);

  // ---- 1b. 横向错开公式：任意人数左右交替、幅度递增（支持扩充到 5 人） ----
  const lat = [teamLateral(0), teamLateral(1), teamLateral(2), teamLateral(3), teamLateral(4)];
  check("横向错开: 左右交替 " + lat.join(","), lat[0] < 0 && lat[1] > 0 && lat[2] < 0 && lat[3] > 0 && lat[4] < 0);
  check("横向错开: 幅度递增", Math.abs(lat[2]) > Math.abs(lat[0]) && Math.abs(lat[4]) > Math.abs(lat[2]));
  check("横向错开: 无 0 压线", lat.every(v => v !== 0));

  // ---- 1c. 预铺尾迹 + 5 人队伍站位：模拟扩充到 5 名队友 ----
  // 临时补 3 名假队友（3人队=2名队友，凑满 5 名），验证纵深严格递增、互不重叠、都不在队长位置上
  const extraDefs = [CFG.heroes[3], CFG.heroes[4], CFG.heroes[5]];
  for (const hd of extraDefs) {
    r.companions.push({ heroDef: hd, id: hd.id, name: hd.name, hp: hd.hp, hpMax: hd.hp, r: hd.radius, x: p.x, y: p.y, fireTimer: 0, alive: true, faceDir: 1 });
  }
  seedTrail(w, 0, 1);                 // 沿向下方向预铺
  snapCompanions(w);
  const five = r.companions;
  let ordered = true, notOnPlayer = true, noStack = true, lateralOk = true;
  for (let i = 0; i < 5; i++) {
    const dep = U.dist(five[i].x, five[i].y, p.x, p.y);
    const want = (i + 1) * TEAM_DEPTH;
    if (Math.abs(dep - want) > TEAM_DEPTH * 0.2 + 20) ordered = false;
    if (five[i].x === p.x && five[i].y === p.y) notOnPlayer = false;
    if (i > 0 && U.dist(five[i].x, five[i].y, five[i - 1].x, five[i - 1].y) < 30) noStack = false;
    if (i > 0 && Math.abs(five[i].x - five[i - 1].x) < 1) lateralOk = false;   // 直线尾迹上应左右错开
  }
  check("5人队: 纵深严格递增 " + five.map(c => U.dist(c.x, c.y, p.x, p.y).toFixed(0)).join("/"), ordered);
  check("5人队: 无人与队长重叠", notOnPlayer);
  check("5人队: 队友间距 >30px 不堆叠", noStack);
  check("5人队: 横向错开生效", lateralOk);
  r.companions.length = 2;            // 还原 3 人队（2 名队友）

  // ---- 2. 队友触发祭坛：队长远离祭坛，队友放在圈内 ----
  w.altars.length = 0;
  const a = { cfg: { radius: 120, channel: 3, weight: 0 }, x: 800, y: 800, id: "TEST" };
  w.altars.push(a);
  p.x = 300; p.y = 300;                        // 队长远离
  c0.alive = true; c0.x = 800; c0.y = 800;     // 队友站在祭坛圈内
  const dt = 0.1;
  for (let i = 0; i < 5; i++) { w.altars.length = 1; w.update(dt); }
  check("队友触发祭坛: 圈内积累 " + a.progress.toFixed(2) + "s", a.progress >= 0.4);
  // 队友离开 → 衰退
  c0.x = 300; c0.y = 1400;
  for (let i = 0; i < 5; i++) { w.altars.length = 1; w.update(dt); }
  check("全员离开后祭坛衰退至 " + a.progress.toFixed(2) + "s", a.progress < 0.4);

  // ---- 3. 队友拾取金币：队长远离，金币刷在队友脚下 ----
  r.coin = 0;
  w.pickups.length = 0;
  spawnPickup(w, c0.x, c0.y, "coin", 7);
  w.pickups[0].vx = 0; w.pickups[0].vy = 0;    // 消除弹散位移
  w.update(dt);
  check("队友拾取金币: coin=7", r.coin === 7);

  // ---- 4. 队友拾取经验宝石 ----
  const lvBefore = r.lv, expBefore = r.exp;
  spawnPickup(w, c0.x, c0.y, "gem", 5);
  w.pickups[0].vx = 0; w.pickups[0].vy = 0;
  w.update(dt);
  check("队友拾取经验宝石: exp 增长", r.exp > expBefore || r.lv > lvBefore);

  console.log(ok ? "TEAM TRIGGER TEST OK" : "TEAM TRIGGER TEST FAILED");
  if (!ok) throw new Error("TEAM TRIGGER TEST FAILED");
`;
Vm.runInContext(driverSrc, ctx, { filename: "driver" });
