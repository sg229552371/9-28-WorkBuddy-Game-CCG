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
for (const f of ["js/config.js", "js/core.js", "js/game.js"]) {
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
  // 5) 世界构建 & 祭坛
  G.mainWorld = new World(1920,1080,true);
  console.assert(G.mainWorld.monsters.length > 0, "初始刷怪");
  console.assert(G.mainWorld.altars.length === 5, "祭坛 5 个");
  for (const a of G.mainWorld.altars)
    console.assert(!G.mainWorld.obstacles.some(o => a.x>o.x-60 && a.x<o.x+o.w+60 && a.y>o.y-60 && a.y<o.y+o.h+60), "祭坛不与障碍重叠（净空60）");
  // 6) 工匠世界
  const aw = new World(1920,1080,false);
  console.assert(aw.npc && aw.exitBeacon && aw.monsters.length===0, "工匠世界安全区");
  // 7) 击杀→进度/Boss/工匠雕像触发
  G.mainWorld.boss = null;
  G.run.kills = CFG.levels[0].artisanAtKills;
  onMonsterKilled(G.mainWorld, { x:500, y:500, d: CFG.monsters.NM0010, dead:true });
  console.assert(G.run.artisanSpawned, "工匠雕像按击杀进度刷出");
  console.assert(G.mainWorld.altars.some(a=>a.id==="ALTAR_005"), "工匠雕像在祭坛列表");
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x:500, y:500, d: CFG.monsters.NM0010, dead:true });
  console.assert(G.run.bossSpawned && G.mainWorld.boss, "进度满触发 Boss");
  // 8) Boss 击败 → 撤离点代币（5.2 按文档重构）
  G.mainWorld.boss.dead = true; G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 400;
  G.mainWorld.monsters = G.mainWorld.monsters.filter(m => !m.dead);
  onBossDefeated(G.mainWorld);
  console.assert(G.run.extractToken === true, "Boss 击败掉落撤离点代币");
  console.assert(CFG.extract.channel === 8.0, "撤离读条 8 秒");
  // 9) 局外元进度：结晶 / 局外等级 / 出战加成
  console.assert(typeof Meta.data.crystals === "number", "Meta 默认数据");
  Meta.data.crystals = 0;
  console.assert(Meta.awardRun(10, true, true) === 40, "撤离结晶 = 10击杀+30Boss, got " + Meta.awardRun(0, false, true));
  console.assert(Meta.data.crystals === 40, "结晶入账 40, got " + Meta.data.crystals);
  console.assert(Meta.awardRun(10, true, false) === 12, "死亡结晶 30% = 12");
  console.assert(Meta.levelUpCost("H001") === 50, "LV1→2 消耗 50");
  Meta.data.crystals = 0;
  console.assert(!Meta.levelUp("H001"), "结晶不足不能升级");
  Meta.data.crystals = 100;
  console.assert(Meta.levelUp("H001"), "升级成功");
  console.assert(Meta.heroLevel("H001") === 2, "局外等级 2");
  console.assert(Meta.levelUpCost("H001") === 90, "LV2→3 消耗 90");
  const boosted = applyOutLevel(CFG.heroes[0]);
  console.assert(boosted.hp === CFG.heroes[0].hp + 8 && boosted.atk === CFG.heroes[0].atk + 2
    && boosted.def === CFG.heroes[0].def + 1 && boosted.outLevel === 2, "局外加成生效");
  console.assert(CFG.heroes[0].hp === 100, "CFG 原表不被污染");
  // 9b) 武器等级（金币升级，工匠世界内；技能等级 = 武器等级；1-10 手写表）
  console.assert(Meta.weaponLv("H001") === 1, "武器初始 LV1");
  console.assert(Meta.weaponUpCost("H001") === CFG.weaponLevels[1].cost, "LV1→2 消耗 = 表值");
  console.assert(Meta.weaponUp("H001") && Meta.weaponLv("H001") === 2, "武器升级成功（永久资产）");
  const skBoosted = applyOutLevel(CFG.heroes[0]);
  console.assert(skBoosted.weaponLv === 2 && skBoosted.outSkillLv === 2, "出战副本带武器等级");
  // 武器等级伤害走手写表（技能 dmgMul × skillMul；普攻 × basicMul）
  // 注：清空武器栏模组，避免模组连接/套装（16.7）加成混入本断言
  G.run = run; G.heroDef = skBoosted;
  run.weaponInv.items.length = 0;
  const baseDmg = CFG.skills[CFG.weapons[skBoosted.weapon].skills.skill].dmgMul;
  const baseBasic = CFG.skills[CFG.weapons[skBoosted.weapon].skills.basic].dmgMul;
  recomputeWeapon();
  console.assert(Math.abs(G.run.weapon.skill.dmgMul - baseDmg * CFG.weaponLevels[1].skillMul) < 1e-6,
    "技能 LV2 伤害走武器表 ×" + CFG.weaponLevels[1].skillMul + ", got " + G.run.weapon.skill.dmgMul);
  console.assert(Math.abs(G.run.weapon.basic.dmgMul - baseBasic * CFG.weaponLevels[1].basicMul) < 1e-6,
    "普攻 LV2 伤害走武器表 ×" + CFG.weaponLevels[1].basicMul);
  console.assert(Meta.weaponLv("H001") === 2 && Meta.weaponUpCost("H001") === CFG.weaponLevels[2].cost, "LV2→3 消耗 = 表值");
  // 10) 属性卡牌（8.3：升级获得资产 / 工匠世界使用 / 同属性去重）
  console.assert(run.cardAssets === 0 && run.cardRefresh === CFG.cardPool.refreshPerRun && run.appliedCards.length === 0, "卡牌初始状态");
  run.exp = 999; gainExp(0);
  console.assert(run.lv > 1 && run.cardAssets === run.lv - 1, "升级发卡资产 +1/级, assets=" + run.cardAssets);
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
  // 使用卡牌：属性生效 + 去重
  run.cardCandidates = drawCardCandidates();
  const first = run.cardCandidates[0];
  const assetsBefore = run.cardAssets;
  console.assert(useCard(0), "使用卡牌成功");
  console.assert(run.cardAssets === assetsBefore - 1, "资产 -1");
  console.assert(run.appliedCards.length === 1 && run.appliedCards[0].attr === first.attr, "已用记录");
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
  // 刷新次数
  run.cardRefresh = 1;
  console.assert(refreshCards() && run.cardRefresh === 0, "刷新 -1");
  console.assert(!refreshCards(), "次数用完不能刷新");
  G.inArtisan = false;
  // 11) 批次 B：关卡扩展（2/3 关配置完整性 + 解锁链）
  console.assert(CFG.levels.length === 3, "3 个关卡");
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
  const heroWeaponChecks = { H002: ["AT103", 3], H003: ["AT105", 2], H004: ["AT107", 2], H005: ["AT109", 1], H006: ["AT111", 1] };
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
  console.assert(Math.abs(G.run.weapon.skill.dmgMul - 2.5 * 1.1) < 1e-6, "伤害词条进技能 dmgMul, got " + G.run.weapon.skill.dmgMul);
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
  // 17) 撤离信标祭坛 → 代币（场景掉落来源）
  G.team = [CFG.heroes[0]]; G.run = createRun(CFG.heroes[0]); G.heroDef = CFG.heroes[0];
  G.mainWorld.altars.push({ cfg: CFG.altars.EXTRACT_BEACON, x: 500, y: 500, id: "T" });
  const exAltar = G.mainWorld.altars.find(a => a.id === "T");
  G.mainWorld.triggerAltar(exAltar);
  console.assert(G.run.extractToken === true, "撤离信标祭坛 → 获得代币");
  console.assert(!G.mainWorld.altars.some(a => a.id === "T"), "触发后信标消失");
  // 上限 1：再次触发不再获得
  G.mainWorld.altars.push({ cfg: CFG.altars.EXTRACT_BEACON, x: 500, y: 500, id: "T2" });
  G.mainWorld.triggerAltar(G.mainWorld.altars.find(a => a.id === "T2"));
  console.assert(G.mainWorld.altars.every(a => a.id !== "T2"), "已有代币时信标仍消失（不重复获得）");
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
  // 撤离折算：n 份 × crystalRefund
  console.assert(3 * CFG.insurance.crystalRefund === 60, "3 份契约撤离折算 60 结晶");
  // 19) 空间裂缝子地图
  const rw = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
  console.assert(rw.returnBeacon && rw.monsters.length > 0 && rw.circles.length === 2, "裂缝子地图初始化（信标+怪+2圆）");
  console.assert(rw.kind === "rift" && !rw.isMain, "裂缝世界类型正确");
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
  rw.returnProgress = 2.5;
  G.player.x = 100; G.player.y = 100;
  rw.update(0.5);
  console.assert(Math.abs(rw.returnProgress - 2.5) < 1e-6, "离开圈进度保留（不衰退不触发）");
  // 20) 精英怪
  const baseM = new Monster("NM0010", 0, 0, 1);
  const em2 = new Monster("NM0010", 800, 800, 1);
  applyElite(em2);
  console.assert(em2.elite && em2.elite.length >= 1 && em2.elite.length <= 2, "精英词缀 1-2 条");
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
  console.log("SMOKE OK");
`, ctx, { filename: "inline" });
