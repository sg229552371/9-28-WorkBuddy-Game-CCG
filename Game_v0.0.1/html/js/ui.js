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
  selectedChars: [],   // 多角色组队（1 ~ CFG.team.maxSize 人；扩容只改 CFG.team.maxSize 一处）
  selectedChestQ: null,
  drag: null,          // {item, fromInv, fromPending}
  hoverItem: null,
  _detailHeroId: null, // 选人详情区当前展示的英雄 id（供悬停预览去重，见 _previewCharDetail）

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
    this._bindSkillPanelBtn();   // 阶段 F：进战斗即接上技能面板入口（幂等）
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

  /* ---------- 通用选择弹窗（W2 · 能量水晶「启用」批次） ----------
   * 契约：UI.showChoice({ title, sub, options, onPick, onCancel })
   *   options 元素形态：{ id, name, desc, lines?:[..], color?, kindLabel?, foot?, locked? }
   *   玩家点第 i 项（未置灰）→ onPick(i)；点遮罩 → onCancel()。
   * 与升级弹窗**同款版式**（复用 .levelup-cards / .lu-v2 卡面），但**不共享状态机**：
   *   暂停闸门由调用方自行开合（本处只做 UI），故宠物雕像选择不会串到升级流程。
   * 返回值：true = 已打开；false = 无选项 / DOM 缺失（调用方走降级路径）。 */
  choiceOpen: false,
  showChoice(cfg) {
    const c = cfg || {};
    const opts = Array.isArray(c.options) ? c.options : [];
    if (!opts.length) return false;
    this._choiceOptions = opts;
    this._choiceOnPick = c.onPick || null;
    this._choiceOnCancel = c.onCancel || null;
    const ttl = document.getElementById("choice-title");
    if (ttl) ttl.textContent = c.title || "选择";
    const sub = document.getElementById("choice-sub");
    if (sub) sub.textContent = c.sub || "";
    this._renderChoice();
    const ov = document.getElementById("choice-overlay");
    if (!ov) return false;
    this._bindChoiceOverlay();
    ov.classList.remove("hidden");
    this.choiceOpen = true;
    return true;
  },
  /* 关闭（幂等）：清选项与回调，避免陈旧回调在下次打开时误触发。 */
  closeChoice() {
    const ov = document.getElementById("choice-overlay");
    if (ov) ov.classList.add("hidden");
    this.choiceOpen = false;
    this._choiceOptions = null;
    this._choiceOnPick = null;
    this._choiceOnCancel = null;
  },
  /* 遮罩点击 → 取消（只绑一次；幂等）。 */
  _bindChoiceOverlay() {
    if (this._choiceBound) return;
    const ov = document.getElementById("choice-overlay");
    if (!ov) return;
    this._choiceBound = true;
    ov.onclick = (e) => {
      if (!e || e.target !== ov) return;      // 只认「点在遮罩本身」，不误伤面板内点击
      const cb = this._choiceOnCancel;
      this.closeChoice();
      if (typeof cb === "function") cb();
    };
  },
  /* 选择卡渲染：版式与 _renderLevelUp 的 lu-v2 卡面一致；纯文本，无外部依赖。 */
  _renderChoice() {
    const box = document.getElementById("choice-cards");
    if (!box) return;
    box.innerHTML = "";
    const opts = this._choiceOptions || [];
    opts.forEach((o, i) => {
      const locked = !!o.locked;
      const card = document.createElement("div");
      card.className = "levelup-card lu-v2" + (locked ? " lu-locked" : "");
      const color = o.color || "#7aa0dc";
      const rows = Array.isArray(o.lines) ? o.lines : [];
      card.innerHTML =
        `<span class="lu-bar" style="background:${color}"></span>` +
        `<span class="lu-head" style="background:${color}">${o.name || o.id || ("选项" + (i + 1))}</span>` +
        `<span class="lu-kind">${o.kindLabel || ""}</span>` +
        `<div class="lu-icon"><span class="lu-ico" style="border-color:${color};color:${color};box-shadow:0 0 0 2px ${color}33, 0 4px 14px ${color}22">${String(o.name || "?").slice(0, 1)}</span></div>` +
        `<div class="lu-desc">${o.desc || ""}</div>` +
        (rows.length ? `<div class="lu-matrix">${rows.map(r => `<span class="lu-mx lu-mx-off">${r}</span>`).join("")}</div>` : "") +
        (o.foot ? `<div class="lu-sub">${o.foot}</div>` : "") +
        (locked ? `<div class="lu-lock">✕ 不可选</div>` : "");
      if (!locked) {
        card.onclick = () => {
          const cb = this._choiceOnPick;
          this.closeChoice();                    // 先关闭（防重复点击）
          if (typeof cb === "function") cb(i);
        };
      }
      box.appendChild(card);
    });
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
      if (recIdx < 0 || this._candRank(c) > this._candRank(list[recIdx])) recIdx = i;
    });
    list.forEach((c, i) => {
      const locked = !!c.locked;
      const card = document.createElement("div");
      card.className = "levelup-card lu-v2" + (locked ? " lu-locked" : "");
      if (i === recIdx) card.classList.add("lu-rec");
      const isCrystal = c.kind === "crystal";      // W2：能量水晶候选
      const kindLabel = c.kind === "module" ? "武器模块"
        : (c.kind === "statPack" ? "属性小包" : (isCrystal ? "能量水晶" : (c.kind || "")));
      /* 21.21 属性小包卡面：desc 显示「属性名 +N」（原实现只有 +N，看不出加的是什么属性）。
       * 属性名走 UI._statName（优先 CFG.statNames，缺失回落本地映射，config 未同步也不空白）。 */
      const packStat = c.stat || c.attr || "";
      const packStatName = this._statName(packStat);
      const packVal = (typeof c.value === "number") ? c.value : 0;
      const desc = c.kind === "statPack" ? `${packStatName} +${packVal}` : (c.desc || "");
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
      /* 属性小包：再补一行更明确的说明（小字）——「全队攻击提升 3 点」级别。
       * 注意：数值高亮（lu-num 正则）只作用于主 desc；本行做纯文本说明，不重复高亮。 */
      const subLine = (c.kind === "statPack")
        ? `<span class="lu-sub">全队${packStatName}提升 ${packVal} 点</span>` : "";
      /* W2 能量水晶卡面「辅助矩阵」：逐技能显示 生效 / 冲突 / 不适用。
       * 状态真源 = 编译器 explanations（`crystalMatrixOf` 里经 SupportCompiler.preview 产出），
       * 界面**不自行推断**「这颗水晶能不能作用到这个技能」（合同 §13）。 */
      let matrixLine = "";
      if (isCrystal && Array.isArray(c.matrix) && c.matrix.length) {
        const cells = c.matrix.map(m => {
          const cls = m.status === "applied" ? "ok" : (m.status === "conflict" ? "bad" : "off");
          const txt = m.status === "applied" ? "生效" : (m.status === "conflict" ? "冲突" : "不适用");
          return `<span class="lu-mx lu-mx-${cls}">${m.skillName} · ${txt}</span>`;
        }).join("");
        matrixLine = `<div class="lu-matrix">${cells}</div>`;
      }
      // 顶部彩色标题栏（21.4 参考图）：底色 = 归属英雄定位色（无归属 → 品质色 / 水晶品质色）
      const q = CFG.itemQualities && CFG.itemQualities[c.itemQ] ? CFG.itemQualities[c.itemQ] : null;
      const headColor = owner.color || (isCrystal && c.quality && c.quality.color) || (q ? q.color : "#7aa0dc");
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
        subLine +
        matrixLine +
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
    /* W2 能量水晶：立绘位用**水晶名首字**（程序化占位，与项目程序化美术基调一致） */
    else if (c.kind === "crystal") sym = String(c.name || "水").slice(0, 1);
    const color = (c.kind === "crystal" && c.quality && c.quality.color) || (q ? q.color : "#7aa0dc");
    return `<span class="lu-ico" style="border-color:${color};color:${color};box-shadow:0 0 0 2px ${color}33, 0 4px 14px ${color}22">${sym}</span>`;
  },
  /* 候选强度序（供「推荐」角标比较）：模块/属性包沿用 itemQ；能量水晶用品质 rank，
   * 同品质下**升级卡优先于新装卡**（升级是确定收益，新装还需占槽）。无数据 → 0。 */
  _candRank(c) {
    if (c && c.kind === "crystal") {
      const rank = (c.quality && typeof c.quality.rank === "number") ? c.quality.rank : 0;
      return rank * 10 + (c.isUpgrade ? 1 : 0);
    }
    return (c && c.itemQ) || 0;
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
    /* W2 能量水晶：升级 → 「品质 · Lv n/max」；新装 → 「品质 · 新水晶」（与模块同口径：占据共享 4 槽）。
     * 品质名放在胶囊里而**不是** `.lu-kind` —— 后者在 lu-v2 卡面被 CSS 隐藏（21.4 改版），写进去看不见。 */
    if (c.kind === "crystal") {
      const mx = (typeof c.maxLv === "number" && c.maxLv > 0) ? c.maxLv : 1;
      const qn = (c.quality && c.quality.name) ? c.quality.name + " · " : "";
      return `<span class="lu-chip-in">${qn}${c.isUpgrade ? "Lv " + (c.lv || 1) + "/" + mx : "新水晶"}</span>`;
    }
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
    const role = HR.byHero[heroId];     // byHero: heroId → 定位 key（output/defense/aux）
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
      /* C1-Q7：卡片追加 2 处纯元数据展示（不改选中/解锁语义，不进 selectedChars）——
       *   playtag   玩法风格标签（如「全队护罩」）；空串/字段缺失 → 不渲染该元素（防 undefined 漏字）
       *   difficulty 上手难度 1~5 → 字符星级（★☆）；非法/缺失 → 不渲染该元素 */
      const playtagEl = (typeof h.playtag === "string" && h.playtag)
        ? `<span class="hero-playtag">${h.playtag}</span>` : "";
      const diffStars = this._diffStars(h.difficulty);
      const diffEl = diffStars ? `<span class="hero-diff">${diffStars}</span>` : "";
      // 21.9：卡片显示真名（取消 ??? 打码——与详情区信息公开化口径一致；锁定感由
      // 🔒 锁标 + 置灰 + 剪影立绘表达；图鉴/皮肤系统的 ??? 是收集/皮肤语义，不受影响）
      card.innerHTML =
        `<div class="char-stage"><canvas class="char-face" width="128" height="128"></canvas>` +
        (unlocked ? "" : `<span class="char-lock">🔒</span>`) +
        `</div>` +
        `<div class="char-name">${h.name}</div>` +
        playtagEl + diffEl +
        `<div class="char-badges">${h.id}${roleBadge}${lockLine}</div>`;
      const cv = card.querySelector(".char-face");
      if (cv) drawHeroPortrait(cv, heroPortraitKey(h), !unlocked, HERO_PORTRAIT_CARD_H);
      /* PC 端悬停预览（26.x 用户需求）：鼠标移到卡片上即把下方详情区切到该英雄，
       * 无需先点击 → 便于快速浏览角色内容。点击语义完全不变（点击 = 选出战 / 取消）。
       * 触屏不产生 mouseenter，移动端行为与旧版一致。 */
      card.onmouseenter = () => { this._previewCharDetail(h); };
      card.onclick = () => {
        // 未解锁 → 拦截：toast 解锁条件 + 详情区持续展示（21.6 用户要求：未解锁角色可选中查看解锁条件）
        if (!Meta.isHeroUnlocked(h.id)) {
          this.toast(`🔒 ${h.name} 未解锁：${this._unlockRuleText(h.id)}`, "bad");
          this.renderCharDetail(h);   // 21.9：详情区完整信息公开（真名+属性+技能+解锁条件+解锁按钮）
          return;
        }
        // 多角色组队：点击选中/取消，上限 CFG.team.maxSize
        const idx = this.selectedChars.findIndex(s => s.id === h.id);
        if (idx >= 0) {
          this.selectedChars.splice(idx, 1);
          card.classList.remove("selected");
        } else if (this.selectedChars.length >= CFG.team.maxSize) {
          // ⚠️ 满员：不入队，但**详情照样切到该英雄**（26.x 体验修复）。
          //    旧版在此直接 return，连「渲染详情」也一起跳过 → 满员后点任何角色都没反应，像「点不动」。
          this.toast(`队伍已满（${this.selectedChars.length}/${CFG.team.maxSize}）· 再点一名队员可移出`, "bad");
          this.renderCharDetail(h);
          return;
        } else {
          this.selectedChars.push(h);
          card.classList.add("selected");
        }
        // 同步开始按钮（人数 + 禁用态）
        const startBtn = document.getElementById("btn-char-start");
        if (startBtn) {
          startBtn.disabled = this.selectedChars.length === 0;
          startBtn.textContent = `开始游戏（${this.selectedChars.length}/${CFG.team.maxSize}）`;
        }
        // 详情区同步当前「刚点选」的英雄（取消选中时回落到队首，仍显示信息不空窗；25.x 语义不变）。
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

  /* 悬停预览（26.x 用户需求）：鼠标移入角色卡 → 详情区切到该英雄，不必点击。
   * 语义边界：**不改 selectedChars**（出战选择仍只由点击决定），只切详情区内容。
   * 取舍：**不回落** —— 悬停后详情保持在最后浏览的英雄上，方便从容阅读；
   *       点击卡片时仍按既有逻辑把详情同步到所点英雄（见 buildCharList 的 card.onclick）。
   * 去重：与当前详情同一英雄则不重绘（防高频 mouseenter 造成无谓闪烁）。
   * hero 为空 → 回落「已选中队首」。无 DOM 沙箱时 renderCharDetail 静默返回。 */
  _previewCharDetail(hero) {
    const target = hero || this.selectedChars[0] || null;
    if ((target ? target.id : null) === this._detailHeroId) return;
    this.renderCharDetail(target);
  },

  /* 选人详情区渲染（用户明确要求：下方显示当前选中英雄的「技能说明 + 角色说明」）。
   * - 固定高度由 CSS 保证（切换选中只更新内容，不改总高度 → 无布局跳动）。
   * - hero 为空 → 空态提示；所有 DOM 访问判空，无 DOM 沙箱静默返回。 */
  renderCharDetail(hero) {
    this._detailHeroId = hero ? hero.id : null;   // 供悬停预览去重（无 DOM 沙箱下也保持同步）
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
        `<span class="cd-id">　力量 ${h.str || 0} / 敏捷 ${h.agi || 0} / 智力 ${h.int || 0}</span>` +
        `<span class="cd-id">　（LV1 基础值 · 解锁后随局外等级成长）</span></div>` +
        this._statBiasHtml(h) +
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
      `<span class="cd-id">　力量 ${h.str || 0} / 敏捷 ${h.agi || 0} / 智力 ${h.int || 0}</span>` +
      `<span class="cd-id">　（基础 HP ${h.hp} / 攻 ${h.atk} / 防 ${h.def}）</span></div>` +
      this._statBiasHtml(h) +
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
      return `${e.name}：${eff} · 冷却 ${e.cd}s · 受词条影响：${tags}`;
    }
    const dmg = Math.round(e.dmgMul * 100);
    return `${e.name}：伤害 ${dmg}% 攻击 · 冷却 ${e.cd}s · 爆炸半径 ${e.radius || 0} · 受词条影响：${tags}`;
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
  _crystalCache: {},       // W2：能量水晶态缓存 heroId -> { gv, mode }（按 groupVersion 失效）

  /* ---------- 能量水晶态（W2 · 能量水晶系统「启用」批次） ----------
   * 仅在**该英雄走新路径**（`SkillRuntime.ownsHero`）+ 挂有 `skillState` 时返回数据；
   * 未通电（正式默认 `CFG.skillSystem.enabled = false`）→ **恒返回 null**
   *   → 技能栏与详情浮窗完全走旧的「武器模块」渲染，**与接入前逐字一致（零影响）**。
   * 数据**一律来自 `SkillPresenter`**（合同 §13：UI 禁止自行判定「能不能用」）。
   * 性能：按 (heroId, groupVersion) 缓存编译结果 —— 装配/升级会 bump groupVersion → 自动失效。
   * 返回：{ state, build, panel, skills }（skills = 已按「初始技能在左、稀有技能在右」排好序）。 */
  _crystalModeOf(member) {
    const id = member && member.id;
    if (!id) return null;
    const rt = member.rt || null;
    /* ⚠️ 顺序要紧：`SkillRuntime.ownsHero` 是**懒注入入口**（首次调用会给英雄补 skillState）。
     * 必须先问它、再查 skillState —— 反过来写，第一帧渲染时 skillState 还没挂，
     * 会把新路径英雄误判成旧路径（技能栏闪一下才对，且技能详情取不到）。 */
    if (typeof SkillRuntime === "undefined" || !SkillRuntime ||
        typeof SkillRuntime.ownsHero !== "function") return null;
    try { if (!SkillRuntime.ownsHero(rt || { id: id })) return null; } catch (e) { return null; }
    const st = (rt && rt.skillState) || (member.heroDef && member.heroDef.skillState) || null;
    if (!st || !st.builds) return null;
    if (typeof SkillPresenter === "undefined" || !SkillPresenter || typeof SkillPresenter.panel !== "function") return null;
    const cached = this._crystalCache[id];
    if (cached && cached.gv === st.groupVersion) return cached.mode;
    let mode = null;
    try {
      const build = SkillPresenter.compile(st, id);
      if (build) {
        const panel = SkillPresenter.panel(st, id, build);
        mode = { state: st, build: build, panel: panel, skills: this._crystalSkillOrder(id, panel) };
      }
    } catch (e) { mode = null; }
    if (mode) this._crystalCache[id] = { gv: st.groupVersion, mode: mode };
    return mode;
  },
  /* 技能显示顺序：初始技能在左（A）、稀有技能在右（A）。
   * 真源 = `CFG.skillSystem.initialSkillBindings[heroId].skillId`（武器绑定的初始主动技能）；
   * 未登记英雄 → 按技能 ID 规范排序（结果稳定，不随插入顺序变化）。 */
  _crystalSkillOrder(heroId, panel) {
    const list = (panel && panel.skills) ? panel.skills.slice() : [];
    const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null;
    const b = t && t.initialSkillBindings && t.initialSkillBindings[heroId];
    const initId = (b && b.skillId) || null;
    list.sort((a, c) => {
      if (initId) {
        if (a.skillId === initId) return -1;
        if (c.skillId === initId) return 1;
      }
      return String(a.skillId).localeCompare(String(c.skillId));
    });
    return list;
  },
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
  /* 技能图标元素（19.12 版式）：svg 冷却环 + 技能首字 + 冷却秒数。
   * W2 抽出为公共构造器 —— 能量水晶路径需要**两个**同款图标（初始技能 + 稀有技能）。
   * 未通电路径输出与抽取前逐字一致（class 恒为 "ps-icon ready"）。 */
  _buildPsIconEl(name, idx) {
    const icon = document.createElement("div");
    icon.className = "ps-icon ready";
    if (idx != null) icon.dataset.skillIdx = String(idx);
    icon.innerHTML = `<svg viewBox="0 0 80 80"><circle class="ps-track" cx="40" cy="40" r="34"/><circle class="ps-arc" cx="40" cy="40" r="34"/></svg>
      <span class="ps-glyph">${(name || "技").slice(0, 1)}</span>
      <span class="ps-cd"></span>`;
    return icon;
  },
  /* 单条技能条的结构（英雄标识 + 技能图标/冷却环 + 4 槽）。只在队伍变化时建。
   * W2：走能量水晶路径的英雄（`cm` 非空）渲染 **A X X X X A**（技能—水晶×4—技能，用户 2026-10 拍板），
   *      未通电（cm = null）逐字走旧「武器模块」结构 [图标][名字][4 槽]，零影响（测试 42 处 `.ps-slot` 依赖安全）。 */
  _buildPartyRow(member) {
    const cm = this._crystalModeOf(member);      // 能量水晶态（未通电 → null）
    const role = this.heroRole(member.id) || {};
    const heroDef = member.heroDef || (CFG.heroes || []).find(h => h.id === member.id) || {};
    const weapon = CFG.weapons[heroDef.weapon] || {};
    const skillId = weapon.skills && weapon.skills.skill;
    const skillDef = (typeof CFG.skills === "object" && skillId) ? CFG.skills[skillId] : null;
    const skillName = (skillDef && skillDef.name) || weapon.name || "技能";
    // 新路径：首图标名以**编译后的技能实例**为准（初始技能），旧路径沿用武器技能名
    const headName = (cm && cm.skills[0] && (cm.skills[0].name || cm.skills[0].skillId)) || skillName;
    const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const row = document.createElement("div");
    row.className = "ps-row" + (cm ? " crystal-row" : "");
    row.dataset.heroId = member.id;
    // 技能图标：svg 冷却环 + 技能首字 + 冷却秒数
    const icon = this._buildPsIconEl(headName, 0);
    // 英雄名 + 定位色
    const info = document.createElement("div");
    info.className = "ps-info";
    info.innerHTML = `<b class="ps-name" style="color:${role.color || "#cfe0ff"}">${member.name || member.id}</b>
      <small class="ps-role" style="color:${role.color || "#9fb4cc"}">${role.name || ""}</small>
      <small class="ps-skill" title="主动技能">${headName || "技能"}</small>`;
    // 槽位 ×4（外层恒为 `.ps-slot`，新路径额外带 `crystal-slot` 类 → 兼容既有测试与样式）
    const slotsBox = document.createElement("div");
    slotsBox.className = "ps-slots" + (cm ? " crystal-slots" : "");
    const slots = [];
    for (let i = 0; i < per; i++) {
      const el = document.createElement("div");
      el.className = "ps-slot ps-slot-empty";
      el.dataset.idx = i;
      slotsBox.appendChild(el);
      slots.push({ el, sig: "\u0000" });   // 初始签名保证首帧写入
    }
    /* 排布
     *  · 旧路径（cm = null）：[图标][英雄名][4 槽] —— **逐字沿用 19.12 结构**
     *    （endless_hud_test 七2/七3 依赖 children[0]=ps-icon、children[1]=ps-info）。
     *  · 新路径（cm 非空）：[英雄名][技能 A][4 水晶 X][技能 A] ——
     *    用户 2026-10 拍板「A X X X X A」（A=技能，X=水晶）；英雄标识独占最左，
     *    使「技能—水晶—技能」簇整体相邻、不被名字块切开。 */
    const icons = [icon];
    if (cm) {
      row.appendChild(info);
      row.appendChild(icon);
      row.appendChild(slotsBox);
      /* 第二个技能图标（稀有技能）：仅当确有两个技能时追加 → 形成 A X X X X A；
       * 只有 1 个技能时保持 A X X X X，不补空壳（避免误导玩家「还有一个技能没解锁」）。 */
      if (cm.skills.length > 1) {
        const s2 = cm.skills[1];
        const icon2 = this._buildPsIconEl(s2.name || s2.skillId, 1);
        row.appendChild(icon2);
        icons.push(icon2);
      }
    } else {
      row.appendChild(icon);
      row.appendChild(info);
      row.appendChild(slotsBox);
    }
    return { row, icon, arc: icon.querySelector(".ps-arc"), glyph: icon.querySelector(".ps-glyph"),
      cdTxt: icon.querySelector(".ps-cd"), slots, skillName, skillDef, member,
      crystal: cm,
      crystalIcons: icons,
      crystalArcs: icons.map(el => el.querySelector(".ps-arc")),
      crystalCds: icons.map(el => el.querySelector(".ps-cd")) };
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
  /* 槽位内容更新（按签名比对，内容没变不碰 DOM）。
   * W2：每次先重解一次能量水晶态（`_crystalModeOf` 有 groupVersion 缓存 → 近乎零成本），
   *      新路径英雄走 `_updateCrystalSlots`，旧路径逐字走武器模块渲染。 */
  _updatePartySlots(entry, member) {
    const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
    const cm = this._crystalModeOf(member);       // 缓存命中 = 直接返回；失效 = 重编译
    entry.crystal = cm;                           // 供点击浮窗读最新态
    if (cm) { this._updateCrystalSlots(entry, member, cm, per); return; }
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
      s.crystalId = null;
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
  /* 能量水晶槽渲染（W2）：4 槽展示装配的**能量水晶**（名 + 品质色边 + 等级）。
   * 数据源 = `SkillPresenter.panel().slots`（UI 禁止自行判定装配是否合法，合同 §13）。
   * 槽数据同时写入 `entry.slots[i]`（含 crystalId），供点击浮窗复用同一条命中链。 */
  _updateCrystalSlots(entry, member, cm, per) {
    const maxLvOf = (cid) => {
      const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
      const cd = t && t.crystalDefs && t.crystalDefs[cid];
      return (cd && Array.isArray(cd.levels)) ? cd.levels.length : 1;
    };
    const arr = (cm.panel && cm.panel.slots) ? cm.panel.slots : [];
    for (let i = 0; i < per; i++) {
      const s = entry.slots[i];
      if (!s) continue;
      const slotData = arr.find(x => x && x.slot === i) || null;
      const cid = slotData && slotData.crystalId;
      const lv = cid ? (slotData.level || 1) : 0;
      const sig = cid ? ("cr:" + cid + ":" + lv) : "empty";
      if (s.sig === sig) continue;              // 无变化：跳过 DOM 写入
      s.sig = sig;
      // 记录槽数据（点击浮窗同一条链读取；key 与旧路径共用 idx）
      s.crystalId = cid || null;
      s.defId = null;
      s.lv = lv;
      s.idx = i;
      s.heroId = member.id;
      s.heroName = member.name || member.id;
      if (!cid) {
        s.el.className = "ps-slot crystal-slot ps-slot-empty";
        s.el.innerHTML = `<span class="ps-slot-no">${i + 1}</span>`;
        s.el.style.borderColor = "";
        s.el.title = "空水晶槽 · 升级可选择能量水晶填入";
      } else {
        const name = slotData.name || cid;
        const q = slotData.quality;
        const color = (q && q.color) || "#b8c4d4";
        const qName = (q && q.name) || "";
        const maxLv = maxLvOf(cid);
        s.el.className = "ps-slot crystal-slot ps-slot-filled";
        s.el.style.borderColor = color;
        s.el.innerHTML = `<span class="ps-slot-nm" style="color:${color}">${name}</span>
          <span class="ps-slot-lv">Lv${lv}/${maxLv}</span>`;
        s.el.title = `${name}${qName ? " · " + qName : ""} Lv${lv}/${maxLv}（点击查看作用目标与代价）`;
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
    if (s && s.crystalId) this.showCrystalSlotTip(s, slotEl, entry);
    else if (s && s.defId) this.showModuleSlotTip(s, slotEl);
    else this.showModuleSlotEmptyTip(slotEl);
  },
  /* 能量水晶详情浮窗（W2）：文案**全部来自 `SkillPresenter.detail()`**（合同 §13 —— UI 不自行判定）。
   * detail().text 是「标题 + 装配规则 + 代价 + 两技能收益 + 限制 + 冲突 + 不适用原因」的换行拼串，
   * 首行与浮窗标题重复 → 跳过第 1 行。Presenter 缺失/抛错时降级为一行占位，不阻断交互。 */
  showCrystalSlotTip(s, slotEl, entry) {
    const tip = document.getElementById("module-tip");
    if (!tip) return;
    const cid = s.crystalId;
    const cm = (entry && entry.crystal) || null;
    let name = cid, qName = "", color = "#b8c4d4";
    const slotData = (cm && cm.panel && cm.panel.slots)
      ? cm.panel.slots.find(x => x && x.slot === (s.idx || 0)) : null;
    if (slotData) {
      name = slotData.name || cid;
      if (slotData.quality && typeof slotData.quality === "object") {
        qName = slotData.quality.name || "";
        color = slotData.quality.color || color;
      }
    }
    const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
    const cdef = t && t.crystalDefs && t.crystalDefs[cid];
    const maxLv = (cdef && Array.isArray(cdef.levels)) ? cdef.levels.length : 1;
    let lines = [];
    try {
      if (cm && typeof SkillPresenter !== "undefined" && SkillPresenter && typeof SkillPresenter.detail === "function") {
        const d = SkillPresenter.detail(cid, s.heroId, cm.build);
        lines = String((d && d.text) || "").split("\n").filter(Boolean);
      }
    } catch (e) { lines = []; }
    if (lines.length > 1) lines = lines.slice(1);        // 首行 = 标题（与 head 重复）
    if (!lines.length) lines = ["（暂无能量水晶详情数据）"];
    const rows = lines.map(txt => `<div class="mt-row">${txt}</div>`).join("");
    tip.innerHTML = `<div class="mt-head"><b style="color:${color}">${name}</b>
      <span style="color:${color}">${qName ? qName + " · " : ""}Lv ${s.lv || 1}/${maxLv}</span></div>
      <div class="mt-rows mt-crystal">${rows}</div>
      <div class="mt-foot">归属：${s.heroName || s.heroId || ""} · 第 ${(s.idx || 0) + 1} 槽 · 能量水晶（两技能共享四槽）</div>`;
    tip.dataset.heroId = s.heroId || "";
    tip.dataset.idx = String(s.idx || 0);
    tip.dataset.crystal = cid || "";
    this._positionModuleTip(tip, slotEl);
    tip.classList.remove("hidden");
    this._moduleTipOpen = true;
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
   * 剩余秒优先读运行时实体 rt.skillTimer（队长 = G.player，队友 = companion）。
   * W2：走能量水晶路径的英雄改读**每个技能实例的独立冷却**（`skillState.skills[id].cdLeft`，
   *     由 `SkillScheduler` 每帧递减；两技能互不阻塞 → 两个环各自独立）。 */
  _updatePartyCd(entry) {
    if (entry.crystal && entry.crystalIcons && entry.crystalIcons.length) {
      this._updateCrystalCd(entry, entry.crystal);
      return;
    }
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
  /* 能量水晶路径的冷却环：逐技能独立（初始技能 / 稀有技能各一环）。 */
  _updateCrystalCd(entry, cm) {
    for (let i = 0; i < entry.crystalIcons.length; i++) {
      const icon = entry.crystalIcons[i];
      const sk = cm.skills[i];
      if (!icon || !sk) continue;
      const info = this._crystalSkillCd(cm, sk);
      const ready = info.remain <= 0 || !(info.total > 0);
      const arc = entry.crystalArcs[i];
      if (arc) arc.style.strokeDashoffset = ready ? "0" : (213.6 * (info.remain / info.total)).toFixed(1);
      icon.classList.toggle("ready", ready);
      const cdTxt = entry.crystalCds[i];
      if (cdTxt) cdTxt.textContent = ready ? "" : info.remain.toFixed(1) + "s";
    }
  },
  /* 单技能冷却读数（剩余 / 总长）。剩余取自技能实例 `cdLeft`（真实运行时值）；
   * 总长优先 `SkillScheduler.intervalFor`（与调度器同源，含环绕类 max(冷却,持续) 口径），
   * 取不到时回落面板 `cd`。任何异常都降级为「就绪」，不阻断渲染。 */
  _crystalSkillCd(cm, sk) {
    const sid = sk && sk.skillId;
    const inst = (cm.state && cm.state.skills && cm.state.skills[sid]) || null;
    const remain = (inst && typeof inst.cdLeft === "number") ? Math.max(0, inst.cdLeft) : 0;
    let total = 0;
    try {
      const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
      const def = (t && t.skillDefs && t.skillDefs[sid]) || null;
      if (def && typeof SkillScheduler !== "undefined" && SkillScheduler
          && typeof SkillScheduler.intervalFor === "function") {
        const hs = cm.state || {};
        const b = hs.builds && hs.builds[sid];
        const cp = (b && b.castPolicyId && t.castPolicies && t.castPolicies[b.castPolicyId]) || null;
        total = SkillScheduler.intervalFor(def, (inst && inst.level) || 1, {}, cp) || 0;
      }
    } catch (e) { total = 0; }
    if (!(total > 0)) total = (sk && sk.cd) || 0;
    return { remain: remain, total: total };
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
    this.clearAbyssHud();       // 21.21 离开战斗：复位深渊 HUD 态，防 abyss-mode 残留到主城
    const bar = document.getElementById("party-skillbar");
    if (bar) bar.innerHTML = "";
    this.hideModuleTip();       // 20.3：顺带关掉模块槽词条浮窗（防残留）
    this._psCache = null;
    this._psSig = null;
    this._psSlotSig = {};
    this._crystalCache = {};    // W2：能量水晶态缓存一并复位（下次进战斗按新态重编译）
  },

  updateHUD() {
    this.updateAbyssHud();   // 21.21 深渊局内 HUD：abyss-mode 类 + 经验条（非深渊自动降级，空值保护）
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
    this._bindSkillPanelBtn();   // 阶段 F：技能面板入口按钮绑定（幂等，成本可忽略）
    // 进度条（26.x 统一战斗 UI：深渊与主线共用同一条，只换文案与数据源）
    const lv = G.levelCfg;
    const pf = document.getElementById("progress-fill");
    const pt = document.getElementById("progress-txt");
    if (r.bossDefeated && !G.inEndless) { pf.style.width = "100%"; pt.textContent = "已出现撤离点雕像 · 站进雕像圈内自动读条 8 秒撤离"; }
    else if (r.bossSpawned) { pf.style.width = "100%"; pt.textContent = "BOSS 战斗中"; }
    else if (G.inEndless) {
      // 深渊：推进量 = 击杀 + 时间×权重，阈值 = 下一只 BOSS（复用 Endless 同一套数据，不另算一份）
      let prog = r.kills, thr = 0;
      try {
        if (typeof Endless !== "undefined" && Endless) {
          if (typeof Endless.progress === "function") prog = Endless.progress();
          const bi = (Endless.state && typeof Endless.state.bossIndex === "number") ? Endless.state.bossIndex : 0;
          if (typeof Endless.bossThreshold === "function") thr = Endless.bossThreshold(bi);
        }
      } catch (e) { }
      if (!(thr > 0)) thr = (CFG.endless && CFG.endless.bossProgressBase) || 1;
      pf.style.width = Math.min(100, Math.max(0, prog / thr * 100)) + "%";
      pt.textContent = `深渊推进 ${Math.floor(prog)}/${thr}（${Math.floor(r.runTime)}s）`;
    }
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
    // 🔴 属性卡牌资产 HUD 提示已随 C6「彻底退役」物理删除（D018）。
    // 读条圈已改为进度环直接绑定在雕像/信标上（圈内积累、离开衰退）
    document.getElementById("channel-wrap").classList.add("hidden");
    // 中央提示（撤离点存在提示）
    const hint = document.getElementById("hint-center");
    if (G.mainWorld.altars.some(a => a.id === "ALTAR_005")) {
      hint.textContent = "工匠雕像在地图上，可进入工匠世界开箱 / 用卡（进入后雕像消失，新雕像会再出现）";
    } else hint.textContent = "";
  },
};

/* ============================================================================
 * 21.21 独立区块：属性小包卡面属性名 + 深渊（无尽）局内 HUD 补齐
 * ----------------------------------------------------------------------------
 * 背景（用户拍板）：
 *   ① 升级 4 选 1 的「属性包」卡面原来只显示「+3」，看不出加的是哪条属性；
 *   ② 深渊（无尽）局内 HUD 需要 经验条（等级 + 进度）、逐英雄武器技能栏，
 *      且**深渊不显示自动战斗按钮**（用户原话）。
 *
 * 设计要点：
 *   · `_statName(stat)`：属性键 → 中文名。优先读 CFG.statNames（另一路可能新增），
 *     缺失时回落内置映射（保证 CFG 未同步也不空白）。空值保护。
 *   · **26.x 统一战斗 UI（用户要求）**：深渊复用与主线**完全相同**的战斗布局
 *    （#hud-top 击杀/推进条 + #hud-tr 等级·货币·经验 + 底部全队技能栏），
 *     数据同源 G.run、updateHUD 每帧照常写入；只隐藏深渊用不到的自动战斗按钮（CSS .abyss-mode）。
 *     原 21.21 的独立 #abyss-hud 经验条已移除（与 #hud-tr 完全重复）。
 *   · 逐英雄武器技能栏**复用既有 #party-skillbar**（renderPartySkillbar，随 updateHUD 每帧刷新），
 *     不重复造结构；本区块不重建技能栏。
 *   · 位置：右上（与主线 #hud-tr 同区），不遮挡 canvas 绘制的深渊波次/BOSS 面板（左上）。
 *
 * 安全约束：G / G.run / DOM 任一缺失都安全跳过，绝不抛错（headless 空值调用必需）。
 * ========================================================================== */
Object.assign(UI, {
  /* 属性键 → 中文属性名。优先 CFG.statNames（另一路 agent 新增），缺失回落本地映射。 */
  _statName(stat) {
    const key = (typeof stat === "string" && stat) ? stat : "";
    const FALLBACK = { atk: "攻击", hp: "生命", hpMax: "生命", def: "防御", spd: "速度" };
    let name = "";
    try {
      if (typeof CFG !== "undefined" && CFG && CFG.statNames && key && CFG.statNames[key]) name = CFG.statNames[key];
    } catch (e) { name = ""; }
    if (!name) name = FALLBACK[key] || (key ? key : "属性");
    return name;
  },

  /* C1-Q7：难度档 1~5 → 字符星级（实心★ + 空心☆，满 5 星，如 ★★★☆☆）。
   * 非法输入 / 字段缺失（非 1~5 整数）→ 返回 ""，调用方据此不渲染该元素（防 undefined 漏字）。 */
  _diffStars(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    const k = Math.round(n);
    if (k < 1 || k > 5) return "";
    return "★".repeat(k) + "☆".repeat(5 - k);
  },

  /* C1-Q7：详情区「属性倾向」区块 HTML（优势 statBias.high / 短板 statBias.low）。
   * 键 → 中文名统一走 _statName（优先 CFG.statNames，查不到回落键名本身，不抛错）。
   * statBias 缺失、非对象、或 high/low 皆空 → 返回 ""（整块不渲染）。 */
  _statBiasHtml(h) {
    const b = (h && typeof h.statBias === "object") ? h.statBias : null;
    if (!b) return "";
    const hi = Array.isArray(b.high) ? b.high : [];
    const lo = Array.isArray(b.low) ? b.low : [];
    if (!hi.length && !lo.length) return "";
    const tags = (keys, cls) => keys.map(k => `<span class="${cls}">${this._statName(k)}</span>`).join("");
    const hiRow = hi.length ? `<div class="cd-bias-row"><span class="cd-bias-label">优势</span>${tags(hi, "cd-bias-high")}</div>` : "";
    const loRow = lo.length ? `<div class="cd-bias-row"><span class="cd-bias-label">短板</span>${tags(lo, "cd-bias-low")}</div>` : "";
    return `<div class="cd-bias">${hiRow}${loRow}</div>`;
  },

  /* 「属性说明」弹窗内容（HTML 字符串，26.x 优化排版后仅供右上角 ? 弹窗使用；
   * 角色详情面板已不再内嵌此区块——说明统一收进 ? 按钮，避免同一屏两份相同文案）。
   * 结构：标题行 + 逐条「属性名（高亮）+ 量纲（弱化）+ 说明（正文换行）」，虚线分隔。
   * 文案取自 CFG.statDesc；缺失时回落 CFG.statNames 的名称 + 「暂无说明」（不空白、不抛错）。 */
  _statHelpHtml(keys) {
    const list = Array.isArray(keys) && keys.length ? keys : ["atk", "def", "hp", "spd"];
    const rows = [];
    for (const k of list) {
      let d = null;
      try { if (typeof CFG !== "undefined" && CFG.statDesc) d = CFG.statDesc[k] || null; } catch (e) { d = null; }
      const name = (d && d.name) ? d.name : this._statName(k);
      const unit = (d && d.unit) ? `（${d.unit}）` : "";
      const desc = (d && d.desc) ? d.desc : "暂无说明";
      rows.push(`<div class="sht-row"><span class="sht-name">${name}</span>` +
        `<span class="sht-unit">${unit}</span>` +
        `<span class="sht-desc">${desc}</span></div>`);
    }
    return `<div class="sht-head">📖 属性说明</div>${rows.join("")}`;
  },

  /* 角色选择右上角「属性说明」图标 → tips 弹窗（26.x，用户要求）。
   * 内容 = CFG.statDesc 全量属性说明（复用 _statHelpHtml，同一数据源、不会两套文案）。
   * 幂等：再点一次关闭；元素缺失安全跳过。 */
  toggleStatHelp() {
    if (typeof document === "undefined" || !document.getElementById) return;
    const tip = document.getElementById("stat-help-tip");
    if (!tip || !tip.classList) return;
    if (!tip.classList.contains("hidden")) { tip.classList.add("hidden"); return; }
    let keys = ["atk", "def", "hp", "spd"];
    try { if (typeof CFG !== "undefined" && CFG.statDesc) keys = Object.keys(CFG.statDesc); } catch (e) { }
    tip.innerHTML = this._statHelpHtml(keys);
    tip.classList.remove("hidden");
  },

  /* 深渊局内 HUD 刷新（每帧，由 updateHUD 单行调用）—— 26.x 已统一：
   * 深渊**复用与主线完全相同的战斗 UI**（#hud-top 击杀/推进条 + #hud-tr 等级·货币·经验，
   * 数据同为 G.run，updateHUD 每帧照常写入），本函数只负责挂/摘 .abyss-mode 类
   * （CSS 据此隐藏深渊用不到的自动战斗按钮），不再维护独立的 #abyss-hud 经验条。
   * 口径：战斗 UI 高度统一，只允许功能级的新增/隐藏，布局不动。 */
  updateAbyssHud() {
    if (typeof document === "undefined" || !document.getElementById) return;
    const inEndless = !!(typeof G !== "undefined" && G && G.inEndless);
    const hud = document.getElementById("hud");
    if (hud && hud.classList) hud.classList.toggle("abyss-mode", inEndless);
  },

  /* 离开深渊 / 战斗结束：复位 abyss-mode（幂等；元素缺失安全，不抛错）。 */
  clearAbyssHud() {
    if (typeof document === "undefined" || !document.getElementById) return;
    const hud = document.getElementById("hud");
    if (hud && hud.classList) hud.classList.remove("abyss-mode");
  },
});

/* ============================================================================
 * 阶段 F 独立区块：技能面板（主动可打开的总览页）
 * ----------------------------------------------------------------------------
 * 【缺口】屏 1~屏 4 已就绪（升级 4 选 1 / 战斗技能栏 / 悬浮详情 / 稀有技能弹窗），
 *   但玩家**无法主动查看**当前装配全貌。本区块补一个 overlay：
 *     两技能区 + 4 共享水晶槽区 + 辅助矩阵区 + 点槽详情 + 汇总标签/诊断。
 *
 * 【数据真源 = SkillPresenter（合同 §13）】
 *   · panel(state, heroId)              → { skills[], slots[], matrix[], notices[] }
 *   · detail(crystalId, heroId, build)  → { text, reasonCodes[], sections{...} }
 *   界面**不自行判断「这颗水晶能不能作用于这个技能」** —— 生效 / 不适用 / 冲突
 *   一律取 `panel.matrix[].crystals[].status`（由编译器解释结果产出）。
 *
 * 【降级】未通电英雄（`_crystalModeOf` 返回 null）→ 单行友好文案，绝不报错、不白屏；
 *   SkillPresenter 缺失或抛错 → 同样走该降级分支。
 *
 * 【样式】新前缀 `crystal-panel*`（不复用 .mod-slot / 战斗栏的 .crystal-slot）；
 *   品质双通道（颜色 + 星标/品质名），满足「不能只靠颜色辨识」。
 *
 * 【零影响】不改屏 1~4 任何既有行为与 DOM 结构（crystal_ui_test 守边界）；
 *   所有 DOM 读写空值保护（元素缺失只跳过，不抛异常）。
 * ========================================================================== */
Object.assign(UI, {
  /* ---------- 运行态 ---------- */
  skillPanelOpen: false,
  _skillPanelHeroId: "",
  _skillPanelMembersCache: null,
  _skillPanelBtnBound: false,
  _skillPanelOverlayBound: false,
  _skillPanelDetailKey: "",

  /* 面板成员列表（队长 + 队友）：复用 _partyMembers；为空时回落 G.heroDef / G.player。空值保护。 */
  _skillPanelMembers() {
    let list = [];
    try { list = this._partyMembers() || []; } catch (e) { list = []; }
    if (!list.length && typeof G !== "undefined" && G) {
      const hd = G.heroDef || (G.team && G.team[0]) || null;
      const pid = (G.player && G.player.id) || (hd && hd.id) || null;
      if (pid) list = [{ id: pid, name: (hd && hd.name) || pid, heroDef: hd || {}, rt: G.player || hd || { id: pid } }];
    }
    return list;
  },

  /* 入口按钮绑定（幂等）：点击 toggle 面板。showHudOnly / updateHUD 每帧调用，成本可忽略。 */
  _bindSkillPanelBtn() {
    if (typeof document === "undefined" || !document.getElementById) return;
    if (this._skillPanelBtnBound) return;
    const btn = document.getElementById("btn-skill-panel");
    if (!btn) return;
    this._skillPanelBtnBound = true;
    btn.onclick = () => {
      if (this.skillPanelOpen) this.closeSkillPanel();
      else this.showSkillPanel();
    };
  },

  /* 遮罩 / 关闭按钮绑定（幂等）：点遮罩本身或关闭按钮 → 关闭（不误伤面板内点击）。 */
  _bindSkillPanelOverlay() {
    if (this._skillPanelOverlayBound) return;
    const ov = document.getElementById("skill-panel-overlay");
    if (!ov) return;
    this._skillPanelOverlayBound = true;
    ov.onclick = (e) => { if (e && e.target === ov) this.closeSkillPanel(); };
    const close = document.getElementById("btn-skill-panel-close");
    if (close) close.onclick = () => this.closeSkillPanel();
  },

  /* 打开技能面板（可选指定英雄；缺省沿用上次 / 队伍首位）。返回 true = 已打开。
   * 数据全部来自 SkillPresenter；presenter 缺失 / 未通电 → 仍打开，但内容走降级文案。 */
  showSkillPanel(heroId) {
    if (typeof document === "undefined" || !document.getElementById) return false;
    const members = this._skillPanelMembers();
    const ids = members.map(m => m.id);
    let hid = heroId || this._skillPanelHeroId || "";
    if (!hid || ids.indexOf(hid) < 0) hid = ids[0] || "";
    this._skillPanelHeroId = hid;
    this._skillPanelMembersCache = members;
    this._bindSkillPanelBtn();
    this._renderSkillPanel();
    const ov = document.getElementById("skill-panel-overlay");
    if (!ov) return false;
    this._bindSkillPanelOverlay();
    ov.classList.remove("hidden");
    this.skillPanelOpen = true;
    return true;
  },

  /* 关闭（幂等）：overlay 重新 hidden。清详情落痕，避免下次打开残留上一颗水晶的详情。 */
  closeSkillPanel() {
    const ov = (typeof document !== "undefined" && document.getElementById)
      ? document.getElementById("skill-panel-overlay") : null;
    if (ov) ov.classList.add("hidden");
    this.skillPanelOpen = false;
    this._skillPanelDetailKey = "";
    return true;
  },

  /* 面板渲染入口：英雄 tab → 技能区 → 槽区 → 矩阵区 → 汇总标签 → 详情占位。
   * 未通电（panel 取不到）→ 全区块降级文案 + 4 个空槽占位（不报错）。 */
  _renderSkillPanel() {
    if (typeof document === "undefined" || !document.getElementById) return;
    const members = (this._skillPanelMembersCache && this._skillPanelMembersCache.length)
      ? this._skillPanelMembersCache : this._skillPanelMembers();
    let heroId = this._skillPanelHeroId || (members[0] && members[0].id) || "";
    let member = null;
    for (const m of members) if (m && m.id === heroId) { member = m; break; }
    if (!member && members.length) { member = members[0]; heroId = member.id; this._skillPanelHeroId = heroId; }
    this._renderSkillPanelTabs(members, heroId);

    let cm = null;
    try { cm = member ? this._crystalModeOf(member) : null; } catch (e) { cm = null; }
    const panel = (cm && cm.panel) ? cm.panel : null;

    const skBox = document.getElementById("crystal-panel-skills");
    const slotBox = document.getElementById("crystal-panel-slots");
    const mxBox = document.getElementById("crystal-panel-matrix");
    const dtBox = document.getElementById("crystal-panel-detail");
    const ntBox = document.getElementById("crystal-panel-notices");

    /* 未通电降级：友好文案，不报错、不白屏（面板仍可正常开关）。 */
    if (!panel) {
      const msg = member
        ? ((member.name || member.id) + " 未启用能量水晶（该英雄仍走旧路径：武器模块）")
        : "暂无可查看的英雄";
      if (skBox) skBox.innerHTML = `<div class="crystal-panel-degrade">${msg}</div>`;
      if (slotBox) slotBox.innerHTML = this._skillPanelSlotCells(null);
      if (mxBox) mxBox.innerHTML = `<div class="crystal-panel-degrade">${msg}</div>`;
      if (dtBox) dtBox.innerHTML = `<div class="crystal-panel-degrade">${msg}</div>`;
      if (ntBox) ntBox.innerHTML = "";
      this._skillPanelDetailKey = "";
      return;
    }

    const skills = Array.isArray(cm.skills) ? cm.skills : [];
    if (skBox) skBox.innerHTML = skills.map(s => this._skillPanelSkillRow(s)).join("");
    if (slotBox) {
      slotBox.innerHTML = this._skillPanelSlotCells(panel);
      const cells = (slotBox.querySelectorAll) ? slotBox.querySelectorAll(".crystal-panel-slot") : [];
      const arr = Array.isArray(panel.slots) ? panel.slots : [];
      for (let i = 0; i < cells.length; i++) {
        const slotData = arr[i] || null;
        cells[i].onclick = () => this._skillPanelShowDetail(slotData, heroId, cm);
      }
    }
    if (mxBox) mxBox.innerHTML = this._skillPanelMatrix(panel, skills);
    if (ntBox) ntBox.innerHTML = this._skillPanelNotices(panel);
    if (dtBox) {
      dtBox.innerHTML = `<div class="crystal-panel-hint">点击上方水晶槽查看详情` +
        `（作用节点 / 代价 / 事件限制 / 冲突 / 不适用原因）</div>`;
    }
    this._skillPanelDetailKey = "";
  },

  /* 英雄切换 tab：每人一个 button；点选 → 切 heroId 并重渲染（多英雄局才有意义，单人局仅高亮当前）。 */
  _renderSkillPanelTabs(members, heroId) {
    const box = document.getElementById("crystal-panel-tabs");
    if (!box) return;
    const list = Array.isArray(members) ? members : [];
    if (!list.length) { box.innerHTML = ""; return; }
    box.innerHTML = list.map(m =>
      `<button class="crystal-panel-tab${m.id === heroId ? " active" : ""}" type="button">${m.name || m.id}</button>`
    ).join("");
    const tabs = (box.querySelectorAll) ? box.querySelectorAll(".crystal-panel-tab") : [];
    for (let i = 0; i < tabs.length; i++) {
      const m = list[i];
      if (!m) continue;
      tabs[i].onclick = () => { this._skillPanelHeroId = m.id; this._renderSkillPanel(); };
    }
  },

  /* 技能行（名字 / 等级 / 冷却）。数据 = panel.skills[]（经 _crystalSkillOrder 排序后）。 */
  _skillPanelSkillRow(s) {
    const name = (s && (s.name || s.skillId)) || "技能";
    const sid = (s && s.skillId) || "";
    const lv = (s && s.level) || 1;
    const cd = (s && typeof s.cd === "number") ? s.cd : 0;
    const cdTxt = cd > 0 ? (Math.round(cd * 10) / 10 + "s") : "无冷却";
    return `<div class="crystal-skill-row" data-skill="${sid}">` +
      `<span class="crystal-skill-name">${name}</span>` +
      `<span class="crystal-skill-meta">Lv${lv} · 冷却 ${cdTxt}</span></div>`;
  },

  /* 4 共享水晶槽渲染：空槽占位；有槽显示名 + 品质色 + 品质名/星标（双通道）+ Lv n/max。
   * panel 为 null（未通电）→ 全部输出空槽占位。 */
  _skillPanelSlotCells(panel) {
    const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
    const slots = (panel && Array.isArray(panel.slots)) ? panel.slots : [];
    const n = Math.max(per, slots.length);
    let html = "";
    for (let i = 0; i < n; i++) {
      const s = slots[i] || null;
      const cid = (s && s.crystalId) || null;
      if (!cid) {
        html += `<div class="crystal-panel-slot crystal-slot-empty" data-slot="${i}">` +
          `<span class="crystal-panel-slot-no">${i + 1}</span></div>`;
        continue;
      }
      const qObj = (s.quality && typeof s.quality === "object") ? s.quality : null;
      const qid = (qObj && qObj.id) || (typeof s.quality === "string" ? s.quality : "");
      const color = (qObj && qObj.color) || this._skillPanelQualityColor(qid) || "#b8c4d4";
      const qName = (qObj && qObj.name) || "";
      const rank = this._skillPanelQualityRank(qid);
      const stars = rank > 0 ? new Array(rank + 1).join("★") : "";
      const maxLv = this._skillPanelMaxLevel(cid);
      const lv = s.level || 1;
      html += `<div class="crystal-panel-slot crystal-slot-filled" data-slot="${i}" data-crystal="${cid}"` +
        ` style="border-color:${color}">` +
        `<span class="crystal-panel-slot-name" style="color:${color}">${s.name || cid}</span>` +
        `<span class="crystal-panel-slot-lv">Lv${lv}/${maxLv}</span>` +
        `<span class="crystal-panel-slot-q" style="color:${color}">${stars}${qName ? " " + qName : ""}</span>` +
        `</div>`;
    }
    return html;
  },

  /* 辅助矩阵：每技能一行 × 每水晶一列，状态取 panel.matrix[].crystals[].status（不自行判定）。 */
  _skillPanelMatrix(panel, skills) {
    const rows = (panel && Array.isArray(panel.matrix)) ? panel.matrix : [];
    const slots = (panel && Array.isArray(panel.slots)) ? panel.slots : [];
    const nameOfSkill = {}, nameOfCrystal = {};
    for (const s of (skills || [])) if (s && s.skillId) nameOfSkill[s.skillId] = s.name || s.skillId;
    const cols = [];
    for (const s of slots) if (s && s.crystalId) { cols.push(s.crystalId); nameOfCrystal[s.crystalId] = s.name || s.crystalId; }
    if (!rows.length) return `<div class="crystal-panel-hint">暂无辅助矩阵数据</div>`;
    const head = `<div class="crystal-matrix-head">` +
      `<span class="crystal-matrix-skill">技能 / 水晶</span>` +
      cols.map(cid => `<span class="crystal-matrix-colh">${nameOfCrystal[cid]}</span>`).join("") +
      `</div>`;
    const body = rows.map(r => {
      const sid = (r && r.skillId) || "";
      const cells = (r && Array.isArray(r.crystals)) ? r.crystals : [];
      const cellHtml = cols.map(cid => {
        let st = "inactive";
        for (const c of cells) if (c && c.crystalId === cid) { st = c.status || "inactive"; break; }
        const cls = st === "applied" ? "ok" : (st === "conflict" ? "bad" : "off");
        const txt = st === "applied" ? "生效" : (st === "conflict" ? "冲突" : "不适用");
        return `<span class="crystal-matrix-cell crystal-mx-${cls}">${txt}</span>`;
      }).join("");
      return `<div class="crystal-matrix-row" data-skill="${sid}">` +
        `<span class="crystal-matrix-skill">${nameOfSkill[sid] || sid}</span>${cellHtml}</div>`;
    }).join("");
    return head + body;
  },

  /* 汇总标签 / 诊断：全部来自 panel.notices[]（不硬编码中文判定）。
   * summaryTag 且 hidden:true → 只控制外显（不渲染），代价等详情不受影响。 */
  _skillPanelNotices(panel) {
    const list = (panel && Array.isArray(panel.notices)) ? panel.notices : [];
    const vis = [];
    for (const n of list) {
      if (!n) continue;
      if (n.kind === "summaryTag" && n.hidden) continue;   // 隐藏只控制外显，不控制结算
      vis.push(n);
    }
    if (!vis.length) return "";
    return vis.map(n => {
      const kind = n.kind === "diagnostic" ? "crystal-notice-diag"
        : (n.kind === "hiddenNotice" ? "crystal-notice-hidden" : "crystal-notice-tag");
      return `<span class="crystal-notice ${kind}">${n.text || ""}</span>`;
    }).join("");
  },

  /* 点槽 → 详情：正文取 `SkillPresenter.detail().text`（跳过与标题重复的首行），
   * 脚注 chip 取 `detail().sections`（代价 / 限制 / 事件限制 / 冲突）。
   * 空槽 → 引导文案；presenter 缺失 / 抛错 → 单行占位（不报错）。 */
  _skillPanelShowDetail(slotData, heroId, cm) {
    const box = document.getElementById("crystal-panel-detail");
    if (!box) return;
    const cid = (slotData && slotData.crystalId) || null;
    if (!cid) {
      box.innerHTML = `<div class="crystal-panel-hint">空水晶槽 · 升级可选择能量水晶填入</div>`;
      this._skillPanelDetailKey = "";
      return;
    }
    const qObj = (slotData.quality && typeof slotData.quality === "object") ? slotData.quality : null;
    const qid = (qObj && qObj.id) || (typeof slotData.quality === "string" ? slotData.quality : "");
    const color = (qObj && qObj.color) || this._skillPanelQualityColor(qid) || "#b8c4d4";
    const qName = (qObj && qObj.name) || "";
    const maxLv = this._skillPanelMaxLevel(cid);
    let d = null;
    try {
      if (cm && typeof SkillPresenter !== "undefined" && SkillPresenter && typeof SkillPresenter.detail === "function") {
        d = SkillPresenter.detail(cid, heroId, cm.build);
      }
    } catch (e) { d = null; }
    let lines = d ? String(d.text || "").split("\n").filter(Boolean) : [];
    if (lines.length > 1) lines = lines.slice(1);        // 首行 = 标题（与 head 重复）
    if (!lines.length) lines = ["（暂无能量水晶详情数据）"];
    const rows = lines.map(t => `<div class="crystal-detail-row">${t}</div>`).join("");
    const sec = (d && d.sections) || {};
    const chips = [];
    for (const key of ["cost", "limits", "eventLimits", "conflicts"]) {
      const items = Array.isArray(sec[key]) ? sec[key] : [];
      for (const it of items) chips.push(`<span class="crystal-detail-chip" data-sec="${key}">${it}</span>`);
    }
    const chipHtml = chips.length ? `<div class="crystal-detail-chips">${chips.join("")}</div>` : "";
    box.innerHTML = `<div class="crystal-detail-head"><b style="color:${color}">${slotData.name || cid}</b>` +
      `<span style="color:${color}">${qName ? qName + " · " : ""}Lv${slotData.level || 1}/${maxLv}</span></div>` +
      `<div class="crystal-detail-rows">${rows}</div>` + chipHtml;
    box.dataset.crystal = cid;
    box.dataset.heroId = heroId || "";
    box.dataset.slot = String(slotData.slot != null ? slotData.slot : "");
    this._skillPanelDetailKey = cid;
  },

  /* 品质色（读 CFG.skillSystem.qualityDefs；缺失返回空串 → 调用方回落默认色）。 */
  _skillPanelQualityColor(qid) {
    if (!qid) return "";
    try {
      const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
      const list = t && t.qualityDefs;
      if (Array.isArray(list)) for (const q of list) if (q && q.id === qid && q.color) return q.color;
    } catch (e) { }
    return "";
  },
  /* 品质星数（rank）：品质双通道的「形状」通道，缺失返回 0（不显示星标）。 */
  _skillPanelQualityRank(qid) {
    if (!qid) return 0;
    try {
      const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
      const list = t && t.qualityDefs;
      if (Array.isArray(list)) for (const q of list) if (q && q.id === qid) return q.rank || 0;
    } catch (e) { }
    return 0;
  },
  /* 水晶等级上限（levels.length）；缺失回落 1。 */
  _skillPanelMaxLevel(cid) {
    if (!cid) return 1;
    try {
      const t = (typeof CFG !== "undefined" && CFG && CFG.skillSystem) || null;
      const cd = t && t.crystalDefs && t.crystalDefs[cid];
      if (cd && Array.isArray(cd.levels) && cd.levels.length) return cd.levels.length;
    } catch (e) { }
    return 1;
  },
});
