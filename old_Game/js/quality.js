/* ============================================================
 * quality.js — 画质三档 / 自动降档 / 性能护栏 / 素材加载遮罩
 * ------------------------------------------------------------
 * 21.16 物理搬移：从原 js/main.js 整段剪切而来，未改一行逻辑。
 * 职责：
 *   · 20.5 性能护栏（perfFrameStats / PerfGuard / _perfNow）：帧率监测、卡死告警、诊断数据源
 *   · 20.5 素材加载遮罩（LoadingOverlay）：纯 DOM 进度遮罩，接口缺失即隐藏
 *   · 23.x 画质三档 + 自动降档（QUALITY_NAMES / _clampQuality / _defaultQuality /
 *     _qualityFromDevice / _migrateQuality / _autoDowngrade* / renderQualitySeg）
 * 依赖方向：依赖全局 G / CFG / UI / isTouchDevice（main.js 提供）；Game 对象提供
 *   Game.qualityLevel / Game.setQualityLevel（定义在 main.js，运行时调用，本文件不写 Game）。
 * 加载顺序：必须在 js/main.js 之前——main.js 顶层 Game.loadSettings() 会调用
 *   _defaultQuality() / _migrateQuality()（本文件提供）。
 * ============================================================ */

/* ============================================================
 * 20.5 性能护栏（帧率监测 / 长帧告警 / 诊断数据源）
 * —— 不侵入 game.js：在 main.js 的 Game.loop 内挂轻量打点（见 loop 顶部），
 *    只记录 + 按需提示，正常时零打扰（不写 console、不弹 UI）。
 * ============================================================ */
/* 纯函数：帧时间序列（ms）→ 统计量。可独立调用，便于单测。
 *   avg   平均帧耗时；max 最长；p50/p95 分位（最近窗口）；
 *   stuck 卡死帧计数（> 阈值，默认 80ms）；ms 换算 FPS。
 * 空数组：avg/max/p50/p95=0，fps=0，stuck=0（不抛错）。 */
function perfFrameStats(frames, stuckMs) {
  const n = frames ? frames.length : 0;
  if (!n) return { count: 0, avg: 0, max: 0, p50: 0, p95: 0, stuck: 0, fps: 0 };
  const thr = stuckMs == null ? 80 : stuckMs;
  const sorted = frames.slice().sort((a, b) => a - b);
  let sum = 0, max = 0, stuck = 0;
  for (let i = 0; i < n; i++) { const v = frames[i]; sum += v; if (v > max) max = v; if (v > thr) stuck++; }
  const pick = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const avg = sum / n;
  return {
    count: n, avg: avg, max: max,
    p50: pick(0.5), p95: pick(0.95), stuck: stuck,
    fps: avg > 0 ? 1000 / avg : 0,
  };
}
/* 帧护栏：滑动窗口采样 + 卡死告警（带冷却）。UI 为可选注入（默认运行时取全局 UI）。 */
const PerfGuard = {
  WINDOW: 60,       // 滑动窗口：最近 60 帧
  STUCK_MS: 80,     // 单帧 > 此值计入「卡死帧」
  ALERT_MS: 150,    // 连续 > 此值 2 帧 → 告警
  ALERT_RUN: 2,     // 连续阈值帧数
  COOLDOWN_MS: 30000,   // 告警冷却：30s 内不重复提示
  /* ② 自动降档阈值（供 _autoDowngradeTick 读取；集中在此便于调参/测试） */
  DOWNGRADE_MS: 100,          // 帧耗时 p95 超此值 → 计入「高帧耗时」
  DOWNGRADE_RUN: 90,          // 连续高帧耗时帧数（≈1.5 秒 @60fps）→ 触发降档
  DOWNGRADE_COOLDOWN_MS: 20000,   // 降档冷却：20s 内不再降
  frames: [],       // 最近帧间隔（ms）
  lastT: null,      // 上一采样时间戳（null = 未开始，避免首帧脏数据）
  consecStuck: 0,   // 连续 > ALERT_MS 的帧计数
  lastAlertAt: -Infinity,   // 上次告警时间（performance.now 口径；-Inf 保证首次必告警）
  maxStuckMs: 0,    // 历史最长单帧（诊断展示用）
  alertCount: 0,    // 累计告警次数（诊断展示用）
  /* 每帧调用一次；now 为 rAF 时间戳（ms）。返回本帧耗时，便于测试。 */
  sample(now, ui) {
    if (typeof now !== "number" || !isFinite(now)) return 0;   // 桩/异常帧：丢弃
    if (this.lastT == null) { this.lastT = now; return 0; }    // 首帧无间隔
    const dt = now - this.lastT;
    this.lastT = now;
    if (dt < 0) return 0;   // 时间倒流（页面切后台等）丢弃
    this.frames.push(dt);
    if (this.frames.length > this.WINDOW) this.frames.shift();
    if (dt > this.maxStuckMs) this.maxStuckMs = dt;
    // 卡死连击：<= ALERT_MS 立即清零；> ALERT_MS 累加
    if (dt > this.ALERT_MS) this.consecStuck++;
    else this.consecStuck = 0;
    if (this.consecStuck >= this.ALERT_RUN) {
      this.consecStuck = 0;   // 触发后清空，避免每帧重复触发
      this._maybeAlert(now, Math.round(dt), ui);
    }
    return dt;
  },
  /* 触发告警（含冷却）。now 缺省取 performance.now。 */
  _maybeAlert(now, ms, ui) {
    const t = (typeof now === "number") ? now : _perfNow();
    if (t - this.lastAlertAt < this.COOLDOWN_MS) return false;   // 冷却中：静默
    this.lastAlertAt = t;
    this.alertCount++;
    const target = ui || (typeof UI !== "undefined" ? UI : null);
    if (target && typeof target.toast === "function") {
      target.toast(`⚠ 检测到卡顿（帧耗时 ${ms}ms）——可在设置查看诊断`, "bad", 4000);
    }
    return true;
  },
  /* 诊断快照：供设置面板展示。窗口统计 + 历史最长卡死帧。 */
  snapshot() {
    const st = perfFrameStats(this.frames, this.STUCK_MS);
    st.maxStuckMs = Math.round(this.maxStuckMs);
    st.alertCount = this.alertCount;
    return st;
  },
  /* 清空采样（测试/诊断重置用） */
  reset() { this.frames.length = 0; this.lastT = null; this.consecStuck = 0; this.maxStuckMs = 0; },
};
function _perfNow() {
  return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
}

/* 20.5 素材加载遮罩（纯 DOM/CSS，不进入主循环）：
 * - 启动时显示「载入素材」遮罩 + 百分比；进度来自 getProgress() 注入的回调（Assets.progress）。
 * - 防御策略：getProgress() 返回 null（接口缺失/结构异常）→ **立即隐藏**，绝不阻塞进入游戏；
 *   轮询 ~100ms；done=true 或超时（6s）→ 淡出隐藏。
 * - 桩/无 DOM 环境：静默降级（不抛错）。 */
const LoadingOverlay = {
  POLL_MS: 100,
  TIMEOUT_MS: 6000,
  _timer: null,
  _startAt: 0,
  show(getProgress) {
    const ov = document.getElementById("loading-overlay");
    if (!ov) return;                       // 桩环境无该 DOM：跳过
    const bar = document.getElementById("loading-bar");
    const txt = document.getElementById("loading-text");
    ov.classList.remove("hidden", "loading-fade");
    this._startAt = _perfNow();
    // 接口缺失 → 立即隐藏（清除可能的加载态），不阻塞
    const first = getProgress ? getProgress() : null;
    if (first === null || first === undefined) { this.hide(true); return; }
    this._set(first, bar, txt);
    if (first.done) { this.hide(); return; }   // 同步已完成：淡出，不必轮询
    const tick = () => {
      const p = getProgress ? getProgress() : null;
      // 接口中途消失 → 立即隐藏（防御）
      if (p === null || p === undefined) { this.hide(true); return; }
      this._set(p, bar, txt);
      if (p.done || _perfNow() - this._startAt > this.TIMEOUT_MS) { this.hide(); return; }
      this._timer = setTimeout(tick, this.POLL_MS);
    };
    this._timer = setTimeout(tick, this.POLL_MS);
  },
  _set(p, bar, txt) {
    const loaded = Number(p.loaded) || 0, total = Number(p.total) || 0;
    const pct = total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : 0;
    if (bar) bar.style.width = pct + "%";
    if (txt) txt.textContent = total > 0 ? `载入素材 ${loaded}/${total}（${pct}%）` : "载入素材…";
  },
  hide(immediate) {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const ov = document.getElementById("loading-overlay");
    if (!ov) return;
    if (immediate) { ov.classList.add("hidden"); return; }
    ov.classList.add("loading-fade");     // 淡出（CSS transition）
    setTimeout(() => ov.classList.add("hidden"), 320);
  },
};
/* ============================================================
 * 23.x 画质三档（低/中/高）+ 自动降档 —— 独立区块（文件末尾追加；§5.45）
 * ------------------------------------------------------------
 * 背景：原有只有一个粗粒度开关 lowQuality（布尔），无法表达「中档」。
 * 本区块提供统一入口 Game.qualityLevel / Game.setQualityLevel(n)，并维护向后兼容：
 *   设置 quality=0 时同步 G.settings.lowQuality = true，否则 false ——
 *   这样 game.js 的 isLowQuality()（读 G.settings.lowQuality / window.__lowQuality）**一行都不用改**。
 *
 * 回归红线：defaultQuality 只在「无任何画质存档」时被判为「高」（=2）；quality=2 时 lowQuality=false，
 *   渲染行为与改造前逐位一致（渲染层所有降级都包在 isLowQuality() 分支里）。
 *
 * 全部函数防御式：无 DOM / 无 navigator 的测试桩环境下加载不抛错；自动降档开关（_autoDowngrade 的
 * 帧计数状态）只在本区块内维护，不写 globalThis（避免污染裸沙箱的对象环境）。
 * ⚠️ 提示文案绝不出现英文 error/FAIL（门禁 grep 判失败），只写中文。
 * ============================================================ */

/* 画质档位常量与中文名（低=0 / 中=1 / 高=2） */
var QUALITY_NAMES = { 0: "低", 1: "中", 2: "高" };

/* 把任意输入钳制为合法档位（0/1/2）；非法值回落到高（升级/存档异常时保持最清晰，避免误降级）。 */
function _clampQuality(n) {
  var v = Math.round(Number(n));
  if (!(v >= 0 && v <= 2)) return 2;
  return v;
}

/* 设备能力初判默认档（④）：
 *   navigator.deviceMemory（Chrome 有，单位 GB）：≤4 → 低；≥8 → 高；中间 → 中；
 *   缺 deviceMemory → 触屏且短边 ≤480 → 中；否则（桌面）→ 高。
 * 防御式：无 navigator / 无 window 一律返回高（保守：不降级 → 渲染行为与改造前一致）。 */
function _defaultQuality() {
  try {
    var dm = (typeof navigator !== "undefined" && navigator && typeof navigator.deviceMemory === "number")
      ? navigator.deviceMemory : undefined;
    var vw = (typeof window !== "undefined" && window.innerWidth) || 0;
    var vh = (typeof window !== "undefined" && window.innerHeight) || 0;
    return _qualityFromDevice(dm, isTouchDevice(), vw, vh);
  } catch (e) { return 2; }
}

/* 23.x 默认档判定的**纯函数内核**（供测试驱动直接注入参数，不依赖真实 navigator/window）。
 * 与 _defaultQuality() 的判定规则严格一致——后者只是从环境读取参数后转调本函数。
 * 抽出来的动因：Node 沙箱里改 navigator.deviceMemory 后需跨 vm 边界取值，写起来既绕又易错；
 * 参数显式传入后，测试可以直接断言「给定设备能力 → 应得档位」这条纯逻辑。
 * @param {number|undefined} dm        deviceMemory（GB），undefined = 浏览器未提供
 * @param {boolean} touch              是否触屏设备
 * @param {number} vw,vh               视口尺寸（touch 且无 dm 时用于判定短边） */
function _qualityFromDevice(dm, touch, vw, vh) {
  if (typeof dm === "number") {
    if (dm <= 4) return 0;
    if (dm >= 8) return 2;
    return 1;
  }
  var shortSide = Math.min(vw || 0, vh || 0);
  if (touch && shortSide > 0 && shortSide <= 480) return 1;
  return 2;
}

/* ④ 老存档迁移：localStorage 里只有旧布尔 lowQuality（无 quality 字段）→ quality = lowQuality ? 0 : 2。
 * 注意必须判 hasOwnProperty：loadSettings 的默认模板里已带 quality 字段，若用 typeof 判断会把
 * 「老存档未覆盖默认模板」误判为已有设置，从而读不到旧 lowQuality 的意图。 */
function _migrateQuality() {
  var s = G.settings;
  if (!s) return;
  // 老存档 v1 不含 quality → Object.assign 后 quality 仍是默认模板值；用 `quality===undefined` 无法区分。
  // 这里用「迁移标记」判定：首次迁移后写入 migrated=true，此后不再迁移。
  if (s.migrated !== true) {
    if (Object.prototype.hasOwnProperty.call(s, "lowQuality") && s.lowQuality === true) s.quality = 0;
    // lowQuality=false / 缺失 → 保持设备初判默认档（前面 _defaultQuality 的语义）
    s.migrated = true;
  }
  s.quality = _clampQuality(s.quality);
  s.lowQuality = (s.quality === 0);   // 立即同步布尔镜像（loadSettings 用，不依赖 applySettings）
}

/* ② 自动降档帧计数状态（本区块私有，不污染 globalThis）。
 *   run：连续 > DOWNGRADE_MS 的帧计数；lastAt：上次降档时间（冷却用）。 */
var _autoDowngrade = { run: 0, lastAt: -Infinity };

/* ② 自动降档主逻辑：连续 N 帧帧间隔 p95 超阈值 → 逐档下调（2→1→0，到 0 停止）。
 *   仅采样既有 PerfGuard.frames（主循环每帧 PerfGuard.sample(t) 已填），无 DOM 依赖。
 *   冷却：降档后 20 秒内不再降；手动覆盖后 G.autoDowngradeDisabled → 整段短路。
 *   不自动回升（避免画质在高低档间反复跳变）。 */
function _autoDowngradeTick(now) {
  var PG = (typeof PerfGuard !== "undefined") ? PerfGuard : null;
  if (!PG || !PG.frames) return;                       // 桩环境无护栏：静默跳过
  // 关条件：用户手动覆盖 / 无 settings / 已到最低档
  if (G.autoDowngradeDisabled === true) { _autoDowngrade.run = 0; return; }
  if (!G.settings || typeof G.settings.quality !== "number") return;
  var cur = _clampQuality(G.settings.quality);
  if (cur <= 0) { _autoDowngrade.run = 0; return; }

  var DOWNGRADE_MS = (PG.DOWNGRADE_MS != null) ? PG.DOWNGRADE_MS : 100;   // 阈值：帧耗时 p95 > 100ms
  var DOWNGRADE_RUN = (PG.DOWNGRADE_RUN != null) ? PG.DOWNGRADE_RUN : 90; // 连续 90 帧 ≈ 1.5 秒
  var DOWNGRADE_COOLDOWN_MS = (PG.DOWNGRADE_COOLDOWN_MS != null) ? PG.DOWNGRADE_COOLDOWN_MS : 20000;

  // 帧间隔序列 → 统计 p95（复用 perfFrameStats 纯函数，保持口径一致）
  var st = perfFrameStats(PG.frames, PG.STUCK_MS == null ? 80 : PG.STUCK_MS);
  if (st.count < 2) { _autoDowngrade.run = 0; return; }

  if (st.p95 > DOWNGRADE_MS) _autoDowngrade.run++;
  else _autoDowngrade.run = 0;

  if (_autoDowngrade.run < DOWNGRADE_RUN) return;
  _autoDowngrade.run = 0;
  var t = (typeof now === "number" && isFinite(now)) ? now : _perfNow();
  if (t - _autoDowngrade.lastAt < DOWNGRADE_COOLDOWN_MS) return;   // 冷却中：静默不降
  _autoDowngrade.lastAt = t;
  var next = cur - 1;
  var M = (typeof Game !== "undefined") ? Game : null;
  if (M && typeof M.setQualityLevel === "function") M.setQualityLevel(next);   // 内部同步 lowQuality 镜像 + 落盘
  if (typeof UI !== "undefined" && UI.renderSettings) UI.renderSettings();   // 刷新设置页选中态/提示
  if (typeof UI !== "undefined" && typeof UI.toast === "function") {
    UI.toast("画质已自动下调为「" + QUALITY_NAMES[next] + "」以保证流畅", "");
  }
}

/* 供测试/调试重置自动降档内部状态（不影响画质档位本身）。 */
function _autoDowngradeReset() { _autoDowngrade.run = 0; _autoDowngrade.lastAt = -Infinity; }

/* ============================================================
 * 23.x 画质三档：设置页选中态与提示渲染（末尾独立区块；§5.45）
 * ------------------------------------------------------------
 * 动因：bindEvents 只负责「点击 → setQualityLevel」，而选中态高亮与
 *      「自动降档已关闭」提示需要在每次打开设置页时按当前状态重绘。
 *      ui.js 的 renderSettings 只插一行调用，实现集中在此，避免在 ui.js 里
 *      再起一套画质语义（两处判定迟早会分叉）。
 * 防御式：无 DOM（Node 桩/无头）时全程静默返回，不影响任何既有流程。
 * ============================================================ */

/* 设置页画质分段控件：按当前档位打选中态 + 提示自动降档状态。
 * 元素缺失（旧版本 HTML / 测试桩）一律跳过，绝不抛错。 */
function renderQualitySeg() {
  try {
    if (typeof document === "undefined" || !document) return;
    var box = document.getElementById("set-quality");
    if (!box) return;
    var cur = (typeof Game !== "undefined" && Game.qualityLevel) ? Game.qualityLevel() : 2;
    var btns = box.querySelectorAll ? box.querySelectorAll(".seg-btn") : [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var lv = Number(b.dataset && b.dataset.quality);
      var on = (lv === cur);
      if (b.classList) {
        if (b.classList.toggle) b.classList.toggle("selected", on);
        else if (on) b.classList.add("selected");
        else b.classList.remove("selected");
      }
    }
    /* 提示位：仅在「自动降档已被手动覆盖关闭」时给出说明，平时留空不占视觉注意力 */
    var hint = document.getElementById("set-quality-hint");
    if (hint) {
      hint.textContent = (G.autoDowngradeDisabled === true)
        ? "已按你的选择固定画质，本局不再自动下调"
        : "";
    }
  } catch (e) { /* 渲染失败绝不影响设置页其它项的显示 */ }
}
