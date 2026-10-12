/* 无头测试：Boss 体验四件套（17.9 拍板落地，2026-10-09）
 * ① Boss 贴图区分：10 只 BS 各配不同贴图，且与普通怪/精英零交集
 * ③ 弹幕吞噬反馈：吞弹出吸收特效（每帧 ≤ 3 个护栏）+ 激活期画「往里吸」箭头与源头脉冲环
 * ④ 招式名横幅：bossFire 记录招式名 → update 递减 → 渲染层屏幕空间画出 → 归零消失
 * ⑤ 转阶段宝箱：品质权重取当前关卡的宝箱档位（CT 曲线），背包满作废不崩，无关卡表回落兜底
 * 运行：node boss_ux_test.js（退出码 0 = 全绿，与 run_tests.sh 口径一致） */
"use strict";

/* ---- DOM / Canvas 桩（记录画布调用，用于确定性验证"真的画了"） ---- */
const ctxCalls = [];
global.ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 300000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 300000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
const winHandlers = {};
global.winHandlers = winHandlers;
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  /* 给全部 Boss 贴图键一个真值占位（Monster 构造要读 G.sprites[sprite]） */
  for (const bid in CFG.monsters) {
    if (!/^BS/.test(bid)) continue;
    const sp = CFG.monsters[bid].sprite;
    if (sp && !G.sprites[sp]) G.sprites[sp] = {};
  }
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];          // 第 1 关 → 宝箱档位 CT1
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  Game.skipLevelUpChoice && Game.skipLevelUpChoice();
  let t = 0;
  Game.loop(t);                    // 手动踢一次主循环：内部 requestAnimationFrame 才会登记 __raf
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
    if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } };

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);

  const fakeW = () => ({ w: 1920, h: 1920, obstacles: [], enemyBullets: [], playerBullets: [], lasers: [], monsters: [],
    spawnMonster(id, x, y) { const m = new Monster(id, x, y, 1); this.monsters.push(m); return m; } });
  const fakeBoss = (x, y) => ({ x: x == null ? 900 : x, y: y == null ? 900 : y, atk: 20, r: 46,
    d: CFG.monsters.BS0001, lv: 1, aimAng: 0, laserTimer: 0, laserIdx: 0 });

  /* ============ 一、① Boss 贴图区分 ============ */
  {
    const bossIds = Object.keys(CFG.monsters).filter(k => /^BS/.test(k));
    check("① Boss 总数 = 10（BS0001~BS0010）", bossIds.length === 10);
    const sps = bossIds.map(id => CFG.monsters[id].sprite);
    check("① 全部 Boss 配了 sprite，且键都存在于素材清单",
      sps.every(s => s && ASSET_MANIFEST[s]));
    const uniq = [...new Set(sps)];
    check("① Boss 贴图已区分（10 只用了 " + uniq.length + " 种，要求 ≥ 6 种）", uniq.length >= 6);
    // 🔴 关键护栏：Boss 贴图不得与普通怪/精英重叠 —— main.js 会把 Boss 贴图按 130px 覆写，
    //    若普通怪也用同一张，普通怪会跟着变成 Boss 体型（视觉事故）。
    const nmEd = Object.keys(CFG.monsters).filter(k => /^(NM|ED)/.test(k)).map(k => CFG.monsters[k].sprite);
    const clash = uniq.filter(s => nmEd.indexOf(s) >= 0);
    check("① Boss 贴图与普通怪/精英零交集" + (clash.length ? "（冲突：" + clash.join(",") + "）" : ""),
      clash.length === 0);
    // 终焉 Boss（BS0010）保持最强视觉（enemy22），其余 9 只不得再用它
    check("① 终焉·邪神本体（BS0010）独占 enemy22",
      CFG.monsters.BS0010.sprite === "enemy22" &&
      bossIds.filter(id => id !== "BS0010" && CFG.monsters[id].sprite === "enemy22").length === 0);
  }

  /* ============ 二、③ 弹幕吞噬反馈 ============ */
  {
    check("③ 激光色已配置（CFG.boss.color.laser）", !!(CFG.boss.color && CFG.boss.color.laser));

    const w = fakeW();
    const lb = spawnLaser(w, fakeBoss(), 900, 900, 0, { warn: 0, active: 2, fade: 0.1 });
    lb.phase = "active"; lb.t = 0;                       // 强制进入激活期（确定性）
    // 8 发玩家子弹全摆在光柱正中（origin(900,900) 沿 +x，halfW+6 判定带内）
    w.playerBullets = [];
    for (let i = 0; i < 8; i++) w.playerBullets.push({ x: 950 + i * 10, y: 900, r: 4, dead: false });

    // 记录 spawnBurst 调用（吞弹反馈走它）
    const origBurst = spawnBurst;
    let burstN = 0; const burstCols = [];
    spawnBurst = function (x, y, c, n) { burstN++; burstCols.push(c); return origBurst(x, y, c, n); };
    const eaten = lb.devourBullets(w);
    spawnBurst = origBurst;

    check("③ 吞噬本身仍生效（8 发全吞，机制未被反馈改造破坏）", eaten === 8);
    check("③ 吞弹出吸收特效，且有「每帧 ≤ 3 个」护栏（实发 " + burstN + " 次）", burstN === 3);
    check("③ 特效用激光青（玩家能对上「是这条光柱在吞」）",
      burstCols.length === 3 && burstCols.every(c => c === CFG.boss.color.laser));

    // 渲染：激活期画「往里吸」的箭头 + 源头脉冲环
    G.time = 1.234;
    ctxCalls.length = 0;
    renderLasers(G.ctx, w);
    const arcN = ctxCalls.filter(c => c[0] === "arc").length;
    const strokeN = ctxCalls.filter(c => c[0] === "stroke").length;
    check("③ 激活期画出源头脉冲环（arc 调用 ≥ 1）", arcN >= 1);
    check("③ 激活期画出流动吞噬箭头（stroke 次数 > 4，实得 " + strokeN + "）", strokeN > 4);
    // 非激活期（warn）不画箭头/脉冲环：只有光柱本体一组 stroke
    lb.phase = "warn"; lb.t = 0; lb.warnT = 1;
    ctxCalls.length = 0;
    renderLasers(G.ctx, w);
    const arcWarn = ctxCalls.filter(c => c[0] === "arc").length;
    check("③ 预警期不画吞噬环（arc = 0，反馈只属于激活期）", arcWarn === 0);
  }

  /* ============ 三、④ 招式名横幅 ============ */
  {
    check("④ CFG.boss.skillNameTime 配置就位（>0 且 ≤ 3 秒）",
      typeof CFG.boss.skillNameTime === "number" && CFG.boss.skillNameTime > 0 && CFG.boss.skillNameTime <= 3);

    const bm = new Monster("BS0001", 900, 900, 5);
    G.activeWorld.monsters.push(bm);
    const sk = skillEntry(bm.phases[0].skills[0], 5);
    check("④ 前置：BS0001 首招是弹幕招式（带 pattern）", !!(sk && sk.pattern));

    bm.bossFire(G.activeWorld, sk);
    check("④ 出招后记录招式名（与技能表 name 一致）",
      bm.skillName === (sk.name || "未知招式") && bm.skillName.length > 0);
    check("④ 横幅计时器启动（0 < T ≤ skillNameTime）",
      bm.skillNameT > 0 && bm.skillNameT <= CFG.boss.skillNameTime);

    const t0 = bm.skillNameT;
    step(30);                                            // 0.5s：真实主循环推进 update()
    check("④ 横幅随帧递减（" + near(t0 - 0.5, bm.skillNameT, 0.05) + "，" +
      t0.toFixed(2) + " → " + bm.skillNameT.toFixed(2) + "）", bm.skillNameT < t0);

    // 渲染层：屏幕空间画「「招式名」」
    bm.skillNameT = 1.0; bm.skillName = "测试符卡";
    ctxCalls.length = 0;
    step(1);
    const drawn = ctxCalls.some(c => c[0] === "fillText" && String(c[1][0]).indexOf("测试符卡") >= 0);
    check("④ 渲染层画出招式名横幅（fillText 含招式名）", drawn);
    bm.skillNameT = 0;
    ctxCalls.length = 0;
    step(1);
    const gone = !ctxCalls.some(c => c[0] === "fillText" && String(c[1][0]).indexOf("测试符卡") >= 0);
    check("④ 计时归零后横幅消失（不常驻、不残留）", gone);

    // 清场：把测试 Boss 移出（避免污染后续用例的真实主循环）
    const idx = G.activeWorld.monsters.indexOf(bm);
    if (idx >= 0) G.activeWorld.monsters.splice(idx, 1);
  }

  /* ============ 四、⑤ 转阶段宝箱 ============ */
  {
    check("⑤ CFG.boss.phaseChest.enabled === true",
      !!(CFG.boss.phaseChest && CFG.boss.phaseChest.enabled === true));
    check("⑤ 兜底权重五阶齐全",
      ["normal", "advanced", "epic", "divine", "mythic"].every(k => CFG.boss.phaseChest.weights[k] != null));

    // 劫持 weightedPick：抓「实际传进去的权重对象」
    const wp = U.weightedPick;
    let picked = null;
    U.weightedPick = function (wts) { picked = wts; return wp.call(U, wts); };

    const chestCount = () => G.run.backpack.items.filter(it => it && it.kind === "chest").length;
    const c0 = chestCount();

    const bm5 = new Monster("BS0010", 900, 900, 5);      // 三阶段 Boss，降到 20% 血必连转两段
    G.activeWorld.monsters.push(bm5);
    bm5.hp = bm5.hpMax * 0.2;
    bm5.bossPhaseTick();
    check("⑤ 转阶段确实发生了（phaseIdx 0 → 2）", bm5.phaseIdx === 2);
    check("⑤ 品质权重取当前关卡的宝箱档位（第 1 关 → CT1）",
      picked === CFG.levelCurve.chestTiers.CT1.weights);
    check("⑤ 转阶段后背包多了宝箱（" + (chestCount() - c0) + " 个）", chestCount() > c0);
    check("⑤ 新增宝箱带固定价值（进撤离「×0.5 折算率」链路）",
      G.run.backpack.items.some(it => it && it.kind === "chest" && typeof it.value === "number" && it.value > 0));

    // 背包满：作废但不崩
    const gir = grantItemToRun;
    grantItemToRun = function () { return false; };
    let boom = null;
    try { bossPhaseChest(bm5); } catch (e) { boom = e; }
    grantItemToRun = gir;
    check("⑤ 背包满时作废不抛异常", boom === null);

    // 无关卡表：回落兜底权重，不抛异常
    const savedLc = G.levelCfg;
    G.levelCfg = {};                                     // 无 id → 取不到曲线行
    picked = null;
    let boom2 = null;
    try { bossPhaseChest(bm5); } catch (e) { boom2 = e; }
    G.levelCfg = savedLc;
    check("⑤ 无关卡表时回落兜底权重且不抛异常",
      boom2 === null && picked === CFG.boss.phaseChest.weights);

    U.weightedPick = wp;
    const i5 = G.activeWorld.monsters.indexOf(bm5);
    if (i5 >= 0) G.activeWorld.monsters.splice(i5, 1);
  }

  console.log(ok ? "BOSS UX TEST OK" : "BOSS UX TEST FAILED");
  if (!ok) throw new Error("BOSS UX TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
