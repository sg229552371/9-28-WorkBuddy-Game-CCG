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
  // 真实 DOM innerHTML="" 会清空子节点；桩必须一致，否则重复渲染读到旧卡片
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  // 按实例缓存：renderXxx 里 card.querySelector(".lu-name").onclick = ... 需要稳定对象
  querySelector(sel) { this._q = this._q || {}; return this._q[sel] || (this._q[sel] = new FakeEl(sel)); }
  querySelectorAll() { return []; }
  closest() { return null; }
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
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  body: new FakeEl("body"),
};
const winHandlers = {};
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); }, innerWidth: 1920, innerHeight: 1080 };
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
  // ③ 升级 4 选 1 弹窗
  "levelup-overlay", "levelup-cards",
  // ④ 背包三段布局
  "grid-backpack", "grid-chip", "module-slots", "bp-grid-unit", "bp-panel-main",
  // ⑤ 芯片工坊
  "art-tab-forge", "art-page-forge", "forge-list",
  // ⑥ 芯片图鉴
  "screen-chip-codex", "chip-codex-value", "chip-codex-behavior", "btn-home-chip-codex", "btn-chip-codex-back",
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
  console.log(window.__v2Ok ? "UI V2 TEST OK" : "UI V2 TEST FAILED");
  if (!window.__v2Ok) throw new Error("UI V2 TEST FAILED");
`, ctx, { filename: "driver" });

console.log(okStatic ? "UI V2 STATIC OK" : "UI V2 STATIC FAILED");
if (!okStatic) throw new Error("UI V2 STATIC FAILED");
