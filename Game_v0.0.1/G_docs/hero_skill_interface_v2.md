# 英雄技能迁移 · 接口冻结 v2.0（H007~H012：附加效果 + 召唤）

> 状态：**已冻结（2026-10-12）** ｜ 依据：**决策 `D012`**（用户拍板「AI 直接给设计」）
> 前置：`hero_skill_interface_v1.md`（v1 已冻结 H001~H006 的承载位置与字段白名单）。**本文件只做增量，不重复 v1。**
> 校验真源：`js/skill-config.js`（所有白名单以该文件为准）｜ 编译真源：`js/skill-compiler.js` ｜ 运行真源：`js/skill-runtime.js`

---

## 0. 🔴 重大实测纠正（**先说结论，推翻 v1 的判断**）

v1 §0 写「H007~H012 是非伤害效果，当前模板系统无法表达，必须扩 **6 种模板**」——**实测后该结论不成立**。

读旧技能表 `CFG.skills`（`js/config.js:1340~1422`）发现：
- 旧设计里 **AT120 嘲讽 / AT122 治疗 / AT123 光环 / AT124 护罩 全部是「范围伤害 + 附加效果」**。原文注释：「效果 = 半径内敌人强制攻击施法者…**同时造成一次小额 AOE 伤害（全局口径：所有主动技能都必须有伤害）**」。
- **AT114 大地雷** = 延迟触发 → 引爆范围伤害（**仍是伤害**）。
- **只有 AT113 召唤无人机** 是真正「无伤害」的（效果是召唤物本体）。

| 英雄 | 旧技能 | 新表达 | 需要的新能力 |
|---|---|---|---|
| H008 陷阱师 | AT114 大地雷 | `instantArea`（伤害）+ `effect.kind:"trap"` | **仅需 `effect` 字段** |
| H009 守护者 | AT120 嘲讽战吼 | `instantArea`（伤害）+ `effect.kind:"taunt"` | **仅需 `effect` 字段** |
| H010 医疗兵 | AT122 生命脉冲 | `instantArea`（伤害）+ `effect.kind:"heal"` | **仅需 `effect` 字段** |
| H011 圣歌者 | AT123 鼓舞光环 | `instantArea`（伤害）+ `effect.kind:"aura"` | **仅需 `effect` 字段** |
| H012 灵能者 | AT124 灵能护罩 | `instantArea`（伤害）+ `effect.kind:"barrier"` | **仅需 `effect` 字段** |
| H007 召唤师 | AT113 召唤无人机 | **新模板 `summonUnit`**（无伤害） | **新模板 kind + `damageBasis` 条件必填** |

> **结论：新增「1 个模板 kind + 1 个可选节点字段」即可，不是 6 个模板。**
> 这也再次印证 `skill_system_master_v1.md` §0 铁律 3：**本项目没有的东西不要当成已实现；文档结论必须回查代码**——v1 的「6 种模板」是**未读旧表的推断**，属误判，本条即为更正。

---

## 1. 模型延伸 A：节点新增**可选**字段 `effect`

### 1.1 契约

```
节点（node）字段白名单（v2 增量）：
  nodeId, templateId, role, tags, capabilities, parameters, damageBasis, hitPolicyId, effect
                                                                              ↑ 新增
effect 字段白名单（`_FIELDS.effect`）：
  kind,
  healBase, healPerAdd, scaleStat, scalePct,
  auraDuration, auraPct, auraStats,
  barrierDuration, barrierDef,
  tauntDuration,
  armDelay, trapCount,
  summonId, summonCount, summonDuration
```

**向后兼容铁律**：`effect` **缺省 = 纯伤害**（与 v1 的 H001~H006 完全一致，不影响既有 6 技能与全部既有测试）。

### 1.2 四种「伤害 + 附加效果」（配 `TP_INSTANT_AREA`）

| `kind` | 语义 | 必需字段 | 可选字段 |
|---|---|---|---|
| `heal` | 范围伤害后，回复**全队**生命 | `healBase`(nonneg) | `healPerAdd`(nonneg)、`scaleStat`、`scalePct`(nonneg) |
| `aura` | 范围伤害后，给**全队**加限时增益 | `auraPct`(nonneg)、`auraDuration`(pos) | `auraStats`(字符串数组)、`scaleStat`、`scalePct` |
| `barrier` | 范围伤害后，给**全队**加限时护罩（防御提升） | `barrierDef`(nonneg)、`barrierDuration`(pos) | `scaleStat`、`scalePct` |
| `taunt` | 范围伤害后，强制半径内敌人**攻击施放者** | `tauntDuration`(pos) | `scaleStat`、`scalePct`（作用于半径） |

- `scaleStat` 白名单：`atk` / `def` / `spd` / `energyMax`（与旧表 `scaleBy.stat` **同源**）。
- 效果量公式（**与旧实现同源，不发明**）：`最终值 = 基础值 + 施放者[scaleStat] × scalePct × 等级系数`，其中 `等级系数 = 1 + (lv-1) × CFG.skillScaleBy.levelGrowth`。

### 1.3 两种「独立效果」

| `kind` | 配用模板 | 语义 | 必需字段 |
|---|---|---|---|
| `trap` | `TP_INSTANT_AREA` | 施放时**不立即生效**；布设延迟 `armDelay` 秒后激活，敌人进入半径即引爆（= 一次 `instantArea` 结算） | `armDelay`(nonneg) |
| `summon` | **`TP_SUMMON_UNIT`** | 召唤 `summonCount` 个召唤物协战 `summonDuration` 秒 | `summonId`(字符串)、`summonCount`(count) |

---

## 2. 模型延伸 B：新模板 kind `summonUnit`

`TP_SUMMON_UNIT`（**唯一新增模板**，非伤害类）：

| 参数 | 约束 | 说明 |
|---|---|---|
| `orbit` | `pos` | 召唤物环绕半径（px）|
| `hp` | `pos` | 每个召唤物生命 |
| `atk` | `pos` | 每个召唤物攻击 |
| `fireCd` | `pos` | 召唤物攻击间隔（秒）|

- `capabilities`：`summonUnit`、`orbitContact`（复用环绕运动）
- `tags`：`召唤物`
- 🔴 **非伤害模板集合** `_NON_DAMAGE_KINDS = { summonUnit: 1 }`：只有该集合内的节点允许 `damageBasis` 缺省。

---

## 3. 校验层变更（`js/skill-config.js`）—— 5 处

| # | 位置 | 变更 |
|---|---|---|
| 1 | `_FIELDS.node` | 追加 `"effect"` |
| 2 | 新增 `_FIELDS.effect` | 见 §1.1 字段清单 |
| 3 | 新增 `_EFFECT_KINDS` | `{ heal:1, aura:1, barrier:1, taunt:1, trap:1, summon:1 }` |
| 4 | `_TEMPLATE_KINDS` | 追加 `summonUnit: { orbit:"pos", hp:"pos", atk:"pos", fireCd:"pos" }` |
| 5 | `_PARAM_RULES` | 追加 `healBase:"nonneg" healPerAdd:"nonneg" scalePct:"nonneg" auraPct:"nonneg" auraDuration:"pos" barrierDef:"nonneg" barrierDuration:"pos" tauntDuration:"pos" armDelay:"nonneg" trapCount:"count" summonCount:"count" summonDuration:"pos"` |
| 6 | 新增 `_NON_DAMAGE_KINDS` + `_validateNode` 改为**条件必填** | `damageBasis` 仅在模板 kind ∉ `_NON_DAMAGE_KINDS` 时必填 |
| 7 | 新增 `_validateEffect(e, did, nodeId, D, caps, tags)` | 校验 `kind` ∈ `_EFFECT_KINDS`；`_allowFields`；按 kind 校验必需字段；`scaleStat` ∈ 白名单；`auraStats` 为字符串数组 |

> ⚠️ 变更 6 是**唯一放宽**的既有硬约束。必须保证：**既有 4 种模板（投射物/环绕/瞬时/持续）的 `damageBasis` 仍然强制必填**——用「非伤害集合」做白名单，不用黑名单。

---

## 4. 编译层变更（`js/skill-compiler.js`）—— 2 处

| # | 位置 | 变更 |
|---|---|---|
| 1 | `~794`「节点缺少原始伤害基准引用」 | 按模板 kind 放宽：非伤害类节点跳过 `bref` 校验 |
| 2 | 派生 / `convertNode` | `effect` 视为**节点自定义字段**，随节点克隆透传；`convertNode` **不重置** `effect`（与重置形态参数区分） |

---

## 5. 运行时变更（`js/skill-runtime.js`）—— 末尾独立区块（遵循 AGENTS 铁律 2）

新增**文件末尾独立区块**（不插改现有函数的函数体，只在命中结算后插**单行调用**）：

```js
/* ===== v2 附加效果派发（H007~H012）· 末尾独立区块 ===== */
SkillRuntime._applyEffect = function (world, eff, target, simTime) { ... }
```

- **接线点**：`_applyDamage`（`js/skill-runtime.js:867`）末尾**单行** `if (eff.effect) SkillRuntime._applyEffect(world, eff, target, simTime);`
- **各 kind 的实现落点**（**全部复用旧系统已有机制，不发明新玩法**）：

| kind | 落点 | 依据 |
|---|---|---|
| `heal` | 回复 `aliveHeroes()` 全体 HP | 旧 AT122「回复全队生命」（`combat.js` 治疗路径） |
| `aura` | 写 `G.run.buffs`（带动态 mul、不带 skillId，限时） | 旧 AT123，见 `js/config.js:1562` 注释 |
| `barrier` | 同上，防御加成项 | 旧 AT124 |
| `taunt` | 设 `monster.tauntedBy = 施放者; monster.tauntT = 秒` | 旧 AT120，见 `js/config.js:1370` 注释（`Monster.update` 已支持） |
| `trap` | 延迟 `armDelay` 后创建 `instantArea` 实例 | 旧 AT114（`armDelay:0.5`） |
| `summon` | 复用无人机实体（`CFG.skills2.repairDrone`） | 旧 AT113 |

> 🔴 **重复计数护栏**：`effect` 必须与五类命中额度**同键**（`castId|ownerId + 模板组 + targetId`），一次施放对同一目标**只触发一次效果**（复用 `skill-damage.js` 的额度账本，不另建计数器）。

---

## 6. 迁移映射表（H007~H012）

| 英雄 | 新技能 id | nameKey | 模板 | 主参数（迁移基准 = 旧表）| `effect` |
|---|---|---|---|---|---|
| H007 召唤师 | `SK_DRONESWARM` | `skill.droneswarm` | `TP_SUMMON_UNIT` | `orbit 66→90` / `hp 40→260` / `atk 6→48` / `fireCd 0.8→0.5` | `{ kind:"summon", summonId:"DRONE_REPAIR", summonCount:3, summonDuration:∞ }` |
| H008 陷阱师 | `SK_MINEFIELD` | `skill.minefield` | `TP_INSTANT_AREA` | `radius 110→180` | `{ kind:"trap", armDelay:0.5, trapCount:1→3 }` |
| H009 守护者 | `SK_TAUNTROAR` | `skill.tauntroar` | `TP_INSTANT_AREA` | `radius 180→340`（+防御加成）| `{ kind:"taunt", tauntDuration:4, scaleStat:"def", scalePct:0.02 }` |
| H010 医疗兵 | `SK_LIFEPULSE` | `skill.lifepulse` | `TP_INSTANT_AREA` | `radius 150→260` | `{ kind:"heal", healBase:18, healPerAdd:1.0, scaleStat:"atk", scalePct:0.04 }` |
| H011 圣歌者 | `SK_WARSONG` | `skill.warsong` | `TP_INSTANT_AREA` | `radius 160→250` | `{ kind:"aura", auraPct:0.08, auraDuration:10, auraStats:["atk","spd"], scaleStat:"def", scalePct:0.01 }` |
| H012 灵能者 | `SK_PSYSHIELD` | `skill.psyshield` | `TP_INSTANT_AREA` | `radius 140→240` | `{ kind:"barrier", barrierDef:4, barrierDuration:12, scaleStat:"energyMax", scalePct:0.008 }` |

- 伤害基准：`damageBasis = { baseRef:"hero.atk", coefficient: <旧 dmgMul>, inheritFactorKeys:[] }`（旧表 `dmgMul` 直接搬运）。
- H007 无伤害 → **不写 `damageBasis`**（依赖 `_NON_DAMAGE_KINDS`）。
- 全部落地后：`initialSkillBindings` 增至 12 条，`migratedHeroIds` = `["H001".."H012"]`。
- `localization` 需新增 6 条 `skill.*`（否则 `PLACEHOLDER_TEXT`）。

---

## 7. 五处同步清单与实施拆分（**并行依据**）

**五处同步**（新底层机制的固定成本，源自 v1 §5）：
`skill-config.js`（白名单/校验）→ `config.js`（模板 + 技能 + 文案 + 绑定）→ `skill-compiler.js`（认识 kind）→ `skill-runtime.js`（执行）→ 新测试 + 现状记录型断言同步。

### 批 2A（**低风险，先做**）：H009 / H010 / H011 / H012
- 只用到既有模板 `TP_INSTANT_AREA` + 新 `effect` 字段（4 类附加效果）。
- 改动集中在 4 处：`_FIELDS.node` 加 `effect`、`_EFFECT_KINDS`、`_validateEffect`、runtime 末尾派发。
- **不做**新模板 → 不触碰 `_TEMPLATE_KINDS`、不触碰 `damageBasis` 必填规则 → **零回归风险**。

### 批 2B（**高风险，后做**）：H008 trap / H007 summon
- 需要新模板 `summonUnit` + `_NON_DAMAGE_KINDS` + `damageBasis` 条件必填（**放宽既有硬约束**）+ runtime 延迟生成与召唤实体。
- 必须单独补：**回归测试**证明「4 种既有模板的 `damageBasis` 仍然强制必填」。

### 并行切分（严格按文件所有权）
| 路 | 独占文件 | 内容 |
|---|---|---|
| **主会话**（串行） | `js/skill-config.js`、`js/config.js`、`js/skill-compiler.js`、`js/skill-runtime.js`、`index.html`、`run_tests.sh` | 全部共享文件；schema 先冻结再放行下游 |
| 代理 A | **新建** `hero_nondamage_skill_test.js` | 批 2A 的守卫测试（结构铁律 + 效果字段合同） |
| 代理 B | **新建** `skill_effect_runtime_test.js` | runtime 派发的行为测试（黑盒，直读真实 CFG） |
| 代理 C | **新建** `G_docs/skill_effect_balance_v0.1.md` | 效果数值锚点提案（heal/aura/barrier/taunt 的 Lv1/Lv50/Lv100） |

> ⚠️ **前提**：主会话先完成 §3 的 schema 变更并跑绿，代理才可按冻结字段名写测试。**跳过冻结 = 必冲突**（v1 五处同步的教训）。

---

## 8. 风险与待平衡

1. 🔴 **`damageBasis` 条件必填是唯一放宽的硬约束**（批 2B）——必须用「非伤害集合白名单」而非黑名单，并补回归测试。
2. 🟠 **`taunt` 依赖 `Monster.update` 的既有支持**（`tauntedBy/tauntT`）——需实测确认字段仍在位，否则先补。
3. 🟠 **`summon` 复用无人机实体**（`CFG.skills2.repairDrone`）——需确认该实体是否已迁入新路径可复用；若耦合旧路径，H007 落后到批 2C。
4. 🟡 **效果数值全为迁移占位**（沿用旧表数值），**未平衡**；平衡表见 `skill_balance_table_v0.1.md`。
5. 🟡 **`auraStats` 的 `spd`** 需确认角色移速加成入口（旧 AT123 已实现，落点待核）。
