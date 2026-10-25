# MinionRegistry 测试（规格 §8.2 三条规则）
#   ① 只继承指定子集（minion_damage / minion_attack_speed / minion_life）
#   ② 出招复用 bhv_* / SkillExecutor，不新写一套
#   ③ max_count 到达时新召唤顶掉最旧的
extends GutTest


func _mod(stat: StringName, op: int, value: float, source: StringName = &"caster") -> StatModifier:
	var m := StatModifier.new()
	m.stat = stat
	m.op = op
	m.value = value
	m.source_id = source
	return m


func _caster_stats() -> StatsComponent:
	var s := StatsComponent.new()
	s.add_modifier(_mod(&"minion_damage", StatModifier.Op.FLAT_ADD, 30.0))
	s.add_modifier(_mod(&"minion_attack_speed", StatModifier.Op.INCREASED, 20.0))
	s.add_modifier(_mod(&"minion_life", StatModifier.Op.FLAT_ADD, 50.0))
	# 以下三项**不应**被继承
	s.add_modifier(_mod(&"crit_chance", StatModifier.Op.FLAT_ADD, 40.0))
	s.add_modifier(_mod(&"armor", StatModifier.Op.FLAT_ADD, 200.0))
	s.add_modifier(_mod(&"fire_damage", StatModifier.Op.INCREASED, 80.0))
	return s


func test_m1_inherits_only_whitelist_subset() -> void:
	var reg := MinionRegistry.new()
	var res := reg.spawn(_caster_stats(), null, 1, 0.0, 4)
	var rec = res[&"record"]
	var st: StatsComponent = rec.stats

	assert_almost_eq(st.aggregate(&"minion_damage", StatModifier.Op.FLAT_ADD), 30.0, 0.0001)
	assert_almost_eq(st.aggregate(&"minion_attack_speed", StatModifier.Op.INCREASED), 20.0, 0.0001)
	assert_almost_eq(st.aggregate(&"minion_life", StatModifier.Op.FLAT_ADD), 50.0, 0.0001)

	# 关键否定断言：施法者的暴击/护甲/火伤不得被继承
	assert_almost_eq(st.aggregate(&"crit_chance", StatModifier.Op.FLAT_ADD), 0.0, 0.0001,
			"召唤物不应继承暴击率")
	assert_almost_eq(st.aggregate(&"armor", StatModifier.Op.FLAT_ADD), 0.0, 0.0001,
			"召唤物不应继承护甲")
	assert_almost_eq(st.aggregate(&"fire_damage", StatModifier.Op.INCREASED), 0.0, 0.0001,
			"召唤物不应继承施法者伤害词缀")


func test_m2_inherited_modifiers_are_independent_copies() -> void:
	# 继承必须是拷贝：改召唤物属性不能反向污染施法者
	var caster := _caster_stats()
	var reg := MinionRegistry.new()
	var rec = reg.spawn(caster, null, 1, 0.0, 4)[&"record"]
	rec.stats.add_modifier(_mod(&"minion_damage", StatModifier.Op.FLAT_ADD, 999.0, &"minion"))
	assert_almost_eq(caster.aggregate(&"minion_damage", StatModifier.Op.FLAT_ADD), 30.0, 0.0001,
			"施法者属性不得被召唤物改动")


func test_m3_evicts_oldest_when_cap_reached() -> void:
	var reg := MinionRegistry.new()
	var a = reg.spawn(null, null, 1, 0.0, 2)[&"record"]
	var b = reg.spawn(null, null, 1, 0.0, 2)[&"record"]
	assert_eq(reg.active_count(), 2)

	var res := reg.spawn(null, null, 1, 0.0, 2)
	assert_eq(reg.active_count(), 2, "上限 2，召唤第 3 只后仍是 2")
	var evicted: Array = res[&"evicted"]
	assert_eq(evicted.size(), 1, "应顶掉 1 只")
	assert_same(evicted[0], a, "被顶掉的必须是最旧的（a）")
	assert_eq(reg.evicted_total, 1)

	# b 还在
	var ids: Array = []
	for r in reg.records():
		ids.append(r.id)
	assert_true(ids.has(b.id))


func test_m4_per_skill_counting() -> void:
	# 传了 skill 就按技能分别计数（"每种召唤物各最多 N 只"）
	var reg := MinionRegistry.new()
	var s1 := GemRegistry.skill(&"spirit_summon")
	var s2 := GemRegistry.skill(&"frost_shard")
	reg.spawn(null, s1, 1, 0.0, 1)
	var res := reg.spawn(null, s2, 1, 0.0, 1)
	assert_eq((res[&"evicted"] as Array).size(), 0, "不同技能各自计数，不应互相顶掉")
	assert_eq(reg.active_count(), 2)


func test_m5_expiry_returns_records() -> void:
	var reg := MinionRegistry.new()
	var a = reg.spawn(null, null, 1, 0.5, 4)[&"record"]
	reg.spawn(null, null, 1, 0.5, 4)
	assert_eq(reg.tick(0.3).size(), 0, "未到期")
	var expired := reg.tick(0.3)
	assert_eq(expired.size(), 2, "累计 0.6s > 0.5s 应全部过期")
	assert_eq(reg.active_count(), 0)
	assert_same(expired[0], a)


func test_m6_zero_lifetime_is_permanent() -> void:
	var reg := MinionRegistry.new()
	reg.spawn(null, null, 1, 0.0, 4)
	assert_eq(reg.tick(9999.0).size(), 0, "lifetime=0 表示永久，只受 max_count 约束")
	assert_eq(reg.active_count(), 1)


func test_m7_hard_cap_is_enforced() -> void:
	# 即使配置写了离谱的 max_count，也不能无限召唤
	var reg := MinionRegistry.new()
	for i in MinionRegistry.HARD_CAP + 10:
		reg.spawn(null, null, 1, 0.0, 99999)
	assert_eq(reg.active_count(), MinionRegistry.HARD_CAP,
			"全局硬上限必须兜住（防配置写错）")


func test_m8_cast_plans_reuse_skill_executor() -> void:
	# ② 召唤物出招走同一个 SkillExecutor，不新写一套行为分派
	var reg := MinionRegistry.new()
	var skill := GemRegistry.skill(&"frost_shard")
	var rec = reg.spawn(_caster_stats(), skill, 1, 0.0, 4)[&"record"]
	var plans := reg.cast_plans(rec)
	assert_gt(plans.size(), 0, "应产出行为计划")
	assert_eq(plans[0][&"behavior_id"], &"bhv_projectile", "复用 bhv_projectile 计划格式")


func test_m9_despawn_and_clear() -> void:
	var reg := MinionRegistry.new()
	var a = reg.spawn(null, null, 1, 0.0, 4)[&"record"]
	reg.spawn(null, null, 1, 0.0, 4)
	assert_true(reg.despawn(a))
	assert_eq(reg.active_count(), 1)
	assert_false(reg.despawn(a), "重复移除返回 false")

	var all := reg.clear_all()
	assert_eq(all.size(), 1)
	assert_eq(reg.active_count(), 0)


func test_m10_inherited_source_id_is_marked() -> void:
	# 继承来的词缀用独立 source_id，施法者卸下自己的词缀时不会误删召唤物的
	var reg := MinionRegistry.new()
	var rec = reg.spawn(_caster_stats(), null, 1, 0.0, 4)[&"record"]
	for m in rec.stats.get_modifiers():
		assert_eq(m.source_id, &"minion_inherit")
