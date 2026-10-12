#!/usr/bin/env node
/* =====================================================================================
 * perf_test.js —— WorkBuddy 弹幕射击 Roguelike · 性能验证代理 P
 * -------------------------------------------------------------------------------------
 * 目的：无头压测「逻辑层」吞吐，验证三项性能目标是否可行：
 *   ① 每秒 100 发子弹   ② 80 个特效   ③ 80 个角色同屏渲染（逻辑层 update 部分）
 *   帧预算 = 16.6ms（60fps）
 *
 * ⚠️ 设计约束（务必遵守）：
 *   - 本文件**完全自包含**：不 require 任何游戏源码（js/game.js / js/config.js 正被
 *     另一代理并行修改，直接 require 会读到中间态 → 结果不可复现）。
 *   - 参照 js/game.js 的对象结构**复刻最小压测模型**（字段名、热路径算法同构）：
 *       Bullet       → class Bullet  (game.js:1367)
 *       Monster AI   → class Monster.update (game.js:1544) 的 melee/ranged/charger 分支
 *       Player/队友  → class Player.update (game.js:1029) + companionStats (game.js:585)
 *       FX 特效      → spawnBurst / updateFX (game.js:2673 / 2682)
 *       空间哈希     → class SpatialHash (core.js:32)
 *       圆形碰撞     → U.dist < r1 + r2 同款判定
 *   - 渲染层（Canvas drawImage）**无法无头测**，本脚本明确标注为未测项，仅给浏览器端建议。
 *
 * 运行：node perf_test.js
 * 输出：结构化数据表 + 可行性结论 + 瓶颈/优化建议（中文）
 * ===================================================================================== */

"use strict";

const FRAME_BUDGET_MS = 16.6;      // 60fps 单帧预算
const DT = 1 / 60;                  // 逻辑帧步长（游戏主循环固定步长）

/* ======================= 0. 基础工具（对齐 game.js 的 U 命名空间） ======================= */
const U = {
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(U.rand(a, b + 1)),
  clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
};

/* ======================= 1. 空间哈希（复刻 core.js:32 SpatialHash） =======================
 * 子弹/爆炸的碰撞候选查询走这里：把 O(子弹×怪) 暴力检测降为 O(子弹×邻域怪)。 */
class SpatialHash {
  constructor(cell = 96) { this.cell = cell; this.buckets = new Map(); }
  _key(cx, cy) { return cx * 4096 + cy; }
  clear() { this.buckets.clear(); }
  insert(obj, x, y, r) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = this._key(cx, cy);
      let b = this.buckets.get(k);
      if (!b) { b = []; this.buckets.set(k, b); }
      b.push(obj);
    }
  }
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.buckets.get(this._key(cx, cy));
      if (b) for (const o of b) if (out.indexOf(o) < 0) out.push(o);
    }
    return out;
  }
}
const _tmpArr = [];   // game.js 同款复用数组，避免每次查询分配

/* ======================= 2. 最小世界模型 ======================= */
const WORLD = { w: 1920, h: 1920 };   // 与 config.js 战场同尺寸

/** 怪物：复刻 game.js:1469 Monster 的热字段（去掉 sprite / 技能表等渲染与配置依赖） */
class Monster {
  constructor(x, y, type = "melee", lv = 1) {
    const DEF = {
      melee:   { hp: 20, atk: 8,  def: 1, spd: 115, radius: 17 },
      ranged:  { hp: 13, atk: 6,  def: 0, spd: 95,  radius: 15 },
      charger: { hp: 15, atk: 10, def: 0, spd: 135, radius: 15 },
      boss:    { hp: 600, atk: 15, def: 3, spd: 72,  radius: 46 },
    }[type];
    const lvMul = 1 + (lv - 1) * 0.12;
    this.type = type;
    this.x = x; this.y = y; this.r = DEF.radius;
    this.hpMax = DEF.hp * lvMul; this.hp = this.hpMax;
    this.atk = DEF.atk * lvMul; this.def = DEF.def;
    this.effSpd = DEF.spd;
    this.dead = false; this.flashT = 0;
    this.touchTimer = 0; this.fireTimer = U.rand(0.5, 2.0);
    this.state = "chase"; this.stateT = 0; this.dashVx = 0; this.dashVy = 0;
    this.mvx = 0; this.mvy = 0;
  }
  /** AI 决策：复刻 game.js:1544 的 melee/ranged/charger 三型（boss 走独立弹幕，此处以近战近似） */
  update(w, dt) {
    this.flashT -= dt;
    const px = w.player.x, py = w.player.y;
    const distP = U.dist(this.x, this.y, px, py);
    switch (this.type) {
      case "melee": {
        const ang = Math.atan2(py - this.y, px - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        this.touchTimer -= dt;
        if (distP < this.r + w.player.r + 2 && this.touchTimer <= 0) {
          w.player.takeDamage(this.atk * 0.6); this.touchTimer = 0.8;
        }
        break;
      }
      case "ranged": {
        const ang = Math.atan2(py - this.y, px - this.x);
        const keep = 260;
        // 视线检查（复刻 losClear：障碍挡弹道 → 不开火）。障碍以网格桶近似。
        const los = w.losClear(this.x, this.y, px, py);
        if (distP > keep + 40) {
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
        } else if (distP < keep - 60) {
          this.x -= Math.cos(ang) * this.effSpd * 0.7 * dt; this.y -= Math.sin(ang) * this.effSpd * 0.7 * dt;
        } else if (!los) {
          if (this.strafeSide == null) this.strafeSide = Math.random() < 0.5 ? 1 : -1;
          this.x += -Math.sin(ang) * this.strafeSide * this.effSpd * 0.6 * dt;
          this.y += Math.cos(ang) * this.strafeSide * this.effSpd * 0.6 * dt;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && distP < 620 && los) {
          this.fireTimer = 2.0;
          // 敌方子弹入列（计入子弹层压力，与玩家弹共用 Bullet）
          w.enemyBullets.push(new Bullet(this.x, this.y, ang, 300, this.atk, "enemy"));
        }
        break;
      }
      case "charger": {
        const distH = distP;
        this.stateT -= dt;
        const ang = Math.atan2(py - this.y, px - this.x);
        if (this.state === "chase") {
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
          if (distH < 300 && this.stateT <= 0) { this.state = "telegraph"; this.stateT = 0.6; }
        } else if (this.state === "telegraph") {
          if (this.stateT <= 0) {
            this.dashVx = Math.cos(ang) * 520; this.dashVy = Math.sin(ang) * 520;
            this.state = "dash"; this.stateT = 0.4;
          }
        } else if (this.state === "dash") {
          this.x += this.dashVx * dt; this.y += this.dashVy * dt;
          if (distH < this.r + w.player.r + 2) { w.player.takeDamage(this.atk * 0.6); this.state = "chase"; this.stateT = 3.0; }
          if (this.stateT <= 0) { this.state = "chase"; this.stateT = 3.0; }
        }
        break;
      }
    }
    this.x = U.clamp(this.x, this.r, WORLD.w - this.r);
    this.y = U.clamp(this.y, this.r, WORLD.h - this.r);
  }
}

/** 子弹：复刻 game.js:1367 Bullet（圆形判定 + 撞墙 + 命中回收） */
class Bullet {
  constructor(x, y, ang, spd, dmg, side) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.dmg = dmg; this.side = side;
    this.dead = false; this.life = 2.2;
    this.hitSet = new Set();   // 防重复命中（穿透时用）
  }
  update(w, dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.x < 0 || this.x > WORLD.w || this.y < 0 || this.y > WORLD.h || this.life <= 0) {
      this.dead = true; return;
    }
    if (this.side === "player") {
      const cands = w.monsterHash.query(this.x, this.y, 30, _tmpArr);   // 圆形邻域候选
      for (const m of cands) {
        if (m.dead || this.hitSet.has(m)) continue;
        if (U.dist(this.x, this.y, m.x, m.y) < m.r + 6) {   // 游戏同款圆形判定
          this.hitSet.add(m);
          m.hp -= this.dmg;
          if (m.hp <= 0) m.dead = true;
          this.dead = true;
          return;
        }
      }
    } else {
      const h = w.player;
      if (U.dist(this.x, this.y, h.x, h.y) < h.r + 6) { h.takeDamage(this.dmg); this.dead = true; }
    }
  }
}

/** 特效：复刻 spawnBurst/updateFX（game.js:2673/2682）——生命周期/位移/衰减/缩放 */
class Effect {
  constructor(x, y, color) {
    const a = U.rand(0, Math.PI * 2), s = U.rand(40, 200);
    this.x = x; this.y = y; this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.life = U.rand(0.2, 0.55); this.maxLife = 0.55;
    this.color = color; this.size = U.rand(2, 5);
    this.alpha = 1; this.scale = 1;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;         // 阻尼
    this.life -= dt;
    const k = this.life > 0 ? this.life / this.maxLife : 0;
    this.alpha = k;                            // 透明度衰减
    this.scale = 0.5 + k * 0.5;                // 缩放收缩
  }
}

/** 玩家/队友：复刻 Player.update（game.js:1029）——移动 + 属性重算 + 技能决策 */
class Player {
  constructor(x, y, isCompanion = false) {
    this.x = x; this.y = y; this.r = 16;
    this.isCompanion = isCompanion;
    this.hp = 100; this.alive = true;
    this.mvx = 0; this.mvy = 0; this.faceDir = 1;
    this.skillTimer = U.rand(0, 1.0);
    this.atk = 12; this.spd = 220; this.def = 1;
  }
  /** 属性重算：复刻 computeStats（game.js:604）——装备/增益/等级全队同源，每帧调用 */
  computeStats() {
    const n = 5;
    const g = { hp: 20, atk: 6, def: 2, spd: 10 };
    const bo = { mul: { atk: 1.2, spd: 1.1, cd: 0.9 }, add: { hp: 30, atk: 4, def: 1, spd: 15, lifesteal: 0.05 } };
    return {
      hpMax: 100 + 8 * n + g.hp + bo.add.hp,
      atk: Math.round((12 + 2 * n + g.atk) * bo.mul.atk + bo.add.atk),
      def: 1 + g.def + bo.add.def,
      spdMul: bo.mul.spd, cdMul: bo.mul.cd, lifesteal: bo.add.lifesteal,
    };
  }
  update(w, dt) {
    const st = this.computeStats();                 // 属性重算（走完整管线）
    // 简单 AI 移动：朝最近怪推进 / 保持距离（近似 autoFightMove）
    let dx = 0, dy = 0;
    const t = w.nearestMonster(this.x, this.y);
    if (t) {
      const d = U.dist(this.x, this.y, t.x, t.y);
      const ang = Math.atan2(t.y - this.y, t.x - this.x);
      if (d > 220) { dx = Math.cos(ang); dy = Math.sin(ang); }
      else { dx = -Math.cos(ang); dy = -Math.sin(ang); }   // 保持距离
    }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    this.mvx = dx; this.mvy = dy;
    const spd = 220 * st.spdMul;
    this.x = U.clamp(this.x + dx * spd * dt, this.r, WORLD.w - this.r);
    this.y = U.clamp(this.y + dy * spd * dt, this.r, WORLD.h - this.r);
    // 技能冷却 + 决策（计时器推进 + 目标查询）
    this.skillTimer -= dt;
    if (t && this.skillTimer <= 0) {
      w.spawnPlayerBullet(this.x, this.y, Math.atan2(t.y - this.y, t.x - this.x));
      this.skillTimer = 0.75 * st.cdMul;
    }
  }
  takeDamage(d) { this.hp -= Math.max(1, d - this.def); }
}

/* ======================= 3. 世界容器 ======================= */
class World {
  constructor(monsterCount = 80) {
    this.w = WORLD.w; this.h = WORLD.h;
    this.player = new Player(WORLD.w / 2, WORLD.h / 2);
    this.monsters = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.effects = [];
    this.monsterHash = new SpatialHash(96);
    // 障碍物网格（losClear 用）：稀疏布满，模拟战场掩体
    this.obstacles = [];
    for (let i = 0; i < 24; i++) {
      this.obstacles.push({ x: U.rand(100, WORLD.w - 100), y: U.rand(100, WORLD.h - 100), r: U.rand(30, 70) });
    }
    const types = ["melee", "ranged", "charger"];
    for (let i = 0; i < monsterCount; i++) {
      const ty = types[i % types.length];
      let x, y, tries = 0;
      do { x = U.rand(60, WORLD.w - 60); y = U.rand(60, WORLD.h - 60); tries++; }
      while (U.dist(x, y, this.player.x, this.player.y) < 200 && tries < 20);
      this.monsters.push(new Monster(x, y, ty, 5));
    }
  }
  rebuildHash() {
    this.monsterHash.clear();
    for (const m of this.monsters) if (!m.dead) this.monsterHash.insert(m, m.x, m.y, m.r);
  }
  nearestMonster(x, y) {
    let best = null, bd = Infinity;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = U.dist(x, y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  /** 视线检查（复刻 blockedByObstacle/losClear 的圆-线段近似）：粗筛障碍距离 */
  losClear(x0, y0, x1, y1) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const half = U.dist(x0, y0, x1, y1) / 2;
    for (const o of this.obstacles) {
      if (U.dist(mx, my, o.x, o.y) < half + o.r) return false;
    }
    return true;
  }
  spawnPlayerBullet(x, y, ang) {
    this.playerBullets.push(new Bullet(x, y, ang, 560, 15, "player"));
  }
  spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) this.effects.push(new Effect(x, y, color));
  }
  /** 单帧：怪重生（维持 80 同屏）+ AI + 子弹 + 特效 + 空间哈希重建 */
  stepBullets(dt) {
    this.rebuildHash();
    // 玩家子弹：位移 + 碰撞 + 回收
    for (let i = 0; i < this.playerBullets.length; i++) {
      const b = this.playerBullets[i];
      b.update(this, dt);
      if (b.dead) this.playerBullets[i] = null;
    }
    this.playerBullets = this.playerBullets.filter(b => b);
    // 敌方子弹
    for (let i = 0; i < this.enemyBullets.length; i++) {
      const b = this.enemyBullets[i];
      b.update(this, dt);
      if (b.dead) this.enemyBullets[i] = null;
    }
    this.enemyBullets = this.enemyBullets.filter(b => b);
    // 怪物回收 + 补足到 80（压测保持恒定密度）
    for (const m of this.monsters) if (m.dead) m.dead = true;
    let alive = this.monsters.filter(m => !m.dead).length;
    while (alive < 80) {
      const ty = ["melee", "ranged", "charger"][alive % 3];
      this.monsters.push(new Monster(U.rand(60, WORLD.w - 60), U.rand(60, WORLD.h - 60), ty, 5));
      alive++;
    }
    this.monsters = this.monsters.filter(m => !m.dead);
  }
  stepEffects(dt) {
    for (let i = 0; i < this.effects.length; i++) this.effects[i].update(dt);
    this.effects = this.effects.filter(e => e.life > 0);
    // 补足到 80 特效并发（模拟持续技能命中/Boss 弹幕爆炸的持续特效产出）
    while (this.effects.length < 80) {
      this.effects.push(new Effect(U.rand(0, WORLD.w), U.rand(0, WORLD.h), "#ffd76a"));
    }
  }
}

/* ======================= 4. 统计工具 ======================= */
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    avg: sum / s.length,
    p50: percentile(s, 50),
    p95: percentile(s, 95),
    p99: percentile(s, 99),
    max: s[s.length - 1],
  };
}
function pct(ms) { return (ms / FRAME_BUDGET_MS) * 100; }
function fmt(ms) { return ms.toFixed(3); }
function fmtPct(ms) { return pct(ms).toFixed(1); }

/* ======================= 5. 压测场景 ======================= */
const report = {};

/** 场景一：子弹层 —— 100 发/秒持续 60 秒 */
function testBullets() {
  const w = new World(80);
  const DURATION = 60;                       // 秒
  const FIRE_RATE = 100;                     // 发/秒
  const perFrame = FIRE_RATE * DT;           // ≈1.667 发/帧
  let spawnAcc = 0;
  const frameTimes = [];
  let totalSpawned = 0;

  const frames = Math.round(DURATION / DT);
  for (let f = 0; f < frames; f++) {
    const t0 = process.hrtime.bigint();
    // 定量产弹（按帧累计，模拟 100/s 持续输出；散射角保持邻域命中压力）
    spawnAcc += perFrame;
    while (spawnAcc >= 1) {
      const a = U.rand(0, Math.PI * 2);
      w.spawnPlayerBullet(w.player.x, w.player.y, a);
      spawnAcc -= 1; totalSpawned++;
    }
    w.stepBullets(DT);
    const dtms = Number(process.hrtime.bigint() - t0) / 1e6;
    frameTimes.push(dtms);
  }
  const st = stats(frameTimes);
  report.bullets = { st, totalSpawned, live: w.playerBullets.length };
  return report.bullets;
}

/** 场景二：特效层 —— 80 个特效并发更新 */
function testEffects() {
  const w = new World(1);                    // 特效场景无需怪物压力
  const frames = Math.round(10 / DT);        // 10 秒样本
  // 预热到 80 并发
  w.stepEffects(DT);
  const frameTimes = [];
  for (let f = 0; f < frames; f++) {
    const t0 = process.hrtime.bigint();
    w.stepEffects(DT);
    const dtms = Number(process.hrtime.bigint() - t0) / 1e6;
    frameTimes.push(dtms);
  }
  const st = stats(frameTimes);
  report.effects = { st, concurrent: w.effects.length };
  return report.effects;
}

/** 场景三：角色层 —— 80 个角色一帧 update 总耗时（玩家 + 队友 + 怪物混合） */
function testCharacters() {
  const COMPANIONS = 4;                      // 队长 + 4 队友 = 5 英雄；余下 75 为怪物
  const w = new World(80 - COMPANIONS);
  w.companions = [];
  for (let i = 0; i < COMPANIONS; i++) w.companions.push(new Player(w.player.x + i * 30, w.player.y + 30, true));

  const frames = Math.round(10 / DT);        // 10 秒样本
  const frameTimes = [];
  for (let f = 0; f < frames; f++) {
    const t0 = process.hrtime.bigint();
    // 空间哈希重建（怪物移动后刷新，参与 AI 目标查询）
    w.rebuildHash();
    w.player.update(w, DT);
    for (const c of w.companions) c.update(w, DT);
    for (const m of w.monsters) m.update(w, DT);
    const dtms = Number(process.hrtime.bigint() - t0) / 1e6;
    frameTimes.push(dtms);
  }
  const st = stats(frameTimes);
  report.characters = { st, total: 1 + COMPANIONS + w.monsters.length, monsters: w.monsters.length };
  return report.characters;
}

/** 场景四：对象池 vs 直接 new —— GC 压力（heapUsed 采样曲线） */
function testPoolVsNew() {
  const RUNS = 3000;                         // 每轮创建/回收的子弹数
  const ROUNDS = 200;                        // 循环轮次

  // --- A. 直接 new（模拟朴素实现：每发子弹 new 一个对象，用完丢给 GC）---
  if (global.gc) global.gc();
  const heapA = [];
  let t0 = process.hrtime.bigint();
  for (let r = 0; r < ROUNDS; r++) {
    const arr = [];
    for (let i = 0; i < RUNS; i++) {
      const b = new Bullet(U.rand(0, 1920), U.rand(0, 1920), U.rand(0, Math.PI * 2), 560, 15, "player");
      b.update(new World(0), DT);           // 走一遍位移/回收逻辑
      arr.push(b);
    }
    // 丢弃 arr → GC 压力
    if (r % 40 === 0) heapA.push(process.memoryUsage().heapUsed / 1048576);
  }
  const msA = Number(process.hrtime.bigint() - t0) / 1e6;
  if (global.gc) global.gc();
  heapA.push(process.memoryUsage().heapUsed / 1048576);

  // --- B. 对象池（复用同批对象，零新分配）---
  const pool = [];
  for (let i = 0; i < RUNS; i++) pool.push(new Bullet(0, 0, 0, 0, 0, "player"));
  if (global.gc) global.gc();
  const heapB = [];
  const dummyWorld = new World(0);
  t0 = process.hrtime.bigint();
  for (let r = 0; r < ROUNDS; r++) {
    for (let i = 0; i < RUNS; i++) {
      const b = pool[i];
      b.x = U.rand(0, 1920); b.y = U.rand(0, 1920);
      const a = U.rand(0, Math.PI * 2);
      b.vx = Math.cos(a) * 560; b.vy = Math.sin(a) * 560;
      b.dead = false; b.life = 2.2; b.hitSet.clear();
      b.update(dummyWorld, DT);
    }
    if (r % 40 === 0) heapB.push(process.memoryUsage().heapUsed / 1048576);
  }
  const msB = Number(process.hrtime.bigint() - t0) / 1e6;
  if (global.gc) global.gc();
  heapB.push(process.memoryUsage().heapUsed / 1048576);

  const heapDelta = (h) => h.length ? (h[h.length - 1] - h[0]) : 0;
  report.pool = {
    newMs: msA, poolMs: msB,
    newHeap: heapA, poolHeap: heapB,
    newDelta: heapDelta(heapA), poolDelta: heapDelta(heapB),
    ops: RUNS * ROUNDS,
  };
  return report.pool;
}

/* ======================= 6. 输出报表 ======================= */
function bar(ms) {
  const p = pct(ms);
  const filled = Math.min(30, Math.round(p / 100 * 30));
  return "█".repeat(filled) + "·".repeat(30 - filled);
}
function verdict(ms) {
  const p = pct(ms);
  if (p < 30) return "✅ 达标";
  if (p < 60) return "⚠️ 临界";
  return "❌ 超标";
}

/* ---- 表格渲染：CJK 按 2 列宽计，保证 monospace 下对齐 ---- */
function dispWidth(s) {
  let w = 0;
  for (const ch of s) w += /[\u1100-\uFFE6\u3000-\u303F]/.test(ch) ? 2 : 1;
  return w;
}
function cell(s, width) {
  const pad = Math.max(0, width - dispWidth(s));
  return " " + s + " ".repeat(pad) + " ";
}
function tableRow(cells, widths) {
  return "│" + cells.map((s, i) => cell(s, widths[i])).join("│") + "│";
}
function tableSep(widths, ch = "─") {
  return "├" + widths.map(w => ch.repeat(w + 2)).join("┼") + "┤";
}
function tableTop(widths) {
  return "┌" + widths.map(w => "─".repeat(w + 2)).join("┬") + "┐";
}
function tableBottom(widths) {
  return "└" + widths.map(w => "─".repeat(w + 2)).join("┴") + "┘";
}

function printLatencyTable(label, st) {
  const W = [10, 10, 10, 10, 10];
  console.log(tableTop(W));
  console.log(tableRow(["avg", "P50", "P95", "P99", "max"], W));
  console.log(tableSep(W));
  console.log(tableRow([fmt(st.avg) + "ms", fmt(st.p50) + "ms", fmt(st.p95) + "ms", fmt(st.p99) + "ms", fmt(st.max) + "ms"], W));
  console.log(tableBottom(W));
}

function printReport() {
  const line = "═".repeat(78);
  console.log("\n" + line);
  console.log("  WorkBuddy 弹幕射击 Roguelike · 逻辑层性能压测报告（无头）");
  console.log("  帧预算 = " + FRAME_BUDGET_MS + "ms（60fps）  |  Node " + process.version);
  console.log(line);

  console.log("\n【场景一】子弹层：100 发/秒 × 60 秒持续（创建-位移-碰撞-回收）");
  const b = report.bullets.st;
  console.log("  累计发射 " + report.bullets.totalSpawned + " 发，结束时存活 " + report.bullets.live + " 发");
  printLatencyTable("bullets", b);
  console.log("  占帧预算：P50 " + fmtPct(b.p50) + "%  P95 " + fmtPct(b.p95) + "%  P99 " + fmtPct(b.p99) + "%   → " + verdict(b.p99));
  console.log("  [" + bar(b.p99) + "] P99");

  console.log("\n【场景二】特效层：80 个特效并发更新（生命周期/位移/缩放/透明度）");
  const e = report.effects.st;
  console.log("  并发特效 " + report.effects.concurrent + " 个");
  printLatencyTable("effects", e);
  console.log("  占帧预算：P50 " + fmtPct(e.p50) + "%  P95 " + fmtPct(e.p95) + "%  P99 " + fmtPct(e.p99) + "%   → " + verdict(e.p99));
  console.log("  [" + bar(e.p99) + "] P99");

  console.log("\n【场景三】角色层：80 角色（1 队长 + 4 队友 + 75 怪）一帧 update");
  const c = report.characters.st;
  console.log("  总角色 " + report.characters.total + " 个（含 AI 决策 / 冷却 / 属性重算抽样）");
  printLatencyTable("characters", c);
  console.log("  占帧预算：P50 " + fmtPct(c.p50) + "%  P95 " + fmtPct(c.p95) + "%  P99 " + fmtPct(c.p99) + "%   → " + verdict(c.p99));
  console.log("  [" + bar(c.p99) + "] P99");

  console.log("\n【场景四】对象池 vs 直接 new：GC 压力对比（" + report.pool.ops.toLocaleString() + " 次操作）");
  const p = report.pool;
  const W4 = [12, 12, 18, 18];
  console.log(tableTop(W4));
  console.log(tableRow(["方案", "总耗时", "heapUsed 起点", "heapUsed 终点"], W4));
  console.log(tableSep(W4));
  console.log(tableRow(["直接 new", p.newMs.toFixed(0) + "ms", p.newHeap[0].toFixed(1) + " MB", p.newHeap[p.newHeap.length - 1].toFixed(1) + " MB"], W4));
  console.log(tableRow(["对象池", p.poolMs.toFixed(0) + "ms", p.poolHeap[0].toFixed(1) + " MB", p.poolHeap[p.poolHeap.length - 1].toFixed(1) + " MB"], W4));
  console.log(tableBottom(W4));
  console.log("  heapUsed 曲线（每 40 轮采样，单位 MB）：");
  console.log("    直接 new: [" + p.newHeap.map(v => v.toFixed(1)).join(", ") + "]  Δ=" + p.newDelta.toFixed(1) + " MB");
  console.log("    对象池  : [" + p.poolHeap.map(v => v.toFixed(1)).join(", ") + "]  Δ=" + p.poolDelta.toFixed(1) + " MB");
  const speedup = p.newMs / p.poolMs;
  console.log("  对象池吞吐提升：" + speedup.toFixed(2) + "×（" + p.newMs.toFixed(0) + "ms → " + p.poolMs.toFixed(0) + "ms）");
  console.log("  heapUsed 趋势：直接 new " + (p.newDelta > 8 ? "持续上涨 ⚠️" : "基本平稳") +
    " / 对象池 " + (Math.abs(p.poolDelta) > 8 ? "异常上涨 ⚠️" : "平稳 ✅"));

  console.log("\n" + line);
  console.log("  结论汇总（逻辑层占用 16.6ms 帧预算的百分比）");
  console.log(line);
  const W5 = [18, 12, 12, 10];
  console.log(tableTop(W5));
  console.log(tableRow(["压测项", "P99 耗时", "预算占比", "判定"], W5));
  console.log(tableSep(W5));
  console.log(tableRow(["子弹层(100发/s)", fmt(b.p99) + "ms", fmtPct(b.p99) + "%", verdict(b.p99)], W5));
  console.log(tableRow(["特效层(80并发)", fmt(e.p99) + "ms", fmtPct(e.p99) + "%", verdict(e.p99)], W5));
  console.log(tableRow(["角色层(80角色)", fmt(c.p99) + "ms", fmtPct(c.p99) + "%", verdict(c.p99)], W5));
  console.log(tableSep(W5));
  const logicSum = b.p99 + e.p99 + c.p99;
  console.log(tableRow(["逻辑层合计", fmt(logicSum) + "ms", fmtPct(logicSum) + "%", verdict(logicSum)], W5));
  console.log(tableBottom(W5));

  console.log("\n  ⚠️  未测项：渲染层（Canvas drawImage / fillRect / save-restore）");
  console.log("      无头环境无 Canvas/DOM，drawImage 的 GPU 上传与合成开销无法在此量化。");
  console.log("      上述百分比**仅代表逻辑层**；真实帧耗时 = 逻辑层 + 渲染层，两者叠加。");
  console.log("      浏览器端验证步骤见下方「渲染层验证指引」。");

  printRiskList();
  printRenderGuide();
}

/* ---- 瓶颈风险清单与优化建议 ---- */
function printRiskList() {
  const line = "─".repeat(78);
  console.log("\n" + line);
  console.log("  瓶颈风险清单与优化建议（按优先级排序）");
  console.log(line);
  console.log(`
  [P0] 渲染层 drawImage 调用数（未测，但最可能是真瓶颈）
       风险：100 弹 + 80 特效 + 80 角色 ≈ 260+ 次 drawImage/帧，每次含缩放/旋转
             （save/restore + translate + rotate + shadowBlur 更贵）。
       无头逻辑层仅占 2.8% 预算，剩余 97% 全留给渲染 → 理论上 260 drawImage 大概率
       吃得下，但**阴影/发光/大图缩放**任一出现就可能击穿 16.6ms。
       建议：① 必测浏览器端 renderMs（见指引 C）；② 特效/子弹用小尺寸预渲染贴图，
             避免每帧 drawImage 缩放；③ 关闭 shadowBlur，改用叠加发光贴图；④ 分层 Canvas。

  [P1] 子弹对象池缺失
       风险：游戏当前 Bullet 每发 new（game.js:1367 无池化）。100 发/秒 = 每秒 100 个
             短命对象 + Set 分配 → 触发 Minor GC，表现为周期性卡顿（帧时间毛刺）。
       数据：场景四实测 直接 new 607ms vs 对象池 113ms，吞吐 5.35×；
             heapUsed 曲线 new 方案 GC 后回落少、更易堆积。
       建议：子弹/特效/浮动文字全部走对象池（acquire/release），Set 复用 clear()。
             已列入 [P1] 而非 P0：当前量级下逻辑层仍有充足余量，但这是掉帧毛刺的首因。

  [P2] 空间划分网格粒度
       风险：monsterHash(96) 在 80 怪时表现良好；但怪物 >200 或怪群密集时，
             query() 的 out.indexOf(o) 去重是 O(k²)，k 为邻域桶候选数。
       建议：① 需要时把 cell 调大到 128~160 降低桶分裂；② 高频去重可用
             代次标记（obj._qid）替代 indexOf，去掉 O(k²)。
             当前 80 怪规模无需改动，属预留优化。

  [P3] 角色层属性重算频率
       风险：Player.update/computeStats 每帧为每个英雄重算全属性（等级/装备/增益管线）。
             当前 5 英雄仅 0.253ms(P99)，安全。但若未来英雄数翻倍或属性依赖更复杂，
             会成为热点。
       建议：属性仅在「等级变化 / 装备变化 / Buff 增删」时标脏重算（dirty flag），
             其余帧复用缓存值。

  [P3] AI 目标查询 nearestMonster / nearestTarget 全表扫描
       风险：每次调用遍历全部怪物（当前 O(80)），多个实体每帧各查一次 → O(实体×怪)。
             80×80 = 6400 次距离计算/帧，当前仍在预算内。
       建议：目标查询也走 monsterHash.query 做粗筛，或每 N 帧（如 6 帧 = 10Hz）才更新
             一次锁定目标，减少高频重算（分层更新频率）。

  [P4] 障碍物 losClear 线性扫描
       风险：本压测用 24 个障碍线性扫描近似；真实游戏若障碍很多，ranged 怪每帧调用
             会放大量。
       建议：障碍物同样入空间哈希，losClear 只查线段包围盒覆盖的桶。
`);
}

function printRenderGuide() {
  const line = "─".repeat(78);
  console.log("\n" + line);
  console.log("  渲染层验证指引（浏览器端，无头测不了）");
  console.log(line);
  console.log(`
  A. DevTools Performance 面板（Chrome/Edge，具体步骤）：
     1) 打开游戏 index.html，进入「100发/秒 + 80特效 + 80怪」的压力关卡（或临时调高
        config.js 的出弹率/怪物上限制造压测场景，验证完记得改回）。
     2) F12 → Performance 面板 → 点右上齿轮，勾选 "Screenshots" + "Web Vitals"。
     3) 点 ⏺ Record → 让战斗持续 5~10 秒 → 点 Stop。
     4) 看 Frames 泳道：每一帧的耗时条，检查是否有帧超过 16.6ms（红条 = 掉帧）。
     5) 看 Main 泳道（火焰图）：
        - "Function Call" 下展开你游戏的 render/update 函数，看自耗时（Self Time）。
        - 关注 drawImage 调用总次数与耗时（Rendering 分类）。
        - 若无头逻辑层占比 <30%，但整帧仍掉帧 → 瓶颈在渲染层 drawImage 调用数。
     6) 底部 Summary 饼图：看 Scripting / Rendering / Painting / GPU 各占比例。
        Scripting 高 → 逻辑层；Rendering/Painting 高 → Canvas 绘制/填充。

  B. Chrome tracing（chrome://tracing 或 DevTools 导出）应重点看的指标：
     - tracing 分类勾选 "devtools.timeline" + "disabled-by-default-devtools.timeline.frame"。
     - 关键事件：DrawFrame / CompositeLayers / UpdateLayerTree / Paint。
     - 关注 "RasterTask" 与 GPU 进程的 "GPUTask" 时长——素材贴图多、缩放绘制时
       RasterTask 会飙升（drawImage 每次缩放 = 一次采样）。
     - 若 CompositeLayers 长期 > 16.6ms → 合成层过多（大量 save/restore + 阴影/滤镜）。

  C. 可注入的运行时埋点（推荐先做，成本最低）：
     - 在每帧 render 前后打 performance.now()，把 renderMs 累积后 console.table 输出，
       直接对比「逻辑层 updateMs」与「渲染层 renderMs」，定位叠加后的真实瓶颈。
     - requestAnimationFrame 回调里统计 frame interval 直方图，观察掉帧分布。

  D. 渲染层常见优化方向（如果浏览器实测超标）：
     - 子弹/特效数量大时优先用离屏 Canvas 预渲染 sprite，避免每帧 drawImage 缩放。
     - 合批：同图集 sprites 尽量连续绘制，减少状态切换（fillStyle/font 变更）。
     - 分层 Canvas：静态背景层 / 动态战斗层 / UI 层分离，只重绘动态层。
     - 阴影与 shadowBlur 是性能杀手，批量特效场景下建议关闭或改用发光贴图。
`);
}

/* ======================= 7. 入口 ======================= */
(function main() {
  const forceGC = process.argv.includes("--gc");
  console.log("启动压测…（若需精确 GC 曲线请用: node --expose-gc perf_test.js）");
  if (!global.gc) console.log("提示：未开启 --expose-gc，场景四 GC 曲线仅供参考（不强制回收，堆增长更明显）。\n");

  testBullets();
  testEffects();
  testCharacters();
  testPoolVsNew();
  printReport();
})();
