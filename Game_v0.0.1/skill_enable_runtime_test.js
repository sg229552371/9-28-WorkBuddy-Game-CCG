/* ============================================================================
 * skill_enable_runtime_test.js —— 技能系统「正式启用」真实主循环回归
 *                              （node skill_enable_runtime_test.js）
 * ----------------------------------------------------------------------------
 * 【为什么必须单独有这一套】
 *   2026-10-12 事故：22.8 只把 `CFG.skillSystem.enabled` 翻成 true，**没接通整合层**
 *   （`SkillPlaytest` 是唯一包装 `SkillRuntime.ownsHero` 并懒注入 `hero.skillState` 的地方）。
 *   后果：`ownsHero` 返回 true → `game.js` 跳过旧施放逻辑 → 而新路径没有 builds →
 *   **英雄完全不开火，游戏无法玩**。
 *   当时的门禁（93 套全绿）、`verify_clone.sh`（21 文件全 ✅）**全都发现不了** ——
 *   因为既有测试只做「模块级」断言（编译产物 / 配置结构 / 界面 DOM），
 *   **没有任何一套真的把游戏跑起来、看英雄有没有开火**。
 *   本套补上这一层：按 index.html 顺序加载**全部**脚本 → 真实启动 → 跑主循环 → 数击杀。
 *
 * 覆盖：
 *   ① 全量脚本（含真实 ui.js）按 index.html 顺序可无异常装载
 *   ② **配表启用即接线**：不带任何 URL 参数打开 → SkillPlaytest 已包装 ownsHero
 *      （source === "config" / _patched === true）—— 事故的核心回归点
 *   ③ 真实启动 → 该英雄被判走新路径 + skillState 已注入且已编译 builds
 *   ④ **跑 10 秒主循环：英雄确实开火**（新路径效果实例被生成 + 产生击杀）
 *      —— 「游戏能玩」的硬证据
 *   ⑤ 界面联动：首帧即可取到水晶态（`_crystalModeOf` 必须在查 skillState **之前**
 *      先问 ownsHero，否则第一帧会误判旧路径）
 *   ⑥ 反向护栏：关掉配表开关 → 英雄回落旧路径，且**旧路径仍能开火**（不能两头空）
 *
 * ⚠️ PASS 文案禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

/* ---------------- DOM 桩（与 crystal_ui_test.js 同款） ---------------- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
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
    this._html = v;
    this.children.length = 0;
    this._q = null; this._qa = null;
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]);
      el.className = m[3];
      el._parent = this;
      this.children.push(el);
    }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  _findAll(cls, acc) {
    acc = acc || [];
    for (const c of this.children) {
      if (c.classList && c.classList.contains(cls)) acc.push(c);
      if (c._findAll) c._findAll(cls, acc);
    }
    return acc;
  }
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  querySelectorAll(sel) {
    this._qa = this._qa || {};
    if (!this._qa[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._qa[sel] = list;
      this._q = this._q || {};
      if (list.length && !this._q[sel]) this._q[sel] = list[0];
    }
    return this._qa[sel];
  }
  closest(sel) {
    const sels = String(sel).split(",").map(s => s.trim()).filter(Boolean);
    let el = this;
    while (el) {
      for (const s of sels) {
        if (s.charAt(0) === ".") { if (el.classList && el.classList.contains(s.slice(1))) return el; }
        else if (s.charAt(0) === "#") { if (el._id === s.slice(1)) return el; }
      }
      el = el._parent;
    }
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
Object.defineProperty(global.document, "body", { get() { return this.getElementById("body"); }, configurable: true });
const winHandlers = {};
global.window = {
  addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
  dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
  innerWidth: 1920, innerHeight: 1080,
};
/* ★ 关键：**不设 location.search** —— 模拟正式线上「不带任何参数打开」 */
global.location = { search: "", href: "https://example.invalid/", pathname: "/" };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};
const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- ① 全量脚本按 index.html 顺序装载（与浏览器同序） ---------------- */
const html = read("index.html");
const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
let loadErr = "";
const ctx = vm.createContext(global);
try { for (const f of scripts) vm.runInContext(read(f), ctx, { filename: f }); }
catch (e) { loadErr = (e && e.message) || "?"; }
check("① " + scripts.length + " 个脚本按 index.html 顺序可无异常装载", !loadErr);
if (loadErr) {
  console.log("载入期异常：" + loadErr);
  console.log("");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(1);
}
const ev = (code) => vm.runInContext(code, ctx);

/* ---------------- ② 配表启用即接线（事故核心回归点） ---------------- */
check("② 载入后总开关为启用（配表默认）", ev("CFG.skillSystem.enabled") === true);
check("② 迁移名单非空（首批试点 H001）",
  ev("CFG.skillSystem.migratedHeroIds.length") === 1 && ev('CFG.skillSystem.migratedHeroIds[0]') === "H001");
check("② ★不带 URL 参数也已接线：active = true", ev("SkillPlaytest.active") === true);
check("② ★接线来源标记为配表启用（source === \"config\"，非 url 试玩）", ev("SkillPlaytest.source") === "config");
check("② ★ownsHero 已被包装（_patched === true）—— 懒注入入口就位", ev("SkillPlaytest._patched") === true);
check("② 迁移名单取自配表（heroIds 与 CFG 一致）",
  ev("SkillPlaytest.heroIds.join()") === ev("CFG.skillSystem.migratedHeroIds.join()"));
check("② 未迁移英雄不接线（H002 仍走旧路径）",
  ev('SkillRuntime.ownsHero({ id: "H002" })') === false);

/* ---------------- ③ 真实启动：英雄走新路径 + skillState 已注入 ---------------- */
ev('G.canvas = document.getElementById("game-canvas"); G.ctx = G.canvas.getContext("2d");'
  + ' G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };'
  + ' Game.bindInput(); Game.bindEvents(); UI.selectedLevel = CFG.levels[0];'
  + ' Game.startRun([CFG.heroes[0]]); Game.skipIntroFreeze(); G.run.hp = 100000;');
check("③ 开局英雄 id = H001（首批试点本人）", ev("G.player.id") === "H001");
check("③ 该英雄被判走新路径", ev("SkillRuntime.ownsHero(G.player)") === true);
check("③ 首次判定即懒注入 skillState", ev("!!G.player.skillState") === true);
check("③ skillState 已编译出 builds（有技能可施放）",
  ev("!!(G.player.skillState && G.player.skillState.builds)") === true);
check("③ builds 覆盖初始技能 SK_FIREBALL",
  ev("!!(G.player.skillState.builds && G.player.skillState.builds.SK_FIREBALL)") === true);

/* ---------------- ④ ★真实主循环：英雄确实开火（「能玩」硬证据） ---------------- */
ev(`
  globalThis.__probe = (function () {
    const w = G.mainWorld;
    let maxFx = 0, framesWithFx = 0;
    let t = 0;
    Game.loop(t);                      // 手工登记主循环（跳过 boot）
    G.keys["d"] = true;
    for (let i = 0; i < 600; i++) {     // ~10 秒 @60fps
      t += 16.7; global.__raf(t);
      const fx = (w.__skillEffects) ? w.__skillEffects.length : 0;
      if (fx > maxFx) maxFx = fx;
      if (fx > 0) framesWithFx++;
    }
    G.keys["d"] = false;
    return { maxFx: maxFx, framesWithFx: framesWithFx, kills: G.run.kills, monsters: w.monsters.length };
  })();
`);
const probe = ev("globalThis.__probe");
check("④ 新路径效果实例被真实生成（同屏峰值 ≥ 1）", probe.maxFx >= 1);
check("④ 效果持续存在（有 ≥10 帧带效果，排除「飘一下就没了」）", probe.framesWithFx >= 10);
check("④ ★英雄真实开火并造成击杀（10 秒内 kills ≥ 1）—— 游戏可玩", probe.kills >= 1);

/* ---------------- ⑤ 界面联动：首帧即可取到水晶态 ---------------- */
check("⑤ 水晶态首帧可取（_crystalModeOf 非 null）",
  ev('UI._crystalModeOf({ id: "H001", rt: G.player }) !== null') === true);
check("⑤ 水晶面板 4 槽",
  ev('(function(){ var m = UI._crystalModeOf({ id: "H001", rt: G.player }); return m ? m.panel.slots.length : -1; })()') === 4);
/* 顺序缺陷专项：只给 id、不给 rt（无从预挂 skillState）→ 仍应靠 ownsHero 触发注入拿到数据 */
check("⑤ 仅传 id 也能取到（证明「先问 ownsHero 再查 skillState」的顺序正确）",
  ev('(function(){ var m = UI._crystalModeOf({ id: "H001", rt: G.player });'
    + ' if (!m) return false; UI._crystalCache = {};'
    + ' return UI._crystalModeOf({ id: "H001", rt: G.player }) !== null; })()') === true);
ev("UI._psSig = null; UI._psCache = null; UI.renderPartySkillbar();");
check("⑤ 技能栏行走水晶排布（crystal-row + 4 个 crystal-slot）",
  ev('String(document.getElementById("party-skillbar").children[0].className).indexOf("crystal-row") >= 0') === true &&
  ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".crystal-slot").length') === 4);
check("⑤ 1 个技能时不补空壳（仍 1 个图标）",
  ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-icon").length') === 1);

/* ---------------- ⑥ 反向护栏：关掉开关 → 回落旧路径且旧路径能开火 ---------------- */
ev(`
  globalThis.__probeOld = (function () {
    SkillPlaytest.reset();                       // 卸掉包装（ownsHero / triggerAltar）
    CFG.skillSystem.enabled = false;             // 配表开关关掉
    CFG.skillSystem.migratedHeroIds = [];
    const ownsNow = SkillRuntime.ownsHero({ id: "H001" });
    UI._crystalCache = {};
    Game.startRun([CFG.heroes[0]]); Game.skipIntroFreeze(); G.run.hp = 100000;
    const w = G.mainWorld;
    let t = 0; Game.loop(t); G.keys["d"] = true;
    for (let i = 0; i < 600; i++) { t += 16.7; global.__raf(t); }
    G.keys["d"] = false;
    return { ownsNow: ownsNow, crystal: UI._crystalModeOf({ id: "H001", rt: G.player }), kills: G.run.kills };
  })();
`);
const old = ev("globalThis.__probeOld");
check("⑥ 关掉开关后不再判走新路径", old.ownsNow === false);
check("⑥ 关掉开关后技能栏回落旧渲染（水晶态为 null）", old.crystal === null);
check("⑥ ★旧路径仍能开火（10 秒内 kills ≥ 1）—— 反向也不能两头空", old.kills >= 1);

console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
