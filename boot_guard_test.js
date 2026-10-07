/* 20.6 首屏启动兜底（BootGuard）回归测试（node boot_guard_test.js）
 * 覆盖：① 看门狗超时 → 面板显示
 *       ② 首屏正常（done）→ 看门狗取消、面板不显示
 *       ③ 首屏前 onerror → 立即弹面板；首屏后 → 只记录不弹（isMainReady 双保险）
 *       ④ unhandledrejection 记录与首屏前弹窗
 *       ⑤ 复制诊断信息（含关键字段；无 clipboard 降级 prompt 不抛错）
 *       ⑥ 面板字段渲染（脚本状态 / 素材进度：Assets.progress 缺失→未知）
 *       ⑦ 无 DOM 沙箱下所有方法不抛错（防御式降级）
 *       ⑧ index.html 静态核对：面板 DOM + Game 未定义的加载失败内联兜底脚本
 * 桩：沿用 perf_guard_test.js 的 FakeEl / ClassList / elCache 那套（最完整）。
 * 文案约定：PASS 行内不出现英文字符串 error/Error（避免 run_tests.sh 的 bad 计数误判），
 *          提到错误捕获时统一用中文「错误」或 "err"。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

let checks = 0, fails = 0;
const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };

/* ---- 静态核对：面板 DOM + 加载失败内联兜底 ---- */
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
check("⑧ index.html 存在兜底面板根节点", htmlIds.has("boot-error-panel"));
// 逐个核对面板子节点（输出文案用中文标签，避免 DOM id 里的 error 触发 run_tests.sh 的 bad 计数）
const panelNodes = [
  ["脚本状态字段", "boot-err-scripts"],
  ["素材进度字段", "boot-err-assets"],
  ["错误展示字段", "boot-err-errors"],
  ["重试按钮", "boot-error-retry"],
  ["复制按钮", "boot-error-copy"],
];
for (const pair of panelNodes) {
  check("⑧ index.html 存在" + pair[0], htmlIds.has(pair[1]));
}
// 面板默认 hidden
const panelTag = (html.match(/<div id="boot-error-panel"[^>]*>/) || [""])[0];
check("⑧ 面板默认带 hidden 类", panelTag.indexOf("hidden") >= 0);
// main.js 之后的内联脚本需含 Game 未定义的加载失败兜底
const mainTagMatch = html.match(/<script src="js\/main\.js[^"]*"><\/script>/);
const mainIdx = mainTagMatch ? mainTagMatch.index : -1;
const afterMain = mainIdx >= 0 ? html.slice(mainIdx) : "";
check("⑧ main.js 之后有内联兜底脚本", afterMain.indexOf("<script>") >= 0);
check("⑧ 内联脚本含「脚本加载失败」提示文案", afterMain.indexOf("脚本加载失败") >= 0);
check("⑧ 内联脚本检测 window.Game 是否定义", afterMain.indexOf("undefined") >= 0 && afterMain.indexOf("Game") >= 0);
check("⑧ 内联脚本引用 BootGuard 兜底", afterMain.indexOf("BootGuard") >= 0);

/* ============================================================
 * 沙箱 A：完整 DOM（跑功能与行为断言）
 * ============================================================ */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) { this._cls = v; this.classList = new ClassList(); String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); }); }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v; this.children.length = 0; this._q = null; this._qa = null;
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g; let m;
    while ((m = re.exec(v)) !== null) { const el = new FakeEl(m[1]); el.className = m[3]; el._parent = this; this.children.push(el); }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener(type, fn) { (this._ev = this._ev || {}); (this._ev[type] = this._ev[type] || []).push(fn); }
  dispatch(type, ev) { ((this._ev || {})[type] || []).forEach(fn => fn(ev)); }
  getContext() { return ctxProxy; }
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) { const list = this._findAll(sel.replace(/^\./, "")); this._q[sel] = list[0] || new FakeEl(sel); }
    return this._q[sel];
  }
  _findAll(cls, acc) { acc = acc || []; for (const c of this.children) { if (c.classList && c.classList.contains(cls)) acc.push(c); if (c._findAll) c._findAll(cls, acc); } return acc; }
  querySelectorAll(sel) { this._qa = this._qa || {}; if (!this._qa[sel]) { const list = this._findAll(sel.replace(/^\./, "")); this._qa[sel] = list; this._q = this._q || {}; if (list.length && !this._q[sel]) this._q[sel] = list[0]; } return this._qa[sel]; }
  closest(sel) {
    const sels = String(sel).split(",").map(s => s.trim()).filter(Boolean); let el = this;
    while (el) { for (const s of sels) { if (s.charAt(0) === ".") { if (el.classList && el.classList.contains(s.slice(1))) return el; } else if (s.charAt(0) === "#") { if (el._id === s.slice(1)) return el; } } el = el._parent; }
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  select() { }
}
const ctxProxy = new Proxy({}, {
  get(t, p) { if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) }); if (p in t) return t[p]; return (...a) => undefined; },
  set(t, p, v) { t[p] = v; return true; },
});

/* 独立的作用域环境工厂：每次调用返回一套干净容器，避免用例互相污染 */
function makeEnv(prefill) {
  const elCache = {};
  const doc = {
    head: new FakeEl("head"),
    getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
    execCommand() { return true; },
  };
  Object.defineProperty(doc, "body", { get() { return this.getElementById("body"); }, configurable: true });
  (prefill || []).forEach(id => doc.getElementById(id));   // 预建常用节点（面板等）
  const winHandlers = {};
  const win = {
    addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
    dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
    innerWidth: 1080, innerHeight: 1920, devicePixelRatio: 2,
  };
  const g = {
    document: doc, window: win,
    requestAnimationFrame: (cb) => { g.__raf = cb; },
    Image: class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onerror) this.onerror(); } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13) TestUA", maxTouchPoints: 0 },
    performance: { now: () => Date.now() },
    console: console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    Date: Date, Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON,
    isFinite: isFinite, Uint8ClampedArray: Uint8ClampedArray, Promise: Promise, Set: Set,
  };
  g.self = g; g.global = g;
  return { g, doc, win, elCache };
}

/* 完整 DOM 环境：启动专用计时器捕获（arm 挂看门狗、_installGlobalHandlers 经桩 addEventListener 挂 promise 处理） */
const env = makeEnv(["boot-error-panel", "boot-err-scripts", "boot-err-assets", "boot-err-errors", "boot-error-retry", "boot-error-copy", "screen-main"]);
env.g.__seq = 0;
env.g.__timers = {};
env.g.setTimeout = (fn, ms) => { const id = ++env.g.__seq; env.g.__timers[id] = { fn: fn, ms: ms }; return id; };
env.g.clearTimeout = (id) => { delete env.g.__timers[id]; };

const ctx = vm.createContext(env.g);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__bgFail = () => fails;
  window.__bgChecks = () => checks;
  const panel = get("boot-error-panel");
  const isHidden = () => panel.classList.contains("hidden");
  const runTimers = () => { for (const id in __timers) { const t = __timers[id]; if (t) { delete __timers[id]; t.fn(); } } };
  const clearTimers = () => { for (const id in __timers) delete __timers[id]; };

  /* 复位：加载时 favicon 探针会同步触发一次记录，先把面板/状态清干净，保证用例从干净态开始 */
  window.__bootErrors = [];
  BootGuard._booted = false; BootGuard._armed = false;
  clearTimers();
  BootGuard.hidePanel();

  /* ============ ① 看门狗超时 → 面板显示 ============ */
  check("① BootGuard 就绪（ready=true）", BootGuard.ready === true);
  check("① 看门狗默认 12 秒", BootGuard.TIMEOUT_MS === 12000);
  check("① 复位初始：面板隐藏", isHidden());
  BootGuard.arm();
  check("① arm 后挂上看门狗定时器", Object.keys(__timers).length === 1);
  let tms = null; for (const id in __timers) tms = __timers[id].ms;
  check("① 看门狗定时器延时 = TIMEOUT_MS", tms === 12000);
  runTimers();                       // 模拟 12s 到点
  check("① 超时 → 面板显示（去 hidden）", !isHidden());
  check("① 超时诊断写入全局错误数组（启动超时）", (window.__bootErrors || []).some(e => e.message.indexOf("启动超时") >= 0));
  check("① 超时后错误区展示超时信息", get("boot-err-errors").textContent.indexOf("启动超时") >= 0);

  /* ============ ② 首屏正常 → 取消看门狗、面板不显示 ============ */
  clearTimers();
  window.__bootErrors.length = 0;
  BootGuard._armed = false; BootGuard._booted = false;
  BootGuard.hidePanel();
  BootGuard.arm();
  check("② arm 后定时器存在", Object.keys(__timers).length === 1);
  BootGuard.done();                  // 首屏出现
  check("② done 后看门狗被取消", Object.keys(__timers).length === 0);
  check("② done 后 _booted = true", BootGuard._booted === true);
  BootGuard.arm();                   // 幂等：再次 arm 不应重挂（首屏已出）
  check("② 首屏后重复 arm 不重挂看门狗", Object.keys(__timers).length === 0);
  check("② 首屏正常时面板保持隐藏", isHidden());

  /* ============ ③ 首屏前 / 后 onerror ============ */
  BootGuard._booted = false; BootGuard._armed = false; window.__bootErrors.length = 0;
  BootGuard.hidePanel();
  window.onerror("测试错误A", "js/main.js", 42, 7, { stack: "L1\\nL2\\nL3" });
  check("③ 首屏前 window 错误钩子 → 记录到数组", window.__bootErrors.length === 1);
  check("③ 记录字段含 message/filename/lineno", window.__bootErrors[0].message === "测试错误A" && window.__bootErrors[0].filename === "js/main.js" && window.__bootErrors[0].lineno === "42");
  check("③ stack 保留（前 5 行内）", window.__bootErrors[0].stack.indexOf("L1") >= 0);
  check("③ 首屏前 window 错误钩子 → 面板立即显示", !isHidden());
  check("③ 错误区展示该错误", get("boot-err-errors").textContent.indexOf("测试错误A") >= 0);

  // 首屏后：只记录不弹
  BootGuard._booted = true;
  BootGuard.hidePanel();
  const nBefore = window.__bootErrors.length;
  window.onerror("测试错误B", "js/game.js", 9, 1, null);
  check("③ 首屏后 window 错误钩子 → 仍记录", window.__bootErrors.length === nBefore + 1);
  check("③ 首屏后 window 错误钩子 → 面板不显示", isHidden());

  /* ============ ④ unhandledrejection ============ */
  BootGuard._booted = false;
  BootGuard.hidePanel();
  const nb = window.__bootErrors.length;
  window.dispatchEvent({ type: "unhandledrejection", reason: { message: "promise 拒绝X", stack: "P1\\nP2" } });
  check("④ promise 拒绝 → 记录 message", window.__bootErrors.length === nb + 1 && window.__bootErrors[nb].message === "promise 拒绝X");
  check("④ 首屏前 promise 拒绝 → 面板显示", !isHidden());
  BootGuard._booted = true;
  BootGuard.hidePanel();
  const nc = window.__bootErrors.length;
  window.dispatchEvent({ type: "unhandledrejection", reason: { message: "promise 拒绝Y" } });
  check("④ 首屏后 promise 拒绝 → 只记录不弹面板", window.__bootErrors.length === nc + 1 && isHidden());

  /* ============ ⑤ 复制诊断信息 ============ */
  const savedClip = navigator.clipboard;
  navigator.clipboard = undefined;
  let promptUsed = "";
  window.prompt = (m, t) => { promptUsed = t; return null; };
  let copyThrew = false, copyText = "";
  try { copyText = BootGuard.copy(); } catch (e) { copyThrew = true; }
  check("⑤ 无 clipboard 时不抛错", !copyThrew);
  check("⑤ 降级走 prompt（用户可手抄）", promptUsed.length > 0);
  check("⑤ 诊断文本含标题【启动诊断】", copyText.indexOf("启动诊断") >= 0);
  check("⑤ 诊断文本含脚本状态字段", copyText.indexOf("脚本状态") >= 0);
  check("⑤ 诊断文本含素材进度字段", copyText.indexOf("素材进度") >= 0);
  check("⑤ 诊断文本含 UA 字段", copyText.indexOf("UA") >= 0);
  check("⑤ 诊断文本含错误记录", copyText.indexOf("错误记录") >= 0);
  // clipboard 可用 → 走 clipboard 分支
  let clipUsed = "";
  navigator.clipboard = { writeText(t) { clipUsed = t; return Promise.resolve(); } };
  BootGuard.copy();
  check("⑤ clipboard 可用时调用 writeText", clipUsed.indexOf("启动诊断") >= 0);
  navigator.clipboard = savedClip;

  /* ============ ⑥ 面板字段渲染 ============ */
  BootGuard.showPanel();
  check("⑥ 脚本状态含「Game：√」", get("boot-err-scripts").textContent.indexOf("Game：√") >= 0);
  Assets.progress = { loaded: 12, total: 36, done: false };
  BootGuard.showPanel();
  check("⑥ Assets.progress 存在 → 显示 12/36", get("boot-err-assets").textContent.indexOf("12/36") >= 0);
  delete Assets.progress;
  BootGuard.showPanel();
  check("⑥ Assets.progress 缺失 → 素材显示「未知」", get("boot-err-assets").textContent === "未知");
  // isMainReady：classList 双保险判定（未 done 但 screen-main 已显示 → true）
  BootGuard._booted = false;
  get("screen-main").classList.add("hidden");
  check("⑥ screen-main 隐藏时 isMainReady=false", BootGuard.isMainReady() === false);
  get("screen-main").classList.remove("hidden");
  check("⑥ screen-main 显示时 isMainReady=true（漏调 done 也能救）", BootGuard.isMainReady() === true);
  // 重试：location 缺失 → 返回 false 不抛错
  check("⑥ retry 无 location 时安全返回", BootGuard.retry() === false);

  window.__bgDone = true;
`, ctx, { filename: "driver-full" });

/* ============================================================
 * 沙箱 B：无 DOM（typeof document === "undefined"）→ 全部安全跳过
 * ============================================================ */
const envB = (() => {
  const g = {
    window: { addEventListener() { }, dispatchEvent() { return true; } },
    setTimeout: (fn) => 0, clearTimeout() { },
    console: console, Date: Date, Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON,
    Image: class { set src(v) { } }, Promise: Promise, Set: Set, isFinite: isFinite,
  };
  return vm.createContext(g);
})();
envB.__sa = fs.readFileSync(path.join(__dirname, "js/main.js"), "utf8");
// 抽出 BootGuard 独立区块（从注释「20.6 首屏启动兜底（BootGuard）」起），单独在无 DOM 沙箱执行。
// 之所以不整份 main.js 加载：其底部 Game.loadSettings() 会访问 document，本就依赖 DOM；
// 而 BootGuard 被设计为「无 DOM 也能静默降级」，正好单独验证这一点。
/* 抽取范围 = BootGuard 区块起点 → 下一个区块头（而非文件末尾）。
 * 动因：main.js 采用 §5.45「尾部追加独立区块」范式，每次新增区块都会落到 BootGuard 之后；
 *      首版实现切到文件末尾，会被后续区块（22.1 共享工具 / 23.x 画质档）牵连——
 *      那些区块在无 DOM 沙箱下会因缺少 window 而抛错，导致本测试误报。
 *      按「区块边界」截断后，本测试只验证 BootGuard 自身的无 DOM 降级能力。 */
const BG_MARK = "/* ============================================================\n * 20.6 首屏启动兜底（BootGuard）";
const bgStart = envB.__sa.indexOf(BG_MARK);
let bgEnd = envB.__sa.length;
if (bgStart >= 0) {
  // 找下一个「行首的区块注释头」（形如 /* ===== 开头）作为结束位置
  const rest = envB.__sa.slice(bgStart + BG_MARK.length);
  const nextHead = rest.search(/\n\/\* ={20,}/);
  if (nextHead >= 0) bgEnd = bgStart + BG_MARK.length + nextHead;
}
const bgBlock = bgStart >= 0 ? envB.__sa.slice(bgStart, bgEnd) : "";
// 无 DOM 沙箱：document / navigator / performance 均刻意不注入
let noDom = null;
try {
  vm.runInContext(bgBlock, envB, { filename: "bootguard-block" });
  noDom = vm.runInContext(`
    let ok = true, threw = "";
    try {
      BootGuard.ensure();
      BootGuard.arm();
      BootGuard.record("无DOM错误", "js/x.js", 1, "s");
      BootGuard.showPanel();
      BootGuard.hidePanel();
      BootGuard.copy();
      BootGuard.retry();
      BootGuard.diagText();
      var isReadyBeforeDone = BootGuard.isMainReady();
      BootGuard.done();   // done 后 _booted=true（不再断言 isReady）
    } catch (e) { ok = false; threw = String(e && e.message); }
    ({ ok: ok, threw: threw, ready: BootGuard.ready,
       showRet: BootGuard.showPanel(), hideRet: BootGuard.hidePanel(),
       copyLen: BootGuard.copy().length, isReady: isReadyBeforeDone });
  `, envB, { filename: "driver-nodom" });
} catch (e) { noDom = { ok: false, threw: String(e && e.message) }; }
check("⑦ 无 DOM 沙箱：所有方法不抛错", noDom && noDom.ok === true);
check("⑦ 无 DOM 时 ensure 不置 ready（无 DOM 跳过）", noDom && noDom.ready === false);
check("⑦ 无 DOM 时 showPanel 返回 false（静默降级）", noDom && noDom.showRet === false);
check("⑦ 无 DOM 时 hidePanel 返回 false（静默降级）", noDom && noDom.hideRet === false);
check("⑦ 无 DOM 时 copy 仍返回诊断文本（不抛错）", noDom && typeof noDom.copyLen === "number" && noDom.copyLen > 0);
check("⑦ 无 DOM 时 isMainReady=false（安全兜底）", noDom && noDom.isReady === false);

/* ============================================================
 * 沙箱 C：BootGuard 缺席时，index.html 的纯 DOM 内联兜底可独立工作
 * （模拟 main.js 完全没执行：Game / BootGuard 均未定义）
 * ============================================================ */
const envC = (() => {
  const elCache = {};
  const doc = {
    getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
    createElement(tag) { return new FakeEl(tag); },
  };
  Object.defineProperty(doc, "body", { get() { return this.getElementById("body"); }, configurable: true });
  (["boot-error-panel", "boot-err-scripts", "boot-err-assets", "boot-err-errors", "boot-error-retry", "boot-error-copy"]).forEach(id => doc.getElementById(id));
  const g = {
    document: doc,
    navigator: { userAgent: "UA-Test", clipboard: { writeText() { } } },
    location: { reload() { g.__reloaded = true; } },
    window: { prompt() { return null; } },
    console: console, Date: Date, Math: Math, Number: Number, String: String, Array: Array, Object: Object, JSON: JSON,
  };
  return { g: g, doc: doc, elCache: elCache };
})();
// 抽出 index.html 中 main.js 之后的内联兜底脚本片段（含脚本体，不含 <script> 标签）
const afterMainIdx = mainIdx;
const tailHTML = html.slice(afterMainIdx);
const inlineMatch = tailHTML.match(/<script>([\s\S]*?)<\/script>/);
const inlineBody = inlineMatch ? inlineMatch[1] : "";
check("⑧ 能抽取到内联兜底脚本体", inlineBody.length > 0);

const cctx = vm.createContext(envC.g);
let cThrew = false;
try { vm.runInContext(inlineBody, cctx, { filename: "inline-fallback" }); } catch (e) { cThrew = true; }
check("⑧ 无 Game/无 BootGuard 时内联兜底不抛错", !cThrew);
check("⑧ 内联兜底 → 面板显示", !envC.doc.getElementById("boot-error-panel").classList.contains("hidden"));
check("⑧ 内联兜底 → 提示「脚本加载失败」", envC.doc.getElementById("boot-err-errors").textContent.indexOf("脚本加载失败") >= 0);
check("⑧ 内联兜底 → 脚本状态标 Game 未定义", envC.doc.getElementById("boot-err-scripts").textContent.indexOf("×") >= 0);
// 重试按钮触发 reload
envC.doc.getElementById("boot-error-retry").onclick();
check("⑧ 内联兜底「重试」按钮触发整页重载", envC.g.__reloaded === true);

/* ---- ⑨ 防回归：favicon 探针不得复活（20.6a 实测其 404 会在首屏前误弹面板盖住首页） ---- */
const fsSrc = require("fs").readFileSync("js/main.js", "utf8");
check("⑨ main.js 无探针 Image 标志（_image 已删）", fsSrc.indexOf("BootGuard._image") < 0);
check("⑨ main.js 无探针赋值语句", fsSrc.indexOf('.src = "favicon') < 0 && fsSrc.indexOf('.src="favicon') < 0);

/* ---- 汇总 ---- */
const rChecks = ctx.window.__bgChecks ? ctx.window.__bgChecks() : 0;
const rFails = ctx.window.__bgFail ? ctx.window.__bgFail() : 0;
const totalChecks = checks + rChecks;
const totalFails = fails + rFails;
console.log("PASS 合计 = " + totalChecks + "   失败数 = " + totalFails);
if (totalFails > 0) { throw new Error("BOOT GUARD TEST FAILED"); }
console.log("BOOT GUARD TEST OK");
