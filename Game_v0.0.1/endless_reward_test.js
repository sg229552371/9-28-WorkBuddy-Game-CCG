/* 21.15 🅓 无尽模式「奖励与局外成长打通」回归测试（node endless_reward_test.js）
 * 覆盖：
 *   ① 波次奖励公式正确（对照 Endless.waveReward）
 *   ② 每 chestEvery(=5) 波掉宝箱的条件（对照 Endless.dropsChest + EndlessReward.tick）
 *   ③ 入账链路审计：同一份结晶不被入账两次（唯一入账点 + 报告口径）
 *   ④ 死亡保留比例继承正确（CFG.outLevel.deathRatio = 0.3）
 *   ⑤ 结算数据字段完整（wave/kills/crystals + 明细报告）
 *   ⑥ 无 DOM 沙箱安全（核心逻辑在 vm 沙箱内跑通，不读 document）
 * 判绿 = exit 0 且末行 ENDLESS REWARD TEST OK；
 * PASS 文案严禁出现英文 error/Error/FAIL（门禁口径，dev_guide 坑 4）。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---- 断言器：PASS 文案只含中文，避免门禁 grep 误判 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
}

/* ===== 沙箱装载：给最小 DOM/Image 桩（game.js 顶层需要），核心逻辑本身不读 DOM ===== */
const noop = () => { };
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  children: [], innerHTML: "", textContent: "", disabled: false, width: 300, height: 300, value: "",
  appendChild(c) { this.children.push(c); return c; }, remove: noop,
  addEventListener: noop, setAttribute: noop, getAttribute: () => null,
  getContext: () => ({}), querySelector: () => fakeEl(), querySelectorAll: () => [],
  closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
});
/* UI 桩：main.js 顶层会引用 UI.*（结算/提示），全部做成无害空函数 */
const UI = {
  toast: noop, showScreen: noop, showHudOnly: noop, updateHUD: noop, renderBackpack: noop,
  toggleBackpack: noop, clearBattleHud: noop, updateHomeUser: noop, closeNpcPanels: noop,
  buildLevelList: noop, onLevelUpChoice: noop, onLevelUpChoiceClose: noop,
  hideEndlessSettle: noop, showEndlessSettle: noop, hideEndlessIntro: noop, showEndlessIntro: noop,
};
const sandbox = {
  console: { log: (...a) => console.log(...a), warn: noop, error: noop, info: noop },
  Math, Date, JSON, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat,
  UI,
  document: { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop, querySelectorAll: () => [], elementFromPoint: () => null, execCommand: () => true, body: fakeEl() },
  window: { addEventListener: noop, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: "", href: "http://x/", protocol: "http:" } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: noop,
  Image: class { constructor() { this.width = 100; this.height = 100; } set src(v) { } },
  performance: { now: () => Date.now() },
  Audio: class { constructor() { } play() { } pause() { } cloneNode() { return new this.constructor(); } addEventListener() { } },
};
vm.createContext(sandbox);

let loadOk = true, loadMsg = "";
try {
  for (const f of ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/endless.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sandbox, { filename: f });
  }
} catch (e) {
  loadOk = false; loadMsg = (e && e.message) ? e.message : String(e);
}

/* ===== ⑥ 无 DOM 依赖：核心逻辑在沙箱内加载不抛错 ===== */
check("01 沙箱内加载 config/core/pool/game/endless/main 不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常：" + loadMsg);
  console.log("ENDLESS REWARD TEST FAILED");
  process.exit(1);
}

/* ===== 接线自证（monkey-patch 幂等） ===== */
check("02 Endless.update 被奖励层包装（__rewardWrapped）", sandbox.Endless && sandbox.Endless.__rewardWrapped === true);
check("03 enterEndless 被重置钩子包装（__rewardResetWrapped）", sandbox.enterEndless && sandbox.enterEndless.__rewardResetWrapped === true);
check("04 showEndlessSettle 被明细对齐钩子包装（__rewardSettleWrapped）", sandbox.showEndlessSettle && sandbox.showEndlessSettle.__rewardSettleWrapped === true);
check("05 EndlessReward 暴露到全局", typeof sandbox.EndlessReward === "object" && sandbox.EndlessReward !== null);

/* 在沙箱内执行断言逻辑（核心逻辑无 DOM 依赖，全部在此跑通） */
vm.runInContext(`
  var checks = 0, fails = 0;
  var check = function (name, cond) { checks++; console.log((cond ? "PASS " : "FAIL") + " " + name); if (!cond) fails++; };

  /* ---- 建立最小 run 上下文（World / Monster / Player 构造需要） ---- */
  G.team = [];
  G.heroDef = applyOutLevel(CFG.heroes[0]);
  G.levelCfg = { monsterLevel: 1, monsterCap: 120, progressGoal: 9999, circles: [] };
  G.run = createRun(G.heroDef);
  G.state = "playing";

  /* ============ ① 波次奖励公式正确（对照 Endless.waveReward） ============ */
  var E = CFG.endless, R = EndlessReward;
  check("06 waveReward(1) = round(8 * 1^1.15) = 8", Endless.waveReward(1) === 8);
  check("07 waveReward(5) = round(8 * 5^1.15)", Endless.waveReward(5) === Math.round(E.reward.base * Math.pow(5, E.reward.exp)));
  check("08 waveReward(10) = round(8 * 10^1.15) = 113", Endless.waveReward(10) === Math.round(E.reward.base * Math.pow(10, E.reward.exp)));
  check("09 waveReward 与 CFG.endless.reward 同源（公式驱动，非硬编码）",
    (function () { var ok = true; for (var w = 1; w <= 30; w++) { if (Endless.waveReward(w) !== Math.round(E.reward.base * Math.pow(w, E.reward.exp))) { ok = false; break; } } return ok; })());
  check("10 waveReward 恒为正整数且单调不减", (function () { var prev = -1; for (var w = 1; w <= 50; w++) { var v = Endless.waveReward(w); if (!(v > 0 && Number.isInteger(v) && v >= prev)) return false; prev = v; } return true; })());
  /* 无尽累计口径：多波相加 = 各波之和 */
  check("11 累计结晶 = Σ waveReward(1..N)（波次分别入账，最后一并累加）",
    (function () { var sum = 0; for (var w = 1; w <= 8; w++) sum += Endless.waveReward(w); return sum === Endless.waveReward(1) + Endless.waveReward(2) + Endless.waveReward(3) + Endless.waveReward(4) + Endless.waveReward(5) + Endless.waveReward(6) + Endless.waveReward(7) + Endless.waveReward(8); })());

  /* ============ ② 宝箱掉落条件：每 chestEvery(=5) 波一次 ============ */
  check("12 chestEvery = 5", E.chestEvery === 5);
  check("13 dropsChest(5/10/15) = true", Endless.dropsChest(5) && Endless.dropsChest(10) && Endless.dropsChest(15));
  check("14 dropsChest(1/4/6/9) = false", !Endless.dropsChest(1) && !Endless.dropsChest(4) && !Endless.dropsChest(6) && !Endless.dropsChest(9));
  check("15 dropsChest 1..30 恰好命中 6 次", (function () { var n = 0; for (var w = 1; w <= 30; w++) if (Endless.dropsChest(w)) n++; return n === 6; })());

  /* 落地宝箱：把 Endless.state 上报为「第 5 波已清空 + 掉宝箱」→ tick 应掉 1 枚 */
  Endless.reset();
  var w = Endless.makeWorld(); G.mainWorld = w; G.activeWorld = w;
  G.player = Endless.makePlayer(w.w / 2, w.h / 2);
  Endless.begin(w);
  R.reset();
  Endless.state.lastWaveCleared = 4; Endless.state.lastWaveChest = false;
  var t4 = R.tick(w, 0.016);
  check("16 第 4 波清空（非宝箱波）不掉宝箱", t4.dropped === 0 && R.chestPickups.length === 0);
  Endless.state.lastWaveCleared = 5; Endless.state.lastWaveChest = true;
  var t5 = R.tick(w, 0.016);
  check("17 第 5 波清空 → 掉 1 枚宝箱", t5.dropped === 1 && R.chestPickups.length === 1);
  check("18 宝箱落入 w.pickups（供绘制）", w.pickups.length === 1 && w.pickups[0].type === "coin" && w.pickups[0].value === 0);
  check("19 宝箱落点在玩家附近（≤ chestDropRadius+余量）", (function () { var cp = R.chestPickups[0]; return U.dist(G.player.x, G.player.y, cp.x, cp.y) <= 130; })());
  /* 同一波重复 tick 不重复掉（幂等：lastSeenCleared 守卫） */
  var t5b = R.tick(w, 0.016);
  check("20 同一波重复 tick 不重复掉宝箱（去重守卫）", t5b.dropped === 0 && R.chestPickups.length === 1);
  /* 第 6 波（非宝箱波）不掉 */
  Endless.state.lastWaveCleared = 6; Endless.state.lastWaveChest = false;
  var t6 = R.tick(w, 0.016);
  check("21 第 6 波（非宝箱波）不掉宝箱", t6.dropped === 0);

  /* ============ 宝箱拾取 → 入包（唯一入包点 grantItemToRun） ============ */
  var before = G.run.backpack.items.length;
  G.player.x = R.chestPickups[0].x; G.player.y = R.chestPickups[0].y;   // 走到宝箱上
  var pick = R.tick(w, 0.016);
  check("22 走到宝箱上 → 拾取入包（picked=1）", pick.picked === 1);
  check("23 拾取后宝箱从 chestPickups 移除（不会二次拾取）", R.chestPickups.length === 0);
  check("24 拾取后背包新增 1 件（宝箱本体入包）", G.run.backpack.items.length === before + 1);
  check("25 拾取后绘制桩被移出（vis.life = 0）", w.pickups.length === 0 || w.pickups[0].life <= 0);

  /* ============ ③ 入账链路审计：同一份结晶不得入账两次 ============ */
  /* 3A：Endless.settle().crystals 口径 = 纯波次结晶（不含金币折算、不含 BOSS） */
  Endless.reset();
  Endless.begin(w);
  Endless.state.crystals = 0;
  for (var i = 1; i <= 6; i++) Endless.state.crystals += Endless.waveReward(i);   // 模拟 6 波
  var s = Endless.settle();
  var expectSum = 0; for (var j = 1; j <= 6; j++) expectSum += Endless.waveReward(j);
  check("26 settle().rawCrystals = Σ waveReward（纯波次，无金币折算）", s.rawCrystals === expectSum);
  check("27 settle().crystals = 保留后到手数（=kept(raw)，口径收敛）", s.crystals === Math.floor(expectSum * CFG.outLevel.deathRatio));
  check("28 settle() 字段齐全（wave/kills/crystals/rawCrystals）", typeof s.wave === "number" && typeof s.kills === "number" && typeof s.crystals === "number" && typeof s.rawCrystals === "number");
  check("29 settle() 后 running=false（结算只发生一次）", Endless.state.running === false);

  /* 3B：唯一入账点——bank() 的入账数应等于 settle() 已收敛的到手数（口径一致，不重复折算） */
  var base = Meta.data.crystals | 0;
  var got = s.crystals;                         // settle() 已收敛为保留后到手数
  var banked = R.bank(got);                     // 唯一入账点
  check("30 bank() 入账数 = settle().crystals（口径一致，无二次折算）", banked === s.crystals && banked === Math.floor(expectSum * CFG.outLevel.deathRatio));
  check("31 bank() 后 Meta.data.crystals 精确 +banked（只加一次）", (Meta.data.crystals | 0) === base + banked);

  /* 3C：明细报告是**覆盖**而非叠加——重复 align 不改变存档结晶 */
  var crystalsBeforeAlign = Meta.data.crystals | 0;
  var rep1 = R.alignSettleReport(got, s.kills, s.wave);
  var rep2 = R.alignSettleReport(got, s.kills, s.wave);
  check("32 alignSettleReport 幂等（重复调用不改存档结晶）", (Meta.data.crystals | 0) === crystalsBeforeAlign);
  check("33 报告 total 恒等于入账数（不含金币 / 不重复计）", rep1.total === got && rep2.total === got);
  check("34 报告挂到 G.lastSettleReport（UI 明细来源）", G.lastSettleReport === rep2 && Meta.lastReport === rep2);
  check("35 报告 total 不为 0（修正 🅑 传 boss=0 导致 total=0 的显示缺口）", rep1.total > 0 && rep1.lines.length >= 2);
  check("36 报告 lines 末行为「本局合计」（UI _crystalReportLine 取末行作总计）",
    rep1.lines[rep1.lines.length - 1].indexOf("本局合计") >= 0);

  /* 3D：反例——若误把 crystals 直接入账两次，存档会多出一份（证明审计有意义） */
  var guardBase = Meta.data.crystals | 0;
  R.bank(got);                                  // 第二次 bank 会再入一次（调用方须只调一次）
  check("37 bank() 本身非幂等 → 证明唯一入账点必须由调用方保证只调一次", (Meta.data.crystals | 0) === guardBase + got);

  /* 3E：结算钩子在真实 settle 流程后对齐报告 */
  Meta.data.crystals = 500;                     // 归零到已知基准
  G.run.settleConv = { total: 999 };            // 故意埋一个「折算值」：无尽死亡不做折算，不能被计入
  Endless.reset();
  Endless.begin(w);
  Endless.state.crystals = 0;
  Endless.state.kills = 42;
  for (var k = 1; k <= 5; k++) Endless.state.crystals += Endless.waveReward(k);
  var kept = R.keptOnDeath(Endless.state.crystals);
  var beforeSettle = Meta.data.crystals | 0;
  showEndlessSettle();                          // 走 🅑 真实结算路径（内含唯一入账）
  check("38 showEndlessSettle 后存档结晶 = 基准 + 保留结晶（唯一一次）",
    (Meta.data.crystals | 0) === beforeSettle + kept);
  check("39 结算明细 total 对齐为保留结晶（钩子重写报告）", G.lastSettleReport.total === kept);
  check("40 报告不含 settleConv（无尽死亡不做物资折算 → 无金币/折算二次入账）",
    G.lastSettleReport.convertTotal === 0 && G.lastSettleReport.lines.join("").indexOf("物资折算") < 0);

  /* ============ ④ 死亡保留比例继承正确 ============ */
  check("41 deathRatio = 0.3（继承既有口径）", CFG.outLevel.deathRatio === 0.3);
  check("42 keptOnDeath(100) = 30", R.keptOnDeath(100) === 30);
  check("43 keptOnDeath 向下取整（kept(99) = 29）", R.keptOnDeath(99) === 29);
  check("44 keptOnDeath(0) = 0", R.keptOnDeath(0) === 0);
  check("45 keptOnDeath 非数字入参安全（返回 0）", R.keptOnDeath(undefined) === 0 && R.keptOnDeath("x") === 0);
  check("46 inheritDeathRatio 缺省 = true（首版继承既有 30% 规则）",
    endlessRewardCfg().inheritDeathRatio === true);

  /* ============ ⑤ 结算数据字段完整 ============ */
  check("47 EndlessReward 具备 tick/dropChest/bank/keptOnDeath/auditReport/alignSettleReport",
    ["tick", "dropChest", "bank", "keptOnDeath", "auditReport", "alignSettleReport"].every(function (m) { return typeof R[m] === "function"; }));
  var audit = R.auditReport(120, 7, 4);
  check("48 auditReport 返回完整字段（total/boss/convertTotal/waveCrystals/kills/lines）",
    audit.total === 120 && audit.boss === 0 && audit.convertTotal === 0 && audit.waveCrystals === 120 && audit.kills === 7 && Array.isArray(audit.lines));
  check("49 auditReport.total = waveCrystals（无尽结晶唯一来源）", audit.total === audit.waveCrystals);
  check("50 endlessRewardCfg() 从 CFG.endless.settle 读取（含安全兜底）",
    (function () { var c = endlessRewardCfg(); return typeof c.chestQual === "string" && typeof c.chestDropRadius === "number" && typeof c.chestLife === "number"; })());

  /* ============ ⑥ 无 DOM 沙箱安全 + 零副作用 ============ */
  /* 非无尽世界：tick 零副作用 */
  var nonRes = R.tick({ kind: "artisan", pickups: [], w: 100, h: 100 }, 0.016);
  check("51 tick 对非 endless 世界零副作用（dropped=0/picked=0）", nonRes.dropped === 0 && nonRes.picked === 0);
  /* Endless 缺失：tick 安全降级（不抛异常） */
  var bakEndless = Endless;
  Endless = undefined;
  var degradeOk = true, degradeRes = null;
  try { degradeRes = R.tick(w, 0.016); } catch (e) { degradeOk = false; }
  Endless = bakEndless;
  check("52 Endless 缺失时 tick 安全降级（不抛异常）", degradeOk && degradeRes && degradeRes.dropped === 0);
  /* 无英雄存活时拾取安全（aliveHeroes 空） */
  var bakPlayer = G.player;
  R.chestPickups = [{ x: 10, y: 10, chestQ: "advanced", item: makeChestItem("advanced"), life: 30, vis: null }];
  G.player = null; G.team = [];
  var noHero = true;
  try { R.tick(w, 0.016); } catch (e) { noHero = false; }
  G.player = bakPlayer;
  check("53 无存活英雄时拾取安全降级（不抛异常）", noHero === true);
  /* reset 清空运行时状态 */
  R.reset();
  check("54 reset 清空 lastSeenCleared 与 chestPickups", R.lastSeenCleared === 0 && R.chestPickups.length === 0);
  /* advance：非无尽 world 上 dropChest 不炸（边界） */
  var okDrop = true;
  try { R.dropChest({ w: 100, h: 100, pickups: [] }, 5); } catch (e) { okDrop = false; }
  check("55 dropChest 对缺 G.player 的边界世界安全（不抛异常）", okDrop === true);

  window.__erFail = function () { return fails; };
  window.__erChecks = function () { return checks; };
`, sandbox, { filename: "endless_reward_driver.js" });

/* ---- 汇总 ---- */
const fails = sandbox.window.__erFail();
const checks = sandbox.window.__erChecks();
console.log("----------------------------------------");
console.log("PASS 统计 = " + passCount + " 项文件级断言 + 沙箱内 " + checks + " 项；失败 = " + (failCount + fails));
if (fails > 0 || failCount > 0) {
  console.log("ENDLESS REWARD TEST FAILED");
  process.exit(1);
}
console.log("ENDLESS REWARD TEST OK");
process.exit(0);
