# 04 能量水晶技能：配置到运行时

## 目的与批准边界
本章给出开发导航，不复制整份合同。修改任何技能前先读[技能总纲](../skill_system_master_v1.md)，再按[受控引用](controlled-references.md)进入合同、接口、数值、UI或迁移表。用户明确铁律优先于工程合同，合同优先于v0.5设计及旧文档；本书未批准提案没有更高权威。

## 玩家规则和当前启用范围
批准目标：每英雄一个初始自动技能，无独立普攻；至多再获一个稀有技能；共享四个辅助槽，全部开放且不可卸换；同ID升级不占新槽；辅助独立匹配、顺序无关、必须有实际收益且不能让已有水晶失效。扩容文档中的冷却、弹速、弹射、灼烧、链锁、弹射与环绕拆分及100级是历史批准方向，不等于本轮已批准开发新批次。

当前`CFG.skillSystem.enabled=true`，`migratedHeroIds=["H001"]`，H001绑定W001/SK_FIREBALL。`features.twoSkillsPerHero/rareSkillFromStatue=true`；`derivedEvents/elementConversion/summonMigration=false`；稀有池含SK_SHOCKWAVE。功能有代码与功能开关关闭是不同状态，不应删除保留路径。其他英雄仍走旧路径。

## 子系统输入输出与状态契约
| 子系统/文件 | 输入→输出 | 状态与不变量 | 对应现有测试 |
|---|---|---|---|
| skill-config | CFG定义→校验、原因码、策略解析 | 无效字段不能静默降级；定义冻结 | skill_config_test |
| skill-compiler | 技能/等级/辅助组→编译图与预览 | 稳定合并全序、图校验、顺序无关 | skill_compiler_test、skill_rule_binding_test |
| skill-scheduler | 世界/英雄/dt→独立冷却与施放快照 | 索敌maxRange、requiresTarget；暂停停钟 | skill_scheduler_test |
| skill-runtime | 快照/节点/生成上下文→效果实例 | 九段单步、扫掠碰撞、派生下一模拟步移动、回收 | skill_runtime_test、skill_sweep_test |
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

## 事件预算的已核实语义
`_seMaxDepth()`读`CFG.skillSystem.budgets.maxEventDepth`，当前为2。入队检查深度；派生时同时检查`ev.depth+1 > _seMaxDepth()`和`ev.depth+1 > polMaxDepth`。因此策略写3也不能突破全局2；有效上限取两者更严者。`parameters.chainLeft`是链式机制自己的剩余次数，不等同事件深度。everyHit仅对同颗水晶自己的链式机制有定向豁免，不能放开所有派生递归。

预算策略BP_DEFAULT及部分策略出现3，与全局2需在数值说明中解释，不能删掉某项约束以让描述一致。是否调整数值仍待产品/性能评审。

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
十个模块及H001接线存在，verified-run的18项skill测试通过；首次旧路径反向断言失败仍待诊断。`castTime`生成与校验存在，但全js检索未发现调度/运行时按该字段消费的证据，需专项追踪；真实存档接线未证实。先冻结事件预算解释、存档时机与castTime行为，再决定扩英雄或新水晶。不得在本轮文档任务中补代码。
