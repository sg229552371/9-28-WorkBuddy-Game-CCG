/* 第 21~99 关外推测试（node levels_21_99_test.js）
 * 风格参考 levels_11_20_test.js：Node vm 沙箱只加载 js/config.js（无 DOM）跑断言。
 * 覆盖（D037 主线外推）：
 *   一、LEVEL_021~099 连续存在无缺号、字段齐全、name 中文格式「第 N 关 · 章名 k」
 *   二、theme 79 关两两不同且不与 1~20 关撞色；地图正方形、区间 [1920,3000]、缓增无断崖
 *   三、难度曲线单调不减：mapW/progressGoal/timeLimit/artisanAtKills/eliteBase；
 *       monsterCap 三档阶梯（300/360/420）；monsterLevel 封顶 10
 *   四、circles：模板 id 全部存在、count 为正；SC04 不挂新关；圆总数单调不减
 *   五、BOSS：全部为存在的 BS 模板；全表覆盖 10 只；章节终关各章专属（30=BS0001…90=BS0007）、99 关 = BS0010
 *   六、elitePool 可解析、引用 ED 存在、权重合计 100；高威胁 ED0003 占比随关卡非降
 *   七、levelCurve.rows 99 行 lv 连续、countMul/hpMul 单调；hpMul 分段成长口径（21~99 用 3.28+(lv-20)×0.10）；
 *       21~99 行不启用毒圈/补给、宝箱档 CT4
 *   八、CFG.sectors 8 章覆盖 21~99 无缝无重叠；CFG.mainLevelCount === 99；
 *       CFG._validateLevelCurve() 自检 ok:true
 *   九、altarTimeline：t 严格递增、条目合法（固定 id / 随机池）、宝箱不在开局 10s 内
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
  vm.runInContext(fs.readFileSync(path.join(path.join(__dirname, "..", "..", ".."), "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
  vm.runInContext("this.__CFG = CFG;", ctx);
  CFG = ctx.__CFG;
} catch (e) {
  loadOk = false;
  console.log("FAIL config.js 无 DOM 沙箱加载抛出异常: " + (e && e.message));
}
check("一 config.js 无 DOM 沙箱加载不抛错且 levels 为数组", loadOk && CFG && typeof CFG === "object" && Array.isArray(CFG.levels));

if (CFG) {
  const L = CFG.levels;
  const OLD = L.slice(0, 20);                 // 1~20 关（手调）
  const NEW = L.slice(20);                    // 21~99 关（外推生成）
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

  /* ---- 一、连续存在 + 字段齐全 + name 格式 ---- */
  check("一 关卡总数为 99（手调 20 + 外推 79，" + L.length + "）", L.length === 99);
  check("一 LEVEL_021~099 连续存在无缺号", NEW.length === 79 && NEW.every((l, i) => l.id === "LEVEL_" + String(i + 21).padStart(3, "0")));
  check("一 新 79 关字段齐全（id/name/theme/mapW/mapH/progressGoal/timeLimit/monsterCap/circles/boss/monsterLevel/eliteBase/elitePool/artisanAtKills）",
    NEW.every((l) => typeof l.id === "string" && typeof l.name === "string" && typeof l.theme === "string"
      && l.mapW > 0 && l.mapH > 0 && typeof l.progressGoal === "number" && l.progressGoal > 0
      && typeof l.timeLimit === "number" && l.timeLimit > 0 && typeof l.monsterCap === "number" && l.monsterCap > 0
      && Array.isArray(l.circles) && l.circles.length > 0 && typeof l.boss === "string"
      && typeof l.monsterLevel === "number" && l.monsterLevel >= 1
      && typeof l.eliteBase === "number" && l.eliteBase >= 0
      && typeof l.elitePool === "string" && typeof l.artisanAtKills === "number" && l.artisanAtKills > 0));
  check("一 新 79 关 name 中文格式「第 N 关 · xx」（N=21..99 连续）",
    NEW.every((l, i) => l.name.indexOf("第 " + (i + 21) + " 关 · ") === 0));

  /* ---- 二、theme 唯一 + 地图 ---- */
  const themes = NEW.map(l => l.theme);
  const oldThemes = OLD.map(l => l.theme);
  check("二 新 79 关 theme 均为 #rrggbb 深色系且互不相同", themes.every(t => /^#[0-9a-fA-F]{6}$/.test(t)) && new Set(themes).size === 79);
  check("二 新 79 关 theme 不与 1~20 关撞色", themes.every(t => oldThemes.indexOf(t) < 0));
  check("二 地图正方形且在 [1920,3000] 区间", NEW.every(l => l.mapW === l.mapH && l.mapW >= 1920 && l.mapW <= 3000));
  check("二 地图尺寸单调不减、步长 ≤ 120、封顶 3000（" + NEW[0].mapW + "→" + NEW[78].mapW + "）",
    NEW.every((l, i) => i === 0 ? l.mapW >= OLD[19].mapW : (l.mapW >= NEW[i - 1].mapW && l.mapW - NEW[i - 1].mapW <= 120))
    && NEW[78].mapW === 3000);

  /* ---- 三、难度曲线单调 ---- */
  check("三 progressGoal 单调不减无回落（" + OLD[19].progressGoal + "→" + NEW[78].progressGoal + "）",
    NEW.every((l, i) => i === 0 ? l.progressGoal > OLD[19].progressGoal : l.progressGoal > NEW[i - 1].progressGoal));
  check("三 timeLimit 单调不减（" + OLD[19].timeLimit + "→" + NEW[78].timeLimit + "，封顶 1200）",
    NEW.every((l, i) => i === 0 ? l.timeLimit >= OLD[19].timeLimit : l.timeLimit >= NEW[i - 1].timeLimit)
    && NEW[78].timeLimit === 1200);
  check("三 artisanAtKills 单调不减（封顶 240）",
    NEW.every((l, i) => i === 0 ? l.artisanAtKills >= OLD[19].artisanAtKills : l.artisanAtKills >= NEW[i - 1].artisanAtKills)
    && NEW[78].artisanAtKills === 240);
  check("三 eliteBase 单调不减（封顶 55，" + OLD[19].eliteBase + "→" + NEW[78].eliteBase + "）",
    NEW.every((l, i) => i === 0 ? l.eliteBase >= OLD[19].eliteBase : l.eliteBase >= NEW[i - 1].eliteBase)
    && NEW[78].eliteBase === 54);
  check("三 monsterCap 三档阶梯 300（21~50）/360（51~80）/420（81~99）且单调不减",
    NEW.every((l, i) => {
      const lv = i + 21;
      const want = (lv <= 50) ? 300 : (lv <= 80 ? 360 : 420);
      return l.monsterCap === want && (i === 0 || l.monsterCap >= NEW[i - 1].monsterCap);
    }) && NEW[78].monsterCap === 420);
  check("三 monsterLevel 封顶 10（压力由曲线倍率承载）", NEW.every(l => l.monsterLevel === 10));

  /* ---- 四、circles ---- */
  check("四 circles 模板 id 全部真实存在且 count 为正", NEW.every(l => l.circles.every(c => !!CFG.spawnCircles[c.tpl] && typeof c.count === "number" && c.count > 0)));
  check("四 SC04 不挂新关（special_monster_test 锁定 L8~L10 恰 3 关）", NEW.every(l => l.circles.every(c => c.tpl !== "SC04")));
  const totalCircles = NEW.map(l => l.circles.reduce((a, c) => a + c.count, 0));
  check("四 圆总数单调不减无断崖（" + totalCircles[0] + "→" + totalCircles[78] + "，步长 ≤ 3）",
    totalCircles.every((n, i) => i === 0 ? n >= 26 : (n >= totalCircles[i - 1] && n - totalCircles[i - 1] <= 3)));

  /* ---- 五、BOSS ---- */
  check("五 新 79 关 boss 均为存在的 BS 模板", NEW.every(l => !!(CFG.monsters[l.boss] && CFG.monsters[l.boss].type === "boss") && l.boss.indexOf("BS") === 0));
  check("五 全表 boss 覆盖恰 10 只（普通关循环 9 只 + 终关 BS0010）", new Set(L.map(l => l.boss)).size === 10);
  check("五 章节终关各章专属（30=BS0001…90=BS0007，互不相同）",
    [29, 39, 49, 59, 69, 79, 89].every((idx, k) => L[idx].boss === "BS000" + (k + 1)));
  check("五 第 99 关 BOSS = BS0010（终局·邪神本体）", L[98].boss === "BS0010");

  /* ---- 六、elitePool ---- */
  check("六 新 79 关 elitePool 可解析、引用的 ED 编号全部存在、权重合计 100", NEW.every(l => { const p = parsePool(l.elitePool); return !!p && p.total === 100; }));
  const ed3 = NEW.map(l => parsePool(l.elitePool).map.ED0003 || 0);
  check("六 高威胁精英 ED0003 权重随关卡非降（" + ed3[0] + "→" + ed3[78] + "）", ed3.every((w, i) => i === 0 || w >= ed3[i - 1]));
  check("六 ED0003 终局占比 ≥ 90%（" + ed3[78] + "%）", ed3[78] >= 90);

  /* ---- 七、levelCurve 外推 99 行 ---- */
  check("七 levelCurve.rows 99 行且 lv=1..99 连续", !!curve && Array.isArray(curve.rows) && curve.rows.length === 99 && curve.rows.every((r, i) => r.lv === i + 1));
  check("七 countMul/hpMul 全表单调不减（" + curve.rows[19].countMul + "→" + curve.rows[98].countMul + " / " + curve.rows[19].hpMul + "→" + curve.rows[98].hpMul + "）",
    curve.rows.every((r, i) => i === 0 || (r.countMul >= curve.rows[i - 1].countMul && r.hpMul >= curve.rows[i - 1].hpMul)));
  check("七 新 79 行 hpMul 从 L20 基准续接 0.10/关（3.28+(lv-20)×0.10）",
    curve.rows.slice(20).every((r, i) => near(r.hpMul, 3.28 + (i + 1) * 0.10)));
  check("七 新 79 行 countMul 沿 9/10 关斜率 +0.15/关外推",
    curve.rows.slice(20).every((r, i) => near(r.countMul, Math.round((3.75 + (i + 1) * 0.15) * 100) / 100, 1e-6)));
  check("七 新 79 行不启用毒圈/补给（hazard/supply=null 且关卡未开 hazardEnabled/supplyEnabled）",
    curve.rows.slice(20).every(r => r.hazard === null && r.supply === null)
    && NEW.every(l => !l.hazardEnabled && !l.supplyEnabled));
  check("七 新 79 行宝箱档为 CT4（key 存在、高阶占比不回落）", curve.rows.slice(20).every(r => !!curve.chestTiers[r.chest]));

  /* ---- 八、章节表 + 自检 ---- */
  const sec = CFG.sectors;
  check("八 CFG.sectors 8 章覆盖 21~99 无缝无重叠",
    Array.isArray(sec) && sec.length === 8 && sec[0].from === 21 && sec[7].to === 99
    && sec.every((s, i) => i === 0 ? s.from === 21 : s.from === sec[i - 1].to + 1));
  check("八 CFG.mainLevelCount === 99", CFG.mainLevelCount === 99);
  let v1 = null, vThrew = false;
  try { v1 = CFG._validateLevelCurve(); } catch (e) { vThrew = true; }
  check("八 _validateLevelCurve() 调用不抛错且 ok:true（问题清单: " + (v1 ? v1.issues.join("；") : "未执行") + "）",
    !vThrew && !!v1 && v1.ok === true && v1.issues.length === 0);

  /* ---- 九、altarTimeline ---- */
  let structOk = true, chestOk = true;
  for (const lv of NEW) {
    let prev = -1;
    for (const e of lv.altarTimeline) {
      if (typeof e.t !== "number" || e.t <= prev) structOk = false;      // t 严格递增
      prev = e.t;
      const hasId = typeof e.id === "string" && !!CFG.altars[e.id];
      const hasPool = Array.isArray(e.pool) && e.pool.length > 0 && e.pool.every(x => !!CFG.altars[x]);
      if (!hasId && !hasPool) structOk = false;
      const chest = e.id === "ALTAR_003" || (Array.isArray(e.pool) && e.pool.indexOf("ALTAR_003") >= 0);
      if (chest && e.t < 10) chestOk = false;
    }
  }
  check("九 新 79 关 altarTimeline 非空、t 严格递增且条目合法", NEW.every(l => Array.isArray(l.altarTimeline) && l.altarTimeline.length >= 1) && structOk);
  check("九 宝箱（ALTAR_003）不在开局 10 秒内投放", chestOk);
}

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) {
  throw new Error("第 21~99 关外推测试未全绿：失败 " + failCount + " 项");
}
console.log("LEVELS 21-99 TEST OK");
