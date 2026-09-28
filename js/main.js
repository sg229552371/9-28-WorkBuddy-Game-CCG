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
    UI.showScreen("screen-level");
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
    startBtn.disabled = true;
    startBtn.textContent = `开始游戏（0/${CFG.team.maxSize}）`;
    document.getElementById("screen-level").classList.add("hidden");
    document.getElementById("screen-character").classList.remove("hidden");
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
    G.state = "playing";
    UI.showHudOnly();
    UI.toast(`进入 ${G.levelCfg.name} · 局外 LV${G.heroDef.outLevel} · WASD 移动 · Space 技能 · B 背包`, "gold");
  },
  backToMenu() {
    G.state = "menu"; G.run = null; G.player = null; G.team = null;
    G.mainWorld = null; G.subWorld = null; G.riftWorld = null; G.activeWorld = null;
    G.inArtisan = false; G.inRift = false;
    UI.toggleBackpack(false); UI.toggleArtisan(false);
    UI.buildLevelList();
    UI.showScreen("screen-level");
  },

  /* ---------- 事件（事件总线 13.14） ---------- */
  bindEvents() {
    document.getElementById("btn-char-back").onclick = () => {
      G.state = "menu";
      document.getElementById("screen-character").classList.add("hidden");
      document.getElementById("screen-level").classList.remove("hidden");
    };
    document.getElementById("btn-char-start").onclick = () => {
      if (UI.selectedChars && UI.selectedChars.length) this.startRun(UI.selectedChars);
    };
    document.getElementById("btn-bp-close").onclick = () => UI.toggleBackpack(false);
    document.getElementById("btn-artisan-close").onclick = () => UI.toggleArtisan(false);
    document.getElementById("btn-card-refresh").onclick = () => {
      if (!refreshCards(true)) UI.toast("刷新失败（免费次数用完且结晶不足 ◆15）", "bad");
      UI.renderCards();
    };
    document.getElementById("btn-settle-ok").onclick = () => this.backToMenu();
    document.getElementById("btn-death-ok").onclick = () => this.backToMenu();

    EventBus.on("openArtisanUI", () => UI.toggleArtisan(true));
    EventBus.on("enterArtisan", () => {
      G.subWorld = new World(1920, 1920, false);   // 工匠世界：固定 1920×1920（与关卡地图统一）
      G.inArtisan = true;
      G.activeWorld = G.subWorld;
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
      if (G.run.extractChanneling) { G.run.extractChanneling = false; G.run.extractProgress = 0; }   // 传送取消撤离读条（代币保留）
      G.riftReturnPos = { x: G.player.x, y: G.player.y };       // 保存 A 地图离开位置
      G.riftWorld = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
      G.activeWorld = G.riftWorld;
      G.inRift = true;
      G.player.x = G.riftWorld.w / 2; G.player.y = G.riftWorld.h / 2;
      seedTrail(G.riftWorld, CFG.team.follow.seedDir[0], CFG.team.follow.seedDir[1]);
      snapCompanions(G.riftWorld);
      G.run.riftKills = 0; G.run.riftRewarded = false;
      // 任务变体（待细化 20 / §五）：按权重随机一个任务（非强制，完成给额外高价值宝箱）
      const tw = {}; CFG.rift.tasks.forEach((t, i) => tw[i] = t.weight);
      const tdef = CFG.rift.tasks[Number(U.weightedPick(tw))];
      G.run.riftTask = { ...tdef, remain: tdef.time || 0, done: false, failed: false };
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
      // 保险契约折算：撤离成功时剩余契约折算进化结晶
      const n = insuranceCount(G.run);
      const refund = n * CFG.insurance.crystalRefund;
      if (n > 0) { consumeInsurance(G.run, n); Meta.data.crystals += refund; Meta.commit(); }
      // 局内→局外资源转化（待细化 5）：金币/未开封宝箱/装备模组/剩余卡牌 → 结晶
      const conv = calcSettleConvert(G.run);
      if (conv.total > 0) { Meta.data.crystals += conv.total; Meta.commit(); }
      G.run.settleConv = conv;   // 结算界面展示明细
      const crystals = Meta.awardRun(G.run.kills, G.run.bossDefeated, true) + refund + conv.total;
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
      // 撤离点代币（5.2）：主地图任意位置按 E 激活/取消读条（8 秒，受击/移动归零）
      if (k === "e" && G.state === "playing" && !G.inArtisan && !G.inRift && G.run && G.run.extractToken) {
        G.run.extractChanneling = !G.run.extractChanneling;
        G.run.extractProgress = 0;
        UI.toast(G.run.extractChanneling ? "开始撤离读条 8 秒（移动/受击将打断）…" : "已取消撤离读条", "gold");
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
      G.player.update(G.activeWorld, dt);
      updateCompanions(G.activeWorld, dt);
      G.activeWorld.update(dt);
      // 撤离读条推进（5.2）：移动打断归零并停止（受击打断在 heroTakeDamage 中处理）
      const r = G.run;
      if (r.extractChanneling) {
        if (Math.abs(G.player.mvx) + Math.abs(G.player.mvy) > 0) {
          r.extractChanneling = false; r.extractProgress = 0;
          UI.toast("撤离读条被打断！（代币保留，可再次按 E）", "bad");
        } else {
          r.extractProgress = (r.extractProgress || 0) + dt;
          if (r.extractProgress >= CFG.extract.channel) {
            r.extractChanneling = false; r.extractProgress = 0;
            EventBus.emit("extractSuccess");
          }
        }
      }
      updateFX(dt);
      UI.updateHUD();
    } else {
      updateFX(dt);
    }
    if (G.activeWorld && (G.state === "playing")) render();
  },
};

window.addEventListener("DOMContentLoaded", () => Game.boot());
