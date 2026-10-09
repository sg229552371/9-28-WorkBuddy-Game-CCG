/* ============================================================
 * core.js — 工具函数 / 事件总线 / 空间哈希 / 素材加载与抠图
 * ============================================================ */
"use strict";

/* ---------- 工具 ---------- */
const U = {
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(this.rand(min, max + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); },
  // 权重抽取：weights = {key: w}
  weightedPick(weights) {
    let total = 0; for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  },
  fmt(n) { return Math.round(n); },
};

/* ---------- 事件总线（13.14） ---------- */
const EventBus = {
  _map: {},
  on(ev, fn) { (this._map[ev] = this._map[ev] || []).push(fn); },
  off(ev, fn) { const l = this._map[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
  emit(ev, data) { const l = this._map[ev]; if (l) for (const fn of l.slice()) fn(data); },
};

/* ---------- 空间哈希（15.5 性能关键技术） ---------- */
class SpatialHash {
  constructor(cell = 96) { this.cell = cell; this.buckets = new Map(); this.tick = 0; this._qSeq = 0; }
  _key(cx, cy) { return cx * 4096 + cy; }   // 整数键，避免字符串开销
  clear() { this.buckets.clear(); this.tick++; }   // tick 自增（不清零）：让上一帧的 _qhTick 标记自然失效
  insert(obj, x, y, r) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = this._key(cx, cy);
      let b = this.buckets.get(k);
      if (!b) { b = []; this.buckets.set(k, b); }
      b.push(obj);
    }
  }
  // 查询圆邻域内的候选
  query(x, y, r, out) {
    /* 去重标记：用「本帧序号 + 本次查询序号」的组合值，避免每帧给数万对象反复写属性。
     * ⚠️ 踩坑记录（21.14）：最初实现写成 `const tick = ++this.tick`（每次 query 自增），
     *    看似 O(1) 去重，实则让每个候选对象每帧被写入上万次 `_qhTick` —— V8 里这会造成
     *    隐藏类（hidden class）反复变更 + 写屏障开销，3000 敌时 p95 从 4.1ms 反涨到 9.4ms。
     *    改为「帧序号在 clear() 递增、查询序号在 query 内递增，两者拼成一个整数标记」后，
     *    同帧多次查询互不干扰，且标记值单调递增不与历史值冲突。 */
    const tick = this.tick * 4096 + (++this._qSeq);
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.buckets.get(this._key(cx, cy));
      if (b) for (const o of b) if (o._qhTick !== tick) { o._qhTick = tick; out.push(o); }
    }
    return out;
  }
}

/* ---------- 素材加载与背景抠图（洪泛填充，从边缘剔除背景色） ---------- */
const Assets = {
  images: {},   // key -> HTMLCanvasElement（已抠图）
  // 只读进度状态（供 UI 层轮询显示加载条）：{loaded,total,done}。
  // loaded = 图片解码完成数（含失败，不算卡住）；done = fit 分帧装载完成数；done===total 表示精灵全部就绪。
  progress: { loaded: 0, total: 0, done: false },
  async load(manifest) {
    const keys = Object.keys(manifest);
    this.progress = { loaded: 0, total: keys.length, done: false };
    const jobs = [];
    for (const key of keys) {
      jobs.push(this._loadOne(key, manifest[key].src, manifest[key].tbg));
    }
    await Promise.all(jobs);
    this.fillSprites(manifest);
  },
  /* 20.4 线C：按 manifest 全量填充 G.sprites（键名 = manifest 键），让 30+ 张新图真正上场。
   * - main.js 启动时仅显式赋值 hero/enemy00/08/16/22 共 5 键（并附加尺寸裁剪），
   *   本方法不覆写已存在键 → main.js 仍是那 5 键的权威（裁剪语义保持不变）；
   * - 加载失败的键（Assets.images 无该项）置 null，渲染侧对 null 已有色块兜底（game.js 渲染 if(img) 分支）；
   * - defId 前缀补零映射（NM/ED→enemyNN、H001→hero 等）由 spriteFor 负责，此处只负责装载。
   * - 无 G（如仅桩加载 config+core 的测试沙箱）时静默跳过，保持 core.js 可独立测试。
   * - 分帧（消除首屏长任务）：36 次 fit 不再同一 tick 跑完，改由 _scheduleBatch 每帧只做
   *   FIT_PER_FRAME 张（默认 4），链式推进；未就绪键保持「不存在」，渲染侧 if(img) 走色块兜底。
   *   调度优先 requestAnimationFrame（顺滑不卡帧），无则退 setTimeout(0)；完成后置 progress.done。 */
  fillSprites(manifest) {
    if (typeof G === "undefined" || !G.sprites) return;
    const keys = Object.keys(manifest).filter((k) => !(k in G.sprites));   // 只装未占用键（main.js 5 键不动）
    this.progress.total = Math.max(this.progress.total, Object.keys(manifest).length);
    this.progress.done = false;
    let i = 0;
    const step = () => {
      if (typeof G === "undefined" || !G.sprites) return;    // 中途环境失效则安全停止
      const end = Math.min(i + this.FIT_PER_FRAME, keys.length);   // 本帧配额（每帧最多 N 张）
      for (; i < end; i++) {
        const key = keys[i];
        if (!(key in G.sprites)) G.sprites[key] = this.fit(key, 48);
      }
      this.progress.loaded = i;                              // 已装载（含失败→null）计数
      if (i < keys.length) this._scheduleBatch(step);
      else this.progress.done = true;
    };
    if (keys.length) step();   // 立即启动（首帧同步做一批，保证「不等待」的直觉）
    else this.progress.done = true;
  },
  FIT_PER_FRAME: 4,   // 每帧装载上限；4 张 × <0.5ms ≈ 2ms/帧，远低于长任务阈值
  // 分帧调度：优先 rAF（与渲染同步、不产生宏任务间隙卡顿），退化到 setTimeout(0)
  _scheduleBatch(fn) {
    if (typeof requestAnimationFrame === "function") { requestAnimationFrame(fn); return; }
    setTimeout(fn, 0);
  },
  /* 单张素材加载超时兜底（ms）。小于 BootGuard 的 12 秒首屏看门狗，留足后续 fillSprites 的时间。
   * 触发后按「素材缺失」结算：该键不进 Assets.images，渲染侧既有 if(img) 分支自动走色块兜底。 */
  LOAD_TIMEOUT_MS: 8000,
  _loadOne(key, src, tbg) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;   // 幂等闸门：onload / onerror / 超时 三者只结算一次
      let timer = null;
      const finish = (timedOut) => {
        if (settled) return;
        settled = true;
        if (timer !== null && typeof clearTimeout === "function") { clearTimeout(timer); timer = null; }
        if (timedOut) console.warn("素材加载超时（按缺失降级，缺图走色块渲染）:", src);
        this.progress.loaded = (this.progress.loaded + 1) | 0;
        resolve();
      };
      /* 弱网兜底（会直接导致「启动超时」）：移动网络下请求可能「既不返回也不报错」，
       * onload / onerror 都不触发 → 本 Promise 永不 settle → Promise.all 永不 resolve
       * → main.js 的 `await Assets.load(...)` 永久挂起 → 12 秒后 BootGuard 弹诊断面板。
       * 超时即结算，把「永久卡死」降级为「这张图缺了」，主角团仍能进场。
       * setTimeout 不存在时（极简测试桩）跳过，行为与改造前一致。 */
      if (typeof setTimeout === "function") {
        timer = setTimeout(() => {
          finish(true);
          try { img.src = ""; } catch (e) { /* 置空 src 在个别环境会抛错，忽略即可 */ }
        }, this.LOAD_TIMEOUT_MS);
      }
      img.onload = () => {
        try {
          this.images[key] = tbg ? this._keyOut(img, tbg) : this._toCanvas(img);
        } catch (e) {
          // file:// 协议下 getImageData 会因跨域污染抛 SecurityError：降级为原图，保证游戏可进
          console.warn("素材抠图失败，降级为原图（建议通过 HTTP 预览获得抠图效果）:", src);
          try { this.images[key] = this._toCanvas(img); } catch (e2) { /* 彻底失败则该素材缺失 */ }
        }
        finish(false);
      };
      img.onerror = () => { console.warn("素材加载失败:", src); finish(false); };   // 单张失败不中断队列
      img.src = src;
    });
  },
  _toCanvas(img) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  },
  // tbg: {mode:'black'|'white'|'blue', tol:number}
  _keyOut(img, tbg) {
    const c = this._toCanvas(img);
    const ctx = c.getContext("2d");
    const { width: w, height: h } = c;
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const isBg = (i) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      switch (tbg.mode) {
        case "black": return r < 42 && g < 42 && b < 42;
        case "white": return r > 235 && g > 235 && b > 235;
        case "blue":  return b > 120 && b > r * 1.5 && b > g * 1.5;
      }
      return false;
    };
    // 洪泛填充：只剔除与边缘连通的背景，保留角色内部同色像素
    const visited = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
    for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = y * w + x;
      if (visited[p]) continue;
      visited[p] = 1;
      const i = p * 4;
      if (!isBg(i)) continue;
      px[i + 3] = 0;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    ctx.putImageData(data, 0, 0);
    return c;
  },
  // 裁剪透明边并缩放到目标尺寸，返回离屏 canvas
  /* 性能改造（消除首屏长任务）：
   * 原实现：对 512×512 原图 getImageData 后逐像素（步长 2，65536 次迭代）扫描透明包围盒，
   *   36 张串行 ≈ 76ms 同步阻塞（移动端更慢）；且单次 1:10.7 降采样画质差。
   * 新实现：① 先把原图缩到 PRE_SCAN（默认 64×64）再 getImageData——像素量降 64 倍，
   *   包围盒误差 ≤ 原图 8px，缩到 48px 后视觉无差；② 从**原图**按包围盒裁剪（不损失清晰度）；
   *   ③ 缩放走**逐级减半**（每级 ≤2 倍），移动端画质与速度都优于一次性大比例缩放。
   * 复杂度：O(64×64) 采样 + O(log n) 级缩放，替代 O(512×512) 全图扫描。
   * 语义与调用契约不变：返回带 width/height 的离屏 canvas；找不到内容时回落原图 src。 */
  fit(key, targetH) {
    const src = this.images[key];
    if (!src) return null;
    // ① 低分辨率代理（64×64）用于找透明包围盒：数据量约为原图的 1/64，getImageData 回读代价骤降
    const PS = 64;
    const probe = document.createElement("canvas");
    probe.width = PS; probe.height = PS;
    const pctx = probe.getContext("2d");
    pctx.drawImage(src, 0, 0, PS, PS);
    const sx = src.width / PS, sy = src.height / PS;   // 代理 → 原图坐标比例
    let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
    try {
      const d = pctx.getImageData(0, 0, PS, PS).data;
      for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
        if (d[(y * PS + x) * 4 + 3] > 20) {   // alpha>20 视为前景
          const ox = x * sx, oy = y * sy;
          if (ox < x0) x0 = ox; if (ox > x1) x1 = ox;
          if (oy < y0) y0 = oy; if (oy > y1) y1 = oy;
        }
      }
    } catch (e) {
      // file:// 画布被污染无法读像素：跳过透明边裁剪，直接整图缩放
      x0 = 0; y0 = 0; x1 = src.width; y1 = src.height;
    }
    if (x1 <= x0) return src;   // 代理全透明（或异常）：回落原图
    // ② 从原图按包围盒裁剪（含右/下边 +sx/sy 补齐代理格宽，避免边缘被切）
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(src.width, Math.ceil(x1 + sx)); y1 = Math.min(src.height, Math.ceil(y1 + sy));
    let cw = x1 - x0, ch = y1 - y0;
    if (cw <= 0 || ch <= 0) { x0 = 0; y0 = 0; cw = src.width; ch = src.height; }
    // ③ 逐级减半降采样到目标尺寸（每级 ≤ 2 倍），提升移动端画质
    const scale = targetH / ch;
    return this._halveScale(src, x0, y0, cw, ch, Math.ceil(cw * scale), Math.ceil(targetH));
  },
  // 逐级减半缩放：每次最多减半，直到 ≤ 目标 2 倍，再一次性收尾到精确目标（级数 O(log n)，可忽略开销）
  _halveScale(src, sx, sy, sw, sh, tw, th) {
    let cur = document.createElement("canvas");
    cur.width = Math.max(1, sw); cur.height = Math.max(1, sh);
    cur.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, cur.width, cur.height);
    let cw = cur.width, ch = cur.height;
    while (cw > tw * 2 || ch > th * 2) {   // 逐级减半（每级 ≤2 倍）
      const nw = Math.max(tw, cw >> 1), nh = Math.max(th, ch >> 1);
      const tmp = document.createElement("canvas");
      tmp.width = nw; tmp.height = nh;
      tmp.getContext("2d").drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
      cur = tmp; cw = nw; ch = nh;
    }
    if (cw === tw && ch === th) return cur;
    const out = document.createElement("canvas");
    out.width = tw; out.height = th;
    out.getContext("2d").drawImage(cur, 0, 0, cw, ch, 0, 0, tw, th);   // 末级精确收尾（≤2 倍）
    return out;
  },
};

/* 需要的素材清单（key → 文件 + 背景模式）
 * 全量铺开：enemy00~enemy22（23 张）+ hero00~hero12（13 张）。
 * 实测素材四角 alpha=0（背景已透明），tbg 仅作兜底剔除：黑底 RGB 命中 black 规则，无害。
 * 键名规则 = 类型前缀 + 两位序号（无下划线），与 CFG.monsters[].sprite / CFG.heroes[].sprite 引用一致。 */
const ASSET_MANIFEST = {
  hero:    { src: "assets/hero/hero_00.png", tbg: { mode: "blue" } },
  hero01:  { src: "assets/hero/hero_01.png", tbg: { mode: "black" } },
  hero02:  { src: "assets/hero/hero_02.png", tbg: { mode: "black" } },
  hero03:  { src: "assets/hero/hero_03.png", tbg: { mode: "black" } },
  hero04:  { src: "assets/hero/hero_04.png", tbg: { mode: "black" } },
  hero05:  { src: "assets/hero/hero_05.png", tbg: { mode: "black" } },
  hero06:  { src: "assets/hero/hero_06.png", tbg: { mode: "black" } },
  hero07:  { src: "assets/hero/hero_07.png", tbg: { mode: "black" } },
  hero08:  { src: "assets/hero/hero_08.png", tbg: { mode: "black" } },
  hero09:  { src: "assets/hero/hero_09.png", tbg: { mode: "black" } },
  hero10:  { src: "assets/hero/hero_10.png", tbg: { mode: "black" } },
  hero11:  { src: "assets/hero/hero_11.png", tbg: { mode: "black" } },
  hero12:  { src: "assets/hero/hero_12.png", tbg: { mode: "black" } },
  enemy00: { src: "assets/enemies/enemy_00.png", tbg: { mode: "black" } },
  enemy01: { src: "assets/enemies/enemy_01.png", tbg: { mode: "black" } },
  enemy02: { src: "assets/enemies/enemy_02.png", tbg: { mode: "black" } },
  enemy03: { src: "assets/enemies/enemy_03.png", tbg: { mode: "black" } },
  enemy04: { src: "assets/enemies/enemy_04.png", tbg: { mode: "black" } },
  enemy05: { src: "assets/enemies/enemy_05.png", tbg: { mode: "black" } },
  enemy06: { src: "assets/enemies/enemy_06.png", tbg: { mode: "black" } },
  enemy07: { src: "assets/enemies/enemy_07.png", tbg: { mode: "black" } },
  enemy08: { src: "assets/enemies/enemy_08.png", tbg: { mode: "black" } },
  enemy09: { src: "assets/enemies/enemy_09.png", tbg: { mode: "black" } },
  enemy10: { src: "assets/enemies/enemy_10.png", tbg: { mode: "black" } },
  enemy11: { src: "assets/enemies/enemy_11.png", tbg: { mode: "black" } },
  enemy12: { src: "assets/enemies/enemy_12.png", tbg: { mode: "black" } },
  enemy13: { src: "assets/enemies/enemy_13.png", tbg: { mode: "black" } },
  enemy14: { src: "assets/enemies/enemy_14.png", tbg: { mode: "black" } },
  enemy15: { src: "assets/enemies/enemy_15.png", tbg: { mode: "black" } },
  enemy16: { src: "assets/enemies/enemy_16.png", tbg: { mode: "black" } },
  enemy17: { src: "assets/enemies/enemy_17.png", tbg: { mode: "black" } },
  enemy18: { src: "assets/enemies/enemy_18.png", tbg: { mode: "black" } },
  enemy19: { src: "assets/enemies/enemy_19.png", tbg: { mode: "black" } },
  enemy20: { src: "assets/enemies/enemy_20.png", tbg: { mode: "black" } },
  enemy21: { src: "assets/enemies/enemy_21.png", tbg: { mode: "black" } },
  enemy22: { src: "assets/enemies/enemy_22.png", tbg: { mode: "white" } },
};

/* 精灵键查询：按 defId 数字尾号映射精灵键（不改渲染层即可查询，供 game.js 侧一行接入）
 * 规则：
 *   "NM0010" / "ED0003" 等怪物编号 → 取末尾数字 n → "enemy" + 两位补零（n 0~22）；
 *   "H001"~"H013" 英雄编号        → "hero"（H001 命中主键）/ "hero" + (n-1) 两位补零；
 *   其它（boss "BS0001" 走 CFG.sprite 显式键、无编号 id 等）→ null。
 * 只返回 ASSET_MANIFEST 中真实存在的键，找不到返回 null（调用方应回退默认图）。 */
function spriteFor(defId) {
  if (typeof defId !== "string") return null;
  const m = defId.match(/(\d+)\s*$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const pad = (x) => ("0" + x).slice(-2);
  let key = null;
  if (/^H/i.test(defId)) key = n === 1 ? "hero" : "hero" + pad(n - 1);   // 英雄：H001 → 主键 hero，H002 → hero01
  else if (/^(NM|ED)/i.test(defId)) key = "enemy" + pad(n);              // 怪物：NM0010 → enemy10
  return ASSET_MANIFEST[key] ? key : null;                             // BS 等其它前缀不映射（走显式 sprite 键）
}

/* ---------- SFX（WebAudio 合成音效，零素材；首次用户交互后初始化） ---------- */
const SFX = {
  ctx: null, master: null, last: {},
  init() {
    if (this.ctx || !CFG.audio.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CFG.audio.master;
      this.master.connect(this.ctx.destination);
      BGM.watch();   // 音频就绪后注册 BGM 状态轮询（幂等；main.js 首次交互已调用 init）
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  _env(gainVal, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    g.connect(this.master);
    return g;
  },
  _tone(type, f0, f1, dur, gainVal) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), this.ctx.currentTime + dur);
    o.connect(this._env(gainVal, dur));
    o.start(); o.stop(this.ctx.currentTime + dur);
  },
  _noise(dur, gainVal, hp) {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    src.connect(f); f.connect(this._env(gainVal, dur));
    src.start();
  },
  play(name) {
    if (!CFG.audio.enabled || !this.ctx) return;
    const now = Date.now();
    const th = { shoot: 70, hit: 55, coin: 100, pickup: 100 }[name] || 0;
    if (th && this.last[name] && now - this.last[name] < th) return;   // 高频音效节流
    this.last[name] = now;
    try {
      switch (name) {
        case "shoot": this._tone("square", 880, 320, 0.07, 0.04); break;
        case "hit": this._noise(0.05, 0.07, 900); break;
        case "kill": this._tone("triangle", 440, 90, 0.22, 0.11); break;
        case "hurt": this._tone("sawtooth", 190, 70, 0.18, 0.15); this._noise(0.1, 0.05, 300); break;
        case "skill": this._tone("sawtooth", 140, 520, 0.25, 0.13); break;
        case "levelup": this._tone("triangle", 523, 523, 0.12, 0.11);
          setTimeout(() => this.ctx && this._tone("triangle", 784, 784, 0.18, 0.11), 110); break;
        case "chest": [660, 880, 1180].forEach((f, i) =>
          setTimeout(() => this.ctx && this._tone("sine", f, f, 0.16, 0.09), i * 90)); break;
        case "altar": this._tone("sine", 590, 880, 0.3, 0.09); break;
        case "coin": this._tone("sine", 990, 1320, 0.08, 0.06); break;
        case "extract": [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => this.ctx && this._tone("sine", f, f, 0.22, 0.1), i * 120)); break;
        case "death": this._tone("sawtooth", 220, 40, 0.9, 0.16); break;
        case "wave":   // 撤离波次来袭：低沉警报（两声下行锯齿）
          this._tone("sawtooth", 220, 110, 0.32, 0.12);
          setTimeout(() => this.ctx && this._tone("sawtooth", 196, 98, 0.4, 0.12), 360); break;
        case "shieldBreak":   // 雕像护盾破碎：玻璃碎质感（高频噪声 + 快速下滑高音）
          this._noise(0.35, 0.14, 2400); this._tone("square", 1800, 240, 0.28, 0.07); break;
        case "supply":   // 补给点读条完成：温暖上行琶音
          [392, 494, 587, 784].forEach((f, i) =>
            setTimeout(() => this.ctx && this._tone("sine", f, f, 0.18, 0.08), i * 100)); break;
        case "hazard":   // 进入毒圈：低鸣提示
          this._tone("triangle", 82, 62, 0.45, 0.13); break;
      }
    } catch (e) { /* 音频异常不影响游戏 */ }
  },
};

/* ---------- BGM（WebAudio 程序化合成战斗背景乐，零素材） ----------
 * 结构（BPM 112，16 分音符步进，4 小节 × 16 步循环）：
 *   低音脉冲 —— 每拍 1 次（步 0/4/8/12），三角波 A1/E2/A1/D2 交替，撑住节奏骨架；
 *   琶音序列 —— A 小调紧张感进行，square 波短音、音量极低；第 4 小节降八度制造段落感；
 *   高音点缀 —— 每 2 小节 1 次 sine 高音，避免循环单调。
 * 音量策略：独立 bgmGain 总线挂 SFX.master 之下（CFG.audio.bgmVolume ≈ 0.28），
 *   叠加 master 后远低于音效，不盖过打击反馈。
 * 挂载点：SFX.init() 末尾调 BGM.watch()（main.js 首次交互已调用 init，零 main.js 改动）；
 *   watcher 每 500ms 查 G.state（const G 不挂 window，用 typeof 防未声明），
 *   进 "playing" 起播、离开淡出；visibilitychange 页面隐藏立即停止（防后台堆积）。
 * 注：G 声明于 game.js（const，全局词法环境），core.js 直接引用标识符即可；vm 桩环境
 *   下若 game.js 未加载，typeof 守卫返回 undefined，watcher 静默跳过，不影响现有测试。 */
const BGM = {
  playing: false,
  BPM: 112,
  _gain: null,      // BGM 独立总线（音量 = CFG.audio.bgmVolume）
  _seq: null,       // 音序器 interval 句柄
  _watched: false,  // watcher 注册标记（幂等）
  _watchTimer: null,
  _step: 0,
  // 音序数据：低音脉冲表（0 = 休止）与小调琶音表（各 16 步一小节）
  _bass: [55, 0, 0, 0, 82.4, 0, 0, 0, 55, 0, 0, 0, 73.4, 0, 0, 0],
  _arp:  [220, 261.6, 329.6, 440, 261.6, 329.6, 220, 329.6,
          220, 261.6, 329.6, 440, 293.7, 349.2, 440, 349.2],
  start() {
    if (this.playing) return false;                                    // 重复 start 幂等
    if (!CFG.audio.enabled || !CFG.audio.bgmEnabled) return false;     // 总开关 / BGM 独立开关
    if (!SFX.ctx) { SFX.init(); }
    if (!SFX.ctx || !SFX.master) return false;
    if (!this._gain) {
      try {
        this._gain = SFX.ctx.createGain();
        this._gain.gain.value = CFG.audio.bgmVolume;
        this._gain.connect(SFX.master);
      } catch (e) { return false; }
    }
    try {
      const t = SFX.ctx.currentTime;
      this._gain.gain.cancelScheduledValues(t);          // 复播前清掉淡出曲线
      this._gain.gain.setValueAtTime(CFG.audio.bgmVolume, t);
    } catch (e) { /* 淡出恢复失败不影响起播 */ }
    this.playing = true; this._step = 0;
    const stepMs = 60000 / this.BPM / 4;                 // 16 分音符步长
    this._seq = setInterval(() => this._tick(), stepMs);
    return true;
  },
  stop() {
    if (!this.playing) return false;                     // 未播放时 stop 幂等
    this.playing = false;
    if (this._seq) { clearInterval(this._seq); this._seq = null; }
    if (this._gain && SFX.ctx) {                         // 300ms 淡出，避免戛然而止
      try {
        const g = this._gain.gain, t = SFX.ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.0001, t + 0.3);
      } catch (e) { /* 淡出失败不影响停止 */ }
    }
    return true;
  },
  _tick() {
    if (!this.playing || !SFX.ctx || !this._gain) return;
    const s = this._step % 16, bar = Math.floor(this._step / 16) % 4, t = SFX.ctx.currentTime;
    try {
      const bass = this._bass[s];
      if (bass) this._note("triangle", bass, 0.30, 0.50, t);          // 低音脉冲
      this._note("square", this._arp[s] * (bar === 3 ? 0.5 : 1), 0.09, 0.10, t);  // 琶音
      if (s === 0 && (bar === 1 || bar === 3)) this._note("sine", 1760, 0.5, 0.05, t);  // 高音点缀
    } catch (e) { /* 单步发声失败不中断音序 */ }
    this._step++;
  },
  _note(type, f, dur, vol, t) {   // 定时发声（走 BGM 独立总线，与 SFX 互不干扰）
    const o = SFX.ctx.createOscillator(), g = SFX.ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._gain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  watch() {   // 注册状态轮询 + 页面隐藏暂停（幂等；SFX.init 成功路径内调用）
    if (this._watched) return;
    this._watched = true;
    try {   // 页面隐藏立即停 BGM（后台标签页音频堆积）；恢复可见后由 watcher 下一拍自动重启
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stop();
      });
    } catch (e) { /* 桩环境无 addEventListener 时跳过 */ }
    this._watchTimer = setInterval(() => {
      try {
        const st = (typeof G !== "undefined" && G) ? G.state
          : (typeof window !== "undefined" && window.G ? window.G.state : null);
        if (st === "playing" && !(typeof document !== "undefined" && document.hidden)) {
          if (!this.playing) this.start();
        } else if (this.playing) {
          this.stop();
        }
      } catch (e) { /* 状态异常静默，不影响游戏 */ }
    }, 500);
  },
};

/* ---------- 版本上报（缓存自愈诊断；供排查新旧混合缓存） ----------
 * 与 index.html 顶部 APP_VERSION / <meta name="app-version"> 保持一致（发版时三处同步改）。
 * 纯静态字段赋值，不依赖 document/window —— 测试沙箱可无 DOM 独立加载本文件。 */
Assets.buildVersion = "20261033";
try { console.log("[build] " + Assets.buildVersion); } catch (e) { /* 无 console 环境静默跳过 */ }

/* ============================================================
 * AssetHooks —— 真实资源接入层（有资源就替换、无资源无缝回退占位）
 * ============================================================
 * 设计铁律：
 *   1. 启动时一次性预加载：init() 遍历 AssetManifest（js/assets_manifest.js），
 *      为每个键建 Image/Audio 并挂 onload/onerror，全部异步、不阻塞启动；
 *      运行时零网络请求。
 *   2. 运行时零开销查找：sprite()/audio() 均为对象属性查表 O(1)，
 *      绝不做文件存在性判断、绝不发请求（性能基线：100 发子弹/80 特效/
 *      80 角色同屏渲染不受影响）。
 *   3. 无缝回退：加载成功 → 登记 cache 供渲染/音频侧优先取用；加载失败
 *      （onerror）→ 静默留空（不写 cache），业务侧取到 null 时走既有
 *      程序化占位绘制 / WebAudio 合成音效，行为与接入前完全一致。
 * 本区块为文件末尾独立追加区块，不改动 core.js 任何既有函数。 */
const AssetHooks = {
  cache: {},      // key -> Image / Audio（仅加载成功者登记；渲染/音频侧查这张表）
  _kind: {},      // key -> "sprite" | "audio"（区分查表口径：sprite() 不给音频、audio() 不给图）
  _status: {},    // key -> "loading" | "ok" | "fail"
  _total: 0, _loaded: 0, _failed: 0,
  _jobs: [],      // 全部单资源 Promise（ready() 聚合用；非空即「已 init」幂等标记）
  /* 启动预加载：遍历 AssetManifest 三分组（sprites → Image；audio/music → Audio）。
   * 幂等：重复调用直接返回（不重复发请求）。清单未挂载（typeof 未定义）时
   * 静默跳过 —— 全量走程序化占位回退，游戏行为不变。 */
  init() {
    if (this._jobs.length) return;                        // 幂等闸门：只装载一次
    if (typeof AssetManifest === "undefined") return;     // 清单未挂载 → 全量回退
    const groups = [["sprites", "sprite"], ["audio", "audio"], ["music", "audio"]];
    for (const g of groups) {
      const table = AssetManifest[g[0]] || {};
      for (const key in table) {
        this._total++;
        this._jobs.push(this._loadOne(key, table[key], g[1]));
      }
    }
  },
  /* 单资源装载：onload 成功 → 登记 cache；onerror → 静默留空（回退占位，零输出）。
   * Promise 永不 reject（失败也算 settle），保证 ready() 必定 resolve。 */
  _loadOne(key, src, kind) {
    const self = this;
    return new Promise((resolve) => {
      const el = kind === "sprite" ? new Image() : new Audio();
      this._status[key] = "loading";
      el.onload = () => {
        if (self._status[key] !== "loading") { resolve(); return; }   // 只认首次回调
        self._status[key] = "ok";
        self.cache[key] = el; self._kind[key] = kind;
        self._loaded++;
        resolve();
      };
      el.onerror = () => {
        if (self._status[key] !== "loading") { resolve(); return; }   // 只认首次回调
        self._status[key] = "fail"; self._failed++;
        resolve();
      };
      if (kind === "audio") { try { el.preload = "auto"; } catch (e) { /* 桩环境容错 */ } }
      el.src = src;
    });
  },
  /* 就绪 Promise：全部资源 settle（成功或失败）后 resolve，供启动时序与测试控制 */
  ready() { return Promise.all(this._jobs); },
  /* 查表取图：命中返回 Image，未命中/失败/类型不符返回 null（调用方回退占位绘制）。
   * O(1) 属性查表、无 IO 无请求 —— 可安全用于每帧渲染热路径。 */
  sprite(key) {
    const v = this.cache[key];
    return (v && this._kind[key] === "sprite") ? v : null;
  },
  /* 查表取音频：命中返回 Audio 对象，否则 null（调用方回退 WebAudio 合成音效） */
  audio(key) {
    const v = this.cache[key];
    return (v && this._kind[key] === "audio") ? v : null;
  },
  /* 调试统计：{ total, loaded, failed }（loaded + failed ≤ total，差额为在途） */
  stats() { return { total: this._total, loaded: this._loaded, failed: this._failed }; },
};

/* 启动自举：清单文件已挂载（AssetManifest 存在）则自动一次性预加载（幂等）。
 * 无清单 / 无 Image 环境的桩沙箱静默跳过，不影响既有测试与程序化占位回退。 */
try { if (typeof AssetManifest !== "undefined") AssetHooks.init(); } catch (e) { /* 环境不支持时静默 */ }

/* ============================================================
 * SpatialHash 自适应 cell（文件末尾独立区块，§5.45）
 * ============================================================
 * 为什么需要它：cell 是「平均每桶实体数」与「查询扇出」之间的权衡杠杆 ——
 *   cell 太小 → 单对象跨桶数暴增（大半径怪 r=65、cell=96 时跨 4+ 桶），insert 与去重压力上升；
 *   cell 太大 → 单桶候选集膨胀（高密度时一次 query 拉回大量无关对象），碰撞粗筛失效。
 * 固定 96 在 80 怪规模下够用，但 1500+ 弹幕/怪时会退化，故按实体总数推荐一档尺寸。
 * 规则取「2 的幂次附近」的整数，保证 _key(cx,cy)=cx*4096+cy 在 |cx|,|cy|<2048 内仍唯一。
 * 挂载方式：静态方法放类上（不污染实例），实例 retune 只在档位变化时重建桶表，
 *   因为 cell 变更会让所有 cell 坐标键失效，旧桶必须清空。 */

/* 自适应 cell：按实体数量推荐桶尺寸，避免高密度时单桶候选爆炸。
 * 返回整数（96/128/192）；非有限值/负数按 0 处理，走最小档位更安全。 */
SpatialHash.autoCell = function (count) {
  const n = (typeof count === "number" && isFinite(count)) ? count : 0;
  if (n < 500) return 96;
  if (n < 1500) return 128;
  return 192;
};

/* 实例方法 retune：推荐值与当前 cell 不同才改，并清空桶（键随 cell 变化）。
 * 返回是否发生了变更，方便调用方决定是否需要重新 insert。 */
SpatialHash.prototype.retune = function (count) {
  const next = SpatialHash.autoCell(count);
  if (next === this.cell) return false;
  this.cell = next;
  this.buckets.clear();   // 旧键基于旧 cell，一律丢弃；tick 不递增也无妨（query 前必 clear）
  return true;
};
