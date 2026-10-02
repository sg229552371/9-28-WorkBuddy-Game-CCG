/* 无头测试：第 5 步行为芯片积木（第十九章 19.12）
 * 覆盖 19.12.3 验收断言清单 10 条：
 *   behavior 透传到 Bullet / bounce 折射 / burn 燃蚀（3 秒 + dps 档位）/
 *   split 裂变（owner 继承 + 小弹不再分裂）/ chain 链锁（目标数 ≤ value + 不重复链接）/
 *   同 type 取 max / 无行为芯片时行为等价（回归护栏）
 * 运行：node chip_behavior_test.js（判绿 = exit 0 且无 FAIL）
 */
"use strict";

/* ---- DOM / Canvas 桩（与 chip_test 同款） ---- */
const ctxCalls = [];
global.__ctxCalls = ctxCalls;
const ctxProxy = new Proxy({}, {
  get(t, p) {
    if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(100 * 100 * 4) });
    if (p in t) return t[p];
    return (...a) => { ctxCalls.push([p, a]); };
  },
  set(t, p, v) { t[p] = v; ctxCalls.push(["set:" + p, [v]]); return true; },
});
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.style = {}; this.dataset = {};
    this.classList = { add() { }, remove() { }, toggle() { }, contains: () => false };
    this.children = [];
    this.innerHTML = ""; this.textContent = ""; this.disabled = false; this.width = 300; this.height = 150;
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
const elCache = {};
global.document = {
  getElementById(id) { return elCache[id] || (elCache[id] = new FakeEl(id)); },
  createElement(tag) { return new FakeEl(tag); },
  addEventListener() { }, querySelectorAll: () => [], elementFromPoint: () => null,
};
global.window = { addEventListener() { } };
global.requestAnimationFrame = (cb) => { global.__raf = cb; };
global.Image = class { constructor() { this.width = 100; this.height = 100; } set src(v) { if (this.onload) this.onload(); } };

global.__toastCalls = 0;
global.UI = { selectedLevel: null, selectedChar: null,
  toast() { global.__toastCalls++; }, showScreen() { }, showHudOnly() { }, toggleBackpack() { }, toggleArtisan() { },
  updateHUD() { }, renderItemInfo() { }, renderBackpack() { }, renderArtisan() { },
  buildLevelList() { }, buildCharList() { }, showSettlement() { }, showDeath() { },
  onLevelUpChoice(c, cb) { const i = (c || []).findIndex(x => !x.locked); if (i >= 0 && cb) cb(i); },
  onLevelUpChoiceClose() { },
};

const fs = require("fs"), vm = require("vm");
const ctx = vm.createContext(global);
for (const f of ["js/config.js", "js/core.js", "js/game.js", "js/main.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const driver = `
  G.canvas = document.getElementById("game-canvas");
  G.ctx = G.canvas.getContext("2d");
  G.sprites = { hero:{width:60,height:60}, enemy00:{}, enemy08:{}, enemy16:{}, enemy22:{} };
  Game.bindInput(); Game.bindEvents();
  UI.selectedLevel = CFG.levels[0];

  let ok = true;
  const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + " " + name); if (!cond) ok = false; };
  const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);
  let t = 0;
  function step(n) { for (let i = 0; i < n; i++) { t += 16.7; global.__raf(t);
    if (Game.paused && Game.skipLevelUpChoice) Game.skipLevelUpChoice(); } }

  Game.startRun([CFG.heroes[0]]);
  Game.skipIntroFreeze();
  Game.loop(t);   // 手动踢一次主循环（内部续接 __raf；渲染断言需要）

  // ---- 测试专用假世界：只需 obstacles / monsters / 弹池 / 空间哈希 ----
  function mkWorld() {
    const w = { w: 2000, h: 2000, obstacles: [], monsters: [], playerBullets: [], enemyBullets: [],
      lasers: [], pickups: [], altars: [], groundChests: [], isMain: false, kind: "sub" };
    w.monsterHash = new SpatialHash(96);
    return w;
  }
  // 造一只怪并登记到哈希（hit 判定用哈希查询）
  function spawnAt(w, id, x, y, lv) {
    const m = new Monster(id || "NM0010", x, y, lv || 1);
    w.monsters.push(m);
    w.monsterHash.insert(m, m.x, m.y, m.r);
    return m;
  }
  // 造一枚带 behavior 的玩家弹（owner 默认队长）
  function mkBullet(x, y, ang, behavior, opts) {
    opts = opts || {};
    return new Bullet(x, y, ang, opts.spd || 400, opts.dmg || 5, "player",
      opts.pierce || 0, 0, 0, true, opts.owner || G.player, behavior || null);
  }
  const chipVal = (id, q) => CFG.chips.behaviorPool.find(d => d.id === id).vals[q];

  /* ============ 断言 1：behavior 从 resolveSkill 透传到实际 Bullet 实例 ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const skId = CFG.weapons[G.heroDef.weapon].skills.skill;
    const syn = moduleSynergy();
    let res = resolveSkill(CFG.skills[skId], 1, syn);
    check("1. 基线：无行为芯片时 resolveSkill.behavior 为空", !res.behavior);
    const b = makeChip("C_B_BURN", 2);   // burn q2 -> vals[2]=8
    const s = G.run.chipInv.findSpot(b);
    G.run.chipInv.place(b, s.x, s.y);
    res = resolveSkill(CFG.skills[skId], 1, syn);
    check("1. resolveSkill 结果透传 behavior.type='burn'", res.behavior && res.behavior.type === "burn");
    // 经 SkillSystem.castBullet 生成真实 Bullet → 字段落在实例上
    const w = mkWorld();
    SkillSystem.castBullet(w, G.player, res, 0, { side: "player", isSkill: true, atk: 10 });
    const bullet = w.playerBullets[0];
    check("1. 实际 Bullet 实例携带 behavior（type='burn'）", bullet && bullet.behavior && bullet.behavior.type === "burn");
    check("1. Bullet.behavior.value === resolveSkill.behavior.value（8）", bullet.behavior.value === res.behavior.value);
  }

  /* ============ 断言 2：bounce 命中后转向续存、剩余次数按 value 递减、耗尽消亡 ============ */
  {
    const w = mkWorld();
    // 目标 A 在弹丸正前方；目标 B 在右侧远处（反弹指向）
    const A = spawnAt(w, "NM0010", 300, 500);
    const B = spawnAt(w, "NM0010", 900, 900);
    const bullet = mkBullet(300, 500, 0, { type: "bounce", value: 1 });
    check("2. bounce 构造后剩余次数 = value（1）", bullet.bounce === 1);
    // 第一击：命中 A → 剩余 -1 → 转向 B 方向续存
    bullet.update(w, 0.016);
    check("2. 命中 1 目标后 bullet 仍存活（续命）", bullet.dead === false);
    check("2. 剩余弹射次数按 value 递减（1 → 0）", bullet.bounce === 0);
    const angNow = Math.atan2(bullet.vy, bullet.vx);
    const angToB = Math.atan2(B.y - bullet.y, B.x - bullet.x);
    check("2. 命中后速度方向转向附近新目标 B", Math.abs(angNow - angToB) < 0.2);
    check("2. 第一击对 A 生效（掉血）", A.hp < A.hpMax);
    // 第二击：把弹丸挪到 B 处再更新 → 次数已耗尽 → 消亡
    bullet.x = B.x; bullet.y = B.y;
    w.monsterHash.clear(); w.monsterHash.insert(B, B.x, B.y, B.r);
    bullet.update(w, 0.016);
    check("2. 次数耗尽后再次命中 → 消亡", bullet.dead === true);
    check("2. 第二击对 B 生效（掉血）", B.hp < B.hpMax);
  }

  /* ============ 断言 3：burn 命中挂 burn.remain ≈ 3s、每帧按 dps 扣血、归零停扣 ============ */
  {
    const w = mkWorld();
    const m = spawnAt(w, "NM0010", 300, 500, 100);
    const dps = 12;
    const bullet = mkBullet(300, 500, 0, { type: "burn", value: dps });
    bullet.update(w, 0.016);
    check("3. 命中后怪物获得 burn（dps=12）", m.burn && m.burn.dps === dps);
    check("3. burn.remain ≈ 3s（持续 3 秒）", near(m.burn.remain, 3, 0.02));
    // 每帧按 dps 扣血：模拟 1 秒 = 60 帧
    const hp0 = m.hp;
    for (let i = 0; i < 60; i++) monsterBurnTick(m, w, 1 / 60);
    check("3. 燃烧 1 秒扣血 ≈ dps（12）", near(hp0 - m.hp, dps, 0.3));
    // 推进到 remain 归零
    for (let i = 0; i < 130; i++) monsterBurnTick(m, w, 1 / 60);
    check("3. remain 归零后 burn 清除", m.burn == null);
    const hp1 = m.hp;
    for (let i = 0; i < 30; i++) monsterBurnTick(m, w, 1 / 60);
    check("3. remain 归零后停止扣血", m.hp === hp1);
  }

  /* ============ 断言 4：burn 的 dps 与 vals[q] 一致（3/5/8/12） ============ */
  {
    const want = [3, 5, 8, 12];
    for (let q = 0; q < 4; q++) {
      const ch = makeChip("C_B_BURN", q);
      check("4. C_B_BURN(q" + q + ").value === vals[q] (" + want[q] + ")", ch.value === want[q]);
      const m = new Monster("NM0010", 900, 900, 1);
      applyBurnToMonster(m, ch.value);
      check("4. 施加后 burn.dps 与 vals[q] 一致（" + want[q] + "）", m.burn.dps === want[q]);
    }
    check("4. vals 定义锁定 [3,5,8,12]", chipVal("C_B_BURN", 0) === 3 && chipVal("C_B_BURN", 3) === 12);
  }

  /* ============ 断言 5：split 击杀后新增 value 枚小弹，owner 与击杀弹一致 ============ */
  {
    const w = mkWorld();
    const m = spawnAt(w, "NM0010", 500, 500);
    m.hp = 1;
    const owner = G.player;
    const bullet = mkBullet(500, 500, 0, { type: "split", value: 3 }, { dmg: 100, owner: owner });
    const n0 = w.playerBullets.length;   // 击杀弹尚未入池，此处为 0
    bullet.update(w, 0.016);
    check("5. 击杀怪物（hp 归零 / dead）", m.dead === true);
    check("5. 击杀后场上新增 value(3) 枚小弹", w.playerBullets.length === n0 + 3);
    check("5. 小弹 owner 与击杀弹一致", w.playerBullets.every(c => c.owner === owner));
    check("5. 小弹伤害继承部分属性（< 击杀弹伤害 100）",
      w.playerBullets.every(c => c.dmg > 0 && c.dmg < 100));
  }

  /* ============ 断言 6：split 的小弹不再触发 split（显式护栏） ============ */
  {
    const w = mkWorld();
    const m1 = spawnAt(w, "NM0010", 500, 500);
    m1.hp = 1;
    const killer = mkBullet(500, 500, 0, { type: "split", value: 2 }, { dmg: 100 });
    killer.update(w, 0.016);
    const children = w.playerBullets.slice();
    check("6. 父弹分裂出 2 枚小弹", children.length === 2);
    check("6. 小弹 behavior 为空 / 非 split（护栏）",
      children.every(c => !c.behavior || c.behavior.type !== "split"));
    // 让一枚小弹去击杀新怪：不应再分裂
    const m2 = spawnAt(w, "NM0010", 800, 800);
    m2.hp = 1;
    const before = w.playerBullets.length;
    const child = children[0];
    child.x = m2.x; child.y = m2.y; child.dmg = 100;
    child.update(w, 0.016);
    check("6. 小弹击杀新怪后不再分裂（小弹总数不增）", w.playerBullets.length <= before);
    check("6. 小弹确实完成了击杀（m2.dead）", m2.dead === true);
  }

  /* ============ 断言 7：chain 向最近 N 个敌人传导，目标数 ≤ value ============ */
  {
    const w = mkWorld();
    const src = spawnAt(w, "NM0010", 500, 500, 50);
    const t1 = spawnAt(w, "NM0010", 560, 500, 50);
    const t2 = spawnAt(w, "NM0010", 620, 500, 50);
    const far = spawnAt(w, "NM0010", 1900, 1900, 50);   // 远处目标（不应被优先链接）
    const bullet = mkBullet(500, 500, 0, { type: "chain", value: 2 });
    bullet.update(w, 0.016);
    check("7. 命中源目标后传导（源掉血）", src.hp < src.hpMax);
    check("7. 传导目标数 ≤ value（2）", bullet.chainHit.size - 1 <= 2);
    check("7. 最近的两个相邻目标被链接（t1 / t2 掉血）", t1.hp < t1.hpMax && t2.hp < t2.hpMax);
    check("7. 远处目标未被链接（不在链锁集合）", !bullet.chainHit.has(far));
  }

  /* ============ 断言 8：chain 不重复链接同一敌人（链锁标记生效） ============ */
  {
    const w = mkWorld();
    const src = spawnAt(w, "NM0010", 500, 500, 50);
    const t1 = spawnAt(w, "NM0010", 560, 500, 50);
    const bullet = mkBullet(500, 500, 0, { type: "chain", value: 2 });
    bullet.update(w, 0.016);
    const markedOnce = bullet.chainHit.size;
    // 让弹丸再次命中同一批敌人（重置位置到源上再打一次）
    const hpT1 = t1.hp;
    bullet.dead = false;
    bullet.x = src.x; bullet.y = src.y;
    bullet.update(w, 0.016);
    check("8. 源目标已在链锁集合（不被重复加入）", bullet.chainHit.has(src));
    check("8. 二次命中不重复链接同一敌人（集合大小不增）", bullet.chainHit.size === markedOnce);
    check("8. 弹丸自身命中伤害照常（源二次掉血）", src.hp < src.hpMax);
  }

  /* ============ 断言 9：同 type 多枚芯片 → 生效 value = max（不叠乘） ============ */
  {
    Game.startRun([CFG.heroes[0]]);
    Game.skipIntroFreeze();
    const skId = CFG.weapons[G.heroDef.weapon].skills.skill;
    const syn = moduleSynergy();
    const a = makeChip("C_B_BOUNCE", 0);   // vals[0]=1
    const sa = G.run.chipInv.findSpot(a); G.run.chipInv.place(a, sa.x, sa.y);
    const b = makeChip("C_B_BOUNCE", 2);   // vals[2]=2
    const sb = G.run.chipInv.findSpot(b); G.run.chipInv.place(b, sb.x, sb.y);
    const res = resolveSkill(CFG.skills[skId], 1, syn);
    check("9. 多枚同类 bounce → behavior.value = max（2，非 1+2=3）",
      res.behavior && res.behavior.type === "bounce" && res.behavior.value === 2);
    // 经 Bullet 注入后剩余次数 = max
    const w = mkWorld();
    SkillSystem.castBullet(w, G.player, res, 0, { side: "player", isSkill: true, atk: 10 });
    check("9. Bullet 剩余弹射次数 = max value（2）", w.playerBullets[0].bounce === 2);
  }

  /* ============ 断言 10：无行为芯片时行为与接入前完全一致（等价性回归） ============ */
  {
    // 回落等价：behavior=null 的弹 → 命中即消亡、无 burn、无 chain、无 split
    const w = mkWorld();
    const m = spawnAt(w, "NM0010", 300, 500);
    const plain = mkBullet(300, 500, 0, null);
    check("10. 无 behavior：Bullet.behavior 为空", !plain.behavior);
    plain.update(w, 0.016);
    check("10. 无 behavior：命中即消亡（不折射 / 不续命）", plain.dead === true);
    check("10. 无 behavior：不挂 burn", !m.burn);
    // 无 behavior 的击杀：不产生 split 小弹
    const w2 = mkWorld();
    const m2 = spawnAt(w2, "NM0010", 400, 400); m2.hp = 1;
    const killer = mkBullet(400, 400, 0, null, { dmg: 100 });
    const n0 = w2.playerBullets.length;
    killer.update(w2, 0.016);
    check("10. 无 behavior 击杀：不分裂小弹（弹池不变）", w2.playerBullets.length === n0);
    check("10. 无 behavior 击杀照常结算（m2.dead）", m2.dead === true);
    // 死亡怪被淘汰后，Monster.update 不受 burn 干扰（无 burn 字段）
    check("10. 无 behavior：怪物无 burn 残留字段", !m2.burn);
  }

  console.log(ok ? "CHIP BEHAVIOR TEST OK" : "CHIP BEHAVIOR TEST FAILED");
  if (!ok) throw new Error("CHIP BEHAVIOR TEST FAILED");
`;

vm.runInContext(driver, ctx, { filename: "driver" });
