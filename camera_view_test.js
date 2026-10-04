/* 相机视野调参回归测试（node camera_view_test.js）
 * 风格参考 level_tuning_test.js：Node vm 沙箱加载 js/config.js 后跑断言。
 * 背景：用户反馈「视角太小、看不到足够战场」——本次把视野调大。
 *   ⚠️ 视野机制关键：game.js 用 viewW = G.W/zoom、viewH = G.H/zoom；main.js 又有 G.H = viewH_cfg×zoom、
 *   G.W = G.H×屏幕宽高比 → zoom 约掉，真正决定「看得多远多广」的是 viewH_cfg：
 *       可视世界高 visH = viewH_cfg；可视世界宽 visW = viewH_cfg × 屏幕宽高比。
 *   本次：viewH 720→900（视野 +25%）、zoom 1.5→1.2（反比配平，画布高仍 1080）。
 * 输出契约：每行 PASS/FAIL，末尾「PASS 合计 = N   失败数 = M」，M>0 时抛异常（throw）。
 * ⚠️ PASS 行文案禁用英文 error/Error（run_tests.sh 以 grep -ci 统计失败，避免误判）。 */
"use strict";

const fs = require("fs"), vm = require("vm"), path = require("path");

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log("PASS " + name); }
  else { failCount++; console.log("FAIL " + name); }
}

/* ---- 一、无 DOM 沙箱加载：只给 console，不给 document/window ---- */
let CFG = null, loadOk = true;
try {
  const ctx = vm.createContext({ console: console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "js/config.js"), "utf8"), ctx, { filename: "js/config.js" });
  vm.runInContext("this.__CFG = CFG;", ctx);
  CFG = ctx.__CFG;
} catch (e) {
  loadOk = false;
  console.log("FAIL config.js 无 DOM 沙箱加载抛出异常: " + (e && e.message));
}
check("一 config.js 无 DOM 沙箱加载不抛错", loadOk && CFG && typeof CFG === "object");

/* ---- 二、CFG.camera 存在且 zoom 在合理区间、确实比原 1.5 小（视野变大） ---- */
const cam = CFG && CFG.camera;
check("二 CFG.camera 存在且为对象", !!cam && typeof cam === "object");
check("二 zoom 为有限数且在合理区间（>0 且 <2）",
  !!cam && typeof cam.zoom === "number" && isFinite(cam.zoom) && cam.zoom > 0 && cam.zoom < 2);
check("二 zoom 比原值 1.5 小（改动生效，视野变大）", !!cam && cam.zoom < 1.5);
check("二 zoom 落在建议区间 [1.15, 1.30]", !!cam && cam.zoom >= 1.15 && cam.zoom <= 1.30);

/* ---- 三、viewH 保持合理正值，且比原 720 大（真正的视野旋钮） ---- */
check("三 viewH 为有限正值且在合理区间（>0 且 <=2000）",
  !!cam && typeof cam.viewH === "number" && isFinite(cam.viewH) && cam.viewH > 0 && cam.viewH <= 2000);
check("三 viewH 比原值 720 大（可见战场更远更广）", !!cam && cam.viewH > 720);

/* ---- 四、画布锚点配平：viewH×zoom 仍 ≈ 1080（不破坏既有画布/跨端契约） ---- */
const canvasH = cam ? Math.round(cam.viewH * cam.zoom) : 0;
check("四 画布高 round(viewH×zoom) 仍为 1080（跨端锚点配平：" + canvasH + "）", canvasH === 1080);

/* ---- 五、静态检查：js/game.js 相机消费点仍能正确读取 CFG.camera.zoom ---- */
let gameSrc = "";
try { gameSrc = fs.readFileSync(path.join(__dirname, "js/game.js"), "utf8"); }
catch (e) { gameSrc = ""; }
check("五 game.js 源码可读", gameSrc.length > 0);
check("五 game.js 相机消费点仍读取 CFG.camera 与 zoom（改动不会让消费点失效）",
  /CFG\.camera\s*&&\s*CFG\.camera\.zoom/.test(gameSrc));
check("五 game.js 仍以 G.W/zoom、G.H/zoom 推导可视世界",
  /G\.W\s*\/\s*zoom/.test(gameSrc) && /G\.H\s*\/\s*zoom/.test(gameSrc));

/* ---- 六、视野计算：390 宽竖屏（aspect 390/844）下可视世界宽/高均大于改动前 ---- */
/* 按「可视世界高 visH = viewH、可视世界宽 visW = viewH×aspect」，并兼容题目给定的 viewW=画布宽/zoom 口径。
 * 画布宽 = round(viewH×zoom×aspect)；取竖屏 390×844。 */
if (cam) {
  const aspect = 390 / 844;
  const wFrom = (c) => Math.round(c.viewH * c.zoom * aspect) / c.zoom;   // = viewH×aspect（口径与渲染一致）
  const OLD = { zoom: 1.5, viewH: 720 };
  const sOldW = wFrom(OLD), sNewW = wFrom(cam);
  check("六 竖屏可视世界宽：改后 " + sNewW.toFixed(0) + " > 改前 " + sOldW.toFixed(0), sNewW > sOldW);
  check("六 竖屏可视世界高：改后 " + cam.viewH + " > 改前 720", cam.viewH > OLD.viewH);
  // 直接按题目给定公式 viewW = 画布宽 / zoom（画布宽取 390 简化口径）对比
  const naiveOld = 390 / OLD.zoom, naiveNew = 390 / cam.zoom;
  check("六 按 viewW=画布宽/zoom 口径：改后 " + naiveNew.toFixed(0) + " > 改前 " + naiveOld.toFixed(0),
    naiveNew > naiveOld);
  // 视野放大百分比（应明显 >0，本次约 +25%）
  const grow = (cam.viewH / OLD.viewH - 1) * 100;
  check("六 视野放大比例约 +25%（实测 +" + grow.toFixed(1) + "%）", grow > 10 && grow < 60);
}

/* ---- 七、新增可选字段：存在且类型正确（向后兼容，旧代码不读不影响） ---- */
check("七 portraitViewH 存在且为有限正值（可选取值）",
  !!cam && typeof cam.portraitViewH === "number" && isFinite(cam.portraitViewH) && cam.portraitViewH > 0);
check("七 portraitViewH 不小于 viewH（竖屏再放大一档）", !!cam && cam.portraitViewH >= cam.viewH);
check("七 zoomMin 存在且为有限正值", !!cam && typeof cam.zoomMin === "number" && isFinite(cam.zoomMin) && cam.zoomMin > 0);
check("七 zoomMax 存在且 >= zoomMin", !!cam && typeof cam.zoomMax === "number" && cam.zoomMax >= cam.zoomMin);
check("七 既有字段未被破坏（minAspect/portraitFill/portraitBreakpoint/smooth 类型正确）",
  !!cam && typeof cam.minAspect === "number" && typeof cam.portraitFill === "boolean" &&
  typeof cam.portraitBreakpoint === "number" && typeof cam.smooth === "number");

/* ---- 八、CFG.monsterSizeMul 仍为合理正值（视野放大后怪物同步缩小的既有契约） ---- */
check("八 monsterSizeMul 为有限正值且在合理区间（1~3）",
  typeof CFG.monsterSizeMul === "number" && isFinite(CFG.monsterSizeMul) && CFG.monsterSizeMul >= 1 && CFG.monsterSizeMul <= 3);

console.log("PASS 合计 = " + passCount + "   失败数 = " + failCount);
if (failCount > 0) { throw new Error("camera_view_test 存在 " + failCount + " 项失败"); }
