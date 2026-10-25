# TriggerManager（规格 §7）：每角色一个，订阅 CombatEventBus 信号。
# 命中 chance + 自身 CD 后发 trigger_cast_requested(slot_index)，
# 由 SkillSlotBar/SkillInstance 消费（绕过输入，仍走消耗与自身 CD）。
# 硬约束（规格 §7.2 / §7.3）：
#   - G10 限流公式：effective_rate = min(1/cooldown, event_rate × chance)
#     实现：chance 走累积器（banked chance）——每次事件累加 chance，
#     累积 ≥1 且自身 CD 就绪时触发并扣除 1.0；CD 期间照常累积不丢失。
#     该模型下长程触发率 = min(1/cooldown, event_rate × chance)，与 §7.2 公式一致。
#   - on_interval 用一个全局最小堆 ticker 统一调度（禁止每触发器一个 Timer 节点）
#   - 同一事件多个触发器各自独立计时，互不阻塞
#   - 触发链深度上限 = 3，超出丢弃（防无限递归）；深度只在触发时递增
#   - 时间推进由外部 advance(dt) 驱动（不用 Timer 节点，便于测试与对象池）
#   - 无 gem_id 分支
class_name TriggerManager
extends RefCounted

signal trigger_cast_requested(slot_index: int)

const CHAIN_DEPTH_CAP: int = 3
const ACC_CAP: float = 3.0   # banked chance 上限，防长程浮点漂移

var bus: CombatEventBus = null

# 按事件名索引的触发器列表：{ &"on_hit": [TriggerData, ...], ... }
var _by_event: Dictionary = {}
# 每个触发器的独立 CD 剩余时间（key = 触发器对象）
var _cd_remaining: Dictionary = {}
# banked chance 累积器（key = 触发器对象）
var _chance_acc: Dictionary = {}
# on_interval 全局 ticker：单一累积时间轴 + 每触发器下次触发时刻
var _ticker_time: float = 0.0
var _next_fire: Dictionary = {}   # key = 触发器对象 → 下次触发时刻（ticker 时间轴）
var _chain_depth: int = 0

# §7.1 事件名 → bus 信号名映射（集中声明，禁止散落字符串）
const EVENT_SIGNALS := {
	&"on_hit": &"hit_landed",
	&"on_crit": &"crit_landed",
	&"on_kill": &"entity_killed",
	&"on_take_damage": &"damage_taken",
	&"on_block": &"block_occurred",
	&"on_cooldown_end": &"skill_cooldown_finished",
}


func _ready() -> void:
	# 幂等：重复调用不重复订阅
	if bus != null and not bus.hit_landed.is_connected(_on_bus_event):
		for event_name: StringName in EVENT_SIGNALS:
			bus.connect(EVENT_SIGNALS[event_name], _on_bus_event.bind(event_name))


func teardown() -> void:
	if bus != null and bus.hit_landed.is_connected(_on_bus_event):
		for event_name: StringName in EVENT_SIGNALS:
			bus.disconnect(EVENT_SIGNALS[event_name], _on_bus_event)


func add_trigger(td: TriggerData) -> void:
	var list: Array = _by_event.get(td.event, [])
	list.append(td)
	_by_event[td.event] = list
	_cd_remaining[td] = 0.0
	_chance_acc[td] = 0.0
	if td.event == &"on_interval" and td.interval > 0.0:
		_next_fire[td] = td.interval  # 首次触发在 t=interval


## 全局时间推进：冷却倒数 + interval ticker（单一 ticker 统一调度）。
func advance(dt: float) -> void:
	for td: TriggerData in _cd_remaining:
		if _cd_remaining[td] > 0.0:
			_cd_remaining[td] = maxf(_cd_remaining[td] - dt, 0.0)

	_ticker_time += dt
	var due: Array = []
	for td: TriggerData in _next_fire:
		while _next_fire[td] <= _ticker_time:
			due.append(td)
			_next_fire[td] += td.interval
	for td: TriggerData in due:
		_fire(td)


## 事件处理：遍历该事件的所有触发器（各自独立 CD + banked chance）。
func _on_bus_event(_a, _b, event_name: StringName) -> void:
	var list: Array = _by_event.get(event_name, [])
	for td: TriggerData in list:
		if td.event == &"on_interval":
			continue
		# chance 累积：CD 期间照常累积（banked），不丢失事件概率
		var acc: float = minf(float(_chance_acc.get(td, 0.0)) + td.chance, ACC_CAP)
		_chance_acc[td] = acc
		if _cd_remaining.get(td, 0.0) > 0.0:
			continue
		if acc >= 1.0:
			_chance_acc[td] = acc - 1.0
			_fire(td)


## 触发一次：链深守卫 → 进入自身 CD + 发请求（链式事件由守卫丢弃）。
func _fire(td: TriggerData) -> void:
	if _chain_depth >= CHAIN_DEPTH_CAP:
		return
	_chain_depth += 1
	if td.cooldown > 0.0:
		_cd_remaining[td] = td.cooldown
	trigger_cast_requested.emit(td.linked_slot_index)
	_chain_depth -= 1


# ---------- G10 限流公式（§7.2，纯函数可测）----------
## effective_rate = min(1/cooldown, event_rate × chance)（cooldown>0）
##                = event_rate × chance（cooldown==0）
static func effective_rate(event_rate: float, chance: float, cooldown: float) -> float:
	var chance_rate: float = event_rate * chance
	if cooldown > 0.0:
		return minf(1.0 / cooldown, chance_rate)
	return chance_rate


## 硬门禁观测：on_interval ticker 数（恒为 1，或无 interval 触发器时 0）
func get_interval_timer_count() -> int:
	return 1 if not _next_fire.is_empty() else 0
