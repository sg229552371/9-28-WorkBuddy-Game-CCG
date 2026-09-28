/* ============================================================
 * game.js — 实体 / 世界 / 战斗 / 背包 / 祭坛 / 撤离 / 死亡惩罚
 * 架构：逻辑与渲染分离，数据驱动，便于迁移 Godot
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
  keys: {}, mouse: { x: 0, y: 0 },
  joy: { active: false, dx: 0, dy: 0 },   // 移动端虚拟摇杆向量（归一化 + 死区；active=手指按住）
  time: 0,
  sprites: {},            // 处理后的精灵图
};

/* ============ 背包 / 网格仓储 ============ */
let UID = 1;
class Inventory {
  constructor(cols, rows, id) {
    this.cols = cols; this.rows = rows; this.id = id;
    this.cells = Array.from({ length: cols * rows }, () => null);
    this.items = [];
  }
  inBounds(x, y, w, h) { return x >= 0 && y >= 0 && x + w <= this.cols && y + h <= this.rows; }
  occupied(x, y, w, h, ignore) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const c = this.cells[j * this.cols + i];
      if (c && c !== ignore) return c;
    }
    return null;
  }
  canPlace(item, x, y, ignore) {
    const [w, h] = item.shape;
    return this.inBounds(x, y, w, h) && !this.occupied(x, y, w, h, ignore);
  }
  place(item, x, y) {
    if (!this.canPlace(item, x, y)) return false;
    const [w, h] = item.shape;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.cells[j * this.cols + i] = item;
    item.inv = this.id; item.x = x; item.y = y;
    this.items.push(item);
    return true;
  }
  remove(item) {
    const [w, h] = item.shape;
    for (let j = item.y; j < item.y + h; j++) for (let i = item.x; i < item.x + w; i++) {
      if (this.cells[j * this.cols + i] === item) this.cells[j * this.cols + i] = null;
    }
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    item.inv = null;
  }
  // 尝试放入任意空位（整理用）
  findSpot(item) {
    for (let y = 0; y <= this.rows - item.shape[1]; y++)
      for (let x = 0; x <= this.cols - item.shape[0]; x++)
        if (this.canPlace(item, x, y)) return { x, y };
    return null;
  }
  // 同品质宝箱叠加（6.3）
  tryStackChest(item) {
    if (item.kind !== "chest") return false;
    const q = CFG.chestQualities[item.chestQ];
    for (const it of this.items) {
      if (it.kind === "chest" && it.chestQ === item.chestQ && it.count < q.stackMax) {
        it.count++; it.value = q.value * it.count; return true;   // 价值同步累加
      }
    }
    return false;
  }
  totalWeight() {
    let s = 0;
    for (const it of this.items) s += (it.kind === "chest" ? CFG.chestQualities[it.chestQ].weight * it.count : it.weight);
    return s;
  }
}

/* ============ 武器 / 技能等级曲线（配置驱动公式，上限 100 级） ============
 * 技能等级 = 武器等级（8.2）。曲线参数全在 CFG.weaponLevel，改参数即调全曲线；
 * lv 为 1 基（1..maxLv）。cost = 从 lv 升到 lv+1 所需的进化结晶。 */
function weaponLevelEntry(lv) {
  const w = CFG.weaponLevel;
  const n = Math.max(1, Math.min(Math.round(lv || 1), w.maxLv));
  const raw = w.costBase * Math.pow(w.costGrowth, n - 1);
  return {
    lv: n,
    basicMul: 1 + w.basicMulPerLv * (n - 1),
    skillMul: 1 + w.skillMulPerLv * (n - 1),
    cost: n >= w.maxLv ? 0 : Math.round(raw / w.costRound) * w.costRound,
  };
}

/* ============ 技能等级结算（P1：统一 skillEntry，1~100 级） ============
 * 技能效果填写三种方式（详见 js/config.js 的 CFG.skills 头注释）：
 *   ① 公式驱动：平铺字段 = LV1 基础值，按每级成长率线性放大（普攻 +4%/级、技能 +6%/级）
 *   ② 锚点插值：anchors 只填 3~5 行关键等级，区间内线性插值后取整
 *   ③ 分段公式：由 growth 扩展（数值待策划填） */

/** 锚点表线性插值：table 形如 { 1:3, 25:4, 60:5, 100:6 }
 *  取整规则：锚点值全为整数 → 向下取整；含小数 → 保留两位小数。 */
function anchorLerp(table, lv) {
  const ks = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (!ks.length) return 0;
  const allInt = ks.every((k) => Number.isInteger(table[k]));
  const round = (v) => (allInt ? Math.floor(v) : Math.round(v * 100) / 100);
  if (lv <= ks[0]) return round(table[ks[0]]);
  const last = ks[ks.length - 1];
  if (lv >= last) return round(table[last]);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (lv >= a && lv <= b) return round(table[a] + (table[b] - table[a]) * (lv - a) / (b - a));
  }
  return round(table[last]);
}

/** 技能在不同等级下的完整数值（唯一的技能等级结算入口）。
 *  @param skill   技能表 ID（CFG.skills 的键）**或**技能条目对象本身
 *  @param lv      技能等级 = 武器等级（1..CFG.weaponLevel.maxLv）
 *  @returns 展开基础字段后的副本，dmgMul 已按等级折算、anchors 字段已插值；找不到返回 null */
function skillEntry(skill, lv) {
  const sk = (typeof skill === "string") ? CFG.skills[skill] : skill;
  if (!sk) return null;
  const w = CFG.weaponLevel;
  const n = Math.max(1, Math.min(Math.round(lv || 1), w.maxLv));
  const out = { ...sk, lv: n };
  const anchored = new Set(Object.keys(sk.anchors || {}));
  const wl = weaponLevelEntry(n);          // 曲线唯一来源：weaponLevelEntry
  // ① 公式驱动：默认只作用于 dmgMul —— 普攻 +4%/级、技能 +6%/级；
  //    未声明 kind 的条目（敌人技能 / 增益 / 减益）不吃等级伤害成长（敌人由怪物等级另行缩放）
  const dmgLevelMul = (sk.growth && sk.growth.dmgMul != null)
    ? 1 + sk.growth.dmgMul * (n - 1)
    : (sk.kind === "basic" ? wl.basicMul : (sk.kind === "skill" ? wl.skillMul : 1));
  if (out.dmgMul != null && !anchored.has("dmgMul")) out.dmgMul *= dmgLevelMul;
  for (const k in (sk.growth || {})) {
    if (k === "dmgMul" || anchored.has(k) || out[k] == null) continue;
    out[k] *= 1 + sk.growth[k] * (n - 1);   // 乘算成长（如 growth:{ cd:-0.004 }）
  }
  // ② 锚点插值：整数离散值（覆盖同名字段，不再叠加公式成长）
  for (const k in (sk.anchors || {})) out[k] = anchorLerp(sk.anchors[k], n);
  return out;
}
/** Buff 效果文案（按等级生成，供 toast 与 UI 提示使用）。
 *  stat 决定单位与方向：`cdMul` 是「越小越快」的乘算因子，显示为攻速百分比。 */
function buffEffectLabel(skillId, lv) {
  const e = skillEntry(skillId, lv);
  if (!e) return "";
  const pc = (v) => Math.round(Math.abs(v) * 100);
  switch (e.stat) {
    case "atk": return `攻击力 +${pc(e.mul - 1)}%`;
    case "spd": return `移速 +${pc(e.mul - 1)}%`;
    case "cdMul": return `攻速 +${pc(1 - e.mul)}%`;
    case "lifesteal": return `吸血 ${pc(e.mul)}%`;
    default: return e.label || `${e.stat} ×${Number(e.mul).toFixed(2)}`;
  }
}

/* ============ 物品构造 ============ */
function makeGear(defId, itemQ) {
  const d = CFG.gearDefs.find(g => g.id === defId);
  const q = CFG.itemQualities[itemQ];
  const stats = {}; const mul = 1 + (q.valueMul - 1) * 0.6;
  for (const k in d.stats) stats[k] = Math.round(d.stats[k] * mul);
  return { uid: UID++, kind: "gear", defId, itemQ, name: d.name, shape: d.shape.slice(),
    weight: d.weight, value: Math.round(30 * q.valueMul), stats };
}
function makeModule(defId, itemQ) {
  const d = CFG.moduleDefs.find(m => m.id === defId);
  const q = CFG.itemQualities[itemQ];
  const affix = { tag: d.affix.tag, mode: d.affix.mode, value: d.affix.vals[itemQ] };
  return { uid: UID++, kind: "module", defId, itemQ, name: d.name, shape: d.shape.slice(),
    weight: d.weight, value: Math.round(45 * q.valueMul), affix, lv: 1 };   // lv：武器模块等级（叠加升级 1~9）
}
/* 武器模块等级系统：主词缀有效值 = 基础值 × (1 + (lv-1) × valueStep)；阶段 = ceil(lv / perStage) */
function moduleEffValue(it) {
  const ml = CFG.moduleLevel;
  return it.affix.value * (1 + ((it.lv || 1) - 1) * (ml ? ml.valueStep : 0));
}
function moduleStage(it) {
  const ml = CFG.moduleLevel;
  return Math.min(3, Math.ceil((it.lv || 1) / (ml ? ml.perStage : 3)));
}
function makeChestItem(chestQ, count = 1) {
  const c = CFG.chestQualities[chestQ];
  return { uid: UID++, kind: "chest", chestQ, name: c.name, shape: [1, 1],
    weight: c.weight, value: c.value * count, count };
}
/* ---------- 保险契约（方案 A：背包道具） ----------
 * 占 1 格、有重量、可叠加；死亡时每份保护 1 件价值最高的物品；
 * 撤离成功时剩余契约折算进化结晶；契约本身不参与死亡损失。 */
function makeInsurance(count = 1) {
  return { uid: UID++, kind: "insurance", itemQ: 1, name: CFG.insurance.name, shape: [1, 1],
    weight: CFG.insurance.weight, value: CFG.insurance.value * count, count };
}
function insuranceCount(run) {
  return run.backpack.items.filter(it => it.kind === "insurance").reduce((s, it) => s + it.count, 0);
}
function consumeInsurance(run, n) {
  let left = n;
  for (const it of run.backpack.items.slice()) {
    if (it.kind !== "insurance" || left <= 0) continue;
    const take = Math.min(left, it.count);
    it.count -= take; left -= take;
    it.value = CFG.insurance.value * it.count;
    if (it.count <= 0) run.backpack.remove(it);
  }
  return n - left;
}
/* ---------- 诅咒道具（待细化 36：给敌人附加技能的道具） ----------
 * 使用后向局内敌人动态附加属性修改器（防御/生命/攻击/移速），持续 duration 秒；
 * 风险回报：期间金币与经验掉落 ×rewardMul。仅限主地图战斗中使用（9.1.1 例外项）。 */
function makeCurse() {
  return { uid: UID++, kind: "curse", itemQ: 2, name: "诅咒道具", shape: [1, 1],
    weight: CFG.curseItems.weight, value: CFG.curseItems.value };
}
function useCurseItem(it) {
  const r = G.run;
  if (!r || G.state !== "playing") return false;
  if (G.inArtisan || G.inRift) { UI.toast("诅咒道具只能在主地图战斗中使用", "bad"); return false; }
  if (r.curse) { UI.toast("已有诅咒生效中", "bad"); return false; }
  const def = U.pick(CFG.curseItems.list);
  r.curse = { ...def, remain: CFG.curseItems.duration };
  const inv = it.inv === "backpack" ? r.backpack : r.weaponInv;
  inv.remove(it);
  UI.toast(`☠ ${def.name}生效：${def.desc}（${CFG.curseItems.duration}s · 掉落 ×${def.rewardMul}）`, "bad");
  SFX.play("altar");
  return true;
}
/* 诅咒的生效点：怪物生成（hp/atk/spd 乘算）、受伤判定（def 乘算）、掉落（rewardMul） */
function affixText(it) {
  if (!it.affix) return "";
  const v = it.kind === "module" ? moduleEffValue(it) : it.affix.value;   // 武器模块按等级缩放后的有效值
  if (it.affix.mode === "flat") return `${it.affix.tag} +${Math.round(v * 100) / 100}`;
  return `${it.affix.tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
}

/* ============ 运行局数据 ============ */
function createRun(heroDef) {
  return {
    heroDef,
    hp: heroDef.hp, hpMax: heroDef.hp,
    energy: heroDef.energyMax, energyMax: heroDef.energyMax,
    lv: 1, exp: 0, expNext: 14, coin: 0, kills: 0, eliteKills: 0,
    backpack: new Inventory(CFG.backpack.cols, CFG.backpack.rows, "backpack"),
    weaponInv: new Inventory(CFG.weaponGrid.cols, CFG.weaponGrid.rows, "weapon"),
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
    cardAssets: 0,                  // 属性卡牌资产（升级 +1，仅工匠世界可使用，8.3）
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
    weapon: computeWeaponDefaults(),
  };
}
function computeWeaponDefaults() {
  const sk = CFG.weapons[(G.heroDef && G.heroDef.weapon) || "W001"].skills;
  return { basic: { ...CFG.skills[sk.basic] }, skill: { ...CFG.skills[sk.skill] } };   // 每帧由词条重算副本
}

/* ---------- 局外元进度（localStorage 持久化：结晶 / 各角色局外等级 / 关卡解锁） ---------- */
const SAVE_KEY = "bagrogue_save_v1";
const Meta = {
  data: { crystals: 0, heroes: {}, unlockedLevels: 1 },
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* 无 localStorage（测试环境）则用默认值 */ }
    // 迁移：旧的"结晶技能升级"并入武器等级（技能等级 = 武器等级，局外结晶升级）——老存档字段保留兼容
    for (const id in this.data.heroes) {
      const rec = this.data.heroes[id];
      if (rec.skillLevel && !rec.weaponLv) rec.weaponLv = rec.skillLevel;
    }
  },
  commit() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { } },
  heroLevel(id) { return (this.data.heroes[id] && this.data.heroes[id].level) || 1; },
  levelUpCost(id) { return CFG.outLevel.costBase + (this.heroLevel(id) - 1) * CFG.outLevel.costStep; },
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
  // 武器等级（永久资产，按英雄存档；主菜单「局外成长」花结晶升级；技能等级 = 武器等级同步）
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
  // 结算发结晶：撤离全额，死亡按 deathRatio 折算
  awardRun(kills, bossDefeated, extracted) {
    let v = kills * CFG.outLevel.crystalKill + (bossDefeated ? CFG.outLevel.crystalBoss : 0);
    if (!extracted) v = Math.floor(v * CFG.outLevel.deathRatio);
    this.data.crystals += v;
    this.commit();
    return v;
  },
};
Meta.load();

// 局外等级 → 英雄实际出战属性（副本，不污染 CFG）
function applyOutLevel(def) {
  const lv = Meta.heroLevel(def.id);
  const g = CFG.outLevel.growth, n = lv - 1;
  return { ...def, outLevel: lv, weaponLv: Meta.weaponLv(def.id), outSkillLv: Meta.weaponLv(def.id),
    hp: def.hp + g.hp * n, atk: def.atk + g.atk * n, def: def.def + g.def * n };
}

/* ---------- 武器词条计算（16.5：先加算后乘算） ----------
 * forSkill=true 时额外计入武器模块阶段词缀（阶段词缀只强化主动技能，不影响普攻基础值） */
function tagCalc(tag, forSkill) {
  const t = CFG.affixTags[tag];
  let flat = 0, mul = 1;
  const ml = CFG.moduleLevel;
  for (const it of G.run.weaponInv.items) {
    if (it.kind === "module" && it.affix && it.affix.tag === tag) {
      const eff = moduleEffValue(it);   // 主词缀随武器模块等级成长
      if (it.affix.mode === "flat") flat += eff;
      else mul *= (1 + eff);
      // 阶段词缀（LV4~6 解锁第1条、LV7~9 第2条、LV9 满 3 条按 perStage 推进）
      if (forSkill && ml && ml.stageAffixes) {
        const stage = moduleStage(it);
        for (let i = 0; i < stage; i++) {
          const sa = ml.stageAffixes[i];
          if (sa && sa.tag === tag) {
            if (sa.mode === "flat") flat += sa.value;
            else mul *= (1 + sa.value);
          }
        }
      }
    }
  }
  // 卡牌对武器词条的加成（弹道数量卡）
  if (tag === "弹道数量" && G.run.appliedCards)
    flat += G.run.appliedCards.filter(c => c.attr === "bullets").reduce((s, c) => s + c.value, 0);
  let v = (t.base + flat) * mul;
  v = U.clamp(v, t.min, t.max);
  if (t.round === "floor") v = Math.floor(v);
  return v;
}
/* ---------- 武器模块深度（16.7）：连接效果 + 套装效果（仅统计武器栏内武器模块） ----------
 * 连接：边相邻（共享棱）且同品质的武器模块，每对提供 linkBonus 技能伤害（几何摆放的构建收益）；
 * 套装：同系列武器模块在武器栏内集齐 N 件触发词缀强化（CFG.moduleSets，策划改表即调）。 */
function moduleSynergy() {
  const mods = G.run.weaponInv.items.filter(it => it.kind === "module");
  const out = { dmgMul: 1, cdMul: 1, bullets: 0, links: 0, sets: [] };
  const ml = CFG.moduleLevel;
  for (let i = 0; i < mods.length; i++) for (let j = i + 1; j < mods.length; j++) {
    const a = mods[i], b = mods[j];
    if (a.itemQ !== b.itemQ) continue;                      // 连接要求同品质
    const ax2 = a.x + a.shape[0], ay2 = a.y + a.shape[1];
    const bx2 = b.x + b.shape[0], by2 = b.y + b.shape[1];
    const overlapX = a.x < bx2 && b.x < ax2, overlapY = a.y < by2 && b.y < ay2;
    const touchX = (Math.abs(ax2 - b.x) < 0.5 || Math.abs(bx2 - a.x) < 0.5) && overlapY;
    const touchY = (Math.abs(ay2 - b.y) < 0.5 || Math.abs(by2 - a.y) < 0.5) && overlapX;
    if (touchX || touchY) out.links++;
  }
  out.dmgMul *= 1 + out.links * (ml ? (ml.linkBonus || 0) : 0);
  for (const sid in CFG.moduleSets) {
    const set = CFG.moduleSets[sid];
    const n = mods.filter(m => set.members.includes(m.defId)).length;
    for (const need in set.bonuses) {
      if (n < Number(need)) continue;
      const bo = set.bonuses[need];
      if (bo.tag === "伤害") out.dmgMul *= 1 + bo.value;
      else if (bo.tag === "冷却") out.cdMul *= 1 + bo.value;
      else if (bo.tag === "弹道数量") out.bullets += bo.value;
      out.sets.push(`${set.name}×${n}（${bo.tag} ${bo.value > 0 ? "+" : ""}${Math.round(bo.value * 100)}%）`);
    }
  }
  return out;
}
/** 技能 → 本局实际数值：skillEntry（统一的 1~100 级曲线）+ 词条标签 + 武器模块连接/套装加成。
 *  普攻与主动技能共用同一条路径；召唤/陷阱额外产出 row（召唤物/陷阱属性行）。 */
function resolveSkill(sk, lv, syn) {
  const e = skillEntry(sk, lv);          // ① 等级曲线（公式 + 锚点插值）
  const has = (t) => (sk.tags || []).includes(t);
  const isBasic = sk.kind === "basic";
  // 词条标签生效规则（16.5）：主动技能只有声明了该标签才吃；普攻吃除「伤害」外的全部标签
  //（「伤害」倍率与武器模块阶段词缀只强化主动技能，不影响普攻基础值，见 tagCalc）。
  const E = (t) => (isBasic ? t !== "伤害" : has(t));
  if (sk.type === "summon" || sk.type === "trap") {
    // 召唤物 / 陷阱：离散属性全部来自 anchors，伤害走「伤害 / 召唤物 / 陷阱」标签倍率
    const row = { count: e.count, hp: e.hp, atk: e.atk, fireCd: e.fireCd, orbit: e.orbit,
      dmgMul: e.dmgMul, radius: e.radius };
    return { ...e, row,
      dmgMul: (row.dmgMul || 1) * (has("伤害") ? tagCalc("伤害", true) : 1)
        * (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("陷阱") ? tagCalc("陷阱", true) : 1)
        * syn.dmgMul,
      cd: e.cd * (has("冷却") ? tagCalc("冷却", true) : 1) * syn.cdMul,
      radius: (row.radius || e.radius || 100) * (has("范围") ? tagCalc("范围", true) : 1),
      count: row.count || 1, armDelay: sk.armDelay || 0.5,
      summonMul: (has("召唤物") ? tagCalc("召唤物", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
      trapMul: (has("陷阱") ? tagCalc("陷阱", true) : 1) * (has("伤害") ? tagCalc("伤害", true) : 1),
    };
  }
  // 弹道技能（普攻 / 主动）
  return { ...e,
    dmgMul: (e.dmgMul != null ? e.dmgMul : 1) * (E("伤害") ? tagCalc("伤害") : 1) * syn.dmgMul,
    cd: e.cd * (E("冷却") ? tagCalc("冷却") : 1) * syn.cdMul,
    radius: e.radius != null ? e.radius * (E("范围") ? tagCalc("范围") : 1) : e.radius,
    bullets: (e.bullets != null ? e.bullets : 1)
      + (E("弹道数量") ? tagCalc("弹道数量") + syn.bullets - CFG.affixTags["弹道数量"].base : 0),
    bulletSpd: (e.bulletSpd != null ? e.bulletSpd : 480) * (E("弹速") ? tagCalc("弹速") : 1),
    pierce: (e.pierce || 0) + (E("穿透") ? tagCalc("穿透") - CFG.affixTags["穿透"].base : 0),
    bounce: (e.bounce || 0) + (E("弹射次数") ? tagCalc("弹射次数") - CFG.affixTags["弹射次数"].base : 0),
  };
}
/** 重算全队技能（武器栏 = 小队共用的技能栏）。
 *  队长：解析结果写入 G.run.weapon.basic / .skill（保留原名，调用点与 UI 均依赖）。
 *  队友：各自解析一份 skillSet 缓存到 c.skills —— 武器栏内的武器模块（模块）
 *  对小队**所有成员**生效，按各成员自己武器的技能标签（skill.tags）过滤，
 *  等级走各自的武器等级（各自局外升级线），连接/套装加成全队共享。 */
function recomputeWeapon() {
  const syn = moduleSynergy();          // 连接（相邻同品质）+ 套装 → 全队共享的技能向加成
  G.run.moduleSyn = syn;                // 缓存给 UI 展示（连接/套装一览）
  const resolveSet = (heroDef) => {
    const ids = CFG.weapons[heroDef.weapon].skills;
    const lv = heroDef.weaponLv || 1;   // 武器等级 = 技能等级（8.2）
    return { basic: resolveSkill(CFG.skills[ids.basic], lv, syn),
             skill: resolveSkill(CFG.skills[ids.skill], lv, syn) };
  };
  const main = resolveSet(G.heroDef);
  G.run.weapon.basic = main.basic;
  G.run.weapon.skill = main.skill;
  for (const c of (G.run.companions || [])) c.skills = resolveSet(c.heroDef);
}

/* ---------- 武器栏装备（属性件）提供的属性加成 ----------
 * 16.5：武器栏 = 小队技能栏，栏内物品**对小队全体成员生效**——
 * 武器模块改技能（见 recomputeWeapon），装备改属性（队长 computeStats + 队友 companionStats）。 */
const ZERO_GEAR = { hp: 0, atk: 0, def: 0, spd: 0, energyMax: 0, regen: 0, summonMax: 0, trapMax: 0 };
function weaponGearBonus() {
  const b = { ...ZERO_GEAR };
  const inv = G.run && G.run.weaponInv;
  if (!inv) return b;
  for (const it of inv.items) {
    if (it.kind !== "gear" || !it.stats) continue;
    for (const k in b) if (it.stats[k]) b[k] += it.stats[k];
  }
  return b;
}
/* ---------- 局内增益修正（属性卡牌 + 战争雕像 Buff）----------
 * 16.5 / 8.3 / 4.4：属性卡与雕像 Buff 都是「本局内生效」的增益，**对小队全体成员生效**
 *（队长 + 全部 AI 队友），与武器栏装备同源共享。
 * 分两个通道返回，避免加算/乘算顺序歧义：
 *   add —— 加算项（属性卡 flat 值 + Buff 的吸血）
 *   mul —— 乘算项（Buff 的属性倍率 + 属性卡的冷却缩减）
 * 统一结算式：最终 = (基础值 + 武器栏装备 + add) × mul
 * 说明：regen / energyMax 对**队长与队友都有意义**——队友是独立个体，各自有能量池（见 companionStats）。 */
function runBonus() {
  const r = G.run;
  const add = { hp: 0, atk: 0, def: 0, spd: 0, regen: 0, energyMax: 0, lifesteal: 0, summonMax: 0, trapMax: 0 };
  const mul = { atk: 1, spd: 1, cd: 1 };
  for (const b of (r.buffs || [])) {          // 战争雕像 Buff（4.4）：**按等级取效果**——同一条 Buff 叠的是等级
    const e = b.skillId ? skillEntry(b.skillId, b.lv || 1) : null;
    const stat = e ? e.stat : b.stat, mv = e ? e.mul : b.mul;
    if (stat === "atk") mul.atk *= mv;
    else if (stat === "spd") mul.spd *= mv;
    else if (stat === "cdMul") mul.cd *= mv;
    else if (stat === "lifesteal") add.lifesteal += mv;
  }
  for (const c of (r.appliedCards || [])) {    // 属性卡牌（8.3，工匠世界使用后随本局）
    if (c.attr === "cd") mul.cd *= c.value;
    else if (c.attr === "bullets") { /* 弹道数量在 tagCalc / resolveSkill 内生效（全队同源） */ }
    else if (add[c.attr] != null) add[c.attr] += c.value;
  }
  return { add, mul };
}
/** 队友属性：与队长同源——局内等级成长 + 武器栏装备 + 局内增益（属性卡 / 雕像 Buff）。
 *  16.5：武器栏与局内增益**对小队全体成员生效**。
 *  队友是**独立个体**：有自己的生命 / 攻击 / 防御 / 移速，也有自己的**能量上限与能量回复**。 */
function companionStats(c) {
  const r = G.run, g = weaponGearBonus(), bo = runBonus(), n = r.lv - 1;
  return {
    hpMax: c.heroDef.hp + 8 * n + g.hp + bo.add.hp,
    atk: Math.round((c.heroDef.atk + 2 * n + g.atk) * bo.mul.atk + bo.add.atk),
    def: (c.heroDef.def || 0) + g.def + bo.add.def,
    spd: (c.heroDef.spd + g.spd + bo.add.spd) * bo.mul.spd,
    energyMax: c.heroDef.energyMax + g.energyMax + bo.add.energyMax,   // 能量上限（英雄基础 + 装备 + 属性卡）
    regen: c.heroDef.energyRegen + g.regen + bo.add.regen,             // 能量回复
    // 召唤物 / 陷阱上限（英雄属性，限制该类型技能的上限）：同样走属性管线（基础 + 装备 + 局内增益）
    summonMax: heroUnitLimit(c.heroDef, "summon") + g.summonMax + bo.add.summonMax,
    trapMax: heroUnitLimit(c.heroDef, "trap") + g.trapMax + bo.add.trapMax,
    cdMul: bo.mul.cd,                 // 冷却缩减（属性卡「攻速」+ 增益「迅击」）
    lifesteal: bo.add.lifesteal,      // 吸血（属性卡「吸血」+ 增益「汲血」）
  };
}

/* ---------- 玩家属性（武器栏装备 + 局内增益 + 等级） ----------
 * 与队友 companionStats() 同源：走同一个 runBonus()（属性卡 / 雕像 Buff 全队生效）。 */
function computeStats() {
  const r = G.run, h = r.heroDef;
  const g = weaponGearBonus(), bo = runBonus(), n = r.lv - 1;
  const st = {
    hpMax: h.hp + 8 * n + g.hp + bo.add.hp,
    atk: (h.atk + 2 * n + g.atk) * bo.mul.atk + bo.add.atk,
    def: h.def + g.def + bo.add.def,
    spd: h.spd + g.spd + bo.add.spd,
    energyMax: h.energyMax + g.energyMax + bo.add.energyMax,
    regen: h.energyRegen + g.regen + bo.add.regen,
    summonMax: heroUnitLimit(h, "summon") + g.summonMax + bo.add.summonMax,
    trapMax: heroUnitLimit(h, "trap") + g.trapMax + bo.add.trapMax,
    lifesteal: bo.add.lifesteal,
    spdMul: bo.mul.spd, cdMul: bo.mul.cd,
  };
  st.atk = Math.round(st.atk);
  return st;
}

/* ---------- 召唤物 / 陷阱上限（英雄属性，限制「该类型技能」的上限） ----------
 * 数值口径（12.3 已定）：召唤物上限 / 陷阱数量上限是**英雄属性**，走完整属性管线
 *（英雄基础值 + 武器栏装备 + 局内增益），与能量上限同源。
 * 实际上限 = min(技能锚点数量, 英雄该属性) —— 技能等级决定「想召几架」，英雄属性决定「最多几架」。 */
function heroUnitLimit(heroDef, kind) {
  const h = heroDef || (G.run && G.run.heroDef) || G.heroDef || {};
  const v = kind === "trap" ? h.trapMax : h.summonMax;
  return v === undefined ? (CFG.unitLimit[kind === "trap" ? "trapMax" : "summonMax"] || 0) : v;
}
/** 取某成员在该类型技能上的实际上限（队长走 computeStats、队友走 companionStats，同源）。 */
function unitLimitOf(caster, kind) {
  const st = (caster && caster.isCompanion) ? companionStats(caster) : computeStats();
  const v = kind === "trap" ? st.trapMax : st.summonMax;
  return Math.max(0, Math.floor(v || 0));
}
/** 实际上限 = min(技能锚点数量, 英雄该类型上限) */
function unitCap(caster, kind, skillCount) {
  return Math.max(0, Math.min(Math.floor(skillCount || 0), unitLimitOf(caster, kind)));
}

/* ---------- 负重惩罚（9.2 线性递减） ---------- */
function weightFactor() {
  const w = G.run.backpack.totalWeight() + G.run.weaponInv.totalWeight();
  const c = CFG.weight;
  if (w <= c.threshold) return { w, f: 1, over: false };
  const f = Math.max(c.minFactor, 1 - c.slope * (w - c.threshold) / c.divisor);
  return { w, f, over: true };
}

/* ============ 技能执行器（P2：玩家 / 队友 / 召唤物共用同一套释放逻辑） ============
 * 释放形态由技能表的 type 决定：bullet 弹道 / summon 召唤物 / trap 陷阱。
 * 所有数值都来自 resolveSkill 的产物（队长 = G.run.weapon.*，队友 = c.skills.*），执行器本身不存数值。 */
const SkillSystem = {
  /** 弹道技能：按 bullets 数散射，命中带 AoE 半径（技能弹）。
   *  opts: { side, isSkill, atk, spread } */
  castBullet(w, caster, sk, ang, opts = {}) {
    const side = opts.side || "player";
    const isSkill = opts.isSkill != null ? opts.isSkill : (sk.kind !== "basic");
    const atk = opts.atk != null ? opts.atk : caster.atk;
    const n = sk.bullets || 1;
    const spread = opts.spread != null ? opts.spread : (isSkill ? 0.18 : 0.14);
    const pool = side === "player" ? w.playerBullets : w.enemyBullets;
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
      pool.push(new Bullet(caster.x, caster.y, a, sk.bulletSpd || 480,
        Math.max(1, Math.round(atk * (sk.dmgMul != null ? sk.dmgMul : 1))), side,
        sk.pierce || 0, sk.bounce || 0, isSkill ? sk.radius : 0, isSkill, caster));
    }
    return n;
  },
  /** 召唤物：**按召唤者独立编队**——只补足「自己名下」的数量（阵亡的重新召出）。
   *  再次施放补满自己的编队，不会顶掉其他成员的召唤物（产物池按成员隔离）。
   *  数量上限 = min(技能锚点数量, **英雄「召唤物上限」属性**)：技能等级决定想召几架，
   *  英雄属性（召唤师 6 / 其他 2，见 CFG.heroes + CFG.unitLimit）决定最多几架。
   *  归属固定为召唤者：无人机**随召唤者**移动，召唤者倒下也**不回收**（继续留在场上作战）。 */
  castSummon(w, caster, sk, atk) {
    const row = sk.row || {};
    const want = unitCap(caster, "summon", row.count || 3);
    const orbit = row.orbit || 70;
    const mine = () => (G.run.drones || []).filter(d => d.hp > 0 && d.owner === caster);
    while (mine().length > want) G.run.drones.splice(G.run.drones.indexOf(mine()[0]), 1);   // 超上限只回收自己最旧的
    for (let i = mine().length; i < want; i++) {
      const a = (i / Math.max(1, want)) * Math.PI * 2;
      G.run.drones.push(new Drone(
        caster.x + Math.cos(a) * orbit, caster.y + Math.sin(a) * orbit,
        a, row.hp || 40, Math.max(1, Math.round((row.atk || 6) * (sk.summonMul || 1))),
        row.fireCd || 0.8, orbit, caster));
    }
    return { n: mine().length, cap: want };
  },
  /** 陷阱：在脚下布设，超出**自己名下**的数量上限时回收自己最旧的那颗。
   *  数量上限 = min(技能锚点数量, **英雄「陷阱数量上限」属性**)。
   *  布置后**留在原地**，与布设者脱钩：布设者走开/倒下都不影响，敌人入圈即延迟引爆。 */
  castTrap(w, caster, sk, atk) {
    const row = sk.row || {};
    const cap = unitCap(caster, "trap", row.count || 1);
    const mine = () => (G.run.traps || []).filter(t => t.owner === caster);
    if (cap <= 0) return { n: mine().length, cap: 0 };            // 上限为 0：该技能不产出（防死循环）
    while (mine().length >= cap) G.run.traps.splice(G.run.traps.indexOf(mine()[0]), 1);   // 只回收自己的
    G.run.traps.push({
      x: caster.x, y: caster.y, r: 10,
      radius: sk.radius || row.radius || 110,     // 触发范围 = 伤害范围（同源）
      armDelay: sk.armDelay != null ? sk.armDelay : 0.5,
      armed: false, fuse: 0, owner: caster,       // 归属：产物池按成员独立
      dmg: Math.max(1, Math.round(atk * (sk.dmgMul || 1) * (sk.trapMul || 1))),
    });
    return { n: mine().length, cap };
  },
  /** 释放总入口：按 type 分发；返回本次释放的表现类型 + 数量信息（n / cap），供调用方播放音效/提示。 */
  cast(w, caster, sk, target, opts = {}) {
    const ang = target ? Math.atan2(target.y - caster.y, target.x - caster.x) : (opts.ang || 0);
    if (sk.type === "summon") return { kind: "summon", ...this.castSummon(w, caster, sk, opts.atk) };
    if (sk.type === "trap") return { kind: "trap", ...this.castTrap(w, caster, sk, opts.atk) };
    return { kind: "bullet", n: this.castBullet(w, caster, sk, ang, opts) };
  },
};

/* ============ 实体 ============ */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = G.heroDef.radius;
    this.fireTimer = 0; this.skillTimer = 0;
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
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      if (dx !== 0) this.faceDir = dx > 0 ? 1 : -1;
      this.mvx = dx; this.mvy = dy;   // 记录移动方向，队友据此排到身后
      const wf = weightFactor();
      const spd = st.spd * st.spdMul * wf.f;
      this.x = U.clamp(this.x + dx * spd * dt, this.r, w.w - this.r);
      this.y = U.clamp(this.y + dy * spd * dt, this.r, w.h - this.r);
      resolveObstacles(this, w);
    } else { this.mvx = 0; this.mvy = 0; }   // 停止移动即清零
    // 能量恢复
    G.run.energy = Math.min(G.run.energyMax, G.run.energy + st.regen * dt);
    // 自动攻击：锁定屏幕内最近敌人
    this.fireTimer -= dt; this.skillTimer -= dt;
    const target = nearestMonster(w, this.x, this.y);
    if (target) {
      if (this.fireTimer <= 0) { this.fireBasic(w, target, st); this.fireTimer = G.run.weapon.basic.cd * st.cdMul; }
      // 主动技能自动施法：能量够 + 冷却好 + 场上有目标即释放（Space 保留手动触发）
      if (this.skillTimer <= 0 && G.run.energy >= G.run.weapon.skill.energy &&
          (CFG.skills2.autoCast || G.keys[" "])) {
        this.fireSkill(w, target, st); this.skillTimer = G.run.weapon.skill.cd * st.cdMul;
      }
    }
  }
  fireBasic(w, target, st) {
    SkillSystem.castBullet(w, this, G.run.weapon.basic,
      Math.atan2(target.y - this.y, target.x - this.x),
      { side: "player", isSkill: false, atk: st.atk, spread: 0.14 });
    SFX.play("shoot");
  }
  fireSkill(w, target, st) {
    const s = G.run.weapon.skill;
    G.run.energy -= s.energy;
    // 释放形态由技能表 type 决定（bullet / summon / trap），统一走 SkillSystem
    const res = SkillSystem.cast(w, this, s, target, { side: "player", isSkill: true, atk: st.atk });
    SFX.play("skill");
    // 召唤 / 陷阱返回 { n: 现存量, cap: 实际上限 }（上限 = min(技能锚点数量, 英雄该类型上限)）
    if (res.kind === "summon") UI.toast(`${s.name}！我的无人机编队 ${res.n}/${res.cap}（上限＝英雄召唤物上限）`, "gold");
    else if (res.kind === "trap") UI.toast(`${s.name}！已布设（本人地雷 ${res.n}/${res.cap}，留原地待敌）`, "gold");
    else UI.toast(`${s.name}！`, "gold");
  }
  takeDamage(w, dmg) {
    const st = computeStats();
    const real = Math.max(1, Math.round(dmg - st.def));
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

/* ---------- 多角色组队：英雄集合（队长 + AI 队友） ---------- */
function aliveHeroes() {
  const arr = [];
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
function heroTakeDamage(w, h, dmg) {
  // 受击打断：撤离读条归零（雕像保留）；裂缝返回信标读条归零
  const r = G.run;
  if (r && r.extractChanneling) {
    r.extractChanneling = false; r.extractProgress = 0; r.extractHolder = null;
    UI.toast("撤离读条被打断！（雕像仍在原地，重新站回圈内即可继续）", "bad");
  }
  if (w && w.kind === "rift" && w.returnProgress > 0) { w.returnProgress = 0; UI.toast("返回信标读条被打断！", "bad"); }
  if (h === G.player) { G.player.takeDamage(w, dmg); return; }
  const real = Math.max(1, Math.round(dmg - companionStats(h).def));   // 含武器栏装备的防御加成（16.5）
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
      c.x += (tx - c.x) / d * spd * dt; c.y += (ty - c.y) / d * spd * dt;
      if (Math.abs(tx - c.x) > 4) c.faceDir = tx > c.x ? 1 : -1;
      resolveObstacles(c, w);
    }
    // 自动普攻（武器栏内的武器模块对全队生效：技能值取 recomputeWeapon 解析出的 c.skills）
    c.fireTimer -= dt;
    const tgt = nearestMonster(w, c.x, c.y);
    if (tgt && c.fireTimer <= 0) {
      const b = (c.skills && c.skills.basic)
        || CFG.skills[CFG.weapons[c.heroDef.weapon].skills.basic];   // 兜底：未重算时用技能表原始值
      SkillSystem.castBullet(w, c, b, Math.atan2(tgt.y - c.y, tgt.x - c.x),
        { side: "player", isSkill: false, atk: st.atk, spread: 0.14 });
      c.fireTimer = b.cd * st.cdMul;   // 冷却缩减（属性卡「攻速」/ 增益「迅击」）对队友同样生效
      c.faceDir = tgt.x > c.x ? 1 : -1;
    }
    // 主动技能（技能石）：与队长同一套 SkillSystem。队友是**独立个体**——
    // 用**自己的能量池**（各自恢复、各自扣费），不占用队长能量池（CFG.team.aiSkill 可关）。
    c.skillTimer = (c.skillTimer || 0) - dt;
    c.energy = Math.min(c.energyMax, (c.energy || 0) + st.regen * dt);
    const cs = c.skills && c.skills.skill;
    if (CFG.team.aiSkill !== false && tgt && cs && c.skillTimer <= 0 && c.energy >= (cs.energy || 0)) {
      c.energy -= (cs.energy || 0);
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
  constructor(x, y, orbitA, hp, atk, fireCd, orbit, owner = null) {
    this.isDrone = true;
    this.x = x; this.y = y; this.r = 12;
    this.hpMax = hp; this.hp = hp;
    this.atk = atk; this.fireCd = fireCd;
    this.orbitA = orbitA; this.orbit = orbit;
    this.owner = owner || G.player;   // 归属：每个成员有**自己的召唤物池**（环绕召唤者）
    this.fireTimer = U.rand(0.2, 0.6);
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
  }
}
function droneTakeDamage(w, d, dmg) {
  d.hp -= Math.max(1, Math.round(dmg));
  spawnFloat(d.x, d.y - 20, `-${Math.max(1, Math.round(dmg))}`, "#ff9a7f");
  if (d.hp <= 0) { d.hp = 0; SFX.play("death"); UI.toast("无人机被击毁！", "bad"); }
}

/* ---------- 敌方目标（英雄 + 存活无人机）：怪物索敌与伤害统一入口 ---------- */
function enemyTargets() {
  return [...aliveHeroes(), ...((G.run && G.run.drones) || []).filter(d => d.hp > 0)];
}
function nearestTarget(x, y) {
  let best = null, bd = Infinity;
  for (const t of enemyTargets()) {
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
  constructor(x, y, ang, spd, dmg, side, pierce = 0, bounce = 0, aoe = 0, isSkill = false, owner = null) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * spd; this.vy = Math.sin(ang) * spd;
    this.dmg = dmg; this.side = side; this.pierce = pierce; this.bounce = bounce;
    this.aoe = aoe; this.isSkill = isSkill;
    this.owner = owner;                       // 发射者（吸血归属：队长 / 队友各自独立）
    this.dead = false; this.life = 2.2; this.hitSet = new Set();
  }
  update(w, dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    // 撞墙
    if (this.x < 0 || this.x > w.w || this.y < 0 || this.y > w.h || this.life <= 0) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side);
      this.dead = true; return;
    }
    if (blockedByObstacle(w, this.x, this.y)) {
      if (this.aoe > 0) explode(w, this.x, this.y, this.aoe, this.dmg, this.side);
      this.dead = true; return;
    }
    // 命中判定
    if (this.side === "player") {
      const cands = w.monsterHash.query(this.x, this.y, 30, _tmpArr);
      for (const m of cands) {
        if (m.dead || this.hitSet.has(m)) continue;
        if (U.dist(this.x, this.y, m.x, m.y) < m.r + 6) {
          this.hitSet.add(m);
          if (this.aoe > 0) { explode(w, this.x, this.y, this.aoe, this.dmg, this.side); this.dead = true; return; }
          damageMonster(w, m, this.dmg);
          applyLifesteal(this.owner, this.dmg);   // 吸血归属发射者（全队各自独立）
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
      // 敌方子弹也会击中召唤物（无人机可被远程攻击）
      if (!this.dead && G.run && G.run.drones) {
        for (const d of G.run.drones) {
          if (d.hp > 0 && U.dist(this.x, this.y, d.x, d.y) < d.r + 6) {
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

/* ============ 怪物攻击技能（P2：攻击参数全部来自技能表 4e 视图） ============
 * 怪物表只保留 type（AI 行为）与属性；攻击参数由 d.skillList[0] 对应的技能条目提供。
 * 技能表用通用字段名（cd / radius / warnTime / dmgMul），此处归一化成 AI 调用的别名；
 * 显式写了别名时以别名为准（如 boss 的 touchCd 与 cd 不同义）。 */
const MON_ATK_DEFAULT = {
  touchCd: 0.8, fireCd: 2.0, keepDist: 260, bulletSpd: 300,
  chargeRange: 300, telegraph: 0.6, dashSpd: 520, dashTime: 0.4, chargeCd: 3.0,
  boomWarn: 1.5, boomRadius: 200, touchMul: 0.6,
  minionId: "NM0010", minionWave: 2, minionCd: 8.0,
};
function monsterAttackSkill(d, lv) {
  const skId = d.skillList && d.skillList[0];
  const se = (skId ? skillEntry(skId, lv) : null) || {};
  const D = MON_ATK_DEFAULT;
  const pick = (alias, generic) => (se[alias] != null ? se[alias]
    : (generic && se[generic] != null ? se[generic] : D[alias]));
  return {
    id: skId || null, name: se.name || d.name,
    atkMul: se.dmgMul != null ? se.dmgMul : 1,      // 攻击伤害倍率（× 怪物 atk）
    touchCd: pick("touchCd", "cd"),
    fireCd: pick("fireCd", "cd"),
    chargeCd: pick("chargeCd", "cd"),
    boomCd: pick("boomCd", "cd"),
    boomWarn: pick("boomWarn", "warnTime"),
    boomRadius: pick("boomRadius", "radius"),
    keepDist: pick("keepDist", null), bulletSpd: pick("bulletSpd", null),
    chargeRange: pick("chargeRange", null), telegraph: pick("telegraph", null),
    dashSpd: pick("dashSpd", null), dashTime: pick("dashTime", null),
    touchMul: pick("touchMul", null),
    minionId: pick("minionId", null), minionWave: pick("minionWave", null),
    minionCd: pick("minionCd", null),
  };
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
    this.sprite = G.sprites[d.sprite];
    this.flashT = 0;
  }
  update(w, dt) {
    this.flashT -= dt;
    const p = G.player;
    const distP = U.dist(this.x, this.y, p.x, p.y);
    const ak = this.ak;   // 攻击技能参数（来自技能表 4e 视图，见 monsterAttackSkill）
    switch (this.d.type) {
      case "melee": {
        const h = nearestTarget(this.x, this.y);
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
        const h = nearestTarget(this.x, this.y);
        const ang = Math.atan2(h.y - this.y, h.x - this.x);
        const distH = U.dist(this.x, this.y, h.x, h.y);
        if (distH > ak.keepDist + 40) {
          this.x += Math.cos(ang) * this.effSpd * dt; this.y += Math.sin(ang) * this.effSpd * dt;
        } else if (distH < ak.keepDist - 60) {
          this.x -= Math.cos(ang) * this.effSpd * 0.7 * dt; this.y -= Math.sin(ang) * this.effSpd * 0.7 * dt;
        }
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && distH < 620) {
          this.fireTimer = ak.fireCd;
          w.enemyBullets.push(new Bullet(this.x, this.y, ang, ak.bulletSpd, this.atk * ak.atkMul, "enemy"));
        }
        break;
      }
      case "charger": {
        const h = nearestTarget(this.x, this.y);
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
        const ang = Math.atan2(p.y - this.y, p.x - this.x);
        this.x += Math.cos(ang) * this.effSpd * dt;
        this.y += Math.sin(ang) * this.effSpd * dt;
        // 圆形范围爆炸（预警 → 爆炸，命中范围内所有英雄）
        this.boomTimer -= dt;
        if (this.warnT > 0) {
          this.warnT -= dt;
          if (this.warnT <= 0) {
            for (const h of enemyTargets()) {
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
        const hb = nearestTarget(this.x, this.y);
        if (U.dist(this.x, this.y, hb.x, hb.y) < this.r + hb.r && this.touchTimer <= 0) {
          targetTakeDamage(w, hb, this.atk * ak.touchMul); this.touchTimer = ak.touchCd;
        }
        break;
      }
    }
    // 障碍物推挤
    resolveObstacles(this, w);
    this.x = U.clamp(this.x, this.r, w.w - this.r);
    this.y = U.clamp(this.y, this.r, w.h - this.r);
  }
}

const _tmpArr = [];

function nearestMonster(w, x, y, exclude) {
  let best = null, bd = Infinity;
  for (const m of w.monsters) {
    if (m.dead || m === exclude) continue;
    const d = U.dist(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function damageMonster(w, m, dmg) {
  const cuDef = (G.run && G.run.curse) ? G.run.curse.defMul : 1;   // 诅咒附加的"防御 ×N"被动
  const real = Math.max(1, Math.round(dmg - m.d.def * cuDef - (m.eliteDef || 0)));
  // 精英「护盾」词缀：先扣盾，盾破前本体不受损
  if (m.shield > 0) {
    m.shield -= real; m.flashT = 0.1;
    if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
    spawnBurst(m.x, m.y, "#6cb2ff", 4); SFX.play("hit");
    if (m.shield <= 0) { m.shield = 0; spawnBurst(m.x, m.y, "#6cb2ff", 14); }
    return;
  }
  m.hp -= real; m.flashT = 0.1;
  if (G.run && G.run.stats && m.d.type !== "boss") G.run.stats.dmgDealt += real;
  spawnBurst(m.x, m.y, "#ffd76a", 4);
  SFX.play("hit");
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    onMonsterKilled(w, m);
  }
}

/* 精英怪编号判定（ED 前缀）：ED 由关卡层定点投放，不进随机圆 */
function isEliteDef(id) {
  return typeof id === "string" && id.slice(0, 2) === "ED";
}

/* ---------- 精英怪标注：独立精英（ED）与词缀转化共用 ----------
 * 字段约定：m.isElite = 精英标记；m.eliteAffixes = 携带的 1~2 条词缀名数组。
 * （旧字段 m.elite 曾同时表示"标记 + 词缀数组"，语义冲突，已拆分。） */
function applyElite(m) {
  const ecfg = CFG.elites;
  const names = Object.keys(ecfg.affixes);
  const n = U.randInt(ecfg.affixCount[0], ecfg.affixCount[1]);
  const picked = [];
  const pool = names.slice();
  for (let i = 0; i < n && pool.length; i++) picked.push(pool.splice(U.randInt(0, pool.length - 1), 1)[0]);
  m.isElite = true;
  m.eliteAffixes = picked;
  for (const name of picked) {
    const a = ecfg.affixes[name];
    if (a.hpMul) { m.hpMax *= a.hpMul; m.hp = m.hpMax; }
    if (a.defAdd) m.eliteDef = (m.eliteDef || 0) + a.defAdd;
    if (a.atkMul) m.atk *= a.atkMul;
    if (a.spdMul) { m.d = { ...m.d, spd: m.d.spd * a.spdMul }; }
    if (a.shieldHp) m.shield = a.shieldHp;
  }
  m.r *= ecfg.sizeMul;   // 体型放大（碰撞与贴图同步）
}

/* ---------- 邪神雕像倍率（多效果并列，见 CFG.monsterScale） ----------
 * 读 r.scale[key] 的 mul；只影响"后续生成"的怪物，不回溯已生成的怪。 */
function monsterScaleMul(key) {
  const r = G.run;
  const s = r && r.scale && r.scale[key];
  return (s && typeof s.mul === "number") ? s.mul : 1;
}
// 把某个"目标"的倍率套用到怪物（按 CFG.monsterScale.targets 的 applyHp/applyAtk 开关）
function applyMonsterScale(m, targetName) {
  const tcfg = CFG.monsterScale.targets[targetName];
  if (!tcfg || !tcfg.key) return;
  const mul = monsterScaleMul(tcfg.key);
  if (mul === 1) return;
  if (tcfg.applyHp) { m.hpMax *= mul; m.hp = m.hpMax; }
  if (tcfg.applyAtk) { m.atk *= mul; }
}
// 全场怪物上限（"小怪数量"开 applyCap 时 ×mul，默认关闭；有性能风险）
function monsterCap() {
  const base = (G.levelCfg && G.levelCfg.monsterCap) || 200;
  const tcfg = CFG.monsterScale.targets["小怪数量"];
  if (tcfg && tcfg.applyCap) return Math.max(1, Math.round(base * monsterScaleMul(tcfg.key)));
  return base;
}
/* 解析"编号:权重/编号:权重"怪物池字符串（ED/BS 不进随机圆，此处只透传，过滤在 spawnWave） */
function parseWeightPool(str) {
  const out = {};
  (str || "").split("/").forEach(s => {
    const [id, wt] = s.split(":");
    if (id && wt != null) out[id] = Number(wt);
  });
  return out;
}

function explode(w, x, y, radius, dmg, side) {
  spawnBurst(x, y, "#6cb2ff", 26, radius);
  if (side !== "player") {   // Boss 爆炸等敌方爆炸 → 强震动
    G.shakeT = CFG.audio.shake.dur; G.shakeAmp = CFG.audio.shake.bossBoom;
  }
  SFX.play("skill");
  if (side === "player") {
    const cands = w.monsterHash.query(x, y, radius + 40, _tmpArr);
    const seen = new Set();
    for (const m of cands) {
      if (m.dead || seen.has(m)) continue;
      if (U.dist(x, y, m.x, m.y) <= radius + m.r) { damageMonster(w, m, dmg); seen.add(m); }
    }
  }
}

/* ---------- 掉落 / 击杀 ---------- */
function onMonsterKilled(w, m) {
  const r = G.run, lv = G.levelCfg;
  const rm = r.curse ? r.curse.rewardMul : 1;   // 诅咒风险回报：掉落倍率（待细化36）
  r.kills++;
  SFX.play("kill");
  if (w.isMain) {
    // 金币与经验宝石掉落（地上拾取物，走过自动拾取；Boss 分裂成多枚）
    const n = m.d.type === "boss" ? 5 : 1;
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "coin", Math.max(1, Math.round(m.d.coin / n * rm)));
    for (let i = 0; i < n; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(1, Math.round(m.d.exp / n * rm)));
    // 精英击杀计数（工匠雕像池"精英猎杀"触发条件用）
    if (m.isElite) r.eliteKills = (r.eliteKills || 0) + 1;
    // 工匠雕像改由「雕像池」投放（CFG.artisan，见 updateArtisanPool）：此处不再定点生成
    // Boss 触发：进度满 或 时限到（先到者）
    if (!r.bossSpawned && (r.kills >= lv.progressGoal || r.runTime >= lv.timeLimit)) {
      spawnBoss(w);
    }
  } else if (w.kind === "rift") {
    // 裂缝子地图：金币/经验照常掉落；击杀达标 → 刷出奖励宝箱雕像
    spawnPickup(w, m.x, m.y, "coin", Math.max(1, Math.round(m.d.coin * rm)));
    spawnPickup(w, m.x, m.y, "exp", Math.max(1, Math.round(m.d.exp * rm)));
    r.riftKills = (r.riftKills || 0) + 1;
    if (!r.riftRewarded && r.riftKills >= CFG.rift.rewardKills) {
      r.riftRewarded = true;
      const pos = w.findFreeSpot(120);
      if (pos) {
        w.altars.push({ cfg: { name: "裂缝宝箱", color: "#ffd76a", icon: "▣", radius: 91, channel: 1.2,
          effects: [{ type: "giveChest", weights: CFG.rift.chestWeights }] }, x: pos.x, y: pos.y, id: "RIFT_CHEST" });
        UI.toast("▣ 裂缝奖励宝箱出现了！", "gold");
      }
    }
  }
  // 精英怪（独立 ED 或词缀转化）：必掉宝箱（按权重自动入包）+ 额外经验
  if (m.isElite) {
    const item = makeChestItem(U.weightedPick(CFG.elites.dropChest));
    if (r.backpack.tryStackChest(item) || (() => { const s = r.backpack.findSpot(item); return s ? (r.backpack.place(item, s.x, s.y), true) : false; })()) {
      UI.toast(`★ 精英「${(m.eliteAffixes || []).join("·")}」掉落 ${item.name}`, "gold");
    } else UI.toast("背包已满，精英宝箱作废", "bad");
    for (let i = 0; i < CFG.elites.extraExp; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(2, Math.round(m.d.exp)));
  }
  spawnBurst(m.x, m.y, "#9aa7b8", 10);
}

function spawnPickup(w, x, y, type, value) {
  const a = U.rand(0, Math.PI * 2), s = U.rand(40, 110);
  w.pickups.push({ type, value, x: x + U.rand(-10, 10), y: y + U.rand(-10, 10),
    vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 });
}

/* ---------- 工匠雕像池（4.6）：配额池 + 限制器 + 多触发条件 ----------
 * 模型：**触发条件（多条并存）把配额投进池** → **限制器**决定配额何时、以何频率落成
 * 地图上的一座真实雕像。雕像被使用后立即从地图移除（"生效后消失"），池继续产出，
 * 因此**工匠子世界可无限次进入**——"无限次"由池的持续产出保证，而非次数豁免。 */
function createArtisanPool() {
  return {
    quota: 0,                    // 池中待投放配额
    spawned: 0,                  // 本关已投放座数（受 limiter.maxPerLevel 限制）
    cooldown: 0,                 // 使用雕像后的冷却剩余（秒）
    pending: false, readyAt: 0,  // 配额就绪 → 随机延迟后落地
    state: { firstDone: false, progressMarks: 0, bossDone: false, eliteMarks: 0, pityTimer: 0 },
  };
}

/* 场上工匠雕像数量（限制器：同屏最多 maxOnField 座） */
function artisanFieldCount(w) {
  let n = 0;
  for (const a of w.altars) if (a.id === "ALTAR_005") n++;
  return n;
}

function updateArtisanPool(w, dt) {
  const r = G.run, lv = G.levelCfg, cfg = CFG.artisan;
  if (!r || !r.artisanPool || !w.isMain || !cfg) return;
  const lim = cfg.limiter, a = r.artisanPool, st = a.state;
  if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
  // --- 触发条件：多条并存，任一满足即投配额（互不排斥） ---
  for (const t of cfg.triggers) {
    switch (t.type) {
      case "levelKills":      // 首次里程碑：击杀数达到关卡 artisanAtKills
        if (!st.firstDone && r.kills >= (lv.artisanAtKills || 0)) { st.firstDone = true; a.quota += t.quota; }
        break;
      case "progressStep": {  // 击杀进度每 step 一次（最多 max 次）
        const marks = Math.floor((r.kills / Math.max(1, lv.progressGoal)) / t.step);
        const cap = t.max === undefined ? marks : Math.min(marks, t.max);
        while (st.progressMarks < cap) { st.progressMarks++; a.quota += t.quota; }
        break;
      }
      case "bossDefeated":
        if (!st.bossDone && r.bossDefeated) { st.bossDone = true; a.quota += t.quota; }
        break;
      case "eliteKills": {    // 每击杀 perQuota 只精英一次（最多 max 次）
        const marks = Math.floor((r.eliteKills || 0) / Math.max(1, t.perQuota || 1));
        const cap = t.max === undefined ? marks : Math.min(marks, t.max);
        while (st.eliteMarks < cap) { st.eliteMarks++; a.quota += t.quota; }
        break;
      }
      case "pity":            // 保底：距上次雕像出现超过 interval 秒
        st.pityTimer += dt;
        if (st.pityTimer >= t.interval) { st.pityTimer = 0; a.quota += t.quota; }
        break;
    }
  }
  // --- 限制器：每关上上限（配额再高也不再产出） ---
  if (a.spawned >= lim.maxPerLevel) { a.quota = 0; a.pending = false; return; }
  // --- 落地判定：有配额 + 场上未超上限 + 无冷却 ---
  if (!a.pending && a.quota > 0 && artisanFieldCount(w) < lim.maxOnField && a.cooldown <= 0) {
    a.pending = true;
    a.readyAt = U.rand(lim.spawnDelay[0], lim.spawnDelay[1]);   // 随机延迟落地，出现时机显得"随机"
  }
  if (a.pending) {
    a.readyAt -= dt;
    if (a.readyAt <= 0) {
      a.pending = false;
      const pos = w.findFreeSpot(lim.minDistFromPlayer);
      if (pos) {
        w.altars.push({ cfg: CFG.altars.ALTAR_005, x: pos.x, y: pos.y, id: "ALTAR_005" });
        a.quota = Math.max(0, a.quota - 1);
        a.spawned++;
        st.pityTimer = 0;                 // 保底计时以"上次雕像出现"为起点
        r.artisanSpawned = true;
        UI.toast("⚒ 工匠雕像出现了！", "gold");
      }
    }
  }
}

function spawnBoss(w) {
  const r = G.run;
  r.bossSpawned = true;
  if (r.stats) r.stats.timeToBoss = r.runTime;   // 记录 Boss 出现时刻（结算"Boss 耗时"依赖它）
  const pos = w.findFreeSpot(200);   // 至少离玩家 200，离墙 90
  const bossId = G.levelCfg.boss || "BS0001";
  const boss = new Monster(bossId, pos.x, pos.y, G.levelCfg.monsterLevel || 1);
  applyMonsterScale(boss, "BOSS属性");   // 邪神"BOSS属性"倍率：生成时套用一次（不回溯）
  w.monsters.push(boss);
  w.boss = boss;
  UI.toast(`⚠ BOSS「${CFG.monsters[bossId].name}」出现了！`, "bad");
  EventBus.emit("bossSpawned");
}

function onBossDefeated(w) {
  const r = G.run;
  r.bossDefeated = true;
  if (r.stats) {
    // 注意不能用 `||`：timeToBoss 为 0 时是合法值，会被误判为缺失导致耗时恒为 0
    const t0 = r.stats.timeToBoss === undefined ? r.runTime : r.stats.timeToBoss;
    r.stats.bossFightTime = Math.max(0, r.runTime - t0);
  }
  // 撤离点雕像（5.2）：Boss 死亡位置生成撤离点雕像，小队成员站进雕像圈内即自动读条 8 秒撤离
  if (!r.exitStatue) {
    r.exitStatue = { x: w.boss.x, y: w.boss.y };
    UI.toast("BOSS 已被击败！撤离点雕像在原地出现，**站进雕像圈内**即自动读条 8 秒撤离", "gold");
  }
}

/** 撤离点判定（5.2，口径已更新）：
 *  **任一存活英雄在圈内即自动读条**（队长或任一 AI 队友都算，不再需要按 E）；
 *  「圈内英雄全部离开」→ 进度按判定通用规则衰退（移动本身不再单独打断）；
 *  受击仍立即归零（见 heroTakeDamage）；撤离点雕像始终留在原地，可反复重读。
 *  判定是单一实例（单一进度 + 单一持有者 extractHolder）→ 多个英雄同圈不可能同时触发同一个撤离判定。 */
function updateExtractJudge(dt) {
  const r = G.run;
  if (!r || !r.exitStatue) return;
  const st = r.exitStatue;
  const done = judgeChannel(r, st.x, st.y, CFG.extract.radius, dt, CFG.extract.channel,
    "extractProgress", "extractHolder");
  if (done) { r.extractChanneling = false; EventBus.emit("extractSuccess"); }
  else r.extractChanneling = !!r.extractHolder;   // 兼容字段：供 HUD / 提示显示「是否正在读条」
}
/** 离开主地图（进工匠世界 / 裂缝）时清空撤离读条状态：雕像保留在原地，回来站进圈内可继续读 */
function clearExtractChannel() {
  const r = G.run;
  if (!r) return;
  r.extractChanneling = false; r.extractProgress = 0; r.extractHolder = null;
}

function gainExp(v) {
  const r = G.run;
  r.exp += v;
  while (r.exp >= r.expNext) {
    r.exp -= r.expNext; r.lv++;
    r.expNext = Math.round(14 + (r.lv - 1) * 9);
    spawnFloat(G.player.x, G.player.y - 44, `LV ${r.lv}！`, "#c79bff");
    r.cardAssets++;
    SFX.play("levelup");
    UI.toast(`升级！LV ${r.lv}（属性提升 · 属性卡牌 +1，工匠世界可用）`, "gold");
  }
}

/* ---------- 属性卡牌（8.3 / 13.15：资产累积、工匠世界使用、池内同属性去重） ---------- */
function rollCardQuality() {
  const w = CFG.cardPool.qualityWeights;
  return Number(U.weightedPick({ 0: w[0], 1: w[1], 2: w[2], 3: w[3] }));
}
function drawCardCandidates() {
  const r = G.run;
  // 同属性去重：已使用的属性不再出现（dedupApplied 可关）；候选内也不重复
  const used = CFG.cardPool.dedupApplied ? new Set(r.appliedCards.map(c => c.attr)) : new Set();
  const attrs = Object.keys(CFG.cardPool.attrs).filter(a => !used.has(a));
  const n = Math.min(CFG.cardPool.candidateCount, attrs.length);
  const out = [], pool = attrs.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(U.randInt(0, pool.length - 1), 1)[0];
    const q = rollCardQuality();
    out.push({ attr: a, q, value: CFG.cardPool.attrs[a].flat[q] });
  }
  return out;
}
function useCard(idx) {
  const r = G.run;
  if (!G.inArtisan || r.cardAssets <= 0 || !r.cardCandidates || !r.cardCandidates[idx]) return false;
  const c = r.cardCandidates[idx];
  r.cardAssets--;
  r.appliedCards.push(c);
  r.cardCandidates = drawCardCandidates();   // 用掉一张后补抽新候选
  recomputeWeapon();
  SFX.play("altar");
  return true;
}
/* 刷新候选卡牌（规则 2：局内金币三用途之一 —— 刷新属性卡牌）
 * 先用每局免费次数；免费次数为 0 后扣金币（CFG.cardPool.refreshCost）；金币不足则刷新失败
 * （不扣钱）并提示。契约：成功返回 true，失败返回 false（界面层据此决定提示）。 */
function refreshCards() {
  const r = G.run;
  if (!G.inArtisan) return false;
  if (r.cardRefresh > 0) {                     // 免费次数优先（每局固定 2 次）
    r.cardRefresh--;
    r.cardCandidates = drawCardCandidates();
    return true;
  }
  const cost = CFG.cardPool.refreshCost;       // 免费次数用完 → 金币刷新
  if (r.coin < cost) {
    UI.toast(`金币不足，无法刷新候选卡牌（需 ${cost}）`, "bad");
    return false;
  }
  r.coin -= cost;
  r.cardCandidates = drawCardCandidates();
  return true;
}

/* ---------- 工匠世界金币服务（规则 2：局内金币三用途之二三 —— 购买武器模块 / 购买道具） ----------
 * 交易接口契约（界面层按此调用）：返回 {ok:boolean, msg:string}；
 * 内部完成金币判定与扣除、物品生成与入包、失败原因文案；不调 UI.toast（统一由界面层提示）。
 * 背包放不下 → 物品放入 r.pendingItems（工匠待分配区，与开箱/商店同机制）。
 * 仅工匠世界内可用（G.inArtisan），否则拒绝。 */
const QUAL_KEY_INDEX = { normal: 0, advanced: 1, epic: 2, divine: 3 };   // 品质名 → itemQualities 下标
/* 物品入包：复用既有入包路径（保险先叠加未满堆叠；宝箱按品质叠加；否则找空位；再不行进待分配区）。
 * 返回 true = 已入背包；false = 已放入待分配区。 */
function grantItemToRun(r, item) {
  if (item.kind === "insurance") {
    const exist = r.backpack.items.find(x => x.kind === "insurance" && x.count < CFG.insurance.maxStack);
    if (exist) { exist.count++; exist.value = CFG.insurance.value * exist.count; return true; }
  }
  if (r.backpack.tryStackChest(item)) return true;
  const s = r.backpack.findSpot(item);
  if (s) { r.backpack.place(item, s.x, s.y); return true; }
  r.pendingItems.push(item);
  return false;
}
function shopBuyModule() {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在工匠世界内购买" };
  const r = G.run, cfg = CFG.artisanServices.buyModule;
  if (r.coin < cfg.cost) return { ok: false, msg: `金币不足（需 ${cfg.cost}）` };
  r.coin -= cfg.cost;
  // 复用 makeModule（品质/词缀/等级生成与掉落完全一致）：品质按配置权重，定义随机取自模块表
  const itemQ = QUAL_KEY_INDEX[U.weightedPick(cfg.qualityWeights)] || 0;
  const item = makeModule(U.pick(CFG.moduleDefs).id, itemQ);
  const placed = grantItemToRun(r, item);
  return { ok: true, msg: placed ? `已购买：${item.name}` : `已购买：${item.name}（背包已满，已放入待分配区）` };
}
function shopBuyItem() {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在工匠世界内购买" };
  const r = G.run, cfg = CFG.artisanServices.buyItem;
  if (r.coin < cfg.cost) return { ok: false, msg: `金币不足（需 ${cfg.cost}）` };
  r.coin -= cfg.cost;
  // 道具池 = 现有两类消耗品：保险契约 / 诅咒道具（复用各自构造器与既有入包路径，不新增物品类型）
  const kind = U.weightedPick({ ins: CFG.insurance.chance, curse: CFG.curseItems.chance });
  const item = kind === "ins" ? makeInsurance() : makeCurse();
  const placed = grantItemToRun(r, item);
  return { ok: true, msg: placed ? `已购买：${item.name}` : `已购买：${item.name}（背包已满，已放入待分配区）` };
}

/* ---------- 玩家死亡（16.6） ---------- */
function onPlayerDeath() {
  if (G.state !== "playing") return;
  const penalty = calcDeathPenalty(G.run);
  G.state = "dead";
  EventBus.emit("playerDied", penalty);
}

function calcDeathPenalty(run) {
  // 未开封宝箱全部损失；已开出装备/模块按总价值随机损失约 70%
  // 保险契约：每份保护 1 件价值最高的物品（含宝箱）；契约本身不参与损失
  const lost = [], kept = [];
  let lostValue = 0, totalValue = 0;
  const all = [];
  for (const it of run.backpack.items.slice()) if (it.kind === "chest") { lost.push(it); lostValue += it.value; }
    else if (it.kind !== "insurance") { all.push(it); totalValue += it.value; }
  for (const it of run.weaponInv.items) { all.push(it); totalValue += it.value; }
  const target = totalValue * CFG.deathPenalty.loseRatio;
  const pool = all.slice();
  while (lostValue < target && pool.length) {
    const i = U.randInt(0, pool.length - 1);
    const it = pool.splice(i, 1)[0];
    lostValue += it.value; lost.push(it);
  }
  // 保险结算：从未开封损失物中按价值从高到低逐件保护；按实际保护数消耗契约
  const had = insuranceCount(run);
  let used = 0;
  while (used < had && lost.length) {
    let bi = 0;
    for (let i = 1; i < lost.length; i++) if (lost[i].value > lost[bi].value) bi = i;
    const saved = lost.splice(bi, 1)[0];
    lostValue -= saved.value; saved.byInsurance = true; kept.push(saved);
    used++;
  }
  if (used > 0) consumeInsurance(run, used);
  for (const it of all) if (!lost.includes(it) && !kept.includes(it)) kept.push(it);
  return { lost, kept, lostValue, totalValue, contractsUsed: used, contractsLeft: had - used };
}

/* ---------- 局内→局外资源转化（待细化 5 已定：撤离成功时只折算背包物品） ---------- */
/* 撤离结算折算（统一口径）：背包 / 武器栏内**每件物品**都有固定「价值」，
 * 一律 × CFG.settleConvert.valueRate 折算为结晶 —— 宝箱 / 装备 / 武器模块 / 消耗品同一套，不再分类别。
 * 局内经验与金币一律归零、不参与折算（死亡时同样不折算）。 */
function calcSettleConvert(run) {
  const sc = CFG.settleConvert;
  const rate = sc.valueRate;
  const b = { chest: 0, gear: 0, item: 0, card: 0, total: 0 };
  const take = (it) => {
    const v = Math.floor((it.value || 0) * rate);
    if (it.kind === "chest") b.chest += v;                                          // 未开封宝箱（不带出本体，价值折算）
    else if (it.kind === "gear" || it.kind === "module") b.gear += v;               // 装备 / 武器模块
    else b.item += v;                                                               // 消耗品：保险契约 / 诅咒道具 等
  };
  for (const it of run.backpack.items) take(it);
  for (const it of run.weaponInv.items) take(it);
  b.card = Math.floor((run.cardAssets || 0) * sc.cardValue * rate);                 // 属性卡牌资产（固定价值 4/张）
  b.total = b.chest + b.gear + b.item + b.card;
  return b;
}

/* ============ 世界 ============ */
class World {
  constructor(w, h, isMain, kind) {
    this.w = w; this.h = h; this.isMain = isMain; this.kind = kind || (isMain ? "main" : "artisan");
    this.obstacles = [];
    this.monsters = []; this.playerBullets = []; this.enemyBullets = [];
    this.groundChests = []; this.altars = []; this.pickups = [];
    this.monsterHash = new SpatialHash(96);
    this.circles = []; this.spawnTimer = 0;
    this.boss = null;
    this.npc = null; this.exitBeacon = null; this.returnBeacon = null;
    // 子地图开场冻结（5.1）：>0 时全员静止 + 全员无敌，只推进倒计时；0 = 正常战斗
    this.freezeTimer = 0;
    // 子地图交互读条进度：显式初始化，避免"未跑过 update 时为 undefined"造成的取值歧义
    this.returnProgress = 0; this.npcProgress = 0; this.exitProgress = 0;
    if (isMain) this.setupMain();
    else if (this.kind === "rift") this.setupRift();
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
  }
  setupArtisan() {
    // 工匠世界：无敌人安全区；NPC + 固定返回出口
    this.obstacles = [];
    this.npc = { x: this.w / 2, y: this.h / 2 - 60 };
    this.exitBeacon = { x: this.w / 2, y: this.h - 130 };
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
    // 子地图开场冻结（5.1）：全员静止 + 全员无敌 —— 只推进倒计时，其余战斗逻辑（怪物/子弹/祭坛/
    // 拾取/任务限时/伤害结算）全部暂停；玩家与同伴的更新由 main.js 主循环同步跳过
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
    // 诅咒道具倒计时（待细化36）：到期消退，已附加在敌人身上的修改器同时失效（新生成怪不再继承）
    if (r.curse) {
      r.curse.remain -= dt;
      if (r.curse.remain <= 0) { r.curse = null; UI.toast("☠ 诅咒已消退", "gold"); }
    }
    // 怪物
    this.monsterHash.clear();
    for (const m of this.monsters) if (!m.dead) this.monsterHash.insert(m, m.x, m.y, m.r);
    for (const m of this.monsters) if (!m.dead) m.update(this, dt);
    const before = this.monsters.length;
    this.monsters = this.monsters.filter(m => !m.dead);
    if (this.isMain && this.boss && this.boss.dead && !r.bossDefeated) onBossDefeated(this);
    // 召唤物（无人机）：随召唤者 + 自动攻击；仅「被击毁」时移除（召唤者倒下不回收）
    for (const d of (r.drones || [])) if (d.hp > 0) d.update(this, dt);
    r.drones = (r.drones || []).filter(d => d.hp > 0);
    // 陷阱（大地雷）：**留在原地**，与布设者脱钩（布设者走开/倒下都不影响）；不被敌人攻击；
    // 敌人进入范围 → 引信延迟 → 爆炸 → 消失
    for (let i = (r.traps || []).length - 1; i >= 0; i--) {
      const t = r.traps[i];
      if (!t.armed) {
        const cands = this.monsterHash.query(t.x, t.y, t.radius + 40, _tmpArr);
        if (cands.some(m => !m.dead && U.dist(t.x, t.y, m.x, m.y) < t.radius + m.r)) {
          t.armed = true; t.fuse = t.armDelay;
        }
      } else {
        t.fuse -= dt;
        if (t.fuse <= 0) {
          explode(this, t.x, t.y, t.radius, t.dmg, "player");
          r.traps.splice(i, 1);
        }
      }
    }
    // 弹道
    for (const b of this.playerBullets) b.update(this, dt);
    for (const b of this.enemyBullets) b.update(this, dt);
    this.playerBullets = this.playerBullets.filter(b => !b.dead);
    this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
    // 地上宝箱拾取（自动）
    const p = G.player;
    for (const c of this.groundChests.slice()) {
      if (U.dist(p.x, p.y, c.x, c.y) < p.r + 26) {
        const item = makeChestItem(c.chestQ);
        if (r.backpack.tryStackChest(item)) { this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
        else {
          const spot = r.backpack.findSpot(item);
          if (spot) { r.backpack.place(item, spot.x, spot.y); this.groundChests.splice(this.groundChests.indexOf(c), 1); UI.toast(`拾取 ${item.name}`, ""); }
          else UI.toast("背包已满且无可叠加同品质宝箱，无法拾取", "bad");
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
    // 工匠世界交互（同规则：**任一成员**在圈内即可，不限队长；触发后需先离开圈再重新进入，同一判定不重复触发）
    if (!this.isMain && this.kind === "artisan") {
      const nearNpc = !!heroInCircle(this.npc.x, this.npc.y, 90);
      const fired = judgeChannel(this, this.npc.x, this.npc.y, 90, dt, 1.0, "npcProgress", "npcHolder");
      if (fired && !this._npcBlocked) { this._npcBlocked = true; EventBus.emit("openArtisanUI"); }
      if (!nearNpc) this._npcBlocked = false;
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
        if (r.backpack.tryStackChest(item) || (() => { const s = r.backpack.findSpot(item); return s ? (r.backpack.place(item, s.x, s.y), true) : false; })()) {
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
function resolveObstacles(e, w) {
  for (const o of w.obstacles) {
    const cx = U.clamp(e.x, o.x, o.x + o.w), cy = U.clamp(e.y, o.y, o.y + o.h);
    const dx = e.x - cx, dy = e.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < e.r && d > 0.001) {
      const push = (e.r - d);
      e.x += dx / d * push; e.y += dy / d * push;
    } else if (d === 0) { e.y = o.y - e.r; }
  }
}
function blockedByObstacle(w, x, y) {
  for (const o of w.obstacles) {
    if (x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 6) return true;
  }
  return false;
}

/* ============ 特效 ============ */
const FX = { parts: [], floats: [] };
function spawnBurst(x, y, color, n = 10, radius = 20) {
  for (let i = 0; i < n; i++) {
    const a = U.rand(0, Math.PI * 2), s = U.rand(40, radius * 4 + 80);
    FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.2, 0.55), maxLife: 0.55, color, size: U.rand(2, 5) });
  }
}
function spawnFloat(x, y, txt, color) {
  FX.floats.push({ x, y, txt, color, life: 1.1 });
}
function updateFX(dt) {
  for (const p of FX.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  FX.parts = FX.parts.filter(p => p.life > 0);
  for (const f of FX.floats) { f.y -= 34 * dt; f.life -= dt; }
  FX.floats = FX.floats.filter(f => f.life > 0);
  if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
}

/* ============ 渲染 ============ */
function render() {
  const ctx = G.ctx, w = G.activeWorld;
  ctx.fillStyle = (G.levelCfg && G.levelCfg.theme) || "#141a24";
  ctx.fillRect(0, 0, G.W, G.H);
  if (!w) return;
  ctx.save();
  if (G.shakeT > 0) {   // 屏幕震动（受击/Boss 爆炸），随剩余时间线性衰减
    const a = (G.shakeAmp || 0) * (G.shakeT / CFG.audio.shake.dur);
    ctx.translate(U.rand(-a, a), U.rand(-a, a));
  }
  // 摄像机：zoom 变焦 + 跟随玩家 + 地图边缘钳制（地图小于视口则居中）
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  let camX, camY;
  if (w.w <= viewW) camX = (w.w - viewW) / 2;
  else camX = U.clamp(G.player.x - viewW / 2, 0, w.w - viewW);
  if (w.h <= viewH) camY = (w.h - viewH) / 2;
  else camY = U.clamp(G.player.y - viewH / 2, 0, w.h - viewH);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);
  // 地面网格
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += 96) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  // 墙
  ctx.strokeStyle = "#3a4a66"; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物
  for (const o of w.obstacles) {
    ctx.fillStyle = "#2a3648"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  // 祭坛
  for (const a of w.altars) {
    ctx.beginPath(); ctx.arc(a.x, a.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = a.cfg.color + "33"; ctx.fill();
    ctx.strokeStyle = a.cfg.color; ctx.lineWidth = 2.5; ctx.stroke();
    // 交互圈（虚线 = 真实判定圈，直接用 cfg.radius，与判定同源）
    ctx.setLineDash([6, 6]); ctx.strokeStyle = a.cfg.color + "55";
    ctx.beginPath(); ctx.arc(a.x, a.y, a.cfg.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = a.cfg.color; ctx.fillText(a.cfg.icon, a.x, a.y);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#e8ecf2";
    ctx.fillText(a.cfg.name, a.x, a.y + 40);
    // 进度环（与雕像绑定：圈内积累，离开缓慢衰退）
    if (a.progress > 0) {
      const frac = Math.min(1, a.progress / a.cfg.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(a.x, a.y, 34, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", a.x, a.y - 44);
    }
  }
  // 撤离点雕像（5.2）：主地图当前撤离点，绿色系信标风格（虚线圈 = 判定圈，与祭坛同一契约）
  if (w.isMain && G.run && G.run.exitStatue) {
    const st = G.run.exitStatue, rExt = CFG.extract.radius;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(st.x, st.y, rExt, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(st.x, st.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("▲", st.x, st.y);
    ctx.font = "13px sans-serif"; ctx.fillStyle = "#7de08a";
    ctx.fillText(`撤离点（圈内自动读条 ${CFG.extract.channel} 秒）`, st.x, st.y - 46);
    // 读条进度环：画在雕像位置（受击归零；圈内英雄全部离开则缓慢衰退）
    if (G.run.extractChanneling && G.run.extractProgress > 0) {
      const frac = Math.min(1, G.run.extractProgress / CFG.extract.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(st.x, st.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", st.x, st.y - 58);
    }
  }
  // 工匠世界 NPC / 返回信标（虚线圈 = 判定圈，与祭坛同一契约）
  if (!w.isMain && w.kind === "artisan") {
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#ffd76a55";
    ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 90, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    drawActor(ctx, w.npc.x, w.npc.y, 40, "#ffd76a", "⚒");
    ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd76a";
    ctx.fillText("工匠（靠近开箱）", w.npc.x, w.npc.y - 56);
    if (w.npcProgress > 0) {
      const frac = Math.min(1, w.npcProgress / 1.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.npc.x, w.npc.y, 48, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", w.exitBeacon.x, w.exitBeacon.y);
    ctx.font = "13px sans-serif"; ctx.fillText("返回出口（读条3秒）", w.exitBeacon.x, w.exitBeacon.y - 46);
    if (w.exitProgress > 0) {
      const frac = Math.min(1, w.exitProgress / 3.0);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.exitBeacon.x, w.exitBeacon.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", w.exitBeacon.x, w.exitBeacon.y - 58);
    }
  }
  // 空间裂缝返回信标：地上随机刷出，读条 5 秒（受击归零），离开圈进度保留
  if (w.kind === "rift" && w.returnBeacon) {
    const b = w.returnBeacon;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
    ctx.beginPath(); ctx.arc(b.x, b.y, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(b.x, b.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#7de08a33"; ctx.fill();
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "20px sans-serif"; ctx.fillText("◀", b.x, b.y);
    ctx.font = "13px sans-serif"; ctx.fillText(`返回信标（读条${CFG.rift.channel}秒）`, b.x, b.y - 46);
    if (w.returnProgress > 0) {
      const frac = Math.min(1, w.returnProgress / CFG.rift.channel);
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", b.x, b.y - 58);
    }
  }
  // 地上宝箱
  for (const c of w.groundChests) {
    const col = CFG.chestQualities[c.chestQ].color;
    ctx.fillStyle = col; ctx.strokeStyle = "#fff8"; ctx.lineWidth = 1.5;
    ctx.fillRect(c.x - 13, c.y - 10, 26, 20);
    ctx.strokeRect(c.x - 13, c.y - 10, 26, 20);
  }
  // 掉落物：金币 / 经验宝石
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const pk of w.pickups) {
    if (pk.type === "coin") {
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd76a"; ctx.fill();
      ctx.strokeStyle = "#8a6a1a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "#8a6a1a"; ctx.font = "bold 9px sans-serif";
      ctx.fillText("¥", pk.x, pk.y + 0.5);
    } else {
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y - 8); ctx.lineTo(pk.x + 6, pk.y);
      ctx.lineTo(pk.x, pk.y + 8); ctx.lineTo(pk.x - 6, pk.y); ctx.closePath();
      ctx.fillStyle = "#c79bff"; ctx.fill();
      ctx.strokeStyle = "#5a3a8a"; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  // 怪物
  const szMul = CFG.monsterSizeMul || 1;
  for (const m of w.monsters) {
    const img = m.sprite;
    const size = (m.d.type === "boss" ? 130 : 48) * szMul * (m.isElite ? CFG.elites.sizeMul : 1);
    // 精英光环 + 词缀名
    if (m.isElite) {
      const affixes = m.eliteAffixes || [];
      const col = (CFG.elites.affixes[affixes[0]] && CFG.elites.affixes[affixes[0]].color) || "#e5a04b";
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = col + "22"; ctx.fill();
      ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = col; ctx.fillText("精英·" + affixes.join("·"), m.x, m.y - size / 2 - 20);
      // 护盾条
      if (m.shield > 0) {
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
        ctx.fillStyle = "#6cb2ff"; ctx.fillRect(m.x - 20, m.y - size / 2 - 32, 40, 4);
      }
    }
    if (img) {
      ctx.save();
      if (m.flashT > 0) ctx.filter = "brightness(2)";
      ctx.drawImage(img, m.x - size / 2, m.y - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = m.d.type === "boss" ? "#e5484d" : "#c96"; 
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    // 血条
    const bw = m.d.type === "boss" ? 110 : 34;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw, 5);
    ctx.fillStyle = m.d.type === "boss" ? "#ff5b5b" : "#e5a04b";
    ctx.fillRect(m.x - bw / 2, m.y - size / 2 - 12, bw * Math.max(0, m.hp / m.hpMax), 5);
    // 冲锋预警
    if (m.d.type === "charger" && m.state === "telegraph") {
      const ang = Math.atan2(G.player.y - m.y, G.player.x - m.x);
      ctx.strokeStyle = "#ff5b5b"; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(ang) * m.ak.chargeRange, m.y + Math.sin(ang) * m.ak.chargeRange); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Boss 爆炸预警圈
    if (m.d.type === "boss" && m.warnT > 0) {
      const t = m.warnT / m.ak.boomWarn;
      ctx.strokeStyle = `rgba(229,72,77,${0.4 + 0.4 * Math.sin(G.time * 14)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.ak.boomRadius * (1 - t * 0.15), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(229,72,77,0.08)"; ctx.fill();
    }
  }
  // 弹道
  for (const b of w.playerBullets) {
    ctx.fillStyle = b.isSkill ? "#6cb2ff" : "#ffd76a";
    ctx.beginPath();
    if (b.isSkill) { ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); }
    else { ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); }
    ctx.fill();
    if (b.isSkill) { ctx.strokeStyle = "#6cb2ff66"; ctx.beginPath(); ctx.arc(b.x, b.y, b.aoe * 0.4, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const b of w.enemyBullets) {
    ctx.fillStyle = "#c79bff";
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // 玩家
  const p = G.player;
  const heroImg = G.sprites.hero;
  if (heroImg) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.faceDir, 1);
    ctx.drawImage(heroImg, -30, -34, 60, 60);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7ec8ff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  // 队长头顶血条 + 能量条（与队友同款样式；左上角大血条已移除，队伍信息统一在角色头顶）
  if (G.run) {
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 20, p.y - 40, 40, 4);
    ctx.fillStyle = "#7de08a";
    ctx.fillRect(p.x - 20, p.y - 40, 40 * Math.max(0, G.run.hp / G.run.hpMax), 4);
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(p.x - 20, p.y - 34, 40, 3);
    ctx.fillStyle = "#6cb2ff";
    ctx.fillRect(p.x - 20, p.y - 34, 40 * Math.max(0, Math.min(1, G.run.energy / (G.run.energyMax || 1))), 3);
  }
  // AI 队友（组队）
  if (G.run && G.run.companions) {
    for (const c of G.run.companions) {
      if (!c.alive) {
        ctx.globalAlpha = 0.5; ctx.fillStyle = "#5a6a80";
        ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#aab6c8"; ctx.font = "bold 12px sans-serif";
        ctx.fillText("✖", c.x, c.y + 4); ctx.globalAlpha = 1;
        continue;
      }
      const img = G.sprites.hero;
      if (img) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.faceDir, 1);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(img, -30, -34, 60, 60);
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#8fd0a0"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      }
      // 头顶血条 + 能量条（队友是独立个体：各自有能量池）
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(c.x - 20, c.y - 40, 40, 4);
      ctx.fillStyle = "#7de08a";
      ctx.fillRect(c.x - 20, c.y - 40, 40 * Math.max(0, c.hp / c.hpMax), 4);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(c.x - 20, c.y - 34, 40, 3);
      ctx.fillStyle = "#6cb2ff";
      ctx.fillRect(c.x - 20, c.y - 34, 40 * Math.max(0, Math.min(1, (c.energy || 0) / (c.energyMax || 1))), 3);
    }
  }
  // 陷阱（大地雷）：触发圈虚线 = 触发范围（与伤害范围同源）；引信期闪烁
  if (G.run && G.run.traps) {
    for (const t of G.run.traps) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = t.armed ? "rgba(255,91,91," + (0.5 + 0.4 * Math.sin(G.time * 18)) + ")" : "#e5a04b66";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = "#3a4250"; ctx.fill();
      ctx.strokeStyle = "#e5a04b"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = t.armed && Math.sin(G.time * 18) > 0 ? "#ff5b5b" : "#e5a04b";
      ctx.beginPath(); ctx.arc(t.x, t.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 召唤物（无人机）：青色机体 + 头顶血条
  if (G.run && G.run.drones) {
    for (const d of G.run.drones) {
      if (d.hp <= 0) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(G.time * 6);   // 旋翼旋转感
      ctx.strokeStyle = "#54d8e8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#54d8e8"; ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(d.x - 12, d.y - 20, 24, 3.5);
      ctx.fillStyle = "#54d8e8";
      ctx.fillRect(d.x - 12, d.y - 20, 24 * Math.max(0, d.hp / d.hpMax), 3.5);
    }
  }
  // 撤离读条环（5.2：任意位置激活，环画在队长脚下）
  const rr = G.run;
  if (rr && rr.extractChanneling && rr.extractProgress > 0) {
    const frac = Math.min(1, rr.extractProgress / CFG.extract.channel);
    ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(G.player.x, G.player.y, G.player.r + 16, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#7de08a"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`撤离 ${Math.floor(frac * 100)}%`, G.player.x, G.player.y - G.player.r - 26);
  }
  // 特效
  for (const pt of FX.parts) {
    ctx.globalAlpha = pt.life / pt.maxLife;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of FX.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.font = "bold 17px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();   // 收束屏幕震动 translate
  // 屏幕空间 HUD：裂缝任务 / 诅咒状态（不受摄像机影响）
  if (G.run) {
    const t = G.run.riftTask;
    if (G.inRift && t) {
      const st = t.done ? "✔ 已完成" : t.failed ? "✘ 已失败" : (t.time ? `剩余 ${Math.max(0, Math.ceil(t.remain))}s` : "");
      ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = t.done ? "#7de08a" : t.failed ? "#ff5b5b" : "#5ad0ff";
      ctx.fillText(`◈ 任务【${t.name}】：${t.desc} ${st}`, G.W / 2, 34);
    }
    const cu = G.run.curse;
    if (cu) {
      ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#ff8c5a";
      ctx.fillText(`☠ ${cu.name} ${Math.ceil(cu.remain)}s · 敌人强化中 · 掉落 ×${cu.rewardMul}`, G.W / 2, 56);
    }
    // 子地图开场冻结倒计时（5.1）：全员静止 + 全员无敌，红色大字 3/2/1
    const fw = G.activeWorld;
    if (fw && fw.freezeTimer > 0) {
      const n = Math.max(1, Math.ceil(fw.freezeTimer));
      ctx.save();
      ctx.fillStyle = "rgba(8,12,20,0.35)"; ctx.fillRect(0, 0, G.W, G.H);   // 压暗战场，突出倒计时
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 132px sans-serif";
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.strokeText(String(n), G.W / 2, G.H / 2 - 24);
      ctx.fillStyle = "#ff3b3b";
      ctx.fillText(String(n), G.W / 2, G.H / 2 - 24);
      ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "#ffb3b3";
      ctx.fillText("全员冻结中 · 准备战斗", G.W / 2, G.H / 2 + 70);
      ctx.restore();
    }
  }
}
function drawActor(ctx, x, y, size, color, icon) {
  ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color + "44"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = `${size * 0.5}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color; ctx.fillText(icon, x, y);
}
