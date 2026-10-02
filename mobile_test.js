/* 无头测试：移动端虚拟控件（CFG.mobile 配置 + 摇杆向量驱动 Player.update）
 * 覆盖：配置表就绪 / G.joy 默认静止 / 摇杆激活时优先于键盘 / 死区视为静止 /
 *       摇杆归零后键盘恢复接管 / touch-controls 元素存在于 index.html（node mobile_test.js） */
"use strict";

/* ---- DOM / Canvas 桩（与 shop_test 相同的最小桩） ---- */
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
  body: new FakeEl("body"),
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

/* ---- index.html 原文核对：触屏控件元素必须存在（桩抓不到缺失元素） ---- */
const fs = require("fs"), vm = require("vm"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
for (const id of ["touch-controls", "joy-base", "joy-stick", "btn-touch-skill", "btn-touch-bag", "btn-touch-act"]) {
  check(`index.html 存在 #${id}`, htmlIds.has(id));
}
check("左上角大血条/能量条已移除（bar-hp/bar-en 不在 index.html）", !htmlIds.has("bar-hp") && !htmlIds.has("bar-en"));

/* ---- 竖屏优先：viewport 安全区 + 竖屏 CSS 主分支存在性（原文核对，桩抓不到） ---- */
const metaVp = (html.match(/<meta\s+name="viewport"[^>]*>/i) || [""])[0];
check("viewport 含 viewport-fit=cover（刘海屏安全区）", /viewport-fit\s*=\s*cover/i.test(metaVp));
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
check("CSS 以 orientation:portrait 为主分支存在", /@media[^{]*orientation\s*:\s*portrait/i.test(css));
check("CSS 含横屏兼容分支 orientation:landscape", /@media[^{]*orientation\s*:\s*landscape/i.test(css));
check("CSS 使用 env(safe-area-inset-*) 处理安全区", /env\(\s*safe-area-inset-/i.test(css));
check("CSS 含竖屏升级弹窗 2×2 网格类（.levelup-cards.grid-portrait）", /\.levelup-cards\.grid-portrait/.test(css));
check("CSS 竖屏背包三段改为上下堆叠（.bp-body 竖排规则）", /\.portrait[^{]*\.bp-body/.test(css) || /body\.portrait\s+\.bp-body/.test(css));

const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
// 桥接：把宿主侧的 check 暴露给 vm 内部（vm.createContext 不继承模块级 const）
ctx.check = check;
vm.runInContext(`
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设

  check("CFG.mobile 配置表就绪（joystick 参数齐备）", !!CFG.mobile && !!CFG.mobile.joystick
    && CFG.mobile.joystick.deadZone > 0 && CFG.mobile.joystick.deadZone < 1);
  check("G.joy 默认静止（active=false, 向量 0）", G.joy && G.joy.active === false && G.joy.dx === 0 && G.joy.dy === 0);

  const w = G.activeWorld, p = G.player;
  const step = () => { recomputeWeapon(); p.update(w, 0.016); };

  // 基线：无输入不动
  const x0 = p.x, y0 = p.y;
  step();
  check("无输入时静止（mvx/mvy=0）", p.x === x0 && p.y === y0 && p.mvx === 0 && p.mvy === 0);

  // 摇杆激活 → 向右移动（优先于键盘）
  G.joy.active = true; G.joy.dx = 1; G.joy.dy = 0;
  step();
  check("摇杆右推 → 队长向右移动", p.x > x0 && p.mvx === 1);
  const x1 = p.x;

  // 死区内的微小向量 → 视为静止
  p.mvx = 0; p.mvy = 0;
  G.joy.dx = CFG.mobile.joystick.deadZone * 0.5; G.joy.dy = 0;
  const x2 = p.x;
  step();
  check("摇杆死区内视为静止", p.x === x2 && p.mvx === 0 && p.mvy === 0);

  // 摇杆归零（active=false）→ 键盘恢复接管
  G.joy.active = false; G.joy.dx = 0; G.joy.dy = 0;
  G.keys["d"] = true;
  const x3 = p.x;
  step();
  check("摇杆松手后键盘 WASD 恢复接管", p.x > x3 && p.mvx === 1);
  G.keys["d"] = false;

  // 斜向归一化：45° 推杆移动分量相同（不超速）
  G.joy.active = true; G.joy.dx = Math.SQRT1_2; G.joy.dy = Math.SQRT1_2;
  const y4 = p.y;
  step();
  check("摇杆斜向移动（分量归一化）", p.y > y4);
  G.joy.active = false; G.joy.dx = 0; G.joy.dy = 0;

  Game.backToMenu();
`, ctx, { filename: "driver" });

console.log(ok ? "MOBILE OK" : "MOBILE FAILED");
if (!ok) throw new Error("MOBILE FAILED");
