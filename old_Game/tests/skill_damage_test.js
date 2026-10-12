/* 无头测试：W3a js/skill-damage.js（DamageResolver）
 * 运行：node skill_damage_test.js   （或 bash run_tests.sh --suite=skill）
 * 覆盖：五类命中额度 / 对象池复用无污染 / 持续区域积分 / 暴击口径 / 原始基准派生 / 边界拒绝。
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
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

/* ---- 沙箱：只补 console，其余标准内建由 vm 上下文自带 ---- */
const sandbox = { console: { log: console.log.bind(console) } };
const ctx = vm.createContext(sandbox);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", rel), "utf8"), ctx, { filename: rel });
}
load("js/config.js");        // CFG（含 CFG.skillSystem 骨架）
load("js/skill-config.js");  // SKILL_REASON（原因码真源）
load("js/skill-damage.js");  // 被测模块

sandbox.__test = function (SD) {
  /* ============ 一、五类命中额度 ============ */
  // 主飞行弹：一次施放一次（castId + 主直击组 + targetId）
  var st = SD.newHitState();
  SD.beginCast(st, "c1");
  var r1 = SD.applyHitPolicy(st, { type: "main", castId: "c1", groupId: "N1", targetId: 5 }, 0);
  var r2 = SD.applyHitPolicy(st, { type: "main", castId: "c1", groupId: "N1", targetId: 5 }, 0);
  var r3 = SD.applyHitPolicy(st, { type: "main", castId: "c1", groupId: "N1", targetId: 6 }, 0);
  check("主弹: 首次同目标允许", r1.allowed === true && r1.reason === null);
  check("主弹: 同施放同目标第二次拒绝（TARGET_ALREADY_HIT）", r2.allowed === false && r2.reason === "TARGET_ALREADY_HIT");
  check("主弹: 同施放不同目标允许", r3.allowed === true);
  check("主弹: 额度键 = castId+直击组+targetId", st.main["c1|main|N1|5"] !== undefined && st.main["c1|main|N1|6"] !== undefined);

  // 分裂子弹：出生目标排除（castId + 派生模板组 + targetId）
  var ss = SD.newHitState(); SD.beginCast(ss, "c2");
  var sBorn = SD.applyHitPolicy(ss, { type: "split", castId: "c2", groupId: "S1", targetId: 7, excludeTargetId: 7 }, 0);
  var sOther = SD.applyHitPolicy(ss, { type: "split", castId: "c2", groupId: "S1", targetId: 8, excludeTargetId: 7 }, 0);
  var sOther2 = SD.applyHitPolicy(ss, { type: "split", castId: "c2", groupId: "S1", targetId: 8, excludeTargetId: 7 }, 0);
  check("分裂: 出生目标被排除", sBorn.allowed === false);
  check("分裂: 非出生目标首次允许", sOther.allowed === true);
  check("分裂: 非出生目标第二次拒绝", sOther2.allowed === false && sOther2.reason === "TARGET_ALREADY_HIT");

  // 爆炸：可与直击各一次（castId + 爆炸模板组 + targetId）
  var se = SD.newHitState(); SD.beginCast(se, "c3");
  var e1 = SD.applyHitPolicy(se, { type: "explode", castId: "c3", groupId: "E1", targetId: 5 }, 0);
  var e2 = SD.applyHitPolicy(se, { type: "explode", castId: "c3", groupId: "E1", targetId: 5 }, 0);
  var m1 = SD.applyHitPolicy(se, { type: "main", castId: "c3", groupId: "N1", targetId: 5 }, 0);
  check("爆炸: 首次允许", e1.allowed === true);
  check("爆炸: 同模板同目标第二次拒绝", e2.allowed === false && e2.reason === "TARGET_ALREADY_HIT");
  check("爆炸: 可与直击各结算一次（直击仍允许）", m1.allowed === true);

  // 环绕：ownerId + skillId + 接触模板组 + targetId，共享 nextAllowedHitTime
  var so = SD.newHitState(); SD.beginCast(so, "c4");
  var orbKey = { type: "orbit", ownerId: "h1", skillId: "SK_ORB", groupId: "O1", targetId: 9, interval: 0.35, castId: "c4" };
  var o1 = SD.applyHitPolicy(so, orbKey, 0);
  var o2 = SD.applyHitPolicy(so, orbKey, 0.1);
  var o3 = SD.applyHitPolicy(so, orbKey, 0.35);
  check("环绕: 首次允许", o1.allowed === true);
  check("环绕: 间隔内拒绝（共享 nextAllowedHitTime）", o2.allowed === false && o2.reason === "TARGET_ALREADY_HIT");
  check("环绕: 间隔到点后允许", o3.allowed === true);
  var o4 = SD.applyHitPolicy(so, { type: "orbit", ownerId: "h1", skillId: "SK_ORB", groupId: "O1", targetId: 9, interval: 0.35, castId: "c5" }, 0.5);
  check("环绕: 多枚环绕体共享间隔（换批仍被 0.5s 间隔拒绝）", o4.allowed === false);

  // 持续区域：ownerId + skillId + 区域模板组，对该目标取有效最高 DPS
  var sr = SD.newHitState(); SD.beginCast(sr, "c6");
  var g1 = SD.applyHitPolicy(sr, { type: "region", ownerId: "h1", skillId: "SK_FIRE", groupId: "R1", targetId: 10, dps: 10, castId: "c6" }, 0);
  var g2 = SD.applyHitPolicy(sr, { type: "region", ownerId: "h1", skillId: "SK_FIRE", groupId: "R1", targetId: 10, dps: 20, castId: "c6" }, 0);
  var g3 = SD.applyHitPolicy(sr, { type: "region", ownerId: "h1", skillId: "SK_FIRE", groupId: "R1", targetId: 10, dps: 5, castId: "c6" }, 0);
  var best = sr.region["region|h1|SK_FIRE|R1|10"].bestDps;
  check("持续区域: 首个允许", g1.allowed === true);
  check("持续区域: 更高 DPS 取代为最高", g2.allowed === true && approx(best, 20));
  check("持续区域: 较低 DPS 被拒（REGION_MAX_DPS）且最高不变",
    g3.allowed === false && g3.reason === "REGION_MAX_DPS" && approx(best, 20));

  /* ============ 二、对象池复用无污染（稳定 id 非引用） ============ */
  var sp = SD.newHitState();
  SD.beginCast(sp, "k1");
  var p1 = SD.applyHitPolicy(sp, { type: "main", castId: "k1", groupId: "N1", targetId: 5 }, 0);
  var rel = SD.endCast(sp, "k1");
  check("对象池: endCast 释放该施放登记键", rel.released === 1 && sp.main["k1|main|N1|5"] === undefined);
  SD.beginCast(sp, "k2");
  var pooledTarget = { id: 5, hp: 100, dead: false };  // 池复用：新对象、同稳定 id
  var p2 = SD.applyHitPolicy(sp, { type: "main", castId: "k2", groupId: "N1", targetId: pooledTarget.id }, 0);
  check("对象池: 复用后同 id 的新施放不再被旧额度拦截", p1.allowed === true && p2.allowed === true);
  check("对象池: 同施放内同 id 仍去重（稳定 id 判定，非对象引用）",
    SD.applyHitPolicy(sp, { type: "main", castId: "k2", groupId: "N1", targetId: 5 }, 0).allowed === false);

  /* ============ 三、持续区域积分（模拟时间） ============ */
  var ir1 = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0, duration: 0.25 }, 0, 0.25);
  check("区域积分: 单 tick 精确", ir1.ticks === 1 && approx(ir1.damage, 25));
  var ir2 = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0, duration: 1.0 }, 0, 1.0);
  check("区域积分: 跨多 tick", ir2.ticks === 4 && approx(ir2.damage, 100));
  var ir3 = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0, duration: 0.4 }, 0, 1.0);
  check("区域积分: 结束补齐不足一 tick 的余量（0.4s→2 批/40 伤害）", ir3.ticks === 2 && approx(ir3.damage, 40));
  var irA = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0.0, duration: 10 }, 0, 1.0);
  var irB = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0.05, duration: 10 }, 0, 1.0);
  check("区域积分: 错开出生不额外叠 tick（0.95s→95 而非 100）",
    approx(irA.damage, 100) && approx(irB.damage, 95) && irB.ticks === 4);
  var ir0 = SD.integrateRegion({ dps: 100, tick: 0.25, startTime: 0, duration: 0.25 }, 1.0, 2.0);
  check("区域积分: 有效窗口外零结算", ir0.ticks === 0 && ir0.damage === 0);
  var ir4 = SD.integrateRegion({ dps: 50, tick: 0.5, startTime: 0, endTime: 0.6 }, 0, 5.0);
  check("区域积分: 结束时间封顶（有效 0.6s→30）", approx(ir4.damage, 30));

  /* ============ 四、暴击口径（DoT 不暴击 / 瞬时独立） ============ */
  var mk = function (hp) { return { id: 1, hp: hp, dead: false, d: { def: 0 } }; };
  var dot = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: 100, isDoT: true, critMul: 5 } });
  check("持续伤害默认不暴击（100 而非 500）", dot.applied === true && approx(dot.amount, 100));
  var inst1 = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: 100, critMul: 1 } });
  var inst2 = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: 100, critMul: 2 } });
  check("瞬时命中每次独立暴击（1× 与 2× 各结算）",
    approx(inst1.amount, 100) && approx(inst2.amount, 200));

  /* ============ 五、伤害公式与原始基准派生 ============ */
  var parent = SD.buildBasis(100, 1, 1);
  parent.increased = 0.5;                       // 父节点匹配外部 Increased 总和
  var pr = SD.resolve({}, { target: mk(100000), damageBasis: parent });
  check("父节点最终伤害含外部加成（100×1.5=150）", approx(pr.amount, 150));
  var child = SD.buildBasis(parent.baseRef, 1, 0.5);   // 派生：原始基准 100 × 派生比例 0.5
  var cr = SD.resolve({}, { target: mk(100000), damageBasis: child });
  check("派生用原始基准（100×0.5=50，不是 150×0.5=75）", approx(cr.amount, 50));
  check("buildBasis 纯函数字段", child.baseRef === 100 && child.coefficient === 1 && child.derivedRatio === 0.5);
  var more = SD.buildBasis(100, 1, 1); more.mores = [1.5, 2]; more.coefficient = 2;
  var mr = SD.resolve({}, { target: mk(100000), damageBasis: more });
  check("形态系数与独立 More 相乘（100×2×1.5×2=600）", approx(mr.amount, 600));

  /* ============ 六、边界拒绝 ============ */
  var zero = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: 0 } });
  check("0 伤害被拒（NO_GAIN）", zero.applied === false && zero.reason === "NO_GAIN");
  var nan1 = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: NaN } });
  check("NaN 基准被拒（INVALID_REFERENCE）", nan1.applied === false && nan1.reason === "INVALID_REFERENCE");
  var nan2 = SD.resolve({}, { target: mk(100000), damageBasis: { baseRef: 100, coefficient: NaN } });
  check("NaN 系数被拒（INVALID_REFERENCE）", nan2.applied === false && nan2.reason === "INVALID_REFERENCE");
  var noreq = SD.resolve({}, null);
  check("空请求被拒（INVALID_REFERENCE）", noreq.applied === false && noreq.reason === "INVALID_REFERENCE");
  var deadT = mk(100000); deadT.dead = true;
  var dead2 = SD.resolve({}, { target: deadT, damageBasis: { baseRef: 100 } });
  check("已死目标被拒（TARGET_ALREADY_HIT）", dead2.applied === false && dead2.reason === "TARGET_ALREADY_HIT");

  /* ============ 七、resolve × hitState 端到端 ============ */
  var endState = SD.newHitState();
  SD.beginCast(endState, "cc");
  var t5 = { id: 5, hp: 100000, dead: false };
  var reqA = SD.damageRequest({ target: t5, damageBasis: SD.buildBasis(100, 1, 1), castId: "cc",
    nodeId: "N1", hitPolicyId: "HP_MAIN_BOLT", hitState: endState, simTime: 0 });
  var ra = SD.resolve({}, reqA);
  var rb = SD.resolve({}, reqA);
  check("resolve+额度: 首次命中结算", ra.applied === true && approx(ra.amount, 100));
  check("resolve+额度: 同施放同目标第二次被拒", rb.applied === false && rb.reason === "TARGET_ALREADY_HIT");
  check("resolve+额度: 额度已写入 hitState", endState.main["cc|main|N1|5"] !== undefined);
  check("hitPolicyId 无策略时保守默认 main", SD.policyType("HP_UNKNOWN") === "main");

  var tk = { id: 6, hp: 10, dead: false };
  var rk = SD.resolve({}, { target: tk, damageBasis: SD.buildBasis(100, 1, 1) });
  check("击杀判定：血量归零即 dead", rk.killed === true && tk.dead === true && approx(rk.amount, 100));

  var dr = SD.damageRequest({ target: t5, damageBasis: child, castId: "cc", nodeId: "N9" });
  check("damageRequest 便捷构造字段", dr.castId === "cc" && dr.nodeId === "N9" && dr.groupId === "N9" && dr.damageBasis === child);
};

vm.runInContext("__test(SkillDamage);", ctx, { filename: "driver" });

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw "skill_damage_test 存在失败用例";
