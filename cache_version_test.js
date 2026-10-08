/* 缓存自愈回归测试（node cache_version_test.js）
 * 背景：线上「无法开始游戏」最可能是手机缓存了新旧混合版本（旧 js 配新 html）。
 * 覆盖：① 静态检查：index.html 的 5 个 js 引用 + css 引用统一带 ?v=；app-version meta；
 *          版本比对 / 防死循环 / 强刷逻辑齐全且先于外部脚本执行
 *       ② 行为：内联自愈脚本在 vm 沙箱中 ——
 *          无版本 → reload 一次并写入版本；版本一致 → 不 reload；
 *          sessionStorage 已标记 → 不重复 reload（防死循环）；
 *          localStorage 抛异常 → 静默降级不崩；APP_VERSION 全局暴露
 *       ③ core.js：无 DOM 沙箱（无 document/window）加载不抛错；
 *          Assets.buildVersion 与 index.html 版本串一致；
 *          fillSprites 无 requestAnimationFrame 时退化 setTimeout 仍能完成
 * 风格参考 perf_guard_test.js（node vm 沙箱注入假存储 / 假 location）。
 * 注意：PASS 行文案禁用英文 error（run_tests.sh 会 grep 统计），提错误一律用中文。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

/* ================= 静态检查（index.html / js/core.js 文本） ================= */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const coreSrc = fs.readFileSync(path.join(__dirname, "js/core.js"), "utf8");

// 版本串以 meta 为准，并校验日期格式（8 位数字）
const metaVer = (html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/) || [])[1];
const VER = metaVer || "";
check("① index.html 含 app-version meta", !!metaVer);
check("① 版本串为 8 位日期格式", /^\d{8}$/.test(VER));

// 全部 js 引用 + css 引用：统一带 ?v= 且值一致
// 21.12 起新增 js/stress.js（性能压测场景），故改为「清单驱动」避免每次都硬编码数量。
const VER_ASSETS = ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/stress.js", "js/endless.js", "js/hud_endless.js", "js/ui.js", "js/main.js"];
for (const f of VER_ASSETS) {
  check("① " + f + " 引用带 ?v=" + VER, html.indexOf('<script src="' + f + "?v=" + VER + '"') >= 0);
}
check("① css/style.css 引用带 ?v=" + VER, html.indexOf('href="css/style.css?v=' + VER + '"') >= 0);

// 全文所有 ?v= 值必须与 meta 版本一致（统一版本，禁止混用）
// 数量口径 = js 引用数 + css 引用数（清单驱动，新增脚本只需改 VER_ASSETS）
const vValues = [...html.matchAll(/\?v=([\w.-]+)/g)].map(m => m[1]);
const EXPECTED_V_COUNT = VER_ASSETS.length + 1;   // +1 = css/style.css
check("① 全部 ?v= 值统一且等于 meta 版本", vValues.length === EXPECTED_V_COUNT && vValues.every(v => v === VER));

// 自愈脚本要素：版本比对 / 写回 / 防死循环标记 / 强刷 / try-catch，且先于外部脚本执行
const inlineIdx = html.indexOf("var APP_VERSION");
check("① 内联定义 APP_VERSION", inlineIdx >= 0);
check("① 自愈脚本先于外部 <script src> 执行",
  inlineIdx >= 0 && html.indexOf("<script src=") > inlineIdx);
check("① 含 localStorage 版本比对", html.indexOf('localStorage.getItem("app_version")') >= 0);
check("① 含重载前写回版本号", html.indexOf('localStorage.setItem("app_version"') >= 0);
check("① 含 sessionStorage 防死循环标记", html.indexOf("app_version_reloaded") >= 0);
check("① 含 location.reload 强刷", html.indexOf("location.reload(") >= 0);
check("① 自愈逻辑包裹 try/catch", /try\s*\{[\s\S]*localStorage[\s\S]*\}\s*catch\s*\(e\)/.test(html));

// core.js 分帧调度兜底：优先 rAF，无则退 setTimeout（静态确认兜底分支存在）
check("③ core.js _scheduleBatch 含 rAF 判断",
  coreSrc.indexOf('typeof requestAnimationFrame === "function"') >= 0);
check("③ core.js _scheduleBatch 含 setTimeout 兜底", /setTimeout\(fn,\s*0\)/.test(coreSrc));

/* ================= 行为测试（vm 沙箱跑内联自愈脚本） ================= */
// 抽取 index.html 中的内联版本脚本（含 APP_VERSION 的无 src script 块）
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const verScript = inlineScripts.find(s => s.indexOf("APP_VERSION") >= 0);
check("② 成功抽取内联自愈脚本", !!verScript);

// 假存储 / 假 location 工厂
const makeStorage = (map, throwsOnGet) => ({
  getItem(k) { if (throwsOnGet) throw new Error("mock 存储不可用"); return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
  setItem(k, v) { if (throwsOnGet) throw new Error("mock 存储不可用"); map[k] = String(v); },
  removeItem(k) { delete map[k]; },
});
function runVersionScript(lsMap, ssMap, lsThrows) {
  const sandbox = {
    console: { log() {} },
    __reloads: [],
    localStorage: makeStorage(lsMap || {}, !!lsThrows),
    sessionStorage: makeStorage(ssMap || {}, false),
  };
  sandbox.location = { reload(f) { sandbox.__reloads.push(f); } };
  const ctx = vm.createContext(sandbox);
  let threw = false;
  try { vm.runInContext(verScript, ctx, { filename: "inline-version" }); } catch (e) { threw = true; }
  return { sandbox, threw };
}

// 场景 A：localStorage 无版本（首次/旧版）→ reload 一次，且重载前写入了新版本号 + 会话标记
{
  const lsMap = {}, ssMap = {};
  const r = runVersionScript(lsMap, ssMap, false);
  check("② 无版本 → 强刷恰好一次", !r.threw && r.sandbox.__reloads.length === 1);
  check("② 强刷前写入新版本号", lsMap.app_version === VER);
  check("② 强刷前写入防死循环标记", ssMap.app_version_reloaded === "1");
}
// 场景 B：版本一致 → 什么都不做
{
  const r = runVersionScript({ app_version: VER }, {}, false);
  check("② 版本一致 → 不重载", !r.threw && r.sandbox.__reloads.length === 0);
}
// 场景 C：版本不一致但 sessionStorage 已标记（本会话已刷过）→ 不再 reload（防死循环）
{
  const r = runVersionScript({}, { app_version_reloaded: "1" }, false);
  check("② 会话已标记 → 不重复重载", !r.threw && r.sandbox.__reloads.length === 0);
}
// 场景 D：localStorage 抛异常（隐私模式/被禁）→ 静默降级，不崩、不重载
{
  const r = runVersionScript({}, {}, true);
  check("② 存储抛异常 → 脚本不抛错", !r.threw);
  check("② 存储抛异常 → 不重载、页面继续", r.sandbox.__reloads.length === 0);
}
// 场景 E：APP_VERSION 全局暴露且与 meta 版本一致
{
  const r = runVersionScript({ app_version: VER }, {}, false);
  check("② APP_VERSION 全局暴露且等于 meta 版本", r.sandbox.APP_VERSION === VER);
}

/* ================= core.js：无 DOM 沙箱加载 + 版本上报 + fillSprites 退化 ================= */
// 沙箱：只有 console 与 setTimeout（捕获进队列），无 document / window / requestAnimationFrame
const timerQ = [];
const bare = {
  console: { log() {} },
  setTimeout(fn) { timerQ.push(fn); return timerQ.length; },
};
const ctxC = vm.createContext(bare);
let coreThrew = false;
try { vm.runInContext(coreSrc, ctxC, { filename: "js/core.js" }); } catch (e) { coreThrew = true; }
check("③ core.js 无 DOM 沙箱加载不抛错", !coreThrew);

// buildVersion 与 index.html 版本串一致（经 driver 在同上下文读取 const 声明）
const buildVer = coreThrew ? null : vm.runInContext("Assets.buildVersion", ctxC);
check("③ Assets.buildVersion 存在", typeof buildVer === "string");
check("③ Assets.buildVersion 与 index.html 版本一致", buildVer === VER);

// fillSprites：无 requestAnimationFrame 环境下，退化 setTimeout 分帧仍能全部完成
let fillOk = false;
if (!coreThrew) {
  try {
    vm.runInContext("var G = { sprites: {} }; Assets.fit = function () { return { __stub: true }; };", ctxC);
    // 10 个键 × FIT_PER_FRAME=4 → 首批同步 4 张 + 2 轮 setTimeout 批次
    vm.runInContext(
      'Assets.fillSprites({a:{},b:{},c:{},d:{},e:{},f:{},g:{},h:{},i:{},j:{}});',
      ctxC
    );
    const doneSync = vm.runInContext("Assets.progress.done", ctxC);
    check("③ 分帧首批后尚未完成（确实分帧）", doneSync === false);
    while (timerQ.length) timerQ.shift()();   // 驱动全部 setTimeout 批次
    fillOk = vm.runInContext(
      'Assets.progress.done === true && Object.keys(G.sprites).length === 10 && G.sprites.j.__stub === true',
      ctxC
    );
  } catch (e) { fillOk = false; }
}
check("③ 无 rAF 时 fillSprites 退化 setTimeout 仍全部完成", fillOk);

/* ================= 汇总 ================= */
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("CACHE VERSION TEST FAILED");
console.log("CACHE VERSION TEST OK");
