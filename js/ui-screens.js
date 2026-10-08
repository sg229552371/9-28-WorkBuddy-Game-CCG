/* ============================================================
 * ui-screens.js — UI 屏幕层：主城 HUD / NPC 面板 / 工匠 / 图鉴 / 设置 / TIPS / 背包 / 结算 / 死亡
 * ------------------------------------------------------------
 * 21.16 物理搬移（第二阶段）：ui.js 巨型对象字面量按行号切成两段，本文件承载后半段。
 * 手法：不改逻辑 / 不重命名 / 不重排 —— 把原 const UI = {...} 中的后半段方法原样
 *   移入 Object.assign(UI, {...})（方法体逐字不动），在 ui.js 定义 UI 之后加载合并。
 * 依赖方向：依赖全局 CFG / Meta / Assets / G 与 ui.js 定义的 UI 对象；
 *   ui-panels.js 依赖本文件所在 UI 对象（须在 ui.js 之后、ui-panels.js 之前加载）。
 * ============================================================ */
Object.assign(UI, {

  /* ---------- 首页（游戏主菜单） ---------- */
  updateHomeUser() {
    this.bindChipCodexEntry();
    const el = document.getElementById("home-user-line");
    if (!el || !Meta.data.profile) return;
    el.innerHTML = `<span class="hu-name">${Meta.profileName()}</span><span class="hu-title">「${Meta.titleName()}」</span><span class="hu-crystal">◆ ${Meta.data.crystals}</span>`;
  },

  /* ---------- 主城 HUD（左上角头像栏：点击打开角色档案） ---------- */
  _cityHudSig: "",
  updateCityHUD() {
    const bar = document.getElementById("city-avatar-bar");
    if (!bar || !Meta.data.profile) return;
    // 签名比对：数据没变不重写 DOM（每帧调用也零开销）
    const sig = [Meta.profileName(), Meta.skinId(), Meta.titleId(), Meta.data.crystals].join("|");
    if (sig === this._cityHudSig) return;
    this._cityHudSig = sig;
    const h = CFG.heroes.find(x => x.id === Meta.skinId()) || CFG.heroes[0];
    const img = Assets.images[h.sprite];
    bar.innerHTML = `<canvas id="avatar-face" width="44" height="44"></canvas>
      <div class="ab-info"><b>${Meta.profileName()}</b><small>「${Meta.titleName()}」</small></div>
      <div class="ab-crystal">◆ ${Meta.data.crystals}</div>`;
    const cv = bar.querySelector("#avatar-face");
    if (cv && cv.getContext && img) cv.getContext("2d").drawImage(img, 0, 0, 44, 44);
  },

  /* ---------- 主城 NPC 面板（进圈弹窗，离圈自动关闭） ---------- */
  NPC_PANELS: { outlevel: "panel-npc-outlevel", weapon: "panel-npc-weapon", profile: "panel-profile", codex: null, shop: null },
  openNpcPanel(npc) {
    if (npc.func === "shop") { this.toast("神秘商人：敬请期待（赛季玩法上线后开放）", "gold"); G.cityNpcOpen = null; return; }
    if (npc.func === "codex") { this.toast("图鉴也可从首页进入；这里打开英雄图鉴", ""); this.showCodex(); return; }
    const id = this.NPC_PANELS[npc.func];
    if (!id) return;
    const p = document.getElementById(id);
    if (!p) return;
    p.classList.remove("hidden");
    if (npc.func === "outlevel") this.renderTrainer();
    else if (npc.func === "weapon") this.renderSmith();
    else if (npc.func === "profile") this.renderProfile();
  },
  closeNpcPanels() {
    for (const id of Object.values(this.NPC_PANELS)) {
      if (!id) continue;
      const p = document.getElementById(id);
      if (p) p.classList.add("hidden");
    }
  },
  /* 强化导师：局外等级升级（局外成长从首页/主菜单收敛至此）
   * 方向3 解锁接入：① 只列**已解锁**英雄的升级卡；② 每卡加「下级增益预览」；
   * ③ 尾部「未解锁」分组显示条件，结晶型给「解锁 ◆N」按钮（Meta.unlockHero）。 */
  renderTrainer() {
    const box = document.getElementById("outlevel-list");
    if (!box) return;
    const cry = document.getElementById("npc-crystals");
    if (cry) cry.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b>`;
    box.innerHTML = "";
    for (const h of CFG.heroes) {
      if (!Meta.isHeroUnlocked(h.id)) continue;   // 未解锁英雄不出现（理由见交付报告：与武器匠同口径 + 避免误升级死资产）
      const lv = Meta.heroLevel(h.id);
      const lvMax = lv >= CFG.outLevel.maxLevel;
      const cost = Meta.levelUpCost(h.id);
      const can = !lvMax && Meta.data.crystals >= cost;
      const card = document.createElement("div");
      card.className = "meta-card";
      card.innerHTML = `
        <div class="meta-info"><b>${h.name}</b><p class="meta-desc">${h.desc}</p>${this._gainPreviewHTML(h)}</div>
        <div class="meta-lv">
          <span>局外等级 <b class="lvnum">LV ${lv}</b> / ${CFG.outLevel.maxLevel}${lvMax ? " · 已满级" : ""}</span>
          <button class="btn small up-lv" ${can ? "" : "disabled"}>${lvMax ? "已满级" : `升级 ◆${cost}`}</button>
        </div>`;
      const btn = card.querySelector(".up-lv");
      if (btn) btn.onclick = () => { this.metaUpgradeLevel(h.id); this.renderTrainer(); this._cityHudSig = ""; this.updateCityHUD(); };
      box.appendChild(card);
    }
    this._appendLockedGroup(box, "outlevel");
  },
  /* 下级增益预览（同源取数）：调 game.js 的 outLevelStats(def, lv) —— 与 applyOutLevel 出战属性同一函数，
   * 不手抄公式；增益 = outLevelStats(lv+1) − outLevelStats(lv)。已满级 / 无差分 → 提示文案。 */
  _gainPreviewHTML(h) {
    const lv = Meta.heroLevel(h.id);
    if (lv >= CFG.outLevel.maxLevel) return `<p class="gain-preview">已满级</p>`;
    const cur = outLevelStats(h, lv), next = outLevelStats(h, lv + 1);
    const dHp = next.hp - cur.hp, dAtk = next.atk - cur.atk, dDef = next.def - cur.def;
    if (dHp === 0 && dAtk === 0 && dDef === 0) return `<p class="gain-preview">下级无增益</p>`;
    return `<p class="gain-preview">下级 +HP ${dHp} / +攻击 ${dAtk} / +防御 ${dDef}</p>`;
  },
  /* 尾部「未解锁」分组（导师 / 武器匠共用）：列出未解锁英雄 + 条件短文案；
   * 结晶型给「解锁 ◆N」按钮（结晶不足 disabled），点击 → Meta.unlockHero → 成功 toast + 刷新面板。 */
  _appendLockedGroup(box, kind) {
    const locked = CFG.heroes.filter(h => !Meta.isHeroUnlocked(h.id));
    if (!locked.length) return;
    const title = document.createElement("div");
    title.className = "npc-group-title";
    title.textContent = `未解锁（${locked.length}）`;
    box.appendChild(title);
    for (const h of locked) {
      const card = document.createElement("div");
      card.className = "meta-card locked";
      const uc = this._unlockCost(h.id);
      let act = `<span class="lock-badge">🔒 暂未解锁</span>`;
      if (uc) {
        const enough = Meta.data.crystals >= uc.cost;
        act = `<button class="btn small unlock-hero" ${enough ? "" : "disabled"}>解锁 ◆${uc.cost}</button>`;
      }
      card.innerHTML = `
        <div class="meta-info"><b>${h.name}</b><p class="meta-desc">解锁条件：${this._unlockRuleText(h.id)}</p></div>
        <div class="meta-lv">${act}</div>`;
      const btn = card.querySelector(".unlock-hero");
      if (btn) btn.onclick = () => this._doUnlockHero(h.id, kind);
      box.appendChild(card);
    }
  },
  /* 结晶解锁流程（导师 / 武器匠共用）：调 Meta.unlockHero 主动解锁 → 成功 toast + 刷新面板（含主城 HUD 结晶数）。 */
  _doUnlockHero(id, kind) {
    const h = CFG.heroes.find(x => x.id === id) || { name: id };
    if (Meta.unlockHero(id)) {
      this.toast(`🎉 已解锁 ${h.name}！`, "gold");
    } else {
      this.toast("结晶不足", "bad");
    }
    if (kind === "weapon") this.renderSmith(); else this.renderTrainer();
    this._cityHudSig = ""; this.updateCityHUD();
  },
  /* 武器匠：武器 / 技能等级升级（解锁口径与导师一致：只列已解锁英雄） */
  renderSmith() {
    const box = document.getElementById("weapon-list");
    if (!box) return;
    const cry = document.getElementById("npc-crystals-weapon") || document.getElementById("npc-crystals");
    if (cry) cry.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b>`;
    box.innerHTML = "";
    for (const h of CFG.heroes) {
      if (!Meta.isHeroUnlocked(h.id)) continue;
      const wlv = Meta.weaponLv(h.id);
      const wMax = wlv >= CFG.weaponLevel.maxLv;
      const cost = Meta.weaponUpCost(h.id);
      const can = !wMax && Meta.data.crystals >= cost;
      const card = document.createElement("div");
      card.className = "meta-card";
      card.innerHTML = `
        <div class="meta-info"><b>${h.name}</b><p class="meta-desc">武器等级 = 技能等级（撤离后永久保留）</p></div>
        <div class="meta-lv">
          <span>武器 / 技能 <b class="lvnum">LV ${wlv}</b> / ${CFG.weaponLevel.maxLv}${wMax ? " · 已满级" : ""}</span>
          <button class="btn small up-wp" ${can ? "" : "disabled"}>${wMax ? "已满级" : `升级 ◆${cost}`}</button>
        </div>`;
      const btn = card.querySelector(".up-wp");
      if (btn) btn.onclick = () => { this.metaUpgradeWeapon(h.id); this.renderSmith(); this._cityHudSig = ""; this.updateCityHUD(); };
      box.appendChild(card);
    }
    this._appendLockedGroup(box, "weapon");
  },
  /* 形象师：更名 / 皮肤（图鉴激活解锁）/ 称号 */
  renderProfile() {
    const box = document.getElementById("profile-body");
    if (!box) return;
    const nameEl = document.getElementById("profile-name-input");
    if (nameEl && document.activeElement !== nameEl) nameEl.value = Meta.profileName();
    // 皮肤网格：解锁的可选用，未解锁显示解锁条件
    const skinBox = document.getElementById("skin-grid");
    skinBox.innerHTML = "";
    for (const h of CFG.heroes) {
      const unlocked = Meta.skinUnlocked(h.id);
      const tile = document.createElement("div");
      tile.className = "skin-tile" + (Meta.skinId() === h.id ? " selected" : "") + (unlocked ? "" : " locked");
      tile.innerHTML = `<b>${h.name}</b><small>${unlocked ? "已激活" : "图鉴未激活"}</small>`;
      if (unlocked) tile.onclick = () => { Meta.setSkin(h.id); this.renderProfile(); this._cityHudSig = ""; this.updateCityHUD(); };
      skinBox.appendChild(tile);
    }
    // 称号列表：成就解锁
    const titleBox = document.getElementById("title-list");
    titleBox.innerHTML = "";
    for (const t of CFG.profile.titles) {
      const ok = Meta.titleUnlocked(t);
      const row = document.createElement("div");
      row.className = "title-row" + (Meta.titleId() === t.id ? " selected" : "") + (ok ? "" : " locked");
      row.innerHTML = `<b>「${t.name}」</b><small>${ok ? t.desc : `🔒 ${t.desc}`}</small>`;
      if (ok) row.onclick = () => { Meta.setTitle(t.id); this.renderProfile(); this._cityHudSig = ""; this.updateCityHUD(); };
      titleBox.appendChild(row);
    }
  },
  /* 图鉴（首页入口 / 图鉴学者 NPC 共用） */
  showCodex() {
    this.renderCodex();
    // 返回按钮按打开来源动态化：主城进来 → 返回主城；首页进来 → 返回首页
    const back = document.getElementById("btn-codex-back");
    if (back) back.textContent = G.state === "city" ? "返回主城" : "返回首页";
    this.showScreen("screen-codex");
  },
  /* 图鉴（首页入口 / 图鉴学者 NPC 共用）。未激活条目：名字 ??? + 纯黑剪影；激活后恢复原色。 */
  drawCodexFace(cv, img, locked) {
    if (!cv || !cv.getContext || !img) return;
    try {
      const c2 = cv.getContext("2d");
      c2.clearRect(0, 0, cv.width, cv.height);
      c2.drawImage(img, 0, 0, cv.width, cv.height);
      if (locked) {   // 剪影：保留 alpha 通道整体染黑（source-in 合成）
        c2.globalCompositeOperation = "source-in";
        c2.fillStyle = "#000";
        c2.fillRect(0, 0, cv.width, cv.height);
        c2.globalCompositeOperation = "source-over";
      }
    } catch (e) { /* 画布被污染（file://）降级：保持已画内容 */ }
  },
  renderCodex() {
    const heroBox = document.getElementById("codex-heroes");
    if (heroBox) {
      heroBox.innerHTML = "";
      for (const h of CFG.heroes) {
        const unlocked = Meta.skinUnlocked(h.id);
        const card = document.createElement("div");
        card.className = "codex-card" + (unlocked ? "" : " locked");
        const img = Assets.images[h.sprite];
        card.innerHTML = `${img ? `<canvas class="codex-face" width="56" height="56"></canvas>` : ""}
          <b>${unlocked ? h.name : "???"}</b><small>${unlocked ? h.desc : "使用该英雄出征后激活"}</small>`;
        this.drawCodexFace(card.querySelector(".codex-face"), img, !unlocked);
        heroBox.appendChild(card);
      }
    }
    const monBox = document.getElementById("codex-monsters");
    if (monBox) {
      monBox.innerHTML = "";
      for (const id in CFG.monsters) {
        const m = CFG.monsters[id];
        const unlocked = !!Meta.data.codex.monsters[id];
        const card = document.createElement("div");
        card.className = "codex-card small" + (unlocked ? "" : " locked");
        const img = Assets.images[m.sprite];
        card.innerHTML = `${img ? `<canvas class="codex-face" width="44" height="44"></canvas>` : `<div class="codex-face" style="color:#5a6a80;text-align:center;line-height:44px">?</div>`}
          <b>${unlocked ? m.name : "???"}</b><small>${unlocked ? `${m.type === "boss" ? "BOSS" : "怪物"} · HP ${m.hp} · 攻 ${m.atk}` : "击杀后收录"}</small>`;
        this.drawCodexFace(card.querySelector(".codex-face"), img, !unlocked);
        monBox.appendChild(card);
      }
    }
    const cnt = document.getElementById("codex-count");
    if (cnt) {
      const hm = Object.keys(Meta.data.codex.heroes).length, mm = Object.keys(Meta.data.codex.monsters).length;
      /* 21.11：统计行扩展芯片收录（数据口径与 renderChipCodex 的 chipSeen 一致） */
      const seen = (typeof G !== "undefined" && G.meta && G.meta.chipSeen) ? G.meta.chipSeen : null;
      const C0 = CFG.chips || {};
      const chipTotal = (C0.valuePool || []).length + (C0.behaviorPool || []).length;
      let chipSeenN = 0;
      for (const def of [...(C0.valuePool || []), ...(C0.behaviorPool || [])]) if (seen && seen[def.id]) chipSeenN++;
      cnt.textContent = `英雄 ${hm}/${CFG.heroes.length} · 怪物 ${mm}/${Object.keys(CFG.monsters).length} · 芯片 ${chipSeenN}/${chipTotal}`;
    }
    /* 21.11：芯片分区并入图鉴页（首页「芯片图鉴」独立入口移除——芯片图鉴属于图鉴的一部分）。
     * 渲染口径与 renderChipCodex 逐位一致：chipSeen 已见解锁 + 数值蓝/行为紫品质染色。 */
    const chipBox = document.getElementById("codex-chips");
    if (chipBox) {
      chipBox.innerHTML = "";
      const seen = (typeof G !== "undefined" && G.meta && G.meta.chipSeen) ? G.meta.chipSeen : null;
      const C = CFG.chips || {};
      const behaviorIds = {};
      for (const d of (C.behaviorPool || [])) behaviorIds[d.id] = true;
      for (const def of [...(C.valuePool || []), ...(C.behaviorPool || [])]) {
        const unlocked = !!(seen && seen[def.id]);
        const card = document.createElement("div");
        card.className = "codex-card small chip-codex-card" + (unlocked ? "" : " locked");
        const q = unlocked ? (behaviorIds[def.id] ? CFG.itemQualities[2] : CFG.itemQualities[1]) : CFG.itemQualities[0];
        card.style.borderColor = q.color;
        card.innerHTML = `<b style="color:${unlocked ? q.color : "#6d7c94"}">${unlocked ? def.name : "？？？"}</b>
          <small>${unlocked ? (def.desc || chipEffectLine(def, 2)) : "在局内见过后解锁"}</small>`;
        chipBox.appendChild(card);
      }
    }
    this.renderCodexHeroPortraits();   // 主城 12 角立绘升级（独立区块追加，见文件末尾）
  },
  /* 芯片图鉴（19.7：只读展示）。列出 CFG.chips.valuePool + behaviorPool 全部芯片，按品质染色。
   * 「已见过」数据源 = G.meta && G.meta.chipSeen（战斗线稍后接入）；判空时全部按未解锁剪影渲染。 */
  showChipCodex() {
    this.renderChipCodex();
    this.showScreen("screen-chip-codex");
  },
  renderChipCodex() {
    const seen = (typeof G !== "undefined" && G.meta && G.meta.chipSeen) ? G.meta.chipSeen : null;
    const isSeen = (defId) => !!(seen && seen[defId]);
    const box1 = document.getElementById("chip-codex-value");
    const box2 = document.getElementById("chip-codex-behavior");
    const C = CFG.chips || {};
    const render = (box, pool) => {
      if (!box) return 0;
      box.innerHTML = "";
      let seenCount = 0;
      for (const def of (pool || [])) {
        const unlocked = isSeen(def.id);
        if (unlocked) seenCount++;
        const card = document.createElement("div");
        card.className = "codex-card small chip-codex-card" + (unlocked ? "" : " locked");
        // 品质染色：白/蓝 = 数值；紫/金 = 行为。未解锁用灰剪影。
        const q = unlocked
          ? (pool === C.behaviorPool ? CFG.itemQualities[2] : CFG.itemQualities[1])
          : CFG.itemQualities[0];
        card.style.borderColor = q.color;
        card.innerHTML = `<b style="color:${unlocked ? q.color : "#6d7c94"}">${unlocked ? def.name : "？？？"}</b>
          <small>${unlocked ? (def.desc || chipEffectLine(def, 2)) : "在局内见过后解锁"}</small>`;
        box.appendChild(card);
      }
      return seenCount;
    };
    const sv = render(box1, C.valuePool);
    const sb = render(box2, C.behaviorPool);
    const cnt = document.getElementById("chip-codex-count");
    if (cnt) {
      const total = ((C.valuePool || []).length + (C.behaviorPool || []).length);
      cnt.textContent = `已见 ${sv + sb}/${total}`;
    }
  },
  /* 首页芯片图鉴入口（21.11 移除独立入口——芯片分区已并入图鉴页 renderCodex）+ 返回按钮惰性绑定。 */
  bindChipCodexEntry() {
    const back = document.getElementById("btn-chip-codex-back");
    if (back && typeof back.onclick !== "function") back.onclick = () => { this.updateHomeUser(); this.showScreen("screen-main"); };
  },
  /* 模块槽浮窗的「点击外部关闭」（20.3 任务二）：document 级委托，只绑一次。
   * 判定：点击落点不在 #module-tip、也不在 .ps-slot 内 → 关闭。DOM 桩下 document 用 onclick 亦可。 */
  bindModuleTipDismiss() {
    if (this._mtDismissBound) return;
    this._mtDismissBound = true;
    const handler = (e) => {
      if (!this._moduleTipOpen) return;
      const t = (e && e.target) || null;
      // 落点是否在浮窗 / 槽位内（真实 DOM 用 closest；桩沿 _parent/parentElement 降级）
      let inTip = false, inSlot = false;
      if (t && typeof t.closest === "function") {
        inTip = !!t.closest("#module-tip, .module-tip");
        inSlot = !!t.closest(".ps-slot");
      } else {
        let el = t;
        while (el) {
          if (el.id === "module-tip" || (el.classList && el.classList.contains("module-tip"))) { inTip = true; break; }
          if (el.dataset && el.dataset.idx !== undefined) { inSlot = true; break; }
          el = el.parentElement || el._parent || null;
        }
      }
      if (!inTip && !inSlot) this.hideModuleTip();
    };
    // 沙箱 / 测试桩：document.addEventListener 可能是空函数 → 同时挂 document.onclick 兜底
    if (typeof document.addEventListener === "function") document.addEventListener("click", handler, true);
    const prev = document.onclick;
    document.onclick = (e) => { if (typeof prev === "function") prev(e); handler(e); };
  },
  /* 设置（音效音量 / 触屏控件缩放 / 桌面显示触屏控件 / 低画质 / 性能诊断） */
  renderSettings() {
    const s = G.settings, cfg = CFG.settings;
    const sfx = document.getElementById("set-sfx");
    if (sfx) sfx.value = s.sfxVolume;
    const joy = document.getElementById("set-joy");
    if (joy) joy.value = s.joyScale;
    const tgl = document.getElementById("set-touch");
    if (tgl) tgl.classList.toggle("on", !!s.showTouchOnDesktop);
    const lq = document.getElementById("set-lowq");   // 20.5 低画质开关状态同步
    if (lq) { lq.classList.toggle("on", !!s.lowQuality); lq.textContent = s.lowQuality ? "开" : "关"; }
    renderQualitySeg();   // 23.x 画质三档：选中态 + 自动降档提示（实现在 main.js 末尾独立区块）
    this.renderPerfDiag();
  },

  /* ---------- 20.5 性能诊断面板（设置页区块） ----------
   * 数据源：PerfGuard.snapshot()（main.js 帧护栏）+ Assets.progress（core.js，可能未落地→防御式）。
   * 全部字段判空，桩/接口缺失不崩；文本形式便于「复制诊断」。 */
  _perfDiagInfo() {
    const st = (typeof PerfGuard !== "undefined" && PerfGuard.snapshot) ? PerfGuard.snapshot() : null;
    // 素材进度：接口可能还不存在 → 「未知」；存在则真实数字
    let assets = "未知";
    try {
      if (typeof Assets !== "undefined" && Assets && Assets.progress) {
        const p = Assets.progress;
        const loaded = Number(p.loaded) || 0, total = Number(p.total) || 0;
        assets = total > 0 ? `${loaded}/${total}` + (p.done ? "（完成）" : "") : (p.done ? "完成" : "未知");
      }
    } catch (e) { assets = "未知"; }
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const vw = (typeof window !== "undefined" && window.innerWidth) || 0;
    const vh = (typeof window !== "undefined" && window.innerHeight) || 0;
    const portrait = vh >= vw;
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "未知";
    const fps = st && st.fps > 0 ? Math.round(st.fps) : 0;
    return {
      fps: fps,
      p50: st ? Math.round(st.p50) : 0,
      p95: st ? Math.round(st.p95) : 0,
      maxStuck: st ? st.maxStuckMs : 0,
      stuck: st ? st.stuck : 0,
      frames: st ? st.count : 0,
      alertCount: st ? st.alertCount : 0,
      assets: assets,
      dpr: dpr, vw: vw, vh: vh, portrait: portrait,
      ua: ua.length > 68 ? ua.slice(0, 68) + "…" : ua,
    };
  },
  renderPerfDiag() {
    const info = this._perfDiagInfo();
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set("perf-fps", info.frames > 0 ? `${info.fps} FPS（窗口 ${info.frames} 帧）` : "采样中…");
    set("perf-p50p95", `${info.p50}ms / ${info.p95}ms`);
    set("perf-maxstuck", `${info.maxStuck}ms`);
    set("perf-stuck", `${info.stuck} 帧${info.alertCount ? ` · 告警 ${info.alertCount} 次` : ""}`);
    set("perf-assets", info.assets);
    set("perf-dpr", String(info.dpr));
    set("perf-viewport", `${info.vw}×${info.vh}`);
    set("perf-orient", info.portrait ? "竖屏" : "横屏");
    set("perf-ua", info.ua);
  },
  /* 复制诊断信息：优先 clipboard，降级 textarea+select。桩环境不崩。 */
  copyPerfDiag() {
    const info = this._perfDiagInfo();
    const text = [
      "【性能诊断】" + new Date().toISOString(),
      `帧率: ${info.fps} FPS`,
      `帧耗时 p50/p95: ${info.p50}ms / ${info.p95}ms`,
      `最长卡死帧: ${info.maxStuck}ms`,
      `卡死帧计数(>80ms): ${info.stuck} 帧 · 告警 ${info.alertCount} 次`,
      `素材加载: ${info.assets}`,
      `设备像素比: ${info.dpr}`,
      `视口: ${info.vw}×${info.vh} (${info.portrait ? "竖屏" : "横屏"})`,
      `UA: ${info.ua}`,
    ].join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        this.toast("诊断信息已复制", "gold");
        return text;
      }
    } catch (e) { /* 降级 */ }
    try {   // 降级：临时 textarea + select + execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      if (document.execCommand) document.execCommand("copy");
      if (ta.remove) ta.remove();
      this.toast("诊断信息已复制（降级）", "gold");
    } catch (e) { this.toast("复制失败：请手动截图诊断面板", "bad"); }
    return text;
  },

  /* ---------- 物品 TIPS 浮窗（桌面悬停 / 移动端长按/点选；一个渲染函数全场景复用） ---------- */
  showTooltip(item, cx, cy) {
    const tp = document.getElementById("tooltip");
    if (!tp || !item) return;
    tp.innerHTML = itemTipHTML(item);
    tp.classList.remove("hidden");
    this.moveTooltip(cx, cy);
  },
  moveTooltip(cx, cy) {
    const tp = document.getElementById("tooltip");
    if (!tp || tp.classList.contains("hidden")) return;
    const pad = 12, w = tp.offsetWidth || 260, h = tp.offsetHeight || 200;
    let x = cx + pad, y = cy + pad;
    if (x + w > window.innerWidth - 8) x = cx - w - pad;     // 右缘翻转
    if (y + h > window.innerHeight - 8) y = cy - h - pad;    // 下缘翻转
    tp.style.left = Math.max(8, x) + "px";
    tp.style.top = Math.max(8, y) + "px";
  },
  hideTooltip() {
    const tp = document.getElementById("tooltip");
    if (tp) tp.classList.add("hidden");
  },

  /* ---------- 背包 / 武器栏面板 ---------- */
  managementLocked() {
    // 9.1.1：局内战斗进行中无法管理背包（工匠世界例外）
    return G.state === "playing" && !G.inArtisan && G.mainWorld && G.mainWorld.monsters.length > 0;
  },
  toggleBackpack(force) {
    if (G.inArtisan) return;   // 工匠模式：网格已在合并面板中，B 键不重复弹窗
    const p = document.getElementById("panel-backpack");
    if (!p) return;
    const show = force !== undefined ? force : p.classList.contains("hidden");
    if (show && (G.state === "playing" || G.state === "settled")) {
      p.classList.remove("hidden");
      this.renderBackpack();
    } else p.classList.add("hidden");
  },
  renderBackpack() {
    const r = G.run;
    document.getElementById("bp-lock-hint").classList.toggle("hidden", !this.managementLocked());
    this._renderGrid("grid-backpack", r.backpack);
    // 芯片背包（6×5）：数据源 G.run.chipInv（战斗线稍后接入）。缺失时渲染空格骨架，不报错。
    this._renderGrid("grid-chip", this._chipInv());
    // 武器模块槽（每英雄 4 格）：数据源 G.run.heroModules。缺失时渲染空槽骨架。
    this._renderModuleSlots();
    // 武器标签（跟随当前英雄武器；召唤物/陷阱类标签仅对声明该标签的技能生效）
    const tags = document.getElementById("weapon-tags");
    const wpnTags = (G.heroDef && CFG.weapons[G.heroDef.weapon]) ? CFG.weapons[G.heroDef.weapon].tags : CFG.weapons.W001.tags;
    tags.innerHTML = "武器标签：" + wpnTags.map(t => {
      const tcfg = CFG.affixTags[t];
      const v = tagCalc(t);
      const disp = tcfg.round === "floor" ? v : (v * 100).toFixed(0) + "%";
      return `<b>${t} ${disp}</b>`;
    }).join(" · ");
    // 选中物品信息
    this.renderItemInfo();
  },
  /* 芯片背包占位：优先 G.run.chipInv（真实 Inventory）；其次回退旧 G.run.weaponInv（战斗线过渡期）；
   * 两者都缺时按 CFG.chips.grid 造只读骨架（渲染空格不报错）。 */
  _chipInv() {
    const r = G.run;
    if (r && r.chipInv && r.chipInv.cols && r.chipInv.rows) return r.chipInv;
    if (r && r.weaponInv && r.weaponInv.cols && r.weaponInv.rows) return r.weaponInv;
    const g = (CFG.chips && CFG.chips.grid) || { cols: 6, rows: 5 };
    return { cols: g.cols, rows: g.rows, items: [] };
  },
  /* 武器模块槽：G.run.heroModules = { [heroId]: [{defId,lv} × 4] }；判空则渲染空槽骨架。 */
  _renderModuleSlots() {
    const box = document.getElementById("module-slots");
    if (!box) return;
    box.innerHTML = "";
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const perHero = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const heroId = (G.heroDef && G.heroDef.id) || (CFG.heroes[0] && CFG.heroes[0].id);
    const list = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
    for (let i = 0; i < perHero; i++) {
      const slot = list[i] || null;
      const el = document.createElement("div");
      el.className = "module-slot" + (slot ? " filled" : "");
      const name = slot ? (this._moduleName(slot.defId) || slot.defId) : "空槽";
      el.innerHTML = `<span class="ms-name${slot ? "" : " empty"}">${name}</span>` +
        (slot ? `<span class="ms-lv">LV ${slot.lv || 1} / ${maxLv}</span>` : "");
      box.appendChild(el);
    }
  },
  _moduleName(defId) {
    const d = (CFG.moduleDefs || []).find(m => m.id === defId);
    return d ? d.name : "";
  },
  _renderGrid(gridId, inv) {
    const g = document.getElementById(gridId);
    // 20.10：格子边长走 CSS 变量 --art-cell（竖屏工匠单屏化时缩到 30px；默认 46px）。
    // 拖拽命中测试 _dropTarget 同步读取同一变量，保证「缩格不断拖拽」。
    const cell = this._cellPx();
    g.style.gridTemplateColumns = `repeat(${inv.cols}, ${cell}px)`;
    g.style.gridTemplateRows = `repeat(${inv.rows}, ${cell}px)`;
    g.innerHTML = "";
    for (let i = 0; i < inv.cols * inv.rows; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.dataset.x = i % inv.cols; c.dataset.y = Math.floor(i / inv.cols);
      g.appendChild(c);
    }
    const pad = cell + 4;   // 格 + 间隙 4 = 步长（与 CSS .grid gap:4px 对齐）
    for (const it of inv.items) {
      const el = document.createElement("div");
      el.className = `itm q${it.kind === "chest" ? this._chestQIdx(it.chestQ) : it.itemQ}`;
      el.style.left = it.x * pad + 6 + "px"; el.style.top = it.y * pad + 6 + "px";   // +6 = grid padding（.itm 相对 padding box 定位）
      el.style.width = it.shape[0] * pad - 4 + "px"; el.style.height = it.shape[1] * pad - 4 + "px";
      el.innerHTML = `<span class="nm">${it.name}</span>` +
        (it.kind === "chest" || it.kind === "insurance" ? `<span class="ct">×${it.count}</span>`
          : (it.kind === "module" && (it.lv || 1) > 1 ? `<span class="ct">LV${it.lv}</span>` : ""));
      el.dataset.uid = it.uid;
      g.appendChild(el);
    }
  },
  /* 格子边长（px）：优先读工匠面板 .art-panel 上的 --art-cell，其次读 :root，
   * 都没有时回落 46。竖屏时 CSS 把 .art-panel 的 --art-cell 设为 30，
   * 从而「单屏塞下 6×5 芯片背包」，且拖拽命中测试 _dropTarget 同口径不失配。 */
  _cellPx() {
    const doc = (typeof document !== "undefined") ? document : null;
    if (!doc || typeof doc.getElementById !== "function") return 46;
    if (typeof getComputedStyle !== "function") return 46;
    const readVar = (el) => {
      if (!el) return 0;
      try { const n = parseFloat(getComputedStyle(el).getPropertyValue("--art-cell")); return n > 0 ? n : 0; }
      catch (e) { return 0; }
    };
    const panel = doc.querySelector ? doc.querySelector("#panel-artisan .art-panel") : null;
    return readVar(panel) || readVar(doc.documentElement) || 46;
  },
  _chestQIdx(q) { return { normal: 0, advanced: 1, epic: 2 }[q]; },
  renderItemInfo() {
    const box = document.getElementById("item-info");
    const it = this.hoverItem;
    if (!it) { box.innerHTML = "选中或点选物品查看详情"; return; }
    box.innerHTML = itemTipHTML(it);
    // 诅咒道具：使用按钮（仅主地图战斗中）
    if (it.kind === "curse") {
      const btn = document.createElement("button");
      btn.className = "btn small";
      btn.textContent = "☠ 使用诅咒道具";
      btn.onclick = () => { useCurseItem(it); this.renderBackpack(); this.renderItemInfo(); };
      box.appendChild(btn);
    }
  },

  /* ---------- 工匠合并界面：两页签（开宝箱 / 商店·工坊）+ 背包/武器栏 ----------
   * 20.10 重排（竖屏单屏化）：页签 4 → 2 ——
   *   ① 「抽卡牌」页签随属性卡牌系统整体废弃而移除（CFG.cardPool.removed，逻辑侧不再读取）；
   *      注意 renderCards 函数本体保留（避免其他引用炸），只是不再有页签入口。
   *   ② 「购买·服务」与「芯片工坊」合并为一页，id 复用 shop（减少改动面），
   *      页面内 #shop-list（购买·服务）+ #forge-list（芯片工坊）上下排列。 */
  ART_TABS: [
    { id: "chest", btn: "art-tab-chest", page: "art-page-chest" },
    { id: "shop",  btn: "art-tab-shop",  page: "art-page-shop"  },
  ],
  artTab: "chest",
  setArtisanTab(t) {
    if (!this.ART_TABS.some(x => x.id === t)) return;
    this.artTab = t;
    for (const tab of this.ART_TABS) {
      const btn = document.getElementById(tab.btn);
      const page = document.getElementById(tab.page);
      if (btn) btn.classList.toggle("active", tab.id === t);
      if (page) page.classList.toggle("hidden", tab.id !== t);
    }
    this.renderArtisan();
  },
  toggleArtisan(force) {
    const p = document.getElementById("panel-artisan");
    const unit = document.getElementById("bp-grid-unit");       // 背包/武器栏单元（含网格/信息/丢弃区）
    const home = document.getElementById("bp-panel-main");      // 背包面板（单元的家）
    const artGrids = document.getElementById("art-grids");      // 工匠面板停靠位
    if (!p || !unit || !home || !artGrids) return;
    const show = force !== undefined ? force : p.classList.contains("hidden");
    if (show && G.inArtisan) {
      artGrids.appendChild(unit);            // 整体移入工匠面板（DOM 移动保留渲染/拖拽逻辑）
      p.classList.remove("hidden");
      this.setArtisanTab(this.artTab || "chest");   // 回到上次页签（内部会调用 renderArtisan）
    } else {
      p.classList.add("hidden");
      home.appendChild(unit);                // 移回背包面板
    }
  },
  renderArtisan() {
    const r = G.run;
    if (!r) return;
    // 开宝箱页（待分配区 / 背包网格渲染与页签无关，始终刷新保证数据同步）
    if (this.artTab === "chest") this._renderChestList();
    // 商店·工坊合并页（20.10）：同一页内上下两块，均需渲染
    else if (this.artTab === "shop") { this._renderShopList(); this._renderForgeList(); }
    this._renderPendingArea();
    this.renderBackpack();   // 同步网格显示
  },
  /* 开箱结果（待分配区）：开宝箱页独占，任何页签下数据变化都同步 */
  _renderPendingArea() {
    const r = G.run;
    const pa = document.getElementById("pending-area");
    if (!pa) return;
    pa.innerHTML = "";
    for (const it of r.pendingItems) {
      const el = document.createElement("div");
      el.className = `pending-item q${it.itemQ}`;
      el.style.width = it.shape[0] * 32 + 30 + "px"; el.style.height = it.shape[1] * 32 + 30 + "px";
      el.innerHTML = `${it.name}<span class="giveup" title="放弃">✕</span>`;
      el.querySelector(".giveup").onclick = (e) => {
        e.stopPropagation();
        r.pendingItems.splice(r.pendingItems.indexOf(it), 1);
        this.toast("已放弃，物品作废", "bad");
        this.renderArtisan();
      };
      el.onpointerdown = (e) => this.startDrag(e, { item: it, fromPending: true });
      pa.appendChild(el);
    }
  },
  /* 页签①：开宝箱（宝箱列表 + 开启按钮 + 武器等级只读展示） */
  _renderChestList() {
    const r = G.run;
    const counts = {};
    for (const it of r.backpack.items) if (it.kind === "chest") counts[it.chestQ] = (counts[it.chestQ] || 0) + it.count;
    const list = document.getElementById("chest-list");
    if (!list) return;
    list.innerHTML = "";
    for (const q of Object.keys(CFG.chestQualities)) {
      const c = CFG.chestQualities[q];
      const row = document.createElement("div");
      row.className = "chest-row" + (this.selectedChestQ === q ? " selected" : "");
      row.innerHTML = `<div class="sw" style="background:${c.color}"></div>
        <b>${c.name}</b><small>持有 ${counts[q] || 0} · 价值 ${c.value}</small>`;
      row.onclick = () => { this.selectedChestQ = q; this.renderArtisan(); };
      list.appendChild(row);
    }
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = "开启 1 个";
    btn.disabled = !this.selectedChestQ || !(counts[this.selectedChestQ] > 0);
    btn.onclick = () => this.openChest();
    list.appendChild(btn);
    // 武器 / 技能等级：只读展示（升级入口已收敛到主城「武器匠」→ 消耗进化结晶）
    const wlv = Meta.weaponLv(G.heroDef.id);
    const wro = document.createElement("div");
    wro.className = "chest-row readonly";
    wro.style.marginTop = "8px";
    wro.innerHTML = `<div class="sw" style="background:#ffd76a"></div>
      <b>⚔ 武器 / 技能 LV${wlv}${wlv >= CFG.weaponLevel.maxLv ? "（满级）" : ""}</b>
      <small>主城「武器匠」消耗进化结晶升级</small>`;
    list.appendChild(wro);
  },
  /* 页签③：购买·服务（局内金币消费 + 选中物品强化/洗词缀） */
  _renderShopList() {
    const r = G.run;
    const list = document.getElementById("shop-list");
    if (!list) return;
    const hoverIt = this.hoverItem;
    const qName = (q) => CFG.itemQualities[q].name;
    let rows = [
      { key: "ins", html: `<div class="sw" style="background:#6cb2ff"></div><b>⛨ 购买保险契约 ×1</b><small>¥${CFG.artisanServices.buyInsurance.cost} · 死亡保护 1 件最高价值物品</small>` },
      { key: "chest:advanced", html: `<div class="sw" style="background:${CFG.chestQualities.advanced.color}"></div><b>▣ 购买高级宝箱</b><small>¥${CFG.artisanServices.buyChest.advanced}</small>` },
      { key: "chest:epic", html: `<div class="sw" style="background:${CFG.chestQualities.epic.color}"></div><b>▣ 购买史诗宝箱</b><small>¥${CFG.artisanServices.buyChest.epic}</small>` },
      { key: "chest:divine", html: `<div class="sw" style="background:${CFG.chestQualities.divine.color}"></div><b>▣ 购买神圣宝箱</b><small>¥${CFG.artisanServices.buyChest.divine}</small>` },
    ];
    // 购买武器模块 / 消耗品道具：消费 CFG.artisanServices，战斗侧 shopBuyModule / shopBuyItem 内部判金币、扣款、生成物品、处理背包满
    // 契约：返回 {ok, msg}；配置或全局函数缺失时该行不渲染（根目录 DOM 桩测试不含这些全局函数）
    const buyCfg = CFG.artisanServices;
    if (buyCfg.buyModule && typeof shopBuyModule === "function") {
      const cost = buyCfg.buyModule.cost;
      rows.push({ key: "module", shop: true, dim: r.coin < cost,
        html: `<div class="sw" style="background:#c79bff"></div><b>◈ 购买武器模块</b><small>¥${cost} · ${buyCfg.buyModule.desc}</small>` });
    }
    if (buyCfg.buyItem && typeof shopBuyItem === "function") {
      const cost = buyCfg.buyItem.cost;
      rows.push({ key: "item", shop: true, dim: r.coin < cost,
        html: `<div class="sw" style="background:#7de08a"></div><b>◈ 购买道具</b><small>¥${cost} · ${buyCfg.buyItem.desc}</small>` });
    }
    // 强化品质 / 洗词缀：需要先点选选中一件装备或武器模块（鼠标指针悬停或触屏点选均可）
    const it = hoverIt && (hoverIt.kind === "gear" || hoverIt.kind === "module") ? hoverIt : null;
    if (it && it.kind === "gear" || it && it.kind === "module") {
      const qupOk = it.itemQ < 3;
      const qupCost = qupOk ? CFG.artisanServices.qualityUp.costs[it.itemQ] : 0;
      rows.push({ key: "qup", html: `<div class="sw" style="background:${CFG.itemQualities[Math.min(it.itemQ + (qupOk ? 1 : 0), 3)].color}"></div>
        <b>✦ 强化品质：${it.name} ${qName(it.itemQ)} → ${qupOk ? qName(it.itemQ + 1) : "已满档"}</b>
        <small>${qupOk ? `¥${qupCost}` : "无法再强化"}</small>`, disabled: !qupOk });
      if (it.kind === "module") {
        rows.push({ key: "reroll", html: `<div class="sw" style="background:#c79bff"></div>
          <b>🜲 洗词缀：${it.name}（当前 ${affixText(it)}）</b><small>¥${CFG.artisanServices.rerollModule.cost} · 重掷主词缀档位</small>` });
      }
    } else {
      rows.push({ key: null, html: `<div class="sw" style="background:#5a6572"></div><b>✦ 强化品质 / 🜲 洗词缀</b><small>先在背包中点击选中装备/武器模块</small>` });
    }
    list.innerHTML = "";
    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "chest-row" + (row.dim ? " readonly" : "");
      el.innerHTML = row.html;
      if (row.key) {
        // 金币不足的购买行：置灰但保留点击（点击后由内部逻辑给出「金币不足」提示，与既有商店行一致）
        el.style.cursor = row.dim ? "not-allowed" : "pointer";
        if (row.dim) el.style.opacity = "0.55";
        el.onclick = () => (row.shop ? this.shopService(row.key) : this.artisanService(row.key));
      }
      list.appendChild(el);
    }
  },
  /* ---------- 芯片工坊（19.7）：服务列表读 CFG.chipForge.services，点击调 Game.chipForge(action) ----------
   * 契约：Game.chipForge(action) → {ok, msg}（战斗线稍后实现）；UI 侧负责判款显示、点击、toast。
   * 战斗侧未接入时（Game.chipForge 不存在）提示「功能未就绪」，不抛异常。 */
  _renderForgeList() {
    const list = document.getElementById("forge-list");
    if (!list) return;
    list.innerHTML = "";
    const svc = (CFG.chipForge && CFG.chipForge.services) || {};
    const r = G.run;
    const labels = { merge: "◈ 合成（升级）", reroll: "🜲 重铸词条", craft: "✦ 定向合成" };
    for (const key of Object.keys(svc)) {
      const s = svc[key];
      const row = document.createElement("div");
      const dim = r && r.coin < s.cost;
      row.className = "chest-row" + (dim ? " readonly" : "");
      row.innerHTML = `<div class="sw" style="background:#b06cff"></div>
        <b>${labels[key] || key}</b><small>¥${s.cost} · ${s.desc}</small>`;
      row.style.cursor = dim ? "not-allowed" : "pointer";
      if (dim) row.style.opacity = "0.55";
      row.onclick = () => this.chipForgeService(key);
      list.appendChild(row);
    }
  },
  chipForgeService(action) {
    const fn = typeof Game !== "undefined" && typeof Game.chipForge === "function" ? Game.chipForge : null;
    if (!fn) { this.toast("芯片工坊功能未就绪", "bad"); return; }
    let ret;
    try { ret = fn(action); }
    catch (e) { this.toast("芯片工坊操作失败（内部错误）", "bad"); return; }
    if (ret && ret.ok === false) this.toast(ret.msg || "操作失败", "bad");
    else this.toast((ret && ret.msg) || "操作成功", "gold");
    this.renderArtisan();
  },

  /* ---------- 属性卡牌（8.3：仅工匠世界可用） ---------- */
  _cardEffectText(c) {
    const def = CFG.cardPool.attrs[c.attr];
    if (def.mul) return `冷却 ×${c.value}`;
    if (c.attr === "lifesteal") return `吸血 +${Math.round(c.value * 100)}%`;
    return `${def.name} +${c.value}`;
  },
  renderCards() {
    const r = G.run;
    const assetsEl = document.getElementById("card-assets");
    if (assetsEl) assetsEl.textContent = `×${r.cardAssets}`;
    // 刷新按钮三态：① 免费次数 > 0 →「免费剩 n」可点；② 免费耗尽 →「¥cost」；③ 金币不足 → 置灰禁用
    // 点击行为由 js/main.js 的 btn-card-refresh 绑定统一处理（refreshCards 内部判款并在失败时 toast），此处只负责文案/可用态
    const btn = document.getElementById("btn-card-refresh");
    if (btn) {
      const cost = (CFG.cardPool && CFG.cardPool.refreshCost) || 0;
      if (r.cardRefresh > 0) {
        btn.textContent = `刷新候选（免费剩 ${r.cardRefresh}）`;
        btn.disabled = false;
      } else {
        btn.textContent = `刷新候选（¥${cost}）`;
        btn.disabled = r.coin < cost;
      }
    }
    if (!r.cardCandidates) r.cardCandidates = drawCardCandidates();
    const box = document.getElementById("card-candidates");
    if (box) {
      box.innerHTML = "";
      r.cardCandidates.forEach((c, i) => {
        const q = CFG.itemQualities[c.q];
        const tile = document.createElement("div");
        tile.className = "card-tile" + (r.cardAssets <= 0 ? " disabled" : "");
        tile.style.borderColor = q.color;
        tile.innerHTML = `<b style="color:${q.color}">${CFG.cardPool.attrs[c.attr].name}</b>
          <span class="cq">${q.name}卡</span><span class="cv">${this._cardEffectText(c)}</span>`;
        tile.onclick = () => {
          if (r.cardAssets <= 0) { this.toast("没有可用的属性卡牌（升级获得）", "bad"); return; }
          if (useCard(i)) { this.toast(`属性卡牌生效（小队全体）：${this._cardEffectText(r.appliedCards[r.appliedCards.length - 1])}`, "gold"); }
          this.renderCards();
        };
        box.appendChild(tile);
      });
    }
    // 已使用卡牌一览
    const ap = document.getElementById("card-applied");
    if (ap) ap.innerHTML = r.appliedCards.length
      ? r.appliedCards.map(c => `<span class="chip"><em>${CFG.cardPool.attrs[c.attr].name}</em> ${this._cardEffectText(c)}</span>`).join("")
      : `<span class="chip" style="opacity:.5">本局尚未使用卡牌</span>`;
  },
  openChest() {
    const r = G.run;
    if (!this.selectedChestQ) return;
    // 兜底校验：该品质宝箱已用尽则不开启
    if (!r.backpack.items.some(it => it.kind === "chest" && it.chestQ === this.selectedChestQ)) return;
    if (r.stats) r.stats.chestsOpened++;
    // 从背包扣除 1 个
    for (const it of r.backpack.items) {
      if (it.kind === "chest" && it.chestQ === this.selectedChestQ) {
        it.count--; it.value = CFG.chestQualities[it.chestQ].value * it.count;
        if (it.count <= 0) r.backpack.remove(it);
        break;
      }
    }
    // 开箱：保险契约概率掉出（方案 A）→ 诅咒道具概率掉出（待细化36）→ 内容池抽取
    let item;
    if (Math.random() < CFG.insurance.chance) {
      item = makeInsurance();
      // 入包（保险先叠加未满堆叠；放不下进待分配区）
      grantItemToRun(r, item);
      SFX.play("chest");
      this.toast(`开出【${CFG.insurance.name}】×1（死亡时保护 1 件高价值物品）`, "gold");
      this.renderArtisan();
      return;
    }
    if (Math.random() < CFG.curseItems.chance) {
      item = makeCurse();
      const s = r.backpack.findSpot(item);
      if (s) r.backpack.place(item, s.x, s.y);
      else r.pendingItems.push(item);
      SFX.play("chest");
      this.toast(`开出【${item.name}】☠ 主地图战斗中使用：强化敌人换取掉落翻倍`, "gold");
      this.renderArtisan();
      return;
    }
    // 芯片额外掉落（19.11.3）：与装备/消耗品并列、不互斥；获得即入 chipInv（满则 pendingItems）
    if (G.run && G.run.chipInv) {
      const chip = rollChestChip();
      if (chip) {
        const placed = grantChipToRun(r, chip);
        SFX.play("chest");
        this.toast(`开出芯片【${chip.name}】${CFG.itemQualities[chip.q].name}${placed ? "" : "（芯片背包已满，已放入待分配区）"}`, "gold");
        this.renderArtisan();
        return;
      }
    }
    const pool = CFG.chestContents[this.selectedChestQ];
    const defId = U.pick(pool.defs);
    const itemQ = Number(U.weightedPick({ 0: pool.itemQW[0], 1: pool.itemQW[1], 2: pool.itemQW[2], 3: pool.itemQW[3] }));
    const isModule = defId.startsWith("M");
    item = isModule ? makeModule(defId, itemQ) : makeGear(defId, itemQ);
    r.pendingItems.push(item);
    SFX.play("chest");
    this.toast(`开出【${item.name}】${CFG.itemQualities[itemQ].name}`, "gold");
    this.renderArtisan();
  },

  /* ---------- 工匠金币服务（待细化 28：强化物品/购买，价格全在 CFG.artisanServices） ---------- */
  artisanService(key) {
    const r = G.run, S = CFG.artisanServices;
    const pay = (cost) => {
      if (r.coin < cost) { this.toast(`金币不足（需 ¥${cost}）`, "bad"); return false; }
      r.coin -= cost;
      return true;
    };
    if (key === "ins") {
      if (!pay(S.buyInsurance.cost)) return;
      const item = makeInsurance();
      grantItemToRun(r, item);   // 保险先叠加未满堆叠；放不下进待分配区
      SFX.play("chest");
      this.toast(`购买【${CFG.insurance.name}】×1`, "gold");
    } else if (key.startsWith("chest:")) {
      const q = key.split(":")[1];
      if (!pay(S.buyChest[q])) return;
      const item = makeChestItem(q);
      grantItemToRun(r, item);   // 宝箱按品质叠加；放不下进待分配区
      SFX.play("chest");
      this.toast(`购买 ${item.name} ×1`, "gold");
    } else if (key === "qup") {
      const it = this.hoverItem;
      if (!it || (it.kind !== "gear" && it.kind !== "module")) { this.toast("请先点选一件装备/武器模块", "bad"); return; }
      if (it.itemQ >= 3) { this.toast("已达金色品质", "bad"); return; }
      const cost = S.qualityUp.costs[it.itemQ];
      if (!pay(cost)) return;
      it.itemQ++;
      const q = CFG.itemQualities[it.itemQ];
      if (it.kind === "gear") {
        it.value = Math.round(30 * q.valueMul);
        const def = CFG.gearDefs.find(g => g.id === it.defId);
        const mul = 1 + (q.valueMul - 1) * 0.6;   // 与 makeGear 同步：装备数值随品质成长
        for (const k in def.stats) it.stats[k] = Math.round(def.stats[k] * mul);
      } else {
        it.value = Math.round(45 * q.valueMul);
        it.affix.value = CFG.moduleDefs.find(m => m.id === it.defId).affix.vals[it.itemQ];
      }
      recomputeWeapon();
      SFX.play("levelup");
      this.toast(`✦ ${it.name} 强化至 ${CFG.itemQualities[it.itemQ].name}品质`, "gold");
    } else if (key === "reroll") {
      const it = this.hoverItem;
      if (!it || it.kind !== "module") { this.toast("请先点选一件武器模块", "bad"); return; }
      if (!pay(S.rerollModule.cost)) return;
      const old = affixText(it);
      it.itemQ = U.randInt(0, 3);   // 重掷主词缀档位（保留等级/类型/形状）
      it.affix.value = CFG.moduleDefs.find(m => m.id === it.defId).affix.vals[it.itemQ];
      recomputeWeapon();
      SFX.play("altar");
      this.toast(`🜲 ${it.name} 洗词缀：${old} → ${affixText(it)}`, "gold");
    }
    this.renderArtisan();
  },
  // 购买武器武器模块 / 消耗品道具：调用战斗侧全局函数（内部已判金币、扣款、生成物品、处理背包满）
  // 契约：返回 {ok, msg}；返回 undefined 视为成功（向后兼容）
  shopService(key) {
    const fn = key === "module"
      ? (typeof shopBuyModule === "function" ? shopBuyModule : null)
      : (typeof shopBuyItem === "function" ? shopBuyItem : null);
    if (!fn) { this.toast("功能未就绪", "bad"); return; }
    let ret;
    try { ret = fn(); }
    catch (e) { this.toast("购买失败（内部错误）", "bad"); return; }
    if (ret && ret.ok === false) this.toast(ret.msg || "购买失败", "bad");
    else this.toast((ret && ret.msg) || "购买成功", "gold");
    this.renderArtisan();
  },

  /* ---------- 拖拽（背包 <-> 武器栏 / 丢弃 / 待分配区） ---------- */
  startDrag(e, info) {
    if (this.managementLocked() && !info.fromPending) { this.toast("战斗进行中无法管理物品", "bad"); return; }
    if (this.managementLocked() && info.fromPending) { this.toast("战斗进行中无法操作", "bad"); return; }
    e.preventDefault();
    this.drag = info;
    const ghost = document.getElementById("drag-ghost");
    const it = info.item;
    ghost.classList.remove("hidden");
    ghost.style.width = it.shape[0] * 46 + "px"; ghost.style.height = it.shape[1] * 46 + "px";
    ghost.className = `q${it.kind === "chest" ? this._chestQIdx(it.chestQ) : it.itemQ}`;
    ghost.style.position = "fixed";
    ghost.style.left = e.clientX - it.shape[0] * 23 + "px";
    ghost.style.top = e.clientY - it.shape[1] * 23 + "px";
    ghost.textContent = it.name;
  },
  onPointerMove(e) {
    if (!this.drag) return;
    const ghost = document.getElementById("drag-ghost");
    const it = this.drag.item;
    ghost.style.left = e.clientX - it.shape[0] * 23 + "px";
    ghost.style.top = e.clientY - it.shape[1] * 23 + "px";
    // 高亮目标格
    document.querySelectorAll(".cell.hl-ok,.cell.hl-bad").forEach(c => c.classList.remove("hl-ok", "hl-bad"));
    document.getElementById("drop-zone").classList.remove("over");
    const t = this._dropTarget(e);
    if (t && t.type === "grid") {
      const ok = t.inv.canPlace(it, t.x, t.y, it);
      for (let j = t.y; j < t.y + it.shape[1]; j++) for (let i = t.x; i < t.x + it.shape[0]; i++) {
        const cell = t.inv === G.run.backpack
          ? document.querySelector(`#grid-backpack .cell[data-x="${i}"][data-y="${j}"]`)
          : document.querySelector(`#grid-chip .cell[data-x="${i}"][data-y="${j}"],#grid-weapon .cell[data-x="${i}"][data-y="${j}"]`);
        if (cell) cell.classList.add(ok ? "hl-ok" : "hl-bad");
      }
    } else if (t && t.type === "drop") {
      document.getElementById("drop-zone").classList.add("over");
    }
  },
  onPointerUp(e) {
    if (!this.drag) return;
    const it = this.drag.item;
    const r = G.run;
    document.querySelectorAll(".cell.hl-ok,.cell.hl-bad").forEach(c => c.classList.remove("hl-ok", "hl-bad"));
    document.getElementById("drop-zone").classList.remove("over");
    document.getElementById("drag-ghost").classList.add("hidden");
    const t = this._dropTarget(e);
    if (t && t.type === "grid") {
      if (this.drag.fromPending) {
        // 待分配区 → 网格
        r.pendingItems.splice(r.pendingItems.indexOf(it), 1);
        const occ = t.inv.occupied(t.x, t.y, it.shape[0], it.shape[1]);
        if (occ && it.kind === "module" && occ.kind === "module" && occ.defId === it.defId) {
          // 相同武器模块叠加 → 升级（背包/武器栏均可合并）
          const ml = CFG.moduleLevel;
          if ((occ.lv || 1) >= ml.maxLv) { r.pendingItems.push(it); this.toast("武器模块已达最高等级", "bad"); }
          else { occ.lv = Math.min(ml.maxLv, Math.max(occ.lv || 1, it.lv || 1) + 1); this.toast(`${occ.name} 合并升级 → LV${occ.lv}`, "gold"); }
        }
        else if (t.inv.canPlace(it, t.x, t.y)) t.inv.place(it, t.x, t.y);
        else {
          const s = t.inv.findSpot(it);
          if (s) t.inv.place(it, s.x, s.y);
          else { r.pendingItems.push(it); this.toast("空间不足", "bad"); }
        }
      } else {
        const srcInv = this._srcInv(it);
        const sameSpot = t.inv === srcInv && t.x === it.x && t.y === it.y;
        if (!sameSpot) {
          // ignore=it：目标区域允许与拖拽物品自身 footprint 重叠（同格内挪动）
          const occupant = t.inv.occupied(t.x, t.y, it.shape[0], it.shape[1], it);
          const ox = it.x, oy = it.y;   // 先记录原位（place 会覆写 x/y）
          if (occupant && it.kind === "module" && occupant.kind === "module" && occupant.defId === it.defId) {
            // 武器模块合并升级：相同武器模块叠加 → 等级 +1（上限 maxLv），被合并方消失
            const ml = CFG.moduleLevel;
            if ((occupant.lv || 1) >= ml.maxLv) this.toast("武器模块已达最高等级", "bad");
            else {
              occupant.lv = Math.min(ml.maxLv, Math.max(occupant.lv || 1, it.lv || 1) + 1);
              srcInv.remove(it);
              this.toast(`${occupant.name} 合并升级 → LV${occupant.lv}`, "gold");
            }
          } else if (occupant) {
            // 交换（9.1.1 替换规则）：被换下的物品回到拖拽物品腾出的原位
            srcInv.remove(it);
            t.inv.remove(occupant);
            if (t.inv.canPlace(it, t.x, t.y)) {
              t.inv.place(it, t.x, t.y);
              const s = srcInv.canPlace(occupant, ox, oy) ? { x: ox, y: oy } : srcInv.findSpot(occupant);
              if (s) srcInv.place(occupant, s.x, s.y);
              else {
                const s2 = t.inv.findSpot(occupant);
                if (s2) t.inv.place(occupant, s2.x, s2.y);
                else { r.pendingItems.push(occupant); this.toast("原位置物品移入待分配区（工匠世界）", ""); }
              }
            } else {
              t.inv.place(occupant, occupant.x, occupant.y);   // 还原
              const s = srcInv.findSpot(it);
              if (s) srcInv.place(it, s.x, s.y);
              else { r.pendingItems.push(it); this.toast("空间不足", "bad"); }
            }
          } else {
            srcInv.remove(it);
            if (t.inv.canPlace(it, t.x, t.y)) {
              t.inv.place(it, t.x, t.y);
            } else {
              const s = t.inv.findSpot(it);
              if (s) t.inv.place(it, s.x, s.y);
              else {
                const s2 = srcInv.findSpot(it);
                if (s2) srcInv.place(it, s2.x, s2.y);
                else r.pendingItems.push(it);
                this.toast("空间不足", "bad");
              }
            }
          }
        }
      }
    } else if (t && t.type === "drop" && !this.drag.fromPending) {
      // 丢弃：移出背包（9.1.1；原型直接销毁，不生成地上掉落物）
      const srcInv = this._srcInv(it);
      srcInv.remove(it);
      this.toast(`已丢弃 ${it.name}`, "bad");
    }
    this.drag = null;
    recomputeWeapon();
    this.renderBackpack();
    if (G.inArtisan) this.renderArtisan();   // 仅工匠世界刷新开箱台/卡牌区
  },
  /* 拖拽源背包解析：backpack → r.backpack；inv==="weapon"（旧武器栏物品）→ r.weaponInv；
   * 其余（芯片）→ 芯片背包（G.run.chipInv 存在用真身，否则骨架）。 */
  _srcInv(it) {
    const r = G.run;
    if (it && it.inv === "backpack") return r.backpack;
    if (it && it.inv === "weapon" && r.weaponInv) return r.weaponInv;   // 旧武器栏（兼容期）
    return this._chipInv();
  },
  _dropTarget(e) {
    const pts = [document.elementFromPoint(e.clientX, e.clientY)];
    const el = pts[0];
    if (!el) return null;
    const gridEl = el.closest("#grid-backpack,#grid-chip,#grid-weapon");
    if (gridEl) {
      // #grid-weapon 为旧武器栏别名（backpack_test 兼容期）→ 显式映射 weaponInv；
      // #grid-chip / #grid-backpack 走各自容器（芯片背包真身 / 搜刮背包）
      const inv = gridEl.id === "grid-backpack" ? G.run.backpack
        : (gridEl.id === "grid-weapon" && G.run.weaponInv) ? G.run.weaponInv
        : this._chipInv();
      const rect = gridEl.getBoundingClientRect();
      const cell = this._cellPx() + 4;   // 步长 = 格宽 + 间隙 4（与 _renderGrid、CSS .grid gap:4px 同口径）
      // 内边距 = 网格边框宽 + padding 6（竖屏工匠把边框 2 → 1，动态读取避免 1px 级偏移累积）
      let bb = 2;
      try { if (typeof getComputedStyle === "function") bb = parseFloat(getComputedStyle(gridEl).borderLeftWidth) || 2; } catch (e) { /* 桩环境回落 */ }
      const pad = bb + 6;
      const x = U.clamp(Math.floor((e.clientX - rect.left - pad) / cell), 0, inv.cols - 1);
      const y = U.clamp(Math.floor((e.clientY - rect.top - pad) / cell), 0, inv.rows - 1);
      return { type: "grid", inv, x, y };
    }
    if (el.closest("#drop-zone")) return { type: "drop" };
    return null;
  },

  /* ---------- 结算 ---------- */
  showSettlement(crystals = 0) {
    const r = G.run;
    const cv = r.settleConv || { chest: 0, gear: 0, item: 0, card: 0, total: 0 };
    document.getElementById("settle-stats").innerHTML =
      `<span>击杀 <b>${r.kills}</b></span><span>达到等级 <b>LV ${r.lv}</b></span><span>货币 <b>${r.coin}</b></span><span>◆ 结晶 <b>+${crystals}</b></span>` +
      this._crystalReportLine() +
      `<span style="flex-basis:100%;opacity:.85">资源折算（统一口径 价值×${CFG.settleConvert.valueRate}）：宝箱→◆${cv.chest} · 装备/武器模块→◆${cv.gear} · 道具→◆${cv.item}（合计 ◆${cv.total}）</span>`;
    document.getElementById("settle-chests").innerHTML =
      `<div class="chip">${this._statsLine(r)}</div><div class="chip">背包内物品不作为物品带出，按各自固定价值统一折算为结晶（双层等级体系闭环）；局内经验与金币归零、不折算</div>`;
    const items = [...(r.weaponInv ? r.weaponInv.items : []), ...r.backpack.items];
    document.getElementById("settle-items").innerHTML = items.length
      ? items.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}（${it.kind === "chest" ? "宝箱" : CFG.itemQualities[it.itemQ].name}）</span>`).join("")
      : `<span class="chip">（无装备/武器模块保留）</span>`;
    document.getElementById("screen-settle").classList.remove("hidden");
    if (typeof SeasonState !== "undefined") SeasonState.addExp(500);   // 21.6 赛季钩子：撤离成功发赛季经验 +500（占位，待迁 CFG）
  },
  /* 结晶获取明细行（20.10 产出可见化）：读 G.lastSettleReport（game.js publishCrystalReport 写入），
   * 把 lines 逐行拼成带换行的说明；无报告（老存档/异常路径）返回空串，不报错、不占位。 */
  _crystalReportLine() {
    const rep = G.lastSettleReport;
    if (!rep || !Array.isArray(rep.lines) || !rep.lines.length) return "";
    const body = rep.lines.slice(0, -1).join(" · ");
    const total = rep.lines[rep.lines.length - 1];
    return `<span style="flex-basis:100%;color:#ffd76a">结晶获取：${body}　<b>${total}</b></span>`;
  },
  _statsLine(r) {
    const s = r.stats || {};
    const mm = Math.floor((r.runTime || 0) / 60), ss = Math.round((r.runTime || 0) % 60);
    const kpm = r.runTime > 0 ? (r.kills / (r.runTime / 60)).toFixed(1) : "0";
    return `用时 ${mm}:${ss < 10 ? "0" + ss : ss} · 击杀/分 ${kpm} · 输出 ${Math.round(s.dmgDealt || 0)} · 承伤 ${Math.round(s.dmgTaken || 0)} · Boss 耗时 ${(s.bossFightTime || 0).toFixed(0)}s · 开箱 ${s.chestsOpened || 0} · 雕像 ${s.altarsUsed || 0}`;
  },
  showDeath(penalty, crystals = 0) {
    const r = G.run;
    document.getElementById("death-stats").innerHTML =
      `<span>击杀 <b>${r.kills}</b></span><span>等级 <b>LV ${r.lv}</b></span><span>损失价值 <b>${Math.round(penalty.lostValue)}</b> / ${Math.round(penalty.totalValue + penalty.lostValue)}</span><span>◆ 结晶 <b>+${crystals}</b>（死亡保留30%）</span><span>保险契约 <b>${penalty.contractsUsed || 0}</b> 份已生效（保护 ${(penalty.kept || []).filter(i => i.byInsurance).length} 件）</span>` +
      this._crystalReportLine() +
      `<span style="flex-basis:100%">${this._statsLine(r)}</span>`;
    document.getElementById("death-lost").innerHTML = penalty.lost.length
      ? penalty.lost.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}</span>`).join("")
      : `<span class="chip">（无损失）</span>`;
    document.getElementById("death-kept").innerHTML = penalty.kept.length
      ? penalty.kept.map(it => `<span class="chip">${it.name}${it.byInsurance ? " ⛨保险" : ""}</span>`).join("")
      : `<span class="chip">（无保留）</span>`;
    document.getElementById("screen-death").classList.remove("hidden");
  },
});
