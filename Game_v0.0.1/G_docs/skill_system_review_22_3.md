# 技能系统复核报告 · 22.3（两条核心规则自检）

> 🔤 **命名（2026-10-12 统一）**：本文的「技能系统 / 水晶」= **能量水晶系统**（代码 `CFG.skillSystem` / `CR_*`）。命名规范见 `skill_system_master_v1.md` §0.5。

日期：2026-10-12。版本：**20261040**。提交：待提交。
复核对象：`js/skill-*.js` 9 模块 + `js/skill-playtest.js` + `js/config.js` 的 `CFG.skillSystem` + `game.js` / `main.js` / `render.js` 接入点。

复核口径（用户指定）：
1. **武器绑定 1 个「初始主动技能」**（无普攻）
2. **4 颗水晶同时影响 初始技能 + 稀有技能**

---

## 一、结论速览

| 规则 | 真源 | 结论 |
|---|---|---|
| 武器绑定唯一初始主动技能 | `CFG.skillSystem.initialSkillBindings[heroId] = { weaponId, skillId }` | ✅ 成立（H001→W001 速射炮→`SK_FIREBALL`，单值） |
| 无普攻 | `CFG.basicAttack.removed = true` | ✅ 成立 |
| 4 水晶同时影响初始 + 稀有技能 | 编译期「逐技能 × 共享水晶组」 | ✅ 成立（同一颗水晶可对两技能同时 applied，只占 1 槽） |
| 每颗水晶至少对一个技能有收益 | `_checkPurpose` → `EXISTING_CRYSTAL_INACTIVE` | ✅ 成立（否则整组拒绝，不静默失效） |
| 稀有技能由雕像至多给 1 个 | `CFG.skillSystem.rareSkillPool` + `RP_STATUE` | ✅ 成立（重复雕像转其他奖励） |

**本轮新发现并修复 2 处跨模块缺陷**（第 9、10 个缺口，与 22.x 冷却字段名同类）：
索敌范围 `maxRange` 与无目标施放 `requiresTarget` 的字段名不匹配 → 文档承诺的两条行为在真实配置下**静默失效**。

**另有 4 处缺口已定位、未改动**（需策划/用户拍板，见 §四）。

---

## 二、规则 1 复核明细

| 检查项 | 位置 | 结果 |
|---|---|---|
| 绑定表结构 | `config.js` `CFG.skillSystem.initialSkillBindings` | ✅ 键=英雄 id，值=`{weaponId, skillId}`，`skillId` 为**单值字符串** |
| 武器可溯源 | `CFG.weapons.W001` = 速射炮 | ✅ 存在 |
| 技能定义存在 | `CFG.skillSystem.skillDefs.SK_FIREBALL` = 火球 | ✅ 存在 |
| 无普攻 | `CFG.basicAttack.removed` | ✅ `true`（条目保留供敌人复用，英雄侧发射路径关闭） |
| 技能上限 | `maxSkillsPerHero: 2` | ✅ 初始 + 至多 1 稀有 |
| 注入口径 | `SkillPlaytest._presetFor()` | ✅ 只注入 1 个技能，且**取自绑定真源**（非硬编码） |
| 编译产物 | `SupportCompiler.compile` | ✅ 只产出 1 张技能图（无凭空多出的普攻/第二技能） |
| 旧技能停用 | `game.js:297`（玩家）/ `game.js:495`（队友）`skillV2Owns` 闸门 | ✅ 迁移英雄 `return` 跳过旧施放，未迁移英雄零影响 |

**注意（口径）**：绑定表当前**只登记 H001**。`?skill=H002` 等参数会走「回落 = `skillDefs` 字典序第一个」= 火球，**不是该英雄武器绑定的技能**。这是「未迁移英雄的试玩回落」，不是正式规则；正式迁移某英雄时必须先把它的绑定写进 `initialSkillBindings`。

---

## 三、规则 2 复核明细

| 检查项 | 位置 | 结果 |
|---|---|---|
| 一图一技能 | `skill-compiler.js` `compile()` → `_buildSkillGraph(state, sid)` | ✅ 逐技能建图，每图都读**同一份** `state.crystals` |
| 同一颗水晶作用于两技能 | `_explainCrystalSkill` | ✅ `CR_ARCANE_AMP`（`tagsAny:["魔法"]`）对 `SK_FIREBALL` 与 `SK_SHOCKWAVE` 同时 `applied` |
| 只占 1 槽 | `state.crystals` 共享 | ✅ 4 水晶 = 4 槽，不因两技能翻倍 |
| 共享快照 | `builds[sid].crystals` | ✅ 两技能图的水晶快照同源同序 |
| 槽位排列无关 | `_byCrystalId` 全序 + `signature` | ✅ 打乱 slot 后 signature 与解释完全一致 |
| 用途保护 | `_checkPurpose` | ✅ 水晶对全部技能无收益 → `EXISTING_CRYSTAL_INACTIVE` 整组拒绝，且能定位到具体水晶 |
| 稀有技能授予 | `SkillReward.rollStatueGrant` → `SkillPlaytest._installRareSkill` 重编译 | ✅ 授予 1 个 → 重编译通过 → 4 水晶对两技能关系不变 |
| 重复雕像 | `duplicateStatueHandling: "fallback"` | ✅ 已 2 技能时不再授予第三个 |

**如实口径（重要）**：「4 颗水晶同时影响两个技能」= **同一组水晶被两个技能分别判定**（v0.5 §1「每颗水晶分别判断两个技能，符合的都强化」）。
不是「4 颗都对两个技能都生效」——形态不匹配的水晶对另一技能会如实标 `inactive`：

| 水晶 | 火球（飞行弹） | 震荡波（瞬时范围） |
|---|---|---|
| 奥术增幅（魔法 tag） | applied | **applied** |
| 贯穿（pierceCounter） | applied | inactive |
| 追踪（homing） | applied | inactive |
| 扇射（multishot） | applied | inactive |

这也是首轮水晶池**刻意避开「扩域」**的原因：扩域只对范围类生效，若把它放进只玩火球的初始配装，
则它对初始技能零收益 → 整组编译直接失败。

---

## 四、本轮修复的 2 处缺陷（跨模块缺口 9、10）

| # | 缺陷 | 根因 | 修复 |
|---|---|---|---|
| 9 | **索敌范围静默失效**（退化为全图锁敌） | 调度器读 `tp.range`，配置真源（且被校验器强制）是 `targetPolicies[].maxRange` | `SkillScheduler.rangeOf()`：**maxRange 优先**，兼容旧短名 `range` |
| 10 | **环绕类「无目标可施放」永久失效** | 调度器读 `cp.allowNoTarget`，配置真源是 `castPolicies[].requiresTarget`（false = 允许无目标） | `SkillScheduler.allowNoTargetOf()`：**requiresTarget 优先**，兼容旧短名 |

**为什么门禁没抓到**：`skill_scheduler_test` / `skill_runtime_test` 用**自造桩**写的是 `allowNoTarget`，
与调度器读取的字段名一致 → 桩内自洽、恒绿；真实 `CFG.skillSystem` 用的是 `requiresTarget`。
即「测试对着合成契约断言，而非真实配置」。本轮新增自检测试**直接读真实配置**，堵住这个口子。

**行为实证（修复前 → 修复后）**：

- 修复前：敌人放在 3800px 外（配置 `maxRange: 520`）→ 仍施放（生成效果 6）❌
- 修复后：同样场景 → 零施放 ✅；范围内（300px）照常施放并结算 ✅
- 修复后：无目标时 `requiresTarget:true` 技能保持就绪（不空放）✅；`requiresTarget:false` 技能照常施放 ✅

契约同步：`G_docs/skill_system_interface_v1.md` §四 增补策略表字段名冻结说明（防后续波次重犯）。

---

## 五、已定位、未改动的缺口（待拍板）

| # | 缺口 | 影响 | 建议 |
|---|---|---|---|
| 11 | `routePolicyId` 未从「水晶操作 → 派生节点 → 事件」传递 | `eventPolicies`（`EP_DERIVED_ONCE` 的 sourceWhitelist/maxCount=4/perCastBudget=8）**整表不生效**，退化为保守默认（maxCount=1）。派生仍能正确生成（走 `templateId` 桥接） | 补 2 处传递即可生效；**但会把 maxCount 由 1 变 4 → 派生数量变化**，属数值变更，需先确认 |
| 12 | 环绕路径参数未接线 | `convertNode` 保留旧投射物参数 → 环绕 `orbitRadius` 取到 8（应为 70）、`contactRadius` = 0、数量读 `count` 而非 `CR_ORBIT` 声明的 `orbitCount` | 需先定「转换后参数重置还是叠加」的口径 |
| 13 | `H001 初始技能`数值与旧「能量爆发」不一致 | 旧 `AT102`：`cd 1.8s / dmgMul 1.5 / radius 130`；新 `SK_FIREBALL`：`cooldown 0.90 / coefficient 1.4 / 无爆炸节点`。v0.5 §10 要求「读取当前英雄有效伤害/冷却作为迁移基准」 | 建议把 `SK_FIREBALL.levels` 对齐 `AT102` 基准并补爆炸派生，属**数值/玩法变更** |
| 14 | `SkillConfig.validate` 未覆盖新字段 | `initialSkillBindings` / `maxSkillsPerHero` / `rareSkillPool` / `features` / `slotCount` 无校验（写错不会报错） | 可选补校验规则 |
| 15 | `castTime` 施法前摇未接线 | 首轮已知遗留（接口文档已登记） | 待接线 |
| 16 | `SkillRuntime` 调 `damageMonster` 未传 `killer` | 迁移英雄伤害不计入**逐角色战绩/深渊榜**（金币/经验/击杀数不受影响） | 1 行修复，但会改变战绩归属 |
| 17 | 装配 / 详情 UI 屏未接 DOM | `SkillPresenter.panel/detail` 已就绪但无屏呈现（H001 详情面板仍显示旧「能量爆发」） | 待接线 |

---

## 六、本轮改动清单

| 文件 | 改动 |
|---|---|
| `js/skill-scheduler.js` | 新增 `rangeOf` / `allowNoTargetOf`（配置真源优先 + 旧短名兼容）；`tick()` / `intervalFor()` 改用之（200→220 行） |
| `skill_rule_binding_test.js` | **新增**自检（53 断言）：规则 1 真源+行为 / 规则 2 真源+结构+保护+流程 / 修复项回归 / 接线静态校验（363 行） |
| `run_tests.sh` | `SKILL` 套件注册 `skill_rule_binding_test` |
| `G_docs/skill_system_interface_v1.md` | §四 增补策略表字段名冻结（`maxRange` / `requiresTarget`） |
| `index.html` / `js/core.js` | 构建版本 20261039 → **20261040** |
| `G_docs/dev_guide.md` | 本轮次表 + §22.3 口径 |

**门禁**：全量 **90 套 / PASS 合计 = 3895 / bad = 0 / 全绿**（原 3842 → +53）。

---

## 七、自检覆盖（`skill_rule_binding_test.js`）

| 段 | 断言要点 |
|---|---|
| ① | 绑定表单值 / 武器溯源 / 技能存在 / 无普攻 / 上限 2 / 槽位 4 / 稀有池非空 / 试玩只注入 1 技能且取自绑定 / 单技能编译只出 1 图 |
| ② | 分流闸门静态存在 / 迁移=true 未迁移=false 无 id=false / 默认熄火 |
| ③ | 两技能+4 水晶编译 ok / 同一水晶对两技能同时 applied / 只占 1 槽 / 不匹配如实 inactive |
| ④ | 两技能共享同一组水晶快照 / 槽位排列不改变 signature 与解释 |
| ⑤ | 水晶对全部技能无收益 → 整组拒绝 + 定位到具体水晶 |
| ⑥ | 雕像授予 1 个 → 重编译 2 技能 → 4 水晶仍同时作用 / 共享同一组水晶 / 重复雕像不重授 / 上限 SLOTS_FULL |
| ⑦ | `maxRange` / `requiresTarget` 真源读取 / 旧短名兼容 / **3800px 不索敌** / 范围内照常施放结算 / 无目标时两种策略行为 |
| ⑧ | 主循环与叠加层接线 / index.html 脚本序 / 配置默认仍熄火 |
