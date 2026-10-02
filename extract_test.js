/* 撤离点雕像（5.2）专项测试：真实加载 config/core/game/ui/main（DOM 桩 + EventBus + 帧推进）
 * 覆盖：Boss 死亡在死亡位置生成雕像 / 远离雕像按 E 不触发 / 雕像附近按 E 开始读条 /
 *       移动打断归零且可重新按 E / 受击打断归零 / 仅 Boss 生成（无场景掉落信标）/
 *       上限 1（重复 Boss 结算不重复生成）/ 雕像渲染确实绘制。 */
"use strict";

/* ---- DOM 桩（带真实 classList 行为，同 rift_test） ---- */
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
  G.run.hp = 100000;                       // 测试无敌注入，聚焦撤离流程

  function keyDown(k) { winHandlers.keydown.forEach(fn => fn({ key: k, preventDefault() { } })); }
  function keyUp(k) { winHandlers.keyup.forEach(fn => fn({ key: k })); }
  let t = 0;
  Game.loop(t);                            // 手动注册主循环（跳过 boot）
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  /* ---------- 0. 配置自检 ---------- */
  console.assert(CFG.extract.channel === 8.0, "撤离读条 8 秒");
  console.assert(CFG.extract.radius > 0, "撤离雕像交互半径应 > 0");
  console.assert(G.run.exitStatue === null, "开局不应有撤离点雕像");
  console.assert(!("extractToken" in G.run), "局内不应再存在撤离代币字段");

  /* ---------- 1. Boss 死亡在死亡位置生成雕像 ---------- */
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
  console.assert(G.mainWorld.boss, "进度满应触发 Boss");
  G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;   // 固定死亡位置便于断言
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  step(5);
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 800 && G.run.exitStatue.y === 600,
    "Boss 死亡应在死亡位置生成撤离点雕像, got " + JSON.stringify(G.run.exitStatue));
  console.log("① Boss 死亡生成雕像 OK: (" + G.run.exitStatue.x + "," + G.run.exitStatue.y + ")");

  /* ---------- 2. 判定圈外：任何成员都不在圈内 → 不读条 ---------- */
  G.mainWorld.monsters.forEach(m => m.dead = true);      // 清场，避免战斗干扰
  G.mainWorld.enemyBullets = [];
  G.mainWorld.altars = [];                               // 清掉随机祭坛（如空间裂缝），避免误触发
  step(3);
  G.player.x = 200; G.player.y = 200;                    // 距雕像 (800,600) 远超判定圈
  keyDown("e"); keyUp("e");                              // E 只做提示，不再是读条开关
  step(5);
  console.assert(!G.run.extractChanneling, "圈外不应开始读条（判定圈规则：站进圈内才读）");
  console.assert(G.run.extractProgress === 0, "圈外进度应保持 0");
  console.log("② 圈外不触发 OK");

  /* ---------- 3. 站进雕像圈内 → **自动**读条（无需按键）+ 进度推进 ---------- */
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;
  step(30);                                              // ~0.5 秒
  console.assert(G.run.extractChanneling === true, "站进雕像圈内应自动开始读条（任一英雄可触发）");
  console.assert(G.run.extractHolder === G.player, "读条持有者应记为圈内英雄（判定原子占用）");
  console.assert(G.run.extractProgress > 0.3, "读条进度应推进, got " + G.run.extractProgress);
  // 雕像渲染验证：绿色系雕像与"撤离点"文字确实被绘制
  ctxCalls.length = 0; step(2);
  const statueTxt = ctxCalls.find(c => c[0] === "fillText" && String(c[1][0]).indexOf("撤离点") >= 0);
  console.assert(statueTxt, "主地图应绘制撤离点雕像文字提示");
  console.assert(String(statueTxt[1][0]).indexOf("圈内") >= 0, "雕像文字应说明「圈内自动读条」新口径");
  const markerIdx = ctxCalls.findIndex(c => c[0] === "fillText" && String(c[1][0]) === "▲");
  console.assert(markerIdx >= 0, "主地图应绘制雕像标记 ▲");
  console.log("③ 圈内自动读条 OK: progress = " + G.run.extractProgress.toFixed(2) + "s（雕像已绘制）");

  /* ---------- 4. 离开判定圈 → 进度缓慢衰退（移动本身不再打断）；回圈继续读 ---------- */
  const pHold = G.run.extractProgress;
  G.player.x = G.run.exitStatue.x + 400; G.player.y = G.run.exitStatue.y + 400;   // 走出判定圈
  step(10);                                              // ~0.17 秒
  console.assert(!G.run.extractChanneling, "离开判定圈后不再读条");
  console.assert(G.run.extractProgress < pHold, "离开圈后进度应衰退（" + pHold.toFixed(2) + " → " + G.run.extractProgress.toFixed(2) + "）");
  console.assert(G.run.extractProgress > 0, "衰退不是瞬间清零（判定圈通用规则，1.2 倍速）");
  step(60);                                              // 继续衰退 → 归零
  console.assert(G.run.extractProgress === 0, "持续离开圈 → 进度衰退归零");
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 800 && G.run.exitStatue.y === 600, "衰退期间雕像仍在原地");
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;              // 回圈
  step(10);
  console.assert(G.run.extractChanneling === true, "回到圈内可继续读条（雕像保留）");
  console.log("④ 离开圈衰退 + 回圈续读 OK: progress = " + G.run.extractProgress.toFixed(2) + "s");

  /* ---------- 5. 受击打断归零 ---------- */
  heroTakeDamage(G.mainWorld, G.player, 1);
  console.assert(!G.run.extractChanneling, "受击应打断撤离读条");
  console.assert(G.run.extractProgress === 0, "受击打断后进度应归零");
  console.log("⑤ 受击打断归零 OK");

  /* ---------- 6. 仅 Boss 生成：场景掉落撤离信标已删除 ---------- */
  console.assert(!CFG.altars.EXTRACT_BEACON, "不应再存在场景掉落撤离信标配置（撤离点只由 Boss 生成）");
  console.log("⑥ 仅 Boss 生成撤离点（无场景掉落信标）OK");

  /* ---------- 7. 上限 1：重复 Boss 结算不重复生成 ---------- */
  const statueBefore = { x: G.run.exitStatue.x, y: G.run.exitStatue.y };
  G.mainWorld.boss = { x: 1500, y: 1500, dead: true };
  onBossDefeated(G.mainWorld);
  console.assert(G.run.exitStatue.x === statueBefore.x && G.run.exitStatue.y === statueBefore.y,
    "已有雕像时重复 Boss 结算不应重新生成（上限 1，位置不变），got " + JSON.stringify(G.run.exitStatue));
  console.log("⑦ 上限 1：重复 Boss 结算不重复生成 OK");

  /* ---------- 8. 判定圈规则：任一英雄可触发 + 同一判定不可同时触发 ----------
   * ①所有英雄都是独立个体 → 任一成员在圈内都能推进（不限队长）；
   * ②同一判定是单一实例（单一进度 + 单一持有者）→ 多人同圈不加速、也不会各触发一次。
   * 这里直接对生产函数 updateExtractJudge / heroInCircle 断言，避免队友 AI 走位干扰。 */
  Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
  G.run.hp = 100000;
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
  G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.enemyBullets = []; G.mainWorld.altars = [];
  step(3);
  const st2 = G.run.exitStatue, mate = G.run.companions[0];
  const R = CFG.extract.radius * CFG.altarJudgeMul;
  console.assert(!!st2 && !!mate, "多英雄局：应生成撤离点雕像且有 AI 队友");
  G.player.x = st2.x + R + 300; G.player.y = st2.y;      // 队长远离
  mate.x = st2.x; mate.y = st2.y;                        // 只有队友在圈内
  console.assert(heroInCircle(st2.x, st2.y, CFG.extract.radius) === mate, "heroInCircle 应命中圈内的队友");
  G.run.extractProgress = 0; G.run.extractHolder = null;
  updateExtractJudge(0.5);
  console.assert(G.run.extractHolder === mate && Math.abs(G.run.extractProgress - 0.5) < 1e-9,
    "任一英雄（队友）在圈内即推进撤离判定，got holder=" + (G.run.extractHolder === mate) + " p=" + G.run.extractProgress);
  G.player.x = st2.x; G.player.y = st2.y;                // 队长也进同一判定圈
  updateExtractJudge(0.5);
  console.assert(Math.abs(G.run.extractProgress - 1.0) < 1e-9,
    "两名英雄同处一个判定圈不加速（+0.5s 而非 +1.0s），got " + G.run.extractProgress);
  // 读条完成 → 判定被消费：进度归零、持有者清空（不可能被第二个英雄重复触发）
  G.run.extractProgress = CFG.extract.channel - 0.5; G.run.extractHolder = null;
  updateExtractJudge(1.0);
  console.assert(G.run.extractProgress === 0 && G.run.extractHolder === null,
    "撤离判定读满即被消费（进度归零 + 持有者清空）");
  console.log("⑧ 判定圈规则（任一英雄可触发 / 同圈不加速 / 单次消费）OK");

  console.log("EXTRACT TEST OK");
`, ctx, { filename: "inline" });
