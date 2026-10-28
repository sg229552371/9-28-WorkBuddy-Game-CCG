# 能量水晶「扩容 + 启用」施工规格 v1（**并行开发单一真源**）

> 建立：2026-10-12 ｜ 基线 `APP_VERSION 20261044` → **交付 `20261045`** ｜ 状态：**✅ 三路全部完成，已进入正式启用**
> 上游依据：`skill_migration_map_v0.1.md` §4（3 项真空）｜ 合同 §1/§14 ｜ 总纲 `skill_system_master_v1.md`
> **本文件是 B/C/主会话三路并行开发的接口契约。任何一路需要跨路字段，一律以本文件为准；本文件未写明的，禁止自行发明。**
>
> ### ✅ 交付记录（2026-10-12）
> | 路 | 交付 | 门禁 |
> |---|---|---|
> | **主会话 A** | `js/config.js`：100 级曲线生成器 + 5 颗新水晶 + 迁移映射 + 启用；`index.html`/`js/core.js` 版本 bump | — |
> | **B** | `js/skill-config.js` / `js/skill-compiler.js`：`modifyStat` 执行器 + `build.castStats` 产物 | 既有断言条数不变 |
> | **C** | `js/skill-runtime.js` / `js/skill-events.js`：`EP_DERIVED_EACH_HIT` + `targeting` + `attach` | 既有断言条数不变 |
> | **集成** | `js/skill-compiler.js` addNode 等级接线 · `js/skill-runtime.js` `_castStatsOf` · `js/skill-events.js` everyHit 豁免 · `js/items.js`/`index.html`/`css` | **93 套 / 4083 / bad=0** |
> | **W4** | 新增 `crystal_expansion_test.js`（54 条）+ 更新 4 套既有测试 | 同上 |
>
> **实测偏差（已解决）**：①`hitPolicyDefs` 实名 `hitPolicies`；②`config.js` 内 `migrationMaps` 曾有两处定义（旧空对象覆盖新内容 → 门禁全绿但迁移静默失效，已删旧处）；③`derivedEvents` 保持 `false`，改由 `everyHit` 策略**定向豁免**（见 §3.6）。

---

## 0. 用户拍板（2026-10-12，不可推翻）

| # | 拍板项 | 结论 |
|---|---|---|
| 1 | 真空 #2：无对应的 5 类（**冷却 / 弹速 / 弹射 / 灼烧 / 链锁**） | ✅ **新增水晶覆盖** |
| 2 | 真空 #3：**弹射 vs 环绕** | ✅ **拆分**（两者语义不同，各自独立水晶，**不合并**） |
| 3 | 真空 #4：`levels` 是否扩到 100 级 | ✅ **扩到 100 级**（对齐武器等级 1~100） |
| 4 | 优先级 | 🔴 **技能系统内容优先做满，再做其他系统** |
| 5 | 交付 | 完成后用户要**体验最新技能系统** |

---

## 1. 新增水晶定义（**主会话写入 `CFG.skillSystem.crystalDefs`**）

> 原有 9 颗 = `CR_PIERCE / CR_MULTISHOT / CR_HOMING / CR_SPLIT / CR_EXPLOSION / CR_AFTERFLAME / CR_EXPANSE / CR_ORBIT / CR_ARCANE_AMP`。
> 新增 5 颗 → **合计 14 颗**。以下 ID / 字段名 / executor 为**契约，不得改名**。

| 新 ID | 中文名 | 品质 | executor | 关键字段 | 迁移来源 |
|---|---|---|---|---|---|
| `CR_COOLDOWN` | 循环 | `Q_COMMON` | **`modifyStat`**（🚧 B 路新增） | `stat:"cdMul"`, `merge:"multiply"` | `M002` / `M007` / `C_V_CD` |
| `CR_SPEED` | 疾行 | `Q_COMMON` | `modifyParameter` | `field:"speed"`, `parameter:"speedMul"`, `merge:"multiply"` | `M003` / `C_V_SPD` |
| `CR_BOUNCE` | 弹射 | `Q_EPIC` | `addNode` | `event:"onHit"`, `routePolicyId:"EP_DERIVED_EACH_HIT"`, `targeting:"nearestOther"` | `M006` / `C_B_BOUNCE` |
| `CR_CHAIN` | 链锁 | `Q_EPIC` | `addNode` | 同上 + `spawnTemplateId:"TP_INSTANT_AREA"` | `C_B_CHAIN` |
| `CR_BURN` | 灼烧 | `Q_RARE` | `addNode` | `event:"onHit"`, `spawnTemplateId:"TP_PERSISTENT_AREA"`, `attach:"target"` | `C_B_BURN` |

### 1.1 实现路径分组（决定改哪个文件）

| 组 | 水晶 | 需要的运行时能力 | 责任路 |
|---|---|---|---|
| **G1 纯配置** | `CR_SPEED` | 无（`speed` 已是节点参数） | 主会话 |
| **G2 施放层统计** | `CR_COOLDOWN` | 新 executor `modifyStat` + 产物 `build.castStats` | **B 路** |
| **G3 每命中派生** | `CR_BOUNCE` / `CR_CHAIN` / `CR_BURN` | 新路由策略 + 派生目标选择 + 附着 | **C 路** |

---

## 2. B 路契约 · `modifyStat` 执行器（冷却水晶）

### 2.1 为什么需要它
`cooldownFor(def, level, stats, policy)` 的冷却 = `levels[lv-1].cooldown × stats.cdMul`。
`modifyParameter` 只能改**节点参数**（`node.parameters.*`），而 `cdMul` 是**施放层统计**，节点里没有。
→ 必须新增一个「写进施放层统计」的执行器。

### 2.2 契约（B 路必须严格实现）

**输入（配置侧，主会话写）**：
```js
operations: [{
  id: "cooldown.mul",
  executor: "modifyStat",          // 新执行器
  phase: "cast",                   // 语义标记；归并逻辑与 nodeModify 相同
  stat: "cdMul",                   // 目标统计字段（白名单见 2.3）
  parameter: "cdMul",              // 等级表取值键（lvParams 的键）
  merge: "multiply",               // 归并方式：add / multiply / exclusive
}]
```

**输出（编译产物）**：
```js
build.castStats = { cdMul: 0.94 }   // 只含被水晶改过的字段；无贡献 = 空对象 {}
```

**归并规则**（与 `_addParamContribution` 同源）：
- `multiply`：`acc = (acc == null ? 1 : acc) × value`
- `add`：`acc = (acc == null ? 0 : acc) + value`
- `exclusive`：冲突检测（多个水晶写同一 stat 且都非法 → 诊断）

**必须做到**：
1. `js/skill-config.js` 的配置校验器（`op.executor === "modifyParameter"` 分支旁）增加 `modifyStat`：校验 `stat` 在 2.3 白名单内，越界 → 诊断码（沿用现有 `INVALID_REFERENCE` 或新增 `UNKNOWN_STAT`）。
2. `js/skill-compiler.js` 的 `_EXECUTORS` 白名单加 `modifyStat`；`_applyOp` 增加分支：**不匹配节点、不改节点**，直接把贡献写进 `build.castStats`。
3. **不得影响** `modifyParameter` 既有行为（既有 9 颗水晶的编译产物**逐字节不变**）。
4. 编译产物结构：`{ ok, builds, explanations, diagnostics, signature }` 不变，`castStats` 是 build 的**新增可选字段**（无水晶贡献时为 `{}`，不得是 `undefined`，避免调用方判空分支）。

### 2.3 `stat` 白名单（首版只开 1 个）

| stat | 含义 | 基准 | 归并 |
|---|---|---|---|
| `cdMul` | 冷却倍率（越小越快） | `1.0` | `multiply` |

> 🔴 白名单是**硬闸门**：不在表内的 stat 一律编译失败（防「配了不生效」的静默 bug）。

### 2.4 等级表（主会话填，B 路只读契约）
`CR_COOLDOWN.levels` = 100 级，`cdMul` 从 **0.94**（L1，−6%）曲线降到 **0.60**（L100，−40%）。
⚠️ `cooldownFor` 有 `cdMulFloor` 下限保护，实际生效值 = `max(cdMul, floor)` —— **B 路不得改 floor 语义**。

---

## 3. C 路契约 · 每命中派生 + 派生目标选择 + 附着（弹射 / 链锁 / 灼烧）

### 3.1 现状（为什么现有机制不够）
- `_phaseDamage` 只在 `!eff.rt.firstHitDone` 时推 `firstHits` → **每发弹只派生 1 次**（`EP_DERIVED_ONCE`）。
- 派生节点在**命中点**生成，方向/位置由父效果决定 → 无法「弹向另一个敌人」。
- `persistentArea` 是**静态区域** → 无法「烧在敌人身上」。

### 3.2 契约 A：新路由策略 `EP_DERIVED_EACH_HIT`

**配置侧（主会话写入 `CFG.skillSystem.eventPolicies`）**：
```js
EP_DERIVED_EACH_HIT: {
  id: "EP_DERIVED_EACH_HIT",
  sourceWhitelist: ["TP_FLIGHT_PROJECTILE", "TP_INSTANT_AREA", "TP_PERSISTENT_AREA"],
  allowedOps: ["addNode"],
  maxDepth: 3, maxCount: 12, perCastBudget: 24,
  terminateCond: "chainLeft<=0",
  everyHit: true,                 // 🔑 新语义：每次命中都派生（不再只看首次）
}
```

**C 路必须实现**：
1. `_phaseDamage` 里，`everyHit === true` 的效果**每次命中都推入派生列表**（不再只推 `firstHitDone`）。
   ⚠️ **不得破坏** `EP_DERIVED_ONCE` 语义（`explosion/afterflame/split` 三颗水晶**保持只派生一次**，其测试逐条锁定）。
2. **链式次数预算**：派生节点携带 `chainLeft`（初值 = 水晶等级表 `count` 值，由编译器写进节点参数），
   每派生一次 `chainLeft -= 1`，归零 → 停止派生。**次数用尽不得再派生**。
3. 预算闸门沿用 `budgetPolicies.BP_DEFAULT`（`maxDerivedPerEvent` / `maxEventPerStep` / `maxEventDepth`）。

### 3.3 契约 B：派生目标选择 `targeting`

**配置侧**：operation 上的 `targeting` 字段（新字段，字符串枚举）。

| 值 | 语义 | 用在哪 |
|---|---|---|
| `"nearestOther"` | 派生效果**朝最近的、且不是本次命中目标**的敌人 | `CR_BOUNCE` / `CR_CHAIN` |
| `"none"`（缺省） | 保持现状（命中点生成） | 其余全部水晶 |

**C 路必须实现**：
- 派生节点生成时，若 `targeting === "nearestOther"`：
  - 在 `maxRange`（复用 `TGT_NEAREST.maxRange = 520`）内找最近的「非 `bornTargetId`」敌人；
  - `TP_FLIGHT_PROJECTILE` → 初速方向指向该敌人；
  - `TP_INSTANT_AREA` → 生成位置**设在该敌人坐标**（链锁传导）；
  - 找不到目标 → **不生成**（不得原地空爆，避免「弹射原地打转」）。
- **稳定排序**：同距离按 `stableId`（与 `TGT_NEAREST.tieBreak` 同口径）。

### 3.4 契约 C：附着 `attach`

**配置侧**：operation 上的 `attach` 字段。

| 值 | 语义 | 用在哪 |
|---|---|---|
| `"target"` | 效果**每帧跟随**其生成时的目标坐标（目标死亡 → 停在最后坐标，自然走完 duration） | `CR_BURN` |
| 缺省 | 保持现状（静态） | 其余全部水晶 |

**C 路必须实现**：`eff.rt.attachTargetId` 记录目标；`_phaseSweep` 的 `persistentArea` 分支中，
若 `attachTargetId` 对应敌人仍存活 → 每帧把 `eff.x/eff.y` 同步到该敌人坐标。

### 3.5 新增命中策略（主会话写入 `CFG.skillSystem.hitPolicies`，C 路使用）

> ⚠️ **实测校正**：真实键名是 **`hitPolicies`**（不是 `hitPolicyDefs`）—— 见 `js/config.js` 的「命中额度策略」段。

```js
HP_BOUNCE_CHILD: { id:"HP_BOUNCE_CHILD", scope:"cast+bounceGroup+target",
                   keyTemplate:"castId+bounceGroup+targetId", limitPerTarget:1 },
HP_CHAIN:        { id:"HP_CHAIN", scope:"cast+chainGroup+target",
                   keyTemplate:"castId+chainGroup+targetId", limitPerTarget:1, excludeBornTarget:true },
```

> 🔴 **红线**：`excludeBornTarget` 决定「链锁不回头打刚打过的敌人」；`CR_CHAIN` 必须带它。

### 3.6 `derivedEvents` 的处理（集成决策，**合同 §2 未被违反**）

C 路实测：`skill-events.js` 的冻结规则 ③「派生（depth>0）默认不触发事件水晶」由
`CFG.skillSystem.features.derivedEvents` 控制（当前 `false`）→ 弹射/链锁的链**只能走 1 跳**。

**集成决策：不改全局闸门，改为 `everyHit` 策略定向豁免。**

```js
// js/skill-events.js 的 _seDerive 内：
const pol = _sePolicy(ev);
if (ev.depth > 0 && !_seDerivedEventsEnabled() && !_seEveryHitPolicy(pol)) return;
```

**理由**：合同 §2 管的是「**另一个水晶**不要作用在派生节点上」（防分裂小弹再触发爆炸水晶的指数爆炸）；
而 `everyHit` 描述的是「**这一发弹自己的下一次命中**」，属于同一颗水晶自身的链式机制，不是「事件水晶二次触发」。
故定向豁免不违反合同 §2 —— `derivedEvents` 保持 `false`，其它水晶的派生仍不触发事件水晶。
链长与深度仍受 `parameters.chainLeft` / 策略 `maxDepth=3` / `budgetPolicies.BP_DEFAULT.maxEventDepth=3` 三重约束。

---

## 4. 100 级曲线契约（**主会话实现**）

### 4.1 结构不变原则（最重要）
`levels` 仍是**数组**：`[{ cooldown, castTime, parameters:{...} }, ...]`。
**编译器 `_levelRow` / 调度器 `cooldownFor` / 运行时全部零改动** —— 只是数组变长。

### 4.2 生成器（写在 `js/config.js` 顶部，`CFG` 定义之前）
```js
/* 由「起止值」生成 100 级幂曲线；L1 恒等于 base（测试锁定基准，不可漂移）。 */
function skillCurve(count, base, target) { ... }   // 返回 count 个长度的数组
function skillCurveInt(count, base, target) { ... } // 整数版（数量类）
```
- 幂曲线：`value_i = base × (target/base)^(i/(count-1))`
- 浮点统一 `round2`（两位小数），整数类 `Math.round`
- **L1 必须精确 = base**（`Math.pow(x,0) === 1` 天然成立，但 `round2` 后要复核）

### 4.3 🔴 不可漂移的基准（测试锁定，改则红）
| 项 | 值 | 锁定测试 |
|---|---|---|
| `SK_FIREBALL` L1 冷却 | `1.80` | `skill_rule_binding_test` ⑨ |
| `SK_FIREBALL` L1 系数 | `1.50` | 同上 |
| `SK_FIREBALL` 爆炸半径 | `130` | 同上 |
| `SK_SHOCKWAVE` L1 冷却 | `2.40` | 同上 |
| 每颗水晶 **L1** 参数 | 见现有 `crystalDefs` 现状 | `skill_config_test` / 各水晶测试 |

### 4.4 曲线目标值（L1 → L100）

| 对象 | 字段 | L1 | L100 | 类型 |
|---|---|---|---|---|
| `SK_FIREBALL` | `cooldown` | 1.80 | 0.90 | 递减 |
| | `parameters.coefficient` | 1.50 | 6.50 | 递增 |
| | `parameters.speed` | 480 | 715 | 递增 |
| | `parameters.life` | 1.60 | 2.20 | 递增 |
| | `parameters.radius` | 8 | 12 | 递增 |
| | `n_burst.radius` | 130 | 195 | 递增 |
| `SK_SHOCKWAVE` | `cooldown` | 2.40 | 1.20 | 递减 |
| | `parameters.coefficient` | 1.10 | 4.80 | 递增 |
| | `parameters.radius` | 110 | 165 | 递增 |
| | `parameters.life` | 0.12 | 0.18 | 递增 |
| 数量类（水晶） | `count` / `orbitCount` / `extraPierceCount` | 见现状 | 见现状 ×4（上限 10） | 整数 |
| 倍率类（水晶） | `more` / `ratio` / `radiusMul` | 见现状 | 见现状 +0.4 | 递增 |
| 减益类（水晶） | `lessMult` / `cdMul` | 见现状 | 见现状 ×0.75 | 递减 |

> 数量类一律**分段整数**（前 30 级每 8 级 +1，之后每 12 级 +1），避免 100 级时数量爆炸。

---

## 5. 迁移映射落库（**主会话**，用户已拍板）

`CFG.skillSystem.migrationMaps` 由 `{}` 改为：

```js
migrationMaps: {
  module: {                       // 旧武器模块 M* → 新水晶
    M001: "CR_MULTISHOT", M005: "CR_PIERCE", M004: "CR_EXPANSE", M008: "CR_EXPANSE",
    M009: "CR_ARCANE_AMP", M012: "CR_ARCANE_AMP",
    M002: "CR_COOLDOWN",  M007: "CR_COOLDOWN",
    M003: "CR_SPEED",     M006: "CR_BOUNCE",
    // M010（召唤物）/ M011（陷阱）→ 首轮不迁移（features.summonMigration=false）
  },
  chip: {},                       // 🔒 遗迹秘宝**不迁移**（用户已拍板并存，见迁移表 §3.5）
}
```

`rareSkillPool` 保持 `["SK_SHOCKWAVE"]`。
`features.summonMigration` 保持 `false`（合同 §1 第一交付不扩展项）。

---

## 6. 启用（**主会话**）

```js
enabled: true,                    // 20261044 → 由 false 改 true
migratedHeroIds: ["H001"],        // 首批试点英雄（合同 §1）；其余英雄留在旧路径
```

> 🔴 **为什么只有 H001**：`initialSkillBindings` 当前只有 `H001 → W001 → SK_FIREBALL` 一条绑定。
> 为其他英雄新建 `SK_*` 技能属于**下一阶段内容工作**（每英雄需独立 baseGraph 设计），本批不做。
> 试玩通路（`?skill=H002,H003` 等）仍可指定英雄通电，用于验证多英雄。

---

## 7. 文件所有权（**违反即冲突**）

| 路 | 拥有文件 | 内容 |
|---|---|---|
| **主会话 A** | `js/config.js` · `index.html` · `js/core.js` · `js/items.js` | 100 级 + 5 水晶 + 映射 + 开关 + 版本 |
| **B** | `js/skill-compiler.js` · `js/skill-scheduler.js` · `js/skill-config.js` | `modifyStat` 执行器 |
| **C** | `js/skill-runtime.js` · `js/skill-events.js` | `EP_DERIVED_EACH_HIT` + `targeting` + `attach` |
| **D（集成后）** | 新建 `*_test.js` · `G_docs/*.md` | 测试 + 文档 |

**共享只读**（谁都不许写）：`js/skill-presenter.js` · `js/skill-reward.js` · `js/skill-save.js` · `js/skill-damage.js`。

---

## 8. 验收（每路自测 + 主会话门禁）

| 路 | 自测命令 | 通过判据 |
|---|---|---|
| B | `node skill_compiler_test.js` + `node skill_config_test.js` + `node skill_rule_binding_test.js` | `bad = 0` 且既有断言**条数不变** |
| C | `node skill_events_test.js` + `node skill_runtime_test.js` + `node skill_integration_test.js` | 同上 |
| 主会话 | `bash run_tests.sh` | `exit=0` 且 `bad=0`（实测 93 套 / 4083 / bad=0） |

> 🔴 **PASS 文案禁止含英文 `error` / `FAIL`**（门禁 `grep -ci` 会误算 `bad`）。
