/* ============================================================================
 * 21.15 🅒 无尽 HUD + 小怪去血条 + 帮助页触屏文案 回归测试
 * （node hud_endless_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（≥25 项）：
 *   一、源码级：血条渲染被 boss / isElite 条件包裹（普通小怪不画 fillRect×2）
 *   二、源码级：精英血条宽度进 CFG（CFG.elites.barWidth），Boss 仍 110
 *   三、行为级：普通小怪不画血条 / Boss 画 / 精英画（canvas mock 计 fillRect）
 *   四、HUD：非无尽不渲染 / 无尽渲染三项内容（波次 / 击杀 / 同屏 M cap）
 *   五、HUD：Endless 缺失时安全降级（守卫生效，不抛错）
 *   六、帮助页：两种设备文案节点都存在（源码级 id/class 断言）
 *   七、CSS 三处同步：主规则 + 所有 portrait 媒体块 + body.portrait 钩子（括号配平遍历）
 *   八、index.html 引入 js/hud_endless.js + HUD DOM 容器存在
 *
 * 桩：复用 render_opt_test.js 的 ctx Proxy 计数 + quality_tier_test.js 的 CSS 遍历。
 * ⚠️ PASS 行文案不得出现英文 error/Error/FAIL（run_tests.sh 以 grep -ci 统计失败）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 极简 DOM / Canvas 桩（计数 fillRect / fillText / setTransform 等） ---- */
const drawOps = { fill: 0, stroke: 0, drawImage: 0, arc: 0, beginPath: 0, moveTo: 0,
  fillRect: 0, strokeRect: 0, fillText: 0, save: 0, restore: 0, setTransform: 0 };
const textCalls = [];   // 记录 fillText 的文本，供 HUD 内容断言
function resetOps() { for (const k in drawOps) drawOps[k] = 0; textCalls.length = 0; }
global.resetOps = resetOps;
global.drawOps = drawOps;
global.textCalls = textCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p in t) return t[p];
    return (...a) => {
      if (typeof p === "string" && drawOps[p] != null) drawOps[p]++;
      if (p === "fillText" && a.length) textCalls.push(String(a[0]));
    };
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
  documentElement: fakeCanvas,
};
global.window = {
  addEventListener() { }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
};
global.performance = { now: () => Date.now() };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
global.requestAnimationFrame = () => { };

/* ============================================================
 * 一 / 二 / 六 / 七 / 八：静态源码级断言
 * ============================================================ */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const gameSrc = ["game","items","combat","modes","render"].map(function(n){return fs.readFileSync(path.join(__dirname, "js", n + ".js"), "utf8");}).join("\n");
const configSrc = fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");

let okStatic = true;
const staticCheck = (name, cond) => {
  console.log((cond ? "PASS" : "FAIL") + " " + name);
  if (!cond) okStatic = false;
};

/* ---- 一、血条条件包裹（源码级） ---- */
staticCheck("一1 血条块用 boss 或 isElite 条件包裹",
  /if \(m\.d\.type === "boss" \|\| m\.isElite === true\)/.test(gameSrc));
staticCheck("一2 血条块内仍含两条 fillRect（底 + 填充）",
  /if \(m\.d\.type === "boss" \|\| m\.isElite === true\)[\s\S]{0,500}ctx\.fillRect\(m\.x - bw \/ 2, m\.y - size \/ 2 - 12, bw, 5\)/.test(gameSrc));
staticCheck("一3 不再对所有怪无条件画血条（旧无条件写法已移除）",
  gameSrc.indexOf('const bw = m.d.type === "boss" ? 110 : 34;') < 0);
staticCheck("一4 渲染路径单行桥接 HUD（renderEndlessHud 调用存在）",
  /if \(typeof renderEndlessHud === "function"\) renderEndlessHud\(ctx\);/.test(gameSrc));

/* ---- 二、精英血条宽度进 CFG ---- */
staticCheck("二1 CFG.elites.barWidth 存在（数值）", /CFG\.elites\s*=\s*\{[\s\S]*?barWidth:\s*44/.test(configSrc));
staticCheck("二2 血条块读 CFG.elites.barWidth（非硬编码精英宽度）",
  /CFG\.elites && CFG\.elites\.barWidth/.test(gameSrc));
staticCheck("二3 Boss 血条宽度仍为 110", /m\.d\.type === "boss" \? 110/.test(gameSrc));

/* ---- 八、index.html 引入 hud_endless.js + HUD DOM ---- */
staticCheck("八1 index.html 引入 js/hud_endless.js", html.indexOf("js/hud_endless.js") >= 0);
staticCheck("八2 index.html 存在 HUD 信息区容器 #hud-endless-info", htmlIds.has("hud-endless-info"));

/* ---- 六、帮助页两种设备文案节点都存在 ---- */
staticCheck("六1 帮助页存在桌面文案节点 .kbd-desktop", html.indexOf('class="kbd-desktop"') >= 0);
staticCheck("六2 帮助页存在触屏文案节点 .kbd-touch", html.indexOf('class="kbd-touch"') >= 0);
staticCheck("六3 桌面段含 WASD / 方向键", /kbd-desktop[\s\S]{0,120}WASD \/ 方向键/.test(html));
staticCheck("六4 触屏段含摇杆话术", /kbd-touch[\s\S]{0,120}摇杆/.test(html));

/* ---- 七、CSS 三处同步（遍历所有 portrait 媒体块，括号配平） ---- */
/* 从每个 @media (orientation: portrait) 的 `{` 起做括号配平，取完整块体，
 * 只要**任一**块命中规则即算通过（CSS 里有多个 portrait 块，按功能分段）。 */
function portraitBlocks(src) {
  const blocks = [];
  const re = /@media \(orientation: portrait\)\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length, depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    blocks.push(src.slice(m.index, i));
  }
  return blocks;
}
const pBlocks = portraitBlocks(css);
staticCheck("七1 CSS 存在多个 portrait 媒体块（供遍历）", pBlocks.length >= 2);
staticCheck("七2 主规则：隐藏 .kbd-touch（桌面默认）", /\.kbd-touch\s*\{\s*display:\s*none;?\s*\}/.test(css));
staticCheck("七3 主规则：显示 .kbd-desktop",
  /\.kbd-desktop\s*\{\s*display:\s*inline;?\s*\}/.test(css));
const mediaHasSwap = pBlocks.some(b =>
  /\.kbd-desktop\s*\{\s*display:\s*none/.test(b) && /\.kbd-touch\s*\{\s*display:\s*inline/.test(b));
staticCheck("七4 竖屏媒体块含反转换（桌面隐藏 / 触屏显示）", mediaHasSwap);
staticCheck("七5 body.portrait 钩子含反转换",
  /body\.portrait\s+\.kbd-desktop\s*\{\s*display:\s*none/.test(css) &&
  /body\.portrait\s+\.kbd-touch\s*\{\s*display:\s*inline/.test(css));
/* 三处等效：主规则 + 媒体块 + 钩子（共 3 处口径） */
const swapCount =
  (css.match(/\.kbd-desktop\s*\{\s*display/g) || []).length;
staticCheck("七6 三处规则齐备（.kbd-desktop 规则出现 ≥3 次：主 + 媒体 + 钩子）", swapCount >= 3,
  "出现 " + swapCount + " 次");

/* ============================================================
 * 行为级：加载脚本
 * ============================================================ */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/hud_endless.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}

let checks = 0, fails = 0;
const check = (name, cond) => { checks++; console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) fails++; };

// 基础场景：可渲染的世界（沿用 render_opt_test 的准备手法）
vm.runInContext(`(function(){
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.W = 780; G.H = 1688;
  const fakeImg = { width: 48, height: 48 };
  for (const k of ["enemy00","enemy08","enemy16","enemy22","hero"]) G.sprites[k] = fakeImg;
  const W = 1920, H = 1920;
  G.heroDef = { id: "H001", radius: 16, name: "测试" };
  G.run = { hp: 100, hpMax: 100, buffs: [], drones: [], traps: [], companions: [],
            heroModules: {}, autoFight: false, curse: null, bossDefeated: true,
            backpack: { cells: [], tryStackChest() { return false; }, findSpot() { return null; } } };
  G.player = { x: W/2, y: H/2, r: 16, mvx: 0, mvy: 0, faceDir: 1, takeDamage() { return false; }, heal() {} };
  G.levelCfg = { theme: "#141a24", circles: [], mapW: W, mapH: H };
  const w = new World(W, H, false, "stress");
  w.monsters = []; w.playerBullets = []; w.enemyBullets = [];
  w.groundChests = []; w.altars = []; w.circles = []; w.obstacles = []; w.freezeTimer = 0;
  G.mainWorld = w; G.activeWorld = w;
  G.inEndless = false;
  window.__testWorld = w;
})();`, ctx, { filename: "setup" });

/* 准备三类怪：普通 / Boss / 精英，都放在玩家正前方视野内 */
vm.runInContext(`(function(){
  const w = window.__testWorld;
  const ids = Object.keys(CFG.monsters).filter(id => CFG.monsters[id].type !== "boss" &&
    !(typeof isEliteDef === "function" && isEliteDef(id)));
  const normalId = ids[0];
  const bossId = Object.keys(CFG.monsters).find(id => CFG.monsters[id].type === "boss") || ids[0];
  window.__ids = { normalId, bossId };

  // 普通小怪（3 只）：不画血条
  w.monsters = [];
  for (let i = 0; i < 3; i++) {
    const mm = new Monster(normalId, G.player.x + 60 + i * 60, G.player.y, 3);
    mm.sprite = G.sprites["enemy00"] || null; w.monsters.push(mm);
  }
  window.__normalCount = w.monsters.length;
})();`, ctx, { filename: "spawn-normal" });

/* 行为级断言：普通小怪不画血条 */
vm.runInContext(`(function(){
  const w = window.__testWorld;
  resetOps();
  render();
  // 普通怪血条 = 每只 2 次 fillRect（底 + 填充）；去掉后 fillRect 数量应显著下降
  const withoutBars = drawOps.fillRect;
  // 对照组：手动给 3 只怪加 isElite，再看 fillRect
  for (const m of w.monsters) m.isElite = true;
  resetOps();
  render();
  const withBars = drawOps.fillRect;
  window.__withoutBars = withoutBars;
  window.__withBars = withBars;
})();`, ctx, { filename: "normal-nobars" });

check("三1 普通小怪（3 只）不画血条：fillRect 少于精英版", ctx.window.__withoutBars < ctx.window.__withBars,
  "普通版 fillRect=" + ctx.window.__withoutBars + " / 精英版 fillRect=" + ctx.window.__withBars);
check("三2 精英化后每只多画 2 次 fillRect（血条底 + 填充）",
  ctx.window.__withBars - ctx.window.__withoutBars === 3 * 2,
  "差值 " + (ctx.window.__withBars - ctx.window.__withoutBars));

/* 行为级：单独验证 Boss 画血条（用 fillRect 差值） */
vm.runInContext(`(function(){
  const w = window.__testWorld;
  w.monsters = [];
  const m = new Monster(window.__ids.bossId, G.player.x + 80, G.player.y, 3);
  m.d = Object.assign({}, m.d, { type: "boss" });
  m.sprite = G.sprites["enemy16"] || null;
  w.monsters.push(m);
  resetOps(); render();
  window.__bossFillRect = drawOps.fillRect;
  // 移除血条对照：把 type 改回非 boss 且非精英
  m.d = Object.assign({}, m.d, { type: "ranged" });
  resetOps(); render();
  window.__nonBossFillRect = drawOps.fillRect;
})();`, ctx, { filename: "boss-bar" });
check("三3 Boss 画血条（fillRect 多于去血条的同怪）",
  ctx.window.__bossFillRect > ctx.window.__nonBossFillRect,
  "Boss fillRect=" + ctx.window.__bossFillRect + " / 非Boss=" + ctx.window.__nonBossFillRect);

/* 行为级：精英画血条（含 CFG.elites.barWidth 生效） */
vm.runInContext(`(function(){
  const w = window.__testWorld;
  w.monsters = [];
  const m = new Monster(window.__ids.normalId, G.player.x + 80, G.player.y, 3);
  m.isElite = true; m.eliteAffixes = ["坚韧"];
  m.sprite = G.sprites["enemy22"] || null;
  w.monsters.push(m);
  resetOps(); render();
  window.__eliteFillRect = drawOps.fillRect;
  m.isElite = false;
  resetOps(); render();
  window.__plainFillRect = drawOps.fillRect;
})();`, ctx, { filename: "elite-bar" });
check("三4 精英画血条（fillRect 多于普通）",
  ctx.window.__eliteFillRect > ctx.window.__plainFillRect,
  "精英 fillRect=" + ctx.window.__eliteFillRect + " / 普通=" + ctx.window.__plainFillRect);
check("三5 精英血条宽度读 CFG（barWidth=44）", CFGvalue(ctx, "elites.barWidth") === 44);

/* ============================================================
 * 四 / 五：HUD 渲染
 * ============================================================ */
function CFGvalue(c, exprPath) {
  return vm.runInContext("CFG." + exprPath, c);
}

/* 非无尽：HUD 不渲染（三项文本均不出现） */
vm.runInContext(`(function(){
  G.inEndless = false;
  G.activeWorld = window.__testWorld;
  resetOps();
  renderEndlessHud(G.ctx);
  window.__hudTextNonEndless = textCalls.slice();
})();`, ctx, { filename: "hud-off" });
check("四1 非无尽：HUD 不渲染（无「深渊」文本）",
  !ctx.window.__hudTextNonEndless.some(t => t.indexOf("深渊") >= 0));
check("四2 非无尽：HUD 不产生任何 fillText",
  ctx.window.__hudTextNonEndless.length === 0);

/* 无尽：HUD 渲染三项内容 */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__testWorld;
  w.endlessWave = 7;
  w.monsters = [];
  for (let i = 0; i < 25; i++) {
    const mm = new Monster(window.__ids.normalId, G.player.x + 60 + (i%5)*40, G.player.y + Math.floor(i/5)*40, 3);
    w.monsters.push(mm);
  }
  // Endless 桩：状态 + waveCap
  Endless = {
    state: { wave: 7, kills: 123 },
    waveCap: function (wave) { return Math.min(300, 40 + wave * 12); },
  };
  resetOps();
  renderEndlessHud(G.ctx);
  window.__hudText = textCalls.slice();
  window.__hudFillRect = drawOps.fillRect;
  window.__hudSetTransform = drawOps.setTransform;
})();`, ctx, { filename: "hud-on" });
const hudText = ctx.window.__hudText;
check("四3 无尽：渲染「深渊 · 第 N 波」（波次 7）",
  hudText.some(t => t.indexOf("深渊") >= 0 && t.indexOf("第 7 波") >= 0));
check("四4 无尽：渲染「击杀 K」（K=123）",
  hudText.some(t => t.indexOf("击杀") >= 0 && t.indexOf("123") >= 0));
check("四5 无尽：渲染「同屏 M/cap」（M=25，cap=waveCap(7)=124）",
  hudText.some(t => t.indexOf("同屏") >= 0 && t.indexOf("25/124") >= 0),
  "文本=" + JSON.stringify(hudText));
check("四6 无尽：HUD 画背板（fillRect ≥1）", ctx.window.__hudFillRect >= 1);
check("四7 无尽：HUD 复位变换（setTransform 被调 → 钉屏幕坐标）", ctx.window.__hudSetTransform >= 1);

/* 五：Endless 缺失时安全降级 */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__testWorld;
  w.endlessWave = 3;
  w.monsters = [];
  Endless = undefined;
  let threw = false;
  resetOps();
  try { renderEndlessHud(G.ctx); } catch (e) { threw = true; }
  window.__hudNoEndlessThrew = threw;
  window.__hudNoEndlessText = textCalls.slice();
})();`, ctx, { filename: "hud-noendless" });
check("五1 Endless 缺失：HUD 不抛异常（守卫生效）", ctx.window.__hudNoEndlessThrew === false);
check("五2 Endless 缺失：仍渲染波次（从 world.endlessWave 兜底）",
  ctx.window.__hudNoEndlessText.some(t => t.indexOf("深渊") >= 0 && t.indexOf("第 3 波") >= 0));
check("五3 Endless 缺失：击杀数安全降级为 0（不报未定义）",
  ctx.window.__hudNoEndlessText.some(t => t.indexOf("击杀") >= 0 && t.indexOf("0") >= 0));

/* 额外：HUD 在 render() 主循环里也确实被调用（源码级已证实单行桥接；此处行为追加） */
vm.runInContext(`(function(){
  G.inEndless = true;
  const w = window.__testWorld;
  w.endlessWave = 2; w.monsters = [];
  Endless = { state: { wave: 2, kills: 5 }, waveCap: function (n) { return 40 + n * 12; } };
  resetOps();
  render();
  window.__renderText = textCalls.slice();
})();`, ctx, { filename: "hud-in-render" });
check("四8 render() 主路径内含无尽 HUD（文本出现「深渊」）",
  ctx.window.__renderText.some(t => t.indexOf("深渊") >= 0));

console.log("----------------------------------------");
console.log("行为断言 " + checks + " 项，失败 " + fails + " 项");
if (!okStatic || fails > 0) { console.log("HUD ENDLESS TEST FAILED"); process.exit(1); }
console.log("HUD ENDLESS TEST OK");
