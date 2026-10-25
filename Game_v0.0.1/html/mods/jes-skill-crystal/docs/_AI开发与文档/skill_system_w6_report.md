# 能量水晶技能系统 · W6 集成交付报告

> 日期：2026-10-11 ｜ 版本：`20261036` ｜ 阶段：**W6 集成收尾（合同 §19 最终报告）**
> 真源：`G_docs/design_crystal_skill_system_v0.5.md`（玩法）+ `G_docs/skill_system_development_contract_v1.0.md`（工程）
> 接口冻结：`G_docs/skill_system_interface_v1.md`

---

## 一、实现范围

按合同 §4 拆分为 **9 个独立文件**（每文件暴露唯一顶层 `const` 全局符号），加 W0 冻结 + W6 集成：

| # | 文件 | 行数级 | 职责 |
|---|---|---|---|
| 1 | `js/skill-config.js` | 50KB | 配置校验器：`validate / get / version / Reason / policy / freezeDefinitions` |
| 2 | `js/skill-compiler.js` | 39KB | 辅助编译器：6 阶段编译、合并算子、能力/选择器匹配、图校验 |
| 3 | `js/skill-damage.js` | 19KB | 伤害与命中：伤害公式、五类命中额度、对象池键、区域积分 |
| 4 | `js/skill-events.js` | 14KB | 事件队列：FIFO 序号、深度/次数/预算护栏、去重 |
| 5 | `js/skill-scheduler.js` | 9KB | 调度：每技能独立冷却、索敌、施放快照 |
| 6 | `js/skill-runtime.js` | 37KB | 运行时：九段单步、扫掠碰撞、派生、回收、预算 |
| 7 | `js/skill-reward.js` | 20KB | 奖励事务：候选合并、升级/满槽/兜底、提交与取消 |
| 8 | `js/skill-presenter.js` | 15KB | 表现层：面板/矩阵/详情文案、原因码中文化、防回归 |
| 9 | `js/skill-save.js` | 11KB | 存档：序列化、迁移报告、幂等补偿、保留原值 |

覆盖 v0.5 首轮验证范围：**2 技能**（火球=碰撞飞行弹 / 震荡波=瞬时魔法范围）· **4 模板** · **9 水晶**（8 机制 + 1 通用增幅）· **4 档品质** · **全部策略表**。

---

## 二、修改文件与入口（W6 集成点）

| 文件 | 改动 | 类型 |
|---|---|---|
| `js/config.js` | 新增 `CFG.skillSystem` 完整区块（enabled/版本/迁移名单/槽数/特性/预算/默认/策略表/2 技能/4 模板/9 水晶/4 品质/奖励池/文案）；W6 修正词表与节点参数 | 唯一集成者写入 |
| `index.html` | 在 `js/main.js` **之前**插入 9 个 `<script src="js/skill-*.js?v=20261036">` | 单行 ×9 |
| `js/main.js` | 主循环 `G.activeWorld.update(dt)` 后接 `SkillRuntime.updateAll(G.activeWorld, dt)` | 单行 |
| `js/game.js` | `Player`/`Monster` 加稳定 id；`Bullet` 加 `px/py` + 扫掠命中；`Player.update`/`updateCompanions` 技能块前插分流闸门 `skillV2Owns(...)` | 小区块 |
| `js/core.js` | `U` 加可注入随机源 `setRng/resetRng/_random`（默认仍 `Math.random`） | 小区块 |
| `js/skill-scheduler.js` | **W6 修复**：冷却字段读 `cooldown`（兼容 `cd`） | 缺陷修复 |
| `js/skill-runtime.js` | **W6 修复**：`_nodeList` 归一化 + `_resolveBasis` 伤害基准解析 + `_steerHoming` | 缺陷修复 |
| `run_tests.sh` | 新增 `SKILL` 套件（12 个测试）；`SUITES` 加 `skill` | 登记 |
| `cache_version_test.js` | `VER_ASSETS` 加 9 个 `js/skill-*.js`；版本 `20261035→20261036` | 登记 |

---

## 三、配置变化

全部数值集中在 `CFG.skillSystem`（逻辑侧零硬编码，符合"数据驱动"铁律）：

- **总开关**：`enabled: false`（默认关）；`migratedHeroIds: []`（默认无英雄走新路径）→ **当前游戏行为零变化**。
- **策略表**：`castPolicies / targetPolicies / hitPolicies(5 类) / stackPolicies / eventPolicies / budgetPolicies / rewardPolicies / supportGroupRules / defaults / migrationMaps`。
- **可扩展性**：品质档数 = `qualityDefs` 数组长度（测试证明加到第 5 档仍合法，未写死）。

---

## 四、兼容路径（分流铁律）

- 迁移英雄（`skillV2Owns(hero) === true`）**只走**新路径；非迁移英雄**只走**旧路径。
- `game.js` 两处闸门（`Player.update` / `updateCompanions`）+ `SkillRuntime.updateAll` 的总开关检查，确保：默认关闭时 **零介入**（集成测试 ⑥ 证明不生成任何实体、`ownsHero=false`）。
- 禁两路施放/两路增伤 —— 由闸门 + 集成测试 ⑦（静态校验闸门存在）共同保证。

---

## 五、真实测试命令与结果

```
bash run_tests.sh --suite=skill     # SKILL 套件：12 测试 / 403 断言 / bad=0
bash run_tests.sh                   # 全量门禁：88 套 / PASS 合计 = 3778 / bad = 0 / 全绿
```

| 套件 | 测试 | 断言 |
|---|---|---|
| skill_config | 45 | 校验器 21 种原因码 + 冻结 + 默认值 |
| skill_compiler | 84 | 共享增幅 / 贯穿 / 24 全排列 / 爆破扩域 / 升级 / 用途保护 / 互斥 / 满槽 / 满级 / 只读 |
| skill_damage | 44 | 五类命中额度 / 区域积分 / 派生原始基准 / 暴击 / 纯函数 |
| skill_events | 21 | FIFO / 深度 / 预算 / 无界终止 / 去重 / 派生开关 |
| skill_scheduler | 18 | 独立冷却 / 索敌 / 快照冻结 / 冷却下限 / 环绕间隔 |
| skill_runtime | 27 | 九段顺序 / bornStep / 预算 / 环绕 / 回收 / 派生 |
| skill_reward | 41 | 合并池 / 空槽 / 同 ID 升级 / 满级 / 满槽 / 无候选兜底 / 事务提交取消 / 雕像 |
| skill_presenter | 34 | 面板矩阵 / 详情 / 原因码中文化 / 占位符 / 防回归（改乱码不影响判定）|
| skill_save | 31 | 序列化往返 / 迁移报告 / 未知 ID 保留 / 等级越界保留 / 幂等 / 版本标记 |
| skill_sweep | 12 | 扫掠碰撞（防隧穿）/ 稳定 id |
| **skill_integration** | **34** | 真实配置校验 / 真实编译 / 端到端跑通 / 独立冷却 / 预算封顶 / 零介入 / 接线静态校验 |
| **skill_fps** | **12** | 30/60/120 FPS + 抖动 dt 的一致性（见 §十一）|

> 口径：每项 `exit=0 且 bad=0`（`bad = grep -ci "Assertion failed|FAIL|Error"`）。

---

## 六、未通过项

**无**（全量 88 套 / 3778 断言全绿）。

---

## 七、尚未覆盖项（登记为遗留）

| 项 | 说明 |
|---|---|
| `SkillLevelRow.castTime` | 施法前摇字段已进配置，**调度器未接线**（首轮火球=0 / 震荡波=0.15，影响极小） |
| 稀有技能位 | v0.5 的「最多 1 稀有技能」位**首轮未放内容**（当前 2 个技能均为普通池） |
| 装配 / 详情 UI 屏 | `skill-presenter` 只产出结构数据，**未接 `index.html` 的实际 DOM 屏** |
| 首轮平衡数值 | 全部为**占位值**，待策划按真实基线平衡 |
| 元素类型扩展（火/流血） | 首轮只认 `physical / magical`，火焰仅作表现主题 |
| 派生膨胀上限 | 后期优化项（当前靠预算封顶） |

---

## 八、下一阶段依赖

1. **策划**：平衡首轮数值（冷却/系数/派生比例/预算阈值）。
2. **UI**：把 `SkillPresenter.panel/explain/detail` 接到装配页与雕像详情。
3. **内容**：补稀有技能定义 + 更多水晶（填 `crystalDefs` 与 `rewardPools` 即可，代码不认识具体 ID）。
4. **启用**：把要迁移的英雄加入 `CFG.skillSystem.migratedHeroIds`，并把 `enabled` 置 `true`。

---

## 九、附：规则 → 实现 / 测试对应表

| 合同/设计规则 | 实现位置 | 测试证据 |
|---|---|---|
| §8 编译 6 阶段禁回退 | `skill-compiler.js` `_PHASE_ORDER` | compiler：全排列 24 / 爆破扩域两序一致 |
| §8 执行器白名单 4 种 | `skill-compiler.js` `_EXECUTORS` | compiler：未知执行器 → `UNKNOWN_EXECUTOR` |
| §8 合并算子全序（槽位排列不变性） | `_OP_ORDER` + `operationId→crystalId→nodeId` | compiler：24 种排列 signature 逐位一致 |
| §9 运行时单步九段 | `skill-runtime.js` `_updateHeroStep` ①~⑨ | runtime：九段顺序（到期→伤害→事件→消费→回收）|
| §9 bornStep 出生步守卫 | 运行时生成处 | runtime：出生步不碰撞 / 下步才碰撞（含派生）|
| §10 POE 伤害模型 | `skill-damage.js` `_sdComputeDamage` | damage：`100×2×1.5×2=600`；本文 §十 算例 |
| §10 派生引用原始基准 | `buildBasis` / `_resolveBasis` | damage：派生 `100×0.5=50`（不是 `150×0.5`）|
| §10 五类命中额度 | `applyHitPolicy`（main/split/explode/orbit/region）| damage：主弹同目标二次拒绝、分裂排除出生目标、环绕共享间隔、区域取最高 DPS |
| §10 扫掠碰撞防隧穿 | `segCircleHit`（运行时 + `Bullet`）| sweep：旧终点判定会隧穿 / 扫掠单步内命中 |
| §11 每技能独立冷却 | `SkillScheduler.tick` `cdLeft -= dt` | scheduler：A 未就绪只有 B 施放；integration ④ |
| §11 索敌范围来自策略表 | `_acquireTarget` + `targetPolicies` | scheduler：改小范围 → 目标不可及 |
| §12 奖励事务不可拆用途保护 | `skill-compiler._validateGraph` + `skill-reward` | compiler：用途保护拒绝 `EXISTING_CRYSTAL_INACTIVE`；reward：事务提交/取消/幂等 |
| §13 UI 文案由原因码映射 | `skill-presenter` `reasonText` | presenter：原因码中文化 + 缺失回落；★防回归 |
| §14 存档迁移可追溯可重复 | `skill-save.migrate` | save：未知 ID 保留 / 等级越界保留 / 幂等二次不重复补偿 |
| §15 性能失败策略（预算 reject/truncate）| runtime 预算检查 | runtime：reject 整体拒绝 / truncate 稳定序截断 |
| §17 帧率一致性 | 全链路 dt 驱动 | **fps：30/60/120 + 抖动一致** |
| §18 禁按 ID 写特殊分支 | 全部按 `capabilities/tags/kind` 判定 | compiler：贯穿对范围 inactive（能力判定）；presenter 防回归（改乱码不影响）|
| v0.5 §3 每颗水晶分别判断两技能 | `_matchSelector` 逐技能匹配 | compiler：共享增幅同时强化两技能只占一槽 |
| v0.5 §3 获取池不限制辅助对象 | `rewardPools` 只控来源与权重 | reward：空槽候选含新装项；满槽只出升级项 |

---

## 十、附：伤害来源示例（`atk = 100`）

```
主弹 LV1（atk100 × 系数1.40，无水晶）                 => 140
主弹 + 通用增幅 LV1（More 1.12）                      => 156.8
主弹 + 通用增幅 LV3（More 1.28）                      => 179.2
扇射 LV1 主弹（系数 1.40 × 0.80）+ 增幅               => 125.44
分裂弹（原始基准 100 × 派生系数 0.50）+ 增幅          => 56
爆炸（派生系数 0.60）+ 增幅                           => 67.2
瞬时暴击 ×2（主弹 + 增幅）                            => 313.6
持续火场 doT（不暴击，传 crit 亦忽略）                => 24.64
震荡波 LV1（系数 1.10；扩域只改半径不改伤害）         => 110
主弹 + 外部 Increased 累加 +50%                       => 210
```

对应公式：`伤害 = 原始基准 × 形态系数 × 派生比例 × (1+Increased总和) × Π(独立水晶More) × 暴击 × 敌方修正`。
**水晶 = More 独立乘区（≤4）；其余 = Increased 加算区。**

---

## 十一、附：最坏预算与帧耗

场景：**5 英雄 × 每英雄满配派生水晶（分裂/爆破/余焰/通用增幅 LV2~3） × 300 只怪 × 600 帧（10s@60FPS）**。

```
平均单帧 = 0.162 ms      最坏单帧 = 4.306 ms（首帧/GC 抖动）
峰值实体数 = 17（预算 240）    终态实体 = 0（回收干净）
```

**帧率一致性（T=12s，同种子同布局）**：

| 帧率 | 步数 | 施放数 | 命中数 | 累计伤害 | 峰值实体 |
|---|---|---|---|---|---|
| 30 FPS | 360 | 18 | 51 | 6325 | 18 |
| 60 FPS | 720 | 19 | 53 | 6575 | 18 |
| 120 FPS | 1440 | 19 | 53 | 6575 | 18 |
| 抖动 dt | 965 | 19 | 53 | 6575 | 18 |

累计伤害跨帧率**相对离散 = 3.8%**（阈值 10%）；抖动 dt 与固定帧率**偏差 0%**。

> ⚠️ **本测试抓到并修复了一个真实功能性缺陷**：调度器 `cooldownFor` 读 `row.cd`，而配置真源写 `cooldown` → 冷却恒为 0 → **每帧都施放**（30/60/120 FPS 下施放数 720/1440/2880，伤害随帧率线性爆炸）。修复后施放数收敛为 18/19/19。若无帧率测试，该缺陷会以"技能变成每帧弹幕机 + 性能随帧率崩溃"的形态上线。

---

## 十二、附：存档迁移样例

输入旧存档：`schemaVersion=1 / configVersion=skill-v0.9-legacy`，含 3 颗水晶（1 颗走映射、1 颗等级越界 9、1 颗未知 ID）。

```
configVersionMismatch = true      alreadyMigrated = false
migrated      = [{ from: "CR_LEGACY", to: "CR_PIERCE", level: 1 }]
unknownIds    = [{ crystalId: "CR_NOPE", action: "preserved" }]
levelOverflow = [{ crystalId: "CR_PIERCE", originalLevel: 9, maxLevel: 3, action: "preserved" }]
输出水晶 = [ CR_PIERCE(L1), CR_PIERCE(L9, overflow), CR_NOPE(L1, unknown) ]
原存档保留水晶数 = 3（原样未被删改）
```

结论：迁移**逐项翻译 + 报告 + 原值保留 + 原始存档完整备份**；未知 ID 与越界等级**不静默删除**；重复运行**不重复补偿**。

---

## 十三、附：已知限制与回退操作

**回退操作（任一即可）**：

1. **全局停用**：`CFG.skillSystem.enabled = false`（**默认已经是 false**）→ `SkillRuntime.updateAll` 零介入。
2. **单英雄退回**：从 `CFG.skillSystem.migratedHeroIds` 移除该英雄 id → 该英雄立即走旧路径。
3. **完全卸载**：删除 `index.html` 中 9 行 `<script src="js/skill-*.js">` + `main.js` 一行接线（`game.js` 闸门在开关关闭时自动失效）。

**已知限制**：

- 系统当前**装好但未启用**（默认关 + 迁移名单为空）→ 对现有游戏行为**零影响**。
- `castTime`（施法前摇）字段未接线（见 §七）。
- 全部数值为首轮占位，未平衡。
- 装配/详情 UI 屏未接 DOM。

---

## 十四、W6 集成期修复的跨模块缺陷（8 项）

W0 接口冻结不够精确 → 并行波次间出现**词表/形状不匹配**，W6 全部定位并修复：

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| 1 | `CR_MULTISHOT` 整组编译失败 `EXISTING_CRYSTAL_INACTIVE` | phase/executor 词表 W1 与 W2 不一致 | 以编译器可执行实现为真源对齐：`countDistribution→distribute`、`mainForm→shape`、`deriveTemplate→derive`、`spawnTemplate→addNode`、`structuralForm→convertNode` |
| 2 | `modifyParameter` 无法承载字符串 `motionMode` | 编译器只接受数值参数 | 追踪改数值枚举 `homingMode`；环绕改 `convertNode`（形态由模板 kind 决定）|
| 3 | 派生节点 `HP_DERIVED_AREA` 未知引用 | 编译器默认策略名配置缺项 | 新增该策略 |
| 4 | `EP_DERIVED_ONCE.allowedOps` → `UNKNOWN_EXECUTOR` | 白名单未随 `_EXECUTORS` 改动 | 改为 `["addNode"]` |
| 5 | 集成测试零命中（`INVALID_REFERENCE`）| 运行时把编译器 `nodes` 对象映射当数组 | 新增 `_nodeList()` 归一化 |
| 6 | 命中发生但伤害恒 0 | ① `levels` 数值未包进 `parameters` 子对象；② `baseRef` 是引用字符串 | ① 改 levels 结构；② 新增 `_resolveBasis()` 解析层 |
| 7 | **技能每帧施放、伤害随帧率线性爆炸** | **冷却字段名不匹配（`cooldown` vs `cd`）** | **调度器读 `cooldown`，兼容 `cd`** |
| 8 | `skill_config_test` 6 条红 | 测试 fixture 仍用 W1 旧词草稿 | 测试改直连真源（`CFG.skillSystem`），消除重复真源 |

> 教训：**接口冻结必须冻结到字段名与取值词表级**（不只是模块边界与函数签名）。以上 8 项中，#1~#4、#7 都是"词表未冻结"的直接后果。
