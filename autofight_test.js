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

  // ---- 场景准备：DOM 桩不解析 HTML，需先手工预置风格按钮子节点（bindEvents 才能绑上 onclick） ----
  const styleRowPre = document.getElementById("autofight-styles");
  const mkStyleBtn = (s) => ({ dataset: { style: s }, classList: { toggle() { }, add() { }, remove() { }, contains: () => false }, onclick: null, textContent: "" });
  styleRowPre.children.push(mkStyleBtn("berserk"), mkStyleBtn("balanced"), mkStyleBtn("cautious"));

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

  // ============ 托管 AI（转向力叠加：躲避 > 走位 > 索敌） ============
  check("CFG.autoFight 三风格齐备", CFG.autoFight && CFG.autoFight.styles.berserk && CFG.autoFight.styles.balanced && CFG.autoFight.styles.cautious);
  check("开局默认风格 = balanced", G.run.autoStyle === "balanced");
  const step = (n) => { for (let i = 0; i < n; i++) p.update(w, 0.016); };
  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);

  // 6. 风格选择器 UI
  afBtn.onclick();   // 开启
  const styleRow = document.getElementById("autofight-styles");
  check("开启后风格选择器展开", !styleRow.classList.contains("hidden"));
  const styleBtns = styleRow.children;
  styleBtns[0].onclick();
  check("点击「疯狂」→ autoStyle = berserk", G.run.autoStyle === "berserk");
  styleBtns[2].onclick();
  check("点击「冷静」→ autoStyle = cautious", G.run.autoStyle === "cautious");

  // 7. 索敌：远处怪物 → AI 自动逼近
  w.monsters.length = 0;
  const far = new Monster("NM0010", p.x + 500, p.y, 1);
  w.monsters.push(far);
  const d0 = distTo(far.x, far.y);
  step(30);   // ~0.5s
  check("索敌：远处怪物自动逼近", distTo(far.x, far.y) < d0 - 30);

  // 8. 风筝：冷静档贴脸怪 → 拉开距离
  G.run.autoStyle = "cautious";
  const close = new Monster("NM0010", p.x + 60, p.y, 1);
  w.monsters.length = 0; w.monsters.push(close);
  const d1 = distTo(close.x, close.y);
  step(30);
  check("风筝：贴脸怪被拉开距离", distTo(close.x, close.y) > d1 + 20);

  // 9. 预判躲避：Boss 爆炸预警圈（warnT > 0）→ 径向逃离
  w.monsters.length = 0;
  const boss = { dead: false, d: { type: "boss" }, ak: { boomRadius: 200, boomWarn: 1 }, warnT: 1, x: p.x, y: p.y, r: 40 };
  w.monsters.push(boss);
  const d2 = distTo(boss.x, boss.y);
  step(30);
  check("预判：Boss 预警圈内向圈外逃离", distTo(boss.x, boss.y) > d2 + 40);

  // 10. 预判躲避：精英冲锋 telegraph → 侧闪拉开
  w.monsters.length = 0;
  const charger = { dead: false, d: { type: "charger" }, ak: { chargeRange: 300 }, state: "telegraph", x: p.x, y: p.y, r: 20 };
  w.monsters.push(charger);
  const d3 = distTo(charger.x, charger.y);
  step(30);
  check("预判：精英冲锋预警期侧闪/拉开", distTo(charger.x, charger.y) > d3 + 20);

  // 11. 躲子弹：场上无怪 + 一发敌方子弹直射 → AI 移动避开弹道
  w.monsters.length = 0; w.enemyBullets.length = 0;
  p.aiStrafeSide = 1;
  const bx = p.x + 150, by = p.y;   // 从右侧直射玩家
  w.enemyBullets.push(new Bullet(bx, by, Math.PI, 200, 5, "enemy"));
  const px0 = p.x, py0 = p.y;
  step(20);
  const moved = Math.hypot(p.x - px0, p.y - py0);
  check("躲子弹：直射弹逼近时 AI 移动规避", moved > 10);

  // 12. 撤离读条：圈内暂停走位（站桩不打断读条）
  G.run.extractChanneling = true;
  const px1 = p.x, py1 = p.y;
  step(10);
  check("撤离读条期间站桩不移动", p.x === px1 && p.y === py1);
  G.run.extractChanneling = false;

  // 13. 手动让权：按键期间 AI 不接管，记录 aiHoldT
  G.keys["d"] = true;
  step(3);
  check("手动操作时 AI 让权（aiHoldT 刷新）", G.run.aiHoldT > 0);
  G.keys["d"] = false;

  afBtn.onclick();   // 收尾关闭
  check("收尾：按钮翻回「关」", afBtn.textContent.includes("关") && G.run.autoFight === false);
`, ctx, { filename: "driver" });

if (!ok) { console.error("AUTO FIGHT TEST FAILED"); process.exit(1); }
console.log("AUTO FIGHT TEST OK");
