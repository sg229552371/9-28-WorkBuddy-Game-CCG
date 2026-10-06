/* ============================================================================
 * 21.12 性能压测场景（Stress Harness）—— 独立模块，不污染正式玩法
 * ----------------------------------------------------------------------------
 * 用途：验证「3000 敌人 + 2000 弹幕」的引擎上限，采集真实帧耗时与绘制调用数，
 *       并对比不同「群体抽象」渲染方案的观感与成本。
 *
 * 入口：URL 加 ?stress=N（N = 敌人数量，默认 3000），例如：
 *   index.html?stress=3000&bullets=2000&mode=lod
 * 参数：stress  敌人数量（默认 3000）
 *       bullets 子弹数量（默认 2000）
 *       mode    渲染方案：full（全精灵，基线对照）/ dot（纯色点）/ lod（三档分级，默认）
 *       ai      是否跑 AI 索敌（0=只测渲染，默认 1）
 *
 * 设计原则（对齐 §5.45 铁律）：文件末尾独立区块；主循环只插单行调用；无参数时零开销。
 * 关闭：无 ?stress 参数时 isActive() 恒 false，主循环走原逻辑，行为逐位不变。
 * ========================================================================== */

var StressHarness = {
  active: false,
  mode: "lod",
  config: { monsters: 3000, bullets: 2000, ai: true },

  /* 解析 URL 参数（幂等，可重复调用） */
  parseQuery() {
    if (typeof window === "undefined" || !window.location) return false;
    var q = window.location.search || "";
    if (q.indexOf("stress") < 0) { this.active = false; return false; }
    var get = function (k, d) {
      var m = q.match(new RegExp("[?&]" + k + "=([^&]*)"));
      return m ? m[1] : d;
    };
    this.config.monsters = Math.max(0, parseInt(get("stress", "3000"), 10) || 0);
    this.config.bullets = Math.max(0, parseInt(get("bullets", "2000"), 10) || 0);
    this.config.ai = get("ai", "1") !== "0";
    this.mode = get("mode", "lod");
    this.active = true;
    return true;
  },

  isActive() { return this.active === true; },

  /* ---------- 埋点（PerfGuard 之外的补充统计） ---------- */
  stats: {
    frames: 0,            // 累计帧数
    lastDur: 0,           // 上帧耗时（ms）
    sumDur: 0,            // 累计耗时（求均值）
    maxDur: 0,            // 峰值耗时
    drawCalls: 0,         // 本帧绘制调用数（渲染侧自报）
    culled: 0,            // 本帧剔除数
    tick: 0,              // 采样序号（供 UI 判断刷新）
  },
  reset() {
    var s = this.stats;
    s.frames = 0; s.lastDur = 0; s.sumDur = 0; s.maxDur = 0; s.drawCalls = 0; s.culled = 0; s.tick = 0;
  },
  /* 帧耗时采样（由主循环单行调用） */
  sampleFrame(dur) {
    var s = this.stats;
    s.frames++; s.lastDur = dur; s.sumDur += dur;
    if (dur > s.maxDur) s.maxDur = dur;
    s.tick++;
  },
  avgDur() { return this.stats.frames > 0 ? (this.stats.sumDur / this.stats.frames) : 0; },
  /* 渲染侧自报：本帧绘制调用数 + 剔除数 */
  reportDraw(calls, culled) {
    this.stats.drawCalls = calls;
    this.stats.culled = culled;
  },
};

/* ---------- 场景构建：直接复用正式 World/Monster/Bullet 类 ---------- */
StressHarness.build = function () {
  if (!this.isActive()) return false;
  var cfg = this.config;
  G.state = "playing";
  /* 补齐正式玩法的最小 run 上下文（World.update / Monster 构造 / 弹道结算都会读它）
   * —— 压测只为跑通逻辑层与渲染层，不做任何写盘/经济结算。 */
  var r = G.run = G.run || {};
  r.heroModules = r.heroModules || {};
  r.companions = r.companions || [];
  r.drones = r.drones || [];
  r.traps = r.traps || [];
  r.buffs = r.buffs || [];
  r.pickups = r.pickups || [];
  r.scale = r.scale || null;
  r.curse = null;
  r.autoFight = false;
  r.bossDefeated = true;        // 压测无 Boss：屏蔽 Boss 结算分支
  r.backpack = r.backpack || { cells: [], tryStackChest: function () { return false; }, findSpot: function () { return null; } };
  // 世界：isMain=false + kind="stress" → 构造走 setupArtisan 分支（仅 npc/exitBeacon 占位，不刷怪不摆障碍）
  var W = 1920, H = 1920;
  var w = new World(W, H, false, "stress");
  w.monsters = []; w.playerBullets = []; w.enemyBullets = [];
  w.groundChests = []; w.altars = []; w.circles = []; w.obstacles = [];
  w.freezeTimer = 0;            // 压测无开场冻结
  w.boss = null;
  this._spawnMonsterField(w, cfg.monsters);
  this._spawnBulletField(w, cfg.bullets);
  G.mainWorld = w; G.activeWorld = w;
  G.levelCfg = { theme: "#141a24", circles: [] };
  /* 玩家：轻量桩（不构造 Player 类——压测不跑正式玩法技能链，只做相机锚点 + 无敌）
   * 放地图中心 → 相机跟随，视野内可见一批敌人。
   * ⚠️ 必须实现 takeDamage 等方法：ai=1 走真实 World.update 时，敌方子弹命中玩家会调用它们
   *    （压测语义 = 玩家无敌，受到任何伤害都吞掉，不参与死亡结算）。 */
  var invulnPlayer = {
    x: W / 2, y: H / 2, r: 16, hp: 1e9, hpMax: 1e9,
    mvx: 0, mvy: 0, faceDir: 1, skillTimer: 0,
    invuln: true,
    takeDamage: function () { return false; },   // 吞伤害：压测不死亡
    heal: function () { }, addBuff: function () { }, die: function () { },
  };
  G.player = invulnPlayer;
  this.reset();
  return true;
};

/* 敌人铺场：均匀撒点（不按真实刷怪节奏，纯压渲染/更新） */
StressHarness._spawnMonsterField = function (w, n) {
  var ids = [];
  for (var id in CFG.monsters) {
    var d = CFG.monsters[id];
    if (d.type === "boss") continue;          // Boss 走弹幕系统，不铺
    if (typeof isEliteDef === "function" && isEliteDef(id)) continue;
    ids.push(id);
  }
  if (!ids.length) return;
  var side = Math.ceil(Math.sqrt(n));
  var step = Math.min(w.w, w.h) / (side + 1);
  var made = 0;
  for (var i = 0; i < side && made < n; i++) {
    for (var j = 0; j < side && made < n; j++) {
      var m = new Monster(ids[made % ids.length], (i + 1) * step, (j + 1) * step, 5);
      m.stress = true;                        // 标记：压测怪（渲染侧据此走 LOD）
      m.mvx = 0; m.mvy = 0;
      w.monsters.push(m);
      made++;
    }
  }
};

/* 弹幕铺场：铺在**相机可见环内**（竖屏可视区窄，环半径须匹配视野，否则立即出界消亡）
 * Bullet 签名：(x, y, ang, spd, dmg, side, ...) —— 顺序不能错 */
StressHarness._spawnBulletField = function (w, n) {
  var cx = w.w / 2, cy = w.h / 2;
  for (var i = 0; i < n; i++) {
    var ang = (i / Math.max(1, n)) * Math.PI * 2 + (i % 7) * 0.05;
    var rad = 30 + (i % 22) * 6.5;             // 30~167：多层密环，全在视野内
    var spd = 60 + (i % 5) * 12;               // 低速：减少出界频率
    var b = new Bullet(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, ang + Math.PI, spd, 5, "enemy");
    b.stress = true;
    b.life = 1e9;                              // 压测不自然消亡（由 _recycleBullets 兜底维持数量）
    w.enemyBullets.push(b);
  }
};

/* 弹幕补位：ai=1 走真实 World.update 时会撞墙消亡 → 每帧把缺额补回
 * （压测目标是「同屏稳定 N 条弹幕」，不是「子弹永不消亡」） */
StressHarness._recycleBullets = function (w, need) {
  var cur = w.enemyBullets.length;
  if (cur >= need) return 0;
  var cx = w.w / 2, cy = w.h / 2;
  var add = need - cur;
  for (var i = 0; i < add; i++) {
    var ang = (i / Math.max(1, add)) * Math.PI * 2 + (i % 7) * 0.05;
    var rad = 30 + (i % 22) * 6.5;
    var b = new Bullet(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, ang + Math.PI, 70, 5, "enemy");
    b.stress = true;
    b.life = 1e9;
    w.enemyBullets.push(b);
  }
  return add;
};

/* ---------- 压测场景的更新（AI 可选，默认只跑必要逻辑） ---------- */
StressHarness.update = function (dt) {
  if (!this.isActive()) return false;
  var w = G.activeWorld;
  if (!w) return true;
  if (this.config.ai) {
    // 真实 AI：走 World.update 全量（含索敌/寻路 → 测逻辑层上限）
    // 压测怪不参与 AI（避免 3000 只追逐玩家把 CPU 打满——那是另一个议题），
    // 但仍跑完整的碰撞/弹道/结算链路。
    w.update(dt);
    // 弹幕补位：真实 update 会因出界/命中消亡 → 维持同屏目标数量
    this._recycleBullets(w, this.config.bullets);
  } else {
    // 仅渲染压测：怪物静止、子弹匀速（不跑碰撞/索敌）
    for (var i = 0; i < w.monsters.length; i++) {
      var m = w.monsters[i];
      m.flashT = Math.max(0, (m.flashT || 0) - dt);
    }
    for (var j = 0; j < w.enemyBullets.length; j++) {
      var b = w.enemyBullets[j];
      b.x += (b.vx || 0) * dt; b.y += (b.vy || 0) * dt;
    }
    this._recycleBullets(w, this.config.bullets);
  }
  updateFX(dt);
  return true;
};

/* ---------- 压测场景的渲染：三档方案对照 ---------- */
StressHarness.render = function () {
  if (!this.isActive()) return false;
  var ctx = G.ctx, w = G.activeWorld;
  if (!ctx || !w) return true;
  var mode = this.mode;
  var zoom = (CFG.camera && CFG.camera.zoom) || 1;
  var viewW = G.W / zoom, viewH = G.H / zoom;
  var camX = U.clamp(G.player.x - viewW / 2, 0, Math.max(0, w.w - viewW));
  var camY = U.clamp(G.player.y - viewH / 2, 0, Math.max(0, w.h - viewH));
  ctx.fillStyle = "#141a24";
  ctx.fillRect(0, 0, G.W, G.H);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  var drawCalls = 0, culled = 0;
  var margin = 80;

  /* --- 敌人 --- */
  var szMul = CFG.monsterSizeMul || 1;
  var nearLimit = 60;                         // LOD 近档阈值（完整精灵数量上限）
  var nearCount = 0;
  var dotSize = 3;                            // 远档色点半径

  /* 视野预筛：把「视野内」与「视野外」先分开（剔除常态化，所有模式共用） */
  var vis = this._visBuf || (this._visBuf = []);
  vis.length = 0;
  for (var vi = 0; vi < w.monsters.length; vi++) {
    var vm = w.monsters[vi];
    if (vm.x + margin < camX || vm.x - margin > camX + viewW ||
        vm.y + margin < camY || vm.y - margin > camY + viewH) { culled++; continue; }
    vis.push(vm);
  }

  if (mode === "dot") {
    /* 方案 B：纯色点 —— 单 Path 批量（一次 fill 画完全部视野内敌人） */
    ctx.fillStyle = "#c96";
    ctx.beginPath();
    for (var i = 0; i < vis.length; i++) {
      var m = vis[i];
      ctx.moveTo(m.x + dotSize, m.y);        // moveTo 避免点间连线
      ctx.arc(m.x, m.y, dotSize, 0, Math.PI * 2);
    }
    ctx.fill();
    drawCalls++;
  } else if (mode === "full") {
    /* 方案 A：全精灵（基线对照，等同正式画质路径：每怪 drawImage + save/restore + 血条） */
    for (var f = 0; f < vis.length; f++) {
      var mf = vis[f];
      var img = mf.sprite, size = 48 * szMul;
      if (img) {
        ctx.save();
        if (mf.flashT > 0) ctx.filter = "brightness(2)";
        ctx.drawImage(img, mf.x - size / 2, mf.y - size / 2, size, size);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(mf.x, mf.y, mf.r, 0, Math.PI * 2); ctx.fill();
      }
      var bw = 34;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(mf.x - bw / 2, mf.y - size / 2 - 12, bw, 5);
      ctx.fillStyle = "#e5a04b"; ctx.fillRect(mf.x - bw / 2, mf.y - size / 2 - 12, bw, 5);
      drawCalls += 3;
    }
  } else {
    /* 方案 C（默认）：三档 LOD
     *   近档：完整精灵 + 血条（带 save/restore 滤镜路径）
     *   中档/远档：合并进单 Path 色点批量（一次 fill 画完，drawCall 只 +1） */
    var nearList = this._nearBuf || (this._nearBuf = []);
    var dotList = this._dotBuf || (this._dotBuf = []);
    nearList.length = 0; dotList.length = 0;
    var cx0 = camX + viewW / 2, cy0 = camY + viewH / 2;
    var nearR2 = (viewH * 0.30) * (viewH * 0.30);   // 近档半径（屏幕高 30%）
    for (var k = 0; k < vis.length; k++) {
      var m2 = vis[k];
      var dx = m2.x - cx0, dy = m2.y - cy0;
      if ((dx * dx + dy * dy) < nearR2 && nearCount < nearLimit) { nearCount++; nearList.push(m2); }
      else dotList.push(m2);
    }
    /* 远/中档：单 Path 色点 */
    if (dotList.length) {
      ctx.fillStyle = "#c96";
      ctx.beginPath();
      for (var d = 0; d < dotList.length; d++) {
        ctx.moveTo(dotList[d].x + dotSize, dotList[d].y);
        ctx.arc(dotList[d].x, dotList[d].y, dotSize, 0, Math.PI * 2);
      }
      ctx.fill();
      drawCalls++;
    }
    /* 近档：完整精灵 + 血条 */
    for (var n2 = 0; n2 < nearList.length; n2++) {
      var mn = nearList[n2];
      var img2 = mn.sprite, size2 = 48 * szMul;
      if (img2) {
        ctx.drawImage(img2, mn.x - size2 / 2, mn.y - size2 / 2, size2, size2);
      } else {
        ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r, 0, Math.PI * 2); ctx.fill();
      }
      var bw2 = 34;
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(mn.x - bw2 / 2, mn.y - size2 / 2 - 12, bw2, 5);
      ctx.fillStyle = "#e5a04b"; ctx.fillRect(mn.x - bw2 / 2, mn.y - size2 / 2 - 12, bw2, 5);
      drawCalls += 3;
    }
  }

  /* --- 弹幕：单 Path 批量绘制（一次 beginPath + N arc + 单次 fill） --- */
  var eb = w.enemyBullets;
  ctx.fillStyle = "#c79bff";
  ctx.beginPath();
  for (var p = 0; p < eb.length; p++) {
    var bp = eb[p];
    ctx.moveTo(bp.x + 5, bp.y);
    ctx.arc(bp.x, bp.y, 5, 0, Math.PI * 2);
  }
  ctx.fill();
  drawCalls++;   // 整批 = 1 次填充调用

  ctx.restore();
  this.reportDraw(drawCalls, culled);
  this._drawHud(ctx);
  return true;
};

/* 压测 HUD：实时显示帧耗时 / 绘制调用 / 实体数 / 剔除数（画在 canvas 上，不依赖 DOM） */
StressHarness._drawHud = function (ctx) {
  var s = this.stats;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  var lines = [
    "STRESS mode=" + this.mode + " ai=" + (this.config.ai ? 1 : 0),
    "monsters " + this.config.monsters + "  bullets " + this.config.bullets,
    "frame " + s.lastDur.toFixed(1) + "ms  avg " + this.avgDur().toFixed(1) + "  max " + s.maxDur.toFixed(1),
    "drawCalls " + s.drawCalls + "  culled " + s.culled + "  frames " + s.frames,
  ];
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  for (var i = 0; i < lines.length; i++) {
    ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.lineWidth = 4;
    ctx.strokeText(lines[i], 14, 32 + i * 26);
    ctx.fillStyle = "#8ef0a0";
    ctx.fillText(lines[i], 14, 32 + i * 26);
  }
  ctx.restore();
};

/* ---------- 自检：无参数时零开销 ---------- */
StressHarness.selfCheck = function () {
  var issues = [];
  if (typeof CFG === "undefined") issues.push("CFG 缺失");
  if (typeof World === "undefined") issues.push("World 缺失");
  if (typeof Monster === "undefined") issues.push("Monster 缺失");
  if (typeof Bullet === "undefined") issues.push("Bullet 缺失");
  return issues;
};
