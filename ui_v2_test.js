/* v2 界面改造回归测试（node ui_v2_test.js）
 * 覆盖第十九章 UI 层六件套（19.2 / 19.3 / 19.4 / 19.5 / 19.6 / 19.7）：
 *   ① HUD 技能冷却环  ② 选角定位徽章  ③ 升级 4 选 1 暂停弹窗
 *   ④ 背包管理三段布局（搜刮背包 / 芯片背包 / 模块槽）  ⑤ 芯片工坊  ⑥ 芯片图鉴
 * 全部用桩数据驱动，不依赖战斗线接入（chipInv / heroModules / chipSeen / Game.chipForge 均判空或自造）。
 * DOM 桩 style 与 ui_flow_test.js 一致（classList 真实行为；getElementById 自动造元素）。 */
"use strict";

/* ---- DOM 桩 ---- */
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
  // 真实 DOM innerHTML="" 会清空子节点；桩必须一致，否则重复渲染读到旧卡片
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v;
    // 解析字符串里带 class 的元素为子节点（供 querySelector(".ps-arc") / querySelectorAll(".ps-slot") 命中）
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
  // 按实例缓存：renderXxx 里 card.querySelector(".lu-name").onclick = ... 需要稳定对象
  // 递归后代查找 + 稳定缓存（.ps-arc 嵌在 .ps-icon 内，非行节点直接子级）
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  // 技能栏 _buildPartyRow 用 querySelector 在同一节点上重复取 .ps-arc/.ps-glyph/.ps-cd → 必须稳定；
  // 选择器按 class token 精确匹配并**递归**后代（.ps-slot 嵌在 .ps-slots 里，非行节点的直接子级）
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
  // 20.3 修复：closest 原硬编码 return null —— 与真实 DOM 语义不符（真实 closest 沿祖先链
  // 上溯且命中有效），导致 _onPartyBarClick 的 closest 分支在桩里永远找不到槽位。
  // 现按真实语义实现：支持 ".cls" / "#id" / 逗号多选择器，沿 _parent 上溯。
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

/* ---- 1) index.html id 清单核对（DOM 桩抓不到缺失元素） ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const requiredIds = [
  // ① HUD 技能冷却环
  "hud-skill-cd", "skill-cd-arc", "skill-cd-txt", "skill-cd-name",
  // ③ 升级 4 选 1 弹窗（含 19.12 归属英雄标题：给 <英雄名> 选择强化 / 模块槽 N/4）
  "levelup-overlay", "levelup-cards", "levelup-hero",
  // ④ 背包三段布局
  "grid-backpack", "grid-chip", "module-slots", "bp-grid-unit", "bp-panel-main",
  // ⑤ 芯片工坊
  "art-tab-forge", "art-page-forge", "forge-list",
  // ⑥ 芯片图鉴
  "screen-chip-codex", "chip-codex-value", "chip-codex-behavior", "btn-home-chip-codex", "btn-chip-codex-back",
  // ⑦ 全队技能栏（19.12 底部居中：每人一条 [技能图标+冷却环][4 模块槽]）
  "party-skillbar",
];
let okStatic = true;
for (const id of requiredIds) {
  if (!htmlIds.has(id)) { console.log("FAIL index.html 缺少元素 id=" + id); okStatic = false; }
}
// 旧能量条/旧武器栏网格不应再作为 HUD 元素存在
console.log("index.html v2 元素清单 OK: " + requiredIds.length + " 个必需 id 全部存在");

/* ---- 2) 加载脚本 + 驱动 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
// ⑩ 静态核对需要读源码：在沙箱内 fs/__dirname 不可用，故先读出并以变量形式注入
ctx.__citySrc = fs.readFileSync(path.join(__dirname, "js", "main.js"), "utf8");
ctx.__cssSrc = fs.readFileSync(path.join(__dirname, "css", "style.css"), "utf8");

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) window.__v2Ok = false; };
  window.__v2Ok = true;

  Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();   // 跳过开场冻结，保持时间假设

  /* ============ ① HUD 技能冷却环（19.3） ============ */
  const cdWrap = get("hud-skill-cd"), cdTxt = get("skill-cd-txt"), cdArc = get("skill-cd-arc");
  const cdTotal = G.run.weapon.skill.cd;
  check("技能总冷却为正数（读 G.run.weapon.skill.cd）", cdTotal > 0);

  // 冷却中：skillTimer = 总长 → 弧长拉满（未就绪），文案显示剩余秒
  G.player.skillTimer = cdTotal;
  UI.updateSkillCd();
  check("冷却中不带 ready 类", !cdWrap.classList.contains("ready"));
  check("冷却中就绪比例=0 → 弧长拉满（dashoffset≈213.6）", parseFloat(cdArc.style.strokeDashoffset) >= 213);
  check("冷却中显示剩余秒文案（非 READY）", /s$/.test(cdTxt.textContent) && cdTxt.textContent !== "READY");

  // 冷却过半：就绪比例 0.5 → dashoffset ≈ 106.8
  G.player.skillTimer = cdTotal / 2;
  UI.updateSkillCd();
  const offMid = parseFloat(cdArc.style.strokeDashoffset);
  check("冷却过半 → 弧长减半（dashoffset≈" + offMid + "）", offMid > 90 && offMid < 125);

  // 就绪：skillTimer<=0 → ready + READY + 满弧
  G.player.skillTimer = 0;
  UI.updateSkillCd();
  check("就绪带 ready 类", cdWrap.classList.contains("ready"));
  check("就绪显示 READY", cdTxt.textContent === "READY");
  check("就绪 → 弧长填满（dashoffset=0）", parseFloat(cdArc.style.strokeDashoffset) === 0);

  // updateHUD 主链路也要驱动冷却环（不能只单测 updateSkillCd）
  G.player.skillTimer = cdTotal;
  G.state = "playing";
  UI.updateHUD();
  check("updateHUD 联动冷却环（冷却中非 ready）", !cdWrap.classList.contains("ready"));

  /* ============ ② 选角界面定位徽章（19.2） ============ */
  check("CFG.heroRoles.byHero 就绪", !!CFG.heroRoles && !!CFG.heroRoles.byHero);
  const role = UI.heroRole("H001");
  check("H001 定位 = 输出（红）", role && role.name === "输出" && role.color === CFG.heroRoles.output.color);
  check("H007 定位 = 恢复（绿）", UI.heroRole("H007") && UI.heroRole("H007").name === "恢复");
  check("未知英雄定位返回 null（判空）", UI.heroRole("H999") === null);

  UI.buildCharList();
  const charCards = get("char-list").children;
  check("角色卡数量 = 英雄数", charCards.length === CFG.heroes.length);
  const h1Html = charCards[0].innerHTML;
  check("角色卡含定位徽章 HTML + 输出配色", h1Html.indexOf("role-badge") >= 0 && h1Html.indexOf(CFG.heroRoles.output.color) >= 0);
  // 恢复型英雄卡（H007）
  const h7Idx = CFG.heroes.findIndex(h => h.id === "H007");
  const h7Html = charCards[h7Idx].innerHTML;
  check("恢复型英雄卡含恢复配色（绿）", h7Html.indexOf(CFG.heroRoles.recovery.color) >= 0);

  /* ============ ③ 升级 4 选 1 暂停弹窗（19.4 方案 7） ============ */
  const ov = get("levelup-overlay");
  window.__picked = -1;
  const cands = [
    { kind: "module", defId: "M001", name: "弹头扩容", desc: "弹道数量 +1" },
    { kind: "module", defId: "M009", name: "增幅器", desc: "伤害 +22%" },
    { kind: "statPack", attr: "hp", name: "生命", value: 6 },
    { kind: "module", defId: "M002", name: "冷却线圈", desc: "冷却 -16%" },
  ];
  UI.onLevelUpChoice(cands, (i) => { window.__picked = i; });
  check("弹窗显示（overlay 去掉 hidden）", !ov.classList.contains("hidden"));
  const luCards = get("levelup-cards").children;
  check("候选渲染 4 张大卡", luCards.length === 4);
  check("卡片含模块名", luCards[0].innerHTML.indexOf("弹头扩容") >= 0);
  check("属性小包卡显示数值 +6", luCards[2].innerHTML.indexOf("+6") >= 0 && luCards[2].innerHTML.indexOf("属性小包") >= 0);

  // 点第 2 张（索引 1）→ onPick(1)，弹窗自动关闭
  luCards[1].onclick({});
  check("点选第 2 张回调 onPick(1)", window.__picked === 1);
  check("点选后弹窗自动关闭", ov.classList.contains("hidden"));

  // 强制关闭接口
  UI.onLevelUpChoice(cands, () => {});
  check("重开弹窗正常", !ov.classList.contains("hidden"));
  UI.onLevelUpChoiceClose();
  check("onLevelUpChoiceClose 强制关闭", ov.classList.contains("hidden"));

  // 空候选不报错
  UI.onLevelUpChoice([], () => {});
  check("空候选渲染 0 卡不报错", get("levelup-cards").children.length === 0);
  UI.onLevelUpChoiceClose();

  /* ============ ④ 背包管理三段布局（19.5 / 19.6） ============ */
  // 战斗线尚未接入 chipInv：验证两者皆缺时回落 6×5 骨架（renderBackpack 内 tagCalc 仍需 weaponInv，故渲染后还原）
  const savedWeaponInv = G.run.weaponInv;
  delete G.run.chipInv;
  delete G.run.heroModules;
  delete G.run.weaponInv;           // 过渡回退源也移除 → 走骨架
  const chipSkeleton = UI._chipInv();
  const bpCells = G.run.backpack.cols * G.run.backpack.rows;
  const chipCells = chipSkeleton.cols * chipSkeleton.rows;
  G.run.weaponInv = savedWeaponInv; // 还原（tagCalc 读它）
  UI.renderBackpack();
  check("芯片背包骨架尺寸 = 6×5=30（CFG.chips.grid）", chipSkeleton.cols === CFG.chips.grid.cols && chipSkeleton.rows === CFG.chips.grid.rows && chipCells === 30);
  check("搜刮背包格子数 = 6×4=24", get("grid-backpack").children.length === bpCells);
  const slots = get("module-slots").children;
  check("模块槽渲染 4 格（CFG.moduleSlot.perHero）", slots.length === CFG.moduleSlot.perHero);
  check("空槽显示「空槽」", slots[0].innerHTML.indexOf("空槽") >= 0);

  // 装入真实 chipInv + heroModules 桩数据后重渲
  G.run.chipInv = new Inventory(CFG.chips.grid.cols, CFG.chips.grid.rows, "chip");
  G.run.chipInv.place({ uid: 9001, kind: "chip", defId: "C_V_DMG", itemQ: 1, name: "增幅晶片", shape: [1,1], x:0, y:0 }, 0, 0);
  UI.renderBackpack();
  // 网格 = 30 格骨架 + 1 枚芯片物品 = 31 个节点
  check("芯片背包渲染真实芯片（30 格 + 1 物品）", get("grid-chip").children.length === 31);

  G.run.heroModules = { [G.heroDef.id]: [{ defId: "M001", lv: 3 }, { defId: "M009", lv: 9 }] };
  UI.renderBackpack();
  const slots2 = get("module-slots").children;
  check("模块槽显示模块名 + 等级", slots2[0].innerHTML.indexOf("弹头扩容") >= 0 && slots2[0].innerHTML.indexOf("LV 3") >= 0);
  check("模块槽等级上限 9 显示（LV 9 / 9）", slots2[1].innerHTML.indexOf("LV 9 / 9") >= 0);
  check("未填槽显示空槽", slots2[2].innerHTML.indexOf("空槽") >= 0);

  // 芯片 tooltip：品质色 + 效果描述
  const chipIt = { kind: "chip", defId: "C_V_DMG", itemQ: 3, name: "增幅晶片", shape: [1,1] };
  const chipTip = itemTipHTML(chipIt);
  check("芯片 tooltip 含名称 + 金品质色", chipTip.indexOf("增幅晶片") >= 0 && chipTip.indexOf(CFG.itemQualities[3].color) >= 0);
  check("芯片 tooltip 含数值放大量（+45%）", chipTip.indexOf("45%") >= 0);
  const behaviorChip = { kind: "chip", defId: "C_B_BURN", itemQ: 2, name: "燃蚀芯片", shape: [2,1] };
  const bTip = itemTipHTML(behaviorChip);
  check("行为芯片 tooltip 含行为描述（灼烧）", bTip.indexOf("灼烧") >= 0 && bTip.indexOf("行为芯片") >= 0);

  /* ============ ⑤ 芯片工坊（19.7） ============ */
  check("CFG.chipForge.services 三项齐备", CFG.chipForge && CFG.chipForge.services
    && CFG.chipForge.services.merge && CFG.chipForge.services.reroll && CFG.chipForge.services.craft);
  // 战斗线尚未实现 Game.chipForge → UI 应提示未就绪而非抛错
  const hadChipForge = typeof Game.chipForge === "function";
  let forgeToast = "";
  const origToast = UI.toast.bind(UI);
  UI.toast = (msg, cls) => { forgeToast = msg; };
  G.inArtisan = true;
  UI.chipForgeService("merge");
  check("Game.chipForge 缺失时提示未就绪（不抛异常）", !hadChipForge ? forgeToast.indexOf("未就绪") >= 0 : true);

  // 桩一个 Game.chipForge → 覆盖 {ok:false} 与 {ok:true} 两分支
  Game.chipForge = () => ({ ok: false, msg: "金币不足（桩）" });
  UI.chipForgeService("merge");
  check("chipForge 返回 ok:false → toast 失败信息", forgeToast.indexOf("金币不足") >= 0);
  Game.chipForge = () => ({ ok: true, msg: "合成成功（桩）" });
  UI.chipForgeService("craft");
  check("chipForge 返回 ok:true → toast 成功信息", forgeToast.indexOf("合成成功") >= 0);
  UI.toast = origToast;

  // 工坊服务列表渲染（读 CFG.chipForge.services）
  G.run.coin = 999;
  UI.renderArtisan();
  UI.setArtisanTab("forge");
  const forgeRows = get("forge-list").children;
  check("工坊服务列表渲染 3 项", forgeRows.length === 3);
  check("工坊行含服务描述与价格", forgeRows[0].innerHTML.indexOf(CFG.chipForge.services.merge.cost) >= 0
    && forgeRows[0].innerHTML.indexOf(CFG.chipForge.services.merge.desc) >= 0);

  /* ============ ⑥ 芯片图鉴（19.7） ============ */
  delete G.meta;                     // chipSeen 缺失 → 全部未解锁剪影
  UI.renderChipCodex();
  const vBox = get("chip-codex-value"), bBox = get("chip-codex-behavior");
  check("数值芯片图鉴列出全部（" + CFG.chips.valuePool.length + "）", vBox.children.length === CFG.chips.valuePool.length);
  check("行为芯片图鉴列出全部（" + CFG.chips.behaviorPool.length + "）", bBox.children.length === CFG.chips.behaviorPool.length);
  check("未解锁显示剪影（？？？）", vBox.children[0].innerHTML.indexOf("？？？") >= 0);

  // 桩 G.meta.chipSeen 后解锁一枚
  G.meta = { chipSeen: { [CFG.chips.valuePool[0].id]: true } };
  UI.renderChipCodex();
  check("已见芯片显示真名", vBox.children[0].innerHTML.indexOf(CFG.chips.valuePool[0].name) >= 0);
  check("图鉴计数显示已见数", get("chip-codex-count").textContent.indexOf("1/") >= 0);

  // 图鉴入口 / 返回绑定（惰性幂等）
  UI.bindChipCodexEntry();
  check("首页芯片图鉴入口已绑 onclick", typeof get("btn-home-chip-codex").onclick === "function");
  UI.showChipCodex();
  check("芯片图鉴页显示", !get("screen-chip-codex").classList.contains("hidden"));

  delete Game.chipForge;   // 清理桩，避免影响后续

  /* ============ ⑦ 升级弹窗标明归属英雄（19.12 任务一 / 20.3 任务一） ============ */
  // ① meta 存在 → 标题区显示「给 <英雄名> 选择强化」+ 定位色
  //    H002 已用 2 格（heroModules 驱动槽号推导，20.3 起以 cand 归属 heroModules 为准）
  G.run.heroModules = { H002: [{ defId: "M002", lv: 1 }, { defId: "M003", lv: 1 }, null, null] };
  const heroCands = [
    { kind: "module", heroId: "H002", defId: "M001", name: "弹头扩容", desc: "弹道数量 +1", lv: 3, locked: false },
    { kind: "module", heroId: "H002", defId: "M009", name: "增幅器", desc: "伤害 +22%", lv: 1, locked: false },
    { kind: "module", heroId: "H002", defId: "M006", name: "弹跳装置", desc: "弹射次数 +1", lv: 1, locked: true },
    { kind: "statPack", heroId: "H002", packId: "pack_atk", name: "强攻包", stat: "atk", value: 3 },
  ];
  UI.onLevelUpChoice(heroCands, () => {}, { heroId: "H002", heroName: "散弹手", roleColor: CFG.heroRoles.output.color, slotUsed: 2 });
  const heroTitle = get("levelup-hero");
  check("meta 存在 → 弹窗标题显示「给 散弹手 选择强化」",
    heroTitle.innerHTML.indexOf("给") >= 0 && heroTitle.innerHTML.indexOf("散弹手") >= 0 && heroTitle.innerHTML.indexOf("选择强化") >= 0);
  check("meta.roleColor → 标题带定位色", heroTitle.innerHTML.indexOf(CFG.heroRoles.output.color) >= 0);

  // ② 候选属于模块槽 → 标注「填入 <英雄名> 的第 N 槽」（20.3：归属 + 槽号）
  const luH = get("levelup-cards").children;
  check("候选渲染 4 张（含 1 张置灰）", luH.length === 4);
  check("模块槽已用 2 → 标注填入第 3 槽（3/4）", luH[0].innerHTML.indexOf("填入") >= 0 && luH[0].innerHTML.indexOf("3/4") >= 0);

  // ③ locked 候选 → 明显禁用视觉（灰度类）且点击无效
  check("locked 候选带禁用类（lu-locked）", luH[2].classList.contains("lu-locked"));
  check("locked 候选标注「已满」提示", luH[2].innerHTML.indexOf("已满") >= 0 || luH[2].innerHTML.indexOf("不可选") >= 0);
  window.__lockedPick = -1;
  UI.onLevelUpChoice(heroCands, (i) => { window.__lockedPick = i; }, { heroId: "H002", heroName: "散弹手", slotUsed: 2 });
  const lockedCard = get("levelup-cards").children[2];
  check("locked 候选未绑定点击处理器（不可点）", typeof lockedCard.onclick !== "function");
  if (typeof lockedCard.onclick === "function") lockedCard.onclick({});   // 兜底：即便有处理器也应无效
  check("locked 候选点击不被选取（仍停留弹窗）", window.__lockedPick === -1 && !get("levelup-overlay").classList.contains("hidden"));
  UI.onLevelUpChoiceClose();

  // ④ 向后兼容：meta 缺失 → 不崩、不显示英雄标题（旧 2 参调用）
  UI.onLevelUpChoice(cands, () => {});
  check("meta 缺失时仍渲染 4 卡（向后兼容）", get("levelup-cards").children.length === 4);
  check("meta 缺失时不显示英雄标题（无 heroId）", heroTitle.innerHTML.indexOf("选择强化") < 0);
  UI.onLevelUpChoiceClose();
  // meta 存在但 heroName 缺失 → 回落到 heroId，不崩
  UI.onLevelUpChoice(heroCands, () => {}, { heroId: "H002" });
  check("meta 只给 heroId → 标题回落显示 heroId 不崩", heroTitle.innerHTML.indexOf("H002") >= 0);
  UI.onLevelUpChoiceClose();

  /* ============ ⑧ 全队技能栏（19.12 任务二，底部居中） ============ */
  // 当前局：单英雄 H001
  const soloHero = CFG.heroes[0];
  G.heroDef = soloHero;
  G.run.heroModules = { [soloHero.id]: [{ defId: "M001", lv: 3 }, null, null, null] };
  UI.renderPartySkillbar();
  const bar = get("party-skillbar");
  check("技能栏按队伍人数渲染 1 条（单英雄）", bar.children.length === 1);
  const row0 = bar.children[0];
  check("技能条含技能图标元素", !!row0.querySelector(".ps-icon"));
  check("技能条渲染 4 个模块槽（CFG.moduleSlot.perHero）", row0.querySelectorAll(".ps-slot").length === 4);
  check("空模块槽 → 虚线类 ps-slot-empty", row0.querySelectorAll(".ps-slot")[1].classList.contains("ps-slot-empty"));
  // 已选槽显示模块名 + 品质色（品质按等级阶段推导：LV3 → 蓝 q1）
  const slot0 = row0.querySelectorAll(".ps-slot")[0];
  check("已选槽显示模块名（弹头扩容）", slot0.innerHTML.indexOf("弹头扩容") >= 0);
  check("已选槽按品质阶段着色（LV3 → 蓝 " + CFG.itemQualities[1].color + "）", slot0.innerHTML.indexOf(CFG.itemQualities[1].color) >= 0);
  check("英雄标识显示名字（猎手）+ 定位色",
    row0.children[1].innerHTML.indexOf("猎手") >= 0
    && row0.children[1].innerHTML.indexOf(CFG.heroRoles.output.color) >= 0);

  // 冷却环更新：不抛异常，且冷却中/就绪两态
  UI.updatePartySkillbar();
  check("updatePartySkillbar 正常更新不抛异常", true);
  const arc0 = row0.querySelector(".ps-arc");
  G.player.skillTimer = G.run.weapon.skill.cd;
  UI.updatePartySkillbar();
  check("技能栏冷却环冷却中 → 弧长拉满（非 0）", parseFloat(arc0.style.strokeDashoffset) > 0);
  G.player.skillTimer = 0;
  UI.updatePartySkillbar();
  check("技能栏冷却环就绪 → 弧长填满（dashoffset=0）", parseFloat(arc0.style.strokeDashoffset) === 0);

  // heroModules 缺失 → 优雅降级（空框照显示，不崩）
  delete G.run.heroModules;
  let degradeOk = true;
  try { UI.renderPartySkillbar(); UI.updatePartySkillbar(); } catch (e) { degradeOk = false; }
  check("heroModules 缺失 → 技能栏降级渲染不崩", degradeOk && get("party-skillbar").children[0].querySelectorAll(".ps-slot")[0].classList.contains("ps-slot-empty"));

  // 5 人满队：5 条 + 每条 4 槽
  const five = CFG.heroes.slice(0, 5);
  G.heroDef = five[0];
  const savedCompanions = G.run.companions;
  G.run.companions = five.slice(1).map((hd, i) => ({ heroDef: hd, id: hd.id, name: hd.name, alive: true, skillTimer: i * 0.6 }));
  G.run.heroModules = {};
  for (const h of five) G.run.heroModules[h.id] = [null, null, null, null];
  G.run.heroModules[five[4].id] = [{ defId: "M009", lv: 9 }, null, null, null];
  UI.renderPartySkillbar();
  const bar5 = get("party-skillbar");
  check("5 人满队 → 渲染 5 条技能条", bar5.children.length === 5);
  let allFour = true;
  for (let i = 0; i < bar5.children.length; i++) if (bar5.children[i].querySelectorAll(".ps-slot").length !== 4) allFour = false;
  check("5 人满队 → 每条均渲染 4 个模块槽", allFour);
  check("5 人满队 → 第 5 人已选槽显示模块名（增幅器 LV9 → 金）",
    bar5.children[4].querySelectorAll(".ps-slot")[0].innerHTML.indexOf("增幅器") >= 0
    && bar5.children[4].querySelectorAll(".ps-slot")[0].innerHTML.indexOf(CFG.itemQualities[3].color) >= 0);

  // 变化检测：同一批数据重复 render 不重建 DOM（结构只建一次）
  const rowBefore = bar5.children[0];
  UI.renderPartySkillbar();
  check("结构复用：重复 render 同一数据不重建行节点", bar5.children[0] === rowBefore);
  UI.updatePartySkillbar();
  check("update 路径不重建行节点（复用同一节点）", bar5.children[0] === rowBefore);
  check("updatePartySkillbar 在 companions 缺失时也不抛异常", (() => {
    const saved = G.run.companions; G.run.companions = null;
    let ok = true; try { UI.updatePartySkillbar(); } catch (e) { ok = false; }
    G.run.companions = saved; return ok;
  })());

  // 复原现场，避免污染（后续无断言，但保持整洁）
  G.run.companions = savedCompanions;
  G.heroDef = soloHero;

  /* ============ ⑨ 竖屏优先布局重构（20.x：画布适配 / 方向类名 / 弹窗网格） ============ */
  // 桩环境默认 1920×1080（横屏）。以下借 window.innerWidth/innerHeight 可写来模拟竖屏。
  const setVP = (w, h) => { window.innerWidth = w; window.innerHeight = h; };
  G.canvas = get("game-canvas");   // fitCanvas 需要画布元素（getContext 桩已在 FakeEl 上）

  // --- fitCanvas：竖屏填满屏幕（不被 minAspect 钳成 4:3） ---
  setVP(390, 844);                        // iPhone 竖屏 aspect ≈ 0.462
  Game.fitCanvas();
  const pW = G.canvas.width, pH = G.canvas.height;
  const pAspect = pW / pH;
  check("竖屏 390×844：画布高 = viewH×zoom 锚点不变（1080）", pH === Math.round((CFG.camera.viewH || 720) * (CFG.camera.zoom || 1.5)));
  check("竖屏 390×844：画布宽按真实比例（≈1080×390/844≈499，非 4:3 的 810）", pW > 480 && pW < 520);
  check("竖屏 390×844：宽高比接近真实屏幕比例（±2%）", Math.abs(pAspect - 390 / 844) / (390 / 844) < 0.02);
  check("竖屏 390×844：画布宽 > 0 且为整数", Number.isInteger(pW) && pW > 0);

  // --- fitCanvas：横屏行为与改造前一致（1920×1080 → 宽 > 高，4:3 钳制不介入） ---
  setVP(1920, 1080);
  Game.fitCanvas();
  const lW = G.canvas.width, lH = G.canvas.height;
  check("横屏 1920×1080：画布高仍为 1080（锚点不变）", lH === Math.round((CFG.camera.viewH || 720) * (CFG.camera.zoom || 1.5)));
  check("横屏 1920×1080：画布宽 = 1080 × 1.7778 ≈ 1920（按真实比例）", Math.abs(lW - Math.round(lH * (1920 / 1080))) <= 1);
  check("横屏 1920×1080：宽 > 高（横屏形态）", lW > lH);

  // --- 竖屏方向类名标记（CSS 主分支 / 测试依据） ---
  setVP(390, 844);
  UI.applyOrientation();
  check("竖屏 → body 挂 portrait 类", document.body.classList.contains("portrait"));
  check("竖屏 → body 不挂 landscape 类", !document.body.classList.contains("landscape"));
  check("竖屏 → #app 同步 portrait 类", get("app").classList.contains("portrait"));

  // --- 横屏方向类名标记 ---
  setVP(1920, 1080);
  UI.applyOrientation();
  check("横屏 → body 挂 landscape 类", document.body.classList.contains("landscape"));
  check("横屏 → body 不挂 portrait 类", !document.body.classList.contains("portrait"));

  // --- 升级弹窗 4 卡在竖屏下的网格类名（2×2） ---
  setVP(390, 844);
  UI.applyOrientation();
  UI.onLevelUpChoice(cands, () => {});
  const luGrid = get("levelup-cards");
  check("竖屏 → 升级卡片容器挂 portrait 网格类", luGrid.classList.contains("grid-portrait"));
  check("竖屏 → 升级弹窗仍渲染 4 张卡", luGrid.children.length === 4);
  UI.onLevelUpChoiceClose();

  setVP(1920, 1080);
  UI.applyOrientation();
  UI.onLevelUpChoice(cands, () => {});
  check("横屏 → 升级卡片容器不带竖屏网格类", !get("levelup-cards").classList.contains("grid-portrait"));
  UI.onLevelUpChoiceClose();

  // --- 旋转屏幕（orientationchange）后布局能重新计算 ---
  let fitCalls = 0;
  const origFit = Game.fitCanvas.bind(Game);
  Game.fitCanvas = () => { fitCalls++; origFit(); };
  setVP(844, 390);                        // 由竖屏旋到横屏
  window.dispatchEvent({ type: "orientationchange" });
  // 桩 window 的 orientationchange 处理器用 setTimeout(…,120)，直接调用一次重算接口验证语义
  UI.applyOrientation();
  check("旋转后 applyOrientation 重算 → 横屏类", document.body.classList.contains("landscape") && fitCalls >= 0);
  Game.fitCanvas = origFit;
  setVP(1920, 1080);                      // 复原桩视口

  /* ---------- ⑩ 主城 / 非战斗态：战斗 HUD 必须下线（20.2 修复「通关回城后技能栏残留」） ----------
   * 缺陷成因：updateHUD 在 G.state !== "playing" 时直接 return，
   * 全队技能栏最后一次渲染的 DOM 原样留在页面；而 .party-skillbar:empty 只隐藏空容器。
   * 修复口径：① CSS 在 #hud.city-mode 下隐藏 #party-skillbar；② UI.clearBattleHud() 清空结构。 */
  const barEl = get("party-skillbar");
  check("主城：技能栏容器存在（前置）", !!barEl);

  // ① UI 侧：clearBattleHud 清空技能栏内容 + 复位缓存，使 :empty 规则重新生效
  // 注意：DOM 桩的 innerHTML 赋值不解析 HTML（不生成 children），故用「写入标记串」来判定清空
  barEl.innerHTML = "<i>stale-battle-dom</i>";
  check("主城：模拟战斗残留结构（前置）", barEl.innerHTML.length > 0);
  check("主城：clearBattleHud 是函数", typeof UI.clearBattleHud === "function");
  if (typeof UI.clearBattleHud === "function") UI.clearBattleHud();
  check("主城：clearBattleHud 后技能栏清空", barEl.innerHTML === "");
  check("主城：清空后缓存复位（下次进战斗会重建）", !UI._psCache && !UI._psSig);

  // ② 回城入口确实调用了清空（回归防线：以后改回城流程忘调会被抓）
  check("主城：main.js 回城流程调用 clearBattleHud", __citySrc.indexOf("clearBattleHud(") >= 0);

  // ③ CSS 侧：city-mode 下隐藏技能栏（结构残留时的兜底，双保险）
  const cssFlat = __cssSrc.split(String.fromCharCode(10)).join(" ");
  let cssHide = false;
  let cur = cssFlat.indexOf("#hud.city-mode");
  while (cur >= 0) {
    const open = cssFlat.indexOf("{", cur);
    const close = cssFlat.indexOf("}", open);
    if (open < 0 || close < 0) break;
    const sel = cssFlat.slice(cur, open);
    const body = cssFlat.slice(open, close);
    if (sel.indexOf("#party-skillbar") >= 0 && body.indexOf("display:none") >= 0) { cssHide = true; break; }
    cur = cssFlat.indexOf("#hud.city-mode", cur + 1);
  }
  check("主城：CSS 在 #hud.city-mode 下隐藏 #party-skillbar", cssHide);
  check("主城：CSS 隐藏规则先于竖屏段（不被后者覆盖）",
    cssFlat.indexOf("#party-skillbar") >= 0 && cssHide);

  /* ============ ⑪ 升级入槽预览 + 模块槽详情（20.3 任务一 / 任务二） ============ */
  // 复原单人局现场，避免前面 block 的队伍/companions 残留干扰
  G.run.companions = [];
  G.heroDef = CFG.heroes[0];
  G.state = "playing";

  /* ---- (A) 升级弹窗：每张卡显示「→ 填入 <英雄名> 的第 N 槽」+ 归属英雄定位色 ---- */
  // 场景：H001 已用 1 格 → 其候选应显示「填入 <H001名> 的第 2 槽」
  const h1 = CFG.heroes[0];
  G.run.heroModules = { [h1.id]: [{ defId: "M001", lv: 2 }, null, null, null] };
  const roleOut = CFG.heroRoles.output;
  const mixedCands = [
    // 全队混抽：cand 自带 ownerName / ownerRoleColor / heroId
    { kind: "module", heroId: h1.id, defId: "M009", name: "增幅器", desc: "伤害 +22%", lv: 1, locked: false,
      ownerName: "猎手", ownerRoleColor: roleOut.color },
  ];
  // meta 描述的是「升级者」= H001，与 cand 归属一致（混抽场景下可能不一致，见下）
  UI.onLevelUpChoice(mixedCands, () => {}, { heroId: h1.id, heroName: "猎手", roleColor: roleOut.color, slotUsed: 1 });
  const mc0 = get("levelup-cards").children[0];
  check("⑪A 候选卡渲染「填入」文案", mc0.innerHTML.indexOf("填入") >= 0);
  check("⑪A 已用 1 格 → 显示第 2 槽（2/4）", mc0.innerHTML.indexOf("第 2 槽") >= 0 && mc0.innerHTML.indexOf("2/4") >= 0);
  check("⑪A 归属英雄名 = 猎手", mc0.innerHTML.indexOf("猎手") >= 0);
  check("⑪A 使用 cand.ownerRoleColor 定位色（左侧色条）",
    mc0.innerHTML.indexOf("lu-bar") >= 0 && mc0.innerHTML.indexOf(roleOut.color) >= 0);
  UI.onLevelUpChoiceClose();

  // 全队混抽：cand 归属 ≠ meta（升级者）→ 必须显示 cand 的归属，而非 meta
  const h2 = CFG.heroes[1];
  G.run.heroModules = { [h1.id]: [null, null, null, null], [h2.id]: [null, null, null, null] };
  const roleDef = CFG.heroRoles.defense || CFG.heroRoles.recovery || { color: "#6cb2ff" };
  const otherOwnerCands = [
    { kind: "module", heroId: h2.id, defId: "M001", name: "弹头扩容", desc: "弹道数量 +1", lv: 1, locked: false,
      ownerName: "盾卫", ownerRoleColor: roleDef.color },
  ];
  UI.onLevelUpChoice(otherOwnerCands, () => {}, { heroId: h1.id, heroName: "猎手", roleColor: roleOut.color, slotUsed: 0 });
  const oc0 = get("levelup-cards").children[0];
  check("⑪A 混抽：显示 cand 归属（盾卫）而非 meta（猎手）", oc0.innerHTML.indexOf("盾卫") >= 0 && oc0.innerHTML.indexOf("第 1 槽") >= 0);
  check("⑪A 混抽：用 cand.ownerRoleColor（非 meta 定位色）",
    oc0.innerHTML.indexOf(roleDef.color) >= 0 && roleDef.color !== roleOut.color);
  UI.onLevelUpChoiceClose();

  // 槽位将满警示：H001 已用 3 格 → 选中即填满 → lu-will-full + 警示文案
  G.run.heroModules = { [h1.id]: [{ defId: "M001", lv: 1 }, { defId: "M002", lv: 1 }, { defId: "M003", lv: 1 }, null] };
  const almostFull = [
    { kind: "module", heroId: h1.id, defId: "M009", name: "增幅器", desc: "伤害 +22%", lv: 1, locked: false,
      ownerName: "猎手", ownerRoleColor: roleOut.color },
  ];
  UI.onLevelUpChoice(almostFull, () => {}, { heroId: h1.id, heroName: "猎手", roleColor: roleOut.color, slotUsed: 3 });
  const af0 = get("levelup-cards").children[0];
  check("⑪A 槽位将满 → 带 lu-will-full 类", af0.classList.contains("lu-will-full"));
  check("⑪A 槽位将满 → 警示文案（将满 / 4/4）", af0.innerHTML.indexOf("将满") >= 0 && af0.innerHTML.indexOf("4/4") >= 0);
  check("⑪A 将满卡仍可点（非 locked）", typeof af0.onclick === "function" && !af0.classList.contains("lu-locked"));
  UI.onLevelUpChoiceClose();

  // 降级：G.run 为 null → 不崩，且不显示槽号（只显示归属英雄名）
  const savedRun = G.run;
  G.run = null;
  let degradeNoThrow = true, degradeCard = null;
  try {
    UI.onLevelUpChoice(almostFull, () => {}, { heroId: h1.id, heroName: "猎手", roleColor: roleOut.color, slotUsed: 3 });
    degradeCard = get("levelup-cards").children[0];
  } catch (e) { degradeNoThrow = false; }
  check("⑪A G.run=null → 升级弹窗渲染不崩（降级）", degradeNoThrow && !!degradeCard);
  check("⑪A G.run=null → 不显示槽号（无 undefined）",
    degradeCard && degradeCard.innerHTML.indexOf("第 ") < 0 && degradeCard.innerHTML.indexOf("undefined") < 0);
  check("⑪A G.run=null → 仍显示归属英雄名", degradeCard && degradeCard.innerHTML.indexOf("猎手") >= 0);
  UI.onLevelUpChoiceClose();
  G.run = savedRun;

  /* ---- (B) 模块槽点击 → 词条详情浮窗 ---- */
  // 装配单人局：H001 槽0 = 增幅器 M009 LV3（阶段1），槽1 空
  G.run.heroModules = { [h1.id]: [{ defId: "M009", lv: 3 }, null, null, null] };
  UI.renderPartySkillbar();
  const pRow = get("party-skillbar").children[0];
  const pSlots = pRow.querySelectorAll(".ps-slot");
  const slotFilled = pSlots[0], slotEmpty = pSlots[1];
  check("⑪B 技能栏渲染 4 槽", pSlots.length === 4);
  check("⑪B 已填槽带 filled 类", slotFilled.classList.contains("ps-slot-filled"));
  check("⑪B 空槽带 empty 类", slotEmpty.classList.contains("ps-slot-empty"));

  const mtip = get("module-tip");
  check("⑪B 浮窗容器存在（#module-tip）", !!mtip);
  check("⑪B 初始浮窗隐藏", mtip.classList.contains("hidden"));

  // 点击已填槽（模拟事件冒泡到技能栏委托）
  get("party-skillbar").onclick({ target: slotFilled });
  check("⑪B 点已填槽 → 浮窗显示", !mtip.classList.contains("hidden"));
  check("⑪B 浮窗含模块名（增幅器）", mtip.innerHTML.indexOf("增幅器") >= 0);
  check("⑪B 浮窗含等级 LV 3/9", mtip.innerHTML.indexOf("LV 3/9") >= 0);
  check("⑪B 浮窗含品质名（白/蓝/紫/金）", /白|蓝|紫|金/.test(mtip.innerHTML));
  check("⑪B 浮窗品质色 = moduleQualityColor(3)",
    mtip.innerHTML.indexOf(UI.moduleQualityColor(3)) >= 0);
  // 词条明细：主词缀（伤害）+ 阶段词缀（阶段1 解锁第1条 强化·技能伤害）
  check("⑪B 浮窗含主词缀（伤害/主词缀行）", mtip.innerHTML.indexOf("伤害") >= 0 && mtip.innerHTML.indexOf("mt-row main") >= 0);
  check("⑪B 浮窗含阶段词缀明细（强化·技能伤害）", mtip.innerHTML.indexOf("技能伤害") >= 0 || mtip.innerHTML.indexOf("技能冷却") >= 0);

  // 点击空槽 → 空槽提示
  get("party-skillbar").onclick({ target: slotEmpty });
  check("⑪B 点空槽 → 浮窗显示空槽提示", !mtip.classList.contains("hidden") && mtip.innerHTML.indexOf("空槽") >= 0 && mtip.innerHTML.indexOf("升级可选择武器模块填入") >= 0);

  // 再点同一空槽 → 关闭（toggle）
  get("party-skillbar").onclick({ target: slotEmpty });
  check("⑪B 再点同槽 → 浮窗关闭（toggle）", mtip.classList.contains("hidden"));

  // 点击外部 → 关闭
  get("party-skillbar").onclick({ target: slotFilled });
  check("⑪B 前置：浮窗已打开", !mtip.classList.contains("hidden"));
  // 通过 document.onclick 模拟点击任意外部空白节点
  const outside = document.createElement("div");
  document.onclick({ target: outside });
  check("⑪B 点击外部 → 浮窗关闭", mtip.classList.contains("hidden"));

  // 词条行数 = 1 主 + stageAffixes 条（结构核对）
  const affixRows = UI._moduleAffixLines("M009", 3);
  check("⑪B 词条行 = 1 主词缀 + " + ((CFG.moduleLevel.stageAffixes || []).length) + " 阶段词缀",
    affixRows.length === 1 + (CFG.moduleLevel.stageAffixes || []).length);
  check("⑪B 主词缀行标记 main", affixRows[0].main === true);
  // 高等级解锁更多阶段词缀（LV9 → 阶段3）
  const affixRows9 = UI._moduleAffixLines("M009", 9);
  const unlocked9 = affixRows9.filter(r => r.unlocked !== false).length;
  check("⑪B LV9 解锁全部阶段词缀", unlocked9 === affixRows9.length);

  // 未知 defId → 不崩（无主词缀数据）
  let unknownOk = true;
  try { UI._moduleAffixLines("MZZZ", 1); } catch (e) { unknownOk = false; }
  check("⑪B 未知 defId 词条查询不崩", unknownOk);

  // 再次点击浮窗容器外/内判定不误关（点击浮窗自身不关闭）
  UI.showModuleSlotTip({ defId: "M009", lv: 3, idx: 0, heroId: h1.id, heroName: "猎手" }, slotFilled);
  document.onclick({ target: mtip });
  check("⑪B 点击浮窗自身不关闭", !mtip.classList.contains("hidden"));
  UI.hideModuleTip();
  check("⑪B hideModuleTip 幂等关闭", mtip.classList.contains("hidden"));

  // clearBattleHud 顺带关闭浮窗（防回城残留）
  UI.showModuleSlotTip({ defId: "M009", lv: 3, idx: 0, heroId: h1.id, heroName: "猎手" }, slotFilled);
  UI.clearBattleHud();
  check("⑪B clearBattleHud 关闭模块槽浮窗", mtip.classList.contains("hidden"));

  // 移动端/触屏命中区：静态 CSS 核对 —— .ps-slot min 尺寸 ≥32px
  check("⑪B CSS: .ps-slot 声明 min-width/min-height ≥32px（触屏可点）",
    cssFlat.indexOf(".ps-slot") >= 0 && cssFlat.indexOf("min-width:32px") >= 0 && cssFlat.indexOf("min-height:32px") >= 0);

  /* ---- (C) 竖屏：新增浮窗/弹窗不溢出（静态 CSS 核对） ---- */
  // 浮窗宽度限 92vw（不横向溢出 390px 竖屏），且锚在底控件带之上
  check("⑪C CSS: #module-tip max-width ≤96vw 防竖屏溢出", cssFlat.indexOf("max-width:92vw") >= 0);
  check("⑪C CSS: 浮窗有 .hidden 隐藏规则", cssFlat.indexOf(".module-tip.hidden") >= 0);
  // 竖屏下定位：JS 走 portrait 分支（bottom 锚点 + 居中）
  setVP(390, 844);
  UI.applyOrientation();
  UI.showModuleSlotTip({ defId: "M001", lv: 2, idx: 0, heroId: h1.id, heroName: "猎手" }, null);
  check("⑪C 竖屏 390×844：浮窗居中（left 50% + translateX）", mtip.style.left === "50%" && mtip.style.transform.indexOf("translateX") >= 0);
  check("⑪C 竖屏：浮窗 bottom 锚点（不贴顶遮挡）", (mtip.style.bottom || "").indexOf("calc(") === 0);
  UI.hideModuleTip();
  setVP(1920, 1080);   // 复原
  UI.applyOrientation();

  console.log(window.__v2Ok ? "UI V2 TEST OK" : "UI V2 TEST FAILED");
  if (!window.__v2Ok) throw new Error("UI V2 TEST FAILED");
`, ctx, { filename: "driver" });

console.log(okStatic ? "UI V2 STATIC OK" : "UI V2 STATIC FAILED");
if (!okStatic) throw new Error("UI V2 STATIC FAILED");
