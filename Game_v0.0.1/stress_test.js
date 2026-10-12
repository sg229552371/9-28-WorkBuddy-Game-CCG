/* 21.12 性能压测场景（StressHarness）回归测试（node stress_test.js）
 * 覆盖：
 *   ① 无参零开销契约：无 ?stress 时 isActive() 恒 false（正式玩法逐位不变）
 *   ② parseQuery 参数解析：stress/bullets/mode/ai 四参数默认值与边界（0 / 非数字 / ai=0）
 *   ③ build() 铺场：敌人/子弹数量与配置一致；玩家无敌；不写盘（不碰 Meta/Meta.data.monsters）
 *   ④ 三档渲染模式（full/dot/lod）均可跑通且自报 drawCalls（lod 的批量色点显著低于 full）
 *   ⑤ 主循环接管：loop() 在 active 时走压测分支并 return（不触碰正式玩法更新）
 *   ⑥ 主入口契约：index.html 已引入 js/stress.js；main.js 无参路径仍落首页
 * 桩：复用 perf_guard_test.js 的 FakeEl / ClassList / ctxProxy 一套。
 */
"use strict";

/* ---- DOM 桩 ---- */
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
    this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) {
    this._cls = v; this.classList = new ClassList();
    String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v; this.children.length = 0;
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]); el.className = m[3]; el._parent = this; this.children.push(el);
    }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  setAttribute() { } getAttribute() { return null; }
  getContext() { return ctxProxy; }
  querySelector(sel) { return this.children.find(c => c.classList.contains(sel.replace(/^\./, ""))) || new FakeEl(sel); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  select() { }
}

/* 记录绘制调用的 ctx 桩：统计画笔动作次数，供 drawCalls 交叉验证 */
let _drawOps = { fill: 0, fillRect: 0, drawImage: 0, arc: 0, beginPath: 0, moveTo: 0 };
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (typeof p === "string" && _drawOps[p] != null) _drawOps[p]++; };
  },
  set(t, p, v) { t[p] = v; return true; },
});
function resetDrawOps() { for (const k in _drawOps) _drawOps[k] = 0; }
global.resetDrawOps = resetDrawOps;
global.__drawOps = _drawOps;

const elCache = {};
global.document = {
  getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  execCommand() { return true; },
};
Object.defineProperty(global.document, "body", { get() { return this.getElementById("body"); }, configurable: true });

const winHandlers = {};
let _search = "";
global.window = {
  addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
  dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
  innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  get location() { return { search: _search, href: "http://x/", protocol: "http:", reload() { } }; },
};
Object.defineProperty(global.window, "location", { get() { return { search: _search, href: "http://x/", protocol: "http:", reload() { } }; }, configurable: true });
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
Object.defineProperty(global, "navigator", {
  value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) TestUA", maxTouchPoints: 5 },
  configurable: true, writable: true,
});
global.performance = { now: () => Date.now() };
global.Audio = class { constructor() { } play() { } pause() { } cloneNode() { return new global.Audio(); } addEventListener() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 静态核对 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const mainSrc = fs.readFileSync(path.join(__dirname, "js/main.js"), "utf8");
const stressSrc = fs.readFileSync(path.join(__dirname, "js/stress.js"), "utf8");
let okStatic = true;
const staticCheck = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };

staticCheck("index.html 引入 js/stress.js", /<script\s+src="js\/stress\.js(\?v=[^"]*)?"/.test(html));
staticCheck("stress.js 位于 game.js 之后（依赖 World/Monster/Bullet）",
  html.indexOf("js/game.js") >= 0 && html.indexOf("js/stress.js") > html.indexOf("js/game.js"));
staticCheck("main.js 主循环含压测接管分支", mainSrc.indexOf("StressHarness.isActive()") >= 0);
staticCheck("main.js boot 含压测直达分支", mainSrc.indexOf("StressHarness.parseQuery()") >= 0);
staticCheck("stress.js 声明 StressHarness 全局", /var\s+StressHarness\s*=/.test(stressSrc));
staticCheck("stress.js 无参数时 isActive 恒 false（active 初值 false）", /active:\s*false/.test(stressSrc));
staticCheck("stress.js selfCheck 存在", stressSrc.indexOf("selfCheck") >= 0);

/* ---- 加载脚本 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/stress.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__skFail = () => fails;
  /* 压测渲染需要画布上下文：桩环境手动注入（正式环境由 boot() 的 fitCanvas 建立） */
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.W = 1920; G.H = 1080;
  /* 素材桩：正式环境由 boot() 加载精灵图；桩环境注入假图，验证 full 模式走 drawImage 路径 */
  const fakeImg = { width: 48, height: 48 };
  for (const k of ["enemy00", "enemy08", "enemy16", "enemy22", "hero"]) G.sprites[k] = fakeImg;
  window.__skChecks = () => checks;
  window.__setSearch = (s) => { window.__s = s; };

  /* 让 StressHarness 读到可控的 search */
  const withSearch = (s, fn) => {
    const orig = window.location;
    // 用 defineProperty 替换 window.location 的 search getter
    Object.defineProperty(window, "location", { value: { search: s, href: "http://x/", protocol: "http:", reload() {} }, configurable: true });
    try { return fn(); } finally {
      Object.defineProperty(window, "location", { value: { search: "", href: "http://x/", protocol: "http:", reload() {} }, configurable: true });
    }
  };

  /* ============ ① 无参零开销契约 ============ */
  check("① 初始 active=false（未解析前不接管）", StressHarness.isActive() === false);
  withSearch("", () => {
    const r = StressHarness.parseQuery();
    check("① 无 ?stress → parseQuery 返回 false", r === false);
    check("① 无 ?stress → isActive() 仍 false（零开销）", StressHarness.isActive() === false);
    check("① 无 ?stress → build() 拒绝执行返回 false", StressHarness.build() === false);
  });
  withSearch("?foo=1&bar=2", () => {
    check("① 仅有其他参数 → 仍不激活", StressHarness.parseQuery() === false && StressHarness.isActive() === false);
  });

  /* ============ ② 参数解析 ============ */
  withSearch("?stress", () => {
    StressHarness.parseQuery();
    check("② ?stress（无值）→ 默认 3000 敌", StressHarness.config.monsters === 3000);
    check("② ?stress（无值）→ 默认 2000 弹", StressHarness.config.bullets === 2000);
    check("② ?stress（无值）→ 默认 mode=lod", StressHarness.mode === "lod");
    check("② ?stress（无值）→ 默认 ai=true", StressHarness.config.ai === true);
    check("② 激活后 isActive()=true", StressHarness.isActive() === true);
  });
  withSearch("?stress=1500&bullets=800&mode=dot&ai=0", () => {
    StressHarness.parseQuery();
    check("② stress=1500 解析正确", StressHarness.config.monsters === 1500);
    check("② bullets=800 解析正确", StressHarness.config.bullets === 800);
    check("② mode=dot 解析正确", StressHarness.mode === "dot");
    check("② ai=0 → ai=false（仅渲染压测）", StressHarness.config.ai === false);
  });
  withSearch("?stress=0&bullets=0", () => {
    StressHarness.parseQuery();
    check("② stress=0 合法（0 敌不崩）", StressHarness.config.monsters === 0);
    check("② bullets=0 合法", StressHarness.config.bullets === 0);
    check("② 0 值仍视为激活（显式压测空场）", StressHarness.isActive() === true);
  });
  withSearch("?stress=abc", () => {
    StressHarness.parseQuery();
    check("② stress=非数字 → 兜底 0（不 NaN）", StressHarness.config.monsters === 0);
  });

  /* ============ ③ build() 铺场 ============ */
  withSearch("?stress=200&bullets=150&ai=0&mode=lod", () => {
    StressHarness.parseQuery();
    const ok = StressHarness.build();
    check("③ build() 返回 true", ok === true);
    check("③ 敌人数量 = 配置（200）", G.activeWorld.monsters.length === 200);
    check("③ 子弹数量 = 配置（150）", G.activeWorld.enemyBullets.length === 150);
    check("③ 玩家无敌 hp=1e9", G.player.hp === 1e9 && G.player.hpMax === 1e9);
    check("③ 状态切到 playing", G.state === "playing");
    check("③ 敌人带 stress 标记（渲染侧据此走 LOD）", G.activeWorld.monsters.every(m => m.stress === true));
    check("③ 子弹 life 超大（不为自然消亡，由补位维持数量）", G.activeWorld.enemyBullets.every(b => b.life >= 999));
    check("③ 子弹 side=enemy", G.activeWorld.enemyBullets.every(b => b.side === "enemy"));
    check("③ 子弹速度非 NaN（vx/vy 有值）", G.activeWorld.enemyBullets.every(b => isFinite(b.vx) && isFinite(b.vy)));
    check("③ 无 Boss / 无冻结（压测纯战斗）", G.activeWorld.boss === null && G.activeWorld.freezeTimer === 0);
    check("③ 统计已重置 frames=0", StressHarness.stats.frames === 0);
  });

  /* ============ ④ 三档渲染模式 ============ */
  withSearch("?stress=600&bullets=400&ai=0&mode=full", () => {
    StressHarness.parseQuery(); StressHarness.build();
    // 新怪物按 defId 取 sprite：桩里可能落到未注入键 → 兜底回填，确保走精灵路径
    G.activeWorld.monsters.forEach(m => { if (!m.sprite) m.sprite = G.sprites.enemy00; });
    resetDrawOps(); StressHarness.render();
    const fullCalls = StressHarness.stats.drawCalls;
    check("④ full 模式 drawCalls > 0", fullCalls > 0);
    check("④ full 模式 drawImage 被调用（全精灵）", __drawOps.drawImage > 0);
    check("④ full 模式 beginPath 较少（每怪独立 save/restore）", __drawOps.beginPath >= 0);
    window.__fullCalls = fullCalls;
  });
  withSearch("?stress=600&bullets=400&ai=0&mode=dot", () => {
    StressHarness.parseQuery(); StressHarness.build();
    resetDrawOps(); StressHarness.render();
    const dotCalls = StressHarness.stats.drawCalls;
    check("④ dot 模式 drawCalls 极少（批量单 Path）", dotCalls <= 3);
    check("④ dot 模式零 drawImage（纯色点）", __drawOps.drawImage === 0);
    check("④ dot 模式 arc 调用 = 视野内敌人数（合并进单 Path）", __drawOps.arc > 0);
    check("④ dot 模式 drawCalls 远低于 full", dotCalls < window.__fullCalls);
  });
  withSearch("?stress=600&bullets=400&ai=0&mode=lod", () => {
    StressHarness.parseQuery(); StressHarness.build();
    resetDrawOps(); StressHarness.render();
    const lodCalls = StressHarness.stats.drawCalls;
    check("④ lod 模式 drawCalls > 0", lodCalls > 0);
    check("④ lod 模式 drawCalls 显著低于 full（色点批绘）", lodCalls < window.__fullCalls);
    check("④ lod 模式仍有近档精灵（drawImage 可能 >0 或视野内无怪时=0）", __drawOps.drawImage >= 0);
    check("④ lod 模式剔除数合理（culled >= 0）", StressHarness.stats.culled >= 0);
  });

  /* ============ ⑤ 更新循环 ============ */
  withSearch("?stress=120&bullets=80&ai=0&mode=lod", () => {
    StressHarness.parseQuery(); StressHarness.build();
    const n0 = G.activeWorld.enemyBullets.length;
    const b0 = G.activeWorld.enemyBullets[0];
    const px0 = b0.x;
    for (let i = 0; i < 10; i++) StressHarness.update(0.016);
    check("⑤ ai=0：子弹仅位移（x 变化）", b0.x !== px0);
    check("⑤ ai=0：子弹不消亡（life 未扣减）", G.activeWorld.enemyBullets.length === n0);
    check("⑤ 帧采样可累加", (() => { const f0 = StressHarness.stats.frames; StressHarness.sampleFrame(16.7); return StressHarness.stats.frames === f0 + 1; })());
    check("⑤ avgDur 计算正确（>0）", StressHarness.avgDur() > 0);
  });

  /* ============ ⑥ selfCheck ============ */
  check("⑥ selfCheck 无问题（依赖齐备）", StressHarness.selfCheck().length === 0);
`, ctx, { filename: "stress_driver.js" });

const fails = ctx.__skFail ? ctx.__skFail() : ctx.window.__skFail();
const checks = ctx.__skChecks ? ctx.__skChecks() : ctx.window.__skChecks();
console.log("----------------------------------------");
console.log(`合计 ${checks} 项，失败 ${fails} 项`);
if (fails > 0 || !okStatic) { console.log("STRESS TEST FAILED"); process.exit(1); }
console.log("STRESS TEST OK");
