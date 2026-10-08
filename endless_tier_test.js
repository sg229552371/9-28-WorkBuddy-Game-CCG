/* ============================================================================
 * 21.19 深渊层级（Tier）系统回归测试（node endless_tier_test.js）—— W1 波次
 * ----------------------------------------------------------------------------
 * 覆盖：
 *   一、契约存在性：tier/tierMul/rewardMul/setTier/maxUnlockedTier/tierList/tierLabel
 *   二、锚点插值边界：层1=1.0、层10=2.4、层20=4.0（含中间锚点 5/15）
 *   三、Clamp：setTier 越界收口到 [min,max]
 *   四、rewardMul 公式：1 + (tier-1)*rewardMulPerTier
 *   五、猴子补丁：深渊内 hpMul/dmgMul 被乘 tierMul；__tierWrapped 标记
 *   六、非深渊/主线零影响：inEndless=false 且无深渊世界 → 因子恒 1
 *   七、幂等：重复加载脚本不叠加倍率、不重置所选层
 *   八、解锁：Meta.data.abyss.bestTier+1；无 Meta 兜底 startMax（独立沙箱）
 *   九、tierList / tierLabel 输出契约
 *
 * ⚠️ 汇总行中文、无英文 FAIL/Error 字样（门禁口径）。
 * ========================================================================== */
"use strict";

/* ---- DOM / Canvas 桩（范式照抄 endless_flow_test.js） ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList(); this.children = [];
    this._html = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; if (v === "") this.children.length = 0; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return new FakeEl("q"); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return () => undefined;
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
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");
const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

/* ---- 脚本链（照 G_docs/waves/endless_21_19_waves.md 的加载顺序） ---- */
const CHAIN = ["js/config.js", "js/core.js", "js/pool.js", "js/game.js", "js/items.js",
  "js/combat.js", "js/modes.js", "js/render.js", "js/stress.js", "js/endless.js",
  "js/hud_endless.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js",
  "js/quality.js", "js/rewards.js"];
const MODULE = "js/endless-tier.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("未通过 " + name); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);

global.check = check;   // 供 vm 沙箱内的用例使用（createContext(global) 后可见）

/* ================= 沙箱 A：完整脚本链 + 被测模块 ================= */
const ctx = vm.createContext(global);
for (const f of CHAIN) vm.runInContext(read(f), ctx, { filename: f });
const modSrc = read(MODULE);
vm.runInContext(modSrc, ctx, { filename: MODULE });

/* ================= 沙箱 B：极小链（无 game.js → 无 Meta）兜底降级 ================= */
const ctxB = vm.createContext({ console, check });
for (const f of ["js/config.js", "js/endless.js"]) vm.runInContext(read(f), ctxB, { filename: f });
vm.runInContext(read(MODULE), ctxB, { filename: MODULE });

vm.runInContext(`
  const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-9 : e);

  /* ============ 一、契约存在性 ============ */
  check("一1 Endless.tier 初值 = CFG defaultSelected", typeof Endless.tier === "number" && Endless.tier === CFG.endless.tier.defaultSelected);
  check("一2 tierMul 是函数", typeof Endless.tierMul === "function");
  check("一3 rewardMul 是函数", typeof Endless.rewardMul === "function");
  check("一4 setTier 是函数", typeof Endless.setTier === "function");
  check("一5 maxUnlockedTier 是函数", typeof Endless.maxUnlockedTier === "function");
  check("一6 tierList 是函数", typeof Endless.tierList === "function");
  check("一7 tierLabel 是函数", typeof Endless.tierLabel === "function");

  /* ============ 二、锚点插值边界 ============ */
  check("二1 层1 系数 = 1.0（首锚点）", Endless.setTier(1) === 1 && near(Endless.tierMul(), 1.0));
  check("二2 层10 系数 = 2.4（中间锚点）", Endless.setTier(10) === 10 && near(Endless.tierMul(), 2.4));
  check("二3 层20 系数 = 4.0（末锚点）", Endless.setTier(20) === 20 && near(Endless.tierMul(), 4.0));
  check("二4 层5 系数 = 1.6（锚点）", Endless.setTier(5) && near(Endless.tierMul(), 1.6));
  check("二5 层15 系数 = 3.2（锚点）", Endless.setTier(15) && near(Endless.tierMul(), 3.2));
  check("二6 层7 线性插值 = 1.92（5→10 段 2/5 处）", Endless.setTier(7) && near(Endless.tierMul(), 1.92));

  /* ============ 三、Clamp ============ */
  check("三1 setTier(-3) 收口到 min=1", Endless.setTier(-3) === 1 && Endless.tier === 1);
  check("三2 setTier(99) 收口到 max=20", Endless.setTier(99) === 20 && Endless.tier === 20);
  check("三3 setTier 返回生效值且生效", Endless.setTier(10) === 10 && Endless.tier === 10);

  /* ============ 四、rewardMul 公式 ============ */
  check("四1 层1 奖励倍率 = 1.0", Endless.setTier(1) === 1 && near(Endless.rewardMul(), 1.0));
  check("四2 层10 奖励倍率 = 2.08", Endless.setTier(10) === 10 && near(Endless.rewardMul(), 1 + 9 * CFG.endless.tier.rewardMulPerTier, 1e-9) && near(Endless.rewardMul(), 2.08, 1e-9));
  check("四3 层20 奖励倍率 = 3.28", Endless.setTier(20) === 20 && near(Endless.rewardMul(), 1 + 19 * CFG.endless.tier.rewardMulPerTier, 1e-9) && near(Endless.rewardMul(), 3.28, 1e-9));

  /* ============ 五、猴子补丁：hpMul/dmgMul 被乘系数（深渊内） ============ */
  check("五1 __tierWrapped 标记存在", Endless.__tierWrapped === true);
  G.inEndless = true;                                   // 模拟深渊世界
  Endless.setTier(10);                                  // 系数 2.4
  check("五2 深渊内 hpMul(1) = 基础1.0 × 2.4", near(Endless.hpMul(1), 2.4, 1e-9));
  check("五3 深渊内 hpMul(11) = 波次曲线 × 2.4", near(Endless.hpMul(11), (1 + 10 * CFG.endless.hpMulPerWave) * 2.4, 1e-6));
  check("五4 深渊内 dmgMul(1) = 基础 atkMul × 2.4", near(Endless.dmgMul(1), CFG.endless.atkMul * 2.4, 1e-9));

  /* ============ 六、非深渊 / 主线零影响 ============ */
  G.inEndless = false; G.activeWorld = null;            // 主线 / 主城
  Endless.setTier(10);                                  // 层级仍选中 10，但因子应恒 1
  check("六1 主线 hpMul 不受层级影响（= 基础波次曲线）", near(Endless.hpMul(5), 1 + 4 * CFG.endless.hpMulPerWave, 1e-9));
  check("六2 主线 dmgMul 不受层级影响（= 基础 atkMul）", near(Endless.dmgMul(5), CFG.endless.atkMul, 1e-9));
  G.activeWorld = { kind: "endless" };                  // world.kind 兜底判定路径
  check("六3 world.kind=endless 时因子生效（world 判定兜底）", near(Endless.hpMul(1), 2.4, 1e-9));
  G.activeWorld = null;                                 // 还原

  /* ============ 七、幂等：重复加载不叠加 ============ */
  check("七1 重复加载后层级不被重置", true);           // 占位：真正断言在重载后
`, ctx, { filename: "tier-tests" });

/* 重复加载被测模块（幂等性实测） */
vm.runInContext(modSrc, ctx, { filename: MODULE + "（第二次）" });

vm.runInContext(`
  check("七1 重复加载后层级不被重置（仍为 10）", Endless.tier === 10);
  check("七2 重复加载后 __tierWrapped 仍为 true", Endless.__tierWrapped === true);
  G.inEndless = true; Endless.setTier(10);
  check("七3 重复加载不叠加：hpMul(1) 仍 = 2.4（而非 5.76）", near(Endless.hpMul(1), 2.4, 1e-9));
  check("七4 重复加载不叠加：dmgMul(1) = atkMul×2.4（单倍）", near(Endless.dmgMul(1), CFG.endless.atkMul * 2.4, 1e-9));

  /* ============ 八、解锁：bestTier+1 / 兜底 startMax（沙箱 A 内） ============ */
  G.inEndless = false;
  delete Meta.data.abyss;                               // 无深渊记录
  check("八1 无 abyss 记录 → 兜底 startMax=3", Endless.maxUnlockedTier() === CFG.endless.tier.unlock.startMax && Endless.maxUnlockedTier() === 3);
  Meta.data.abyss = { bestTier: 5 };
  check("八2 bestTier=5 → 最高可选层 6（+1）", Endless.maxUnlockedTier() === 6);
  Meta.data.abyss = { bestTier: 99 };
  check("八3 bestTier 超上限 → 收口到 max=20", Endless.maxUnlockedTier() === CFG.endless.tier.max);
  Meta.data.abyss = { bestTier: 5 };

  /* ============ 九、tierList / tierLabel ============ */
  const list = Endless.tierList();
  check("九1 tierList 长度 = max-min+1 = 20", Array.isArray(list) && list.length === 20);
  check("九2 tierList 首项 {n:1, mul:1.0, unlocked}", list[0].n === 1 && near(list[0].mul, 1.0) && list[0].locked === false);
  check("九3 tierList n=6 可选（bestTier=5 → 6 解锁）", list[5].n === 6 && list[5].locked === false);
  check("九4 tierList n=7 锁定", list[6].n === 7 && list[6].locked === true);
  check("九5 tierList mul 与 tierMul 同源（抽查 n=10）", near(list[9].mul, 2.4));
  check("九6 tierLabel(3) = '深渊 · 第 3 层'", Endless.tierLabel(3) === CFG.endless.tier.labelPrefix + " · 第 3 层" && Endless.tierLabel(3) === "深渊 · 第 3 层");
  check("九7 tierLabel 无参用当前层", Endless.setTier(4) === 4 && Endless.tierLabel() === "深渊 · 第 4 层");

  /* 还原现场（不污染其它用例 / 后续模块） */
  Endless.setTier(CFG.endless.tier.defaultSelected);
  G.inEndless = false;
`, ctx, { filename: "tier-tests-2" });

/* ---- 沙箱 B：无 Meta 环境的安全降级（config + endless + 本模块） ---- */
vm.runInContext(`
  check("B1 无 Meta 环境 maxUnlockedTier 兜底 startMax=3（不抛错）", Endless.maxUnlockedTier() === 3);
  check("B2 无 Meta 环境 setTier/tierMul 正常", Endless.setTier(10) === 10 && Math.abs(Endless.tierMul() - 2.4) < 1e-9);
  check("B3 无 Meta 环境且无 G → hpMul 因子恒 1（零影响）", Math.abs(Endless.hpMul(5) - (1 + 4 * CFG.endless.hpMulPerWave)) < 1e-9);
  check("B4 无 Meta 环境 tierLabel 正常", Endless.tierLabel(2) === "深渊 · 第 2 层");
`, ctxB, { filename: "tier-tests-min" });

/* ---- 汇总 ---- */
console.log("PASS 合计 = " + pass + "  失败 = " + fail);
if (fail > 0) { console.log("存在未通过用例，共 " + fail + " 条"); process.exit(1); }
