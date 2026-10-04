/* 20.5 低画质渲染降级 回归测试（node low_quality_test.js）
 * 覆盖：① isLowQuality() 判定优先级（__lowQuality → G.settings.lowQuality → false）
 *       ② 运行中切换即时生效（不受帧号缓存毒化）
 *       ③ 静态检查：js/game.js 确有消费 __lowQuality / isLowQuality 的调用点（数量 > 0）
 *       ④ 低画质下 spawnBurst 产出粒子数显著少于正常（沙箱实际调用对比）
 *       ⑤ 无 DOM / 无 G 沙箱下加载 js/game.js 不抛异常
 *       ⑥ 默认路径无回归：__lowQuality 未设置时粒子数/抽样与改动前语义一致
 * 桩：局部提供最小 window/document（防御式代码应当兼容，且验证沙箱健壮性）。
 * ⚠️ PASS 行文案不得出现英文 error/Error（run_tests.sh 会误判为失败）。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 极简 DOM 桩（game.js 头部仅用到很少的 DOM） ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const fakeCanvas = {
  width: 300, height: 300, style: {},
  getContext() { return ctxProxy; },
  addEventListener() { }, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
};
global.document = {
  getElementById() { return fakeCanvas; },
  createElement() { return fakeCanvas; },
  addEventListener() { }, querySelectorAll: () => [], body: fakeCanvas,
};
global.window = {
  addEventListener() { }, innerWidth: 1080, innerHeight: 1920, devicePixelRatio: 2,
};
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

/* ---- 加载脚本（同 perf_guard_test：config → core → game） ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

/* ---- 静态检查：源码确有消费低画质的调用点 ---- */
const gameSrc = fs.readFileSync(path.join(__dirname, "js/game.js"), "utf8");
let okStatic = true;
const staticCheck = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };

// 统计 isLowQuality() / __lowQuality 的实际调用点（排除定义行本身）
const callMatches = gameSrc.match(/isLowQuality\s*\(/g) || [];
const mirrorMatches = gameSrc.match(/__lowQuality/g) || [];
staticCheck("静态：js/game.js 含 isLowQuality() 调用点（>1，含定义与消费）", callMatches.length > 1);
staticCheck("静态：js/game.js 消费 window.__lowQuality 镜像", mirrorMatches.length > 0);
staticCheck("静态：js/game.js 定义 applyLowQualityDPR 入口", gameSrc.indexOf("function applyLowQualityDPR") >= 0);
staticCheck("静态：js/game.js 定义 lqParticleCount 入口", gameSrc.indexOf("function lqParticleCount") >= 0);
// 消费点计数（函数定义处也算一次），断言「降级点」明显多于 1
staticCheck("静态：降级消费点数量 > 8", callMatches.length > 8);

/* ---- 行为断言（在沙箱内驱动） ---- */
vm.runInContext(`
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__lqFail = () => fails;
  window.__lqChecks = () => checks;

  /* ============ ① 判定优先级 ============ */
  lowQualityCacheReset();
  G.time = 1;
  // 都无 → false
  delete window.__lowQuality;
  G.settings = G.settings || {};
  G.settings.lowQuality = false;
  check("① 均无低画质标志 → false", isLowQuality() === false);
  // G.settings.lowQuality = true（无 window 镜像）→ true
  lowQualityCacheReset();
  G.settings.lowQuality = true;
  check("① 仅 G.settings.lowQuality=true → true（回落生效）", isLowQuality() === true);
  // window.__lowQuality = true 优先（即使 G.settings 为 false）
  lowQualityCacheReset();
  window.__lowQuality = true;
  G.settings.lowQuality = false;
  check("① window.__lowQuality=true 优先于 G.settings=false", isLowQuality() === true);
  // 两者都为 false → false
  lowQualityCacheReset();
  window.__lowQuality = false;
  G.settings.lowQuality = false;
  check("① 两者皆 false → false", isLowQuality() === false);

  /* ============ ② 切换即时生效（不缓存毒化） ============ */
  lowQualityCacheReset();
  G.time = 7;
  window.__lowQuality = false;
  G.settings.lowQuality = false;
  const before = isLowQuality();
  window.__lowQuality = true;              // 同一帧内切换（不改 G.time）
  const afterSameFrame = isLowQuality();
  check("② 同一帧内开启 → 立即变 true（源值哨兵失效重算）", before === false && afterSameFrame === true);
  window.__lowQuality = false;             // 同一帧内关闭
  check("② 同一帧内关闭 → 立即变 false", isLowQuality() === false);
  // 帧推进后同样即时
  G.time = 8;
  window.__lowQuality = true;
  check("② 跨帧开启即时生效", isLowQuality() === true);
  lowQualityCacheReset();
  G.time = 9;
  check("② lowQualityCacheReset 后按当前源重算", isLowQuality() === true);

  /* ============ ④ spawnBurst 粒子数对比 ============ */
  // 正常：__lowQuality=false → 生成 40 颗
  lowQualityCacheReset();
  G.time = 20;
  window.__lowQuality = false;
  FX.parts.length = 0;
  spawnBurst(100, 100, "#fff", 40, 30);
  const normalCount = FX.parts.length;
  check("④ 正常画质 spawnBurst(40) → 40 颗", normalCount === 40);
  // 低画质：__lowQuality=true → 生成 < 20 颗（默认 ×0.4 = 16）
  lowQualityCacheReset();
  G.time = 21;
  window.__lowQuality = true;
  FX.parts.length = 0;
  spawnBurst(100, 100, "#fff", 40, 30);
  const lowCount = FX.parts.length;
  check("④ 低画质 spawnBurst(40) → 显著少于 20（实测 " + lowCount + "）", lowCount > 0 && lowCount < 20);
  check("④ 低画质粒子数 = 正常 ×0.4（16 颗）", lowCount === 16);
  // 至少 1 颗（避免"看起来没反应"）
  FX.parts.length = 0;
  spawnBurst(0, 0, "#fff", 1, 10);
  check("④ 低画质 spawnBurst(1) → 保底 1 颗", FX.parts.length === 1);
  // lqParticleCount 纯函数语义
  check("④ lqParticleCount(40) 低画质 = 16", lqParticleCount(40) === 16);
  check("④ lqParticleCount(10) 低画质 = 4", lqParticleCount(10) === 4);

  /* ============ ⑥ 默认路径无回归 ============ */
  lowQualityCacheReset();
  G.time = 30;
  window.__lowQuality = false;
  delete G.settings.lowQuality;   // 源缺失 = 默认
  FX.parts.length = 0;
  spawnBurst(0, 0, "#fff", 26, 40);
  check("⑥ 默认（无标志）spawnBurst(26) → 原样 26 颗（无回归）", FX.parts.length === 26);
  check("⑥ 默认 lqParticleCount(40) = 40（原样返回）", lqParticleCount(40) === 40);
  check("⑥ 默认 lqShouldDrawParticle(奇数) = true（全部绘制）", lqShouldDrawParticle(1) === true && lqShouldDrawParticle(3) === true);
  check("⑥ 默认 isLowQuality() = false", isLowQuality() === false);
  // 低画质抽样：只画 1/2
  lowQualityCacheReset();
  G.time = 31;
  window.__lowQuality = true;
  check("⑥ 低画质 lqShouldDrawParticle(0)=true、(1)=false（隔颗抽样）", lqShouldDrawParticle(0) === true && lqShouldDrawParticle(1) === false);

  /* ============ DPR 封顶（防御式） ============ */
  lowQualityCacheReset();
  G.time = 40;
  window.__lowQuality = true;
  G.W = 1000; G.H = 500;
  G.canvas = { getContext: function () { return {}; }, width: 2000, height: 1000, style: {} };
  applyLowQualityDPR();
  check("DPR 低画质：物理分辨率被钳到 1.5×（1500×750）", G.canvas.width === 1500 && G.canvas.height === 750);
  // 关闭低画质不干预
  lowQualityCacheReset();
  G.time = 41;
  window.__lowQuality = false;
  G.canvas.width = 2000; G.canvas.height = 1000;
  applyLowQualityDPR();
  check("DPR 正常画质：不干预 canvas 物理分辨率（无回归）", G.canvas.width === 2000 && G.canvas.height === 1000);
  // 无 canvas 时不抛异常（防御式）
  let dprThrew = false;
  try { G.canvas = null; lowQualityCacheReset(); G.time = 42; window.__lowQuality = true; applyLowQualityDPR(); } catch (e) { dprThrew = true; }
  check("DPR 无 canvas 时不抛异常", !dprThrew);
`, ctx, { filename: "driver" });

/* ---- ⑤ 无 DOM / 无 G 沙箱加载不抛异常 ---- */
let bareThrew = false, bareVal = null;
try {
  const bare = vm.createContext({});
  for (const f of ["js/config.js", "js/core.js", "js/game.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), bare, { filename: f });
  }
  bareVal = vm.runInContext("isLowQuality()", bare);
  vm.runInContext("lqParticleCount(40)", bare);   // 不应抛
} catch (e) { bareThrew = true; }
staticCheck("⑤ 无 DOM / 无 G 沙箱下加载 js/game.js 不抛异常", !bareThrew);
staticCheck("⑤ 裸沙箱 isLowQuality() 缺省 false（防御式）", bareVal === false);

console.log("---- 静态核对 ----");
console.log(okStatic ? "LOW QUALITY STATIC OK" : "LOW QUALITY STATIC FAILED");

const checks = ctx.window.__lqChecks();
const fails = ctx.window.__lqFail();
console.log("PASS 合计 = " + checks + "   失败数 = " + fails);
if (!okStatic || fails > 0) throw new Error("LOW QUALITY TEST FAILED");
console.log("LOW QUALITY TEST OK");
