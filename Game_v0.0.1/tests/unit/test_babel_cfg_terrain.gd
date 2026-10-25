## 单测：配置表防御读取（键缺失回退默认 + push_warning 不崩）与地形生成覆盖率
extends GutTest

func test_rules_defaults_when_table_missing() -> void:
	var data: BabelCfgData = BabelCfgData.new()
	data.inject_table("srpg_rules", null)
	var rules: Dictionary = data.rules()
	assert_almost_eq(float((rules.get("facing", {}) as Dictionary).get("front_mul", 0.0)), 0.7, 0.001)
	assert_almost_eq(float((rules.get("punishment_timer", {}) as Dictionary).get("start_s", 0.0)), 75.0, 0.001)
	var shop: Dictionary = data.shop()
	assert_almost_eq(float(shop.get("gold_chance", 0.0)), 0.12, 0.001)


func test_chiefs_defensive() -> void:
	var data: BabelCfgData = BabelCfgData.new()
	data.inject_table("srpg_chiefs", [{"id": "CH_x", "name_cn": "测试祭司"}])
	var chiefs: Array = data.chiefs()
	assert_eq(chiefs.size(), 1)
	assert_eq(str((chiefs[0] as Dictionary).get("name_cn", "")), "测试祭司")
	assert_false(bool((chiefs[0] as Dictionary).get("unlocked_default", false)))


func test_chapters_defensive() -> void:
	var data: BabelCfgData = BabelCfgData.new()
	data.inject_table("srpg_chapters", [{"id": "CH1", "name_cn": "泥胎"}])
	var chs: Array = data.chapters()
	assert_eq(chs.size(), 1)
	var ch: Dictionary = chs[0] as Dictionary
	assert_true((ch.get("minion_hp", []) as Array).size() == 2)
	assert_true((ch.get("waves", []) as Array).is_empty())


func test_terrain_coverage_at_least_30pct() -> void:
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 123
	var t: BabelTerrain = BabelTerrain.new()
	t.generate(rng, Vector2(2160, 720), 64.0, 0.35)
	assert_gt(t.coverage(), 0.30)
	assert_eq(t.cols, 33)
	assert_eq(t.rows, 11)


func test_terrain_cover_resolution() -> void:
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 5
	var t: BabelTerrain = BabelTerrain.new()
	t.generate(rng, Vector2(640, 640), 64.0, 0.4)
	# 构造单格掩体（覆盖已有内容）
	t.grid.clear()
	t.grid[Vector2i(3, 3)] = BabelTerrain.TYPE_COVER
	var pos: Vector2 = Vector2(3.5 * 64.0 + 20.0, 3.5 * 64.0)
	var new_pos: Vector2 = t.resolve_cover_circle(pos, 18.0)
	assert_true(new_pos != pos)
