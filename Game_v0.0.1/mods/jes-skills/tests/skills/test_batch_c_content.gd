# 批次 C 内容契约测试（夜间施工批次 C，展开表 v2 §1 除 P1 外 ● 空位 37 格落盘，D-45）。
#
# 断言对应任务书 §3 批次 C 验收线：
#   C1 37 格内容存在且来自磁盘    C2 标签全部注册
#   C3 施放层八项显式（手册 §4.1：不靠默认值）
#   C4 必填参数齐全（按行为×形状分类，形状键必须显式）
#   C5 数值在手册 §4.2 区间内（白名单见文件头）
#   C6 67 技能「行为×形状×时序」签名两两不同（B6/P6 泛化到全量）
#   C7 批内 DPS 极差 ≤ 2.5（手册 §4.4，伤害从 .tres 数据现算，零伤害内容不计入）
#   C8 单位化耗资（手册 §4.4 判据 1）批内落在同一带
#
# 有理由越界白名单（P-23 同款纪律：改白名单必须写依据）：
#   - 四格冲刺类（冲撞落点爆/终点环爆/延迟终点环爆/路径延迟爆）base_cast_time = 0.2
#     （< 区间下限 0.35）：与 D-39/D-44 位移口径一致——位移技能的前摇就是位移本身。
#
# DPS 口径说明（记台账 D-45）：
#   - 双段技能中不产出伤害的段（蓄力引导段 / 预警圈段 / 位移段）不计伤害；
#   - 冲刺四格的位移仅作投送、伤害在爆发段，按爆发技口径计入 DPS（B3 保命豁免不适用）；
#   - 图腾阵 / 沿线雷阵伤害由随从运行时产出（数据层无伤害），同 P1 召唤墙口径不计入。
extends GutTest

const BATCH_C_IDS: Array[StringName] = [
	# FLY 14
	&"payload_arrow", &"scorch_trail_bolt", &"delayed_blast_bomb", &"venom_cloud_bomb",
	&"ring_blast_bomb", &"delayed_ring_bomb", &"fan_blast_bomb", &"delayed_fan_bomb",
	&"beam_bolt", &"traveling_beam_bolt", &"trajectory_burst_bomb", &"beam_wall_bomb",
	&"starfall_barrage", &"multi_venom_bomb",
	# INST 9
	&"point_snap", &"mark_detonate", &"warning_circle_burst", &"delayed_shock_ring",
	&"triple_slash", &"delayed_light_track", &"light_wall", &"multi_burst", &"sky_multi_burst",
	# CHAN 8
	&"focus_beam", &"charge_snap", &"whirl_channel", &"charge_big_blast",
	&"channel_field", &"charge_fan_blast", &"charge_laser", &"sustained_beam",
	# DASH 4
	&"crash_land_burst", &"end_ring_burst", &"delayed_end_ring", &"path_delay_blast",
	# SUMN 2
	&"totem_array", &"line_mine_array",
]

const DASH_IDS: Array[StringName] = [
	&"crash_land_burst", &"end_ring_burst", &"delayed_end_ring", &"path_delay_blast",
]


func before_all() -> void:
	GemRegistry.reload()


func _skill(id: StringName) -> SkillData:
	return GemRegistry.skill(id)


# ---------- C1：37 格存在 + 来自磁盘 ----------
func test_c1_batch_c_skills_exist_from_disk() -> void:
	for id in BATCH_C_IDS:
		var s := _skill(id)
		assert_not_null(s, "技能「%s」（中文名见展开表对应格行）应已注册" % id)
		if s != null:
			assert_false(String(s.resource_path).is_empty(),
				"技能「%s」必须来自 .tres 磁盘文件" % id)


# ---------- C2：标签全部注册 ----------
func test_c2_all_tags_registered() -> void:
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var unknown := TagRegistry.unknown_in(s.tags)
		assert_eq(unknown, [], "技能「%s」存在未注册标签：%s" % [id, unknown])


# ---------- C3：施放层八项显式（手册 §4.1） ----------
func test_c3_cast_layer_explicit() -> void:
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		assert_gt(s.base_cost, 0.0, "技能「%s」必须显式写 base_cost" % id)
		assert_eq(s.cost_type, 0, "技能「%s」消耗类型应为法力" % id)
		assert_gt(s.base_cooldown, 0.0, "技能「%s」必须显式写 base_cooldown" % id)
		assert_gt(s.base_cast_time, 0.0, "技能「%s」必须显式写 base_cast_time" % id)
		assert_true(s.level_scaling != null, "技能「%s」必须显式写等级曲线" % id)


# ---------- C4：必填参数齐全（形状键必须显式，不吃默认值） ----------
func test_c4_required_params_present() -> void:
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		for part in s.parts:
			var p: Dictionary = part.behavior_params
			match part.behavior_id:
				&"bhv_aoe_burst":
					assert_true(p.has(&"shape"), "技能「%s」爆发段必须显式写 shape" % id)
					assert_true(p.has(&"delay") and p.has(&"hit_count") and p.has(&"hit_interval"),
						"技能「%s」爆发段缺 delay/hit_count/hit_interval" % id)
					var shape: StringName = p[&"shape"]
					if shape == &"ring":
						assert_true(p.has(&"radius") and p.has(&"inner_radius"),
							"技能「%s」环形段缺 radius/inner_radius" % id)
					elif shape == &"line":
						assert_true(p.has(&"length") and p.has(&"width"),
							"技能「%s」线形段缺 length/width" % id)
					elif shape == &"sec":
						assert_true(p.has(&"arc_deg") and p.has(&"range"),
							"技能「%s」扇形段缺 arc_deg/range" % id)
					elif shape == &"multi":
						assert_true(p.has(&"point_count") and p.has(&"point_spacing") and p.has(&"radius"),
							"技能「%s」多点段缺 point_count/point_spacing/radius" % id)
					elif shape == &"circ":
						assert_true(p.has(&"radius"), "技能「%s」圆形段缺 radius" % id)
				&"bhv_projectile":
					assert_true(p.has(&"speed") and p.has(&"lifetime") and p.has(&"radius"),
						"技能「%s」投射段缺 speed/lifetime/radius" % id)
					assert_true(p.has(&"count_base") and p.has(&"spread_deg"),
						"技能「%s」投射段缺 count_base/spread_deg" % id)
				&"bhv_channel":
					assert_true(p.has(&"shape") and p.has(&"tick_interval") and p.has(&"max_channel_time"),
						"技能「%s」引导段缺 shape/tick_interval/max_channel_time" % id)
				&"bhv_dash":
					assert_true(p.has(&"distance") and p.has(&"speed") and p.has(&"path_width"),
						"技能「%s」冲刺段缺 distance/speed/path_width" % id)
				&"bhv_summon":
					assert_true(p.has(&"max_count") and p.has(&"lifetime"),
						"技能「%s」召唤段缺 max_count/lifetime" % id)
					assert_true(p.has(&"formation") and p.has(&"per_cast"),
						"技能「%s」召唤段必须显式写 formation/per_cast" % id)


# ---------- C5：数值护栏（手册 §4.2，白名单见文件头） ----------
func test_c5_values_within_guardrails() -> void:
	var whitelist := {}
	for id in DASH_IDS:
		whitelist[id] = {&"base_cast_time": 0.2}
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var allow: Dictionary = whitelist.get(id, {})
		if not allow.has(&"base_cost"):
			assert_between(s.base_cost, 6.0, 25.0, "技能「%s」耗蓝越区间 6~25" % id)
		assert_between(s.base_cooldown, 0.0, 8.0, "技能「%s」冷却越区间 0~8" % id)
		if not allow.has(&"base_cast_time"):
			assert_between(s.base_cast_time, 0.35, 1.2, "技能「%s」前摇越区间 0.35~1.2" % id)
		for part in s.parts:
			var p: Dictionary = part.behavior_params
			# 半径护栏 60~180 只约束圆/环/多点的判定半径；线形走 length 定标（D-44 口径）；
			# 引导段的 range 是长度承载（圆=半径承载 / 线=长度承载），不进本护栏
			if part.behavior_id == &"bhv_aoe_burst" \
					and p.get(&"shape", &"circ") != &"line" and p.get(&"shape", &"circ") != &"pt" \
					and p.has(&"radius"):
				assert_between(float(p[&"radius"]), 60.0, 180.0, "技能「%s」半径越区间 60~180" % id)
			if part.behavior_id == &"bhv_aoe_burst" and p.has(&"length"):
				assert_between(float(p[&"length"]), 150.0, 300.0, "技能「%s」线长越定标区间 150~300" % id)
			if p.has(&"arc_deg"):
				assert_between(float(p[&"arc_deg"]), 60.0, 140.0, "技能「%s」扇角越区间 60~140" % id)
			if p.has(&"max_count"):
				assert_between(float(p[&"max_count"]), 1.0, 4.0, "技能「%s」召唤上限越区间 1~4" % id)
			if part.behavior_id == &"bhv_projectile" and p.has(&"speed"):
				assert_between(float(p[&"speed"]), 400.0, 900.0, "技能「%s」弹速越区间 400~900" % id)


# ---------- C6：67 技能「行为×形状×时序」签名两两不同（泛化到全量） ----------
func _part_signature(part: SkillPart) -> String:
	var p: Dictionary = part.behavior_params
	var shape: String = String(p.get(&"shape", _default_shape(part.behavior_id)))
	var keys := p.keys()
	keys.sort_custom(func(a, b): return String(a) < String(b))
	var kv: Array = []
	for k in keys:
		kv.append("%s=%s" % [String(k), str(p[k])])
	return "%s/%s/%s" % [String(part.behavior_id), shape, ",".join(kv)]


func _default_shape(behavior_id: StringName) -> String:
	match behavior_id:
		&"bhv_aoe_burst":
			return "circ"
		&"bhv_melee_swing":
			return "sec"
		&"bhv_channel":
			return "line"
		_:
			return "-"


func test_c6_no_duplicate_signature_across_all_67() -> void:
	var seen := {}
	for s in GemRegistry.skills():
		var sig := ""
		for part in s.parts:
			sig += "[%s]" % _part_signature(part)
		assert_false(seen.has(sig),
			"技能「%s」与「%s」的行为×形状×时序签名重复" % [s.gem_id, seen.get(sig)])
		seen[sig] = s.gem_id
	assert_gte(seen.size(), 67, "67 个技能应全部签名唯一")


# ---------- C7：批内 DPS 极差 ≤ 2.5（伤害从数据现算，口径见文件头） ----------
func _expected_total_damage(s: SkillData) -> float:
	var total := 0.0
	for part in s.parts:
		var p: Dictionary = part.behavior_params
		var part_dmg := 0.0
		for v in part.base_damage.values():
			part_dmg += float(v)
		match part.behavior_id:
			&"bhv_projectile":
				total += part_dmg * maxf(float(p.get(&"count_base", 1.0)), 1.0)
			&"bhv_aoe_burst":
				# 多点形状：每个点各自结算一次，伤害按点数翻倍（D-45 口径校准）
				var point_mult := 1.0
				if StringName(p.get(&"shape", &"circ")) == &"multi":
					point_mult = maxf(float(p.get(&"point_count", 1)), 1.0)
				total += part_dmg * maxi(int(p.get(&"hit_count", 1)), 1) * point_mult
			&"bhv_channel":
				var tick: float = maxf(float(p.get(&"tick_interval", 0.25)), 0.01)
				var ticks := int(floor(float(p.get(&"max_channel_time", 0.0)) / tick))
				total += part_dmg * float(maxi(ticks, 0))
	# bhv_dash / bhv_summon / bhv_buff_self：数据层不产出伤害，不计
	return total


func test_c7_dps_spread_within_batch() -> void:
	var dps_values: Array = []
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var total := _expected_total_damage(s)
		if total <= 0.0:
			continue  # 图腾阵 / 沿线雷阵：伤害由随从运行时产出，同 P1 召唤墙口径不计入
		var cycle: float = s.base_cooldown + s.base_cast_time
		dps_values.append(total / cycle)
	assert_gte(dps_values.size(), 35, "伤害型内容应至少 35 格（仅 2 格召唤阵不计）")
	dps_values.sort()
	var spread: float = dps_values[dps_values.size() - 1] / dps_values[0]
	assert_between(spread, 0.0, 2.5, "批次 C 伤害型 DPS 极差 %.2f 超 2.5 红线" % spread)


# ---------- C8：单位化耗资（手册 §4.4 判据 1）批内落在同一带 ----------
func test_c8_cost_rate_band() -> void:
	for id in BATCH_C_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var rate: float = s.base_cost / s.base_cooldown
		assert_between(rate, 1.5, 5.0, "技能「%s」单位化耗资 %.2f 越带 1.5~5.0" % [id, rate])
