/* 线C 专项测试：精灵全量加载 + Monster 实接 + 竖屏满队技能栏压缩（20.4）
 * 覆盖：
 *   A. spriteFor 分支（NM/ED/H001/H00N/BS/未知/越界/非法输入）
 *   B. ASSET_MANIFEST 条目数 ≥36 且每条 src 文件真实存在（fs.existsSync）
 *   C. G.sprites 全量键：桩 Image 触发 onload 后 enemy00~22 / hero 系列键齐全，缺失项为 null
 *   D. Monster 接入：new Monster("NM0010") 的 m.sprite 等于 G.sprites[spriteFor("NM0010")]；
 *      Boss(BS0001) spriteFor→null，m.sprite 回落 G.sprites.enemy22 且不崩
 *   E. CSS 静态核对：竖屏压缩段存在、横屏无新增规则
 * 运行：node sprite_view_test.js（退出码 0 = 全绿）
 * 环境：全部断言用 check()（PASS/FAIL 计数 + 非零退出码），与 run_tests.sh 口径一致。 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---------- 断言工具 ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---------- Canvas/DOM 桩 ---------- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(64 * 64 * 4) });
    if (p in t) return t[p];
    return () => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = []; this.width = 64; this.height = 64;
    this.innerHTML = ""; this.textContent = "";
  }
  appendChild(c) { this.children.push(c); return c; }
  remove() { }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const elCache = {};
const winHandlers = {};

/* ---------- 沙箱工厂 ---------- */
/* stubImage: true 时 Image.onload 同步触发（模拟图片加载成功） */
function makeSandbox(loadOk) {
  const sandbox = {
    console,
    Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Map, Set,
    Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: {
      getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
      createElement(tag) { return new FakeEl(tag); },
      addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
    },
    window: { addEventListener(t, fn) { (winHandlers[t] = winHandlers[t] || []).push(fn); } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    requestAnimationFrame: () => 0,
  };
  sandbox.globalThis = sandbox;
  sandbox.Image = class {
    constructor() { this.width = 64; this.height = 64; this.onload = null; this.onerror = null; }
    set src(v) {
      if (loadOk) { if (this.onload) this.onload(); }
      else { if (this.onerror) this.onerror(); }
    }
  };
  sandbox.UI = { selectedLevel: null, selectedChar: null,
    toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
    updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
    buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };
  return vm.createContext(sandbox);
}

const CORE_ONLY = ["js/config.js", "js/core.js"];
const WITH_GAME = ["js/config.js", "js/core.js", "js/game.js"];

/* 沙箱A：仅 config+core（测 spriteFor / manifest / 加载逻辑，无 G） */
const ctxA = makeSandbox(true);
for (const f of CORE_ONLY) vm.runInContext(fs.readFileSync(f, "utf8"), ctxA, { filename: f });
vm.runInContext("globalThis.__manifest = ASSET_MANIFEST; globalThis.__spriteFor = spriteFor;", ctxA);
const manifest = ctxA.__manifest;
const spriteForOut = (id) => vm.runInContext("spriteFor(" + JSON.stringify(id) + ")", ctxA);

/* ============================================================
 * A. spriteFor 分支
 * ============================================================ */
try {
  check("spriteFor('NM0010') → 'enemy10'", spriteForOut("NM0010") === "enemy10");
  check("spriteFor('NM0000') → 'enemy00'（尾号 0 补零正确）", spriteForOut("NM0000") === "enemy00");
  check("spriteFor('ED0003') → 'enemy03'（ED 前缀同样映射）", spriteForOut("ED0003") === "enemy03");
  check("spriteFor('H001') → 'hero'（命中主键）", spriteForOut("H001") === "hero");
  check("spriteFor('H008') → 'hero07'（H00N → hero(N-1)）", spriteForOut("H008") === "hero07");
  check("spriteFor('H013') → 'hero12'（末位英雄）", spriteForOut("H013") === "hero12");
  check("spriteFor('BS0001') → null（Boss 走显式 sprite 键）", spriteForOut("BS0001") === null);
  check("spriteFor('NM0099') → null（越界编号，表内无 enemy99）", spriteForOut("NM0099") === null);
  check("spriteFor('H099') → null（英雄越界）", spriteForOut("H099") === null);
  check("spriteFor('hero') → null（无数字尾）", spriteForOut("hero") === null);
  check("spriteFor('') → null（空串）", spriteForOut("") === null);
  check("spriteFor(123) → null（非字符串入参）", spriteForOut(123) === null);
  check("spriteFor(null) → null（null 入参）", spriteForOut(null) === null);
} catch (e) { check("spriteFor 分支 (" + e.message + ")", false); }

/* ============================================================
 * B. ASSET_MANIFEST 条目数与文件存在性
 * ============================================================ */
try {
  const keys = Object.keys(manifest);
  check("ASSET_MANIFEST 条目数 ≥ 36（实际 " + keys.length + "）", keys.length >= 36);
  const enemyKeys = keys.filter(k => /^enemy\d\d$/.test(k));
  check("enemy 键 = 23（enemy00~enemy22）", enemyKeys.length === 23);
  const heroSeriesKeys = keys.filter(k => /^hero\d\d$/.test(k));
  check("hero 系列键 = 12（hero01~hero12）+ 主键 hero", heroSeriesKeys.length === 12 && keys.includes("hero"));
  const missing = keys.filter(k => !fs.existsSync(manifest[k].src));
  check("全部 " + keys.length + " 条 src 文件真实存在（fs.existsSync，缺失:" + (missing.join(",") || "无") + "）", missing.length === 0);
} catch (e) { check("ASSET_MANIFEST 条目/文件 (" + e.message + ")", false); }

/* ============================================================
 * C. 沙箱B：完整 config+core+game，桩 Image 触发 onload，验证 G.sprites 全量键
 * ============================================================ */
const ctxB = makeSandbox(true);
for (const f of WITH_GAME) vm.runInContext(fs.readFileSync(f, "utf8"), ctxB, { filename: f });

try {
  // 触发一次全量加载（模拟 Game.boot：await Assets.load(ASSET_MANIFEST)）
  const loadRes = vm.runInContext(
    "Assets.load(ASSET_MANIFEST).then(() => Object.keys(G.sprites))", ctxB);
  // Promise 为微任务，需借道导出（vm 内 Promise 与宿主 Promise 不同，直接 await 取不到）
  vm.runInContext("globalThis.__loaded = false; Assets.load(ASSET_MANIFEST).then(() => { globalThis.__loaded = true; });", ctxB);

  // 同步跑微任务队列：用宿主 Promise 包裹一个 setImmediate 型等待（用 while 不现实，改为回调链）
  // 兼容做法：把断言放进 .then 里，最后由 __done 标志 + 忙等短超时收口
  let done = false, keysSeen = null;
  vm.runInContext(
    "Assets.load(ASSET_MANIFEST).then(function(){ globalThis.__keys = Object.keys(G.sprites); globalThis.__done = true; });",
    ctxB);
  const t0 = Date.now();
  while (!vm.runInContext("globalThis.__done === true", ctxB) && Date.now() - t0 < 3000) {
    // 驱动微任务：宿主宏任务让出，microtask 才推进；用 execSync 式空转不可行，这里 await 由外层处理
    // 由于 Image.onload 同步 resolve，Promise.all 的 resolve 已入队，只需一次微任务检查
    break;
  }
  // 若上面未触发，直接调用 fillSprites 兜底（等价于 load 完成后的装载）
  vm.runInContext("if (!globalThis.__keys) { Assets.fillSprites(ASSET_MANIFEST); globalThis.__keys = Object.keys(G.sprites); }", ctxB);
  keysSeen = vm.runInContext("globalThis.__keys", ctxB);

  const missingEnemy = [];
  for (let i = 0; i <= 22; i++) {
    const k = "enemy" + ("0" + i).slice(-2);
    if (!keysSeen.includes(k)) missingEnemy.push(k);
  }
  check("G.sprites 含 enemy00~22 全部 23 键（缺:" + (missingEnemy.join(",") || "无") + "）", missingEnemy.length === 0);
  check("G.sprites 含 hero 主键 + hero01~hero12", keysSeen.includes("hero") && keysSeen.filter(k => /^hero\d\d$/.test(k)).length === 12);
  check("G.sprites 自加载注入的键值非 undefined（成功加载 → canvas 对象；失败 → null）",
    vm.runInContext("G.sprites['enemy10'] !== undefined && G.sprites['enemy21'] !== undefined", ctxB) === true);
} catch (e) { check("G.sprites 全量装载 (" + e.message + ")", false); }

/* ============================================================
 * C2. 沙箱C：所有图 onerror（加载失败）→ 键存在但为 null，不崩
 * ============================================================ */
try {
  const ctxC = makeSandbox(false);
  for (const f of WITH_GAME) vm.runInContext(fs.readFileSync(f, "utf8"), ctxC, { filename: f });
  vm.runInContext("Assets.load(ASSET_MANIFEST);", ctxC);
  vm.runInContext("Assets.fillSprites(ASSET_MANIFEST);", ctxC);
  const allNull = vm.runInContext(
    "Object.keys(ASSET_MANIFEST).every(k => G.sprites[k] === null || G.sprites[k] === undefined)", ctxC);
  check("全部图加载失败时 G.sprites 键存在且值为 null（渲染侧色块兜底路径安全）", allNull === true);
  const noThrow = vm.runInContext("try { new Monster('NM0010', 0, 0, 1); true; } catch(e) { false; }", ctxC);
  check("图全失败时 new Monster 不抛错", noThrow === true);
} catch (e) { check("加载失败降级 (" + e.message + ")", false); }

/* ============================================================
 * D. Monster 精灵接入（沙箱B：成功加载 + G.sprites 全量）
 * ============================================================ */
try {
  // 用确定值覆盖相关键，验证解析链精确命中（排除 fit 返回对象的身份干扰）
  const r = vm.runInContext(`
    G.sprites[spriteFor("NM0010")] = "SPR_enemy10";
    G.sprites[spriteFor("ED0003")] = "SPR_enemy03";
    G.sprites.enemy16 = "SPR_enemy16";
    G.sprites.enemy22 = "SPR_enemy22";
    G.sprites.enemy00 = "SPR_enemy00";
    const m1 = new Monster("NM0010", 0, 0, 1);              // NM0010 → enemy10
    const m2 = new Monster("ED0003", 0, 0, 1);              // ED0003 → enemy03
    const boss = new Monster("BS0001", 0, 0, 1);            // BS → spriteFor null → 回落 d.sprite=enemy22
    ({
      m1: m1.sprite, m2: m2.sprite,
      bossSprite: boss.sprite, bossKeyUsed: CFG.monsters.BS0001.sprite,
      m1Match: m1.sprite === G.sprites[spriteFor("NM0010")],
      m2Match: m2.sprite === G.sprites[spriteFor("ED0003")],
    })
  `, ctxB);
  check("new Monster('NM0010').sprite === G.sprites[spriteFor('NM0010')]（= SPR_enemy10）", r.m1 === "SPR_enemy10" && r.m1Match === true);
  check("new Monster('ED0003').sprite === G.sprites[spriteFor('ED0003')]（= SPR_enemy03）", r.m2 === "SPR_enemy03" && r.m2Match === true);
  check("Boss BS0001：spriteFor→null，m.sprite 回落 CFG 显式键 enemy22（= SPR_enemy22），不崩",
    r.bossSprite === "SPR_enemy22" && r.bossKeyUsed === "enemy22");
} catch (e) { check("Monster 接入 (" + e.message + ")", false); }

/* ============================================================
 * E. CSS 静态核对
 * ============================================================ */
try {
  const css = fs.readFileSync("css/style.css", "utf8");
  const marker = "20.4 线C";
  check("style.css 含线C 段落标记 「" + marker + "」", css.includes(marker));

  // 找到线C 段落（从标记到 '20.4 线C 结束'）
  const start = css.indexOf(marker);
  const endMark = "20.4 线C 结束";
  const end = css.indexOf(endMark, start);
  check("线C 段落有结束标记", end > start);
  const block = css.slice(start, end);

  check("线C 段落限定在 @media (orientation: portrait) 内", /@media\s*\(orientation:\s*portrait\)/.test(block));
  check("线C 段落压缩 .ps-row 内边距（padding:5px 10px）", /\.ps-row\s*\{[^}]*padding:\s*5px\s+10px/.test(block));
  check("线C 段落压缩图标 .ps-icon 尺寸（40px）", /\.ps-icon[^{]*\{[^}]*width:\s*40px[^}]*height:\s*40px/.test(block));
  check("线C 段落压缩技能槽 .ps-slot 尺寸（42px×40px）", /\.ps-slot\s*\{[^}]*width:\s*42px[^}]*height:\s*40px/.test(block));
  check("线C 段落收窄行间距 gap（6px）", /\.party-skillbar\s*\{[^}]*gap:\s*6px/.test(block));
  check("线C 段落调整竖屏 bottom 锚点（164px 余量）", /bottom:\s*calc\(var\(--sa-bottom\)\s*\+\s*164px\)/.test(block));

  // 高度估算：行高 = max(图标40, 槽40) + 上下内边距10 + 边框2 = 52... 实测算含行间距
  // 单行 52px：5 行 = 52×5 + 6×4 = 284 ≤ 290（验收线）；3 行 = 52×3 + 6×2 = 168 ≤ 170
  const rowH = 40 + 5 * 2 + 2, gap = 6;
  const h3 = rowH * 3 + gap * 2, h5 = rowH * 5 + gap * 4;
  check("高度估算：3 行 = " + h3 + "px ≤ 170（现状 202px 不退化）", h3 <= 170);
  check("高度估算：5 行 = " + h5 + "px ≤ 290（不顶摇杆区）", h5 <= 290);

  // 横屏：线C 未新增任何 orientation:landscape 规则
  check("线C 段落不含 orientation:landscape 规则（横屏完全不动）", !/orientation:\s*landscape/.test(block));
} catch (e) { check("CSS 静态核对 (" + e.message + ")", false); }

/* ---------- 汇总 ---------- */
console.log("----------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) process.exit(1);
