# 经济与保险设计 v1 · C3 局内保险来源重设计 & C4 结晶速率与局间永久解锁

> 状态：**AI 出设计并拟落库清单，待用户事后审**（沿用 `decision_log_v1.md` **D012** 先例：C 类玩法决策授权 AI 出设计并落库，用户事后审）。
> 本轮**只产设计文档，不改任何代码**：本文件为**唯一新建文件**；未修改任何 `js/*.js`、`index.html`、`css/*`、`run_tests.sh`、任何其它 `G_docs/*` 文档、任何测试文件。
> 真源口径（`00-reading-map.md`：代码只裁定实现事实）：本文所有「现状」均**直读代码**得出，引用一律「`文件名:行号`」；所有「提议」与现状严格分行标注。
> 判定词表：**已证实**（有代码/批准文档证据）· **未发现证据**（检索后无命中，不等于不存在）· **待裁决**（需用户拍板，AI 不自决）。
> 换行 LF，中文书写。

---

## 0. 任务边界与依据

| 项 | 内容 |
| ---- | ---- |
| C3 | 局内保险来源重设计。原「**工匠雕像打标**」方案已废弃（`game_design_proposal.md:285`、`:576`、`:1193`）→ **局内保险来源需重新设计** |
| C4 | 结晶获取速率（局内产出节奏）+ 局间永久解锁内容。依据 `game_design_proposal.md:1190`（「结晶的获取速率……与局间其他永久解锁内容待细化」） |
| 权威源 | 玩法 → `G_docs/game_design_proposal.md`；本文件**不创造批准**，只摆方案与落库位号 |
| 决策先例 | `decision_log_v1.md` D012（AI 直接给设计并落库，用户事后审）· `decision_options_c2_c6_v0.1.md`（体例参考） |
| 命中的 C 类条目 | `full_dev_plan_v1.md:59`（C3 局内保险来源 / `game_design_proposal.md:1193`）· `full_dev_plan_v1.md:60`（C4 结晶速率 / `:1190`） |

### 0.1 本文直读的真源（实测，均已在代码中逐一核对）

| 文件 | 行号 | 内容 |
| ---- | ---- | ---- |
| `js/config.js` | 1913 | `CFG.insurance`（保险契约：name/chance/weight/value/maxStack） |
| `js/config.js` | 2254 | `CFG.artisanServices.buyInsurance.cost = 150`（工匠世界购保险入口） |
| `js/config.js` | 2135 | `CFG.deathPenalty = { loseRatio: 0.7 }` |
| `js/config.js` | 2144~2164 | `CFG.outLevel`（`maxLevel` / `crystalBoss:60` / `deathRatio:0.3` / `crystalKill:1`退役） |
| `js/config.js` | 2165~2173 | `CFG.outLevel` 配平口径注释（单局 75 / 满级 1602 / ≈21 局） |
| `js/config.js` | 2213~2219 | `CFG.settleConvert`（`valueRate:0.5` / `cardValue` 已废弃 / `chipValue` 已被取代） |
| `js/config.js` | 2290~2304 | `CFG.starterCount=6` / `CFG.testUnlockAllHeroes=true` / `CFG.unlockRules` |
| `js/config.js` | 1921~1928 | `CFG.weaponLevel`（`maxLv:100` / `costBase:120` / `costGrowth:1.05`） |
| `js/config.js` | 931~940 | `CFG.profile`（称号：`firstExtract` / `bossKill`） |
| `js/config.js` | 1637~1661 | `CFG.altars`（现有 9 行祭坛，effect 积木：heal/randomBuff/giveChest/adjustMonsters/teleport/rift） |
| `js/config.js` | 1967~1973 | `CFG.chestDrop`（elite/boss 掉落几率与品质权重） |
| `js/config.js` | 2029~2034 | `CFG.chestQualities`（5 阶宝箱固定价值 20/60/150/400/1000） |
| `js/config.js` | 2612 | `CFG.endless.reward = { base: 8, exp: 1.15 }`（每波结晶公式） |
| `js/game.js` | 131~250 | `Meta`（`data` / `levelUp` / `weaponUp` / `unlockHero` / `awardRun` / `awardBossCrystal`） |
| `js/game.js` | 1355~1361 | `World.triggerAltar`（触发即消失 + 逐条 `execEffect`） |
| `js/game.js` | 1363~1409 | `World.execEffect`（`case "heal"/"randomBuff"/"giveChest"`） |
| `js/modes.js` | 42~71 | `calcDeathPenalty`（保险按件保护最高价值物 + `contractsUsed`） |
| `js/modes.js` | 78~103 | `calcSettleConvert`（统一 `valueRate` 折算） |
| `js/modes.js` | 280~287 | `outLevelCost`（指数曲线，缺 `growthRate` 回落线性） |
| `js/items.js` | 236~249 | `makeInsurance` / `insuranceCount` / `consumeInsurance` |
| `js/items.js` | 1220~1222 | 保险叠加（`tryStackInsurance` 段） |
| `js/items.js` | 1369~1370 | `rollShopItem`（工匠世界购道具池：insurance / curse） |
| `js/items.js` | 1363~1373 | `shopBuyItem`（局内金币购道具入口） |
| `js/main.js` | 479~497 | 撤离结算链（`calcSettleConvert` → `awardRun` → 补 Boss → 解锁下一关 → `setFlag("firstExtract")`） |
| `js/main.js` | 499~516 | 死亡结算链（`awardRun(...,false,false)` + 补 Boss + `showDeath`） |
| `js/ui-screens.js` | 898~903 | 工匠世界「购买保险契约」UI |
| `js/ui-screens.js` | 1150~1163 | 死亡面板（`contractsUsed` / `byInsurance` 展示） |
| `js/ui.js` | 1369~1376 | HUD 保险图标（`insuranceCount`） |

---

## 1. 现状实测：两条链各自「已实现到哪一步」

### 1.1 保险链（C3）

| # | 环节 | 位置 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| I1 | **契约配置** | `js/config.js:1913` | **已实现** | `{ name:"保险契约", chance:0.15, weight:5, value:60, maxStack:9 }` |
| I2 | **契约构造/统计/消耗** | `js/items.js:236` / `:240` / `:243` | **已实现** | `makeInsurance` / `insuranceCount` / `consumeInsurance` |
| I3 | **契约叠加** | `js/items.js:1220~1222` | **已实现** | 同 kind 未满堆叠则 `count++` 且 `value` 同步 |
| I4 | **来源①：开箱几率掉出** | `js/items.js:1369~1370`（`rollShopItem`）；`js/ui-screens.js:849~854`（开箱 toast） | **已实现** | `U.weightedPick({ ins: CFG.insurance.chance, curse: ... })` |
| I5 | **来源②：工匠世界购买** | `CFG.artisanServices.buyInsurance.cost=150`（`js/config.js:2254`）；`js/ui-screens.js:898~903` | **已实现** | 需先遇 `ALTAR_005` 进工匠世界 + 150 局内金币/份 |
| I6 | **来源③：工匠世界「购道具」随机池** | `js/items.js:1369`（`shopBuyItem`） | **已实现** | 150 金币抽，池内 保险/诅咒 按 `chance` 加权 → **不确定** |
| I7 | **死亡生效（保护）** | `js/modes.js:42~71` | **已实现** | 先扣未开封宝箱 → 对非保险物品按 `deathPenalty.loseRatio` 随机损失 → 契约从**损失清单**里按**价值从高到低**逐件捞回，`byInsurance=true`，按实际保护件数消耗契约 |
| I8 | **死亡面板展示** | `js/ui-screens.js:1153`、`:1160` | **已实现** | 「保险契约 N 份已生效（保护 M 件）」+ 保留清单标「⛨保险」 |
| I9 | **HUD 计数** | `js/ui.js:1369~1376` | **已实现** | 背包内契约数 >0 显示图标 |
| I10 | **撤离折算** | `js/config.js:2216~2219`（无独立 `crystalRefund`）；`js/modes.js:78~103` | **已实现** | 契约按固定价值 60 × `valueRate 0.5` = 30 结晶（不再有独立折算价） |
| I11 | **局内确定性来源（除随机开箱外）** | —— | **未发现证据** | 检索 `insurance`/`打标`/`insured` 后，**未发现**任何「战斗地图内定点/保底获取保险」的链路（`打标` 仅命中 `combat.js:411` 的工匠识别与 `endless.js:661` 的怪种标记，均与保险无关） |
| I12 | **原「工匠雕像打标（保险）」** | `game_design_proposal.md:285`、`:576`、`:1193` | **已废弃** | 三处文档明确「方案已废弃，局内保险来源需重新设计」 |

> **一句话**：保险的**消费侧（死亡保护/折算/展示）已全链实现**；**来源侧只有「开箱随机（I4）」与「工匠世界花金币（I5/I6）」两种**，其中 I6 还是随机池；**「局内主动、确定性获取」的来源是空白**——这正是 C3 要补的洞。

### 1.2 结晶链（C4）

| # | 环节 | 位置 | 状态 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| X1 | **来源①：击杀 Boss 即时到账** | `js/config.js:2162`（`crystalBoss:60`）；`js/game.js:244~249`（`Meta.awardBossCrystal`） | **已实现（D016/20.10「击败即发」）** | 击败瞬间 `+60`；**非幂等**，由 `r.bossCrystalAwarded` 门控（`js/game.js:243`） |
| X2 | **来源②：撤离彻底折算** | `js/config.js:2214`（`valueRate:0.5`）；`js/modes.js:78~103` | **已实现** | 背包/武器栏/`chipInv` 每件按固定价值 ×0.5；宝箱/装备/模块/道具/秘宝同一套；经验金币不折算 |
| X3 | **死亡保留** | `js/config.js:2163`（`deathRatio:0.3`）；`js/game.js:232~239` | **已实现** | `awardRun` 死亡路径 `floor(crystalBoss×0.3)`；折算不发生 |
| X4 | **小怪击杀给结晶** | `js/config.js:2161`（`crystalKill:1`） | **已退役** | 值保留仅为兼容；`awardRun` 的 `kills` 参数不参与计算（`js/game.js:230~233`） |
| X5 | **结算入口（撤离/死亡）** | `js/main.js:479~486`（撤离）· `:510~512`（死亡） | **已实现** | 撤离 = `awardRun(...,false,true)+conv.total+bossGain`；死亡 = `awardRun(...,false,false)+bossGain`（**不回扣**） |
| X6 | **结算报告** | `js/modes.js:517~530`（`buildCrystalReport` 段）；`js/game.js:237`（`publishCrystalReport` 挂点） | **已实现** | 明细含「击杀首领 +60 / 物资折算 +N / 本局合计」 |
| X7 | **局外等级花费曲线** | `js/config.js:2145~2148`（`costBase:50` / `growthRate:1.3`）；`js/modes.js:280~287` | **已实现** | LV n→n+1 = `round(50×1.3^(n-1))`；满级累计 **1602** |
| X8 | **深渊/无尽结晶** | `js/config.js:2612`（`reward:{base:8,exp:1.15}`）；`js/rewards.js:173~180`（`keptOnDeath`） | **已实现** | 每波 `round(8×wave^1.15)`；死亡依 `deathRatio`；**与主线口径独立** |
| X9 | **配平自检锚** | `js/config.js:2165~2173` | **已实现（注释口径）** | 「单局预期 75 = 60 + 30 价值×0.5」是**注释里的假设值**（典型剩余物资 ≈30 价值），**非实测统计** |
| X10 | **局间永久解锁内容清单** | —— | **未发现证据** | 除「进化结晶 + 局外角色等级 + 武器等级」外，**未发现**任何单列的、成文的「局间永久解锁」权威清单（现有解锁散落在 `CFG.unlockRules` / `unlockedLevels` / `CFG.profile` / `codex`，见 §1.3） |
| X11 | **深渊结晶封顶** | —— | **未发现证据** | `CFG.endless` 与 `CFG.endless.reward` 中**未发现**任何单局结晶上限字段 |

### 1.3 局外持久资产现状（C4 解锁清单的事实基线）

均落在 `Meta.data`（`js/game.js:132`：`{ crystals, heroes, unlockedLevels, profile, codex, unlockExtra }`）：

| 资产 | 字段 | 实现位置 | 状态 |
| ---- | ---- | ---- | ---- |
| 进化结晶（货币） | `data.crystals` | `js/game.js:132` | 已实现 |
| 局外角色等级（上限 10） | `data.heroes[id].level` | `js/game.js:190~200` | 已实现 |
| 武器/技能等级（上限 100） | `data.heroes[id].weaponLv` | `js/game.js:217~228` | 已实现 |
| 英雄解锁（首发 6 + 规则解锁） | `data.unlockExtra` / `CFG.unlockRules` | `js/game.js:204~215`；`js/config.js:2295~2304` | 已实现（测试期 `testUnlockAllHeroes=true` 全开，`:2294`） |
| 关卡解锁 | `data.unlockedLevels` | `js/main.js:488~492` | 已实现（**仅撤离成功**解锁下一关，死亡不解锁） |
| 皮肤 / 形象 | `data.profile.skinId`；`data.codex.heroes` | `js/game.js:158~166` | 已实现（图鉴激活即解锁同名皮肤） |
| 称号 | `data.profile.titleId`；`CFG.profile.titles` | `js/game.js:167~176`；`js/config.js:935~939` | 已实现（`firstExtract` / `bossKill` 两个成就旗标） |
| 怪物图鉴 | `data.codex.monsters` | `js/game.js:181~183` | 已实现 |
| 遗迹秘宝图鉴 | `data.codex`（`CFG.chipCodex`） | `js/config.js:1819` | 已实现 |

> **结论**：C4 的「局间永久解锁内容」**并非空白**——已存在 8 类；缺的是**成文清单 + 与结晶速率的耦合口径**，以及是否**再新增**解锁项（见 §3.4）。

---

## 2. C3 · 局内保险来源重设计

### 2.0 问题本体

> 现状「局内获取保险」= **开箱随机（0.15 概率）**（I4）或 **花 150 金币在工匠世界买**（I5）；前者不可控、后者要金币 + 要先遇到 `ALTAR_005`。
> 而「已保险物品不参与掉落」（`game_design_proposal.md:576`）是搜打撤**风险对冲**的核心手感——玩家需要一条**可规划、有代价**的局内获取路径。原「工匠雕像打标」正是这条路径，废弃后留空。

### 2.1 四个候选来源

> 统一口径：**保护范围**沿用现状语义（`js/modes.js:58~67`：每份契约在**死亡损失清单**里捞回 **1 件价值最高**的物品）；**生效时机**一律 = **死亡结算时**（撤离不发生保护，契约走折算）。

#### 候选 A · 工匠世界购买（现状保留 + 提权）

| 维度 | 内容 |
| ---- | ---- |
| 来源 | 进入工匠世界后花金币购买（现状 I5，`js/ui-screens.js:898~903`） |
| 获取成本 | 150 局内金币 / 份（`CFG.artisanServices.buyInsurance.cost`，`js/config.js:2254`） |
| 保护范围 | **1 件/份**（现状；契约不参与损失） |
| 生效时机 | 死亡结算 |
| 评价 | **零新增开发**；但依赖「遇 `ALTAR_005` + 攒够金币」，**局内不可规划**（雕像由击杀里程碑触发，`js/config.js:1657` weight=0） |

#### 候选 B · 局内「保险雕像」祭坛（新增 `ALTAR_007`）

| 维度 | 内容 |
| ---- | ---- |
| 来源 | 战斗地图内随机/时间轴刷出的新祭坛，**读条触发**即获得保险契约（复用 `CFG.altars` + `World.triggerAltar` + `execEffect`，`js/game.js:1355~1361`） |
| 获取成本 | **时间与风险**：读条期间站定（受击归零，与女神/战争雕像同口径）+ 读条可能招来围攻 |
| 保护范围 | **1 件/份**（每次触发给 `count` 份，`count` 可配；建议 1） |
| 生效时机 | 死亡结算 |
| 评价 | 与「搜打撤 · 主动搜刮」核心最贴；**复用现有祭坛框架**，新增面 = 1 行 `CFG.altars` + 1 个 `execEffect` 分支；需进祭坛池或走时间轴（`js/config.js:1637`） |

#### 候选 C · 精英/Boss 掉落「保险凭证」（复用 `CFG.chestDrop` 链路）

| 维度 | 内容 |
| ---- | ---- |
| 来源 | 精英/Boss 按几率掉落（对齐 D016 宝箱掉落的「几率 + 落地 + 读条拾取」范式） |
| 获取成本 | **击杀风险**（无额外成本） |
| 保护范围 | **1 件/份** |
| 生效时机 | 死亡结算 |
| 评价 | 与 D016 宝箱掉落的链路**高度重叠**；若与 `CFG.insurance.chance`（开箱掉）叠加，会与候选 A/B 三源齐发，通胀风险 |

#### 候选 D · 成就式保障（保底背书）

| 维度 | 内容 |
| ---- | ---- |
| 来源 | 无实体来源：约定「**本局首件高价值物品自动保险**」或「每局免费 N 份」 |
| 获取成本 | **0**（或有次数上限） |
| 保护范围 | 建议 **1 件/局**（保底），可随局外等级提升 |
| 生效时机 | 死亡结算 |
| 评价 | 体验最稳（降低死亡挫败），但**削弱搜打撤的风险张力**；且与 `deathRatio 0.3`/`loseRatio 0.7` 的惩罚语义冲突 |

### 2.2 候选对比表

| 维度 | A 工匠世界购买 | B 局内保险雕像（新 `ALTAR_007`） | C 精英/Boss 掉落凭证 | D 成就式保底 |
| ---- | ---- | ---- | ---- | ---- |
| **玩家体验** | 可控但**不可局内规划**（要先遇到雕像 + 有金币） | **可规划、有张力**（主动读条换对冲） | 随机、随击杀节奏 | 最稳但**削弱风险感** |
| **实现改动面** | **零**（已实现） | 小：`CFG.altars` 加 1 行 + `execEffect` 加 1 个 `case`（`js/game.js:1363`）+ 进池/时间轴 | 中：抄 D016 链路（几率 + 落地 + 读条拾取 + 叠加入包） | 小：`calcDeathPenalty` 加保底分支（`js/modes.js:42`） |
| **风险** | 低（但**覆盖率低**，等于没解决 C3） | 低~中（读条期被围 = 已有风险模型，可复用） | 中（保险通胀 → 与 A/B 叠加） | 中（**动核心惩罚语义**，须联动 `loseRatio`/`deathRatio`） |
| **与现有系统重叠度** | 与 C 的「消耗品入包」重叠（同 `makeInsurance`） | **与现有祭坛零重叠**（ALTAR_001~005 各司其职，`js/config.js:1638~1658`） | **与 D016 宝箱掉落链高度重叠**（`CFG.chestDrop`） | 与结算/惩罚链重叠 |
| **是否解决 C3「局内来源」** | ❌ 仍不可局内规划 | ✅ | ⚠️ 半（仍是随机） | ✅（但代价大） |

### 2.3 推荐

> **推荐：候选 B（局内保险雕像 `ALTAR_007`）为主来源 + 保留候选 A（工匠世界购买）为补充。**
> **不推荐**叠加候选 C（与 D016 宝箱链路重复，且通胀）；**候选 D 暂缓**（动惩罚语义，须与 `loseRatio`/`deathRatio` 一并拍板）。

理由（每条一句）：
1. **正面回答 C3**：只有 B 提供「战斗中**主动、确定性**」的保险获取，其余候选要么不可规划（A）、要么仍随机（C）。
2. **复用率最高、架构零扩张**：`CFG.altars` 的 effect 积木 + `World.triggerAltar`/`execEffect`（`js/game.js:1355~1409`）已是「读条 → 触发 → 给物」，B 只是新增一个 effect 分支与一行祭坛配置。
3. **与现有祭坛零重叠**：`ALTAR_001~005` 分别是治疗/增益/宝箱/邪神/传送（`js/config.js:1638~1658`），**无一是保险**；B 不挤占任何既有祭坛的职能。
4. **风险模型现成**：读条期受击归零 + 圈外被围攻（毒圈/围攻系统，`js/modes.js`）已是既有压力载体，B 直接继承。
5. **A 作为补充保留**：工匠世界已是「金币消费场所」（`game_design_proposal.md:534`），保险在售（`:1255`）是既有批准项，无需改动。

### 2.4 保护范围细化（拍板项，见 Q2）

现状 = **按件 × 1 件/份**（`js/modes.js:58~67`）。设计上给出三个口径供选：

| 口径 | 语义 | 契约经济 | 备注 |
| ---- | ---- | ---- | ---- |
| **P1 按件（现状）** | 1 份 = 保 1 件最高价值 | 保护强度 = 契约份数 | **零改动**，推荐默认 |
| P2 按品质门槛 | 1 份 = 保所有「金/紫」件 | 高价值多件时更强 | 需求新字段 `protectMinQuality` |
| P3 全保 | 1 份 = 本局全保 | 保险过强，与 `loseRatio 0.7` 冲突 | 不推荐 |

---

## 3. C4 · 结晶获取速率 + 局间永久解锁

### 3.1 每局预期结晶产出（量级锚）

> 口径来源：`js/config.js:2165~2173` 的自检注释只给了一个**假设值**（「典型剩余物资 ≈30 价值 → 15 结晶」），**未发现**实测统计。下表以**真实 CFG 数值**重算，给出量级区间。

| 场景 | 构成 | 单局结晶（量级） |
| ---- | ---- | ---- |
| 普通撤离 · 轻搜刮（未杀 Boss） | 纯折算：≈30 价值 × 0.5（沿用配平注释假设） | **≈15** |
| 普通撤离 · 满搜刮（未杀 Boss） | 折算：≈100 价值 × 0.5（≈1 史诗箱 150 或 3 高级箱） | **≈50** |
| 带 Boss 撤离 · 轻搜刮 | 60（`crystalBoss`）+ 15 | **≈75** |
| 带 Boss 撤离 · 满搜刮 | 60 + 50 | **≈110** |
| 死亡（打过 Boss） | `floor(60×0.3)` = 18；折算不发生 | **18** |
| 死亡（未打 Boss） | 0 | **0** |
| **深渊/无尽** | `Σ round(8×wave^1.15)`（`js/config.js:2612`）× 死亡保留 0.3 | **见 §3.3（数量级异常）** |

> 数值依据：宝箱固定价值 `CFG.chestQualities`（20/60/150/400/1000，`js/config.js:2030~2034`）；装备 = 30×品质系数、模块 = 45×品质系数（`js/config.js:2208`）；折算率 0.5（`js/config.js:2214`）。

### 3.2 局外等级升到 N 级需要几局

> 曲线：`outLevelCost` = `round(50 × 1.3^(lv-1))`（`js/config.js:2145~2148`、`js/modes.js:280~287`）。
> 累计花费（已按 `Math.round` 逐级求和，满级 = **1602**，与 `js/config.js:2171` 一致）：

| 目标 | 累计结晶 | 按 15/局 | 按 50/局 | 按 75/局（带 Boss 轻搜刮） | 按 110/局 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| LV 2 | 50 | 4 局 | 1 局 | 1 局 | 1 局 |
| LV 5 | 310 | 21 局 | 7 局 | **4 局** | 3 局 |
| LV 8 | 880 | 59 局 | 18 局 | **12 局** | 8 局 |
| LV 10（满级） | **1602** | **≈107 局** | **≈32 局** | **≈21 局** | **≈15 局** |

- **设计目标区** = 15~25 局（`js/config.js:2172` 原文「落在设计目标 15~25 局的舒适区」）。
- **实测结论**：只有「**带 Boss 撤离**」（75/局 → ≈21 局）落在目标区；**纯轻搜刮撤离**（15/局 → ≈107 局）**远超目标**。
- **推算**：若玩家仅 ~70% 对局能击杀 Boss（混合 0.7×75 + 0.3×30 ≈ **61.5/局**）→ ≈**26 局**，**略高于目标上限**。
- → 结论：**速率达标与否完全取决于「击杀 Boss 的对局占比」**；这是**待裁决 Q6**（是否调 `crystalBoss` 或抬折算侧，把混合场景压回 15~25 局）。

### 3.3 深渊/无尽速率异常（实测发现，须裁决）

| 波次 | 单波结晶 `round(8×w^1.15)` | 累计（推算） |
| ---- | ---- | ---- |
| wave 1 | 8 | 8 |
| wave 5 | 51 | 144 |
| wave 10 | 113 | **≈582** |
| wave 30 | 400 | **≈5.6~5.8k（量级 ≈5×10³）** |

- 累计由 `Σ round(8×w^1.15)` 逐项重算（区间估算）；**前 10 波 ≈580、前 30 波 ≈5.6k~5.8k**。
- **与主线对比**：主线单局 15~110 结晶 → **深渊单局可达主线 10~50 倍**（且死亡仅 ×0.3）。
- **未发现证据**：`CFG.endless`（`js/config.js:2585~2624`）与 `CFG.endless.reward` 中**无任何单局结晶上限字段**（X11）。
- → **这是 C4 必须裁决的点**：深渊结晶是否（a）封顶、（b）按比例折入局外等级经济、（c）维持现状（视为高风险高回报）。

### 3.4 局间永久解锁内容清单

#### 3.4.1 已实现（现状基线，非新增）

| # | 解锁项 | 解锁条件 | 效果 | 落点 |
| ---- | ---- | ---- | ---- | ---- |
| U1 | 局外角色等级（≤10） | 花进化结晶 | hp/atk/def 成长（`growthByRole`+`growthTable` 分段） | `js/game.js:190` |
| U2 | 武器/技能等级（≤100） | 花进化结晶（`120×1.05^(lv-1)`） | 普攻 +4%/级、技能 +6%/级 | `js/game.js:221`；`js/config.js:1921` |
| U3 | 英雄解锁 H007~H012 | `heroLv` 达标 或 花结晶 | 可选用该英雄 | `js/config.js:2295~2304` |
| U4 | 关卡解锁 | **撤离成功**通关第 n 关 | 可进第 n+1 关 | `js/main.js:488~492` |
| U5 | 皮肤/形象 | 图鉴激活该英雄（用过即激活） | 主城可用该形象 | `js/game.js:160` |
| U6 | 称号 | 成就旗标（`firstExtract` / `bossKill`） | 主城可佩戴 | `js/config.js:935~939` |
| U7 | 怪物图鉴 | 击杀即收录 | 图鉴点亮 | `js/game.js:181` |
| U8 | 遗迹秘宝图鉴 | 拾取即收录 | 图鉴点亮 | `js/config.js:1819` |

#### 3.4.2 拟新增（**待裁决 Q5**，🔧 占位）

| # | 解锁项 | 解锁条件（🔧） | 效果（🔧） | 与 C3 的关系 |
| ---- | ---- | ---- | ---- | ---- |
| N1 | **保险常驻额度** | 局外等级里程碑（如 LV3/LV6/LV9 各 +1） | 每局**开局自带** N 份保险契约（N = 已解锁额度） | 直接给 C3 提供「局外沉淀 → 局内对冲」的循环 |
| N2 | **保险雕像刷出权重** | 局外等级里程碑 | 提升 `ALTAR_007` 在祭坛池/时间轴的权重（`weight`） | 让 C3 来源随成长变可靠 |
| N3 | **折算率微增** | 局外等级里程碑 | `settleConvert.valueRate` 由 0.5 → 0.55/0.6（分档） | 直接抬 C4 速率（须防通胀） |
| N4 | **深渊结晶封顶档** | 深渊首次通关 | 解锁/提升深渊单局结晶上限（对应 §3.3） | 与 Q4 耦合 |
| N5 | **赛季（无限地图）** | 99 关全通 | 进入赛季玩法 | `game_design_proposal.md:1189`（首版暂缓） |

> 建议：N1 + N2 优先（与 C3 直接耦合、数据驱动、不动核心惩罚语义）；N3 慎用（直接抬速率易通胀）；N4/N5 与 Q4/Q5 一并定。

---

## 4. 落库清单（要改的 `CFG` 字段）

> 全部**数据驱动**；**🔧 = 占位值，待策划定稿**。本轮**不改代码**，下表即「实现批次」的施工单。
> 位置列给「插在何处」，以现有代码为锚（不移动既有行）。

### 4.1 C3 落库

> ✅ **已落库并接线（2026-10-13 本轮落库，见 D026）**：C3-4 `CFG.insuranceSource` **消费点已接线**（`insuranceSlot` 开局按里程碑发放 / `altarWeight` 权重查询；**默认值下行为不变**）；局外解锁里程碑来源 = `CFG.outLevel.unlockMilestones`（**用既有 `Meta.data.heroes` 派生，不加新存档键**）。

| # | 字段 | 现位置 / 插入点 | 默认值（🔧 占位） | 注释要点 | 状态 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| C3-1 | `CFG.altars.ALTAR_007`（**新增**） | `js/config.js:1637` 的 `CFG.altars` 块内（附表尾） | `{ name:"保险雕像", color:"#5aa2ff", icon:"⛨", radius:117, channel:1.5, weight:0, effects:[{ type:"giveInsurance", count:1 }] }` | 与 ALTAR_001~005 同族；`weight:0` 先不自动进池（走 Q1 定向投放） | 🔧 |
| C3-2 | `effects[].type = "giveInsurance"`（**新 effect 类型**） | 消费点：`js/game.js:1363` `World.execEffect` 的 `switch(ef.type)` 加一个 `case` | `count`（份数，默认 1） | 复用 `makeInsurance()` + `grantItemToRun`（`js/items.js:236`） | 🔧 |
| C3-3 | `CFG.insurance.protectItems`（**新增**，保护范围） | `js/config.js:1913` 的 `CFG.insurance` 块内 | `1`（每份保护 1 件） | 对应 §2.4 P1；改 P2 再加 `protectMinQuality` | 🔧 |
| C3-4 | `CFG.insuranceSource`（**新增**，多来源开关，数据驱动） | `js/config.js:1913` 之后新增一小表 | `{ altar:{ enabled:true, id:"ALTAR_007", count:1 }, artisan:{ enabled:true }, chestDrop:{ enabled:true }, eliteDrop:{ enabled:false, chance:0 }, assured:{ enabled:false, count:0 } }` | 收口「保险从哪来」的开关与权重，避免散落魔法数 | 🔧 |
| C3-5 | `CFG.artisanServices.buyInsurance`（**保留**） | `js/config.js:2254` | `{ cost:150, desc:"购买 1 份保险契约" }`（不变） | 候选 A 保留；若实施 §3.4.2 N1 可再补 `metaBonus` | 已实现 |

### 4.2 C4 落库

> ✅ **已落库并接线（2026-10-13 本轮落库，见 D026 · 对应下述 Q4 / Q5）**：C4-2 `CFG.outLevel.unlockMilestones` **已接线**（`Meta.data.heroes` 派生，不加新存档键）；C4-3 `CFG.endless.crystalCapPerRun` **已落库**（默认 `0` = 不封顶）。当前默认值下**行为不变**。

| # | 字段 | 现位置 / 插入点 | 默认值（🔧 占位） | 注释要点 | 状态 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| C4-1 | `CFG.outLevel.crystalRate`（**新增**，速率锚表） | `js/config.js:2164`（`CFG.outLevel` 块尾） | `{ salvageValueAssumed:30, deathLossValue:0, targetRuns:{ min:15, max:25 }, mixedBossRate:0.7 }` | 把「配平注释」变成可测数据；供 `out_level_flow_test` 自检引用（勿再写死 15） | 🔧 |
| C4-2 | `CFG.outLevel.unlockMilestones`（**新增**，局间解锁里程碑） | `js/config.js:2304` 附近（`unlockRules` 之后） | `[ { lv:3, unlock:"insuranceSlot", amount:1 }, { lv:6, unlock:"insuranceSlot", amount:1 }, { lv:9, unlock:"altarWeight", id:"ALTAR_007", delta:6 } ]` | 对应 §3.4.2 N1/N2；纯数据，消费点在 `isHeroUnlocked` 同级纯函数 | 🔧 |
| C4-3 | `CFG.endless.crystalCapPerRun`（**新增**，深渊封顶） | `js/config.js:2612`（`reward` 行附近） | `0`（= 不封顶；建议 Q4 定 2000 或按档） | 对应 §3.3；消费点 `Endless.settle().crystals` 收口 | 🔧 |
| C4-4 | `CFG.outLevel.crystalBoss`（**保留**） | `js/config.js:2162` | `60`（不变，除非 Q6 改判） | 来源①；改动会触发 `meta_growth_test`/`out_level_flow_test` 断言 | 已实现 |
| C4-5 | `CFG.endless.reward`（**保留**） | `js/config.js:2612` | `{ base:8, exp:1.15 }`（不变，除非 Q4 改判） | 深渊每波公式；**超线性**，见 §3.3 | 已实现 |

### 4.3 落库后同步项（不在本轮范围，登记备查）

- `verify_clone.sh` 指纹表 / 基线断言数（`AGENTS.md` §六-5）。
- 权威章节回写：`game_design_proposal.md:1193`（C3）、`:1190`（C4）、`:576`（保险来源）、`:1497~1501`（死亡掉落）——按 `AGENTS.md` §一-铁律 7「拍板即回写」。
- `decision_log_v1.md` §2 表尾新增一行（编号递增，如 `D017`），状态按拍板结果填写。

---

## 5. 待裁决项（必须用户拍板）

| 编号 | 裁决点 | AI 建议 | 影响面 |
| ---- | ---- | ---- | ---- |
| **Q1** | **C3 采用哪个（哪些）来源** | 以 **B（保险雕像 `ALTAR_007`）为主 + A（工匠世界购买）保留**；不叠 C；D 暂缓 | `CFG.altars` / `js/game.js` `execEffect` / 祭坛池 |
| **Q2** | 保险**保护范围**口径（P1 按件 / P2 按品质 / P3 全保） | **P1 按件（现状，零改动）** | `js/modes.js:58~67` |
| **Q3** | 保险契约**单局上限**（`maxStack:9` 是否保留）与是否允许「多份叠加保护多件」 | 保留 9；沿用「按件消耗」 | `CFG.insurance.maxStack` |
| **Q4** | **深渊/无尽结晶是否封顶**、是否计入局外等级经济（§3.3 量级异常） | 建议**封顶**（`crystalCapPerRun`），或与主线分离计价<br>✅ **部分落库（D026）**：`CFG.endless.crystalCapPerRun` **已落库**（默认 `0` = 不封顶）；**封顶策略取值仍待用户拍板** | `CFG.endless` / `js/rewards.js` |
| **Q5** | **局间永久解锁清单**是否采纳 N1~N5（尤以 N1/N2 与 C3 耦合） | 采纳 **N1 + N2**；N3 慎用；N4/N5 与 Q4 一并定<br>✅ **已落库并接线（D026）**：N1 `insuranceSlot` / N2 `altarWeight` 已由 `CFG.outLevel.unlockMilestones` **接线**（默认 0 份，行为不变）；N3/N4/N5 仍待审 | `CFG.outLevel.unlockMilestones` / `Meta` |
| **Q6** | **速率目标**：接受 15~25 局，还是把混合场景压回目标（调 `crystalBoss` 或抬折算侧） | 保持 `crystalBoss=60`，用 Q5-N3 **可选**微调 | `CFG.outLevel` |
| **Q7** | 是否**保留**开箱随机掉保险（`CFG.insurance.chance=0.15`） | 保留（作为第三条随机来源，权重不增） | `CFG.insurance.chance` |
| **Q8** | 是否给保险加**局外常驻额度**（N1）作为局外成长 | 采纳（与 C3/C4 双向耦合） | `Meta.data` / `CFG.unlockRules` |

---

## 6. 回归影响（会牵动哪些测试）

> 结论：**C3 只新增来源 → 主要牵动「祭坛/工匠」类测试**；**C4 动速率数值 → 牵动「结晶配平/结算」类测试**。
> 下表均为**实测存在的测试文件**（`ls *_test.js` 共 106 个）与其真实断言行号。

### 6.1 结晶链（C4 高危，改任一数值都会黄）

| 测试文件 | 命中行号 | 会因何变动 |
| ---- | ---- | ---- |
| `out_level_flow_test.js` | `:36`（读 `CFG.outLevel`）· `:109~116`（**单局预期产出 + 配平自检**，引用 `crystalBoss`/`valueRate`）· `:120~144`（`awardRun` 三路径 + 报告明细） | 改 `crystalBoss` / `valueRate` / 预期产出口径 |
| `settle_crystal_test.js` | `:26`（awardRun 挂点）· `:37`（内联 `crystalBoss:60/deathRatio:0.3/valueRate:0.5`）· `:107~118`（main.js 调用顺序 `Meta.awardRun(G.run.kills,false,true/false)`） | 改数值或改 `main.js` 结算顺序 |
| `exp_test.js` | `:114~124`（小怪退役 / Boss 结晶 / 死亡 `floor(crystalBoss×deathRatio)`） | 改 `crystalBoss` / `deathRatio` |
| `meta_growth_test.js` | `:126~134`（`crystalBoss===60` / `deathRatio===0.3` / `awardRun` 三路径 18 值） | 改 `crystalBoss` / `deathRatio` |
| `xgame_boss_crystal_test.js` | `:93`（`CB = crystalBoss`）· `:110~114`（`awardBossCrystal` 即时入账）· `:177`（`calcDeathPenalty`） | 改「击败即发」值/时机 |
| `endless_reward_test.js` | `:149` / `:157` / `:194`（死亡保留继承 `deathRatio=0.3`） | 改 `deathRatio` 或深渊封顶（C4-3） |
| `rift_extract_test.js` | `:192~193`（超时/死亡同 `deathRatio` 口径） | 改 `deathRatio` |
| `econ_test.js` | `:60~83`（折算：宝箱/装备/模块/卡牌/保险契约统一 `valueRate`） | 改 `valueRate` 或折算口径 |
| `chip_test.js` | `:329`（秘宝折算）· `:342~344`（死亡损失不含秘宝） | 改折算/死亡链 |
| `xgame_chip_fold_test.js` | `:118` / `:128~129` / `:204~207`（`chipValue` 兼容项） | 若清理 `CFG.settleConvert.chipValue` |

### 6.2 保险链（C3）

| 测试文件 | 命中行号 | 会因何变动 |
| ---- | ---- | ---- |
| `smoke_test.js` | `:61`（`calcDeathPenalty`）· `:313~321`（**3 份契约保 3 件 / 契约不损失 / 无 `crystalRefund` / 3 份折算 90**） | 改保护范围（Q2/Q3）或折算 |
| `grant_test.js` | `:85~107`（保险叠加 `value` 同步 / `maxStack` 满堆叠另起） | 改 `maxStack` / 叠加规则 |
| `shop_test.js` | `:118~145`（**购道具池含 insurance/curse 两类**） | 改道具池或来源开关（C3-4） |
| `econ_test.js` | `:72` / `:81`（保险契约按固定价值折算） | 改 `CFG.insurance.value` |
| `artisan_test.js` | `:132~138` / `:177~183` / `:207~220`（`ALTAR_005` 投放/限制器/冷却） | **仅当** C3 复用工匠链路才动；纯新增 `ALTAR_007` 则**不影响** |
| `autofight_test.js` | `:246`（`ALTAR_001`）· `:274`（`ALTAR_005` 工匠识别） | `combat.js:411` 的 `altarKindOf` 若加 `ALTAR_007` 分支则需补断言 |

### 6.3 祭坛池 / 时间轴（若 `ALTAR_007` 进池）

| 测试文件 | 命中行号 | 会因何变动 |
| ---- | ---- | ---- |
| `altar_timeline_test.js` | `:86` / `:91`（`ALTAR_003` 开局不投放）· `:127~128`（池内非法 id 剔除） | 若把 `ALTAR_007` 写入时间轴/池 |
| `runtime_test.js` | `:101~102`（`placeAltar(...,"ALTAR_001")`） | 若加祭坛 kind 分支 |
| `smoke_test.js` | `:427~453`（邪神雕像系）· `:85~88`（`ALTAR_005` 限制器） | 若祭坛行为改动 |

### 6.4 局外成长（若实施 §3.4.2 N1~N3）

| 测试文件 | 命中行号 | 会因何变动 |
| ---- | ---- | ---- |
| `unlock_ui_test.js` | `:281~294`（导师增益预览 = `outLevelStats` 同源差分） | 新增解锁项若改导师 UI |
| `battle_rules_test.js` | `:182`（`growthByRole.aux` 存在性） | 若动 `growthByRole` |
| `skill_save_session_test.js` | `:174~192`（**断言 `Meta.data` 键集不变、无新增键**） | 🔴 **新增 `Meta.data` 持久键（如保险额度）会直接打破此测试** —— 是 N1 的最大回归风险点 |

> 🔴 特别提示：`skill_save_session_test.js:178` / `:192` 断言「撤离/死亡结算后 `Meta.data` 键集不变」。**任何**在 `Meta.data` 增字段的局外解锁（N1~N4）都必须**同步更新该测试**，否则门禁必黄。

---

## 7. 回写建议（供拍板后执行，登记备查）

| 回写位置 | 动作 |
| ---- | ---- |
| `game_design_proposal.md:1193`（§12-13） | 由「局内保险来源需重新设计」→ 采纳 Q1 结果（加「已定」横幅） |
| `game_design_proposal.md:1190`（§12-10） | 由「结晶获取速率……待细化」→ 填入 Q6 速率锚与解锁清单 |
| `game_design_proposal.md:576`（§7.1） | 「保险来源待重定」→ 链接到本节 |
| `game_design_proposal.md:1497~1501`（§13.11/§13.12 死亡掉落） | 保护范围口径（Q2）回写 |
| `decision_log_v1.md` §2 表尾 | 新增一行（拟 `D017`），权威落点 = 本文件 + 上述 §；状态 = 已批准（须用户点头后） |

---

**本轮只产设计文档；Q1~Q8 待用户拍板，未拍板前不改任何代码。**
