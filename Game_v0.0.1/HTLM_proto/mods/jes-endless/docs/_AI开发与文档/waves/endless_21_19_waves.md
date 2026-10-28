# 21.19 深渊功能搭建 —— 并行波次任务卡

> 依据 `parallel-ai-game-dev` 规范 + `G_docs/plan_endless_full.md`。**7 路并行，每路只新建文件**（零共享文件冲突）。
> W0（契约冻结）已完成：`CFG.endless.tier/affixes/rewardNodes/records/team` 已入 `js/config.js`；两个新屏已入 `index.html`；脚本位已加。

## 全体硬约束（每路都必须遵守）

1. **只新建文件**：本波次**只允许创建**自己名下的 `js/*.js` 与 `<name>_test.js`。**禁止修改** `config.js` / `index.html` / `css` / `endless.js` / `modes.js` / `main.js` / `game.js` 等既有文件（接线由 W8 集成统一做）。
2. **猴子补丁式接入**：如需改变既有行为，用「保存原函数 → 包装 → 覆盖」的方式（例：`var _b = Endless.hpMul; Endless.hpMul = function(w){ return _b.call(this,w) * this.tierMul(); };`）。**乘法类叠加天然可组合**。
3. **纯全局脚本**：文件头 `"use strict";`，用 `var`/`function` 声明，末尾 `if (typeof globalThis !== "undefined") globalThis.X = X;` 暴露。
4. **无 DOM 依赖**（逻辑模块）：不读 `document`/`window`；UI 模块除外，但要有 `typeof document !== "undefined"` 守卫（无头测试可跑）。
5. **数值全读 CFG**：不硬编码可调数值；`CFG` 缺失时用内置兜底常量安全降级。
6. **非深渊世界零影响**：一律先判 `G.inEndless` / `world.kind === "endless"`，否则立即早退。
7. **测试**：新建 `<name>_test.js`，用 Node `vm` 沙箱加载「脚本链 + 被测模块」；汇总行**必须用中文**（`PASS 合计 = N  失败 = 0`），**禁止出现英文 `FAIL`/`Error` 字样**（门禁口径会把它们计为失败）。参考模板：`endless_flow_test.js`（前 120 行是 DOM 桩 + 脚本链加载范式）。

## 脚本链加载顺序（测试里照抄）

`js/config.js → core.js → pool.js → game.js → items.js → combat.js → modes.js → render.js → stress.js → endless.js → hud_endless.js → ui.js → ui-screens.js → ui-panels.js → quality.js → rewards.js → [本波次模块] → main.js`

---

## W1 · 层级系统 → `js/endless-tier.js` + `endless_tier_test.js`

**契约**（消费 `CFG.endless.tier`）：
- `Endless.tier`（number，当前层级，初值 `CFG.endless.tier.default`/1）
- `Endless.tierMul()` → 难度系数（按 `anchors` 分段线性插值，Clamp 到 [min,max]）
- `Endless.rewardMul()` → `1 + (tier-1)*rewardMulPerTier`
- `Endless.setTier(n)` → Clamp + 设值，返回生效值
- `Endless.maxUnlockedTier()` → 读 `Meta.data.abyss.bestTier`+1，兜底 `unlock.startMax`
- `Endless.tierList()` → `[{n, mul, locked}]`
- `Endless.tierLabel(n)` → `labelPrefix + " · 第 N 层"`
- **接线（猴子补丁）**：包装 `Endless.hpMul` 与 `Endless.dmgMul`，各乘 `this.tierMul()`。
- 注意：`tierMul` 只放大**怪物**强度，**不影响玩家**。

## W2 · 词缀系统 → `js/endless-affix.js` + `endless_affix_test.js`

**契约**（消费 `CFG.endless.affixes`）：
- `Endless.state.affixes = []`（运行时，存本局词缀 id 数组）
- `Endless.rollAffixes(tier)` → 按 `countAnchors` 求条数，按 `list[].weight` 加权无重复抽取；写 `state.affixes`
- `Endless.activeAffixes()` → 本局词缀对象数组
- `Endless.affixMods()` → 聚合倍率 `{monsterSpdMul,monsterHpMul,monsterAtkMul,waveCapMul,rewardMul,playerHpMul,timeLimitMul,expMul}`（缺省 1）
- **接线（猴子补丁）**：`hpMul`×monsterHpMul、`dmgMul`×monsterAtkMul、`waveCap`×waveCapMul、`waveReward`×rewardMul、`timeLeft`（首帧 timeLimit 乘 timeLimitMul，注意只乘一次）、`expMul` 由 `CFG.endless.expMul` 处读取（可包装 `dropEndlessExp` 的入参或用 `Endless.expMulNow()` 供 W8 接）。
- 词缀`swift`(速度)如需生效：包装 `Monster` 的速度字段较复杂 → **可只登记不接线**（记为「效果待接线」），但 `affixMods()` 必须返回它。

## W3 · 世界内容（祭坛 + 奖励节点）→ `js/endless-arena.js` + `endless_arena_test.js`

**背景（真缺口）**：`rollAbyssAltars`（`modes.js:1229`）**从未被调用** → 深渊世界里没有祭坛。
**契约**（消费 `CFG.endless.rewardNodes`）：
- `EndlessArena.populate(world)` → 调 `rollAbyssAltars(world, N)` 投放祭坛（天然屏蔽 RIFT）+ 按 `types` 权重投放 `rewardNodes.count` 个奖励节点（写 `world.rewardNodes = [...]`）
- `EndlessArena.update(world, dt)` → 每帧：玩家进圈拾取 gold/crystal（直接结算）、supply 走 `judgeChannel` 读条回血
- `EndlessArena.render(ctx, world)` → 可选：绘制节点（若无渲染也可只留空函数 + 注释）
- **接线（猴子补丁）**：包装 `Endless.makeWorld`（建完世界后 `populate`）+ 包装 `Endless.update`（尾部 `EndlessArena.update`）。
- 节点对象字段建议：`{ id, x, y, kind:"gold"|"crystal"|"supply", amount, radius, channel, done:false }`。
- 判定半径与绘制半径同源（×`CFG.altarJudgeMul`，项目铁律 #1）。

## W4 · 入口界面 + 选层 → `js/ui-abyss.js` + `ui_abyss_test.js`

**契约**（消费冻结的 `#screen-abyss` 屏 + `CFG.endless.tier`）：
- `UI.abyssTier`（选中的层，number，初值 `CFG.endless.tier.default`）
- `UI.showAbyssSelect()` → 渲染层级列表 `#abyss-tier-list`（用 `.abyss-tier-card`，锁定层加 `.locked`）+ 所选层信息 `#abyss-tier-info`（含词缀预览）+ 最高记录 `#abyss-best`；显示 `#screen-abyss`
- `UI.hideAbyssSelect()`
- `UI.initAbyssSelect()` → 绑定 `#btn-abyss-back`（回主城）、`#btn-abyss-start`（→ 进选角，带所选层）
- 选层信息里的**词缀预览**：读 `CFG.endless.affixes.list` 与 `countAnchors`（**只做展示预览，不必与运行时随机结果一致**，可注明）。
- 「挑战此层」→ 调 `Game.enterAbyssCharSelect()`（既有），并置 `Endless.setTier(UI.abyssTier)`。
- 无 DOM 时全部函数安全早退。

## W5 · 暂停菜单 + 主动退出 → `js/ui-abyss-pause.js` + `endless_pause_test.js`

**契约**（消费冻结的 `#screen-abyss-pause` 屏）：
- `UI.showAbyssPause()` / `UI.hideAbyssPause()`；`UI.abyssPaused`（bool）
- `UI.initAbyssPause()` → 绑定 `#btn-abyss-resume`（继续）、`#btn-abyss-quit`（放弃回主城）
- 暂停：复用 `Game.paused` 闸门（`if (typeof Game!=="undefined") Game.paused = true;`）
- 放弃：调 `exitEndlessToCity()`（既有，`modes.js:950`）
- 提供 `UI.toggleAbyssPause()` 供 W8 的 ESC / 按钮接线
- 无 DOM 安全早退

## W6 · 记录 + 首通奖励 → `js/endless-record.js` + `endless_record_test.js`

**契约**（消费 `CFG.endless.records`；写 `Meta.data.abyss`）：
- `Meta.data.abyss` 惰性补全：`{ bestWave:0, bestTier:0, fastestSec:0, firstExtract:false, firstFinalBoss:false, clearedTiers:{} }`（`EndlessRecord.ensure()`，不改 `game.js`）
- `EndlessRecord.onSettle(settle)` → 入参形如 `{wave,kills,crystals,elapsed,extracted,reason,timedOut,tier}`；更新 bestWave / fastestSec（仅在 撤离成功 且有 elapsed 时）/ bestTier（撤离成功时 = tier，并 `clearedTiers[tier]=true`）/ firstExtract / firstFinalBoss（`reason==="extract"` 或 `bossKills>0` 视情况）
- `EndlessRecord.grantFirstRewards()` → 首通额外结晶（`Meta.data.crystals += ...`，**幂等，只能给一次**）
- `EndlessRecord.best()` → 返回 best 摘要（供 W4 的 `#abyss-best`）
- 无 `Meta` 时安全降级（内存兜底对象）

## W7 · 组队（队友倒下/救援复活 + 人数缩放）→ `js/endless-team.js` + `endless_team_test.js`

**契约**（消费 `CFG.endless.team`）：
- `EndlessTeam.update(dt)` → 每帧：扫描 `G.team` 中 `alive===false` 的队友，累加倒地计时；到时（`reviveTime`）自动复活（`hp = hpMax*reviveHpRatio`, `alive=true`）；若队长在其 `rescueRadius` 内 → 走救援读条（`rescueChannel`）提前复活
- `EndlessTeam.scaleMul()` → 依据 `G.team.length` 返回敌人强度系数 `1 + (n-1)*playerScalePerExtra`
- `EndlessTeam.rewardMul()` → `1 + (n-1)*rewardScalePerExtra`
- 只在 `G.inEndless` 生效；无 `G.team` 安全早退
- 注意：队友死亡判定在 `game.js`（`h.alive=false`）——本模块**只读**，不改 game.js。

---

## 每波次验收

- [ ] 只新建了自己名下的 2 个文件（未碰共享文件）
- [ ] `node <name>_test.js` 全过，汇总行中文、无 `FAIL`/`Error`
- [ ] 非深渊世界早退（测试里断言「主线/主城不受影响」至少 1 条）
- [ ] 猴子补丁**幂等**（重复加载不叠加出错误倍率——用 `__wrapped` 标记防重）
