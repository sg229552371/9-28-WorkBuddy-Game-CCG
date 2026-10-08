/* ============================================================================
 * 21.18 深渊「再来一次」重开安全回归测试（node endless_restart_test.js）
 * ----------------------------------------------------------------------------
 * 背景：用户反馈「重开深渊 + 玩家被秒杀」。本测试用**真实脚本链**（含 endless.js）
 *   复现完整路径：进深渊 → 跑若干秒（怪刷出）→ 真实死亡结算 → 再来一次 ×N，
 *   逐项断言重开后**不留上一局残留**，把「重开安全」这条不变量钉死。
 *
 * 覆盖：
 *   一、重开前置：进深渊后基线正确（满血 / kind=endless / wave=1 / 居中）
 *   二、跑 10 秒：怪确实刷出（>0）、波次推进、时限递减（确认「真在跑」）
 *   三、真实死亡：onPlayerDeath → state="dead"
 *   四、再来一次：满血 / 场清零 / 波次归 1 / 位置居中 / paused 解除（= 无「秒杀」残留）
 *   五、连续重开 3 次：数值不累积、不漂移（防跨局泄漏）
 *
 * ⚠️ PASS 文案**禁用英文 error/Error**（run_tests.sh 以 grep -ci 统计失败，用中文「错误」）。
 * 风格参考 endless_flow_test.js（DOM 桩 + Node vm 沙箱）。
 * ========================================================================== */
"use strict";
const fs = require("fs"), vm = require("vm");
const path = require("path");

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
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

/* ---- 加载完整脚本链（按 index.html 顺序；必须含 endless.js） ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js",
  "js/render.js", "js/stress.js", "js/endless.js", "js/hud_endless.js", "js/ui.js", "js/ui-screens.js",
  "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

const out = vm.runInContext(`
  var pass = 0, fail = 0;
  function check(name, ok) {
    if (ok) { pass++; console.log("PASS " + name); }
    else { fail++; console.log("FAIL " + name); }
  }
  /* 快照：重开安全相关的全部关键字段 */
  function snap() {
    var st = (typeof computeStats === "function" && G.run) ? computeStats() : null;
    return {
      state: G.state,
      paused: !!Game.paused,
      inEndless: !!G.inEndless,
      kind: G.activeWorld && G.activeWorld.kind,
      hp: G.run ? G.run.hp : null,
      hpMax: st ? st.hpMax : null,
      monsters: (G.activeWorld && G.activeWorld.monsters) ? G.activeWorld.monsters.length : -1,
      px: G.player ? G.player.x : null,
      py: G.player ? G.player.y : null,
      wave: Endless.state.wave,
      timeLeft: Endless.timeLeft(),
      bossIdx: Endless.state.bossIndex,
    };
  }

  /* ============ 一、进深渊基线 ============ */
  Game.enterCity();
  check("一1 进主城：state=city / activeWorld.kind=city", G.state === "city" && G.activeWorld.kind === "city");
  enterEndless();
  if (UI.hideEndlessIntro) UI.hideEndlessIntro();          /* 关掉首次说明（解除弹窗暂停） */
  var b = snap();
  check("一2 进深渊：state=playing", b.state === "playing");
  check("一3 进深渊：activeWorld.kind=endless / inEndless=true", b.kind === "endless" && b.inEndless === true);
  check("一4 进深渊：满血（hp = hpMax，无残血进位）", b.hp === b.hpMax && b.hp > 0);
  check("一5 进深渊：波次归 1 / 时限为满", b.wave === 1 && Math.abs(b.timeLeft - CFG.endless.timeLimit) < 0.001);
  check("一6 进深渊：无开局弹窗暂停残留", b.paused === false);

  /* ============ 二、跑 10 秒：确认深渊「真的在跑」 ============ */
  var w = G.activeWorld;
  for (var i = 0; i < 600; i++) Endless.update(w, 1 / 60);
  var r = snap();
  check("二1 跑 10 秒：怪物确实刷出（>0）", r.monsters > 0);
  check("二2 跑 10 秒：波次推进（>1）", r.wave > 1);
  check("二3 跑 10 秒：总时限递减", r.timeLeft < CFG.endless.timeLimit - 9);

  /* ============ 三、真实死亡流程 ============ */
  G.run.hp = 0;
  onPlayerDeath();
  var d = snap();
  check("三1 真实死亡：state=dead", d.state === "dead");

  /* ============ 四、再来一次：不得留上一局残留（核心不变量） ============ */
  restartEndless();
  var a1 = snap();
  check("四1 再来一次：回到 playing / kind=endless", a1.state === "playing" && a1.kind === "endless");
  check("四2 再来一次：**满血**（无「秒杀」残留）", a1.hp === a1.hpMax && a1.hp > 0);
  check("四3 再来一次：场上怪物清零", a1.monsters === 0);
  check("四4 再来一次：波次归 1 / 时限重置为满", a1.wave === 1 && Math.abs(a1.timeLeft - CFG.endless.timeLimit) < 0.001);
  check("四5 再来一次：玩家回到地图中心", a1.px === w.w / 2 && a1.py === w.h / 2);
  check("四6 再来一次：暂停闸门已解除（世界会推进）", a1.paused === false);
  check("四7 再来一次：BOSS 序号归零", a1.bossIdx === 0);

  /* ============ 五、连续重开 3 次：数值不累积 / 不漂移 ============ */
  var stable = true, firstHpMax = a1.hpMax, firstDef = null;
  for (var k = 0; k < 3; k++) {
    G.run.hp = 0; onPlayerDeath();
    restartEndless();
    var s = snap();
    if (s.hp !== s.hpMax || s.monsters !== 0 || s.wave !== 1 || s.kind !== "endless") stable = false;
    if (s.hpMax !== firstHpMax) stable = false;          /* 属性倍率不得跨局累积 */
  }
  check("五1 连续重开 3 次：满血 / 空场 / 波次归 1 恒成立", stable === true);

  console.log("PASS 合计 = " + pass + "   失败数 = " + fail);
  if (fail > 0) throw new Error("ENDLESS RESTART TEST FAILED");
  "ENDLESS RESTART TEST OK";
`, ctx, { filename: "endless_restart" });

console.log(out);
