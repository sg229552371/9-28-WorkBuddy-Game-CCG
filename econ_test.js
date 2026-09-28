/* 无头测试：批次 G——局内外资源转化 / 诅咒道具 / 模组连接套装 / 卡牌付费刷新 / 裂缝任务（node econ_test.js） */
"use strict";

/* ---- DOM / Canvas 桩（与 runtime_test 相同的最小桩） ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
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
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  /* ============ 一、局内→局外资源转化（待细化5） ============ */
  Game.startRun([CFG.heroes[0]]);
  {
    const r = G.run;
    r.coin = 100;                                   // 100 / 20 = 5
    r.cardAssets = 3;                               // 3 × 2 = 6
    const chest = makeChestItem("epic");            // value 150 → ×0.5 = 75
    r.backpack.place(chest, 0, 0);
    const gear = makeGear("G001", 0);               // value 30 → ×0.25 = 7
    r.backpack.place(gear, 1, 0);
    const ins = makeInsurance(2);                   // 保险不计入折算（单独结算）
    r.backpack.place(ins, 2, 0);
    const mod = makeModule("M009", 1);              // value round(45×1.8)=81 → ×0.25 = 20
    r.weaponInv.place(mod, 0, 0);
    const b = calcSettleConvert(r);
    check("折算-金币 100→5", b.coin === 5);
    check("折算-宝箱 150→75", b.chest === 75);
    check("折算-装备/模组 30+81→" + b.item, b.item === Math.floor((30 + 81) * 0.25));
    check("折算-卡牌 3→6", b.card === 6);
    check("折算-保险契约不计入", b.item !== Math.floor((30 + 81 + ins.value) * 0.25));
    check("折算-合计 = " + b.total, b.total === b.coin + b.chest + b.item + b.card);
  }

  /* ============ 二、诅咒道具（待细化36） ============ */
  {
    const r = G.run;
    G.inArtisan = true; G.inRift = false;
    const cu = makeCurse();
    r.backpack.place(cu, 4, 0);
    check("诅咒-工匠世界禁用", useCurseItem(cu) === false && r.backpack.items.includes(cu));
    G.inArtisan = false;
    r.curse = { ...CFG.curseItems.list[0], remain: 10 };   // C001 铁壁诅咒 def×3 hp×1.5
    check("诅咒-已有诅咒生效时禁用", useCurseItem(cu) === false);
    r.curse = null;
    check("诅咒-主地图使用成功", useCurseItem(cu) === true && !r.backpack.items.includes(cu));
    check("诅咒-随机到列表内条目且带计时", r.curse && CFG.curseItems.list.some(c => c.id === r.curse.id) && r.curse.remain > 0);
    // 强制指定 C001 验证属性修改器
    r.curse = { ...CFG.curseItems.list[0], remain: 10 };
    const m1 = new Monster("NM0010", 800, 800, 1);   // def 1, hp 20, spd 115
    check("诅咒-怪物生命 ×1.5 → " + m1.hpMax, Math.abs(m1.hpMax - 30) < 1e-6);
    check("诅咒-怪物移速 ×1（C001）", Math.abs(m1.effSpd - 115) < 1e-6);
    const before = m1.hp;
    damageMonster(G.mainWorld, m1, 100);             // def ×3：real = 100-3 = 97
    check("诅咒-防御×3 减伤生效 " + (before - m1.hp), before - m1.hp === 97);
    r.curse = { ...CFG.curseItems.list[1], remain: 10 };   // C002 狂暴 atk×1.6 spd×1.25
    const m2 = new Monster("NM0010", 800, 800, 1);
    check("诅咒-移速 ×1.25 → " + m2.effSpd.toFixed(2), Math.abs(m2.effSpd - 115 * 1.25) < 1e-6);
    check("诅咒-攻击 ×1.6 → " + m2.atk, Math.abs(m2.atk - 8 * 1.6) < 1e-6);
    // 掉落倍率：NM0010 coin 2 → ×2.5 = 5
    G.mainWorld.pickups = [];
    m2.dead = true;
    onMonsterKilled(G.mainWorld, m2);
    const coinPk = G.mainWorld.pickups.find(pk => pk.type === "coin");
    check("诅咒-金币掉落 ×2.5 → " + (coinPk && coinPk.value), coinPk && coinPk.value === 5);
    // 倒计时到期消退
    G.activeWorld = G.mainWorld;
    G.mainWorld.update(100);
    check("诅咒-到期消退", r.curse === null);
  }

  /* ============ 三、模组连接 + 套装（16.7） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    const r = G.run;
    const a = makeModule("M001", 2);   // 弹头扩容 1×1
    const b = makeModule("M005", 2);   // 穿甲弹头 2×1（同品质相邻 → 连接1对 + 套装2件）
    r.weaponInv.place(a, 0, 0);
    r.weaponInv.place(b, 1, 0);
    const c = makeModule("M009", 0);   // 不同品质（白）→ 不参与连接
    r.weaponInv.place(c, 3, 2);
    const syn = moduleSynergy();
    check("连接-相邻同品质 1 对", syn.links === 1);
    check("套装-弹道套装×2 触发", syn.sets.some(s => s.includes("弹道套装")));
    check("套装-未触发集不误报", !syn.sets.some(s => s.includes("冷却套装") || s.includes("增幅套装")));
    recomputeWeapon();
    check("连接/套装-伤害乘算生效", Math.abs(r.moduleSyn.dmgMul - (1 + 1 * CFG.moduleLevel.linkBonus)) < 1e-9);
    // 普攻弹道：基础1 + M001词条1 + 套装1 = 3
    check("套装-弹道数量 +1 → 普攻 " + r.weapon.basic.bullets, r.weapon.basic.bullets === 3);
    // 分开摆放 → 连接失效
    r.weaponInv.remove(b);
    r.weaponInv.place(b, 1, 2);        // 不相邻
    const syn2 = moduleSynergy();
    check("连接-不相邻不触发", syn2.links === 0);
  }

  /* ============ 四、卡牌付费刷新（待细化37） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    const r = G.run;
    G.inArtisan = true;
    r.cardRefresh = 0;
    r.cardCandidates = null;
    Meta.data.crystals = 100;
    check("付费刷新-成功扣结晶", refreshCards(true) === true && Meta.data.crystals === 100 - CFG.cardPool.refreshCrystalCost);
    Meta.data.crystals = 0;
    check("付费刷新-结晶不足失败", refreshCards(true) === false);
    // 卡池含新属性 energyMax 且数值表完整
    check("卡池-新增能量上限属性", CFG.cardPool.attrs.energyMax && CFG.cardPool.attrs.energyMax.flat.length === 4);
    computeStats();   // energyMax 卡应能被 computeStats 消费（不抛错）
    r.appliedCards.push({ attr: "energyMax", q: 2, value: 28 });
    const st = computeStats();
    check("卡牌-能量上限生效 " + st.energyMax, st.energyMax === r.heroDef.energyMax + 28);
  }

  /* ============ 五、裂缝任务变体（待细化20） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    const r = G.run;
    const rw = new World(CFG.rift.worldSize, CFG.rift.worldSize, false, "rift");
    G.riftWorld = rw; G.activeWorld = rw; G.inRift = true;
    // 歼灭任务（限时）：达标 → 任务宝箱
    r.riftTask = { ...CFG.rift.tasks[1], remain: 75, done: false, failed: false };   // purge goal 18
    r.riftKills = 18;
    rw.update(0.016);
    check("裂缝任务-达标完成", r.riftTask.done === true);
    check("裂缝任务-任务宝箱刷出", rw.altars.some(al => al.id === "RIFT_TASK" && al.cfg.effects[0].weights === CFG.rift.taskBonusWeights));
    // 超时 → 失败
    r.riftTask = { ...CFG.rift.tasks[2], remain: 0.01, done: false, failed: false }; // raid 40s
    r.riftKills = 0;
    rw.update(0.5);
    check("裂缝任务-限时超时失败", r.riftTask.failed === true && r.riftTask.done === false);
    // 配置完整性
    check("裂缝任务-三个变体配置", CFG.rift.tasks.length === 3 && CFG.rift.tasks.every(t => t.goal > 0 && t.desc));
  }

  /* ============ 六、工匠服务配置完整性（待细化28，UI 交互由浏览器验收） ============ */
  {
    const S = CFG.artisanServices;
    check("工匠服务-品质强化 3 档价格", S.qualityUp.costs.length === 3 && S.qualityUp.costs.every(c => c > 0));
    check("工匠服务-三档宝箱售价", ["advanced", "epic", "divine"].every(q => S.buyChest[q] > 0));
    check("工匠服务-保险/洗词缀价格", S.buyInsurance.cost > 0 && S.rerollModule.cost > 0);
  }

  Game.backToMenu();
  console.log(ok ? "ECON OK" : "ECON FAILED");
  if (!ok) throw new Error("ECON FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
