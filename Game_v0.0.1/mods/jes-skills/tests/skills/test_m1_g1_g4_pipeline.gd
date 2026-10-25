# M1 黄金用例测试：G1–G4（规格 §12）
# G1 加乘分离：  base 100, inc+50%, more+20%×2 → 216.0
# G2 inc 加算：  base 100, inc+30%+30%, more+20%×2 → 230.4
# G3 转换顺序：  (100+20)→50%物理转火→物理72/火焰84 → 合计156
# G4 转换归一化：100物理, 60%→火+60%→冰 → 火50/冰50/物理0
# 说明：浮点断言用 is_equal_approx 语义（assert_almost_eq）；
#       G6 的逐位相等（==）要求属于 M3，不在此文件。
extends GutTest

const MODS_DIR := "res://mods/jes-skills/systems/skills"


func _make_stats() -> StatsComponent:
	return StatsComponent.new()


func _mod(stat: StringName, op: int, value: float, channel_mask: int = SkillChannel.Channel.ALL) -> StatModifier:
	var m := StatModifier.new()
	m.stat = stat
	m.op = op
	m.value = value
	m.source_id = &"test:golden"
	m.channel_mask = channel_mask
	return m


func _conv(from_el: StringName, to_el: StringName, ratio: float) -> DamageConversion:
	return DamageConversion.new(from_el, to_el, ratio)


# ---------- G1 加乘分离 ----------
func test_g1_increased_then_more() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 50.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [&"attack", &"melee"] as Array[StringName], [])
	assert_almost_eq(out[&"physical"], 216.0, 0.0001, "G1: 100×1.5×1.2×1.2=216")


# ---------- G2 inc 加算 more 连乘 ----------
func test_g2_increased_sums_more_multiplies() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 30.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 30.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [&"attack"] as Array[StringName], [])
	assert_almost_eq(out[&"physical"], 230.4, 0.0001, "G2: 100×1.6×1.44=230.4")


# ---------- G3 转换顺序（§4.3 验收样例）----------
func test_g3_conversion_order() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.FLAT_ADD, 20.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 20.0))
	sc.add_modifier(_mod(&"fire_damage", StatModifier.Op.INCREASED, 40.0))
	var convs: Array[DamageConversion] = [_conv(&"physical", &"fire", 0.5)]
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [&"attack"] as Array[StringName], convs)
	assert_almost_eq(out[&"physical"], 72.0, 0.0001, "G3: 物理残留 60×1.2=72")
	assert_almost_eq(out[&"fire"], 84.0, 0.0001, "G3: 火焰 60×1.4=84")
	assert_almost_eq(out[&"physical"] + out[&"fire"], 156.0, 0.0001, "G3: 合计 156")


# ---------- G4 转换归一化 ----------
func test_g4_conversion_normalized_over_100() -> void:
	var sc := _make_stats()
	var convs: Array[DamageConversion] = [
		_conv(&"physical", &"fire", 0.6),
		_conv(&"physical", &"cold", 0.6),
	]
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [] as Array[StringName], convs)
	assert_almost_eq(out[&"fire"], 50.0, 0.0001, "G4: 火 50")
	assert_almost_eq(out[&"cold"], 50.0, 0.0001, "G4: 冰 50")
	assert_almost_eq(out[&"physical"], 0.0, 0.0001, "G4: 物理残留 0")


# ---------- FLAT_ADD 乘 damage_effectiveness（§4.2）----------
func test_flat_add_scales_with_effectiveness() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.FLAT_ADD, 20.0))
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 0.5,
		SkillChannel.Channel.HIT, [] as Array[StringName], [])
	assert_almost_eq(out[&"physical"], 110.0, 0.0001, "FLAT 20×0.5=10，INC/MORE 不乘 effectiveness")


# ---------- INCREASED/MORE 不乘 damage_effectiveness ----------
func test_inc_more_ignore_effectiveness() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 50.0))
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.MORE, 20.0))
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 2.0,
		SkillChannel.Channel.HIT, [] as Array[StringName], [])
	assert_almost_eq(out[&"physical"], 180.0, 0.0001, "effectiveness 不影响 INC/MORE")


# ---------- 通道隔离：HIT 通道词缀不影响 DOT 通道结算 ----------
func test_channel_isolation() -> void:
	var sc := _make_stats()
	sc.add_modifier(_mod(&"physical_damage", StatModifier.Op.INCREASED, 100.0, SkillChannel.Channel.HIT))
	var hit_out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [] as Array[StringName], [])
	var dot_out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.DOT, [] as Array[StringName], [])
	assert_almost_eq(hit_out[&"physical"], 200.0, 0.0001, "HIT 通道吃到词缀")
	assert_almost_eq(dot_out[&"physical"], 100.0, 0.0001, "DOT 通道不吃 HIT 词缀")


# ---------- StatsComponent 按 source_id 卸载还原 ----------
func test_remove_by_source_restores() -> void:
	var sc := _make_stats()
	sc.add_modifiers([
		_mod(&"physical_damage", StatModifier.Op.INCREASED, 50.0),
		_mod(&"physical_damage", StatModifier.Op.MORE, 20.0),
	], &"support:test_gem")
	assert_eq(sc.get_modifiers().size(), 2, "注入 2 条")
	sc.remove_by_source(&"support:test_gem")
	assert_eq(sc.get_modifiers().size(), 0, "按 source_id 卸载后为空")
	var out := DamagePipeline.compute_elements(
		{&"physical": 100.0}, sc, 1.0,
		SkillChannel.Channel.HIT, [] as Array[StringName], [])
	assert_almost_eq(out[&"physical"], 100.0, 0.0001, "卸载后数值还原")
