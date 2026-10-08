/* ============================================================================
 * 21.19 W3 · 深渊世界内容（祭坛接线 + 奖励节点）—— js/endless-arena.js
 * ----------------------------------------------------------------------------
 * 背景真缺口：modes.js 的 rollAbyssAltars() 定义后从未被调用 → 深渊世界里没有祭坛。
 * 本模块职责（不改任何既有文件，纯猴子补丁接入）：
 *   ① EndlessArena.populate(world)
 *        - 调 rollAbyssAltars(world, N) 投放祭坛（其内部按 kind="endless" 排除 RIFT）；
 *        - 按 CFG.endless.rewardNodes.types 权重投放 count 个奖励节点 → world.rewardNodes。
 *   ② EndlessArena.update(world, dt)
 *        - gold / crystal：英雄进圈即拾取结算（金币 → G.run.coin；结晶 → Endless.state.crystals
 *          ——结晶的「唯一入账点」在结算面板 Meta.data.crystals += s.crystals，符合现有口径）；
 *        - supply：复用统一判定入口 judgeChannel 读条，读完按 healRatio 回血（一次）。
 *   ③ EndlessArena.render(ctx, world)：留空（渲染由 render.js 统一管线负责；如 W8 需要
 *      世界内自绘节点，可在此补充绘制代码，判定半径口径不变）。
 *   ④ 猴子补丁（幂等，__arenaWrapped 标记防重）：
 *        - 包装 Endless.makeWorld：建完世界 → populate(world)；
 *        - 包装 Endless.update：尾部追加 EndlessArena.update(world, dt)。
 * 硬约束遵守：
 *   - 非深渊世界零影响：populate / update 一律先判 world.kind === "endless"，否则立即早退；
 *   - 判定与绘制同源（项目铁律 #1）：判定半径 = node.radius × CFG.altarJudgeMul，
 *     与主线 heroInCircle / judgeChannel 完全同口径；
 *   - 数值全读 CFG，缺字段时用内置兜底常量安全降级；
 *   - 无 DOM 依赖（逻辑模块），无头测试可跑。
 * ========================================================================== */
"use strict";

var EndlessArena = (function () {

  /* ---------- 配置读取（CFG 缺字段 → 内置兜底，安全降级） ---------- */
  function rewardCfg() {
    var e = (typeof CFG !== "undefined" && CFG.endless) || {};
    return e.rewardNodes || {};
  }
  function judgeMul() {
    return (typeof CFG !== "undefined" && CFG.altarJudgeMul) || 1.2;
  }
  /* 节点默认字段兜底（仅当 CFG.endless.rewardNodes 相应字段缺失时生效） */
  var FALLBACK = {
    count: 4,
    radius: 44,
    channel: 1.5,
    altarCount: 5,                       // 祭坛投放数（rollAbyssAltars 缺省同值）
    types: [
      { id: "gold",    weight: 6, amount: 50 },
      { id: "crystal", weight: 3, amount: 20 },
      { id: "supply",  weight: 3, healRatio: 0.25 },
    ],
  };

  var _seq = 0;                          // 节点 id 序号（同局内唯一即可）

  /* ---------- 内部：按 types 权重抽一个类型定义 ---------- */
  function pickType(types) {
    var pool = {};
    for (var i = 0; i < types.length; i++) pool[i] = types[i].weight || 1;
    var idx = (typeof U !== "undefined" && U && U.weightedPick) ? U.weightedPick(pool) : 0;
    return types[idx] || types[0];
  }

  /* ---------- 内部：取一个投放点（优先世界采样，避开障碍/祭坛） ---------- */
  function pickSpot(w) {
    if (w.findFreeSpot) {
      var pos = w.findFreeSpot(100);
      if (pos) return pos;
    }
    if (typeof U !== "undefined" && U && U.rand) {
      return { x: U.rand(200, Math.max(400, w.w - 200)), y: U.rand(200, Math.max(400, w.h - 200)) };
    }
    return { x: (w.w || 800) / 2, y: (w.h || 600) / 2 };
  }

  /* ============================================================
   * populate(world)：投放祭坛 + 奖励节点（幂等：__arenaPopulated 防重）
   * ============================================================ */
  function populate(world) {
    var w = world;
    if (!w || w.kind !== "endless") return false;          // 非深渊世界：零影响早退
    if (w.__arenaPopulated) return true;                   // 防重复注入（幂等）
    w.__arenaPopulated = true;

    /* ① 祭坛接线（补上「从未被调用」的真缺口）：rollAbyssAltars 内部
     *    按 kind="endless" 排除屏蔽白名单（默认 RIFT），且只写 w.altars。 */
    if (typeof rollAbyssAltars === "function") {
      var rc = rewardCfg();
      rollAbyssAltars(w, rc.altarCount || FALLBACK.altarCount);
    }

    /* ② 奖励节点：按 types 权重抽 kind，投放 count 个 → world.rewardNodes */
    var c = rewardCfg();
    var count = c.count || FALLBACK.count;
    var types = (Array.isArray(c.types) && c.types.length) ? c.types : FALLBACK.types;
    var radius = c.radius || FALLBACK.radius;
    var channel = c.channel || FALLBACK.channel;
    var nodes = [];
    for (var i = 0; i < count; i++) {
      var t = pickType(types);
      var pos = pickSpot(w);
      nodes.push({
        id: "rn" + (++_seq),
        x: pos.x, y: pos.y,
        kind: t.id,                                        // "gold" | "crystal" | "supply"
        amount: t.amount || 0,                             // gold/crystal 数量
        healRatio: t.healRatio || 0,                       // supply 回血比例
        radius: radius,                                    // 判定半径 = radius × CFG.altarJudgeMul
        channel: channel,                                  // supply 读条秒数
        done: false,
      });
    }
    w.rewardNodes = nodes;
    return true;
  }

  /* ---------- 内部：结算一次拾取/补给 ---------- */
  function settleNode(w, n, holder) {
    n.done = true;
    var r = (typeof G !== "undefined" && G) ? G.run : null;
    if (n.kind === "gold") {
      if (r) r.coin = (r.coin || 0) + (n.amount || 0);
      if (typeof spawnFloat === "function") spawnFloat(n.x, n.y - 18, "+" + (n.amount || 0), "#ffd76a");
      if (typeof SFX !== "undefined" && SFX && SFX.play) SFX.play("coin");
    } else if (n.kind === "crystal") {
      /* 结晶现有口径：运行时累加 Endless.state.crystals，结算面板一次性入账 Meta.data.crystals */
      if (typeof Endless !== "undefined" && Endless && Endless.state) {
        Endless.state.crystals = (Endless.state.crystals || 0) + (n.amount || 0);
      }
      if (typeof spawnFloat === "function") spawnFloat(n.x, n.y - 18, "◆+" + (n.amount || 0), "#c79bff");
      if (typeof SFX !== "undefined" && SFX && SFX.play) SFX.play("coin");
    } else if (n.kind === "supply") {
      healTeam(n.healRatio || 0);
    }
  }

  /* ---------- 内部：全队按比例回血（与 modes.js applySupplyEffect 的 heal 分支同口径） ---------- */
  function healTeam(pct) {
    if (!(pct > 0)) return;
    function healOne(h) {
      if (h === G.player && typeof h.heal === "function") { h.heal(pct); return; }
      h.hp = Math.min(h.hpMax || h.hp, h.hp + (h.hpMax || h.hp) * pct);
      if (typeof spawnFloat === "function") spawnFloat(h.x, h.y - 30, "+" + Math.round((h.hpMax || 0) * pct), "#7de08a");
    }
    if (typeof aliveHeroes === "function") { for (var h of aliveHeroes()) healOne(h); }
    else if (typeof G !== "undefined" && G.player) healOne(G.player);
  }

  /* ============================================================
   * update(world, dt)：每帧推进节点判定
   *   - gold / crystal：任意存活英雄进圈（radius × altarJudgeMul）即拾取，一次；
   *   - supply：judgeChannel 读条（进圈才推进 / 离开衰退 / 受打断由主线承担），读完回血一次。
   * ============================================================ */
  function update(world, dt) {
    var w = world;
    if (!w || w.kind !== "endless") return false;          // 非深渊世界：零影响早退
    var nodes = w.rewardNodes;
    if (!nodes || !nodes.length) return false;
    if (!(dt > 0)) return true;
    if (typeof G === "undefined" || !G || !G.player) return false;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.done) continue;
      if (n.kind === "supply") {
        /* 补给点：复用统一判定入口 judgeChannel（其内部 heroInCircle 已按
         * radius × CFG.altarJudgeMul 取判定半径，判定与绘制同源）。 */
        if (typeof judgeChannel === "function" &&
            judgeChannel(n, n.x, n.y, n.radius, dt, n.channel)) {
          settleNode(w, n);
        }
      } else {
        /* gold / crystal：进圈即拾取（与主线 heroInCircle 同口径，一次结算） */
        var hero = (typeof heroInCircle === "function") ? heroInCircle(n.x, n.y, n.radius) : null;
        if (hero) settleNode(w, n, hero);
      }
    }
    return true;
  }

  /* ============================================================
   * render(ctx, world)：渲染留空。
   * 渲染统一由 render.js 管线负责（本模块为纯逻辑层，无 DOM 依赖）；
   * 若 W8 集成时需要世界内自绘节点，在此补充绘制即可——注意绘制半径
   * 用 node.radius，判定半径 = node.radius × CFG.altarJudgeMul，同源不双写。
   * ============================================================ */
  function render(ctx, world) {
    /* 空实现：由 render.js 统一渲染管线负责（见上方注释）。 */
  }

  /* ============================================================
   * 猴子补丁接线（幂等：__arenaWrapped 标记防重，重复加载不叠加）
   *   - 包装 Endless.makeWorld：建完世界 → populate(world)；
   *   - 包装 Endless.update：先走原逻辑（波次/刷怪），尾部 → update(world, dt)。
   * ============================================================ */
  function install() {
    if (typeof Endless === "undefined" || !Endless) return false;
    if (Endless.__arenaWrapped) return true;               // 幂等：已包装过则直接返回
    var _makeWorld = Endless.makeWorld;
    Endless.makeWorld = function (W, H) {
      var w = _makeWorld.call(this, W, H);
      populate(w);                                         // 建完世界 → 投放祭坛 + 奖励节点
      return w;
    };
    var _update = Endless.update;
    Endless.update = function (world, dt) {
      var r = _update.call(this, world, dt);
      update(world, dt);                                   // 尾部追加：奖励节点判定
      return r;
    };
    Endless.__arenaWrapped = true;
    return true;
  }

  return { populate: populate, update: update, render: render, install: install };
})();

/* 暴露到全局（纯全局脚本范式） */
if (typeof globalThis !== "undefined") globalThis.EndlessArena = EndlessArena;

/* 加载即接线（幂等） */
EndlessArena.install();
