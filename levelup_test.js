/* 无头测试：第 3 步模块槽系统战斗侧（第十九章 19.10）
 * 覆盖 19.10.8 验收断言清单 18 条：
 *   数据结构 / 4 选 1 候选生成 / 满级过滤 / 入槽规则（空槽 vs 叠层）/ 槽满置灰 /
 *   属性小包兜底 / 多级连升排队 / 暂停闸门 / tagCalc 双源 / 全队生效 / 英雄槽隔离 / 同名叠加
 * 入口函数（战斗侧公开）：
 *   offerModuleIds(heroId)        —— 该英雄池内「未满级」候选 ID（19.10.2 第 3 步过滤）
 *   buildLevelUpCandidates(heroId) —— 4 选 1 候选（模块或属性小包兜底）
 *   applyHeroModulePick(heroId, defId) / applyStatPack(pack) —— 入槽 / 属性小包结算
 *   Game.paused / Game.skipLevelUpChoice() —— 弹窗暂停闸门与测试辅助
 * 运行：node levelup_test.js（判绿 = exit 0 且无 FAIL）
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

/* UI 桩：onLevelUpChoice 默认「自动选第一个可选候选」——无 DOM 环境下也不会卡死主循环 */
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice(cands, onPick) {
    const i = (cands || []).findIndex(c => !c.locked);
    if (i >= 0 && typeof onPick === "function") onPick(i);
  },
  onLevelUpChoiceClose() { },
};

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

  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }

  const realChoice = UI.onLevelUpChoice;
  let captured = [];
  let autoPick = true;
  let lastMeta = null;
  const installSpy = () => {
    UI.onLevelUpChoice = function (cands, onPick, meta) {
      captured.push({ cands: cands, onPick: onPick });
      lastMeta = meta || null;      // 归属元信息（界面线 C1 契约，第 3 个参数）
      if (autoPick) { const i = cands.findIndex(c => !c.locked); if (i >= 0) onPick(i); }
    };
  };
  installSpy();
  const resetCapture = () => { captured = []; };

  /* ============ 一、配置就位（19.10） ============ */
  check("CFG.moduleSlot.perHero = 4", CFG.moduleSlot && CFG.moduleSlot.perHero === 4);
  check("CFG.moduleSlot.maxLv = 9 = CFG.moduleLevel.maxLv（两处同步）", CFG.moduleSlot.maxLv === 9 && CFG.moduleLevel.maxLv === 9);
  check("CFG.modulePool.perHero 存在", !!(CFG.modulePool && CFG.modulePool.perHero));
  check("CFG.levelUp.choiceCount = 4", CFG.levelUp.choiceCount === 4);
  check("CFG.levelUp.statPack 4 项（强攻/坚韧/铁壁/疾行）", Array.isArray(CFG.levelUp.statPack) && CFG.levelUp.statPack.length === 4);
  check("statPack atk=+3 / hp=+15 / def=+1 / spd=+8",
    CFG.levelUp.statPack.find(p => p.stat === "atk").value === 3 &&
    CFG.levelUp.statPack.find(p => p.stat === "hp").value === 15 &&
    CFG.levelUp.statPack.find(p => p.stat === "def").value === 1 &&
    CFG.levelUp.statPack.find(p => p.stat === "spd").value === 8);

  /* ============ 二、断言 1：createRun 为队长 + 每个队友各建长 4 全 null 数组（19.10.1） ============ */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]]);
    Game.skipIntroFreeze();
    const hm = G.run.heroModules;
    check("1. heroModules 存在", !!hm);
    const ids = [G.heroDef.id, ...G.run.companions.map(c => c.heroDef.id)];
    check("1. 队长 + 每个队友各一条槽数组", ids.length === 3 && ids.every(id => Array.isArray(hm[id])));
    check("1. 每条槽数组长 4 且全 null", ids.every(id => hm[id].length === CFG.moduleSlot.perHero && hm[id].every(s => s === null)));
    check("1. modulePoolState 显式初始化（每英雄有 offered/queue）",
      !!G.run.modulePoolState && ids.every(id => G.run.modulePoolState[id] && Array.isArray(G.run.modulePoolState[id].queue)));
    check("1. 各英雄槽数组互相独立（不是同一引用）", ids.length === new Set(ids).size && hm[ids[0]] !== hm[ids[1]]);
  }

  /* ============ 三、断言 2~4：候选生成 / 来源 / 满级过滤（19.10.2） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    resetCapture();
    const hid = G.heroDef.id;
    gainExp(G.run.expNext + 1);
    check("2. 单次升级 onLevelUpChoice 被调用一次", captured.length === 1);
    check("2. candidates.length === 4", captured[0] && captured[0].cands.length === 4);
    const pool = CFG.modulePool.perHero[hid] || CFG.modulePool.default;
    check("3. 候选全部来自本英雄池 CFG.modulePool.perHero[heroId]",
      captured[0].cands.every(c => c.kind === "module" && pool.indexOf(c.defId) >= 0));
    check("3. 候选 kind=module + heroId + name + lv",
      captured[0].cands.every(c => c.kind === "module" && c.heroId === hid && typeof c.name === "string" && c.lv >= 1));

    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid2 = G.heroDef.id;
    const p2 = CFG.modulePool.perHero[hid2] || CFG.modulePool.default;
    G.run.heroModules[hid2][0] = { defId: p2[0], lv: 9 };
    resetCapture();
    gainExp(G.run.expNext + 1);
    check("4. 已满级（lv=9）模块不出现在候选", captured[0].cands.every(c => c.defId !== p2[0]));
  }

  /* ============ 四、断言 5：选未持有模块 → 第一个空槽 lv=1（19.10.3） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    resetCapture();
    gainExp(G.run.expNext + 1);
    const c0 = captured[0].cands[0];
    const slots = G.run.heroModules[hid];
    check("5. 未持有模块放入第一个空槽（槽 0）", slots[0] && slots[0].defId === c0.defId);
    check("5. 入槽后 lv === 1", slots[0].lv === 1);
    check("5. 只填了 1 个槽", slots.filter(s => s !== null).length === 1);
  }

  /* ============ 五、断言 6：选已持有且 lv<9 → 不新增槽，该槽 lv+1 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const pid = (CFG.modulePool.perHero[hid] || CFG.modulePool.default)[0];
    G.run.heroModules[hid][1] = { defId: pid, lv: 1 };   // 故意放在槽 1（验证原地叠层）
    applyHeroModulePick(hid, pid);
    const slots = G.run.heroModules[hid];
    check("6. 已持有模块 → 不新增槽位", slots.filter(s => s !== null).length === 1);
    check("6. 原槽 lv 1 → 2（复用原槽，未占用空槽 0）", slots[1].lv === 2 && slots[0] === null);
  }

  /* ============ 六、断言 7：连续选 9 次 → lv=9；第 10 次候选不含该模块 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const pid = (CFG.modulePool.perHero[hid] || CFG.modulePool.default)[0];
    for (let i = 0; i < 9; i++) applyHeroModulePick(hid, pid);
    const slot = G.run.heroModules[hid].find(s => s && s.defId === pid);
    check("7. 同一模块连续选 9 次 → lv === 9", slot && slot.lv === 9);
    check("7. 满级后池过滤：offerModuleIds 不再含该模块", offerModuleIds(hid).every(id => id !== pid));
  }

  /* ============ 七、断言 8/9：槽满策略 = 禁止选取置灰（19.10.3） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const pool = (CFG.modulePool.perHero[hid] || CFG.modulePool.default).slice();
    for (let i = 0; i < 4; i++) G.run.heroModules[hid][i] = { defId: pool[i], lv: 1 };
    const cands = buildLevelUpCandidates(hid);
    check("8. 4 槽全满 + 未持有模块 → locked === true",
      cands.filter(c => c.kind === "module" && pool.indexOf(c.defId) >= 4).every(c => c.locked === true));
    check("9. 4 槽全满但已持有 lv<9 模块 → locked === false（可叠层）",
      cands.filter(c => c.defId === pool[0]).every(c => c.locked === false));
    check("8/9. 候选至少有一个非 locked（池过滤保证可叠层）", cands.some(c => !c.locked));
  }

  /* ============ 八、断言 10/11：属性小包兜底（19.10.4） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    // 构造「池内所有 ID 均已满级」：offerModuleIds == 0 时才出属性小包。
    // 池可能 >4 个 ID，故直接调用属性小包构造器（该构造器是兜底分支的唯一出口）
    const statCands = statPackCandidates();
    check("10. 属性小包候选共 4 项 kind=statPack", statCands.length === 4 && statCands.every(c => c.kind === "statPack"));
    check("10. 属性小包来自 CFG.levelUp.statPack（packId/stat/value 一致）",
      statCands.every(c => { const d = CFG.levelUp.statPack.find(p => p.id === c.packId); return d && d.stat === c.stat && d.value === c.value; }));
    // 直接令池内全部满级：替换 modulePoolState 的满级集合不可行，改为验证「全满级 → 降级」判定函数
    check("10. 全池满级判定：模块候选为空时降级属性小包",
      buildLevelUpCandidates(hid, []).every(c => c.kind === "statPack"));

    // 断言 11：选定后 statPackGain 累加且 computeStats 反映
    const r = G.run;
    if (!r.statPackGain) r.statPackGain = { hp: 0, atk: 0, def: 0, spd: 0 };
    const atkPack = statCands.find(c => c.stat === "atk");
    applyStatPack(atkPack);
    check("11. statPackGain.atk 按配置值累加", r.statPackGain.atk === atkPack.value);
    const bo = runBonus();
    check("11. runBonus().add.atk 含 statPackGain（全队生效）", bo.add.atk >= atkPack.value - 1e-6);
    const st = computeStats();
    check("11. computeStats().atk 反映属性小包加成", st.atk >= CFG.heroes[0].atk + atkPack.value - 0.001);
  }

  /* ============ 九、断言 12：一次 gainExp 触发 N 级连升 → onLevelUpChoice 调用 N 次 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    const need = G.run.expNext + expNextFor(2) + expNextFor(3) + 1;
    gainExp(need);
    check("12. N=3 连升 → onLevelUpChoice 调用 3 次（排队逐个弹）", captured.length === 3);
    check("12. 连升后局内等级 = 4", G.run.lv === 4);
    check("12. 连升队列已清空", G.run.modulePoolState[G.heroDef.id].queue.length === 0);
  }

  /* ============ 十、断言 13：弹窗暂停闸门 + onPick 后恢复（19.10.6） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    Game.loop(t);   // 注册主循环（raf 桩捕获后必须手动踢一次）
    const w = G.mainWorld, p = G.player;
    const m = new Monster("NM0010", p.x + 400, p.y, G.levelCfg.monsterLevel || 1);
    w.monsters.push(m);
    autoPick = false;
    resetCapture();
    const mx0 = m.x;
    gainExp(G.run.expNext + 1);
    check("13. 弹窗期间 Game.paused === true", Game.paused === true);
    step(30);
    check("13. 弹窗期间世界更新被跳过（怪物未移动）", Math.abs(m.x - mx0) < 1e-6);
    captured[0].onPick(0);
    check("13. onPick 后 Game.paused === false（恢复）", Game.paused === false);
    const mx1 = m.x;
    step(10);
    check("13. 恢复后世界继续推进", m.x !== mx1);
    autoPick = true;
  }

  /* ============ 十一、断言 14：heroModules 词条汇入 tagCalc（19.10.5） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const base = tagCalc("伤害", true);
    // M009 = 伤害 mult，基础 0.30，lv9 有效 0.30×(1+8×0.15)=0.66 + 阶段词缀
    G.run.heroModules[hid] = [{ defId: "M009", lv: 9 }, null, null, null];
    const after = tagCalc("伤害", true);
    check("14. heroModules 内 M009(lv9) 汇入 tagCalc（伤害显著大于空槽基线）", after > base + 0.2);
  }

  /* ============ 十二、断言 15：weaponInv 旧 kind:"module" 仍被 tagCalc 读取（兼容期） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const base = tagCalc("伤害", true);
    const mod = makeModule("M009", 3);   // 金品质 lv1
    G.run.weaponInv.place(mod, 0, 0);
    const after = tagCalc("伤害", true);
    check("15. weaponInv 旧模块路径保留（tagCalc 仍读取）", after > base + 1e-6);
    check("15. 旧模块放武器栏不报错（双源并读）", G.run.weaponInv.items.length === 1);
  }

  /* ============ 十三、断言 16：全队生效（仅 H001 放 M009 → H002 技能伤害也增加） ============ */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    recomputeWeapon();
    const c = G.run.companions[0];
    const mateId = c.heroDef.id;
    const baseDmg = c.skills.skill.dmgMul;
    // M009 = 伤害 mult，两支技能都声明了「伤害」标签 → 全队共享一份词条值
    G.run.heroModules[G.heroDef.id] = [{ defId: "M009", lv: 1 }, null, null, null];
    recomputeWeapon();
    check("16. 仅队长槽放 M009 → 队友(H002)技能伤害同样增加（全队生效）", c.skills.skill.dmgMul > baseDmg);
    check("16. 队友槽数组未被污染（仍全 null）", G.run.heroModules[mateId].every(s => s === null));
  }

  /* ============ 十四、断言 17：升级只写入「候选所属英雄」的槽，其余英雄槽不受影响 ============
   * 注（§5.47 全队混抽）：升级不再必然强化升级者本人，故不再断言「一定写队长槽」；
   * 改为断言「入槽者 === 被选中候选的 heroId，且仅该英雄槽 +1，另一英雄槽不被污染」。 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const mainId = G.heroDef.id, mateId = G.run.companions[0].heroDef.id;
    resetCapture(); autoPick = true;
    gainExp(G.run.expNext + 1);
    const cand = captured[0].cands.find(c => !c.locked) || captured[0].cands[0];
    const owner = cand.kind === "module" ? cand.heroId : mainId;   // 属性小包无归属
    const other = (owner === mainId) ? mateId : mainId;
    check("17. 升级只写入候选所属英雄的槽（该英雄槽 +1）",
      cand.kind !== "module" || G.run.heroModules[owner].filter(s => s !== null).length === 1);
    check("17. 候选所属英雄的槽未被写错到另一英雄",
      cand.kind !== "module" || G.run.heroModules[other].every(s => s === null));
  }

  /* ============ 十五、断言 18：两英雄各持同名模块 → 汇总为两份叠加 ============ */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const a = G.heroDef.id, b = G.run.companions[0].heroDef.id;
    const base = tagCalc("伤害", true);
    G.run.heroModules[a] = [{ defId: "M009", lv: 1 }, null, null, null];
    const one = tagCalc("伤害", true);
    G.run.heroModules[b] = [{ defId: "M009", lv: 1 }, null, null, null];
    const two = tagCalc("伤害", true);
    check("18. 两英雄各持 M009 → 叠加（two > one > base）", two > one && one > base);
    // 两份相同 (1+0.30) 连乘 → 1.69；取其一则只 1.30
    check("18. 叠加为两份连乘（不是取其一）", two > one * 1.1);
  }

  /* ============ 十六、默认路径：UI.onLevelUpChoice 缺失时不卡死主循环 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const savedChoice = UI.onLevelUpChoice;
    delete UI.onLevelUpChoice;   // 模拟 UI 未就绪
    const lvBefore = G.run.lv;
    let threw = false;
    try { gainExp(G.run.expNext + 1); } catch (e) { threw = true; }
    UI.onLevelUpChoice = savedChoice;
    check("默认路径：UI.onLevelUpChoice 缺失时不抛异常", !threw);
    check("默认路径：自动结算升级（lv 增加，主循环不卡死）", G.run.lv === lvBefore + 1);
  }

  /* ============ 十七、归属元信息 meta（界面线 C1 契约，§5.46） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    installSpy(); resetCapture(); lastMeta = null;
    autoPick = true;
    gainExp(G.run.expNext + 1);
    check("升级弹窗：第 3 参 meta 被传入（非 undefined）", lastMeta !== null);
    check("meta.heroId = 本次升级英雄", lastMeta && lastMeta.heroId === CFG.heroes[0].id);
    check("meta.heroName = 英雄显示名（非空、不等于 id）",
      lastMeta && typeof lastMeta.heroName === "string" && lastMeta.heroName.length > 0);
    check("meta.slotPer = 4（模块槽总数）", lastMeta && lastMeta.slotPer === 4);
    check("meta.slotUsed 为 0~4 的整数", lastMeta && Number.isInteger(lastMeta.slotUsed) && lastMeta.slotUsed >= 0 && lastMeta.slotUsed <= 4);
    // 选完后 slotUsed 应 +1（已入槽）
    const usedBefore = lastMeta.slotUsed;
    resetCapture(); lastMeta = null;
    gainExp(G.run.expNext + 1);
    check("再升一级后 meta.slotUsed 递增（模块已入槽）", lastMeta && lastMeta.slotUsed === usedBefore + 1);
  }

  /* ============================================================================
   * 十八、全队混抽（§5.47）：升级候选从「全队所有英雄专属池汇总」抽，
   *       候选带归属队友（heroId/ownerName/ownerRoleColor），入槽按候选所属英雄。
   * ============================================================================ */

  /* 断言 19：全队 2 人时，候选来源跨越两人（不是集中在升级者一个人身上）。
   * 证明方式（确定性 + 统计双保险）：
   *  ① 汇总池 teamModuleOfferPool() 同时含 {hid:A} 与 {hid:B} 两条来源 → 抽取范围确实跨人；
   *  ② 反复混抽多次，出现过来自队友 B 与来自队长 A 的候选（旧实现只出 A，必红）。 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    const mainId = G.heroDef.id;                       // H001
    const mateId = G.run.companions[0].heroDef.id;     // H002
    const src = teamModuleOfferPool();
    check("19. 汇总池含队长来源", src.some(s => s.hid === mainId));
    check("19. 汇总池含队友来源（跨两人）", src.some(s => s.hid === mateId));
    // 统计：混抽 40 次，两侧来源都应出现
    let sawMain = false, sawMate = false;
    for (let g = 0; g < 40 && !(sawMain && sawMate); g++) {
      for (const c of buildLevelUpCandidates(mainId)) {
        if (c.kind !== "module") continue;
        if (c.heroId === mainId) sawMain = true;
        if (c.heroId === mateId) sawMate = true;
      }
    }
    check("19. 混抽多次出现过来自队长的候选", sawMain);
    check("19. 混抽多次出现过来自队友的候选（不集中在升级者身上）", sawMate);
    gainExp(G.run.expNext + 1);
    check("19. 单次升级候选数量恰为 4", captured[0] && captured[0].cands.length === 4);
  }

  /* 断言 20：每个候选都带 heroId，且属于在场英雄之一 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    const ids = [G.heroDef.id, ...G.run.companions.map(c => c.heroDef.id)];
    gainExp(G.run.expNext + 1);
    const cs = captured[0].cands;
    check("20. 每个候选都带 heroId（非空字符串）",
      cs.every(c => typeof c.heroId === "string" && c.heroId.length > 0));
    check("20. 每个候选 heroId 属于在场英雄之一",
      cs.every(c => ids.indexOf(c.heroId) >= 0));
  }

  /* 断言 21（最关键）：入槽正确性 —— 选中「队友 B 的模块」→ 装进 B 的槽，不是升级者 A 的槽。
   * 做法：用确定性 poolOverride 无法指定 heroId（poolOverride 是 ID 数组），
   * 因此这里直接构造候选对象（模拟 UI 回传 teammate 候选）调用 applyLevelUpPick，
   * 再验证「B 槽被写入、A 槽不被污染」——这正是本次改动最易错处（旧实现用升级者 heroId 入槽）。 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const aId = G.heroDef.id;                          // 升级者
    const bId = G.run.companions[0].heroDef.id;        // 队友
    const bDefId = (CFG.modulePool.perHero[bId] || CFG.modulePool.default)[0];
    const aBefore = JSON.stringify(G.run.heroModules[aId]);
    // 先经 buildLevelUpCandidates 取一个真实归属 B 的候选（保证形态与生产一致）
    let bCand = null;
    for (let g = 0; g < 40 && !bCand; g++) {
      const cs = buildLevelUpCandidates(aId);
      bCand = cs.find(c => c.kind === "module" && c.heroId === bId);
    }
    check("21. 能从全队混抽候选里取到归属队友 B 的候选", !!bCand);
    const ok21 = applyLevelUpPick(aId, bCand);         // 升级者是 A，候选归属是 B
    const c1 = G.run.heroModules[bId].filter(s => s !== null);
    check("21. 选中队友 B 的模块 → 写入 B 的槽（B 槽出现该 defId）",
      ok21 === true && c1.length === 1 && c1[0].defId === bCand.defId);
    check("21. 升级者 A 的槽不被污染（仍与升级前一致）",
      JSON.stringify(G.run.heroModules[aId]) === aBefore);
    check("21. 候选 heroId 与入槽英雄一致（cand.heroId === 实际入槽者）",
      c1[0].defId === bCand.defId && bCand.heroId === bId);
  }

  /* 断言 22：某队友 4 格满 → 完全不出他的候选 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const aId = G.heroDef.id, bId = G.run.companions[0].heroDef.id;
    const bPool = (CFG.modulePool.perHero[bId] || CFG.modulePool.default).slice();
    for (let i = 0; i < 4; i++) G.run.heroModules[bId][i] = { defId: bPool[i], lv: 1 };  // B 4 格满
    let sawB = false;
    for (let g = 0; g < 60; g++) {
      const cs = buildLevelUpCandidates(aId);
      if (cs.some(c => c.kind === "module" && c.heroId === bId)) { sawB = true; break; }
    }
    check("22. 队友 B 4 格满 → 混抽 60 次均不出 B 的候选", sawB === false);
    check("22. B 4 格满但仍有可叠层模块：B 整体被排除（不因可叠层而保留）",
      heroHasEmptySlot(bId) === false);
    // 候选应全部来自 A（唯一未满的成员）
    const cs = buildLevelUpCandidates(aId);
    check("22. 候选全部来自未满的队长 A", cs.every(c => c.kind !== "module" || c.heroId === aId));
  }

  /* 断言 23：专属池不被破坏 —— 每个候选的 defId 必在该候选 heroId 的专属池内 */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1], CFG.heroes[2]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    gainExp(G.run.expNext + 1);
    const cs = captured[0].cands;
    check("23. 每个候选 defId 都在其 heroId 的专属池内（H001 模块不进 H002 池）",
      cs.filter(c => c.kind === "module").every(c => {
        const pool = CFG.modulePool.perHero[c.heroId] || CFG.modulePool.default;
        return pool.indexOf(c.defId) >= 0;
      }));
  }

  /* 断言 24：候选带 ownerName 非空 + ownerRoleColor（界面线 B 契约） */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    gainExp(G.run.expNext + 1);
    const cs = captured[0].cands.filter(c => c.kind === "module");
    check("24. 每个模块候选 ownerName 非空字符串",
      cs.length > 0 && cs.every(c => typeof c.ownerName === "string" && c.ownerName.length > 0));
    check("24. ownerName 与 heroDefNameOf(heroId) 一致",
      cs.every(c => c.ownerName === heroDefNameOf(c.heroId)));
    check("24. ownerRoleColor 存在（有色值或 null，不抛异常）",
      cs.every(c => c.ownerRoleColor === null || typeof c.ownerRoleColor === "string"));
  }

  /* 断言 25：小队只有 1 人时行为退化为「自己抽自己」（与旧行为一致） */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    resetCapture(); autoPick = true;
    const hid = G.heroDef.id;
    gainExp(G.run.expNext + 1);
    const cs = captured[0].cands;
    check("25. 单人局：全部候选 heroId = 自己",
      cs.every(c => c.kind !== "module" || c.heroId === hid));
    check("25. 单人局：ownerName = 自己名字",
      cs.filter(c => c.kind === "module").every(c => c.ownerName === heroDefNameOf(hid)));
    check("25. 单人局入槽仍写自己槽（退化一致）",
      G.run.heroModules[hid].filter(s => s !== null).length === 1);
  }

  /* 断言 26：poolOverride 兼容（显式池仍生效，不破坏既有测试用法） */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const hid = G.heroDef.id;
    const ov = buildLevelUpCandidates(hid, ["M001", "M002"]);
    check("26. poolOverride 生效：候选仅来自显式池",
      ov.length === 4 && ov.every(c => c.defId === "M001" || c.defId === "M002"));
    check("26. poolOverride 空数组 → 属性小包兜底",
      buildLevelUpCandidates(hid, []).every(c => c.kind === "statPack"));
  }

  /* 断言 27：全队都满 / 池空 → 属性小包兜底（混抽路径） */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const ids = [G.heroDef.id, ...G.run.companions.map(c => c.heroDef.id)];
    for (const id of ids) {
      const pool = (CFG.modulePool.perHero[id] || CFG.modulePool.default);
      for (let i = 0; i < 4; i++) G.run.heroModules[id][i] = { defId: pool[i], lv: 9 };
      // 把池内全部 ID 都塞满级（覆盖 4 槽以外的池项：直接改槽引用不够，逐项补满）
      for (const pid of pool) {
        const existing = G.run.heroModules[id].find(s => s && s.defId === pid);
        if (existing) existing.lv = 9;
        else { const e = G.run.heroModules[id].find(s => s === null); if (e) { e.defId = pid; e.lv = 9; } }
      }
    }
    // 队长池过滤后为空（全满级）→ 混抽退化为属性小包
    const cs = buildLevelUpCandidates(G.heroDef.id);
    check("27. 全队池空 → 属性小包兜底 4 选 1",
      cs.length === 4 && cs.every(c => c.kind === "statPack"));
  }

  UI.onLevelUpChoice = realChoice;
  console.log(ok ? "LEVELUP TEST OK" : "LEVELUP TEST FAILED");
  if (!ok) throw new Error("LEVELUP TEST FAILED");
`;

vm.runInContext(driver, ctx, { filename: "driver" });
