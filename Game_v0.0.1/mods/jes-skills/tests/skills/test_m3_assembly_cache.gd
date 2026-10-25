# 装配缓存测试（规格 §5.2 第 5 条）：key = (gem_id, level, 排序后 support_ids, links)
#
# 重点不是"缓存能命中"，而是两条正确性：
#   1. 命中返回的必须是**副本** —— 调用方会改写 modifier.source_id（注入时），
#      共享本体的话第二个槽注入会污染第一个槽，G6「卸下即还原」会连带删错。
#   2. 缓存结果必须与无缓存 assemble 逐项一致 —— 缓存不能偷偷改语义。
extends GutTest


func before_each() -> void:
	SocketGraph.clear_cache()


func _slot(gem_id: StringName, supports: Array = []) -> SkillSlot:
	var s := SkillSlot.new()
	s.active_gem = GemRegistry.skill(gem_id)
	s.active_level = 1
	s.socket_count = 6
	for id in supports:
		var sup := GemRegistry.support(id)
		if sup != null:
			s.supports.append(sup)
	return s


func test_ac1_second_call_hits_cache() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi"])
	var a := SocketGraph.assemble_cached(slot)
	var b := SocketGraph.assemble_cached(slot)

	assert_true(a.ok)
	assert_true(b.ok)
	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"misses"]), 1, "第一次应未命中")
	assert_eq(int(st[&"hits"]), 1, "第二次应命中")
	assert_almost_eq(a.cost_multiplier, b.cost_multiplier, 0.0001)


func test_ac2_cached_result_matches_plain_assemble() -> void:
	# 防漂移：带缓存与不带缓存必须给出同一个答案
	var slot := _slot(&"frost_shard", [&"support_multi", &"support_cold_focus"])
	var plain := SocketGraph.assemble(slot)
	var cached := SocketGraph.assemble_cached(slot)

	assert_eq(cached.ok, plain.ok)
	assert_eq(cached.error_code, plain.error_code)
	assert_eq(cached.modifiers.size(), plain.modifiers.size(), "词缀数必须一致")
	assert_almost_eq(cached.cost_multiplier, plain.cost_multiplier, 0.0001)
	assert_eq(cached.behavior_overrides.size(), plain.behavior_overrides.size())
	assert_eq(cached.effective_tags.size(), plain.effective_tags.size())


func test_ac3_mutating_result_does_not_poison_cache() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi"])
	var first := SocketGraph.assemble_cached(slot)
	# 模拟调用方注入时改写 source_id（StatsComponent.add_modifiers 的真实行为）
	for m in first.modifiers:
		m.source_id = &"slot_0"
	first.cost_multiplier = 999.0
	first.behavior_overrides.clear()

	var second := SocketGraph.assemble_cached(slot)
	assert_almost_eq(second.cost_multiplier, 1.4, 0.0001, "缓存本体不得被上一次的改写污染")
	assert_gt(second.behavior_overrides.size(), 0, "行为覆盖也不得被清空")


func test_ac4_two_slots_with_same_config_do_not_share_modifier_objects() -> void:
	# 这是"为什么必须 clone"的回归用例：
	# 槽 A 与槽 B 配置相同 → 同一个 cache key；
	# 各自以不同 source_id 注入后，卸下 A 不能影响 B。
	# 用 cold_focus 而不是 multi：前者产出 stat_modifiers（真正会被注入的那类），
	# 后者只走 behavior_overrides，测不到 source_id 污染这条路径。
	var slot := _slot(&"frost_shard", [&"support_cold_focus"])
	var stats := StatsComponent.new()

	var res_a := SocketGraph.assemble_cached(slot)
	stats.add_modifiers(res_a.modifiers, &"slot_a")
	var count_a := stats.get_modifiers().size()
	assert_gt(count_a, 0, "槽 A 应注入成功")

	var res_b := SocketGraph.assemble_cached(slot)
	stats.add_modifiers(res_b.modifiers, &"slot_b")
	assert_eq(stats.get_modifiers().size(), count_a * 2, "槽 B 应再注入一份")

	# 卸下 A：只能删掉 A 的那一份
	stats.remove_by_source(&"slot_a")
	assert_eq(stats.get_modifiers().size(), count_a, "卸下 A 后必须仍保留 B 的词缀")

	for m in stats.get_modifiers():
		assert_eq(m.source_id, &"slot_b", "残留词缀的 source_id 必须是 slot_b")


func test_ac5_changing_supports_changes_key() -> void:
	var s1 := _slot(&"frost_shard", [&"support_multi"])
	SocketGraph.assemble_cached(s1)
	var s2 := _slot(&"frost_shard", [&"support_multi", &"support_area"])
	SocketGraph.assemble_cached(s2)

	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"misses"]), 2, "换辅助应视为新配置")
	assert_eq(int(st[&"size"]), 2)


func test_ac6_support_order_does_not_matter() -> void:
	# 辅助顺序不影响装配结果 → 排序后同 key，应命中而不是重算
	var s1 := _slot(&"frost_shard", [&"support_multi", &"support_area"])
	var s2 := _slot(&"frost_shard", [&"support_area", &"support_multi"])
	SocketGraph.assemble_cached(s1)
	SocketGraph.assemble_cached(s2)
	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"hits"]), 1, "仅顺序不同应命中同一缓存")
	assert_eq(int(st[&"size"]), 1)


func test_ac7_level_and_links_are_part_of_key() -> void:
	var base := _slot(&"frost_shard", [&"support_multi"])
	SocketGraph.assemble_cached(base)

	var leveled := _slot(&"frost_shard", [&"support_multi"])
	leveled.active_level = 5
	SocketGraph.assemble_cached(leveled)

	var linked := _slot(&"frost_shard", [&"support_multi", &"support_area"])
	linked.links = [0, 1]
	SocketGraph.assemble_cached(linked)

	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"size"]), 3, "等级 / 连线不同应各自成 key")


func test_ac8_failed_assembly_is_cached_too() -> void:
	# 非法配置的错误码是确定性的，重复重算没意义
	var slot := _slot(&"frost_shard", [])
	slot.active_gem = null
	var a := SocketGraph.assemble_cached(slot)
	var b := SocketGraph.assemble_cached(slot)
	assert_false(a.ok)
	assert_false(b.ok)
	# 无主动宝石的槽不缓存（key 为空），两次都应 miss
	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"misses"]), 2, "空槽不缓存")
	assert_eq(int(st[&"hits"]), 0)

	# 有主动宝石但不兼容 → 应缓存失败结果
	var bad := _slot(&"frost_shard", [])
	bad.supports.append(_fake_melee_support())
	var c := SocketGraph.assemble_cached(bad)
	var d := SocketGraph.assemble_cached(bad)
	assert_false(c.ok, "不兼容应失败")
	assert_eq(c.error_code, d.error_code)
	assert_eq(int(SocketGraph.cache_stats()[&"hits"]), 1, "失败结果也应命中缓存")


func test_ac9_clear_cache_resets_stats() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi"])
	SocketGraph.assemble_cached(slot)
	SocketGraph.assemble_cached(slot)
	assert_gt(int(SocketGraph.cache_stats()[&"size"]), 0)

	SocketGraph.clear_cache()
	var st := SocketGraph.cache_stats()
	assert_eq(int(st[&"size"]), 0)
	assert_eq(int(st[&"hits"]), 0)
	assert_eq(int(st[&"misses"]), 0)


func test_ac10_cache_key_is_stable() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi", &"support_area"])
	var k1 := SocketGraph.cache_key(slot)
	var k2 := SocketGraph.cache_key(slot)
	assert_eq(k1, k2)
	assert_true(k1.contains("frost_shard"), "key 里应含 gem_id 便于调试")
	var empty := SkillSlot.new()
	assert_eq(SocketGraph.cache_key(empty), "", "无主动宝石不生成 key")


func _fake_melee_support() -> SupportGemData:
	var g := SupportGemData.new()
	g.support_id = &"fake_melee"
	g.display_name = "测试用近战辅助"
	g.require_tags.assign([&"melee"])
	g.cost_multiplier = 1.0
	return g
