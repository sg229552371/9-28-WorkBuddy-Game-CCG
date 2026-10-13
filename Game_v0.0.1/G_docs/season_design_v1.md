# 赛季玩法规则设计稿 v1（`season_design_v1.md`）

> ⚠️ **本设计由 AI 出稿、用户事后审** —— 依用户裁决「C 类玩法决策授权 AI 出设计并落库，用户事后审」（沿用 D012 先例，见 `G_docs/decision_log_v1.md`）。
> 定位：`game_design_proposal.md` §12-30「赛季玩法」与 §12-9「关卡结构 / 难度曲线」的**规则真源**。
> 决策依据：`decision_log_v1.md` **D033**（赛季配置迁入 CFG + 赛季规则）+ **D035**（C5 赛季对抗玩法循环实现）。
> 代码真源（撰写时实测）：`js/modes.js` §21.6 赛季区块（`js/modes.js:668~737`）、`js/ui-panels.js` 赛季面板（`renderSeason` / `UI.grantSeasonExp`）、`js/ui-screens.js:1086`（撤离成功发赛季经验钩子）、`js/config.js` 的 `CFG.levelCurve.rows` 与预留 `CFG.outLevel.seasonPortal`。
> 口径：本文所写「实现现状」均**直读代码**；「设计建议」标注为待用户审；「落库字段」= 已写入 / 待主会话写入 `CFG.season` 的结构。
> 换行统一 LF；中文书写。

---

## 0. 定位与入口条件

### 0.1 定位

- 赛季玩法 = **主线 99 关之外的长线承载层**：主线打通后提供**无限重复、逐周刷新**的目标循环，用于消化已毕业玩家。
- 玩法形态方向（§12-30 已定方向）：**无限地图玩法**；首版原为**数据结构 + 经验 / 周任务 / 面板占位**，本轮（D035）**已升级为可运行的对抗玩法循环**（复用深渊世界 + 赛季标记，见 §2.5）。
- 与主线/无尽的关系：**并列而非取代**，详见 §6。

### 0.2 入口条件

| 项 | 现值 / 建议值 | 真源 |
| ---- | ---- | ---- |
| 开放门槛 | 主线**通关 20 关后**开放（`unlock.afterLevels:20`） | `CFG.season.unlock.afterLevels`；与现有 `CFG.levelCurve.rows` 的 20 行主线对齐 |
| 入口形态 | **主城·赛季使者 NPC**（`CFG.city.npcs` 内 `id:"NPC_SEASON"`, `func:"season"`）；进圈交互 → 打开赛季大厅（`#screen-season`，`UI.openSeason()`） | `js/config.js` `CFG.city.npcs`；`js/ui-screens.js`（NPC 派发） |
| 入口门（局内） | `CFG.outLevel.seasonPortal` 预留传送门（当前 `null` = 不渲染不判定） | `js/config.js:891/897`；`js/game.js:995/1552~1555` |
| 判定钩子 | **已接线**（D035）：`SeasonState.isUnlocked()` 读主线通关数；未达标禁止进入并提示 | `js/modes.js`（`isUnlocked`）；`js/ui-screens.js` |

> 说明：本轮 `afterLevels:20` 与**现有 20 关主线内容**对齐；设计稿同时给出 21~99 关难度外推口径（§5.3），但**本轮不产关卡内容**。

### 0.3 命名与状态

- 状态词表沿用 `decision_log_v1.md` §1：本稿对应 **D033**（状态：已批准）。
- 赛季状态数据结构 = `js/modes.js` 的 `SeasonState`（内存单例）。

### 0.4 本轮范围（首版占位 → 已升级为实现）

- ✅ **已实现（D035）**：**赛季对抗玩法循环** —— 原「不新增独立玩法循环」**已被取代**；循环六步 = 入口解锁 → 进赛季挑战（复用深渊）→ 击杀/升级/撤离双端计分 → 升赛季等级 → 大厅领奖 → 再挑战（详见 §2.5）。
- ✅ **已实现（D035）**：击杀 / 局内升级 / 成功撤离**三类事件**同时驱动**赛季经验 + 周任务进度**（`SeasonState.onKill` / `onLevelUp` / `onExtract`，双端计分，接线见 §2）。
- ✅ **已实现（D035）**：赛季奖励 `SR001~SR005` 落库 + 赛季大厅「领取」（`SeasonState.claimReward(id)`，等级门 + 去重，见 §4.1）。
- ❌ 仍不接**落盘存档**（内存态，见 §5）。
- ↩️ 原「不产 21~99 关关卡内容」**已不再适用**：21~99 关由 **D037** 另行落库（数据驱动外推，设计真源 = `main_levels_21_99_design_v1.md`）。
- ✅ 落 `CFG.season` 配置 + 面板渲染 + 经验 / 周任务接口（与 `SeasonState` 逐条对应）。

---

## 1. 赛季等级与经验曲线

### 1.1 等级与封顶

| 项 | 值 | 真源 |
| ---- | ---- | ---- |
| 起始等级 `seasonLv` | **1** | `js/modes.js:689` |
| 等级封顶 `maxLv` | **10**（L10 起不再累计经验，`seasonExp` 清零） | `js/modes.js:681/701/709` |
| 经验字段 `seasonExp` | 当前等级内已积累经验（升级后扣除所需、跨级逐次结算） | `js/modes.js:690/699~711` |

### 1.2 升级所需经验曲线

- **公式**：`need(n) = expBase + (n − 1) × expStep = 1000 + (n − 1) × 200`（`n` = 当前赛季等级）。
- 即：LV1→2 需 1000、LV2→3 需 1200、LV3→4 需 1400 …… LV9→10 需 2600。**逐级递增 200**。

| 从 → 到 | LV1→2 | LV2→3 | LV3→4 | … | LV8→9 | LV9→10 |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 所需经验 | 1000 | 1200 | 1400 | … | 2400 | 2600 |
| 累计经验 | 1000 | 2200 | 3600 | … | 13600 | 16200 |

- **封顶口径**：`seasonLv >= maxLv` 时 `addExp` 直接 `return false`（经验不再涨）；升满的一刻 `seasonExp` 强制清零（杜绝残留，`js/modes.js:709`）。
- **跨级**：`addExp` 用 `while` 循环逐级结算，支持一次调用跨多级；**非正数 / 非数字（含 NaN）输入拒绝**（`js/modes.js:700`）。

### 1.3 与 `SeasonState` 的逐条对应

| 设计条目 | 代码落点 | 语义 |
| ---- | ---- | ---- |
| 起始 LV1 | `SeasonState.seasonLv = 1` | 赛季从 LV1 起 |
| 1000 + (n−1)×200 | `expBase` / `expStep` | 升级曲线 |
| L10 封顶 | `maxLv` | 封顶后经验不再累计、清零 |
| 跨级结算 | `while (seasonLv < maxLv)` | 一次调用可升多级 |
| 非法输入拒绝 | `!(n >= 0)` 判定 | NaN / 负数拒绝 |

---

## 2. 经验来源

> 赛季经验 `SeasonState.addExp(n)` 由以下**三类事件**注入；本轮（D035）**均已接线**，数值来源 = **`CFG.season.expGain`**（落库值）。

| # | 来源 | 触发时机 | **落库经验值** | 现状 |
| ---- | ---- | ---- | ---- | ---- |
| ① | **击杀（普通）** | 局内击杀敌人 | **+10** | ✅ 已接线（`SeasonState.onKill`，经 `js/combat.js` 击杀块） |
| ①′ | **击杀（精英 / Boss）** | 击杀精英怪 / Boss | **+40** | ✅ 已接线（`SeasonState.onKill` 按目标类型区分） |
| ② | **局内升级** | 队长局内等级提升 | **+200** | ✅ 已接线（`SeasonState.onLevelUp`，经 `js/items.js` `gainExp` 升级块） |
| ③ | **成功撤离** | 撤离结算成功 | **+500** | ✅ 已接线（`SeasonState.onExtract`，经 `js/ui-screens.js` 撤离钩子） |

- **数值真源**：`CFG.season.expGain = { kill: 10, eliteKill: 40, levelUp: 200, extract: 500 }`（**落库值**，取代原「建议值」）。
- **口径统一**：三类事件**同时**驱动两端 —— ① 赛季经验（`addExp`）② 周任务进度（`addWeeklyProgress`）；本轮**三类事件的赛季经验增量与周任务进度均已接线**（`onKill` / `onLevelUp` / `onExtract`，双端计分，见 §2.5）。
- **保留不变**：`addExp` / `addWeeklyProgress` 的语义与封顶口径同 §1 / §3（非正输入拒绝、跨级逐次结算、L10 封顶清零）。

---

## 2.5 赛季对抗玩法循环（D035 · 本轮已实现）

> 本节取代 §0.4 原「不新增独立玩法循环」——赛季玩法**从占位升级为可运行的对抗玩法循环**。
> 实现落点：`js/modes.js`（`SeasonState` 扩展 + `startSeasonChallenge` / `exitSeasonChallenge`）、`js/combat.js`（击杀接线）、`js/items.js`（`gainExp` 升级接线）、`js/ui-screens.js`（NPC 派发 + 撤离钩子）、`js/ui-panels.js` + `index.html` + `css/style.css`（赛季大厅 UI）。

### 2.5.1 循环六步

| 步 | 环节 | 说明 | 落点 |
| ---- | ---- | ---- | ---- |
| ① | **入口解锁** | 主城「赛季使者」NPC 交互；`SeasonState.isUnlocked()` 校验主线通关数 ≥ `CFG.season.unlock.afterLevels`（20）；未达标**禁止进入并提示** | `js/ui-screens.js`；`js/modes.js` |
| ② | **进赛季挑战（复用深渊）** | `startSeasonChallenge()` **复用现有「深渊 / 无尽」世界**（`enterEndless`）+ 打赛季标记 `G.seasonRun = true`；**不新增独立玩法 / 地图 / 敌人表** | `js/modes.js` |
| ③ | **击杀/升级/撤离双端计分** | 三类事件经 `SeasonState.onKill` / `onLevelUp` / `onExtract` → **同时**折算 **赛季经验**（`addExp`）+ **周任务进度**（`addWeeklyProgress`） | `js/combat.js` / `js/items.js` / `js/ui-screens.js` |
| ④ | **升赛季等级** | 经验按 §1 曲线逐级结算（L10 封顶）；升级即时反馈 | `js/modes.js` |
| ⑤ | **大厅领奖** | 赛季大厅展示 `CFG.season.rewards`；`SeasonState.claimReward(id)` 领取（**等级门 + 去重**，已领不可重复） | `js/ui-panels.js` + `index.html` + `css/style.css` |
| ⑥ | **再挑战** | 退出赛季挑战 `exitSeasonChallenge()` → 回主城；周任务未刷新前进度累计，刷新后重来 | `js/modes.js` |

### 2.5.2 与深渊的关系

- **复用而非复制**：赛季挑战**直接进入深渊世界**（`enterEndless`），仅以 `G.seasonRun = true` 标记「本局为赛季局」；结算走**深渊结算**，并额外把「击杀 / 局内升级 / 撤离」三类事件折算为赛季经验 + 周任务进度。
- **难度口径**：赛季为无限地图，难度与主线解耦（不读 `levelCurve.rows` 之外的新表，见 §5.3）。
- **保留不改**：赛季等级曲线 `1000+(n−1)×200`、L10 封顶、三条周任务（200/3/10）、`resetWeekly` 语义、**内存态不落盘**。

---

## 3. 周任务

### 3.1 三条周任务（现值）

| id | 名称 | 目标 | 真源 |
| ---- | ---- | ---- | ---- |
| `weekly-kill` | 击杀 200 个敌人 | `weeklyKillGoal = 200` | `js/modes.js:718` |
| `weekly-extract` | 成功撤离 3 次 | `weeklyExtractGoal = 3` | `js/modes.js:719` |
| `weekly-levelup` | 局内升级 10 次 | `weeklyLevelUpGoal = 10` | `js/modes.js:720` |

- 进度存储：`SeasonState._weeklyProgress`（按 id 存内存，`{ "weekly-kill":0, "weekly-extract":0, "weekly-levelup":0 }`，`js/modes.js:691~695`）。
- 定义读取：`SeasonState.weeklies()` 返回三条任务的 `{ id, name, goal, progress }`（返回内部数组引用，调用方可读 progress）。

### 3.2 进度累加与重置

- **累加**：`SeasonState.addWeeklyProgress(id, n)` —— 仅当 `id` 属于三个合法 id 且 `n` 为正数时累加，否则 `return false`（`js/modes.js:725~729`）。
- **`resetWeekly` 语义**：把三个任务的进度**全部归零**（`for k in _weeklyProgress` 置 0），**每周一刷新**（占位期手动调用，`js/modes.js:732~734`）。
- **拒绝非正 / 非法 id**：`addWeeklyProgress` 对非法输入不做改动并返回 `false`（防脏数据）。

> ⚠️ **与赛季经验的关系**：周任务是**独立进度条**，与 `seasonExp` **互不折算**；同一个事件（如一次撤离）可**同时**推进赛季经验与 `weekly-extract`。

---

## 4. 赛季奖励与产出

### 4.1 `CFG.season.rewards` 落库表（D035）

> ✅ **本轮落库**：`SR001~SR005` 共 5 条，`unlockAtLv` = **1 / 3 / 5 / 7 / 10**（落库值，取代原「建议条目」）。
> 领取 = 赛季大厅调 `SeasonState.claimReward(id)`（**等级门 + 去重**）。
> 数值真源 = **`CFG.season.rewards`**（码为准）；下表 `type` 为**已落库槽位**，`amount` / `desc` 为**原型档、待策划调优**。

| 字段 | 类型 | 语义 |
| ---- | ---- | ---- |
| `id` | string | 奖励条目 id（`SR001`…`SR005`） |
| `unlockAtLv` | number | 达到该赛季等级解锁（**落库：1 / 3 / 5 / 7 / 10**） |
| `type` | string | 奖励类型（`crystal` 进化结晶 / `chip` 遗迹秘宝 / `insurance` 保险契约 / `cosmetic` 外观） |
| `amount` | number | 数量（`type` 决定量纲；原型档，待策划） |
| `desc` | string | 展示文案 |

**落库条目（`SR001~SR005`；`unlockAtLv` 为落库值，`type` 为已落槽位）**：

| 条目 | `unlockAtLv` | `type` | 说明 |
| ---- | ---- | ---- | ---- |
| SR001 | **1** | crystal | 入门产出（低额结晶） |
| SR002 | **3** | chip | 遗迹秘宝 1 枚 |
| SR003 | **5** | crystal | 中额结晶 |
| SR004 | **7** | insurance | 保险契约 1 份 |
| SR005 | **10** | cosmetic | 满级外观 / 称号 |

### 4.2 产出与既有经济的关系

- 赛季奖励的 `crystal` 产出走**既有进化结晶**（局外成长货币，见 `game_design_proposal.md` §6.6），**不新增第二套货币**。
- `chip` / `insurance` 复用既有 `CFG.chips` / `CFG.insuranceSource` 体系。
- 赛季奖励**发放时机**：达到 `unlockAtLv` 时发（建议；具体领取表单 / 手动领取待定，见 §7）。

---

## 5. 存档口径

### 5.1 现状（占位期）

- `SeasonState` 为**纯内存态**，**不落盘**（`js/modes.js:687` 注释明确：「内存态，占位期不落盘；赛季正式上线再接 Meta 存档」）。
- 因此重开页面赛季进度归零 —— 属**已知占位行为**，非缺陷。

### 5.2 正式上线口径（建议）

| 项 | 建议 | 备注 |
| ---- | ---- | ---- |
| 存档载体 | 并入 `Meta` 存档（局外存档），**不新增独立存档键** | 沿用既有 `Meta.data`（见 `game_design_proposal.md` §20.10） |
| 存档字段 | `seasonLv` / `seasonExp` / `_weeklyProgress` / 已领奖励 id 集 | 与 `SeasonState` 字段一一对应 |
| 周重置 | 按**自然周**（周一 00:00）判定，跨周则 `resetWeekly` | 需记录「上次重置周次」时间戳做比较 |
| 与 D013 的关系 | 赛季存档**不等于**技能构筑存档 —— D013 定「技能构筑每局重置」，与赛季长线进度**互不冲突** | 参考 `decision_log_v1.md` D013 |
| 迁移 | 复用 `SkillSave` 工具族的 `serialize` / `migrate` / `saveTo` / `loadFrom` 思路（模块已具备，无宿主调用，见 D034） | 可作为未来赛季存档的复用对象 |

> ⚠️ 正式接存档前必须走正常决策流程（改 `Meta` 结构 = 存档兼容性变更）。

### 5.3 难度曲线口径（主线 20 关 + 21~99 外推）

- **主线难度真源** = `CFG.levelCurve.rows`（**1~20 关逐行手调 + 21~99 关数据驱动生成**，共 **99 行**；字段 `countMul` / `hpMul` / `hazard` / `supply` / `chest`），见 `js/config.js`。
- **第 21~99 关外推规则（本稿口径；内容已由 D037 落库，展开版见 `main_levels_21_99_design_v1.md`）**：
  1. `hpMul` 严格沿 `1 + (lv − 1) × 0.12`（对齐怪物等级成长口径，`js/config.js:110` 注释）。
  2. `countMul` 沿第 9/10 关斜率 **+0.15 / 关**线性外推（`lv ≥ 11` 起）。
  3. `hazard` / `supply` 默认 `null`（机制关总数维持既有 5 关，不随关卡线性叠加）。
  4. `chest` 延续后期档 `CT4`（高阶占比不回落）。
  - 上述 4 条与现有 11~20 关外推**同口径**（`js/config.js:2448~2461`），21 关以后只是**同一规则的延续**。
- **赛季本身的难度**：赛季玩法为无限地图，难度与主线关卡解耦，**不读 `levelCurve.rows` 之外的新表**。

---

## 6. 与永续内容的关系

| 内容 | 关系 | 说明 |
| ---- | ---- | ---- |
| **主线（1~99 关）** | 前置 + 并列，**不冲突** | 赛季在**通关 20 关后**开放；主线仍可继续推进，赛季是**长线承载**，不改主线关卡内容 |
| **无尽 / 深渊** | 并列，**不冲突** | 无尽为局内无限模式，赛季为**局外长线目标**；二者经验 / 货币口径独立（赛季经验只在赛季内生效） |
| **局外成长（进化结晶）** | 复用，不新增货币 | 赛季奖励产出的结晶并入既有局外成长（见 §4.2） |
| **技能构筑（D013）** | 正交 | 技能构筑每局重置，与赛季长线进度互不影响 |
| **本周 / 下周** | 周任务刷新 | `resetWeekly` 每周一刷新三条周任务（见 §3.2） |

> **一句话**：赛季 = 「主线打通后的**周更目标层**」；它消耗主线/无尽的产出，并反过来给局外成长**补长线产出**，与既有模式**互不抢占**。

---

## 7. 落库字段与待办

### 7.1 `CFG.season` 结构（D033 落库 + D035 扩展）

```js
/* 赛季配置（唯一来源；js/modes.js 的 SEASON_CFG 改为从此读取，保留同名变量与数值兜底） */
CFG.season = {
  maxLv: 10,
  expBase: 1000,
  expStep: 200,
  weekly: { killGoal: 200, extractGoal: 3, levelUpGoal: 10 },
  /* 经验来源落库值（D035）：普通击杀 +10 / 精英·Boss 击杀 +40 / 局内升级 +200 / 成功撤离 +500 */
  expGain: { kill: 10, eliteKill: 40, levelUp: 200, extract: 500 },
  rewards: [ /* SR001~SR005，unlockAtLv 1/3/5/7/10，见 §4.1 落库表 */ ],
  /* 对抗挑战（D035）：复用深渊世界 + G.seasonRun 标记，见 §2.5 */
  challenge: { world: "endless", flag: "seasonRun" },
  unlock: { afterLevels: 20 /* 主线通关 20 关后开放 */ }
};
```

- **行为不变**：`js/modes.js` 的 `SEASON_CFG` 保留同名变量，值从 `CFG.season` 读取（数值兜底），现有 `SeasonState` / `season_test.js` 行为零变化。

### 7.2 待办（本轮不做，登记备查）

| # | 待办 | 归属 | 状态 |
| ---- | ---- | ---- | ---- |
| 1 | ~~主线完成度 → 赛季开放判定接线（`unlock.afterLevels`）~~ | 工程 | ✅ **已完成（D035）**：`SeasonState.isUnlocked()` |
| 2 | ~~击杀 / 局内升级 → `addExp` + `addWeeklyProgress` 双端接线~~ | 工程 | ✅ **已完成（D035）**：`onKill` / `onLevelUp` / `onExtract` |
| 3 | 赛季奖励领取表单**细化**（`claimReward` 已实现；表单交互 / 文案待打磨） | 策划 + 工程 | 🟡 **保留**（奖励条目已落库，表单细化待做） |
| 4 | 赛季进度落盘（并入 `Meta`） | 工程 + 决策 | 🟡 **保留**（内存态，见 §5） |
| 5 | ~~赛季独立玩法循环（无限地图）~~ | 设计 | ✅ **已完成（D035）**：复用深渊 + `G.seasonRun`（见 §2.5） |
| 6 | ~~21~99 关关卡内容~~ | 设计 | ✅ **已完成（D037）**：数据驱动外推（见 `main_levels_21_99_design_v1.md`） |

---

## 8. 结论

- **已定（D033）**：赛季等级 / 经验曲线 / 周任务 / 经验来源 / 奖励结构 / 存档口径 / 与永续内容关系。
- **已实现（D035）**：**赛季对抗玩法循环**（入口/计分/奖励/挑战，见 §2.5）+ 三类事件双端计分 + `SR001~SR005` 领取 + `CFG.season.expGain/rewards/challenge` 落库。
- **落库**：`CFG.season`（唯一来源）+ `js/modes.js`（`SeasonState` 扩展）+ 本文档（设计真源）。
- **待用户审**：`rewards` 条目文案与 `amount`（§4.1）、全部原型数值（§2 / §6.2）、领取表单细化形态（§7.2）。
- **本轮不做**：落盘存档（内存态）、领取表单细化。
- **另由 D037 落库**：21~99 关关卡内容（数据驱动外推，设计真源 = `main_levels_21_99_design_v1.md`）。

---

**本设计由 AI 出稿；数值与奖励条目待用户事后审；未审前不改任何 `js/*`。**
