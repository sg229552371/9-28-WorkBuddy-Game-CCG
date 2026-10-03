/* perf_asset_test.js — 首屏卡顿改造（Assets.fit 低开销化 + 分帧加载）专项测试
 * 覆盖：
 *   A. fit() 语义等价：桩 canvas 记录 drawImage 参数，断言「裁剪包围盒 + 缩放到目标高」一致
 *   B. 性能回归锁定：桩 512×512 假 canvas，断言 getImageData 扫描像素数 << 512×512（防改回全图扫描）
 *   C. 逐级减半：断言缩放路径经历多次 drawImage（而非一次性大比例）
 *   D. 分帧加载：桩 36 素材，断言 fillSprites 不在同一 tick 内完成全部（多次帧回调）
 *   E. 进度状态：Assets.progress.done 全部完成后 === total
 *   F. 容错：某张 onerror → 不中断后续，最终 done 计数正确
 *   G. 降级：getImageData 抛异常（file:// 污染）→ 仍返回可用 canvas，不崩
 * 环境要点：
 *   - 断言用 check()（PASS/FAIL 计数 + 末尾 throw 非零退出），不用 console.assert（不改退出码）
 *   - jsdom 无 canvas → 全部 canvas 用桩；getContext 返回带 drawImage/getImageData 的记录器
 *   - js/core.js 依赖 CFG：vm 顺序 config → core；const CFG 在 vm 模块作用域内 driver 可访问
 *   - Image.set src 同步触发 onload/onerror（按 key 决定，便于容错用例）
 * 运行：node perf_asset_test.js（退出码 0 = 全绿，与 run_tests.sh 口径一致）
 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---------- 断言工具（失败计数 + 末尾 throw，确保非零退出码） ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ============================================================
 * 桩 canvas / canvas 工厂
 * ============================================================ */
/* 全局计数器：所有桩 canvas 的 getImageData / drawImage 汇总到此处，
 * 便于「扫描像素总量」跨多个中间画布正确统计（这是性能回归锁定的关键）。 */
const GC = { getImageData: 0, scannedPixels: 0, drawImage: 0, log: [] };
function resetGC() { GC.getImageData = 0; GC.scannedPixels = 0; GC.drawImage = 0; GC.log = []; }

/* 记录型 2D 上下文：drawImage 记调用参数；getImageData 记扫描像素并返回可控数据 */
function makeRecorderCtx(opts) {
  opts = opts || {};
  return {
    calls: [],
    drawImage: function () {
      GC.drawImage++; this.calls.push(Array.from(arguments));
      GC.log.push({ canvas: this._owner, args: Array.from(arguments) });
    },
    _data: opts.data || null,               // 自定义数据；否则按区域生成全透明
    _throw: opts.throwImageData || false,   // true → 抛异常模拟 file:// 画布污染
    _owner: null,
    getImageData(x, y, w, h) {
      GC.getImageData++;
      GC.scannedPixels += w * h;
      if (this._throw) throw new Error("SecurityError: canvas tainted");
      const data = this._data && this._data.data ? this._data.data : new Uint8ClampedArray(w * h * 4);
      return { data, width: w, height: h };
    },
    putImageData() { },
    save() { }, restore() { }, translate() { }, scale() { }, fillRect() { },
    beginPath() { }, arc() { }, fill() { }, stroke() { }, clearRect() { },
  };
}

/* 桩 canvas 元素：宽高可设，getContext 返回记录器 */
class FakeCanvas {
  constructor(w, h) {
    this.tagName = "CANVAS";
    this.width = w || 300; this.height = h || 150;
    this._ctx = makeRecorderCtx(FakeCanvas.ctxOpts || {});
    this._ctx._owner = this;
    this.calls = this._ctx.calls;
  }
  getContext() { return this._ctx; }
}
FakeCanvas.ctxOpts = {};

/* ============================================================
 * 沙箱工厂
 * ============================================================ */
function makeSandbox(opts) {
  opts = opts || {};
  const rafQ = [];
  const sandbox = {
    console,
    Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: {
      createElement(tag) { return new FakeCanvas(512, 512); },
      getElementById() { return new FakeCanvas(512, 512); },
      addEventListener() { },
    },
    window: { addEventListener() { } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    requestAnimationFrame: (fn) => { rafQ.push(fn); return rafQ.length; },
    cancelAnimationFrame: () => { },
  };
  sandbox.globalThis = sandbox;
  sandbox.__rafQ = rafQ;   // 测试侧驱动用（挂在沙箱里以保持同一引用）
  // Image 桩：set src 同步触发 onload（loadOk !== false）；imageOkBySrc 可精确指定某 src 失败
  sandbox.Image = class {
    constructor() { this.width = 512; this.height = 512; this.onload = null; this.onerror = null; }
    set src(v) {
      const fail = opts.failSrc && opts.failSrc.indexOf(v) >= 0;
      if (fail) { if (this.onerror) this.onerror(); }
      else { if (this.onload) this.onload(); }
    }
  };
  sandbox.UI = {};
  return vm.createContext(sandbox);
}

const CORE_FILES = ["js/config.js", "js/core.js"];

/* 驱动沙箱内的 rAF 队列 q 帧，返回执行的回调数 */
function drainRAF(ctx, maxFrames) {
  let frames = 0;
  for (let i = 0; i < (maxFrames || 1000); i++) {
    const q = vm.runInContext("(globalThis.__rafQ || []).splice(0)", ctx);
    if (!q.length) break;
    for (const fn of q) fn();
    frames++;
  }
  return frames;
}

/* 造一个「已知内容」的代理数据：在 64×64 代理里让某矩形区域 alpha>20，用于验证包围盒 */
function makeAlphaData(size, rect) {
  const d = new Uint8ClampedArray(size * size * 4);
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) {
    d[(y * size + x) * 4 + 3] = 255;
  }
  return { data: d };
}

/* ============================================================
 * A. fit() 语义等价
 * 原图 512×512（FakeCanvas + 记录器），代理层命中已知包围盒 → 断言：
 *   - 返回 canvas 高度 = targetH
 *   - 最终 drawImage 的源裁剪 = 代理包围盒 × 原图比例；目标尺寸 = 目标
 * ============================================================ */
try {
  // 代理 64×64 里内容占 (x:4..60, y:8..56) → 原图比例 8 → x0=32,y0=64,x1=488,y1=456
  const ad = makeAlphaData(64, { x0: 4, y0: 8, x1: 60, y1: 56 });
  FakeCanvas.ctxOpts = { data: ad };
  resetGC();
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  // 注入一个 512×512 原图（源 canvas）
  vm.runInContext("Assets.images.__t = document.createElement('canvas'); Assets.images.__t.width = 512; Assets.images.__t.height = 512;", ctx);
  const srcImg = vm.runInContext("Assets.images.__t", ctx);
  const out = vm.runInContext("Assets.fit('__t', 48)", ctx);
  check("fit() 返回 canvas（有 width/height）", out && typeof out.width === "number" && typeof out.height === "number");
  check("fit(targetH=48) 输出高度 = 48", out && out.height === 48);
  // 包围盒：x0=floor(4*8)=32, x1=min(512, ceil(60*8 + 8))=488 → cw=456；ch: y0=floor(8*8)=64, y1=min(512,ceil(56*8+8))=456 → ch=392
  // 宽 = ceil(456 * 48/392) = ceil(55.84) = 56
  check("fit() 裁剪宽按包围盒比例（期望 56，实得 " + (out && out.width) + "）", out && out.width === 56);
  // 首级 drawImage 从**原图**按包围盒裁剪（9 参：src, sx,sy,sw,sh, 0,0,dw,dh）
  const crop = GC.log.find(e => e.args.length === 9 && e.args[0] === srcImg);
  check("fit() 从原图按包围盒裁剪（首级 9 参 drawImage 命中源图）", !!crop);
  if (crop) {
    const [, sx, sy, sw, sh] = crop.args;
    check("fit() 源裁剪参数 = 包围盒（sx=32,sy=64,sw=456,sh=392，实得 " + [sx, sy, sw, sh].join(",") + "）",
      sx === 32 && sy === 64 && sw === 456 && sh === 392);
  }
  const ocalls = out.getContext().calls;
  check("fit() 末级缩放为目标尺寸（9 参 drawImage 收尾 tw=56,th=48）",
    ocalls.length >= 1 && ocalls[ocalls.length - 1].length === 9 &&
    ocalls[ocalls.length - 1][7] === out.width && ocalls[ocalls.length - 1][8] === out.height);
} catch (e) { check("fit() 语义等价 (" + e.message + ")", false); }

/* ============================================================
 * B. 性能回归锁定：扫描像素数必须 << 512×512（防改回全图 getImageData 扫描）
 * 桩 512×512 假 canvas，getImageData 计数；修复后只扫 64×64 = 4096 像素。
 * ============================================================ */
try {
  resetGC();
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("Assets.images.__t = document.createElement('canvas'); Assets.images.__t.width = 512; Assets.images.__t.height = 512;", ctx);
  vm.runInContext("Assets.fit('__t', 48)", ctx);
  const FULL = 512 * 512;   // 262144 全图扫描像素
  const LIMIT = 64 * 64;    // 4096：代理层上限
  check("fit() getImageData 扫描像素 " + GC.scannedPixels + " ≤ 64×64(" + LIMIT + ")（原全图 = " + FULL + "）", GC.scannedPixels <= LIMIT && GC.scannedPixels > 0);
  check("fit() 扫描像素远小于全图（< 全图 1/8，实际 1/" + Math.round(FULL / Math.max(1, GC.scannedPixels)) + "）", GC.scannedPixels < FULL / 8);
  check("fit() 只对代理层 getImageData 一次（不再对原图逐像素扫描）", GC.getImageData === 1);
} catch (e) { check("性能回归锁定 (" + e.message + ")", false); }

/* ============================================================
 * C. 逐级减半：从 512 缩到 ~48 应经历多次 drawImage（非一次性大比例）
 * ============================================================ */
try {
  resetGC();
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("Assets.images.__t = document.createElement('canvas'); Assets.images.__t.width = 512; Assets.images.__t.height = 512;", ctx);
  vm.runInContext("Assets.fit('__t', 48)", ctx);
  // 512→256→128→末级收尾：drawImage 至少 3 次（首级裁剪 + ≥1 次减半 + 末级）
  check("逐级减半：从 512 缩到 ~48 经历 ≥3 次 drawImage（实得 " + GC.drawImage + "）", GC.drawImage >= 3);
} catch (e) { check("逐级减半 (" + e.message + ")", false); }

/* ============================================================
 * D. 分帧加载：桩 36 素材，fillSprites 不在同一 tick 完成全部
 * ============================================================ */
try {
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  // 仅 config+core，无 G → 需自造 G.sprites 供 fillSprites 使用
  vm.runInContext("globalThis.G = { sprites: {} };", ctx);
  // 造 36 个素材：images 里预置 36 张 512×512 桩 canvas
  vm.runInContext(`
    for (var i = 0; i < 36; i++) { var c = document.createElement('canvas'); c.width = 512; c.height = 512; Assets.images['k' + i] = c; }
    globalThis.__manifest = {};
    for (var j = 0; j < 36; j++) __manifest['k' + j] = { src: 'x' };
    Assets.fillSprites(__manifest);
    globalThis.__firstTickCount = Object.keys(G.sprites).length;
  `, ctx);
  const firstTick = vm.runInContext("globalThis.__firstTickCount", ctx);
  check("分帧：fillSprites 首次调用不同步装入全部 36 张（首帧 " + firstTick + " / 36）", firstTick < 36 && firstTick > 0);
  check("分帧：首帧装入量 = FIT_PER_FRAME（" + vm.runInContext("Assets.FIT_PER_FRAME", ctx) + "）", firstTick === vm.runInContext("Assets.FIT_PER_FRAME", ctx));
  const frames = drainRAF(ctx);
  const totalAfter = vm.runInContext("Object.keys(G.sprites).length", ctx);
  const per = vm.runInContext("Assets.FIT_PER_FRAME", ctx);
  check("分帧：经多帧回调后装入全部 36 张（跑了 " + frames + " 帧）", totalAfter === 36);
  check("分帧：确实经历多次 rAF 帧回调（≥ 2 帧）", frames >= 2);
  // 首批在 fillSprites 同步执行，其余由 rAF 推进 → rAF 帧数 = 批数 - 1
  check("分帧：rAF 帧数 = ceil(36 / FIT_PER_FRAME) - 1（实得 " + frames + "）", frames === Math.ceil(36 / per) - 1);
} catch (e) { check("分帧加载 (" + e.message + ")", false); }

/* ============================================================
 * E. 进度状态：done 全部完成后 = total
 * ============================================================ */
try {
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("globalThis.G = { sprites: {} };", ctx);
  vm.runInContext(`
    for (var i = 0; i < 36; i++) { var c = document.createElement('canvas'); c.width = 512; c.height = 512; Assets.images['k' + i] = c; }
    globalThis.__manifest = {};
    for (var j = 0; j < 36; j++) __manifest['k' + j] = { src: 'x' };
    Assets.fillSprites(__manifest);
  `, ctx);
  const mid = vm.runInContext("({ done: Assets.progress.done, loaded: Assets.progress.loaded, total: Assets.progress.total })", ctx);
  check("进度：装载中 done=false", mid.done === false);
  check("进度：total = 36", mid.total === 36);
  drainRAF(ctx);
  const end = vm.runInContext("({ done: Assets.progress.done, loaded: Assets.progress.loaded, total: Assets.progress.total })", ctx);
  check("进度：全部完成后 done=true", end.done === true);
  check("进度：done 完成时 loaded === total（" + end.loaded + " === " + end.total + "）", end.loaded === end.total && end.loaded === 36);
} catch (e) { check("进度状态 (" + e.message + ")", false); }

/* ============================================================
 * F. 容错：某张 onerror → 不中断后续，最终计数正确
 * ============================================================ */
try {
  const ctx = makeSandbox({ failSrc: ["bad.png"] });
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("globalThis.G = { sprites: {} };", ctx);
  // 3 张图，中间一张失败（images 里只给成功两张预置内容；失败图 onerror 不进 images）
  vm.runInContext(`
    var c1 = document.createElement('canvas'); c1.width = 512; c1.height = 512; Assets.images['ok1'] = c1;
    var c3 = document.createElement('canvas'); c3.width = 512; c3.height = 512; Assets.images['ok3'] = c3;
    globalThis.__manifest = { ok1: { src: 'ok1.png' }, bad: { src: 'bad.png' }, ok3: { src: 'ok3.png' } };
    Assets.load(__manifest);
  `, ctx);
  // load 的 Promise.all resolve 依赖 Image 同步回调 + 微任务；用宿主宏任务让微任务推进
  const microDone = () => vm.runInContext("Assets.progress.loaded === 3", ctx);
  // 同步 Image onload 已触发 finish()，loaded 应已 = 3（3 张都 resolve，失败也 finish）
  check("容错：单张加载失败回调不中断队列，loaded 计数 = 3（实得 " + vm.runInContext("Assets.progress.loaded", ctx) + "）", microDone());
  check("容错：失败图未写入 images（bad 缺失）", vm.runInContext("Assets.images['bad'] === undefined", ctx) === true);
  check("容错：成功图仍写入 images", vm.runInContext("!!Assets.images['ok1'] && !!Assets.images['ok3']", ctx) === true);
} catch (e) { check("容错 (" + e.message + ")", false); }

/* 用 fillSprites 收口容错：失败键最终为 null，successCount 正确 */
try {
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("globalThis.G = { sprites: {} };", ctx);
  vm.runInContext(`
    var c1 = document.createElement('canvas'); c1.width = 512; c1.height = 512; Assets.images['ok1'] = c1;
    // 'missing' 无 images → fit 返回 null
    globalThis.__manifest = { ok1: { src: 'x' }, missing: { src: 'y' } };
    Assets.fillSprites(__manifest);
  `, ctx);
  drainRAF(ctx);
  const r = vm.runInContext("({ ok: G.sprites['ok1'], miss: G.sprites['missing'], done: Assets.progress.done })", ctx);
  check("容错：缺失素材键置 null（渲染侧色块兜底）", r.miss === null);
  check("容错：成功素材键为 canvas", r.ok && typeof r.ok === "object");
  check("容错：含失败项时 done 仍置 true", r.done === true);
} catch (e) { check("容错-填充 (" + e.message + ")", false); }

/* ============================================================
 * G. 降级：getImageData 抛异常（file:// 污染）→ 仍返回可用 canvas
 * ============================================================ */
try {
  FakeCanvas.ctxOpts = { throwImageData: true };
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  vm.runInContext("Assets.images.__t = document.createElement('canvas'); Assets.images.__t.width = 512; Assets.images.__t.height = 512;", ctx);
  const out = vm.runInContext("Assets.fit('__t', 48)", ctx);
  check("降级：getImageData 抛异常时 fit 不崩、仍返回 canvas", out && typeof out.height === "number");
  // 污染路径 x0=0,y0=0,x1=w,y1=h → 整图缩放：h → 48，w = ceil(512*48/512) = 48
  check("降级：整图缩放（512×512 → 48×48，实得 " + (out && out.width) + "×" + (out && out.height) + "）", out && out.height === 48 && out.width === 48);
} catch (e) { check("降级 (" + e.message + ")", false); }

/* fit 对不存在的 key → null（不崩） */
try {
  const ctx = makeSandbox({});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  const r = vm.runInContext("Assets.fit('__nonexist', 48) === null", ctx);
  check("fit() 对缺失 key 返回 null（渲染侧走色块）", r === true);
} catch (e) { check("fit 缺失 key (" + e.message + ")", false); }

/* ============================================================
 * 汇总
 * ============================================================ */
console.log("----------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) { throw new Error("perf_asset_test 有 " + failCount + " 条断言失败"); }
