/* 撤离点雕像（5.2）专项测试：真实加载 config/core/game/ui/main（DOM 桩 + EventBus + 帧推进）
 * 覆盖：Boss 死亡在死亡位置生成雕像 / 远离雕像按 E 不触发 / 雕像附近按 E 开始读条 /
 *       移动打断归零且可重新按 E / 受击打断归零 / 仅 Boss 生成（无场景掉落信标）/
 *       上限 1（重复 Boss 结算不重复生成）/ 雕像渲染确实绘制。 */
"use strict";

/* ---- DOM 桩（带真实 classList 行为，同 rift_test） ---- */
class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); } else if (f) this.set.add(c); else this.set.delete(c); }
  contains(c) { return this.set.has(c); }
}
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = new ClassList();
    this.children = []; this._parent = null;
    this.innerHTML = ""; this.textContent = ""; this.disabled = false;
    this.width = 300; this.height = 300;
  }
  appendChild(c) { this.children.push(c); c._parent = this; return c; }
  remove() { if (this._parent) { const i = this._parent.children.indexOf(this); if (i >= 0) this._parent.children.splice(i, 1); } }
  get firstChild() { return this.children[0]; }
  addEventListener() { }
  getContext() { return ctxProxy; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
}
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

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/items.js", "js/combat.js", "js/modes.js", "js/render.js", "js/ui.js", "js/ui-screens.js", "js/ui-panels.js", "js/quality.js", "js/rewards.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

vm.runInContext(`
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites.hero = { width: 60, height: 60 };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
  if (typeof Game.skipLevelUpChoice === "function") Game.skipLevelUpChoice();   // 跳过升级 4 选 1 暂停闸门（19.10.6）：本文件聚焦撤离读条，不测升级弹窗
  G.run.hp = 100000;                       // 测试无敌注入，聚焦撤离流程
  /* 方向4（撤离压力）批注：①~⑧ 为旧口径段落——CFG.extract.enabled=false 完整回退新机制
   * （无机制等价性基线），行为与改动前逐位一致；⑨ 起为压力机制新段落（enabled=true）。 */
  CFG.extract.enabled = false;

  function keyDown(k) { winHandlers.keydown.forEach(fn => fn({ key: k, preventDefault() { } })); }
  function keyUp(k) { winHandlers.keyup.forEach(fn => fn({ key: k })); }
  let t = 0;
  Game.loop(t);                            // 手动注册主循环（跳过 boot）
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } }

  /* ---------- 0. 配置自检 ---------- */
  console.assert(CFG.extract.channel === 8.0, "撤离读条 8 秒");
  console.assert(CFG.extract.radius > 0, "撤离雕像交互半径应 > 0");
  console.assert(G.run.exitStatue === null, "开局不应有撤离点雕像");
  console.assert(!("extractToken" in G.run), "局内不应再存在撤离代币字段");

  /* ---------- 1. Boss 死亡在死亡位置生成雕像 ---------- */
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
  console.assert(G.mainWorld.boss, "进度满应触发 Boss");
  G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;   // 固定死亡位置便于断言
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  step(5);
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 800 && G.run.exitStatue.y === 600,
    "Boss 死亡应在死亡位置生成撤离点雕像, got " + JSON.stringify(G.run.exitStatue));
  console.log("① Boss 死亡生成雕像 OK: (" + G.run.exitStatue.x + "," + G.run.exitStatue.y + ")");

  /* ---------- 2. 判定圈外：任何成员都不在圈内 → 不读条 ---------- */
  G.mainWorld.monsters.forEach(m => m.dead = true);      // 清场，避免战斗干扰
  G.mainWorld.enemyBullets = [];
  G.mainWorld.altars = [];                               // 清掉随机祭坛（如空间裂缝），避免误触发
  step(3);
  G.player.x = 200; G.player.y = 200;                    // 距雕像 (800,600) 远超判定圈
  keyDown("e"); keyUp("e");                              // E 只做提示，不再是读条开关
  step(5);
  console.assert(!G.run.extractChanneling, "圈外不应开始读条（判定圈规则：站进圈内才读）");
  console.assert(G.run.extractProgress === 0, "圈外进度应保持 0");
  console.log("② 圈外不触发 OK");

  /* ---------- 3. 站进雕像圈内 → **自动**读条（无需按键）+ 进度推进 ---------- */
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;
  step(30);                                              // ~0.5 秒
  console.assert(G.run.extractChanneling === true, "站进雕像圈内应自动开始读条（任一英雄可触发）");
  console.assert(G.run.extractHolder === G.player, "读条持有者应记为圈内英雄（判定原子占用）");
  console.assert(G.run.extractProgress > 0.3, "读条进度应推进, got " + G.run.extractProgress);
  // 雕像渲染验证：绿色系雕像与"撤离点"文字确实被绘制
  ctxCalls.length = 0; step(2);
  const statueTxt = ctxCalls.find(c => c[0] === "fillText" && String(c[1][0]).indexOf("撤离点") >= 0);
  console.assert(statueTxt, "主地图应绘制撤离点雕像文字提示");
  console.assert(String(statueTxt[1][0]).indexOf("圈内") >= 0, "雕像文字应说明「圈内自动读条」新口径");
  const markerIdx = ctxCalls.findIndex(c => c[0] === "fillText" && String(c[1][0]) === "▲");
  console.assert(markerIdx >= 0, "主地图应绘制雕像标记 ▲");
  console.log("③ 圈内自动读条 OK: progress = " + G.run.extractProgress.toFixed(2) + "s（雕像已绘制）");

  /* ---------- 4. 离开判定圈 → 进度缓慢衰退（移动本身不再打断）；回圈继续读 ---------- */
  const pHold = G.run.extractProgress;
  G.player.x = G.run.exitStatue.x + 400; G.player.y = G.run.exitStatue.y + 400;   // 走出判定圈
  step(10);                                              // ~0.17 秒
  console.assert(!G.run.extractChanneling, "离开判定圈后不再读条");
  console.assert(G.run.extractProgress < pHold, "离开圈后进度应衰退（" + pHold.toFixed(2) + " → " + G.run.extractProgress.toFixed(2) + "）");
  console.assert(G.run.extractProgress > 0, "衰退不是瞬间清零（判定圈通用规则，1.2 倍速）");
  step(60);                                              // 继续衰退 → 归零
  console.assert(G.run.extractProgress === 0, "持续离开圈 → 进度衰退归零");
  console.assert(G.run.exitStatue && G.run.exitStatue.x === 800 && G.run.exitStatue.y === 600, "衰退期间雕像仍在原地");
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;              // 回圈
  step(10);
  console.assert(G.run.extractChanneling === true, "回到圈内可继续读条（雕像保留）");
  console.log("④ 离开圈衰退 + 回圈续读 OK: progress = " + G.run.extractProgress.toFixed(2) + "s");

  /* ---------- 5. 受击打断归零 ---------- */
  heroTakeDamage(G.mainWorld, G.player, 1);
  console.assert(!G.run.extractChanneling, "受击应打断撤离读条");
  console.assert(G.run.extractProgress === 0, "受击打断后进度应归零");
  console.log("⑤ 受击打断归零 OK");

  /* ---------- 6. 仅 Boss 生成：场景掉落撤离信标已删除 ---------- */
  console.assert(!CFG.altars.EXTRACT_BEACON, "不应再存在场景掉落撤离信标配置（撤离点只由 Boss 生成）");
  console.log("⑥ 仅 Boss 生成撤离点（无场景掉落信标）OK");

  /* ---------- 7. 上限 1：重复 Boss 结算不重复生成 ---------- */
  const statueBefore = { x: G.run.exitStatue.x, y: G.run.exitStatue.y };
  G.mainWorld.boss = { x: 1500, y: 1500, dead: true };
  onBossDefeated(G.mainWorld);
  console.assert(G.run.exitStatue.x === statueBefore.x && G.run.exitStatue.y === statueBefore.y,
    "已有雕像时重复 Boss 结算不应重新生成（上限 1，位置不变），got " + JSON.stringify(G.run.exitStatue));
  console.log("⑦ 上限 1：重复 Boss 结算不重复生成 OK");

  /* ---------- 8. 判定圈规则：任一英雄可触发 + 同一判定不可同时触发 ----------
   * ①所有英雄都是独立个体 → 任一成员在圈内都能推进（不限队长）；
   * ②同一判定是单一实例（单一进度 + 单一持有者）→ 多人同圈不加速、也不会各触发一次。
   * 这里直接对生产函数 updateExtractJudge / heroInCircle 断言，避免队友 AI 走位干扰。 */
  Game.startRun([CFG.heroes[0], CFG.heroes[1]]);
  Game.skipIntroFreeze();   // 跳过主关卡开场冻结（3s），保持测试时间假设
  G.run.hp = 100000;
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
  G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.enemyBullets = []; G.mainWorld.altars = [];
  step(3);
  const st2 = G.run.exitStatue, mate = G.run.companions[0];
  const R = CFG.extract.radius * CFG.altarJudgeMul;
  console.assert(!!st2 && !!mate, "多英雄局：应生成撤离点雕像且有 AI 队友");
  G.player.x = st2.x + R + 300; G.player.y = st2.y;      // 队长远离
  mate.x = st2.x; mate.y = st2.y;                        // 只有队友在圈内
  console.assert(heroInCircle(st2.x, st2.y, CFG.extract.radius) === mate, "heroInCircle 应命中圈内的队友");
  G.run.extractProgress = 0; G.run.extractHolder = null;
  updateExtractJudge(0.5);
  console.assert(G.run.extractHolder === mate && Math.abs(G.run.extractProgress - 0.5) < 1e-9,
    "任一英雄（队友）在圈内即推进撤离判定，got holder=" + (G.run.extractHolder === mate) + " p=" + G.run.extractProgress);
  G.player.x = st2.x; G.player.y = st2.y;                // 队长也进同一判定圈
  updateExtractJudge(0.5);
  console.assert(Math.abs(G.run.extractProgress - 1.0) < 1e-9,
    "两名英雄同处一个判定圈不加速（+0.5s 而非 +1.0s），got " + G.run.extractProgress);
  // 读条完成 → 判定被消费：进度归零、持有者清空（不可能被第二个英雄重复触发）
  G.run.extractProgress = CFG.extract.channel - 0.5; G.run.extractHolder = null;
  updateExtractJudge(1.0);
  console.assert(G.run.extractProgress === 0 && G.run.extractHolder === null,
    "撤离判定读满即被消费（进度归零 + 持有者清空）");
  console.log("⑧ 判定圈规则（任一英雄可触发 / 同圈不加速 / 单次消费）OK");

  /* ==================== 方向 4：撤离压力设计（波次围攻 + 负重权衡） ==================== */
  // 复用⑧的双英雄局？不——新开单英雄局，聚焦压力机制本身。
  CFG.extract.enabled = true;              // 打开总开关（默认值，回退开关即本行置 false）
  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  if (typeof Game.skipLevelUpChoice === "function") Game.skipLevelUpChoice();
  G.run.hp = 100000;
  G.run.kills = CFG.levels[0].progressGoal;
  onMonsterKilled(G.mainWorld, { x: 500, y: 500, d: CFG.monsters.NM0010, dead: true });
  G.mainWorld.boss.x = 800; G.mainWorld.boss.y = 600;
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.enemyBullets = []; G.mainWorld.altars = [];
  step(3);
  const st3 = G.run.exitStatue;
  console.assert(!!st3, "压力段：雕像应生成");

  /* ---------- ⑨ 读条开始 → 触发刷怪；打断 → 停止刷怪 ---------- */
  G.player.x = 200; G.player.y = 200;      // 先远离雕像
  step(2);
  console.assert(G.mainWorld.monsters.length === 0, "⑨ 未读条不应刷波次怪, got " + G.mainWorld.monsters.length);
  G.player.x = st3.x; G.player.y = st3.y;  // 站进圈内 → 自动读条 → 第 1 波立即来袭
  step(5);
  const nWave1 = G.mainWorld.monsters.length;
  console.assert(nWave1 === CFG.extract.waveSizeBase,
    "⑨ 读条开始应立即刷第 1 波（数量 = waveSizeBase）, got " + nWave1);
  console.assert(G.mainWorld.monsters.every(m => m._extWave), "⑨ 波次怪应带 _extWave 标记");
  // 站桩观察：波次怪围攻雕像护盾，读条期间**不受伤害**（进度持续推进）
  const p0 = G.run.extractProgress;
  step(30);                                // ~0.5s：读条继续推进 → 波次怪没有打断读条
  console.assert(G.run.extractChanneling === true, "⑨ 围攻期间读条应持续推进（波次怪不伤害英雄）");
  console.assert(G.run.extractProgress > p0, "⑨ 读条进度应继续增长");
  console.assert(typeof st3.shield === "number" && st3.shield >= 0 && st3.shield <= CFG.extract.shieldMax,
    "⑨ 护盾应就位（首次会话初始化）, got " + st3.shield);
  console.assert(st3.shield < CFG.extract.shieldMax || G.mainWorld.monsters.every(m => U.dist(m.x, m.y, st3.x, st3.y) > CFG.extract.siegeRingRadius),
    "⑨ 围攻怪到环应啃护盾（0.5s 内可能尚未到环，此断言宽松）");
  // 打断读条（走出圈）→ 会话销毁 → 停止刷怪
  G.mainWorld.monsters.forEach(m => m.dead = true);   // 清场便于观察“数量不再增长”
  G.player.x = st3.x + 400; G.player.y = st3.y + 400;
  step(3);
  console.assert(!G.run.extractChanneling, "⑨ 离圈应停止读条");
  step(180);                               // ~3s（> waveInterval）：若还在刷怪，数量必然增长
  console.assert(G.mainWorld.monsters.length === 0, "⑨ 读条中断后应停止刷怪（3s 内无新增）, got " + G.mainWorld.monsters.length);
  console.log("⑨ 波次触发/停止 OK");

  /* ---------- ⑩ 波次强度递增（第 N 波数量 > 第 1 波） ---------- */
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  const c1 = spawnExtractWave(G.mainWorld, st3, 1);
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  const c4 = spawnExtractWave(G.mainWorld, st3, 4);
  console.assert(c1 === CFG.extract.waveSizeBase, "⑩ 第 1 波数量 = waveSizeBase, got " + c1);
  console.assert(c4 > c1, "⑩ 波次强度应递增（第 4 波 " + c4 + " > 第 1 波 " + c1 + "）");
  console.assert(c4 === Math.round(CFG.extract.waveSizeBase + CFG.extract.waveSizeGrowth * 3),
    "⑩ 递增公式 = base + growth×(n-1), got " + c4);
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  console.log("⑩ 波次递增 OK: wave1=" + c1 + " wave4=" + c4);

  /* ---------- ⑪ 不超 monsterCap ---------- */
  const capBak = G.levelCfg.monsterCap;
  G.levelCfg.monsterCap = 4;
  spawnExtractWave(G.mainWorld, st3, 9);   // 第 9 波理论 10 只 > cap 4
  console.assert(G.mainWorld.monsters.length <= monsterCap(),
    "⑪ 刷怪应受 monsterCap 约束, got " + G.mainWorld.monsters.length + " / cap " + monsterCap());
  G.levelCfg.monsterCap = capBak;
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  console.log("⑪ monsterCap 约束 OK");

  /* ---------- ⑫ 负重惩罚：读条时长纯函数 + 集成推进 ---------- */
  CFG.extract.enabled = false;
  console.assert(extractChannelSeconds() === CFG.extract.channel, "⑫ 总开关关闭 → 读条时长 = 基准（等价性）");
  CFG.extract.enabled = true;
  console.assert(extractChannelSeconds() === CFG.extract.channel, "⑫ 0 负重 → 读条时长 = 基准");
  console.assert(extractChannelSeconds(G.run) === CFG.extract.channel, "⑫ runLike 入参兼容");
  const trwBak = totalRunWeight;
  totalRunWeight = function () { return 340; };          // 超门槛 240 → 1 + 0.25×2.4 = 1.6 倍
  const t340 = extractChannelSeconds();
  console.assert(Math.abs(t340 - CFG.extract.channel * 1.6) < 1e-9, "⑫ 340 负重 → 1.6 倍读条, got " + t340);
  totalRunWeight = function () { return 100000; };        // 极高负重 → 封顶 weightTimeScaleMax
  const tMax = extractChannelSeconds();
  console.assert(Math.abs(tMax - CFG.extract.channel * CFG.extract.weightTimeScaleMax) < 1e-9,
    "⑫ 极高负重应封顶 2 倍, got " + tMax);
  totalRunWeight = trwBak;
  // 集成：高负重 → 同样步数下进度推进更慢
  G.player.x = st3.x; G.player.y = st3.y;
  G.mainWorld.monsters.forEach(m => m.dead = true);
  step(2); G.run.extractProgress = 0; G.run.extractHolder = null;
  step(60);                                               // ~1s 基准推进
  const baseAdv = G.run.extractProgress;
  G.run.extractProgress = 0; G.run._extWave = null;
  totalRunWeight = function () { return 340; };
  CFG.extract.enabled = false; step(1); CFG.extract.enabled = true;   // 重置会话（mul 变更后重建）
  G.run.extractProgress = 0; G.run.extractHolder = null;
  step(60);
  const heavyAdv = G.run.extractProgress;
  totalRunWeight = trwBak;
  console.assert(heavyAdv < baseAdv - 0.2, "⑫ 高负重读条推进应更慢（" + heavyAdv.toFixed(2) + " < " + baseAdv.toFixed(2) + "）");
  console.assert(Math.abs(baseAdv - 1.0) < 0.1, "⑫ 基准推进 ≈ 1.0s（步长累计 1.002s）, got " + baseAdv.toFixed(3));
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  console.log("⑫ 负重惩罚 OK: base=" + baseAdv.toFixed(3) + " heavy=" + heavyAdv.toFixed(3));

  /* ---------- ⑬ 无机制等价性（enabled=false：与旧版逐位一致） ---------- */
  CFG.extract.enabled = false;
  G.player.x = 200; G.player.y = 200; step(2);
  const monBefore = G.mainWorld.monsters.length;
  G.player.x = st3.x; G.player.y = st3.y;
  G.run.extractProgress = 0; G.run.extractHolder = null;
  step(60);                                              // 站圈内 1s
  console.assert(G.run.extractChanneling === true, "⑬ 关闭机制：读条仍正常推进");
  console.assert(Math.abs(G.run.extractProgress - 1.002) < 0.05,
    "⑬ 关闭机制：读条时长 = 旧版基准（无负重/破碎缩放）, got " + G.run.extractProgress.toFixed(3));
  console.assert(G.mainWorld.monsters.length === monBefore, "⑬ 关闭机制：不刷任何波次怪");
  console.assert(extractChannelSeconds() === CFG.extract.channel, "⑬ 关闭机制：读条时长函数 = 基准");
  CFG.extract.enabled = true;
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  console.log("⑬ 无机制等价性 OK");

  /* ---------- ⑭ 冻结期间波次不推进（§4.6/§5.34 护栏） ---------- */
  const aliveMon = () => G.mainWorld.monsters.filter(m => !m.dead).length;   // 冻结期尸体不过滤，只数活怪
  G.player.x = 200; G.player.y = 200; step(2);
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.freezeTimer = 999;                          // 人为冻结
  G.player.x = st3.x; G.player.y = st3.y;                 // 冻结中站进圈
  step(30);
  console.assert(!G.run.extractChanneling, "⑭ 冻结期间主循环不推进撤离读条");
  console.assert(aliveMon() === 0, "⑭ 冻结期间不刷波次怪, got " + aliveMon());
  updateExtractJudge(0.5);                                // 直接调用绕过主循环闸门 → 内部护栏兜底
  console.assert(aliveMon() === 0, "⑭ 冻结时直接调用 updateExtractJudge 也不刷波（内部护栏）");
  G.mainWorld.freezeTimer = 0; step(5);
  console.assert(aliveMon() > 0, "⑭ 解冻后读条恢复 → 波次照常");
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.player.x = st3.x + 400; G.player.y = st3.y + 400; step(3);
  console.log("⑭ 冻结护栏 OK");

  /* ---------- ⑮ 护盾围攻/破碎/再生（压力载体） ---------- */
  G.player.x = st3.x; G.player.y = st3.y; step(2);        // 站圈内 → 波次会话 + 护盾就位
  st3.shield = CFG.extract.shieldMax;
  spawnExtractWave(G.mainWorld, st3, 3);
  const siegers = G.mainWorld.monsters.filter(m => m._extWave && !m.dead);
  console.assert(siegers.length > 0, "⑮ 应有存活波次怪");
  siegers.forEach(m => { m.x = st3.x + CFG.extract.siegeRingRadius; m.y = st3.y; });   // 摆到围攻环上
  const shield0 = st3.shield;
  step(30);                                               // ~0.5s 围攻啃盾
  console.assert(st3.shield < shield0, "⑮ 围攻怪应啃护盾（" + shield0.toFixed(0) + " → " + st3.shield.toFixed(0) + "）");
  console.assert(G.run.extractChanneling === true, "⑮ 啃盾期间读条不受影响");
  // 破碎 → 停刷波次 + 读条冻结（进度保留、不清零，由 extractWeightDt 的 dt=0 承担）
  st3.shield = 0;
  step(1);                                                // 下一帧护盾 tick 登记破碎
  console.assert(st3.shieldBroken === true, "⑮ 护盾归零应破碎");
  G.run.extractProgress = 5;
  step(30);
  console.assert(Math.abs(G.run.extractProgress - 5) < 1e-9,
    "⑮ 破碎期间读条冻结（进度保留）, got " + G.run.extractProgress.toFixed(3));
  const nAtBreak = aliveMon();
  step(180);                                              // 3s：破碎期间不刷新波
  console.assert(aliveMon() <= nAtBreak, "⑮ 破碎期间停止刷波");
  // 再生：清光围攻怪 → 延迟后再生 → 恢复至 50% 解锁
  G.player.x = st3.x + 400; G.player.y = st3.y + 400;    // 离圈（围攻怪转普通 AI 离环，且不刷新波）
  G.mainWorld.monsters.forEach(m => m.dead = true);
  step(2);
  st3._shieldHold = 0;                                    // 跳过再生延迟
  st3.shield = 900;                                       // 低于恢复线（50% × 2000 = 1000）
  step(180);                                              // ~3s 再生：120/s × 3s = +360 → 1260 ≥ 1000
  console.assert(st3.shield > 900, "⑮ 清怪后护盾应再生, got " + st3.shield.toFixed(0));
  console.assert(st3.shieldBroken === false, "⑮ 恢复到 50% 后应解除破碎（可继续读条）");
  G.mainWorld.monsters.forEach(m => m.dead = true); step(2);
  console.log("⑮ 护盾围攻/破碎/再生 OK");

  console.log("EXTRACT TEST OK");
`, ctx, { filename: "inline" });
