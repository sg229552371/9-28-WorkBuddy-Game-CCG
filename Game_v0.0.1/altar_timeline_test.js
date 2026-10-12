/* 无头测试：26.x 祭坛时间轴调度（node altar_timeline_test.js）
 * 覆盖：
 *   一、关卡表时间轴结构（10 关均配 altarTimeline；t 递增；条目合法；宝箱不在开局 10 秒）
 *   二、主关卡开局 0 座（旧「开局随机 5 座」已废）+ 开场冻结期不计时不投放
 *   三、冻结结束后到点投放（固定指定 / 随机池）+ 走完全部条目数 == 条目数
 *   四、随机池过滤：非法 id 剔除；全非法则不投
 *   五、深渊/无尽周期式时间轴（首刷延迟 + 间隔；线性递增）
 *   六、三处投放点收敛到公共 placeAltar（modes 复用；深渊 populate 开局不投）
 * 运行：node altar_timeline_test.js
 * ⚠️ PASS 文案只含中文，禁止出现英文 error/FAIL（门禁口径，坑 4）。 */
"use strict";

/* ---- DOM / Canvas 桩（与 battle_rules_test.js 同款） ---- */
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
global.window = { addEventListener() { }, innerWidth: 1920, innerHeight: 1080 };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice() { }, onLevelUpChoiceClose() { } };

const fs = require("fs"), vm = require("vm");
/* 源码层断言：rollAbyssAltars 复用公共 placeAltar（三处投放点收敛）。 */
global.__modesUsesPlaceAltar = fs.readFileSync("js/modes.js", "utf8").indexOf("placeAltar(w, id)") >= 0;

const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js", "js/endless.js", "js/endless-arena.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  /* ============ 一、关卡表时间轴结构 ============ */
  const L = CFG.levels;
  check("一1 主关卡每关均配 altarTimeline（非空数组，共 " + L.length + " 关）",
    L.length >= 10 && L.every(l => Array.isArray(l.altarTimeline) && l.altarTimeline.length >= 1));
  let structOk = true, chestOk = true;
  for (const lv of L) {
    let prev = -1;
    for (const e of lv.altarTimeline) {
      if (typeof e.t !== "number" || e.t <= prev) structOk = false;      // t 严格递增
      prev = e.t;
      const hasId = typeof e.id === "string" && !!CFG.altars[e.id];
      const hasPool = Array.isArray(e.pool) && e.pool.length > 0 && e.pool.every(x => !!CFG.altars[x]);
      if (!hasId && !hasPool) structOk = false;                          // 固定 id 或随机池二选一
      const chest = e.id === "ALTAR_003" || (Array.isArray(e.pool) && e.pool.indexOf("ALTAR_003") >= 0);
      if (chest && e.t < 10) chestOk = false;                            // 宝箱不在开局 10 秒内
    }
  }
  check("一2 每关 t 严格递增且条目合法（固定 id / 随机池）", structOk);
  check("一3 宝箱（ALTAR_003）不在开局 10 秒内投放", chestOk);

  /* ============ 二、主关卡开局 0 座 + 冻结期不计时 ============ */
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  if (Game.skipLevelUpChoice) Game.skipLevelUpChoice();
  const w = G.mainWorld;
  check("二1 开局无祭坛（旧「开局随机 5 座」已废）",
    w.altars.length === 0 && w.altarClock === 0 && w._altarIdx === 0);
  check("二2 主关卡开场进入冻结（freezeTimer > 0）", w.freezeTimer > 0);
  updateAltarTimeline(w, 1000);   // 冻结期给足时间
  check("二3 冻结期不计时（altarClock 保持 0）", w.altarClock === 0);
  check("二4 冻结期不投放祭坛", w.altars.length === 0);

  /* ============ 三、冻结结束后到点投放 ============ */
  Game.skipIntroFreeze();
  check("三1 跳过冻结后 altarClock = 0 / _altarIdx = 0", w.altarClock === 0 && w._altarIdx === 0);
  const tl = CFG.levels[0].altarTimeline;
  w.altarClock = tl[0].t - 0.5;      // 定位到首条前
  updateAltarTimeline(w, 0.25);      // 未跨过首条
  check("三2 未到首条时刻不投放（" + w.altars.length + " 座）", w.altars.length === 0);
  updateAltarTimeline(w, 0.5);       // 跨过首条
  check("三3 到点投首条固定指定祭坛（" + (w.altars[0] && w.altars[0].id) + "）",
    w.altars.length === 1 && w.altars[0].id === tl[0].id && w._altarIdx === 1);
  w.altarClock = tl[tl.length - 1].t + 1;   // 一次性越过全部条目
  updateAltarTimeline(w, 0);
  check("三4 走完全部时间轴 → 总投放 == 条目数（" + w.altars.length + "/" + tl.length + "）",
    w.altars.length === tl.length && w._altarIdx === tl.length);
  const poolEntry = tl.filter(e => Array.isArray(e.pool))[0];
  check("三5 随机池条目落地 id 属于其池",
    !poolEntry || w.altars.some(a => poolEntry.pool.indexOf(a.id) >= 0));

  /* ============ 四、随机池过滤 ============ */
  const mkWorld = () => ({ kind: "endless", altars: [], freezeTimer: 0, altarClock: 0,
    _altarNextT: null, findFreeSpot: () => null, w: 1920, h: 1920 });
  const wf = mkWorld();
  const r1 = spawnAltarFromSpec(wf, { pool: ["NOPE", "ALTAR_001"], pick: 1 });
  check("四1 池内非法 id 被剔除，只投合法项（" + (r1 && r1.id) + "）", !!r1 && r1.id === "ALTAR_001");
  check("四2 池全为非法 id → 不投放返回 null", spawnAltarFromSpec(mkWorld(), { pool: ["NOPE1", "NOPE2"], pick: 1 }) === null);

  /* ============ 五、深渊/无尽周期式时间轴 ============ */
  const c = CFG.endless.altarTimeline;
  check("五1 无尽时间轴启用（enabled + firstDelay + interval + 非空池）",
    c && c.enabled === true && c.firstDelay > 0 && c.interval > 0 && Array.isArray(c.pool) && c.pool.length > 0);
  const we = mkWorld();
  updateAltarTimeline(we, c.firstDelay - 0.5);
  check("五2 未到首刷延迟不投放（" + we.altars.length + " 座）", we.altars.length === 0);
  updateAltarTimeline(we, 1);
  check("五3 跨过首刷延迟投 1 座且 id 属于池（" + (we.altars[0] && we.altars[0].id) + "）",
    we.altars.length === 1 && c.pool.indexOf(we.altars[0].id) >= 0);
  updateAltarTimeline(we, c.interval);
  check("五4 再跨一个间隔 → 共 2 座（周期式）", we.altars.length === 2);
  updateAltarTimeline(we, c.interval * 3);
  check("五5 多个间隔 → 按周期线性递增（" + we.altars.length + " 座）", we.altars.length === 5);
  const woff = mkWorld();
  const savedEnabled = c.enabled; c.enabled = false;
  updateAltarTimeline(woff, 9999);
  check("五6 enabled=false → 周期式停用（不投放）", woff.altars.length === 0);
  c.enabled = savedEnabled;

  /* ============ 六、三处投放点收敛 ============ */
  check("六1 公共投放函数齐备（placeAltar / spawnAltarFromSpec / updateAltarTimeline）",
    typeof placeAltar === "function" && typeof spawnAltarFromSpec === "function" && typeof updateAltarTimeline === "function");
  check("六2 modes.rollAbyssAltars 复用公共 placeAltar（无二次拷贝）", __modesUsesPlaceAltar === true);
  const wArena = mkWorld();
  if (typeof EndlessArena !== "undefined" && EndlessArena.populate) EndlessArena.populate(wArena);
  check("六3 深渊 populate 开局不投祭坛（改由时间轴周期式；" + wArena.altars.length + " 座）", wArena.altars.length === 0);

  if (!ok) throw new Error("altar_timeline_test 存在失败断言");
  console.log("ALTAR TIMELINE TEST OK");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
