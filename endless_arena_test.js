/* ============================================================================
 * 21.19 W3 · 深渊世界内容（祭坛接线 + 奖励节点）回归测试（node endless_arena_test.js）
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   一、配置与契约存在性：CFG.endless.rewardNodes 冻结字段 + EndlessArena 四方法
 *   二、建世界自动注入（包装 makeWorld）：altars 非空且无 RIFT（真缺口修复）
 *   三、奖励节点：数量 = rewardNodes.count、字段完整、kind 在合法集合、radius 同源
 *   四、gold 进圈拾取：结算一次（G.run.coin += amount），二次更新不重复结算
 *   五、crystal 进圈拾取：Endless.state.crystals 累加（现有口径：结算面板统一入账）
 *   六、supply 读条回血：judgeChannel 未读完不生效、读完 healRatio 回血一次
 *   七、非深渊世界零影响：populate / update 早退，不注入任何内容
 *   八、猴子补丁幂等：重复 install 不叠加，重复 populate 不重复投放
 *
 * ⚠️ 汇总行中文；输出禁用英文 FAIL/Error 字样（门禁口径）。
 * 范式参考 endless_flow_test.js（DOM 桩 + Node vm 沙箱）。
 * ========================================================================== */
"use strict";

/* ---- DOM / Canvas 桩（与 endless_flow_test.js 同范式） ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
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
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm");
const path = require("path");

/* ---- 加载完整脚本链 + 被测模块（顺序照抄任务卡脚本链） ---- */
const ctx = vm.createContext(global);
const CHAIN = ["config", "core", "pool", "game", "items", "combat", "modes", "render",
  "stress", "endless", "hud_endless", "ui", "ui-screens", "ui-panels", "quality", "rewards"];
for (const n of CHAIN) {
  const f = path.join(__dirname, "js", n + ".js");
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: "js/" + n + ".js" });
}
vm.runInContext(fs.readFileSync(path.join(__dirname, "js", "endless-arena.js"), "utf8"),
  ctx, { filename: "js/endless-arena.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "js", "main.js"), "utf8"),
  ctx, { filename: "js/main.js" });

/* ---- 测试主体 ---- */
vm.runInContext(`
  let pass = 0, fail = 0;
  const check = (name, cond) => { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("失败 -> " + name); } };

  /* ============ 一、配置与契约存在性 ============ */
  const rc = CFG.endless.rewardNodes;
  check("一1 CFG.endless.rewardNodes 已冻结入 CFG", !!rc);
  check("一2 count / types / radius / channel 字段完整",
    rc && rc.count > 0 && Array.isArray(rc.types) && rc.types.length >= 3 &&
    rc.radius > 0 && rc.channel > 0);
  check("一3 EndlessArena 暴露 populate/update/render/install 四方法",
    typeof EndlessArena === "object" && typeof EndlessArena.populate === "function" &&
    typeof EndlessArena.update === "function" && typeof EndlessArena.render === "function" &&
    typeof EndlessArena.install === "function");
  check("一4 猴子补丁已加载即接线（__arenaWrapped 标记）", Endless.__arenaWrapped === true);

  /* ============ 二、建世界自动注入（祭坛真缺口修复） ============ */
  /* G.player / G.run 桩提前：World.findFreeSpot 内部会读 G.player 位置（避玩家投放） */
  G.player = { x: -9999, y: -9999, r: 12, hp: 40, hpMax: 100,
    heal(p) { this.hp = Math.min(this.hpMax, this.hp + this.hpMax * p); } };
  G.run = { coin: 0, companions: [] };
  G.inEndless = true;
  const w1 = Endless.makeWorld(1600, 1200);
  check("二1 makeWorld 产出无尽世界", w1 && w1.kind === "endless");
  check("二2 祭坛已投放（rollAbyssAltars 真缺口已补）", Array.isArray(w1.altars) && w1.altars.length > 0);
  check("二3 祭坛不含 RIFT（深渊屏蔽白名单生效）", w1.altars.every(a => a.id !== "RIFT"));

  /* ============ 三、奖励节点投放 ============ */
  check("三1 奖励节点数量 = rewardNodes.count", Array.isArray(w1.rewardNodes) && w1.rewardNodes.length === rc.count);
  const kindsOk = w1.rewardNodes.every(n => ["gold", "crystal", "supply"].indexOf(n.kind) >= 0);
  check("三2 节点 kind 全部合法（gold/crystal/supply）", kindsOk);
  const fieldsOk = w1.rewardNodes.every(n =>
    typeof n.id === "string" && n.id.length > 0 && typeof n.x === "number" && typeof n.y === "number" &&
    typeof n.amount === "number" && typeof n.healRatio === "number" &&
    n.radius === rc.radius && n.channel === rc.channel && n.done === false);
  check("三3 节点字段完整（id/x/y/amount/healRatio/radius/channel/done）", fieldsOk);
  check("三4 判定与绘制同源：radius = CFG.endless.rewardNodes.radius（×altarJudgeMul 由判定入口承担）",
    w1.rewardNodes.every(n => n.radius * CFG.altarJudgeMul > n.radius));
  const uniq = new Set(w1.rewardNodes.map(n => n.id));
  check("三5 节点 id 唯一", uniq.size === w1.rewardNodes.length);

  /* ============ 四、gold 进圈拾取（一次结算，不重复） ============ */
  G.player.x = 500; G.player.y = 500;
  Endless.state.crystals = 0; Endless.state.running = true;
  const w2 = Endless.makeWorld(1600, 1200);
  w2.rewardNodes = [{ id: "t-gold", x: 500, y: 500, kind: "gold", amount: 50,
    healRatio: 0, radius: 44, channel: 1.5, done: false }];
  EndlessArena.update(w2, 0.016);
  check("四1 gold 进圈即拾取：G.run.coin += amount", G.run.coin === 50);
  check("四2 拾取后 done = true", w2.rewardNodes[0].done === true);
  EndlessArena.update(w2, 0.016);
  check("四3 二次更新不重复结算（coin 仍为 50）", G.run.coin === 50);

  /* ============ 五、crystal 进圈拾取 ============ */
  const w3 = Endless.makeWorld(1600, 1200);
  w3.rewardNodes = [{ id: "t-cry", x: 500, y: 500, kind: "crystal", amount: 20,
    healRatio: 0, radius: 44, channel: 1.5, done: false }];
  EndlessArena.update(w3, 0.016);
  check("五1 crystal 拾取累加 Endless.state.crystals（结算面板统一入账的现有口径）",
    Endless.state.crystals === 20 && w3.rewardNodes[0].done === true);

  /* ============ 六、supply 读条回血 ============ */
  const w4 = Endless.makeWorld(1600, 1200);
  G.player.hp = 40;
  w4.rewardNodes = [{ id: "t-sup", x: 500, y: 500, kind: "supply", amount: 0,
    healRatio: 0.25, radius: 44, channel: 1.5, done: false }];
  EndlessArena.update(w4, 0.5);
  check("六1 读条未满不生效（0.5s < 1.5s）", w4.rewardNodes[0].done === false && G.player.hp === 40);
  EndlessArena.update(w4, 0.5); EndlessArena.update(w4, 0.5);   // 累计 1.5s → 完成
  check("六2 读条完成按 healRatio 回血（40 → 65）", w4.rewardNodes[0].done === true && G.player.hp === 65);
  EndlessArena.update(w4, 0.5);
  check("六3 补给只生效一次（不重复回血）", G.player.hp === 65);

  /* ============ 七、非深渊世界零影响 ============ */
  const city = { kind: "city", w: 800, h: 600, altars: [] };
  const pRet = EndlessArena.populate(city);
  check("七1 非深渊世界 populate 早退（返回 false）", pRet === false);
  check("七2 主线/主城世界不被注入（无 rewardNodes、altars 不变）",
    city.rewardNodes === undefined && city.altars.length === 0);
  const uRet = EndlessArena.update(city, 0.016);
  check("七3 非深渊世界 update 早退（返回 false，不抛异常）", uRet === false);

  /* ============ 八、猴子补丁幂等 ============ */
  EndlessArena.install(); EndlessArena.install();     // 重复接线
  check("八1 重复 install 标记仍只置一次", Endless.__arenaWrapped === true);
  const w5 = Endless.makeWorld(1600, 1200);
  check("八2 重复包装后建世界不重复投放（祭坛数一致）", w5.altars.length === w1.altars.length);
  check("八3 重复包装后建世界不重复投放（节点数 = count）", w5.rewardNodes.length === rc.count);
  const altarsBefore = w5.altars.length, nodesBefore = w5.rewardNodes.length;
  EndlessArena.populate(w5);                          // 重复 populate 同一世界
  check("八4 重复 populate 幂等（__arenaPopulated 防重，不叠加）",
    w5.altars.length === altarsBefore && w5.rewardNodes.length === nodesBefore);
  EndlessArena.render(null, w5);                      // 渲染空实现：不抛异常
  check("八5 render 空实现安全（无 DOM 依赖，可无头调用）", true);

  console.log("PASS 合计 = " + pass + "  失败 = " + fail);
  if (fail > 0) { process.exitCode = 1; }
`, ctx, { filename: "arena-tests" });
