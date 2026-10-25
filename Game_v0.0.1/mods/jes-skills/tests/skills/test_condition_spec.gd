# ConditionSpec 测试（规格 §6 第 4 条）：条件门机制。
#
# 规格只要求"可表达"，不要求有具体辅助宝石内容 —— 所以这里的断言全部是机制层：
#   判定正确、AND 语义、缺失上下文时保守不生效、与 SkillInstance 打通。
extends GutTest


func _ctx(tags: Array = [], level: int = 1, slot_index: int = 0,
		rare: bool = false, initial: bool = false) -> Dictionary:
	return {
		&"tags": tags,
		&"level": level,
		&"slot_index": slot_index,
		&"is_rare": rare,
		&"is_initial": initial,
	}


func test_k1_always_is_true() -> void:
	assert_true(ConditionSpec.always().matches(_ctx()))
	assert_true(ConditionSpec.always().matches({}), "无条件即使上下文为空也应生效")


func test_k2_has_tag() -> void:
	var c := ConditionSpec.has_tag(&"projectile")
	assert_true(c.matches(_ctx([&"spell", &"projectile"])))
	assert_false(c.matches(_ctx([&"spell", &"melee"])))


func test_k3_not_has_tag() -> void:
	var c := ConditionSpec.not_has_tag(&"melee")
	assert_true(c.matches(_ctx([&"spell", &"projectile"])))
	assert_false(c.matches(_ctx([&"attack", &"melee"])))


func test_k4_rare_and_initial_default_false() -> void:
	# 辅助宝石条件用的两个标记位：没有外部设置时必须保守为 false
	var ctx := _ctx()
	assert_false(ConditionSpec.is_rare().matches(ctx), "默认不是稀有技能")
	assert_false(ConditionSpec.is_initial().matches(ctx), "默认不是初始技能")
	assert_true(ConditionSpec.is_rare().matches(_ctx([], 1, 0, true)))
	assert_true(ConditionSpec.is_initial().matches(_ctx([], 1, 0, false, true)))


func test_k5_level_threshold_is_inclusive() -> void:
	var c := ConditionSpec.level_at_least(5)
	assert_false(c.matches(_ctx([], 4)))
	assert_true(c.matches(_ctx([], 5)), "达到阈值即成立（含等于）")
	assert_true(c.matches(_ctx([], 6)))


func test_k6_slot_equals() -> void:
	var c := ConditionSpec.slot_equals(3)
	assert_true(c.matches(_ctx([], 1, 3)))
	assert_false(c.matches(_ctx([], 1, 2)))


func test_k7_all_match_is_and_semantics() -> void:
	var conds := [ConditionSpec.has_tag(&"projectile"), ConditionSpec.level_at_least(3)]
	assert_true(ConditionSpec.all_match(conds, _ctx([&"projectile"], 3)))
	assert_false(ConditionSpec.all_match(conds, _ctx([&"projectile"], 2)), "等级不够应整体不生效")
	assert_false(ConditionSpec.all_match(conds, _ctx([&"melee"], 3)), "标签不符应整体不生效")


func test_k8_empty_condition_list_passes() -> void:
	# 空条件 = 无门槛。这一点保证"没配条件的内容行为不变"
	assert_true(ConditionSpec.all_match([], _ctx()))
	assert_true(ConditionSpec.all_match([null], _ctx()), "null 条目应被跳过而不是崩")


func test_k9_missing_context_fails_closed() -> void:
	# 拿不到证据 → 条件不成立（fail-closed）。
	# 反过来（fail-open）会让缺数据时词缀意外生效，是更危险的方向。
	assert_false(ConditionSpec.has_tag(&"fire").matches({}))
	assert_false(ConditionSpec.level_at_least(1).matches({}))
	assert_false(ConditionSpec.slot_equals(0).matches({}))


func test_k10_instance_context_reflects_slot_state() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.active_level = 4
	slot.slot_index = 2
	var bar := SkillSlotBar.new()
	bar.bind_slot(2, slot)
	var inst := bar.instance_of(2)

	var ctx := inst.condition_context()
	assert_eq(ctx[&"level"], 4)
	assert_eq(ctx[&"slot_index"], 2)
	assert_true((ctx[&"tags"] as Array).has(&"projectile"))
	assert_false(bool(ctx[&"is_rare"]))

	assert_true(inst.conditions_pass([ConditionSpec.has_tag(&"projectile")]))
	assert_false(inst.conditions_pass([ConditionSpec.is_rare()]))

	# 外部把标记位打开后，条件立刻成立（辅助宝石的条件就是这样驱动）
	inst.is_rare = true
	assert_true(inst.conditions_pass([ConditionSpec.is_rare()]))
	assert_true(inst.conditions_pass([
		ConditionSpec.is_rare(), ConditionSpec.level_at_least(4)]))
