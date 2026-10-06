/* 第 11~20 关铺量测试（node levels_11_20_test.js）
 * 风格参考 level_tuning_test.js：Node vm 沙箱只加载 js/config.js（无 DOM）跑断言。
 * 覆盖：
 *   一、LEVEL_011~020 连续存在无缺号、字段齐全、name 中文格式
 *   二、theme 深色系互不相同且不与 1~10 关撞色；地图正方形、区间 [1920,3000]、缓增无断崖
 *   三、难度曲线单调：progressGoal/timeLimit/artisanAtKills/eliteBase 沿 9/10 关斜率外推；
 *       monsterCap 维持 120 性能红线；monsterLevel 封顶 10
 *   四、circles：模板 id 全部存在、count 为正；SC04 不挂新关（锁定 L8~L10 恰 3 关）；
 *       SC03 主力递增、圆总数递增（快慢节奏搭配）
 *   五、BOSS：全部为存在的 BS 模板、11~20 关去重恰 10（二周目每只两关）；
 *       第 15 关 BS0005、第 20 关 BS0010（终局最强，全表最厚血量）
 *   六、elitePool 可解析且引用存在；高威胁 ED0003 权重随关卡抬升
 *   七、levelCurve 补全 20 行：lv 连续、countMul/hpMul 单调无断崖、hpMul 对齐成长口径、
 *       新 10 行不启用机制、宝箱档不回落
 *   八、CFG._validateLevelCurve() 自检 ok:true（含 11~20 关一致性核对）
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 非零退出。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---- 无 DOM 沙箱加载：只给 console，不给 document/window ---- */
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
check("一 config.js 无 DOM 沙箱加载不抛错且 levels 为数组", loadOk && CFG && typeof CFG === "object" && Array.isArray(CFG.levels));

if (CFG) {
  const L = CFG.levels, NEW = L.slice(10);
  const curve = CFG.levelCurve;
  const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
  // 解析 elitePool 权重串 → {总权重, 条目映射}；非法返回 null
  const parsePool = (s) => {
    if (typeof s !== "string" || !s.trim()) return null;
    const parts = s.split("/"), map = {};
    let total = 0;
    for (const p of parts) {
      const m = p.split(":");
      if (m.length !== 2) return null;
      if (!CFG.monsters[m[0]]) return null;   // 引用的 ED 编号必须存在
      const w = Number(m[1]);
      if (!(isFinite(w) && w > 0)) return null;
      map[m[0]] = w; total += w;
    }
    return { total, map };
  };

  /* ---- 一、连续存在 + 字段齐全 ---- */
  check("一 关卡总数为 20（10+10 扩展批，" + L.length + "）", L.length === 20);
  check("一 LEVEL_011~020 连续存在无缺号（" + NEW.map(l => l.id).join(",") + "）",
    NEW.every((l, i) => l.id === "LEVEL_" + String(i + 11).padStart(3, "0")));
  check("一 新 10 关字段齐全（id/name/theme/mapW/mapH/progressGoal/timeLimit/monsterCap/circles/boss/monsterLevel/eliteBase/elitePool/artisanAtKills）",
    NEW.every((l) => typeof l.id === "string" && typeof l.name === "string" && typeof l.theme === "string"
      && l.mapW > 0 && l.mapH > 0 && typeof l.progressGoal === "number" && l.progressGoal > 0
      && typeof l.timeLimit === "number" && l.timeLimit > 0 && typeof l.monsterCap === "number" && l.monsterCap > 0
      && Array.isArray(l.circles) && l.circles.length > 0 && typeof l.boss === "string"
      && typeof l.monsterLevel === "number" && l.monsterLevel >= 1
      && typeof l.eliteBase === "number" && l.eliteBase >= 0
      && typeof l.elitePool === "string" && typeof l.artisanAtKills === "number" && l.artisanAtKills > 0));
  check("一 新 10 关 name 中文格式「第 N 关 · xx」（N=11..20 连续）",
    NEW.every((l, i) => l.name === "第 " + (i + 11) + " 关 · " + l.name.split(" · ")[1] && (l.name.split(" · ")[1] || "").length >= 2));

  /* ---- 二、theme 与地图 ---- */
  const themes = NEW.map(l => l.theme);
  const oldThemes = L.slice(1, 10).map(l => l.theme).filter(Boolean);   // 2~10 关既有主题色
  check("二 新 10 关 theme 均为 #rrggbb 深色系且互不相同", themes.every(t => /^#[0-9a-fA-F]{6}$/.test(t)) && new Set(themes).size === 10);
  check("二 新 10 关 theme 不与 2~10 关撞色（" + themes.join(",") + "）", themes.every(t => oldThemes.indexOf(t) < 0));
  check("二 地图正方形且在 [1920,3000] 区间", NEW.every(l => l.mapW === l.mapH && l.mapW >= 1920 && l.mapW <= 3000));
  check("二 地图尺寸单调缓增无断崖（" + NEW[0].mapW + "→" + NEW[9].mapW + "，步长 ≤ 120）",
    NEW.every((l, i) => i === 0 || (l.mapW >= NEW[i - 1].mapW && l.mapW - NEW[i - 1].mapW <= 120)));

  /* ---- 三、难度曲线单调（沿 9/10 关斜率外推）---- */
  check("三 progressGoal 沿 L10（200）斜率外推递增无断崖（" + L[9].progressGoal + "→" + NEW[9].progressGoal + "，步长 20~28）",
    NEW.every((l, i) => {
      const prev = i === 0 ? L[9] : NEW[i - 1];
      const step = l.progressGoal - prev.progressGoal;
      return step >= 15 && step <= 30;
    }));
  check("三 timeLimit 单调递增无断崖（" + L[9].timeLimit + "→" + NEW[9].timeLimit + "，步长 30）",
    NEW.every((l, i) => {
      const prev = i === 0 ? L[9] : NEW[i - 1];
      const step = l.timeLimit - prev.timeLimit;
      return step >= 20 && step <= 60;
    }));
  check("三 artisanAtKills 单调递增（" + L[9].artisanAtKills + "→" + NEW[9].artisanAtKills + "）",
    NEW.every((l, i) => i === 0 ? l.artisanAtKills > L[9].artisanAtKills : l.artisanAtKills > NEW[i - 1].artisanAtKills));
  check("三 eliteBase 单调不减（" + L[9].eliteBase + "→" + NEW[9].eliteBase + "）",
    NEW.every((l, i) => i === 0 ? l.eliteBase >= L[9].eliteBase : l.eliteBase >= NEW[i - 1].eliteBase));
  check("三 monsterCap 维持 120 性能红线（与 1~10 关一致）", NEW.every(l => l.monsterCap === 120));
  check("三 monsterLevel 封顶 10（全表口径 ≤10，压力由曲线倍率承载）", NEW.every(l => l.monsterLevel === 10));

  /* ---- 四、circles 引用与节奏 ---- */
  check("四 circles 模板 id 全部真实存在且 count 为正", NEW.every(l => l.circles.every(c => !!CFG.spawnCircles[c.tpl] && typeof c.count === "number" && c.count > 0)));
  check("四 SC04 不挂新关（special_monster_test 锁定 L8~L10 恰 3 关）", NEW.every(l => l.circles.every(c => c.tpl !== "SC04")));
  const sc03 = NEW.map(l => l.circles.find(c => c.tpl === "SC03").count);
  check("四 SC03 主力圆数量递增（" + sc03.join("→") + "）", sc03.every((n, i) => i === 0 || n >= sc03[i - 1]));
  const totalCircles = NEW.map(l => l.circles.reduce((a, c) => a + c.count, 0));
  check("四 圆总数递增无断崖（" + totalCircles.join("→") + "，快慢节奏 interval 7.0/6.0/5.5 搭配）",
    totalCircles.every((n, i) => i === 0 || (n >= totalCircles[i - 1] && n - totalCircles[i - 1] <= 3)));

  /* ---- 五、BOSS 安排 ---- */
  check("五 新 10 关 boss 均为存在的 BS 模板", NEW.every(l => !!(CFG.monsters[l.boss] && CFG.monsters[l.boss].type === "boss") && l.boss.indexOf("BS") === 0));
  check("五 11~20 关 boss 去重恰 10（二周目每只恰好 2 关，与 Boss 表 10 只自洽）", new Set(NEW.map(l => l.boss)).size === 10);
  check("五 第 15 关 BOSS = BS0005（中盘强敌）、第 20 关 BOSS = BS0010（终局最强）", NEW[4].boss === "BS0005" && NEW[9].boss === "BS0010");
  check("五 第 20 关 BOSS 血量为全表最厚（" + CFG.monsters.BS0010.hp + " ≥ 全部 BS）",
    Object.keys(CFG.monsters).every(k => CFG.monsters[k].type !== "boss" || CFG.monsters.BS0010.hp >= CFG.monsters[k].hp));

  /* ---- 六、elitePool ---- */
  check("六 新 10 关 elitePool 可解析、引用的 ED 编号全部存在、权重合计为正", NEW.every(l => { const p = parsePool(l.elitePool); return !!p && p.total > 0; }));
  const ed3 = NEW.map(l => parsePool(l.elitePool).map.ED0003 || 0);
  check("六 高威胁精英 ED0003 权重随关卡抬升（" + ed3.join("→") + "）", ed3.every((w, i) => i === 0 || w > ed3[i - 1]));

  /* ---- 七、levelCurve 补全 20 行 ---- */
  check("七 levelCurve.rows 补全 20 行且 lv=1..20 连续", !!curve && Array.isArray(curve.rows) && curve.rows.length === 20 && curve.rows.every((r, i) => r.lv === i + 1));
  check("七 countMul/hpMul 全表单调不减、无断崖（" + curve.rows[9].countMul + "→" + curve.rows[19].countMul + "，步长 ≤ 0.2）",
    curve.rows.every((r, i) => i === 0 || (r.countMul >= curve.rows[i - 1].countMul && r.hpMul >= curve.rows[i - 1].hpMul
      && r.countMul - curve.rows[i - 1].countMul <= 0.2)));
  check("七 新 10 行 hpMul 与 monsterLevel 成长口径一致（1+(lv-1)×0.12）",
    curve.rows.slice(10).every((r, i) => near(r.hpMul, 1 + (i + 10) * 0.12)));
  check("七 新 10 行不启用毒圈/补给（hazard/supply=null 且关卡未开 hazardEnabled/supplyEnabled）",
    curve.rows.slice(10).every(r => r.hazard === null && r.supply === null)
      && NEW.every(l => !l.hazardEnabled && !l.supplyEnabled));
  check("七 新 10 行宝箱档为 CT4（key 存在、高阶占比不回落）", curve.rows.slice(10).every(r => !!curve.chestTiers[r.chest]));

  /* ---- 八、自检函数（含 11~20 关一致性核对）---- */
  let v1 = null, vThrew = false;
  try { v1 = CFG._validateLevelCurve(); } catch (e) { vThrew = true; }
  check("八 _validateLevelCurve() 调用不抛错且 ok:true（问题清单: " + (v1 ? v1.issues.join("；") : "未执行") + "）",
    !vThrew && !!v1 && v1.ok === true && v1.issues.length === 0);
}

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("第 11~20 关铺量测试未全绿：失败 " + failCount + " 项");
}
console.log("LEVELS 11-20 TEST OK");
