/* 无头测试：B4 宝箱主来源（2026-10-13 用户拍板落库）
 * ----------------------------------------------------------------------------
 * 用户原话逐条对应到断言：
 *   ①「精英怪有几率掉落低级宝箱」   → 精英几率生效 + 品质池 = 前两阶（普通/高级）
 *   ②「BOSS 有几率掉落中高级宝箱」   → BOSS 几率生效 + 品质池 = 后三阶（首版闸门 → 只剩史诗）
 *   ③「宝箱掉落在地面，拾取方式参考雕像」 → 落为 world.altars 祭坛实体；掉落阶段**不入包**；
 *        进圈读条 channel 秒才入包（未满不入包 / 离圈衰减）
 *   ④「宝箱就是雕像的一种形态表现」  → 同实体结构 {cfg,x,y,id} + 同 judgeChannel + 触发即消失
 *   ⑤「同名宝箱在背包中可叠加」      → stackMax 内 count+1、不占新格；溢出后新开格
 * 另含：真源守卫（直读真实 CFG，不用自造桩）+ 零介入边界 + 普通怪不掉箱（现状保持）。
 *
 * ⚠️ PASS 文案**禁用英文 error / FAIL**（run_tests.sh 以 grep -ci 统计失败）。
 * ⚠️ vm 驱动内**禁用反引号模板**（血泪坑）。
 * 运行：node chest_drop_source_test.js（退出码 0 = 全绿）
 * ========================================================================== */
"use strict";

/* ---- DOM / Canvas 桩（与 boss_ux_test 同款最小集） ---- */
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
    this.children = []; this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; }
  remove() { }
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
  G.sprites = { hero: {} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  Game.skipLevelUpChoice && Game.skipLevelUpChoice();

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS " : "FAIL") + " " + name); if (!cond) ok = false; };
  const fakeW = () => ({ w: 1920, h: 1920, altars: [], obstacles: [], monsters: [], pickups: [],
    findFreeSpot() { return null; } });

  /* ============ 一、真源守卫：直读真实 CFG.chestDrop（不用自造桩） ============ */
  {
    const cd = CFG.chestDrop;
    check("① 真源 CFG.chestDrop 存在且有 enabled 开关", !!cd && cd.enabled === true);
    check("① 首版范围闸门 gateByDropW 存在（true = 只保留 dropW > 0 的品质）", cd.gateByDropW === true);
    check("① 地面宝箱形态参数（radius / channel）均为正数",
      cd.ground && cd.ground.radius > 0 && cd.ground.channel > 0);
    check("① 精英池 = 低级宝箱（仅 普通/高级 两阶，无高阶）",
      cd.elite && !!cd.elite.weights.normal && !!cd.elite.weights.advanced
      && !cd.elite.weights.epic && !cd.elite.weights.divine && !cd.elite.weights.mythic);
    check("① BOSS 池 = 中高级宝箱（仅 史诗/神圣/神话 三阶，无低阶）",
      cd.boss && !!cd.boss.weights.epic && !!cd.boss.weights.divine && !!cd.boss.weights.mythic
      && !cd.boss.weights.normal && !cd.boss.weights.advanced);
    check("① 两处均为「几率」而非必掉（0 < chance < 1）",
      cd.elite.chance > 0 && cd.elite.chance < 1 && cd.boss.chance > 0 && cd.boss.chance < 1);
    check("① 旧字段 CFG.elites.dropChest（必掉权重）已移除，不再有第二套口径",
      CFG.elites.dropChest === undefined);
    check("① BOSS 转阶段开关仍在（真源迁到 chestDrop.boss）",
      !!(CFG.boss.phaseChest && CFG.boss.phaseChest.enabled === true));

    /* 闸门行为（纯函数） */
    const gated = chestDropWeights(cd.boss.weights);
    check("① 闸门过滤：BOSS 池经 dropW 闸门后只剩「史诗」（神圣/神话 dropW = 0 首版暂缓）",
      !!gated && !!gated.epic && !gated.divine && !gated.mythic && !gated.normal);
    const gatedElite = chestDropWeights(cd.elite.weights);
    check("① 闸门过滤：精英池两阶 dropW 均 > 0 → 原样保留", !!gatedElite && !!gatedElite.normal && !!gatedElite.advanced);
    check("① 闸门关闭时不剥离（配置 dropW 闸门可关）", (function () {
      const saved = CFG.chestDrop.gateByDropW; CFG.chestDrop.gateByDropW = false;
      const raw = chestDropWeights(CFG.chestDrop.boss.weights);
      CFG.chestDrop.gateByDropW = saved;
      return !!raw && !!raw.epic && !!raw.divine && !!raw.mythic;
    })());
    check("① 池为空 / 非法入参安全返回 null（不崩、不刷空箱）",
      chestDropWeights(null) === null && chestDropWeights({ nope: 1 }) === null);
  }

  /* ============ 二、精英怪：有几率掉低级宝箱 ============ */
  {
    const w = fakeW();
    const m = { x: 800, y: 800, isElite: true, d: { name: "精英", exp: 20, type: "elite" } };

    /* ②a 几率未中 → 无箱 */
    const r1 = eliteDropChest(w, m, () => 0.999);
    check("② 几率未中：不产生宝箱、地面无新增（零副作用）", r1 === null && w.altars.length === 0);

    /* ②b 几率命中 → 落在地面（world.altars 实体） */
    const r2 = eliteDropChest(w, m, () => 0);
    check("② 几率命中：宝箱**落在地面**（world.altars 新增一个祭坛实体）", !!r2 && w.altars.length === 1 && w.altars[0] === r2);
    check("② 地面宝箱品质必为低级（普通 / 高级）",
      ["normal", "advanced"].indexOf(r2.cfg.effects[0].fixed) >= 0);
    check("② 地面宝箱自带读条参数（拾取参考雕像）",
      r2.cfg.channel > 0 && r2.cfg.radius > 0 && r2.cfg.effects[0].type === "giveChest");
    check("② 地面宝箱 = 雕像实体结构（cfg / x / y / id 四件套齐全）",
      !!r2.cfg && typeof r2.x === "number" && typeof r2.y === "number" && typeof r2.id === "string");
    check("② 落地坐标在场界内（夹取 60 边距）",
      r2.x >= 60 && r2.x <= w.w - 60 && r2.y >= 60 && r2.y <= w.h - 60);

    /* ②c 触发开关：enabled=false → 零介入 */
    const savedEn = CFG.chestDrop.enabled;
    CFG.chestDrop.enabled = false;
    const r3 = eliteDropChest(fakeW(), m, () => 0);
    CFG.chestDrop.enabled = savedEn;
    check("② chestDrop.enabled=false 时零介入（即便几率必中也无箱）", r3 === null);

    /* ②d 池被掏空（dropW 闸门全滤）→ 安全跳过 */
    const savedW = JSON.stringify(CFG.chestDrop.elite.weights);
    CFG.chestDrop.elite.weights = { divine: 10 };
    const r4 = eliteDropChest(fakeW(), m, () => 0);
    CFG.chestDrop.elite.weights = JSON.parse(savedW);
    check("② 池经闸门后为空时安全跳过（返回 null，不刷空箱）", r4 === null);
  }

  /* ============ 三、BOSS：有几率掉中高级宝箱 ============ */
  {
    const m = { x: 900, y: 900, d: { name: "三阶段 BOSS", type: "boss" } };
    const a0 = G.activeWorld.altars.length;

    bossPhaseChest._rng = () => 0.999;
    const miss = bossPhaseChest(m);
    bossPhaseChest._rng = null;
    check("③ 几率未中：BOSS 转阶段不产生宝箱（旧「每阶段必掉」已作废）",
      miss === null && G.activeWorld.altars.length === a0);

    bossPhaseChest._rng = () => 0;
    const hit = bossPhaseChest(m);
    bossPhaseChest._rng = null;
    check("③ 几率命中：宝箱**落在地面**（world.altars 新增，非直接入包）",
      !!hit && G.activeWorld.altars.length === a0 + 1);
    check("③ 地面宝箱品质必为中高级（史诗 / 神圣 / 神话）",
      ["epic", "divine", "mythic"].indexOf(hit.cfg.effects[0].fixed) >= 0);
    check("③ 首版环境下实际只会掉「史诗」（闸门把神圣/神话滤除）", hit.cfg.effects[0].fixed === "epic");
    check("③ 真相源直读：hit 品质键确实在 CFG.chestDrop.boss.weights 内",
      CFG.chestDrop.boss.weights[hit.cfg.effects[0].fixed] != null);

    if (hit) { const i = G.activeWorld.altars.indexOf(hit); if (i >= 0) G.activeWorld.altars.splice(i, 1); }
  }

  /* ============ 四、拾取参考雕像：进圈读条 → 入包（掉落阶段不入包） ============ */
  {
    const r = G.run;
    r.backpack = new Inventory(6, 4, "backpack");
    G.activeWorld = new World(1920, 1920, true);   // 真 World：triggerAltar 是 World 的方法
    G.mainWorld = G.activeWorld;
    const w = G.activeWorld;
    w.altars = [];
    const m = { x: 500, y: 500, isElite: true, d: { name: "精英", exp: 20, type: "elite" } };
    const chests = () => r.backpack.items.filter(it => it && it.kind === "chest");

    eliteDropChest(w, m, () => 0);
    check("④ 掉落阶段**不入包**（背包仍空，箱子躺在地上）", chests().length === 0 && w.altars.length === 1);
    const ch = w.altars[0];

    /* ④a 无人进圈：进度恒 0，不触发 */
    const far = judgeChannel(ch, ch.x, ch.y, ch.cfg.radius, 0.5, ch.cfg.channel);
    check("④ 无人进圈：读条不推进（进度 0）", far === false && (ch.progress || 0) === 0);

    /* ④b 有英雄进圈：逐帧读条，未满不完成（与雕像同款 judgeChannel —— 见 game.js 祭坛循环） */
    const hero = aliveHeroes()[0];
    hero.x = ch.x; hero.y = ch.y;
    const dt = 0.3;
    let done = false, frames = 0;
    while (!done && frames < 50) { done = judgeChannel(ch, ch.x, ch.y, ch.cfg.radius, dt, ch.cfg.channel); frames++; }
    const needFrames = Math.ceil(ch.cfg.channel / dt);
    check("④ 进圈读条：恰好 " + needFrames + " 帧（" + ch.cfg.channel + "s）后完成，不多不少",
      done === true && frames === needFrames);
    check("④ 读条期间不入包（完成后才由 triggerAltar 消费）", chests().length === 0);

    /* ④c 完成 → triggerAltar → 入包；触发即从地面消失（宝箱=雕像的同一生命周期） */
    w.triggerAltar(ch);
    check("④ 读条完成 → 入包（同名宝箱落地可拾取）", chests().length === 1
      && ["normal", "advanced"].indexOf(chests()[0].chestQ) >= 0);
    check("④ 触发即消失（宝箱与雕像共用「一次性实体」生命周期）", w.altars.length === 0);

    /* ④d 离圈 → 进度衰减（不保留进度白嫖） */
    const w2 = G.activeWorld;
    w2.altars = [];
    eliteDropChest(w2, m, () => 0);
    const ch2 = w2.altars[0];
    judgeChannel(ch2, ch2.x, ch2.y, ch2.cfg.radius, 0.5, ch2.cfg.channel);
    const pMid = ch2.progress;
    hero.x = ch2.x + 100000; hero.y = ch2.y;      // 走远
    judgeChannel(ch2, ch2.x, ch2.y, ch2.cfg.radius, 0.1, ch2.cfg.channel);
    check("④ 离圈：读条进度回退（不跨次累计）", ch2.progress < pMid && ch2.progress >= 0);
  }

  /* ============ 五、同名宝箱在背包中可叠加 ============ */
  {
    const r = G.run;
    r.backpack = new Inventory(6, 4, "backpack");
    const stackMax = CFG.chestQualities.normal.stackMax;
    check("⑤ 前置：普通宝箱 stackMax > 1（可叠）", stackMax > 1);

    for (let i = 0; i < stackMax; i++) grantItemToRun(r, makeChestItem("normal"));
    const slots = r.backpack.items.filter(it => it && it.kind === "chest");
    check("⑤ 连续获得 " + stackMax + " 个同名宝箱：只占 1 格、count 累加",
      slots.length === 1 && slots[0].count === stackMax);
    check("⑤ 叠加同步累加价值（value = 单价 × count）",
      slots[0].value === CFG.chestQualities.normal.value * stackMax);

    grantItemToRun(r, makeChestItem("normal"));
    const slots2 = r.backpack.items.filter(it => it && it.kind === "chest");
    check("⑤ 超过 stackMax → 另开一格（不丢件、不超叠）",
      slots2.length === 2 && slots2.some(it => it.count === 1));

    grantItemToRun(r, makeChestItem("advanced"));
    const slots3 = r.backpack.items.filter(it => it && it.kind === "chest");
    check("⑤ 不同名宝箱不混叠（按 chestQ 分桶）", slots3.length === 3);
  }

  /* ============ 六、边界 / 现状保持 ============ */
  {
    const r = G.run;
    r.backpack = new Inventory(6, 4, "backpack");

    /* ⑥a 普通怪不掉宝箱（B4 未改：普通怪只掉 exp / coin） */
    const w = fakeW();
    const nm = new Monster("NM0010", 400, 400, 1); nm.dead = true;
    onMonsterKilled(w, nm);
    check("⑥ 普通怪击杀不产生宝箱（本批未改，保持现状）",
      w.altars.filter(a => a.cfg.effects[0] && a.cfg.effects[0].type === "giveChest").length === 0
      && r.backpack.items.filter(it => it && it.kind === "chest").length === 0);

    /* ⑥b 精英掉箱确为「几率」：用**确定性 LCG**抽样（不用 Math.random，避免偶发假红） */
    const w2 = fakeW();
    const m = { x: 300, y: 300, isElite: true, d: { name: "精英", exp: 20, type: "elite" } };
    let seed = 12345;
    const lcg = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    let hits = 0;
    const N = 400;
    for (let i = 0; i < N; i++) { if (eliteDropChest(w2, m, lcg)) hits++; }
    check("⑥ 精英掉箱确为「几率」：400 次确定性抽样命中数落在开区间（0 < hits < 400）", hits > 0 && hits < N);

    /* ⑥c spawnGroundChest 非法入参安全 */
    check("⑥ spawnGroundChest 非法入参安全返回 null（不抛错）",
      spawnGroundChest(null, "normal", 0, 0) === null && spawnGroundChest(fakeW(), "NOPE", 0, 0) === null);

    /* ⑥d 宝箱格子占用真源 = CFG（B5 契约） */
    check("⑥ 宝箱占格取自 CFG.chestQualities[].shape（数值进 CFG，不硬编码）",
      Array.isArray(CFG.chestQualities.normal.shape) && makeChestItem("normal").shape.length === CFG.chestQualities.normal.shape.length);
  }

  console.log(ok ? "CHEST DROP SOURCE TEST OK" : "CHEST DROP SOURCE TEST FAILED");
`;

vm.runInContext(driver, ctx, { filename: "chest_drop_driver.js" });
