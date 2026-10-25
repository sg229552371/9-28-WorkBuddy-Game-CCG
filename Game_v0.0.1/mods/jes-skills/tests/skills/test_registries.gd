# 注册表测试（规格 §3.5 / §10 util）：
#   StatRegistry —— 属性名唯一真源、整数型末端 floor 唯一收口
#   TagRegistry  —— 标签名唯一真源、与元素表对齐
# 核心价值不是"函数能跑"，而是**内容里的拼写错误会被抓出来**：
# stat 写错一个字不会报错，只会静默不生效，这类 bug 只能靠注册表 + 遍历内容断言拦住。
extends GutTest


# ---------------- StatRegistry ----------------

func test_r1_every_def_is_well_formed() -> void:
	var legal := [StatRegistry.AGG_FLAT, StatRegistry.AGG_INCREASED,
			StatRegistry.AGG_MULT_BASE, StatRegistry.AGG_FLAT_THEN_ROUND]
	for stat in StatRegistry.DEFS:
		var d: Dictionary = StatRegistry.DEFS[stat]
		assert_true(d.has(&"default"), "%s 必须声明 default" % stat)
		assert_true(d.has(&"aggregate"), "%s 必须声明 aggregate" % stat)
		assert_true(legal.has(d[&"aggregate"]),
				"%s 的 aggregate「%s」不是合法聚合方式" % [stat, d[&"aggregate"]])


func test_r2_int_stats_match_flat_then_round() -> void:
	# INT_STATS 是从 DEFS 派生的，两处一旦不同步就会「某个整数属性没 floor」
	var derived: Array = []
	for stat in StatRegistry.DEFS:
		if StatRegistry.DEFS[stat][&"aggregate"] == StatRegistry.AGG_FLAT_THEN_ROUND:
			derived.append(stat)
	assert_eq(derived.size(), StatRegistry.INT_STATS.size(),
			"INT_STATS 数量应与 DEFS 里 flat_then_round 的条目数一致")
	for stat in derived:
		assert_true(StatRegistry.INT_STATS.has(stat), "%s 应出现在 INT_STATS" % stat)


func test_r3_finalize_floors_only_int_stats() -> void:
	# 整数型：末端 floor（中途不取整，所以 3.9 到末端才变 3）
	assert_eq(StatRegistry.finalize(&"projectile_count", 3.9), 3.0)
	assert_eq(StatRegistry.finalize(&"chain_count", 2.999), 2.0)
	# 非整数型：原样返回，绝不截断
	assert_almost_eq(StatRegistry.finalize(&"area_size", 1.35), 1.35, 0.0001)
	assert_almost_eq(StatRegistry.finalize(&"crit_chance", 29.9), 29.9, 0.0001)


func test_r4_element_names_are_registered_and_consistent() -> void:
	for el in StatRegistry.ELEMENTS:
		var dmg := StatRegistry.element_damage_stat(el)
		var res := StatRegistry.resist_stat(el)
		assert_true(StatRegistry.has_stat(dmg), "元素伤害 stat %s 未注册" % dmg)
		assert_true(StatRegistry.has_stat(res), "抗性 stat %s 未注册" % res)
		assert_eq(dmg, StringName(String(el) + "_damage"))
		assert_eq(res, StringName(String(el) + "_resistance"))
	# 反向：DEFS 里不许有「不在 ELEMENTS 里却叫 *_damage」的孤儿条目
	# （minion_damage 这类非元素伤害在 NON_ELEMENT_DAMAGE_STATS 里显式豁免）
	for stat in StatRegistry.DEFS:
		if StatRegistry.NON_ELEMENT_DAMAGE_STATS.has(stat):
			continue
		var s := String(stat)
		if s.ends_with("_damage") and s != "crit_multi":
			var el := StringName(s.trim_suffix("_damage"))
			assert_true(StatRegistry.ELEMENTS.has(el), "%s 的元素「%s」不在 ELEMENTS" % [stat, el])


func test_r5_unknown_stat_is_reported() -> void:
	var unknown := StatRegistry.unknown_in([&"fire_damage", &"fier_damage", &"crit_chance", &"area_size"])
	assert_eq(unknown.size(), 1, "只有拼错的那个应被报出来")
	assert_eq(unknown[0], &"fier_damage")


func test_r6_defaults_are_sane() -> void:
	# 倍率型默认 1.0（乘 1 不改变结果）；计数型默认符合「没有词缀时的行为」
	assert_almost_eq(StatRegistry.default_of(&"area_size"), 1.0, 0.0001)
	assert_almost_eq(StatRegistry.default_of(&"projectile_count"), 1.0, 0.0001, "默认 1 发")
	assert_almost_eq(StatRegistry.default_of(&"pierce"), 0.0, 0.0001, "默认不穿透")
	assert_almost_eq(StatRegistry.default_of(&"crit_chance"), 0.0, 0.0001, "无基础暴击率")


# ---------------- TagRegistry ----------------

func test_r7_every_tag_has_legal_kind() -> void:
	var legal := [TagRegistry.KIND_DAMAGE, TagRegistry.KIND_CAST, TagRegistry.KIND_FORM]
	for tag in TagRegistry.DEFS:
		var kind: StringName = TagRegistry.DEFS[tag][&"kind"]
		assert_true(legal.has(kind), "标签 %s 的 kind「%s」不合法" % [tag, kind])


func test_r8_damage_tags_match_elements() -> void:
	# 两张表必须一一对应：元素伤害按 tag 判定，tag 少一个就有一系伤害永远吃不到词缀
	var damage_tags: Array = TagRegistry.tags_of_kind(TagRegistry.KIND_DAMAGE)
	assert_eq(damage_tags.size(), StatRegistry.ELEMENTS.size(),
			"damage_type 标签数应与 ELEMENTS 数量一致")
	for el in StatRegistry.ELEMENTS:
		assert_true(damage_tags.has(el), "%s 缺少对应的 damage_type 标签" % el)


func test_r9_unknown_tag_is_reported() -> void:
	var unknown := TagRegistry.unknown_in([&"spell", &"projectile", &"projetile", &"cold"])
	assert_eq(unknown.size(), 1)
	assert_eq(unknown[0], &"projetile")


# ---------------- 内容一致性（最关键的两条） ----------------

func test_r10_all_content_stats_are_registered() -> void:
	# 遍历全部内容：技能基础伤害键、辅助词缀、behavior_overrides 的 stat 键
	var used: Array = []
	for skill in GemRegistry.skills():
		for part in skill.parts:
			for el in part.base_damage:
				used.append(StatRegistry.element_damage_stat(el))
	for sup in GemRegistry.supports():
		for spec in sup.stat_modifiers:
			used.append(spec.stat)
	var unknown := StatRegistry.unknown_in(used)
	assert_eq(unknown, [], "内容里出现未注册的 stat：%s" % str(unknown))


func test_r11_all_content_tags_are_registered() -> void:
	var used: Array = []
	for skill in GemRegistry.skills():
		for t in skill.tags:
			used.append(t)
		for t in skill.allowed_support_tags:
			used.append(t)
	for sup in GemRegistry.supports():
		for t in sup.require_tags:
			used.append(t)
		for t in sup.exclude_tags:
			used.append(t)
		for t in sup.add_tags:
			used.append(t)
	var unknown := TagRegistry.unknown_in(used)
	assert_eq(unknown, [], "内容里出现未注册的标签：%s" % str(unknown))


# ---------------- 与执行器打通 ----------------

func test_r12_executor_uses_registry_int_stats() -> void:
	# 回归防线：SkillExecutor 曾经自己写了一份 INT_STATS。
	# 现在它读 Registry，这里验证「整数型 stat 的 floor 只在末端发生一次」：
	# 多重投射 +2 与 area_size 1.35 同时存在时，投射物数必须是整数、范围必须保留小数。
	var slot := SkillSlot.new()
	slot.active_gem = GemRegistry.skill(&"frost_shard")
	slot.socket_count = 6
	slot.supports.append(GemRegistry.support(&"support_multi"))

	var res := SocketGraph.assemble(slot)
	assert_true(res.ok)

	var stats := StatsComponent.new()
	stats.add_modifiers(res.modifiers, &"test")

	var area := StatModifier.new()
	area.stat = &"area_size"
	area.op = StatModifier.Op.INCREASED
	area.value = 35.0
	stats.add_modifier(area)

	var plans := SkillExecutor.cast(slot.active_gem, 1, stats, [], res.behavior_overrides)
	assert_gt(plans.size(), 1, "多重投射应产出多条计划")
	var params: Dictionary = plans[0][&"params"]
	assert_eq(int(params[&"projectile_count"]), 3, "1 基础 + 2 = 3 发（整数）")
	assert_almost_eq(float(plans[0][&"area_mult"]), 1.35, 0.0001, "范围倍率不得被 floor")
