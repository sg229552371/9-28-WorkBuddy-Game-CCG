/* ============================================================================
 * 21.15 🅒 HUD 海量敌人信息区（无尽模式 / 深渊）—— 独立模块（§5.45 末尾区块）
 * ----------------------------------------------------------------------------
 * 定位：无尽世界（kind="endless"）战斗时，在**屏幕左上角**显示三行实时信息：
 *        深渊 · 第 N 波
 *        击杀 K
 *        同屏 M/cap
 *
 * 调用契约（由 game.js 血条块末尾单行桥接，见 render() 内 3688~3692 附近）：
 *    if (typeof renderEndlessHud === "function") renderEndlessHud(ctx);
 * 因此本函数**在 render() 的世界相机变换中**被调用（ctx 已 scale+translate）。
 * 为把 HUD 钉在屏幕坐标，函数内部 save() → setTransform(1,0,0,1,0,0) → 绘制 → restore()。
 * （setTransform 复位到设备像素坐标，与画布物理分辨率一致；不用 resetTransform，
 *   以兼容低画质 DPR 纠偏后的画布尺寸。）
 *
 * 数据来源（全部按方案契约）：
 *   · G.inEndless（无尽旗标，各端写入）
 *   · G.activeWorld.endlessWave（当前波次，Endless 侧维护）
 *   · G.activeWorld.monsters.length（同屏数）
 *   · Endless.state.kills（击杀数，Endless 侧维护）
 *   · Endless.waveCap(wave)（同屏上限曲线）
 *
 * 安全约束：
 *   · 仅 G.inEndless 时渲染（正式关卡 / 主城 / 裂缝 / 工匠世界一律不显示）
 *   · typeof Endless !== "undefined" 守卫（集成时序不确定，缺则安全降级）
 *   · 无 DOM 依赖（纯 canvas 绘制）；ctx 缺方法时静默跳过（测试桩健壮）
 *   · 移动端安全区：竖屏把内容下移 env(safe-area-inset-top)，避免刘海遮挡
 * ========================================================================== */
"use strict";

/* 无尽 HUD 配色（深色主题，对齐既有 CSS 变量口径） */
var ENDLESS_HUD_COLORS = {
  wave: "#e8c574",    // 波次：金
  kill: "#ff8f6a",    // 击杀：暖橙
  cap: "#8fd0ff",     // 同屏：冷蓝
  panel: "rgba(10,16,28,0.55)",
  edge: "rgba(120,150,200,0.35)",
};
if (typeof globalThis !== "undefined") globalThis.ENDLESS_HUD_COLORS = ENDLESS_HUD_COLORS;

/* 计算 HUD 左上角锚点（含安全区）。返回 {x, y, scale}。
 * scale：窄屏（画布宽较小，如前 1/4 或手机竖屏）时整体略缩，避免占满。
 * 画布物理分辨率口径 = G.W / G.H（fitCanvas 设定），与绘制坐标同源。 */
function endlessHudMetrics() {
  var W = (typeof G !== "undefined" && G && G.W) || 1920;
  var H = (typeof G !== "undefined" && G && G.H) || 1080;
  // 安全区：读 CSS 变量 --sa-top（:root 注入 env(safe-area-inset-top)），取不到则 0
  var saTop = 0;
  try {
    if (typeof window !== "undefined" && window.getComputedStyle && typeof document !== "undefined" && document.documentElement) {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue("--sa-top");
      var m = /([\d.]+)/.exec(raw || "");
      if (m) saTop = parseFloat(m[1]) || 0;
    }
  } catch (e) { saTop = 0; }
  // 画布内边距（设备像素）：随画布尺寸自适应，窄屏略小
  var pad = Math.max(12, Math.round(Math.min(W, H) * 0.02));
  var scale = Math.max(0.8, Math.min(1.6, Math.min(W, H) / 640));
  return { x: pad, y: pad + saTop, scale: scale, W: W, H: H };
}

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

  // 2) 数据采集（Endless 未就绪时安全降级）
  var hasEndless = (typeof Endless !== "undefined" && Endless) ? true : false;
  var wave = (world.endlessWave || 0);
  if (!wave && hasEndless && Endless.state) wave = Endless.state.wave || 0;
  var kills = (hasEndless && Endless.state && typeof Endless.state.kills === "number") ? Endless.state.kills : 0;
  var onScreen = (world.monsters && world.monsters.length) || 0;
  var cap = 0;
  if (hasEndless && typeof Endless.waveCap === "function") {
    try { cap = Endless.waveCap(wave) || 0; } catch (e) { cap = 0; }
  }
  if (!cap) cap = onScreen;   // 兜底：上限取不到时退化为「当前同屏」

  // 3) 钉到屏幕坐标（复位相机变换与缩放）
  var mt = endlessHudMetrics();
  var S = mt.scale;
  ctx.save();
  try {
    if (typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
  } catch (e) { /* 桩无 setTransform：沿用当前变换，不阻断 */ }

  var lines = [
    "深渊 · 第 " + wave + " 波",
    "击杀 " + kills,
    "同屏 " + onScreen + "/" + cap,
  ];
  var colors = [ENDLESS_HUD_COLORS.wave, ENDLESS_HUD_COLORS.kill, ENDLESS_HUD_COLORS.cap];
  var lineH = 22 * S;
  var fontSize = Math.round(15 * S);
  var padX = 12 * S, padY = 9 * S;
  // 预估面板宽度（按最长一行）
  var maxChars = 0;
  for (var i = 0; i < lines.length; i++) if (lines[i].length > maxChars) maxChars = lines[i].length;
  var boxW = Math.max(118 * S, maxChars * fontSize * 0.72 + padX * 2);
  var boxH = lines.length * lineH + padY * 2;

  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  // 背板（半透明深色 + 细描边，保证在任意地面上可读）
  ctx.fillStyle = ENDLESS_HUD_COLORS.panel;
  ctx.fillRect(mt.x, mt.y, boxW, boxH);
  ctx.strokeStyle = ENDLESS_HUD_COLORS.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(mt.x + 0.5, mt.y + 0.5, boxW - 1, boxH - 1);
  // 三行文本
  ctx.font = "bold " + fontSize + "px sans-serif";
  for (var k = 0; k < lines.length; k++) {
    ctx.fillStyle = colors[k];
    ctx.fillText(lines[k], mt.x + padX, mt.y + padY + lineH * k + lineH / 2);
  }
  ctx.restore();
}

/* 暴露到全局（纯全局脚本，供 game.js 单行桥接调用） */
if (typeof globalThis !== "undefined") globalThis.renderEndlessHud = renderEndlessHud;
