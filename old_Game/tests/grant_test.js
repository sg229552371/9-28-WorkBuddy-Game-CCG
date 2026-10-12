/* 无头测试：物品入包路径统一（grantItemToRun 行为锁定）
 * 目的：重构前锁住「入包四分支」的当前行为，保证把 6 处重复代码收敛到
 * grantItemToRun() 后行为完全等价（node grant_test.js）
 *
 * 覆盖的四个分支（ui.js / game.js 六处共用同一语义）：
 *   A. 保险可叠加 → 叠加到已有堆叠（count++、value 同步）
 *   B. 宝箱同品质 → tryStackChest 叠加
 *   C. 有空间 → findSpot + place 入背包
 *   D. 无空间 → pendingItems（待分配区）
 */
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
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
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

  /* 造一个干净的 run（含背包/待分配区） */
  const freshRun = () => {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    const r = G.run;
    r.backpack.items.slice().forEach(it => r.backpack.remove(it));   // 清空背包
    r.pendingItems.length = 0;                                       // 清空待分配区
    return r;
  };

  /* ============ A. 保险可叠加 → 叠加到已有堆叠 ============ */
  {
    const r = freshRun();
    const ins1 = makeInsurance();
    const first = grantItemToRun(r, ins1);
    check("A1 保险首次入包 → 返回 true", first === true);
    const stacked = r.backpack.items.find(x => x.kind === "insurance");
    check("A2 保险首次入包 → 背包出现 1 件", !!stacked && stacked.count === 1);

    const ins2 = makeInsurance();
    const second = grantItemToRun(r, ins2);
    const after = r.backpack.items.filter(x => x.kind === "insurance");
    check("A3 保险二次入包 → 叠加到同一堆叠（仍是 1 件）", after.length === 1 && after[0].count === 2);
    check("A4 叠加后 value 同步（= 单价 × 2）", after[0].value === CFG.insurance.value * 2);
    check("A5 叠加返回 true", second === true);
    // 待分配区不应被占用
    check("A6 叠加路径不产生待分配项", r.pendingItems.length === 0);
  }

  /* ============ A'. 保险堆叠满（maxStack）→ 另开新堆叠 ============ */
  {
    const r = freshRun();
    const stack = makeInsurance();
    stack.count = CFG.insurance.maxStack;      // 预置一个满堆叠
    stack.value = CFG.insurance.value * stack.count;
    r.backpack.place(stack, 0, 0);
    const extra = makeInsurance();
    grantItemToRun(r, extra);
    const list = r.backpack.items.filter(x => x.kind === "insurance");
    check("A7 堆叠已满 → 新开一份（两件）", list.length === 2);
    check("A8 新堆叠 count = 1", list.some(x => x.count === 1));
  }

  /* ============ B. 宝箱同品质 → 叠堆 ============ */
  {
    const r = freshRun();
    const q = "normal";
    const c1 = makeChestItem(q);
    grantItemToRun(r, c1);
    const held = r.backpack.items.filter(x => x.kind === "chest");
    check("B1 宝箱首次入包 → 1 件", held.length === 1 && held[0].count === 1);

    const c2 = makeChestItem(q);
    grantItemToRun(r, c2);
    const held2 = r.backpack.items.filter(x => x.kind === "chest");
    check("B2 同品质宝箱 → 叠堆（仍 1 件，count=2）", held2.length === 1 && held2[0].count === 2);
    check("B3 宝箱叠堆 value 同步", held2[0].value === CFG.chestQualities[q].value * 2);
    check("B4 叠堆路径不产生待分配项", r.pendingItems.length === 0);
  }

  /* ============ B'. 不同品质宝箱 → 不叠堆，各占一格 ============ */
  {
    const r = freshRun();
    grantItemToRun(r, makeChestItem("normal"));
    grantItemToRun(r, makeChestItem("advanced"));
    const held = r.backpack.items.filter(x => x.kind === "chest");
    check("B5 不同品质宝箱不叠堆（2 件）", held.length === 2);
  }

  /* ============ C. 有空间 → 入背包 ============ */
  {
    const r = freshRun();
    const gear = makeGear(CFG.gearDefs ? CFG.gearDefs[0].id : "G001", 0);
    const placed = grantItemToRun(r, gear);
    check("C1 有空间 → 返回 true（已入背包）", placed === true);
    check("C2 物品确实在背包里", r.backpack.items.indexOf(gear) >= 0);
    check("C3 物品不在待分配区", r.pendingItems.indexOf(gear) < 0);
    check("C4 物品坐标已记录", gear.x !== undefined && gear.y !== undefined);
  }

  /* ============ D. 无空间 → 进待分配区 ============ */
  {
    const r = freshRun();
    // 用 1x1 占位物填满整张背包（6x4）
    const bp = r.backpack;
    for (let y = 0; y < bp.rows; y++) {
      for (let x = 0; x < bp.cols; x++) {
        const filler = { kind: "gear", shape: [1, 1], weight: 0, value: 1, name: "占位", q: 0 };
        bp.place(filler, x, y);
      }
    }
    check("D1 背包已填满（无空位）", bp.findSpot({ shape: [1, 1] }) === null);

    const gear = makeGear(CFG.gearDefs ? CFG.gearDefs[0].id : "G001", 0);
    const placed = grantItemToRun(r, gear);
    check("D2 无空间 → 返回 false（进待分配区）", placed === false);
    check("D3 物品在待分配区", r.pendingItems.indexOf(gear) >= 0);
    check("D4 物品不在背包", r.backpack.items.indexOf(gear) < 0);
  }

  /* ============ E. 满背包时宝箱：先试叠堆，叠不上再进待分配区 ============ */
  {
    const r = freshRun();
    const bp = r.backpack;
    // 先放一个未满的同品质宝箱到 (0,0)
    const stackTarget = makeChestItem("normal");
    bp.place(stackTarget, 0, 0);
    // 填满其余格子
    for (let y = 0; y < bp.rows; y++) {
      for (let x = 0; x < bp.cols; x++) {
        if (x === 0 && y === 0) continue;
        const filler = { kind: "gear", shape: [1, 1], weight: 0, value: 1, name: "占位", q: 0 };
        bp.place(filler, x, y);
      }
    }
    check("E1 无空位但存在可叠堆宝箱", bp.findSpot({ shape: [1, 1] }) === null);
    const c = makeChestItem("normal");
    const placed = grantItemToRun(r, c);
    check("E2 满背包 + 可叠堆 → 仍叠堆成功（返回 true）", placed === true);
    check("E3 叠堆后 count = 2", stackTarget.count === 2);

    // 再塞一个不同品质宝箱 → 无处可去 → 待分配区
    const c2 = makeChestItem("epic");
    const placed2 = grantItemToRun(r, c2);
    check("E4 满背包 + 不可叠堆 → 待分配区（返回 false）", placed2 === false);
    check("E5 该宝箱确在待分配区", r.pendingItems.indexOf(c2) >= 0);
  }

  /* ============ F. 幂等性：同一件物品重复调用不产生副本 ============ */
  {
    const r = freshRun();
    const gear = makeGear(CFG.gearDefs ? CFG.gearDefs[0].id : "G001", 0);
    grantItemToRun(r, gear);
    const n1 = r.backpack.items.indexOf(gear);
    check("F1 首次入包定位成功", n1 >= 0);
    check("F2 入包后 inv 字段已绑定", gear.inv === r.backpack.id);
  }

  /* ============ G. 商店路径（已用 grantItemToRun）回归 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
    G.inArtisan = true;
    const r = G.run;
    r.coin = 99999;
    const before = r.backpack.items.length;
    const res = shopBuyItem("ins");
    check("G1 商店购买保险 → ok", res && res.ok === true);
    check("G2 商店购买后背包有变化", r.backpack.items.length >= before);
    G.inArtisan = false;
  }

  console.log(ok ? "GRANT OK" : "GRANT FAILED");
  if (!ok) throw new Error("grant_test FAILED");
`;
vm.runInContext(driver, ctx, { filename: "grant_driver" });
