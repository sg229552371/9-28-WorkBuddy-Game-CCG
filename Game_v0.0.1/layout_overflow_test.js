/* ============================================================================
 * layout_overflow_test.js —— 竖屏（390×844）布局溢出「静态几何审计」（node layout_overflow_test.js）
 * ----------------------------------------------------------------------------
 * 背景：本环境没有浏览器（真机像素级复核无法自动化）。本测试退一步做**静态几何审计**：
 *   把 css/style.css 的声明值解析出来（**先剥注释**，防注释里的选择器名误判），
 *   以竖屏逻辑宽 390 为折算基准，逐条检查「固定 px 宽度 / 左右偏移 / min-width / 字号」
 *   是否会让关键容器溢出竖屏。它抓不到「真机渲染后的实际像素」，但能抓住
 *   「声明层面必然溢出」与「本该响应式却写成固定值」的回归。
 *
 * 覆盖：
 *   ① 注释剥离自检 + 选择器块可解析（保证后续断言不是永真式）
 *   ② 右侧 HUD 竖列（#hud-tr / #hud-br / #touch-btns）：固定宽 + right 偏移折算 ≤ 390
 *   ③ 遮罩面板（技能面板 / 升级 / 选择 / 背包 / 工匠 / 深渊 / 各 .screen 面板）竖屏宽度受控
 *   ④ 竖屏战斗技能栏单行最坏宽度（能量水晶 A X X X X A）估算 ≤ 96vw 与 390
 *   ⑤ index.html 关键 HUD / 技能面板容器 id 存在性
 *   ⑥ 关键 font-size 不失控（防竖屏挤爆）
 *   ⑦ 全局 min-width 扫描 + 纵向长度锚点（#hud-bl 避让底部控件等）
 *
 * 依赖：仅 fs/path；纯静态，不加载游戏脚本。
 * ⚠️ PASS 文案禁用英文 error / FAIL 字样（run_tests.sh 以 grep 计 bad）。
 * ========================================================================== */
"use strict";

const fs = require("fs"), path = require("path");
const root = __dirname;

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* 竖屏逻辑基准（iPhone 12/13/14 竖屏逻辑像素） */
const SCREEN_W = 390, SCREEN_H = 844;

/* ============================================================
 * 一、极简 CSS 解析工具（无浏览器 → 自行解析声明值）
 *     · 不依赖带反斜杠的正则（driver 可能是模板字符串，反斜杠会被吃掉）
 *     · 只用 indexOf / charCode 级别的字符判断
 * ============================================================ */
function isSpaceCh(c) { return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f"; }
function isNameCh(c) { return c !== "" && c !== undefined && ".abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-#".indexOf(c) >= 0; }
function isNumCh(c) { return c !== "" && c !== undefined && "0123456789.-".indexOf(c) >= 0; }

/* 剥注释：把 /* ... *\/ 整段拿掉（保留长度无关，只求语义干净） */
function stripComments(s) {
  let out = "", i = 0;
  while (true) {
    const p = s.indexOf("/*", i);
    if (p < 0) { out += s.slice(i); break; }
    out += s.slice(i, p);
    const q = s.indexOf("*/", p + 2);
    if (q < 0) break;
    i = q + 2;
  }
  return out;
}

/* 找出所有 @media (orientation: portrait) 包裹的字符区间（用于判定声明是否竖屏档） */
function portraitRanges(s) {
  const ranges = []; let i = 0;
  const key = "@media (orientation: portrait)";
  while (true) {
    const p = s.indexOf(key, i);
    if (p < 0) break;
    const open = s.indexOf("{", p);
    if (open < 0) break;
    let depth = 0, j = open;
    for (; j < s.length; j++) {
      const c = s[j];
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) break; }
    }
    ranges.push([p, j]);
    i = j + 1;
  }
  return ranges;
}
function inAny(pos, ranges) {
  for (const r of ranges) if (pos >= r[0] && pos <= r[1]) return true;
  return false;
}

/* 取「选择器 sel 对应的规则体」数组。
 * 支持：单选择器 `.a {`、分组 `.a, .b {`（从组内任一名字都能命中同一块）。
 * 拒绝：`.a-descendant`（后随名字字符）、`.a .b {`（后代选择器，字符块以非逗号开头）。
 * 返回 { sel, body, pos, portrait }[] —— portrait = 位于竖屏媒体块内 或选择器含 .portrait。 */
function findBlocks(s, sel, ranges) {
  const out = []; let i = 0;
  while (true) {
    const p = s.indexOf(sel, i);
    if (p < 0) break;
    const prev = p > 0 ? s[p - 1] : "";
    const nxt = s[p + sel.length] || "";
    if (isNameCh(prev) || isNameCh(nxt)) { i = p + sel.length; continue; }
    /* 向前找本规则组的 `{`（中途遇到 } / ; 说明不是选择器 → 放弃） */
    let k = p + sel.length, ok = false;
    while (k < s.length) {
      const c = s[k];
      if (c === "{") { ok = true; break; }
      if (c === "}" || c === ";") break;
      k++;
    }
    if (ok) {
      /* 名字到 `{` 之间：要么只有空白，要么是「逗号开头的分组后缀」；否则是后代选择器 */
      let t = p + sel.length, seenComma = false;
      while (t < k && isSpaceCh(s[t])) t++;
      if (t < k) {
        if (s[t] === ",") seenComma = true;
        if (!seenComma) { i = p + sel.length; continue; }
      }
      let depth = 0, j = k;
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) break; }
      }
      out.push({ sel, body: s.slice(k + 1, j), pos: p, portrait: inAny(p, ranges) || sel.indexOf(".portrait") >= 0 });
      i = j + 1;
    } else i = p + 1;
  }
  return out;
}

/* 取声明值（属性名精确匹配：`width` 不会误命中 `max-width`；`right` 不会命中 `border-right`） */
function decl(body, prop) {
  let i = 0;
  while (true) {
    const p = body.indexOf(prop, i);
    if (p < 0) return null;
    const prev = p > 0 ? body[p - 1] : "";
    const after = body[p + prop.length];
    if (after === ":" && !isNameCh(prev)) {
      let e = body.indexOf(";", p + prop.length);
      if (e < 0) e = body.length;
      return body.slice(p + prop.length + 1, e).trim();
    }
    i = p + prop.length;
  }
}

/* 从值串里取第一个「数字+px」（calc(var(--sa-right) + 12px) → 12） */
function pxNum(val) {
  if (!val) return null;
  let i = 0;
  while (true) {
    const p = val.indexOf("px", i);
    if (p < 0) return null;
    let s = p;
    while (s > 0 && isNumCh(val[s - 1])) s--;
    const t = val.slice(s, p);
    if (t.length && t !== "-" && t !== ".") { const n = Number(t); if (!isNaN(n)) return n; }
    i = p + 2;
  }
}
/* 长度值是否为 0（"0" / "0px" 都算；无单位 0 不含 px 后缀，故单列） */
function isZeroLen(v) { return v === "0" || pxNum(v) === 0; }
/* 单位前的数字（94vw → 94） */
function numBeforeUnit(val, unit) {
  if (!val) return null;
  const p = val.indexOf(unit);
  if (p < 0) return null;
  let s = p;
  while (s > 0 && isNumCh(val[s - 1])) s--;
  const t = val.slice(s, p);
  if (!t.length || t === "-" || t === ".") return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}
/* transform 里的 scale 系数（scale(.92) → 0.92；无 → null） */
function scaleOf(val) {
  if (!val) return null;
  const p = val.indexOf("scale(");
  if (p < 0) return null;
  const n = Number(val.slice(p + 6).split(")")[0]);
  return isNaN(n) ? null : n;
}
/* 宽度值 → 竖屏折算 px（响应式返回等价保守值；不可解析返回 null）
 *   `min(880px, 96vw)` → min(880, 96%×390)；`94vw` → 94%×390；`100%` → 0（跟随容器）；`280px` → 280 */
function widthVerdict(val, W) {
  if (!val) return null;
  if (val.indexOf("vw") >= 0) {
    const vw = numBeforeUnit(val, "vw"), px = numBeforeUnit(val, "px");
    let r = (vw != null) ? vw / 100 * W : 0;
    if (px != null) r = Math.min(r, px);
    return r;
  }
  if (val.indexOf("%") >= 0) return 0;
  if (val.indexOf("max-content") >= 0 || val.indexOf("auto") >= 0) return 0;
  return pxNum(val);
}
/* 最后一个含该属性的块的取值（后写覆盖先写 → 模拟层叠顺序的近似） */
function lastDecl(s, sel, prop, ranges) {
  const bs = findBlocks(s, sel, ranges);
  let v = null;
  for (const b of bs) { const d = decl(b.body, prop); if (d != null) v = d; }
  return v;
}

/* ============================================================
 * 读取源文件
 * ============================================================ */
const cssRaw = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const htmlRaw = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = stripComments(cssRaw);
const ranges = portraitRanges(css);

/* index.html 的 id 清单（不用正则：逐段 indexOf） */
function collectIds(html) {
  const ids = []; let i = 0;
  const key = "id=\"";
  while (true) {
    const p = html.indexOf(key, i);
    if (p < 0) break;
    const prev = p > 0 ? html[p - 1] : "";
    if (isSpaceCh(prev) || prev === "<") {
      const s = p + key.length;
      const e = html.indexOf("\"", s);
      if (e < 0) break;
      ids.push(html.slice(s, e));
      i = e + 1;
    } else i = p + key.length;
  }
  return ids;
}
const htmlIds = collectIds(htmlRaw);
function hasId(id) { return htmlIds.indexOf(id) >= 0; }

console.log("===== 竖屏（" + SCREEN_W + "×" + SCREEN_H + "）布局溢出静态审计 =====");
console.log("");

/* ============================================================
 * ① 剥注释自检 + 选择器块可解析（防永真式）
 * ============================================================ */
check("① 注释已剥离（剥注释文本不含注释起止符）",
  css.indexOf("/*") < 0 && css.indexOf("*/") < 0);
check("① 剥注释后仍能解析 #hud-tr 规则块",
  findBlocks(css, "#hud-tr", ranges).length >= 1);
check("① 剥注释后仍能解析 .crystal-panel 规则块（且未误吞 .crystal-panel-head）",
  findBlocks(css, ".crystal-panel", ranges).some(b => decl(b.body, "width") != null));
check("① 分组选择器可命中（.help-panel 与 .settings-panel 同组合并有效）",
  findBlocks(css, ".help-panel", ranges).length >= findBlocks(css, ".settings-panel", ranges).length - 1);

/* ============================================================
 * ② 右侧 HUD 竖列：固定宽（或 max-width）+ right 偏移折算 ≤ 390
 * ============================================================ */
/* --- #hud-tr：竖屏应双锚铺满（left+right），不靠固定宽 --- */
const trBlocks = findBlocks(css, "#hud-tr", ranges);
const trWidths = trBlocks.map(b => pxNum(decl(b.body, "width"))).filter(v => v != null);
const trRights = trBlocks.map(b => pxNum(decl(b.body, "right"))).filter(v => v != null);
const trPortrait = trBlocks.filter(b => b.portrait);
check("② #hud-tr 无固定 px 宽度（保持内容自适应，不写死宽度）", trWidths.length === 0);
check("② #hud-tr 存在竖屏规则（媒体/钩子）", trPortrait.length >= 1);
check("② #hud-tr 竖屏同时声明 left 与 right（右对齐铺满窄屏，右侧不越界）",
  trPortrait.some(b => decl(b.body, "left") != null && decl(b.body, "right") != null));
check("② #hud-tr 所有 right 偏移 ≤ 40px（" + JSON.stringify(trRights) + "）",
  trRights.length >= 1 && trRights.every(v => v <= 40));

/* --- #hud-br：同上 --- */
const brBlocks = findBlocks(css, "#hud-br", ranges);
const brWidths = brBlocks.map(b => pxNum(decl(b.body, "width"))).filter(v => v != null);
const brRights = brBlocks.map(b => pxNum(decl(b.body, "right"))).filter(v => v != null);
check("② #hud-br 无固定 px 宽度", brWidths.length === 0);
check("② #hud-br 所有 right 偏移 ≤ 40px（" + JSON.stringify(brRights) + "）",
  brRights.length >= 1 && brRights.every(v => v <= 40));
check("② #hud-br 竖屏用 top 锚定（避开底部虚拟控件带）",
  findBlocks(css, "#hud-br", ranges).filter(b => b.portrait).some(b => decl(b.body, "top") != null));

/* --- #touch-btns：三键横向合计（按各档 scale 折算）+ right 偏移 ≤ 390 --- */
const smallW = pxNum(lastDecl(css, ".tbtn-small", "width", ranges));
const bigW = pxNum(lastDecl(css, ".tbtn-big", "width", ranges));
const tbtnGap = pxNum(lastDecl(css, "#touch-btns", "gap", ranges));
const tbIntrinsic = (smallW != null ? smallW * 2 : null);
const tbBlocks = findBlocks(css, "#touch-btns", ranges);
const tbRights = tbBlocks.map(b => pxNum(decl(b.body, "right"))).filter(v => v != null);
let tbWorst = 0;
for (const b of tbBlocks) {
  const r = pxNum(decl(b.body, "right"));
  const sc = scaleOf(decl(b.body, "transform"));
  const width = (tbIntrinsic || 0) + (bigW || 0) + (tbtnGap != null ? tbtnGap * 2 : 0);
  const eff = (r != null ? r : 0) + width * (sc != null ? sc : 1);
  if (eff > tbWorst) tbWorst = eff;
}
check("② #touch-btns 三键横向合计可解析（小键×2 + 大键 + 间隙）",
  smallW != null && bigW != null && tbtnGap != null);
check("② #touch-btns 各档 right + 缩放后宽 ≤ " + SCREEN_W + "px（最坏 " + Math.round(tbWorst) + "px）",
  tbWorst > 0 && tbWorst <= SCREEN_W);
check("② #touch-btns 所有 right 偏移 ≤ 40px（" + JSON.stringify(tbRights) + "）",
  tbRights.length >= 1 && tbRights.every(v => v <= 40));
check("② #touch-btns 声明了 transform: scale 防竖屏溢出",
  tbBlocks.some(b => decl(b.body, "transform") != null && scaleOf(decl(b.body, "transform")) != null));

/* ============================================================
 * ③ 遮罩 / 面板：竖屏有效宽度受控（≤390 或 vw/% 响应式）
 * ============================================================ */
function panelWidthOk(sel) {
  const bs = findBlocks(css, sel, ranges);
  let cands = [];
  for (const b of bs) if (b.portrait) { const w = decl(b.body, "width"); if (w) cands.push(w); }
  if (!cands.length) for (const b of bs) { const w = decl(b.body, "width"); if (w) cands.push(w); }
  if (!cands.length) {   /* 兜底：.panel 基类竖屏规则（96vw）覆盖所有未自定义宽度的面板 */
    for (const b of findBlocks(css, ".panel", ranges)) if (b.portrait) { const w = decl(b.body, "width"); if (w) cands.push(w); }
  }
  if (!cands.length) return { found: false, worst: null };
  let worst = 0, bad = false;
  for (const w of cands) {
    const v = widthVerdict(w, SCREEN_W);
    if (v == null) continue;
    if (v > SCREEN_W) bad = true;
    if (v > worst) worst = v;
  }
  return { found: true, bad, worst: Math.round(worst) };
}
const PANELS = [
  ["#skill-panel-overlay .crystal-panel", ".crystal-panel"],
  ["#levelup-overlay .levelup-panel", ".levelup-panel"],
  ["#choice-overlay .choice-panel", ".choice-panel"],
  ["#panel-backpack .bp-panel", ".bp-panel"],
  ["#panel-artisan .art-panel", ".art-panel"],
  ["#screen-abyss .abyss-panel", ".abyss-panel"],
  ["#screen-level .level-panel", ".level-panel"],
  ["#screen-character .char-panel", ".char-panel"],
  ["#panel-npc-outlevel .meta-panel", ".meta-panel"],
  ["#screen-main .main-panel", ".main-panel"],
  ["#screen-codex .codex-panel", ".codex-panel"],
  ["#screen-settings .settings-panel", ".settings-panel"],
  ["#screen-help .help-panel", ".help-panel"],
  ["#screen-settle .settle-panel", ".settle-panel"],
  ["#screen-death .death-panel", ".death-panel"]
];
for (const pair of PANELS) {
  const r = panelWidthOk(pair[1]);
  check("③ 面板 " + pair[0] + " 竖屏宽度受控（≤" + SCREEN_W + "px 或 vw/%，折算 " +
    (r.worst == null ? "未声明(自适应)" : r.worst + "px") + "）", r.found && !r.bad);
}
/* 遮罩宿主本身铺满视口（inset:0），不参与宽度计算也不会溢出 */
const ovBlocks = findBlocks(css, ".overlay", ranges);
check("③ .overlay 遮罩宿主声明 position:absolute + inset:0（铺满视口，不横向溢出）",
  ovBlocks.some(b => decl(b.body, "position") === "absolute" && (decl(b.body, "inset") || "").indexOf("0") >= 0));
check("③ .overlay 遮罩宿主不声明固定 px 宽度（否则可能窄/宽于视口）",
  ovBlocks.every(b => pxNum(decl(b.body, "width")) == null));

/* ============================================================
 * ④ 竖屏战斗技能栏单行最坏宽度（能量水晶 A X X X X A）
 *    · 结构真值 = js/ui.js _buildPartyRow（[名字][技能A][水晶X×4][技能A]）
 *    · 竖屏数值全部来自 html body .ps-* 覆盖块
 * ============================================================ */
const pIconW = pxNum(lastDecl(css, ".ps-icon", "width", ranges));
const pInfoMin = pxNum(lastDecl(css, ".ps-info", "min-width", ranges));
const pInfoMax = pxNum(lastDecl(css, ".ps-info", "max-width", ranges));
const pSlotW = pxNum(lastDecl(css, ".ps-slot", "width", ranges));
const pRowGap = pxNum(lastDecl(css, ".ps-row", "gap", ranges));
const pRowPad = lastDecl(css, ".ps-row", "padding", ranges);
const pSlotGap = pxNum(lastDecl(css, ".ps-slots.crystal-slots", "gap", ranges));
const pBarMax = lastDecl(css, ".party-skillbar", "max-width", ranges);

function padH(v) {                                  /* "5px 10px" → 20（左右合计） */
  if (!v) return null;
  const parts = v.split(" ");
  if (parts.length === 1) { const n = pxNum(parts[0]); return n == null ? null : n * 2; }
  const l = pxNum(parts[1]);
  return l == null ? null : l * 2;
}
const rowPadH = padH(pRowPad);
const rowSlotBox = (pSlotW != null && pSlotGap != null) ? pSlotW * 4 + pSlotGap * 3 : null;
const rowWorst = (pInfoMax != null && pIconW != null && pSlotW != null && pRowGap != null && rowPadH != null && pSlotGap != null)
  ? pInfoMax + pIconW + (rowSlotBox || 0) + pIconW + pRowGap * 3 + rowPadH
  : null;
check("④ 竖屏技能栏关键尺寸可解析（图标 / 名字封顶 / 槽宽 / 行距 / 行内边距）",
  pIconW != null && pInfoMax != null && pSlotW != null && pRowGap != null && rowPadH != null && pSlotGap != null);
check("④ 竖屏技能栏单行最坏宽度（双技能 A X X X X A）≤ " + SCREEN_W + "px（估算 " + rowWorst + "px）",
  rowWorst != null && rowWorst <= SCREEN_W);
check("④ 竖屏技能栏单行最坏宽度 ≤ .party-skillbar 竖屏 max-width(96vw)（估算 " + rowWorst + " vs " +
  (pBarMax ? Math.round(numBeforeUnit(pBarMax, "vw") / 100 * SCREEN_W) : "?") + "）",
  rowWorst != null && pBarMax != null && pBarMax.indexOf("vw") >= 0 && rowWorst <= numBeforeUnit(pBarMax, "vw") / 100 * SCREEN_W);
check("④ 竖屏 .ps-row 不换行（flex-wrap:nowrap → 宽度即硬约束，故上面估算有效）",
  findBlocks(css, ".ps-row", ranges).some(b => b.portrait && (decl(b.body, "flex-wrap") === "nowrap")));
check("④ 竖屏 .party-skillbar 纵向堆叠（flex-direction:column）",
  findBlocks(css, ".party-skillbar", ranges).some(b => b.portrait && decl(b.body, "flex-direction") === "column"));
check("④ 竖屏 .ps-info 有 max-width 封顶（防技能名字过长撑破单行）",
  findBlocks(css, ".ps-info", ranges).some(b => b.portrait && decl(b.body, "max-width") != null));

/* ============================================================
 * ⑤ index.html 关键 HUD / 技能面板容器存在性
 * ============================================================ */
const KEY_IDS = [
  "hud", "hud-tl", "hud-top", "hud-tr", "hud-bl", "hud-br",
  "party-skillbar", "touch-controls", "touch-btns", "btn-autofight",
  "btn-backpack", "btn-skill-panel", "buff-area", "hud-skill-cd",
  "progress-wrap", "skill-panel-overlay", "choice-overlay", "levelup-overlay",
  "crystal-panel-skills", "crystal-panel-slots", "crystal-panel-matrix", "crystal-panel-detail"
];
for (const id of KEY_IDS) {
  check("⑤ index.html 含 HUD/面板容器 id=" + id, hasId(id));
}
/* 技能面板入口按钮必须落在 #hud-tr 段（避开右下 #hud-br 的移动端虚拟按钮区） */
const iTr = htmlRaw.indexOf("id=\"hud-tr\""), iBl = htmlRaw.indexOf("id=\"hud-bl\""), iBtn = htmlRaw.indexOf("id=\"btn-skill-panel\"");
check("⑤ #btn-skill-panel 位于 #hud-tr 段内（在 #hud-bl 之前，不落右下虚拟按钮区）",
  iTr > 0 && iBtn > iTr && (iBl < 0 || iBtn < iBl));

/* ============================================================
 * ⑥ 关键 font-size 不失控（防竖屏挤爆 / 数值字号过大）
 * ============================================================ */
function lastFont(sel) { const v = lastDecl(css, sel, "font-size", ranges); return v == null ? null : pxNum(v); }
const fsLv = lastFont("#lv-line");        /* 竖屏等级数值行 */
const fsCoin = lastFont("#coin-line");
const fsEndless = lastFont("#hud-endless-info");
const fsPsName = lastFont(".ps-name");
check("⑥ #lv-line 字号 ≤ 20px（当前 " + fsLv + "）", fsLv != null && fsLv <= 20);
check("⑥ #coin-line 字号 ≤ 20px（当前 " + fsCoin + "）", fsCoin != null && fsCoin <= 20);
check("⑥ #hud-endless-info 字号 ≤ 14px（当前 " + fsEndless + "）", fsEndless != null && fsEndless <= 14);
check("⑥ .ps-name 字号 ≤ 16px（当前 " + fsPsName + "）", fsPsName != null && fsPsName <= 16);
check("⑥ #hud-tr 内 .bar.exp 竖屏铺满（width 100% / max-width 100%，不写死 180px）",
  findBlocks(css, ".bar.exp", ranges).some(b => b.portrait && (String(decl(b.body, "width")).indexOf("100%") >= 0)));

/* ============================================================
 * ⑦ 全局 min-width 扫描 + 纵向长度锚点
 * ============================================================ */
function scanProp(s, prop) {
  const out = []; let i = 0;
  while (true) {
    const p = s.indexOf(prop, i);
    if (p < 0) break;
    const prev = p > 0 ? s[p - 1] : "";
    if (!isNameCh(prev) && s[p + prop.length] === ":") {
      const st = p + prop.length + 1;
      let e = s.indexOf(";", st);
      const e2 = s.indexOf("}", st);
      if (e < 0 || (e2 >= 0 && e2 < e)) e = e2;
      if (e < 0) e = s.length;
      out.push(s.slice(st, e).trim());
      i = st;
    } else i = p + prop.length;
  }
  return out;
}
const minWs = scanProp(css, "min-width").map(v => pxNum(v)).filter(v => v != null);
const maxMinW = minWs.length ? Math.max.apply(null, minWs) : 0;
check("⑦ 全局声明 min-width 最大值 ≤ " + SCREEN_W + "px（当前 " + maxMinW + "px）", maxMinW <= SCREEN_W);
check("⑦ 存在竖屏覆盖把宽体网格容器 min-width 归零（.grid-zone.side / .module-slot）",
  findBlocks(css, ".grid-zone.side", ranges).some(b => b.portrait && isZeroLen(decl(b.body, "min-width"))) &&
  findBlocks(css, ".module-slot", ranges).some(b => b.portrait && isZeroLen(decl(b.body, "min-width"))));
check("⑦ #hud-bl 竖屏改为 top 锚定（bottom:auto，避让底部虚拟控件带）",
  findBlocks(css, "#hud-bl", ranges).some(b => b.portrait && decl(b.body, "bottom") === "auto"));
check("⑦ #progress-wrap 竖屏宽度改为 100%（不写死 420px 横屏宽）",
  findBlocks(css, "#progress-wrap", ranges).some(b => b.portrait && String(decl(b.body, "width")).indexOf("100%") >= 0));
check("⑦ #buff-area 竖屏 max-width 为 vw（不写死 420px）",
  findBlocks(css, "#buff-area", ranges).some(b => b.portrait && String(decl(b.body, "max-width")).indexOf("vw") >= 0));
check("⑦ 面板/屏幕宿主统一 dvh 单屏锁定（max-height:calc(100dvh …)）",
  css.indexOf("max-height:calc(100dvh") >= 0 || css.indexOf("max-height: calc(100dvh") >= 0);

/* ============================================================
 * 汇总
 * ============================================================ */
console.log("");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
process.exit(failCount === 0 ? 0 : 1);
