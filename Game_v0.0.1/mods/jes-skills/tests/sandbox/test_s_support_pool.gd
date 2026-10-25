# S4 实验台数据池测试：辅助宝石池自洽性 + 装配语义（兼容/不兼容/互斥/连乘）
# 独立于 M0~M8 基线；不依赖 UI 节点，只测数据与通用管线。
extends GutTest



# ---------- 数据池自洽 ----------

## 池非空、id 唯一、展示名非空
func test_lab1_pool_integrity() -> void:
	var pool: Array = GemRegistry.supports()
	assert_gt(pool.size(), 0, "辅助池不应为空")
	var seen := {}
	for s in pool:
		var sp: SupportGemData = s
		assert_ne(sp.support_id, &"", "support_id 不可为空")
		assert_false(seen.has(sp.support_id), "support_id 不可重复：%s" % sp.support_id)
		seen[sp.support_id] = true
		assert_ne(sp.display_name, "", "display_name 不可为空：%s" % sp.support_id)

## 每个辅助至少能挂在 7 个演示技能之一上（否则池里有死数据）
func test_lab2_every_support_matches_some_skill() -> void:
	var skills: Array = GemRegistry.skills()
	for s in GemRegistry.supports():
		var sp: SupportGemData = s
		var matched := false
		for sk in skills:
			var slot := SkillSlot.new()
			slot.active_gem = sk
			slot.supports.append(sp)
			if SocketGraph.assemble(slot).ok:
				matched = true
				break
		assert_true(matched, "辅助 %s 与任何技能都不兼容（死数据）" % sp.support_id)


# ---------- 装配语义 ----------

## 不兼容：多重投射（require projectile）挂烈焰爆发 → 整组失败
func test_lab3_incompatible_support_fails_whole_group() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"fire_burst")
	slot.supports.append(GemRegistry.support(&"support_multi"))
	var res := SocketGraph.assemble(slot)
	assert_false(res.ok, "不兼容辅助必须整体失败")
	assert_eq(res.error_code, AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT)
	assert_eq(res.error_support_id, &"support_multi", "应指明问题辅助")

## 连乘：霜矛 + 多重(1.4) + 寒冷聚焦(1.2) = 1.68；耗魔 10 → 16.8
func test_lab4_cost_multiplier_chains() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.supports.append(GemRegistry.support(&"support_multi"))
	slot.supports.append(GemRegistry.support(&"support_cold_focus"))
	var res := SocketGraph.assemble(slot)
	assert_true(res.ok, "兼容辅助应装配成功")
	assert_almost_eq(res.cost_multiplier, 1.68, 0.0001, "耗魔倍率应连乘")
	assert_almost_eq(CostCalculator.compute_cost(GemRegistry.skill(&"frost_shard"), res.cost_multiplier, 1.0),
		16.8, 0.0001, "最终耗魔应为 16.8")

## behavior_overrides 生效：穿透 +2 落到计划参数
func test_lab5_pierce_override_reaches_plan() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.supports.append(GemRegistry.support(&"support_pierce"))
	var res := SocketGraph.assemble(slot)
	assert_true(res.ok)
	var plans := SkillExecutor.cast(GemRegistry.skill(&"frost_shard"), 1, StatsComponent.new(), [],
		res.behavior_overrides)
	assert_gt(plans.size(), 0)
	assert_eq(int(plans[0][&"params"].get(&"pierce")), 2, "穿透应 +2")

## stat_modifiers 生效：范围扩大 → area_mult 1.3；寒冷聚焦 → 冷伤 100→150
func test_lab6_stat_modifiers_reach_pipeline() -> void:
	var gem: SkillData = GemRegistry.skill(&"frost_shard")
	var slot := SkillSlot.new()
	slot.active_gem = gem
	slot.supports.append(GemRegistry.support(&"support_area"))
	slot.supports.append(GemRegistry.support(&"support_cold_focus"))
	var res := SocketGraph.assemble(slot)
	assert_true(res.ok)
	var stats := StatsComponent.new()
	stats.add_modifiers(res.modifiers, &"test_src")
	var plans := SkillExecutor.cast(gem, 1, stats, [], res.behavior_overrides)
	stats.remove_by_source(&"test_src")
	assert_almost_eq(float(plans[0].get(&"area_mult", 0.0)), 1.3, 0.0001, "范围倍率应 1.3")
	assert_almost_eq(float(plans[0][&"elements"].get(&"cold", 0.0)), 150.0, 0.0001,
		"寒冷伤害 100 × 1.5 = 150")

## 互斥：同时挂寒冷聚焦与烈焰专注 → ERR_CONFLICT（用 add_tags 打开火的兼容性）
func test_lab7_conflict_detected() -> void:
	var opener := SupportGemData.new()
	opener.support_id = &"test_opener"
	opener.add_tags = [&"fire"] as Array[StringName]

	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.supports.append(opener)
	slot.supports.append(GemRegistry.support(&"support_cold_focus"))
	slot.supports.append(GemRegistry.support(&"support_fire_focus"))
	var res := SocketGraph.assemble(slot)
	assert_false(res.ok, "互斥辅助必须失败")
	assert_eq(res.error_code, AssemblyResult.ErrorCode.ERR_CONFLICT)

## 卸下还原：装上再卸下，伤害逐位等于装配前（G6）
func test_lab8_unload_restores_exactly() -> void:
	var gem: SkillData = GemRegistry.skill(&"frost_shard")
	var stats := StatsComponent.new()
	var before := SkillExecutor.cast(gem, 1, stats, [])
	var slot := SkillSlot.new()
	slot.active_gem = gem
	slot.supports.append(GemRegistry.support(&"support_cold_focus"))
	var res := SocketGraph.assemble(slot)
	stats.add_modifiers(res.modifiers, &"slot_0")
	var during := SkillExecutor.cast(gem, 1, stats, [], res.behavior_overrides)
	stats.remove_by_source(&"slot_0")
	var after := SkillExecutor.cast(gem, 1, stats, [])
	assert_almost_eq(float(during[0][&"elements"][&"cold"]), 150.0, 0.0001, "装上加成为 150")
	assert_eq(float(after[0][&"elements"][&"cold"]), float(before[0][&"elements"][&"cold"]),
		"卸下后必须逐位还原")


# ---------- 镶嵌前置校验（PoE2 语义，2026-10-19 R1）----------

## 不兼容的辅助：镶嵌准入直接拒绝（暗影冲刺 + 弹道加速）
func test_lab9_socket_check_rejects_incompatible() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"shadow_dash")
	slot.socket_count = SandboxMain.SOCKET_COUNT
	var chk := SocketGraph.socket_check(slot, GemRegistry.support(&"support_velocity"))
	assert_false(chk.ok, "不兼容辅助不得镶嵌")
	assert_eq(chk.error_code, AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT)
	assert_false(SocketGraph.can_socket(slot, GemRegistry.support(&"support_velocity")))

## 兼容的辅助：镶嵌准入通过，且与 assemble 结果一致
func test_lab10_socket_check_accepts_compatible() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.socket_count = SandboxMain.SOCKET_COUNT
	assert_true(SocketGraph.can_socket(slot, GemRegistry.support(&"support_multi")))
	slot.supports.append(GemRegistry.support(&"support_multi"))
	assert_true(SocketGraph.can_socket(slot, GemRegistry.support(&"support_pierce")), "第二个兼容辅助仍可镶嵌")

## 互斥：已挂寒冷聚焦时，烈焰专注的镶嵌必须被拒（先用 add_tags 打开 fire）
func test_lab11_socket_check_rejects_conflict() -> void:
	var opener := SupportGemData.new()
	opener.support_id = &"test_opener"
	opener.add_tags = [&"fire"] as Array[StringName]

	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.socket_count = SandboxMain.SOCKET_COUNT
	slot.supports.append(opener)
	slot.supports.append(GemRegistry.support(&"support_cold_focus"))
	var chk := SocketGraph.socket_check(slot, GemRegistry.support(&"support_fire_focus"))
	assert_false(chk.ok, "互斥辅助不得镶嵌")
	assert_eq(chk.error_code, AssemblyResult.ErrorCode.ERR_CONFLICT)

## 孔位上限：满了之后 INSERT 直接被拒（ERR_NO_SOCKET）
func test_lab12_socket_check_respects_capacity() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.socket_count = 1
	slot.supports.append(GemRegistry.support(&"support_multi"))
	var chk := SocketGraph.socket_check(slot, GemRegistry.support(&"support_area"))
	assert_false(chk.ok, "孔位已满时不得镶嵌")
	assert_eq(chk.error_code, AssemblyResult.ErrorCode.ERR_NO_SOCKET)


## P-26 配套：范围扩大禁止移动类（位移距离不吃范围，D-40）——三个冲刺技能全部拒绝装配
func test_lab15_area_support_rejects_movement_skills() -> void:
	for id in [&"shadow_dash", &"rift_step", &"breach_roll"]:
		var slot := SkillSlot.new()
		slot.active_gem = GemRegistry.skill(id)
		var chk := SocketGraph.socket_check(slot, GemRegistry.support(&"support_area"))
		assert_false(chk.ok, "范围扩大应拒绝移动类技能 %s" % id)
		assert_eq(chk.error_code, AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT)
	# 反向：非移动类仍可装配（霜矛）
	var ok_slot := SkillSlot.new()
	ok_slot.active_gem = GemRegistry.skill(&"frost_shard")
	var ok_chk := SocketGraph.socket_check(ok_slot, GemRegistry.support(&"support_area"))
	assert_true(ok_chk.ok, "非移动类技能（霜矛）装配范围扩大不受影响")

## G7 保留：绕过 UI 直接构造非法配置，assemble 仍必须 fail-fast 并给错误码
func test_lab13_g7_still_fails_on_illegal_config() -> void:
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"fire_burst")
	slot.socket_count = SandboxMain.SOCKET_COUNT
	slot.supports.append(GemRegistry.support(&"support_multi"))   # 绕过 socket_check
	var res := SocketGraph.assemble(slot)
	assert_false(res.ok, "G7：非法配置装配必须失败")
	assert_eq(res.error_code, AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT)
	assert_eq(res.error_support_id, &"support_multi", "必须指明问题辅助")

## 池全量一致性：can_socket 为真 ⇒ assemble 必真；为假 ⇒ 该颗是问题源或孔位满
func test_lab14_socket_check_consistent_with_assemble() -> void:
	var gem: SkillData = GemRegistry.skill(&"frost_shard")
	for s in GemRegistry.supports():
		var sp: SupportGemData = s
		var slot := SkillSlot.new()
		slot.active_gem = gem
		slot.socket_count = SandboxMain.SOCKET_COUNT
		var probe := SocketGraph.socket_check(slot, sp)
		if probe.ok:
			slot.supports.append(sp)
			assert_true(SocketGraph.assemble(slot).ok,
				"准入通过后 assemble 必须也通过：%s" % sp.support_id)
		else:
			assert_true(probe.error_code == AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT
					or probe.error_code == AssemblyResult.ErrorCode.ERR_NO_SOCKET,
				"拒绝原因应为不兼容或孔位满：%s" % sp.support_id)
