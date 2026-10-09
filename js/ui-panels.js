/* ============================================================
 * ui-panels.js — 面板 / TIPS / 立绘详情 / 赛季 / 无尽结算 UI
 * ------------------------------------------------------------
 * 21.16 物理搬移：从原 js/ui.js 尾部（原 2154~2602 行）整段剪切而来，
 * 未改一行逻辑。职责：
 *   · 属性/芯片查询与文案（statName / chipDef / chipPoolOf / chipEffectLine / chipTipHTML）
 *   · 物品 TIPS 渲染（itemTipHTML，与背包面板共用唯一数据源）
 *   · 主城 12 角立绘升级（renderCodexHeroPortraits / openHeroDetail / closeHeroDetail / _getHeroDetailEl）
 *   · 工匠世界竖屏布局常量（CFG_ARTISAN_UI）
 *   · 赛季大厅 UI（showSeason / grantSeasonExp）
 *   · 无尽模式结算与说明 UI（showEndlessSettle / hideEndlessSettle / showEndlessIntro / hideEndlessIntro）
 * 依赖方向：依赖 js/ui.js 定义的 UI 对象与全局 CFG / Meta / Assets / G。
 *   → 必须在 js/ui.js 之后加载（本文件多处 UI.xxx = ... 挂载到 UI）。
 * ============================================================ */


function statName(k) {
  return { hp: "生命", atk: "攻击", def: "防御", spd: "移速", regen: "能量恢复", energyMax: "能量上限" }[k] || k;
}

/* ---------- 芯片查询（19.6）：按 defId 在 valuePool + behaviorPool 里找定义 ---------- */
function chipDef(defId) {
  const c = CFG.chips;
  if (!c || !defId) return null;
  return (c.valuePool || []).find(x => x.id === defId) || (c.behaviorPool || []).find(x => x.id === defId) || null;
}
function chipPoolOf(defId) {
  const c = CFG.chips;
  if (!c) return null;
  if ((c.valuePool || []).some(x => x.id === defId)) return "value";
  if ((c.behaviorPool || []).some(x => x.id === defId)) return "behavior";
  return null;
}
/* 芯片效果单行文案（图鉴用）：数值芯片按品质档位显示放大量；行为芯片显示 desc。 */
function chipEffectLine(def, qIdx) {
  if (!def) return "";
  if (def.behavior) return `${def.desc}（N=${def.vals[qIdx] || def.vals[0]}）`;
  const v = def.vals[qIdx] !== undefined ? def.vals[qIdx] : def.vals[0];
  return def.mode === "flat" ? `${def.tag} +${v}` : `${def.tag} ${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
}
/* 芯片 TIPS：品质色名称 + 效果描述（数值芯片显示 tag 放大量；行为芯片显示 desc） */
function chipTipHTML(it) {
  const def = chipDef(it.defId);
  const q = CFG.itemQualities[it.itemQ] || CFG.itemQualities[0];
  const pool = chipPoolOf(it.defId);
  const lines = [];
  const kindName = pool === "behavior" ? "行为芯片" : "数值芯片";
  lines.push(`<div class="tip-head" style="color:${q.color}"><b>${def ? def.name : (it.name || it.defId)}</b><span>${q.name} · ${kindName}</span></div>`);
  lines.push(`<div class="tip-line dim">形状 ${it.shape ? it.shape.join("×") : "1×1"} · 品质 ${q.name}</div>`);
  if (def) {
    if (pool === "value") {
      const v = def.vals[it.itemQ];   // 该品质档位的放大量
      const txt = def.mode === "flat" ? `${def.tag} +${v}` : `${def.tag} ${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
      lines.push(`<div class="tip-line">效果：${txt}（作用于主动技能）</div>`);
    } else {
      lines.push(`<div class="tip-line">效果：${def.desc}（N=${def.vals[it.itemQ]}）</div>`);
    }
  }
  lines.push(`<div class="tip-line dim">芯片为局内资产，出局消失（不折算结晶）· 同名可叠，上限 ${(CFG.chips && CFG.chips.maxStack) || 9}</div>`);
  return lines.join("");
}

/* ---------- 物品 TIPS 渲染（唯一数据源：背包面板 / TIPS 浮窗共用；信息分层渐进展示） ---------- */
function itemTipHTML(it) {
  // 芯片（19.6）：名称 / 品质色 / 效果描述，数据源 = CFG.chips.valuePool + behaviorPool
  if (it.kind === "chip") return chipTipHTML(it);
  const q = it.kind === "chest" ? CFG.chestQualities[it.chestQ] : CFG.itemQualities[it.itemQ];
  const lines = [];
  // 头部：品质色名称 + 品类
  const kindName = { chest: "未开封宝箱", insurance: "契约", curse: "诅咒道具", gear: "装备", module: "武器模块" }[it.kind] || "物品";
  lines.push(`<div class="tip-head" style="color:${q.color}"><b>${it.name}</b><span>${q.name} · ${kindName}</span></div>`);
  lines.push(`<div class="tip-line dim">形状 ${it.shape[0]}×${it.shape[1]} · 重量 ${it.kind === "chest" ? CFG.chestQualities[it.chestQ].weight + "×" + it.count : it.weight} · 价值 ${it.value}</div>`);
  if (it.kind === "chest") lines.push(`<div class="tip-line">仅可在工匠世界开启（背包内按品质叠加）</div>`);
  if (it.kind === "insurance") lines.push(
    `<div class="tip-line">死亡时每份保护 1 件价值最高的物品</div>`,
    `<div class="tip-line">撤离时按固定价值统一折算 ◆${Math.floor(it.value * CFG.settleConvert.valueRate)} 结晶</div>`,
    `<div class="tip-line dim">契约本身不参与死亡损失</div>`);
  if (it.kind === "curse") {
    lines.push(`<div class="tip-line bad">☠ 主地图战斗中使用：强化敌人换取掉落翻倍</div>`);
    for (const c of CFG.curseItems.list) lines.push(`<div class="tip-line dim">· ${c.name}：${c.desc}（掉落 ×${c.rewardMul}）</div>`);
    lines.push(`<div class="tip-line dim">持续 ${CFG.curseItems.duration} 秒</div>`);
  }
  if (it.kind === "gear") {
    lines.push(`<div class="tip-line">` + Object.entries(it.stats).map(([k, v]) => `${statName(k)} +${v}`).join("，") + `</div>`);
    lines.push(`<div class="tip-line dim">放入武器栏才生效 · 对小队全体生效</div>`);
  }
  if (it.kind === "module") {
    const ml = CFG.moduleLevel, stage = moduleStage(it);
    lines.push(`<div class="tip-line">等级 LV${it.lv || 1}/${ml.maxLv}（阶段 ${stage}/3）</div>`);
    lines.push(`<div class="tip-line">主词缀：${affixText(it)}（匹配武器标签才生效）</div>`);
    for (let i = 0; i < ml.stageAffixes.length; i++) {
      const sa = ml.stageAffixes[i];
      const txt = sa.mode === "flat" ? `${sa.tag} +${sa.value}` : `${sa.tag} ${sa.value > 0 ? "+" : ""}${Math.round(sa.value * 100)}%`;
      lines.push(`<div class="tip-line ${i < stage ? "" : "dim"}">${i < stage ? "✔" : "🔒"} ${sa.name}：${txt}${i < stage ? "" : `（LV${(i + 1) * ml.perStage - ml.perStage + 1} 起）`}</div>`);
    }
    lines.push(`<div class="tip-line dim">对小队全体生效（按各成员武器标签过滤）· 相同模块拖拽合并升级</div>`);
    const syn = G.run && G.run.moduleSyn;
    if (syn) {
      if (syn.links > 0) lines.push(`<div class="tip-line">🔗 连接：${syn.links} 对相邻同品质（技能伤害 +${Math.round(syn.links * (CFG.moduleLevel.linkBonus || 0) * 100)}%）</div>`);
      lines.push(`<div class="tip-line ${syn.sets.length ? "" : "dim"}">套装：${syn.sets.length ? syn.sets.join("、") : "未触发（集齐同系列模块）"}</div>`);
    }
  }
  return lines.join("");
}

/* ============================================================
 * 主城 12 角立绘升级（独立区块 · 只由 renderCodex() 末尾一行调用接入）
 * ------------------------------------------------------------
 * 目标：把英雄图鉴从 56×56 小脸升级为「放大立绘 + 点击弹大图详情」。
 * 约定：
 *   - 不改动 renderCodex() 主体逻辑（仅末尾追加单行调用），避免并行开发冲突；
 *   - 立绘按素材原始宽高比绘制、不拉伸；DPR 自适应，仅按 CSS 尺寸绘制，不预生成大 canvas；
 *   - 未解锁沿用 Meta.skinUnlocked 语义（??? + 剪影置灰），详情层同步拦截；
 *   - 素材缺失走占位兜底（沿用现有 "?" / 灰块风格），不抛错；
 *   - 所有 DOM 访问判空，无 DOM 沙箱静默返回。
 * ============================================================ */

/* 立绘目标绘制高度（CSS 像素）：卡片 150、详情 360（竖屏可再放大到容器宽）。 */
const HERO_PORTRAIT_CARD_H = 150;
const HERO_PORTRAIT_DETAIL_H = 360;

/* 解析英雄立绘素材键：优先 spriteFor(h.id)（H001→hero / H002→hero01 …），
 * 其次回退 h.sprite（旧表统一写 "hero"）；找不到返回 null。 */
function heroPortraitKey(h) {
  if (!h) return null;
  let key = null;
  try { key = (typeof spriteFor === "function") ? spriteFor(h.id) : null; } catch (e) { key = null; }
  if (!key && h.sprite) key = h.sprite;
  return key || null;
}

/* 取立绘图像对象（Assets.images），素材缺失返回 null（调用方兜底）。 */
function heroPortraitImage(h) {
  const key = heroPortraitKey(h);
  if (!key || typeof Assets === "undefined" || !Assets.images) return null;
  return Assets.images[key] || null;
}

/* 立绘绘制：复用 Assets.fit（紧贴主体包围盒裁剪 + 缩放到目标高度），
 * 解决「512×512 原画布主体只占中间小块 → 整图缩放后立绘极小」的问题。
 * - locked=true 时画布铺透明底 + 主体染黑剪影（轮廓可见；舞台底色由 CSS 径向渐变透出）。
 *   20.7 修复：原实现先铺不透明底色再 source-in 染黑 → 整块变黑看不出剪影。
 * - key 为 ASSET_MANIFEST 键（hero/hero01…）；fit 依赖 DOM（createElement），
 *   桩环境/素材缺失 → 深底 + "?" 占位，绝不抛错。 */
function drawHeroPortrait(cv, key, locked, targetH) {
  if (!cv || !cv.getContext) return;
  const th = targetH || HERO_PORTRAIT_CARD_H;
  let c2 = null;
  try { c2 = cv.getContext("2d"); } catch (e) { return; }
  if (!c2) return;
  const W = cv.width, H = cv.height;
  try {
    c2.clearRect(0, 0, W, H);
    // fit：紧贴主体、高度 = th（含 64×64 代理包围盒扫描，单张 <1ms，仅打开图鉴时调用）
    let fitted = null;
    try {
      fitted = (key && typeof Assets !== "undefined" && Assets.fit) ? Assets.fit(key, th) : null;
    } catch (eFit) { fitted = null; }
    if (!fitted || !fitted.width || !fitted.height) {
      // 占位兜底：深底 + 居中 "?"（与旧图鉴占位风格一致）
      c2.fillStyle = locked ? "#131b28" : "#1d2a3d";
      c2.fillRect(0, 0, W, H);
      c2.fillStyle = "#5a6a80";
      c2.font = Math.round(Math.min(W, H) * 0.5) + "px sans-serif";
      c2.textAlign = "center";
      c2.textBaseline = "middle";
      c2.fillText("?", W / 2, H / 2);
      return;
    }
    // unlocked 铺深底提升对比；locked 保持透明（剪影+CSS 渐变底才有轮廓层次）
    if (!locked) { c2.fillStyle = "#1d2a3d"; c2.fillRect(0, 0, W, H); }
    // 等比绘制 fit 结果：不放大超过 fit 原尺寸（保清晰），水平居中 + 垂直居中
    const dw = Math.min(W, fitted.width);
    const dh = Math.min(H, Math.round(fitted.height * (dw / fitted.width)));
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    c2.drawImage(fitted, dx, dy, dw, dh);
    if (locked) {   // 剪影：保留 alpha 通道整体染黑（透明底 → 轮廓可见）
      c2.globalCompositeOperation = "source-in";
      c2.fillStyle = "#000";
      c2.fillRect(0, 0, W, H);
      c2.globalCompositeOperation = "source-over";
    }
  } catch (e) { /* 画布污染（file://）等降级：保留已画内容，不抛错 */ }
}

/* 图鉴英雄立绘渲染（renderCodex 末尾一行调用）：
 * 把 #codex-heroes 内的英雄卡重绘为「放大立绘 + 名称/定位/简介」，
 * 并绑定点击 → 打开详情层。未解锁仍为 ??? + 剪影 + locked 类。 */
UI.renderCodexHeroPortraits = function () {
  const doc = (typeof document !== "undefined") ? document : null;
  if (!doc || typeof doc.getElementById !== "function") return;   // 无 DOM 沙箱：静默
  const box = doc.getElementById("codex-heroes");
  if (!box) return;
  if (typeof CFG === "undefined" || !CFG.heroes) return;

  box.innerHTML = "";
  for (const h of CFG.heroes) {
    const unlocked = Meta.skinUnlocked(h.id);
    const img = heroPortraitImage(h);
    const role = UI.heroRole(h.id);
    const roleBadge = role
      ? `<span class="role-badge" style="color:${role.color};border-color:${role.color}">${role.name}</span>`
      : "";

    const card = doc.createElement("div");
    card.className = "codex-card portrait-card" + (unlocked ? "" : " locked");
    // 立绘画布：内部像素 = CSS 尺寸 × 2（DPR 折中，避免大 canvas 开销），CSS 缩回目标高度
    const cw = 120 * 2, ch = HERO_PORTRAIT_CARD_H * 2;
    card.innerHTML =
      `<div class="portrait-wrap">` +
      `<canvas class="codex-portrait" width="${cw}" height="${ch}" ` +
      `style="width:120px;height:${HERO_PORTRAIT_CARD_H}px"></canvas>` +
      (unlocked ? "" : `<span class="portrait-lock">🔒</span>`) +
      `</div>` +
      `<b>${unlocked ? h.name : "???"}${unlocked ? "" : ""}</b>` +
      `<div class="portrait-role">${unlocked ? roleBadge : ""}</div>` +
      `<small>${unlocked ? h.desc : "使用该英雄出征后激活"}</small>`;

    const cv = card.querySelector ? card.querySelector(".codex-portrait") : null;
    if (cv) drawHeroPortrait(cv, heroPortraitKey(h), !unlocked, HERO_PORTRAIT_CARD_H);   // 20.7：传键名，内部走 Assets.fit

    // 点击 → 详情层（未解锁也给详情，但详情内为剪影 + 解锁条件）
    card.onclick = () => { UI.openHeroDetail(h.id); };
    box.appendChild(card);
  }
};

/* 打开英雄详情层：放大立绘 + 完整属性 / 技能 / 武器说明。
 * 详情层 DOM 惰性创建并挂到 body（不写 index.html，避免越权改动）。 */
UI.openHeroDetail = function (heroId) {
  const doc = (typeof document !== "undefined") ? document : null;
  if (!doc || typeof doc.createElement !== "function") return null;
  const h = (typeof CFG !== "undefined" && CFG.heroes)
    ? CFG.heroes.find(x => x.id === heroId) : null;
  if (!h) return null;
  const unlocked = Meta.skinUnlocked(h.id);
  const img = heroPortraitImage(h);
  const role = UI.heroRole(h.id);

  const overlay = UI._getHeroDetailEl();
  if (!overlay) return null;

  const wpn = (CFG.weapons && CFG.weapons[h.weapon]) || { name: "—" };
  const skId = (wpn.skills && wpn.skills.skill) || null;
  const skLv = (typeof Meta.weaponLv === "function") ? Meta.weaponLv(h.id) : 1;
  const skLine = (skId && typeof UI._skillSummary === "function") ? UI._skillSummary(skId, skLv) : "—";
  const lv = (typeof Meta.heroLevel === "function") ? Meta.heroLevel(h.id) : 1;

  const roleBadge = role
    ? `<span class="role-badge" style="color:${role.color};border-color:${role.color}">${role.name}</span>`
    : "";
  const lockLine = unlocked ? "" : `<p class="lock-line">🔒 未解锁 · ${UI._unlockRuleText(h.id)}</p>`;

  const panel = overlay.querySelector ? overlay.querySelector(".hero-detail-panel") : null;
  if (panel) {
    const cw = 300 * 2, ch = HERO_PORTRAIT_DETAIL_H * 2;
    panel.innerHTML =
      `<button class="hero-detail-close" id="btn-hero-detail-close">✕</button>` +
      `<div class="hero-detail-portrait">` +
      `<canvas class="codex-portrait detail-portrait" width="${cw}" height="${ch}" ` +
      `style="width:300px;height:${HERO_PORTRAIT_DETAIL_H}px"></canvas>` +
      `</div>` +
      `<h3>${unlocked ? h.name : "???"} <small>${h.id}</small>${roleBadge}</h3>` +
      `<p class="hero-detail-desc">${unlocked ? h.desc : "使用该英雄出征后激活"}</p>` +
      `<div class="hero-detail-stats">` +
      `<span>HP ${h.hp}</span><span>攻击 ${h.atk}</span><span>防御 ${h.def}</span>` +
      `<span>移速 ${h.spd}</span><span>局外 LV${lv}</span></div>` +
      `<p class="hero-detail-line"><b>武器：</b>${wpn.name}</p>` +
      `<p class="hero-detail-line"><b>技能 LV${skLv}：</b>${skLine}</p>` + lockLine +
      `<button class="btn ghost hero-detail-back" id="btn-hero-detail-close2">关闭</button>`;
    // 立绘按详情高度绘制（等比、居中）
    const cv = panel.querySelector ? panel.querySelector(".detail-portrait") : null;
    if (cv) drawHeroPortrait(cv, heroPortraitKey(h), !unlocked, HERO_PORTRAIT_DETAIL_H);   // 20.7：传键名，内部走 Assets.fit
    // 关闭按钮（两种：右上 ✕ / 底部「关闭」）
    const c1 = panel.querySelector ? panel.querySelector(".hero-detail-close") : null;
    const c2 = panel.querySelector ? panel.querySelector(".hero-detail-back") : null;
    const close = () => UI.closeHeroDetail();
    if (c1) c1.onclick = close;
    if (c2) c2.onclick = close;
  }
  overlay.classList.remove("hidden");
  return overlay;
};

/* 关闭英雄详情层（幂等；无 DOM 沙箱静默）。 */
UI.closeHeroDetail = function () {
  const doc = (typeof document !== "undefined") ? document : null;
  if (!doc || typeof doc.getElementById !== "function") return;
  const overlay = doc.getElementById("hero-detail");
  if (overlay && overlay.classList) overlay.classList.add("hidden");
};

/* 惰性创建详情层容器（#hero-detail 遮罩 + .hero-detail-panel）：
 * 只在首次打开时创建并 append 到 body；点击遮罩空白处亦可关闭。 */
UI._getHeroDetailEl = function () {
  const doc = (typeof document !== "undefined") ? document : null;
  if (!doc || typeof doc.createElement !== "function") return null;
  let overlay = (typeof doc.getElementById === "function") ? doc.getElementById("hero-detail") : null;
  // 已就绪则直接复用
  if (overlay && overlay._heroDetailReady) return overlay;
  // 真实浏览器首次调用：index.html 无 #hero-detail → getElementById 返回 null，需自建
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay._id = "hero-detail";           // 桩环境 getElementById 依据 _id
    try { overlay.id = "hero-detail"; } catch (e0) { /* 真实 DOM 设 id */ }
  }
  const panel = doc.createElement("div");
  panel.className = "hero-detail-panel";
  overlay.className = "hero-detail-overlay hidden";
  overlay.appendChild(panel);
  overlay.onclick = (e) => {
    // 点遮罩空白（非面板内）关闭；桩下无 closest 时退化为不处理
    if (e && e.target && e.target.classList && e.target.classList.contains("hero-detail-overlay")) {
      UI.closeHeroDetail();
    }
  };
  overlay._heroDetailReady = true;
  // 真实 DOM / 桩环境：未挂载则 append 到 body，保证能被 getElementById 再次取回
  // （20.7 修复：新建对象 _parent 为 undefined，原 `=== null` 判断恒 false → 永不挂载 → 详情层打不开）
  if (!overlay._parent && doc.body && doc.body.appendChild) {
    try { doc.body.appendChild(overlay); } catch (e2) { /* 挂载失败忽略 */ }
  }
  return overlay;
};

/* ============================================================
 * 主城 12 角立绘升级区块结束
 * ============================================================ */

/* ============================================================
 * 20.10 工匠世界 · 竖屏单屏化 UI 布局常量（追加区块，末置）
 * ------------------------------------------------------------
 * 目的：工匠面板在 390×844 竖屏下单屏展示，不出现整面板滚动条。
 * 项目铁律：数值一律进 CFG —— 但 js/config.js 本轮有其他代理在改，
 *   故此处先落局部常量 CFG_ARTISAN_UI，【待合并进 CFG】后再收敛。
 * 约定：panelMaxVh 面板高度上限（dvh）、safePadBottom 底部安全区兜底、
 *   tabCount 页签数期望值、gap 各段间距、gridFits 单屏允许的格子边长上限。
 * ============================================================ */
var CFG_ARTISAN_UI = {
  tabCount: 2,          // 页签数（开宝箱 / 商店·工坊）——测试断言用，页面已无「抽卡牌」
  panelMaxVh: 100,      // 面板 max-height 以 dvh 计（calc(100dvh - 16px) 的 100 部分）
  panelMaxGapPx: 16,    // 面板 max-height 从视口减去的固定像素（上下各 8px 呼吸位）
  safePadBottomPx: 10,  // padding-bottom 下限：max(10px, env(safe-area-inset-bottom))
  tabFontPx: 11,        // 页签字号（苹果风小而美，原 14px）
  tabPadYPx: 6,         // 页签纵向内边距（原 10px）
  rowFontPx: 12,        // 服务行主文案字号（原 14px）
  rowPadYPx: 6,         // 服务行纵向内边距（原 10px）
  pendingSizePx: 42,    // 开箱结果方块边长（原 64px）
  radiusPx: 9,          // 小圆角（8~10px 区间）
  borderPx: 1           // 细边框（苹果风：1px）
};

/* ============================================================
 * ====== 21.6 赛季玩法（占位）—— 赛季大厅 UI ======
 * ------------------------------------------------------------
 * UI.showSeason()       渲染赛季大厅（等级/经验条/周任务/返回按钮）
 * UI.grantSeasonExp(n)  单行薄封装：调 SeasonState.addExp，面板开着时重渲染
 * 界面节点：index.html #screen-season（本期占位，99 关通关后开放入口）
 * ============================================================ */
UI.showSeason = function () {
  var ss = (typeof SeasonState !== "undefined") ? SeasonState : null;
  var cfg = (typeof SEASON_CFG !== "undefined") ? SEASON_CFG : { maxLv: 10, expBase: 1000, expStep: 200 };
  if (!ss) return;
  // 等级与经验条（L10 封顶：经验条拉满）
  var lvEl = document.getElementById("season-lv");
  if (lvEl) lvEl.textContent = "LV " + ss.seasonLv;
  var curNeed = (ss.seasonLv >= cfg.maxLv)
    ? (cfg.expBase + (cfg.maxLv - 1) * cfg.expStep)
    : (cfg.expBase + (ss.seasonLv - 1) * cfg.expStep);
  var pct = (ss.seasonLv >= cfg.maxLv) ? 100 : Math.min(100, Math.floor(ss.seasonExp / curNeed * 100));
  var barEl = document.getElementById("season-exp-bar");
  if (barEl) barEl.style.width = pct + "%";
  var txtEl = document.getElementById("season-exp-text");
  if (txtEl) txtEl.textContent = (ss.seasonLv >= cfg.maxLv)
    ? "已达封顶 LV " + cfg.maxLv
    : "经验 " + ss.seasonExp + " / " + curNeed;
  // 周任务列表（占位：只展示进度，不消费奖励）
  var tasksEl = document.getElementById("season-tasks");
  if (tasksEl) {
    var rows = ss.weeklies().map(function (t) {
      return '<span class="chip">' + t.name + "：" + t.progress + " / " + t.goal + (t.progress >= t.goal ? "（已完成）" : "") + "</span>";
    });
    tasksEl.innerHTML = rows.length ? rows.join("") : '<span class="chip">（本周暂无任务）</span>';
  }
  // 返回按钮（每次渲染重绑，幂等）
  var backEl = document.getElementById("btn-season-back");
  if (backEl) backEl.onclick = function () { UI.showScreen("screen-main"); };
  // 切屏进大厅
  UI.showScreen("screen-season");
};

/* 单行薄封装：外部（结算钩子 / 事件）只需一行发赛季经验；
 * 若赛季大厅面板正开着（无 hidden），重渲染保持数值新鲜。 */
UI.grantSeasonExp = function (n) {
  var ok = (typeof SeasonState !== "undefined") ? SeasonState.addExp(n) : false;
  var panel = document.getElementById("screen-season");
  if (panel && panel.classList && !panel.classList.contains("hidden")) UI.showSeason();
  return ok;
};

/* 21.6 赛季玩法 UI 区块结束 */

/* ============================================================================
 * ====== 21.15 无尽模式 UI（结算面板 + 首次规则说明）—— 独立区块（§5.45）======
 * ----------------------------------------------------------------------------
 * 本区块只负责界面：① 无尽死亡结算面板（到达波次 / 击杀数 / 获得结晶 + 两个按钮）
 * ② 首次进入的规则说明面板（知道了）。所有 DOM 读写均空值保护（无 DOM 桩环境安全）。
 * 数值/文案走 CFG.city.abyssPortal；结算明细复用 G.lastSettleReport + 现有 _crystalReportLine。
 * ========================================================================== */

/* ---------- 21.17 结算面板：三结局（撤离成功 / 超时 / 阵亡）----------
 * 判定权威顺序（先查代码对齐 🅑 数据链路）：
 *   ① settle.reason === "extract" 或 settle.extracted === true → 撤离成功（全收益，绿）
 *   ② settle.timedOut === true 或 settle.reason === "timeout"    → 时限耗尽（保留 30%，红）
 *   ③ 其余（含死亡）                                             → 深渊阵亡（保留 30%，红）
 * 数据来源：🅑 的 abyssExtractSettle(reason) 返回对象（含 reason/extracted/timedOut/
 *   wave/kills/crystals/bossKills/elapsed），经 UI.showEndlessSettle(settle) 传入。
 *   旧路径（死亡）走 showEndlessSettle() 无参 → settle() 返回体，无 reason 字段 → 归为「阵亡」。 */
UI._endlessSettleOutcome = function (settle) {
  settle = settle || {};
  if (settle.reason === "timeout" || settle.timedOut === true) return "timeout";
  if (settle.reason === "extract" || settle.extracted === true) return "extract";
  return "death";
};

/* 坚持时长格式化（秒 → MM:SS）：与 HUD 同口径；缺 HUD 模块时本地兜底。 */
UI._endlessFormatElapsed = function (sec) {
  if (typeof formatEndlessTime === "function") return formatEndlessTime(sec);
  var s = (typeof sec === "number" && isFinite(sec)) ? Math.floor(sec) : 0;
  if (s < 0) s = 0;
  var mm = Math.floor(s / 60), ss = s % 60;
  return (mm < 10 ? "0" + mm : "" + mm) + ":" + (ss < 10 ? "0" + ss : "" + ss);
};

UI.showEndlessSettle = function (settle) {
  // settle = { wave, kills, crystals, timedOut, bossKills, elapsed, reason, extracted }；缺字段按 0 兜底
  settle = settle || {};
  var wave = Number(settle.wave) || 0;
  var kills = Number(settle.kills) || 0;
  var crystals = Number(settle.crystals) || 0;
  var bossKills = Number(settle.bossKills) || 0;
  var elapsed = Number(settle.elapsed) || 0;
  var sc = (typeof CFG !== "undefined" && CFG.endless && CFG.endless.settle) || {};
  var outcome = this._endlessSettleOutcome(settle);
  var titleText = (outcome === "extract") ? (sc.extractTitle || "撤离成功")
    : (outcome === "timeout") ? (sc.timeoutTitle || "时限耗尽")
    : (sc.deathTitle || "深渊阵亡");
  var toneClass = (outcome === "extract") ? (sc.extractClass || "good") : (sc.failClass || "bad");

  var el = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("endless-settle-stats") : null;
  if (el) {
    el.innerHTML =
      '<span>到达波次 <b>' + wave + '</b></span>' +
      '<span>击杀数 <b>' + kills + '</b></span>' +
      '<span>坚持时长 <b>' + this._endlessFormatElapsed(elapsed) + '</b></span>' +
      '<span>BOSS 击杀 <b>' + bossKills + '</b></span>' +
      '<span>◆ 获得结晶 <b>+' + crystals + '</b></span>' +
      this._crystalReportLine();
  }
  /* 21.20 逐角色伤害/承伤明细（与战绩榜同口径；读当前运行时实体，失败静默跳过） */
  var teamBox = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("endless-settle-team") : null;
  if (teamBox) {
    var team = [];
    try {
      if (typeof G !== "undefined" && G && G.run) {
        var hd = G.heroDef || G.run.heroDef || {};
        if (G.player) team.push({ name: hd.name || "队长", dmg: G.player.dmgDealt || 0, taken: G.player.dmgTaken || 0 });
        var comps = Array.isArray(G.run.companions) ? G.run.companions : [];
        for (var ti = 0; ti < comps.length; ti++) {
          var tc = comps[ti];
          if (tc) team.push({ name: tc.name || ("队友" + (ti + 1)), dmg: tc.dmgDealt || 0, taken: tc.dmgTaken || 0 });
        }
      }
    } catch (e) { team = []; }
    if (team.length) {
      var tDmg = 0, tTaken = 0;
      for (var tj = 0; tj < team.length; tj++) { tDmg += team[tj].dmg; tTaken += team[tj].taken; }
      function _pct(v, tot) { return tot > 0 ? Math.round(v / tot * 100) : 0; }
      var rowsHtml = team.map(function (m, k) {
        return '<tr><td class="ard-name">' + (k === 0 ? "★ " : "") + m.name + '</td>' +
          '<td class="ard-num">' + m.dmg + '</td><td class="ard-pct">' + _pct(m.dmg, tDmg) + '%</td>' +
          '<td class="ard-num taken">' + m.taken + '</td></tr>';
      }).join("");
      teamBox.innerHTML =
        '<div class="es-team-title">队伍明细（伤害 / 占比 / 承伤）</div>' +
        '<table class="abyss-rec-detail"><thead><tr><th>角色</th><th>伤害</th><th>占比</th><th>承伤</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
        '<tfoot><tr><td>合计</td><td class="ard-num">' + tDmg + '</td><td></td><td class="ard-num taken">' + tTaken + '</td></tr></tfoot></table>';
      teamBox.classList.remove("hidden");
    } else {
      teamBox.innerHTML = "";
      teamBox.classList.add("hidden");
    }
  }
  var title = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("endless-settle-title") : null;
  if (title) {
    var c = (typeof CFG !== "undefined" && CFG.city && CFG.city.abyssPortal) || {};
    title.textContent = (c.settleTitle || "深渊结算") + " · " + titleText;
    // 三结局色调：撤离成功 = 绿（good）；超时/阵亡 = 红（bad）
    if (title.classList) {
      title.classList.remove("good", "bad");
      title.classList.add(toneClass);
    }
  }
  var scr = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("screen-endless-settle") : null;
  if (scr && scr.classList) scr.classList.remove("hidden");
  var hud = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("hud") : null;
  if (hud && hud.classList) hud.classList.add("hidden");
  return true;
};

UI.hideEndlessSettle = function () {
  var scr = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("screen-endless-settle") : null;
  if (scr && scr.classList) scr.classList.add("hidden");
  return true;
};

UI.showEndlessIntro = function () {
  /* 21.18 弹窗暂停（用户拍板「暂停游戏」）：面板显示期间复用 Game.paused 闸门 ——
   * 主循环据此跳过世界/玩家/同伴更新（怪物静止、不结算伤害），关闭后恢复。
   * 解决「首次进深渊边读说明边被围殴致死」。typeof 守卫兼容测试桩（无 Game 时静默）。 */
  if (typeof Game !== "undefined" && Game) Game.paused = true;
  var scr = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("screen-endless-intro") : null;
  if (scr && scr.classList) scr.classList.remove("hidden");
  var body = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("endless-intro-body") : null;
  if (body) {
    var c = (typeof CFG !== "undefined" && CFG.city && CFG.city.abyssPortal) || {};
    var e = (typeof CFG !== "undefined" && CFG.endless) || {};
    var mins = Math.round(((e.timeLimit !== undefined ? e.timeLimit : 600)) / 60);
    var pct = (typeof CFG !== "undefined" && CFG.outLevel && typeof CFG.outLevel.deathRatio === "number")
      ? Math.round(CFG.outLevel.deathRatio * 100) : 30;
    body.innerHTML =
      '<div class="tip-line">◆ 深渊之门 = <b>大秘境</b>：怪物<b>按时间驱动持续涌来</b>（到点就刷，清不完），越往后越密越强。</div>' +
      '<div class="tip-line">◆ 总时限 <b>' + mins + ' 分钟</b>倒计时，归零即<b>时限耗尽</b>——时间就是压力，别磨。</div>' +
      '<div class="tip-line">◆ 击杀 + 存活时间共同积累<b>推进量</b>，推进量到阈值便会刷出 <b>BOSS</b>（进度条可直观看到距离）。</div>' +
      '<div class="tip-line">◆ 打到<b>最终 BOSS</b> 会掉落<b>撤离点</b>：走进圈内<b>读条 3 秒</b>完成撤离，即带<b>全收益</b>离场。</div>' +
      '<div class="tip-line">◆ 未撤离就<b>超时 / 阵亡</b> = 失败结算，仅保留 <b>' + pct + '%</b> 结晶。</div>' +
      '<div class="tip-line">' + (c.desc || "进圈读条 2 秒 → 进入无尽深渊") + '</div>';
  }
  var hud = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("hud") : null;
  if (hud && hud.classList) hud.classList.add("hidden");
  return true;
};

UI.hideEndlessIntro = function () {
  var scr = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("screen-endless-intro") : null;
  if (scr && scr.classList) scr.classList.add("hidden");
  /* 21.18 解除弹窗暂停：与 showEndlessIntro 配对（面板关闭 → 世界恢复推进） */
  if (typeof Game !== "undefined" && Game) Game.paused = false;
  /* 26.x 修复（真机复现：深渊局内 DOM HUD 全部消失）：showEndlessIntro 把 #hud 加了 hidden，
   * 关闭说明页时必须成对摘掉 —— 否则顶部进度条 / LV·货币·经验 / 负重 / 背包 / 队伍技能栏
   * 整个战斗 HUD 不可见，只剩 canvas 绘制的左上信息区（主线不弹说明页故从未暴露）。 */
  var hud = (typeof document !== "undefined" && document.getElementById) ? document.getElementById("hud") : null;
  if (hud && hud.classList) hud.classList.remove("hidden");
  return true;
};

/* 21.15 无尽模式 UI 区块结束 */
