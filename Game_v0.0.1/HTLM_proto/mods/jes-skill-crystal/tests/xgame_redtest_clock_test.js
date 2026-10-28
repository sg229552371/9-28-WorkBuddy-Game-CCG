/* ============================================================================
 * xgame_redtest_clock_test.js —— 独立复核：skill_enable_runtime_test 第⑥条「旧路径仍能开火」
 *                                间歇红测的根因，究竟是不是「非单调时钟注入」
 * ----------------------------------------------------------------------------
 * 【被复核的结论】（主集成人提出，本脚本不预设为真）
 *   `skill_enable_runtime_test.js` 第⑥断言「关掉开关后旧路径 10 秒内 kills ≥ 1」
 *   会以约 12% 概率失败，根因是：测试用 `let t = 0; Game.loop(t)` 向主循环注入了
 *   **非单调时钟**（t 被重置为 0，而上一段 ④ 已把 `Game.lastT` 推到 ≈10020），
 *   于是首帧 `dt = (0 - 10020)/1000 = -10.02`（负值），而不是 RNG 随机、也不是产品缺陷。
 *
 * 【本脚本怎么复核】
 *   1) 与 `skill_enable_runtime_test.js` 同款 DOM 桩，按 index.html 脚本顺序用 vm 装载全部 js。
 *   2) 真实调用 Game.startRun / Game.loop(t) / global.__raf(t)，驱动 600 帧（≈10 秒）。
 *   3) 确定性对照：U.setRng(mulberry32(固定种子)) 冻结随机源后，
 *      对**同一个种子**分别喂两种钟：
 *        · 重置钟（复现红测）  ：进循环前把 Game.lastT 设为 10020，再 t 从 0 起 → 首帧 dt ≈ -10.02
 *        · 单调钟（护栏对照）  ：进循环前把 Game.lastT 设为 0，   再 t 从 0 起 → 首帧 dt = 0.016
 *      两者 t 序列完全相同，唯一差异 = 首帧 dt。
 *   4) 另做一组真实 Math.random（不注入种子）的重置钟/单调钟对照，估真实失败率量级。
 *
 * 【判定逻辑】
 *   若「重置钟零击杀」明显高于「单调钟零击杀」，且存在同种子下「重置钟零击杀、单调钟有击杀」的
 *   配对反例 → 时钟注入为因，RNG 为旁证 → 结论「已证实」；否则如实判「已证伪 / 证据不足」。
 *
 * ----------------------------------------------------------------------------
 * 【2026-10-12 修复后更新（主集成人 B2-1）—— 本脚本使命升级为「守卫修复」】
 *   上段所述根因（非单调注入 → 首帧负步长）已定位，并修在**两层**：
 *     ① 测试侧：`skill_enable_runtime_test.js` 第⑥段不再把 t 重置为 0，改为从 `Game.lastT` 续帧；
 *     ② 产品侧：`js/main.js` 的 dt 计算补**下界钳制** `Math.max(0, ...)`，任何非单调/回拨时间戳
 *        都不再产生负步长（线上 rAF 单调，此为防御性加固，正常运行零行为变化）。
 *   因此修复后的正确基线变为：
 *     · 非单调注入这一**输入**依然存在（重置钟「原始步长」= (t - lastTBefore)/1000 ≈ -10.02）；
 *     · 但**实际应用步长**（G.time 增量）已被钳制归位为 ≥0（≈ 0.016 兜底）；
 *     · 于是重置钟不再零击杀，配对反例清零。
 *   本脚本据此断言：既证明机制输入仍在（未删历史证据），又证明修复生效（守卫回归）。
 *   ⚠️ 若将来有人去掉 main.js 的下界钳制，本脚本的 ③b/⑤/⑦/⑧ 会立刻转红 —— 这就是它的价值。
 *
 * ⚠️ PASS 文案禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

/* ---------------- DOM 桩（与 skill_enable_runtime_test.js 同款） ---------------- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) {
    this._cls = v; this.classList = new ClassList();
    String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v;
    this.children.length = 0;
    this._q = null; this._qa = null;
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]);
      el.className = m[3];
      el._parent = this;
      this.children.push(el);
    }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  _findAll(cls, acc) {
    acc = acc || [];
    for (const c of this.children) {
      if (c.classList && c.classList.contains(cls)) acc.push(c);
      if (c._findAll) c._findAll(cls, acc);
    }
    return acc;
  }
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  querySelectorAll(sel) {
    this._qa = this._qa || {};
    if (!this._qa[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._qa[sel] = list;
      this._q = this._q || {};
      if (list.length && !this._q[sel]) this._q[sel] = list[0];
    }
    return this._qa[sel];
  }
  closest(sel) {
    const sels = String(sel).split(",").map(s => s.trim()).filter(Boolean);
    let el = this;
    while (el) {
      for (const s of sels) {
        if (s.charAt(0) === ".") { if (el.classList && el.classList.contains(s.slice(1))) return el; }
        else if (s.charAt(0) === "#") { if (el._id === s.slice(1)) return el; }
      }
      el = el._parent;
    }
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
Object.defineProperty(global.document, "body", { get() { return this.getElementById("body"); }, configurable: true });
const winHandlers = {};
global.window = {
  addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
  dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
  innerWidth: 1920, innerHeight: 1080,
};
global.location = { search: "", href: "https://example.invalid/", pathname: "/" };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};
const ROOT = path.join(__dirname, "..", "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- ① 全量脚本按 index.html 顺序装载（与浏览器同序） ---------------- */
const html = read("index.html");
const scripts = [...html.matchAll(/<script src="((?:js|mods)\/[^"?]+)/g)].map(m => m[1]);
let loadErr = "";
const ctx = vm.createContext(global);
try { for (const f of scripts) vm.runInContext(read(f), ctx, { filename: f }); }
catch (e) { loadErr = (e && e.message) || "?"; }
check("① " + scripts.length + " 个脚本按 index.html 顺序可无异常装载", !loadErr);
if (loadErr) {
  console.log("载入期异常：" + loadErr);
  console.log("");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(1);
}
const ev = (code) => vm.runInContext(code, ctx);

/* ---------------- ② 复现前置：旧路径配置成立（关开关 → 不判新路径） ---------------- */
ev('G.canvas = document.getElementById("game-canvas"); G.ctx = G.canvas.getContext("2d");'
  + ' G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };'
  + ' Game.bindInput(); Game.bindEvents(); UI.selectedLevel = CFG.levels[0];');

/* ---------------- ③ 对照实验（全部在 vm 内真实跑主循环） ---------------- */
const exp = ev(`(function () {
  // mulberry32：固定种子伪随机（与项目"测试输入固定随机种子"口径相容）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 一次样本：真实 startRun + 真实主循环 601 次调用（首帧 + 600 帧 ≈ 10 秒）
  // resetClock=true  → 模拟第⑥条旧缺陷：lastT 残留 10020，再 t 从 0 起（原始步长 ≈ -10.02）
  // resetClock=false → 单调钟对照：lastT=0，再 t 从 0 起（原始步长 = 0，走 0.016 兜底）
  // 两种喂钟的 t 序列完全一致，只有"进循环前 lastT"不同。
  // 记录两个量：rawDt0 = 未经钳制的原始步长；dt0 = main.js 钳制后实际应用的步长。
  function runSample(seed, resetClock) {
    if (seed == null) U.resetRng(); else U.setRng(mulberry32(seed));
    SkillPlaytest.reset();                 // 卸掉整合层包装
    CFG.skillSystem.enabled = false;       // 配表开关关掉（复现第⑥条前置）
    CFG.skillSystem.migratedHeroIds = [];
    UI.selectedLevel = CFG.levels[0];
    G.time = 0;                            // 隔离：G.time 为全局累加，逐样本清零避免跨样本漂移
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    G.run.hp = 100000;
    var ownsNow = SkillRuntime.ownsHero({ id: "H001" });
    Game.lastT = resetClock ? 10020 : 0;   // ★ 唯一自变量：进循环前的残留时钟
    var lastTBefore = Game.lastT;
    var g0 = G.time;
    var t = 0;
    var skillTimerAfterFirst = null;
    Game.loop(t);                          // 首帧
    var rawDt0 = (t - lastTBefore) / 1000; // 未经钳制的原始步长（负 = 非单调注入这一输入确实存在）
    var dt0 = G.time - g0;                 // 实际应用的首帧步长（已被 main.js 下界钳制）
    skillTimerAfterFirst = (G.player && typeof G.player.skillTimer === "number") ? G.player.skillTimer : null;
    G.keys["d"] = true;
    for (var k = 0; k < 600; k++) { t += 16.7; global.__raf(t); }   // ≈10 秒
    G.keys["d"] = false;
    var kills = G.run.kills;
    var mons = G.mainWorld.monsters.length;
    U.resetRng();
    return { seed: seed, reset: resetClock, rawDt0: rawDt0, dt0: dt0, skillTimer: skillTimerAfterFirst, kills: kills, mons: mons, owns: ownsNow };
  }

  var PAIR_N = 30;   // 固定种子配对数
  var RND_N = 30;    // 真实随机对数
  var paired = [], rndReset = [], rndMono = [];
  for (var i = 0; i < PAIR_N; i++) {
    var s = 1000 + i;
    var r = runSample(s, true);
    var m = runSample(s, false);
    paired.push({ seed: s, r: r, m: m });
  }
  for (var j = 0; j < RND_N; j++) {
    rndReset.push(runSample(null, true));
    rndMono.push(runSample(null, false));
  }
  return { paired: paired, rndReset: rndReset, rndMono: rndMono };
})()`);

/* ---------------- 数据汇总 ---------------- */
const P = exp.paired;
const paired_OK = Array.isArray(P) && P.length > 0;
const rReset = paired_OK ? P.map(x => x.r) : [];
const rMono = paired_OK ? P.map(x => x.m) : [];
const zeroReset = rReset.filter(x => x.kills === 0).length;
const zeroMono = rMono.filter(x => x.kills === 0).length;
const sumReset = rReset.reduce((a, x) => a + x.kills, 0);
const sumMono = rMono.reduce((a, x) => a + x.kills, 0);
// 配对反例：同种子上，重置钟零击杀、单调钟有击杀
const antiExamples = paired_OK ? P.filter(x => x.r.kills === 0 && x.m.kills >= 1) : [];
// 首帧步长实测：rawDt0 = 未钳制原始步长；dt0 = main.js 钳制后实际步长
const rawResetMin = rReset.length ? Math.min(...rReset.map(x => x.rawDt0)) : 0;
const rawResetMax = rReset.length ? Math.max(...rReset.map(x => x.rawDt0)) : 0;
const rawMonoMin = rMono.length ? Math.min(...rMono.map(x => x.rawDt0)) : 0;
const rawMonoMax = rMono.length ? Math.max(...rMono.map(x => x.rawDt0)) : 0;
const dtResetMin = rReset.length ? Math.min(...rReset.map(x => x.dt0)) : 0;
const dtResetMax = rReset.length ? Math.max(...rReset.map(x => x.dt0)) : 0;
const dtMonoMin = rMono.length ? Math.min(...rMono.map(x => x.dt0)) : 0;
const dtMonoMax = rMono.length ? Math.max(...rMono.map(x => x.dt0)) : 0;

const Rnd = exp.rndReset.concat(exp.rndMono);
const zeroRndReset = exp.rndReset.filter(x => x.kills === 0).length;
const zeroRndMono = exp.rndMono.filter(x => x.kills === 0).length;

/* ---------------- 输出数据表 ---------------- */
console.log("");
console.log("================ 确定性对照（固定种子）数据表 ================");
console.log("种子     重置钟 kills / 原始dt / 实际dt / skillTimer      单调钟 kills / 原始dt / 实际dt");
for (let i = 0; i < P.length; i++) {
  const p = P[i];
  const line = String(p.seed).padEnd(8)
    + String(p.r.kills).padStart(4) + "  原始 " + p.r.rawDt0.toFixed(3).padStart(8) + "  实际 " + p.r.dt0.toFixed(3)
    + "  st " + String(p.r.skillTimer).padStart(7)
    + "        " + String(p.m.kills).padStart(4) + "  原始 " + p.m.rawDt0.toFixed(3).padStart(8) + "  实际 " + p.m.dt0.toFixed(3);
  console.log(line);
}
console.log("-------------------------------------------------------------");
console.log("固定种子  重置钟：样本 " + rReset.length + "，零击杀 " + zeroReset + "，总击杀 " + sumReset
  + "，原始dt∈[" + rawResetMin.toFixed(3) + ", " + rawResetMax.toFixed(3) + "]，实际dt∈[" + dtResetMin.toFixed(3) + ", " + dtResetMax.toFixed(3) + "]");
console.log("固定种子  单调钟：样本 " + rMono.length + "，零击杀 " + zeroMono + "，总击杀 " + sumMono
  + "，原始dt∈[" + rawMonoMin.toFixed(3) + ", " + rawMonoMax.toFixed(3) + "]，实际dt∈[" + dtMonoMin.toFixed(3) + ", " + dtMonoMax.toFixed(3) + "]");
console.log("固定种子  配对反例（重置钟=0 且 单调钟≥1）：" + antiExamples.length + " 例，种子=[" + antiExamples.map(x => x.seed).join(",") + "]");
console.log("");
console.log("================ 真实随机（不注入种子）对照 ================");
console.log("真实随机  重置钟：样本 " + exp.rndReset.length + "，零击杀 " + zeroRndReset);
console.log("真实随机  单调钟：样本 " + exp.rndMono.length + "，零击杀 " + zeroRndMono);

/* ---------------- 断言（失败用中文描述；2026-10-12 起为「修复守卫」口径） ---------------- */
console.log("");
check("② 旧路径配置成立：关开关后 ownsHero(H001) 判 false",
  rReset.length > 0 && rReset.every(x => x.owns === false));

check("③a 非单调注入这一输入确实存在：重置钟「原始步长」为负（≈ -10.02，实测 ∈["
  + rawResetMin.toFixed(3) + ", " + rawResetMax.toFixed(3) + "]）",
  rReset.length > 0 && rReset.every(x => x.rawDt0 < -1));
check("③b 修复生效：重置钟「实际步长」被 main.js 下界钳制为非负（实测 ∈["
  + dtResetMin.toFixed(3) + ", " + dtResetMax.toFixed(3) + "]）",
  rReset.length > 0 && rReset.every(x => x.dt0 >= 0));
check("③c 单调钟步长正常（原始 ∈[0,0.05]、实际 ∈(0,0.05]）—— 对照有效",
  rMono.length > 0 && rMono.every(x => x.rawDt0 >= 0 && x.rawDt0 <= 0.05 && x.dt0 > 0 && x.dt0 <= 0.05));

check("④ 对照样本量充足：固定种子重置钟/单调钟各 ≥20 次（实测 " + rReset.length + "/" + rMono.length + "）",
  rReset.length >= 20 && rMono.length >= 20);

check("⑤ 修复后不再复现红测：重置钟零击杀 = 0（实测 " + zeroReset + "/" + rReset.length + "）",
  rReset.length > 0 && zeroReset === 0);

check("⑥ 单调钟零击杀 = 0（实测 " + zeroMono + "/" + rMono.length + "）",
  rMono.length > 0 && zeroMono === 0);

check("⑦ 配对反例已清零：不存在「同种子下重置钟零击杀、单调钟有击杀」（实测 " + antiExamples.length + " 例）",
  antiExamples.length === 0);

check("⑧ 钳制归位：重置钟实际步长 == 单调钟实际步长（均 0.016 兜底，实测 "
  + dtResetMin.toFixed(3) + " vs " + dtMonoMin.toFixed(3) + "）",
  rReset.length > 0 && rMono.length > 0
  && rReset.every(x => Math.abs(x.dt0 - 0.016) < 1e-6)
  && rMono.every(x => Math.abs(x.dt0 - 0.016) < 1e-6));

// 真实随机侧：修复后两臂亦不应零击杀
console.log("（旁证）真实随机重置钟零击杀 " + zeroRndReset + "/" + exp.rndReset.length
  + "，单调钟 " + zeroRndMono + "/" + exp.rndMono.length + " —— 修复后两臂均不应零击杀");
check("⑨ 修复后真实随机两臂均无零击杀（实测 重置 " + zeroRndReset + " / 单调 " + zeroRndMono + "）",
  exp.rndReset.length > 0 && exp.rndMono.length > 0 && zeroRndReset === 0 && zeroRndMono === 0);

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
