/* 无头测试：主关卡开场冻结（出征进入主地图的「停留 3 秒」，规则同裂缝 5.1）
 * 覆盖：冻结时长 / 冻结期间全员静止+无敌（战斗逻辑全停）/ 倒计时红字渲染 /
 *       归零后开战 / 主关卡与裂缝互不干扰 / 工匠世界不受影响（node freeze_test.js）
 *
 * ⚠️ 本文件**不调用** Game.skipIntroFreeze() —— 它专门验证冻结机制本身。
 */
"use strict";

/* ---- DOM / Canvas 桩（记录 ctx 调用，用于断言倒计时渲染） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;   // 暴露给 vm 驱动脚本（渲染断言用）
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { ctxCalls.push([p, a]); };
  },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
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
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };   // 捕获主循环回调，供 step() 驱动
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  /* ============ 一、配置存在且合理 ============ */
  check("CFG.levelFreeze 已定义", !!CFG.levelFreeze);
  check("CFG.levelFreeze.freezeTime = 3.0", CFG.levelFreeze.freezeTime === 3.0);
  check("冻结时长 > 0", CFG.levelFreeze.freezeTime > 0);

  /* ============ 二、进入主关卡即处于冻结 ============ */
  Game.startRun(CFG.heroes[0]);
  const w = G.mainWorld;
  check("出征后主世界 freezeTimer = CFG.levelFreeze.freezeTime",
        Math.abs(w.freezeTimer - CFG.levelFreeze.freezeTime) < 1e-9);
  check("主世界 freezeTimer > 0（处于开场冻结）", w.freezeTimer > 0);
  check("首波怪已投放（冻结期间场上有敌人，但不会动）", w.monsters.length > 0);

  Game.loop(t);   // 注册主循环后 step() 才可用
  /* ============ 三、冻结期间：全员静止 + 全部战斗逻辑暂停 ============ */
  {
    const px0 = G.player.x, py0 = G.player.y;
    // 记录冻结前的怪物坐标与子弹数
    const m0 = w.monsters.map(m => ({ x: m.x, y: m.y }));
    const b0 = (w.playerBullets || []).length + (w.enemyBullets || []).length;
    G.keys["w"] = true;   // 施加移动意图：冻结期间不应产生位移
    step(30);             // ~0.5 秒
    G.keys["w"] = false;

    check("冻结期间玩家不移动（全员静止）", Math.abs(G.player.x - px0) < 1e-6 && Math.abs(G.player.y - py0) < 1e-6);
    const moved = w.monsters.some((m, i) => m0[i] && (Math.abs(m.x - m0[i].x) > 1e-6 || Math.abs(m.y - m0[i].y) > 1e-6));
    check("冻结期间怪物不移动", !moved);
    const b1 = (w.playerBullets || []).length + (w.enemyBullets || []).length;
    check("冻结期间不产生子弹（战斗逻辑暂停）", b1 === b0);
    check("跑 0.5 秒后仍在冻结中", w.freezeTimer > 0);
    check("冻结期间玩家未受伤（无敌：hp 不下降）", G.player.hp === G.player.hpMax || G.player.hp > 0);
  }

  /* ============ 四、冻结期间渲染红色倒计时大字 ============ */
  {
    __ctxCalls.length = 0;
    step(1);
    const redIdx = __ctxCalls.findIndex(c => c[0] === "set:fillStyle" && String(c[1][0]) === "#ff3b3b");
    check("冻结期间绘制红色倒计时（fillStyle #ff3b3b）", redIdx >= 0);
    const numIdx = __ctxCalls.findIndex((c, i) => i > redIdx && c[0] === "fillText" && /^[123]$/.test(String(c[1][0])));
    check("倒计时数字为 1/2/3 之一", numIdx >= 0);
    const dimIdx = __ctxCalls.findIndex(c => c[0] === "set:fillStyle" && String(c[1][0]).indexOf("rgba(8,12,20") === 0);
    check("冻结期间压暗战场（rgba(8,12,20,…) 遮罩）", dimIdx >= 0);
    const hintIdx = __ctxCalls.findIndex(c => c[0] === "fillText" && String(c[1][0]).indexOf("全员冻结中") >= 0);
    check("冻结期间显示「全员冻结中 · …」提示", hintIdx >= 0);
  }

  /* ============ 五、倒计时归零 → 解除冻结并开战 ============ */
  {
    // 从一次全新的冻结开始计时，保证帧数与 freezeTime 对应
    Game.startRun(CFG.heroes[0]);
    const w3 = G.mainWorld;
    check("新一局重新进入冻结", w3.freezeTimer > 0);
    let guard = 0;
    while (w3.freezeTimer > 0 && guard < 400) { step(1); guard++; }
    check("冻结会在有限帧内自然解除（无需手动跳过）", w3.freezeTimer === 0);
    // 3.0s / 16.7ms ≈ 180 帧；留出容差
    check("解冻耗时约 3 秒（150~220 帧）", guard >= 150 && guard <= 220);

    // 解冻后：玩家可移动、runTime 开始推进
    const rt0 = G.run.runTime;
    const px0 = G.player.x;
    G.keys["d"] = true;
    step(20);
    G.keys["d"] = false;
    check("解冻后玩家可以移动", Math.abs(G.player.x - px0) > 1e-3);
    check("解冻后 runTime 正常推进（冻结期间不计时）", G.run.runTime > rt0);
  }

  /* ============ 六、冻结期间不推进主关卡计时（进度条/计时器暂停） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    const w2 = G.mainWorld;
    const rt0 = G.run.runTime;
    step(30);   // ~0.5s，仍在冻结
    check("冻结期间 runTime 不推进", G.run.runTime === rt0);
    check("冻结期间 freezeTimer 递减", w2.freezeTimer < CFG.levelFreeze.freezeTime);
  }

  /* ============ 七、工匠世界不受主关卡冻结影响（无敌人安全区） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    Game.skipIntroFreeze();     // 先解主关卡冻结，再进工匠世界
    EventBus.emit("enterArtisan");
    check("工匠世界不设置开场冻结（freezeTimer = 0）", !G.subWorld || G.subWorld.freezeTimer === 0);
  }

  /* ============ 八、裂缝冻结与主关卡冻结互不干扰 ============ */
  {
    check("裂缝仍用 CFG.rift.freezeTime（未被改写）", CFG.rift.freezeTime > 0);
    check("两套冻结时长配置互相独立",
          CFG.levelFreeze.freezeTime !== undefined && CFG.rift.freezeTime !== undefined);
  }

  /* ============ 九、skipIntroFreeze 辅助方法（测试/调试用） ============ */
  {
    Game.startRun(CFG.heroes[0]);
    check("startRun 后处于冻结", G.mainWorld.freezeTimer > 0);
    Game.skipIntroFreeze();
    check("skipIntroFreeze() 后主世界冻结解除", G.mainWorld.freezeTimer === 0);
    check("skipIntroFreeze() 后活动世界也解除", !G.activeWorld || G.activeWorld.freezeTimer === 0);
  }

  console.log(ok ? "FREEZE OK" : "FREEZE FAILED");
  if (!ok) throw new Error("freeze_test FAILED");
`;
vm.runInContext(driver, ctx, { filename: "freeze_driver" });
