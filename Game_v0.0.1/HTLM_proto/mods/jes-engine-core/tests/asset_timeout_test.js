/* asset_timeout_test.js — 素材加载超时兜底（根治「启动超时」永久挂起）专项测试
 * ----------------------------------------------------------------------------
 * 背景：`Assets._loadOne` 原先只挂 img.onload / img.onerror。移动弱网下请求可能
 *       「既不返回也不报错」→ 该 Promise 永不 settle → `Promise.all` 永不 resolve
 *       → main.js 的 `await Assets.load(...)` 永久挂起 → 12 秒后 BootGuard 弹出
 *       「[错误1]启动超时：boot() 在 12 秒内未进入首页」诊断面板。
 *       修法：加 LOAD_TIMEOUT_MS 超时兜底，超时按「素材缺失」结算，缺图走色块渲染。
 *
 * 覆盖：
 *   ① 常量合法性：LOAD_TIMEOUT_MS 为正数且 < BootGuard 的 12 秒看门狗
 *   ② 请求挂起（onload/onerror 都不触发）时 Promise 不结算、计数不推进、定时器已挂号
 *   ③ 超时触发后：Promise 结算（boot 不再卡死）、计数推进、素材不进 images（走色块兜底）
 *   ④ 幂等闸门：超时后迟到的 onload 不重复计数，但迟到的图仍被采用
 *   ⑤ 正常加载：定时器被清除，不留残留（不阻塞测试进程 / 不误触发降级）
 *   ⑥ 端到端：多张全挂起时 Assets.load() 仍会 resolve 并收口，计数与 total 对齐
 *   ⑦ 极简桩（沙箱无 setTimeout）不抛异常 —— 行为退回改造前，不引入新崩溃点
 *   ⑧ 双触发不重复计数：超时后再来 onerror，计数仍为 1
 *
 * 环境要点：
 *   - 用「假定时器队列」驱动，**零真实等待**（真 setTimeout 会让本测试白等 8 秒）
 *   - Image 桩：src 以 "hang" 开头 → 永不回调（模拟弱网挂起）；src 置空 → 不回调（超时回收）
 *   - 断言用 check()（PASS/FAIL 计数 + 末尾非零退出），不用 console.assert（不改退出码）
 * 运行：node asset_timeout_test.js（退出码 0 = 全绿，与 run_tests.sh 口径一致）
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

/* ---------- 桩 canvas（fit / _toCanvas 需要） ---------- */
function makeCtx2d() {
  return {
    drawImage() { }, putImageData() { }, save() { }, restore() { },
    translate() { }, scale() { }, fillRect() { }, beginPath() { },
    arc() { }, fill() { }, stroke() { }, clearRect() { },
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
  };
}
function FakeCanvas(w, h) { this.width = w || 300; this.height = h || 150; this._ctx = makeCtx2d(); }
FakeCanvas.prototype.getContext = function () { return this._ctx; };

const CORE_FILES = ["js/config.js", "js/core.js"];

/* ============================================================
 * 沙箱工厂：假定时器队列（零真实等待）
 * ============================================================ */
function makeSandbox(opts) {
  opts = opts || {};
  const timers = new Map();
  let seq = 0;
  const imgs = [];
  const sandbox = {
    console,
    Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    document: {
      createElement() { return new FakeCanvas(64, 64); },
      getElementById() { return new FakeCanvas(64, 64); },
      addEventListener() { },
    },
    window: { addEventListener() { } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  };
  if (!opts.noTimer) {
    sandbox.setTimeout = (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; };
    sandbox.clearTimeout = (id) => { timers.delete(id); };
  }
  sandbox.globalThis = sandbox;
  sandbox.__timers = timers;   // 测试侧驱动
  sandbox.__imgs = imgs;       // 测试侧可手动补发迟到回调
  sandbox.Image = class {
    constructor() { this.width = 64; this.height = 64; this.onload = null; this.onerror = null; this._src = ""; imgs.push(this); }
    set src(v) {
      this._src = v;
      if (!v) return;                                   // 超时回收（置空）→ 不回调
      if (String(v).indexOf("hang") === 0) return;      // 弱网挂起模拟 → 永不回调
      if (this.onload) this.onload();
    }
    get src() { return this._src; }
  };
  sandbox.UI = {};
  return vm.createContext(sandbox);
}

/* 起一个沙箱并加载 config + core（core 依赖 CFG） */
function boot() {
  const ctx = makeSandbox(arguments[0] || {});
  for (const f of CORE_FILES) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  return ctx;
}

/* 推进沙箱内的假定时器：全部取出并执行，返回执行个数 */
function runTimers(ctx) {
  const list = vm.runInContext("Array.from(globalThis.__timers.values())", ctx);
  vm.runInContext("globalThis.__timers.clear()", ctx);
  for (const t of list) t.fn();
  return list.length;
}

/* 让微任务跑完（vm 的 Promise 与宿主共用微任务队列） */
const flush = () => new Promise((r) => setImmediate(r));
async function settle() { await flush(); await flush(); }

/* ============================================================
 * 主流程
 * ============================================================ */
(async function main() {

  /* ---------- ① 常量合法性 ---------- */
  {
    const ctx = boot();
    const ms = vm.runInContext("Assets.LOAD_TIMEOUT_MS", ctx);
    check("① LOAD_TIMEOUT_MS 存在且为正数（实得 " + ms + "）", typeof ms === "number" && ms > 0);
    check("① 超时值 < BootGuard 12 秒看门狗（留足 fillSprites 收口时间）", typeof ms === "number" && ms < 12000);
  }

  /* ---------- ② 挂起素材：超时前不结算 ---------- */
  let ctx;
  {
    ctx = boot();
    vm.runInContext(`
      Assets.progress = { loaded: 0, total: 1, done: false };
      globalThis.__imgs.length = 0;
      globalThis.__done = false;
      Assets._loadOne('hangA', 'hangA.png').then(function () { globalThis.__done = true; });
    `, ctx);
    await settle();
    check("② 请求挂起时 Promise 尚未结算（这正是「永久卡死」的现场）",
      vm.runInContext("globalThis.__done === false", ctx) === true);
    check("② 挂起时素材计数未推进（loaded 仍为 0）",
      vm.runInContext("Assets.progress.loaded === 0", ctx) === true);
    check("② 挂起时已挂号 1 个超时定时器（兜底已布防）",
      vm.runInContext("globalThis.__timers.size === 1", ctx) === true);
  }

  /* ---------- ③ 超时触发后结算 + 缺图降级 ---------- */
  {
    const fired = runTimers(ctx);
    await settle();
    check("③ 超时回调被执行（实得 " + fired + " 个）", fired === 1);
    check("③ 超时后 Promise 结算 —— boot() 不再永久卡住",
      vm.runInContext("globalThis.__done === true", ctx) === true);
    check("③ 计数按「已处理」推进到 1",
      vm.runInContext("Assets.progress.loaded === 1", ctx) === true);
    check("③ 超时素材不进 images —— 渲染侧既有 if(img) 分支走色块兜底",
      vm.runInContext("Assets.images['hangA'] === undefined", ctx) === true);
    check("③ 定时器已被回收，无残留",
      vm.runInContext("globalThis.__timers.size === 0", ctx) === true);
  }

  /* ---------- ④ 幂等闸门：迟到的 onload ---------- */
  {
    ctx = boot();
    vm.runInContext(`
      Assets.progress = { loaded: 0, total: 1, done: false };
      globalThis.__imgs.length = 0;
      Assets._loadOne('hangB', 'hangB.png');
    `, ctx);
    runTimers(ctx);
    await settle();
    check("④ 超时后计数 = 1",
      vm.runInContext("Assets.progress.loaded === 1", ctx) === true);
    // 迟到到达：超时之后 onload 才触发
    vm.runInContext("globalThis.__imgs[0].onload()", ctx);
    await settle();
    check("④ 迟到的 onload 不重复计数（幂等闸门生效，仍为 1）",
      vm.runInContext("Assets.progress.loaded === 1", ctx) === true);
    check("④ 迟到的图仍被采用（写进 images，属于白捡的收益）",
      vm.runInContext("!!Assets.images['hangB']", ctx) === true);
  }

  /* ---------- ⑧ 双触发：超时 + onerror 只算一次 ---------- */
  {
    ctx = boot();
    vm.runInContext(`
      Assets.progress = { loaded: 0, total: 1, done: false };
      globalThis.__imgs.length = 0;
      Assets._loadOne('hangC', 'hangC.png');
    `, ctx);
    runTimers(ctx);
    await settle();
    vm.runInContext("globalThis.__imgs[0].onerror()", ctx);
    await settle();
    check("⑧ 超时之后再触发失败回调，计数仍为 1（不重复结算）",
      vm.runInContext("Assets.progress.loaded === 1", ctx) === true);
  }

  /* ---------- ⑤ 正常加载：定时器被清除 ---------- */
  {
    ctx = boot();
    vm.runInContext(`
      Assets.progress = { loaded: 0, total: 1, done: false };
      globalThis.__imgs.length = 0;
      Assets._loadOne('ok1', 'ok1.png');
    `, ctx);
    await settle();
    check("⑤ 正常加载：计数 = 1",
      vm.runInContext("Assets.progress.loaded === 1", ctx) === true);
    check("⑤ 正常加载后定时器已清除（无残留，不阻塞进程、不误触发降级）",
      vm.runInContext("globalThis.__timers.size === 0", ctx) === true);
    check("⑤ 正常素材写进 images",
      vm.runInContext("!!Assets.images['ok1']", ctx) === true);
  }

  /* ---------- ⑥ 端到端：全部挂起时 load() 仍收口 ---------- */
  {
    ctx = boot();
    vm.runInContext(`
      globalThis.__imgs.length = 0;
      globalThis.__loadDone = false;
      Assets.load({ a: { src: 'hangA.png' }, b: { src: 'hangB.png' }, c: { src: 'hangC.png' } })
        .then(function () { globalThis.__loadDone = true; });
    `, ctx);
    await settle();
    check("⑥ 三张全挂起时 load() 尚未完成（对照：改造前它会永远停在这里）",
      vm.runInContext("globalThis.__loadDone === false", ctx) === true);
    runTimers(ctx);
    await settle();
    check("⑥ 超时后 load() 仍会 resolve（boot() 必定走得完）",
      vm.runInContext("globalThis.__loadDone === true", ctx) === true);
    check("⑥ 进度计数 = 3，与 total 对齐（UI 加载条不会卡在中途）",
      vm.runInContext("Assets.progress.loaded === 3 && Assets.progress.total === 3", ctx) === true);
    check("⑥ 三张均按缺失降级：images 里一个都没进",
      vm.runInContext("!Assets.images['a'] && !Assets.images['b'] && !Assets.images['c']", ctx) === true);
  }

  /* ---------- ⑦ 极简桩：沙箱无 setTimeout 不抛异常 ---------- */
  {
    const ctx2 = boot({ noTimer: true });
    const ok = vm.runInContext(`
      try {
        Assets.progress = { loaded: 0, total: 1, done: false };
        Assets._loadOne('noneT', 'ok.png');
        true;
      } catch (e) { false; }
    `, ctx2);
    check("⑦ 沙箱无 setTimeout 时不抛异常（行为退回改造前，不新增崩溃点）", ok === true);
    check("⑦ 无定时器时不挂号（守卫生效）",
      vm.runInContext("typeof globalThis.__timers.size === 'number' ? globalThis.__timers.size === 0 : true", ctx2) === true);
  }

  /* ---------- 汇总 ---------- */
  console.log("----------");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  if (failCount > 0) { throw new Error("asset_timeout_test 有 " + failCount + " 条断言失败"); }

})().catch((e) => {
  console.error(String((e && e.message) || e));
  process.exit(1);
});
