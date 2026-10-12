# 03 背包、装备、遗迹秘宝与经济

## 目的
说明局内物品怎样进入构筑，撤离/死亡如何结算，以及已经确认的规则冲突。实现以代码和批准设计分层记录；本章不自行替产品决定。

## 玩家规则与状态
拾取物品进入背包或武器库；装备、容量、属性计算共同决定战斗构筑。遗迹秘宝使用 `CFG.chips`、`chipInv`、`makeChip` 体系；它和英雄能量水晶是两套并存系统，不能只改展示名称就改标识符。物品/武器/保险契约/宝箱/卡牌均需分清局内资产、消耗品和局外资产。

主要输入：拾取、丢弃、装备/卸下、武器升级、保险选择、撤离成功、死亡。主要输出：`Inventory`及`weaponInv`变化、重算属性、结算折算明细、Meta结晶/等级/契约持久化。容量满、重复装备、无效对象、余额不足、无物资死亡必须返回确定结果，不能静默成功。

## 已核实的经济事实
- `calcSettleConvert(run)`逐件处理背包与`weaponInv`，按物品价值乘统一 `rate=0.5` 后 `Math.floor`；遗迹秘宝不带出、不折算，`chipValue=0`。
- `Meta.awardRun(kills,bossDefeated,extracted)`只按配置给Boss结晶奖励；死亡应用`deathRatio`并向下取整，`crystalKill`已退役。
- 主线成功撤离事件另加 `calcSettleConvert(G.run).total`，死亡无物资折算。经验和金币归零，不参与折算。
- `UI.metaUpgradeWeapon(id)`先校验余额并扣除`Meta.weaponUpCost`，再调用`Meta.weaponUp(id)`；“武器升级免费”不是已证实问题。
- `cardAssets`初始化为0，注释标为退役恒0；`items/UI/modes`仍保留消费、界面和`cardValue:4`兼容折算分支。旧UI写有“升级获得”，但本轮未发现新增来源，因此“兼容可达性”仍须验证，不能宣称已经修复或已彻底不可达。

当前数值快照：`CFG.outLevel.crystalBoss=60`（配置注释20.10从30调整到60），`valueRate=0.5`、`deathRatio=0.3`。蓝图§19.8的30属于历史文字，不能标成当前配置。`Meta.awardRun`在game，成功撤离的额外折算在main；“击败Boss时直接发放”的蓝图文字与统一结算时点是否一致，仍需逐入口验证，不据此宣称重复或漏发。

## 死亡与保险
`calcDeathPenalty`先处理未开宝箱，再对非保险物品/武器按价值随机取到 `totalValue*loseRatio` 的损失目标；`lostValue`含宝箱，`totalValue`不含宝箱；保险保最高价值物品，并按实际件数消耗契约。该实现与“按未保险占格70%”类旧描述不同，书中只登记差异，等待产品确认。

死亡结算至少观察：宝箱是否先丢、保险选择稳定性、重复死亡事件、防止负库存、没有非保险物品时的结果、随机种子与报告字段。不能把一次随机样本当作百分比精确证明。

## 配置、符号与命令
[物品实现](../../js/items.js)：`Inventory`、`makeChip`、`computeStats`相关定位。
[Meta](../../js/game.js)：`Meta.awardRun`、`Meta.weaponUp`、`Meta.weaponUpCost`。
[结算](../../js/modes.js)：`calcSettleConvert`、`calcDeathPenalty`。
[UI](../../js/ui.js)：`UI.metaUpgradeWeapon`。

```powershell
rg -n 'calcSettleConvert|deathRatio|lostValue|totalValue|insurance|weaponUpCost|metaUpgradeWeapon|cardAssets|chipValue' js
node econ_test.js
node settle_crystal_test.js
node backpack_test.js
node chip_behavior_test.js
node shop_test.js
```

## 边界与待决项
- [玩法蓝图](../game_design_proposal.md)§19.8已批准Boss奖励与撤离物资折算双来源，不再提交“双来源是否成立”的重复决策。该节旧数值30与当前CFG的60、以及“全部物品”与遗迹秘宝排除的措辞，应分别追踪历史和适用边界；不得以书稿代替批准规则。
- 卡牌兼容分支的来源可达性未证明：检查所有赋值点、升级路径、撤离显示和消费入口，再决定删除还是保留兼容。
- 保险按价值保护与产品旧文案冲突，需用固定种子覆盖价值相同/不同、多件/无契约情况。
- 折算/死亡/升级必须经过真实Meta对象及持久化流程，不只测纯函数。
- 结算重复触发、刷新后Meta一致性、半途切换工匠面板仍待测试。

## 可执行验收与实现状态
现有core/feature测试在verified-run通过，但不能等同于完整经济验收。必要验收包括：创建含宝箱、武器、背包物品、遗迹秘宝、卡牌兼容字段的run→分别成功撤离和死亡→比对明细、Meta和保险契约→重复提交→刷新读取。当前背包、装备、结算与升级主链已存在；规则冲突、卡牌来源和完整存档接线仍是差异/后续任务。
