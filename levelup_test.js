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
  const installSpy = () => {
    UI.onLevelUpChoice = function (cands, onPick) {
      captured.push({ cands: cands, onPick: onPick });
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

  /* ============ 十四、断言 17：队长升级只写队长槽，队友槽不受影响 ============ */
  {
    Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
    Game.skipIntroFreeze();
    const mainId = G.heroDef.id, mateId = G.run.companions[0].heroDef.id;
    const mateBefore = JSON.stringify(G.run.heroModules[mateId]);
    resetCapture(); autoPick = true;
    gainExp(G.run.expNext + 1);
    check("17. 队长升级写入队长槽", G.run.heroModules[mainId].filter(s => s !== null).length === 1);
    check("17. 队友槽数组不受影响", JSON.stringify(G.run.heroModules[mateId]) === mateBefore);
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

  UI.onLevelUpChoice = realChoice;
  console.log(ok ? "LEVELUP TEST OK" : "LEVELUP TEST FAILED");
  if (!ok) throw new Error("LEVELUP TEST FAILED");
`;

vm.runInContext(driver, ctx, { filename: "driver" });
