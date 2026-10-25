# 批次 A 判定形状化测试（D-43）：七种封闭枚举形状 + 行为层接线。
#
# 验收线（任务书 §3 批次 A）：
#   A1 每个形状至少 1 条单元测试（命中/不命中各一）
#   A2 默认值零回归：不加 shape 键时，aoe=circ / melee=sec / channel=line / dash=现状 / summon=D-10 逐次语义
#   A3 量纲规则：长度量纲吃 area_size，角度量纲与数量不缩放（P-26 延续）
#   A4 环形均布复用 D-36 公式（360°×i÷数量）
#   A5 D-42 契约：行为 produced_params 与 TagRegistry 承诺面两端口径一致
extends GutTest

const ScalingScript := preload("res://mods/jes-skills/systems/skills/data/gem_level_scaling.gd")
const SkillDataScript := preload("res://mods/jes-skills/systems/skills/data/skill_data.gd")
const SkillPartScript := preload("res://mods/jes-skills/systems/skills/data/skill_part.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")


func _make_stats() -> StatsComponent:
	return StatsComponent.new()


func _area_mod(value: float) -> StatModifier:
	var m: StatModifier = StatModifierScript.new()
	m.stat = &"area_size"
	m.op = StatModifier.Op.INCREASED
	m.value = value
	m.source_id = &"test:shape"
	return m


func _skill(behavior_id: StringName, params: Dictionary) -> SkillData:
	var data: SkillData = SkillDataScript.new()
	data.gem_id = &"test_shape_gem"
	data.display_name = "形状测试技能"
	data.tags = [&"spell"] as Array[StringName]
	data.level_scaling = ScalingScript.new()
	var part: SkillPart = SkillPartScript.new()
	part.base_damage = {&"physical": 10.0}
	part.behavior_id = behavior_id
	part.behavior_params = params
	data.parts = [part]
	return data


# ---------- A1a：点（pt）——目标圆压住点即命中，离开即不命中 ----------
func test_shape_pt_hit_and_miss() -> void:
	var cfg := {}
	assert_true(ShapeHit.hits(&"pt", Vector2.ZERO, 0.0, cfg, Vector2(8, 0), 10.0), "目标半径 10 覆盖原点 8 距离 → 命中")
	assert_false(ShapeHit.hits(&"pt", Vector2.ZERO, 0.0, cfg, Vector2(30, 0), 10.0), "距离 30 超出目标半径 → 不命中")


# ---------- A1b：圆（circ）——半径膨胀判定 ----------
func test_shape_circ_hit_and_miss() -> void:
	var cfg := {&"radius": 100.0}
	assert_true(ShapeHit.hits(&"circ", Vector2.ZERO, 0.0, cfg, Vector2(108, 0), 10.0), "100 + 10 容差内命中")
	assert_false(ShapeHit.hits(&"circ", Vector2.ZERO, 0.0, cfg, Vector2(115, 0), 10.0), "超出半径 + 目标半径 → 不命中")


# ---------- A1c：环（ring）——内圈留空（D-31 空心语义） ----------
func test_shape_ring_hit_and_miss() -> void:
	var cfg := {&"radius": 150.0, &"inner_radius": 90.0}
	assert_true(ShapeHit.hits(&"ring", Vector2.ZERO, 0.0, cfg, Vector2(100, 0), 10.0), "环带 90~150 内命中")
	assert_false(ShapeHit.hits(&"ring", Vector2.ZERO, 0.0, cfg, Vector2.ZERO, 10.0), "贴脸在内圈 → 空心不命中")


# ---------- A1d：扇（sec）——朝向夹角 + 距离双判 ----------
func test_shape_sec_hit_and_miss() -> void:
	var cfg := {&"range": 150.0, &"arc_deg": 90.0}
	assert_true(ShapeHit.hits(&"sec", Vector2.ZERO, 0.0, cfg, Vector2(100, 0), 10.0), "正前方环带内命中")
	assert_true(ShapeHit.hits(&"sec", Vector2.ZERO, 0.0, cfg, Vector2(70, 44), 10.0), "45° 夹角在半扇角 45°+ 容差内命中")
	assert_false(ShapeHit.hits(&"sec", Vector2.ZERO, 0.0, cfg, Vector2(-100, 0), 10.0), "背后 180° → 不命中")
	assert_false(ShapeHit.hits(&"sec", Vector2.ZERO, 0.0, cfg, Vector2(30, 60), 10.0), "夹角 63.4° 超出半扇角 45°+ 容差 → 不命中")


# ---------- A1e：线（line）——沿朝向前向线段 + 半宽 ----------
func test_shape_line_hit_and_miss() -> void:
	var cfg := {&"length": 200.0, &"width": 40.0}
	assert_true(ShapeHit.hits(&"line", Vector2.ZERO, 0.0, cfg, Vector2(150, 15), 10.0), "线中段横向 15 < 20+10 命中")
	assert_false(ShapeHit.hits(&"line", Vector2.ZERO, 0.0, cfg, Vector2(150, 40), 10.0), "横向 40 > 20+10 → 不命中")
	assert_false(ShapeHit.hits(&"line", Vector2.ZERO, 0.0, cfg, Vector2(-50, 0), 10.0), "线段只向前延伸，身后不命中")


# ---------- A1f：矩形（rect）——以原点为中心对称，与 line 的方向性相反 ----------
func test_shape_rect_hit_and_miss() -> void:
	var cfg := {&"length": 200.0, &"width": 40.0}
	assert_true(ShapeHit.hits(&"rect", Vector2.ZERO, 0.0, cfg, Vector2(-80, 0), 10.0), "矩形前后对称，身后也命中")
	assert_false(ShapeHit.hits(&"rect", Vector2.ZERO, 0.0, cfg, Vector2(150, 0), 10.0), "纵向超出 100+10 → 不命中")


# ---------- A1g：多点（multi）——沿朝向均布 N 点，任一点命中即命中 ----------
func test_shape_multi_hit_and_miss() -> void:
	var cfg := {&"point_count": 3, &"point_spacing": 60.0, &"radius": 0.0}
	assert_true(ShapeHit.hits(&"multi", Vector2.ZERO, 0.0, cfg, Vector2(120, 0), 10.0), "第 3 点 120 距离被目标半径覆盖 → 命中")
	assert_false(ShapeHit.hits(&"multi", Vector2.ZERO, 0.0, cfg, Vector2(90, 30), 10.0), "偏离点列 → 不命中")


# ---------- A2a：aoe 默认 circ 逐位一致（零回归证明） ----------
func test_aoe_default_shape_is_circ() -> void:
	var data := _skill(&"bhv_aoe_burst", {&"radius": 120.0, &"delay": 0.0})
	var burst := BhvAoeBurst.plan_to_burst(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_eq(String(burst[&"shape"]), "circ", "未声明 shape 默认实心圆")
	assert_almost_eq(float(burst[&"inner_radius"]), 0.0, 0.0001, "内半径默认 0 = 实心圆（D-31 口径不变）")
	assert_true(BhvAoeBurst.hits(burst, Vector2.ZERO, Vector2(100, 0), 12.0), "实心圆中心判定照旧")
	assert_false(BhvAoeBurst.hits(burst, Vector2.ZERO, Vector2(200, 0), 12.0), "范围外照旧不命中")


# ---------- A2b：melee 默认 sec / channel 默认 line（零回归证明） ----------
func test_melee_and_channel_default_shapes() -> void:
	var melee := _skill(&"bhv_melee_swing", {&"arc_deg": 90.0, &"range": 130.0})
	var swing := BhvMeleeSwing.plan_to_swing(SkillExecutor.cast(melee, 1, _make_stats())[0])
	assert_eq(String(swing[&"shape"]), "sec", "近战默认扇形")
	var chan := _skill(&"bhv_channel", {&"tick_interval": 0.25, &"max_channel_time": 2.0})
	var ch := BhvChannel.plan_to_channel(SkillExecutor.cast(chan, 1, _make_stats())[0])
	assert_eq(String(ch[&"shape"]), "line", "引导默认线形（既有光束口径）")
	assert_almost_eq(float(ch[&"range"]), 0.0, 0.0001, "未声明 range 的引导不改动既有计划")


# ---------- A2c：dash 默认 path_zone_duration=0（现状语义） ----------
func test_dash_default_zone_zero() -> void:
	var data := _skill(&"bhv_dash", {&"distance": 300.0, &"speed": 1500.0})
	var d := BhvDash.plan_to_dash(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_almost_eq(float(d[&"path_zone_duration"]), 0.0, 0.0001, "默认不留持续区域 = 现状")
	assert_almost_eq(float(d[&"path_width"]), 24.0, 0.0001, "路径判定宽度有显式默认值")


# ---------- A2d：summon 默认 point 阵型（D-10 逐次语义不变） ----------
func test_summon_default_formation_point() -> void:
	var data := _skill(&"bhv_summon", {&"max_count": 2, &"lifetime": 10.0})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_eq(String(sm[&"formation"]), "point", "默认逐次召唤")
	assert_eq(int(sm[&"per_cast"]), 0, "默认不启用一次多召")
	var offsets: Array = sm[&"spawn_offsets"]
	assert_eq(offsets.size(), 0, "point 阵型无预设落点（表现层沿用施法者位置）")


# ---------- A3：长度量纲吃 area_size，角度量纲与数量不缩放 ----------
func test_area_scales_lengths_not_angles() -> void:
	var sc := _make_stats()
	sc.add_modifier(_area_mod(50.0))
	var data := _skill(&"bhv_aoe_burst", {
		&"shape": &"line", &"length": 200.0, &"width": 40.0, &"delay": 0.0,
	})
	var burst := BhvAoeBurst.plan_to_burst(SkillExecutor.cast(data, 1, sc)[0])
	assert_almost_eq(float(burst[&"length"]), 300.0, 0.001, "线长 200 × 1.5 = 300")
	assert_almost_eq(float(burst[&"width"]), 60.0, 0.001, "线宽 40 × 1.5 = 60")
	var sec_data := _skill(&"bhv_aoe_burst", {
		&"shape": &"sec", &"range": 150.0, &"arc_deg": 90.0, &"delay": 0.0,
	})
	var sec_burst := BhvAoeBurst.plan_to_burst(SkillExecutor.cast(sec_data, 1, sc)[0])
	assert_almost_eq(float(sec_burst[&"range"]), 225.0, 0.001, "扇形距离 150 × 1.5 = 225")
	assert_almost_eq(float(sec_burst[&"arc_deg"]), 90.0, 0.001, "扇角是角度量纲，不缩放")


# ---------- A3b：line 的长缺省回退 range 承载（总纲 §4 承载口径） ----------
func test_line_length_falls_back_to_range() -> void:
	var data := _skill(&"bhv_aoe_burst", {
		&"shape": &"line", &"range": 240.0, &"width": 40.0, &"delay": 0.0,
	})
	var burst := BhvAoeBurst.plan_to_burst(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_almost_eq(float(burst[&"length"]), 240.0, 0.001, "未写 length 时回退 range 承载")


# ---------- A3c：channel 扇形引导的 range 吃面积倍率 ----------
func test_channel_sec_range_scales_with_area() -> void:
	var sc := _make_stats()
	sc.add_modifier(_area_mod(30.0))
	var data := _skill(&"bhv_channel", {
		&"shape": &"sec", &"arc_deg": 70.0, &"range": 160.0,
		&"tick_interval": 0.25, &"max_channel_time": 2.0,
	})
	var ch := BhvChannel.plan_to_channel(SkillExecutor.cast(data, 1, sc)[0])
	assert_eq(String(ch[&"shape"]), "sec")
	assert_almost_eq(float(ch[&"range"]), 208.0, 0.001, "160 × 1.3 = 208（P-26 长度量纲）")
	assert_almost_eq(float(ch[&"arc_deg"]), 70.0, 0.001, "扇角不缩放")


# ---------- A4a：环形召 4 均布复用 D-36 公式（360°×i÷数量） ----------
func test_summon_ring_formation_even() -> void:
	var data := _skill(&"bhv_summon", {
		&"max_count": 4, &"lifetime": 12.0,
		&"formation": &"ring", &"per_cast": 4, &"formation_radius": 110.0,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	var offsets: Array = sm[&"spawn_offsets"]
	assert_eq(offsets.size(), 4, "一次召 4 只 = 4 个落点")
	for off in offsets:
		assert_almost_eq(float((off as Vector2).length()), 110.0, 0.001, "落点都在阵型半径上")
	assert_almost_eq(float((offsets[0] as Vector2).angle()), 0.0, 0.001, "初相 0°")
	assert_almost_eq(float((offsets[1] as Vector2).angle()), PI * 0.5, 0.001, "第二只 90°（360/4 均布，D-36 公式）")


# ---------- A4b：召唤墙沿朝向一排、以施法者为中心对称 ----------
func test_summon_line_formation_row() -> void:
	var data := _skill(&"bhv_summon", {
		&"max_count": 3, &"lifetime": 8.0,
		&"formation": &"line", &"per_cast": 3, &"formation_spacing": 70.0,
	})
	# 计划朝向默认 0°，落点应在 X 轴上：-70 / 0 / +70
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	var offsets: Array = sm[&"spawn_offsets"]
	assert_eq(offsets.size(), 3)
	assert_almost_eq(float((offsets[0] as Vector2).x), -70.0, 0.001, "第一只在中心后 70")
	assert_almost_eq(float((offsets[1] as Vector2).x), 0.0, 0.001, "中间只在施法者位置")
	assert_almost_eq(float((offsets[2] as Vector2).x), 70.0, 0.001, "第三只在中心前 70")


# ---------- A4c：阵型半径吃 area_size（长度量纲） ----------
func test_summon_formation_radius_scales_with_area() -> void:
	var sc := _make_stats()
	sc.add_modifier(_area_mod(50.0))
	var data := _skill(&"bhv_summon", {
		&"max_count": 4, &"lifetime": 12.0,
		&"formation": &"ring", &"per_cast": 4, &"formation_radius": 110.0,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, sc)[0])
	assert_almost_eq(float(sm[&"formation_radius"]), 165.0, 0.001, "110 × 1.5 = 165")


# ---------- A5：D-42 契约两端口径一致（承诺 ⊆ 产出） ----------
func test_tag_promises_covered_by_produced_params() -> void:
	for bid in SkillExecutor.BEHAVIORS:
		var script: GDScript = load(SkillExecutor.BEHAVIORS[bid])
		var form: StringName = SkillExecutor.BEHAVIOR_FORM_TAG[bid]
		for p in TagRegistry.promises_of(form):
			assert_true(script.produced_params().has(p),
				"行为「%s」未产出形态标签「%s」承诺的参数键「%s」" % [bid, form, p])


# ---------- 补充：封闭枚举守卫 ----------
func test_shape_enum_is_closed() -> void:
	assert_eq(ShapeHit.SHAPES.size(), 7, "七种形状，加值=口径变更")


# ================= D-56 合并键批次（冲刺多段键 + 阵型键） =================

# ---------- D56-1a：冲刺路径多段键声明即生效 ----------
func test_dash_multi_hit_keys() -> void:
	var data := _skill(&"bhv_dash", {
		&"distance": 400.0, &"speed": 800.0,
		&"hit_count": 4, &"tick_interval": 0.2,
	})
	var d := BhvDash.plan_to_dash(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_eq(int(d[&"hit_count"]), 4, "路径判定 4 段")
	assert_almost_eq(float(d[&"tick_interval"]), 0.2, 0.0001, "段间隔 0.2s")


# ---------- D56-1b：冲刺默认零回归（单段、零间隔 = 现状语义） ----------
func test_dash_multi_hit_defaults() -> void:
	var data := _skill(&"bhv_dash", {&"distance": 300.0, &"speed": 1500.0})
	var d := BhvDash.plan_to_dash(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_eq(int(d[&"hit_count"]), 1, "默认 1 段 = 现状单段判定")
	assert_almost_eq(float(d[&"tick_interval"]), 0.0, 0.0001, "默认零间隔")


# ---------- D56-2a：circ 散布阵——向日葵螺旋均布，落点全部落在阵型半径内且确定可测 ----------
func test_summon_circ_formation_scatter() -> void:
	var data := _skill(&"bhv_summon", {
		&"max_count": 6, &"lifetime": 10.0,
		&"formation": &"circ", &"per_cast": 6, &"formation_radius": 100.0,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	var offsets: Array = sm[&"spawn_offsets"]
	assert_eq(offsets.size(), 6, "一次召 6 只 = 6 个落点")
	for off in offsets:
		assert_true(float((off as Vector2).length()) <= 100.0 + 0.001,
			"落点必须在阵型半径 100 内")
	# 确定性：第一只位于半径一半处（sqrt(0.5/6)×100），golden angle 初相
	var first := offsets[0] as Vector2
	assert_almost_eq(first.length(), 100.0 * sqrt(0.5 / 6.0), 0.001, "螺旋首点半径确定")
	# 最内与最外点不应重合（覆盖圆盘而非挤在原点）
	assert_true((offsets[0] as Vector2).length() < (offsets[5] as Vector2).length(),
		"螺旋由内向外展开")


# ---------- D56-2b：multi 多点阵——沿朝向 point_count 个点、点距 point_spacing ----------
func test_summon_multi_formation_points() -> void:
	var data := _skill(&"bhv_summon", {
		&"max_count": 3, &"lifetime": 8.0,
		&"formation": &"multi", &"per_cast": 3,
		&"point_count": 3, &"point_spacing": 60.0,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	var offsets: Array = sm[&"spawn_offsets"]
	assert_eq(offsets.size(), 3, "3 个点各一只")
	assert_almost_eq(float((offsets[0] as Vector2).x), -60.0, 0.001, "首点 -60（对称展开）")
	assert_almost_eq(float((offsets[1] as Vector2).x), 0.0, 0.001, "中点在施法者位置")
	assert_almost_eq(float((offsets[2] as Vector2).x), 60.0, 0.001, "末点 +60")


# ---------- D56-2c：multi 的 point_spacing 吃 area_size（长度量纲） ----------
func test_summon_multi_spacing_scales_with_area() -> void:
	var sc := _make_stats()
	sc.add_modifier(_area_mod(50.0))
	var data := _skill(&"bhv_summon", {
		&"max_count": 3, &"lifetime": 8.0,
		&"formation": &"multi", &"per_cast": 3,
		&"point_count": 3, &"point_spacing": 60.0,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, sc)[0])
	assert_almost_eq(float(sm[&"point_spacing"]), 90.0, 0.001, "60 × 1.5 = 90")


# ---------- D56-2d：delay 透传（多点陷阱阵 SUMN·MULTI·DLY 的预埋延迟） ----------
func test_summon_delay_passthrough() -> void:
	var data := _skill(&"bhv_summon", {
		&"max_count": 3, &"lifetime": 8.0,
		&"formation": &"multi", &"point_count": 3, &"point_spacing": 60.0,
		&"delay": 0.5,
	})
	var sm := BhvSummon.plan_to_summon(SkillExecutor.cast(data, 1, _make_stats())[0])
	assert_almost_eq(float(sm[&"delay"]), 0.5, 0.0001, "预埋延迟整组透传")
	var plain := _skill(&"bhv_summon", {&"max_count": 1, &"lifetime": 5.0})
	var sm2 := BhvSummon.plan_to_summon(SkillExecutor.cast(plain, 1, _make_stats())[0])
	assert_almost_eq(float(sm2[&"delay"]), 0.0, 0.0001, "默认零延迟 = 现状")
	for s in ShapeHit.SHAPES:
		assert_true(ShapeHit.is_valid(s), "枚举内形状必须合法")
	assert_false(ShapeHit.is_valid(&"cone"), "枚举外形状拒绝（cone 须走口径变更流程）")
