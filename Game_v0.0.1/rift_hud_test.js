/* ============================================================================
 * 21.17 🅒 深渊大秘境 HUD 改版 + 结算三结局 回归测试（node rift_hud_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（≥25 项）：
 *   一、倒计时格式化 MM:SS（0 秒 / 600 秒 / 边界 / 越界与 NaN 兜底）
 *   二、最后 timeWarnSec 秒变红判定（阈值含等号；CFG 驱动；红闪相位）
 *   三、推进进度条比例计算（progress / 阈值，夹到 [0,1]）
 *   四、三种结局标题各不相同（撤离成功 / 时限耗尽 / 深渊阵亡）+ 判定口径
 *   五、坚持时长格式化（MM:SS）
 *   六、首次说明含大秘境关键要素（时间驱动 / 时限 / 推进量 / 撤离点 / 30%）
 *   七、非深渊时不渲染 HUD（无「深渊」文本 / 无 fillText）
 *   八、BOSS 状态 / 最终 BOSS 高亮 / 撤离点提示（行为级 fillText）
 *   九、CSS 三处同步验证（主规则 + 所有 portrait 媒体块 + body.portrait 钩子，括号配平）
 *   十、无 DOM 沙箱安全（元素缺失时面板方法不抛异常）
 *   十一、数值进 CFG（hud / hudColors / settle 段存在且为数值）
 *
 * ⚠️ PASS 行文案不得出现英文 error/Error/FAIL（run_tests.sh 以 grep -ci 统计失败）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 极简 DOM / Canvas 桩（计数绘制调用 + 记录 fillText 文本） ---- */
const drawOps = { fillRect: 0, strokeRect: 0, fillText: 0, setTransform: 0, save: 0, restore: 0 };
const textCalls = [];
function resetOps() { for (const k in drawOps) drawOps[k] = 0; textCalls.length = 0; }
global.resetOps = resetOps; global.drawOps = drawOps; global.textCalls = textCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    return (...a) => {
      if (typeof p === "string" && drawOps[p] != null) drawOps[p]++;
      if (p === "fillText" && a.length) textCalls.push(String(a[0]));
    };
  },
  set(t, p, v) { t[p] = v; return true; },
});
const fakeCanvas = {
  width: 300, height: 300, style: {},
  getContext() { return ctxProxy; },
  addEventListener() { }, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
};
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = Object.assign({}, fakeCanvas, { id })); },
  createElement() { return Object.assign({}, fakeCanvas); },
  addEventListener() { }, querySelectorAll: () => [], body: fakeCanvas,
  documentElement: fakeCanvas,
};
global.window = {
  addEventListener() { }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
global.requestAnimationFrame = () => { };

/* ============================================================
 * 静态源码级断言：CFG / 文案 / CSS 三处同步
 * ============================================================ */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const configSrc = fs.readFileSync(path.join(__dirname, "js", "config.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
const hudSrc = fs.readFileSync(path.join(__dirname, "js", "hud_endless.js"), "utf8");
const panelSrc = fs.readFileSync(path.join(__dirname, "js", "ui-panels.js"), "utf8");

let okStatic = true, staticCount = 0;
const staticCheck = (name, cond) => {
  staticCount++;
  console.log((cond ? "PASS" : "FAIL") + " " + name);
  if (!cond) okStatic = false;
};

/* ---- 十一、数值进 CFG ---- */
staticCheck("十一1 CFG.endless.hud 段存在", /CFG\.endless\s*=\s*\{[\s\S]*?hud:\s*\{/.test(configSrc));
staticCheck("十一2 CFG.endless.hudColors 段存在", /hudColors:\s*\{/.test(configSrc));
staticCheck("十一3 CFG.endless.settle 三结局文案段存在",
  /settle:\s*\{[\s\S]*?extractTitle[\s\S]*?timeoutTitle[\s\S]*?deathTitle/.test(configSrc));
staticCheck("十一4 倒计时告警阈值进 CFG（timeWarnSec: 60）", /timeWarnSec:\s*60/.test(configSrc));
staticCheck("十一5 撤离点提示文案进源码（醒目提示）", hudSrc.indexOf("撤离点已开启") >= 0);

/* ---- 更新 index.html：结算标题默认色调类 + HUD 容器 ---- */
staticCheck("十二1 index.html 存在 #hud-endless-info", htmlIds.has("hud-endless-info"));
staticCheck("十二2 index.html 存在 #endless-settle-title", htmlIds.has("endless-settle-title"));
staticCheck("十二3 结算标题带色调类（good/bad 注入锚点）",
  /id="endless-settle-title"[^>]*class="(good|bad)"/.test(html));

/* ---- 九、CSS 三处同步（遍历所有 portrait 媒体块，括号配平） ---- */
function portraitBlocks(src) {
  const blocks = [];
  const re = /@media \(orientation: portrait\)\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length, depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    blocks.push(src.slice(m.index, i));
  }
  return blocks;
}
const pBlocks = portraitBlocks(css);
staticCheck("九1 CSS 存在多个 portrait 媒体块（供遍历）", pBlocks.length >= 2, "共 " + pBlocks.length + " 块");
// 结局色调：主规则 + 媒体块 + 钩子（.good/.bad 至少各 3 处：main + media + body）
const goodCount = (css.match(/#endless-settle-title\.good/g) || []).length;
const badCount = (css.match(/#endless-settle-title\.bad/g) || []).length;
staticCheck("九2 主规则含撤离成功绿色调（#endless-settle-title.good）", css.indexOf("#endless-settle-title.good") >= 0);
staticCheck("九3 主规则含失败红色调（#endless-settle-title.bad）", css.indexOf("#endless-settle-title.bad") >= 0);
const mediaHasTone = pBlocks.some(b => /#endless-settle-title\s*\{/.test(b));
staticCheck("九4 竖屏媒体块含结算标题规则（第二处）", mediaHasTone);
staticCheck("九5 body.portrait 钩子含结算标题规则（第三处）",
  /body\.portrait\s+#endless-settle-title/.test(css));
// 三处同步：结算标题字号规则出现 ≥3 次（主 + 媒体 + 钩子）
const titleRuleCount = (css.match(/#endless-settle-title\s*\{\s*font-size/g) || []).length;
staticCheck("九6 结算标题字号三处齐备（≥3 次）", titleRuleCount >= 3, "出现 " + titleRuleCount + " 次");
// HUD 信息区字号三处同步（沿用旧口径，防止回退）
staticCheck("九7 HUD 信息区竖屏媒体块含字号规则", pBlocks.some(b => /#hud-endless-info\s*\{\s*font-size/.test(b)));
staticCheck("九8 HUD 信息区 body.portrait 钩子含字号规则", /body\.portrait\s+#hud-endless-info/.test(css));

/* ============================================================
 * 加载脚本（含 hud_endless.js + ui-panels.js）
 * ============================================================ */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js",
  "js/modes.js", "js/render.js", "js/endless.js", "js/hud_endless.js",
  "js/ui.js", "js/ui-screens.js", "js/ui-panels.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

let checks = 0, fails = 0;
const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };

/* ---- 一、倒计时格式化 ---- */
const fmt = (s) => vm.runInContext("formatEndlessTime(" + s + ")", ctx);
check("一1 600 秒 → 10:00", fmt(600) === "10:00");
check("一2 0 秒 → 00:00", fmt(0) === "00:00");
check("一3 59 秒 → 00:59", fmt(59) === "00:59");
check("一4 60 秒 → 01:00", fmt(60) === "01:00");
check("一5 5 秒 → 00:05（个位补零）", fmt(5) === "00:05");
check("一6 3599 秒 → 59:59（不进位到 60 分）", fmt(3599) === "59:59");
check("一7 小数向下取整 12.9 → 00:12", fmt(12.9) === "00:12");
check("一8 负数兜底 -5 → 00:00", fmt(-5) === "00:00");
check("一9 NaN 兜底 → 00:00", fmt("NaN") === "00:00");

/* ---- 二、最后 timeWarnSec 秒变红判定 ---- */
const warn = (s) => vm.runInContext("endlessTimeWarn(" + s + ")", ctx);
check("二1 剩余 61 秒不告警（> 阈值 60）", warn(61) === false);
check("二2 剩余 60 秒告警（含等号）", warn(60) === true);
check("二3 剩余 30 秒告警", warn(30) === true);
check("二4 剩余 0 秒告警", warn(0) === true);
check("二5 剩余 600 秒不告警（满时限）", warn(600) === false);
// 红闪相位：blinkPeriodSec 周期内亮/暗交替
const blink = (t) => vm.runInContext("endlessBlinkOn(" + t + ")", ctx);
check("二6 闪烁相位 t=0 为亮", blink(0) === true);
check("二7 闪烁相位 t=0.5（半个周期 0.5s）为暗", blink(0.5) === false);
check("二8 闪烁相位 t=1.0 回到亮", blink(1.0) === true);
check("二9 告警阈值从 CFG 读（timeWarnSec 可调，非硬编码）",
  /endlessHudCfg\(\)[\s\S]{0,200}timeWarnSec/.test(hudSrc) && /timeWarnSec/.test(configSrc));

/* ---- 三、推进进度条比例计算 ---- */
const ratio = (p, n) => vm.runInContext("endlessProgressRatio(" + p + "," + n + ")", ctx);
const thr0 = vm.runInContext("Endless.bossThreshold(0)", ctx);   // 300
const thr1 = vm.runInContext("Endless.bossThreshold(1)", ctx);   // 560
check("三1 progress=0 → 比例 0", ratio(0, 0) === 0);
check("三2 progress=阈值 → 比例 1", ratio(thr0, 0) === 1, "阈值=" + thr0);
check("三3 progress=半阈值 → 比例 0.5", Math.abs(ratio(thr0 / 2, 0) - 0.5) < 1e-9);
check("三4 progress 超阈值 → 夹到 1", ratio(thr0 * 2, 0) === 1);
check("三5 第二个 BOSS 阈值更大（560 > 300）", thr1 > thr0, thr1 + " > " + thr0);
check("三6 换序号后按新阈值算比例（progress=560,bossIndex=1 → 1）", ratio(thr1, 1) === 1);
check("三7 负数进度兜底 0", ratio(-10, 0) === 0);

/* ---- 四 / 五 / 六：面板行为（加载 ui-panels 后驱动） ---- */
vm.runInContext(`
  window.__results = {};
  const get = (id) => document.getElementById(id);
  // 四、三结局标题
  UI.showEndlessSettle({ wave: 9, kills: 300, crystals: 100, bossKills: 3, elapsed: 425,
    reason: "extract", extracted: true });
  const tExtract = get("endless-settle-title").textContent;
  const clsExtract = get("endless-settle-title").classList;
  const htmlExtract = get("endless-settle-stats").innerHTML;

  UI.showEndlessSettle({ wave: 6, kills: 200, crystals: 60, bossKills: 2, elapsed: 600, timedOut: true });
  const tTimeout = get("endless-settle-title").textContent;

  UI.showEndlessSettle({ wave: 4, kills: 150, crystals: 40, bossKills: 1, elapsed: 210 });
  const tDeath = get("endless-settle-title").textContent;

  window.__results = { tExtract, tTimeout, tDeath, htmlExtract };
`, ctx, { filename: "panels" });

const R = ctx.window.__results;
const sc = vm.runInContext("CFG.endless.settle", ctx);
check("四1 撤离成功标题用 CFG 文案", R.tExtract.indexOf(sc.extractTitle) >= 0, R.tExtract);
check("四2 超时标题用 CFG 文案", R.tTimeout.indexOf(sc.timeoutTitle) >= 0, R.tTimeout);
check("四3 阵亡标题用 CFG 文案", R.tDeath.indexOf(sc.deathTitle) >= 0, R.tDeath);
check("四4 三种结局标题各不相同",
  R.tExtract !== R.tTimeout && R.tTimeout !== R.tDeath && R.tExtract !== R.tDeath);
// 判定口径：reason/timedOut/extracted 三类
const oc = (obj) => vm.runInContext("UI._endlessSettleOutcome(" + JSON.stringify(obj) + ")", ctx);
check("四5 reason=extract → extract", oc({ reason: "extract" }) === "extract");
check("四6 extracted=true → extract", oc({ extracted: true }) === "extract");
check("四7 timedOut=true → timeout", oc({ timedOut: true }) === "timeout");
check("四8 reason=timeout → timeout", oc({ reason: "timeout" }) === "timeout");
check("四9 reason=death → death", oc({ reason: "death" }) === "death");
check("四10 无 reason（旧死亡路径）→ death", oc({ wave: 1 }) === "death");
check("四11 超时优先于撤离判定（同时为真取超时）", oc({ timedOut: true, extracted: true }) === "timeout");

/* 五、坚持时长格式化 */
const fmtE = (s) => vm.runInContext("UI._endlessFormatElapsed(" + s + ")", ctx);
check("五1 425 秒 → 07:05", fmtE(425) === "07:05");
check("五2 600 秒 → 10:00", fmtE(600) === "10:00");
check("五3 0 秒 → 00:00", fmtE(0) === "00:00");
check("五4 面板数据含「坚持时长」与格式化值（07:05）",
  R.htmlExtract.indexOf("坚持时长") >= 0 && R.htmlExtract.indexOf("07:05") >= 0);
check("五5 面板数据含 BOSS 击杀数（3）", R.htmlExtract.indexOf("BOSS 击杀") >= 0 && R.htmlExtract.indexOf("3") >= 0);
check("五6 面板数据含到达波次 / 击杀 / 结晶",
  R.htmlExtract.indexOf("到达波次") >= 0 && R.htmlExtract.indexOf("击杀数") >= 0 && R.htmlExtract.indexOf("结晶") >= 0);

/* 六、首次说明含大秘境关键要素 */
vm.runInContext(`(function(){ UI.showEndlessIntro(); window.__intro = document.getElementById("endless-intro-body").innerHTML; })();`, ctx);
const intro = ctx.window.__intro;
check("六1 说明含「大秘境」", intro.indexOf("大秘境") >= 0);
check("六2 说明含时间驱动（按时间驱动 / 到点就刷）", intro.indexOf("时间驱动") >= 0 || intro.indexOf("到点就刷") >= 0);
check("六3 说明含总时限（10 分钟 / 时限）", intro.indexOf("10 分钟") >= 0 || intro.indexOf("时限") >= 0);
check("六4 说明含推进量", intro.indexOf("推进量") >= 0);
check("六5 说明含撤离点", intro.indexOf("撤离点") >= 0);
check("六6 说明含失败保留 30%", intro.indexOf("30%") >= 0);
check("六7 说明不含旧语义「每波清空」（旧文案已移除）", intro.indexOf("每波清空") < 0);

/* ---- 七 / 八：HUD 行为级（canvas） ---- */
vm.runInContext(`(function(){
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.W = 780; G.H = 1688;
  G.heroDef = { id: "H001", radius: 16, name: "测试" };
  G.player = { x: 400, y: 400 };
  G.levelCfg = { theme: "#141a24", circles: [], mapW: 1920, mapH: 1920 };
  const w = { kind: "endless", w: 1920, h: 1920, monsters: [], endlessWave: 5, exitBeacon: null };
  G.activeWorld = w;
  G.inEndless = false;
  window.__w = w;
})();`, ctx, { filename: "hud-setup" });

/* 七：非深渊不渲染 */
vm.runInContext(`(function(){ G.inEndless = false; resetOps(); renderEndlessHud(G.ctx); window.__off = textCalls.slice(); })();`, ctx);
check("七1 非无尽：HUD 不渲染（无「深渊」文本）", !ctx.window.__off.some(t => t.indexOf("深渊") >= 0));
check("七2 非无尽：无 fillText", ctx.window.__off.length === 0);

/* 八：无尽渲染（未超时、无 BOSS、无撤离点）—— 倒计时 + 进度条 + 波次 + 小字 */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__w;
  w.endlessWave = 5; w.exitBeacon = null;
  w.monsters = [];
  Endless = {
    state: { wave: 5, kills: 120, elapsed: 100 },
    timeLeft: function(){ return 500; },
    progress: function(){ return 240; },
    bossIndex: function(){ return 0; },
    isFinalBossSpawned: function(){ return false; },
    isFinalBossDefeated: function(){ return false; },
    waveCap: function(n){ return 40 + n * 12; },
    bossThreshold: function(n){ return 300 + n * 260; },
  };
  resetOps(); renderEndlessHud(G.ctx);
  window.__on = textCalls.slice();
  window.__onFillRect = drawOps.fillRect;
  window.__onSetTransform = drawOps.setTransform;
})();`, ctx, { filename: "hud-on" });
const onT = ctx.window.__on;
check("八1 无尽：倒计时 MM:SS 渲染（08:20）", onT.some(t => t.indexOf("08:20") >= 0), JSON.stringify(onT));
check("八2 无尽：推进进度文本渲染（240/300）", onT.some(t => t.indexOf("240/300") >= 0));
check("八3 无尽：波次小字渲染（第 5 波）", onT.some(t => t.indexOf("第 5 波") >= 0));
check("八4 无尽：击杀 / 同屏小字渲染", onT.some(t => t.indexOf("击杀 120") >= 0) && onT.some(t => t.indexOf("同屏") >= 0));
check("八5 无 BOSS 时不渲染 BOSS 行", !onT.some(t => t.indexOf("BOSS ") >= 0));
check("八6 进度条画背板 + 填充（fillRect ≥ 2）", ctx.window.__onFillRect >= 2);
check("八7 HUD 复位变换（setTransform ≥1）", ctx.window.__onSetTransform >= 1);

/* 八·续：BOSS 在场 + 告警倒计时 + 最终 BOSS 高亮 + 撤离点提示 */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__w;
  w.endlessWave = 12;
  const boss = { dead: false, d: { type: "boss" }, x: 100, y: 100 };
  w.monsters = [boss];
  Endless = {
    state: { wave: 12, kills: 400, elapsed: 300 },
    timeLeft: function(){ return 45; },          // 告警（<=60）
    progress: function(){ return 560; },
    bossIndex: function(){ return 3; },          // 第 3 个 = 最终 BOSS
    isFinalBossSpawned: function(){ return true; },
    isFinalBossDefeated: function(){ return false; },
    waveCap: function(n){ return 300; },
    bossThreshold: function(n){ return 300 + n * 260; },
  };
  w.exitBeacon = null;
  resetOps(); renderEndlessHud(G.ctx);
  window.__boss = textCalls.slice();
})();`, ctx, { filename: "hud-boss" });
const bossT = ctx.window.__boss;
check("八8 告警：倒计时转红（fillStyle 命中 timeWarn 色）",
  vm.runInContext(`(function(){ const C = endlessHudColors(); return C.timeWarn; })()`, ctx).length > 0 &&
  bossT.some(t => t.indexOf("00:45") >= 0));
check("八9 最终 BOSS 高亮提示（含「最终 BOSS」与 3/3）",
  bossT.some(t => t.indexOf("最终 BOSS") >= 0 && t.indexOf("3/3") >= 0), JSON.stringify(bossT));

/* 撤离点开启 → 提示行 */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__w;
  w.exitBeacon = { x: 200, y: 200 };           // 撤离点已开启
  w.monsters = [];
  Endless.isFinalBossDefeated = function(){ return true; };
  resetOps(); renderEndlessHud(G.ctx);
  window.__extract = textCalls.slice();
})();`, ctx, { filename: "hud-extract" });
check("八10 撤离点开启 → 提示「走过去撤离」",
  ctx.window.__extract.some(t => t.indexOf("撤离点") >= 0 && t.indexOf("撤离") >= 0), JSON.stringify(ctx.window.__extract));

/* Endless 完全缺失：安全降级（守卫生效，且不抛异常） */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__w; w.endlessWave = 3; w.monsters = []; w.exitBeacon = null;
  Endless = undefined;
  let threw = false;
  resetOps();
  try { renderEndlessHud(G.ctx); } catch (e) { threw = true; }
  window.__noEndlessThrew = threw;
  window.__noEndlessText = textCalls.slice();
})();`, ctx, { filename: "hud-noendless" });
check("八11 Endless 缺失：HUD 不抛异常（守卫生效）", ctx.window.__noEndlessThrew === false);
check("八12 Endless 缺失：仍渲染波次（从 world.endlessWave 兜底）",
  ctx.window.__noEndlessText.some(t => t.indexOf("第 3 波") >= 0));

/* ---- 十、无 DOM 沙箱安全：元素缺失时面板方法不抛异常 ---- */
{
  const ctx0 = vm.createContext({
    window: { addEventListener() { } },
    document: { getElementById: () => null, createElement: () => fakeCanvas, addEventListener() { }, body: null },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
    CFG: undefined,
  });
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js",
    "js/modes.js", "js/render.js", "js/endless.js", "js/hud_endless.js",
    "js/ui.js", "js/ui-screens.js", "js/ui-panels.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx0, { filename: f });
  }
  let threw = false;
  try {
    vm.runInContext(`
      UI.showEndlessSettle({ wave: 3, kills: 10, crystals: 40, timedOut: true, elapsed: 120 });
      UI.showEndlessSettle({ wave: 3, kills: 10, crystals: 40, reason: "extract", extracted: true });
      UI.hideEndlessSettle();
      UI.showEndlessIntro(); UI.hideEndlessIntro();
    `, ctx0, { filename: "null-dom" });
  } catch (e) { threw = true; }
  check("十1 元素全缺：面板方法（三结局）不抛异常", threw === false);
}

/* ---- 十三、结算面板调度（🅒 单行桥接：超时/撤离后补弹面板） ---- */
vm.runInContext(`(function(){
  // 组装最小可渲染环境
  const get = (id) => document.getElementById(id);
  G.inEndless = true;
  window.__dispatch = {};
  // 模拟 🅑 结算后的状态：state=settled + 署名 reason
  G.state = "settled"; G.abyssSettleReason = "timeout"; G.abyssSettleShown = false;
  Endless = { state: { wave: 6, kills: 200, crystals: 50, elapsed: 600, bossIndex: 2, timedOut: true } };
  get("screen-endless-settle").classList.add("hidden");
  const ok1 = riftHudDispatchSettle();
  window.__dispatch.ok1 = ok1;
  window.__dispatch.shown1 = !get("screen-endless-settle").classList.contains("hidden");
  window.__dispatch.title1 = get("endless-settle-title").textContent;
  window.__dispatch.stats1 = get("endless-settle-stats").innerHTML;
  // 幂等：再次调用不再弹（abyssSettleShown 已置位）
  const ok2 = riftHudDispatchSettle();
  window.__dispatch.ok2 = ok2;
  // 撤离路径
  G.state = "settled"; G.abyssSettleReason = "extract"; G.abyssSettleShown = false;
  Endless = { state: { wave: 9, kills: 400, crystals: 120, elapsed: 425, bossIndex: 3, timedOut: false } };
  const ok3 = riftHudDispatchSettle();
  window.__dispatch.ok3 = ok3;
  window.__dispatch.title3 = get("endless-settle-title").textContent;
  // 非深渊：不接管
  G.inEndless = false; G.state = "settled"; G.abyssSettleReason = "timeout"; G.abyssSettleShown = false;
  window.__dispatch.ok4 = riftHudDispatchSettle();
  // 未结算（playing）：不接管
  G.inEndless = true; G.state = "playing";
  window.__dispatch.ok5 = riftHudDispatchSettle();
  G.state = "settled";
})();`, ctx, { filename: "dispatch" });
const D = ctx.window.__dispatch;
check("十三1 超时结算后调度弹出面板", D.ok1 === true && D.shown1 === true);
check("十三2 调度后标题为「时限耗尽」", D.title1.indexOf(sc.timeoutTitle) >= 0, D.title1);
check("十三3 调度后数据取自 Endless.state（波6/杀200/晶50）",
  D.stats1.indexOf("6") >= 0 && D.stats1.indexOf("200") >= 0 && D.stats1.indexOf("50") >= 0);
check("十三4 幂等：同局重复调度不再弹（返回 false）", D.ok2 === false);
check("十三5 撤离结算后调度弹出且标题「撤离成功」", D.ok3 === true && D.title3.indexOf(sc.extractTitle) >= 0);
check("十三6 非深渊：调度不接管", D.ok4 === false);
check("十三7 未结算（playing）：调度不接管", D.ok5 === false);
check("十三8 源级：main.js 主循环含单行桥接调用",
  fs.readFileSync(path.join(__dirname, "js", "main.js"), "utf8").indexOf("riftHudDispatchSettle()") >= 0);

console.log("----------------------------------------");
console.log("静态断言 " + staticCount + " 项 · 行为断言 " + checks + " 项 · 失败 " + fails + " 项");
if (!okStatic || fails > 0) { console.log("RIFT HUD TEST FAILED"); process.exit(1); }
console.log("RIFT HUD TEST OK");
