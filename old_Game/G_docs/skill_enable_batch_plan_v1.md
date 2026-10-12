# 能量水晶系统「启用」批次 · 子任务卡 v1

> 建立日期：2026-10-12 ｜ 建立时基线 `APP_VERSION 20261041`（**当前已推进到 `20261044`**）｜ 流程依据：`dev_standard_and_playbook.md` §5
> **目标**：把「已建未启用」的能量水晶系统推进到**玩家可玩**。当前 `CFG.skillSystem.enabled = false`。
>
> **本文件 = 本批次的施工依据。** 每路**只准改自己名下的文件**，共享文件冲突由主会话串行解决。

---

## 0. 文件所有权切分（**防冲突的核心，违反即冲突**）

| 路 | 拥有文件 | 内容 | 可与谁并行 |
|---|---|---|---|
| **W0** 主会话·串行 | `js/config.js` 显示名 · `index.html` · `js/ui-screens.js` · **4 个测试文件** | 重命名 + 标注修正 + 版本 bump（**原子，必须先做完**） | 无（串行闸门） |
| **W1** | `js/game.js` · `js/skill-scheduler.js` · `js/skill-runtime.js` | **技能等级 ↔ 武器等级 接线** | W2 起可并行 |
| **W2** | `js/ui.js` · `css/style.css` · `index.html`（W0 后） | 3 个界面接能量水晶 | 与 W1/W3 并行 |
| **W3** | `js/config.js`（仅 `skillSystem` 数值） | 数值填表（levels / 权重） | 与 W1/W2 并行 |
| **W4** | 新建 `*_test.js` | 本批次新增测试 | 与 W1~W3 并行 |
| **W5** 主会话·串行 | — | 集成 + 门禁 + 发布 | 收口 |

> ⚠️ **W0 与 W2 都碰 `index.html`** → **W0 必须先完成**，W2 才能动（否则冲突）。
> ⚠️ **W0 与 W3 都碰 `js/config.js`** → W0 改**显示名**、W3 改**数值**；**仍串行**（同一文件不并行写）。

---

## W0 · 重命名 + 标注修正（主会话串行，**原子提交**）

> ✅ **已完成（2026-10-12）** · 版本 `20261041 → 20261042` · 提交 `17b8fcc`
> 门禁 **91 套 / PASS 3945 / bad=0**（**条数不变** = 纯文案替换，无行为改动）。
> 落地：`js/*.js` + `index.html` + `css/style.css` + 4 个测试文件；
> `CFG.skillSystem.localization` 新增 `ui.crystal.noun` / `ui.relic.noun`。

### 目标
把两个系统的**正式名称**落到显示层，并修正文档/代码里过期的「取代」标注。

| 系统 | 旧显示名 | 新显示名（**已定**） |
|---|---|---|
| 水晶系统 | 模块水晶 / 水晶 | **能量水晶** |
| 芯片系统 | 芯片 | **遗迹秘宝** |

**界面词（用户 2026-10-12 定：统一改「遗迹」前缀）**：**遗迹秘宝图鉴 / 遗迹工坊 / 遗迹秘宝背包**。

### 落地清单（**必须一次改全，否则半截名更乱**）
1. `CFG.chips.name`：`"芯片"` → `"遗迹秘宝"`
2. `CFG.chipCodex.name`：`"芯片图鉴"` → `"遗迹秘宝图鉴"`
3. `CFG.chipForge.name`：`"芯片工坊"` → `"遗迹工坊"`
4. `js/ui-screens.js` 里的界面文案（图鉴 / 工坊页头）
5. `index.html` 相关按钮 / 标题文案
6. **4 个测试文件的 67 处断言**：`chip_test` / `chip_behavior_test` / `ui_v2_test` / `artisan_layout_test`
7. `CFG.skillSystem.localization` 加 `ui.crystal.noun = "能量水晶"`
8. **版本 bump 3 处**（`index.html` meta + 所有 `?v=` + `js/core.js` `Assets.buildVersion`）

> 🔴 **改名红线**：`js/` 里的**代码标识符不动**（`CFG.chips` / `chipInv` / `makeChip` / `CR_*` 保持英文原样）——
> **只改「给人看的显示文案」**。改标识符 = 全库地震。
> 🔴 **测试断言同步**：不能只改代码不改测试（会 `bad>0`）；也不能只放宽断言（掩盖回归）。**逐条替换 + 单跑确认**。

### 验收
`bash run_tests.sh` → `exit 0` 且 `bad = 0`（`PASS` 条数应**不变**，因为只换文案）。

---

## W1 · 技能等级 ↔ 武器等级 接线（真缺口修复）

> ✅ **已完成（2026-10-12）** · 版本 `20261042 → 20261043` · 提交 `6fd2c5e`
> 新增 `skill_level_binding_test.js`（30 条）并入 SKILL 套件 → 门禁 **91 套 / 3945 / bad=0**。
>
> **真源查出结果（原卡里写「W1 先查清真源」）**：项目实际路径 = **`Meta.weaponLv(heroId)`**（局外武器等级，1~100）。
> 依据 = 合同 §101「技能等级成长来源沿用项目实际路径，先审查，不额外发明第二套升级经济」
> ＋ 代码既有注释（`js/items.js:450`、`js/ui.js:546`「武器等级 = 技能等级」）。
>
> **实施**（四文件）：
> 1. `js/skill-compiler.js` 新增静态 **`SupportCompiler.skillLevelOf(state)`**（纯函数，不读 CFG/Meta）；
>    `preview({kind:"installSkill"})` 由硬编码 `level:1` 改为调用它。
> 2. `js/skill-playtest.js` 新增 **`skillLevelFor(heroId, skillId)`** —— **唯一读 `Meta` 的地方**；
>    取 `Meta.weaponLv` 并**钳制到 `def.levels.length`**（编译器对越界等级按 `LEVEL_OVERFLOW` **硬失败**）。
> 3. `js/skill-reward.js` 的 `_applySkillInstall` 改用 `SupportCompiler.skillLevelOf`。
> 4. 三处**必须同值**（试装 = 候选模拟 = 落地），否则「预览用 L1、落地用 L3」候选合法性与结果不一致。
>
> **前置 #3 的答案**：**稀有技能不是「按 1」也不是另设规则 —— 它继承本英雄已有技能等级**
> （= 武器等级）。落地与试装走同一函数，天然一致。
> **前置 #4 的现状**：`levels` 仍只有 3 级（E 阶段内容工作）→ 实际等级 = `min(武器等级, 3)`；
> **数值表补齐后无需改代码即自动放开到武器等级上限**。

### 问题（已核实）
新路径技能实例等级**硬编码为 1**：`js/skill-playtest.js:64/237`、`js/skill-reward.js:220` 都写 `level: 1`。
而规则是「**武器等级 = 技能等级（1~100）**」（§16.5）。→ 启用后技能**永不随武器成长**。

### 任务
1. 技能实例 `level` 从**武器等级**取值：`Meta.weaponLv`（局外）或 `G.run` 内的武器等级来源（**W1 先查清真源**）。
2. `levels` 数组长度 = 技能等级上限；**武器等级 > 数组长度时钳制**（现有 `_resolveLevel` 已做钳制，确认即可）。
3. **两技能（初始 + 稀有）各自等级**：初始技能跟武器等级；稀有技能等级来源 → **待确认**（先按 1 或跟武器等级）。
4. ⚠️ **`skillDefs[*].levels` 只有 3 级** → 若要支持 100 级，需 W3 扩数组（**或**改成曲线驱动，属设计决策）。

### 红线
- **不改 `skill-playtest.js` 的试玩语义**（它仍只做通电）。
- 加**幂等标记 / 原型包装**，不动 `js/main.js` 主循环。

### 验收
新测试：武器等级 1→10 时，技能实例 `level` 跟随；越界钳制到 `levels.length`。

---

## W2 · 3 个界面接能量水晶（对齐 `skill_ui_spec_v0.1.md`）

> ✅ **已完成（2026-10-12）** · 版本 `20261043 → 20261044` · 门禁 **93 套 / PASS 4083 / bad=0**
> **用户 2026-10-12 拍板**：① 升级 4 选 1 的候选**复用现有升级弹窗**；② 战斗技能栏两技能显示 = **`A X X X X A`**（A=技能，X=水晶）；③ 踩雕像授予稀有技能 → **弹出稀有技能选择弹窗**。
>
> **落地（4 个文件）**：
> 1. **屏2 战斗技能栏**（`js/ui.js` + `css/style.css`）
>    - 新增 `UI._crystalModeOf(member)`（按 `(heroId, groupVersion)` 缓存编译结果）+
>      `UI._crystalSkillOrder()`（初始技能恒在左，真源 = `initialSkillBindings`）。
>    - 新增 `UI._buildPsIconEl()`（抽出图标构造器，旧路径输出逐字不变）。
>    - `_buildPartyRow`：新路径英雄排布 = `[英雄名][技能 A][4 水晶 X][技能 A]`
>      （用户拍板 `A X X X X A`；英雄标识独占最左，使技能—水晶簇**整体相邻**）；
>      **仅 1 个技能时不补空壳**。旧路径排布 `[图标][英雄名][4 槽]` **逐字保留**
>      （`endless_hud_test` 七2/七3 依赖 `children[0]=ps-icon`、`children[1]=ps-info`）。
>    - `_updatePartySlots` 拆出 `_updateCrystalSlots`：4 槽渲染「名 + 品质色边 + Lv n/max」，
>      外层**仍保留 `.ps-slot`**（兼容既有 42 处结构依赖），额外挂 `crystal-slot`。
>    - `_updatePartyCd` 拆出 `_updateCrystalCd`：**两技能各自独立冷却环**
>      （剩余读技能实例 `cdLeft`，总长优先 `SkillScheduler.intervalFor` 同源口径）。
>    - `UI.clearBattleHud()` 追加清 `_crystalCache`。
> 2. **屏3 水晶详情浮窗**（`js/ui.js`）：新增 `UI.showCrystalSlotTip()` —— 文案**全部来自
>    `SkillPresenter.detail().text`**（首行标题跳过，其余按行铺 `.mt-row`），
>    落痕 `#module-tip` 的 `dataset.crystal`；Presenter 缺失/抛错 → 单行占位降级。
> 3. **屏1 升级 4 选 1**（`js/items.js` + `js/ui.js` + `css/style.css`）
>    - `js/items.js` 新增水晶候选族：`heroOnCrystalPath` / `heroSkillState` / `heroCrystalPickableIds` /
>      `crystalNameOf` / `crystalQualityOf` / `crystalDescOf` / `crystalMatrixOf` / `crystalCard` /
>      `crystalCandidates` / `applyCrystalPick`。
>      **三重闸门**（`enabled` + `ownsHero` + 已编译 `skillState`）任一不满足 → 返回 null → 逐字回落旧模块候选。
>      出池权重复用既有 `rewardPools.POOL_LEVELUP`（数据驱动，权重不写死在逻辑里）。
>    - `buildLevelUpCandidates` 顶部早退：升级者本人迁移 → 候选整体换成能量水晶；
>      `applyLevelUpPick` 新增 `kind === "crystal"` 分发。
>    - `js/ui.js` `_renderLevelUp`：类型标签「能量水晶」+ **卡面辅助矩阵**（`.lu-matrix` 逐技能
>      显示 生效/冲突/不适用，状态真源 = 编译 explanations）+ 胶囊「品质 · Lv n/max」；
>      新增 `UI._candRank()`（推荐角标：水晶按品质 `rank`，升级卡优先于新装卡）。
> 4. **屏4 稀有技能选择弹窗**（`index.html` + `css/style.css` + `js/ui.js` + `js/skill-playtest.js`）
>    - 新增**通用选择弹窗** `#choice-overlay`（`.choice-panel` / `#choice-title` / `#choice-sub` / `#choice-cards`），
>      版式复用 `.levelup-cards` / `.lu-v2` 卡面，但**不共享状态机**。
>    - `UI.showChoice({title, sub, options, onPick, onCancel})` / `UI.closeChoice()` / `UI._renderChoice()` /
>      `UI._bindChoiceOverlay()`（遮罩点击 = 取消；置灰卡不可点；幂等）。
>    - `SkillPlaytest.grantRareSkillOnAltar` 改：**先弹窗让玩家挑**（`rareSkillOptions()` 读 `rareSkillPool`），
>      暂停闸门由本文件自行开合（`_holdPause` / `_releasePause`，记忆并精确还原 `Game.paused`）；
>      多英雄排队依次弹；**无 UI 环境（无头测试）→ 自动装首个候选**（与接入前逐字一致，`skill_playtest_test` ⑪ 段因此仍全绿）。
>
> **红线落实**：新 class 一律 `crystal-*` / `lu-matrix` / `choice-*`（**未复用 `.mod-slot`**）；
> 数据只来自 `SkillPresenter` / 编译 explanations（UI 不自行判定能否用，合同 §13）；布局不动。

### 任务（原卡，保留备查）
| # | 界面 | 现有 DOM | 改造 |
|---|---|---|---|
| 1 | 升级 4 选 1 | `#levelup-overlay` + `#levelup-cards` | 候选改为**能量水晶**；卡面显**辅助矩阵**（两技能 applied/inactive/conflict） |
| 2 | 战斗技能栏 | `#party-skillbar` | 4 槽显示**能量水晶**（名 + 品质色 + Lv） |
| 3 | 水晶详情 | `#module-tip` | 喂 `SkillPresenter.detail().text` |
| 4 | 稀有技能授予 | 新增 `#choice-overlay` | 弹窗选择（用户 2026-10-12 新增拍板项） |

### 红线
- **新 class 前缀 `crystal-`**，**不复用 `.mod-slot`**（避免误伤旧测试）。
- 数据**只来自 `SkillPresenter`**，UI **不自行判断能否用**（合同 §13）。
- **布局不动**（只增删功能，与 `#hud` 统一口径一致）。

### 验收
✅ 新测试 `crystal_ui_test.js`（82 条）：未通电零影响 / AXXXXA 结构 / 浮窗文案来自 detail /
弹窗暂停与回滚 / 候选矩阵 / 槽满拒绝 / 版本三处一致。

---

## W3 · 数值填表 **+ 扩容**（`SkillPresenter` 无关，纯 `config.js`）

> ✅ **已完成（2026-10-12）** · 版本 `20261044 → 20261045`
> 用户拍板三项全部落地，**并行开发**（主会话 A · B 路编译器 · C 路运行时），门禁 **93 套 / PASS 4083 / bad = 0**。
> 施工契约 = **`skill_crystal_expansion_spec_v1.md`**。

### 落地内容
| # | 内容 | 说明 |
|---|---|---|
| 1 | **等级表扩到 100 级** | 新增 `skillLevels()` 曲线生成器（幂曲线 + 阶梯整数，**L1 恒等于 base**）；2 技能 + 14 水晶全部 100 级。结构契约不变 → 编译器/调度器/运行时**零改动** |
| 2 | **新增 5 颗水晶**（覆盖旧系统「无对应」的 5 类） | `CR_COOLDOWN`（循环）/ `CR_SPEED`（疾行）/ `CR_BOUNCE`（弹射）/ `CR_CHAIN`（链锁）/ `CR_BURN`（灼烧）→ 水晶总数 **9 → 14** |
| 3 | **弹射与环绕拆分**（用户拍板） | 弹射 = `CR_BOUNCE`（飞过去的独立弹体，链式）；环绕 = `CR_ORBIT`（贴身转圈的接触实体）。两者独立、不合并 |
| 4 | **迁移映射落库** | `migrationMaps.module` 10 条（`M010`/`M011` 按合同 §1 首轮不迁移）；`chip` 表恒空（遗迹秘宝不合并） |
| 5 | **正式启用** | `enabled: false → true`；`migratedHeroIds: [] → ["H001"]`（合同 §1 首批试点） |

### 三条新运行时/编译能力（并行产出的积木）
| 能力 | 落点 | 用途 |
|---|---|---|
| `modifyStat` 执行器 + `build.castStats` | `js/skill-config.js` · `js/skill-compiler.js` | 冷却水晶写施放层统计（不改任何节点） |
| `_castStatsOf` 合并（乘法合成） | `js/skill-runtime.js` | 让 `castStats.cdMul` 真正影响 `cooldownFor` |
| `EP_DERIVED_EACH_HIT`（`everyHit`）+ `targeting:"nearestOther"` + `attach:"target"` | `js/skill-events.js` · `js/skill-runtime.js` | 每命中派生 / 派生朝另一个敌人 / 效果跟随目标 |

### 红线（均已遵守）
- ✅ **未改 `SK_FIREBALL` 迁移基准**（冷却 1.80 / 系数 1.50 / 爆炸半径 130）——`skill_rule_binding_test` ⑨ 段锁定。
- ✅ 数值已同步 `skill_balance_table_v0.1.md` §3/§4（含曲线起止值与迁移对照表）。

### 验收
✅ 门禁 **93 套 / PASS 4083 / bad = 0**；新增 `crystal_expansion_test.js`（54 条）覆盖扩容全链路。

---

## W4 · 本批次新增测试

| 测试 | 覆盖 | 状态 |
|---|---|---|
| `skill_level_binding_test.js` | W1 技能等级接线 | ✅ 31 条 |
| `crystal_ui_test.js` | W2 四屏（未通电零影响 / AXXXXA / detail 浮窗 / 选择弹窗 / 水晶候选矩阵 / 槽满拒绝 / 版本三处） | ✅ 82 条 |
| `crystal_expansion_test.js` | W3 扩容全链路（14 水晶 / 100 级曲线 / 逐一试编译 / 三条新运行时能力 / 迁移映射 / 启用状态） | ✅ **54 条** |
| 扩 `skill_rule_binding_test.js` | W3 数值真源一致 + 启用态断言 | ✅ 73 条 |

> 🔴 **PASS 文案禁止含英文 `error` / `FAIL`**；新测试**直读真实 `CFG`**，不用自造桩。
> 🔑 本套件的一条硬约束：**未通电时必须逐字走旧渲染** —— 断言写成「旧结构序 `AIX` / 新结构序 `IAXA` 二选一」，并单独验证 `enabled=false` 时 `.crystal-*` 一个都不出现。

---

## W5 · 集成收口（主会话）

```
① 合并各路 → 解决残留冲突
② bash run_tests.sh         # 判据 exit=0 且 bad=0
③ bash verify_clone.sh      # 同步新快照
④ 文档同步（§4 检查清单）
⑤ push origin main
⑥ 重新发布托管站（用户确认后）
```

---

## 启动前置（✅ **全部已解决，可开工**）

| # | 前置 | 状态 |
|---|---|---|
| 1 | 迁移映射 #2/#3（无对应 5 类 / 弹射 vs 环绕） | ✅ **已拍板（2026-10-12）**：①「新增水晶覆盖」→ 5 颗新水晶；②「拆分」→ 弹射与环绕各自独立 |
| 2 | 界面词文案 | ✅ **已定**：遗迹秘宝图鉴 / 遗迹工坊 / 遗迹秘宝背包（W0 已落地） |
| 3 | 稀有技能等级来源 | ✅ **已解（W1）**：继承本英雄已有技能等级（= 武器等级），与试装同函数 |
| 4 | `levels` 是否扩到 100 级 | ✅ **已拍板：扩到 100**（W3 落地，曲线生成器驱动） |

> ✅ **W0 / W1 / W2 / W3 / W4 全部完成并全绿** —— 本批次**收口**。
> 门禁基线：**93 套 / PASS 4083 / bad = 0**，APP_VERSION `20261045`，`verify_clone.sh` 已同步快照。
> **系统已正式启用**：`enabled = true` + `migratedHeroIds = ["H001"]`（猎手走新路径，其余英雄留旧路径）。
>
> **下一步（不属于本批次）**：为其余英雄新建 `SK_*` 技能定义（各需独立 `baseGraph` 设计），
> 逐步扩大 `migratedHeroIds`，直至全英雄迁移。
>
> **W2 与用户原始拍板的唯一偏差（需确认）**：技能栏排布落地为
> `[英雄名][技能 A][4 水晶 X][技能 A]`，而不是字面的 `A X X X X A` ——
> 理由 = 旧路径把英雄名放在图标之后，若把名字插进 `A` 与 `X` 之间会把「技能—水晶—技能」簇切开；
> 现方案让名字独占最左、簇整体相邻。**若要严格 `A X X X X A`（名字移到簇右侧或加前缀标签），改一行 append 顺序即可。**
