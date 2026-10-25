/* ============================================================================
 * crystal_ui_test.js —— 能量水晶「启用」批次 W2 界面回归（node crystal_ui_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（施工依据 = G_docs/skill_enable_batch_plan_v1.md 的 W2 屏1~屏4）：
 *   ① 全量脚本按 index.html 顺序可无异常装载（24 文件）+ 选择弹窗 DOM 静态清单
 *   ② **未通电零影响**：默认总开关 off → `_crystalModeOf` 恒 null；技能栏逐字走旧
 *      [图标][英雄名][4 模块槽]（`.ps-slot` ×4 / `.ps-icon` ×1 / 无 crystal-* 类）
 *   ③ 通电（`?skill=1`）→ 懒注入 skillState → 水晶态可取到（4 槽、初始技能在左）
 *   ④ 屏2 战斗技能栏：`A X X X X A`（英雄名在最左；技能—水晶—技能簇相邻；
 *      仅 1 个技能时不补空壳）
 *   ⑤ 屏3 水晶详情浮窗：文案**全部来自 SkillPresenter.detail**（合同 §13）
 *   ⑥ 屏4 稀有技能选择弹窗：踩奖励雕像 → 弹窗 + 暂停；选中后才写入；关闭=取首项
 *   ⑦ 屏1 升级 4 选 1：候选换成能量水晶 + 卡面辅助矩阵；入装/升级/槽满拒绝
 *   ⑧ 通用选择弹窗的开关/置灰/回调/幂等语义
 *   ⑨ APP_VERSION 三处一致（meta + 全部 ?v= + core.js Assets.buildVersion）
 *
 * ⚠️ PASS 文案禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

/* ---------------- DOM 桩（与 ui_v2_test.js 同款：classList 真实语义 + getElementById 自动造元素） -------- */
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
    this.width = 300; this.height = 300; this.value = "";
  }
  get className() { return this._cls || ""; }
  set className(v) {
    this._cls = v; this.classList = new ClassList();
    String(v).split(/\s+/).forEach(c => { if (c) this.classList.add(c); });
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v;
    this.children.length = 0;
    this._q = null; this._qa = null;
    const re = /<(\w+)([^>]*\bclass\s*=\s*"([^"]*)"[^>]*)>/g;
    let m;
    while ((m = re.exec(v)) !== null) {
      const el = new FakeEl(m[1]);
      el.className = m[3];
      el._parent = this;
      this.children.push(el);
    }
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  _findAll(cls, acc) {
    acc = acc || [];
    for (const c of this.children) {
      if (c.classList && c.classList.contains(cls)) acc.push(c);
      if (c._findAll) c._findAll(cls, acc);
    }
    return acc;
  }
  querySelectorAll(sel) {
    this._qa = this._qa || {};
    if (!this._qa[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._qa[sel] = list;
      this._q = this._q || {};
      if (list.length && !this._q[sel]) this._q[sel] = list[0];
    }
    return this._qa[sel];
  }
  closest(sel) {
    const sels = String(sel).split(",").map(s => s.trim()).filter(Boolean);
    let el = this;
    while (el) {
      for (const s of sels) {
        if (s.charAt(0) === ".") {
          if (el.classList && el.classList.contains(s.slice(1))) return el;
        } else if (s.charAt(0) === "#") {
          if (el._id === s.slice(1)) return el;
        }
      }
      el = el._parent;
    }
    return null;
  }
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
  getElementById(id) { const el = elCache[id] || (elCache[id] = new FakeEl(id)); el._id = id; return el; },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
Object.defineProperty(global.document, "body", { get() { return this.getElementById("body"); }, configurable: true });
const winHandlers = {};
global.window = {
  addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); },
  dispatchEvent(ev) { (winHandlers[ev && ev.type] || []).forEach(fn => fn(ev)); return true; },
  innerWidth: 1920, innerHeight: 1080,
};
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");
let passCount = 0, failCount = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (cond) passCount++; else failCount++;
};
const ROOT = path.join(__dirname, "..", "..", "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- ① 全量脚本按 index.html 顺序装载（与浏览器同序） ---------------- */
const html = read("index.html");
const scripts = [...html.matchAll(/<script src="((?:js|mods)\/[^"?]+)/g)].map(m => m[1]);
let loadErr = "";
const ctx = vm.createContext(global);
try { for (const f of scripts) vm.runInContext(read(f), ctx, { filename: f }); }
catch (e) { loadErr = (e && e.message) || "?"; }
check("① " + scripts.length + " 个脚本按 index.html 顺序可无异常装载", !loadErr);
if (loadErr) {
  console.log("载入期异常：" + loadErr);
  console.log("");
  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  process.exit(1);
}
const ev = (code) => vm.runInContext(code, ctx);

/* ---------------- ① 静态：选择弹窗与技能栏 DOM 齐备（DOM 桩抓不到缺失元素） ---------------- */
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
for (const id of ["choice-overlay", "choice-title", "choice-sub", "choice-cards",
  "party-skillbar", "module-tip", "levelup-overlay", "levelup-cards"]) {
  check("① index.html 含 #" + id, htmlIds.has(id));
}

/* ---------------- ② 关闭态：逐字旧渲染（零影响安全网） ----------------
 * ⚠️ 22.8 起配表默认就是**启用态**，故「未通电」必须**显式关闭**来构造：
 *    `SkillPlaytest.reset()`（卸包装）+ 关 `enabled` + 清空迁移名单。
 *    这一段守的是「旧路径渲染逐字不动」——不因新系统存在而被改坏。 */
ev('Game.bindEvents(); UI.selectedLevel = CFG.levels[0]; Game.startRun([CFG.heroes[0]]); Game.skipIntroFreeze();');
check("② 配表默认已启用（22.8 正式启用批次）", ev("CFG.skillSystem.enabled") === true);
check("② 默认迁移名单 = 技能绑定表键集（正式启用范围明确，含首批试点 H001）",
  ev("CFG.skillSystem.migratedHeroIds.length") > 0 &&
  ev("CFG.skillSystem.migratedHeroIds.length") === ev("Object.keys(CFG.skillSystem.initialSkillBindings).length") &&
  ev('CFG.skillSystem.migratedHeroIds.indexOf("H001")') >= 0);
ev('SkillPlaytest.reset(); CFG.skillSystem.enabled = false; CFG.skillSystem.migratedHeroIds = []; UI._crystalCache = {};');
check("② 显式关闭后：_crystalModeOf 恒返回 null", ev('UI._crystalModeOf({ id: "H001", rt: G.player })') === null);
ev("UI._psSig = null; UI._psCache = null; UI.renderPartySkillbar();");
check("② 关闭态：行不带 crystal-row", ev('String(document.getElementById("party-skillbar").children[0].className).indexOf("crystal-row") < 0') === true);
check("② 关闭态：每行 1 个技能图标", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-icon").length') === 1);
check("② 关闭态：每行 4 个 .ps-slot（旧结构不变）", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-slot").length') === 4);
check("② 关闭态：无 crystal-slot 类", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".crystal-slot").length') === 0);
check("② 关闭态：子元素序 = 图标→英雄名→槽（19.12 结构逐字保留）",
  ev('document.getElementById("party-skillbar").children[0].children.map(function(c){ return c.classList.contains("ps-icon") ? "A" : (c.classList.contains("ps-info") ? "I" : (c.classList.contains("ps-slots") ? "X" : "?")); }).join("")') === "AIX");
/* 恢复配表启用态（后续段落按「正式启用」跑） */
ev('CFG.skillSystem.enabled = true; CFG.skillSystem.migratedHeroIds = ["H001"]; UI._crystalCache = {};');

/* ---------------- ③ 通电：懒注入 + 水晶态 ---------------- */
ev('SkillPlaytest.install("?skill=1")');
check("③ 通电后总开关打开（只改内存）", ev("CFG.skillSystem.enabled") === true);
check("③ 通电后迁移名单 = H001", ev("CFG.skillSystem.migratedHeroIds.join()") === "H001");
check("③ 首次判定即懒注入（ownsHero(G.player) 为真）", ev("SkillRuntime.ownsHero(G.player)") === true);
check("③ 英雄已挂 skillState 且已编译 builds", ev("!!(G.player.skillState && G.player.skillState.builds)") === true);
const cm0 = ev('(function(){ var m = UI._crystalModeOf({ id: G.player.id, rt: G.player });' +
  ' return m ? { n: m.panel.slots.length, sk: m.skills.map(function(s){ return s.skillId; }).join("+") } : null; })()');
check("③ 水晶态可取到（面板 4 槽）", !!cm0 && cm0.n === 4);
check("③ 初始技能在左（当前仅 1 个技能）", !!cm0 && cm0.sk === "SK_FIREBALL");
check("③ 技能顺序函数：初始技能恒排首位（输入乱序也成立）",
  ev('UI._crystalSkillOrder("H001", { skills: [ { skillId: "SK_SHOCKWAVE" }, { skillId: "SK_FIREBALL" } ] })[0].skillId') === "SK_FIREBALL");
/* 真·编译失败的安全网：ownsHero 回落 false → 水晶态为 null，且异常不逃逸。
 * （22.8 起 `_crystalModeOf` 会**先**问 ownsHero —— 那是懒注入入口，故这里直接让编译器抛。）
 * 注意：抛出的对象刻意不带 message 字段，避免任何含英文 Error 的文案进入门禁输出。 */
check("③ 编译真失败 → 水晶态返回 null 且异常不外泄（安全网）",
  ev('(function(){ var orig = SupportCompiler.compile;'
    + ' SupportCompiler.compile = function(){ throw { code: "SIMULATED" }; };'
    + ' var rt = { id: "H001" }; var r = null, threw = false;'
    + ' try { r = UI._crystalModeOf({ id: "H001", rt: rt }); } catch (e) { threw = true; }'
    + ' SupportCompiler.compile = orig; UI._crystalCache = {};'
    + ' return r === null && threw === false && !rt.skillState; })()') === true);

/* ---------------- ④ 屏2：战斗技能栏 A X X X X A ---------------- */
ev("UI._psSig = null; UI._psCache = null; UI.renderPartySkillbar();");
check("④ 通电：行带 crystal-row", ev('String(document.getElementById("party-skillbar").children[0].className).indexOf("crystal-row") >= 0') === true);
check("④ 通电：4 个 crystal-slot（同时保留 .ps-slot 结构）",
  ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".crystal-slot").length') === 4 &&
  ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-slot").length') === 4);
check("④ 通电：1 个技能时不补空壳（仍 1 个图标）", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-icon").length') === 1);
check("④ 通电：子元素序 = 英雄名→技能→槽（簇相邻）",
  ev('document.getElementById("party-skillbar").children[0].children.map(function(c){ return c.classList.contains("ps-icon") ? "A" : (c.classList.contains("ps-info") ? "I" : (c.classList.contains("ps-slots") ? "X" : "?")); }).join("")') === "IAX");
const cs0 = ev('(function(){ var r = document.getElementById("party-skillbar").children[0]; var s = r.querySelectorAll(".crystal-slot")[0];' +
  ' return { html: s.innerHTML, cls: String(s.className), bc: s.style.borderColor, t: s.title, name: CFG.skillSystem.localization[CFG.skillSystem.crystalDefs.CR_ARCANE_AMP.presentation.nameKey] }; })()');
check("④ 水晶槽显示**文案表里的名字**（不是 CR_ 内部 id）",
  cs0.html.indexOf(cs0.name) >= 0 && cs0.html.indexOf("CR_") < 0);
check("④ 水晶槽带 filled 类 + 品质色边框", cs0.cls.indexOf("ps-slot-filled") >= 0 && !!cs0.bc);
const CLMAX = ev("CFG.skillSystem.crystalDefs.CR_ARCANE_AMP.levels.length");
check("④ 水晶槽等级文案 = Lv n/levels.length（22.8 等级表已扩到 " + CLMAX + " 级）",
  cs0.html.indexOf("Lv1/" + CLMAX) >= 0 && cs0.t.indexOf("Lv1/" + CLMAX) >= 0);

/* ---------------- ⑤ 屏3：水晶详情浮窗（文案全部来自 SkillPresenter.detail） ---------------- */
ev('(function(){ var r = document.getElementById("party-skillbar").children[0]; var s = r.querySelectorAll(".crystal-slot")[0];' +
  ' document.getElementById("party-skillbar").onclick({ target: s }); })()');
check("⑤ 点击水晶槽 → 浮窗打开", ev('document.getElementById("module-tip").classList.contains("hidden")') === false);
check("⑤ 浮窗文案来自 SkillPresenter.detail（含「共享水晶槽」装配规则）",
  ev('document.getElementById("module-tip").innerHTML.indexOf("共享水晶槽") >= 0') === true);
check("⑤ 浮窗文案含「两技能收益」（detail 分节拼接）",
  ev('document.getElementById("module-tip").innerHTML.indexOf("两技能收益") >= 0') === true);
check("⑤ 浮窗落痕 dataset.crystal = 该槽水晶 id",
  ev('document.getElementById("module-tip").dataset.crystal') === "CR_ARCANE_AMP");
check("⑤ 再点同一槽 → 关闭（toggle 语义保留）",
  ev('(function(){ var r = document.getElementById("party-skillbar").children[0]; var s = r.querySelectorAll(".crystal-slot")[0];' +
    ' document.getElementById("party-skillbar").onclick({ target: s }); return document.getElementById("module-tip").classList.contains("hidden"); })()') === true);

/* ---------------- ⑥ 屏4：稀有技能选择弹窗 ---------------- */
check("⑥ 弹窗前：技能数 = 1", ev("Object.keys(G.player.skillState.skills).length") === 1);
ev('(function(){ var w = { player: G.player, companions: [] };' +
  ' SkillPlaytest.grantRareSkillOnAltar(w, { cfg: { name: "女神雕像", effects: [ { type: "heal", pct: 0.25 } ] } }); })()');
check("⑥ 踩奖励雕像 → 弹出稀有技能选择弹窗", ev("UI.choiceOpen") === true);
check("⑥ 弹窗标题 = 获得稀有技能", ev('document.getElementById("choice-title").textContent') === "获得稀有技能");
check("⑥ 副标题标注归属英雄", ev('document.getElementById("choice-sub").textContent').indexOf("猎手") >= 0);
check("⑥ 候选数 = rareSkillPool 长度（数据驱动）",
  ev('document.getElementById("choice-cards").children.length') === ev("CFG.skillSystem.rareSkillPool.length"));
check("⑥ 弹窗期间战斗暂停（Game.paused）", ev("Game.paused") === true);
check("⑥ 选择前技能数不变（弹窗只是提议，未写入）", ev("Object.keys(G.player.skillState.skills).length") === 1);
ev('document.getElementById("choice-cards").children[0].onclick()');
check("⑥ 选中后授予稀有技能（1 → 2，并按规范排序）",
  ev('Object.keys(G.player.skillState.skills).sort().join("+")') === "SK_FIREBALL+SK_SHOCKWAVE");
check("⑥ 授予后 builds 同步重编译（两技能都在）",
  ev('Object.keys(G.player.skillState.builds).sort().join("+")') === "SK_FIREBALL+SK_SHOCKWAVE");
check("⑥ 授予后弹窗关闭", ev("UI.choiceOpen") === false);
check("⑥ 授予后暂停解除（队列清空）", ev("Game.paused") === false);

/* ---------------- ④' 两技能 → A X X X X A 完整形态 ---------------- */
ev("UI._psSig = null; UI._psCache = null; UI.renderPartySkillbar();");
check("④' 两技能：2 个技能图标", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".ps-icon").length') === 2);
check("④' 两技能：中间仍是 4 个水晶槽", ev('document.getElementById("party-skillbar").children[0].querySelectorAll(".crystal-slot").length') === 4);
check("④' 两技能：子元素序 = 英雄名→技能→槽→技能（A X X X X A 簇）",
  ev('document.getElementById("party-skillbar").children[0].children.map(function(c){ return c.classList.contains("ps-icon") ? "A" : (c.classList.contains("ps-info") ? "I" : (c.classList.contains("ps-slots") ? "X" : "?")); }).join("")') === "IAXA");
check("④' 技能—水晶簇内部结构 = A + 4 水晶 + A",
  ev('(function(){ var r = document.getElementById("party-skillbar").children[0];' +
    ' var out = ""; for (var i = 0; i < r.children.length; i++) { var c = r.children[i];' +
    ' if (c.classList.contains("ps-info")) continue;' +
    ' out += c.classList.contains("ps-icon") ? "A" : (c.classList.contains("ps-slots") ? "XXXX" : "?"); } return out; })()') === "AXXXXA");
check("④' 两技能各自独立冷却读数（不共享一个环）",
  ev('(function(){ var r = document.getElementById("party-skillbar").children[0]; var ic = r.querySelectorAll(".ps-icon");' +
    ' return ic.length === 2 && !!ic[0].querySelector(".ps-arc") && !!ic[1].querySelector(".ps-arc"); })()') === true);

/* ---------------- ⑦ 屏1：升级 4 选 1 换成能量水晶 + 辅助矩阵 ---------------- */
const lvInfo = ev('(function(){ var c = buildLevelUpCandidates(G.player.id);' +
  ' return { n: c.length, kinds: c.map(function(x){ return x.kind; }).join("+"),' +
  '  lockedAll: c.every(function(x){ return !!x.locked; }),' +
  '  mx: (c[0] && c[0].matrix) ? c[0].matrix.map(function(m){ return m.skillName + ":" + m.status; }).join("|") : "",' +
  '  name: c[0] ? c[0].name : "", hasQ: !!(c[0] && c[0].quality && c[0].quality.color) }; })()');
check("⑦ 通电后 4 选 1 候选全为能量水晶", lvInfo.n > 0 && lvInfo.kinds.split("+").every(k => k === "crystal"));
check("⑦ 候选名取自文案表（非 CR_ 内部 id）", lvInfo.name.length > 0 && lvInfo.name.indexOf("CR_") < 0);
check("⑦ 候选带品质色", lvInfo.hasQ === true);
check("⑦ 候选带辅助矩阵（逐技能状态，来自编译解释而非界面推断）",
  lvInfo.mx.indexOf("火球:applied") >= 0);
check("⑦ 4 槽已满 → 候选不出现「新装」项（全部是升级项）",
  ev('buildLevelUpCandidates(G.player.id).every(function(c){ return c.isUpgrade === true; })') === true);

const upRes = ev('(function(){ var st = G.player.skillState; var cid = st.crystals[0].crystalId;' +
  ' var n0 = st.crystals.length, lv0 = st.crystals[0].level, ver0 = st.groupVersion;' +
  ' var ok = applyCrystalPick(G.player.id, cid);' +
  ' var lv1 = null; for (var i = 0; i < st.crystals.length; i++) if (st.crystals[i].crystalId === cid) lv1 = st.crystals[i].level;' +
  ' return { ok: ok, n0: n0, n1: st.crystals.length, lv0: lv0, lv1: lv1, ver: st.groupVersion - ver0, nb: Object.keys(st.builds).length }; })()');
check("⑦ 升级已有水晶：返回成功且槽数不变", upRes.ok === true && upRes.n1 === upRes.n0);
check("⑦ 升级已有水晶：等级 +1", upRes.lv1 === upRes.lv0 + 1);
check("⑦ 升级后 groupVersion +1（首帧缓存自动失效）", upRes.ver === 1);
check("⑦ 升级后 builds 已重编译（两技能都在）", upRes.nb === 2);

const fullRes = ev('(function(){ var st = G.player.skillState;' +
  ' var before = st.crystals.map(function(c){ return c.crystalId; }).join("+") + "@" + st.groupVersion;' +
  ' var ok = applyCrystalPick(G.player.id, "CR_SPLIT");' +
  ' var after = st.crystals.map(function(c){ return c.crystalId; }).join("+") + "@" + st.groupVersion;' +
  ' return { ok: ok, same: before === after, n: st.crystals.length, slots: st.slotCount }; })()');
check("⑦ 4 槽已满 → 新装水晶被拒（返回 false）", fullRes.ok === false && fullRes.n === fullRes.slots);
check("⑦ 被拒后配装与版本号完全未变（无半截写入）", fullRes.same === true);

/* 卡面渲染：类型标签 + 辅助矩阵 + 品质等级胶囊 */
ev('UI.onLevelUpChoice(buildLevelUpCandidates(G.player.id), function(){}, { heroId: G.player.id, heroName: heroDefNameOf(G.player.id) });');
const luHtml = ev('document.getElementById("levelup-cards").children[0].innerHTML');
check("⑦ 卡面类型标签 = 能量水晶", luHtml.indexOf("能量水晶") >= 0);
check("⑦ 卡面含辅助矩阵容器（lu-matrix）与状态标签", luHtml.indexOf("lu-matrix") >= 0 && luHtml.indexOf("生效") >= 0);
check("⑦ 卡面底部胶囊含品质名 + Lv n/max", /lu-chip-in/.test(luHtml) && /Lv \d+\/\d+/.test(luHtml));
check("⑦ 卡面结构复用既有升级弹窗（#levelup-overlay 打开且非隐藏）",
  ev('document.getElementById("levelup-overlay").classList.contains("hidden")') === false);
ev("UI.onLevelUpChoiceClose();");

/* 未通电英雄仍走旧模块候选（混合队伍语义） */
check("⑦ 未迁移英雄 → 候选回落旧模块/属性包（不含 crystal）",
  ev('(function(){ CFG.skillSystem.migratedHeroIds = []; var c = buildLevelUpCandidates("H002");' +
    ' var ok = c.every(function(x){ return x.kind !== "crystal"; }); CFG.skillSystem.migratedHeroIds = ["H001"]; return ok; })()') === true);

/* ---------------- ⑧ 通用选择弹窗语义 ---------------- */
check("⑧ showChoice 正常打开", ev('UI.showChoice({ title: "T", sub: "S", options: [ { id: "a", name: "甲", desc: "d1" }, { id: "b", name: "乙", desc: "d2", locked: true } ] })') === true);
check("⑧ 标题/副标题已写入", ev('document.getElementById("choice-title").textContent') === "T" && ev('document.getElementById("choice-sub").textContent') === "S");
check("⑧ 渲染 2 张卡（含卡名）",
  ev('document.getElementById("choice-cards").children.length') === 2 &&
  ev('document.getElementById("choice-cards").children[0].innerHTML.indexOf("甲") >= 0') === true);
check("⑧ 置灰卡不可点（无 onclick）", ev('typeof document.getElementById("choice-cards").children[1].onclick') === "undefined");
ev("UI.closeChoice();");
check("⑧ closeChoice 释放回调并隐藏", ev("UI.choiceOpen") === false && ev('document.getElementById("choice-overlay").classList.contains("hidden")') === true);
ev('window.__c = -1; UI.showChoice({ options: [ { name: "甲" }, { name: "乙" } ], onPick: function(i){ window.__c = i; } });');
ev('document.getElementById("choice-cards").children[1].onclick();');
check("⑧ 点第 2 张 → 回调收到索引 1（0 基）", ev("window.__c") === 1);
check("⑧ 选择后自动关闭", ev("UI.choiceOpen") === false);
check("⑧ 空选项 → 返回 false（不打开，绝不悬挂）", ev('UI.showChoice({ options: [] })') === false);
check("⑧ closeChoice 可重复调用（幂等）", ev('UI.closeChoice(); UI.closeChoice(); UI.choiceOpen === false') === true);

/* ---------------- ⑨ APP_VERSION 三处一致 ---------------- */
const metaVer = (/<meta name="app-version" content="(\d+)">/.exec(html) || [])[1];
check("⑨ index.html 声明了 8 位版本号", /^\d{8}$/.test(String(metaVer)));
check("⑨ 全部 ?v= 引用与 meta 同值", [...html.matchAll(/\?v=(\d+)/g)].every(m => m[1] === metaVer));
check("⑨ js/core.js 的 Assets.buildVersion 与 meta 同值",
  new RegExp('buildVersion = "' + metaVer + '"').test(read("js/core.js")));

/* ---------------- 汇总 ---------------- */
console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
