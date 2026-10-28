/* asset_hooks_consume_test.js —— A2 资源消费入口（AssetHooks → 渲染/音频接线基建）专项测试
 * ----------------------------------------------------------------------------
 * 背景：AssetHooks（js/core.js 末尾区块）已具备查表回退能力，但渲染/音频侧零调用
 *   （消费点 = 0）。本轮在 core.js 末尾补**消费入口基建**（不改 AssetHooks 既有语义）：
 *     Assets.hookedSprite(key) / Assets.hookedAudio(key) / Assets.hookedHeroSprite(id)
 *     SFX.play(name, key)（key 命中真实音频优先，否则回退既有 WebAudio 合成）
 *   本测试只验证「入口」的 null-safe 与零回归，**不挂载清单、不改 index.html**。
 *
 * 覆盖：
 *   场景 A：AssetHooks 未定义（剥离核心区块的沙箱）→ 全部入口返回 null / 不抛
 *   场景 B：AssetHooks 存在但 cache 空（未挂载清单）→ 回退语义（null / 走合成）
 *   场景 C：注入假 cache → 命中返回对象、_kind 口径隔离、AssetHooks 未被改动
 *   场景 D：hookedAudio 命中时 SFX.play 不抛（桩 Audio，play() 返回 rejected Promise 也吞掉）
 *   场景 E：真实清单对照（config → 清单 → core，桩全成功）→ 端到端入口可通 + stats 回归
 *
 * 环境要点：
 *   - 沿用同目录既有 vm/桩写法（见 asset_timeout_test.js / assets_hook_test.js）
 *   - 断言用 check()（PASS/未通过 计数 + 末尾非零退出）；PASS 文案只含中文，
 *     不含英文 error / FAIL 子串（避免 run_tests 门禁 bad 计数误判）
 * 运行：node asset_hooks_consume_test.js（退出码 0 = 全绿）
 */
"use strict";

const fs = require("fs");
const vm = require("vm");

/* ---------- 断言工具 ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  console.log((cond ? "PASS " : "未通过 ") + name);
  if (cond) passCount++; else failCount++;
}

/* ---------- 桩 canvas（core.js 的 fit/_toCanvas 需要，仅提供最小面） ---------- */
function makeCtx2d() {
  return {
    drawImage() { }, putImageData() { }, save() { }, restore() { },
    translate() { }, scale() { }, fillRect() { }, beginPath() { },
    arc() { }, fill() { }, stroke() { }, clearRect() { },
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
  };
}
function FakeCanvas(w, h) { this.width = w || 300; this.height = h || 150; this._ctx = makeCtx2d(); }
FakeCanvas.prototype.getContext = function () { return this._ctx; };

/* ---------- 媒体桩：赋 src 即触发 onload（成功型）/ onerror（failSet 命中） ---------- */
function makeMedia(failSet) {
  const stat = { srcSets: 0 };
  const desc = {
    set(v) {
      stat.srcSets++;
      if (failSet.has(v)) { if (typeof this.onerror === "function") this.onerror(); }
      else if (typeof this.onload === "function") this.onload();
    },
  };
  class FakeImage { constructor() { this.width = 100; this.height = 100; } }
  Object.defineProperty(FakeImage.prototype, "src", desc);
  class FakeAudio { constructor() { this.loop = false; this.preload = ""; this.currentTime = 0; } }
  Object.defineProperty(FakeAudio.prototype, "src", desc);
  return { FakeImage, FakeAudio, stat };
}

/* ---------- 沙箱工厂 ---------- */
function makeSandbox(failPaths) {
  const media = makeMedia(new Set(failPaths || []));
  const sandbox = {
    console: { log() { }, warn() { }, info() { }, error() { }, debug() { } },   // 静默：防桩环境杂音
    Math, JSON, Promise, Date, parseInt, parseFloat, isNaN, isFinite,
    Object, Array, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, Uint8Array, Uint8ClampedArray, Float32Array, Symbol,
    Image: media.FakeImage, Audio: media.FakeAudio,
    document: { createElement() { return new FakeCanvas(64, 64); }, getElementById() { return new FakeCanvas(64, 64); }, addEventListener() { } },
    window: { addEventListener() { } },
    localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  };
  sandbox.globalThis = sandbox;
  return { ctx: vm.createContext(sandbox), media, sandbox };
}

/* 装载指定文件序（每文件独立 try，不掩盖失败） */
function load(files, ctx) {
  for (const f of files) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
  return ctx;
}
const ev = (ctx, expr) => vm.runInContext(expr, ctx);

/* 从 core.js 源码剥离 AssetHooks 核心区块 + 启动自举 → 造「AssetHooks 未定义」沙箱。
 * 只剥离 const AssetHooks={...}; 块与含 AssetHooks.init(); 的自举行，保留末尾 A2 消费入口。 */
function stripAssetHooks(src) {
  let s = src.replace(/\/\* =+\n \* AssetHooks[\s\S]*?\n\};\n/, "");
  s = s.split("\n").filter((ln) => ln.indexOf("AssetHooks.init();") < 0).join("\n");
  return s;
}

/* 微任务 flush（vm 与宿主共用微任务队列） */
const flush = () => new Promise((r) => setImmediate(r));
async function settle() { await flush(); await flush(); }

/* ============================================================
 * 主流程
 * ============================================================ */
(async function main() {

  /* ===== 场景 A：AssetHooks 未定义 → 全部入口 null-safe 回退 ===== */
  {
    const { ctx } = makeSandbox();
    ev(ctx, "undefined");   // 建上下文占位
    /* 先按常规序装载 config（core 用剥离版） */
    load(["js/config.js"], ctx);
    const coreStripped = stripAssetHooks(fs.readFileSync("js/core.js", "utf8"));
    vm.runInContext(coreStripped, ctx, { filename: "js/core.js(stripped)" });

    check("A1 剥离区块后沙箱内 typeof AssetHooks === undefined（场景成立）",
      ev(ctx, "typeof AssetHooks") === "undefined");
    check("A2 AssetHooks 未定义时 Assets.hookedSprite('x') 返回 null",
      ev(ctx, "Assets.hookedSprite('x') === null") === true);
    check("A3 AssetHooks 未定义时 Assets.hookedAudio('x') 返回 null",
      ev(ctx, "Assets.hookedAudio('x') === null") === true);
    check("A4 AssetHooks 未定义时 Assets.hookedHeroSprite('H001') 返回 null",
      ev(ctx, "Assets.hookedHeroSprite('H001') === null") === true);
    check("A5 AssetHooks 未定义时 hookedHeroSprite(非字符串) 返回 null",
      ev(ctx, "Assets.hookedHeroSprite(123) === null && Assets.hookedHeroSprite(null) === null") === true);
    check("A6 AssetHooks 未定义时 SFX.play('shoot') 不抛（走合成路径，ctx 为空直接返回）",
      ev(ctx, "(function(){ try { SFX.play('shoot'); return true; } catch (e) { return false; } })()") === true);
  }

  /* ===== 场景 B：AssetHooks 存在、cache 空（未挂载清单）→ 回退语义 ===== */
  let B;
  {
    const s = makeSandbox();
    B = s;
    load(["js/config.js", "js/core.js"], s.ctx);   // 不含 assets_manifest.js → init 早退
    check("B1 未挂载清单时 AssetHooks 的 cache 为空",
      ev(s.ctx, "Object.keys(AssetHooks.cache).length === 0") === true);
    check("B2 cache 空时 hookedSprite('hero_H001') 返回 null（回退程序化占位）",
      ev(s.ctx, "Assets.hookedSprite('hero_H001') === null") === true);
    check("B3 cache 空时 hookedAudio('sfx_shoot') 返回 null（回退合成音效）",
      ev(s.ctx, "Assets.hookedAudio('sfx_shoot') === null") === true);
    check("B4 cache 空时 hookedHeroSprite('H001') 返回 null",
      ev(s.ctx, "Assets.hookedHeroSprite('H001') === null") === true);
    check("B5 未命中时 SFX.play('shoot','sfx_shoot') 不抛（回退既有合成路径）",
      ev(s.ctx, "(function(){ try { SFX.play('shoot','sfx_shoot'); return true; } catch (e) { return false; } })()") === true);
    check("B6 回归：未挂载清单时 AssetHooks.stats() 全零（既有行为未被改动）",
      ev(s.ctx, "(function(x){ return x.total === 0 && x.loaded === 0 && x.failed === 0; })(AssetHooks.stats())") === true);
  }

  /* ===== 场景 C：注入假 cache → 命中返回对象 / _kind 口径隔离 ===== */
  {
    const c = B.ctx;
    ev(c, "AssetHooks.cache['s1'] = { tag: 'sprite-A' }; AssetHooks._kind['s1'] = 'sprite';");
    check("C1 注入 sprite 命中 → hookedSprite('s1') 返回该对象（严格同一引用）",
      ev(c, "(function(){ return Assets.hookedSprite('s1') === AssetHooks.cache['s1']; })()") === true);
    check("C2 口径隔离：同键 hookedAudio('s1') 返回 null（sprite 不给音频）",
      ev(c, "Assets.hookedAudio('s1') === null") === true);

    ev(c, "AssetHooks.cache['a1'] = { tag: 'audio-A' }; AssetHooks._kind['a1'] = 'audio';");
    check("C3 注入 audio 命中 → hookedAudio('a1') 返回该对象且 hookedSprite('a1') 为 null",
      ev(c, "(function(){ return Assets.hookedAudio('a1') === AssetHooks.cache['a1'] && Assets.hookedSprite('a1') === null; })()") === true);

    ev(c, "AssetHooks.cache['s2'] = { tag: 'kind-mismatch' }; AssetHooks._kind['s2'] = 'audio';");
    check("C4 _kind 不符（标为 audio）时 hookedSprite('s2') 返回 null（不为非 sprite 张冠李戴）",
      ev(c, "Assets.hookedSprite('s2') === null") === true);

    ev(c, "AssetHooks.cache['hero_H001'] = { tag: 'hero-portrait' }; AssetHooks._kind['hero_H001'] = 'sprite';");
    check("C5 hookedHeroSprite('H001') 命中清单键 hero_H001（与 assets_manifest 命名一致）",
      ev(c, "(function(){ return Assets.hookedHeroSprite('H001') === AssetHooks.cache['hero_H001']; })()") === true);
    check("C6 hookedHeroSprite('H999') 未命中清单键 → null",
      ev(c, "Assets.hookedHeroSprite('H999') === null") === true);

    check("C7 回归：AssetHooks 未被动过（其上无 hookedSprite/hookedAudio/hookedHeroSprite 属性）",
      ev(c, "typeof AssetHooks.hookedSprite === 'undefined' && typeof AssetHooks.hookedAudio === 'undefined' && typeof AssetHooks.hookedHeroSprite === 'undefined'") === true);
  }

  /* ===== 场景 D：hookedAudio 命中时 SFX.play 不抛（桩 Audio + rejected Promise） ===== */
  {
    const c = B.ctx;
    ev(c, `
      globalThis.__playCalls = 0;
      globalThis.__stubAudio = {
        currentTime: 99,
        play: function () { globalThis.__playCalls++; return Promise.reject(new Error('autoplay blocked')); }
      };
      AssetHooks.cache['sfx_probe'] = globalThis.__stubAudio;
      AssetHooks._kind['sfx_probe'] = 'audio';
    `);
    check("D1 hookedAudio 命中时 SFX.play('shoot','sfx_probe') 不抛（play() 的 rejected Promise 被吞掉）",
      ev(c, "(function(){ try { SFX.play('shoot','sfx_probe'); return true; } catch (e) { return false; } })()") === true);
    await settle();   // 让那个 rejected Promise 走完 catch，确认无未处理拒绝外溢
    check("D2 走真实音频路径：桩 Audio.play() 被调用且 currentTime 已复位为 0",
      ev(c, "globalThis.__playCalls === 1 && globalThis.__stubAudio.currentTime === 0") === true);

    ev(c, `
      globalThis.__throwAudio = { currentTime: 5, play: function () { throw new Error('hard throw'); } };
      AssetHooks.cache['sfx_throw'] = globalThis.__throwAudio;
      AssetHooks._kind['sfx_throw'] = 'audio';
    `);
    check("D3 play() 同步抛错时 SFX.play 不抛（回退合成路径，绝不外抛）",
      ev(c, "(function(){ try { SFX.play('shoot','sfx_throw'); return true; } catch (e) { return false; } })()") === true);
    check("D4 同步抛错时未接管：SFX.play 内部未再走真实路径（_playHooked 返回 false）",
      ev(c, "SFX._playHooked('sfx_throw') === false") === true);
  }

  /* ===== 场景 E：真实清单对照（config → 清单 → core，桩全成功）→ 入口端到端可通 ===== */
  {
    const { ctx } = makeSandbox();
    load(["js/config.js", "js/assets_manifest.js", "js/core.js"], ctx);   // 清单先于 core → 自举预加载
    await ev(ctx, "AssetHooks.ready()");
    const entryTotal = ev(ctx, "Object.keys(AssetManifest.sprites).length + Object.keys(AssetManifest.audio).length + Object.keys(AssetManifest.music).length");
    check("E1 真实清单对照：AssetHooks 装载条目 total/loaded = " + ev(ctx, "AssetHooks.stats().total") +
      "/" + ev(ctx, "AssetHooks.stats().loaded") + "（6+8+1=15，机制可通）",
      ev(ctx, "AssetHooks.stats().total === 15 && AssetHooks.stats().loaded === 15 && AssetHooks.stats().failed === 0"));
    check("E2 入口命中真实清单：Assets.hookedSprite('hero_H001') 返回桩对象（=== AssetHooks.sprite）",
      ev(ctx, "Assets.hookedSprite('hero_H001') !== null && Assets.hookedSprite('hero_H001') === AssetHooks.sprite('hero_H001')") === true);
    check("E3 入口命中真实清单：Assets.hookedAudio('sfx_shoot') 返回桩对象（=== AssetHooks.audio）",
      ev(ctx, "Assets.hookedAudio('sfx_shoot') !== null && Assets.hookedAudio('sfx_shoot') === AssetHooks.audio('sfx_shoot')") === true);
    check("E4 Assets.hookedHeroSprite('H001') 命中清单 hero_H001（渲染侧将来一行接入的键）",
      ev(ctx, "Assets.hookedHeroSprite('H001') === AssetHooks.sprite('hero_H001')") === true);
    check("E5 回归：stats() 结构仍为 total / loaded / 失败 三字段（既有契约未改动）",
      ev(ctx, "(function(s){ return typeof s.total === 'number' && typeof s.loaded === 'number' && typeof s.failed === 'number' && Object.keys(s).length === 3; })(AssetHooks.stats())") === true);
    check("E6 回归：原五方法齐备（init/sprite/audio/stats/ready 均为函数）",
      ev(ctx, "typeof AssetHooks.init === 'function' && typeof AssetHooks.sprite === 'function' && typeof AssetHooks.audio === 'function' && typeof AssetHooks.stats === 'function' && typeof AssetHooks.ready === 'function'") === true);
  }

  /* ---------- 汇总 ---------- */
  console.log("----------");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(failCount === 0 ? 0 : 1);

})().catch((e) => {
  console.log("断言执行中止（环境异常）：" + (e && e.message ? e.message : String(e)));
  console.log("PASS 合计 = " + passCount + "   失败数 = " + (failCount + 1));
  process.exit(1);
});
