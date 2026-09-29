/* 无头测试：Boss 弹幕化与阶段化（第十七章）
 * 覆盖：CFG.boss 护栏与配表口径 / 六种弹幕发射器几何 / 预算与同屏存量护栏 /
 *       阶段机与转换无敌 / 电报（白圈）时序 / 3 只现有 Boss 的端到端弹幕产出 / 渲染可见性。
 * 运行：node boss_test.js */
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
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);            // 造一个 run（aliveHeroes / G.levelCfg 依赖它）
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } };

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);
  const P = (id, lv) => skillEntry(id, lv || 1);
  const angDiff = (a, b) => {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };
  const nearAng = (a, b) => angDiff(a, b) < 1e-6;

  // 弹幕发射器是纯几何 + 预算，不需要完整 World：用假世界 / 假 Boss 做单元验证
  const fakeW = () => ({ w: 1920, h: 1920, obstacles: [], enemyBullets: [], monsters: [],
    spawnMonster(id, x, y) { const m = new Monster(id, x, y, 1); this.monsters.push(m); return m; } });
  const fakeM = (x, y) => ({ x: x == null ? 900 : x, y: y == null ? 900 : y, atk: 20, r: 46,
    bossClock: 0, d: CFG.monsters.BS0001 });
  const fire = (p, aim, spin) => {
    const w = fakeW(), m = fakeM();
    const n = PatternSystem.emit(w, m, p, aim || 0, spin || 0);
    return { n: n, bs: w.enemyBullets, m: m, w: w };
  };
  const angs = (bs) => bs.map(b => Math.atan2(b.vy, b.vx));
  const spds = (bs) => bs.map(b => Math.hypot(b.vx, b.vy));
  // 每种发射器的「单发弹数」口径（与配表口径校验共用）
  const each = (s) => s.pattern === "spiral" ? (s.arms || 2)
    : (s.pattern === "ring" || s.pattern === "grid") ? (s.count || 8) * (s.layers || 1)
    : (s.count || 8);

  /* ============ 一、护栏配置与配表口径（17.3） ============ */
  {
    check("CFG.boss 护栏就位（预算 " + CFG.boss.bulletBudget + "/秒 ｜ 同屏 " + CFG.boss.bulletCap +
      " ｜ 转换无敌 " + CFG.boss.phaseInvuln + "s）",
      CFG.boss.bulletBudget === 40 && CFG.boss.bulletCap === 260 && CFG.boss.bulletWindow === 1);
    check("电报颜色语言五色齐全（红爆炸/橙冲锋/青激光/紫召唤/白弹幕）",
      ["boom", "charge", "laser", "summon", "bullet"].every(k => !!CFG.boss.color[k]));
    check("阶段转换无敌在 1.0~1.5 秒之间（17.3：给双方呼吸窗口）",
      CFG.boss.phaseInvuln >= 1.0 && CFG.boss.phaseInvuln <= 1.5);

    const bossIds = ["BS0001", "BS0002", "BS0003"];
    const noPhase = bossIds.filter(id => !(CFG.monsters[id].phases && CFG.monsters[id].phases.length));
    check("3 只现有 Boss 都已编排阶段（" + (noPhase.length ? noPhase.join(",") : "全部就绪") + "）", noPhase.length === 0);
    check("首个阶段的 hp 必须为 1.0（满血即生效）",
      bossIds.every(id => CFG.monsters[id].phases[0].hp === 1.0));
    check("阶段 hp 严格递减（越打越激烈）", bossIds.every(id => {
      const ps = CFG.monsters[id].phases;
      for (let i = 1; i < ps.length; i++) if (!(ps[i].hp < ps[i - 1].hp)) return false;
      return true;
    }));
    const badRef = [];
    for (const id of bossIds) for (const ph of CFG.monsters[id].phases) for (const s of ph.skills)
      if (!CFG.skills[s] || !CFG.skills[s].pattern) badRef.push(id + "→" + s);
    check("阶段招式池引用的技能全部存在且带 pattern 字段", badRef.length === 0);
    check("阶段 2 换了招式池（阶段递进 = 加机制，不是加血加攻）",
      bossIds.every(id => CFG.monsters[id].phases[0].skills.join() !== CFG.monsters[id].phases[1].skills.join()));

    const ems = [...new Set(Object.values(CFG.skills).filter(s => s.pattern).map(s => s.pattern))].sort();
    check("六种发射器齐全：" + ems.join("/"), ems.length === 6 &&
      ["fan", "grid", "radial", "ring", "spiral", "wave"].every(k => ems.indexOf(k) >= 0));

    const pats = Object.values(CFG.skills).filter(s => s.pattern);
    check("弹幕招式共 " + pats.length + " 条，全部 cat=active 且 ai=boss",
      pats.length === 10 && pats.every(s => s.cat === "active" && s.ai === "boss"));
    const over = pats.filter(s => each(s) / (s.cd || CFG.boss.patternCd) > CFG.boss.bulletBudget);
    check("每条弹幕招式单独看都不超预算（最高 " +
      Math.max(...pats.map(s => each(s) / (s.cd || CFG.boss.patternCd))).toFixed(1) + "/秒 ≤ 40）", over.length === 0);
    const phaseAvg = [];
    for (const id of bossIds) for (const ph of CFG.monsters[id].phases) {
      const ss = ph.skills.map(s => CFG.skills[s]);
      const n = ss.reduce((a, s) => a + each(s), 0), cd = ss.reduce((a, s) => a + (s.cd || CFG.boss.patternCd), 0);
      phaseAvg.push(n / cd);
    }
    check("每个阶段轮转的平均发射量也 ≤ 预算（最高 " + Math.max(...phaseAvg).toFixed(1) + "/秒）",
      phaseAvg.every(v => v <= CFG.boss.bulletBudget));
    check("螺旋类 warnTime=0（持续型不逐发电报，避免糊屏）",
      pats.filter(s => s.pattern === "spiral").every(s => s.warnTime === 0));
    check("带电报的招式都给了 warnRadius（提示要看得见）",
      pats.filter(s => s.warnTime > 0).every(s => s.warnRadius > 0));
    check("Boss 弹幕走低伤害高密度（dmgMul ≤ 1：压力来自躲，不是扛）",
      pats.every(s => s.dmgMul > 0 && s.dmgMul <= 1));
  }

  /* ============ 二、六种发射器几何 ============ */
  {
    // ① 放射 radial：360° 均匀铺开，出生点 = Boss 位置
    const r = fire(P("AT211"));
    check("radial-弹数 = count（" + r.n + "）", r.n === 10);
    check("radial-角度 360° 等分", angs(r.bs).every((a, i) => nearAng(a, i * Math.PI * 2 / 10)));
    check("radial-出生点 = Boss 位置（无偏移）", r.bs.every(b => near(b.x, r.m.x) && near(b.y, r.m.y)));
    check("radial-速度一致 = bulletSpd（190）", spds(r.bs).every(v => near(v, 190)));

    // ② 扇形 fan：以瞄准角为中心 ±arc/2
    const aim = 0.7, f = fire(P("AT213"), aim);
    const fa = angs(f.bs);
    check("fan-弹数 = count（" + f.n + "）", f.n === 7);
    check("fan-首尾角 = 瞄准角 ±arc/2", nearAng(fa[0], aim - 1.15 / 2) && nearAng(fa[6], aim + 1.15 / 2));
    check("fan-相邻间隔 = arc/(count-1)", nearAng(fa[1] - fa[0], 1.15 / 6));

    // ③ 螺旋 spiral：arms 条臂 + 每次发射整体旋转 spin
    const s1 = fire(P("AT216"), 0, 0);
    check("spiral-弹数 = arms（" + s1.n + "）", s1.n === 3);
    check("spiral-臂间 120° 等分", angs(s1.bs).every((a, i) => nearAng(a, i * Math.PI * 2 / 3)));
    const s2 = fire(P("AT216"), 0, 0.42);
    check("spiral-第二次发射整体旋转 spin（0.42 rad）", nearAng(angs(s2.bs)[0], 0.42));

    // ④ 波幕 wave：一排平行弹（同角），出生点沿法向等距错开
    const wv = fire(P("AT218"), Math.PI / 2);
    check("wave-弹数 = count（" + wv.n + "）", wv.n === 9);
    check("wave-全部同向（平行推进）", angs(wv.bs).every(a => nearAng(a, Math.PI / 2)));
    check("wave-出生点沿法向等距错开 26px（全部同 y）",
      wv.bs.every(b => near(b.y, wv.m.y)) && near(Math.abs(wv.bs[1].x - wv.bs[0].x), 26));
    check("wave-整体居中于 Boss（不偏向一侧）",
      near((wv.bs[0].x + wv.bs[8].x) / 2, wv.m.x));

    // ⑤ 同心环 ring：layers × count，层间角错半格 + 速度递增（飞行中自然分层）
    const rg = fire(P("AT214"), 0);
    check("ring-弹数 = count × layers（" + rg.n + "）", rg.n === 14);
    check("ring-第 2 层角错半格（π/count）", nearAng(angs(rg.bs)[7] - angs(rg.bs)[0], Math.PI / 7));
    const rs = spds(rg.bs);
    check("ring-层间速度递增 ×(1+layerMul=0.18)：175 → " + rs[7].toFixed(1),
      near(rs[0], 175) && near(rs[7], 175 * 1.18, 1e-6));

    // ⑥ 网格/花形 grid：极坐标网格，层半径 = (k+1) × gap
    const gd = fire(P("AT217"), 0);
    check("grid-弹数 = count × layers（" + gd.n + "）", gd.n === 21);
    const rad = gd.bs.map(b => Math.hypot(b.x - gd.m.x, b.y - gd.m.y));
    check("grid-三层半径 = 95 / 190 / 285（gap 95）",
      near(rad[0], 95, 1e-6) && near(rad[7], 190, 1e-6) && near(rad[14], 285, 1e-6));
    check("grid-花瓣沿出生方位向外飞（发射角 = 方位角）",
      gd.bs.every(b => nearAng(Math.atan2(b.vy, b.vx), Math.atan2(b.y - gd.m.y, b.x - gd.m.x))));

    // 弹幕实体参数：带 boss 标记、归属发射者、存活时间取招式或护栏缺省
    check("弹幕实体-带 boss 标记 + owner 指向发射者",
      r.bs.every(b => b.boss === true && b.owner === r.m && b.side === "enemy"));
    check("弹幕实体-寿命按招式 life（AT211 = 6.5s，避免默认 2.2s 半途消失）",
      r.bs.every(b => near(b.life, 6.5)));
    const rDef = fire({ pattern: "radial", count: 4, bulletSpd: 100, dmgMul: 1 });
    check("弹幕实体-未填 life 时取 CFG.boss.bulletLife（" + CFG.boss.bulletLife + "）",
      rDef.bs.every(b => near(b.life, CFG.boss.bulletLife)));
  }

  /* ============ 三、预算与同屏存量护栏 ============ */
  {
    const big = { pattern: "radial", count: 400, bulletSpd: 100, dmgMul: 1 };
    const r1 = fire(big);
    check("预算-单次爆发被裁到每秒额度（400 → " + r1.n + "）", r1.n === CFG.boss.bulletBudget);
    check("预算-裁剪按等间隔抽取，形状仍对称（40 等分）",
      angs(r1.bs).every((a, i) => nearAng(a, i * Math.PI * 2 / 40)));
    check("预算-额度已累计（budgetUsed = " + r1.m.budgetUsed + "）", r1.m.budgetUsed === 40);

    const w2 = fakeW(), m2 = fakeM();
    const e1 = PatternSystem.emit(w2, m2, big, 0, 0);
    const e2 = PatternSystem.emit(w2, m2, big, 0, 0);
    check("预算-同一窗口内第二次发射额度用尽（" + e1 + " → " + e2 + "）", e1 === 40 && e2 === 0);
    m2.bossClock += CFG.boss.bulletWindow;              // 窗口滚动 → 额度重置
    const e3 = PatternSystem.emit(w2, m2, big, 0, 0);
    check("预算-窗口滚动后额度恢复（0 → " + e3 + "）", e3 === 40);

    const w3 = fakeW(), m3 = fakeM();
    for (let i = 0; i < CFG.boss.bulletCap; i++) w3.enemyBullets.push({ owner: m3, dead: false });
    const e4 = PatternSystem.emit(w3, m3, big, 0, 0);
    check("同屏-存量到顶时不再新增（同屏 " + w3.enemyBullets.length + " 发 → 新增 " + e4 + "）", e4 === 0);
    w3.enemyBullets.splice(0, 10);                      // 腾出 10 发
    m3.bossClock += CFG.boss.bulletWindow;
    const e5 = PatternSystem.emit(w3, m3, big, 0, 0);
    check("同屏-腾出多少补多少（缺 10 → 补 " + e5 + "）", e5 === 10);

    const w4 = fakeW(), m4 = fakeM(), other = fakeM();
    for (let i = 0; i < CFG.boss.bulletCap; i++) w4.enemyBullets.push({ owner: other, dead: false });
    const e6 = PatternSystem.emit(w4, m4, big, 0, 0);
    check("同屏-小怪弹幕不占 Boss 存量额度（仍可发射 " + e6 + " 发）", e6 === 40);
  }

  /* ============ 四、阶段机 + 转换无敌 ============ */
  {
    const w = fakeW();
    const b = new Monster("BS0001", 900, 900, 1);
    check("阶段机-构造后处于第 1 阶段且非无敌", b.bossPhase().idx === 0 && b.phaseIdx === 0 && !(b.phaseInvulnT > 0));
    b.hp = b.hpMax * 0.45;
    check("阶段机-半血时判定切到第 2 阶段（但还没 tick 推进）", b.bossPhase().idx === 1 && b.phaseIdx === 0);
    b.bossPhaseTick();
    check("阶段机-推进阶段 + 进入无敌（" + b.phaseInvulnT + "s）",
      b.phaseIdx === 1 && b.phaseInvulnT === CFG.boss.phaseInvuln);

    const hp0 = b.hp;
    damageMonster(w, b, 9999);
    check("无敌-转换窗口内免疫伤害（hp 不变）", b.hp === hp0);

    w.enemyBullets.length = 0; b.patternTimer = 0; b.patternWarnT = 0;
    G.player.x = 200; G.player.y = 200;
    const bx = b.x, by = b.y;
    b.update(w, 0.5);
    check("无敌-转换窗口内不走位", b.x === bx && b.y === by);
    check("无敌-转换窗口内不出招（无电报、无弹幕）", b.patternWarnT === 0 && w.enemyBullets.length === 0);

    b.update(w, 1.0);                                   // 累计超过 1.2s
    check("无敌-窗口结束后解除无敌", !(b.phaseInvulnT > 0));
    damageMonster(w, b, 5);
    check("无敌-解除后恢复吃伤害", b.hp < hp0);
    const bx2 = b.x;
    for (let i = 0; i < 10; i++) b.update(w, 1 / 60);
    check("无敌-解除后恢复走位（追击目标）", b.x !== bx2 || b.y !== 200);

    const idx = b.phaseIdx, inv = b.phaseInvulnT;
    b.bossPhaseTick(); b.bossPhaseTick();
    check("阶段机-同一阶段不会重复触发（无敌不会反复刷新）", b.phaseIdx === idx && b.phaseInvulnT === inv);

    // 阶段切换顺带把爆炸/召唤延后，避免"无敌期间被罚站后立刻挨打"
    const b3 = new Monster("BS0003", 900, 900, 1);
    b3.boomTimer = 0; b3.minionTimer = 0;
    b3.hp = b3.hpMax * 0.3; b3.bossPhaseTick();
    check("阶段机-转换时顺延爆炸与召唤（boomTimer " + b3.boomTimer.toFixed(1) + "s / minionTimer " +
      b3.minionTimer.toFixed(1) + "s）", b3.boomTimer >= 2.0 && b3.minionTimer >= 3.0);
  }

  /* ============ 五、电报 → 发射时序 ============ */
  {
    const w = fakeW();
    const b = new Monster("BS0001", 900, 900, 1);
    b.patternTimer = 0; b.patternIdx = 0;
    b.update(w, 1 / 60);
    check("电报-冷却到位后先亮电报、不立即发射（warnT = " + b.patternWarnT.toFixed(2) + "s，弹幕 " +
      w.enemyBullets.length + " 发）", b.patternWarnT > 0 && w.enemyBullets.length === 0);
    check("电报-记录本次招式（供渲染画充能圈/扇面）", !!b.warnP && b.warnP.pattern === "radial");
    b.update(w, P("AT211").warnTime);
    check("电报-读满后真正发射弹幕（" + w.enemyBullets.length + " 发）", w.enemyBullets.length === 10);
    check("电报-发射后电报清零并进入冷却（" + b.patternTimer.toFixed(2) + "s）",
      b.patternWarnT === 0 && near(b.patternTimer, P("AT211").cd, 1e-9));

    // 螺旋（warnTime = 0）不逐发电报：冷却一到直接连发
    const w2 = fakeW();
    const b2 = new Monster("BS0003", 900, 900, 1);
    b2.hp = b2.hpMax * 0.3; b2.bossPhaseTick();
    b2.phaseInvulnT = 0; b2.patternIdx = 0; b2.patternTimer = 0;
    b2.update(w2, 1 / 60);
    check("电报-螺旋类直接发射（无电报，3 发）", b2.patternWarnT === 0 && w2.enemyBullets.length === 3);
    check("电报-螺旋按自身 cd 连发（0.30s）", near(b2.patternTimer, 0.30, 1e-9));

    // 阶段内招式轮转
    const w3 = fakeW();
    const b3 = new Monster("BS0001", 900, 900, 1);
    b3.patternTimer = 0; b3.patternIdx = 0;
    b3.bossFire(w3, P("AT211")); b3.bossFire(w3, P("AT212"));
    check("招式轮转-按阶段招式池顺序轮转（patternIdx 0→2）", b3.patternIdx === 2);
    check("招式轮转-射后回到池首（idx 取模）", b3.bossPhase().skills[b3.patternIdx % b3.bossPhase().skills.length] === "AT211");
  }

  /* ============ 六、端到端：3 只现有 Boss 都真的会发弹幕 ============ */
  {
    G.player.x = 100; G.player.y = 100;
    for (const id of ["BS0001", "BS0002", "BS0003"]) {
      const w = fakeW();
      const b = new Monster(id, 900, 900, 3);
      let created = 0;
      const T = 12, dt = 1 / 60;
      for (let i = 0; i < T * 60; i++) {
        const before = w.enemyBullets.length;
        b.update(w, dt);
        created += w.enemyBullets.length - before;
        b.x = 900; b.y = 900;                 // 钉住 Boss：避免追人触发接触伤害干扰断言
      }
      const rate = created / T;
      check("端到端-" + id + " " + CFG.monsters[id].name + " 12 秒发射 " + created + " 发弹幕（原实现为 0）", created > 0);
      check("端到端-" + id + " 平均速率 " + rate.toFixed(1) + "/秒 ≤ 预算 " + CFG.boss.bulletBudget,
        rate <= CFG.boss.bulletBudget + 1e-9);
      check("端到端-" + id + " 同屏存量 " + w.enemyBullets.length + " ≤ " + CFG.boss.bulletCap,
        w.enemyBullets.length <= CFG.boss.bulletCap);
      check("端到端-" + id + " 弹幕均带 boss 标记且归属该 Boss",
        w.enemyBullets.every(x => x.boss === true && x.owner === b));
      check("端到端-" + id + " 慢弹幕（≤300px/s，读得懂才躲得开）",
        w.enemyBullets.every(x => Math.hypot(x.vx, x.vy) <= 300 + 1e-6));
    }

    // 瞄准类弹幕确实朝目标飞
    const w4 = fakeW();
    const b4 = new Monster("BS0001", 900, 900, 1);
    G.player.x = 300; G.player.y = 900;                 // 正左方
    b4.bossFire(w4, P("AT212"));
    check("威胁性-瞄准弹确实指向目标（∠ ≈ π）",
      w4.enemyBullets.every(x => angDiff(Math.atan2(x.vy, x.vx), Math.PI) < 0.2));
    check("威胁性-记录瞄准角供电报扇面渲染", near(b4.aimAng, Math.PI, 1e-6));
  }

  /* ============ 七、渲染：电报与无敌护盾确实被画出来 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    Game.loop(t);                                     // 手动踢一次主循环（内部续接 __raf）
    const w = G.mainWorld;
    w.monsters.length = 0;
    const b = new Monster("BS0001", G.player.x + 260, G.player.y, 1);
    w.monsters.push(b);

    b.patternWarnT = 0.6; b.warnP = P("AT213"); b.aimAng = 0;
    ctxCalls.length = 0; step(1);
    const whiteStroke = ctxCalls.some(c => c[0] === "set:strokeStyle" && String(c[1][0]) === CFG.boss.color.bullet);
    const wi = ctxCalls.findIndex(c => c[0] === "set:fillStyle" && String(c[1][0]) === "rgba(255,255,255,0.07)");
    const fanArc = wi >= 0 && ctxCalls.some((c, i) => i > wi && c[0] === "arc" && c[1].length === 5 && c[1][2] > 100);
    check("渲染-弹幕电报画出白色充能扇面（" + CFG.boss.color.bullet + " + 半径 " +
      (wi >= 0 ? Math.round(ctxCalls.find((c, i) => i > wi && c[0] === "arc" && c[1].length === 5)[1][2]) : 0) + "px）",
      whiteStroke && wi >= 0 && fanArc);

    b.patternWarnT = 0; b.phaseInvulnT = 1.0;
    ctxCalls.length = 0; step(1);
    const shieldArc = ctxCalls.some(c => c[0] === "arc" && c[1].length === 5 && Math.abs(c[1][2] - (b.r + 12)) < 1e-6);
    const shieldFill = ctxCalls.some(c => c[0] === "set:fillStyle" && String(c[1][0]).indexOf("rgba(255,255,255,0.") === 0);
    check("渲染-阶段无敌画出白色护盾环（半径 = 体型 " + b.r + " + 12）", shieldArc && shieldFill);

    // Boss 弹幕使用独立配色（与小怪弹一眼可分）
    w.enemyBullets.length = 0;
    b.phaseInvulnT = 0;
    PatternSystem.emit(w, b, P("AT211"), 0, 0);
    ctxCalls.length = 0; step(1);
    const bright = ctxCalls.some(c => c[0] === "set:fillStyle" && String(c[1][0]) === "#e6f4ff");
    check("渲染-Boss 弹幕用独立高亮色 #e6f4ff", bright);
  }

  console.log(ok ? "BOSS TEST OK" : "BOSS TEST FAILED");
  if (!ok) throw new Error("BOSS TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
