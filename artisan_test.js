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

  /* ============ 阶段6：工匠雕像池（配额池 + 限制器 + 多触发条件，4.6） ============
   * 设计目标：子世界可无限次进入 —— 雕像"使用后消失"，池按触发条件持续产出新雕像。 */

  // 干净场地：清掉场上已有雕像，重置池状态
  const mainW = G.mainWorld;
  function clearStatues() { mainW.altars = mainW.altars.filter(a => a.id !== "ALTAR_005"); }
  function poolReset() { G.run.artisanPool = createArtisanPool(); clearStatues(); }
  function settlePool(dt) { updateArtisanPool(mainW, 0); G.run.artisanPool.readyAt = 0; updateArtisanPool(mainW, dt || 0.1); }
  function fieldStatues() { return mainW.altars.filter(a => a.id === "ALTAR_005").length; }

  // 6.1 触发条件各自独立投配额，多条并存互不排斥
  poolReset();
  G.run.kills = CFG.levels[0].artisanAtKills;                 // 首次里程碑
  G.run.bossDefeated = false; G.run.eliteKills = 0;
  updateArtisanPool(mainW, 0);
  const qFirst = G.run.artisanPool.quota;
  console.assert(qFirst >= 1, "触发条件①击杀里程碑投配额，quota=" + qFirst);
  G.run.bossDefeated = true;                                  // BOSS 击败（与上一条并存）
  const qBoss0 = G.run.artisanPool.quota;
  updateArtisanPool(mainW, 0);
  console.assert(G.run.artisanPool.quota > qBoss0, "触发条件②BOSS 击败并行追加配额，quota=" + G.run.artisanPool.quota);
  G.run.eliteKills = 2;                                       // 精英猎杀（每 2 只 1 次）
  const qBeforeElite = G.run.artisanPool.quota;
  updateArtisanPool(mainW, 0);
  console.assert(G.run.artisanPool.quota > qBeforeElite, "触发条件③精英猎杀投配额");
  // 保底单独验证：用干净池（配额保持 0），避免同帧落地扣配额干扰计数
  poolReset();
  G.run.kills = 0; G.run.bossDefeated = false; G.run.eliteKills = 0;
  const pityCfg = CFG.artisan.triggers.find(t => t.type === "pity");
  updateArtisanPool(mainW, pityCfg.interval - 1);
  console.assert(G.run.artisanPool.quota === 0, "保底未到点时不投配额");
  updateArtisanPool(mainW, 1);
  console.assert(G.run.artisanPool.quota === 1, "触发条件④保底计时到点投配额");
  console.log("雕像池触发条件 OK: 首次/BOSS/精英/保底 均独立生效");

  // 6.2 限制器：配额就绪不立即落地（随机延迟），压缩延迟后才落地
  poolReset();
  G.run.kills = CFG.levels[0].artisanAtKills;
  updateArtisanPool(mainW, 0);
  console.assert(G.run.artisanPool.pending && fieldStatues() === 0, "限制器①：配额就绪后进入延迟投放（不当场贴脸生成）");
  G.run.artisanPool.readyAt = 0; updateArtisanPool(mainW, 0.1);
  console.assert(fieldStatues() === 1, "延迟结束后落地 1 座");

  // 6.3 限制器：同屏最多 maxOnField 座（有配额也不再落地）
  const lim = CFG.artisan.limiter;
  G.run.artisanPool.quota = 5;
  updateArtisanPool(mainW, 0.1);
  console.assert(fieldStatues() === lim.maxOnField, "限制器②：同屏最多 " + lim.maxOnField + " 座，got " + fieldStatues());

  // 6.4 使用雕像 → 雕像消失 + 进入冷却 + 子世界可再次进入
  const st = mainW.altars.find(a => a.id === "ALTAR_005");
  const before = fieldStatues();
  mainW.triggerAltar(st);
  console.assert(fieldStatues() === before - 1, "雕像生效后从地图上消失（使用即消耗）");
  console.assert(G.run.artisanPool.cooldown === lim.cooldown, "使用后进入冷却 " + lim.cooldown + "s");
  console.assert(G.inArtisan === true, "雕像使用后可进入工匠子世界（不限次数）");
  mainW.altars = mainW.altars.filter(a => a.id !== "ALTAR_005");   // 清场以便验证冷却

  // 6.5 冷却期内不投放；冷却结束后可再投放（→ 无限次进入的机制保证）
  poolReset();
  G.run.artisanPool.quota = 3;
  G.run.artisanPool.cooldown = lim.cooldown;
  settlePool(0.1);
  console.assert(fieldStatues() === 0, "限制器③：冷却期内不投放");
  G.run.artisanPool.cooldown = 0;
  settlePool(0.1);
  console.assert(fieldStatues() === 1, "冷却结束后可再次投放（子世界可无限次进入）");

  // 6.6 限制器：每关投放上限
  poolReset();
  G.run.artisanPool.spawned = lim.maxPerLevel;
  G.run.artisanPool.quota = 9;
  settlePool(0.1);
  console.assert(fieldStatues() === 0 && G.run.artisanPool.quota === 0, "限制器④：达到每关上限后不再产出");

  // 6.7 非主地图不投放（工匠世界/裂缝不产生工匠雕像）
  poolReset();
  const subW = new World(1920, 1080, false);
  G.run.artisanPool.quota = 3;
  updateArtisanPool(subW, 0); G.run.artisanPool.readyAt = 0; updateArtisanPool(subW, 0.1);
  console.assert(subW.altars.every(a => a.id !== "ALTAR_005"), "非主地图不投放工匠雕像");

  // 6.8 节奏模拟：一整关（击杀 0 → progressGoal，200 秒），雕像一出现就"使用"
  //     期望：受配额来源（首次1 + 进度3 + BOSS1 = 5）+ 限制器（冷却20s / 每关上限6）约束，
  //     全关落地 4~6 座 —— 既不至于进不了工匠世界，也不会刷成"无脑无限进"。
  poolReset();
  G.run.kills = 0; G.run.bossDefeated = false; G.run.eliteKills = 0;
  const lvCfg = CFG.levels[0];
  let used = 0, simT = 0;
  while (simT < 200) {
    G.run.kills = Math.min(lvCfg.progressGoal, Math.floor(simT / 200 * lvCfg.progressGoal));
    if (simT > 150) G.run.bossDefeated = true;                 // 模拟 BOSS 在中后段被击败
    updateArtisanPool(mainW, 0.5); simT += 0.5;
    for (const s of mainW.altars.filter(a => a.id === "ALTAR_005")) {   // 出现即使用（含"使用后消失 + 冷却"）
      mainW.altars.splice(mainW.altars.indexOf(s), 1);
      G.run.artisanPool.cooldown = lim.cooldown;
      used++;
    }
  }
  const spawnedTotal = G.run.artisanPool.spawned;
  console.assert(spawnedTotal === used, "每次投放都被使用（雕像不堆积），spawned=" + spawnedTotal + " used=" + used);
  console.assert(spawnedTotal <= lim.maxPerLevel, "全关投放不超过每关上限 " + lim.maxPerLevel + "，got " + spawnedTotal);
  console.assert(spawnedTotal >= 4 && spawnedTotal <= 6, "全关约 4~6 次工匠机会（节奏合理），got " + spawnedTotal);
  console.log("雕像池节奏模拟 OK: 全关投放 " + spawnedTotal + " 座（上限 " + lim.maxPerLevel + "）");

  console.log("ARTISAN POOL TEST OK");
`, ctx, { filename: "inline" });
