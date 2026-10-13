# 决策记录（Decision Log）· 唯一索引 v1

> 建立日期：2026-10-12 ｜ 对应代码版本：`APP_VERSION 20261049`
> **依据**：`plan_architecture_and_ai_development_v1.md` §5（目录第 8 项「决策记录」+ 第 9 项「反馈与提案」）、§6（更新流程 + 状态词表）、§9-8；`AGENTS.md` §六-4。
>
> ⚠️ **本文件不是第二套规则源**（§5 明令禁止）。它只做两件事：
> ① **「决策 → 权威落点」的索引**；② **状态追踪**。
> **规则正文一律以权威章节为准**：玩法 → `game_design_proposal.md`；工程 → `skill_system_development_contract_v1.0.md`；接口 → `skill_system_interface_v1.md` / `hero_skill_interface_v1.md`；机制与坑 → `dev_guide.md`。

---

## 0. 使用规则（铁律）

1. **拍板即回写**。用户每做一次取舍（对话 / 选项卡 / 批注），当轮必须：
   ① 在本表**新增一行**（编号 `DNNN`，只增不删）；
   ② 在**权威章节**做**替换或新增** —— 替换时旧表述加「**已被取代**」横幅并链接到新条目（§6）；
   ③ 推进状态（见 §1 词表）。
2. **未批准的想法不得写成已生效**（§6）。提议阶段状态记「待确认」，**只有用户点头才转「已批准」**。
3. **禁止只记在对话里**。对话会丢，文档不会。凡「AI 提问 → 用户选择」的每一轮，都必须在表格留痕。
4. 台账**只增不删**；作废条目改记「已否决 / 已被取代」并保留历史。

## 1. 状态词表（§6，固定七档）

`待澄清` → `待确认` → `已批准` → `实现中` → `待验收` → `已完成`
旁支：`已否决`（用户否掉）/ `已被取代`（被更新的决策推翻）

---

## 2. 决策总表

| # | 日期 | 决策（一句话） | 结论 | 权威落点 | 变更方式 | 状态 |
|---|---|---|---|---|---|---|
| D001 | 2026-10-09 | 玩法调优五条（吞噬反馈 / 激光视觉 / 等） | 五条全部采纳并落地 | `game_design_proposal.md` §17.9 → §17.10 | 替换（原待定项转「已逐条拍板」） | 已完成 |
| D002 | 20.x | 屏幕方向 | **默认竖屏设计**，横屏为兼容分支 | `game_design_proposal.md` + `css/style.css:874` | 新增 | 已完成 |
| D003 | 26.x | 12 角重配 | **12 角全部重配**，定位分布不变（输出 4 / 防御 4 / 辅助 4） | `js/config.js` heroes 注释 + `game_design_proposal.md` | 替换 | 已完成 |
| D004 | 2026-10-12 | 遗迹秘宝 与 能量水晶 的关系 | **两者并存、分工不同，不是取代** | `game_design_proposal.md` §18「作用对象分工」 | 替换（原「取代」表述作废） | 已完成 |
| D005 | 2026-10-12 | 技能来源（22.2） | 武器绑定**唯一**「初始主动技能」；**4 颗水晶共享**作用于初始 + 稀有技能 | `js/config.js` `initialSkillBindings` + 总纲 §3.1 | 替换 | 已完成 |
| D006 | 2026-10-12 | 水晶扩容（22.8） | 9 → **14 颗**（新增覆盖旧系统「无对应」的 5 类） | `js/config.js` `crystalDefs` | 新增 | 已完成 |
| D007 | 2026-10-12 | 弹射 / 环绕 | **拆分**为各自独立水晶，**不合并** | `js/config.js` `crystalDefs` | 新增 | 已完成 |
| D008 | 2026-10-12 | `killer` 伤害归属（A1） | 技能伤害**必须携带施放英雄**（此前恒 `null`） | `js/skill-runtime.js` | 新增 | 已完成 |
| D009 | 2026-10-12 | 资源清单是否单独挂载（A2） | **不单独挂载** —— 判为「半个改动」（消费点 0 + 素材磁盘存在 0），归入「资源层整批」 | `G_docs/full_dev_plan_v1.md` | 新增 | 已完成 |
| D010 | 2026-10-12 | 英雄技能定义的承载位置 | **表 → 写进 `js/config.js` 的 `skillDefs`**，**不**拆 `js/skills/*.js` 独立文件 | `G_docs/hero_skill_interface_v1.md` | 新增 | 已完成 |
| D011 | 2026-10-12 | 全量迁移批 1 | **H001~H006** 全部走新路径（迁移基准 = 旧表该英雄 `kind:"skill"` 条目，非发明） | `js/config.js` `migratedHeroIds` | 替换 | 已完成 |
| **D012** | **2026-10-12** | **H007~H012 非伤害效果的图模型表达口径** | **用户授权「AI 直接给设计」**（选项 C）——无需逐条报批，AI 出一版设计并落库，事后由用户审阅 | ✅ **已实现**：`hero_skill_interface_v2.md`（设计冻结）+ §9 实现落地记录；代码 = `skill-config.js`（`effect` schema + `_NON_DAMAGE_KINDS` 条件必填）/ `config.js`（6 技能 + `TP_SUMMON_UNIT`）/ `skill-compiler.js`（放宽 bref + `effect` 透传）/ `skill-runtime.js`（`_applySpawnEffects` 施放级派发）；测试 `hero_nondamage_skill_test.js`(37) + `skill_effect_runtime_test.js`(42) | 新增 | **已完成** |
| **D013** | **2026-10-12** | **技能构筑是否跨局保存** | **每局重置**（选项 B）——技能与水晶**不进局外存档**，每局重新构筑 | `game_design_proposal.md` §20.10 存档 | **替换**（原「首轮不承诺跨版本恢复」的模糊表述 → 明确「不跨局」） | **已批准** |
| **D014** | **2026-10-13** | **B 类数值提案如何处置** | **全部落库**（B1 技能整数锚点 / B2 Buff 锚点 / B3 祭坛刷出 / B5 宝箱货物含硬编码收口） | `js/config.js`（`skillStepsAnchors` + `anchors` + `altars[].weight` + `chestQualities[].shape`）/ `js/items.js` / `js/game.js`；提案原文 `balance_proposal_b1_b2_v0.1.md` / `_b3_b4_` / `_b5_` | **新增**（提案 → 已生效） | **已完成** |
| **D015** | **2026-10-13** | **A4 `castTime`（施放前摇）语义** | **不可打断 + 可移动**——前摇进度**只随时间推进**：受击不清零（不读 hp）、移动不清零（不读位移）；目标丢失 → 进度**暂停**（既不推进也不归零）；`castTime=0` 恒 no-op 零回归 | `js/skill-scheduler.js`（`castTimeFor` + `tick()` 前摇段）；`G_docs/full_dev_plan_v1.md` A4 行 | **替换**（原「未定 / 调度器未读」→ 已定 + 已实现） | **已完成** |
| **D016** | **2026-10-13** | **宝箱主来源（冲突 7.2-1：祭坛雕像 vs 怪物掉落）** | 用户原话逐条落库：① **精英怪有几率掉落低级宝箱**；② **BOSS 有几率掉落中高级宝箱**；③ **宝箱掉落在地面，拾取方式参考雕像**；④ **宝箱就是雕像的一种形态表现**；⑤ **同名宝箱在背包中可叠加** | `game_design_proposal.md` §6.2 / §6.3 / §12-4；`js/config.js` `CFG.chestDrop`；`js/game.js` `eliteDropChest`/`spawnGroundChest`/`bossPhaseChest`；`js/combat.js` 精英掉落块；测试 `chest_drop_source_test.js`(30) | **替换**（旧「精英必掉 + 直接入包」「BOSS 每阶段必掉」→ 几率 + 落地 + 读条拾取） | **已完成** |
| **D017** | **2026-10-13** | **C2 局内等级成长口径（P004 拍板）** | 用户授权 AI 出设计并落库、**强调「数据驱动、不要写死」**：成长口径 = 「该等级属性 ÷ LV1 初始属性」的倍率 `M(lv)`，**全部读 `CFG.levelUp.growth`**（`mode` add/mul/hybrid + `rate`/`mul`/`hybrid`/`stats`，现值 `mode:"add", rate:0.06`）；`M(1) ≡ 1.00` 锁死迁移基准。口径：**初始值 × M(lv)**，施加在英雄初始值上（`computeStats`/`companionStats`），**不进 `runBonus().add` 通道**（避免与倍率重复计一次） | `js/config.js`（`CFG.levelUp.growth` 替换旧 `baseStatGain`）；`js/items.js`（新增 `levelGrowthMul()` / `growthScale()`；`runBonus` 摘除 `baseStatGain` 循环；`computeStats`/`companionStats` 改 `growthScale(...)`）；测试 `exp_test.js` / `smoke_test.js` / `perf_test.js` | **替换**（旧 `CFG.levelUp.baseStatGain` 固定绝对增量 {hp:6,atk:1.5,def:0.5} 作废） | **已完成** |
| **D018** | **2026-10-13** | **C6 属性卡牌系统去向（P005 拍板）** | 用户选择「**彻底退役 + 物理清理**」（方案①，非保留/非仅断入口）。原 `CFG.cardPool` 4 档品质卡池 + 候选抽取 + 刷新经济**整表移除**；职能去向为三足鼎立：① 升级加属性→`CFG.levelUp.growth`（D017）② 4 档品质构筑→遗迹秘宝 `CFG.chips` ③ 个人技能构筑→能量水晶。**新代码不得再引入卡牌系统**；如需恢复必须先走决策流程 | `js/config.js`（`CFG.cardPool` 整表删除 + 墓碑注释；`CFG.settleConvert.cardValue` 删除）；`js/items.js`（删 `rollCardQuality`/`drawCardCandidates`/`useCard`/`refreshCards`；`runBonus`/`tagCalc` 摘除 `appliedCards` 读取通道）；`js/game.js`（删 `cardAssets`/`cardRefresh`/`cardCandidates`/`appliedCards`）；`js/main.js`；`js/ui.js`；`js/ui-screens.js`（删 `renderCards`/`_cardEffectText`）；`js/modes.js`（删折算 `b.card` 桶）；`css/style.css`（删 `.card-*`，`.card-assets`→`.codex-count`）；`index.html`；测试 `smoke_test.js`/`econ_test.js`/`shop_test.js`/`skill_table_test.js`/`artisan_layout_test.js`/`exp_test.js`/`endless_hud_test.js`/`xgame_chip_fold_test.js` | **替换**（旧「牌退役但逻辑保留供回退」的半退役过渡态 → 全量物理删除） | **已完成** |
| **D019** | **2026-10-13** | **C7 技能栏排布（承认现状 + 回写 §20）** | 用户裁定**承认现状为最终形态**：技能栏整行块序 = `[英雄名][技能 A][水晶 X×4][技能 A]`，**A/X 簇严格 = `A X X X X A`**；英雄名块独占最左、使簇整体相邻；仅 1 技能时不补第二个 A。修复「拍板未回写权威章节」缺口（原拍板仅落施工文档） | `game_design_proposal.md` §20.1.1（新增「技能栏排布」条）+ §12-43 / §13.1 横幅；`skill_ui_spec_v0.1.md` 屏 2 / §8#1；`skill_enable_batch_plan_v1.md`「唯一偏差」→已确认；核对报告 `hud_layout_review_v1.md` | **新增**（拍板 → 回写权威章节） | **已批准** |
| **D020** | **2026-10-13** | **C1 角色差异化（本轮只落元数据字段）** | 新增**纯元数据、零行为**：`CFG.heroes[].playtag / .difficulty / .statBias`、`CFG.weapons[].archetype`、`CFG.heroRoles.difficultyOrder`；`CFG.starterHeroIds` **已落数据未接线**（首版 6 角名单待审 Q1）；数值越界修正（H005/H006/H012）与能量字段退役**未做**（待审） | `game_design_proposal.md` §12-7 / §8.5 表 1；`js/config.js`（元数据字段）；设计真源 `hero_roster_design_v1.md` | **新增**（设计 → 数据落库） | **已落库（数据）；接线 / 数值待审** |
| **D021** | **2026-10-13** | **C3 局内保险来源** | 采纳**候选 B**：新增祭坛 `ALTAR_007「保险雕像」`（**读条触发**给保险契约，`weight:0` 先不自动进池）+ **保留工匠世界购买**；新增 `CFG.insuranceSource` 多来源开关。**保护范围 = P1 按件（现状，1 份保 1 件最高价值物）** | `game_design_proposal.md` §12-13 / §7.1；`js/config.js`（`CFG.altars.ALTAR_007` / `CFG.insuranceSource`）；真源 `economy_insurance_design_v1.md` §2 | **新增**（设计 → 落库） | **已批准**（数据已落；`giveInsurance` 效果接线见真源 §4.1） |
| **D022** | **2026-10-13** | **C4 结晶速率锚表 + 解锁里程碑** | 新增 `CFG.outLevel.crystalRate` **速率锚表**（把原「配平注释」变为可测数据）；`CFG.outLevel.unlockMilestones` **已落数据未接线**（Q5 待审）；**深渊结晶封顶未做** | `game_design_proposal.md` §12-10；`js/config.js`（`CFG.outLevel.crystalRate / unlockMilestones`）；真源 `economy_insurance_design_v1.md` §3 / §4.2 | **新增**（数据落库、接线待审） | **已落库（数据）；接线待审** |
| **D023** | **2026-10-13** | **阶段 E/H 首轮平衡（保守子集）** | **就地订正**：§20.12 缺口 2「数值全为空」不实，实为**迁移占位值**。本轮落**保守子集**：`budgets.maxEventDepth` 2→3（修双表不一致）、预算阈值贴性能红线（120 / 48 / 12 / 32）、新增 `budgets.maxPlayerBulletsPerSec = 60`、`castPolicies.cdMulFloor = 0.35`、`contactRadius` 进环绕模板、`CR_SPLIT 0.50→0.45`；**未做**：伤害系数 / 冷却的 LV100 曲线形态（提案 D1/D2/D3，**高影响待审**） | `game_design_proposal.md` §20.12（缺口 2 / 状态表 E·H 行）；真源 `balance_proposal_eh_v0.1.md` | **替换**（占位值 → 保守子集；曲线待审） | **已落库** |
| **D024** | **2026-10-13** | **C1 数值越界修正 + energy 字段退役口径** | **数值修正**（均在定位风格带内）：H005 `spd 320→306 / def 5→6 / hp 120→126`、H006 `hp 138→128 / def 4→3`、H012 `atk 14→12`。**energy 字段取 E-α（保守）**：保留 `energyMax / energyRegen` 与 `CFG.baseStats.int.energyMax`，仅作 `energyMax` 类 scaling（如 `SK_PSYSHIELD`）与 UI 展示、**不再作技能门槛**；**E-β（彻底删字段）未做**（会强制改 `SK_PSYSHIELD` scaling 基准 = 平衡变更，留待用户拍板） | `js/config.js`（`CFG.heroes` 数值）；`game_design_proposal.md` §12-7 / §8.5 表 1；设计真源 `hero_roster_design_v1.md` §4-D / §4-E | **替换**（设计稿 §4-D 占位 → 已采纳；§4-E 二选一 → 取 E-α） | **已落库** |
| **D025** | **2026-10-13** | **`CFG.starterHeroIds` 首发名单接线（C1-Q1）** | 首发名单改为**数据驱动** `CFG.starterHeroIds = ["H001","H006","H004","H005","H010","H012"]`，与 `unlockOrder` 物理序**解耦**；`isHeroUnlocked` **已接线**；为 **H002 / H003 补解锁规则**（原首发掉出后保证 **12 角全可解锁**）。**Q1 已采纳**：三定位各 2、每定位远 / 近各 1 | `js/config.js`（`CFG.starterHeroIds` / `CFG.unlockRules`）；`game_design_proposal.md` §12-7；设计真源 `hero_roster_design_v1.md` §3.2 / §4-B | **新增**（数据 → 接线） | **已落库（接线）** |
| **D026** | **2026-10-13** | **C3 保险来源 / C4 结晶速率 接线** | `CFG.insuranceSource` **消费点接线**（默认值下行为不变）；`CFG.outLevel.unlockMilestones` 接线**用既有 `Meta.data.heroes` 派生（不加新存档键）**：`insuranceSlot` → 开局按里程碑发放保险（默认 0 份）、`altarWeight` → 权重查询；**新增** `CFG.endless.crystalCapPerRun`（默认 `0` = 不封顶） | `js/config.js`（`CFG.insuranceSource` / `CFG.outLevel.unlockMilestones` / `CFG.endless.crystalCapPerRun`）；`game_design_proposal.md` §12-13 / §12-10 / §7.1；真源 `economy_insurance_design_v1.md` §4.2 | **新增**（数据 → 接线） | **已落库（接线）** |
| **D027** | **2026-10-13** | **E/H LV100 曲线（阶段 E/H 平衡续）** | 采纳 `balance_proposal_eh_v0.1.md` §2.1 / §2.2 / §2.3(a) 建议值：**冷却 LV100 = LV1×0.60**（保留 `skillCurve` 幂曲线）、**伤害系数 LV100 = LV1×6.94（= `g(100)` 线性终点）**、`CR_ARCANE_AMP.more` LV100 `1.50→1.55`；**LV1 一律不动**。曲线**形态**（幂 vs 线性，提案 D1）与 `contactRadius / duration` 等级驱动（D5）等**仍待审** | `js/config.js`（`skillDefs[].levels[].cooldown / coefficient` / `CR_ARCANE_AMP.levels[].parameters.more`）；`game_design_proposal.md` §20.12（缺口 2 / 状态表 E·H 行）；真源 `balance_proposal_eh_v0.1.md` | **替换**（占位曲线 → LV100 端点已定；形态待审） | **已落库** |
| **D028** | **2026-10-13** | **item5 资源接入层 / item6 竖屏审计 状态回写** | A2 资源清单本轮落**消费入口基建**（`AssetHooks` 消费函数 = `js/core.js` 末尾独立区块 + `js/assets_manifest.js`，配套测试 `assets_hook_test.js`(19 断言) + `asset_hooks_consume_test.js`）；清单仍**未挂载**、渲染侧**未接线**、端到端验收**待素材就绪**。竖屏（390×844）**布局溢出静态审计**测试已存在 = `layout_overflow_test.js`（解析 `css/style.css` 声明值、以竖屏逻辑宽 390 为基准，查固定 `px` 宽 / 左右偏移 / `min-width` / 字号是否溢出）；**该审计只抓「声明层面必然溢出」，真机像素级复核仍需人工**（无浏览器环境） | `full_dev_plan_v1.md` §2 A2 行；`dev_guide.md` §5.56 | **订正**（A2「半个改动，暂缓」→ 消费入口基建已落；补竖屏审计基线） | **已落库（基建）** |

---

## 3. 待确认（AI 提案，等用户点头；**不算已生效**）

| # | 日期 | 提案 | AI 建议 | 阻塞什么 |
|---|---|---|---|---|
| P001 | 2026-10-12 | 其余 11 英雄是否全部迁移（阶段 G 收口） | ✅ **已全部完成**：H001~H012 全走新路径（D011 批 1 + D012 批 2；`migratedHeroIds` = 12/12）→ 本项关闭 | ~~阶段 G 完成度~~ → 已闭环 |
| P002 | 2026-10-12 | `castTime`（施放前摇）是否接线 | ✅ **已由 D015 拍板并落库**（本项关闭） | 技能手感 |
| P003 | 2026-10-12 | 数值平衡（冷却/系数/派生比例/预算阈值） | ⏳ **大部闭环**：阶段 E/H **保守子集已由 D023 落库**、**LV100 曲线端点已由 D027 落库**（冷却 0.60× / 系数 6.94× / `CR_ARCANE_AMP.more 1.55`）；**仅剩**曲线**形态**（幂 vs 线性，提案 D1）与 `contactRadius / duration` 等级驱动（D5）、派生比例等级成长（D4）**待审**（B1/B2/B3/B5 已由 D014 落库） | 阶段 E/H（曲线形态 / 等级驱动） |
| **P004** | **2026-10-13** | **C2：等级成长口径（加算 `1+0.06×(lv−1)` / 纯乘算 / 混合）** | ✅ **已由 D017 拍板并落库**（数据驱动 `CFG.levelUp.growth`，本项目关闭） | ~~B5 曲线~~ → 已闭环 |
| **P005** | **2026-10-13** | **C6：卡牌系统去向（彻底退役 / 恢复 4 品质卡池 / 混合只留工匠世界）** | ✅ **已由 D018 拍板并落库**（彻底退役 + 物理清理，本项目关闭） | ~~规则自相矛盾~~ → 已闭环 |
| **P006** | **2026-10-13** | **C1 剩余待审项**：energy 字段是否走 E-β（彻底删）/ H007 定位归属（`aux` vs `output`，设计稿 Q5）/ 新增元数据字段是否进选人 UI（Q7） | ⏳ **未决**：D024 已取 **E-α**（保留字段，E-β 未做）；H007 定位归属与 Q7 UI 均**未拍板** | C1 收口（字段退役 / 定位 / UI） |

---

## 4. 维护约定

- 新增决策：在 §2 表尾追加一行，编号递增；同一主题多次拍板时，新条目状态写「已被取代」，并在结论列链接到新编号。
- 每条决策都应在**权威章节**留痕；本表**不复制规则正文**，只放摘要 + 定位。
- 每轮交付（`AGENTS.md` §六）第 4.5 步 = **核对本表**：本轮有无拍板？有则必须已回写。
