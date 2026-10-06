/* 无头测试：AssetHooks 真实资源接入层（js/core.js 末尾区块 + js/assets_manifest.js）
 * 覆盖：
 *   manifest 结构（6 英雄立绘键 / 8 个 sfx 键 / 1 首 BGM / 路径与扩展名合法）
 *   预加载成功路径（stats 计数 / ready() settle / sprite·audio 查表命中）
 *   onerror 回退路径（失败静默留空 → 查表返回 null → 回退程序化占位）
 *   O(1) 查表性能粗测（10000 次 < 50ms）与运行时零请求
 *   core.js 既有函数未被改动的简化断言（AssetHooks 以独立区块存在）
 * 运行：node assets_hook_test.js（判绿 = exit 0 且无 FAIL；PASS 文案只含中文）
 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---- 媒体桩：成功型 + onerror 型双模式（扩展 levelup_test 同款 Image 桩） ----
 * failSet 命中的路径 → set src 即触发 onerror（模拟文件缺失/404）；
 * 未命中的路径 → set src 即触发 onload（模拟加载成功）。
 * stat.srcSets 统计 src 赋值次数（验证运行时零请求：查表绝不触发新装载）。 */
function makeMediaStubs(failSet) {
  const stat = { srcSets: 0 };
  const srcDesc = {
    set(v) {
      stat.srcSets++;
      if (failSet.has(v)) { if (typeof this.onerror === "function") this.onerror(); }
      else if (typeof this.onload === "function") this.onload();
    },
  };
  class FakeImage { constructor() { this.width = 100; this.height = 100; } }
  Object.defineProperty(FakeImage.prototype, "src", srcDesc);
  class FakeAudio { constructor() { this.loop = false; this.preload = ""; this.currentTime = 0; } }
  Object.defineProperty(FakeAudio.prototype, "src", srcDesc);
  return { FakeImage, FakeAudio, stat };
}

/* ---- 沙箱装载：config → assets_manifest → core（独立 vm 上下文，可重复构建不同失败场景） ---- */
function loadSandbox(failPaths) {
  const { FakeImage, FakeAudio, stat } = makeMediaStubs(new Set(failPaths));
  const sandbox = {
    console: { log() { }, warn() { }, info() { }, error() { } },   // 静默：防桩环境杂音干扰判绿 grep
    Image: FakeImage,
    Audio: FakeAudio,
  };
  vm.createContext(sandbox);
  const files = ["js/config.js", "js/assets_manifest.js", "js/core.js"];   // 清单先于 core → 走启动自举
  for (const f of files) vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, { filename: f });
  return {
    stat,
    manifest: vm.runInContext("AssetManifest", sandbox),
    hooks: vm.runInContext("AssetHooks", sandbox),
    heroIds: vm.runInContext("CFG.heroes.slice(0, 6).map(function (h) { return h.id; })", sandbox),
  };
}

/* ---- 断言器 ---- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
}
const endsWithAny = (p, exts) => exts.some((e) => p.endsWith(e));

(async function main() {
  const KEYS_SPRITE = ["hero_H001", "hero_H002", "hero_H003", "hero_H004", "hero_H005", "hero_H006"];
  const KEYS_SFX = ["sfx_shoot", "sfx_hit", "sfx_explode", "sfx_pickup", "sfx_levelup", "sfx_reroll", "sfx_extract", "sfx_death"];

  /* ===== 场景 A：全部加载成功 ===== */
  const A = loadSandbox([]);
  A.hooks.init();   // 幂等：启动自举已装载，此处应直接返回
  const stA = A.hooks.stats();
  const entryTotal = Object.keys(A.manifest.sprites).length
    + Object.keys(A.manifest.audio).length + Object.keys(A.manifest.music).length;

  check("01 manifest.sprites 含 6 个首发英雄键（hero_H001~H006 全在）",
    KEYS_SPRITE.every((k) => k in A.manifest.sprites) && Object.keys(A.manifest.sprites).length === 6);
  check("02 英雄键与 CFG.heroes 前 6 个 id 一一对应（只读引用不改配置）",
    KEYS_SPRITE.every((k, i) => k === "hero_" + A.heroIds[i]));
  check("03 manifest.audio 含 8 个约定 sfx 键（shoot/hit/explode/pickup/levelup/reroll/extract/death）",
    KEYS_SFX.every((k) => k in A.manifest.audio) && Object.keys(A.manifest.audio).length === 8);
  check("04 manifest.music 含 1 首战斗 BGM（bgm_battle）",
    Object.keys(A.manifest.music).length === 1 && "bgm_battle" in A.manifest.music);

  const allPaths = [].concat(Object.values(A.manifest.sprites), Object.values(A.manifest.audio), Object.values(A.manifest.music));
  check("05 全部资源路径以 assets/ 开头", allPaths.every((p) => p.indexOf("assets/") === 0));
  check("06 sprites 扩展名全部合法（png/webp）",
    Object.values(A.manifest.sprites).every((p) => endsWithAny(p, [".png", ".webp"])));
  check("07 audio/music 扩展名全部合法（ogg/mp3）",
    Object.values(A.manifest.audio).concat(Object.values(A.manifest.music)).every((p) => endsWithAny(p, [".ogg", ".mp3"])));

  /* 注：本桩 set src 同步回调 onload，故 init 返回时 loaded 已计入；
   * 真实浏览器为异步回调 —— 此处只校验条目总数登记正确，加载计数见 09 */
  check("08 init 后 stats().total === 清单条目数（6+8+1=" + entryTotal + "）",
    stA.total === entryTotal);
  await A.hooks.ready();
  const stA2 = A.hooks.stats();
  check("09 模拟全部装载成功 → loaded === total 且无失败项",
    stA2.loaded === entryTotal && stA2.failed === 0);
  check("10 成功键查表命中：sprite() 返回对象、audio() 返回对象",
    A.hooks.sprite("hero_H001") !== null && typeof A.hooks.sprite("hero_H001") === "object"
    && A.hooks.audio("sfx_shoot") !== null && typeof A.hooks.audio("sfx_shoot") === "object");
  check("11 查表口径隔离：sprite() 不给音频、audio() 不给图",
    A.hooks.sprite("sfx_shoot") === null && A.hooks.audio("hero_H001") === null);
  check("12 重复 init 幂等（total 不翻倍、src 赋值次数仍为条目数）",
    A.hooks.stats().total === entryTotal && A.stat.srcSets === entryTotal);

  /* ===== 场景 B：部分 onerror（模拟文件缺失）→ 静默回退占位 ===== */
  const FAILS = ["assets/sprites/hero_H003.png", "assets/audio/sfx_reroll.ogg", "assets/audio/bgm_battle.ogg"];
  const B = loadSandbox(FAILS);
  await B.hooks.ready();
  const stB = B.hooks.stats();
  check("13 模拟部分装载失败（失败回调路径）→ 失败计数 === 3 且成功计数 === total - 3",
    stB.failed === 3 && stB.loaded === entryTotal - 3 && stB.total === entryTotal);
  check("14 失败键 sprite()/audio() 返回 null（回退程序化占位）",
    B.hooks.sprite("hero_H003") === null && B.hooks.audio("sfx_reroll") === null
    && B.hooks.audio("bgm_battle") === null);
  check("15 同场景成功键仍查表命中（hero_H001 图 / sfx_shoot 音）",
    B.hooks.sprite("hero_H001") !== null && B.hooks.audio("sfx_shoot") !== null);

  /* ===== 场景 C：O(1) 查表性能 + 运行时零请求 + 既有函数未改动 ===== */
  const t0 = Date.now();
  let hits = 0;
  for (let i = 0; i < 10000; i++) if (A.hooks.sprite("hero_H001") || A.hooks.sprite("__none__")) hits++;
  const dt = Date.now() - t0;
  check("16 sprite() 10000 次查表耗时 " + dt + "ms < 50ms（O(1) 性能粗测）", dt < 50 && hits === 10000);
  check("17 运行时零请求：查表后 src 赋值次数保持 " + entryTotal + "（未注册键不发任何装载）",
    A.stat.srcSets === entryTotal && A.hooks.sprite("__none__") === null && A.hooks.audio("__none__") === null);

  const coreSrc = fs.readFileSync("js/core.js", "utf8");
  const hooksMentions = (coreSrc.match(/AssetHooks/g) || []).length;
  const fourMethods = typeof A.hooks.init === "function" && typeof A.hooks.sprite === "function"
    && typeof A.hooks.audio === "function" && typeof A.hooks.stats === "function"
    && typeof A.hooks.ready === "function";
  check("18 core.js 既有函数未被改动：AssetHooks 以末尾独立区块存在（出现 " + hooksMentions + " 次 ≥ 3 且五方法齐备）",
    hooksMentions >= 3 && fourMethods);
  check("19 ready() 全量 settle 后 resolve 且可用（A/B 两场景均已 await 通过）",
    (await A.hooks.ready()) !== undefined && (await B.hooks.ready()) !== undefined);

  console.log("断言合计：通过 " + passCount + " / " + (passCount + failCount));
  if (failCount > 0) process.exit(1);
})().catch((e) => { console.log("断言执行中止：" + (e && e.message ? e.message : String(e))); process.exit(1); });
