/* ============================================================================
 * 21.15 无尽模式（深渊）核心 —— 波次 / 刷怪 / 难度曲线 / 击杀计数 / 结算
 * ----------------------------------------------------------------------------
 * 定位：把 21.12~21.14 验证过的「海量敌人」技术成果变成**真正可玩的模式**。
 *   · 世界 kind="endless"（复用正式 World 类，isMain=false 走空世界分支）
 *   · 波次制：清空 → 等 CFG.endless.waveGap → 下一波
 *   · 同屏上限 / 强度 / 奖励曲线**全部来自 CFG.endless**（项目铁律：逻辑不硬编码数值）
 *
 * 设计原则（对齐 §5.45 铁律）：
 *   · 文件末尾独立区块；主循环只插单行调用 `if (Endless.isActive()) { Endless.update(...); return; }`
 *   · 非无尽世界（主图 / 裂缝 / 工匠 / 主城）时 isActive() 恒 false，行为逐位不变
 *   · **无 DOM 依赖**：核心逻辑不读 document / window，可在 vm 沙箱无头运行
 *
 * 世界归属标记：世界自身 `world.kind === "endless"`（见 World 构造第 4 参）；
 *   全局便捷标记 `G.inEndless` 供 HUD / 结算侧读取（各端写入）。
 * ========================================================================== */

var Endless = {
  /* ---------- 运行时状态（begin 初始化 / reset 清空） ---------- */
  state: {
    wave: 0,             // 当前波次（未开始时为 0）
    kills: 0,            // 本局击杀数
    crystals: 0,         // 累计结晶（每波结算累加，供结算面板）
    spawnQueue: [],      // 待刷敌人定义 ID 队列（本波配额，逐个消费）
    waveTimer: 0,        // 波间倒计时（>0 = 等待下一波；<=0 且队列空 = 本波已清空）
    firstWavePending: false,  // 是否处于「进入世界 → 第 1 波」的延迟窗口
    firstWaveTimer: 0,   // 首波专用倒计时（与波间 waveTimer 分离，避免语义混用）
    running: false,      // 本局是否在跑（begin 置 true，settle/reset 置 false）
  },

  /* ================= 基础查询 ================= */
  /* 当前世界是否无尽世界（世界自带 kind 为准；G.inEndless 为便捷镜像） */
  isActive() {
    var w = (typeof G !== "undefined" && G) ? G.activeWorld : null;
    return !!(w && w.kind === "endless");
  },

  /* ================= 难度曲线（全部来自 CFG.endless） ================= */
  /* 同屏上限：capBase + wave * capPerWave，按 capMax 封顶 */
  waveCap(wave) {
    var c = CFG.endless;
    return Math.min(c.capMax, c.capBase + Math.max(0, wave) * c.capPerWave);
  },
  /* 血量倍率：1 + (wave - 1) * hpMulPerWave（波 1 = 1.00 基准） */
  hpMul(wave) {
    return 1 + Math.max(0, wave - 1) * CFG.endless.hpMulPerWave;
  },
  /* 伤害倍率：1 + (wave - 1) * dmgMulPerWave（波 1 = 1.00 基准） */
  dmgMul(wave) {
    return 1 + Math.max(0, wave - 1) * CFG.endless.dmgMulPerWave;
  },
  /* 每波结晶：round(reward.base * wave ^ reward.exp) */
  waveReward(wave) {
    var rw = CFG.endless.reward;
    var w = Math.max(1, wave);
    return Math.round(rw.base * Math.pow(w, rw.exp));
  },
  /* 该波是否额外掉宝箱（每 chestEvery 波一枚） */
  dropsChest(wave) {
    var n = CFG.endless.chestEvery;
    return n > 0 && wave > 0 && (wave % n === 0);
  },
  /* 该波的怪物等级（Monster 构造第 4 参 lv） */
  monsterLv(wave) {
    var c = CFG.endless;
    return Math.max(1, Math.round(c.monsterLevelBase + Math.max(0, wave - 1) * c.monsterLevelPerWave));
  },
  /* 解析本波可刷的怪物定义池（按解锁进度过滤 Boss/精英；无尽世界不按关卡解锁限制） */
  _pool() {
    var ids = [];
    for (var id in CFG.monsters) {
      var d = CFG.monsters[id];
      if (!d) continue;
      if (d.type === "boss") continue;                        // 无尽首版不投放 Boss
      if (typeof isEliteDef === "function" && isEliteDef(id)) continue;   // 精英由独立机制，不进常规波
      ids.push(id);
    }
    if (!ids.length) ids.push("NM0010");                      // 兜底：万一怪物表被清空
    return ids;
  },

  /* ================= 生命周期 ================= */
  /* 初始化无尽状态：波 1、击杀 0、空队列、首波延迟 */
  begin(world) {
    var s = this.state;
    s.wave = 1;
    s.kills = 0;
    s.crystals = 0;
    s.spawnQueue = [];
    s.waveTimer = 0;
    s.firstWavePending = true;      // 先等 firstWaveDelay 秒再放第 1 波
    s.firstWaveTimer = CFG.endless.firstWaveDelay;   // 首波专用倒计时（与波间 waveTimer 分离）
    s.running = true;
    if (world) world.endlessWave = 1;
    if (typeof G !== "undefined" && G) G.inEndless = true;
    return s.wave;
  },
  /* 清状态（重开 / 退出） */
  reset() {
    var s = this.state;
    s.wave = 0; s.kills = 0; s.crystals = 0;
    s.spawnQueue = [];
    s.waveTimer = 0;
    s.firstWavePending = false;
    s.running = false;
    if (typeof G !== "undefined" && G) G.inEndless = false;
  },
  /* 击杀计数（由击杀回调 / 测试调用；纯逻辑，不依赖世界） */
  recordKill() {
    this.state.kills++;
    return this.state.kills;
  },
  /* 结算数据（供结算面板：到达波次 / 击杀数 / 结晶） */
  settle() {
    var s = this.state;
    s.running = false;
    return { wave: s.wave, kills: s.kills, crystals: s.crystals };
  },

  /* ================= 刷怪 ================= */
  /* 摄像机可视半轴（与 render 同口径）：viewW = G.W / zoom（画布宽换算世界单位），viewH = CFG.camera.viewH。 */
  viewHalf(world) {
    var cam = CFG.camera || {};
    var zoom = cam.zoom || 1;
    var viewH = cam.viewH || 720;
    var viewW = viewH;                                   // 兜底：正方形视野
    if (typeof G !== "undefined" && G && G.H && G.W) viewW = (G.W / zoom);
    return { w: viewW / 2, h: viewH / 2, viewW: viewW, viewH: viewH };
  },
  /* 摄像机中心（≈ 玩家，smooth 跟随；缺玩家时取地图中心） */
  camCenter(world) {
    if (typeof G !== "undefined" && G && G.player) return { x: G.player.x, y: G.player.y };
    return { x: world.w / 2, y: world.h / 2 };
  },
  /* 视野外采样一个刷怪点：在「视野矩形外扩 spawnRingMargin」的**环带**上取点。
   * 保证「至少一个轴出视野」的做法：**随机选一条边**（左/右/上/下）——
   *   选左右边 → |dx| = 该轴环半径（≥ 视野半宽 + margin）；选上下边同理。
   * 环半径按各轴分别计算，并夹到「视野半轴 + margin」与「到场边留 60 净空」之间；
   * 若某轴空间不足，则该轴不参与选边（退到另一轴），两极都无空间时才退化贴边。 */
  _spawnSpot(world) {
    var margin = CFG.endless.spawnRingMargin;
    var vh = this.viewHalf(world);
    var c = this.camCenter(world);
    // 各轴可用最大位移（到边界留 60）
    var maxX = Math.min(c.x - 60, world.w - 60 - c.x);
    var maxY = Math.min(c.y - 60, world.h - 60 - c.y);
    // 各轴环半径：至少「视野半轴 + margin」（保证出视野）；受限于边界可用量
    var ringX = Math.max(vh.w + 1, Math.min(vh.w + margin, maxX));
    var ringY = Math.max(vh.h + 1, Math.min(vh.h + margin, maxY));
    var canX = maxX >= vh.w + 1;      // 左右方向有出视野的余量
    var canY = maxY >= vh.h + 1;
    var x, y;
    if (canX && (!canY || U.rand(0, 1) < 0.5)) {
      // 选左/右边：x 轴位移 = ringX（≥ 视野半宽）→ 必出视野
      x = c.x + (U.rand(0, 1) < 0.5 ? -ringX : ringX);
      y = U.clamp(U.rand(c.y - Math.min(ringY, maxY), c.y + Math.min(ringY, maxY)), 60, world.h - 60);
    } else if (canY) {
      // 选上/下边：y 轴位移 = ringY（≥ 视野半高）→ 必出视野
      y = c.y + (U.rand(0, 1) < 0.5 ? -ringY : ringY);
      x = U.clamp(U.rand(c.x - Math.min(ringX, maxX), c.x + Math.min(ringX, maxX)), 60, world.w - 60);
    } else {
      // 极端窄场（地图比视野还小）：沿对角推到最远边界
      x = U.clamp(c.x + (U.rand(0, 1) < 0.5 ? -1 : 1) * maxX, 60, world.w - 60);
      y = U.clamp(c.y + (U.rand(0, 1) < 0.5 ? -1 : 1) * maxY, 60, world.h - 60);
    }
    return { x: x, y: y, viewHalfW: vh.w, viewHalfH: vh.h, viewW: vh.viewW, viewH: vh.viewH };
  },
  /* 判断点位是否在玩家视野外（满足「|dx| >= 视野半宽 或 |dy| >= 视野半高」即在外） */
  isOutsideView(x, y, halfW, halfH, pgx, pgy) {
    var dx = Math.abs(x - pgx), dy = Math.abs(y - pgy);
    return dx >= halfW || dy >= halfH;
  },
  /* 为当前波生成刷怪配额（敌人定义 ID 数组）：长度 = waveCap(wave) */
  _fillQueue(wave) {
    var n = this.waveCap(wave);
    var pool = this._pool();
    var q = [];
    for (var i = 0; i < n; i++) q.push(pool[i % pool.length]);
    return q;
  },
  /* 每帧消费刷怪队列（分批），从视野外生成 → push 进世界；返回本帧实际生成数 */
  _drainQueue(world, dt) {
    var s = this.state;
    if (!s.spawnQueue.length) return 0;
    var made = 0;
    var batch = Math.max(1, CFG.endless.spawnBatch || 12);
    var hpM = this.hpMul(s.wave), dmgM = this.dmgMul(s.wave);
    // Monster 构造按 G.levelCfg.monsterLevel 取等级 → 临时注入本波等级（无尽世界自己的曲线）
    var savedLv = null, lcfg = (typeof G !== "undefined" && G) ? G.levelCfg : null;
    if (lcfg && lcfg.monsterLevel !== undefined) { savedLv = lcfg.monsterLevel; lcfg.monsterLevel = this.monsterLv(s.wave); }
    while (s.spawnQueue.length && made < batch) {
      if (world.monsters.length >= this.waveCap(s.wave)) break;   // 同屏上限护栏
      var defId = s.spawnQueue.shift();
      var spot = this._spawnSpot(world);
      var m = world.spawnMonster(defId, spot.x, spot.y);
      if (!m) continue;                                           // 生成失败（上限/异常）→ 丢弃该配额
      m.endless = true;
      // 强度曲线：血量按波次放大（上限同步放大，血条比例才正确）；伤害由 atk 放大
      if (hpM !== 1) {
        m.hp = Math.round(m.hp * hpM); m.hpMax = Math.round((m.hpMax || m.hp) * hpM);
      }
      if (dmgM !== 1 && typeof m.atk === "number") m.atk = m.atk * dmgM;
      made++;
    }
    if (savedLv !== null) lcfg.monsterLevel = savedLv;   // 还原（不污染正式关卡配置）
    return made;
  },

  /* ================= 主循环 ================= */
  /* 返回 true 表示本帧由无尽模式接管（调用方 return，不再走正式玩法更新） */
  update(world, dt) {
    if (!world || world.kind !== "endless") return false;
    var s = this.state;
    if (!s.running) return true;      // begin 未调用：接管但不推进（防御）
    if (!(dt > 0)) return true;

    /* --- 首波延迟 --- */
    if (s.firstWavePending) {
      s.firstWaveTimer = (s.firstWaveTimer === undefined ? CFG.endless.firstWaveDelay : s.firstWaveTimer) - dt;
      if (s.firstWaveTimer <= 0) {
        s.firstWavePending = false;
        s.firstWaveTimer = 0;
        s.waveTimer = 0;
        s.spawnQueue = this._fillQueue(s.wave);
      }
      return true;
    }

    /* --- 消费刷怪队列（视野外生成） --- */
    this._drainQueue(world, dt);

    /* --- 清空判定：场上无怪 且 队列已空 → 本波结束，进入波间等待 --- */
    var cleared = (world.monsters.length === 0 && s.spawnQueue.length === 0);
    if (cleared) {
      if (s.waveTimer <= 0) {
        // 刚清空：结算本波奖励 + 计时进入下一波等待
        s.crystals += this.waveReward(s.wave);
        s.lastWaveCleared = s.wave;          // 供 UI/测试读取（最近清空波次）
        s.lastWaveChest = this.dropsChest(s.wave);
        s.waveTimer = CFG.endless.waveGap;
      } else {
        s.waveTimer -= dt;
        if (s.waveTimer <= 0) {
          // 等待结束 → 进入下一波
          s.wave++;
          if (world) world.endlessWave = s.wave;
          s.waveTimer = 0;
          s.spawnQueue = this._fillQueue(s.wave);
        }
      }
    }
    return true;
  },

  /* ================= 世界创建 ================= */
  /* 创建无尽世界：复用真实 World 类，isMain=false + kind="endless" 走**空世界分支**
   * （World 构造第 4 参 kind；isMain=false 会落到 setupArtisan 分支：无敌人、无地形障碍，
   *  只有 npc/exitBeacon 占位，不影响无尽流程——无尽自己管理怪物）。
   * ⚠️ 坑 16：必须 isMain=false，否则触发 setupMain 依赖 G.levelCfg.circles 直接崩。
   * ⚠️ 真玩家（可死亡结算）由调用方构造（Endless 不建玩家，见 Endless.makePlayer）。 */
  makeWorld(W, H) {
    var w = new World(W || CFG.endless.mapW, H || CFG.endless.mapH, false, "endless");
    w.monsters = []; w.playerBullets = []; w.enemyBullets = [];
    w.groundChests = []; w.altars = []; w.circles = []; w.obstacles = [];
    w.freezeTimer = 0;      // 无尽无开场冻结（波次延迟代替）
    w.boss = null;
    w.endlessWave = 1;
    return w;
  },
  /* 真玩家：可死亡结算（对照 stress.js 的「无敌桩」——无尽要真玩家，故用真实 Player 类）。
   * 依赖调用方已就绪的 G.run / G.heroDef（由 Game.startRun 或测试桩建立）。 */
  makePlayer(x, y) {
    return new Player(x, y);
  },

  /* ================= 自检 ================= */
  selfCheck() {
    var issues = [];
    if (typeof CFG === "undefined" || !CFG.endless) issues.push("CFG.endless 缺失");
    if (typeof World === "undefined") issues.push("World 缺失");
    if (typeof Monster === "undefined") issues.push("Monster 缺失");
    if (typeof Player === "undefined") issues.push("Player 缺失");
    if (typeof U === "undefined") issues.push("U 工具缺失");
    return issues;
  },
};

/* 暴露到全局（纯全局脚本，供主循环 / 结算 / HUD 调用） */
if (typeof globalThis !== "undefined") globalThis.Endless = Endless;
