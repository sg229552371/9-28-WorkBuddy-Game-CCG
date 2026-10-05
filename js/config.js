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
  /* ---------- 第 3→10 关铺量（B 线并行批）----------
   * 设计口径：难度沿关卡单调递增（monsterLevel / eliteBase / progressGoal / timeLimit / artisanAtKills），
   * Boss 每关一只，LEVEL_001~010 依次对应 BS0001~BS0010（见关卡铺量测试断言「10 关 Boss 无重复」）。
   * elitePool 权重随关卡变化：中后期 ED0002/ED0003（远程/高速）占比抬升，压制「贴脸莽」的容错。
   * theme 为暗色主题（与既有 #1a2418 / #201a2a 风格一致，逐关加深偏冷/偏暖）。
   * 机制：LEVEL_005 起部分关卡开启毒圈（hazard）/ 补给点（supply）；缺省字段则由 CFG.hazard / CFG.supply
   * 的全局默认接管（hazardEnabled / supplyEnabled 为布尔开关，覆盖项写在关卡内）。 */
  {
    id: "LEVEL_004", name: "第 4 关 · 熔岩裂谷", theme: "#241a14",
    mapW: 1920, mapH: 1920,
    monsterLevel: 4,
    eliteBase: 5,
    elitePool: "ED0001:45/ED0002:30/ED0003:25",
    boss: "BS0004",
    monsterCap: 120,
    circles: [{ tpl: "SC02", count: 4 }, { tpl: "SC03", count: 3 }],
    progressGoal: 100, timeLimit: 240, artisanAtKills: 32,
  },
  {
    id: "LEVEL_005", name: "第 5 关 · 熔核哨塔", theme: "#2a1c12",
    mapW: 1920, mapH: 1920,
    monsterLevel: 5,
    eliteBase: 6,
    elitePool: "ED0001:40/ED0002:30/ED0003:30",
    boss: "BS0005",
    monsterCap: 120,
    circles: [{ tpl: "SC02", count: 5 }, { tpl: "SC03", count: 4 }],
    progressGoal: 118, timeLimit: 270, artisanAtKills: 36,
    // 首个毒圈关（曲线档 HZ1）：预警期 20 秒让玩家看懂机制；收缩最慢（85s），
    // 圈外每 1.0 秒扣 7 点——满血 100 可站约 15 秒（8~15s 压力带最温和端，走位即可规避，不劝退）
    hazardEnabled: true,
    hazard: { startDelay: 20, shrinkDuration: 85, minRadius: 380, tickInterval: 1.0, dmgPercent: 0.01, dmgPerTick: 7 },
    // 补给最慷慨（曲线档 SP1）：3 个点、读条仅 2.5 秒、单点回血 25%——教学期鼓励学习「进圈回血」节奏
    supplyEnabled: true,
    supply: { count: 3, channelSeconds: 2.5, effect: { type: "heal", pct: 0.25 } },
  },
  {
    id: "LEVEL_006", name: "第 6 关 · 棱镜圣殿", theme: "#141f2a",
    mapW: 1920, mapH: 1920,
    monsterLevel: 6,
    eliteBase: 6,
    elitePool: "ED0001:35/ED0002:32/ED0003:33",
    boss: "BS0006",
    monsterCap: 120,
    circles: [{ tpl: "SC03", count: 5 }, { tpl: "SC02", count: 4 }],
    progressGoal: 132, timeLimit: 300, artisanAtKills: 40,
    // 毒圈进阶档（HZ2）：预警期 -2s、收缩提速到 75s，圈外每 1.0 秒扣 8 点（满血约 12.5 秒）
    hazardEnabled: true,
    hazard: { startDelay: 18, shrinkDuration: 75, minRadius: 350, tickInterval: 1.0, dmgPercent: 0.01, dmgPerTick: 8 },
    // 补给转增益型（SP2）：数量降到 2、读条 3 秒——治疗变少（回复压力开始显现），改发战前增益
    supplyEnabled: true,
    supply: { count: 2, channelSeconds: 3.0, effect: { type: "buff", buffPool: "war", duration: 20 } },
  },
  {
    id: "LEVEL_007", name: "第 7 关 · 裂空回廊", theme: "#1a1426",
    mapW: 1920, mapH: 1920,
    monsterLevel: 7,
    eliteBase: 7,
    elitePool: "ED0001:30/ED0002:34/ED0003:36",
    boss: "BS0007",
    monsterCap: 120,
    circles: [{ tpl: "SC03", count: 6 }, { tpl: "SC01", count: 4 }],
    progressGoal: 150, timeLimit: 330, artisanAtKills: 44,
  },
  {
    id: "LEVEL_008", name: "第 8 关 · 虫巢深渊", theme: "#1c2418",
    mapW: 1920, mapH: 1920,
    monsterLevel: 8,
    eliteBase: 7,
    elitePool: "ED0001:28/ED0002:34/ED0003:38",
    boss: "BS0008",
    monsterCap: 120,
    circles: [{ tpl: "SC03", count: 6 }, { tpl: "SC02", count: 5 }, { tpl: "SC04", count: 2 }],
    progressGoal: 168, timeLimit: 360, artisanAtKills: 48,
    // 毒圈压迫档（HZ3）：tick 缩到 0.8s（DPS 10，满血约 10.4 秒），预警 16s、终圈 330
    hazardEnabled: true,
    hazard: { startDelay: 16, shrinkDuration: 65, minRadius: 330, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 8 },
    // 补给回血回落（SP3）：单点 20%、读条 3 秒——比 L5 明显变抠，毒圈压力开始占上风
    supplyEnabled: true,
    supply: { count: 2, channelSeconds: 3.0, effect: { type: "heal", pct: 0.20 } },
  },
  {
    id: "LEVEL_009", name: "第 9 关 · 领主王座", theme: "#26161a",
    mapW: 1920, mapH: 1920,
    monsterLevel: 9,
    eliteBase: 8,
    elitePool: "ED0001:24/ED0002:34/ED0003:42",
    boss: "BS0009",
    monsterCap: 120,
    circles: [{ tpl: "SC03", count: 7 }, { tpl: "SC02", count: 5 }, { tpl: "SC04", count: 2 }],
    progressGoal: 184, timeLimit: 390, artisanAtKills: 52,
    // 毒圈高压档（HZ4）：预警 14s、终圈 310，DPS 11.25（满血约 9.6 秒）
    hazardEnabled: true,
    hazard: { startDelay: 14, shrinkDuration: 60, minRadius: 310, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 9 },
    // 补给转经济型（SP4）：不回血改发结晶 50——毒伤走高后回血性价比下降，改为资源补偿
    supplyEnabled: true,
    supply: { count: 2, channelSeconds: 3.5, effect: { type: "crystal", amount: 50 } },
  },
  {
    id: "LEVEL_010", name: "第 10 关 · 终焉神域", theme: "#220f16",
    mapW: 1920, mapH: 1920,
    monsterLevel: 10,
    eliteBase: 9,
    elitePool: "ED0001:20/ED0002:34/ED0003:46",
    boss: "BS0010",
    monsterCap: 120,
    circles: [{ tpl: "SC03", count: 7 }, { tpl: "SC02", count: 6 }, { tpl: "SC01", count: 4 }, { tpl: "SC04", count: 3 }],
    progressGoal: 200, timeLimit: 420, artisanAtKills: 56,
    // 毒圈终局档（HZ5）：预警 12s、终圈 290、收缩 55s——DPS 12.5（满血 8 秒，压力带最紧端）
    hazardEnabled: true,
    hazard: { startDelay: 12, shrinkDuration: 55, minRadius: 290, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 10 },
    // 补给最稀缺（SP5）：仅 1 个点、读条 4 秒、回血 15%——终局生存靠走位而非站桩奶
    supplyEnabled: true,
    supply: { count: 1, channelSeconds: 4.0, effect: { type: "heal", pct: 0.15 } },
  },
];

/* ---------- 刷怪圆模板表（表 B） ----------
 * pool 权重混入冲锋特殊怪（NM0027~0030），并新增 SC04 高阶混编圆（L8~L10 挂载）：
 * 冲锋特殊怪在场占比 SC01 ≈ 6%、SC02 ≈ 20%、SC03 ≈ 24%、SC04 ≈ 53%，
 * 配合 monsterUnlock 错峰解锁 → 中盘起每段进度都能见到新的冲撞表现。 */
CFG.spawnCircles = {
  SC01: { radius: 180, waveSize: 2, pool: "NM0010:62/NM0011:20/NM0012:12/NM0027:6", interval: 7.0, trigger: "immediate" },
  SC02: { radius: 200, waveSize: 2, pool: "NM0010:30/NM0011:20/NM0012:16/NM0013:14/NM0027:10/NM0028:10", interval: 6.0, trigger: "immediate" },
  SC03: { radius: 220, waveSize: 3, pool: "NM0013:26/NM0011:18/NM0012:18/NM0014:14/NM0028:10/NM0029:8/NM0030:6", interval: 5.5, trigger: "immediate" },
  /* SC04 高阶混编圆：只服务 L8~L10（怪物池上限 NM0026，无低编号怪）——
   * 权重配比：老面孔基础怪 40 / 冲锋特殊怪（NM0029/30/26/20/23）46，特殊怪过半制造压迫感 */
  SC04: { radius: 220, waveSize: 3, pool: "NM0020:14/NM0021:10/NM0022:8/NM0023:12/NM0025:8/NM0029:14/NM0030:12/NM0026:8", interval: 5.0, trigger: "immediate" },
};

/* ---------- 刷怪规则（全局） ---------- */
CFG.spawnRules = {
  minDistFromPlayer: 300,   // 刷怪点与玩家最小距离
  bossClearRadius: 380,     // BOSS 存活期间，刷怪点与 BOSS 的最小距离（避免小怪贴脸刷出）
};

/* ---------- 毒圈收缩（B 线并行批：CFG.hazard）----------
 * 关卡级机制：进场 startDelay 秒后毒圈出现，从**地图边缘**向内收缩到 minRadius（半径线性递减）。
 * 圆心默认取地图中心（可用圆心覆盖 cx/cy 比例）；收缩完成后保持 minRadius 不再变。
 * 圈外任意存活英雄（队长或队友）每 tickInterval 秒扣 dmgPerTick 血（走 heroTakeDamage 队友受伤入口）。
 * `enabled` 为全局总闸；关卡内 `hazardEnabled: true` + `hazard: { ... }` 覆盖任意字段。
 * 渲染：红色半透明环边界 + 环外渐暗遮罩（见 game.js 文件末尾 renderHazard）。 */
CFG.hazard = {
  enabled: false,           // 全局缺省关（main 之外默认不开启）；关卡以 hazardEnabled 打开
  startDelay: 20,           // 进场后多少秒出现毒圈（缺省 = 最温和的教学档基准）
  shrinkDuration: 85,       // 从满图收缩到 minRadius 所需秒数
  minRadius: 380,           // 最终安全圈半径（收缩到位后保持）
  tickInterval: 1.0,        // 圈外扣血间隔（秒）
  dmgPercent: 0.01,         // ★ 21.1 权威口径：每 tick 扣除**最大生命**的固定比例（1% = 0.01）
                            //   与角色当前血量、防御、等级成长全部无关 —— 满血 100 级站毒恒 100 秒致命。
                            //   设计意图：毒圈是「离场压力」而非「等级惩罚」，后期高血角色不会因绝对伤害
                            //   被稀释成无威胁，也不会被秒杀；各档位只靠 tickInterval 调密度。
  dmgPerTick: 7,            // ⚠️ 遗留字段（旧绝对值口径，仅兼容旧配置/旧测试读取）；
                            //   扣血逻辑自 21.1 起只读 dmgPercent，本字段不参与结算。
  cx: 0.5, cy: 0.5,         // 毒圈圆心（地图宽/高的比例，默认正中）
  color: "#ff3b3b",         // 边界色（红色系）
};

/* ---------- 补给点（B 线并行批：CFG.supply）----------
 * 关卡级机制：主地图随机生成 count 个补给点（互动物）；玩家**站进判定圈**读条 channelSeconds 秒生效。
 * 复用既有判定圈统一入口 judgeChannel（雕像/工匠/信标/撤离点共用），不新建判定体系。
 * effect 为单一生效项（配置驱动）：
 *   { type: "heal",    pct }                       —— 全队按 hpMax 比例回血
 *   { type: "buff",    buffPool, duration }        —— 随机获得该池一条增益 Buff
 *   { type: "crystal", amount }                    —— 直接给予金币/结晶
 *   亦可用 effects: [ ... ] 组合多项（缺省时回落 effect）。
 * 渲染：绿色发光圈 + 补给图标（见 game.js 文件末尾 renderSupply）。 */
CFG.supply = {
  enabled: false,           // 全局缺省关；关卡以 supplyEnabled 打开
  count: 2,                 // 生成数量（1~3）
  radius: 90,               // 判定/绘制圈半径（判定半径 = radius × altarJudgeMul）
  channelSeconds: 3.0,      // 读条秒数
  effect: { type: "heal", pct: 0.20 },
  color: "#5ad07a",         // 绿色系
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
 * 角色在屏幕上的大小只由 zoom 决定，PC / 手机一致；画布**宽度**跟随屏幕比例伸缩（宽屏看更多、竖屏看更窄）。
 *
 * ⚠️ 视野机制的关键（本次调参依据，务必理解）：
 *   渲染处（js/game.js:3300/3383）算的是 viewW = G.W / zoom、viewH = G.H / zoom，
 *   而 main.js fitCanvas 里又有 G.H = viewH_cfg × zoom、G.W = G.H × 屏幕宽高比。
 *   代入后 **zoom 完全约掉**：
 *       可视世界高 visH = G.H / zoom = viewH_cfg        （只由 viewH_cfg 决定）
 *       可视世界宽 visW = G.W / zoom = viewH_cfg × aspect（只由 viewH_cfg 与屏幕比例决定）
 *       1 世界单位 = 屏幕像素 = 画布高(css) / viewH_cfg  （也只由 viewH_cfg 决定）
 *   → 单独调 zoom 并不改变「看得多远多广」，只会改变画布像素分辨率（G.H = viewH×zoom）。
 *   所以「拉高视角、把视野变大」的真正旋钮是 **viewH 调大**；同时按 viewH×zoom ≈ 1080 反比调小 zoom，
 *   可保持画布高 G.H=1080、竖屏画布宽 ~499 不变（既有画布/跨端契约测试因此不破），
 *   而可视世界宽高反而各放大 (900/720-1) ≈ +25%。代价：角色/怪物在屏幕上等比缩小约 20%（属正常的视野取舍）。
 *   本次取值：viewH 720→900（视野 +25%）、zoom 1.5→1.2（反比配平，画布高仍 1080）。 */
CFG.camera = {
  zoom: 1.2,                // 变焦倍数：>1 拉近。**竖屏下与 viewH 反比联动**（见上），需与 viewH 配平保持 viewH×zoom≈1080
  viewH: 900,               // 垂直视野（世界单位）：**真正的视野旋钮**——720→900 即视野高/宽各 +25%（角色等比缩小 ~20%）
  minAspect: 0.75,          // 最小宽高比：**横屏**下比 4:3 更窄时钳制画布宽（竖屏已放开，见下）
  portraitFill: true,       // 竖屏填满屏幕（20.1）：true = 不钳制，按真实 aspect 铺满竖屏（无左右黑边）
  portraitBreakpoint: 1.0,  // 竖屏判定阈值：aspect < 此值视为竖屏
  smooth: 8,                // 相机平滑跟随系数（越大越跟手）
  /* ---- 以下为「可选新增字段」，旧代码（game.js/main.js）不读它们时行为与本次改动完全一致，向后兼容 ---- */
  portraitViewH: 980,       // 【可选·待接入】竖屏专用垂直视野：竖屏屏幕窄高，建议再放大一档（980 → 竖屏 visH +8.9%、
                            //   visW 416→453、角色再小约 8%）。接入方式见文件末「CFG.camera 接入说明」。
  zoomMin: 1.0,             // 【可选·待接入】运行时 zoom 下限：供后续「滚轮/双指缩放视野」做钳制（当前无消费者，仅占位）
  zoomMax: 2.0,             // 【可选·待接入】运行时 zoom 上限（同上）
};

/* ---------- 怪物体积倍数（贴图与碰撞半径同步放大） ----------
 * 随本次视野放大（viewH 720→900，屏幕等比缩小 ~20%），怪物屏幕尺寸也同步变小：
 *   竖屏 60×0.9378×1.5 ≈ 84px（改前 ≈105px）、PC 60×1.2×1.5 = 108px（改前 135px）。
 * 仍在清晰可辨区间，**本次不调整**；若后续觉得怪物偏小，可把本值 1.5 微调到 1.7~1.8（会同步放大碰撞半径）。
 * ⚠️ 注意：碰撞半径随本值放大，调大需回归战斗手感。 */
CFG.monsterSizeMul = 1.5;

/* ---------- 技能系统（现阶段：普攻 + 主动技能自动施法；终极技局外解锁后续开发） ----------
 * 注：技能局外等级已并入武器等级（Meta.weaponUp/weaponUpCost），此处仅保留自动施法开关。 */
CFG.skills2 = {
  autoCast: false,          // 🔴 19.1 已退役：技能改为全自动释放（冷却好+能量够+有目标即放，不读本开关）；字段保留仅为兼容

  /* 维修型无人机（19.2 恢复定位载体）—— 技能表 AT113 的附加治疗行为数值。
   * 无人机照常开火（保留原有攻击行为），附加：每 repairInterval 秒为**当前 HP 比例最低的己方成员**回复
   * healPerSec 点生命（走 spawnFloat 绿字提示，**不超过 hpMax**）。
   * 恢复定位 = 续航（修理/吸血/回复），不是纯奶妈 —— 与「所有技能必须有伤害」兼容。 */
  repairDrone: {
    healPerSec: 3,          // 每秒治疗量（HP）
    repairInterval: 1.0,    // 修理间隔（秒），到点结算一次
    // 归属：哪条技能带治疗（技能表 AT113 也标了 repair:true，双保险）
    skillIds: ["AT113"],
  },
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
  /* 21.1 手机化改造：下方三个圆钮（背包/交互/技能）全部隐藏，只保留方向盘。
   * 依据：主动技能本就是「全自动释放」（见 game.js 玩家更新注释），技能钮仅模拟空格键、属冗余；
   *       背包改走右上角 HUD 按钮；交互改走「站圈 1 秒 + 点击 NPC 本体」。
   * 本表控制触屏控件可见性，改 true 可逐个恢复（便于回退/排查）。 */
  hideTouchButtons: true,
  /* 工匠世界 NPC 点选（21.1）：进圈 dwellSeconds 秒解锁 → 点击 NPC 本体进入工坊。
   * tapRadius 略大于视觉半径以容纳手指精度；hintRadius 为提示环绘制半径。 */
  npcTap: { dwellSeconds: 1.0, tapRadius: 110, hintRadius: 104 },
  /* 浮动摇杆（21.1）：左半屏按下即把该点作为摇杆中心，拇指无需找固定位置。
   * zoneRatio 为「可召唤区」占屏宽比例；returnOnRelease 松手后摇杆是否回到默认锚点。 */
  /* 浮动摇杆（21.3 重写）：左半屏任意处按下 → 摇杆**在该点生成**（不是固定左下角）。
   * zoneRatio   「可召唤区」占屏宽比例（0.5 = 左半屏）；
   * returnOnRelease 松手后是否把底盘归位到待命锚点（true = 隐形待命，下次按下重新生成）；
   * dragBase    拇指拖动超过 maxR 时，底盘是否跟着拇指走（true = 经典浮动摇杆手感，防止拇指漂移出盘）；
   * stayInZone  拖动底盘时是否把它夹在可召唤区内（防止底盘跑到右半屏按钮区）；
   * idleOpacity 待命时底盘透明度（0 = 完全隐形，只在按下时出现）。 */
  floatStick: {
    enabled: true, zoneRatio: 0.5, returnOnRelease: true,
    dragBase: true, stayInZone: true, idleOpacity: 0,
  },
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

/* ---------- 怪物解锁进度（击杀进度百分比） ----------
 * 随机圆按玩家击杀进度过滤怪物池（进度 < unlock 的怪暂不出现）；
 * 新增普通怪 NM0015~NM0030 错峰开放：前期见弱怪，进度推高后强怪逐步入场。
 * NM0027~NM0030 为冲锋（charger）特殊怪扩充档：0.35 / 0.45 起步，
 * 让中盘起每隔一段进度就有新的冲锋表现入场（对应用户「出怪节奏多一些特殊怪」诉求）。 */
CFG.monsterUnlock = {
  NM0010: 0, NM0011: 0.25, NM0012: 0.55, NM0013: 0.15, NM0014: 0.5,
  NM0015: 0, NM0016: 0.1, NM0017: 0.2, NM0018: 0.3, NM0019: 0.4, NM0020: 0.5,
  NM0021: 0.58, NM0022: 0.65, NM0023: 0.72, NM0024: 0.8, NM0025: 0.88, NM0026: 0.95,
  NM0027: 0.35, NM0028: 0.45, NM0029: 0.78, NM0030: 0.85,
};

/* ---------- 敌人配置表（8.5 表 2） ----------
 * type = AI 行为类型（melee / ranged / charger / boss），决定行动方式；
 * skillList = 攻击技能条目（技能表 4e 视图），**攻击参数全部来自技能表**，本表不再硬编码
 *   （原 fireCd / bulletSpd / keepDist / chargeRange / boomCd / minionCd 等已迁至 AT2xx）。
 * 多个怪物可复用同一技能条目（如 AT201 被重甲兵与重装督军共用）。
 * charger 冲锋表现差异化（AT241~244，见表 4e-4）：同是冲锋，前摇/冲速/滑行/冷却/倍率各不相同——
 *   NM0012 冲锋猎犬（AT203 标准冲，参数被 skill_table_test 锁定，保持不动）
 *   NM0017 疾行撕咬兽（AT241 连突）/ NM0020 狂澜冲角兽（AT243 碾压）
 *   NM0023 裂地冲撞者（AT242 蓄力猛冲）/ NM0026 终焉追猎兽（AT244 俯冲）
 *   NM0027~NM0030 为冲锋扩充档（表 4e-4 四招全覆盖）。 */
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

  /* ---------- 普通怪铺量（第十七章 17.7 第 4 步：补齐 NM 系列到 17+ 种）----------
   * 设计口径：每只普通怪 = 一种 AI 行为（melee 近战 / ranged 远程 / charger 冲锋）
   *   + 一条攻击技能条目（复用表 4e 的 AT201~AT206，同一套参数可被多怪共用）
   *   + 掉落（exp 经验 / coin 金币，随强度递增）。
   * 强度沿编号与关卡递增：低编号当炮灰，高编号当压迫。 */
  NM0015: { name: "腐锈游荡者", type: "melee", sprite: "enemy16", skillList: ["AT201"],
    hp: 26, atk: 9,  def: 1, spd: 105, radius: 17, exp: 4, coin: 2 },
  NM0016: { name: "骨刺散兵", type: "ranged", sprite: "enemy08", skillList: ["AT202"],
    hp: 15, atk: 7,  def: 0, spd: 100, radius: 15, exp: 5, coin: 3 },
  NM0017: { name: "疾行撕咬兽", type: "charger", sprite: "enemy00", skillList: ["AT241"],
    hp: 18, atk: 11, def: 0, spd: 145, radius: 15, exp: 6, coin: 3 },
  NM0018: { name: "枯枝卫士", type: "melee", sprite: "enemy16", skillList: ["AT201"],
    hp: 50, atk: 12, def: 3, spd: 88,  radius: 21, exp: 8, coin: 5 },
  NM0019: { name: "腐沼射手", type: "ranged", sprite: "enemy08", skillList: ["AT204"],
    hp: 24, atk: 10, def: 1, spd: 92,  radius: 16, exp: 9, coin: 6 },
  NM0020: { name: "狂澜冲角兽", type: "charger", sprite: "enemy00", skillList: ["AT243"],
    hp: 30, atk: 14, def: 1, spd: 150, radius: 17, exp: 10, coin: 6 },
  NM0021: { name: "暗影潜伏者", type: "melee", sprite: "enemy00", skillList: ["AT206"],
    hp: 34, atk: 15, def: 2, spd: 128, radius: 18, exp: 12, coin: 7 },
  NM0022: { name: "深渊猎手", type: "ranged", sprite: "enemy08", skillList: ["AT205"],
    hp: 32, atk: 13, def: 2, spd: 98,  radius: 17, exp: 13, coin: 8 },
  NM0023: { name: "裂地冲撞者", type: "charger", sprite: "enemy00", skillList: ["AT242"],
    hp: 44, atk: 17, def: 2, spd: 140, radius: 19, exp: 15, coin: 9 },
  NM0024: { name: "重渊守卫", type: "melee", sprite: "enemy16", skillList: ["AT201"],
    hp: 72, atk: 19, def: 4, spd: 82,  radius: 23, exp: 18, coin: 11 },
  NM0025: { name: "虚空狙击者", type: "ranged", sprite: "enemy08", skillList: ["AT205"],
    hp: 46, atk: 18, def: 3, spd: 94,  radius: 18, exp: 20, coin: 12 },
  NM0026: { name: "终焉追猎兽", type: "charger", sprite: "enemy00", skillList: ["AT244"],
    hp: 60, atk: 22, def: 3, spd: 158, radius: 20, exp: 24, coin: 14 },

  /* ---------- 冲锋特殊怪扩充档（NM0027~NM0030，全部 charger）----------
   * 设计意图：对应用户「出怪的节奏多一些特殊怪，冲撞类的」——在中高解锁段插入 4 只
   * 冲锋怪，与表 4e-4 四种冲锋招式一一对应，保证刷怪时冲撞表现轮换、不重复。
   * 强度对齐同解锁段既有怪物（hp/atk/def/spd/exp/coin 取相邻 NM 区间中位）：
   *   NM0027（0.35，NM0017~20 段）：重装定位，hp/def 偏高、spd 压低，AT243 慢速长滑行
   *   NM0028（0.45，NM0019~21 段）：快脆皮，hp 压低 spd 抬高，AT244 一击脱离
   *   NM0029（0.78，NM0023~24 段）：蓄力重炮手，AT242 长前摇高倍率
   *   NM0030（0.85，NM0024~26 段）：连爪刺客，AT241 高频连突单次低伤 */
  NM0027: { name: "岩壳冲犀", type: "charger", sprite: "enemy00", skillList: ["AT243"],
    hp: 36, atk: 12, def: 2, spd: 105, radius: 20, exp: 10, coin: 6 },
  NM0028: { name: "风暴突隼", type: "charger", sprite: "enemy00", skillList: ["AT244"],
    hp: 24, atk: 13, def: 0, spd: 156, radius: 15, exp: 10, coin: 5 },
  NM0029: { name: "熔核突进者", type: "charger", sprite: "enemy00", skillList: ["AT242"],
    hp: 50, atk: 18, def: 2, spd: 120, radius: 19, exp: 16, coin: 10 },
  NM0030: { name: "影袭连爪", type: "charger", sprite: "enemy00", skillList: ["AT241"],
    hp: 46, atk: 15, def: 2, spd: 162, radius: 17, exp: 19, coin: 11 },

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

  /* ---------- BOSS 4~10（第十七章 17.7 第 4 步：后 7 关新 Boss）----------
   * 设计依据 17.5 关卡阵容：每只对应一种弹幕原型；阶段推进 = **换招式池**（加机制不加血）。
   * 招式复用表 4e-2 的弹幕条目（AT211~220 按原型被多只 Boss 复用，见 17.8 契约 1）；
   * 激光主题 Boss（BS0006 / BS0009）额外挂 `laserSkills` + `laserCd`（表 4e-3）。
   * 血量沿关卡递进，最终 Boss（BS0010）最厚且**三阶段**分阶段解锁前面的机制。 */
  BS0004: { name: "旋刃使者", type: "boss", sprite: "enemy22",
    skillList: ["AT207", "AT216", "AT219", "AT220", "AT214"],
    phases: [
      { hp: 1.0, skills: ["AT216", "AT219"] },        // 螺旋舞者：三臂漩涡 + 双螺旋绞杀（顺逆双螺旋）
      { hp: 0.45, skills: ["AT219", "AT220", "AT214"] },   // 压测：螺旋收束（双螺旋 + 同心环）
    ], patternCd: 3.1,
    hp: 1750, atk: 25, def: 6, spd: 96, radius: 56, exp: 150, coin: 240 },

  BS0005: { name: "熔核暴君", type: "boss", sprite: "enemy22",
    skillList: ["AT208", "AT215", "AT218", "AT211"],
    phases: [
      { hp: 1.0, skills: ["AT215", "AT218"] },        // 冲锋践踏·强化：落地冲击环 + 熔岩波幕
      { hp: 0.5, skills: ["AT218", "AT215", "AT211"] },    // 压测：连续熔岩波 + 放射爆
    ], patternCd: 2.9,
    hp: 2100, atk: 28, def: 6, spd: 88, radius: 58, exp: 170, coin: 280 },

  BS0006: { name: "棱镜之眼", type: "boss", sprite: "enemy22",
    skillList: ["AT207", "AT212", "AT213", "AT217"],
    phases: [
      { hp: 1.0, skills: ["AT212", "AT213"] },        // 棱镜 Laser：追瞄扇压制（激光走 laserSkills 独立通道）
      { hp: 0.5, skills: ["AT213", "AT217"] },        // 压测：扇射 + 花形爆发 双层压制
    ], patternCd: 3.4,
    laserSkills: ["AT231", "AT232"], laserCd: 4.0,     // 三束旋转扫描 / 交叉棱光扫描
    hp: 2450, atk: 30, def: 7, spd: 78, radius: 60, exp: 190, coin: 320 },

  BS0007: { name: "裂空织者", type: "boss", sprite: "enemy22",
    skillList: ["AT208", "AT216", "AT219", "AT213", "AT212"],
    phases: [
      { hp: 1.0, skills: ["AT216", "AT219"] },        // 双螺旋
      { hp: 0.5, skills: ["AT219", "AT213", "AT212"] },    // 压测：双螺旋 + 追瞄扇
    ], patternCd: 3.2,
    hp: 2800, atk: 32, def: 7, spd: 84, radius: 60, exp: 210, coin: 360 },

  BS0008: { name: "噬弹虫母", type: "boss", sprite: "enemy22",
    skillList: ["AT209", "AT212", "AT214", "AT217", "AT220"],
    phases: [
      { hp: 1.0, skills: ["AT212", "AT214"] },        // 弹幕吞噬：吸收反击前奏（追瞄 + 同心环）
      { hp: 0.5, skills: ["AT217", "AT220"] },        // 压测：花形爆发（网格 + 三环）
    ], patternCd: 3.6,
    hp: 3200, atk: 34, def: 8, spd: 70, radius: 64, exp: 230, coin: 400 },

  BS0009: { name: "深渊领主", type: "boss", sprite: "enemy22",
    skillList: ["AT209", "AT211", "AT214", "AT220", "AT215"],
    phases: [
      { hp: 1.0, skills: ["AT211", "AT214"] },        // 混合：放射环
      { hp: 0.5, skills: ["AT220", "AT215"] },        // 压测：放射环 + 深渊扫射（激光走 laserSkills）
    ], patternCd: 3.0,
    laserSkills: ["AT233"], laserCd: 3.8,              // 深渊旋转激光（双臂旋转扫描）
    hp: 3600, atk: 36, def: 8, spd: 76, radius: 66, exp: 260, coin: 460 },

  BS0010: { name: "终焉·邪神本体", type: "boss", sprite: "enemy22",
    skillList: ["AT207", "AT211", "AT213", "AT216", "AT217", "AT218", "AT220", "AT215", "AT212"],
    phases: [
      { hp: 1.0, skills: ["AT211", "AT213"] },        // 教学：放射 + 扇形（前面出现过的母题）
      { hp: 0.66, skills: ["AT216", "AT217", "AT218"] },   // 变奏：螺旋 + 花形 + 波幕
      { hp: 0.33, skills: ["AT220", "AT215", "AT212"] },   // 压测：三环 + 冲击 + 追瞄混编
    ], patternCd: 2.8,
    hp: 4500, atk: 40, def: 9, spd: 74, radius: 72, exp: 320, coin: 600 },
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
  /* ---- 激光实体（17.7 第 3 步，LaserBeam）---- */
  laserCap: 6,           // 同屏激光束上限（17.6「独立上限 ≤ 6 束」）
  laserWarn: 0.9,        // 预热时长（秒）：青线预报，无伤害
  laserActive: 1.6,      // 激活时长（秒）：粗光柱，按段结算伤害 + 吞噬玩家弹
  laserFade: 0.35,       // 消散时长（秒）：收束淡出，无伤害
  laserLen: 1600,        // 激光射程（px）
  laserHalfW: 12,        // 光柱半宽（px，线段-圆判定用）
  laserDmgInterval: 0.25, // 伤害结算间隔（秒，按段节流而非逐帧）
  laserDmgMul: 0.5,      // 单段伤害 = Boss atk × 此倍率
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
  // 铺量角（批次 F）：12 角补齐，定位与武器数值均落在同定位现有角平衡带内；
  // 武器技能复用 CFG.skills 已有条目（技能表已铺满，不新增技能条目）。
  { id: "H009", name: "守护者", desc: "重型护盾 / 贯穿射线 · 阵地防御型", sprite: "hero",
    hp: 100, def: 2, atk: 12, energyMax: 110, energyRegen: 9,
    spd: 295, radius: 19, weapon: "W009", summonMax: 2, trapMax: 1 },
  { id: "H010", name: "医疗兵", desc: "随行治疗 / 震荡波 · 续航恢复型", sprite: "hero",
    hp: 92, def: 1, atk: 12, energyMax: 120, energyRegen: 12,
    spd: 300, radius: 18, weapon: "W010", summonMax: 2, trapMax: 1 },
  { id: "H011", name: "圣歌者", desc: "光环鼓舞 / 环形弹幕 · 群疗恢复型", sprite: "hero",
    hp: 88, def: 1, atk: 11, energyMax: 115, energyRegen: 12,
    spd: 305, radius: 18, weapon: "W011", summonMax: 2, trapMax: 1 },
  { id: "H012", name: "灵能者", desc: "灵能护罩 / 能量爆发 · 灵力恢复型", sprite: "hero",
    hp: 90, def: 1, atk: 13, energyMax: 125, energyRegen: 11,
    spd: 300, radius: 18, weapon: "W012", summonMax: 2, trapMax: 1 },
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
  // 铺量武器（批次 F）：专属绑定，技能引用 CFG.skills 既有条目（不新增技能）
  W009: { id: "W009", name: "堡垒炮", desc: "重型护盾炮，技能为高穿透贯穿射线",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT107", skill: "AT106" } },
  W010: { id: "W010", name: "生命枪", desc: "随行治疗枪，技能为震荡波压制",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT101", skill: "AT104" } },
  W011: { id: "W011", name: "圣咏器", desc: "光环圣咏器，技能为环形弹幕群疗",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT109", skill: "AT108" } },
  W012: { id: "W012", name: "灵能杖", desc: "灵能法杖，技能为能量爆发",
    tags: ["弹道数量", "冷却", "弹速", "范围", "穿透", "弹射次数"],
    skills: { basic: "AT105", skill: "AT102" } },
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
    cd: 0.5, energy: 0, dmgMul: 0.75, bullets: 1, bulletSpd: 620, pierce: 0, bounce: 0 },
  AT102: { name: "能量爆发", cat: "active", kind: "skill", type: "bullet",
    cd: 1.8, energy: 100, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 1.5, radius: 130 },   // 朝目标发射能量弹，命中后圆形范围爆炸
  AT103: { name: "三向散射", cat: "active", kind: "basic", type: "bullet",
    cd: 0.8, energy: 0, dmgMul: 0.7, bullets: 3, bulletSpd: 520, pierce: 0, bounce: 0 },
  AT104: { name: "震荡波", cat: "active", kind: "skill", type: "bullet",
    cd: 1.9, energy: 100, tags: ["伤害","冷却","范围"], dmgMul: 1.3, radius: 150 },
  AT105: { name: "磁轨弹", cat: "active", kind: "basic", type: "bullet",
    cd: 0.7, energy: 0, dmgMul: 0.85, bullets: 1, bulletSpd: 760, pierce: 2, bounce: 0 },
  AT106: { name: "贯穿射线", cat: "active", kind: "skill", type: "bullet",
    cd: 1.8, energy: 100, tags: ["伤害","冷却","穿透","弹速"], dmgMul: 1.6, radius: 120 },
  AT107: { name: "跳弹", cat: "active", kind: "basic", type: "bullet",
    cd: 0.65, energy: 0, dmgMul: 0.75, bullets: 1, bulletSpd: 560, pierce: 0, bounce: 2 },
  AT108: { name: "环形弹幕", cat: "active", kind: "skill", type: "bullet",
    cd: 2.0, energy: 110, tags: ["伤害","冷却","范围","弹道数量"],
    dmgMul: 1.2, radius: 160, bullets: 8 },
  AT109: { name: "双生速射", cat: "active", kind: "basic", type: "bullet",
    cd: 0.4, energy: 0, dmgMul: 0.55, bullets: 1, bulletSpd: 640, pierce: 0, bounce: 0 },
  AT110: { name: "疾风连爆", cat: "active", kind: "skill", type: "bullet",
    cd: 1.5, energy: 100, tags: ["伤害","冷却","弹道数量"], dmgMul: 1.2, radius: 120, bullets: 3 },
  AT111: { name: "重锤弹", cat: "active", kind: "basic", type: "bullet",
    cd: 0.9, energy: 0, dmgMul: 1.15, bullets: 1, bulletSpd: 430, pierce: 1, bounce: 0 },
  AT112: { name: "攻城爆破", cat: "active", kind: "skill", type: "bullet",
    cd: 2.3, energy: 120, tags: ["伤害","冷却","范围","弹速"], dmgMul: 1.9, radius: 190 },

  /* ===== 召唤物 / 陷阱类技能（离散值走 anchors 锚点表，1~100 级全程有效） ===== */
  AT113: { name: "召唤无人机", cat: "active", type: "summon", kind: "skill", cd: 5.5, energy: 110,
    tags: ["召唤物", "伤害", "冷却"],
    // 🔴 19.2 恢复定位载体：召唤师 H007 的无人机改造为「维修型」——照常开火，附加持续修理队友。
    // 数值统一在 CFG.skills2.repairDrone（铁律：数值一律进 CFG）；此处只挂开关与定位标记。
    repair: true,
    desc: "召唤/补充维修型无人机协战（自动攻击 + 每秒修理 HP 最低的己方成员，再次施放补满）",
    anchors: {
      count:  { 1: 3, 25: 4, 60: 5, 100: 6 },          // 无人机数量（整数 → 向下取整）
      hp:     { 1: 40, 50: 120, 100: 260 },            // 每架生命
      atk:    { 1: 6, 50: 20, 100: 48 },               // 每架攻击力
      fireCd: { 1: 0.8, 50: 0.65, 100: 0.5 },          // 攻击间隔（含小数 → 保留两位）
      orbit:  { 1: 66, 50: 74, 100: 90 },              // 环绕半径
    } },
  AT114: { name: "大地雷", cat: "active", type: "trap", kind: "skill", cd: 5.0, energy: 90,
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

  /* ===== 表 4e-3：Boss 激光招式（第十七章 17.7 第 4 步，LaserBeam 专用）=====
   * 与 AT211~220 的**弹幕发射器**不同，本组条目**不带 pattern**：它走 `bossLaserTick` 的
   * 激光通道（线段-圆判定，独立于弹幕预算，受 laserCap ≤ 6 束约束，见 17.6 / 17.9 待定 2）。
   * 由怪物表的 `laserSkills` 挂载（非空即启用），并按 `laserCd` 为招式间隔循环。
   * 字段口径（bossLaserTick 消费）：
   *   arms      = 一次铺开的激光**束数**（均匀铺开，角度 2π/arms）
   *   spin      = 每次发射整体旋转量（弧度，正负 = 顺/逆时针 → 旋转扫描扫场）
   *   laserLen  = 射程覆盖（px，缺省取 CFG.boss.laserLen = 1600）
   *   dmgMul    = 单段伤害倍率（× 怪 atk；缺省取 CFG.boss.laserDmgMul = 0.5）
   *   cd        = 招式间隔（秒；缺省取怪物表 laserCd）
   *   laserWarn / laserActive / laserFade = 预热 / 激活 / 收束时长覆盖（青线电报语言）
   * ⚠️ 束数 × 在场激光数必须 ≤ CFG.boss.laserCap（超出时引擎 FIFO 回收最旧的，配置上先卡死 ≤ 6）。 */
  AT231: { name: "三束旋转扫描", cat: "active", ai: "boss", tags: ["伤害"],
    arms: 3, spin: 0.30, laserLen: 1600, dmgMul: 0.5,
    cd: 4.2, laserWarn: 0.9, laserActive: 1.6, laserFade: 0.35 },
  AT232: { name: "交叉棱光扫描", cat: "active", ai: "boss", tags: ["伤害"],
    arms: 2, spin: -0.45, laserLen: 1500, dmgMul: 0.55,
    cd: 3.6, laserWarn: 0.75, laserActive: 1.4, laserFade: 0.35 },
  AT233: { name: "深渊旋转激光", cat: "active", ai: "boss", tags: ["伤害"],
    arms: 2, spin: 0.5, laserLen: 1600, dmgMul: 0.55,
    cd: 4.0, laserWarn: 0.85, laserActive: 1.6, laserFade: 0.35 },

  /* ===== 表 4e-4：冲锋怪招式（AT241~244，charger 专属）=====
   * 目的：让 charger 型怪物不再共用 AT203 一种表现，冲撞手感彼此拉开。
   * 全部字段均为 js/game.js Monster AI（charger 分支）与 monsterAttackSkill 已消费的既有字段：
   *   cd         = 冲锋冷却（dash 结束后进入 chase 的等待秒数；调小 = 冲完很快再冲 → 连突手感）
   *   chargeRange= 触发冲锋的索敌距离（也是红色虚线预警长度）
   *   telegraph  = 前摇（预警线亮起到起冲的秒数；越长越好躲、越有"蓄力"感）
   *   dashSpd    = 冲刺速度（px/s）
   *   dashTime   = 冲刺持续（秒；越长滑行越深，压迫范围越大）
   *   dmgMul     = 冲撞伤害倍率（× 怪物 atk；dash 期间碰到英雄才结算）
   * 设计分工：
   *   AT203 冲撞突袭（基准，保留）：0.6s 前摇 / 560 冲速 / 3.0s 冷却 —— 全能标准冲
   *   AT241 疾风连突：短前摇 + 冷却极短 + 触发距离远 → 连冲 2~3 次的撕咬节奏，单次低伤
   *   AT242 蓄力猛冲：长前摇（1.2s 明显预警）+ 极高冲速 + 高倍率 + 长冷却（冲完硬直）→ 一击脱离
   *   AT243 重装碾压：慢冲速 + 长滑行（0.7s）→ 重车推进感，冲得久压得深
   *   AT244 游隼俯冲：中庸偏快的扑咬，各项参数均落在 AT203 邻域 → 一击脱离的轻量版 */
  AT241: { name: "疾风连突", cat: "active", ai: "charger", tags: ["连击"],
    cd: 0.5, chargeRange: 400, telegraph: 0.3, dashSpd: 470, dashTime: 0.3, dmgMul: 0.7 },
  AT242: { name: "蓄力猛冲", cat: "active", ai: "charger", tags: ["高伤"],
    cd: 4.6, chargeRange: 360, telegraph: 1.2, dashSpd: 760, dashTime: 0.22, dmgMul: 2.2 },
  AT243: { name: "重装碾压", cat: "active", ai: "charger", tags: ["压制"],
    cd: 2.6, chargeRange: 300, telegraph: 0.8, dashSpd: 400, dashTime: 0.7, dmgMul: 1.4 },
  AT244: { name: "游隼俯冲", cat: "active", ai: "charger", tags: ["突袭"],
    cd: 2.2, chargeRange: 280, telegraph: 0.45, dashSpd: 640, dashTime: 0.35, dmgMul: 1.1 },

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

/* ---------- 主关卡开场冻结（出征进入主地图时的「停留 3 秒」） ----------
 * 规则与裂缝开场冻结完全一致（5.1）：全员静止 + 全员无敌，红字 3/2/1 倒计时，压暗战场。
 * 作用域：**仅主关卡**（`World.setupMain`）——工匠世界为无敌人安全区不加；裂缝用自己的 CFG.rift.freezeTime。
 * 倒计时归零后立即开战（主关卡首波怪已在 setupMain 中投放，冻结期间不会被攻击）。 */
CFG.levelFreeze = {
  freezeTime: 3.0,        // 开场冻结时长（秒）：红字 3/2/1 倒计时
  hint: "准备战斗",        // 倒计时下方提示文案（渲染时拼成「全员冻结中 · <hint>」）
};

/* ============================================================
 * ★ 第十九章 规则重做（v2 战斗重构）—— 本批为「配置 + 文档」阶段，逻辑待实现
 * 术语：武器模块 = 原辅助石（代码 module）｜芯片背包 = 原武器栏（代码 weaponInv）
 * 本章所有配置项均为**预留**：逻辑尚未接入，改它们不会影响当前运行时行为。
 * ============================================================ */

/* ---------- 战斗形态：移除普攻（19.1） ----------
 * 每个英雄的武器只保留 1 个主动技能（CFG.weapons[].skills.skill），普攻条目（kind:"basic"）退役。
 * 移除后英雄的**唯一输出手段 = 主动技能**，因此"所有主动技能都必须有伤害"（见 CFG.heroRoles）。 */
CFG.basicAttack = {
  removed: true,           // true = 普攻已移除（战斗侧不再执行 kind:"basic" 技能）
  // basic 技能条目暂留表内不删：敌人技能表可能复用同 ID（见 5.23），删条目会连带炸敌人配表。
  // 退役做法：只把「英雄侧」的 basic 发射路径关掉，条目本身保留供敌人复用。
  keepEntriesForMonster: true,   // 敌人侧仍可使用 basic 类条目（怪物普攻不受影响）
};

/* ---------- 英雄定位（19.2，取代旧的"均衡/压制"风格描述） ----------
 * 三定位：output 输出 / defense 防御 / recovery 恢复。
 * 🔴 伤害口径（已澄清）：三者**都有伤害**，防御/恢复是**低伤害**而非**无伤害**；
 *    差异体现在「伤害倍率 + 附加效果」，不是「有没有伤害」。
 *    因此无需额外机制即可击杀敌人 → 获得经验（见 CFG.levelUp.expSource），绕开"无伤害卡死升级"的死结。
 * 本表只标注定位与技能分工，具体技能 ID 仍由 CFG.weapons[].skills.skill 承担；
 * 具体伤害倍率由技能表 dmgMul 填。 */
CFG.heroRoles = {
  output:   { name: "输出", color: "#ff6b6b", dmgBand: "高（基准 1.0）",      desc: "以直接伤害为主，清场效率最高" },
  defense:  { name: "防御", color: "#6cb2ff", dmgBand: "低（约 0.5~0.7）",    desc: "高生存 + 护盾/减伤，低伤害 + 附加效果" },
  recovery: { name: "恢复", color: "#6bd88a", dmgBand: "低（约 0.4~0.6）",    desc: "持续治疗/回复队友，低伤害 + 附加效果" },
  byHero: {
    H001: "output", H002: "output", H003: "output",
    H004: "defense", H005: "defense",
    H006: "output", H007: "recovery", H008: "defense",
    H009: "defense", H010: "recovery", H011: "recovery", H012: "recovery",
  },
  // 断言用：三定位必须齐全（全部导向同一路径 = 设计失衡，测试会报错）
  requireAll: ["output", "defense", "recovery"],
};

/* ---------- 技能释放资源 = 冷却制（19.3） ----------
 * 移除能量池：技能只受冷却约束（CFG.skills[].cd），不再检查 energyMax / energyRegen。
 * 影响面（待实现时同步处理）：
 *   - 英雄属性 energyMax / energyRegen 退役（条目保留但不再参与技能门槛，避免连锁改表）
 *   - 队友独立能量池（5.19）随之作废
 *   - 属性卡牌相关能量条目一并删除（见 CFG.cardPool.removed） */
CFG.skillResource = {
  mode: "cooldown",        // "cooldown" = 冷却制（旧值 "energy" 已废弃）
  startReady: true,        // 进图时技能是否立即就绪（true = 首次开战即可放技能，不空转）
};

/* ---------- 局内升级：经验来源 + 选择机制（19.4） ----------
 * 经验来源改为「参与伤害即给」：对敌人造成过伤害（含技能/召唤物/陷阱）的记录在册，
 * 敌人死亡时把经验分给**所有参与过的成员**（避免"没抢到最后一击 = 不升级"的卡级感）。
 * 升级后弹出 **4 选 1**：候选池 = **该英雄主动技能对应的武器模块池**（每英雄独立池）。 */
CFG.levelUp = {
  // 经验来源
  expSource: "participation",     // "participation" = 参与伤害即给（旧值 "lastHit" 已废弃）
  participationWindow: 0,         // 0 = 只要打过就算（不限时间窗）；>0 则距最后一次命中该秒数内有效
  expShareOnKill: true,           // 敌人死亡时按「参与者名单」分发经验（而非只给击杀者）
  expShareEven: false,            // false = 全部参与者各得全额；true = 按伤害占比分成

  // 经验曲线：前期快、后期慢（指数衰减手感）
  curve: {
    shape: "fastEarly",           // "fastEarly" 前期快后期慢 ｜ "linear" 线性 ｜ "exp" 指数
    base: 8,                      // LV1→2 所需经验
    growth: 1.32,                 // 每级需求 ×1.32（1~10 级涨得慢，之后加速）
    softCapLv: 12,                // 该级之前额外宽松（base 打折），保证开局雪球手感
    softCapMul: 0.7,              // softCapLv 以内的需求系数（<1 = 更快升级）
    maxLv: 99,                    // 局内等级上限（与 99 关主线对齐，超出后不再弹 4 选 1）
  },

  // 4 选 1
  choiceCount: 4,                 // 每次升级展示 4 个候选
  pickCount: 1,                   // 选 1
  poolMode: "perHero",            // "perHero" 每英雄独立池（见 CFG.modulePool）
  allowDuplicateOffer: true,      // 允许多个候选是同一个模块（便于快速堆层数）
  weighted: true,                 // 按 CFG.modulePool 的 weight 加权抽取
  rerollFreePerRun: 1,            // 21.4：每局免费刷新 1 次（参考图「刷新 1/1」；0 = 关闭刷新按钮）
  // 升级时同时给予的基础属性成长（原本由属性卡牌提供，卡牌删除后并入此处）
  baseStatGain: { hp: 6, atk: 1.5, def: 0.5 },

  /* 兜底：属性小包 4 选 1（19.10.4）——
   * 触发条件 = 该英雄**全部模块已满级 9**（过滤后候选为空）时，4 选 1 弹窗改出属性小包。
   * 数值（⚠️ 暂定，可调）：以「模块满级 ≈ 一局中后期」为基准，四者互斥选择。
   * 生效通道：并入 G.run.statPackGain → runBonus().add（全队生效），**不进 tagCalc**（不是武器词条）。 */
  statPack: [
    { id: "pack_atk", name: "强攻包", stat: "atk", value: 3 },
    { id: "pack_hp",  name: "坚韧包", stat: "hp",  value: 15 },
    { id: "pack_def", name: "铁壁包", stat: "def", value: 1 },
    { id: "pack_spd", name: "疾行包", stat: "spd", value: 8 },
  ],
};

/* ---------- 武器模块槽（19.5） ----------
 * 每英雄 4 个武器模块槽；**不限模块个数，只受槽位限制**（同槽=同类）。
 * 同名模块叠加 → 等级 +1，**最高 9 级**（与 CFG.moduleLevel.maxLv 一致，两条口径必须同步）。 */
CFG.moduleSlot = {
  perHero: 4,                   // 每英雄 4 个模块槽
  slotMode: "type",             // "type" = 每槽装一类模块（不限个数，只受槽位限制）
  stackSameName: true,          // 同名模块可叠加
  stackLevelUp: 1,              // 每叠 1 张 +1 级
  maxLv: 9,                     // 模块最高 9 级（= 最多取 9 张同名）
  // 9 级分 3 阶段（沿用 CFG.moduleLevel.perStage = 3），阶段词缀同 CFG.moduleLevel.stageAffixes
  stages: 3,
};

/* ---------- 模块池：每英雄独立（19.5） ----------
 * 局内升级 4 选 1 的候选来源 = 本英雄主动技能对应的模块池。
 * 🔴 不再从宝箱/商店获得模块（与 16.5「宝箱开出为主 / 工匠世界购买为补充」冲突，以本章为准）。
 * pool 内容 = CFG.moduleDefs 的 id；perHero 未列出的英雄回落到 default 池。 */
CFG.modulePool = {
  default: ["M001", "M002", "M003", "M004", "M005", "M009"],
  perHero: {
    // 输出型：伤害 / 弹道 / 冷却优先
    H001: ["M001", "M002", "M003", "M009", "M012", "M004"],
    H002: ["M001", "M003", "M009", "M012", "M008", "M002"],
    H003: ["M005", "M009", "M003", "M002", "M004", "M001"],
    H006: ["M004", "M008", "M009", "M002", "M005", "M001"],
    // 防御型：范围 / 冷却 / 耐久向
    H004: ["M002", "M004", "M008", "M007", "M001", "M009"],
    H005: ["M002", "M007", "M003", "M009", "M001", "M004"],
    H008: ["M011", "M004", "M002", "M008", "M009", "M007"],
    // 恢复型：召唤物 / 范围 / 冷却
    H007: ["M010", "M002", "M004", "M007", "M009", "M008"],
  },
  // 抽取权重（可选覆盖；未列出的 ID 视作 1）
  weights: { M001: 8, M002: 8, M003: 7, M004: 7, M005: 6, M006: 4, M007: 4, M008: 6, M009: 9, M010: 5, M011: 5, M012: 6 },
};

/* ---------- 芯片系统（19.6，新增玩法） ----------
 * 芯片 = 装在「芯片背包」里、**只放大主动技能效果**的局内资产（出局消失）。
 * 品质沿用 白/蓝/紫/金 4 档（复用 CFG.itemQualities 的配色与价值系数）。
 * 效果形式：**白蓝 = 纯数值放大；紫金 = 附加行为**（弹射 / 灼烧 / 分裂 等）。
 * 来源：**宝箱 + 商店**（工匠世界金币服务，见 CFG.artisanServices）。 */
CFG.chips = {
  name: "芯片",
  grid: { cols: 6, rows: 5 },       // 芯片背包 6×5（取代旧 CFG.weaponGrid 4×3）
  qualityCount: 4,                  // 白/蓝/紫/金
  lifetime: "inRun",                // "inRun" = 局内资产，出局消失（不做永久资产）
  // 白蓝=数值、紫金=行为；以此决定生成哪类效果
  qualityMode: { 0: "value", 1: "value", 2: "behavior", 3: "behavior" },
  // 数值放大（白/蓝）：对主动技能的哪个参数、放大多少
  valuePool: [
    { id: "C_V_DMG",   name: "增幅晶片", tag: "伤害", mode: "mult", vals: [0.12, 0.20, 0.30, 0.45] },
    { id: "C_V_CD",    name: "循环晶片", tag: "冷却", mode: "mult", vals: [-0.06, -0.10, -0.15, -0.22] },
    { id: "C_V_RANGE", name: "扩散晶片", tag: "范围", mode: "mult", vals: [0.10, 0.16, 0.24, 0.36] },
    { id: "C_V_SPD",   name: "加速晶片", tag: "弹速", mode: "mult", vals: [0.10, 0.16, 0.24, 0.36] },
    { id: "C_V_BULLET",name: "分流晶片", tag: "弹道数量", mode: "flat", vals: [1, 1, 1, 2] },
  ],
  // 附加行为（紫/金）：给主动技能挂上新行为，需代码侧实现对应行为积木
  behaviorPool: [
    { id: "C_B_BOUNCE", name: "折射芯片", behavior: "bounce",  vals: [1, 1, 2, 2], desc: "命中后弹射 N 次" },
    { id: "C_B_BURN",   name: "燃蚀芯片", behavior: "burn",    vals: [3, 5, 8, 12], desc: "命中附加灼烧（每秒 N 伤害，3 秒）" },
    { id: "C_B_SPLIT",  name: "裂变芯片", behavior: "split",   vals: [1, 1, 2, 3], desc: "击杀后分裂出 N 枚小弹" },
    { id: "C_B_CHAIN",  name: "链锁芯片", behavior: "chain",   vals: [1, 1, 2, 2], desc: "命中后向 N 个敌人链接传导" },
  ],
  // 占格：芯片尺寸（背包 6×5 = 30 格）
  shapes: { value: [1, 1], behavior: [2, 1] },
  maxStack: 9,                      // 同名芯片叠加上限（与模块口径一致）
  carryOut: false,                  // 撤离结算时是否折算为结晶（false = 出局直接消失）
  /* 重量系数（19.11.8 已拍板：芯片计入负重，与其余物品一致）——
   * 数值芯片重量 = (q + 1) × weightMul；行为芯片重量 = (q + 1) × 2 × weightMul。
   * ⚠️ 实测手感过重时**只调本系数**，不要单体改每个芯片（见 19.11.8）。 */
  weightMul: 1,
};

/* ---------- 芯片来源：宝箱 / 商店（19.6） ---------- */
CFG.chipSources = {
  chest: { enabled: true, weight: 26, itemQW: [55, 28, 14, 3] },   // 宝箱开出芯片的权重与品质分布
  shop:  { enabled: true, cost: 180, qualityWeights: [50, 30, 16, 4], desc: "芯片工坊购买 1 枚随机芯片" },
};

/* ---------- 局外：卡牌图鉴 → 芯片图鉴（19.7） ---------- */
CFG.chipCodex = {
  name: "芯片图鉴",
  // 芯片为局内资产，图鉴只做"见过的芯片"收集展示，不提供任何属性加成
  permanent: false,
  collectOnly: true,
  perHero: true,                    // 按英雄分别记录已见芯片
};

/* ---------- 工匠世界 → 芯片工坊（19.7） ---------- */
CFG.chipForge = {
  name: "芯片工坊",
  desc: "无敌人安全区：合成 / 升级 / 重铸芯片；卡牌强化服务整体下线",
  services: {
    merge:  { cost: 200, desc: "同名芯片合并 → 等级 +1（上限 9 级）" },
    reroll: { cost: 120, desc: "重掷芯片词条档位（保留品质与类型）" },
    craft:  { cost: 180, desc: "定向合成 1 枚芯片（品质按 CFG.chipSources.shop 权重）" },
  },
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
  spawnPool: "NM0010:40/NM0011:26/NM0012:16/NM0017:10/NM0020:8",   // 一次性投放的怪物池（子地图不按解锁进度过滤，全量开放）；混入已差异化招式的冲锋怪（连突/碾压）
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
 * 升级入口 = 主城「强化导师」（局外等级）/「武器匠」（武器·技能等级）；cost 为升级所需进化结晶（局外货币）。
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
  linkBonus: 0.03,        // 🔴 已废弃（第十九章 19.5）：连接效果随武器栏退场，逻辑侧不再结算（保留字段防报错）
  // 阶段词缀（通用池，按阶段解锁：阶段 n 解锁前 n 条；策划可整体替换）
  stageAffixes: [
    { name: "强化·技能伤害", tag: "伤害", mode: "mult", value: 0.06 },
    { name: "强化·技能冷却", tag: "冷却", mode: "mult", value: -0.05 },
    { name: "强化·技能范围", tag: "范围", mode: "mult", value: 0.06 },
  ],
};

/* ---------- 武器模块套装（16.7 武器模块深度：同系列集齐 N 件触发词缀强化，仅武器栏内计数） ----------
 * 🔴 **已废弃（第十九章 19.5）**：芯片背包取代武器栏后，模块改为「升级 4 选 1 获得 + 槽位限制」，
 * 不再有"同系列集齐 N 件"的摆放博弈；本表保留结构但逻辑侧不再读取。
 * 连接效果（CFG.moduleLevel.linkBonus）**同样废弃**——理由同上（芯片背包不按相邻结算）。 */
CFG.moduleSets = {
  removed: true,
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

/* ---------- 宝箱内容池：品质 → 可开出定义 + 品质权重 ----------
 * 🔴 第十九章 19.5/19.6 变更：
 *   - **武器模块（M* 编号）从宝箱池移除**（模块来源改为「升级 4 选 1」）
 *   - **芯片加入宝箱池**（见 CFG.chipSources.chest，逻辑侧单独结算，不混入本 defs 列表）
 *   - 属性卡牌（C* 编号）同步删除
 * 下表保留旧结构供回退；新逻辑的宝箱产出 = 装备（G*）+ 芯片（CFG.chipSources.chest）。 */
CFG.chestContents = {
  normal:   { defs: ["G001","G003","G006","M003","M004"], itemQW: [70,25,5,0] },
  advanced: { defs: ["G002","G004","G005","M002","M005"], itemQW: [30,45,20,5] },
  epic:     { defs: ["G002","G004","M001","M005","M006"], itemQW: [5,35,45,15] },
  divine:   { defs: ["G001","G002","G004","G007","M001","M005","M006","M007","M010","M011"], itemQW: [0,10,50,40] },
  mythic:   { defs: ["G005","G007","G008","M001","M006","M007","M008","M010","M011","M012"], itemQW: [0,0,30,70] },
};

/* ---------- 背包 / 武器栏 / 重量（9.2） ----------
 * 🔴 第十九章 19.6 变更：
 *   - 搜刮背包 backpack（6×4）保持不变
 *   - 武器栏 weaponGrid **改名「芯片背包」**，尺寸 **4×3 → 6×5**（见 CFG.chips.grid）
 *   - 两者布局：**同屏上下并列**——搜刮背包在上，芯片背包在下
 * 本表 weaponGrid 为旧值，保留供旧代码回退读取；新逻辑请读 CFG.chips.grid。 */
CFG.backpack = { cols: 6, rows: 4 };
CFG.weaponGrid = { cols: 4, rows: 3 };   // 🔴 已弃用尺寸，见 CFG.chips.grid（6×5）
CFG.invLayout = {
  stack: "vertical",        // 同屏上下并列
  top: "backpack",          // 上：搜刮背包（6×4）
  bottom: "chipBag",        // 下：芯片背包（6×5）
};
CFG.weight = { threshold: 100, minFactor: 0.2, slope: 0.8, divisor: 100 };

/* ---------- 死亡惩罚（16.6） ---------- */
CFG.deathPenalty = { loseRatio: 0.7 };

/* ---------- 局外成长（双层等级体系：局外角色等级 + 结晶材料，数值暂定） ----------
 * 🔴 19.8 已定（结晶双来源并存）：
 *   来源① = 击杀 BOSS 直接得结晶（crystalBoss）
 *   来源② = 撤离成功 → 携带物品**彻底折算**（CFG.settleConvert）
 *   小怪击杀不再直接给结晶（crystalKill 退役——避免刷怪绕过「搜刮→撤离」主循环，稀释搜刮激励）。
 * ⚠️ 本批为「配置+文档」阶段：crystalKill 的值暂不动（维持现状行为，现有逻辑与测试仍读取），
 *    逻辑实现阶段（第 1 步）一并移除读取；**新代码禁止再引用 crystalKill**。 */
CFG.outLevel = {
  maxLevel: 10,
  costBase: 50, costStep: 40,          // 旧线性公式（兼容回落值）：LV n→n+1 = costBase + (n-1)*costStep
  growthRate: 1.3,                     // 指数曲线（20.10 重新配平）：LV n→n+1 = round(costBase * growthRate^(n-1))；缺省回落旧线性
                                       //   1.3 使满级累计 1602 结晶（旧 1.8 为 12336，过陡）。
                                       //   取 1.3 的目标：升满一个角色 ≈ 21 局（见「配平口径」注释）。
  growth: { hp: 8, atk: 2, def: 1 },   // 旧线性每级成长（兼容回落值；也是 growthByRole 缺定位时的默认）
  growthTable: [                       // 分段加速表（方向3 新增）：升到 LV n 的每级成长 = 定位成长 × 该段 mul
    { upTo: 3, mul: 1.0 },             //   LV1~3 平缓期 ×1.0
    { upTo: 6, mul: 1.35 },            //   LV4~6 加速期 ×1.35
    { upTo: 10, mul: 1.8 },            //   LV7~10 陡峭期 ×1.8
  ],                                   // ⚠️ 数组缺失/为空时回落旧线性（兼容老配置）
  growthByRole: {                      // 按定位差异化成长（方向3 新增）：输出偏 atk、防御偏 hp/def；缺定位回落 growth
    output:   { hp: 8,  atk: 2, def: 1 },
    defense:  { hp: 12, atk: 1, def: 2 },
    recovery: { hp: 10, atk: 2, def: 1 },
  },
  crystalKill: 1,                      // 🔴 已退役（19.8）：小怪击杀不给结晶，保留值仅为兼容现有逻辑
  crystalBoss: 60,                     // ✅ 来源①：击杀 BOSS 直接得结晶（20.10 30→60，配平后与折算源同量级）
  deathRatio: 0.3,                     // 死亡仅保留 30% 本局结晶（沿用原规则，逻辑阶段统一结算）
};
/* ---------- 配平口径（20.10 重新配平，产出与花费同源） ----------
 * 结晶**来源**（唯一入口 Meta.awardRun + 撤离折算，无散落魔法数字）：
 *   ① crystalBoss = 60        —— 击杀 BOSS（一局通常 1 只）
 *   ② settleConvert.valueRate —— 撤离把剩余物资价值折算为结晶（典型剩余 ≈ 30 价值）
 *   ③ 死亡：BOSS 结晶 × deathRatio（0.3），折算不发生
 * **单局预期产出** = crystalBoss + 30 价值 × valueRate = 60 + 15 = 75 结晶。
 * **满级累计花费** = Σ outLevelCost(1..9) = 1602 结晶（growthRate 1.3 / costBase 50）。
 * **升满预期局数** = 1602 / 75 ≈ 21 局（落在设计目标 15~25 局的舒适区）。
 * 任一数值改动都会使 out_level_flow_test.js 的「配平自检」报警。 */

/* ---------- 属性卡牌（8.3：升级获得资产、仅工匠世界使用、池内同属性去重） ----------
 * 🔴 **已废弃（第十九章 19.7：属性卡牌整体删除）**——保留本表仅为避免运行时引用报错，
 * 逻辑侧已不再读取。卡牌的「局内升级加属性」职能并入 CFG.levelUp.baseStatGain，
 * 卡牌的「4 档品质构筑」职能由 CFG.chips（芯片）取代。新代码禁止再引用 CFG.cardPool。 */
CFG.cardPool = {
  /* 🔴 已废弃（第十九章 19.7）：整表退役，逻辑侧不再读取。删表会连带炸 settleConvert/artisanServices，
     故保留结构；仅在确认无引用后再物理删除。 */
  removed: true,
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
 * ✅ 19.8 已定：本表是**结晶来源②**（撤离彻底折算），与来源①（击杀 BOSS，crystalBoss）**并存**。
 * 双层等级体系闭环：局内资产**不作为物品带出**（16.6），撤离时把**背包 / 武器栏内所有物品**
 * 按其**固定价值**统一折算为进化结晶 —— 不再按类别用不同比例（旧的"宝箱 ×0.5 / 装备武器模块 ×0.25 /
 * 卡牌固定 2"三套口径已作废）。
 * 统一口径：结晶 = Σ(物品固定价值) × valueRate（`valueRate 0.5` 即「2 价值 = 1 结晶」）。
 * 物品固定价值来源：宝箱 = CFG.chestQualities[].value；装备 = 30×品质系数；武器模块 = 45×品质系数；
 * 消耗品（保险契约 / 诅咒道具）= 各自 CFG 里的 value；属性卡牌资产 = cardValue（走同一折算率）。
 * 未开封宝箱同样不带出本体，但价值照常折算（它就在背包里，占 1 格）。
 * **局内经验与金币一律归零、不参与折算**（死亡时同样不折算，见 6.5）。 */
CFG.settleConvert = {
  valueRate: 0.5,         // 统一折算率（= 结晶来源②）：物品固定价值 × 本率 = 结晶（全类别一致，2 价值 = 1 结晶）
                          //   配平口径见 CFG.outLevel 末尾注释：典型单局剩余物资 ≈ 30 价值 → 15 结晶
  cardValue: 4,           // 🔴 已废弃（第十九章 19.7）：属性卡牌删除，本项不再参与折算
  chipValue: 0,           // 🔴 芯片不折算（CFG.chips.carryOut = false，出局直接消失）
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
 * 强化物品 = 消耗金币的物品强化/购买服务（4.6）；全部走本表，策划改价即调。
 * 🔴 第十九章 19.7 变更：工匠世界 → **芯片工坊**（CFG.chipForge）。
 *   - **下线**：卡牌相关服务（本表原有"洗卡牌/买卡牌"类入口）、buyModule（模块不再可购买）
 *   - **新增**：芯片相关服务（CFG.chipForge.services，逻辑侧走该表）
 *   - **保留**：buyInsurance / buyChest / rerollModule→改由芯片 reroll 承担 / qualityUp（装备品质） */
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

/* ========== 方向 3：局外成长——英雄解锁（追加区块，勿并入上方各表） ==========
 * 规划共 **12 个角色，首发解锁前 6 个**；CFG.heroes 现为 12 个（H001~H012，批次 F 已补齐铺量角），
 * H009~H012 已追加进 unlockOrder 并各自配置 unlockRules。
 * 解锁规则（isHeroUnlocked，见 game.js 末尾区块）：
 *   - unlockOrder 前 starterCount 个 = 首发默认解锁；
 *   - 其余按 CFG.unlockRules[id]：heroLv 条件（指定英雄局外等级达标即解锁）或
 *     crystal 条件（花结晶主动解锁，走 Meta.unlockHero）；两条都不配 = 暂不可解锁。 */
CFG.unlockOrder = ["H001", "H002", "H003", "H004", "H005", "H006", "H007", "H008", "H009", "H010", "H011", "H012"];
CFG.starterCount = 6;                  // 首发 6 角默认解锁
CFG.unlockRules = {
  // H007/H008 为原型验证角（批次 E），按注释「后续按设计再作解锁门槛」落地：
  H007: { heroLv: { heroId: "H006", lv: 3 }, desc: "重炮手（H006）局外达到 LV3 后解锁召唤师" },
  H008: { crystal: 300, desc: "主城花费 300 结晶解锁陷阱师" },
  // 铺量角（批次 F）：解锁条件多样化——heroLv 达标 / 结晶消耗混合，均为 isHeroUnlocked 已支持的类型
  H009: { heroLv: { heroId: "H004", lv: 5 }, desc: "弹射手（H004）局外达到 LV5 后解锁守护者" },
  H010: { crystal: 500, desc: "主城花费 500 结晶解锁医疗兵" },
  H011: { heroLv: { heroId: "H010", lv: 6 }, desc: "医疗兵（H010）局外达到 LV6 后解锁圣歌者" },
  H012: { crystal: 800, desc: "主城花费 800 结晶解锁灵能者" },
};

/* ========== 方向 4：撤离压力设计（追加区块，勿并入 1096 行附近的 CFG.extract 基础字段） ==========
 * ① 撤离读条波次：开始读条（extractChanneling false→true）时逐波刷怪围攻，强度随波数递增
 *    （第 N 波数量 = waveSizeBase + waveSizeGrowth×(N-1)，每 waveInterval 秒一波）；
 *    读条结束/打断 → 停止刷怪。怪池与 spawnWave 同源（刷怪圆模板池 → 关卡 spawnPool 回退）。
 * ② 负重权衡：负重越高 → 撤离读条时间越长（读条速率打折，等效拉长时长）。
 *    实际读条秒数 = channel × min(weightTimeScaleMax, 1 + weightSlopePer100 × max(0, 负重- weightThreshold)/100)。
 *    纯函数 extractChannelSeconds（game.js 末尾区块）可测。 */
CFG.extract.enabled = true;              // 总开关：false = 完全回退旧行为（无机制等价性）
CFG.extract.waveEnabled = true;          // 读条期间波次刷怪
CFG.extract.waveFirstDelay = 0;          // 开始读条到第 1 波的间隔（秒，0 = 立即刷第 1 波）
CFG.extract.waveInterval = 2.5;          // 每波固定间隔（秒）
CFG.extract.waveSizeBase = 2;            // 第 1 波数量
CFG.extract.waveSizeGrowth = 1;          // 每波数量增量（第 N 波 = base + growth×(N-1)）
CFG.extract.waveEliteChance = 0.08;      // 波次怪物精英化概率（applyElite 词缀）
CFG.extract.waveSpawnRadius = 420;       // 围绕雕像的刷怪半径（> spawnRules.minDistFromPlayer=300，防贴脸刷出）
CFG.extract.weightPenaltyEnabled = true; // 负重 → 读条时长惩罚
CFG.extract.weightThreshold = 100;       // 负重免罚门槛（与 CFG.weight.threshold 同口径）
CFG.extract.weightSlopePer100 = 0.25;    // 每超出 100 点负重，读条时长 +25%
CFG.extract.weightTimeScaleMax = 2.0;    // 读条时长最大倍率（封顶，防极端背包死锁撤离）
/* 护盾围攻（压力载体）：波次怪读条期间**只啃雕像护盾、不伤害英雄**（不打断读条——
 * 门禁 runtime_test 需要站桩 8s 必然撤离成功，怪伤英雄 = 读条重置 = 永远撤不走）；
 * 读条一旦中断（离圈/受击/护盾破碎），波次怪立刻交还普通 AI 追击英雄（真实威胁）。
 * 贪心压力 = 护盾持续被啃：不清理围攻怪 → 护盾破碎 → 读条冻结，直到清怪恢复。 */
CFG.extract.siegeRingRadius = 140;       // 波次怪围攻停留半径（雕像判定圈 120 外侧）
CFG.extract.siegeDpsMul = 1.5;           // 围攻啃盾 DPS 倍率（× m.atk）
CFG.extract.shieldMax = 2000;            // 雕像护盾上限（约 3 倍于整次读条的最坏啃盾量）
CFG.extract.shieldRecoverPct = 0.5;      // 护盾破碎后恢复到该比例才解锁读条
CFG.extract.shieldRegenPerSec = 120;     // 再生速率（围攻怪清空后）
CFG.extract.shieldRegenDelay = 3.0;      // 脱离围攻后开始再生的延迟（秒）

/* ========== 方向 5：音频扩展——BGM 开关与音量（追加字段，勿动上方 CFG.audio 原有区块） ========== */
CFG.audio.bgmEnabled = true;   // 战斗 BGM 独立开关（关掉只静 BGM，音效不受影响）
CFG.audio.bgmVolume = 0.28;    // BGM 总线增益（挂 SFX.master 之下，0.2~0.35 区间，不盖过音效）

/* ============================================================================
 * 实战手感调参：关卡难度曲线总表（单一事实源，分段手调表）
 * ----------------------------------------------------------------------------
 * 定位：10 关难度的**集中调参基准**。怪物数量/血量倍率是策划手调的总览值
 * （运行时由 CFG.levels 的 monsterLevel / eliteBase / progressGoal 分散表达，
 * 逻辑侧暂不读本表）；毒圈/补给/宝箱档位表是**实际数值源**，
 * 各关 CFG.levels[x].hazard / .supply 覆盖必须与本表对应档位一致
 * （CFG._validateLevelCurve 会做一致性核对，改档位后请同步关卡覆盖）。
 *
 * 压力口径（毒圈）：
 *   基准血量 100（H001~H012 满血 85~120 的中位）；受伤公式 dmg - def（防御只会更长命，安全侧）；
 *   满血站毒目标区间 8~15 秒致命（tick 量化后逐关实测见档位注释）。
 *   现行实现为「单次线性收缩」（无多圈轮次字段），故压迫感三要素 =
 *   startDelay 预警期（12~20s，随关卡递减 = 走位/撤离准备时间缩短）+
 *   shrinkDuration 总收缩时长（递减 = 收缩提速）+ minRadius 终圈（递减 = 安全区更小）。
 * 节奏设计：LEVEL_007 为**休整关**（机制关闭）——连续高压之间留喘息点，防劝退；
 *   曲线倍率仍连续无断崖（countMul/hpMul 逐关小步抬升）。
 * ============================================================================ */
CFG.levelCurve = {
  /* ---- 10 关分段表（逐行手调；hazard/supply = 档位 key，null = 该关不启用机制） ---- */
  rows: [
    // lv  countMul(怪物数量压力)  hpMul(怪物血量)  hazard(毒圈档)  supply(补给档)  chest(宝箱档)
    { lv: 1,  countMul: 1.00, hpMul: 1.00, hazard: null,  supply: null,  chest: "CT1" },
    { lv: 2,  countMul: 1.12, hpMul: 1.12, hazard: null,  supply: null,  chest: "CT1" },
    { lv: 3,  countMul: 1.25, hpMul: 1.24, hazard: null,  supply: null,  chest: "CT2" },
    { lv: 4,  countMul: 1.38, hpMul: 1.36, hazard: null,  supply: null,  chest: "CT2" },
    { lv: 5,  countMul: 1.50, hpMul: 1.48, hazard: "HZ1", supply: "SP1", chest: "CT2" },
    { lv: 6,  countMul: 1.65, hpMul: 1.60, hazard: "HZ2", supply: "SP2", chest: "CT3" },
    { lv: 7,  countMul: 1.80, hpMul: 1.72, hazard: null,  supply: null,  chest: "CT3" },   // 休整关：机制关闭，倍率曲线保持连续
    { lv: 8,  countMul: 1.95, hpMul: 1.84, hazard: "HZ3", supply: "SP3", chest: "CT3" },
    { lv: 9,  countMul: 2.10, hpMul: 1.96, hazard: "HZ4", supply: "SP4", chest: "CT4" },
    { lv: 10, countMul: 2.25, hpMul: 2.08, hazard: "HZ5", supply: "SP5", chest: "CT4" },
  ],

  /* ---- 毒圈档位（值 = 关卡 hazard 覆盖的权威来源）----
   * 21.1 口径变更：伤害改为**最大生命的固定比例**（dmgPercent，全部档位统一 1%），
   * 档位间差异只体现在 tickInterval（扣血频率）与收缩节奏 —— 即「同样每口 1%，但咬得更勤」。
   * ttk = 满血站毒致命秒数 = 100 / (dmgPercent × 100 / tickInterval)。
   * 设计意图逐档：预警期 -2s/档、收缩提速、终圈收紧，DPS 1%/s → 1.25%/s 严格递增。
   * dmgPerTick 为遗留字段（旧绝对值口径），保留供旧配置/旧测试读取，不参与结算。 */
  hazardTiers: {
    HZ1: { name: "教学档", startDelay: 20, shrinkDuration: 85, minRadius: 380, tickInterval: 1.0, dmgPercent: 0.01, dmgPerTick: 7 },   // 1.00%/s  ttk 100s
    HZ2: { name: "进阶档", startDelay: 18, shrinkDuration: 75, minRadius: 350, tickInterval: 1.0, dmgPercent: 0.01, dmgPerTick: 8 },   // 1.00%/s  ttk 100s
    HZ3: { name: "压迫档", startDelay: 16, shrinkDuration: 65, minRadius: 330, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 8 },   // 1.25%/s  ttk  80s
    HZ4: { name: "高压档", startDelay: 14, shrinkDuration: 60, minRadius: 310, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 9 },   // 1.25%/s  ttk  80s
    HZ5: { name: "终局档", startDelay: 12, shrinkDuration: 55, minRadius: 290, tickInterval: 0.8, dmgPercent: 0.01, dmgPerTick: 10 },  // 1.25%/s  ttk  80s
  },

  /* ---- 补给档位（值 = 关卡 supply 覆盖的权威来源）----
   * 设计意图：数量 3→1、读条 2.5→4.0s、治疗 25%→15% 全部单调走向稀缺；
   * L6 转增益 / L9 转结晶，避免后期「无限奶站撸毒圈」，又不至于完全没收益。 */
  supplyTiers: {
    SP1: { name: "教学档·慷慨", count: 3, channelSeconds: 2.5, effect: { type: "heal", pct: 0.25 } },
    SP2: { name: "进阶档·增益", count: 2, channelSeconds: 3.0, effect: { type: "buff", buffPool: "war", duration: 20 } },
    SP3: { name: "压迫档·缩水", count: 2, channelSeconds: 3.0, effect: { type: "heal", pct: 0.20 } },
    SP4: { name: "高压档·资源", count: 2, channelSeconds: 3.5, effect: { type: "crystal", amount: 50 } },
    SP5: { name: "终局档·稀缺", count: 1, channelSeconds: 4.0, effect: { type: "heal", pct: 0.15 } },
  },

  /* ---- 宝箱档位（品质权重基准，对齐 CFG.chestQualities 的五阶 key）----
   * 设计意图：高阶（divine+mythic）占比 3%→16% 单调抬升；CT2 = 现行祭坛宝箱（ALTAR_003）基准。 */
  chestTiers: {
    CT1: { name: "前期档",   weights: { normal: 55, advanced: 30, epic: 12, divine: 3,  mythic: 0 } },
    CT2: { name: "中期档",   weights: { normal: 48, advanced: 28, epic: 16, divine: 6,  mythic: 2 } },
    CT3: { name: "中后期档", weights: { normal: 40, advanced: 28, epic: 20, divine: 9,  mythic: 3 } },
    CT4: { name: "后期档",   weights: { normal: 34, advanced: 28, epic: 22, divine: 12, mythic: 4 } },
  },
};

/* ---------- 配置一致性自检（纯函数，不依赖 DOM，不抛错） ----------
 * 用法：CFG._validateLevelCurve() → { ok: true/false, issues: [字符串…] }。
 * 检查面：曲线表结构 / 倍率单调不减 / 毒圈与补给的数值区间 / 档位 key 存在 /
 * 关卡覆盖与档位值一致 / 补给相对毒伤不失衡 / 宝箱高阶占比单调抬升。 */
CFG._validateLevelCurve = function () {
  const issues = [];
  try {
    const num = (v) => typeof v === "number" && isFinite(v);
    const lv = CFG.levels;
    if (!Array.isArray(lv) || lv.length < 10) { issues.push("CFG.levels 缺失或少于 10 关"); return { ok: false, issues: issues }; }
    const curve = CFG.levelCurve;
    if (!curve || !Array.isArray(curve.rows) || curve.rows.length !== 10) { issues.push("levelCurve.rows 必须为 10 行"); return { ok: false, issues: issues }; }

    // ---- 1. 倍率：数值合理 + 单调不减 ----
    let prevCount = 0, prevHp = 0;
    for (let i = 0; i < curve.rows.length; i++) {
      const r = curve.rows[i];
      if (r.lv !== i + 1) issues.push("rows[" + i + "].lv 应为 " + (i + 1));
      if (!num(r.countMul) || r.countMul <= 0 || r.countMul > 10) issues.push("第" + r.lv + "关 countMul 超界: " + r.countMul);
      if (!num(r.hpMul) || r.hpMul <= 0 || r.hpMul > 10) issues.push("第" + r.lv + "关 hpMul 超界: " + r.hpMul);
      if (r.countMul < prevCount) issues.push("第" + r.lv + "关 countMul 单调回落: " + prevCount + "→" + r.countMul);
      if (r.hpMul < prevHp) issues.push("第" + r.lv + "关 hpMul 单调回落: " + prevHp + "→" + r.hpMul);
      prevCount = r.countMul; prevHp = r.hpMul;
    }

    // ---- 2. 毒圈档位：数值区间 + 递增压力 + 与关卡覆盖一致 ----
    const HZ = curve.hazardTiers;
    let prevDps = 0, prevDelay = Infinity, prevMinR = Infinity;
    for (let i = 0; i < 10; i++) {
      const r = curve.rows[i], L = lv[i], key = r.hazard;
      if (!!L.hazardEnabled !== (key != null)) { issues.push("第" + (i + 1) + "关 hazard 开关与曲线档位不一致"); continue; }
      if (key == null) continue;
      const t = HZ[key];
      if (!t) { issues.push("毒圈档位 key 不存在: " + key); continue; }
      if (!num(t.startDelay) || t.startDelay < 5 || t.startDelay > 60) issues.push(key + " startDelay 超界: " + t.startDelay);
      if (!num(t.shrinkDuration) || t.shrinkDuration < 10 || t.shrinkDuration > 300) issues.push(key + " shrinkDuration 超界: " + t.shrinkDuration);
      if (!num(t.minRadius) || t.minRadius < 50 || t.minRadius > 960) issues.push(key + " minRadius 超界: " + t.minRadius);
      if (!num(t.tickInterval) || t.tickInterval < 0.1 || t.tickInterval > 5) issues.push(key + " tickInterval 超界: " + t.tickInterval);
      // 21.1 口径：dmgPercent 为权威（每 tick 扣最大生命的比例）；dmgPerTick 为遗留字段仅保留结构
      if (!num(t.dmgPercent) || t.dmgPercent <= 0 || t.dmgPercent > 0.05) issues.push(key + " dmgPercent 超界（应为 0~5% 之间的正数）: " + t.dmgPercent);
      const dps = t.dmgPercent / t.tickInterval;                    // 每秒扣最大生命的比例
      const ttk = (1 / t.dmgPercent) * t.tickInterval;              // 满血站毒致命秒数（与血量无关）
      if (dps < 0.005 || dps > 0.05) issues.push(key + " 毒圈每秒比例超界: " + dps);
      if (ttk < 60 - 1e-9 || ttk > 120 + 1e-9) issues.push(key + " 满血站毒 " + ttk.toFixed(1) + "s 出 60~120s 压力带");
      if (dps < prevDps) issues.push("毒圈每秒比例未随关卡递增: 第" + i + "档→" + key);
      if (t.startDelay > prevDelay) issues.push("毒圈预警期未随关卡缩短: " + key);
      if (t.minRadius > prevMinR) issues.push("毒圈终圈未随关卡收紧: " + key);
      prevDps = dps; prevDelay = t.startDelay; prevMinR = t.minRadius;
      // 与 CFG.levels 覆盖逐字段核对（合并全局缺省后比对）
      const m = {};
      const base = CFG.hazard || {}, ov = L.hazard || {};
      const fields = ["startDelay", "shrinkDuration", "minRadius", "tickInterval", "dmgPercent"];
      for (const f of fields) m[f] = ov[f] != null ? ov[f] : base[f];
      for (const f of fields) if (m[f] !== t[f]) issues.push("第" + (i + 1) + "关 hazard." + f + "=" + m[f] + " 与档位 " + key + " 不一致（应同步曲线表）");
    }

    // ---- 3. 补给档位：数值区间 + 稀缺化单调 + 与关卡覆盖一致 + 不失衡 ----
    const SP = curve.supplyTiers;
    let prevCnt = Infinity, prevChan = 0, prevHeal = Infinity;
    for (let i = 0; i < 10; i++) {
      const r = curve.rows[i], L = lv[i], key = r.supply;
      if (!!L.supplyEnabled !== (key != null)) { issues.push("第" + (i + 1) + "关 supply 开关与曲线档位不一致"); continue; }
      if (key == null) continue;
      const t = SP[key];
      if (!t) { issues.push("补给档位 key 不存在: " + key); continue; }
      if (!num(t.count) || t.count < 1 || t.count > 3) issues.push(key + " count 超界（1~3）: " + t.count);
      if (!num(t.channelSeconds) || t.channelSeconds < 1 || t.channelSeconds > 6) issues.push(key + " channelSeconds 超界: " + t.channelSeconds);
      const ef = t.effect || {};
      let healAmt = 0;
      if (ef.type === "heal") { if (!num(ef.pct) || ef.pct <= 0 || ef.pct > 0.5) issues.push(key + " heal pct 超界(0~0.5]: " + ef.pct); healAmt = 100 * (ef.pct || 0); }
      else if (ef.type === "buff") { if (!CFG[(ef.buffPool || "") + "Buffs"] || !CFG[ef.buffPool + "Buffs"].length) issues.push(key + " buffPool 无效: " + ef.buffPool); if (!num(ef.duration) || ef.duration <= 0 || ef.duration > 120) issues.push(key + " buff duration 超界: " + ef.duration); }
      else if (ef.type === "crystal") { if (!num(ef.amount) || ef.amount <= 0 || ef.amount > 200) issues.push(key + " crystal amount 超界: " + ef.amount); }
      else issues.push(key + " effect.type 未知: " + ef.type);
      if (t.count > prevCnt) issues.push("补给数量未随关卡稀缺化: " + key);
      if (t.channelSeconds < prevChan) issues.push("补给读条未随关卡变长: " + key);
      if (ef.type === "heal" && healAmt >= prevHeal) issues.push("补给回血未随关卡缩水: " + key);
      prevCnt = t.count; prevChan = t.channelSeconds; if (ef.type === "heal") prevHeal = healAmt;
      // 失衡检查：单点回血 ≤ 30s 毒伤、全关补给池 ≤ 90s 毒伤（毒圈未开时跳过）
      const hzKey = r.hazard;
      if (healAmt > 0 && hzKey && HZ[hzKey]) {
        // 21.1 比例口径：dps 为每秒扣最大生命的比例 → 转成「每秒绝对值」再与回血比较（等价于按基准血量 HP100）
        const dps = HZ[hzKey].dmgPercent / HZ[hzKey].tickInterval * 100;
        if (healAmt > dps * 30) issues.push(key + " 单点回血 " + healAmt + " 超过 30s 毒伤（站撸失衡）");
        if (t.count * healAmt > dps * 90) issues.push(key + " 全关补给池超 90s 毒伤（无限奶失衡）");
      }
      // 与 CFG.levels 覆盖核对
      const ov = L.supply || {}, base = CFG.supply || {};
      const cnt = ov.count != null ? ov.count : base.count;
      const chan = ov.channelSeconds != null ? ov.channelSeconds : base.channelSeconds;
      const efv = ov.effect || base.effect;
      if (cnt !== t.count) issues.push("第" + (i + 1) + "关 supply.count=" + cnt + " 与档位 " + key + " 不一致");
      if (chan !== t.channelSeconds) issues.push("第" + (i + 1) + "关 supply.channelSeconds=" + chan + " 与档位 " + key + " 不一致");
      if (!efv || efv.type !== ef.type || (ef.type === "heal" && efv.pct !== ef.pct)
        || (ef.type === "buff" && (efv.buffPool !== ef.buffPool || efv.duration !== ef.duration))
        || (ef.type === "crystal" && efv.amount !== ef.amount)) issues.push("第" + (i + 1) + "关 supply.effect 与档位 " + key + " 不一致");
    }

    // ---- 4. 宝箱档位：key 存在 + 权重合法 + 高阶占比单调抬升 ----
    const CT = curve.chestTiers, okKeys = CFG.chestQualities ? Object.keys(CFG.chestQualities) : [];
    let prevHigh = -1;
    for (let i = 0; i < 10; i++) {
      const r = curve.rows[i];
      const t = CT[r.chest];
      if (!t) { issues.push("宝箱档位 key 不存在: " + r.chest); continue; }
      const w = t.weights || {};
      let sum = 0, high = 0;
      for (const k in w) {
        if (okKeys.indexOf(k) < 0) { issues.push(r.chest + " 权重 key 不在 chestQualities: " + k); continue; }
        if (!num(w[k]) || w[k] < 0) issues.push(r.chest + " 权重非法: " + k + "=" + w[k]);
        sum += w[k];
        if (k === "divine" || k === "mythic") high += w[k];
      }
      if (sum <= 0) issues.push(r.chest + " 权重总和为 0");
      const share = sum > 0 ? high / sum : 0;
      if (share < prevHigh - 1e-9) issues.push("宝箱高阶占比未随关卡抬升: 第" + (i + 1) + "关");
      prevHigh = share;
    }

    // ---- 5. 全局缺省（CFG.hazard / CFG.supply）兜底区间 ----
    const gh = CFG.hazard || {};
    if (!num(gh.dmgPercent) || gh.dmgPercent <= 0 || gh.dmgPercent > 0.05) issues.push("CFG.hazard.dmgPercent 超界（应为 0~5% 正数）: " + gh.dmgPercent);
    if (!num(gh.tickInterval) || gh.tickInterval < 0.1 || gh.tickInterval > 5) issues.push("CFG.hazard.tickInterval 超界: " + gh.tickInterval);
    const gs = CFG.supply || {};
    if (!num(gs.count) || gs.count < 1 || gs.count > 3) issues.push("CFG.supply.count 超界: " + gs.count);
    if (!num(gs.channelSeconds) || gs.channelSeconds < 1 || gs.channelSeconds > 6) issues.push("CFG.supply.channelSeconds 超界: " + gs.channelSeconds);
  } catch (e) {
    issues.push("自检过程异常: " + (e && e.message ? e.message : String(e)));   // 防御：绝不向外抛
  }
  return { ok: issues.length === 0, issues: issues };
};
