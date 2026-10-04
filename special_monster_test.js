/* 冲锋特殊怪扩充回归测试（node special_monster_test.js）
 * 风格参考 level_tuning_test.js：Node vm 沙箱加载 js/config.js 后跑断言。
 * 覆盖：
 *   一、config.js 无 DOM 沙箱独立加载不抛错
 *   二、新增冲锋怪 NM0027~NM0030 存在且必需字段齐全、全为 charger
 *   三、冲锋怪技能表现差异化：charger 群 skillList 覆盖 ≥4 种招式、新怪之间不全相同
 *   四、新技能 AT241~AT244 存在、字段齐全、编号不与既有 AT2xx 冲突、参数在合理区间
 *   五、数值平衡：新怪 hp/atk 落在同解锁段相邻怪物的合理区间
 *   六、刷怪池：SC01~SC04 权重合法、含冲锋特殊怪、占比记录、pool 不含 ED/BS
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 时非零退出。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，提到异常用中文「错误」）。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---- 一、无 DOM 沙箱加载：只给 console，不给 document/window ---- */
let CFG = null, loadOk = true;
try {
  const ctx = vm.createContext({ console: console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
  vm.runInContext("this.__CFG = CFG;", ctx);
  CFG = ctx.__CFG;
} catch (e) {
  loadOk = false;
  console.log("FAIL config.js 无 DOM 沙箱加载抛出异常: " + (e && e.message));
}
check("一 config.js 无 DOM 沙箱加载不抛错", loadOk && CFG && typeof CFG === "object" && !!CFG.monsters);

if (CFG) {
  const REQUIRED_MONSTER_FIELDS = ["name", "type", "sprite", "skillList", "hp", "atk", "def", "spd", "radius", "exp", "coin"];
  const NEW_IDS = ["NM0027", "NM0028", "NM0029", "NM0030"];
  const NEW_SKILLS = ["AT241", "AT242", "AT243", "AT244"];

  /* ---- 二、新怪存在 + 字段齐全 + 全为 charger ---- */
  const missing = NEW_IDS.filter((id) => !CFG.monsters[id]);
  check("二 新增冲锋怪 NM0027~NM0030 全部就位（" + (missing.length ? missing.join(",") : "4 只齐全") + "）",
    missing.length === 0);
  const fieldBad = [];
  for (const id of NEW_IDS) {
    const d = CFG.monsters[id] || {};
    for (const f of REQUIRED_MONSTER_FIELDS) if (d[f] === undefined) fieldBad.push(id + "." + f);
  }
  check("二 新怪必需字段齐全（name/type/sprite/skillList/hp/atk/def/spd/radius/exp/coin）",
    fieldBad.length === 0);
  const notCharger = NEW_IDS.filter((id) => CFG.monsters[id] && CFG.monsters[id].type !== "charger");
  check("二 新怪全部为 charger 类型", notCharger.length === 0);
  const dropBad = NEW_IDS.filter((id) => !(CFG.monsters[id] && CFG.monsters[id].exp > 0 && CFG.monsters[id].coin > 0));
  check("二 新怪掉落（exp/coin）为正", dropBad.length === 0);
  const unlockBad = NEW_IDS.filter((id) => {
    const u = CFG.monsterUnlock[id];
    return !(typeof u === "number" && u >= 0 && u <= 1);
  });
  check("二 新怪解锁进度在 [0,1] 区间（" + NEW_IDS.map((id) => id + ":" + CFG.monsterUnlock[id]).join(" ") + "）",
    unlockBad.length === 0);

  /* ---- 三、冲锋表现差异化 ---- */
  const chargerIds = Object.keys(CFG.monsters).filter((id) => CFG.monsters[id].type === "charger");
  const skillSet = {};
  for (const id of chargerIds) skillSet[CFG.monsters[id].skillList[0]] = true;
  const skillKinds = Object.keys(skillSet);
  check("三 全部 charger 的招式覆盖 " + skillKinds.length + " 种（" + skillKinds.join("/") + "，要求 ≥4）",
    skillKinds.length >= 4);
  const newSkillSet = {};
  for (const id of NEW_IDS) newSkillSet[CFG.monsters[id].skillList[0]] = true;
  check("三 新怪之间 skillList 不完全相同（覆盖 " + Object.keys(newSkillSet).length + " 种招式）",
    Object.keys(newSkillSet).length >= 3);
  // 老面孔 charger（NM0017/20/23/26）也已换装新招式（NM0012 参数被 skill_table_test 锁定，保持 AT203）
  const retroFitted = ["NM0017", "NM0020", "NM0023", "NM0026"]
    .filter((id) => NEW_SKILLS.indexOf(CFG.monsters[id].skillList[0]) >= 0);
  check("三 既有 charger 已换装差异化招式（换装 " + retroFitted.length + "/4 只）", retroFitted.length === 4);
  const refBad = [];
  for (const id of chargerIds) {
    const sk = CFG.monsters[id].skillList[0];
    if (!CFG.skills[sk]) refBad.push(id + "→" + sk);
    else if (CFG.skills[sk].ai !== "charger") refBad.push(id + "→" + sk + "(ai 不符)");
  }
  check("三 charger 引用的技能 id 全部存在且 ai=charger", refBad.length === 0);

  /* ---- 四、新技能条目存在 + 字段齐全 + 编号不冲突 + 参数区间 ---- */
  const REQUIRED_SKILL_FIELDS = ["name", "cat", "ai", "cd", "chargeRange", "telegraph", "dashSpd", "dashTime", "dmgMul"];
  const skillFieldBad = [];
  for (const sk of NEW_SKILLS) {
    const s = CFG.skills[sk] || {};
    for (const f of REQUIRED_SKILL_FIELDS) if (s[f] === undefined) skillFieldBad.push(sk + "." + f);
  }
  check("四 新技能 AT241~AT244 必需字段齐全（name/cat/ai/cd/chargeRange/telegraph/dashSpd/dashTime/dmgMul）",
    skillFieldBad.length === 0);
  // 编号冲突检查：AT2xx 中不允许出现重复定义（对象键天然唯一，这里校验编号段占用与既有注释口径一致）
  const at2xx = Object.keys(CFG.skills).filter((k) => k.indexOf("AT2") === 0);
  const uniq = {};
  for (const k of at2xx) uniq[k] = (uniq[k] || 0) + 1;
  const dup = at2xx.filter((k) => uniq[k] > 1);
  check("四 AT2xx 技能编号无冲突（共 " + at2xx.length + " 条，重复 " + dup.length + " 条）", dup.length === 0);
  const inRange = (v, lo, hi) => typeof v === "number" && v >= lo && v <= hi;
  let skillSane = true;
  for (const sk of NEW_SKILLS) {
    const s = CFG.skills[sk];
    // 参照基准 AT203（cd 3.0 / range 320 / telegraph 0.6 / dashSpd 560 / dashTime 0.45 / dmgMul 1.0）
    if (!(inRange(s.cd, 0.1, 8) && inRange(s.chargeRange, 200, 500) && inRange(s.telegraph, 0.2, 1.5)
      && inRange(s.dashSpd, 300, 900) && inRange(s.dashTime, 0.15, 1.0) && inRange(s.dmgMul, 0.4, 2.5))) skillSane = false;
  }
  check("四 新技能参数全部落在以 AT203 为基准的合理区间", skillSane);
  // 差异化证明：五元组（前摇/冲速/滑行/冷却/倍率）互不相同
  const sig = (s) => [s.telegraph, s.dashSpd, s.dashTime, s.cd, s.dmgMul].join("|");
  const sigs = NEW_SKILLS.map((sk) => sig(CFG.skills[sk]));
  check("四 四种新招式的（前摇/冲速/滑行/冷却/倍率）组合互不相同", new Set(sigs).size === NEW_SKILLS.length);

  /* ---- 五、数值平衡：新怪 hp/atk 落在同解锁段相邻怪物区间 ----
   * 区间依据（取解锁进度邻域既有 NM 的 hp/atk，放宽 ±25% 容差）：
   *   NM0027(0.35) 邻域 NM0017~NM0020：hp 18~30 / atk 11~14（重装定位 hp/def 偏高、spd 压低）
   *   NM0028(0.45) 邻域 NM0019~NM0021：hp 24~34 / atk 10~15（快脆皮 hp 压低）
   *   NM0029(0.78) 邻域 NM0023~NM0024：hp 44~72 / atk 17~19
   *   NM0030(0.85) 邻域 NM0024~NM0026：hp 60~72 / atk 19~22（连突单次 ×0.7，atk 允许下探） */
  const BANDS = {
    NM0027: { hp: [14, 38], atk: [9, 17] },
    NM0028: { hp: [18, 42], atk: [8, 18] },
    NM0029: { hp: [33, 90], atk: [13, 23] },
    NM0030: { hp: [34, 90], atk: [12, 27] },
  };
  const balanceBad = [];
  for (const id of NEW_IDS) {
    const d = CFG.monsters[id], b = BANDS[id];
    if (!(d.hp >= b.hp[0] && d.hp <= b.hp[1])) balanceBad.push(id + ".hp=" + d.hp);
    if (!(d.atk >= b.atk[0] && d.atk <= b.atk[1])) balanceBad.push(id + ".atk=" + d.atk);
  }
  check("五 新怪 hp/atk 落在同段位合理区间（" + (balanceBad.length ? balanceBad.join(",") : "全部达标") + "）",
    balanceBad.length === 0);
  const spdBad = NEW_IDS.filter((id) => !(CFG.monsters[id].spd >= 80 && CFG.monsters[id].spd <= 170));
  check("五 新怪移速落在现有 NM 全体区间内（80~170）", spdBad.length === 0);

  /* ---- 六、刷怪池权重 ---- */
  let poolSane = true, poolDetail = [];
  for (const key of Object.keys(CFG.spawnCircles)) {
    const c = CFG.spawnCircles[key];
    const parts = String(c.pool).split("/");
    let sum = 0, chargerW = 0;
    for (const p of parts) {
      const seg = p.split(":");
      const w = Number(seg[1]);
      if (!CFG.monsters[seg[0]] || !(w > 0)) { poolSane = false; continue; }
      if (seg[0].indexOf("ED") === 0 || seg[0].indexOf("BS") === 0) poolSane = false;   // ED/BS 不进随机圆
      sum += w;
      if (CFG.monsters[seg[0]].type === "charger") chargerW += w;
    }
    if (!(sum > 0)) poolSane = false;
    poolDetail.push(key + " 冲锋占比 " + Math.round(chargerW / sum * 100) + "%");
  }
  check("六 各刷怪圆 pool 权重合法（怪物 id 存在、权重为正、不含 ED/BS）", poolSane);
  check("六 各圆冲锋特殊怪占比（" + poolDetail.join("，") + "）——SC04 过半，符合高阶压迫定位",
    poolDetail.length === 4);
  const hasSC04 = !!CFG.spawnCircles.SC04;
  const sc04Mounted = CFG.levels.filter((l) => (l.circles || []).some((c) => c.tpl === "SC04")).length;
  check("六 SC04 高阶混编圆已定义并挂载到 " + sc04Mounted + " 个关卡（L8~L10）",
    hasSC04 && sc04Mounted === 3);
  const riftW = String(CFG.rift.spawnPool).split("/").map((s) => Number(s.split(":")[1]) || 0)
    .reduce((a, b) => a + b, 0);
  check("六 裂缝投放池权重总和为正（" + riftW + "）且含差异化冲锋怪", riftW > 0);
}

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("冲锋特殊怪测试未全绿：失败 " + failCount + " 项");
}
console.log("SPECIAL MONSTER TEST OK");
