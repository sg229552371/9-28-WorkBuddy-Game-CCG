/* ============================================================
 * ui.js — 界面流程 / HUD / 背包拖拽 / 工匠开箱 / 结算 / 死亡
 * ============================================================ */
"use strict";

/* 邪神雕像倍率条目 → HUD 图标（key 与 G.run.scale / CFG.monsterScale.targets 对应） */
const GOD_SCALE_ICONS = {
  smallCount: { label: "怪量", icon: "☠", name: "小怪数量" },
  smallStat:  { label: "怪属", icon: "☣", name: "小怪属性" },
  eliteCount: { label: "精量", icon: "❖", name: "精英数量" },
  eliteStat:  { label: "精属", icon: "✷", name: "精英属性" },
  bossStat:   { label: "BOSS", icon: "☢", name: "BOSS属性" },
};

const UI = {
  selectedChar: null,
  selectedChars: [],   // 多角色组队（1~3 人，CFG.team.maxSize）
  selectedChestQ: null,
  drag: null,          // {item, fromInv, fromPending}
  hoverItem: null,

  /* ---------- 界面切换 ---------- */
  // 全部全屏界面（首页 / 关卡选择 / 角色选择 / 结算 / 死亡 / 帮助 / 设置 / 图鉴 / 告别）
  SCREEN_IDS: ["screen-main", "screen-level", "screen-character", "screen-settle", "screen-death",
    "screen-help", "screen-settings", "screen-codex", "screen-chip-codex", "screen-goodbye"],
  showScreen(name) {
    for (const id of this.SCREEN_IDS) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== name);
    }
    const hud = document.getElementById("hud");
    if (hud) hud.classList.add("hidden");
  },
  showHudOnly() {
    for (const id of this.SCREEN_IDS) {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    }
    const hud = document.getElementById("hud");
    if (hud) hud.classList.remove("hidden");
  },

  /* ---------- 竖屏优先：方向状态（20.x） ----------
   * 在 body 与 #app 上挂 portrait / landscape 类名，作为 CSS 竖屏主分支与测试判定的稳定钩子。
   * 判定口径：innerHeight > innerWidth → 竖屏（与 fitCanvas 的 aspect<1 一致）。
   * 幂等：每次切换只是 classList.add/remove，可被 resize / orientationchange 反复调用。 */
  applyOrientation() {
    const vw = (typeof window !== "undefined" && window.innerWidth) || 1920;
    const vh = (typeof window !== "undefined" && window.innerHeight) || 1080;
    const portrait = vh > vw;
    const targets = [typeof document !== "undefined" && document.body,
      typeof document !== "undefined" && document.getElementById("app")];
    for (const el of targets) {
      if (!el) continue;
      el.classList.toggle("portrait", portrait);
      el.classList.toggle("landscape", !portrait);
    }
    const cards = typeof document !== "undefined" && document.getElementById("levelup-cards");
    if (cards) cards.classList.toggle("grid-portrait", portrait);   // 升级弹窗 2×2 网格：竖屏启用
    return portrait;
  },

  /* ---------- 升级 4 选 1 暂停弹窗（19.4 方案 7） ----------
   * 契约：UI.onLevelUpChoice(candidates, onPick, meta?)
   *   candidates 元素形态：{kind:"module", defId, name, desc, lv?, locked?} 或 {kind:"statPack", attr/stat, name, value}
   *   用户点第 i 张（且未置灰）→ onPick(i)；弹窗不倒计时；暂停语义由战斗线负责（本处只做 UI）。
   *   meta（可选，向后兼容）：{ heroId, heroName, roleColor, slotUsed?, slotTotal? }
   *     - heroName 缺失回落 heroId；meta 整体缺失时退化为旧行为（不显示归属标题）。
   *     - slotUsed = 该英雄已占用模块槽数 → 卡片标注「模块槽 N/4」（本次将占第 slotUsed+1 格）。
   * UI.onLevelUpChoiceClose() 供测试 / 强制关闭。 */
  levelUpCandidates: null,
  levelUpOnPick: null,
  levelUpMeta: null,
  onLevelUpChoice(candidates, onPick, meta) {
    this.levelUpCandidates = candidates || [];
    this.levelUpOnPick = onPick;
    this.levelUpMeta = meta || null;
    this._renderLevelUp();
    const ov = document.getElementById("levelup-overlay");
    if (ov) ov.classList.remove("hidden");
  },
  onLevelUpChoiceClose() {
    const ov = document.getElementById("levelup-overlay");
    if (ov) ov.classList.add("hidden");
    this.levelUpCandidates = null;
    this.levelUpOnPick = null;
    this.levelUpMeta = null;
  },
  /* 归属英雄标题（19.12）：meta 缺失时清空标题（旧行为），不报错。 */
  _renderLevelUpHeader() {
    const el = document.getElementById("levelup-hero");
    if (!el) return;
    const m = this.levelUpMeta;
    if (!m || (!m.heroId && !m.heroName)) { el.innerHTML = ""; el.classList.remove("has-hero"); return; }
    const name = m.heroName || m.heroId;
    const color = m.roleColor || "#ffd76a";
    el.classList.add("has-hero");
    el.innerHTML = `给 <b style="color:${color}">${name}</b> 选择强化`;
  },
  _renderLevelUp() {
    this._renderLevelUpHeader();
    const box = document.getElementById("levelup-cards");
    if (!box) return;
    box.innerHTML = "";
    const list = this.levelUpCandidates || [];
    const m = this.levelUpMeta || {};
    const perHero = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    list.forEach((c, i) => {
      const locked = !!c.locked;
      const card = document.createElement("div");
      card.className = "levelup-card" + (locked ? " lu-locked" : "");
      // 卡片内容：按候选类型渲染（module = 武器模块叠加 / statPack = 属性小包）
      const kindLabel = c.kind === "module" ? "武器模块" : (c.kind === "statPack" ? "属性小包" : (c.kind || ""));
      const desc = c.kind === "statPack" ? `+${c.value}` : (c.desc || "");
      // 归属英雄（20.3 任务一）：全队混抽后每个 cand 有自己的 heroId → 显示 cand 的归属，而非 meta（升级者）。
      //   用该英雄定位色做视觉标识（左侧色条 + 归属标签底色）。
      const owner = this._candOwner(c);
      // 模块候选：标注「→ 填入 <英雄名> 的第 N 槽」（N = 该英雄已用槽位数 + 1）。
      //   已持有 → 走「强化已有槽 N」（N = 该模块所在格）；拿不到槽位信息 → 降级只显示归属英雄。
      let slotLine = "";
      if (c.kind === "module") {
        const ownedIdx = this._slotIndexOf(c);
        if (ownedIdx >= 0) {
          const lvLine = c.lv ? ` · 入槽 LV${c.lv}` : "";
          slotLine = `<span class="lu-slot">强化已有槽 ${ownedIdx + 1}/${perHero}${lvLine}</span>`;
        } else if (owner.slotKnown) {
          const n = Math.min(owner.slotUsed + 1, perHero);
          const lvLine = c.lv ? ` · 入槽 LV${c.lv}` : "";
          slotLine = `<span class="lu-slot">→ 填入 <b style="color:${owner.color}">${owner.name}</b> 的第 ${n} 槽（${n}/${perHero}）${lvLine}</span>`;
        } else {
          // 兜底降级：拿不到槽位 → 只标归属英雄名，不显示槽号（避免 undefined）
          slotLine = `<span class="lu-slot">→ 填入 <b style="color:${owner.color}">${owner.name}</b></span>`;
        }
      }
      // 槽位将满警示：该英雄已用满 last-1 格（本次选中即填满）→ 黄色警告；其实已满（locked）→ 红色锁定行。
      const fullWarn = (!locked && c.kind === "module" && owner.slotKnown && owner.slotUsed === perHero - 1);
      card.classList.toggle("lu-will-full", fullWarn);
      const warnLine = fullWarn ? `<span class="lu-full">⚠ 该队友槽位将满（${perHero}/${perHero}）</span>` : "";
      const lockLine = locked ? `<span class="lu-lock">🚫 槽位已满 · 不可选</span>` : "";
      // 归属标签底色 = 定位色（半透明叠底 + 定位色文字）。
      const ownerLine = `<span class="lu-owner" style="border-color:${owner.color};color:${owner.color}">👤 ${owner.name}</span>`;
      card.innerHTML = `<span class="lu-bar" style="background:${owner.color}"></span>` +
        `<span class="lu-kind">${kindLabel}</span>
        <span class="lu-name">${c.name || ""}</span>
        <span class="lu-desc">${desc}</span>${ownerLine}${slotLine}${warnLine}${lockLine}`;
      if (!locked) {
        card.onclick = () => {
          const cb = this.levelUpOnPick;
          this.onLevelUpChoiceClose();   // 先关闭（防重复点击）
          if (typeof cb === "function") cb(i);
        };
      }
      box.appendChild(card);
    });
  },
  /* 候选归属英雄（20.3 任务一）：返回 { heroId, name, color, slotUsed, slotKnown }。
   * 优先取 cand.heroId + cand.ownerName / cand.ownerRoleColor（战斗侧全队混抽后已带）；
   * 缺失时回落 meta（升级者）；再查不到 → name 用 heroId（保证永不显示 undefined）。
   * slotUsed 从 G.run.heroModules[heroId] 推算（G.run 为 null / 无数据 → slotKnown=false 走降级）。 */
  _candOwner(c) {
    const m = this.levelUpMeta || {};
    const heroId = (c && c.heroId) || m.heroId || "";
    // 名字优先级：cand.ownerName（战斗侧已知）→ meta.heroName（仅当归属即升级者）→ heroId。
    let name = (c && c.ownerName) || "";
    if (!name && m.heroName && heroId === m.heroId) name = m.heroName;
    if (!name) name = (m.heroName && !heroId) ? m.heroName : (heroId || "未知英雄");
    let color = (c && c.ownerRoleColor) || m.roleColor;
    if (!color) { const role = heroId && this.heroRole(heroId); color = (role && role.color) || "#9fb4cc"; }
    const slots = (heroId && G.run && G.run.heroModules && G.run.heroModules[heroId]) || null;
    let slotUsed = 0, slotKnown = false;
    if (slots) {
      slotKnown = true;
      for (const s of slots) if (s) slotUsed++;
    } else if (G.run && typeof m.slotUsed === "number" && heroId === m.heroId) {
      // meta.slotUsed 只描述升级者（战斗侧从 heroModules 取值）→ 仅当归属即升级者且本局存活(G.run 非空)时可用。
      // G.run 为 null = 拿不到槽位信息 → 走降级（只显示归属英雄，不显示槽号）。
      slotUsed = m.slotUsed; slotKnown = true;
    }
    return { heroId, name, color, slotUsed, slotKnown };
  },
  /* 该英雄已占用模块槽数（推导 slotUsed 用）：数据缺失返回 0，不报错。 */
  _occupiedSlotCount() {
    const m = this.levelUpMeta || {};
    const heroId = m.heroId || (this.levelUpCandidates && this.levelUpCandidates[0] && this.levelUpCandidates[0].heroId);
    const slots = (heroId && G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
    let n = 0;
    for (const s of slots) if (s) n++;
    return n;
  },
  /* 候选模块是否已在某槽中（返回槽下标，未持有返回 -1）。 */
  _slotIndexOf(c) {
    if (!c || c.kind !== "module") return -1;
    const heroId = c.heroId || (this.levelUpMeta && this.levelUpMeta.heroId);
    const slots = (heroId && G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
    for (let i = 0; i < slots.length; i++) if (slots[i] && slots[i].defId === c.defId) return i;
    return -1;
  },

  /* ---------- 提示 ---------- */
  toast(msg, cls = "") {
    const area = document.getElementById("toast-area");
    if (!area) return;
    const el = document.createElement("div");
    el.className = "toast " + cls;
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(() => el.remove(), 2700);
    while (area.children.length > 4) area.firstChild.remove();
  },

  /* ---------- 关卡选择（解锁链：通关第 n 关解锁第 n+1 关） ---------- */
  buildLevelList() {
    const box = document.getElementById("level-list");
    if (!box) return;
    box.innerHTML = "";
    CFG.levels.forEach((lv, idx) => {
      const unlocked = idx < Meta.data.unlockedLevels;
      const card = document.createElement("div");
      card.className = "level-card" + (unlocked ? "" : " locked");
      card.innerHTML = `<div><b>${lv.name}</b></div>
        <small>${unlocked ? `目标击杀 ${lv.progressGoal} · 时限 ${lv.timeLimit}s · BOSS ${CFG.monsters[lv.boss].name} · 点击开始` : "🔒 通关前一关解锁"}</small>`;
      if (unlocked) card.onclick = () => { this.selectedLevel = lv; Game.enterCharSelect(); };
      box.appendChild(card);
    });
  },

  /* 英雄定位（19.2）：CFG.heroRoles.byHero[id] → 定位定义对象（含 name/color）；缺失返回 null。 */
  heroRole(heroId) {
    const HR = CFG.heroRoles;
    if (!HR || !HR.byHero) return null;
    const role = HR.byHero[heroId];     // byHero: heroId → 定位 key（output/defense/recovery）
    return role ? (HR[role] || null) : null;
  },

  /* ---------- 角色选择（只读展示；等级升级统一收敛到主城的强化导师 / 武器匠 NPC 面板） ---------- */
  buildCharList() {
    this.selectedChars = this.selectedChars || [];
    const box = document.getElementById("char-list");
    if (!box) return;
    box.innerHTML = "";
    const first = CFG.heroes;   // 原型阶段：全部角色可选（H007/H008 为召唤/陷阱技能验证角，正式版再作解锁门槛）
    for (const h of first) {
      const card = document.createElement("div");
      card.className = "char-card" + (this.selectedChars.some(s => s.id === h.id) ? " selected" : "");
      const img = Assets.images[h.sprite];
      const lv = Meta.heroLevel(h.id);
      const g = CFG.outLevel.growth, n = lv - 1;
      const skLv = Meta.weaponLv(h.id);   // 技能等级 = 武器等级
      const wpn = CFG.weapons[h.weapon], skId = wpn.skills.skill;
      const skLine = this._skillSummary(skId, skLv);
      // 定位徽章（19.2）：读 CFG.heroRoles.byHero[hero.id] → 定位定义（名称 + 配色）
      const role = this.heroRole(h.id);
      const roleBadge = role
        ? `<span class="role-badge" style="color:${role.color};border-color:${role.color}">${role.name}</span>`
        : "";
      card.innerHTML = `
        ${img ? `<canvas class="char-face" width="64" height="64"></canvas>` : ""}
        <div class="info"><b>${h.name}（${h.id}）${roleBadge}</b>
        <p class="outlv">局外 LV${lv}${lv < CFG.outLevel.maxLevel ? ` · 上限 ${CFG.outLevel.maxLevel}` : " · 已满级"} <small>（当前：HP ${h.hp + g.hp * n} · 攻 ${h.atk + g.atk * n} · 防 ${h.def + g.def * n}）</small></p>
        <p class="outlv">技能 LV${skLv} <small>（${skLine}）</small></p>
        <p class="outlv">武器 LV${skLv}${skLv < CFG.weaponLevel.maxLv
          ? ` · 上限 ${CFG.weaponLevel.maxLv}`
          : " · 已满级"} <small>（武器等级 = 技能等级，撤离后永久保留）</small></p>
        <p>${h.desc}</p>
        <p>HP ${h.hp} · 攻击 ${h.atk} · 防御 ${h.def} · 移速 ${h.spd} · 武器：${wpn.name}</p>
        <p class="hint"><small>升级请前往主城 →「强化导师」</small></p></div>`;
      if (img) {
        const cv = card.querySelector(".char-face");
        if (cv && cv.getContext) cv.getContext("2d").drawImage(img, 0, 0, 64, 64);
      }
      card.onclick = () => {
        // 多角色组队：点击选中/取消，上限 CFG.team.maxSize
        const idx = this.selectedChars.findIndex(s => s.id === h.id);
        if (idx >= 0) this.selectedChars.splice(idx, 1);
        else {
          if (this.selectedChars.length >= CFG.team.maxSize) { this.toast(`组队上限 ${CFG.team.maxSize} 人`, "bad"); return; }
          this.selectedChars.push(h);
        }
        card.classList.toggle("selected", idx < 0);
        const startBtn = document.getElementById("btn-char-start");
        if (startBtn) {
          startBtn.disabled = this.selectedChars.length === 0;
          startBtn.textContent = `开始游戏（${this.selectedChars.length}/${CFG.team.maxSize}）`;
        }
      };
      box.appendChild(card);
    }
    const metaLine = document.getElementById("meta-line");
    if (metaLine) metaLine.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b><small>　撤离/击杀获得 · 死亡仅保留 ${CFG.outLevel.deathRatio * 100}% · 升级请前往主城「强化导师」</small>`;
  },

  /* 局外成长界面已收敛到主城 NPC 面板（#screen-meta 已移除）：
   * 局外等级 → renderTrainer()（强化导师）/ 武器·技能等级 → renderSmith()（武器匠）。
   * 原 renderMeta() 为重构遗留死函数（其 DOM #meta-char-list / #meta-crystals 已不存在），已删除。 */

  // 局外等级升级：复用 Meta.levelUp（内部校验上限与结晶）
  metaUpgradeLevel(id) {
    const h = CFG.heroes.find(x => x.id === id) || { name: id };
    if (Meta.heroLevel(id) >= CFG.outLevel.maxLevel) { this.toast("已达局外等级上限", "bad"); return; }
    if (!Meta.levelUp(id)) { this.toast("结晶不足", "bad"); return; }
    this.toast(`${h.name} 局外等级提升至 LV${Meta.heroLevel(id)}！`, "gold");
  },
  // 武器 / 技能等级升级：复用 Meta.weaponUp（武器等级 = 技能等级），此处以进化结晶支付
  metaUpgradeWeapon(id) {
    const h = CFG.heroes.find(x => x.id === id) || { name: id };
    const lv = Meta.weaponLv(id);
    if (lv >= CFG.weaponLevel.maxLv) { this.toast("武器已达上限", "bad"); return; }
    const cost = Meta.weaponUpCost(id);
    if (Meta.data.crystals < cost) { this.toast("结晶不足", "bad"); return; }
    Meta.data.crystals -= cost;
    Meta.weaponUp(id);   // 内部已 commit（存档写入）
    this.toast(`⚔ ${h.name} 武器 / 技能提升至 LV${Meta.weaponLv(id)}！`, "gold");
  },
  /* 技能摘要：按 skillEntry(统一等级曲线) 展示该等级的实际效果（弹道 / 召唤物 / 陷阱三类） */
  _skillSummary(skId, skLv) {
    const e = skillEntry(skId, skLv);
    if (!e) return "—";
    const tags = (e.tags || []).join("/") || "无";
    if (e.type === "summon" || e.type === "trap") {
      const eff = e.type === "summon"
        ? `${e.count} 架无人机 · 机体 HP${e.hp} · 攻击 ${e.atk} · 射速 ${e.fireCd}s`
        : `${e.count} 颗地雷 · 伤害 ${e.dmgMul}×攻击 · 半径 ${e.radius} · 入圈 ${e.armDelay}s 引爆`;
      return `${e.name}：${eff} · 冷却 ${e.cd}s · 耗能 ${e.energy} · 受词条影响：${tags}`;
    }
    const dmg = Math.round(e.dmgMul * 100);
    return `${e.name}：伤害 ${dmg}% 攻击 · 冷却 ${e.cd}s · 耗能 ${e.energy} · 爆炸半径 ${e.radius || 0} · 受词条影响：${tags}`;
  },

  /* ---------- HUD 每帧刷新 ---------- */
  /* 自动战斗按钮（HUD 右下）：开关态文案 + 高亮；每局 startRun 重置为关 */
  updateAutoFightBtn() {
    const btn = document.getElementById("btn-autofight");
    if (!btn) return;
    const on = !!(G.run && G.run.autoFight);
    btn.textContent = on ? "自动战斗：开" : "自动战斗：关";
    btn.classList.toggle("on", on);
    // 风格选择器：开启时展开三档（疯狂/平衡/冷静），高亮当前风格
    const row = document.getElementById("autofight-styles");
    if (row) {
      row.classList.toggle("hidden", !on);
      const cur = G.run ? G.run.autoStyle : (CFG.autoFight ? CFG.autoFight.defaultStyle : "balanced");
      for (const b of row.children) if (b.classList) b.classList.toggle("selected", b.dataset && b.dataset.style === cur);
    }
  },
  /* 技能冷却环（19.3）：读 G.player.skillTimer（剩余秒）与 G.run.weapon.skill.cd（总长）。
   * 冷却中按「就绪比例 = 1 - 剩余/总长」填充弧长；就绪（skillTimer<=0 或总长<=0）时常亮 + READY。 */
  updateSkillCd() {
    const wrap = document.getElementById("hud-skill-cd");
    if (!wrap) return;
    const arc = document.getElementById("skill-cd-arc");
    const txt = document.getElementById("skill-cd-txt");
    const nameEl = document.getElementById("skill-cd-name");
    const skill = (G.run && G.run.weapon && G.run.weapon.skill) || null;
    const cd = (skill && skill.cd) || 0;
    const remain = (G.player && G.player.skillTimer) || 0;   // 剩余秒（<=0 = 就绪）
    const ready = remain <= 0 || cd <= 0;
    if (ready) {
      wrap.classList.add("ready");
      if (arc) arc.style.strokeDashoffset = "0";             // 满弧 = 就绪
      if (txt) txt.textContent = "READY";
    } else {
      wrap.classList.remove("ready");
      const fill = Math.max(0, Math.min(1, 1 - remain / cd));   // 就绪比例
      if (arc) arc.style.strokeDashoffset = (213.6 * (1 - fill)).toFixed(1);
      if (txt) txt.textContent = remain.toFixed(1) + "s";
    }
    if (nameEl) nameEl.textContent = (skill && skill.name) || "";
  },

  /* ---------- 全队技能栏（19.12，底部居中 HUD） ----------
   * 布局：每人一条横向卡片 [技能图标 + 冷却环][模块槽1..4]（存该英雄升级时选到的武器模块）。
   * 数据源：G.run.heroModules[heroId]（长度 4 数组，元素 {defId, lv} 或 null）；缺失优雅降级为空框。
   * 性能（每帧刷新）：结构只建一次（_buildPartySkillbar，按队伍签名）；之后 updatePartySkillbar
   *   只更新变化部分（冷却弧角度 / 槽内容签名），DOM 不重建。 */
  _psSig: "",          // 队伍结构签名（人数 + 英雄 ID 列表）→ 变了才重建
  _psCache: null,      // [{ row, arc, txt, slots:[{el, sig}] }] 结构引用缓存
  _psSlotSig: null,    // 各槽内容签名（避免每帧重写 innerHTML）
  _moduleTipOpen: false,   // 模块槽词条浮窗是否打开（20.3 任务二）
  _moduleTipKey: "",       // 当前浮窗键（heroId:idx）→ 再点同槽可关闭

  /* 取全队成员列表（队长 + 队友）：统一包装为 { id, name, heroDef, rt }（rt = 运行时实体，供读 skillTimer）。
   * 数据缺失时返回空数组，不报错。队长运行时优先 G.player，回退 G.heroDef。 */
  _partyMembers() {
    const out = [];
    const leaderDef = G.heroDef || (G.team && G.team[0]);
    if (leaderDef && leaderDef.id) {
      out.push({ id: leaderDef.id, name: leaderDef.name || leaderDef.id, heroDef: leaderDef,
        rt: (G.player && G.player.heroDef === leaderDef) ? G.player : (G.player || leaderDef) });
    }
    for (const c of (G.run && G.run.companions) || []) {
      if (c && c.id) out.push({ id: c.id, name: c.name || c.id, heroDef: c.heroDef || {}, rt: c });
    }
    return out;
  },
  /* 模块品质色：按等级占 maxLv 的比例分为 4 档（白/蓝/紫/金）等分区间。
   * 用于「品质色边框」——模块本身无 itemQ，等级档位即强度品质。缺失返回最低档色。
   * 档位阈值 25/50/75%：LV1-2 白 / LV3-5 蓝 / LV6-8 紫 / LV9 金（maxLv=9）。 */
  moduleQualityColor(lv) {
    const qs = CFG.itemQualities || [{ color: "#b8c4d4" }];
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const tier = Math.ceil(Math.max(1, Math.min(maxLv, lv || 1)) / maxLv * qs.length);   // 1..qs.length
    const idx = Math.max(0, Math.min(qs.length - 1, tier - 1));
    return (qs[idx] && qs[idx].color) || "#b8c4d4";
  },
  /* 单条技能条的结构（英雄标识 + 技能图标/冷却环 + 4 模块槽）。只在队伍变化时建。 */
  _buildPartyRow(member) {
    const role = this.heroRole(member.id) || {};
    const heroDef = member.heroDef || (CFG.heroes || []).find(h => h.id === member.id) || {};
    const weapon = CFG.weapons[heroDef.weapon] || {};
    const skillId = weapon.skills && weapon.skills.skill;
    const skillDef = (typeof CFG.skills === "object" && skillId) ? CFG.skills[skillId] : null;
    const skillName = (skillDef && skillDef.name) || weapon.name || "技能";
    const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const row = document.createElement("div");
    row.className = "ps-row";
    row.dataset.heroId = member.id;
    // 技能图标：svg 冷却环 + 技能首字 + 冷却秒数
    const icon = document.createElement("div");
    icon.className = "ps-icon ready";
    icon.innerHTML = `<svg viewBox="0 0 80 80"><circle class="ps-track" cx="40" cy="40" r="34"/><circle class="ps-arc" cx="40" cy="40" r="34"/></svg>
      <span class="ps-glyph">${(skillName || "技").slice(0, 1)}</span>
      <span class="ps-cd"></span>`;
    row.appendChild(icon);
    // 英雄名 + 定位色
    const info = document.createElement("div");
    info.className = "ps-info";
    info.innerHTML = `<b class="ps-name" style="color:${role.color || "#cfe0ff"}">${member.name || member.id}</b>
      <small class="ps-role" style="color:${role.color || "#9fb4cc"}">${role.name || ""}</small>`;
    row.appendChild(info);
    // 模块槽 ×4
    const slotsBox = document.createElement("div");
    slotsBox.className = "ps-slots";
    const slots = [];
    for (let i = 0; i < per; i++) {
      const el = document.createElement("div");
      el.className = "ps-slot ps-slot-empty";
      el.dataset.idx = i;
      slotsBox.appendChild(el);
      slots.push({ el, sig: "\u0000" });   // 初始签名保证首帧写入
    }
    row.appendChild(slotsBox);
    return { row, icon, arc: icon.querySelector(".ps-arc"), glyph: icon.querySelector(".ps-glyph"),
      cdTxt: icon.querySelector(".ps-cd"), slots, skillName, skillDef, member };
  },
  /* 构建/重建全队技能栏结构（仅在队伍签名变化时调用）。 */
  _buildPartySkillbar(members) {
    const bar = document.getElementById("party-skillbar");
    if (!bar) return;
    bar.innerHTML = "";
    const cache = [];
    for (const m of members) {
      const r = this._buildPartyRow(m);
      bar.appendChild(r.row);
      cache.push(r);
    }
    // 事件委托（20.3 任务二）：只绑一次到容器，槽位在行内 → 避免每次重建行时重复绑定。
    //   幂等：重复调用只是覆盖同一容器上的 onclick（不累积 handler）。
    bar.onclick = (e) => this._onPartyBarClick(e);
    this.bindModuleTipDismiss();   // 外部点击关闭浮窗（只绑一次）
    this._psCache = cache;
    this._psSig = members.map(m => m.id).join(",");
    this._psSlotSig = {};
  },
  /* 模块槽内容更新（按签名比对，内容没变不碰 DOM）。 */
  _updatePartySlots(entry, member) {
    const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const list = (G.run && G.run.heroModules && G.run.heroModules[member.id]) || [];
    for (let i = 0; i < per; i++) {
      const s = entry.slots[i];
      if (!s) continue;
      const slot = list[i] || null;
      const sig = slot ? (slot.defId + ":" + (slot.lv || 1)) : "empty";
      if (s.sig === sig) continue;              // 无变化：跳过 DOM 写入
      s.sig = sig;
      // 记录当前槽数据（供点击弹浮窗读取；不写 DOM，零额外开销）
      s.defId = slot ? slot.defId : null;
      s.lv = slot ? (slot.lv || 1) : 0;
      s.idx = i;
      s.heroId = member.id;
      s.heroName = member.name || member.id;
      if (!slot) {
        s.el.className = "ps-slot ps-slot-empty";
        s.el.innerHTML = `<span class="ps-slot-no">${i + 1}</span>`;
        s.el.style.borderColor = "";
        s.el.title = "空槽 · 升级可选择武器模块填入";
      } else {
        const name = this._moduleName(slot.defId) || slot.defId;
        const color = this.moduleQualityColor(slot.lv || 1);
        s.el.className = "ps-slot ps-slot-filled";
        s.el.style.borderColor = color;
        s.el.innerHTML = `<span class="ps-slot-nm" style="color:${color}">${name}</span>
          <span class="ps-slot-lv">LV${slot.lv || 1}/${maxLv}</span>`;
        s.el.title = `${name} LV${slot.lv || 1}/${maxLv}（点击查看词条明细）`;
      }
    }
  },
  /* 模块槽点击（20.3 任务二）：事件委托入口。点已填充槽 → 词条详情浮窗；点空槽 → 空槽提示气泡。
   * 命中判定走「目标节点 + 最近的祖先行」——不使用 querySelector（DOM 桩下也稳定）。 */
  _onPartyBarClick(e) {
    const target = (e && e.target) || (typeof window !== "undefined" && window.event && window.event.target);
    if (!target || !target.dataset) return;
    // 找带 idx 的 .ps-slot（目标可能是槽内文字 span）：真实 DOM 用 closest（标准 API）；
    // 测试桩无 closest → 沿 _parent/parentElement 手工上溯降级。
    // 🔧 20.3 修复：原实现只靠 el._parent 上溯，但 _parent 从未赋值 → 实机 heroId 永远为空，
    //     点击已填充槽也走空槽分支（Playwright 实机验证抓到；桩直接调 showModuleSlotTip 未覆盖此链）。
    let slotEl = null;
    if (typeof target.closest === "function") {
      slotEl = target.closest(".ps-slot");
    } else {
      let el = target;
      while (el) {
        if (el.dataset && el.dataset.idx !== undefined) { slotEl = el; break; }
        el = el.parentElement || el._parent || null;
      }
    }
    if (!slotEl) return;
    // 从行读 heroId（row 节点 dataset.heroId），再定位缓存 entry
    let rowEl = null;
    if (typeof slotEl.closest === "function") {
      rowEl = slotEl.closest(".ps-row");
    } else {
      rowEl = slotEl;
      while (rowEl && !(rowEl.dataset && rowEl.dataset.heroId)) rowEl = rowEl.parentElement || rowEl._parent || null;
    }
    const heroId = (rowEl && rowEl.dataset && rowEl.dataset.heroId) || "";
    const entry = this._psCache && this._psCache.find(x => x.member && x.member.id === heroId);
    const idx = parseInt(slotEl.dataset.idx, 10) || 0;
    const s = entry && entry.slots && entry.slots[idx];
    // 再点同一槽 → 关闭（toggle）
    const key = (heroId || "") + ":" + idx;
    if (this._moduleTipOpen && this._moduleTipKey === key) { this.hideModuleTip(); return; }
    this._moduleTipKey = key;
    if (s && s.defId) this.showModuleSlotTip(s, slotEl);
    else this.showModuleSlotEmptyTip(slotEl);
  },
  /* 词条明细行（20.3 任务二）：主词缀（按等级成长）+ 阶段词缀（按阶段解锁）。
   * 数据源：CFG.moduleDefs[defId].affix（主）+ CFG.moduleLevel.stageAffixes（阶段）。 */
  _moduleAffixLines(defId, lv) {
    const def = (CFG.moduleDefs || []).find(m => m.id === defId);
    const ml = CFG.moduleLevel || {};
    const maxLv = ml.maxLv || 9;
    const lvN = Math.max(1, Math.min(maxLv, lv || 1));
    const lines = [];
    const fmt = (mode, tag, v) => (mode === "flat" ? `${tag} +${v}` : `${tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);
    // 主词缀：基础值 × (1 + (lv-1) × valueStep)（valueStep 缺失按 0 → 不成长）
    if (def && def.affix) {
      const af = def.affix;
      const step = ml.valueStep || 0;
      const baseV = (af.vals && af.vals[0]) || 0;      // vals[0] = 档位基准
      const effV = af.mode === "flat" ? baseV : baseV * (1 + (lvN - 1) * step);
      lines.push({ main: true, txt: fmt(af.mode, af.tag, af.mode === "flat" ? effV : effV) });
    } else {
      lines.push({ main: true, txt: "（无主词缀数据）" });
    }
    // 阶段词缀：阶段 = ceil(lv/perStage)；解锁前 n 条（阶段1 解锁第 1 条…）
    const perStage = ml.perStage || 3;
    const stage = Math.max(1, Math.ceil(lvN / perStage));
    const sa = ml.stageAffixes || [];
    for (let i = 0; i < sa.length; i++) {
      const a = sa[i];
      const unlocked = i < stage;
      lines.push({ main: false, unlocked, txt: `${fmt(a.mode, a.tag, a.value)}（${a.name}）` });
    }
    return lines;
  },
  /* 浮窗渲染（20.3 任务二）：点击时创建/更新，绝不每帧调用。
   * DOM：#module-tip > (.mt-head + .mt-rows) ；定位跟随点击槽位、竖屏收窄居中。 */
  showModuleSlotTip(s, slotEl) {
    const tip = document.getElementById("module-tip");
    if (!tip) return;
    const defId = s.defId, lv = s.lv || 1;
    const name = this._moduleName(defId) || defId;
    const color = this.moduleQualityColor(lv);
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const qName = this._qualityName(lv);
    const rows = this._moduleAffixLines(defId, lv).map(r =>
      `<div class="mt-row${r.unlocked === false ? " dim" : ""}${r.main ? " main" : ""}">${r.unlocked === false ? "🔒 " : (r.main ? "◆ " : "✔ ")}${r.txt}</div>`
    ).join("");
    tip.innerHTML = `<div class="mt-head"><b style="color:${color}">${name}</b>
      <span style="color:${color}">${qName} · LV ${lv}/${maxLv}</span></div>
      <div class="mt-rows">${rows}</div>
      <div class="mt-foot">归属：${s.heroName || s.heroId || ""} · 第 ${(s.idx || 0) + 1} 槽 · 对小队全体生效</div>`;
    tip.dataset.heroId = s.heroId || "";
    tip.dataset.idx = String(s.idx || 0);
    this._positionModuleTip(tip, slotEl);
    tip.classList.remove("hidden");
    this._moduleTipOpen = true;
  },
  /* 空槽提示（20.3 任务二）：复用浮窗容器，显示引导文案。 */
  showModuleSlotEmptyTip(slotEl) {
    const tip = document.getElementById("module-tip");
    if (!tip) return;
    tip.innerHTML = `<div class="mt-head"><b>空槽</b><span>未装备模块</span></div>
      <div class="mt-rows"><div class="mt-row dim">空槽 · 升级可选择武器模块填入</div>
      <div class="mt-row dim">升级 4 选 1 时选择该英雄专属模块即可填入</div></div>`;
    tip.dataset.heroId = ""; tip.dataset.idx = "-1"; tip.dataset.empty = "1";
    this._positionModuleTip(tip, slotEl);
    tip.classList.remove("hidden");
    this._moduleTipOpen = true;
  },
  /* 品质名（按 moduleQualityColor 同口径的档位）：白/蓝/紫/金。 */
  _qualityName(lv) {
    const qs = CFG.itemQualities || [{ name: "白" }];
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const tier = Math.ceil(Math.max(1, Math.min(maxLv, lv || 1)) / maxLv * qs.length);
    return (qs[Math.max(0, Math.min(qs.length - 1, tier - 1))] || {}).name || "白";
  },
  /* 浮窗定位（20.3 任务二）：优先锚到点击槽上方；竖屏宽度限 96vw 居中避免溢出。 */
  _positionModuleTip(tip, slotEl) {
    const vw = (typeof window !== "undefined" && window.innerWidth) || 1920;
    const portrait = (typeof window !== "undefined" && window.innerHeight > window.innerWidth);
    if (portrait) {
      // 竖屏：底部控件带之上居中，宽度自适应（CSS max-width 兜底）
      tip.style.left = "50%"; tip.style.right = "auto";
      tip.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 220px)";
      tip.style.top = "auto"; tip.style.transform = "translateX(-50%)";
      return;
    }
    const r = (slotEl && slotEl.getBoundingClientRect) ? slotEl.getBoundingClientRect() : { left: vw / 2, top: 220 };
    tip.style.transform = "none";
    tip.style.left = Math.round(r.left) + "px";
    tip.style.right = "auto";
    tip.style.bottom = "auto";
    tip.style.top = Math.max(8, Math.round(r.top) - 8) + "px";
  },
  /* 关闭模块槽浮窗（20.3 任务二）：外部点击 / 再次点同槽 / 战斗 HUD 下线调用。幂等。 */
  hideModuleTip() {
    const tip = document.getElementById("module-tip");
    if (tip) { tip.classList.add("hidden"); tip.dataset.empty = ""; }
    this._moduleTipOpen = false;
    this._moduleTipKey = "";
  },
  /* 冷却环更新（复用 updateSkillCd 的 213.6 弧长口径）：技能/槽位缺失不抛异常。
   * 剩余秒优先读运行时实体 rt.skillTimer（队长 = G.player，队友 = companion）。 */
  _updatePartyCd(entry) {
    const icon = entry.icon;
    if (!icon) return;
    const skill = entry.skillDef;
    const cd = (skill && skill.cd) || 0;
    const rt = entry.member && entry.member.rt;
    const remain = (rt && rt.skillTimer) || 0;
    const ready = remain <= 0 || cd <= 0;
    if (entry.arc) entry.arc.style.strokeDashoffset = ready ? "0" : (213.6 * (remain / cd)).toFixed(1);
    icon.classList.toggle("ready", ready);
    if (entry.cdTxt) entry.cdTxt.textContent = ready ? "" : remain.toFixed(1) + "s";
  },
  /* 全量渲染（结构 + 更新）：队伍变化时重建结构，否则只更新变化部分。 */
  renderPartySkillbar() {
    const members = this._partyMembers();
    const sig = members.map(m => m.id).join(",");
    if (sig !== this._psSig || !this._psCache) this._buildPartySkillbar(members);
    this.updatePartySkillbar();
  },
  /* 每帧刷新入口（updateHUD 内调用）：只更新变化部分，不重建 DOM。 */
  updatePartySkillbar() {
    const cache = this._psCache;
    if (!cache) { this.renderPartySkillbar(); return; }
    for (const entry of cache) {
      this._updatePartyCd(entry);
      if (entry.member) this._updatePartySlots(entry, entry.member);
    }
  },
  /* 战斗 HUD 下线（20.2）：离开战斗（回城 / 结算 / 死亡 / 返回主菜单）时调用。
   * 成因：updateHUD 在 G.state !== "playing" 时提前 return，全队技能栏最后一次渲染的 DOM
   *       会原样留在页面；而 .party-skillbar:empty 只隐藏**空**容器 → 回城后技能栏残留。
   * 处理：清空结构（令 :empty 规则重新生效）+ 复位缓存（下次进战斗按新队伍重建）。
   * 幂等：可重复调用；元素缺失只跳过，不抛异常。 */
  clearBattleHud() {
    const bar = document.getElementById("party-skillbar");
    if (bar) bar.innerHTML = "";
    this.hideModuleTip();       // 20.3：顺带关掉模块槽词条浮窗（防残留）
    this._psCache = null;
    this._psSig = null;
    this._psSlotSig = {};
  },

  updateHUD() {
    const r = G.run;
    if (!r || G.state !== "playing") return;
    // 队长血/能量条已移到角色头顶（与队友同款），左上角只保留技能冷却环 + Buff 图标区
    document.getElementById("lv-num").textContent = r.lv;
    document.getElementById("bar-exp").style.width = (r.exp / r.expNext * 100) + "%";
    document.getElementById("coin-num").textContent = r.coin;
    document.getElementById("exp-num").textContent = r.exp;
    // 技能冷却环（19.3：能量条退役 → 冷却制）：skillTimer 剩余秒 / skill.cd 总长
    this.updateSkillCd();
    // 全队技能栏（19.12）：底部居中，结构只建一次 + 变化检测更新（不每帧重建 DOM）
    this.renderPartySkillbar();
    // 进度条
    const lv = G.levelCfg;
    const pf = document.getElementById("progress-fill");
    const pt = document.getElementById("progress-txt");
    if (r.bossDefeated) { pf.style.width = "100%"; pt.textContent = "已出现撤离点雕像 · 站进雕像圈内自动读条 8 秒撤离"; }
    else if (r.bossSpawned) { pf.style.width = "100%"; pt.textContent = "BOSS 战斗中"; }
    else {
      const pct = Math.min(1, r.kills / lv.progressGoal);
      pf.style.width = pct * 100 + "%";
      pt.textContent = `击杀进度 ${r.kills}/${lv.progressGoal}（${Math.floor(r.runTime)}s / ${lv.timeLimit}s）`;
    }
    document.getElementById("boss-name").classList.toggle("hidden", !(r.bossSpawned && !r.bossDefeated));
    // 负重
    const wf = weightFactor();
    const wl = document.getElementById("weight-line");
    wl.classList.toggle("over", wf.over);
    document.getElementById("weight-num").textContent = Math.round(wf.w);
    document.getElementById("weight-pen").textContent = wf.over ? `⚠ 超重！移速保留 ${(wf.f * 100).toFixed(0)}%` : "";
    // Buff 图标
    const ba = document.getElementById("buff-area");
    ba.innerHTML = "";
    for (const b of r.buffs) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      const lv = b.lv || 1;
      const label = b.skillId ? buffEffectLabel(b.skillId, lv) : (b.label || "");
      el.title = `${b.id} Lv${lv}：${label}（剩 ${Math.ceil(b.remain)}s）`;
      el.innerHTML = `${b.id}<small>Lv${lv} · ${Math.ceil(b.remain)}s</small>`;
      ba.appendChild(el);
    }
    // 邪神雕像倍率：多效果并列，凡 mul≠1 的条目各渲染一枚图标（增益偏紫 / 减益偏红紫）
    if (r.scale) {
      for (const key in r.scale) {
        const s = r.scale[key];
        if (!s || s.mul === undefined || s.mul === 1) continue;   // mul=1 = 该条未生效
        const info = GOD_SCALE_ICONS[key] || { label: key, icon: "◆", name: key };
        const el = document.createElement("div");
        el.className = "buff-icon " + (s.mul > 1 ? "god-buff" : "god-debuff");
        el.title = `邪神·${info.name}：攻击/生命 ×${Number(s.mul).toFixed(2)}（剩 ${s.remain < 0 ? "永久" : Math.ceil(s.remain) + "s"}）`;
        el.innerHTML = `${info.icon}${info.label}<small>${s.remain < 0 ? "∞" : Math.ceil(s.remain) + "s"}</small>`;
        ba.appendChild(el);
      }
    }
    // 撤离点雕像 / 保险契约 / 裂缝击杀 HUD 提示
    if (r.exitStatue) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#7de08a";
      el.title = "撤离点雕像：任一小队成员站进雕像圈内即自动读条 8 秒撤离（受击归零，可反复重读）";
      el.innerHTML = `▲撤离<small>${r.extractChanneling ? Math.ceil(CFG.extract.channel - (r.extractProgress || 0)) + "s" : "圈内"}</small>`;
      ba.appendChild(el);
    }
    const insN = insuranceCount(r);
    if (insN > 0) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#5aa2ff";
      el.title = "保险契约：死亡时每份保护 1 件高价值物品；撤离时按固定价值统一折算结晶";
      el.innerHTML = `保险<small>×${insN}</small>`;
      ba.appendChild(el);
    }
    if (G.inRift) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#5ad0ff";
      el.title = "空间裂缝：敌人已一次性投放完毕（不再增援）；击杀 12 只出现基础奖励宝箱；返回信标读条 5 秒（仅受击打断，移动不打断）";
      el.innerHTML = `裂缝<small>${r.riftKills || 0}/${CFG.rift.rewardKills}</small>`;
      ba.appendChild(el);
    }
    // 属性卡牌资产提示（工匠世界可用）
    if (r.cardAssets > 0) {
      const el = document.createElement("div");
      el.className = "buff-icon";
      el.style.borderColor = "#ffd76a";
      el.title = "属性卡牌资产：工匠世界内使用";
      el.innerHTML = `卡<small>×${r.cardAssets}</small>`;
      ba.appendChild(el);
    }
    // 读条圈已改为进度环直接绑定在雕像/信标上（圈内积累、离开衰退）
    document.getElementById("channel-wrap").classList.add("hidden");
    // 中央提示（撤离点存在提示）
    const hint = document.getElementById("hint-center");
    if (G.mainWorld.altars.some(a => a.id === "ALTAR_005")) {
      hint.textContent = "工匠雕像在地图上，可进入工匠世界开箱 / 用卡（进入后雕像消失，新雕像会再出现）";
    } else hint.textContent = "";
  },

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
  /* 强化导师：局外等级升级（局外成长从首页/主菜单收敛至此） */
  renderTrainer() {
    const box = document.getElementById("outlevel-list");
    if (!box) return;
    const cry = document.getElementById("npc-crystals");
    if (cry) cry.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b>`;
    box.innerHTML = "";
    for (const h of CFG.heroes) {
      const lv = Meta.heroLevel(h.id);
      const lvMax = lv >= CFG.outLevel.maxLevel;
      const cost = Meta.levelUpCost(h.id);
      const can = !lvMax && Meta.data.crystals >= cost;
      const card = document.createElement("div");
      card.className = "meta-card";
      card.innerHTML = `
        <div class="meta-info"><b>${h.name}</b><p class="meta-desc">${h.desc}</p></div>
        <div class="meta-lv">
          <span>局外等级 <b class="lvnum">LV ${lv}</b> / ${CFG.outLevel.maxLevel}${lvMax ? " · 已满级" : ""}</span>
          <button class="btn small up-lv" ${can ? "" : "disabled"}>${lvMax ? "已满级" : `升级 ◆${cost}`}</button>
        </div>`;
      const btn = card.querySelector(".up-lv");
      if (btn) btn.onclick = () => { this.metaUpgradeLevel(h.id); this.renderTrainer(); this._cityHudSig = ""; this.updateCityHUD(); };
      box.appendChild(card);
    }
  },
  /* 武器匠：武器 / 技能等级升级 */
  renderSmith() {
    const box = document.getElementById("weapon-list");
    if (!box) return;
    const cry = document.getElementById("npc-crystals-weapon") || document.getElementById("npc-crystals");
    if (cry) cry.innerHTML = `◆ 进化结晶 <b>${Meta.data.crystals}</b>`;
    box.innerHTML = "";
    for (const h of CFG.heroes) {
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
      cnt.textContent = `英雄 ${hm}/${CFG.heroes.length} · 怪物 ${mm}/${Object.keys(CFG.monsters).length}`;
    }
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
  /* 首页芯片图鉴入口 + 返回按钮惰性绑定（幂等：已绑过则跳过，避免重复事件）。 */
  bindChipCodexEntry() {
    const entry = document.getElementById("btn-home-chip-codex");
    if (entry && typeof entry.onclick !== "function") entry.onclick = () => this.showChipCodex();
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
  /* 设置（音效音量 / 触屏控件缩放 / 桌面显示触屏控件） */
  renderSettings() {
    const s = G.settings, cfg = CFG.settings;
    const sfx = document.getElementById("set-sfx");
    if (sfx) sfx.value = s.sfxVolume;
    const joy = document.getElementById("set-joy");
    if (joy) joy.value = s.joyScale;
    const tgl = document.getElementById("set-touch");
    if (tgl) tgl.classList.toggle("on", !!s.showTouchOnDesktop);
  },

  /* ---------- 物品 TIPS 浮窗（悬停/长按；一个渲染函数全场景复用） ---------- */
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
    g.style.gridTemplateColumns = `repeat(${inv.cols}, 46px)`;
    g.style.gridTemplateRows = `repeat(${inv.rows}, 46px)`;
    g.innerHTML = "";
    for (let i = 0; i < inv.cols * inv.rows; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.dataset.x = i % inv.cols; c.dataset.y = Math.floor(i / inv.cols);
      g.appendChild(c);
    }
    for (const it of inv.items) {
      const el = document.createElement("div");
      el.className = `itm q${it.kind === "chest" ? this._chestQIdx(it.chestQ) : it.itemQ}`;
      el.style.left = it.x * 50 + 6 + "px"; el.style.top = it.y * 50 + 6 + "px";   // +6 = grid padding（.itm 相对 padding box 定位）
      el.style.width = it.shape[0] * 50 - 4 + "px"; el.style.height = it.shape[1] * 50 - 4 + "px";
      el.innerHTML = `<span class="nm">${it.name}</span>` +
        (it.kind === "chest" || it.kind === "insurance" ? `<span class="ct">×${it.count}</span>`
          : (it.kind === "module" && (it.lv || 1) > 1 ? `<span class="ct">LV${it.lv}</span>` : ""));
      el.dataset.uid = it.uid;
      g.appendChild(el);
    }
  },
  _chestQIdx(q) { return { normal: 0, advanced: 1, epic: 2 }[q]; },
  renderItemInfo() {
    const box = document.getElementById("item-info");
    const it = this.hoverItem;
    if (!it) { box.innerHTML = "选中或悬停物品查看详情"; return; }
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

  /* ---------- 工匠合并界面：三页签（开宝箱 / 抽卡牌 / 购买·服务）+ 背包/武器栏 ----------
   * 页签切换只换左侧功能区，背包/武器栏网格常驻右侧；功能入口清晰、手机端也可单手操作。 */
  ART_TABS: [
    { id: "chest", btn: "art-tab-chest", page: "art-page-chest" },
    { id: "cards", btn: "art-tab-cards", page: "art-page-cards" },
    { id: "shop",  btn: "art-tab-shop",  page: "art-page-shop"  },
    { id: "forge", btn: "art-tab-forge", page: "art-page-forge" },
  ],
  artTab: "chest",
  setArtisanTab(t) {
    if (!this.ART_TABS.some(x => x.id === t)) return;
    // 芯片工坊页签（19.7）在 ui.js 侧惰性绑定：main.js 未绑定该按钮时补上（幂等，避免重复 toast）
    const forgeBtn = document.getElementById("art-tab-forge");
    if (forgeBtn && typeof forgeBtn.onclick !== "function") forgeBtn.onclick = () => this.setArtisanTab("forge");
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
    else if (this.artTab === "cards") this.renderCards();
    else if (this.artTab === "shop") this._renderShopList();
    else if (this.artTab === "forge") this._renderForgeList();
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
    // 强化品质 / 洗词缀：需要先悬停选中一件装备或武器模块
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
      if (!it || (it.kind !== "gear" && it.kind !== "module")) { this.toast("请先悬停选中一件装备/武器模块", "bad"); return; }
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
      if (!it || it.kind !== "module") { this.toast("请先悬停选中一件武器模块", "bad"); return; }
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
      const pad = 8, cell = 50;   // 边框2 + 内边距6；格宽46 + 间隙4 = 50
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
      `<span style="flex-basis:100%;opacity:.85">资源折算（统一口径 价值×${CFG.settleConvert.valueRate}）：宝箱→◆${cv.chest} · 装备/武器模块→◆${cv.gear} · 道具→◆${cv.item} · 卡牌→◆${cv.card}（合计 ◆${cv.total}）</span>`;
    document.getElementById("settle-chests").innerHTML =
      `<div class="chip">${this._statsLine(r)}</div><div class="chip">背包内物品不作为物品带出，按各自固定价值统一折算为结晶（双层等级体系闭环）；局内经验与金币归零、不折算</div>`;
    const items = [...(r.weaponInv ? r.weaponInv.items : []), ...r.backpack.items];
    document.getElementById("settle-items").innerHTML = items.length
      ? items.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}（${it.kind === "chest" ? "宝箱" : CFG.itemQualities[it.itemQ].name}）</span>`).join("")
      : `<span class="chip">（无装备/武器模块保留）</span>`;
    document.getElementById("screen-settle").classList.remove("hidden");
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
      `<span>击杀 <b>${r.kills}</b></span><span>等级 <b>LV ${r.lv}</b></span><span>损失价值 <b>${Math.round(penalty.lostValue)}</b> / ${Math.round(penalty.totalValue + penalty.lostValue)}</span><span>◆ 结晶 <b>+${crystals}</b>（死亡保留30%）</span><span>保险契约 <b>${penalty.contractsUsed || 0}</b> 份已生效（保护 ${(penalty.kept || []).filter(i => i.byInsurance).length} 件）</span><span style="flex-basis:100%">${this._statsLine(r)}</span>`;
    document.getElementById("death-lost").innerHTML = penalty.lost.length
      ? penalty.lost.map(it => `<span class="chip">${it.name}${it.kind === "chest" ? " ×" + it.count : ""}</span>`).join("")
      : `<span class="chip">（无损失）</span>`;
    document.getElementById("death-kept").innerHTML = penalty.kept.length
      ? penalty.kept.map(it => `<span class="chip">${it.name}${it.byInsurance ? " ⛨保险" : ""}</span>`).join("")
      : `<span class="chip">（无保留）</span>`;
    document.getElementById("screen-death").classList.remove("hidden");
  },
};

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
