/* 关卡难度曲线调参回归测试（node level_tuning_test.js）
 * 风格参考 perf_guard_test.js：Node vm 沙箱加载 js/config.js 后跑断言。
 * 覆盖：
 *   一、config.js 无 DOM 沙箱独立加载不抛错
 *   二、CFG._validateLevelCurve() 返回 ok:true，且为纯函数（两次调用结果一致）
 *   三、10 关曲线表：结构完整、数量/血量倍率单调不减、数值在合理区间
 *   四、毒圈档位：伤害/间隔/预警期在区间内、满血站毒 8~15s 压力带、DPS 随关卡递增
 *   五、补给档位：数量/读条/回血区间、稀缺化单调、无「补 > 毒伤大系数」失衡
 *   六、档位 key 引用全部存在（毒圈/补给/宝箱），宝箱高阶占比单调抬升
 *   七、CFG.hazard / CFG.supply 既有字段名逐项存在（防止破坏 game.js 依赖）
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 时非零退出。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）。 */
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
check("一 config.js 无 DOM 沙箱加载不抛错", loadOk && CFG && typeof CFG === "object" && Array.isArray(CFG.levels));

if (CFG) {
  const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
  const HP_BASE = 100;   // 基准血量：H001~H012 满血 85~120 的中位（不计防御，安全侧口径）

  /* ---- 二、自检函数 ---- */
  check("二 _validateLevelCurve 存在且为函数", typeof CFG._validateLevelCurve === "function");
  let r1 = null, r2 = null, vThrew = false;
  try { r1 = CFG._validateLevelCurve(); r2 = CFG._validateLevelCurve(); } catch (e) { vThrew = true; }
  check("二 自检调用不抛错", !vThrew);
  check("二 自检返回结构为 {ok, issues}", !!r1 && typeof r1.ok === "boolean" && Array.isArray(r1.issues));
  check("二 自检结论 ok:true（问题清单: " + (r1 ? r1.issues.join("；") : "未执行") + "）", !!r1 && r1.ok === true && r1.issues.length === 0);
  check("二 自检为纯函数：两次调用结果一致", JSON.stringify(r1) === JSON.stringify(r2));

  const curve = CFG.levelCurve;
  check("二 levelCurve 总表存在（rows/hazardTiers/supplyTiers/chestTiers）",
    !!curve && Array.isArray(curve.rows) && !!curve.hazardTiers && !!curve.supplyTiers && !!curve.chestTiers);

  if (curve && Array.isArray(curve.rows)) {
    const rows = curve.rows;

    /* ---- 三、曲线表结构与单调性 ---- */
    check("三 rows 共 10 行且 lv=1..10", rows.length === 10 && rows.every((r, i) => r.lv === i + 1));
    let mono = true, inRange = true;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].countMul < rows[i - 1].countMul || rows[i].hpMul < rows[i - 1].hpMul) mono = false;
    }
    for (const r of rows) {
      if (!(r.countMul > 0 && r.countMul <= 10 && r.hpMul > 0 && r.hpMul <= 10)) inRange = false;
    }
    check("三 怪物数量倍率单调不减（1.00→" + rows[9].countMul + "）", mono);
    check("三 怪物数量倍率全部在 (0,10] 区间", inRange);
    check("三 怪物血量倍率单调不减（1.00→" + rows[9].hpMul + "）",
      rows.every((r, i) => i === 0 || r.hpMul >= rows[i - 1].hpMul));
    check("三 血量倍率与 monsterLevel 成长口径一致（1+(lv-1)×0.12）",
      rows.every((r, i) => near(r.hpMul, 1 + i * 0.12, 1e-9)));
    check("三 L7 为休整关（机制关闭、倍率曲线连续无断崖）",
      !CFG.levels[6].hazardEnabled && !CFG.levels[6].supplyEnabled && rows[6].hazard === null
      && rows[6].countMul >= rows[5].countMul && rows[7].countMul >= rows[6].countMul);

    /* ---- 四、毒圈档位 ---- */
    const hzRows = rows.filter((r) => r.hazard != null);
    check("四 开启毒圈的关卡曲线档位齐全（" + hzRows.map((r) => "L" + r.lv + ":" + r.hazard).join(" ") + "）", hzRows.length === 5);
    let hzSane = true, hzKeys = true, hzSync = true;
    for (const r of hzRows) {
      const t = curve.hazardTiers[r.hazard];
      if (!t) { hzKeys = false; continue; }
      // 21.1 口径：伤害 = 最大生命固定比例（dmgPercent），不再用绝对值 dmgPerTick 结算
      if (!(t.dmgPercent > 0 && t.dmgPercent <= 0.05)) hzSane = false;              // 单口不超过最大生命 5%
      if (!(t.tickInterval > 0 && t.tickInterval <= 5)) hzSane = false;             // 收缩扣血间隔为正
      if (!(t.startDelay >= 12 && t.startDelay <= 20)) hzSane = false;              // 预警期 12~20s（走位/撤离准备）
      if (!(t.minRadius > 0 && t.minRadius < 960)) hzSane = false;
      // 满血站毒致命秒数：每 tick 扣 dmgPercent，故 ttk = (1/dmgPercent) × tickInterval
      const ttk = (1 / t.dmgPercent) * t.tickInterval;
      if (!(ttk >= 60 - 1e-9 && ttk <= 120 + 1e-9)) hzSane = false;                 // 60~120s 可承受压力带
      // 关卡覆盖与曲线档位一致（单一事实源核对）
      const L = CFG.levels[r.lv - 1], ov = L.hazard || {};
      if (!(ov.startDelay === t.startDelay && ov.shrinkDuration === t.shrinkDuration
        && ov.minRadius === t.minRadius && ov.tickInterval === t.tickInterval
        && ov.dmgPercent === t.dmgPercent)) hzSync = false;
    }
    check("四 毒圈档位 key 全部存在", hzKeys);
    check("四 毒圈参数在合理区间（单口≤5%最大生命、间隔>0、预警期 12~20s）", hzSane);
    check("四 毒圈满血站毒落在 60~120s 压力带（按 1% 比例口径）",
      hzRows.every((r) => { const t = curve.hazardTiers[r.hazard]; const ttk = (1 / t.dmgPercent) * t.tickInterval; return ttk >= 60 - 1e-9 && ttk <= 120 + 1e-9; }));
    // 21.1：各档 dmgPercent 统一 1%，压力靠 tickInterval 拉开 → 每秒比例「非递减」（允许相等，不允许回退）
    const dpsList = hzRows.map((r) => curve.hazardTiers[r.hazard].dmgPercent / curve.hazardTiers[r.hazard].tickInterval);
    check("四 毒圈每秒伤害比例随关卡非递减（" + dpsList.map(d => (d * 100).toFixed(2) + "%").join("→") + "）",
      dpsList.every((d, i) => i === 0 || d >= dpsList[i - 1] - 1e-9));
    check("四 毒圈末档压力强于首档（终局比教学更狠）", dpsList[dpsList.length - 1] > dpsList[0]);
    check("四 毒圈各档统一 1% 固定扣血（用户口径：与血量/防御无关）",
      hzRows.every((r) => curve.hazardTiers[r.hazard].dmgPercent === 0.01));
    check("四 毒圈预警期/终圈随关卡收紧（压迫感递增）",
      hzRows.every((r, i) => i === 0 || (curve.hazardTiers[r.hazard].startDelay <= curve.hazardTiers[hzRows[i - 1].hazard].startDelay
        && curve.hazardTiers[r.hazard].minRadius <= curve.hazardTiers[hzRows[i - 1].hazard].minRadius)));
    check("四 关卡 hazard 覆盖与曲线档位值一致（单一事实源）", hzSync);

    /* ---- 五、补给档位 ---- */
    const spRows = rows.filter((r) => r.supply != null);
    check("五 开启补给的关卡曲线档位齐全（" + spRows.map((r) => "L" + r.lv + ":" + r.supply).join(" ") + "）", spRows.length === 5);
    let spSane = true, spKeys = true, spSync = true, healList = [], poolList = [];
    for (const r of spRows) {
      const t = curve.supplyTiers[r.supply];
      if (!t) { spKeys = false; continue; }
      if (!(t.count >= 1 && t.count <= 3)) spSane = false;                          // game.js 侧 count 上限 3
      if (!(t.channelSeconds >= 1 && t.channelSeconds <= 6)) spSane = false;
      const ef = t.effect || {};
      if (ef.type === "heal") {
        if (!(ef.pct > 0 && ef.pct <= 0.5)) spSane = false;                         // 单次回血不超过半管
        healList.push(ef.pct);
        // 失衡检查：全关补给池（count×pct×血量）不得超过 90 秒毒伤总量
        const hzT = curve.hazardTiers[r.hazard];
        if (hzT) {
          const dps = hzT.dmgPercent / hzT.tickInterval;   // 每秒扣最大生命的比例（21.1 比例口径）
          const pool = t.count * ef.pct * HP_BASE;
          poolList.push(pool / (dps * HP_BASE));
          if (pool > dps * HP_BASE * 90) spSane = false;   // 全关补给池 ≤ 90 秒毒伤
          if (ef.pct * HP_BASE > dps * HP_BASE * 30) spSane = false;   // 单点回血 ≤ 30s 毒伤
        }
      } else if (ef.type === "buff") {
        if (!(CFG[ef.buffPool + "Buffs"] && CFG[ef.buffPool + "Buffs"].length)) spSane = false;
      } else if (ef.type === "crystal") {
        if (!(ef.amount > 0 && ef.amount <= 200)) spSane = false;
      } else spSane = false;
      // 关卡覆盖与档位一致
      const L = CFG.levels[r.lv - 1], ov = L.supply || {};
      if (!(ov.count === t.count && ov.channelSeconds === t.channelSeconds && ov.effect && ov.effect.type === ef.type)) spSync = false;
    }
    check("五 补给档位 key 全部存在", spKeys);
    check("五 补给参数在合理区间（数量 1~3、读条 1~6s、回血 (0,0.5]）", spSane);
    check("五 补给随关卡稀缺化：数量不增（3→1）", spRows.every((r, i) => i === 0 || curve.supplyTiers[r.supply].count <= curve.supplyTiers[spRows[i - 1].supply].count));
    check("五 补给随关卡稀缺化：读条不缩短（2.5→4.0s）", spRows.every((r, i) => i === 0 || curve.supplyTiers[r.supply].channelSeconds >= curve.supplyTiers[spRows[i - 1].supply].channelSeconds));
    check("五 治疗型补给回血比例单调缩水（" + healList.map((p) => Math.round(p * 100) + "%").join("→") + "）",
      healList.every((p, i) => i === 0 || p < healList[i - 1]));
    check("五 无「无限奶站撸毒圈」失衡（补给池 ≤ 90s 毒伤，最大 " + Math.max.apply(null, poolList).toFixed(1) + "s）",
      poolList.every((s) => s <= 90));
    check("五 关卡 supply 覆盖与曲线档位值一致（单一事实源）", spSync);
    check("五 L5 补给最慷慨（3 点/2.5s/25%）、L10 最稀缺（1 点/4.0s/15%）",
      curve.supplyTiers.SP1.count === 3 && curve.supplyTiers.SP1.effect.pct === 0.25
      && curve.supplyTiers.SP5.count === 1 && curve.supplyTiers.SP5.effect.pct === 0.15);

    /* ---- 六、宝箱档位 ---- */
    const qKeys = Object.keys(CFG.chestQualities || {});
    let ctKeys = true, ctW = true, prevHigh = -1, ctMono = true;
    for (const r of rows) {
      const t = curve.chestTiers[r.chest];
      if (!t) { ctKeys = false; continue; }
      let sum = 0, high = 0;
      for (const k in (t.weights || {})) {
        if (qKeys.indexOf(k) < 0) ctKeys = false;
        if (!(typeof t.weights[k] === "number" && t.weights[k] >= 0)) ctW = false;
        sum += t.weights[k];
        if (k === "divine" || k === "mythic") high += t.weights[k];
      }
      if (!(sum > 0)) ctW = false;
      const share = sum > 0 ? high / sum : 0;
      if (share < prevHigh - 1e-9) ctMono = false;
      prevHigh = share;
    }
    check("六 宝箱档位 key 全部存在且引用合法（CT1~CT4）", ctKeys);
    check("六 宝箱权重非负且总和为正（key ⊆ chestQualities）", ctW);
    check("六 宝箱高阶（divine+mythic）占比随关卡单调抬升（3%→16%）", ctMono);

    /* ---- 七、既有字段名完整性（game.js 依赖面回归锁定） ---- */
    const hzFields = ["enabled", "startDelay", "shrinkDuration", "minRadius", "tickInterval", "dmgPercent", "cx", "cy", "color"];
    const spFields = ["enabled", "count", "radius", "channelSeconds", "effect", "color"];
    check("七 CFG.hazard 全局字段逐项存在（" + hzFields.join("/") + "）", hzFields.every((f) => f in CFG.hazard));
    check("七 CFG.supply 全局字段逐项存在（" + spFields.join("/") + "）", spFields.every((f) => f in CFG.supply));
    const hzLvFields = ["startDelay", "shrinkDuration", "minRadius", "tickInterval", "dmgPercent"];
    check("七 各关 hazard 覆盖字段完整（LEVEL_005/006/008/009/010）",
      CFG.levels.every((L) => !L.hazard || hzLvFields.every((f) => f in L.hazard)));
    check("七 各关 supply 覆盖含 count/channelSeconds/effect",
      CFG.levels.every((L) => !L.supply || ("count" in L.supply && "channelSeconds" in L.supply && !!L.supply.effect)));
    check("七 LEVEL_006 hazard 覆盖仍≠全局默认（level_content_test 前提保持）",
      CFG.levels[5].hazard && CFG.levels[5].hazard.startDelay !== CFG.hazard.startDelay);
    check("七 LEVEL_005 为首个毒圈/补给关（首个机制关口径不变）",
      CFG.levels.findIndex((L) => L.hazardEnabled) === 4 && CFG.levels.findIndex((L) => L.supplyEnabled) === 4);
    check("七 无机制关卡（L1~L4/L7）不携带 hazard/supply 覆盖（等价性契约）",
      [0, 1, 2, 3, 6].every((i) => !CFG.levels[i].hazard && !CFG.levels[i].supply));
  }
}

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("关卡调参测试未全绿：失败 " + failCount + " 项");
}
console.log("LEVEL TUNING TEST OK");
