/* ============================================================================
 * skill_playtest_test.js —— 技能系统「试玩通电」引导块（?skill=...）回归
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   ① 13 个脚本（含 js/skill-playtest.js）可无异常装载
 *   ② **默认空转**：未带 URL 参数 → active=false，总开关与迁移名单保持原样（正式零影响）
 *   ③ URL 解析矩阵（纯函数 parse）：?skill=1 / ?skill=H002 / 逗号多选 / ?hero= / 关闭值 / 非法值 / 无关参数
 *   ④ install()：只改内存（enabled=true + migratedHeroIds），不动 config.js
 *   ⑤ 懒注入：迁移英雄首次判定即挂 skillState（2 技能 + 4 水晶）并编出 builds；幂等
 *   ⑥ 边界：未迁移英雄 / 无 id 英雄 → false
 *   ⑦ 安全网：编译失败 → 回落旧路径（owns=false 且不挂空状态）
 *   ⑧ 叠加层 draw()：三类效果不抛异常；未通电时空操作
 *   ⑨ reset()：卸包装、还原判定
 *   ⑩ 接线静态校验：render.js 单行调用点 / index.html 脚本序 / config.js 默认值未被污染
 * 注意：PASS 行禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};

const ROOT = require("path").join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- 沙箱：按 index.html 顺序加载真实脚本 ---------------- */
const FILES = [
  "js/config.js",
  "js/core.js",
  "js/pool.js",
  "js/skill-config.js",
  "js/skill-compiler.js",
  "js/skill-damage.js",
  "js/skill-events.js",
  "js/skill-scheduler.js",
  "js/skill-runtime.js",
  "js/skill-reward.js",
  "js/skill-presenter.js",
  "js/skill-save.js",
  "js/skill-playtest.js",
];

let ctx = null, bootThrew = false;
try {
  ctx = vm.createContext({ console: { log() {}, warn() {} } });
  for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
} catch (e) {
  bootThrew = true;
  console.log("载入期异常：" + (e && e.message));
}
check("① 13 个脚本（含试玩引导块）可无异常装载", !bootThrew);

const ev = (code) => vm.runInContext(code, ctx);

/* ================== ② 不带 URL 参数：跟随配表（22.8 正式启用） ==================
 * ⚠️ 22.8 事故回归点：本文件是**整合层** —— 「包装 ownsHero + 懒注入 skillState」
 *    只在这里做。若只在 config.js 里把 enabled 翻成 true 而不接线，
 *    ownsHero 会返回 true（旧施放被跳过）但 skillState 从未注入 → 英雄完全不开火。
 *    故「不带参数」不再是空转，而是**走配表启用分支**。 */
check("② 不带参数：配表默认已是启用态（enabled=true）", ev("CFG.skillSystem.enabled") === true);
check("② 不带参数：迁移名单 = 首批试点 H001（配表自带）",
  ev("CFG.skillSystem.migratedHeroIds.length") === 1 && ev('CFG.skillSystem.migratedHeroIds[0]') === "H001");
check("② ★不带参数也已接线：active=true（22.8 事故回归点）", ev("SkillPlaytest.active") === true);
check("② ★接线来源标记 = \"config\"（配表启用，非 url 试玩）", ev("SkillPlaytest.source") === "config");
check("② ★不带参数也包装 ownsHero（懒注入入口就位）", ev("SkillPlaytest._patched") === true);
check("② 配表启用分支不写入 heroIds 之外的东西（名单与配表逐字一致）",
  ev("SkillPlaytest.heroIds.join('+')") === ev("CFG.skillSystem.migratedHeroIds.join('+')"));
check("② 配表启用分支不改动配置表本身（enabled 仍为字面 true，未被覆写）",
  ev("CFG.skillSystem.enabled === true && CFG.skillSystem.migratedHeroIds.join('+') === 'H001'"));

/* ================== ③ URL 解析矩阵（纯函数） ================== */
const P = (s) => ev("SkillPlaytest.parse(" + JSON.stringify(s) + ")");
const onOff = (s) => P(s).on;
const idsOf = (s) => P(s).heroIds.join("+");

check("③ ?skill=1 → 通电，默认试点 H001", onOff("?skill=1") === true && idsOf("?skill=1") === "H001");
check("③ ?skill=on → 通电，默认 H001", onOff("?skill=on") === true && idsOf("?skill=on") === "H001");
check("③ ?skill=H002 → 试点 H002", idsOf("?skill=H002") === "H002");
check("③ ?skill=h002 → 小写也认（归一化）", idsOf("?skill=h002") === "H002");
check("③ ?skill=H001,H003 → 两个英雄", idsOf("?skill=H001,H003") === "H001+H003");
check("③ ?skill=1&hero=H004 → 试点 H004", idsOf("?skill=1&hero=H004") === "H004");
check("③ ?skill=H002&hero=H002 → 去重后单个", idsOf("?skill=H002&hero=H002") === "H002");
check("③ ?skill=0 → 显式关闭（空转）", onOff("?skill=0") === false);
check("③ ?skill=off → 空转", onOff("?skill=off") === false);
check("③ ?skill= （空值）→ 空转", onOff("?skill=") === false);
check("③ ?skill=zzz（非法）→ 兜底 H001", onOff("?skill=zzz") === true && idsOf("?skill=zzz") === "H001");
check("③ ?stress=3000（无关参数）→ 空转", onOff("?stress=3000") === false);
check("③ 空字符串 / undefined → 空转", onOff("") === false && P(undefined).on === false);
check("③ 只认 H### 形状：?skill=H99 被过滤后兜底 H001", idsOf("?skill=H99") === "H001");

/* ================== ④ install()：只改内存 ================== */
ev('SkillPlaytest.install("?skill=1")');
check("④ install 后 active=true", ev("SkillPlaytest.active") === true);
check("④ install 后总开关 = true（内存）", ev("CFG.skillSystem.enabled") === true);
check("④ install 后迁移名单 = [H001]", ev("CFG.skillSystem.migratedHeroIds.join('+')") === "H001");
check("④ install 后已包装 ownsHero", ev("SkillPlaytest._patched") === true);
check("④ status() 反映当前状态", (function () {
  const s = ev("SkillPlaytest.status()");
  return s.active === true && s.enabled === true && s.migrated.join("+") === "H001" && s.heroIds.join("+") === "H001";
})());

/* ================== ⑤ 懒注入：迁移英雄首次判定即通电 ================== */
const inj = ev('(function(){' +
  ' var h = { id:"H001", x:100, y:100, r:14, alive:true };' +
  ' var owns = SkillRuntime.ownsHero(h);' +
  ' var st = h.skillState || {};' +
  ' return { owns: owns, built: !!(st.builds),' +
  '          skills: Object.keys(st.skills || {}).sort().join("+"),' +
  '          crystals: (st.crystals || []).length,' +
  '          slots: st.slotCount,' +
  '          fireballNodes: (st.builds && st.builds.SK_FIREBALL && st.builds.SK_FIREBALL.nodes) ? Object.keys(st.builds.SK_FIREBALL.nodes).length : 0 };' +
  '})()');
check("⑤ 迁移英雄 → ownsHero=true 且已自动注入 skillState", inj.owns === true && inj.built === true);
check("⑤ 注入只含 1 个初始技能（武器绑定，无普攻）", inj.skills === "SK_FIREBALL");
check("⑤ 注入 4 颗水晶，占满 4 槽", inj.crystals === 4 && inj.slots === 4);
check("⑤ 编译产物含火球主节点（builds 可被运行时读取）", inj.fireballNodes >= 1);

check("⑤ 幂等：第二次判定不重建状态对象", ev('(function(){' +
  ' var h = { id:"H001" }; SkillRuntime.ownsHero(h); var a = h.skillState;' +
  ' SkillRuntime.ownsHero(h); return a === h.skillState; })()') === true);

check("⑤ 队友/玩家各自持有独立状态（非共享引用）", ev('(function(){' +
  ' var a = { id:"H001" }, b = { id:"H001" };' +
  ' SkillRuntime.ownsHero(a); SkillRuntime.ownsHero(b);' +
  ' return !!a.skillState && !!b.skillState && a.skillState !== b.skillState &&' +
  '        a.skillState.crystals !== b.skillState.crystals; })()') === true);

/* ================== ⑥ 边界：非迁移 / 无 id ================== */
check("⑥ 未迁移英雄 → ownsHero=false（留在旧路径）", ev('SkillRuntime.ownsHero({ id:"H009" })') === false);
check("⑥ 无 id 英雄 → false", ev('SkillRuntime.ownsHero({})') === false);
check("⑥ null / undefined → false", ev('SkillRuntime.ownsHero(null)') === false && ev('SkillRuntime.ownsHero(undefined)') === false);

/* ================== ⑦ 安全网：编译失败回落旧路径 ================== */
const fb = ev('(function(){' +
  ' var oc = SupportCompiler.compile;' +
  ' SupportCompiler.compile = function(){ return { ok:false, diagnostics:[{ code:"MOCK" }] }; };' +
  ' try { var h = { id:"H005" }; var owns = SkillRuntime.ownsHero(h);' +
  '   return { owns: owns, hasState: !!h.skillState }; }' +
  ' finally { SupportCompiler.compile = oc; }' +
  '})()');
check("⑦ 编译失败 → ownsHero 回落 false（不两头空）", fb.owns === false);
check("⑦ 编译失败 → 不挂空 skillState", fb.hasState === false);

/* ================== ⑧ 叠加层 draw() ================== */
const drawn = ev('(function(){' +
  ' var calls = 0;' +
  ' var ctx = { beginPath:function(){calls++;}, arc:function(){}, fill:function(){},' +
  '             stroke:function(){}, setLineDash:function(){}, save:function(){}, restore:function(){} };' +
  ' var w = { __skillEffects: [' +
  '   { x:1, y:1, radius:10, state:"active", rt:{ category:"flightProjectile", params:{} } },' +
  '   { x:2, y:2, radius:20, state:"active", rt:{ category:"instantArea", params:{} } },' +
  '   { x:3, y:3, radius:30, state:"active", rt:{ category:"persistentArea", params:{} } },' +
  '   { x:4, y:4, radius:8,  state:"active", rt:{ category:"orbitContact", params:{ radius:70 } } }' +
  ' ] };' +
  ' try { SkillPlaytest.draw(ctx, w); return calls; } catch (e) { return -1; }' +
  '})()');
check("⑧ draw：四类效果全部绘制且不抛异常", drawn > 0);

const emptyDraw = ev('(function(){' +
  ' var n = 0; var ctx = { beginPath:function(){n++;}, arc:function(){}, fill:function(){},' +
  '   stroke:function(){}, setLineDash:function(){}, save:function(){}, restore:function(){} };' +
  ' try { SkillPlaytest.draw(ctx, { __skillEffects: [] }); SkillPlaytest.draw(ctx, {});' +
  '   SkillPlaytest.draw(ctx, null); SkillPlaytest.draw(null, null); return n; } catch (e) { return -1; }' +
  '})()');
check("⑧ draw：空世界 / 空参数不抛且零绘制", emptyDraw === 0);

/* ================== ⑨ reset()：卸包装还原 ================== */
ev('SkillPlaytest.install("?skill=1")');            // 重新装一次（上一段 ⑦⑧ 之后可能已被 reset）
ev("SkillPlaytest.reset()");
check("⑨ reset 后 active=false / 未包装（ownsHero + triggerAltar 双闸门）",
  ev("SkillPlaytest.active") === false && ev("SkillPlaytest._patched") === false &&
  ev("SkillPlaytest._patchedAltar") === false);
check("⑨ reset 后迁移英雄不再被懒注入（包装已卸）", ev('(function(){ var h = { id:"H001" };' +
  ' SkillRuntime.ownsHero(h); return !h.skillState; })()') === true);
ev("CFG.skillSystem.enabled = false; CFG.skillSystem.migratedHeroIds = [];");   // 复原内存开关
check("⑨ 关掉内存开关后 ownsHero 恒 false（原始判定已还原）",
  ev('SkillRuntime.ownsHero({ id:"H001" })') === false);

/* ================== ⑩ 接线静态校验 ================== */
const renderSrc = read("js/render.js");
check("⑩ render.js 含受守卫的单行调用点", renderSrc.indexOf("SkillPlaytest.draw(ctx, w)") >= 0);
check("⑩ 调用点带 typeof 守卫（模块缺失时安全）",
  renderSrc.indexOf('typeof SkillPlaytest !== "undefined"') >= 0);
check("⑩ 调用点在 ctx.restore() 之前（世界坐标作用域内）", (function () {
  const iCall = renderSrc.indexOf("SkillPlaytest.draw(ctx, w)");
  const iRestore = renderSrc.indexOf("ctx.restore();   // 收束屏幕震动 translate");
  return iCall >= 0 && iRestore > iCall;
})());

const html = read("index.html");
const iSave = html.indexOf('<script src="js/skill-save.js?v=');
const iPlay = html.indexOf('<script src="js/skill-playtest.js?v=');
const iMain = html.indexOf('<script src="js/main.js?v=');
check("⑩ index.html 脚本序：skill-save → skill-playtest → main",
  iSave >= 0 && iPlay > iSave && iMain > iPlay);

const cfgSrc = read("js/config.js");
check("⑩ config.js 默认已正式启用（22.8 启用批次：enabled:true / migratedHeroIds:[\"H001\"]）",
  /enabled:\s*true/.test(cfgSrc) && /migratedHeroIds:\s*\["H001"\]/.test(cfgSrc));
check("⑩ config.js 已登记武器绑定初始技能（initialSkillBindings H001→SK_FIREBALL）",
  /initialSkillBindings:\s*\{/.test(cfgSrc) && /H001:\s*\{\s*weaponId:\s*"W001",\s*skillId:\s*"SK_FIREBALL"/.test(cfgSrc));
check("⑩ config.js 已登记稀有技能池（rareSkillPool 非空）",
  /rareSkillPool:\s*\[/.test(cfgSrc) && ev("CFG.skillSystem.rareSkillPool.length") > 0);

/* ================== ⑪ 雕像授予稀有技能（v0.5 §1 正式流程） ==================
 * 沙箱无 game.js → 注入最小 World 桩，验证 triggerAltar 原型包装与授予链路。 */
ev('class World { triggerAltar(a){ this.calls = (this.calls||0)+1; this.altars = [a]; } }');
ev("SkillPlaytest.reset()");
ev("CFG.skillSystem.enabled = false; CFG.skillSystem.migratedHeroIds = [];");
ev('SkillPlaytest.install("?skill=1")');
check("⑪ install 后已包装 World.triggerAltar", ev("SkillPlaytest._patchedAltar") === true);
check("⑪ status() 反映 altarPatched", ev("SkillPlaytest.status().altarPatched") === true);

const statue = ev('(function(){' +
  ' var h = { id:"H001", x:0, y:0 }; SkillRuntime.ownsHero(h);' +
  ' var w = new World(); w.player = h; w.companions = [];' +
  ' var before = Object.keys(h.skillState.skills).sort().join("+");' +
  ' w.triggerAltar({ cfg:{ name:"女神雕像", effects:[{type:"heal",pct:0.25}] } });' +
  ' var after = Object.keys(h.skillState.skills).sort().join("+");' +
  ' var builds = Object.keys(h.skillState.builds || {}).sort().join("+");' +
  ' var calls = w.calls;' +
  ' w.triggerAltar({ cfg:{ name:"战争雕像", effects:[{type:"randomBuff",pool:"war",duration:20}] } });' +
  ' var twice = Object.keys(h.skillState.skills).sort().join("+");' +
  ' return { before: before, after: after, builds: builds, calls: calls, twice: twice };' +
  '})()');
check("⑪ 踩雕像前：只有 1 个初始技能", statue.before === "SK_FIREBALL");
check("⑪ 踩奖励雕像 → 授予稀有技能（1 → 2）", statue.after === "SK_FIREBALL+SK_SHOCKWAVE");
check("⑪ 授予后 builds 同步含两个技能（已重编译）", statue.builds === "SK_FIREBALL+SK_SHOCKWAVE");
check("⑪ 雕像本体仍被调用（只追加、不替换）", statue.calls === 1);
check("⑪ 再踩雕像不重复授予（每英雄至多 1 个稀有）", statue.twice === "SK_FIREBALL+SK_SHOCKWAVE");

const noGrant = ev('(function(){' +
  ' var h = { id:"H001" }; SkillRuntime.ownsHero(h);' +
  ' var w = new World(); w.player = h; w.companions = [];' +
  ' w.triggerAltar({ cfg:{ name:"工匠雕像", effects:[{type:"teleport",submap:"artisan"}] } });' +
  ' w.triggerAltar({ cfg:{ name:"空间裂缝", effects:[{type:"rift"}] } });' +
  ' return Object.keys(h.skillState.skills).sort().join("+");' +
  '})()');
check("⑪ 工匠雕像 / 空间裂缝不授予稀有技能", noGrant === "SK_FIREBALL");

ev("SkillPlaytest.reset()");
check("⑪ reset 后已卸掉 triggerAltar 包装", ev("SkillPlaytest._patchedAltar") === false);
check("⑪ reset 后雕像本体行为照旧（桩计数仍可累加）", ev('(function(){' +
  ' var w = new World(); w.triggerAltar({ cfg:{ effects:[{type:"heal",pct:0.1}] } });' +
  ' return w.calls === 1; })()') === true);

/* ================== 汇总 ================== */
console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
