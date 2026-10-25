# Godot 4.7 技能系统 · 施工规格（AI 执行版）

**版本**：v1.0　**生成日期**：2026-10-19　**配套**：《流放之路风格·高自由度技能系统规格.md》（下称"原规格"）
**本文性质**：这是**执行约束文件**，不是设计建议。标注「必须」的条目不得自行改写；标注「可选」的条目需先向人类确认。

---

## §导航 · 本文件 1030 行，按任务读，不要通读

> **R22 新增**。本文件是 S1 宪法，内容必须完整，但**你不需要从头读到尾**。
> 先读 `_AI开发与文档/00_开工必读.md`（唯一入口），再按下表跳读。

| 你要做的事 | 读这几节 |
|---|---|
| 写主动技能 `.tres` | §3.1 / §3.6 / §15 |
| 写辅助宝石 `.tres` | §3.3 / §6 / §13.1 |
| 改数值 / 伤害管线 | **§4（宪法）** / §8 / §12 G1–G4 |
| 改装配 / 插槽 | §3.3 / §5 / §12 G5–G7b |
| 加新行为 | §3.6 / §5 / §9 |
| 改触发器 | §7 / §12 G10 |
| 改性能 / 对象池 | §9 |
| 修 bug（先看已知缺口） | §0.1 / §0.2 |
| 提交前自检 | 附录 C |

| 你要什么 | 章节 |
|---|---|
| 进度 / 已知缺口 | §0 / §0.1 / §0.2 |
| 六张数据表（字段级） | §3（3.1 SkillData · 3.2 ModifierSpec · 3.3 SupportGemData · 3.4 TriggerData · 3.5 StatDef · 3.6 BehaviorConfig） |
| **七步伤害管线（宪法）** | §4（4.1 双维度作用域 · 4.2 计算顺序 · 4.3 转换 · 4.4 快照） |
| 插槽与装配 | §5（5.1 结构 · 5.2 SocketGraph · 5.3 武器栏多槽） |
| 辅助宝石四口子 | §6（6.3 = 口子 4 开启清单） |
| 触发与限流 | §7 |
| 性能三档红线 | §9 |
| 目录结构 | §10 |
| **10 条黄金用例（可手算）** | §12 |
| **禁止事项** | §13 |
| 术语替换 / IP 风险 | §15 |
| ~~§16 内容批量制作~~ | **暂缓执行，别用**（未裁定） |
| PoB 读取清单 / kit 抄不抄 | 附录 A / B |

> ⚠️ **§16「正式内容制作规范」标记「暂缓执行」**：内容生产路线 A/B/C 未经人类裁定。
> 人类裁定前，内容只能逐个手写 `.tres`（按《内容设计手册》）。**不要照 §16 建生成器/CSV/lint。**

---

## 0. 给执行 AI 的三十秒说明

你要在 **Godot 4.7.x + GDScript** 中实现一套类 PoE 的数据驱动技能系统。核心复杂度全部集中在**属性结算管线**与**辅助石装配**两处，其余都是它的外设。

**开工前记住六句话**：

1. **运行时逻辑只写一次，技能差异全部来自数据**。新增一个技能 = 新增一个 `.tres`，不改 `.gd`。
2. **修饰符只有三种算子**：`FLAT_ADD`（加）、`INCREASED`（加算百分比）、`MORE`（乘算百分比）。禁止出现第四种、禁止混用。
3. **辅助石通过"标签三元组 + 修饰符列表"生效**，不允许在代码里写 `if gem_id == "xxx"`。
4. **行为组件不认识具体宝石**，只读 `SkillContext` 里的最终数值。
5. **热路径禁止 `instantiate/free`**，投射物/特效/Hitbox 一律走对象池与数据化数组。
6. **每个里程碑必须有可手算核对的断言**，测试不绿不得进入下一阶段。

**禁止**：引入任何未经人类批准的新依赖；不得参考无许可证的仓库（尤其 `Simplereally/the-exile-engine-v2`，该仓库无 LICENSE，代码不可复制）；不得照搬 Path of Exile 的技能名与数值。

**交付**：按 §11 的 M0–M8 顺序提交，每阶段附测试报告（通过数/失败数/未覆盖项）。

## 0.1 施工进度（2026-10-19 R7 校准）

**M0–M8 的代码、headless 测试、桌面渲染压测均已完成**，全量 **261 用例 / 1749 断言 100% 绿**
（含 R11 文档来源门禁 4 用例、R12 等级曲线 11 用例），

> **R22 校准**：数字由 1746 改为 **1749**。`tests/docs/test_docs_provenance.gd` 曾因第 106 行
> 两条语句被 tab 挤在同一行而 **Parse Error**，GUT 只报一行 "Warnings 1" 就跳过——**这 4 个用例从未真正执行**，
> 所以历史统计里出现过 257/1734、257/1729 等版本。R22 修复后首次生效（+15 断言）。
> **以后以你实测的数字为准**，别把本行的数字当硬契约。
headless 无孤儿节点、无 ObjectDB 泄漏；300 弹 × 80 敌的桌面渲染实测 **1.65 ms/帧（605 fps）**。

> **注意口径**：这句话**不等于"项目开发完成"**。§0.2 仍有 2 项收尾，且**都不是代码能解决的**：
> ① Android 真机未实测（本机无设备/SDK）；② macOS / Linux 未实机跑（只有 Windows 实机）。
> Web(WASM) 已在 R8 判定为**非必需**（见 §14）。R2 那次就是因为本文档自称"全完"才被人类抓出与代码不符，同一坑不踩第二次。

> **口径修正（R2）**：本表原先把「DoT / 异常 / 投射物池」记作 M8，与 §11 的 M8（性能架构）**重名冲突**。
> 现按 §11 口径拆分：功能层归 **M6.5**，M8 只指 §9 的性能架构。
> **R4**：M8 逻辑层全落地。**R5**：RNG 契约统一 + G8 统计用例。**R6**：内容全量 .tres 化。
> **R7**：注册表 / 条件系统 / SkillInstance / 装配缓存 / 脏标记 / 召唤物三规则 / CI / 导出预设 / 渲染压测。
> **R8**：`W1` 定性为"首批内容集"→ 补第 8 个主动 + 开放 `8` 键（槽 7 此前是死槽）；Web(WASM) 判定为非必需并关闭。

| 里程碑 | 状态 | 测试 |
|---|---|---|
| M0 环境/GUT/CI | ✅ **R7 补 CI** | 2 + GitHub Actions |
| M1 StatsComponent/修饰符管线 | ✅ **R7 加脏标记缓存** | 8 + 10（`test_stats_dirty_cache.gd`） |
| M2 DamageConversion/SkillData（.tres 驱动） | ✅ R6 全量内容真源化 | 9 + 8（`test_content_registry.gd`） |
| M3 SupportGem/SocketGraph 装配（G5–G7 + G7b） | ✅ **R7 补 G7b 到 M3 主测试 + 装配缓存** | 11 + 10（`test_m3_assembly_cache.gd`）+ 沙盒 14 |
| M4 DamagePacket/Calculator/命中与击杀 | ✅ R5 闭合 G8 | 16 + 7（`test_m4_g8_statistics.gd`） |
| M5 ResourcePool/冷却充能/技能栏（8 槽） | ✅ **R7 加 SkillInstance / R8 补 `8` 键** | 14 + 11（`test_m5_skill_instance.gd`） + 沙盒 14 |
| M6 行为组件（7 项）+ 召唤物管理 | ✅ **R7 补 §8.2 三规则 / R8 补第 8 个主动** | 13 + 10（`test_minion_registry.gd`） |
| **M6.5** DoT 全局 ticker / AILMENT 通道隔离 / ProjectilePool 硬上限 | ✅ | 7 |
| M7 TriggerManager/CombatEventBus（G10 限流、链深保护） | ✅ | 10 |
| **M8** 性能架构（SoA / 空间哈希 / effect_pool / RngService / MultiMesh） | ✅ **R7 补渲染压测与分配尖刺** | 46 + 渲染 bench |
| **扩展层** 属性注册表 / 标签注册表 / 条件门（§3.5 / §6） | ✅ **R7 新建** | 12（`test_registries.gd`）+ 10（`test_condition_spec.gd`） |

### 0.2 已知缺口（按优先级）

| # | 缺口 | 对应条款 | 现状 |
|---|---|---|---|
| 1 | ~~M8 性能层~~ | §9.1–§9.4、§11 M8 | ✅ R4 闭合 |
| 2 | ~~G8 统计用例缺失~~ | §12 G8、§11 M4 | ✅ R5 闭合（均值 114.70 / 暴击率 29.4% / DPS 误差 0.044%） |
| 3 | ~~SkillInstance 缺失~~ | §5.1、§5.3、§13.1 | ✅ **R7 闭合**：`skill_instance.gd`，一槽一实例、**不持槽数据副本**、冷却跟槽走 |
| 4 | ~~装配缓存~~ | §5.2 第 5 条 | ✅ **R7 闭合**：`assemble_cached`，key=(gem_id, level, 排序 support_ids, links)；命中返回深拷贝（防 source_id 污染） |
| 5 | ~~StatRegistry / TagRegistry~~ | §3.5、§10 util/ | ✅ **R7 闭合**：`util/stat_registry.gd`、`util/tag_registry.gd`，含整数型末端 floor 唯一收口 + 内容一致性校验 |
| 6 | ~~条件系统 `condition_spec.gd`~~ | §6 第 4 条、§10 data/ | ✅ **R7 机制闭合**：`data/condition_spec.gd` 7 种判定 + AND 语义 + `SkillInstance.condition_context()` 接入点。R9 术语裁定「水晶 = 辅助宝石」（D-14），具体效果不再等外部 v0.5 文档，而是随辅助宝石 `.tres` 走；**入口接线仍缺**，见 #12 |
| 7 | ~~内容 .tres 化~~ | §10、附录 C 第 1 条 | ✅ R6 闭合（17 个 .tres，答案 = 0） |
| 8 | **Android 真机 60fps 未实测** | §14 | 预设与 `Mobile` feature 已就位（R7）；本机无 Android SDK/设备，**真机帧率仍未验**。桌面侧见 §9.7 |
| 9 | ~~M8 渲染层未验~~ | §11 M8 | ✅ **R7 桌面侧闭合**：300 弹 × 80 敌端到端 **1.65 ms/帧（605 fps）**，见 §9.7。Android 侧并入 #8 |
| 10 | ~~M6 门禁口径不明（W1）~~ | §11 M6「W1 内容集 8 主动全部上线」 | ✅ **R8 闭合**：`W1` 在本文档与当时可见的外部设计文档中**均无任何定义**（该外部文档未入库，见来源清单 E-04，故此结论**不可复现**；按 R4 保留原判断不动），唯一同名词出现在姊妹项目的波次表里（E-05），是**并行波次编号**。据此按「第 1 批内容集 = 8 个主动」理解，R8 补第 8 个主动 `frost_nova`（霜爆新星，`bhv_aoe_burst`/cold），并开放 `8` 键，**8 槽 = 8 个不同主动全部可施放**。若将来投放该文档并发现 `W1` 另有定义，按本表新增一行修正，不要就地改写 |
| 11 | **macOS / Linux 未实机运行** | §14「Windows / macOS / Linux 主验收」 | 代码与 `.tres` 全平台共用，`export_presets.cfg` 已有 Linux 预设；但本机只有 Windows 实机跑过，macOS / Linux **未实机验收** |
| 12 | **辅助宝石条件门（口子 4）暂缓** | §6 第 4 条、§6.3 | **D-15 裁定暂缓**：`SupportGemData` 暂无 `conditions` 字段、`assemble()` 暂不吃上下文。机制（`ConditionSpec` 7 判定 + 10 用例）已就位、随时可通电；开启清单见 §6.3。**不是缺口，是预留位** |

**M3 结束门禁复核（R1 后）**：G5/G6/G7/G7b 全部有断言且通过；`assemble()` 无 `if gem_id ==` 分支。

---

## 1. 技术路线裁定

### 1.1 采用：二为骨、一为镜

| 层 | 来源 | 用法 | 硬边界 |
|---|---|---|---|
| **语义层（怎么算对）** | `PathOfBuildingCommunity/PathOfBuilding` 的 `src/Modules/Calc*.lua`、`src/Data/Skills/sup_*.lua` | 校对算子的**顺序、作用域、边界**（转换上限、多源合并、inc/more 分桶、触发限流） | **不移植 Lua 代码**。仅用作"标准答案"比对；`CalcOffence.lua` 单文件 6263 行，移植＝重写 |
| **实现层（怎么跑起来）** | `ClarkWain/godot-arpg-kit`（MIT，Godot 4.5+，9189 行，38 个测试脚本） | 抄**结构**：`RefCounted` 纯函数管线、事件总线 autoload、`StatModifier` 数据形态、测试组织与 CI | 只抄结构，**不抄它的 CombatComponent 双管线**（见 §13.3） |
| **自研层（护城河）** | 本项目 | 插槽图 `SocketGraph`、辅助宝石条件门、局内武器栏多槽、投射物 DOD、空间哈希、确定性 RNG | 任何人不得用现成库替代 |
| **架构参考（只看不抄）** | Unreal GAS 系（`gamesmiths-guild/forge-godot` 等） | 只借鉴 "Attribute / Effect / Tag / Cue" 的**职责切分** | 不引入其运行时、不引入其节点结构 |

> **R18 措辞澄清（2026-10-21，核验后）**：上表四层里，**只有"自研层"是真实存在的代码**。核验结论（`docs/_重要资料记录/AI资料源/架构溯源/技术框架核验_PoB与arpg-kit_v1.md`）：
> - `godot-arpg-kit` 在本仓库 **零痕迹**——`grep -rin "arpg_kit|ClarkWain"` 0 命中、`addons/` 只有 `godot_ai` + `gut`、`project.godot` 无其 `CombatEventBus` autoload；
> - `PathOfBuilding` **代码 0 命中**，只在附录 A 的读取清单与本表里出现；
> - **第三方运行时依赖 = 0**，业务代码 48 文件 / 3228 行全自研。
>
> 所以「实现层 = kit」的准确含义是**借形态**（`RefCounted` 纯函数 37/48 个类、`StatModifier` 结构、事件总线），**不是"引入了 kit"**。
> **任何人不得据此去 clone / vendored kit、也不得声称"已按 kit 实现"**（图谱 V-06）。同理，「语义层 = PoB」是**校对标准**，不是移植：PoB 是 Lua，进不了 GDScript。

### 1.2 为什么不整仓复用 `the-exile-engine-v2`

已实测：该仓库 241 个 `.gd`、1340 个 `.json`，但**没有 `project.godot`**（Godot 打不开）、**没有 LICENSE 文件**（默认保留所有权利）、末次提交 2026-04-11、`src/skills/` 的辅助石兼容性靠 `stat_name.contains("area")` 字符串分支判定。

**结论**：只允许读三处**思想**，零代码复制——`core/deterministic_rng.gd`（种子回放）、`tests/core/test_spatial_partition.gd`（空间分区）、`skills/gem_socket_system.gd` 中 `_links: Array[bool]` 的连通表达方式。

---

## 2. 开工前必读（三份来源，附精确读取清单）

> 你的上下文预算有限，**不要通读整个仓库**。按下表逐条读取，读完即停。

| 顺序 | 目标 | 精确路径 | 读什么 | 目标产出 |
|---|---|---|---|---|
| 1 | PoB 结算语义 | `src/Modules/CalcActiveSkill.lua`（934 行） | 技能如何被"注册"进计算、多 part 伤害如何拆分 | 列出 part 的数据结构 |
| 2 | PoB 算子顺序 | `src/Modules/CalcOffence.lua`（6263 行，**只读转换与 inc/more 段**） | 转换在 inc 之前还是之后、多源转换如何归一化 | 写出 §4.3 的顺序表并逐条对照 |
| 3 | PoB 辅助石判定 | `src/Data/Skills/sup_int.lua`（7007 行，**只看 3 个字段**） | `requireSkillTypes` / `addSkillTypes` / `excludeSkillTypes` 的语义 | 落到 §3.3 的三元组 |
| 4 | PoB 触发限流 | `src/Modules/CalcTriggers.lua`（1627 行） | 同事件多触发、chance 与 cooldown 如何共同限流 | 落到 §7.2 公式 |
| 5 | kit 管线形态 | `scripts/stats/stats_component.gd`、`scripts/stats/stat_modifier.gd` | 属性容器如何持有 modifier 列表、如何按来源移除 | 抄接口签名，不抄实现细节 |
| 6 | kit 纯函数伤害 | `scripts/combat/damage_calculator.gd`、`scripts/combat/damage_info.gd` | 为什么用 `RefCounted` 静态类、`DamageInfo` 字段 | 抄这个模式 |
| 7 | kit 事件总线 | `scripts/combat/combat_event_bus.gd`（autoload） | 信号命名与订阅时机 | 抄 |
| 8 | kit 测试组织 | `tests/`（38 个 `.gd`）、`.github/workflows/tests.yml` | headless 跑测的退出码陷阱、`seed(0)` 治理 flake | 抄 CI 配置与 flake 治理手法 |

**校验点**：读完第 4 条后，你应当能回答——"事件率 5 次/秒、概率 30%、自身 CD 0.5 秒，实际触发频率是多少？"答案见 §7.2，若答不出说明没读懂，回去重读。

---

## 3. 数据契约（六张表，字段级）

> 所有表用 `.tres`（`Resource`）实现；**禁止**用字典散装传参。所有字符串键用 `StringName`（`&"xxx"`），并集中注册在 `stat_registry.gd` / `tag_registry.gd` 中，禁止裸字符串散落各文件。

### 3.1 SkillData（主动技能）

```gdscript
class_name SkillData extends Resource

@export var gem_id: StringName                  # &"frost_shard"，全局唯一
@export var display_name: String
@export var icon: Texture2D
@export var parts: Array[SkillPart]             # 至少 1 个；多段伤害=多 part
@export var tags: Array[StringName]             # 决定辅助石兼容性 & 词缀作用域
@export var cast_mode: CastMode                 # ACTIVE / TRIGGER_ONLY
@export var base_cast_time: float = 0.5
@export var cost_type: CostType                 # MANA / LIFE / ENERGY_SHIELD / NONE
@export var base_cost: float = 10.0
@export var base_cooldown: float = 0.0
@export var max_charges: int = 0                # >0 时冷却改为充能回复
@export var charge_recharge_time: float = 0.0
@export var level_scaling: GemLevelScaling
@export var allowed_support_tags: Array[StringName] = []   # 空=接受全部
```

```gdscript
class_name SkillPart extends Resource
@export var damage_channel: Channel             # HIT / DOT / AILMENT（见 §4.1）
@export var base_damage: Dictionary             # {&"physical": 100.0, &"cold": 20.0}
@export var damage_effectiveness: float = 1.0   # 附加伤害的缩放系数
@export var behavior_id: StringName             # 指向 bhv_*.gd
@export var behavior_params: Dictionary         # 见 §3.6
```

**必须**：`damage_channel` 与 `tags` 是两个**正交维度**。原规格用"分系（melee/projectile/area/dot）"一个维度表达，会导致"近战投射物技能吃哪一系词缀"无解——这是必须修正的设计缺陷，详见 §4.1。

**`GemLevelScaling`（等级曲线，R12 扩展为两段式）**：

| 字段 | 默认 | 语义 |
|---|---|---|
| `per_level` | `0.0` | 每级成长率（0.1 = 每级 +10% 基础值）；分段模式下**只作用于 1..`knee_level`** |
| `knee_level` | `0` | 拐点等级。**`0` = 不分段**（纯线性，旧内容逐位不变）；`N` = 第 N 级之后换用后期成长率 |
| `per_level_late` | `0.0` | 拐点之后的每级成长率。**`0` 是合法设计**（平台期），不表示"未设置"——是否分段只看 `knee_level` |

```
knee_level <= 0 :  factor(L) = 1 + per_level × (L − 1)
knee_level >= 1 :  factor(L) = 1 + per_level × (min(L, knee) − 1) + per_level_late × max(L − knee, 0)
```

`L <= 0` 一律按 1 级处理（不得出现负成长）。**不引入 `Curve`**：`.tres` 里的 Curve 是点数组，手改不可能、批量生成难、单调性与终值无法解析断言（理由见 D-17）。断言见 `tests/skills/test_gem_level_scaling.gd`（9 用例）。

### 3.2 ModifierSpec（修饰符规格）

```gdscript
class_name ModifierSpec extends Resource
@export var stat: StringName                   # &"projectile_damage"
@export var op: Op                             # FLAT_ADD / INCREASED / MORE
@export var value: float
@export var channel_mask: int = Channel.ALL    # 位掩码：HIT|DOT|AILMENT
@export var require_tags: Array[StringName]    # 全部命中才生效（AND）
@export var exclude_tags: Array[StringName]    # 命中任一即失效
@export var conditions: Array[ConditionSpec]   # 可选：生命低于 35% 等
```

运行时实例：

```gdscript
class_name Modifier extends RefCounted
var stat: StringName
var op: int
var value: float
var source_id: StringName                      # 必填！&"gem:frost_shard" / &"support:multishot"
var channel_mask: int
var require_tags: Array[StringName]
var exclude_tags: Array[StringName]
```

**必须**：`source_id` 不可为空。卸下辅助石/装备时按 `source_id` 精确批量移除，这是"卸下即还原"的唯一实现方式。

### 3.3 SupportGemData（辅助石）—— 三元组是核心

```gdscript
class_name SupportGemData extends Resource
@export var support_id: StringName
@export var display_name: String
@export var require_tags: Array[StringName]    # 必须全部具备
@export var add_tags: Array[StringName]        # 给技能追加标签（会影响后续辅助的兼容判定）
@export var exclude_tags: Array[StringName]    # 命中任一即不兼容
@export var cost_multiplier: float = 1.0
@export var stat_modifiers: Array[ModifierSpec]
@export var behavior_overrides: Dictionary     # {&"projectile_count": {"add": 2}}
@export var flags: Array[StringName]           # &"cannot_crit" / &"cost_life" ...
@export var conflicts_with: Array[StringName]  # 独占组
```

**装配规则（必须按此顺序，不可交换）**：

```
0. 【镶嵌前置校验 · 2026-10-19 R1】socket_check(slot, support)：
   把待镶嵌辅助加入后整组是否仍合法（含孔位上限）；不合法则拒绝镶嵌，不进槽位
   —— 对齐 PoE 2：非法组合在"放入那一刻"就被拦住，运行时永不出现不兼容状态
1. 从 SkillData.allowed_support_tags 与 support.require_tags / exclude_tags 求交集 → 判定兼容
2. 先把所有已装配辅助的 add_tags 追加到"有效标签集"（多轮判定，直到收敛）
   —— 即：靠前的辅助可以"打开"靠后辅助的兼容性
3. 逐个辅助注入 stat_modifiers（source_id = support_id）
4. 按声明顺序应用 behavior_overrides：加法类先合并，乘法类后合并
5. cost = base_cost × Π(cost_multiplier) × skill_cost_multiplier
6. 检查 conflicts_with：命中两件即装配失败，回滚全部注入
```

**双语义（缺一不可，不要互相取代）**：

| 层 | 函数 | 语义 | 对齐 |
|---|---|---|---|
| 准入层（UI/镶嵌动作） | `SocketGraph.socket_check()` | 非法组合**不能放进去**（返回 `ERR_INCOMPATIBLE_SUPPORT` / `ERR_CONFLICT` / `ERR_NO_SOCKET`） | PoE 2 |
| 校验层（装配函数） | `SocketGraph.assemble()` | 对已存在的配置 fail-fast：**装配失败 + 明确错误码，不得静默忽略** | 本规格 G7 |

即：G7 保留为"数据错误兜底"（编辑器/测试/存档校验），正常游玩路径由准入层保证永不触发。
**禁止**：把二者简化成"逐颗跳过不兼容辅助继续算"（那是 PoE 1 / PoB 的语义，本作不采用）。

**禁止**：把兼容判定写成字符串包含判断（`stat_name.contains("area")`）。标签是精确匹配的 `StringName`。

### 3.4 TriggerData（触发器）

```gdscript
class_name TriggerData extends Resource
@export var event: StringName      # &"on_hit" &"on_crit" &"on_kill"
                                   # &"on_take_damage" &"on_block" &"on_cooldown_end" &"on_interval"
@export var chance: float = 1.0
@export var cooldown: float = 0.0
@export var interval: float = 0.0  # 仅 on_interval 使用
@export var linked_slot_index: int
```

### 3.5 StatDef（属性注册表）

```gdscript
# stat_registry.gd（autoload 或静态类）
const DEFS := {
    &"projectile_damage": {"default": 1.0, "aggregate": "multiplicative_base"},
    &"projectile_count":  {"default": 1.0, "aggregate": "flat_then_round"},
    &"cast_speed":        {"default": 1.0, "aggregate": "multiplicative_base"},
    &"area_size":         {"default": 1.0, "aggregate": "multiplicative_base"},
}
```

**必须**：整数型属性（`projectile_count`、`chain_count`、`fork_count`、`pierce`）在管线末端统一 `floor` 一次，中途不得取整。否则 `+2` 与 `×1.5` 的先后会改变结果。

### 3.6 BehaviorConfig（行为参数）

```gdscript
# bhv_projectile 的 params 规范
{
  &"count_base": 1, &"speed": 900.0, &"radius": 12.0,
  &"pierce_base": 0, &"fork_base": 0, &"chain_base": 0,
  &"lifetime": 1.2, &"spread_deg": 0.0       # spread=0 时单发；>0 时按扇形均分
}
```

---

## 4. 属性与结算管线（本系统的宪法）

### 4.1 双维度作用域（对原规格的必要修正）

原规格把 `melee / projectile / area / dot` 并列为"分系"。问题是这四者不同类：前三个是**技能形态标签**，`dot` 是**伤害通道**。一个"近战投射物"技能应同时吃 melee 与 projectile 词缀，而"点燃伤害"只吃 dot/ailment 通道的词缀。

**必须改为**：

```gdscript
enum Channel { HIT = 1, DOT = 2, AILMENT = 4, ALL = 7 }
```

- `Channel.HIT`：直接命中伤害（默认）
- `Channel.DOT`：持续伤害（引导 tick、地面效果）
- `Channel.AILMENT`：异常状态伤害（点燃/中毒/流血）
- 技能形态仍放在 `tags`：`&"melee" &"projectile" &"area" &"spell" &"attack" &"minion" &"channel" &"movement" &"buff"`

**判定公式**：

```
modifier 生效 ⟺ (mod.channel_mask & ctx.channel) != 0
              ∧ mod.require_tags ⊆ ctx.tags
              ∧ mod.exclude_tags ∩ ctx.tags == ∅
```

### 4.2 计算顺序（七步，严格固定）

```
① 取基础值      base = part.base_damage × Σ(level_scaling)
② 加平值        v = base + Σ(FLAT_ADD)          ← 仅同 stat、同通道、同标签集
③ 伤害转换      见 §4.3（仅对伤害类 stat）
④ 加算百分比    v = v × (1 + Σ(INCREASED)/100)
⑤ 乘算百分比    v = v × Π(1 + MORE_i/100)
⑥ 暴击          if roll < crit_chance: v = v × crit_multi
⑦ 目标侧减免    闪避判定 → 护甲/抗性 → 护盾吸收 → 扣血
```

**必须**：④ 与 ⑤ 之间不得插入任何逻辑。所有"特殊效果"（连锁、穿透、分裂）属于**行为层**，不属于数值层。

**必须**：`FLAT_ADD` 阶段的附加伤害要乘 `damage_effectiveness`；`INCREASED/MORE` 阶段不再乘。

### 4.3 伤害转换规则（最容易做错的地方）

```
- 转换发生在 ② 之后、④ 之前
- 同一次结算内，多源转换对同一源类型**相加**，总和超过 100% 时按比例归一化
  例：60% 物理→火 + 60% 物理→冰  ⇒  各 50%，物理残留 0%
- 转换后的伤害按**新类型**参与 ④⑤（即吃火焰/冰霜词缀，不吃物理词缀）
- 转换后的伤害**不再二次转换**（禁止链式递归）
- 上限：每个源类型转出总量 ≤ 100%，不足部分保留原类型
```

**验收样例**：base 100 物理 + FLAT 20 物理，50% 物理→火，物理 inc +20%，火焰 inc +40%。
手算：`(100+20) = 120` → 火 60 / 物理 60 → 物理 72 / 火焰 84 → **合计 156**。

### 4.4 快照语义

出手瞬间生成不可变快照：

```gdscript
class_name DamagePacket extends RefCounted
var elements: Dictionary          # {&"physical": 72.0, &"fire": 84.0}
var crit: bool
var crit_multi: float
var channel: int
var tags: Array[StringName]
var source_instance_id: StringName
var rng_tick: int                 # 用于回放
```

**必须**：DoT 与召唤物的伤害使用**出手时的 stats 快照**，不随后续换装/增益变化。理由：否则"脱装备刷新 DoT"会变成可无限叠加的漏洞。

---

## 5. 插槽与装配（自研，无参考实现可抄）

### 5.1 数据结构

```gdscript
class_name SkillSlot extends Resource
@export var slot_index: int
@export var active_gem: SkillData
@export var active_level: int = 1
@export var active_quality: int = 0
@export var supports: Array[SupportGemData] = []
@export var socket_count: int = 4          # 首版 4~6
@export var links: Array[int] = []         # 连通关系：link[i]=j 表示第 i 孔与第 j 孔相连
```

### 5.2 SocketGraph（连通分量）

```
assemble(slot) -> AssemblyResult:
  1. 用并查集对 links 求连通分量，得到 groups: Array[Array[int]]
  2. 每个 group 内：找出唯一的主动宝石（0 个=空组；≥2 个=非法，报错）
  3. 该组的辅助石只作用于同组的主动宝石（首版可先做"全部孔单组"，但算法必须按连通分量写，
     以便后续开启链式约束时无需重构）
  4. 输出 AssemblyResult { modifiers[], behavior_overrides{}, effective_tags, cost_multiplier }
  5. 缓存结果，key = (gem_id, level, support_ids 排序后哈希)；装配是纯函数

socket_check(slot, support) -> AssemblyResult   # 【2026-10-19 R1】镶嵌准入（PoE2 语义）
  1. slot 无主动宝石 → ERR_NO_ACTIVE_GEM
  2. slot.supports.size() >= slot.socket_count → ERR_NO_SOCKET
  3. clone_slot(slot) + append(support) → assemble() 的结果原样返回
can_socket(slot, support) -> bool                # socket_check(...).ok 的快捷方式
```

**必须**：装配结果**只包含数据**，不持有 Node 引用。这样"换辅助 = 重算 + 重挂 modifier"，无需销毁重建实例。

### 5.3 局内武器栏多槽

- 技能栏 1~8 键，每键绑定一个 `SkillSlot`
- **同一时刻只有一个 `SkillInstance`** 由该 `SkillSlot` 派生（切换武器栏时重建实例，但 `SkillSlot` 数据不变）
- 武器绑定"初始主动技能"，无普攻（以项目设计为准，本规格只提供能力，不定义规则）

---

## 6. 辅助宝石的作用口子（原「水晶」已并入辅助宝石，见 D-14）

> **术语裁定（2026-10-20 / R9 / D-14）**：**水晶 = 辅助宝石**，项目内不再有「水晶」这个独立概念，一律称**辅助宝石**。
> 原 §6 禁令「禁止把水晶逻辑写进 `SupportGemData`（会破坏两种来源的正交性）」**作废** ——
> 该禁令的立法前提是「水晶与辅助石是两种正交来源」，前提既已不存在，禁令自动失效。
> 反过来说：**辅助宝石的全部数据形态就定义在 `SupportGemData` 里，这是唯一真源。**

辅助宝石对目标技能的作用，只允许走以下四个口子（不允许第五种）：

1. **修饰符源**：`stat_modifiers`（`ModifierSpec`），装配时 `source_id = support_id`，整颗卸下即整批撤销
2. **标签源**：`add_tags` / `require_tags` / `exclude_tags`，多轮收敛改变该技能可接受的辅助集合
3. **行为改写源**：`behavior_overrides`
4. **条件门**：`conditions`（`Array[ConditionSpec]`，AND 语义；上下文由 `SkillInstance.condition_context()` 提供）—— 表达「仅对初始技能生效」「仅对稀有技能生效」这类筛选

**禁止**：把辅助宝石的效果写进 `bhv_*` 行为组件（会污染演出层：行为组件只读 `SkillContext` 的最终数值，不认识任何宝石 id）。

### 6.1 裁定：辅助宝石**不得**替换 `SkillData` 引用本身

（原「待人类确认」项，R9 裁定为**否**。）

| # | 理由 |
|---|---|
| 1 | **定义自指**：辅助宝石存在的意义是「修饰某颗主动技能」。若它把主动技能换掉，就消灭了自己的作用对象——「这颗辅助在辅助谁」无解 |
| 2 | **同类需求已有出口**：PoE 中「技能看起来变了」的辅助（法术图腾 / 地雷 / 陷阱 / 法术回响）从不换 `SkillData`，改的是**施法主体与传递方式**，正是 `behavior_overrides` + `bhv_*` 能表达的东西。要「变形」就加一个 override 键或一个行为组件 |
| 3 | **换引用会连带炸四处**：① 冷却——`CooldownComponent.configure()` 在 `bind()` 时按原 gem 配死（`skill_instance.gd:42`）；② 兼容性——`assemble()` 遇不兼容是整组失败（G7）；③ 真源污染——写回 `SkillSlot.active_gem` 后卸下无法还原（撞 §13.1 第 5 条）；④ 存档与 HUD 都要多一层「被覆盖」状态 |
| 4 | **可测试性**：不换引用时，`cast()` 对 `SkillData` 的纯函数性可由 `test_cast_is_pure_over_skill_resource` 直接守住；一旦允许换引用，这条守卫失效 |

**若将来确有「技能变身」玩法**（例如某件装备把火球永久改成冰矛）：那是**独立于辅助宝石的第三个系统**（装备 / 天赋 / 变身道具），在装备层换 `SkillSlot.active_gem`，不塞进辅助宝石。辅助宝石永远只做修饰。

### 6.2 现状：口子 1/2/3 可用，口子 4 暂缓

口子 1 / 2 / 3 的字段 `SupportGemData` 全都有（`stat_modifiers` / `add_tags` / `behavior_overrides`），**首批内容直接可用，零改动**。

**口子 4（`conditions`）裁定为「暂缓实现」**（D-15）：`SupportGemData` 暂不加 `conditions` 字段，`ConditionSpec` 与 `SocketGraph.assemble()` 暂不接线。

理由：首批正式内容里没有任何一颗辅助宝石需要「仅对初始技能生效 / 仅对稀有技能生效」这种筛选。为一个没有内容会用的字段付装配签名 + 缓存 key 改造的代价，是纯度很高的浪费。**机制已经就位（`condition_spec.gd` 7 种判定 + 10 条测试），随时可开，且开着不花运行时代价。**

> **给后续 AI 的硬口径**：不要因为「架构上看起来缺一块」就自行把 `conditions` 接上。`ConditionSpec` 是**已建成但未通电**的口子，通电的触发条件是「有内容真的需要它」，不是「代码不够对称」。

### 6.3 口子 4 的开启清单（真有需求时照着做，别现场发挥）

按顺序做完这 4 步，再谈内容：

1. `SupportGemData` 加字段：`@export var conditions: Array[ConditionSpec] = []`
2. `SocketGraph.assemble(slot, ctx := {})` 加可选上下文参数（**默认 `{}` = 全部视为不满足以外的情况**，保持现有 243 个用例不受影响）；在注入 `stat_modifiers` / `add_tags` / `behavior_overrides` 前，对每颗辅助宝石过一遍 `ConditionSpec.all_match(gem.conditions, ctx)`
3. **`cache_key` 必须同步扩**：`is_rare` / `is_initial` / `slot_index` 会改变装配结果，不进 key 就会「同一槽位在不同上下文命中同一份缓存」。这是 D-07 的同类陷阱，只是从 `source_id` 换成了上下文
4. 补 3 条测试：条件不满足时修饰符不注入 / 条件满足时逐位还原 / 同一槽位两种上下文不串缓存

**注意语义边界**：条件门只决定「这颗辅助宝石生不生效」，**不决定「整组失败还是成功」**。不生效 ≠ 不兼容——前者是玩家主动配置的结果（安静地不生效，UI 标 `○`），后者是数据错误（G7 报错）。把两者混在一起，玩家会看到「我明知道它不生效，系统却报错」。

---

## 7. 触发系统

### 7.1 结构

```
CombatEventBus（autoload，单一实例）
  ├─ signal hit_landed(packet, target)
  ├─ signal crit_landed(packet, target)
  ├─ signal entity_killed(victim, killer)
  ├─ signal damage_taken(entity, packet)
  ├─ signal block_occurred(entity, packet)
  └─ signal skill_cooldown_finished(instance)

TriggerManager（每角色一个）
  ├─ 订阅上述信号
  ├─ 按 event 索引 TriggerData
  └─ 命中条件后调用 instance.trigger_cast()（绕过输入，仍走消耗与自身 CD）
```

### 7.2 限流公式（必须实现，且必须可测）

```
effective_rate = min( 1.0 / cooldown , event_rate × chance )     # cooldown>0
effective_rate = event_rate × chance                             # cooldown==0
```

**验收样例**：事件率 5 次/秒、`chance = 0.3`、`cooldown = 0.5s`
→ `min(2.0, 1.5) = 1.5 次/秒`。跑 100 秒，触发次数应落在 `150 ± 15`（±10%）。

### 7.3 调度

- `on_interval` 用**一个全局最小堆 ticker** 统一调度，**禁止**每个触发器一个 `Timer` 节点
- 同一事件多个触发器**各自独立**计时，互不阻塞
- 触发链深度上限 = 3（A 触发 B 触发 C，C 触发 A 则丢弃），防止无限递归

---

## 8. 伤害、异常、召唤、资源

### 8.1 异常状态（必须与命中分离）

| 异常 | 触发条件 | 伤害通道 | 关键规则 |
|---|---|---|---|
| 点燃 | 火焰暴击命中 | `AILMENT` | 基础伤害取**点燃瞬间**的火伤快照，不吃后续增益 |
| 冰缓 | 冰霜命中 | 无（Debuff） | 降低移动/攻速，有叠加上限 |
| 冰冻 | 冰缓累积达阈值 | 无（控制） | 定身；有最短时间保护（防无限控） |
| 感电 | 闪电命中 | 无（Debuff） | 目标承伤 +X%，X 由伤害量决定 |
| 中毒 | 混沌/物理命中 | `AILMENT` | 可叠层，每层独立计时 |
| 流血 | 物理命中 | `AILMENT` | 移动时伤害更高（可选） |

**必须**：异常伤害走 `AILMENT` 通道，因此**不吃**"hit damage increased"，只吃"dot / ailment damage"。这条错了会让数值整体偏高 30% 以上。

**必须**：DoT 用**一个全局 ticker**（0.1s 或 0.25s 网格），每个效果记录 `next_tick_at`；**禁止**每个 DoT 一个 `Timer`。

### 8.2 召唤物

- 召唤物继承施法者的**指定子集**（`minion_damage`、`minion_attack_speed`、`minion_life`），不继承全部 stats
- 召唤物技能复用 `bhv_projectile` 等行为组件，**不新写一套**
- `max_count` 上限到达时，新召唤顶掉最旧的

### 8.3 资源与充能

```
可用资源 = max_stat − Σ(reserved)
cost    = base_cost × Π(support.cost_multiplier) × skill_cost_multiplier
冷却     = base_cooldown / cooldown_recovery
充能型   = max_charges > 0 时，冷却改为每 charge_recharge_time 秒回复 1 层
```

**必须**：资源不足时 `can_cast()` 返回 false，且**不得**进入 cast（禁止"扣成负数再回滚"）。

---

## 9. 性能架构（100 弹 / 80 特效 / 80 角色）

### 9.1 三档红线

| 类别 | 上限 | 实现方式 | 禁止 |
|---|---|---|---|
| 投射物 | 100 发/秒（同屏可达 300+） | **SoA 数组**（位置/速度/寿命/伤害包分数组）+ `MultiMeshInstance2D` 一次绘制 | 每发一个 `Area2D` 节点 |
| 特效 | 80 个并发 | `GPUParticles2D` 池化，复用 `emitting` 开关 | 每次 `instantiate` |
| 角色 | 80 个 | 常规 `CharacterBody2D`，但 AI 与属性更新分帧 | 每帧全量重算 stats |

### 9.2 碰撞（关键决策）

投射物不要用 `Area2D` 的物理引擎。改为：

```
每帧：
  1. 清空空间哈希网格（均匀网格，cell = 2 × 最大投射物半径）
  2. 把所有敌人插入网格（O(n)）
  3. 遍历投弹，仅查询其覆盖的 3×3 格（O(m × k)，k 很小）
  4. 圆形近似判定（距离平方比较，不开方）
```

预期：300 投弹 × 80 敌人，朴素 O(n·m) = 24000 次/帧；哈希后 < 2000 次/帧。

### 9.3 对象池

```gdscript
class_name ProjectilePool
func acquire() -> ProjectileSlot      # 池空且达上限时，回收最旧的（不是新建）
func release(slot: ProjectileSlot) -> void
```

**必须**：池有硬上限（建议投射物 512、特效 128），达上限时回收最旧而非扩容。理由：宁可掉视觉，不可掉帧。

### 9.4 确定性随机

```gdscript
class_name RngService
# 分流：damage / loot / spawn / cosmetic
# 同一 seed + 同一输入序列 ⇒ 同一结果（支持回放与复现 BUG）
func roll(stream: StringName, tick: int, salt: int) -> float   # 无状态：调用方自带 tick/salt
func next_float(stream: StringName) -> float                   # 游标：每条流各自计数，热路径用
func next_chance(stream: StringName, probability: float) -> bool
func reset_cursors() -> void                                   # 回放：从头重演
```

**必须**：战斗结果相关的 roll 不得与表现层（粒子随机）共用流，否则改动特效会改变战斗结果。

**R5 补充：两种取数方式各管一段**

| 方式 | 用在哪 | 为什么 |
|---|---|---|
| `roll(stream, tick, salt)` | 有明确 tick 的离散事件（战利品结算、刷怪） | 无状态，同一 (tick, salt) 永远同值，天然可重入 |
| `next_float(stream)` | 命中暴击这类没有天然 tick 的热路径 | 每条流一个游标，第 n 次取值恒等于 `roll(stream, n, 0)` |

**关键性质**：游标**按流独立**。表现层狂吃 5000 次 `cosmetic`，`damage` 流第 n 个值纹丝不动 —— 这才是
"改特效不改变战斗结果"的真正保证，已由 `test_g8c_cosmetic_stream_does_not_shift_damage_sequence` 断言。

**接入点（R5 实测）**：`DamageCalculator.resolve` 的 rng 契约统一为 `next_float(stream)`，
暴击只消费 `STREAM_DAMAGE`；沙盒（`sandbox_main.gd`）与压测脚本均已从 `RandomNumberGenerator` 切换。
测试假体 `_FakeRng` 也实现同一方法，**不允许出现第二套 RNG 契约**。

### 9.5 实测数据（R4，Godot 4.7.1 headless，纯逻辑层）

跑法：`godot --headless --path . -s res://mods/jes-skills/tests/perf/bench_projectiles.gd`

| 项 | 结果 | 判据 |
|---|---|---|
| 稳态 300 弹 × 80 敌，`ProjectileField.tick` | **0.439 ms/帧** | 同屏 300 发 < 4ms |
| 网格重建（80 敌 insert） | 0.062 ms/帧 | — |
| 逻辑层合计 | **0.501 ms/帧（16.6ms 预算的 3.0%）** | 达标 |
| 每帧候选判定数 | **7 个**（暴力全扫为 24000） | §9.2 预期 < 2000 |
| 暴力路径对照 | 23–25 ms/帧 | — |
| 加速比 | **52–56×**（多次运行波动，取两次实测 56.3× / 52.3×） | — |

说明：
- 上表**不含渲染**（headless 无渲染器）。渲染侧是 1 个 `MultiMeshInstance2D` = 1 次 draw call，与弹数无关；
  每帧成本只有 `visible_instance_count` 内的 `set_instance_transform_2d`（300 次结构写入）。
- 候选数 7 而不是几百：敌人撒在 1600×1200，弹丸半径 8 + 目标半径 20 = 28 的查询半径，格子 64 时通常只覆盖 1 格。
- 表中 300 弹是「同屏并发」，折算发射速率远超 §9.1 的 100 发/秒。

### 9.6 对象池实测（R4）

| 池 | 硬上限 | 满时策略 | 测试 |
|---|---|---|---|
| `ProjectileField`（内含 `ProjectilePool`） | 512 | 回收 seq 最小的活跃槽位 | `test_m8_projectile_field` pf12 |
| `EffectPool`（GPUParticles2D） | 128 | 回收最旧的活跃槽位，`emitting` 开关复用 | `test_m8_effect_pool` ef5/ef6/ef7 |

**必须**：两个池都**永不扩容**。节点数/槽位数在测试里被断言恒等于 cap（ef7：连发 20 次，子节点仍为 4）。

---

### 9.7 渲染层与整帧实测（R7，桌面 GPU）

§11 M8 的门禁原文是「100 弹并发**同屏** ≥ 60fps（目标机型）」，这必须含渲染，不能只报逻辑层。
本节补的就是渲染侧证据。

**跑法**（不能加 `--headless`，dummy 渲染器不画像素）：

```bash
godot --path . --rendering-driver opengl3 -s res://mods/jes-skills/tests/perf/bench_render.gd
```

| 项 | 数值 |
|---|---|
| 场景 | 300 弹 × 80 敌，240 帧（60 帧预热） |
| 绘制方式 | 单个 `MultiMeshInstance2D`，**1 次 draw call**（与沙盒同一套实现，非另写简化版） |
| 端到端帧间隔 | 均值 **1.65 ms** / p99 1.85 ms / max 2.00 ms |
| 其中逻辑 | 1.22 ms（refill + tick + 网格重建 + sync） |
| 渲染 + 呈现 | 0.43 ms |
| 等效帧率 | **605 fps** |
| 16.6 ms 预算占用 | **10.0%** |
| 环境 | Godot 4.7.1 / OpenGL 3.3 Compatibility / NVIDIA CMP 40HX / Windows |

**结论**：渲染层不是瓶颈，且成本与弹数**基本无关**（1 次 draw call）；
剩余开销集中在 GDScript 侧逐实例写 MultiMesh（`set_instance_transform_2d` × 300/帧）。

**一次真实的误判（值得记下来）**：首轮测量读到 44 fps，差点被判成"渲染不达标"。
实际原因是压测脚本给 `tick()` 传了 `grid = null`，退化成 O(m×n) 暴力全扫 —— 逻辑层占了 23.2 ms。
加回空间哈希后立刻降到 1.65 ms。**教训：整帧变慢时先看逻辑分项，别急着怪渲染。**

**局限（不要当成已达标）**：
- 桌面 GPU ≠ Android 目标机型，真机帧率仍未测（§0.2 #8）
- 未含 UI、后处理、粒子特效的叠加开销
- 未在低端集显上验证

---

## 10. 最终目录结构

```
res://
├── systems/skills/
│   ├── skill_instance.gd
│   ├── skill_executor.gd
│   ├── socket_graph.gd               # 自研
│   ├── assembly.gd                   # 装配纯函数
│   ├── behavior/
│   │   ├── bhv_projectile.gd
│   │   ├── bhv_melee_swing.gd
│   │   ├── bhv_aoe_burst.gd
│   │   ├── bhv_channel.gd
│   │   ├── bhv_summon.gd
│   │   ├── bhv_dash.gd
│   │   └── bhv_buff_self.gd
│   ├── data/
│   │   ├── skill_data.gd  skill_part.gd  support_gem_data.gd
│   │   ├── trigger_data.gd  modifier_spec.gd  condition_spec.gd
│   │   ├── gem_level_scaling.gd
│   │   └── gem_registry.gd          # R6：扫描 content/ 加载全部 .tres（唯一内容入口）
│   ├── summon/
│   │   └── minion_registry.gd        # R7：§8.2 召唤物三规则（白名单继承/复用出招/上限顶替）
│   ├── combat/
│   │   ├── stats_component.gd        # 只做"存 + 按来源移除"，不做业务
│   │   ├── modifier.gd
│   │   ├── damage_pipeline.gd        # 纯函数，七步管线
│   │   ├── damage_packet.gd
│   │   ├── hitbox_component.gd  hurtbox_component.gd
│   │   └── status_effect_manager.gd
│   ├── pools/  projectile_pool.gd  effect_pool.gd
│   └── util/   rng_service.gd  stat_registry.gd  tag_registry.gd
├── systems/perf/  spatial_hash.gd  dot_ticker.gd
├── content/gems/  active/  supports/  triggers/       # 全是 .tres
└── tests/skills/                                       # GUT 或自写 assert
```

**实际结构偏差（R6 核实，功能不受影响，仅文档与磁盘不一致）**：

- `pools/` 目录不存在：`projectile_pool.gd` 在 `systems/skills/combat/`、`effect_pool.gd` 在 `systems/perf/`
- `assembly.gd` 不存在：`assemble()` 作为静态方法写在 `socket_graph.gd` 内
- `status_effect_manager.gd` 实际名为 `combat/ailment_component.gd`
- `dot_ticker.gd` 实际在 `systems/skills/combat/`，不在 `systems/perf/`
- `stats_component.gd` / `stat_modifier.gd` 在 `systems/skills/` 顶层，不在 `combat/` 子目录

**R7 追加核实**（扫描 `find systems tests -name "*.gd"`，共 50 个源文件 / 23 个测试脚本）：

- `assembly_result.gd`、`skill_channel.gd`、`cooldown_component.gd`、`cost_calculator.gd`、`resource_pool.gd`、`damage_conversion.gd`、`trigger_manager.gd`、`skill_slot_bar.gd` 均在 `systems/skills/` 顶层，树中原先未列全（功能无影响，仅补记）
- `systems/perf/` 实际只有 `spatial_hash.gd` + `effect_pool.gd`；`dot_ticker.gd` 在 `combat/`（同上）
- 新增 `tests/perf/`：`bench_projectiles.gd`（逻辑层压测）、`bench_render.gd`（渲染整帧压测，**必须非 headless 运行**）
- 新增 `sandbox/`：`sandbox_main.gd/.tscn`、`sandbox_main` 驱动、`sandbox_hud.gd`（10Hz 重建文本）、`sandbox_projectile_layer.gd`（MultiMesh 单 draw call）、`sandbox_lab.gd`、`sandbox_entity.gd`
- 根目录新增 `export_presets.cfg`（Windows / Linux / Android 三预设）、`.github/workflows/gut.yml`（CI）

---

## 11. 施工顺序与门禁

| 阶段 | 交付 | 门禁（不达标不得进下一阶段） |
|---|---|---|
| **M0** 工程骨架 | `project.godot`、目录、GUT 接入、CI | `godot --headless` 跑测试退出码 = 0；空测试也能跑通「0 通过 0 失败」而非报错 |
| **M1** 管线 | `StatsComponent` + `damage_pipeline.gd` | §12 的 G1–G4 全绿；转换归一化用例通过 |
| **M2** 技能与行为 | `SkillData` + `SkillExecutor` + projectile/melee 两个行为 | 单发冰矛能打出数字；改 `.tres` 数值即改伤害，不改代码 |
| **M3** 装配 | `SocketGraph` + `Assembly` | G5–G7 + G7b 通过；卸下辅助后数值**完全还原**（逐位相等，不是近似） |
| **M4** 伤害闭环 | Hitbox/Hurtbox、暴击、抗性、击杀 | G8–G9 通过；端到端 DPS 与手算差 ≤ 0.5% |
| **M5** 资源 | 冷却/充能/消耗/多技能栏 | 资源不足无法施法；8 个技能位全可用（R8 补 `8` 键，槽 7 从"死槽"变为可独立施放） |
| **M6** 其余行为 | aoe/channel/summon/dash/buff | 8 主动全部上线（R8 补第 8 个 `frost_nova`。原文的 `W1` 无定义，按"第 1 批内容集"理解，见 §0.2 #10） |
| **M7** 触发 | `CombatEventBus` + `TriggerManager` | G10 通过（触发频率落在 ±10%）；链深保护生效 |
| **M8** 性能 | SoA 投射物 + 空间哈希 + 池 | 100 弹并发同屏 ≥ 60fps（目标机型）；GC 峰值无尖刺 |

**硬门禁**：M3 结束时，若出现任何"为跑通而写的 `if gem_id ==`"分支，**立即停止并重构**，不接受"先跑通再优化"。

---

## 12. 测试规格（10 条黄金用例，全部可手算）

> 每条都是"输入 → 期望值"，AI 必须写成断言，不许只写"能跑"。

| ID | 场景 | 输入 | 期望 |
|---|---|---|---|
| **G1** | 加乘分离 | base 100，inc +50%，两个 more 各 +20% | `100 × 1.5 × 1.2 × 1.2 = 216.0` |
| **G2** | inc 加算 | base 100，inc +30% +30%，两个 more 各 +20% | `100 × 1.6 × 1.44 = 230.4` |
| **G3** | 转换顺序 | 见 §4.3 | `156.0` |
| **G4** | 转换归一化 | base 100 物理，60%→火 + 60%→冰 | 火 50 / 冰 50 / 物理 0（合计 100） |
| **G5** | 辅助装配 | 冰矛 + 多重投射(+2) + 连锁(+2) | `projectile_count = 3`、`chain_count = 2`、消耗 `×1.5×1.3` |
| **G6** | 卸下还原 | 装上再卸下同一辅助 | 所有 stat **逐位等于**装配前 |
| **G7** | 兼容排除 | 无情（require=melee, exclude=spell）挂到法术技能 | 装配失败，返回明确错误码，**不得静默忽略** |
| **G7b**（2026-10-19 R1） | 镶嵌准入 | 不兼容辅助尝试放入合法槽位 | `socket_check` 返回 false + 错误码（`ERR_INCOMPATIBLE_SUPPORT` / `ERR_CONFLICT` / `ERR_NO_SOCKET`），**该辅助不进入槽位**；其余辅助不受影响 |
| **G8** | 暴击期望 | base 100，crit 30%，crit_multi 150% | 1000 次采样均值 ≈ `115 ± 3` |
| **G9** | 异常通道 | 点燃目标，施加 "hit damage +100%" | 点燃 DPS **不变**（证明通道隔离正确） |
| **G10** | 触发限流 | 事件率 5/s，chance 0.3，CD 0.5s | 100 秒触发 `150 ± 15` 次 |

**必须**：G6 用 `==` 而非 `is_equal_approx`——"卸下即还原"是精确性要求，不是近似要求。

---

## 13. 禁止事项（违者返工）

### 13.1 架构类

1. 禁止在运行时代码中出现具体宝石 id（`"frost_shard"`）、具体技能名、具体数值。
2. 禁止给 `Modifier` 增加第四种算子（如 `CONVERTED` 直接塞进 stat 管线，转换必须走独立阶段）。
3. 禁止把 `INCREASED` 逐条相乘（这是最常见的"看起来对"的错误）。
4. 禁止行为组件读取其他行为组件的内部状态。
5. 禁止 `SkillInstance` 持有插槽数据副本（单一真源在 `SkillSlot`）。

### 13.2 性能类

6. 禁止热路径 `instantiate/free`。
7. 禁止每个投射物挂 `Area2D`。
8. 禁止每个 DoT 挂 `Timer`。
9. 禁止每帧重算全部 stats（脏标记 + 按需重算）。
10. 禁止在 `_process` 里做字符串拼接/字典分配。

**R7 落地状态（此三条已有对应实现，不再是纸面要求）**：

- 第 9 条 → `StatsComponent` 内置版本号：`_version` 在 `add_modifier` / `add_modifiers` / `remove_by_source` / `set_base` 时 `+= 1`；`aggregate(stat, op)` 与 `multiplier_of(stat)` 各自带 `(值, 版本)` 缓存，命中即返回。**MORE 连乘必须独立一张表**（`_mul_cache` / `_mul_ver`），不能与按 op 求和的 bucket 共用键，否则互相覆盖（见台账 P-18）。
- 第 9 条的配套单一收口：所有整数型 stat（`projectile_count` / `chain_count` / `fork_count` / `pierce`）的 `floor` **只允许**在 `StatRegistry.finalize()` 出现一次；管线各处一律读 `StatRegistry.finalize()`，不得自行取整。
- 第 10 条 → `sandbox/sandbox_hud.gd` 的 `_draw()` 只做绘制，文本由 `_rebuild_lines()` 在 10Hz 节拍重建，`_lines` 数组 `clear()` 复用容量；`_process` 内零字符串拼接。
- 补充红线：热路径 `Dictionary` 命中冷却已全部改定长 SoA（`projectile_field.gd` 的 `_memo_tid` / `_memo_t`，`HIT_MEMO = 4`），`SpatialHash.clear()` 把桶数组收进 `_bucket_pool` 复用——这两处是"每帧分配"最常见的藏身处。

### 13.3 从 kit 抄的时候必须避开的坑

> kit 的复盘文档自己暴露了一个 P0：**防御结算被执行了两次**（`armor=100` 实际减伤 75% 而非 50%，`dodge=30%` 实际 51%）。根因是"攻击者视角管线"和"受击方视角管线"被串联调用。

11. **禁止**同时存在两条伤害/减伤管线。本项目只允许**一条**：`attack → 生成 DamagePacket → 受击方结算`。攻击侧只负责算"打出多少"，受击侧只负责"扣多少"，**不得互相调用对方的减伤逻辑**。
12. **禁止**用"把默认值清零"的方式写测试（会让 BUG 隐身）。测试必须覆盖"护甲 100 / 闪避 30% / 有护盾"的**非零默认态**。

### 13.4 合规类

13. 禁止复制 `the-exile-engine-v2` 的任何代码（无 LICENSE）。
14. 禁止使用 Path of Exile 的技能名、图标、数值表。
15. 若引入 `godot-arpg-kit` 代码，必须在 `NOTICE` 或文件头保留：`Portions derived from godot-arpg-kit, Copyright (c) 2026 eiehihi, MIT License`。

---

## 14. 多平台与导出

| 平台 | 要求 | 注意 |
|---|---|---|
| Windows / macOS / Linux | 主验收 | 同一套 `.tres` + 同一套逻辑；本机实机只验了 Windows（§0.2 #11） |
| Android | 必测 60fps | 虚拟摇杆另做；`config/features` 已含 `"Mobile"`；预设已就位，真机未跑（§0.2 #8） |
| Web (WASM) | **❌ 非必需（R8 判定，已关闭）** | 判定依据见下表；若将来回头做，按下表代价重估 |
| iOS | 可选 | 需签名，性能预期同 Android |

**Web(WASM) 判定为「非必需」的依据（R8，人类授权由 AI 判断）**：

1. **不在验收路径上**：§14 的主验收是 Windows/macOS/Linux，Android 是"必测 60fps"，Web 原文只写"待确认"。项目最终的发布出口是 **Godot 原生导出**（桌面 + Android），Web 不是发行必需的载体。
2. **渲染后端直接冲突**：Godot 4 的 Web 导出**只支持 Compatibility（WebGL 2.0）**，Forward+ 与 Mobile 渲染器**不能**跑 Web。而本项目 `project.godot` 的 `config/features` 已声明 `"Mobile"`——要做 Web 就得整体降级到 Compatibility，画质与后处理要重做一遍。
3. **性能基线撑不住**：单线程 WASM（4.3 起的默认与推荐模式）性能约为原生的一半或更低，多线程导出需要 COOP/COEP 跨源隔离头、站点不能有第三方整合，且 4.6-dev 仍有多线程 + `ResourceLoader` 进度失效的公开 issue。本项目的红线是 **100 弹 / 80 特效 / 80 角色同屏**，在 Web 上属于高风险。
4. **改动面被低估**：Web 音频默认 Sample 模式（**不支持 AudioEffects / 混响 / 程序化音效**）、后台标签页会被浏览器暂停、全屏必须由用户手势触发、GDExtension 需专门编译。
5. **可逆，不需要现在付代价**：只要守住本文档已有的那条约束——**禁止 `if OS.has_feature("mobile")` 分叉游戏规则**（只允许分叉输入与画质）——将来真要 Web，就是纯导出层的活，不需要重写逻辑。

> **结论**：不把 Web 列为交付目标。唯一保留的纪律：**不引入 GDExtension、不依赖 Web 上不存在的 API**（如任意线程、低层网络），以保证将来想开就能开。

**必须**：所有平台共用同一套 `.tres` 与同一套逻辑；**禁止**用 `if OS.has_feature("mobile")` 分叉游戏规则（只允许分叉输入与画质）。

---

## 15. 术语替换（可选，但与 IP 风险直接相关）

原规格的 40 个主动宝石大量沿用 PoE 原名（`Ice Shard` / `Cleave` / `Leap Slam` / `Storm Call` / `Arc` / `Ground Slam` / `Rockfall`…）。若项目计划商业化，建议按下表规则替换（保留意译，去掉专名）：

| 原 | 建议 | 规则 |
|---|---|---|
| Ice Shard | 霜棱 | 材质 + 形态，不用 PoE 组合词 |
| Cleave | 裂斩 | 动词化 |
| Leap Slam | 震跃 | 动作 + 结果 |
| Storm Call | 落雷印记 | 去掉 `Call` 这类 PoE 惯用后缀 |
| Arc | 电弧链 | 加限定词，避免单词雷同 |
| Ground Slam | 地裂击 | 同上 |

**规则三条**：① 不用 PoE 的"单词型"技能名（Arc / Cleave / Spark）；② 不用 `Awakened / Vaal / Mirror / Atlas / 6-Link` 等专有体系词；③ 中文名以"材质+形态"或"动作+结果"两段式为主。

---

## 16. 正式内容制作规范（技能 / 辅助宝石）

> ### ⚠️ 2026-10-20 / R10：本节**暂缓执行**，不得照此开工
>
> 曾核对过一份**外部**设计文档《技能系统书 v1》（12245 行，卷一 22 章 + 《全新技能系统设计书》v0.2）。**该文档未随仓库入库，现已不可读**（见《信息来源与真源清单》E-04）——下面三点冲突结论保留作留痕，但在人类把该文档投放进 `docs/_重要资料记录/人工资料源/` 之前：**本节不得据此推进，也不得据此反驳**。
>
> 1. **路径冲突**：书定的作者层是「编辑器表单 → CFG（七键）→ 运行时」，**CFG 是编辑器与运行时之间唯一的数据契约**（卷一第 3 章 3.1）。本节下面的「CSV 直改 `.tres`」是绕过契约的旁路，等价于在契约之外另造一份定义。
> 2. **重复发明**：书里**第 14 章《校验规则表》**已给校验规则、**第 21 章**已给覆盖率判据、**第 18 章《模板库与批量》**已给模板实例化与批量事务语义（含「整批成功或整批不提交」「不用逆运算恢复参数」）。本节 16.3 的 lint 9 条、16.6 的覆盖率、以及此前提过的「生成器」，都是对已有条款的重复发明，应当**引用**而非另写。
> 3. **模型不同构（最要紧）**：书的 CFG 七键为 `schema_version / skill_id / meta / bricks / params / presentation / runtime_hints`，`bricks` 每项是**十二字段登记卡**（`brick_id / name / tagline / carrier / summary / default_cfg / author_params / locked_params / relic_params / presentation / player_text / status`）；而 Godot 侧 `SkillData` 是 `gem_id / parts / tags / cast_mode / cost_* / cooldown / level_scaling / allowed_support_tags`，`SkillPart` 只有行为与数值字段。**两套模型不是同一套字段，现有实现是施工规格自定义的简化模型，不是卷三 CFG 的落地。**
>
> **恢复条件**：先由人类把该设计文档投放进 `docs/_重要资料记录/人工资料源/` 并在来源清单登记；再产出《CFG 七键 ↔ Godot 类 字段映射表》（1:1 / 有损 / 书有码无 / 码有书无 四类），并由人类裁定路线（CFG 驱动 / 自有 `.tres` / 适配层双轨）之后，本节按结论重写。
>
> **R17 澄清（2026-10-21）**：`docs/_重要资料记录/人工资料源/` 已投放 **评估书 v1.0** 与 **评审一页纸**（E-07 / E-08），但那是「选哪个开源方案」的结案证据（结论已在 §1.1），**不是「该设计文档」**。恢复条件①**仍未满足**，路线 A/B/C 依旧不可裁定。三选一的来源、优缺点、代码冲击见 `docs/_重要资料记录/AI资料源/架构溯源/内容生产路线_三选一分析_v1.md`（S6 提案，不选路）。
>
> 下面保留原文，仅作「曾经想过什么」的留痕，**不作施工依据**。
>
> **不冲突的补充（R13 / R14 校正路径）**：内容创作的**方法与模式**已单独成册 → `docs/_AI开发与文档/01_写内容/内容设计手册_技能与辅助宝石_v1.md`（7 行为 / 14 标签 / 18 设计模式 / 8 辅助原型 / 数值基线 / `.tres` 写法 / 反例库）。
> **口径层（R14）**：主动技能的四轴模型 / 标签体系 / 施放八项以 `docs/_AI开发与文档/01_写内容/00_总纲_主动技能体系_v1.md` 为准；本规格管框架，不重复定义内容口径。
> 两者分工：**手册讲「写什么、怎么写一个技能」**（不受路线影响）；**本节讲「怎么批量产」**（受 CFG 路线影响，暂缓）。
> 做单个技能/辅助 → 看手册；做批量流水线/生成器 → 等路线裁定。

> **前提**：M0–M8 交付的是**框架**，接下来主要工作是往里灌内容。
> 灌内容最容易犯的错不是写错一个数，而是**在编辑器里一个个手点 `.tres`**——量一上来就没有一致性、没法批量调、diff 不可读、下一个 AI 接手时看不出规律。

### 16.1 三条铁律

1. **内容 = 数据，不写代码**（附录 C 第 1 条，答案必须是 0）。
2. **内容 = 数据 + 契约测试**。每加一批内容，lint 用例必须跟着加；没有 lint 的内容集等于没有护栏。
3. **数值 = 公式**。手填的数字只允许出现在「公式参数」里，不允许出现在「结果」里。

### 16.2 设计台：CSV 进、`.tres` 出（两段式）

```
content_src/skills.csv      ← 人/表 编辑的设计台（唯一手改入口）
content_src/supports.csv
        ↓  tools/build_content.gd（headless 跑，用 ResourceSaver.save()）
mods/jes-skills/content/gems/**/*.tres   ← 运行时真源（D-05 不变）
```

**为什么生成器必须用 Godot 自己写，不能手拼文本**：`.tres` 里的 `[ext_resource id="1_abc"]`、`Array[ExtResource("2_x")](...)` 这类标注手写必错，且错法是「加载时报类型不符」而不是「语法错」，极难定位。用 `ResourceSaver.save(res, path)` 生成，格式 100% 合法、`script_class` 自动正确。

**跑法**：`godot --headless --path . --script res://tools/build_content.gd`

**CSV 列（active）**：`id / name / behavior / element / base_damage / effectiveness / damage_channel / cast_time / cost_type / cost / cooldown / tags / per_level / <behavior_params 各键>`

**CSV 列（supports）**：`id / name / require_tags / exclude_tags / add_tags / cost_multiplier / stat / op / value / override_key / override_add / override_mul / flags / conflicts_with`

**漂移检查（关键）**：CI 里跑完生成器后执行 `git diff --exit-code mods/jes-skills/content/`。非零就说明「有人改了 `.tres` 没改 CSV」或「改了 CSV 没重新生成」——这条是根治「两个真源」的唯一办法。

> **别倒过来**：不要改成「运行时读 CSV」。`.tres` 是 Resource，有导入缓存、有编辑器预览、有类型检查；CSV 没有。CSV 只是**制作期**的工作台，不是运行时真源。

### 16.3 内容 Lint：把内容错误变成测试红

新建 `tests/skills/test_content_lint.gd`，遍历 registry 全部对象逐条断言。**清单**：

| # | 检查 | 不做的后果 |
|---|---|---|
| 1 | `id` 唯一、snake_case、与文件名一致 | 重名时后加载的静默覆盖前一个 |
| 2 | `behavior_id ∈ SkillExecutor.BEHAVIORS` | 该 part 被 `cast()` 静默跳过（技能"能放但没伤害"） |
| 3 | 所有 `stat` ∈ `StatRegistry.DEFS` | 修饰符算进了不存在的属性，数值永不生效 |
| 4 | 所有 tag ∈ `TagRegistry` | 兼容性判定永远假，辅助石白镶 |
| 5 | 数值区间：`cost 0–200`、`cd 0–30`、`effectiveness 0.3–2.0`、`base_damage 0–2000` | 手滑多个 0，玩家一刀秒全场 |
| 6 | 每颗辅助石的 `require_tags` 至少被 1 个主动满足 | 死内容：永远镶不上 |
| 7 | `conflicts_with` 双向一致 | 单向冲突 → 先镶谁决定结果，玩家可绕过 |
| 8 | 每个 `SkillSlot` 演示编排的 id 都能在 registry 找到 | 沙盒起动即空槽 |
| 9 | 1–20 级 `factor_for()` 单调递增且总倍率在 2.0–4.0 | 曲线写反（高等级更弱） |

第 6 条要特别记：**辅助石与主动是一张二分图**，任何一边"孤岛"都是设计事故。lint 可以顺手输出覆盖率（多少主动 × 多少辅助可组合），这是内容量的真实指标。

### 16.4 数值：等级曲线（R12 已落地，非待办）

**R12 已修**：原实现只有 `per_level` 单参数线性（`factor_for(20) = 1 + 0.1×19 = 2.9`），1→2 级与 19→20 级手感相同，且所有技能曲线形状完全一样，无法区分「前期发力」与「后期发力」。
现扩展为**两段式**（字段与公式见 §3.1）：`knee_level = 0` 仍走旧线性（**旧内容逐位不变**），`knee_level >= 1` 时拐点前后各用一个成长率。断言见 `tests/skills/test_gem_level_scaling.gd`。

**明确不做**：`Curve` 形态（理由见 D-17：不可手改、不可批量、不可解析断言）。若将来确需多段，新增显式模式，不要偷偷塞 Curve。

**灌批量内容前仍缺的护栏**（属 §16 暂缓范围，解冻后随内容 lint 一起做）：
- 参数区间：`per_level` / `per_level_late ∈ [0, 0.5]`、`knee_level ∈ [0, 20]`
- 终值区间：`factor_for(20) ∈ [2.0, 4.0]`（现已有单调性断言，终值区间待内容定稿后加）

**单位化设计**：所有资源的消耗统一折算成「每秒资源」（`cost / cooldown`，无 CD 的按 `cost / cast_time`）。这样 8 个技能放在一张图上就能看出谁超模——比逐个看 `cost` 和 `cd` 有效得多。

### 16.5 目录与命名

```
content/gems/active/<school>/<id>.tres      # school: fire / cold / lightning / physical / chaos / summon / movement
content/gems/supports/<kind>/<id>.tres      # kind: damage / behavior / utility
```

目录只影响 `GemRegistry` 的扫描与人工查找，**不影响任何代码分支**（禁止按目录写 `if`）。

### 16.6 平衡验收：沙盒巡览表

沙盒加一个巡览模式：遍历所有 active，各打一次同一木桩 10 秒，输出 `id / DPS / 每秒耗魔 / 命中数 / 峰值并发` 表格。

**判据**：DPS 极差（最高/最低）超过 2.5 倍即为超模，不必等玩家反馈。第 2 个判据是「每秒耗魔」——DPS 高但耗魔也高的技能是设计选择，DPS 高而耗魔低的才是 bug。

---

## 附录 A｜PoB 精确读取清单（按需读，不要全文）

| 文件 | 行数 | 只读这些 |
|---|---|---|
| `src/Modules/CalcActiveSkill.lua` | 934 | 技能注册、多 part 拆分 |
| `src/Modules/CalcOffence.lua` | 6263 | 只读 conversion 段与 `increased/more` 聚合段 |
| `src/Modules/CalcTriggers.lua` | 1627 | 触发频率与 cooldown 扣减 |
| `src/Classes/SkillsTab.lua` | 1502 | `socketGroupList` 的数据形态（仅借鉴命名） |
| `src/Data/Skills/sup_int.lua` | 7007 | 只看 `requireSkillTypes / addSkillTypes / excludeSkillTypes` 三个字段 |
| `src/Data/SkillStatMap.lua` | — | stat 名 → 修饰符的映射表形态 |

**提醒**：这些是"标准答案"，不是"模板"。把 6263 行的 Lua 移植到 GDScript 属于无效工作。

## 附录 B｜kit 抄/不抄清单

| 抄 | 文件 | 理由 |
|---|---|---|
| ✅ | `scripts/stats/stat_modifier.gd` | 数据形态干净，带来源 |
| ✅ | `scripts/stats/stats_component.gd` | 接口签名（`add/remove_by_source`） |
| ✅ | `scripts/combat/damage_calculator.gd` + `damage_info.gd` | 纯函数 + `RefCounted`，可单测 |
| ✅ | `scripts/combat/combat_event_bus.gd` | autoload 事件总线 |
| ✅ | `tests/`、`.github/workflows/tests.yml` | 测试组织 + headless 退出码经验 |
| ❌ | `combat_component.gd` 的攻击/受击双管线 | 曾导致双重减伤 P0 |
| ❌ | `skills/skill_manager.gd` 的释放流程 | 无插槽/装配层，需重写 |
| ❌ | 节点化的战斗与碰撞实现 | 撑不到 300 投射物 |

## 附录 C｜提交前自检（AI 请逐条回答 yes/no）

1. 新增一个辅助石，我改了几个 `.gd` 文件？（答案必须是 **0**）
   > R6 起成立：往 `content/gems/supports/` 丢一个 `.tres` 即生效，`GemRegistry` 自动扫描，代码零改动。
2. `INCREASED` 是求和后一次乘，还是逐条乘？（必须是**求和后一次乘**）
3. 转换发生在 `INCREASED` 之前还是之后？（必须是**之前**）
4. 点燃伤害吃不吃 `hit damage`？（必须是**不吃**）
5. 卸下辅助后数值能否逐位还原？（必须是**能**）
6. 是否存在第二条减伤管线？（必须是**没有**）
7. 300 投射物时是 O(n·m) 还是哈希查询？（必须是**哈希**）
8. 每个 DoT 是否各自挂了 Timer？（必须是**没有，走全局 ticker**）
9. 是否有任何一行代码写死了宝石 id 或数值？（必须是**没有**）
10. 测试里是否把默认值清零来"制造通过"？（必须是**没有**）

**R7 追加自检（对应本轮新增的四块能力）**：

11. 新增一个**属性**，我改了几个 `.gd` 文件？（答案必须是 **1**，只改 `util/stat_registry.gd` 的 `DEFS`）
    > 若还要改 `skill_executor.gd` / `damage_calculator.gd`，说明没走 `StatRegistry.finalize()` 的单一收口。
12. 新增一个**标签**（`damage_type` / `cast_type` / `form`）是否只改 `util/tag_registry.gd`？（必须是 **能**）
13. 装配缓存命中时，返回的是**深拷贝**吗？（必须是**是**）
    > 否的话 `StatsComponent.add_modifiers` 会统一改写 `modifier.source_id`，第二次命中即污染缓存，G6「卸下即还原」当场失效。
14. 同一个槽连续装配两次（配置未变），`rebuild_count` 会增加吗？（必须**不增加**，走缓存）
15. `SkillInstance` 里有没有 `SkillSlot` 字段的副本？（必须是**没有**，只存引用；§13.1 第 5 条）
16. 冷却对象在槽重建后是否沿用？（必须是**沿用**——冷却跟着槽走，不跟着装配结果走）
17. 条件门缺上下文时是**放行**还是**拦截**？（必须是 **fail-closed，拦截**）
18. 召唤物到达 `max_count` 时是**拒绝新召唤**还是**顶掉最旧**？（必须是**顶掉最旧**；另有 `HARD_CAP = 64` 兜底）
19. 召唤物继承施法者属性时，是全量拷贝还是白名单子集？（必须是**白名单子集**：`minion_damage` / `minion_attack_speed` / `minion_life`）
20. CI 里 `godot --headless --import` 跑了几次？（必须是 **≥2 次**，否则 `class_name` 缓存不刷新，测试报 "Could not find type"，见台账 P-08）

> **变更记录已迁冷区**（2026-10-21 R23 / D-24）：见
> `docs/_重要资料记录/AI资料源/治理档案/规格与治理_变更沿革_v1.md` §一。
> 需要知道「这条规则哪一轮加的、因谁的要求」时再查，开工不必读。
>
> 已确认的既有决策（G1–G10、M0–M8 门禁、七步管线顺序）**不受历史轮次影响**，一条未改。

**文档结束。** 执行中遇到本文件未覆盖的设计抉择，**停下来问人类**，不要自行发明规则——尤其是辅助宝石的具体效果（原「水晶」概念已并入辅助宝石，见 §6 / D-14），以及任何「换掉主动技能引用」的提议（§6.1 已裁定为否）。
