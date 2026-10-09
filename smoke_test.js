/* 无头逻辑冒烟测试（node smoke_test.js） */
"use strict";
global.window = { addEventListener() { } };
global.document = {
  getElementById() { return { classList: { add() { }, remove() { }, toggle() { } }, style: {}, appendChild() { }, innerHTML: "" }; },
  createElement() { return { style: {}, classList: { add() { }, remove() { }, toggle() { } }, appendChild() { }, querySelector() { return null }, dataset: {} }; },
  addEventListener() { }
};
global.requestAnimationFrame = () => { };
global.UI = new Proxy({}, { get: () => () => { } });   // game.js 运行时引用 UI，桩化
global.EventBus = undefined;
const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
vm.runInContext(`
  G.levelCfg = CFG.levels[0];
  G.heroDef = CFG.heroes[0];
  G.player = { x:960, y:540 };
  G.sprites = {};
  const run = createRun(G.heroDef); G.run = run;
  // 1) 背包放置/叠加
  const c1 = makeChestItem("normal"), c2 = makeChestItem("normal");
  let s = run.backpack.findSpot(c1);
  console.assert(run.backpack.place(c1, s.x, s.y), "place c1");
  console.assert(run.backpack.tryStackChest(c2), "stack c2");
  console.assert(run.backpack.items.length === 1 && run.backpack.items[0].count === 2, "stack count");
  console.assert(Math.abs(run.backpack.totalWeight() - 16) < 1e-6, "chest weight x2 = 16");
  console.assert(run.backpack.items[0].value === 40, "叠加后宝箱价值同步 x2=40, got " + run.backpack.items[0].value);
  // 2) 武器栏模块词条（先加算后乘算 16.5）
  const m1 = makeModule("M002", 1);
  console.assert(run.weaponInv.place(m1, 0, 0), "place module");
  const cd = tagCalc("冷却");
  console.assert(Math.abs(cd - 0.88) < 1e-6, "冷却 tagCalc 0.88, got " + cd);
  run.weaponInv.place(makeModule("M002", 2), 2, 0);
  const cd2 = tagCalc("冷却");
  console.assert(Math.abs(cd2 - (0.88*0.84)) < 1e-6, "冷却乘算叠加, got " + cd2);
  console.assert(tagCalc("弹道数量") === 1, "弹道数量默认 1");
  run.weaponInv.place(makeModule("M001", 3), 0, 1);
  run.weaponInv.place(makeModule("M001", 3), 1, 1);
  console.assert(tagCalc("弹道数量") === 3, "弹道数量 1+2=3, got " + tagCalc("弹道数量"));
  // 3) 负重惩罚（9.2 线性）：用 5 普通箱 + 5 史诗箱堆叠 → 5*(8+18)=130 超阈值
  run.weaponInv.place(makeModule("M006", 0), 0, 2);
  const wf = weightFactor();
  console.assert(!wf.over && wf.f === 1, "未超重 w=" + wf.w);
  run.backpack = new Inventory(6, 4, "backpack");
  for (let i = 0; i < 5; i++) { console.assert(run.backpack.tryStackChest(makeChestItem("normal")) || run.backpack.place(makeChestItem("normal"), 0, i % 4 === 0 ? 0 : 0), "stack normal"); }
  // 直接构造两堆
  run.backpack = new Inventory(6, 4, "backpack");
  const stackN = makeChestItem("normal"); stackN.count = 5; stackN.value = 8 * 5;
  const stackE = makeChestItem("epic"); stackE.count = 5; stackE.value = 18 * 5;
  run.backpack.place(stackN, 0, 0); run.backpack.place(stackE, 1, 0);
  const wf2 = weightFactor();
  console.assert(wf2.over, "超重生效 w=" + wf2.w + " f=" + wf2.f);
  console.assert(wf2.f >= 0.2, "移速下限 20%");
  console.assert(Math.abs(wf2.f - Math.max(0.2, 1 - 0.8 * (wf2.w - 100) / 100)) < 1e-6, "线性惩罚公式一致, got " + wf2.f);
  // 4) 死亡惩罚：宝箱全损 + 装备约70%价值
  run.backpack.place(makeGear("G002", 3), 0, 1);
  run.weaponInv.place(makeGear("G004", 2), 3, 0);
  const pen = calcDeathPenalty(run);
  console.assert(pen.lost.filter(i => i.kind === "chest").length >= 1, "宝箱全损");
  console.assert(pen.lostValue >= pen.totalValue * 0.69, "损失>=70%: lost=" + pen.lostValue + " total=" + pen.totalValue);
  // 5) 世界构建 & 祭坛（26.x：主关卡开局不再随机刷 5 座，改 altarTimeline 时间轴到点投放）
  G.mainWorld = new World(1920,1080,true);
  console.assert(G.mainWorld.monsters.length > 0, "初始刷怪");
  console.assert(G.mainWorld.altars.length === 0, "开局祭坛为 0（改时间轴投放）");
  // 冻结期不计时 → 推进到首个投放点才落地
  G.levelCfg = CFG.levels[0];
  G.mainWorld.freezeTimer = 0;
  updateAltarTimeline(G.mainWorld, CFG.levels[0].altarTimeline[0].t + 0.1);
  console.assert(G.mainWorld.altars.length === 1, "时间轴到点投放 1 座祭坛, got " + G.mainWorld.altars.length);
  for (const a of G.mainWorld.altars)
    console.assert(!G.mainWorld.obstacles.some(o => a.x>o.x-60 && a.x<o.x+o.w+60 && a.y>o.y-60 && a.y<o.y+o.h+60), "祭坛不与障碍重叠（净空60）");
  // 6) 工匠世界
  const aw = new World(1920,1080,false);
  console.assert(aw.npc && aw.exitBeacon && aw.monsters.length===0, "工匠世界安全区");
  // 7) 击杀→进度/Boss/工匠雕像触发（雕像改由「雕像池」投放：触发条件投配额 + 限制器决定落地）
  G.mainWorld.boss = null;
  G.run.kills = CFG.levels[0].artisanAtKills;
  onMonsterKilled(G.mainWorld, { x:500, y:500, d: CFG.monsters.NM0010, dead:true });
  // 推进池逻辑：触发条件在池更新时结算 → 配额 → 随机延迟 → 落地（压缩延迟，避免依赖随机时长）
  updateArtisanPool(G.mainWorld, 0);
  console.assert(G.run.artisanPool.quota >= 1, "击杀里程碑把配额投进雕像池");
  console.assert(G.mainWorld.altars.every(a => a.id !== "ALTAR_005"), "配额未就绪时雕像不直接落地（限制器：延迟投放）");
  G.run.artisanPool.readyAt = 0;
  updateArtisanPool(G.mainWorld, 0.1);
  console.assert(G.run.artisanSpawned && G.mainWorld.altars.some(a=>a.id==="ALTAR_005"), "配额经限制器落地为工匠雕像");
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x:500, y:500, d: CFG.monsters.NM0010, dead:true });
  console.assert(G.run.bossSpawned && G.mainWorld.boss, "进度满触发 Boss");
  console.assert(G.run.stats && G.run.stats.timeToBoss === G.run.runTime, "Boss 出现时记录 timeToBoss（结算 Boss 耗时依赖）");
  // 8) Boss 击败 → 死亡位置生成撤离点雕像（5.2 按文档定稿）
  G.mainWorld.boss.dead = true; G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 400;
  G.mainWorld.monsters = G.mainWorld.monsters.filter(m => !m.dead);
  const _rtBak = G.run.runTime;
  G.run.runTime = _rtBak + 12;             // 模拟 Boss 战耗时 12 秒
  onBossDefeated(G.mainWorld);
  console.assert(G.run.stats.bossFightTime === 12, "Boss 耗时按 出现→击杀 计算，got " + G.run.stats.bossFightTime);
  G.run.runTime = _rtBak;
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 800 && G.run.exitStatue.y === 400, "Boss 击败在死亡位置生成撤离点雕像");
  console.assert(CFG.extract.channel === 8.0, "撤离读条 8 秒");
  // 9) 局外元进度：结晶 / 局外等级 / 出战加成
  console.assert(typeof Meta.data.crystals === "number", "Meta 默认数据");
  Meta.data.crystals = 0;
  console.assert(Meta.awardRun(10, true, true) === 60, "撤离结晶 = 仅Boss结晶60（20.10 配平）, got " + Meta.awardRun(0, false, true));
  console.assert(Meta.data.crystals === 60, "结晶入账 60, got " + Meta.data.crystals);
  console.assert(Meta.awardRun(10, true, false) === 18, "死亡结晶 30% = 18");
  console.assert(Meta.levelUpCost("H001") === 50, "LV1→2 消耗 50");
  Meta.data.crystals = 0;
  console.assert(!Meta.levelUp("H001"), "结晶不足不能升级");
  Meta.data.crystals = 100;
  console.assert(Meta.levelUp("H001"), "升级成功");
  console.assert(Meta.heroLevel("H001") === 2, "局外等级 2");
  console.assert(Meta.levelUpCost("H001") === 65, "LV2→3 消耗 65");
  const _h001hp = CFG.heroes[0].hp;                 // 快照：applyOutLevel 必须产出副本、不写回 CFG
  const boosted = applyOutLevel(CFG.heroes[0]);
  console.assert(boosted.hp === CFG.heroes[0].hp + 8 && boosted.atk === CFG.heroes[0].atk + 2
    && boosted.def === CFG.heroes[0].def + 1 && boosted.outLevel === 2, "局外加成生效");
  console.assert(CFG.heroes[0].hp === _h001hp, "CFG 原表不被污染");
  // 9b) 武器/技能等级（局外结晶升级；技能等级 = 武器等级；上限 100，公式曲线）
  console.assert(CFG.weaponLevel.maxLv === 100, "武器/技能等级上限 = 100");
  console.assert(Meta.weaponLv("H001") === 1, "武器初始 LV1");
  console.assert(Meta.weaponUpCost("H001") === weaponLevelEntry(1).cost, "LV1→2 消耗 = 曲线值");
  console.assert(weaponLevelEntry(1).cost === 120 && weaponLevelEntry(2).cost === 130,
    "成本曲线 120 → 130（×1.05 取整到 10），got " + weaponLevelEntry(1).cost + "/" + weaponLevelEntry(2).cost);
  console.assert(Meta.weaponUp("H001") && Meta.weaponLv("H001") === 2, "武器升级成功（永久资产）");
  const skBoosted = applyOutLevel(CFG.heroes[0]);
  console.assert(skBoosted.weaponLv === 2 && skBoosted.outSkillLv === 2, "出战副本带武器等级");
  // 武器等级伤害走曲线（技能 dmgMul × skillMul；普攻 × basicMul）
  // 注：清空武器栏模组，避免模组连接/套装（16.7）加成混入本断言
  G.run = run; G.heroDef = skBoosted;
  run.weaponInv.items.length = 0;
  const baseDmg = CFG.skills[CFG.weapons[skBoosted.weapon].skills.skill].dmgMul;
  const baseBasic = CFG.skills[CFG.weapons[skBoosted.weapon].skills.basic].dmgMul;
  recomputeWeapon();
  const lv2 = weaponLevelEntry(2);
  console.assert(Math.abs(G.run.weapon.skill.dmgMul - baseDmg * lv2.skillMul) < 1e-6,
    "技能 LV2 伤害走曲线 ×" + lv2.skillMul + ", got " + G.run.weapon.skill.dmgMul);
  console.assert(Math.abs(G.run.weapon.basic.dmgMul - baseBasic * lv2.basicMul) < 1e-6,
    "普攻 LV2 伤害走曲线 ×" + lv2.basicMul);
  console.assert(Meta.weaponLv("H001") === 2 && Meta.weaponUpCost("H001") === weaponLevelEntry(2).cost, "LV2→3 消耗 = 曲线值");
  // 曲线边界：满级不再可升、成本为 0；100 级倍率 = 1 + 每级增量 × 99
  const lvMax = weaponLevelEntry(CFG.weaponLevel.maxLv);
  console.assert(lvMax.cost === 0 && weaponLevelEntry(999).lv === CFG.weaponLevel.maxLv, "满级/越界等级安全");
  console.assert(Math.abs(lvMax.basicMul - (1 + 0.04 * 99)) < 1e-9 && Math.abs(lvMax.skillMul - (1 + 0.06 * 99)) < 1e-9,
    "100 级倍率符合线性曲线，got basic=" + lvMax.basicMul + " skill=" + lvMax.skillMul);
  // 10) 属性卡牌（8.3：升级获得资产 / 工匠世界使用 / 同属性去重）
  console.assert(run.cardAssets === 0 && run.cardRefresh === CFG.cardPool.refreshPerRun && run.appliedCards.length === 0, "卡牌初始状态");
  run.exp = 999; gainExp(0);
  console.assert(run.lv > 1 && run.cardAssets === 0, "19.7 升级不再发卡（cardAssets 恒 0）, lv=" + run.lv);
  console.assert(runBonus().add.hp === CFG.levelUp.baseStatGain.hp * (run.lv - 1), "19.4 升级即时属性按级成长");
  // 候选抽取：内无重复属性、数量正确
  let cands = drawCardCandidates();
  console.assert(cands.length === CFG.cardPool.candidateCount, "候选 3 张");
  console.assert(new Set(cands.map(c => c.attr)).size === cands.length, "候选内属性去重");
  for (const c of cands) console.assert(c.value === CFG.cardPool.attrs[c.attr].flat[c.q], "品质对应数值");
  // 工匠世界限制
  G.inArtisan = false;
  console.assert(!useCard(0), "非工匠世界不能用卡");
  console.assert(!refreshCards(), "非工匠世界不能刷新");
  G.inArtisan = true;
  // 使用卡牌：19.7 卡牌退役——升级不发卡，cardAssets 恒 0 → useCard 恒 false（逻辑保留供回退）
  run.cardCandidates = drawCardCandidates();
  console.assert(useCard(0) === false, "无资产时不能使用卡（19.7 恒 0）");
  console.assert(run.cardAssets === 0, "资产保持 0");
  console.assert(run.appliedCards.length === 0, "无已用记录");
  if (CFG.cardPool.dedupApplied) {
    const used = new Set(run.appliedCards.map(c => c.attr));
    for (let i = 0; i < 20; i++) {
      const cs = drawCardCandidates();
      console.assert(cs.every(c => !used.has(c.attr)), "已用属性不再出现（去重）");
    }
  }
  // 数值注入：攻/弹道/冷却卡对 computeStats 与 tagCalc 生效
  run.appliedCards.length = 0;
  const atkBase = computeStats().atk;
  run.appliedCards.push({ attr: "atk", q: 0, value: 5 });
  console.assert(computeStats().atk === atkBase + 5, "攻击卡 +5 生效");
  const hpBase = computeStats().hpMax;
  run.appliedCards.push({ attr: "hp", q: 0, value: 30 });
  console.assert(computeStats().hpMax === hpBase + 30, "生命卡 +30 生效");
  const bulletsBase = tagCalc("弹道数量");
  run.appliedCards.push({ attr: "bullets", q: 0, value: 1 });
  console.assert(tagCalc("弹道数量") === bulletsBase + 1, "弹道卡 +1 生效");
  run.appliedCards.push({ attr: "cd", q: 0, value: 0.96 });
  console.assert(Math.abs(computeStats().cdMul - 0.96) < 1e-6, "冷却卡乘算生效");
  run.appliedCards.push({ attr: "lifesteal", q: 0, value: 0.02 });
  console.assert(Math.abs(computeStats().lifesteal - 0.02) < 1e-6, "吸血卡生效");
  // 刷新次数（规则2：免费次数优先，用完后扣金币；金币不足则失败）
  run.cardRefresh = 1;
  console.assert(refreshCards() && run.cardRefresh === 0, "刷新 -1");
  run.coin = 0;
  console.assert(!refreshCards(), "免费耗尽且金币不足不能刷新");
  G.inArtisan = false;
  // 11) 批次 B：关卡扩展（关卡配置完整性 + 解锁链）
  // ⚠️ B 线「关卡 3→10 铺量」需求变更：关卡总数由 3 扩为 10，此处期望值同步更新（非放松断言）。
  // ⚠️ 第 11~20 关扩展批：关卡总数由 10 扩为 20，期望值同步更新（非放松断言）。
  console.assert(CFG.levels.length === 20, "20 个关卡");
  for (let i = 1; i < CFG.levels.length; i++) {
    const lv = CFG.levels[i];
    console.assert(lv.mapW > 0 && lv.progressGoal > 0 && lv.timeLimit > 0, "关卡" + (i + 1) + " 基础字段");
    console.assert(lv.mapW === lv.mapH, "关卡" + (i + 1) + " 地图为正方形");
    console.assert(CFG.monsters[lv.boss] && CFG.monsters[lv.boss].type === "boss", "关卡" + (i + 1) + " Boss " + lv.boss + " 已定义");
    console.assert(lv.circles.every(c => CFG.spawnCircles[c.tpl]), "关卡" + (i + 1) + " 圆模板已定义");
  }
  // 12) 批次 B：角色 2~6 武器绑定（基础值来自各自武器技能；先重置词条环境避免串扰）
  run.weaponInv = new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon");
  run.appliedCards.length = 0;
  // 26.x 12 角重做：远程英雄各挂专属弹道普攻；近战英雄（H005 快枪手 / H006 重炮手）统一挂 AT121 近战挥砍
  const heroWeaponChecks = { H002: ["AT103", 3], H003: ["AT105", 2], H004: ["AT107", 2], H005: ["AT121", 1], H006: ["AT121", 1] };
  for (const [hid, [skId, baseBullets]] of Object.entries(heroWeaponChecks)) {
    const h = CFG.heroes.find(x => x.id === hid);
    console.assert(h && CFG.weapons[h.weapon].skills.basic === skId, hid + " 武器→" + skId);
  }
  G.heroDef = CFG.heroes[1];                 // 散弹手 W002
  G.run.weapon = computeWeaponDefaults();
  recomputeWeapon();
  console.assert(G.run.weapon.basic.bullets === 3, "散弹手基础弹道 3, got " + G.run.weapon.basic.bullets);
  G.heroDef = CFG.heroes[2];                 // 穿甲者 W003
  G.run.weapon = computeWeaponDefaults();
  recomputeWeapon();
  console.assert(G.run.weapon.basic.pierce === 2, "穿甲者基础穿透 2, got " + G.run.weapon.basic.pierce);
  G.heroDef = CFG.heroes[3];                 // 弹射手 W004
  G.run.weapon = computeWeaponDefaults();
  recomputeWeapon();
  console.assert(G.run.weapon.basic.bounce === 2, "弹射手基础弹射 2, got " + G.run.weapon.basic.bounce);
  // 词条仍可叠加在武器基础值上（弹道模块 +1 → 4）
  run.weaponInv.place(makeModule("M001", 0), 3, 0);
  G.heroDef = CFG.heroes[1];
  G.run.weapon = computeWeaponDefaults(); recomputeWeapon();
  console.assert(G.run.weapon.basic.bullets === 4, "散弹手+弹道模块 = 4, got " + G.run.weapon.basic.bullets);
  G.heroDef = CFG.heroes[0];
  // 13) 批次 B：宝箱 4~5 阶
  console.assert(Object.keys(CFG.chestQualities).length === 5, "5 阶宝箱");
  console.assert(CFG.chestContents.divine && CFG.chestContents.mythic, "神圣/神话内容池");
  for (const q of Object.keys(CFG.chestContents)) {
    console.assert(CFG.chestContents[q].defs.every(d => CFG.gearDefs.some(g => g.id === d) || CFG.moduleDefs.some(m => m.id === d)), q + " 池内定义存在");
    console.assert(CFG.chestContents[q].itemQW.length === 4, q + " 品质权重 4 档");
  }
  const divChest = makeChestItem("divine"), mythChest = makeChestItem("mythic");
  console.assert(divChest.value === 400 && mythChest.value === 1000, "神圣/神话宝箱价值");
  const spD = run.backpack.findSpot(divChest);
  console.assert(spD && run.backpack.tryStackChest(makeChestItem("divine")) === false, "未放入时不可叠");
  run.backpack.place(divChest, spD.x, spD.y);
  console.assert(run.backpack.tryStackChest(makeChestItem("divine")), "神圣宝箱可叠加");
  // 14) 批次 B：解锁链（Meta.unlockedLevels）
  console.assert(typeof Meta.data.unlockedLevels === "number" && Meta.data.unlockedLevels >= 1, "解锁数存在");
  const savedUnlock = Meta.data.unlockedLevels;
  Meta.data.unlockedLevels = 3;
  console.assert(CFG.levels.filter((_, i) => i < Meta.data.unlockedLevels).length === 3, "3 关全部解锁判定");
  Meta.data.unlockedLevels = savedUnlock;
  // 15) 技能标签：模块只影响声明了对应标签的技能
  // H001（AT102 能量爆发，tags 含 伤害/冷却/范围/弹道数量）：装增幅器 → 技能伤害变，普攻伤害不变
  G.heroDef = CFG.heroes[0]; G.run = run;
  run.weaponInv = new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon");
  run.weaponInv.place(makeModule("M009", 0), 0, 0);   // 伤害 +10%
  const atkBase0 = run.heroDef.atk;
  recomputeWeapon();
  console.assert(Math.abs(G.run.weapon.skill.dmgMul - CFG.skills.AT102.dmgMul * 1.1) < 1e-6, "伤害词条进技能 dmgMul, got " + G.run.weapon.skill.dmgMul);
  // H004（AT108 环形弹幕，tags 含 弹道数量，基础 8 发）：弹道模块 +1 → 9 发
  G.team = [CFG.heroes[3], CFG.heroes[0]];
  G.heroDef = G.team[0];
  G.run = createRun(G.team[0]);
  console.assert(G.run.weapon.skill.bullets === 8, "AT108 基础 8 弹");
  G.run.weaponInv.place(makeModule("M001", 0), 0, 0);
  recomputeWeapon();
  console.assert(G.run.weapon.skill.bullets === 9, "弹道词条进技能 bullets, got " + G.run.weapon.skill.bullets);
  // H002（AT104 震荡波，tags 不含 弹道数量）：装弹道模块不影响技能弹数
  G.team = [CFG.heroes[1]];
  G.heroDef = G.team[0];
  G.run = createRun(G.team[0]);
  G.run.weaponInv.place(makeModule("M001", 0), 0, 0);
  recomputeWeapon();
  console.assert(!G.run.weapon.skill.bullets || G.run.weapon.skill.bullets === 1, "无标签的词条不影响技能");
  // 16) 多角色组队（上限 3）
  console.assert(CFG.team.maxSize === 3, "组队上限 3");
  G.team = [CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]];
  const teamRun = createRun(G.team[0]);
  console.assert(teamRun.companions.length === 2, "3 人小队 = 1 队长 + 2 队友");
  console.assert(teamRun.companions[0].heroDef.id === "H002" && teamRun.companions[0].alive, "队友实体初始化");
  // 队友承伤/阵亡
  const comp = teamRun.companions[0];
  comp.x = 100; comp.y = 100;
  heroTakeDamage(null, comp, 99999);
  console.assert(!comp.alive && comp.hp === 0, "队友可阵亡");
  console.assert(nearestHero(0, 0) === G.player || nearestHero(0, 0).alive !== false, "阵亡队友不再成为目标");
  G.team = null;
  // 17) 撤离点仅由 Boss 生成（场景掉落撤离信标已删除）
  G.team = [CFG.heroes[0]]; G.run = createRun(CFG.heroes[0]); G.heroDef = CFG.heroes[0];
  console.assert(!CFG.altars.EXTRACT_BEACON, "不应再存在场景掉落撤离信标配置（撤离点只由 Boss 生成）");
  G.mainWorld.boss = { x: 500, y: 500, dead: true };
  onBossDefeated(G.mainWorld);
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 500 && G.run.exitStatue.y === 500, "Boss 死亡位置生成雕像");
  // 上限 1：再次结算不重复生成（位置不变）
  G.mainWorld.boss = { x: 900, y: 900, dead: true };
  onBossDefeated(G.mainWorld);
  console.assert(G.run.exitStatue.x === 500 && G.run.exitStatue.y === 500, "已有雕像时不重复生成（位置不变）");
  // 18) 保险契约（方案 A）——使用当前 G.run；3 件等价装备全损 → 3 份契约全保护
  G.run.backpack = new Inventory(6, 4, "backpack");
  G.run.weaponInv = new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon");
  G.run.backpack.place(makeGear("G006", 0), 0, 0);
  G.run.backpack.place(makeGear("G006", 0), 0, 1);
  G.run.backpack.place(makeGear("G006", 0), 0, 2);
  G.run.backpack.place(makeInsurance(3), 2, 0);           // 3 份契约
  const pen2 = calcDeathPenalty(G.run);
  console.assert(pen2.contractsUsed === 3, "3 份契约生效, got " + pen2.contractsUsed);
  console.assert(pen2.kept.filter(i => i.byInsurance).length === 3, "保护 3 件最高价值物品");
  console.assert(pen2.lost.length === 0, "全部保护后无损失");
  console.assert(insuranceCount(G.run) === 0, "契约已消耗");
  console.assert(!pen2.lost.some(i => i.kind === "insurance"), "契约本身不参与损失");
  // 撤离折算：保险契约按**固定价值 × 统一折算率**折算（不再有独立 crystalRefund）
  console.assert(CFG.insurance.crystalRefund === undefined, "保险契约无独立折算价（统一走固定价值×折算率）");
  console.assert(Math.floor(3 * CFG.insurance.value * CFG.settleConvert.valueRate) === 90, "3 份契约按固定价值统一折算 90 结晶");
  // 19) 空间裂缝子地图
  const rw = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
  console.assert(rw.returnBeacon && rw.monsters.length > 0 && rw.circles.length === 2, "裂缝子地图初始化（信标+怪+2圆）");
  console.assert(rw.kind === "rift" && !rw.isMain, "裂缝世界类型正确");
  // 开场冻结（5.1）：子地图进场即冻结 3 秒（全员静止+无敌）；冻结行为本身由 rift_test.js 专项覆盖，
  // 此处直接跳过，以便继续验证一次性投放数量与返回信标读条
  console.assert(rw.freezeTimer === CFG.rift.freezeTime, "子地图应带开场冻结");
  console.assert(rw.monsters.length === CFG.rift.defaultSpawnCount + rw.eliteTargetCount(),
    "无任务直接构造时按兜底数量一次性投放，got " + rw.monsters.length);
  rw.freezeTimer = 0;
  // 返回信标读条：圈内积累（CFG.rift.channel=5），8 帧后应积累 4s 且未触发（<5）
  console.assert(CFG.rift.channel === 5.0, "返回读条 5 秒");
  rw.returnProgress = 0;
  G.player.x = rw.returnBeacon.x; G.player.y = rw.returnBeacon.y;
  for (let i = 0; i < 8; i++) rw.update(0.5);
  console.assert(Math.abs(rw.returnProgress - 4) < 1e-6, "信标圈内读条积累 4s, got " + rw.returnProgress);
  // 受击归零（移动不打断）；离开圈进度保留
  rw.returnProgress = 3;
  const dummyComp = { alive: true, hp: 100, heroDef: CFG.heroes[0], x: 0, y: 0 };
  heroTakeDamage(rw, dummyComp, 1);
  console.assert(rw.returnProgress === 0, "受击读条归零");
  // 离开圈：信标坐标为随机点位，固定坐标(100,100)可能恰好仍落在圈内 → 反推一个必然在圈外的落点
  rw.returnProgress = 2.5;
  const beaconR = (CFG.rift && CFG.rift.beaconRadius) || 90;
  G.player.x = rw.returnBeacon.x + beaconR * 4 + 200;
  G.player.y = rw.returnBeacon.y + beaconR * 4 + 200;
  if (G.player.x > rw.w) G.player.x = 20;
  if (G.player.y > rw.h) G.player.y = 20;
  console.assert(U.dist(G.player.x, G.player.y, rw.returnBeacon.x, rw.returnBeacon.y) > beaconR,
    "前置：玩家确定在信标圈外");
  rw.update(0.5);
  console.assert(Math.abs(rw.returnProgress - 2.5) < 1e-6, "离开圈进度保留（不衰退不触发）");
  // 20) 精英怪
  const baseM = new Monster("NM0010", 0, 0, 1);
  const em2 = new Monster("NM0010", 800, 800, 1);
  applyElite(em2);
  console.assert(em2.isElite && em2.eliteAffixes.length >= 1 && em2.eliteAffixes.length <= 2, "精英词缀 1-2 条");
  console.assert(em2.r > baseM.r, "精英体型放大");
  // 血量断言改多次抽样：词缀随机可能抽到无 hpMul 组合（迅捷/狂暴），20 次必出血量加成
  let hpBoosted = false;
  for (let i = 0; i < 20 && !hpBoosted; i++) {
    const em = new Monster("NM0010", 800, 800, 1); applyElite(em);
    if (em.hpMax > baseM.hpMax) hpBoosted = true;
  }
  console.assert(hpBoosted, "精英血量提升（词缀乘算，抽样）");
  // 精英击杀必掉宝箱
  const em3 = new Monster("NM0010", 800, 800, 1); applyElite(em3); em3.dead = true;
  G.run.backpack = new Inventory(6, 4, "backpack");
  G.activeWorld = G.mainWorld;
  onMonsterKilled(G.mainWorld, em3);
  console.assert(G.run.backpack.items.some(i => i.kind === "chest"), "精英击杀必掉宝箱入包");

  // 21) 独立精英怪 ED（3.3 原方案：关卡层定点投放，不进随机圆）
  {
    const eds = Object.keys(CFG.monsters).filter(k => k.slice(0, 2) === "ED");
    console.assert(eds.length === 3 && eds.every(k => CFG.monsters[k].sprite), "3 只 ED 精英已定义");
    const nmB = CFG.monsters.NM0010, edB = CFG.monsters.ED0001;
    console.assert(edB.hp > nmB.hp && edB.atk > nmB.atk && edB.def > nmB.def && edB.radius > nmB.radius, "ED 属性强于小怪");
    console.assert(CFG.levels.every(l => l.eliteBase > 0 && l.elitePool && l.elitePool.split("/").every(s => s.slice(0, 2) === "ED")), "关卡 eliteBase/elitePool");
    console.assert(Object.keys(CFG.spawnCircles).every(k => !/ED|BS/.test(CFG.spawnCircles[k].pool)), "圆模板 pool 无 ED/BS");
    G.levelCfg = CFG.levels[0]; G.heroDef = CFG.heroes[0]; G.team = [CFG.heroes[0]];
    G.player = { x: 100, y: 100, r: 18 };
    G.run = createRun(G.heroDef);
    const w = new World(1920, 1920, true); G.mainWorld = w;
    const cc = { ...CFG.spawnCircles.SC01, x: 1700, y: 1700, radius: 30 };
    let badED = 0;
    for (let i = 0; i < 100; i++) { w.monsters = []; w.spawnWave(cc); badED += w.monsters.filter(m => m.defId.slice(0, 2) === "ED").length; }
    console.assert(badED === 0, "spawnWave 不产 ED（100 波抽样）");
    // 精英投放：目标数 = round(eliteBase×倍率)，首发延迟后定点投放，达标不补投
    G.run.scale.eliteCount.mul = 2;
    console.assert(w.eliteTargetCount() === CFG.levels[0].eliteBase * 2, "精英数量倍率 → 目标数翻倍");
    w.monsters = []; w.eliteTimer = CFG.eliteSpawn.firstDelay;
    let guard = 0;
    while (w.eliteTimer > 0.5 + 1e-9 && guard++ < 100) w.updateEliteSpawn(0.5);
    console.assert(w.countElites() === 0, "首投延迟前不投放");
    w.updateEliteSpawn(0.5);
    const el = w.monsters.find(m => m.isElite);
    console.assert(el && el.defId.slice(0, 2) === "ED" && el.eliteAffixes.length >= 1 && el.eliteAffixes.length <= 2, "到点投放 1 只 ED（带 1~2 词缀）");
    G.run.scale.eliteCount.mul = 1;   // 目标数回到 eliteBase
    w.eliteTimer = 0; w.updateEliteSpawn(0.01);
    console.assert(w.countElites() === CFG.levels[0].eliteBase, "未达目标继续补投");
    w.eliteTimer = 0; w.updateEliteSpawn(0.01);
    console.assert(w.countElites() === CFG.levels[0].eliteBase, "达标不补投");
    // 裂缝走同一套投放（独立 eliteBase）
    const rw2 = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
    console.assert(rw2.eliteBaseCount() === CFG.rift.eliteBase && rw2.eliteTargetCount() === CFG.rift.eliteBase, "裂缝独立 eliteBase");
    console.assert(new World(1920, 1080, false).eliteBaseCount() === 0, "工匠世界不投放精英");
  }

  // 22) 邪神雕像 5 变体（多效果并列倍率表：覆盖/叠加/永久）
  {
    G.levelCfg = CFG.levels[0]; G.heroDef = CFG.heroes[0];
    G.run = createRun(G.heroDef);
    G.player = { x: 100, y: 100, r: 18 };
    const w = new World(1920, 1920, true); G.mainWorld = w;
    const ids = ["ALTAR_004a", "ALTAR_004b", "ALTAR_004c", "ALTAR_004d", "ALTAR_004e"];
    const keyOf = { ALTAR_004a: "smallCount", ALTAR_004b: "smallStat", ALTAR_004c: "eliteCount", ALTAR_004d: "eliteStat", ALTAR_004e: "bossStat" };
    console.assert(ids.every(k => CFG.altars[k] && CFG.altars[k].weight >= 4 && CFG.altars[k].effects[0].type === "adjustMonsters"
      && CFG.altars[k].effects[0].range[0] === -100 && CFG.altars[k].effects[0].range[1] === 100), "邪神 5 行配置（adjustMonsters / ±100）");
    console.assert(Object.keys(CFG.monsterScale.targets).length === 5 && CFG.monsterScale.targets["精英数量"].key === "eliteCount", "monsterScale 5 目标映射");
    const trig = (id, ov) => {
      const b = CFG.altars[id];
      const cfg = ov ? { ...b, effects: b.effects.map(e => ({ ...e, ...ov })) } : b;
      const a = { cfg, x: 500, y: 500, id }; w.altars.push(a); w.triggerAltar(a);
    };
    for (const id of ids) {
      for (const k in G.run.scale) G.run.scale[k] = { mul: 1, remain: 0 };
      trig(id);
      console.assert(G.run.scale[keyOf[id]].remain === 30, id + " 生效写入对应 scale 条目");
      console.assert(Object.keys(G.run.scale).filter(k => k !== keyOf[id]).every(k => G.run.scale[k].remain === 0), id + " 不误改其他条目");
    }
    // 同目标再次触发：覆盖（非叠乘）并重新计时
    G.run.scale.smallStat = { mul: 1, remain: 0 };
    trig("ALTAR_004b", { range: [50, 50] }); trig("ALTAR_004b", { range: [50, 50] });
    console.assert(Math.abs(G.run.scale.smallStat.mul - 1.5) < 1e-9 && G.run.scale.smallStat.remain === 30, "同目标覆盖非叠乘 + 重新计时");
    // 5 变体可同时并存（叠加）
    for (const id of ids) trig(id);
    console.assert(ids.every(id => G.run.scale[keyOf[id]].remain === 30), "5 变体可叠加并存");
    // 永久（-1）不倒计时
    G.run.scale.bossStat = { mul: 1, remain: 0 };
    trig("ALTAR_004e", { range: [40, 40], duration: -1 });
    // 隔离计时验证：清空怪场并桩化玩家承伤，避免超大 dt 下怪物/弹道命中触发未实现方法
    w.monsters = []; w.circles = []; w.enemyBullets = []; w.eliteTimer = 1e9;
    G.player.takeDamage = () => { };
    w.update(120);   // 远超 30s
    console.assert(G.run.scale.bossStat.remain === -1 && Math.abs(G.run.scale.bossStat.mul - 1.4) < 1e-9, "duration=-1 永久不倒计时");
    console.assert(!("monsterDebuff" in G.run), "派生 HUD 摘要字段已清理（HUD 直接遍历 scale）");
    // 作用点：小怪数量 / 刷新间隔 / 小怪属性 / BOSS属性
    const cc = { ...CFG.spawnCircles.SC01, x: 1700, y: 1700, radius: 30 };
    for (const k in G.run.scale) G.run.scale[k] = { mul: 1, remain: 0 };
    w.monsters = []; G.run.scale.smallCount.mul = 2; w.spawnWave(cc);
    console.assert(w.monsters.length === CFG.spawnCircles.SC01.waveSize * 2, "小怪数量 → 每波 ×2");
    console.assert(Math.abs(w.spawnInterval(CFG.spawnCircles.SC01) - CFG.spawnCircles.SC01.interval / 2) < 1e-9, "小怪数量 → 刷新间隔 ÷mul");
    G.run.scale.smallCount.mul = 1; G.run.scale.smallStat.mul = 3;
    const nmS = w.spawnMonster("NM0010", 1500, 1500);
    console.assert(Math.abs(nmS.hpMax - 20 * 3) < 1e-6 && Math.abs(nmS.atk - 8 * 3) < 1e-6, "小怪属性 → 新怪 hp/atk ×3");
    G.run.scale.smallStat.mul = 1; G.run.scale.bossStat.mul = 2;
    w.findFreeSpot = () => ({ x: 900, y: 900 }); w.bossSpawned = false; spawnBoss(w);
    console.assert(Math.abs(w.boss.hpMax - CFG.monsters[G.levelCfg.boss].hp * 2) < 1e-6, "BOSS属性 → BOSS 生成时 hp ×2");
    G.run.scale.bossStat.mul = 1;
  }

  console.log("SMOKE OK");
`, ctx, { filename: "inline" });
