/* ============================================================
 * render.js — 渲染主路径 + 低画质降级（21.16 物理搬移拆分：原 game.js 第 5 部分）
 * 职责：render / renderCity 主渲染；毒圈 / 补给点渲染（renderHazard/renderSupply）；
 *       NPC 点选提示渲染（renderNpcTapHint/renderCityNpcTapHint）；深渊门渲染与提示
 *       （renderAbyssPortal/renderAbyssTapHint）；20.5 低画质降级区块（LQ 配置 /
 *       isLowQuality / applyLowQualityDPR / lqParticleCount / lqShouldDrawParticle）。
 * ⚠️ 本文件由纯物理搬移生成：除本头部职责注释与 "use strict"; 外，代码逐字沿用原文件。
 * ============================================================ */
"use strict";
function renderCity() {
  applyLowQualityDPR();   // 低画质：帧内纠偏 canvas 物理分辨率（DPR 封顶）
  const ctx = G.ctx, w = G.activeWorld, a = G.cityAvatar;
  if (!w || w.kind !== "city" || !a) return;
  ctx.fillStyle = "#101822";   // 主城地面主题（比战场更沉稳的夜色调）
  ctx.fillRect(0, 0, G.W, G.H);
  ctx.save();
  // 摄像机：跟随形象 + 边缘钳制（地图小于视口则居中）
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  let camX = w.w <= viewW ? (w.w - viewW) / 2 : U.clamp(a.x - viewW / 2, 0, w.w - viewW);
  let camY = w.h <= viewH ? (w.h - viewH) / 2 : U.clamp(a.y - viewH / 2, 0, w.h - viewH);
  ctx.scale(zoom, zoom); ctx.translate(-camX, -camY);
  // 地面网格 + 城墙（低画质：网格步长 ×2 → 整屏描边线数减半）
  const cityGridStep = isLowQuality() ? 96 * LQ_GRID_STEP_MUL : 96;
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += cityGridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += cityGridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  ctx.strokeStyle = "#3f5170"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物（装饰建筑）
  for (const o of w.obstacles) {
    ctx.fillStyle = "#243048"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  // NPC：交互虚线圈（判定 = 绘制 × altarJudgeMul，与祭坛同源契约）+ 头顶功能名
  for (const n of w.cityNpcs) {
    const isNear = G.cityNpcNear && G.cityNpcNear.id === n.id;
    const isOpen = G.cityNpcOpen && G.cityNpcOpen.id === n.id;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = n.color + (isOpen ? "aa" : isNear ? "88" : "44");
    ctx.beginPath(); ctx.arc(n.x, n.y, CFG.city.npcRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    drawActor(ctx, n.x, n.y, 40, n.color, n.icon);
    ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = n.color; ctx.fillText(n.name, n.x, n.y - 52);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#9fb4d4";
    ctx.fillText(n.desc, n.x, n.y + 58);
    if (isNear && !isOpen) {   // 圈内提示（21.10：触屏设备显示「点击进入」，桌面保留「按 E 互动」）
      ctx.font = "bold 13px sans-serif"; ctx.fillStyle = "#ffd76a";
      const touchOnly = (typeof isTouchDevice === "function") && isTouchDevice()
        && !!(CFG.mobile && CFG.mobile.hideTouchButtons);
      ctx.fillText(touchOnly ? "点击进入" : "按 E 互动", n.x, n.y + 74);
    }
  }
  renderCityNpcTapHint(ctx, w);   // 21.10 主城 NPC 点选提示环（金环脉冲 + 「点击进入」浮动文案）
  renderAbyssPortal(ctx, w);      // 21.15 深渊之门渲染（末尾区块，单行调用）
  // 出征传送门：读条环 + 涟漪动画
  const pt = w.portal;
  ctx.beginPath(); ctx.arc(pt.x, pt.y, 34 + 3 * Math.sin(G.time * 3), 0, Math.PI * 2);
  ctx.fillStyle = "#7de08a22"; ctx.fill();
  ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 3; ctx.stroke();
  ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
  ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#7de08a";
  ctx.fillText(pt.name, pt.x, pt.y - 58);
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#9fb4d4";
  ctx.fillText(CFG.city.portal.desc, pt.x, pt.y + 56);
  if (w.portalProgress > 0) {
    const frac = Math.min(1, w.portalProgress / pt.channel);
    ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 42, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(Math.floor(frac * 100) + "%", pt.x, pt.y - 74);
  }
  // 玩家形象（皮肤 = 英雄素材；当前素材未分化时全部英雄共用 hero 图，分化后走 heroDef.sprite）
  const skinKey = CFG.heroes.find(h => h.id === a.skin) ? a.skin : CFG.profile.defaultSkin;
  const heroDef0 = CFG.heroes.find(h => h.id === skinKey);
  const img = G.sprites[(heroDef0 && heroDef0.sprite) || "hero"] || G.sprites.hero;
  if (img) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.faceDir, 1);
    ctx.drawImage(img, -30, -34, 60, 60);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7ec8ff"; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#cfe0ff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(Meta.profileName(), a.x, a.y - 46);
  ctx.font = "10px sans-serif"; ctx.fillStyle = "#ffd76a";
  ctx.fillText("「" + Meta.titleName() + "」", a.x, a.y - 33);
  ctx.restore();
}

/* ============ 渲染 ============ */
function render() {
  applyLowQualityDPR();   // 低画质：帧内纠偏 canvas 物理分辨率（DPR 封顶）
  const ctx = G.ctx, w = G.activeWorld;
  ctx.fillStyle = (G.levelCfg && G.levelCfg.theme) || "#141a24";
  ctx.fillRect(0, 0, G.W, G.H);
  if (!w) return;
  ctx.save();
  if (G.shakeT > 0) {   // 屏幕震动（受击/Boss 爆炸），随剩余时间线性衰减
    const a = (G.shakeAmp || 0) * (G.shakeT / CFG.audio.shake.dur);
    ctx.translate(U.rand(-a, a), U.rand(-a, a));
  }
  // 摄像机：zoom 变焦 + 跟随玩家 + 地图边缘钳制（地图小于视口则居中）
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  let camX, camY;
  if (w.w <= viewW) camX = (w.w - viewW) / 2;
  else camX = U.clamp(G.player.x - viewW / 2, 0, w.w - viewW);
  if (w.h <= viewH) camY = (w.h - viewH) / 2;
  else camY = U.clamp(G.player.y - viewH / 2, 0, w.h - viewH);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);
  // 地面网格（低画质：步长 ×2 → 整屏描边线数减半）
  const gridStep = isLowQuality() ? 96 * LQ_GRID_STEP_MUL : 96;
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  // 墙
  ctx.strokeStyle = "#3a4a66"; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物
  for (const o of w.obstacles) {
    ctx.fillStyle = "#2a3648"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  renderHazard(ctx, w);   // 毒圈收缩（B 线独立区块）：边界环 + 环外渐暗
  renderSupply(ctx, w);   // 补给点（B 线独立区块）：绿色发光圈 + 补给图标
  renderNpcTapHint(ctx, w);   // 21.1 NPC 点选提示环（锁定时灰虚线圈 / 解锁后金环 + 「点击进入」）
  // 祭坛
  for (const a of w.altars) {
    ctx.beginPath(); ctx.arc(a.x, a.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = a.cfg.color + "33"; ctx.fill();
    ctx.strokeStyle = a.cfg.color; ctx.lineWidth = 2.5; ctx.stroke();
    // 交互圈（虚线 = 真实判定圈，直接用 cfg.radius，与判定同源）
    ctx.setLineDash([6, 6]); ctx.strokeStyle = a.cfg.color + "55";
    ctx.beginPath(); ctx.arc(a.x, a.y, a.cfg.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = a.cfg.color; ctx.fillText(a.cfg.icon, a.x, a.y);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#e8ecf2";
    ctx.fillText(a.cfg.name, a.x, a.y + 40);
    // 进度环（与雕像绑定：圈内积累，离开缓慢衰退）
    if (a.progress > 0) {
      const frac = Math.min(1, a.progress / a.cfg.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(a.x, a.y, 34, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", a.x, a.y - 44);
    }
  }
  // 撤离点雕像（5.2）：主地图当前撤离点，绿色系信标风格（虚线圈 = 判定圈，与祭坛同一契约）
  if (w.isMain && G.run && G.run.exitStatue) {
    const st = G.run.exitStatue, rExt = CFG.extract.radius;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(st.x, st.y, rExt, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(st.x, st.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("▲", st.x, st.y);
    ctx.font = "13px sans-serif"; ctx.fillStyle = "#7de08a";
    ctx.fillText(`撤离点（圈内自动读条 ${CFG.extract.channel} 秒）`, st.x, st.y - 46);
    // 读条进度环：画在雕像位置（受击归零；圈内英雄全部离开则缓慢衰退）
    if (G.run.extractChanneling && G.run.extractProgress > 0) {
      const frac = Math.min(1, G.run.extractProgress / CFG.extract.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(st.x, st.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", st.x, st.y - 58);
    }
  }
  // 工匠世界 NPC / 返回信标（虚线圈 = 判定圈，与祭坛同一契约）
  if (!w.isMain && w.kind === "artisan") {
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#ffd76a55";
    ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 90, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    drawActor(ctx, w.npc.x, w.npc.y, 40, "#ffd76a", "⚒");
    ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd76a";
    ctx.fillText("工匠（靠近开箱）", w.npc.x, w.npc.y - 56);
    if (w.npcProgress > 0) {
      const frac = Math.min(1, w.npcProgress / 1.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 48, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", w.exitBeacon.x, w.exitBeacon.y);
    ctx.font = "13px sans-serif"; ctx.fillText("返回出口（读条3秒）", w.exitBeacon.x, w.exitBeacon.y - 46);
    if (w.exitProgress > 0) {
      const frac = Math.min(1, w.exitProgress / 3.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", w.exitBeacon.x, w.exitBeacon.y - 58);
    }
  }
  // 空间裂缝返回信标：地上随机刷出，读条 5 秒（受击归零），离开圈进度保留
  if (w.kind === "rift" && w.returnBeacon) {
    const b = w.returnBeacon;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", b.x, b.y);
    ctx.font = "13px sans-serif"; ctx.fillText(`返回信标（读条${CFG.rift.channel}秒）`, b.x, b.y - 46);
    if (w.returnProgress > 0) {
      const frac = Math.min(1, w.returnProgress / CFG.rift.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", b.x, b.y - 58);
    }
  }
  // 地上宝箱
  for (const c of w.groundChests) {
    const col = CFG.chestQualities[c.chestQ].color;
    ctx.fillStyle = col; ctx.strokeStyle = "#fff8"; ctx.lineWidth = 1.5;
    ctx.fillRect(c.x - 13, c.y - 10, 26, 20);
    ctx.strokeRect(c.x - 13, c.y - 10, 26, 20);
  }
  // 掉落物：金币 / 经验宝石
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const pk of w.pickups) {
    if (pk.type === "coin") {
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd76a"; ctx.fill();
      ctx.strokeStyle = "#8a6a1a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#8a6a1a"; ctx.font = "bold 9px sans-serif";
      ctx.fillText("¥", pk.x, pk.y + 0.5);
    } else {
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y - 8); ctx.lineTo(pk.x + 6, pk.y);
      ctx.lineTo(pk.x, pk.y + 8); ctx.lineTo(pk.x - 6, pk.y); ctx.closePath();
      ctx.fillStyle = "#c79bff"; ctx.fill();
      ctx.strokeStyle = "#5a3a8a"; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  // 怪物
  const szMul = CFG.monsterSizeMul || 1;
  /* 视野外剔除（21.13 常态化）：margin = 精灵/血条/光环最大外扩 + 预警圈余量。
   * 视野外的怪物对画面零贡献（看不见），跳过可省 drawImage + 血条 + 光环 + 预警判定。
   * 21.12 压测实测：3000 只时约 55% 在视野外，剔除后 drawCall 大幅下降。
   * ⚠️ 必须给足 margin：Boss 爆炸预警圈/弹幕电报可达半径 200+，预留 260 防"预警圈被裁掉半圈"。 */
  const cullMargin = 260;
  for (const m of w.monsters) {
    if (m.x + cullMargin < camX || m.x - cullMargin > camX + viewW ||
        m.y + cullMargin < camY || m.y - cullMargin > camY + viewH) continue;
    const img = m.sprite;
    const size = (m.d.type === "boss" ? 130 : 48) * szMul * (m.isElite ? CFG.elites.sizeMul : 1);
    // 精英光环 + 词缀名
    if (m.isElite) {
      const affixes = m.eliteAffixes || [];
      const col = (CFG.elites.affixes[affixes[0]] && CFG.elites.affixes[affixes[0]].color) || "#e5a04b";
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 8, 0, Math.PI * 2);
      if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke(); }   // 低画质：跳过光环描边（省一次圆弧描边，仍保留填充色块）
      ctx.fillStyle = col + "22"; ctx.fill();
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = col; ctx.fillText("精英·" + affixes.join("·"), m.x, m.y - size / 2 - 20);
      // 护盾条
      if (m.shield > 0) {
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
        ctx.fillStyle = "#6cb2ff"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
      }
    }
    if (img) {
      ctx.save();
      if (m.flashT > 0) ctx.filter = "brightness(2)";
      ctx.drawImage(img, m.x - size / 2, m.y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = m.d.type === "boss" ? "#e5484d" : "#c96"; 
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    // 血条：仅 Boss / 精英保留（21.15 用户拍板——小怪 2~4 击即死，血条是视觉噪声）
    if (m.d.type === "boss" || m.isElite === true) {
      const bw = m.d.type === "boss" ? 110
        : ((CFG.elites && CFG.elites.barWidth) || 44);   // 精英血条更醒目（44），与普通怪旧值 34 区分
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw, 5);
      ctx.fillStyle = m.d.type === "boss" ? "#ff5b5b" : "#e5a04b";
      ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw * Math.max(0, m.hp / m.hpMax), 5);
    }
    renderBurnAura(ctx, m);   // 行为芯片（19.12）：燃蚀火色描边
    // 冲锋预警
    if (m.d.type === "charger" && m.state === "telegraph") {
      const ang = Math.atan2(G.player.y - m.y, G.player.x - m.x);
      ctx.strokeStyle = "#ff5b5b"; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(ang) * m.ak.chargeRange, m.y + Math.sin(ang) * m.ak.chargeRange); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Boss 爆炸预警圈（17.3 颜色语言：红 = 范围爆炸）
    if (m.d.type === "boss" && m.warnT > 0) {
      const t = m.warnT / m.ak.boomWarn;
      ctx.strokeStyle = `rgba(229,72,77,${0.4 + 0.4 * Math.sin(G.time * 14)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.ak.boomRadius * (1 - t * 0.15), 0, Math.PI * 2);
      if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.stroke(); } else { ctx.fillStyle = "rgba(229,72,77,0.14)"; ctx.fill(); }   // 低画质：描边改纯色填充（省圆弧描边，预警仍可见）
      ctx.fillStyle = "rgba(229,72,77,0.08)"; ctx.fill();
    }
    // Boss 弹幕电报（17.3 颜色语言：白 = 弹幕预警）——充能圈/扇面，到点才真正发射
    if (m.d.type === "boss" && m.patternWarnT > 0 && m.warnP) {
      const P = m.warnP;
      const dur = P.warnTime != null ? P.warnTime : CFG.boss.warnTime;
      const k = dur > 0 ? 1 - m.patternWarnT / dur : 1;          // 0 → 1 的充能进度
      const R = (P.warnRadius || CFG.boss.warnRadius) * (0.35 + 0.65 * k);
      const white = CFG.boss.color.bullet;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = white;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 10));
      ctx.beginPath();
      if (P.pattern === "fan" || P.pattern === "wave") {          // 扇形/波幕：画扇面（含瞄准方向）
        const half = (P.arc != null ? P.arc / 2 : 0.3) + (P.pattern === "wave" ? 0.14 : 0);
        ctx.moveTo(m.x, m.y);
        ctx.arc(m.x, m.y, R, m.aimAng - half, m.aimAng + half);
        ctx.closePath();
      } else {                                                    // 放射/同心环/网格：画满圈
        ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Boss 阶段转换无敌护盾（转换窗口内的可见反馈，避免"打了没反应"的困惑）
    if (m.d.type === "boss" && m.phaseInvulnT > 0) {
      const a = 0.3 + 0.3 * Math.abs(Math.sin(G.time * 12));
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.3})`; ctx.fill();
    }
  }
  if (typeof renderEndlessHud === "function") renderEndlessHud(ctx);   // 21.15 无尽 HUD（🅒）单行桥接，实现见 js/hud_endless.js
  renderAbyssExtract(ctx, w);   // 21.17 深渊撤离点（🅑 独立区块，单行调用）：终点 BOSS 掉落的撤离点信标
  // 弹道
  for (const b of w.playerBullets) {
    ctx.fillStyle = b.isSkill ? "#6cb2ff" : "#ffd76a";
    ctx.beginPath();
    if (b.isSkill) { ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); }
    else { ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); }
    ctx.fill();
    if (b.isSkill) { if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = "#6cb2ff66"; ctx.beginPath(); ctx.arc(b.x, b.y, b.aoe * 0.4, 0, Math.PI * 2); ctx.stroke(); } }   // 低画质：跳过技能弹范围描边（子弹本体填充保留）
  }
  /* 敌方弹幕（21.13 批绘重构）：按「外观等价类」分三桶，每桶单 Path 一次 fill。
   * 重构前：每发子弹 3 次 canvas 调用（beginPath + arc + fill）——2000 发 = 6000 次/帧。
   * 重构后：3 桶 × 3 次 = 9 次/帧（与弹幕总量无关）。视觉逐位等价（同色同半径的圆，Path 合并后
   * 填充结果完全一致，仅描边类需独占，故 boss 弹拆两支）。
   * ⚠️ moveTo 必须逐个写：不写会让相邻弹幕被直线连起来（大面积三角填充色块）。 */
  const ebBoss = [], ebSmall = [];
  for (const b of w.enemyBullets) (b.boss ? ebBoss : ebSmall).push(b);
  // 小怪弹：纯色圆填充
  if (ebSmall.length) {
    ctx.fillStyle = "#c79bff";
    ctx.beginPath();
    for (const b of ebSmall) { ctx.moveTo(b.x + 5, b.y); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); }
    ctx.fill();
  }
  // Boss 弹：亮色圆填充（描边另起一支，保持"一眼可分"的辨识度）
  if (ebBoss.length) {
    ctx.fillStyle = "#e6f4ff";
    ctx.beginPath();
    for (const b of ebBoss) { ctx.moveTo(b.x + 6, b.y); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); }
    ctx.fill();
    if (!(LQ_SKIP_GLOW && isLowQuality())) {          // 低画质：跳过弹幕描边外圈（填充已够辨识）
      ctx.strokeStyle = "rgba(160,220,255,.75)"; ctx.lineWidth = 1.5;
      for (const b of ebBoss) { ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  renderLasers(ctx, w);   // Boss 激光（17.7 第 3 步）：预警细线 + 激活粗光柱
  renderChainFx(ctx);     // 行为芯片（19.12）：链锁瞬结线段
  // 玩家
  const p = G.player;
  const heroImg = G.sprites.hero;
  if (heroImg) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.faceDir, 1);
    ctx.drawImage(heroImg, -30, -34, 60, 60);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7ec8ff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  // 队长头顶血条 + 能量条（与队友同款样式；左上角大血条已移除，队伍信息统一在角色头顶）
  if (G.run) {
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 20, p.y - 40, 40, 4);
    ctx.fillStyle = "#7de08a";
    ctx.fillRect(p.x - 20, p.y - 40, 40 * Math.max(0, G.run.hp / G.run.hpMax), 4);
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 20, p.y - 34, 40, 3);
    ctx.fillStyle = "#6cb2ff";
    ctx.fillRect(p.x - 20, p.y - 34, 40 * Math.max(0, Math.min(1, G.run.energy / (G.run.energyMax || 1))), 3);
  }
  // AI 队友（组队）
  if (G.run && G.run.companions) {
    for (const c of G.run.companions) {
      if (!c.alive) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = "#5a6a80";
        ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#aab6c8"; ctx.font = "bold 12px sans-serif";
        ctx.fillText("✖", c.x, c.y + 4); ctx.globalAlpha = 1;
        continue;
      }
      const img = G.sprites.hero;
      if (img) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.faceDir, 1);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, -30, -34, 60, 60);
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#8fd0a0"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      // 头顶血条 + 能量条（队友是独立个体：各自有能量池）
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(c.x - 20, c.y - 40, 40, 4);
      ctx.fillStyle = "#7de08a";
      ctx.fillRect(c.x - 20, c.y - 40, 40 * Math.max(0, c.hp / c.hpMax), 4);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(c.x - 20, c.y - 34, 40, 3);
      ctx.fillStyle = "#6cb2ff";
      ctx.fillRect(c.x - 20, c.y - 34, 40 * Math.max(0, Math.min(1, (c.energy || 0) / (c.energyMax || 1))), 3);
    }
  }
  // 陷阱（大地雷）：触发圈虚线 = 触发范围（与伤害范围同源）；引信期闪烁。只画本世界的
  if (G.run && G.run.traps) {
    for (const t of G.run.traps) {
      if (t.world && t.world !== G.activeWorld) continue;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = t.armed ? "rgba(255,91,91," + (0.5 + 0.4 * Math.sin(G.time * 18)) + ")" : "#e5a04b66";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = "#3a4250"; ctx.fill();
      ctx.strokeStyle = "#e5a04b"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = t.armed && Math.sin(G.time * 18) > 0 ? "#ff5b5b" : "#e5a04b";
      ctx.beginPath(); ctx.arc(t.x, t.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 召唤物（无人机）：青色机体 + 头顶血条。只画本世界的
  if (G.run && G.run.drones) {
    for (const d of G.run.drones) {
      if (d.hp <= 0 || (d.world && d.world !== G.activeWorld)) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(G.time * 6);   // 旋翼旋转感
      ctx.strokeStyle = "#54d8e8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#54d8e8"; ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(d.x - 12, d.y - 20, 24, 3.5);
      ctx.fillStyle = "#54d8e8";
      ctx.fillRect(d.x - 12, d.y - 20, 24 * Math.max(0, d.hp / d.hpMax), 3.5);
    }
  }
  // 撤离读条环（5.2：任意位置激活，环画在队长脚下）
  const rr = G.run;
  if (rr && rr.extractChanneling && rr.extractProgress > 0) {
    const frac = Math.min(1, rr.extractProgress / CFG.extract.channel);
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(G.player.x, G.player.y, G.player.r + 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`撤离 ${Math.floor(frac * 100)}%`, G.player.x, G.player.y - G.player.r - 26);
  }
  // 特效
  for (let pi = 0; pi < FX.parts.length; pi++) {
    if (!lqShouldDrawParticle(pi)) continue;   // 低画质：隔颗抽样绘制（省填充；正常恒绘制）
    const pt = FX.parts[pi];
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of FX.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.font = "bold 17px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();   // 收束屏幕震动 translate
  // 屏幕空间 HUD：裂缝任务 / 诅咒状态（不受摄像机影响）
  if (G.run) {
    const t = G.run.riftTask;
    if (G.inRift && t) {
      const st = t.done ? "✔ 已完成" : t.failed ? "✘ 已失败" : (t.time ? `剩余 ${Math.max(0, Math.ceil(t.remain))}s` : "");
      ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = t.done ? "#7de08a" : t.failed ? "#ff5b5b" : "#5ad0ff";
      ctx.fillText(`◈ 任务【${t.name}】：${t.desc} ${st}`, G.W / 2, 34);
    }
    const cu = G.run.curse;
    if (cu) {
      ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#ff8c5a";
      ctx.fillText(`☠ ${cu.name} ${Math.ceil(cu.remain)}s · 敌人强化中 · 掉落 ×${cu.rewardMul}`, G.W / 2, 56);
    }
    // 子地图开场冻结倒计时（5.1）：全员静止 + 全员无敌，红色大字 3/2/1
    const fw = G.activeWorld;
    if (fw && fw.freezeTimer > 0) {
      const n = Math.max(1, Math.ceil(fw.freezeTimer));
      ctx.save();
      ctx.fillStyle = "rgba(8,12,20,0.35)"; ctx.fillRect(0, 0, G.W, G.H);   // 压暗战场，突出倒计时
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 132px sans-serif";
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.strokeText(String(n), G.W / 2, G.H / 2 - 24);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillText(String(n), G.W / 2, G.H / 2 - 24);
      ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "#ffb3b3";
      ctx.fillText("全员冻结中 · 准备战斗", G.W / 2, G.H / 2 + 70);
      ctx.restore();
    }
  }
}
/* ---------------- 渲染 ---------------- */

/* ============================================================================
 * 21.17 深渊撤离点渲染（🅑 独立区块 §5.45，单行调用点 = render() 内）
 * ----------------------------------------------------------------------------
 * 只渲染**深渊世界**的撤离点信标：绿系信标 + 虚线判定圈 + 读条进度环，
 * 视觉与主线 exitBeacon 同款（同一套配色/半径语义），但用独立函数承载，
 * 以免在 render.js 的 isMain / artisan 条件分支里做跨世界耦合。
 * ⚠️ 零改动既有分支：非深渊世界（kind !== "endless"）恒早退。
 * ========================================================================== */
function renderAbyssExtract(ctx, w) {
  if (!w || w.kind !== "endless" || !w.exitBeacon) return;   // 仅深渊 + 已掉点
  var b = w.exitBeacon;
  var judgeR = (typeof abyssExtractCfg === "function") ? abyssExtractCfg().judgeRadius : 100;
  var channel = (typeof abyssExtractCfg === "function") ? abyssExtractCfg().channel : 3.0;
  ctx.save();
  // 判定圈（虚线 = 真实判定圈，与主线 exitBeacon / 祭坛同一契约）
  ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(b.x, b.y, judgeR, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // 信标本体
  ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#7de08a33"; ctx.fill();
  ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("◀", b.x, b.y);
  ctx.font = "13px sans-serif";
  ctx.fillText("撤离点（圈内自动读条 " + channel + " 秒 · 全收益）", b.x, b.y - 46);
  // 读条进度环（受击归零；圈内英雄全部离开则缓慢衰退）
  var prog = w.abyssExtractProgress || 0;
  if (prog > 0 && channel > 0) {
    var frac = Math.min(1, prog / channel);
    ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(Math.floor(frac * 100) + "%", b.x, b.y - 58);
  }
  ctx.restore();
}

/** 毒圈渲染：红色半透明环边界 + 环外渐暗遮罩（在障碍层之后、实体之前绘制）。 */
function renderHazard(ctx, w) {
  const hz = w && w.hazard;
  if (!hz || !hz.active) return;
  const cfg = hz.cfg, col = cfg.color || "#ff3b3b";
  ctx.save();
  // 环外渐暗：用 evenodd 填充「大矩形 - 安全圈」的差集
  ctx.beginPath();
  ctx.rect(0, 0, w.w, w.h);
  ctx.arc(hz.cx, hz.cy, hz.curR, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(120,0,0,0.22)";
  ctx.fill("evenodd");
  // 边界环（脉动）
  const a = 0.65 + 0.3 * Math.abs(Math.sin(G.time * 3));
  ctx.beginPath(); ctx.arc(hz.cx, hz.cy, hz.curR, 0, Math.PI * 2);
  ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 补给点渲染：绿色发光圈 + 补给图标 + 读条环（判定圈虚线 = 与判定同源）。 */
function renderSupply(ctx, w) {
  const pts = w && w.supplyPoints;
  if (!pts || !pts.length) return;
  for (const sp of pts) {
    const cfg = sp.cfg, col = cfg.color || "#5ad07a", R = cfg.radius || 90;
    const glow = 0.35 + 0.25 * Math.abs(Math.sin(G.time * 4));
    ctx.save();
    // 发光圈（低画质：跳过虚线判定圈描边，保留填充底圈）
    ctx.beginPath(); ctx.arc(sp.x, sp.y, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,208,122,0.10)"; ctx.fill();
    if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.setLineDash([6, 6]); ctx.strokeStyle = col + "88"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
    // 图标
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = col + "33"; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = glow + 0.4; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = col; ctx.fillText("✚", sp.x, sp.y);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#e8ecf2";
    ctx.fillText(`补给点（读条 ${cfg.channelSeconds || 3}s）`, sp.x, sp.y + 42);
    // 读条进度环
    if (sp.progress > 0) {
      const frac = Math.min(1, sp.progress / (cfg.channelSeconds || 3));
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 34, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", sp.x, sp.y - 44);
    }
    ctx.restore();
  }
}

/* ============================================================================
 * 20.5 低画质渲染降级（独立区块，§5.45 铁律：文件末尾独立区块 + 现有函数只插单行调用）
 * ----------------------------------------------------------------------------
 * 背景：低画质开关早已存在（G.settings.lowQuality / window.__lowQuality，见 main.js），
 *       但渲染层从未消费它。本区块把它真正落到绘制路径上，目标是把帧耗时压下来（渣机友好）。
 *
 * 铁律：
 *  1. 只降**视觉表现**，绝不改游戏逻辑（碰撞 / 伤害 / AI / 掉落全走原路径）。
 *  2. 低画质**关闭时行为逐位不变**（所有降级都包在 isLowQuality() 分支里，默认 false）。
 *  3. 配置化：优先读 CFG.lowQuality，缺省用内置默认值——主会话后续可把它挪进 config.js
 *     而无需改本文件（只读、可缺省、逐字段回落）。
 *  4. 不引入高版本 JS 语法（ES5 兼容），所有 window/G 访问均防御式（测试沙箱可能没有）。
 * ============================================================================ */

/* 低画质可调数值：优先 CFG.lowQuality（未来可挪进 config.js），逐字段回落内置默认。
 * 例：CFG.lowQuality = { particleMul: 0.4, dprCap: 1.5, ... }。 */
var LQ = (typeof CFG !== "undefined" && CFG && CFG.lowQuality) ? CFG.lowQuality : {};
/* 粒子生成倍率（<1 削弱）：0.4 → 原本 40 颗的爆发只出 16 颗，UPDATE/DRAW 两段线性下降。 */
var LQ_PARTICLE_MUL = (typeof LQ.particleMul === "number") ? LQ.particleMul : 0.4;
/* 粒子渲染抽样比：1 表示全部绘制；低画质把已有粒子再抽稀（只画 1/2），纯粹省填充。 */
var LQ_PARTICLE_DRAW_DIV = (typeof LQ.particleDrawDiv === "number") ? LQ.particleDrawDiv : 2;
/* 设备像素比封顶：DPR 2→1.5 约省 44% 像素填充（1.5²/2² = 0.5625），对 2D 满屏重绘收益最大。 */
var LQ_DPR_CAP = (typeof LQ.dprCap === "number") ? LQ.dprCap : 1.5;
/* 地面/主城网格步长倍率：网格是「每 96px 一条」的整屏描边，低画质拉大间距 = 少画一半线。 */
var LQ_GRID_STEP_MUL = (typeof LQ.gridStepMul === "number") ? LQ.gridStepMul : 2;
/* 是否跳过昂贵描边/发光（精英光环、预警圈、Boss 电报等降级为纯色/更少绘制）。 */
var LQ_SKIP_GLOW = (typeof LQ.skipGlow === "boolean") ? LQ.skipGlow : true;

/* 低画质判定：优先读 window.__lowQuality（main.js 镜像），回落 G.settings.lowQuality，均无则 false。
 * 内部做**帧号缓存**——每帧被调用数十次（每个绘制点一次），若每次都走完整解析会引入额外开销。
 * 缓存以 G.time 作为轻量帧戳：同一游戏时刻只解析一次；时间推进（下一次 render）自动失效重算。
 * 另加**源值哨兵**：同一帧内若 window.__lowQuality 被外部改写（运行中切换开关），哨兵不一致 → 立即
 * 重算返回新值（只是一次布尔属性读，开销可忽略）——保证切换即时生效、不受缓存毒化。 */
var _lqCachedTime = -1;
var _lqCachedVal = false;
var _lqCachedSrc = null;   // 上次缓存时读到的原始源值（未命中任何源时为 null）
function isLowQuality() {
  // 读取原始源值（window 优先，回落 G.settings；均缺省 → null 表示"无源"=false）
  var raw;
  if (typeof window !== "undefined" && window && typeof window.__lowQuality === "boolean") raw = window.__lowQuality;
  else if (typeof G !== "undefined" && G && G.settings && typeof G.settings.lowQuality === "boolean") raw = G.settings.lowQuality;
  else raw = null;
  // 帧戳缓存 + 源值哨兵：同一帧且源值未变 → 直接返回缓存（避免重复解析）
  var now = (typeof G !== "undefined" && G) ? G.time : 0;
  if (now === _lqCachedTime && raw === _lqCachedSrc) return _lqCachedVal;
  _lqCachedTime = now;
  _lqCachedSrc = raw;
  _lqCachedVal = (raw === true);
  return _lqCachedVal;
}

/* 供测试/调试：清空帧戳缓存（一般无需调用，时间推进/源值变化即自动失效）。 */
function lowQualityCacheReset() { _lqCachedTime = -1; _lqCachedSrc = null; }

/* 低画质下 canvas 设备像素比封顶：把物理分辨率钳到 LQ_DPR_CAP × 逻辑尺寸，显著减少填充率。
 * main.js.fitCanvas 不可改，故在此提供「自动纠偏」入口：render 每帧单行调用，一旦发现当前
 * canvas 物理像素超过封顶点（例如切到低画质、或窗口 resize 被 fitCanvas 重置）就立即压低。
 * 逻辑尺寸 G.W/G.H 与 CSS 显示尺寸不变 → 画面构图/坐标零变化，只是内部像素更少（略糊，换帧率）。
 * 关闭低画质时不干预（canvas.width 由 fitCanvas 全权控制，行为与改动前一致）。 */
function applyLowQualityDPR() {
  if (!isLowQuality()) return;
  var c = (typeof G !== "undefined" && G) ? G.canvas : null;
  if (!c || typeof c.getContext !== "function") return;
  var W = G.W || 0, H = G.H || 0;
  if (!W || !H) return;
  var capW = Math.round(W * LQ_DPR_CAP), capH = Math.round(H * LQ_DPR_CAP);
  // 已封顶（或低于封顶）→ 不动；超过封顶 → 压低物理分辨率（仅当真的超了才重设，避免每帧抖动）
  if (c.width > capW || c.height > capH) { c.width = capW; c.height = capH; }
}

/* 低画质下的粒子生成数：正常返回 n，低画质按 LQ_PARTICLE_MUL 削减（至少 1，避免"看起来没反应"）。
 * 纯函数、无副作用，方便单测断言「正常 40 → 低画质 <20」。 */
function lqParticleCount(n) {
  if (!isLowQuality()) return n;
  var m = Math.floor(n * LQ_PARTICLE_MUL);
  return m < 1 ? 1 : m;
}

/* 低画质下是否应绘制第 i 个粒子：按 LQ_PARTICLE_DRAW_DIV 抽样（只画 1/DIV）。
 * 正常画质恒 true（逐位不变）；低画质隔颗绘制 → 填充次数减半。 */
function lqShouldDrawParticle(i) {
  if (!isLowQuality()) return true;
  var d = LQ_PARTICLE_DRAW_DIV < 1 ? 1 : Math.floor(LQ_PARTICLE_DRAW_DIV);
  return (i % d) === 0;
}

/* NPC 点选提示环渲染（解锁后高亮脉冲，告诉玩家"现在可以点了"）。
 * 只在 npcReady 时绘制；未解锁时画暗环表示"还需要站一会儿"。 */
function renderNpcTapHint(ctx, w) {
  var n = w && w.npc;
  if (!n || w.isMain || w.kind !== "artisan") return;
  var cfg = CFG.mobile && CFG.mobile.npcTap;
  var r = (cfg && cfg.hintRadius) || 104;
  var ready = !!w.npcReady;
  var pulse = 0.5 + 0.5 * Math.sin(G.time * (ready ? 6 : 2.5));
  ctx.save();
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = ready ? "rgba(255,215,106," + (0.55 + 0.45 * pulse) + ")" : "rgba(120,150,190,.35)";
  ctx.lineWidth = ready ? 4 : 2;
  ctx.setLineDash(ready ? [] : [10, 8]);
  ctx.stroke();
  ctx.restore();
  // 解锁后附一行浮动提示（复用既有 float 文本管线，避免新增 UI 层）
  if (ready) {
    ctx.save();
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,215,106," + (0.7 + 0.3 * pulse) + ")";
    ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 4;
    ctx.strokeText("点击进入", n.x, n.y - r - 14);
    ctx.fillText("点击进入", n.x, n.y - r - 14);
    ctx.restore();
  }
}

/* 主城 NPC 触屏提示（手机无「按 E」键 → 圈内提示改为「点击进入」）。
 * 与 renderNpcTapHint（工匠世界）同款视觉：金环脉冲 + 浮动文案；由 renderCity 单行调用。 */
function renderCityNpcTapHint(ctx, w) {
  if (!w || w.kind !== "city") return;
  const near = G.cityNpcNear;
  if (!near || (G.cityNpcOpen && G.cityNpcOpen.id === near.id)) return;   // 圈内且未打开才提示
  const cfg = CFG.mobile && CFG.mobile.npcTap;
  const r = (cfg && cfg.hintRadius) || 104;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(near.x, near.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,215,106," + (0.55 + 0.45 * pulse) + ")";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,215,106," + (0.7 + 0.3 * pulse) + ")";
  ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 4;
  ctx.strokeText("点击进入", near.x, near.y - r - 14);
  ctx.fillText("点击进入", near.x, near.y - r - 14);
  ctx.restore();
}

/** 渲染深渊之门（由 renderCity 单行调用）：金红传送门 + 脉冲光环 + 读条环 + 圈内提示。
 *  视觉与既有 seasonPortal（未开放占位）/ 出征门（绿）明确区分：金红主色 + 双层脉冲环。 */
function renderAbyssPortal(ctx, w) {
  var p = w && w.abyssPortal;
  if (!ctx || !p) return;
  var c = abyssCfg();
  var col = c.color || ABYSS_FALLBACK.color;
  var glow = c.glow || ABYSS_FALLBACK.glow;
  var open = endlessReady() && c.ready !== false;
  var pulse = 0.5 + 0.5 * Math.sin(G.time * 2.6);
  ctx.save();
  // 判定圈（虚线，进圈高亮）
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = open ? (w.abyssReady ? col + "cc" : col + "66") : "rgba(120,150,190,.4)";
  ctx.lineWidth = w.abyssReady ? 3 : 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // 门体：双层脉冲光环（内实外虚，金红渐变感）
  var r0 = 34 + 3 * Math.sin(G.time * 3);
  ctx.beginPath(); ctx.arc(p.x, p.y, r0, 0, Math.PI * 2);
  ctx.fillStyle = open ? (col + "33") : "rgba(120,150,190,.15)"; ctx.fill();
  ctx.strokeStyle = open ? col : "rgba(120,150,190,.6)"; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, (c.radius || ABYSS_FALLBACK.radius) * 0.72 + 6 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = open ? (glow + "88") : "rgba(120,150,190,.3)"; ctx.lineWidth = 2; ctx.stroke();
  // 门名 + 说明
  ctx.textAlign = "center";
  ctx.font = "bold 14px sans-serif"; ctx.fillStyle = open ? col : "#9fb4d4";
  ctx.fillText(p.name, p.x, p.y - 58);
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#9fb4d4";
  ctx.fillText(open ? (c.desc || "") : "尚未开启", p.x, p.y + 56);
  // 读条环（进圈后）
  if (w.abyssProgress > 0) {
    var frac = Math.min(1, w.abyssProgress / p.channel);
    ctx.strokeStyle = glow; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 42, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = glow; ctx.font = "bold 13px sans-serif";
    ctx.fillText(Math.floor(frac * 100) + "%", p.x, p.y - 74);
  }
  ctx.restore();
  // 触屏点选提示（圈内 → 金环 + 「点击进入」；与 cityNpcTap/renderCityNpcTapHint 同款视觉）
  if (w.abyssReady && open) renderAbyssTapHint(ctx, p, c);
}

/** 深渊门触屏提示环（圈内且未读满时提示可点击）。 */
function renderAbyssTapHint(ctx, p, c) {
  var r = (c && c.hintRadius) || ABYSS_FALLBACK.hintRadius;
  var pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
  ctx.save();
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,215,106," + (0.55 + 0.45 * pulse) + ")";
  ctx.lineWidth = 4; ctx.stroke();
  ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,215,106," + (0.7 + 0.3 * pulse) + ")";
  ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 4;
  ctx.strokeText("点击进入", p.x, p.y - r - 14);
  ctx.fillText("点击进入", p.x, p.y - r - 14);
  ctx.restore();
}

