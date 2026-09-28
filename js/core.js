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

/* 需要的素材清单（key → 文件 + 背景模式） */
const ASSET_MANIFEST = {
  hero:    { src: "assets/hero/hero_00.png", tbg: { mode: "blue" } },
  enemy00: { src: "assets/enemies/enemy_00.png", tbg: { mode: "black" } },
  enemy08: { src: "assets/enemies/enemy_08.png", tbg: { mode: "black" } },
  enemy16: { src: "assets/enemies/enemy_16.png", tbg: { mode: "black" } },
  enemy22: { src: "assets/enemies/enemy_22.png", tbg: { mode: "white" } },
};

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
      }
    } catch (e) { /* 音频异常不影响游戏 */ }
  },
};
