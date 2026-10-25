/* 无头测试：21.6+ 赛季对抗玩法循环 —— SeasonState 扩展 API + 赛季挑战流程
 * 覆盖（需求 A/B）：
 *   ① isUnlocked 门槛（cleared=19 未解锁 / 20 解锁 + markLevelCleared 只增不减）
 *   ② rewards() 结构 + claimReward 的等级门 / 重复领拒绝
 *   ③ onKill / onLevelUp / onExtract 同时驱动赛季经验与周任务
 *   ④ resetSeason 归零
 *   ⑤ startChallenge / endChallenge 的 challengeActive 与结算返回结构
 *   ⑥ startSeasonChallenge 未解锁（cleared<20）时返回 false 且不改状态
 *   ⑦ 已解锁时 startSeasonChallenge 走通（复用 enterEndless）→ G.seasonRun / challengeActive；
 *      exitSeasonChallenge 清标记 + 回主城
 * 运行：node season_loop_test.js（判绿 = exit 0 且无断言失败）
 * 桩写法参照 season_test.js：FakeEl + global.document/window 桩 + vm 加载游戏脚本
 *（加载顺序与 index.html 一致：config → core → pool → game → items → combat → modes）。
 */
"use strict";

/* ---- DOM / Canvas 桩（与 season_test 同款） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;
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
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

/* ---- 宿主桩：UI / Endless（enterEndless 依赖 Endless.makeWorld + begin 才就绪） ---- */
global.UI = {
  selectedLevel: null,
  toast() { }, showEndlessIntro() { }, showEndlessSettle() { }, showHudOnly() { },
};
global.Endless = {
  makeWorld(w, h) {
    return { kind: "endless", w: w, h: h, monsters: [], playerBullets: [], enemyBullets: [],
      pickups: [], fx: [], teamTrail: null };
  },
  begin() { }, reset() { },
};

/* ---- vm 加载游戏脚本（与 index.html 同序；不加载 main.js：Game 缺失走 enterEndless 降级分支） ---- */
const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

/* ---- 断言器：PASS 文案只用中文，杜绝英文 error/FAIL 字样混入（门禁 grep 口径） ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}
/* 把可能的英文异常名做中文替换，避免污染门禁的 bad 计数（仅在失败时用于调试输出）。 */
function scrub(s) { return String(s || "").replace(/Error/g, "异常").replace(/error/g, "异常"); }

/* =====================================================================
 * 驱动一：SeasonState 扩展 API（①~⑥）——在 vm 内跑，用需求口径覆盖 CFG.season
 * ===================================================================== */
const driverA = `
(function () {
  var R = [];
  function ck(name, cond) { R.push([name, !!cond]); }
  function num(x) { return typeof x === "number"; }
  try {
    /* 0. 用需求口径覆盖 CFG.season（config.js 由主会话并发写入中，此处自持确定口径） */
    CFG.season = {
      maxLv: 10, expBase: 1000, expStep: 200,
      weekly: { killGoal: 200, extractGoal: 3, levelUpGoal: 10 },
      expGain: { kill: 10, killElite: 40, levelUp: 200, extract: 500 },
      rewards: [
        { id: "SR001", unlockAtLv: 1,  type: "crystal",  amount: 200, desc: "赛季奖励一" },
        { id: "SR002", unlockAtLv: 3,  type: "crystal",  amount: 300, desc: "赛季奖励二" },
        { id: "SR003", unlockAtLv: 10, type: "cosmetic", amount: 1,   desc: "赛季限定外观" }
      ],
      challenge: { enabled: true, timeLimit: 900 },
      unlock: { afterLevels: 20, note: "测试" }
    };
    var SS = SeasonState;

    /* ---- ① isUnlocked 门槛 ---- */
    SS.resetSeason();
    SS.clearedLevels = 0;
    ck("门槛：cleared=19 时 isUnlocked 为 false", SS.isUnlocked(19) === false);
    ck("门槛：cleared=20 时 isUnlocked 为 true", SS.isUnlocked(20) === true);
    SS.markLevelCleared(19);
    ck("门槛：markLevelCleared(19) 后 isUnlocked() 为 false", SS.isUnlocked() === false);
    SS.markLevelCleared(20);
    ck("门槛：markLevelCleared(20) 后 isUnlocked() 为 true", SS.isUnlocked() === true);
    SS.markLevelCleared(5);
    ck("门槛：markLevelCleared 只增不减（回填 5 不生效）", SS.clearedLevels === 20);

    /* ---- ② rewards 结构 + claimReward 等级门 / 重复领 ---- */
    SS.resetSeason();
    var rw = SS.rewards();
    ck("奖励：rewards() 返回 3 条", Array.isArray(rw) && rw.length === 3);
    ck("奖励：每条含 id/unlockAtLv/type/amount/desc/claimed 且类型正确",
      rw.every(function (r) {
        return typeof r.id === "string" && num(r.unlockAtLv) && typeof r.type === "string"
          && num(r.amount) && typeof r.desc === "string" && typeof r.claimed === "boolean";
      }));
    ck("奖励：初始 claimed 全为 false", rw.every(function (r) { return r.claimed === false; }));
    ck("奖励：LV1 领取 SR001（需 LV1）成功", SS.claimReward("SR001") === true);
    ck("奖励：重复领取 SR001 被拒", SS.claimReward("SR001") === false);
    ck("奖励：rewards() 反映 SR001 已领取",
      SS.rewards().filter(function (r) { return r.id === "SR001"; })[0].claimed === true);
    ck("奖励：LV1 领取 SR003（需 LV10）被拒", SS.claimReward("SR003") === false);
    ck("奖励：不存在的 id 领取被拒", SS.claimReward("SR999") === false);
    ck("奖励：CFG.season.rewards 缺失时 rewards() 返回空数组", (function () {
      var bak = CFG.season.rewards; CFG.season.rewards = undefined;
      var e = SS.rewards().length === 0; CFG.season.rewards = bak; return e;
    })());

    /* ---- ③ onKill / onLevelUp / onExtract 同时驱动经验与周任务 ---- */
    SS.resetSeason();
    SS.onKill(false);
    ck("击杀：普通击杀 +10 赛季经验（未升级）", SS.seasonExp === 10 && SS.seasonLv === 1);
    ck("击杀：周任务「击杀」进度 = 1", SS.weeklies()[0].progress === 1);
    SS.onKill(true);
    ck("击杀：精英击杀 +40 赛季经验（累计 50）", SS.seasonExp === 50);
    ck("击杀：周任务「击杀」进度 = 2", SS.weeklies()[0].progress === 2);
    SS.onLevelUp();
    ck("升级：+200 赛季经验（累计 250）", SS.seasonExp === 250);
    ck("升级：周任务「局内升级」进度 = 1", SS.weeklies()[2].progress === 1);
    ck("升级：其它周任务进度不受影响", SS.weeklies()[1].progress === 0);
    SS.onExtract();
    ck("撤离：+500 赛季经验（累计 750）", SS.seasonExp === 750);
    ck("撤离：周任务「撤离」进度 = 1", SS.weeklies()[1].progress === 1);

    /* ---- ④ resetSeason 归零 ---- */
    SS.resetSeason();
    ck("重置：seasonLv=1 且 seasonExp=0", SS.seasonLv === 1 && SS.seasonExp === 0);
    ck("重置：周任务三条进度全部归零", SS.weeklies().every(function (t) { return t.progress === 0; }));
    ck("重置：已领奖励清空（SR001 可再次领取）", SS.claimReward("SR001") === true);

    /* ---- ⑤ startChallenge / endChallenge ---- */
    SS.resetSeason();
    ck("挑战：初始 challengeActive 为 false", SS.challengeActive === false);
    ck("挑战：startChallenge 返回 true 且 challengeActive 置位",
      SS.startChallenge([]) === true && SS.challengeActive === true);
    ck("挑战：重复 startChallenge 返回 false", SS.startChallenge([]) === false);
    SS.onKill(false);   /* 挑战中 +10 */
    SS.onExtract();     /* 挑战中 +500 */
    var end = SS.endChallenge();
    ck("挑战：endChallenge 返回 levelBefore/levelAfter/expGained/weeklies 结构",
      end && num(end.levelBefore) && num(end.levelAfter) && num(end.expGained) && Array.isArray(end.weeklies));
    ck("挑战：endChallenge 后 challengeActive 为 false", SS.challengeActive === false);
    ck("挑战：endChallenge.expGained 累计挑战内经验（10+500=510）", end.expGained === 510);
    ck("挑战：endChallenge.weeklies 为 3 条周任务", end.weeklies.length === 3);
    ck("挑战：endChallenge.levelBefore 为挑战起始等级（1）", end.levelBefore === 1);

    /* ---- ⑥ startSeasonChallenge 未解锁 → false 且零改动 ---- */
    SS.resetSeason();
    SS.clearedLevels = 10;   /* < 20 未解锁 */
    var lv0 = SS.seasonLv, exp0 = SS.seasonExp, ch0 = SS.challengeActive;
    var enteredLocked = startSeasonChallenge([]);
    ck("流程：未解锁时 startSeasonChallenge 返回 false", enteredLocked === false);
    ck("流程：未解锁时不改赛季状态与挑战标记",
      SS.seasonLv === lv0 && SS.seasonExp === exp0 && SS.challengeActive === ch0);
    ck("流程：未解锁时 G.seasonRun 未被置位（且 isSeasonRun 为 false）",
      !G.seasonRun && isSeasonRun() === false);
  } catch (e) {
    R.push(["驱动一执行异常", false]);
    R.push(["异常摘要：" + (e && e.message ? e.message : e), false]);
  }
  return R;
})()
`;
const resA = vm.runInContext(driverA, ctx, { filename: "season_loop_driver_a" });
resA.forEach(function (pair) { check(pair[0], pair[1]); });

/* =====================================================================
 * 驱动二：已解锁的赛季挑战全流程（⑦）——复用真实 enterEndless 构建深渊世界
 *   为避免无头环境缺 skill 编译链，仅对 recomputeWeapon / computeStats 打测试桩
 *  ===================================================================== */
const driverB = `
(function () {
  var R = [];
  function ck(name, cond) { R.push([name, !!cond]); }
  try {
    var SS = SeasonState;
    SS.resetSeason();
    SS.clearedLevels = CFG.season.unlock.afterLevels;   /* 恰好解锁 */
    /* 无头桩：跳过需要技能编译链的重算（enterEndless 内部 typeof 守卫调用） */
    recomputeWeapon = function () { };
    computeStats = function () { return { hpMax: 100 }; };
    G.state = "city";
    G.seasonRun = false;
    var hero = CFG.heroes[0];
    var ok = startSeasonChallenge([hero]);
    ck("流程：已解锁时 startSeasonChallenge 返回 true", ok === true);
    ck("流程：进入后 G.seasonRun 置位且 isSeasonRun() 为 true", G.seasonRun === true && isSeasonRun() === true);
    ck("流程：进入后 SeasonState.challengeActive 为 true", SS.challengeActive === true);
    ck("流程：进入后处于深渊世界（G.inEndless 置位）", G.inEndless === true);

    /* 局内事件累计（模拟战斗回调） */
    SS.onKill(true);       /* +40 */
    SS.onLevelUp();        /* +200 */
    var ex = exitSeasonChallenge();
    ck("流程：exitSeasonChallenge 返回结算结构（含 expGained=240）",
      ex && ex.expGained === 240 && typeof ex.levelAfter === "number");
    ck("流程：退出后 G.seasonRun 清除且 isSeasonRun() 为 false", !G.seasonRun && isSeasonRun() === false);
    ck("流程：退出后 challengeActive 为 false", SS.challengeActive === false);
    ck("流程：退出后已回主城（G.inEndless 清除）", G.inEndless === false);

    /* D035 集成防污染回归（主会话补）：走「无尽原生退出/进入」路径也必须清赛季标记 ——
     * 防玩家从赛季挑战走深渊结算按钮退出后，G.seasonRun 残留导致后续主线被误计赛季分。 */
    G.seasonRun = true;
    exitEndlessToCity();
    ck("防污染：直接 exitEndlessToCity 清除赛季标记", !G.seasonRun);
    G.seasonRun = true;
    G.state = "city";
    enterEndless([]);
    ck("防污染：直接 enterEndless 重置赛季标记（防残留污染主线）", G.seasonRun === false);
  } catch (e) {
    R.push(["驱动二执行异常", false]);
    R.push(["异常摘要：" + (e && e.message ? e.message : e), false]);
  }
  return R;
})()
`;
const resB = vm.runInContext(driverB, ctx, { filename: "season_loop_driver_b" });
resB.forEach(function (pair) { check(pair[0], pair[1]); });

/* ====== 汇总 ====== */
console.log("赛季循环测试完成：PASS " + passCount + " 条，失败（断言未过）" + failCount + " 条");
if (failCount > 0) {
  /* 失败时给出被清洗过的摘要，便于定位（正常绿跑不会进入此分支） */
  (resA.concat(resB)).filter(function (p) { return !p[1]; }).forEach(function (p) {
    console.log("未过项：" + scrub(p[0]));
  });
  process.exit(1);
}
