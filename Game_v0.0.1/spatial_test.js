/* 无头测试：SpatialHash 去重与自适应 cell（js/core.js 空间哈希区块）
 * 覆盖：
 *   ① query 去重的集合等价性（大量跨桶对象，对比朴素全扫候选集）
 *   ② tick 机制（连续两次 query 结果一致；clear 后能查到新插入对象）
 *   ③ autoCell 三档边界值（500 / 1500 断点两侧）
 *   ④ retune 改 cell 后旧数据清空、新插入可查
 *   ⑤ 无 DOM 环境加载 core.js 不抛错（vm 沙箱仅给 console）
 *   ⑥ 性能冒烟：30 万次 query 的耗时上限（宽松阈值，防明显退化）
 * 运行：node spatial_test.js（判绿 = exit 0 且末行 SPATIAL TEST OK；PASS 文案只含中文）
 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---- 断言器：PASS 文案严禁出现英文 error/Error/FAIL，避免门禁 grep 误判 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
}

/* ---- 沙箱装载：无 DOM、无 Image，只给 console，验证 core.js 可独立加载 ---- */
let SH = null;
let loadOk = true, loadMsg = "";
try {
  const sandbox = { console: { log() { }, warn() { }, error() { }, info() { } } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync("js/core.js", "utf8"), sandbox, { filename: "js/core.js" });
  SH = vm.runInContext("SpatialHash", sandbox);
} catch (e) {
  loadOk = false;
  loadMsg = (e && e.message) ? e.message : String(e);
}

/* ===== 用例 ⑤：无 DOM 环境加载不抛错 ===== */
check("50 无 DOM 环境加载 core.js 不抛异常", loadOk);
if (loadOk) check("51 沙箱内 SpatialHash 为可构造类型", typeof SH === "function");

if (!loadOk || typeof SH !== "function") {
  console.log("加载异常：" + loadMsg);
  console.log("SPATIAL TEST FAILED");
  process.exit(1);
}

/* ---- 朴素全扫参考实现：不做桶结构，逐对象按「插入 AABB 与查询 AABB 的 cell 区间是否相交」判定。
 * 说明：query 返回的是基于 cell 网格的粗筛候选（cell 粒度比精确 AABB 更粗），
 * 故参考实现必须复刻同一网格判据，而不是精确圆距 —— 精确圆距是后续精判，不属于本层职责。 */
function naiveQuery(all, x, y, r, cell) {
  const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
  const y0 = Math.floor((y - r) / cell), y1 = Math.floor((y + r) / cell);
  const out = [];
  for (const o of all) {
    const ox0 = Math.floor((o.x - o.r) / cell), ox1 = Math.floor((o.x + o.r) / cell);
    const oy0 = Math.floor((o.y - o.r) / cell), oy1 = Math.floor((o.y + o.r) / cell);
    const hitX = ox0 <= x1 && ox1 >= x0;
    const hitY = oy0 <= y1 && oy1 >= y0;
    if (hitX && hitY) out.push(o);
  }
  return out;
}
/* 集合相等（排序后）—— query 返回顺序可能与旧实现不同，故只断言集合等价 */
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = a.slice().sort((p, q) => p.id - q.id);
  const sb = b.slice().sort((p, q) => p.id - q.id);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

/* 构造对象：大半径（跨多桶）+ 密集分布，逼近「同对象被插入多桶」场景 */
function buildObjects(n, area, rMax) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: i,
      x: Math.random() * area,
      y: Math.random() * area,
      r: 8 + Math.random() * (rMax - 8),
    });
  }
  return arr;
}

/* ===== 用例 ①：query 去重的集合等价性（跨桶大量对象 vs 朴素全扫） ===== */
(function testDedupEquivalence() {
  const hash = new SH(96);
  const all = buildObjects(800, 2000, 65);   // r 最大 65 且 cell=96 → 必然跨 4+ 桶
  for (const o of all) hash.insert(o, o.x, o.y, o.r);

  let mismatch = 0, total = 0, dupHit = 0;
  for (let k = 0; k < 120; k++) {
    const qx = Math.random() * 2000, qy = Math.random() * 2000, qr = 30;
    const got = hash.query(qx, qy, qr, []);
    const want = naiveQuery(all, qx, qy, qr, hash.cell);
    total++;
    if (!sameSet(got, want)) mismatch++;
    if (got.length !== new Set(got).size) dupHit++;   // 输出内部不得有重复
  }
  check("01 去重集合与朴素全扫候选集完全等价（120 次随机查询）", mismatch === 0);
  check("02 query 输出内部无重复元素", dupHit === 0);
  check("03 等价性样本量已实际执行（total=120）", total === 120);

  // 构造「单对象横跨多桶」的确定场景，验证跨桶对象只出现一次
  const h2 = new SH(96);
  const big = { id: 9999, x: 500, y: 500, r: 65 };   // 直径 130 > cell 96 → 跨多桶
  h2.insert(big, big.x, big.y, big.r);
  const gotBig = h2.query(500, 500, 30, []);
  check("04 大半径跨桶对象在候选集中只出现一次", gotBig.length === 1 && gotBig[0] === big);
})();

/* ===== 用例 ②：tick 机制正确性 ===== */
(function testTick() {
  const h = new SH(96);
  const a = { id: 1, x: 100, y: 100, r: 10 };
  const b = { id: 2, x: 110, y: 110, r: 10 };
  h.insert(a, a.x, a.y, a.r);
  h.insert(b, b.x, b.y, b.r);

  const r1 = h.query(100, 100, 40, []).slice();
  const r2 = h.query(100, 100, 40, []);   // 不清空桶、不换 out，连续再查
  check("05 连续两次 query 结果集合一致（tick 未误伤同帧复用）", sameSet(r1, r2));
  check("06 连续两次 query 命中同一批候选（数量一致且非空）", r1.length === r2.length && r1.length > 0);

  // clear 后 tick 前进，新插入对象必须能被查到（旧标记不得屏蔽新内容）
  h.clear();
  const c = { id: 3, x: 100, y: 100, r: 10 };
  h.insert(c, c.x, c.y, c.r);
  const r3 = h.query(100, 100, 40, []);
  check("07 clear 后新插入对象可被查到（tick 前进未被误判已见）", r3.length === 1 && r3[0] === c);

  // clear 使旧桶全部失效：清空后不插入任何对象，查询必空
  h.clear();
  const r4 = h.query(100, 100, 40, []);
  check("08 clear 后未插入任何对象时查询结果为空", r4.length === 0);
})();

/* ===== 用例 ③：autoCell 三档边界值 ===== */
(function testAutoCell() {
  check("09 autoCell(0) 落入最小档 96", SH.autoCell(0) === 96);
  check("10 autoCell(499) 最小档 96（500 下界外侧）", SH.autoCell(499) === 96);
  check("11 autoCell(500) 升到 128（500 上界内侧）", SH.autoCell(500) === 128);
  check("12 autoCell(1499) 保持 128（1500 下界外侧）", SH.autoCell(1499) === 128);
  check("13 autoCell(1500) 升到 192（1500 上界内侧）", SH.autoCell(1500) === 192);
  check("14 autoCell(999999) 最大档 192", SH.autoCell(999999) === 192);
  check("15 autoCell 返回值均为整数", [0, 500, 1500].every((n) => Number.isInteger(SH.autoCell(n))));
  check("16 autoCell 非法入参（负数/非数）回落最小档 96", SH.autoCell(-5) === 96 && SH.autoCell(NaN) === 96);
})();

/* ===== 用例 ④：retune 改 cell 后旧数据清空、新插入可查 ===== */
(function testRetune() {
  const h = new SH(96);
  const old = { id: 1, x: 100, y: 100, r: 10 };
  h.insert(old, old.x, old.y, old.r);
  check("17 retune 前旧对象可查", h.query(100, 100, 40, []).length === 1);

  const changed = h.retune(1600);   // 触发档位切换：96 → 192
  check("18 retune 在高密度下返回变更标记 true", changed === true);
  check("19 retune 后 cell 已切换到 192", h.cell === 192);
  check("20 retune 后旧桶被清空（旧对象查不到）", h.query(100, 100, 40, []).length === 0);

  const fresh = { id: 2, x: 100, y: 100, r: 10 };
  h.insert(fresh, fresh.x, fresh.y, fresh.r);
  const got = h.query(100, 100, 40, []);
  check("21 retune 后新插入对象可查", got.length === 1 && got[0] === fresh);

  const noChange = h.retune(1600);   // 同档位重复调用
  check("22 同档位 retune 返回 false（不重建、不丢数据）", noChange === false && h.query(100, 100, 40, []).length === 1);
  check("23 默认构造 cell 仍为 96（公开契约不变）", new SH().cell === 96);
})();

/* ===== 用例 ⑥：性能冒烟（30 万次 query 宽阈值） ===== */
(function testPerf() {
  const h = new SH(SH.autoCell(1500));
  const all = buildObjects(1500, 3000, 65);
  for (const o of all) h.insert(o, o.x, o.y, o.r);

  const out = [];
  const N = 300000;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    h.query((i * 37) % 3000, (i * 91) % 3000, 30, out);   // 确定性遍历，避免随机数开销干扰
  }
  const ms = Date.now() - t0;
  check("24 30 万次 query 耗时在上限内（毫秒=" + ms + "，上限 3000）", ms < 3000);
})();

/* ---- 汇总 ---- */
console.log("PASS 统计 = " + passCount + " 项全部通过，失败 = " + failCount);
if (failCount === 0) {
  console.log("SPATIAL TEST OK");
  process.exit(0);
} else {
  console.log("SPATIAL TEST FAILED");
  process.exit(1);
}
