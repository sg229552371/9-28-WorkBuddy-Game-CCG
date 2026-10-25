/* 表现层反馈 + 风险缓解回归测试（node feedback_systems_test.js）
 * 风格参考 level_tuning_test.js：Node vm 沙箱加载 js/config.js + js/core.js 后跑断言。
 * 覆盖（2026-10-25 批次）：
 *   一、config.js / core.js 无 DOM 沙箱独立加载不抛错
 *   二、风险缓解②：难度曲线锚点插值 CFG._curveLerp —— lv5~lv9 中间锚点与 rows 手调表对拍
 *   三、风险缓解①：结晶软上限 CFG._crystalSoftCap —— 800 阈值 / 超出衰减 90% / 边界
 *   四、SFX 纯函数：命中三档音高 _hitTier / 射击变调 _shootPitch 锚点
 *   五、CFG.feedback 结构完整（暴击/顿帧/飘字/红脉冲数值收口）
 *   六、版本三处一致：index.html APP_VERSION / meta / core.js Assets.buildVersion
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 时非零退出。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---- 一、无 DOM 沙箱加载 ---- */
let CFG = null, SFX = null;
let loadOk = true;
try {
  const ctx = vm.createContext({
    console: console,
    window: {},                                  // core.js 桩：无 AudioContext → SFX 合成路径静默跳过
    document: { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener: () => {} },
    setTimeout: () => 0, clearTimeout: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8"), ctx, { filename: "js/core.js" });
  vm.runInContext("this.__X = { CFG: CFG, SFX: SFX };", ctx);
  CFG = ctx.__X.CFG; SFX = ctx.__X.SFX;
} catch (e) {
  loadOk = false;
  console.log("FAIL 沙箱加载抛出异常: " + (e && e.message));
}
check("一 config.js + core.js 无 DOM 沙箱加载不抛错", loadOk && CFG && SFX);

if (CFG) {
  /* ---- 二、风险缓解②：锚点插值与 rows 手调表对拍（lv5~lv9 中间锚点） ---- */
  const rows = CFG.levelCurve.rows, anchors = CFG.levelCurve.anchors;
  check("二1 锚点结构：countMul/hpMul 均含 lv1/5/10/20 锚点",
    anchors && [1, 5, 10, 20].every(lv => anchors.countMul[lv] != null && anchors.hpMul[lv] != null));
  check("二2 锚点取自 rows 原值（lv5/lv10/lv20 行）",
    [5, 10, 20].every(lv => {
      const r = rows[lv - 1];
      return r.countMul === anchors.countMul[lv] && r.hpMul === anchors.hpMul[lv];
    }));
  let lerpOk = true;
  for (let lv = 2; lv <= 9; lv++) {   // 中间锚点带：插值曲线须与手调表贴合（容差 0.06）
    const r = rows[lv - 1];
    const lc = CFG._curveLerp(anchors.countMul, lv), lh = CFG._curveLerp(anchors.hpMul, lv);
    if (Math.abs(lc - r.countMul) > 0.06 || Math.abs(lh - r.hpMul) > 0.06) lerpOk = false;
  }
  check("二3 lv2~lv9 锚点插值与 rows 手调表贴合（容差 0.06，防 6~9 关陡变）", lerpOk);
  let monoOk = true, pc = 0, ph = 0;
  for (let lv = 1; lv <= 20; lv++) {
    const c = CFG._curveLerp(anchors.countMul, lv), h = CFG._curveLerp(anchors.hpMul, lv);
    if (c < pc || h < ph) monoOk = false;
    pc = c; ph = h;
  }
  check("二4 插值曲线 lv1~lv20 单调不减（无断崖回落）", monoOk);
  check("二5 超界取端点：lv0 → 首锚点 / lv99 → 末锚点",
    CFG._curveLerp(anchors.countMul, 0) === anchors.countMul[1] &&
    CFG._curveLerp(anchors.countMul, 99) === anchors.countMul[20]);

  /* ---- 三、风险缓解①：结晶软上限 ---- */
  const cap = CFG.crystalSoftCap;
  check("三1 配置：perRun=800 / keepRatio=0.1（超出部分衰减 90%）", cap.perRun === 800 && cap.keepRatio === 0.1);
  check("三2 未超上限原样发放", CFG._crystalSoftCap(500) === 500 && CFG._crystalSoftCap(800) === 800);
  check("三3 超上限衰减：1000 → 800 + 200×0.1 = 820", CFG._crystalSoftCap(1000) === 820);
  check("三4 极端值：3000 → 1020；0/负数安全", CFG._crystalSoftCap(3000) === 1020 && CFG._crystalSoftCap(0) === 0);

  /* ---- 四、SFX 纯函数锚点 ---- */
  check("四1 命中三档音高：小伤/中伤/大伤 → 0/1/2 档",
    SFX._hitTier(5, 1000) === 0 && SFX._hitTier(100, 1000) === 1 && SFX._hitTier(200, 1000) === 2);
  check("四2 射击变调：CD 越长音越低（0.4s > 0.9s），区间 [0.8, 1.4]",
    SFX._shootPitch(0.4) > SFX._shootPitch(0.9) &&
    SFX._shootPitch(0.4) <= 1.4 && SFX._shootPitch(3.0) >= 0.8);

  /* ---- 五、CFG.feedback 结构 ---- */
  const fb = CFG.feedback;
  check("五1 暴击：概率/倍率/最低伤害收口（chance>0, dmgMul=1.5）",
    fb && fb.crit && fb.crit.chance > 0 && fb.crit.dmgMul === 1.5 && fb.crit.minDmg > 0);
  check("五2 顿帧：时长 30~50ms 区间 + 带冷却防连刷 + BOSS 豁免",
    fb.hitstop && fb.hitstop.dur >= 0.03 && fb.hitstop.dur <= 0.05 &&
    fb.hitstop.cooldown > 0 && fb.hitstop.bossExempt === true);
  check("五3 飘字：抖动偏移 > 0（防重叠）+ 暴击放大 1.5", fb.float && fb.float.jitter > 0 && fb.float.critScale === 1.5);
  check("五4 撤离红脉冲：呼吸参数完整（基色/透明度/角频率/边宽）",
    fb.extractPulse && fb.extractPulse.baseAlpha > 0 && fb.extractPulse.ampAlpha > 0 &&
    fb.extractPulse.speed > 0 && fb.extractPulse.edge > 0);
  check("五5 心跳：60→120BPM 收口 CFG.audio.heartbeat",
    CFG.audio.heartbeat && CFG.audio.heartbeat.bpmStart === 60 && CFG.audio.heartbeat.bpmEnd === 120);
}

/* ---- 六、版本三处一致 ---- */
try {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const meta = html.match(/<meta name="app-version" content="(\d+)"/);
  const app = html.match(/APP_VERSION\s*=\s*"(\d+)"/);
  const build = /Assets\.buildVersion = "(\d+)"/.exec(fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8"));
  check("六 版本三处一致且 ≥ 20261025",
    meta && app && build && meta[1] === app[1] && app[1] === build[1] && Number(build[1]) >= 20261025);
} catch (e) { check("六 版本三处一致", false); }

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount > 0 ? 1 : 0);
