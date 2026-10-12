/* 无头测试：W3a js/skill-events.js（SkillEventRouter）
 * 运行：node skill_events_test.js   （或 bash run_tests.sh --suite=skill）
 * 覆盖：稳定序号消费 / 深度·次数·预算护栏与原因码 / 无界路由被拒 / 结束原因白名单 /
 *       每实例命中与消失各一次 / 默认派生不触发事件水晶。
 * 注意（血泪坑）：字符串驱动内禁用反引号模板；PASS 文案不含英文 error/Error。 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

const sandbox = { console: { log: console.log.bind(console) } };
const ctx = vm.createContext(sandbox);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", rel), "utf8"), ctx, { filename: rel });
}
load("js/config.js");        // CFG（含 CFG.skillSystem 骨架）
load("js/skill-config.js");  // SKILL_REASON（原因码真源）
load("js/skill-events.js");  // 被测模块

sandbox.__test = function (SE, CFG) {
  var t = CFG.skillSystem;
  var origDerived = t.features.derivedEvents;
  var origMaxStep = t.budgets.maxEventPerStep;
  var origMaxDepth = t.budgets.maxEventDepth;
  var maxDepth = (typeof t.budgets.maxEventDepth === "number") ? t.budgets.maxEventDepth : 2;

  /* ============ 一、入队 → drain 稳定序号 ============ */
  var w = {};
  var a1 = SE.enqueue(w, { castId: "c1", operationId: "OP_A" });
  var a2 = SE.enqueue(w, { castId: "c1", operationId: "OP_B" });
  var a3 = SE.enqueue(w, { castId: "c1", operationId: "OP_C" });
  check("入队分配稳定递增序号", a1.eventId === 1 && a2.eventId === 2 && a3.eventId === 3);
  var q = w._skillEvents.queue;
  check("队列按稳定序号顺序（FIFO）",
    q.length === 3 && q[0].eventId === 1 && q[1].eventId === 2 && q[2].eventId === 3);
  var d1 = SE.drain(w);
  check("drain 按序消费全部（processed=3）", d1.processed === 3 && w._skillEvents.queue.length === 0);

  /* ============ 二、深度 / 次数 / 预算超限与原因码 ============ */
  var w2 = {};
  var deep = SE.enqueue(w2, { castId: "c", operationId: "OP", depth: maxDepth + 1 });
  check("深度超限被拒（DERIVED_DEPTH_EXCEEDED）",
    deep.accepted === false && deep.reason === "DERIVED_DEPTH_EXCEEDED");

  t.eventPolicies["OP_LIMIT"] = { perCastBudget: 2, maxCount: 1, maxDepth: maxDepth };
  var w3 = {};
  SE.beginCast(w3, "cx");
  var b1 = SE.enqueue(w3, { castId: "cx", operationId: "OP_LIMIT", effectId: "e1" });
  var b2 = SE.enqueue(w3, { castId: "cx", operationId: "OP_LIMIT", effectId: "e2" });
  var b3 = SE.enqueue(w3, { castId: "cx", operationId: "OP_LIMIT", effectId: "e3" });
  check("每施放预算: 前 2 个接受", b1.accepted === true && b2.accepted === true);
  check("每施放预算: 第 3 个被拒（EVENT_BUDGET_EXCEEDED）",
    b3.accepted === false && b3.reason === "EVENT_BUDGET_EXCEEDED");
  SE.beginCast(w3, "cx");
  var b4 = SE.enqueue(w3, { castId: "cx", operationId: "OP_LIMIT", effectId: "e4" });
  check("每施放预算: beginCast 重置后可再入队", b4.accepted === true);

  t.budgets.maxEventPerStep = 2;
  var w4 = {};
  var c1 = SE.enqueue(w4, { castId: "q", operationId: "OP", effectId: "q1" });
  var c2 = SE.enqueue(w4, { castId: "q", operationId: "OP", effectId: "q2" });
  var c3 = SE.enqueue(w4, { castId: "q", operationId: "OP", effectId: "q3" });
  check("队列/步预算达上限后拒绝（BUDGET_EXCEEDED）",
    c1.accepted === true && c2.accepted === true && c3.accepted === false && c3.reason === "BUDGET_EXCEEDED");
  t.budgets.maxEventPerStep = origMaxStep;

  /* ============ 三、无界路由被拒（长链 / 自环） ============ */
  t.features.derivedEvents = true;
  t.eventPolicies["OP_LOOP"] = { maxCount: 1, maxDepth: maxDepth };
  var w5 = {};
  var depth = 0, derivedTotal = 0, hitLimit = false, guard = 0;
  while (guard++ < 10) {
    var en = SE.enqueue(w5, { castId: "loop", operationId: "OP_LOOP", effectId: "L" + depth,
      endReason: "NATURAL_HIT", depth: depth });
    if (!en.accepted) { hitLimit = (en.reason === "DERIVED_DEPTH_EXCEEDED"); break; }
    var drx = SE.drain(w5);
    if (drx.derivedCount === 0) {
      hitLimit = drx.errors.some(function (e) { return e.reason === "DERIVED_DEPTH_EXCEEDED"; });
      break;
    }
    derivedTotal += drx.derivedCount;
    depth = drx.derived[0].depth;
  }
  check("无界路由: 长链在深度护栏内终止", hitLimit === true && guard <= 6 && derivedTotal < 10);

  var w6 = {};
  SE.beginCast(w6, "self");
  var iter = 0, produced = 0;
  for (var i = 0; i < 50; i++) {
    var en2 = SE.enqueue(w6, { castId: "self", operationId: "OP_LOOP", effectId: "S" + i,
      endReason: "LIFETIME", depth: (i < maxDepth ? i : maxDepth) });
    if (!en2.accepted) break;
    var dr2 = SE.drain(w6);
    produced += dr2.derivedCount;
    iter++;
    if (dr2.derivedCount === 0) break;
  }
  check("无界路由: 自环不会无限（有界终止）", iter < 50 && produced <= maxDepth + 1);

  /* ============ 四、结束原因白名单（可派生 / 不可派生） ============ */
  t.features.derivedEvents = false;   // 主效果默认即可触发，不受该开关影响
  var derivable = ["NATURAL_HIT", "LIFETIME", "DISTANCE"];
  var nonDerivable = ["BATCH_REPLACE", "SCENE_CLEANUP", "LEAVE_MATCH", "FORCE_RECYCLE"];
  var okDerive = true, okNo = true;
  derivable.forEach(function (er, k) {
    var wd = {};
    SE.beginCast(wd, "d" + k);
    SE.enqueue(wd, { castId: "d" + k, operationId: "OP_D", effectId: "D" + k, endReason: er, depth: 0 });
    if (SE.drain(wd).derivedCount < 1) okDerive = false;
  });
  nonDerivable.forEach(function (er, k) {
    var wn = {};
    SE.beginCast(wn, "n" + k);
    SE.enqueue(wn, { castId: "n" + k, operationId: "OP_D", effectId: "N" + k, endReason: er, depth: 0 });
    if (SE.drain(wn).derivedCount !== 0) okNo = false;
  });
  check("可派生结束原因（自然命中/寿命/距离）可派生", okDerive === true);
  check("不可派生结束原因（批次替换/场景清理/离局/强制回收）不派生", okNo === true);

  /* ============ 五、每实例命中与消失各只发一次 ============ */
  var w7 = {};
  var h1 = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E1", eventType: "hit" });
  var h2 = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E1", eventType: "hit" });
  var v1 = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E2", eventType: "vanish", endReason: "LIFETIME" });
  var v2 = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E2", eventType: "vanish", endReason: "LIFETIME" });
  var hv = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E3", eventType: "hit" });
  var vv = SE.enqueue(w7, { castId: "f", operationId: "OP", effectId: "E3", eventType: "vanish", endReason: "LIFETIME" });
  check("每实例首次命中只发一次（重复 ALREADY_COMMITTED）",
    h1.accepted === true && h2.accepted === false && h2.reason === "ALREADY_COMMITTED");
  check("每实例消失只发一次（重复 ALREADY_COMMITTED）",
    v1.accepted === true && v2.accepted === false && v2.reason === "ALREADY_COMMITTED");
  check("同实例的命中与消失各一次（互不冲突）", hv.accepted === true && vv.accepted === true);

  /* ============ 六、默认派生不触发事件水晶 ============ */
  t.features.derivedEvents = false;
  var w8 = {};
  SE.beginCast(w8, "p");
  SE.enqueue(w8, { castId: "p", operationId: "OP_P", effectId: "P1", endReason: "NATURAL_HIT", depth: 1 });
  check("默认派生不触发事件水晶（depth>0 不派生）", SE.drain(w8).derivedCount === 0);

  var w9 = {};
  SE.beginCast(w9, "p2");
  SE.enqueue(w9, { castId: "p2", operationId: "OP_P", effectId: "P2", endReason: "NATURAL_HIT", depth: 0 });
  check("主效果（depth 0）默认可触发事件水晶", SE.drain(w9).derivedCount >= 1);

  t.features.derivedEvents = true;
  var w10 = {};
  SE.beginCast(w10, "p3");
  SE.enqueue(w10, { castId: "p3", operationId: "OP_P", effectId: "P3", endReason: "NATURAL_HIT", depth: 1 });
  var dd = SE.drain(w10);
  check("打开 derivedEvents 后派生可再派生（有界，depth+1）",
    dd.derivedCount >= 1 && dd.derived[0].depth === 2);
  t.features.derivedEvents = false;

  /* ============ 七、无效事件与步重置 ============ */
  var w11 = {};
  var bad = SE.enqueue(w11, null);
  check("空事件被拒（INVALID_REFERENCE）", bad.accepted === false && bad.reason === "INVALID_REFERENCE");
  var st0 = SE.resetStep(w11);
  check("resetStep 步计数递增且消费计数归零",
    typeof st0.step === "number" && st0.step >= 1 && w11._skillEvents.stepConsumed === 0);

  /* 恢复被测试改动的配置（同进程内不影响其它用例） */
  t.features.derivedEvents = origDerived;
  t.budgets.maxEventPerStep = origMaxStep;
  t.budgets.maxEventDepth = origMaxDepth;
};

vm.runInContext("__test(SkillEvents, CFG);", ctx, { filename: "driver" });

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw "skill_events_test 存在失败用例";
