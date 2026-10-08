/* ============================================================
 * ui.js — UI 基础层：屏幕切换 / 升级弹窗 / toast / 关卡·英雄·选人 / HUD / 技能栏 / 首页
 * ------------------------------------------------------------
 * 21.16 物理搬移（第二阶段）：原巨型 `const UI = {...}`（2159 行）按行号切成两段。
 * 本文件保留：GOD_SCALE_ICONS 图标表 + UI 对象定义的前半段方法（屏幕切换 / 方向 /
 *   升级 4 选 1 / toast / 关卡选择 / 英雄解锁 / 角色选择 / HUD 每帧刷新 / 全队技能栏 /
 *   首页用户栏）。
 * 屏幕层后半段（主城 HUD / NPC 面板 / 工匠 / 图鉴 / 设置 / TIPS / 背包 / 结算 / 死亡）已移至
 *   js/ui-screens.js，以 Object.assign(UI, {...}) 在**本文件之后**合并（后半段方法体逐字不动）。
 * 面板 / 赛季 / 无尽结算 UI 见 js/ui-panels.js（须在 ui.js + ui-screens.js 之后加载）。
 * 依赖方向：依赖全局 CFG / Meta / Assets / G、game.js 等；ui-screens.js / ui-panels.js 依赖本文件。
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
    "screen-help", "screen-settings", "screen-codex", "screen-chip-codex", "screen-goodbye",
    "screen-endless-settle", "screen-endless-intro"],
  showScreen(name) {
    for (const id of this.SCREEN_IDS) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== name);
    }
    const hud = document.getElementById("hud");
    if (hud) hud.classList.add("hidden");
    // 进入选人界面后同步「开始游戏」按钮态：enterCharSelect 在 buildCharList 之后会把按钮强制
    // 置为「0 人 / 禁用」，但本版已默认选中首个已解锁英雄 → 此处按 selectedChars 实际人数纠正，
    // 使默认选中立即可开局（否则用户进入即见禁用按钮，与「默认选第 1 个角色」相悖）。
    if (name === "screen-character") this.syncCharStartBtn();
  },
  /* 同步选人「开始游戏」按钮：禁用态 + 文案取自 selectedChars（无 DOM 时静默）。 */
  syncCharStartBtn() {
    if (typeof document === "undefined" || !document.getElementById) return;
    const btn = document.getElementById("btn-char-start");
    if (!btn) return;
    const n = (this.selectedChars && this.selectedChars.length) || 0;
    btn.disabled = n === 0;
    btn.textContent = `开始游戏（${n}/${CFG.team.maxSize}）`;
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
  /* 21.8：移除归属英雄标题渲染（原 19.12 的 header 宿主节点同步删除）。
   * 理由：§5.48 起候选按队友轮转绑定池（每张卡归属可能不同），单一标题与卡面归属矛盾；
   * 归属信息已由每张卡的 lu-owner 徽章 + lu-bar 色条表达，标题冗余。 */
  _renderLevelUp() {
    this._renderLevelUpRerollBtn();
    const box = document.getElementById("levelup-cards");
    if (!box) return;
    box.innerHTML = "";
    const list = this.levelUpCandidates || [];
    const m = this.levelUpMeta || {};
    const perHero = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    // 推荐角标（21.4 参考图「推荐」绿标）：品质最高的非锁定候选（同品质取序号靠前）
    let recIdx = -1;
    list.forEach((c, i) => {
      if (c.locked) return;
      if (recIdx < 0 || (c.itemQ || 0) > (list[recIdx].itemQ || 0)) recIdx = i;
    });
    list.forEach((c, i) => {
      const locked = !!c.locked;
      const card = document.createElement("div");
      card.className = "levelup-card lu-v2" + (locked ? " lu-locked" : "");
      if (i === recIdx) card.classList.add("lu-rec");
      const kindLabel = c.kind === "module" ? "武器模块" : (c.kind === "statPack" ? "属性小包" : (c.kind || ""));
      const desc = c.kind === "statPack" ? `+${c.value}` : (c.desc || "");
      // 数值高亮（21.4 参考图：40%概率炮弹数量+1 → 数字橙色加粗）
      const descHl = String(desc).replace(/([+\-]?\d+(?:\.\d+)?%?)/g, '<b class="lu-num">$1</b>');
      const owner = this._candOwner(c);
      // 归属 + 槽位（20.3 功能保留；21.5 改为仅多英雄局渲染——单英雄局「▶ 猎手」与卡内槽位行同英雄名重复出现，
      // 且参考图卡面无归属行（归属由标题栏底色表达）；多英雄局归属信息仍有决策价值故保留）
      // 21.8：slotLine 去掉英雄名——ownerLine「▶ 名字」已含归属，两行同名重复（用户实机反馈）；
      // 槽位行只保留槽位数字信息。 */
      const multiHero = !!(G.run && G.run.companions && G.run.companions.length);
      const ownerLine = multiHero ? `<span class="lu-owner" style="border-color:${owner.color};color:${owner.color}">▶ ${owner.name}</span>` : "";
      let slotLine = "";
      if (multiHero && c.kind === "module") {
        const ownedIdx = this._slotIndexOf(c);
        if (ownedIdx >= 0) {
          slotLine = `<span class="lu-slot">强化已有槽 ${ownedIdx + 1}/${perHero}</span>`;
        } else if (owner.slotKnown) {
          const n = Math.min(owner.slotUsed + 1, perHero);
          slotLine = `<span class="lu-slot">→ 填入第 ${n} 槽（${n}/${perHero}）</span>`;
        } else {
          slotLine = `<span class="lu-slot">→ 填入空槽</span>`;
        }
      }
      // 槽位将满警示（20.3 保留）：本次选中即填满 → 黄色
      const fullWarn = (!locked && c.kind === "module" && owner.slotKnown && owner.slotUsed === perHero - 1);
      card.classList.toggle("lu-will-full", fullWarn);
      const warnLine = fullWarn ? `<span class="lu-full">⚠ 该队友槽位将满（${perHero}/${perHero}）</span>` : "";
      // 顶部彩色标题栏（21.4 参考图）：底色 = 归属英雄定位色（无归属 → 品质色）
      const q = CFG.itemQualities && CFG.itemQualities[c.itemQ] ? CFG.itemQualities[c.itemQ] : null;
      const headColor = owner.color || (q ? q.color : "#7aa0dc");
      // 大图标（21.4 参考图中央立绘位）：程序化占位 = 品质色底 + 词条符号
      const ico = this._levelUpIcon(c, q);
      // 底部进度胶囊（21.4 参考图「量子护盾 (0/3)」）：本局该类已叠层数 / 上限
      const chip = this._levelUpChip(c, owner, perHero);
      card.innerHTML =
        `<span class="lu-bar" style="background:${owner.color}"></span>` +
        `<span class="lu-head" style="background:${headColor}">${c.name || kindLabel}</span>` +
        (i === recIdx ? `<span class="lu-rec-badge">推荐</span>` : "") +
        `<span class="lu-kind">${kindLabel}</span>` +
        `<div class="lu-icon">${ico}</div>` +
        `<div class="lu-desc">${descHl}</div>` +
        /* 20.3 功能保留：归属英雄 + 槽位 + 将满警示（测试 ⑪A 契约，漏拼即 9 项失败） */
        ownerLine + slotLine + warnLine +
        `<div class="lu-chip">${chip}</div>` +
        (locked ? `<div class="lu-lock">✕ 槽位已满 · 不可选</div>` : "");
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
  /* 升级候选大图标（21.4 参考图中央立绘位）：程序化占位 = 品质色圆底 + 词条单字。
   * 用汉字而非 emoji：headless/老机型无 emoji 字体会显示空方框（实机踩过）；单字与项目程序化美术基调一致。 */
  _levelUpIcon(c, q) {
    const TAG_ICONS = {
      "伤害": "伤", "冷却": "冷", "弹道数量": "弹", "弹速": "速", "穿透": "穿",
      "范围": "围", "弹射次数": "弹", "召唤物": "召", "陷阱": "阱",
    };
    let sym = "强";
    if (c.kind === "module") {
      const def = CFG.moduleDefs && c.defId ? CFG.moduleDefs.find(d => d.id === c.defId) : null;
      const tag = def && def.affix ? def.affix.tag : null;
      sym = (tag && TAG_ICONS[tag]) || "强";
    } else if (c.kind === "statPack") sym = "属";
    const color = q ? q.color : "#7aa0dc";
    return `<span class="lu-ico" style="border-color:${color};color:${color};box-shadow:0 0 0 2px ${color}33, 0 4px 14px ${color}22">${sym}</span>`;
  },
  /* 升级候选进度胶囊（21.4 参考图底部「量子护盾 (0/3)」）：
   * module 已持有 → 「LV n/9」（本局该模块当前等级 / 上限，CFG.moduleLevel.maxLv）；
   * module 未持有 → 「新模块」；statPack → 「属性包」；locked → 红色锁定文案。
   * 图标一律汉字/ASCII：headless 与老机型无 emoji 字体会渲染成空方框（实机踩过）。 */
  _levelUpChip(c, owner, perHero) {
    const maxLv = (CFG.moduleLevel && CFG.moduleLevel.maxLv) || 9;
    if (c.kind === "module") {
      const ownedIdx = this._slotIndexOf(c);
      if (ownedIdx >= 0) {
        const slots = (owner.heroId && G.run && G.run.heroModules && G.run.heroModules[owner.heroId]) || [];
        const cur = slots[ownedIdx];
        const lv = (cur && cur.lv) || 1;
        return `<span class="lu-chip-in">LV ${lv}/${maxLv}</span>`;
      }
      return `<span class="lu-chip-in">新模块</span>`;
    }
    if (c.kind === "statPack") return `<span class="lu-chip-in">属性包</span>`;
    return `<span class="lu-chip-in">${c.kind || "?"}</span>`;
  },
  /* 刷新按钮（21.4 参考图底部「刷新 1/1」）：显示剩余次数，用尽/关闭 → 禁用/隐藏。 */
  _renderLevelUpRerollBtn() {
    const btn = document.getElementById("btn-lu-reroll");
    if (!btn) return;
    const per = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 0;
    const left = (G.run && typeof G.run.levelUpRerollsLeft === "number")
      ? G.run.levelUpRerollsLeft : per;
    const cnt = document.getElementById("lu-reroll-count");
    if (cnt) cnt.textContent = `${left}/${per}`;
    btn.classList.toggle("hidden", per <= 0);        // 配置 0 → 整个按钮不显示
    btn.disabled = left <= 0;
    btn.onclick = () => {
      if (typeof levelUpReroll === "function") levelUpReroll();
      else this.toast("刷新暂不可用", "bad");
    };
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
  /* 单屏紧凑渲染：10 关排进 390×844（2 列网格，每卡 3 行小字）。
   * 行为不变：遍历 CFG.levels，未解锁(idx >= unlockedLevels)显示 🔒、点击调 Game.enterCharSelect()。
   * 只改信息密度：卡片走「关卡名 / 目标+时限 / BOSS名」三行，去掉长句降低高度。 */
  buildLevelList() {
    const box = document.getElementById("level-list");
    if (!box) return;
    box.innerHTML = "";
    CFG.levels.forEach((lv, idx) => {
      const unlocked = idx < Meta.data.unlockedLevels;
      const card = document.createElement("div");
      card.className = "level-card" + (unlocked ? "" : " locked");
      // 关卡名取「第 N 关 · xxx」中的编号与地名两段，分两行排版更省宽度
      const shortName = String(lv.name || "").replace(/^第\s*(\d+)\s*关\s*·?\s*/, "");
      const no = String(lv.name || "").match(/第\s*(\d+)\s*关/);
      const bossName = (CFG.monsters[lv.boss] && CFG.monsters[lv.boss].name) || lv.boss;
      card.innerHTML = unlocked
        ? `<div class="lv-no">第 ${no ? no[1] : (idx + 1)} 关</div>
           <div class="lv-name">${shortName || lv.name}</div>
           <div class="lv-meta">🎯 ${lv.progressGoal} · ⏱ ${lv.timeLimit}s</div>
           <div class="lv-boss">BOSS ${bossName}</div>`
        : `<div class="lv-no">第 ${no ? no[1] : (idx + 1)} 关</div>
           <div class="lv-name">${shortName || lv.name}</div>
           <div class="lv-meta lock">🔒 通关前一关解锁</div>`;
      if (unlocked) card.onclick = () => { this.selectedLevel = lv; Game.enterCharSelect(); };
      box.appendChild(card);
    });
  },

  /* ---------- 英雄解锁 UI（方向3 · 全链路接入区块） ----------
   * isHeroUnlocked 的**唯一 UI 消费点**：选人 / 强化导师 / 武器匠三处共用本区块。
   * 规则文案按 CFG.unlockRules[id] 的**字段**生成（不硬编码英雄数量，防御式遍历 CFG.heroes）。 */
  // 英雄 id → 显示名（查不到回落 id，保证永不 undefined）
  heroName(heroId) {
    const h = CFG.heroes.find(x => x.id === heroId);
    return h ? h.name : heroId;
  },
  /* 未解锁英雄的条件短文案（供选人卡 / 导师·武器匠未解锁分组共用）：
   *   heroLv 条件（rule.heroLv）  → 「达成 <英雄名> 局外 LV<N> 解锁」
   *   结晶条件（rule.crystal）    → 「结晶 <N> 解锁」
   *   通关条件（rule.level / rule.stage）→ 「通关第 <N> 关解锁」
   *   多字段按 heroLv → crystal → level 优先级；无规则/无识别字段 → 「暂未解锁」。 */
  _unlockRuleText(id) {
    const rule = (CFG.unlockRules && CFG.unlockRules[id]) || null;
    if (rule) {
      if (rule.heroLv && typeof rule.heroLv.lv === "number") {
        return `达成 ${this.heroName(rule.heroLv.heroId)} 局外 LV${rule.heroLv.lv} 解锁`;
      }
      if (typeof rule.crystal === "number") return `结晶 ${rule.crystal} 解锁`;
      const lvN = (typeof rule.level === "number") ? rule.level : ((typeof rule.stage === "number") ? rule.stage : null);
      if (lvN !== null) return `通关第 ${lvN} 关解锁`;
    }
    return "暂未解锁";
  },
  /* 该英雄是否可花结晶主动解锁（unlockRules[id].crystal 型）→ 返回 { cost } 或 null。 */
  _unlockCost(id) {
    const rule = (CFG.unlockRules && CFG.unlockRules[id]) || null;
    return (rule && typeof rule.crystal === "number") ? { cost: rule.crystal } : null;
  },

  /* 英雄定位（19.2）：CFG.heroRoles.byHero[id] → 定位定义对象（含 name/color）；缺失返回 null。 */
  heroRole(heroId) {
    const HR = CFG.heroRoles;
    if (!HR || !HR.byHero) return null;
    const role = HR.byHero[heroId];     // byHero: heroId → 定位 key（output/defense/recovery）
    return role ? (HR[role] || null) : null;
  },

  /* ---------- 角色选择（只读展示；等级升级统一收敛到主城的强化导师 / 武器匠 NPC 面板） ----------
   * 20.x 重排：12 个英雄改「3 列 × 4 行」头像宫格（每格只放立绘 + 名字，不塞大段文字），
   *   下方固定高度详情区（#char-detail）承载当前选中英雄的角色/技能说明；底部按钮固定。
   *   → 一屏 390×844 内看完 12 角 + 说明，无需滑 6.5 屏。
   * 行为保持：多选组队（selectedChars 数组，上限 CFG.team.maxSize）语义不变；
   *   未解锁拦截、开始按钮禁用逻辑不变。仅「渲染部分」重写。 */
  buildCharList() {
    // 无 DOM 沙箱（Node 单测）防御：document 不存在时静默返回，不抛错。
    if (typeof document === "undefined" || !document.getElementById) return;
    this.selectedChars = this.selectedChars || [];
    const box = document.getElementById("char-list");
    if (!box) return;
    box.innerHTML = "";
    /* 21.6 展示顺序：输出/防御/治疗 ×4 轮循环（CFG.heroDisplayOrder）。
     * 只影响选人界面渲染顺序——CFG.heroes 物理顺序不动（heroes[i] 索引是全库隐性契约）。
     * 容错：表缺失/缺项时回退 CFG.heroes 原序。 */
    const dispIds = (typeof CFG.heroDisplayOrder === "object" && CFG.heroDisplayOrder && CFG.heroDisplayOrder.length)
      ? CFG.heroDisplayOrder : CFG.heroes.map(h => h.id);
    const ordered = dispIds.map(id => CFG.heroes.find(h => h.id === id)).filter(Boolean);
    if (ordered.length !== CFG.heroes.length) { ordered.length = 0; for (const h of CFG.heroes) ordered.push(h); }
    // 默认选中第 1 个「已解锁」英雄（用户要求：进入选人界面即默认选第 1 个角色）。
    //   仅在**真正进入选人界面**（G.state === "charSel"，由 Game.enterCharSelect 设置）且空选时补默认；
    //   跳过未解锁英雄；全未解锁 → 保持空选。直接裸调 buildCharList（如既有单测）不改选中态，保持旧行为。
    if (this.selectedChars.length === 0 && typeof G !== "undefined" && G && G.state === "charSel") {
      const firstUnlocked = ordered.find(h => Meta.isHeroUnlocked(h.id));
      if (firstUnlocked) this.selectedChars = [firstUnlocked];
    }
    for (const h of ordered) {
      // 解锁门槛（方向3）：未解锁英雄置灰 + 锁标 + 条件文案，且不可入选队
      const unlocked = Meta.isHeroUnlocked(h.id);
      const isSel = this.selectedChars.some(s => s.id === h.id);
      const card = document.createElement("div");
      card.className = "char-card" + (unlocked ? "" : " locked") + (isSel ? " selected" : "");
      // 定位徽章（19.2）：读 CFG.heroRoles.byHero[hero.id] → 定位定义（名称 + 配色）
      //   徽章保留在卡片 HTML 中（旧断言依赖 role-badge + 定位配色），但视觉上折进隐藏的 .char-badges。
      const role = this.heroRole(h.id);
      const roleBadge = role
        ? `<span class="role-badge" style="color:${role.color};border-color:${role.color}">${role.name}</span>`
        : "";
      // 未解锁：锁形标识 + 条件短文案（保留在卡内供旧断言读取，同时竖排锁标浮在立绘上）。
      const lockMsg = this._unlockRuleText(h.id);
      const lockLine = unlocked ? "" : `🔒 未解锁 · ${lockMsg}`;
      // 21.9：卡片显示真名（取消 ??? 打码——与详情区信息公开化口径一致；锁定感由
      // 🔒 锁标 + 置灰 + 剪影立绘表达；图鉴/皮肤系统的 ??? 是收集/皮肤语义，不受影响）
      card.innerHTML =
        `<div class="char-stage"><canvas class="char-face" width="128" height="128"></canvas>` +
        (unlocked ? "" : `<span class="char-lock">🔒</span>`) +
        `</div>` +
        `<div class="char-name">${h.name}</div>` +
        `<div class="char-badges">${h.id}${roleBadge}${lockLine}</div>`;
      const cv = card.querySelector(".char-face");
      if (cv) drawHeroPortrait(cv, heroPortraitKey(h), !unlocked, HERO_PORTRAIT_CARD_H);
      card.onclick = () => {
        // 未解锁 → 拦截：toast 解锁条件 + 详情区持续展示（21.6 用户要求：未解锁角色可选中查看解锁条件）
        if (!Meta.isHeroUnlocked(h.id)) {
          this.toast(`🔒 ${h.name} 未解锁：${this._unlockRuleText(h.id)}`, "bad");
          this.renderCharDetail(h);   // 21.9：详情区完整信息公开（真名+属性+技能+解锁条件+解锁按钮）
          return;
        }
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
        // 详情区同步当前「刚点选」的英雄（取消选中时回落到队首，仍显示信息不空窗）。
        this.renderCharDetail(idx < 0 ? h : (this.selectedChars[0] || null));
      };
      box.appendChild(card);
    }
    // 首次渲染后渲染详情区：显示默认选中英雄（无选中 → 空态提示）。
    this.renderCharDetail(this.selectedChars[0] || null);
    // 同步开始按钮态（默认选中 1 人 → 按钮应为可用，文案含人数）。
    const startBtn = document.getElementById("btn-char-start");
    if (startBtn) {
      startBtn.disabled = this.selectedChars.length === 0;
      startBtn.textContent = `开始游戏（${this.selectedChars.length}/${CFG.team.maxSize}）`;
    }
    const metaLine = document.getElementById("meta-line");
    if (metaLine) metaLine.innerHTML = `◆ 结晶 <b>${Meta.data.crystals}</b><small>　撤离/击杀获得 · 升级见主城「强化导师」</small>`;
  },

  /* 选人详情区渲染（用户明确要求：下方显示当前选中英雄的「技能说明 + 角色说明」）。
   * - 固定高度由 CSS 保证（切换选中只更新内容，不改总高度 → 无布局跳动）。
   * - hero 为空 → 空态提示；所有 DOM 访问判空，无 DOM 沙箱静默返回。 */
  renderCharDetail(hero) {
    if (typeof document === "undefined" || !document.getElementById) return;   // 无 DOM 沙箱防御
    const box = document.getElementById("char-detail");
    if (!box) return;
    if (!hero) {
      box.innerHTML = `<div class="cd-empty">点击上方头像选择出征英雄（最多 ${CFG.team.maxSize} 人）</div>`;
      return;
    }
    const h = hero;
    const role = this.heroRole(h.id);
    const roleBadge = role
      ? `<span class="role-badge" style="color:${role.color};border-color:${role.color}">${role.name}</span>`
      : "";
    /* 21.9：未解锁英雄**信息公开化**（用户要求：可查看技能信息、角色属性、解锁条件）——
     * 取消 21.6 防剧透打码：真名 + 简介 + LV1 基础属性 + LV1 技能描述全部可见；
     * 局外成长从解锁后才累积（未解锁展示 LV1 基准值，无成长加成）。
     * 解锁条件行独立可见（21.6）+ crystal 型「◆ N 解锁」按钮（21.8）保留。 */
    const unlocked = Meta.isHeroUnlocked(h.id);
    if (!unlocked) {
      const cost = this._unlockCost(h.id);
      const cur = (Meta.data && Meta.data.crystals) || 0;
      const canBuy = !!(cost && cur >= cost.cost);
      const ruleTxt = this._unlockRuleText(h.id);
      const unlockBtn = cost
        ? `<button id="btn-unlock-hero" class="cd-unlock-btn" type="button"${canBuy ? "" : " disabled"}>` +
          (canBuy ? `◆ ${cost.cost} 解锁` : `◆ ${cost.cost}（还差 ${cost.cost - cur}）`) + `</button>`
        : "";
      const wpn = CFG.weapons[h.weapon] || { name: "—", skills: {} };
      const skLine = this._skillSummary(wpn.skills.skill, 1);
      box.innerHTML =
        `<div class="cd-title"><span class="cd-name">${h.name}</span>` +
        `<span class="cd-id">${h.id}</span>${roleBadge}</div>` +
        `<div class="cd-unlock">🔒 未解锁 · ${ruleTxt}</div>` +
        unlockBtn +
        `<div class="cd-desc">${h.desc}</div>` +
        `<div class="cd-stats">HP ${h.hp} · 攻击 ${h.atk} · 防御 ${h.def} · 移速 ${h.spd}` +
        `<span class="cd-id">　（LV1 基础值 · 解锁后随局外等级成长）</span></div>` +
        `<div class="cd-skill">⚔ <b>${wpn.name}</b> · 技能 LV1（解锁后可升级）<br>${skLine}</div>` +
        `<div class="cd-desc">解锁后可编入队伍出战。${cost ? "点击上方按钮花结晶解锁" : (ruleTxt !== "暂未解锁" ? "达成条件后自动解锁" : "敬请期待后续版本")}</div>`;
      if (canBuy) {
        const btn = document.getElementById("btn-unlock-hero");
        btn.onclick = () => {
          if (Meta.unlockHero(h.id)) {
            this.toast(`🎉 已解锁 ${h.name}！`, "gold");   // 与导师 _doUnlockHero 同款 toast（gold 类）
            this.buildCharList();      // 列表卡片置灰/锁标刷新
            this.renderCharDetail(h);  // 详情区刷新为已解锁完整态
          } else {
            this.toast("解锁失败：结晶不足", "bad");
          }
        };
      }
      return;
    }
    const lv = Meta.heroLevel(h.id);
    const g = CFG.outLevel.growth, n = lv - 1;
    const skLv = Meta.weaponLv(h.id);   // 技能等级 = 武器等级
    const wpn = CFG.weapons[h.weapon] || { name: "—", skills: {} };
    const skLine = this._skillSummary(wpn.skills.skill, skLv);
    // 角色说明：名称 + 定位徽章 + 简介 + 局外等级 + 基础属性（含局外成长后的当前值）
    // 技能说明：武器名 + 技能等级 + 技能描述（_skillSummary）
    box.innerHTML =
      `<div class="cd-title"><span class="cd-name">${h.name}</span>` +
      `<span class="cd-id">${h.id}</span>${roleBadge}` +
      `<span class="cd-id">局外 LV${lv}${lv < CFG.outLevel.maxLevel ? "" : "（满级）"}</span></div>` +
      `<div class="cd-desc">${h.desc}</div>` +
      `<div class="cd-stats">HP ${h.hp + g.hp * n} · 攻击 ${h.atk + g.atk * n} · 防御 ${h.def + g.def * n} · 移速 ${h.spd}` +
      `<span class="cd-id">　（基础 HP ${h.hp} / 攻 ${h.atk} / 防 ${h.def}）</span></div>` +
      `<div class="cd-skill">⚔ <b>${wpn.name}</b> · 技能 LV${skLv}${skLv < CFG.weaponLevel.maxLv ? `（上限 ${CFG.weaponLevel.maxLv}）` : "（满级）"}<br>${skLine}</div>`;
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
};
