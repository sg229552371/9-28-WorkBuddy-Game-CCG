/* 全局 UI「小而美 + 单屏化」改造回归测试（node ui_global_test.js）
 * 批次：20.10 全局苹果风（对齐 20.9 角色选择参考标准）
 * 覆盖：
 *   静态 ① 关键面板存在 dvh 单屏锁定（max-height: calc(100dvh - …)）；
 *   静态 ② 关键面板存在底部安全区 env(safe-area-inset-bottom)；
 *   静态 ③ 竖屏媒体查询块与 body.portrait 内不存在会覆盖新规则的旧硬编码
 *          （旧 94vh/92vh/88vh/90vh/82vh 锁高、关卡列表旧 2 列 / 1 列、旧 88vh 背包锁高）；
 *   静态 ④ 字号 / 边框 / 圆角符合「小而美」标准（关键卡片 font-size ≤ 13px、border ≤ 1px）；
 *   静态 ⑤ .char-* / #char-list 规则未被破坏（20.9 存在性断言：6 列宫格 + dvh 锁 + 安全区）；
 *   静态 ⑥ .art-* / #panel-artisan 规则未被破坏（20.10 工匠单屏三段存在性断言）；
 *   静态 ⑦ index.html 关键界面节点仍在（防结构被误删）。
 * 断言输出：PASS/FAIL 每行，末尾「PASS 合计 / 失败数」，失败则 throw。
 * 注意：PASS 文案里不含英文 error/Error（run_tests.sh 的 bad 统计口径）；表达错误一律用中文「错误」。 */
"use strict";

/* ---------- 断言工具 ---------- */
let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

const fs = require("fs"), path = require("path");
const root = __dirname;
const cssSrc = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const htmlSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");
/* 规则做平化：去掉换行 + 去掉全部注释（注释里的「@media …」「body.portrait …」字样不参与匹配） */
const cssFlat = cssSrc.split(String.fromCharCode(10)).join(" ").replace(/\/\*[\s\S]*?\*\//g, " ");

/* ---------- 工具：在平化 CSS 里做结构化扫描 ----------
 * 全部基于去注释后的文本，避免注释示例串干扰匹配。 */

/* 通用规则遍历（去注释后的平化 CSS）：展开一层 @media 嵌套，
 * cb(选择器列表, 声明体, 媒体前导)。媒体块首条规则不再被误吞。 */
function iterRules(cb) {
  let i = 0;
  const n = cssFlat.length;
  while (i < n) {
    const b1 = cssFlat.indexOf("{", i);
    if (b1 < 0) break;
    const prelude = cssFlat.slice(i, b1).trim();
    let depth = 0, k = b1;
    for (; k < n; k++) {
      if (cssFlat[k] === "{") depth++;
      else if (cssFlat[k] === "}") { depth--; if (depth === 0) break; }
    }
    const inner = cssFlat.slice(b1 + 1, k);
    if (prelude.charAt(0) === "@") {
      /* 媒体块：展开内部规则（本文件无 @media 套 @media） */
      let j = 0;
      const m = inner.length;
      while (j < m) {
        const b2 = inner.indexOf("{", j);
        if (b2 < 0) break;
        const sel2 = inner.slice(j, b2).trim();
        let d2 = 0, k2 = b2;
        for (; k2 < m; k2++) {
          if (inner[k2] === "{") d2++;
          else if (inner[k2] === "}") { d2--; if (d2 === 0) break; }
        }
        if (sel2.charAt(0) !== "@") cb(sel2, inner.slice(b2 + 1, k2), prelude);
        j = k2 + 1;
      }
    } else {
      cb(prelude, inner, "");
    }
    i = k + 1;
  }
}
/* 某选择器的「最终生效声明」：级联中最后一个【命中该选择器且声明了该属性】的块正文。
 * selExact=true 按选择器列表中的独立项精确相等（避免 .stats 误命中 .stats b）；
 * prop 为属性名正则片段（如 "font-size"），后出现的同选择器块若不带该属性则不参与。 */
function blockText(sel, prop, selExact) {
  let lastWithProp = "", lastAny = "";
  iterRules((selList, body) => {
    const sels = selList.split(",").map(s => s.trim());
    const hit = selExact ? sels.indexOf(sel) >= 0 : sels.some(s => s.indexOf(sel) >= 0);
    if (!hit) return;
    lastAny = body;
    if (!prop || new RegExp(prop).test(body)) lastWithProp = body;
  });
  return lastWithProp || lastAny;
}
/* 收集全部 @media (orientation: portrait) 块内部规则文本（配对花括号，去注释后） */
function allPortraitBlocks() {
  let out = "", i = 0;
  const n = cssFlat.length;
  while (i < n) {
    const b1 = cssFlat.indexOf("{", i);
    if (b1 < 0) break;
    const prelude = cssFlat.slice(i, b1).trim();
    let depth = 0, k = b1;
    for (; k < n; k++) {
      if (cssFlat[k] === "{") depth++;
      else if (cssFlat[k] === "}") { depth--; if (depth === 0) break; }
    }
    if (/^@media[^{]*orientation\s*:\s*portrait/.test(prelude)) out += cssFlat.slice(b1 + 1, k) + " ";
    i = k + 1;
  }
  return out;
}
/* 收集全部 body.portrait 前缀规则（JS 钩子路径，去注释后） */
function allPortraitHookRules() {
  const re = /body\.portrait\s+[^{}]+\{[^}]*\}/g;
  let m, out = "";
  while ((m = re.exec(cssFlat)) !== null) out += m[0] + " ";
  return out;
}
/* 面板是否在某条规则里拿到「padding-bottom: max(.., env(safe-area-inset-bottom))」 */
function panelHasSafeArea(sel) {
  let ok = false;
  iterRules((selList, body) => {
    if (selList.split(",").some(s => s.trim().indexOf(sel) >= 0) &&
        /padding-bottom\s*:\s*max\([^)]*env\(safe-area-inset-bottom\)\)/.test(body)) ok = true;
  });
  return ok;
}
const pb = allPortraitBlocks();
const hook = allPortraitHookRules();

/* ============================================================
 * ① 关键面板：dvh 单屏锁定
 * ============================================================ */
const dvhPanels = [
  ["主菜单", ".main-panel"],
  ["关卡选择", ".level-panel"],
  ["图鉴", ".codex-panel"],
  ["背包", ".bp-panel"],
  ["设置", ".settings-panel"],
  ["帮助", ".help-panel"],
  ["告别", ".goodbye-panel"],
  ["结算", ".settle-panel"],
  ["死亡", ".death-panel"],
  ["个人资料/局外成长", ".meta-panel"],
];
for (const [nm, sel] of dvhPanels) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^{]*\\{[^}]*max-height\\s*:\\s*calc\\(100dvh");
  check("① " + nm + "面板含 100dvh 单屏锁定（" + sel + "）", re.test(cssFlat));
}
check("① 结算/死亡共享规则同时含 dvh 锁定",
  /\.settle-panel,\s*\.death-panel\s*\{[^}]*max-height\s*:\s*calc\(100dvh/.test(cssFlat));

/* ============================================================
 * ② 关键面板：底部安全区 env(safe-area-inset-bottom)
 * ============================================================ */
for (const [nm, sel] of dvhPanels) {
  check("② " + nm + "面板含底部安全区（padding-bottom: max(.., env(safe-area-inset-bottom))）",
    panelHasSafeArea(sel));
}
check("② 统一安全区声明出现 ≥3 处（主规则 + 竖屏媒体查询 + body.portrait 钩子）",
  (cssFlat.match(/padding-bottom\s*:\s*max\([^)]*env\(safe-area-inset-bottom\)\)/g) || []).length >= 3);
check("② index.html viewport 含 viewport-fit=cover（安全区生效前提）",
  htmlSrc.indexOf("viewport-fit=cover") >= 0);

/* ============================================================
 * ③ 竖屏块 / body.portrait：不存在覆盖新规则的旧硬编码
 * ============================================================ */
/* 3a. 竖屏媒体查询块内不允许出现旧 vh 锁高（94vh/92vh/88vh/90vh/82vh）——dvh 化验收 */
check("③ 竖屏媒体查询块不含旧 94vh/92vh/88vh/90vh/82vh 锁高",
  !/\b(94|92|88|90|82)vh\b/.test(pb));
check("③ body.portrait 钩子段不含旧 vh 锁高", !/\b(94|92|88|90|82)vh\b/.test(hook));
/* 3b. 竖屏块内关卡列表不允许旧 2 列 / 1 列网格（新标准 3 列） */
check("③ 竖屏块 #level-list 为 3 列网格（无旧 2 列/1 列覆盖）",
  /#level-list\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*3\s*,\s*1fr\s*\)/.test(pb) &&
  !/#level-list\s*\{[^}]*grid-template-columns\s*:\s*(1fr\s+1fr|1fr)\s*;/.test(pb));
check("③ body.portrait 钩子 #level-list 为 3 列网格",
  /body\.portrait\s+#level-list\s*\{[^}]*repeat\(\s*3\s*,\s*1fr\s*\)/.test(hook) || /body\.portrait\s+#level-list\s*\{[^}]*repeat\(\s*3/.test(hook));
/* 3c. 竖屏块内 .bp-panel 不允许旧 88vh（已 dvh 化） */
check("③ 竖屏块 .bp-panel 含 dvh 锁定（无旧 88vh）",
  /\.bp-panel\s*\{[^}]*max-height\s*:\s*calc\(100dvh/.test(pb));
/* 3d. 竖屏块内 .codex-panel 不允许旧 88vh */
check("③ 竖屏块 .codex-panel 含 dvh 锁定（无旧 88vh）",
  /\.codex-panel\s*\{[^}]*max-height\s*:\s*calc\(100dvh/.test(pb));
/* 3e. 主规则里各面板不允许旧 vh 锁高（除 .char-panel 的 20.9 参考实现与 #app 100vh 视口占位） */
(function noOldVhInMainRules() {
  /* 逐块扫描（去注释后）：找出所有含旧 vh 锁高的声明块。
   * 白名单：无（100vh 视口占位 / 44vh 立绘尺寸不在扫描口径内）。 */
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m, bad = [];
  while ((m = re.exec(cssFlat)) !== null) {
    const sel = m[1].trim(), body = m[2];
    if (/\b(94|92|88|90|82)vh\b/.test(body)) bad.push(sel.slice(0, 60));
  }
  check("③ 全文件无旧 vh 面板锁高残留（94/92/88/90/82vh 全部 dvh 化）", bad.length === 0);
})();

/* ============================================================
 * ④ 字号 / 边框 / 圆角「小而美」标准
 * ============================================================ */
function fontSizeOf(sel) {
  const m = blockText(sel, "font-size", true).match(/font-size\s*:\s*([\d.]+)px/);
  return m ? parseFloat(m[1]) : null;
}
function borderWidthOf(sel, selExact) {
  /* prop 用完整「border(:|-width:)」形态匹配，避免被 border-radius 误命中 */
  const bt = blockText(sel, "border(?:-width)?\\s*:", selExact);
  let m = bt.match(/border(?:-width)?\s*:\s*([\d.]+)px/);
  return m ? parseFloat(m[1]) : null;
}
(function beautyChecks() {
  /* 关键卡片字号 ≤ 上限 px（精确选择器，避免 .stats b 之类子元素误代） */
  const fsChecks = [
    ["关卡卡名字 .level-card .lv-name", ".level-card .lv-name", 13],
    ["关卡卡次要信息 .level-card .lv-meta", ".level-card .lv-meta", 13],
    ["图鉴卡 .codex-card", ".codex-card", 13],
    ["图鉴卡标题 .codex-card b", ".codex-card b", 13],
    ["结算统计 .stats", ".stats", 13],
    ["战利品 chip", ".items-list .chip", 13],
    ["设置行 .set-row", ".set-row", 13],
    ["帮助正文 .help-cols p", ".help-cols p", 13],
    ["主菜单大按钮 .btn.big", ".btn.big", 15],
  ];
  for (const [nm, sel, cap] of fsChecks) {
    const v = fontSizeOf(sel);
    check("④ " + nm + " 字号 ≤ " + cap + "px（实测 " + v + "px）", v !== null && v <= cap);
  }
  /* 关键卡片边框 ≤ 1px（面板边框看 .panel 基线：各面板自身不声明边框，继承 1px） */
  const bdChecks = [
    ["关卡卡 .level-card", ".level-card", true],
    ["图鉴卡 .codex-card", ".codex-card", true],
    ["模块槽 .module-slot", ".module-slot", true],
    ["面板基线 .panel（设置/帮助等继承）", ".panel", true],
  ];
  for (const [nm, sel, exact] of bdChecks) {
    const v = borderWidthOf(sel, exact);
    check("④ " + nm + " 边框 ≤ 1px（实测 " + v + "px）", v !== null && v <= 1);
  }
  /* 圆角 8~10px（小而美不带大圆角） */
  const rChecks = [
    ["关卡卡 .level-card", ".level-card", 8, 10],
    ["图鉴卡 .codex-card", ".codex-card", 8, 10],
    ["按钮 .btn", ".btn", 8, 10],
  ];
  for (const [nm, sel, lo, hi] of rChecks) {
    const m = blockText(sel, "border-radius").match(/border-radius\s*:\s*([\d.]+)px/);
    const v = m ? parseFloat(m[1]) : null;
    check("④ " + nm + " 圆角在 " + lo + "~" + hi + "px（实测 " + v + "px）", v !== null && v >= lo && v <= hi);
  }
  /* 面板 padding 收紧（设置面板未放大内边距） */
  const sp = blockText(".settings-panel", "padding");
  const mPad = sp.match(/padding\s*:\s*([\d.]+)px/);
  check("④ 设置面板内边距紧凑（实测 ≤ 24px 或沿用 .panel 默认）",
    mPad === null || parseFloat(mPad[1]) <= 24);
})();

/* ============================================================
 * ⑤ .char-* / #char-list 未被破坏（20.9 参考标准存在性）
 * ============================================================ */
check("⑤ #char-list 仍为 6 列宫格（主规则）",
  /#char-list\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*6\s*,\s*1fr\s*\)/.test(cssFlat));
check("⑤ .char-panel 仍含 calc(100dvh - 16px) 单屏锁定",
  /\.char-panel\s*\{[^}]*max-height\s*:\s*calc\(100dvh\s*-\s*16px\)/.test(cssFlat));
check("⑤ .char-panel 仍含底部安全区 env(safe-area-inset-bottom)",
  /\.char-panel\s*\{[^}]*padding-bottom\s*:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\)/.test(cssFlat));
check("⑤ .char-card 名字仍为 9px 小而美", /\.char-card \.char-name\s*\{[^}]*font-size\s*:\s*9px/.test(cssFlat));
check("⑤ body.portrait #char-list 仍为 6 列（钩子双保险未被改动）",
  /body\.portrait\s+#char-list\s*\{[^}]*repeat\(\s*6\s*,\s*1fr\s*\)/.test(cssFlat));
check("⑤ index.html 仍含 #char-list / #char-detail 节点",
  htmlSrc.indexOf('id="char-list"') >= 0 && htmlSrc.indexOf('id="char-detail"') >= 0);

/* ============================================================
 * ⑥ .art-* / #panel-artisan 未被破坏（工匠单屏三段存在性）
 * ============================================================ */
check("⑥ .art-panel 仍含 calc(100dvh - 16px) 单屏锁定",
  /\.art-panel\s*\{[^}]*max-height\s*:\s*calc\(100dvh\s*-\s*16px\)/.test(cssFlat));
check("⑥ .art-panel 竖屏块仍含 --art-cell: 30px 缩格（拖拽步长不被破坏）",
  pb.indexOf("--art-cell: 30px") >= 0);
check("⑥ body.portrait .art-panel 仍含 dvh 锁定 + 安全区",
  /body\.portrait\s+\.art-panel\s*\{[^}]*calc\(100dvh\s*-\s*16px\)[^}]*env\(safe-area-inset-bottom\)/.test(cssFlat));
check("⑥ index.html 仍含 #panel-artisan / #art-grids 节点",
  htmlSrc.indexOf('id="panel-artisan"') >= 0 && htmlSrc.indexOf('id="art-grids"') >= 0);
check("⑥ 图鉴立绘卡 .portrait-card 竖屏 display:block 未被破坏（防文字竖排回归）",
  /\.codex-card\.portrait-card\s*\{[^}]*display\s*:\s*block/.test(cssFlat) &&
  /body\.portrait\s+\.codex-card\.portrait-card\s*\{[^}]*display\s*:\s*block/.test(cssFlat));

/* ============================================================
 * ⑦ index.html 关键界面节点仍在
 * ============================================================ */
for (const id of ["screen-main", "screen-level", "screen-codex", "screen-chip-codex", "screen-settings",
  "screen-help", "screen-goodbye", "screen-settle", "screen-death", "panel-profile",
  "panel-backpack", "bp-panel-main", "level-list", "btn-level-back", "btn-settle-ok", "btn-death-ok"]) {
  check("⑦ index.html 含 id=" + id, htmlSrc.indexOf('id="' + id + '"') >= 0);
}

/* ---------- 汇总 ---------- */
console.log("----------------------------------------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("全局 UI 测试未通过，失败数 = " + failCount);
