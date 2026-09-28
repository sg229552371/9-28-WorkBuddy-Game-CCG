/* 工匠 UI 关闭后移动复现测试：真实加载 ui.js + main.js */
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
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
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
  // ---- 启动 ----
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites.hero = { width: 60, height: 60 };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);

  // 模拟进入工匠世界（真实事件路径）
  G.subWorld = new World(1920, 1080, false);
  G.inArtisan = true;
  G.activeWorld = G.subWorld;
  G.player.x = G.subWorld.w / 2; G.player.y = 640;

  function keyDown(k) { winHandlers.keydown.forEach(fn => fn({ key: k, preventDefault() { } })); }
  function keyUp(k) { winHandlers.keyup.forEach(fn => fn({ key: k })); }
  let t = 0;
  function frames(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  // ---- 阶段1：工匠世界内先确认能移动 ----
  Game.loop(t); frames(1);
  const x0 = G.player.x;
  keyDown("d"); frames(30); keyUp("d");
  console.assert(G.player.x > x0 + 50, "打开UI前可移动, dx=" + (G.player.x - x0));
  console.log("打开UI前移动 OK: dx =", Math.round(G.player.x - x0));

  // ---- 阶段2：打开工匠 UI（NPC 触发路径）再关闭 ----
  EventBus.emit("openArtisanUI");
  const panelHiddenBefore = document.getElementById("panel-artisan").classList.contains("hidden");
  console.assert(!panelHiddenBefore, "UI 已打开");
  keyDown("e"); keyUp("e");   // E 关闭（真实按键路径）
  frames(5);
  const panelHiddenAfter = document.getElementById("panel-artisan").classList.contains("hidden");
  console.assert(panelHiddenAfter, "UI 已关闭");
  console.log("工匠 UI 打开/关闭 OK");

  // ---- 阶段3：关闭后移动验证 ----
  const x1 = G.player.x, y1 = G.player.y;
  keyDown("a"); frames(30); keyUp("a");
  const dxA = G.player.x - x1;
  console.assert(dxA < -50, "关闭 UI 后可移动(A), dx=" + dxA);
  keyDown("w"); frames(30); keyUp("w");
  const dyW = G.player.y - y1;
  console.assert(dyW < -50, "关闭 UI 后可移动(W), dy=" + dyW);
  console.log("关闭 UI 后移动 OK: dx =", Math.round(dxA), "dy =", Math.round(dyW));

  // ---- 阶段4：再次打开→点按钮关闭→移动 ----
  EventBus.emit("openArtisanUI");
  frames(5);
  // 点击关闭按钮（绑定在 btn-artisan-close 的 onclick）
  const btn = document.getElementById("btn-artisan-close");
  if (btn && btn.onclick) { btn.onclick({}); }
  frames(5);
  const x2 = G.player.x;
  keyDown("d"); frames(30); keyUp("d");
  console.assert(G.player.x > x2 + 50, "按钮关闭后可移动, dx=" + (G.player.x - x2));
  console.log("按钮关闭后移动 OK: dx =", Math.round(G.player.x - x2));

  // ---- 阶段5：返回主地图 → 移动 ----
  EventBus.emit("returnToMain");
  frames(5);
  const x3 = G.player.x;
  keyDown("d"); frames(30); keyUp("d");
  console.assert(G.player.x > x3 + 50, "返回主地图后可移动, dx=" + (G.player.x - x3));
  console.log("返回主地图后移动 OK: dx =", Math.round(G.player.x - x3));

  console.log("ARTISAN MOVE TEST OK");
`, ctx, { filename: "inline" });
