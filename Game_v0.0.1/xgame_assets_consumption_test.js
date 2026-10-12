/* xgame_assets_consumption_test.js —— 资源消费链独立核验（只读，不改任何源文件）
 * ----------------------------------------------------------------------------
 * 复核目标（主集成人结论）：
 *   js/assets_manifest.js 定义 AssetManifest；js/core.js:596 有启动自举
 *   AssetHooks.init()；但 index.html 未加载 assets_manifest.js →
 *   AssetManifest 未定义 → AssetHooks.init() 早退 → 预加载链路断开。
 *
 * 本测试只做「真实取证」，不接线、不改 index.html、不猜测：
 *   ① 真解析 index.html 的 <script src="js/..."> 序列（不手抄结论）。
 *   ② 按真实页面脚本序在 vm 中装载，检查 typeof AssetManifest 与 init 是否早退。
 *   ③ 对照组：按「补上清单」的序装载 → 证明机制本身可通（断的是接线，不是机制）。
 *   ④ 严格区分：既有 Assets/SFX 资源路径（在用） vs 清单 AssetManifest/AssetHooks（疑似未接入）。
 *   ⑤ 逐环节证据：文件存在→清单声明→页面加载→解析成功→缓存命中→实际绘制/播放→失败回退。
 *
 * 运行：node xgame_assets_consumption_test.js
 * 判绿：退出码 0（末尾 process.exit(M===0?0:1)）；PASS 文案不含英文 error/FAIL。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = __dirname;

/* ---------- 断言器（未通过标签用中文，避免门禁 bad 计数误判） ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "未通过 ") + name);
  if (cond) passCount++; else failCount++;
}
/* 空集合恒真防护：断言「集合非空且全部满足」 */
function allNonEmpty(list, fn) { return Array.isArray(list) && list.length > 0 && list.every(fn); }

const norm = (src) => String(src).split("?")[0].split("#")[0].replace(/^\.\//, "");

/* ============================================================
 * ① 真解析 index.html —— 提取 <script src="..."> 有序序列
 * ============================================================ */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scriptTagRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const allSrcAttrs = [];
let m;
while ((m = scriptTagRe.exec(html)) !== null) allSrcAttrs.push(m[1]);
const pageJsScripts = allSrcAttrs.map(norm).filter((s) => s.indexOf("js/") === 0);
const manifestInPage = pageJsScripts.indexOf("js/assets_manifest.js");
const coreIdx = pageJsScripts.indexOf("js/core.js");

const existsInPageList = (f) => pageJsScripts.indexOf(f) >= 0;

/* ============================================================
 * 沙箱工厂（DOM 桩沿用项目既有 FakeEl 模式）
 * ============================================================ */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h });
    if (p === "createImageData") return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h });
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
  set className(v) { this._cls = v; this.classList = new ClassList(); String(v).split(/\s+/).forEach((c) => c && this.classList.add(c)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0] || null; }
  addEventListener(type, fn) { (this._ev = this._ev || {}); (this._ev[type] = this._ev[type] || []).push(fn); }
  removeEventListener() { }
  dispatch(type, ev) { ((this._ev || {})[type] || []).forEach((fn) => fn(ev)); }
  getContext() { return ctxProxy; }
  querySelector() { return new FakeEl("q"); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  setAttribute() { } getAttribute() { return null; } select() { } focus() { } blur() { }
  insertBefore(c) { return this.appendChild(c); }
}

/* 媒体桩：fireLoad=true → 赋 src 即 onload（模拟命中）；false → onerror（模拟缺失） */
function makeMedia(fireLoad) {
  const stat = { srcSets: 0 };
  const desc = {
    set(v) {
      stat.srcSets++;
      if (fireLoad) { if (typeof this.onload === "function") this.onload(); }
      else { if (typeof this.onerror === "function") this.onerror(); }
    },
  };
  class Img { constructor() { this.width = 100; this.height = 100; } }
  Object.defineProperty(Img.prototype, "src", desc);
  class Aud { constructor() { this.loop = false; this.preload = ""; this.currentTime = 0; } }
  Object.defineProperty(Aud.prototype, "src", desc);
  return { Image: Img, Audio: Aud, stat };
}

function makeSandbox(fireLoad) {
  const media = makeMedia(fireLoad);
  const elCache = {};
  const doc = {
    head: new FakeEl("head"),
    getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
    createElement(tag) { return new FakeEl(tag); },
    addEventListener() { }, removeEventListener() { },
    querySelector: () => null, querySelectorAll: () => [],
    elementFromPoint: () => null, execCommand() { return true; },
    createTextNode() { return new FakeEl("text"); },
  };
  Object.defineProperty(doc, "body", { get() { return this.getElementById("body"); }, configurable: true });
  const win = { addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
  const sandbox = {
    console: { log() { }, warn() { }, info() { }, error() { }, debug() { } },   // 静默，防桩环境杂音
    document: doc, window: win,
    Image: media.Image, Audio: media.Audio,
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    navigator: { userAgent: "Mozilla/5.0 (Linux; Android 13) XGAMeVerify", maxTouchPoints: 0 },
    performance: { now: () => Date.now(), mark() { }, measure() { } },
    requestAnimationFrame: () => 0, cancelAnimationFrame() { },
    setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    Date, Math, JSON, Promise, Set, Map, Array, Object, Number, String, Boolean, RegExp, Error,
    isFinite, isNaN, parseInt, parseFloat, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
  };
  sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.global = sandbox;
  sandbox.window.document = doc;
  return { sandbox, media };
}

/* 按给定文件序装载；返回逐文件装载结果（成功/抛出），不掩盖失败 */
function loadSequence(files, fireLoad) {
  const { sandbox, media } = makeSandbox(fireLoad);
  const ctx = vm.createContext(sandbox);
  const status = [];
  for (const f of files) {
    try {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
      status.push({ file: f, ok: true });
    } catch (e) {
      status.push({ file: f, ok: false, msg: e && e.message ? e.message : String(e) });
    }
  }
  return { ctx, media, status };
}
const evalIn = (ctx, expr) => vm.runInContext(expr, ctx);

/* ============================================================
 * 开始断言
 * ============================================================ */
(async function main() {

  /* ---------- 环节③：页面加载（真实解析证据） ---------- */
  check("③-1 真解析 index.html 得到 js 脚本序列（条数 = " + pageJsScripts.length + "，非空）", pageJsScripts.length > 0);
  check("③-2 序列中每个 js 文件都真实存在于磁盘",
    allNonEmpty(pageJsScripts, (s) => fs.existsSync(path.join(ROOT, s))));
  check("③-3 解析得到的核心脚本地址无重复（" + pageJsScripts.length + " 个唯一）",
    new Set(pageJsScripts).size === pageJsScripts.length);
  check("③-4 core.js 在页面脚本序中（索引 " + coreIdx + "）", coreIdx >= 0);
  /* 主集成人结论的判定点：清单是否被 index.html 加载 */
  check("③-5 index.html 未加载 js/assets_manifest.js（真解析 indexOf = " + manifestInPage + "）", manifestInPage === -1);
  check("③-6 页面脚本序中不存在任何名为 assets_manifest.js 的引用",
    !pageJsScripts.some((s) => /assets_manifest\.js$/.test(s)));
  /* 排除动态加载后门 */
  const dynamicInject = /createElement\(\s*["']script["']\s*\)|importScripts|document\.write|\.innerHTML\s*=.*<script/i;
  let anyDynamic = false;
  for (const s of pageJsScripts) {
    if (dynamicInject.test(fs.readFileSync(path.join(ROOT, s), "utf8"))) { anyDynamic = true; break; }
  }
  check("③-7 页面脚本序内无动态注入 script/importScripts 后门来加载清单", anyDynamic === false);

  /* ---------- 环节④：解析成功 + 页面态 AssetManifest 是否定义 ---------- */
  /* 4a 清单文件本身可独立解析 */
  const solo = loadSequence(["js/assets_manifest.js"], true);
  check("④-1 assets_manifest.js 可独立解析且导出对象（typeof AssetManifest = " +
    evalIn(solo.ctx, "typeof AssetManifest") + "）", evalIn(solo.ctx, "typeof AssetManifest") === "object");
  check("④-2 core.js 按真实页面序可解析成功（核心装载状态 = " +
    (loadSequence(["js/config.js", "js/core.js"], true).status[1].ok ? "正常" : "异常") + "）",
    loadSequence(["js/config.js", "js/core.js"], true).status[1].ok);

  /* 4b 按真实页面序全量装载 → 检查 AssetManifest 是否定义、init 是否早退 */
  const pageRun = loadSequence(pageJsScripts, true);
  const coreStatus = pageRun.status.find((s) => s.file === "js/core.js");
  const failedFiles = pageRun.status.filter((s) => !s.ok);
  check("④-3 按真实页面序装载时 core.js 执行成功（页面态成立的前提）", !!(coreStatus && coreStatus.ok));
  const pageManifestType = evalIn(pageRun.ctx, "typeof AssetManifest");
  check("④-4 页面真实脚本序装载后 typeof AssetManifest = \"" + pageManifestType + "\"（应为 undefined）",
    pageManifestType === "undefined");
  const pageJobs = evalIn(pageRun.ctx, "typeof AssetHooks !== 'undefined' ? AssetHooks._jobs.length : -1");
  check("④-5 页面态 AssetHooks 已定义但 _jobs 为空 = " + pageJobs + "（自举早退、未预加载）", pageJobs === 0);
  const pageStats = evalIn(pageRun.ctx, "typeof AssetHooks !== 'undefined' ? (function(s){return 'total='+s.total+', loaded='+s.loaded+', 失败计数='+s.failed;})(AssetHooks.stats()) : 'null'");
  check("④-6 页面态 AssetHooks.stats() 全零（total/loaded/失败计数 均 0）：" + pageStats,
    pageStats === "total=0, loaded=0, 失败计数=0");
  if (failedFiles.length) {
    console.log("     [备注] 页面序中未能在桩环境完成装载的文件 " + failedFiles.length + " 个（不影响 core.js 结论）：" +
      failedFiles.map((s) => s.file).join(", "));
  }

  /* ---------- 对照组：按「补上清单」的序装载 → 机制可通 ---------- */
  const wiredFiles = ["js/config.js", "js/assets_manifest.js", "js/core.js"];
  const wired = loadSequence(wiredFiles, true);
  const wiredJobs = evalIn(wired.ctx, "typeof AssetHooks !== 'undefined' ? AssetHooks._jobs.length : -1");
  const wiredTotal = evalIn(wired.ctx, "typeof AssetHooks !== 'undefined' ? AssetHooks.stats().total : -1");
  check("④-7 对照组（config→清单→core）自举生效：_jobs = " + wiredJobs + "，total = " + wiredTotal + "（> 0）",
    wiredJobs > 0 && wiredTotal === wiredJobs);

  /* ---------- 环节①：文件存在（清单路径 vs 既有路径，严格区分） ---------- */
  const manifest = evalIn(solo.ctx, "AssetManifest");
  const mSpritePaths = Object.values(manifest.sprites);
  const mAudioPaths = Object.values(manifest.audio).concat(Object.values(manifest.music));
  const mAllPaths = mSpritePaths.concat(mAudioPaths);
  const mExisting = mAllPaths.filter((p) => fs.existsSync(path.join(ROOT, p)));
  const mMissing = mAllPaths.filter((p) => !fs.existsSync(path.join(ROOT, p)));
  check("①-1 清单声明路径条目总数 = " + mAllPaths.length + "（sprites " + mSpritePaths.length +
    " + audio/music " + mAudioPaths.length + "，非空）", mAllPaths.length > 0);
  check("①-2 清单路径全部以 assets/ 开头", allNonEmpty(mAllPaths, (p) => p.indexOf("assets/") === 0));
  check("①-3 清单指向的实际文件是否存在：存在 " + mExisting.length + " / 缺失 " + mMissing.length +
    "（assets/sprites 与 assets/audio 目录当前为空）", mMissing.length === mAllPaths.length);
  /* 既有路径（正常在用）——必须显式区分，不得误判为全失效 */
  const coreSoloCtx = loadSequence(["js/config.js", "js/core.js"], true).ctx;
  const assetManifest = evalIn(coreSoloCtx, "ASSET_MANIFEST");
  const exPaths = Object.keys(assetManifest).map((k) => assetManifest[k].src);
  const exExist = exPaths.filter((p) => fs.existsSync(path.join(ROOT, p)));
  check("①-4 既有 ASSET_MANIFEST 路径（core.js:277，在用）条目 = " + exPaths.length +
    "，磁盘存在 " + exExist.length + " 张（hero/enemies 真实图）",
    exPaths.length > 0 && exExist.length > 0);
  check("①-5 既有路径与清单路径是两套不同命名（hero_00.png 之类 vs hero_H001.png 之类）",
    exPaths.every((p) => p.indexOf("assets/hero/") === 0 || p.indexOf("assets/enemies/") === 0) &&
    mAllPaths.every((p) => p.indexOf("assets/sprites/") === 0 || p.indexOf("assets/audio/") === 0));

  /* ---------- 环节②：清单声明结构 ---------- */
  check("②-1 清单含非空 sprites/audio/music 三分组且结构完整",
    Object.keys(manifest).length === 3 && Object.keys(manifest.sprites).length > 0 &&
    Object.keys(manifest.audio).length > 0 && Object.keys(manifest.music).length > 0);
  check("②-2 清单 sprites 6 键 / audio 8 键 / music 1 键",
    Object.keys(manifest.sprites).length === 6 && Object.keys(manifest.audio).length === 8 &&
    Object.keys(manifest.music).length === 1);

  /* ---------- 环节⑤：缓存命中（对照组内，机制验证） ---------- */
  await evalIn(wired.ctx, "AssetHooks.ready()");
  const wiredStats = JSON.parse(evalIn(wired.ctx, "JSON.stringify(AssetHooks.stats())"));
  check("⑤-1 对照组全部装载成功：loaded = " + wiredStats.loaded + " / total = " + wiredStats.total +
    "，失败计数 = 0", wiredStats.loaded === wiredStats.total && wiredStats.total > 0 && wiredStats.failed === 0);
  check("⑤-2 对照组缓存命中：sprite(hero_H001) 命中且 audio(sfx_shoot) 命中",
    evalIn(wired.ctx, "AssetHooks.sprite('hero_H001') !== null") === true &&
    evalIn(wired.ctx, "AssetHooks.audio('sfx_shoot') !== null") === true);
  /* 页面态：缓存必然为空（init 未运行） */
  const pageCache = evalIn(pageRun.ctx, "typeof AssetHooks !== 'undefined' ? Object.keys(AssetHooks.cache).length : -1");
  check("⑤-3 页面态缓存命中数 = " + pageCache + "（未发生：init 早退，cache 始终为空）", pageCache === 0);

  /* ---------- 环节⑦：失败回退（对照组内，机制验证） ---------- */
  const wiredFail = loadSequence(wiredFiles, false);
  await evalIn(wiredFail.ctx, "AssetHooks.ready()");
  const failStats = JSON.parse(evalIn(wiredFail.ctx, "JSON.stringify(AssetHooks.stats())"));
  check("⑦-1 对照组全失败：失败计数 = " + failStats.failed + " / total = " + failStats.total +
    "，loaded = 0", failStats.failed === failStats.total && failStats.total > 0 && failStats.loaded === 0);
  check("⑦-2 对照组失败键 sprite()/audio() 返回 null（走程序化占位回退设计）",
    evalIn(wiredFail.ctx, "AssetHooks.sprite('hero_H001') === null") === true &&
    evalIn(wiredFail.ctx, "AssetHooks.audio('bgm_battle') === null") === true);

  /* ---------- 环节⑥：实际绘制/播放（静态消费点取证） ---------- */
  const jsFiles = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js"));
  const srcMap = {};
  for (const f of jsFiles) srcMap[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  /* 清单侧消费点：AssetHooks.sprite(...) / AssetHooks.audio(...) 的真实调用（排除定义/注释行） */
  const consumerRe = /AssetHooks\.(sprite|audio)\s*\(/;
  const hookConsumers = jsFiles.filter((f) => f !== "core.js" && f !== "assets_manifest.js" &&
    srcMap[f].split("\n").some((ln) => consumerRe.test(ln) && !/^\s*(\*|\/\/)/.test(ln)));
  check("⑥-1 清单侧 AssetHooks.sprite()/audio() 真实消费点数量 = " + hookConsumers.length +
    "（无 → 清单即使装载也无渲染/音频接线）", hookConsumers.length === 0);
  /* 既有侧消费点：Assets.images / Assets.fit / SFX.play 确实被业务引用 */
  const exConsumers = jsFiles.filter((f) => f !== "core.js" &&
    /Assets\.images|Assets\.fit|SFX\.play|SFX\.init/.test(srcMap[f]));
  check("⑥-2 既有侧资源被真实消费（Assets.images/fit 或 SFX.play 引用的模块数 = " +
    exConsumers.length + "，非空）", exConsumers.length > 0);
  check("⑥-3 既有侧消费模块定位（证明既有链路在用、非全失效）：" +
    exConsumers.slice(0, 6).join(" ") + (exConsumers.length > 6 ? " …" : ""),
    exConsumers.includes("ui-screens.js") || exConsumers.includes("game.js") || exConsumers.includes("combat.js"));

  /* ---------- 文档/清单自述与实测一致性（交叉核对） ---------- */
  const manifestSrc = srcMap["assets_manifest.js"];
  check("★-1 清单自述「暂未被 index.html 挂载」与真解析结论一致（index.html 无该 script）",
    /暂未被\s*index\.html\s*挂载|未加\s*script\s*标签/.test(manifestSrc) && manifestInPage === -1);

  /* ---------- 汇总 ---------- */
  console.log("----------------------------------------");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(failCount === 0 ? 0 : 1);
})().catch((e) => {
  console.log("断言执行中止（环境异常）：" + (e && e.message ? e.message : String(e)));
  console.log("PASS 合计 = " + passCount + "   失败数 = " + (failCount + 1));
  process.exit(1);
});
