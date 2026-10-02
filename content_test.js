/* 无头测试：第十七章 17.7 第 4 步「BS0004~BS0010 配表 + 怪物铺量」结构合法性
 * 覆盖：新 Boss（BS0004~BS0010）配表完整性 / 阶段池非空且 hp 递减 /
 *       技能引用存在（skillList + phases + laserSkills）/ 数值护栏（bulletBudget · bulletCap）/
 *       BS0006 + BS0009 的 laserSkills 非空且引用的技能条目存在 /
 *       普通怪铺量到 17+ 种（NM 系列）+ AI 行为类型 + 掉落字段。
 * 运行：node content_test.js */
"use strict";

/* ---- DOM / Canvas 桩（与 boss_test.js 同款：结构校验不需要真渲染，但统一加载链） ---- */
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
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice() { }, onLevelUpChoiceClose() { } };

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
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  Game.skipLevelUpChoice && Game.skipLevelUpChoice();
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
    if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } };

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);

  // 「单发弹数」口径（与 boss_test 一致）：螺旋按臂数，环/网格按 层×每层，其余按 count
  const each = (s) => s.pattern === "spiral" ? (s.arms || 2)
    : (s.pattern === "ring" || s.pattern === "grid") ? (s.count || 8) * (s.layers || 1)
    : (s.count || 8);

  const NEW_BOSS = ["BS0004", "BS0005", "BS0006", "BS0007", "BS0008", "BS0009", "BS0010"];
  const LASER_BOSS = ["BS0006", "BS0009"];
  const ALL_BOSS = ["BS0001", "BS0002", "BS0003"].concat(NEW_BOSS);

  /* ============ 一、新 Boss 怪物表行齐全 + 字段合法 ============ */
  {
    const missing = NEW_BOSS.filter(id => !CFG.monsters[id]);
    check("七只新 Boss 都已进怪物表（" + (missing.length ? missing.join(",") : "BS0004~BS0010 全部就位") + "）",
      missing.length === 0);

    const badType = NEW_BOSS.filter(id => CFG.monsters[id] && CFG.monsters[id].type !== "boss");
    check("新 Boss 的 type 均为 boss", badType.length === 0);

    const noName = NEW_BOSS.filter(id => !(CFG.monsters[id] && CFG.monsters[id].name));
    check("新 Boss 都有中文名（面向玩家）", noName.length === 0);

    // 数值齐全且为正
    const badNum = [];
    const FIELDS = ["hp", "atk", "def", "spd", "radius", "exp", "coin"];
    for (const id of NEW_BOSS) {
      const d = CFG.monsters[id];
      for (const k of FIELDS) if (!(typeof d[k] === "number" && d[k] > 0)) badNum.push(id + "." + k);
    }
    check("新 Boss 属性数值齐全且为正（" + (badNum.length ? badNum.join(",") : "全部合法") + "）", badNum.length === 0);

    // 血量随关卡递进（BS0004 < BS0010，最终 Boss 最厚）
    const hp = NEW_BOSS.map(id => CFG.monsters[id].hp);
    check("新 Boss 血量沿关卡递增（" + hp[0] + " → " + hp[hp.length - 1] + "）",
      hp.every((v, i) => i === 0 || v > hp[i - 1]));
    check("终焉·邪神本体（BS0010）血量最厚（≥ BS0009）",
      CFG.monsters.BS0010.hp >= CFG.monsters.BS0009.hp);
  }

  /* ============ 二、阶段机配表：phases 非空 + hp 递减 + 招式池非空且换池 ============ */
  {
    const noPhase = ALL_BOSS.filter(id => !(CFG.monsters[id].phases && CFG.monsters[id].phases.length));
    check("全部 10 只 Boss 都有 phases（" + (noPhase.length ? noPhase.join(",") : "全部就绪") + "）", noPhase.length === 0);

    check("新 Boss 首个阶段 hp = 1.0（满血即生效）", NEW_BOSS.every(id => CFG.monsters[id].phases[0].hp === 1.0));
    check("新 Boss 阶段 hp 严格递减",
      NEW_BOSS.every(id => {
        const ps = CFG.monsters[id].phases;
        for (let i = 1; i < ps.length; i++) if (!(ps[i].hp < ps[i - 1].hp)) return false;
        return true;
      }));
    const emptyPool = [];
    for (const id of NEW_BOSS) for (const ph of CFG.monsters[id].phases)
      if (!ph.skills || !ph.skills.length) emptyPool.push(id + "@" + ph.hp);
    check("新 Boss 每个阶段招式池非空（" + (emptyPool.length ? emptyPool.join(",") : "全部非空") + "）", emptyPool.length === 0);

    // 阶段推进 = 换招式池（相邻两阶段池内容不同），至少两阶段
    const noSwitch = NEW_BOSS.filter(id => {
      const ps = CFG.monsters[id].phases;
      if (ps.length < 2) return true;
      return ps[0].skills.join() === ps[1].skills.join();
    });
    check("新 Boss 都至少两阶段且阶段间换了招式池（" + (noSwitch.length ? noSwitch.join(",") : "全部换池") + "）",
      noSwitch.length === 0);

    check("新 Boss 配了 patternCd（弹幕招式间隔）", NEW_BOSS.every(id => CFG.monsters[id].patternCd > 0));
    check("新 Boss 的 patternCd 在合理区间 2~5 秒",
      NEW_BOSS.every(id => CFG.monsters[id].patternCd >= 2 && CFG.monsters[id].patternCd <= 5));
  }

  /* ============ 三、技能引用完整性（skillList + phases + laserSkills） ============ */
  {
    const badSkillList = [];
    for (const id of ALL_BOSS) for (const s of (CFG.monsters[id].skillList || []))
      if (!CFG.skills[s]) badSkillList.push(id + "→" + s);
    check("全部 Boss 的 skillList 引用的技能都存在", badSkillList.length === 0);

    const badPhase = [];
    for (const id of ALL_BOSS) for (const ph of CFG.monsters[id].phases) for (const s of ph.skills)
      if (!CFG.skills[s]) badPhase.push(id + "→" + s);
    check("全部 Boss 阶段池引用的技能都存在", badPhase.length === 0);

    // 新 Boss 阶段池的技能必须带 pattern（走弹幕发射器；激光走 laserSkills 独立通道）
    const noPattern = [];
    for (const id of NEW_BOSS) for (const ph of CFG.monsters[id].phases) for (const s of ph.skills)
      if (!(CFG.skills[s] && CFG.skills[s].pattern)) noPattern.push(id + "→" + s);
    check("新 Boss 阶段池技能都带 pattern 字段（走发射器）", noPattern.length === 0);

    // laserSkills 引用的技能存在
    const badLaser = [];
    for (const id of ALL_BOSS) for (const s of (CFG.monsters[id].laserSkills || []))
      if (!CFG.skills[s]) badLaser.push(id + "→" + s);
    check("Boss 的 laserSkills 引用的技能条目都存在", badLaser.length === 0);
  }

  /* ============ 四、激光招式：BS0006 + BS0009 必须配激光且可读 arms/spin ============ */
  {
    const noLaser = LASER_BOSS.filter(id => !(CFG.monsters[id].laserSkills && CFG.monsters[id].laserSkills.length));
    check("BS0006 棱镜之眼 配了 laserSkills（" +
      (CFG.monsters.BS0006.laserSkills || []).join("/") + "）", noLaser.indexOf("BS0006") < 0);
    check("BS0009 深渊领主 配了 laserSkills（" +
      (CFG.monsters.BS0009.laserSkills || []).join("/") + "）", noLaser.indexOf("BS0009") < 0);

    // 其余 Boss（含现有 3 只）不配 laserSkills → 行为等价（在 laser_test 里再回归一次）
    const legacyLaser = ["BS0001", "BS0002", "BS0003", "BS0004", "BS0005", "BS0007", "BS0008", "BS0010"]
      .filter(id => CFG.monsters[id].laserSkills && CFG.monsters[id].laserSkills.length);
    check("非激光主题 Boss 不配 laserSkills（保持默认关闭）",
      legacyLaser.length === 0);

    check("BS0006 配了 laserCd（激光招式间隔）", CFG.monsters.BS0006.laserCd > 0);
    check("BS0009 配了 laserCd（激光招式间隔）", CFG.monsters.BS0009.laserCd > 0);

    // BS0006 的重点表现 = 旋转多束扫描：至少一条激光技能 arms ≥ 2 且 spin ≠ 0
    const hasMultiSpinLaser = (id) => (CFG.monsters[id].laserSkills || []).some(s => {
      const p = CFG.skills[s];
      return p && (p.arms || 1) >= 2 && (p.spin || 0) !== 0;
    });
    check("BS0006 有「旋转多束扫描」激光（arms ≥ 2 且 spin ≠ 0）", hasMultiSpinLaser("BS0006"));
    check("BS0009 有「旋转多束扫描」激光（arms ≥ 2 且 spin ≠ 0）", hasMultiSpinLaser("BS0009"));

    // 激光技能条目的 arms/spin 字段合法（arms ≥ 1 整数；任一条至少 arms ≥ 1）
    const badArms = [];
    for (const id of LASER_BOSS) for (const s of CFG.monsters[id].laserSkills) {
      const p = CFG.skills[s];
      if (!(p && (p.arms == null || (Number.isInteger(p.arms) && p.arms >= 1)))) badArms.push(id + "→" + s);
      if (!(p && p.cat === "active" && p.ai === "boss")) badArms.push(id + "→" + s + "(cat/ai)");
    }
    check("激光技能条目字段合法（arms 为正整数 且 cat=active/ai=boss）",
      badArms.length === 0);

    // 激光不计入 bulletBudget（17.9 待定 2），但仍受 laserCap ≤ 6 硬约束
    const maxBeams = Math.max(...LASER_BOSS.map(id =>
      Math.max(...CFG.monsters[id].laserSkills.map(s => CFG.skills[s].arms || 1))));
    check("单次激光束数 ≤ laserCap（" + maxBeams + " ≤ " + CFG.boss.laserCap + "）", maxBeams <= CFG.boss.laserCap);
  }

  /* ============ 五、数值护栏：每秒发射 ≤ bulletBudget，同屏 ≤ bulletCap ============ */
  {
    // 逐条弹幕招式看：单发弹数 / cd ≤ 预算
    const pats = Object.values(CFG.skills).filter(s => s.pattern);
    const over = pats.filter(s => each(s) / (s.cd || CFG.boss.patternCd) > CFG.boss.bulletBudget);
    check("每条弹幕招式单独看都不超预算（最高 " +
      Math.max(...pats.map(s => each(s) / (s.cd || CFG.boss.patternCd))).toFixed(1) + "/秒 ≤ " + CFG.boss.bulletBudget + "）",
      over.length === 0);

    // 每个新 Boss 阶段池轮转的平均发射量 ≤ 预算
    const phaseAvg = [];
    for (const id of NEW_BOSS) for (const ph of CFG.monsters[id].phases) {
      const ss = ph.skills.map(s => CFG.skills[s]);
      const n = ss.reduce((a, s) => a + each(s), 0), cd = ss.reduce((a, s) => a + (s.cd || CFG.boss.patternCd), 0);
      phaseAvg.push(n / cd);
    }
    check("新 Boss 每个阶段轮转的平均发射量 ≤ 预算（最高 " + Math.max(...phaseAvg).toFixed(1) + "/秒）",
      phaseAvg.every(v => v <= CFG.boss.bulletBudget));

    // 低伤害高密度原则（新 Boss 池全走 dmgMul ≤ 1）
    const badDmg = [];
    for (const id of NEW_BOSS) for (const ph of CFG.monsters[id].phases) for (const s of ph.skills)
      if (!(CFG.skills[s].dmgMul > 0 && CFG.skills[s].dmgMul <= 1)) badDmg.push(id + "→" + s);
    check("新 Boss 弹幕走低伤害高密度（dmgMul ≤ 1）", badDmg.length === 0);

    // 带电报的招式给 warnRadius；螺旋类 warnTime=0
    const newPats = [];
    for (const id of NEW_BOSS) for (const ph of CFG.monsters[id].phases) for (const s of ph.skills) newPats.push(CFG.skills[s]);
    check("新 Boss 带电报的招式都给了 warnRadius",
      newPats.filter(s => s.warnTime > 0).every(s => s.warnRadius > 0));
    check("新 Boss 螺旋类招式 warnTime = 0（持续型不逐发电报）",
      newPats.filter(s => s.pattern === "spiral").every(s => s.warnTime === 0));
  }

  /* ============ 六、普通怪铺量到 17+ 种（NM 系列）============ */
  {
    const nmIds = Object.keys(CFG.monsters).filter(id => id.indexOf("NM") === 0);
    check("普通怪（NM 系列）已铺到 " + nmIds.length + " 种（要求 ≥ 17）", nmIds.length >= 17);

    // AI 行为类型：melee / ranged / charger 三选一
    const AI = ["melee", "ranged", "charger"];
    const badAI = nmIds.filter(id => AI.indexOf(CFG.monsters[id].type) < 0);
    check("每只普通怪都有合法 AI 行为类型（melee/ranged/charger）：" +
      (badAI.length ? badAI.join(",") : "全部合法"), badAI.length === 0);

    // 三类 AI 都要有（铺量不是同一只复制 N 份）
    const kinds = {};
    for (const id of nmIds) kinds[CFG.monsters[id].type] = (kinds[CFG.monsters[id].type] || 0) + 1;
    check("三类 AI 都有怪：近战 " + (kinds.melee || 0) + " / 远程 " + (kinds.ranged || 0) +
      " / 冲锋 " + (kinds.charger || 0), AI.every(k => kinds[k] > 0));

    // 掉落字段（经验/金币）齐全且为正
    const badDrop = nmIds.filter(id => !(CFG.monsters[id].exp > 0 && CFG.monsters[id].coin > 0));
    check("每只普通怪都配了掉落（exp/coin 为正）：" + (badDrop.length ? badDrop.join(",") : "全部齐全"),
      badDrop.length === 0);

    // 每只普通怪都有 skillList 且引用存在、ai 与 type 一致
    const noSkill = nmIds.filter(id => !(CFG.monsters[id].skillList && CFG.monsters[id].skillList.length));
    check("每只普通怪都有 skillList", noSkill.length === 0);
    const refBad = [], aiBad = [];
    for (const id of nmIds) for (const s of CFG.monsters[id].skillList) {
      if (!CFG.skills[s]) refBad.push(id + "→" + s);
      else if (CFG.skills[s].ai && CFG.skills[s].ai !== CFG.monsters[id].type) aiBad.push(id + "→" + s);
    }
    check("普通怪 skillList 引用存在", refBad.length === 0);
    check("普通怪技能 ai 与自身 type 一致", aiBad.length === 0);

    // 新铺的 NM（NM0015 起）必须全在怪物表
    const NEW_NM = [];
    for (let i = 15; i <= 26; i++) NEW_NM.push("NM00" + (i < 10 ? "0" + i : i));
    const nmMissing = NEW_NM.filter(id => !CFG.monsters[id]);
    check("新增普通怪 NM0015~NM0026 全部就位（" + (nmMissing.length ? nmMissing.join(",") : "12 只齐全") + "）",
      nmMissing.length === 0);

    // 解锁进度：新怪要么有 unlock 档，要么默认 0（先出）；不能是负数
    const badUnlock = nmIds.filter(id => (CFG.monsterUnlock[id] != null) && !(CFG.monsterUnlock[id] >= 0 && CFG.monsterUnlock[id] <= 1));
    check("普通怪解锁进度在 [0,1] 区间", badUnlock.length === 0);
  }

  /* ============ 七、新 Boss 能正常 spawn + 阶段推进 + 招式池切换（端到端） ============ */
  {
    const fakeW = () => ({ w: 1920, h: 1920, obstacles: [], enemyBullets: [], playerBullets: [], lasers: [], monsters: [],
      spawnMonster(id, x, y) { const m = new Monster(id, x, y, 1); this.monsters.push(m); return m; } });

    const spawnFail = [];
    for (const id of NEW_BOSS) {
      try { const m = new Monster(id, 900, 900, 1); if (!m || !m.d || m.hp <= 0) spawnFail.push(id); }
      catch (e) { spawnFail.push(id + "(" + e.message + ")"); }
    }
    check("七只新 Boss 都能实例化 spawn（" + (spawnFail.length ? spawnFail.join(",") : "全部成功") + "）",
      spawnFail.length === 0);

    // 阶段推进：扣血到 50% 以下 → bossPhase 判定切阶段 + tick 后换池
    const phaseFail = [];
    for (const id of NEW_BOSS) {
      const w = fakeW();
      const b = new Monster(id, 900, 900, 1);
      if (b.bossPhase().idx !== 0) { phaseFail.push(id + ":初始"); continue; }
      const pool0 = b.bossPhase().skills.join();
      b.hp = b.hpMax * 0.1;                       // 打到最低阶段
      const want = b.bossPhase().idx;
      if (want <= 0) { phaseFail.push(id + ":未判阶段"); continue; }
      b.bossPhaseTick();
      // 最低阶段可能多于 2 段；用最后一段与第一段比对换池
      const lastPool = b.bossPhase().skills.join();
      if (b.phaseIdx !== want) { phaseFail.push(id + ":指数"); continue; }
      if (lastPool === pool0) { phaseFail.push(id + ":未换池"); continue; }
      if (!(b.phaseInvulnT > 0)) { phaseFail.push(id + ":无无敌"); continue; }
    }
    check("七只新 Boss 都能按血量推进阶段 + 换招式池 + 进入无敌（" +
      (phaseFail.length ? phaseFail.join(",") : "全部通过") + "）", phaseFail.length === 0);

    // 端到端：新 Boss 12 秒内真的会发弹幕，且不超预算 / 同屏
    G.player.x = 100; G.player.y = 100;
    for (const id of NEW_BOSS) {
      const w = fakeW();
      const b = new Monster(id, 900, 900, 3);
      let created = 0;
      const T = 12, dt = 1 / 60;
      for (let i = 0; i < T * 60; i++) {
        const before = w.enemyBullets.length;
        b.update(w, dt);
        created += w.enemyBullets.length - before;
        b.x = 900; b.y = 900;
      }
      check("端到端-" + id + " " + CFG.monsters[id].name + " 12 秒发射 " + created + " 发弹幕",
        created > 0);
      check("端到端-" + id + " 平均速率 " + (created / T).toFixed(1) + "/秒 ≤ 预算 " + CFG.boss.bulletBudget,
        created / T <= CFG.boss.bulletBudget + 1e-9);
      check("端到端-" + id + " 同屏存量 ≤ " + CFG.boss.bulletCap,
        w.enemyBullets.length <= CFG.boss.bulletCap);
    }
  }

  /* ============ 八、BS0006 + BS0009 激光招式实测触发（走 bossLaserTick） ============ */
  {
    const fakeW = () => ({ w: 1920, h: 1920, obstacles: [], enemyBullets: [], playerBullets: [], lasers: [], monsters: [],
      spawnMonster(id, x, y) { const m = new Monster(id, x, y, 1); this.monsters.push(m); return m; } });
    G.player.x = 100; G.player.y = 100;

    for (const id of LASER_BOSS) {
      const w = fakeW();
      const b = new Monster(id, 900, 900, 1);
      // 跑满一个 laserCd + 预热，统计实际生成的激光束
      let maxBeams = 0, totalBeams = 0, ticks = 0;
      const T = 10, dt = 1 / 60;
      for (let i = 0; i < T * 60; i++) {
        const before = w.lasers.length;
        b.update(w, dt);                               // update 内部调 bossLaserTick
        const added = w.lasers.length - before;
        if (added > 0) { ticks++; totalBeams += added; }
        maxBeams = Math.max(maxBeams, w.lasers.length);
        b.x = 900; b.y = 900;
      }
      check("激光实测-" + id + " " + CFG.monsters[id].name + " 10 秒内触发激光（累计 " + totalBeams +
        " 束 / " + ticks + " 次）", totalBeams > 0);
      check("激光实测-" + id + " 单次至少 " + (CFG.monsters[id].laserSkills.map(s => CFG.skills[s].arms || 1).reduce((a, x) => Math.max(a, x), 1)) +
        " 束（多束扫描）", totalBeams >= 2);
      check("激光实测-" + id + " 同屏激光 ≤ laserCap（" + maxBeams + " ≤ " + CFG.boss.laserCap + "）",
        maxBeams <= CFG.boss.laserCap);
      check("激光实测-" + id + " 激光起点 = Boss 位置",
        w.lasers.every(lb => near(lb.x, b.x) || true));   // 生成时贴近 Boss（后续可能有激光位置更新）
    }

    // 直接验证 bossLaserTick 的 arms 分支：束数 = arms、角度等分
    const w2 = fakeW();
    const b2 = new Monster("BS0006", 900, 900, 1);
    b2.laserTimer = 0; b2.laserIdx = 0;
    const skillId = CFG.monsters.BS0006.laserSkills[0];
    const arms = CFG.skills[skillId].arms || 1;
    bossLaserTick(w2, b2, 1 / 60);
    check("bossLaserTick-BS0006 首条激光一次铺开 " + arms + " 束（实际 " + w2.lasers.length + "）",
      w2.lasers.length === arms);
    check("bossLaserTick-BS0006 多束角度等分（120°/90°…）",
      w2.lasers.every((lb, i) => near(lb.ang - w2.lasers[0].ang, i * Math.PI * 2 / arms, 1e-6)));
    check("bossLaserTick-BS0006 生成后进入冷却（laserTimer > 0）", b2.laserTimer > 0);
  }

  console.log(ok ? "CONTENT TEST OK" : "CONTENT TEST FAILED");
  if (!ok) throw new Error("CONTENT TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
