# 能量水晶技能系统 · UI 规格 v0.1（装配页 + 技能详情）

> 建立日期：2026-10-12 ｜ 对应代码版本：`APP_VERSION 20261041`
> 玩法真源：`design_crystal_skill_system_v0.5.md` §11 ｜ 数据接口：`skill_system_interface_v1.md`
> **本文件管「界面」**：把已就绪的 `SkillPresenter` 接到 DOM（当前状态 = **逻辑完成、屏未接**）。
>
> ### 🔴 三条界面铁则（v0.5 §11）
> 1. **面板展示两个技能、四槽、等级、实际辅助矩阵**；
> 2. **详情列出作用节点、收益代价、事件限制、冲突与不适用原因**；
> 3. **汇总标签只控制外显，不控制结算**；**hidden 不得隐藏代价**；文案**从配置 + 解释结果生成**，不写死。

---

## 1. 数据来源（UI 只消费 SkillPresenter，不重算）

| API | 输入 | 输出（可直接绑定 DOM 的字段） |
|---|---|---|
| `SkillPresenter.panel(state, heroId)` | run 内英雄技能状态 | `{ skills[], slots[], matrix[], notices[] }` |
| `SkillPresenter.detail(crystalId, heroId, build)` | 水晶 id + 编译结果 | `{ text, reasonCodes[], sections{cost,limits,eventLimits,conflicts,notApplicable} }` |
| `SkillPresenter.explain(build)` | 编译结果 | `{ explanations[], diagnostics[] }` |
| `SkillPresenter.assembleText(tpl, vars)` | 模板 + 变量 | `{ text, missing[] }`（占位符缺失检测） |

- `panel.slots[i]` = `{ slot, crystalId, level, name, quality{name,color}, targets[{skillId,status}] }`
- `panel.matrix[row]` = 每技能 × 每水晶的 `status`（`applied` / `inactive` / `conflict`）
- `panel.notices[]` = 汇总标签（`summaryTag`）/ 隐藏提示 / 诊断（`diagnostic`）
> 🔴 **UI 禁止自行判断「能不能用」**——适用状态**只来自 `build.explanations`**（合同 §13：禁用名字判定）。已有测试守此边界。

---

## 2. 复用现有 DOM（不新建重复屏）

| 现有元素 | 现状 | 改造为 |
|---|---|---|
| `#levelup-overlay` + `#levelup-cards`（`.levelup-card.lu-v2`） | 升级 4 选 1（候选 = **武器模块**） | 候选 = **水晶**，卡面显示辅助矩阵 |
| `#party-skillbar`（每人一条 `[技能图标+冷却环][模块槽×4]`） | 全队技能栏（槽 = **武器模块**） | 每人一条 = `[英雄名][技能 A][水晶槽 ×4][技能 A]`（**A/X 簇严格 = `A X X X X A`**，C7 定稿，见 `game_design_proposal.md` §20.1.1）；槽 = **水晶槽 ×4**（水晶名 + 品质色 + 等级） |
| `#module-tip` | 模块槽词条详情浮窗 | **水晶详情浮窗**（喂 `detail().text` + `sections`） |
| `#hud-skill-cd` | 队长单技能冷却环 | 保留（可扩为两技能环） |

> **改造原则**：**可增删功能，布局不动**（与 `#hud` 统一战斗 UI 口径一致）。新样式走**新 class**（如 `.crystal-slot`），不动旧 `.mod-slot` 以免误伤旧测试。

---

## 3. 屏 1：升级 4 选 1 · 水晶弹窗

**触发**：局内升级（`gainExp` 的升级 `while` 循环）。

**布局**（沿用现有 2×2 网格，竖屏 `grid-portrait`）：

```
┌─ 升级！选择 1 项 ──────────────────┐
│ ┌────────┐ ┌────────┐             │
│ │ 贯穿 ★ │ │ 分裂 ★★│  ← 水晶卡    │
│ │ Lv1→2  │ │ 新增   │             │
│ │火球 ✓  │ │火球 ✓  │  ← 辅助矩阵  │
│ │震荡波 ✗│ │震荡波 ✓│             │
│ └────────┘ └────────┘             │
│ ┌────────┐ ┌────────┐             │
│ │ 爆破 ★★│ │ 属性小包│  ← 兜底卡    │
│ │ ...    │ │ +6HP   │             │
│ └────────┘ └────────┘             │
│              [ 重掷 ✦120 ]         │
└────────────────────────────────────┘
```

**卡片元素**（每张）：
| 元素 | 数据 | 规则 |
|---|---|---|
| 名称 + 品质星 | `slots[].name` + `quality.rank` | 品质色 = `quality.color` |
| 等级变化 | `Lv{from} → Lv{to}` / 新装写「新增」 | 升级不占新槽 |
| **辅助矩阵** | `matrix`：两技能各 `applied/inactive/conflict` | **必显**，这是玩家决策依据 |
| 操作明细 | `detail().sections` 摘要 | 至少显「代价 / 限制」 |
| 锁标 `.lu-locked` | 非法候选 | **非法新装不占位**（v0.5 §8：不以灰色废选项占位） |

**交互**：点击卡片 = 选中并**原子提交**；**取消不改变结果、不重抽**（`rewardId` 只兑现一次）。
**兜底**：不足选项数 → 补**合法属性奖励**；仍不足 → 显示实际数量。

---

## 4. 屏 2：战斗内技能栏（底部 `#party-skillbar`）

**每人一条** = `[英雄名][技能 A][水晶槽1][水晶槽2][水晶槽3][水晶槽4][技能 A]`。

> 🔴 **C7 定稿（2026-10-13 回写）**：整行块序 = `[英雄名][技能 A][水晶 X×4][技能 A]`，**A/X 簇严格 = `A X X X X A`**（A = 技能，X = 水晶）；**英雄名块独占最左**，使「技能—水晶—技能」簇整体相邻；**仅 1 个技能时不补第二个 A**。权威条目见 `game_design_proposal.md` §20.1.1；决策见 `decision_log_v1.md` D019。（下方原单图标形态表述**已被取代**，保留供回溯。）

| 元素 | 数据 | 说明 |
|---|---|---|
| 技能图标 + 冷却环 | `panel.skills[]`（`level / cd / cdLeft / name`） | 复用现有 `updateSkillCd` 弧长口径 |
| 四槽 | `panel.slots[]`（4 个） | 空槽显示占位；有槽显示 `name` + 品质色边 + `Lv` |
| 汇总标签 | `panel.notices[]`（`kind:"summaryTag"`） | **只展示**；`hidden:true` 时按规则隐藏 |
| 诊断 | `notices[]`（`kind:"diagnostic"`） | 有则显示警告角标 |

> 两技能（初始 + 稀有）**共享这 4 槽**——UI 上仍**只画一条 4 槽**，不要画成 2×4。（**两技能各画一环**：初始技能 A 在簇最左、稀有技能 A 在簇最右，即上述 `[英雄名][A][X×4][A]`，见 C7 定稿。）

---

## 5. 屏 3：水晶详情浮窗（点击槽位）

**数据**：`SkillPresenter.detail(crystalId, heroId, build)`。

**必须包含的段落**（缺一不可，顺序固定）：

1. **标题**（水晶名）
2. **装配规则固定文案**：「本局不可卸载、不可替换；重复获取按定义 ID 合并升级，不占新槽。」
3. **占用提示**：「占用 1 个共享水晶槽（两技能共享四槽）。」
4. **代价** `sections.cost` ← `crystalDef.cost`（**hidden 不影响代价展示**）
5. **负面系数** ← `crystalDef.negative`
6. **两技能收益**：`skillName：生效/冲突/不适用` + 参数前后值（`Lv1→2`、`coefficient 1.5→1.65`）
7. **限制** `sections.limits` / **事件限制** `sections.eventLimits` / **冲突** `sections.conflicts`
8. **不适用原因** `sections.notApplicable`（原因码 → 中文）

**现有浮窗复用**：`#module-tip`（`.module-tip`），沿用「跟随指针 + 边缘翻转」逻辑。

---

## 6. 原因码中文化（仅展示，**禁止用于逻辑分支**）

`SkillPresenter.ReasonText` 内置 20 条兜底；配置 `localization["reason.<CODE>"]` 优先。关键几条：

| 码 | 中文 |
|---|---|
| `NO_COMPATIBLE_NODE` | 无节点匹配（不产生收益） |
| `MOTION_CONFLICT` | 形态互斥（争用主运动资源） |
| `EXISTING_CRYSTAL_INACTIVE` | 已装水晶将全部失效 |
| `SLOTS_FULL` / `MAX_LEVEL` | 槽位已满 / 已达等级上限 |
| `TARGET_ALREADY_HIT` | 同目标已消耗本次命中额度 |
| `REGION_MAX_DPS` | 持续区域重叠取最高 DPS |

> 完整 20 条见 `js/skill-presenter.js`。**新增原因码必须同步补中文**（`skill_presenter_test` 守）。

---

## 7. 样式约定

- **深色主题**（与项目一致）；品质色直接读 `qualityDefs[].color`（普通 `#b8c4d0` / 稀有 `#4aa3ff` / 史诗 `#a05cff` / 传说 `#ffb545`）。
- **新 class 前缀 `crystal-`**（`.crystal-slot` / `.crystal-card` / `.crystal-matrix`），**不复用 `.mod-slot`**。
- 品质**不能只靠颜色辨识**（v0.5 §11）——**颜色 + 形状/星标**双通道。
- 竖屏（390×844 优先）：弹窗 2×2 网格（`grid-portrait`）；技能栏底部居中。

---

## 8. 待确认 / 待接线项（**不猜，标注**）

| # | 项 | 说明 |
|---|---|---|
| 1 | 屏 2「两技能」展示位置 | ✅ **已确认**（C7 定稿，见 `game_design_proposal.md` §20.1.1 排布条 / `decision_log_v1.md` D019）：两技能各画一环，整行块序 = `[英雄名][技能 A][水晶 X×4][技能 A]`，**A/X 簇严格 = `A X X X X A`**；英雄名块独占最左；仅 1 技能时不补第二个 A。 |
| 2 | 装配页是「弹窗」还是「独立屏」 | 现有升级弹窗可复用；若要做**完整装配页**（v0.5 §11 的"技能面板"）需新屏 → **待确认** |
| 3 | H001 详情仍显旧「能量爆发」 | 迁移后需切到 `SK_FIREBALL` 详情 |
| 4 | 稀有技能（`SK_SHOCKWAVE`）在屏 1 的出现时机 | 雕像授予，走 `RP_STATUE`，与升级弹窗不同屏 → **待确认** |
| 5 | 移动端触点尺寸 | 槽位点击热区 ≥ 44px → 待实测 |

---

## 9. 交叉引用

- **数据层**：`skill_system_interface_v1.md` §三（模块对象命名空间）
- **规则层**：`game_design_proposal.md` §20.3（适用/冲突）§20.7（水晶表）§20.8（获取）
- **实现**：`js/skill-presenter.js` + `js/ui.js`（`_renderLevelUp` / `buildPartySkillbar` / `#module-tip`）
- **测试**：`skill_presenter_test.js`（文案与原因码）、`ui_v2_test.js`（界面 6 件套）
