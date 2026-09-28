/* 无头运行时测试：驱动真实游戏主循环（node runtime_test.js） */
"use strict";

/* ---- DOM / Canvas 桩 ---- */
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
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
global.window = { addEventListener() { } };
let rafCb = null;
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

/* UI 桩（ui.js 不加载） */
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { } };

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}
vm.runInContext(`
  // ---- 启动（跳过素材加载，直接注入桩精灵） ----
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  G.run.hp = 100000;   // 测试注入高血量（AI 直行撞怪群，聚焦验证流程）
  console.log("进入关卡:", G.levelCfg.name, "状态:", G.state);

  // ---- 阶段1：向右移动 10 秒 + 自动攻击 ----
  let t = 0;
  Game.loop(t);          // 手动注册主循环（跳过 boot）
  G.keys["d"] = true;
  // 统计曾生成的掉落物（测试角色直行会顺手捡走一部分，不能只看场上剩余）
  let spawnedCoins = 0, spawnedExps = 0;
  const origSpawnPickup = spawnPickup;
  spawnPickup = function (w, x, y, type, value) {
    if (type === "coin") spawnedCoins++; else if (type === "exp") spawnedExps++;
    return origSpawnPickup(w, x, y, type, value);
  };
  function frames(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t); } }
  frames(600);   // ~10s
  console.log("10s后: 怪物", G.mainWorld.monsters.length, "击杀", G.run.kills, "LV", G.run.lv, "货币", G.run.coin, "玩家HP", Math.round(G.run.hp));
  if (G.run.kills < 1) throw new Error("10秒内应有击杀");
  if (spawnedCoins < 1 || spawnedExps < 1) throw new Error("击杀应掉落金币与经验宝石");
  if (G.mainWorld.pickups.some(pk => pk.type !== "coin" && pk.type !== "exp")) throw new Error("不应有其他掉落类型");
  if (G.mainWorld.groundChests.length > 0) throw new Error("怪物不应掉落宝箱");
  // 拾取验证：手动生成一枚并让玩家走过
  spawnPickup(G.mainWorld, G.player.x + 40, G.player.y, "coin", 5);
  const pk0 = G.mainWorld.pickups[G.mainWorld.pickups.length - 1];
  G.player.x = pk0.x; G.player.y = pk0.y;
  frames(3);
  if (G.mainWorld.pickups.includes(pk0)) throw new Error("走过掉落物应自动拾取");
  console.log("掉落规则 OK: 金币x" + spawnedCoins + "+经验宝石x" + spawnedExps + " 掉落/拾取, 怪物不掉宝箱");
  G.keys["d"] = false;

  // ---- 阶段2：能量技能 ----
  G.run.energy = 100; G.keys[" "] = true;
  frames(120);
  G.keys[" "] = false;

  // ---- 阶段2.5：祭坛进度条规则（圈内积累/移动受击不中断/离开缓慢衰退120%） ----
  const altar = G.mainWorld.altars.find(a => a.id === "ALTAR_001") || G.mainWorld.altars[0];
  G.player.x = altar.x; G.player.y = altar.y;
  G.keys["a"] = true; G.keys["d"] = true;   // 模拟按键抖动，不应影响积累
  frames(60);
  G.keys["a"] = false; G.keys["d"] = false;
  const progAfterIn = altar.progress || 0;
  if (progAfterIn < 0.5) throw new Error("圈内进度未积累: " + progAfterIn);
  // 离开圈内：选一个离所有雕像都足够远的安全点（避免随机摆放的雕像恰好在旁边继续积累）
  let sx = 100, sy = 100;
  outer: for (let gx = 100; gx < G.mainWorld.w; gx += 200) {
    for (let gy = 100; gy < G.mainWorld.h; gy += 200) {
      if (G.mainWorld.altars.every(a => Math.hypot(gx - a.x, gy - a.y) > a.cfg.radius * CFG.altarJudgeMul + 120)) { sx = gx; sy = gy; break outer; }
    }
  }
  G.player.x = sx; G.player.y = sy;      // 离开圈内
  frames(120);                              // 2 秒 → 衰退 2.4 秒进度
  if (altar.progress === undefined || altar.progress >= progAfterIn) throw new Error("离开后进度未衰退: " + altar.progress);
  console.log("祭坛进度条规则 OK: 圈内积累", progAfterIn.toFixed(2) + "s → 离开衰退至", altar.progress.toFixed(2) + "s");

  // ---- 阶段3：直接推进到 Boss（保持高血量，聚焦验证流程） ----
  G.run.kills = CFG.levels[0].progressGoal - 1;
  // 找只怪杀掉触发 Boss（场上无活怪时主动生成一只，避免随机性导致失败）
  let m0 = G.mainWorld.monsters.find(m => !m.dead);
  if (!m0) { m0 = new Monster("NM0010", G.player.x + 400, G.player.y, G.levelCfg.monsterLevel || 1); G.mainWorld.monsters.push(m0); }
  while (!m0.dead) damageMonster(G.mainWorld, m0, 99999);
  frames(5);
  if (!G.run.bossSpawned) throw new Error("Boss 未触发");
  console.log("Boss 已出现, HP:", Math.round(G.mainWorld.boss.hp));
  frames(400);   // Boss 战 6~7 秒（爆炸预警/小怪）
  if (G.mainWorld.boss.dead) throw new Error("Boss 不应被玩家误杀");

  // ---- 阶段4：击杀 Boss → 死亡位置生成撤离点雕像 → 雕像处读条 8 秒撤离 ----
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 999999);
  frames(5);
  if (!G.run.bossDefeated) throw new Error("Boss 击败未结算");
  if (!G.run.exitStatue) throw new Error("撤离点雕像未生成");
  console.log("撤离点雕像 OK: 生成于 Boss 死亡位置 (" + Math.round(G.run.exitStatue.x) + "," + Math.round(G.run.exitStatue.y) + ")");
  // 清场（模拟玩家清完残余怪再撤离），移除其他雕像避免干扰（如工匠雕像恰好在附近触发传送）
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.altars = [];
  frames(3);
  // 判定圈（5.2 新口径）：**任一英雄站进雕像圈内即自动读条**（无需按 E）；
  // 走出判定圈 → 进度按判定通用规则衰退归零；受击归零（后续步骤验证）
  G.player.x = G.run.exitStatue.x + 400; G.player.y = G.run.exitStatue.y + 400;   // 先站到判定圈外
  G.player.mvx = 0; G.player.mvy = 0;
  G.run.extractProgress = 0; G.run.extractChanneling = false;
  frames(5);
  if (G.run.extractChanneling || G.run.extractProgress !== 0) throw new Error("判定圈外不应读条");
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;                // 站进圈内
  frames(30);                                                                      // ~0.5s
  if (!G.run.extractChanneling || G.run.extractProgress <= 0.3)
    throw new Error("圈内应自动读条, channeling=" + G.run.extractChanneling + " progress=" + (G.run.extractProgress || 0));
  G.player.x = G.run.exitStatue.x + 400; G.player.y = G.run.exitStatue.y + 400;    // 走出判定圈
  frames(60);                                                                      // 衰退 → 归零
  if (G.run.extractProgress !== 0) throw new Error("离开判定圈后进度应衰退归零, got " + G.run.extractProgress);
  if (!G.run.exitStatue) throw new Error("离开判定圈后撤离点雕像应仍在原地");
  // 静止在雕像圈内读满 8 秒（清空残留敌方弹道，避免命中打断；玩家移到雕像处）
  G.player.mvx = 0; G.player.mvy = 0;
  G.mainWorld.enemyBullets = [];
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;
  frames(560);   // ~9.3s > 8s 读条
  if (G.state !== "settled") throw new Error("撤离未成功, state=" + G.state + " progress=" + (G.run.extractProgress || 0));
  console.log("撤离成功（圈内自动读条 + 离开圈衰退验证）→ 结算, 状态:", G.state);

  // ---- 阶段5：新的一局 → 死亡惩罚 ----
  Game.backToMenu();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  frames(30);
  // 塞点战利品
  const it = makeChestItem("epic"); const sp = G.run.backpack.findSpot(it);
  G.run.backpack.place(it, sp.x, sp.y);
  G.run.hp = 10;            // 设低血量验证死亡
  G.player.takeDamage(G.mainWorld, 9999);
  frames(5);
  if (G.state !== "dead") throw new Error("死亡未触发, state=" + G.state);
  console.log("死亡惩罚触发, 状态:", G.state);

  // ---- 阶段6：工匠世界进/出 ----
  Game.backToMenu(); UI.selectedLevel = CFG.levels[0]; Game.startRun(CFG.heroes[0]);
  frames(10);
  EventBus.emit("enterArtisan");
  frames(10);
  if (!G.inArtisan) throw new Error("未进入工匠世界");
  if (G.activeWorld.monsters.length !== 0) throw new Error("工匠世界不应有怪");
  // 出生点规则：出口上方不远处，但在出口判定圈之外（不自动累计返回读条）
  const eb = G.activeWorld.exitBeacon, exitR = 100 * CFG.altarJudgeMul;
  const dExit = Math.hypot(G.player.x - eb.x, G.player.y - eb.y);
  if (dExit <= exitR) throw new Error("出生点落在出口判定圈内: " + dExit);
  if (dExit > exitR + 120) throw new Error("出生点离出口过远: " + dExit);
  console.log("工匠世界出生点 OK: 距出口中心", Math.round(dExit), "px（判定圈", exitR, "px）");
  // 站到出口读条返回
  G.player.x = G.activeWorld.exitBeacon.x; G.player.y = G.activeWorld.exitBeacon.y;
  frames(220);  // ~3.7s > 3s
  if (G.inArtisan) throw new Error("未返回主地图");
  console.log("工匠世界进出 OK, 回到主地图, 怪物仍在(状态保留):", G.mainWorld.monsters.length > 0);

  // ---- 阶段7：批次 B · 第 2 关完整流程（新地图/新圆模板/新怪/Boss2） ----
  Game.backToMenu();
  Meta.data.unlockedLevels = 3;                       // 测试解锁
  UI.selectedLevel = CFG.levels[1];
  Game.startRun(CFG.heroes[1]);                       // 散弹手 W002
  G.run.hp = 100000;                                  // 测试无敌注入，聚焦流程验证
  frames(10);
  if (G.mainWorld.w !== 1920 || G.mainWorld.h !== 1920) throw new Error("地图应为固定 1920×1920: " + G.mainWorld.w + "x" + G.mainWorld.h);
  if (G.mainWorld.w !== G.mainWorld.h) throw new Error("地图应为正方形");
  if (G.run.weapon.basic.bullets !== 3) throw new Error("散弹手弹道应为 3");
  if (G.mainWorld.altars.length !== 5) throw new Error("第 2 关祭坛应为 5 个");
  frames(600);   // 10 秒战斗
  const killed = G.run.kills;
  if (killed < 1) throw new Error("第 2 关 10 秒内应有击杀");
  // 击杀进度推进 → Boss2（无活怪时主动生成一只）
  G.run.kills = CFG.levels[1].progressGoal - 1;
  let m2 = G.mainWorld.monsters.find(m => !m.dead);
  if (!m2) { m2 = new Monster("NM0013", G.player.x + 400, G.player.y, G.levelCfg.monsterLevel || 1); G.mainWorld.monsters.push(m2); }
  while (!m2.dead) damageMonster(G.mainWorld, m2, 99999);
  frames(5);
  if (!G.run.bossSpawned) throw new Error("第 2 关 Boss 未触发");
  if (G.mainWorld.boss.defId !== "BS0002") throw new Error("Boss 应为 BS0002, got " + G.mainWorld.boss.defId);
  console.log("第 2 关 OK: 地图", G.mainWorld.w + "x" + G.mainWorld.h, "击杀", killed, "Boss:", CFG.monsters.BS0002.name);
  // 撤离 → 解锁链（当前 unlockedLevels=3，撤离第 2 关不会越界，验证不报错即可）
  while (!G.mainWorld.boss.dead) damageMonster(G.mainWorld, G.mainWorld.boss, 9999999);
  frames(5);
  if (!G.run.bossDefeated || !G.run.exitStatue) throw new Error("Boss2 未结算或未生成撤离点雕像");
  G.run.hp = 100000;
  G.mainWorld.monsters.forEach(m => m.dead = true);
  G.mainWorld.enemyBullets = [];
  G.mainWorld.altars = [];    // 清掉随机祭坛（如空间裂缝），避免传送打断读条
  G.player.x = G.run.exitStatue.x; G.player.y = G.run.exitStatue.y;   // 站进雕像圈内 → 自动读条 8 秒
  G.run.extractProgress = 0;
  frames(560);
  if (G.state !== "settled") throw new Error("第 2 关撤离未成功, state=" + G.state);
  console.log("第 2 关撤离 OK → 结算, 解锁关卡数:", Meta.data.unlockedLevels);

  // ---- 阶段8：空间裂缝进出 + 返回信标 ----
  Game.backToMenu();
  UI.selectedLevel = CFG.levels[0];
  Game.startRun(CFG.heroes[0]);
  G.run.hp = 100000;
  frames(10);
  const mainMonsters = G.mainWorld.monsters.length;
  const originX = G.player.x, originY = G.player.y;
  EventBus.emit("enterRift");
  frames(10);
  if (!G.inRift || G.activeWorld !== G.riftWorld) throw new Error("未进入空间裂缝");
  if (!G.riftWorld.returnBeacon) throw new Error("返回信标未刷出");
  if (G.riftWorld.monsters.length === 0) throw new Error("裂缝子地图应有怪");
  console.log("进入裂缝 OK: 怪", G.riftWorld.monsters.length, "信标@", Math.round(G.riftWorld.returnBeacon.x) + "," + Math.round(G.riftWorld.returnBeacon.y));
  G.run.hp = 100000;
  // 开场冻结（5.1）：进场后全员静止+无敌 3 秒 —— 走真实帧推进等它自然结束，再做信标读条测试
  for (let i = 0; i < 40 && G.riftWorld.freezeTimer > 0; i++) frames(10);
  if (G.riftWorld.freezeTimer > 0) throw new Error("开场冻结未在预期时间内结束");
  console.log("开场冻结结束 OK");
  // 击杀 12 只 → 奖励宝箱雕像
  G.run.riftKills = 0;
  for (let i = 0; i < CFG.rift.rewardKills; i++) {
    let mm = G.riftWorld.monsters.find(m => !m.dead);
    if (!mm) { mm = new Monster("NM0010", 1700, 100, G.levelCfg.monsterLevel || 1); G.riftWorld.monsters.push(mm); }
    while (!mm.dead) damageMonster(G.riftWorld, mm, 999999);   // 护盾精英需二次命中
  }
  if (!G.riftWorld.altars.some(a => a.id === "RIFT_CHEST")) throw new Error("裂缝奖励宝箱未刷出");
  console.log("裂缝击杀奖励 OK: 宝箱雕像出现");
  // 站上信标读条 5 秒返回（中途受击归零一次）；清场防刷新怪打断
  G.riftWorld.monsters.forEach(m => m.dead = true);
  G.riftWorld.circles = [];
  G.riftWorld.enemyBullets = [];
  G.player.x = G.riftWorld.returnBeacon.x; G.player.y = G.riftWorld.returnBeacon.y;
  frames(120);   // 2s
  heroTakeDamage(G.riftWorld, G.player, 1);
  if (G.riftWorld.returnProgress !== 0) throw new Error("受击未归零");
  frames(400);   // ~6.7s > 5s
  if (G.inRift) throw new Error("未通过信标返回");
  if (G.player.x !== originX || G.player.y !== originY) throw new Error("返回位置未恢复");
  console.log("裂缝返回 OK: 回到原位置 (" + Math.round(originX) + "," + Math.round(originY) + ")，主地图怪物保留:", G.mainWorld.monsters.length > 0);

  console.log("RUNTIME OK");
`, ctx, { filename: "inline" });
