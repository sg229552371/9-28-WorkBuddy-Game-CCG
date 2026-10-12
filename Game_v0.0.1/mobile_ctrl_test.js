/* 无头测试：移动端控件改造（21.1）——配置驱动隐藏下方三按钮 + 浮动摇杆 + autofight 移至右下角
 * 覆盖：
 *   静态：index.html 结构（#btn-autofight 归属 #hud-br、不再在 #hud-tl）
 *   静态：CFG.mobile.hideTouchButtons / buttons / floatStick / npcTap 字段合法
 *   静态：CSS 竖屏块与 body.portrait 无覆盖新规则的旧硬编码（#joy-zone/#touch-btns/#hud-tl/#hud-br）
 *   静态：JS 读取 hideTouchButtons 配置（非 CSS 硬编码 display:none 隐藏 touch-btns）
 *   行为：joyVector 纯函数（坐标换算 / 钳制 / 死区 / 摇杆头位移）
 *   行为：bindTouch 隐藏逻辑依配置给元素加 .hidden（DOM 与绑定保留）
 * （node mobile_ctrl_test.js）
 * 注意：PASS 文案内不出现英文 error 词，错误一律用中文「错误」表达。 */
"use strict";

/* ---- DOM / Canvas 桩（最小可用，支持 classList 记录与事件注册） ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = (tag || "").toUpperCase(); this.style = {}; this.dataset = {};
    this.classList = new FakeClassList(); this.children = []; this.handlers = {};
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
    this.id = "";
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener(type, fn) { (this.handlers[type] || (this.handlers[type] = [])).push(fn); }
  dispatch(type, ev) { (this.handlers[type] || []).forEach(fn => fn(ev)); }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 132, height: this.height || 132 }; }
}
const elCache = {};
function getEl(id, tag) { return elCache[id] || (elCache[id] = Object.assign(new FakeEl(tag || "div"), { id: id })); }
global.document = {
  getElementById(id) { return getEl(id); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
  documentElement: { clientWidth: 390, clientHeight: 844 },
  body: new FakeEl("body"),
};
global.window = { innerWidth: 390, innerHeight: 844, addEventListener() { }, ontouchstart: null };
global.requestAnimationFrame = () => { };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm"), path = require("path");
let ok = true;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };

/* ---- 读取三份源文件原文（静态核对；桩抓不到结构与样式归属） ---- */
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "css/style.css"), "utf8");
const mainSrc = fs.readFileSync(path.join(__dirname, "js/main.js"), "utf8");

/* ============ 静态 A：index.html —— autofight 已移入右下角 ============ */
const secOf = (id) => {   // 取某容器开标签到匹配收尾标签之间的文本（按 id 定位容器）
  const open = html.indexOf(`id="${id}"`);
  if (open < 0) return "";
  // 容器内容：从该开标签后到下一个同级 div 前（源文件为平铺，取足够窗口做包含判定即可）
  return html.slice(open, open + 1200);
};
check("index.html 存在 #hud-br（右下角容器）", /id="hud-br"/.test(html));
check("index.html 存在 #hud-tl（左上角容器）", /id="hud-tl"/.test(html));
check("index.html 存在 #btn-autofight", /id="btn-autofight"/.test(html));
check("index.html 存在 #autofight-styles", /id="autofight-styles"/.test(html));

// 归属判定：用「#hud-br 开标签」与「#hud-tl 开标签」的字节位置比较 autofight 的位置
const idxTL = html.indexOf('id="hud-tl"');
const idxBR = html.indexOf('id="hud-br"');
const idxAF = html.indexOf('id="btn-autofight"');
const idxAFS = html.indexOf('id="autofight-styles"');
// 平铺结构下：#hud-br 在 #hud-tl 之后；autofight 应出现在 #hud-br 之后（即位于 #hud-br 块内）
check("#hud-br 位于 #hud-tl 之后（源文件顺序）", idxTL >= 0 && idxBR > idxTL);
check("#btn-autofight 已移入右下区域（位于 #hud-br 之后）", idxAF > idxBR);
check("#autofight-styles 随按钮移入右下区域（位于 #hud-br 之后）", idxAFS > idxBR);
check("#btn-autofight 不再位于 #hud-tl 内（在 #hud-br 之后即已迁出）", idxAF > idxBR && idxAF > idxTL);
// 反向：autofight 之前的最近容器是 hud-br（保证没有夹在 hud-tl 里）
const beforeAF = html.slice(0, idxAF);
check("#btn-autofight 之前最近的 HUD 容器为 #hud-br", beforeAF.lastIndexOf('id="hud-br"') > beforeAF.lastIndexOf('id="hud-tl"'));
check("#btn-backpack 与 #btn-autofight 同在 #hud-br 内", html.indexOf('id="btn-backpack"') > idxBR);

/* ============ 静态 B：CFG.mobile 字段合法 ============ */
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
}
ctx.check = check;
vm.runInContext(`
  const m = CFG.mobile;
  check("CFG.mobile.hideTouchButtons 存在且为布尔真（三按钮整体隐藏）", m && m.hideTouchButtons === true);
  check("CFG.mobile.buttons 三字段齐全（skill/interact/backpack）",
    m && m.buttons && typeof m.buttons.skill === "boolean" &&
    typeof m.buttons.interact === "boolean" && typeof m.buttons.backpack === "boolean");
  check("CFG.mobile.floatStick 合法（zoneRatio∈(0,1]，returnOnRelease 布尔）",
    m && m.floatStick && m.floatStick.zoneRatio > 0 && m.floatStick.zoneRatio <= 1 &&
    typeof m.floatStick.returnOnRelease === "boolean");
  check("CFG.mobile.npcTap 合法（dwellSeconds>0，tapRadius>0）",
    m && m.npcTap && m.npcTap.dwellSeconds > 0 && m.npcTap.tapRadius > 0);
  check("CFG.mobile.joystick.deadZone∈(0,1)（沿用旧死区口径）",
    m && m.joystick && m.joystick.deadZone > 0 && m.joystick.deadZone < 1);
`, ctx, { filename: "cfg_check" });

/* ============ 静态 C：CSS 无覆盖新规则的旧硬编码 ============ */
// 竖屏块与 body.portrait 钩子中，不得出现会把新布局拉回旧的硬编码：
//   - #touch-btns 不得被 visibility/display 硬编码为可见（我们靠 JS 加 .hidden）
//   - #joy-zone / #hud-tl / #hud-br 竖屏块应存在且指向合理锚点
check("CSS 主规则 #hud-br 为纵向堆叠（flex-direction:column）",
  /#hud-br\s*\{[^}]*flex-direction\s*:\s*column/i.test(css));
check("CSS 竖屏块含 #hud-br 锚点（右上信息区）",
  /@media\s*\(orientation:\s*portrait\)[\s\S]*?#hud-br\s*\{[^}]*top\s*:/i.test(css));
check("CSS 竖屏块含 #hud-tl 锚点（顶栏之下左对齐）",
  /@media\s*\(orientation:\s*portrait\)[\s\S]*?#hud-tl\s*\{[^}]*top\s*:/i.test(css));
check("body.portrait 钩子同步 #hud-tl（双保险）", /body\.portrait\s+#hud-tl/i.test(css));
// 21.3：摇杆改浮动（触点即盘心），#joy-zone 固定锚点已移除 → 不再要求该旧锚点存在
check("21.3 已移除 #joy-zone 固定锚点（浮动摇杆无固定位）", !/#joy-zone\s*\{/.test(css));
check("21.3 #joy-base 为 fixed 浮动定位 + 待命隐形",
  /#joy-base\s*\{[^}]*position\s*:\s*fixed/i.test(css) && /#joy-base\s*\{[^}]*opacity\s*:\s*0/i.test(css));
check("21.3 #joy-base.joy-on 浮现规则存在", /#joy-base\.joy-on\s*\{[^}]*opacity\s*:\s*1/i.test(css));
// 关键陷阱：#touch-btns 不得在 CSS 里被硬写 display:none（必须由 JS 读配置加 .hidden）
check("CSS 未对 #touch-btns 硬写 display:none（隐藏走 JS 配置驱动）",
  !/#touch-btns\s*\{[^}]*display\s*:\s*none/i.test(css));
// 通用 .hidden 规则存在（JS 加 .hidden 才能生效）
check("CSS 含通用 .hidden{display:none!important}（供 JS 配置驱动隐藏）",
  /\.hidden\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/i.test(css));

/* ============ 静态 D：JS 读取 hideTouchButtons 配置（非硬编码） ============ */
check("js/main.js 读取 CFG.mobile.hideTouchButtons（配置驱动隐藏）", /hideTouchButtons/.test(mainSrc));
check("js/main.js 读取 CFG.mobile.buttons 逐项开关", /mob\.buttons|\.buttons\b/.test(mainSrc) && /flags\[/.test(mainSrc));
check("js/main.js 对 #touch-btns 应用 .hidden（DOM 保留，仅视觉）",
  /btns\.classList[\s\S]{0,80}hidden/.test(mainSrc) || /classList\.(add|remove)\(\s*["']hidden["']\s*\)/.test(mainSrc));
check("js/main.js 保留 btn-touch-skill / bag / act 的 DOM 绑定（未删除）",
  /btn-touch-skill/.test(mainSrc) && /btn-touch-bag/.test(mainSrc) && /btn-touch-act/.test(mainSrc));
check("js/main.js 读取 CFG.mobile.floatStick（浮动摇杆开关）", /floatStick/.test(mainSrc) && /zoneRatio/.test(mainSrc));
// 21.3：起杆条件从「必须命中 canvas」改为「左半屏 + 未命中交互控件黑名单」。
//   旧写法 target===canvas 与摇杆盘 pointer-events:auto 冲突，导致按在盘上永不生效（就是本次要修的 bug）。
check("21.3 摇杆起杆不再要求命中 canvas（旧 isFreeCanvas 已废弃）", !/isFreeCanvas/.test(mainSrc));
check("21.3 摇杆起杆有交互控件黑名单（button/.tbtn/.itm/面板等）",
  /INTERACTIVE\s*=/.test(mainSrc) && /closest\(\s*INTERACTIVE\s*\)/.test(mainSrc));
check("21.3 摇杆盘心取按下点 clientX/Y（浮动核心）", /placeBase\(\s*e\.clientX\s*,\s*e\.clientY\s*\)/.test(mainSrc));
check("21.3 摇杆使用 setPointerCapture（防手指滑出丢事件）", /setPointerCapture/.test(mainSrc));
check("21.3 摇杆监听 lostpointercapture（防卡死）", /lostpointercapture/.test(mainSrc));
check("21.3 摇杆底盘跟随拇指（dragBase 超出半径时拖盘心）", /dragBase/.test(mainSrc) && /placeBase\(\s*cx\s*\+/.test(mainSrc));
/* 21.3 两个「摇杆不能用」的真根因，必须锁死防回归：
 *  ① 全局缺 touch-action:none → 画布拖动被判为页面滚动 → 浏览器发 pointercancel 打断摇杆；
 *  ② setPointerCapture 挂到 pointer-events:none 的 #joy-base 上 → 立即失败并触发 lostpointercapture。 */
check("21.3 游戏区 touch-action:none（防 pointercancel 打断摇杆）",
  /#app\s*,\s*#game-canvas\s*,\s*#touch-controls\s*\{[^}]*touch-action\s*:\s*none/i.test(css)
  && /overscroll-behavior\s*:\s*none/i.test(css));
check("21.3 setPointerCapture 挂在 e.target 而非 base（base 为 pointer-events:none）",
  /setPointerCapture/.test(mainSrc) && !/base\.setPointerCapture/.test(mainSrc));
check("21.3 lostpointercapture 监听在 window（base 收不到该事件）",
  /window\.addEventListener\(\s*["']lostpointercapture["']/.test(mainSrc));
/* 排除注释行后再判断（注释里会提到这个反面写法作为说明）。 */
const mainCode = mainSrc.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
check("21.3 未把 opacity 写成 base 内联样式（会压住 .joy-on 导致底盘不浮现）",
  !/base\.style\.opacity/.test(mainCode));
check("js/main.js 保留 npcTap 让位逻辑（不改动主会话点选代码）", /typeof\s+npcTap\s*===\s*["']function["']/.test(mainSrc));

/* ============ 行为 E：joyVector 纯函数（坐标换算 / 钳制 / 死区） ============ */
vm.runInContext(`
  const jc = CFG.mobile.joystick;
  const size = jc.size, knob = jc.knob, maxR = size / 2 - knob / 2, dead = jc.deadZone;

  // 1) 中心点 → 零向量 + 死区
  const c = joyVector(0, 0, maxR, dead);
  check("joyVector：盘心为死区（dx=dy=0, mag=0）", c.mag === 0 && c.dead === true);

  // 2) 向右满推 → 归一化 dx=1, dy=0（不超速）
  const r = joyVector(maxR, 0, maxR, dead);
  check("joyVector：右推满程 → dx=1, dy=0", Math.abs(r.vx - 1) < 1e-9 && Math.abs(r.vy) < 1e-9);

  // 3) 超出底盘（2×maxR）→ 钳制到模长 1
  const o = joyVector(maxR * 2, 0, maxR, dead);
  check("joyVector：超程钳制在底盘内（模长=1）", Math.abs(Math.hypot(o.vx, o.vy) - 1) < 1e-9);

  // 4) 斜向 → 分量归一化（同不超速）
  const d = joyVector(maxR, maxR, maxR, dead);
  check("joyVector：斜向分量归一化（模长=1）", Math.abs(Math.hypot(d.vx, d.vy) - 1) < 1e-9);

  // 5) 死区内微小位移 → dead=true（供上层判静止）
  const t = joyVector(maxR * dead * 0.5, 0, maxR, dead);
  check("joyVector：死区内视为静止（dead=true）", t.dead === true);

  // 6) 摇杆头位移映射：右推满程 → kx=2R, ky=R（相对左上角，居中偏移 R）
  check("joyVector：摇杆头右推映射 kx=2R, ky=R", Math.abs(r.kx - 2 * maxR) < 1e-9 && Math.abs(r.ky - maxR) < 1e-9);
`, ctx, { filename: "joyvec_check" });

/* ============ 行为 F：bindTouch 依配置隐藏（真跑一遍初始化） ============ */
// 预置触屏控件元素（桩不解析 HTML）。21.3：#joy-zone 已删，摇杆只需 joy-base/joy-stick。
getEl("game-canvas", "canvas");
getEl("touch-controls");
getEl("touch-btns");
getEl("joy-base"); getEl("joy-stick");
getEl("btn-touch-skill", "button"); getEl("btn-touch-bag", "button"); getEl("btn-touch-act", "button");
ctx.JoyVector = vm.runInContext("joyVector", ctx);
vm.runInContext(`
  Game.bindTouch();
  const tcEl = document.getElementById("touch-controls");
  const btnsEl = document.getElementById("touch-btns");
  const allowed = CFG.mobile.hideTouchButtons;
  check("bindTouch：hideTouchButtons=true 时 #touch-btns 加 .hidden",
    allowed ? btnsEl.classList.contains("hidden") === true : btnsEl.classList.contains("hidden") === false);
  for (const id of ["btn-touch-skill", "btn-touch-act", "btn-touch-bag"]) {
    const el = document.getElementById(id);
    check("bindTouch：三按钮之一 " + id + " 依配置隐藏", el.classList.contains("hidden") === true);
  }
  // 触屏门槛：touch-controls 显现（非 hidden），符合 autoShow 契约
  check("bindTouch：触屏环境 #touch-controls 移除 .hidden（进入显示）", tcEl.classList.contains("hidden") === false);
`, ctx, { filename: "bind_check" });

console.log(ok ? "MOBILE_CTRL OK" : "MOBILE_CTRL FAILED");
if (!ok) throw new Error("MOBILE_CTRL FAILED");
