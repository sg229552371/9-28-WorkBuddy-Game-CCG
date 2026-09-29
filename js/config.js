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
    eliteBase: 2,             // 独立精英怪基础数量（可被邪神雕像"精英数量"倍率增减，见 4.5）
    elitePool: "ED0001:60/ED0002:30/ED0003:10",   // 本关精英怪池（编号:权重；编号:权重）
    boss: "BS0001",
    monsterCap: 120,          // 全场怪物上限（性能红线，首版原型降低）
    circles: [{ tpl: "SC01", count: 3 }],   // 引用圆模板
    progressGoal: 60,         // 击杀进度目标
    timeLimit: 180,           // 秒；先到者触发 Boss
    artisanAtKills: 20,       // 首次工匠雕像的击杀里程碑（后续投放由 CFG.artisan 雕像池控制）
    // 宝箱不由怪物掉落：宝箱作为雕像在祭坛随机池中刷出（CFG.altars.ALTAR_003，weight 26）
    // 怪物掉落：金币 + 经验宝石（地上拾取物，走过自动拾取）
  },
  {
    id: "LEVEL_002", name: "第 2 关 · 腐朽林地", theme: "#1a2418",
    mapW: 1920, mapH: 1920,
    monsterLevel: 2,
    eliteBase: 3,
    elitePool: "ED0001:50/ED0002:30/ED0003:20",
    boss: "BS0002",
    monsterCap: 120,
    circles: [{ tpl: "SC02", count: 4 }],
    progressGoal: 72, timeLimit: 200, artisanAtKills: 24,
  },
  {
    id: "LEVEL_003", name: "第 3 关 · 深渊回廊", theme: "#201a2a",
    mapW: 1920, mapH: 1920,
    monsterLevel: 3,
    eliteBase: 4,
    elitePool: "ED0001:40/ED0002:30/ED0003:30",
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

/* ---------- 独立精英怪投放（3.3 / 4.5） ----------
 * 精英怪不进随机圆（ED 编号不出现在圆模板的 pool 里），由关卡层定点投放：
 * 进场 firstDelay 秒后投第一只，之后每隔 interval 秒检查一次，未达目标数就补投一只；
 * 目标数 = round(关卡 eliteBase × "精英数量"倍率)，倍率变化实时重算，只影响后续投放。 */
CFG.eliteSpawn = {
  firstDelay: 6,            // 进场后首只精英投放延迟（秒）
  interval: 14,             // 补投检查间隔（秒）
};

/* ---------- 摄像机（跟随玩家，边缘钳制在地图内） ----------
 * 跨端口径：**垂直视野固定 viewH 世界单位**（画布高 = viewH × zoom）——
 * 角色在屏幕上的大小只由 zoom 决定，PC / 手机一致；画布**宽度**跟随屏幕比例伸缩（宽屏看更多、竖屏看更窄）。 */
CFG.camera = {
  zoom: 1.5,                // 变焦倍数：>1 拉近（可视世界宽 = 画布宽 / zoom）
  viewH: 720,               // 垂直视野（世界单位，固定）：跨端角色大小一致的锚
  minAspect: 0.75,          // 最小宽高比：比 4:3 更窄的竖屏按 4:3 钳制画布宽（避免视野过窄），多余部分左右留边
  smooth: 8,                // 相机平滑跟随系数（越大越跟手）
};

/* ---------- 怪物体积倍数（贴图与碰撞半径同步放大） ---------- */
CFG.monsterSizeMul = 1.5;

/* ---------- 技能系统（现阶段：普攻 + 主动技能自动施法；终极技局外解锁后续开发） ----------
 * 注：技能局外等级已并入武器等级（Meta.weaponUp/weaponUpCost），此处仅保留自动施法开关。 */
CFG.skills2 = {
  autoCast: false,          // 主动技能自动施放：**默认关闭**，由局内 HUD「自动战斗」按钮控制（G.run.autoFight）；Space 保留手动触发
};

/* ---------- 自动战斗（托管 AI：转向力叠加模型，优先级 躲避威胁 > 边界保命 > 资源目标 > 保持攻击距离 > 索敌） ----------
 * 三种风格打包「索敌激进度 / 躲避范围 / 反应速度 / 低血量行为 / 资源习惯」：
 *   engageMul      期望攻击距离 = engageBase × engageMul（疯狂贴脸、冷静拉满风筝）
 *   dodgeBullets   是否躲避敌方子弹（预判弹道最近逼近点）
 *   dodgeMargin    预警圈/冲锋线躲避半径放大系数（冷静档提前更多离开危险区）
 *   reactDelay     威胁反应延迟秒（疯狂档反应慢 → 偶尔吃刀，保留游戏张力）
 *   lowHpFlee      血量低于该比例时转入拉开距离风筝（0 = 莽到底不退）
 *   loot           拾取习惯（对象）：range 扫描半径(px，0=不捡) / chests 是否捡地上宝箱 / gate 触发时机
 *                  gate: "path"=战斗中顺路捡（100px 内视为贴身顺路）/ "gap"=战斗目标较远或清场时（战斗间隙）
 *                        "clear"=战后清扫（战斗目标在清扫圈外或已清场）
 *   altar          雕像激活习惯（对象）：war 战争雕像 / chest 宝箱雕像 / evil 邪神雕像 / artisan 工匠雕像（bool）；
 *                  goddessHp 女神雕像激活的生命门槛（比例，null=从不）；残血达门槛时女神优先于其他雕像
 *                  （门槛在选目标时判定一次，读条开始后不反悔；威胁让位/超时等保护规则全局生效） */
CFG.autoFight = {
  defaultStyle: "balanced",
  manualResumeDelay: 0.5,   // 玩家手动操作松手后，AI 恢复接管前的延迟（无缝切换）
  smoothing: 10,            // 移动向量平滑系数（转向惯性，防抖动）
  bulletScan: 220,          // 子弹威胁扫描半径(px)
  engageBase: 240,          // 期望攻击距离基准(px)
  threatWeight: 2.6,        // 躲避力权重（相对走位/索敌的 1.0）
  strafeT: 1.6,             // 风筝环绕方向的切换周期(秒)
  wallMargin: 110,          // 边界回避：距墙该范围内受向内软推力（角落自救）
  wallWeight: 3.0,          // 边界力权重（高于威胁躲避：贴墙保命优先，风筝不会把队长顶进墙角）
  altarRange: 640,          // 雕像/祭坛激活扫描半径
  altarTimeout: 8,          // 走向雕像超时放弃（秒），防止目标失效后卡死
  chestFailCooldown: 3,     // 地上宝箱拾取失败（背包满）后的跳过时长（秒），防止 AI 反复撞击刷 toast
  styles: {
    berserk:  { name: "疯狂", engageMul: 0.35, dodgeBullets: false, dodgeTelegraph: true, dodgeMargin: 1.15, reactDelay: 0.4, lowHpFlee: 0,
      loot: { range: 100, chests: true, gate: "path" },
      altar: { war: true, chest: true, evil: true, goddessHp: 0.30, artisan: false },
      desc: "贴脸输出；顺路捡 100px 内掉落与宝箱，主动踩战争/宝箱/邪神雕像，残血 30% 以下才踩女神" },
    balanced: { name: "平衡", engageMul: 0.75, dodgeBullets: true,  dodgeTelegraph: true, dodgeMargin: 1.5,  reactDelay: 0.2, lowHpFlee: 0.4,
      loot: { range: 220, chests: true, gate: "gap" },
      altar: { war: true, chest: true, evil: false, goddessHp: 0.60, artisan: false },
      desc: "中距离风筝躲弹幕；战斗间隙捡 220px 内掉落与宝箱、激活战争/宝箱雕像，残血 60% 以下踩女神" },
    cautious: { name: "冷静", engageMul: 1.05, dodgeBullets: true,  dodgeTelegraph: true, dodgeMargin: 1.9,  reactDelay: 0.1, lowHpFlee: 0.6,
      loot: { range: 520, chests: true, gate: "clear" },
      altar: { war: true, chest: true, evil: false, goddessHp: 0.60, artisan: false },
      desc: "最远距离风筝见弹就躲；战后清扫 520px 内掉落与宝箱、激活战争/宝箱雕像，残血 60% 以下踩女神" },
  },
};

/* ---------- 多角色组队（3 英雄上限） ---------- */
CFG.team = { maxSize: 3,
  follow: { trailStep: 5, depth: 58, lateralBase: 18, seedDir: [0, 1], seedDirArtisan: [0, -1] },
  // AI 队友行为：普攻 + 主动技能（技能释放不耗能量池，按各自技能冷却施放；首个技能的初始冷却错峰系数 秒/人）
  aiSkill: true, skillStagger: 0.6 };
// follow：蛇形尾迹跟随参数——trailStep 采样间距(px)，depth 队友纵向间距(px)，
// lateralBase 横向错开基数(px)（第 i 位错开 = ±(⌊i/2⌋+1)×lateralBase，左右交替，支持任意人数），
// seedDir 开局/进图时尾迹的预铺方向（[0,1]=队友在下方；工匠世界用 seedDirArtisan=[0,-1] 在上方，远离出口圈）

/* ---------- 移动端虚拟控件（手机端测试用） ----------
 * autoShow=true：检测到触屏（ontouchstart / maxTouchPoints）自动显示；桌面端不遮挡。
 * 摇杆参数：size 底盘直径(px)、knob 摇杆头直径(px)、deadZone 死区比例（归一化向量，低于此值视为静止）。 */
CFG.mobile = {
  autoShow: true,
  joystick: { size: 132, knob: 56, deadZone: 0.18, maxVec: 1.0 },
  buttons: { skill: true, interact: true, backpack: true },
};

/* ---------- 游戏主城（Hub，流程：首页 → 主城 → 传送门 → 选角 → 关卡） ----------
 * 主城是可操控「玩家形象」行走的安全区：无敌人、不加载战斗系统（队友/弹道/撤离全部不进主城）。
 * NPC = 交互块（进圈即弹面板）；传送门 = 进圈读条出征（复用撤离读条的圈内积累/离开衰退契约）。
 * seasonPortal：赛季玩法上线后再单独开一个门（配置预留，为 null 时不渲染不判定）。 */
CFG.city = {
  mapW: 1280, mapH: 960,
  moveSpd: 210,             // 主城行走速度（无负重无增益，固定值）
  spawn: { x: 0.5, y: 0.78 },   // 出生点（比例坐标，城内下方居中）
  portal: { name: "出征传送门", radius: 90, channel: 2.0, desc: "进圈读条 2 秒 → 选择关卡出征" },
  seasonPortal: null,       // 预留：{ name:"赛季传送门", radius:90, channel:2.0 }，赛季玩法上线后填入
  npcRadius: 76,            // NPC 交互判定半径（进圈标亮，按 E / 触屏「交互」弹面板，离圈或 Esc 关闭）
  // NPC 扇形环绕中央广场分布（坐标为比例，加载时换算成像素）
  npcs: [
    { id: "NPC_TRAINER", name: "强化导师", icon: "✦", color: "#c79bff", fx: 0.20, fy: 0.32, func: "outlevel", desc: "局外等级升级" },
    { id: "NPC_SMITH",   name: "武器匠",   icon: "⚔", color: "#ffd76a", fx: 0.38, fy: 0.24, func: "weapon",   desc: "武器 / 技能等级" },
    { id: "NPC_MIRROR",  name: "形象师",   icon: "☺", color: "#7de08a", fx: 0.62, fy: 0.24, func: "profile",  desc: "头像 · 更名 · 称号 · 皮肤" },
    { id: "NPC_CODEX",   name: "图鉴学者", icon: "❖", color: "#6cb2ff", fx: 0.80, fy: 0.32, func: "codex",    desc: "英雄 / 怪物图鉴" },
    { id: "NPC_SHOP",    name: "神秘商人", icon: "◈", color: "#e5a04b", fx: 0.14, fy: 0.62, func: "shop",     desc: "敬请期待" },
    // ⚠️ 商人原在 (0.50, 0.14) 顶部中央——与出征传送门 (w/2, 90) 判定圈完全重叠（中心仅差 44px），已移到西翼空位
  ],
};

/* ---------- 玩家档案（主城形象：更名 / 头像皮肤 / 称号） ----------
 * 皮肤 = 各英雄的外貌，解锁条件 = 该英雄已在图鉴激活（本局用过该英雄出征，见 Meta.activateHero）。
 * 称号由成就标记解锁（Meta.data.codex.flags）。 */
CFG.profile = {
  defaultName: "无名旅者",
  nameMin: 2, nameMax: 8,
  defaultSkin: "H001",      // 初始形象（H001 永久解锁）
  titles: [
    { id: "t_rookie",   name: "初出茅庐", flag: null,             desc: "默认称号" },
    { id: "t_extractor", name: "撤离者",  flag: "firstExtract",  desc: "完成一次撤离" },
    { id: "t_godslayer", name: "弑神者",  flag: "bossKill",      desc: "击败一次 BOSS" },
  ],
};

/* ---------- 设置（首页入口；独立 localStorage 键持久化） ---------- */
CFG.settings = {
  saveKey: "bagrogue_settings_v1",
  sfxVolume: { default: 0.8, min: 0, max: 1, step: 0.1 },   // 音效音量（SFX 主增益）
  joyScale: { default: 1.0, min: 0.7, max: 1.5, step: 0.1 }, // 触屏控件整体缩放
  showTouchOnDesktop: { default: false },                    // 桌面端强制显示触屏控件（调试用）
};

/* ---------- 物品 TIPS 浮窗（悬停/长按出提示；全场景复用一个渲染函数） ---------- */
CFG.tooltip = {
  hoverDelay: 0.28,        // 桌面悬停延迟（秒）：快速划过背包不闪烁
  pressDelay: 0.38,        // 移动端长按延迟（秒）
};

/* ---------- 怪物解锁进度（击杀进度百分比） ---------- */
CFG.monsterUnlock = { NM0010: 0, NM0011: 0.25, NM0012: 0.55, NM0013: 0.15, NM0014: 0.5 };

/* ---------- 敌人配置表（8.5 表 2） ----------
 * type = AI 行为类型（melee / ranged / charger / boss），决定行动方式；
 * skillList = 攻击技能条目（技能表 4e 视图），**攻击参数全部来自技能表**，本表不再硬编码
 *   （原 fireCd / bulletSpd / keepDist / chargeRange / boomCd / minionCd 等已迁至 AT2xx）。
 * 多个怪物可复用同一技能条目（如 AT201 被重甲兵与重装督军共用）。 */
CFG.monsters = {
  NM0010: { name: "重甲兵", type: "melee", sprite: "enemy16", skillList: ["AT201"],
    hp: 20, atk: 8,  def: 1, spd: 115, radius: 17, exp: 3, coin: 2 },
  NM0011: { name: "游击弓手", type: "ranged", sprite: "enemy08", skillList: ["AT202"],
    hp: 13, atk: 6,  def: 0, spd: 95,  radius: 15, exp: 4, coin: 3 },
  NM0012: { name: "冲锋猎犬", type: "charger", sprite: "enemy00", skillList: ["AT203"],
    hp: 15, atk: 10, def: 0, spd: 135, radius: 15, exp: 5, coin: 3 },
  NM0013: { name: "腐化树人", type: "melee",  sprite: "enemy16", skillList: ["AT201"],
    hp: 42, atk: 11, def: 2, spd: 95,  radius: 20, exp: 6, coin: 4 },
  NM0014: { name: "深渊狙击虫", type: "ranged", sprite: "enemy08", skillList: ["AT204"],
    hp: 20, atk: 9,  def: 1, spd: 90,  radius: 16, exp: 7, coin: 5 },

  /* ---------- 独立精英怪 ED（3.3 原方案）：由关卡层定点投放，不进随机圆 ----------
   * 属性明显强于普通小怪（生命/攻击/防御更高、体型更大）；携带 1~2 条随机词缀（见 CFG.elites）。
   * sprite 复用现有素材键（enemy00 / enemy08 / enemy16 / enemy22）。 */
  ED0001: { name: "重装督军", type: "melee", sprite: "enemy16", skillList: ["AT201"],
    hp: 150, atk: 16, def: 6, spd: 120, radius: 30, exp: 30, coin: 20 },
  ED0002: { name: "蚀魂狙击手", type: "ranged", sprite: "enemy08", skillList: ["AT205"],
    hp: 110, atk: 14, def: 4, spd: 95, radius: 28, exp: 32, coin: 22 },
  ED0003: { name: "裂颅追猎者", type: "melee", sprite: "enemy00", skillList: ["AT206"],
    hp: 130, atk: 18, def: 3, spd: 135, radius: 28, exp: 34, coin: 24 },

  /* ---------- BOSS（第十七章：弹幕化 + 阶段化）----------
   * skillList[0] 仍是**基础行为技能**（圆形 AOE + 召唤小怪，AT207~209）；
   * skillList[1..] 是**弹幕招式**，由 phases 编成阶段招式池（见 17.4 / 17.6）：
   *   phases[].hp    = 该阶段开始的**血量比例**（1.0 = 满血即进入，0.5 = 半血进入下一阶段）
   *   phases[].skills = 该阶段轮转发射的弹幕技能 ID（技能表 AT21x）
   * 阶段推进 = **加机制**（换招式池），不是单纯加血加攻；转换时 Boss 无敌停手 CFG.boss.phaseInvuln 秒。 */
  BS0001: { name: "触手邪神", type: "boss", sprite: "enemy22",
    skillList: ["AT207", "AT211", "AT212", "AT217", "AT220"],
    phases: [
      { hp: 1.0, skills: ["AT211", "AT212"] },        // 放射炮台：触手放射 / 触手追瞄
      { hp: 0.5, skills: ["AT217", "AT220"] },        // 变奏：邪神花形 / 触手狂潮
    ], patternCd: 3.2,
    hp: 600, atk: 15, def: 3, spd: 72, radius: 46, exp: 60, coin: 80 },
  BS0002: { name: "腐化树母", type: "boss", sprite: "enemy22",
    skillList: ["AT208", "AT213", "AT214", "AT219"],
    phases: [
      { hp: 1.0, skills: ["AT213", "AT214"] },        // 扇形压制：藤蔓扇射 / 根系翻涌
      { hp: 0.5, skills: ["AT219", "AT213"] },        // 变奏：藤蔓绞杀（双螺旋）
    ], patternCd: 3.4,
    hp: 950, atk: 18, def: 4, spd: 64, radius: 54, exp: 90, coin: 130 },
  BS0003: { name: "深渊吞噬者", type: "boss", sprite: "enemy22",
    skillList: ["AT209", "AT215", "AT218", "AT216"],
    phases: [
      { hp: 1.0, skills: ["AT215", "AT218"] },        // 冲锋践踏：落地冲击环 / 深渊波幕
      { hp: 0.5, skills: ["AT216", "AT218"] },        // 变奏：深渊漩涡（三臂螺旋）
    ], patternCd: 3.0,
    hp: 1400, atk: 22, def: 5, spd: 80, radius: 60, exp: 130, coin: 200 },
};

/* ---------- 召唤物 / 陷阱上限（英雄属性：限制「该类型技能」的上限） ----------
 * 数值口径（已定）：
 *   召唤物上限   —— 限制 type:"summon" 技能（无人机等）**同时存在的数量**；
 *   陷阱数量上限 —— 限制 type:"trap" 技能（大地雷等）**同时存在的数量**。
 * 实际上限 = min(技能锚点数量, 英雄该属性)——技能等级只决定「想召几架」，英雄属性决定「最多几架」。
 * 该属性走**完整属性管线**（英雄基础值 + 武器栏装备 + 局内增益），与能量上限同源（见 16.5），
 * 因此后续加「+召唤物上限」的词条/卡牌/增益零代码生效（表里加字段即可）。 */
CFG.unitLimit = {
  summonMax: 2,     // 召唤物上限缺省值（英雄行未填时取此值）
  trapMax: 1,       // 陷阱数量上限缺省值
};

/* ---------- Boss 弹幕护栏（第十七章 17.3「先定死再填表」） ----------
 * 弹幕发射前统一查预算：① 每只 Boss 的**每秒发射量**（滑动窗口）；② **同屏存量**上限。
 * 超出时按剩余额度**裁剪本次发射**（降密度），而不是让整招落空——保证"看得懂但打不死人"。
 * 颜色语言（17.3）：红=范围爆炸 ｜ 橙=冲锋/践踏 ｜ 青=激光 ｜ 紫=召唤 ｜ 白=弹幕电报。 */
CFG.boss = {
  bulletBudget: 40,      // 每只 Boss 每秒发射上限（弹道性能红线 100/秒，Boss 占 40）
  bulletWindow: 1.0,     // 预算滑动窗口长度（秒）
  bulletCap: 260,        // Boss 弹幕同屏存量上限（超出时新招式降密度）
  bulletLife: 6.0,       // 弹幕存活上限（秒）：慢弹幕需要足够滞空时间（1920 地图 ≈ 6 秒穿场）
  patternCd: 3.2,        // 招式间隔缺省值（技能条目 cd 未填时取此值）
  warnTime: 0.8,         // 电报时长缺省值（0 = 无电报，用于螺旋这类持续型）
  warnRadius: 150,       // 电报圈/扇面尺寸缺省值
  phaseInvuln: 1.2,      // 阶段转换：Boss **无敌 + 停手**时长（不清屏，见 17.3）
  color: { boom: "#e5484d", charge: "#ff9f43", laser: "#4dd6e5", summon: "#c79bff", bullet: "#ffffff" },
};

/* ---------- 英雄配置表（8.5 表 1，首发 6 角） ---------- */
CFG.heroes = [
  { id: "H001", name: "猎手", desc: "远程速射 / 能量爆发 · 均衡型", sprite: "hero",
    hp: 100, def: 2, atk: 14, energyMax: 100, energyRegen: 10,
    spd: 300, radius: 18, weapon: "W001", summonMax: 2, trapMax: 1 },
  { id: "H002", name: "散弹手", desc: "三向散射 / 震荡波 · 近战压制型", sprite: "hero",
    hp: 110, def: 3, atk: 8, energyMax: 100, energyRegen: 10,
    spd: 290, radius: 18, weapon: "W002", summonMax: 2, trapMax: 1 },
  { id: "H003", name: "穿甲者", desc: "高穿透直线弹 / 贯穿射线 · 阵地输出型", sprite: "hero",
    hp: 90, def: 1, atk: 16, energyMax: 100, energyRegen: 10,
    spd: 295, radius: 18, weapon: "W003", summonMax: 2, trapMax: 1 },
  { id: "H004", name: "弹射手", desc: "弹射跳弹 / 环形弹幕 · 走位牵制型", sprite: "hero",
    hp: 95, def: 2, atk: 11, energyMax: 110, energyRegen: 11,
    spd: 305, radius: 18, weapon: "W004", summonMax: 2, trapMax: 1 },
  { id: "H005", name: "快枪手", desc: "极限射速 / 疾跑翻滚 · 高机动型", sprite: "hero",
    hp: 85, def: 1, atk: 7, energyMax: 100, energyRegen: 12,
    spd: 330, radius: 17, weapon: "W005", summonMax: 2, trapMax: 1 },
  { id: "H006", name: "重炮手", desc: "低速重弹 / 巨型爆破 · 火力覆盖型", sprite: "hero",
    hp: 120, def: 4, atk: 26, energyMax: 120, energyRegen: 8,
    spd: 265, radius: 19, weapon: "W006", summonMax: 1, trapMax: 1 },
  // 原型验证角（批次 E）：召唤/陷阱技能原型载体，后续按设计再作解锁门槛
  { id: "H007", name: "召唤师", desc: "无人机协战 / 机炮 · 召唤物原型角", sprite: "hero",
    hp: 90, def: 1, atk: 12, energyMax: 120, energyRegen: 12,
    spd: 300, radius: 18, weapon: "W007", summonMax: 6, trapMax: 1 },
  { id: "H008", name: "陷阱师", desc: "大地雷封锁 / 掷雷 · 陷阱原型角", sprite: "hero",
    hp: 95, def: 2, atk: 15, energyMax: 110, energyRegen: 10,
    spd: 295, radius: 18, weapon: "W008", summonMax: 2, trapMax: 3 },
];

/* ---------- 武器配置表（8.5 表 3） ---------- */
CFG.weapons = {
  W001: { id: "W001", name: "速射炮", desc: "专属绑定武器，不可更换",
    // 暴露的技能标签：武器模块词缀只有匹配到标签才生效（16.5）
    // 术语（16.5）：技能石 = **主动技能**（绑定在本表武器上）、辅助石 = **武器模块**（CFG.moduleDefs，代码 module）
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

/* ---------- 技能表（8.5 表 4：**单表 + cat 分类**，不物理拆表） ----------
 * cat 取值（决定它属于文档里哪张视图表）：
 *   active  主动技能（含普攻）→ 表 4a 视图
 *   passive 被动技能           → 表 4b 视图
 *   buff    增益状态技能       → 表 4c 视图
 *   debuff  减益状态技能       → 表 4d 视图
 * 策划导出时按 cat 过滤即得 4 张视图表；物理上共用一张注册表，加技能零代码。
 *
 * 等级效果填写方式（1~100 级，最多填 5 行，不填 100 行）：
 *   ① 公式驱动（连续值：伤害/CD/弹速/范围/生命）
 *      平铺字段 = LV1 基础值，按 CFG.weaponLevel 线性成长（普攻 +4%/级、技能 +6%/级）；
 *      单个技能可用 growth 覆盖，如 growth:{ dmgMul: 0.08 }。
 *   ② 锚点插值（整数离散值：弹道数/召唤数/穿透/弹射数）
 *      用 anchors 只填 3~5 行关键等级锚点，程序在区间内线性插值后取整。
 *      取整规则：锚点值**全为整数 → 向下取整**；**含小数 → 保留两位小数**。
 *      示例：弹道数量 { 1:1, 25:2, 60:3, 100:4 } → LV40 插值 2.43 → 2 发；LV60 命中锚点 → 3 发。
 *   ③ 分段公式（非线性）：按等级区间给不同成长率（在 growth 基础上扩展，数值待策划填）。
 * 统一结算入口：skillEntry(skillId, lv)（js/game.js）。
 *
 * type（主动技能的释放形态）：bullet 弹道 ｜ summon 召唤物（可被敌人攻击）｜ trap 陷阱（触发后延迟爆炸）
 * kind：basic 普攻（不吃主动技能能量/手动触发）｜ skill 主动技能 */
CFG.skillCat = { active: "主动", passive: "被动", buff: "增益", debuff: "减益" };

CFG.skills = {
  /* ===== 表 4a 视图：主动技能（含普攻） ===== */
  AT101: { name: "速射", cat: "active", kind: "basic", type: "bullet",
    cd: 0.75, energy: 0, dmgMul: 1.0, bullets: 1, bulletSpd: 620, pierce: 0, bounce: 0 },
  AT102: { name: "能量爆发", cat: "active", kind: "skill", type: "bullet",
    cd: 3.0, energy: 100, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 2.5, radius: 130 },   // 朝目标发射能量弹，命中后圆形范围爆炸
  AT103: { name: "三向散射", cat: "active", kind: "basic", type: "bullet",
    cd: 1.0, energy: 0, dmgMul: 0.85, bullets: 3, bulletSpd: 520, pierce: 0, bounce: 0 },
  AT104: { name: "震荡波", cat: "active", kind: "skill", type: "bullet",
    cd: 3.2, energy: 100, tags: ["伤害","冷却","范围"], dmgMul: 2.0, radius: 150 },
  AT105: { name: "磁轨弹", cat: "active", kind: "basic", type: "bullet",
    cd: 0.95, energy: 0, dmgMul: 1.1, bullets: 1, bulletSpd: 760, pierce: 2, bounce: 0 },
  AT106: { name: "贯穿射线", cat: "active", kind: "skill", type: "bullet",
    cd: 3.0, energy: 100, tags: ["伤害","冷却","穿透","弹速"], dmgMul: 2.6, radius: 120 },
  AT107: { name: "跳弹", cat: "active", kind: "basic", type: "bullet",
    cd: 0.85, energy: 0, dmgMul: 1.0, bullets: 1, bulletSpd: 560, pierce: 0, bounce: 2 },
  AT108: { name: "环形弹幕", cat: "active", kind: "skill", type: "bullet",
    cd: 3.2, energy: 110, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 1.8, radius: 160, bullets: 8 },
  AT109: { name: "双生速射", cat: "active", kind: "basic", type: "bullet",
    cd: 0.42, energy: 0, dmgMul: 0.62, bullets: 1, bulletSpd: 640, pierce: 0, bounce: 0 },
  AT110: { name: "疾风连爆", cat: "active", kind: "skill", type: "bullet",
    cd: 2.4, energy: 100, tags: ["伤害","冷却","弹道数量"], dmgMul: 1.9, radius: 120, bullets: 3 },
  AT111: { name: "重锤弹", cat: "active", kind: "basic", type: "bullet",
    cd: 1.25, energy: 0, dmgMul: 1.6, bullets: 1, bulletSpd: 430, pierce: 1, bounce: 0 },
  AT112: { name: "攻城爆破", cat: "active", kind: "skill", type: "bullet",
    cd: 3.5, energy: 120, tags: ["伤害","冷却","范围","弹速"], dmgMul: 3.2, radius: 190 },

  /* ===== 召唤物 / 陷阱类技能（离散值走 anchors 锚点表，1~100 级全程有效） ===== */
  AT113: { name: "召唤无人机", cat: "active", type: "summon", kind: "skill", cd: 12.0, energy: 110,
    tags: ["召唤物", "伤害", "冷却"],
    desc: "召唤/补充无人机协战（自动攻击、可被敌人击毁，再次施放补满）",
    anchors: {
      count:  { 1: 3, 25: 4, 60: 5, 100: 6 },          // 无人机数量（整数 → 向下取整）
      hp:     { 1: 40, 50: 120, 100: 260 },            // 每架生命
      atk:    { 1: 6, 50: 20, 100: 48 },               // 每架攻击力
      fireCd: { 1: 0.8, 50: 0.65, 100: 0.5 },          // 攻击间隔（含小数 → 保留两位）
      orbit:  { 1: 66, 50: 74, 100: 90 },              // 环绕半径
    } },
  AT114: { name: "大地雷", cat: "active", type: "trap", kind: "skill", cd: 9.0, energy: 90,
    tags: ["陷阱", "伤害", "范围", "冷却"], armDelay: 0.5,   // 敌人入圈后引信延迟（固定规则值）
    desc: "在脚下布设地雷：敌人进入范围 0.5 秒后引爆（范围伤害），随后消失",
    anchors: {
      count:  { 1: 1, 25: 2, 60: 2, 100: 3 },          // 同时存在地雷数
      dmgMul: { 1: 2.6, 50: 4.0, 100: 5.5 },           // 爆炸伤害（×攻击）
      radius: { 1: 110, 50: 135, 100: 180 },           // 触发/伤害半径
    } },

  /* ===== 召唤/陷阱武器的普攻（W007/W008 专属） ===== */
  AT115: { name: "机炮", cat: "active", kind: "basic", type: "bullet",
    cd: 0.8, energy: 0, dmgMul: 0.9, bullets: 1, bulletSpd: 560, pierce: 0, bounce: 0 },
  AT116: { name: "掷雷", cat: "active", kind: "basic", type: "bullet",
    cd: 1.1, energy: 0, dmgMul: 1.2, bullets: 1, bulletSpd: 480, pierce: 0, bounce: 0 },

  /* ===== 表 4e 视图：敌人技能（8.2：怪物攻击行为也是技能条目） =====
   * 攻击参数（伤害间隔/弹速/保持距离/冲锋/爆炸/召唤）由本表提供，怪物表不再重复硬编码；
   * ai 标注它服务于哪种 AI 行为，与怪物自身 type 保持一致（便于校验）；
   * dmgMul = 攻击伤害倍率（× 怪物 atk）。同一套参数可被多个怪物通过 skillList 复用。 */
  AT201: { name: "重甲撞击", cat: "active", ai: "melee", tags: [], cd: 0.8, dmgMul: 1.0 },
  AT202: { name: "游击射击", cat: "active", ai: "ranged", tags: ["弹速"],
    cd: 2.6, bulletSpd: 300, keepDist: 280, dmgMul: 1.0 },
  AT203: { name: "冲撞突袭", cat: "active", ai: "charger", tags: [],
    cd: 3.0, chargeRange: 320, telegraph: 0.6, dashSpd: 560, dashTime: 0.45, dmgMul: 1.0 },
  AT204: { name: "深渊狙击", cat: "active", ai: "ranged", tags: ["弹速"],
    cd: 3.2, bulletSpd: 420, keepDist: 340, dmgMul: 1.0 },
  AT205: { name: "蚀魂狙击", cat: "active", ai: "ranged", tags: ["弹速"],
    cd: 2.6, bulletSpd: 300, keepDist: 300, dmgMul: 1.0 },
  AT206: { name: "裂颅撕咬", cat: "active", ai: "melee", tags: [], cd: 0.7, dmgMul: 1.0 },
  AT207: { name: "触手范围爆炸", cat: "active", ai: "boss", tags: ["伤害","范围"],
    cd: 5.0, warnTime: 1.5, radius: 230, dmgMul: 2.4, touchMul: 0.6, touchCd: 1.0,
    minionId: "NM0010", minionWave: 2, minionCd: 8.0 },
  AT208: { name: "腐化范围爆炸", cat: "active", ai: "boss", tags: ["伤害","范围"],
    cd: 4.2, warnTime: 1.5, radius: 260, dmgMul: 2.4, touchMul: 0.6, touchCd: 1.0,
    minionId: "NM0010", minionWave: 3, minionCd: 7.0 },
  AT209: { name: "深渊范围爆炸", cat: "active", ai: "boss", tags: ["伤害","范围"],
    cd: 3.6, warnTime: 1.4, radius: 290, dmgMul: 2.6, touchMul: 0.6, touchCd: 1.0,
    minionId: "NM0010", minionWave: 3, minionCd: 6.0 },

  /* ===== 表 4e-2：Boss 弹幕招式（第十七章 17.4 六种原型库） =====
   * 与 AT207~209（基础行为：圆形 AOE + 召唤）不同，本组条目走**弹幕发射器**，
   * 由 `PatternSystem` 展开成弹道（见 js/game.js）。**通用字段沿用技能表口径**：
   *   cd        = 招式间隔（秒）；0.3 左右 = 持续型（螺旋），3~4.5 = 单发大招
   *   warnTime  = 电报时长（秒）；**0 = 无电报**（持续型招式不逐发提示，避免糊屏）
   *   warnRadius= 电报圈 / 扇面尺寸（px，纯视觉提示，不参与伤害判定）
   *   dmgMul    = 单发伤害倍率（× 怪物 atk）；Boss 弹幕走**低伤害高密度**，压力来自"躲"不是"扛"
   *   bulletSpd = 弹速（px/s）。**刻意压低（150~300）**：Boss 弹幕是"读得懂的墙"，不是"看不清的雨"
   *   life      = 滞空上限（秒），缺省取 CFG.boss.bulletLife
   * **发射器专属字段**：
   *   pattern  = radial 放射 ｜ spiral 螺旋 ｜ fan 扇形 ｜ wave 波幕 ｜ ring 同心环 ｜ grid 网格/花形
   *   count    = 每层/每臂弹数 ｜ arc = 扇形张角（弧度）｜ arms = 螺旋臂数 ｜ spin = 每次发射的旋转量（弧度）
   *   layers   = 层数（ring / grid）｜ gap = 层间距（px，grid）｜ lateral = 法向间距（px，wave）
   *   layerMul = 层间速度倍率增量（ring：第 k 层速度 ×(1+k×layerMul)）
   *   offset   = 起始角（弧度，radial / ring / grid 的整体旋转）
   * ⚠️ 数值必须服从 CFG.boss 护栏：单只 Boss 每秒发射量 ≤ bulletBudget，同屏 ≤ bulletCap。 */
  AT211: { name: "触手放射", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "radial", count: 10, offset: 0, bulletSpd: 190, dmgMul: 0.7,
    cd: 3.2, warnTime: 0.9, warnRadius: 170, life: 6.5 },
  AT212: { name: "触手追瞄", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "fan", count: 3, arc: 0.16, bulletSpd: 300, dmgMul: 0.5,
    cd: 1.7, warnTime: 0.35, warnRadius: 220, life: 6.0 },
  AT213: { name: "藤蔓扇射", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "fan", count: 7, arc: 1.15, bulletSpd: 210, dmgMul: 0.65,
    cd: 3.4, warnTime: 0.85, warnRadius: 240, life: 6.0 },
  AT214: { name: "根系翻涌", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "ring", count: 7, layers: 2, layerMul: 0.18, offset: 0, bulletSpd: 175, dmgMul: 0.6,
    cd: 4.0, warnTime: 1.0, warnRadius: 190, life: 6.5 },
  AT215: { name: "落地冲击环", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "radial", count: 14, offset: 0, bulletSpd: 150, dmgMul: 0.75,
    cd: 4.2, warnTime: 1.1, warnRadius: 210, life: 7.0 },
  AT216: { name: "深渊漩涡", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "spiral", arms: 3, spin: 0.42, bulletSpd: 170, dmgMul: 0.45,
    cd: 0.30, warnTime: 0, warnRadius: 0, life: 5.0 },
  AT217: { name: "邪神花形", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "grid", count: 7, layers: 3, gap: 95, offset: 0, bulletSpd: 165, dmgMul: 0.55,
    cd: 4.5, warnTime: 1.0, warnRadius: 300, life: 7.0 },
  AT218: { name: "深渊波幕", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "wave", count: 9, lateral: 26, bulletSpd: 200, dmgMul: 0.6,
    cd: 2.6, warnTime: 0.7, warnRadius: 260, life: 6.0 },
  AT219: { name: "藤蔓绞杀", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "spiral", arms: 2, spin: -0.5, bulletSpd: 185, dmgMul: 0.5,
    cd: 0.34, warnTime: 0, warnRadius: 0, life: 5.5 },
  AT220: { name: "触手狂潮", cat: "active", ai: "boss", tags: ["伤害"],
    pattern: "ring", count: 9, layers: 3, layerMul: 0.14, offset: 0, bulletSpd: 160, dmgMul: 0.6,
    cd: 4.0, warnTime: 1.0, warnRadius: 230, life: 7.0 },

  /* ===== 表 4c 视图：增益状态技能（Buff）——战争雕像增益池也走此表 =====
   * stat/mul 对应 13.7 属性修改器；pool 用于筛选具体增益池（如 "war" = 战争雕像）。
   * CFG.warBuffs 是由本表派生的过滤视图，加新增益只需在此加一行。
   *
   * **Buff 也分等级（4.4）**：重复触发同类 Buff **叠的是等级**（不是叠加多份效果）——
   * 效果值 = `anchors.mul` 按等级插值（沿用技能表的等级曲线体系，见 8.5 表 4）。
   * stackable=false 的 Buff 重复触发**只刷新持续时间、不升级**；等级上限取 maxLv（默认 CFG.buffLevel.maxLv）。 */
  BF001: { name: "狂力", cat: "buff", pool: "war", tags: ["攻击"], duration: 20,
    stat: "atk", mul: 1.30, label: "攻击力 +30%", stackable: true,
    anchors: { mul: { 1: 1.30, 10: 1.55, 30: 1.95, 99: 3.00 } } },
  BF002: { name: "迅击", cat: "buff", pool: "war", tags: ["冷却"], duration: 20,
    stat: "cdMul", mul: 0.70, label: "攻速 +30%", stackable: true,
    anchors: { mul: { 1: 0.70, 10: 0.62, 30: 0.50, 99: 0.34 } } },   // cdMul 越小越快：用锚点保证有下限
  BF003: { name: "疾风", cat: "buff", pool: "war", tags: ["移速"], duration: 20,
    stat: "spd", mul: 1.30, label: "移速 +30%", stackable: true,
    anchors: { mul: { 1: 1.30, 10: 1.50, 30: 1.85, 99: 2.60 } } },
  BF004: { name: "汲血", cat: "buff", pool: "war", tags: ["吸血"], duration: 20,
    stat: "lifesteal", mul: 0.15, label: "吸血 15%", stackable: true,
    anchors: { mul: { 1: 0.15, 10: 0.22, 30: 0.35, 99: 0.60 } } },

  /* ===== 表 4d 视图：减益状态技能（Debuff）——对敌方施加的负面状态 =====
   * target:"monster" 表示作用于敌方全体；mods 为属性修改器（对应 8.2「可被添加技能：是」）。
   * CFG.curseItems.list 是由本表派生的过滤视图。 */
  DB001: { name: "铁壁诅咒", cat: "debuff", target: "monster", tags: ["防御","生命"], duration: 45,
    desc: "敌人防御 ×3、生命 ×1.5", rewardMul: 2,
    mods: { defMul: 3, hpMul: 1.5, atkMul: 1, spdMul: 1 } },
  DB002: { name: "狂暴诅咒", cat: "debuff", target: "monster", tags: ["攻击","移速"], duration: 45,
    desc: "敌人攻击 ×1.6、移速 ×1.25", rewardMul: 2.5,
    mods: { defMul: 1, hpMul: 1.2, atkMul: 1.6, spdMul: 1.25 } },
  DB003: { name: "巨影诅咒", cat: "debuff", target: "monster", tags: ["生命"], duration: 45,
    desc: "敌人生命 ×2.5", rewardMul: 2,
    mods: { defMul: 1, hpMul: 2.5, atkMul: 1, spdMul: 1 } },

  /* ===== 表 4b 视图：被动技能（cat:"passive"） =====
   * 结构已就绪（skillEntry 同样支持公式成长 + anchors），来源待定（配件 / 附魔 / 精英词缀），
   * 故当前**不预置空条目**，避免死数据；接入时在此加行即可。 */
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
  ALTAR_004a: { name: "邪神雕像·小怪数量", color: "#9a5cf5", icon: "☠", radius: 117, channel: 2.5, weight: 5,
    effects: [{ type: "adjustMonsters", target: "小怪数量", range: [-100, 100], duration: 30 }] },
  ALTAR_004b: { name: "邪神雕像·小怪属性", color: "#8e6cf0", icon: "☣", radius: 117, channel: 2.5, weight: 5,
    effects: [{ type: "adjustMonsters", target: "小怪属性", range: [-100, 100], duration: 30 }] },
  ALTAR_004c: { name: "邪神雕像·精英数量", color: "#a86cf0", icon: "❖", radius: 117, channel: 2.5, weight: 5,
    effects: [{ type: "adjustMonsters", target: "精英数量", range: [-100, 100], duration: 30 }] },
  ALTAR_004d: { name: "邪神雕像·精英属性", color: "#b06cf0", icon: "✷", radius: 117, channel: 2.5, weight: 5,
    effects: [{ type: "adjustMonsters", target: "精英属性", range: [-100, 100], duration: 30 }] },
  ALTAR_004e: { name: "邪神雕像·BOSS属性", color: "#c06cf5", icon: "☢", radius: 117, channel: 2.5, weight: 5,
    effects: [{ type: "adjustMonsters", target: "BOSS属性", range: [-100, 100], duration: 30 }] },
  ALTAR_005: { name: "工匠雕像", color: "#6cb2ff", icon: "⚒", radius: 117, channel: 2.5, weight: 0,
    effects: [{ type: "teleport", submap: "artisan" }] },   // 非随机刷出，由击杀进度触发
  RIFT: { name: "空间裂缝", color: "#5ad0ff", icon: "◈", radius: 117, channel: 2.0, weight: 3,
    effects: [{ type: "rift" }] },                          // 空间裂缝入口：读条进入战斗子地图
};

/* ---------- 空间裂缝系统（5.1 / 13.10） ----------
 * 子地图为「一次性投放」战斗场景，不再是持续刷怪：
 *   ① 进入后开场冻结 freezeTime 秒（全员静止 + 全员无敌，红字 3/2/1 倒计时）；
 *   ② 冻结结束瞬间把任务所需的全部敌人一次性投放完毕（spawnCount）+ 独立精英（eliteBase × 倍率）；
 *   ③ 之后不再增援（任务完成 / 失败均不再新增）；场上剩余敌人留场，玩家可继续清剿或直接返回。
 * 数值约束：spawnCount ≥ max(任务 goal, rewardKills)，保证任务箱与基础奖励箱都拿得到。 */
CFG.rift = {
  channel: 5.0,           // 返回信标读条 5 秒；仅受击归零（移动不打断，用户已改规则）
  worldSize: 1920,        // 子地图尺寸（与关卡地图统一）
  freezeTime: 3.0,        // 开场冻结（秒）：全员静止 + 全员无敌，红字倒计时 3/2/1
  defaultSpawnCount: 16,  // 兜底投放数：未带任务直接构造子地图时使用（如单元测试）；须 ≥ rewardKills
  spawnPool: "NM0010:50/NM0011:30/NM0012:20",   // 一次性投放的怪物池（子地图不按解锁进度过滤，全量开放）
  eliteBase: 3,           // 裂缝子地图独立精英基础数量（随敌群一次性投放，不再随时间补投）
  elitePool: "ED0001:50/ED0002:30/ED0003:20",   // 裂缝精英怪池（编号:权重）
  rewardKills: 12,        // 击杀达标 → 刷出基础奖励宝箱雕像（须 ≤ 各任务 spawnCount）
  chestWeights: { normal: 0, advanced: 20, epic: 45, divine: 25, mythic: 10 },   // 奖励宝箱品质权重
  /* 任务变体（待细化 20：§五 任务型子地图）——进入时按权重随机一个；
   * 任务不强制（返回信标照常可用），完成 → 额外刷出高价值"任务奖励宝箱"；限时超时 → 失败。
   * spawnCount = 本次一次性投放的敌人总数（必须 ≥ goal，留出余量给基础奖励箱）。 */
  tasks: [
    { id: "hunt",  name: "深入猎杀", weight: 2, goal: 20, spawnCount: 22, desc: "击杀 20 只裂缝怪物" },
    { id: "purge", name: "歼灭作战", weight: 2, goal: 18, spawnCount: 20, time: 75, desc: "75 秒内击杀 18 只" },
    { id: "raid",  name: "闪电突袭", weight: 1, goal: 10, spawnCount: 14, time: 40, desc: "40 秒内击杀 10 只" },
  ],
  taskBonusWeights: { normal: 0, advanced: 0, epic: 30, divine: 45, mythic: 25 },   // 任务奖励宝箱品质权重
};

/* ---------- 撤离点雕像（5.2：按文档定稿） ----------
 * 游戏中没有撤离代币；撤离点 = 雕像。唯一来源：最终 Boss 死亡位置，一张地图上限 1 座
 * （"场景掉落撤离信标"整条设计已删除：撤离点只由 Boss 击败产生）。
 * 判定圈规则（本轮已更新，与祭坛/信标/NPC 统一，见 judgeChannel）：
 *   **任一存活英雄在圈内即自动读条 8 秒**（队长或任一 AI 队友都算，不再需要按 E）；
 *   圈内英雄全部离开 → 进度缓慢衰退；受击仍立即归零；判定是单一实例（同时只有一个持有者）；
 *   雕像始终留在原地，可反复重读；死亡时撤离点雕像消散。 */
CFG.extract = { channel: 8.0, radius: 100, note: "死亡时撤离点雕像消散" };

/* ---------- 保险契约（方案 A：背包道具） ----------
 * 开箱概率掉出；占 1 格、有重量、可叠加；死亡时每份契约保护 1 件价值最高的物品；
 * 撤离成功时剩余契约折算为进化结晶；契约本身不参与死亡损失。 */
/* 保险契约：背包消耗品，固定价值 60（撤离时走统一折算率 → 30 结晶，不再有独立 crystalRefund） */
CFG.insurance = { name: "保险契约", chance: 0.15, weight: 5, value: 60, maxStack: 9 };

/* ---------- 武器等级 / 技能等级（技能等级 = 武器等级，同一条线；局外永久资产） ----------
 * 上限 **100 级**；曲线**公式驱动**（不再手写等级表，改参数即调全曲线）。
 * 升级入口 = 主菜单「局外成长」；cost 为升级所需进化结晶（局外货币）。
 * 唯一成本来源 = Meta.weaponUpCost（勿再引入第二套成本；局内金币不用于升级）。
 * 技能的具体效果数值由后续「技能配置表」承担（参考来源：《Path of Exile（流放之路）》
 * 技能石 + 辅助石体系 —— 技能可自由组合，等级/品质决定强度；本项目里 技能石 = 主动技能、辅助石 = 武器模块）。 */
CFG.weaponLevel = {
  maxLv: 100,             // 等级上限：100
  basicMulPerLv: 0.04,    // 普攻伤害：每级 +4%（线性）
  skillMulPerLv: 0.06,    // 技能效果：每级 +6%（线性）
  costBase: 120,          // 1→2 级消耗（进化结晶）
  costGrowth: 1.05,       // 每级成本 ×1.05（几何增长）
  costRound: 10,          // 成本取整到 10
};

/* ---------- 精英怪词缀系统（独立精英 ED + 可选词缀转化） ----------
 * 独立精英（ED）由关卡层定点投放（CFG.eliteSpawn），携带 1~2 条随机词缀；
 * 体型放大 + 光环标识；必掉宝箱 + 额外经验。护盾词缀：额外护盾值，先扣盾后扣血。
 * 原"普通怪按概率转化词缀精英"改为配置开关 convertChance（主地图默认 0 = 已由 ED 投放替代，
 * 代码路径保留供策划日后开启；裂缝概率见 riftChance）。 */
CFG.elites = {
  convertChance: 0,       // 主地图普通怪转化率总开关（默认 0 = 关闭，已由 ED 定点投放替代）
  chanceProgress: 0.06,   // 随击杀进度追加的转化率（仅 convertChance>0 时生效，进度满合计约 11%）
  riftChance: 0,          // 裂缝子地图概率（默认 0 = 关闭：子地图已改为独立 ED 随敌群一次性投放，
                          //   避免"22 只 × 20% ≈ 4 只随机词缀精英 + 3 只 ED"导致精英过载；改回 0.20 可恢复）
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

/* ---------- 邪神雕像倍率作用点配置（4.5 / 16.9，配置表驱动，策划可后续丰富） ----------
 * 语义（详见 World 中倍率生效点）：
 *   key               → 运行时倍率表 r.scale 中的条目名
 *   小怪数量：applyWaveSize 每波数量×mul（向上取整、最小 1）；applyInterval 刷新间隔÷mul；applyCap 全场怪物上限×mul（默认关，性能风险）
 *   小怪属性：applyHp/applyAtk 新生成小怪 生命/攻击 ×mul
 *   精英数量：applySpawnTarget 精英投放目标数 ×mul
 *   精英属性：applyHp/applyAtk 新生成精英 生命/攻击 ×mul
 *   BOSS属性：applyHp/applyAtk BOSS 生成时 生命/攻击 ×mul（只套用一次）
 * range = 触发时随机取值区间（-100~+100）；duration 为默认时长（-1 = 永久，持续到本局结束）。 */
CFG.monsterScale = {
  range: [-100, 100],     // 默认随机幅度区间（祭坛行可覆盖）
  duration: 30,           // 默认持续时长（秒；-1 = 永久）
  targets: {
    "小怪数量": { key: "smallCount", applyWaveSize: true, applyInterval: true, applyCap: false },
    "小怪属性": { key: "smallStat",  applyHp: true, applyAtk: true },
    "精英数量": { key: "eliteCount", applySpawnTarget: true },
    "精英属性": { key: "eliteStat",  applyHp: true, applyAtk: true },
    "BOSS属性": { key: "bossStat",   applyHp: true, applyAtk: true },
  },
};

/* ---------- Buff 等级规则（4.4）----------
 * 重复触发**同类** Buff 时，叠加的是**该 Buff 的等级**（不是多份效果）：
 *   Lv1 → Lv2 → … 直到 maxLv；效果值按技能表条目的 `anchors.mul` 按等级插值。
 * 多次获得同一 Buff 也会**刷新持续时间**。stackable=false 的条目只刷新时间、不升级。 */
CFG.buffLevel = {
  maxLv: 99,             // 单条 Buff 的等级上限（条目可用 maxLv 覆盖）
  stackPerTrigger: 1,    // 每次重复触发提升的等级数
  stackable: true,       // 默认可叠等级；条目可用 stackable:false 关闭
};

/* ---------- 战争雕像增益池（4.4，各 20 秒） ----------
 * **派生视图**：从技能表按 cat==="buff" && pool==="war" 过滤得到（表 4c 视图），
 * 新增/调整增益只需改 CFG.skills 里的 BF00x 行。
 * 带出 stackable / maxLv / stackPerTrigger，供触发时的「叠等级」逻辑使用。 */
CFG.warBuffs = Object.keys(CFG.skills)
  .filter((id) => CFG.skills[id].cat === "buff" && CFG.skills[id].pool === "war")
  .map((id) => {
    const s = CFG.skills[id];
    return { skillId: id, id: s.name, stat: s.stat, mul: s.mul, label: s.label,
      stackable: s.stackable != null ? s.stackable : CFG.buffLevel.stackable,
      maxLv: s.maxLv || CFG.buffLevel.maxLv,
      stackPerTrigger: s.stackPerTrigger || CFG.buffLevel.stackPerTrigger };
  });

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

/* ---------- 武器模块定义（16.5：词缀匹配武器标签才生效） ----------
 * 外包装：**武器模块**（= 流放之路的「辅助石」，= 旧「装备模块 / 模组」，代码标识符仍为 module）；
 * 放进武器栏后，对小队**全体成员**的武器技能按标签生效。 */
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

/* ---------- 武器模块等级系统（叠加升级：相同武器模块合并 → 等级+1） ----------
 * 9 个等级、3 个阶段（每阶段 3 级）；阶段词缀为"强化技能效果"的附加词缀，
 * 仅对主动技能生效（按技能自身 tags 匹配，见 recomputeWeapon / tagCalc）。 */
CFG.moduleLevel = {
  maxLv: 9,
  perStage: 3,            // 每阶段级数：LV1~3 阶段1 / LV4~6 阶段2 / LV7~9 阶段3
  valueStep: 0.15,        // 主词缀数值随等级成长：有效值 = 基础值 × (1 + (lv-1) × valueStep)
  linkBonus: 0.03,        // 连接效果：武器栏中相邻（边接触）同品质武器模块，每对 +3% 技能伤害
  // 阶段词缀（通用池，按阶段解锁：阶段 n 解锁前 n 条；策划可整体替换）
  stageAffixes: [
    { name: "强化·技能伤害", tag: "伤害", mode: "mult", value: 0.06 },
    { name: "强化·技能冷却", tag: "冷却", mode: "mult", value: -0.05 },
    { name: "强化·技能范围", tag: "范围", mode: "mult", value: 0.06 },
  ],
};

/* ---------- 武器模块套装（16.7 武器模块深度：同系列集齐 N 件触发词缀强化，仅武器栏内计数） ---------- */
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
  refreshPerRun: 2,                    // 每局免费刷新次数（待细化 #37 已定：免费 2 次用完 → 花金币刷新）
  refreshCost: 120,                    // 免费次数用完后的金币刷新价格（局内金币，规则 2 三用途之一）
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

/* ---------- 局内→局外资源转化（待细化 5 已定：撤离成功结算） ----------
 * 双层等级体系闭环：局内资产**不作为物品带出**（16.6），撤离时把**背包 / 武器栏内所有物品**
 * 按其**固定价值**统一折算为进化结晶 —— 不再按类别用不同比例（旧的"宝箱 ×0.5 / 装备武器模块 ×0.25 /
 * 卡牌固定 2"三套口径已作废）。
 * 统一口径：结晶 = Σ(物品固定价值) × valueRate（`valueRate 0.5` 即「2 价值 = 1 结晶」）。
 * 物品固定价值来源：宝箱 = CFG.chestQualities[].value；装备 = 30×品质系数；武器模块 = 45×品质系数；
 * 消耗品（保险契约 / 诅咒道具）= 各自 CFG 里的 value；属性卡牌资产 = cardValue（走同一折算率）。
 * 未开封宝箱同样不带出本体，但价值照常折算（它就在背包里，占 1 格）。
 * **局内经验与金币一律归零、不参与折算**（死亡时同样不折算，见 6.5）。 */
CFG.settleConvert = {
  valueRate: 0.5,         // 统一折算率：物品固定价值 × 本率 = 结晶（全类别一致，2 价值 = 1 结晶）
  cardValue: 4,           // 每张属性卡牌资产的固定价值（同样走 valueRate → 2 结晶/张）
};

/* ---------- 工匠雕像投放：雕像池 + 限制器 + 多触发条件（4.6） ----------
 * 设计模型：**触发条件把「配额」投入池中**，**限制器**决定配额何时、最多以什么频率
 * 变成地图上一座真实雕像。子世界（工匠世界）**可无限次进入**——雕像使用后即消失，
 * 但池会按触发条件继续投放新的雕像，所以"无限次"由池的持续产出保证，而非次数豁免。
 * 多条触发条件同时存在，任一满足即 +quota（互不排斥）。 */
CFG.artisan = {
  limiter: {
    maxOnField: 1,          // 场上同时最多 1 座（避免囤积多座连续进）
    cooldown: 20,           // 使用雕像后冷却（秒）：期间不再投放，保证战斗节奏
    maxPerLevel: 6,         // 每关投放上限（配额再高也不超过；上限后本关不再产出）
    spawnDelay: [3, 8],     // 配额就绪后到落地之间的随机延迟（秒），让出现显得"随机"
    minDistFromPlayer: 300, // 投放点离玩家最小距离（避免贴脸弹出）
  },
  /* 触发条件（配额来源）——type 决定判定方式，按需扩展 */
  triggers: [
    { id: "first",    name: "首次里程碑", type: "levelKills",   quota: 1, desc: "击杀数达到关卡 artisanAtKills" },
    { id: "progress", name: "进度里程碑", type: "progressStep", quota: 1, max: 3, step: 0.25, desc: "击杀进度每 25% 触发一次（最多 3 次）" },
    { id: "boss",     name: "BOSS 击败",  type: "bossDefeated", quota: 1, desc: "BOSS 被击败后额外投一座（撤离前的最后改造机会）" },
    { id: "elite",    name: "精英猎杀",   type: "eliteKills",   quota: 1, perQuota: 2, max: 3, desc: "每击杀 2 只精英怪触发一次（最多 3 次）" },
    { id: "pity",     name: "保底计时",   type: "pity",         quota: 1, interval: 90, desc: "距上次雕像出现超过 90 秒则强制投放一座" },
  ],
};

/* ---------- 工匠世界金币服务（待细化 28：强化物品规则） ----------
 * 强化物品 = 消耗金币的物品强化/购买服务（4.6）；全部走本表，策划改价即调。 */
CFG.artisanServices = {
  qualityUp: { costs: [80, 160, 320], desc: "装备/武器模块品质提升一档（白→蓝→紫→金）" },   // 索引=当前品质档
  rerollModule: { cost: 120, desc: "重掷武器模块主词缀档位（保留等级与类型）" },
  buyInsurance: { cost: 150, desc: "购买 1 份保险契约" },
  buyChest: { advanced: 100, epic: 220, divine: 480 },   // 各档宝箱售价
  // 规则 2 新增：局内金币购买入口（战斗侧 shopBuyModule / shopBuyItem 消费本表）
  buyModule: { cost: 200, qualityWeights: { normal: 45, advanced: 35, epic: 15, divine: 5 },
    desc: "随机 1 件（品质按权重：白/蓝/紫/金）" },
  buyItem: { cost: 150, desc: "购买 1 件随机消耗品道具" },
};

/* ---------- 诅咒道具（待细化 36：给敌人附加技能的道具） ----------
 * 使用后向局内敌人动态附加属性修改器/被动技能（8.2"可被添加技能：是"）；
 * 风险回报：敌人被强化，期间金币与经验掉落 ×rewardMul。仅限主地图战斗中使用。
 * **list 为派生视图**：从技能表按 cat==="debuff" && target==="monster" 过滤（表 4d 视图）。 */
CFG.curseItems = {
  chance: 0.05,           // 开箱掉出概率（保险判定之后）
  weight: 2, value: 40,   // 占 1 格；重量 / 价值
  duration: 45,           // 默认持续（秒）
  list: Object.keys(CFG.skills)
    .filter((id) => CFG.skills[id].cat === "debuff" && CFG.skills[id].target === "monster")
    .map((id) => { const s = CFG.skills[id]; return { id, name: s.name, desc: s.desc, rewardMul: s.rewardMul, ...s.mods }; }),
};

/* ---------- 音效（WebAudio 合成，零素材；打击感参数） ---------- */
CFG.audio = {
  enabled: true,
  master: 0.45,          // 总音量 0~1
  shake: { hurt: 7, bossBoom: 11, dur: 0.32 },   // 屏幕震动：幅度(px) 与时长(s)
};
