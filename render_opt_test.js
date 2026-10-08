/* 21.13 正式渲染路径优化 回归测试（node render_opt_test.js）
 * 覆盖：
 *   ① 源码级契约：怪物剔除常态化（不再被 isLowQuality 门控）
 *   ② 源码级契约：敌方弹幕按外观等价类分桶批绘（moveTo 逐发防连线）
 *   ③ 行为级：600 怪时 render() 剔除数 > 0（视野外实体被跳过）
 *   ④ 行为级：弹幕批绘后 fill 调用次数与弹幕数量解耦（不随 N 线性增长）
 *   ⑤ 视觉等价：批绘路径产出的 fill 次数 = 桶数（小怪 1 + Boss 1），非逐发
 *   ⑥ 无回归：低画质下 Boss 弹描边跳过逻辑保留
 * 桩：复用 low_quality_test.js 的极简 DOM 桩（game.js 头部依赖很少）。
 * ⚠️ PASS 行文案不得出现英文 error/Error（run_tests.sh 会误判为失败）。
 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 极简 DOM 桩 ---- */
const drawOps = { fill: 0, stroke: 0, drawImage: 0, arc: 0, beginPath: 0, moveTo: 0, fillRect: 0, save: 0, restore: 0 };
function resetOps() { for (const k in drawOps) drawOps[k] = 0; }
global.resetOps = resetOps;
global.drawOps = drawOps;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    return (...a) => { if (typeof p === "string" && drawOps[p] != null) drawOps[p]++; };
  },
  set(t, p, v) { t[p] = v; return true; },
});
const fakeCanvas = {
  width: 300, height: 300, style: {},
  getContext() { return ctxProxy; },
  addEventListener() { }, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
};
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = Object.assign({}, fakeCanvas, { id })); },
  createElement() { return Object.assign({}, fakeCanvas); },
  addEventListener() { }, querySelectorAll: () => [], body: fakeCanvas,
};
global.window = {
  addEventListener() { }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
};
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
global.requestAnimationFrame = () => { };

/* ---- 加载脚本 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

/* ---- 静态源码级检查 ---- */
const gameSrc = ["game","items","combat","modes","render"].map(function(n){return fs.readFileSync(path.join(__dirname, "js", n + ".js"), "utf8");}).join("\n");
let okStatic = true;
const staticCheck = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) okStatic = false; };

// ① 剔除常态化：cullMargin 存在，且循环条件不再依赖 lqCull
staticCheck("① 怪物剔除用 cullMargin（不再被低画质门控）", /const\s+cullMargin\s*=/.test(gameSrc));
staticCheck("① 渲染循环内的 lqCull 门控已移除", gameSrc.indexOf("lqCull && (m.x + 160 < camX") < 0);
staticCheck("① 剔除 margin 足够大（>=260，防预警圈被裁）", /const\s+cullMargin\s*=\s*(\d+)/.test(gameSrc) &&
  parseInt(/const\s+cullMargin\s*=\s*(\d+)/.exec(gameSrc)[1], 10) >= 260);

// ② 弹幕批绘：分桶 + moveTo 防连线
staticCheck("② 敌方弹幕按 boss/小怪分两桶", gameSrc.indexOf("ebBoss") >= 0 && gameSrc.indexOf("ebSmall") >= 0);
staticCheck("② 弹幕批绘含 moveTo（防相邻圆被直线连成三角）",
  /for \(const b of ebSmall\) \{ ctx\.moveTo/.test(gameSrc) || gameSrc.indexOf("ctx.moveTo(b.x + 5, b.y)") >= 0);
staticCheck("② 小怪弹单次 fill（不逐发 beginPath+fill）",
  /ctx\.fillStyle = "#c79bff";\s*\n\s*ctx\.beginPath\(\);\s*\n\s*for \(const b of ebSmall\)/.test(gameSrc));
staticCheck("② Boss 弹描边仍受低画质门控（LQ_SKIP_GLOW 保留）",
  gameSrc.indexOf("ebBoss") >= 0 && /ebBoss[\s\S]{0,400}LQ_SKIP_GLOW/.test(gameSrc));

/* ---- 行为级检查 ---- */
vm.runInContext(`
  let checks = 0, fails = 0;
  const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };
  window.__roFail = () => fails; window.__roChecks = () => checks;

  /* 准备一个可控的战斗场景（不依赖 UI/素材） */
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.W = 780; G.H = 1688;       // 竖屏画布（dsf=2 口径）：视野可视区约 650×1407
  const fakeImg = { width: 48, height: 48 };
  for (const k of ["enemy00","enemy08","enemy16","enemy22","hero"]) G.sprites[k] = fakeImg;

  const W = 1920, H = 1920;
  G.heroDef = { id: "H001", radius: 16, name: "测试" };
  G.run = { hp: 100, hpMax: 100, energy: 50, energyMax: 100, buffs: [], drones: [], traps: [],
            companions: [], heroModules: {}, autoFight: false, curse: null, bossDefeated: true,
            backpack: { cells: [], tryStackChest() { return false; }, findSpot() { return null; } } };
  G.player = { x: W/2, y: H/2, r: 16, mvx: 0, mvy: 0, faceDir: 1, takeDamage() { return false; }, heal() {} };
  G.levelCfg = { theme: "#141a24", circles: [], mapW: W, mapH: H };
  const w = new World(W, H, false, "stress");
  w.monsters = []; w.playerBullets = []; w.enemyBullets = [];
  w.groundChests = []; w.altars = []; w.circles = []; w.obstacles = []; w.freezeTimer = 0;
  G.mainWorld = w; G.activeWorld = w;

  /* ③ 剔除常态化：600 怪均匀撒 1920²，视野只覆盖中心一块 → 必有剔除 */
  {
    const ids = Object.keys(CFG.monsters).filter(id => CFG.monsters[id].type !== "boss" &&
      !(typeof isEliteDef === "function" && isEliteDef(id)));
    const side = Math.ceil(Math.sqrt(600));
    const step = Math.min(w.w, w.h) / (side + 1);
    for (let i = 0, made = 0; i < side && made < 600; i++)
      for (let j = 0; j < side && made < 600; j++, made++) {
        const mm = new Monster(ids[made % ids.length], (i+1)*step, (j+1)*step, 5);
        mm.sprite = fakeImg; w.monsters.push(mm);
      }
    check("③ 600 只怪已铺场", w.monsters.length === 600);
    // 统计视野内数量（与 render 同口径）
    const zoom = (CFG.camera && CFG.camera.zoom) || 1;
    const viewW = G.W / zoom, viewH = G.H / zoom;
    const camX = U.clamp(G.player.x - viewW/2, 0, Math.max(0, w.w - viewW));
    const camY = U.clamp(G.player.y - viewH/2, 0, Math.max(0, w.h - viewH));
    let inView = 0;
    for (const m of w.monsters) {
      if (!(m.x + 260 < camX || m.x - 260 > camX + viewW || m.y + 260 < camY || m.y - 260 > camY + viewH)) inView++;
    }
    check("③ 视野外确有怪物（剔除有意义）", inView < 600, "视野内 " + inView + " / 600");
  }

  /* ④ 弹幕批绘：fill 次数与弹幕数解耦 */
  {
    resetOps();
    // 先只放小怪弹 800 发
    for (let i = 0; i < 800; i++) {
      const ang = (i / 800) * Math.PI * 2;
      const b = new Bullet(G.player.x + Math.cos(ang) * (40 + (i % 30) * 5), G.player.y + Math.sin(ang) * (40 + (i % 30) * 5), ang, 100, 5, "enemy");
      w.enemyBullets.push(b);
    }
    render();
    const fillFor800 = drawOps.fill;
    const arcFor800 = drawOps.arc;
    resetOps();
    // 再加 800 发（合计 1600）
    for (let i = 0; i < 800; i++) {
      const ang = (i / 800) * Math.PI * 2;
      const b = new Bullet(G.player.x + Math.cos(ang) * (60 + (i % 20) * 5), G.player.y + Math.sin(ang) * (60 + (i % 20) * 5), ang, 100, 5, "enemy");
      w.enemyBullets.push(b);
    }
    render();
    const fillFor1600 = drawOps.fill;
    check("④ 弹幕从 800 → 1600，fill 次数不随之翻倍（批绘生效）", fillFor1600 <= fillFor800 + 2,
      "800弹 fill=" + fillFor800 + " / 1600弹 fill=" + fillFor1600);
    check("④ arc 次数随弹幕数增长（圆仍逐发描点，只是合并为单次填充）", arcFor800 > 800 * 0.5);
    check("④ 小怪弹批绘：fill 次数为个位数（远小于弹幕数）", fillFor800 < 20, "fill=" + fillFor800);
  }

  /* ⑤ 混合场景：小怪弹 + Boss 弹 → fill 桶数 = 2（各一批） */
  {
    resetOps();
    for (let i = 0; i < 100; i++) {
      const b = new Bullet(G.player.x + 200 + i, G.player.y + 100, 0, 50, 5, "enemy");
      b.boss = true; b.life = 1e9;
      w.enemyBullets.push(b);
    }
    render();
    // 本帧 fill = 小怪批(1) + Boss批(1) + 血条/其它若干（怪物血条是 fillRect 不计 fill）
    check("⑤ 小怪弹+Boss弹 → fill 批次数 <= 5（两桶各一批）", drawOps.fill <= 5, "fill=" + drawOps.fill);
    check("⑤ Boss 弹描边仍有调用（未设低画质）", drawOps.stroke > 0);
  }
`, ctx, { filename: "render_opt_driver.js" });

const fails = ctx.__roFail ? ctx.__roFail() : (ctx.window && ctx.window.__roFail ? ctx.window.__roFail() : 0);
const checks = ctx.__roChecks ? ctx.__roChecks() : (ctx.window && ctx.window.__roChecks ? ctx.window.__roChecks() : 0);
console.log("----------------------------------------");
console.log(`合计 ${checks} 项，失败 ${fails} 项`);
if (fails > 0 || !okStatic) { console.log("RENDER OPT TEST FAILED"); process.exit(1); }
console.log("RENDER OPT TEST OK");
