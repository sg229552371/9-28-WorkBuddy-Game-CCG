# E/H 阶段首轮数值平衡提案 v0.1（冷却 / 系数 / 派生比例 / contactRadius / orbit.duration / 预算阈值）

> 状态：**提案（未批准）** ｜ 作者：数值策划代理 ｜ 日期：2026-10-13
> 对应缺口：`G_docs/game_design_proposal.md` §20.12 **已知缺口 2「首轮数值平衡（阶段 E/H）」**（`game_design_proposal.md:3103`）。
> 规则真源：`G_docs/game_design_proposal.md` 第二十章 / §8.5「三级填法」；配置真源：`js/config.js` 的 `CFG.skillSystem`。
> 复用口径：`G_docs/skill_effect_balance_v0.1.md` §0.1 等级系数 `g(lv) = 1 + (lv − 1) × 0.06`（LV1/25/50/100 = 1.00 / 2.44 / 3.94 / 6.94）。
> 体例参照：`G_docs/balance_proposal_b1_b2_v0.1.md` / `_b3_b4_` / `_b5_`（用户已批准「全部落库」批次）。
> **本文件只填数字，不改任何规则、不改任何 `js/*`、不碰任意 `CFG`。** 落库前必须走正常迁移 + 测试流程。
> 行号引用格式：`文件名:行号`，行号以本次撰写时（2026-10-13）工作区文件为准，全部为**直读实测**，非记忆。
>
> ✅ **已落库（2026-10-13 本轮落库，见 D027）**——本提案 §2.1 / §2.2 / §2.3(a) 的建议值**已采纳并写入 `js/config.js`**，据此：
> - **D3（伤害系数 LV100 目标）**：端点已落 —— **LV100 = LV1×6.94（= `g(100)` 线性终点）**；**LV1 不动**。
> - **D2（冷却是否随等级下降）**：端点已落 —— **LV100 = LV1×0.60**（冷却比 `r_cd(100)=0.60`）；**LV1 不动**。
> - **§2.3(a) `CR_ARCANE_AMP.more`**：`LV100 1.50 → 1.55`（LV1 = 1.12 不动；`moreDamageMul` 基准恒 1 不动）。
> - **D1（连续值曲线形态）**：**形态未改** —— **保留现值 `skillCurve` 幂曲线**（§2.2 推荐的是线性 `g(lv)`，端点相同、中段手感差异最大）→ **仍待审**。
> - **仍待审**：D4（派生比例随等级成长）/ **D5**（`contactRadius` 按晶体等级成长）/ D6（环绕常驻）等；`contactRadius 16` / `orbit.duration 6.0` 端点维持现状（§2.4 / §2.5）。
> - 说明：D023 已落「保守子集」（`maxEventDepth 2→3` / 预算贴红线 / `cdMulFloor` / `contactRadius` 进模板 / `CR_SPLIT 0.45`）；本轮 D027 续落 **LV100 曲线端点**。二者合起来 = 本提案 §2 的可落库部分。

---

## 0. 口径说明与证据分级（先看这条）

### 0.1 证据分级（全文严格遵守）

| 标记 | 含义 |
| ---- | ---- |
| **已证实** | 已 `grep -n` / `Read` 直读到字段名与当前值，附 `文件名:行号` |
| **未发现证据** | 已检索全部消费点，**未找到**读取该字段的代码（≠ 一定不存在，仅表示本文件未发现） |
| **待裁决** | 属设计取舍，需用户拍板（见 §5） |
| **阻断 / 需新设计** | 字段/机制根本不存在或不接线，不能靠填数字解决，须先改工程 |

### 0.2 🔴 与 §20.12 表述的差异复核（**必须先说清**）

§20.12 原文写「冷却 / 系数 / 派生比例 / `contactRadius` / `orbit.duration` / 预算阈值**全为空**」（`game_design_proposal.md:3103`）。
**回查代码后的实测结论（已证实）**：这 6 项**并非「空」**，而是**已填了迁移占位值 / 22.4 补的占位值，尚未平衡** —— 与 `skill_system_master_v1.md` §6-#7「全部数值为占位：冷却/系数/派生比例/`contactRadius:16`/`orbit.duration:6.0`/预算阈值，**均未平衡**」（`skill_system_master_v1.md:319`）一致。

| 项 | §20.12 措辞 | 实测（已证实） | 证据 |
| ---- | ---- | ---- | ---- |
| 冷却 | 「空」 | 已填：`SK_FIREBALL` 1.80 → 0.90（幂曲线） | `js/config.js:3056` |
| 系数 | 「空」 | 已填：`SK_FIREBALL` 1.50 → 6.50 | `js/config.js:3057` |
| 派生比例 | 「空」 | 已填：`CR_SPLIT` 0.50 等 6 项 + 技能内派生 1.5/1.9 | `js/config.js:3083/3263/3516/3532/3548/3648/3668/3688` |
| `contactRadius` | 「空」 | 已填 **16**（22.4 补，注释标「占位待平衡」） | `js/config.js:2925~2927` |
| `orbit.duration` | 「空」 | 已填 **6.0**（同上） | `js/config.js:2925` |
| 预算阈值 | 「空」 | 已填：240 / 64 / 16 / 2 / 256 / 48 / `reject` | `js/config.js:2912~2920` |

> **结论**：本提案的任务不是「从 0 填数」，而是**把占位值替换为有锚点、可验收的首轮平衡值**，并顺带登记 2 处**结构性不一致**（§2.6、§5）。同时注记 `game_design_proposal.md:2969~2971` 仍写「🟡 已实现、未启用 / `enabled = false`」，而代码实测 `enabled: true` + `migratedHeroIds` 含 H001~H012（`js/config.js:2839/2847`）——**文档滞后于代码**，本提案以代码为准。

### 0.3 统一等级标尺（全表复用，不另起一套）

来源：`CFG.skillScaleBy.levelGrowth = 0.06`（**实测 `js/config.js:1337~1338`**；⚠️ 旧提案 `skill_effect_balance_v0.1.md:20` 引的 `1306~1308` 已随版本失效，本文件以实测为准）+ §8.5「技能效果每级 +6%（线性）」（`game_design_proposal.md:726~729`）。

```
g(lv) = 1 + (lv − 1) × 0.06
```
| 档位 | LV1 | LV25 | LV50 | LV100 |
| ---- | ---- | ---- | ---- | ---- |
| `g(lv)` | **1.00** | **2.44** | **3.94** | **6.94** |

---

## 1. 现状实测表（字段 / 位置 / 现值，全部直读）

| # | 项 | 真源字段 | 位置（`文件名:行号`） | 现值 | 状态 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 1 | 技能冷却（新路径） | `CFG.skillSystem.skillDefs[*].levels[].cooldown` | `js/config.js:3056`(火球) `:3096` `:3134` `:3160` `:3186` `:3212` `:3238` `:3291` `:3317` `:3343` `:3369` `:3396` | 各技能幂曲线，如 `SK_FIREBALL` **1.80 → 0.90** | **已证实** |
| 1a | 冷却读取（运行时） | `SkillScheduler.cooldownFor` | `js/skill-scheduler.js:52~70` | `cooldown`（回落 `cd`）× `stats.cdMul`，**下限 floor 缺省 = 0** | **已证实** |
| 1b | 冷却下限字段 | `castPolicies[*].cdMulFloor` | `js/config.js:2997~2998`（`CAST_COOLDOWN`/`CAST_ORBIT`） | **未声明**（⇒ floor = 0） | **已证实** |
| 1c | 环绕有效间隔 | `SkillScheduler.intervalFor` | `js/skill-scheduler.js:95~111` | `max(冷却, 环绕持续)` | **已证实** |
| 2 | 伤害系数（新路径） | `levels[].parameters.coefficient` ＋ 节点 `damageBasis.coefficient` | `js/config.js:3057/3070`(火球) `:3135/3147` `:3161/3173` `:3187/3199` `:3213/3225` `:3239/3251` `:3292/3302` `:3318/3328` `:3344/3354` `:3370/3380` `:3397/3410` | `SK_FIREBALL` **1.50 → 6.50**（比值 ≈ 4.33×） | **已证实** |
| 2a | 系数消费 | `SkillDamage._sdComputeDamage` | `js/skill-damage.js:85` | `base × coeff × ratio × …` | **已证实** |
| 2b | 系数消费（运行时归一） | `SkillRuntime._resolveBasis` | `js/skill-runtime.js:853~859` | `nodeCoeff × derivedRatio` | **已证实** |
| 2c | 伤害系数（旧路径，仅溯源） | `CFG.skills[*].dmgMul` | `js/config.js:1347` 等 | 0.5 ~ 2.6 常量 | **已证实** |
| 3 | 派生比例（水晶派生） | `crystalDefs[*].operations[addNode].coefficient` | `js/config.js:3516`(分裂0.50) `:3532`(爆破0.60) `:3548`(余焰0.22) `:3648`(弹射0.70) `:3668`(链锁0.55) `:3688`(灼烧0.20) | 见左（**静态、无等级曲线**） | **已证实** |
| 3a | 派生比例（技能内派生） | `baseGraph.nodes[derived].damageBasis.coefficient` | `js/config.js:3083`(火球爆炸1.5) `:3263`(攻城爆炸1.9) | 1.5 / 1.9 | **已证实** |
| 3b | More 乘区基准 | `parameters.moreDamageMul` | `js/config.js:3069` `:3082` `:3106` `:3146` `:3172` `:3198` `:3224` `:3250` `:3262` `:3301` `:3327` `:3353` `:3379` `:3409` | **1**（全部节点显式声明） | **已证实** |
| 3c | More 唯一来源 | `crystalDefs.CR_ARCANE_AMP.levels[].parameters.more` | `js/config.js:3599` | 1.12 → 1.50 | **已证实** |
| 4 | 碰撞半径 | `CFG.skillSystem.defaults.orbit.contactRadius` | `js/config.js:2925` | **16**（注释「22.4 补，占位待平衡」） | **已证实** |
| 4a | 碰撞半径消费 | `SkillRuntime._makeEffect` | `js/skill-runtime.js:994` | `eff.radius = params.contactRadius ?? 0` | **已证实** |
| 4b | 环绕模板是否自带 | `effectTemplates.TP_ORBIT_CONTACT.params` | `js/config.js:3018` | `{radius, angularSpeed, count, hitInterval}` —— **无 `contactRadius`** | **已证实** |
| 5 | 环绕持续时间 | `CFG.skillSystem.defaults.orbit.duration` | `js/config.js:2925` | **6.0** | **已证实** |
| 5a | 持续时间消费 | `SkillRuntime._makeEffect` / `SkillScheduler.intervalFor` | `js/skill-runtime.js:995` / `js/skill-scheduler.js:95~111` | `eff.life = params.duration` | **已证实** |
| 6 | 预算（活动实体上限） | `CFG.skillSystem.budgets` | `js/config.js:2912~2920` | `maxEffectsPerHero:240` / `maxEffectsPerCast:64` / `maxDerivedPerEvent:16` / `maxEventDepth:2` / `maxEventPerStep:256` / `maxRegionsPerHero:48` / `overloadPolicy:"reject"` | **已证实** |
| 6a | 预算消费（运行时） | `SkillRuntime._budgets` | `js/skill-runtime.js:50~52`、`:612/622/926~933/915~916` | 读 `t.budgets`（**不是 `budgetPolicies`**） | **已证实** |
| 6b | 预算策略（仅校验） | `CFG.skillSystem.budgetPolicies.BP_DEFAULT` | `js/config.js:2984~2992` | 含 `maxEventDepth:3`（**≠ 6 的 2**） | **已证实** |
| 6c | Boss 弹幕护栏 | `CFG.boss.bulletBudget` / `bulletCap` / `bulletWindow` | `js/config.js:1157~1159` | 40 / 秒 · 260 · 1.0 | **已证实** |
| 6d | 性能红线（弹幕/特效/角色） | perf 基线 | `perf_test.js:6` | 每秒 **100 发子弹** · **80 特效** · **80 角色同屏** | **已证实** |
| 6e | 弹道性能红线注释 | 「弹道性能红线 100/秒，Boss 占 40」 | `js/config.js:1157` | 玩家技能侧剩余 ≈ **60/秒** | **已证实** |

---

## 2. 逐项提案

> 通用格式：**现位置 → 现值 → 建议值 → 理由 → 落库字段名**。
> 所有连续值（冷却 / 系数）的 LV1 **一律锁死现有迁移基准，不得漂移**（`skill_rule_binding_test.js:378~379`、`crystal_expansion_test.js:120~122` 已锁定）。

### 2.1 技能冷却

- **现位置**：`CFG.skillSystem.skillDefs[*].levels[].cooldown`（`js/config.js:3056` 等）
- **现值**：各技能 LV1→LV100 幂曲线；`SK_FIREBALL` **1.80 → 0.90**（比值 0.50×）
- **建议值**：**LV1 保持**；LV100 = `LV1 × 0.60`（冷却最多压缩 40%）
  - 插值口径（≤5 行，与「三级填法①」连续值一致）：冷却比 `r_cd(lv) = 1 − 0.40 × (lv − 1) / 99`

  | 档位 | LV1 | LV25 | LV50 | LV100 |
  | ---- | ---- | ---- | ---- | ---- |
  | `r_cd(lv)` | **1.00** | **0.90** | **0.80** | **0.60** |

- **理由**：
  1. 现占位把冷却压到 **0.50×**，与「技能效果每级 +6%」的伤害成长叠加后，DPS 在 LV100 膨胀到 **13.9×**（= 6.94 ÷ 0.50）；收到 0.60× 后为 **11.57×**，与敌人同等级 HP 成长 **12.88×**（`1+(lv−1)×0.12`，`js/config.js:110` 注释）**同量级、略低**，可被水晶/装备补足。
  2. §8.5 表 4a 明写「**CD 不变**」（`game_design_proposal.md:935`）—— 本提案**不取 100% 恒定**（肉鸽手感偏静态），而取「温和递减 + 硬下限」，两处口径的差异列为待裁决 §5-D2。
  3. `cooldownFor` 的 `cdMulFloor` **当前缺省 = 0**（`js/skill-scheduler.js:65`），`CR_COOLDOWN` 的 `cdMul` 最小 0.60（`js/config.js:3619`）虽不致命，仍建议补防御性下限（见 §4 落库清单）。
- **落库字段名**：`CFG.skillSystem.skillDefs.SK_*.levels[].cooldown`（由 `skillLevels(n, { cooldown:[LV1, LV1×0.60], … })` 生成）；`CFG.skillSystem.castPolicies.CAST_COOLDOWN.cdMulFloor` / `CAST_ORBIT.cdMulFloor`。

### 2.2 伤害系数

- **现位置**：节点 `damageBasis.coefficient`（`js/config.js:3070` 等）＋ 等级行 `levels[].parameters.coefficient`（`js/config.js:3057` 等）
- **现值**：`SK_FIREBALL` **1.50 → 6.50**（比值 4.33×）
- **建议值**：**LV1 保持**；LV100 = `LV1 × 6.94`（= `LV1 × g(100)`），即**线性 +6%/级**，与 §8.5「技能效果每级 +6%（线性）」及 §0.1 `g(lv)` 同源

  | 档位 | 乘数 | `SK_FIREBALL`(base 1.50) | `SK_RAILGUN`(base 1.60) | `SK_SIEGEBLAST`(base 1.90) |
  | ---- | ---- | ---- | ---- | ---- |
  | LV1 | ×1.00 | **1.50** | **1.60** | **1.90** |
  | LV25 | ×2.44 | 3.66 | 3.90 | 4.64 |
  | LV50 | ×3.94 | 5.91 | 6.30 | 7.49 |
  | LV100 | ×6.94 | **10.41** | **11.10** | **13.19** |

- **理由**：
  1. `skill_effect_balance_v0.1.md` §0.2 已实测批 1 系数比值仅 **4.1~4.3×**，并明确建议「统一改用同源 `g(lv)`（L100 = 6.94）」（`skill_effect_balance_v0.1.md:46~47`）；本提案**采纳该建议**。
  2. §8.5 三级填法①对连续值给的就是**线性公式**（`game_design_proposal.md:728~729`），现有幂曲线 `skillCurve`（`js/config.js:21~33`）是**实现偏离规约**，本提案按规约口径给出锚点（形态差异列为待裁决 §5-D1）。
  3. 与其他已落库数值同源：`B5` 提案、`g(lv)` 均复用同一标尺，避免第二套数字。
- **落库字段名**：`CFG.skillSystem.skillDefs.SK_*.levels[].parameters.coefficient`（连同主节点 `baseGraph.nodes[primary].damageBasis.coefficient` 的 LV1 基准）。

### 2.3 派生节点比例

本项由三部分组成，分别给建议。

**(a) More 乘区基准 `parameters.moreDamageMul`**

- **现位置**：各节点 `parameters.moreDamageMul`（`js/config.js:3069` 等，共 14 处）；唯一增益来源 `CR_ARCANE_AMP.levels[].parameters.more`（`js/config.js:3599`）
- **现值**：基准恒 **1**；`CR_ARCANE_AMP` `more` = **1.12 → 1.50**
- **建议值**：基准 **保持 1**（乘法归并基准，缺省 0 会让增幅变 0 —— `js/config.js:3068` 注释已警示，**不得改**）；`CR_ARCANE_AMP` LV1 保持 **1.12**，LV100 收到 **1.55**
- **理由**：`moreDamageMul` 是「独立 More 乘区」的合并基准（`js/skill-runtime.js:856`），恒为 1 才能让 `CR_ARCANE_AMP` 的 `merge:"multiply"` 正确累积（`js/config.js:3597`）；`1.55` 使「通用增幅」在满级时确有一次可感知收益（+55% 魔法伤），仍受「≤4 槽」与互斥约束。
- **落库字段名**：`CFG.skillSystem.crystalDefs.CR_ARCANE_AMP.levels[].parameters.more`（基准字段 `parameters.moreDamageMul` 不动）。

**(b) 派生比例（水晶派生全 6 项）** —— 建议**维持现值首轮定稿**（折损阶梯已合理、无测试锁定但改动收益不明）

| 派生来源 | 水晶 | 品质 | 字段 | 现值 | 建议值 | 理由（一句话） |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 分裂小弹 | `CR_SPLIT` | 史诗 | `operations[addNode].coefficient`（`js/config.js:3516`） | 0.50 | **0.45** | 数量 2→8 成长，单颗比例应略降防「数量×比例」双爆 |
| 命中爆破 | `CR_EXPLOSION` | 史诗 | `:3532` | 0.60 | **0.60** 保持 | 命中后补一次 60% 范围伤，与 `damageRatio` L1 一致（`crystal_expansion_test.js:132`） |
| 消失余焰 | `CR_AFTERFLAME` | 稀有 | `:3548` | 0.22 | **0.22** 保持 | 与 `damageRatio` L1 一致（`crystal_expansion_test.js:133`） |
| 弹射 | `CR_BOUNCE` | 史诗 | `:3648` | 0.70 | **0.70** 保持 | 逐跳递减、每跳独立命中，故单跳比例最高 |
| 链锁 | `CR_CHAIN` | 史诗 | `:3668` | 0.55 | **0.55** 保持 | 瞬发传导，无需飞行时间 → 比例低于弹射 |
| 灼烧 | `CR_BURN` | 稀有 | `:3688` | 0.20 | **0.20** 保持 | 跟随目标的持续伤害，靠 tick 累积 |

- **落库字段名**：`CFG.skillSystem.crystalDefs.<CR_*>.operations[<opId>].coefficient`（仅 `CR_SPLIT` 由 0.50 → 0.45）。
  ⚠️ 若改 `CR_SPLIT`，须同步 `crystal_expansion_test.js` 相关断言（该文件未直接锁 `op.coefficient`，但需回归）。

**(c) 技能内派生比例（`SK_FIREBALL.n_burst` / `SK_SIEGEBLAST.n_siegeburst`）** —— 建议**保持 1.5 / 1.9**

- **现值**：`js/config.js:3083`（1.5）、`:3263`（1.9）
- **理由**：这俩派生节点的比例 = **主弹系数本身**，代表「半径 130 / 190 内每目标各 150% / 190% 一次」的净效果，等于旧 `AT102` / `AT112`（`js/config.js:3074~3076` 注释），是迁移基准，**不动**。
- **落库字段名**：`CFG.skillSystem.skillDefs.SK_FIREBALL.baseGraph.nodes[n_burst].damageBasis.coefficient` / `…SK_SIEGEBLAST…[n_siegeburst]…`。

**(d) 🔴 结构发现：派生比例当前「不随等级成长」**（**已证实**，非填数字可解）

- 现象：`CR_EXPLOSION` / `CR_AFTERFLAME` 定义了等级曲线 `{ damageRatio:[0.60,1.25] }` / `{ damageRatio:[0.22,0.52] }`（`js/config.js:3536`/`:3552`），但二者在 `operations` 里**没有** `field`/`parameter` 接线；`compiler` 的 `createNode` 分支只把 `op.field` 写进派生节点 **params**（`js/skill-compiler.js:588~595`），**不会**写 `damageBasis.coefficient`（`:601~605`）。
- 消费侧：`_resolveBasis` 的 `derivedRatio` 只读 `nb.coefficient`（`js/skill-runtime.js:854~855`），**不读 `params.damageRatio`**（`SkillRuntime._resolveBasis` 全文仅取 `params.coefficient` / `params.moreDamageMul`）。
- **未发现证据**：全库 `grep` 未发现任何代码读取 `damageRatio`（除水晶定义自身与 `crystal_expansion_test.js:132~133` 的 L1 锁定）。
- 结论：**「派生比例随水晶等级成长」= 需新设计（阻断）** —— 要么在运行时让 `derivedRatio` 支持 `params.damageRatio`，要么在编译期为 `op.coefficient` 增加「等级驱动」通道。二者都**改代码**，非本提案数字范畴。列 §5-D4。

### 2.4 `contactRadius`

- **现位置**：`CFG.skillSystem.defaults.orbit.contactRadius`（`js/config.js:2925`）
- **现值**：**16**（注释标「22.4 补，占位待平衡」，`js/config.js:2926`）
- **建议值**：**16（保持）**；并把该值**显式写进环绕模板** `effectTemplates.TP_ORBIT_CONTACT.params.contactRadius = 16`（现模板缺该键，`js/config.js:3018`）
- **理由**：
  1. 英雄碰撞半径 18~21（`js/config.js:1200~1249`）、普通怪 `radius` 15~23（`js/config.js:979~1014`）；接触圈 16 → 有效命中半径 ≈ 16 + m.r ≈ 31~39，贴合「贴身环绕」手感。
  2. **回归约束**：`skill_rule_binding_test.js:496` 已**硬锁** `contactRadius === 16`，保持即零回归。
  3. 模板显式化后，策划可在**模板级**调（当前只能改全局 `defaults`，粒度太粗），属配置内改动、无新机制。
- **落库字段名**：`CFG.skillSystem.defaults.orbit.contactRadius`（默认 16）；建议新增 `CFG.skillSystem.effectTemplates.TP_ORBIT_CONTACT.params.contactRadius`（默认 16）。
- **待裁决**：是否让 `contactRadius` **随 `CR_ORBIT` 等级成长**（现无等级驱动，需新增字段 + 改动 `_makeEffect`/`_resolveBasis` → 见 §5-D5）。

### 2.5 `orbit.duration`

- **现位置**：`CFG.skillSystem.defaults.orbit.duration`（`js/config.js:2925`）
- **现值**：**6.0**
- **建议值**：**6.0（保持）**
- **理由**：
  1. 有效施放间隔 = `max(冷却, 持续)`（`js/skill-scheduler.js:97~109`）。`SK_FIREBALL` 冷却 LV1 = 1.80 < 6.0 → **持续成为约束** → 环绕批次**常驻刷新（覆盖率 100%）**。这正是 v0.5 §2「环绕：有效施放间隔 = max(冷却, 环绕持续时间)」的设计意图（`game_design_proposal.md:2989`、`skill_system_master_v1.md:140`）。
  2. **回归约束**：`skill_rule_binding_test.js:497` 锁 `duration === 6`、`:498` 锁 `interval === 6`，保持即零回归。
  3. 与 `hitInterval: 0.35`（`js/config.js:3018`）配合：`HP_ORBIT_CONTACT` 按 `ownerId+skillId+group+targetId` 共享间隔（`js/skill-runtime.js:557~565`），**多枚接触体不叠加频率** → 常驻不产生“每帧多段”爆炸风险。
- **落库字段名**：`CFG.skillSystem.defaults.orbit.duration`（默认 6.0）。
- **待裁决**：是否允许「常驻」；若不允许，须令 `duration < cd` 或加 `castPolicies.CAST_ORBIT.duration` / `durationCap`（**当前未声明** `durationCap`）。见 §5-D6。

### 2.6 性能 / 复杂度预算阈值

> 锚点：**性能红线 = 100 弹/秒 · 80 特效 · 80 角色同屏**（`perf_test.js:6`）；**Boss 弹幕占 40/秒**、同屏 ≤ 260（`js/config.js:1157~1159`，被 `boss_test.js:101` 硬锁）。**玩家技能侧弹幕剩余 ≈ 60/秒。**

- **现位置**：`CFG.skillSystem.budgets`（`js/config.js:2912~2920`）＋ `budgetPolicies.BP_DEFAULT`（`js/config.js:2984~2992`）
- **现值 → 建议值**：

| 字段 | 现位置 | 现值 | 建议值 | 理由 |
| ---- | ---- | ---- | ---- | ---- |
| `maxEffectsPerHero` | `js/config.js:2913` | 240 | **120** | 240 活动实体远超 80 特效红线；按「每实体平均产 <1 FX」折算，120 可在最坏情形仍受控；且 `skill_integration_test.js:221` 只断言 `maxEffects ≤ budget`（动态读），下调零回归 |
| `maxEffectsPerCast` | `:2914` | 64 | **48** | 单次施放实体上限；最高 `count` = `CR_ORBIT` L100 = 10 / `CR_SPLIT` 8 / `SK_RINGBARRAGE` 12，48 仍留足余量 |
| `maxDerivedPerEvent` | `:2915` | 16 | **12** | 与 `EP_DERIVED_EACH_HIT.maxCount = 12`（`js/config.js:2979`）对齐，消除两表口径差 |
| `maxEventDepth` | `:2916` | **2** | **3** | 🔴 **与 `budgetPolicies.BP_DEFAULT.maxEventDepth = 3`（`js/config.js:2990`）不一致**；运行时读 `budgets`（`js/skill-runtime.js:50~52`、`:622`）→ 链式派生被静默截断到 2 层，与 `js/config.js:2988~2989` 注释意图矛盾。**统一为 3** |
| `maxEventPerStep` | `:2917` | 256 | **256** 保持 | 单模拟步事件消费上限，无性能压力证据，维持 |
| `maxRegionsPerHero` | `:2918` | 48 | **32** | 持续区域上限，与同屏 80 特效红线取齐 |
| `overloadPolicy` | `:2919` | `"reject"` | **`"reject"`** 保持 | 超额**整体拒绝**（而非静默截断），符合「非法/超限都可定位报告」（`game_design_proposal.md:3089`） |
| `budgetPolicies.BP_DEFAULT.maxEventDepth` | `js/config.js:2990` | 3 | **3** 保持 | 与 `budgets.maxEventDepth` 统一后一致 |

- **新增（需工程接线，见 §5-D9）**：
  - `CFG.skillSystem.budgets.maxPlayerBulletsPerSec = 60`　// 玩家技能侧每秒弹丸上限（= 性能红线 100 − Boss 40；`js/config.js:1157` 注释）
- **落库字段名**：`CFG.skillSystem.budgets.{maxEffectsPerHero, maxEffectsPerCast, maxDerivedPerEvent, maxEventDepth, maxRegionsPerHero}`；`CFG.skillSystem.budgets.maxPlayerBulletsPerSec`（**新增**）。
- **⚠️ 不改动**：`CFG.boss.bulletBudget / bulletCap / bulletWindow`（`boss_test.js:101` 硬锁 40 / 260 / 1.0）。

---

## 3. 锚点表（≤5 行插值口径，与「三级填法」一致）＋ 典型局面自洽核对

### 3.1 锚点表（统一口径）

**① 连续值（冷却 / 系数 / 范围…）— 公式驱动**（§8.5 填法①，`game_design_proposal.md:728~729`）：

| 量 | LV1 | LV25 | LV50 | LV100 | 口径 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| **伤害系数乘数** | 1.00 | 2.44 | 3.94 | 6.94 | `= g(lv)`（+6%/级 线性） |
| **冷却比 `r_cd`** | 1.00 | 0.90 | 0.80 | 0.60 | `= 1 − 0.40×(lv−1)/99` |

> 两者乘积（DPS 成长）LV100 = `6.94 ÷ 0.60 = 11.57×`。

**② 整数离散值（弹道/召唤/穿透/陷阱）— 锚点插值**：**已落库，本提案不重列**，真源见 `js/config.js:3059/3137/3163/3189/3215/3241/3400/3431`（B1 提案 `balance_proposal_b1_b2_v0.1.md` 已批准，被 `skill_balance_anchors_test.js:91~99` 锁定）。

### 3.2 典型局面自洽核对（必须摊开说清）

假设 H001 猎手（`atk = 16`，`js/config.js:1202`）、`SK_FIREBALL` 单体、`count = 1`、命中即结算：

| 档位 | 系数 | 冷却(s) | **单体 DPS** | 相对 LV1 |
| ---- | ---- | ---- | ---- | ---- |
| LV1 | 1.50 | 1.80 | **13.33** | 1.00× |
| LV25 | 3.66 | 1.63 | **35.93** | 2.70× |
| LV50 | 5.91 | 1.44 | **65.67** | 4.93× |
| LV100 | 10.41 | 1.08 | **154.2** | **11.57×** |

**与敌人成长的自洽对照**：
- 怪物同等级成长 = `1 + (lv−1)×0.12`（`js/config.js:110` 注释）→ LV100 = **12.88×**。
- 玩家技能 DPS 成长 **11.57×** ≈ 敌 HP 成长 12.88× 的 **0.90 倍** → **相对 TTK 基本持平、略拉长**，缺口由「水晶 / 装备 / 局内等级（B5）」补足。**结论：量级自洽，无 25× 级别爆炸斜率**（对比 `skill_effect_balance_v0.1.md:178` 的 `summon` DPS 25.6× 失衡项）。
- **TTK 抽样**：LV1 火球一次施放 = 直击 `16×1.5=24` + 爆炸 `24` ≈ 48 伤，对 L1 普通怪（`NM0010` HP 20，`js/config.js:980`）**1 次施放即杀**，TTK ≈ 1 个冷却（1.80s）；LV100 对同相对强度怪（HP ≈ 20×12.88 ≈ 258）需 ≈ 2 次（`154.2×1.08≈166` / 次）→ **TTK 量级稳定在 1~2 次施放**。✅

### 3.3 环绕类自洽核对（`contactRadius` / `orbit.duration`）

- `SK_FIREBALL` + `CR_ORBIT`：有效间隔 = `max(1.80, 6.0) = 6.0`（`js/skill-scheduler.js:97~109`）→ **常驻 6s 一批、批到即换**，覆盖率 **100%**。
- 单目标命中频率受 `hitInterval = 0.35`（`js/config.js:3018`）约束，且 `HP_ORBIT_CONTACT` 跨多枚接触体**共享** `nextAllowedHitTime`（`js/skill-runtime.js:557~565`）→ 单目标 DPS ≈ `16×1.5/0.35 ≈ 68.6`（LV1），**与接触体数量无关**。故「`contactRadius` 维持 16 / `duration` 维持 6.0」不会因数量成长（`orbitCount` 3→10）而频率爆表。✅
- ⇒ **`contactRadius` / `duration` 维持现值自洽，无需改动**（§5-D5/D6 仅为可选增强）。

---

## 4. 落库清单（精确字段名 + 位置 + 默认值）

> 全部写成**进 CFG 的结构**，🔧 = **占位值，待策划定稿**。仅登记，不实施。

**① 技能冷却 / 系数（`js/config.js` 的 `skillLevels` 调用，`js/config.js:3055` 等）**

```js
/* SK_FIREBALL 等 12 个技能 —— 🔧 占位值，待策划定稿 */
levels: skillLevels(SKILL_LEVEL_MAX,
  /* 冷却：LV1 锁死迁移基准，LV100 = LV1 × 0.60（L100 终点由提案定；曲线由 skillCurve 生成） */
  { cooldown: [1.80, 1.08], castTime: [0, 0] },
  /* 系数：LV1 锁死 = 1.50，LV100 = 1.50 × 6.94 = 10.41（= g(lv) 终点） */
  { coefficient: [1.50, 10.41], speed: [480, 715], life: [1.60, 2.20], radius: [8, 12] },
  { count: { 1: 1, 25: 1, 60: 1, 100: 1 } }),
```

**② 冷却安全下限（`js/config.js:2997~2998`）**

```js
castPolicies: {
  CAST_COOLDOWN: { id: "CAST_COOLDOWN", requiresTarget: true,  trigger: "cooldown", cdMulFloor: 0.35 }, // 🔧 占位值，待策划定稿
  CAST_ORBIT:    { id: "CAST_ORBIT",    requiresTarget: false, trigger: "cooldown", cdMulFloor: 0.35 }, // 🔧 占位值，待策划定稿
},
```

**③ 派生比例（`js/config.js` 的 `crystalDefs` 操作内）**

```js
/* CR_SPLIT 分裂小弹 —— 🔧 占位值，待策划定稿 */
{ id: "split.spawn", executor: "addNode", /* … */ coefficient: 0.45, /* … */ },
/* CR_EXPLOSION / CR_AFTERFLAME / CR_BOUNCE / CR_CHAIN / CR_BURN —— 维持现值，不列改动 */
```

**④ `contactRadius` / `orbit.duration`（`js/config.js:2925`）**

```js
defaults: {
  orbit: {
    radius: 70, angularSpeed: 2.2, count: 3, hitInterval: 0.35,
    contactRadius: 16, // 🔧 占位值，待策划定稿（维持 16；显式写进模板见下）
    duration: 6.0,     // 🔧 占位值，待策划定稿（维持 6.0 = 常驻覆盖率 100%）
  },
},
```

**⑤ 环绕模板显式化（新增，`js/config.js:3018`）**

```js
TP_ORBIT_CONTACT: {
  /* … */ params: { radius: 70, angularSpeed: 2.2, count: 3, hitInterval: 0.35, contactRadius: 16 }, // 🔧 contactRadius 新增，待策划定稿
},
```

**⑥ 预算阈值（`js/config.js:2912~2920`）**

```js
budgets: {
  maxEffectsPerHero: 120,   // 🔧 240 → 120（贴合 80 特效红线），待策划定稿
  maxEffectsPerCast: 48,    // 🔧 64 → 48，待策划定稿
  maxDerivedPerEvent: 12,   // 🔧 16 → 12（对齐 EP_DERIVED_EACH_HIT.maxCount），待策划定稿
  maxEventDepth: 3,         // 🔧 2 → 3（与 budgetPolicies.BP_DEFAULT 统一），待策划定稿
  maxEventPerStep: 256,     // 维持
  maxRegionsPerHero: 32,    // 🔧 48 → 32，待策划定稿
  maxPlayerBulletsPerSec: 60, // 🔧 新增：玩家弹幕/秒（= 红线 100 − Boss 40），待策划定稿
  overloadPolicy: "reject", // 维持
},
```

**⑦ More 乘区（`js/config.js:3599`）**

```js
CR_ARCANE_AMP: { /* … */ levels: skillLevels(SKILL_LEVEL_MAX, null, { more: [1.12, 1.55] }) /* 🔧 LV100 1.50→1.55，待策划定稿 */ },
```

---

## 5. 待裁决项（编号）

| # | 议题 | 选项 A | 选项 B | 影响 | 优先级 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| **D1** | 连续值曲线**形态** | **线性 `g(lv)`**（§8.5 规约口径，本提案推荐） | 保留现值**幂曲线** `skillCurve`（`js/config.js:21~33`） | LV1/LV100 同端点，**中段（LV10~LV60）手感差异最大** | 🔴 高 |
| **D2** | 冷却是否随等级下降 | **温和递减**（LV100 = 0.60×，本提案） | §8.5 表 4a「**CD 不变**」（`game_design_proposal.md:935`） | 直接决定 DPS 成长斜率（11.57× vs 6.94×） | 🔴 高 |
| **D3** | 伤害系数 LV100 目标 | **LV1 × 6.94**（统一 `g(lv)`，本提案） | 保留现值 **≈4.33×** | 技能满级绝对强度 | 🔴 高 |
| **D4** | 派生比例是否**随等级成长** | 新增接线（运行时读 `params.damageRatio` 或编译期等级驱动） | **维持静态**（本提案：仅调整 `CR_SPLIT` 常数） | 需**改代码**（`skill-runtime.js` / `skill-compiler.js`）→ 见 §2.3(d) | 🟠 中 |
| **D5** | `contactRadius` 是否按晶体等级成长 | 维持全局 16（本提案） | 新增等级驱动（16→28） | 需新增字段 + 改 `_makeEffect` | 🟠 中 |
| **D6** | 环绕**常驻**（覆盖率 100%）是否允许 | **允许**（本提案：`duration ≥ cd`） | 强制 `duration < cd` | 环绕类强度上限 | 🟠 中 |
| **D7** | `budgets.maxEventDepth`（2）与 `budgetPolicies.BP_DEFAULT.maxEventDepth`（3）**双表不一致** | **统一为 3**（本提案；运行时读 `budgets`） | 统一为 2 | 链式派生（弹射/链锁）实际可达深度 | 🟠 中 |
| **D8** | `maxEffectsPerHero` 是否由 240 收到 120 | **收到 120**（本提案，贴红线） | 维持 240 | 最坏对象数 / 同屏特效预算 | 🟠 中 |
| **D9** | 是否新增 `budgets.maxPlayerBulletsPerSec = 60` | **新增**（本提案） | 不新增（沿用 Boss 单一预算） | 需工程接线，玩家弹幕无独立护栏 | 🟡 低 |

---

## 6. 回归影响（`grep` 真实测试文件名与行号）

> 下列断言**已硬锁本提案涉及的字段**（改值必红）或**动态读取**（改值安全）。落库前须逐条评估。

| 测试文件:行号 | 断言内容 | 与本提案关系 |
| ---- | ---- | ---- |
| `skill_rule_binding_test.js:378` | `SK_FIREBALL.levels[0].cooldown === 1.8` | **硬锁 LV1**（本提案 LV1 不动 → 零回归） |
| `skill_rule_binding_test.js:379` | `levels[0].parameters.coefficient === 1.5` | **硬锁 LV1**（同上） |
| `skill_rule_binding_test.js:492` | `orbit.p.coefficient === 1.5 && moreDamageMul === 1` | 锁 `moreDamageMul` 基准（本提案保持 1） |
| `skill_rule_binding_test.js:496` | `orbit.rt.contactRadius === 16` | **硬锁 `contactRadius`**（本提案保持 16 → 零回归） |
| `skill_rule_binding_test.js:497` | `orbit.rt.duration === 6` | **硬锁 `orbit.duration`**（本提案保持 6 → 零回归） |
| `skill_rule_binding_test.js:498` | `interval === 6` | 锁 `max(cd, duration)` 结果（同上） |
| `crystal_expansion_test.js:120` | `SK_FIREBALL.levels[0].cooldown === 1.80` | 硬锁 LV1（不动） |
| `crystal_expansion_test.js:122` | `levels[0].parameters.coefficient === 1.50` | 硬锁 LV1（不动） |
| `crystal_expansion_test.js:132~133` | `CR_EXPLOSION.damageRatio L1 = 0.60` / `CR_AFTERFLAME = 0.22` | 锁 `damageRatio` 等级参数 L1（本提案未改此二值，仅 `CR_SPLIT` 由 0.50→0.45） |
| `crystal_expansion_test.js:141/147/149/151~154` | 扩表水晶 L1 值（`cdMul 0.94` / `speedMul 1.10` / `count 1` / `dps 6`） | 本提案未改 → 零回归 |
| `crystal_expansion_test.js:378` | 读 `budgetPolicies.BP_DEFAULT.maxEventDepth` | 本提案统一为 3（保持 BP_DEFAULT 不变） |
| `skill_balance_anchors_test.js:91~99` | B1 八技能整数锚点源码守卫 | 本提案不动整数锚点 → 零回归 |
| `skill_balance_anchors_test.js:120~121` | B1 LV1 基线不漂移 + LV100 达目标 | 同上 |
| `skill_balance_anchors_test.js:130~134` | 整数曲线单调、陷阱/召唤成长 | 同上 |
| `skill_fps_test.js:117` | 读 `t.budgets.maxEffectsPerHero` | 动态读 → 下调安全 |
| `skill_integration_test.js:210` | 读 `budgets.maxEffectsPerHero` | 动态读 → 下调安全 |
| `skill_integration_test.js:219` | `swCd <= 2.40` | 与冷却上限相关（本提案 LV1 不动，安全） |
| `skill_integration_test.js:221~222` | `maxEffects <= budget` / `effectsAlive <= budget` | 动态读 → 下调安全 |
| `skill_events_test.js:31~33` | 读 `budgets.maxEventPerStep` / `maxEventDepth` | 动态读 → 改为 3 安全（其断言基于读取值自洽） |
| `skill_config_test.js:130` | 删 `BP_DEFAULT.maxEffectsPerHero` 测校验 | 该校验字段须存在（本提案保留） |
| `skill_compiler_test.js:163 / :514` | stub 内 `budgets`（自带，非真源） | 与真源无关 |
| `skill_table_test.js:122 / :578~579` | `AT113`（旧路径）L100 / `CFG.buffLevel.cdMulFloor === 0.30` | **旧路径，本提案不涉及** |
| `boss_test.js:101` | `CFG.boss.bulletBudget===40 && bulletCap===260 && bulletWindow===1` | **硬锁 Boss 预算**（本提案明确不动） |

**⚠️ 高风险项**：若最终采纳 D3（系数 LV100 由 4.33× → 6.94×）与 D2（冷却 LV100 0.50× → 0.60×），**须审查 `skill_fps_test.js` / `skill_integration_test.js` / `skill_enable_runtime_test.js` 的端到端场景**（其「施放数 / 伤害量」会随曲线变化而变；这些测试多断言「>0 / ≤budget」而非定值，预计不红，但**必须实跑**）。
**零回归项**：`contactRadius`、`orbit.duration`、`moreDamageMul`、全部 LV1 值、Boss 预算 —— 本提案**均不改**，上表对应断言保持绿。

---

## 附录 · 本文件引用的代码 / 文档位置（全部实测）

| 内容 | 位置 |
| ---- | ---- |
| §20.12 缺口 2「首轮数值平衡」 | `G_docs/game_design_proposal.md:3103` |
| 第二章技能运行（环绕间隔 = max(cd, duration)） | `G_docs/game_design_proposal.md:2989` |
| §8.5 三级填法（连续=公式 / 整数=锚点 / 非线性=分段） | `G_docs/game_design_proposal.md:726~738`、`:939~951` |
| §8.5 表 4a「CD 不变 / 伤害系数每级 +6%」 | `G_docs/game_design_proposal.md:930~937` |
| 等级系数 `g(lv)` 复用口径 | `G_docs/skill_effect_balance_v0.1.md:18~31`、`:46~47` |
| 占位值清单（master §6-#7） | `G_docs/skill_system_master_v1.md:319` |
| `SKILL_LEVEL_MAX = 100` / `skillCurve` / `skillSteps` / `skillStepsAnchors` / `skillLevels` | `js/config.js:18`、`:21~102` |
| `CFG.skillScaleBy.levelGrowth = 0.06` | `js/config.js:1337~1338`（实测；旧文引 1306~1308 已失效） |
| 英雄表（H001 atk16 … H012 atk14） | `js/config.js:1199~1250` |
| 怪物表（NM0010 HP20 …） | `js/config.js:979~1014` |
| `CFG.boss`（bulletBudget 40 / bulletCap 260） | `js/config.js:1156~1159` |
| `CFG.skillSystem.budgets` | `js/config.js:2912~2920` |
| `CFG.skillSystem.defaults`（orbit.contactRadius 16 / duration 6.0） | `js/config.js:2922~2933` |
| `budgetPolicies.BP_DEFAULT`（maxEventDepth 3） | `js/config.js:2984~2992` |
| `castPolicies`（无 cdMulFloor / durationCap） | `js/config.js:2996~2999` |
| `effectTemplates.TP_ORBIT_CONTACT.params`（无 contactRadius） | `js/config.js:3014~3019` |
| `skillDefs.SK_FIREBALL`（cooldown/coefficient/count） | `js/config.js:3047~3092` |
| `skillDefs` 其余 11 技能 | `js/config.js:3093~3452` |
| `crystalDefs`（6 派生比例 + CR_ARCANE_AMP.more） | `js/config.js:3457~3698` |
| 反馈/预算消费：`SkillRuntime._budgets` | `js/skill-runtime.js:50~52`、`:612~622`、`:915~933` |
| 派生比例消费：`SkillRuntime._resolveBasis` | `js/skill-runtime.js:842~867` |
| 环绕接触/碰撞半径：`_makeEffect` / `_phaseDamage` | `js/skill-runtime.js:988~995`、`:557~565` |
| 伤害公式：`SkillDamage._sdComputeDamage` | `js/skill-damage.js:81~111` |
| 冷却：`SkillScheduler.cooldownFor` / `intervalFor` / `castTimeFor` | `js/skill-scheduler.js:52~70`、`:95~111`、`:119~125` |
| 编译器派生节点：`createNode` 分支 | `js/skill-compiler.js:585~614` |
| 性能红线（100 弹/秒 · 80 特效 · 80 角色） | `perf_test.js:6` |
