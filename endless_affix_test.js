/* ============================================================================
 * 21.19 深渊词缀系统（W2）回归测试（node endless_affix_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   ① 沙箱加载脚本链（config → … → endless → endless-affix）不抛异常
 *   ② 条数曲线：层 1 = 0 / 层 3 = 1 / 层 8 = 2 / 层 15 = 3 / 层 30 封顶 3
 *   ③ 加权抽取无重复：批量抽取无重复 id、全部来自配置池
 *   ④ 加权方向确定性：Math.random 恒 0 → 首个累计权重项；恒近 1 → 末项
 *   ⑤ rollAffixes 写 state.affixes 且返回一致；activeAffixes 返回配置对象
 *   ⑥ affixMods 聚合：全 8 键齐备、无词缀全 1、多词缀连乘
 *   ⑦ 猴子补丁生效：hpMul ×monsterHpMul / dmgMul ×monsterAtkMul /
 *      waveCap ×waveCapMul / waveReward ×rewardMul（对照加载前基线）
 *   ⑧ affixTimeLimitMul：无词缀 1、催命 0.8（待 W8 接线 timeLeft）
 *   ⑨ 非深渊零影响：world.kind !== "endless" 时四个包装函数等于基线原值
 *   ⑩ 幂等：重复加载 js/endless-affix.js 不叠加倍率（__affixWrapped 标记防重）
 *   ⑪ 生命周期：reset 清空词缀、倍率回落全 1
 *
 * 门禁口径：汇总行必须中文（PASS 合计 = N 失败 = 0），全文禁止英文 FAIL/Error 字样；
 * 异常消息打印前做脱敏（英文 error/Error 一律替换为中文「错误」）。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* ---- 断言器 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "失败 ") + name);
  if (cond) passCount++; else failCount++;
}
/* 异常消息脱敏：门禁 grep -ci 会把英文 error/Error/FAIL 计为失败 */
function sanitize(msg) {
  return String(msg).replace(/error/gi, "错误").replace(/FAIL/gi, "失败");
}

/* ---- 沙箱：最小 DOM/Image 桩（同 endless_test.js 口径） ---- */
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
  /* Math 用原型链影子对象：沙箱内可安全覆写 Math.random 做确定性测试，不污染宿主 */
  Math: Object.create(Math),
  Date, JSON, Array, Object, Number, String, Boolean, isFinite, isNaN, parseInt, parseFloat,
  document: { getElementById: () => fakeEl(), createElement: () => fakeEl(), addEventListener: noop, querySelectorAll: () => [], elementFromPoint: () => null, execCommand: () => true, body: fakeEl() },
  window: { addEventListener: noop, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: "", href: "http://x/", protocol: "http:" } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: noop,
  Image: class { constructor() { this.width = 100; this.height = 100; } set src(v) { } },
  performance: { now: () => Date.now() },
  Audio: class { constructor() { } play() { } pause() { } cloneNode() { return new this.constructor(); } addEventListener() { } },
  __pass: 0, __fail: 0,
};
vm.createContext(sandbox);

const CHAIN = ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js",
  "js/modes.js", "js/render.js", "js/endless.js"];
const AFFIX = "js/endless-affix.js";
const affixSrc = fs.readFileSync(path.join(__dirname, AFFIX), "utf8");

/* ---- ① 脚本链加载（不含词缀模块）→ 记录基线 → 再载入词缀模块 ---- */
let loadOk = true, loadMsg = "";
try {
  for (const f of CHAIN) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), sandbox, { filename: f });
  }
  vm.runInContext(`
    /* 基线：词缀模块载入前的原始曲线值（供「被影响 / 非深渊零影响」对照） */
    globalThis.__base = {
      hp: Endless.hpMul(5),
      dmg: Endless.dmgMul(5),
      cap: Endless.waveCap(5),
      reward: Endless.waveReward(5),
    };
  `, sandbox, { filename: "baseline" });
  vm.runInContext(affixSrc, sandbox, { filename: AFFIX });
} catch (e) {
  loadOk = false; loadMsg = sanitize(e && e.message ? e.message : e);
}

check("01 沙箱加载脚本链 + js/endless-affix.js 不抛异常", loadOk);
if (!loadOk) {
  console.log("加载异常：" + loadMsg);
  console.log("PASS 合计 = " + passCount + " 失败 = " + failCount);
  process.exit(1);
}

/* ---- 沙箱内断言 ---- */
try {
  vm.runInContext(`
    const check = (name, cond) => { if (cond) { __pass++; console.log("PASS " + name); } else { __fail++; console.log("失败 " + name); } };
    const near = (a, b, eps) => Math.abs(a - b) < (eps === undefined ? 1e-9 : eps);
    const LIST_IDS = CFG.endless.affixes.list.map(a => a.id);

    /* 世界归属：G.activeWorld 按 case 切换（isActive 以 kind === "endless" 为准） */
    G.activeWorld = { kind: "endless" };

    /* ============ ② 条数曲线 ============ */
    check("02 层1 词缀条数 = 0", Endless.affixCountFor(1) === 0);
    check("03 层3 词缀条数 = 1", Endless.affixCountFor(3) === 1);
    check("04 层8 词缀条数 = 2", Endless.affixCountFor(8) === 2);
    check("05 层15 词缀条数 = 3", Endless.affixCountFor(15) === 3);
    check("06 层30 封顶 maxActive = 3", Endless.affixCountFor(30) === 3);

    /* ============ ③ rollAffixes 写状态 / 返回一致 ============ */
    const r15 = Endless.rollAffixes(15);
    check("07 rollAffixes(15) 返回 3 条", r15.length === 3);
    check("08 rollAffixes 写入 state.affixes 且一致", JSON.stringify(Endless.state.affixes) === JSON.stringify(r15));
    check("09 state.affixes 初值即为数组（载入即补齐）", Array.isArray(Endless.state.affixes));

    /* ============ ④ 加权抽取无重复 ============ */
    let noDup = true, allKnown = true;
    for (let i = 0; i < 300; i++) {
      const t = [3, 8, 15, 20][i % 4];
      const got = Endless.rollAffixes(t);
      const uniq = new Set(got);
      if (uniq.size !== got.length) noDup = false;
      for (const id of got) if (LIST_IDS.indexOf(id) < 0) allKnown = false;
    }
    check("10 批量抽取（300 局）无重复 id", noDup);
    check("11 抽取结果全部来自 CFG 词缀池", allKnown);

    /* ============ ⑤ 加权方向确定性（Math.random 桩，仅沙箱影子 Math） ============ */
    let detOk = true;
    try {
      Math.random = () => 0;                                  // 恒取累计权重第一项
      const d0 = Endless.rollAffixes(8);
      if (d0[0] !== LIST_IDS[0]) detOk = false;               // 配置首项 = swift（权重 10）
      Math.random = () => 0.999999;                           // 恒取累计权重末项
      const d1 = Endless.rollAffixes(8);
      if (d1[0] !== LIST_IDS[LIST_IDS.length - 1]) detOk = false;  // 配置末项 = famine（权重 6）
    } finally {
      delete Math.random;                                     // 还原（回落宿主随机）
    }
    check("12 加权抽取方向确定（r=0 取权重累计首项 / r≈1 取末项）", detOk);

    /* ============ ⑥ activeAffixes ============ */
    Endless.state.affixes = ["tough", "greed"];
    const act = Endless.activeAffixes();
    check("13 activeAffixes 返回配置对象数组（id 对应）", act.length === 2 && act[0].id === "tough" && act[1].id === "greed");
    check("14 activeAffixes 条目含 name/mods（配置对象本体）", !!act[0].name && !!act[0].mods && !!act[1].name);
    check("15 activeAffixes 跳过未知 id（脏数据安全）", (Endless.state.affixes = ["tough", "__nope__"], Endless.activeAffixes().length === 1));

    /* ============ ⑦ affixMods 聚合 ============ */
    Endless.rollAffixes(1);                                    // 0 条
    const empty = Endless.affixMods();
    const KEYS = ["monsterSpdMul", "monsterHpMul", "monsterAtkMul", "waveCapMul", "rewardMul", "playerHpMul", "timeLimitMul", "expMul"];
    let allKeys = true;
    for (const k of KEYS) if (typeof empty[k] !== "number") allKeys = false;
    check("16 affixMods 必含全部 8 键（含 monsterSpdMul/playerHpMul/expMul）", allKeys);
    let allOne = true;
    for (const k of KEYS) if (empty[k] !== 1) allOne = false;
    check("17 无词缀时 affixMods 全键 = 1", allOne);

    Endless.state.affixes = ["tough", "greed", "frenzy"];
    const m = Endless.affixMods();
    check("18 聚合 monsterHpMul = 1.30（坚韧）", near(m.monsterHpMul, 1.30));
    check("19 聚合 monsterAtkMul = 1.15×1.20（贪婪×狂怒）", near(m.monsterAtkMul, 1.15 * 1.20));
    check("20 聚合 rewardMul = 1.40（贪婪）", near(m.rewardMul, 1.40));
    check("21 未被命中的键仍 = 1（如 waveCapMul）", m.waveCapMul === 1 && m.timeLimitMul === 1);

    /* ============ ⑧ 猴子补丁生效（对照基线，深渊世界） ============ */
    Endless.state.affixes = ["tough"];
    check("22 hpMul 被词缀影响：基线×1.30", near(Endless.hpMul(5), __base.hp * 1.30));
    Endless.state.affixes = ["frenzy"];
    check("23 dmgMul 被词缀影响：基线×1.20", near(Endless.dmgMul(5), __base.dmg * 1.20));
    Endless.state.affixes = ["horde"];
    check("24 waveCap 被词缀影响：round(基线×1.15)", Endless.waveCap(5) === Math.round(__base.cap * 1.15));
    Endless.state.affixes = ["greed"];
    check("25 waveReward 被词缀影响：round(基线×1.40)", Endless.waveReward(5) === Math.round(__base.reward * 1.40));

    /* ============ ⑨ timeLimitMul 接口（待 W8 接线 timeLeft） ============ */
    check("26 affixTimeLimitMul：无词缀 = 1", (Endless.state.affixes = [], Endless.affixTimeLimitMul() === 1));
    check("27 affixTimeLimitMul：催命 haste = 0.80", (Endless.state.affixes = ["haste"], near(Endless.affixTimeLimitMul(), 0.80)));

    /* ============ ⑩ 非深渊零影响 ============ */
    Endless.state.affixes = ["tough", "horde", "greed", "frenzy"];   // 故意挂满词缀
    G.activeWorld = { kind: "city" };                                 // 主城世界
    check("28 非深渊 hpMul 等于基线（零影响）", Endless.hpMul(5) === __base.hp);
    check("29 非深渊 dmgMul 等于基线（零影响）", Endless.dmgMul(5) === __base.dmg);
    check("30 非深渊 waveCap 等于基线（零影响）", Endless.waveCap(5) === __base.cap);
    check("31 非深渊 waveReward 等于基线（零影响）", Endless.waveReward(5) === __base.reward);
    G.activeWorld = null;                                             // 无世界（主城/主图兜底路径）
    check("32 无世界时包装函数同样直通基线", Endless.hpMul(5) === __base.hp && Endless.waveReward(5) === __base.reward);
    G.activeWorld = { kind: "endless" };                              // 还原深渊世界

    /* ============ ⑪ 幂等：重复加载不叠加 ============ */
    Endless.state.affixes = ["tough"];
    const onceVal = Endless.hpMul(5);
    check("33 包装函数带 __affixWrapped 幂等标记", typeof Endless.hpMul.__affixWrapped === "boolean" && Endless.hpMul.__affixWrapped === true);
    /* 二次加载由宿主执行（下方 runInContext），此处先记录一次加载值 */

    /* ============ ⑫ 生命周期：reset 清空 ============ */
    Endless.reset();
    check("34 reset 清空 state.affixes", Array.isArray(Endless.state.affixes) && Endless.state.affixes.length === 0);
    const afterReset = Endless.affixMods();
    check("35 reset 后 affixMods 回落全 1", near(afterReset.monsterHpMul, 1) && near(afterReset.rewardMul, 1) && near(afterReset.timeLimitMul, 1));
  `, sandbox, { filename: "affix-asserts" });

  /* ---- 幂等：在沙箱内二次加载词缀模块 → 倍率不得叠加 ---- */
  vm.runInContext(affixSrc, sandbox, { filename: AFFIX + "#2" });
  vm.runInContext(`
    const check2 = (name, cond) => { if (cond) { __pass++; console.log("PASS " + name); } else { __fail++; console.log("失败 " + name); } };
    const near2 = (a, b) => Math.abs(a - b) < 1e-9;
    G.activeWorld = { kind: "endless" };
    Endless.state.affixes = ["tough"];
    check2("36 二次加载后 hpMul 仍为基线×1.30（不叠加成 ×1.69）", near2(Endless.hpMul(5), __base.hp * 1.30));
    check2("37 二次加载后 dmgMul 仍单层包装（无词缀时等于基线）", (Endless.state.affixes = [], near2(Endless.dmgMul(5), __base.dmg)));
    check2("38 二次加载后 waveCap / waveReward 仍单层包装", (Endless.state.affixes = ["horde", "greed"],
      Endless.waveCap(5) === Math.round(__base.cap * 1.15) && Endless.waveReward(5) === Math.round(__base.reward * 1.40)));
  `, sandbox, { filename: "affix-idempotent" });
} catch (e) {
  failCount++;
  console.log("断言执行异常（已脱敏）：" + sanitize(e && e.message ? e.message : e));
}

/* ---- 汇总（门禁口径：中文汇总行，全文无英文 FAIL/Error） ---- */
passCount += sandbox.__pass;
failCount += sandbox.__fail;
console.log("PASS 合计 = " + passCount + " 失败 = " + failCount);
if (failCount > 0) process.exit(1);
