/* ============================================================
 * xgame_boss_crystal_test.js —— X-GAMe 专项：Boss 结晶「击败即发」
 * 目标：核验把 Boss 结晶从「结算时发放」改为「击败 Boss 瞬间立即发放」后：
 *   ① 击杀 Boss 的瞬间 Meta.data.crystals 立即 +CFG.outLevel.crystalBoss（记录前后差）；
 *   ② 随后的撤离结算**不重复**计 Boss 结晶（只加折算 conv.total）；
 *   ③ 击杀后死亡，Boss 结晶**保留**（按「字面即发」口径不回扣）；
 *   ④ 重复触发 onBossDefeated **不重复发放**（一次性门控）。
 * 做法：按 index.html 脚本顺序用 node vm 加载**全部** js；真实 startRun 造 run，
 *       走真实击杀路径（onMonsterKilled 触发出 Boss → damageMonster 致死 → 主循环 World.update 触发 onBossDefeated）。
 * 约束：不伪造桩数据、不放宽断言、不空数组恒真。
 * 运行：node xgame_boss_crystal_test.js
 * 注意：PASS 文案禁用英文 error/FAIL；失败行用中文「未通过」；末尾输出 PASS 合计 / 失败数 并以退出码反映。
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

/* ---------- DOM / Canvas 桩（沿用既有套件口径：boss_test / exp_test） ---------- */
const ctxCalls = [];
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 200000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 200000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  removeEventListener() { }
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
  addEventListener() { }, removeEventListener() { },
  querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { }, removeEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
/* node 22 自带 navigator/performance（只读），沿用即可，不覆盖；location 默认不存在，补桩 */
try { global.location = { search: "", href: "", reload() { } }; } catch (e) { /* 只读则忽略 */ }
const _store = Object.create(null);
global.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v) { _store[k] = String(v); },
  removeItem(k) { delete _store[k]; },
};
/* ui.js 会 `const UI = {...}` 覆盖此桩（同浏览器：脚本内词法绑定优先）；桩仅为 ui.js 未加载时的兜底 */
global.UI = new Proxy({}, { get: () => () => { } });

/* ---------- 按 index.html 脚本顺序加载全部 js（真实文件读取，非人工清单） ---------- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const order = [...html.matchAll(/<script src="(js\/[^"?]+)(?:\?[^"]*)?"/g)].map(m => m[1]);
const files = order.filter((f, i) => order.indexOf(f) === i);

const vm = require("vm");
const ctx = vm.createContext(global);
let loadFail = null;
try {
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
} catch (e) {
  loadFail = e;
}
global.__loadFailMsg = loadFail ? String((loadFail && loadFail.message) || loadFail) : "";
global.__loadedFileCount = loadFail ? -1 : files.length;
global.__indexedFileCount = files.length;

/* ---------- 断言驱动（const Meta/CFG/Game 在 vm 作用域内可见） ---------- */
const driver = `
global.__pass = 0; global.__fail = 0;
const check = (name, cond) => {
  if (cond) { global.__pass++; console.log("PASS " + name); }
  else { global.__fail++; console.log("未通过 " + name); }
};
const CB = CFG.outLevel.crystalBoss;   // 60

if (__loadedFileCount < 0) {
  check("加载全部 js（按 index.html 顺序，共 " + __indexedFileCount + " 个）", false);
} else {
  check("加载全部 js（按 index.html 顺序，共 " + __indexedFileCount + " 个）", __loadedFileCount === __indexedFileCount);

  /* ---------- 环境 ---------- */
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: { width: 60, height: 60 }, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } };

  /* ============ 0. 接口与单元口径 ============ */
  check("0.1 game.js 定义 Meta.awardBossCrystal()", typeof Meta.awardBossCrystal === "function");
  {
    const b = Meta.data.crystals;
    const rv = (typeof Meta.awardBossCrystal === "function") ? Meta.awardBossCrystal() : null;
    check("0.2 awardBossCrystal() 返回 crystalBoss=" + CB + " 且即时入账一次（前后差=" + (Meta.data.crystals - b) + "）",
      rv === CB && (Meta.data.crystals - b) === CB);
  }

  /* 公共：造一个「Boss 已出现」的主世界（真实 startRun + onMonsterKilled 触发刷 Boss） */
  const startRunAndSpawnBoss = () => {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    if (typeof Game.skipLevelUpChoice === "function") Game.skipLevelUpChoice();
    G.run.kills = CFG.levels[0].progressGoal;
    onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
    return !!(G.run.bossSpawned && G.mainWorld.boss);
  };

  /* ============ 一、击败即发：击杀 Boss 瞬间结晶立即增加 ============ */
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  if (typeof Game.skipLevelUpChoice === "function") Game.skipLevelUpChoice();
  Game.loop(t);                              // 注册主循环一次（step 依赖 __raf）
  check("1.1 前置：真实刷出 Boss（bossSpawned 且存在 boss 实体）", startRunAndSpawnBoss());
  check("1.2 前置：击杀前 bossDefeated 仍为 false", G.run.bossDefeated === false);
  {
    const before = Meta.data.crystals;
    // 真实击杀：damageMonster 致死 → 主循环 World.update 检测 boss.dead → onBossDefeated
    G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;
    while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
    check("1.3 前置：Boss 已被打死（dead=true）", G.mainWorld.boss.dead === true);
    step(3);                                 // 主循环推进 → 触发 onBossDefeated（击败即发）
    const after = Meta.data.crystals;
    check("1.4 击败 Boss 后 bossDefeated 置位", G.run.bossDefeated === true);
    check("1.5 一次性门控标记 r.bossCrystalAwarded 置位", G.run.bossCrystalAwarded === true);
    check("1.6 击败 Boss 瞬间 Meta.data.crystals 立即 +" + CB + "（前后差=" + (after - before) + "）", (after - before) === CB);

    /* ============ 二、重复触发 onBossDefeated 不重复发放 ============ */
    const afterKill = Meta.data.crystals;
    onBossDefeated(G.mainWorld);             // 直接重复调用（模拟重复击杀 / 异常重复触发）
    onBossDefeated(G.mainWorld);
    check("2.1 重复触发 onBossDefeated 不再发放（结晶保持 " + Meta.data.crystals + "）", Meta.data.crystals === afterKill);

    /* ============ 三、撤离结算：不重复计 Boss 结晶（总额只加 conv.total） ============ */
    // 放一件有价物品，令折算 > 0，从而能区分「加了折算」与「又加了 Boss」
    G.run.backpack.place(makeChestItem("normal"), 0, 0);
    const conv = calcSettleConvert(G.run);
    check("3.1 前置：本局有可折算物资（conv.total=" + conv.total + "）", conv.total > 0);
    check("3.2 前置：撤离前 G.state=playing", G.state === "playing");
    const beforeExtract = Meta.data.crystals;
    EventBus.emit("extractSuccess");         // 走真实结算事件链路
    const afterExtract = Meta.data.crystals;
    check("3.3 撤离结算只加折算结晶（前後差=" + (afterExtract - beforeExtract) + "，应 = conv.total=" + conv.total + "）",
      (afterExtract - beforeExtract) === conv.total);
    check("3.4 撤离结算未重复计入 Boss 结晶（差值不含 " + CB + "）", (afterExtract - beforeExtract) !== (conv.total + CB));
  }

  /* ============ 四、击杀后死亡：Boss 结晶保留（不回扣） ============ */
  check("4.0 前置：重新造局并刷出 Boss", startRunAndSpawnBoss());
  {
    const before = Meta.data.crystals;
    G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;
    while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
    step(3);
    const afterKill = Meta.data.crystals;
    check("4.1 击杀后结晶已到账（前后差=" + (afterKill - before) + "）", (afterKill - before) === CB);
    check("4.2 前置：死亡前 G.state=playing", G.state === "playing");
    const penalty = calcDeathPenalty(G.run);
    EventBus.emit("playerDied", penalty);    // 走真实死亡结算事件链路
    const afterDeath = Meta.data.crystals;
    check("4.3 死亡结算不回扣已发放的 Boss 结晶（死亡前後差=" + (afterDeath - afterKill) + "，应=0）", (afterDeath - afterKill) === 0);
    check("4.4 死亡后 Boss 结晶仍保留（= 击杀后总额 " + afterKill + "）", afterDeath === afterKill);
  }
}

`;

let driverErr = null;
try {
  vm.runInContext(driver, ctx, { filename: "xgame_boss_crystal_test-driver" });
} catch (e) {
  driverErr = e;
  console.log("未通过 驱动执行期异常：" + String((e && e.message) || e));
}

const pass = global.__pass | 0;
const fail = (global.__fail | 0) + (driverErr ? 1 : 0);

console.log("PASS 合计 = " + pass + "   失败数 = " + fail);
process.exit(fail === 0 ? 0 : 1);
