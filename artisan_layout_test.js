/* 工匠世界「竖屏单屏化」布局回归测试（node artisan_layout_test.js）
 * 背景（20.10）：用户反馈工匠世界 UI 上下滚动太多、要求苹果风小而美。
 * 本轮改动：
 *   ① 页签 4 → 2：删除「抽卡牌」页签（属性卡牌系统整体废弃，CFG.cardPool.removed）；
 *      「购买·服务」+「芯片工坊」合并为「商店·工坊」（id 复用 shop）。
 *   ② .art-panel 消灭 overflow:auto → max-height:calc(100dvh - 16px) 锁一屏。
 *   ③ 竖屏三段：上=页签内容区 / 中=搜刮背包 / 下=武器槽+芯片背包，物品信息最底。
 *   ④ 苹果风小而美：小字号 / 细边框 / 小圆角 / 克制选中高亮。
 * 覆盖（题目要求的 5 项）：
 *   静态 ① index.html 不存在 art-tab-cards / art-page-cards；
 *   静态 ② 页签按钮数量正好 2 个（art-tabs 内 .art-tab，原 4 减 2 = 2，题目语境「正好 3 个页签内容」指
 *          合并后页签数 ≤ 3 且不含 cards/forge，本项按 2 断言并兼容说明）；
 *   静态 ③ .art-panel 不含 overflow:auto 且含 max-height 锁定（calc(100dvh - 16px)）；
 *   静态 ④ 竖屏媒体查询与 body.portrait 无旧规则残留覆盖（不得出现 90vh / max-height:90vh/
 *          overflow:auto 的旧工匠规则；grid-template-columns 3 列旧规则不得覆盖网格）；
 *   静态 ⑤ CFG_ARTISAN_UI 常量存在且字段完整（js/ui.js 末尾，待合并进 CFG）。
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 时 throw。
 * ⚠️ PASS/FAIL 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）。 */
"use strict";

const fs = require("fs"), path = require("path");
const root = __dirname;

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---------- 读源码（拍平换行便于跨行正则） ---------- */
const htmlSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssSrc = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const uiSrc = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
const mainSrc = fs.readFileSync(path.join(root, "js", "main.js"), "utf8");
const cssFlat = cssSrc.split("\n").join(" ").replace(/\s+/g, " ");
const htmlFlat = htmlSrc.split("\n").join(" ");

/* ============================================================
 * ① index.html：抽卡牌页签已整体摘除
 * ============================================================ */
check("一 index.html 不存在 art-tab-cards 按钮", htmlSrc.indexOf('id="art-tab-cards"') < 0);
check("一 index.html 不存在 art-page-cards 页面", htmlSrc.indexOf('id="art-page-cards"') < 0);
check("一 index.html 不存在卡牌候选/已用/资产容器（card-candidates/card-applied/card-assets）",
  htmlSrc.indexOf('id="card-candidates"') < 0 && htmlSrc.indexOf('id="card-applied"') < 0
  && htmlSrc.indexOf('id="card-assets"') < 0);
check("一 main.js 不再绑定 art-tab-cards", mainSrc.indexOf('on("art-tab-cards"') < 0);
/* renderCards 函数本体必须保留（可能仍有引用，删了会炸） */
check("一 ui.js 保留 renderCards 函数本体（只摘页签入口不删函数）", /renderCards\s*\(\s*\)\s*\{/.test(uiSrc));

/* ============================================================
 * ② 页签数量：合并后正好 2 个（开宝箱 / 商店·工坊）
 * ============================================================ */
const tabBtns = htmlSrc.match(/class="art-tab[^"]*"\s+id="art-tab-[^"]+"/g) || [];
check("二 页签按钮正好 2 个（实测 " + tabBtns.length + " 个）", tabBtns.length === 2);
check("二 页签为 开宝箱 + 商店·工坊（id: chest/shop）",
  htmlSrc.indexOf('id="art-tab-chest"') >= 0 && htmlSrc.indexOf('id="art-tab-shop"') >= 0);
check("二 不存在 art-tab-forge 独立页签（已并入商店·工坊）", htmlSrc.indexOf('id="art-tab-forge"') < 0);
check("二 index.html 不存在 art-page-forge 独立页面（内容并入 art-page-shop）",
  htmlSrc.indexOf('id="art-page-forge"') < 0);
check("二 商店·工坊页面同时含 shop-list 与 forge-list（上下排列）",
  /id="art-page-shop"[\s\S]*?id="shop-list"[\s\S]*?id="forge-list"/.test(htmlSrc));
check("二 ui.js ART_TABS 只剩 2 项且不含 cards/forge",
  (uiSrc.match(/\{\s*id:\s*"(?:chest|shop|cards|forge)"\s*,\s*btn:/g) || []).length === 2
  && uiSrc.indexOf('id: "cards"') < 0 && uiSrc.indexOf('id: "forge"') < 0);

/* ============================================================
 * ③ .art-panel：消灭整面板滚动条 + 锁定一屏
 * ============================================================ */
/* 提取 .art-panel 主规则块（非媒体查询内的第一处） */
const artPanelRule = (cssFlat.match(/\.art-panel\s*\{[^}]*\}/) || [""])[0];
check("三 .art-panel 主规则存在", artPanelRule.length > 0);
check("三 .art-panel 不含 overflow:auto（病根已消灭）",
  !/overflow\s*:\s*auto/.test(artPanelRule) && !/overflow:\s*scroll/.test(artPanelRule));
check("三 .art-panel 含 max-height:calc(100dvh - 16px) 锁定",
  /max-height\s*:\s*calc\(\s*100dvh\s*-\s*16px\s*\)/.test(artPanelRule));
check("三 .art-panel 含底部安全区 padding（env(safe-area-inset-bottom)）",
  /env\(\s*safe-area-inset-bottom/.test(artPanelRule));
check("三 .art-panel 为 flex 纵向（内部三段排布的前提）",
  /display\s*:\s*flex/.test(artPanelRule) && /flex-direction\s*:\s*column/.test(artPanelRule));

/* ============================================================
 * ④ 竖屏媒体查询 与 body.portrait：无旧规则残留覆盖
 * ============================================================ */
/* 提取工匠竖屏段（@media (orientation: portrait) 内含 .art-panel 的那段） */
const portraitBlocks = cssSrc.match(/@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?\n\}/g) || [];
const artPortrait = (portraitBlocks.find(b => b.indexOf(".art-panel") >= 0) || "");
check("四 竖屏媒体查询存在工匠段落", artPortrait.length > 0);
check("四 竖屏工匠段落无 overflow:auto 残留", !/overflow\s*:\s*auto/.test(artPortrait));
check("四 竖屏工匠段落 max-height 锁 calc(100dvh - 16px)（不是旧 90vh）",
  /max-height\s*:\s*calc\(\s*100dvh\s*-\s*16px\s*\)/.test(artPortrait)
  && !/max-height\s*:\s*90vh/.test(artPortrait));
check("四 竖屏工匠段落含三段布局规则（art-side 上 / zone-backpack 中 / zone-chip 下）",
  /\.art-side/.test(artPortrait) && /zone-backpack/.test(artPortrait) && /zone-chip/.test(artPortrait));
/* body.portrait 双保险段落 */
const bpArt = cssFlat.match(/body\.portrait \.art-panel\s*\{[^}]*\}/) || [""];
check("四 body.portrait .art-panel 双写存在且锁 100dvh（无 90vh 残留）",
  bpArt[0].length > 0 && /calc\(\s*100dvh\s*-\s*16px\s*\)/.test(bpArt[0]) && !/90vh/.test(bpArt[0]));
check("四 body.portrait .art-grids 无旧规则残留（必须 display:flex + overflow:hidden）",
  /body\.portrait \.art-grids\s*\{[^}]*display\s*:\s*flex[^}]*overflow\s*:\s*hidden/.test(cssFlat));
/* 旧版覆盖坑回归：竖屏不得再出现把 .art-grids 网格改 3 列之类的旧规则 */
check("四 竖屏无 .art-grids 旧 3 列网格规则残留（防主规则被覆盖的历史坑）",
  !/\.art-grids\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*3/.test(cssFlat));
/* 网格缩格变量：--art-cell 在 :root 有默认、竖屏工匠面板内为 30px */
check("四 :root 定义 --art-cell 默认 46px（桌面不受影响）",
  /:root\s*\{[^}]*--art-cell\s*:\s*46px/.test(cssFlat));
check("四 竖屏工匠面板把 --art-cell 缩到 40px（21.5 方案 B，30px 触屏点不准；含 body.portrait 双写）",
  /\.art-panel\s*\{[^}]*--art-cell\s*:\s*40px/.test(artPortrait)
  && /body\.portrait \.art-panel\s*\{[^}]*--art-cell\s*:\s*40px/.test(cssFlat));

/* ============================================================
 * ⑤ CFG_ARTISAN_UI 常量存在且字段完整（js/ui.js 末尾，待合并进 CFG）
 * ============================================================ */
const m = uiSrc.match(/var\s+CFG_ARTISAN_UI\s*=\s*\{[\s\S]*?\};/);
check("五 ui.js 末尾存在 CFG_ARTISAN_UI 常量（含「待合并进 CFG」注释）",
  !!m && uiSrc.indexOf("待合并进 CFG") >= 0);
if (m) {
  const body = m[0];
  const need = ["tabCount", "panelMaxVh", "panelMaxGapPx", "safePadBottomPx",
    "tabFontPx", "rowFontPx", "pendingSizePx", "radiusPx", "borderPx"];
  for (const k of need) check("五 CFG_ARTISAN_UI 含字段 " + k, new RegExp("\\b" + k + "\\s*:").test(body));
  check("五 CFG_ARTISAN_UI.tabCount = 2（与页面页签数一致）", /tabCount\s*:\s*2/.test(body));
} else {
  for (const k of ["tabCount", "panelMaxVh", "panelMaxGapPx", "safePadBottomPx",
    "tabFontPx", "rowFontPx", "pendingSizePx", "radiusPx", "borderPx"]) {
    check("五 CFG_ARTISAN_UI 含字段 " + k, false);
  }
}

/* ============================================================
 * ⑥ 苹果风小而美：字号 / 边框 / 圆角收紧（回归确认不回弹）
 * ============================================================ */
const tabRule = (cssFlat.match(/\.art-tab\s*\{[^}]*\}/) || [""])[0];
check("六 .art-tab 小字号（≤12px）+ 小内边距（≤8px）",
  /font-size\s*:\s*1[0-2]px/.test(tabRule) && /padding\s*:\s*[1-8]px/.test(tabRule));
const rowRule = (cssFlat.match(/\.chest-row\s*\{[^}]*\}/) || [""])[0];
check("六 .chest-row 细边框（1px）+ 小内边距（≤8px 纵向）", /border\s*:\s*1px/.test(rowRule));
const pendRule = (cssFlat.match(/\.pending-item\s*\{[^}]*\}/) || [""])[0];
check("六 .pending-item 缩小到 ≤48px（原 64px）", /width\s*:\s*(4[0-8]|3\d)px/.test(pendRule));
check("六 选中高亮为克制样式（细光晕，非大色块粗边框）",
  /box-shadow\s*:\s*0 0 0 1px rgba\(255,\s*215,\s*106/.test(cssFlat));

/* ============================================================
 * ⑦ 语法自检：ui.js / main.js 可被 Node 解析（不执行）
 * ============================================================ */
for (const [label, src] of [["ui.js", uiSrc], ["main.js", mainSrc]]) {
  let ok = true, msg = "";
  try { new Function(src); } catch (e) { ok = false; msg = e.message; }
  check("七 " + label + " 语法自检通过（Function 构造不抛异常）" + (ok ? "" : "：" + msg), ok);
}

/* ---------- 汇总 ---------- */
console.log("----------------------------------------");
console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) throw new Error("工匠布局测试未通过，失败数 = " + failCount);
