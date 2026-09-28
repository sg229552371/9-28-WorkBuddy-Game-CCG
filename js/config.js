/* ============================================================
 * config.js — 数据驱动配置表（策划可调，程序只实现"积木"）
 * 对应设计文档：3.4 关卡/圆模板、4.7 祭坛表、8.5 实体表、
 * 9.2 重量惩罚、16 章 首版基准
 * ============================================================ */
"use strict";
const CFG = {};

/* ---------- 关卡配置表（表 A） ---------- */
// 解锁链：Meta.data.unlockedLevels 记录已解锁关卡数（通关第 n 关解锁第 n+1 关）
CFG.levels = [
  {
    id: "LEVEL_001", name: "第 1 关 · 荒地哨站",
    mapW: 1920, mapH: 1920,
    monsterLevel: 1,          // 怪物等级（属性成长系数 1 + (lv-1)*0.12）
    eliteBase: 0,             // 首版无独立精英系统
    boss: "BS0001",
    monsterCap: 120,          // 全场怪物上限（性能红线，首版原型降低）
    circles: [{ tpl: "SC01", count: 3 }],   // 引用圆模板
    progressGoal: 60,         // 击杀进度目标
    timeLimit: 180,           // 秒；先到者触发 Boss
    artisanAtKills: 20,       // 工匠雕像刷出的击杀进度（每局最多 1 个）
    // 宝箱不由怪物掉落：宝箱作为雕像在祭坛随机池中刷出（CFG.altars.ALTAR_003，weight 26）
    // 怪物掉落：金币 + 经验宝石（地上拾取物，走过自动拾取）
  },
  {
    id: "LEVEL_002", name: "第 2 关 · 腐朽林地", theme: "#1a2418",
    mapW: 1920, mapH: 1920,
    monsterLevel: 2,
    eliteBase: 0,
    boss: "BS0002",
    monsterCap: 120,
    circles: [{ tpl: "SC02", count: 4 }],
    progressGoal: 72, timeLimit: 200, artisanAtKills: 24,
  },
  {
    id: "LEVEL_003", name: "第 3 关 · 深渊回廊", theme: "#201a2a",
    mapW: 1920, mapH: 1920,
    monsterLevel: 3,
    eliteBase: 0,
    boss: "BS0003",
    monsterCap: 120,
    circles: [{ tpl: "SC02", count: 4 }, { tpl: "SC03", count: 3 }],
    progressGoal: 85, timeLimit: 220, artisanAtKills: 28,
  },
];

/* ---------- 刷怪圆模板表（表 B） ---------- */
CFG.spawnCircles = {
  SC01: { radius: 180, waveSize: 2, pool: "NM0010:70/NM0011:20/NM0012:10", interval: 7.0, trigger: "immediate" },
  SC02: { radius: 200, waveSize: 2, pool: "NM0010:40/NM0011:25/NM0012:20/NM0013:15", interval: 6.0, trigger: "immediate" },
  SC03: { radius: 220, waveSize: 3, pool: "NM0013:35/NM0011:25/NM0012:25/NM0014:15", interval: 5.5, trigger: "immediate" },
};

/* ---------- 刷怪规则（全局） ---------- */
CFG.spawnRules = {
  minDistFromPlayer: 300,   // 刷怪点与玩家最小距离
  bossClearRadius: 380,     // BOSS 存活期间，刷怪点与 BOSS 的最小距离（避免小怪贴脸刷出）
};

/* ---------- 摄像机（跟随玩家，边缘钳制在地图内） ---------- */
CFG.camera = {
  zoom: 1.5,                // 变焦倍数：>1 拉近（可视世界宽 = 画布宽 / zoom）
  smooth: 8,                // 相机平滑跟随系数（越大越跟手）
};

/* ---------- 怪物体积倍数（贴图与碰撞半径同步放大） ---------- */
CFG.monsterSizeMul = 1.5;

/* ---------- 技能系统（现阶段：普攻 + 主动技能自动施法；终极技局外解锁后续开发） ---------- */
CFG.skills2 = {
  autoCast: true,           // 主动技能能量够即自动释放（Space 保留手动触发）
  maxSkillLv: 5,            // 技能局外等级上限（每角色独立，永久生效）
  costBase: 60, costStep: 40,   // 升级消耗结晶：60 / 100 / 140 / 180
  dmgPerLevel: 0.15,        // 每级主动技能伤害 +15%（乘算 dmgMul）
};

/* ---------- 多角色组队（3 英雄上限） ---------- */
CFG.team = { maxSize: 3,
  follow: { trailStep: 5, depth: 58, lateralBase: 18, seedDir: [0, 1], seedDirArtisan: [0, -1] } };
// follow：蛇形尾迹跟随参数——trailStep 采样间距(px)，depth 队友纵向间距(px)，
// lateralBase 横向错开基数(px)（第 i 位错开 = ±(⌊i/2⌋+1)×lateralBase，左右交替，支持任意人数），
// seedDir 开局/进图时尾迹的预铺方向（[0,1]=队友在下方；工匠世界用 seedDirArtisan=[0,-1] 在上方，远离出口圈）

/* ---------- 怪物解锁进度（击杀进度百分比） ---------- */
CFG.monsterUnlock = { NM0010: 0, NM0011: 0.25, NM0012: 0.55, NM0013: 0.15, NM0014: 0.5 };

/* ---------- 敌人配置表（8.5 表 2） ---------- */
CFG.monsters = {
  NM0010: { name: "重甲兵", type: "melee",  sprite: "enemy16",
    hp: 20, atk: 8,  def: 1, spd: 115, radius: 17, exp: 3, coin: 2, touchCd: 0.8 },
  NM0011: { name: "游击弓手", type: "ranged", sprite: "enemy08",
    hp: 13, atk: 6,  def: 0, spd: 95,  radius: 15, exp: 4, coin: 3,
    fireCd: 2.6, bulletSpd: 300, keepDist: 280 },
  NM0012: { name: "冲锋猎犬", type: "charger", sprite: "enemy00",
    hp: 15, atk: 10, def: 0, spd: 135, radius: 15, exp: 5, coin: 3,
    chargeRange: 320, telegraph: 0.6, dashSpd: 560, dashTime: 0.45, chargeCd: 3.0 },
  NM0013: { name: "腐化树人", type: "melee",  sprite: "enemy16",
    hp: 42, atk: 11, def: 2, spd: 95,  radius: 20, exp: 6, coin: 4, touchCd: 0.8 },
  NM0014: { name: "深渊狙击虫", type: "ranged", sprite: "enemy08",
    hp: 20, atk: 9,  def: 1, spd: 90,  radius: 16, exp: 7, coin: 5,
    fireCd: 3.2, bulletSpd: 420, keepDist: 340 },
  BS0001: { name: "触手邪神", type: "boss", sprite: "enemy22",
    hp: 600, atk: 15, def: 3, spd: 72, radius: 46, exp: 60, coin: 80,
    boomCd: 5.0, boomWarn: 1.5, boomRadius: 230, boomDmgMul: 2.4,   // 以自身为中心的圆形范围爆炸
    minionCd: 8.0, minionWave: 2 },
  BS0002: { name: "腐化树母", type: "boss", sprite: "enemy22",
    hp: 950, atk: 18, def: 4, spd: 64, radius: 54, exp: 90, coin: 130,
    boomCd: 4.2, boomWarn: 1.5, boomRadius: 260, boomDmgMul: 2.4,
    minionCd: 7.0, minionWave: 3 },
  BS0003: { name: "深渊吞噬者", type: "boss", sprite: "enemy22",
    hp: 1400, atk: 22, def: 5, spd: 80, radius: 60, exp: 130, coin: 200,
    boomCd: 3.6, boomWarn: 1.4, boomRadius: 290, boomDmgMul: 2.6,
    minionCd: 6.0, minionWave: 3 },
};

/* ---------- 英雄配置表（8.5 表 1，首发 6 角） ---------- */
CFG.heroes = [
  { id: "H001", name: "猎手", desc: "远程速射 / 能量爆发 · 均衡型", sprite: "hero",
    hp: 100, def: 2, atk: 14, energyMax: 100, energyRegen: 10,
    spd: 300, radius: 18, weapon: "W001" },
  { id: "H002", name: "散弹手", desc: "三向散射 / 震荡波 · 近战压制型", sprite: "hero",
    hp: 110, def: 3, atk: 8, energyMax: 100, energyRegen: 10,
    spd: 290, radius: 18, weapon: "W002" },
  { id: "H003", name: "穿甲者", desc: "高穿透直线弹 / 贯穿射线 · 阵地输出型", sprite: "hero",
    hp: 90, def: 1, atk: 16, energyMax: 100, energyRegen: 10,
    spd: 295, radius: 18, weapon: "W003" },
  { id: "H004", name: "弹射手", desc: "弹射跳弹 / 环形弹幕 · 走位牵制型", sprite: "hero",
    hp: 95, def: 2, atk: 11, energyMax: 110, energyRegen: 11,
    spd: 305, radius: 18, weapon: "W004" },
  { id: "H005", name: "快枪手", desc: "极限射速 / 疾跑翻滚 · 高机动型", sprite: "hero",
    hp: 85, def: 1, atk: 7, energyMax: 100, energyRegen: 12,
    spd: 330, radius: 17, weapon: "W005" },
  { id: "H006", name: "重炮手", desc: "低速重弹 / 巨型爆破 · 火力覆盖型", sprite: "hero",
    hp: 120, def: 4, atk: 26, energyMax: 120, energyRegen: 8,
    spd: 265, radius: 19, weapon: "W006" },
  // 原型验证角（批次 E）：召唤/陷阱技能原型载体，后续按设计再作解锁门槛
  { id: "H007", name: "召唤师", desc: "无人机协战 / 机炮 · 召唤物原型角", sprite: "hero",
    hp: 90, def: 1, atk: 12, energyMax: 120, energyRegen: 12,
    spd: 300, radius: 18, weapon: "W007" },
  { id: "H008", name: "陷阱师", desc: "大地雷封锁 / 掷雷 · 陷阱原型角", sprite: "hero",
    hp: 95, def: 2, atk: 15, energyMax: 110, energyRegen: 10,
    spd: 295, radius: 18, weapon: "W008" },
];

/* ---------- 武器配置表（8.5 表 3） ---------- */
CFG.weapons = {
  W001: { id: "W001", name: "速射炮", desc: "专属绑定武器，不可更换",
    // 暴露的技能标签：装备模块词缀只有匹配到标签才生效（16.5）
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT101", skill: "AT102" } },
  W002: { id: "W002", name: "散射炮", desc: "三向散射，单发低伤近距压制",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT103", skill: "AT104" } },
  W003: { id: "W003", name: "磁轨步枪", desc: "自带 2 层穿透的高速直线弹",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT105", skill: "AT106" } },
  W004: { id: "W004", name: "跳弹枪", desc: "子弹在墙与敌人间弹射 2 次",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT107", skill: "AT108" } },
  W005: { id: "W005", name: "双生短枪", desc: "极高射速，单发低伤",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT109", skill: "AT110" } },
  W006: { id: "W006", name: "攻城重炮", desc: "低速重弹，技能为巨型范围爆破",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT111", skill: "AT112" } },
  W007: { id: "W007", name: "无人机母舰", desc: "技能召唤无人机协战（可被击毁）",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数", "召唤物"],
    skills: { basic: "AT115", skill: "AT113" } },
  W008: { id: "W008", name: "布雷器", desc: "技能布设地雷陷阱（敌人入圈延迟引爆）",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数", "陷阱"],
    skills: { basic: "AT116", skill: "AT114" } },
};

/* ---------- 主动技能表（8.5 表 4a，原型取 LV1 行） ---------- */
CFG.skills = {
  AT101: { name: "速射", kind: "basic", cd: 0.75, energy: 0,
    dmgMul: 1.0, bullets: 1, bulletSpd: 620, pierce: 0, bounce: 0 },
  AT102: { name: "能量爆发", kind: "skill", cd: 3.0, energy: 100, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 2.5, radius: 130 },   // 朝目标发射能量弹，命中后圆形范围爆炸
  AT103: { name: "三向散射", kind: "basic", cd: 1.0, energy: 0,
    dmgMul: 0.85, bullets: 3, bulletSpd: 520, pierce: 0, bounce: 0 },
  AT104: { name: "震荡波", kind: "skill", cd: 3.2, energy: 100, tags: ["伤害","冷却","范围"],
    dmgMul: 2.0, radius: 150 },
  AT105: { name: "磁轨弹", kind: "basic", cd: 0.95, energy: 0,
    dmgMul: 1.1, bullets: 1, bulletSpd: 760, pierce: 2, bounce: 0 },
  AT106: { name: "贯穿射线", kind: "skill", cd: 3.0, energy: 100, tags: ["伤害","冷却","穿透","弹速"],
    dmgMul: 2.6, radius: 120 },
  AT107: { name: "跳弹", kind: "basic", cd: 0.85, energy: 0,
    dmgMul: 1.0, bullets: 1, bulletSpd: 560, pierce: 0, bounce: 2 },
  AT108: { name: "环形弹幕", kind: "skill", cd: 3.2, energy: 110, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 1.8, radius: 160, bullets: 8 },
  AT109: { name: "双生速射", kind: "basic", cd: 0.42, energy: 0,
    dmgMul: 0.62, bullets: 1, bulletSpd: 640, pierce: 0, bounce: 0 },
  AT110: { name: "疾风连爆", kind: "skill", cd: 2.4, energy: 100, tags: ["伤害","冷却","弹道数量"],
    dmgMul: 1.9, radius: 120, bullets: 3 },
  AT111: { name: "重锤弹", kind: "basic", cd: 1.25, energy: 0,
    dmgMul: 1.6, bullets: 1, bulletSpd: 430, pierce: 1, bounce: 0 },
  AT112: { name: "攻城爆破", kind: "skill", cd: 3.5, energy: 120, tags: ["伤害","冷却","范围","弹速"],
    dmgMul: 3.2, radius: 190 },

  /* ---------- 召唤物 / 陷阱类技能（原型：效果随技能局外等级由 lv 表驱动） ----------
   * lv 表约定：每个键是按技能等级 LV1~LV5 索引的数组（越界取末位值），策划改表即调平衡。
   * type: "summon" 召唤物（可被敌人攻击）｜ "trap" 陷阱（不被敌人攻击，触发后延迟爆炸） */
  AT113: { name: "召唤无人机", type: "summon", kind: "skill", cd: 12.0, energy: 110,
    tags: ["召唤物", "伤害", "冷却"],
    desc: "召唤/补充无人机协战（自动攻击、可被敌人击毁，再次施放补满）",
    lv: {
      count: [3, 3, 4, 4, 5],        // 无人机数量
      hp:    [40, 60, 85, 115, 150], // 每架生命
      atk:   [6, 8, 10, 13, 16],     // 每架攻击力
      fireCd:[0.8, 0.75, 0.7, 0.65, 0.6],  // 攻击间隔
      orbit: [66, 66, 74, 74, 82],   // 环绕半径
    } },
  AT114: { name: "大地雷", type: "trap", kind: "skill", cd: 9.0, energy: 90,
    tags: ["陷阱", "伤害", "范围", "冷却"], armDelay: 0.5,   // 敌人入圈后引信延迟（固定规则值）
    desc: "在脚下布设地雷：敌人进入范围 0.5 秒后引爆（范围伤害），随后消失",
    lv: {
      count:  [1, 1, 2, 2, 3],            // 同时存在地雷数
      dmgMul: [2.6, 3.2, 3.8, 4.5, 5.5],  // 爆炸伤害（×攻击）
      radius: [110, 120, 130, 140, 160],  // 触发/伤害半径
    } },

  /* ---------- 召唤/陷阱武器的普攻（W007/W008 专属） ---------- */
  AT115: { name: "机炮", kind: "basic", cd: 0.8, energy: 0,
    dmgMul: 0.9, bullets: 1, bulletSpd: 560, pierce: 0, bounce: 0 },
  AT116: { name: "掷雷", kind: "basic", cd: 1.1, energy: 0,
    dmgMul: 1.2, bullets: 1, bulletSpd: 480, pierce: 0, bounce: 0 },
};

/* ---------- 词条标签配置（16.5：先加算后乘算；技能通过自身 tags 决定哪些词条对其生效） ---------- */
CFG.affixTags = {
  "弹道数量": { base: 1,   min: 1,   max: 8,  round: "floor", applyTo: "bullets",  mode: "flat" },
  "冷却":     { base: 1,   min: 0.2, max: 2,  round: "none",  applyTo: "cdMul",    mode: "mult" },
  "弹速":     { base: 1,   min: 0.4, max: 3,  round: "none",  applyTo: "spdMul",   mode: "mult" },
  "范围":     { base: 1,   min: 0.5, max: 3,  round: "none",  applyTo: "aoeMul",   mode: "mult" },
  "穿透":     { base: 0,   min: 0,   max: 5,  round: "floor", applyTo: "pierce",   mode: "flat" },
  "弹射次数": { base: 0,   min: 0,   max: 4,  round: "floor", applyTo: "bounce",   mode: "flat" },
  "伤害":     { base: 1,   min: 0.5, max: 4,  round: "none",  applyTo: "dmgMul",   mode: "mult" },
  // 召唤物 / 陷阱：只对声明了对应标签的技能生效（倍率作用于召唤物攻击 / 陷阱爆炸伤害）
  "召唤物":   { base: 1,   min: 0.5, max: 3,  round: "none",  applyTo: "summonMul", mode: "mult" },
  "陷阱":     { base: 1,   min: 0.5, max: 3,  round: "none",  applyTo: "trapMul",   mode: "mult" },
};

/* ---------- 祭坛效果配置表（4.7：一张表 + 效果积木） ---------- */
// radius = 虚线圈绘制半径（视觉基准）；判定半径 = radius × CFG.altarJudgeMul（外扩 20% 容差）
CFG.altarJudgeMul = 1.2;
CFG.altars = {
  ALTAR_001: { name: "女神雕像", color: "#7de08a", icon: "✚", radius: 117, channel: 2.5, weight: 22,
    effects: [{ type: "heal", pct: 0.25 }] },
  ALTAR_002: { name: "战争雕像", color: "#e5484d", icon: "⚔", radius: 117, channel: 2.5, weight: 20,
    effects: [{ type: "randomBuff", pool: "war", duration: 20 }] },
  ALTAR_003: { name: "宝箱", color: "#ffd76a", icon: "▣", radius: 91, channel: 1.2, weight: 26,
    effects: [{ type: "giveChest", weights: { normal: 48, advanced: 28, epic: 16, divine: 6, mythic: 2 } }] },
  ALTAR_004: { name: "邪神雕像", color: "#9a5cf5", icon: "☠", radius: 117, channel: 2.5, weight: 12,
    effects: [{ type: "adjustMonsters", target: "小怪属性", range: [-60, 60], duration: 30 }] },
  ALTAR_005: { name: "工匠雕像", color: "#6cb2ff", icon: "⚒", radius: 117, channel: 2.5, weight: 0,
    effects: [{ type: "teleport", submap: "artisan" }] },   // 非随机刷出，由击杀进度触发
  RIFT: { name: "空间裂缝", color: "#5ad0ff", icon: "◈", radius: 117, channel: 2.0, weight: 3,
    effects: [{ type: "rift" }] },                          // 空间裂缝入口：读条进入战斗子地图
  EXTRACT_BEACON: { name: "撤离信标", color: "#7de08a", icon: "▲", radius: 117, channel: 1.5, weight: 4,
    effects: [{ type: "giveExtractToken" }] },              // 场景掉落：获得撤离点代币（上限 1）
};

/* ---------- 空间裂缝系统（5.1 / 13.10） ---------- */
CFG.rift = {
  channel: 5.0,           // 返回信标读条 5 秒；仅受击归零（移动不打断，用户已改规则）
  worldSize: 1920,        // 子地图尺寸（与关卡地图统一）
  rewardKills: 12,        // 子地图击杀达标 → 刷出奖励宝箱雕像（基础奖励）
  chestWeights: { normal: 0, advanced: 20, epic: 45, divine: 25, mythic: 10 },   // 奖励宝箱品质权重
  /* 任务变体（待细化 20：§五 任务型子地图）——进入时按权重随机一个；
   * 任务不强制（返回信标照常可用），完成 → 额外刷出高价值"任务奖励宝箱"；限时超时 → 失败。 */
  tasks: [
    { id: "hunt",  name: "深入猎杀", weight: 2, goal: 20, desc: "击杀 20 只裂缝怪物" },
    { id: "purge", name: "歼灭作战", weight: 2, goal: 18, time: 75, desc: "75 秒内击杀 18 只" },
    { id: "raid",  name: "闪电突袭", weight: 1, goal: 10, time: 40, desc: "40 秒内击杀 10 只" },
  ],
  taskBonusWeights: { normal: 0, advanced: 0, epic: 30, divine: 45, mythic: 25 },   // 任务奖励宝箱品质权重
};

/* ---------- 撤离点代币（5.2：按文档重构） ----------
 * 来源：最终 Boss 掉落 + 撤离信标祭坛（场景掉落）；上限 1 个；
 * 不占格、无重量；任意位置激活读条 8 秒，受击/移动归零（代币保留可再次激活）；死亡随角色失去。 */
CFG.extract = { channel: 8.0, refundNote: "死亡时代币失去" };

/* ---------- 保险契约（方案 A：背包道具） ----------
 * 开箱概率掉出；占 1 格、有重量、可叠加；死亡时每份契约保护 1 件价值最高的物品；
 * 撤离成功时剩余契约折算为进化结晶；契约本身不参与死亡损失。 */
CFG.insurance = { name: "保险契约", chance: 0.15, weight: 5, value: 60, crystalRefund: 20, maxStack: 9 };

/* ---------- 武器等级（待细化 34：金币升级，工匠世界内；技能等级 = 武器等级同步） ----------
 * 手写 1-10 级表（数据驱动，程序不写成长公式）；武器等级为局外永久资产（按英雄存档）；
 * cost 为工匠世界内升级所需金币（局内货币）。 */
CFG.weaponLevel = { maxLv: 10 };
CFG.weaponLevels = [
  { basicMul: 1.00, skillMul: 1.00, cost: 0 },
  { basicMul: 1.08, skillMul: 1.15, cost: 120 },
  { basicMul: 1.16, skillMul: 1.30, cost: 180 },
  { basicMul: 1.24, skillMul: 1.45, cost: 240 },
  { basicMul: 1.32, skillMul: 1.60, cost: 320 },
  { basicMul: 1.40, skillMul: 1.75, cost: 420 },
  { basicMul: 1.48, skillMul: 1.90, cost: 540 },
  { basicMul: 1.56, skillMul: 2.05, cost: 680 },
  { basicMul: 1.64, skillMul: 2.20, cost: 840 },
  { basicMul: 1.75, skillMul: 2.40, cost: 1000 },
];

/* ---------- 精英怪系统（词缀精英） ----------
 * 基础怪 + 1~2 条随机词缀；体型放大 + 光环标识；必掉宝箱 + 额外经验。
 * 裂缝子地图出现概率更高。护盾词缀：额外护盾值，先扣盾后扣血。 */
CFG.elites = {
  chance: 0.05,           // 主地图基础概率
  chanceProgress: 0.06,   // 随击杀进度追加（进度满时合计约 11%）
  riftChance: 0.20,       // 裂缝子地图概率
  affixCount: [1, 2],     // 词缀条数范围
  sizeMul: 1.35,          // 体型放大（在 monsterSizeMul 基础上）
  affixes: {
    "坚韧": { hpMul: 3.0, defAdd: 2, color: "#e5a04b" },
    "迅捷": { spdMul: 1.5, atkMul: 1.1, color: "#5ad0ff" },
    "狂暴": { atkMul: 1.7, spdMul: 1.15, color: "#ff5b5b" },
    "护盾": { shieldHp: 60, hpMul: 1.5, color: "#6cb2ff" },
  },
  dropChest: { normal: 30, advanced: 40, epic: 20, divine: 8, mythic: 2 },   // 必掉宝箱品质权重
  extraExp: 2,            // 额外经验宝石数
};

/* ---------- 战争雕像增益池（4.4，各 20 秒） ---------- */
CFG.warBuffs = [
  { id: "狂力", stat: "atk", mul: 1.30, label: "攻击力 +30%" },
  { id: "迅击", stat: "cdMul", mul: 0.70, label: "攻速 +30%" },
  { id: "疾风", stat: "spd", mul: 1.30, label: "移速 +30%" },
  { id: "汲血", stat: "lifesteal", mul: 0.15, label: "吸血 15%" },
];

/* ---------- 宝箱品质表（6.2，首发 5 阶） ---------- */
CFG.chestQualities = {
  normal:   { name: "普通宝箱", color: "#9aa7b8", weight: 8,  stackMax: 5, value: 20,   dropW: 70 },
  advanced: { name: "高级宝箱", color: "#6cb2ff", weight: 12, stackMax: 5, value: 60,   dropW: 25 },
  epic:     { name: "史诗宝箱", color: "#c79bff", weight: 18, stackMax: 5, value: 150,  dropW: 5 },
  divine:   { name: "神圣宝箱", color: "#ffd76a", weight: 26, stackMax: 5, value: 400,  dropW: 0 },
  mythic:   { name: "神话宝箱", color: "#ff8c5a", weight: 36, stackMax: 3, value: 1000, dropW: 0 },
};

/* ---------- 装备定义（首版：固定形状、不可旋转） ---------- */
CFG.gearDefs = [
  { id: "G001", name: "瞄准镜",   shape: [1,1], weight: 3,  stats: { atk: 4 } },
  { id: "G002", name: "作战背心", shape: [2,2], weight: 9,  stats: { hp: 30 } },
  { id: "G003", name: "动力靴",   shape: [1,2], weight: 4,  stats: { spd: 25 } },
  { id: "G004", name: "装甲板",   shape: [2,1], weight: 6,  stats: { def: 3 } },
  { id: "G005", name: "核心电池", shape: [1,1], weight: 2,  stats: { regen: 4, energyMax: 20 } },
  { id: "G006", name: "强化握把", shape: [1,1], weight: 2,  stats: { atk: 2, def: 1 } },
  { id: "G007", name: "动力核心", shape: [2,2], weight: 10, stats: { hp: 40, regen: 6 } },
  { id: "G008", name: "超载电容", shape: [1,2], weight: 5,  stats: { energyMax: 30, regen: 5 } },
];

/* ---------- 装备模块定义（16.5：词缀匹配武器标签才生效） ---------- */
CFG.moduleDefs = [
  { id: "M001", name: "弹头扩容", shape: [1,1], weight: 5, affix: { tag: "弹道数量", mode: "flat", vals: [1,1,1,1] } },
  { id: "M002", name: "冷却线圈", shape: [2,1], weight: 6, affix: { tag: "冷却", mode: "mult", vals: [-0.08,-0.12,-0.16,-0.22] } },
  { id: "M003", name: "高速枪管", shape: [1,2], weight: 5, affix: { tag: "弹速", mode: "mult", vals: [0.12,0.20,0.30,0.45] } },
  { id: "M004", name: "聚焦透镜", shape: [1,1], weight: 4, affix: { tag: "范围", mode: "mult", vals: [0.10,0.15,0.22,0.32] } },
  { id: "M005", name: "穿甲弹头", shape: [2,1], weight: 6, affix: { tag: "穿透", mode: "flat", vals: [1,1,1,1] } },
  { id: "M006", name: "弹跳装置", shape: [2,2], weight: 9, affix: { tag: "弹射次数", mode: "flat", vals: [1,1,1,1] } },
  { id: "M007", name: "相位线圈", shape: [1,1], weight: 3, affix: { tag: "冷却", mode: "mult", vals: [-0.10,-0.14,-0.20,-0.26] } },
  { id: "M008", name: "聚能弹头", shape: [2,1], weight: 6, affix: { tag: "范围", mode: "mult", vals: [0.14,0.20,0.28,0.40] } },
  { id: "M009", name: "增幅器", shape: [1,1], weight: 4, affix: { tag: "伤害", mode: "mult", vals: [0.10,0.15,0.22,0.30] } },
  { id: "M010", name: "引力增幅器", shape: [1,1], weight: 4, affix: { tag: "召唤物", mode: "mult", vals: [0.08,0.12,0.18,0.25] } },
  { id: "M011", name: "感应引信", shape: [2,1], weight: 5, affix: { tag: "陷阱", mode: "mult", vals: [0.10,0.15,0.22,0.30] } },
  { id: "M012", name: "毒性涂层", shape: [1,2], weight: 5, affix: { tag: "伤害", mode: "mult", vals: [0.12,0.18,0.26,0.36] } },
];

/* ---------- 模组等级系统（叠加升级：相同模组合并 → 等级+1） ----------
 * 9 个等级、3 个阶段（每阶段 3 级）；阶段词缀为"强化技能效果"的附加词缀，
 * 仅对主动技能生效（按技能自身 tags 匹配，见 recomputeWeapon / tagCalc）。 */
CFG.moduleLevel = {
  maxLv: 9,
  perStage: 3,            // 每阶段级数：LV1~3 阶段1 / LV4~6 阶段2 / LV7~9 阶段3
  valueStep: 0.15,        // 主词缀数值随等级成长：有效值 = 基础值 × (1 + (lv-1) × valueStep)
  linkBonus: 0.03,        // 连接效果：武器栏中相邻（边接触）同品质模组，每对 +3% 技能伤害
  // 阶段词缀（通用池，按阶段解锁：阶段 n 解锁前 n 条；策划可整体替换）
  stageAffixes: [
    { name: "强化·技能伤害", tag: "伤害", mode: "mult", value: 0.06 },
    { name: "强化·技能冷却", tag: "冷却", mode: "mult", value: -0.05 },
    { name: "强化·技能范围", tag: "范围", mode: "mult", value: 0.06 },
  ],
};

/* ---------- 模组套装（16.7 模组深度：同系列集齐 N 件触发词缀强化，仅武器栏内计数） ---------- */
CFG.moduleSets = {
  SET_BALLISTIC: { name: "弹道套装", members: ["M001", "M005"],
    bonuses: { 2: { tag: "弹道数量", value: 1 } } },          // 集齐 2 件：弹道 +1
  SET_COOLING:   { name: "冷却套装", members: ["M002", "M007"],
    bonuses: { 2: { tag: "冷却", value: -0.06 } } },          // 集齐 2 件：技能冷却 -6%
  SET_POWER:     { name: "增幅套装", members: ["M009", "M012"],
    bonuses: { 2: { tag: "伤害", value: 0.08 } } },           // 集齐 2 件：技能伤害 +8%
};

/* ---------- 物品品质（白/蓝/紫/金）与价值系数 ---------- */
CFG.itemQualities = [
  { name: "白", valueMul: 1.0, color: "#b8c4d4" },
  { name: "蓝", valueMul: 1.8, color: "#5aa2ff" },
  { name: "紫", valueMul: 3.2, color: "#b06cff" },
  { name: "金", valueMul: 6.0, color: "#ffd76a" },
];

/* ---------- 宝箱内容池：品质 → 可开出定义 + 品质权重 ---------- */
CFG.chestContents = {
  normal:   { defs: ["G001","G003","G006","M003","M004"], itemQW: [70,25,5,0] },
  advanced: { defs: ["G002","G004","G005","M002","M005"], itemQW: [30,45,20,5] },
  epic:     { defs: ["G002","G004","M001","M005","M006"], itemQW: [5,35,45,15] },
  divine:   { defs: ["G001","G002","G004","G007","M001","M005","M006","M007","M010","M011"], itemQW: [0,10,50,40] },
  mythic:   { defs: ["G005","G007","G008","M001","M006","M007","M008","M010","M011","M012"], itemQW: [0,0,30,70] },
};

/* ---------- 背包 / 武器栏 / 重量（9.2） ---------- */
CFG.backpack = { cols: 6, rows: 4 };
CFG.weaponGrid = { cols: 4, rows: 3 };
CFG.weight = { threshold: 100, minFactor: 0.2, slope: 0.8, divisor: 100 };

/* ---------- 死亡惩罚（16.6） ---------- */
CFG.deathPenalty = { loseRatio: 0.7 };

/* ---------- 局外成长（双层等级体系：局外角色等级 + 结晶材料，数值暂定） ---------- */
CFG.outLevel = {
  maxLevel: 10,
  costBase: 50, costStep: 40,          // LV n→n+1 消耗结晶 = costBase + (n-1)*costStep
  growth: { hp: 8, atk: 2, def: 1 },   // 每级成长（对局内基础属性）
  crystalKill: 1,                      // 每击杀获得结晶
  crystalBoss: 30,                     // 击败 Boss 额外结晶
  deathRatio: 0.3,                     // 死亡仅保留 30% 本局结晶
};

/* ---------- 属性卡牌（8.3：升级获得资产、仅工匠世界使用、池内同属性去重） ---------- */CFG.cardPool = {
  qualityWeights: { 0: 55, 1: 28, 2: 13, 3: 4 },  // 白/蓝/紫/金 抽取权重
  candidateCount: 3,                   // 每次展示候选张数
  refreshPerRun: 2,                    // 每局免费刷新次数（待细化 #37：来源 = 本局固定 2 次 + 结晶付费）
  refreshCrystalCost: 15,              // 免费次数用完后的付费刷新价格（结晶）
  dedupApplied: true,                  // 已使用的属性不再出现在后续候选中（池内去重）
  // 每属性 4 档品质数值；mul: true 表示乘算（如冷却）、否则加算
  attrs: {
    atk:   { name: "攻击强化", flat: [2, 4, 7, 12] },
    hp:    { name: "生命上限", flat: [10, 20, 35, 60] },
    def:   { name: "防御强化", flat: [1, 2, 4, 6] },
    spd:   { name: "移动速度", flat: [8, 15, 25, 40] },
    regen: { name: "能量回复", flat: [2, 4, 6, 10] },
    energyMax: { name: "能量上限", flat: [10, 18, 28, 45] },
    cd:    { name: "攻速(冷却)", flat: [0.96, 0.92, 0.88, 0.84], mul: true },   // 乘算冷却缩减
    lifesteal: { name: "吸血", flat: [0.02, 0.04, 0.07, 0.12] },
    bullets: { name: "弹道数量", flat: [1, 1, 2, 2] },
  },
};

/* ---------- 局内→局外资源转化（待细化 5：撤离成功结算折算） ----------
 * 双层等级体系闭环：局内资产不可直接带出（16.6），撤离时统一折算为进化结晶；
 * 死亡时不折算（死亡惩罚已处理物品损失，经验/货币清零见 6.5）。 */
CFG.settleConvert = {
  coinPerCrystal: 20,     // 每 20 金币折 1 结晶
  chestRatio: 0.5,        // 未开封宝箱按价值 ×0.5 折算
  itemRatio: 0.25,        // 装备/模组按价值 ×0.25 折算
  cardCrystal: 2,         // 每张剩余属性卡牌资产折 2 结晶
};

/* ---------- 工匠世界金币服务（待细化 28：强化物品规则） ----------
 * 强化物品 = 消耗金币的物品强化/购买服务（4.6）；全部走本表，策划改价即调。 */
CFG.artisanServices = {
  qualityUp: { costs: [80, 160, 320], desc: "装备/模组品质提升一档（白→蓝→紫→金）" },   // 索引=当前品质档
  rerollModule: { cost: 120, desc: "重掷模组主词缀档位（保留等级与类型）" },
  buyInsurance: { cost: 150, desc: "购买 1 份保险契约" },
  buyChest: { advanced: 100, epic: 220, divine: 480 },   // 各档宝箱售价
};

/* ---------- 诅咒道具（待细化 36：给敌人附加技能的道具） ----------
 * 使用后向局内敌人动态附加属性修改器/被动技能（8.2"可被添加技能：是"）；
 * 风险回报：敌人被强化，期间金币与经验掉落 ×rewardMul。仅限主地图战斗中使用。 */
CFG.curseItems = {
  chance: 0.05,           // 开箱掉出概率（保险判定之后）
  weight: 2, value: 40,   // 占 1 格；重量 / 价值
  duration: 45,           // 默认持续（秒）
  list: [
    { id: "C001", name: "铁壁诅咒", desc: "敌人防御 ×3、生命 ×1.5", defMul: 3, hpMul: 1.5, atkMul: 1, spdMul: 1, rewardMul: 2 },
    { id: "C002", name: "狂暴诅咒", desc: "敌人攻击 ×1.6、移速 ×1.25", defMul: 1, hpMul: 1.2, atkMul: 1.6, spdMul: 1.25, rewardMul: 2.5 },
    { id: "C003", name: "巨影诅咒", desc: "敌人生命 ×2.5", defMul: 1, hpMul: 2.5, atkMul: 1, spdMul: 1, rewardMul: 2 },
  ],
};

/* ---------- 音效（WebAudio 合成，零素材；打击感参数） ---------- */
CFG.audio = {
  enabled: true,
  master: 0.45,          // 总音量 0~1
  shake: { hurt: 7, bossBoom: 11, dur: 0.32 },   // 屏幕震动：幅度(px) 与时长(s)
};
