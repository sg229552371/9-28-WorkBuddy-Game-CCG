/* 无头测试：26.x「12 角重做」四件套（node hero_kit_test.js）
 * 覆盖：
 *   一、属性说明（CFG.statNames 全键 + CFG.statDesc 文案 + UI._statName/_statHelpHtml 回落与渲染）
 *   二、近战引擎（AT121 type:melee 的扇形即时判定：正面命中 / 背面不命中 / 超距不命中）
 *   三、12 角特色技能零重复 + 近战/远程普攻分流
 *   四、属性强化技能 scaleBy（AT120/AT122/AT123/AT124；属性越高效果越强）
 *   五、辅助三件套效果（AT122 全队回血 / AT123 全队增益 / AT124 全队护罩）+ 重复施放刷新不叠加
 * 运行：node hero_kit_test.js（退出码 0 = 全绿，与 run_tests.sh 口径一致）
 * ⚠️ PASS 文案只含中文，禁止出现英文 error/FAIL（门禁口径：bad = grep -ci "Assertion failed|FAIL|Error"）。 */
"use strict";

/* ---- DOM / Canvas 桩 ---- */
const ctxCalls = [];
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
    this.children = []; this.innerHTML = ""; this.textContent = ""; this.disabled = false;
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
global.window = { addEventListener() { } };
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
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  Game.skipLevelUpChoice && Game.skipLevelUpChoice();
  let t = 0;
  Game.loop(t);                    // 手动踢一次主循环：内部 requestAnimationFrame 才会登记 __raf

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);

  /* 木桩怪：血量高到打不死，方便断言"命中次数"而不是"击杀" */
  const mkM = (x, y) => ({ x, y, r: 20, hp: 999999, hpMax: 999999, shield: 0, eliteDef: 0, dead: false,
    flashT: 0, phaseInvulnT: 0, lv: 1, sizeMul: 1, d: { def: 0, type: "melee", hp: 999999, name: "木桩" } });
  /* 极简世界：explode / 辅助技能需要 w.monsterHash（SpatialHash）查候选，故真插一遍 */
  const fakeW = (ms) => {
    const list = ms || [];
    const hash = new SpatialHash(96);
    for (const m of list) hash.insert(m, m.x, m.y, m.r || 20);
    return { w: 1920, h: 1920, obstacles: [], enemyBullets: [], playerBullets: [],
      lasers: [], pickups: [], monsters: list, monsterHash: hash };
  };

  /* ============ 一、属性说明（名称 + 文案） ============ */
  {
    const needKeys = ["atk", "hp", "def", "spd", "energyMax", "energyRegen", "summonMax", "trapMax", "radius"];
    const missName = needKeys.filter(k => !CFG.statNames[k]);
    check("一1 CFG.statNames 覆盖英雄全部属性" + (missName.length ? "（缺：" + missName.join(",") + "）" : ""),
      missName.length === 0);
    check("一2 CFG.statDesc 存在且有文案", !!CFG.statDesc && Object.keys(CFG.statDesc).length >= 9);
    const badDesc = Object.keys(CFG.statDesc).filter(k => {
      const d = CFG.statDesc[k];
      return !d || typeof d.desc !== "string" || d.desc.length < 8 || typeof d.name !== "string";
    });
    check("一3 每条属性说明都有 name + 足够长的 desc" + (badDesc.length ? "（不合格：" + badDesc.join(",") + "）" : ""),
      badDesc.length === 0);
    check("一4 属性名与说明一致（statDesc.name 与 statNames 对齐）",
      ["atk", "hp", "def", "spd", "energyMax"].every(k => CFG.statDesc[k].name === CFG.statNames[k]));
    check("一5 UI._statName 读 CFG.statNames（防御）", UI._statName("def") === "防御");
    check("一6 UI._statName 未知键回落原键（不空白）", UI._statName("zzzUnknown") === "zzzUnknown");
    check("一7 UI._statName 空值安全", UI._statName(null) === "属性" && UI._statName("") === "属性");

    const html = UI._statHelpHtml(["atk", "def"]);
    check("一8 UI._statHelpHtml 列出属性名（攻击 / 防御）",
      html.indexOf("攻击") >= 0 && html.indexOf("防御") >= 0);
    check("一9 UI._statHelpHtml 含说明文案正文（不只名字）",
      html.indexOf(CFG.statDesc.atk.desc) >= 0 && html.indexOf(CFG.statDesc.def.desc) >= 0);
    check("一10 未登记属性也不崩（回落「暂无说明」）",
      UI._statHelpHtml(["nope"]).indexOf("暂无说明") >= 0);

    // 英雄详情需要展示的属性键：默认 4+能量；召唤/陷阱上限只在高于默认值时出现
    check("一11 _statKeysOf 召唤师列出 summonMax（6 > 默认 2）",
      UI._statKeysOf(CFG.heroes.find(h => h.id === "H007")).indexOf("summonMax") >= 0);
    check("一12 _statKeysOf 猎手不列 summon/trap（都是默认值）",
      UI._statKeysOf(CFG.heroes.find(h => h.id === "H001")).indexOf("summonMax") < 0
      && UI._statKeysOf(CFG.heroes.find(h => h.id === "H001")).indexOf("trapMax") < 0);
    check("一13 _statKeysOf 陷阱师列出 trapMax（3 > 默认 1）",
      UI._statKeysOf(CFG.heroes.find(h => h.id === "H008")).indexOf("trapMax") >= 0);
  }

  /* ============ 二、近战引擎（AT121 type:melee 扇形即时判定） ============ */
  {
    const sk = CFG.skills.AT121;
    check("二1 AT121 是 type:melee 且有 reach / meleeArc",
      sk.type === "melee" && sk.reach > 0 && sk.meleeArc > 0 && sk.meleeArc < Math.PI * 2);
    check("二2 AT121 有伤害倍率（dmgMul > 0）", typeof sk.dmgMul === "number" && sk.dmgMul > 0);

    const caster = { x: 1000, y: 1000, atk: 20 };
    const resolved = Object.assign({}, sk, { lv: 1 });

    // 正面 50px（在 reach 78 内、夹角 0）→ 命中
    const front = mkM(1050, 1000);
    const w1 = fakeW([front]);
    const r1 = SkillSystem.castMelee(w1, caster, resolved, 0, { atk: caster.atk });
    check("二3 正面近距离命中（n = " + r1.n + "）", r1.n === 1 && front.hp < front.hpMax);

    // 背面 50px（夹角 π > meleeArc/2）→ 不命中
    const back = mkM(950, 1000);
    const r2 = SkillSystem.castMelee(fakeW([back]), caster, resolved, 0, { atk: caster.atk });
    check("二4 背后目标不命中（扇形外，n = " + r2.n + "）", r2.n === 0 && back.hp === back.hpMax);

    // 侧面 90°（夹角 π/2 > 张角一半 0.875 rad ≈ 50°）→ 不命中
    const side = mkM(1000, 1050);
    const r3 = SkillSystem.castMelee(fakeW([side]), caster, resolved, 0, { atk: caster.atk });
    check("二5 正侧方（90°）不命中 —— 张角约 100°（n = " + r3.n + "）", r3.n === 0);

    // 正面但超距 → 不命中
    const far = mkM(1300, 1000);
    const r4 = SkillSystem.castMelee(fakeW([far]), caster, resolved, 0, { atk: caster.atk });
    check("二6 超出 reach 不命中（300px 外，n = " + r4.n + "）", r4.n === 0);

    // 群体：扇形内 3 只全中
    const w5 = fakeW([mkM(1040, 990), mkM(1055, 1005), mkM(1060, 1000)]);
    const r5 = SkillSystem.castMelee(w5, caster, resolved, 0, { atk: caster.atk });
    check("二7 扇形内多目标全部命中（3 只 → n = " + r5.n + "）", r5.n === 3);

    // 已死目标跳过
    const dead1 = mkM(1050, 1000); dead1.dead = true;
    const r6 = SkillSystem.castMelee(fakeW([dead1]), caster, resolved, 0, { atk: caster.atk });
    check("二8 已死亡目标不计入命中（n = " + r6.n + "）", r6.n === 0);

    // cast() 分发：type:melee 走近战分支
    const front2 = mkM(1050, 1000);
    const rr = SkillSystem.cast(fakeW([front2]), caster, Object.assign({}, resolved, { kind: "basic" }), null, { ang: 0, atk: caster.atk });
    check("二9 SkillSystem.cast 把 type:melee 分发到近战分支（kind = " + rr.kind + "）", rr.kind === "melee");

    // 近战伤害高于同攻击力的远程普攻（dmgMul 对照）
    check("二10 近战普攻倍率高于远程普攻基准（1.35 > 1.0）", sk.dmgMul > 1.0);
  }

  /* ============ 三、12 角特色技能零重复 + 远近战普攻分流 ============ */
  {
    const skillIds = CFG.heroes.map(h => CFG.weapons[h.weapon].skills.skill);
    check("三1 12 英雄特色技能零重复（" + new Set(skillIds).size + " 种）", new Set(skillIds).size === 12);
    const meleeHeroes = CFG.heroes.filter(h => h.range === "melee");
    check("三2 近战英雄全部挂 AT121 普攻（" + meleeHeroes.length + " 人）",
      meleeHeroes.length >= 3 && meleeHeroes.every(h => CFG.weapons[h.weapon].skills.basic === "AT121"));
    const rangedHeroes = CFG.heroes.filter(h => h.range === "ranged");
    check("三3 远程英雄一律不挂 AT121（" + rangedHeroes.length + " 人）",
      rangedHeroes.every(h => CFG.weapons[h.weapon].skills.basic !== "AT121"));
    check("三4 每个定位都同时有远程与近战",
      ["output", "defense", "aux"].every(r =>
        CFG.heroes.some(h => h.role === r && h.range === "melee") &&
        CFG.heroes.some(h => h.role === r && h.range === "ranged")));
  }

  /* ============ 四、属性强化技能 scaleBy ============ */
  {
    check("四1 AT120 嘲讽 radius 走 def（示例：半径 = 固定值 + 防御×2%）",
      CFG.skills.AT120.scaleBy && CFG.skills.AT120.scaleBy.stat === "def");
    check("四2 AT122 生命脉冲走 atk", CFG.skills.AT122.scaleBy.stat === "atk");
    check("四3 AT123 鼓舞光环走 def", CFG.skills.AT123.scaleBy.stat === "def");
    check("四4 AT124 灵能护罩走 energyMax", CFG.skills.AT124.scaleBy.stat === "energyMax");

    const base = { lv: 1, radius: 100, scaleBy: { stat: "def", pct: 0.02 } };
    const low = SkillSystem.withScaleBy(base, { def: 2 });
    const high = SkillSystem.withScaleBy(base, { def: 8 });
    check("四5 属性越高加成越大（防御 2 → " + (low.scaleByAdd || 0).toFixed(2) +
      " / 防御 8 → " + (high.scaleByAdd || 0).toFixed(2) + "）",
      (high.scaleByAdd || 0) > (low.scaleByAdd || 0) && (low.scaleByAdd || 0) > 0);
    check("四6 半径 = 锚点固定值 + 加成（100 + 8×0.02 = 100.16）", near(high.radius, 100.16, 1e-6));
    check("四7 未声明 scaleBy 时零足迹（原样返回）",
      SkillSystem.withScaleBy({ lv: 1, radius: 50 }, { def: 9 }) === undefined ||
      (() => { const o = { lv: 1, radius: 50 }; return SkillSystem.withScaleBy(o, { def: 9 }) === o; })());
    check("四8 属性缺失不加成（scaleByAdd 为 0）",
      !(SkillSystem.withScaleBy(base, {}) || {}).scaleByAdd);
  }

  /* ============ 五、辅助三件套效果 ============ */
  {
    const caster = { x: 1000, y: 1000, atk: 20, heroDef: { id: "H010" } };
    G.run.buffs.length = 0;

    /* --- AT122 生命脉冲：范围伤害 + 全队回血 --- */
    {
      const sk = SkillSystem.withScaleBy(Object.assign({}, CFG.skills.AT122, { lv: 1, radius: 150 }), { atk: 20 });
      const mob = mkM(1040, 1000);
      const w = fakeW([mob]);
      /* ⚠️ 血量通道不一致：**队长**在 G.run.hp / hpMax，**队友**在 h.hp / hpMax。
       *    这里两条通道各摆一个受试者，锁死「谁都别漏」——曾经只按 h.hp 读，队长被整体跳过。 */
      const run = G.run;
      run.hp = Math.max(1, Math.round(run.hpMax * 0.5));
      const comp = { hp: 10, hpMax: 100, alive: true, isCompanion: true, name: "受试队友", x: 1000, y: 1000 };
      run.companions.push(comp);
      const before = run.hp, compBefore = comp.hp, mobBefore = mob.hp;
      const r = SkillSystem.castSupport(w, caster, sk, { atk: caster.atk }, "heal");
      run.companions.pop();
      check("五1 AT122 对范围内敌人造成伤害", mob.hp < mobBefore);
      check("五2 AT122 回复队长生命（" + before + " → " + run.hp + "，回 " + r.amount + "）",
        run.hp > before && r.amount > 0);
      check("五3 AT122 回复量随攻击提升（scaleBy 生效，加成 " + (sk.scaleByAdd || 0).toFixed(2) + "）",
        (sk.scaleByAdd || 0) > 0 && r.amount > sk.healBase);
      check("五4 AT122 连带回复队友（" + compBefore + " → " + comp.hp + "，命中 " + r.n + " 人）",
        comp.hp > compBefore && r.n === 2);
      check("五5 AT122 不回超过生命上限", run.hp <= run.hpMax && comp.hp <= comp.hpMax);
    }

    /* --- AT123 鼓舞光环：范围伤害 + 全队攻击/移速增益 --- */
    {
      G.run.buffs.length = 0;
      const sk = SkillSystem.withScaleBy(Object.assign({}, CFG.skills.AT123, { lv: 1, radius: 160 }), { def: 4 });
      const mk = {};                       // 极简世界：不摆怪，只验增益
      SkillSystem.castSupport(fakeW([]), caster, sk, { atk: caster.atk }, "aura");
      const ids = G.run.buffs.map(b => b.id);
      check("五6 AT123 写入两条全队增益（" + ids.join(",") + "）",
        ids.indexOf("圣咏鼓舞") >= 0 && ids.indexOf("圣咏迅捷") >= 0);
      const bo = runBonus();
      check("五7 AT123 生效：runBonus 攻击倍率 > 1（" + bo.mul.atk.toFixed(3) + "）", bo.mul.atk > 1);
      check("五8 AT123 生效：runBonus 移速倍率 > 1（" + bo.mul.spd.toFixed(3) + "）", bo.mul.spd > 1);
      check("五9 AT123 幅度含属性加成（> 基础 8%）", bo.mul.atk > 1.08 - 1e-9);

      // 重复施放：刷新时长、**不叠加**
      const n0 = G.run.buffs.length;
      SkillSystem.castSupport(fakeW([]), caster, sk, { atk: caster.atk }, "aura");
      const bo2 = runBonus();
      check("五10 重复施放不叠加（条目数 " + n0 + " → " + G.run.buffs.length + "）", G.run.buffs.length === n0);
      check("五11 重复施放不叠乘倍率（" + bo2.mul.atk.toFixed(3) + " ≈ " + bo.mul.atk.toFixed(3) + "）",
        near(bo2.mul.atk, bo.mul.atk, 1e-9));
    }

    /* --- AT124 灵能护罩：范围伤害 + 全队防御提升 --- */
    {
      G.run.buffs.length = 0;
      const sk = SkillSystem.withScaleBy(Object.assign({}, CFG.skills.AT124, { lv: 1, radius: 140 }), { energyMax: 130 });
      const mob = mkM(1030, 1000);
      SkillSystem.castSupport(fakeW([mob]), caster, sk, { atk: caster.atk }, "barrier");
      check("五12 AT124 写入灵能护罩增益",
        G.run.buffs.some(b => b.id === "灵能护罩" && b.stat === "def"));
      const bo = runBonus();
      check("五13 AT124 生效：runBonus 防御加成 > 0（+" + bo.add.def + "）", bo.add.def > 0);
      check("五14 AT124 护罩值含能量上限加成（" + bo.add.def + " > 基础 4）", bo.add.def > 4);
      check("五15 AT124 对范围内敌人造成伤害", mob.hp < mob.hpMax);

      // 防御提升真的进了队伍属性（companionStats 同源 runBonus）
      if (G.run.companions && G.run.companions.length) {
        const c = G.run.companions[0];
        const st = companionStats(c);
        check("五16 防御加成进入队友防御结算（def " + st.def + "）", st.def >= (c.heroDef.def || 0) + bo.add.def - 1e-6);
      } else {
        const cap = computeStats();
        check("五16 单英雄局：防御加成进队长 computeStats（def " + cap.def + "）",
          cap.def >= (G.run.heroDef.def || 0) + bo.add.def - 1e-6);
      }
    }
  }

  console.log(ok ? "HERO KIT TEST OK" : "HERO KIT TEST FAILED");
  if (!ok) throw new Error("HERO KIT TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
