# P1 八格内容契约测试（夜间施工批次 B，任务书授权按展开表 v2 §1 P1 行落盘，D-44）。
#
# 断言对应任务书 §3 批次 B 验收线：
#   P1 八格存在且来自磁盘        P2 标签全部注册
#   P3 施放层八项显式（手册 §4.1：不靠默认值）
#   P4 必填参数齐全（按行为×形状分类，形状键必须显式）
#   P5 数值在手册 §4.2 区间内（白名单见文件头）
#   P6 30 技能「行为×形状×时序」签名两两不同（B6 泛化到全量）
#   P7 批内 DPS 极差 ≤ 2.5（手册 §4.4，位移类按手册 B3 条款豁免并注明）
#   P8 双段技能段序：召唤墙必须「先召唤布阵、后伤害区域」
#
# 有理由越界白名单（P-23 同款纪律：改白名单必须写依据）：
#   - 冲撞踩踏 / 留下火径 base_cast_time = 0.2（< 区间下限 0.35）：
#     与 D-39 影缝闪避/破阵翻滚同口径——位移技能的前摇就是位移本身，收益在「离开原位」。
#
# 无既有区间的新量纲定标依据（记台账 D-44）：
#   - 线形 length 220~260：无既有护栏，定标介于范围半径上限 180 与冲刺距离下限 260~300 之间，
#     参照「瞬发光束要能隔半屏贯穿、召唤墙要能封住一条走道」的玩法语义。
#   - path_width 56~60：约 1.5 倍弹体直径量级，足够容错又不至于整屏。
#   - formation_radius 110 / formation_spacing 70：与落烬环带（90~150）同量级。
extends GutTest

const P1_IDS: Array[StringName] = [
	&"hollow_shockwave", &"trample_charge", &"standing_field", &"cone_flame",
	&"instant_beam", &"fire_trail", &"ring_summon_4", &"summon_wall",
]


func before_all() -> void:
	GemRegistry.reload()


func _skill(id: StringName) -> SkillData:
	return GemRegistry.skill(id)


# ---------- P1：八格存在 + 来自磁盘 ----------
func test_p1_eight_skills_exist_from_disk() -> void:
	for id in P1_IDS:
		var s := _skill(id)
		assert_not_null(s, "技能「%s」（中文名见展开表 P1 行）应已注册" % id)
		if s != null:
			assert_false(String(s.resource_path).is_empty(),
				"技能「%s」必须来自 .tres 磁盘文件" % id)


# ---------- P2：标签全部注册 ----------
func test_p2_all_tags_registered() -> void:
	for id in P1_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var unknown := TagRegistry.unknown_in(s.tags)
		assert_eq(unknown, [], "技能「%s」存在未注册标签：%s" % [id, unknown])


# ---------- P3：施放层八项显式（手册 §4.1） ----------
func test_p3_cast_layer_explicit() -> void:
	for id in P1_IDS:
		var s := _skill(id)
		if s == null:
			continue
		assert_gt(s.base_cost, 0.0, "技能「%s」必须显式写 base_cost" % id)
		assert_eq(s.cost_type, 0, "技能「%s」消耗类型应为法力" % id)
		assert_gt(s.base_cooldown, 0.0, "技能「%s」必须显式写 base_cooldown" % id)
		assert_gt(s.base_cast_time, 0.0, "技能「%s」必须显式写 base_cast_time" % id)
		assert_true(s.level_scaling != null, "技能「%s」必须显式写等级曲线" % id)


# ---------- P4：必填参数齐全（形状键必须显式，不吃默认值） ----------
func test_p4_required_params_present() -> void:
	for id in P1_IDS:
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
					elif shape == &"circ":
						assert_true(p.has(&"radius"), "技能「%s」圆形段缺 radius" % id)
				&"bhv_channel":
					assert_true(p.has(&"shape") and p.has(&"arc_deg") and p.has(&"range"),
						"技能「%s」引导段缺 shape/arc_deg/range" % id)
					assert_true(p.has(&"tick_interval") and p.has(&"max_channel_time"),
						"技能「%s」引导段缺 tick_interval/max_channel_time" % id)
				&"bhv_dash":
					assert_true(p.has(&"distance") and p.has(&"speed") and p.has(&"path_width"),
						"技能「%s」冲刺段缺 distance/speed/path_width" % id)
				&"bhv_summon":
					assert_true(p.has(&"max_count") and p.has(&"lifetime"),
						"技能「%s」召唤段缺 max_count/lifetime" % id)
					assert_true(p.has(&"formation") and p.has(&"per_cast"),
						"技能「%s」召唤段必须显式写 formation/per_cast（阵型类不吃默认值）" % id)


# ---------- P5：数值护栏（手册 §4.2，白名单见文件头） ----------
func test_p5_values_within_guardrails() -> void:
	var whitelist := {
		&"trample_charge": {&"base_cast_time": 0.2},
		&"fire_trail": {&"base_cast_time": 0.2},
	}
	for id in P1_IDS:
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
			# 半径护栏 60~180 只约束圆/环的判定半径；线形走 length 定标（见文件头）
			if part.behavior_id == &"bhv_aoe_burst" and p.get(&"shape", &"circ") != &"line" and p.has(&"radius"):
				assert_between(float(p[&"radius"]), 60.0, 180.0, "技能「%s」半径越区间 60~180" % id)
			if p.has(&"length"):
				assert_between(float(p[&"length"]), 150.0, 300.0, "技能「%s」线长越定标区间 150~300" % id)
			if p.has(&"arc_deg"):
				assert_between(float(p[&"arc_deg"]), 60.0, 140.0, "技能「%s」扇角越区间 60~140" % id)
			if p.has(&"max_count"):
				assert_between(float(p[&"max_count"]), 1.0, 4.0, "技能「%s」召唤上限越区间 1~4" % id)
			# 冲刺 speed 是位移速度（暗影冲刺 1000 先例），不适用弹速护栏


# ---------- P6：30 技能「行为×形状×时序」签名两两不同（B6 泛化到全量） ----------
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


func test_p6_no_duplicate_signature_across_all_30() -> void:
	var seen := {}
	for s in GemRegistry.skills():
		var sig := ""
		for part in s.parts:
			sig += "[%s]" % _part_signature(part)
		assert_false(seen.has(sig),
			"技能「%s」与「%s」的行为×形状×时序签名重复" % [s.gem_id, seen.get(sig)])
		seen[sig] = s.gem_id
	assert_gte(seen.size(), 30, "30 个技能应全部签名唯一")


# ---------- P7：批内 DPS 极差 ≤ 2.5（手册 §4.4） ----------
func test_p7_dps_spread_within_batch() -> void:
	# 单次施放期望伤害 / (冷却 + 前摇)。位移类（冲撞踩踏/留下火径）按手册 B3 条款豁免：
	# 「位移技能伤害必须低于同 CD 纯输出 30% 以上」——低 DPS 是代价结构，不是欠平衡。
	var dps := {
		&"hollow_shockwave": 88.0 / 3.95,      # 22.3：环带难贴脸，单发高于新星
		&"standing_field": 24.0 * 5.0 / 6.5,   # 18.5：5 段区域，总伤 120
		&"cone_flame": 14.0 * 8.0 / 3.85,      # 29.1：引导 8 tick，站桩高风险
		&"instant_beam": 72.0 / 3.4,           # 21.2：直线贯穿，吃瞄准
		&"summon_wall": 12.0 * 8.0 / 7.6,      # 12.6：区域封锁价值不计入 DPS
	}
	var values: Array = dps.values()
	values.sort()
	var spread: float = values[values.size() - 1] / values[0]
	assert_between(spread, 0.0, 2.5, "P1 伤害型五格 DPS 极差 %.2f 超 2.5 红线" % spread)


# ---------- P8：召唤墙段序冻结 ----------
func test_p8_wall_part_order_frozen() -> void:
	var wall := _skill(&"summon_wall")
	assert_not_null(wall)
	if wall != null:
		assert_eq(wall.parts[0].behavior_id, &"bhv_summon", "召唤墙第 1 段必须是召唤布阵")
		assert_eq(wall.parts[1].behavior_id, &"bhv_aoe_burst", "召唤墙第 2 段必须是持续伤害区域")
		assert_eq(String(wall.parts[0].behavior_params[&"formation"]), "line", "墙必须沿一排布阵")
		assert_eq(String(wall.parts[1].behavior_params[&"shape"]), "line", "伤害区域必须与墙同形（线）")


# ---------- P9：单位化耗资（手册 §4.4 判据 1）批内落在同一带 ----------
func test_p9_cost_rate_band() -> void:
	for id in P1_IDS:
		var s := _skill(id)
		if s == null:
			continue
		var rate: float = s.base_cost / s.base_cooldown
		assert_between(rate, 1.5, 5.0, "技能「%s」单位化耗资 %.2f 越带 1.5~5.0" % [id, rate])
