# 开源方案评估书｜PoE 式技能系统的落地路径

**文档编号**：EVAL-SKILL-001　**版本**：v1.0　**状态**：待人工审核
**评估对象**：方案一 `Simplereally/the-exile-engine-v2`（整仓复用）／方案二 `PathOfBuilding 计算模块 + ClarkWain/godot-arpg-kit`（语义 + 落地组合）
**评估日期**：2026-10-19　**证据采集**：本地浅克隆实测 + 官方仓库原文，命令见附录 A
**适用项目**：弹幕 Roguelike × 背包 Roguelike × 搜打撤，Godot 4.7.2 迁移目标，技能石＝主动技能 / 辅助石＝武器模块 / 水晶系统 v0.5

---

## 0. 给审核者的 60 秒摘要

| 项目 | 结论 |
|---|---|
| **决策建议** | **采纳方案二作为基线**；方案一**降级**为「字段命名字典 + 技术亮点清单」，不整仓复用 |
| **加权得分** | 方案一 **2.26** ／ 方案二 **4.53**（5 分制，8 维加权，口径见 §6） |
| **决定性证据** | 方案一仓库**没有 `project.godot`**，Godot 编辑器无法打开，属"源码堆"而非可运行工程；方案二两个仓库均可运行且为 MIT |
| **最大认知纠正** | PoB 主许可证**不是 GPL，是 MIT**（`LICENSE.md` 实测），上一轮结论需更正 |
| **最大隐藏风险** | 方案二的 kit 有 228 条测试全绿史，但仍曾存在"防御减伤结算两次"的 P0 缺陷——**测试数量 ≠ 正确性**，必须补端到端数值核对 |
| **需人工决断** | ① 是否接受"只学 PoB 语义、不搬任何技能名/数值" ② 100 弹/80 特效的验收机型与帧率 ③ 是否要求 Web 导出（影响架构取舍） |

---

## 1. 评审方法与局限（先声明，避免误读）

1. **评审形态**：五路独立评审（A 架构语义 / B 引擎落地 / C 性能规模 / D AI 协作工程 / E 风险合规）。**这是同一模型内按互斥评审准则隔离执行的五套评审视图，不是多厂商模型 API 的实测对比**。若需要真正的多模型交叉，建议把本文件的 §3 事实核查表直接投喂给其他模型做二次复核。
2. **证据分级**：
   - **A 级**＝本机实测（克隆仓库、读取文件、统计行数），可复现；
   - **B 级**＝仓库 README / 官方文档 / 深维基的公开声明，未独立验证；
   - **C 级**＝基于代码结构的推断，需人工确认。
3. **打分口径**：1 分＝不可用，2 分＝有重大缺陷，3 分＝可用但需大量补齐，4 分＝可直接落地，5 分＝业界标杆。
4. **本文件不含任何未标注来源的性能数字**。所有"行数/文件数"均为 `git ls-tree` 实测值。

---

## 2. 信息来源与取证记录

| # | 对象 | 结论性事实 | 级别 | 取证方式 |
|---|---|---|---|---|
| S1 | the-exile-engine-v2 | 全仓 **241 个 `.gd` / 1340 个 `.json` / 90 个 `.md`** | A | `git ls-tree -r --name-only HEAD` 计数 |
| S2 | the-exile-engine-v2 | **无 `project.godot`**；`exodus/config/` 仅 `api_config.json` | A | 全仓检索 `project.godot` 返回空 |
| S3 | the-exile-engine-v2 | **无任何 LICENSE 文件**（许可证一栏仍是 "to be added"） | A | `git ls-tree | grep -i license` 返回空 |
| S4 | the-exile-engine-v2 | `src/skills/` 17 个文件，核心三件：`gem_socket_system.gd` 685 行、`support_gem_calculator.gd` 727 行、`skill_validator.gd` 277 行 | A | `git show HEAD:<path> | wc -l` |
| S5 | the-exile-engine-v2 | 顶层 34 个 `.md` 全是 `PHASE_1..8_*` / `AUDIT_*` / `ULTRAWORK_*` 过程报告 | A | 根目录列表 |
| S6 | the-exile-engine-v2 | `ULTRAWORK_PROGRESS.md` 自述："Session Date: April 10 2026 / Duration ~3 hours / 21 of 42 Tasks / ~4,800 Lines of Code Added / MVP STATUS: ACHIEVED" | A | 文件原文 |
| S7 | the-exile-engine-v2 | 末次提交 2026-04-11，之后无更新 | A | `git log -1` |
| S8 | the-exile-engine-v2 | 技能数据 `data/skills/active/anger.json` 仅 `id/name/type/tags/level_requirement/cast_time/reservation/aura/quality_bonus`，**无 `require_skill_types` / `exclude_skill_types` 字段** | A | 文件原文 |
| S9 | the-exile-engine-v2 | 辅助石归类靠字符串匹配：`stat_name.contains("area")` / `contains("projectile")` | A | `support_gem_calculator.gd` L120–L124 |
| S10 | PathOfBuilding | `LICENSE.md` = **MIT**（Copyright 2016 David Gowor），内嵌 curl（MIT 类）与 `base64.lua`（LGPL-2）第三方段落 | A | 原始文件逐行读取 |
| S11 | PathOfBuilding | 规模：`CalcOffence.lua` **6263** 行、`CalcSetup.lua` 1975、`CalcTriggers.lua` 1627、`SkillsTab.lua` 1502、`CalcActiveSkill.lua` 934、`Data/Skills/sup_int.lua` **7007** 行 | A | raw.githubusercontent + `wc -l` |
| S12 | PathOfBuilding | 修饰语义为 `mod("Damage","MORE",v)`，辅助石兼容性由 `requireSkillTypes / addSkillTypes / excludeSkillTypes` 三数组判定 | B | 深维基 5.3 / 4.2 章节 |
| S13 | godot-arpg-kit | **MIT**；`project.godot` 存在，`config/features = ("4.5","Mobile")`；`scripts/` **9189 行**；**38 个测试脚本**；README 自述 v0.2.0 共 228 用例（v0.1.0 复盘为 189 条） | A | 实测 + README |
| S14 | godot-arpg-kit | 末次提交 2026-10-10（v0.2.0），有 CI、CHANGELOG、中文系统文档、`GEMINI.md` 代理协议 | A | 文件树 |
| S15 | godot-arpg-kit | 复盘文档自陈历史 P0：`armor=100` 实际减伤 75%（应 50%）、`dodge=30%` 实际 51%、护盾双消耗、`is_blocking` 从未传入、测试因 setup 清零而"绿着漏 BUG" | A | `docs/tech-notes/godot-arpg-kit-postmortem.md` |

**更正声明**：上一轮口头评估将 PoB 记为 GPL-3，属误判。实测 `LICENSE.md` 首段为 MIT 授权（David Gowor），随后才是 `base64.lua` 的 LGPL-2 与 curl 的 MIT 类段落。**结论方向不变（PoB 仍不适合直接移植），但理由从"许可证禁止"改为"工程成本与语法鸿沟"**——这一点对法务判断影响很大，特此更正。

---

## 3. 事实核查：两个方案的真实状态

### 3.1 方案一：一份"看起来完成度很高"的源码堆

| 体检项 | 实测结果 | 判定 |
|---|---|---|
| 能否用 Godot 打开 | 无 `project.godot` | ❌ 不可运行 |
| 能否跑测试 | `exodus/tests/` 41 个文件，但 14 个是 `*_REPORT.md` 过程报告；无 headless 入口 | ❌ 不可自证 |
| 许可证 | 无 LICENSE 文件 | ❌ 默认保留所有权利 |
| 代码组织 | `src/` 28 个子域（bosses/skills/items/endgame/multiplayer…），均为 typed GDScript + `class_name` | ✅ 结构清晰 |
| 领域建模 | `SkillGem / Socket / SupportEffect` 三层内部类；`EffectType` 枚举含 `INCREASED / MORE / ADD / CONVERT / REPLACE / ENABLE`，与 PoE 语义对齐 | ✅ 语义有诚意 |
| 数据驱动 | 70 个技能 JSON，字段扁平；**辅助石兼容性不在数据层**，靠代码里 `stat_name.contains("area")` 猜 | ❌ 违反"策略进表"铁律 |
| 工程成熟度 | 3 小时会话生成 ~4800 行，自评"MVP ACHIEVED"，但 15 个 `.tscn` 对 42 项任务明显不成比例 | ⚠️ 声明与产物脱节 |

**关键判断**：这不是"半成品工程"，而是**"AI 生成的完整度幻觉"**——报告数量（34 份）远多于可运行产物（0 份）。它对 AI 开发者最危险的地方在于：README 承诺的 API 与目录，会诱导后续 AI 直接引用不存在的 `res://` 路径与类名，产生级联幻觉。

### 3.2 方案二：两个仓库，分工明确

| 体检项 | PoB 计算模块 | godot-arpg-kit |
|---|---|---|
| 角色 | **语义字典**（规则怎么写才对） | **落地骨架**（在 Godot 里怎么跑） |
| 语言/引擎 | Lua + SimpleGraphic，桌面端 | GDScript / Godot 4.5+，含 Mobile 特性标记 |
| 可运行性 | ✅ 可运行（桌面） | ✅ 可运行（`project.godot` 完整） |
| 规模 | `CalcOffence` 单文件 6263 行 | `scripts/` 9189 行，38 个测试脚本 |
| 许可证 | MIT（含 LGPL 第三方段落） | MIT |
| 直接复用到 Godot | ❌ Lua→GDScript 是重写，不是移植 | ✅ 可整目录拉入 |
| 覆盖度 | 伤害/触发/召唤/光环/保留/暴击/异常状态全链路 | 战斗/属性/状态/技能/物品/背包/装备/掉落/任务，**无插槽-链接层** |
| 明显缺口 | 无 UI 工程价值、无 Godot 绑定 | 无 `MORE`/`INCREASED` 双乘区抽象、无辅助石兼容性判定、无空间分区 |

**关键判断**：方案二的两个仓库**恰好互补**——一个提供"数值语义的黄金标准"，一个提供"同引擎的可运行骨架"，但**谁都没有"插槽-链接"这一层**（这正是你要自研的部分，也是护城河所在）。

---

## 4. 五路独立评审

### 评审 A｜架构语义派（关注：语义完整性、扩展性）

> **结论：方案二语义层不可替代；方案一在"命名与枚举"上有参考价值，仅此而已。**

- 方案一把 `MORE / INCREASED` 分开建模（`support_gem_calculator.gd` 内 `effects_by_category[...]["more"]` 与 `["increased"]` 分桶），方向正确；但 `add / convert` 只是枚举占位，没有结算顺序定义。**没有结算顺序的乘区，等于没有乘区**。
- PoB 的价值不在"有 MORE"，而在**定义了结算顺序**：基础值 → 附加点伤 → `increased` 加法段 → `more` 乘法段 → 转换链 → 触发/冷却。`CalcOffence.lua` 6263 行的绝大部分复杂度都花在这个顺序与条件判定上。
- 扩展性上方案一是**假扩展**：新增一个辅助石，要改 `support_gem_calculator.gd` 的字符串判断分支；方案二路线只需新增一行 JSON + 一个 tag。
- 加分项：方案一的 `socket / link / connector` 数据结构（`_links: Array[bool]` 表示相邻链接）与"6 连"直觉一致，UI 侧可直接借用这个表达。

### 评审 B｜引擎落地派（关注：Godot 落地、多平台）

> **结论：方案一不构成"可运行基线"，评审层面予以否决（作为整仓复用方案）。**

- 硬性事实：无 `project.godot` = 无法用编辑器打开、无法导出、无法运行测试。要补齐它，得反推 241 个脚本的 autoload 顺序、场景引用与 `res://` 路径，成本不可估。
- 方案一的 `scenes/` 仅 15 个 `.tscn`，而它声称覆盖 act1→endgame、多人、交易、Atlas。**场景数与该声称严重不匹配**，即使补上工程文件，也跑不出可玩循环。
- kit 的工程配置 `config/features = ("4.5","Mobile")` 说明作者一开始就按多端设计；assets 与 `window/stretch/mode="viewport"` 的 640×360 视口 + 1152×648 窗口，正是 16:9 横版移动端的标准做法，与你的目标形态一致。
- 多平台结论：Godot 4 导出链覆盖 Win/macOS/Linux/Web/Android/iOS；PoB 是桌面 Lua 工具，**只能取语义，不能取运行时**。方案一因无法导出，多平台能力为 **0（不可验证）** 而非"Godot 自带即得分"。

### 评审 C｜性能与规模派（关注：性能上限、扩展性）

> **结论：两个方案都没有为"100 弹/80 特效/80 角色"做过设计，方案二只是"更接近可达"。**

- 你的性能基线（每秒 100 发子弹、80 特效、80 角色同屏）在 Godot 4 里**不是难题**，真正的坑是**架构选型**：
  - 若沿用 kit 的"每实体一节点 + 组件节点"模式，100 子弹会带来 100 个场景树节点 + 100 个碰撞体 + 每帧信号派发。可跑，但 GC 与信号开销会随实体数线性上升，且子弹数量一旦上到 300+ 会断崖。
  - 正确解法是**投射物数据化**：数组化结构（SoA）+ `MultiMeshInstance2D` 批量绘制 + 自写圆形/胶囊碰撞 + 空间哈希分区，特效交给 `GPUParticles2D`。这套做法与 kit 的组件模型**可以共存**，但必须在 P3 阶段单独做。
- 方案一唯一值得借鉴的技术点恰在这里：它带了 `DeterministicRNG`（`core/deterministic_rng.gd`）与 `spatial_partition`（`tests/core/test_spatial_partition.gd`）。**确定性随机 + 空间分区**，前者对 Roguelike 的种子回放、后者对百级实体的碰撞查询都是刚需。
- 性能评分克制的原因：两边都没有基准脚本，没有"100 弹实测帧率"这类 A 级证据。**给 4.0 是基于架构可得性，不是实测**。

### 评审 D｜AI 协作工程派（关注：AI 开发适配度、维护性）

> **结论：这是本评估分歧最小的一维——方案二 4.7 / 方案一 2.0。**

按六个子项拆解"AI 开发适配度"：

| 子项 | 方案一 | 方案二 | 说明 |
|---|---|---|---|
| 上下文可切片性 | 2 | 4 | 方案一动辄 34 份报告 + 241 脚本，AI 易被无关上下文淹没；PoB 大文件虽大，但职责单一、可按 `Calc*` 精确切片 |
| 接口稳定性 | 3 | 5 | kit 全量 typed + `class_name` + 纯函数 `RefCounted`，AI 改一处不会炸全局 |
| 可自证性（能否一键验证） | 1 | 5 | kit 有 38 个测试脚本 + CI + headless 退出码，AI 有"红绿灯"；方案一无工程文件，AI 无法自证 |
| 文档可信度 | 1 | 4 | 方案一 34 份报告自评"MVP ACHIEVED"却不可运行，**属负资产**；kit 有复盘文档，主动暴露自己的 P0 BUG，可信度高 |
| 幻觉诱发度（越低越好） | 5 | 2 | 方案一 README 的完整目录会诱导 AI 引用不存在的类与资源，产生级联幻觉 |
| 单次改动影响面 | 2 | 4 | 方案一 `support_gem_calculator` 是字符串分叉，改一处影响所有技能 |

- **反直觉结论**：文档越多不等于越适合 AI。**"可验证的少量文档" > "不可验证的大量报告"**。kit 的 `GEMINI.md`（代理协议）+ 中文系统文档 + 复盘，是当前开源项目里对 agentic 开发最友好的组合之一。
- 维护性：方案一末次提交 2026-04，无 issue 模板之外的协作痕迹，巴士因子 = 1；kit 有 CHANGELOG、release 流程、迁移文档，可持续。

### 评审 E｜风险合规派（关注：许可证、IP、维护）

> **结论：方案一无许可证 = 法务上不可碰；方案二可商用，但"PoE 数据"仍不可搬运。**

- 方案一：**无 LICENSE 文件**。按伯尔尼公约，默认"保留所有权利"，只能"阅读学习思想"，**不能复制代码、不能衍生、不能进商业仓库**。把它拉进项目等于埋一颗随时引爆的合规雷。
- 方案二：PoB 主体 MIT（可商用、可闭源衍生，需保留版权声明）；kit MIT。**但**：
  - `base64.lua` 为 LGPL-2，`curl` 为 MIT 类，均在 `LICENSE.md` 内单独声明——若只读 Lua 逻辑不复制这两个文件，无影响。
  - **PoE 的技能名、数值、天赋树数据版权归 GGG**。RePoE 只是"导出工具"，导出的内容不因工具开源而变成免费素材。**允许借鉴字段结构与结算语义，禁止搬运技能名/数值/图标**。
- 另一个被忽视的风险：方案一的目录里直接使用了 PoE 的专有名词（`awakened_sextant`、`mirror_of_kalandra`、`6-Link`）。**这不仅是许可问题，还是商标/形象风险**，即便换成 MIT 也不建议沿用。

---

## 5. 交叉质询与分歧裁决

| # | 分歧 | 主张方 | 反驳方 | 主审裁决 |
|---|---|---|---|---|
| D1 | 方案一"补个 `project.godot` 就能跑" | A（乐观） | B：241 脚本 + 15 场景 + 无 CI，补齐成本不可估，且补完仍是空壳 | **裁决：否决整仓复用。** 允许"借字段名与三个技术点"，禁止作为基线 |
| D2 | PoB 到底能不能抄 | 旧结论：GPL 不能抄 | E：实测 MIT，可以抄 | **裁决：法律上可抄，工程上不该抄。** 6263 行 Lua 全局表移植到 GDScript 等于重写，且 AI 在超大文件里改写幻觉率显著升高 |
| D3 | 100 弹性能是否够 | B：Godot 上限远高于此 | C：节点化投射物到 300+ 会断崖，必须 DOD | **裁决：基线可过，天花板不行。** P3 必须做投射物数组化 + MultiMesh，且先花 30 分钟做压力验证再定论 |
| D4 | "228 测试全绿"能否作为质量背书 | D（正面） | C：kit 复盘自己承认曾"绿着漏 P0" | **裁决：测试数量不等于正确性。** 必须补 6 条端到端数值断言（DPS/减伤/乘区），以"数值对不对"而非"函数有没有被调用"验收 |
| D5 | 方案一是否一无是处 | E：无许可证即不可用 | A：枚举与命名仍有价值 | **裁决：降级为"参考读物"。** 只取 3 项：`DeterministicRNG` 思路、`spatial_partition` 思路、`socket/link` 数据结构表达 |

---

## 6. 统一口径：评分矩阵

| 维度 | 权重 | 方案一 | 方案二 | 加权差 | 判定依据（一句话） |
|---|---|---|---|---|---|
| 语义完整性/正确性 | 20% | 3.5 | 4.8 | +0.26 | PoB 定义了乘区与结算顺序；方案一只有枚举占位 |
| Godot 4.7 落地适配 | 20% | 1.5 | 4.6 | +0.62 | 一方无工程文件；一方 `project.godot` 完整可跑 |
| 可扩展性 | 15% | 2.9 | 4.5 | +0.24 | 一方字符串分叉；一方表驱动 + tag 判定 |
| 性能上限 | 15% | 2.0 | 4.0 | +0.30 | 均无实测；方案二架构可 DOD 化 |
| 多平台 | 10% | 2.0 | 4.5 | +0.25 | 一方不可导出；一方已按 Mobile 配置 |
| AI 协作开发适配度 | 10% | 2.0 | 4.7 | +0.27 | 可自证性 1 vs 5 是分水岭 |
| 许可证/IP 风险 | 5% | 1.0 | 4.7 | +0.19 | 无 LICENSE vs MIT（PoE 数据仍需回避） |
| 维护性/长期演进 | 5% | 1.5 | 4.45 | +0.15 | 停更半年 vs 本月仍在发版 |
| **加权总分** | **100%** | **2.26** | **4.53** | **+2.27** | — |

### 6.1 扩展性：本质是"加一个组合要不要改代码"

- **方案一**：加一个"辅助石 A + 水晶 B 让投射物分裂"的组合 → 要改 `support_gem_calculator.gd` 的分类逻辑与 `gem_socket_system.gd` 的传播逻辑 → 回归面覆盖全部技能 → **不可扩展**。
- **方案二**：加同样组合 → `support.json` 加一行（`require_tags:["projectile"]`，`mods:[{stat:"projectile_count", type:"ADD", value:1}]`）+ 水晶作为 `condition_tag` → 管线零改动。**这才是你"9 模块并行开发"能成立的前提**：9 个文件之间只通过表结构和 tag 通信，不通过函数调用。
- 缺口提醒：**两个方案都没有"插槽-链接"层**。你要自研的 `SocketGraph`（连通分量、颜色约束、六连判定）必须自己写，PoB 的 `socketGroupList` 只能给你"分组"这一概念的命名参考。

### 6.2 多平台：Godot 的能力 ≠ 你的能力

| 平台 | 方案一 | 方案二 | 备注 |
|---|---|---|---|
| Windows | ❌ 不可导出 | ✅ | 主验收平台 |
| macOS | ❌ | ✅ | 需签名流程 |
| Linux | ❌ | ✅ | — |
| Web (WASM) | ❌ | ⚠️ 可导但需验证（Godot 4 Web 对多线程/音频有限制） | 你的"多平台 16:9"若含网页试玩，此项是 P3 必测 |
| Android/iOS | ❌ | ✅ 配置已按 Mobile | 触屏虚拟摇杆需另做 |

结论：**多平台不是加分项，是淘汰项**——方案一在这一维直接出局，无需再比。

### 6.3 性能消耗：分三笔账

1. **运行时账**（帧率/内存）：两者都不敢保证 300+ 弹。Godot 4 的瓶颈顺序是：碰撞查询 > 节点信号 > 绘制批处理 > GC。**必须做空间哈希 + 投射物数组化**，否则 80 角色同屏时 O(n²) 碰撞会先把帧率吃光。
2. **开发时账**（AI 迭代速度）：方案一看起来"省了 2 周"，实际上"每次改动都要读 685+727 行强耦合代码"，AI 的每次回归都在赌。方案二的改动面是"一行表 + 一个断言"，**这是 AI 协作下最被低估的性能指标**。
3. **构建时账**：kit 的 9189 行 GDScript 在 headless 下跑 228 用例是可接受的；若未来技能表膨胀到 500+ 条，需把表加载改成"按需索引 + 预编译缓存"，否则启动期 JSON 解析会成为冷启动瓶颈。

### 6.4 AI 协作：为什么这一维决定成败

- **能自证的仓库 > 写得漂亮的仓库**。AI 的核心失效模式不是"不会写"，而是"写完不知道对不对"。kit 的 CI + headless 退出码 + 38 个测试脚本，等于给 AI 装了红绿灯；方案一没有工程文件，AI 改完只能"看起来对"。
- **文档诚实度可量化**：kit 的复盘主动写下"我们的测试曾让 BUG 隐身"；方案一写了 34 份报告宣称 MVP 达成。前者是**可校准的信号**，后者是**噪声**。
- **上下文预算**：你的 9 个模块并行开发，每个模块给 AI 的上下文必须能装进一个窗口。PoB 的 `Calc*` 按职责单文件、kit 的按系统分目录，都支持"只喂一个文件 + 一张表"；方案一的 `src/` 28 个子域混着未完成的多人/交易/Atlas，切片成本极高。

---

## 7. 推荐方案：二为骨，一为镜

| 层 | 取自 | 用法 | 明确不做 |
|---|---|---|---|
| **语义层** | PoB `CalcActiveSkill` / `CalcOffence` / `sup_*.lua` | 抄"结算顺序 + 乘区语义 + tag 兼容判定"三件事，落成 `modifier_pipeline.md` | 不抄 Lua 实现、不抄技能名、不抄数值 |
| **实现层** | godot-arpg-kit | 整目录引入 `scripts/combat/` + `scripts/stats/`，作为管线骨架；沿用其测试结构 | 不改其 MIT 声明；不把它当"最终架构"（它没有插槽层） |
| **参考层** | the-exile-engine-v2 | 只读三处：`deterministic_rng.gd`（种子回放）、`spatial_partition`（空间哈希）、`socket/_links`（连通表达） | **不复制任何代码**（无许可证），不用其任何专有名词 |
| **自研层** | — | `SocketGraph`（连通分量/颜色约束/六连）+ 水晶条件系统 + 局内武器栏多槽 | 不要把水晶逻辑写进辅助石表（会破坏正交性） |

**一句话**：**方案二给你"怎么算对"，方案一只能给你"怎么命名"。** 你的护城河在插槽-链接 + 水晶，这一段没人能给你。

---

## 8. 落地路线与验收门禁

| 阶段 | 目标 | 产出 | 验收门禁（不通过不得进下一阶段） |
|---|---|---|---|
| **P0 语义冻结**（1–2 天） | 把 PoB 的结算顺序固化成文档与表结构 | `modifier_pipeline.md` + 4 张表草案（skill / support / modifier / tag） | 用 PoB 里 10 个真实辅助石做"黄金用例"，写出 ≥6 条断言，**全部能用手算核对** |
| **P1 管线骨架**（3–5 天） | 引入 kit 并改造为"数据驱动" | `DamageContext` + `Pipeline`（base→flat→increased→more→convert→trigger） | 单测 ≥30 条；跑通"1 主动 + 3 辅助"组合；**新增辅助石零代码改动**（只加 JSON） |
| **P2 数据接入**（3–5 天） | 验证表的表达力 | 从方案一 70 个技能里挑 15 个做 schema 迁移 | 15/15 字段可表达；若出现"必须加 if 分支"，**该字段设计判为失败并回炉** |
| **P3 性能与多端**（3 天） | 打穿性能天花板 | Headless 压测脚本（100 弹/80 特效/80 角色）+ Android/Web 冒烟 | 60fps@目标机型；投射物已数组化；**回归测试全绿且包含 6 条端到端数值断言** |

**门禁铁律**：P1 结束时若出现"为了跑通而写的硬编码分支"，立即停止并重构——这条比任何工期都重要，它决定 9 个模块能否并行。

---

## 9. 风险登记册

| ID | 风险 | 概率 | 影响 | 触发信号 | 缓解 |
|---|---|---|---|---|---|
| R1 | 误把方案一当基线，两周后发现不可运行 | 中 | 高 | 有人提议"先 clone 下来跑跑看" | 本文件 §3.1 作为准入否决依据 |
| R2 | 照搬 PoB 语义时把 `more/increased` 混用 | 高 | 高 | DPS 出现 2 位数偏差 | P0 黄金用例 + 手算核对表 |
| R3 | 100 弹节点化导致帧率断崖 | 中 | 中 | 同屏 60 敌人时帧率 <45 | P3 前先做 30 分钟压力验证，不达标即改 DOD |
| R4 | 依赖 kit 的组件模型后，插槽层无处安放 | 中 | 高 | 出现"技能管理器知道插槽"的耦合 | 明确分层：插槽层只输出 `modifier 列表`，不认识技能 |
| R5 | 技能名/数值照搬 PoE 引发 IP 争议 | 中 | 高 | 出现 `awakened_*`、`6-Link` 等术语 | 术语表强制替换（技能石→战技晶核等自有命名） |
| R6 | 9 模块并行时表结构反复变更 | 高 | 中 | 每周都有 schema 破坏性变更 | P0 冻结 schema + 版本号；变更需走 ADR |
| R7 | AI 引用不存在的 `res://` 路径（幻觉） | 高 | 中 | 运行时报 "Cannot open file" | 每次生成后强制 headless 跑测试；路径统一常量表 |
| R8 | Web 导出与多线程物理冲突 | 中 | 中 | Web 端卡顿/无音频 | P3 单独验证，必要时 Web 版关闭多线程 |

---

## 10. 人工审核清单（请逐项勾选或批注）

- [ ] **A1** 是否认可"方案二为基线、方案一仅作参考读物"的结论？
- [ ] **A2** 是否接受 PoB 为 MIT、可参考代码但**不搬运技能名与数值**的法务口径？（建议法务二次确认 §2 更正声明）
- [ ] **A3** 项目是否需要 Web 导出？若需要，是否接受为此牺牲部分物理多线程？
- [ ] **A4** 性能验收的目标机型与帧率（当前草案：中端 Android 60fps @1080p）是否确认？
- [ ] **A5** 是否同意 P0 冻结 4 张表结构，并以"新增辅助石零代码"作为硬门禁？
- [ ] **A6** 是否同意引入 kit 的代码（MIT，需保留版权声明）而非仅参考？
- [ ] **A7** 是否同意全面替换 PoE 专有术语（含 6-Link、Atlas、Awakened、Mirror 等）？
- [ ] **A8** 9 个模块的并行边界是否按"表结构 + tag"划分，而非按功能函数划分？
- [ ] **A9** 是否接受"端到端数值断言"作为上线前必过项（而非仅单测覆盖率）？
- [ ] **A10** 谁负责补齐 `project.godot` 与 CI 门禁（若仍决定试用方案一）？
- [ ] **A11** 是否需要对方案一再做一次"补工程文件后的可行性"限时验证（建议不超过 4 小时，超时即弃）？
- [ ] **A12** 本评估书的权重设定（语义 20% / 落地 20%）是否认可？如需调整，请给出你的权重。

---

## 附录 A｜证据复现命令

```bash
# 1. 浅克隆（只取树，不取全部 blob）
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/Simplereally/the-exile-engine-v2
git clone --depth 1 --filter=tree:0  --no-checkout https://github.com/ClarkWain/godot-arpg-kit

# 2. 方案一体检
git -C the-exile-engine-v2 ls-tree -r --name-only HEAD | grep -c '\.gd$'          # 241
git -C the-exile-engine-v2 ls-tree -r --name-only HEAD | grep -i 'license'        # 空
git -C the-exile-engine-v2 ls-tree -r --name-only HEAD | grep -i 'project.godot'  # 空
git -C the-exile-engine-v2 show HEAD:exodus/src/skills/gem_socket_system.gd | wc -l  # 685
git -C the-exile-engine-v2 show HEAD:ULTRAWORK_PROGRESS.md | head -30

# 3. 方案二体检
git -C godot-arpg-kit show HEAD:LICENSE | head -3                                  # MIT
git -C godot-arpg-kit show HEAD:project.godot | head -30                           # 4.5 / Mobile
git -C godot-arpg-kit ls-tree -r --name-only HEAD | grep -c '^tests/.*\.gd$'       # 38
curl -s https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding/dev/src/Modules/CalcOffence.lua | wc -l   # 6263
curl -s https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding/dev/LICENSE.md | head -8
```

## 附录 B｜术语对齐（评估用语 → 你的项目用语）

| 评估用语 | 你的项目用语 | 说明 |
|---|---|---|
| Skill Gem | 技能石 | 主动技能载体 |
| Support Gem | 辅助石 | 武器模块，改初始技能与稀有技能 |
| Socket / Link | 插槽 / 连线 | 你的局内武器栏多槽 |
| SocketGroup | 连通组 | 同一连通组内辅助石才生效 |
| MORE / INCREASED | 乘法区 / 加法区 | **必须物理分桶，不可混用** |
| ModFlag | 作用域标记 | 区分"只改投射物"与"改全部伤害" |
| require/exclude skill types | 辅助石兼容性三元组 | 建议直接沿用该字段设计 |

---

**评估人**：AI 评审组（五路角色化评审 + 主审统稿）
**审核人**：＿＿＿＿＿＿　**审核日期**：＿＿＿＿＿＿　**结论**：□ 通过　□ 修改后通过　□ 不通过
