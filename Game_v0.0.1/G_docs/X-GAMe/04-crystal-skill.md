# 04 能量水晶技能：配置到运行时

## 目的与批准边界
本章给出开发导航，不复制整份合同。修改任何技能前先读[技能总纲](../skill_system_master_v1.md)，再按[受控引用](controlled-references.md)进入合同、接口、数值、UI或迁移表。用户明确铁律优先于工程合同，合同优先于v0.5设计及旧文档；本书未批准提案没有更高权威。

## 玩家规则和当前启用范围
批准目标：每英雄一个初始自动技能，无独立普攻；至多再获一个稀有技能；共享四个辅助槽，全部开放且不可卸换；同ID升级不占新槽；辅助独立匹配、顺序无关、必须有实际收益且不能让已有水晶失效。扩容文档中的冷却、弹速、弹射、灼烧、链锁、弹射与环绕拆分及100级是历史批准方向，不等于本轮已批准开发新批次。

当前`CFG.skillSystem.enabled=true`；`migratedHeroIds`为**H001～H012 全量（12/12）**（2026-10-12 批1 H001~H006 + 批2 H007~H012 迁移完成），**不存在“仅H001迁入、其余走旧路径”的状态**；H001绑定W001/SK_FIREBALL。`features.twoSkillsPerHero/rareSkillFromStatue=true`；`derivedEvents/elementConversion=false`；`summonMigration=true`（批2B / D012，召唤与陷阱已迁入）。稀有池含SK_SHOCKWAVE。旧路径技能表`CFG.skills`保留不动（迁移=新增新路径，不删旧表）。功能有代码与功能开关关闭是不同状态，不应删除保留路径。

> ⚠️ **订正记录（2026-10-15）**：本句旧稿写`migratedHeroIds=["H001"]`、`summonMigration=false`、“其他英雄仍走旧路径”，与现行配置不符（实核`js/config.js:2972`）。同名陈述仍存在于01、07、08章，已登记差异，待单独批次统一订正。

## 子系统输入输出与状态契约
| 子系统/文件 | 输入→输出 | 状态与不变量 | 对应现有测试 |
|---|---|---|---|
| skill-config | CFG定义→校验、原因码、策略解析 | 无效字段不能静默降级；定义冻结 | skill_config_test |
| skill-compiler | 技能/等级/辅助组→编译图与预览 | 稳定合并全序、图校验、顺序无关 | skill_compiler_test、skill_rule_binding_test |
| skill-scheduler | 世界/英雄/dt→独立冷却与施放快照 | 索敌maxRange、requiresTarget；暂停停钟 | skill_scheduler_test |
| skill-runtime | 快照/节点/生成上下文→效果实例 | **十段**单步（源码注释误写“九段”，见下方时序节）、扫掠碰撞、派生下一模拟步移动、回收 | skill_runtime_test、skill_sweep_test |
| skill-damage | 伤害请求/快照→命中额度与伤害 | 五类命中额度、区域积分；派生不复制父最终伤害 | skill_damage_test |
| skill-events | 事件→FIFO处理与派生 | 深度/预算、去重、固定顺序 | skill_events_test |
| skill-reward | 状态/来源/RNG→候选→提交结果 | 锁定与原子幂等，取消不重随机 | skill_reward_test |
| skill-presenter | 编译/预览/原因码→面板与说明 | 拒绝原因中文化，说明实际收益 | skill_presenter_test、crystal_ui_test |
| skill-save | 状态/旧数据/定义→序列化或迁移报告 | 保留未知、超限、冲突；幂等补偿 | skill_save_test |
| skill-playtest | 宿主与启用名单→初始技能、雕像授予、叠加显示 | H001默认启用；不能再描述为仅URL试玩 | skill_playtest_test、skill_enable_runtime_test |

这些为模块职责摘要，真实字段与签名以[接口文档](../skill_system_interface_v1.md)为准；模块对象方法和顶层包装函数不能凭名字互换。

## 编译、等级与伤害
编译六阶段：基础图→主形态→数量→派生→参数伤害→校验冻结。`operationId`必须稳定；合并运算词表为`add | multiply | min | max | exclusive`。辅助槽排列变化不得改变最终结果。`SkillLevelRow`施放层保留`cooldown/castTime`，`parameters`存coefficient、count、speed、life、radius、duration、tick、dps等参数，不把cooldown塞进parameters。

`SKILL_LEVEL_MAX=100`，`skillCurve`首项保持base。`SupportCompiler.skillLevelOf(state)`只读参数，按技能ID排序取首个有效等级/默认1；`SkillPlaytest.skillLevelFor`按定义钳制；编译越界报告`LEVEL_OVERFLOW`。不同层的边界处理需分别验证，不能统一写成全部静默截断。

命中与伤害不得随画质改变。持续型效果默认不暴击，派生从请求与快照重新计算，不能把父最终伤害重复乘系数。通常无目标不消耗冷却；环绕有无目标例外，且同英雄同技能只保留一批实例。实施前回查合同具体适用范围。

## 技能时序：两个主体、两条时间轴

技能时序**不能用单条链**`A施法前（蓄力）→B施法时（攻击）→C攻击进行中（飞行＋命中）→D子弹结束`描述。该表述同时犯三类错：**混主体**（A/B 说施法者相位、C/D 说效果体状态，一句内换主语）；**缝过程与事件**（“飞行”是持续过程，“命中”是瞬时事件且**可发生 0/1/N 次**，穿透弹打穿 3 个敌人 = 3 次命中全落在 C）；**链不闭合且绑死载体**（漏掉派生、回收与冷却；“子弹”命名使近战、光环、护罩的 C/D 段长度为 0，链直接断裂）。

时序表述的**三条检验**：**互斥完备**（任一时刻的效果必属于且仅属于一个阶段）、**维度单一**（同层不混主体）、**退化可表达**（无弹道、零命中、多次命中均可描述）。原四段表述三项全不满足。

**层一 · 施法者相位**（每英雄一条，闭环）：`索敌决定 → 起手·前摇（可选）→ 出手 → 冷却 →（回索敌）`

| 相位 | 含义 | 真源 |
|---|---|---|
| 索敌决定 | 找目标 + 判冷却门 + 判无目标策略 | `skill-scheduler.js:28 _castPolicy`、`tick :168` |
| 起手·前摇 | 可选读条，读条未满不施放 | `castTimeFor :119`、读条段 `tick :211-217` |
| 出手 | 创建主效果实例（瞬时事件） | `skill-runtime.js` 第③段 `:406` |
| 冷却 | 下次可施放前等待；环绕类 = `max(冷却, 持续时间)` | `cooldownFor :52`、`intervalFor :95-108` |

**层二 · 效果体生命周期**（0~N 个实例各走一遍）：`生成 → 存活·运动 → 命中 0~N 次 → 终止 → 派生 → 回收`；派生创建新实例后**递归回“生成”**。命中是**事件**而非状态；终止路径中不发消失事件者不进入派生。

**退化情形**（同一模型装下全部形态，不需要第二套说法）：

| 技能类型 | 层二退化 |
|---|---|
| 弹道类（火球/飞弹） | 完整走完 |
| 近战类（挥砍/突刺） | 存活期长度≈0，**出手帧同帧命中即终止**；派生段完整保留 |
| 施放级效果（光环/护罩） | **无载体**→层二整段跳过，出手直接进冷却 |
| 持续区域（余焰/地火） | 存活期长，命中按`hitInterval`周期性重复 |

口语线性版（保留原骨架的最小修正）：`索敌 → 起手（可选前摇）→ 出手 → ［载体存活期：运动＋0~N 次命中 → 终止 → 派生 → 回收］→ 冷却 → 回索敌`。

## 单步十段（真源主序）

`js/skill-runtime.js:383 _updateHeroStep`；①~⑩为源码注释段号（`:387-442`）。
⚠️ 源码`:381`注释写“单步**九**段”，与实际十段不符，属**注释漂移**，以本表为准。

| 段 | 做什么 | 位置 |
|---|---|---|
| ① 到期处理 | 推进`age/life`；`life<=0`→`expiring`（标记，不立即删） | `:387` |
| ② 自动施放请求 | 调`SkillScheduler.tick()`；`stopped`→强制清理 | `:396` |
| ③ 实体生成 | 每个 request 遍历根节点→`spawnEffect(role:"primary")` | `:406` |
| ④ 运动与碰撞 | `_phaseSweep :476`；`bornStep`守卫（本步新建的派生体不碰撞） | `:419` |
| ⑤ 合法伤害 | `_phaseDamage :550`；按 碰撞时间→距离→目标稳定ID 排序 | `:422` |
| ⑥ 首次命中事件 | 为每个首次命中入队`hit`事件 | `:425` |
| ⑦ 贯穿/结束判定 | `_applyPierce :588`；耗尽→`dead`/`endReason="hit"` | `:430` |
| ⑧ 消失事件 | `_phaseDisappear :597`；**仅自然结束才发**，每实例一次 | `:436` |
| ⑨ 事件队列派生 | `_phaseDerive :611`；排空队列→生成派生实例 | `:439` |
| ⑩ 回收 | `_phaseRecycle :699`；移除`dead`实例＋释放命中去重键 | `:442` |

**⑨ 必须先于 ⑩，是硬约束**：派生请求需父实体回填位置/方向/`chainLeft`（`:640-654`），而⑩恰好把这些字段清零；调序会**静默破坏派生链**。

## 派生（Derive）

派生 = 一个效果在**命中**或**结束**时**长出新的效果实例**（`_phaseDerive :611`）。玩家见到的“一变为多”——分裂、打中炸一圈、弹到下一个敌人、命中挂燃烧——全部走这一条机制。

效果自身**不知道**能派生出什么，**由编译图的边决定**：`hit`事件查`event:"onHit"`边；`vanish`事件查`event:"onExpire"`边（不写`event`时默认`onExpire`）。事件构造`_makeEvent :772`；编译器建边`skill-compiler.js:615`。

八颗形态级水晶的边归属（全量实核）：

| 水晶 | 品质 | 边 | 派生出什么 | 关键参数 | 配置 |
|---|---|---|---|---|---|
| 环绕`CR_ORBIT` | 史诗 | 非派生 | 形态**转换**：主运动体→环绕体 | `convertNode`→`TP_ORBIT_CONTACT`＋`castPolicyId:"CAST_ORBIT"`；`count` 3→10 | `config.js:3705` |
| 追踪`CR_HOMING` | 稀有 | 非派生 | 形态**改造**：飞弹转向索敌 | `modifyParameter` `homingMode`（1追踪/2强化追踪），`merge:"exclusive"` | `:3628` |
| 分裂`CR_SPLIT` | 史诗 | `onHit` | 2 颗飞弹 | `count` 2→8，`coefficient` 0.45，路由`EP_DERIVED_ONCE` | `:3643` |
| 弹射`CR_BOUNCE` | 史诗 | `onHit` | 1 颗飞弹，朝最近的**其他**敌人 | `count` 1→5，`coefficient` 0.70，`targeting:"nearestOther"`，`EP_DERIVED_EACH_HIT` | `:3777` |
| 链锁`CR_CHAIN` | 史诗 | `onHit` | 一个**瞬时范围**，直接炸在下一个敌人身上 | `count` 1→4，`coefficient` 0.55，`TP_INSTANT_AREA`＋`nearestOther` | `:3797` |
| 爆破`CR_EXPLOSION` | 史诗 | `onExpire` | 瞬时范围（半径 110） | `coefficient` 0.60→1.25 | `:3659` |
| 余焰`CR_AFTERFLAME` | 稀有 | `onExpire` | 持续区域（地面灼烧场） | `TP_PERSISTENT_AREA` | `:3675` |
| 灼烧`CR_BURN` | 稀有 | `onHit` | 目标身上的持续燃烧（**跟随目标**） | `attach:"target"`，半径 48 / 3 秒；目标死亡后留在原地烧完 | `:3817` |

**弹射与链锁的唯一差别是`spawnTemplateId`**（飞弹 vs 瞬时范围）。真源注释：“弹射是『飞过去』（有弹道与飞行时间），链锁是『直接炸在下一个身上』（瞬发）”。同一套派生机制靠换载体分出两种手感，是数据驱动的典型示范。

路由策略：`EP_DERIVED_ONCE`（每事件只派生一次：分裂、爆破）／`EP_DERIVED_EACH_HIT`（每次命中都派生：弹射、链锁）。

**三个契约**（`skill-runtime.js:640-677`）：

- **A · 链式预算`chainLeft`**：初值取等级表`count`，每派生一次`-1`，子效果继承“父值−1”，归零即停（`terminateCond: chainLeft<=0`）。这是**链式派生能终止的唯一保证**——若每代重读`count`，链会无界延长。
- **B · 目标选择`targeting:"nearestOther"`**：朝最近的、**本次尚未命中**的敌人；找不到则**不生成**（注释明写“不得原地空爆”）。
- **C · 附着`attach:"target"`**：子效果记录生成时目标，之后**每帧跟随**。

**继承规则**：派生体缺`x/y`时回填父实体位置；方向沿父弹“命中前方向”展开（分裂即扇形展开）；复用父实体同一`castId`快照→与母体**共享命中去重键与施法上下文**；标记`role:"derived"`／`depth+1`／`parentId`。

**两条护栏**：①**出生步守卫**——新派生体`bornStep>=step`本步不参与碰撞、下一步才动，**防同帧连锁爆开**；②`features.derivedEvents=false`（`config.js:3031`）——派生体默认不再触发事件水晶，**防 A 派生 B、B 又派生 A 的死循环**。

**防爆闸门**（配置：`budgets config.js:3039`／`budgetPolicies :3112`）：

| 闸门 | 上限 | 位置 | 超限行为 |
|---|---|---|---|
| 事件链深度`maxEventDepth` | 3 | `:3043`；`_phaseDerive :622` | 该请求被丢弃（静默） |
| 单事件派生数`maxDerivedPerEvent` | 12 | `:3042`；`:626` | 按 key 计数，超限丢弃 |
| 链式次数`chainLeft` | 等级表`count`（1~8） | `:640-654` | 归零后不再派生 |
| 每步事件队列`maxEventPerStep` | 256 | `:3044`；`_enqueueEvent :803` | 入队失败（有界队列） |
| 每英雄活动实体`maxEffectsPerHero` | 120 | `:3040` | `overloadPolicy:"reject"` |
| 单次施放实体`maxEffectsPerCast` | 48 | `:3041` | 同上 |
| 节点级`maxEffectsPerCast`／派生深度 | 编译期裁剪 | `skill-compiler.js:781-790` | 报`BUDGET_EXCEEDED`／`DERIVED_DEPTH_EXCEEDED` |

安全性来自**五重独立机制同时成立**：深度封顶＋单事件限量＋链式预算递减＋出生步守卫＋派生体不触发事件水晶；任一条失效其余仍能兜住。

## 回收（Recycle）

回收 = 把已“死”的实例**从容器摘掉、字段清零**，同时**释放这次施放的命中去重键**（`_phaseRecycle :699`）。它做两件事：

1. **摘除＋清零**（`_recycleEffect :724`）：`state="recycled"`，清零`castId/hitMap/damageBasis/x/y/px/py/vx/vy/life/age/radius/bornStep/endReason/rt`。为**对象复用**准备——字段不清干净，复用时会污染下一颗弹。
2. **释放命中去重键**（`_releaseDeadCasts :711`）：扫`hitStates`，凡该`castId`**已无任何存活实体**→`SkillDamage.endCast`并删键。一次施放产生的**全部**弹体（含派生体）共享同一`castId`，须等它们**全灭**才释放；缺此步`hitStates`会随局内时长无限增长（内存泄漏＋去重误判）。

**三条生死路径**：

| 路径 | 触发 | 发消失事件 | 可触发`onExpire`派生 |
|---|---|---|---|
| **自然到期** | `life<=0`→`expiring` | ✅ | ✅ |
| **命中耗尽** | `pierce`用完→`dead`/`endReason="hit"` | ✅ | ✅ |
| **强制清场** | 英雄死亡/失活/离局`_cleanupHero :732` | ❌ | ❌ |

第三行是**刻意设计**：角色一死，其在场的全部弹体直接清掉且**不触发余焰/爆破**，否则阵亡瞬间会原地刷出一片爆炸。→ 回收不只是垃圾清理，它同时是**派生链的紧急刹车**。

**结束原因映射**（`_endReason :41`，走`SkillEvents.EndReasons`）：`life`→`LIFETIME`；`hit`→`NATURAL_HIT`；`distance`→`DISTANCE`；`forced`→**不映射**（不发消失事件）。

## 施法前摇（castTime）——订正

⚠️ 本节**订正旧稿结论**。旧稿写“`castTime`生成与校验存在，但全js检索未发现调度/运行时按该字段消费的证据”，**该结论不成立**：该次检索为`grep -rn … | head`，被前序文件匹配占满而**静默截断**，属核查失误。

实核结果——**机制已完整接线，只是数值未启用**：

| 环节 | 位置 | 行为 |
|---|---|---|
| 生成 | `config.js:82/96`（`skillLevels`） | 由`[base,target]`曲线生成每级`castTime` |
| 校验 | `skill-config.js:146` | 规则`"nonneg"`，对每一级 row 生效 |
| **消费** | `skill-scheduler.js:119 castTimeFor(def,level)` | `levels[lv-1].castTime`→回落`def.castTime`→0 |
| **执行** | `skill-scheduler.js:211-217` | `st.castLeft=ct`起读条→`-=dt`→`>0`则本帧不施放→施放完成复位 |

语义由 **D015** 拍板：不可打断＋可移动；前摇进度只随时间推进，受击、移动均不清零；目标丢失则进度**暂停**；`castTime=0`恒 no-op。该坑的修复记录在代码注释中亦有载（`skill-scheduler.js:118`）。

**生效面窄属数值问题**：`CFG.skills`绝大多数技能`castTime=0`，唯一非 0 为`SK_SHOCKWAVE`（0.15→0.12）。要做蓄力手感**只需填表，不需改代码**。

## 事件预算的已核实语义

`_seMaxDepth()`读`CFG.skillSystem.budgets.maxEventDepth`，当前为**3**（**D023 由 2 调至 3**，与`budgetPolicies.BP_DEFAULT.maxEventDepth`统一，修复链式派生被静默截断）。入队检查深度；派生时同时检查`ev.depth+1 > _seMaxDepth()`和`ev.depth+1 > polMaxDepth`，**有效上限取两者更严者**。`parameters.chainLeft`是链式机制自己的剩余次数，不等同事件深度。everyHit仅对同颗水晶自己的链式机制有定向豁免，不能放开所有派生递归。

⚠️ **订正**：旧稿写“当前为2”与“策略写3也不能突破全局2”，在全局=3后该结论失效（实核`js/config.js:3043`）。当前全局与`BP_DEFAULT`同为 3，其余策略若写更小值仍受各自策略上限约束。是否继续调数值仍待产品/性能评审。

## 奖励事务
候选生成锁定`rewardId`、候选、`randomState`、`groupVersion`；同ID升级、满槽、无有效候选和兜底均属于真实事务分支。取消不重新抽样，重复提交不能重复发奖；提交期间构筑变化应验证过期组版本。UI不能绕过事务直接改槽位。

未来验收用固定种子：生成→取消→再开→比较候选和RNG；提交同option两次→比较等级/槽数；满槽时验证同ID升级和不匹配原因；无收益辅助不能只因名称匹配而接纳。

## 存档迁移
`SkillSave.SCHEMA_VERSION=2`；`__migratedTo`支持幂等；未知ID、超限等级、重复/形态冲突保留并输出报告。`saveTo(meta,state)`只写`meta.data.skillSystem`，不会`Meta.commit()`；`loadFrom(meta)`深拷贝，且仍检查全局`typeof Meta`。本轮运行时代码检索未发现实际宿主调用接线，不据此断言整个存档功能不存在。

模块映射快照：M001→CR_MULTISHOT，M005→CR_PIERCE，M004/M008→CR_EXPANSE，M009/M012→CR_ARCANE_AMP，M002/M007→CR_COOLDOWN，M003→CR_SPEED，M006→CR_BOUNCE；M010/M011首轮不迁移，chip映射为空。迁移资产不能因未知就丢弃。刷新恢复/真实持久化验收见[存档章](05-save-ui-assets.md)。

## 定位、异常与验收
```powershell
rg -n 'castTime|SkillSave\.|serializeHeroSkills|_seMaxDepth|polMaxDepth|chainLeft' js
rg -n 'skillSystem|migrationMaps|budgetPolicies|initialSkillBindings' js/config.js
```
```bash
bash run_tests.sh --suite=skill
node skill_fps_test.js
node skill_level_binding_test.js
node skill_enable_runtime_test.js
```
验收要求非空样本、固定种子、辅助排列、1/100/越界等级、无目标/暂停/大dt、30/60/120FPS和抖动dt、重复奖励与迁移两次；结果比较伤害/命中/资产而非只比UI。现有测试通过不代表上述所有组合已覆盖。

## 当前状态与后续任务
十个模块存在，**H001～H012（12/12）已接线**；verified-run的18项skill测试通过；首次旧路径反向断言失败已于2026-10-12**确诊**（测试桩喂钟非单调，非产品缺陷）。`castTime`机制**已确认完整接线**（生成/校验/调度消费/读条执行四处齐全，语义见D015），仅数值几乎全为0——旧稿“全js检索未发现调度/运行时按该字段消费的证据”**经复核不成立**（检索被`head`静默截断所致）。真实存档接线未证实（SkillSave 检索未发现宿主调用点，不等于功能缺陷）。待办收敛为：事件预算解释已冻结（全局3）、存档时机、`castTime`数值启用；之后再决定扩水晶与新水晶。不得在本轮文档任务中补代码。

## 差异登记（本章与跨章均已订正）

| 项 | 旧陈述 | 实核 | 处置 |
|---|---|---|---|
| 技能迁移范围 | 本章旧稿及01、07、08章称“仅H001迁入、其他英雄走旧路径” | `migratedHeroIds`为 H001~H012 全量12/12（`js/config.js:2972`） | ✅ **已统一**（本章 + 01/07/08 均订正） |
| 事件预算全局值 | 本章旧稿称`maxEventDepth`=2 | 实为3（D023，`js/config.js:3043`） | ✅ **已统一**（本章 + 07 差异表均订正） |
| 单步段数 | 源码`js/skill-runtime.js:381`注释写“单步九段” | 实际**十段**（①~⑩ `:387-442`） | 本章按十段陈述；**注释漂移待修（不改代码）** |
| `castTime` | 本章及07、08章称“未发现调度消费证据” | 已完整接线（`js/skill-scheduler.js:119`、`:211-217`） | ✅ **已统一**（本章 + 07/08 均订正） |

> 处置口径：凡自称“当前`CFG.X = Y`”或状态类断言而实核为 Z 的，**就地订正并保留 `~~旧~~ → 新` 痕迹**；订正只改事实陈述，不改批准规则、不改代码。跨章统一于 2026-10-15 完成。
