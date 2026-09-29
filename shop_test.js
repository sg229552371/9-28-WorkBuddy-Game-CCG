/* 无头测试：工匠世界金币服务（规则 2：局内金币三用途——刷新卡牌 / 购买武器模块 / 购买道具）
 * 覆盖：刷新先用免费次数 / 免费耗尽扣金币 / 金币不足刷新失败且不扣钱 /
 *       shopBuyModule、shopBuyItem 非工匠世界被拒 / 金币不足不扣钱 / 成功扣钱并生成物品入包 /
 *       背包满 → 进入待分配区（node shop_test.js） */
"use strict";

/* ---- DOM / Canvas 桩（与 econ_test 相同的最小桩） ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

  /* ============ 一、卡牌刷新（免费优先 → 金币 → 金币不足失败） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run;
    // 非工匠世界：禁止刷新，免费次数与金币都不动
    G.inArtisan = false;
    r.cardRefresh = CFG.cardPool.refreshPerRun; r.coin = 999;
    check("刷新-非工匠世界被拒", refreshCards() === false && r.cardRefresh === CFG.cardPool.refreshPerRun && r.coin === 999);
    G.inArtisan = true;
    // 免费次数优先：扣次数、不扣金币
    r.cardRefresh = 1; r.coin = 500;
    check("刷新-先用免费次数不扣金币", refreshCards() === true && r.cardRefresh === 0 && r.coin === 500);
    // 免费耗尽 → 扣金币
    r.cardRefresh = 0; r.coin = 500;
    check("刷新-免费耗尽扣金币", refreshCards() === true && r.coin === 500 - CFG.cardPool.refreshCost);
    // 金币不足 → 失败且不扣钱
    r.coin = CFG.cardPool.refreshCost - 1;
    check("刷新-金币不足失败且不扣钱", refreshCards() === false && r.coin === CFG.cardPool.refreshCost - 1);
    // 刷新成功后确实产出候选（数量=候选张数）
    r.cardRefresh = 1; r.cardCandidates = null;
    refreshCards();
    check("刷新-产出候选卡牌", Array.isArray(r.cardCandidates) && r.cardCandidates.length === CFG.cardPool.candidateCount);
  }

  /* ============ 二、shopBuyModule 契约 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run, S = CFG.artisanServices.buyModule;
    // 非工匠世界 → 拒绝，不扣钱
    G.inArtisan = false; r.coin = 1000;
    const bad0 = shopBuyModule();
    check("购模块-非工匠世界被拒", bad0.ok === false && r.coin === 1000 && r.backpack.items.length === 0);
    G.inArtisan = true;
    // 金币不足 → 失败，返回金币不足文案，不扣钱、不产物
    r.coin = S.cost - 1;
    const bad = shopBuyModule();
    check("购模块-金币不足失败且不扣钱", bad.ok === false && bad.msg.indexOf("金币不足") >= 0 && r.coin === S.cost - 1 && !r.backpack.items.length);
    // 成功 → 扣钱 + 生成模块入包
    r.coin = S.cost + 50;
    const res = shopBuyModule();
    const mod = r.backpack.items.find(i => i.kind === "module");
    check("购模块-成功扣款", res.ok === true && r.coin === 50);
    check("购模块-生成模块入包并回报物品名", !!mod && res.msg.indexOf(mod.name) >= 0);
    check("购模块-品质合法（白/蓝/紫/金）", mod && mod.itemQ >= 0 && mod.itemQ <= 3 && !!CFG.itemQualities[mod.itemQ]);
    check("购模块-词缀与等级齐备（复用 makeModule）", mod && mod.affix && !!mod.affix.tag && mod.lv === 1);
    check("购模块-形状与定义一致", mod && !!CFG.moduleDefs.find(m => m.id === mod.defId) && mod.shape.length === 2);
    // 连续两次只按次扣款
    r.coin = S.cost * 2;
    shopBuyModule(); shopBuyModule();
    check("购模块-两次均按次扣款", r.coin === 0);
  }

  /* ============ 三、shopBuyItem 契约 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run, S = CFG.artisanServices.buyItem;
    // 非工匠世界 → 拒绝
    G.inArtisan = false; r.coin = 1000;
    const bad0 = shopBuyItem();
    check("购道具-非工匠世界被拒", bad0.ok === false && r.coin === 1000);
    G.inArtisan = true;
    // 金币不足 → 失败不扣钱
    r.coin = S.cost - 1;
    const bad = shopBuyItem();
    check("购道具-金币不足失败且不扣钱", bad.ok === false && bad.msg.indexOf("金币不足") >= 0 && r.coin === S.cost - 1);
    // 成功 → 扣钱 + 生成现有消耗品（保险契约 / 诅咒道具，不发明新类型）
    r.coin = S.cost + 30;
    const res = shopBuyItem();
    const item = r.backpack.items[0] || r.pendingItems[0];
    check("购道具-成功扣款", res.ok === true && r.coin === 30);
    check("购道具-生成现有消耗品（insurance/curse）", !!item && (item.kind === "insurance" || item.kind === "curse"));
    check("购道具-回报物品名", !!item && res.msg.indexOf(item.name) >= 0);
    // 多次购买必覆盖两类道具（chance 权重均 > 0；60 次命中两类漏检概率极低）
    r.coin = S.cost * 60;
    for (let i = 0; i < 60; i++) shopBuyItem();
    const kinds = new Set();
    for (const it of r.backpack.items) kinds.add(it.kind);
    for (const it of r.pendingItems) kinds.add(it.kind);
    check("购道具-道具池覆盖保险与诅咒两类", kinds.has("insurance") && kinds.has("curse"));
  }

  /* ============ 四、背包满 → 进入待分配区（两种购买均适用） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run;
    G.inArtisan = true;
    // 用 1×1 装备铺满 6×4 背包
    let filled = 0;
    for (let y = 0; y < CFG.backpack.rows; y++) for (let x = 0; x < CFG.backpack.cols; x++) {
      const it = makeGear("G001", 0);
      if (r.backpack.place(it, x, y)) filled++;
    }
    check("前置-背包已铺满", filled === CFG.backpack.cols * CFG.backpack.rows && !r.backpack.findSpot(makeModule("M001", 0)));
    const S1 = CFG.artisanServices.buyModule, S2 = CFG.artisanServices.buyItem;
    // 购买模块（2×? 或 1×1 都放不下）→ 待分配区
    r.pendingItems = []; r.coin = S1.cost;
    const rm = shopBuyModule();
    check("购模块-背包满进待分配区", rm.ok === true && r.pendingItems.length === 1 && r.coin === 0
      && rm.msg.indexOf("待分配区") >= 0);
    // 购买道具 → 待分配区（保险无法叠加/诅咒无空位）
    r.pendingItems = []; r.coin = S2.cost;
    const ri = shopBuyItem();
    check("购道具-背包满进待分配区", ri.ok === true && r.pendingItems.length === 1 && r.coin === 0
      && ri.msg.indexOf("待分配区") >= 0);
  }

  Game.backToMenu();
  console.log(ok ? "SHOP OK" : "SHOP FAILED");
  if (!ok) throw new Error("SHOP FAILED");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
