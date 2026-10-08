/* 21.15 无尽模式（Endless）回归测试（node endless_test.js）
 * 覆盖：
 *   ① CFG.endless 完整性：所有字段存在且为数字（曲线全部来自 CFG，逻辑不硬编码）
 *   ② waveCap 三档边界：波 1 / 波 10 / 波 22+ 封顶 capMax
 *   ③ 强度曲线单调递增 + 波 1 倍率 = 1
 *   ④ 奖励公式 round(8 * wave^1.15) + 宝箱掉落条件（wave % chestEvery === 0）
 *   ⑤ 波次推进：清空 → 等 waveGap → 下一波（含首波延迟）
 *   ⑥ 刷怪位置在视野外（spawnRingMargin）
 *   ⑦ settle() 数据正确 / recordKill / reset / begin
 *   ⑧ makeWorld 走空世界分支（kind="endless"、isMain=false、无 Boss 无冻结）
 *   ⑨ 无 DOM 依赖：核心逻辑在 vm 沙箱（仅 console）内跑通
 * 判绿 = exit 0 且末行 ENDLESS TEST OK；PASS 文案严禁出现英文 error/Error/FAIL（门禁口径，坑 4）。
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

/* ===== 沙箱装载：给最小 DOM/Image 桩（game.js 顶层需要），但核心逻辑本身不读 DOM ===== */
const noop = () => { };
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  children: [], innerHTML: "", textContent: "", disabled: false, width: 300, height: 300, value: "",
  appendChild(c) { this.children.push(c); return c; }, remove: noop,
  addEventListener: noop, setAttribute: noop, getAttribute: () => null,
  getContext: () => ({}), querySelector: () => fakeEl(), querySelectorAll: () => [],
  closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
});
const sandbox = {
  console: { log: (...a) => console.log(...a), warn: noop, error: noop, info: noop },
  Math, Date, JSON, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat,
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
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/endless.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sandbox, { filename: f });
  }
} catch (e) {
  loadOk = false; loadMsg = (e && e.message) ? e.message : String(e);
}

/* ===== ⑨ 无 DOM 依赖：核心逻辑在沙箱内加载不抛错 ===== */
check("01 沙箱内加载 config/core/game/endless 不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常：" + loadMsg);
  console.log("ENDLESS TEST FAILED");
  process.exit(1);
}

/* 在沙箱内执行断言逻辑（核心逻辑无 DOM 依赖，全部在此跑通） */
vm.runInContext(`
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS " : "FAIL") + " " + name); if (!cond) fails++; };
  window.__edFail = () => fails;
  window.__edChecks = () => checks;

  /* ---- 建立最小 run 上下文（World 构造 / Monster 构造 / Player 需要） ---- */
  G.run = null;
  G.team = [];
  G.heroDef = applyOutLevel(CFG.heroes[0]);
  G.levelCfg = { monsterLevel: 1, monsterCap: 120, progressGoal: 9999, circles: [] };
  G.run = createRun(G.heroDef);
  G.state = "playing";

  /* ============ ① CFG.endless 完整性 ============ */
  const E = CFG.endless;
  check("02 CFG.endless 存在且为对象", E && typeof E === "object");
  const numFields = ["waveGap","capBase","capPerWave","capMax","hpMulPerWave","dmgMulPerWave","chestEvery","spawnRingMargin","firstWaveDelay","mapW","mapH","spawnBatch","monsterLevelBase","monsterLevelPerWave"];
  check("03 CFG.endless 全部标量字段存在且为数字", numFields.every(k => typeof E[k] === "number" && isFinite(E[k])));
  check("04 CFG.endless.reward 含 base/exp 且为数字", E.reward && typeof E.reward.base === "number" && typeof E.reward.exp === "number");
  check("05 waveGap = 3.0（波次间隔）", E.waveGap === 3.0);
  check("06 capBase=40 / capPerWave=12 / capMax=300", E.capBase === 40 && E.capPerWave === 12 && E.capMax === 300);
  check("07 hpMulPerWave=0.18 / dmgMulPerWave=0.06", E.hpMulPerWave === 0.18 && E.dmgMulPerWave === 0.06);
  check("08 reward.base=8 / exp=1.15", E.reward.base === 8 && E.reward.exp === 1.15);
  check("09 chestEvery=5 / spawnRingMargin=100 / firstWaveDelay=1.5", E.chestEvery === 5 && E.spawnRingMargin === 100 && E.firstWaveDelay === 1.5);

  /* ============ ② waveCap 三档边界 ============ */
  check("10 waveCap(1) = min(300, 40+12) = 52", Endless.waveCap(1) === 52);
  check("11 waveCap(10) = min(300, 40+120) = 160", Endless.waveCap(10) === 160);
  check("12 waveCap(22) = 40+264=304 → 封顶 300", Endless.waveCap(22) === 300);
  check("13 waveCap(30) 仍封顶 300", Endless.waveCap(30) === 300);
  check("14 waveCap 单调不减（波 1..40 全量核对）", (() => { let prev = -1; for (let w = 1; w <= 40; w++) { const c = Endless.waveCap(w); if (c < prev) return false; prev = c; } return true; })());
  check("15 waveCap 永不超过 capMax", (() => { for (let w = 1; w <= 200; w++) if (Endless.waveCap(w) > CFG.endless.capMax) return false; return true; })());

  /* ============ ③ 强度曲线单调递增 + 波 1 = 1 ============ */
  check("16 hpMul(1) = 1（基准）", Endless.hpMul(1) === 1);
  check("17 dmgMul(1) = 1（基准）", Endless.dmgMul(1) === 1);
  check("18 hpMul 严格单调递增", (() => { let prev = -1; for (let w = 1; w <= 60; w++) { const v = Endless.hpMul(w); if (v <= prev) return false; prev = v; } return true; })());
  check("19 dmgMul 严格单调递增", (() => { let prev = -1; for (let w = 1; w <= 60; w++) { const v = Endless.dmgMul(w); if (v <= prev) return false; prev = v; } return true; })());
  check("20 hpMul(10) = 1 + 9*0.18 = 2.62", Math.abs(Endless.hpMul(10) - 2.62) < 1e-9);
  check("21 dmgMul(10) = 1 + 9*0.06 = 1.54", Math.abs(Endless.dmgMul(10) - 1.54) < 1e-9);
  check("22 hpMul 增速高于 dmgMul（血量压过伤害）", Endless.hpMul(10) > Endless.dmgMul(10));
  check("23 monsterLv 单调不减且 >= 1", (() => { let prev = 0; for (let w = 1; w <= 60; w++) { const v = Endless.monsterLv(w); if (v < 1 || v < prev) return false; prev = v; } return true; })());

  /* ============ ④ 奖励公式 + 宝箱掉落 ============ */
  check("24 waveReward(1) = round(8 * 1^1.15) = 8", Endless.waveReward(1) === 8);
  check("25 waveReward(10) = round(8 * 10^1.15) = 113", Endless.waveReward(10) === Math.round(8 * Math.pow(10, 1.15)));
  check("26 waveReward 单调递增（1..50）", (() => { let prev = -1; for (let w = 1; w <= 50; w++) { const v = Endless.waveReward(w); if (v < prev) return false; prev = v; } return true; })());
  check("27 waveReward 恒为正整数", (() => { for (let w = 1; w <= 40; w++) { const v = Endless.waveReward(w); if (!(v > 0 && Number.isInteger(v))) return false; } return true; })());
  check("28 dropsChest(5/10/15) = true", Endless.dropsChest(5) && Endless.dropsChest(10) && Endless.dropsChest(15));
  check("29 dropsChest(1/3/4/6) = false", !Endless.dropsChest(1) && !Endless.dropsChest(3) && !Endless.dropsChest(4) && !Endless.dropsChest(6));
  check("30 dropsChest 每 chestEvery 波恰好一次（1..30 计数 = 6）", (() => { let n = 0; for (let w = 1; w <= 30; w++) if (Endless.dropsChest(w)) n++; return n === 6; })());

  /* ============ ⑧ makeWorld 走空世界分支 ============ */
  Endless.reset();
  const w = Endless.makeWorld(CFG.endless.mapW, CFG.endless.mapH);
  G.mainWorld = w; G.activeWorld = w;
  check("31 makeWorld 返回真实 World 实例", w instanceof World);
  check("32 世界 kind = endless", w.kind === "endless");
  check("33 世界 isMain = false（走空世界分支，坑 16）", w.isMain === false);
  check("34 空世界初始无怪无弹无 Boss", w.monsters.length === 0 && w.boss === null && w.enemyBullets.length === 0);
  check("35 无开场冻结（freezeTimer = 0）", w.freezeTimer === 0);
  check("36 makeWorld 尺寸可自定义", Endless.makeWorld(1000, 800).w === 1000 && Endless.makeWorld(1000, 800).h === 800);
  check("37 selfCheck 无问题（依赖齐备）", Endless.selfCheck().length === 0);

  /* ============ ⑤ 波次推进 ============ */
  Endless.reset();
  const w2 = Endless.makeWorld(); G.mainWorld = w2; G.activeWorld = w2;
  G.player = Endless.makePlayer(w2.w / 2, w2.h / 2);
  check("38 makePlayer 返回真实 Player 实例", G.player instanceof Player);
  check("39 reset 后 isActive 由世界 kind 判定为真", Endless.isActive() === true);
  const st = Endless.begin(w2);
  check("40 begin 返回第 1 波（wave=1）", st === 1 && Endless.state.wave === 1);
  check("41 begin 后 kills/crystals 归零", Endless.state.kills === 0 && Endless.state.crystals === 0);
  check("42 begin 后进入首波延迟窗口", Endless.state.firstWavePending === true);

  /* 首波延迟：不足 firstWaveDelay 秒不放怪 */
  Endless.update(w2, CFG.endless.firstWaveDelay - 0.1);
  check("43 首波延迟未到 → 场上仍无怪", w2.monsters.length === 0 && Endless.state.firstWavePending === true);
  /* 越过首波延迟 → 生成配额 */
  Endless.update(w2, 0.2);
  check("44 首波延迟结束 → 清空待延迟标记", Endless.state.firstWavePending === false);
  /* 持续 update 直到队列消费（分批 spawnBatch） */
  for (let i = 0; i < 40; i++) Endless.update(w2, 0.05);
  check("45 首波刷怪配额被消费（队列清空）", Endless.state.spawnQueue.length === 0);
  check("46 首波敌人已入场（monsters > 0）", w2.monsters.length > 0);
  check("47 首波敌人数量 = waveCap(1) = 52", w2.monsters.length === Endless.waveCap(1));

  /* 清空 → 等 waveGap → 下一波 */
  const c0 = Endless.state.crystals;
  w2.monsters.length = 0;                 // 模拟玩家清空本波
  Endless.update(w2, 0.016);              // 首次检测到清空 → 结算 + 起计时
  check("48 清空后本波奖励计入结晶", Endless.state.crystals === c0 + Endless.waveReward(1));
  check("49 清空后进入波间等待（waveTimer > 0，仍为第 1 波）", Endless.state.waveTimer > 0 && Endless.state.wave === 1);
  check("50 清空后马上判定：波次尚未推进", Endless.state.wave === 1);
  /* 未到 gap 不推进 */
  Endless.update(w2, CFG.endless.waveGap - 0.5);
  check("51 波间等待未满 → 波次不变", Endless.state.wave === 1);
  /* 越过 gap → 波次 +1 且生成新配额 */
  Endless.update(w2, 0.6);
  check("52 波间等待结束 → 波次推进到 2", Endless.state.wave === 2);
  check("53 第 2 波配额已生成（长度 = waveCap(2)）", Endless.state.spawnQueue.length === Endless.waveCap(2));
  check("54 世界 endlessWave 同步为 2", w2.endlessWave === 2);
  for (let i = 0; i < 40; i++) Endless.update(w2, 0.05);
  check("55 第 2 波敌人入场数量 = waveCap(2)", w2.monsters.length === Endless.waveCap(2));

  /* ============ ⑥ 刷怪位置在视野外（spawnRingMargin） ============ */
  const vh = Endless.viewHalf(w2);
  check("56 viewHalf 返回合法视野半轴（> 0）", vh.w > 0 && vh.h > 0 && vh.viewH > 0);
  // 采样 200 次：点必须恒在竞技场内、且恒在玩家视野外
  let outsideCount = 0, inBounds = 0;
  const pgx = G.player.x, pgy = G.player.y;
  for (let i = 0; i < 200; i++) {
    const sp = Endless._spawnSpot(w2);
    if (Endless.isOutsideView(sp.x, sp.y, sp.viewHalfW, sp.viewHalfH, pgx, pgy)) outsideCount++;
    if (sp.x >= 60 && sp.x <= w2.w - 60 && sp.y >= 60 && sp.y <= w2.h - 60) inBounds++;
  }
  check("57 采样点恒在竞技场边界内（200 次）", inBounds === 200);
  check("58 采样点恒在玩家视野外（200 次全部满足）", outsideCount === 200);
  check("59 spawnRingMargin 增大后仍恒在视野外（边界充分场景）", (() => {
    const orig = CFG.endless.spawnRingMargin;
    CFG.endless.spawnRingMargin = orig + 300;
    let allOut = true;
    for (let i = 0; i < 200; i++) {
      const sp = Endless._spawnSpot(w2);
      if (!Endless.isOutsideView(sp.x, sp.y, sp.viewHalfW, sp.viewHalfH, pgx, pgy)) { allOut = false; break; }
    }
    CFG.endless.spawnRingMargin = orig;
    return allOut;
  })());
  check("60 视野外点满足「至少一个轴位移 >= 对应视野半轴」", (() => {
    for (let i = 0; i < 200; i++) {
      const sp = Endless._spawnSpot(w2);
      const dx = Math.abs(sp.x - pgx), dy = Math.abs(sp.y - pgy);
      if (!(dx >= sp.viewHalfW || dy >= sp.viewHalfH)) return false;
    }
    return true;
  })());

  /* ============ ⑦ settle / recordKill / reset ============ */
  Endless.state.kills = 37;
  Endless.state.crystals = 1234;
  const rep = Endless.settle();
  check("61 settle 返回 wave/kills/crystals", rep.wave === Endless.state.wave && rep.kills === 37 && rep.crystals === 1234);
  check("62 settle 后 running 置 false", Endless.state.running === false);
  const k0 = Endless.state.kills;
  check("63 recordKill 累加击杀计数", Endless.recordKill() === k0 + 1);
  Endless.reset();
  check("64 reset 后 wave/kills/crystals 归零", Endless.state.wave === 0 && Endless.state.kills === 0 && Endless.state.crystals === 0);
  check("65 reset 后队列与计时清空", Endless.state.spawnQueue.length === 0 && Endless.state.waveTimer === 0);
  check("66 reset 后 running = false", Endless.state.running === false);

  /* ============ 接管语义 + 空世界零副作用 ============ */
  Endless.begin(w2);
  const taken = Endless.update(w2, 0.016);
  check("67 update 对 endless 世界返回 true（本帧接管）", taken === true);
  const nonEndless = Endless.update({ kind: "artisan" }, 0.016);
  check("68 update 对非 endless 世界返回 false（零接管）", nonEndless === false);
  check("69 isActive 对非 endless 世界为 false", (() => { const bak = G.activeWorld; G.activeWorld = { kind: "artisan" }; const r = Endless.isActive(); G.activeWorld = bak; return r === false; })());
  Endless.reset();
  window.__edFail = () => fails;
  window.__edChecks = () => checks;
`, sandbox, { filename: "endless_driver.js" });

/* ---- 汇总 ---- */
const fails = sandbox.window.__edFail();
const checks = sandbox.window.__edChecks();
console.log("----------------------------------------");
console.log("PASS 统计 = " + passCount + " 项文件级断言 + 沙箱内 " + checks + " 项；失败 = " + (failCount + fails));
if (fails > 0 || failCount > 0) {
  console.log("ENDLESS TEST FAILED");
  process.exit(1);
}
console.log("ENDLESS TEST OK");
