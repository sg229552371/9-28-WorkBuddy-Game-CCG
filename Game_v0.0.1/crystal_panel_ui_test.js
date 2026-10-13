/* ============================================================================
 * crystal_panel_ui_test.js —— 阶段 F「技能面板」界面回归（node crystal_panel_ui_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖（施工依据 = G_docs/skill_ui_spec_v0.1.md §2/§3/§5/§7 + design_crystal_skill_system_v0.5 §11）：
 *   ① 全量脚本按 index.html 顺序可无异常装载 + 技能面板 DOM 静态清单
 *   ② CSS 含 `.crystal-panel` / `.crystal-panel-slot` 选择器（断言前剥注释）
 *   ③ 通电英雄：`showSkillPanel()` 打开后渲染出两技能 / 4 槽 / 矩阵行数 = 技能数
 *   ④ 点槽 → 详情正文来自 `SkillPresenter.detail().text`（含「共享水晶槽」「两技能收益」）
 *   ⑤ 英雄切换 tab 数量 = 队伍成员数
 *   ⑥ 授予稀有技能后 → 技能区为 2 行、矩阵 2 行（两技能联动）
 *   ⑦ 汇总标签 / 诊断来自 `panel.notices[]`（不硬编码中文判定）
 *   ⑧ 未通电英雄：不抛异常 + 给出降级文案
 *   ⑨ 关面板幂等 + 入口按钮 toggle 语义
 *   ⑩ 品质双通道：已填充槽同时给出星标 / 品质名（不只靠颜色）
 *
 * ⚠️ PASS 文案禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ⚠️ 断言渲染勿用带反斜杠的正则（driver 是模板字符串会被吃字符）。
 * ========================================================================== */
"use strict";

/* ---------------- DOM 桩（与 crystal_ui_test.js 同款，本地重建一份，不 import） ---------------- */
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
const ROOT = __dirname;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------------- ① 全量脚本按 index.html 顺序装载（与浏览器同序） ---------------- */
const html = read("index.html");
const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
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

/* ---------------- ① 静态：技能面板 DOM 清单齐备 ---------------- */
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
check("① index.html 含 #skill-panel-overlay（面板遮罩）", htmlIds.has("skill-panel-overlay"));
check("① index.html 含 #btn-skill-panel（局内 HUD 入口）", htmlIds.has("btn-skill-panel"));
check("① index.html 含 #btn-skill-panel-close（关闭按钮）", htmlIds.has("btn-skill-panel-close"));
check("① index.html 含面板四区 + 标题 + tab 宿主",
  htmlIds.has("crystal-panel-title") && htmlIds.has("crystal-panel-tabs") &&
  htmlIds.has("crystal-panel-skills") && htmlIds.has("crystal-panel-slots") &&
  htmlIds.has("crystal-panel-matrix") && htmlIds.has("crystal-panel-detail") &&
  htmlIds.has("crystal-panel-notices"));
check("① 入口按钮不落在右下 #hud-br（避开移动端虚拟按钮）",
  html.indexOf('id="btn-skill-panel"') > 0 &&
  html.indexOf('id="btn-skill-panel"') < html.indexOf('id="hud-br"'));

/* ---------------- ② 样式：新前缀选择器存在（先剥注释，防注释误判） ---------------- */
const css = read("css/style.css");
const cssNoCmt = css.replace(/\/\*[\s\S]*?\*\//g, "");
check("② CSS 含 .crystal-panel 选择器（剥注释后）", cssNoCmt.indexOf(".crystal-panel {") >= 0);
check("② CSS 含 .crystal-panel-slot 选择器（剥注释后）", cssNoCmt.indexOf(".crystal-panel-slot") >= 0);
check("② CSS 未复用旧 .mod-slot（新前缀独立）", cssNoCmt.indexOf(".mod-slot") < 0);

/* ---------------- ③ 通电：打开面板 → 技能 / 槽 / 矩阵 ---------------- */
ev('Game.bindEvents(); UI.selectedLevel = CFG.levels[0]; Game.startRun([CFG.heroes[0]]); Game.skipIntroFreeze();');
ev('SkillPlaytest.install("?skill=1"); UI._crystalCache = {};');
const openOk = ev('UI.showSkillPanel(G.player.id)');
check("③ showSkillPanel 返回已打开", openOk === true);
check("③ 面板遮罩去除 hidden", ev('document.getElementById("skill-panel-overlay").classList.contains("hidden")') === false);
check("③ skillPanelOpen 置位", ev("UI.skillPanelOpen") === true);

const sk0 = ev('(function(){ var cm = UI._crystalModeOf({ id: G.player.id, rt: G.player });' +
  ' return { panel: cm ? cm.skills.length : -1,' +
  '  rows: document.getElementById("crystal-panel-skills").querySelectorAll(".crystal-skill-row").length }; })()');
check("③ 技能区行数 = SkillPresenter 技能数（" + sk0.panel + "）", sk0.panel >= 1 && sk0.rows === sk0.panel);
check("③ 4 个水晶槽占位渲染",
  ev('document.getElementById("crystal-panel-slots").querySelectorAll(".crystal-panel-slot").length') === 4);
const mx0 = ev('(function(){ var cm = UI._crystalModeOf({ id: G.player.id, rt: G.player });' +
  ' return { p: cm.panel.matrix.length,' +
  '  rows: document.getElementById("crystal-panel-matrix").querySelectorAll(".crystal-matrix-row").length }; })()');
check("③ 矩阵行数 = 技能数（" + mx0.p + "）", mx0.p >= 1 && mx0.rows === mx0.p);

/* ---------------- ④ 点槽 → 详情来自 SkillPresenter.detail ---------------- */
const dRes = ev('(function(){ var cell = document.getElementById("crystal-panel-slots").querySelectorAll(".crystal-panel-slot")[0];' +
  ' if (!cell || typeof cell.onclick !== "function") return { ok: false };' +
  ' cell.onclick();' +
  ' var box = document.getElementById("crystal-panel-detail");' +
  ' return { ok: true, html: box.innerHTML, crystal: box.dataset.crystal || "" }; })()');
check("④ 点已填充槽 → 详情区已填充", dRes.ok === true && dRes.html.length > 0);
check("④ 详情含装配规则「共享水晶槽」（来自 detail 文案）", dRes.html.indexOf("共享水晶槽") >= 0);
check("④ 详情含「两技能收益」分节（来自 detail 文案）", dRes.html.indexOf("两技能收益") >= 0);
check("④ 详情落痕 dataset.crystal = 该槽水晶 id", String(dRes.crystal).indexOf("CR_") === 0);

/* ---------------- ⑤ 英雄切换 tab = 队伍成员数 ---------------- */
const tabRes = ev('(function(){' +
  ' var n = document.getElementById("crystal-panel-tabs").querySelectorAll(".crystal-panel-tab").length;' +
  ' return { tabs: n, members: UI._skillPanelMembers().length }; })()');
check("⑤ 英雄 tab 数 = 队伍成员数（" + tabRes.members + "）", tabRes.tabs === tabRes.members && tabRes.members >= 1);

/* ---------------- ⑩ 品质双通道：颜色 + 星标/品质名 ----------------
 * ⚠️ DOM 桩的 innerHTML 解析只保留 class，**不保留子节点文本** → 断言走容器原文（innerHTML 字符串）。 */
const qRes = ev('(function(){ var p = SkillPresenter.panel(G.player.skillState, G.player.id);' +
  ' var s = p.slots[0]; var qn = (s.quality && s.quality.name) || "";' +
  ' var qid = (s.quality && s.quality.id) || "";' +
  ' var rank = 0; var qs = CFG.skillSystem.qualityDefs || [];' +
  ' for (var i = 0; i < qs.length; i++) if (qs[i].id === qid) rank = qs[i].rank || 0;' +
  ' var stars = new Array(rank + 1).join("★");' +
  ' var expect = stars + (qn ? " " + qn : "");' +
  ' var html2 = document.getElementById("crystal-panel-slots").innerHTML;' +
  ' return { expect: expect, rank: rank, qn: qn, name: s.name,' +
  '  found: html2.indexOf(expect) >= 0, nameFound: html2.indexOf(s.name) >= 0 }; })()');
check("⑩ 已填充槽非仅靠颜色：星标数量 = 品质 rank（" + qRes.rank + "）+ 品质名",
  qRes.rank >= 1 && qRes.qn.length > 0 && qRes.found === true);
check("⑩ 槽位同时显示水晶名（" + qRes.name + "，颜色之外的文本通道）", qRes.nameFound === true);

/* ---------------- ⑥ 授予稀有技能 → 两技能联动 ---------------- */
ev('(function(){ var w = { player: G.player, companions: [] };' +
  ' SkillPlaytest.grantRareSkillOnAltar(w, { cfg: { name: "女神雕像", effects: [ { type: "heal", pct: 0.25 } ] } }); })()');
ev('(function(){ var c = document.getElementById("choice-cards").children[0]; if (c && typeof c.onclick === "function") c.onclick(); })()');
ev('UI.closeChoice(); UI._crystalCache = {}; UI.showSkillPanel(G.player.id);');
const two = ev('(function(){ var cm = UI._crystalModeOf({ id: G.player.id, rt: G.player });' +
  ' return { p: cm.skills.length,' +
  '  skills: document.getElementById("crystal-panel-skills").querySelectorAll(".crystal-skill-row").length,' +
  '  rows: document.getElementById("crystal-panel-matrix").querySelectorAll(".crystal-matrix-row").length }; })()');
check("⑥ 授予稀有技能后技能数 = 2", two.p === 2);
check("⑥ 面板渲染出两技能", two.skills === 2);
check("⑥ 矩阵行数 = 技能数（2）", two.rows === 2);

/* ---------------- ⑦ 汇总标签 / 诊断来自 panel.notices[] ---------------- */
const ntRes = ev('(function(){ try { UI.closeSkillPanel(); } catch (e) {}' +
  ' var t = CFG.skillSystem; var cd = t.crystalDefs.CR_ARCANE_AMP;' +
  ' cd.presentation = cd.presentation || {};' +
  ' cd.presentation.summaryTagKey = "test.panel.tag";' +
  ' t.localization = t.localization || {};' +
  ' t.localization["test.panel.tag"] = "测试汇总标签";' +
  ' G.player.skillState.groupVersion = (G.player.skillState.groupVersion || 1) + 1;' +
  ' UI._crystalCache = {};' +
  ' var p = SkillPresenter.panel(G.player.skillState, G.player.id);' +
  ' var texts = p.notices.map(function(n){ return n.text; });' +
  ' UI.showSkillPanel(G.player.id);' +
  ' var html2 = document.getElementById("crystal-panel-notices").innerHTML;' +
  ' var miss = texts.filter(function(x){ return x && html2.indexOf(x) < 0; });' +
  ' return { texts: texts, miss: miss.length, html: html2 }; })()');
check("⑦ 汇总标签非空（注入 summaryTagKey 后）", ntRes.texts.length >= 1);
check("⑦ 面板 notices 文案与 panel.notices[] 逐条一致（不硬编码判定）", ntRes.miss === 0);
check("⑦ 注入的汇总标签已渲染", ntRes.html.indexOf("测试汇总标签") >= 0);
/* 还原注入（内存内，隔离后续断言） */
ev('(function(){ var cd = CFG.skillSystem.crystalDefs.CR_ARCANE_AMP;' +
  ' if (cd.presentation) delete cd.presentation.summaryTagKey; UI._crystalCache = {}; })()');

/* ---------------- ⑧ 未通电英雄：不抛异常 + 降级文案 ---------------- */
const deg = ev('(function(){ var saved = CFG.skillSystem.migratedHeroIds;' +
  ' CFG.skillSystem.migratedHeroIds = []; UI._crystalCache = {};' +
  ' var ok = true, threw = false;' +
  ' try { UI.showSkillPanel(); } catch (e) { threw = true; ok = false; }' +
  ' var html2 = document.getElementById("crystal-panel-skills").innerHTML +' +
  '   document.getElementById("crystal-panel-matrix").innerHTML +' +
  '   document.getElementById("crystal-panel-detail").innerHTML;' +
  ' var slots = document.getElementById("crystal-panel-slots").querySelectorAll(".crystal-panel-slot").length;' +
  ' CFG.skillSystem.migratedHeroIds = saved; UI._crystalCache = {};' +
  ' return { threw: threw, ok: ok, html: html2, slots: slots }; })()');
check("⑧ 未通电英雄：showSkillPanel 不抛异常", deg.threw === false && deg.ok === true);
check("⑧ 未通电英雄：给出降级文案（未启用能量水晶）", deg.html.indexOf("未启用能量水晶") >= 0);
check("⑧ 未通电英雄：仍渲染 4 个空槽占位（面板不残缺）", deg.slots === 4);

/* ---------------- ⑨ 关面板幂等 + 入口按钮 toggle ---------------- */
ev('UI.showSkillPanel(G.player.id);');
check("⑨ 重新打开后面板可见", ev('document.getElementById("skill-panel-overlay").classList.contains("hidden")') === false);
const closeOk = ev('(function(){ UI.closeSkillPanel(); return true; })()');
check("⑨ closeSkillPanel 返回成功", closeOk === true);
check("⑨ 关闭后遮罩重新 hidden", ev('document.getElementById("skill-panel-overlay").classList.contains("hidden")') === true);
check("⑨ 关闭后 skillPanelOpen = false", ev("UI.skillPanelOpen") === false);
check("⑨ closeSkillPanel 幂等可重复调用", ev('UI.closeSkillPanel(); UI.closeSkillPanel(); UI.skillPanelOpen === false') === true);
const tog = ev('(function(){ UI._skillPanelBtnBound = false; UI._bindSkillPanelBtn();' +
  ' var btn = document.getElementById("btn-skill-panel");' +
  ' if (typeof btn.onclick !== "function") return { bound: false };' +
  ' btn.onclick(); var a = UI.skillPanelOpen;' +
  ' btn.onclick(); var b = UI.skillPanelOpen;' +
  ' return { bound: true, a: a, b: b }; })()');
check("⑨ #btn-skill-panel 已绑定点击", tog.bound === true);
check("⑨ 点击入口 toggle：开 → 关", tog.a === true && tog.b === false);
ev("UI.closeSkillPanel();");

/* ---------------- 汇总 ---------------- */
console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
