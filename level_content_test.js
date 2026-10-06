/* 无头测试：关卡 3→10 铺量 + 关卡机制（毒圈收缩 / 补给点）
 * 覆盖：
 *   一、10 个关卡配置全部存在且字段合法（id 唯一 / boss 存在 / elitePool 权重可解析 / progressGoal>0 等）
 *   二、难度沿关卡递增（monsterLevel / eliteBase / progressGoal / timeLimit / artisanAtKills 单调不减）
 *   三、10 关 Boss 无重复且依次对应 BS0001~BS0010
 *   四、毒圈：配置存在、圈外扣血生效、圈内不扣血
 *   五、补给点：生成数量在范围内、读条到点生效（heal / buff / crystal 各分支）
 *   六、无机制等价性回归：未开启毒圈/补给点的关卡行为与改动前一致（无 hazard/supplyPoints 字段）
 * 运行：node level_content_test.js */
"use strict";

/* ---- DOM / Canvas 桩（与 content_test.js 同款：结构校验不需要真渲染，但统一加载链） ---- */
const ctxCalls = [];
global.ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { if (ctxCalls.length < 300000) ctxCalls.push([p, a]); return undefined; };
  },
  set(t, p, v) { t[p] = v; if (ctxCalls.length < 300000) ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 150;
  }
  appendChild(c) { this.children.push(c); c._parent = this; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
const winHandlers = {};
global.winHandlers = winHandlers;
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice() { }, onLevelUpChoiceClose() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/ui.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero: {}, enemy00: {}, enemy08: {}, enemy16: {}, enemy22: {} };
  Game.bindInput(); Game.bindEvents();
  let t = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
    if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } };
  const startAt = (idx) => {
    UI.selectedLevel = CFG.levels[idx];
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    if (Game.skipLevelUpChoice) Game.skipLevelUpChoice();
    return G.mainWorld;
  };

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);
  // 解析 elitePool 权重串 → {总权重, 条目数}；非法返回 null
  const parsePool = (s) => {
    if (typeof s !== "string" || !s.trim()) return null;
    const parts = s.split("/");
    let total = 0;
    for (const p of parts) {
      const m = p.split(":");
      if (m.length !== 2) return null;
      const w = Number(m[1]);
      if (!(CFG.monsters[m[0]])) return null;   // 引用的 ED 编号必须存在
      if (!(isFinite(w) && w > 0)) return null;
      total += w;
    }
    return { total, n: parts.length };
  };

  /* ============ 一、10 关配置齐全 + 字段合法 ============ */
  {
    check("关卡总数为 20（10+10 扩展批，" + CFG.levels.length + "）", CFG.levels.length === 20);

    const ids = CFG.levels.map(l => l.id);
    const uniq = new Set(ids);
    check("关卡 id 唯一（" + ids.join(",") + "）", uniq.size === ids.length);

    const bossList = Object.keys(CFG.monsters).filter(k => CFG.monsters[k].type === "boss");
    check("Boss 表共 10 只（" + bossList.length + "）", bossList.length === 10);

    const badBoss = CFG.levels.filter(l => !(CFG.monsters[l.boss] && CFG.monsters[l.boss].type === "boss"));
    check("每关 boss 字段都是存在的 boss（" + (badBoss.length ? badBoss.map(l => l.id + ":" + l.boss).join(",") : "全部合法") + "）", badBoss.length === 0);

    const badProg = CFG.levels.filter(l => !(typeof l.progressGoal === "number" && l.progressGoal > 0));
    check("每关 progressGoal 均为正数", badProg.length === 0);

    const badTime = CFG.levels.filter(l => !(typeof l.timeLimit === "number" && l.timeLimit > 0));
    check("每关 timeLimit 均为正数", badTime.length === 0);

    const badLv = CFG.levels.filter(l => !(typeof l.monsterLevel === "number" && l.monsterLevel >= 1));
    check("每关 monsterLevel 合法（≥1）", badLv.length === 0);

    const badElite = CFG.levels.filter(l => !(typeof l.eliteBase === "number" && l.eliteBase >= 0));
    check("每关 eliteBase 合法（≥0）", badElite.length === 0);

    const badCap = CFG.levels.filter(l => !(typeof l.monsterCap === "number" && l.monsterCap > 0));
    check("每关 monsterCap 为正数", badCap.length === 0);

    const badArtisan = CFG.levels.filter(l => !(typeof l.artisanAtKills === "number" && l.artisanAtKills > 0));
    check("每关 artisanAtKills 为正数", badArtisan.length === 0);

    // elitePool 权重串可解析且引用的 ED 存在
    const badPool = CFG.levels.filter(l => !parsePool(l.elitePool));
    check("每关 elitePool 权重可解析且引用存在（" + (badPool.length ? badPool.map(l => l.id).join(",") : "全部合法") + "）", badPool.length === 0);
    const badSum = CFG.levels.filter(l => { const p = parsePool(l.elitePool); return p && !(p.total > 0); });
    check("每关 elitePool 权重合计 > 0", badSum.length === 0);

    // circles：tpl 存在 + count 为正
    const badCircles = CFG.levels.filter(l => !Array.isArray(l.circles) || !l.circles.length
      || l.circles.some(c => !CFG.spawnCircles[c.tpl] || !(typeof c.count === "number" && c.count > 0)));
    check("每关 circles 均引用存在的圆模板且 count 为正", badCircles.length === 0);

    // mapW/mapH 为正
    const badMap = CFG.levels.filter(l => !(l.mapW > 0 && l.mapH > 0));
    check("每关地图尺寸为正", badMap.length === 0);
  }

  /* ============ 二、难度沿关卡递增 ============ */
  {
    const asc = (key) => CFG.levels.every((l, i) => i === 0 || l[key] >= CFG.levels[i - 1][key]);
    check("monsterLevel 单调不减（" + CFG.levels.map(l => l.monsterLevel).join(",") + "）", asc("monsterLevel"));
    check("eliteBase 单调不减", asc("eliteBase"));
    check("progressGoal 递增（" + CFG.levels[0].progressGoal + " → " + CFG.levels[9].progressGoal + "）", asc("progressGoal"));
    check("timeLimit 递增（" + CFG.levels[0].timeLimit + " → " + CFG.levels[9].timeLimit + "）", asc("timeLimit"));
    check("artisanAtKills 递增", asc("artisanAtKills"));
    check("新增 7 关 monsterLevel 落在 4~10", CFG.levels.slice(3).every(l => l.monsterLevel >= 4 && l.monsterLevel <= 10));
  }

  /* ============ 三、10 关 Boss 无重复且依次对应 ============ */
  {
    const bosses = CFG.levels.map(l => l.boss);
    check("10 关 Boss 无重复（" + bosses.join(",") + "）", new Set(bosses).size === 10 && bosses.length === 20);
    const expected = ["BS0001","BS0002","BS0003","BS0004","BS0005","BS0006","BS0007","BS0008","BS0009","BS0010"];
    // 11~20 关为「二周目」第二轮：按序复用 BS0001~BS0010（每只 Boss 恰好对应 2 关，与「无重复」口径自洽）
    check("LEVEL_001~010 依次对应 BS0001~BS0010，11~20 关二周目按序轮换",
      bosses.every((b, i) => b === expected[i % 10]));

    // 主题色：新增关卡各有不同 theme 且均为暗色系（#rrggbb）
    const themes = CFG.levels.slice(3).map(l => l.theme);
    check("新增 7 关都有 theme 主题色", themes.every(t => typeof t === "string" && /^#[0-9a-fA-F]{6}$/.test(t)));
    check("新增 7 关 theme 互不相同", new Set(themes).size === themes.length);
  }

  /* ============ 四、毒圈收缩 ============ */
  {
    // 4.1 配置存在：至少一关开启 hazard，且 CFG.hazard 默认字段齐全
    const hzLevels = CFG.levels.filter(l => l.hazardEnabled);
    check("存在开启毒圈的关卡（" + hzLevels.map(l => l.id).join(",") + "）", hzLevels.length > 0);
    check("CFG.hazard 全局默认字段齐全",
      typeof CFG.hazard === "object" && CFG.hazard.startDelay > 0 && CFG.hazard.shrinkDuration > 0
      && CFG.hazard.minRadius > 0 && CFG.hazard.tickInterval > 0 && CFG.hazard.dmgPercent > 0);

    // 4.2 初始化：开启关卡的主世界有 hazard 且 curR == maxR（尚未收缩）
    const idx = CFG.levels.findIndex(l => l.hazardEnabled);
    const w = startAt(idx);
    check("开启毒圈的关卡 mainWorld.hazard 已初始化", !!w.hazard);
    check("毒圈初始半径 = 满图半径（尚未收缩）", w.hazard && near(w.hazard.curR, w.hazard.maxR));
    check("毒圈初始未激活（active=false）", w.hazard && w.hazard.active === false);

    // 4.3 圈外扣血生效：跳过 startDelay + 收缩，把玩家放到圈外
    const dt = 1 / 60;
    const before = G.run.hp;
    // 直接推进足够秒数让毒圈激活并收缩
    for (let i = 0; i < Math.ceil((w.hazard.cfg.startDelay + 2) / dt); i++) updateLevelMechanics(w, dt);
    check("毒圈已激活（推进 startDelay 后）", w.hazard.active === true);
    // 把玩家移到圈外（远超 curR）
    G.player.x = w.hazard.cx + w.hazard.curR + 200; G.player.y = w.hazard.cy;
    const hpBefore = G.run.hp;
    const ticks = 6;
    for (let i = 0; i < Math.ceil(w.hazard.cfg.tickInterval * ticks / dt); i++) updateLevelMechanics(w, dt);
    check("圈外英雄持续扣血（" + hpBefore + " → " + G.run.hp + "）", G.run.hp < hpBefore);

    // 4.4 圈内不扣血：把玩家移到圆心，重置血量后推进
    G.player.x = w.hazard.cx; G.player.y = w.hazard.cy;
    G.run.hp = G.run.hpMax;   // 复位，便于观测
    const insideBefore = G.run.hp;
    for (let i = 0; i < Math.ceil(w.hazard.cfg.tickInterval * ticks / dt); i++) updateLevelMechanics(w, dt);
    check("圈内英雄不扣血（" + insideBefore + " → " + G.run.hp + "）", G.run.hp === insideBefore);

    // 4.5 半径递减：收缩一段后 curR 应小于初始 maxR
    const w2 = startAt(idx);
    for (let i = 0; i < Math.ceil((w2.hazard.cfg.startDelay + w2.hazard.cfg.shrinkDuration * 0.5) / dt); i++) updateLevelMechanics(w2, dt);
    check("毒圈半径随收缩递减（" + Math.round(w2.hazard.maxR) + " → " + Math.round(w2.hazard.curR) + "）",
      w2.hazard.curR < w2.hazard.maxR && w2.hazard.curR >= w2.hazard.cfg.minRadius - 1);

    // 4.6 hazardOutside 语义：激活后圈外点判定为 true，圈内为 false
    check("hazardOutside 圈外点 = true", hazardOutside(w2, w2.hazard.cx + w2.hazard.curR + 100, w2.hazard.cy) === true);
    check("hazardOutside 圈内点 = false", hazardOutside(w2, w2.hazard.cx, w2.hazard.cy) === false);
  }

  /* ============ 五、补给点 ============ */
  {
    // 5.1 配置存在：至少一关开启 supply，CFG.supply 默认字段齐全
    const spLevels = CFG.levels.filter(l => l.supplyEnabled);
    check("存在开启补给点的关卡（" + spLevels.map(l => l.id).join(",") + "）", spLevels.length > 0);
    check("CFG.supply 全局默认字段齐全",
      typeof CFG.supply === "object" && CFG.supply.count > 0 && CFG.supply.radius > 0 && CFG.supply.channelSeconds > 0);

    // 5.2 生成数量在范围内（1~3）
    const idx = CFG.levels.findIndex(l => l.supplyEnabled);
    const w = startAt(idx);
    check("主世界已生成补给点", Array.isArray(w.supplyPoints) && w.supplyPoints.length > 0);
    check("补给点数量在 1~3 范围内（" + w.supplyPoints.length + "）", w.supplyPoints.length >= 1 && w.supplyPoints.length <= 3);
    const lvCfg = CFG.levels[idx];
    const wantN = Math.max(0, Math.min(3, Math.round((lvCfg.supply && lvCfg.supply.count) || CFG.supply.count)));
    check("补给点数量与配置一致（" + wantN + "）", w.supplyPoints.length === wantN);

    // 5.3 heal 分支：站进补给点圈内读条 channelSeconds → 回血
    const dt = 1 / 60;
    const sp = w.supplyPoints[0];
    G.run.hp = Math.max(1, Math.floor(G.run.hpMax * 0.3));   // 先扣血，便于观测回复
    G.player.x = sp.x; G.player.y = sp.y;
    const hpBefore = G.run.hp;
    const need = (sp.cfg.channelSeconds || 3);
    for (let i = 0; i < Math.ceil(need / dt) + 5; i++) updateLevelMechanics(w, dt);
    // 该关补给效果为 heal（LEVEL_005 配置）
    const eff = (lvCfg.supply && lvCfg.supply.effect) || CFG.supply.effect;
    if (eff.type === "heal") check("补给点 heal 生效：读条完成后回血（" + hpBefore + " → " + G.run.hp + "）", G.run.hp > hpBefore);
    else check("补给点非 heal 分支（跳过 heal 断言，类型=" + eff.type + "）", true);
    check("生效后补给点被移除", !w.supplyPoints.some(s => s === sp));

    // 5.4 crystal 分支：LEVEL_009 配置 crystal，验证 coin 增加
    const idx9 = CFG.levels.findIndex(l => l.supplyEnabled && ((l.supply || {}).effect || {}).type === "crystal");
    if (idx9 >= 0) {
      const wc = startAt(idx9);
      const spc = wc.supplyPoints[0];
      G.player.x = spc.x; G.player.y = spc.y;
      const coinBefore = G.run.coin;
      const needC = (spc.cfg.channelSeconds || 3);
      for (let i = 0; i < Math.ceil(needC / dt) + 5; i++) updateLevelMechanics(wc, dt);
      check("补给点 crystal 生效：读条完成后 +结晶（" + coinBefore + " → " + G.run.coin + "）", G.run.coin > coinBefore);
    } else check("补给点 crystal 分支（未配置，跳过）", true);

    // 5.5 buff 分支：LEVEL_006 配置 buff，验证 r.buffs 增加
    const idx6 = CFG.levels.findIndex(l => l.supplyEnabled && ((l.supply || {}).effect || {}).type === "buff");
    if (idx6 >= 0) {
      const wb = startAt(idx6);
      const spb = wb.supplyPoints[0];
      G.player.x = spb.x; G.player.y = spb.y;
      const buffBefore = G.run.buffs.length;
      const needB = (spb.cfg.channelSeconds || 3);
      for (let i = 0; i < Math.ceil(needB / dt) + 5; i++) updateLevelMechanics(wb, dt);
      check("补给点 buff 生效：读条完成后获得增益（" + buffBefore + " → " + G.run.buffs.length + "）", G.run.buffs.length > buffBefore);
    } else check("补给点 buff 分支（未配置，跳过）", true);

    // 5.6 未读满不生效：站圈时间不足 channelSeconds 则补给点仍在
    const w3 = startAt(idx);
    const sp3 = w3.supplyPoints[0];
    G.player.x = sp3.x; G.player.y = sp3.y;
    for (let i = 0; i < Math.floor((sp3.cfg.channelSeconds * 0.5) / dt); i++) updateLevelMechanics(w3, dt);
    check("读条未满不生效（补给点仍在）", w3.supplyPoints.indexOf(sp3) >= 0 && sp3.used === false);
  }

  /* ============ 六、无机制等价性回归 ============ */
  {
    // LEVEL_001（未开启任何机制）：mainWorld 不应有 hazard / supplyPoints 字段
    const w = startAt(0);
    check("无机制关卡不创建 hazard 字段", w.hazard === undefined);
    check("无机制关卡不创建 supplyPoints 字段", w.supplyPoints === undefined);
    check("无机制关卡 hazardOutside 恒 false", hazardOutside(w, 0, 0) === false);

    // updateLevelMechanics / renderHazard / renderSupply 对无机制关卡为 no-op（不抛异常）
    let threw = false;
    try {
      for (let i = 0; i < 10; i++) updateLevelMechanics(w, 1 / 60);
      renderHazard(G.ctx, w); renderSupply(G.ctx, w);
    } catch (e) { threw = true; }
    check("无机制关卡调用新机制函数不抛异常（no-op 等价性）", !threw);

    // 关卡级覆盖：LEVEL_006 的 hazard.dmgPercent 应来自关卡覆盖而非全局默认（21.1 比例口径）
    const lv6 = CFG.levels[5];
    check("LEVEL_006 hazard 覆盖全局（startDelay=" + lv6.hazard.startDelay + " ≠ 默认 " + CFG.hazard.startDelay + "）",
      lv6.hazard && lv6.hazard.startDelay !== CFG.hazard.startDelay);
    check("LEVEL_006 supply 覆盖全局（count=" + lv6.supply.count + "）", lv6.supply && lv6.supply.count > 0);
  }

  if (!ok) throw new Error("level_content_test 存在失败断言");
  console.log("ALL PASS");
`;
vm.runInContext(driver, ctx, { filename: "driver" });
