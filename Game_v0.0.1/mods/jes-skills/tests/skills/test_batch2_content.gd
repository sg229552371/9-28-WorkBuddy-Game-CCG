# 第 2 批 12 技能内容契约测试（D-38 拍板后按《内容规划_主动技能第2批_12个_v1》§9 第 3 步落地）
#
# 八条断言对应规划稿验收清单：
#   B1 12 个技能标识存在且来自磁盘   B2 标签全部注册     B3 增益词缀属性全部注册
#   B4 必填参数齐全（按行为分类）     B5 数值在手册 §4.2 区间内（含两条有理由越界白名单）
#   B6 12 个「行为×形状×时序」签名不重复                    B7 双段技能段序冻结
#   B8 磐石架势 450 护甲对 100 物理 = 减伤 31% ± 0.5%
#
# 有理由越界白名单（P-23 同款纪律：改白名单必须写依据）：
#   - 影缝闪避 / 破阵翻滚 base_cast_time = 0.2（< 区间下限 0.35）：
#     位移技能的前摇就是位移本身，收益在「离开原位」，规划稿 §5.2 明确此设计。
#   - 星屑连射 speed = 950（> 区间上限 900）：
#     贴脸全中窗口依赖高弹速（5 发 × 36° 散角下 110 距离内全中），规划稿 §4.2 明确。
extends GutTest

const DamagePacketScript := preload("res://mods/jes-skills/systems/skills/combat/damage_packet.gd")
const DamageCalculatorScript := preload("res://mods/jes-skills/systems/skills/combat/damage_calculator.gd")
const StatsScript := preload("res://mods/jes-skills/systems/skills/stats_component.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")

const BATCH_IDS: Array[StringName] = [
	&"sunder_strike", &"piercing_bolt", &"core_detonate", &"stardust_volley",
	&"stone_stance", &"elemental_ward", &"rift_step", &"breach_roll",
	&"quake_field", &"hunt_call", &"field_fortify", &"everflame_warden",
]


func before_all() -> void:
	GemRegistry.reload()


func _skill(id: StringName) -> SkillData:
	return GemRegistry.skill(id)


# ---------- B1：标识存在 + 来自磁盘 ----------
func test_b1_twelve_skills_exist_from_disk() -> void:
	for id in BATCH_IDS:
		var s := _skill(id)
		assert_not_null(s, "技能 %s 应已注册" % id)
		if s != null:
			assert_false(String(s.resource_path).is_empty(),
				"技能 %s 必须来自 .tres 磁盘文件" % id)


# ---------- B2：标签全部注册 ----------
func test_b2_all_tags_registered() -> void:
	for id in BATCH_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var unknown := TagRegistry.unknown_in(s.tags)
		assert_eq(unknown, [], "技能 %s 存在未注册标签：%s" % [id, unknown])


# ---------- B3：增益词缀属性全部注册（防拼写错 → 静默失效） ----------
func test_b3_buff_stats_registered() -> void:
	for id in BATCH_IDS:
		var s := _skill(id)
		if s == null:
			continue
		for part in s.parts:
			if part.behavior_id != &"bhv_buff_self":
				continue
			for m in part.behavior_params.get(&"buff_mods", []):
				assert_true(StatRegistry.has_stat(m[&"stat"]),
					"技能 %s 的增益属性「%s」未在属性注册表登记" % [id, m[&"stat"]])


# ---------- B4：必填参数齐全（按行为分类）+ 施放层显式写出 ----------
func test_b4_required_params_present() -> void:
	for id in BATCH_IDS:
		var s := _skill(id)
		if s == null:
			continue
		# 施放层八项里本批依赖的字段一律显式（手册 §4.1：不靠默认值）
		assert_gt(s.base_cost, 0.0, "技能 %s 必须显式写 base_cost" % id)
		assert_eq(s.cost_type, 0, "技能 %s 消耗类型应为法力" % id)
		assert_gt(s.base_cooldown, 0.0, "技能 %s 必须显式写 base_cooldown" % id)
		assert_gt(s.base_cast_time, 0.0, "技能 %s 必须显式写 base_cast_time" % id)
		for part in s.parts:
			var p: Dictionary = part.behavior_params
			match part.behavior_id:
				&"bhv_melee_swing":
					assert_true(p.has(&"range") and p.has(&"arc_deg"),
						"技能 %s 近战段缺 range/arc_deg" % id)
				&"bhv_projectile":
					assert_true(p.has(&"speed") and p.has(&"lifetime") and p.has(&"radius"),
						"技能 %s 投射段缺 speed/lifetime/radius" % id)
				&"bhv_aoe_burst":
					assert_true(p.has(&"radius") and p.has(&"hit_count")
						and p.has(&"hit_interval") and p.has(&"delay"),
						"技能 %s 爆发段缺 radius/delay/hit_count/hit_interval" % id)
				&"bhv_dash":
					assert_true(p.has(&"distance") and p.has(&"speed"),
						"技能 %s 冲刺段缺 distance/speed" % id)
				&"bhv_buff_self":
					assert_true(p.has(&"buff_mods") and p.has(&"duration"),
						"技能 %s 增益段缺 buff_mods/duration" % id)
				&"bhv_summon":
					assert_true(p.has(&"max_count") and p.has(&"lifetime"),
						"技能 %s 召唤段缺 max_count/lifetime" % id)


# ---------- B5：数值在手册 §4.2 区间内（白名单见文件头注释） ----------
func test_b5_values_within_guardrails() -> void:
	# 有理由越界白名单：技能标识 → { 字段 → 允许值 }
	var whitelist := {
		&"rift_step": {&"base_cast_time": 0.2},
		&"breach_roll": {&"base_cast_time": 0.2},
		&"stardust_volley": {&"speed": 950.0},
	}
	for id in BATCH_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var allow: Dictionary = whitelist.get(id, {})
		if not allow.has(&"base_cost"):
			assert_between(s.base_cost, 6.0, 25.0, "技能 %s 耗蓝越区间 6~25" % id)
		assert_between(s.base_cooldown, 0.0, 8.0, "技能 %s 冷却越区间 0~8" % id)
		if not allow.has(&"base_cast_time"):
			assert_between(s.base_cast_time, 0.35, 1.2, "技能 %s 前摇越区间 0.35~1.2" % id)
		for part in s.parts:
			var p: Dictionary = part.behavior_params
			# 半径护栏 60~180 只约束范围爆发的判定半径；投射物 radius 是弹体碰撞盒（霜矛 14），不适用
			if part.behavior_id == &"bhv_aoe_burst" and p.has(&"radius"):
				assert_between(float(p[&"radius"]), 60.0, 180.0, "技能 %s 半径越区间 60~180" % id)
			# 弹速护栏 400~900 只约束投射物；冲刺 speed 是位移速度（暗影冲刺 1000），不适用
			if part.behavior_id == &"bhv_projectile" and p.has(&"speed") and not allow.has(&"speed"):
				assert_between(float(p[&"speed"]), 400.0, 900.0, "技能 %s 弹速越区间 400~900" % id)
			if p.has(&"arc_deg"):
				assert_between(float(p[&"arc_deg"]), 60.0, 140.0, "技能 %s 扇角越区间 60~140" % id)
			if p.has(&"max_count"):
				assert_between(float(p[&"max_count"]), 1.0, 4.0, "技能 %s 召唤上限越区间 1~4" % id)


# ---------- B6：行为×形状×时序 签名两两不同（规划稿 §8 去重矩阵的机器版） ----------
func _shape_signature(s: SkillData) -> String:
	var sig := ""
	for part in s.parts:
		var p: Dictionary = part.behavior_params
		match part.behavior_id:
			&"bhv_projectile":
				sig += "投[pierce=%s,count=%s,spread=%s]" % [p.get(&"pierce", 0), p.get(&"count_base", 1), p.get(&"spread_deg", 0)]
			&"bhv_aoe_burst":
				sig += "爆[r=%s,delay=%s,n=%s,itv=%s]" % [p.get(&"radius"), p.get(&"delay"), p.get(&"hit_count"), p.get(&"hit_interval")]
			&"bhv_melee_swing":
				sig += "挥[r=%s,arc=%s]" % [p.get(&"range"), p.get(&"arc_deg")]
			&"bhv_dash":
				sig += "冲[d=%s]" % p.get(&"distance")
			&"bhv_buff_self":
				var stats: Array = []
				for m in p.get(&"buff_mods", []):
					stats.append(String(m[&"stat"]))
				stats.sort()
				sig += "益[%s,t=%s]" % [",".join(stats), p.get(&"duration")]
			&"bhv_summon":
				sig += "召[n=%s,t=%s]" % [p.get(&"max_count"), p.get(&"lifetime")]
		# 双段技能（破阵翻滚/战地工事/长明烛火）天然由段组合区分
	return sig


func test_b6_no_duplicate_shape_signature() -> void:
	var seen := {}
	for id in BATCH_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var sig := _shape_signature(s)
		assert_false(seen.has(sig), "技能 %s 与 %s 的行为×形状×时序重复" % [id, seen.get(sig)])
		seen[sig] = id


# ---------- B7：双段技能段序冻结 ----------
func test_b7_two_part_order_frozen() -> void:
	# 长明烛火：必须「先增益、后召唤」——随从召唤瞬间快照继承，顺序写反强化白给
	var candle := _skill(&"everflame_warden")
	assert_not_null(candle)
	if candle != null:
		assert_eq(candle.parts[0].behavior_id, &"bhv_buff_self", "长明烛火第 1 段必须是自身增益")
		assert_eq(candle.parts[1].behavior_id, &"bhv_summon", "长明烛火第 2 段必须是召唤")
	# 破阵翻滚：位移在前，减伤窗口给「落地之后」用
	var roll := _skill(&"breach_roll")
	assert_not_null(roll)
	if roll != null:
		assert_eq(roll.parts[0].behavior_id, &"bhv_dash", "破阵翻滚第 1 段必须是位移")
		assert_eq(roll.parts[1].behavior_id, &"bhv_buff_self", "破阵翻滚第 2 段必须是增益")


# ---------- B8：护甲断言（真算，不估） ----------
func test_b8_stone_stance_armor_reduction() -> void:
	var defender := DefenderStub.new()
	defender.stats = StatsScript.new()
	var m: StatModifier = StatModifierScript.new()
	m.stat = &"armor"
	m.op = StatModifier.Op.FLAT_ADD
	m.value = 450.0
	defender.stats.add_modifier(m)
	var packet: DamagePacket = DamagePacketScript.new()
	packet.elements[&"physical"] = 100.0
	var hit: Dictionary = DamageCalculator.resolve(packet, StatsScript.new(), defender, _NoCritRng.new())
	# 450 / (450 + 10×100) = 0.310344… → 承伤 68.9655，即减伤 31% ± 0.5%
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 68.9655, 0.5,
		"磐石架势 450 护甲对 100 物理，减伤应落在 31% ± 0.5%")


class _NoCritRng:
	extends RefCounted
	# 攻击方无暴击词缀 → resolve 不消费 RNG；契约兜底返回 1.0（永不暴击）
	func next_float(_stream: StringName) -> float:
		return 1.0


class DefenderStub:
	extends RefCounted
	var stats: StatsComponent
