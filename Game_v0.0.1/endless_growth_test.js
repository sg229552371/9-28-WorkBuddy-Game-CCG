/* 21.17 深渊局内成长（经验掉落 + 玩家强化）回归测试（node endless_growth_test.js）
 * 覆盖本轮新增的两个机制：
 *   ① applyEndlessPlayerBuff：深渊内生效 / 非深渊原样返回 / CFG.playerBuff 三倍率正确
 *   ② computeStats 集成：深渊时 hpMax/def/atk 确实被放大，退出深渊后复原
 *   ③ dropEndlessExp：深渊击杀掉经验宝石 / 非深渊零掉落 / 枚数分档（Boss5 精英3 小怪1）
 *   ④ dropEndlessExp 经验值受 CFG.endless.expMul 缩放
 *   ⑤ 经验宝石走既有拾取链路 → gainExp 可被调用（端到端语义：掉落物 type="exp" 且 value>0）
 * 判绿 = exit 0 且末行 GROWTH TEST OK；PASS 文案严禁出现英文 error/Error/FAIL（门禁口径，坑 4）。
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

/* ===== 沙箱装载（与 endless_test.js 同构：最小 DOM/Image 桩） ===== */
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
  Audio: class { constructor() { } play() { } pause() { } cloneNode() { return new this(); } addEventListener() { } },
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
check("加载全部 8 个脚本无异常（config/core/game/items/combat/modes/render/endless）", loadOk);
if (!loadOk) { console.log("加载失败原因:", loadMsg); console.log("FAIL 终止：脚本未加载"); process.exit(1); }

function run(code) { return vm.runInContext(code, sandbox); }

console.log("===== ① CFG.endless.playerBuff / expMul 字段完整性 =====");
check("① playerBuff 存在且为对象", run('!!CFG.endless.playerBuff && typeof CFG.endless.playerBuff === "object"'));
check("① playerBuff.hpMul 为正数", run('typeof CFG.endless.playerBuff.hpMul === "number" && CFG.endless.playerBuff.hpMul > 0'));
check("① playerBuff.defMul 为正数", run('typeof CFG.endless.playerBuff.defMul === "number" && CFG.endless.playerBuff.defMul > 0'));
check("① playerBuff.atkMul 为正数", run('typeof CFG.endless.playerBuff.atkMul === "number" && CFG.endless.playerBuff.atkMul > 0'));
check("① expMul 为非负数", run('typeof CFG.endless.expMul === "number" && CFG.endless.expMul >= 0'));

console.log("===== ② applyEndlessPlayerBuff：非深渊原样返回 =====");
const noBuff = run(`(function(){
  var st = { hpMax: 100, atk: 14, def: 2, spd: 300 };
  G.inEndless = false;
  applyEndlessPlayerBuff(st);
  return { hpMax: st.hpMax, atk: st.atk, def: st.def, spd: st.spd };
})()`);
check("② 非深渊 hpMax 不被放大（仍为 100）", noBuff.hpMax === 100);
check("② 非深渊 atk 不被放大（仍为 14）", noBuff.atk === 14);
check("② 非深渊 def 不被放大（仍为 2）", noBuff.def === 2);
check("② 非深渊 spd 不被放大（仍为 300）", noBuff.spd === 300);

console.log("===== ③ applyEndlessPlayerBuff：深渊内按 CFG 倍率放大 =====");
const buffed = run(`(function(){
  var st = { hpMax: 100, atk: 14, def: 2, spd: 300 };
  G.inEndless = true;
  applyEndlessPlayerBuff(st);
  var c = CFG.endless.playerBuff;
  return { hpMax: st.hpMax, atk: st.atk, def: st.def, spd: st.spd,
           expHp: Math.round(100 * c.hpMul), expAtk: Math.round(14 * c.atkMul), expDef: Math.round(2 * c.defMul) };
})()`);
check("③ 深渊 hpMax = round(100 × hpMul)", buffed.hpMax === buffed.expHp);
check("③ 深渊 atk = round(14 × atkMul)", buffed.atk === buffed.expAtk);
check("③ 深渊 def = round(2 × defMul)", buffed.def === buffed.expDef);
check("③ 深渊 hpMax 确实大于原值", buffed.hpMax > 100);

console.log("===== ④ computeStats 集成：深渊/非深渊属性对比 =====");
const cmp = run(`(function(){
  if (typeof Game !== "undefined" && Game && typeof Game.startRun === "function") {
    if (!UI.selectedLevel) UI.selectedLevel = CFG.levels[0];
    try { Game.startRun([CFG.heroes[0]]); } catch (e) {}
  }
  if (!G.run) { G.heroDef = CFG.heroes[0]; G.run = createRun(CFG.heroes[0]); G.player = new Player(100,100); }
  G.inEndless = false;
  var normal = computeStats();
  var nHp = normal.hpMax, nAtk = normal.atk, nDef = normal.def;
  G.inEndless = true;
  var abyss = computeStats();
  var aHp = abyss.hpMax, aAtk = abyss.atk, aDef = abyss.def;
  G.inEndless = false;
  return { nHp: nHp, nAtk: nAtk, nDef: nDef, aHp: aHp, aAtk: aAtk, aDef: aDef,
           restored: computeStats().hpMax };
})()`);
check("④ 深渊 hpMax > 非深渊 hpMax", cmp.aHp > cmp.nHp);
check("④ 深渊 atk > 非深渊 atk", cmp.aAtk > cmp.nAtk);
check("④ 深渊 def > 非深渊 def", cmp.aDef > cmp.nDef);
check("④ 退出深渊后 hpMax 复原（无残留污染）", cmp.restored === cmp.nHp);

console.log("===== ⑤ dropEndlessExp：非深渊零掉落 =====");
const nonAbyss = run(`(function(){
  var w = { kind: "main", pickups: [], monsters: [] };
  G.inEndless = false;
  var m = { d: { exp: 5, type: "melee" }, isElite: false, x: 0, y: 0 };
  var n = dropEndlessExp(w, m);
  return { n: n, pickups: w.pickups.length };
})()`);
check("⑤ 非深渊掉落枚数 = 0", nonAbyss.n === 0);
check("⑤ 非深渊不产生拾取物", nonAbyss.pickups === 0);

console.log("===== ⑥ dropEndlessExp：深渊掉落 + 枚数分档（小怪1/精英3/Boss5） =====");
/* 21.19 起深渊击杀同时掉经验 + 金币（各 n 枚，同分档）→ 断言按 type 分开数 */
const abyssDrop = run(`(function(){
  G.inEndless = true;
  function mk(type, isElite) {
    var w = { kind: "endless", pickups: [] };
    var m = { d: { exp: 6, coin: 4, type: type }, isElite: !!isElite, x: 10, y: 10 };
    var n = dropEndlessExp(w, m);
    return { n: n,
             expCnt: w.pickups.filter(function(p){ return p.type === "exp"; }).length,
             coinCnt: w.pickups.filter(function(p){ return p.type === "coin"; }).length,
             type: w.pickups[0] && w.pickups[0].type,
             val: w.pickups[0] && w.pickups[0].value };
  }
  return { normal: mk("melee", false), elite: mk("melee", true), boss: mk("boss", false) };
})()`);
check("⑥ 深渊小怪掉 1 枚", abyssDrop.normal.n === 1);
check("⑥ 深渊精英掉 3 枚", abyssDrop.elite.n === 3);
check("⑥ 深渊 Boss 掉 5 枚", abyssDrop.boss.n === 5);
check("⑥ 掉落物 type 为 exp", abyssDrop.normal.type === "exp");
check("⑥ 掉落物 value 为正数（可被 gainExp 消费）", abyssDrop.normal.val > 0);
check("⑥ 经验拾取物数量与掉落枚数一致（小怪）", abyssDrop.normal.expCnt === 1);
check("⑥ 经验拾取物数量与掉落枚数一致（精英）", abyssDrop.elite.expCnt === 3);
check("⑥ 经验拾取物数量与掉落枚数一致（Boss）", abyssDrop.boss.expCnt === 5);
check("⑥ 金币拾取物与经验同分档（小怪）", abyssDrop.normal.coinCnt === 1);
check("⑥ 金币拾取物与经验同分档（精英）", abyssDrop.elite.coinCnt === 3);
check("⑥ 金币拾取物与经验同分档（Boss）", abyssDrop.boss.coinCnt === 5);

console.log("===== ⑦ expMul 缩放生效 =====");
const scaled = run(`(function(){
  G.inEndless = true;
  var saved = CFG.endless.expMul;
  function drop(mul) {
    CFG.endless.expMul = mul;
    var w = { kind: "endless", pickups: [] };
    var m = { d: { exp: 10, coin: 2, type: "melee" }, isElite: false, x: 0, y: 0 };
    dropEndlessExp(w, m);
    /* 21.19 起拾取物含金币 → 只统计 exp 类型 */
    return w.pickups.filter(function(p) { return p.type === "exp"; })
      .reduce(function(a, p) { return a + p.value; }, 0);
  }
  var v0 = drop(0.5), v1 = drop(1.0), v2 = drop(2.0);
  CFG.endless.expMul = saved;   // 还原，避免污染后续
  return { v0: v0, v1: v1, v2: v2, saved: saved };
})()`);
check("⑦ expMul=1.0 时总经验 = 10", scaled.v1 === 10);
check("⑦ expMul=2.0 时总经验 > expMul=1.0 时", scaled.v2 > scaled.v1);
check("⑦ expMul=0.5 时总经验 < expMul=1.0 时", scaled.v0 < scaled.v1);
check("⑦ 测试后 expMul 已还原", run('CFG.endless.expMul') === scaled.saved);

console.log("===== ⑧ 击杀链路集成：onMonsterKilled 在深渊确实触发经验掉落 =====");
const killChain = run(`(function(){
  G.inEndless = true;
  if (!G.run) { G.heroDef = CFG.heroes[0]; G.run = createRun(CFG.heroes[0]); G.player = new Player(100,100); }
  var w = { kind: "endless", isMain: false, pickups: [], monsters: [], playerBullets: [], enemyBullets: [], altars: [], groundChests: [] };
  var m = { d: { exp: 4, type: "melee", coin: 2, name: "测试怪" }, isElite: false, x: 50, y: 50, hp: 1, dead: false };
  var before = w.pickups.length;
  try { onMonsterKilled(w, m); } catch (e) { return { err: (e && e.message) || "throw" }; }
  return { before: before, after: w.pickups.length,
           expPickups: w.pickups.filter(function(p){ return p.type === "exp"; }).length };
})()`);
check("⑧ onMonsterKilled 在深渊不抛异常", !killChain.err);
check("⑧ 击杀后产生了拾取物", !killChain.err && killChain.after > killChain.before);
check("⑧ 其中包含 exp 类型拾取物", !killChain.err && killChain.expPickups > 0);

console.log("===== ⑨ 强化后生存能力提升（数值回归断言） =====");
const survive = run(`(function(){
  if (!G.run) { G.heroDef = CFG.heroes[0]; G.run = createRun(CFG.heroes[0]); G.player = new Player(100,100); }
  G.inEndless = false; var base = computeStats();
  G.inEndless = true;  var buff = computeStats();
  G.inEndless = false;
  return { baseHp: base.hpMax, buffHp: buff.hpMax, baseDef: base.def, buffDef: buff.def };
})()`);
check("⑨ 进深渊后血量上限 ≥ 基础的 3 倍（给足反应时间）", survive.buffHp >= survive.baseHp * 3);
check("⑨ 进深渊后防御 > 基础防御", survive.buffDef > survive.baseDef);

console.log("----------------------------------------");
/* ⚠️ 坑 4：门禁用 grep -ci "Assertion failed|FAIL|Error" 判定 bad，故汇总行**不能出现英文 FAIL**
 * （写成「失败 = N」而非「FAIL = N」）。 */
console.log("PASS 合计 = " + passCount + "  失败 = " + failCount);
if (failCount > 0) { console.log("GROWTH TEST 存在问题"); process.exit(1); }
console.log("GROWTH TEST OK");
