/* ============================================================================
 * export_cfg.cjs —— CFG 配置表导出（P2：js/config.js → cfg/*.json）
 * 真源：HTLM/js/config.js（const CFG = {}，纯数据 + 构建期曲线生成器）
 * 用法：node mods/jes-engine-core/tools/export_cfg.cjs   （在仓库根执行）
 * 校验基线：heroes=12、levels=99（D041 口径）；函数值残留 = 0（构建期应全部消化）
 * ============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..", "..");   // 仓库根
const SRC = path.join(ROOT, "HTLM", "js", "config.js");
const OUT_DIR = path.join(ROOT, "cfg");

// ① 沙箱执行 config.js（无外部依赖，"use strict" + const CFG）
const ctx = {};
vm.createContext(ctx);
// const/let 不进沙箱 global：脚本尾部显式挂到 globalThis 再取
vm.runInContext(
  fs.readFileSync(SRC, "utf8") + "\n;globalThis.__CFG__ = CFG;",
  ctx, { filename: "js/config.js" }
);
const CFG = ctx.__CFG__;
if (!CFG || typeof CFG !== "object") {
  console.error("错误：沙箱执行后未获得 CFG 对象");
  process.exit(1);
}

// ② 深度扫描函数值残留（构建期生成器未消化的才需要处理）
// 约定：CFG 顶层 `_` 前缀键 = 内部工具函数（如 _validateLevelCurve），非数据，不导出不报警
const keys = Object.keys(CFG).filter(k => !k.startsWith("_"));
let fnCount = 0;
function scan(obj, p) {
  if (typeof obj === "function") { fnCount++; console.warn(`警告：函数值残留 ${p}`); return; }
  if (obj && typeof obj === "object") for (const k of Object.keys(obj)) scan(obj[k], `${p}.${k}`);
}
for (const k of keys) scan(CFG[k], `CFG.${k}`);

// ③ 逐顶层键导出 JSON
fs.mkdirSync(OUT_DIR, { recursive: true });
const summary = [];
for (const key of keys.sort()) {
  const val = CFG[key];
  if (typeof val === "function") continue;   // 函数键不导出（已计数报警）
  const file = path.join(OUT_DIR, `${key}.json`);
  fs.writeFileSync(file, JSON.stringify(val, null, 2), "utf8");
  const bytes = fs.statSync(file).size;
  const count = Array.isArray(val) ? `数组[${val.length}]` : `对象{${Object.keys(val).length}键}`;
  summary.push(`${key}: ${count} ${bytes}B`);
}

// ④ 基线校验（口径对齐 G_docs/X-GAMe evidence/config-snapshot：heroes=12、levels=99）
const problems = [];
if (!CFG.heroes || CFG.heroes.length !== 12) problems.push(`heroes 应为 12 实得 ${CFG.heroes && CFG.heroes.length}`);
if (!CFG.levels || CFG.levels.length !== 99) problems.push(`levels 应为 99 实得 ${CFG.levels && CFG.levels.length}`);

console.log("导出完成 →", OUT_DIR);
console.log(summary.join("\n"));
if (fnCount > 0) { console.error(`错误：函数值残留 ${fnCount} 处（构建期生成器未消化）`); process.exit(1); }
if (problems.length) { console.error("错误：" + problems.join("；")); process.exit(1); }
console.log("基线校验通过（heroes=12、levels=99、函数残留=0）");
