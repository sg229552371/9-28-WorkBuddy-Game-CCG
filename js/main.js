/* ============================================================
 * main.js — 启动 / 输入 / 主循环 / 界面流程状态机
 * ============================================================ */
"use strict";

/* ============================================================
 * 20.5 性能护栏（帧率监测 / 长帧告警 / 诊断数据源）
 * —— 不侵入 game.js：在 main.js 的 Game.loop 内挂轻量打点（见 loop 顶部），
 *    只记录 + 按需提示，正常时零打扰（不写 console、不弹 UI）。
 * ============================================================ */
/* 纯函数：帧时间序列（ms）→ 统计量。可独立调用，便于单测。
 *   avg   平均帧耗时；max 最长；p50/p95 分位（最近窗口）；
 *   stuck 卡死帧计数（> 阈值，默认 80ms）；ms 换算 FPS。
 * 空数组：avg/max/p50/p95=0，fps=0，stuck=0（不抛错）。 */
function perfFrameStats(frames, stuckMs) {
  const n = frames ? frames.length : 0;
  if (!n) return { count: 0, avg: 0, max: 0, p50: 0, p95: 0, stuck: 0, fps: 0 };
  const thr = stuckMs == null ? 80 : stuckMs;
  const sorted = frames.slice().sort((a, b) => a - b);
  let sum = 0, max = 0, stuck = 0;
  for (let i = 0; i < n; i++) { const v = frames[i]; sum += v; if (v > max) max = v; if (v > thr) stuck++; }
  const pick = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const avg = sum / n;
  return {
    count: n, avg: avg, max: max,
    p50: pick(0.5), p95: pick(0.95), stuck: stuck,
    fps: avg > 0 ? 1000 / avg : 0,
  };
}

/* 纯函数：浮动摇杆坐标换算 —— 手指相对底盘中心的位移 → 归一化方向向量。
 *   dxi/dyi  手指相对中心的像素位移；maxR 摇杆头可移动半径（= 底盘半径 - 摇杆头半径）；
 *   deadZone 死区比例。
 * 返回 { vx, vy, mag, kx, ky }：
 *   vx/vy 超半径时按矢量方向钳制到 |(vx,vy)| = 1（不超速）；
 *   mag   钳制后的向量长度（用于死区判定）；
 *   kx/ky 摇杆头相对底盘左上角的偏移（像素，供 UI 摆放）。
 * 不修改全局状态，便于单测覆盖。契约：G.joy.dx/dy 仍为归一化向量，Player.update 不变。 */
function joyVector(dxi, dyi, maxR, deadZone) {
  const r = maxR > 0 ? maxR : 1;
  let vx = dxi / r, vy = dyi / r;
  const l = Math.hypot(vx, vy);
  if (l > 1) { vx /= l; vy /= l; }            // 钳制在底盘内（保持方向，限制模长）
  const mag = Math.hypot(vx, vy);
  const kx = (vx * r) + r, ky = (vy * r) + r; // 相对盘中心的像素偏移 + 中心偏移 = 相对左上角
  return { vx: vx, vy: vy, mag: mag, kx: kx, ky: ky, dead: mag < deadZone };
}

/* 帧护栏：滑动窗口采样 + 卡死告警（带冷却）。UI 为可选注入（默认运行时取全局 UI）。 */
const PerfGuard = {
  WINDOW: 60,       // 滑动窗口：最近 60 帧
  STUCK_MS: 80,     // 单帧 > 此值计入「卡死帧」
  ALERT_MS: 150,    // 连续 > 此值 2 帧 → 告警
  ALERT_RUN: 2,     // 连续阈值帧数
  COOLDOWN_MS: 30000,   // 告警冷却：30s 内不重复提示
  frames: [],       // 最近帧间隔（ms）
  lastT: null,      // 上一采样时间戳（null = 未开始，避免首帧脏数据）
  consecStuck: 0,   // 连续 > ALERT_MS 的帧计数
  lastAlertAt: -Infinity,   // 上次告警时间（performance.now 口径；-Inf 保证首次必告警）
  maxStuckMs: 0,    // 历史最长单帧（诊断展示用）
  alertCount: 0,    // 累计告警次数（诊断展示用）
  /* 每帧调用一次；now 为 rAF 时间戳（ms）。返回本帧耗时，便于测试。 */
  sample(now, ui) {
    if (typeof now !== "number" || !isFinite(now)) return 0;   // 桩/异常帧：丢弃
    if (this.lastT == null) { this.lastT = now; return 0; }    // 首帧无间隔
    const dt = now - this.lastT;
    this.lastT = now;
    if (dt < 0) return 0;   // 时间倒流（页面切后台等）丢弃
    this.frames.push(dt);
    if (this.frames.length > this.WINDOW) this.frames.shift();
    if (dt > this.maxStuckMs) this.maxStuckMs = dt;
    // 卡死连击：<= ALERT_MS 立即清零；> ALERT_MS 累加
    if (dt > this.ALERT_MS) this.consecStuck++;
    else this.consecStuck = 0;
    if (this.consecStuck >= this.ALERT_RUN) {
      this.consecStuck = 0;   // 触发后清空，避免每帧重复触发
      this._maybeAlert(now, Math.round(dt), ui);
    }
    return dt;
  },
  /* 触发告警（含冷却）。now 缺省取 performance.now。 */
  _maybeAlert(now, ms, ui) {
    const t = (typeof now === "number") ? now : _perfNow();
    if (t - this.lastAlertAt < this.COOLDOWN_MS) return false;   // 冷却中：静默
    this.lastAlertAt = t;
    this.alertCount++;
    const target = ui || (typeof UI !== "undefined" ? UI : null);
    if (target && typeof target.toast === "function") {
      target.toast(`⚠ 检测到卡顿（帧耗时 ${ms}ms）——可在设置查看诊断`, "bad", 4000);
    }
    return true;
  },
  /* 诊断快照：供设置面板展示。窗口统计 + 历史最长卡死帧。 */
  snapshot() {
    const st = perfFrameStats(this.frames, this.STUCK_MS);
    st.maxStuckMs = Math.round(this.maxStuckMs);
    st.alertCount = this.alertCount;
    return st;
  },
  /* 清空采样（测试/诊断重置用） */
  reset() { this.frames.length = 0; this.lastT = null; this.consecStuck = 0; this.maxStuckMs = 0; },
};
function _perfNow() {
  return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
}

/* 20.5 素材加载遮罩（纯 DOM/CSS，不进入主循环）：
 * - 启动时显示「载入素材」遮罩 + 百分比；进度来自 getProgress() 注入的回调（Assets.progress）。
 * - 防御策略：getProgress() 返回 null（接口缺失/结构异常）→ **立即隐藏**，绝不阻塞进入游戏；
 *   轮询 ~100ms；done=true 或超时（6s）→ 淡出隐藏。
 * - 桩/无 DOM 环境：静默降级（不抛错）。 */
const LoadingOverlay = {
  POLL_MS: 100,
  TIMEOUT_MS: 6000,
  _timer: null,
  _startAt: 0,
  show(getProgress) {
    const ov = document.getElementById("loading-overlay");
    if (!ov) return;                       // 桩环境无该 DOM：跳过
    const bar = document.getElementById("loading-bar");
    const txt = document.getElementById("loading-text");
    ov.classList.remove("hidden", "loading-fade");
    this._startAt = _perfNow();
    // 接口缺失 → 立即隐藏（清除可能的加载态），不阻塞
    const first = getProgress ? getProgress() : null;
    if (first === null || first === undefined) { this.hide(true); return; }
    this._set(first, bar, txt);
    if (first.done) { this.hide(); return; }   // 同步已完成：淡出，不必轮询
    const tick = () => {
      const p = getProgress ? getProgress() : null;
      // 接口中途消失 → 立即隐藏（防御）
      if (p === null || p === undefined) { this.hide(true); return; }
      this._set(p, bar, txt);
      if (p.done || _perfNow() - this._startAt > this.TIMEOUT_MS) { this.hide(); return; }
      this._timer = setTimeout(tick, this.POLL_MS);
    };
    this._timer = setTimeout(tick, this.POLL_MS);
  },
  _set(p, bar, txt) {
    const loaded = Number(p.loaded) || 0, total = Number(p.total) || 0;
    const pct = total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : 0;
    if (bar) bar.style.width = pct + "%";
    if (txt) txt.textContent = total > 0 ? `载入素材 ${loaded}/${total}（${pct}%）` : "载入素材…";
  },
  hide(immediate) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const ov = document.getElementById("loading-overlay");
    if (!ov) return;
    if (immediate) { ov.classList.add("hidden"); return; }
    ov.classList.add("loading-fade");     // 淡出（CSS transition）
    setTimeout(() => ov.classList.add("hidden"), 320);
  },
};

const Game = {
  async boot() {
    BootGuard.arm();   // 20.6 首屏看门狗：12s 未进首页 → 弹兜底面板
    G.canvas = document.getElementById("game-canvas");
    G.ctx = G.canvas.getContext("2d");
    this.fitCanvas();
    window.addEventListener("resize", () => this.fitCanvas());
    window.addEventListener("orientationchange", () => setTimeout(() => this.fitCanvas(), 120));   // 旋转后布局稳定再重算
    // 20.5 素材加载遮罩：数据源 Assets.progress（另一代理在加）。接口缺失/同步完成 → 立即隐藏，绝不白屏卡死。
    LoadingOverlay.show(this._assetProgress.bind(this));
    // 素材加载（含抠图）
    await Assets.load(ASSET_MANIFEST);
    LoadingOverlay.hide();
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
    BootGuard.done();               // 20.6 首屏已出现：取消看门狗（正常路径零打扰）
    requestAnimationFrame((t) => this.loop(t));
  },
  /* 20.5 读取素材加载进度（防御式）：
   * - Assets.progress 存在 → 返回 {loaded,total,done}（字段缺失按 0 兜底）
   * - 不存在 / 结构异常 → 返回 null（遮罩据此立即隐藏，不阻塞进入游戏） */
  _assetProgress() {
    try {
      if (typeof Assets === "undefined" || !Assets || !Assets.progress) return null;
      const p = Assets.progress;
      const loaded = Number(p.loaded) || 0;
      const total = Number(p.total) || 0;
      return { loaded: loaded, total: total, done: p.done === true || (total > 0 && loaded >= total) };
    } catch (e) { return null; }
  },
  /* 画布自适应（跨端口径修正 + 竖屏优先 20.x）：旧版画布固定 1920×1080 再整体缩进窗口——手机竖屏时
   * 游戏只是屏幕中间一条小横带，角色物理尺寸与 PC 全屏差数倍（「视野/角色大小不一致」的根因）。
   * 现在：画布**分辨率跟随窗口**，垂直视野固定（CFG.camera.viewH）→ 角色大小只由 zoom 决定，
   * PC 与手机一致；宽度随屏幕比例伸缩。
   * 竖屏优先（用户拍板）：**竖屏填满屏幕**——不再把窄屏钳成 4:3（旧 minAspect=0.75 会左右留黑边），
   * 而是按真实 aspect 走；横屏行为保持改造前一致（aspect ≥ minAspect，钳制本就不介入）。
   * 硬编码断点 aspect<1 视为竖屏；若需做成 CFG 字段见汇报（CFG.camera.portraitFill / portraitMinAspect）。 */
  fitCanvas() {
    const cam = CFG.camera || {};
    const vw = window.innerWidth || 1920, vh = window.innerHeight || 1080;   // 桩环境兜底，防 NaN
    const aspect = vw / Math.max(1, vh);
    const isPortrait = aspect < (cam.portraitBreakpoint != null ? cam.portraitBreakpoint : 1);
    // 20.8 竖屏视野再放大一档：portraitViewH 存在且竖屏 → 用更大的垂直视野，
    // zoom 按比例配平（画布 G.H = viewH×zoom 恒等于基准 viewH×zoom，跨端锚点不破坏）。
    const viewH = (isPortrait && cam.portraitViewH) ? cam.portraitViewH : (cam.viewH || 720);
    const zoom = (cam.viewH && cam.zoom) ? (cam.viewH * cam.zoom) / viewH : (cam.zoom || 1.5);
    G.H = Math.round(viewH * zoom);                                   // 画布高固定（1080）：垂直锚点，跨端角色大小一致
    // 竖屏（aspect<1）：放开 minAspect 钳制 → 画布宽按真实比例，填满整块竖屏（无左右黑边）。
    // 横屏（aspect≥1）：沿用旧口径（minAspect 对宽屏不生效，行为不变），PC 体验一致。
    const fillPortrait = cam.portraitFill !== false;      // 竖屏填满开关（CFG.camera.portraitFill）
    const minAspect = (isPortrait && fillPortrait) ? 0 : (cam.minAspect || 0.75);
    G.W = Math.max(Math.round(G.H * minAspect), Math.round(G.H * aspect));
    G.canvas.width = G.W; G.canvas.height = G.H;
    const scale = Math.min(vw / G.W, vh / G.H);
    G.canvas.style.width = G.W * scale + "px";
    G.canvas.style.height = G.H * scale + "px";
    // 同步方向类名（portrait/landscape）：CSS 主分支依据，旋转后随之切换
    if (typeof UI !== "undefined" && UI.applyOrientation) UI.applyOrientation();
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
    if (typeof UI.clearBattleHud === "function") UI.clearBattleHud();   // 20.2：下线战斗 HUD（技能栏/模块槽），避免通关回城后残留
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
    this.paused = false; this._levelUpActive = false;   // 重置升级弹窗暂停闸门（19.10.6）
    G.state = "playing";
    UI.showHudOnly();
    if (typeof UI.updateAutoFightBtn === "function") UI.updateAutoFightBtn();   // 每局按钮重置为关（run.autoFight 默认 false；测试 UI 桩缺该方法时跳过）
    const hud = document.getElementById("hud");
    if (hud) hud.classList.remove("city-mode");
    // 开场提示：按设备区分操作话术（手机无 WASD/B 键；触屏走摇杆+右下背包）
    const touchDev = isTouchDevice();
    const enterHint = touchDev
      ? `进入 ${G.levelCfg.name} · 局外 LV${G.heroDef.outLevel} · 左下摇杆移动 · 技能自动释放 · 右下背包`
      : `进入 ${G.levelCfg.name} · 局外 LV${G.heroDef.outLevel} · WASD 移动 · 技能自动释放 · B 背包`;
    UI.toast(`${enterHint}`, "gold");
  },
  /* 跳过当前世界的开场冻结（仅测试/调试用）。
   * 主关卡与裂缝进场都有 3 秒冻结（CFG.levelFreeze / CFG.rift.freezeTime），
   * 会吃掉「startRun 后立刻 step(N)」这类测试的前 N 帧进度 —— 相关测试在 startRun 后调用本函数即可复位。 */
  skipIntroFreeze() {
    if (G.mainWorld) G.mainWorld.freezeTimer = 0;
    if (G.activeWorld) G.activeWorld.freezeTimer = 0;
  },
  /* 升级 4 选 1 暂停闸门（19.10.6）：弹窗期间 Game.paused=true → 主循环跳过世界/玩家/同伴更新，
   * 渲染照常（弹窗覆盖）。字段显式初始化，避免「没弹过窗读到 undefined」。 */
  paused: false,
  _levelUpActive: false,
  /* 跳过当前挂起的升级 4 选 1（仅测试/调试用，§5.34 三件套）：
   * 逐个结算队列并解除暂停——用于「startRun 后立刻 step(N)」类旧测试保持时间假设。 */
  skipLevelUpChoice() {
    if (!G.run) return;
    const st = G.run.modulePoolState;
    if (st) for (const hid in st) st[hid].queue.length = 0;
    this._levelUpActive = false;
    this.paused = false;
    if (typeof UI !== "undefined" && UI.onLevelUpChoiceClose) UI.onLevelUpChoiceClose();
  },
  /* 芯片工坊服务入口（19.11.6，供 UI 线 UI.chipForgeService(action) 调用）：
   * 契约 {ok,msg}；内部判款/扣款/生成/入包，不调 UI.toast（§5.25）。 */
  chipForge(action, opts) {
    if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在芯片工坊内操作" };
    const svc = ChipForge[action];
    if (typeof svc !== "function") return { ok: false, msg: `未知的芯片工坊服务：${action}` };
    return svc.call(ChipForge, G.run, opts || {});
  },
  /* 清理局内状态（返回任一界面层前的统一收尾，不动 settings/config） */
  _clearRunState() {
    G.state = "menu"; G.run = null; G.player = null; G.team = null;
    G.mainWorld = null; G.subWorld = null; G.riftWorld = null; G.activeWorld = null;
    G.inArtisan = false; G.inRift = false;
    UI.toggleBackpack(false); UI.toggleArtisan(false);
    // 20.2：战斗 HUD 下线。统一收尾口 → 撤离/死亡回城 / 回首页 / 其它退出路径全部覆盖
    if (typeof UI.clearBattleHud === "function") UI.clearBattleHud();
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
    // 工匠面板页签（20.10：4 → 2）——「抽卡牌」页签随属性卡牌系统废弃移除；
    // 「芯片工坊」并入「商店·工坊」（id 复用 shop），故不再单独绑定 art-tab-forge。
    on("art-tab-chest", () => UI.setArtisanTab("chest"));
    on("art-tab-shop", () => UI.setArtisanTab("shop"));
    // 刷新卡牌按钮（btn-card-refresh）随卡牌页签一并从 DOM 移除，此处绑定改为空转保留：
    // renderCards 函数本体仍在（避免其他引用炸），但页面上已无该按钮。
    if (document.getElementById("btn-card-refresh")) {
      on("btn-card-refresh", () => {
        refreshCards();          // 免费次数优先，用完后扣金币；失败（金币不足）时内部已 toast
        UI.renderCards();
      });
    }
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
    // 20.5 低画质开关（契约字段 G.settings.lowQuality + window.__lowQuality，供 game.js 后续读取）
    const lqToggle = document.getElementById("set-lowq");
    if (lqToggle) lqToggle.onclick = () => {
      G.settings.lowQuality = !G.settings.lowQuality;
      this.applySettings();
      UI.renderSettings();
      UI.toast(G.settings.lowQuality ? "低画质模式：已开启（部分特效由渲染层后续读取 __lowQuality 降级）" : "低画质模式：已关闭", "");
    };
    // 20.5 复制诊断信息
    on("btn-perf-copy", () => UI.copyPerfDiag());
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
      // 21.1 NPC 点选（触屏/鼠标通用）：工匠世界内「已站圈解锁 + 点到 NPC 本体」→ 进入工坊。
      // 放在最前：命中即消费本次点击，避免同时触发拖拽/世界点击等其它逻辑。
      if (G.state === "playing" && typeof npcTap === "function" && npcTap(e.clientX, e.clientY)) {
        e.preventDefault();
        return;
      }
      const el = e.target.closest && e.target.closest(".itm");
      if (el && G.run && !UI.drag) {
        const uid = Number(el.dataset.uid);
        const it = [...G.run.backpack.items, ...G.run.weaponInv.items].find(i => i.uid === uid);
        // 22.1 触屏点选选中：手机无悬停（pointerover 不可靠），点选物品同时写 UI.hoverItem 并刷新详情，
        // 使工匠「强化品质 / 洗词缀」在触屏可用；鼠标端此路径同样成立（点了即选中，不影响 hover 行为）。
        if (it) {
          UI.hoverItem = it;
          if (typeof UI.renderItemInfo === "function") UI.renderItemInfo();
        }
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
  /* ---------- 移动端虚拟控件（浮动摇杆 + 可配置按钮；参数 CFG.mobile） ----------
   * 摇杆（21.3 浮动 / 21.5 全屏化）：任意处按下 → **该点即为摇杆盘心**（不再是固定左下角），拇指无需找位置；
   *   拖动时摇杆头随手指偏移并输出归一化向量到 G.joy（含死区），Player.update 优先于键盘；
   *   拇指拖出半径时底盘跟随（floatStick.dragBase），杜绝「拇指漂移出盘后失控」；
   *   松手后底盘隐形待命（floatStick.returnOnRelease），下次按下在新位置重新生成。
   * 事件边界：全屏任意位置可召唤（21.5 zoneRatio=1.0，右半屏不再静默）；命中交互控件（button/.tbtn/.itm/面板等）一律让位，不劫持按钮与物品格点击；
   *   面板打开（G.state 非 playing/city）不起杆；点 NPC 时让位（npcTap 优先）。
   * 按钮：hideTouchButtons 为真则整体隐藏 #touch-btns；否则按 CFG.mobile.buttons 逐项控制。 */
  bindTouch() {
    const mob = CFG.mobile || {};
    if (!mob.autoShow) return;
    // 触屏检测（统一走 isTouchDevice，桩环境安全）
    const isTouch = isTouchDevice();
    if (!isTouch) return;
    const tc = document.getElementById("touch-controls");
    if (tc) tc.classList.remove("hidden");
    if (document.body) document.body.classList.add("touch-mode");

    // --- 下方三按钮可见性（配置驱动，不写死 CSS；改 CFG.mobile 即可恢复） ---
    const btns = document.getElementById("touch-btns");
    if (btns) {
      const map = { "btn-touch-skill": "skill", "btn-touch-act": "interact", "btn-touch-bag": "backpack" };
      const flags = mob.buttons || {};
      const hideAll = !!mob.hideTouchButtons;
      // 整体隐藏开关 + 逐项开关：任一命中即加 .hidden（DOM 与事件绑定保留，仅视觉效果）
      for (const id in map) {
        const el = document.getElementById(id);
        if (!el) continue;
        const hideThis = hideAll || flags[map[id]] === false;
        if (el.classList) hideThis ? el.classList.add("hidden") : el.classList.remove("hidden");
      }
      if (btns.classList) hideAll ? btns.classList.add("hidden") : btns.classList.remove("hidden");
    }

    // --- 浮动摇杆（21.3 重写）---
    /* 旧实现的 4 个致命问题（已全部修掉）：
     *  ① 起杆条件要求 e.target === canvas，但摇杆盘自己 pointer-events:auto →
     *     按在盘上 target 是 #joy-base 而非 canvas → 永远 return，摇杆根本起不来。
     *  ② 底盘是 #joy-zone 的子元素、用内联 left/top 定位，而 #joy-zone 带 transform:scale(.88) →
     *     子元素内联坐标在缩放前坐标系，落点与手指偏移错位。
     *  ③ 无 setPointerCapture → 手指滑出画布即丢事件，摇杆卡在 active 不归零。
     *  ④ 底盘只在按下时定位、拖动中不跟随 → 拇指漂移出盘后失去控制（观感「死死固定」）。
     * 新实现：底盘 position:fixed 脱离 transform 坐标系，圆心直接取 clientX/Y；
     *  起杆 = 全屏任意点（21.5）且 未命中交互控件（黑名单），不再要求命中 canvas；
     *  拖动超 maxR 时底盘跟随拇指（dragBase），配合 setPointerCapture 抗丢失。 */
    const base = document.getElementById("joy-base");
    const stick = document.getElementById("joy-stick");
    if (base && stick) {
      const jc = mob.joystick || {};
      const fs = mob.floatStick || {};
      const size = jc.size || 132, knob = jc.knob || 56;
      const dead = jc.deadZone || 0.18, maxR = size / 2 - knob / 2;
      const zoneRatio = fs.zoneRatio > 0 ? fs.zoneRatio : 0.5;
      const returnOnRelease = fs.returnOnRelease !== false;
      const dragBase = fs.dragBase !== false;          // 默认跟随
      const stayInZone = fs.stayInZone !== false;      // 默认夹在召唤区内（zoneRatio=1.0 即全屏）
      const idleOpacity = (typeof fs.idleOpacity === "number") ? fs.idleOpacity : 0;
      let pid = null;
      let capEl = null;    // 持有指针捕获的元素（= 按下时的 e.target），松手时释放
      // 底盘圆心（屏幕坐标）—— 摇杆的唯一真值来源，不再依赖 zone 的 getBoundingClientRect
      let cx = 0, cy = 0;
      // 摇杆头相对底盘圆心的偏移（vx/vy ∈ [-1,1]）
      const setKnob = (vx, vy) => {
        stick.style.left = (size / 2 - knob / 2 + vx * maxR) + "px";
        stick.style.top = (size / 2 - knob / 2 + vy * maxR) + "px";
      };
      // 底盘按屏幕坐标定位（fixed → 与 transform 无关，落点即手指点）
      const placeBase = (px, py) => {
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        if (stayInZone && vw > 0) {
          const half = size / 2;
          px = Math.min(Math.max(px, half), vw * zoneRatio - half);
        }
        cx = px; cy = py;
        base.style.left = (px - size / 2) + "px";
        base.style.top = (py - size / 2) + "px";
      };
      // 交互控件黑名单：命中这些就不起杆（让位给按钮/面板/网格/物品/NPC 点选）
      const INTERACTIVE = "button, .tbtn, .itm, .btn, input, select, textarea, a, .overlay, .panel, .screen";
      const hitInteractive = (e) => {
        const t = e.target;
        if (!t || !t.closest) return false;
        return !!t.closest(INTERACTIVE);
      };
      const uiBusy = () => G.state !== "playing" && G.state !== "city";
      const apply = (clientX, clientY) => {
        const v = joyVector(clientX - cx, clientY - cy, maxR, dead);
        setKnob(v.vx, v.vy);
        if (v.dead) { G.joy.dx = 0; G.joy.dy = 0; }
        else { G.joy.dx = v.vx; G.joy.dy = v.vy; }
        // 底盘跟随：拇指超出半径时把盘心拖向拇指，保持「拇指永远在盘内偏一点」的浮动手感
        if (dragBase && !v.dead) {
          const dist = Math.hypot(clientX - cx, clientY - cy);
          if (dist > maxR) {
            const k = (dist - maxR) / dist;      // 只补超出部分 → 手感平滑不跳
            placeBase(cx + (clientX - cx) * k, cy + (clientY - cy) * k);
            setKnob(v.vx, v.vy);                 // 盘心移动后重算拇指位置
          }
        }
      };
      const begin = (e) => {
        if (pid !== null) return;                     // 已有活动触点（多指时只认第一根）
        if (uiBusy()) return;                         // 面板/结算态让位
        if (e.defaultPrevented) return;               // npcTap 已消费 → 让位
        if (hitInteractive(e)) return;                // 按钮/面板/物品格 → 让位
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        if (vw > 0 && e.clientX > vw * zoneRatio) return;   // zoneRatio=1.0 → 全屏可召唤；调小可收回「仅左半屏」限制
        pid = e.pointerId;
        base.classList.add("joy-on");                 // 显示底盘（待命时隐形）
        placeBase(e.clientX, e.clientY);              // ★ 盘心 = 按下点（浮动摇杆核心）
        G.joy.active = true;
        apply(e.clientX, e.clientY);
        /* 指针捕获必须挂到**实际接收该事件的元素**（e.target）。
         * ⚠️ 不能挂 base：#joy-base 待命时 pointer-events:none，对它 setPointerCapture 会立刻失败
         * 并触发 lostpointercapture → 摇杆在第一次 move 就被误判松手（21.3 实测踩到的真 bug）。 */
        capEl = (e.target && e.target.setPointerCapture) ? e.target : null;
        if (capEl) { try { capEl.setPointerCapture(pid); } catch (err) { capEl = null; } }
        e.preventDefault();
      };
      const move = (e) => { if (G.joy.active && e.pointerId === pid) apply(e.clientX, e.clientY); };
      const release = (e) => {
        if (pid === null || e.pointerId !== pid) return;   // 无活动触点 / 非同指 → 忽略
        if (capEl) { try { capEl.releasePointerCapture(pid); } catch (err) { /* 已释放则忽略 */ } capEl = null; }
        pid = null; G.joy.active = false; G.joy.dx = 0; G.joy.dy = 0;
        setKnob(0, 0);
        base.classList.remove("joy-on");
        if (!returnOnRelease) { /* 停留：保持底盘位置，仅清空摇杆头 */ }
      };
      // 底盘脱离旧 #joy-zone 的定位上下文：改 position:fixed + 屏幕坐标，避免被 zone 的 transform 缩放错位
      base.style.position = "fixed";
      base.style.transform = "none";
      /* 待命透明度走 CSS 变量而非内联 opacity：内联样式优先级高于类选择器，
       * 若在此写 base.style.opacity=0，会压住 .joy-on{opacity:1} → 底盘永远不浮现（21.3 实测踩到）。
       * 默认 idleOpacity=0 时直接用 CSS 默认值，不写任何内联。 */
      if (idleOpacity > 0) base.style.setProperty("--joy-idle", String(idleOpacity));
      // 文档级监听（画布与 #touch-controls 是兄弟节点，挂 #touch-controls 收不到画布事件）；
      // 本监听在 bindInput 的 npcTap 监听之后注册，NPC 命中时 defaultPrevented 已置位 → 摇杆让位。
      document.addEventListener("pointerdown", begin);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
      // 指针捕获被系统抢走（来电/切后台）时兜底归零，防摇杆卡住不动。
      // 挂在 window 而非 base：base 是 pointer-events:none 的纯视觉层，不会收到该事件。
      window.addEventListener("lostpointercapture", release);
      // 显隐过渡：.joy-on 由 CSS 定义（见 style.css #joy-base 段），此处不动态注入 <style>，
      // 避免无 head 的测试桩环境报错。
    }

    // --- 动作按钮（DOM 与绑定保留；隐藏仅由上方配置驱动） ---
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
      lowQuality: false,   // 20.5 低画质：契约字段，供渲染层读取（game.js 后续消费）
    };
    try {
      const raw = localStorage.getItem(CFG.settings.saveKey);
      if (raw) Object.assign(G.settings, JSON.parse(raw));
    } catch (e) { /* 测试环境无 localStorage */ }
    this.applySettings();
  },
  applySettings() {
    const s = G.settings;
    // 20.5 低画质契约：暴露全局标志供渲染层读取（不强行改渲染，只提供约定）
    if (typeof window !== "undefined") window.__lowQuality = !!s.lowQuality;
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
    PerfGuard.sample(t);              // 20.5 帧护栏：采样帧间隔（纯记录，异常时按冷却提示）
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    G.time += dt;
    if (G.state === "playing") {
      recomputeWeapon();
      // 升级 4 选 1 弹窗暂停（19.10.6）：paused=true → 跳过世界/玩家/同伴更新，渲染照常（弹窗覆盖）
      if (this.paused) { updateFX(dt); UI.updateHUD(); }
      else {
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
      }
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

/* ============================================================
 * 20.6 首屏启动兜底（BootGuard）—— 独立区块
 * 背景：线上有「无法开始游戏」投诉，四组环境复现均正常，怀疑个别手机端
 *       缓存/环境异常导致首屏静默失败（白屏、卡死、JS 半加载）。
 * 目标：任何异常都能被用户「看见 + 自救」——不依赖游戏 canvas / 主循环。
 * 设计要点：
 *   1) 看门狗：boot 起 12s 内若未落到首页 screen-main → 弹兜底面板；
 *      正常进首页则由 done() 取消（正常路径零打扰）。
 *   2) 全局错误捕获：首屏前任何错误立即弹面板（不等超时）；首屏后只记录。
 *   3) 兜底面板为纯 DOM + 内联样式，字体/布局不依赖 css/style.css（避免冲突）。
 *   4) 防御式：所有 DOM 判空；桩/无 DOM 环境（typeof document === "undefined"）
 *      全部静默跳过，绝不抛错（否则会破坏 perf_guard_test 等既有桩测试）。
 *   5) 只用 ES5/ES6 基础语法（var/function/箭头/模板串），兼容较老移动端浏览器。
 * ============================================================ */
/* 全局错误数组：供面板展示与「复制诊断信息」拼接。
 * 用 || 兜底，避免被其它脚本重复定义时被覆盖（幂等）。 */
window.__bootErrors = window.__bootErrors || [];

/* 面板内联样式：一次性注入 <head>，选择器带 #boot-error-panel 前缀隔离，
 * 不写 css/style.css（避免与他人改动冲突）。 */
function _bootInjectStyle() {
  try {
    if (typeof document === "undefined" || !document.head || !document.createElement) return;
    if (document.getElementById("boot-guard-style")) return;   // 幂等：只注入一次
    var css = [
      "#boot-error-panel{position:fixed;left:0;top:0;right:0;bottom:0;z-index:99999;",
      "display:flex;align-items:center;justify-content:center;background:rgba(10,10,14,.92);",
      "color:#e8e8ee;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;}",
      "#boot-error-panel.hidden{display:none!important;}",
      "#boot-error-panel .bep-box{width:min(560px,92vw);max-height:88vh;overflow:auto;box-sizing:border-box;",
      "background:#1a1a22;border:1px solid #3a3a48;border-radius:10px;padding:20px 22px;box-shadow:0 8px 40px rgba(0,0,0,.5);}",
      "#boot-error-panel h2{margin:0 0 8px;font-size:20px;color:#ff8a8a;}",
      "#boot-error-panel p{margin:6px 0;font-size:13px;line-height:1.6;color:#b8b8c4;}",
      "#boot-error-panel .bep-sec{margin:12px 0;padding:10px 12px;background:#12121a;border:1px solid #2c2c38;border-radius:8px;}",
      "#boot-error-panel .bep-k{color:#8a8a98;font-size:12px;margin-bottom:4px;}",
      "#boot-error-panel .bep-v{color:#d8d8e0;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace;",
      "white-space:pre-wrap;word-break:break-all;max-height:150px;overflow:auto;}",
      "#boot-error-panel .bep-v.err{color:#ffb0b0;}",
      "#boot-error-panel .bep-btns{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;}",
      "#boot-error-panel .bep-btn{flex:1;min-width:130px;padding:11px 16px;border-radius:8px;border:1px solid #4a4a5a;",
      "background:#2a2a36;color:#e8e8ee;font-size:14px;cursor:pointer;}",
      "#boot-error-panel .bep-btn.primary{background:#3a6ea5;border-color:#5a8ec5;font-weight:bold;}",
      "#boot-error-panel .bep-btn:active{opacity:.8;}",
    ].join("");
    var st = document.createElement("style");
    st.id = "boot-guard-style";
    // 优先 textContent（现代）；老 IE 无则退 text（try 包裹防只读抛错）
    if ("textContent" in st) st.textContent = css;
    else st.text = css;
    if (document.head.appendChild) document.head.appendChild(st);
  } catch (e) { /* 样式注入失败不影响功能，静默 */ }
}

const BootGuard = {
  TIMEOUT_MS: 12000,     // 看门狗时长：素材慢也通常 12s 内出首屏；超时兜底
  _timer: null,          // 看门狗句柄（done 时清除）
  _armed: false,         // 是否已 arm（避免重复挂看门狗）
  _booted: false,        // 是否已进入首页（首屏标志）
  ready: false,          // 面板按钮/错误监听是否已就绪（测试可观测）
  panel: null,           // 面板元素缓存

  /* 取 dom，缺省取全局 document；无 DOM 环境返回 null（调用方判空） */
  _doc(dom) {
    if (dom) return dom;
    return (typeof document !== "undefined") ? document : null;
  },
  /* 取 body（兼容桩里 body 延迟定义成 getter 的情况） */
  _body(doc) {
    try { return doc ? doc.body : null; } catch (e) { return null; }
  },
  /* 取窗口对象；无 window 返回 null */
  _win() {
    return (typeof window !== "undefined") ? window : null;
  },

  /* 确保面板 + 按钮 + 全局错误监听就绪（幂等；无 DOM 直接跳过）。
   * 端到端时 index.html 内联脚本会在加载脚本后立刻调用，保证从此刻起：
   *   - 任何「首屏前错误」能立即弹面板
   *   - 「脚本加载失败」兜底面板的按钮可用（此时 main.js 的 Game 可能未定义） */
  ensure() {
    if (this.ready) return this;
    var doc = this._doc();
    if (!doc || !doc.getElementById || !this._body(doc)) return this;   // 无可用 DOM：安全跳过
    _bootInjectStyle();
    this.panel = doc.getElementById("boot-error-panel");
    // 若 index.html 未提供面板（片段缺失）→ 动态造一个最小面板（双保险，保证一定有自救入口）
    if (!this.panel && doc.createElement) {
      this.panel = doc.createElement("div");
      this.panel.id = "boot-error-panel";
      this.panel.className = "hidden";
      this.panel.innerHTML = '<div class="bep-box"><h2>启动未能完成</h2>' +
        '<p>页面似乎没有正常加载，可能是网络或缓存问题。</p><div class="bep-btns"></div></div>';
      try { this._body(doc).appendChild(this.panel); } catch (e) { }
    }
    // 按钮绑定：优先用面板内已有按钮，否则动态补
    var btns = this.panel && this.panel.querySelector ? this.panel.querySelector(".bep-btns") : null;
    if (!btns && this.panel && doc.createElement) {
      btns = doc.createElement("div");
      btns.className = "bep-btns";
      try { this.panel.appendChild(btns); } catch (e) { }
    }
    var self = this;
    var retry = doc.getElementById ? doc.getElementById("boot-error-retry") : null;
    if (!retry && btns && doc.createElement) {
      retry = doc.createElement("button");
      retry.id = "boot-error-retry";
      retry.className = "bep-btn primary";
      retry.textContent = "重试";
      btns.appendChild(retry);
    }
    if (retry) retry.onclick = function () { self.retry(); };
    var copy = doc.getElementById ? doc.getElementById("boot-error-copy") : null;
    if (!copy && btns && doc.createElement) {
      copy = doc.createElement("button");
      copy.id = "boot-error-copy";
      copy.className = "bep-btn";
      copy.textContent = "复制诊断信息";
      btns.appendChild(copy);
    }
    if (copy) copy.onclick = function () { self.copy(); };
    // 全局错误监听只装一次（本区块任一入口都可能先被调用）
    if (!this._errBound) {
      this._errBound = true;
      this._installGlobalHandlers(this._win());
    }
    this.ready = true;
    return this;
  },

  /* 挂全局错误监听：window.onerror + unhandledrejection。
   * 均 push 到 window.__bootErrors；首屏未出现 → 立即弹面板，已出现 → 只记录。 */
  _installGlobalHandlers(w) {
    if (!w) return;
    var self = this;
    var prev = w.onerror;   // 保留原有处理器，不互相覆盖
    w.onerror = function (message, filename, lineno, colno, e) {
      try {
        var stack = (e && e.stack) ? String(e.stack) : "";
        self.record(message, filename, lineno, stack);
      } catch (er) { }
      if (typeof prev === "function") { try { return prev.apply(this, arguments); } catch (er) { } }
      return false;   // 不吞掉：交由浏览器控制台照常打印
    };
    w.addEventListener("unhandledrejection", function (ev) {
      try {
        var r = ev && ev.reason;
        var msg = r ? (r.message || String(r)) : "unhandledrejection";
        var stack = (r && r.stack) ? String(r.stack) : "";
        self.record(msg, "(promise)", 0, stack);
      } catch (er) { }
    });
  },

  /* 记录一条错误。首屏前 → 立即弹面板；首屏后 → 只记录。
   * 返回是否触发弹窗（便于单测断言）。 */
  record(message, filename, lineno, stack) {
    var info = {
      message: (message == null || message === "") ? "未知错误" : String(message),
      filename: filename ? String(filename) : "",
      lineno: (lineno == null || lineno === "") ? "" : String(lineno),
      stack: stack ? String(stack) : "",
      time: (new Date()).toISOString(),
    };
    try {
      if (typeof window !== "undefined") {
        window.__bootErrors = window.__bootErrors || [];
        window.__bootErrors.push(info);
        if (window.__bootErrors.length > 40) window.__bootErrors.shift();   // 上限：防内存无限增长
      }
    } catch (e) { }
    if (!this._booted) { this.showPanel(); return true; }
    return false;
  },

  /* arm：boot 开头调用，挂看门狗定时器。重复调用幂等（只挂一次）。 */
  arm() {
    var self = this;
    this.ensure();
    if (this._armed) return this;
    this._armed = true;
    if (typeof setTimeout === "function") {
      this._timer = setTimeout(function () {
        if (self._booted) return;     // 首屏已出（理论到不了这，双保险）
        // 看门狗诊断：明确「不是 JS 崩溃」而是「启动没走完」
        try { window.__bootErrors = window.__bootErrors || []; window.__bootErrors.push({ message: "启动超时：boot() 在 " + (self.TIMEOUT_MS / 1000) + " 秒内未进入首页", filename: "(boot-watchdog)", lineno: "", stack: "", time: (new Date()).toISOString() }); } catch (e) { }
        self.showPanel();
      }, this.TIMEOUT_MS);
    }
    return this;
  },

  /* done：首屏出现（showScreen("screen-main") 后）调用，取消看门狗。
   * 幂等：重复调用安全；此后错误只记录不弹面板。 */
  done() {
    this._booted = true;
    if (this._timer && typeof clearTimeout === "function") { clearTimeout(this._timer); this._timer = null; }
    return this;
  },

  /* 判断首屏是否已出现：
   *   - BootGuard._booted 已置位 → 已出现
   *   - 或 DOM 上 #screen-main 不含 hidden → 已出现（兜底：即便 done() 漏调也能救）
   * 无 DOM → 返回 false（视为未出现，走兜底更安全）。 */
  isMainReady() {
    if (this._booted) return true;
    try {
      var doc = this._doc();
      var el = (doc && doc.getElementById) ? doc.getElementById("screen-main") : null;
      return !!(el && el.classList && !el.classList.contains("hidden"));
    } catch (e) { return false; }
  },

  /* 取素材进度文案：读 Assets.progress；不存在/异常 → 「未知」 */
  _assetsText() {
    try {
      if (typeof Assets === "undefined" || !Assets || !Assets.progress) return "未知";
      var p = Assets.progress;
      var loaded = Number(p.loaded) || 0, total = Number(p.total) || 0;
      if (total > 0) return loaded + "/" + total + (p.done ? "（已完成）" : "");
      return p.done ? "已完成" : "未知";
    } catch (e) { return "未知"; }
  },
  /* 脚本加载状态文案：Game 是否定义（4 个脚本任一失败都可能缺 Game）。
   * 注意：Game 是顶层 const，**不会**挂到 window 上（只有 var/function 才会），
   * 所以必须用 typeof Game 判断，不能写 window.Game。同一页面的后续 <script> 共享
   * 全局词法环境，因此内联兜底脚本同样能用 typeof Game。 */
  _scriptsText() {
    try {
      var hasGame = (typeof Game !== "undefined");
      var parts = ["Game：" + (hasGame ? "√" : "× 未定义（脚本可能加载失败）")];
      if (typeof Assets !== "undefined") parts.push("Assets：√");
      if (typeof UI !== "undefined") parts.push("UI：√");
      if (typeof CFG !== "undefined") parts.push("CFG：√");
      return parts.join("　");
    } catch (e) { return "未知"; }
  },
  /* 错误列表文案：最近 5 条（信息 + 位置 + stack 前 5 行） */
  _errorsText() {
    var arr = (typeof window !== "undefined" && window.__bootErrors) ? window.__bootErrors : [];
    if (!arr.length) return "（暂未捕获到错误）";
    return arr.slice(-5).map(function (e, i) {
      var head = "[错误" + (i + 1) + "] " + e.message;
      var loc = (e.filename ? "  位置：" + e.filename + (e.lineno ? ":" + e.lineno : "") : "");
      var stk = e.stack ? "\n" + e.stack.split("\n").slice(0, 5).join("\n") : "";
      return head + loc + stk;
    }).join("\n\n");
  },

  /* 弹兜底面板 + 用实时状态填充各字段（面板为纯 DOM，不依赖 canvas/主循环）。
   * 无 DOM → 静默降级（返回 false）。 */
  showPanel(dom, overrideMsg) {
    var doc = this._doc(dom);
    if (!doc || !doc.getElementById) return false;
    this.ensure();
    var panel = this.panel || doc.getElementById("boot-error-panel");
    if (!panel || !panel.style) return false;
    var setText = function (id, text) {
      var el = doc.getElementById(id);
      if (el) el.textContent = text;
    };
    setText("boot-err-scripts", this._scriptsText());
    setText("boot-err-assets", this._assetsText());
    setText("boot-err-errors", overrideMsg ? overrideMsg : this._errorsText());
    try {
      if (panel.classList) panel.classList.remove("hidden");
      panel.style.display = "";   // 清掉可能的 inline display:none
    } catch (e) { }
    return true;
  },

  /* 隐藏面板（正常进首屏时用；测试用） */
  hidePanel(dom) {
    var doc = this._doc(dom);
    if (!doc || !doc.getElementById) return false;
    var panel = this.panel || doc.getElementById("boot-error-panel");
    if (!panel) return false;
    try { if (panel.classList) panel.classList.add("hidden"); } catch (e) { }
    return true;
  },

  /* 拼装诊断文本（供复制；也可单测）。含：时间/UA/脚本/素材/视口/错误列表。 */
  diagText() {
    var w = this._win();
    var ua = "";
    try { ua = (typeof navigator !== "undefined" && navigator.userAgent) || ""; } catch (e) { }
    var vw = (w && w.innerWidth) || 0, vh = (w && w.innerHeight) || 0;
    var arr = (w && w.__bootErrors) ? w.__bootErrors : [];
    var errLines = arr.length
      ? arr.slice(-5).map(function (e, i) {
        return "[" + (i + 1) + "] " + e.message + (e.filename ? " @ " + e.filename + (e.lineno ? ":" + e.lineno : "") : "") +
          (e.stack ? "\n    " + e.stack.split("\n").slice(0, 5).join("\n    ") : "");
      }).join("\n")
      : "（暂未捕获到错误）";
    return [
      "【启动诊断】" + (new Date()).toISOString(),
      "脚本状态: " + this._scriptsText(),
      "素材进度: " + this._assetsText(),
      "视口: " + vw + "x" + vh,
      "UA: " + ua,
      "错误记录:",
      errLines,
    ].join("\n");
  },

  /* 复制诊断信息：优先 navigator.clipboard.writeText；
   * 失败/缺失（老浏览器、非 https）降级为 prompt() 显示全文让用户手抄。
   * 全程 try 包裹，绝不抛错。 */
  copy() {
    var text = this.diagText();
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return text;
      }
    } catch (e) { /* 降级 */ }
    try { if (typeof window !== "undefined" && window.prompt) window.prompt("请长按复制以下诊断信息：", text); } catch (e) { }
    return text;
  },

  /* 重试：整页重载（最粗暴也最有效的自救：绕开一切缓存/半加载状态） */
  retry() {
    try {
      if (typeof location !== "undefined" && location.reload) { location.reload(); return true; }
      if (typeof window !== "undefined" && window.location && window.location.reload) { window.location.reload(); return true; }
    } catch (e) { }
    return false;
  },
};

/* 20.6a 移除 favicon 探针：本项目无 favicon.ico，探针必然 404 → record() 在首屏前
 * 误弹「启动未能完成」面板盖住首页（实测复现：正常启动被面板遮挡 = 无法开始游戏）。
 * 脚本加载失败自有 window.onerror + 看门狗超时双兜底，网络探针无增益，故整块删除。 */

/* 脚本加载即就绪：挂错误监听 + 注入样式。
 * 无 DOM 时 ensure 内部直接 return，桩测试完全不受影响。 */
try { BootGuard.ensure(); } catch (e) { }

/* ============================================================
 * 22.1 手机端毛刺清理·共享工具（新增区块，尾部追加；§5.45）
 * ============================================================ */

/* 触屏能力检测（统一口径）：供开场提示话术、bindTouch 门控共用。
 * 优先 maxTouchPoints（pointer 事件覆盖更广），退回 window.ontouchstart。
 * 桩/无 navigator 环境一律返回 false，不影响无头测试的行为假设。 */
function isTouchDevice() {
  if (typeof navigator !== "undefined" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0) return true;
  if (typeof window !== "undefined" && typeof window.ontouchstart !== "undefined") return true;
  return false;
}
