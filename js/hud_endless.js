/* ============================================================================
 * 21.17 🅒 HUD 大秘境信息区（无尽模式 / 深渊）—— 独立模块（§5.45 末尾区块）
 * ----------------------------------------------------------------------------
 * 定位：无尽世界（kind="endless"）战斗时，在**屏幕左上角**显示大秘境式信息：
 *        倒计时 MM:SS（最醒目；最后 timeWarnSec 秒转红闪烁）
 *        推进进度条 progress / 下一 BOSS 阈值（直观看到「离 BOSS 还有多远」）
 *        BOSS 状态 BOSS n/3（无 BOSS 时隐藏；最终 BOSS 时高亮「最终 BOSS」）
 *        深渊 · 第 N 波 / 击杀 K / 同屏 M/cap（小字保留）
 *        撤离点提示（最终 BOSS 死后闪烁提示「走过去撤离」）
 *
 * 调用契约（由 game.js 血条块末尾单行桥接）：
 *    if (typeof renderEndlessHud === "function") renderEndlessHud(ctx);
 * 因此本函数**在 render() 的世界相机变换中**被调用（ctx 已 scale+translate）。
 * 为把 HUD 钉在屏幕坐标，函数内部 save() → setTransform(1,0,0,1,0,0) → 绘制 → restore()。
 *
 * 数据来源（全部按契约，缺则安全降级）：
 *   · G.inEndless（无尽旗标，各端写入）
 *   · G.activeWorld.endlessWave（当前波次）/ G.activeWorld.monsters.length（同屏）
 *   · G.activeWorld.exitBeacon（🅑 撤离点字段，非空 = 已开启）
 *   · Endless.state.kills / Endless.timeLeft() / Endless.progress() / Endless.bossIndex()
 *   · Endless.bossThreshold(n) / Endless.isFinalBossSpawned() / Endless.isFinalBossDefeated()
 *   · Endless.waveCap(wave)
 *
 * 安全约束：
 *   · 仅 G.inEndless 时渲染（正式关卡 / 主城 / 裂缝 / 工匠世界一律不显示）
 *   · typeof Endless !== "undefined" 守卫（集成时序不确定，缺则安全降级）
 *   · 无 DOM 依赖（纯 canvas 绘制）；ctx 缺方法时静默跳过（测试桩健壮）
 *   · 移动端安全区：读 CSS 变量 --sa-top 下移，避免刘海遮挡
 *   · 数值全部读 CFG.endless.hud / CFG.endless.hudColors（项目铁律：不硬编码）
 * ========================================================================== */
"use strict";

/* HUD 配色：优先读 CFG（单一事实源），回落内置常量（CFG 半加载时安全）。 */
var ENDLESS_HUD_COLORS = {
  wave: "#e8c574",    // 波次：金
  kill: "#ff8f6a",    // 击杀：暖橙
  cap: "#8fd0ff",     // 同屏：冷蓝
  panel: "rgba(10,16,28,0.55)",
  edge: "rgba(120,150,200,0.35)",
  time: "#cfe0ff", timeWarn: "#ff5b5b",
  progressBg: "rgba(120,150,200,0.25)", progressFill: "#7de08a", progressBoss: "#ffd76a",
  boss: "#ff8f6a", bossFinal: "#ff5b5b", extract: "#7de08a",
};
function endlessHudColors() {
  if (typeof CFG !== "undefined" && CFG && CFG.endless && CFG.endless.hudColors) {
    var c = CFG.endless.hudColors, out = {};
    for (var k in ENDLESS_HUD_COLORS) out[k] = (c[k] !== undefined) ? c[k] : ENDLESS_HUD_COLORS[k];
    return out;
  }
  return ENDLESS_HUD_COLORS;
}
/* HUD 数值（缺省回落，保证 CFG 未就绪也能渲染）。 */
function endlessHudCfg() {
  var d = { timeWarnSec: 60, blinkPeriodSec: 0.5, barWidth: 176, barHeight: 8,
    panelPadX: 12, panelPadY: 9, lineH: 22, fontSize: 15, fontSmall: 11,
    timeFontSize: 24, bossFontSize: 14, hintFontSize: 13, safeAreaExtra: 0 };
  var h = (typeof CFG !== "undefined" && CFG && CFG.endless && CFG.endless.hud) || null;
  if (!h) return d;
  for (var k in d) if (h[k] !== undefined) d[k] = h[k];
  return d;
}
if (typeof globalThis !== "undefined") {
  globalThis.ENDLESS_HUD_COLORS = ENDLESS_HUD_COLORS;
  globalThis.endlessHudColors = endlessHudColors;
  globalThis.endlessHudCfg = endlessHudCfg;
}

/* ---------- 纯函数（供 HUD 与测试复用，不依赖 DOM） ---------- */

/* 秒 → MM:SS（向下取整；负数/NaN 按 0）。0 秒 = "00:00"，600 秒 = "10:00"。 */
function formatEndlessTime(sec) {
  var s = (typeof sec === "number" && isFinite(sec)) ? Math.floor(sec) : 0;
  if (s < 0) s = 0;
  var mm = Math.floor(s / 60), ss = s % 60;
  return (mm < 10 ? "0" + mm : "" + mm) + ":" + (ss < 10 ? "0" + ss : "" + ss);
}

/* 剩余时间是否进入告警（最后 timeWarnSec 秒，含等于）。恒基于 CFG 阈值。 */
function endlessTimeWarn(sec) {
  var cfg = endlessHudCfg();
  var s = (typeof sec === "number" && isFinite(sec)) ? sec : 0;
  return s <= cfg.timeWarnSec;
}

/* 红闪是否处于「亮」相位（blinkPeriodSec 周期；用游戏内时间 tSec 驱动，确定可测）。 */
function endlessBlinkOn(tSec) {
  var cfg = endlessHudCfg();
  var p = cfg.blinkPeriodSec > 0 ? cfg.blinkPeriodSec : 0.5;
  var t = (typeof tSec === "number" && isFinite(tSec)) ? tSec : 0;
  return (Math.floor(t / p) % 2) === 0;
}

/* 进度条比例 = progress / 下一 BOSS 阈值，夹到 [0,1]。
 * bossIndex = 已生成 BOSS 数 → 下一阈值 = bossThreshold(bossIndex)。 */
function endlessProgressRatio(progress, bossIndex) {
  var p = (typeof progress === "number" && isFinite(progress)) ? progress : 0;
  var thr = 1;
  if (typeof Endless !== "undefined" && Endless && typeof Endless.bossThreshold === "function") {
    thr = Endless.bossThreshold(Math.max(0, bossIndex || 0));
  } else if (typeof CFG !== "undefined" && CFG && CFG.endless) {
    thr = CFG.endless.bossProgressBase + Math.max(0, bossIndex || 0) * CFG.endless.bossProgressStep;
  }
  if (!(thr > 0)) return 0;
  var r = p / thr;
  return r < 0 ? 0 : (r > 1 ? 1 : r);
}

if (typeof globalThis !== "undefined") {
  globalThis.formatEndlessTime = formatEndlessTime;
  globalThis.endlessTimeWarn = endlessTimeWarn;
  globalThis.endlessBlinkOn = endlessBlinkOn;
  globalThis.endlessProgressRatio = endlessProgressRatio;
}

/* 计算 HUD 左上角锚点（含安全区）。返回 {x, y, scale, W, H}。 */
function endlessHudMetrics() {
  var W = (typeof G !== "undefined" && G && G.W) || 1920;
  var H = (typeof G !== "undefined" && G && G.H) || 1080;
  var saTop = 0;
  try {
    if (typeof window !== "undefined" && window.getComputedStyle && typeof document !== "undefined" && document.documentElement) {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue("--sa-top");
      var m = /([\d.]+)/.exec(raw || "");
      if (m) saTop = parseFloat(m[1]) || 0;
    }
  } catch (e) { saTop = 0; }
  saTop += endlessHudCfg().safeAreaExtra;
  var pad = Math.max(12, Math.round(Math.min(W, H) * 0.02));
  var scale = Math.max(0.8, Math.min(1.6, Math.min(W, H) / 640));
  return { x: pad, y: pad + saTop, scale: scale, W: W, H: H };
}

/* 采集 HUD 所需数据（缺则安全降级）。返回结构化对象。 */
function endlessHudData(world) {
  var w = world || (typeof G !== "undefined" && G ? G.activeWorld : null) || null;
  var hasEndless = (typeof Endless !== "undefined" && Endless) ? true : false;
  var wave = (w && w.endlessWave) || 0;
  if (!wave && hasEndless && Endless.state) wave = Endless.state.wave || 0;
  var kills = (hasEndless && Endless.state && typeof Endless.state.kills === "number") ? Endless.state.kills : 0;
  var onScreen = (w && w.monsters && w.monsters.length) || 0;
  var cap = 0;
  if (hasEndless && typeof Endless.waveCap === "function") {
    try { cap = Endless.waveCap(wave) || 0; } catch (e) { cap = 0; }
  }
  if (!cap) cap = onScreen;
  // 倒计时 / 推进量 / BOSS（缺接口时安全降级）
  var timeLeft = (hasEndless && typeof Endless.timeLeft === "function") ? Endless.timeLeft() : 0;
  var progress = (hasEndless && typeof Endless.progress === "function") ? Endless.progress() : (kills || 0);
  var bossIndex = (hasEndless && typeof Endless.bossIndex === "function") ? Endless.bossIndex() : 0;
  var finalSpawned = (hasEndless && typeof Endless.isFinalBossSpawned === "function") ? Endless.isFinalBossSpawned() : false;
  var finalDefeated = (hasEndless && typeof Endless.isFinalBossDefeated === "function") ? Endless.isFinalBossDefeated() : false;
  // BOSS 是否在场（世界侧统计，兼容旧字段）
  var bossAlive = false;
  try {
    var list = (w && w.monsters) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && !list[i].dead && list[i].d && list[i].d.type === "boss") { bossAlive = true; break; }
    }
  } catch (e) { bossAlive = false; }
  // 撤离点是否已开启（🅑 写 world.exitBeacon）
  var extractOpen = !!(w && w.exitBeacon);
  return {
    wave: wave, kills: kills, onScreen: onScreen, cap: cap,
    timeLeft: timeLeft, progress: progress, bossIndex: bossIndex,
    finalSpawned: finalSpawned, finalDefeated: finalDefeated,
    bossAlive: bossAlive, extractOpen: extractOpen,
  };
}
if (typeof globalThis !== "undefined") globalThis.endlessHudData = endlessHudData;

/* 无尽 HUD 主渲染（被 render() 内单行调用；仅无尽世界生效） */
function renderEndlessHud(ctx) {
  if (!ctx) return;
  // 1) 仅无尽模式：正式关卡 / 主城 / 裂缝 / 工匠世界不显示
  var inEndless = false, world = null;
  try {
    inEndless = !!(typeof G !== "undefined" && G && G.inEndless);
    world = (typeof G !== "undefined" && G && G.activeWorld) || null;
  } catch (e) { return; }
  if (!inEndless || !world) return;

  var d = endlessHudData(world);
  var C = endlessHudColors();
  var hc = endlessHudCfg();
  var mt = endlessHudMetrics();
  var S = mt.scale;

  // 2) 钉到屏幕坐标（复位相机变换与缩放）
  ctx.save();
  try {
    if (typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
  } catch (e) { /* 桩无 setTransform：沿用当前变换，不阻断 */ }

  var padX = hc.panelPadX * S, padY = hc.panelPadY * S;
  var lineH = hc.lineH * S;
  var fsTime = Math.round(hc.timeFontSize * S);
  var fsBody = Math.round(hc.fontSize * S);
  var fsSmall = Math.round(hc.fontSmall * S);
  var fsBoss = Math.round(hc.bossFontSize * S);
  var fsHint = Math.round(hc.hintFontSize * S);
  var barW = Math.round(hc.barWidth * S);
  var barH = Math.max(4, Math.round(hc.barHeight * S));

  // 背板高度：倒计时行 + 进度条行 + 波次行 + 小字行（+ 可选的 BOSS / 撤离提示行）
  var rows = 4;                                  // 倒计时 / 进度条 / 波次 / 小字
  if (d.bossAlive || (d.finalSpawned && !d.extractOpen)) rows++;
  if (d.extractOpen) rows++;
  var boxW = Math.max(200 * S, barW + padX * 2);
  var boxH = rows * lineH + padY * 2;

  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.panel;
  ctx.fillRect(mt.x, mt.y, boxW, boxH);
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(mt.x + 0.5, mt.y + 0.5, boxW - 1, boxH - 1);

  var y = mt.y + padY;
  var cx = mt.x + padX;

  // --- 行 1：倒计时 MM:SS（最醒目；最后 timeWarnSec 秒转红闪烁） ---
  var warn = endlessTimeWarn(d.timeLeft);
  var tColor = warn ? C.timeWarn : C.time;
  // 闪烁：告警期内每 blinkPeriodSec 亮/暗交替（暗相降低不透明度，而非消失，保证可读）
  var alpha = 1;
  if (warn) {
    var elapsedT = (typeof Endless !== "undefined" && Endless && Endless.state && Endless.state.elapsed) || 0;
    alpha = endlessBlinkOn(elapsedT) ? 1 : 0.35;
  }
  ctx.globalAlpha = alpha;
  ctx.font = "bold " + fsTime + "px sans-serif";
  ctx.fillStyle = tColor;
  ctx.fillText("⏱ " + formatEndlessTime(d.timeLeft), cx, y + lineH / 2);
  ctx.globalAlpha = 1;
  y += lineH;

  // --- 行 2：推进进度条 progress / 阈值 ---
  var ratio = endlessProgressRatio(d.progress, d.bossIndex);
  var thr = 1;
  if (typeof Endless !== "undefined" && Endless && typeof Endless.bossThreshold === "function") thr = Endless.bossThreshold(d.bossIndex) || 1;
  var barY = y + (lineH - barH) / 2;
  ctx.fillStyle = C.progressBg;
  ctx.fillRect(cx, barY, barW, barH);
  ctx.fillStyle = (ratio >= 1) ? C.progressBoss : C.progressFill;
  ctx.fillRect(cx, barY, Math.max(0, Math.round(barW * ratio)), barH);
  // 进度文本（右侧）：当前推进量 / 下一阈值
  ctx.font = "bold " + fsSmall + "px sans-serif";
  ctx.fillStyle = C.progressBoss;
  ctx.fillText("推进 " + Math.floor(d.progress) + "/" + Math.floor(thr), cx + barW + 8 * S, y + lineH / 2);
  y += lineH;

  // --- 行 3：BOSS 状态（无 BOSS 时隐藏）---
  var showBossRow = (d.bossAlive || (d.finalSpawned && !d.extractOpen));
  if (showBossRow) {
    var finalIdx = (typeof CFG !== "undefined" && CFG.endless && CFG.endless.finalBossIndex) || 3;
    ctx.font = "bold " + fsBoss + "px sans-serif";
    if (d.bossAlive) {
      var isFinal = d.finalSpawned && d.bossIndex >= finalIdx;
      ctx.fillStyle = isFinal ? C.bossFinal : C.boss;
      ctx.fillText(isFinal ? ("⚠ 最终 BOSS " + d.bossIndex + "/" + finalIdx)
        : ("BOSS " + d.bossIndex + "/" + finalIdx), cx, y + lineH / 2);
    } else {
      // 最终 BOSS 已生成但被击杀、撤离点未开（极短窗口）：提示等待撤离点
      ctx.fillStyle = C.bossFinal;
      ctx.fillText("⚠ 最终 BOSS " + d.bossIndex + "/" + finalIdx, cx, y + lineH / 2);
    }
    y += lineH;
  }

  // --- 行 4：撤离点提示（醒目闪烁）---
  if (d.extractOpen) {
    var on = endlessBlinkOn(d.timeLeft);
    ctx.globalAlpha = on ? 1 : 0.45;
    ctx.font = "bold " + fsHint + "px sans-serif";
    ctx.fillStyle = C.extract;
    ctx.fillText("◈ 撤离点已开启 —— 走过去撤离！", cx, y + lineH / 2);
    ctx.globalAlpha = 1;
    y += lineH;
  }

  // --- 行 5：波次（小字）---
  ctx.font = "bold " + fsSmall + "px sans-serif";
  ctx.fillStyle = C.wave;
  ctx.fillText("深渊 · 第 " + d.wave + " 波", cx, y + lineH / 2);
  y += lineH;

  // --- 行 6：击杀 / 同屏（小字）---
  ctx.fillStyle = C.kill;
  ctx.fillText("击杀 " + d.kills, cx, y + lineH / 2);
  ctx.fillStyle = C.cap;
  ctx.fillText("同屏 " + d.onScreen + "/" + d.cap, cx + 90 * S, y + lineH / 2);

  ctx.restore();
}

/* 暴露到全局（纯全局脚本，供 game.js 单行桥接调用） */
if (typeof globalThis !== "undefined") globalThis.renderEndlessHud = renderEndlessHud;

/* ============================================================================
 * 21.17 🅒 深渊结算面板调度（单行桥接，§5.45）—— 独立追加区块
 * ----------------------------------------------------------------------------
 * 背景：🅑 的 abyssExtractSettle(reason) 在**超时 / 撤离成功**时置 G.state="settled"
 *   并写 G.abyssSettleReason / G.abyssExtractSuccess，但**未弹结算面板**（仅死亡路径由
 *   main.js playerDied 弹）。本函数补上「state 已 settled 但面板未弹」的调度：
 *     · 读取 🅑 的权威信号 G.abyssSettleReason（"extract"/"timeout"/"death"）；
 *     · 调用全局 showEndlessSettle 走统一结算（其内部再调 UI.showEndlessSettle）；
 *     · 幂等：G.abyssSettleShown 标记，同一局只弹一次；
 *     · 非深渊 / 未就绪 → 立即返回，零副作用。
 * 接入：main.js 主循环 updateAbyssExtract(dt) 之后单行调用（typeof 守卫）。
 * ========================================================================== */
function riftHudReportReason() {
  var r = null;
  try { r = (typeof G !== "undefined" && G) ? G.abyssSettleReason : null; } catch (e) { r = null; }
  return (typeof r === "string" && r) ? r : null;
}

function riftHudDispatchSettle() {
  if (typeof G === "undefined" || !G) return false;
  if (!G.inEndless) return false;
  if (G.state !== "settled") { G.abyssSettleShown = false; return false; }  // 回到战斗态 → 复位标记，供下一局再弹
  var reason = riftHudReportReason();
  if (!reason) return false;                        // 无 🅑 署名 → 交给既有路径（死亡面板）
  if (G.abyssSettleShown) return false;             // 幂等：同一局只弹一次
  G.abyssSettleShown = true;
  // 组装结算对象：优先用 🅑 的 reason 署名 + Endless 权威数值
  var settle = { reason: reason, extracted: (reason === "extract") };
  if (typeof Endless !== "undefined" && Endless && typeof Endless.state === "object") {
    var st = Endless.state || {};
    if (typeof st.wave === "number") settle.wave = st.wave;
    if (typeof st.kills === "number") settle.kills = st.kills;
    if (typeof st.crystals === "number") settle.crystals = st.crystals;
    if (typeof st.elapsed === "number") settle.elapsed = st.elapsed;
    if (typeof st.bossIndex === "number") settle.bossKills = st.bossIndex;
    if (st.timedOut === true || reason === "timeout") settle.timedOut = true;
  }
  try {
    if (typeof UI !== "undefined" && UI && typeof UI.showEndlessSettle === "function") {
      UI.showEndlessSettle(settle);
    } else if (typeof showEndlessSettle === "function") {
      showEndlessSettle();
    }
  } catch (e) { return false; }
  return true;
}
if (typeof globalThis !== "undefined") globalThis.riftHudDispatchSettle = riftHudDispatchSettle;
