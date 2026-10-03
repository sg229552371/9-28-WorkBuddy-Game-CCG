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
  constructor(cell = 96) { this.cell = cell; this.buckets = new Map(); }
  _key(cx, cy) { return cx * 4096 + cy; }   // 整数键，避免字符串开销
  clear() { this.buckets.clear(); }
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
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.buckets.get(this._key(cx, cy));
      if (b) for (const o of b) if (out.indexOf(o) < 0) out.push(o);
    }
    return out;
  }
}

/* ---------- 素材加载与背景抠图（洪泛填充，从边缘剔除背景色） ---------- */
const Assets = {
  images: {},   // key -> HTMLCanvasElement（已抠图）
  async load(manifest) {
    const jobs = [];
    for (const key in manifest) {
      jobs.push(this._loadOne(key, manifest[key].src, manifest[key].tbg));
    }
    await Promise.all(jobs);
  },
  _loadOne(key, src, tbg) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          this.images[key] = tbg ? this._keyOut(img, tbg) : this._toCanvas(img);
        } catch (e) {
          // file:// 协议下 getImageData 会因跨域污染抛 SecurityError：降级为原图，保证游戏可进
          console.warn("素材抠图失败，降级为原图（建议通过 HTTP 预览获得抠图效果）:", src);
          try { this.images[key] = this._toCanvas(img); } catch (e2) { /* 彻底失败则该素材缺失 */ }
        }
        resolve();
      };
      img.onerror = () => { console.warn("素材加载失败:", src); resolve(); };
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
  fit(key, targetH) {
    const src = this.images[key];
    if (!src) return null;
    let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
    try {
      const ctx = src.getContext("2d");
      const d = ctx.getImageData(0, 0, src.width, src.height).data;
      for (let y = 0; y < src.height; y += 2) for (let x = 0; x < src.width; x += 2) {
        if (d[(y * src.width + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    } catch (e) {
      // file:// 画布被污染无法读像素：跳过透明边裁剪，直接整图缩放
      x0 = 0; y0 = 0; x1 = src.width; y1 = src.height;
    }
    if (x1 <= x0) return src;
    const cw = x1 - x0, ch = y1 - y0;
    const scale = targetH / ch;
    const out = document.createElement("canvas");
    out.width = Math.ceil(cw * scale); out.height = Math.ceil(targetH);
    out.getContext("2d").drawImage(src, x0, y0, cw, ch, 0, 0, out.width, out.height);
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
