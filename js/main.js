/* ============================================================
 * main.js — 启动 / 输入 / 主循环 / 界面流程状态机
 * ============================================================ */
"use strict";

const Game = {
  async boot() {
    G.canvas = document.getElementById("game-canvas");
    G.ctx = G.canvas.getContext("2d");
    this.fitCanvas();
    window.addEventListener("resize", () => this.fitCanvas());
    window.addEventListener("orientationchange", () => setTimeout(() => this.fitCanvas(), 120));   // 旋转后布局稳定再重算
    // 素材加载（含抠图）
    await Assets.load(ASSET_MANIFEST);
    const szMul = CFG.monsterSizeMul || 1;   // 怪物体积倍数：精灵按放大后尺寸裁剪，保持清晰
    G.sprites.hero = Assets.fit("hero", 60);
    G.sprites.enemy00 = Assets.fit("enemy00", 48 * szMul);
    G.sprites.enemy08 = Assets.fit("enemy08", 48 * szMul);
    G.sprites.enemy16 = Assets.fit("enemy16", 48 * szMul);
    G.sprites.enemy22 = Assets.fit("enemy22", 130 * szMul);
    this.loadSettings();
    this.bindInput();
    this.bindEvents();
    this.bindTooltip();
    UI.updateHomeUser();
    if (location.protocol === "file:") {
      UI.toast("本地文件模式：素材抠图被浏览器安全策略禁用（角色/怪物带底色）。建议通过助手预览打开", "", 5000);
    }
    G.state = "menu";
    UI.showScreen("screen-main");   // 启动落到游戏首页（→ 主城 → 传送门 → 选关）
    requestAnimationFrame((t) => this.loop(t));
  },
  /* 画布自适应（跨端口径修正）：旧版画布固定 1920×1080 再整体缩进窗口——手机竖屏时
   * 游戏只是屏幕中间一条小横带，角色物理尺寸与 PC 全屏差数倍（「视野/角色大小不一致」的根因）。
   * 现在：画布**分辨率跟随窗口**，垂直视野固定（CFG.camera.viewH）→ 角色大小只由 zoom 决定，
   * PC 与手机一致；宽度随屏幕比例伸缩（过窄的竖屏按 minAspect 钳到 4:3，左右留边）。 */
  fitCanvas() {
    const cam = CFG.camera || {};
    const zoom = cam.zoom || 1.5;
    const viewH = cam.viewH || 720;
    const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;   // 桩环境兜底，防 NaN
    const aspect = vw / Math.max(1, vh);
    G.H = Math.round(viewH * zoom);                                   // 画布高固定（1080）
    G.W = Math.max(Math.round(G.H * (cam.minAspect || 0.75)), Math.round(G.H * aspect));
    G.canvas.width = G.W; G.canvas.height = G.H;
    const scale = Math.min(vw / G.W, vh / G.H);
    G.canvas.style.width = G.W * scale + "px";
    G.canvas.style.height = G.H * scale + "px";
  },

  /* ---------- 界面流程（首页 → 主城 → 传送门 → 选关 → 选角 → 战斗） ---------- */
  enterCharSelect() {
    G.state = "charSel";
    UI.selectedChars = [];   // 每次进入选角重新组队
    UI.buildCharList();
    const startBtn = document.getElementById("btn-char-start");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = `开始游戏（0/${CFG.team.maxSize}）`;
    }
    UI.showScreen("screen-character");
  },
  /* 进入主城（Hub）：创建主城世界与玩家形象；无战斗系统加载（队友/弹道/撤离不进主城） */
  enterCity() {
    G.state = "city";
    G.cityAvatar = createCityAvatar();
    G.cityNpcOpen = null;
    G.cityNpcNear = null;
    G.mainWorld = null; G.subWorld = null; G.riftWorld = null;
    G.activeWorld = new World(CFG.city.mapW, CFG.city.mapH, false, "city");
    UI.showHudOnly();
    const hud = document.getElementById("hud");
    if (hud) hud.classList.add("city-mode");
    if (typeof UI.updateCityHUD === "function") UI.updateCityHUD();
    UI.toast(`欢迎回到主城，${Meta.profileName()}：找 NPC 强化，中央上方传送门出征`, "gold");
  },
  startRun(chars) {
    // 多角色组队：1~3 名英雄，第一名是队长（玩家操控），其余为 AI 队友
    const list = Array.isArray(chars) ? chars : [chars];
    G.team = list.map(h => applyOutLevel(h));
    G.heroDef = G.team[0];
    G.levelCfg = UI.selectedLevel;
    G.run = createRun(G.heroDef);
    G.player = new Player(G.levelCfg.mapW / 2, G.levelCfg.mapH / 2);   // 出生在地图正中心
    G.mainWorld = new World(G.levelCfg.mapW, G.levelCfg.mapH, true);
    seedTrail(G.mainWorld, CFG.team.follow.seedDir[0], CFG.team.follow.seedDir[1]);   // 预铺尾迹：队友沿 seedDir 方向列队
    snapCompanions(G.mainWorld);
    G.subWorld = null;
    G.inArtisan = false;
    G.activeWorld = G.mainWorld;
    // 图鉴：本局出战英雄全部激活（解锁同名皮肤）
    for (const h of list) Meta.activateHero(h.id);
    recomputeWeapon();   // 开局即解析全队技能（含队友），避免首帧前 c.skills 为空
    G.state = "playing";
    UI.showHudOnly();
    if (typeof UI.updateAutoFightBtn === "function") UI.updateAutoFightBtn();   // 每局按钮重置为关（run.autoFight 默认 false；测试 UI 桩缺该方法时跳过）
    const hud = document.getElementById("hud");
    if (hud) hud.classList.remove("city-mode");
    UI.toast(`进入 ${G.levelCfg.name} · 局外 LV${G.heroDef.outLevel} · WASD 移动 · 技能自动释放 · B 背包`, "gold");
  },
  /* 跳过当前世界的开场冻结（仅测试/调试用）。
   * 主关卡与裂缝进场都有 3 秒冻结（CFG.levelFreeze / CFG.rift.freezeTime），
   * 会吃掉「startRun 后立刻 step(N)」这类测试的前 N 帧进度 —— 相关测试在 startRun 后调用本函数即可复位。 */
  skipIntroFreeze() {
    if (G.mainWorld) G.mainWorld.freezeTimer = 0;
    if (G.activeWorld) G.activeWorld.freezeTimer = 0;
  },
  /* 清理局内状态（返回任一界面层前的统一收尾，不动 settings/config） */
  _clearRunState() {
    G.state = "menu"; G.run = null; G.player = null; G.team = null;
    G.mainWorld = null; G.subWorld = null; G.riftWorld = null; G.activeWorld = null;
    G.inArtisan = false; G.inRift = false;
    UI.toggleBackpack(false); UI.toggleArtisan(false);
  },
  /* 战斗结束（撤离/死亡）→ 回主城（Hub 是家，出征从主城出发也回到主城） */
  backToMenu() {
    this._clearRunState();
    UI.closeNpcPanels && UI.closeNpcPanels();
    this.enterCity();
  },
  /* 首页（游戏启动页） */
  toMainMenu() {
    this._clearRunState();
    UI.updateHomeUser();
    UI.showScreen("screen-main");
  },
  /* 主城传送门 → 关卡选择（选完关进角色选择，后面流程不变） */
  openLevelSelect() {
    G.state = "menu";
    UI.buildLevelList();
    UI.showScreen("screen-level");
  },
  /* 返回主城（关卡选择「返回」按钮；出征中途反悔不算撤离） */
  returnToCity() {
    this.enterCity();
  },

  /* ---------- 事件（事件总线 13.14） ---------- */
  bindEvents() {
    // 空值保护的事件绑定：测试 DOM 桩下元素可能缺失，不应抛异常
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    /* ---- 首页（开始/操作说明/设置/图鉴/退出） ---- */
    on("btn-main-start", () => this.enterCity());               // 首页「开始游戏」→ 主城
    on("btn-home-help", () => { UI.showScreen("screen-help"); });
    on("btn-home-settings", () => { UI.renderSettings(); UI.showScreen("screen-settings"); });
    on("btn-home-codex", () => UI.showCodex());
    on("btn-home-exit", () => UI.showScreen("screen-goodbye")); // 网页端伪退出：告别遮罩（打包后为真退出预留）
    on("btn-help-back", () => UI.showScreen("screen-main"));
    on("btn-settings-back", () => { UI.updateHomeUser(); UI.showScreen("screen-main"); });
    on("btn-codex-back", () => {
      if (G.state === "city") {   // 从主城图鉴学者进入：关闭图鉴页恢复主城 HUD（世界/位置不动）
        UI.showHudOnly();
        if (typeof UI.updateCityHUD === "function") { UI._cityHudSig = ""; UI.updateCityHUD(); }
      } else {
        UI.updateHomeUser();
        UI.showScreen("screen-main");
      }
    });
    on("btn-goodbye-back", () => UI.showScreen("screen-main"));
    /* ---- 流程：选关 / 选角 / 结算 / 死亡 ---- */
    on("btn-level-back", () => this.returnToCity());            // 选关「返回」→ 回主城
    on("btn-char-back", () => this.openLevelSelect());          // 角色选择 → 关卡选择
    on("btn-char-start", () => {
      if (UI.selectedChars && UI.selectedChars.length) this.startRun(UI.selectedChars);
    });
    on("btn-settle-ok", () => this.backToMenu());
    on("btn-death-ok", () => this.backToMenu());
    /* ---- 背包 / 工匠 / 卡牌 ---- */
    on("btn-bp-close", () => UI.toggleBackpack(false));
    on("btn-artisan-close", () => UI.toggleArtisan(false));
    // 自动战斗开关（默认关）：开启后队长移动+技能全托管（玩家手动操作即让权）
    on("btn-autofight", () => {
      if (!G.run) return;
      G.run.autoFight = !G.run.autoFight;
      if (G.run.autoFight) G.run.aiHoldT = 0;   // 开启瞬间立即接管（不等手动延迟）
      UI.updateAutoFightBtn();
      UI.toast(G.run.autoFight ? "自动战斗开启：AI 接管走位与技能（手动操作会临时让权）" : "自动战斗关闭", "");
    });
    // 自动战斗风格（疯狂/平衡/冷静）：打包索敌激进度/躲避范围/反应速度/低血量行为
    const afStyles = document.getElementById("autofight-styles");
    if (afStyles) {
      for (const b of afStyles.children) {
        b.onclick = () => {
          if (!G.run) return;
          G.run.autoStyle = b.dataset.style;
          G.run.aiThreatSeen = null;   // 风格切换清空威胁反应计时（立即按新延迟重新评估）
          UI.updateAutoFightBtn();
          const s = CFG.autoFight.styles[G.run.autoStyle];
          UI.toast(`AI 风格 → ${s.name}：${s.desc}`, "gold");
        };
      }
    }
    // 工匠面板页签：开宝箱 / 抽卡牌 / 购买·服务
    on("art-tab-chest", () => UI.setArtisanTab("chest"));
    on("art-tab-cards", () => UI.setArtisanTab("cards"));
    on("art-tab-shop", () => UI.setArtisanTab("shop"));
    on("btn-card-refresh", () => {
      refreshCards();          // 免费次数优先，用完后扣金币；失败（金币不足）时内部已 toast
      UI.renderCards();
    });
    /* ---- 主城 NPC 面板（进圈弹窗 / 离圈自动关闭）+ 角色档案 ---- */
    on("btn-npc-outlevel-close", () => UI.closeNpcPanels());
    on("btn-npc-weapon-close", () => UI.closeNpcPanels());
    on("btn-profile-close", () => UI.closeNpcPanels());
    on("btn-profile-rename", () => {
      const input = document.getElementById("profile-name-input");
      if (!input) return;
      if (!Meta.rename(input.value)) { UI.toast(`名字需 ${CFG.profile.nameMin}~${CFG.profile.nameMax} 个字符`, "bad"); return; }
      UI.toast(`已更名：${Meta.profileName()}`, "gold");
      UI.renderProfile();
      if (typeof UI.updateCityHUD === "function") { UI._cityHudSig = ""; UI.updateCityHUD(); }
    });
    /* ---- 设置（音效音量 / 触屏控件缩放 / 桌面显示触屏控件） ---- */
    const sfxSlider = document.getElementById("set-sfx");
    if (sfxSlider) sfxSlider.oninput = () => { G.settings.sfxVolume = Number(sfxSlider.value); this.applySettings(); };
    const joySlider = document.getElementById("set-joy");
    if (joySlider) joySlider.oninput = () => { G.settings.joyScale = Number(joySlider.value); this.applySettings(); };
    const touchToggle = document.getElementById("set-touch");
    if (touchToggle) touchToggle.onclick = () => {
      G.settings.showTouchOnDesktop = !G.settings.showTouchOnDesktop;
      this.applySettings();
    };
    on("btn-set-sfx-mute", () => {
      G.settings.sfxVolume = G.settings.sfxVolume > 0 ? 0 : CFG.settings.sfxVolume.default;
      const sfxSlider2 = document.getElementById("set-sfx");
      if (sfxSlider2) sfxSlider2.value = G.settings.sfxVolume;
      this.applySettings();
    });
    /* ---- 主城事件：传送门读条完成 → 选关；NPC 进圈弹面板 / 离圈关闭 ---- */
    EventBus.on("cityPortalEnter", () => {
      if (G.state !== "city") return;
      G.state = "menu";
      const hud = document.getElementById("hud");
      if (hud) hud.classList.remove("city-mode");
      this.openLevelSelect();
    });
    EventBus.on("cityNpcPanel", (npc) => { if (G.state === "city") UI.openNpcPanel(npc); });
    EventBus.on("cityNpcClose", () => UI.closeNpcPanels());
    EventBus.on("openArtisanUI", () => UI.toggleArtisan(true));
    EventBus.on("enterArtisan", () => {
      G.subWorld = new World(1920, 1920, false);   // 工匠世界：固定 1920×1920（与关卡地图统一）
      G.inArtisan = true;
      G.activeWorld = G.subWorld;
      clearExtractChannel();   // 离开主地图 → 撤离读条状态清空（雕像保留，回来可继续读）
      // 出生点规则：出口正上方不远处，但在出口判定圈之外（圈内会自动累计返回读条）
      const exitR = 100 * CFG.altarJudgeMul;
      G.player.x = G.subWorld.exitBeacon.x;
      G.player.y = G.subWorld.exitBeacon.y - exitR - 60;
      G.player.mvx = 0; G.player.mvy = 0;
      // 预铺尾迹朝上（远离出口圈），队友列队在队长上方，不会落进返回判定圈
      seedTrail(G.subWorld, CFG.team.follow.seedDirArtisan[0], CFG.team.follow.seedDirArtisan[1]);
      G.subWorld.exitProgress = 0;
      snapCompanions();   // 队友瞬移到队长身边（原地图位置不保留）
      if (!G.run.cardCandidates) G.run.cardCandidates = drawCardCandidates();   // 首次进入抽取卡牌候选
      UI.toast("进入工匠世界（安全区）· 开箱 / 使用属性卡牌 · 底部出口返回", "gold");
    });
    EventBus.on("returnToMain", () => {
      G.inArtisan = false;
      G.activeWorld = G.mainWorld;   // 原地图状态保留（怪物冻结在离开时状态）
      G.subWorld = null;
      snapCompanions();   // 队友瞬移回队长身边（离开时未跟随）
      UI.toggleArtisan(false);
      UI.toast("返回原地图", "gold");
    });
    /* ---------- 空间裂缝（5.1 / 13.10） ---------- */
    EventBus.on("enterRift", () => {
      if (G.state !== "playing" || G.inRift) return;
      if (G.run.extractChanneling) clearExtractChannel();   // 传送取消撤离读条（雕像保留）
      G.riftReturnPos = { x: G.player.x, y: G.player.y };       // 保存 A 地图离开位置
      // 先定任务、先把玩家挪到子地图出生点：子地图构造时会按 spawnCount 一次性投放敌人并据此避让玩家
      const tw = {}; CFG.rift.tasks.forEach((t, i) => tw[i] = t.weight);
      const tdef = CFG.rift.tasks[Number(U.weightedPick(tw))];
      G.run.riftKills = 0; G.run.riftRewarded = false;
      G.run.riftTask = { ...tdef, remain: tdef.time || 0, done: false, failed: false };
      G.player.x = CFG.rift.worldSize / 2; G.player.y = CFG.rift.worldSize / 2;
      G.riftWorld = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
      G.activeWorld = G.riftWorld;
      G.inRift = true;
      seedTrail(G.riftWorld, CFG.team.follow.seedDir[0], CFG.team.follow.seedDir[1]);
      snapCompanions(G.riftWorld);
      UI.toast(`◈ 进入空间裂缝！本次任务【${tdef.name}】：${tdef.desc}（完成得额外宝箱）`, "gold");
    });
    EventBus.on("returnFromRift", () => {
      if (!G.inRift) return;
      G.inRift = false;
      G.activeWorld = G.mainWorld;                              // A 地图状态保留（怪/物/进度不变）
      G.player.x = G.riftReturnPos.x; G.player.y = G.riftReturnPos.y;
      G.riftWorld = null;
      snapCompanions(G.mainWorld);
      UI.toast("◈ 穿过返回信标，回到原地图（状态已保留）", "gold");
    });
    EventBus.on("extractSuccess", () => {
      if (G.state !== "playing") return;
      G.state = "settled";
      // 局内→局外资源转化（待细化 5 已定）：背包/武器栏内**所有物品**按各自**固定价值 × 统一折算率**
      // 折算为结晶（宝箱 / 装备 / 武器模块 / 消耗品 / 卡牌同一口径；保险契约不再单独折算）。
      // 局内经验与金币归零、不参与折算。
      const conv = calcSettleConvert(G.run);
      if (conv.total > 0) { Meta.data.crystals += conv.total; Meta.commit(); }
      G.run.settleConv = conv;   // 结算界面展示明细
      const crystals = Meta.awardRun(G.run.kills, G.run.bossDefeated, true) + conv.total;
      // 解锁链：撤离成功解锁下一关（死亡不解锁，搜打撤的"搜"是门票）
      const idx = CFG.levels.indexOf(G.levelCfg);
      if (idx >= 0 && idx + 1 < CFG.levels.length && Meta.data.unlockedLevels < idx + 2) {
        Meta.data.unlockedLevels = idx + 2;
        Meta.commit();
        UI.toast(`🔓 解锁 ${CFG.levels[idx + 1].name}`, "gold");
      }
      Meta.setFlag("firstExtract");   // 称号成就：完成一次撤离
      SFX.play("extract");
      UI.toggleArtisan(false); UI.toggleBackpack(false);
      UI.showSettlement(crystals);
    });
    EventBus.on("playerDied", (penalty) => {
      const crystals = Meta.awardRun(G.run.kills, G.run.bossDefeated, false);
      SFX.play("death");
      UI.toggleArtisan(false); UI.toggleBackpack(false);
      UI.showDeath(penalty, crystals);
    });
  },

  /* ---------- 输入 ---------- */
  bindInput() {
    // 音频需在用户手势后启动（浏览器自动播放策略）
    const kick = () => { SFX.init(); SFX.resume(); };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    // 移动端虚拟控件（手机端测试）：触屏设备自动显示，参数在 CFG.mobile
    this.bindTouch();
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      G.keys[k] = true;
      if (k === " ") e.preventDefault();
      if (k === "b" && G.state === "playing") UI.toggleBackpack();
      if (k === "e" && G.inArtisan && G.state === "playing") UI.toggleArtisan();
      if (k === "escape" && G.state === "city") UI.closeNpcPanels();   // 主城：Esc 关闭 NPC 面板
      // 撤离点雕像（5.2）：**站进雕像圈内自动读条**（8 秒，受击归零）；E 仅用于查看进度 / 节流提示
      if (k === "e") this.actionE();
    });
    window.addEventListener("keyup", (e) => { G.keys[e.key.toLowerCase()] = false; });
    // 网格物品拖拽起点（事件委托）
    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest && e.target.closest(".itm");
      if (el && G.run && !UI.drag) {
        const uid = Number(el.dataset.uid);
        const it = [...G.run.backpack.items, ...G.run.weaponInv.items].find(i => i.uid === uid);
        if (it) UI.startDrag(e, { item: it, fromPending: false });
      }
    });
    document.addEventListener("pointermove", (e) => UI.onPointerMove(e));
    document.addEventListener("pointerup", (e) => UI.onPointerUp(e));
    // 物品悬停信息（事件委托）
    document.addEventListener("pointerover", (e) => {
      const el = e.target.closest && e.target.closest(".itm");
      if (el && G.run) {
        const uid = Number(el.dataset.uid);
        const it = [...G.run.backpack.items, ...G.run.weaponInv.items].find(i => i.uid === uid);
        if (it) { UI.hoverItem = it; UI.renderItemInfo(); }
      }
    });
  },

  /* ---------- E 键逻辑（键盘与触屏「交互」按钮共用） ----------
   * 主城：圈内 NPC 按 E 弹面板（再按同一 NPC 或 Esc 关闭）；战斗地图：撤离点读条提示。 */
  actionE() {
    if (G.state === "city") {
      const near = G.cityNpcNear;
      if (!near) return;                                  // 圈外无交互目标
      if (G.cityNpcOpen && G.cityNpcOpen.id === near.id) { UI.closeNpcPanels(); return; }   // 再按 = 关闭
      G.cityNpcOpen = near;
      SFX.play("altar");
      EventBus.emit("cityNpcPanel", near);
      return;
    }
    if (!(G.state === "playing" && !G.inArtisan && !G.inRift && G.run && G.run.exitStatue)) return;
    const st = G.run.exitStatue;
    // 判定圈规则（5.2）：**任一存活英雄在圈内即自动读条**，E 不再是开关，只用于查看进度/提示
    if (heroInCircle(st.x, st.y, CFG.extract.radius)) {
      const sec = Math.max(0, CFG.extract.channel - (G.run.extractProgress || 0));
      UI.toast(`撤离读条中：剩余 ${sec.toFixed(1)} 秒（站进圈内自动读条，无需按键）`, "gold");
    } else if (G.time - (this._extractHintT || 0) > 3) {
      this._extractHintT = G.time;
      UI.toast("撤离点：让任一小队成员站进雕像圈内即自动读条 8 秒（受击归零）", "bad");
    }
  },

  /* ---------- 移动端虚拟控件（触屏摇杆 + 按钮；参数 CFG.mobile） ----------
   * 摇杆：G.joy = {active, dx, dy}，归一化向量带死区，Player.update 优先于键盘。
   * 按钮：技能 = 按住等价 Space；交互 = actionE()（主地图撤离提示）/ 工匠面板开关；
   *       背包 = toggleBackpack()。桌面端无触屏不显示，不遮挡键鼠操作。 */
  bindTouch() {
    const mob = CFG.mobile || {};
    if (!mob.autoShow) return;
    // 触屏检测（桩测试环境下无 navigator/ontouchstart，取值前先判能力）
    const isTouch = (typeof window.ontouchstart !== "undefined") ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    if (!isTouch) return;
    const tc = document.getElementById("touch-controls");
    if (tc) tc.classList.remove("hidden");
    if (document.body) document.body.classList.add("touch-mode");

    // --- 虚拟摇杆 ---
    const base = document.getElementById("joy-base");
    const stick = document.getElementById("joy-stick");
    if (base && stick) {
      const jc = mob.joystick || {};
      const size = jc.size || 132, knob = jc.knob || 56;
      const dead = jc.deadZone || 0.18, maxR = size / 2 - knob / 2;
      let pid = null;
      const setKnob = (vx, vy) => {
        stick.style.left = (size / 2 - knob / 2 + vx * maxR) + "px";
        stick.style.top = (size / 2 - knob / 2 + vy * maxR) + "px";
      };
      const apply = (e) => {
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        let vx = (e.clientX - cx) / maxR, vy = (e.clientY - cy) / maxR;
        const l = Math.hypot(vx, vy);
        if (l > 1) { vx /= l; vy /= l; }   // 钳制在底盘内
        setKnob(vx, vy);
        const mag = Math.hypot(vx, vy);
        if (mag < dead) { G.joy.dx = 0; G.joy.dy = 0; }   // 死区：视为静止
        else { G.joy.dx = vx; G.joy.dy = vy; }
      };
      base.addEventListener("pointerdown", (e) => {
        pid = e.pointerId;
        try { base.setPointerCapture(pid); } catch (err) { /* 桩/旧浏览器忽略 */ }
        G.joy.active = true;
        apply(e);
        e.preventDefault();
      });
      base.addEventListener("pointermove", (e) => { if (G.joy.active && e.pointerId === pid) apply(e); });
      const release = (e) => {
        if (e.pointerId !== pid) return;
        pid = null; G.joy.active = false; G.joy.dx = 0; G.joy.dy = 0;
        setKnob(0, 0);
      };
      base.addEventListener("pointerup", release);
      base.addEventListener("pointercancel", release);
    }

    // --- 动作按钮 ---
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("pointerdown", fn); };
    const btn = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    const skill = document.getElementById("btn-touch-skill");
    if (skill) {
      skill.addEventListener("pointerdown", (e) => { G.keys[" "] = true; e.preventDefault(); });
      skill.addEventListener("pointerup", () => { G.keys[" "] = false; });
      skill.addEventListener("pointercancel", () => { G.keys[" "] = false; });
      skill.addEventListener("pointerleave", () => { G.keys[" "] = false; });
    }
    btn("btn-touch-bag", () => { if (G.state === "playing") UI.toggleBackpack(); });
    btn("btn-touch-act", () => {
      if (G.state === "city") { this.actionE(); return; }   // 主城：与 NPC 互动
      if (G.state !== "playing") return;
      if (G.inArtisan) UI.toggleArtisan();   // 工匠世界内：开/关工坊面板
      else this.actionE();                    // 主地图：撤离点提示（圈内自动读条）
    });
  },

  /* ---------- 设置（独立 localStorage 持久化；CFG.settings 定义默认值与范围） ---------- */
  loadSettings() {
    G.settings = {
      sfxVolume: CFG.settings.sfxVolume.default,
      joyScale: CFG.settings.joyScale.default,
      showTouchOnDesktop: CFG.settings.showTouchOnDesktop.default,
    };
    try {
      const raw = localStorage.getItem(CFG.settings.saveKey);
      if (raw) Object.assign(G.settings, JSON.parse(raw));
    } catch (e) { /* 测试环境无 localStorage */ }
    this.applySettings();
  },
  applySettings() {
    const s = G.settings;
    // 音效音量：直接驱动 SFX 主增益（未初始化时记下，init 时用）
    if (SFX.master) SFX.master.gain.value = s.sfxVolume;
    else if (CFG.audio) CFG.audio.master = s.sfxVolume;
    // 触屏控件整体缩放（zoom 对绝对定位子元素整体生效；不支持 zoom 的浏览器忽略）
    const tc = document.getElementById("touch-controls");
    if (tc) { try { tc.style.zoom = s.joyScale; } catch (e) { /* 忽略 */ } }
    // 桌面端强制显示触屏控件（调试用）：仅当未处于隐藏的全屏界面时
    if (tc && s.showTouchOnDesktop) tc.classList.remove("hidden");
    else if (tc && !s.showTouchOnDesktop && !("ontouchstart" in window)) tc.classList.add("hidden");
    try { localStorage.setItem(CFG.settings.saveKey, JSON.stringify(s)); } catch (e) { }
  },

  /* ---------- 物品 TIPS 事件（桌面悬停延迟 / 移动端长按；一个浮窗全场景复用） ---------- */
  bindTooltip() {
    const delay = (CFG.tooltip && CFG.tooltip.hoverDelay * 1000) || 280;
    const press = (CFG.tooltip && CFG.tooltip.pressDelay * 1000) || 380;
    const findItem = (el) => {
      const target = el.closest && el.closest(".itm, .pending-item");
      if (!target || !G.run) return null;
      const uid = Number(target.dataset.uid);
      if (!uid) return null;
      return [...G.run.backpack.items, ...G.run.weaponInv.items, ...G.run.pendingItems].find(i => i.uid === uid) || null;
    };
    document.addEventListener("pointerover", (e) => {
      const it = findItem(e.target);
      clearTimeout(this._tipTimer);
      if (!it) { UI.hideTooltip(); return; }
      this._tipTimer = setTimeout(() => UI.showTooltip(it, e.clientX, e.clientY), delay);   // 延迟出现：快速划过不闪烁
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest && e.target.closest(".itm, .pending-item")) {
        clearTimeout(this._tipTimer);
        UI.hideTooltip();
      }
    });
    document.addEventListener("pointermove", (e) => {
      if (UI.drag) { clearTimeout(this._tipTimer); UI.hideTooltip(); return; }   // 拖拽中不弹提示
      UI.moveTooltip(e.clientX, e.clientY);
    });
    // 移动端长按：按下后 380ms 无拖拽则弹出（松手即收起）
    document.addEventListener("pointerdown", (e) => {
      const it = findItem(e.target);
      if (!it || e.pointerType === "mouse") return;
      clearTimeout(this._pressTimer);
      this._pressTimer = setTimeout(() => { if (!UI.drag) UI.showTooltip(it, e.clientX, e.clientY); }, press);
    });
    const pressEnd = () => { clearTimeout(this._pressTimer); UI.hideTooltip(); };
    document.addEventListener("pointerup", pressEnd);
    document.addEventListener("pointercancel", pressEnd);
  },

  /* ---------- 主循环 ---------- */
  lastT: 0,
  loop(t) {
    // 先续帧：任何单帧异常（如 UI 渲染错误）不再中断主循环导致游戏冻结
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    G.time += dt;
    if (G.state === "playing") {
      recomputeWeapon();
      // 子地图开场冻结（5.1）：全员静止 + 全员无敌 —— 跳过玩家/同伴更新，也不推进撤离读条；
      // 怪物/子弹/祭坛等由 World.update 内部同样的闸门拦住，伤害结算天然不会发生
      const frozen = G.activeWorld && G.activeWorld.freezeTimer > 0;
      if (frozen) {
        G.player.mvx = 0; G.player.mvy = 0;   // 清零移动意图，避免解冻瞬间滑行
      } else {
        G.player.update(G.activeWorld, dt);
        updateCompanions(G.activeWorld, dt);
      }
      G.activeWorld.update(dt);
      // 撤离读条推进（5.2）：**任一存活英雄在圈内即自动读条**（判定圈统一规则，见 judgeChannel）；
      // 移动本身不再打断，圈内英雄全部离开才按判定规则衰退；受击打断在 heroTakeDamage 中处理。
      // 仅主地图存在撤离点，工匠世界 / 裂缝中不推进。
      if (!frozen && G.activeWorld && G.activeWorld.isMain) updateExtractJudge(dt);
      updateFX(dt);
      UI.updateHUD();
    } else if (G.state === "city") {
      // 主城：玩家形象行走 + NPC/传送门交互（无战斗系统）
      updateCityWorld(dt);
      updateFX(dt);
      if (typeof UI.updateCityHUD === "function") UI.updateCityHUD();
    } else {
      updateFX(dt);
    }
    if (G.state === "playing" && G.activeWorld) render();
    else if (G.state === "city" && G.activeWorld) renderCity();
  },
};

window.addEventListener("DOMContentLoaded", () => Game.boot());
Game.loadSettings();   // 脚本加载即恢复设置（boot 前也要有默认值，防止测试/早期调用读不到）
