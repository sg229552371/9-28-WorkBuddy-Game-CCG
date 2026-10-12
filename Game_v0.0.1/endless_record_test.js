/* 21.19 W6 · 深渊最高记录 + 首通奖励 回归测试（node endless_record_test.js）
 * 覆盖：
 *   ① ensure 惰性补全 abyss 六要素（部分存档字段保留、不覆盖）
 *   ② bestWave / bestTier / clearedTiers 更新规则（撤离成功才记层级）
 *   ③ fastestSec 只记撤离成功且 elapsed>0（取最小值）
 *   ④ firstExtract / firstFinalBoss 首次标记（reason==="extract" 或 bossKills>0）
 *   ⑤ 首通奖励只给一次（标记落盘，幂等）
 *   ⑥ 非深渊世界早退（G.inEndless === false 零副作用）
 *   ⑦ 无 Meta 降级（独立沙箱无 Meta/CFG/G 也不抛异常，内存兜底可测）
 * 判绿 = exit 0 且末行 ENDLESS RECORD TEST OK；
 * 输出严禁出现英文 FAIL/Error 字样（门禁口径）。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---- 断言器：输出文案只含中文安全词 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "未过 ") + name);
  if (cond) passCount++; else failCount++;
}

/* ===== 沙箱装载：最小 DOM/Image 桩（脚本链顶层需要） ===== */
const noop = () => { };
const fakeEl = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  children: [], innerHTML: "", textContent: "", disabled: false, width: 300, height: 300, value: "",
  appendChild(c) { this.children.push(c); return c; }, remove: noop,
  addEventListener: noop, setAttribute: noop, getAttribute: () => null,
  getContext: () => ({}), querySelector: () => fakeEl(), querySelectorAll: () => [],
  closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
});
const UI = {
  toast: noop, showScreen: noop, showHudOnly: noop, updateHUD: noop, renderBackpack: noop,
  toggleBackpack: noop, clearBattleHud: noop, updateHomeUser: noop, closeNpcPanels: noop,
  buildLevelList: noop, onLevelUpChoice: noop, onLevelUpChoiceClose: noop,
  hideEndlessSettle: noop, showEndlessSettle: noop, hideEndlessIntro: noop, showEndlessIntro: noop,
};
/* localStorage 内存桩：可检视落盘内容（断言幂等标记真正持久化） */
const store = { save: null };
const sandbox = {
  console: { log: (...a) => console.log(...a), warn: noop, error: noop, info: noop },
  Math, Date, JSON, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat,
  UI,
  document: { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop, querySelectorAll: () => [], elementFromPoint: () => null, execCommand: () => true, body: fakeEl() },
  window: { addEventListener: noop, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: "", href: "http://x/", protocol: "http:" } },
  localStorage: { getItem: () => store.save, setItem: (k, v) => { store.save = v; }, removeItem: () => { store.save = null; } },
  requestAnimationFrame: noop,
  Image: class { constructor() { this.width = 100; this.height = 100; } set src(v) { } },
  performance: { now: () => Date.now() },
  Audio: class { constructor() { } play() { } pause() { } cloneNode() { return new this.constructor(); } addEventListener() { } },
};
vm.createContext(sandbox);

let loadOk = true, loadMsg = "";
try {
  for (const f of ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/endless.js", "js/quality.js", "js/rewards.js", "js/endless-record.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sandbox, { filename: f });
  }
} catch (e) {
  loadOk = false; loadMsg = (e && e.message) ? e.message : String(e);
}

check("01 沙箱内加载 config/game/endless/rewards/endless-record 脚本链不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常信息：" + loadMsg);
  console.log("ENDLESS RECORD TEST FAILED");
  process.exit(1);
}
check("02 EndlessRecord 暴露到全局且方法齐全（ensure/onSettle/grantFirstRewards/best）",
  typeof sandbox.EndlessRecord === "object" && sandbox.EndlessRecord !== null &&
  ["ensure", "onSettle", "grantFirstRewards", "best"].every(m => typeof sandbox.EndlessRecord[m] === "function"));

/* ===== 主驱动：在沙箱内跑记录/奖励断言 ===== */
vm.runInContext(`
  var checks = 0, fails = 0;
  var check = function (name, cond) { checks++; console.log((cond ? "PASS " : "未过") + " " + name); if (!cond) fails++; };
  var ER = EndlessRecord;

  /* ============ ⑥ 非深渊世界早退（零副作用） ============ */
  G.inEndless = false;
  Meta.data.abyss = undefined;                 // 从干净状态开始
  var r0 = ER.onSettle({ wave: 9, extracted: true, reason: "extract", elapsed: 100, tier: 5 });
  check("03 非深渊世界（G.inEndless=false）onSettle 返回 null 早退", r0 === null);
  check("04 非深渊世界早退后 abyss 未被创建（零副作用）", Meta.data.abyss === undefined);
  G.inEndless = true;

  /* ============ ① ensure 惰性补全 ============ */
  Meta.data.abyss = { bestWave: 3 };           // 模拟老存档：只有部分字段
  var a1 = ER.ensure();
  check("05 ensure 后 abyss 六要素齐全", a1.bestWave === 3 && a1.bestTier === 0 && a1.fastestSec === 0 && a1.firstExtract === false && a1.firstFinalBoss === false && typeof a1.clearedTiers === "object");
  check("06 ensure 幂等：已存字段（bestWave=3）不被覆盖", a1.bestWave === 3);
  var a1b = ER.ensure();
  check("07 ensure 重复调用返回同一对象（惰性，不重建）", a1b === a1);
  a1.clearedTiers = null;
  ER.ensure();
  check("08 clearedTiers 损坏时 ensure 重建为对象", typeof ER.ensure().clearedTiers === "object");

  /* ============ ②③④ 记录更新规则（重置为干净存档） ============ */
  Meta.data.abyss = undefined;
  ER.ensure();
  check("09 干净存档 best() 全零摘要", (function () { var b = ER.best(); return b.bestWave === 0 && b.bestTier === 0 && b.fastestSec === 0 && b.firstExtract === false && b.firstFinalBoss === false && b.clearedCount === 0; })());

  /* ② bestWave：任意结算都更新 */
  ER.onSettle({ wave: 5, kills: 30, crystals: 40, extracted: false, reason: "death", timedOut: false, tier: 2 });
  check("10 死亡结算也更新 bestWave（=5）", ER.best().bestWave === 5);
  check("11 死亡结算不记层级（bestTier 仍 0、clearedTiers 空）", ER.best().bestTier === 0 && ER.best().clearedCount === 0);

  /* ④ firstFinalBoss：死亡但 bossKills>0 也要标记 */
  ER.onSettle({ wave: 5, extracted: false, reason: "death", bossKills: 1, tier: 2 });
  check("12 bossKills>0 的死亡结算标记 firstFinalBoss", ER.best().firstFinalBoss === true);
  check("13 bossKills>0 不影响 fastestSec（仍 0，非撤离）", ER.best().fastestSec === 0);

  /* ③ fastestSec / ② bestTier：仅撤离成功 */
  ER.onSettle({ wave: 7, extracted: true, reason: "extract", elapsed: 600, tier: 3 });
  check("14 撤离成功更新 bestTier（=3）并记 clearedTiers[3]", ER.best().bestTier === 3 && ER.best().clearedTiers[3] === true);
  check("15 撤离成功记录 fastestSec（=600）", ER.best().fastestSec === 600);
  check("16 首次撤离标记 firstExtract（=true）", ER.best().firstExtract === true);
  check("17 reason=extract 标记 firstFinalBoss（口径：撤离即通关最终 BOSS）", ER.best().firstFinalBoss === true);

  ER.onSettle({ wave: 7, extracted: true, reason: "extract", elapsed: 480, tier: 3 });
  check("18 更快撤离刷新 fastestSec（600 → 480）", ER.best().fastestSec === 480);
  ER.onSettle({ wave: 7, extracted: true, reason: "extract", elapsed: 900, tier: 3 });
  check("19 更慢撤离不回退 fastestSec（仍 480）", ER.best().fastestSec === 480);
  ER.onSettle({ wave: 8, extracted: true, reason: "extract", elapsed: 0, tier: 4 });
  check("20 elapsed=0 的撤离不更新 fastestSec（仍 480）", ER.best().fastestSec === 480);
  ER.onSettle({ wave: 6, extracted: false, reason: "death", elapsed: 120, tier: 1 });
  check("21 死亡结算即使有 elapsed 也不更新 fastestSec（仍 480）", ER.best().fastestSec === 480);

  /* 低层重复通关不回退 bestTier（check20 已通关 tier4，bestTier 应为 4 且不被 tier2 回退） */
  ER.onSettle({ wave: 4, extracted: true, reason: "extract", elapsed: 300, tier: 2 });
  check("22 低层重复通关不回退 bestTier（仍 4）且 clearedTiers[2] 已记", ER.best().bestTier === 4 && ER.best().clearedTiers[2] === true && ER.best().clearedCount === 3);

  check("23 best() 摘要字段齐全（供 W4 #abyss-best）", (function () { var b = ER.best(); return typeof b.bestWave === "number" && typeof b.bestTier === "number" && typeof b.fastestSec === "number" && typeof b.firstExtract === "boolean" && typeof b.firstFinalBoss === "boolean" && typeof b.clearedCount === "number" && typeof b.crystals === "number"; })());

  /* ============ ⑤ 首通奖励：只给一次（幂等 + 标记落盘） ============ */
  Meta.data.abyss = undefined;                 // 全新存档重跑首通链路
  ER.ensure();
  Meta.data.crystals = 0;
  check("24 无首通标记时 grantFirstRewards 返回 0", ER.grantFirstRewards() === 0);
  check("25 无首通标记时不入账结晶（仍 0）", (Meta.data.crystals | 0) === 0);

  ER.onSettle({ wave: 7, extracted: true, reason: "extract", elapsed: 600, tier: 3, bossKills: 1 });
  var granted = ER.grantFirstRewards();
  check("26 首通奖励 = firstExtractReward + firstFinalBossReward（=300）",
    granted === CFG.endless.records.firstExtractReward + CFG.endless.records.firstFinalBossReward);
  check("27 结晶入账走唯一口径（Meta.data.crystals = 300）", (Meta.data.crystals | 0) === 300);
  check("28 幂等标记已写入 abyss（firstExtractGranted / firstFinalBossGranted）",
    ER.ensure().firstExtractGranted === true && ER.ensure().firstFinalBossGranted === true);
  check("29 幂等标记已随 Meta.commit 落盘（localStorage 桩可检视）",
    (function () { try { var s = JSON.parse(localStorage.getItem("bagrogue_save_v1")); return s && s.abyss && s.abyss.firstExtractGranted === true && s.abyss.firstFinalBossGranted === true && s.crystals === 300; } catch (e) { return false; } })());
  check("30 二次调用 grantFirstRewards 返回 0（严格幂等）", ER.grantFirstRewards() === 0);
  check("31 二次调用后结晶不变（仍 300，绝不重复发放）", (Meta.data.crystals | 0) === 300);
  check("32 三次调用仍为 0（防回归重复发放）", ER.grantFirstRewards() === 0 && (Meta.data.crystals | 0) === 300);
  check("33 首通后 best().crystals 摘要与存档一致（=300）", ER.best().crystals === 300);

  /* 只有撤离标记、没有 BOSS 击杀的部分首通：只发撤离那份（模块口径下撤离会同时
   * 标记 firstFinalBoss，故手动构造「仅 firstExtract」的存档状态来覆盖单份发放） */
  Meta.data.abyss = undefined;
  ER.ensure();
  ER.ensure().firstExtract = true;             // 仅标记撤离成功（firstFinalBoss 保持 false）
  Meta.data.crystals = 0;
  check("34 仅撤离首通发 firstExtractReward 一份（=200）", ER.grantFirstRewards() === CFG.endless.records.firstExtractReward && (Meta.data.crystals | 0) === CFG.endless.records.firstExtractReward);
  check("35 部分首通二次调用不再补发（幂等）", ER.grantFirstRewards() === 0 && (Meta.data.crystals | 0) === CFG.endless.records.firstExtractReward);

  window.__erFail = function () { return fails; };
  window.__erChecks = function () { return checks; };
`, sandbox, { filename: "endless_record_driver.js" });

/* ===== ⑦ 无 Meta 降级：独立干净沙箱，只加载本模块（无 Meta/CFG/G） ===== */
(function () {
  const bare = { console: { log: noop, warn: noop, error: noop }, Math, Date, JSON };
  bare.globalThis = bare;
  vm.createContext(bare);
  let ok = true, msg = "";
  try {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "js/endless-record.js"), "utf8"), bare, { filename: "js/endless-record.js" });
    vm.runInContext(`
      var ERb = globalThis.EndlessRecord;
      var a = ERb.ensure();                                     // 无 Meta → 内存兜底
      ERb.onSettle({ wave: 6, extracted: true, reason: "extract", elapsed: 300, tier: 2, bossKills: 1 });
      var g1 = ERb.grantFirstRewards();
      var g2 = ERb.grantFirstRewards();
      var b = ERb.best();
      globalThis.__res = { ok: a && a.bestWave === 6 && typeof a.clearedTiers === "object",
        g1: g1, g2: g2, g1IsSum: g1 === 200 + 100,   // CFG 缺失 → 内置兜底常量 200/100
        best: b, fallbackFlag: ERb.__isFallback() === true };
    `, bare, { filename: "bare_driver.js" });
  } catch (e) { ok = false; msg = (e && e.message) ? e.message : String(e); }
  const r = bare.__res || {};
  check("36 无 Meta 独立沙箱加载并运行不抛异常", ok);
  if (!ok) console.log("降级运行异常信息：" + msg);
  check("37 无 Meta 时 ensure 用内存兜底对象补全字段", !!(r.ok));
  check("38 无 Meta 时 onSettle 正常记录（bestWave=6 / bestTier=2）", !!(r.best && r.best.bestWave === 6 && r.best.bestTier === 2));
  check("39 无 Meta 时首通奖励发放一次（兜底常量 200+100=300）", r.g1IsSum === true);
  check("40 无 Meta 时二次发放为 0（内存兜底同样幂等）", r.g2 === 0);
  check("41 无 Meta 时 best() 摘要可用（crystals=300，兜底标志为真）", !!(r.best && r.best.crystals === 300 && r.fallbackFlag));
})();

/* ---- 汇总 ---- */
const fails = sandbox.window.__erFail();
const checks = sandbox.window.__erChecks();
console.log("----------------------------------------");
console.log("PASS 合计 = " + (passCount + checks) + "  失败 = " + (failCount + fails));
if (fails > 0 || failCount > 0) {
  console.log("ENDLESS RECORD TEST FAILED");
  process.exit(1);
}
console.log("ENDLESS RECORD TEST OK");
process.exit(0);
