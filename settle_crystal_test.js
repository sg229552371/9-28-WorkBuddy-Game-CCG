/* settle_crystal_test.js — 结晶产出可见化链路测试（20.10 收口）
 * 覆盖：buildCrystalReport 三种路径文案 → publishCrystalReport 挂载 → UI._crystalReportLine 渲染。
 * 断言文案统一用中文「错误」，避免门禁 bad 计数误判。 */
"use strict";

const fs = require("fs");
const path = require("path");

let pass = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("PASS " + msg); }
  else { failed++; console.log("FAIL " + msg); }
}

const dir = __dirname;
const gameSrc = fs.readFileSync(path.join(dir, "js/game.js"), "utf8");
const uiSrc = fs.readFileSync(path.join(dir, "js/ui.js"), "utf8");

/* ---------- 1. 源码结构：接口与挂点存在 ---------- */
ok(/function buildCrystalReport\s*\(/.test(gameSrc), "game.js 应定义 buildCrystalReport 纯函数");
ok(/function publishCrystalReport\s*\(/.test(gameSrc), "game.js 应定义 publishCrystalReport 广播函数");
ok(/publishCrystalReport\(kills, bossDefeated, extracted, v\)/.test(gameSrc),
  "Meta.awardRun 内应有单行挂点调用 publishCrystalReport");
ok(/G\.lastSettleReport\s*=\s*rep/.test(gameSrc), "publishCrystalReport 应把报告挂到 G.lastSettleReport");
ok(/Meta\.lastReport\s*=\s*rep/.test(gameSrc), "publishCrystalReport 应把报告挂到 Meta.lastReport");

/* ---------- 2. 文案生成逻辑：三种路径 ---------- */
// 抽取 buildCrystalReport 函数体做独立求值（不加载整个 game.js，避免依赖 CFG/G/Meta）
const fnMatch = gameSrc.match(/function buildCrystalReport\(result\)\s*\{[\s\S]*?\n\}/);
ok(!!fnMatch, "应能抽取 buildCrystalReport 函数体");
const fnBody = fnMatch ? fnMatch[0] : "";

// 构造最小 CFG 环境求值
const CFG = { outLevel: { crystalBoss: 60, deathRatio: 0.3 }, settleConvert: { valueRate: 0.5 } };
let buildCrystalReport = null;
try {
  buildCrystalReport = eval("(" + fnBody + ")");
} catch (e) {
  ok(false, "buildCrystalReport 应可独立求值，实际抛出：" + e.message);
}

if (buildCrystalReport) {
  // 路径①：撤离 + 击杀 BOSS + 有折算
  const a = buildCrystalReport({ bossDefeated: true, extracted: true, convertTotal: 30, boss: 60 });
  ok(a.total === 90, "撤离+首领+折算 总计应为 60+30=90，实际 " + a.total);
  ok(a.boss === 60 && a.convertTotal === 30, "撤离路径应分别记录 boss 与 convertTotal");
  ok(a.died === false, "撤离路径 died 应为 false");
  ok(a.lines.some(s => s.indexOf("击杀首领") >= 0), "撤离路径应含「击杀首领」明细行");
  ok(a.lines.some(s => s.indexOf("物资折算") >= 0), "撤离路径应含「物资折算」明细行");
  ok(a.lines[a.lines.length - 1].indexOf("本局合计") >= 0, "末行应为「本局合计」总计行");

  // 路径②：撤离但未杀 BOSS、无可折算物资
  const b = buildCrystalReport({ bossDefeated: false, extracted: true, convertTotal: 0, boss: 0 });
  ok(b.total === 0, "无产出时总计应为 0，实际 " + b.total);
  ok(b.lines.some(s => s.indexOf("无结晶产出") >= 0), "无产出路径应给出「无结晶产出」说明");

  // 路径③：死亡（未撤离）——BOSS 结晶按 deathRatio 打折，且不折算
  const c = buildCrystalReport({ bossDefeated: true, extracted: false });
  const expectBoss = Math.floor(60 * 0.3);
  ok(c.boss === expectBoss, "死亡路径首领结晶应打折为 " + expectBoss + "，实际 " + c.boss);
  ok(c.convertTotal === 0, "死亡路径不应发生折算，convertTotal 应为 0");
  ok(c.died === true, "死亡路径 died 应为 true");
  ok(c.lines.some(s => s.indexOf("阵亡") >= 0), "死亡路径应含「阵亡」提示行");
  ok(c.lines.some(s => s.indexOf("保留") >= 0), "死亡路径应说明保留比例");
}

/* ---------- 3. UI 渲染侧 ---------- */
ok(/G\.lastSettleReport/.test(uiSrc), "ui.js 应读取 G.lastSettleReport");
ok(/_crystalReportLine\s*\(\)\s*\{/.test(uiSrc), "ui.js 应定义 _crystalReportLine 渲染辅助");
ok(/showSettlement[\s\S]{0,900}this\._crystalReportLine\(\)/.test(uiSrc),
  "showSettlement 应调用 _crystalReportLine 渲染明细");
ok(/showDeath[\s\S]{0,900}this\._crystalReportLine\(\)/.test(uiSrc),
  "showDeath 应调用 _crystalReportLine 渲染明细");

// 模拟渲染：三种输入下的输出字符串
const renderMatch = uiSrc.match(/_crystalReportLine\(\)\s*\{[\s\S]*?\n\s{2}\},/);
ok(!!renderMatch, "应能抽取 _crystalReportLine 函数体");
if (renderMatch) {
  const renderFnBody = renderMatch[0].replace(/,\s*$/, "");
  // 用 new Function 显式注入 G，避免模块作用域下自由变量不可见
  const make = new Function("G", "return " +
    renderFnBody.replace(/^_crystalReportLine\(\)/, "function _crystalReportLine()"));
  const G = {};
  const renderFn = make(G);
  // 无报告：应返回空串不抛错
  G.lastSettleReport = null;
  ok(renderFn() === "", "无报告时应返回空串，实际 " + JSON.stringify(renderFn()));
  G.lastSettleReport = { lines: [] };
  ok(renderFn() === "", "空明细时应返回空串，实际 " + JSON.stringify(renderFn()));
  // 有报告：应含明细与总计
  const rep = buildCrystalReport({ bossDefeated: true, extracted: true, convertTotal: 30, boss: 60 });
  G.lastSettleReport = rep;
  const html = renderFn();
  ok(html.indexOf("结晶获取") >= 0, "有报告时应输出「结晶获取」标题");
  ok(html.indexOf("击杀首领 +60") >= 0, "应渲染首领明细");
  ok(html.indexOf("物资折算 +30") >= 0, "应渲染折算明细");
  ok(html.indexOf("本局合计 +90") >= 0, "应渲染总计行");
}

/* ---------- 4. 废弃系统残留清理 ---------- */
ok(!/卡牌→◆/.test(uiSrc), "结算折算文案不应再出现已废弃的「卡牌→◆」分项");
ok(/道具→◆/.test(uiSrc), "结算折算文案应保留「道具→◆」分项");

/* ---------- 5. main.js 调用顺序：先 awardRun 后 show ---------- */
const mainSrc = fs.readFileSync(path.join(dir, "js/main.js"), "utf8");
const iAward = mainSrc.indexOf("Meta.awardRun(G.run.kills, G.run.bossDefeated, true)");
const iShow = mainSrc.indexOf("UI.showSettlement(crystals)");
ok(iAward >= 0 && iShow >= 0 && iAward < iShow,
  "main.js 应先发布报告（awardRun）再渲染结算（showSettlement）");
const iAward2 = mainSrc.indexOf("Meta.awardRun(G.run.kills, G.run.bossDefeated, false)");
const iShow2 = mainSrc.indexOf("UI.showDeath(penalty, crystals)");
ok(iAward2 >= 0 && iShow2 >= 0 && iAward2 < iShow2,
  "main.js 应先发布报告（awardRun）再渲染死亡（showDeath）");

console.log("合计 " + pass + (failed ? "  失败=" + failed : ""));
process.exit(failed ? 1 : 0);
