/* 无头测试：技能表地基（单表 + cat / skillEntry 公式 + 锚点插值）+ 敌人技能表化（node skill_table_test.js）
 * 覆盖 P1「技能表地基统一」与 P2「统一执行器 + 敌人技能接入」的验收点。 */
"use strict";

/* ---- DOM / Canvas 桩 ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return () => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
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
global.window = { addEventListener() { } };
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

  /* ============ 一、锚点插值（整数离散值） ============ */
  {
    const T = { 1: 1, 25: 2, 60: 3, 100: 4 };
    check("锚点-命中最低锚点 LV1 → 1", anchorLerp(T, 1) === 1);
    check("锚点-命中中间锚点 LV25 → 2", anchorLerp(T, 25) === 2);
    check("锚点-命中中间锚点 LV60 → 3", anchorLerp(T, 60) === 3);
    check("锚点-命中最高锚点 LV100 → 4", anchorLerp(T, 100) === 4);
    check("锚点-区间插值 LV40 → 2.43 向下取整 = 2（整数锚点）", anchorLerp(T, 40) === 2,
      );
    check("锚点-区间插值 LV42 → 2.49 向下取整 = 2", anchorLerp(T, 42) === 2);
    check("锚点-LV13（1~25 之间）→ 1.5 向下取整 = 1", anchorLerp(T, 13) === 1);
    check("锚点-低于最低锚点钳制 LV0 → 1", anchorLerp(T, 0) === 1);
    check("锚点-高于最高锚点钳制 LV999 → 4", anchorLerp(T, 999) === 4);

    // 小数锚点 → 保留两位
    const F = { 1: 0.8, 50: 0.65, 100: 0.5 };
    check("锚点-小数锚点命中 LV1 → 0.8", near(anchorLerp(F, 1), 0.8));
    check("锚点-小数锚点插值 LV25 → 0.73（保留两位，非取整）", near(anchorLerp(F, 25), 0.73),
      );
    check("锚点-小数锚点不被 floor 归零", anchorLerp(F, 100) === 0.5);
  }

  /* ============ 二、公式驱动（1~100 级，连续值） ============ */
  {
    const wl = CFG.weaponLevel;
    check("曲线参数-上限 100", wl.maxLv === 100);
    // 普攻：每级 +4%
    const b1 = skillEntry("AT101", 1), b100 = skillEntry("AT101", 100);
    check("公式-普攻 LV1 伤害 = 基础值 1.0", near(b1.dmgMul, 1.0));
    check("公式-普攻 LV100 = 1.0 × (1+0.04×99) = 4.96", near(b100.dmgMul, 1 + 0.04 * 99),
      );
    // 主动技能：每级 +6%
    const s1 = skillEntry("AT102", 1), s100 = skillEntry("AT102", 100);
    check("公式-技能 LV1 伤害 = 基础值 2.5", near(s1.dmgMul, 2.5));
    check("公式-技能 LV100 = 2.5 × (1+0.06×99)", near(s100.dmgMul, 2.5 * (1 + 0.06 * 99)));
    // 等级钳制 & 非法输入
    check("公式-等级下钳制 LV0 → 视作 LV1", near(skillEntry("AT101", 0).dmgMul, 1.0));
    check("公式-等级上钳制 LV999 → 视作 LV100", near(skillEntry("AT101", 999).dmgMul, 1 + 0.04 * 99));
    check("公式-skillEntry 返回 lv 字段", skillEntry("AT101", 7).lv === 7);
    check("公式-接受技能对象入参（不限于 ID 字符串）", near(skillEntry(CFG.skills.AT101, 100).dmgMul, 4.96));
    check("公式-非法技能 ID 返回 null", skillEntry("NOPE", 1) === null);
    // 不吃等级成长的条目（敌人技能 / 增益 / 减益）
    check("公式-敌人技能不吃等级伤害成长（AT202 LV1=LV100 dmgMul）",
      near(skillEntry("AT202", 1).dmgMul, skillEntry("AT202", 100).dmgMul));
    // growth 显式覆盖
    check("公式-growth 可覆盖默认成长率（字段可缺省）",
      CFG.skills.AT101.growth === undefined && CFG.skills.AT102.growth === undefined);
  }

  /* ============ 三、召唤/陷阱：5 级数组表 → 锚点表修复点 ============ */
  {
    check("AT113 已无 lv 数组表（旧口径已清除）", CFG.skills.AT113.lv === undefined);
    check("AT113 改用 anchors 锚点表", !!CFG.skills.AT113.anchors && !!CFG.skills.AT113.anchors.count);
    const c1 = skillEntry("AT113", 1), c5 = skillEntry("AT113", 5), c100 = skillEntry("AT113", 100);
    check("AT113-LV1 无人机 3 架 / HP40 / 攻击 6",
      c1.count === 3 && c1.hp === 40 && c1.atk === 6);
    check("AT113-LV100 无人机 6 架 / HP260 / 攻击 48",
      c100.count === 6 && c100.hp === 260 && c100.atk === 48);
    // 修复的核心：旧表 5 级后数值锁死，新表 100 级仍在成长
    check("★修复-LV100 数量(6) > LV5 数量(" + c5.count + ")，不再 5 级锁死", c100.count > c5.count);
    check("★修复-LV100 攻击(48) 远高于 LV5 攻击(" + c5.atk + ")", c100.atk > c5.atk);
    check("AT113-射速为小数锚点（0.8→0.5，保留两位）",
      near(c1.fireCd, 0.8) && near(c100.fireCd, 0.5));
    // 单调不减
    let mono = true;
    for (let lv = 1; lv <= 100; lv++) {
      if (skillEntry("AT113", lv).count < skillEntry("AT113", lv - 1 || 1).count) mono = false;
      if (skillEntry("AT113", lv).atk < skillEntry("AT113", lv - 1 || 1).atk) mono = false;
    }
    check("AT113-1~100 级全区间单调不减（无回退）", mono);

    check("AT114 已无 lv 数组表", CFG.skills.AT114.lv === undefined);
    const t1 = skillEntry("AT114", 1), t50 = skillEntry("AT114", 50), t100 = skillEntry("AT114", 100);
    check("AT114-LV1 地雷 1 颗 / 伤害 2.6× / 半径 110",
      t1.count === 1 && near(t1.dmgMul, 2.6) && t1.radius === 110);
    check("AT114-LV50 命中锚点 伤害 4.0 / 半径 135", near(t50.dmgMul, 4.0) && t50.radius === 135);
    check("AT114-LV100 地雷 3 颗 / 伤害 5.5× / 半径 180",
      t100.count === 3 && near(t100.dmgMul, 5.5) && t100.radius === 180);
    check("★修复-AT114 LV100 地雷数(3) > LV5(" + skillEntry("AT114", 5).count + ")",
      t100.count > skillEntry("AT114", 5).count);
  }

  /* ============ 四、单表 + cat 分类 ============ */
  {
    const ids = Object.keys(CFG.skills);
    check("技能表单表存在（一个 CFG.skills 注册表）", ids.length >= 30);
    const badCat = ids.filter((id) => !CFG.skillCat[CFG.skills[id].cat]);
    check("每条技能都有合法 cat（无缺失/无非法值）: " + (badCat.length ? badCat.join(",") : "全部合法"),
      badCat.length === 0);
    const byCat = (c) => ids.filter((id) => CFG.skills[id].cat === c);
    check("cat=active（表 4a + 4e 视图）共 " + byCat("active").length + " 条", byCat("active").length === 25);
    check("cat=buff（表 4c 视图）4 条", byCat("buff").length === 4);
    check("cat=debuff（表 4d 视图）3 条", byCat("debuff").length === 3);
    check("cat=passive（表 4b 视图）结构就绪（当前 0 条，不预置死数据）", byCat("passive").length === 0);
    check("cat 中文标签齐全", CFG.skillCat.active === "主动" && CFG.skillCat.passive === "被动"
      && CFG.skillCat.buff === "增益" && CFG.skillCat.debuff === "减益");
    // 技能无品质维度
    check("技能无品质字段（强度只由等级决定）",
      ids.every((id) => CFG.skills[id].quality === undefined && CFG.skills[id].itemQ === undefined));
  }

  /* ============ 五、派生视图与技能表一致 ============ */
  {
    const warIds = Object.keys(CFG.skills).filter((id) => CFG.skills[id].cat === "buff" && CFG.skills[id].pool === "war");
    check("CFG.warBuffs 由技能表派生，条数一致（" + CFG.warBuffs.length + "）", CFG.warBuffs.length === warIds.length);
    check("CFG.warBuffs-id 用中文名（非 BF00x 编号）",
      CFG.warBuffs.every((b) => CFG.skillCat[b.id] === undefined && /[\\u4e00-\\u9fa5]/.test(b.id)));
    check("CFG.warBuffs 第四条 = 汲血 吸血 15%",
      CFG.warBuffs[3].id === "汲血" && near(CFG.warBuffs[3].mul, 0.15) && CFG.warBuffs[3].stat === "lifesteal");
    const dbIds = Object.keys(CFG.skills).filter((id) => CFG.skills[id].cat === "debuff" && CFG.skills[id].target === "monster");
    check("CFG.curseItems.list 由技能表派生，条数一致（" + CFG.curseItems.list.length + "）",
      CFG.curseItems.list.length === dbIds.length);
    check("诅咒道具字段齐全（defMul/hpMul/atkMul/spdMul/rewardMul）",
      CFG.curseItems.list.every((c) => c.defMul != null && c.hpMul != null && c.atkMul != null
        && c.spdMul != null && c.rewardMul != null && !!c.name && !!c.desc));
    check("铁壁诅咒 defMul=3 / rewardMul=2（与迁移前一致）",
      CFG.curseItems.list[0].defMul === 3 && CFG.curseItems.list[0].rewardMul === 2);
    check("狂暴诅咒 atkMul=1.6 / spdMul=1.25（与迁移前一致）",
      near(CFG.curseItems.list[1].atkMul, 1.6) && near(CFG.curseItems.list[1].spdMul, 1.25));
  }

  /* ============ 六、敌人技能接入（skillList + ai 校验） ============ */
  {
    const monIds = Object.keys(CFG.monsters);
    const noSkill = monIds.filter((id) => !(CFG.monsters[id].skillList && CFG.monsters[id].skillList.length));
    check("每个怪物都有 skillList（" + (noSkill.length ? noSkill.join(",") : "全部齐全") + "）", noSkill.length === 0);
    const badRef = [];
    for (const id of monIds) for (const sk of CFG.monsters[id].skillList) if (!CFG.skills[sk]) badRef.push(id + "→" + sk);
    check("skillList 引用的技能 ID 全部存在", badRef.length === 0);
    const aiMismatch = monIds.filter((id) => {
      const d = CFG.monsters[id];
      return d.skillList.some((sk) => CFG.skills[sk].ai && CFG.skills[sk].ai !== d.type);
    });
    check("敌人技能条目的 ai 与怪物 type 一致（" + (aiMismatch.length ? aiMismatch.join(",") : "全部一致") + "）",
      aiMismatch.length === 0);
    check("敌人技能条目均归类为 cat=active（表 4e 视图）",
      monIds.every((id) => CFG.monsters[id].skillList.every((sk) => CFG.skills[sk].cat === "active")));

    // 迁移彻底性：怪物表不再保留攻击参数
    const MOVED = ["fireCd", "bulletSpd", "keepDist", "chargeRange", "telegraph", "dashSpd",
      "dashTime", "chargeCd", "boomCd", "boomWarn", "boomRadius", "boomDmgMul", "minionCd",
      "minionWave", "touchCd"];
    const left = [];
    for (const id of monIds) for (const k of MOVED) if (CFG.monsters[id][k] !== undefined) left.push(id + "." + k);
    check("怪物表的攻击参数已全部迁出（" + (left.length ? left.join(",") : "零残留") + "）", left.length === 0);

    // 参数与迁移前逐项一致（防回归）
    const M = (id, lv) => monsterAttackSkill(CFG.monsters[id], lv || 1);
    const a10 = M("NM0010"), a11 = M("NM0011"), a12 = M("NM0012"), a14 = M("NM0014");
    check("NM0010 重甲兵 接触间隔 0.8 / 伤害倍率 1.0", near(a10.touchCd, 0.8) && near(a10.atkMul, 1.0));
    check("NM0011 游击弓手 fireCd 2.6 / 弹速 300 / 保持距离 280",
      near(a11.fireCd, 2.6) && near(a11.bulletSpd, 300) && near(a11.keepDist, 280));
    check("NM0012 冲锋猎犬 冲锋距离 320 / 预警 0.6 / 冲刺速 560 / 冲刺时长 0.45 / 冷却 3.0",
      near(a12.chargeRange, 320) && near(a12.telegraph, 0.6) && near(a12.dashSpd, 560)
      && near(a12.dashTime, 0.45) && near(a12.chargeCd, 3.0));
    check("NM0014 深渊狙击虫 fireCd 3.2 / 弹速 420 / 保持距离 340",
      near(a14.fireCd, 3.2) && near(a14.bulletSpd, 420) && near(a14.keepDist, 340));
    check("ED0003 裂颅追猎者 接触间隔 0.7", near(M("ED0003").touchCd, 0.7));
    const b1 = M("BS0001"), b3 = M("BS0003");
    check("BS0001 触手邪神 爆炸CD 5.0 / 预警 1.5 / 半径 230 / 伤害 2.4× / 接触 0.6×CD1.0",
      near(b1.boomCd, 5.0) && near(b1.boomWarn, 1.5) && near(b1.boomRadius, 230)
      && near(b1.atkMul, 2.4) && near(b1.touchMul, 0.6) && near(b1.touchCd, 1.0));
    check("BS0001 刷小怪 2 只/CD 8.0，BS0003 3 只/CD 6.0/半径 290/伤害 2.6×",
      b1.minionWave === 2 && near(b1.minionCd, 8.0)
      && b3.minionWave === 3 && near(b3.minionCd, 6.0) && near(b3.boomRadius, 290) && near(b3.atkMul, 2.6));
    check("共享技能条目可复用（NM0010 与 ED0001 同用 AT201）",
      CFG.monsters.NM0010.skillList[0] === CFG.monsters.ED0001.skillList[0]);
    check("敌人技能不随等级改伤害（atkMul 与 lv 无关）",
      near(M("BS0001", 1).atkMul, M("BS0001", 20).atkMul));

    // 怪物实例确实带上 ak
    const m = new Monster("NM0011", 100, 100, 1);
    check("Monster 实例挂载 ak（攻击技能参数）", !!m.ak && near(m.ak.fireCd, 2.6) && m.ak.id === "AT202");
  }

  /* ============ 七、统一执行器 SkillSystem ============ */
  {
    Game.startRun([CFG.heroes[0]]);   // W001 速射炮
    const w = { playerBullets: [], enemyBullets: [] };
    const caster = { x: 0, y: 0, atk: 10 };
    const b = resolveSkill(CFG.skills.AT101, 1, { dmgMul: 1, bullets: 0, cdMul: 1 });
    const n = SkillSystem.castBullet(w, caster, b, 0, { side: "player", isSkill: false, atk: 10 });
    check("castBullet-子弹数 = bullets（" + n + "）", n === b.bullets && w.playerBullets.length === n);
    check("castBullet-伤害 = atk × dmgMul", w.playerBullets[0].dmg === Math.max(1, Math.round(10 * b.dmgMul)));
    const bk = resolveSkill(CFG.skills.AT102, 1, { dmgMul: 1, bullets: 0, cdMul: 1 });
    w.playerBullets.length = 0;
    SkillSystem.castBullet(w, caster, bk, 0, { side: "player", isSkill: true, atk: 10 });
    check("castBullet-技能弹标记 isSkill 与 AoE 半径", w.playerBullets[0].isSkill === true && w.playerBullets[0].aoe > 0);
    const res = SkillSystem.cast(w, caster, bk, { x: 100, y: 0 }, { side: "player", isSkill: true, atk: 10 });
    check("cast-按 type 分发为 bullet", res.kind === "bullet");

    // 召唤 / 陷阱分发
    Game.startRun([CFG.heroes.find((h) => h.id === "H007")]);   // W007 无人机母舰
    recomputeWeapon();
    const r = G.run;
    const sk = r.weapon.skill;
    const rs = SkillSystem.cast({ playerBullets: [] }, { x: 500, y: 500 }, sk, null, { atk: 10 });
    check("cast-召唤技能 → drones 数量 = 技能表 count（" + r.drones.length + "/" + sk.row.count + "）",
      rs.kind === "summon" && r.drones.length === sk.row.count);
    check("召唤物攻击力由技能表 atk × summonMul 决定", r.drones[0].atk >= 1 && r.drones[0].hpMax === sk.row.hp);

    Game.startRun([CFG.heroes.find((h) => h.id === "H008")]);   // W008 布雷器
    recomputeWeapon();
    const r2 = G.run, sk2 = r2.weapon.skill;
    const rt = SkillSystem.cast({ playerBullets: [] }, { x: 500, y: 500 }, sk2, null, { atk: 10 });
    check("cast-陷阱技能 → traps 数量 = 技能表 count（" + r2.traps.length + "/" + sk2.row.count + "）",
      rt.kind === "trap" && r2.traps.length === sk2.row.count);
  }

  /* ============ 八、resolveSkill 词条标签规则不回退 ============ */
  {
    Game.startRun([CFG.heroes[0]]);   // W001
    recomputeWeapon();
    const r = G.run;
    check("普攻不吃「伤害」词条（dmgMul = 基础 × 等级曲线）",
      near(r.weapon.basic.dmgMul, 1.0 * (1 + CFG.weaponLevel.basicMulPerLv * 0)));
    check("主动技能吃「伤害」词条路径存在（AT102 含伤害标签）",
      (CFG.skills.AT102.tags || []).includes("伤害"));
    check("普攻保留了 bounce 字段（弹射次数词条叠加路径）", r.weapon.basic.bounce !== undefined);
    check("技能等级 = 武器等级（LV1 时 basic.dmgMul = 基础值）", near(r.weapon.basic.dmgMul, 1.0));
    // 升到 LV11 → 普攻 ×(1+0.04×10)=1.4，技能 ×(1+0.06×10)=1.6
    G.heroDef.weaponLv = 11;
    recomputeWeapon();
    check("LV11 普攻 dmgMul = 1.0 × 1.4 = 1.4", near(G.run.weapon.basic.dmgMul, 1.4, 1e-9));
    check("LV11 技能 dmgMul = 2.5 × 1.6 = 4.0", near(G.run.weapon.skill.dmgMul, 4.0, 1e-9));
  }

  /* ============ 九、武器栏 = 小队技能栏：武器模块对小队全体成员生效 ============
   * 术语映射：技能石 = 主动技能（绑定 CFG.weapons 里的武器）、辅助石 = 武器模块（CFG.moduleDefs，代码 module）；
   * 武器栏（4×3）即小队共用的技能栏，栏内武器模块按各成员自己武器的技能标签生效。 */
  {
    const H4 = ["H001", "H004"];   // 队长 W001（AT101 普攻 / AT102 技能）；队友 W004（AT107 普攻 / AT108 8 发）
    const team = H4.map(id => CFG.heroes.find(h => h.id === id));
    Game.startRun(team);
    const r = G.run, c = r.companions[0];
    check("全队-队友实体已创建（H004）", !!c && c.heroDef.id === "H004");
    check("全队-队友持有解析后的技能集 c.skills", !!(c.skills && c.skills.basic && c.skills.skill));
    check("全队-队友技能同样走 1~100 等级曲线（lv 字段齐备）",
      c.skills.basic.lv === 1 && c.skills.skill.lv === 1);
    check("全队-基线：队友 AT107 普攻 1 发 / AT108 技能 8 发",
      c.skills.basic.bullets === 1 && c.skills.skill.bullets === 8);

    // 武器栏（= 技能栏）放入 1 件「弹道数量 +1」武器模块
    const baseMain = r.weapon.basic.bullets, baseAllyB = c.skills.basic.bullets, baseAllyS = c.skills.skill.bullets;
    r.weaponInv.place(makeModule("M001", 0), 0, 0);
    recomputeWeapon();
    check("全队-武器模块对队长生效（普攻弹道 +1）", r.weapon.basic.bullets === baseMain + 1);
    check("全队-武器模块对队友普攻生效（弹道 +1）", c.skills.basic.bullets === baseAllyB + 1);
    check("全队-武器模块对队友主动技能生效（AT108 8→9）", c.skills.skill.bullets === baseAllyS + 1);

    // 冷却武器模块：对队友同样生效（cd 下降）
    const cdBefore = c.skills.basic.cd;
    r.weaponInv.place(makeModule("M002", 0), 0, 1);   // 冷却线圈 [2,1]，M001 下方
    recomputeWeapon();
    check("全队-冷却武器模块使队友普攻冷却下降", c.skills.basic.cd < cdBefore);

    // 端到端：队友实际开火弹数 = 解析后的 c.skills.basic.bullets（证明开火走的是解析值而非技能表原始值）
    {
      const w = G.mainWorld;
      r.companions.forEach(k => { k.fireTimer = 0; });
      w.playerBullets.length = 0;
      w.monsters.push(new Monster("NM0010", c.x + 60, c.y, 1));
      updateCompanions(w, 0.016);
      check("全队-端到端：队友开火弹数 = c.skills.basic.bullets（" + w.playerBullets.length + "/" + c.skills.basic.bullets + "）",
        w.playerBullets.length === c.skills.basic.bullets);
    }

    // 标签过滤：不是一刀切，各成员按自己武器的技能标签生效
    {
      G.team = [CFG.heroes.find(h => h.id === "H002"), CFG.heroes.find(h => h.id === "H004")];
      G.heroDef = G.team[0];                       // W002：AT104 震荡波 tags 不含「弹道数量」
      G.run = createRun(G.heroDef);
      const r2 = G.run, c2 = r2.companions[0];
      r2.weaponInv.place(makeModule("M001", 0), 0, 0);
      recomputeWeapon();
      check("标签过滤-队长 W002（无弹道标签）技能弹数不变", r2.weapon.skill.bullets === 1);
      check("标签过滤-同栏武器模块对队友 W004（含弹道标签）仍 +1", c2.skills.skill.bullets === 9);
    }

    // 等级独立：各成员按自己武器的武器等级（= 技能等级）成长，共用同一栏武器模块
    {
      const team3 = ["H001", "H004"].map(id => CFG.heroes.find(h => h.id === id));
      Game.startRun(team3);
      const r3 = G.run, c3 = r3.companions[0];
      G.heroDef.weaponLv = 11; c3.heroDef.weaponLv = 51;
      recomputeWeapon();
      check("等级独立-队长 LV11 普攻 ×(1+0.04×10) = 1.4", near(r3.weapon.basic.dmgMul, 1.4, 1e-9));
      check("等级独立-队友 LV51 用自己的曲线 ×(1+0.04×50) = 3.0", near(c3.skills.basic.dmgMul, 3.0, 1e-9));
      check("等级独立-同一栏武器模块、两人等级互不串味", !near(c3.skills.basic.dmgMul, r3.weapon.basic.dmgMul));
    }

    // 套装加成全队共享（弹道套装：M001 + M005 集齐 2 件 → 弹道 +1）
    {
      G.team = ["H001", "H004"].map(id => CFG.heroes.find(h => h.id === id));
      G.heroDef = G.team[0];
      G.run = createRun(G.heroDef);
      const r4 = G.run, c4 = r4.companions[0];
      r4.weaponInv.place(makeModule("M001", 0), 0, 0);
      r4.weaponInv.place(makeModule("M005", 1), 2, 0);
      recomputeWeapon();
      check("套装-全队共享：队友普攻 1 + 词条1 + 套装1 = 3 发", c4.skills.basic.bullets === 3);
      check("套装-队长同享同一份套装加成", r4.weapon.basic.bullets === 3);
    }

    // 术语统一：外包装名 = **武器模块**（= 流放之路的辅助石；代码标识符仍为 module）
    // 注意：现在「武器模块」本身含「模块」二字，所以残留检查只针对「辅助石 / 模组 / 装备模块」
    const svc = CFG.artisanServices;
    const stale = (s) => (s || "").indexOf("辅助石") >= 0 || (s || "").indexOf("模组") >= 0 || (s || "").indexOf("装备模块") >= 0;
    check("术语-品质强化 / 重掷词缀文案已改称「武器模块」",
      svc.qualityUp.desc.indexOf("武器模块") >= 0 && svc.rerollModule.desc.indexOf("武器模块") >= 0);
    check("术语-文案无残留「辅助石 / 模组」",
      !stale(svc.buyModule.desc) && !stale(svc.qualityUp.desc) && !stale(svc.rerollModule.desc));
    check("术语-代码标识符仍为 module（只改外包装，不动结构）",
      CFG.moduleDefs.length > 0 && CFG.moduleDefs.every(m => !!m.affix && !!m.shape));
  }

  /* ============ 十、武器栏对全队生效：装备（属性件）+ 队友主动技能 ============
   * 16.5 口径：武器栏 = 小队技能栏，栏内物品对小队全体成员生效——
   * 武器模块改技能（见第九节）、装备改属性（本节）；队友也释放自己的主动技能。 */
  {
    const team = ["H001", "H004"].map(id => CFG.heroes.find(h => h.id === id));
    Game.startRun(team);
    const w = G.mainWorld, r = G.run, c = r.companions[0];

    /* ---- 装备（属性件）对全队生效 ---- */
    check("装备-空栏时武器栏加成为 0", (() => { const g = weaponGearBonus(); return g.hp === 0 && g.def === 0 && g.atk === 0; })());
    const st0 = companionStats(c);
    r.weaponInv.place(makeGear("G002", 0), 0, 1);   // 作战背心 2×2 → hp +30
    r.weaponInv.place(makeGear("G004", 0), 2, 0);   // 装甲板 2×1 → def +3
    const g1 = weaponGearBonus(), st1 = companionStats(c);
    check("装备-武器栏加成合计正确（hp 30 / def 3）", g1.hp === 30 && g1.def === 3);
    check("装备-队友 hpMax 随装备提升（" + st0.hpMax + " → " + st1.hpMax + "）", st1.hpMax === st0.hpMax + 30);
    check("装备-队友 def 随装备提升", st1.def === (c.heroDef.def || 0) + 3);
    check("装备-队长与队友同源（computeStats 也吃同一份装备）", computeStats().def === G.heroDef.def + 3);

    // 队友承伤走装备后的防御
    const dmgIn = 20;
    c.hp = c.hpMax; const hpB = c.hp;
    heroTakeDamage(w, c, dmgIn);
    check("装备-队友承伤按装备防御减免（" + dmgIn + " − def" + st1.def + "）",
      hpB - c.hp === Math.max(1, Math.round(dmgIn - st1.def)) && st1.def > (c.heroDef.def || 0));

    // 跑一帧后队友 hpMax 与装备同步
    c.hpMax = 1;
    updateCompanions(w, 0.016);
    check("装备-队友 hpMax 每帧与武器栏同步", c.hpMax === companionStats(c).hpMax);

    /* ---- 队友释放主动技能（技能石）：队友是独立个体 → 自带独立能量池 ---- */
    w.monsters.length = 0;
    w.monsters.push(new Monster("NM0010", c.x + 60, c.y, 1));
    w.playerBullets.length = 0;
    c.fireTimer = 999; c.skillTimer = 0;            // 只让主动技能触发
    c.energy = c.energyMax;                         // 能量池：与队长同源，但各自独立
    const cs = c.skills.skill;
    const en0 = c.energy;
    updateCompanions(w, 0.016);
    check("队友技能-主动技能已释放（弹池 " + w.playerBullets.length + " / 技能弹数 " + cs.bullets + "）",
      w.playerBullets.length === cs.bullets && cs.bullets > 1);
    check("队友技能-技能弹带 AoE 标记（走的是技能分支而非普攻）",
      w.playerBullets[0].isSkill === true);
    check("队友技能-队友技能施放后进入冷却", c.skillTimer === cs.cd);
    check("队友能量-施放后扣除自己的能量（" + en0 + " → " + c.energy.toFixed(2) + "）",
      near(c.energy, Math.min(c.energyMax, en0 + companionStats(c).regen * 0.016) - (cs.energy || 0), 1e-6));

    // 能量不足 → 冷却好了也不释放
    w.playerBullets.length = 0;
    c.fireTimer = 999; c.skillTimer = 0; c.energy = Math.max(0, (cs.energy || 0) - 1);
    updateCompanions(w, 0.016);
    check("队友能量-能量不足时不释放主动技能", w.playerBullets.length === 0);

    // 能量按 regen 恢复（回复速率 = 英雄基础 + 武器栏装备 + 属性卡）
    c.energy = 0; c.fireTimer = 999; c.skillTimer = 999;
    const rg = companionStats(c).regen;
    updateCompanions(w, 1.0);
    check("队友能量-按 regen 恢复（+" + rg + "/s → " + c.energy.toFixed(2) + "）",
      near(c.energy, Math.min(c.energyMax, rg), 1e-6));

    // 普攻与技能各自独立计时：都归零且能量充足则一帧内各打一次
    w.playerBullets.length = 0;
    c.fireTimer = 0; c.skillTimer = 0; c.energy = c.energyMax;
    const cb = c.skills.basic;
    updateCompanions(w, 0.016);
    check("队友技能-普攻与技能各自独立计时（" + cb.bullets + " + " + cs.bullets + " = " + (cb.bullets + cs.bullets) + "）",
      w.playerBullets.length === cb.bullets + cs.bullets);

    // 开关：CFG.team.aiSkill = false 时队友只普攻
    const savedAi = CFG.team.aiSkill;
    CFG.team.aiSkill = false;
    w.playerBullets.length = 0;
    c.fireTimer = 0; c.skillTimer = 0; c.energy = c.energyMax;
    updateCompanions(w, 0.016);
    check("队友技能-CFG.team.aiSkill=false 时不释放主动技能", w.playerBullets.length === cb.bullets);
    CFG.team.aiSkill = savedAi;

    /* ---- 产物池：**每个成员各自独立**（召唤物 / 陷阱按 owner 隔离，互不顶替） ---- */
    Game.startRun(team);   // H001 队长（速射）+ H004 队友，两人武器都非召唤/陷阱 → 手工构造技能验证隔离
    const w2 = G.mainWorld, r2 = G.run, c2 = r2.companions[0];
    r2.drones.length = 0; r2.traps.length = 0;
    const skSummon = resolveSkill(CFG.skills.AT113, 1, { dmgMul: 1, cdMul: 1, bullets: 0 });
    const p0 = G.player;
    // 数量上限 = min(技能锚点数量, **英雄「召唤物上限」属性**)——H001/H004 上限 2 < AT113 锚点 3
    const want = unitCap(p0, "summon", skSummon.row.count);
    const wantC = unitCap(c2, "summon", skSummon.row.count);
    check("上限-非召唤师的召唤物数量被英雄属性钳制（锚点 " + skSummon.row.count + " → 实际 " + want + "）",
      want === 2 && skSummon.row.count === 3);
    // 队长先召满，再让队友召 —— 队友不该顶掉队长的编队，而是自己另起一队
    SkillSystem.cast(w2, p0, skSummon, null, { atk: 10 });
    check("产物池-队长编队 = " + want + " 架", r2.drones.filter(d => d.owner === p0).length === want);
    SkillSystem.cast(w2, c2, skSummon, null, { atk: 10 });
    check("产物池-全池 = 队长 " + want + " + 队友 " + wantC + "（互不顶替，共 " + r2.drones.length + "）",
      r2.drones.length === want + wantC && r2.drones.filter(d => d.owner === c2).length === wantC);
    check("产物池-无人机环绕各自的召唤者（owner 指向正确）",
      r2.drones.every(d => d.owner === p0 || d.owner === c2));
    // 队友再次施放只补自己那一队
    r2.drones.find(d => d.owner === c2).hp = 0;
    SkillSystem.cast(w2, c2, skSummon, null, { atk: 10 });
    check("产物池-队友补编队不影响队长那一队",
      r2.drones.filter(d => d.owner === p0).length === want && r2.drones.filter(d => d.owner === c2 && d.hp > 0).length === wantC);

    // 陷阱：上限各自独立
    r2.traps.length = 0;
    const skTrap = resolveSkill(CFG.skills.AT114, 1, { dmgMul: 1, cdMul: 1, bullets: 0 });
    const capT = unitCap(p0, "trap", skTrap.row.count);
    for (let i = 0; i < capT + 1; i++) SkillSystem.cast(w2, p0, skTrap, null, { atk: 10 });   // 队长超出自身上限
    SkillSystem.cast(w2, c2, skTrap, null, { atk: 10 });                                       // 队友布 1 颗
    check("产物池-陷阱上限各自独立（队长 " + r2.traps.filter(t => t.owner === p0).length + "/" + capT +
      "，队友 " + r2.traps.filter(t => t.owner === c2).length + "）",
      r2.traps.filter(t => t.owner === p0).length === capT && r2.traps.filter(t => t.owner === c2).length === 1);
  }

  /* ============ 十一、局内增益（属性卡 + 战争雕像 Buff）：全队生效、吸血各自独立 ============
   * 8.3 / 4.4 / 16.5 口径：属性卡与雕像 Buff 都是「本局内生效」的增益，**对小队全体成员生效**
   *（队长 + 全部 AI 队友），与武器栏装备同源；吸血归属发射者，各自独立。 */
  {
    const team = ["H001", "H004"].map(id => CFG.heroes.find(h => h.id === id));
    Game.startRun(team);
    const w = G.mainWorld, r = G.run, c = r.companions[0];

    // 基线：无卡无 Buff → 加算全 0、乘算全 1
    r.appliedCards.length = 0; r.buffs.length = 0;
    const bo0 = runBonus();
    check("增益-基线为空（add 全 0 / mul 全 1）",
      bo0.add.atk === 0 && bo0.add.hp === 0 && bo0.mul.atk === 1 && bo0.mul.cd === 1);

    // 属性卡（加算项）对全队生效
    const mAtk0 = computeStats().atk, aAtk0 = companionStats(c).atk;
    const mHp0 = computeStats().hpMax, aHp0 = companionStats(c).hpMax;
    r.appliedCards.push({ attr: "atk", q: 1, value: 7 });
    r.appliedCards.push({ attr: "hp", q: 1, value: 35 });
    check("属性卡-攻击卡对队长生效（+7）", computeStats().atk === mAtk0 + 7);
    check("属性卡-攻击卡对队友生效（+7）", companionStats(c).atk === aAtk0 + 7);
    check("属性卡-生命卡对队长生效（+35）", computeStats().hpMax === mHp0 + 35);
    check("属性卡-生命卡对队友生效（+35）", companionStats(c).hpMax === aHp0 + 35);

    // 属性卡（乘算项：攻速/冷却）对全队生效
    r.appliedCards.push({ attr: "cd", q: 2, value: 0.92 });
    check("属性卡-攻速卡乘算对队长生效（×0.92）", near(computeStats().cdMul, 0.92, 1e-9));
    check("属性卡-攻速卡乘算对队友生效（×0.92）", near(companionStats(c).cdMul, 0.92, 1e-9));

    // 属性卡：弹道数量卡（走 tagCalc，天然全队同源）
    recomputeWeapon();
    const bB = c.skills.basic.bullets, mB = r.weapon.basic.bullets;
    r.appliedCards.push({ attr: "bullets", q: 2, value: 2 });
    recomputeWeapon();
    check("属性卡-弹道数量卡对队长生效（" + mB + " → " + r.weapon.basic.bullets + "）",
      r.weapon.basic.bullets === mB + 2);
    check("属性卡-弹道数量卡对队友生效（" + bB + " → " + c.skills.basic.bullets + "）",
      c.skills.basic.bullets === bB + 2);

    // 战争雕像 Buff：乘算（攻击 ×1.3）+ 加算（吸血 +15%）对全队生效
    const baseM = G.heroDef.atk + 2 * (r.lv - 1) + weaponGearBonus().atk;
    const baseA = c.heroDef.atk + 2 * (r.lv - 1) + weaponGearBonus().atk;

    /* ---- Buff 等级（4.4）：重复触发同类 Buff **叠的是等级**，不是叠加多份效果 ---- */
    check("Buff等级-池内条目带出 skillId / stackable / maxLv",
      CFG.warBuffs.every(b => b.skillId && b.stackable !== undefined && b.maxLv > 0));
    // 效果按等级走锚点插值（狂力：Lv1 = 1.30，锚点 10 / 30 / 99）
    check("Buff等级-狂力 Lv1 效果 = 锚点 Lv1（×1.30）", near(skillEntry("BF001", 1).mul, 1.30, 1e-9));
    const e10 = skillEntry("BF001", 10).mul, e30 = skillEntry("BF001", 30).mul;
    check("Buff等级-狂力 Lv10 = 1.55 / Lv30 = 1.95（锚点命中）",
      near(e10, 1.55, 1e-9) && near(e30, 1.95, 1e-9));
    check("Buff等级-狂力 Lv20 在锚点间插值（1.55～1.95）", e10 < skillEntry("BF001", 20).mul && skillEntry("BF001", 20).mul < e30);
    check("Buff等级-迅击 cdMul 随等级下降且有下限（Lv99 = 0.34）", near(skillEntry("BF002", 99).mul, 0.34, 1e-9));
    check("Buff等级-文案随等级变化", buffEffectLabel("BF001", 1) === "攻击力 +30%" &&
      buffEffectLabel("BF001", 10) === "攻击力 +55%" && buffEffectLabel("BF002", 1) === "攻速 +30%");

    // 触发同类 Buff → 等级 +1、只保留一条、持续时间刷新；效果按新等级生效
    r.buffs.length = 0;
    const statueBuff = { type: "randomBuff", duration: 20 };
    const w2b = G.mainWorld;
    const pickSaved = U.pick;
    U.pick = () => CFG.warBuffs.find(b => b.skillId === "BF001");   // 固定抽「狂力」
    for (let i = 0; i < 3; i++) w2b.execEffect(statueBuff, { cfg: { name: "战争雕像" } });
    U.pick = pickSaved;
    check("Buff等级-触发 3 次只保留 1 条（不叠加份数）", r.buffs.length === 1);
    check("Buff等级-触发 3 次等级 = Lv3", r.buffs[0].lv === 3 && r.buffs[0].skillId === "BF001");
    check("Buff等级-等级提升后效果按新等级生效（×" + skillEntry("BF001", 3).mul.toFixed(3) + "）",
      near(runBonus().mul.atk, skillEntry("BF001", 3).mul, 1e-9) && skillEntry("BF001", 3).mul > 1.30);
    r.buffs[0].remain = 5;
    U.pick = () => CFG.warBuffs.find(b => b.skillId === "BF001");
    w2b.execEffect(statueBuff, { cfg: { name: "战争雕像" } });
    U.pick = pickSaved;
    check("Buff等级-重复触发刷新持续时间（5s → 20s）", r.buffs[0].remain === 20 && r.buffs[0].lv === 4);
    // 等级上限夹紧
    r.buffs[0].lv = CFG.warBuffs.find(b => b.skillId === "BF001").maxLv;
    U.pick = () => CFG.warBuffs.find(b => b.skillId === "BF001");
    w2b.execEffect(statueBuff, { cfg: { name: "战争雕像" } });
    U.pick = pickSaved;
    check("Buff等级-等级上限夹紧（不超 maxLv）", r.buffs[0].lv === CFG.warBuffs.find(b => b.skillId === "BF001").maxLv);
    // stackable=false 的 Buff：只刷新时间、不升级
    const savedStack = CFG.skills.BF001.stackable;
    CFG.skills.BF001.stackable = false;
    CFG.warBuffs = Object.keys(CFG.skills)
      .filter((id) => CFG.skills[id].cat === "buff" && CFG.skills[id].pool === "war")
      .map((id) => { const s = CFG.skills[id]; return { skillId: id, id: s.name, stat: s.stat, mul: s.mul, label: s.label,
        stackable: s.stackable != null ? s.stackable : CFG.buffLevel.stackable, maxLv: s.maxLv || CFG.buffLevel.maxLv,
        stackPerTrigger: s.stackPerTrigger || CFG.buffLevel.stackPerTrigger }; });
    r.buffs.length = 0;
    U.pick = () => CFG.warBuffs.find(b => b.skillId === "BF001");
    w2b.execEffect(statueBuff, { cfg: { name: "战争雕像" } });
    w2b.execEffect(statueBuff, { cfg: { name: "战争雕像" } });
    U.pick = pickSaved;
    check("Buff等级-stackable=false 只刷新时间不升级", r.buffs.length === 1 && r.buffs[0].lv === 1 && r.buffs[0].remain === 20);
    CFG.skills.BF001.stackable = savedStack;
    CFG.warBuffs = Object.keys(CFG.skills)
      .filter((id) => CFG.skills[id].cat === "buff" && CFG.skills[id].pool === "war")
      .map((id) => { const s = CFG.skills[id]; return { skillId: id, id: s.name, stat: s.stat, mul: s.mul, label: s.label,
        stackable: s.stackable != null ? s.stackable : CFG.buffLevel.stackable, maxLv: s.maxLv || CFG.buffLevel.maxLv,
        stackPerTrigger: s.stackPerTrigger || CFG.buffLevel.stackPerTrigger }; });
    r.buffs.length = 0;   // 清掉 Buff 等级段的残留，重新按 Lv1 基线验证效果
    r.buffs.push({ skillId: "BF001", id: "狂力", lv: 1, remain: 20 });
    r.buffs.push({ skillId: "BF004", id: "汲血", lv: 1, remain: 20 });
    check("Buff-攻击乘算对队长生效（(基础+卡)×1.3）", computeStats().atk === Math.round(baseM * 1.3 + 7));
    check("Buff-攻击乘算对队友生效（(基础+卡)×1.3）", companionStats(c).atk === Math.round(baseA * 1.3 + 7));
    check("Buff-吸血对队长生效（+0.15）", near(computeStats().lifesteal, 0.15, 1e-9));
    check("Buff-吸血对队友生效（+0.15）", near(companionStats(c).lifesteal, 0.15, 1e-9));

    // 增益真正作用到队友的施放上：实际冷却 = 技能 cd × cdMul（不只是面板）
    w.monsters.length = 0;
    w.monsters.push(new Monster("NM0010", c.x + 60, c.y, 1));
    w.playerBullets.length = 0;
    c.fireTimer = 999; c.skillTimer = 0;
    updateCompanions(w, 0.016);
    const cdM = companionStats(c).cdMul, rawCd = c.skills.skill.cd;
    check("队友冷却-实际冷却 = 技能 cd × cdMul（" + c.skillTimer.toFixed(3) + "）",
      near(c.skillTimer, rawCd * cdM, 1e-9));
    check("队友冷却-增益生效后冷却短于原始值", c.skillTimer < rawCd);

    // 吸血归属：各自回自己的血（子弹记住发射者）
    const t1 = new Monster("NM0010", c.x + 40, c.y, 1);
    t1.hp = 9999; t1.hpMax = 9999;                 // 靶子：不会被一发打死
    w.monsters.length = 0; w.monsters.push(t1);
    w.monsterHash.clear();
    for (const m of w.monsters) if (!m.dead) w.monsterHash.insert(m, m.x, m.y, m.r);
    r.hpMax = 1000; r.lifesteal = computeStats().lifesteal;
    // ① 队友子弹命中 → 回队友自己，队长血量不动
    c.hp = 5; const mHpBefore = r.hp;
    w.playerBullets.length = 0;
    SkillSystem.castBullet(w, c, c.skills.basic, 0, { side: "player", isSkill: false, atk: 20 });
    const bl = w.playerBullets[0];
    check("吸血-子弹记住了发射者（队友）", bl.owner === c);
    bl.x = t1.x; bl.y = t1.y;
    bl.update(w, 0.0001);
    check("吸血-队友命中回队友自己的血（5 → " + c.hp + "）", c.hp > 5);
    check("吸血-队友吸血不影响队长血量", r.hp === mHpBefore);
    // ② 队长子弹命中 → 回队长自己，队友血量不动
    r.hp = 5; const cHpBefore = c.hp;
    w.playerBullets.length = 0;
    SkillSystem.castBullet(w, G.player, r.weapon.basic, 0, { side: "player", isSkill: false, atk: 20 });
    const bm = w.playerBullets[0];
    check("吸血-子弹记住了发射者（队长）", bm.owner === G.player);
    bm.x = t1.x; bm.y = t1.y;
    bm.update(w, 0.0001);
    check("吸血-队长命中回队长自己的血（5 → " + r.hp + "）", r.hp > 5);
    check("吸血-队长吸血不影响队友血量", c.hp === cHpBefore);
  }

  /* ============ 十二、召唤物上限 / 陷阱数量上限（英雄属性，限制该类型技能的上限） ============
   * 数值口径：两个上限是**英雄属性**，走完整属性管线（英雄基础值 + 武器栏装备 + 局内增益）；
   * 实际上限 = min(技能锚点数量, 英雄该属性)——技能等级决定「想召几架」，英雄属性决定「最多几架」。
   * 归属：无人机**随召唤者**、陷阱**留原地**、召唤者倒下**不回收**。 */
  {
    check("上限-英雄表带 summonMax / trapMax 字段",
      CFG.heroes.every(h => h.summonMax != null && h.trapMax != null));
    check("上限-召唤师上限 6 = AT113 满级锚点数（唯一能拉满编队的英雄）",
      CFG.heroes.find(h => h.id === "H007").summonMax === 6 && CFG.skills.AT113.anchors.count[100] === 6);
    check("上限-陷阱师上限 3 = AT114 满级锚点数",
      CFG.heroes.find(h => h.id === "H008").trapMax === 3 && CFG.skills.AT114.anchors.count[100] === 3);

    // 召唤师 H007：锚点数量 3 ≤ 上限 6 → 不被钳制
    Game.startRun([CFG.heroes.find(h => h.id === "H007")]);
    const r1 = G.run, w1 = G.mainWorld, p1 = G.player;
    r1.drones.length = 0;
    const sk1 = resolveSkill(CFG.skills.AT113, 1, { dmgMul: 1, cdMul: 1, bullets: 0 });
    const u1 = SkillSystem.cast(w1, p1, sk1, null, { atk: 10 });
    check("上限-召唤师不被钳制（" + u1.n + "/" + u1.cap + "）", u1.n === 3 && u1.cap === 3);
    // 队友（H007 以外）上限低 → 同样的技能只召得出上限内数量
    Game.startRun([CFG.heroes.find(h => h.id === "H007"), CFG.heroes.find(h => h.id === "H006")]);
    const r2b = G.run, w2b = G.mainWorld, c2b = r2b.companions[0];
    r2b.drones.length = 0;
    const u2 = SkillSystem.cast(w2b, c2b, sk1, null, { atk: 10 });
    check("上限-队友按自己的英雄上限钳制（H006 上限 1 → " + u2.n + "/" + u2.cap + "）", u2.n === 1 && u2.cap === 1);
    r2b.drones.length = 0;

    // 走属性管线：武器栏装备 / 局内增益可抬高上限（同能量上限口径）
    Game.startRun([CFG.heroes.find(h => h.id === "H008")]);
    const r3 = G.run, w3 = G.mainWorld, p3 = G.player;
    r3.traps.length = 0;
    check("上限-基线（H008 陷阱上限 3）", unitLimitOf(p3, "trap") === 3);
    r3.weaponInv.place(makeGear("G002", 0), 0, 1);      // 普通装备（无 summonMax/trapMax 词条）不应误加上限
    check("上限-普通装备不影响上限", unitLimitOf(p3, "trap") === 3);
    r3.appliedCards.push({ attr: "trapMax", q: 0, value: 2 });   // 手造一张「陷阱上限 +2」卡（属性卡管线）
    recomputeWeapon();
    check("上限-局内增益（属性卡）可抬高上限（3 → " + unitLimitOf(p3, "trap") + "）", unitLimitOf(p3, "trap") === 5);
    const u3 = SkillSystem.cast(w3, p3, resolveSkill(CFG.skills.AT114, 1, { dmgMul: 1, cdMul: 1, bullets: 0 }), null, { atk: 10 });
    check("上限-抬高后仍受技能锚点钳制（min(锚点 " + CFG.skills.AT114.anchors.count[1] + ", 上限 5)）",
      u3.cap === CFG.skills.AT114.anchors.count[1]);
    r3.appliedCards.length = 0; r3.traps.length = 0;
    recomputeWeapon();

    // 上限为 0 → 该类型技能不产出（且不能死循环）
    Game.startRun([CFG.heroes.find(h => h.id === "H008")]);
    const r4 = G.run, w4 = G.mainWorld, p4 = G.player;
    r4.traps.length = 0;
    r4.heroDef.trapMax = 0;                       // heroDef 是 applyOutLevel 的副本，改它不污染 CFG
    const u4 = SkillSystem.cast(w4, p4, resolveSkill(CFG.skills.AT114, 1, { dmgMul: 1, cdMul: 1, bullets: 0 }), null, { atk: 10 });
    check("上限-上限为 0 时陷阱不产出（不卡死）", u4.cap === 0 && r4.traps.length === 0);
    r4.heroDef.trapMax = 3;

    // 归属规则：无人机随召唤者；召唤者倒下**不回收**（继续留在场上）
    Game.startRun([CFG.heroes.find(h => h.id === "H007"), CFG.heroes.find(h => h.id === "H001")]);
    const r5 = G.run, w5 = G.mainWorld, c5 = r5.companions[0];
    r5.drones.length = 0;
    w5.monsters.length = 0; w5.circles.length = 0; r5.bossDefeated = true;   // 静场：不让刷怪/弹幕干扰归属断言
    const u5 = SkillSystem.cast(w5, c5, sk1, null, { atk: 10 });
    check("归属-无人机归属召唤者（owner = 该队友）", r5.drones.every(d => d.owner === c5) && u5.n === 2);
    r5.drones.forEach(d => { d.hp = 9999; });      // 只验证「回收」，排除被击毁的干扰
    c5.alive = false; c5.hp = 0;                  // 召唤者倒下
    const nBefore = r5.drones.length;
    for (let i = 0; i < 20; i++) w5.update(0.05);  // 推进 1 秒
    check("归属-召唤者倒下不回收无人机（" + nBefore + " → " + r5.drones.length + "）",
      r5.drones.length === nBefore && r5.drones.filter(d => d.owner === c5).length === nBefore);
    r5.drones.length = 0;

    // 陷阱留原地：布设后移动，陷阱坐标不变、且与布设者脱钩
    Game.startRun([CFG.heroes.find(h => h.id === "H008")]);
    const r6 = G.run, w6 = G.mainWorld, p6 = G.player;
    r6.traps.length = 0;
    SkillSystem.cast(w6, p6, resolveSkill(CFG.skills.AT114, 1, { dmgMul: 1, cdMul: 1, bullets: 0 }), null, { atk: 10 });
    const t6 = r6.traps[0], tx6 = t6.x, ty6 = t6.y;
    p6.x += 400; p6.y += 400;
    for (let i = 0; i < 10; i++) w6.update(0.02);
    check("归属-陷阱留在原地（布设者走开坐标不变）", r6.traps[0] === t6 && t6.x === tx6 && t6.y === ty6);
    r6.traps.length = 0;
  }

  /* ============ 十三、判定圈统一：任一英雄可触发 + 同一判定不可同时触发 ============
   * 规则：①所有英雄都是独立个体，任一存活英雄在圈内都能推进判定（不限队长）；
   *       ②同一判定是**单一实例**（单一进度 + 单一持有者）——多人同圈不会加速、也不会各触发一次；
   *       ③判定完成即被消费（雕像移除 / 读条完成），第二个英雄不可能再触发同一个判定；
   *       ④圈内英雄全部离开 → 进度缓慢衰退（裂缝返回信标 decay=0 例外）。 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    const w = G.mainWorld, r = G.run, c = r.companions[0];
    // 静场：清怪 + 停刷怪（bossDefeated 为 true 后主地图不再补投），只验证判定圈本身
    w.monsters.length = 0; w.circles.length = 0; r.bossDefeated = true;
    r.hp = 1e6; c.hp = 1e6;
    // 触发计数：只统计本测试的两座雕像，屏蔽随机祭坛的干扰
    let fired = 0;
    const origTrigger = w.triggerAltar.bind(w);
    w.triggerAltar = (a) => { if (a.id === "TEST_ALTAR" || a.id === "TEST_ALTAR2") fired++; return origTrigger(a); };
    // 造一座测试祭坛（战争雕像），放在远离随机祭坛的位置
    const altar = { cfg: { name: "测试雕像", color: "#7de08a", icon: "◆", radius: 90, channel: 2.0, effects: [{ type: "buff", stat: "atk", mul: 1.2, dur: 20 }] }, x: 300, y: 1500, id: "TEST_ALTAR", progress: 0 };
    w.altars.length = 0; w.altars.push(altar);
    G.player.x = 5000; G.player.y = 5000;          // 队长远离
    c.x = altar.x; c.y = altar.y;                   // 只有队友在圈内

    check("判定圈-判定半径按 altarJudgeMul 外扩（heroInCircle 命中队友）",
      heroInCircle(altar.x, altar.y, altar.cfg.radius) === c);
    // 只有队友在圈：进度正常推进（任一英雄都能触发）
    const p0 = altar.progress;
    w.update(0.5);
    check("判定圈-队友在圈内即可推进（不限队长）：" + p0 + " → " + altar.progress, altar.progress === p0 + 0.5);
    check("判定圈-持有者被记为触发者（原子占用）", altar.holder === c);

    // 多个英雄同圈：进度**不加速**（单一进度，不是每人一份）
    G.player.x = altar.x; G.player.y = altar.y + 20;   // 队长也进圈（同处一个判定圈）
    const pBefore = altar.progress;
    w.update(0.5);
    check("判定圈-两名英雄同圈不加速（+0.5s 而非 +1.0s）：" + pBefore + " → " + altar.progress,
      Math.abs(altar.progress - (pBefore + 0.5)) < 1e-9);

    // 判定完成 → 立即消费（雕像移除），不可能被第二个英雄重复触发
    w.update(2.0);
    check("判定圈-读条完成后雕像即被移除（判定被消费）", w.altars.indexOf(altar) < 0);
    check("判定圈-只触发一次（fired = " + fired + "）", fired === 1);
    check("判定圈-消费后进度归零（不会残留给第二个英雄）", altar.progress === 0 && altar.holder === null);
    w.update(1.0);
    check("判定圈-雕像已移除，第二人同圈也不会再触发（fired = " + fired + "）", fired === 1);

    // 离开圈 → 进度缓慢衰退（不是瞬间清零）
    const a2 = { cfg: { name: "测试雕像2", color: "#7de08a", icon: "◆", radius: 90, channel: 3.0, effects: [{ type: "buff", stat: "atk", mul: 1.2, dur: 20 }] }, x: 600, y: 1500, id: "TEST_ALTAR2", progress: 0 };
    w.altars.push(a2);
    G.player.x = a2.x; G.player.y = a2.y; c.x = 5000; c.y = 5000;
    w.update(1.0);
    const pa = a2.progress;
    G.player.x = 5000; G.player.y = 5000;          // 全员离开
    w.update(0.5);
    check("判定圈-离开圈进度缓慢衰退（1.2 倍速）：" + pa + " → " + a2.progress,
      near(a2.progress, pa - 0.5 * 1.2, 1e-9) && a2.progress > 0);
    check("判定圈-全员离开后持有者清空", a2.holder === null);
    w.update(3.0);
    check("判定圈-衰退到 0 为止（不会变负）", a2.progress === 0);
    w.altars.length = 0;
  }

  console.log(ok ? "SKILL TABLE TEST OK" : "SKILL TABLE TEST FAILED");
  if (!ok) throw new Error("SKILL TABLE TEST FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
