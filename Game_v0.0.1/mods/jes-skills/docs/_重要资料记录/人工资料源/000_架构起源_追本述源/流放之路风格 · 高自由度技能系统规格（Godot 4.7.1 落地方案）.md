> 本文档是给开发 AI 的完整实现规格。目标：在 Godot 4.7.1 中实现一套类 PoE 的、高自由度、数据驱动的技能系统。
> 实现原则：**运行时逻辑只写一次，所有技能差异全部来自数据（Resource）**。禁止为单个技能硬编码逻辑。

---

## 0. 总体设计目标

1. **组合自由**：任意主动技能宝石可与任意兼容的辅助宝石组合（类似 PoE 6L），组合结果由"修饰符叠加"自动推导，无需为组合写代码。
2. **数据驱动**：技能 = 数据（SkillData Resource）+ 通用执行器（SkillExecutor）。新增技能 = 新增一个 Resource，不改代码。
3. **属性管线统一**：所有数值（伤害、攻速、范围、冷却、消耗、持续时间）走同一条属性计算管线（Base → Add → Increased → More），保证"词缀自由"。
4. **触发解耦**：技能之间通过信号/触发器连接（命中时、暴击时、击杀时、受击时、冷却结束时……），支持"暴击时自动释放闪电箭"这类联动。
5. **性能友好**：面向割草/肉鸽场景，大量投射物与 hitbox，避免每帧分配对象，热点走对象池。

---

## 1. 核心概念与术语

| 概念 | 说明 |
| :--- | :--- |
| **SkillGem（主动技能宝石）** | 定义一个可释放技能的全部数据：行为类型、基础数值、成长曲线、需求属性 |
| **SupportGem（辅助宝石）** | 不独立释放，按规则修改挂载的主动技能：改数值（增伤）、改行为（多重投射）、改消耗（廉价辅助） |
| **Socket（插槽）** | 主动技能可容纳的辅助宝石位（简化 PoE 孔/链概念，见 §7） |
| **SkillInstance（技能实例）** | 运行时对象：某角色装备的一个主动宝石 + 其辅助组合，负责冷却、消耗、实际执行 |
| **Modifier（修饰符）** | 一条对属性的影响记录，由装备/天赋/增益/辅助宝石产生 |
| **Stat（属性）** | 字符串标识的数值，如 `projectile_damage`、`cast_speed`、`area_size` |
| **Trigger（触发器）** | 描述"什么事件发生时自动释放某技能"的数据 |
| **行为组件（Behavior Component）** | 技能的执行单元：投射物、近战挥击、范围爆发、持续引导、召唤物等 |

---

## 2. 目录与类结构（Godot 工程）

```plain
res://
├── systems/
│   └── skills/
│       ├── skill_instance.gd          # 技能实例（运行时核心）
│       ├── skill_executor.gd          # 通用执行器（Node，挂在角色下）
│       ├── behavior/                  # 行为组件（每种行为一个脚本）
│       │   ├── bhv_melee_swing.gd
│       │   ├── bhv_projectile.gd
│       │   ├── bhv_aoe_burst.gd
│       │   ├── bhv_channel.gd
│       │   ├── bhv_summon.gd
│       │   ├── bhv_dash.gd
│       │   └── bhv_buff_self.gd
│       ├── data/
│       │   ├── skill_data.gd          # Resource：主动宝石定义
│       │   ├── support_gem_data.gd    # Resource：辅助宝石定义
│       │   ├── trigger_data.gd        # Resource：触发器定义
│       │   ├── behavior_config.gd     # Resource：行为参数载荷
│       │   └── gem_level_scaling.gd   # Resource：等级成长表
│       ├── combat/
│       │   ├── stats_component.gd     # 属性容器+计算管线
│       │   ├── modifier.gd            # Modifier 结构
│       │   ├── damage_packet.gd       # 伤害包
│       │   ├── hitbox_component.gd
│       │   ├── hurtbox_component.gd
│       │   ├── status_effect_component.gd  # 异常/DoT
│       │   └── damage_calculator.gd   # 静态工具类
│       └── pools/
│           └── projectile_pool.gd     # 投射物/特效对象池
├── content/
│   └── gems/
│       ├── active/                    # .tres 主动宝石
│       ├── supports/                  # .tres 辅助宝石
│       └── triggers/                  # .tres 触发器
└── tests/
    └── skills/                        # 单元测试（GUT 或自写 assert 脚本）
```

---

## 3. 属性与修饰符系统（一切数值的地基）

### 3.1 Modifier 结构

```plain
# modifier.gd
class_name Modifier extends RefCounted

enum Op { FLAT_ADD, INCREASED, MORE }   # +X / 提高% / 总增%
var stat: StringName                     # 如 &"projectile_damage"
var op: int
var value: float
var source_id: StringName                # 来源追踪：&"gem:ice_shard" / &"support:multishot"
```

### 3.2 计算顺序（严格固定，PoE 语义）

```plain
最终值 = (Base + Σ FLAT_ADD)
         × (1 + Σ INCREASED)
         × Π (1 + MORE_i)
```

- `INCREASED` 全部相加后一次乘（词缀之间加算）。
- `MORE` 各自独立相乘（乘算，稀有强力）。
- **属性转换**（如 50% 物理转冰）在 FLAT_ADD 阶段后、INCREASED 前执行；同一 stat 的多源转换相加后一次转换，上限 100%。

```plain
# stats_component.gd 核心接口
func get_stat(stat: StringName) -> float:
    # 1. 取 base（技能/角色基础值）
    # 2. 应用 FLAT_ADD；3. 应用转换；4. INCREASED；5. MORE
func add_modifier(mod: Modifier) -> void
func remove_modifiers_from_source(source_id: StringName) -> void
```

### 3.3 核心属性表（首版必需）

| stat | 用途 |
| :--- | :--- |
| `melee_damage / projectile_damage / area_damage / dot_damage` | 分系伤害 |
| `attack_speed / cast_speed` | 攻速 / 施法速度 |
| `area_size` | 范围半径倍率 |
| `projectile_count / projectile_speed / projectile_pierce / chain_count / fork_count` | 投射物行为 |
| `crit_chance / crit_multi` | 暴击率 / 暴击倍率 |
| `cooldown_recovery` | 冷却回复速度倍率 |
| `skill_cost_multiplier` | 消耗倍率 |
| `duration` | 持续时间倍率 |
| `damage_taken / movement_speed / life_regen` | 承伤与生存类 |

> 伤害按**分系**（melee/projectile/area/dot）独立累计，行为组件决定技能属于哪个分系；辅助宝石可加对应分系词缀。

---

## 4. SkillData：主动宝石定义

```plain
# skill_data.gd
class_name SkillData extends Resource

@export var gem_id: StringName                 # &"ice_shard"
@export var display_name: String
@export var icon: Texture2D
@export var behavior: BehaviorConfig           # 行为类型+参数载荷（见 §5）
@export var tags: PackedStringArray            # ["projectile","cold","spell"] 用于辅助宝石兼容过滤
@export var cast_mode: CastMode                # ACTIVE(手动) / TRIGGER_ONLY(仅触发)
@export var base_cast_time: float = 0.5        # 秒，受 cast/attack_speed 影响
@export var cost_type: CostType                # MANA / LIFE / CHARGE / NONE
@export var base_cost: float = 10.0
@export var base_cooldown: float = 0.0         # 秒，0=无CD
@export var max_charges: int = 0               # 充能型技能（如 3 充能，每 X 秒回 1）
@export var charge_recharge_time: float = 0.0
@export var damage_effectiveness: float = 1.0  # 伤害效用：技能伤害 = 面板伤害 × 效用
@export var level_scaling: GemLevelScaling     # 每级成长表
@export var allowed_support_tags: PackedStringArray  # 空数组=接受所有辅助
```

### 4.1 等级成长表

```plain
# gem_level_scaling.gd
class_name GemLevelScaling extends Resource

@export var max_level: int = 20
@export var damage_per_level: float = 8.0      # 每级 +基础伤害
@export var cost_per_level: float = 0.5
@export var per_level_stats: Dictionary = {}   # {"crit_chance": 0.3} 每级追加属性
func get_base_damage(level: int) -> float      # 线性起步，后续可换曲线
```

### 4.2 BehaviorConfig：行为参数载荷

```plain
# behavior_config.gd
class_name BehaviorConfig extends Resource

@export var behavior_id: StringName   # &"projectile" / &"melee_swing" / &"aoe_burst" / ...
@export var params: Dictionary = {
    # projectile: {"count_base":1, "speed":900.0, "radius":12.0, "pierce_base":0, "lifetime":1.2}
    # melee_swing: {"arc_deg":120.0, "range":110.0}
    # aoe_burst:  {"radius":160.0, "delay":0.15}
    # channel:    {"tick_interval":0.25, "max_channel_time":3.0}
    # summon:     {"scene": preload(...), "max_count":1}
    # dash:       {"distance":300.0, "speed":1500.0}
}
```

---

## 5. 行为组件（技能如何"演"出来）

每个行为脚本实现统一接口，由 `SkillExecutor` 调用：

```plain
# 行为接口约定（所有 bhv_*.gd 实现）
func execute(ctx: SkillContext) -> void:
    # ctx 提供：caster、stats（合成后的最终属性）、skill_data、aim_direction、target_point
    # 行为内读取 ctx.get_final(...) 拿到已含辅助加成的最终数值
```

- `bhv_projectile`：按最终 `projectile_count` 生成投射物（扇形/环形散布参数化），从对象池取 Projectile 节点。投射物携带 `DamagePacket`，处理穿透/连锁/分裂。
- `bhv_melee_swing`：生成扇形 Hitbox（Area2D），单帧判定。
- `bhv_aoe_burst`：圆形 Area 延迟后结算，可配置打击次数。
- `bhv_channel`：引导型，按 tick 结算，受打断规则控制。
- `bhv_summon`：实例化召唤物场景，共享施法者 stats 的指定子集（召唤物伤害词缀）。
- `bhv_dash`：位移 + 路径伤害可选。
- `bhv_buff_self`：给自身挂增益 Modifier（带持续时间与 `duration` stat 缩放）。

> **规则：行为组件只读数据、只做演出与判定结算，不引用任何具体宝石。**

---

## 6. SupportGem：辅助宝石

```plain
# support_gem_data.gd
class_name SupportGemData extends Resource

@export var support_id: StringName          # &"multishot"
@export var display_name: String
@export var compatible_tags: PackedStringArray  # ["projectile"] 空数组=全部兼容
@export var excluded_tags: PackedStringArray    # 例如不能辅助召唤
@export var cost_multiplier: float = 1.3    # 消耗放大（或缩小）
@export var modifiers: Array[ModifierSpec]  # 静态词缀：damage +30% (INCREASED)
@export var behavior_overrides: Dictionary  # 行为改写：{"projectile_count_add": 2}
@export var flags: PackedStringArray        # ["cannot_crit"] 等标记位
```

**合成规则（SkillInstance 装配时执行，一次性计算）：**

1. 校验兼容性（tags 匹配 + excluded 排除）。
2. 把每个辅助的 modifiers 注入 stats（source_id = 支持宝石 id，可随时卸下）。
3. behavior_overrides 依序应用到行为参数（加法类先加，乘法类后乘）。
4. 消耗 = base_cost × Π 各辅助 cost_multiplier × `skill_cost_multiplier` stat。

示例组合（自动成立，无需代码）：

- 冰矛 + 多重投射 = 3 发冰矛；再 + 连锁 = 3 发会连锁的冰矛；再 + 冰冷伤害辅助 = …
- 辅助互相之间用 `conflicts_with` 做独占组（如同类"增伤辅助"二选一，可选实现）。

---

## 7. 插槽模型（简化的 PoE 孔/链）

- 角色/装备提供 `socket_count`（首版建议 4~6）。
- 每个 Socket 绑定一个主动宝石 + N 个辅助宝石（N ≤ socket 上限，且受辅助独占组限制）。
- 数据结构：

```plain
class_name SkillSlot extends Resource:
    var active_gem: SkillData
    var active_level: int = 1
    var supports: Array[SupportGemData] = []
```

- 技能栏（1~8 键）绑定 SkillSlot；**同一时刻只有一个 SkillInstance** 由 SkillSlot 派生。换辅助 = 重新装配实例。
- 后续扩展位：`link_constraints`（模拟 PoE 链：只有相互链接的孔才共享辅助）——首版不做。

---

## 8. SkillInstance 与 SkillExecutor（运行时）

```plain
# skill_instance.gd
class_name SkillInstance extends Node

signal cast_started(inst: SkillInstance)
signal cast_finished(inst: SkillInstance)
signal cooldown_updated(remaining: float, total: float)

var slot: SkillSlot
var stats: StatsComponent        # 指向角色 stats，装配时注入本技能相关 modifier
var cooldown_left: float = 0.0
var charges: int

func can_cast() -> bool          # CD/消耗/资源校验
func try_cast(aim: Vector2) -> bool
func _physics_process(delta):    # 推进冷却与充能回复
```

```plain
# skill_executor.gd（挂角色下）
# 职责：输入映射 → 找到按键绑定的 SkillInstance → 施法流程
# 施法流程：can_cast → 扣资源 → 进入 cast_time（可被打断，攻速/施法速度决定实际时长）
#        → cast_started → 调用行为组件 execute(SkillContext) → cast_finished → 启动冷却
```

**CastContext（Struct）**：`caster / instance / final_behavior_params / aim_dir / stats_snapshot`。快照在出手瞬间生成，保证"出手时词缀"一致（DoT 后续 tick 用快照）。

---

## 9. 触发系统（技能联动）

```plain
# trigger_data.gd
@export var event: StringName  # &"on_crit" &"on_hit" &"on_kill" &"on_take_damage"
                               # &"on_block" &"on_cooldown_end" &"on_interval"(每X秒)
@export var chance: float = 1.0
@export var cooldown: float = 0.0
@export var linked_slot_index: int
```

- 实现为角色身上一个 `TriggerManager`：订阅战斗事件总线（Hit / Kill / Crit / Damaged 信号），命中条件后调用对应 SkillInstance 的 `trigger_cast()`（绕过手动输入，仍走消耗与自身 CD）。
- 触发型技能 `cast_mode = TRIGGER_ONLY`。

---

## 10. 伤害与命中管线

### 10.1 DamagePacket（出手瞬间快照）

```plain
class_name DamagePacket extends RefCounted
var elements: Dictionary = {}   # {"physical":x,"cold":y,"fire":z,"lightning":w,"chaos":v}
var crit: bool
var crit_multi: float
var tags: PackedStringArray     # 命中类型 tags，供触发器与异常判定
var source_instance_id: StringName
```

### 10.2 命中流程（damage_calculator.gd，纯函数）

```plain
1. 面板伤害(分系) × damage_effectiveness → 元素组成
2. 应用技能自身转换/辅助转换（转换上限100%）
3. 暴击判定：roll < crit_chance → crit；伤害 × crit_multi
4. 目标侧：护甲减伤(物理) / 抗性(元素) / 闪避判定(命中前)
5. 结算扣血 → 产生 HitEvent（含是否暴击、是否击杀）
6. 异常判定（§11）
```

### 10.3 DoT 与异常（status_effect_component.gd）

| 异常 | 来源 | 机制 |
| :--- | :--- | :--- |
| 点燃 | 火系暴击命中 | 每秒伤害，持续 4s，可被 `duration` 缩放 |
| 冰缓/冰冻 | 冰系命中 | 移动/攻速降低；冰冻=定身，冰冻值累积 |
| 感电 | 闪电系命中 | 目标承伤 +X% |
| 中毒/流血 | 混沌/物理命中 | 叠层 DoT |

- 异常以 `StatusEffect` 对象挂在 Hurtbox 所属实体上，走统一的 `dot_damage` stat 与 tick 调度（用一个全局 DoT ticker 而非每实例 Timer，降低开销）。

---

## 11. 资源与冷却

- **资源**：`mana` / `life` / `energy_shield` 由角色 StatsComponent 持有；技能消耗按 `cost_type` 扣除。
- **冷却**：`base_cooldown ÷ cooldown_recovery`；支持充能模型（`max_charges`>0 时，冷却改为回复充能）。
- **保留**（预留 mana 的光环类）：Modifier 增加 `RESERVE` 语义，资源上限 = max − Σreserved。首版可延后。

---

## 12. 首版宝石清单（内容验证集）

> **内容分批（Wave）交付：** W1 = 系统验收所需的最小验证集（8 主动 + 6 辅助 + 3 触发）；W2 = 扩充内容包（8 主动 + 6 辅助 + 3 触发）；W3 = 第二扩充内容包（8 主动 + 6 辅助 + 3 触发），重点补验尚未覆盖的管线语义（充能模型、fork_count、cooldown_recovery、cannot_crit 标志位、on_block 事件）；W4 = 第三扩充内容包（8 主动 + 6 辅助 + 3 触发），主题「转化与资源」：验证元素转换合并与 100% 上限、crit_chance、duration MORE、dot 分系词缀、conflicts_with 独占组、energy_shield 资源、生存类 stat 与资源类型改写；W5 = 第四扩充内容包（8 主动 + 6 辅助 + 3 触发），主题「边界与极限压力」：验证 count_base 多发基准、aoe_burst hit_count 上限扩展、melee 360° 环形参数边界、duration INCREASED 与 MORE 混合、projectile_speed stat、同事件双触发器并存调度、第四条并行 interval 周期。W2/W3/W4/W5 全部只复用 W1 已实现的行为组件与属性管线，**新增内容 = 新增 .tres 文件，零代码改动**——这正是对"数据驱动"目标的回归验证。

主动（40 个，W1 核心验证集 + W2/W3/W4/W5 扩充集，全部只用 §5 已有行为组件）：

| **宝石** | **行为** | **tags** | **关键参数与定位** |
| :--- | :--- | :--- | :--- |
| **冰矛 Ice Shard** | projectile | projectile, cold, spell | W1 · 单发高伤基准（speed 900, lifetime 1.2），验证 projectile/pierce/chain 全套辅助 |
| **火焰新星 Fire Nova** | aoe_burst | aoe, fire, spell | W1 · 以施法者为中心（radius 160, delay 0.15）；火暴击可点燃 |
| **横扫 Cleave** | melee_swing | melee, physical, attack | W1 · 扇形 120°/range 110，攻速型，吃 MELEE 系词缀 |
| **熔岩护体 Molten Shell** | buff_self | buff, fire | W1 · 持续 8s 加护甲+受击反伤，受 duration stat 缩放 |
| **冲锋 Leap Slam** | dash | movement, melee | W1 · distance 300，路径伤害可选 |
| **召唤骷髅 Summon Skeleton** | summon | minion | W1 · max_count 3，共享施法者召唤物伤害词缀 |
| **引导光束 Channel Beam** | channel | channel, lightning, spell | W1 · tick 0.25s / max 3s，吃 cast_speed 与 dot 系 |
| **落雷 Storm Call** | aoe_burst | aoe, lightning, spell, trigger | W1 · TRIGGER_ONLY，delay 0.8 落点标记后爆发，触发系统基准件 |
| **烈焰箭 Burning Arrow** | projectile | projectile, fire, attack | W2 · 攻击型火箭，命中 35% 概率点燃（直接复用 §10.3 点燃规则） |
| **冰霜脉冲 Frost Pulse** | aoe_burst | aoe, cold, spell | W2 · radius 120 无 delay 低耗快施，命中附加冰缓 |
| **毒刃 Venom Blade** | melee_swing | melee, chaos, attack | W2 · 扇形近战 + 每次命中叠 1 层中毒（验证叠层 DoT） |
| **电球 Spark Orb** | projectile | projectile, lightning, spell | W2 · pierce_base 3、低单发伤害高射速，验证穿透数值上限与高频结算 |
| **旋风斩 Whirlwind Blade** | channel | channel, melee, physical, attack | W2 · 引导型近战 tick、移动中可释放（验证 channel×melee 组合） |
| **召唤幽狼 Summon Spectral Wolf** | summon | minion, cold | W2 · max_count 2、远程撕咬投射（验证多召唤物共存与召唤物远程行为） |
| **幽焰疾行 Flame Dash** | dash | movement, fire | W2 · distance 220、base_cooldown 2.5、落点小 aoe（验证 dash+aoe 组合与短 CD 手感） |
| **血怒 Blood Rage** | buff_self | buff, physical | W2 · 消耗 LIFE；攻速 INCREASED +20%，持续期间每秒流失 2% 生命（验证带代价增益） |
| **霜刃斩 Frost Slash** | melee_swing | melee, cold, attack | W3 · 扇形 100°/range 100、命中附加冰缓（验证近战×冰系异常组合） |
| **疫病飞针 Plague Needle** | projectile | projectile, chaos, spell | W3 · 单发低伤、speed 700，每次命中叠 2 层中毒（混沌远程 + 叠层 DoT 压力测试） |
| **引导电弧 Arc Storm** | channel | channel, lightning, projectile, spell | W3 · tick 0.3s，每 tick 朝准心发射 1 道电弧投射（验证 channel×projectile 复合行为） |
| **召唤石魔 Summon Golem** | summon | minion, physical | W3 · max_count 1、高血量坦型（验证召唤物差异化定位，召唤系第一个物理坦） |
| **裂地冲锋 Ground Slam** | dash | movement, melee, aoe | W3 · distance 380 + 落点大 aoe radius 180（对比 W2 幽焰疾行小 aoe，验证 dash 参数幅度） |
| **充能跃击 Lightning Warp** | dash | movement, lightning, spell | W3 · max_charges 3 / charge_recharge_time 4s（唯一充能型技能，验证 §11 充能模型） |
| **猩红狂热 Crimson Zeal** | buff_self | buff, attack | W3 · 持续 6s：attack_speed +20%、movement_speed +15%（验证单增益多词缀与 duration 缩放） |
| **寒冰囚牢 Ice Prison** | aoe_burst | aoe, cold, spell, trigger | W3 · TRIGGER_ONLY，radius 140、命中冰冻定身 1.5s（控场型触发件，供触发宝石联动） |
| **噬魂之焰 Soul Fire** | projectile | projectile, chaos, spell, trigger | W4 · TRIGGER_ONLY 低耗高速投射（补充一个低成本 TRIGGER_ONLY 投射型，供触发联动） |
| **召唤雷灵 Summon Spark Wisp** | summon | minion, lightning | W4 · max_count 2，雷灵周期施放小电球投射（验证召唤物复用 projectile 行为组件） |
| **猩红祭礼 Crimson Rite** | buff_self | buff, physical | W4 · life_regen +5/s 与 damage_taken +10% 同挂（验证 §3.3 生存类 stat 的增益带代价组合） |
| **烈焰冲锋 Flame Charge** | dash | movement, fire, melee | W4 · distance 320、路径持续伤害必配（验证 dash 路径伤害从可选转为必用） |
| **静潮涌动 Tidal Surge** | channel | channel, cold, spell | W4 · tick 0.4s，每 tick 附加冰缓（验证 channel×异常 tick 叠加） |
| **连环爆裂 Chain Detonation** | aoe_burst | aoe, fire, spell | W4 · hit_count 2、第二击延迟 0.3s（验证 bhv_aoe_burst 可配置打击次数） |
| **奥术新星 Arcane Nova** | aoe_burst | aoe, arcane, spell | W4 · cost_type=ENERGY_SHIELD（唯一 ES 消耗技能，验证 §11 energy_shield 资源扣除） |
| **转焰箭 Ember Bolt** | projectile | projectile, fire, physical, spell | W4 · 物理→火焰转换 50%（技能自带转换，验证 §3.2 转换位于 FLAT 后 INCREASED 前） |
| **碎冰棱 Shatter Spike** | projectile | projectile, cold, spell | W5 · count_base 3 扇形小冰棱、低单发伤害（验证 count_base 多发与 MULTISHOT 叠加 → 5 发） |
| **毒藤爆发 Venom Bloom** | aoe_burst | aoe, chaos, spell | W5 · delay 0.5 毒云爆发，命中叠 2 层中毒（验证 aoe×chaos×叠层 DoT 组合） |
| **荆棘之怒 Thorn Fury** | melee_swing | melee, physical, attack | W5 · arc_deg 360° 环形挥击、range 90（验证 melee_swing 参数边界：环形判定） |
| **召唤腐狼 Summon Blight Hound** | summon | minion, chaos | W5 · max_count 3，攻击附加中毒（验证 3 召唤物上限 + 召唤物异常施加） |
| **闪电流光 Lightning Tracer** | projectile | projectile, lightning, spell | W5 · pierce_base 5 + chain_count 1 同技能共存（验证穿透与连锁同源叠加结算顺序） |
| **霜寒通道 Frost Tunnel** | dash | movement, cold | W5 · distance 450、路径冰缓必配（验证 dash 最长距离参数与路径 debuff 幅度） |
| **怒火燎原 Burning Wrath** | buff_self | buff, fire | W5 · 持续 10s：fire INCREASED +25%、area_size +10%（验证 buff 多分系词缀与长 duration） |
| **岩崩巨震 Rockfall** | aoe_burst | aoe, physical, spell | W5 · hit_count 3、每击间隔 0.4s（验证 aoe_burst hit_count 上限扩展与多段延迟结算） |

辅助（30 个，分 W1/W2/W3/W4/W5 五批，全部走 modifiers / behavior_overrides / flags 三槽位）：

| **辅助宝石** | **兼容 tags** | **效果与定位** |
| :--- | :--- | :--- |
| **多重投射 Multishot** | projectile | W1 · behavior_overrides: projectile_count_add +2；cost×1.5 |
| **连锁 Chain** | projectile | W1 · chain_count +2；cost×1.3 |
| **穿透 Pierce** | projectile | W1 · pierce +3；cost×1.2 |
| **冰冷伤害 Cold Damage** | cold（空=可由 skill 侧过滤） | W1 · cold INCREASED +35%；cost×1.2 |
| **施法回响 Spell Echo** | spell | W1 · MORE 类基准：释放后自动二次释放，第二击伤害效用 ×0.7；cost×1.5（验证 MORE 语义） |
| **无情 Brutality** | melee，excluded_tags=["spell"] | W1 · melee INCREASED +40%；cost×1.2（验证 excluded 排除规则） |
| **烈焰伤害 Fire Damage** | fire | W2 · fire INCREASED +35%；cost×1.2 |
| **惊雷伤害 Lightning Damage** | lightning | W2 · lightning INCREASED +35%；cost×1.2 |
| **急速施放 Faster Casting** | 全部 | W2 · cast_speed MORE +20%；cost×1.4（第二条 MORE，验证 MORE 乘算叠加） |
| **范围扩大 Increased Area** | aoe, projectile | W2 · area_size INCREASED +30%；cost×1.3 |
| **附加混沌 Added Chaos** | 全部，excluded_tags=["minion"] | W2 · chaos FLAT_ADD ≈15% 面板伤害；cost×1.2（验证 FLAT_ADD 与转换管线的先后关系） |
| **精简释放 Efficiency** | 全部 | W2 · cost×0.65，对应分系 INCREASED −25%（**负词缀示例**：验证减益 modifier 与权衡取舍） |
| **暴击伤害 Critical Damage** | 全部 | W3 · crit_multi INCREASED +50%；cost×1.3（验证 crit_multi 词缀管线） |
| **分裂 Fork** | projectile | W3 · fork_count +2；cost×1.3（fork stat 首次验证，与连锁/穿透同槽竞争取舍） |
| **冷却回复 Cooldown Recovery** | 全部 | W3 · cooldown_recovery INCREASED +40%；cost×1.2（验证 cooldown_recovery stat 管线） |
| **猛攻 Rapid Attack** | attack | W3 · attack_speed INCREASED +25%；cost×1.3（区分 attack/cast 两类速度词缀） |
| **召唤物伤害 Minion Damage** | minion | W3 · 召唤物伤害 INCREASED +40%；cost×1.2（召唤系专属辅助） |
| **元素聚焦 Elemental Focus** | 全部，excluded_tags=["minion"] | W3 · 异常伤害 MORE +60%，但 flags: cannot_crit（首个 flags 位验证 + MORE 负面权衡） |
| **鲜血魔法 Blood Magic** | 全部 | W4 · flags: cost_life（消耗类型改写为 LIFE）；cost×0.8（验证资源类型改写与权衡取舍） |
| **凶蛮 Savage** | melee | W4 · melee MORE +30%，conflicts_with=["无情"]；cost×1.4（验证 §6 独占组 + 第二条 MORE 独立乘算） |
| **侵蚀强化 Erosion** | chaos | W4 · dot_damage INCREASED +35%；cost×1.2（dot 分系词缀首次验证） |
| **延时持久 Increased Duration** | 全部 | W4 · duration MORE +40%；cost×1.2（duration stat 的第一条 MORE） |
| **暴击洞察 Crit Insight** | 全部 | W4 · crit_chance INCREASED +30%；cost×1.3（验证 crit_chance 词缀，与暴击伤害/cannot_crit 构成暴击三角） |
| **烈焰转化 Flame Conversion** | physical | W4 · 物理→火焰转换 +50%（辅助侧转换与技能自带转换多源相加、上限 100%）；cost×1.2 |
| **虚空伤害 Void Damage** | chaos | W5 · chaos INCREASED +35%；cost×1.2（补全第四系 INCREASED 词缀，与 W2 三元素系对齐） |
| **亘古延续 Eternal** | 全部 | W5 · duration INCREASED +50%；cost×1.1（duration 第一条 INCREASED，与 W4 MORE 40% 验证 INCREASED+MORE 混合乘算） |
| **极致专注 Focus** | spell | W5 · cast_speed INCREASED +30%、movement_speed INCREASED −15%（双词缀一正一负，验证 INCREASED 加算含负值） |
| **狂化召唤 Minion Frenzy** | minion | W5 · 召唤物 attack_speed INCREASED +30%；cost×1.3（召唤系速度词缀，验证召唤物 stats 子集共享） |
| **压倒范围 Overwhelming Area** | aoe | W5 · area_size MORE +25%；cost×1.5（area 第一条 MORE，与 W2 INCREASED 30% 混合验证） |
| **压缩投射 Condensed Shot** | projectile | W5 · projectile_speed MORE +40%、projectile_damage INCREASED +10%；cost×1.2（projectile_speed stat 首次验证） |

触发（15 个，W1/W2/W3/W4/W5 各 3 个，全部为 TriggerData 纯数据，无需新代码）：

| **触发器** | **event → 联动技能** | **chance / cooldown** | **定位** |
| :--- | :--- | :--- | :--- |
| **落雷之约** | on_crit → 落雷 | 1.0 / 2.0s | W1 · 暴击联动基准 |
| **死亡绽放** | on_kill → 火焰新星 | 1.0 / 0.5s | W1 · 割草场景核心联动 |
| **自动引导** | on_interval(8s) → 引导光束 | — / — | W1 · 周期自动释放，验证 interval 事件 |
| **岩甲反冲** | on_take_damage → 熔岩护体 | 0.5 / 4.0s | W2 · 受击保命联动，验证 chance<1 与 on_take_damage |
| **反噬之刺** | on_hit → 毒刃 | 0.2 / 1.0s | W2 · 高频低概率触发，验证概率门 + 自身 CD 双重限流 |
| **疾影永动** | on_cooldown_end → 幽焰疾行 | — / — | W2 · CD 结束即自动位移，验证 on_cooldown_end 事件 |
| **毒云永续** | on_interval(5s) → 疫病飞针 | — / — | W3 · 周期施毒，验证不同 interval 周期并行（与 8s 自动引导共存） |
| **电光迅影** | on_kill → 充能跃击 | 0.3 / 0.5s | W3 · 击杀自动位移追击，验证充能型技能被 trigger_cast |
| **坚壁回击** | on_block → 寒冰囚牢 | 1.0 / 3.0s | W3 · 格挡自动控场，验证 on_block 事件（7 种事件中最后启用者） |
| **霜棘护心** | on_take_damage → 连环爆裂 | 1.0 / 5.0s | W4 · 受击联动多段 aoe，验证 on_take_damage 的新目标组合 |
| **灼魂烙印** | on_hit → 噬魂之焰 | 0.1 / 0.3s | W4 · 极低概率高频触发，验证概率门×自身 CD 的限流下限与对象池压力 |
| **奥术回响** | on_interval(12s) → 奥术新星 | — / — | W4 · 第三个并行周期（5/8/12s 三 interval 共存调度） |
| **雷霆审判** | on_crit → 岩崩巨震 | 0.3 / 3.0s | W5 · 同事件（on_crit）第二触发器，与落雷之约并存，验证同事件多触发器独立调度 |
| **腐毒散播** | on_kill → 毒藤爆发 | 0.5 / 2.0s | W5 · on_kill 第二触发器，与死亡绽放并存（验证事件总线多订阅与 4 触发器并发上限） |
| **周期怒火** | on_interval(20s) → 怒火燎原 | — / — | W5 · 第四条并行 interval 周期（5/8/12/20s 共存），验证 interval 调度器扩展性 |

---

## 13. 开发里程碑（给开发 AI 的施工顺序）

| 阶段 | 交付物 | 验收标准 |
| :-- | :--- | :--- |
| M1 | Modifier + StatsComponent + 计算管线 | 单测：+flat/+inc/+more/转换 顺序正确 |
| M2 | SkillData/BehaviorConfig + SkillExecutor + projectile/melee 两个行为 | 冰矛与横扫可施放、吃词缀 |
| M3 | SupportGem 装配 + SkillSlot/技能栏 | 任意辅助组合动态生效、卸下即还原 |
| M4 | 伤害管线 + Hurtbox/Hitbox + 击杀 | 数值与 §10 一致，暴击/抗性可测 |
| M5 | 冷却/充能/消耗 + 多技能栏 | 8 技能位全部可用 |
| M6 | 其余行为（aoe/channel/summon/dash/buff） | W1 的 8 主动宝石全部上线；W2/W3/W4/W5 扩充集零代码，随时可追加 |
| M7 | TriggerManager + 触发器 W1 3 个（W2/W3/W4/W5 各 3 个为纯数据，随装随用） | 暴击触发落雷等联动成立 |
| M8 | DoT/异常 + 对象池性能优化 | 每个阶段交付对应单元测试脚本；§12 的 W1 内容集（8 主动 + 6 辅助 + 3 触发）通过即视为系统完成，W2/W3/W4/W5 扩充集（各 8+6+3）作为"零代码加内容"的回归验证包随后交付。 |

---

## 14. 实现注意事项（给开发 AI 的硬性约束）

1. 所有随机 roll 使用统一 RNG 服务，便于测试与回放。
2. 投射物、hitbox、特效一律对象池化（`projectile_pool.gd`），禁止高频 `instantiate/free`。
3. Modifier 必须带 source_id，支持"卸下装备/宝石"时按来源精确移除。
4. 伤害计算全部纯函数、可单测；不要在计算管线里做演出逻辑。
5. 所有平衡数值放 `.tres`，代码里不出现魔数（演出参数除外且需注释）。
6. GDScript 4.x 语法（@export、@onready、信号、类型标注），不用 Godot 3 API。
7. 每个阶段交付对应单元测试脚本；§12 的 W1 8+6+3 内容集通过即视为系统完成，W2/W3/W4/W5 扩充集作为零代码回归包随后交付。
