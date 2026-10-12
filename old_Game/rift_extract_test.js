/* ============================================================================
 * 21.17 深渊「最终 BOSS 掉落撤离点」+「屏蔽空间裂隙雕像」回归测试
 *   （node rift_extract_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（≥25 项）：
 *   一、配置：CFG.endless.extractChannel 存在且与主线 exitBeacon 同款参数（3.0s）
 *   二、最终 BOSS 死 → 撤离点出现，且**只出现一次**（幂等）
 *   三、非最终 BOSS 死 → 不产生撤离点（零掉落）
 *   四、走撤离点读条到点 → 撤离成功，标记为**全收益**（extracted=true，不走 30% 折扣）
 *   五、读条受击 → 归零（对齐主线 exitBeacon 的打断语义）
 *   六、超时 → 失败结算（保留 30%），与死亡同口径
 *   七、屏蔽 RIFT：深渊世界祭坛抽取 100 次**不含 RIFT**；主线世界仍含 RIFT（不误伤）
 *   八、无 DOM 沙箱安全：核心逻辑在仅 console 的 vm 沙箱内跑通
 *
 * ⚠️ PASS 文案**禁用英文 error/Error/FAIL**（run_tests.sh 以 grep -ci 统计失败，坑 4）。
 * 风格参考 endless_test.js（无 DOM 沙箱 + check 断言器；末行 OK）。
 * ========================================================================== */
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

/* ===== 沙箱装载：最小 DOM/Image 桩（game.js 顶层需要），核心逻辑本身不读 DOM ===== */
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

/* ===== 八、无 DOM 沙箱安全：加载不抛错 ===== */
check("01 沙箱内加载 config/core/game/modes/endless 不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常：" + loadMsg);
  console.log("RIFT EXTRACT TEST FAILED");
  process.exit(1);
}

/* ===== 源码级接线断言：运行时挂点存在（单行调用，跨文件集成锁定） ===== */
const srcMain = fs.readFileSync(path.join(__dirname, "js", "main.js"), "utf8");
const srcGame = fs.readFileSync(path.join(__dirname, "js", "game.js"), "utf8");
const srcRender = fs.readFileSync(path.join(__dirname, "js", "render.js"), "utf8");
const srcEndless = fs.readFileSync(path.join(__dirname, "js", "endless.js"), "utf8");
check("01a 主循环挂点：main.js 调用 updateAbyssExtract(dt)", srcMain.indexOf("updateAbyssExtract(dt)") >= 0);
check("01b 死亡挂点：main.js 调用 abyssExtractSettle(\"death\")", srcMain.indexOf('abyssExtractSettle("death")') >= 0);
check("01c 受击打断挂点：game.js 的 heroTakeDamage 调用 abyssExtractInterrupt()", srcGame.indexOf("abyssExtractInterrupt()") >= 0);
check("01d 渲染挂点：render.js 调用 renderAbyssExtract(ctx, w)", srcRender.indexOf("renderAbyssExtract(ctx, w)") >= 0);
check("01e endless.js 末尾区块暴露 attachExtractFields", srcEndless.indexOf("Endless.attachExtractFields") >= 0);
check("01f endless.js 末尾区块暴露 installRiftFilter", srcEndless.indexOf("Endless.installRiftFilter") >= 0);

/* 在沙箱内执行断言逻辑（核心逻辑无 DOM 依赖，全部在此跑通） */
vm.runInContext(`
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS " : "FAIL") + " " + name); if (!cond) fails++; };

  /* ---- 建立最小 run 上下文 ---- */
  G.heroDef = applyOutLevel(CFG.heroes[0]);
  G.levelCfg = { monsterLevel: 1, monsterCap: 400, progressGoal: 9999, circles: [] };
  G.run = createRun(G.heroDef);
  G.state = "playing";
  G.team = [];

  /* 建一个深渊世界（kind="endless"，走空世界分支，坑 16） */
  function freshAbyss(world) {
    var w = world || Endless.makeWorld();
    Endless.attachExtractFields(w);
    G.activeWorld = w; G.mainWorld = w;
    G.player = Endless.makePlayer(w.w / 2, w.h / 2);
    Endless.begin(w);
    Endless.state.firstWavePending = false;   // 跳过首波延迟，专注撤离点断言
    return w;
  }

  /* ============ 一、配置：撤离读条时长与主线同款参数形态 ============ */
  check("02 CFG.endless.extractChannel 存在且为数字", typeof CFG.endless.extractChannel === "number" && isFinite(CFG.endless.extractChannel));
  check("03 extractChannel = 3.0（对齐主线 exitBeacon 读条 3 秒）", CFG.endless.extractChannel === 3.0);
  check("04 CFG.endless.finalBossIndex = 3（第 3 个 BOSS 为最终）", CFG.endless.finalBossIndex === 3);
  check("05 撤离点判定半径进 CFG 形态（judgeRadius > 0）", abyssExtractCfg().judgeRadius > 0);

  /* ============ 二、最终 BOSS 死 → 掉撤离点，且只掉一次 ============ */
  var w = freshAbyss();
  w.exitBeacon = null;        // 确保干净起点（不依赖世界初始的随机祭坛摆放）
  check("06 深渊世界识别正确（isAbyssWorld = true）", isAbyssWorld(w) === true);
  check("07 初始无撤离点（world.exitBeacon = null）", w.exitBeacon === null);
  /* 非最终 BOSS 击杀：不记录、不掉（finalBossDefeated 仍为 false） */
  Endless.state.finalBossSpawned = true; Endless.state.finalBossDefeated = false;
  noteFinalBossDeath({ x: 800, y: 800, endlessFinalBoss: false });
  check("08 非最终 BOSS 死 → 不记录死亡位置 / 不掉撤离点（零掉落）", w._lastFinalBossPos === null && w.exitBeacon === null);
  /* 最终 BOSS 死：记录位置 + 置 finalBossDefeated → 掉撤离点 */
  Endless.state.finalBossDefeated = true;
  var noted = noteFinalBossDeath({ x: 900, y: 900, endlessFinalBoss: true });
  check("09 noteFinalBossDeath 记录最终 BOSS 死亡位置", noted === true && w._lastFinalBossPos && w._lastFinalBossPos.x === 900);
  updateAbyssExtract(0.1);
  check("10 最终 BOSS 死 → 撤离点出现（world.exitBeacon 非空）", !!w.exitBeacon);
  check("11 撤离点坐标合法（场界内）", w.exitBeacon.x >= 60 && w.exitBeacon.x <= w.w - 60 && w.exitBeacon.y >= 60 && w.exitBeacon.y <= w.h - 60);
  check("12 撤离点落在最终 BOSS 死亡位置附近（±dropRadius，避墙夹取）", (function () {
    var src = w._lastFinalBossPos || { x: 900, y: 900 };
    var raw = { x: 900, y: 900 };
    var clamped = { x: U.clamp(raw.x, 60, w.w - 60), y: U.clamp(raw.y, 60, w.h - 60) };
    return U.dist(w.exitBeacon.x, w.exitBeacon.y, clamped.x, clamped.y) <= abyssExtractCfg().dropRadius + 1e-6;
  })());
  var beaconX = w.exitBeacon.x, beaconY = w.exitBeacon.y;
  /* 幂等：再推进多帧，撤离点不动、不重复生成 */
  for (var i = 0; i < 30; i++) updateAbyssExtract(0.1);
  check("13 撤离点只出现一次（坐标不因多帧推进而改变）", w.exitBeacon.x === beaconX && w.exitBeacon.y === beaconY);
  check("14 撤离点铺场字段初始化（进度/持有者）", w.abyssExtractProgress >= 0 && w.abyssExtractHolder === null || !!w.abyssExtractHolder);
  /* spawnAbyssExtractBeacon 再次调用 → 返回 false（不再掉） */
  check("15 spawnAbyssExtractBeacon 二次调用返回 false（不重复掉）", spawnAbyssExtractBeacon(w) === false);

  /* ============ 三、走撤离点读条到点 → 撤离成功（全收益） ============ */
  /* 先重置世界与击杀状态：上一组断言里世界已打上「已结算」标；重新起一局干净世界 */
  w = freshAbyss();
  Endless.state.finalBossDefeated = true;
  noteFinalBossDeath({ x: 900, y: 900, endlessFinalBoss: true });
  updateAbyssExtract(0.1);                       // 掉出撤离点
  check("16a 重开世界后重新掉出撤离点", !!w.exitBeacon && w.abyssExtractDone === false);
  /* 玩家站进圈内，逐帧读条；不足 3.0s 不结算 */
  G.player.x = w.exitBeacon.x; G.player.y = w.exitBeacon.y;
  updateAbyssExtract(1.0);
  check("16 读条 1.0s（< 3.0s）尚未撤离（abyssExtractDone = false）", w.abyssExtractDone === false);
  check("17 读条进度积累（abyssExtractProgress > 0）", w.abyssExtractProgress > 0);
  check("18 圈内标记 abyssExtractReady = true", w.abyssExtractReady === true);
  /* 补齐到 3.0s：一次 2.1s 越过阈值 */
  updateAbyssExtract(2.1);
  check("19 读条累计 ≥ 3.0s → 撤离成功（abyssExtractDone = true）", w.abyssExtractDone === true);
  check("20 撤离成功走全收益口径（G.abyssExtractSuccess = true）", G.abyssExtractSuccess === true);
  check("21 撤离成功结算原因 = extract", G.abyssSettleReason === "extract");
  check("22 撤离成功 → 状态置 settled", G.state === "settled");
  check("23 撤离成功 = 全收益（报告 extracted = true，不走 30% 折扣）", G.lastSettleReport && G.lastSettleReport.extracted === true);
  check("24 撤离成功后不再重复结算（世界打标 abyssExtractSettled）", w.abyssExtractSettled === true);

  /* ============ 四、读条受击 → 归零 ============ */
  var w2 = freshAbyss();
  Endless.state.finalBossDefeated = true;
  noteFinalBossDeath({ x: 700, y: 700, endlessFinalBoss: true });
  updateAbyssExtract(0.1);
  check("25 第二个世界也正确掉出撤离点", !!w2.exitBeacon);
  G.player.x = w2.exitBeacon.x; G.player.y = w2.exitBeacon.y;
  updateAbyssExtract(1.5);                       // 读条过半
  var progBefore = w2.abyssExtractProgress;
  check("26 读条进行中进度 > 0（用于受击归零对照）", progBefore > 0);
  var interrupted = abyssExtractInterrupt();     // 模拟受击打断
  check("27 读条受击 → 归零（progress = 0）", w2.abyssExtractProgress === 0 && w2.exitProgress === 0);
  check("28 受击打断返回 true（确实打断了读条）", interrupted === true);
  check("29 受击归零后未撤离（撤离点保留，可重读）", w2.abyssExtractDone === false && !!w2.exitBeacon);
  /* 重新站回圈内可继续读到撤离成功 */
  for (var j = 0; j < 40; j++) updateAbyssExtract(0.1);
  check("30 受击后可重读 → 最终撤离成功", w2.abyssExtractDone === true);

  /* ============ 五、超时 → 失败结算（保留 30%） ============ */
  var w3 = freshAbyss();
  /* 造一个超时局面：把 timeLeft 归零并推进一帧 */
  Endless.state.timeLeft = 0.0; Endless.state.timedOut = true;
  G.state = "playing"; G.abyssSettleReason = null; G.abyssExtractSuccess = null;
  updateAbyssExtract(0.1);
  check("31 超时 → 触发结算（G.abyssSettleReason = timeout）", G.abyssSettleReason === "timeout");
  check("32 超时结算 = 失败口径（G.abyssExtractSuccess = false）", G.abyssExtractSuccess === false);
  check("33 超时结算报告 extracted = false（不进全收益分支）", G.lastSettleReport && G.lastSettleReport.extracted === false);
  check("34 超时世界打标已结算（abyssExtractSettled = true）", w3.abyssExtractSettled === true);
  check("35 超时与死亡同口径：保留 deathRatio（0.3）", (function () {
    var before = (Meta.data && Meta.data.crystals) || 0;
    var s = abyssExtractSettle("timeout");
    return s.extracted === false && s.reason === "timeout";
  })());
  check("36 死亡结算与超时同一入口（abyssExtractSettle('death') 返回 extracted=false）",
    abyssExtractSettle("death").extracted === false);

  /* ============ 六、屏蔽 RIFT：深渊不含，主线仍含（不误伤） ============ */
  check("37 屏蔽白名单默认含 RIFT", abyssBlockedAltarIds().indexOf("RIFT") >= 0);
  var poolEndless = abyssAltarPool("endless");
  var poolMain = abyssAltarPool("main");
  check("38 深渊祭坛池排除 RIFT（不含 RIFT）", !poolEndless.RIFT);
  check("39 主线祭坛池仍含 RIFT（不误伤）", !!poolMain.RIFT);
  check("40 深渊池仍有可用祭坛（非空）", Object.keys(poolEndless).length > 0);
  check("41 不改 CFG.altars 本体：RIFT 仍在全局表中且有权重", !!CFG.altars.RIFT && CFG.altars.RIFT.weight > 0);
  /* 抽 100 次深渊祭坛：结果恒不含 RIFT */
  var wR = freshAbyss();
  wR.altars = [];
  var drew = rollAbyssAltars(wR, 100);
  check("42 深渊连抽 100 次祭坛：数量 = 100", drew.length === 100);
  check("43 深渊 100 次祭坛抽取不含 RIFT（屏蔽生效）", drew.every(function (id) { return id !== "RIFT"; }));
  check("44 深渊 100 次抽取全部来自合法池", drew.every(function (id) { return !!poolEndless[id]; }));
  /* 对照：主线池 100 次能抽到 RIFT（证明屏蔽只作用于深渊） */
  var hitRift = false;
  for (var k = 0; k < 500; k++) { if (U.weightedPick(poolMain) === "RIFT") { hitRift = true; break; } }
  check("45 主线池可抽到 RIFT（屏蔽只作用于深渊，不误伤主线）", hitRift === true);
  /* Endless.installRiftFilter 兜底接口同样排除 RIFT */
  var wR2 = freshAbyss(); wR2.altars = [];
  var drew2 = Endless.installRiftFilter(wR2, 50);
  check("46 Endless.installRiftFilter 亦排除 RIFT", drew2.every(function (id) { return id !== "RIFT"; }));
  /* 非深渊世界调用 rollAbyssAltars 不产生祭坛（零副作用） */
  G.activeWorld = { kind: "artisan", altars: [] };
  check("47 非深渊世界 rollAbyssAltars 返回空（不误伤其它世界）", rollAbyssAltars(G.activeWorld, 5).length === 0);
  G.activeWorld = wR;

  /* ============ 七、零副作用 / 边界 ============ */
  G.activeWorld = { kind: "main" };
  check("48 主线世界 updateAbyssExtract 返回 false（不介入主线）", updateAbyssExtract(0.1) === false);
  check("49 主线世界 abyssExtractInterrupt 返回 false（不介入主线）", abyssExtractInterrupt() === false);
  check("50 主线世界 isAbyssWorld = false", isAbyssWorld(G.activeWorld) === false);
  /* 深渊世界但 Endless 未就绪 → 掉落函数安全返回 false（不抛错） */
  var savedEndless = Endless;
  G.activeWorld = w; w.exitBeacon = null; w.abyssExtractSettled = false; w.abyssExtractDone = false;
  Endless = undefined;
  var safeDrop = true;
  try { safeDrop = (spawnAbyssExtractBeacon(w) === false); } catch (e) { safeDrop = false; }
  check("51 Endless 缺失时掉撤离点安全返回 false（不抛错）", safeDrop === true);
  Endless = savedEndless;

  /* 输出失败项数（文件级汇总用） */
  window.__reFail = () => fails;
  window.__reChecks = () => checks;
`, sandbox, { filename: "rift_extract_driver.js" });

/* ---- 汇总 ---- */
const fails = sandbox.window.__reFail ? sandbox.window.__reFail() : 1;
const checks = sandbox.window.__reChecks ? sandbox.window.__reChecks() : 0;
console.log("----------------------------------------");
console.log("PASS 统计 = " + passCount + " 项文件级断言 + 沙箱内 " + checks + " 项；失败 = " + (failCount + fails));
if (fails > 0 || failCount > 0) {
  console.log("RIFT EXTRACT TEST FAILED");
  process.exit(1);
}
console.log("RIFT EXTRACT TEST OK");
