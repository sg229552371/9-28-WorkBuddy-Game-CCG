# 02 战斗、怪物与主线/裂缝/无尽

## 目的
让实现者能定位战斗结果由谁计算、三种模式怎样进入和退出，以及哪些规则不能互相套用。技能内部细节见[技能章](04-crystal-skill.md)，物品收益见[经济章](03-inventory-economy.md)。

## 英雄、敌人和战斗链
玩家/队友、怪物、Boss、弹体与无人机由[实体层](../../js/game.js)及[战斗层](../../js/combat.js)组织。属性计算在[物品层](../../js/items.js)的 `computeStats`、`recomputeWeapon`，伤害入口含 `damageMonster`、`calcDamage`。不要为新测试用手写假怪物替代依赖真实类的碰撞、死亡和奖励链。

输入是英雄属性、武器/技能构筑、目标、世界和 dt；输出是效果实体、命中、伤害、死亡、击杀计数、经验/掉落及表现。索敌、碰撞、伤害、死亡发奖是不同阶段：仅见弹幕不能证明扣血，仅见击杀数字不能证明掉落与经验都正确。旧英雄技能与新水晶路径必须分别验证，避免迁移后“两头都不出伤害”或两条路径重复伤害。

怪物 AI、刷怪密度、精英/Boss和特殊怪规则通过 `CFG` 与 `Monster`/模式生成逻辑配合。关卡配置和时间/波次驱动应按实际分支定位，不以本书另抄一套敌人属性表。Boss预警、碰撞与伤害的玩家可读性需浏览器验证，脚本绿不能证明视觉预警可见。

## 三种模式的规则和转换
| 模式 | 进入与世界 | 任务/推进 | 退出与时长事实 |
|---|---|---|---|
| 主线 | `startRun`建立完整上下文与主世界 | 关卡敌人、补给、毒圈、Boss、探索 | 最终Boss产生唯一撤离雕像；`CFG.extract.channel=8.0` |
| 裂缝 | `enterRift`保存`G.riftReturnPos`，新建`World(...,false,"rift")` | 按权重选hunt/purge/raid，清裂缝击杀/奖励标记 | `CFG.rift.channel=5.0`，开场冻结3秒；返回主世界 |
| 无尽/深渊 | 复用真实开局上下文，再进入独立模式 | 时间驱动波次，独立Boss、词缀、竞技场、队伍、记录 | `CFG.endless.timeLimit=780`、`extractChannel=3.0`，最终Boss序号3 |

以上数值是审查时快照，改值读CFG，不在逻辑硬编码。

### 主线撤离、毒圈与补给
`updateExtractJudge`检查任一存活英雄在圈内，自动累积读条；受击归零，全员离圈会衰退。`extractWaveTick`处理撤离围攻；`extractWeightDt`把负重减速及护盾破碎冻结纳入有效读条时间。离主地图调用 `clearExtractChannel`清进度但保留雕像。不能用“按住按钮8秒”替代这些规则。

毒圈实际伤害口径为最大生命百分比 `dmgPercent`；`dmgPerTick`属于兼容残留，不能据字段名改回固定伤害。补给按关卡定义的数量、`channelSeconds`和效果执行；补给与撤离虽然都有读条，其奖励和中断策略须各自查实现。

### 裂缝任务与回归
`enterRift`只接受playing且尚未在裂缝的状态；先定任务、将玩家移到子图中心，再构造世界以避开出生点投放敌人。设置`G.activeWorld=G.riftWorld`、`G.inRift=true`，随后`seedTrail`、`snapCompanions`。

`returnFromRift`恢复`G.activeWorld=G.mainWorld`、原位置，并清`G.riftWorld`、重排队友；主地图对象保留。任务状态包含`remain/done/failed`，奖励防重字段为`riftRewarded`。这些赋值已核查，主图各计时器在离开期间是否继续推进需结合主循环专项验收。

配置注释规定返回信标仅受击归零、移动不打断；离圈的实际时钟语义仍需结合 `rift_extract_test`与运行代码逐条件核验，不直接由注释宣布正确。工匠是否是所有宝箱唯一可达开箱入口也尚未封闭证明。

### 无尽分支
[无尽核心](../../js/endless.js)负责波次/难度；[奖励](../../js/rewards.js)有包装逻辑，须核对加载后真正被调用的函数。附属模块包括endless-affix、arena、record、team与ui-abyss、ui-abyss-pause。不得把主线撤离8秒、主线解锁链或裂缝返回规则直接复用到深渊。撤离、死亡、超时应检查统一结算入口及防重，模式重开需验证清场与记录隔离。

## 配置和定位
```powershell
rg -n 'updateExtractJudge|extractWaveTick|extractWeightDt|clearExtractChannel|rift|hazard' js/modes.js
rg -n 'enterRift|returnFromRift|abyssExtractSettle|startRun' js/main.js
rg -n 'timeLimit|extractChannel|channel:|dmgPercent|rift =' js/config.js
```
配置源：[config.js](../../js/config.js)；模式实现：[modes.js](../../js/modes.js)；渲染：[render.js](../../js/render.js)。

## 异常边界
- 暂停、冻结、升级弹窗和较大dt分别测试；模拟时间与墙钟时间不可混用。
- 独立世界需`isMain=false`及自定义kind走空世界分支；必须先有完整run上下文。
- 无目标、目标死亡、跨世界残留目标、队友落后、最后存活英雄出圈均需观察实际世界引用。
- 同一步击杀Boss又死亡/撤离，奖励必须只结算一次；当前是否全覆盖需要专项证据。
- 画质降档只能影响表现，不能减少碰撞和伤害。

## 可执行验收与状态
```bash
node battle_rules_test.js
node boss_test.js
node special_monster_test.js
node rift_extract_test.js
node rift_hud_test.js
node endless_flow_test.js
node endless_reward_test.js
node endless_restart_test.js
```
记录主线圈内/受击/离圈/负重/护盾五组结果；裂缝记录进入位置、任务、主图对象引用、返回位置及重复奖励；无尽记录波次、Boss序号、3秒读条、死亡/超时及重启。上述是待执行验收清单，不能从套件名称推断已覆盖。

本轮verified-run中相关现有测试通过，但曾出现旧路径10秒无击杀红测，根因未明；真机模式全链未执行。后续先诊断该红测、补齐裂缝读条与主图计时证据，再讨论调整模式数值。
