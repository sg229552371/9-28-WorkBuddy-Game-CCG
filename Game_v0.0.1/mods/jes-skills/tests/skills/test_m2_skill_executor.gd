# M2 测试：SkillData + SkillExecutor + projectile/melee 行为（规格 §11 M2）
# 验收线：单发冰矛能打出数字；改 .tres 数值即改伤害，不改代码。
# 所有期望值均可手算核对。
extends GutTest

const SkillDataScript := preload("res://mods/jes-skills/systems/skills/data/skill_data.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")
const SkillChannelScript := preload("res://mods/jes-skills/systems/skills/skill_channel.gd")
const FROST_SHARD_PATH := "res://mods/jes-skills/content/gems/active/frost_shard.tres"


func _make_stats() -> StatsComponent:
	return StatsComponent.new()


func _mod(stat: StringName, op: int, value: float, channel_mask: int = SkillChannelScript.Channel.ALL) -> StatModifier:
	var m := StatModifierScript.new()
	m.stat = stat
	m.op = op
	m.value = value
	m.source_id = &"test:m2"
	m.channel_mask = channel_mask
	return m


# ---------- .tres 数据驱动加载 ----------
func test_frost_shard_tres_loads() -> void:
	var data: SkillData = load(FROST_SHARD_PATH)
	assert_not_null(data, "frost_shard.tres 应能加载")
	assert_eq(data.gem_id, &"frost_shard")
	assert_eq(data.parts.size(), 1, "冰矛至少 1 个 part")
	assert_true(data.tags.has(&"projectile"), "冰矛是投射物技能")
	assert_eq(data.parts[0].behavior_id, &"bhv_projectile")


# ---------- 金样：空属性施放，单发冰伤 100 ----------
func test_cast_single_projectile_golden() -> void:
	var data: SkillData = load(FROST_SHARD_PATH)
	var plans := SkillExecutor.cast(data, 1, _make_stats())
	assert_eq(plans.size(), 1, "count_base=1 → 单发")
	assert_eq(plans[0].get(&"behavior_id"), &"bhv_projectile")
	var elements: Dictionary = plans[0].get(&"elements")
	assert_almost_eq(float(elements.get(&"cold", 0.0)), 100.0, 0.0001, "Lv1 空属性冰伤 = 100")


# ---------- 数据驱动证明：改 .tres 数值即改伤害，不改代码 ----------
func test_tres_value_change_changes_damage() -> void:
	var src := FileAccess.get_file_as_string(FROST_SHARD_PATH)
	assert_false(src.is_empty(), "能读取 frost_shard.tres 源文本")
	var modified := src.replace('&"cold": 100.0', '&"cold": 200.0')
	assert_ne(modified, src, "替换应实际发生")
	var out_path := "user://test_frost_shard_mod.tres"
	var f := FileAccess.open(out_path, FileAccess.WRITE)
	f.store_string(modified)
	f.close()
	var data: SkillData = load(out_path)
	assert_not_null(data, "修改后的 .tres 应能加载")
	var plans := SkillExecutor.cast(data, 1, _make_stats())
	var elements: Dictionary = plans[0].get(&"elements")
	assert_almost_eq(float(elements.get(&"cold", 0.0)), 200.0, 0.0001, "改 .tres 数值 → 伤害 200")


# ---------- 等级缩放：Lv10 = 100 × (1 + 0.1×9) = 190 ----------
func test_level_scaling() -> void:
	var data: SkillData = load(FROST_SHARD_PATH)
	var plans := SkillExecutor.cast(data, 10, _make_stats())
	var elements: Dictionary = plans[0].get(&"elements")
	assert_almost_eq(float(elements.get(&"cold", 0.0)), 190.0, 0.0001, "Lv10 冰伤 = 190")


# ---------- 属性参与：冰伤 +50% INCREASED → 150 ----------
func test_stats_affect_damage() -> void:
	var data: SkillData = load(FROST_SHARD_PATH)
	var sc := _make_stats()
	sc.add_modifier(_mod(&"cold_damage", StatModifierScript.Op.INCREASED, 50.0))
	var plans := SkillExecutor.cast(data, 1, sc)
	var elements: Dictionary = plans[0].get(&"elements")
	assert_almost_eq(float(elements.get(&"cold", 0.0)), 150.0, 0.0001, "100 × 1.5 = 150")


# ---------- 整数型 stat 末端 floor 一次：1 + 0.5 = 1.5 × 1.5 = 2.25 → 2 ----------
func test_projectile_count_floor_once() -> void:
	var data: SkillData = load(FROST_SHARD_PATH)
	var sc := _make_stats()
	sc.add_modifier(_mod(&"projectile_count", StatModifierScript.Op.FLAT_ADD, 0.5))
	sc.add_modifier(_mod(&"projectile_count", StatModifierScript.Op.INCREASED, 50.0))
	var plans := SkillExecutor.cast(data, 1, sc)
	assert_eq(plans.size(), 2, "2.25 末端统一 floor → 2 发（中途不取整）")


# ---------- 多发扇形 spread：count_base 3 + spread 30° ----------
func test_projectile_spread_plan() -> void:
	# 注意：.tres 加载出来的 Resource 是进程级共享实例（同一路径只 load 一次）。
	# 直接改 data.parts[0].behavior_params 会永久污染后续所有测试与沙盒
	# （本用例曾把 count_base 改成 3，导致 test_registries 的 r12 拿到 3+2=5）。
	# 改内容一律先 duplicate(true) 深拷贝。
	var data: SkillData = load(FROST_SHARD_PATH).duplicate(true)
	var part: SkillPart = data.parts[0]
	part.behavior_params[&"count_base"] = 3
	part.behavior_params[&"spread_deg"] = 30.0
	var plans := SkillExecutor.cast(data, 1, _make_stats())
	assert_eq(plans.size(), 3)
	assert_almost_eq(float(plans[0].get(&"angle_deg")), -15.0, 0.0001, "扇形均分：第一发 -15°")
	assert_almost_eq(float(plans[2].get(&"angle_deg")), 15.0, 0.0001, "扇形均分：最后一发 +15°")


# ---------- 纯函数守卫：cast 不得修改内容 Resource ----------
func test_cast_is_pure_over_skill_resource() -> void:
	# .tres 是进程级共享实例。cast 只要碰一下 data.parts[i].behavior_params，
	# 全局所有使用该技能的实体都会被污染，且不报错 —— 最难查的一类 bug。
	var data: SkillData = load(FROST_SHARD_PATH)
	var before := data.parts[0].behavior_params.duplicate(true)
	var sc := StatsComponent.new()
	sc.add_modifier(_mod(&"projectile_count", StatModifierScript.Op.FLAT_ADD, 2.0))
	SkillExecutor.cast(data, 3, sc, [], {&"projectile_count": {&"add": 3.0}})
	assert_eq(data.parts[0].behavior_params, before,
			"cast 必须纯函数：不得改动传入 SkillData 的任何字段")


# ---------- 近战行为金样：base 120 物理，inc +20% → 144 ----------
func test_melee_golden() -> void:
	var data := SkillDataScript.new()
	data.gem_id = &"test_cleave"
	data.display_name = "测试挥砍"
	data.tags = [&"attack", &"melee"] as Array[StringName]
	var scaling := preload("res://mods/jes-skills/systems/skills/data/gem_level_scaling.gd").new()
	data.level_scaling = scaling
	var part := preload("res://mods/jes-skills/systems/skills/data/skill_part.gd").new()
	part.damage_channel = SkillChannelScript.Channel.HIT
	part.base_damage = {&"physical": 120.0}
	part.damage_effectiveness = 1.0
	part.behavior_id = &"bhv_melee_swing"
	part.behavior_params = {&"arc_deg": 90.0, &"range": 80.0}
	data.parts = [part]

	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifierScript.Op.INCREASED, 20.0))
	var plans := SkillExecutor.cast(data, 1, sc)
	assert_eq(plans.size(), 1)
	assert_eq(plans[0].get(&"behavior_id"), &"bhv_melee_swing")
	var elements: Dictionary = plans[0].get(&"elements")
	assert_almost_eq(float(elements.get(&"physical", 0.0)), 144.0, 0.0001, "120 × 1.2 = 144")
	assert_almost_eq(float(plans[0].get(&"arc_deg")), 90.0, 0.0001)


# ---------- 未知 behavior_id：返回空结果，不崩溃 ----------
func test_unknown_behavior_returns_empty() -> void:
	var data := SkillDataScript.new()
	data.gem_id = &"test_bad"
	data.display_name = "坏行为"
	data.tags = [] as Array[StringName]
	data.level_scaling = preload("res://mods/jes-skills/systems/skills/data/gem_level_scaling.gd").new()
	var part := preload("res://mods/jes-skills/systems/skills/data/skill_part.gd").new()
	part.damage_channel = SkillChannelScript.Channel.HIT
	part.base_damage = {&"physical": 10.0}
	part.behavior_id = &"bhv_nonexistent"
	part.behavior_params = {}
	data.parts = [part]
	var plans := SkillExecutor.cast(data, 1, _make_stats())
	assert_eq(plans.size(), 0, "未知行为 → 空计划，不崩溃")
