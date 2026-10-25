# 脏标记 + 按需重算测试（规格 §13.2 第 9 条「禁止每帧重算全部 stats」）
#
# 要证明两件事：
#   1. 有效性：词缀集合不变时，重复读同一 stat 不会重复遍历（hits 增长、misses 不变）
#   2. 正确性：缓存失效必须彻底 —— add / remove / invalidate 之后拿到的必须是新值
# 缓存算错比不缓存更糟（数值静默错位），所以正确性用例比命中率用例更重要。
extends GutTest


func _mod(stat: StringName, op: int, value: float, source: StringName = &"t") -> StatModifier:
	var m := StatModifier.new()
	m.stat = stat
	m.op = op
	m.value = value
	m.source_id = source
	return m


func _brute_sum(stats: StatsComponent, stat: StringName, op: int) -> float:
	var total := 0.0
	for m in stats.get_modifiers():
		if m.stat == stat and m.op == op:
			total += m.value
	return total


func _brute_more(stats: StatsComponent, stat: StringName) -> float:
	var prod := 1.0
	for m in stats.get_modifiers():
		if m.stat == stat and m.op == StatModifier.Op.MORE:
			prod *= 1.0 + m.value / 100.0
	return prod


func test_s1_repeat_read_hits_cache() -> void:
	var stats := StatsComponent.new()
	stats.add_modifier(_mod(&"crit_chance", StatModifier.Op.FLAT_ADD, 30.0))

	assert_almost_eq(stats.aggregate(&"crit_chance", StatModifier.Op.FLAT_ADD), 30.0, 0.0001)
	for i in 100:
		stats.aggregate(&"crit_chance", StatModifier.Op.FLAT_ADD)

	var st := stats.cache_stats()
	assert_eq(int(st[&"misses"]), 1, "只应真正算一次")
	assert_eq(int(st[&"hits"]), 100, "其余 100 次都应命中缓存")


func test_s2_add_invalidates() -> void:
	var stats := StatsComponent.new()
	stats.add_modifier(_mod(&"fire_damage", StatModifier.Op.INCREASED, 20.0))
	assert_almost_eq(stats.aggregate(&"fire_damage", StatModifier.Op.INCREASED), 20.0, 0.0001)

	stats.add_modifier(_mod(&"fire_damage", StatModifier.Op.INCREASED, 30.0))
	assert_almost_eq(stats.aggregate(&"fire_damage", StatModifier.Op.INCREASED), 50.0, 0.0001,
			"新增词缀后必须重算（INCREASED 是加算不是连乘）")


func test_s3_remove_invalidates() -> void:
	var stats := StatsComponent.new()
	# 两个来源各一条：add_modifier 保留自带 source_id，add_modifiers 会统一改写为传入值
	stats.add_modifier(_mod(&"area_size", StatModifier.Op.INCREASED, 20.0, &"slot_1"))
	stats.add_modifiers([
		_mod(&"area_size", StatModifier.Op.INCREASED, 50.0, &"whatever"),
	], &"slot_0")
	assert_almost_eq(stats.aggregate(&"area_size", StatModifier.Op.INCREASED), 70.0, 0.0001,
			"20 + 50 = 70（INCREASED 加算）")

	stats.remove_by_source(&"slot_0")
	assert_almost_eq(stats.aggregate(&"area_size", StatModifier.Op.INCREASED), 20.0, 0.0001,
			"卸下 slot_0 后必须只剩 slot_1 的 20，不能残留缓存")

	stats.remove_by_source(&"slot_1")
	assert_almost_eq(stats.aggregate(&"area_size", StatModifier.Op.INCREASED), 0.0, 0.0001,
			"全部卸下后归零")


func test_s4_cached_values_match_brute_force() -> void:
	# 多种 stat / op 组合下，缓存结果必须与暴力遍历逐项相等
	var stats := StatsComponent.new()
	var stats_list: Array[StringName] = [&"physical_damage", &"fire_damage", &"crit_chance", &"armor"]
	var ops := [StatModifier.Op.FLAT_ADD, StatModifier.Op.INCREASED, StatModifier.Op.MORE]
	for i in 12:
		var stat: StringName = stats_list[i % stats_list.size()]
		var op: int = ops[i % ops.size()]
		stats.add_modifier(_mod(stat, op, float(i * 7 + 3)))

	for stat in stats_list:
		for op in ops:
			var cached := stats.aggregate(stat, op)
			var brute := _brute_sum(stats, stat, op)
			assert_almost_eq(cached, brute, 0.00001, "%s/%d 聚合结果与暴力遍历不一致" % [stat, op])
		assert_almost_eq(stats.multiplier_of(stat), _brute_more(stats, stat), 0.00001,
				"%s 的 MORE 连乘结果不一致" % stat)


func test_s5_more_is_multiplicative_not_additive() -> void:
	# 两个 MORE 20% + 30% → 1.2 × 1.3 = 1.56，不是 1 + 0.5
	var stats := StatsComponent.new()
	stats.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	stats.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 30.0))
	assert_almost_eq(stats.multiplier_of(&"physical_damage"), 1.56, 0.0001,
			"MORE 必须逐条相乘（规格 §4.2 第 ⑤ 步）")


func test_s6_empty_more_multiplier_is_one() -> void:
	var stats := StatsComponent.new()
	assert_almost_eq(stats.multiplier_of(&"nothing"), 1.0, 0.0001, "空表应为中性元 1.0")


func test_s7_invalidate_covers_external_mutation() -> void:
	# 外部直接改 value 是约定外操作，但必须有一条明确的兜底路径
	var stats := StatsComponent.new()
	var m := _mod(&"cold_damage", StatModifier.Op.FLAT_ADD, 10.0)
	stats.add_modifier(m)
	assert_almost_eq(stats.aggregate(&"cold_damage", StatModifier.Op.FLAT_ADD), 10.0, 0.0001)

	m.value = 99.0            # 绕过 add/remove 的直改
	stats.invalidate()        # 约定：直改后必须调这个
	assert_almost_eq(stats.aggregate(&"cold_damage", StatModifier.Op.FLAT_ADD), 99.0, 0.0001)


func test_s8_clear_cache_still_correct() -> void:
	var stats := StatsComponent.new()
	stats.add_modifier(_mod(&"lightning_damage", StatModifier.Op.INCREASED, 40.0))
	stats.aggregate(&"lightning_damage", StatModifier.Op.INCREASED)
	stats.clear_cache()
	# 清缓存后重新算，结果不变
	assert_almost_eq(stats.aggregate(&"lightning_damage", StatModifier.Op.INCREASED), 40.0, 0.0001)


func test_s9_hot_loop_does_not_recompute() -> void:
	# 模拟"每帧读一次"：10000 次读取，真正计算只应发生 1 次
	var stats := StatsComponent.new()
	for i in 20:
		stats.add_modifier(_mod(&"armor", StatModifier.Op.FLAT_ADD, 5.0))
	for i in 10000:
		stats.aggregate(&"armor", StatModifier.Op.FLAT_ADD)
	var st := stats.cache_stats()
	assert_eq(int(st[&"misses"]), 1, "1 万次读取只应算 1 次")
	assert_eq(int(st[&"hits"]), 9999)
	assert_almost_eq(stats.aggregate(&"armor", StatModifier.Op.FLAT_ADD), 100.0, 0.0001)


func test_s10_version_bumps_on_every_mutation() -> void:
	var stats := StatsComponent.new()
	var v0 := stats.version()
	stats.add_modifier(_mod(&"armor", StatModifier.Op.FLAT_ADD, 1.0))
	var v1 := stats.version()
	stats.remove_by_source(&"t")
	var v2 := stats.version()
	stats.invalidate()
	var v3 := stats.version()

	assert_gt(v1, v0)
	assert_gt(v2, v1)
	assert_gt(v3, v2)
