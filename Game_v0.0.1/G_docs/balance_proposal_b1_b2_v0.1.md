# B1 + B2 数值提案 v0.1（各技能整数锚点 / 各 Buff 等级锚点）

> 🔴 **本文件为「提案（未批准）」。** 规则真源 = `G_docs/game_design_proposal.md`（§12 第 42 条 / 第 50 条、§4.4、§8.5 表 4 / 表 4c、§16.5）。
> 本文件**只填数字**，不新增规则、不改任何 `js/*`、不碰任意 `CFG`。
> 落库前必须走正常迁移 + 测试流程；未获批准前，任何人不得据本表改代码。
> 作者：数值策划代理 ｜ 日期：2026-10-12 ｜ 代码真源版本：`js/config.js`（`git 57a3264`）
> 行号引用格式：`config.js:NNN` = `Game_v0.0.1/js/config.js` 第 NNN 行（实测直读）。

---

## 0. 范围、口径与真源

### 0.1 本文件覆盖范围

| 组 | 对应设计书条款 | 内容 | 本文件产出 |
|---|---|---|---|
| **B1** | §12 第 42 条（`game_design_proposal.md:1210`） | 各技能**整数离散项**（弹道数量 / 召唤数量 / 穿透 / 弹射次数等）的**锚点等级与取值** | §2 一张主表（新路径 8 个技能）+ §2.2 旧路径基线对照 |
| **B2** | §12 第 50 条（`game_design_proposal.md:1218`） | `BF001~BF004` 的**锚点等级与取值** + `stackable` / `maxLv` 建议 | §3 一张表（4 个战争雕像 Buff） |

### 0.2 必须遵守的既有规则（不重新发明）

1. **锚点插值（整数离散值）**：只填 3~5 行关键锚点，程序在相邻锚点间**线性插值后取整**；锚点全为整数 → **向下取整**（`game_design_proposal.md:719-722`、`config.js:1289-1292`）。
2. **效果值公式**：`最终值 = 技能锚点固定值（anchors 插值）+ 施法者属性 × pct × 等级系数`，等级系数 `g(lv) = 1 + (lv−1) × CFG.skillScaleBy.levelGrowth`，`levelGrowth = 0.06`（`config.js:1300-1308`）。
3. **Buff 也分等级**：重复触发叠的是 `lv`（不是多份），效果走 `anchors.mul` 插值；`stackable:false` 只刷新时间不升级；上限 `maxLv`（默认 `CFG.buffLevel.maxLv = 99`），每次触发 `+stackPerTrigger`（默认 1）级（`game_design_proposal.md:240-244`、`config.js:1946-1964`）。
4. **整数词条硬上限（必须与之对齐）**：`CFG.affixTags`（`config.js:1590-1601`）——`弹道数量 max 8`、`穿透 max 5`、`弹射次数 max 4`。
5. **数量上限钳制**：`实际上限 = min(技能锚点数量, 英雄「召唤物上限 / 陷阱数量上限」)`（`game_design_proposal.md:1215`、`config.js:1116-1117`、`config.js:1197/1201`）。
6. **新路径为当前真源**：`H001~H012` 已**全量迁移**，技能表真源 = `CFG.skillSystem.skillDefs`（`config.js:2777/2785`）；旧表 `CFG.skills` 的 `AT101~AT116` **保留仅供溯源**（`config.js:2784`）。

### 0.3 与已有提案的关系（不重复、不冲突）

| 已有文件 | 覆盖对象 | 与本文件的关系 |
|---|---|---|
| `G_docs/skill_balance_table_v0.1.md` | `SK_FIREBALL / SK_SHOCKWAVE` 曲线 + **水晶 `CR_*`**（贯穿 / 扇射 / 分裂 / 弹射 / 链锁 / 环绕的 `count`，`skill_balance_table_v0.1.md:91-109`） | **不重复**。本文件 B1 **不重列水晶整数**，仅在 §2.3 引用其对接口径；水晶数值以该文件为准 |
| `G_docs/skill_effect_balance_v0.1.md` | `AT113 / AT114 / AT120 / AT122 / AT123 / AT124` 的**效果锚点**（含 `AT113.count`、`AT114.count`） | **有重叠且已对齐**。本文件 §2 直接**引用其锚点值**（`AT113 {1:3,25:4,60:5,100:6}`、`AT114 {1:1,25:2,60:2,100:3}`），不另立数字；B1 只把「旧表 anchors」提升为「新路径 `SK_*` 的正式锚点表」 |
| `G_docs/hero_skill_interface_v2.md` | 新路径字段白名单（`count / trapCount / summonCount / extraPierceCount` 等） | 字段名以该文件为准，本文件不改字段名 |

---

## 1. B1 · 前置：整数离散项在代码中的现状（实测基线）

| 位置 | 现状写法 | 与设计要求的差距 |
|---|---|---|
| 旧表 `CFG.skills` 的 `AT101~AT112 / AT115 / AT116` | `bullets / pierce / bounce` 为**平铺常量**（如 `AT108 bullets:8`，`config.js:1329`） | ❌ 无等级成长（LV1=LV100） |
| 旧表 `CFG.skills` 的 `AT113 / AT114` | 已用 `anchors`（`config.js:1346-1351`、`1356-1360`） | ✅ 符合写法，但只覆盖召唤 / 陷阱两类 |
| 新表 `CFG.skillSystem.skillDefs` | `skillLevels(..., ints)` 走 **`skillSteps` 两点线性**（`config.js:36-44/58`），如 `count: [3,6]` | ⚠️ 是「两点」非「3~5 行锚点」；数值上等价于端点锚点 |

**B1 的目标**：把每个技能携带的整数离散项，统一写成 **4 行锚点 `{1, 25, 60, 100}`**（符合「3~5 行」法则），并与既有实测基线自洽。

---

## 2. B1 · 各技能整数离散项锚点提案（主表）

> 口径：锚点等级统一 **LV1 / LV25 / LV60 / LV100**（4 行）；**LV1 必须等于现有迁移基准，不得漂移**（A 类，见 `skill_balance_table_v0.1.md:18-24`）。
> 「现状」列 = 直读 `js/config.js` 的当前有效值。

| 技能ID | 项目（字段） | LV1 | LV25 | LV60 | LV100 | 现状（代码实测） | 一句话依据 | 需确认 |
|---|---|---|---|---|---|---|---|---|
| **SK_FIREBALL**（H001） | 弹道数量 `count` | **1** | 1 | 1 | **1** | `count:[1,1]`（`config.js:2996`） | 单体法球，迁移基准 = 1 发；增发只走「弹道数量」词条 / 水晶，技能本体不涨 | #1 |
| **SK_SCATTER**（H002） | 弹道数量 `count` | **3** | 4 | 5 | **6** | `count:[3,3]`（`config.js:3073`） | LV1=3（旧 `AT103 bullets:3`，`config.js:1318`）；LV100=6 约 2×，且 ≤ `affixTags 弹道数量 max 8` | — |
| **SK_RAILGUN**（H003） | 穿透 `extraPierceCount` | **2** | 3 | 4 | **5** | `extraPierceCount:[2,6]`（`config.js:3098`） | LV1=2（旧 `AT105 pierce:2`，`config.js:1322`）；LV100 收到 **5** = `affixTags 穿透 max 5`，与词条上限对齐 | #2 |
| **SK_RINGBARRAGE**（H004） | 弹道数量 `count` | **8** | 9 | 11 | **12** | `count:[8,12]`（`config.js:3123`） | 迁移曲线 `[8,12]` 保留；基础 8 已 = 词条上限，故**技能基础允许单独越过词条上限**（词条上限另算） | #3 |
| **SK_VOLLEY**（H005） | 弹道数量 `count` | **3** | 4 | 5 | **6** | `count:[3,6]`（`config.js:3148`） | 与 `SK_SCATTER` 同为 3 发齐射类，**共用同一曲线**便于横向对齐 | — |
| **SK_SIEGEBLAST**（H006） | 弹道数量 `count` | **1** | 1 | 1 | **1** | `count:[1,1]`（`config.js:3173`） | 单体重炮，同 `SK_FIREBALL` 口径（威力在伤害/爆炸半径上体现） | #1 |
| **SK_DRONESWARM**（H007） | 召唤数量 `count` | **3** | 4 | 5 | **6** | `count:[3,6]`（`config.js:3358`） | 与旧 `AT113` 锚点**逐值一致**（`config.js:1347`）；LV100=6 = H007 `summonMax:6`（`config.js:1197`），由 `min()` 钳制 | #4 |
| **SK_MINEFIELD**（H008） | 陷阱数量 `trapCount` | **1** | 2 | 2 | **3** | `effect.trapCount:3` 固定（`config.js:3341`） | 与旧 `AT114` 锚点**逐值一致**（`config.js:1357`）；LV100=3 = H008 `trapMax:3`（`config.js:1201`） | #5 |

**主表覆盖：8 个技能 / 8 个整数锚点项（共 32 个锚点取值）。**

### 2.1 附：未纳入本表的相关技能（说明为什么不算 B1）

- `SK_SHOCKWAVE / SK_TAUNTROAR / SK_LIFEPULSE / SK_WARSONG / SK_PSYSHIELD`：无整数离散项（其 `radius` 为连续值，走 `skillLevels` 浮点曲线，非 B1 范畴；其效果锚点见 `skill_effect_balance_v0.1.md`）。
- `AT120~AT124`、`AT121`（`reach/meleeArc`）、`AT201~AT244`（含 Boss 弹幕 `count/layers/arms`、冲锋参数）：**敌人技能无等级锚点**，其强度按怪物等级成长（`game_design_proposal.md:886`），不属于「技能等级锚点」。
- `CR_PIERCE / CR_MULTISHOT / CR_HOMING / CR_SPLIT / CR_ORBIT / CR_BOUNCE / CR_CHAIN`：**水晶整数**，已在 `skill_balance_table_v0.1.md:91-109` 提案（`config.js:3384-3622`），本文件不重复。

### 2.2 旧路径基线对照（只读，供溯源；建议随迁移完成正式废止）

| 旧技能ID | 整数项（平铺常量） | 实测值 | 位置 | 对应新技能 |
|---|---|---|---|---|
| AT101 速射 | bullets / pierce / bounce | 1 / 0 / 0 | `config.js:1313` | （H001 旧普攻） |
| AT103 三向散射 | bullets | 3 | `config.js:1318` | → SK_SCATTER |
| AT105 磁轨弹 | bullets / pierce | 1 / 2 | `config.js:1322` | → SK_RAILGUN |
| AT107 跳弹 | bullets / bounce | 1 / 2 | `config.js:1326` | （无新路径对应） |
| AT108 环形弹幕 | bullets | 8 | `config.js:1329` | → SK_RINGBARRAGE |
| AT109 双生速射 | bullets | 1 | `config.js:1331` | （H001 旧普攻） |
| AT110 疾风连爆 | bullets | 3 | `config.js:1333` | → SK_VOLLEY |
| AT111 重锤弹 | bullets / pierce | 1 / 1 | `config.js:1335` | （无新路径对应） |
| AT115 机炮 | bullets | 1 | `config.js:1364` | （H007 旧普攻） |
| AT116 掷雷 | bullets | 1 | `config.js:1366` | （H008 旧普攻） |

> ⚠️ 旧路径 `bullets/pierce/bounce` 全部为**平铺常量**（无等级曲线）；上述新表锚点即对其「补齐等级成长」的提案。

### 2.3 与水晶（`CR_*`）的接口口径

技能基础锚点（本表）与水晶整数（`skill_balance_table_v0.1.md:91-109`）**两条独立通路、叠加计算**，不冲突：

- 水晶施加在**编译后的技能图参数**上（`modifyParameter` / `addNode`，`config.js:3388-3401`），不与技能自身等级曲线打架；
- 词条/模块走上限 `CFG.affixTags`（`config.js:1590-1601`）；
- 建议口径（需确认 #3）：**技能基础锚点与词条上限分别钳制**，总上限另在平衡期实测（同 `skill_balance_table_v0.1.md:140-150` 的预算护栏）。

---

## 3. B2 · 各 Buff 等级锚点提案

> 口径：锚点等级取 **LV1 / LV3 / LV6 / LV10**（4 行，覆盖实战可达区间；LV1 沿用 §4.4 首版基准**不得漂移**）。
> 「取值」= `anchors.mul` 内插值（`config.js:1546-1559`）；`g(lv)` 等级系数**不参与** Buff 的 `mul` 插值（Buff 走自身锚点，见 `game_design_proposal.md:242`）。
> 「现状」= 直读 `config.js:1548-1559` 的当前 4 行锚点 `{1,10,30,99}`。

| Buff ID | 作用（`stat`） | 锚点等级 | 取值（LV1/3/6/10） | stackable | maxLv | 现状（代码实测） | 一句话依据 | 需确认 |
|---|---|---|---|---|---|---|---|---|
| **BF001 狂力** | 攻击力 ×`mul`（`atk`） | 1 / 3 / 6 / 10 | **×1.30 / ×1.36 / ×1.44 / ×1.55** | `true` | **10** | `{1:1.30,10:1.55,30:1.95,99:3.00}`（`config.js:1550`） | LV1/LV10 与 §4.4 首版及表 4c **逐值对齐**（`game_design_proposal.md:225/968`）；3/6 位取 1→10 直线内点（与引擎线性插值一致，无折点） | #6 / #7 |
| **BF002 迅击** | 攻速（`cdMul`，越小越快） | 1 / 3 / 6 / 10 | **×0.70 / ×0.68 / ×0.66 / ×0.62** | `true` | **10** | `{1:0.70,10:0.62,30:0.50,99:0.34}`（`config.js:1553`） | LV1=0.70（≈攻速 +30%）、LV10=0.62（≈+61%），与表 4c 对齐；`cdMul` 为「越小越快」乘算因子，**必须走锚点保证下限**（`game_design_proposal.md:959`） | #6 / #8 |
| **BF003 疾风** | 移速 ×`mul`（`spd`） | 1 / 3 / 6 / 10 | **×1.30 / ×1.34 / ×1.41 / ×1.50** | `true` | **10** | `{1:1.30,10:1.50,30:1.85,99:2.60}`（`config.js:1556`） | LV1/LV10 与 §4.4 / 表 4c 对齐；移速与负重惩罚**分别结算**（`game_design_proposal.md:227`），本值不参与负重曲线 | #6 |
| **BF004 汲血** | 吸血**加算**（`lifesteal`） | 1 / 3 / 6 / 10 | **+0.15 / +0.17 / +0.19 / +0.22** | `true` | **10** | `{1:0.15,10:0.22,30:0.35,99:0.60}`（`config.js:1559`） | LV1=+15%、LV10=+22%，与 §4.4 / 表 4c 对齐；吸血**归属发射者各自回血**（`game_design_proposal.md:1214`、`16.5`），`lifesteal` 为加算通道 | #6 / #9 |

**B2 覆盖：4 个 Buff（BF001~BF004），每个 4 个锚点取值；建议 `stackable=true` / `maxLv=10` 全组统一。**

### 3.1 为什么把 `maxLv` 从默认 99 收到 10（关键依据）

- 规则：`stackPerTrigger=1`、持续时间 `duration=20s`、重复触发**刷新时间并 +1 级**（`game_design_proposal.md:240-244`、`config.js:1948/1548`）。
- 推论：要到达 LV99 需在**同一份 Buff 的存活窗口内**触发 99 次 → 实战不可达（雕像为四选一随机、且需站圈读条）。
- 后果：`{30:…, 99:…}` 两行是**打死值**，会拉出台阶式插值斜率失真（LV10~LV30 段几乎无人到达）。
- 建议：`maxLv=10` + 锚点 `{1,3,6,10}`，把锚点全部落在**实战可达区间**，插值斜率真实有效。
- **不影响 `stackable` 设计意图**：重复触发仍叠等级、仍刷新时间（`stackable:true` 全保留）。

### 3.2 不在 B2 范围的 Buff（说明）

- `BF005 / BF006 / BF007`（`pool:"skill"`，`config.js:1564-1569`）由 `AT123 / AT124` 运行时动态写入、**无 `anchors`**，且**不进战争雕像池**（`config.js:1563`），不属 §12 第 50 条范围。
- `DB001~DB003`（`cat:"debuff"`）为敌方诅咒，走 `mods` 乘算常量，非「Buff 等级锚点」。

---

## 4. 需确认清单（编号 + 问题 + 建议默认值）

| # | 问题 | 建议默认值 | 影响 |
|---|---|---|---|
| **1** | `SK_FIREBALL / SK_SIEGEBLAST` 单体技能的弹道数量是否**永久锁 1**，抑或 LV100 允许涨到 2？ | **锁 1**（增发交给词条/水晶） | 影响单体武器上限与词条收益 |
| **2** | `SK_RAILGUN` 穿透 LV100 取 **5**（= `affixTags 穿透 max 5`）还是保留现状 **6**？ | **5**（与词条上限对齐） | 决定穿透类武器与词条叠加后是否会爆表 |
| **3** | 技能基础锚点与 `CFG.affixTags` 上限（弹道数量 8 / 穿透 5 / 弹射 4）是**分别钳制**还是**共享上限**？ | **分别钳制**（技能基础可单独越过，如 `SK_RINGBARRAGE` 基础 8） | 决定 `SK_RINGBARRAGE` LV100=12 是否合法 |
| **4** | `SK_DRONESWARM` 召唤 LV100=6 与 H007 `summonMax=6` 的关系是否维持 `min()` 钳制？ | **维持** `min(技能锚点, 英雄属性)`（`game_design_proposal.md:1215`） | 决定召唤上限由谁说话 |
| **5** | `SK_MINEFIELD` 陷阱数是否改为**随等级成长**（现状 `trapCount:3` 固定，LV1=LV100）？ | **改为 LV1=1 → LV100=3**（对齐旧 `AT114`） | 陷阱师前中期强度曲线 |
| **6** | `BF001~BF004` 锚点等级是否**弃用 LV30 / LV99**、改为 `{1,3,6,10}`？ | **弃用**（可达性修正，理由见 §3.1） | Buff 全组曲线形态 |
| **7** | `BF001~BF004` 的 `maxLv` 是否由默认 **99 收到 10**？ | **收到 10** | 同上；若坚持 99，则需补齐 30/99 锚点 |
| **8** | `BF002 迅击` 的 `cdMul` 是否设**硬下限**（如 ≥0.3，即攻速 ≤+233%）防外推？ | **设下限 0.3**（锚点已保证，加防御性钳制） | 防止锚点/词条叠加后冷却趋 0 |
| **9** | `BF004 汲血` 的 `lifesteal` 是否与装备 / 属性卡牌的吸血来源**走同一加算通道**（会叠加）？ | **同一加算通道**（`runBonus().add`，`game_design_proposal.md:2250`） | 决定吸血总上限是否需要设顶 |
| **10** | 旧表 `CFG.skills` 的 `AT101~AT116` 平铺整数是否**随迁移完成正式废止**？ | **废止**（新路径为真源，旧表仅溯源） | 表维护成本 / 双源漂移风险 |
| **11** | B1 锚点等级是否统一 **`{1,25,60,100}`**（与 §8.2 示例一致，`game_design_proposal.md:721`）？ | **统一 4 行** | 与设计书示例一致性 |
| **12** | 水晶整数（`CR_*`）是否**沿用** `skill_balance_table_v0.1.md:91-109` 的 L1/L100，不纳入本表？ | **沿用，不重列** | 避免与已有提案冲突 |

---

## 附录 · 本文件引用的代码 / 文档位置（实测）

| 内容 | 位置 |
|---|---|
| 第 42 条（B1 依据）/ 第 50 条（B2 依据） | `G_docs/game_design_proposal.md:1210` / `:1218` |
| §4.4 战争雕像增益池（狂力/迅击/疾风/汲血，各 20s） | `G_docs/game_design_proposal.md:219-244` |
| §8.5 表 4（技能表）/ 表 4c（增益视图 + 首版增益池） | `G_docs/game_design_proposal.md:910-973` |
| §8.5 表 1（英雄表：召唤物上限 / 陷阱数量上限） | `G_docs/game_design_proposal.md:866-876` |
| §16.5 全队生效 / 产物归属 / `runBonus()` | `G_docs/game_design_proposal.md:2222-2260` |
| 锚点插值填法（3~5 行 + 取整规则） | `G_docs/game_design_proposal.md:719-722`、`js/config.js:1289-1292` |
| `SKILL_LEVEL_MAX = 100` / `skillCurve` / `skillSteps` / `skillLevels` | `js/config.js:18`、`:21-70` |
| `CFG.skillScaleBy.levelGrowth = 0.06` | `js/config.js:1306-1308` |
| 旧表 `AT101~AT112`（平铺整数） | `js/config.js:1312-1337` |
| 旧表 `AT113 / AT114`（已有 `anchors`） | `js/config.js:1340-1360` |
| 旧表 `AT115 / AT116` | `js/config.js:1363-1366` |
| 新表 `SK_FIREBALL / SK_SCATTER / SK_RAILGUN / SK_RINGBARRAGE / SK_VOLLEY / SK_SIEGEBLAST` | `js/config.js:2985-3204` |
| 新表 `SK_DRONESWARM / SK_MINEFIELD`（召唤 / 陷阱） | `js/config.js:3323-3377` |
| 水晶 `CR_PIERCE / CR_MULTISHOT / ... / CR_CHAIN`（整数 `count`） | `js/config.js:3384-3602` |
| `BF001~BF004`（战争雕像 Buff） | `js/config.js:1548-1559` |
| `CFG.affixTags`（弹道数量 8 / 穿透 5 / 弹射 4） | `js/config.js:1590-1601` |
| `CFG.buffLevel`（maxLv 99 / stackPerTrigger 1）/ `CFG.warBuffs` 派生 | `js/config.js:1946-1964` |
| `CFG.weaponLevel`（普攻 +4% / 技能 +6%） | `js/config.js:1887-1894` |
| `CFG.skillSystem` 开关与迁移英雄（H001~H012 全量） | `js/config.js:2771-2812` |
| 英雄 H007 / H008 的 `summonMax / trapMax` | `js/config.js:1197` / `:1201` |
| 既有提案：水晶整数 / 效果锚点 | `G_docs/skill_balance_table_v0.1.md:91-109`、`G_docs/skill_effect_balance_v0.1.md:154-179` |
