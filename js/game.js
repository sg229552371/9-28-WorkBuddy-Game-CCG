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

/* ---------- 芯片（第十九章 19.6 / 19.11）----------
 * 芯片 = 局内资产（出局消失、不折算），装在芯片背包 chipInv（6×5）。
 * 白/蓝 = 数值放大（进 tagCalc 统一词条链）；紫/金 = 附加行为（第 4 步只透传 behavior 字段）。
 * defId 前缀约定：C_V_* = 数值芯片，C_B_* = 行为芯片。 */
function chipDefOf(defId, pool) {
  const c = CFG.chips;
  if (!c || !defId) return null;
  if (pool === "value") return (c.valuePool || []).find(x => x.id === defId) || null;
  if (pool === "behavior") return (c.behaviorPool || []).find(x => x.id === defId) || null;
  return (c.valuePool || []).find(x => x.id === defId) || (c.behaviorPool || []).find(x => x.id === defId) || null;
}
/** 芯片重量（19.11.8）：数值 = (q+1)×weightMul；行为 = (q+1)×2×weightMul。系数只读 CFG.chips.weightMul。 */
function chipWeight(chip) {
  const mul = (CFG.chips && CFG.chips.weightMul != null) ? CFG.chips.weightMul : 1;
  const base = (chip.q || 0) + 1;
  return Math.round(base * (chip.behavior ? 2 : 1) * mul * 100) / 100;
}
/** 芯片等级成长有效值（19.11.4）：复用模块 valueStep 口径：value × (1 + (lv-1) × valueStep)。 */
function chipEffValue(chip) {
  const ml = CFG.moduleLevel;
  return (chip.value || 0) * (1 + ((chip.lv || 1) - 1) * (ml ? ml.valueStep : 0));
}
/** 生成芯片（19.11.2）：**defId 前缀决定分支**（C_V_* 数值 / C_B_* 行为），
 *  前缀缺失时才回落到 CFG.chips.qualityMode[q]（品质决定）。
 *  数值芯片 → { kind:"chip", defId, q, lv:1, shape, value, affix:{tag,mode,value} }
 *  行为芯片 → { kind:"chip", defId, q, lv:1, shape, value, behavior } */
function makeChip(defId, q) {
  const c = CFG.chips;
  const qq = (q == null || q < 0 || q > 3) ? 0 : q;
  // 分支判定：前缀优先（C_B_ = 行为）；否则查 qualityMode
  let mode;
  if (defId && defId.indexOf("C_B_") === 0) mode = "behavior";
  else if (defId && defId.indexOf("C_V_") === 0) mode = "value";
  else mode = (c.qualityMode && c.qualityMode[qq]) || "value";
  if (mode === "behavior") {
    const d = chipDefOf(defId, "behavior") || chipDefOf(defId, "value");
    const v = d && d.vals ? d.vals[qq] : 0;
    return { uid: UID++, kind: "chip", defId, q: qq, lv: 1,
      name: d ? d.name : defId, shape: c.shapes.behavior.slice(),
      weight: 0, value: v, behavior: d ? d.behavior : "burn" };
  }
  const d = chipDefOf(defId, "value") || chipDefOf(defId, "behavior");
  const v = d && d.vals ? d.vals[qq] : 0;
  return { uid: UID++, kind: "chip", defId, q: qq, lv: 1,
    name: d ? d.name : defId, shape: c.shapes.value.slice(),
    weight: 0, value: v, affix: { tag: d ? d.tag : "", mode: d ? d.mode : "mult", value: v } };
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

/* ---------- 武器词条计算（16.5：先加算后乘算；19.10.5 / 19.11.4：三源统一词条链） ----------
 * forSkill=true 时额外计入武器模块阶段词缀（阶段词缀只强化主动技能，不影响普攻基础值）。
 * 汇总顺序（同一「先加算后乘算」管线，flat 累加、mul 连乘）：
 *   ① weaponInv 旧模块（兼容期，第 3 步保留）→ ② heroModules 汇总（第 3 步新增）
 *   → ③ chipInv 数值芯片（第 4 步新增；行为芯片跳过）→ ④ 卡牌通道（恒空占位）
 * 全部来源**共用一条链**（方案 6）：不建第二条链。 */
function tagCalc(tag, forSkill) {
  const t = CFG.affixTags[tag];
  let flat = 0, mul = 1;
  const ml = CFG.moduleLevel;
  // ① weaponInv 旧模块（兼容期）
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
  // ② heroModules 汇总（19.10.5）：遍历全部在场英雄槽，跨英雄叠加（19.10.7 全队共享一份词条值）
  if (G.run.heroModules) {
    for (const hid in G.run.heroModules) {
      const slots = G.run.heroModules[hid];
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        if (!slot) continue;                                  // 空槽
        const d = (CFG.moduleDefs || []).find(m => m.id === slot.defId);
        if (!d || !d.affix || d.affix.tag !== tag) continue;
        const eff = (d.affix.vals ? d.affix.vals[0] : 0) * (1 + ((slot.lv || 1) - 1) * (ml ? ml.valueStep : 0));
        if (d.affix.mode === "flat") flat += eff;
        else mul *= (1 + eff);
        // 阶段词缀：与旧模块同一口径（forSkill 时才计）
        if (forSkill && ml && ml.stageAffixes) {
          const stage = Math.min(3, Math.ceil((slot.lv || 1) / (ml.perStage || 3)));
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
  }
  // ③ chipInv 数值芯片（19.11.4）：仅 kind==="chip" 且无 behavior 字段（数值芯片）参与
  if (G.run.chipInv && G.run.chipInv.items) {
    for (const it of G.run.chipInv.items) {
      if (it.kind !== "chip" || it.behavior) continue;         // 行为芯片不进数值链（19.11.5）
      if (!it.affix || it.affix.tag !== tag) continue;
      const eff = chipEffValue(it);                            // 芯片等级成长（复用 moduleEffValue 的 valueStep 口径）
      if (it.affix.mode === "flat") flat += eff;
      else mul *= (1 + eff);
    }
  }
  // ④ 卡牌对武器词条的加成（弹道数量卡；19.7 已退役，通道保留占位）
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
    if (!set || !set.members) continue;      // 跳过非套装条目（如 removed 标记位）
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
/** 行为芯片汇总（19.11.5）：同 type 多枚取 **max**（不叠乘）。返回 {type,value} 或 null。 */
function chipBehaviorSummary() {
  const inv = G.run && G.run.chipInv;
  if (!inv || !inv.items) return null;
  const best = {};
  for (const it of inv.items) {
    if (it.kind !== "chip" || !it.behavior) continue;
    const cur = best[it.behavior];
    if (cur == null || (it.value || 0) > cur) best[it.behavior] = it.value || 0;
  }
  const keys = Object.keys(best);
  if (!keys.length) return null;
  // 同时存在多种行为时取 value 最大者作为主行为（第 5 步消费点按 type 分发；此处只透传单一主行为）
  let type = keys[0];
  for (const k of keys) if (best[k] > best[type]) type = k;
  return { type, value: best[type] };
}
/** 技能 → 本局实际数值：skillEntry（统一的 1~100 级曲线）+ 词条标签 + 武器模块连接/套装加成。
 *  普攻与主动技能共用同一条路径；召唤/陷阱额外产出 row（召唤物/陷阱属性行）。
 *  19.11.5：结果对象上**透传** behavior（行为芯片数据通路；第 5 步才消费）。 */
function resolveSkill(sk, lv, syn) {
  const e = skillEntry(sk, lv);          // ① 等级曲线（公式 + 锚点插值）
  const has = (t) => (sk.tags || []).includes(t);
  const isBasic = sk.kind === "basic";
  const behaves = chipBehaviorSummary();   // 行为芯片（紫/金）：透传字段，不参与数值链
  // 词条标签生效规则（16.5）：主动技能只有声明了该标签才吃；普攻吃除「伤害」外的全部标签
  //（「伤害」倍率与武器模块阶段词缀只强化主动技能，不影响普攻基础值，见 tagCalc）。
  const E = (t) => (isBasic ? t !== "伤害" : has(t));
  if (sk.type === "summon" || sk.type === "trap") {
    // 召唤物 / 陷阱：离散属性全部来自 anchors，伤害走「伤害 / 召唤物 / 陷阱」标签倍率
    const row = { count: e.count, hp: e.hp, atk: e.atk, fireCd: e.fireCd, orbit: e.orbit,
      dmgMul: e.dmgMul, radius: e.radius };
    return { ...e, row, behavior: behaves || undefined,
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
  return { ...e, behavior: behaves || undefined,
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
  for (const c of (r.appliedCards || [])) {    // 属性卡牌（8.3，工匠世界使用后随本局）——19.7 已退役，本循环恒为空
    if (c.attr === "cd") mul.cd *= c.value;
    else if (c.attr === "bullets") { /* 弹道数量在 tagCalc / resolveSkill 内生效（全队同源） */ }
    else if (add[c.attr] != null) add[c.attr] += c.value;
  }
  // 19.4：升级即时属性（原属性卡牌「升级 +1 资产」职能并入）——每升 1 级全队 +baseStatGain，LV1 无加成
  const g19 = CFG.levelUp && CFG.levelUp.baseStatGain;
  if (g19) {
    const n19 = Math.max(0, (r.lv || 1) - 1);
    add.hp += (g19.hp || 0) * n19;
    add.atk += (g19.atk || 0) * n19;
    add.def += (g19.def || 0) * n19;
  }
  // 19.10.4：属性小包兜底累计（模块全满级后升级改给）——并入 add 通道，全队生效，不进 tagCalc
  const sp = r.statPackGain;
  if (sp) {
    add.hp += sp.hp || 0;
    add.atk += sp.atk || 0;
    add.def += sp.def || 0;
    add.spd += sp.spd || 0;
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

/* ---------- 负重惩罚（9.2 线性递减；19.11.8：芯片计入负重） ---------- */
/** 本局总负重 = 背包 + 武器栏 + 芯片背包（芯片重量按 19.11.8 公式单独算）。 */
function totalRunWeight() {
  const r = G.run;
  if (!r) return 0;
  let w = r.backpack.totalWeight() + (r.weaponInv ? r.weaponInv.totalWeight() : 0);
  if (r.chipInv && r.chipInv.items) for (const it of r.chipInv.items) if (it.kind === "chip") w += chipWeight(it);
  return w;
}
function weightFactor() {
  const w = totalRunWeight();
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
        sk.pierce || 0, sk.bounce || 0, isSkill ? sk.radius : 0, isSkill, caster, sk.behavior || null));
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
    // 名下计数只统计**本世界**的召唤物：别的水 map 的编队不占这里的上限，也不会被这里的施放顶掉
    const mine = () => (G.run.drones || []).filter(d => d.hp > 0 && d.owner === caster && (!d.world || d.world === G.activeWorld));
    while (mine().length > want) G.run.drones.splice(G.run.drones.indexOf(mine()[0]), 1);   // 超上限只回收自己最旧的
    // 维修型判定（19.2）：技能条目标 repair:true 或技能 ID 在 CFG.skills2.repairDrone.skillIds 里
    const repairIds = (CFG.skills2 && CFG.skills2.repairDrone && CFG.skills2.repairDrone.skillIds) || [];
    const isRepair = sk.repair === true || repairIds.indexOf(sk.id) >= 0;
    for (let i = mine().length; i < want; i++) {
      const a = (i / Math.max(1, want)) * Math.PI * 2;
      const dr = new Drone(
        caster.x + Math.cos(a) * orbit, caster.y + Math.sin(a) * orbit,
        a, row.hp || 40, Math.max(1, Math.round((row.atk || 6) * (sk.summonMul || 1))),
        row.fireCd || 0.8, orbit, caster, isRepair);
      dr.world = G.activeWorld;   // 世界归属：召唤物只存在于施放时的那张地图，不跨世界跟随（传送后留在原地）
      G.run.drones.push(dr);
    }
    return { n: mine().length, cap: want };
  },
  /** 陷阱：在脚下布设，超出**自己名下**的数量上限时回收自己最旧的那颗。
   *  数量上限 = min(技能锚点数量, **英雄「陷阱数量上限」属性**)。
   *  布置后**留在原地**，与布设者脱钩：布设者走开/倒下都不影响，敌人入圈即延迟引爆。 */
  castTrap(w, caster, sk, atk) {
    const row = sk.row || {};
    const cap = unitCap(caster, "trap", row.count || 1);
    // 名下计数只统计**本世界**的陷阱：主地图的陷阱不占这里的上限，也不会被这里的施放回收
    const mine = () => (G.run.traps || []).filter(t => t.owner === caster && (!t.world || t.world === G.activeWorld));
    if (cap <= 0) return { n: mine().length, cap: 0 };            // 上限为 0：该技能不产出（防死循环）
    while (mine().length >= cap) G.run.traps.splice(G.run.traps.indexOf(mine()[0]), 1);   // 只回收自己的
    G.run.traps.push({
      x: caster.x, y: caster.y, r: 10,
      radius: sk.radius || row.radius || 110,     // 触发范围 = 伤害范围（同源）
      armDelay: sk.armDelay != null ? sk.armDelay : 0.5,
      armed: false, fuse: 0, owner: caster,       // 归属：产物池按成员独立
      world: G.activeWorld,                       // 世界归属：陷阱**留在布设时的那张地图**（传送去子地图它不跟过去）
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

/* ============ 弹幕发射器（第十七章 17.4 / 17.6：Boss 弹幕范式） ============
 * 分工：SkillSystem 管**伤害与词条**（谁打的、吃哪些标签、吸血归属），
 *       PatternSystem 只管**敌方弹幕的几何形状**（画什么花色）——招式参数来自技能表 AT21x 条目。
 * 六种发射器：radial 放射 ｜ spiral 螺旋 ｜ fan 扇形 ｜ wave 波幕 ｜ ring 同心环 ｜ grid 网格/花形。
 * 通用规律（17.2 调研）：同一种发射器只调「**弹数 / 角度 / 速度**」三旋钮，就能覆盖很大的难度区间。
 * 所有发射都先过 bossBudget 护栏（CFG.boss：单只 Boss 每秒发射量 + 同屏存量）。 */
const PatternSystem = {
  /** 形状展开：把「招式」摊成 [{ ang, spdMul, dx, dy }] 纯几何描述，不碰实体（可单测）。
   *  ang = 发射角；spdMul = 速度倍率（ring 分层扩散用）；dx/dy = 出生点相对 Boss 的偏移。 */
  shape(p, aimAng, spinAng) {
    const out = [];
    const kind = p.pattern || "radial";
    const n = Math.max(1, Math.round(p.count || 8));
    const off = p.offset || 0;
    const push = (ang, spdMul, dx, dy) => out.push({ ang, spdMul: spdMul || 1, dx: dx || 0, dy: dy || 0 });
    switch (kind) {
      case "radial":                     // 放射：360° 均匀铺开（教学招 / 底噪）
        for (let i = 0; i < n; i++) push(off + i * Math.PI * 2 / n);
        break;
      case "spiral": {                   // 螺旋：arms 条臂，每次发射整体旋转 spin（调用方累积角度）
        const arms = Math.max(1, Math.round(p.arms || 2));
        for (let i = 0; i < arms; i++) push(spinAng + i * Math.PI * 2 / arms);
        break;
      }
      case "fan": {                      // 扇形：以瞄准角为中心 ±arc/2 均分（逼走位）
        const arc = p.arc != null ? p.arc : Math.PI / 3;
        if (n === 1) push(aimAng);
        else for (let i = 0; i < n; i++) push(aimAng - arc / 2 + arc * i / (n - 1));
        break;
      }
      case "wave": {                     // 波/幕：一排**平行**推进的弹（法向等距错开），速度微差 → 整体略呈弧
        const lat = p.lateral != null ? p.lateral : 24;
        const nx = -Math.sin(aimAng), ny = Math.cos(aimAng);       // 法向单位向量
        for (let i = 0; i < n; i++) {
          const t = (i - (n - 1) / 2) * lat;
          push(aimAng, 1 + (i - (n - 1) / 2) * 0.015, nx * t, ny * t);
        }
        break;
      }
      case "ring": {                     // 同心环：layers 层同角分布，层间角错半格 + 速度递增 → 飞行中自然分层
        const layers = Math.max(1, Math.round(p.layers || 2));
        const lm = p.layerMul != null ? p.layerMul : 0.15;
        for (let k = 0; k < layers; k++)
          for (let i = 0; i < n; i++)
            push(off + i * Math.PI * 2 / n + k * Math.PI / n, 1 + k * lm);
        break;
      }
      case "grid": {                     // 网格/花形：极坐标规则网格，层间角错半格 → 花瓣感（视觉高潮技）
        const layers = Math.max(1, Math.round(p.layers || 2));
        const gap = p.gap != null ? p.gap : 90;
        for (let k = 0; k < layers; k++) {
          const r = (k + 1) * gap;
          for (let i = 0; i < n; i++) {
            const a = off + i * Math.PI * 2 / n + k * Math.PI / n;
            push(a, 1, Math.cos(a) * r, Math.sin(a) * r);
          }
        }
        break;
      }
    }
    return out;
  },
  /** 发射：形状 → 实体；返回**实际发射数**（经护栏裁剪，可能少于形状弹数）。
   *  裁剪时按**等间隔抽取**而非砍尾巴——保证降密度后形状依然对称（护栏的"低密度而非偏瘫"）。 */
  emit(w, m, p, aimAng, spinAng) {
    let desc = this.shape(p, aimAng, spinAng);
    // 护栏①：同屏存量（只统计本 Boss 名下、尚未消亡的弹幕）
    let live = 0;
    for (const b of w.enemyBullets) if (b.owner === m && !b.dead) live++;
    // 护栏②：每秒发射量（以 Boss 自身时钟做滑动窗口，不依赖全局时间）
    const bw = CFG.boss.bulletWindow, now = m.bossClock || 0;
    if (m.budgetT == null || now - m.budgetT >= bw) { m.budgetT = now; m.budgetUsed = 0; }
    const quota = Math.max(0, Math.min(CFG.boss.bulletBudget * bw - (m.budgetUsed || 0), CFG.boss.bulletCap - live));
    const n = Math.max(0, Math.min(desc.length, Math.floor(quota)));
    if (n < desc.length && n > 0) {
      const step = desc.length / n, pick = [];
      for (let i = 0; i < n; i++) pick.push(desc[Math.floor(i * step)]);
      desc = pick;
    }
    const spd = p.bulletSpd || 180;
    const dmg = Math.max(1, Math.round(m.atk * (p.dmgMul != null ? p.dmgMul : 1)));
    const life = p.life != null ? p.life : CFG.boss.bulletLife;
    for (let i = 0; i < n; i++) {
      const d = desc[i];
      const b = new Bullet(m.x + d.dx, m.y + d.dy, d.ang, spd * d.spdMul, dmg, "enemy", 0, 0, 0, false, m);
      b.boss = true;              // 渲染区分（Boss 弹幕更亮）+ 存量统计归属
      b.life = life;              // 慢弹幕需要足够滞空时间（Bullet 默认 2.2s 会在半途消失）
      w.enemyBullets.push(b);
    }
    m.budgetUsed = (m.budgetUsed || 0) + n;
    return n;
  },
};

/* ============ 实体 ============ */
/* ---------- 自动战斗 AI（托管队长的移动；转向力叠加模型） ----------
 * 优先级：躲避威胁(×threatWeight) > 保持攻击距离/风筝 > 索敌
 * 威胁源：① 敌方子弹（预判弹道最近逼近点，垂直/径向闪避）
 *         ② 精英冲锋 telegraph 状态（沿冲锋线垂直侧闪 + 稍远离）
 *         ③ Boss 爆炸预警 warnT（径向逃离预警圈）
 * 反应延迟 reactDelay：威胁首次被看见后须存在该时长才触发躲避（疯狂档反应慢，保留张力）。
 * 撤离读条期间停止走位（站桩输出，不打断读条）；玩家手动操作时 AI 让权。 */
function autoFightMove(p, w, dt) {
  const r = G.run, af = CFG.autoFight;
  const style = af.styles[r.autoStyle] || af.styles[af.defaultStyle];
  if (r.aiHoldT > 0) { r.aiHoldT -= dt; return { dx: 0, dy: 0 }; }   // 手动让权倒计时
  if (r.extractChanneling) return { dx: 0, dy: 0 };                  // 撤离读条：圈内暂停走位
  r.aiClock += dt;
  const now = r.aiClock;
  const seen = r.aiThreatSeen || (r.aiThreatSeen = new Map());

  let tx = 0, ty = 0, threat = 0;   // 威胁躲避向量
  // ① 敌方子弹
  if (style.dodgeBullets) {
    for (const b of w.enemyBullets) {
      if (b.dead) continue;
      const rx = b.x - p.x, ry = b.y - p.y;
      if (Math.hypot(rx, ry) > af.bulletScan) continue;
      if (!seen.has(b)) seen.set(b, now);
      if (now - seen.get(b) < style.reactDelay) continue;
      const vv = b.vx * b.vx + b.vy * b.vy || 1;
      const tCa = -(rx * b.vx + ry * b.vy) / vv;           // 最近逼近时刻
      if (tCa < 0 || tCa > 1.2) continue;                  // 只关心 1.2s 内会逼近的弹
      const cx = rx + b.vx * tCa, cy = ry + b.vy * tCa;    // 最近逼近点（相对玩家）
      const miss = Math.hypot(cx, cy);
      if (miss > p.r + 34) continue;                       // 打不中则忽略
      const wgt = (1 - miss / (p.r + 34)) * (1.2 - tCa);
      if (miss > 1) { tx -= cx / miss * wgt; ty -= cy / miss * wgt; }
      else if (Math.hypot(rx, ry) > 0.5) { const l = Math.hypot(rx, ry); tx -= rx / l * wgt; ty -= ry / l * wgt; }
      threat += wgt;
    }
  }
  // ②③ 预警型威胁（冲锋 / Boss 爆炸圈）
  if (style.dodgeTelegraph) {
    for (const m of w.monsters) {
      if (m.dead) continue;
      const isBossWarn = m.d.type === "boss" && m.warnT > 0;
      const isCharging = m.d.type === "charger" && m.state === "telegraph";
      if (!isBossWarn && !isCharging) continue;
      const dx0 = p.x - m.x, dy0 = p.y - m.y;
      const dist = Math.hypot(dx0, dy0) || 1;
      const R = (isBossWarn ? (m.ak.boomRadius || 0) : (m.ak.chargeRange || 300)) * style.dodgeMargin;
      if (dist > R) continue;
      if (!seen.has(m)) seen.set(m, now);
      if (now - seen.get(m) < style.reactDelay) continue;
      // 方向兜底：威胁体正好压在身上（向量退化）时按固定角度逃离
      let ux = dx0 / dist, uy = dy0 / dist;
      if (Math.abs(dx0) < 1 && Math.abs(dy0) < 1) {
        const a0 = p.aiEscA || (p.aiEscA = U.rand(0, Math.PI * 2));
        ux = Math.cos(a0); uy = Math.sin(a0);
      }
      if (isBossWarn) {
        const wgt = (1 - dist / R) * 3;                    // 径向逃离预警圈
        tx += ux * wgt; ty += uy * wgt; threat += wgt;
      } else {
        const side = p.aiStrafeSide || (p.aiStrafeSide = Math.random() < 0.5 ? 1 : -1);
        const wgt = 2.5 * (1 - dist / R);                  // 垂直冲锋线侧闪 + 稍远离
        tx += -uy * side * wgt + ux * wgt * 0.4;
        ty += ux * side * wgt + uy * wgt * 0.4;
        threat += wgt;
      }
    }
  }
  // 清理已失效威胁的时间戳（子弹/怪物死亡）
  for (const k of seen.keys()) if (k.dead) seen.delete(k);

  // ---- 资源目标（雕像激活 / 掉落拾取）：风格驱动；仅在无近战威胁时行动（战斗优先） ----
  let goal = null;   // {x, y}
  const target = nearestMonster(w, p.x, p.y);
  const tDist = target ? U.dist(p.x, p.y, target.x, target.y) : Infinity;
  // 雕像分类：按 id 识别（裂缝/任务奖励宝箱无 id，按效果类型兜底）；工匠雕像 AI 永不主动踩
  const altarKind = (a) => {
    const eff = (a.cfg && a.cfg.effects) || [];
    if (a.id === "ALTAR_005" || (a.cfg && a.cfg.name && a.cfg.name.indexOf("工匠") >= 0)) return "artisan";
    if (a.id === "ALTAR_002" || eff.some(e => e.type === "randomBuff")) return "war";
    if (a.id === "ALTAR_001" || eff.some(e => e.type === "heal")) return "goddess";
    if ((a.id || "").indexOf("ALTAR_004") === 0 || eff.some(e => e.type === "adjustMonsters")) return "evil";
    return "chest";
  };
  // ① 雕像/祭坛激活：锁定目标 → 走进交互圈 → 圈内站桩读条（读条由 World.update 的 judgeChannel 推进）
  //    风格决定踩哪类：war/chest/evil 按开关；女神需生命 ≤ goddessHp 门槛；残血达门槛时女神优先于其他雕像。
  //    门槛在选目标时判定一次，锁定后读条不反悔（威胁让位时进度保留可回来续读）。
  if (style.altar && typeof style.altar === "object") {
    const ac = style.altar;
    if (r.aiAltar && w.altars.indexOf(r.aiAltar) < 0) { r.aiAltar = null; r.aiAltarT = 0; }   // 已触发被移除
    if (!r.aiAltar) {
      const hpFrac = r.hp / r.hpMax;
      let bd = af.altarRange, bp = 0;   // bp 优先级：女神(达门槛)=2 > 战争/宝箱/邪神=1
      for (const a of w.altars) {
        const kind = altarKind(a);
        let prio = 0;
        if (kind === "goddess") { if (ac.goddessHp != null && hpFrac <= ac.goddessHp) prio = 2; }
        else if (ac[kind]) prio = 1;    // war / chest / evil；artisan 永不在 ac 中开启
        if (prio <= 0) continue;
        const d = U.dist(p.x, p.y, a.x, a.y);
        if (d >= af.altarRange) continue;
        if (prio < bp) continue;                    // 低优先级不抢高优先级
        if (prio === bp && d >= bd) continue;       // 同级取最近
        bd = d; bp = prio; r.aiAltar = a; r.aiAltarT = 0;
      }
    }
    if (r.aiAltar) {
      r.aiAltarT += dt;
      if (r.aiAltarT > af.altarTimeout) { r.aiAltar = null; r.aiAltarT = 0; }   // 超时放弃，防卡死
      else if (heroInCircle(r.aiAltar.x, r.aiAltar.y, r.aiAltar.cfg.radius)) {
        if (threat < 0.8) return { dx: 0, dy: 0 };   // 圈内站桩读条（有预警威胁时仍走躲避，进度保留可回来续读）
        goal = null;                                  // 危险中：先躲避
      } else goal = { x: r.aiAltar.x, y: r.aiAltar.y };
    }
  }
  // ② 掉落拾取（金币/经验宝石/地上宝箱）：gate 决定触发时机——
  //    path=战斗中顺路（贴身小半径，不抢战斗）/ gap=战斗目标较远或清场（战斗间隙）/ clear=战后清扫（目标在清扫圈外）
  if (!goal && threat < 1.2) {
    const loot = style.loot || {};
    const R = loot.range || 0;
    let gate = false;
    if (R > 0) {
      if (loot.gate === "path") gate = true;
      else if (loot.gate === "clear") gate = !target || tDist > R;
      else gate = !target || tDist > af.engageBase * style.engageMul + 50;   // gap（默认）
    }
    if (gate) {
      let bd = R;
      for (const pk of w.pickups) {
        const d = U.dist(p.x, p.y, pk.x, pk.y);
        if (d < bd) { bd = d; goal = { x: pk.x, y: pk.y }; }
      }
      if (loot.chests && (r.aiChestCool || 0) <= 0) {
        for (const c of w.groundChests) {
          const d = U.dist(p.x, p.y, c.x, c.y);
          if (d < bd) { bd = d; goal = { x: c.x, y: c.y }; }
        }
      }
    }
  }
  if (r.aiChestCool > 0) r.aiChestCool -= dt;

  // 走位/索敌向量：有资源目标直奔目标；否则按期望距离风筝/逼近
  let sx = 0, sy = 0;
  if (goal) {
    const dx0 = goal.x - p.x, dy0 = goal.y - p.y;
    const dist = Math.hypot(dx0, dy0) || 1;
    sx = dx0 / dist; sy = dy0 / dist;
  } else if (target) {
    const dx0 = target.x - p.x, dy0 = target.y - p.y;
    const dist = Math.hypot(dx0, dy0) || 1;
    const ux = dx0 / dist, uy = dy0 / dist;
    const hpFrac = r.hp / r.hpMax;
    if (style.lowHpFlee > 0 && hpFrac < style.lowHpFlee) {
      sx = -ux; sy = -uy;                                  // 低血量：转身拉开距离风筝
    } else {
      const want = af.engageBase * style.engageMul * (style.lowHpFlee > 0 && hpFrac < style.lowHpFlee + 0.15 ? 1.4 : 1);
      if (dist > want + 50) { sx = ux; sy = uy; }          // 太远：逼近
      else if (dist < want - 50) { sx = -ux; sy = -uy; }   // 太近：后撤
      else {                                               // 合适距离：环绕风筝
        p.aiStrafeT = (p.aiStrafeT || 0) - dt;
        if (p.aiStrafeT <= 0) { p.aiStrafeT = af.strafeT; p.aiStrafeSide = Math.random() < 0.5 ? 1 : -1; }
        const side = p.aiStrafeSide || 1;
        sx = -uy * side * 0.5; sy = ux * side * 0.5;
      }
    }
  }

  // 合成：威胁躲避(×threatWeight) + 边界保命(×wallWeight) + 走位/索敌/资源(×1)
  const M = af.wallMargin;
  let bx = 0, by = 0;
  if (p.x < M) bx += 1 - p.x / M;                          // 软推力：越贴墙推力越大
  if (p.x > w.w - M) bx -= 1 - (w.w - p.x) / M;
  if (p.y < M) by += 1 - p.y / M;
  if (p.y > w.h - M) by -= 1 - (w.h - p.y) / M;
  let mx = tx * af.threatWeight + sx + bx * af.wallWeight;
  let my = ty * af.threatWeight + sy + by * af.wallWeight;
  // 硬投影：靠墙时压平朝墙外的分量（沿墙切线滑动，绝不主动出界）
  const hard = M * 0.45;
  if (mx < 0 && p.x < hard) mx = 0;
  if (mx > 0 && p.x > w.w - hard) mx = 0;
  if (my < 0 && p.y < hard) my = 0;
  if (my > 0 && p.y > w.h - hard) my = 0;
  let l = Math.hypot(mx, my);
  if (l < 0.05) {
    if (!bx && !by) return { dx: 0, dy: 0 };               // 无任何意图
    const cx0 = w.w / 2 - p.x, cy0 = w.h / 2 - p.y;        // 角落兜底：被完全压平 → 向地图中心逃逸
    const cl = Math.hypot(cx0, cy0) || 1;
    mx = cx0 / cl; my = cy0 / cl; l = 1;
  }
  mx /= l; my /= l;
  const a = Math.min(1, af.smoothing * dt);
  r.aiMvX += (mx - r.aiMvX) * a;
  r.aiMvY += (my - r.aiMvY) * a;
  const ll = Math.hypot(r.aiMvX, r.aiMvY);
  if (ll < 0.08) return { dx: 0, dy: 0 };
  return { dx: r.aiMvX / ll, dy: r.aiMvY / ll };
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
  if (h === G.player) { G.player.takeDamage(w, dmg, ignoreDef); return; }
  // ignoreDef = true（21.1 毒圈比例伤害）：不走防御减免，扣血量即传入值
  const real = ignoreDef ? Math.max(1, Math.round(dmg)) : Math.max(1, Math.round(dmg - companionStats(h).def));
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

const _tmpArr = [];

function nearestMonster(w, x, y, exclude) {
  let best = null, bd = Infinity, bestLos = null, bdLos = Infinity;
  for (const m of w.monsters) {
    if (m.dead || m === exclude) continue;
    const d = U.dist(x, y, m.x, m.y);
    if (d < bd) { bd = d; best = m; }
    if (d < bdLos && losClear(w, x, y, m.x, m.y)) { bdLos = d; bestLos = m; }
  }
  // 优先返回**视线可达**的最近怪：障碍物挡弹道，锁住障碍后的怪只会让子弹打在障碍上
  return bestLos || best;
}

function damageMonster(w, m, dmg, killer) {
  // Boss 阶段转换无敌（17.3）：转换窗口内不吃伤害（子弹照常被消耗，但 Boss 不掉血）
  if (m.phaseInvulnT > 0) { spawnBurst(m.x + U.rand(-m.r, m.r), m.y + U.rand(-m.r, m.r), "#ffffff", 2); return; }
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
    onMonsterKilled(w, m, killer);   // killer = 击杀弹（供 split 裂变读 behavior / owner；普通调用为 undefined）
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
    // 21.14 GC 优化：复用模块级 Set（每帧清空而非 new Set()）。语义与旧实现逐位一致：
    // 只在「真正命中并结算」时 add，故同一怪在多个候选桶里出现也只结算一次。
    const seen = _explodeSeen;
    seen.clear();
    for (const m of cands) {
      if (m.dead || seen.has(m)) continue;
      if (U.dist(x, y, m.x, m.y) <= radius + m.r) { damageMonster(w, m, dmg); seen.add(m); }
    }
  }
}

/* ---------- 掉落 / 击杀 ---------- */
function onMonsterKilled(w, m, killer) {
  const r = G.run, lv = G.levelCfg;
  const rm = r.curse ? r.curse.rewardMul : 1;   // 诅咒风险回报：掉落倍率（待细化36）
  r.kills++;
  Meta.recordMonster(m.defId);   // 图鉴收录：击杀过的怪物永久激活
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
    if (grantItemToRun(r, item, { full: "discard" })) {
      UI.toast(`★ 精英「${(m.eliteAffixes || []).join("·")}」掉落 ${item.name}`, "gold");
    } else UI.toast("背包已满，精英宝箱作废", "bad");
    for (let i = 0; i < CFG.elites.extraExp; i++) spawnPickup(w, m.x, m.y, "exp", Math.max(2, Math.round(m.d.exp)));
  }
  spawnSplitBullets(w, m, killer);   // 行为芯片（19.12）：裂变——击杀弹带 split 时生成小弹
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
  Meta.setFlag("bossKill");   // 称号成就：击败一次 BOSS
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
  extractWaveTick(r, st, dt);        // 方向4：波次围攻 + 护盾推进（真实秒；内部自守卫 paused/frozen）
  dt = extractWeightDt(r, st, dt);   // 方向4：负重 → 读条速率打折；护盾破碎未恢复 → 读条冻结（dt=0）
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

/* ---------- 局内升级（19.4）：经验曲线 fastEarly 公式驱动 + 全队即时属性 ----------
 * 经验来源 = 参与伤害即给（19.4）：经验宝石为**中立掉落物**，任何成员拾取均入**队池**（无个人归属），
 * 因此"参与即给"由拾取制天然满足——没有"击杀者独得"的零和问题。 */
function expNextFor(lv) {
  const c = CFG.levelUp.curve;
  let v = c.base * Math.pow(c.growth, lv - 1);
  if (lv <= c.softCapLv) v *= c.softCapMul;   // 前期额外宽松：开局雪球手感
  return Math.max(1, Math.round(v));
}
/* ---------- 模块槽系统（19.10，第 3 步）----------
 * 获取 = 升级 4 选 1（每英雄独立池），入槽 = 每英雄 4 槽、同名叠加至 9 级，
 * 生效 = 所有英雄 heroModules 汇总为一份词条值喂 tagCalc（全队生效，见 19.10.7）。 */

/** 该英雄模块池 ID 列表（19.10.2 第 2 步）：perHero 未列出回落 default。 */
function heroModulePool(heroId) {
  const mp = CFG.modulePool || {};
  return (mp.perHero && mp.perHero[heroId]) || mp.default || [];
}
/** 池过滤（19.10.2 第 3 步）：剔除该英雄已满级（lv ≥ maxLv）的模块 ID。 */
function offerModuleIds(heroId) {
  const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
  const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
  return heroModulePool(heroId).filter(defId => {
    const owned = slots.find(s => s && s.defId === defId);
    return !(owned && owned.lv >= maxLv);
  });
}
/** 该英雄是否还有空槽（用于槽满策略判定，19.10.3）。 */
function heroHasEmptySlot(heroId) {
  const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
  return slots.some(s => s === null);
}
/** 全队成员英雄 ID 列表（队长 G.heroDef + 队友 G.team，去重保序）。
 *  与 buildHeroModuleSlots / buildModulePoolState 同一口径，见 19.10.1。 */
function teamHeroIds() {
  const ids = [];
  const hd = G.heroDef || (G.team && G.team[0]);
  if (hd && hd.id) ids.push(hd.id);
  for (const h of (G.team || [])) if (h && h.id && ids.indexOf(h.id) < 0) ids.push(h.id);
  return ids;
}
/** 全队池汇总（§5.48 起主路径改「按队友轮转绑定池」，此函数保留给单人池复用）：
 *  遍历在场英雄（队长 + 队友），对每人跑 offerModuleIds(hid)；
 *  **该英雄 4 格已满则整体跳过**（不出他的候选，避免选了装不上）；
 *  汇总为 [{hid, defId}] 候选源（每条带归属英雄，选中后装到该 hid 身上）。
 *  注：主路径不再直接用它混抽，轮转逻辑见 buildLevelUpCandidates；此处保留函数供
 *  单人池（singleHeroId）与既有引用/测试使用。
 *  @param singleHeroId 可选：仅汇总该英雄（poolOverride/单人退化场景，不跨队友） */
function teamModuleOfferPool(singleHeroId) {
  const ids = singleHeroId ? [singleHeroId] : teamHeroIds();
  const src = [];
  for (const hid of ids) {
    if (!heroHasEmptySlot(hid)) continue;      // 满格队友整体排除（规则 4）
    for (const defId of offerModuleIds(hid)) src.push({ hid, defId });
  }
  return src;
}
/** 构造 4 选 1 候选（19.10.6 契约；§5.48 改为**按队友轮转绑定池**）：
 *  第 i 张候选绑定第 i 个在场英雄的可用模块池（ids[i % ids.length] 轮转），
 *  卡数多于队友数时循环回绕；绑定英雄不可用（满格/池抽干）则随机换到其他可用队友池。
 *  - 模块候选 = { kind:"module", heroId, defId, name, desc, lv, locked, ownerName, ownerRoleColor }
 *    heroId = 候选**所属队友**（选中后装到他身上，见 applyLevelUpPick）
 *    ownerName / ownerRoleColor = 归属展示（界面线 B 契约）
 *    locked = 该英雄槽满且未持有 → UI 置灰（禁止选取，不静默销毁，见 19.10.3）
 *  - 兜底 = 无可用队友池（全队都满 / 池空）→ 改出属性小包 4 选 1
 *  @param heroId 升级者英雄 ID（仅用于 poolOverride 回退与兜底归属，不再决定抽取范围）
 *  @param poolOverride 可选，显式指定可用 ID 池（测试/降级用）→ 仅从升级者本人抽取 */
function buildLevelUpCandidates(heroId, poolOverride) {
  const n = (CFG.levelUp && CFG.levelUp.choiceCount) || 4;
  const dup = !(CFG.levelUp && CFG.levelUp.allowDuplicateOffer === false);   // 默认允许重复入选
  const weights = (CFG.modulePool && CFG.modulePool.weights) || null;
  const weighted = !!(CFG.levelUp && CFG.levelUp.weighted && weights);
  const defs = CFG.moduleDefs || [];
  const ui = (typeof UI !== "undefined") ? UI : null;
  // 归属展示快照（ownerName / ownerRoleColor）：界面线 B 契约，缺失容错
  const ownerOf = (hid) => {
    const roleDef = (ui && ui.heroRole && hid) ? ui.heroRole(hid) : null;
    return { ownerName: heroDefNameOf(hid), ownerRoleColor: roleDef ? roleDef.color : null };
  };
  // 单卡构造（19.10.3 槽位状态 + 置灰语义，逐位与旧版一致）
  const makeCard = (hid, defId) => {
    const d = defs.find(m => m.id === defId);
    const slots = (G.run && G.run.heroModules && G.run.heroModules[hid]) || [];
    const owned = slots.find(s => s && s.defId === defId);
    const lv = owned ? Math.min(9, owned.lv + 1) : 1;   // 入槽后等级（UI 展示）
    // 置灰边界（19.10.3）：仅「未持有 + 无空槽」置灰；已持有 lv<9 永不置灰
    const locked = !owned && !heroHasEmptySlot(hid);
    const o = ownerOf(hid);
    return { kind: "module", heroId: hid, defId, name: d ? d.name : defId,
      desc: d ? affixPreview(d) : "", lv, locked,
      ownerName: o.ownerName, ownerRoleColor: o.ownerRoleColor };
  };
  // 出候选：从给定候选源 [{hid, defId}] 抽 n 个（poolOverride 分支复用，语义不变）
  const buildFrom = (src) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!src.length) break;
      let pick;
      if (weighted) {
        const w = {}; for (const s of src) w[s.defId] = weights[s.defId] != null ? weights[s.defId] : 1;
        const chosenId = String(U.weightedPick(w));
        pick = src.find(s => s.defId === chosenId) || src[U.randInt(0, src.length - 1)];
      } else pick = src[U.randInt(0, src.length - 1)];
      const hid = pick.hid, defId = pick.defId;
      out.push(makeCard(hid, defId));
      if (!dup) { const k = src.findIndex(s => s.defId === defId && s.hid === hid); if (k >= 0) src.splice(k, 1); }
    }
    return out;
  };
  // poolOverride：显式池 → 仅从升级者本人抽取（兼容既有测试/降级用法）
  if (poolOverride) {
    if (!poolOverride.length) return statPackCandidates();
    const src = heroHasEmptySlot(heroId) ? poolOverride.map(defId => ({ hid: heroId, defId })) : [];
    if (!src.length) return statPackCandidates();
    const out = buildFrom(src);
    if (out.length && out.every(c => c.locked)) return statPackCandidates();
    return out;
  }
  // 按队友轮转绑定池（§5.48）：第 i 张卡绑第 i 个在场英雄的池，循环回绕，绑定不可用则随机换
  const ids = teamHeroIds();
  const avail = ids.filter(hid => heroHasEmptySlot(hid) && offerModuleIds(hid).length > 0);
  if (!avail.length) return statPackCandidates();
  const taken = new Set();   // "hid|defId"，dup=false 时防重
  const out = [];
  for (let i = 0; i < n; i++) {
    // a. 轮转绑定：第 i 张卡 → 第 i 个在场英雄（ids 空则无绑定）
    let hid = ids.length ? ids[i % ids.length] : null;
    // b. 绑定英雄不可用（无空槽 / 池空）→ 从可用集合随机换一个
    if (!hid || avail.indexOf(hid) < 0) hid = avail[U.randInt(0, avail.length - 1)];
    // c. 取该英雄可抽项（dup=false 时剔除已抽过的 hid|defId）
    const candsOf = (h) => offerModuleIds(h).filter(defId => dup || !taken.has(h + "|" + defId));
    let cands = candsOf(hid);
    // d. 候选被去重抽干 → 从 avail 随机换一个「还有未抽过项」的英雄；仍无 → 结束出卡
    if (!cands.length) {
      const remain = avail.filter(h => candsOf(h).length > 0);
      if (!remain.length) break;
      hid = remain[U.randInt(0, remain.length - 1)];
      cands = candsOf(hid);
    }
    // e. 从 cands 抽 1 个 defId（weighted 启用时仅在本候选集上加权，否则随机）
    let defId;
    if (weighted) {
      const w = {}; for (const id of cands) w[id] = weights[id] != null ? weights[id] : 1;
      defId = String(U.weightedPick(w));
      if (cands.indexOf(defId) < 0) defId = cands[U.randInt(0, cands.length - 1)];
    } else defId = cands[U.randInt(0, cands.length - 1)];
    // f. 记去重 + 构造候选卡（复用单卡构造，逐位同旧版）
    taken.add(hid + "|" + defId);
    out.push(makeCard(hid, defId));
  }
  if (!out.length) return statPackCandidates();
  // 极端保险：若候选全部被置灰，降级为属性小包
  if (out.every(c => c.locked)) return statPackCandidates();
  return out;
}
/** 模块主词缀预览文案（供弹窗 desc）。 */
function affixPreview(d) {
  const v = d.affix.vals ? d.affix.vals[0] : 0;
  if (d.affix.mode === "flat") return `${d.affix.tag} +${v}`;
  return `${d.affix.tag} ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
}
/** 属性小包候选 4 选 1（19.10.4 兜底）。 */
function statPackCandidates() {
  return (CFG.levelUp.statPack || []).map(p => ({ kind: "statPack", packId: p.id, name: p.name, stat: p.stat, value: p.value }));
}
/** 入槽结算（19.10.3）：
 *  - 已持有且 lv<9 → 该槽 lv += stackLevelUp（不新增槽）
 *  - 未持有且有空槽 → 第一个空槽放入 lv=1
 *  - 未持有且 4 槽全满 → 不落槽（应已被置灰；此处兜底直接忽略） */
function applyHeroModulePick(heroId, defId) {
  const r = G.run;
  if (!r || !r.heroModules) return false;
  const slots = r.heroModules[heroId] || (r.heroModules[heroId] = new Array((CFG.moduleSlot && CFG.moduleSlot.perHero) || 4).fill(null));
  const maxLv = (CFG.moduleSlot && CFG.moduleSlot.maxLv) || 9;
  const step = (CFG.moduleSlot && CFG.moduleSlot.stackLevelUp) || 1;
  const owned = slots.find(s => s && s.defId === defId);
  if (owned) {
    if (owned.lv >= maxLv) return false;
    owned.lv = Math.min(maxLv, owned.lv + step);
    return true;
  }
  const idx = slots.indexOf(null);
  if (idx < 0) return false;                 // 槽满且未持有 → 拒绝（置灰路径）
  slots[idx] = { defId, lv: 1 };
  return true;
}
/** 属性小包结算（19.10.4）：累加到 G.run.statPackGain（供 runBonus().add 读取，全队生效）。 */
function applyStatPack(pack) {
  const r = G.run;
  if (!r || !pack) return false;
  if (!r.statPackGain) r.statPackGain = { hp: 0, atk: 0, def: 0, spd: 0 };
  if (r.statPackGain[pack.stat] == null) return false;
  r.statPackGain[pack.stat] += pack.value || 0;
  return true;
}
/** 结算一个 4 选 1（按候选 kind 分发）；返回是否成功。
 *  ⚠️ 全队混抽（§5.47）后**入槽必须用候选所属英雄 cand.heroId**，而非升级者 heroId——
 *  否则「给队友补强」会装错人（本次改动的关键正确性约束）。 */
function applyLevelUpPick(heroId, cand) {
  if (!cand) return false;
  if (cand.kind === "statPack") return applyStatPack(cand);
  if (cand.kind === "module") {
    const owner = cand.heroId || heroId;   // 候选自带归属；缺失时回退升级者（兼容旧形态）
    return applyHeroModulePick(owner, cand.defId);
  }
  return false;
}
/** 弹出一次 4 选 1（19.10.6 契约）：调 UI.onLevelUpChoice(candidates, onPick)。
 *  ⚠️ 无 DOM / UI 未就绪（没有 onLevelUpChoice 函数）时走**默认路径**：自动选第一个可选候选，
 *  绝不能让主循环卡死（铁律）。 */
function presentLevelUpChoice(heroId) {
  const cands = buildLevelUpCandidates(heroId);
  const done = (idx) => {
    const cand = cands[idx];
    applyLevelUpPick(heroId, cand);
    recomputeWeapon();       // 入槽后立即重算全队技能（模块词条生效）
    finishLevelUpChoice(heroId);
  };
  const ui = (typeof UI !== "undefined") ? UI : null;
  if (ui && typeof ui.onLevelUpChoice === "function") {
    setPaused(true);         // 弹窗暂停闸门：主循环跳过世界/玩家/同伴更新（渲染照常）
    /* 归属元信息（界面线 C1 契约，第 3 个参数可选）：让弹窗能显示「给谁选强化」+ 槽位进度。
     * roleColor 用 UI.heroRole（19.2 定位色）；slotUsed 取 heroModules 中已占槽数（19.10）。 */
    const hd = (G.run && G.run.heroDef) || (G.team && G.team[0]) || null;
    const slots = (G.run && G.run.heroModules && G.run.heroModules[heroId]) || [];
    let slotUsed = 0;
    for (let i = 0; i < slots.length; i++) if (slots[i]) slotUsed++;
    const roleDef = (ui.heroRole && heroId) ? ui.heroRole(heroId) : null;
    const meta = {
      heroId,
      heroName: heroDefNameOf(heroId),
      roleColor: roleDef ? roleDef.color : null,
      slotUsed,
      slotPer: slots.length || ((CFG.moduleSlot && CFG.moduleSlot.perHero) || 4),
    };
    ui.onLevelUpChoice(cands, (idx) => done((idx >= 0 && idx < cands.length) ? idx : 0), meta);
    return;
  }
  // 默认路径：自动选第一个「非置灰」候选（没有则取第 0 个），保证升级结算永不悬挂
  let pick = cands.findIndex(c => !c.locked);
  if (pick < 0) pick = 0;
  done(pick);
}
function gainExp(v) {
  const r = G.run, c = CFG.levelUp.curve;
  if (r.lv >= c.maxLv) return;                 // 局内等级封顶（与 99 关主线对齐）
  r.exp += v;
  const ups = [];
  while (r.exp >= r.expNext && r.lv < c.maxLv) {
    r.exp -= r.expNext; r.lv++;
    r.expNext = expNextFor(r.lv);
    spawnFloat(G.player.x, G.player.y - 44, `LV ${r.lv}！`, "#c79bff");
    SFX.play("levelup");
    UI.toast(`升级！LV ${r.lv}（全队属性提升）`, "gold");
    ups.push(r.lv);
  }
  if (r.lv >= c.maxLv) r.exp = 0;              // 封顶后经验不再累积
  // 19.10.2 第 7 步：多级连升排队逐个弹（第 1 个结算完才弹第 2 个）
  if (ups.length) beginLevelUpChoices(G.heroDef.id, ups.length);
}
/** 入队 N 次 4 选 1 并驱动队列；队列空才恢复（解除暂停）。 */
let _levelUpActive = false;      // 模块内闸门（避免单测只加载 game.js 时访问未定义的 Game）
function setPaused(v) {
  if (typeof Game !== "undefined") Game.paused = v;
}
function isPaused() {
  return typeof Game !== "undefined" && Game.paused === true;
}
function beginLevelUpChoices(heroId, n) {
  const r = G.run;
  if (!r) return;
  if (!r.modulePoolState) r.modulePoolState = buildModulePoolState();
  const st = r.modulePoolState[heroId] || (r.modulePoolState[heroId] = { offered: [], queue: [] });
  for (let i = 0; i < n; i++) st.queue.push(1);
  if (!_levelUpActive) { _levelUpActive = true; presentLevelUpChoice(heroId); }
}
/** 一次 4 选 1 完成后的收尾（由 presentLevelUpChoice 的 onPick 回调触发）：
 *  出队 → 队列还有则弹下一个 → 全部完成才解除暂停。 */
function finishLevelUpChoice(heroId) {
  const r = G.run;
  const st = r && r.modulePoolState && r.modulePoolState[heroId];
  if (st && st.queue.length) st.queue.shift();
  if (st && st.queue.length) { presentLevelUpChoice(heroId); return; }
  _levelUpActive = false;
  setPaused(false);
  const ui = (typeof UI !== "undefined") ? UI : null;
  if (ui && typeof ui.onLevelUpChoiceClose === "function") ui.onLevelUpChoiceClose();
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
/* 物品入包（唯一入口）：保险先叠加未满堆叠 → 宝箱按品质叠加 → 找空位放置。
 * 两种「放不下」语义由 opts.full 决定（默认 pending）：
 *   - "pending"（默认）：放入 r.pendingItems（工匠待分配区，与开箱/商店同机制）——用于工匠世界与宝箱开箱；
 *   - "discard"：直接丢弃不保留（主地图精英掉落 / 战争雕像宝箱：一张地图无待分配区，满即作废）。
 * 返回 true = 已入背包；false = 未入背包（pending 时已进待分配区 / discard 时已丢弃）。
 * 六处入包调用统一走此函数，勿再内联手抄（详见 G_docs/dev_guide.md 第 5 节）。 */
function grantItemToRun(r, item, opts) {
  const mode = (opts && opts.full) || "pending";
  if (item.kind === "insurance") {
    const exist = r.backpack.items.find(x => x.kind === "insurance" && x.count < CFG.insurance.maxStack);
    if (exist) { exist.count++; exist.value = CFG.insurance.value * exist.count; return true; }
  }
  if (r.backpack.tryStackChest(item)) return true;
  const s = r.backpack.findSpot(item);
  if (s) { r.backpack.place(item, s.x, s.y); return true; }
  if (mode === "pending") r.pendingItems.push(item);
  return false;
}
/* ---------- 芯片入包（19.11.3）：芯片进 chipInv（6×5）；同名同品质可叠（lv+1，上限 9）。 ----------
 * 返回 true = 已入 chipInv；false = chipInv 满 → 进 r.pendingItems（工匠待分配区）。 */
function grantChipToRun(r, chip) {
  if (!r.chipInv) return false;
  // 同名同品质叠加（19.11.6 merge 之外的自然叠层：获得即叠）
  const maxLv = (r.chipInv && CFG.chips.maxStack) || 9;
  for (const it of r.chipInv.items) {
    if (it.kind === "chip" && it.defId === chip.defId && it.q === chip.q && (it.lv || 1) < maxLv) {
      it.lv = Math.min(maxLv, (it.lv || 1) + 1);
      return true;
    }
  }
  const s = r.chipInv.findSpot(chip);
  if (s) { r.chipInv.place(chip, s.x, s.y); seenChip(chip); return true; }
  r.pendingItems.push(chip);
  seenChip(chip);
  return false;
}
/** 开箱是否落芯片（19.11.3）：按 CFG.chipSources.chest.weight（26）判定（与装备/消耗品并列，不互斥）。
 *  rng 可注入（测试用）；返回芯片实例或 null。 */
function rollChestChip(rng) {
  const src = CFG.chipSources && CFG.chipSources.chest;
  if (!src || src.enabled === false) return null;
  const R = rng || Math.random;
  // 权重口径：以 chipSources.chest.weight 为「每箱芯片权重」，其余内容视作基准 100 → 概率 = w/(100+w)
  const total = 100 + (src.weight || 0);
  if (R() * total >= (src.weight || 0)) return null;
  const q = Number(U.weightedPick({ 0: src.itemQW[0], 1: src.itemQW[1], 2: src.itemQW[2], 3: src.itemQW[3] }, R));
  const mode = (CFG.chips.qualityMode && CFG.chips.qualityMode[q]) || "value";
  const pool = mode === "behavior" ? CFG.chips.behaviorPool : CFG.chips.valuePool;
  const def = pool[U.randInt(0, pool.length - 1)];
  return makeChip(def.id, q);
}
/** 芯片图鉴（19.11.7）：只记录「见过的芯片」（局外 Meta.data.chipSeen），不加属性、不折算。 */
function seenChip(chip) {
  if (!chip) return;
  try {
    if (!Meta.data.chipSeen) Meta.data.chipSeen = {};
    Meta.data.chipSeen[chip.defId] = true;
    Meta.commit();
  } catch (e) { /* 无 localStorage 环境忽略 */ }
}
function chipSeen(defId) {
  return !!(Meta.data && Meta.data.chipSeen && Meta.data.chipSeen[defId]);
}
/** 商店购买随机芯片（19.11.3）：契约沿用 §5.25 —— 返回 {ok,msg}，内部判款/扣款/生成/入包，不调 UI.toast。 */
function shopBuyChip(defId) {
  if (!G.inArtisan || !G.run) return { ok: false, msg: "仅可在芯片工坊内购买" };
  const r = G.run, src = CFG.chipSources && CFG.chipSources.shop;
  if (!src || src.enabled === false) return { ok: false, msg: "芯片商店未开放" };
  const cost = src.cost || 0;
  if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
  r.coin -= cost;
  let chip;
  if (defId) chip = makeChip(defId, rollChipQualityByWeights(src.qualityWeights));
  else {
    const q = rollChipQualityByWeights(src.qualityWeights);
    const mode = (CFG.chips.qualityMode && CFG.chips.qualityMode[q]) || "value";
    const pool = mode === "behavior" ? CFG.chips.behaviorPool : CFG.chips.valuePool;
    chip = makeChip(pool[U.randInt(0, pool.length - 1)].id, q);
  }
  const placed = grantChipToRun(r, chip);
  return { ok: true, msg: placed ? `已购买：${chip.name}` : `已购买：${chip.name}（芯片背包已满，已放入待分配区）` };
}
/** 按品质权重抽 q（weights 为 [w0,w1,w2,w3]）。 */
function rollChipQualityByWeights(weights) {
  const w = weights || [55, 28, 14, 3];
  return Number(U.weightedPick({ 0: w[0], 1: w[1], 2: w[2], 3: w[3] }));
}
/* ---------- 芯片工坊三服务（19.11.6）：merge / reroll / craft，统一 {ok,msg}，UI 弹 toast ----------
 * 前置校验 → 消耗金币 → 成功分支 / 失败分支（不改变芯片）。仅工匠世界可用。 */
const ChipForge = {
  /** 在 chipInv 内按 uid 找芯片。 */
  _find(r, uid) { return (r.chipInv ? r.chipInv.items : []).find(it => it.kind === "chip" && it.uid === uid) || null; },
  /** 合成（merge）：选中 ≥2 枚同名同品质 → 目标 lv+1（上限 9），消耗被合芯片。 */
  merge(r, opts) {
    const cost = CFG.chipForge.services.merge.cost;
    const uid = opts && opts.uid;
    const target = uid != null ? this._find(r, uid) : null;
    if (!target) return { ok: false, msg: "未选中目标芯片" };
    if ((target.lv || 1) >= CFG.chips.maxStack) return { ok: false, msg: "该芯片已达满级 9" };
    const others = r.chipInv.items.filter(it => it.kind === "chip" && it !== target && it.defId === target.defId && it.q === target.q);
    if (others.length < 1) return { ok: false, msg: "需至少 2 枚同名同品质芯片" };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    // 消耗 1 枚被合芯片 → 目标 lv+1（同名同品质）
    const consume = others[0];
    r.chipInv.remove(consume);
    target.lv = Math.min(CFG.chips.maxStack, (target.lv || 1) + 1);
    return { ok: true, msg: `合成成功：${target.name} → LV${target.lv}` };
  },
  /** 重铸（reroll）：重掷词条档位（value = vals[新q] 中的档位），保留 defId / tag / 类型。 */
  reroll(r, opts) {
    const cost = CFG.chipForge.services.reroll.cost;
    const uid = opts && opts.uid;
    const chip = uid != null ? this._find(r, uid) : null;
    if (!chip) return { ok: false, msg: "未选中芯片" };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    // 重掷档位：在 vals 里挑一个（保留 defId / tag / behavior，只改 value 档位数值）
    const d = chipDefOf(chip.defId);
    if (d && d.vals) {
      const newQ = Number(U.randInt(0, d.vals.length - 1));
      chip.q = newQ;
      chip.value = d.vals[newQ];
    }
    return { ok: true, msg: `重铸完成：${chip.name}（词条数值重掷）` };
  },
  /** 定向合成（craft）：生成 1 枚指定 defId 芯片，品质按 shop.qualityWeights。 */
  craft(r, opts) {
    const cost = CFG.chipForge.services.craft.cost;
    const defId = opts && opts.defId;
    if (!defId) return { ok: false, msg: "未指定要合成的芯片" };
    if (!chipDefOf(defId)) return { ok: false, msg: `未知芯片：${defId}` };
    if (r.coin < cost) return { ok: false, msg: `金币不足（需 ${cost}）` };
    r.coin -= cost;
    const q = rollChipQualityByWeights(CFG.chipSources.shop.qualityWeights);
    const chip = makeChip(defId, q);
    const placed = grantChipToRun(r, chip);
    return { ok: true, msg: placed ? `已合成：${chip.name}` : `已合成：${chip.name}（芯片背包已满，已放入待分配区）` };
  },
};
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
          explode(this, t.x, t.y, t.radius, t.dmg, "player");
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

/* ============ 特效 ============
 * 21.14 GC 优化：粒子/飘字改**对象池 + 原地尾部交换删除**（去每帧 new + filter 新数组）。
 * FX.parts / FX.floats **仍是可 for...of 的紧凑数组**——池化后即池的 buf（存活恒在 [0,len)），
 * 渲染侧（renderWorld 3794-3806）与此前逐位等价；`FX.parts.length = 0` 亦如常清空。
 * 池未定义（某些测试桩只加载 game.js）时自动降级为旧 push/filter 逻辑，见文件末尾 §5.45 区块。 */
const FX = { parts: [], floats: [], partsPool: null, floatsPool: null };
/* 单行桥接：把池的紧凑存活数组接到 FX 字段上（池存在时才有调用者）。 */
function fxAttachPools() {
  if (typeof Pool === "undefined" || !Pool || typeof Pool.makePool !== "function") return;   // 降级：保持 [] + push/filter
  // 粒子：预分配 512（爆发峰值已够，超出自动扩容），复位钩子清字段防残留
  FX.partsPool = Pool.makePool(function () { return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0.55, color: "#fff", size: 3 }; }, null, 512);
  FX.parts = FX.partsPool.buf;                       // ★ 暴露紧凑存活数组（渲染侧零改动）
  // 飘字：预分配 64（同屏飘字远少于粒子）
  FX.floatsPool = Pool.makePool(function () { return { x: 0, y: 0, txt: "", color: "#fff", life: 0 }; }, null, 64);
  FX.floats = FX.floatsPool.buf;
}
fxAttachPools();   // 加载时立即接线（Pool 存在则池化，否则降级）

function spawnBurst(x, y, color, n = 10, radius = 20) {
  n = lqParticleCount(n);   // 低画质：削减爆发粒子数（渲染/更新两段同时下降；关时原样返回 n）
  const pool = FX.partsPool;
  for (let i = 0; i < n; i++) {
    const a = U.rand(0, Math.PI * 2), s = U.rand(40, radius * 4 + 80);
    // ⚠️ 取值顺序必须与旧实现逐位一致（a、s、life、size 的 U.rand 调用次序不可换）
    const vx = Math.cos(a) * s, vy = Math.sin(a) * s, life = U.rand(0.2, 0.55), size = U.rand(2, 5);
    if (pool) {
      const p = pool.obtain();                       // 复用空闲对象（池空自动新建）
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = 0.55; p.color = color; p.size = size;
    } else {
      FX.parts.push({ x, y, vx, vy, life, maxLife: 0.55, color, size });   // 降级：旧逻辑
    }
  }
}
function spawnFloat(x, y, txt, color) {
  const pool = FX.floatsPool;
  if (pool) {
    const f = pool.obtain();
    f.x = x; f.y = y; f.txt = txt; f.color = color; f.life = 1.1;
  } else {
    FX.floats.push({ x, y, txt, color, life: 1.1 }); // 降级：旧逻辑
  }
}
function updateFX(dt) {
  // 21.14 GC 优化：**稳定就地压缩**（保留存活元素的相对顺序，与旧 `for + filter` 逐位等价）。
  // 为什么不用尾部交换删除？渲染侧按 index 做低画质隔颗抽样（lqShouldDrawParticle(i)），
  // 且绘制顺序可见——交换删除会打乱顺序、改变抽样与叠放，而稳定压缩零新分配且顺序不变。
  const parts = FX.parts, partsPool = FX.partsPool;
  let w = 0;                                   // 写指针：存活元素前移到此
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.life > 0) { if (w !== i) parts[w] = p; w++; }   // 存活：保留（顺序不变）
    else if (partsPool) partsPool.recycle(p);             // 寿终：归还池（不搬移，仅回收）
  }
  // 裁掉尾部（[w, len) 段全是已回收对象或重复引用）——原地截断，无新数组
  if (w < parts.length) parts.length = w;

  const floats = FX.floats, floatsPool = FX.floatsPool;
  let wf = 0;
  for (let j = 0; j < floats.length; j++) {
    const f = floats[j];
    f.y -= 34 * dt; f.life -= dt;                          // 速度 34*dt 与旧实现逐位一致
    if (f.life > 0) { if (wf !== j) floats[wf] = f; wf++; }
    else if (floatsPool) floatsPool.recycle(f);
  }
  if (wf < floats.length) floats.length = wf;

  if (G.shakeT > 0) G.shakeT = Math.max(0, G.shakeT - dt);
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
}
function renderCity() {
  applyLowQualityDPR();   // 低画质：帧内纠偏 canvas 物理分辨率（DPR 封顶）
  const ctx = G.ctx, w = G.activeWorld, a = G.cityAvatar;
  if (!w || w.kind !== "city" || !a) return;
  ctx.fillStyle = "#101822";   // 主城地面主题（比战场更沉稳的夜色调）
  ctx.fillRect(0, 0, G.W, G.H);
  ctx.save();
  // 摄像机：跟随形象 + 边缘钳制（地图小于视口则居中）
  const zoom = (CFG.camera && CFG.camera.zoom) || 1;
  const viewW = G.W / zoom, viewH = G.H / zoom;
  let camX = w.w <= viewW ? (w.w - viewW) / 2 : U.clamp(a.x - viewW / 2, 0, w.w - viewW);
  let camY = w.h <= viewH ? (w.h - viewH) / 2 : U.clamp(a.y - viewH / 2, 0, w.h - viewH);
  ctx.scale(zoom, zoom); ctx.translate(-camX, -camY);
  // 地面网格 + 城墙（低画质：网格步长 ×2 → 整屏描边线数减半）
  const cityGridStep = isLowQuality() ? 96 * LQ_GRID_STEP_MUL : 96;
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += cityGridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += cityGridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  ctx.strokeStyle = "#3f5170"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物（装饰建筑）
  for (const o of w.obstacles) {
    ctx.fillStyle = "#243048"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  // NPC：交互虚线圈（判定 = 绘制 × altarJudgeMul，与祭坛同源契约）+ 头顶功能名
  for (const n of w.cityNpcs) {
    const isNear = G.cityNpcNear && G.cityNpcNear.id === n.id;
    const isOpen = G.cityNpcOpen && G.cityNpcOpen.id === n.id;
    ctx.setLineDash([6, 6]); ctx.strokeStyle = n.color + (isOpen ? "aa" : isNear ? "88" : "44");
    ctx.beginPath(); ctx.arc(n.x, n.y, CFG.city.npcRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    drawActor(ctx, n.x, n.y, 40, n.color, n.icon);
    ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = n.color; ctx.fillText(n.name, n.x, n.y - 52);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#9fb4d4";
    ctx.fillText(n.desc, n.x, n.y + 58);
    if (isNear && !isOpen) {   // 圈内提示（21.10：触屏设备显示「点击进入」，桌面保留「按 E 互动」）
      ctx.font = "bold 13px sans-serif"; ctx.fillStyle = "#ffd76a";
      const touchOnly = (typeof isTouchDevice === "function") && isTouchDevice()
        && !!(CFG.mobile && CFG.mobile.hideTouchButtons);
      ctx.fillText(touchOnly ? "点击进入" : "按 E 互动", n.x, n.y + 74);
    }
  }
  renderCityNpcTapHint(ctx, w);   // 21.10 主城 NPC 点选提示环（金环脉冲 + 「点击进入」浮动文案）
  // 出征传送门：读条环 + 涟漪动画
  const pt = w.portal;
  ctx.beginPath(); ctx.arc(pt.x, pt.y, 34 + 3 * Math.sin(G.time * 3), 0, Math.PI * 2);
  ctx.fillStyle = "#7de08a22"; ctx.fill();
  ctx.strokeStyle = "#7de08a"; ctx.lineWidth = 3; ctx.stroke();
  ctx.setLineDash([6, 6]); ctx.strokeStyle = "#7de08a55";
  ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#7de08a";
  ctx.fillText(pt.name, pt.x, pt.y - 58);
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#9fb4d4";
  ctx.fillText(CFG.city.portal.desc, pt.x, pt.y + 56);
  if (w.portalProgress > 0) {
    const frac = Math.min(1, w.portalProgress / pt.channel);
    ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 42, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(Math.floor(frac * 100) + "%", pt.x, pt.y - 74);
  }
  // 玩家形象（皮肤 = 英雄素材；当前素材未分化时全部英雄共用 hero 图，分化后走 heroDef.sprite）
  const skinKey = CFG.heroes.find(h => h.id === a.skin) ? a.skin : CFG.profile.defaultSkin;
  const heroDef0 = CFG.heroes.find(h => h.id === skinKey);
  const img = G.sprites[(heroDef0 && heroDef0.sprite) || "hero"] || G.sprites.hero;
  if (img) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.faceDir, 1);
    ctx.drawImage(img, -30, -34, 60, 60);
    ctx.restore();
  } else {
    ctx.fillStyle = "#7ec8ff"; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#cfe0ff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText(Meta.profileName(), a.x, a.y - 46);
  ctx.font = "10px sans-serif"; ctx.fillStyle = "#ffd76a";
  ctx.fillText("「" + Meta.titleName() + "」", a.x, a.y - 33);
  ctx.restore();
}

/* ============ 渲染 ============ */
function render() {
  applyLowQualityDPR();   // 低画质：帧内纠偏 canvas 物理分辨率（DPR 封顶）
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
  // 地面网格（低画质：步长 ×2 → 整屏描边线数减半）
  const gridStep = isLowQuality() ? 96 * LQ_GRID_STEP_MUL : 96;
  ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
  for (let x = 0; x < w.w; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.h); ctx.stroke(); }
  for (let y = 0; y < w.h; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.w, y); ctx.stroke(); }
  // 墙
  ctx.strokeStyle = "#3a4a66"; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w.w - 8, w.h - 8);
  // 障碍物
  for (const o of w.obstacles) {
    ctx.fillStyle = "#2a3648"; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#44587a"; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  renderHazard(ctx, w);   // 毒圈收缩（B 线独立区块）：边界环 + 环外渐暗
  renderSupply(ctx, w);   // 补给点（B 线独立区块）：绿色发光圈 + 补给图标
  renderNpcTapHint(ctx, w);   // 21.1 NPC 点选提示环（锁定时灰虚线圈 / 解锁后金环 + 「点击进入」）
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
  /* 视野外剔除（21.13 常态化）：margin = 精灵/血条/光环最大外扩 + 预警圈余量。
   * 视野外的怪物对画面零贡献（看不见），跳过可省 drawImage + 血条 + 光环 + 预警判定。
   * 21.12 压测实测：3000 只时约 55% 在视野外，剔除后 drawCall 大幅下降。
   * ⚠️ 必须给足 margin：Boss 爆炸预警圈/弹幕电报可达半径 200+，预留 260 防"预警圈被裁掉半圈"。 */
  const cullMargin = 260;
  for (const m of w.monsters) {
    if (m.x + cullMargin < camX || m.x - cullMargin > camX + viewW ||
        m.y + cullMargin < camY || m.y - cullMargin > camY + viewH) continue;
    const img = m.sprite;
    const size = (m.d.type === "boss" ? 130 : 48) * szMul * (m.isElite ? CFG.elites.sizeMul : 1);
    // 精英光环 + 词缀名
    if (m.isElite) {
      const affixes = m.eliteAffixes || [];
      const col = (CFG.elites.affixes[affixes[0]] && CFG.elites.affixes[affixes[0]].color) || "#e5a04b";
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 8, 0, Math.PI * 2);
      if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke(); }   // 低画质：跳过光环描边（省一次圆弧描边，仍保留填充色块）
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
    renderBurnAura(ctx, m);   // 行为芯片（19.12）：燃蚀火色描边
    // 冲锋预警
    if (m.d.type === "charger" && m.state === "telegraph") {
      const ang = Math.atan2(G.player.y - m.y, G.player.x - m.x);
      ctx.strokeStyle = "#ff5b5b"; ctx.setLineDash([8, 6]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(ang) * m.ak.chargeRange, m.y + Math.sin(ang) * m.ak.chargeRange); ctx.stroke();
      ctx.setLineDash([]);
    }
    // Boss 爆炸预警圈（17.3 颜色语言：红 = 范围爆炸）
    if (m.d.type === "boss" && m.warnT > 0) {
      const t = m.warnT / m.ak.boomWarn;
      ctx.strokeStyle = `rgba(229,72,77,${0.4 + 0.4 * Math.sin(G.time * 14)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.ak.boomRadius * (1 - t * 0.15), 0, Math.PI * 2);
      if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.stroke(); } else { ctx.fillStyle = "rgba(229,72,77,0.14)"; ctx.fill(); }   // 低画质：描边改纯色填充（省圆弧描边，预警仍可见）
      ctx.fillStyle = "rgba(229,72,77,0.08)"; ctx.fill();
    }
    // Boss 弹幕电报（17.3 颜色语言：白 = 弹幕预警）——充能圈/扇面，到点才真正发射
    if (m.d.type === "boss" && m.patternWarnT > 0 && m.warnP) {
      const P = m.warnP;
      const dur = P.warnTime != null ? P.warnTime : CFG.boss.warnTime;
      const k = dur > 0 ? 1 - m.patternWarnT / dur : 1;          // 0 → 1 的充能进度
      const R = (P.warnRadius || CFG.boss.warnRadius) * (0.35 + 0.65 * k);
      const white = CFG.boss.color.bullet;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = white;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(G.time * 10));
      ctx.beginPath();
      if (P.pattern === "fan" || P.pattern === "wave") {          // 扇形/波幕：画扇面（含瞄准方向）
        const half = (P.arc != null ? P.arc / 2 : 0.3) + (P.pattern === "wave" ? 0.14 : 0);
        ctx.moveTo(m.x, m.y);
        ctx.arc(m.x, m.y, R, m.aimAng - half, m.aimAng + half);
        ctx.closePath();
      } else {                                                    // 放射/同心环/网格：画满圈
        ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Boss 阶段转换无敌护盾（转换窗口内的可见反馈，避免"打了没反应"的困惑）
    if (m.d.type === "boss" && m.phaseInvulnT > 0) {
      const a = 0.3 + 0.3 * Math.abs(Math.sin(G.time * 12));
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a * 0.3})`; ctx.fill();
    }
  }
  // 弹道
  for (const b of w.playerBullets) {
    ctx.fillStyle = b.isSkill ? "#6cb2ff" : "#ffd76a";
    ctx.beginPath();
    if (b.isSkill) { ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); }
    else { ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); }
    ctx.fill();
    if (b.isSkill) { if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = "#6cb2ff66"; ctx.beginPath(); ctx.arc(b.x, b.y, b.aoe * 0.4, 0, Math.PI * 2); ctx.stroke(); } }   // 低画质：跳过技能弹范围描边（子弹本体填充保留）
  }
  /* 敌方弹幕（21.13 批绘重构）：按「外观等价类」分三桶，每桶单 Path 一次 fill。
   * 重构前：每发子弹 3 次 canvas 调用（beginPath + arc + fill）——2000 发 = 6000 次/帧。
   * 重构后：3 桶 × 3 次 = 9 次/帧（与弹幕总量无关）。视觉逐位等价（同色同半径的圆，Path 合并后
   * 填充结果完全一致，仅描边类需独占，故 boss 弹拆两支）。
   * ⚠️ moveTo 必须逐个写：不写会让相邻弹幕被直线连起来（大面积三角填充色块）。 */
  const ebBoss = [], ebSmall = [];
  for (const b of w.enemyBullets) (b.boss ? ebBoss : ebSmall).push(b);
  // 小怪弹：纯色圆填充
  if (ebSmall.length) {
    ctx.fillStyle = "#c79bff";
    ctx.beginPath();
    for (const b of ebSmall) { ctx.moveTo(b.x + 5, b.y); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); }
    ctx.fill();
  }
  // Boss 弹：亮色圆填充（描边另起一支，保持"一眼可分"的辨识度）
  if (ebBoss.length) {
    ctx.fillStyle = "#e6f4ff";
    ctx.beginPath();
    for (const b of ebBoss) { ctx.moveTo(b.x + 6, b.y); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); }
    ctx.fill();
    if (!(LQ_SKIP_GLOW && isLowQuality())) {          // 低画质：跳过弹幕描边外圈（填充已够辨识）
      ctx.strokeStyle = "rgba(160,220,255,.75)"; ctx.lineWidth = 1.5;
      for (const b of ebBoss) { ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  renderLasers(ctx, w);   // Boss 激光（17.7 第 3 步）：预警细线 + 激活粗光柱
  renderChainFx(ctx);     // 行为芯片（19.12）：链锁瞬结线段
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
  // 陷阱（大地雷）：触发圈虚线 = 触发范围（与伤害范围同源）；引信期闪烁。只画本世界的
  if (G.run && G.run.traps) {
    for (const t of G.run.traps) {
      if (t.world && t.world !== G.activeWorld) continue;
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
  // 召唤物（无人机）：青色机体 + 头顶血条。只画本世界的
  if (G.run && G.run.drones) {
    for (const d of G.run.drones) {
      if (d.hp <= 0 || (d.world && d.world !== G.activeWorld)) continue;
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
  for (let pi = 0; pi < FX.parts.length; pi++) {
    if (!lqShouldDrawParticle(pi)) continue;   // 低画质：隔颗抽样绘制（省填充；正常恒绘制）
    const pt = FX.parts[pi];
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

/* ============================================================================
 * 第十七章 17.7 第 3 步：Boss 激光实体 `LaserBeam` + 弹幕吞噬机制
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发要求：只在 spawnBoss / Boss update 里
 * 插入单行调用，避免与其它代理的行级冲突）。
 *
 * 激光不进门板弹幕的弹道预算（17.9-2）：子弹走 CFG.boss.bulletBudget / bulletCap，
 * 激光走**独立上限** laserCfg("laserCap", 6) = 6（17.6「独立上限 ≤ 6 束」）。
 *
 * 三段生命周期（17.6「预热（变粗）→ 持续（伤害）→ 收束」）：
 *   warn   ：青线预热（细线，**无伤害**，对应 17.3 颜色语言「青 = 激光」）
 *   active ：粗光柱，按帧结算伤害（线段-圆命中，走 heroTakeDamage 队友受伤入口）
 *   fade   ：收束消散（光柱变淡，**无伤害**）
 *
 * 弹幕吞噬（17.4 原型 6 弹幕吞噬 / 文档 2641 行「LaserBeam 走弹幕吞噬路径」）：
 *   **激活中的激光会吞噬穿过的玩家子弹**（skill 弹 / 普攻残弹均吞，普攻已退役）。
 *   被吞的子弹**不发伤害、直接消亡**（这是 Boss 的反制手段：玩家需「停火等光束过去」）。
 *   ⚠️ 只吞 playerBullets，不吞 enemyBullets（不吞自家弹幕）。 */

// ---- 激光数值（读 CFG.boss.*，缺省回退到硬编码值；数值统一在 js/config.js 调整） ----
function laserCfg(key, dft) {
  const b = (typeof CFG !== "undefined" && CFG.boss) ? CFG.boss : null;
  return (b && b[key] != null) ? b[key] : dft;
}
// 同屏激光束上限（17.6「独立上限 ≤ 6 束」）：直接读 CFG.boss.laserCap

/** 点到**线段**的最短距离（线段-圆命中判定核心，纯几何，可单测）。
 *  返回 (px,py) 到线段 (x0,y0)-(x1,y1) 的最短距离。 */
function pointSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return Math.hypot(px - x0, py - y0);   // 退化为点
  let t = ((px - x0) * dx + (py - y0) * dy) / len2;
  t = t < 0 ? 0 : (t > 1 ? 1 : t);                          // 投影钳到线段内
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** 线段-圆命中：线段 (x0,y0)-(x1,y1) 与圆心 (cx,cy) 半径 r 的圆是否相交。
 *  等价判据：点到线段最短距离 < 半径。抽成独立函数便于单测与复用。 */
function segCircleHit(x0, y0, x1, y1, cx, cy, r) {
  return pointSegDist(cx, cy, x0, y0, x1, y1) < r;
}

/** 激光段（线段-圆）命中判定的**纯函数**入口：给定激光参数与目标，返回是否命中。
 *  抽成独立函数：测试无需真正实例化 Boss/World 即可锁定几何正确性。 */
function laserHitsTarget(laser, target) {
  if (!laser || !target) return false;
  const len = laser.len || laserCfg("laserLen", 1600);
  const x1 = laser.x + Math.cos(laser.ang) * len;
  const y1 = laser.y + Math.sin(laser.ang) * len;
  return segCircleHit(laser.x, laser.y, x1, y1, target.x, target.y, target.r);
}

class LaserBeam {
  /** @param w 世界  @param owner 发射者（Boss）
   *  @param x,y 起点  @param ang 朝向（弧度）
   *  @param opts { len, halfW, warn, active, fade, dmg } —— 未给时取本区块局部常量 */
  constructor(w, owner, x, y, ang, opts) {
    opts = opts || {};
    this.w = w; this.owner = owner;
    this.x = x; this.y = y; this.ang = ang;
    this.len = opts.len != null ? opts.len : laserCfg("laserLen", 1600);
    this.halfW = opts.halfW != null ? opts.halfW : laserCfg("laserHalfW", 12);
    this.warnT = opts.warn != null ? opts.warn : laserCfg("laserWarn", 0.9);
    this.activeT = opts.active != null ? opts.active : laserCfg("laserActive", 1.6);
    this.fadeT = opts.fade != null ? opts.fade : laserCfg("laserFade", 0.35);
    this.dmg = opts.dmg != null ? opts.dmg : (owner && owner.atk ? owner.atk * laserCfg("laserDmgMul", 0.5) : 10);
    this.dmgInterval = opts.dmgInterval != null ? opts.dmgInterval : laserCfg("laserDmgInterval", 0.25);
    // 三段状态机：warn → active → fade → dead
    this.phase = "warn";
    this.t = 0;                 // 当前阶段已用时
    this.dmgTimer = 0;          // 本帧累计到下一次伤害结算的时间
    this.dead = false;
    this.world = w;             // 世界归属（与产物池一致，跨世界冻结）
    this.devoured = 0;          // 累计吞噬的玩家子弹数（供测试与统计）
  }
  /** 推进生命周期计时：warn → active → fade → dead。返回本帧是否处于「激活」（造成伤害）阶段。 */
  tick(dt) {
    if (this.dead) return false;
    this.t += dt;
    if (this.phase === "warn") {
      if (this.t >= this.warnT) { this.phase = "active"; this.t = 0; this.dmgTimer = 0; }
    } else if (this.phase === "active") {
      if (this.t >= this.activeT) { this.phase = "fade"; this.t = 0; }
    } else if (this.phase === "fade") {
      if (this.t >= this.fadeT) { this.dead = true; }
    }
    return this.phase === "active";
  }
  /** 光柱末端坐标（渲染 + 命中判定共用）。 */
  endPoint() {
    return { x: this.x + Math.cos(this.ang) * this.len, y: this.y + Math.sin(this.ang) * this.len };
  }
  /** 伤害结算：仅在 active 期、按 dmgInterval 节流，命中所有存活英雄走 heroTakeDamage。 */
  damageTick(w, dt) {
    if (this.phase !== "active") return 0;
    this.dmgTimer += dt;
    if (this.dmgTimer < this.dmgInterval) return 0;
    this.dmgTimer -= this.dmgInterval;
    let hits = 0;
    for (const h of aliveHeroes()) {
      // 线段-圆命中：半径取「英雄碰撞半径」与「光柱半宽」的较大者（光柱本身有宽度）
      if (laserHitsTarget(this, { x: h.x, y: h.y, r: Math.max(h.r, this.halfW) })) {
        heroTakeDamage(w, h, this.dmg);
        hits++;
      }
    }
    return hits;
  }
  /** 弹幕吞噬：激活中的激光吞噬穿过的玩家子弹（不发伤害、直接消亡）。
   *  守卫：仅 active 期吞噬；只吞 playerBullets；命中判据同样是线段-圆。 */
  devourBullets(w) {
    if (this.phase !== "active") return 0;
    let eaten = 0;
    for (const b of w.playerBullets) {
      if (b.dead) continue;
      if (laserHitsTarget(this, { x: b.x, y: b.y, r: this.halfW + 6 })) {
        b.dead = true;               // 吞掉：本体消亡，**不结算伤害**
        eaten++;
      }
    }
    this.devoured += eaten;
    return eaten;
  }
  update(w, dt) {
    if (this.dead) return;
    this.tick(dt);                  // 生命周期推进
    this.devourBullets(w);          // 弹幕吞噬（仅 active 期）
    this.damageTick(w, dt);         // 伤害结算（仅 active 期，按段）
  }
}

/** 激光释放器（Boss 专属）：生成一束激光并登记到世界容器。
 *  **laserCap 护栏**（17.6「超出时旧激光被替换/回收」）：本世界激光数达上限时，
 *  移除**最早生成**的那束（FIFO），为新束腾位——保证同屏永远 ≤ laserCfg("laserCap", 6)。 */
function spawnLaser(w, owner, x, y, ang, opts) {
  if (!w) return null;
  if (!w.lasers) w.lasers = [];
  while (w.lasers.length >= laserCfg("laserCap", 6)) w.lasers.shift();   // 超出上限：回收最旧的激光
  const lb = new LaserBeam(w, owner, x, y, ang, opts);
  w.lasers.push(lb);
  return lb;
}

/** 世界激光更新入口：推进每束激光 + 清理消亡的。单行调用点见 World.update。 */
function updateLasers(w, dt) {
  if (!w || !w.lasers || !w.lasers.length) return;
  for (const lb of w.lasers) {
    if (lb.world && lb.world !== w) continue;   // 世界归属：跨世界的激光冻结（与产物池一致）
    lb.update(w, dt);
  }
  w.lasers = w.lasers.filter(lb => !lb.dead);
}

/** Boss 激光招式循环（第 3 步新增能力，**默认关闭**）。
 *  ⚠️ 挂载方式：仅当 `m.d.type==="boss"` 且 `m.d.laserSkills` 为非空数组时启用
 *  —— 现有 3 只 Boss 未配 `laserSkills`，故此函数对其为 no-op（行为等价性回归）。
 *  配表口径（待 config 收口）：`CFG.monsters[BSxxxx].laserSkills = ["AT2xx", ...]`
 *  招式复用技能表条目，读其 `laser` 系列字段（arms / spin / laserLen / dmgMul 等），
 *  未填时取本区块局部常量。 */
function bossLaserTick(w, m, dt) {
  const ids = m.d && m.d.laserSkills;
  if (!ids || !ids.length) return;
  if (!w.lasers) w.lasers = [];
  m.laserTimer = (m.laserTimer == null) ? 2.0 : m.laserTimer - dt;   // 开场稍候再放第一束
  if (m.laserTimer > 0) return;
  const id = ids[(m.laserIdx || 0) % ids.length];
  const p = skillEntry(id, m.lv || 1) || {};
  m.laserIdx = (m.laserIdx || 0) + 1;
  // 朝向：瞄准最近目标（同 bossFire）；arms 决定束数，均匀铺开
  const tgt = nearestTarget(w, m.x, m.y);
  m.aimAng = Math.atan2(tgt.y - m.y, tgt.x - m.x);
  const arms = Math.max(1, Math.round(p.arms || 1));
  const spin = p.spin || 0;
  m.laserSpin = (m.laserSpin || 0) + spin;
  const dmg = Math.max(1, Math.round(m.atk * (p.dmgMul != null ? p.dmgMul : laserCfg("laserDmgMul", 0.5))));
  for (let i = 0; i < arms; i++) {
    const ang = m.aimAng + m.laserSpin + i * Math.PI * 2 / arms;
    spawnLaser(w, m, m.x, m.y, ang, {
      len: p.laserLen != null ? p.laserLen : laserCfg("laserLen", 1600),
      dmg: dmg,
      warn: p.laserWarn != null ? p.laserWarn : laserCfg("laserWarn", 0.9),
      active: p.laserActive != null ? p.laserActive : laserCfg("laserActive", 1.6),
      fade: p.laserFade != null ? p.laserFade : laserCfg("laserFade", 0.35),
    });
  }
  m.laserTimer = p.cd != null ? p.cd : (m.d.laserCd || 4.0);
}

/** 激光渲染（预警细线 + 激活粗光柱 + 收束淡出）。单行调用点见 render()。
 *  颜色语言（17.3）：青 = 激光 → CFG.boss.color.laser（缺省回落 #4dd6e5）。 */
function renderLasers(ctx, w) {
  if (!w || !w.lasers) return;
  const cyan = (CFG.boss && CFG.boss.color && CFG.boss.color.laser) || "#4dd6e5";
  for (const lb of w.lasers) {
    if (lb.world && lb.world !== w) continue;
    const e = lb.endPoint();
    ctx.save();
    if (lb.phase === "warn") {
      // 预警：细青线 + 呼吸闪烁（充能感），随预热进度加粗
      const k = lb.warnT > 0 ? Math.min(1, lb.t / lb.warnT) : 1;
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(G.time * 16));
      ctx.strokeStyle = cyan; ctx.lineWidth = 1 + k * 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.setLineDash([]);
    } else if (lb.phase === "active") {
      // 激活：外层辉光 + 内层亮芯（粗光柱，一眼可读）
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2.4;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = lb.halfW * 0.7;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    } else {
      // 收束：由粗变细、整体淡出
      const k = lb.fadeT > 0 ? Math.max(0, 1 - lb.t / lb.fadeT) : 0;
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = cyan; ctx.lineWidth = lb.halfW * 2 * k;
      ctx.beginPath(); ctx.moveTo(lb.x, lb.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================================
 * 第十九章 19.12：行为芯片积木（第 5 步）——bounce / burn / split / chain
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发要求）：现有函数里只插入**单行调用**，
 * 具体实现全部收在此处，最大限度避免与其他代理的行级冲突。
 *
 * 统一数据契约（19.12.1）：`behavior = { type, value }`
 *   bounce 折射  ：命中后弹射次数 N（复用 Bullet 的 bounce 字段链路）
 *   burn   燃蚀  ：命中后每秒灼烧 N 伤害，持续 3 秒
 *   split  裂变  ：击杀后分裂 N 枚小弹（owner 沿用击杀弹）
 *   chain  链锁  ：命中后向 N 个最近敌人传导伤害（链锁标记防重复链接）
 *
 * 🔴 关键规则：
 *   - 同 type 多枚芯片 → value 取 max（在 chipBehaviorSummary 已收口，此处只消费）
 *   - split 小弹不再触发 split（显式护栏：小弹 behavior 置空）
 *   - chain 不重复链接同一敌人（bullet.chainHit 集合标记）
 *   - 无 behavior 时所有分支短路 → 与接入前完全一致（回归护栏）
 * ⚠️ 注意：`LaserBeam`（17.7）走弹幕吞噬路径，不挂 behavior（不在本规格范围）。
 * ========================================================================== */

const CHIP_BURN_DURATION = 3;       // burn 持续秒数（19.12.1「持续 3 秒」）
const CHIP_SPLIT_DMG_MUL = 0.5;     // split 小弹伤害倍率（⚠️ 规格未定，拍板 0.5：小弹弱于本体）
const CHIP_SPLIT_SPD_MUL = 0.8;     // split 小弹速度倍率（⚠️ 规格未定，拍板 0.8）
const CHIP_SPLIT_LIFE = 1.2;        // split 小弹存活秒数（⚠️ 规格未定，拍板 1.2s，短命便于收束）
const CHIP_CHAIN_DMG_MUL = 1;       // chain 传导伤害倍率（= 命中弹伤害 × 此倍率）

/** 命中后行为分发（单行调用点 = Bullet 玩家弹命中逻辑）。
 *  - burn  ：给被命中怪挂灼烧
 *  - chain ：向最近 N 个敌人传导
 *  - bounce：由 Bullet 构造时注入的 bounce 字段链路处理（此处不重复处理）
 *  - split ：由击杀分支（onMonsterKilled）处理 */
function applyBulletHitBehavior(w, bullet, m) {
  const bh = bullet.behavior;
  if (!bh) return;                              // 无行为芯片：短路，等价于接入前
  if (bh.type === "burn") applyBurnToMonster(m, bh.value);
  else if (bh.type === "chain") applyChainFromHit(w, bullet, m, bh.value);
}

/** 给怪物挂 / 刷新灼烧。同源多段命中取**更高的 dps** 并刷新持续（不叠乘、不叠层）。 */
function applyBurnToMonster(m, dps) {
  if (!(dps > 0)) return;
  const cur = m.burn;
  if (cur) { cur.dps = Math.max(cur.dps, dps); cur.remain = CHIP_BURN_DURATION; }
  else m.burn = { dps: dps, remain: CHIP_BURN_DURATION };
}

/** 单帧灼烧结算（单行调用点 = Monster.update 顶部）。
 *  直接扣 hp（不走 damageMonster：灼烧不吃防御、不触发护盾/链锁/分裂，避免递归）。
 *  致死时补走 onMonsterKilled（无 killer → 不触发 split），保证掉落/计数照常。
 *  返回 true = 本次灼烧致死（调用方应跳过本帧其余 AI）。 */
function monsterBurnTick(m, w, dt) {
  if (!m.burn) return false;
  m.burn.remain -= dt;
  m.hp -= m.burn.dps * dt;
  m.flashT = Math.max(m.flashT || 0, 0.05);      // 火色反馈
  if (m.burn.remain <= 0) m.burn = null;
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    onMonsterKilled(w, m);                       // 灼烧致死：无击杀弹 → 不分裂
    return true;
  }
  return m.dead;
}

/** 链锁传导（单行调用点 = applyBulletHitBehavior）。
 *  向「已链集合外」的最近 N 个敌人各结算一次伤害；链锁标记写在**弹丸**上，
 *  保证同一弹丸不会重复链接同一敌人（防无限链 / 防重复扣血）。 */
function applyChainFromHit(w, bullet, src, n) {
  if (!(n > 0)) return;
  if (!bullet.chainHit) bullet.chainHit = new Set();
  bullet.chainHit.add(src);                      // 源目标入链锁集合（不再被本弹重复链接）
  let linked = 0;
  for (let i = 0; i < n; i++) {
    let best = null, bd = Infinity;
    for (const m of w.monsters) {
      if (m.dead || bullet.chainHit.has(m)) continue;   // 已链过的跳过（链锁标记）
      const d = U.dist(src.x, src.y, m.x, m.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) break;
    bullet.chainHit.add(best);
    damageMonster(w, best, Math.max(1, Math.round(bullet.dmg * CHIP_CHAIN_DMG_MUL)));
    spawnChainFx(src.x, src.y, best.x, best.y);  // 瞬结（线段）表现
    linked++;
  }
  return linked;
}

/** 链锁瞬结的特效段（渲染用，短命淡出）。 */
const CHIP_CHAIN_FX = [];
function spawnChainFx(x0, y0, x1, y1) {
  CHIP_CHAIN_FX.push({ x0, y0, x1, y1, life: 0.18 });
}
function updateChainFx(dt) {
  for (let i = CHIP_CHAIN_FX.length - 1; i >= 0; i--) {
    CHIP_CHAIN_FX[i].life -= dt;
    if (CHIP_CHAIN_FX[i].life <= 0) CHIP_CHAIN_FX.splice(i, 1);
  }
}
function renderChainFx(ctx) {
  if (!CHIP_CHAIN_FX.length) return;
  for (const fx of CHIP_CHAIN_FX) {
    const a = Math.max(0, fx.life / 0.18);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#9ee0ff"; ctx.lineWidth = 2 + a * 2;
    ctx.beginPath(); ctx.moveTo(fx.x0, fx.y0); ctx.lineTo(fx.x1, fx.y1); ctx.stroke();
    ctx.restore();
  }
}

/** 裂变：击杀弹带 split 行为时，在死亡位置生成 value 枚小弹（单行调用点 = onMonsterKilled）。
 *  🔴 小弹 behavior 置空 → 不再触发 split（显式护栏，防无限分裂）。
 *  owner 沿用击杀弹；伤害/速度/存活按本区块常量继承「部分属性」。 */
function spawnSplitBullets(w, m, killer) {
  const bh = killer && killer.behavior;
  if (!bh || bh.type !== "split" || !(bh.value > 0)) return 0;
  const n = bh.value;
  const base = Math.max(1, Math.round(killer.dmg * CHIP_SPLIT_DMG_MUL));
  const spd = Math.hypot(killer.vx, killer.vy) * CHIP_SPLIT_SPD_MUL || 260;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + U.rand(-0.2, 0.2);
    const child = new Bullet(m.x, m.y, a, spd, base, "player",
      killer.pierce || 0, 0, 0, true, killer.owner || G.player, null);
    child.isSplitChild = true;                   // 标记（护栏：不再分裂）
    child.life = CHIP_SPLIT_LIFE;
    w.playerBullets.push(child);
  }
  return n;
}

/** 燃蚀渲染：火色描边 + 余烬（单行调用点 = 怪物渲染循环）。 */
function renderBurnAura(ctx, m) {
  if (!m.burn) return;
  const a = 0.45 + 0.35 * Math.abs(Math.sin(G.time * 14));
  ctx.save();
  ctx.strokeStyle = `rgba(255,140,40,${a})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 4, 0, Math.PI * 2);
  if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.strokeStyle = `rgba(255,140,40,${a})`; ctx.lineWidth = 3; ctx.stroke(); }   // 低画质：跳过火色描边（保留填充指示燃烧状态）
  ctx.fillStyle = `rgba(255,90,20,${a * 0.15})`; ctx.fill();
  ctx.restore();
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


/* ============================================================================
 * 关卡机制：毒圈收缩 + 补给点（B 线并行批 · 关卡 3→10 铺量）
 * ----------------------------------------------------------------------------
 * 本区块**独立追加在文件末尾**（并行开发铁律，见 G_docs/dev_guide.md §5.45）：
 * 对现有函数（World.setupMain / World.update / render）只插入**单行调用**，
 * 绝不重写现有函数体，从而与其它代理零行级冲突。
 *
 * 两个机制均由 CFG 驱动（不硬编码数值）：
 *   毒圈 CFG.hazard  —— 关卡 hazardEnabled:true + hazard 覆盖；圈外定时扣血 + 红色环渲染。
 *   补给 CFG.supply  —— 关卡 supplyEnabled:true + supply 覆盖；复用判定圈统一入口 judgeChannel。
 *
 * 无机制等价性：未开启关卡（LEVEL_001~004/007）两处初始化均为 no-op，
 * update/render 早退，行为与改动前完全一致（测试「无机制等价性回归」锁定）。
 * ============================================================================ */

/** 合并「关卡覆盖 → 全局默认」：返回 null 表示本关不启用该机制。
 *  enabled：关卡 hazardEnabled/supplyEnabled 显式开关；缺省回落全局 CFG.hazard.enabled。 */
function levelMechCfg(kind, lv) {
  const base = CFG[kind];
  const onKey = kind === "hazard" ? "hazardEnabled" : "supplyEnabled";
  const enabled = (lv && lv[onKey] != null) ? !!lv[onKey] : !!(base && base.enabled);
  if (!enabled || !base) return null;
  return Object.assign({}, base, (lv && lv[kind]) || {});
}

/** 初始化本关机制状态（单行调用点 = World.setupMain 末尾）。
 *  仅在主地图、且关卡启用对应机制时写入字段；否则字段保持缺省（无机制关卡零开销）。 */
function initLevelMechanics(w) {
  if (!w || !w.isMain || !G.levelCfg) return;
  const hz = levelMechCfg("hazard", G.levelCfg);
  if (hz) {
    const cx = w.w * (hz.cx != null ? hz.cx : 0.5);
    const cy = w.h * (hz.cy != null ? hz.cy : 0.5);
    const maxR = Math.hypot(cx, cy);          // 覆盖全图（到最远角的距离）
    w.hazard = {
      cfg: hz, cx, cy, maxR,
      curR: maxR,                             // 当前安全圈半径（起步 = 满图）
      elapsed: 0,                             // 进场计时（到达 startDelay 才激活）
      active: false,                          // 是否已开始收缩
      tick: 0,                                // 圈外扣血计时累加
    };
  }
  const sp = levelMechCfg("supply", G.levelCfg);
  if (sp) {
    const n = Math.max(0, Math.min(3, Math.round(sp.count != null ? sp.count : 2)));
    w.supplyPoints = [];
    for (let i = 0; i < n; i++) {
      const pos = w.findFreeSpot ? w.findFreeSpot(sp.radius || 90) : null;
      w.supplyPoints.push({
        x: pos ? pos.x : U.rand(200, w.w - 200),
        y: pos ? pos.y : U.rand(200, w.h - 200),
        cfg: sp, progress: 0, holder: null, used: false,
      });
    }
  }
}

/** 每帧推进毒圈 + 补给点（单行调用点 = World.update 中段）。 */
function updateLevelMechanics(w, dt) {
  if (!w || !w.isMain) return;
  updateHazard(w, dt);
  updateSupply(w, dt);
}

/* ---------------- 2a. 毒圈收缩 ---------------- */

/** 毒圈：进场计时 → startDelay 后激活并线性收缩到 minRadius → 圈外每 tickInterval 秒扣 dmgPerTick。 */
function updateHazard(w, dt) {
  const hz = w.hazard;
  if (!hz) return;
  const cfg = hz.cfg;
  hz.elapsed += dt;
  if (!hz.active) {
    if (hz.elapsed < (cfg.startDelay || 0)) return;   // 尚未出现
    hz.active = true;
    hz.shrinkT = 0;
    UI.toast("☣ 毒圈开始收缩！留在安全圈内", "bad");
  } else if (hz.curR > cfg.minRadius) {
    hz.shrinkT = (hz.shrinkT || 0) + dt;
    const dur = Math.max(0.001, cfg.shrinkDuration || 90);
    const k = Math.min(1, hz.shrinkT / dur);
    hz.curR = hz.maxR - (hz.maxR - cfg.minRadius) * k;   // 线性收缩
  }
  // 圈外扣血：任意存活英雄在圈外累计 tickInterval → 按最大生命的固定比例扣血（21.1 比例口径）
  hz.tick += dt;
  if (hz.tick >= (cfg.tickInterval || 1)) {
    hz.tick -= (cfg.tickInterval || 1);
    const outside = aliveHeroes().filter(h => U.dist(h.x, h.y, hz.cx, hz.cy) > hz.curR);
    for (const h of outside) hazardDamage(w, h, cfg);
  }
}

/** 毒圈伤害入口（21.1 新增·比例口径）：扣除**最大生命**的固定比例，与当前血量/防御/成长无关。
 *  与 heroTakeDamage 的区别：不走防御减免、不触发「受击打断撤离」以外的队友规则差异——
 *  但保留打断语义（站毒圈里读条被毒打断是设计预期），走同一套打断清理。
 *  hpMax 取值防抖：G.run.hpMax 由玩家 update 维护（game.js:1210），而毒圈与本更新可能早于首个玩家帧；
 *  故按 hpMax → hp → CFG 基准值 三级回退，任何一级可用即不会产生 NaN。 */
function hazardDamage(w, h, cfg) {
  const pct = (cfg && typeof cfg.dmgPercent === "number") ? cfg.dmgPercent : 0.01;
  const base = (h && isFinite(h.hpMax) && h.hpMax > 0) ? h.hpMax
    : (G.run && isFinite(G.run.hpMax) && G.run.hpMax > 0) ? G.run.hpMax
    : (G.run && isFinite(G.run.hp) && G.run.hp > 0) ? G.run.hp
    : 100;
  const dmg = Math.max(1, Math.round(base * pct));   // 至少 1 点，避免高血/低比例下取整为 0
  heroTakeDamage(w, h, dmg, true);                   // 第 4 参 true = 本次伤害跳过防御减免（比例伤害）
}

/** 某点是否在毒圈外（供渲染/测试查询；未激活时返回 false，即尚未出现不扣）。 */
function hazardOutside(w, x, y) {
  const hz = w && w.hazard;
  if (!hz || !hz.active) return false;
  return U.dist(x, y, hz.cx, hz.cy) > hz.curR;
}

/* ---------------- 2b. 补给点 ---------------- */

/** 补给点：复用判定圈统一入口 judgeChannel；读条完成 → 生效一次后消失。 */
function updateSupply(w, dt) {
  const pts = w.supplyPoints;
  if (!pts || !pts.length) return;
  for (const sp of pts) {
    if (sp.used) continue;
    const cfg = sp.cfg;
    if (judgeChannel(sp, sp.x, sp.y, cfg.radius || 90, dt, cfg.channelSeconds || 3)) {
      sp.used = true;
      applySupplyEffect(w, sp);
    }
  }
  // 生效后移除（与雕像「触发即消失」一致）
  w.supplyPoints = w.supplyPoints.filter(s => !s.used);
}

/** 结算补给效果（配置驱动：effect 单项，或 effects 多项组合）。 */
function applySupplyEffect(w, sp) {
  const cfg = sp.cfg;
  const list = Array.isArray(cfg.effects) && cfg.effects.length ? cfg.effects : [cfg.effect];
  for (const ef of list) {
    if (!ef) continue;
    switch (ef.type) {
      case "heal": {
        for (const h of aliveHeroes()) {
          const add = h.hpMax * (ef.pct || 0);
          if (h === G.player) { G.player.heal(ef.pct || 0); }
          else { h.hp = Math.min(h.hpMax, h.hp + add); spawnFloat(h.x, h.y - 30, `+${Math.round(add)}`, "#7de08a"); }
        }
        UI.toast(`补给点：全队恢复 ${Math.round((ef.pct || 0) * 100)}% 生命`, "gold");
        break;
      }
      case "buff": {
        const pool = (ef.buffPool && CFG[ef.buffPool + "Buffs"]) || CFG.warBuffs || [];
        if (!pool.length) break;
        const b = U.pick(pool);
        const r = G.run;
        const cur = r.buffs.find(x => (x.skillId || "") === b.skillId);
        if (cur) cur.remain = ef.duration || 20;
        else r.buffs.push({ skillId: b.skillId, id: b.id, lv: 1, remain: ef.duration || 20 });
        UI.toast(`补给点：获得「${b.id}」（${ef.duration || 20}秒）`, "gold");
        break;
      }
      case "crystal": {
        G.run.coin += (ef.amount || 0);
        spawnFloat(sp.x, sp.y - 24, `+${ef.amount || 0}`, "#ffd76a");
        UI.toast(`补给点：获得 ${ef.amount || 0} 结晶`, "gold");
        break;
      }
    }
  }
}

/* ---------------- 渲染 ---------------- */

/** 毒圈渲染：红色半透明环边界 + 环外渐暗遮罩（在障碍层之后、实体之前绘制）。 */
function renderHazard(ctx, w) {
  const hz = w && w.hazard;
  if (!hz || !hz.active) return;
  const cfg = hz.cfg, col = cfg.color || "#ff3b3b";
  ctx.save();
  // 环外渐暗：用 evenodd 填充「大矩形 - 安全圈」的差集
  ctx.beginPath();
  ctx.rect(0, 0, w.w, w.h);
  ctx.arc(hz.cx, hz.cy, hz.curR, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(120,0,0,0.22)";
  ctx.fill("evenodd");
  // 边界环（脉动）
  const a = 0.65 + 0.3 * Math.abs(Math.sin(G.time * 3));
  ctx.beginPath(); ctx.arc(hz.cx, hz.cy, hz.curR, 0, Math.PI * 2);
  ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 补给点渲染：绿色发光圈 + 补给图标 + 读条环（判定圈虚线 = 与判定同源）。 */
function renderSupply(ctx, w) {
  const pts = w && w.supplyPoints;
  if (!pts || !pts.length) return;
  for (const sp of pts) {
    const cfg = sp.cfg, col = cfg.color || "#5ad07a", R = cfg.radius || 90;
    const glow = 0.35 + 0.25 * Math.abs(Math.sin(G.time * 4));
    ctx.save();
    // 发光圈（低画质：跳过虚线判定圈描边，保留填充底圈）
    ctx.beginPath(); ctx.arc(sp.x, sp.y, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,208,122,0.10)"; ctx.fill();
    if (!(LQ_SKIP_GLOW && isLowQuality())) { ctx.setLineDash([6, 6]); ctx.strokeStyle = col + "88"; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
    // 图标
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = col + "33"; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = glow + 0.4; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = "20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = col; ctx.fillText("✚", sp.x, sp.y);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#e8ecf2";
    ctx.fillText(`补给点（读条 ${cfg.channelSeconds || 3}s）`, sp.x, sp.y + 42);
    // 读条进度环
    if (sp.progress > 0) {
      const frac = Math.min(1, sp.progress / (cfg.channelSeconds || 3));
      ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 34, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd76a"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(Math.floor(frac * 100) + "%", sp.x, sp.y - 44);
    }
    ctx.restore();
  }
}

/* ========== 方向 3：局外成长落地（升级曲线 / 分段增益表 / 英雄解锁——纯函数区块） ==========
 * 铁律沿用 §5.45：新增逻辑集中本区块，现有函数只插单行调用。
 * 兼容性硬要求：CFG.outLevel 缺 growthRate → 升级花费回落旧线性；缺 growthTable → 属性回落旧线性。 */

// 当前升级花费（heroId → LV n→n+1 结晶数）：优先指数曲线 cost = round(costBase × growthRate^(n-1))，
// 前期平缓后期陡峭；缺 growthRate（或 ≤1）回落旧线性 costBase + (n-1)×costStep。满级返回 0（不可升）。
function outLevelCost(heroId) {
  const o = CFG.outLevel;
  const lv = (typeof Meta !== "undefined" && Meta && Meta.heroLevel) ? Meta.heroLevel(heroId) : 1;
  if (lv >= o.maxLevel) return 0;
  if (typeof o.growthRate === "number" && o.growthRate > 1)
    return Math.round(o.costBase * Math.pow(o.growthRate, lv - 1));
  return o.costBase + (lv - 1) * o.costStep;
}

// 升到 LV n 的每级成长段位倍率：按目标等级落在 growthTable 哪一段（lv ≤ upTo）取 mul；
// 表缺失/为空返回 null（调用方回落旧线性）。
function outLevelStageMul(lv) {
  const t = CFG.outLevel.growthTable;
  if (!Array.isArray(t) || !t.length) return null;
  for (const seg of t) if (lv <= seg.upTo) return seg.mul;
  return t[t.length - 1].mul;      // 超出最后一段（maxLevel 之外）按末段倍率
}

// 英雄每级成长值：按定位（CFG.heroRoles.byHero）取 growthByRole，无定位/无该定位回落 growth。
function outLevelGrowthOf(def) {
  const o = CFG.outLevel;
  const role = (CFG.heroRoles && CFG.heroRoles.byHero && CFG.heroRoles.byHero[def.id]) || "";
  return (o.growthByRole && o.growthByRole[role]) || o.growth;
}

// LV lv 的累计属性加成 → { hp, atk, def }（四舍五入取整）：有 growthTable 逐级累加「定位成长 × 段位倍率」，
// 无表回落旧线性（growth × (lv-1)）。LV1 恒返回基础值（加成 0）。
function outLevelStats(def, lv) {
  const g = outLevelGrowthOf(def), n = lv - 1;
  let hp, atk, defv;
  if (outLevelStageMul(lv) !== null) {
    hp = atk = defv = 0;
    for (let L = 2; L <= lv; L++) {
      const m = outLevelStageMul(L) || 1;
      hp += g.hp * m; atk += g.atk * m; defv += g.def * m;
    }
  } else { hp = g.hp * n; atk = g.atk * n; defv = g.def * n; }
  return { hp: Math.round(def.hp + hp), atk: Math.round(def.atk + atk), def: Math.round(def.def + defv) };
}

// 英雄是否已解锁（纯查询，无副作用）：① unlockOrder 前 starterCount 个 = 首发默认解锁；
// ② 存档 unlockExtra[id] = 已花结晶主动解锁；③ heroLv 条件（指定英雄局外等级达标）达成即解锁。
function isHeroUnlocked(id, data) {
  const order = CFG.unlockOrder || [];
  const idx = order.indexOf(id);
  if (idx >= 0 && idx < (CFG.starterCount || order.length)) return true;
  if (data && data.unlockExtra && data.unlockExtra[id]) return true;
  const rule = CFG.unlockRules && CFG.unlockRules[id];
  if (rule && rule.heroLv) {
    if (typeof Meta !== "undefined" && Meta && typeof Meta.heroLevel === "function"
      && Meta.heroLevel.call(Meta, rule.heroLv.heroId) >= rule.heroLv.lv) return true;
  }
  return false;
}

/* ================= 方向 4：撤离压力设计（追加区块，§5.45 铁律：文件末尾独立区块 + 现有函数只插单行调用） =================
 * ① 撤离读条波次：开始读条（extractChanneling false→true）时逐波刷怪围攻，强度随波数递增
 *    （第 N 波数量 = waveSizeBase + waveSizeGrowth×(N-1)，每 waveInterval 秒一波，全部进 CFG.extract）；
 *    读条结束/打断/离圈 → 会话销毁 = 停止刷怪。挂点：updateExtractJudge 内单行调用 extractWaveTick
 *    （置于负重缩放**之前**，拿原始 dt——波次/护盾按「真实秒」推进，不随负重缩放）。
 *    ⚠️ 护栏（§4.6/§5.34）：updateExtractJudge 仅在主地图且 !frozen 时被调用（见 main.js 主循环），
 *    且 paused 时整段跳过；extractWaveTick 内再自守卫一遍（防直接调用绕过闸门）。
 * ② 负重权衡：选「负重越高 → 读条时间越长（读条速率打折）」方案。理由：
 *    a) 不引入新伤害路径——若做「读条期间持续掉血」，掉血必经 heroTakeDamage → 立即打断读条，
 *    超重等于永远撤不离（死锁）；b) 时长放大与波次压力天然相乘（见①）；c) 纯函数可测、无随机性。
 *    挂点：updateExtractJudge 内 judgeChannel 之前单行调用 extractWeightDt 缩放 dt
 *    （等价于拉长读条时长；圈外进度衰退不走缩放，保持旧衰退速率）。
 * ③ 波次怪的攻击载体 = **雕像护盾**（关键设计约束：门禁 runtime_test 站桩 8s 必须撤离成功，
 *    波次怪若伤害英雄 → 受击打断读条 → 永远撤不走，门禁必红）。读条期间波次怪由
 *    extractWaveSiegeTick 接管（Monster.update 顶部单行插入，同 monsterBurnTick 先例）：
 *    围到 siegeRingRadius 啃护盾，**不伤害英雄**；读条一旦中断 → 交还普通 AI 追击英雄（威胁不变）。
 *    护盾破碎 → 读条冻结（进度不清零）+ 停刷波次；清光围攻怪 → 护盾再生至 shieldRecoverPct 解锁。
 *    贪心压力：不清理围攻怪就反复读条 → 护盾见底 → 被锁死在撤离点。
 * 无机制等价性：CFG.extract.enabled = false 时全部函数短路/透传，行为与旧版逐位一致。 */

// 负重 → 读条时长倍率（≥1）：未启用惩罚 / 圈外（非读条帧）返回 1。
function extractWeightMul(r, st) {
  const c = CFG.extract;
  if (!c || !c.enabled || !c.weightPenaltyEnabled) return 1;
  if (!heroInCircle(st.x, st.y, c.radius)) return 1;   // 只有正在读条的帧才打折
  const need = extractChannelSeconds(r);
  return need > 0 ? need / c.channel : 1;
}
// dt 缩放（updateExtractJudge 单行挂点）：护盾破碎未恢复 → 读条冻结（dt=0，进度不清零）；
// 圈内读条帧按负重打折读条速率；其余透传（enabled=false 恒透传，无机制等价性）。
function extractWeightDt(r, st, dt) {
  const c = CFG.extract;
  if (!c || !c.enabled) return dt;
  if (st.shieldBroken && (st.shield || 0) < c.shieldMax * c.shieldRecoverPct) return 0;
  const mul = extractWeightMul(r, st);
  return mul > 1 ? dt / mul : dt;
}
// 纯函数：当前负重下的实际撤离读条时长（秒）。runLike 仅作兼容入参（负重是全队口径，统一读 G.run）。
// 未启用总开关 / 负重惩罚 → 返回基准 CFG.extract.channel（无机制等价性）。
function extractChannelSeconds(runLike) {
  const c = CFG.extract, base = c.channel;
  if (!c || !c.enabled || !c.weightPenaltyEnabled) return base;
  const run = (runLike && runLike.backpack) ? runLike : G.run;
  if (!run) return base;
  const over = Math.max(0, totalRunWeight() - c.weightThreshold);
  return base * Math.min(c.weightTimeScaleMax, 1 + c.weightSlopePer100 * over / 100);
}
// 波次刷怪池：与 spawnWave 同源——优先刷怪圆模板池（主地图 circles[0]），回退关卡 spawnPool；
// 过滤 ED 精英与 BOSS（不进随机圆），按解锁进度过滤（Boss 已死 → progress=1 全解锁）。
function extractWavePool(w) {
  const tpl = (w.circles && w.circles[0]) || null;
  const raw = parseWeightPool((tpl && tpl.pool) || (G.levelCfg && G.levelCfg.spawnPool) || "NM0010:1");
  const progress = (G.run.kills || 0) / Math.max(1, G.levelCfg.progressGoal);
  const pool = {};
  for (const id in raw) {
    if (isEliteDef(id) || (CFG.monsters[id] && CFG.monsters[id].type === "boss")) continue;
    if (progress >= (CFG.monsterUnlock[id] ?? 0)) pool[id] = raw[id];
  }
  if (!Object.keys(pool).length) pool.NM0010 = 1;   // 兜底（同 spawnWave）
  return pool;
}
// 刷第 n 波：数量 = base + growth×(n-1)；围绕雕像 waveSpawnRadius 半径随机取点
// （遵守 spawnRules.minDistFromPlayer / 障碍避让 / 世界边界）；spawnMonster 自带 monsterCap 守卫（满则返回 null → 本波收手）。
function spawnExtractWave(w, st, n) {
  const c = CFG.extract;
  const size = Math.max(1, Math.round(c.waveSizeBase + c.waveSizeGrowth * (n - 1)));
  const pool = extractWavePool(w);
  const minDist = CFG.spawnRules.minDistFromPlayer;
  let spawned = 0, attempts = 0;
  const maxAttempts = Math.max(24, size * 8);
  while (spawned < size && attempts < maxAttempts) {
    attempts++;
    const a = U.rand(0, Math.PI * 2), rr = U.rand(c.waveSpawnRadius * 0.6, c.waveSpawnRadius);
    const x = st.x + Math.cos(a) * rr, y = st.y + Math.sin(a) * rr;
    if (x < 40 || x > w.w - 40 || y < 40 || y > w.h - 40) continue;
    if (blockedByObstacle(w, x, y)) continue;
    if (G.player && U.dist(x, y, G.player.x, G.player.y) < minDist) continue;
    const m = w.spawnMonster(U.weightedPick(pool), x, y);
    if (!m) break;   // monsterCap 已满：spawnMonster 返回 null，停止本波（不超上限）
    m._extWave = true;   // 标记波次怪：读条期间围攻雕像护盾（extractWaveSiegeTick），中断后转普通 AI
    if (Math.random() < c.waveEliteChance) { applyElite(m); applyMonsterScale(m, "精英属性"); }
    spawned++;
  }
  UI.toast("⚠ 撤离点遭到围攻：第 " + n + " 波来袭！（+" + spawned + "）", "bad");
  SFX.play("boom");
  return spawned;
}
// 雕像护盾再生/恢复（读条与否都推进）：无存活波次怪贴近雕像 → 延迟后缓慢再生；
// 护盾归零 → 破碎（停刷波次 + 读条冻结由 extractWeightDt 承担）；恢复到 shieldRecoverPct × max → 解锁。
function extractShieldTick(r, st, dt) {
  const c = CFG.extract;
  if (st.shield == null) return;   // 尚未开启过波次会话：护盾不存在，零足迹
  if (!st.shieldBroken && st.shield <= 0) {
    st.shieldBroken = true;
    r._extWave = null;             // 停刷波次（会话销毁）：先清怪，再谈撤离
    UI.toast("⚠ 撤离点雕像护盾被击碎！清除周围敌人后护盾将自行恢复", "bad");
    SFX.play("boom");
  }
  const sieged = extractSiegersNear(r, st, c.siegeRingRadius + 240);
  if (st.shield < c.shieldMax && !sieged) {
    st._shieldHold = (st._shieldHold == null ? c.shieldRegenDelay : st._shieldHold) - dt;
    if (st._shieldHold <= 0) st.shield = Math.min(c.shieldMax, st.shield + c.shieldRegenPerSec * dt);
  } else st._shieldHold = c.shieldRegenDelay;
  if (st.shieldBroken && st.shield >= c.shieldMax * c.shieldRecoverPct) {
    st.shieldBroken = false;
    UI.toast("撤离点雕像护盾已恢复，可继续读条", "gold");
  }
}
// 是否有存活波次怪贴近雕像（围攻抑制再生）
function extractSiegersNear(r, st, dist) {
  const w = G.activeWorld || G.mainWorld;
  if (!w || !w.monsters) return false;
  for (const m of w.monsters) {
    if (m.dead || !m._extWave) continue;
    if (U.dist(m.x, m.y, st.x, st.y) < dist) return true;
  }
  return false;
}
// 波次状态机（updateExtractJudge 单行挂点，置于负重缩放**之前**以拿原始 dt）：
// 读条开始建会话并按间隔刷波；读条结束/打断销毁会话；护盾破碎停刷并冻结读条。
// 波次/护盾计时均按「真实秒」推进（不随负重缩放）——负重越重读条越久，承受波数越多。
function extractWaveTick(r, st, dt) {
  const c = CFG.extract;
  if (!c || !c.enabled || !c.waveEnabled) { r._extWave = null; return; }
  if (Game.paused) return;                                   // 升级 4 选 1 暂停：不推进波次（§5.43）
  const w = G.activeWorld || G.mainWorld;
  if (!w || !w.isMain || w.freezeTimer > 0) return;          // 冻结期间不推进波次（§4.6/§5.34 护栏）
  extractShieldTick(r, st, dt);                              // 护盾再生/破碎/恢复（读条与否都推进）
  if (!r.extractChanneling) { r._extWave = null; return; }   // 打断/结束/离圈 → 停止刷怪
  if (st.shieldBroken) return;                               // 护盾破碎：先清怪恢复，不再刷波
  let s = r._extWave;
  if (!s) {
    if (st.shield == null) st.shield = c.shieldMax;          // 首次波次会话：护盾就位
    s = r._extWave = { wave: 0, timer: c.waveFirstDelay || 0 };
  }
  s.timer -= dt;
  if (s.timer > 0) return;
  s.wave++;
  s.timer = c.waveInterval;
  spawnExtractWave(w, st, s.wave);
}
// 波次怪围攻 AI（Monster.update 顶部单行挂点，同 monsterBurnTick 先例）：
// 读条期间接管波次怪——围到雕像环啃护盾（不伤害英雄）；返回 true = 本帧已接管；
// 读条中断/结束/机制关闭 → 返回 false → 交还普通 AI（追击英雄，真实威胁）。
function extractWaveSiegeTick(m, w, dt) {
  const r = G.run;
  if (!m._extWave) return false;
  const c = CFG.extract;
  if (!c || !c.enabled || !c.waveEnabled) return false;
  if (!r || !r.extractChanneling || !r.exitStatue) return false;
  const st = r.exitStatue;
  if (st.shield == null) return false;
  const d = U.dist(m.x, m.y, st.x, st.y);
  if (d > c.siegeRingRadius + m.r) {                          // 向雕像环推进
    const ang = Math.atan2(st.y - m.y, st.x - m.x);
    m.x += Math.cos(ang) * m.effSpd * dt;
    m.y += Math.sin(ang) * m.effSpd * dt;
  } else if (st.shield > 0) {                                 // 到环：啃护盾（读条期间绝不伤害英雄）
    st.shield = Math.max(0, st.shield - m.atk * c.siegeDpsMul * dt);
  }
  return true;
}

/* ============================================================================
 * 20.5 低画质渲染降级（独立区块，§5.45 铁律：文件末尾独立区块 + 现有函数只插单行调用）
 * ----------------------------------------------------------------------------
 * 背景：低画质开关早已存在（G.settings.lowQuality / window.__lowQuality，见 main.js），
 *       但渲染层从未消费它。本区块把它真正落到绘制路径上，目标是把帧耗时压下来（渣机友好）。
 *
 * 铁律：
 *  1. 只降**视觉表现**，绝不改游戏逻辑（碰撞 / 伤害 / AI / 掉落全走原路径）。
 *  2. 低画质**关闭时行为逐位不变**（所有降级都包在 isLowQuality() 分支里，默认 false）。
 *  3. 配置化：优先读 CFG.lowQuality，缺省用内置默认值——主会话后续可把它挪进 config.js
 *     而无需改本文件（只读、可缺省、逐字段回落）。
 *  4. 不引入高版本 JS 语法（ES5 兼容），所有 window/G 访问均防御式（测试沙箱可能没有）。
 * ============================================================================ */

/* 低画质可调数值：优先 CFG.lowQuality（未来可挪进 config.js），逐字段回落内置默认。
 * 例：CFG.lowQuality = { particleMul: 0.4, dprCap: 1.5, ... }。 */
var LQ = (typeof CFG !== "undefined" && CFG && CFG.lowQuality) ? CFG.lowQuality : {};
/* 粒子生成倍率（<1 削弱）：0.4 → 原本 40 颗的爆发只出 16 颗，UPDATE/DRAW 两段线性下降。 */
var LQ_PARTICLE_MUL = (typeof LQ.particleMul === "number") ? LQ.particleMul : 0.4;
/* 粒子渲染抽样比：1 表示全部绘制；低画质把已有粒子再抽稀（只画 1/2），纯粹省填充。 */
var LQ_PARTICLE_DRAW_DIV = (typeof LQ.particleDrawDiv === "number") ? LQ.particleDrawDiv : 2;
/* 设备像素比封顶：DPR 2→1.5 约省 44% 像素填充（1.5²/2² = 0.5625），对 2D 满屏重绘收益最大。 */
var LQ_DPR_CAP = (typeof LQ.dprCap === "number") ? LQ.dprCap : 1.5;
/* 地面/主城网格步长倍率：网格是「每 96px 一条」的整屏描边，低画质拉大间距 = 少画一半线。 */
var LQ_GRID_STEP_MUL = (typeof LQ.gridStepMul === "number") ? LQ.gridStepMul : 2;
/* 是否跳过昂贵描边/发光（精英光环、预警圈、Boss 电报等降级为纯色/更少绘制）。 */
var LQ_SKIP_GLOW = (typeof LQ.skipGlow === "boolean") ? LQ.skipGlow : true;

/* 低画质判定：优先读 window.__lowQuality（main.js 镜像），回落 G.settings.lowQuality，均无则 false。
 * 内部做**帧号缓存**——每帧被调用数十次（每个绘制点一次），若每次都走完整解析会引入额外开销。
 * 缓存以 G.time 作为轻量帧戳：同一游戏时刻只解析一次；时间推进（下一次 render）自动失效重算。
 * 另加**源值哨兵**：同一帧内若 window.__lowQuality 被外部改写（运行中切换开关），哨兵不一致 → 立即
 * 重算返回新值（只是一次布尔属性读，开销可忽略）——保证切换即时生效、不受缓存毒化。 */
var _lqCachedTime = -1;
var _lqCachedVal = false;
var _lqCachedSrc = null;   // 上次缓存时读到的原始源值（未命中任何源时为 null）
function isLowQuality() {
  // 读取原始源值（window 优先，回落 G.settings；均缺省 → null 表示"无源"=false）
  var raw;
  if (typeof window !== "undefined" && window && typeof window.__lowQuality === "boolean") raw = window.__lowQuality;
  else if (typeof G !== "undefined" && G && G.settings && typeof G.settings.lowQuality === "boolean") raw = G.settings.lowQuality;
  else raw = null;
  // 帧戳缓存 + 源值哨兵：同一帧且源值未变 → 直接返回缓存（避免重复解析）
  var now = (typeof G !== "undefined" && G) ? G.time : 0;
  if (now === _lqCachedTime && raw === _lqCachedSrc) return _lqCachedVal;
  _lqCachedTime = now;
  _lqCachedSrc = raw;
  _lqCachedVal = (raw === true);
  return _lqCachedVal;
}

/* 供测试/调试：清空帧戳缓存（一般无需调用，时间推进/源值变化即自动失效）。 */
function lowQualityCacheReset() { _lqCachedTime = -1; _lqCachedSrc = null; }

/* 低画质下 canvas 设备像素比封顶：把物理分辨率钳到 LQ_DPR_CAP × 逻辑尺寸，显著减少填充率。
 * main.js.fitCanvas 不可改，故在此提供「自动纠偏」入口：render 每帧单行调用，一旦发现当前
 * canvas 物理像素超过封顶点（例如切到低画质、或窗口 resize 被 fitCanvas 重置）就立即压低。
 * 逻辑尺寸 G.W/G.H 与 CSS 显示尺寸不变 → 画面构图/坐标零变化，只是内部像素更少（略糊，换帧率）。
 * 关闭低画质时不干预（canvas.width 由 fitCanvas 全权控制，行为与改动前一致）。 */
function applyLowQualityDPR() {
  if (!isLowQuality()) return;
  var c = (typeof G !== "undefined" && G) ? G.canvas : null;
  if (!c || typeof c.getContext !== "function") return;
  var W = G.W || 0, H = G.H || 0;
  if (!W || !H) return;
  var capW = Math.round(W * LQ_DPR_CAP), capH = Math.round(H * LQ_DPR_CAP);
  // 已封顶（或低于封顶）→ 不动；超过封顶 → 压低物理分辨率（仅当真的超了才重设，避免每帧抖动）
  if (c.width > capW || c.height > capH) { c.width = capW; c.height = capH; }
}

/* 低画质下的粒子生成数：正常返回 n，低画质按 LQ_PARTICLE_MUL 削减（至少 1，避免"看起来没反应"）。
 * 纯函数、无副作用，方便单测断言「正常 40 → 低画质 <20」。 */
function lqParticleCount(n) {
  if (!isLowQuality()) return n;
  var m = Math.floor(n * LQ_PARTICLE_MUL);
  return m < 1 ? 1 : m;
}

/* 低画质下是否应绘制第 i 个粒子：按 LQ_PARTICLE_DRAW_DIV 抽样（只画 1/DIV）。
 * 正常画质恒 true（逐位不变）；低画质隔颗绘制 → 填充次数减半。 */
function lqShouldDrawParticle(i) {
  if (!isLowQuality()) return true;
  var d = LQ_PARTICLE_DRAW_DIV < 1 ? 1 : Math.floor(LQ_PARTICLE_DRAW_DIV);
  return (i % d) === 0;
}

/* ================= 方向 3：局外成长闭环收口（结晶产出可见化 + 配平自检——纯函数区块） =================
 * 铁律 §5.45：新增逻辑集中本区块，现有函数（Meta.awardRun）只插单行调用。
 * --------------------------------------------------------------------------------------------
 * 背景：结晶只剩两个来源（① 击杀 BOSS=CFG.outLevel.crystalBoss；② 撤离折算=CFG.settleConvert.valueRate），
 *       但玩家打完一局看不到「拿了多少、怎么来的」。本区块把结算明细算成一份**纯数据报告**。
 *
 * ⚠️ 渲染归属：结算界面 DOM 在 js/ui.js（另一代理维护，本代理禁改）。因此这里**只产出数据**并挂到
 *    G.lastSettleReport，**需要 UI 侧配合渲染该字段**（主会话收口）——把 lines 逐行、total 作为总计渲染即可。
 *    挂点：Meta.awardRun 结束时单行调用 publishCrystalReport（awardRun 是唯一结晶发放入口，天然收口）。
 */

// 本局结算报告（纯函数，无副作用，入参可为部分字段——测试/沙箱无 G 环境时不抛错）：
//   result = { kills, bossDefeated, extracted, convertTotal, boss }
//     boss         = 该局 BOSS 结晶**到手**数（死亡已按 deathRatio 打折；缺省按配置现算）
//     convertTotal = 撤离折算结晶（来源②；未撤离恒 0）
// 返回 { total, boss, convertTotal, extracted, died, lines: [中文文案…] }
function buildCrystalReport(result) {
  var r = result || {};
  var o = CFG.outLevel, sc = CFG.settleConvert;
  var extracted = !!r.extracted;
  var bossDef = !!r.bossDefeated;
  var boss = (typeof r.boss === "number") ? r.boss
    : (bossDef ? (extracted ? o.crystalBoss : Math.floor(o.crystalBoss * o.deathRatio)) : 0);
  var conv = extracted ? (r.convertTotal || 0) : 0;   // 死亡不折算（来源②不发生）
  var lines = [];
  if (extracted) {
    if (boss > 0) lines.push("击杀首领 +" + boss);
    if (conv > 0) lines.push("物资折算 +" + conv);
    if (!lines.length) lines.push("本局无结晶产出（未击杀首领 · 无可折算物资）");
  } else {
    lines.push("阵亡 · 仅保留 " + Math.round(o.deathRatio * 100) + "%");
    if (bossDef) lines.push("击杀首领 +" + o.crystalBoss + " → 保留 +" + boss);
    else lines.push("本局无结晶产出（未击杀首领）");
  }
  var total = boss + conv;
  lines.push("本局合计 +" + total + " 结晶");
  return { total: total, boss: boss, convertTotal: conv, extracted: extracted, died: !extracted, lines: lines };
}

// 生成并广播结算报告：写 Meta.lastReport（可持久层读取）+ G.lastSettleReport（供 UI 渲染）。
// 折算值取 G.run.settleConv（main.js 在调用 awardRun **之前**已写入），无则按 0。
function publishCrystalReport(kills, bossDefeated, extracted, boss) {
  var conv = 0;
  if (typeof G !== "undefined" && G && G.run && G.run.settleConv && extracted) {
    conv = G.run.settleConv.total || 0;
  }
  var rep = buildCrystalReport({ kills: kills, bossDefeated: bossDefeated, extracted: extracted, convertTotal: conv, boss: boss });
  if (typeof Meta !== "undefined" && Meta) Meta.lastReport = rep;
  if (typeof G !== "undefined" && G) G.lastSettleReport = rep;
  return rep;
}

/* ========== 21.1 触屏交互区（NPC 点选）——纯函数 + 单一入口 ==========
 * 铁律 §5.45：新增逻辑集中本区块，现有函数只插单行调用。
 * 背景：工匠世界 NPC 由「站圈自动开面板」改为「进圈 1 秒解锁 → 点击 NPC 本体」，
 * 需要把屏幕点击坐标换算回世界坐标（相机 zoom + camX/camY 平移，与 render 完全同口径）。 */

/* 屏幕坐标(clientX/Y) → 世界坐标：与 renderWorld 的相机变换严格对称。
 * 渲染侧：ctx.scale(zoom) → ctx.translate(-camX,-camY)，故反变换为 world = (screen/zoomScale/canvasScale) + cam。 */
function screenToWorld(clientX, clientY) {
  var cv = G.canvas;
  if (!cv) return null;
  var rect = cv.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  // 画布内比例坐标 → 画布像素坐标（G.W × G.H 逻辑坐标系）
  var px = (clientX - rect.left) * (G.W / rect.width);
  var py = (clientY - rect.top) * (G.H / rect.height);
  var zoom = (CFG.camera && CFG.camera.zoom) || 1;
  var w = G.world;
  if (!w) {
    /* 21.10：主城相机分支（此前缺失）。主城无 G.world（战斗世界变量），旧代码落到
     * 「无世界纯缩放」退化分支、忽略相机平移——而 renderCity 对小于视口的地图做居中
     * （camX 为负偏移），导致主城点击换算整体错位、NPC 点选必 miss（手机端 NPC 无法
     * 交互的深层根因之一）。此处与 renderCity 严格同口径：小地图居中 / 大地图跟 avatar。 */
    var cw = G.activeWorld;
    if (cw && cw.kind === "city") {
      var cviewW = G.W / zoom, cviewH = G.H / zoom;
      var a = G.cityAvatar;
      var ccamX = cw.w <= cviewW ? (cw.w - cviewW) / 2
        : U.clamp(((a && a.x) || cw.w / 2) - cviewW / 2, 0, cw.w - cviewW);
      var ccamY = cw.h <= cviewH ? (cw.h - cviewH) / 2
        : U.clamp(((a && a.y) || cw.h / 2) - cviewH / 2, 0, cw.h - cviewH);
      return { x: px / zoom + ccamX, y: py / zoom + ccamY };
    }
    return { x: px / zoom, y: py / zoom };            // 其余无世界场景维持旧退化行为
  }
  var viewW = G.W / zoom, viewH = G.H / zoom;
  var camX = w.w <= viewW ? (w.w - viewW) / 2 : U.clamp(G.player.x - viewW / 2, 0, w.w - viewW);
  var camY = w.h <= viewH ? (w.h - viewH) / 2 : U.clamp(G.player.y - viewH / 2, 0, w.h - viewH);
  return { x: px / zoom + camX, y: py / zoom + camY };
}

/* 点击屏幕 → 命中可交互 NPC 则开面板。
 * 门槛三重：① 工匠世界 ② npcReady（已在圈内站满 1 秒）③ 点击点落在 NPC 半径 tapRadius 内。
 * 返回 true 表示本次点击已被消费（调用方可据此吞掉后续逻辑）。 */
function npcTap(clientX, clientY) {
  var w = G.world;
  var cfg = CFG.mobile && CFG.mobile.npcTap;
  if (!w || w.isMain || w.kind !== "artisan" || !w.npc) return false;
  if (!w.npcReady) return false;                      // 未解锁：不响应（避免隔屏误点）
  var pt = screenToWorld(clientX, clientY);
  if (!pt) return false;
  var r = (cfg && cfg.tapRadius) || 110;              // 点选判定半径（略大于视觉半径，照顾手指精度）
  if (U.dist(pt.x, pt.y, w.npc.x, w.npc.y) > r) return false;
  w.npcReady = false; w.npcDwell = 0;                 // 消费：关面板后需重新站圈解锁
  EventBus.emit("openArtisanUI");
  return true;
}

/* NPC 点选提示环渲染（解锁后高亮脉冲，告诉玩家"现在可以点了"）。
 * 只在 npcReady 时绘制；未解锁时画暗环表示"还需要站一会儿"。 */
function renderNpcTapHint(ctx, w) {
  var n = w && w.npc;
  if (!n || w.isMain || w.kind !== "artisan") return;
  var cfg = CFG.mobile && CFG.mobile.npcTap;
  var r = (cfg && cfg.hintRadius) || 104;
  var ready = !!w.npcReady;
  var pulse = 0.5 + 0.5 * Math.sin(G.time * (ready ? 6 : 2.5));
  ctx.save();
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = ready ? "rgba(255,215,106," + (0.55 + 0.45 * pulse) + ")" : "rgba(120,150,190,.35)";
  ctx.lineWidth = ready ? 4 : 2;
  ctx.setLineDash(ready ? [] : [10, 8]);
  ctx.stroke();
  ctx.restore();
  // 解锁后附一行浮动提示（复用既有 float 文本管线，避免新增 UI 层）
  if (ready) {
    ctx.save();
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,215,106," + (0.7 + 0.3 * pulse) + ")";
    ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 4;
    ctx.strokeText("点击进入", n.x, n.y - r - 14);
    ctx.fillText("点击进入", n.x, n.y - r - 14);
    ctx.restore();
  }
}

/* ---------- 21.4 升级刷新（参考图「刷新 1/1」）----------
 * 每局免费刷新 rerollFreePerRun 次：重抽当前 4 选 1 的候选（锁定卡保持锁定）。
 * 关键实现：**就地换血**——不清空 UI.levelUpCandidates 的引用，只清空内容再回填，
 * 这样 presentLevelUpChoice 的 done 闭包（持有同一数组引用）读到的就是新候选，
 * 无需改动任何现有闭包/契约（铁律 §5.45：现有函数只插单行调用）。 */
function levelUpReroll() {
  const ui = (typeof UI !== "undefined") ? UI : null;
  const r = G.run;
  if (!ui || !r || !Array.isArray(ui.levelUpCandidates) || !ui.levelUpCandidates.length) return false;
  // 次数惰性初始化（旧存档 run 没有该字段 → 按 CFG 补齐）
  const per = (CFG.levelUp && CFG.levelUp.rerollFreePerRun) || 0;
  if (typeof r.levelUpRerollsLeft !== "number") r.levelUpRerollsLeft = per;
  if (r.levelUpRerollsLeft <= 0) return false;          // 次数用尽（按钮应已禁用，双保险）
  const heroId = (ui.levelUpMeta && ui.levelUpMeta.heroId)
    || (r.heroDef && r.heroDef.id) || null;
  if (!heroId || typeof buildLevelUpCandidates !== "function") return false;
  r.levelUpRerollsLeft--;
  const fresh = buildLevelUpCandidates(heroId);
  if (!Array.isArray(fresh) || !fresh.length) { r.levelUpRerollsLeft++; return false; }
  ui.levelUpCandidates.length = 0;                      // ★ 就地换血（引用不变）
  for (const c of fresh) ui.levelUpCandidates.push(c);
  if (typeof ui._renderLevelUp === "function") ui._renderLevelUp();
  if (typeof ui.toast === "function") ui.toast(`已刷新候选（剩余 ${r.levelUpRerollsLeft} 次）`, "gold");
  return true;
}

/* ============================================================
 * ====== 21.6 赛季玩法（占位）—— SeasonState 数据结构 ======
 * ------------------------------------------------------------
 * 定位：99 关主线通关后开放的赛季玩法，本期仅占位实现
 *   （数据结构 + 经验曲线 + 周任务 + 结算钩子，无独立玩法循环）。
 * 铁律遵守：数值常量在本区块顶部声明，【待迁入 CFG】（本轮禁止改 config.js）。
 * 全部接口可被无头测试（season_test.js）直接调用，不依赖 DOM 渲染。
 * ============================================================ */

/* ---- 赛季配置常量（待迁入 CFG） ---- */
var SEASON_CFG = {
  expBase: 1000,        // LV1→LV2 所需经验基数
  expStep: 200,         // 每级递增量（LV n→n+1 需 1000 + (n-1)*200，n 为当前等级）
  maxLv: 10,            // 赛季等级封顶（L10 不再累计经验）
  weeklyKillGoal: 200,  // 周任务①：击杀 N 个敌人
  weeklyExtractGoal: 3, // 周任务②：成功撤离 N 次
  weeklyLevelUpGoal: 10 // 周任务③：局内升级 N 次
};

/* ---- 赛季状态（内存态，占位期不落盘；赛季正式上线再接 Meta 存档） ---- */
var SeasonState = {
  seasonLv: 1,          // 赛季等级（从 LV1 起）
  seasonExp: 0,         // 当前等级内已积累经验
  _weeklyProgress: {    // 周任务进度（按任务 id 存内存）
    "weekly-kill": 0,
    "weekly-extract": 0,
    "weekly-levelup": 0
  },

  /* 加赛季经验：升级曲线 每级 1000+n*200（n 从 0 计），L10 封顶后不再累计。
   * 支持一次跨多级（while 循环逐级结算）；非正数输入直接拒绝。 */
  addExp: function (n) {
    if (typeof n !== "number" || !(n >= 0)) return false;   // 非法输入（含 NaN）拒绝
    if (this.seasonLv >= SEASON_CFG.maxLv) return false;    // 封顶：经验不再涨
    this.seasonExp += n;
    while (this.seasonLv < SEASON_CFG.maxLv) {
      var need = SEASON_CFG.expBase + (this.seasonLv - 1) * SEASON_CFG.expStep;
      if (this.seasonExp < need) break;
      this.seasonExp -= need;
      this.seasonLv++;
    }
    if (this.seasonLv >= SEASON_CFG.maxLv) this.seasonExp = 0;   // 升满清零，杜绝残留
    return true;
  },

  /* 周任务定义 + 当前进度（3 个占位任务；进度读写存内存）。
   * 返回内部数组引用：调用方可读 progress，也可经 addWeeklyProgress 累加。 */
  weeklies: function () {
    var self = this;
    return [
      { id: "weekly-kill",     name: "击杀 " + SEASON_CFG.weeklyKillGoal + " 个敌人", goal: SEASON_CFG.weeklyKillGoal,     progress: self._weeklyProgress["weekly-kill"] },
      { id: "weekly-extract",  name: "成功撤离 " + SEASON_CFG.weeklyExtractGoal + " 次", goal: SEASON_CFG.weeklyExtractGoal,  progress: self._weeklyProgress["weekly-extract"] },
      { id: "weekly-levelup",  name: "局内升级 " + SEASON_CFG.weeklyLevelUpGoal + " 次", goal: SEASON_CFG.weeklyLevelUpGoal,  progress: self._weeklyProgress["weekly-levelup"] }
    ];
  },

  /* 周任务进度累加（占位钩子：正式接入时由击杀/撤离/升级事件分别调用） */
  addWeeklyProgress: function (id, n) {
    if (!(id in this._weeklyProgress) || typeof n !== "number" || !(n > 0)) return false;
    this._weeklyProgress[id] += n;
    return true;
  },

  /* 周重置：三个任务进度归零（每周一刷新，占位期手动调用） */
  resetWeekly: function () {
    for (var k in this._weeklyProgress) this._weeklyProgress[k] = 0;
  }
};

/* 21.6 赛季玩法区块结束 */

/* ================= 21.10 主城 NPC 点选（手机端交互缺口修复，独立区块 =================
 * 问题：CFG.mobile.hideTouchButtons = true（21.1 隐藏触屏三按钮）后，主城 NPC 的
 *        唯一入口 actionE()（键盘 E）在手机上不可达 —— 21.1 的 npcTap 只实现在工匠世界
 *        （w.kind !== "artisan" 直接 return），主城从未接入点选，导致「手机端 NPC 无法交互」。
 * 方案：与工匠世界 npcTap 同款范式（站进判定圈 → 点击 NPC 本体），复用 screenToWorld
 *        逆相机变换；门槛三重：① G.state === "city" ② G.cityNpcNear 已命中（进圈即解锁，
 *        无需 dwell）③ 点击点落在 NPC 半径 tapRadius 内。
 * 返回 true = 本次点击已消费（调用方吞掉后续逻辑，与 npcTap 契约一致）。
 * 无机制等价性：桌面端行为不变（键盘 E 路径原样保留，两条路径互不干扰）。 */
function cityNpcTap(clientX, clientY) {
  if (G.state !== "city") return false;
  const near = G.cityNpcNear;
  if (!near) return false;                            // 圈外：不响应（避免隔屏误点）
  const pt = screenToWorld(clientX, clientY);
  if (!pt) return false;
  const cfg = CFG.mobile && CFG.mobile.npcTap;
  const r = (cfg && cfg.tapRadius) || 110;            // 点选判定半径（略大于视觉半径，照顾手指精度）
  if (U.dist(pt.x, pt.y, near.x, near.y) > r) return false;
  if (G.cityNpcOpen && G.cityNpcOpen.id === near.id) { UI.closeNpcPanels(); return true; }  // 再点 = 关闭
  G.cityNpcOpen = near;
  SFX.play("altar");
  EventBus.emit("cityNpcPanel", near);
  return true;
}

/* 主城 NPC 触屏提示（手机无「按 E」键 → 圈内提示改为「点击进入」）。
 * 与 renderNpcTapHint（工匠世界）同款视觉：金环脉冲 + 浮动文案；由 renderCity 单行调用。 */
function renderCityNpcTapHint(ctx, w) {
  if (!w || w.kind !== "city") return;
  const near = G.cityNpcNear;
  if (!near || (G.cityNpcOpen && G.cityNpcOpen.id === near.id)) return;   // 圈内且未打开才提示
  const cfg = CFG.mobile && CFG.mobile.npcTap;
  const r = (cfg && cfg.hintRadius) || 104;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(near.x, near.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,215,106," + (0.55 + 0.45 * pulse) + ")";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,215,106," + (0.7 + 0.3 * pulse) + ")";
  ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.lineWidth = 4;
  ctx.strokeText("点击进入", near.x, near.y - r - 14);
  ctx.fillText("点击进入", near.x, near.y - r - 14);
  ctx.restore();
}

/* 21.10 主城 NPC 点选区块结束 */

/* ============================================================================
 * ====== 21.14 每帧分配消除：对象池 + scratch + swap-remove（独立区块 §5.45）======
 * ----------------------------------------------------------------------------
 * 为什么：全库此前无实体对象池，每帧 new 出 >2 万对象（粒子/飘字/索敌数组），
 *         GC 卡顿造成帧毛刺。本区块提供三项「零新分配」工具，并集中放新增逻辑；
 *         现有函数体内只做就地替换或单行调用（铁律：新增逻辑集中本区块）。
 *
 * 工具：
 *   ① swapRemoveWhere(arr, pred)     —— 通用 filter 就地替换（World.update 三处）
 *   ② _explodeSeen                   —— explode 复用 Set（去重，语义不变）
 *   ③ Pool.recycle(obj)              —— 稳定压缩后仅回收对象（见 js/pool.js，updateFX 用）
 *
 * ---- aliveHeroes() / enemyTargets() 调用点审计（安全第一）----
 * 二者现在返回模块级 scratch 共享引用，故逐一确认**每处均为即时遍历/即时消费**，
 * 无「保存引用跨调用使用」：
 *   • aliveHeroes()：
 *     - nearestHero(x,y) 1292                          —— 立即 for...of 求最近，不保留
 *     - heroInCircle(...) 1311                         —— 立即 for...of 返回首个命中，立即返回元素
 *     - Bullet.update 敌方弹命中 1614                   —— 立即 for...of，命中即 return
 *     - World.update pickups 拾取 3112                  —— 立即 for...of，命中即 break
 *     - World.execEffect heal 3164                      —— 立即 for...of，逐员结算
 *     - Laser.damageTick 4014                           —— 立即 for...of，逐员结算
 *     - updateHazard 4389 `aliveHeroes().filter(...)`   —— filter 立即产出**新数组**，
 *                                                          不持有 scratch 引用 → 安全
 *     - applySupplyEffect heal 4442                     —— 立即 for...of，逐员结算
 *     → 全部即时消费，无保留。✅
 *   • enemyTargets(w)：
 *     - nearestTarget(w,x,y) 1541                      —— 立即 for...of 求最近，不保留
 *     - BossMonster 范围爆炸 1824                       —— 立即 for...of 结算伤害
 *     → 全部即时消费，无保留。✅
 *   另：enemyTargets 内部会调 aliveHeroes()，两者用**不同** scratch（_targetScratch vs
 *   _heroScratch）→ 双缓冲，互不覆盖。故**无需**为任何调用点保留新数组。
 *   且 nearestTarget 返回的是**单个元素**（非数组），调用方只读 tgt.x/tgt.y → 安全。
 * ============================================================================ */

/** 原地删除所有满足 pred 的元素（swap-remove），**保持数组引用不变**、不产生新数组。
 *  与 arr = arr.filter(x => !pred(x)) 的**结果集合**等价；仅**顺序可能不同**——
 *  已验证调用点（World.update 的 monsters/playerBullets/enemyBullets）后续只做
 *  「遍历/判空/取长度」，与元素顺序无关，故逐位等价。 */
function swapRemoveWhere(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) {
      const last = arr.length - 1;
      if (i !== last) arr[i] = arr[last];
      arr.pop();
    }
  }
  return arr;
}

/** explode 专用去重集合：模块级复用，每帧 clear 而非 new Set()。
 *  语义与旧 `const seen = new Set()` 完全一致（仅命中对象入集合、命中才结算）。 */
const _explodeSeen = new Set();

/* 21.14 区域结束 */
