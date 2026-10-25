/* ============================================================================
 * skill-playtest.js —— 能量水晶技能系统「试玩通电」引导块（22.x）
 * ----------------------------------------------------------------------------
 * 【为什么需要它】
 *   技能系统默认是**熄火**的（并存期安全默认）：
 *     · CFG.skillSystem.enabled = false      → 9 个模块静默待命
 *     · CFG.skillSystem.migratedHeroIds = [] → 无英雄走新路径
 *     · 全仓没有任何代码在运行时写 hero.skillState → 英雄没有技能与水晶
 *   于是"代码全好了，但游戏里看不到"。本文件提供一条**零侵入**的试玩通路。
 *
 * 【用法】（手机可直接点带参数的链接 —— 仅用于**临时**试玩未迁移的英雄）
 *     ?skill=1              → 通电；试点英雄 = H001（猎手）
 *     ?skill=H002           → 通电；试点英雄 = H002
 *     ?skill=H001,H002      → 通电；多个英雄（用逗号分隔）
 *     ?skill=1&hero=H004    → 通电；试点英雄 = H004
 *     不带 skill 参数        → **跟随配表**：配表启用则走正式启用，否则整块空转
 *
 * 【正式启用（22.8 起）】配表 `CFG.skillSystem.enabled = true` + `migratedHeroIds = ["H001"]`
 *   → 不带任何参数打开即是新路径，H001 猎手用能量水晶技能系统。
 *   ⚠️ **本文件是整合层**：启用只改 config 开关是**不够的** —— 「包装 ownsHero + 懒注入
 *      skillState」只在本文件做；漏了这一步，ownsHero 会返回 true 让旧施放被跳过，
 *      而 skillState 从未注入 → 英雄完全不开火（血泪 §10.3-40）。故 install() 同时认
 *      「URL 参数」与「配表启用」两种来源。
 *
 * 【它做了四件事 —— 严格按 v0.5 §1 的正式流程】
 *   ① 打开总开关 + 写入迁移名单（只改内存，不动 config.js 的默认值）
 *   ② 包装 SkillRuntime.ownsHero 这**唯一**判定入口：第一次需要该英雄时**懒注入**
 *      skillState —— 只含**武器绑定的那 1 个初始主动技能**（读
 *      CFG.skillSystem.initialSkillBindings）+ 4 颗共享水晶，交给 SupportCompiler 编出 builds。
 *      懒注入的意义：英雄实例何时被创建（进图 / 换关 / 重开）都不怕漏。
 *   ③ 包装 World.triggerAltar：踩**奖励类雕像**时，按正式事务 SkillReward.rollStatueGrant
 *      试编译过滤后，**弹出稀有技能选择弹窗**（候选池 = CFG.skillSystem.rareSkillPool，
 *      每英雄至多 1 个），玩家选中后重新编译 builds。工匠雕像（teleport）与空间裂缝（rift）不参与。
 *      无 UI 环境（无头测试）→ 自动装首个候选（与接入前逐字一致）。
 *   ④ 提供一份**最小可视化叠加层**（SkillPlaytest.draw）：新路径的效果实例存在
 *      world.__skillEffects 里，既有渲染管线不认识它 —— 不补这层，"怪物莫名掉血"。
 *
 * 【安全网】
 *   · 编译失败 → ownsHero 回落 false → 该英雄**留在旧路径**（不会两头空）
 *   · 稀有技能授予后重编译失败 → **回滚**（保留初始技能，不破坏已有配装）
 *   · 所有依赖做 typeof 守卫；无 location / 无 CFG 的沙箱里静默跳过
 *   · 只认 H### 形状的英雄 id，拼错参数不会误伤
 *
 * 【与既有代码的接触面】
 *   · render.js 内 **1 行**受守卫的调用点（世界坐标绘制段末尾）
 *   · 其余全部是本文件内部实现，未改任何既有函数逻辑（World 用原型包装，不改类本体）
 * ========================================================================== */
"use strict";

const SkillPlaytest = {
  /* ---- 运行态 ---- */
  active: false,          // 是否已接线（= URL 带 skill 参数 **或** 配表已正式启用）
  source: "off",          // 接线来源："url"（试玩）| "config"（正式启用）| "off"
  heroIds: [],            // 迁移英雄 id 列表
  _installed: false,      // install() 幂等闸门
  _patched: false,        // ownsHero 包装幂等闸门
  _patchedAltar: false,   // World.triggerAltar 包装幂等闸门
  _origTriggerAltar: null,// 包装前的原型方法（reset 还原用）
  _toasted: false,        // 提示只弹一次
  _prevPaused: false,     // 雕像选择弹窗打开前的 Game.paused 快照（退出时精确还原）
  _rng: null,             // 可注入随机源（null = 用 U._random / Math.random）
  _log: [],               // 诊断留痕（供 status() / 测试读取）

  /* ---- 初始配装（正式流程：武器绑定初始主动技能，无普攻）----------------
   *   技能：**只有 1 个** —— 由 CFG.skillSystem.initialSkillBindings[heroId] 决定
   *         （H001 武器 W001「速射炮」→ 火球 SK_FIREBALL）。
   *   水晶：4 颗共享槽（魔法增幅 + 贯穿 + 追踪 + 扇射）——**每颗都必须对初始技能有实际收益**
   *         （v0.5 §3 不可拆保护：已装水晶若对全部技能都无收益会使整组编译失败，
   *          故首轮不用「扩域」，它只对范围类技能生效）。
   * 稀有技能**不在这里给** —— 由踩雕像经 grantRareSkillOnAltar() 按正式事务授予。 */
  _presetFor(heroId) {
    const skills = {};
    const sid = this.initialSkillFor(heroId);
    if (sid) skills[sid] = { id: sid, level: this.skillLevelFor(heroId, sid) };
    return {
      slotCount: 4,
      skills: skills,
      crystals: [
        { crystalId: "CR_ARCANE_AMP", level: 1, slot: 0 },
        { crystalId: "CR_PIERCE", level: 1, slot: 1 },
        { crystalId: "CR_HOMING", level: 1, slot: 2 },
        { crystalId: "CR_MULTISHOT", level: 1, slot: 3 },
      ],
    };
  },

  /** 取英雄的初始主动技能 id（v0.5 §1：武器绑定决定）。
   *  优先读 CFG.skillSystem.initialSkillBindings[heroId].skillId；
   *  未登记的英雄 → 回落 skillDefs 的第一个（稳定排序），保证任意 ?skill=H### 都能跑。 */
  initialSkillFor(heroId) {
    const t = this._t();
    if (!t) return null;
    const b = t.initialSkillBindings && t.initialSkillBindings[heroId];
    if (b && b.skillId && t.skillDefs && t.skillDefs[b.skillId]) return b.skillId;
    const defs = t.skillDefs || {};
    const keys = Object.keys(defs).sort();
    return keys.length ? keys[0] : null;
  },

  _t() { return (typeof CFG !== "undefined" && CFG && CFG.skillSystem) ? CFG.skillSystem : null; },

  /* ---- 技能等级真源（合同 §101：沿用项目实际路径 = 武器等级 = 技能等级）-------------
   * 本文件是**整合层**，是唯一允许读局外存档（`Meta`）的地方；三个技能模块保持纯函数。
   *
   *   ① 等级取自 `Meta.weaponLv(heroId)`（局外武器等级，1~100；未登记英雄 → 1）；
   *   ② **必须钳制到 `def.levels.length`** —— 编译器对越界等级按 `LEVEL_OVERFLOW` **硬失败**
   *      （整组编译不通过 → 该英雄回落旧路径）。当前首批内容的 `levels` 只有 3 级
   *      （完整等级表属 E 阶段内容工作），故实际等级 = min(武器等级, levels.length)；
   *      数值表补齐后**无需改代码**，自动放开到武器等级上限。
   *   ③ 无 `Meta`（无头沙箱）/ 无 def / 取值非法 → 1（等价于接入前行为，零影响）。 */
  skillLevelFor(heroId, skillId) {
    const t = this._t();
    let lv = 1;
    try {
      if (typeof Meta !== "undefined" && Meta && typeof Meta.weaponLv === "function") {
        const w = Number(Meta.weaponLv(heroId));
        if (isFinite(w) && w >= 1) lv = Math.floor(w);
      }
    } catch (e) { lv = 1; }
    const def = (t && t.skillDefs && t.skillDefs[skillId]) || null;
    const max = (def && Array.isArray(def.levels) && def.levels.length) ? def.levels.length : 1;
    return Math.max(1, Math.min(lv, max));
  },

  /* ================= 一、URL 解析（纯函数，便于单测直接喂字符串） ================= */

  /** 解析 query 字符串 → { on, heroIds }。
   *  search 省略时读 location.search。非法/缺失一律返回 { on:false }（空转）。 */
  parse(search) {
    const raw = (typeof search === "string")
      ? search
      : ((typeof location !== "undefined" && location && typeof location.search === "string") ? location.search : "");
    const q = {};
    const body = String(raw || "").replace(/^\?/, "");
    if (!body) return { on: false, heroIds: [] };
    for (const part of body.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      const k = decodeURIComponent(eq < 0 ? part : part.slice(0, eq)).toLowerCase();
      const v = eq < 0 ? "" : decodeURIComponent(part.slice(eq + 1));
      if (k) q[k] = v;
    }
    const val = q.skill;
    if (val == null) return { on: false, heroIds: [] };                 // 没写 skill → 空转
    const lower = String(val).trim().toLowerCase();
    if (lower === "" || lower === "0" || lower === "off" || lower === "false") {
      return { on: false, heroIds: [] };                                // 显式关掉
    }
    const ids = [];
    const push = (id) => {
      const t = String(id || "").trim().toUpperCase();
      if (/^H\d{3}$/.test(t) && ids.indexOf(t) < 0) ids.push(t);        // 只认 H### 形状
    };
    if (lower === "1" || lower === "on" || lower === "true") push(q.hero || "H001");
    else for (const one of String(val).split(",")) push(one);
    if (q.hero) push(q.hero);
    if (!ids.length) push("H001");                                      // 兜底：默认猎手
    return { on: true, heroIds: ids };
  },

  /* ================= 二、安装（打开开关 + 包装判定入口） ================= */

  /** 通电。两种来源，**都必须接线**：
   *    ① URL 携带 `?skill=...`      → 试玩模式（写内存开关 + 名单）
   *    ② 配表已启用（`enabled === true` 且 `migratedHeroIds` 非空）→ 正式启用
   *
   *  ⚠️ 22.8 血泪（必读）：把 config.js 的 `enabled` 直接翻成 true **不等于**启用。
   *     本文件是**整合层** —— 「包装 ownsHero + 懒注入 skillState」只在这里做。
   *     若只在表单里开开关、不接线：
   *       `ownsHero` 返回 true（原始判定只查 enabled + 名单）
   *       → game.js 跳过旧施放逻辑
   *       → 而 `hero.skillState` 从未被注入、新路径没有 builds 可施放
   *       → 英雄**完全不开火**（旧技能停了、新技能没有 = 两头空）。
   *     故 install() 必须同时认这两种来源。
   *  search 省略时读 location.search。 */
  install(search) {
    if (this._installed) return this;
    const r = this.parse(search);
    const cfgOn = this._configEnabled();
    this._note("parse", r.on ? ("url:" + r.heroIds.join(",")) : (cfgOn ? "config" : "off"));
    if (!r.on && !cfgOn) return this;                                 // 两种来源都没有 → 完全空转
    if (typeof CFG === "undefined" || !CFG || !CFG.skillSystem) return this;
    if (typeof SkillRuntime === "undefined" || !SkillRuntime) return this;

    this._installed = true;
    this.active = true;
    this.source = r.on ? "url" : "config";                            // 供 UI/诊断区分来源
    if (r.on) {
      this.heroIds = r.heroIds.slice();
      CFG.skillSystem.enabled = true;                                 // 只改内存，不动 config.js
      CFG.skillSystem.migratedHeroIds = this.heroIds.slice();
    } else {
      this.heroIds = CFG.skillSystem.migratedHeroIds.slice();         // 配表已经是启用态，原样沿用
    }
    this._patch();
    this._patchAltar();
    return this;
  },

  /** 配表是否已「正式启用」（开关打开 + 迁移名单非空）。
   *  只看配表，不改任何状态 —— install() 用它判断要不要走正式启用分支。 */
  _configEnabled() {
    const t = this._t();
    return !!(t && t.enabled === true &&
      Array.isArray(t.migratedHeroIds) && t.migratedHeroIds.length > 0);
  },

  /** 包装 SkillRuntime.ownsHero —— 全系统唯一的"这个英雄走新路径吗"判定入口。
   *  game.js 的两处分流闸门与 updateAll 都经过它，故一处包装即全覆盖。 */
  _patch() {
    if (this._patched) return;
    const self = this;
    const orig = SkillRuntime.ownsHero;
    if (typeof orig !== "function") return;                             // 接口缺失 → 不包装（安全）
    this._patched = true;
    SkillRuntime.ownsHero = function (hero) {
      if (!orig.call(this, hero)) return false;                         // 尊重原判定（enabled + 名单）
      const st = self.ensureState(hero);
      /* 安全网：注入失败就回落旧路径 —— 宁可这个英雄不迁移，也不能"旧技能停了、新技能没有" */
      if (!st && !(hero && hero.skillState && hero.skillState.builds)) return false;
      return true;
    };
  },

  /* ========== 二·五、雕像授予稀有技能（v0.5 §1：局内雕像最多给 1 个） ========== */

  /** 包装 World.prototype.triggerAltar（**原型包装**，不改类本体、不复制中间逻辑）：
   *  雕像原有行为一字不动，只在其后追加一次「尝试授予稀有技能」。 */
  _patchAltar() {
    if (this._patchedAltar) return;
    if (typeof World === "undefined" || !World || !World.prototype) return;   // 沙箱无 game.js → 跳过
    const orig = World.prototype.triggerAltar;
    if (typeof orig !== "function") return;
    const self = this;
    this._patchedAltar = true;
    this._origTriggerAltar = orig;
    World.prototype.triggerAltar = function (a) {
      const r = orig.apply(this, arguments);
      try { self.grantRareSkillOnAltar(this, a); } catch (e) { /* 授予异常绝不影响雕像本体 */ }
      return r;
    };
  },

  /** 雕像触发后的稀有技能授予（W2：改为**弹出稀有技能选择弹窗**，玩家从候选池里挑 1 个 —— 用户 2026-10 拍板）。
   *  返回值 = 本次**发起授予的英雄数**（弹窗模式下 = 待选择数量；0 = 未授予 / 已满 / 冲突 / 非奖励雕像）。
   *  安全网：无 UI（无头测试 / DOM 缺失）→ 每个英雄直接装**首个候选**（与接入前行为逐字一致，绝不悬挂）。 */
  grantRareSkillOnAltar(world, altar) {
    if (!this.active) return 0;
    const cfg = (altar && (altar.cfg || altar)) || null;
    const effs = (cfg && Array.isArray(cfg.effects)) ? cfg.effects : [];
    /* 只认「奖励类」雕像：工匠雕像（teleport）与空间裂缝（rift）不属于局内奖励雕像 */
    for (const ef of effs) {
      if (ef && (ef.type === "teleport" || ef.type === "rift")) return 0;
    }
    if (typeof SkillReward === "undefined" || !SkillReward ||
        typeof SkillReward.rollStatueGrant !== "function") return 0;

    const t = this._t();
    const policy = (t && t.rewardPolicies && t.rewardPolicies.RP_STATUE) || null;
    const pending = [];
    for (const hero of this._newPathHeroes(world)) {
      if (!hero.skillState) continue;
      let res = null;
      try { res = SkillReward.rollStatueGrant(hero.skillState, policy, this._rng); }
      catch (e) { res = null; }
      this._note("statue-roll", hero.id + ":" + ((res && res.kind) || "null"));
      if (res && res.granted && res.skillId) pending.push(hero);
    }
    if (!pending.length) return 0;

    const options = this.rareSkillOptions();
    const ui = (typeof UI !== "undefined") ? UI : null;
    /* 降级（池表缺失 / 无 UI / DOM 缺失）：直接装首项，与接入前一致 */
    const autoGrant = () => {
      if (!options.length) return 0;
      let n = 0;
      for (const hero of pending) if (this._installRareSkill(hero, options[0].skillId)) n++;
      if (n) this._toastRare();
      return n;
    };
    if (!options.length || !ui || typeof ui.showChoice !== "function") return autoGrant();

    /* 弹窗路径：多英雄时**排队依次弹**（与升级 4 选 1 的多级连升同思路）。
     * 暂停闸门由本文件自行开合（UI.showChoice 不做暂停），队列清空时统一恢复。 */
    const jobs = pending.slice();
    const step = () => {
      const hero = jobs.shift();
      if (!hero) { this._releasePause(); return; }
      if (!hero.skillState) { step(); return; }
      const heroName = this._heroNameOf(hero.id);
      const cards = options.map((o) => ({
        id: o.skillId, name: o.name, desc: o.desc,
        kindLabel: "稀有技能", color: "#c79bff",
        lines: ["归属：" + heroName, "4 颗能量水晶会同时作用于它"],
        foot: "本局不可卸载 · 每英雄至多 1 个",
      }));
      let done = false;
      const finish = (idx) => {
        if (done) return;                       // 防重复（点卡与遮罩关闭竞态）
        done = true;
        const pick = cards[idx] || cards[0];
        if (pick && this._installRareSkill(hero, pick.id)) this._toastRare();
        step();
      };
      const opened = ui.showChoice({
        title: "获得稀有技能",
        sub: heroName + " 踩到奖励雕像 · 选择一个稀有技能（战斗已暂停）",
        options: cards,
        onPick: finish,
        onCancel: () => finish(0),              // 关掉弹窗 = 取首项，不空手
      });
      if (!opened) finish(0);
    };
    this._holdPause();
    step();
    return pending.length;
  },

  /** 稀有技能候选（数据驱动 = `CFG.skillSystem.rareSkillPool`，名称/描述走文案表）。
   *  池内未在 skillDefs 登记的 id 会被跳过（避免弹出一张点不动的空卡）。 */
  rareSkillOptions() {
    const t = this._t();
    const pool = (t && Array.isArray(t.rareSkillPool)) ? t.rareSkillPool : [];
    const loc = (t && t.localization) || {};
    const out = [];
    const seen = {};
    for (const sid of pool) {
      if (!sid || seen[sid]) continue;
      const def = (t && t.skillDefs && t.skillDefs[sid]) || null;
      if (!def) continue;
      seen[sid] = 1;
      const p = def.presentation || {};
      const nk = p.nameKey || def.nameKey;
      const dk = p.descKey || p.summaryKey;
      out.push({
        skillId: sid,
        name: (nk && loc[nk]) || sid,
        desc: (dk && loc[dk]) || "",
      });
    }
    return out;
  },

  /** 英雄显示名（CFG.heroes → 回退 id）。 */
  _heroNameOf(hid) {
    try {
      const list = (typeof CFG !== "undefined" && CFG && CFG.heroes) || [];
      for (const h of list) if (h && h.id === hid && h.name) return h.name;
    } catch (e) { /* 无 CFG 环境 */ }
    return hid;
  },

  /** 暂停闸门（雕像选择期间冻结战斗，与升级 4 选 1 同一 `Game.paused` 语义）。
   *  记忆进入前状态 → 退出时精确还原，不覆盖别处已置的暂停。 */
  _holdPause() {
    try {
      if (typeof Game === "undefined" || !Game) return;
      this._prevPaused = Game.paused === true;
      Game.paused = true;
    } catch (e) { /* 无 Game 环境（无头）*/ }
  },
  _releasePause() {
    try {
      if (typeof Game === "undefined" || !Game) return;
      Game.paused = !!this._prevPaused;
      this._prevPaused = false;
    } catch (e) { /* 无 Game 环境（无头）*/ }
  },

  /** 已通电（已挂 skillState、走新路径）的英雄枚举：优先 world 自身，其次全局宿主 G。 */
  _newPathHeroes(world) {
    const out = [];
    const push = (h) => { if (h && h.skillState && out.indexOf(h) < 0) out.push(h); };
    if (world) {
      push(world.player);
      if (Array.isArray(world.companions)) for (const c of world.companions) push(c);
    }
    if (typeof G !== "undefined" && G) {
      push(G.player);
      if (Array.isArray(G.companions)) for (const c of G.companions) push(c);
    }
    return out;
  },

  /** 装入稀有技能并**重新编译**；任何失败都回滚（不留半截状态）。 */
  _installRareSkill(hero, skillId) {
    const st = hero && hero.skillState;
    const t = this._t();
    if (!st || !st.skills || st.skills[skillId]) return false;
    const maxSkills = (t && t.maxSkillsPerHero) || 2;
    if (Object.keys(st.skills).length >= maxSkills) return false;
    const prevVer = st.groupVersion;
    const prevBuilds = st.builds;
    /* 稀有技能等级 = 本英雄现有技能等级（= 武器等级）。与试装路径（SupportCompiler.preview
     * → _applySkillInstall → SupportCompiler.skillLevelOf）取同一值，保证「预览合法 → 落地也合法」。 */
    const rareLv = (typeof SupportCompiler !== "undefined" && SupportCompiler
      && typeof SupportCompiler.skillLevelOf === "function")
      ? SupportCompiler.skillLevelOf(st) : 1;
    st.skills[skillId] = { id: skillId, level: rareLv, cd: 0, cdLeft: 0 };
    st.groupVersion = (st.groupVersion || 1) + 1;
    let res = null;
    try { res = SupportCompiler.compile({ heroId: hero.id, state: st, definitions: t }); } catch (e) { res = null; }
    if (!res || !res.ok || !res.builds) {
      delete st.skills[skillId];                       // 回滚：宁可没有稀有技能，也不破坏已有配装
      st.groupVersion = prevVer;
      st.builds = prevBuilds;
      this._note("rare-skill-fail", hero.id + ":" + skillId);
      return false;
    }
    st.builds = res.builds;
    this._note("rare-skill", hero.id + ":" + skillId);
    return true;
  },

  /* ================= 三、懒注入 skillState（幂等 + 编好 builds） ================= */

  /** 给英雄挂上技能状态并编译。已挂过直接返回（幂等，不会重复编译）。 */
  ensureState(hero) {
    if (!hero || hero.id == null) return null;
    if (hero.skillState && hero.skillState.builds) return hero.skillState;   // 已通电
    const t = (typeof CFG !== "undefined" && CFG) ? CFG.skillSystem : null;
    if (!t) return null;
    if (typeof SupportCompiler === "undefined" || !SupportCompiler ||
        typeof SupportCompiler.compile !== "function") {
      this._note("compile-missing", hero.id);
      return null;
    }

    const p = this._presetFor(hero.id);
    const state = {
      heroId: hero.id,
      slotCount: p.slotCount,
      groupVersion: 1,
      skills: {},                                     // 深拷贝：多英雄之间不共享引用
      crystals: [],
    };
    for (const k in p.skills) {
      if (!Object.prototype.hasOwnProperty.call(p.skills, k)) continue;
      state.skills[k] = { id: p.skills[k].id, level: p.skills[k].level };
    }
    for (const c of p.crystals) {
      state.crystals.push({ crystalId: c.crystalId, level: c.level, slot: c.slot });
    }

    let res = null;
    try { res = SupportCompiler.compile({ heroId: hero.id, state: state, definitions: t }); }
    catch (e) { res = null; }
    if (!res || !res.ok || !res.builds) {
      const codes = (res && res.diagnostics) ? res.diagnostics.map((d) => d.code).join(",") : "throw";
      this._note("compile-fail", hero.id + ":" + codes);
      try { console.warn("[skill-playtest] 预编译未通过，" + hero.id + " 保持旧路径：", codes); } catch (e) {}
      return null;                                    // → ownsHero 回落 false
    }

    state.builds = res.builds;                        // 运行时优先读 hero.skillState.builds[skillId]
    hero.skillState = state;
    this._note("compiled", hero.id);
    this._toastOnce();
    return state;
  },

  /* ================= 四、最小可视化叠加层 ================= */

  /** 世界坐标绘制（由 render.js 内 1 行受守卫调用点触发，位于相机变换作用域内）。
   *  只画 4 类模板的几何示意色 —— 目的不是好看，是"看得见技能在发生"。 */
  draw(ctx, w) {
    if (!this.active || !ctx || !w) return;
    const list = Array.isArray(w.__skillEffects) ? w.__skillEffects : null;
    if (!list || !list.length) return;
    const pal = this._palette();
    try {
      for (const eff of list) {
        if (!eff || !eff.rt || eff.state === "dead") continue;
        const cat = eff.rt.category;
        const r = (typeof eff.radius === "number" && eff.radius > 0) ? eff.radius : 6;
        if (cat === "flightProjectile") {
          ctx.beginPath(); ctx.arc(eff.x, eff.y, r + 2, 0, Math.PI * 2);
          ctx.fillStyle = pal.projectile; ctx.fill();
          ctx.strokeStyle = pal.projectileEdge; ctx.lineWidth = 1.5; ctx.stroke();
        } else if (cat === "orbitContact") {
          const owner = this._ownerOf(w, eff.ownerId);
          const orbR = (eff.rt.params && eff.rt.params.radius) ? eff.rt.params.radius : 70;
          if (owner) {
            ctx.beginPath(); ctx.arc(owner.x, owner.y, orbR, 0, Math.PI * 2);
            ctx.strokeStyle = pal.orbitRing; ctx.lineWidth = 1; ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(eff.x, eff.y, r + 3, 0, Math.PI * 2);
          ctx.fillStyle = pal.orbitBolt; ctx.fill();
        } else if (cat === "instantArea") {
          ctx.beginPath(); ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
          ctx.fillStyle = pal.areaFill; ctx.fill();
          ctx.strokeStyle = pal.areaEdge; ctx.lineWidth = 3; ctx.stroke();
        } else if (cat === "persistentArea") {
          ctx.beginPath(); ctx.arc(eff.x, eff.y, r, 0, Math.PI * 2);
          ctx.fillStyle = pal.regionFill; ctx.fill();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = pal.regionEdge; ctx.lineWidth = 2; ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } catch (e) { /* 叠加层异常绝不影响既有渲染 */ }
  },

  /* 叠加层调色板（纯调试视觉，与美术无关；集中一处便于改） */
  _palette() {
    return {
      projectile: "rgba(255,152,64,0.92)",
      projectileEdge: "rgba(255,224,150,0.95)",
      orbitRing: "rgba(120,200,255,0.35)",
      orbitBolt: "rgba(140,215,255,0.95)",
      areaFill: "rgba(120,140,255,0.22)",
      areaEdge: "rgba(150,175,255,0.85)",
      regionFill: "rgba(255,110,90,0.16)",
      regionEdge: "rgba(255,140,110,0.75)",
    };
  },

  _ownerOf(w, ownerId) {
    if (ownerId == null) return null;
    if (typeof SkillRuntime !== "undefined" && SkillRuntime &&
        typeof SkillRuntime._heroOwner === "function") {
      return SkillRuntime._heroOwner(w, ownerId);
    }
    if (typeof G !== "undefined" && G && G.player && G.player.id === ownerId) return G.player;
    return null;
  },

  /* ================= 五、诊断 ================= */

  _note(kind, detail) {
    this._log.push(kind + ":" + detail);
    if (this._log.length > 32) this._log.shift();
  },

  /** 技能 / 稀有技能的中文名（读文案表，缺失回退 id）。 */
  _nameOf(skillId) {
    const t = this._t();
    const def = (t && t.skillDefs && t.skillDefs[skillId]) || null;
    const loc = (t && t.localization) || {};
    const key = def && def.nameKey;
    return (key && loc[key]) || skillId || "?";
  },

  _toastOnce() {
    if (this._toasted) return;
    this._toasted = true;
    /* 正式启用（source === "config"）不弹试玩提示 —— 那是开发期反馈，玩家看不到才对 */
    if (this.source === "config") return;
    try {
      if (typeof UI !== "undefined" && UI && typeof UI.toast === "function") {
        const parts = [];
        for (const hid of this.heroIds) parts.push(hid + "（初始技能：" + this._nameOf(this.initialSkillFor(hid)) + "）");
        UI.toast("技能系统试玩已通电：" + parts.join("，") + " · 踩雕像可获得稀有技能", "gold");
      }
    } catch (e) { /* UI 未就绪则静默 */ }
  },

  /** 稀有技能授予成功提示（每个技能名读文案表）。 */
  _toastRare() {
    try {
      if (typeof UI !== "undefined" && UI && typeof UI.toast === "function") {
        const t = this._t();
        const pool = (t && Array.isArray(t.rareSkillPool)) ? t.rareSkillPool : [];
        const names = pool.map((id) => this._nameOf(id)).join("/");
        UI.toast("雕像授予稀有技能：" + (names || "稀有技能") + "（4 颗水晶同时作用于两个技能）", "gold");
      }
    } catch (e) { /* UI 未就绪则静默 */ }
  },

  /** 当前状态快照（调试 / 测试用）。 */
  status() {
    const t = this._t();
    return {
      active: this.active,
      installed: this._installed,
      patched: this._patched,
      altarPatched: this._patchedAltar,
      heroIds: this.heroIds.slice(),
      enabled: !!(t && t.enabled),
      migrated: (t && Array.isArray(t.migratedHeroIds)) ? t.migratedHeroIds.slice() : [],
      log: this._log.slice(),
    };
  },

  /** 还原（测试用）：卸掉包装（ownsHero + triggerAltar）、清状态。
   *  注意：本函数**不还原 CFG**（与既有口径一致），调用方需要时自行复原内存开关。 */
  reset() {
    if (this._patched && typeof SkillRuntime !== "undefined" && SkillRuntime &&
        typeof SkillRuntime.ownsHero === "function" && this._origOwnsHero) {
      SkillRuntime.ownsHero = this._origOwnsHero;
    }
    if (this._patchedAltar && this._origTriggerAltar &&
        typeof World !== "undefined" && World && World.prototype) {
      World.prototype.triggerAltar = this._origTriggerAltar;
    }
    this.active = false;
    this.source = "off";
    this.heroIds = [];
    this._installed = false;
    this._patched = false;
    this._patchedAltar = false;
    this._toasted = false;
    this._log = [];
    this._origOwnsHero = null;
    this._origTriggerAltar = null;
    return this;
  },
};

/* 记录原始 ownsHero（reset 用；仅在本文件包装前抓一次） */
try {
  if (typeof SkillRuntime !== "undefined" && SkillRuntime && typeof SkillRuntime.ownsHero === "function") {
    SkillPlaytest._origOwnsHero = SkillRuntime.ownsHero;
  }
} catch (e) { /* 环境不支持时静默 */ }

/* 启动自举：带 ?skill=... 才通电；否则整块空转（正式默认零影响） */
try { SkillPlaytest.install(); } catch (e) { /* 任何异常都不影响游戏启动 */ }
try { if (typeof window !== "undefined" && window) window.__skillPlaytest = SkillPlaytest; } catch (e) { /* 无 window 环境静默 */ }
