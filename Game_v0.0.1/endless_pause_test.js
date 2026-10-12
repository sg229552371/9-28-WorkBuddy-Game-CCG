/* ============================================================================
 * 21.19 W5 深渊「局内暂停菜单 + 主动退出」回归测试（node endless_pause_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   一、静态：index.html 冻结屏 #screen-abyss-pause / #abyss-pause-info /
 *              #btn-abyss-resume / #btn-abyss-quit 元素存在；模块契约方法齐全
 *   二、无 DOM 守卫：元素全缺 + 无 Game/G 时，全部新方法不抛异常、无副作用
 *   三、非深渊零影响：G.inEndless=false 时 show/hide/toggle 一律拒绝、Game.paused 不动
 *   四、深渊 show：返回 true、Game.paused=true、abyssPaused=true、屏显示、info 有内容
 *   五、深渊 hide：返回 true、Game.paused=false、abyssPaused=false、屏隐藏
 *   六、toggle 翻转：false→true→false
 *   七、quit：桩记录 exitEndlessToCity 恰被调用 1 次，且 G.inEndless 落回 false
 *   八、按钮绑定：initAbyssPause 后 onclick 可点，「继续」恢复、「放弃」走退出链路
 *
 * 风格参考 endless_flow_test.js / ui_flow_test.js（DOM 桩 + Node vm 沙箱）。
 * 汇总行中文；全文禁用英文 FAIL/Error 字样（用「未过」「异常」表达）。
 * ========================================================================== */
"use strict";

/* ---- DOM / Canvas 桩（同 ui_flow_test.js 范式） ---- */
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

/* ---- 计数器（跨沙箱共享） ---- */
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("【未过】" + name); }
}

/* ---- 0) 静态断言：冻结屏元素 + 模块契约 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
for (const id of ["screen-abyss-pause", "abyss-pause-info", "btn-abyss-resume", "btn-abyss-quit"]) {
  check("index.html 冻结屏含 id=" + id, htmlIds.has(id));
}
const modSrc = fs.readFileSync(path.join(__dirname, "js", "ui-abyss-pause.js"), "utf8");
for (const sig of ["UI.abyssPaused", "UI.showAbyssPause", "UI.hideAbyssPause", "UI.toggleAbyssPause", "UI.initAbyssPause", "exitEndlessToCity"]) {
  check("模块源码含契约 " + sig, modSrc.indexOf(sig) >= 0);
}
check("模块幂等防重（__abyssPauseLoaded）", modSrc.indexOf("__abyssPauseLoaded") >= 0);

/* ---- 1) 无 DOM 守卫：元素全缺时全部方法不抛异常 ---- */
{
  const ctx0 = vm.createContext({
    window: { addEventListener() { } },
    document: { getElementById: () => null, createElement: () => new FakeEl("x"), addEventListener() { }, body: null },
    requestAnimationFrame: () => { }, localStorage: global.localStorage, console,
  });
  const chain = ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/ui-abyss-pause.js"];
  for (const f of chain) vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx0, { filename: f });
  vm.runInContext(`
    let ok = true;
    try {
      UI.initAbyssPause();
      UI.showAbyssPause(); UI.hideAbyssPause(); UI.toggleAbyssPause(); UI.quitAbyssPause();
      if (UI.abyssPaused !== false) ok = false;   // 无 DOM 无副作用：状态不得翻转
    } catch (e) { ok = false; console.log("意外异常：" + e.message); }
    globalThis.__nullOk = ok;
    console.log(ok ? "空 DOM 健壮性 OK：全部暂停方法在元素缺失时未抛异常" : "空 DOM 场景出现异常");
  `, ctx0, { filename: "null-dom" });
  check("无 DOM 全方法调用未抛异常且无副作用", vm.runInContext("globalThis.__nullOk === true", ctx0) === true);
  check("无 DOM 沙箱中模块仍暴露完整契约", vm.runInContext("typeof UI !== 'undefined' && typeof UI.showAbyssPause === 'function'", ctx0) === true);
  check("无 DOM 沙箱 abyssPaused 保持 false", vm.runInContext("UI.abyssPaused === false", ctx0) === true);
}

/* ---- 2) 真实逻辑：加载完整脚本链（含本波次模块，位置在 rewards.js 之后、main.js 之前） ---- */
const CHAIN = ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js",
  "js/modes.js", "js/render.js", "js/stress.js", "js/endless.js", "js/hud_endless.js",
  "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js",
  "js/ui-abyss-pause.js", "js/main.js"];
const ctx = vm.createContext(global);
for (const f of CHAIN) {
  try {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    console.log("【跳过】" + f + " 加载异常：" + e.message);
  }
}

vm.runInContext(`
  globalThis.get = (id) => document.getElementById(id);
  globalThis.shown = (id) => !get(id).classList.contains("hidden");
  globalThis.click = (id) => { const b = get(id); if (typeof b.onclick !== "function") return false; b.onclick({}); return true; };
  get("screen-abyss-pause").classList.add("hidden");   // 桩元素初始态对齐真实 DOM（冻结屏默认 hidden）
  window.__quitCalls = 0;
  /* 桩记录：包装既有 exitEndlessToCity，验证 quit 链路确有调用（幂等防重不必） */
  if (typeof exitEndlessToCity === "function") {
    const realExit = exitEndlessToCity;
    exitEndlessToCity = function () { window.__quitCalls++; return realExit(); };
  }
`, ctx, { filename: "stub" });

/* ---- 3) 契约存在性（沙箱内；全局断言函数 ck 挂一次，供后续沙箱脚本复用） ---- */
vm.runInContext(`
  globalThis.ck = (n, ok) => { if (ok) { console.log("PASS " + n); globalThis.__ckPass = (globalThis.__ckPass || 0) + 1; }
    else { console.log("【未过】" + n); globalThis.__ckFail = (globalThis.__ckFail || 0) + 1; } };
  ck("UI.abyssPaused 初始为 false", UI.abyssPaused === false);
  ck("show/hide/toggle/init 五个契约方法齐全", [UI.showAbyssPause, UI.hideAbyssPause, UI.toggleAbyssPause, UI.initAbyssPause].every(f => typeof f === "function"));
`, ctx, { filename: "contract" });

/* ---- 4) 非深渊零影响 ---- */
vm.runInContext(`
  G.inEndless = false; Game.paused = false;
  ck("非深渊 show 被拒绝（返回 false）", UI.showAbyssPause() === false);
  ck("非深渊 show 不置 paused", Game.paused === false && UI.abyssPaused === false);
  ck("非深渊 toggle 被拒绝", UI.toggleAbyssPause() === false && Game.paused === false);
  ck("非深渊 hide 被拒绝且不动 paused", UI.hideAbyssPause() === false && Game.paused === false);
  ck("非深渊 quit 被拒绝且不调 exitEndlessToCity", UI.quitAbyssPause() === false && window.__quitCalls === 0);
  ck("非深渊时暂停屏保持隐藏", get("screen-abyss-pause").classList.contains("hidden"));
`, ctx, { filename: "non-abyss" });

/* ---- 5) 深渊内：show / hide / toggle ---- */
vm.runInContext(`
  G.inEndless = true; Game.paused = false;
  ck("深渊 show 返回 true", UI.showAbyssPause() === true);
  ck("show 置 Game.paused = true", Game.paused === true);
  ck("show 置 UI.abyssPaused = true", UI.abyssPaused === true);
  ck("show 后暂停屏可见", shown("screen-abyss-pause"));
  ck("show 后 info 填充了提示内容", get("abyss-pause-info").innerHTML.length > 0);

  ck("toggle 翻转：true→false（关面板恢复）", UI.toggleAbyssPause() === true && Game.paused === false && UI.abyssPaused === false && !shown("screen-abyss-pause"));
  ck("toggle 再翻：false→true", UI.toggleAbyssPause() === true && Game.paused === true && shown("screen-abyss-pause"));

  ck("hide 返回 true", UI.hideAbyssPause() === true);
  ck("hide 置 Game.paused = false", Game.paused === false);
  ck("hide 置 UI.abyssPaused = false", UI.abyssPaused === false);
  ck("hide 后暂停屏隐藏", !shown("screen-abyss-pause"));
`, ctx, { filename: "abyss-toggle" });

/* ---- 6) quit：桩记录 exitEndlessToCity 调用 ---- */
vm.runInContext(`
  G.inEndless = true;
  UI.showAbyssPause();
  window.__quitCalls = 0;
  ck("quit 返回 true", UI.quitAbyssPause() === true);
  ck("quit 恰好调用 exitEndlessToCity 1 次（桩记录）", window.__quitCalls === 1);
  ck("quit 后 G.inEndless = false", G.inEndless === false);
  ck("quit 后恢复 Game.paused = false", Game.paused === false);
  ck("quit 后暂停屏隐藏", get("screen-abyss-pause").classList.contains("hidden"));
`, ctx, { filename: "abyss-quit" });

/* ---- 7) 按钮绑定：initAbyssPause + 点击链路 ---- */
vm.runInContext(`
  G.inEndless = true; Game.paused = false;
  ck("initAbyssPause 返回 true", UI.initAbyssPause() === true);
  ck("继续/放弃按钮已绑定 onclick", typeof get("btn-abyss-resume").onclick === "function" && typeof get("btn-abyss-quit").onclick === "function");
  ck("重复 init 幂等不抛异常", UI.initAbyssPause() === true);

  /* 继续：show → 点继续 → 恢复 */
  UI.showAbyssPause();
  click("btn-abyss-resume");
  ck("点「继续」恢复：paused=false + 屏隐藏", Game.paused === false && UI.abyssPaused === false && get("screen-abyss-pause").classList.contains("hidden"));

  /* 放弃：show → 点放弃 → 走退出链路 */
  UI.showAbyssPause();
  window.__quitCalls = 0;
  click("btn-abyss-quit");
  ck("点「放弃」触发 quit：调 exitEndlessToCity 1 次且回主城", window.__quitCalls === 1 && G.inEndless === false);
`, ctx, { filename: "abyss-bind" });

/* ---- 汇总 ---- */
const sandbox = vm.runInContext("({ pass: globalThis.__ckPass || 0, fail: globalThis.__ckFail || 0 })", ctx, { filename: "sum" });
pass += sandbox.pass; fail += sandbox.fail;

console.log("");
console.log("＝＝＝＝＝ 测试汇总 ＝＝＝＝＝");
console.log("PASS 合计 = " + pass + "  失败 = " + fail);
if (fail > 0) { console.log("存在未过断言，请回查上方【未过】条目"); process.exitCode = 1; }
else console.log("全部断言通过：深渊暂停菜单契约（show/hide/toggle/quit/绑定/守卫）验收完成");
