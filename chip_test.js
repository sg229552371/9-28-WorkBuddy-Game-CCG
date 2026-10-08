/* 无头测试：第 4 步芯片系统战斗侧（第十九章 19.11）
 * 覆盖 19.11.9 验收断言清单 20 条：
 *   数据结构 / makeChip 生成器 / 品质映射 / 开箱掉落 / 入包与 pendingItems /
 *   统一词条链（三源叠加 + 行为芯片不进链）/ resolveSkill 透传 behavior / max 叠加 /
 *   merge·reroll·craft 三服务 / shopBuyChip 契约 / 不折算 / 不参与死亡损失 / 计入负重 / 图鉴
 * 运行：node chip_test.js（判绿 = exit 0 且无 FAIL）
 */
"use strict";

/* ---- DOM / Canvas 桩（与 exp_test 同款） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { ctxCalls.push([p, a]); };
  },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
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
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.__toastCalls = 0;
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { global.__toastCalls++; }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice(c, cb) { const i = (c || []).findIndex(x => !x.locked); if (i >= 0 && cb) cb(i); },
  onLevelUpChoiceClose() { },
};

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
  const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6);
  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  /* ============ 一、配置就位（19.11） ============ */
  check("CFG.chips.grid = 6×5", CFG.chips.grid.cols === 6 && CFG.chips.grid.rows === 5);
  check("CFG.chips.valuePool / behaviorPool 就位", CFG.chips.valuePool.length >= 1 && CFG.chips.behaviorPool.length >= 1);
  check("CFG.chipSources.chest.weight = 26", CFG.chipSources.chest.weight === 26);
  check("CFG.chipForge.services 三项（merge/reroll/craft）",
    !!(CFG.chipForge.services.merge && CFG.chipForge.services.reroll && CFG.chipForge.services.craft));
  check("CFG.chips.weightMul 存在（全局系数）", CFG.chips.weightMul != null);

  /* ============ 二、断言 1：createRun 建 6×5 chipInv（id=chip） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const ci = G.run.chipInv;
    check("1. chipInv 存在且尺寸 = CFG.chips.grid", ci && ci.cols === CFG.chips.grid.cols && ci.rows === CFG.chips.grid.rows);
    check("1. chipInv.id === 'chip'", ci.id === "chip");
    check("1. chipInv 独立容器（与 weaponInv 不同实例）", ci !== G.run.weaponInv);
  }

  /* ============ 三、断言 2/4：makeChip 数值分支 + 品质映射（19.11.2） ============ */
  {
    const def = CFG.chips.valuePool.find(d => d.id === "C_V_DMG");
    for (let q = 0; q < 4; q++) {
      const ch = makeChip("C_V_DMG", q);
      check("2. makeChip('C_V_DMG'," + q + ").value === vals[q] (" + def.vals[q] + ")", near(ch.value, def.vals[q]));
    }
    const c0 = makeChip("C_V_DMG", 0), c1 = makeChip("C_V_DMG", 1);
    check("2. q∈{0,1} 带 affix 无 behavior", !!(c0.affix && !c0.behavior) && !!(c1.affix && !c1.behavior));
    check("2. 数值芯片 kind='chip' 且 shape = shapes.value", c0.kind === "chip" && c0.shape[0] === CFG.chips.shapes.value[0] && c0.shape[1] === CFG.chips.shapes.value[1]);
    check("2. 数值芯片 affix.tag/mode 来自定义", c0.affix.tag === def.tag && c0.affix.mode === def.mode);
    check("4. 品质映射 qualityMode：q0/q1=value，q2/q3=behavior",
      CFG.chips.qualityMode[0] === "value" && CFG.chips.qualityMode[1] === "value" &&
      CFG.chips.qualityMode[2] === "behavior" && CFG.chips.qualityMode[3] === "behavior");
  }

  /* ============ 四、断言 3：makeChip 行为分支（紫/金） ============ */
  {
    const b = makeChip("C_B_BURN", 2);
    check("3. makeChip('C_B_BURN',2) 带 behavior='burn'", b.behavior === "burn");
    check("3. 行为芯片 shape = shapes.behavior (2×1)", b.shape[0] === CFG.chips.shapes.behavior[0] && b.shape[1] === CFG.chips.shapes.behavior[1]);
    check("3. 行为芯片无 affix（不进数值链）", !b.affix);
    const bd = CFG.chips.behaviorPool.find(d => d.id === "C_B_BURN");
    check("3. 行为芯片 value === vals[q] (" + bd.vals[2] + ")", b.value === bd.vals[2]);
  }

  /* ============ 五、断言 5/6：开箱掉落 + 入包 / 满则 pendingItems（19.11.3） ============ */
  {
    // 统计容差：多次调用 rollChestChip 判定，芯片出现频率 ≈ weight 占比。
    // 用「必定掉落」开关验证入包分支：直接调 makeChip + grantChipToRun
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    const chip = makeChip("C_V_DMG", 1);
    const placed = grantChipToRun(r, chip);
    check("6. 芯片入 chipInv（返回 true + items 含该芯片）", placed === true && r.chipInv.items.indexOf(chip) >= 0);
    // 塞满 chipInv（30 格 × 全 1×1）→ 再放 → pendingItems
    r.chipInv.cells.fill(null); r.chipInv.items = [];
    for (let i = 0; i < 30; i++) { const f = makeChip("C_V_DMG", 0); f.shape = [1, 1]; r.chipInv.place(f, i % 6, Math.floor(i / 6)); }
    const chip2 = makeChip("C_V_DMG", 1);
    const placed2 = grantChipToRun(r, chip2);
    check("6. chipInv 满 → 入 pendingItems（不丢失）", placed2 === false && r.pendingItems.indexOf(chip2) >= 0);
  }
  {
    // 开箱判定权重：rollChestChip(rng) 返回芯片或 null；用固定 rng 序列验证阈值
    // weight 26，开箱总权重参照 chestContents…… 简化：rollChestChip 内部按 CFG.chipSources.chest.weight 判定
    let hits = 0, N = 4000;
    const seed = { s: 12345 };
    const rng = () => { seed.s = (seed.s * 1103515245 + 12345) & 0x7fffffff; return seed.s / 0x7fffffff; };
    for (let i = 0; i < N; i++) { if (rollChestChip(rng)) hits++; }
    const ratio = hits / N;
    check("5. 开箱芯片出现频率 ≈ chest.weight 占比（统计容差 0.05~0.5）", ratio > 0.05 && ratio < 0.5);
  }

  /* ============ 六、断言 7：数值芯片进 tagCalc ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const base = tagCalc("伤害", true);
    const chip = makeChip("C_V_DMG", 3);   // +45%
    const s = G.run.chipInv.findSpot(chip);
    G.run.chipInv.place(chip, s.x, s.y);
    const after = tagCalc("伤害", true);
    check("7. 放入 C_V_DMG(q3) → tagCalc('伤害') 显著高于基线", after > base + 0.3);
  }

  /* ============ 七、断言 8：三源叠加（weaponInv + heroModules + chipInv，先加后乘） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const t = CFG.affixTags["伤害"];
    const ml = CFG.moduleLevel;
    const stageMul = (lv) => {   // forSkill=true 时按阶段词缀（伤害 mult 0.06 / 阶段）
      const stage = Math.min(3, Math.ceil(lv / ml.perStage));
      let m = 1;
      for (let i = 0; i < stage; i++) { const sa = ml.stageAffixes[i]; if (sa && sa.tag === "伤害" && sa.mode === "mult") m *= (1 + sa.value); }
      return m;
    };
    const clamp = (v) => Math.min(t.max, Math.max(t.min, v));
    const base = tagCalc("伤害", true);
    // 源① weaponInv 旧模块：M009 itemQ=3 → vals[3]=0.30，lv1
    const m = makeModule("M009", 3);
    G.run.weaponInv.place(m, 0, 0);
    const v1 = tagCalc("伤害", true);
    // 源② heroModules：M009 lv1 → vals[0]=0.10
    G.run.heroModules[hid] = [{ defId: "M009", lv: 1 }, null, null, null];
    const v2 = tagCalc("伤害", true);
    // 源③ chipInv：C_V_DMG q0 → vals[0]=0.12
    const chip = makeChip("C_V_DMG", 0);
    const s = G.run.chipInv.findSpot(chip);
    G.run.chipInv.place(chip, s.x, s.y);
    const v3 = tagCalc("伤害", true);
    // 三段均满足「先加算后乘算」：v = clamp(t.base × Π(1+eff) × Π(阶段词缀))
    const want1 = clamp(t.base * (1 + 0.30) * stageMul(1));
    const want2 = clamp(t.base * (1 + 0.30) * (1 + 0.10) * stageMul(1) * stageMul(1));
    const want3 = clamp(t.base * (1 + 0.30) * (1 + 0.10) * (1 + 0.12) * stageMul(1) * stageMul(1));
    check("8. 三源叠加：weaponInv 旧模块生效（符合手算）", near(v1, want1, 1e-6));
    check("8. 三源叠加：+ heroModules 生效（符合手算）", near(v2, want2, 1e-6));
    check("8. 三源叠加：+ chipInv 数值芯片生效（数值符合手算）", near(v3, want3, 1e-6));
    check("8. 三者叠加 base < v1 < v2 < v3", base < v1 && v1 < v2 && v2 < v3);
  }

  /* ============ 八、断言 9：行为芯片不进 tagCalc ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const base = tagCalc("伤害", true);
    const b = makeChip("C_B_BURN", 3);
    const s = G.run.chipInv.findSpot(b);
    G.run.chipInv.place(b, s.x, s.y);
    const after = tagCalc("伤害", true);
    check("9. 放入行为芯片 C_B_BURN → tagCalc 数值不变", near(after, base));
  }

  /* ============ 九、断言 10/11：resolveSkill 透传 behavior + 同类取 max ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const skId = CFG.weapons[G.heroDef.weapon].skills.skill;
    const syn = moduleSynergy();
    // 无行为芯片：behavior 为 null/undefined
    let res = resolveSkill(CFG.skills[skId], 1, syn);
    check("10. 无行为芯片时 resolveSkill.behavior 为空", !res.behavior);
    const b = makeChip("C_B_BURN", 2);   // burn q2 -> vals[2]=8
    const s = G.run.chipInv.findSpot(b);
    G.run.chipInv.place(b, s.x, s.y);
    res = resolveSkill(CFG.skills[skId], 1, syn);
    check("10. 放入 C_B_BURN → resolveSkill 结果透传 behavior.type='burn'", res.behavior && res.behavior.type === "burn");
    check("10. behavior.value === vals[q]（8）", res.behavior.value === 8);
    // 多枚同类 → max
    const b2 = makeChip("C_B_BURN", 3);   // vals[3]=12
    const s2 = G.run.chipInv.findSpot(b2);
    G.run.chipInv.place(b2, s2.x, s2.y);
    res = resolveSkill(CFG.skills[skId], 1, syn);
    check("11. 多枚同类行为芯片 → behavior.value 取 max（12，不叠乘）", res.behavior.value === 12);
  }

  /* ============ 十、断言 12/13：merge 服务（同名同品质 → lv+1；满级/金币不足拒绝） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    G.inArtisan = true;         // 芯片工坊服务仅工匠世界可用（19.11.6）
    r.coin = 9999;
    r.chipInv.cells.fill(null); r.chipInv.items = [];
    const a = makeChip("C_V_DMG", 1), b = makeChip("C_V_DMG", 1);
    r.chipInv.place(a, 0, 0); r.chipInv.place(b, 1, 0);
    const before = r.coin;
    const ret = Game.chipForge("merge", { uid: a.uid });
    check("12. merge 2 枚同名同品质 → ok:true", ret.ok === true);
    check("12. merge 后目标 lv +1（=2）", a.lv === 2);
    check("12. merge 消耗被合芯片（b 已移除）", r.chipInv.items.indexOf(b) < 0);
    check("12. merge 扣除 merge 费用", r.coin === before - CFG.chipForge.services.merge.cost);
    // 满级 9 → 拒绝
    a.lv = 9;
    const c = makeChip("C_V_DMG", 1); r.chipInv.place(c, 2, 0);
    const ret2 = Game.chipForge("merge", { uid: a.uid });
    check("12. merge 目标已满级 9 → {ok:false}", ret2.ok === false);
    // 金币不足 → 拒绝且不改芯片
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    G.inArtisan = true;
    const r2 = G.run; r2.coin = 0;
    const d = makeChip("C_V_DMG", 1), e = makeChip("C_V_DMG", 1);
    r2.chipInv.place(d, 0, 0); r2.chipInv.place(e, 1, 0);
    const ret3 = Game.chipForge("merge", { uid: d.uid });
    check("13. merge 金币不足 → {ok:false, msg}", ret3.ok === false && typeof ret3.msg === "string");
    check("13. 金币不足时不改变芯片（lv 仍 1，两枚都在）", d.lv === 1 && r2.chipInv.items.indexOf(e) >= 0);
  }

  /* ============ 十一、断言 14：reroll（defId/tag/behavior 不变，value 取 vals[新q]） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run; r.coin = 9999; G.inArtisan = true;
    const chip = makeChip("C_V_DMG", 1);
    r.chipInv.place(chip, 0, 0);
    const defId0 = chip.defId, tag0 = chip.affix.tag;
    const ret = Game.chipForge("reroll", { uid: chip.uid });
    check("14. reroll → ok:true", ret.ok === true);
    check("14. reroll 保留 defId", chip.defId === defId0);
    check("14. reroll 保留 tag", chip.affix.tag === tag0);
    const def = CFG.chips.valuePool.find(d => d.id === defId0);
    check("14. reroll 后 value 取自 vals[品质档]（∈ vals 集合）", def.vals.indexOf(chip.value) >= 0);
    // 行为芯片 reroll：behavior 不变
    const bc = makeChip("C_B_BURN", 2);
    r.chipInv.place(bc, 2, 0);
    Game.chipForge("reroll", { uid: bc.uid });
    check("14. 行为芯片 reroll 保留 behavior", bc.behavior === "burn" && CFG.chips.behaviorPool.find(d => d.id === "C_B_BURN").vals.indexOf(bc.value) >= 0);
  }

  /* ============ 十二、断言 15：craft（消耗金币 → 生成指定 defId） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run; r.coin = 9999; G.inArtisan = true;
    const before = r.chipInv.items.length, coin0 = r.coin;
    const ret = Game.chipForge("craft", { defId: "C_V_CD" });
    check("15. craft → ok:true", ret.ok === true);
    check("15. craft 扣 craft.cost 金币", r.coin === coin0 - CFG.chipForge.services.craft.cost);
    check("15. craft 生成指定 defId 芯片入 chipInv", r.chipInv.items.length === before + 1 && r.chipInv.items.some(c => c.defId === "C_V_CD"));
  }

  /* ============ 十三、断言 16：shopBuyChip 契约（{ok,msg}，不调 UI.toast） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    G.inArtisan = true;
    r.coin = 9999;
    const toast0 = global.__toastCalls;
    const ret = shopBuyChip();
    check("16. shopBuyChip 返回 {ok:true, msg}", ret.ok === true && typeof ret.msg === "string");
    check("16. shopBuyChip 不调 UI.toast（沿用 §5.25）", global.__toastCalls === toast0);
    // 金币不足
    r.coin = 0;
    const ret2 = shopBuyChip();
    check("16. shopBuyChip 金币不足 → {ok:false, msg}", ret2.ok === false && typeof ret2.msg === "string");
    G.inArtisan = false;
  }

  /* ============ 十四、断言 17：calcSettleConvert 不含芯片 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    r.backpack.cells.fill(null); r.backpack.items = [];
    r.weaponInv.cells.fill(null); r.weaponInv.items = [];
    const base = calcSettleConvert(r);
    const chip = makeChip("C_V_DMG", 3);
    r.chipInv.place(chip, 0, 0);
    const after = calcSettleConvert(r);
    check("17. chipInv 内芯片不产生折算价值（total 不变）", after.total === base.total);
  }

  /* ============ 十五、断言 18：死亡惩罚不含芯片（芯片数两场景一致） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    const chip = makeChip("C_V_DMG", 1);
    r.chipInv.place(chip, 0, 0);
    const n0 = r.chipInv.items.length;
    calcDeathPenalty(r);   // 死亡结算不应动芯片
    check("18. 死亡惩罚后芯片数不变（不参与 loseRatio 0.7）", r.chipInv.items.length === n0);
    check("18. 死亡损失清单不含芯片", !(calcDeathPenalty(r).lost || []).some(it => it.kind === "chip"));
  }

  /* ============ 十六、断言 19：芯片计入 totalWeight（19.11.8 公式） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    r.backpack.cells.fill(null); r.backpack.items = [];
    const w0 = totalRunWeight();
    const q = 2;
    const chip = makeChip("C_V_DMG", q);
    r.chipInv.place(chip, 0, 0);
    const w1 = totalRunWeight();
    const mul = CFG.chips.weightMul != null ? CFG.chips.weightMul : 1;
    check("19. 放入芯片后总重增加", w1 > w0);
    check("19. 数值芯片重量 = (q+1) × weightMul（q=2 → " + ((q + 1) * mul) + "）", near(w1 - w0, (q + 1) * mul));
    // 行为芯片重量 = (q+1)×2
    r.chipInv.cells.fill(null); r.chipInv.items = [];
    const w2 = totalRunWeight();
    const bc = makeChip("C_B_BURN", 2);
    r.chipInv.place(bc, 0, 0);
    check("19. 行为芯片重量 = (q+1)×2 × weightMul（q=2 → " + ((q + 1) * 2 * mul) + "）", near(totalRunWeight() - w2, (q + 1) * 2 * mul));
  }

  /* ============ 十七、断言 20：chipCodex 记录已见，不改属性/折算 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const r = G.run;
    const before = tagCalc("伤害", true);
    const c1 = calcSettleConvert(r).total;
    const chip = makeChip("C_V_DMG", 1);
    seenChip(chip);        // 记录到图鉴（局外 Meta）
    check("20. chipCodex 记录已见芯片", chipSeen("C_V_DMG") === true || (Meta.data.chipSeen && Meta.data.chipSeen["C_V_DMG"] === true));
    check("20. 图鉴记录不改变 tagCalc 数值", near(tagCalc("伤害", true), before));
    check("20. 图鉴记录不改变折算价值", calcSettleConvert(r).total === c1);
    check("20. CFG.chipCodex.collectOnly = true（无属性加成）", CFG.chipCodex.collectOnly === true && CFG.chipCodex.permanent === false);
  }

  console.log(ok ? "CHIP TEST OK" : "CHIP TEST FAILED");
  if (!ok) throw new Error("CHIP TEST FAILED");
`;

vm.runInContext(driver, ctx, { filename: "driver" });
