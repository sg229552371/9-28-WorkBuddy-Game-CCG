# SkillInstance 测试（规格 §5.1 / §5.3 / §13.1 第 5 条）
#
# 两条最重要的约束：
#   1. **不持有插槽数据副本** —— 换技能/换辅助直接改 SkillSlot，实例必须立刻看到；
#      若实例复制了一份 supports，玩家装上去的辅助会"实例里看不见"。
#   2. **冷却跟着槽走** —— 切武器栏重建实例不能白送冷却重置（否则可以无限放技能）。
extends GutTest


func before_each() -> void:
	SocketGraph.clear_cache()


func _slot(gem_id: StringName, supports: Array = []) -> SkillSlot:
	var s := SkillSlot.new()
	s.active_gem = GemRegistry.skill(gem_id)
	s.active_level = 1
	s.socket_count = 6
	for id in supports:
		s.supports.append(GemRegistry.support(id))
	return s


func test_i1_one_slot_one_instance() -> void:
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var a := bar.instance_of(0)
	var b := bar.instance_of(0)
	assert_not_null(a)
	assert_same(a, b, "同一槽重复取实例必须返回同一个对象")


func test_i2_instance_does_not_copy_slot_data() -> void:
	# §13.1 第 5 条：单一真源在 SkillSlot
	var slot := _slot(&"frost_shard")
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, slot)
	var inst := bar.instance_of(0)

	assert_eq(inst.skill().gem_id, &"frost_shard")

	# 直接改槽（模拟玩家换技能），实例必须立刻看到
	slot.active_gem = GemRegistry.skill(&"fire_burst")
	assert_eq(inst.skill().gem_id, &"fire_burst", "实例必须读 slot 而非自己的副本")


func test_i3_support_change_triggers_reassembly() -> void:
	var slot := _slot(&"frost_shard")
	var inst := SkillSlotBar.new()
	inst.bind_slot(0, slot)
	var instance := inst.instance_of(0)

	var a := instance.assembly()
	assert_true(a.ok)
	var before := instance.rebuild_count
	assert_eq(int(a.behavior_overrides.get(&"projectile_count", {}).get(&"add", 0)), 0)

	slot.supports.append(GemRegistry.support(&"support_multi"))
	var b := instance.assembly()
	assert_true(b.ok, "装上兼容辅助后仍应装配成功")
	assert_gt(instance.rebuild_count, before, "配置变了必须重装配")
	assert_eq(int(b.behavior_overrides[&"projectile_count"][&"add"]), 2,
			"重装配后应看到新的 behavior_overrides")


func test_i4_unchanged_config_reuses_assembly() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi"])
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, slot)
	var inst := bar.instance_of(0)

	inst.assembly()
	var before := inst.rebuild_count
	for i in 5:
		inst.assembly()
	assert_eq(inst.rebuild_count, before, "配置未变不得重复装配")


func test_i5_cooldown_follows_slot_across_rebuild() -> void:
	# 切武器栏 → 重建实例，但冷却对象必须沿用，否则等于白送重置
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var inst_a := bar.instance_of(0)
	var cd := inst_a.cooldown
	assert_not_null(cd)
	# 显式给一个非零冷却：frost_shard 本身无冷却，不能靠内容数值来测这段逻辑
	cd.configure(2.0, 1.0, 0, 0.0)
	cd.start()
	assert_false(cd.is_ready(), "进入冷却")

	var inst_b := bar.rebuild_instance(0)
	assert_ne(inst_a, inst_b, "重建应产生新实例")
	assert_same(inst_b.cooldown, cd, "冷却对象必须沿用（冷却跟着槽走）")
	assert_false(inst_b.is_ready(), "重建后不得白送就绪")


func test_i6_begin_has_no_side_effects() -> void:
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var inst := bar.instance_of(0)
	assert_true(inst.is_ready())

	var res := inst.begin()
	assert_true(res != null and res.ok)
	assert_true(inst.is_ready(), "begin 只做装配与就绪判定，不得扣冷却")


func test_i7_commit_consumes_cooldown() -> void:
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var inst := bar.instance_of(0)
	inst.cooldown.configure(2.0, 1.0, 0, 0.0)   # 非零冷却
	inst.begin()
	inst.commit()
	assert_false(inst.is_ready(), "commit 后进入冷却")


func test_i8_cast_plans_use_current_assembly() -> void:
	var slot := _slot(&"frost_shard", [&"support_multi"])
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, slot)
	var inst := bar.instance_of(0)

	var stats := StatsComponent.new()
	var plans := inst.cast_plans(stats)
	assert_eq(plans.size(), 3, "多重投射 +2 → 3 条计划")

	# 卸下辅助后立刻回到单发（证明没有缓存旧装配）
	slot.supports.clear()
	var plans2 := inst.cast_plans(stats)
	assert_eq(plans2.size(), 1, "卸下后应回到 1 发")


func test_i9_rebind_invalidates_instance() -> void:
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var old := bar.instance_of(0)

	bar.bind_slot(0, _slot(&"fire_burst"))
	var now := bar.instance_of(0)
	assert_ne(old, now, "换绑槽位后应得到新实例")
	assert_eq(now.skill().gem_id, &"fire_burst")


func test_i10_out_of_range_is_safe() -> void:
	var bar := SkillSlotBar.new()
	assert_null(bar.instance_of(-1))
	assert_null(bar.instance_of(99))
	assert_null(bar.rebuild_instance(99))
	# 槽 0 未绑定时也不得崩
	assert_null(bar.instance_of(0))


func test_i11_insufficient_resource_does_not_commit() -> void:
	# 沙盒语义：资源不足不进入 cast（§8.3）—— 表现为 begin 成功但调用方不 commit。
	# 这里验证"只 begin 不 commit"确实不消耗冷却，这是资源判定能插在中间的前提。
	var bar := SkillSlotBar.new()
	bar.bind_slot(0, _slot(&"frost_shard"))
	var inst := bar.instance_of(0)
	var res := inst.begin()
	assert_true(res.ok)
	# 模拟资源不足：直接返回，不 commit
	assert_true(inst.is_ready(), "未 commit 前应保持就绪")
