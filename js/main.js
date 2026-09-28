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
    // 素材加载（含抠图）
    await Assets.load(ASSET_MANIFEST);
    const szMul = CFG.monsterSizeMul || 1;   // 怪物体积倍数：精灵按放大后尺寸裁剪，保持清晰
    G.sprites.hero = Assets.fit("hero", 60);
    G.sprites.enemy00 = Assets.fit("enemy00", 48 * szMul);
    G.sprites.enemy08 = Assets.fit("enemy08", 48 * szMul);
    G.sprites.enemy16 = Assets.fit("enemy16", 48 * szMul);
    G.sprites.enemy22 = Assets.fit("enemy22", 130 * szMul);
    this.bindInput();
    this.bindEvents();
    UI.buildLevelList();
    if (location.protocol === "file:") {
      UI.toast("本地文件模式：素材抠图被浏览器安全策略禁用（角色/怪物带底色）。建议通过助手预览打开", "", 5000);
    }
    G.state = "menu";
    UI.showScreen("screen-main");   // 启动落到主菜单（→ 关卡选择 → 角色选择）
    requestAnimationFrame((t) => this.loop(t));
  },
  fitCanvas() {
    const scale = Math.min(window.innerWidth / G.W, window.innerHeight / G.H);
    G.canvas.style.width = G.W * scale + "px";
    G.canvas.style.height = G.H * scale + "px";
  },

  /* ---------- 界面流程 ---------- */
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
    recomputeWeapon();   // 开局即解析全队技能（含队友），避免首帧前 c.skills 为空
    G.state = "playing";
    UI.showHudOnly();
    UI.toast(`进入 ${G.levelCfg.name} · 局外 LV${G.heroDef.outLevel} · WASD 移动 · Space 技能 · B 背包`, "gold");
  },
  /* 清理局内状态（返回任一界面层前的统一收尾，不动 settings/config） */
  _clearRunState() {
    G.state = "menu"; G.run = null; G.player = null; G.team = null;
    G.mainWorld = null; G.subWorld = null; G.riftWorld = null; G.activeWorld = null;
    G.inArtisan = false; G.inRift = false;
    UI.toggleBackpack(false); UI.toggleArtisan(false);
  },
  backToMenu() {
    // 语义保持：回到【关卡选择页】（结算/死亡界面的「确认返回选关」依赖此落点）
    this._clearRunState();
    UI.buildLevelList();
    UI.showScreen("screen-level");
  },
  toMainMenu() {
    // 回到【主菜单】（清理逻辑与 backToMenu 一致，仅落点不同）
    this._clearRunState();
    UI.buildLevelList();
    UI.showScreen("screen-main");
  },
  openLevelSelect() {
    // 主菜单「开始游戏」→ 关卡选择页
    G.state = "menu";
    UI.buildLevelList();
    UI.showScreen("screen-level");
  },
  openMeta() {
    // 主菜单「局外成长」→ 局外成长界面
    G.state = "menu";
    UI.renderMeta();
    UI.showScreen("screen-meta");
  },

  /* ---------- 事件（事件总线 13.14） ---------- */
  bindEvents() {
    // 空值保护的事件绑定：测试 DOM 桩下元素可能缺失，不应抛异常
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on("btn-main-start", () => this.openLevelSelect());        // 主菜单 → 关卡选择
    on("btn-main-meta", () => this.openMeta());                // 主菜单 → 局外成长
    on("btn-level-back", () => this.toMainMenu());             // 关卡选择 → 主菜单
    on("btn-meta-back", () => this.toMainMenu());              // 局外成长 → 主菜单
    on("btn-char-back", () => this.openLevelSelect());         // 角色选择 → 关卡选择
    on("btn-char-start", () => {
      if (UI.selectedChars && UI.selectedChars.length) this.startRun(UI.selectedChars);
    });
    on("btn-bp-close", () => UI.toggleBackpack(false));
    on("btn-artisan-close", () => UI.toggleArtisan(false));
    on("btn-card-refresh", () => {
      refreshCards();          // 免费次数优先，用完后扣金币；失败（金币不足）时内部已 toast
      UI.renderCards();
    });
    on("btn-settle-ok", () => this.backToMenu());
    on("btn-death-ok", () => this.backToMenu());

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
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      G.keys[k] = true;
      if (k === " ") e.preventDefault();
      if (k === "b" && G.state === "playing") UI.toggleBackpack();
      if (k === "e" && G.inArtisan && G.state === "playing") UI.toggleArtisan();
      // 撤离点雕像（5.2）：**站进雕像圈内自动读条**（8 秒，受击归零）；E 仅用于查看进度 / 节流提示
      if (k === "e" && G.state === "playing" && !G.inArtisan && !G.inRift && G.run && G.run.exitStatue) {
        const st = G.run.exitStatue;
        // 判定圈规则（5.2）：**任一存活英雄在圈内即自动读条**，E 不再是开关，只用于查看进度/提示
        if (heroInCircle(st.x, st.y, CFG.extract.radius)) {
          const sec = Math.max(0, CFG.extract.channel - (G.run.extractProgress || 0));
          UI.toast(`撤离读条中：剩余 ${sec.toFixed(1)} 秒（站进圈内自动读条，无需按键）`, "gold");
        } else if (G.time - (this._extractHintT || 0) > 3) {
          this._extractHintT = G.time;
          UI.toast("撤离点：让任一小队成员站进雕像圈内即自动读条 8 秒（受击归零）", "bad");
        }
      }
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
    } else {
      updateFX(dt);
    }
    if (G.activeWorld && (G.state === "playing")) render();
  },
};

window.addEventListener("DOMContentLoaded", () => Game.boot());
