/* 20.5 运行时性能护栏 + 诊断面板 回归测试（node perf_guard_test.js）
 * 覆盖：① 帧统计纯函数（perfFrameStats：p50/p95/卡死帧计数）
 *       ② 帧护栏告警冷却（连续 ≥2 帧 >150ms 只提示一次；30s 内不重复）
 *       ③ 设置页诊断区块（字段渲染；Assets.progress 缺失→未知，存在→真实数字）
 *       ④ 复制诊断信息（含关键字段；navigator.clipboard 缺失不抛异常）
 *       ⑤ 素材加载遮罩（接口缺失→立即隐藏；存在→显示百分比；超时兜底隐藏）
 *       ⑥ 低画质开关（G.settings.lowQuality + window.__lowQuality 契约读写）
 *       ⑦ 回归：设置界面既有项（set-sfx/set-joy/set-touch）仍正常渲染
 * 桩：复制 ui_v2_test.js 的 FakeEl / ClassList / elCache / winHandlers 那套（最完整）。 */
"use strict";

/* ---- DOM 桩（同 ui_v2_test.js） ---- */
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
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  _findAll(cls, acc) {
    acc = acc || [];
    for (const c of this.children) {
      if (c.classList && c.classList.contains(cls)) acc.push(c);
      if (c._findAll) c._findAll(cls, acc);
    }
    return acc;
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
  select() { }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const elCache = {};
global.document = {
  getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  execCommand() { return true; },
};
Object.defineProperty(global.document, "body", { get() { return this.getElementById("body"); }, configurable: true });
const winHandlers = {};
global.window = {
  addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
  dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
  innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 2,
};
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
Object.defineProperty(global, "navigator", {
  value: { userAgent: "Mozilla/5.0 (Linux; Android 13) TestUA", maxTouchPoints: 0 },
  configurable: true, writable: true,
});
global.performance = { now: () => Date.now() };

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 静态核对：index.html / css 中的 20.5 元素与规则存在 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
let okStatic = true;
const staticCheck = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };
for (const id of ["perf-diag", "perf-fps", "perf-p50p95", "perf-maxstuck", "perf-stuck",
  "perf-assets", "perf-dpr", "perf-viewport", "perf-orient", "perf-ua",
  "btn-perf-copy", "set-lowq", "loading-overlay", "loading-bar", "loading-text"]) {
  staticCheck("index.html 存在 #" + id, htmlIds.has(id));
}
staticCheck("CSS 含 20.5 标记段落", css.indexOf("/* 20.5 性能护栏 */") >= 0 || css.indexOf("20.5 性能护栏") >= 0);
staticCheck("CSS 含 .loading-overlay 规则", css.indexOf(".loading-overlay") >= 0);
staticCheck("CSS 含 .perf-diag 规则", css.indexOf(".perf-diag") >= 0);

/* ---- 加载脚本 + 驱动 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__pgFail = () => fails;
  window.__pgChecks = () => checks;

  /* ============ ① 帧统计纯函数（perfFrameStats） ============ */
  const S = perfFrameStats([10, 20, 30, 40, 50], 80);
  check("① 空数组：p50/p95/stuck=0 不抛错", (() => { const e = perfFrameStats([], 80); return e.p50 === 0 && e.p95 === 0 && e.stuck === 0 && e.fps === 0; })());
  check("① count = 输入长度", S.count === 5);
  check("① avg = 均值 30", S.avg === 30);
  check("① max = 最长 50", S.max === 50);
  // p50：floor(0.5*5)=idx2 → 30
  check("① p50 = 30（idx floor(0.5n)）", S.p50 === 30);
  // p95：floor(0.95*5)=idx4 → 50
  check("① p95 = 50", S.p95 === 50);
  check("① fps = 1000/avg", Math.abs(S.fps - 1000 / 30) < 1e-9);
  // 卡死帧：>80 计 1
  const S2 = perfFrameStats([16, 100, 200, 79, 81], 80);
  check("① 卡死帧计数：>80 共 3 帧（100/200/81）", S2.stuck === 3);
  check("① 卡死帧计数边界：79 不算、81 算", perfFrameStats([79], 80).stuck === 0 && perfFrameStats([81], 80).stuck === 1);
  check("① 默认阈值 80ms", perfFrameStats([100], undefined).stuck === 1);
  // 纯函数：不改动入参数组
  const src = [50, 10, 30, 20, 40];
  const copy = src.slice();
  perfFrameStats(src, 80);
  check("① 纯函数不改动入参数组", src.join(",") === copy.join(","));

  /* ============ ② 帧护栏采样 + 告警冷却 ============ */
  PerfGuard.reset();
  const fakeUI = { toasts: [], toast(msg, cls) { this.toasts.push({ msg: msg, cls: cls }); } };
  // 首帧仅定基准（lastT），不产生间隔样本
  let t = 1000;
  PerfGuard.sample(t, fakeUI);
  check("② 首帧不产生间隔样本（count=0）", PerfGuard.snapshot().count === 0);
  // 正常帧：无告警
  for (let i = 0; i < 10; i++) { t += 16; PerfGuard.sample(t, fakeUI); }
  check("② 正常帧零告警", fakeUI.toasts.length === 0);
  const snap = PerfGuard.snapshot();
  check("② 快照窗口 count = 采样帧数（10）", snap.count === 10);
  check("② 快照 p95 反映 16ms 帧", snap.p95 === 16);
  // 连续 2 帧 >150ms → 告警一次
  t += 200; PerfGuard.sample(t, fakeUI);
  check("② 单帧卡死不告警（未达连续 2 帧）", fakeUI.toasts.length === 0);
  t += 200; PerfGuard.sample(t, fakeUI);
  check("② 连续 2 帧 >150ms → 告警一次", fakeUI.toasts.length === 1);
  check("② 告警文本含「卡顿」与帧耗时", fakeUI.toasts[0].msg.indexOf("卡顿") >= 0 && fakeUI.toasts[0].msg.indexOf("200ms") >= 0);
  // 冷却：30s 内再次连续卡死不重复
  t += 200; PerfGuard.sample(t, fakeUI);
  t += 200; PerfGuard.sample(t, fakeUI);
  check("② 30s 冷却内不重复告警", fakeUI.toasts.length === 1);
  // 时间推进 31s 后恢复告警能力（再连续 2 帧卡死）
  t += 31000; PerfGuard.sample(t, fakeUI);
  t += 200; PerfGuard.sample(t, fakeUI);
  t += 200; PerfGuard.sample(t, fakeUI);
  check("② 冷却结束后恢复告警能力", fakeUI.toasts.length === 2);
  // assert 接口缺失（无 UI）不抛错
  PerfGuard.reset();
  let threw = false;
  try { let u = 0; PerfGuard.sample(u, null); for (let i = 0; i < 5; i++) { u += 200; PerfGuard.sample(u, null); } } catch (e) { threw = true; }
  check("② 无 UI 注入时告警不抛错", !threw);

  /* ============ ③ 设置页诊断面板 ============ */
  Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();

  // Assets.progress 缺失 → 渲染不崩、素材显示「未知」
  delete Assets.progress;
  PerfGuard.reset();
  UI.renderSettings();
  check("③ 诊断区块存在（perf-diag）", !!get("perf-diag"));
  check("③ Assets.progress 缺失 → 素材显示「未知」", get("perf-assets").textContent === "未知");
  check("③ 缺进度接口 renderSettings 不崩", true);
  check("③ 视口字段含尺寸", get("perf-viewport").textContent.indexOf("x") >= 0 || get("perf-viewport").textContent.indexOf("×") >= 0);
  check("③ 设备像素比字段 = window.devicePixelRatio", get("perf-dpr").textContent === "2");
  check("③ 屏幕方向字段为竖屏/横屏", get("perf-orient").textContent === "竖屏" || get("perf-orient").textContent === "横屏");
  check("③ UA 字段非空", get("perf-ua").textContent.length > 0);

  // Assets.progress 存在 → 显示真实数字
  Assets.progress = { loaded: 12, total: 36, done: false };
  UI.renderPerfDiag();
  check("③ Assets.progress 存在 → 显示 12/36", get("perf-assets").textContent.indexOf("12/36") >= 0);
  check("③ 帧率字段显示 FPS 或采样中", get("perf-fps").textContent.indexOf("FPS") >= 0 || get("perf-fps").textContent.indexOf("采样") >= 0);
  check("③ p50/p95 字段含 ms", get("perf-p50p95").textContent.indexOf("ms") >= 0);
  check("③ 最长卡死帧字段含 ms", get("perf-maxstuck").textContent.indexOf("ms") >= 0);
  delete Assets.progress;

  /* ============ ④ 复制诊断信息 ============ */
  // clipboard 缺失 → 降级不抛异常
  const savedClip = navigator.clipboard;
  navigator.clipboard = undefined;
  let copyThrew = false, copyText = "";
  try { copyText = UI.copyPerfDiag(); } catch (e) { copyThrew = true; }
  check("④ clipboard 缺失时不抛异常", !copyThrew);
  check("④ 复制文本含「性能诊断」头", copyText.indexOf("性能诊断") >= 0);
  check("④ 复制文本含帧率字段", copyText.indexOf("帧率") >= 0);
  check("④ 复制文本含设备像素比字段", copyText.indexOf("设备像素比") >= 0);
  check("④ 复制文本含 UA 字段", copyText.indexOf("UA") >= 0);
  // clipboard 存在 → 走 clipboard 分支
  let clipUsed = "";
  navigator.clipboard = { writeText(t) { clipUsed = t; return Promise.resolve(); } };
  UI.copyPerfDiag();
  check("④ clipboard 可用时调用 writeText", clipUsed.indexOf("性能诊断") >= 0);
  navigator.clipboard = savedClip;

  /* ============ ⑤ 素材加载遮罩 ============ */
  const ov = get("loading-overlay"), bar = get("loading-bar"), ltxt = get("loading-text");
  // 接口缺失 → 立即隐藏（不卡白屏）
  LoadingOverlay.hide(true);
  LoadingOverlay.show(() => null);
  check("⑤ 进度接口缺失 → 遮罩立即 hidden", ov.classList.contains("hidden"));
  // 接口存在 → 显示百分比
  LoadingOverlay.hide(true);
  let ph = { loaded: 3, total: 12, done: false };
  LoadingOverlay.show(() => ph);
  check("⑤ 进度接口存在 → 遮罩显示（去 hidden）", !ov.classList.contains("hidden"));
  check("⑤ 显示真实百分比 3/12=25%", bar.style.width === "25%" && ltxt.textContent.indexOf("3/12") >= 0);
  // 同步已完成（done=true 首帧）→ 立即进入淡出隐藏流程
  LoadingOverlay.hide(true);
  LoadingOverlay.show(() => ({ loaded: 12, total: 12, done: true }));
  check("⑤ done=true 首帧即淡出（loading-fade）", ov.classList.contains("loading-fade"));
  // 轮询推进：捕获 setTimeout 以同步驱动 tick；进度到 done → 淡出隐藏
  const realSetTimeout = setTimeout;
  let pendingTick = null;
  global.setTimeout = (fn, ms) => { pendingTick = fn; return 1; };
  LoadingOverlay.hide(true);
  ph = { loaded: 3, total: 12, done: false };
  LoadingOverlay.show(() => ph);
  check("⑤ 轮询前遮罩可见", !ov.classList.contains("hidden"));
  ph = { loaded: 12, total: 12, done: true };   // 进度推进到完成
  if (pendingTick) pendingTick();               // 驱动一次 tick
  check("⑤ 轮询到 done → 淡出隐藏", ov.classList.contains("loading-fade"));
  // 超时兜底：起始时间人为过期 → tick 隐藏
  LoadingOverlay.hide(true);
  pendingTick = null;
  LoadingOverlay.show(() => ({ loaded: 1, total: 100, done: false }));
  LoadingOverlay._startAt = performance.now() - LoadingOverlay.TIMEOUT_MS - 1;
  if (pendingTick) pendingTick();
  check("⑤ 超时兜底 → 淡出隐藏", ov.classList.contains("loading-fade"));
  // 接口中途消失 → 立即隐藏（防御）
  LoadingOverlay.hide(true);
  pendingTick = null;
  let callCount = 0;
  LoadingOverlay.show(() => { callCount++; return callCount >= 2 ? null : { loaded: 1, total: 10, done: false }; });
  if (pendingTick) pendingTick();   // 第二次返回 null
  check("⑤ 接口中途消失 → 立即 hidden", ov.classList.contains("hidden"));
  global.setTimeout = realSetTimeout;
  LoadingOverlay.hide(true);

  /* ============ ⑥ 低画质开关（契约） ============ */
  G.settings.lowQuality = false;
  Game.applySettings();
  check("⑥ 默认低画质关 → window.__lowQuality=false", window.__lowQuality === false);
  G.settings.lowQuality = true;
  Game.applySettings();
  check("⑥ 开启后 window.__lowQuality=true（契约暴露）", window.__lowQuality === true);
  UI.renderSettings();
  check("⑥ 开关按钮文案同步为「开」", get("set-lowq").textContent === "开");
  check("⑥ 开关按钮带 on 类", get("set-lowq").classList.contains("on"));
  // 点击切换
  get("set-lowq").onclick();
  check("⑥ 点击后 lowQuality 翻转为 false", G.settings.lowQuality === false);
  check("⑥ 点击后 window.__lowQuality 随之为 false", window.__lowQuality === false);

  /* ============ ⑦ 回归：设置界面既有项仍正常 ============ */
  G.settings.sfxVolume = 0.5; G.settings.joyScale = 1.2; G.settings.showTouchOnDesktop = true;
  UI.renderSettings();
  check("⑦ 既有项 set-sfx 正常写入", String(get("set-sfx").value) === "0.5");
  check("⑦ 既有项 set-joy 正常写入", String(get("set-joy").value) === "1.2");
  check("⑦ 既有项 set-touch 正常（on 类）", get("set-touch").classList.contains("on"));
  check("⑦ 诊断区块与既有项共存", !!get("perf-diag") && !!get("set-sfx"));

  Game.backToMenu();
`, ctx, { filename: "driver" });

console.log("---- 静态核对 ----");
console.log(okStatic ? "PERF GUARD STATIC OK" : "PERF GUARD STATIC FAILED");

const checks = ctx.window.__pgChecks();
const fails = ctx.window.__pgFail();
console.log("条目合计 = " + checks + "  失败 = " + fails);
if (!okStatic || fails > 0) throw new Error("PERF GUARD TEST FAILED");
console.log("PERF GUARD TEST OK");
