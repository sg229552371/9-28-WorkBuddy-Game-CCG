# 技能系统 · 跨文件接口冻结 v1.0（W0 产出）

> 🔤 **命名（2026-10-12 统一）**：本文的「水晶 / 技能」= **能量水晶**（代码 `CR_*` / `crystalDefs`，**标识符不变**）。
> 命名规范见 `skill_system_master_v1.md` §0.5。

日期：2026-10-11。状态：**接口冻结，禁止在未更新本文的情况下擅自改动跨文件签名**。
真源：`skill_system_development_contract_v1.0.md`（工程合同） + `design_crystal_skill_system_v0.5.md`（规格）。
优先级：用户铁律 > 合同 > v0.5 > 旧设计与注释。

> 本文解决合同 §16「多 AI 并行必须先约定文件所有权」的落地问题：
> 把合同 §4 建议的单文件 `skill-system.js` **拆成 9 个独立文件**（用户已拍板），
> 冻结跨文件契约后即可 9 路并行开发。合同 §4 的「模块 → 输入/输出/禁止承担」边界**不变**。

---

## 一、文件清单与所有权（9 文件）

加载顺序 = 下表从上到下，**统一插在 `index.html` 的 `js/main.js` 之前**（即所有既有脚本之后，`main.js` 之前）。
理由：这些文件要调用 `CFG / G / U / combat.js 的 damageMonster / items.js 的 computeStats`，且 `main.js` 是宿主与主循环，必须最后加载。

| # | 文件 | 全局符号 | 合同 §4 模块 | 独占所有权 |
|---|---|---|---|---|
| 1 | `js/skill-config.js` | `SkillConfig` | SkillConfig | W1 |
| 2 | `js/skill-compiler.js` | `SupportCompiler` | SupportCompiler | W2 |
| 3 | `js/skill-damage.js` | `SkillDamage` | DamageResolver | W3a |
| 4 | `js/skill-events.js` | `SkillEvents` | SkillEventRouter | W3a |
| 5 | `js/skill-scheduler.js` | `SkillScheduler` | SkillScheduler | W3b |
| 6 | `js/skill-runtime.js` | `SkillRuntime` | EffectRuntime | W3b |
| 7 | `js/skill-reward.js` | `SkillReward` | SkillRewardService | W4a |
| 8 | `js/skill-presenter.js` | `SkillPresenter` | SkillPresenter | W4b |
| 9 | `js/skill-save.js` | `SkillSave` | SkillSaveAdapter | W4b |

**共享文件（唯一集成者 = 主会话串行写入，别人一律不准动）**：
`index.html`、`js/config.js`、`js/game.js`、`js/main.js`、`js/combat.js`、`js/items.js`、`js/modes.js`、`run_tests.sh`、`css/style.css`。
并行波次**只允许新建自己的 `js/skill-*.js` 与自己的 `*_test.js`**；接入点改动全部由主会话在 W6 串行完成。

---

## 二、编号与命名规范（冻结）

| 类别 | 命名 | 示例 | 说明 |
|---|---|---|---|
| 技能定义 ID | `SK_*` | `SK_FIREBALL`、`SK_SHOCKWAVE` | 稳定字符串，发布后不可复用 |
| 效果模板 ID | `TP_*` | `TP_FLIGHT_PROJECTILE` | 首批 4 个 |
| 水晶定义 ID | `CR_*` | `CR_PIERCE`、`CR_MULTISHOT` | 同名合并升级按 **ID** 判定 |
| 品质 ID | `Q_*` | `Q_COMMON` | 档数由 `qualityDefs` 数组长度决定，**禁止写死** |
| 奖励池 ID | `POOL_*` | `POOL_FIREBALL` | 获取池只控来源与权重 |
| 策略 ID | `HP_* / SP_* / EP_* / BP_*` | `HP_MAIN_BOLT` | hit / stack / event / budget |
| 原因码 | 大写下划线 | `SLOTS_FULL` | 见第五节，业务**不得**依赖中文文案判分支 |

单位（合同 §6 / v0.5 §9）：时间=秒，角度=度，距离=世界单位，概率=0~1，数量=非负整数，倍率 1=无变化。禁止 NaN / Infinity / 隐式字符串转数值。

---

## 三、冻结的跨文件 API（合同 §7 对应表）

> 合同 §7 的名称可调整，但**职责与返回信息不得丢失**。下表左列 = 主会话对外暴露的顶层函数（其余模块调用它们）；
> 右列 = 各文件内部实现。**并行开发时一律调用顶层函数名，不得直接调内部实现。**

| 合同 §7 顶层 API | 实现文件 | 返回 |
|---|---|---|
| `validateSkillConfig(raw)` | SkillConfig | `{ ok, definitions, diagnostics }` |
| `compileSupportGroup(input)` | SupportCompiler | `{ ok, builds, explanations, diagnostics, signature }` |
| `previewCrystalChange(state, change)` | SupportCompiler | `{ legal, nextGroup, result, reasonCodes }` |
| `createCastSnapshot(hero, build, stats, castId)` | SkillScheduler | 只读 `CastSnapshot` |
| `updateHeroSkills(world, hero, dt)` | SkillRuntime | `{ requests, spawned, derived }` |
| `spawnEffect(world, snapshot, nodeId, spawnContext)` | SkillRuntime | `{ accepted, effectId, reason }` |
| `resolveSkillDamage(world, damageRequest)` | SkillDamage | `{ applied, amount, killed, reason }` |
| `enqueueSkillEvent(world, event)` | SkillEvents | `{ accepted, eventId, reason }` |
| `buildSkillRewards(state, source, rng)` | SkillReward | `RewardTransaction` |
| `commitSkillReward(state, rewardId, optionId)` | SkillReward | `{ committed, nextState, reason }` |
| `serializeHeroSkills(state)` | SkillSave | 可序列化对象 |
| `migrateHeroSkills(saved, definitions)` | SkillSave | `{ state, report, preservedOriginal }` |

以上 12 个函数名，**由集成者在 `js/skill-config.js` 末尾统一挂到 `window`**（文件内部先定义成自己的模块对象方法）；
并行开发阶段各文件**自己定义自己的顶层函数**，重名冲突由文件所有权保证（每个函数只在一个文件里定义）。

**模块对象命名空间（供 UI / 测试 / 主循环调用）**：

```js
SkillConfig.validate(raw) / SkillConfig.get(kind, id) / SkillConfig.version() / SkillConfig.Reason
SupportCompiler.compile(input) / SupportCompiler.preview(state, change) / SupportCompiler.skillLevelOf(state)
SkillScheduler.tick(world, hero, dt) / SkillScheduler.createSnapshot(hero, build, stats, castId)
SkillRuntime.updateAll(world, dt) / SkillRuntime.updateHeroSkills(world, hero, dt)
SkillRuntime.spawnEffect(world, snapshot, nodeId, ctx) / SkillRuntime.ownsHero(hero)
SkillDamage.resolve(world, req) / SkillDamage.applyHitPolicy(...)
SkillEvents.enqueue(world, ev) / SkillEvents.drain(world) / SkillEvents.emit(...)
SkillReward.build(state, source, rng) / SkillReward.commit(state, rewardId, optionId)
SkillPresenter.panel(state, heroId) / SkillPresenter.explain(build) / SkillPresenter.detail(crystalId, heroId)
SkillSave.serialize(state) / SkillSave.migrate(saved, definitions) / SkillSave.saveTo(meta) / SkillSave.loadFrom(meta)
```

> **增补（2026-10-12，W1「技能等级 = 武器等级」接线）**：新增
> **`SupportCompiler.skillLevelOf(state) → number`**（**纯函数**：只读入参 `state`，不读 `CFG` / `Meta`）。
> 语义 = 取该英雄现有技能等级（按技能 ID 规范排序取第一个有效值），无技能 / 无效 → `1`。
> 用途：新装技能（稀有技能）**继承本英雄已有技能等级**；`preview({kind:"installSkill"})`、
> `SkillReward._applySkillInstall`、`SkillPlaytest._installRareSkill` 三处**必须取同一值**。
> **等级上限钳制不在本函数**（`def.levels.length` 由注入方 `SkillPlaytest.skillLevelFor` 钳制；
> 编译器对越界等级仍按 `LEVEL_OVERFLOW` 硬失败）。
> 真源依据：合同 §101「技能等级成长来源沿用项目实际路径」= 局外 `Meta.weaponLv(heroId)`（1~100）。

---

## 四、冻结的数据结构（合同 §5 所有权）

```js
// 定义（配置所有，加载后只读）
Definition = { id, kind, ... }                 // kind: skill|template|crystal|quality|pool|policy

// 技能等级行（CFG.skillSystem.skillDefs[skillId].levels[level-1]，越界钳制取末位）
// ⚠️ 冷却字段名固定为 `cooldown`（SkillScheduler.cooldownFor 读它；兼容旧短名 cd）。
// ⚠️ 节点参数一律包进 `parameters` 子对象 —— 编译器 _cloneNode 只会并入该子对象，
//    平铺在行上的系数/数量/半径等将读不到（表现为伤害基准为 0）。`castTime` 为施法前摇（首轮调度器未接线）。
SkillLevelRow = {
  cooldown,                                    // 基础冷却（秒），乘 stats.cdMul 后取策略下限
  castTime,                                    // 施法前摇（秒）—— 首轮未接线，登记为遗留项
  parameters: { coefficient, count, speed, life, radius, duration, tick, dps, ... },  // 节点参数
}

// ⚠️ 策略表字段名同样冻结（曾因两个字段名不一致静默降级，与上面的 `cd` 坑同类）：
//   targetPolicies[id].maxRange      索敌范围（世界单位）。**不是** range。
//   castPolicies[id].requiresTarget  是否需要目标；false = 允许无目标（环绕类）。
//                                    **不是** allowNoTarget。
//   两者由 SkillConfig 校验器强制（见 skill-config.js targetPolicies/castPolicies 段），
//   调度器读取处：SkillScheduler.rangeOf / SkillScheduler.allowNoTargetOf（旧短名仅作兼容）。

// 每英雄技能状态（HeroSkillState，本英雄所有）
HeroSkillState = {
  heroId, slotCount,                            // = CFG.skillSystem.slotCount（默认 4）
  skills: { [skillId]: { id, level, cd, cdLeft } },   // cd = 基础冷却（由 SkillLevelRow.cooldown × cdMul 求得并缓存）
  crystals: [ { crystalId, level, slot: 0..3 } ],// 按 crystalId 规范排序后存储
  groupVersion,                                 // 组版本号（每次装配/升级 +1）
}

// 编译产物（BuildResult，编译器所有，创建后只读）
BuildResult = {
  ok, configVersion, signature,
  skills: { [skillId]: CompiledSkillGraph },    // 每技能一图
  explanations: [ { crystalId, skillId, status,   // applied|inactive|conflict
                    nodes: [...], before: {...}, after: {...}, reasonCodes: [...] } ],
  diagnostics: [ { code, definitionId, opId, field, message } ],
}

// 施放快照（CastSnapshot，一次施放所有，运行实体仅引用）
CastSnapshot = {
  castId, ownerId, skillId, level,
  stats: { atk, cdMul, ... },                   // 发起时冻结的进攻属性
  crystals: [ { crystalId, level } ],           // 发起时冻结
  derivedCfg: {...},                            // 派生配置快照
  graph, simTime,
}

// 效果实例（EffectInstance，世界所有，可变）
EffectInstance = {
  effectId, castId, ownerId, skillId, nodeId, templateId, role, // role: primary|derived
  x, y, px, py, vx, vy, life, age, radius, damageBasis,
  hitMap,                                       // 去重：{ [targetId]: hitTime } 或 Set(targetId)
  bornStep, state,                              // bornStep 防出生即碰撞
}

// 奖励事务（RewardTransaction，奖励服务所有）
RewardTransaction = {
  rewardId, heroId, source, groupVersion, randomState,
  options: [ { optionId, kind, crystalId, fromLevel, toLevel } ],
  committed: false,
}
```

**ID 规则（合同 §5）**：定义 ID 稳定字符串；实例 ID 本局递增（`castId` / `effectId` / `rewardId` 回收后不得复用为存活去重键）；
`targetId` = Monster 稳定 ID（W5 新增 `m.id`，见第六节）。

---

## 五、原因码枚举（冻结）

定义处：`SkillConfig.Reason`。业务分支只能判这些码。

```
NO_COMPATIBLE_NODE      无节点匹配（不产生收益）
NO_GAIN                 收益为零（乘数=1 / 数量+0）
SLOTS_FULL              槽位已满
MAX_LEVEL               已达等级上限
MOTION_CONFLICT         形态互斥（如 追踪 × 环绕 争主运动资源）
EXISTING_CRYSTAL_INACTIVE  已装水晶将全部失效 → 禁止该候选
INVALID_REFERENCE       引用缺失（坏 nodeId / templateId / poolId）
UNKNOWN_EXECUTOR        未知执行器
CYCLE_DEPENDENCY        阶段依赖成环
EVENT_BUDGET_EXCEEDED   事件预算超限
DERIVED_DEPTH_EXCEEDED  派生深度超限
BUDGET_EXCEEDED         实体/事件预算超限
ALREADY_COMMITTED       事务已兑现（防重复点击）
NO_CANDIDATE            无合法候选 → 走属性兜底
PENDING                 提交处理中
TARGET_ALREADY_HIT      同目标已消耗本次命中额度
INACTIVE_OPERATION      该操作对目标技能不适用
NOT_MIGRATED            英雄未迁移（走旧路径）
UNKNOWN_ID              旧存档未知 ID
LEVEL_OVERFLOW          旧存档等级越界
REGION_MAX_DPS          持续区域重叠取最高 DPS（非错误，是策略）
```

---

## 六、共享文件的接入点（W6 由主会话串行插入，均符合 AGENTS.md §5.45「单行调用」）

| 位置 | 现状（文件:行） | W6 插入内容 | 归属波次 |
|---|---|---|---|
| `index.html` | 587 `<script src="js/main.js">` 之前 | 9 个 `<script src="js/skill-*.js?v=YYYYMMDD">` | W0（本文） |
| `js/config.js` | 文件末尾 | `CFG.skillSystem = {...}` 骨架区块 + 首批内容 | W0/W1 |
| `js/game.js` Monster 构造 | 694 | `this.id = (++_monsterIdSeq);` + 模块级计数器 | W5 |
| `js/game.js` Bullet 构造 | 622 | `this.px = x; this.py = y;`（扫掠用上一帧位置） | W5 |
| `js/game.js` Bullet.update | 646 | 命中判定改 `segCircleHit(px,py,x,y,m.x,m.y,m.r+6)` | W5 |
| `js/game.js` Player.update | 294 | 技能块前插 `if (skillV2Owns(this)) return;`（迁移英雄走新路径） | W6 |
| `js/game.js` updateCompanions | 490 | 同上，队友技能块前插守卫 | W6 |
| `js/main.js` 主循环 | 885 `G.activeWorld.update(dt)` 之后 | `if (typeof SkillRuntime !== "undefined") SkillRuntime.updateAll(G.activeWorld, dt);` | W6 |
| `js/items.js` presentLevelUpChoice | 827 | 迁移英雄改走 `SkillReward.build/commit`（保持旧路径给非迁移英雄） | W6 |
| `js/core.js` U.rand/randInt/pick | 8~10 | 改读可注入 `U._rng`，新增 `U.setRng(fn)` / `U.resetRng()` | W5 |

**分流铁律（合同 §14）**：迁移英雄**只走新路径**，非迁移英雄**只走旧路径**，同一技能绝不两路施放/两路增伤。
`SkillRuntime.ownsHero(hero)` / `skillV2Owns(hero)` 的判定依据 = `CFG.skillSystem.enabled && CFG.skillSystem.migratedHeroIds.indexOf(hero.id) >= 0`。

---

## 七、核心算法约定（合同 §8 / §9 / §10）

**编译 6 阶段（固定顺序，禁回退）**：基础图 → 主形态 → 数量与分布 → 派生模板展开 → 节点参数与伤害修正 → 校验冻结。
- 结构操作只读**已完成阶段**的图；不得靠自身新增能力过前置检查；禁循环依赖、禁"试算到稳定"。
- 同阶段同字段只用已声明合并算子：`add | multiply | min | max | exclusive`；`exclusive` 多来源 = 冲突。
- **先按稳定 operationId 排序再归并** → 槽位排列不改变结果（合同 §17 必测）。

**运行时单步顺序（合同 §9）**：
`到期处理 → 自动施放请求 → 实体生成 → 运动与碰撞 → 合法伤害 → 首次命中事件 → 贯穿/结束 → 消失事件 → 事件队列派生 → 回收`。
- 队列消费有限（深度/次数/预算）；新派生本步创建但**首次运动从下一模拟步开始**。
- 同一步多碰撞按「碰撞时间 → 距离 → 目标稳定 ID」排序。
- 高速弹用**扫掠碰撞**；对象池回收必须在本步已引用事件完成后进行。

**命中额度（合同 §10 / v0.5 §5，冻结）**：
| 类型 | 额度键 | 说明 |
|---|---|---|
| 主飞行弹 | `castId + 主直击组 + targetId` | 一次施放一次 |
| 分裂子弹 | `castId + 派生模板组 + targetId` | 出生目标排除 |
| 爆炸 | `castId + 爆炸模板组 + targetId` | 可与直击各一次 |
| 环绕 | `ownerId + skillId + 接触模板组 + targetId` | 共享 `nextAllowedHitTime` |
| 持续区域 | `ownerId + skillId + 区域模板组` | 取该目标**有效最高 DPS**，按共同模拟时间结算 |

**伤害公式（v0.5 §5 冻结）**：
`伤害 = 原始基准 × 形态系数 × 派生比例 × (1 + 匹配外部 Increased 总和) × Π(各独立水晶 More) × 暴击 × 敌方修正`
- 每个修改器对同一节点**只应用一次**；派生引用**未经外部加成的原始基准**，不复制父节点最终伤害。
- 持续伤害默认不暴击；瞬时命中每次合法结算独立暴击；防御沿用现有公式（接入前核对，禁重复减伤）。

---

## 八、命名工具约定（所有文件统一）

- 每个 `skill-*.js` 用**顶层 `const <Symbol> = {...}`**（项目既有惯例，如 `const UI` / `const SkillSystem`）——
  顶层 `const` 不进 `window`，但**被后续脚本共享全局词法环境**，故 9 文件 + `main.js` 之间可互相 `typeof` 探测。
  只暴露**一个**全局符号（见第一节表）。`skill-config.js` 额外暴露 `SKILL_REASON` 常量。
- 窗口守卫：文件内访问 `G` / `CFG` / `U` / 其它模块前一律 `typeof X !== "undefined"` 保护（无头测试桩可能只加载部分文件）。
- 幂等标记：若需 monkey-patch 既有函数，必须在函数上打 `__skillV2` 标记，重复加载不二次包装。
- 中文注释；数值一律进 `CFG.skillSystem`，文件内不硬编码数值常量（白名单：0/1/2 等结构性常量与 `Math.PI`）。
- 测试文件命名 `skill_*_test.js`，已注册到 `run_tests.sh` 新增的 `skill` 套件（清单已预置 10 个名字）。
- 无头测试禁止依赖真实 DOM（除非验证 UI）；随机源通过 `U.setRng` 注入固定种子。
- **测试桩注意**（血泪坑）：`vm.runInContext` 内不要用反引号模板嵌套；`console.assert` 不抛异常（要用显式 throw）；测试角色需注入高血量防中途死亡。

---

## 九、波次与验收（合同 §16 映射）

| 波次 | 交付 | 并行度 | 依赖 |
|---|---|---|---|
| W0 | 本文 + CFG 骨架 + 脚本挂载 | 串行 | — |
| W1 | skill-config.js（schema/校验器/策略表）+ 首批内容草稿 | 1~2 | W0 |
| W2 | skill-compiler.js（阶段/算子/互斥/用途保护/解释） | 1~2 | W0（接口） |
| W3a | skill-damage.js + skill-events.js | 2 | W0 |
| W3b | skill-scheduler.js + skill-runtime.js | 2 | W0 |
| W4a | skill-reward.js | 1 | W0 |
| W4b | skill-presenter.js + skill-save.js | 2 | W0 |
| W5 | 扫掠碰撞 + Monster 稳定 ID + 可注入 rng（基础设施） | 1~2 | W0 |
| W6 | 集成 + 全量门禁 + 火球/震荡波验收 + 报告 | 串行 | 全部 |

**并行前提**：本接口冻结后，W1~W5 各文件**按签名对着桩（或 `CFG.skillSystem` 骨架）开发**，不互相阻塞；
W6 由主会话统一接入共享文件并跑门禁。任何接口变更**先改本文再通知依赖方**（合同 §16）。
