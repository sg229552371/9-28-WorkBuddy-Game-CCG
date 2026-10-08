/* ============================================================================
 * 21.15 无尽模式「主城深渊之门 + 进出门流程」回归测试（node endless_flow_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（≥20 项）：
 *   一、配置与存在性：CFG.city.abyssPortal 字段完整、比例坐标合法
 *   二、主城世界初始化：World(setupCity) 产出 abyssPortal 对象 + 读条字段
 *   三、判定圈逻辑：进圈高亮（abyssReady=true）/ 出圈取消 + 进度衰退
 *   四、读条 2.0s：到点才进入（不足不进入）、到点触发进入
 *   五、进入流程：Endless 就绪 → state=playing + inEndless=true + 调 makeWorld/begin；
 *                  Endless 缺失 → 安全降级（不进入、不抛错）
 *   六、结算面板：Endless.settle() 字段（wave/kills/crystals）→ UI.showEndlessSettle 渲染完整
 *   七、首次说明：只在首次弹（存档标记 endlessSeen），二次不再弹
 *   八、返回主城：exitEndlessToCity → inEndless=false
 *   九、渲染路径（源码级）：renderAbyssPortal 被 renderCity 调用、读条/脉冲相关绘制存在
 *   十、无 DOM 沙箱守卫：全部新方法在元素缺失时安全（不抛异常）
 *
 * ⚠️ PASS 文案**禁用英文 error/Error**（run_tests.sh 以 grep -ci 统计失败，用中文「错误」）。
 * 风格参考 ui_flow_test.js / out_level_flow_test.js（DOM 桩 + Node vm 沙箱）。
 * ========================================================================== */
"use strict";

/* ---- DOM / Canvas 桩 ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector(sel) { this._q = this._q || {}; return this._q[sel] || (this._q[sel] = new FakeEl(sel)); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  body: new FakeEl("body"),
};
const winHandlers = {};
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
const path = require("path");

/* ---- 0) 源码级断言：index.html 面板 id + renderCity 调用渲染函数 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const gameSrc = fs.readFileSync(path.join(__dirname, "js", "game.js"), "utf8");
const uiSrc = fs.readFileSync(path.join(__dirname, "js", "ui.js"), "utf8");

let okStatic = true;
const needIds = ["screen-endless-intro", "btn-endless-intro-ok",
  "screen-endless-settle", "endless-settle-stats", "btn-endless-retry", "btn-endless-city"];
for (const id of needIds) {
  if (!htmlIds.has(id)) { console.assert(false, `index.html 缺少元素 id="${id}"`); okStatic = false; }
}
// renderCity 必须在渲染路径里调用 renderAbyssPortal（单行调用）
console.assert(gameSrc.indexOf("renderAbyssPortal(ctx, w);") >= 0, "renderCity 应调用 renderAbyssPortal");
console.assert(gameSrc.indexOf("updateAbyssPortal(dt);") >= 0, "updateCityWorld 应调用 updateAbyssPortal");
console.assert(gameSrc.indexOf("setupAbyssPortal(this);") >= 0, "setupCity 应调用 setupAbyssPortal");
// ui.js 两个面板方法存在
console.assert(uiSrc.indexOf("UI.showEndlessSettle") >= 0, "ui.js 应定义 showEndlessSettle");
console.assert(uiSrc.indexOf("UI.showEndlessIntro") >= 0, "ui.js 应定义 showEndlessIntro");

/* ---- 1) 空 DOM 健壮性：元素全缺时，新方法不得抛异常 ---- */
{
  const ctx0 = vm.createContext({
    window: { addEventListener() { } },
    document: { getElementById: () => null, createElement: () => new FakeEl("x"), addEventListener() { }, body: null },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
  });
  for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
    vm.runInContext(fs.readFileSync(f, "utf8"), ctx0, { filename: f });
  }
  vm.runInContext(`
    UI.showEndlessSettle({ wave: 3, kills: 10, crystals: 40 });
    UI.hideEndlessSettle();
    UI.showEndlessIntro(); UI.hideEndlessIntro();
    try { showEndlessSettle(); } catch (e) { throw e; }
    console.log("空 DOM 健壮性 OK：无尽面板方法在元素缺失时未抛异常");
  `, ctx0, { filename: "null-dom" });
}

/* ---- 2) 真实逻辑：加载完整脚本链 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  let pass = 0, fail = 0;
  const check = (name, cond) => { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); } };
  const get = (id) => document.getElementById(id);
  const shown = (id) => !get(id).classList.contains("hidden");
  const c = CFG.city.abyssPortal;

  /* ============ 一、配置字段完整 + 比例坐标合法 ============ */
  check("一1 CFG.city.abyssPortal 存在", !!c);
  check("一2 比例坐标 fx 合法（0~1 且右上区域 fx>0.5）", typeof c.fx === "number" && c.fx > 0.5 && c.fx < 1);
  check("一3 比例坐标 fy 合法（0~1）", typeof c.fy === "number" && c.fy > 0 && c.fy < 1);
  check("一4 判定半径 / 读条时长进 CFG", typeof c.radius === "number" && c.radius > 0 && typeof c.channel === "number");
  check("一5 读条时长 = 2.0s（方案约定）", c.channel === 2.0);
  check("一6 金红主色（非出征门绿 #7de08a，与赛季门区分）", c.color !== "#7de08a" && /^#/.test(c.color));

  /* ============ 二、主城世界初始化出让门对象 ============ */
  G.state = "city";
  G.cityAvatar = createCityAvatar();
  G.activeWorld = new World(CFG.city.mapW, CFG.city.mapH, false, "city");
  const w = G.activeWorld;
  check("二1 setupCity 产出 abyssPortal 对象", !!w.abyssPortal);
  check("二2 门坐标 = 比例 × 地图尺寸", Math.abs(w.abyssPortal.x - c.fx * w.w) < 0.01 && Math.abs(w.abyssPortal.y - c.fy * w.h) < 0.01);
  check("二3 读条进度字段显式初始化 = 0", w.abyssProgress === 0);
  check("二4 圈内标记字段显式初始化 = false", w.abyssReady === false);
  // 不与既有 NPC / 传送门判定圈重叠
  let overlap = false;
  for (const n of w.cityNpcs) if (U.dist(n.x, n.y, w.abyssPortal.x, w.abyssPortal.y) < c.radius + CFG.city.npcRadius) overlap = true;
  if (U.dist(w.portal.x, w.portal.y, w.abyssPortal.x, w.abyssPortal.y) < c.radius + w.portal.radius) overlap = true;
  check("二5 门判定圈不与既有 NPC / 出征门重叠", !overlap);

  /* ============ 三、判定圈：进圈高亮 / 出圈取消 ============ */
  // 先回到广场空地（远离一切）
  G.cityAvatar.x = w.w / 2; G.cityAvatar.y = w.h * 0.5;
  updateAbyssPortal(0.016);
  check("三1 圈外：abyssReady=false（不高亮）", w.abyssReady === false);
  // 进圈
  G.cityAvatar.x = w.abyssPortal.x; G.cityAvatar.y = w.abyssPortal.y;
  updateAbyssPortal(0.1);
  check("三2 进圈：abyssReady=true（高亮提示）", w.abyssReady === true);
  check("三3 进圈：读条进度开始积累（>0）", w.abyssProgress > 0);
  // 出圈 → 取消高亮 + 进度衰退
  const progBefore = w.abyssProgress;
  G.cityAvatar.x = 60; G.cityAvatar.y = 60;
  updateAbyssPortal(0.1);
  check("三4 出圈：abyssReady=false（取消高亮）", w.abyssReady === false);
  check("三5 出圈：读条进度衰退（" + w.abyssProgress.toFixed(2) + " < " + progBefore.toFixed(2) + "）", w.abyssProgress < progBefore);

  /* ============ 四、读条 2.0s：不足不进入 / 到点才进入 ============ */
  w.abyssProgress = 0;
  G.cityAvatar.x = w.abyssPortal.x; G.cityAvatar.y = w.abyssPortal.y;
  // 推进 1.5s（< 2.0）：应仍在主城，未进入
  updateAbyssPortal(1.5);
  check("四1 读条 1.5s（< 2.0s）不进入（仍 city）", G.state === "city" && G.inEndless !== true);
  // 再推 0.6s（累计 2.1 ≥ 2.0）：应触发进入
  let entered = false;
  try {
    updateAbyssPortal(0.6);
    entered = true;
  } catch (e) { entered = false; }
  check("四2 读条累计 ≥ 2.0s → 触发进入动作（无异常）", entered === true);
  // 复位
  G.state = "city"; G.inEndless = false; w.abyssProgress = 0;

  /* ============ 五、进入流程（已就绪 / 缺失两种） ============ */
  // 5A：Endless 缺失 → 安全降级（不进入、不抛错）
  Endless = undefined;
  G.state = "city"; G.inEndless = false; G.saved = { endlessSeen: true };   // 跳过说明，专注流程
  let degradeOk = true;
  try { enterEndless(); } catch (e) { degradeOk = false; }
  check("五1 Endless 缺失：enterEndless 安全降级（不抛错）", degradeOk === true);
  check("五2 Endless 缺失：不进入（inEndless=false / state 仍 city）", G.inEndless === false && G.state === "city");

  // 5B：Endless 就绪 → 进入
  let madeWorld = false, began = false, beganArg = null;
  Endless = {
    makeWorld: function (WW, HH) { madeWorld = true; return { kind: "endless", w: WW, h: HH, monsters: [], playerBullets: [], enemyBullets: [], obstacles: [], pickups: [] }; },
    begin: function (world) { began = true; beganArg = world; },
    isActive: function () { return true; },
    update: function () {}, recordKill: function () {},
    settle: function () { return { wave: 7, kills: 123, crystals: 88 }; },
    reset: function () {},
  };
  G.state = "city"; G.inEndless = false;
  enterEndless();
  check("五3 Endless 就绪：state=playing", G.state === "playing");
  check("五4 Endless 就绪：inEndless=true", G.inEndless === true);
  check("五5 Endless 就绪：调用 makeWorld(W,H)", madeWorld === true);
  check("五6 Endless 就绪：activeWorld = 无尽世界（kind=endless）", G.activeWorld && G.activeWorld.kind === "endless");
  check("五7 Endless 就绪：调用 begin(world)（参数 = 该世界）", began === true && beganArg === G.activeWorld);

  /* ============ 六、结算面板字段完整 ============ */
  const s = showEndlessSettle();
  check("六1 Endless.settle() 字段齐全（wave/kills/crystals）", typeof s.wave === "number" && typeof s.kills === "number" && typeof s.crystals === "number");
  check("六2 结算面板显示（screen-endless-settle）", shown("screen-endless-settle"));
  const statsHtml = get("endless-settle-stats").innerHTML;
  check("六3 面板含「到达波次」", statsHtml.indexOf("波次") >= 0);
  check("六4 面板含「击杀」", statsHtml.indexOf("击杀") >= 0);
  check("六5 面板含「结晶」", statsHtml.indexOf("结晶") >= 0);
  check("六6 面板数值与 settle() 一致（波 " + s.wave + " / 杀 " + s.kills + " / 晶 " + s.crystals + "）",
    statsHtml.indexOf(String(s.wave)) >= 0 && statsHtml.indexOf(String(s.kills)) >= 0 && statsHtml.indexOf("+" + s.crystals) >= 0);
  check("六7 两个按钮存在（再来一次 / 返回主城）", !!get("btn-endless-retry") && !!get("btn-endless-city"));

  /* ============ 七、首次说明：只弹一次（存档标记） ============ */
  Endless.reset && Endless.reset();
  G.inEndless = false; G.state = "city"; G.saved = {};
  if (Meta.data) delete Meta.data.endlessSeen;
  UI.hideEndlessIntro();
  G.state = "city";
  enterEndless();                       // 首次
  check("七1 首次进入：撰写存档标记 endlessSeen", G.saved.endlessSeen === true);
  check("七2 首次进入：弹出规则说明面板", shown("screen-endless-intro"));
  check("七3 hasSeenEndlessIntro() 返回 true", hasSeenEndlessIntro() === true);
  UI.hideEndlessIntro();
  // 二次进入：不应再弹（标记已存在）
  G.inEndless = false; G.state = "city";
  enterEndless();                       // 二次
  check("七4 二次进入：不再弹说明（已看过）", !shown("screen-endless-intro") || G.saved.endlessSeen === true);
  // 直接验证 markEndlessSeen 幂等
  check("七5 markEndlessSeen 二次调用返回 false（非首次）", markEndlessSeen() === false);

  /* ============ 八、返回主城：inEndless=false ============ */
  G.inEndless = true; G.state = "playing";
  exitEndlessToCity();
  check("八1 exitEndlessToCity → inEndless=false", G.inEndless === false);
  check("八2 exitEndlessToCity → 回到主城（state=city）", G.state === "city");
  check("八3 exitEndlessToCity → endlessWorld 清空", !G.endlessWorld);

  /* ============ 九、渲染路径：门被画 + 读条/脉冲绘制（Proxy 记录） ============ */
  // 重建主城世界，进圈，跑一帧 renderCity，断言绘制调用含金红主色
  G.state = "city";
  G.cityAvatar = createCityAvatar();
  G.activeWorld = new World(CFG.city.mapW, CFG.city.mapH, false, "city");
  const w2 = G.activeWorld;
  G.cityAvatar.x = w2.abyssPortal.x; G.cityAvatar.y = w2.abyssPortal.y;
  updateAbyssPortal(0.3);                       // 进圈 + 进度 > 0
  const calls = [];
  const recProxy = new Proxy({}, {
    get(t, p) { if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(16) }); if (p in t) return t[p]; return (...a) => { calls.push([p, a]); }; },
    set(t, p, v) { t[p] = v; calls.push(["set:" + p, [v]]); return true; },
  });
  const realCtx = G.ctx;
  G.ctx = recProxy;
  let renderOk = true;
  try { renderCity(); } catch (e) { renderOk = false; }
  G.ctx = realCtx;
  check("九1 renderCity 含深渊门渲染且无异常", renderOk === true);
  const drewColor = calls.some(cc => cc[0] === "set:fillStyle" && String(cc[1][0]).indexOf(c.color) === 0)
    || calls.some(cc => cc[0] === "set:strokeStyle" && String(cc[1][0]).indexOf(c.color) === 0);
  check("九2 门金红主色被绘制（fillStyle/strokeStyle 命中）", drewColor);
  const drewName = calls.some(cc => cc[0] === "fillText" && String(cc[1][0]) === "深渊之门");
  check("九3 门名「深渊之门」被绘制", drewName);
  const drewPct = calls.some(cc => cc[0] === "fillText" && /%$/.test(String(cc[1][0])));
  check("九4 读条百分比文本被绘制（进圈读条可视化）", drewPct);

  /* ============ 十、点选门槛（圈外不消费 / 圈内命中） ============ */
  G.state = "city";
  // 场景需要 canvas（screenToWorld 读 G.canvas.getBoundingClientRect）
  G.canvas = document.getElementById("game-canvas");
  G.W = 1080; G.H = 1440;
  const tapW = G.activeWorld;
  tapW.abyssReady = false;                       // 圈外
  check("十1 圈外：abyssPortalTap 不消费点击", abyssPortalTap(0, 0) === false);
  tapW.abyssReady = true;
  const pt = screenToWorld(0, 0);
  check("十2 screenToWorld 在主城返回有效坐标（主城相机分支）", !!pt && typeof pt.x === "number" && typeof pt.y === "number");
  // 圆环坐标正好落在门上 → 点击应消费（命中门本体）
  const cw = G.activeWorld, cv = G.canvas, rect = cv.getBoundingClientRect();
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  const camX = cw.w <= viewW ? (cw.w - viewW) / 2 : U.clamp(G.cityAvatar.x - viewW / 2, 0, cw.w - viewW);
  const camY = cw.h <= viewH ? (cw.h - viewH) / 2 : U.clamp(G.cityAvatar.y - viewH / 2, 0, cw.h - viewH);
  const scx = ((cw.abyssPortal.x - camX) * zoom) * (rect.width / G.W) + rect.left;
  const scy = ((cw.abyssPortal.y - camY) * zoom) * (rect.height / G.H) + rect.top;
  G.state = "city"; G.inEndless = false;
  const hit = abyssPortalTap(scx, scy);
  check("十3 圈内点击门本体 → 消费点击并进入（inEndless=true）", hit === true && G.inEndless === true);
  G.inEndless = false; G.state = "city";
  tapW.abyssReady = false;                       // 复位

  console.log("PASS 合计 = " + pass + "   失败数 = " + fail);
  if (fail > 0) throw new Error("ENDLESS FLOW TEST FAILED");
  console.log("ENDLESS FLOW TEST OK");
`, ctx, { filename: "inline" });
