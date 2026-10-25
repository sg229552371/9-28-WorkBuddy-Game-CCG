/* 无头测试：B1 / B2 数值落库守卫（技能整数锚点 + 战争雕像 Buff 锚点）
 * 运行：node skill_balance_anchors_test.js
 * 加载：vm 沙箱 js/config.js（config.js 自带 skillCurve / skillSteps / skillStepsAnchors / skillLevels）。
 * 依据：G_docs/balance_proposal_b1_b2_v0.1.md（用户已批准「全部落库」）。
 *
 * 覆盖四层：
 *   ① 锚点机制本身（skillStepsAnchors 的取整 / 端点 / 区间 / 不外推 / 小数口径）
 *   ② 旧两点写法零回归（skillLevels 数组入参仍走 skillSteps）
 *   ③ B1 八技能的**源码级结构守卫**（必须是 4 行锚点 {1,25,60,100} 的对象写法，
 *      而不是两点数组 —— 否则「落库」会悄悄退化成两条端点直线）
 *   ④ B1/B2 行为断言：LV1 基线不得漂移、LV100 达到提案目标、单调性、Buff maxLv 收口
 *
 * 注意：PASS 文案禁用英文 FAIL / Error 字样（run_tests.sh 以 grep 计 bad）。
 *       vm 驱动内**禁用反引号模板**（项目血泪坑）。
 */
"use strict";

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext({ console: console });
vm.runInContext(fs.readFileSync("js/config.js", "utf8"), ctx, { filename: "js/config.js" });
/* 源码文本注入（用于结构守卫）：const 绑定不进 context 对象，故由宿主侧读文件后挂到 context。 */
ctx.__SRC = fs.readFileSync("js/config.js", "utf8");

const driver = [
  "var __pass = 0, __fail = 0;",
  "function check(name, cond) {",
  "  if (cond) { __pass++; console.log('PASS ' + name); }",
  "  else { __fail++; console.log('FAIL ' + name); }",
  "}",

  "/* ================= 1. 锚点插值机制 ================= */",
  "// 1.0 全整数锚点 → 向下取整（{1:1, 50:2} 在 lv25 线性值 1.5 → 1）",
  "var a1 = skillStepsAnchors(SKILL_LEVEL_MAX, { 1: 1, 50: 2 });",
  "check('1.0 整数锚点向下取整（lv25 → floor(1.5) = 1）', a1[24] === 1);",
  "check('1.1 锚点端点锁定：lv1 = 首锚点', a1[0] === 1);",
  "check('1.2 尾部区段线性（lv50 = 2，lv100 不外推 = 2）', a1[49] === 2 && a1[99] === 2);",
  "// 1.3 区间内线性：{1:0, 11:10} 在 lv6 → 5",
  "var a2 = skillStepsAnchors(SKILL_LEVEL_MAX, { 1: 0, 11: 10 });",
  "check('1.3 区间内线性插值（lv6 → 5）', a2[5] === 5);",
  "check('1.4 超末锚点的等级取末值、不外推', skillStepsAnchors(12, { 1: 1, 10: 5 })[11] === 5);",
  "// 1.5 真·小数锚点 → 保留两位小数",
  "var a3 = skillStepsAnchors(10, { 1: 1.0, 10: 2.5 });",
  "check('1.5 含小数锚点保留两位（lv6 = 1 + 1.5×5/9 → 1.83）', a3[5] === 1.83);",
  "// 1.5b 陷阱：1.0 / 2.0 在 JS 里 **仍是整数** → 必须走 floor 而非两位小数",
  "var a3i = skillStepsAnchors(10, { 1: 1.0, 10: 2.0 });",
  "check('1.5b 整数锚点（含写成 1.0/2.0 的）按整数口径向下取整（lv6 → 1）', a3i[5] === 1 && Number.isInteger(1.0));",
  "// 1.6 空表不抛异常、全 0",
  "var a4 = skillStepsAnchors(5, {});",
  "check('1.6 空锚点表 → 长度 5 全 0，且不抛异常', a4.length === 5 && a4.every(function (v) { return v === 0; }));",
  "// 1.7 与 js/items.js 的 anchorLerp 同口径（此处按同规则独立复算，避免加载含 DOM 依赖的 items.js）",
  "function refLerp(table, lv) {",
  "  var ks = Object.keys(table).map(Number).sort(function (p, q) { return p - q; });",
  "  var allInt = ks.every(function (k) { return Number.isInteger(table[k]); });",
  "  var rnd = function (v) { return allInt ? Math.floor(v) : Math.round(v * 100) / 100; };",
  "  if (lv <= ks[0]) return rnd(table[ks[0]]);",
  "  var last = ks[ks.length - 1];",
  "  if (lv >= last) return rnd(table[last]);",
  "  for (var i = 0; i < ks.length - 1; i++) {",
  "    var x = ks[i], y = ks[i + 1];",
  "    if (lv >= x && lv <= y) return rnd(table[x] + (table[y] - table[x]) * (lv - x) / (y - x));",
  "  }",
  "  return rnd(table[last]);",
  "}",
  "var tbl = { 1: 3, 25: 4, 60: 5, 100: 6 };",
  "var curve = skillStepsAnchors(SKILL_LEVEL_MAX, tbl);",
  "var same = true;",
  "for (var lv = 1; lv <= SKILL_LEVEL_MAX; lv++) { if (curve[lv - 1] !== refLerp(tbl, lv)) { same = false; break; } }",
  "check('1.7 与 anchorLerp 同口径：100 个等级全部逐值一致', same);",

  "/* ================= 2. 旧两点写法零回归 ================= */",
  "var c2 = skillLevels(SKILL_LEVEL_MAX, null, null, { count: [3, 6] });",
  "check('2.0 数组入参仍走旧两点线性（lv1 = 3 / lv100 = 6）', c2[0].parameters.count === 3 && c2[99].parameters.count === 6);",
  "var ref = skillSteps(SKILL_LEVEL_MAX, 3, 6);",
  "var eq = true;",
  "for (var k = 0; k < SKILL_LEVEL_MAX; k++) { if (c2[k].parameters.count !== ref[k]) { eq = false; break; } }",
  "check('2.1 数组入参与 skillSteps 逐值一致（行为未变）', eq);",
  "check('2.2 施放层字段不受整数项改动影响（cooldown / castTime 仍来自 cast 参数）',",
  "  (function () { var x = skillLevels(SKILL_LEVEL_MAX, { cooldown: [2, 1], castTime: [0.2, 0.1] }, null, { count: { 1: 1, 100: 2 } });",
  "    return x[0].cooldown === 2 && x[0].castTime === 0.2 && x[99].cooldown === 1 && x[99].castTime === 0.1; })());",

  "/* ================= 3. B1 源码级结构守卫（必须是 4 行锚点对象） ================= */",
  "var SRC = __SRC;",
  "function anchorKeysOf(sid, key) {",
  "  var i = SRC.indexOf(sid + ': {');",
  "  if (i < 0) return null;",
  "  var j = SRC.indexOf('\\n    SK_', i + 1);",
  "  var blk = SRC.slice(i, j < 0 ? SRC.length : j);",
  "  var m = blk.match(new RegExp('\\\\{\\\\s*' + key + ':\\\\s*\\\\{([^}]*)\\\\}'));",
  "  return m ? m[1] : null;",
  "}",
  "var B1 = [",
  "  ['SK_FIREBALL', 'count', 1, 1],",
  "  ['SK_SCATTER', 'count', 3, 6],",
  "  ['SK_RAILGUN', 'extraPierceCount', 2, 5],",
  "  ['SK_RINGBARRAGE', 'count', 8, 12],",
  "  ['SK_VOLLEY', 'count', 3, 6],",
  "  ['SK_SIEGEBLAST', 'count', 1, 1],",
  "  ['SK_DRONESWARM', 'count', 3, 6],",
  "  ['SK_MINEFIELD', 'trapCount', 1, 3]",
  "];",
  "for (var bi = 0; bi < B1.length; bi++) {",
  "  var sid = B1[bi][0], key = B1[bi][1];",
  "  var keys = anchorKeysOf(sid, key);",
  "  var ok = !!keys && /(^|,)\\s*1\\s*:/.test(keys) && /(^|,)\\s*25\\s*:/.test(keys) &&",
  "           /(^|,)\\s*60\\s*:/.test(keys) && /(^|,)\\s*100\\s*:/.test(keys);",
  "  check('3.' + bi + ' 源码级：' + sid + '.' + key + ' 为 4 行锚点 {1,25,60,100} 对象写法', ok);",
  "}",

  "/* ================= 4. B1 行为：LV1 基线不漂移 + LV100 达目标 + 单调 ================= */",
  "function lvCurve(sid, key) {",
  "  var def = CFG.skillSystem.skillDefs[sid];",
  "  if (!def || !Array.isArray(def.levels)) return null;",
  "  var out = [];",
  "  for (var i = 0; i < def.levels.length; i++) { out.push(def.levels[i].parameters[key]); }",
  "  return out;",
  "}",
  "for (var bj = 0; bj < B1.length; bj++) {",
  "  var s2 = B1[bj][0], k2 = B1[bj][1], lo = B1[bj][2], hi = B1[bj][3];",
  "  var cv = lvCurve(s2, k2);",
  "  check('4.' + bj + 'a ' + s2 + '.' + k2 + ' LV1 = ' + lo + '（迁移基线不漂移）', !!cv && cv[0] === lo);",
  "  check('4.' + bj + 'b ' + s2 + '.' + k2 + ' LV100 = ' + hi + '（落库目标值）', !!cv && cv[cv.length - 1] === hi);",
  "}",
  "var monoBad = [];",
  "for (var bk = 0; bk < B1.length; bk++) {",
  "  var cvm = lvCurve(B1[bk][0], B1[bk][1]);",
  "  for (var mi = 1; mi < cvm.length; mi++) {",
  "    if (cvm[mi] < cvm[mi - 1]) { monoBad.push(B1[bk][0]); break; }",
  "  }",
  "}",
  "check('4.m 八技能的整数曲线全部单调不减（无回落）', monoBad.length === 0);",
  "check('4.n 陷阱数确实随等级成长（LV1=1 → LV100=3，非静态值）',",
  "  (function () { var c = lvCurve('SK_MINEFIELD', 'trapCount'); return c[0] === 1 && c[99] === 3 && c[0] !== c[99]; })());",
  "check('4.o 召唤数确实随等级成长（LV1=3 → LV100=6）',",
  "  (function () { var c = lvCurve('SK_DRONESWARM', 'count'); return c[0] === 3 && c[99] === 6; })());",

  "/* ================= 5. B2：战争雕像 Buff 锚点与等级上限 ================= */",
  "var B2IDS = ['BF001', 'BF002', 'BF003', 'BF004'];",
  "for (var ci = 0; ci < B2IDS.length; ci++) {",
  "  var bid = B2IDS[ci];",
  "  var sk = CFG.skills[bid];",
  "  var ks2 = sk && sk.anchors && sk.anchors.mul ? Object.keys(sk.anchors.mul).map(Number).sort(function (p, q) { return p - q; }).join(',') : '';",
  "  check('5.' + ci + 'a ' + bid + ' 锚点等级 = 1,3,6,10（弃用不可达的 30/99）', ks2 === '1,3,6,10');",
  "  check('5.' + ci + 'b ' + bid + ' maxLv 收口到 10', sk && sk.maxLv === 10);",
  "}",
  "var wb = CFG.warBuffs || [];",
  "check('5.4 CFG.warBuffs 恰好派生 4 条（战争雕像池）', wb.length === 4);",
  "check('5.5 warBuffs 全组 maxLv = 10（叠级上限与配表一致）',",
  "  wb.length === 4 && wb.every(function (b) { return b.maxLv === 10; }));",
  "check('5.6 warBuffs 全组 stackable = true（重复触发仍叠等级）',",
  "  wb.length === 4 && wb.every(function (b) { return b.stackable === true; }));",
  "// 5.7 末锚点外不外推：LV1/3/6/10 各命中锚点值",
  "var m1 = CFG.skills.BF001.anchors.mul;",
  "var lm = refLerp(m1, 1), l3 = refLerp(m1, 3), l6 = refLerp(m1, 6), l10 = refLerp(m1, 10), l30 = refLerp(m1, 30);",
  "check('5.7 BF001 锚点命中：1.30 / 1.36 / 1.44 / 1.55', lm === 1.30 && l3 === 1.36 && l6 === 1.44 && l10 === 1.55);",
  "check('5.8 BF001 超末锚点等级（lv30）取末值 1.55，不外推', l30 === 1.55);",
  "var cd1 = refLerp(CFG.skills.BF002.anchors.mul, 1), cd10 = refLerp(CFG.skills.BF002.anchors.mul, 10);",
  "check('5.9 BF002（cdMul 越小越快）单调递减：lv1 = 0.70 > lv10 = 0.62', cd1 === 0.70 && cd10 === 0.62 && cd1 > cd10);",
  "check('5.10 BF004 吸血为加算通道（lv1 = 0.15 为小数，仍走锚点插值不被取整）',",
  "  CFG.skills.BF004.stat === 'lifesteal' && refLerp(CFG.skills.BF004.anchors.mul, 6) === 0.19);",
  "check('5.11 战争雕像池不含技能侧增益（pool=\"skill\" 的 BF005~007 未被吸入）',",
  "  wb.every(function (b) { return b.skillId !== 'BF005' && b.skillId !== 'BF006' && b.skillId !== 'BF007'; }));",

  "console.log('');",
  "console.log('PASS 合计 = ' + __pass + '   失败数 = ' + __fail);",
  "if (__fail > 0) throw new Error('skill_balance_anchors_test 存在失败用例');",
].join("\n");

vm.runInContext(driver, ctx, { filename: "driver:skill_balance_anchors" });
