/* ============================================================
 * endless-team.js — 21.19 W7 深渊组队：队友倒下 / 救援复活 + 人数缩放
 * ============================================================
 * 契约（消费 CFG.endless.team，已冻结只读）：
 *   - EndlessTeam.update(dt)      每帧入口：只在 G.inEndless 时生效；
 *                                 扫描队伍（G.run.companions，兜底 G.team）中
 *                                 alive===false 的队友，累加倒地计时；
 *                                 到 reviveTime 自动复活（hp = hpMax*reviveHpRatio）；
 *                                 队长（G.player）在 rescueRadius 内 → 走
 *                                 rescueChannel 救援读条提前复活。
 *   - EndlessTeam.decide(dt, team, leader, opt)  纯逻辑（无头可测）：
 *                                 返回本帧动作数组 [{id, name, by:"rescue"|"auto", hp}]。
 *   - EndlessTeam.scaleMul()      敌人强度系数 1 + (n-1)*playerScalePerExtra
 *   - EndlessTeam.rewardMul()     奖励系数     1 + (n-1)*rewardScalePerExtra
 *   - EndlessTeam.teamSize()      n = G.team.length（无 team 返回 0）
 *   - EndlessTeam.tickTimer       累计生效帧时间（getter，测试观测用）
 *
 * 约束：只读 G.team / G.player / G.run.companions，不改 game.js；
 *       队友死亡判定（h.alive=false）在 game.js heroTakeDamage，本模块只做复活侧。
 *       非深渊（!G.inEndless）立即早退；无 G.team 安全早退（返回 1 / 空数组）。
 * ============================================================ */
"use strict";

var EndlessTeam = (function () {

  var tickTimer = 0;   // update() 累计生效时间（仅深渊内累加）

  /* ---------- CFG 读取 + 内置兜底（硬约束 #5：不硬编码、缺失时降级） ---------- */
  var FALLBACK = {
    reviveTime: 8.0, reviveHpRatio: 0.5,
    rescueRadius: 120, rescueChannel: 2.0,
    playerScalePerExtra: 0.15, rewardScalePerExtra: 0.10,
  };
  function tcfg() {
    var t = (typeof CFG !== "undefined" && CFG && CFG.endless && CFG.endless.team) || {};
    var out = {};
    for (var k in FALLBACK) out[k] = (typeof t[k] === "number" && isFinite(t[k])) ? t[k] : FALLBACK[k];
    return out;
  }

  /* ---------- 队伍解析：运行时队友优先（带 alive 字段），兜底 G.team ---------- */
  function runtimeTeam() {
    if (typeof G === "undefined" || !G) return null;
    // 真实运行态：G.run.companions 的元素带 alive / hp / hpMax / x / y
    if (G.run && Array.isArray(G.run.companions) && G.run.companions.length) return G.run.companions;
    // 兜底：G.team 本身（元素若带 alive 字段同样可被扫描）
    if (Array.isArray(G.team)) return G.team;
    return null;
  }

  function teamSize() {
    if (typeof G === "undefined" || !G || !Array.isArray(G.team)) return 0;
    return G.team.length;
  }

  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ---------- 纯逻辑核心：单帧决策（无头可测） ----------
   * team:  成员数组（元素带 alive/hp/hpMax/id/name，最好有 x/y）
   * leader: 队长（G.player 或 G.team[0]），带 x/y
   * opt:   可选覆盖 {reviveTime, reviveHpRatio, rescueRadius, rescueChannel}
   * 返回：  本帧完成的复活动作数组；同时直接更新成员状态（downTimer / rescueProgress /
   *         alive / hp）——成员对象本就是游戏运行时对象，就地写回与 game.js 口径一致。
   * 读条规则：队长在圈内累加 rescueProgress，离开则按 1.5x 衰退（对齐判定圈读条惯例），
   *          期间倒地计时照常累加，二者先到先复活。 */
  function decide(dt, team, leader, opt) {
    var acts = [];
    if (!Array.isArray(team) || !(dt > 0)) return acts;
    var c = opt || tcfg();
    for (var i = 0; i < team.length; i++) {
      var m = team[i];
      if (!m || m === leader) continue;              // 队长本人不参与倒地复活
      if (m.alive !== false) {                        // 存活：清零计时（防脏状态残留）
        m.downTimer = 0; m.rescueProgress = 0;
        continue;
      }
      m.downTimer = (m.downTimer || 0) + dt;
      var near = leader && typeof leader.x === "number" && typeof leader.y === "number" &&
        dist(leader.x, leader.y, m.x || 0, m.y || 0) <= c.rescueRadius;
      if (near) m.rescueProgress = (m.rescueProgress || 0) + dt;
      else m.rescueProgress = Math.max(0, (m.rescueProgress || 0) - dt * 1.5);
      var by = null;
      if (near && m.rescueProgress >= c.rescueChannel) by = "rescue";
      else if (m.downTimer >= c.reviveTime) by = "auto";
      if (by) {
        m.alive = true;
        m.hp = (m.hpMax || 1) * c.reviveHpRatio;
        m.downTimer = 0; m.rescueProgress = 0;
        acts.push({ id: m.id, name: m.name, by: by, hp: m.hp });
      }
    }
    return acts;
  }

  /* ---------- 每帧入口（非深渊早退，硬约束 #6） ---------- */
  function update(dt) {
    if (typeof G === "undefined" || !G || !G.inEndless) return null;
    var team = runtimeTeam();
    if (!team) return null;                            // 无队伍安全早退
    var leader = G.player || (Array.isArray(G.team) ? G.team[0] : null);
    tickTimer += dt;
    return decide(dt, team, leader);
  }

  /* ---------- 人数缩放 ---------- */
  function scaleMul() {
    var n = teamSize();
    if (n <= 0) return 1;
    return 1 + (n - 1) * tcfg().playerScalePerExtra;
  }
  function rewardMul() {
    var n = teamSize();
    if (n <= 0) return 1;
    return 1 + (n - 1) * tcfg().rewardScalePerExtra;
  }

  var api = {
    update: update,
    decide: decide,
    scaleMul: scaleMul,
    rewardMul: rewardMul,
    teamSize: teamSize,
    _reset: function () { tickTimer = 0; },            // 测试用：清零累计计时
  };
  Object.defineProperty(api, "tickTimer", { get: function () { return tickTimer; } });

  if (typeof globalThis !== "undefined") globalThis.EndlessTeam = api;
  return api;
})();
