/* ============================================================
 * endless_team_test.js — 21.19 W7 无头测试：深渊组队（倒地/救援/人数缩放）
 * 运行：node endless_team_test.js
 * 范式：Node vm 沙箱加载「config.js + 被测模块 js/endless-team.js」，
 *       用 G 桩驱动 EndlessTeam.update / decide 纯逻辑，无 DOM 依赖。
 * ============================================================ */
"use strict";

const fs = require("fs"), Vm = require("vm");
const ctx = Vm.createContext({ console, require, module });
for (const f of ["js/config.js", "js/endless-team.js"]) {
  Vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driverSrc = `
  /* ---------- 计数器 ---------- */
  var __n = 0, __bad = 0;
  function check(name, cond) {
    __n++;
    console.log((cond ? "通过 " : "未过 ") + "#" + __n + " " + name);
    if (!cond) __bad++;
  }
  var EPS = 1e-9;
  function near(a, b) { return Math.abs(a - b) < 1e-6; }

  /* G 桩：真实 G 在 game.js（此处只需 inEndless/team/run/player 四个只读字段） */
  var G = { inEndless: false, team: null, run: null, player: null };

  var T = EndlessTeam;
  var cfgv = CFG.endless.team;

  /* ---------- 造成员工具（运行时队友口径：带 alive/hp/hpMax/x/y） ---------- */
  function mk(id, hpMax) {
    return { id: id, name: "队友" + id, hp: hpMax, hpMax: hpMax, x: 0, y: 0,
             alive: true, downTimer: 0, rescueProgress: 0 };
  }
  function freshG() {
    G.inEndless = true; G.team = null; G.run = null; G.player = null;
    T._reset();
  }

  /* ===== 场景 A：非深渊（G.inEndless=false）不生效 ===== */
  freshG();
  var aL = mk("L", 100), a1 = mk("A", 200), a2 = mk("B", 100);
  G.team = [aL, a1, a2];
  G.run = { companions: [a1, a2] };
  G.player = { x: 0, y: 0 };
  a1.alive = false; a1.hp = 0;
  G.inEndless = false;
  var rA = T.update(0.5);
  check("非深渊: update 返回 null（早退）", rA === null);
  check("非深渊: 倒地队友不被复活", a1.alive === false);
  check("非深渊: 倒地计时不累加", (a1.downTimer || 0) === 0);

  /* ===== 场景 B：无 team 不抛错、安全早退 ===== */
  freshG();
  G.team = null; G.player = null; G.run = null;
  var b1 = false, b2 = false, b3 = false, b4 = false;
  try { b1 = (T.update(0.1) === null); } catch (e) { b1 = false; }
  try { b2 = (T.scaleMul() === 1); } catch (e) { b2 = false; }
  try { b3 = (T.rewardMul() === 1); } catch (e) { b3 = false; }
  try { b4 = (T.teamSize() === 0); } catch (e) { b4 = false; }
  check("无team: update 安全返回 null", b1);
  check("无team: scaleMul 兜底 1", b2);
  check("无team: rewardMul 兜底 1", b3);
  check("无team: teamSize 兜底 0", b4);

  /* ===== 场景 C：倒地计时到点自动复活 + 血量=比率 ===== */
  freshG();
  var c1 = mk("C1", 200);
  G.team = [mk("L", 100), c1];
  G.run = { companions: [c1] };
  G.player = { x: 99999, y: 99999 };          // 队长远离：不触发救援
  c1.alive = false; c1.hp = 0;
  var actsC = [], frames = 0;
  while (c1.alive === false && frames < 40) { actsC = actsC.concat(T.update(0.5) || []); frames++; }
  check("倒地复活: " + (frames * 0.5) + "s 后复活（reviveTime=" + cfgv.reviveTime + "s）",
        c1.alive === true && near(frames * 0.5, cfgv.reviveTime));
  check("倒地复活: 血量 = hpMax × reviveHpRatio = " + c1.hp,
        c1.alive === true && near(c1.hp, 200 * cfgv.reviveHpRatio));
  check("倒地复活: 动作标记 by=auto", actsC.length === 1 && actsC[0].by === "auto" && actsC[0].id === "C1");
  check("倒地复活: 复活后计时清零", c1.downTimer === 0 && c1.rescueProgress === 0);

  /* ===== 场景 D：救援读条提前复活 ===== */
  freshG();
  var d1 = mk("D1", 100);
  G.team = [mk("L", 100), d1];
  G.run = { companions: [d1] };
  G.player = { x: 10, y: 10 };                 // 队长就在身边（半径内）
  d1.alive = false; d1.hp = 0;
  var actsD = [], dFrames = 0;
  while (d1.alive === false && dFrames < 40) { actsD = actsD.concat(T.update(0.5) || []); dFrames++; }
  check("救援读条: " + (dFrames * 0.5) + "s 复活 < 自动 " + cfgv.reviveTime + "s（读条 " + cfgv.rescueChannel + "s）",
        d1.alive === true && near(dFrames * 0.5, cfgv.rescueChannel) && dFrames * 0.5 < cfgv.reviveTime);
  check("救援读条: 动作标记 by=rescue", actsD.length === 1 && actsD[0].by === "rescue");
  check("救援读条: 复活血量同为比率 " + d1.hp, near(d1.hp, 100 * cfgv.reviveHpRatio));

  /* ===== 场景 E：队长离开 → 读条衰退，不提前复活 ===== */
  freshG();
  var e1 = mk("E1", 100);
  G.team = [mk("L", 100), e1];
  G.run = { companions: [e1] };
  G.player = { x: 0, y: 0 };
  e1.alive = false; e1.hp = 0;
  for (var i = 0; i < 2; i++) T.update(0.5);   // 圈内 1.0s（< rescueChannel 2.0s）
  G.player = { x: 99999, y: 99999 };           // 队长离开
  for (var i = 0; i < 2; i++) T.update(0.5);   // 衰退 1.0s → progress 归零
  var eLeft = e1.rescueProgress;
  G.player = { x: 0, y: 0 };                   // 回来再读 0.9s（仍不足）
  T.update(0.9);
  check("读条衰退: 离开后进度归零（剩 " + eLeft.toFixed(2) + "）", eLeft === 0);
  check("读条衰退: 重读不足不打断自动计时、也不复活", e1.alive === false && e1.downTimer > 2.0 && e1.rescueProgress < cfgv.rescueChannel);

  /* ===== 场景 F：人数缩放公式（n = G.team.length） ===== */
  freshG();
  G.team = [mk("L", 100)];
  check("缩放: 1人 scaleMul=1 rewardMul=1", T.scaleMul() === 1 && T.rewardMul() === 1);
  G.team = [mk("L", 100), mk("X", 100)];
  check("缩放: 2人 scale=" + T.scaleMul().toFixed(2) + "（1+1×" + cfgv.playerScalePerExtra + "）",
        near(T.scaleMul(), 1 + 1 * cfgv.playerScalePerExtra));
  check("缩放: 2人 reward=" + T.rewardMul().toFixed(2) + "（1+1×" + cfgv.rewardScalePerExtra + "）",
        near(T.rewardMul(), 1 + 1 * cfgv.rewardScalePerExtra));
  G.team = [mk("L", 100), mk("X", 100), mk("Y", 100)];
  check("缩放: 3人 scale=" + T.scaleMul().toFixed(2) + "（1+2×" + cfgv.playerScalePerExtra + "）",
        near(T.scaleMul(), 1 + 2 * cfgv.playerScalePerExtra));
  check("缩放: 3人 reward=" + T.rewardMul().toFixed(2) + "（1+2×" + cfgv.rewardScalePerExtra + "）",
        near(T.rewardMul(), 1 + 2 * cfgv.rewardScalePerExtra));

  /* ===== 场景 G：decide 纯函数（opt 覆盖 CFG） + tickTimer 观测 ===== */
  freshG();
  var g1 = mk("G1", 80);
  g1.alive = false; g1.hp = 0;
  var actsG = T.decide(1.0, [g1], { x: 0, y: 0 }, { reviveTime: 1, reviveHpRatio: 0.9, rescueRadius: 5, rescueChannel: 2 });
  check("decide纯函数: opt 覆盖 reviveTime=1 立即自动复活", actsG.length === 1 && actsG[0].by === "auto" && near(g1.hp, 80 * 0.9));
  check("tickTimer: 纯函数 decide 不累加（仍为 " + T.tickTimer.toFixed(1) + "）", T.tickTimer === 0);
  G.team = [mk("L", 100), mk("X", 100)];
  T.update(0.3); T.update(0.5);
  check("tickTimer: 仅深渊 update 累加（0.3+0.5=" + T.tickTimer.toFixed(1) + "）", near(T.tickTimer, 0.8));

  /* ===== 场景 H：非深渊不生效后恢复深渊仍能复活（状态不串扰） ===== */
  freshG();
  var h1 = mk("H1", 100);
  G.team = [mk("L", 100), h1];
  G.run = { companions: [h1] };
  G.player = { x: 99999, y: 99999 };
  h1.alive = false; h1.hp = 0;
  G.inEndless = false; T.update(4);            // 非深渊空转 4s 不计时
  G.inEndless = true;
  var hFrames = 0;
  while (h1.alive === false && hFrames < 40) { T.update(0.5); hFrames++; }
  check("状态隔离: 非深渊空转不计时，恢复后 " + (hFrames * 0.5) + "s 才复活", near(hFrames * 0.5, cfgv.reviveTime));

  console.log("深渊组队测试完成：PASS 合计 = " + __n + "  失败 = " + __bad);
  if (__bad > 0) throw new Error("存在未通过的断言：" + __bad + " 条");
  console.log("深渊组队测试全部通过");
`;
Vm.runInContext(driverSrc, ctx, { filename: "endless_team_driver" });
