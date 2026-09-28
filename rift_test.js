/* 空间裂缝子地图「一次性投放 + 开场冻结」回归测试：真实加载 config/core/game/ui/main
 * 覆盖：投放数量 = spawnCount + 独立精英 / 开场全员冻结（静止+无敌+限时暂停）/ 解冻开战 /
 *       不再增援（任务完成或失败后均不新增）/ 配置自检（三个箱子都拿得到）/ 返回主地图。
 * 背景：修复"任务完成后仍在刷敌人"——子地图由持续刷怪改为进场一次性投放。 */
"use strict";

/* ---- DOM 桩（带真实 classList 行为） ---- */
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
global.ctxCalls = ctxCalls;
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

vm.runInContext(`
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites.hero = { width: 60, height: 60 };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);

  function keyDown(k) { winHandlers.keydown.forEach(fn => fn({ key: k, preventDefault() { } })); }
  function keyUp(k) { winHandlers.keyup.forEach(fn => fn({ key: k })); }
  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  /* ---------- 1. 配置自检：投放总数必须覆盖任务目标与基础奖励箱 ---------- */
  for (const task of CFG.rift.tasks) {
    console.assert(task.spawnCount >= task.goal,
      "任务「" + task.name + "」的 spawnCount(" + task.spawnCount + ") 必须 ≥ goal(" + task.goal + ")");
    console.assert(task.spawnCount >= CFG.rift.rewardKills,
      "任务「" + task.name + "」的 spawnCount(" + task.spawnCount + ") 必须 ≥ 基础奖励阈值(" + CFG.rift.rewardKills + ")，否则停增援后拿不到基础箱");
  }
  console.assert(CFG.rift.freezeTime > 0, "裂缝开场冻结时长应 > 0");
  console.assert(CFG.elites.riftChance === 0, "裂缝已改为 ED 一次性投放，随机词缀转化应关闭");
  console.log("配置自检 OK");

  /* ---------- 2. 进入裂缝（走真实事件路径）：一次性投放 + 开场冻结 ---------- */
  EventBus.emit("enterRift");
  const w = G.activeWorld, task = G.run.riftTask;
  console.assert(G.inRift === true, "应已进入裂缝子地图");
  console.assert(w && w.kind === "rift", "当前世界应为裂缝子地图");
  console.assert(Math.abs(w.freezeTimer - CFG.rift.freezeTime) < 1e-9, "进场应处于开场冻结中");
  const eN = w.eliteTargetCount();
  console.assert(w.monsters.length === task.spawnCount + eN,
    "一次性投放应为 spawnCount(" + task.spawnCount + ") + 精英(" + eN + ")，实际 " + w.monsters.length);
  console.assert(w.monsters.filter(m => m.isElite).length === eN,
    "独立精英应随敌群一次性投放，实际 " + w.monsters.filter(m => m.isElite).length + " 只");
  console.assert(w.returnBeacon && w.returnBeacon.x > 0, "子地图应有返回信标");
  console.log("进场投放 OK: 小怪 " + task.spawnCount + " + 精英 " + eN + " = " + w.monsters.length);

  /* ---------- 3. 冻结期：全员静止 + 全员无敌 + 限时暂停 ---------- */
  Game.loop(t);
  const px = G.player.x, py = G.player.y, hp0 = G.run.hp;
  const m0 = w.monsters[0], mx = m0.x, my = m0.y;
  G.run.riftTask.remain = 10;          // 固定限时，验证冻结期不倒计时
  const rk0 = G.run.kills;
  ctxCalls.length = 0;                  // 清空画布调用记录，用于验证红色倒计时确实被绘制
  keyDown("d");
  step(120);                            // 2 秒（冻结共 3 秒）
  keyUp("d");
  console.assert(G.player.x === px && G.player.y === py, "冻结期间玩家不应移动");
  console.assert(m0.x === mx && m0.y === my, "冻结期间敌人不应移动");
  console.assert(G.run.riftTask.remain === 10, "冻结期间任务限时不倒计时");
  console.assert(G.run.hp === hp0, "冻结期间玩家不应受伤（全员无敌）");
  console.assert(G.run.kills === rk0, "冻结期间不应发生击杀");
  console.assert(w.freezeTimer > 0, "跑 2 秒后仍应在开场冻结中");
  // 画面验证：红色大字 3/2/1 已绘制（node 里唯一能确定性验证渲染的方式）
  const redIdx = ctxCalls.findIndex(c => c[0] === "set:fillStyle" && String(c[1][0]).toLowerCase() === "#ff3b3b");
  const numIdx = ctxCalls.findIndex((c, i) => i > redIdx && redIdx >= 0 && c[0] === "fillText" && /^[123]$/.test(String(c[1][0])));
  console.assert(redIdx >= 0, "冻结期间应使用红色绘制倒计时");
  console.assert(numIdx > redIdx, "冻结期间应绘制 3/2/1 的倒计时大字");
  console.log("冻结期 OK: 剩余 freezeTimer = " + w.freezeTimer.toFixed(2) + "s（红字倒计时已绘制）");

  /* ---------- 4. 解冻：玩家与敌人恢复行动，倒计时不再绘制 ---------- */
  step(120);                            // 越过 3 秒
  console.assert(w.freezeTimer === 0, "3 秒后应解除冻结");
  ctxCalls.length = 0;
  step(30);
  console.assert(!ctxCalls.some(c => c[0] === "set:fillStyle" && String(c[1][0]).toLowerCase() === "#ff3b3b"),
    "解冻后不应再绘制红色倒计时");
  const snap = w.monsters.map(m => ({ x: m.x, y: m.y }));
  const px2 = G.player.x;
  keyDown("d"); step(40); keyUp("d");
  console.assert(G.player.x > px2 + 20, "解冻后玩家应可移动, dx=" + (G.player.x - px2));
  const moved = w.monsters.some((m, i) => U.dist(m.x, m.y, snap[i].x, snap[i].y) > 2);
  console.assert(moved, "解冻后敌人应开始行动");
  console.log("解冻 OK: 玩家 dx = " + Math.round(G.player.x - px2));

  /* ---------- 5. 不再增援：任务未完成时长时间挂机，敌人数量不增加 ---------- */
  const n0 = w.monsters.length;
  for (let i = 0; i < 2400; i++) w.update(1 / 60);   // 40 秒，远超原补投间隔(6s/14s/14s)
  console.assert(w.monsters.length <= n0,
    "任务未完成时也不应增量刷新（原 bug：持续刷怪）: " + n0 + " → " + w.monsters.length);
  console.log("未完成不增援 OK: " + n0 + " → " + w.monsters.length);

  /* ---------- 6. 不再增援：任务完成后同样不新增，并可继续清剿余敌 ---------- */
  const n1 = w.monsters.length;
  G.run.riftTask.done = true;
  for (let i = 0; i < 2400; i++) w.update(1 / 60);   // 再跑 40 秒
  console.assert(w.monsters.length <= n1,
    "任务完成后不应再增援: " + n1 + " → " + w.monsters.length);
  console.log("完成后不增援 OK: " + n1 + " → " + w.monsters.length);

  /* ---------- 7. 任务失败（超时）后同样不增援 ---------- */
  G.run.riftTask.done = false; G.run.riftTask.failed = false; G.run.riftTask.time = 5; G.run.riftTask.remain = 5;
  const n2 = w.monsters.length;
  for (let i = 0; i < 600; i++) w.update(1 / 60);    // 10 秒 → 必定超时
  console.assert(w.freezeTimer === 0, "游戏内不应再次进入冻结");
  for (let i = 0; i < 1200; i++) w.update(1 / 60);   // 再跑 20 秒
  console.assert(w.monsters.length <= n2,
    "任务失败后不应再增援: " + n2 + " → " + w.monsters.length);
  console.log("失败后不增援 OK: " + n2 + " → " + w.monsters.length);

  /* ---------- 8. 返回主地图：状态切回、主地图仍在（回归保护） ---------- */
  const bossBefore = G.mainWorld;
  EventBus.emit("returnFromRift");
  console.assert(G.inRift === false, "返回后应退出裂缝状态");
  console.assert(G.activeWorld === bossBefore, "返回后当前世界应为主地图");
  console.assert(G.mainWorld.monsters.length > 0 || G.mainWorld.circles.length > 0, "主地图内容应保留");
  console.log("返回主地图 OK");

  console.log("RIFT TEST OK");
`, ctx, { filename: "inline" });
