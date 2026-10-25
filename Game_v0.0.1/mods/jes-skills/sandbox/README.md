# 技能系统沙盒（测试场景）

综合测试场景：一个场景内覆盖技能系统全部元素 —— 装配（双辅助/触发器）、资源与冷却、
全部 7 种行为（投射/范围/近战/引导/位移/增益/召唤）、伤害结算（暴击/抗性/护甲）、
DoT、触发器链、对象池、木桩重生。

## 如何打开

1. 用 Godot 4.7.1 打开本工程 `project.godot`
2. 在文件面板打开 `mods/jes-skills/sandbox/sandbox_main.tscn`
3. 按 **F6**（运行当前场景）即可进入沙盒
   （主场景是 debughud001，不要用 F5）

## 场景布局

- **玩家** @(300,300)：所有技能的施放者，自动朝最近的存活木桩瞄准
- **3 个木桩** @x=700：
  - `stump_plain` (700,190) — 无抗无甲，基准目标
  - `stump_resist` (700,300) — 四系抗性 50%，验证抗性减伤
  - `stump_armor` (700,410) — 护甲 200，验证护甲减伤
- **左下角 装配实验台**：技能下拉 × 辅助宝石多选，实时显示装配结果/耗魔/伤害/参数差异（见下文）
- **左上角 HUD**：蓝量 / 各槽位冷却与充能 / 投射物池占用 / 特效池占用 / DoT 数量 / 各木桩血量
  - 节点结构：`Hud`(CanvasLayer, layer=10，仅负责分层) → `HudView`(Control，挂 `sandbox_hud.gd` 做绘制)
  - 注意：`CanvasLayer` 不是 `CanvasItem`，没有 `_draw()`/`queue_redraw()`，绘制脚本必须挂在 Control/Node2D 上
- **渲染层（M8）**：
  - `ProjectileLayer`（`MultiMeshInstance2D`）：所有投射物一次 draw call 画完，场景里**没有**逐发节点
  - `Effects`（`EffectPool`）：16 个预建 `GPUParticles2D`，命中时复用，硬上限 128

## 按键（D-33 简化后）

> **不再按 1~9 选槽**。Q 统一施放**实验台当前配置**（槽 0）——在实验台下拉里换技能，
> 按的就是那个技能。触发器链路（槽 7 挂 on_crit）走 `TriggerManager`，不经按键。

| 键 | 作用 |
|---|---|
| `Q` | 施放槽 0 当前技能（实验台下拉选择：霜矛 / 烈焰 / 雷光 / 引线 / 冲刺 / 狂暴 / 召唤 / 霜爆 / **落烬环** / **环绕飞刃**） |
| `R` | 全体木桩回满血（重生复位） |

**试玩两个新技能**（数值 2026-10-21 headless 实测定值，见 `tests/perf/bench_orbit_cinders.gd`）：

- **落烬环**（槽 8，`FLY·RING·ZONE` 首格）：实验台选「落烬环」按 Q。环形带 90~150，
  3 段 × 1s、每段火 62、CD 6s、耗魔 22。**看三点**：贴脸的木桩（内洞）应不掉血；
  中距离（带内）吃满 3 段；远处不掉血。实测：带内 186 / 内洞 0 / 带外 0，判定精确。
- **环绕飞刃**（`orbit` 弹道首格）：实验台选「环绕飞刃」按 Q。3 刃绕玩家转，
  环半径 90、一圈 1.51s、寿命 4s、CD 4s（= 寿命，禁止叠层）、耗魔 12、每刃物伤 30。
  实测环上敌人 120/s（原占位 55 伤 + 默认 CD 0 时为 220/s 且可无限叠层，已修）。

**每秒自动放技能**：实验台标题行的勾选框，勾上后每 1 秒自动施放槽 0 当前配置
（仍走冷却与蓝量门禁，蓝不够就空拍）；HUD 首行会显示 `[自动施法 ON]`。

## 观察项（覆盖验证清单）

1. **装配链路**：按 `1` 扣魔 16.8（10×1.4×1.2）而非 10 → 双辅助 cost 连乘生效；一次 3 发 → 多重投射 add 生效
2. **冷却/充能**：连按 `3` 三次后被拒 → 3 充能耗尽；HUD 显示充能回充进度
3. **资源门禁**：蓝量耗尽后按任意技能 → 不施放、不进 CD
4. **抗性**：用 `2`/`4` 打 stump_resist，伤害约为打 stump_plain 的一半 → 50% 抗性（cap 75%）生效
5. **护甲**：物理系打 stump_armor 伤害更低 → `armor/(armor+10*phys)` 公式生效
6. **引导**：按住 `4`（施放后自动引导），光束命中轴线上最近木桩
7. **召唤物**：连按 `7` 观察 —— 第 1、2 次各出 1 只，第 3 次起数量不再增长而是**顶掉最旧**的那只（`max_count = 2`），10s 生命周期到期自动回收
8. **触发器**：槽 2 雷光斩暴击时，`on_crit`（`linked_slot_index = 2`）会**再施放一次槽 2** → 一次按键两次近战判定（注意：不是槽 7，槽 7 是第 8 个主动，R8 前的注释写错过）
9. **重生**：打死木桩后等 2s（或按 `R`）→ 满血复活
10. **投射物池**：HUD 显示 `投射物: n/512`，反复按 `1` 观察复用（active 归还后不增长）
11. **特效池**：HUD 显示 `特效: n/128`，命中时在目标处爆一圈光点；连打也只复用那 16 个预建节点
12. **装配缓存**：同一个槽连按 `1` 十次，装配只发生**一次**（`SocketGraph.cache_stats()` 的 `misses` 停在 1）；在实验台换一颗辅助 → `cache_key` 变化、`misses` +1
13. **8 个技能位全可用**：`1`~`8` 八个键各有独立主动，HUD 冷却区 8 行齐全；按 `8` 打出冷系 AOE 且扣魔 12（R8 后槽 7 不再是"只能被触发器间接使用"的死槽）

## 运行时结构（R7 新增的三层）

施法链路自外向内是 **槽 → 实例 → 装配缓存 → 计划**，四层各有单一职责，不要越层取值：

| 层 | 类 | 持有什么 | 关键约束 |
|---|---|---|---|
| 槽 | `SkillSlot` | 主动宝石 + 孔位数组 + **冷却/充能对象** | 唯一真源。任何层都**不得**复制它的字段 |
| 实例 | `SkillInstance` | 槽**引用**、装配缓存、`cache_key`、`is_initial` / `is_rare` | 只存引用（§13.1 第 5 条）；`begin()` 无副作用、`commit()` 才扣冷却 |
| 装配 | `SocketGraph.assemble_cached()` | 上次装配产物（深拷贝返回） | 命中返回**深拷贝**，否则 `add_modifiers` 改写 `source_id` 会污染缓存（D-07） |
| 计划 | `SkillExecutor.cast_plans()` | 每帧要生成的行为计划 | 纯函数，不改动传入的 `SkillData` |

调用顺序固定：`inst.begin()` 判就绪（蓝量/冷却/条件门）→ `inst.cast_plans(stats)` 拿计划 → 执行 → `inst.commit()` 扣资源。
**条件门 fail-closed**：拿不到上下文就判定不成立，效果不生效（D-09）。

## 性能相关的三条纪律

- HUD 文本**不在 `_draw()` 里拼**：`_rebuild_lines()` 按 10Hz 节拍重建，`_draw()` 只画（§13.2 第 10 条）
- 投射物命中冷却用定长 SoA（`HIT_MEMO = 4` 条/发），不是 `Dictionary`；`SpatialHash.clear()` 把桶数组收进池复用
- 沙盒里所有随机走 `RngService` 的分流域，**禁止裸 `randi()`**（会移动战斗序列，D-06）

## 投射物与特效（M8 性能架构）

- 投射物**不是节点**：状态全在 `ProjectileField` 的平行数组里（`px/py/vx/vy/age/life/radius/pierce/alive`），
  每帧 `hash.query_near_into()` 找邻近目标，距离用平方比较
- 命中结算复用**同一个** `HitboxComponent`（它只是无状态结算器），所以 300 发子弹只多出 1 个 `Area2D`
- 绘制由 `SandboxProjectileLayer` 一次写完：位置/缩放/末期淡出是纯函数 `instance_state()`，
  `sync()` 只负责写进 MultiMesh
- 实测（headless，纯逻辑层）：300 弹 × 80 敌 **0.501 ms/帧**，每帧候选 **7 个**（暴力全扫 24000 个），**快 56.3×**；
  复现命令见 `tests/perf/bench_projectiles.gd` 文件头
- 旧的 `sandbox_projectile.gd`（Node2D 演示版）已不再被场景使用，仅留作对照

## 装配实验台（测试「技能 + 辅助宝石是否生效」）

左下角面板（`sandbox_lab.gd`，挂在 `Hud/Lab`）：

- **技能**：下拉选择技能，选中即写入槽 0；技能多时用上方**三维筛选**——「全部」勾选框 + 投送/形状/时序三个下拉（交集过滤；轴值运行时从 behavior_id / shape / 时序参数推导，不碰数据文件；任一下拉选了具体轴值自动取消「全部」勾选，勾回「全部」则三下拉复位；原选择被过滤掉时自动落到筛选结果第一项并写回槽 0）
- **辅助宝石池**：9 个辅助多选，勾选即生效、取消即卸下（卸下后数值逐位还原）
- **实时报告**：
  - 装配成功/失败与原因（不兼容 / 互斥 / 孔位已满，指明问题辅助）
  - 耗魔 `基础 → 当前（×倍率）`、孔位占用 `n/6`
  - 伤害变化（按元素）、行为参数变化（投射物/穿透/连锁/半径…）、范围/持续倍率
  - 注入的词缀清单
- 按 `1` / `Q` 或点「施放 (1)」即实放当前配置；「清空」一键卸下全部辅助
- **兼容性语义 = PoE 2 前置拦截**：不兼容 / 互斥 / 满孔的辅助在池子里**直接置灰不可勾选**
  （标签后标注原因），点也不进去；换技能后已勾但不兼容的辅助会自动卸下并提示。
  也就是说正常运行永远组不出非法配置
- 装配函数 `assemble()` 仍保留 **G7 fail-fast**（返回 `ERR_INCOMPATIBLE_SUPPORT` 等错误码），
  作为绕过 UI 的数据错误兜底：`try_cast` 遇到非法配置会拒绝施放，不会静默算错
- 语义溯源与对比（PoE1 / PoE2 / PoB）见 `../docs/_AI开发与文档/踩坑与决策台账.md` 的 **D-01**

对应测试：`tests/sandbox/test_s_support_pool.gd`（池自洽 / 不兼容整体失败 / 耗魔连乘 /
overrides 落计划 / 词缀落管线 / 互斥 / 卸下还原 / 镶嵌准入 5 项）。

## headless 自动化验证

冒烟测试 13 项（不入树、固定种子、全 tick 驱动）：

```powershell
& "Godot.exe路径" --headless --path "工程路径" `
  -s res://addons/gut/gut_cmdln.gd -gtest=res://mods/jes-skills/tests/sandbox/test_s_sandbox_smoke.gd
```

全量回归（**243 测试 / 1446 断言，23 个测试脚本**）：

```powershell
& "Godot.exe路径" --headless --path "工程路径" `
  -s res://addons/gut/gut_cmdln.gd -gdir=res://mods/jes-skills/tests -ginclude_subdirs
```

性能压测（300 弹 × 80 敌，打印 ms/帧 与加速比）：

```powershell
& "Godot.exe路径" --headless --path "工程路径" `
  -s res://mods/jes-skills/tests/perf/bench_projectiles.gd
```

渲染整帧压测（300 弹 × 80 敌，MultiMesh 单 draw call）：

```powershell
& "Godot.exe路径" --path "工程路径" `
  -s res://mods/jes-skills/tests/perf/bench_render.gd
```

> 渲染压测**必须带显卡跑**（不要加 `--headless`）：dummy 渲染器不提交绘制，帧率读数无意义（台账 P-21）。
> 脚本会自己关 vsync、`Engine.max_fps = 0`；若检测到 headless 会直接打印警告。
> R7 桌面实测：**1.65 ms/帧（605 fps）**，详细数据见规格 §9.7。

> 新增/改名 `class_name` 后先跑 `--import` 刷新脚本类缓存，否则 headless 报 `Could not find type`（台账 P-08）。

## 架构边界

- `sandbox_*.gd` 是**演示层**：只消费系统层（`systems/skills/`）的纯函数输出与计划，
  不包含任何 `gem_id` 分支；新增技能/辅助 = 在 `content/gems/` 里加一个 `.tres`，**不改任何代码**
  （`GemRegistry` 扫描目录加载；原 `sandbox_gems.gd` 工厂已删除，台账 D-05）
- 系统（executor/stats/resource/cooldown/hitbox/trigger/DoT/池/召唤）与 M0–M8 测试基线完全共享
- 演示层**不自己算装配、不自己管召唤物数量**：装配一律走 `SocketGraph.assemble_cached()`，召唤一律走 `MinionRegistry.spawn()` / `tick()`，演示层只负责"按键 → 调系统 → 画出来"
- HUD 纯展示只读，不参与任何判定
