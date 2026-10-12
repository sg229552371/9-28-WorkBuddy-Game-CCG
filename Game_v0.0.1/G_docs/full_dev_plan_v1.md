# 全量开发总纲 v1（「没开发的内容都要开发」施工地图）

> 建立 2026-10-12 ｜ 基线：`APP_VERSION 20261047` · `HEAD 1ab6f89` · 门禁 **4187 断言 / bad=0**
> 依据：`game_design_proposal.md` §12 待细化方向 / §18 状态说明 + `X-GAMe/review-report.md` 差异登记
> + `X-GAMe/task-cards.md` + `handoff-parallel.md` + 各管线实测
> **本文件只做「清点 + 排序 + 所有权」，不改任何规则；规则真源仍是原批准文档。**

---

## 0. 一句话结论

**能并行，但不能「全部同时开工」。** 「没开发的内容」实际是**三类性质完全不同的事**，
混在一起并行会互相踩踏；正确做法 = **先冻接口 → 分三轨并行 → 主会话串行接线 → 串行验收发布**。

---

## 1. 三类性质（决定「能不能并行」）

| 类 | 性质 | 谁做 | 能否并行 | 前置 |
|---|---|---|---|---|
| **A 工程闭环** | 代码缺口已定位，验收标准明确 | 主会话 + 独立文件代理 | ⚠️ **部分**（碰共享文件的不能） | 接口已存在 |
| **B 数值填表** | 规则已定，缺具体数字（策划活） | AI 提案 → 用户审 | ✅ **可以**（互不相干） | 无 |
| **C 玩法决策** | 规则本身还没定（玩法活） | **只能用户拍板** | ❌ **不能** | 用户决策 |

> 🔴 **本轮最大误区**：把 B/C 当成 A 直接开写 → 等于 AI 自己发明玩法与数值，违反「变更前确认 + 仅动指定项」。

---

## 2. 全量清单（实测校准，非照抄文档）

### A 类 · 工程闭环（可直接开工）

| # | 项 | 实测现状 | 落点 | 并行性 |
|---|---|---|---|---|
| A1 | **`killer` 伤害归属** | ✅ **已修**：`skill-damage.js:252` 早已透传；本轮补 `skill-runtime.js` 两处（`_applyDamage` 主路径 + `_fallbackDamage` 兜底）→ 技能伤害不再恒 `null`（深渊逐角色统计/吸血/裂变读 owner 恢复） | `js/skill-runtime.js` | ❌ 共享文件 |
| A2 | **资源清单接线** | ⚠️ **判定为「半个改动」，暂缓**：清单 15 条**磁盘存在 0**；且实测「清单侧 `AssetHooks` 真实消费点 = 0」→ 单个挂载 = 每局 15 个 404 + 零收益 + 打破 7 条现状断言。**必须连同渲染/音频消费接线一起做**（`Assets.images` / `SFX.play` 优先查 `AssetHooks`），且需素材就绪才有端到端验收条件 | `index.html` + `js/core.js` | ❌ 共享文件（整批） |
| A3 | **`SkillSave` 宿主闭环** | 模块本身完备（`serialize`/`migrate`/`saveTo`/`loadFrom`/`_persist`），**仅缺宿主调用** ❌；但「是否跨局保存 / 保存时机」**属设计决策未定** | `js/game.js` / `js/main.js` | ❌ 需先拍板 |
| A4 | **`castTime` 调度消费** | `config.js` 生成 + `skill-config.js` 校验；**调度器未读** ❌；前摇语义（能否被打断）**未定** | `js/skill-scheduler.js` | ⚠️ 需先定语义 |
| A5 | **全部 12 英雄技能** | ✅ **已全部交付（H001~H012 全走新路径）**：批 1（H001~H006，2026-10-12）+ 批 2（H007~H012，2026-10-12 · 决策 `D012`）——批 2 只需 1 个模板 kind（`summonUnit`）+ 1 个节点字段（`effect`），已拆 2A（H009~H012）/ 2B（H007/H008）全部实现 | `js/config.js` 的 `skillDefs`（表 → 归 config，非独立文件） | ✅ 已完成（测试 37+42 断言）|
| A6 | **旧路红测根因** | 报告登记 `skill_enable_runtime_test` 曾 `kills≥1` 失败；**当前实测全绿**（25 条），根因未诊断 | 诊断报告 | ✅ 只读核验 |
| A7 | ~~X-GAMe 四张卡~~ | ✅ **实测已全部存在**（非未创建）：`xgame_assets_consumption` / `xgame_save_integration` / `xgame_redtest_clock` / `xgame_boss_crystal` / `xgame_chip_fold` / `xgame_skill_save_wire` —— 书中 task-cards 的「未来交付物」在公司侧那轮已落地 | — | 已完成 |

### B 类 · 数值填表（规则已定，AI 可提案）

| # | 项 | 依据 |
|---|---|---|
| B1 | 各技能整数锚点数值（弹道数/召唤数/穿透/弹射） | §12-42 |
| B2 | 各 Buff 锚点等级与取值（BF001~BF004） | §12-50 |
| B3 | 祭坛刷出数量/频率/品质概率 | §12-3 |
| B4 | 宝箱掉落关联公式（与击杀数/怪物类型/进度条） | §12-4 |
| B5 | 局内等级成长曲线 + 未开封货物占格/重量/堆叠 | §12-5 / §12-14 |

### C 类 · 玩法决策（**只能用户拍板**）

| # | 项 | 冲突点 |
|---|---|---|
| C1 | **12 角色差异化定位与专属武器**（首版 6 角） | 直接决定 A5 的 11 套技能长什么样 |
| C2 | **等级成长公式：加算 vs 乘算** | §12-38 未定 |
| C3 | 局内保险来源重设计（原方案已废弃） | §12-13 |
| C4 | 结晶获取速率 / 局间永久解锁内容 | §12-10 |
| C5 | 难度曲线 + 赛季玩法规则 | §12-9 / §12-30（首版暂缓） |
| C6 | **卡牌系统去向** | §12-27 要卡池 vs §19.7 已退役 → **规则自相矛盾，需裁决** |
| C7 | 技能栏排布：字面 `A X X X X A` vs 已落地 `[名][A][X×4][A]` | W2 遗留偏差待确认 |

---

## 3. 并行的三条硬边界（不可绕）

1. **共享文件独占**：`js/config.js` · `js/core.js` · `index.html` · `css/style.css` · `js/game.js` · `js/main.js`
   · `js/combat.js` · `js/items.js` · `js/modes.js` · `run_tests.sh` —— **任何并行路都不许碰，只有主会话串行改**。
   （A1/A2/A3 恰好全在此列 → **这一批天然不能并行**，这是必须说清的事实。）
2. **依赖顺序**：文档/规则 → **接口冻结** → 并行实现 → 主会话接线 → 串行验收。跳过冻结 = 必冲突。
3. **设计先于实现**：B/C 类必须先有定稿数字/规则，代码才有东西可写。

---

## 4. 波次 DAG

```
P0 冻结（主会话串行，原子提交）
   ├─ 冻结「每英雄技能定义文件」注册协议（A5 并行前提）
   ├─ 冻结「SkillSave 保存时机」（A3 前提，见 C 类决策）
   └─ 建立所有权地图 + 基线指纹
        │
        ▼
P1 三轨并行
   ├─ 轨1（主会话串行）：A1 killer ∥ A2 manifest ∥ A3 SkillSave ∥ A4 castTime
   ├─ 轨2（独立文件×N 代理）：A5 其余 11 英雄技能（每英雄 1 文件 + 1 测试）
   └─ 轨3（独立文件×4 代理）：A7 X-GAMe 四张卡测试
        │
        ▼
P2 主会话串行接线（合并轨2/轨3 产出 → 共享文件只在此改）
        │
        ▼
P3 串行验收：门禁全绿 → commit → push → 重新发布 → 真机验收
```

---

## 5. 本轮实际完成

### 5.1 P1 轨1 第一批（A1 killer）
- [x] **A1 `killer` 伤害归属接线**：`js/skill-runtime.js` 主路径（`_applyDamage` → `SkillDamage.resolve` 补 `killer`）+ 兜底路径（`_fallbackDamage` 的 `null` → 施放英雄）→ `skill_runtime_test.js` 新增 4 条断言
- [x] **A2 判定为「半个改动」并回退**：依据 = 清单侧消费点 0 + 素材磁盘存在 0 + 会打破 7 条现状断言；归入「资源层整批」批次，不单独挂载
- [x] **A7 实测校正**：X-GAMe 六套测试**已存在**，非未开发（书中 task-cards 的「未来交付物」已落地）
- [x] 版本 bump `20261047 → 20261048`

### 5.2 全量迁移批 1（A5 第一批：H001~H006 全部走新路径 · 已完成）
- [x] **接口冻结**：`G_docs/hero_skill_interface_v1.md`（承载位置裁定 + 字段/标签/能力白名单 + 三条结构契约）
- [x] **承载位置裁定**：技能定义 = **表 → 写进 `js/config.js` 的 `skillDefs`**（不拆独立文件）——理由：① 项目惯例「表进 config、逻辑进独立文件」；② 80+ 测试的 `FILES` 列表都内联加载 config.js，写进去 = **全部测试自动覆盖**；拆文件要改 80+ 处加载清单，高风险零收益。
- [x] **5 个新技能定义**：`SK_SCATTER`(H002←AT104) / `SK_RAILGUN`(H003←AT106) / `SK_RINGBARRAGE`(H004←AT108) / `SK_VOLLEY`(H005←AT110) / `SK_SIEGEBLAST`(H006←AT112) + 5 条 localization
- [x] **绑定与名单**：`initialSkillBindings` 增 H002~H006；`migratedHeroIds` 扩至 `["H001".."H006"]`
- [x] **新守卫测试** `hero_skill_migration_test.js`（17 断言）：漏搬守卫 / 分流串台守卫（未迁移英雄不得有绑定、旧技能不得被删）/ 结构铁律（`moreDamageMul===1`、`damageBasis` 三字段、派生节点由边可达、`nameKey` 可解析）/ 身份回归（H001/H006 命中爆炸）
- [x] **现状记录型断言去硬编码**：`skill_integration` / `skill_rule_binding` / `skill_enable_runtime` / `skill_playtest` / `crystal_ui` / `crystal_expansion` 六处「= H001 / = 2 技能」改为**数据驱动**（比对 `initialSkillBindings` 键集）→ **以后每加一批英雄都不用再改测试**
- [x] 版本 bump `20261048 → 20261049`；`verify_clone.sh` 期望表同步（24 文件指纹 + 版本 + 基线 99 套 / 4210）
- [x] 门禁 **4210 / bad = 0 全绿**（原 4191，+19）

### 5.3 全量迁移批 2（A5 第二批：H007~H012 全部走新路径 · 已完成 · 决策 D012）

**并行编排**（用户指令「多线程并行，直接开工」）：
- 主会话串行做全部**共享文件**（schema 先冻结再放行下游）：`skill-config.js` → `config.js` → `skill-compiler.js` → `skill-runtime.js`
- 3 个并行代理做**独立产出**：旧系统效果落点调研（只读）· 数值平衡表 · 结构守卫测试 · 运行时行为测试

- [x] **schema 冻结（`skill-config.js`）**：`_FIELDS.node` += `effect`；新增 `_FIELDS.effect` / `_EFFECT_KINDS` / `_EFFECT_STATS` / `_NON_DAMAGE_KINDS`；`_TEMPLATE_KINDS` += `summonUnit`；`_PARAM_RULES` += 16 个字段名；新增 `_validateEffect`；**`_validateNode` 改 damageBasis 条件必填**（白名单，fail-closed）
- [x] **表（`config.js`）**：新增 `TP_SUMMON_UNIT`（唯一非伤害模板）+ `defaults.summonUnit`；6 技能
  `SK_TAUNTROAR`(H009←AT120) / `SK_LIFEPULSE`(H010←AT122) / `SK_WARSONG`(H011←AT123) / `SK_PSYSHIELD`(H012←AT124) / `SK_MINEFIELD`(H008←AT114) / `SK_DRONESWARM`(H007←AT113)
  + 6 条 localization + `template.summonUnit`；`initialSkillBindings` 增 H007~H012；`migratedHeroIds` → **12/12**
- [x] **编译（`skill-compiler.js`）**：`_NON_DAMAGE_KINDS` 副本 + bref 校验按模板 kind 放宽 + `_cloneNode` 补 `effect` 透传
- [x] **执行（`skill-runtime.js`）**：`_SR_CAT_DEFAULT_KEY` += `summonUnit`；`eff.effect` 透传；**文件末尾独立区块**新增 `_applySpawnEffects` / `_applyEffect` / 6 个 `_effectXxx` / `_statOf` / `_effectAmount` / `_effectRadius` / `_pushRunBuff`
- [x] 🔴 **实现期纠正**：接线点由「`_applyDamage` 命中级」改为「`spawnEffect` 施放级」—— AOE 命中 N 目标会把全队效果触发 N 次；施放级 = 每实例恰一次，与旧实现同源（详见 `hero_skill_interface_v2.md` §9.2）
- [x] 🔴 **实现期揪出的真实缺陷**：`heal`/`barrier` 把「缩放值」与「生属性」重复相加 → 由 `skill_effect_runtime_test.js` 复算断言揪出并修正（§9.3）
- [x] **测试（并行代理产出，主会话登记）**：`hero_nondamage_skill_test.js`（**37 断言**）+ `skill_effect_runtime_test.js`（**42 断言**）
- [x] **现状记录型断言随批更新**：`hero_skill_migration_test.js` ②（未迁移 → 全量，含绑定键集双向一致性）+ ④（非伤害节点豁免/双向断言）；`skill_integration_test.js` ①（模板 4 → ≥4 且含 `TP_SUMMON_UNIT`）
- [x] **平衡表**：`G_docs/skill_effect_balance_v0.1.md`（数值策划代理提案，未批准）
- [x] 门禁 **4239 → 4320 / bad = 0 全绿**（+81）

---

## 6. 下一批的阻塞点与决策项

### 6.1 ~~🔴 硬阻塞（架构变更，必须拍板）~~ → ✅ **已由决策 `D012` 解决（2026-10-12）**

> ~~**H007~H012 六人无法迁移**：新系统 `_TEMPLATE_KINDS` 只有 4 种，且**每个节点强制要求 `damageBasis`**（伤害必需），而召唤/陷阱/嘲讽/治疗/光环/护罩**大部分是非伤害效果**。~~
>
> 🔴 **已被取代（2026-10-12）**：上述判断是**未读旧技能表的推断，实测后不成立**。读 `CFG.skills`（`js/config.js:1340~1422`）确认——AT120 / AT122 / AT123 / AT124 **全部是「范围伤害 + 附加效果」**（旧注释原文：「…同时造成一次小额 AOE 伤害（**全局口径：所有主动技能都必须有伤害**）」），AT114 陷阱也是延迟触发的伤害；**只有 AT113 召唤**是真正无伤害。
>
> **实测后的真实工作量 = 1 个新模板 kind（`summonUnit`）+ 1 个可选节点字段（`effect`）**，而不是 6 种模板。
> 完整设计与施工拆分见 **`G_docs/hero_skill_interface_v2.md`**：
> - **批 2A（低风险）**：H009 嘲讽 / H010 治疗 / H011 光环 / H012 护罩 —— 只需 `effect` 字段，**不触碰 `damageBasis` 必填规则** → 零回归风险。
> - **批 2B（高风险）**：H008 陷阱 / H007 召唤 —— 新模板 + `damageBasis` 条件必填（**唯一放宽的硬约束**，须补回归测试）。

### 6.2 决策项状态

| 项 | 状态 |
|---|---|
| **③ 技能是否跨局保存** | ✅ **已拍板（`D013`）：每局重置**（不跨局）。见 `decision_log_v1.md` D013 / `game_design_proposal.md` §20.10 |
| **H007~H012 表达口径** | ✅ **已拍板（`D012`）：AI 直接设计**，设计已落库 → `hero_skill_interface_v2.md` |
| **A4 `castTime` 语义** | ⏳ 待拍板：前摇期间能否被打断 / 是否可移动 |
| **B 类数值填表（5 组）** | ⏳ 待拍板：是否授权 AI 直接提案并落库 |
