# 英雄技能迁移 · 接口冻结 v1.0（12 英雄走新路径）

> 状态：**已冻结（2026-10-12）** · 适用范围：`CFG.skillSystem.skillDefs` 新增技能定义
> 前置真源：设计 `design_crystal_skill_system_v0.5.md` · 工程 `skill_system_development_contract_v1.0.md`（**优先**）· 接口 `skill_system_interface_v1.md`
> 校验真源：`js/skill-config.js`（`SkillConfig.validate`，本文所有白名单以该文件为准）

---

## 0. 一句话结论（先说风险）

**11 个英雄不是「都写一份技能定义」就能全迁移。**

- 新系统当前只支持 **4 种效果模板类型**：`flightProjectile` / `orbitContact` / `instantArea` / `persistentArea`。
- H002~H006 的旧主动技能全部是 **投射物 / 范围** 类 → **可直接迁移**（本批交付）。
- **H007~H012 的旧主动技能是召唤 / 陷阱 / 嘲讽 / 治疗 / 光环 / 护罩** → 当前模板系统**无法表达**（每个节点都强制要求 `damageBasis`），必须**先扩模板类型**才能迁移。

| 英雄 | 定位 | 旧武器 | 旧主动技能 | 旧技能形态 | 可迁移？ |
|---|---|---|---|---|---|
| H001 猎手 | output | W001 速射炮 | AT102 能量爆发 | bullet + 爆炸 | ✅ 已完成（SK_FIREBALL）|
| H002 散弹手 | output | W002 散射炮 | AT104 震荡波 | bullet | ✅ 本批 |
| H003 穿甲者 | output | W003 磁轨步枪 | AT106 贯穿射线 | bullet（穿透）| ✅ 本批 |
| H004 弹射手 | defense | W004 跳弹枪 | AT108 环形弹幕 | bullet ×8 | ✅ 本批 |
| H005 快枪手 | defense | W005 双生短枪 | AT110 疾风连爆 | bullet ×3 | ✅ 本批 |
| H006 重炮手 | output | W006 攻城重炮 | AT112 攻城爆破 | bullet + 大范围 | ✅ 本批 |
| H007 召唤师 | aux | W007 无人机母舰 | AT113 召唤无人机 | **summon** | ⛔ 需扩模板 |
| H008 陷阱师 | defense | W008 布雷器 | AT114 大地雷 | **trap** | ⛔ 需扩模板 |
| H009 守护者 | defense | W009 堡垒炮 | AT120 嘲讽战吼 | **taunt** | ⛔ 需扩模板 |
| H010 医疗兵 | aux | W010 生命枪 | AT122 生命脉冲 | **healNova** | ⛔ 需扩模板 |
| H011 圣歌者 | aux | W011 圣咏器 | AT123 鼓舞光环 | **aura** | ⛔ 需扩模板 |
| H012 灵能者 | aux | W012 灵能杖 | AT124 灵能护罩 | **barrier** | ⛔ 需扩模板 |

> 合同 §1 `features.summonMigration=false` 已明确「召唤 / 陷阱首轮不迁移」，与上表一致。

---

## 1. 承载位置（不得再讨论）

**技能定义 = 表 → 写在 `js/config.js` 的 `CFG.skillSystem.skillDefs` 里。**

- 理由①：项目惯例 —— `config.js` 是**表**（数据真源），独立文件是**模块**（逻辑）。技能定义是表。
- 理由②：80+ 个测试的 `FILES` 列表都内联加载 `js/config.js`；写进 config.js = **全部测试自动覆盖**。若拆成 `js/skills/sk_*.js`，需逐个改 80+ 测试的加载清单 → 高风险、零收益。
- 理由③：`index.html` 是共享文件（版本号 10+ 处），拆文件还要动它 → 违反「共享文件串行冻结」。

---

## 2. 技能定义字段白名单（**冻结**，来源 `js/skill-config.js` `_FIELDS.skill`）

```
id, nameKey, levels, baseGraph, targetPolicyId, castPolicyId, rewardPoolIds, detailKey
```

- 必需：`id / nameKey / levels / baseGraph / targetPolicyId / castPolicyId / rewardPoolIds`
- `nameKey` **必须**在 `CFG.skillSystem.localization` 里有对应非空中文（否则 `PLACEHOLDER_TEXT`）。

### 2.1 `levels`（用 `skillLevels()` 生成）
```js
skillLevels(SKILL_LEVEL_MAX,
  { cooldown: [Lv1, Lv100], castTime: [Lv1, Lv100] },   // 施放层
  { coefficient: [...], speed: [...], life: [...], radius: [...] },  // 浮点曲线 → row.parameters
  { count: [...], extraPierceCount: [...] });            // 整数步进 → row.parameters
```

### 2.2 `baseGraph.nodes[]` 字段白名单（`_FIELDS.node`）
```
nodeId, templateId, role, tags, capabilities, parameters, damageBasis, hitPolicyId
```
🔴 **节点上没有 `castPolicyId`**（施放策略只在技能层 / 水晶 op 上）。

### 2.3 三个强制契约（历史踩坑，逐条对应）
1. `node.parameters.moreDamageMul` **必须显式 = 1**（乘法归并基准缺省 0 → 伤害恒 0）。
2. 等级行的**浮点/整数曲线**会自动并入 **主节点**（`role:"primary"`）；**派生节点**（`role:"derived"`）的参数必须写在自己 `parameters` 里（22.4 #11）。
3. `damageBasis`：`{ baseRef:"hero.atk", coefficient:<数>, inheritFactorKeys:[...] }`，三字段必填。

### 2.4 `tags` 白名单（`_TAGS`，多一个 = `INVALID_REFERENCE`）
```
物理 魔法 投射物 范围 持续区域 环绕 爆炸 火焰 雷电 技能 主效果 派生
```

### 2.5 `capabilities` 白名单（`_CAPABILITIES`，多一个 = `INVALID_REFERENCE`）
```
flightProjectile orbitContact instantArea persistentArea
pierceCounter homing multishot split explosion
areaRadius hitEvent expireEvent motionResource regionTick projectileSweep
```

### 2.6 模板类型与参数约束（`_TEMPLATE_KINDS` / `_PARAM_RULES`）
| 模板 | 可填参数（约束）|
|---|---|
| `TP_FLIGHT_PROJECTILE` | speed(pos) life(pos) radius(pos) pierce(count) |
| `TP_ORBIT_CONTACT` | radius(pos) angularSpeed(pos) count(count) hitInterval(pos) |
| `TP_INSTANT_AREA` | radius(pos) life(pos) |
| `TP_PERSISTENT_AREA` | radius(pos) duration(pos) tick(pos) dps(nonneg) |

### 2.7 `hitPolicyId` 白名单（已有，按形态选）
```
HP_MAIN_BOLT  HP_SPLIT_CHILD  HP_EXPLOSION  HP_INSTANT_AREA
HP_ORBIT_CONTACT  HP_PERSISTENT_REGION  HP_DERIVED_AREA  HP_BOUNCE_CHILD  HP_CHAIN
```

### 2.8 策略引用（必须存在，否则 `INVALID_REFERENCE`）
- `targetPolicyId`：目前只有 `TGT_NEAREST`（`maxRange:520`）
- `castPolicyId`：`CAST_COOLDOWN`（需目标）/ `CAST_ORBIT`（无目标可施放）
- `rewardPoolIds`：`["POOL_LEVELUP"]`

---

## 3. 参考范式（照抄结构）

`SK_FIREBALL`（H001，主弹 + 命中爆炸）就是**唯一模板**：主弹 `role:"primary"` + 派生 `role:"derived"` + 一条 `onHit` 边。

---

## 4. 本批交付清单（H002~H006，已落库）

| 英雄 | 新技能 id | nameKey | 迁移基准 | 结构 |
|---|---|---|---|---|
| H002 | `SK_SCATTER` | `skill.scatter` | AT104 震荡波 | 主弹 ×3（扇形压制）|
| H003 | `SK_RAILGUN` | `skill.railgun` | AT106 贯穿射线 | 主弹 + 穿透计数 |
| H004 | `SK_RINGBARRAGE` | `skill.ringbarrage` | AT108 环形弹幕 | 主弹 ×8（环形）|
| H005 | `SK_VOLLEY` | `skill.volley` | AT110 疾风连爆 | 主弹 ×3（快速连爆）|
| H006 | `SK_SIEGEBLAST` | `skill.siegeblast` | AT112 攻城爆破 | 主弹 + 大范围爆炸（半径 190）|

绑定（`CFG.skillSystem.initialSkillBindings`）逐英雄新增；`migratedHeroIds` 扩到 `["H001".."H006"]`。

---

## 5. 下一批（H007~H012）必须做的扩模板工作

要迁移 6 个辅助/召唤英雄，必须先扩 **6 种模板类型**（每加一种 = 5 处同步）：
1. `js/skill-config.js` → `_TEMPLATE_KINDS` 加 kind + 参数约束；`_CAPABILITIES` 加能力；`_TAGS` 加标签
2. `js/config.js` → `effectTemplates` 加模板定义；`skillDefs` 加技能
3. `js/skill-compiler.js` → 编译阶段认识新 kind
4. `js/skill-runtime.js` → 运行时执行新 kind（召唤实体 / 陷阱布设 / 嘲讽 / 治疗 / 光环 / 护罩——**含非伤害效果，需扩 `damageBasis` 为可选**）
5. 新测试 + 现状记录型断言同步

⚠️ 其中 **治疗/光环/护罩是「非伤害效果」**，与当前「每个节点强制要求 damageBasis」的校验冲突 → 需要把 `damageBasis` 改为**按 kind 条件必填**。这是**架构变更**，须用户拍板后再动。
