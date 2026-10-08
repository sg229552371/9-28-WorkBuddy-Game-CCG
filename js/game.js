/* ============================================================
 * game.js — 世界 / 实体核心（21.16 物理搬移拆分：原 game.js 第 1 部分）
 * 职责：全局状态 G；存档 Meta / SAVE_KEY；run 构建 createRun；
 *       实体类 Player / Drone / Bullet / Monster / World；
 *       队伍跟随（trail/companion）、索敌与受伤入口（heroTakeDamage 等）、
 *       障碍碰撞、主城 avatar / 世界更新、drawActor、heroDefNameOf。
 * 架构：逻辑与渲染分离，数据驱动，便于迁移 Godot。
 * ⚠️ 本文件由纯物理搬移生成：除本头部职责注释与 "use strict"; 外，代码逐字沿用原文件。
 * ============================================================ */
"use strict";
/* ============ 全局游戏状态 ============ */
const G = {
  canvas: null, ctx: null, W: 1920, H: 1080,
  state: "boot",          // boot | menu | charSel | playing | settled | dead
  levelCfg: null, heroDef: null,
  run: null,              // 本局数据
  mainWorld: null, subWorld: null, activeWorld: null,
  inArtisan: false,
  inEndless: false,       // 21.15 无尽模式进行中（深渊世界接管 activeWorld）
  endlessWorld: null,     // 21.15 无尽世界实例（Endless.makeWorld 产出）
  saved: {},              // 21.15 会话内轻量存档标记（如 endlessSeen 首次说明）
  keys: {}, mouse: { x: 0, y: 0 },
  joy: { active: false, dx: 0, dy: 0 },   // 移动端虚拟摇杆向量（归一化 + 死区；active=手指按住）
  time: 0,
  sprites: {},            // 处理后的精灵图
};

/* ============ 运行局数据 ============ */
/** 模块槽初始化（19.10.1）：为**队长 + 全部队友**各建一条长 perHero 的全 null 数组。
 *  英雄 ID 口径：队长 = G.heroDef.id，队友 = G.team[i].id（i≥1）。 */
function buildHeroModuleSlots() {
  const out = {};
  const per = (CFG.moduleSlot && CFG.moduleSlot.perHero) || 4;
  const hd = G.heroDef || (G.team && G.team[0]);
  const ids = [];
  if (hd && hd.id) ids.push(hd.id);
  for (const h of (G.team || [])) if (h && h.id && ids.indexOf(h.id) < 0) ids.push(h.id);
  for (const id of ids) out[id] = new Array(per).fill(null);
  return out;
}
/** 模块抽取/排队状态初始化（19.10.1）：每英雄 { offered:[], queue:[] }。 */
function buildModulePoolState() {
  const out = {};
  const hd = G.heroDef || (G.team && G.team[0]);
  const ids = [];
  if (hd && hd.id) ids.push(hd.id);
  for (const h of (G.team || [])) if (h && h.id && ids.indexOf(h.id) < 0) ids.push(h.id);
  for (const id of ids) out[id] = { offered: [], queue: [] };
  return out;
}
function createRun(heroDef) {
  return {
    heroDef,
    autoFight: false,               // 自动战斗（HUD 按钮）：19.1 后普攻已移除，技能**全自动**释放（冷却好+能量够即放，与本开关无关）；本开关仅控制**走位托管**
    hp: heroDef.hp, hpMax: heroDef.hp,
    energy: heroDef.energyMax, energyMax: heroDef.energyMax,
    lv: 1, exp: 0, expNext: expNextFor(1), coin: 0, kills: 0, eliteKills: 0,
    backpack: new Inventory(CFG.backpack.cols, CFG.backpack.rows, "backpack"),
    weaponInv: new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon"),
    // 芯片背包（19.11.1）：6×5 独立容器，取代旧武器栏的「技能栏」职能；出局消失、不折算
    chipInv: new Inventory(CFG.chips.grid.cols, CFG.chips.grid.rows, "chip"),
    // 模块槽（19.10.1）：每英雄 4 槽（队长 + 队友各自独立），槽内元素 {defId, lv} 或 null
    heroModules: buildHeroModuleSlots(),
    // 模块抽取/排队状态（19.10.1）：显式初始化，防「没跑过弹窗就取值为 undefined」
    modulePoolState: buildModulePoolState(),
    // 属性小包累计（19.10.4 兜底）：并入 runBonus().add，全队生效
    statPackGain: { hp: 0, atk: 0, def: 0, spd: 0 },
    // 升级 4 选 1 连升队列（19.10.2 第 7 步）：一次升级 N 级则排队逐个弹
    levelUpQueue: [],
    buffs: [],                      // 战争雕像增益 {id, stat, mul, remain, label}
    pendingItems: [],               // 工匠开箱待分配区（未拖入背包前存放，放弃即作废）
    // 邪神雕像：多效果并列倍率表（同一目标再次触发为覆盖并重新计时，非叠乘；remain=-1 永久）
    scale: {
      smallCount: { mul: 1, remain: 0 },   // 小怪数量
      smallStat:  { mul: 1, remain: 0 },   // 小怪属性
      eliteCount: { mul: 1, remain: 0 },   // 精英数量
      eliteStat:  { mul: 1, remain: 0 },   // 精英属性
      bossStat:   { mul: 1, remain: 0 },   // BOSS 属性
    },
    curse: null,                    // 诅咒道具（待细化36）{defMul,hpMul,atkMul,spdMul,rewardMul,remain}
    lifesteal: 0,
    cardAssets: 0,                  // 属性卡牌资产（🔴 19.7 已退役：升级不再 +1，恒 0；UI 走 0 分支自然冻结，折算恒 0）
    cardRefresh: CFG.cardPool.refreshPerRun,   // 本局剩余刷新次数
    cardCandidates: null,           // 当前候选卡牌（进入工匠世界时抽取）
    appliedCards: [],               // 已使用卡牌 {attr, q, value}，退出局内随 run 清除
    artisanSpawned: false, artisanUsed: false,   // artisanUsed = 本关是否进过（仅用于提示，不再限制次数）
    // 工匠雕像池（4.6）：触发条件投配额 → 限制器决定何时落地；子世界可无限次进入
    artisanPool: createArtisanPool(),
    bossSpawned: false, bossDefeated: false,
    // 撤离点雕像（5.2）：主地图当前撤离点（null = 没有）；读条字段保留原名与语义
    exitStatue: null,
    extractChanneling: false, extractProgress: 0,
    extractHolder: null,     // 撤离判定的持有者：同一判定同时只有一个持有者（多英雄同圈不会各自触发）
    // 自动战斗托管 AI（转向力叠加模型）：autoStyle 为风格键（CFG.autoFight.styles）
    autoFight: false, autoStyle: CFG.autoFight ? CFG.autoFight.defaultStyle : "balanced",
    aiHoldT: 0, aiMvX: 0, aiMvY: 0, aiClock: 0, aiThreatSeen: null,
    aiAltar: null, aiAltarT: 0, aiChestCool: 0,   // 资源目标：锁定的雕像 / 走向雕像的计时 / 宝箱拾取失败冷却
    runTime: 0,
    stats: {                        // 本局统计（数值收敛用）
      dmgDealt: 0, dmgTaken: 0,
      chestsOpened: 0, altarsUsed: 0,
      timeToBoss: 0, bossFightTime: 0,
    },
    // 多角色组队（CFG.team.maxSize=3）：队长由玩家操控，其余为 AI 队友
    companions: (G.team || []).slice(1).map((hd, i) => ({
      heroDef: hd, id: hd.id, name: hd.name,
      hp: hd.hp, hpMax: hd.hp, r: hd.radius,
      x: 0, y: 0, fireTimer: 0, alive: true, faceDir: 1,
      isCompanion: true,   // 标记：吸血 / 增益 / 产物池按「各自独立」结算（applyLifesteal、companionStats）
      skills: null,   // 由 recomputeWeapon() 解析：武器栏内的武器模块对小队全体成员生效
      skillTimer: (i + 1) * (CFG.team.skillStagger || 0.6),   // 主动技能冷却；错峰避免全员同帧起手
      // 队友是独立个体：**自带能量池**（上限 / 回复可被武器栏装备、属性卡、雕像 Buff 加成）
      energy: hd.energyMax, energyMax: hd.energyMax, regen: hd.energyRegen,
      cdMul: 1, lifesteal: 0,   // 由 updateCompanions() 每帧同步（属性卡 / 雕像 Buff 全队生效）
    })),
    // 产物池：**每个成员各自独立**（召唤物 / 陷阱都带 owner = 召唤者），互不顶替、各自计上限
    drones: [],       // 召唤物（无人机）：环绕各自的召唤者、自动攻击、可被敌人击毁
    traps: [],        // 陷阱（大地雷）：不受敌人攻击，敌人入圈延迟引爆
    // 激光（第十七章 17.7 第 3 步）：Boss 激光实体容器（显式初始化，防「未跑过 update 取值为 undefined」）
    lasers: [],
    weapon: computeWeaponDefaults(),
  };
}
function computeWeaponDefaults() {
  const sk = CFG.weapons[(G.heroDef && G.heroDef.weapon) || "W001"].skills;
  return { basic: { ...CFG.skills[sk.basic] }, skill: { ...CFG.skills[sk.skill] } };   // 每帧由词条重算副本
}

/* ---------- 局外元进度（localStorage 持久化：结晶 / 各角色局外等级 / 关卡解锁 / 玩家档案 / 图鉴） ---------- */
const SAVE_KEY = "bagrogue_save_v1";
const Meta = {
  data: { crystals: 0, heroes: {}, unlockedLevels: 1, profile: null, codex: null, unlockExtra: {} },
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* 无 localStorage（测试环境）则用默认值 */ }
    // 迁移：旧的"结晶技能升级"并入武器等级（技能等级 = 武器等级，局外结晶升级）——老存档字段保留兼容
    for (const id in this.data.heroes) {
      const rec = this.data.heroes[id];
      if (rec.skillLevel && !rec.weaponLv) rec.weaponLv = rec.skillLevel;
    }
    if (!this.data.unlockExtra) this.data.unlockExtra = {};   // 迁移：非首发英雄主动解锁记录（方向3）
    // 迁移：主城档案 + 图鉴（老存档补默认值；皮肤 = 英雄外貌，图鉴激活解锁）
    if (!this.data.profile) this.data.profile = { name: CFG.profile.defaultName, skinId: CFG.profile.defaultSkin, titleId: CFG.profile.titles[0].id };
    if (!this.data.codex) this.data.codex = { heroes: {}, monsters: {}, flags: {} };
    if (!this.data.codex.flags) this.data.codex.flags = {};
    // 初始皮肤永久解锁
    this.data.codex.heroes[CFG.profile.defaultSkin] = true;
  },
  commit() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { } },
  /* ---- 玩家档案（主城头像栏 / 形象师 NPC） ---- */
  profileName() { return (this.data.profile && this.data.profile.name) || CFG.profile.defaultName; },
  rename(name) {
    const n = String(name || "").trim();
    if (n.length < CFG.profile.nameMin || n.length > CFG.profile.nameMax) return false;
    this.data.profile.name = n;
    this.commit();
    return true;
  },
  skinId() { return (this.data.profile && this.data.profile.skinId) || CFG.profile.defaultSkin; },
  // 皮肤 = 英雄外貌：图鉴激活（用过该英雄出征）才可选用；默认皮肤永久解锁
  skinUnlocked(id) { return id === CFG.profile.defaultSkin || !!(this.data.codex.heroes[id]); },
  setSkin(id) {
    if (!this.skinUnlocked(id)) return false;
    this.data.profile.skinId = id;
    this.commit();
    return true;
  },
  titleId() { return (this.data.profile && this.data.profile.titleId) || CFG.profile.titles[0].id; },
  titleUnlocked(t) { return !t.flag || !!this.data.codex.flags[t.flag]; },
  setTitle(id) {
    const t = CFG.profile.titles.find(x => x.id === id);
    if (!t || !this.titleUnlocked(t)) return false;
    this.data.profile.titleId = id;
    this.commit();
    return true;
  },
  titleName() { const t = CFG.profile.titles.find(x => x.id === this.titleId()); return t ? t.name : ""; },
  /* ---- 图鉴（英雄用过即激活 → 解锁同名皮肤；怪物击杀即收录） ---- */
  activateHero(id) {
    if (!this.data.codex.heroes[id]) { this.data.codex.heroes[id] = true; this.commit(); }
  },
  recordMonster(defId) {
    if (defId && !this.data.codex.monsters[defId]) { this.data.codex.monsters[defId] = true; this.commit(); }
  },
  setFlag(flag) {
    if (flag && !this.data.codex.flags[flag]) { this.data.codex.flags[flag] = true; this.commit(); }
  },
  heroLevel(id) { return (this.data.heroes[id] && this.data.heroes[id].level) || 1; },
  // 升级花费：走文件末尾 outLevelCost 纯函数（指数曲线，缺配置回落旧线性——方向3）
  levelUpCost(id) { return outLevelCost(id); },
  levelUp(id) {
    const lv = this.heroLevel(id);
    if (lv >= CFG.outLevel.maxLevel) return false;
    const cost = this.levelUpCost(id);
    if (this.data.crystals < cost) return false;
    this.data.crystals -= cost;
    const rec = this.data.heroes[id] || {};
    this.data.heroes[id] = { ...rec, level: lv + 1 };
    this.commit();
    return true;
  },
  /* ---- 英雄解锁（方向3：首发 starterCount 个默认解锁，其余走 CFG.unlockRules 局外条件） ---- */
  isHeroUnlocked(id) { return isHeroUnlocked(id, this.data); },
  // 花结晶主动解锁（crystal 条件）：结晶不足/无规则返回 false；已解锁返回 true（幂等）
  unlockHero(id) {
    if (this.isHeroUnlocked(id)) return true;
    const rule = CFG.unlockRules && CFG.unlockRules[id];
    const cost = rule && rule.crystal;
    if (!cost || this.data.crystals < cost) return false;
    this.data.crystals -= cost;
    this.data.unlockExtra[id] = true;
    this.commit();
    return true;
  },
  // 已解锁英雄 id 数组（按 CFG.heroes 顺序；unlockOrder 中尚无英雄数据的 id 不计入）
  unlockedHeroes() { return CFG.heroes.filter(h => this.isHeroUnlocked(h.id)).map(h => h.id); },
  // 武器等级（永久资产，按英雄存档；主城「武器匠」花结晶升级；技能等级 = 武器等级同步）
  weaponLv(id) { return (this.data.heroes[id] && this.data.heroes[id].weaponLv) || 1; },
  weaponUpCost(id) {
    return weaponLevelEntry(this.weaponLv(id)).cost;
  },
  weaponUp(id) {
    const lv = this.weaponLv(id);
    if (lv >= CFG.weaponLevel.maxLv) return false;
    const rec = this.data.heroes[id] || {};
    this.data.heroes[id] = { ...rec, weaponLv: lv + 1 };
    this.commit();
    return true;
  },
  // 结算发结晶（19.8 已定）：来源① = 击杀 BOSS（crystalBoss）；来源② = 撤离彻底折算
  // （main.js 结算时另加 conv.total，不经本函数）。**小怪击杀（crystalKill）已退役**——
  // kills 参数保留仅为兼容调用方签名；死亡时来源②不发生，BOSS 结晶按 deathRatio 保留。
  awardRun(kills, bossDefeated, extracted) {
    let v = bossDefeated ? CFG.outLevel.crystalBoss : 0;
    if (!extracted) v = Math.floor(v * CFG.outLevel.deathRatio);
    this.data.crystals += v;
    this.commit();
    publishCrystalReport(kills, bossDefeated, extracted, v);   // 单行挂点：生成并广播本局结晶明细（方向3 产出可见化）
    return v;
  },
};
Meta.load();

// 局外等级 → 英雄实际出战属性（副本，不污染 CFG）
// 属性成长走文件末尾 outLevelStats 纯函数（分段增益表 growthTable + 定位差异化，缺表回落旧线性——方向3）
function applyOutLevel(def) {
  const lv = Meta.heroLevel(def.id);
  const s = outLevelStats(def, lv);
  return { ...def, outLevel: lv, weaponLv: Meta.weaponLv(def.id), outSkillLv: Meta.weaponLv(def.id),
    hp: s.hp, atk: s.atk, def: s.def };
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = G.heroDef.radius;
    this.skillTimer = 0;    // 🔴 19.1 普攻移除：fireTimer 已随 fireBasic 一起退役
    this.faceDir = 1;
    this.mvx = 0; this.mvy = 0;   // 当前移动方向（0=静止；队友列队与朝向依赖此值）
  }
  update(w, dt) {
    const st = computeStats();
    // 同步等级 / 装备带来的上限与吸血（hpMax 随等级成长）
    G.run.hpMax = st.hpMax; G.run.energyMax = st.energyMax; G.run.lifesteal = st.lifesteal;
    // 移动（键盘 WASD/方向键；移动端虚拟摇杆优先——摇杆激活时用摇杆归一化向量，死区内视为静止）
    let dx = (G.keys["d"] || G.keys["arrowright"] ? 1 : 0) - (G.keys["a"] || G.keys["arrowleft"] ? 1 : 0);
    let dy = (G.keys["s"] || G.keys["arrowdown"] ? 1 : 0) - (G.keys["w"] || G.keys["arrowup"] ? 1 : 0);
    const joy = G.joy;
    if (joy && joy.active) {
      const dead = (CFG.mobile && CFG.mobile.joystick && CFG.mobile.joystick.deadZone) || 0.18;
      if (Math.hypot(joy.dx, joy.dy) >= dead) { dx = joy.dx; dy = joy.dy; }
    }
    let manual = dx !== 0 || dy !== 0;
    // 自动战斗托管：开启后由 AI 计算移动向量（玩家手动操作即让权，松手后延迟回归）
    if (manual) G.run.aiHoldT = CFG.autoFight ? CFG.autoFight.manualResumeDelay : 0.5;
    else if (G.run.autoFight && (w.isMain || w.kind === "rift")) {
      const ai = autoFightMove(this, w, dt);
      if (ai.dx || ai.dy) { dx = ai.dx; dy = ai.dy; }
    }
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      if (dx !== 0) this.faceDir = dx > 0 ? 1 : -1;
      this.mvx = dx; this.mvy = dy;   // 记录移动方向，队友据此排到身后
      const wf = weightFactor();
      const spd = st.spd * st.spdMul * wf.f;
      this._mdx = dx * spd * dt; this._mdy = dy * spd * dt;   // 本帧位移（障碍物切向滑动用）
      this.x = U.clamp(this.x + dx * spd * dt, this.r, w.w - this.r);
      this.y = U.clamp(this.y + dy * spd * dt, this.r, w.h - this.r);
      resolveObstacles(this, w, { x: this.x + dx * 100, y: this.y + dy * 100 });   // 偏置 = 行进方向前方
    } else { this.mvx = 0; this.mvy = 0; }   // 停止移动即清零
    // 能量恢复（19.3 能量池退役）：恢复循环停掉——无人消耗能量，条目保留仅为兼容
    // （G.run.energy / energyMax / regen 字段不删，仅不再参与技能门槛）
    // 自动攻击（19.1 移除普攻 / 19.3 冷却制）：英雄**唯一输出 = 主动技能**——冷却好 + 有目标即释放，
    // 不再看能量门槛、autoFight 开关或 Space（技能全自动，玩家专注走位；autoFight 仅托管移动）
    this.skillTimer -= dt;
    const target = nearestMonster(w, this.x, this.y);
    if (target && this.skillTimer <= 0) {
      this.fireSkill(w, target, st);
      this.skillTimer = G.run.weapon.skill.cd * st.cdMul;
    }
  }
  fireSkill(w, target, st) {
    const s = G.run.weapon.skill;
    // 19.3：冷却制不再扣能量（能量池退役）
    // 释放形态由技能表 type 决定（bullet / summon / trap），统一走 SkillSystem
    const res = SkillSystem.cast(w, this, s, target, { side: "player", isSkill: true, atk: st.atk });
    SFX.play("skill");
    // 召唤 / 陷阱返回 { n: 现存量, cap: 实际上限 }（上限 = min(技能锚点数量, 英雄该类型上限)）
    if (res.kind === "summon") UI.toast(`${s.name}！我的无人机编队 ${res.n}/${res.cap}（上限＝英雄召唤物上限）`, "gold");
    else if (res.kind === "trap") UI.toast(`${s.name}！已布设（本人地雷 ${res.n}/${res.cap}，留原地待敌）`, "gold");
    else UI.toast(`${s.name}！`, "gold");
  }
  takeDamage(w, dmg, ignoreDef) {
    const st = computeStats();
    // ignoreDef = true（21.1 毒圈比例伤害）：按最大生命的固定比例扣，不受防御影响
    const real = ignoreDef ? Math.max(1, Math.round(dmg)) : Math.max(1, Math.round(dmg - st.def));
    if (G.inEndless) this.dmgTaken = (this.dmgTaken || 0) + real;   // 21.20 深渊逐角色承伤统计
    G.run.hp -= real;
    spawnFloat(this.x, this.y - 30, `-${real}`, "#ff7b7f");
    SFX.play("hurt");
    G.shakeT = CFG.audio.shake.dur; G.shakeAmp = CFG.audio.shake.hurt;   // 屏幕震动
    if (G.run.hp <= 0) { G.run.hp = 0; onPlayerDeath(); }
  }
  heal(pct) {
    G.run.hp = Math.min(G.run.hpMax, G.run.hp + G.run.hpMax * pct);
    spawnFloat(this.x, this.y - 30, `+${Math.round(G.run.hpMax * pct)}`, "#7de08a");
  }
}

/* ---------- 多角色组队：英雄集合（队长 + AI 队友） ----------
 * 21.14 GC 优化：返回**模块级 scratch 数组**（复用同一引用，不再每帧 new）。
 * ⚠️ 共享引用契约：调用方必须**立即遍历**（不得保存后跨调用使用）——已逐一审计全部调用点
 *    （见文件末尾 §5.45 审计清单），均为即时遍历/即时消费。enemyTargets 用**第二个** scratch，
 *    避免「enemyTargets 内部再调 aliveHeroes」时互相覆盖（双缓冲）。 */
const _heroScratch = [];      // aliveHeroes 的复用数组
const _targetScratch = [];    // enemyTargets 的复用数组（与上者互不干扰）
function aliveHeroes() {
  const arr = _heroScratch;
  arr.length = 0;                                    // 复用：清空而非新建
  if (G.player) arr.push(G.player);
  if (G.run && G.run.companions) for (const c of G.run.companions) if (c.alive) arr.push(c);
  return arr;
}
function nearestHero(x, y) {
  let best = null, bd = Infinity;
  for (const h of aliveHeroes()) {
    const d = U.dist(x, y, h.x, h.y);
    if (d < bd) { bd = d; best = h; }
  }
  return best || G.player;
}

/* ============ 判定圈统一入口（4.4 雕像 / 4.6 工匠 / 5.1 信标 / 5.2 撤离点共用） ============
 * 规则（本轮已定，别再各自写一套）：
 *   ① **所有英雄都是独立个体**，判定不再区分「只有队长能触发」——**任一存活英雄**
 *      在判定圈内都能推进该判定（队长或任意 AI 队友都算，`aliveHeroes()`）；
 *   ② 但**同一个判定同一时刻只可能有一个触发者**——判定是**单一实例**：
 *      进度只有一份、持有者只有一位（`holder`），**不会因为两名英雄同处一圈而加速、也不会各触发一次**；
 *   ③ 判定完成即被**消费**（雕像移除 / 读条触发事件）并把进度归零 → 第二个英雄不可能再触发同一个判定；
 *   ④ 圈内英雄**全部离开**后进度按 `decay`（默认 1.2 倍速）缓慢衰退，不是瞬间清零
 *     （裂缝返回信标例外：`decay = 0`，旧规则「离开圈进度保留」）。
 * 判定半径 = 绘制半径 × CFG.altarJudgeMul（1.2，外扩 20% 容差）。 */
function heroInCircle(x, y, radius) {
  const R = radius * CFG.altarJudgeMul;
  for (const h of aliveHeroes()) if (U.dist(h.x, h.y, x, y) < R) return h;
  return null;
}
/** 推进一个判定圈。返回 true = 本帧读条完成（调用方负责消费该判定：移除雕像 / 派发事件）。
 *  j —— 判定对象（进度/持有者写回它本身，字段名可用 pKey/hKey 覆盖，便于沿用既有的 xxxProgress 字段）
 *  x, y —— 判定中心；radius —— 绘制半径；dt —— 帧时长；channel —— 需要的读条秒数（不传则取 j.channel） */
function judgeChannel(j, x, y, radius, dt, channel, pKey, hKey, decay) {
  const pk = pKey || "progress", hk = hKey || "holder";
  const need = channel != null ? channel : j.channel;
  const holder = heroInCircle(x, y, radius);
  j[hk] = holder || null;                      // 同一判定同时只有一个持有者（原子占用）
  if (holder) {
    j[pk] = (j[pk] || 0) + dt;
    if (j[pk] >= need) { j[pk] = 0; j[hk] = null; return true; }   // 完成即消费，判定不可被第二个英雄重复触发
  } else if ((j[pk] || 0) > 0) {
    j[pk] = Math.max(0, j[pk] - dt * (decay === undefined ? 1.2 : decay));
  }
  return false;
}
function heroTakeDamage(w, h, dmg, ignoreDef) {
  // 受击打断：撤离读条归零（雕像保留）；裂缝返回信标读条归零
  const r = G.run;
  if (r && r.extractChanneling) {
    r.extractChanneling = false; r.extractProgress = 0; r.extractHolder = null;
    UI.toast("撤离读条被打断！（雕像仍在原地，重新站回圈内即可继续）", "bad");
  }
  if (w && w.kind === "rift" && w.returnProgress > 0) { w.returnProgress = 0; UI.toast("返回信标读条被打断！", "bad"); }
  // 21.17 深渊撤离点受击打断（🅑 独立区块，单行调用）：读条归零、撤离点保留可重读
  if (typeof abyssExtractInterrupt === "function") abyssExtractInterrupt();
  if (h === G.player) { G.player.takeDamage(w, dmg, ignoreDef); return; }
  // ignoreDef = true（21.1 毒圈比例伤害）：不走防御减免，扣血量即传入值
  const real = ignoreDef ? Math.max(1, Math.round(dmg)) : Math.max(1, Math.round(dmg - companionStats(h).def));
  if (G.inEndless) h.dmgTaken = (h.dmgTaken || 0) + real;   // 21.20 深渊逐角色承伤统计
  h.hp -= real;
  if (G.run.stats) G.run.stats.dmgTaken += real;
  spawnFloat(h.x, h.y - 30, `-${real}`, "#ff9a7f");
  if (h.hp <= 0) { h.hp = 0; h.alive = false; SFX.play("death"); UI.toast(`队友「${h.name}」倒下了！`, "bad"); }
}
/* ---------- 多角色组队：蛇形尾迹跟随（贪吃蛇模型） ----------
 * 队长是蛇头，历史移动路径记录为尾迹（按距离采样）；队友 i 目标点 =
 * 沿尾迹回溯 (i+1)*间距 的历史位置 + 垂直于该段路径的横向微偏移。
 * 优点：沿真实路径走，转弯不抖、不卡障碍；比虚拟编队点更稳。
 */
const TRAIL_STEP = CFG.team.follow.trailStep;    // 尾迹采样间距（px）：队长每移动 5px 记一个点
const TEAM_DEPTH = CFG.team.follow.depth;        // 队友纵向间距（px）
// 第 i 位队友的横向错开：-18,+18,-36,+36,-54,... 左右交替、幅度递增，支持任意人数
function teamLateral(i) {
  const b = CFG.team.follow.lateralBase;
  return (i % 2 === 0 ? -1 : 1) * (Math.floor(i / 2) + 1) * b;
}
function trailPush(w) {
  const p = G.player;
  const t = w.teamTrail || (w.teamTrail = { pts: [{ x: p.x, y: p.y }], lastX: p.x, lastY: p.y });
  const d = U.dist(p.x, p.y, t.lastX, t.lastY);
  if (d >= TRAIL_STEP) {
    t.pts.push({ x: p.x, y: p.y });
    t.lastX = p.x; t.lastY = p.y;
    if (t.pts.length > 400) t.pts.shift();   // 上限保护（400 点 ≈ 2000px 路径，足够 5+ 人）
  }
  return t;
}
// 开局/进图时预铺尾迹：从队长位置沿 -dir 方向铺一条直线，保证每位队友立即获得正确纵深
function seedTrail(w, ux, uy) {
  if (!w || !G.player) return;
  const p = G.player;
  const n = Math.ceil((TEAM_DEPTH * (CFG.team.maxSize + 2) + 80) / TRAIL_STEP);
  const pts = [];
  for (let k = n; k >= 1; k--) pts.push({ x: p.x - ux * TRAIL_STEP * k, y: p.y - uy * TRAIL_STEP * k });
  pts.push({ x: p.x, y: p.y });
  w.teamTrail = { pts, lastX: p.x, lastY: p.y };
}
// 沿尾迹从队头回溯 depth 距离的目标点（含横向错开）；尾迹不足时沿最旧段方向直线外推
function trailTarget(trail, depth, lateral) {
  const pts = trail.pts;
  let ax = pts[pts.length - 1].x, ay = pts[pts.length - 1].y;
  let need = depth, dirx = 0, diry = 1;      // dir 兜底：向下
  for (let i = pts.length - 2; i >= 0 && need > 0; i--) {
    const dx = pts[i].x - ax, dy = pts[i].y - ay;
    const seg = Math.hypot(dx, dy);
    if (seg <= 0) { ax = pts[i].x; ay = pts[i].y; continue; }
    dirx = dx / seg; diry = dy / seg;
    if (seg >= need) { ax += dirx * need; ay += diry * need; need = 0; break; }
    ax = pts[i].x; ay = pts[i].y; need -= seg;
  }
  if (need > 0) { ax += dirx * need; ay += diry * need; }   // 尾迹尽头：沿最旧段方向外推
  const l = Math.hypot(dirx, diry) || 1;
  return { x: ax + (-diry / l) * lateral, y: ay + (dirx / l) * lateral };
}
function snapCompanions(world) {
  if (!G.run || !G.run.companions) return;
  const w = world || G.activeWorld || G.mainWorld;
  if (!w) return;
  const trail = trailPush(w);
  G.run.companions.forEach((c, i) => {
    const t = trailTarget(trail, (i + 1) * TEAM_DEPTH, teamLateral(i));
    c.x = U.clamp(t.x, 20, w.w - 20); c.y = U.clamp(t.y, 20, w.h - 20);
  });
}
function updateCompanions(w, dt) {
  const r = G.run;
  if (!r || !r.companions) return;
  const trail = trailPush(w);
  r.companions.forEach((c, i) => {
    if (!c.alive) return;
    // 属性与队长同源：局内等级成长 + 武器栏装备加成（16.5 武器栏对全队生效）
    const st = companionStats(c);
    if (c.hpMax !== st.hpMax) { c.hpMax = st.hpMax; if (c.hp > c.hpMax) c.hp = c.hpMax; }
    if (c.energyMax !== st.energyMax) { c.energyMax = st.energyMax; if (c.energy > c.energyMax) c.energy = c.energyMax; }
    c.regen = st.regen;
    c.cdMul = st.cdMul; c.lifesteal = st.lifesteal;   // 冷却缩减 / 吸血：属性卡与雕像 Buff 全队生效
    // 蛇形跟随：目标 = 队长尾迹上 (i+1)*DEPTH 深度处的历史点（沿真实路径）
    const t = trailTarget(trail, (i + 1) * TEAM_DEPTH, teamLateral(i));
    const tx = U.clamp(t.x, 20, w.w - 20), ty = U.clamp(t.y, 20, w.h - 20);
    const d = U.dist(c.x, c.y, tx, ty);
    if (d > 6) {
      const spd = st.spd * 1.15;
      c._mdx = (tx - c.x) / d * spd * dt; c._mdy = (ty - c.y) / d * spd * dt;   // 本帧位移（切向滑动用）
      c.x += (tx - c.x) / d * spd * dt; c.y += (ty - c.y) / d * spd * dt;
      if (Math.abs(tx - c.x) > 4) c.faceDir = tx > c.x ? 1 : -1;
      resolveObstacles(c, w, { x: tx, y: ty });   // 偏置 = 跟随目标点（被挡时沿墙绕向队尾点位）
    }
    // 自动普攻（武器栏内的武器模块对全队生效：技能值取 recomputeWeapon 解析出的 c.skills）
    // 🔴 19.1 普攻移除：队友与队长一致，唯一输出 = 主动技能（c.fireTimer 已随之退役）
    // 主动技能（技能石）：与队长同一套 SkillSystem。19.3 冷却制——队友**不再有独立能量池**，
    // 释放条件只剩「冷却好 + 有目标」（措峰 skillStagger 逻辑保留，见 createRun）。
    // 能量字段（c.energy/energyMax/regen）条目保留但不参与门槛、也不再恢复。
    c.skillTimer = (c.skillTimer || 0) - dt;
    const cs = c.skills && c.skills.skill;
    const tgt = nearestMonster(w, c.x, c.y);
    if (CFG.team.aiSkill !== false && tgt && cs && c.skillTimer <= 0) {
      SkillSystem.cast(w, c, cs, tgt, { side: "player", isSkill: true, atk: st.atk });
      c.skillTimer = cs.cd * st.cdMul;
      c.faceDir = tgt.x > c.x ? 1 : -1;
    }
  });
}

/* ---------- 召唤物：无人机（会被敌人攻击；环绕召唤者 + 自动攻击） ----------
 * 归属规则（已定）：**谁的技能就随谁** —— 无人机环绕自己的召唤者（owner），
 * 召唤者倒下也**不做「倒下即回收」**：无人机留在场上继续作战，只是改为跟随队长（保证不乱飘）。 */
class Drone {
  constructor(x, y, orbitA, hp, atk, fireCd, orbit, owner = null, repair = false) {
    this.isDrone = true;
    this.x = x; this.y = y; this.r = 12;
    this.hpMax = hp; this.hp = hp;
    this.atk = atk; this.fireCd = fireCd;
    this.orbitA = orbitA; this.orbit = orbit;
    this.owner = owner || G.player;   // 归属：每个成员有**自己的召唤物池**（环绕召唤者）
    this.fireTimer = U.rand(0.2, 0.6);
    // 🔴 19.2 维修型无人机：照常开火 + 附加持续修理（数值见 CFG.skills2.repairDrone）
    this.repair = repair === true;
    this.repairTimer = this.repair ? CFG.skills2.repairDrone.repairInterval : 0;
  }
  update(w, dt) {
    // 环绕**召唤者**缓慢公转（召唤者倒下也不回收，改为跟随队长继续作战），脱离轨道时平滑归位
    const o = this.owner;
    const p = (o && (o === G.player || o.alive)) ? o : G.player;
    if (p) {
      this.orbitA += dt * 0.6;
      const tx = p.x + Math.cos(this.orbitA) * this.orbit;
      const ty = p.y + Math.sin(this.orbitA) * this.orbit;
      const d = U.dist(this.x, this.y, tx, ty);
      if (d > 4) {
        const spd = 340;
        this.x += (tx - this.x) / d * spd * dt;
        this.y += (ty - this.y) / d * spd * dt;
      }
    }
    // 自动攻击最近怪物（伤害归属召唤者 → 吸血回召唤者自己的血）
    this.fireTimer -= dt;
    const tgt = nearestMonster(w, this.x, this.y);
    if (tgt && this.fireTimer <= 0) {
      const ang = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      w.playerBullets.push(new Bullet(this.x, this.y, ang, 560, this.atk, "player", 0, 0, 0, false, this.owner));
      this.fireTimer = this.fireCd;
    }
    // 维修型（19.2 恢复定位）：每 repairInterval 秒为 HP 比例最低的己方成员回复 healPerSec 点（不超 hpMax）
    if (this.repair) {
      this.repairTimer -= dt;
      if (this.repairTimer <= 0) {
        this.repairTimer += CFG.skills2.repairDrone.repairInterval;
        repairDroneTick();
      }
    }
  }
}
/* 维修无人机结算：选出**当前 HP 比例最低**的己方成员（队长 + 存活队友），回复 healPerSec（夹紧不超 hpMax）。 */
function repairDroneTick() {
  const r = G.run;
  if (!r || CFG.skills2.repairDrone.healPerSec <= 0) return;
  const cands = [];
  const p = G.player;
  if (p && r.hp < r.hpMax) cands.push({ get hp() { return r.hp; }, hpMax: r.hpMax, add: (v) => { r.hp = Math.min(r.hpMax, r.hp + v); },
    x: () => p.x, y: () => p.y });
  for (const c of (r.companions || [])) {
    if (!c.alive || c.hp >= c.hpMax) continue;
    cands.push({ get hp() { return c.hp; }, hpMax: c.hpMax, add: (v) => { c.hp = Math.min(c.hpMax, c.hp + v); },
      x: () => c.x, y: () => c.y });
  }
  if (!cands.length) return;   // 全员满血：不治疗
  let best = cands[0], bestFrac = best.hp / best.hpMax;
  for (const h of cands) { const f = h.hp / h.hpMax; if (f < bestFrac) { best = h; bestFrac = f; } }
  const heal = Math.min(CFG.skills2.repairDrone.healPerSec, best.hpMax - best.hp);
  if (heal <= 0) return;
  best.add(heal);
  spawnFloat(best.x(), best.y() - 30, `+${Math.round(heal)}`, "#7de08a");
}
function droneTakeDamage(w, d, dmg) {
  d.hp -= Math.max(1, Math.round(dmg));
  spawnFloat(d.x, d.y - 20, `-${Math.max(1, Math.round(dmg))}`, "#ff9a7f");
  if (d.hp <= 0) { d.hp = 0; SFX.play("death"); UI.toast("无人机被击毁！", "bad"); }
}

/* ---------- 敌方目标（英雄 + 存活无人机）：怪物索敌与伤害统一入口 ----------
 * w 参数（可省略，省略时不筛世界）：无人机带 world 归属，只作为**同世界**怪物的目标——
 * 否则主地图的无人机会被裂缝/工匠世界的怪物当作目标去打（坐标都不在同一张图上）。 */
function enemyTargets(w) {
  // 21.14 GC 优化：复用 _targetScratch（不再展开成新数组 + filter 新数组）。
  // 注意：先拷贝 aliveHeroes 内容（其用 _heroScratch，与 _targetScratch 是不同数组，无冲突），
  //       再追加存活且同世界的无人机——成员顺序与旧实现逐位一致。
  const arr = _targetScratch;
  arr.length = 0;
  const hs = aliveHeroes();
  for (let i = 0; i < hs.length; i++) arr.push(hs[i]);
  const drones = (G.run && G.run.drones) || [];
  for (let i = 0; i < drones.length; i++) {
    const d = drones[i];
    if (d.hp > 0 && (!w || !d.world || d.world === w)) arr.push(d);
  }
  return arr;
}
function nearestTarget(w, x, y) {
  let best = null, bd = Infinity;
  for (const t of enemyTargets(w)) {
    const d = U.dist(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best || G.player;
}
function targetTakeDamage(w, t, dmg) {
  if (t.isDrone) droneTakeDamage(w, t, dmg);
  else heroTakeDamage(w, t, dmg);
}
/* ---------- 吸血结算（属性卡「吸血」+ 增益「汲血」，小队全体成员各自独立）----------
 * owner = 伤害来源：队长 G.player 或队友 companion（各自回自己的血）。
 * 未记 owner（无人机 / 陷阱等召唤物）时回落到队长，与旧行为一致。
 * 注：AOE 爆炸（explode）不参与直击吸血，与队长既有口径一致。 */
function applyLifesteal(owner, dmg) {
  const r = G.run;
  if (!r || !(dmg > 0)) return;
  const src = owner || G.player;
  if (src === G.player || !src.isCompanion) {
    if (r.lifesteal > 0) r.hp = Math.min(r.hpMax, r.hp + dmg * r.lifesteal);
  } else if (src.hp > 0 && (src.lifesteal || 0) > 0) {
    src.hp = Math.min(src.hpMax, src.hp + dmg * src.lifesteal);
  }
}

class Bullet {
  constructor(x, y, ang, spd, dmg, side, pierce = 0, bounce = 0, aoe = 0, isSkill = false, owner = null, behavior = null) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.dmg = dmg; this.side = side; this.pierce = pierce; this.bounce = bounce;
    this.aoe = aoe; this.isSkill = isSkill;
    this.owner = owner;                       // 发射者（吸血归属：队长 / 队友各自独立）
    this.behavior = behavior || null;         // 行为芯片（19.12）：{ type, value }；无则 null（行为护栏）
    if (this.behavior && this.behavior.type === "bounce") this.bounce = this.behavior.value;   // 折射：复用 bounce 字段链路
    this.dead = false; this.life = 2.2; this.hitSet = new Set();
  }
  update(w, dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    // 撞墙
    if (this.x < 0 || this.x > w.w || this.y < 0 || this.y > w.h || this.life <= 0) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side, this.owner);
      this.dead = true; return;
    }
    if (blockedByObstacle(w, this.x, this.y)) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side, this.owner);
      this.dead = true; return;
    }
    // 命中判定
    if (this.side === "player") {
      const cands = w.monsterHash.query(this.x, this.y, 30, _tmpArr);
      for (const m of cands) {
        if (m.dead || this.hitSet.has(m)) continue;
        if (U.dist(this.x, this.y, m.x, m.y) < m.r + 6) {
          this.hitSet.add(m);
          if (this.aoe > 0) { explode(w, this.x, this.y, this.aoe, this.dmg, this.side, this.owner); this.dead = true; return; }
          damageMonster(w, m, this.dmg, this);
          applyLifesteal(this.owner, this.dmg);   // 吸血归属发射者（全队各自独立）
          applyBulletHitBehavior(w, this, m);     // 行为芯片（19.12）：burn 灼烧 / chain 链锁（bounce 走下方字段链路）
          if (this.pierce > 0) { this.pierce--; }
          else if (this.bounce > 0) {
            this.bounce--;
            const next = nearestMonster(w, this.x, this.y, m);
            if (next) {
              const ang = Math.atan2(next.y - this.y, next.x - this.x);
              const spd = Math.hypot(this.vx, this.vy);
              this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
            } else { this.dead = true; }
          } else { this.dead = true; }
          return;
        }
      }
    } else {
      for (const h of aliveHeroes()) {
        if (U.dist(this.x, this.y, h.x, h.y) < h.r + 6) {
          heroTakeDamage(w, h, this.dmg);
          spawnBurst(this.x, this.y, "#c79bff", 6);
          this.dead = true;
          break;
        }
      }
      // 敌方子弹也会击中召唤物（无人机可被远程攻击；只打本世界的无人机）
      if (!this.dead && G.run && G.run.drones) {
        for (const d of G.run.drones) {
          if (d.hp > 0 && (!d.world || d.world === w) && U.dist(this.x, this.y, d.x, d.y) < d.r + 6) {
            droneTakeDamage(w, d, this.dmg);
            spawnBurst(this.x, this.y, "#c79bff", 6);
            this.dead = true;
            break;
          }
        }
      }
    }
  }
}

class Monster {
  constructor(defId, x, y, lv) {
    const d = CFG.monsters[defId];
    this.defId = defId; this.d = d; this.x = x; this.y = y;
    this.r = d.radius * (CFG.monsterSizeMul || 1);   // 体积倍数：碰撞与贴图同步
    const lvMul = 1 + (lv - 1) * 0.12;
    const cu = G.run && G.run.curse;   // 诅咒道具（待细化36）：向新生成的敌人附加属性修改器
    // 邪神雕像倍率不在此处套用（区分 BOSS/精英/小怪类别），由生成方调用 applyMonsterScale
    this.hpMax = d.hp * lvMul * (cu ? cu.hpMul : 1); this.hp = this.hpMax;
    this.atk = d.atk * lvMul * (cu ? cu.atkMul : 1);
    this.effSpd = d.spd * (cu ? cu.spdMul : 1);   // 实际移速（基础 × 诅咒附加的移速修改器）
    this.ak = monsterAttackSkill(d, lv || 1);     // 攻击技能（技能表 4e 视图）
    this.dead = false;
    this.touchTimer = 0; this.fireTimer = U.rand(0.5, this.ak.fireCd);
    this.state = "chase"; this.stateT = 0; this.dashVx = 0; this.dashVy = 0;
    this.boomTimer = this.ak.boomCd || 0; this.warnT = 0; this.minionTimer = this.ak.minionCd || 0;
    // ---- Boss 阶段机 + 弹幕循环（第十七章；非 Boss 时 phases=null，不影响其它 AI）----
    this.lv = lv || 1;                                  // 怪物等级（弹幕技能条目按等级结算）
    this.phases = (d.type === "boss" && d.phases) ? d.phases : null;
    this.phaseIdx = 0; this.phaseInvulnT = 0; this.bossClock = 0;
    this.patternTimer = 1.5;                            // 开场稍候再放第一招（给玩家反应时间）
    this.patternWarnT = 0; this.patternIdx = 0; this.warnP = null;
    this.spiralAng = 0; this.aimAng = 0;
    this.sprite = G.sprites[spriteFor(defId) || d.sprite || "enemy00"];   // 20.4 线C：优先按 defId 映射新精灵表（NM/ED→enemyNN），回落配表显式键，再回落默认色块路径；Boss(BS) spriteFor→null 走旧 enemy22
    this.flashT = 0;
  }
  /** Boss 当前阶段：phases 按血量比例降序，取**最后一个满足**的档位（1.0 = 满血即生效）。 */
  bossPhase() {
    const ps = this.phases;
    if (!ps || !ps.length) return null;
    const ratio = this.hpMax > 0 ? this.hp / this.hpMax : 0;
    let idx = 0;
    for (let i = 0; i < ps.length; i++) if (ratio <= ps[i].hp) idx = i;
    return { idx, skills: ps[idx].skills || [] };
  }
  /** 阶段推进（17.3）：**加机制**（换招式池）而不是加血加攻；转换时 Boss 无敌 + 停手，
   *  **不清屏**（玩家已打出的弹幕/召唤物照常存在），给双方一个呼吸窗口。 */
  bossPhaseTick() {
    const cur = this.bossPhase();
    if (!cur || cur.idx <= this.phaseIdx) return;
    this.phaseIdx = cur.idx;
    this.phaseInvulnT = CFG.boss.phaseInvuln;
    this.patternWarnT = 0; this.warnP = null;
    this.boomTimer = Math.max(this.boomTimer, 2.2);      // 阶段衔接期先不接爆炸/召唤，避免"无敌期间被罚站"
    this.minionTimer = Math.max(this.minionTimer, 3.0);
    UI.toast(`${this.d.name} 进入第 ${this.phaseIdx + 1} 阶段！`, "bad");
    SFX.play("boom");
  }
  /** 弹幕循环：电报（白圈）→ 发射 → 冷却。warnTime = 0 的招式（螺旋）不逐发电报，直接连发。 */
  bossPatternTick(w, dt) {
    const cur = this.bossPhase();
    if (!cur || !cur.skills.length) return;
    if (this.patternWarnT > 0) {                          // 电报中：到点才真正发射
      this.patternWarnT -= dt;
      if (this.patternWarnT <= 0) { this.patternWarnT = 0; this.bossFire(w, this.warnP); }
      return;
    }
    if (this.patternTimer > 0) { this.patternTimer -= dt; return; }
    const id = cur.skills[this.patternIdx % cur.skills.length];   // 阶段内招式轮转
    const p = skillEntry(id, this.lv) || {};
    const warn = p.warnTime != null ? p.warnTime : CFG.boss.warnTime;
    if (warn > 0) { this.warnP = p; this.patternWarnT = warn; }   // 白圈亮起 → 下一帧起倒计时
    else this.bossFire(w, p);
  }
  /** 真正发射：更新瞄准角与螺旋相位 → 展开形状 → 交护栏裁剪 → 重置冷却。 */
  bossFire(w, p) {
    if (!p || !p.pattern) { this.patternTimer = CFG.boss.patternCd; return 0; }
    const tgt = nearestTarget(w, this.x, this.y);
    this.aimAng = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    this.spiralAng += (p.spin || 0);                      // 螺旋每次发射整体旋转（正反由 spin 符号决定）
    const n = PatternSystem.emit(w, this, p, this.aimAng, this.spiralAng);
    this.patternIdx++;
    this.patternTimer = p.cd != null ? p.cd : CFG.boss.patternCd;
    return n;
  }
  update(w, dt) {
    this.flashT -= dt;
    if (monsterBurnTick(this, w, dt)) return;   // 行为芯片（19.12）：燃蚀灼烧结算（致死则跳过本帧 AI）
    if (extractWaveSiegeTick(this, w, dt)) return;   // 方向4：撤离波次怪读条期间围攻雕像护盾（不伤害英雄）
    const px0 = this.x, py0 = this.y;   // 帧初位置（供 resolveObstacles 计算切向滑动，防卡障碍）
    const p = G.player;
    const distP = U.dist(this.x, this.y, p.x, p.y);
    const ak = this.ak;   // 攻击技能参数（来自技能表 4e 视图，见 monsterAttackSkill）
    switch (this.d.type) {
      case "melee": {
        const h = nearestTarget(w, this.x, this.y);
        const ang = Math.atan2(h.y - this.y, h.x - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        this.touchTimer -= dt;
        if (U.dist(this.x, this.y, h.x, h.y) < this.r + h.r + 2 && this.touchTimer <= 0) {
          targetTakeDamage(w, h, this.atk * ak.atkMul); this.touchTimer = ak.touchCd;
        }
        break;
      }
      case "ranged": {
        const h = nearestTarget(w, this.x, this.y);
        const ang = Math.atan2(h.y - this.y, h.x - this.x);
        const distH = U.dist(this.x, this.y, h.x, h.y);
        const los = losClear(w, this.x, this.y, h.x, h.y);   // 视线：障碍物挡弹道，没视线不开火
        if (distH > ak.keepDist + 40) {
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
        } else if (distH < ak.keepDist - 60) {
          this.x -= Math.cos(ang) * this.effSpd * 0.7 * dt; this.y -= Math.sin(ang) * this.effSpd * 0.7 * dt;
        } else if (!los) {
          // 距离合适但被障碍挡住：沿切向绕行抢视线（而不是站桩朝障碍物倾泻弹药）
          if (this.strafeSide == null) this.strafeSide = Math.random() < 0.5 ? 1 : -1;
          this.x += -Math.sin(ang) * this.strafeSide * this.effSpd * 0.6 * dt;
          this.y += Math.cos(ang) * this.strafeSide * this.effSpd * 0.6 * dt;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && distH < 620 && los) {
          this.fireTimer = ak.fireCd;
          w.enemyBullets.push(new Bullet(this.x, this.y, ang, ak.bulletSpd, this.atk * ak.atkMul, "enemy"));
        }
        break;
      }
      case "charger": {
        const h = nearestTarget(w, this.x, this.y);
        const distH = U.dist(this.x, this.y, h.x, h.y);
        this.stateT -= dt;
        if (this.state === "chase") {
          const ang = Math.atan2(h.y - this.y, h.x - this.x);
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
          if (distH < ak.chargeRange && this.stateT <= 0) { this.state = "telegraph"; this.stateT = ak.telegraph; }
        } else if (this.state === "telegraph") {
          if (this.stateT <= 0) {
            const ang = Math.atan2(h.y - this.y, h.x - this.x);
            this.dashVx = Math.cos(ang) * ak.dashSpd; this.dashVy = Math.sin(ang) * ak.dashSpd;
            this.state = "dash"; this.stateT = ak.dashTime;
          }
        } else if (this.state === "dash") {
          this.x += this.dashVx * dt; this.y += this.dashVy * dt;
          if (distH < this.r + h.r + 2) { targetTakeDamage(w, h, this.atk * ak.atkMul); this.state = "chase"; this.stateT = ak.chargeCd; }
          if (this.stateT <= 0) { this.state = "chase"; this.stateT = ak.chargeCd; }
        }
        break;
      }
      case "boss": {
        this.bossClock += dt;                               // Boss 自身时钟（弹幕预算窗口用，不依赖全局时间）
        this.bossPhaseTick();                               // 阶段机：血量分段 → 换招式池 + 无敌停手
        if (this.phaseInvulnT > 0) { this.phaseInvulnT -= dt; break; }   // 无敌期：不走位、不出招、不吃伤害
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        // 弹幕招式（第十七章 17.4）：电报 → 发射 → 冷却，招式池由当前阶段决定
        this.bossPatternTick(w, dt);
        bossLaserTick(w, this, dt);   // 激光招式（17.7 第 3 步）：未配 laserSkills 时为 no-op（行为等价）
        // 圆形范围爆炸（预警 → 爆炸，命中范围内所有英雄）
        this.boomTimer -= dt;
        if (this.warnT > 0) {
          this.warnT -= dt;
          if (this.warnT <= 0) {
            for (const h of enemyTargets(w)) {
              if (U.dist(this.x, this.y, h.x, h.y) <= ak.boomRadius) targetTakeDamage(w, h, this.atk * ak.atkMul);
            }
            spawnBurst(this.x, this.y, "#e5484d", 40, ak.boomRadius);
            this.boomTimer = ak.boomCd;
          }
        } else if (this.boomTimer <= 0) {
          this.warnT = ak.boomWarn;
        }
        // 刷小怪（召唤技能由技能表的 minionId / minionWave 决定）
        this.minionTimer -= dt;
        if (this.minionTimer <= 0) {
          this.minionTimer = ak.minionCd;
          for (let i = 0; i < ak.minionWave; i++) {
            if (w.monsters.length < monsterCap()) {
              const a = U.rand(0, Math.PI * 2);
              w.spawnMonster(ak.minionId, this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90);
            }
          }
        }
        this.touchTimer -= dt;
        const hb = nearestTarget(w, this.x, this.y);
        if (U.dist(this.x, this.y, hb.x, hb.y) < this.r + hb.r && this.touchTimer <= 0) {
          targetTakeDamage(w, hb, this.atk * ak.touchMul); this.touchTimer = ak.touchCd;
        }
        break;
      }
    }
    // 障碍物推挤（带目标偏置：被挡时沿墙向目标侧绕行，防卡死）
    this._mdx = this.x - px0; this._mdy = this.y - py0;
    resolveObstacles(this, w, nearestTarget(w, this.x, this.y));
    this.x = U.clamp(this.x, this.r, w.w - this.r);
    this.y = U.clamp(this.y, this.r, w.h - this.r);
  }
}

/* ============ 世界 ============ */
class World {
  constructor(w, h, isMain, kind) {
    this.w = w; this.h = h; this.isMain = isMain; this.kind = kind || (isMain ? "main" : "artisan");
    this.obstacles = [];
    this.monsters = []; this.playerBullets = []; this.enemyBullets = [];
    this.lasers = [];   // Boss 激光实体（17.7 第 3 步）：独立于弹道预算，走 laserCap 上限
    this.groundChests = []; this.altars = []; this.pickups = [];
    this.monsterHash = new SpatialHash(SpatialHash.autoCell(0));   // 21.14 自适应 cell 初值（每帧按实际数量 retune）
    this.circles = []; this.spawnTimer = 0;
    this.boss = null;
    this.npc = null; this.exitBeacon = null; this.returnBeacon = null;
    // 子地图开场冻结（5.1）：>0 时全员静止 + 全员无敌，只推进倒计时；0 = 正常战斗
    this.freezeTimer = 0;
    // 子地图交互读条进度：显式初始化，避免"未跑过 update 时为 undefined"造成的取值歧义
    this.returnProgress = 0; this.npcProgress = 0; this.exitProgress = 0;
    if (isMain) this.setupMain();
    else if (this.kind === "rift") this.setupRift();
    else if (this.kind === "city") this.setupCity();
    else this.setupArtisan();
  }
  setupMain() {
    const lv = G.levelCfg;
    // 固定内部障碍物（少量，Boss 爆炸不被阻挡；避开中心出生点）
    const obs = [
      { x: 360, y: 260, w: 220, h: 70 }, { x: 1340, y: 260, w: 220, h: 70 },
      { x: 360, y: 760, w: 220, h: 70 }, { x: 1340, y: 760, w: 220, h: 70 },
      { x: 560, y: 620, w: 120, h: 120 }, { x: 1240, y: 340, w: 120, h: 120 },
    ];
    this.obstacles = obs;
    // 随机圆摆放（不重叠检测）
    for (const c of lv.circles) {
      const tpl = CFG.spawnCircles[c.tpl];
      for (let i = 0; i < c.count; i++) {
        let pos, tries = 0;
        do {
          pos = { x: U.rand(220, this.w - 220), y: U.rand(160, this.h - 160) };
          tries++;
        } while (tries < 40 && this.circles.some(o => U.dist(pos.x, pos.y, o.x, o.y) < tpl.radius * 2 + 60));
        this.circles.push({ ...tpl, x: pos.x, y: pos.y, timer: U.rand(0.5, 2.5) });
      }
    }
    // 祭坛随机刷出（按权重，不与障碍/圆重叠）
    const pool = Object.entries(CFG.altars).filter(([k, a]) => a.weight > 0);
    const weights = {}; pool.forEach(([k, a]) => weights[k] = a.weight);
    const count = 5;
    for (let i = 0; i < count; i++) {
      const id = U.weightedPick(weights);
      const pos = this.findFreeSpot(100);
      if (pos) this.altars.push({ cfg: CFG.altars[id], x: pos.x, y: pos.y, id });
    }
    // 初始一波怪
    for (const c of this.circles) this.spawnWave(c);
    initLevelMechanics(this);   // 毒圈 + 补给点（B 线独立区块）：初始化本关机制状态
    // 开场冻结（仅主关卡，规则同裂缝 5.1）：全员静止 + 全员无敌，红字 3/2/1 倒计时
    // 首波怪已投放完毕，冻结期间 World.update 提前 return → 怪物/子弹/祭坛/拾取全部暂停，不会被打
    this.freezeTimer = CFG.levelFreeze.freezeTime;
  }
  setupArtisan() {
    // 工匠世界：无敌人安全区；NPC + 固定返回出口
    this.obstacles = [];
    this.npc = { x: this.w / 2, y: this.h / 2 - 60 };
    this.exitBeacon = { x: this.w / 2, y: this.h - 130 };
  }
  setupCity() {
    // 游戏主城（Hub）：玩家形象行走的安全区；NPC 环绕中央广场 + 顶部出征传送门
    // 装饰性建筑（不挡路的小花坛，避开 NPC 与传送门）
    this.obstacles = [
      { x: this.w * 0.5 - 90, y: this.h * 0.5 - 26, w: 180, h: 52 },   // 中央广场喷泉台
    ];
    const c = CFG.city;
    this.cityNpcs = c.npcs.map(n => ({ ...n, x: n.fx * this.w, y: n.fy * this.h }));
    this.portal = { name: c.portal.name, x: this.w / 2, y: 90, radius: c.portal.radius, channel: c.portal.channel };
    this.seasonPortal = c.seasonPortal ? { name: c.seasonPortal.name, x: this.w * 0.82, y: 90, radius: c.seasonPortal.radius, channel: c.seasonPortal.channel } : null;
    this.portalProgress = 0;
    setupAbyssPortal(this);   // 21.15 深渊之门初始化（末尾区块，单行调用）
  }
  setupRift() {
    // 空间裂缝子地图（5.1）：一次性投放战斗场景
    // 流程：开场冻结 freezeTime 秒（全员静止+无敌，红字倒计时）→ 一次性投放任务全部敌人 + 独立精英
    //       → 之后不再增援（任务完成/失败均不新增）→ 剩余敌人留场可继续清剿 / 走返回信标返回
    this.obstacles = [
      { x: U.rand(300, 500), y: U.rand(200, 400), w: U.rand(150, 260), h: 70 },
      { x: U.rand(this.w - 560, this.w - 360), y: U.rand(200, 400), w: U.rand(150, 260), h: 70 },
      { x: U.rand(300, 500), y: U.rand(this.h - 420, this.h - 240), w: U.rand(120, 220), h: 70 },
      { x: U.rand(this.w - 520, this.w - 360), y: U.rand(this.h - 420, this.h - 240), w: 120, h: 120 },
    ];
    // 两个投放区域（复用主关卡首个圆模板）：不再作为持续刷新点，只作一次性投放的敌人散布中心
    const tpl = CFG.spawnCircles[Object.keys(CFG.spawnCircles)[0]];
    this.circles = [
      { ...tpl, x: this.w * 0.3, y: this.h * 0.35, timer: 1.0 },
      { ...tpl, x: this.w * 0.7, y: this.h * 0.65, timer: 2.5 },
    ];
    // 返回信标：地上随机刷出（远离玩家出生点）——先定信标，投放敌人时据此避让
    this.returnBeacon = this.findFreeSpot(400, 90, 90) || { x: this.w / 2, y: this.h - 200 };
    // ① 一次性投放任务所需的全部小怪
    this.spawnRiftBatch();
    // ② 独立精英：随敌群一次性投放（数量 = eliteBase × "精英数量"倍率）；静默，避免连刷多条提示
    for (let i = 0, en = this.eliteTargetCount(); i < en; i++) this.spawnElite(true);
    // ③ 开场冻结：全员静止 + 全员无敌（红字倒计时由 render 绘制，倒计时归零后才开战）
    this.freezeTimer = CFG.rift.freezeTime;
  }
  /* 裂缝投放点采样：投放区域内随机取点（避开障碍 / 玩家 / 返回信标 / 祭坛），失败退回全图 findFreeSpot */
  riftSpawnSpot(c) {
    const p = G.player || { x: this.w / 2, y: this.h / 2 }, b = this.returnBeacon;
    for (let t = 0; t < 40; t++) {
      const a = U.rand(0, Math.PI * 2), rr = U.rand(0, c.radius);
      const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr;
      if (x < 60 || x > this.w - 60 || y < 60 || y > this.h - 60) continue;
      if (blockedByObstacle(this, x, y)) continue;
      if (U.dist(x, y, p.x, p.y) < CFG.spawnRules.minDistFromPlayer) continue;
      if (b && U.dist(x, y, b.x, b.y) < 160) continue;
      if (this.altars.some(al => U.dist(x, y, al.x, al.y) < 150)) continue;
      return { x, y };
    }
    return this.findFreeSpot(CFG.spawnRules.minDistFromPlayer);
  }
  /* 一次性投放任务所需的全部小怪（数量 = 任务 spawnCount）
   * 子地图不按解锁进度过滤：裂缝是纯战斗场景，怪物池全量开放（否则低进度下只剩一种怪） */
  spawnRiftBatch() {
    const t = G.run && G.run.riftTask;
    // 无任务时用兜底投放数（直接构造子地图的场景，如单元测试）
    const total = Math.max(0, (t && t.spawnCount) || CFG.rift.defaultSpawnCount);
    if (!total) return 0;
    const pool = parseWeightPool(CFG.rift.spawnPool);
    const circles = this.circles.length ? this.circles : [{ x: this.w / 2, y: this.h / 2, radius: 240 }];
    let n = 0, guard = 0;
    // 采样可能失败（空间被障碍/信标挤占），多给几轮重试直到投满或达到保险次数
    while (n < total && guard < total * 5) {
      guard++;
      const pos = this.riftSpawnSpot(circles[n % circles.length]);
      if (!pos) continue;
      if (this.spawnMonster(U.weightedPick(pool), pos.x, pos.y)) n++;
    }
    return n;
  }
  spawnMonster(defId, x, y) {
    if (this.monsters.length >= monsterCap()) return null;
    x = U.clamp(x, 40, this.w - 40); y = U.clamp(y, 40, this.h - 40);
    const lv = (G.levelCfg.monsterLevel || 1);
    const m = new Monster(defId, x, y, lv);
    // 词缀转化（旧机制·配置开关）：ED 精英与 BOSS 不参与转化
    if (m.d.type !== "boss" && !isEliteDef(defId)) {
      const progress = Math.min(1, (G.run.kills || 0) / Math.max(1, G.levelCfg.progressGoal));
      // 主地图由 convertChance 总开关控制（默认 0 = 关闭，已由 ED 定点投放替代）；
      // 裂缝子地图沿用 riftChance；代码路径保留供策划日后开启。
      const chance = this.kind === "rift" ? CFG.elites.riftChance
        : (CFG.elites.convertChance > 0 ? CFG.elites.convertChance + progress * CFG.elites.chanceProgress : 0);
      if (Math.random() < chance) applyElite(m);
    }
    // 邪神雕像倍率：按最终类别（BOSS / 精英 / 小怪）套用，只影响新生成的怪
    applyMonsterScale(m, m.isElite ? "精英属性" : (m.d.type === "boss" ? "BOSS属性" : "小怪属性"));
    this.monsters.push(m);
    return m;
  }
  /* 刷怪圆刷新间隔：受邪神"小怪数量"倍率影响（applyInterval 时 ÷mul） */
  spawnInterval(c) {
    const cntCfg = CFG.monsterScale.targets["小怪数量"];
    if (!cntCfg || !cntCfg.applyInterval) return c.interval;
    const mul = monsterScaleMul(cntCfg.key);
    const d = mul > 0 ? mul : 0.1;   // mul 为 0/负时兜底，避免除零与负间隔
    return Math.max(0.5, c.interval / d);
  }
  spawnWave(c) {
    // 每波数量受邪神"小怪数量"倍率影响（向上取整、最小 1）
    let wave = c.waveSize;
    const cntCfg = CFG.monsterScale.targets["小怪数量"];
    if (cntCfg && cntCfg.applyWaveSize) wave = Math.max(1, Math.ceil(wave * monsterScaleMul(cntCfg.key)));
    // 圆内随机取点：避开墙体、与玩家保持最小距离
    let spawned = 0, attempts = 0;
    const maxAttempts = Math.max(24, wave * 8);
    const p = G.player;
    while (spawned < wave && attempts < maxAttempts) {
      attempts++;
      const a = U.rand(0, Math.PI * 2), rr = U.rand(0, c.radius);
      const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr;
      if (x < 40 || x > this.w - 40 || y < 40 || y > this.h - 40) continue;
      if (blockedByObstacle(this, x, y)) continue;
      if (U.dist(x, y, p.x, p.y) < CFG.spawnRules.minDistFromPlayer) continue;
      // BOSS 存活期间：刷怪点远离 BOSS，避免小怪贴脸刷出
      if (this.boss && !this.boss.dead && U.dist(x, y, this.boss.x, this.boss.y) < CFG.spawnRules.bossClearRadius) continue;
      // 按解锁进度过滤怪物池；ED/BS 不进随机圆（即便误配进 pool 也在此过滤）
      const progress = G.run.kills / Math.max(1, G.levelCfg.progressGoal);
      const raw = parseWeightPool(c.pool);
      const pool = {};
      for (const id in raw) {
        if (isEliteDef(id) || (CFG.monsters[id] && CFG.monsters[id].type === "boss")) continue;
        const unlock = CFG.monsterUnlock[id] ?? 0;
        if (progress >= unlock) pool[id] = raw[id];
      }
      if (!Object.keys(pool).length) pool.NM0010 = 1;
      const defId = U.weightedPick(pool);
      const m = this.spawnMonster(defId, x, y);
      if (m) spawned++;
    }
  }
  /* ---------- 独立精英怪投放（3.3 原方案：关卡层定点投放） ---------- */
  eliteBaseCount() {
    if (this.isMain) return (G.levelCfg && G.levelCfg.eliteBase) || 0;
    if (this.kind === "rift") return CFG.rift.eliteBase || 0;
    return 0;   // 工匠世界等安全区不投放
  }
  elitePoolStr() {
    if (this.isMain) return (G.levelCfg && G.levelCfg.elitePool) || "";
    if (this.kind === "rift") return CFG.rift.elitePool || "";
    return "";
  }
  // 目标数 = round(基础数量 × "精英数量"倍率)：倍率变化实时重算，只影响后续投放、不回收已投放
  eliteTargetCount() {
    const tcfg = CFG.monsterScale.targets["精英数量"];
    const mul = (tcfg && tcfg.applySpawnTarget) ? monsterScaleMul(tcfg.key) : 1;
    return Math.max(0, Math.round(this.eliteBaseCount() * mul));
  }
  countElites() {
    let n = 0;
    for (const m of this.monsters) if (!m.dead && m.isElite) n++;
    return n;
  }
  updateEliteSpawn(dt) {
    if (!G.run || !this.elitePoolStr()) return;
    if (this.isMain && G.run.bossDefeated) return;     // Boss 阶段结束不再补投
    this.eliteTimer = (this.eliteTimer == null) ? CFG.eliteSpawn.firstDelay : this.eliteTimer - dt;
    if (this.eliteTimer > 0) return;
    this.eliteTimer = CFG.eliteSpawn.interval;          // 每 interval 秒检查一次
    if (this.countElites() < this.eliteTargetCount()) this.spawnElite();
  }
  spawnElite(silent) {
    if (this.monsters.length >= monsterCap()) return null;
    const defId = U.weightedPick(parseWeightPool(this.elitePoolStr()));
    if (!defId) return null;
    // 定点投放：复用 findFreeSpot，避开玩家（CFG.spawnRules.minDistFromPlayer）与障碍
    const pos = this.findFreeSpot(CFG.spawnRules.minDistFromPlayer);
    if (!pos) return null;
    const m = new Monster(defId, pos.x, pos.y, (G.levelCfg && G.levelCfg.monsterLevel) || 1);
    applyElite(m);                            // 携带 1~2 条随机词缀
    applyMonsterScale(m, "精英属性");          // 邪神"精英属性"倍率（只影响新投放的精英）
    this.monsters.push(m);
    if (!silent) UI.toast(`★ 精英「${CFG.monsters[defId].name}」出现！`, "bad");
    return m;
  }
  findFreeSpot(minDistFromPlayer = 0, minDistFromWalls = 90, clearance = 70) {
    for (let t = 0; t < 60; t++) {
      const x = U.rand(minDistFromWalls, this.w - minDistFromWalls);
      const y = U.rand(minDistFromWalls, this.h - minDistFromWalls);
      // 障碍净空：交互圈很大，中心必须离障碍边缘足够远，避免圈被障碍压住
      if (this.obstacles.some(o => x > o.x - clearance && x < o.x + o.w + clearance && y > o.y - clearance && y < o.y + o.h + clearance)) continue;
      if (this.altars.some(a => U.dist(x, y, a.x, a.y) < 160)) continue;
      if (minDistFromPlayer && U.dist(x, y, G.player.x, G.player.y) < minDistFromPlayer) continue;
      return { x, y };
    }
    return null;
  }
  update(dt) {
    const r = G.run;
    // 开场冻结（主关卡 CFG.levelFreeze / 裂缝 CFG.rift.freezeTime，5.1）：全员静止 + 全员无敌
    // —— 只推进倒计时，其余战斗逻辑（怪物/子弹/祭坛/拾取/任务限时/伤害结算）全部暂停；
    // 玩家与同伴的更新由 main.js 主循环同步跳过
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      if (this.freezeTimer === 0) {
        const t = r.riftTask;
        UI.toast(t ? `⚔ 战斗开始！任务【${t.name}】：${t.desc}` : "⚔ 战斗开始！", "bad");
      }
      return;
    }
    if (this.isMain) r.runTime += dt;
    // 刷怪：每个圆独立计时（圆模板的刷新间隔生效）
    if (this.isMain && !r.bossDefeated) {
      const bossActive = r.bossSpawned && this.boss && !this.boss.dead;
      if (!bossActive) {
        for (const c of this.circles) {
          c.timer -= dt;
          if (c.timer <= 0) { c.timer = this.spawnInterval(c); this.spawnWave(c); }
        }
      } else {
        // Boss 阶段：继续少量刷新更强的普通怪
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = 8;
          if (this.monsters.length < 14) this.spawnWave(U.pick(this.circles));
        }
      }
    } else if (this.kind === "rift") {
      // 敌人已在进场时一次性投放完毕（见 setupRift）：此处不再持续刷怪，任务完成/失败均不增援；
      // 场上剩余敌人留场，玩家可继续清剿或走返回信标离开。
      // 裂缝任务变体（待细化 20 / §五）：歼灭/限时目标；完成 → 额外高价值任务宝箱；超时 → 失败
      const t = r.riftTask;
      if (t && !t.done && !t.failed) {
        if (t.time) {
          t.remain -= dt;
          if (t.remain <= 0) { t.failed = true; UI.toast(`✘ 任务失败：${t.name}（超时）· 敌人不再增援，可清剿余敌或返回`, "bad"); }
        }
        if (!t.failed && (r.riftKills || 0) >= t.goal) {
          t.done = true;
          const pos = this.findFreeSpot(120);
          if (pos) {
            this.altars.push({ cfg: { name: "任务奖励宝箱", color: "#ff8c5a", icon: "▣", radius: 91, channel: 1.2,
              effects: [{ type: "giveChest", weights: CFG.rift.taskBonusWeights }] }, x: pos.x, y: pos.y, id: "RIFT_TASK" });
            UI.toast(`✔ 任务完成：${t.name}！高价值任务宝箱出现了（敌人不再增援）`, "gold");
          }
        }
      }
    }
    // 独立精英怪投放：主地图按间隔补投；裂缝子地图的精英已在进场时随敌群一次性投放（见 setupRift）
    if (this.isMain) this.updateEliteSpawn(dt);
    // 工匠雕像池（4.6）：触发条件投配额 → 限制器决定落地；主地图专属
    if (this.isMain) updateArtisanPool(this, dt);
    // 邪神倍率计时：多效果并列；-1 表示永久（不倒计时）；到期恢复 mul=1
    if (r.scale) {
      for (const k in r.scale) {
        const s = r.scale[k];
        if (!s || !(s.remain > 0)) continue;   // remain<=0（含 -1 永久）不倒计时
        s.remain -= dt;
        if (s.remain <= 0) { s.remain = 0; s.mul = 1; }
      }
    }
    for (const b of r.buffs) b.remain -= dt;
    r.buffs = r.buffs.filter(b => b.remain > 0);
    updateLevelMechanics(this, dt);   // 毒圈 + 补给点（B 线独立区块）：收缩/扣血/读条
    // 诅咒道具倒计时（待细化36）：到期消退，已附加在敌人身上的修改器同时失效（新生成怪不再继承）
    if (r.curse) {
      r.curse.remain -= dt;
      if (r.curse.remain <= 0) { r.curse = null; UI.toast("☠ 诅咒已消退", "gold"); }
    }
    // 怪物
    this.monsterHash.retune(this.monsters.length);   // 21.14 自适应 cell：数量暴涨时放大桶尺寸，避免单桶候选爆炸
    this.monsterHash.clear();
    for (const m of this.monsters) if (!m.dead) this.monsterHash.insert(m, m.x, m.y, m.r);
    for (const m of this.monsters) if (!m.dead) m.update(this, dt);
    const before = this.monsters.length;
    // 21.14 GC 优化：filter 重建新数组 → 就地尾部交换删除（数组引用不变，无新分配）。
    // monsterHash 在上方 3053-3054 已按「存活怪」重建完毕，此处删死怪不影响它。
    swapRemoveWhere(this.monsters, m => m.dead);
    if (this.isMain && this.boss && this.boss.dead && !r.bossDefeated) onBossDefeated(this);
    // 召唤物（无人机）：随召唤者 + 自动攻击；仅「被击毁」时移除（召唤者倒下不回收）
    // ⚠️ 世界归属：无人机只在本世界更新（G.run.drones 是全队共用容器，别的地图的无人机冻结不更新）
    for (const d of (r.drones || [])) if (d.hp > 0 && (!d.world || d.world === this)) d.update(this, dt);
    r.drones = (r.drones || []).filter(d => d.hp > 0);
    // 陷阱（大地雷）：**留在原地**，与布设者脱钩（布设者走开/倒下都不影响）；不被敌人攻击；
    // 敌人进入范围 → 引信延迟 → 爆炸 → 消失。⚠️ 只处理本世界的陷阱（跨世界的不更新不引爆）
    for (let i = (r.traps || []).length - 1; i >= 0; i--) {
      const t = r.traps[i];
      if (t.world && t.world !== this) continue;
      if (!t.armed) {
        const cands = this.monsterHash.query(t.x, t.y, t.radius + 40, _tmpArr);
        if (cands.some(m => !m.dead && U.dist(t.x, t.y, m.x, m.y) < t.radius + m.r)) {
          t.armed = true; t.fuse = t.armDelay;
        }
      } else {
        t.fuse -= dt;
        if (t.fuse <= 0) {
          explode(this, t.x, t.y, t.radius, t.dmg, "player", t.owner);
          r.traps.splice(i, 1);
        }
      }
    }
    // 弹道
    for (const b of this.playerBullets) b.update(this, dt);
    for (const b of this.enemyBullets) b.update(this, dt);
    // 21.14 GC 优化：三处 filter 全改就地交换删除（顺序与依赖关系不变：先 player 后 enemy，
    // 与旧 filter 逐位等价——两者独立、互不影响；后续 pickups/lasers 等按原顺序继续）。
    swapRemoveWhere(this.playerBullets, b => b.dead);
    swapRemoveWhere(this.enemyBullets, b => b.dead);
    updateLasers(this, dt);   // Boss 激光（17.7 第 3 步）：生命周期 + 命中 + 弹幕吞噬
    updateChainFx(dt);        // 行为芯片（19.12）：链锁瞬结特效衰减
    // 地上宝箱拾取（自动）
    const p = G.player;
    for (const c of this.groundChests.slice()) {
      if (U.dist(p.x, p.y, c.x, c.y) < p.r + 26) {
        const item = makeChestItem(c.chestQ);
        if (r.backpack.tryStackChest(item)) { this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
        else {
          const spot = r.backpack.findSpot(item);
          if (spot) { r.backpack.place(item, spot.x, spot.y); this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
          else { if (r.aiChestCool !== undefined) r.aiChestCool = (CFG.autoFight ? CFG.autoFight.chestFailCooldown : 3); UI.toast("背包已满且无可叠加同品质宝箱，无法拾取", "bad"); }
        }
      }
    }
    // 掉落物（金币/经验宝石）：弹开散落 → 走近自动拾取
    for (const pk of this.pickups) {
      pk.x += pk.vx * dt; pk.y += pk.vy * dt; pk.vx *= 0.88; pk.vy *= 0.88;
      pk.x = U.clamp(pk.x, 24, this.w - 24); pk.y = U.clamp(pk.y, 24, this.h - 24);
      pk.life -= dt;
      // 拾取判定：任意存活英雄（队长或队友）靠近均可拾取
      let picked = false;
      for (const h of aliveHeroes()) {
        if (pk.life > 0 && U.dist(h.x, h.y, pk.x, pk.y) < h.r + 16) {
          if (pk.type === "coin") { r.coin += pk.value; spawnFloat(pk.x, pk.y - 18, `+${pk.value}`, "#ffd76a"); SFX.play("coin"); }
          else { gainExp(pk.value); spawnFloat(pk.x, pk.y - 18, `+${pk.value} 经验`, "#c79bff"); SFX.play("coin"); }
          pk.life = 0; picked = true; break;
        }
      }
      if (picked) continue;
    }
    this.pickups = this.pickups.filter(pk => pk.life > 0);
    // 祭坛 / 雕像 / 信标 / NPC 交互：统一走 judgeChannel（判定圈规则见其注释）
    // 判定半径 = 虚线绘制半径 × altarJudgeMul（1.2，外扩 20% 容差）
    for (const a of this.altars.slice()) {
      if (judgeChannel(a, a.x, a.y, a.cfg.radius, dt, a.cfg.channel)) this.triggerAltar(a);
    }
    // 工匠世界 NPC 交互（21.1 手机化改造）：**进圈 1 秒解锁** → 由玩家**点击 NPC 本体**确认（见 npcTap）。
    // 原实现是站桩 1 秒读完自动开面板，触屏上等于「走进去就被弹窗」，无法预判也易误触；
    // 改为「解锁 + 手动点击」两步。解锁态由本函数维护（不依赖 judgeChannel 的 progress，因其完成即清零）。
    if (!this.isMain && this.kind === "artisan") {
      const nearNpc = !!heroInCircle(this.npc.x, this.npc.y, 90);
      if (nearNpc) {
        this.npcDwell = (this.npcDwell || 0) + dt;
        if (this.npcDwell >= 1.0 && !this.npcReady) {
          this.npcReady = true;
          UI.toast("已对准「工匠」，点击它进入工坊", "gold");
        }
      } else {
        this.npcDwell = 0; this.npcReady = false;   // 离圈即收起，避免隔屏误点
      }
      if (judgeChannel(this, this.exitBeacon.x, this.exitBeacon.y, 100, dt, 3.0, "exitProgress", "exitHolder"))
        EventBus.emit("returnToMain");
    }
    // 空间裂缝返回信标（5.1）：读条 5 秒；仅受击归零（移动不打断，用户已改规则）；离开圈进度保留（decay=0）
    if (this.kind === "rift" && this.returnBeacon) {
      if (judgeChannel(this, this.returnBeacon.x, this.returnBeacon.y, 100, dt,
        CFG.rift.channel, "returnProgress", "returnHolder", 0))
        EventBus.emit("returnFromRift");
    }
  }
  triggerAltar(a) {
    const idx = this.altars.indexOf(a);
    if (idx < 0) return;
    this.altars.splice(idx, 1);   // 触发成功即消失
    if (G.run && G.run.stats) G.run.stats.altarsUsed++;
    SFX.play("altar");
    for (const ef of a.cfg.effects) this.execEffect(ef, a);
  }
  execEffect(ef, a) {
    const r = G.run, p = G.player;
    switch (ef.type) {
      case "heal": {
        // 雕像效果 = 小队共享（16.5）：全队在圈内的成员一起恢复
        for (const h of aliveHeroes()) {
          if (h === p) p.heal(ef.pct);
          else {
            const add = h.hpMax * ef.pct;
            h.hp = Math.min(h.hpMax, h.hp + add);
            spawnFloat(h.x, h.y - 30, `+${Math.round(add)}`, "#7de08a");
          }
        }
        UI.toast(`${a.cfg.name}：全队恢复 ${ef.pct * 100}% 生命`, "gold");
        break;
      }
      case "randomBuff": {
        // 战争雕像（4.4）：重复触发**同类 Buff 叠加的是等级**（不是多份效果），并刷新持续时间。
        // stackable=false 的 Buff 只刷新时间、不升级；等级上限 = 条目 maxLv（默认 CFG.buffLevel.maxLv）。
        const b = U.pick(CFG.warBuffs);
        const cur = r.buffs.find((x) => (x.skillId || "") === b.skillId);
        const inc = b.stackable === false ? 0 : (b.stackPerTrigger || 1);
        let lv, stacked = false;
        if (cur) {
          const before = cur.lv;
          cur.lv = Math.min(b.maxLv, cur.lv + inc);
          cur.remain = ef.duration;
          lv = cur.lv; stacked = cur.lv > before;
        } else {
          r.buffs.push({ skillId: b.skillId, id: b.id, lv: 1, remain: ef.duration });
          lv = 1;
        }
        UI.toast(`战争雕像：获得「${b.id}」Lv${lv} ${buffEffectLabel(b.skillId, lv)}（${ef.duration}秒）${stacked ? " ⬆升级" : ""}`, "gold");
        break;
      }
      case "giveChest": {
        const q = U.weightedPick(ef.weights);
        const item = makeChestItem(q);
        if (grantItemToRun(r, item, { full: "discard" })) {
          UI.toast(`获得 ${item.name}`, "gold");
        } else UI.toast("背包已满，宝箱作废", "bad");
        break;
      }
      case "adjustMonsters": {
        // 邪神雕像（4.5）：按配置表的"目标"决定作用点，触发时在区间内随机取值 →
        // mul = 1 + v/100；同一 target 再次触发为"覆盖 + 重新计时"（不是无限叠乘）。
        const tcfg = CFG.monsterScale.targets[ef.target];
        if (!tcfg || !tcfg.key) { UI.toast(`邪神雕像：未配置的目标「${ef.target}」`, "bad"); break; }
        const range = ef.range || CFG.monsterScale.range;
        const duration = (ef.duration != null) ? ef.duration : CFG.monsterScale.duration;
        const v = U.randInt(range[0], range[1]);
        const mul = Math.max(0, 1 + v / 100);
        r.scale[tcfg.key] = { mul, remain: duration };   // 覆盖该条并重新计时（duration=-1 永久）
        const durTxt = duration < 0 ? "永久" : `${duration}秒`;
        UI.toast(`☠ ${a.cfg.name}：${ef.target} ${v >= 0 ? "+" : ""}${v}%（${durTxt}）`, v >= 0 ? "bad" : "gold");
        break;
      }
      case "teleport": {
        if (ef.submap === "artisan") {
          // 工匠雕像"生效后消失"（4.6）：使用即从地图上移除该雕像；
          // 不设"每关仅一次"限制——雕像池会继续产出新雕像，**子世界可无限次进入**。
          const idx = this.altars.indexOf(a);
          if (idx >= 0) this.altars.splice(idx, 1);
          if (r.artisanPool) r.artisanPool.cooldown = CFG.artisan.limiter.cooldown;   // 限制器：使用后冷却
          r.artisanUsed = true;
          EventBus.emit("enterArtisan");
        }
        break;
      }
      case "rift": EventBus.emit("enterRift"); break;
      case "extract": EventBus.emit("extractSuccess"); break;
    }
  }
}

/* ---------- 障碍物碰撞 ---------- */
function resolveObstacles(e, w, bias) {
  for (const o of w.obstacles) {
    const cx = U.clamp(e.x, o.x, o.x + o.w), cy = U.clamp(e.y, o.y, o.y + o.h);
    const dx = e.x - cx, dy = e.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < e.r && d > 0.001) {
      const push = (e.r - d);
      e.x += dx / d * push; e.y += dy / d * push;
      // 沿墙绕行（防卡死）：push 只恢复法向间隙、不产生切向运动——正对顶墙（本帧位移几乎
      // 纯法向）时会永远顶在墙上。此时沿墙面向 bias（目标点）一侧滑动。
      // 方向带**粘性**（_slideDir）：目标恰在墙延长线上时切向符号每帧抖动（实测会原地振荡），
      // 记住绕行侧；只有目标明显在另一侧（切向距离 > 60px）才翻转。
      const nx = dx / d, ny = dy / d;              // 指离障碍物的法向
      const tx = -ny, ty = nx;                     // 切向
      const mdx = e._mdx || 0, mdy = e._mdy || 0;
      const mag = Math.hypot(mdx, mdy);
      const tangent = mdx * tx + mdy * ty;         // 本帧位移的切向分量
      if (mag > 0.001 && Math.abs(tangent) < mag * 0.3 && bias) {
        const bt = (bias.x - e.x) * tx + (bias.y - e.y) * ty;
        let s = e._slideDir || 0;
        if (!s) s = e._slideDir = bt >= 0 ? 1 : -1;
        else if (Math.abs(bt) > 60 && bt * s < 0) s = e._slideDir = -s;
        e.x += tx * s * mag; e.y += ty * s * mag;
      }
    } else if (d === 0) { e.y = o.y - e.r; }
  }
}
function blockedByObstacle(w, x, y) {
  for (const o of w.obstacles) {
    if (x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 6) return true;
  }
  return false;
}
/** 视线判定：两点间是否无障碍（线段 vs AABB，slab 法）。
 *  用于索敌偏好与远程开火——障碍物挡弹道，没视线就不该开火（否则子弹打在障碍上 = 「对障碍物攻击」）。 */
function losClear(w, x0, y0, x1, y1) {
  for (const o of w.obstacles) {
    let t0 = 0, t1 = 1;
    const d = [x1 - x0, y1 - y0], p0 = [x0, y0];
    const bmin = [o.x, o.y], bmax = [o.x + o.w, o.y + o.h];
    let hit = true;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (p0[i] < bmin[i] || p0[i] > bmax[i]) { hit = false; break; } continue; }
      let ta = (bmin[i] - p0[i]) / d[i], tb = (bmax[i] - p0[i]) / d[i];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit) return false;
  }
  return true;
}

/* ============ 游戏主城（Hub 流程：首页 → 主城 → 传送门 → 选角） ============
 * 玩家操控「自己的形象」（非英雄单位）在主城行走：无战斗系统加载，NPC 进圈即弹面板，
 * 传送门进圈读条出征。皮肤 = 英雄外貌（图鉴激活解锁），渲染用对应英雄素材。 */
function createCityAvatar() {
  const sp = CFG.city.spawn;
  return { x: sp.x * CFG.city.mapW, y: sp.y * CFG.city.mapH, r: 16,
    faceDir: 1, mvx: 0, mvy: 0, skin: Meta.skinId() };
}
function updateCityWorld(dt) {
  const w = G.activeWorld, a = G.cityAvatar;
  if (!w || w.kind !== "city" || !a) return;
  // 移动：键盘 / 虚拟摇杆（与局内同一优先级与死区规则）
  let dx = (G.keys["d"] || G.keys["arrowright"] ? 1 : 0) - (G.keys["a"] || G.keys["arrowleft"] ? 1 : 0);
  let dy = (G.keys["s"] || G.keys["arrowdown"] ? 1 : 0) - (G.keys["w"] || G.keys["arrowup"] ? 1 : 0);
  const joy = G.joy;
  if (joy && joy.active) {
    const dead = (CFG.mobile && CFG.mobile.joystick && CFG.mobile.joystick.deadZone) || 0.18;
    if (Math.hypot(joy.dx, joy.dy) >= dead) { dx = joy.dx; dy = joy.dy; }
  }
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    if (dx !== 0) a.faceDir = dx > 0 ? 1 : -1;
    a.mvx = dx; a.mvy = dy;
    a._mdx = dx * CFG.city.moveSpd * dt; a._mdy = dy * CFG.city.moveSpd * dt;   // 切向滑动用
    a.x = U.clamp(a.x + dx * CFG.city.moveSpd * dt, a.r, w.w - a.r);
    a.y = U.clamp(a.y + dy * CFG.city.moveSpd * dt, a.r, w.h - a.r);
    resolveObstacles(a, w, { x: a.x + dx * 100, y: a.y + dy * 100 });   // 偏置 = 行进方向前方
  } else { a.mvx = 0; a.mvy = 0; }
  // 传送门：进圈读条（圈内积累/离开衰退，与撤离读条同一契约）；完成 → 出征（选关）
  const inPortal = U.dist(a.x, a.y, w.portal.x, w.portal.y) < w.portal.radius * CFG.altarJudgeMul;
  if (inPortal) {
    w.portalProgress += dt;
    if (w.portalProgress >= w.portal.channel) {
      w.portalProgress = 0;
      EventBus.emit("cityPortalEnter");
      return;
    }
  } else w.portalProgress = Math.max(0, w.portalProgress - dt * 1.2);   // 离开缓慢衰退
  // 赛季传送门（预留）：赛季玩法上线后生效，暂只读条提示未开放
  if (w.seasonPortal) {
    const inS = U.dist(a.x, a.y, w.seasonPortal.x, w.seasonPortal.y) < w.seasonPortal.radius * CFG.altarJudgeMul;
    if (inS && G.time - (G._seasonHintT || 0) > 4) {
      G._seasonHintT = G.time;
      UI.toast("赛季传送门尚未开启（通关后赛季玩法上线）", "bad");
    }
  }
  // NPC 交互：进圈只标亮（G.cityNpcNear），按 E / 触屏「交互」才弹面板（Game.actionE）；离圈自动关闭
  let near = null;
  for (const n of w.cityNpcs) {
    if (U.dist(a.x, a.y, n.x, n.y) < CFG.city.npcRadius * CFG.altarJudgeMul) { near = n; break; }
  }
  G.cityNpcNear = near || null;
  if (!near && G.cityNpcOpen) {
    G.cityNpcOpen = null;
    EventBus.emit("cityNpcClose");
  }
  updateAbyssPortal(dt);   // 21.15 深渊之门进圈判定/读条（末尾区块，单行调用）
}
function drawActor(ctx, x, y, size, color, icon) {
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color + "44"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = `${size * 0.5}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.fillText(icon, x, y);
}

/* ============================================================================
 *  UI 归属辅助（升级弹窗「给谁选强化」，见 §5.46）
 * ============================================================================ */

/** 按 heroId 查英雄显示名（队长取 G.heroDef，队友遍历 G.team，最后回落 CFG.heroes）。
 *  查不到时返回 heroId 本身，保证弹窗永远有可显示文本。 */
function heroDefNameOf(heroId) {
  if (!heroId) return "";
  let hd = G.heroDef || (G.team && G.team[0]) || null;
  if (hd && hd.id === heroId && hd.name) return hd.name;
  for (const h of (G.team || [])) if (h && h.id === heroId && h.name) return h.name;
  for (const h of (CFG.heroes || [])) if (h && h.id === heroId && h.name) return h.name;
  return heroId;
}


