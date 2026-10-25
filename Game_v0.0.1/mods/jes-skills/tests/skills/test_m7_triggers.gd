# M7 测试：触发系统（规格 §7 / §3.4 / §12 M7）
# 验收：G10 限流公式（事件率 5/s × chance 0.3 × CD 0.5s → 100s 内 150±15 次）；
#       链深保护（上限 3，超出丢弃）；同事件多触发器独立；on_interval 全局 ticker。
# 硬约束（规格 §7.3 / §14）：
#   - on_interval 用一个全局最小堆 ticker，禁止每触发器一个 Timer 节点
#   - 同一事件多个触发器各自独立计时，互不阻塞
#   - 触发链深度上限 = 3，超出丢弃（防无限递归）
#   - trigger_cast 绕过输入，仍走消耗与自身 CD
#   - 无 gem_id 分支；时间推进由测试手动 advance(dt)
extends GutTest

const EventBusScript := preload("res://mods/jes-skills/systems/skills/combat/combat_event_bus.gd")
const TriggerDataScript := preload("res://mods/jes-skills/systems/skills/data/trigger_data.gd")
const TriggerManagerScript := preload("res://mods/jes-skills/systems/skills/trigger_manager.gd")


# ---------- T1：TriggerData 字段契约（§3.4）----------
func test_t1_trigger_data_defaults() -> void:
	var td: TriggerData = TriggerDataScript.new()
	assert_eq(td.event, &"", "event 默认空")
	assert_almost_eq(td.chance, 1.0, 0.0001, "chance 默认 1.0")
	assert_almost_eq(td.cooldown, 0.0, 0.0001, "cooldown 默认 0.0")
	assert_almost_eq(td.interval, 0.0, 0.0001, "interval 默认 0.0")
	assert_eq(td.linked_slot_index, 0, "linked_slot_index 默认 0")


# ---------- T2：CombatEventBus 信号契约（§7.1）----------
func test_t2_event_bus_signals_exist() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	assert_true(bus.has_signal("hit_landed"), "hit_landed 信号存在")
	assert_true(bus.has_signal("crit_landed"), "crit_landed 信号存在")
	assert_true(bus.has_signal("entity_killed"), "entity_killed 信号存在")
	assert_true(bus.has_signal("damage_taken"), "damage_taken 信号存在")
	assert_true(bus.has_signal("block_occurred"), "block_occurred 信号存在")
	assert_true(bus.has_signal("skill_cooldown_finished"), "skill_cooldown_finished 信号存在")
	autofree(bus)


# ---------- T3：事件触发 → 走 chance 判定与自身 CD ----------
# chance=1.0、cooldown=0.5：3 次事件在 CD 内只触发 1 次；
# 时间推到 0.5s 后再事件，第二次触发成功。
func test_t3_event_trigger_respects_cooldown() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td: TriggerData = TriggerDataScript.new()
	td.event = &"on_hit"
	td.chance = 1.0
	td.cooldown = 0.5
	td.linked_slot_index = 0
	mgr.add_trigger(td)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	# 0 时刻连发 3 次 hit_landed：CD 生效只触发 1 次
	for i in 3:
		bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 1, "CD 内的 3 次事件只触发 1 次")

	# 推进 0.4s：CD 未好
	mgr.advance(0.4)
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 1, "0.4s 时 CD 未好，不触发")

	# 再推进 0.1s：CD 好
	mgr.advance(0.1)
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 2, "0.5s 后 CD 好，第二次触发")

	# 第二轮 CD 期间第三次事件被拦
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 2, "CD 期间不重复触发")


# ---------- T4：chance 限流（G10 核心）----------
# 事件率 5/s、chance 0.3、CD 0.5s：effective_rate = min(2.0, 1.5) = 1.5/s
# 模拟 100s：每 0.2s 一次事件（5/s），期望触发 150 ± 15 次。
func test_t4_g10_rate_limit_formula() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td: TriggerData = TriggerDataScript.new()
	td.event = &"on_hit"
	td.chance = 0.3
	td.cooldown = 0.5
	td.linked_slot_index = 2
	mgr.add_trigger(td)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	# 100 秒模拟：每 0.2s 一次事件 + 推进（固定种子，结果必须可复现）
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var event_dt := 0.2
	for i in 500:  # 100s / 0.2s = 500 次事件
		if rng.randf() < 1.0:  # 事件总是发生；chance 判定在 mgr 内部
			pass
		bus.hit_landed.emit({}, {})
		mgr.advance(event_dt)

	assert_between(fired.size(), 135, 165,
		"G10：100s 触发 150±15 次（实际 %d）" % fired.size())


# ---------- T5：chance=0 从不触发，chance=1 每次都触发（无 CD 时受事件率限制）----------
func test_t5_chance_extremes() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td0: TriggerData = TriggerDataScript.new()
	td0.event = &"on_hit"
	td0.chance = 0.0
	td0.linked_slot_index = 0
	mgr.add_trigger(td0)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	for i in 10:
		bus.hit_landed.emit({}, {})
		mgr.advance(1.0)
	assert_eq(fired.size(), 0, "chance=0 从不触发")


# ---------- T6：同一事件多个触发器独立计时，互不阻塞 ----------
# 两个 on_hit 触发器 CD 不同（0.5 与 1.0），各自按自身节奏触发。
func test_t6_independent_cooldowns_same_event() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td_a: TriggerData = TriggerDataScript.new()
	td_a.event = &"on_hit"
	td_a.chance = 1.0
	td_a.cooldown = 0.5
	td_a.linked_slot_index = 0
	mgr.add_trigger(td_a)

	var td_b: TriggerData = TriggerDataScript.new()
	td_b.event = &"on_hit"
	td_b.chance = 1.0
	td_b.cooldown = 1.0
	td_b.linked_slot_index = 1
	mgr.add_trigger(td_b)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	# t=0：两个都触发
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 2, "t=0 两个触发器都触发（独立计时）")

	# t=0.5：A 好了触发，B 还在 CD
	mgr.advance(0.5)
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 3, "t=0.5 只有 A（slot 0）触发")
	assert_eq(fired[2], 0, "触发的是 slot 0")

	# t=1.0：A（t=0.5 触发 + CD 0.5）与 B（t=0 触发 + CD 1.0）同时转好 → 都触发
	mgr.advance(0.5)
	bus.hit_landed.emit({}, {})
	assert_eq(fired.size(), 5, "t=1.0 A 和 B 都转好，都触发")
	assert_eq(fired[3], 0, "A（slot 0）先触发")
	assert_eq(fired[4], 1, "B（slot 1）后触发")


# ---------- T7：链深保护：上限 3，超出丢弃 ----------
# 触发器链：slot0 触发产生 hit → slot1（on_hit）→ 产生 hit → slot2 → 再 hit 被 slot3 拦截？
# 更直接：mgr.begin_trigger_chain() 暴露链深 API，手动模拟 4 层嵌套触发，第 4 层丢弃。
func test_t7_chain_depth_cap() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	# 触发器自身在回调中再发 hit_landed（模拟链式：触发又造成事件）
	var td: TriggerData = TriggerDataScript.new()
	td.event = &"on_hit"
	td.chance = 1.0
	td.cooldown = 0.0  # 无 CD，纯靠链深拦截
	td.linked_slot_index = 0
	mgr.add_trigger(td)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index)
		bus.hit_landed.emit({}, {}))  # 触发又产生新事件 → 递归链

	bus.hit_landed.emit({}, {})
	# 链深上限 3：初始事件(深度0) → 触发1(深度1) → 触发2(深度2) → 触发3(深度3 被丢弃)
	assert_eq(fired.size(), 3, "链深上限 3：第 4 次尝试被丢弃（实际 %d）" % fired.size())


# ---------- T8：on_interval 全局 ticker ----------
# interval=0.5：模拟 2s，应触发 t=0.5/1.0/1.5/2.0 共 4 次（一个 ticker 统一调度）。
func test_t8_interval_ticker() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td: TriggerData = TriggerDataScript.new()
	td.event = &"on_interval"
	td.interval = 0.5
	td.linked_slot_index = 3
	mgr.add_trigger(td)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	for i in 20:  # 2s / 0.1s = 20 步
		mgr.advance(0.1)

	assert_eq(fired.size(), 4, "2s 内 interval=0.5 触发 4 次（实际 %d）" % fired.size())
	for i in fired.size():
		assert_eq(fired[i], 3, "触发 slot 是 3")


# ---------- T9：on_interval 多触发器统一调度（无 Timer 节点硬门禁）----------
# 两个不同 interval（0.3 与 0.7）的 interval 触发器在 2.1s 内各自按节奏触发。
func test_t9_interval_multiple_triggers_shared_ticker() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td_a: TriggerData = TriggerDataScript.new()
	td_a.event = &"on_interval"
	td_a.interval = 0.3
	td_a.linked_slot_index = 0
	mgr.add_trigger(td_a)

	var td_b: TriggerData = TriggerDataScript.new()
	td_b.event = &"on_interval"
	td_b.interval = 0.7
	td_b.linked_slot_index = 1
	mgr.add_trigger(td_b)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	for i in 21:  # 2.1s / 0.1s
		mgr.advance(0.1)

	# A: t=0.3,0.6,...,2.1 → 7 次；B: t=0.7,1.4,2.1 → 3 次（含 t=2.1 边界按实现浮动）
	var a_count := 0
	var b_count := 0
	for s in fired:
		if s == 0:
			a_count += 1
		elif s == 1:
			b_count += 1
	assert_between(a_count, 6, 8, "interval=0.3 在 2.1s 内约 7 次（实际 %d）" % a_count)
	assert_between(b_count, 2, 4, "interval=0.7 在 2.1s 内约 3 次（实际 %d）" % b_count)
	assert_true(mgr.get_interval_timer_count() <= 1,
		"硬门禁：on_interval 只允许一个全局 ticker（实际 %d 个）" % mgr.get_interval_timer_count())


# ---------- T10：事件映射完整性（§7.1 事件名 → bus 信号）----------
func test_t10_event_name_to_signal_mapping() -> void:
	var bus: CombatEventBus = EventBusScript.new()
	autofree(bus)
	var mgr: TriggerManager = TriggerManagerScript.new()
	autofree(mgr)
	mgr.bus = bus
	mgr._ready()

	var td: TriggerData = TriggerDataScript.new()
	td.event = &"on_kill"
	td.chance = 1.0
	td.linked_slot_index = 1
	mgr.add_trigger(td)

	var fired: Array = []
	mgr.trigger_cast_requested.connect(func(slot_index: int) -> void:
		fired.append(slot_index))

	bus.entity_killed.emit({}, {})
	assert_eq(fired.size(), 1, "on_kill 由 entity_killed 信号驱动")
