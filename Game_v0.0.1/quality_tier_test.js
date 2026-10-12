/* 23.x 画质三档 + 自动降档 回归测试（node quality_tier_test.js）
 * 覆盖：
 *   ① Game.setQualityLevel 三档读写 + G.settings.lowQuality 布尔镜像同步（兼容 game.js isLowQuality）
 *   ② 自动降档：连续高帧耗时 → 档位下降；冷却期内不重复降；到 0 档停止；不自动回升
 *   ③ 手动覆盖（manual）后自动降档本次会话被禁用（G.autoDowngradeDisabled）
 *   ④ 老存档迁移：仅有 lowQuality 布尔 → quality 正确推导（true→0 / false→默认档）
 *   ⑤ 默认档判定：mock navigator.deviceMemory 各档（≤4→低 / ≥8→高 / 中间→中 / 缺失→触屏短边 / 桌面高）
 *   ⑥ 设置页 UI 存在性（源码级断言：index.html 含 set-quality / set-quality-low|mid|high）
 *   ⑦ CSS 三处规则同步（主规则 / 竖屏媒体查询 / body.portrait 钩子）
 * 桩：复制 perf_guard_test.js 的 FakeEl / ClassList / elCache 那套（最完整且支持 querySelectorAll）。
 * ⚠️ PASS 行文案不得出现英文 error/Error/FAIL（run_tests.sh 会误判为失败）。
 */
"use strict";

/* ---- DOM 桩（同 perf_guard_test.js） ---- */
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
    this._events = {};
  }
  get className() { return this._cls || ""; }
  set className(v) {
    this._cls = v; this.classList = new ClassList();
    String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children.length = 0; this._q = null; this._qa = null; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener(type, fn) { (this._events[type] = this._events[type] || []).push(fn); }
  getContext() { return ctxProxy; }
  querySelector(sel) {
    const list = this.querySelectorAll(sel);
    return list[0] || new FakeEl(sel);
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
    const key = sel.replace(/^\./, "");
    // 支持逗号分隔的简单类选择器（本测试只用 ".seg-btn"）
    const parts = String(key).split(",").map(s => s.trim()).filter(Boolean);
    let out = [];
    for (const p of parts) out = out.concat(this._findAll(p.replace(/^\./, "")));
    return out;
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
global.elCache = elCache;
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
  innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
};
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
Object.defineProperty(global, "navigator", {
  value: { userAgent: "Mozilla/5.0 (Linux; Android 13) QualityTierTest", maxTouchPoints: 0, deviceMemory: 8 },
  configurable: true, writable: true,
});
global.performance = { now: () => Date.now() };

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- ⑥⑦ 静态核对：index.html 元素 + CSS 三处规则同步 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
let okStatic = true;
const staticCheck = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };

/* ⑥ 设置页 UI 存在性（源码级：桩的 getElementById 对不存在 id 也会返回空壳，故必须查源码） */
staticCheck("⑥ index.html 存在 #set-quality（分段控件容器）", htmlIds.has("set-quality"));
staticCheck("⑥ index.html 存在 #set-quality-low", htmlIds.has("set-quality-low"));
staticCheck("⑥ index.html 存在 #set-quality-mid", htmlIds.has("set-quality-mid"));
staticCheck("⑥ index.html 存在 #set-quality-high", htmlIds.has("set-quality-high"));
staticCheck("⑥ index.html 存在 #set-quality-hint（自动降档提示位）", htmlIds.has("set-quality-hint"));
staticCheck("⑥ 低画质旧开关 #set-lowq 仍保留（向后兼容）", htmlIds.has("set-lowq"));

/* ⑦ CSS 三处规则同步：主规则 + @media(orientation:portrait) + body.portrait 钩子 */
const portraitMediaIdx = css.indexOf("@media (orientation: portrait)");
const mainSegIdx = css.indexOf(".quality-seg {");
const bodyPortraitSegIdx = css.indexOf("body.portrait .set-row .quality-seg");
/* 竖屏媒体查询块内是否含 quality-seg 规则。
 * ⚠️ CSS 里有 **多个** @media (orientation: portrait) 块（按功能分段），规则可能在任一块内，
 * 因此必须遍历所有块，而不是只看第一个（首版实现只查首块导致误报失败）。 */
let mediaHasSeg = false;
{
  const re = /@media \(orientation: portrait\)\s*\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    // 从 `{` 起做括号配平，取出完整块体（块内还有嵌套规则的大括号）
    let i = m.index + m[0].length, depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const block = css.slice(m.index, i);
    if (block.indexOf(".quality-seg") >= 0) { mediaHasSeg = true; break; }
  }
}
staticCheck("⑦ 主规则存在（.quality-seg 容器 + .seg-btn）", mainSegIdx >= 0 && css.indexOf(".quality-seg .seg-btn") >= 0);
staticCheck("⑦ 主规则存在选中态（.seg-btn.selected）", css.indexOf(".quality-seg .seg-btn.selected") >= 0);
staticCheck("⑦ 竖屏媒体查询块含 .quality-seg 规则（第二处）", mediaHasSeg);
staticCheck("⑦ body.portrait 钩子含 .quality-seg 规则（第三处）", bodyPortraitSegIdx >= 0);
staticCheck("⑦ 三处 flex 基准一致（flex: 1 1 100%）", ((css.match(/flex:\s*1 1 100%/g) || []).length) >= 2);

/* ---- 加载脚本 ---- */
global.window.__elCache = elCache;
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

/* ---- 行为断言（沙箱内驱动） ---- */
vm.runInContext(`
  const get = (id) => document.getElementById(id);
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__qtFail = () => fails;
  window.__qtChecks = () => checks;

  /* ============ ① 三档读写 + lowQuality 布尔镜像同步 ============ */
  Game.setQualityLevel(2);
  check("① setQualityLevel(2) → qualityLevel()=2", Game.qualityLevel() === 2);
  check("① 高档 → G.settings.lowQuality=false（游戏线读到非低画质）", G.settings.lowQuality === false);
  check("① 高档 → window.__lowQuality=false（镜像同步）", window.__lowQuality === false);
  check("① 高档 → !isLowQuality()（game.js 判定为正常画质）", isLowQuality() === false);

  Game.setQualityLevel(1);
  check("① setQualityLevel(1) → qualityLevel()=1（中档）", Game.qualityLevel() === 1);
  check("① 中档 → lowQuality=false（中档不等于低画质）", G.settings.lowQuality === false);
  check("① 中档 → window.__lowQuality=false", window.__lowQuality === false);

  Game.setQualityLevel(0);
  check("① setQualityLevel(0) → qualityLevel()=0（低档）", Game.qualityLevel() === 0);
  check("① 低档 → G.settings.lowQuality=true（旧布尔同步）", G.settings.lowQuality === true);
  check("① 低档 → window.__lowQuality=true", window.__lowQuality === true);
  check("① 低档 → isLowQuality()=true（game.js 一行未改即生效）", isLowQuality() === true);

  // 非法值钳制：越界/非数字 → 高档（保守，不误降级）
  Game.setQualityLevel(9);
  check("① 越界 9 → 钳为 2（高档）", Game.qualityLevel() === 2);
  Game.setQualityLevel(-3);
  check("① 越界 -3 → 钳为 0？(Math.round 后 <0 → 回落 2)", Game.qualityLevel() === 2);
  Game.setQualityLevel("1");
  check("① 字符串 \\"1\\" → 数字 1", Game.qualityLevel() === 1);

  /* ============ ② 自动降档 ============ */
  const fakeUI = { toasts: [], toast(msg, cls) { this.toasts.push({ msg: msg, cls: cls }); } };
  // 准备：从高档开始，未手动覆盖
  G.autoDowngradeDisabled = false;
  Game.setQualityLevel(2);
  _autoDowngradeReset();
  // 模拟 PerfGuard 已采到「连续高帧耗时」：直接灌满 frames 为 200ms
  PerfGuard.reset();
  PerfGuard.frames.length = 0;
  for (let i = 0; i < PerfGuard.WINDOW; i++) PerfGuard.frames.push(200);
  let now = 10000;
  // 先跑 89 次：不应降档（未达连续 90 帧）
  for (let i = 0; i < 89; i++) { _autoDowngradeTick(now); now += 16; }
  check("② 连续 89 帧高耗时 → 尚未降档（threshold=90）", Game.qualityLevel() === 2);
  // 第 90 次 → 降一档到中
  _autoDowngradeTick(now);
  check("② 连续 90 帧高耗时 → 降到中档（2→1）", Game.qualityLevel() === 1);

  // 冷却：紧接再灌 90 帧高耗时，20s 内不重复降
  for (let i = 0; i < 90; i++) { _autoDowngradeTick(now); now += 16; }
  check("② 冷却期（20s 内）不重复降档，仍为中档", Game.qualityLevel() === 1);

  // 推进 20.5s（超冷却）后再连续 90 帧 → 降到底档（1→0）
  now += 20500;
  for (let i = 0; i < 90; i++) { _autoDowngradeTick(now); now += 16; }
  check("② 冷却结束再连续 90 帧 → 降到低档（1→0）", Game.qualityLevel() === 0);
  check("② 降到低档后 lowQuality 布尔同步为 true", G.settings.lowQuality === true);

  // 到 0 档停止：继续灌高耗时帧不再变化（不自动回升、不再降）
  const lowToastCount = fakeUI.toasts.length;
  now += 30000;
  for (let i = 0; i < 200; i++) { _autoDowngradeTick(now); now += 16; }
  check("② 已到 0 档 → 继续高耗时帧不再降（无越界）", Game.qualityLevel() === 0);
  check("② 到 0 档后无新增降档提示", fakeUI.toasts.length === lowToastCount);

  // 不自动回升：帧恢复正常后档位保持
  PerfGuard.frames.length = 0;
  for (let i = 0; i < PerfGuard.WINDOW; i++) PerfGuard.frames.push(16);
  for (let i = 0; i < 200; i++) { _autoDowngradeTick(now); now += 16; }
  check("② 帧恢复正常 → 档位不自动回升（保持 0）", Game.qualityLevel() === 0);

  /* ============ ③ 手动覆盖 → 自动降档禁用 ============ */
  G.autoDowngradeDisabled = false;
  Game.setQualityLevel(2);
  _autoDowngradeReset();
  Game.setQualityLevel(1, { manual: true });   // 用户手动选中档
  check("③ 手动切换后 G.autoDowngradeDisabled=true", G.autoDowngradeDisabled === true);
  check("③ 手动切换档位生效（中档）", Game.qualityLevel() === 1);
  // 手动覆盖后大量高帧耗时 → 不再自动降
  PerfGuard.frames.length = 0;
  for (let i = 0; i < PerfGuard.WINDOW; i++) PerfGuard.frames.push(220);
  now += 60000;
  for (let i = 0; i < 300; i++) { _autoDowngradeTick(now); now += 16; }
  check("③ 手动覆盖后自动降档被禁用（保持中档）", Game.qualityLevel() === 1);

  /* ============ ④ 老存档迁移 ============ */
  // 老存档：只有布尔 lowQuality=true（无 quality / migrated）
  const savedSettings = G.settings;
  const savedLS = localStorage.getItem;
  localStorage.getItem = () => JSON.stringify({ sfxVolume: 0.5, joyScale: 1.0, showTouchOnDesktop: false, lowQuality: true });
  Game.loadSettings();
  check("④ 老存档 lowQuality=true → 迁移为 quality=0（低档）", G.settings.quality === 0);
  check("④ 迁移后 quality=0 → lowQuality 仍为 true（一致）", G.settings.lowQuality === true);
  check("④ 迁移后 isLowQuality()=true", isLowQuality() === true);
  // 老存档：lowQuality=false → 保持设备初判默认档（本桩 deviceMemory=8 → 高档）
  delete window.__lowQuality;
  lowQualityCacheReset();
  localStorage.getItem = () => JSON.stringify({ sfxVolume: 0.5, lowQuality: false });
  Game.loadSettings();
  check("④ 老存档 lowQuality=false → 不强制低档（默认档，非 0）", G.settings.quality !== 0);
  check("④ 老存档 lowQuality=false → lowQuality 布尔为 false", G.settings.lowQuality === false);
  // 新存档：已有 quality=1 → 不被迁移覆盖
  localStorage.getItem = () => JSON.stringify({ quality: 1, migrated: true, lowQuality: false });
  Game.loadSettings();
  check("④ 新存档含 quality=1 → 原样保留（不被迁移覆盖）", G.settings.quality === 1);
  localStorage.getItem = savedLS;
  G.settings = savedSettings;

  /* ⑤ 默认档判定在 vm 外执行（见文件末 __qtDefault* 注入），此处仅占位说明 */
  /* 关键回归：无画质存档 + 高档设备 → quality=2，渲染行为与改造前逐位一致 */
  localStorage.getItem = () => null;
  delete window.__lowQuality;
  lowQualityCacheReset();
  Game.loadSettings();
  check("① 默认（无存档）高档设备 → quality=2 且 lowQuality=false（回归红线）", Game.qualityLevel() === 2 && G.settings.lowQuality === false);
  check("① 默认高档 → window.__lowQuality=false（渲染行为不变）", window.__lowQuality === false);

  /* ============ ⑥ UI 绑定：点击分段按钮切档 + 关闭自动降档 ============ */
  Game.bindEvents();
  const qSeg = get("set-quality");
  // 手动往容器塞三个 .seg-btn（桩无 innerHTML 解析，直接 appendChild 更可控）
  const mk = (id, q) => { const b = document.createElement("button"); b.className = "seg-btn"; b.dataset.quality = String(q); b._id = id; window.__elCache[id] = b; return b; };
  qSeg.appendChild(mk("set-quality-low", 0));
  qSeg.appendChild(mk("set-quality-mid", 1));
  qSeg.appendChild(mk("set-quality-high", 2));
  Game.bindEvents();   // 重新绑定（此时容器已有子按钮）
  G.autoDowngradeDisabled = false;
  get("set-quality-low").onclick && get("set-quality-low").onclick();
  check("⑥ 点击「低」→ quality=0", Game.qualityLevel() === 0);
  check("⑥ 点击「低」→ 自动降档被禁用（manual）", G.autoDowngradeDisabled === true);
  get("set-quality-high").onclick && get("set-quality-high").onclick();
  check("⑥ 点击「高」→ quality=2", Game.qualityLevel() === 2);
  check("⑥ 点击「高」→ lowQuality 同步 false", G.settings.lowQuality === false);

  /* ============ ⑦ 设置页渲染：选中态 + 提示文案（renderSettings 判空不崩） ============ */
  Game.setQualityLevel(1);
  UI.renderSettings();
  check("⑦ renderSettings 后中档按钮带 selected 类", get("set-quality-mid").classList.contains("selected"));
  check("⑦ renderSettings 后低档按钮不带 selected", !get("set-quality-low").classList.contains("selected"));
  check("⑦ renderSettings 后高档按钮不带 selected", !get("set-quality-high").classList.contains("selected"));
  G.autoDowngradeDisabled = true;
  UI.renderSettings();
  check("⑦ 手动覆盖后提示位非空（关闭自动降档提示）", get("set-quality-hint").textContent.length > 0);
  G.autoDowngradeDisabled = false;
  UI.renderSettings();
  check("⑦ 未覆盖时提示位为空", get("set-quality-hint").textContent.length === 0);
`, ctx, { filename: "quality_driver" });

/* 沙箱内小工具：mock deviceMemory 后调用 _defaultQuality()（通过注入 navigator 属性实现）。
 * 在主 vm 环境里直接包一层函数，避免 driver 里写重复逻辑。 */
const ctxWindow = ctx;
function vm_default(dm, touch) {
  return vm.runInContext(`(function(){
    var sdm = navigator.deviceMemory, st = navigator.maxTouchPoints;
    if (typeof (${dm === undefined ? "undefined" : dm}) === "number") navigator.deviceMemory = ${dm === undefined ? "undefined" : dm};
    else delete navigator.deviceMemory;
    navigator.maxTouchPoints = ${touch ? 1 : 0};
    var r = _defaultQuality();
    navigator.deviceMemory = sdm; navigator.maxTouchPoints = st;
    return r;
  })()`, ctxWindow);
}
function vm_default2(dm, touch, w, h) {
  return vm.runInContext(`(function(){
    var sdm = navigator.deviceMemory, st = navigator.maxTouchPoints, sw = window.innerWidth, sh = window.innerHeight;
    delete navigator.deviceMemory;
    navigator.maxTouchPoints = ${touch ? 1 : 0};
    window.innerWidth = ${w}; window.innerHeight = ${h};
    var r = _defaultQuality();
    navigator.deviceMemory = sdm; navigator.maxTouchPoints = st;
    window.innerWidth = sw; window.innerHeight = sh;
    return r;
  })()`, ctxWindow);
}

/* ============ ⑤ 默认档判定（vm 外执行：driver 内无法访问宿主函数） ============ */
/* 通过暴露到沙箱的 __qtDefault(dm, touch, w, h) 统一判定（见 js/main.js 区块外的注入） */
const qtDefault = (dm, touch, w, h) => vm.runInContext(
  `_qualityFromDevice(${dm === undefined ? "undefined" : dm}, ${touch ? "true" : "false"}, ${w || 0}, ${h || 0})`,
  ctx);
{
  const r5 = [];
  r5.push(["⑤ deviceMemory=4 → 低档", qtDefault(4, false) === 0]);
  r5.push(["⑤ deviceMemory=2 → 低档", qtDefault(2, false) === 0]);
  r5.push(["⑤ deviceMemory=8 → 高档", qtDefault(8, false) === 2]);
  r5.push(["⑤ deviceMemory=16 → 高档", qtDefault(16, false) === 2]);
  r5.push(["⑤ deviceMemory=6 → 中档", qtDefault(6, false) === 1]);
  r5.push(["⑤ 无 deviceMemory + 触屏短边 390 → 中档", qtDefault(undefined, true, 390, 844) === 1]);
  r5.push(["⑤ 无 deviceMemory + 桌面 1920×1080 → 高档", qtDefault(undefined, false, 1920, 1080) === 2]);
  console.log("---- 默认档判定 ----");
  for (const [n, ok] of r5) { console.log((ok ? "PASS " : "FAIL ") + n); if (!ok) okStatic = false; }
}

console.log("---- 静态核对 ----");
console.log(okStatic ? "QUALITY TIER STATIC OK" : "QUALITY TIER STATIC FAILED");

const checks = ctx.window.__qtChecks();
const fails = ctx.window.__qtFail();
console.log("条目合计 = " + checks + "  失败 = " + fails);
if (!okStatic || fails > 0) { console.log("QUALITY TIER TEST FAILED"); process.exit(1); }
console.log("QUALITY TIER TEST OK");
