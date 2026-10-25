/* xgame_chip_fold_test.js —— 「遗迹秘宝撤离折算」独立核验（只读，不改任何源文件）
 * ----------------------------------------------------------------------------
 * 任务：遗迹秘宝由「不折算（carryOut=false / chipValue=0 / 出局消失）」改为「撤离折算」。
 * 覆盖：
 *   ① 配置结构：CFG.chips.carryOut === true；CFG.chips.valueByQuality 4 档占位价值表就位。
 *   ② 真实调用 calcSettleConvert(run)：秘宝桶 b.chip 按 Σ floor(品质基值 × lv × valueRate) 计入 total。
 *   ③ 反向防护：空 chipInv → 秘宝桶为 0；非 kind==="chip" 混入项被忽略；不误用词条 value 字段。
 *   ④ 纯函数：签名仍为 1 参、重复调用一致、不修改 run。
 *
 * 加载方式：真解析 index.html 的 <script src="js/..."> 顺序，用 node vm 全量装载（隔离 sandbox + DOM 桩，
 * 同 xgame_assets_consumption_test.js 写法），不手抄脚本序。
 *
 * 运行：node xgame_chip_fold_test.js
 * 判绿：退出码 0（末尾 process.exit(M===0?0:1)）；PASS 文案不含英文 error / FAIL。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");

/* ============================================================
 * ① 真解析 index.html —— 提取 <script src="js/..."> 有序序列
 * ============================================================ */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scriptTagRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const allSrc = [];
let mm;
while ((mm = scriptTagRe.exec(html)) !== null) allSrc.push(mm[1]);
const pageJsScripts = allSrc
  .map((s) => String(s).split("?")[0].split("#")[0].replace(/^\.\//, ""))
  .filter((s) => s.indexOf("js/") === 0);

/* ============================================================
 * ② DOM / Canvas 桩（隔离 sandbox，避免污染 node 全局）
 * ============================================================ */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  toggle(c, f) {
    if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); }
    else if (f) this.set.add(c); else this.set.delete(c);
  }
  contains(c) { return this.set.has(c); }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w || 1) * (h || 1)) * 4), width: w, height: h });
    if (p === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w || 1) * (h || 1)) * 4), width: w, height: h });
    if (p in t) return t[p];
    return () => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {}; this.classList = new ClassList();
    this.children = []; this._parent = null; this._html = ""; this.textContent = "";
    this.disabled = false; this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) { this._cls = v; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  remove() { }
  get firstChild() { return this.children[0] || null; }
  addEventListener() { } removeEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return new FakeEl("q"); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  setAttribute() { } getAttribute() { return null; } select() { } focus() { } blur() { }
  insertBefore(c) { return this.appendChild(c); }
}
function makeSandbox() {
  const elCache = {};
  const doc = {
    head: new FakeEl("head"),
    getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() { }, removeEventListener() { },
    querySelector: () => null, querySelectorAll: () => [],
    elementFromPoint: () => null, execCommand() { return true; },
    createTextNode() { return new FakeEl("text"); },
  };
  Object.defineProperty(doc, "body", { get() { return this.getElementById("body"); }, configurable: true });
  const win = { addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
  const sandbox = {
    console: { log() { }, warn() { }, info() { }, error() { }, debug() { } },
    document: doc, window: win,
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    navigator: { userAgent: "Mozilla/5.0 XGAMeChipFold node", maxTouchPoints: 0 },
    performance: { now: () => Date.now(), mark() { }, measure() { } },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    Date, Math, JSON, Promise, Set, Map, Array, Object, Number, String, Boolean, RegExp, Error,
    isFinite, isNaN, parseInt, parseFloat, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
  };
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.window.document = doc;
  return sandbox;
}

/* ============================================================
 * ③ 断言驱动（在 sandbox 内执行，真实调用 calcSettleConvert）
 * ============================================================ */
const driver = `
(function () {
  const lines = [];
  const check = (name, cond) => { lines.push((cond ? "PASS " : "未通过 ") + name); return !!cond; };

  const rate = CFG.settleConvert.valueRate;
  const vbq = CFG.chips.valueByQuality;

  /* ---------- 一、配置结构（carryOut + 品质价值表） ---------- */
  check("配置：CFG.chips.carryOut === true（撤离折算开启）", CFG.chips.carryOut === true);
  check("配置：CFG.chips.valueByQuality 存在且为 4 档数组（白/蓝/紫/金）",
    Array.isArray(vbq) && vbq.length === 4);
  check("配置：品质价值表 4 档均为正数（占位值已就位）",
    Array.isArray(vbq) && vbq.length === 4 && vbq.every((v) => typeof v === "number" && v > 0));
  check("配置：折算率 valueRate 为 0.5（沿用统一口径）", rate === 0.5);
  check("配置：CFG.settleConvert.chipValue 仍存在（兼容旧引用，值 = " + CFG.settleConvert.chipValue + "）",
    CFG.settleConvert.chipValue != null);

  /* ---------- 构造 run（真实 Inventory / makeChip / makeGear / makeChestItem） ---------- */
  function makeRun(specs) {
    const run = {
      backpack: new Inventory(CFG.backpack.cols, CFG.backpack.rows, "backpack"),
      weaponInv: new Inventory(CFG.chips.grid.cols, CFG.chips.grid.rows, "weaponInv"),
      chipInv: new Inventory(CFG.chips.grid.cols, CFG.chips.grid.rows, "chip"),
    };
    // 非秘宝物品（对照）：一件宝箱 + 一件装备，用于验证「秘宝折算是在既有桶之外新增」
    const chest = makeChestItem("normal");   // chestQ 为品质 key（见 CFG.chestQualities）
    let s = run.backpack.findSpot(chest); if (s) run.backpack.place(chest, s.x, s.y);
    const gear = makeGear("G001", 0);
    s = run.backpack.findSpot(gear); if (s) run.backpack.place(gear, s.x, s.y);
    (specs || []).forEach((sp) => {
      const c = makeChip(sp.def, sp.q);
      c.lv = sp.lv;
      const spot = run.chipInv.findSpot(c);
      if (spot) run.chipInv.place(c, spot.x, spot.y);
    });
    return run;
  }

  // 数值型（白/蓝/紫/金）+ 行为型（紫）混合，覆盖不同 q 与 lv
  const specs = [
    { def: "C_V_DMG", q: 0, lv: 1 },
    { def: "C_V_CD", q: 1, lv: 3 },
    { def: "C_V_RANGE", q: 2, lv: 2 },
    { def: "C_V_SPD", q: 3, lv: 9 },
    { def: "C_B_BURN", q: 2, lv: 1 },
  ];
  const full = makeRun(specs);
  // 前置：秘宝确实入了 chipInv
  check("前置：5 枚 kind===\\"chip\\" 已放入 chipInv（实际 " + full.chipInv.items.length + " 枚）",
    full.chipInv.items.length === 5 && full.chipInv.items.every((it) => it.kind === "chip"));

  /* ---------- 二、真实调用：秘宝桶按品质价值表折算 ---------- */
  const bc = calcSettleConvert(full);
  // 手算期望：Σ floor(品质基值[q] × lv × valueRate)
  const expChip = full.chipInv.items.reduce((s, it) => s + Math.floor(vbq[it.q] * (it.lv || 1) * rate), 0);
  const expDetail = full.chipInv.items.map((it) => "q" + it.q + "/lv" + it.lv + "=" + Math.floor(vbq[it.q] * (it.lv || 1) * rate)).join(", ");

  check("秘宝桶存在且非 0（撤离确实折算秘宝，值 = " + bc.chip + "）", typeof bc.chip === "number" && bc.chip > 0);
  check("秘宝折算额 = Σ floor(品质基值×lv×" + rate + ") 手算值 " + expChip + "（明细 " + expDetail + "）",
    bc.chip === expChip);
  check("total = 各桶之和（chest+gear+item+chip）",
    bc.total === bc.chest + bc.gear + bc.item + bc.chip);
  check("total 含秘宝折算：确比无秘宝该局合计多出秘宝桶（total " + bc.total + " > 其余合计 " +
    (bc.chest + bc.gear + bc.item) + "）",
    bc.total > (bc.chest + bc.gear + bc.item));

  /* ---------- 三、反向防护：不误用词条 value 字段 ---------- */
  const wrongVal = full.chipInv.items.reduce((s, it) => s + Math.floor((it.value || 0) * rate), 0);
  check("秘宝折算基于品质价值表，而非词条强度 value 字段（误算值 " + wrongVal + " ≠ 正确值 " + bc.chip + "）",
    bc.chip !== wrongVal);

  /* ---------- 四、空 chipInv → 秘宝桶为 0（防恒真假象） ---------- */
  const empty = makeRun([]);
  const be = calcSettleConvert(empty);
  check("空 chipInv → 秘宝桶为 0（" + be.chip + "）", be.chip === 0);
  check("空 chipInv → total 不含秘宝（= 其余桶之和）",
    be.total === be.chest + be.gear + be.item);
  check("有/无秘宝差额恰等于秘宝桶（" + (bc.total - be.total) + " = " + bc.chip + "）",
    (bc.total - be.total) === bc.chip);

  /* ---------- 五、chipInv 内非 kind===\\"chip\\" 项被忽略 ---------- */
  const mixed = makeRun(specs);
  const intruder = { uid: -777, kind: "module", itemQ: 0, value: 999, shape: [1, 1], name: "混入项" };
  const spot = mixed.chipInv.findSpot(intruder);
  if (spot) mixed.chipInv.place(intruder, spot.x, spot.y);
  const bm = calcSettleConvert(mixed);
  check("chipInv 内非 kind===\\"chip\\" 项被忽略（秘宝桶不变 = " + bm.chip + "）", bm.chip === bc.chip);

  /* ---------- 六、chipValue 标量已不参与折算（被 valueByQuality 取代） ---------- */
  const savedChipValue = CFG.settleConvert.chipValue;
  CFG.settleConvert.chipValue = 999;
  const bSc = calcSettleConvert(full);
  CFG.settleConvert.chipValue = savedChipValue;
  check("chipValue 标量已不参与折算（改为 999 后 total 不变 = " + bSc.total + "）",
    bSc.total === bc.total && bSc.chip === bc.chip);

  /* ---------- 七、纯函数：签名/幂等/不改 run ---------- */
  const beforeLen = full.chipInv.items.length;
  const again = calcSettleConvert(full);
  check("纯函数：calcSettleConvert 仍为 1 参函数（签名未变）", calcSettleConvert.length === 1);
  check("纯函数：重复调用结果一致", again.total === bc.total && again.chip === bc.chip);
  check("纯函数：不修改 run（chipInv 条目数不变 = " + full.chipInv.items.length + "）",
    full.chipInv.items.length === beforeLen);

  return JSON.stringify({ lines: lines });
})();
`;

/* ============================================================
 * ④ 主流程
 * ============================================================ */
(function main() {
  let lines = [];
  try {
    const sandbox = makeSandbox();
    const ctx = vm.createContext(sandbox);
    for (const f of pageJsScripts) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
    }
    const out = vm.runInContext(driver, ctx, { filename: "chip-fold-driver" });
    lines = (JSON.parse(out).lines) || [];
  } catch (e) {
    console.log("断言执行中止（环境异常）：" + (e && e.stack ? e.stack : e));
    console.log("----------------------------------------");
    console.log("PASS 合计 = 0   失败数 = 1");
    process.exit(1);
  }

  let passCount = 0, failCount = 0;
  for (const ln of lines) {
    console.log(ln);
    if (ln.indexOf("PASS ") === 0) passCount++;
    else failCount++;
  }
  console.log("----------------------------------------");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(failCount === 0 ? 0 : 1);
})();
