/* 背包/武器栏拖拽回归测试：真实加载 ui.js + main.js，模拟指针事件 */
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
    this.tag = tag; this.id = ""; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this._rect = { left: 0, top: 0, width: 400, height: 400 };
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return new FakeEl("div"); }   // 供 .giveup 等绑定 onclick
  querySelectorAll() { return []; }
  closest(sel) {
    for (const id of ["#grid-backpack", "#grid-weapon", "#drop-zone"])
      if (sel.includes(id) && this.id === id.slice(1)) return this;
    return null;
  }
  getBoundingClientRect() { return this._rect; }
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
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl("div")); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelector: () => null, querySelectorAll: () => [],
  elementFromPoint: () => global.__pointEl || null,
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
  G.inArtisan = true;   // 工匠世界（解锁管理）

  // 指针模拟：_dropTarget 依赖 elementFromPoint + getBoundingClientRect + client 坐标
  // 网格 rect: left=0, top=0；pad=8, cell=50 → 格坐标 = floor((client-8)/50)
  const gridBp = document.getElementById("grid-backpack"); gridBp.id = "grid-backpack";
  const gridWp = document.getElementById("grid-weapon"); gridWp.id = "grid-weapon";
  function pointAtGrid(grid, gx, gy) {
    global.__pointEl = grid;
    return { clientX: 8 + gx * 50 + 25, clientY: 8 + gy * 50 + 25, preventDefault() { } };
  }
  function dragTo(item, grid, gx, gy, fromPending) {
    UI.drag = { item, fromPending: !!fromPending };
    UI.onPointerUp(pointAtGrid(grid, gx, gy));
  }
  function freshInvs() {
    G.run.backpack = new Inventory(6, 4, "backpack");
    G.run.weaponInv = new Inventory(4, 3, "weapon");
    G.run.pendingItems = [];
  }
  // 形状速查：G001 1×1 / G006 1×1 / G004 2×1 / G005 1×1 / M005 2×1 / M006 2×2 / M002 2×1
  const ok = (cond, msg) => { if (!cond) console.error("FAIL: " + msg); };

  // ============ 场景 1：同格内挪动 2×2 物品（自重叠）→ 不得复制 ============
  freshInvs();
  const big = makeModule("M006", 0);   // 2×2
  G.run.weaponInv.place(big, 0, 0);
  dragTo(big, gridWp, 1, 1);           // 目标 (1,1) 与原 (0,0) 部分重叠
  ok(G.run.weaponInv.items.length === 1, "S1 物品不复制, items=" + G.run.weaponInv.items.length);
  ok(big.x === 1 && big.y === 1 && big.inv === "weapon", "S1 挪动到 (1,1), got " + big.x + "," + big.y);
  ok(G.run.weaponInv.totalWeight() === big.weight, "S1 重量不翻倍");
  console.log("场景1 同格挪动: items=" + G.run.weaponInv.items.length + " 位置 (" + big.x + "," + big.y + ")");

  // ============ 场景 2：同格交换（1×1）→ 互换位置 ============
  freshInvs();
  const a = makeGear("G001", 0), b = makeGear("G006", 0);   // 均 1×1
  G.run.backpack.place(a, 0, 0); G.run.backpack.place(b, 1, 0);
  dragTo(a, gridBp, 1, 0);
  ok(a.x === 1 && a.y === 0 && a.inv === "backpack", "S2 A → (1,0)");
  ok(b.x === 0 && b.y === 0 && b.inv === "backpack", "S2 B 回到 A 腾出的 (0,0), got " + b.x + "," + b.y + " inv=" + b.inv);
  ok(G.run.backpack.items.length === 2, "S2 无复制");
  console.log("场景2 同格交换: A(" + a.x + "," + a.y + ") B(" + b.x + "," + b.y + ")");

  // ============ 场景 3：跨栏交换（背包 2×1 ↔ 武器栏 2×1）→ 互换 ============
  freshInvs();
  const g1 = makeGear("G004", 1), m1 = makeModule("M005", 0);   // 均 2×1
  G.run.backpack.place(g1, 0, 0); G.run.weaponInv.place(m1, 0, 0);
  dragTo(g1, gridWp, 0, 0);
  ok(g1.inv === "weapon" && g1.x === 0 && g1.y === 0, "S3 装备入武器栏 (0,0), got " + g1.inv);
  ok(m1.inv === "backpack" && m1.x === 0 && m1.y === 0, "S3 模块回背包 (0,0), got " + m1.inv + " " + m1.x + "," + m1.y);
  console.log("场景3 跨栏交换: 装备→武器栏(" + g1.x + "," + g1.y + ") 模块→背包(" + m1.x + "," + m1.y + ")");

  // ============ 场景 4：待分配区 → 网格 / 空间不足回退 ============
  freshInvs();
  const p1 = makeGear("G005", 2);
  G.run.pendingItems.push(p1);
  dragTo(p1, gridBp, 5, 3, true);
  ok(G.run.pendingItems.length === 0 && p1.inv === "backpack", "S4 待分配拖入成功");
  // 武器栏塞满 1×1 → 2×2 无处可放 → 回退待分配
  const wp = G.run.weaponInv;
  for (let i = 0; i < 12; i++) { const f = makeGear("G001", 0); ok(wp.place(f, i % 4, Math.floor(i / 4)), "S4 填充 " + i); }
  const p2 = makeModule("M006", 0);    // 2×2
  G.run.pendingItems.push(p2);
  dragTo(p2, gridWp, 0, 0, true);
  ok(G.run.pendingItems.includes(p2) && !wp.items.includes(p2), "S4 满栏时回退到待分配区");
  ok(wp.items.length === 12, "S4 满栏未被破坏, items=" + wp.items.length);
  console.log("场景4 待分配区: 拖入成功 + 满栏回退 OK");

  // ============ 场景 5：边缘/越界钳制放置 ============
  freshInvs();
  const p3 = makeGear("G005", 0);      // 1×1
  G.run.pendingItems.push(p3);
  dragTo(p3, gridBp, 5, 3, true);      // 右下角格
  ok(p3.inv === "backpack" && p3.x === 5 && p3.y === 3, "S5 边缘放置 OK, got " + p3.x + "," + p3.y);
  const p4 = makeGear("G004", 0);      // 2×1
  G.run.pendingItems.push(p4);
  dragTo(p4, gridBp, 5, 0, true);      // x=5 放不下 2 宽 → findSpot 兜底
  ok(p4.inv === "backpack", "S5 越界钳制兜底 OK");
  console.log("场景5 边缘放置: (" + p3.x + "," + p3.y + ") + 兜底 (" + p4.x + "," + p4.y + ")");

  // ============ 场景 6：同物品拖回原位 → 无操作 ============
  freshInvs();
  const c = makeGear("G001", 0);
  G.run.backpack.place(c, 2, 1);
  UI.drag = { item: c };
  UI.onPointerUp(pointAtGrid(gridBp, 2, 1));
  ok(G.run.backpack.items.length === 1 && c.x === 2 && c.y === 1, "S6 原位释放无变化");
  console.log("场景6 原位释放 OK");

  // ============ 场景 7：词条联动 — 拖动模块后武器属性重算 ============
  freshInvs();
  const cd1 = makeModule("M002", 1);   // 2×1，冷却 -12%
  G.run.weaponInv.place(cd1, 0, 0);
  recomputeWeapon();
  const cdOn = G.run.weapon.basic.cd;
  ok(cdOn < CFG.skills.AT101.cd + 1e-6, "S7 装入时冷却降低");
  dragTo(cd1, gridBp, 0, 0);           // 拖出武器栏 → 冷却词条失效
  ok(Math.abs(G.run.weapon.basic.cd - CFG.skills.AT101.cd) < 1e-6, "S7 拖出后冷却回基础值, got " + G.run.weapon.basic.cd + " vs " + CFG.skills.AT101.cd);
  ok(cd1.inv === "backpack", "S7 模块已在背包");
  console.log("场景7 词条联动: 装入 " + cdOn.toFixed(3) + " → 拖出 " + G.run.weapon.basic.cd.toFixed(3));
  console.log("BACKPACK DRAG TEST OK");
`, ctx, { filename: "inline" });
