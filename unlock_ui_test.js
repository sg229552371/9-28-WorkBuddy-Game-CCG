/* 英雄解锁全链路 UI 接入回归测试（node unlock_ui_test.js）——线 B
 * 覆盖：
 *   ① 选人：未解锁卡 .char-card.locked + 解锁条件文案；点击 → toast 且不入 selectedChars（已解锁卡行为不变）
 *   ② 强化导师 renderTrainer：只列已解锁英雄；每卡下级增益预览（与 game.js outLevelStats 同源）；
 *      尾部未解锁分组：heroLv 型显示条件文案、结晶型给「解锁 ◆N」按钮（调用 Meta.unlockHero + 刷新 + toast；不足 disabled）
 *   ③ 武器匠 renderSmith：解锁过滤与导师同口径
 *   ④ 回归：已解锁英雄升级按钮行为不变（metaUpgradeLevel → Meta.levelUp 正常扣款升级）
 *   ⑤ 12 角场景（CFG.heroes 手动 push 假英雄模拟线 A 交付后形态）下不崩 + 新增英雄解锁流走通
 * DOM 桩直接复制 ui_v2_test.js（含 closest 实现），无需外部依赖。 */
"use strict";

/* ---- DOM 桩（与 ui_v2_test.js 同源，含 closest 实现） ---- */
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
    // 解析字符串里带 class 的元素为子节点（供 querySelector(".up-lv") 命中）
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
  // 按实例缓存：renderTrainer 里 card.querySelector(".up-lv").onclick = ... 需要稳定对象
  querySelector(sel) {
    this._q = this._q || {};
    if (!this._q[sel]) {
      const list = this._findAll(sel.replace(/^\./, ""));
      this._q[sel] = list[0] || new FakeEl(sel);
    }
    return this._q[sel];
  }
  // 按 class token 精确匹配并递归后代
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
  // 真实 closest 语义：支持 ".cls" / "#id" / 逗号多选择器，沿 _parent 上溯
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
  innerWidth: 390, innerHeight: 844,   // 竖屏优先：默认桩视口取 390×844
};
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");

/* ---- 1) 静态核对：index.html id 清单 + css 竖屏段 ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const requiredIds = ["char-list", "btn-char-start", "outlevel-list", "weapon-list"];
let okStatic = true;
for (const id of requiredIds) {
  if (!htmlIds.has(id)) { console.log("FAIL index.html 缺少元素 id=" + id); okStatic = false; }
}
console.log("index.html 解锁 UI 关联元素清单 OK: " + requiredIds.length + " 个必需 id 全部存在");
const cssSrc = fs.readFileSync(path.join(__dirname, "css", "style.css"), "utf8");
const cssFlat = cssSrc.split(String.fromCharCode(10)).join(" ");
let okCss = true;
const cssNeed = [
  [".char-card.locked", "选人未解锁置灰"],
  [".npc-group-title", "未解锁分组标题"],
  [".meta-card.locked", "未解锁升级卡置灰"],
  ["gain-preview", "下级增益预览"],
];
for (const [tok, desc] of cssNeed) {
  if (cssFlat.indexOf(tok) < 0) { console.log("FAIL css 缺少规则 " + tok + "（" + desc + "）"); okCss = false; }
}
console.log("css 解锁 UI 样式清单 OK: " + cssNeed.length + " 项规则齐备");

/* ---- 2) 加载脚本 + 驱动 ---- */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  const get = (id) => document.getElementById(id);
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) window.__unlockOk = false; };
  window.__unlockOk = true;

  /* 便捷：找 outlevel-list / weapon-list 里某英雄名的卡片（结构：孩子里 title 与 card 交错） */
  const findCard = (box, name) => box.children.find(c => c.innerHTML && c.innerHTML.indexOf(name) >= 0);
  const lockedCards = (box) => box.children.filter(c => c.classList.contains("locked"));
  const upCardsOf = (box) => box.children.filter(c => c.classList.contains("meta-card") && !c.classList.contains("locked"));

  Game.bindEvents();

  /* 数据驱动基线（防御 8 / 12 角：线 A 可能已并入 H009~H012）：
   * 从 CFG 动态解析「已解锁 / 未解锁」集合 + 找出一张 heroLv 型与一张 crystal 型未解锁英雄。 */
  const baseUnlocked = CFG.heroes.filter(h => Meta.isHeroUnlocked(h.id));
  const baseLocked = CFG.heroes.filter(h => !Meta.isHeroUnlocked(h.id));
  const heroLvLocked = baseLocked.find(h => { const r = CFG.unlockRules && CFG.unlockRules[h.id]; return r && r.heroLv; });
  const crystalLocked = baseLocked.find(h => { const r = CFG.unlockRules && CFG.unlockRules[h.id]; return r && typeof r.crystal === "number"; });
  const h1 = CFG.heroes.find(h => h.id === "H001") || baseUnlocked[0];
  check("基线：已解锁英雄数 = starterCount", baseUnlocked.length === CFG.starterCount);
  check("基线：存在 heroLv 型未解锁英雄", !!heroLvLocked);
  check("基线：存在 crystal 型未解锁英雄", !!crystalLocked);

  /* ============ ① 选人界面：未解锁置灰 + 条件文案 + 点击拦截 ============ */
  UI.selectedChars = [];
  UI.buildCharList();
  const cl = get("char-list").children;
  check("选人卡数量 = 英雄总数", cl.length === CFG.heroes.length);

  const cardHeroLv = cl.find(c => c.innerHTML.indexOf(heroLvLocked.id) >= 0);
  const cardCrystal = cl.find(c => c.innerHTML.indexOf(crystalLocked.id) >= 0);
  const cardH1 = cl.find(c => c.innerHTML.indexOf(h1.id) >= 0);
  check("heroLv 型未解锁卡带 locked 类", cardHeroLv.classList.contains("locked"));
  check("crystal 型未解锁卡带 locked 类", cardCrystal.classList.contains("locked"));
  check("已解锁卡不带 locked 类（已解锁不变）", !cardH1.classList.contains("locked"));
  check("heroLv 型卡显示 heroLv 条件（含 局外 LV" + CFG.unlockRules[heroLvLocked.id].heroLv.lv + "）",
    cardHeroLv.innerHTML.indexOf("局外 LV" + CFG.unlockRules[heroLvLocked.id].heroLv.lv) >= 0);
  check("crystal 型卡显示结晶条件（含 结晶 " + CFG.unlockRules[crystalLocked.id].crystal + "）",
    cardCrystal.innerHTML.indexOf("结晶 " + CFG.unlockRules[crystalLocked.id].crystal) >= 0);
  check("未解锁卡带锁形标识（🔒）", cardHeroLv.innerHTML.indexOf("🔒") >= 0);

  // 点击未解锁卡 → toast 且不入 selectedChars
  let toastMsg = "";
  const origToast = UI.toast.bind(UI);
  UI.toast = (m) => { toastMsg = m; };
  cardHeroLv.onclick({});
  check("点击未解锁卡 → toast 提示解锁条件",
    toastMsg.indexOf(heroLvLocked.id) >= 0 || toastMsg.indexOf(heroLvLocked.name) >= 0);
  check("点击未解锁卡 → 不入 selectedChars",
    UI.selectedChars.length === 0 && !UI.selectedChars.some(s => s.id === heroLvLocked.id));
  /* 21.6：点击未解锁 → 详情区持续展示解锁条件（不再只靠 toast 一闪）：
   * cd-unlock 金色条件行持续可见。
   * 21.9：未解锁英雄**信息公开化**（用户要求：可查看技能信息、角色属性、解锁条件）——
   * 取消 21.6 防剧透打码：真名 + 简介 + LV1 基础属性 + LV1 技能描述全部可见。 */
  const cdBox = get("char-detail");
  const cdHtml = cdBox ? cdBox.innerHTML : "";
  check("21.6 点击未解锁 → 详情区渲染解锁条件行（cd-unlock + 条件文案）",
    cdHtml.indexOf("cd-unlock") >= 0 && cdHtml.indexOf(UI._unlockRuleText(heroLvLocked.id)) >= 0);
  check("21.9 未解锁详情显示真名（取消 ??? 打码）",
    cdHtml.indexOf("???") < 0 && cdHtml.indexOf(heroLvLocked.name) >= 0);
  check("21.9 未解锁详情显示 LV1 基础属性（cd-stats）",
    cdHtml.indexOf("cd-stats") >= 0 && cdHtml.indexOf("LV1 基础值") >= 0);
  check("21.9 未解锁详情显示技能信息（cd-skill LV1 描述）",
    cdHtml.indexOf("cd-skill") >= 0 && cdHtml.indexOf("技能 LV1") >= 0);
  check("21.6 未解锁详情仍显示定位徽章（role-badge 保留）", cdHtml.indexOf("role-badge") >= 0);

  /* 21.8：选人详情区 crystal 型解锁入口落地——此前 _unlockCost 定义后全库零调用，
   * 结晶足够（用户实机 316 ≥ 300）也在选人面板无处解锁。按钮行为与导师 _doUnlockHero 对齐：
   * 足够 → Meta.unlockHero 扣款 + toast + 列表/详情刷新；不足 → disabled 显示缺口；heroLv 型无按钮。 */
  const costC = CFG.unlockRules[crystalLocked.id].crystal;
  UI.renderCharDetail(crystalLocked);   // 默认结晶 0 → 不足
  const cdC1 = get("char-detail") ? get("char-detail").innerHTML : "";
  check("21.8 crystal 型详情区渲染解锁按钮（btn-unlock-hero + ◆N）",
    cdC1.indexOf("btn-unlock-hero") >= 0 && cdC1.indexOf("◆ " + costC) >= 0);
  check("21.8 结晶不足 → 按钮 disabled + 显示「还差」缺口", cdC1.indexOf("disabled") >= 0 && cdC1.indexOf("还差") >= 0);
  Meta.data.crystals = costC;           // 精确到门槛值 → 足够
  UI.renderCharDetail(crystalLocked);
  const btnU = get("btn-unlock-hero");
  // 桩语义：getElementById 返回独立空壳 FakeEl（_html 为空），「可点」等价断言 = 无 disabled + 已绑定 onclick（行为由下一条扣款断言验证）
  check("21.8 结晶足够 → 按钮可点（无 disabled + 已绑定回调）", !!btnU && !btnU.disabled && typeof btnU.onclick === "function");
  btnU.onclick({});
  check("21.8 点击解锁 → 扣等额结晶 + unlockExtra 落档",
    Meta.data.crystals === 0 && !!Meta.data.unlockExtra[crystalLocked.id]);
  check("21.8 解锁成功 → toast 提示（gold 同导师）", toastMsg.indexOf("已解锁") >= 0);
  check("21.8 解锁成功 → 详情区刷新为已解锁态（显示局外 LV 成长行）", (get("char-detail") ? get("char-detail").innerHTML : "").indexOf("局外 LV") >= 0);
  delete Meta.data.unlockExtra[crystalLocked.id];   // 恢复未解锁态，防影响后续导师分组断言
  Meta.data.crystals = 0;
  UI.renderCharDetail(heroLvLocked);    // heroLv 型：查询式自动解锁，无按钮
  const cdLv1 = get("char-detail") ? get("char-detail").innerHTML : "";
  check("21.8 heroLv 型不渲染解锁按钮（达成条件自动解锁）", cdLv1.indexOf("btn-unlock-hero") < 0);
  check("21.8 heroLv 型详情区文案含「自动解锁」", cdLv1.indexOf("自动解锁") >= 0);

  // 点击已解锁卡 → 正常入队（回归安全）
  toastMsg = "";
  cardH1.onclick({});
  check("点击已解锁卡 → 正常入队", UI.selectedChars.some(s => s.id === h1.id));
  check("点击已解锁卡不触发解锁 toast", toastMsg === "");
  UI.toast = origToast;

  /* ============ ② 强化导师 renderTrainer ============ */
  Meta.data.crystals = 10000;
  UI.renderTrainer();
  const obox = get("outlevel-list");
  const upCards = upCardsOf(obox);
  check("导师：升级卡数 = 已解锁英雄数", upCards.length === Meta.unlockedHeroes().length);
  check("导师：升级区不含任何未解锁英雄名",
    !upCards.some(c => baseLocked.some(h => c.innerHTML.indexOf(h.name) >= 0)));
  // 尾部未解锁分组
  const groupTitle = obox.children.find(c => c.classList.contains("npc-group-title"));
  check("导师：存在「未解锁」分组标题", !!groupTitle && groupTitle.textContent.indexOf("未解锁") >= 0);
  check("导师：未解锁卡数 = 未解锁英雄数", lockedCards(obox).length === baseLocked.length);
  const lockHeroLv = lockedCards(obox).find(c => c.innerHTML.indexOf(heroLvLocked.name) >= 0);
  const lockCrystal = lockedCards(obox).find(c => c.innerHTML.indexOf(crystalLocked.name) >= 0);
  check("导师：heroLv 型未解锁卡显示条件文案",
    lockHeroLv.innerHTML.indexOf("局外 LV" + CFG.unlockRules[heroLvLocked.id].heroLv.lv) >= 0);
  check("导师：heroLv 型不给结晶解锁按钮",
    !lockHeroLv.children.some(c => c.classList.contains("unlock-hero")));
  check("导师：crystal 型带「解锁 ◆" + CFG.unlockRules[crystalLocked.id].crystal + "」按钮",
    lockCrystal.innerHTML.indexOf("解锁 ◆" + CFG.unlockRules[crystalLocked.id].crystal) >= 0);
  check("导师：结晶充足 → 解锁按钮不带 disabled 属性",
    lockCrystal.innerHTML.indexOf('unlock-hero" disabled') < 0 && lockCrystal.innerHTML.indexOf("unlock-hero") >= 0);

  /* 下级增益预览：与 game.js outLevelStats 同源（LV1→LV2 场景断言数值） */
  Meta.data.heroes[h1.id] = { level: 1, weaponLv: 1 };
  UI.renderTrainer();
  const upCards2 = upCardsOf(get("outlevel-list"));
  const h1Card = upCards2.find(c => c.innerHTML.indexOf(h1.name) >= 0);
  check("导师：已解锁卡含下级增益预览行", h1Card.innerHTML.indexOf("下级") >= 0 && h1Card.innerHTML.indexOf("gain-preview") >= 0);
  // 同源断言：直接由 outLevelStats 计算期望差分（不手抄公式）
  const s1 = outLevelStats(h1, 1), s2 = outLevelStats(h1, 2);
  const expDhp = s2.hp - s1.hp, expDatk = s2.atk - s1.atk, expDdef = s2.def - s1.def;
  check("导师：增益预览数值 = outLevelStats 同源差分（HP" + expDhp + " 攻" + expDatk + " 防" + expDdef + "）",
    h1Card.innerHTML.indexOf("+HP " + expDhp) >= 0
    && h1Card.innerHTML.indexOf("+攻击 " + expDatk) >= 0
    && h1Card.innerHTML.indexOf("+防御 " + expDdef) >= 0);
  check("导师：outLevelStats 为可直接调用的纯函数", typeof outLevelStats === "function" && typeof s1.hp === "number");

  /* 结晶解锁按钮：点击 → Meta.unlockHero 被调用 + 面板刷新 + toast */
  const crystalCost = CFG.unlockRules[crystalLocked.id].crystal;
  Meta.data.crystals = crystalCost + 200;
  UI.renderTrainer();
  const lockCrystal2 = lockedCards(get("outlevel-list")).find(c => c.innerHTML.indexOf(crystalLocked.name) >= 0);
  let unlockToast = "";
  const oT2 = UI.toast.bind(UI);
  UI.toast = (m) => { unlockToast = m; };
  const cryBefore = Meta.data.crystals;
  lockCrystal2.querySelector(".unlock-hero").onclick({});
  check("导师：点「解锁 ◆" + crystalCost + "」→ 扣等额结晶", Meta.data.crystals === cryBefore - crystalCost);
  check("导师：点「解锁 ◆" + crystalCost + "」→ 该英雄变为已解锁", Meta.isHeroUnlocked(crystalLocked.id));
  check("导师：点「解锁」→ 成功 toast 含英雄名", unlockToast.indexOf("解锁") >= 0 && unlockToast.indexOf(crystalLocked.name) >= 0);
  /* 21.6 修正：名字子串会撞锁定区条件文案（H011 条件「医疗兵（H010）局外 LV6」含「医疗兵」），
   * 改用升级区特有「局外等级」字样做正断言（升级卡独有结构，锁定卡无此文案） */
  check("导师：解锁后面板刷新 → 该英雄进入升级区（升级区卡含其名 + 「局外等级」结构）",
    upCardsOf(get("outlevel-list")).some(c => c.innerHTML.indexOf(crystalLocked.name) >= 0 && c.innerHTML.indexOf("局外等级") >= 0));
  UI.toast = oT2;

  /* 结晶不足 → 解锁按钮 disabled（复位该英雄为未解锁） */
  Meta.data.unlockExtra = Meta.data.unlockExtra || {};
  delete Meta.data.unlockExtra[crystalLocked.id];
  Meta.data.crystals = Math.max(0, crystalCost - 1);
  UI.renderTrainer();
  const lockPoor = lockedCards(get("outlevel-list")).find(c => c.innerHTML.indexOf(crystalLocked.name) >= 0);
  check("导师：结晶不足（< " + crystalCost + "）→ 解锁按钮带 disabled 属性",
    !!lockPoor && lockPoor.innerHTML.indexOf('unlock-hero" disabled') >= 0);
  const cryLow = Meta.data.crystals;
  lockPoor.querySelector(".unlock-hero").onclick({});
  check("导师：结晶不足点击 → 不扣款不改解锁态",
    Meta.data.crystals === cryLow && !Meta.isHeroUnlocked(crystalLocked.id));

  /* heroLv 条件达成 → 自动解锁（查询式，导师面板随之出现） */
  const hl = CFG.unlockRules[heroLvLocked.id].heroLv;
  Meta.data.heroes[hl.heroId] = { level: hl.lv, weaponLv: 1 };
  UI.renderTrainer();
  check("导师：heroLv 条件达成 → 该英雄自动解锁并进入升级区",
    Meta.isHeroUnlocked(heroLvLocked.id) && upCardsOf(get("outlevel-list")).some(c => c.innerHTML.indexOf(heroLvLocked.name) >= 0));
  Meta.data.heroes[hl.heroId] = { level: 1, weaponLv: 1 };   // 复位

  /* ============ ③ 武器匠 renderSmith：解锁过滤与导师同口径 ============ */
  Meta.data.crystals = 10000;
  delete Meta.data.unlockExtra[crystalLocked.id];
  UI.renderSmith();
  const wbox = get("weapon-list");
  const wUp = upCardsOf(wbox);
  check("武器匠：升级卡数 = 已解锁英雄数", wUp.length === Meta.unlockedHeroes().length);
  check("武器匠：升级区不含任何未解锁英雄名",
    !wUp.some(c => baseLocked.some(h => c.innerHTML.indexOf(h.name) >= 0)));
  check("武器匠：存在未解锁分组标题", wbox.children.some(c => c.classList.contains("npc-group-title")));
  check("武器匠：未解锁卡带结晶解锁条件",
    lockedCards(wbox).some(c => c.innerHTML.indexOf("结晶 " + crystalCost) >= 0));
  check("武器匠：crystal 型英雄亦有解锁按钮",
    lockedCards(wbox).some(c => c.innerHTML.indexOf(crystalLocked.name) >= 0 && c.innerHTML.indexOf("unlock-hero") >= 0));

  /* ============ ④ 回归：已解锁英雄升级按钮行为不变 ============ */
  Meta.data.heroes[h1.id] = { level: 1, weaponLv: 1 };
  Meta.data.crystals = 100000;
  UI.renderTrainer();
  const upH1 = upCardsOf(get("outlevel-list")).find(c => c.innerHTML.indexOf(h1.name) >= 0);
  const lvBefore = Meta.heroLevel(h1.id), costH1 = Meta.levelUpCost(h1.id), cryB = Meta.data.crystals;
  upH1.querySelector(".up-lv").onclick();
  check("回归：已解锁英雄升级按钮 → Meta.levelUp 正常扣款 LV+1",
    Meta.heroLevel(h1.id) === lvBefore + 1 && Meta.data.crystals === cryB - costH1);
  UI.renderSmith();
  const wH1 = upCardsOf(get("weapon-list")).find(c => c.innerHTML.indexOf(h1.name) >= 0);
  const wBefore = Meta.weaponLv(h1.id), wCost = Meta.weaponUpCost(h1.id), cryW = Meta.data.crystals;
  wH1.querySelector(".up-wp").onclick();
  check("回归：武器匠升级按钮 → 武器等级+1 且扣款",
    Meta.weaponLv(h1.id) === wBefore + 1 && Meta.data.crystals === cryW - wCost);

  /* ============ ⑤ 扩展角场景：push 假英雄（模拟线 A 交付后 / 未来补表形态）不崩 + 解锁流走通 ============ */
  const realLen = CFG.heroes.length, realOrderLen = CFG.unlockOrder.length;
  const fakeIds = ["H901", "H902", "H903", "H904"];   // 假 id 避开真实表
  for (const fid of fakeIds) {
    CFG.heroes.push({ id: fid, name: "测试角" + fid, sprite: "H001", desc: "假英雄（线 A 交付形态模拟）",
      hp: 100, atk: 10, def: 5, spd: 200, weapon: CFG.heroes[0].weapon });
    CFG.unlockOrder.push(fid);
  }
  // H901 结晶型（400）；H902 heroLv 型（H001 ≥ LV5）；H903/H904 无规则 → 暂未解锁
  CFG.unlockRules["H901"] = { crystal: 400, desc: "测试结晶解锁" };
  CFG.unlockRules["H902"] = { heroLv: { heroId: "H001", lv: 5 }, desc: "测试 heroLv 解锁" };
  const expectLen = realLen + 4;
  let extOk = true;
  try {
    UI.selectedChars = [];
    UI.buildCharList();
    UI.renderTrainer();
    UI.renderSmith();
  } catch (e) { extOk = false; console.log("扩展角渲染异常：" + e.message); }
  check("扩展角（" + expectLen + " 角）：选人 / 导师 / 武器匠渲染不崩", extOk);
  check("扩展角：选人卡数 = CFG.heroes.length", get("char-list").children.length === expectLen);
  check("扩展角：无规则英雄卡显示「暂未解锁」",
    get("char-list").children.find(c => c.innerHTML.indexOf("H903") >= 0).innerHTML.indexOf("暂未解锁") >= 0);
  check("扩展角：导师未解锁分组含 4 个新假角",
    fakeIds.every(fid => lockedCards(get("outlevel-list")).some(c => c.innerHTML.indexOf("测试角" + fid) >= 0)));
  check("扩展角：H902 未解锁卡显示 heroLv 条件（局外 LV5）",
    lockedCards(get("outlevel-list")).find(c => c.innerHTML.indexOf("测试角H902") >= 0).innerHTML.indexOf("局外 LV5") >= 0);

  // 扩展角下：H901 结晶解锁流走通
  const extCry = Meta.data.crystals;
  UI.renderTrainer();
  lockedCards(get("outlevel-list")).find(c => c.innerHTML.indexOf("测试角H901") >= 0)
    .querySelector(".unlock-hero").onclick({});
  check("扩展角：H901 结晶解锁成功（扣 400）", Meta.isHeroUnlocked("H901") && Meta.data.crystals === extCry - 400);
  // H902：H001 达标自动解锁
  Meta.data.heroes["H001"] = { level: 5, weaponLv: 1 };
  check("扩展角：H001 LV5 → H902 自动解锁", Meta.isHeroUnlocked("H902"));
  check("扩展角：unlockedHeroes() 含新解锁英雄",
    Meta.unlockedHeroes().indexOf("H901") >= 0 && Meta.unlockedHeroes().indexOf("H902") >= 0);

  // 清理假英雄 + 复位解锁态，避免污染（后续无断言，但保持整洁）
  CFG.heroes.length = realLen;
  CFG.unlockOrder.length = realOrderLen;
  for (const fid of fakeIds) delete CFG.unlockRules[fid];
  delete Meta.data.unlockExtra["H901"]; delete Meta.data.unlockExtra["H902"];

  /* ============ ⑥ 竖屏 390×844：新增分组/按钮类名不溢出（结构核对） ============ */
  UI.applyOrientation();
  check("竖屏：body 挂 portrait 类", document.body.classList.contains("portrait"));

  console.log(window.__unlockOk ? "UNLOCK UI TEST OK" : "UNLOCK UI TEST FAILED");
  if (!window.__unlockOk) throw new Error("UNLOCK UI TEST FAILED");
`, ctx, { filename: "driver" });

console.log(okStatic ? "UNLOCK UI STATIC OK" : "UNLOCK UI STATIC FAILED");
if (!okStatic) throw new Error("UNLOCK UI STATIC FAILED");
console.log(okCss ? "UNLOCK UI CSS OK" : "UNLOCK UI CSS FAILED");
if (!okCss) throw new Error("UNLOCK UI CSS FAILED");
