/* 无头测试：SkillReward 奖励事务（node skill_reward_test.js）
 * 覆盖合同 §12/§17：合并池去重与权重 max、空槽新装/同 ID 升级/满槽只出升级/满级移出、
 * 无候选属性兜底且显示实际数量、重复提交只生效一次、取消后随机状态不变、
 * 雕像候选形态冲突过滤与兜底、提交失败不消耗奖励。 */
"use strict";

/* ---- 最小 DOM 桩（与既有测试一致；本模块不碰 DOM，但保持上下文干净）---- */
const ctxProxy = new Proxy({}, {
  get(t, p) { if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(4) }); if (p in t) return t[p]; return () => undefined; },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) { this.tag = tag; this.style = {}; this.dataset = {}; this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false }; this.children = []; this.innerHTML = ""; }
  appendChild(c) { this.children.push(c); } remove() { } addEventListener() { } getContext() { return ctxProxy; } querySelector() { return null; } querySelectorAll() { return []; }
}
global.document = { getElementById() { return new FakeEl("div"); }, createElement(t) { return new FakeEl(t); }, addEventListener() { }, querySelectorAll: () => [] };
global.window = { addEventListener() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/skill-config.js", "js/skill-compiler.js", "js/skill-reward.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  let passCount = 0, failCount = 0;
  const check = (name, cond) => { if (cond) { passCount++; console.log("PASS " + name); } else { failCount++; console.log("FAIL " + name); } };

  /* 固定种子随机源（mulberry32；带 state() 供 randomState 复现）*/
  function makeRng(seed) {
    let s = seed >>> 0;
    const f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.state = function () { return s >>> 0; };
    return f;
  }

  /* ---- 装配测试用配置表（不污染真实 CFG 定义，只填最小结构）---- */
  const SS = CFG.skillSystem;
  SS.configVersion = "skill-test-1.0";
  SS.slotCount = 4;
  SS.maxSkillsPerHero = 2;
  SS.qualityDefs = [ { id: "Q_COMMON", appearWeight: 1 }, { id: "Q_RARE", appearWeight: 2 } ];
  SS.crystalDefs = {
    CR_A: { id: "CR_A", qualityId: "Q_COMMON", levels: [{}, {}] },          // maxLv 2
    CR_B: { id: "CR_B", qualityId: "Q_COMMON", levels: [{}] },              // maxLv 1
    CR_C: { id: "CR_C", qualityId: "Q_RARE", levels: [{}, {}] },            // maxLv 2 / 稀有
    CR_FULL: { id: "CR_FULL", qualityId: "Q_COMMON", levels: [{}] },        // maxLv 1
    CR_CONFLICT: { id: "CR_CONFLICT", qualityId: "Q_COMMON", levels: [{}] },
    CR_NEW: { id: "CR_NEW", qualityId: "Q_COMMON", levels: [{}, {}] },
  };
  SS.rewardPools = {
    POOL_A: { id: "POOL_A", sources: ["levelup"], weights: { CR_A: 1, CR_B: 5, CR_C: 3, CR_FULL: 1 } },
    POOL_B: { id: "POOL_B", sources: ["levelup"], weights: { CR_A: 4, CR_B: 1, CR_C: 1 } },
    POOL_FT: { id: "POOL_FT", sources: ["fulltest"], weights: { CR_A: 1, CR_B: 1, CR_C: 1, CR_FULL: 1, CR_NEW: 5 } },
  };
  /* 组合模拟桩：CR_CONFLICT 与已装形态冲突 */
  const mockPreview = function (state, change) {
    if (change && change.crystalId === "CR_CONFLICT") return { legal: false, nextGroup: state, result: null, reasonCodes: ["MOTION_CONFLICT"] };
    if (change && change.kind === "installSkill" && change.skillId === "SK_BAD") return { legal: false, nextGroup: state, result: null, reasonCodes: ["MOTION_CONFLICT"] };
    return { legal: true, nextGroup: state, result: null, reasonCodes: [] };
  };
  SS.rewardPolicies = {
    optionCount: 3, weightMerge: "max",
    attrFallback: [ { attr: "atk", value: 5 }, { attr: "hp", value: 20 }, { attr: "def", value: 3 } ],
    previewFn: mockPreview,
    rareSkillPool: ["SK_OK", "SK_BAD"], skillWeights: { SK_OK: 1, SK_BAD: 1 },
    statueProb: 1, duplicateStatueHandling: "attrFallback",
  };
  const R = SKILL_REASON;

  const mkState = (crystals, skills, gv) => ({ heroId: "H001", slotCount: 4, skills: skills || { SK_FIREBALL: { id: "SK_FIREBALL", level: 1, cd: 1, cdLeft: 0 } }, crystals: crystals || [], groupVersion: gv || 0 });

  /* ============ 一、合并池：按 ID 去重 + 权重取 max（不自动相加）============ */
  {
    const merged = SkillReward._mergePoolWeights("levelup");
    check("合并池-同 ID 权重取 max（CR_A = max(1,4) = 4）", merged.CR_A === 4);
    check("合并池-CR_B 取 max(5,1) = 5", merged.CR_B === 5);
    check("合并池-CR_C 取 max(3,1) = 3", merged.CR_C === 3);
    check("合并池-按 ID 去重（键数 = 4，无重复）", Object.keys(merged).length === 4);
    const savedMerge = SS.rewardPolicies.weightMerge;
    SS.rewardPolicies.weightMerge = "sum";
    const mergedSum = SkillReward._mergePoolWeights("levelup");
    check("合并池-策略可配置为 sum（CR_A = 1+4 = 5）", mergedSum.CR_A === 5);
    SS.rewardPolicies.weightMerge = savedMerge;
  }

  /* ============ 二、分类：空槽新装 / 同 ID 升级 / 满槽只出升级 / 满级移出 ============ */
  {
    const st1 = mkState([]);
    const t1 = SkillReward.build(st1, "levelup", makeRng(1));
    check("空槽-候选含新装项（kind=install, toLevel=1）", t1.options.some(o => o.kind === "install" && o.toLevel === 1));
    check("空槽-不出现灰色废选项（options 全部有效 kind）", t1.options.every(o => o.kind === "install" || o.kind === "upgrade" || o.kind === "attr"));

    const st2 = mkState([ { crystalId: "CR_A", level: 1, slot: 0 } ]);
    const t2 = SkillReward.build(st2, "levelup", makeRng(2));
    const upA = t2.options.find(o => o.crystalId === "CR_A");
    check("同 ID-已装未满级 → 出升级项（from 1 → to 2）", !!upA && upA.kind === "upgrade" && upA.fromLevel === 1 && upA.toLevel === 2);
    check("同 ID-不出现 CR_A 的新装项（不占新槽）", !t2.options.some(o => o.crystalId === "CR_A" && o.kind === "install"));

    const st3 = mkState([ { crystalId: "CR_FULL", level: 1, slot: 0 } ]);   // CR_FULL maxLv 1
    const t3 = SkillReward.build(st3, "levelup", makeRng(3));
    check("满级-满级水晶移出候选（CR_FULL 不在 options）", !t3.options.some(o => o.crystalId === "CR_FULL"));
    check("满级-记录 MAX_LEVEL 原因", t3.rejected.some(r => r.crystalId === "CR_FULL" && r.reason === R.MAX_LEVEL));

    // 满槽（4/4）：只出「已装且未满级的合法升级」，其他位置补属性
    const full = [ { crystalId: "CR_A", level: 1, slot: 0 }, { crystalId: "CR_B", level: 1, slot: 1 },
                   { crystalId: "CR_C", level: 2, slot: 2 }, { crystalId: "CR_FULL", level: 1, slot: 3 } ];
    const t4 = SkillReward.build(mkState(full), "levelup", makeRng(4));
    check("满槽-只出升级项（无任何 install）", !t4.options.some(o => o.kind === "install"));
    check("满槽-其他位置补合法属性奖励", t4.options.filter(o => o.kind === "attr").length >= 1);
    check("满槽-升级项只针对已装未满级水晶（CR_A 1→2）", t4.options.some(o => o.crystalId === "CR_A" && o.kind === "upgrade"));
    // 池中含未装水晶（CR_NEW）时，满槽 → 该未装水晶被排除并记录 SLOTS_FULL
    const t4b = SkillReward.build(mkState(full), "fulltest", makeRng(4));
    check("满槽-未装水晶被排除并记录 SLOTS_FULL 原因", t4b.rejected.some(r => r.crystalId === "CR_NEW" && r.reason === R.SLOTS_FULL));
    check("满槽-非法新装不以灰色废选项占位", !t4b.options.some(o => o.crystalId === "CR_NEW"));
  }

  /* ============ 三、无候选 → 属性兜底 + 显示实际数量（不生造废选项）============ */
  {
    SS.rewardPools.POOL_ONLY_CONFLICT = { id: "POOL_ONLY_CONFLICT", sources: ["levelup"], weights: { CR_CONFLICT: 5 } };
    const savedPools = SS.rewardPools; // 引用
    // 临时只留冲突池
    const keepA = SS.rewardPools.POOL_A, keepB = SS.rewardPools.POOL_B;
    delete SS.rewardPools.POOL_A; delete SS.rewardPools.POOL_B;
    const t = SkillReward.build(mkState([]), "levelup", makeRng(7));
    check("无候选-冲突候选被组合模拟过滤", t.legalCount === 0 && t.options.every(o => o.kind === "attr"));
    check("无候选-原因码 NO_CANDIDATE", t.reason === R.NO_CANDIDATE);
    check("无候选-属性兜底数量 = 显示实际数量", t.displayCount === t.options.length && t.displayCount === 3);
    // 属性池不足 → 显示实际数量（不凑数）
    const savedAttr = SS.rewardPolicies.attrFallback;
    SS.rewardPolicies.attrFallback = [ { attr: "atk", value: 5 } ];
    const t2 = SkillReward.build(mkState([]), "levelup", makeRng(8));
    check("兜底不足-显示实际数量（=1，不凑到 optionCount）", t2.options.length === 1 && t2.displayCount === 1);
    SS.rewardPolicies.attrFallback = savedAttr;
    SS.rewardPools.POOL_A = keepA; SS.rewardPools.POOL_B = keepB;
    delete SS.rewardPools.POOL_ONLY_CONFLICT;
  }

  /* ============ 四、重复提交只生效一次（ALREADY_COMMITTED）============ */
  {
    const st = mkState([]);
    const txn = SkillReward.build(st, "levelup", makeRng(11));
    const opt = txn.options[0];
    const gv0 = st.groupVersion;
    const r1 = SkillReward.commit(st, txn.rewardId, opt.optionId);
    check("提交-首次成功", r1.committed === true && r1.reason == null);
    check("提交-组版本 +1", r1.nextState.groupVersion === gv0 + 1);
    check("提交-安装生效（nextState 水晶数 +1）", (r1.nextState.crystals || []).length === 1 || (opt.kind === "attr"));
    const r2 = SkillReward.commit(st, txn.rewardId, opt.optionId);
    check("提交-重复提交被拒 ALREADY_COMMITTED", r2.committed === false && r2.reason === R.ALREADY_COMMITTED);
    check("提交-原 state 未被就地修改（事务仅标记 committed）", st.groupVersion === gv0 && txn.committed === true);
  }

  /* ============ 五、取消后随机状态不变（同一 rng 再建得到同样候选）============ */
  {
    const st = mkState([ { crystalId: "CR_A", level: 1, slot: 0 } ]);
    const a = SkillReward.build(st, "levelup", makeRng(99));
    const b = SkillReward.build(st, "levelup", makeRng(99));
    const sig = (t) => t.options.map(o => o.kind + ":" + o.crystalId + ":" + o.fromLevel + ">" + o.toLevel).join("|");
    check("取消-同一 rng 再建得到同样候选（顺序与内容一致）", sig(a) === sig(b));
    check("取消-randomState 被锁定并存入事务", a.randomState != null && a.randomState === b.randomState);
    // 取消（不提交）不改变已生成事务的候选
    const before = sig(a);
    check("取消-未提交事务候选保持不变", sig(a) === before && a.committed === false);
  }

  /* ============ 六、雕像：候选与已装形态冲突被过滤 + 兜底 ============ */
  {
    const st = mkState([], { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 } });
    // statueProb=1，SK_BAD 与形态冲突 → 只留 SK_OK
    const g1 = SkillReward.rollStatueGrant(st, null, makeRng(5));
    check("雕像-冲突候选被过滤（候选仅 SK_OK）", g1.granted === true && g1.skillId === "SK_OK" && g1.candidates.length === 1 && g1.candidates[0] === "SK_OK");
    check("雕像-MOTION_CONFLICT 计入原因", g1.reasonCodes.indexOf(R.MOTION_CONFLICT) >= 0);
    // 全部候选冲突 → 兜底其他奖励并给原因
    const savedPool = SS.rewardPolicies.rareSkillPool;
    SS.rewardPolicies.rareSkillPool = ["SK_BAD"];
    const g2 = SkillReward.rollStatueGrant(st, null, makeRng(6));
    check("雕像-候选全冲突 → 未授予稀有技能", g2.granted === false && g2.skillId === null);
    check("雕像-兜底其他合法奖励（属性）", g2.kind === "fallback" && g2.options.length >= 1);
    check("雕像-给原因 NO_CANDIDATE", g2.reason === R.NO_CANDIDATE);
    SS.rewardPolicies.rareSkillPool = savedPool;
    // 概率不命中 → 不授予
    const savedProb = SS.rewardPolicies.statueProb;
    SS.rewardPolicies.statueProb = 0;
    const g4 = SkillReward.rollStatueGrant(st, null, makeRng(3));
    check("雕像-概率不命中 → 不授予且给原因", g4.granted === false && g4.reason === R.NO_CANDIDATE);
    SS.rewardPolicies.statueProb = savedProb;
    // 已满技能位（重复雕像处理）→ 走其他奖励
    const st2 = mkState([], { SK_FIREBALL: { id: "SK_FIREBALL", level: 1 }, SK_OTHER: { id: "SK_OTHER", level: 1 } });
    const g5 = SkillReward.rollStatueGrant(st2, null, makeRng(9));
    check("雕像-已满技能位 → 走重复处理兜底（不硬塞稀有技能）", g5.granted === false && g5.kind === "fallback");
  }

  /* ============ 七、提交失败不消耗奖励 ============ */
  {
    const st = mkState([]);
    const txn = SkillReward.build(st, "levelup", makeRng(21));
    const opt = txn.options[0];
    const bad = SkillReward.commit(st, txn.rewardId, "NOT_AN_OPTION");
    check("失败-无效选项被拒 INVALID_REFERENCE", bad.committed === false && bad.reason === R.INVALID_REFERENCE);
    check("失败-事务回到 OPEN（未消耗奖励）", txn.committed === false && txn.status === "OPEN");
    const good = SkillReward.commit(st, txn.rewardId, opt.optionId);
    check("失败-随后合法提交仍成功（奖励未被消耗）", good.committed === true);
    // 组版本不匹配 → 保留事务记录 + 替代流程，不偷偷改收益
    const st3 = mkState([]);
    const txn3 = SkillReward.build(st3, "levelup", makeRng(22));
    const optsBefore = txn3.options.map(o => o.optionId).join("|");
    st3.groupVersion = st3.groupVersion + 1;   // 状态已变化
    const stale = SkillReward.commit(st3, txn3.rewardId, txn3.options[1].optionId);
    check("失败-组版本不匹配 → 提交失败", stale.committed === false);
    check("失败-保留事务记录并生成替代流程（不偷偷改已选收益）",
      !!txn3.replacement && txn3.replacement.needed === true && txn3.options.map(o => o.optionId).join("|") === optsBefore);
  }

  console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
  if (failCount > 0) throw new Error("skill_reward_test 失败数 " + failCount);
`;
vm.runInContext(driver, ctx, { filename: "driver" });
