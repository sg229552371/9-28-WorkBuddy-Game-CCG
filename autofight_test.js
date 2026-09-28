/* 无头测试：自动战斗按钮（默认关；开启后队长技能自动施放；Space 手动保留） */
"use strict";

/* ---- DOM / Canvas 桩（与 skill_module_test 相同的最小桩） ---- */
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
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
global.fs = fs;   // driver 内读 index.html 用
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  var ok = true;
  UI.toast = () => { };   // 屏蔽 toast（避免其 setTimeout 在测试进程退出前触发 DOM 桩崩溃）

  // ---- 配置与元素静态检查 ----
  const html = fs.readFileSync("index.html", "utf8");
  check("index.html 存在 #btn-autofight", html.includes('id="btn-autofight"'));
  check("CFG.skills2.autoCast 默认 false（由局内按钮接管）", CFG.skills2.autoCast === false);

  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);

  // ---- 默认状态 ----
  check("开局 run.autoFight = false（默认关闭）", G.run.autoFight === false);
  check("开局按钮文案为「自动战斗：关」", document.getElementById("btn-autofight").textContent.includes("关"));

  // ---- 场景：场上有怪、能量够、冷却好 ----
  const w = G.activeWorld, p = G.player;
  const m = new Monster("NM0010", p.x + 200, p.y, 1);
  w.monsters.push(m);
  const sk = G.run.weapon.skill;
  const setReady = () => { G.run.energy = G.run.energyMax; p.skillTimer = 0; G.keys[" "] = false; };

  // 1. 关闭态：技能不自动施放（普攻仍自动开火）
  setReady();
  const bullets0 = w.playerBullets.length;
  p.update(w, 0.016);
  check("关闭态：普攻自动开火（弹池增加）", w.playerBullets.length > bullets0);
  check("关闭态：技能未自动施放（能量未被扣除）", G.run.energy >= G.run.energyMax - 0.01);

  // 2. 关闭态：Space 手动施法仍可用（H001 技能耗能 = 能量上限 100，施放后能量归 0 且进入冷却）
  setReady(); G.keys[" "] = true;
  p.update(w, 0.016);
  check("关闭态：Space 手动施法生效（能量归 0 + 进入冷却）", G.run.energy < sk.energy && p.skillTimer > 0);
  G.keys[" "] = false;

  // 3. 开启自动战斗：按钮状态翻转 + 技能自动施放
  const afBtn = document.getElementById("btn-autofight");
  afBtn.onclick();
  check("点击按钮 → autoFight = true", G.run.autoFight === true);
  check("按钮文案翻转为「开」", afBtn.textContent.includes("开"));
  setReady();
  p.update(w, 0.016);
  check("开启态：技能能量够即自动施放", G.run.energy < sk.energy && p.skillTimer > 0);

  // 4. 开启态：能量不足不施放、冷却中不施放
  G.run.energy = sk.energy - 1; p.skillTimer = 0;
  p.update(w, 0.016);
  check("开启态：能量不足不施放", G.run.energy < sk.energy);
  setReady(); p.skillTimer = 1;
  p.update(w, 0.016);
  check("开启态：冷却中不施放", G.run.energy >= G.run.energyMax - 0.01);

  // 5. 再次点击关闭
  afBtn.onclick();
  check("再次点击 → autoFight = false", G.run.autoFight === false);
  check("按钮文案翻回「关」", afBtn.textContent.includes("关"));
`, ctx, { filename: "driver" });

if (!ok) { console.error("AUTO FIGHT TEST FAILED"); process.exit(1); }
console.log("AUTO FIGHT TEST OK");
