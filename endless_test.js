/* 21.17 无尽模式（Endless·大秘境式）回归测试（node endless_test.js）
 * 覆盖：
 *   ① CFG.endless 完整性：所有字段存在且为数字（曲线全部来自 CFG，逻辑不硬编码）
 *   ② waveCap 三档边界：波 1 / 波 10 / 波 22+ 封顶 capMax
 *   ③ 强度曲线单调递增 + 波 1 倍率 = 1
 *   ④ 奖励公式 round(8 * wave^1.15) + 宝箱掉落条件（wave % chestEvery === 0）
 *   ⑤ 刷怪改「时间驱动」：间隔递减公式 + 场上满员不刷但计时照走 + wave 号仍递增
 *   ⑥ 总时限：timeLeft 递减 / 归零 isTimedOut / 超时停刷
 *   ⑦ 推进量：progress = kills + elapsed*timeWeight；BOSS 阈值递增
 *   ⑧ BOSS 触发：到阈值生成 / 存活时不重复 / bossIndex 递增 / 视野外生成 / 最终 BOSS 判定
 *   ⑨ 刷怪位置在视野外（spawnRingMargin）
 *   ⑩ settle() 数据正确（含新增 timedOut/bossKills/elapsed）/ recordKill / reset / begin
 *   ⑪ makeWorld 走空世界分支（kind="endless"、isMain=false、无 Boss 无冻结）
 *   ⑫ 无 DOM 依赖：核心逻辑在 vm 沙箱（仅 console）内跑通
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
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/endless.js"]) {
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
  const numFields = ["waveGap","capMax","hpMulPerWave","atkMul","dmgMulPerWave","chestEvery","spawnRingMargin","firstWaveDelay","mapW","mapH","spawnBatch","monsterLevelBase","monsterLevelPerWave"];
  check("03 CFG.endless 全部标量字段存在且为数字", numFields.every(k => typeof E[k] === "number" && isFinite(E[k])));
  check("04 CFG.endless.reward 含 base/exp 且为数字", E.reward && typeof E.reward.base === "number" && typeof E.reward.exp === "number");
  check("05 waveGap = 3.0（退役字段保留兼容）", E.waveGap === 3.0);
  check("06 capMax=3000（同屏闸门）/ capBase=40 / capPerWave=12（退役兼容）", E.capMax === 3000 && E.capBase === 40 && E.capPerWave === 12);
  check("07 hpMulPerWave=0.18 / dmgMulPerWave=0.06（退役兼容）", E.hpMulPerWave === 0.18 && E.dmgMulPerWave === 0.06);
  check("08 reward.base=8 / exp=1.15", E.reward.base === 8 && E.reward.exp === 1.15);
  check("09 chestEvery=5 / spawnRingMargin=100 / firstWaveDelay=5.0", E.chestEvery === 5 && E.spawnRingMargin === 100 && E.firstWaveDelay === 5.0);
  /* ---- 21.17 大秘境新增字段（方案 2.2 节） ---- */
  const newFields = ["timeLimit","spawnInterval","spawnIntervalMin","spawnIntervalDecay","bossProgressBase","bossProgressStep","timeWeight","finalBossIndex","extractChannel"];
  check("09a 21.17 新字段全部存在且为数字", newFields.every(k => typeof E[k] === "number" && isFinite(E[k])));
  check("09b timeLimit = 780（13 分钟总时限）", E.timeLimit === 780);
  check("09c spawnInterval=4.0 / Min=1.5 / Decay=0.12（退役兼容）", E.spawnInterval === 4.0 && E.spawnIntervalMin === 1.5 && E.spawnIntervalDecay === 0.12);
  check("09d bossProgressBase=300 / bossProgressStep=260", E.bossProgressBase === 300 && E.bossProgressStep === 260);
  check("09e timeWeight=1.0 / finalBossIndex=3 / extractChannel=3.0", E.timeWeight === 1.0 && E.finalBossIndex === 3 && E.extractChannel === 3.0);
  /* ---- 21.17 真机重定新增字段 ---- */
  check("09f 波次间隔先快后慢：Start=4.0 / End=11.0 / Waves=99", E.spawnIntervalStart === 4.0 && E.spawnIntervalEnd === 11.0 && E.spawnIntervalWaves === 99);
  check("09g atkMul = 1.25（常量，不随波次涨）", E.atkMul === 1.25);
  check("09h waveCapAnchors 为 5 对递增锚点（波次/只数均严格递增）", (() => {
    const a = E.waveCapAnchors;
    if (!Array.isArray(a) || a.length !== 5) return false;
    let pw = -1, pn = -1;
    for (const [w, n] of a) { if (w <= pw || n < pn) return false; pw = w; pn = n; }
    return true;
  })());
  check("09i 首锚点 = [1,10] / 末锚点 = [100,300]（总波数 100）", E.waveCapAnchors[0][0] === 1 && E.waveCapAnchors[0][1] === 10
    && E.waveCapAnchors[4][0] === 100 && E.waveCapAnchors[4][1] === 300);

  /* ============ ② waveCap 分段线性插值（21.17 真机重定曲线） ============ */
  check("10 waveCap(1) = 10（首锚点）", Endless.waveCap(1) === 10);
  check("11 waveCap(50) = 100（锚点）", Endless.waveCap(50) === 100);
  check("12 waveCap(80) = 200（锚点）", Endless.waveCap(80) === 200);
  check("13 waveCap(90) = 256（锚点）", Endless.waveCap(90) === 256);
  check("13a waveCap(100) = 300（末锚点，总波数 100）", Endless.waveCap(100) === 300);
  check("13a2 waveCap(99) = 296（[90,256]→[100,300] 线性：256 + 9/10*44）", Endless.waveCap(99) === 296);
  check("13b 波 ≤1 恒 10（波 0 / 波 1）", Endless.waveCap(0) === 10 && Endless.waveCap(1) === 10);
  check("13c 波 ≥100 恒 300（波 100 / 波 200）", Endless.waveCap(100) === 300 && Endless.waveCap(200) === 300);
  /* 分段线性插值锚点核对：波 25（[1,10]→[50,100] 中点附近）≈54；波 75（[50,100]→[80,200] 之间）≈183 */
  check("13d 插值 waveCap(25) ≈ 54（用户口径）", Math.abs(Endless.waveCap(25) - 54) < 1e-9);
  check("13e 插值 waveCap(75) ≈ 183（用户口径）", Math.abs(Endless.waveCap(75) - 183) < 1e-9);
  check("14 waveCap 单调不减（波 1..120 全量核对）", (() => { let prev = -1; for (let w = 1; w <= 120; w++) { const c = Endless.waveCap(w); if (c < prev) return false; prev = c; } return true; })());
  check("15 waveCap 落在 [10,300] 且不超过末锚点（每波配额，非同屏上限）", (() => { for (let w = 0; w <= 200; w++) { const c = Endless.waveCap(w); if (c < 10 || c > 300) return false; } return true; })());
  check("15a fieldCap() = capMax = 3000（同屏闸门，与每波配额解耦）", Endless.fieldCap() === CFG.endless.capMax && Endless.fieldCap() === 3000);

  /* ============ ⑬ 怪物构成曲线（21.17 新增：小怪先多后少 → 80 后无小怪 → 90 后只有 BOSS） ============ */
  /* 字段存在性 + 与主曲线解耦 */
  check("15b 构成曲线字段齐全（eliteRatioAnchors/bossMixRatioAnchors/bossOnlyRatio/bossBudgetPerWave）",
    Array.isArray(E.eliteRatioAnchors) && Array.isArray(E.bossMixRatioAnchors)
    && typeof E.bossOnlyRatio === "number" && typeof E.bossBudgetPerWave === "number");
  check("15c 精英比例锚点 3 对递增（波次严格递增、比例非降）", (() => {
    const a = E.eliteRatioAnchors;
    if (!Array.isArray(a) || a.length !== 3) return false;
    let pw = -1, pr = -1;
    for (const [w, r] of a) { if (w <= pw || r < pr) return false; pw = w; pr = r; }
    return true;
  })());
  check("15d 精英比例端点 = 波1:0.10 / 波79:0.60（小怪比例 0.90 → 0.40，先多后少）",
    E.eliteRatioAnchors[0][0] === 1 && Math.abs(E.eliteRatioAnchors[0][1] - 0.10) < 1e-9
    && E.eliteRatioAnchors[2][0] === 79 && Math.abs(E.eliteRatioAnchors[2][1] - 0.60) < 1e-9);
  check("15e bossOnlyRatio = 1.0（90 波后只有 BOSS）", Math.abs(E.bossOnlyRatio - 1.0) < 1e-9);
  check("15f 精英池 = ED 前缀（isEliteDef 判定）", Endless._elitePool().length >= 1
    && Endless._elitePool().every(id => id.slice(0, 2) === "ED"));
  check("15g _pool() 只含普通小怪（排除 ED/BS）", Endless._pool().every(id => id.slice(0, 2) !== "ED"
    && !(CFG.monsters[id] && CFG.monsters[id].type === "boss")));
  /* 三段构成边界：无小怪起点 = 波 80；只有 BOSS 起点 = 波 90 */
  check("15h 波 79 有小怪 + 有精英 + 无 BOSS（小怪为主段末）", (() => {
    const c = Endless.waveComposition(79);
    return c.normal > 0 && c.elite > 0 && c.boss === 0;
  })());
  check("15i 波 80 起无小怪（normal=0，精英为主 + 少量 BOSS）", (() => {
    const c80 = Endless.waveComposition(80);
    return c80.normal === 0 && c80.elite > 0 && c80.boss > 0;
  })());
  check("15j 波 80~89 全程无小怪", (() => {
    for (let w = 80; w <= 89; w++) { if (Endless.waveComposition(w).normal !== 0) return false; }
    return true;
  })());
  check("15k 波 90 起只有 BOSS（normal=0 且 elite=0）", (() => {
    const c90 = Endless.waveComposition(90);
    return c90.normal === 0 && c90.elite === 0 && c90.boss === c90.cap;
  })());
  check("15l 波 90~100 全程只有 BOSS", (() => {
    for (let w = 90; w <= 100; w++) { const c = Endless.waveComposition(w); if (c.normal !== 0 || c.elite !== 0 || c.boss !== c.cap) return false; }
    return true;
  })());
  /* 小怪比例先多后少：精英占比随波次单调不降（1..79）
   * 注：断言针对**设计比例**（_mixCounts 的浮点比例），整数取整会让「四舍五入后的占比」有 ±1 只抖动，
   *     故用 count/cap 近似核对时给 1.5/cap 的取整容差（只数抖动不超过 1 只）。 */
  check("15m 波 1~79 精英占比单调不降（小怪占比单调不增）", (() => {
    let prev = -1;
    for (let w = 1; w <= 79; w++) {
      const c = Endless.waveComposition(w);
      const r = c.elite / Math.max(1, c.cap);
      if (r < prev - 1.5 / Math.max(1, c.cap)) return false;
      prev = Math.max(prev, r);
    }
    return true;
  })());
  check("15m2 波 1~79 精英**只数**单调不降（取整只增不减）", (() => {
    let prev = -1;
    for (let w = 1; w <= 79; w++) { const c = Endless.waveComposition(w); if (c.elite < prev) return false; prev = c.elite; }
    return true;
  })());
  /* 只数守恒：三类之和恒 = waveCap（用户口径「数量保持不变」） */
  check("15n 每波三类只数之和恒 = waveCap（波 1..100，数量不变）", (() => {
    for (let w = 1; w <= 100; w++) { const c = Endless.waveComposition(w); if (c.normal + c.elite + c.boss !== Endless.waveCap(w)) return false; }
    return true;
  })());
  /* _fillQueue 长度不缩水 + 90+ 波全为 BOSS 定义 */
  check("15o _fillQueue 长度恒 = waveCap（波 1..100，配额不缩水）", (() => {
    for (let w = 1; w <= 100; w++) { if (Endless._fillQueue(w).length !== Endless.waveCap(w)) return false; }
    return true;
  })());
  check("15p 波 90+ _fillQueue 全为 BOSS 定义（type==='boss'）", (() => {
    const q = Endless._fillQueue(95);
    return q.length > 0 && q.every(id => CFG.monsters[id] && CFG.monsters[id].type === "boss");
  })());
  check("15q 波 90+ BOSS 唯一实例 ≤ bossBudgetPerWave（池不足收敛，只数不减）", (() => {
    const q = Endless._fillQueue(100);
    const uniq = new Set(q);
    return uniq.size <= E.bossBudgetPerWave && q.length === Endless.waveCap(100);
  })());
  check("15r 80 波后无 BOSS 定义以外的怪（不含 ED/NM）", (() => {
    const q = Endless._fillQueue(85);
    return q.every(id => CFG.monsters[id] && CFG.monsters[id].type !== "boss" ? id.slice(0, 2) === "ED" : true);
  })());
  /* 怪种判定三档 */
  check("15s _kindOf：BS= boss / ED= elite / NM= normal", Endless._kindOf("BS0001") === "boss"
    && Endless._kindOf(Endless._elitePool()[0]) === "elite" && Endless._kindOf("NM0010") === "normal");

  /* ============ ③ 强度曲线单调递增 + 波 1 = 1 ============ */
  check("16 hpMul(1) = 1（基准）", Endless.hpMul(1) === 1);
  check("17 dmgMul(1) = atkMul = 1.25（常量基准，21.17 重定）", Endless.dmgMul(1) === 1.25);
  check("18 hpMul 严格单调递增", (() => { let prev = -1; for (let w = 1; w <= 60; w++) { const v = Endless.hpMul(w); if (v <= prev) return false; prev = v; } return true; })());
  check("19 dmgMul 恒定（不随波次增长，难度交给只数曲线）", (() => { for (let w = 1; w <= 60; w++) if (Endless.dmgMul(w) !== 1.25) return false; return true; })());
  check("20 hpMul(10) = 1 + 9*0.18 = 2.62", Math.abs(Endless.hpMul(10) - 2.62) < 1e-9);
  check("21 dmgMul(10) = 1.25（与波 1 相同，恒等）", Math.abs(Endless.dmgMul(10) - 1.25) < 1e-9);
  check("22 高波次 hpMul 压过 dmgMul（攻击不再涨，靠血量成长）", Endless.hpMul(10) > Endless.dmgMul(10));
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

  /* ============ ⑤ 时间驱动刷怪（21.17 核心改动） ============ */
  Endless.reset();
  const w2 = Endless.makeWorld(); G.mainWorld = w2; G.activeWorld = w2;
  G.player = Endless.makePlayer(w2.w / 2, w2.h / 2);
  check("38 makePlayer 返回真实 Player 实例", G.player instanceof Player);
  check("39 reset 后 isActive 由世界 kind 判定为真", Endless.isActive() === true);
  const st = Endless.begin(w2);
  check("40 begin 返回第 1 波（wave=1）", st === 1 && Endless.state.wave === 1);
  check("41 begin 后 kills/crystals 归零", Endless.state.kills === 0 && Endless.state.crystals === 0);
  check("42 begin 后进入首波延迟窗口", Endless.state.firstWavePending === true);

  /* ---- 间隔先快后慢线性插值：4.0s（波1）→ 11.0s（波99） ---- */
  check("43 spawnIntervalFor(1) = 4.0（起点）", Math.abs(Endless.spawnIntervalFor(1) - 4.0) < 1e-9);
  check("44 spawnIntervalFor(0) = 4.0（波 ≤1 取起点）", Math.abs(Endless.spawnIntervalFor(0) - 4.0) < 1e-9);
  check("45 spawnIntervalFor 随波次单调递增（1..99，先快后慢）", (() => { let prev = -Infinity; for (let w = 1; w <= 99; w++) { const v = Endless.spawnIntervalFor(w); if (v < prev - 1e-9) return false; prev = v; } return true; })());
  check("46 spawnIntervalFor 落在 [4.0, 11.0] 区间内", (() => { for (let w = 0; w <= 200; w++) { const v = Endless.spawnIntervalFor(w); if (v < 4.0 - 1e-9 || v > 11.0 + 1e-9) return false; } return true; })());
  check("47 端点：spawnIntervalFor(99) = 11.0 / (100) = 11.0（封顶）", Math.abs(Endless.spawnIntervalFor(99) - 11.0) < 1e-9 && Math.abs(Endless.spawnIntervalFor(100) - 11.0) < 1e-9);
  check("47a 中点：spawnIntervalFor(50) = 4.0 + (49/98)*7 = 7.5", Math.abs(Endless.spawnIntervalFor(50) - 7.5) < 1e-9);

  /* 首波延迟：不足 firstWaveDelay 秒不放怪 */
  Endless.update(w2, CFG.endless.firstWaveDelay - 0.1);
  check("48 首波延迟未到 → 场上仍无怪", w2.monsters.length === 0 && Endless.state.firstWavePending === true);
  /* 越过首波延迟 → 生成配额 + 起刷怪计时 */
  Endless.update(w2, 0.2);
  check("49 首波延迟结束 → 清空待延迟标记", Endless.state.firstWavePending === false);
  check("50 首波到点即刷 → 队列按 waveCap(1) 生成", Endless.state.spawnQueue.length + w2.monsters.length === Endless.waveCap(1));
  /* 持续 update 直到队列消费（分批 spawnBatch） */
  for (let i = 0; i < 40; i++) Endless.update(w2, 0.05);
  check("51 首波刷怪配额被消费（队列清空）", Endless.state.spawnQueue.length === 0);
  check("52 首波敌人数量 = waveCap(1) = 10", w2.monsters.length === Endless.waveCap(1) && Endless.waveCap(1) === 10);

  /* ---- 时间驱动核心：不清场，时间到也推进下一波 ---- */
  const monstersBefore = w2.monsters.length;   // 场上满员（10 = waveCap(1)）
  const waveBefore = Endless.state.wave;
  Endless.update(w2, Endless.spawnIntervalFor(waveBefore) + 0.01);   // 跨过一个刷新间隔
  check("53 场上未清空，时间到仍推进波次（wave+1）", Endless.state.wave === waveBefore + 1);
  check("54 时间驱动：场上怪物数量未被清零（不看剩余）", w2.monsters.length >= monstersBefore);
  check("55 世界 endlessWave 与波次同步", w2.endlessWave === Endless.state.wave);

  /* ---- 场上达**同屏上限闸门**（≥ capMax=3000）→ 本波不刷，但计时照走 ---- */
  const waveAtCap = Endless.state.wave;
  const gate = Endless.fieldCap();                  // 同屏闸门 = capMax = 3000
  const poolIdsSeed = Endless._pool()[0];
  check("55a 同屏闸门 fieldCap() = 3000（远大于每波配额）", gate === 3000);
  /* 用「钉 length」把一个轻量对象数组填到闸门（避免真造 3000 个真实怪的开销；
   * 本段只验证 _spawnWave 的场满早退逻辑，不消费队列，故空壳对象足矣） */
  const fill = [];
  for (let i = 0; i < gate; i++) fill.push({ x: 0, y: 0, dead: false, d: poolIdsSeed });
  w2.monsters.length = 0;
  Array.prototype.push.apply(w2.monsters, fill);    // 场上 = gate
  Endless.state.spawnQueue = [];                    // 清空上一波残留队列
  const beforeCount = w2.monsters.length;
  Endless.update(w2, Endless.spawnIntervalFor(waveAtCap) + 0.01);   // 跨间隔
  check("56 场满（≥同屏闸门 3000）→ 本波不刷（spawnQueue 为空）", Endless.state.spawnQueue.length === 0);
  check("57 场满不刷但计时照走 → 波次仍推进", Endless.state.wave === waveAtCap + 1);
  check("58 场满不刷但计时照走 → waveTimer 被重置为正（下波倒计时）", Endless.state.waveTimer > 0);
  check("58a 场满时不刷怪（场上数量不因本波增加）", w2.monsters.length <= Math.max(beforeCount, gate));
  check("58b 每波配额 waveCap 远小于同屏闸门（配额 ≠ 闸门）", Endless.waveCap(waveAtCap) <= 300 && gate === 3000);

  /* ============ ⑥ 总时限（21.17 新增） ============ */
  Endless.reset();
  Endless.begin(w2);
  Endless.state.firstWavePending = false;        // 跳过首波延迟，直接测时限
  check("59 begin 后 timeLeft = timeLimit（10 分钟满）", Math.abs(Endless.state.timeLeft - CFG.endless.timeLimit) < 1e-9);
  check("60 未超时时 isTimedOut() = false", Endless.isTimedOut() === false);
  Endless.update(w2, 10);                        // 推进 10 秒
  check("61 每帧递减：timeLeft 减少 ≈ 10s", Math.abs(Endless.timeLeft() - (CFG.endless.timeLimit - 10)) < 1e-6);
  check("62 timeLeft() 与 timeLimit 之差 = 已流逝时间", Math.abs((CFG.endless.timeLimit - Endless.timeLeft()) - Endless.state.elapsed) < 1e-6);
  Endless.state.timeLeft = 0.5;                  // 逼近归零
  Endless.update(w2, 1.0);                       // 越过归零
  check("63 归零后 isTimedOut() = true", Endless.isTimedOut() === true);
  check("64 timeLeft() 夹到 0（不为负）", Endless.timeLeft() === 0);
  /* 超时后停刷：推进很长时间，wave 不再增长 */
  const waveAtTimeout = Endless.state.wave;
  for (let i = 0; i < 100; i++) Endless.update(w2, 1.0);
  check("65 超时后停止刷怪（wave 不再增长）", Endless.state.wave === waveAtTimeout);
  check("66 超时不自动生成新 BOSS", Endless.bossIndex() === 0);

  /* ============ ⑦ 推进量 + BOSS 触发（21.17 新增） ============ */
  Endless.reset();
  const w3 = Endless.makeWorld(); G.mainWorld = w3; G.activeWorld = w3;
  G.player = Endless.makePlayer(w3.w / 2, w3.h / 2);
  Endless.begin(w3);
  Endless.state.firstWavePending = false;
  /* 阈值递增：base + n*step */
  check("67 bossThreshold(0) = 300（首个 BOSS）", Endless.bossThreshold(0) === 300);
  check("68 bossThreshold(1) = 560（+260）", Endless.bossThreshold(1) === 560);
  check("69 bossThreshold(2) = 820", Endless.bossThreshold(2) === 820);
  check("70 bossThreshold 随 n 严格递增", (() => { let prev = -1; for (let n = 0; n <= 10; n++) { const v = Endless.bossThreshold(n); if (v <= prev) return false; prev = v; } return true; })());
  /* progress = kills + elapsed*timeWeight */
  Endless.state.kills = 100; Endless.state.elapsed = 50;
  check("71 progress = kills + elapsed*weight = 100 + 50*1 = 150", Math.abs(Endless.progress() - 150) < 1e-9);
  check("72 timeWeight=1：kills 与 elapsed 同权", Math.abs(Endless.progress() - (Endless.state.kills + Endless.state.elapsed * CFG.endless.timeWeight)) < 1e-9);

  /* BOSS 生成：到阈值 → bossIndex +1 */
  check("73 初始 bossIndex() = 0", Endless.bossIndex() === 0);
  Endless.state.kills = 305;                     // progress 越过 300
  Endless.update(w3, 0.05);
  check("74 推进量到阈值 → 生成第 1 个 BOSS", Endless.bossIndex() === 1);
  check("75 BOSS 已入场（场上有 boss 类型怪）", w3.monsters.some(m => m.d && m.d.type === "boss"));
  check("76 BOSS 标记 endlessBoss = true", w3.monsters.some(m => m.endlessBoss === true));
  /* BOSS 从 boss 池抽取 */
  const bossM1 = w3.monsters.filter(m => m.d && m.d.type === "boss")[0];
  check("77 BOSS 定义来自 CFG.monsters 的 boss 池", Endless._bossPool().indexOf(bossM1.defId) >= 0);
  /* 视野外生成 */
  check("78 BOSS 生成位置在玩家视野外", (() => {
    const vh = Endless.viewHalf(w3);
    return Endless.isOutsideView(bossM1.x, bossM1.y, vh.w, vh.h, G.player.x, G.player.y);
  })());

  /* 存活时不重复：再抬推进量，bossIndex 不变 */
  Endless.state.kills = 2000;
  Endless.update(w3, 0.05);
  check("79 BOSS 存活期间不重复触发（bossIndex 仍 = 1）", Endless.bossIndex() === 1);
  check("80 存活时 bossActive ≥ 1（存活探测）", Endless.state.bossActive >= 1);

  /* 击杀第 1 个 BOSS（就地移除）→ 阈值 560 已达 → 生成第 2 个 */
  const boss1 = w3.monsters.filter(m => m.d && m.d.type === "boss")[0];
  Endless.recordKill(boss1);
  w3.monsters.splice(w3.monsters.indexOf(boss1), 1);
  Endless.update(w3, 0.05);
  check("81 清掉第 1 个 BOSS 后 → bossIndex 递增到 2", Endless.bossIndex() === 2);
  check("82 第 2 个 BOSS 不是最终 BOSS（finalBossIndex=3）", Endless.isFinalBossSpawned() === false);
  check("83 非最终 BOSS 击杀不改 finalBossDefeated", Endless.isFinalBossDefeated() === false);

  /* 击杀第 2 个 → 第 3 个 = 最终 BOSS */
  const boss2 = w3.monsters.filter(m => m.d && m.d.type === "boss")[0];
  w3.monsters.splice(w3.monsters.indexOf(boss2), 1);
  Endless.update(w3, 0.05);
  check("84 生成第 3 个 BOSS = 最终 BOSS（finalBossIndex=3）", Endless.bossIndex() === 3 && Endless.isFinalBossSpawned() === true);
  const finalBoss = w3.monsters.filter(m => m.d && m.d.type === "boss")[0];
  check("85 最终 BOSS 带 endlessFinalBoss 标记（供撤离点判定）", finalBoss && finalBoss.endlessFinalBoss === true);
  /* 击杀最终 BOSS → finalBossDefeated = true */
  Endless.recordKill(finalBoss);
  w3.monsters.splice(w3.monsters.indexOf(finalBoss), 1);
  Endless.update(w3, 0.05);
  check("86 击杀最终 BOSS → finalBossDefeated = true", Endless.isFinalBossDefeated() === true);
  check("87 最终 BOSS 后不再生成新 BOSS（bossIndex 停 = 3）", Endless.bossIndex() === 3);

  /* ============ ⑨ 刷怪位置在视野外（spawnRingMargin） ============ */
  const vh = Endless.viewHalf(w3);
  check("88 viewHalf 返回合法视野半轴（> 0）", vh.w > 0 && vh.h > 0 && vh.viewH > 0);
  // 采样 200 次：点必须恒在竞技场内、且恒在玩家视野外
  let outsideCount = 0, inBounds = 0;
  const pgx = G.player.x, pgy = G.player.y;
  for (let i = 0; i < 200; i++) {
    const sp = Endless._spawnSpot(w3);
    if (Endless.isOutsideView(sp.x, sp.y, sp.viewHalfW, sp.viewHalfH, pgx, pgy)) outsideCount++;
    if (sp.x >= 60 && sp.x <= w3.w - 60 && sp.y >= 60 && sp.y <= w3.h - 60) inBounds++;
  }
  check("89 采样点恒在竞技场边界内（200 次）", inBounds === 200);
  check("90 采样点恒在玩家视野外（200 次全部满足）", outsideCount === 200);
  check("91 spawnRingMargin 增大后仍恒在视野外（边界充分场景）", (() => {
    const orig = CFG.endless.spawnRingMargin;
    CFG.endless.spawnRingMargin = orig + 300;
    let allOut = true;
    for (let i = 0; i < 200; i++) {
      const sp = Endless._spawnSpot(w3);
      if (!Endless.isOutsideView(sp.x, sp.y, sp.viewHalfW, sp.viewHalfH, pgx, pgy)) { allOut = false; break; }
    }
    CFG.endless.spawnRingMargin = orig;
    return allOut;
  })());
  check("92 视野外点满足「至少一个轴位移 >= 对应视野半轴」", (() => {
    for (let i = 0; i < 200; i++) {
      const sp = Endless._spawnSpot(w3);
      const dx = Math.abs(sp.x - pgx), dy = Math.abs(sp.y - pgy);
      if (!(dx >= sp.viewHalfW || dy >= sp.viewHalfH)) return false;
    }
    return true;
  })());

  /* ============ ⑩ settle / recordKill / reset ============ */
  Endless.state.kills = 37;
  Endless.state.crystals = 1234;
  Endless.state.elapsed = 88;
  Endless.state.bossIndex = 2;
  Endless.state.timedOut = true;
  const rep = Endless.settle();
  check("93 settle 返回 wave/kills/crystals", rep.wave === Endless.state.wave && rep.kills === 37 && rep.crystals === 1234);
  check("94 settle 新增 timedOut 字段（超时口径）", rep.timedOut === true);
  check("95 settle 新增 bossKills 字段 = 已生成 BOSS 数", rep.bossKills === 2);
  check("96 settle 新增 elapsed 字段 = 已用时（秒）", rep.elapsed === 88);
  check("97 settle 后 running 置 false", Endless.state.running === false);
  Endless.reset();
  /* settle 默认口径：未超时 / 无 BOSS / elapsed 归零 */
  Endless.begin(w2); Endless.state.firstWavePending = false;
  const rep2 = Endless.settle();
  check("98 未超时时 settle().timedOut = false", rep2.timedOut === false);
  check("99 未生成 BOSS 时 settle().bossKills = 0", rep2.bossKills === 0);
  check("100 刚 begin 时 settle().elapsed = 0", rep2.elapsed === 0);
  Endless.state.kills = 37;
  check("101 recordKill 累加击杀计数", Endless.recordKill() === 38);
  Endless.reset();
  check("102 reset 后 wave/kills/crystals 归零", Endless.state.wave === 0 && Endless.state.kills === 0 && Endless.state.crystals === 0);
  check("103 reset 后队列与计时清空", Endless.state.spawnQueue.length === 0 && Endless.state.waveTimer === 0);
  check("104 reset 后 running = false", Endless.state.running === false);
  check("105 reset 清理 21.17 新状态（timeLeft/elapsed/bossIndex/timedOut）",
    Endless.state.timeLeft === 0 && Endless.state.elapsed === 0 && Endless.state.bossIndex === 0 && Endless.state.timedOut === false);
  check("106 reset 清理 BOSS 标记（bossAlive/finalBossSpawned/finalBossDefeated）",
    Endless.state.bossAlive === false && Endless.state.finalBossSpawned === false && Endless.state.finalBossDefeated === false);

  /* ============ ⑫ 接管语义 + 空世界零副作用 ============ */
  Endless.begin(w2);
  const taken = Endless.update(w2, 0.016);
  check("107 update 对 endless 世界返回 true（本帧接管）", taken === true);
  const nonEndless = Endless.update({ kind: "artisan" }, 0.016);
  check("108 update 对非 endless 世界返回 false（零接管）", nonEndless === false);
  check("109 isActive 对非 endless 世界为 false", (() => { const bak = G.activeWorld; G.activeWorld = { kind: "artisan" }; const r = Endless.isActive(); G.activeWorld = bak; return r === false; })());

  /* ============ 兼容性：take 语义 / 对外接口齐全 ============ */
  check("110 对外接口齐全（旧 11 个 + 新 6 个）", (() => {
    const oldApi = ["isActive","makeWorld","begin","update","reset","waveCap","hpMul","dmgMul","waveReward","dropsChest","recordKill","settle"];
    const newApi = ["timeLeft","isTimedOut","progress","bossIndex","isFinalBossSpawned","isFinalBossDefeated"];
    return oldApi.every(k => typeof Endless[k] === "function") && newApi.every(k => typeof Endless[k] === "function");
  })());
  check("111 finalBossDefeated 状态字段存在（供 🅑 掉撤离点）", typeof Endless.state.finalBossDefeated === "boolean");
  check("112 非 endless 世界 update 不推进时也不改时限（零副作用）", (() => {
    const t = Endless.state.timeLeft;
    Endless.update({ kind: "rift" }, 5);
    return Endless.state.timeLeft === t;
  })());
  /* ============ ⑭ monsterCap 深渊短路（真机回归：深渊被主线 cap 误卡在 120） ============ */
  (function () {
    const bakCfg = G.levelCfg, bakIn = G.inEndless, bakRun = G.run;
    /* 模拟「enterEndless 还原了上一个主关卡配置」的现场（monsterCap: 120） */
    G.levelCfg = { monsterLevel: 1, monsterCap: 120, progressGoal: 9999 };
    G.inEndless = false;
    check("113 非深渊：monsterCap 取关卡表值（120）", monsterCap() === 120);
    G.inEndless = true;
    check("114 深渊：monsterCap 短路到 CFG.endless.capMax（" + CFG.endless.capMax + "）", monsterCap() === CFG.endless.capMax);
    /* 深渊世界真造怪：越过主线上限 120 仍能生成（旧代码在 120 处直接 return null） */
    G.run = G.run || { kills: 0 };
    const w3 = Endless.makeWorld(1920, 1920);
    let made = 0;
    for (let i = 0; i < 200; i++) {
      if (w3.spawnMonster("NM0010", 100 + (i % 40) * 5, 100 + Math.floor(i / 40) * 5)) made++;
    }
    check("115 深渊世界同屏可越过主线上限 120（实际生成 " + made + " 只）", made > 120);
    G.levelCfg = bakCfg; G.inEndless = bakIn; G.run = bakRun;
  })();

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
