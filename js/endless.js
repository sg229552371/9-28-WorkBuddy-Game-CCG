/* ============================================================================
 * 21.17 无尽模式（深渊·大秘境式）核心 —— 时间驱动刷怪 / 总时限 / 推进量 BOSS / 结算
 * ----------------------------------------------------------------------------
 * 定位：把 21.15 的「清空推进」改造成《暗黑破坏神 3》大秘境式的**时间驱动**玩法。
 *   · 世界 kind="endless"（复用正式 World 类，isMain=false 走空世界分支）
 *   · 刷怪改**时间驱动**：每 spawnInterval 秒刷一波，不管场上还剩多少怪
 *   · **总时限** timeLimit：倒计时归零 → 超时结算（保留 30%）+ 停止刷怪
 *   · **推进量** progress = kills + elapsedSec * timeWeight → 到阈值生成 BOSS
 *   · 同屏上限 / 强度 / 奖励 / 阈值曲线**全部来自 CFG.endless**（项目铁律：逻辑不硬编码数值）
 *
 * 设计原则（对齐 §5.45 铁律）：
 *   · 文件末尾独立区块；主循环只插单行调用 `if (Endless.isActive()) { Endless.update(...); return; }`
 *   · 非无尽世界（主图 / 裂缝 / 工匠 / 主城）时 isActive() 恒 false，行为逐位不变
 *   · **无 DOM 依赖**：核心逻辑不读 document / window，可在 vm 沙箱无头运行
 *
 * 世界归属标记：世界自身 `world.kind === "endless"`（见 World 构造第 4 参）；
 *   全局便捷标记 `G.inEndless` 供 HUD / 结算侧读取（各端写入）。
 *
 * ⚠️ 与 🅑（撤离点/屏蔽 RIFT）的契约：🅑 只追加文件末尾独立区块。
 *   本文件中间逻辑由 🅐 掌管；对外新增接口见文件顶部「对外接口」说明。
 * ========================================================================== */

var Endless = {
  /* ---------- 运行时状态（begin 初始化 / reset 清空） ---------- */
  state: {
    wave: 0,             // 当前波次（未开始时为 0）；时间驱动，每 spawnInterval 秒 +1
    kills: 0,            // 本局击杀数
    crystals: 0,         // 累计结晶（每波结算累加，供结算面板）
    spawnQueue: [],      // 待刷敌人定义 ID 队列（本波配额，逐个消费）
    waveTimer: 0,        // 本波剩余时间（<=0 = 该刷新下一波；时间驱动替代旧「波间等待」）
    firstWavePending: false,  // 是否处于「进入世界 → 第 1 波」的延迟窗口
    firstWaveTimer: 0,   // 首波专用倒计时（与 waveTimer 分离，避免语义混用）
    running: false,      // 本局是否在跑（begin 置 true，settle/reset 置 false）
    /* ---- 21.17 时间驱动 / 总时限 / 推进量 ---- */
    timeLeft: 0,         // 剩余总时限（秒）：每帧递减，归零 → 超时
    elapsed: 0,          // 已流逝时间（秒）：用于推进量的时间加权
    timedOut: false,     // 是否已超时（归零判定，供 isTimedOut）→ 超时后停刷
    bossIndex: 0,        // 已生成 BOSS 数（第 finalBossIndex 个 = 最终 BOSS）
    bossAlive: false,    // 当前是否有 BOSS 存活（非最终 BOSS 存活期间不重复触发）
    bossActive: 0,       // 场上存活 BOSS 数（由 update 每帧从世界统计）
    finalBossSpawned: false,  // 最终 BOSS 是否已生成（供 🅑 判断是否掉撤离点）
    finalBossDefeated: false, // 最终 BOSS 是否已被击杀（🅑 掉撤离点的判定依据）
  },

  /* ================= 基础查询 ================= */
  /* 当前世界是否无尽世界（世界自带 kind 为准；G.inEndless 为便捷镜像） */
  isActive() {
    var w = (typeof G !== "undefined" && G) ? G.activeWorld : null;
    return !!(w && w.kind === "endless");
  },

  /* ================= 难度曲线（全部来自 CFG.endless） ================= */
  /* 每波只数（分段线性插值，21.17 真机重定）：
   *   锚点 = CFG.endless.waveCapAnchors（[波次, 只数] 递增对，用户拍板）：
   *     波 1 → 10 / 波 50 → 100 / 波 80 → 200 / 波 90 → 256 / 波 99 → 300
   *   波 ≤ 首锚点波 → 首锚点只数；波 ≥ 末锚点波 → 末锚点只数；中间逐段线性取值后取整。
   *   ⚠️ 本函数是「每波配额」，与「同屏上限 capMax(3000) 闸门」是两个概念（见 _spawnWave）。 */
  waveCap(wave) {
    var a = CFG.endless.waveCapAnchors;
    var w = Math.max(0, wave);
    var n = a.length;
    if (w <= a[0][0]) return a[0][1];
    if (w >= a[n - 1][0]) return a[n - 1][1];
    for (var i = 0; i < n - 1; i++) {
      var x0 = a[i][0], x1 = a[i + 1][0];
      if (w >= x0 && w <= x1) {
        var t = (w - x0) / (x1 - x0);
        return Math.round(a[i][1] + t * (a[i + 1][1] - a[i][1]));
      }
    }
    return a[n - 1][1];
  },
  /* 同屏上限（「海量敌人」闸门）：_spawnWave / _drainQueue 用它判断场满时停止生成，
   * 与每波配额 waveCap 解耦——配额小、闸门大，才能既控节奏又允许海量堆叠。 */
  fieldCap() {
    return CFG.endless.capMax;
  },
  /* 血量倍率：1 + (wave - 1) * hpMulPerWave（波 1 = 1.00 基准） */
  hpMul(wave) {
    return 1 + Math.max(0, wave - 1) * CFG.endless.hpMulPerWave;
  },
  /* 伤害倍率（退役查询，保留向后兼容）：21.17 真机重定后攻击为**常量 atkMul**（1.25），
   * 不再随波次增长（难度由每波只数曲线承担）。未配置 atkMul 时回退旧线性公式。 */
  dmgMul(wave) {
    var c = CFG.endless;
    if (typeof c.atkMul === "number") return c.atkMul;
    return 1 + Math.max(0, wave - 1) * c.dmgMulPerWave;
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

  /* ================= 时间驱动 / 总时限 / 推进量（21.17 新增查询） ================= */
  /* 本波刷怪间隔（秒）：**先快后慢线性插值**（21.17 真机重定）。
   *   interval(wave) = spawnIntervalStart + t * (spawnIntervalEnd - spawnIntervalStart)
   *   t = clamp((wave - 1) / (spawnIntervalWaves - 1), 0, 1)
   *   波 1 → 4.0s；波 99 → 11.0s；两端线性。用户口径：开局快、后期放慢，避免波次叠波糊脸。 */
  spawnIntervalFor(wave) {
    var c = CFG.endless;
    var w = Math.max(0, wave);
    var span = (c.spawnIntervalWaves - 1);
    var t = span > 0 ? (w - 1) / span : 0;
    t = Math.max(0, Math.min(1, t));
    return c.spawnIntervalStart + t * (c.spawnIntervalEnd - c.spawnIntervalStart);
  },
  /* 剩余总时限（秒）：未 begin 时为 timeLimit（未开始即满）。 */
  timeLeft() {
    var s = this.state;
    return s.running ? Math.max(0, s.timeLeft) : CFG.endless.timeLimit;
  },
  /* 是否已超时（总时限归零）。 */
  isTimedOut() {
    return this.state.timedOut === true;
  },
  /* 当前推进量：progress = kills + elapsedSec * timeWeight。 */
  progress() {
    var s = this.state;
    var w = (CFG.endless.timeWeight !== undefined) ? CFG.endless.timeWeight : 1.0;
    return s.kills + s.elapsed * w;
  },
  /* 第 n 个 BOSS（n 从 0 起）的推进量阈值：bossProgressBase + n * bossProgressStep。 */
  bossThreshold(n) {
    var c = CFG.endless;
    return c.bossProgressBase + Math.max(0, n) * c.bossProgressStep;
  },
  /* 已生成 BOSS 数。 */
  bossIndex() {
    return this.state.bossIndex;
  },
  /* 最终 BOSS 是否已生成（供 🅑 判断是否掉撤离点）。 */
  isFinalBossSpawned() {
    return this.state.finalBossSpawned === true;
  },
  /* 最终 BOSS 是否已被击杀。 */
  isFinalBossDefeated() {
    return this.state.finalBossDefeated === true;
  },
  /* 第 n 个 BOSS 是否为最终 BOSS（n 从 1 起：第 finalBossIndex 个）。 */
  _isFinalBossNo(n) {
    var c = CFG.endless;
    return (c.finalBossIndex !== undefined) && n >= c.finalBossIndex;
  },
  /* BOSS 定义池（CFG.monsters 里 type === "boss" 的 ID 数组，稳定排序）。 */
  _bossPool() {
    var ids = [];
    for (var id in CFG.monsters) {
      var d = CFG.monsters[id];
      if (d && d.type === "boss") ids.push(id);
    }
    ids.sort();
    return ids;
  },

  /* 解析本波可刷的**小怪**定义池（普通怪 NM 系列，按解锁进度过滤；无尽世界不按关卡解锁限制）。
   * ⚠️ 21.17 构成曲线起，本函数**只返回普通小怪**，不再兜底混入其它怪种——
   *    精英池走 `_elitePool()`、BOSS 池走 `_bossPool()`，三者由 `_fillQueue` 按波次配比合成。 */
  _pool() {
    var ids = this._normalPool();
    if (!ids.length) ids.push("NM0010");                      // 兜底：万一普通怪表被清空
    return ids;
  },
  /* 普通小怪池（排除 ED 精英与 BS BOSS；NM 系列）。 */
  _normalPool() {
    var ids = [];
    for (var id in CFG.monsters) {
      var d = CFG.monsters[id];
      if (!d) continue;
      if (d.type === "boss") continue;                        // BOSS 单独触发 / 由构成曲线分配
      if (typeof isEliteDef === "function" && isEliteDef(id)) continue;   // 精英单独成池（_elitePool）
      ids.push(id);
    }
    return ids;
  },
  /* 精英池（ED 前缀，`isEliteDef` 判定，js/combat.js:451）。稳定排序，供构成曲线抽取。 */
  _elitePool() {
    var ids = [];
    for (var id in CFG.monsters) {
      var d = CFG.monsters[id];
      if (!d) continue;
      if (typeof isEliteDef === "function" ? isEliteDef(id) : (id.slice(0, 2) === "ED")) ids.push(id);
    }
    ids.sort();
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
    s.firstWaveTimer = CFG.endless.firstWaveDelay;   // 首波专用倒计时（与 waveTimer 分离）
    s.running = true;
    /* 21.17 时间驱动 / 总时限 / 推进量：显式初始化（不靠对象字面量初值，防重开残留） */
    s.timeLeft = CFG.endless.timeLimit;
    s.elapsed = 0;
    s.timedOut = false;
    s.bossIndex = 0;
    s.bossAlive = false;
    s.bossActive = 0;
    s.finalBossSpawned = false;
    s.finalBossDefeated = false;
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
    s.timeLeft = 0; s.elapsed = 0; s.timedOut = false;
    s.bossIndex = 0; s.bossAlive = false; s.bossActive = 0;
    s.finalBossSpawned = false; s.finalBossDefeated = false;
    if (typeof G !== "undefined" && G) G.inEndless = false;
  },
  /* 击杀计数（由击杀回调 / 测试调用；纯逻辑，不依赖世界）。
   * 若该击杀者是最终 BOSS → 置 finalBossDefeated（供 🅑 掉撤离点）。 */
  recordKill(monster) {
    this.state.kills++;
    if (monster && monster.d && monster.d.type === "boss" && monster.endlessFinalBoss) {
      this.state.finalBossDefeated = true;
    }
    return this.state.kills;
  },
  /* 结算数据（供结算面板：到达波次 / 击杀数 / 结晶 + 21.17 新增 timedOut/bossKills/elapsed） */
  settle() {
    var s = this.state;
    s.running = false;
    return {
      wave: s.wave,
      kills: s.kills,
      crystals: s.crystals,
      timedOut: s.timedOut === true,   // 是否超时结算（保留 30%）
      bossKills: s.bossIndex,          // 本局生成的 BOSS 数（BOSS 击杀口径）
      elapsed: s.elapsed,              // 本局已用时（秒）
    };
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
  /* 为当前波生成刷怪配额（敌人定义 ID 数组）：
   *   · 长度恒 = waveCap(wave)（每波只数**不变**，用户口径）；
   *   · 内容按 21.17「怪物构成曲线」合成（三查询见文件末尾独立区块）：
   *       波 1~79 → nElite = round(cap * 精英比例)，其余为小怪（小怪先多后少）
   *       波 80~89 → nBoss  = round(cap * BOSS 比例)，其余为精英（**无小怪**）
   *       波 90+  → 全部 BOSS（bossOnlyRatio = 1.0）
   *   · 配额顺序：精英/BOSS 放**队首**（先入场当压力），小怪补队尾，观感上「精英先冲脸」。 */
  _fillQueue(wave) {
    var n = this.waveCap(wave);
    var r = this._mixCounts(wave, n);                         // 末尾区块：按波次算三类只数
    var q = [];
    var elites = this._elitePool();
    var bosses = this._bossPool();
    var i;
    for (i = 0; i < r.boss; i++) q.push(bosses.length ? bosses[i % bosses.length] : null);
    for (i = 0; i < r.elite; i++) q.push(elites.length ? elites[i % elites.length] : null);
    var normals = this._pool();
    for (i = 0; i < r.normal; i++) q.push(normals[i % normals.length]);
    // 过滤空槽（池缺失时产生）：只数不足时用小怪补足，保证 waveCap 恒成立（只数不缩水）
    var out = [];
    for (i = 0; i < q.length; i++) if (q[i]) out.push(q[i]);
    while (out.length < n) out.push(normals[out.length % normals.length] || "NM0010");
    return out;
  },
  /* 每帧消费刷怪队列（分批），从视野外生成 → push 进世界；返回本帧实际生成数。
   * 21.17 构成曲线起，队列里可能混合「小怪 NM / 精英 ED / BOSS BS」三类：
   *   · 精英：`applyElite(m)` 加词缀（ED 本就该带），强度再用 hpMul/dmgMul 放大；
   *   · BOSS：不加词缀，强度同源放大；
   *   · 三类**各自一份每帧唯一实例预算**（末尾区块 `_budgetFor`）——防止一帧 new 几十只重对象卡顿，
   *     队列照常消费（跨帧补齐），**只数曲线不变**。 */
  _drainQueue(world, dt) {
    var s = this.state;
    if (!s.spawnQueue.length) return 0;
    var made = 0;
    var batch = Math.max(1, CFG.endless.spawnBatch || 12);
    var hpM = this.hpMul(s.wave), dmgM = this.dmgMul(s.wave);
    var budgets = { normal: batch, elite: this._budgetFor("elite"), boss: this._budgetFor("boss") };
    // Monster 构造按 G.levelCfg.monsterLevel 取等级 → 临时注入本波等级（无尽世界自己的曲线）
    var savedLv = null, lcfg = (typeof G !== "undefined" && G) ? G.levelCfg : null;
    if (lcfg && lcfg.monsterLevel !== undefined) { savedLv = lcfg.monsterLevel; lcfg.monsterLevel = this.monsterLv(s.wave); }
    var guard = s.spawnQueue.length;                          // 保险：本轮至多尝试「队列原始长度」次，防死循环
    while (s.spawnQueue.length && made < batch && guard-- > 0) {
      if (world.monsters.length >= this.fieldCap()) break;         // 同屏上限闸门（capMax=3000，非每波配额）
      var defId = s.spawnQueue[0];
      var kind = this._kindOf(defId);                         // 末尾区块：normal / elite / boss
      if (budgets[kind] <= 0) {                                // 该类本帧预算用尽 → 停手（队列保留，下帧继续）
        var rest = s.spawnQueue.slice(1);
        if (budgets.normal <= 0 && budgets.elite <= 0 && budgets.boss <= 0) break;
        s.spawnQueue.shift(); s.spawnQueue.push(defId);         // 挪到队尾，尝试排后面的其它怪种
        if (!rest.length) break;
        continue;
      }
      s.spawnQueue.shift();
      var spot = this._spawnSpot(world);
      var m = world.spawnMonster(defId, spot.x, spot.y);
      if (!m) continue;                                           // 生成失败（上限/异常）→ 丢弃该配额
      m.endless = true;
      // 强度曲线：血量按波次放大（上限同步放大，血条比例才正确）；伤害由 atk 放大
      if (hpM !== 1) {
        m.hp = Math.round(m.hp * hpM); m.hpMax = Math.round((m.hpMax || m.hp) * hpM);
      }
      if (dmgM !== 1 && typeof m.atk === "number") m.atk = m.atk * dmgM;
      this._markKind(m, kind);                                    // 末尾区块：精英加词缀 / BOSS 打标记
      budgets[kind]--;
      made++;
    }
    if (savedLv !== null) lcfg.monsterLevel = savedLv;   // 还原（不污染正式关卡配置）
    return made;
  },
  /* 统计场上存活的无尽 BOSS 数（供「存活时不重复触发」判定）。 */
  _countBosses(world) {
    var n = 0;
    var list = world.monsters || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m && !m.dead && m.d && m.d.type === "boss") n++;
    }
    return n;
  },
  /* 生成一个 BOSS（推进量到阈值时触发）：
   *   · 从 CFG.monsters 的 boss 池抽取（_bossPool，稳定序，按 bossIndex 轮转）
   *   · 强度按当前波次曲线放大（复用 hpMul/dmgMul）
   *   · ⚠️ 生成位置必须**在视野外**（复用 _spawnSpot 的 spawnRingMargin 逻辑）
   *   · 第 finalBossIndex 个 = 最终 BOSS → 打上 endlessFinalBoss 标记（供 🅑 掉撤离点）
   * 返回生成的 Monster；失败（无池/上限）返回 null。 */
  _spawnBoss(world) {
    var s = this.state;
    var pool = this._bossPool();
    if (!pool.length) return null;
    var no = s.bossIndex + 1;                       // 本次是第几个 BOSS（1 起算）
    var defId = pool[(no - 1) % pool.length];       // 按序号轮转（稳定、可测）
    var spot = this._spawnSpot(world);              // 视野外采样（复用既有环带逻辑）
    // 临时注入本波怪物等级（与 _drainQueue 同口径；还原防污染）
    var savedLv = null, lcfg = (typeof G !== "undefined" && G) ? G.levelCfg : null;
    if (lcfg && lcfg.monsterLevel !== undefined) { savedLv = lcfg.monsterLevel; lcfg.monsterLevel = this.monsterLv(s.wave); }
    var m = world.spawnMonster(defId, spot.x, spot.y);
    if (savedLv !== null) lcfg.monsterLevel = savedLv;
    if (!m) return null;
    // BOSS 强度曲线：血量/伤害按当前波次放大（与常规怪同源）
    var hpM = this.hpMul(s.wave), dmgM = this.dmgMul(s.wave);
    if (hpM !== 1) { m.hp = Math.round(m.hp * hpM); m.hpMax = Math.round((m.hpMax || m.hp) * hpM); }
    if (dmgM !== 1 && typeof m.atk === "number") m.atk = m.atk * dmgM;
    m.endless = true;
    var isFinal = this._isFinalBossNo(no);
    m.endlessBoss = true;
    if (isFinal) m.endlessFinalBoss = true;         // 最终 BOSS 标记（🅑 掉撤离点依据）
    s.bossIndex = no;
    s.bossAlive = true;
    if (isFinal) s.finalBossSpawned = true;
    if (world) world.endlessBoss = m;
    return m;
  },

  /* ================= 主循环 ================= */
  /* 返回 true 表示本帧由无尽模式接管（调用方 return，不再走正式玩法更新）。
   * 21.17 时间驱动口径：
   *   ① 总时限 timeLeft 每帧递减，归零 → timedOut（此后**停止刷怪**）；
   *   ② 每 spawnIntervalFor 秒刷一波（不管场上剩余；仅按**同屏上限 capMax** 闸门封顶）；场满则该波不刷但**计时照走**；
   *   ③ 推进量 progress = kills + elapsed * timeWeight → 到阈值刷 BOSS（存活时不重复）。 */
  update(world, dt) {
    if (!world || world.kind !== "endless") return false;
    var s = this.state;
    if (!s.running) return true;      // begin 未调用：接管但不推进（防御）
    if (!(dt > 0)) return true;

    /* --- ① 总时限：每帧递减，归零 → 超时（停刷，但场上 BOSS/怪继续存在） --- */
    s.timeLeft = Math.max(0, ((s.timeLeft === undefined) ? CFG.endless.timeLimit : s.timeLeft) - dt);
    s.elapsed += dt;
    if (s.timeLeft <= 0) s.timedOut = true;

    /* --- ② 刷怪计时：时间驱动（首波延迟只在开局生效一次） --- */
    if (s.firstWavePending) {
      s.firstWaveTimer = (s.firstWaveTimer === undefined ? CFG.endless.firstWaveDelay : s.firstWaveTimer) - dt;
      if (s.firstWaveTimer <= 0) {
        s.firstWavePending = false;
        s.firstWaveTimer = 0;
        s.waveTimer = 0;
        this._spawnWave(world);                       // 第 1 波（到点就刷）
        s.waveTimer = this.spawnIntervalFor(s.wave);
      }
    } else if (!s.timedOut) {
      s.waveTimer -= dt;
      if (s.waveTimer <= 0) {
        s.wave++;                                     // wave 号仍递增（用于 cap 与强度曲线）
        if (world) world.endlessWave = s.wave;
        this._spawnWave(world);                       // 到点就刷；场满则不刷但计时照走
        s.waveTimer = this.spawnIntervalFor(s.wave);
      }
    }

    /* --- 消费刷怪队列（视野外生成；时间驱动下队列 = 本波配额，陆续入场） --- */
    this._drainQueue(world, dt);

    /* --- ③ 推进量 → BOSS 触发（超时不刷；非最终 BOSS 存活时不重复触发） --- */
    s.bossActive = this._countBosses(world);
    s.bossAlive = s.bossActive > 0;
    var finalIdx = (CFG.endless.finalBossIndex !== undefined) ? CFG.endless.finalBossIndex : 3;
    if (!s.timedOut && !s.bossAlive && s.bossIndex < finalIdx && s.bossIndex < this._bossPool().length) {
      if (this.progress() >= this.bossThreshold(s.bossIndex)) this._spawnBoss(world);
    }
    return true;
  },
  /* 生成一波刷怪配额入队（时间驱动核心）：场上怪数 ≥ 同屏上限 fieldCap() → 本波不刷（避免无限堆积）。
   * 注意：① 判定口径是**同屏上限 capMax(3000)**，不是每波配额 waveCap（两者已解耦）；
   *       ② **不刷不等于不推进时间**——调用方照常重置 waveTimer；
   *       ③ 「到点就刷，不等清场」（用户口径，保持现状）。 */
  _spawnWave(world) {
    var s = this.state;
    if (world && (world.monsters || []).length >= this.fieldCap()) return 0;   // 场满（达同屏闸门）→ 本波不刷
    s.spawnQueue = this._fillQueue(s.wave);
    s.lastWaveCleared = s.wave;                       // 兼容旧字段（HUD/奖励层读取「最近一波」）
    s.lastWaveChest = this.dropsChest(s.wave);
    return s.spawnQueue.length;
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
    w.freezeTimer = 0;      // 无尽无开场冻结（首波延迟代替）
    w.boss = null;
    w.endlessWave = 1;
    w.endlessBoss = null;   // 当前 BOSS（21.17；供 🅑 / 渲染读取）
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
    else {
      // 21.17 时间驱动关键字段（缺失会导致刷怪/BOSS/时限静默失效）
      var need = ["timeLimit", "spawnInterval", "spawnIntervalMin", "spawnIntervalDecay",
        "bossProgressBase", "bossProgressStep", "timeWeight", "finalBossIndex", "extractChannel"];
      for (var i = 0; i < need.length; i++) {
        if (typeof CFG.endless[need[i]] !== "number") issues.push("CFG.endless." + need[i] + " 缺失");
      }
    }
    if (typeof World === "undefined") issues.push("World 缺失");
    if (typeof Monster === "undefined") issues.push("Monster 缺失");
    if (typeof Player === "undefined") issues.push("Player 缺失");
    if (typeof U === "undefined") issues.push("U 工具缺失");
    return issues;
  },
};

/* 暴露到全局（纯全局脚本，供主循环 / 结算 / HUD 调用） */
if (typeof globalThis !== "undefined") globalThis.Endless = Endless;

/* ============================================================================
 * ====== 21.17 深渊撤离点接入（🅑 线）—— 独立追加区块（§5.45 铁律）======
 * ----------------------------------------------------------------------------
 * ⚠️ 本区块由 🅑 追加，**不改本文件中间逻辑**（🅐 掌管）；只在文件末尾追加独立函数，
 *    与 modes.js 的 §21.17 撤离点区块对接（那里是逻辑主体，这里只做 World 归属侧接线）。
 *
 * 职责：
 *   ① 为无尽世界**显式初始化撤离点字段**（照 🅑 契约：world.exitBeacon 复用主线字段名，
 *      render.js 的 artisan 分支会自动绘制判定圈与进度环）；
 *   ② 暴露 `Endless.attachExtractFields(world)`，供 makeWorld 之外的重建路径补齐字段；
 *   ③ 暴露 `Endless.installRiftFilter()` 兜底：若某版本游戏运行期**尚未经 setupArtisan**
 *      就抽祭坛，则调用 modes.js 的 rollAbyssAltars（其内部已按 kind 排除 RIFT）。
 *
 * 依赖注入（typeof 守卫，未加载 modes.js 时安全降级，不抛错）：
 *   rollAbyssAltars / spawnAbyssExtractBeacon / updateAbyssExtract / abyssExtractSettle。
 * ========================================================================== */

/** 给无尽世界补齐撤离点相关字段（幂等，不覆盖已有值）。
 *  字段与 modes.js 的 §21.17 区块严格一致，防止「未跑过 update 时为 undefined」。 */
Endless.attachExtractFields = function (world) {
  var w = world || ((typeof G !== "undefined" && G) ? G.activeWorld : null);
  if (!w || w.kind !== "endless") return false;
  if (w.exitBeacon === undefined) w.exitBeacon = null;             // 复用主线字段名（渲染自动生效）
  if (w.abyssExtractProgress === undefined) w.abyssExtractProgress = 0;
  if (w.abyssExtractHolder === undefined) w.abyssExtractHolder = null;
  if (w.abyssExtractReady === undefined) w.abyssExtractReady = false;
  if (w.abyssExtractDone === undefined) w.abyssExtractDone = false;
  if (w.abyssExtractSettled === undefined) w.abyssExtractSettled = false;
  if (w._lastFinalBossPos === undefined) w._lastFinalBossPos = null;
  if (w.exitProgress === undefined) w.exitProgress = 0;             // 渲染进度环读取该字段
  return true;
};

/** 兜底：按过滤后的池为深渊世界投放祭坛（排除 RIFT）。modes.js 的 rollAbyssAltars 可用时直接委托；
 *  否则本函数自带一份最小实现（仅排除 CFG.endless.blockAltars 白名单，默认 RIFT）。返回投放 id 数组。 */
Endless.installRiftFilter = function (world, count) {
  var w = world || ((typeof G !== "undefined" && G) ? G.activeWorld : null);
  if (!w || w.kind !== "endless") return [];
  if (typeof rollAbyssAltars === "function") return rollAbyssAltars(w, count);   // 委托 modes.js（单一实现）
  // 独立兜底实现（modes.js 未加载时）：与 modes.js 同口径排除 RIFT
  var e = (typeof CFG !== "undefined" && CFG.endless) || {};
  var blocked = Array.isArray(e.blockAltars) ? e.blockAltars : ["RIFT"];
  var altars = (typeof CFG !== "undefined" && CFG.altars) || {};
  var pool = {}, ids = [];
  for (var k in altars) {
    var a = altars[k];
    if (!a || !(a.weight > 0) || blocked.indexOf(k) >= 0) continue;
    pool[k] = a.weight; ids.push(k);
  }
  if (!ids.length) return [];
  var n = (count === undefined) ? 5 : count, made = [];
  w.altars = w.altars || [];
  for (var i = 0; i < n; i++) {
    var id = U.weightedPick(pool);
    if (!id) break;
    var pos = w.findFreeSpot ? w.findFreeSpot(100) : null;
    w.altars.push({ cfg: CFG.altars[id], x: pos ? pos.x : U.rand(200, w.w - 200),
      y: pos ? pos.y : U.rand(200, w.h - 200), id: id });
    made.push(id);
  }
  return made;
};

/* 21.17 深渊撤离点接入区块结束 */

/* ============================================================================
 * ====== 21.17 怪物构成曲线（小怪先多后少 → 80 后无小怪 → 90 后只有 BOSS）======
 * ----------------------------------------------------------------------------
 * 独立追加区块（§5.45 铁律）：主逻辑（_fillQueue / _drainQueue）只**单行调用**本区块的
 * 纯函数，新增判定/计算全部落在这里，不改既有函数体结构。
 *
 * 设计意图（用户原话）：
 *   「一共就 100 波，13 分钟 …… 小怪比例先多后少，80 波后无小怪，以精英怪和 Boss 为主，
 *     90 波后只会有 boss。」
 *
 * 三段构成（每波只数 = waveCap，**不变**）：
 *   ① 波 1~79   ：小怪为主，精英占比沿 eliteRatioAnchors 由 0.10 → 0.60 上升（小怪 0.90 → 0.40）
 *   ② 波 80~89  ：无小怪；BUG 占比沿 bossMixRatioAnchors 由 0.05 → 0.10，其余全为精英
 *   ③ 波 90~100 ：只有 BOSS（bossOnlyRatio = 1.0）
 *
 * ⚠️ 与「推进量阈值 BOSS」双轨共存：本区块只产出**常规波夹杂的 BOSS**（供强场 / 终局压力），
 *    不触碰 state.bossIndex / bossThreshold / _spawnBoss（那是另一套「主线 BOSS 序列 + 撤离点」）。
 * ========================================================================== */

/* 分段线性插值（通用）：anchors = [[x, y], ...] 递增；x ≤ 首锚点 → 首值；x ≥ 末锚点 → 末值。
 * 与 Endless.waveCap 同口径（独立实现，避免跨函数耦合）。缺 anchors 时返回 fallback。 */
Endless._lerpAnchors = function (anchors, x, fallback) {
  if (!anchors || !anchors.length) return fallback;
  var n = anchors.length;
  if (x <= anchors[0][0]) return anchors[0][1];
  if (x >= anchors[n - 1][0]) return anchors[n - 1][1];
  for (var i = 0; i < n - 1; i++) {
    var x0 = anchors[i][0], x1 = anchors[i + 1][0];
    if (x >= x0 && x <= x1) {
      var t = (x1 === x0) ? 0 : (x - x0) / (x1 - x0);
      return anchors[i][1] + t * (anchors[i + 1][1] - anchors[i][1]);
    }
  }
  return anchors[n - 1][1];
};

/* 怪种判定：正常波里的怪种分三类（供 _drainQueue 定向加词缀 / 标记 + 预算分类）。
 *   BOSS 优先（type==="boss"）；其次精英（isEliteDef，ED 前缀）；其余=小怪。 */
Endless._kindOf = function (defId) {
  if (!defId) return "normal";
  var d = (typeof CFG !== "undefined" && CFG.monsters) ? CFG.monsters[defId] : null;
  if (d && d.type === "boss") return "boss";
  if (typeof isEliteDef === "function" ? isEliteDef(defId) : (defId.slice(0, 2) === "ED")) return "elite";
  return "normal";
};

/* 每帧唯一实例预算（性能护栏）：按怪种取 CFG.endless 的批次上限。
 *   小怪按 spawnBatch（默认 12），精英 eliteSpawnBatch（6），BOSS bossSpawnBatch（3）。 */
Endless._budgetFor = function (kind) {
  var c = CFG.endless || {};
  if (kind === "elite") return Math.max(1, c.eliteSpawnBatch || 6);
  if (kind === "boss") return Math.max(1, c.bossSpawnBatch || 3);
  return Math.max(1, c.spawnBatch || 12);
};

/* 生成后按怪种打标 / 加持：
 *   · 小怪：不额外处理（强度已在 _drainQueue 统一放大）；
 *   · 精英：applyElite 加 1~2 条随机词缀（ED 本就该带词缀；概率读 eliteAffixChance）；
 *   · BOSS：不进「主线 BOSS 序列」，仅标记 endlessBossMixed（供统计 / 🅑 甄别，不动 bossIndex）。 */
Endless._markKind = function (m, kind) {
  if (!m) return m;
  if (kind === "elite") {
    var chance = (CFG.endless && typeof CFG.endless.eliteAffixChance === "number") ? CFG.endless.eliteAffixChance : 1.0;
    if (typeof applyElite === "function" && Math.random() < chance) {
      applyElite(m);
      // 词缀会抬高 hpMax（如 hpMul 词缀）→ 同步当前血量，避免「血条已满却显示残血」
      if (typeof m.hpMax === "number") m.hp = m.hpMax;
    }
  } else if (kind === "boss") {
    m.endlessBossMixed = true;                                // 常规波夹杂的 BOSS（非主线序列 BOSS）
  }
  return m;
};

/* 本波三类怪只数（[normal, elite, boss]，和恒 = n = waveCap）：
 *   波 1~79   → boss=0，elite=round(n*精英比例)，normal=其余；
 *   波 80~89  → normal=0，boss=round(n*BOSS比例)，elite=其余；
 *   波 90+    → normal=0，elite=0，boss=n。
 * 三档断点（79/80、89/90）用固定阈值判断，比例只从 CFG 取，逻辑不硬编码数值。 */
Endless._mixCounts = function (wave, n) {
  var c = CFG.endless || {};
  var w = Math.max(1, wave | 0);
  var cap = Math.max(0, n | 0);
  var cuts = [79, 89];                                        // 构成断点（与用户口径一致）
  if (w <= cuts[0]) {                                         // ① 小怪为主，精英先少后多
    var er = this._lerpAnchors(c.eliteRatioAnchors, w, 0.10);
    er = Math.max(0, Math.min(1, er));
    var ne = Math.round(cap * er);
    return { normal: cap - ne, elite: ne, boss: 0 };
  }
  if (w <= cuts[1]) {                                         // ② 无小怪：精英为主 + 少量 BOSS
    var br = this._lerpAnchors(c.bossMixRatioAnchors, w, 0.05);
    br = Math.max(0, Math.min(1, br));
    var nb = Math.round(cap * br);
    return { normal: 0, elite: cap - nb, boss: nb };
  }
  var or = (typeof c.bossOnlyRatio === "number") ? c.bossOnlyRatio : 1.0;   // ③ 只有 BOSS
  or = Math.max(0, Math.min(1, or));
  var nbo = Math.round(cap * or);
  return { normal: 0, elite: cap - nbo, boss: nbo };
};

/* 本波 BOSS 的**唯一实例上限**（BOSS 池不足问题的解法，见 CFG.endless 注释）：
 *   90+ 波配额可能达 256~300 只，而 BOSS 池仅 10 种 → 不可能每只唯一。
 *   解法：唯一实例数 = min(本波 BOSS 只数, bossBudgetPerWave)，其余按类型轮转复制。
 *   ⚠️ 只限制「同一波内新增的 BOSS 种类数」，**不改只数**（用户口径：数量保持不变）。 */
Endless._bossQuota = function (wave, n) {
  var c = CFG.endless || {};
  var budget = (typeof c.bossBudgetPerWave === "number") ? c.bossBudgetPerWave : 20;
  return Math.max(0, Math.min(n | 0, budget));
};

/* 对外：本波构成摘要（供测试 / HUD / 调试；返回三档只数 + BOSS 唯一实例上限）。 */
Endless.waveComposition = function (wave) {
  var n = this.waveCap(wave);
  var r = this._mixCounts(wave, n);
  r.cap = n;
  r.bossUnique = this._bossQuota(wave, r.boss);
  return r;
};

/* 21.17 怪物构成曲线区块结束 */
