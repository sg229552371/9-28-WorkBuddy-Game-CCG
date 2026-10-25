## 单测：朝向减伤 / 人数补偿 / 经验锚点插值 / 神罚计时（babel_rules.gd）
extends GutTest

const FACING_CFG: Dictionary = {"front_mul": 0.7, "back_mul": 1.3, "side_mul": 1.0}
const COMP_CFG: Dictionary = {
	"hp_mul": [1.25, 1.12, 1.0],
	"dps_mul": [1.12, 1.12, 1.0],
	"shard_mul": [1.10, 1.05, 1.0],
}


func test_snap4_basic() -> void:
	assert_eq(BabelRules.snap4(Vector2(10, 1)), Vector2i(1, 0))
	assert_eq(BabelRules.snap4(Vector2(1, 10)), Vector2i(0, 1))
	assert_eq(BabelRules.snap4(Vector2(-10, -1)), Vector2i(-1, 0))
	assert_eq(BabelRules.snap4(Vector2.ZERO), Vector2i(0, 1))


func test_facing_front_back_side() -> void:
	# 受击者朝右；攻击从右侧袭来（行进方向向左）= 正面 0.7
	assert_almost_eq(BabelRules.facing_mul(Vector2i(1, 0), Vector2i(-1, 0), FACING_CFG), 0.7, 0.001)
	# 从背后袭来（行进方向向右）= 1.3
	assert_almost_eq(BabelRules.facing_mul(Vector2i(1, 0), Vector2i(1, 0), FACING_CFG), 1.3, 0.001)
	# 侧面 = 1.0
	assert_almost_eq(BabelRules.facing_mul(Vector2i(1, 0), Vector2i(0, 1), FACING_CFG), 1.0, 0.001)


func test_compensation() -> void:
	var c1: Dictionary = BabelRules.compensation(1, COMP_CFG)
	var c2: Dictionary = BabelRules.compensation(2, COMP_CFG)
	var c3: Dictionary = BabelRules.compensation(3, COMP_CFG)
	assert_almost_eq(float(c1["hp_mul"]), 1.25, 0.001)
	assert_almost_eq(float(c1["shard_mul"]), 1.10, 0.001)
	assert_almost_eq(float(c2["hp_mul"]), 1.12, 0.001)
	assert_almost_eq(float(c2["shard_mul"]), 1.05, 0.001)
	assert_almost_eq(float(c3["hp_mul"]), 1.0, 0.001)
	# 越界夹到 1~3
	var c0: Dictionary = BabelRules.compensation(0, COMP_CFG)
	assert_almost_eq(float(c0["hp_mul"]), 1.25, 0.001)


func test_xp_interpolation() -> void:
	var anchors: Array = [1.0, 25.0, 60.0, 100.0]
	assert_eq(BabelRules.level_int(0.0, anchors), 1)
	assert_eq(BabelRules.level_int(1.0, anchors), 2)
	assert_eq(BabelRules.level_int(25.0, anchors), 3)
	assert_eq(BabelRules.level_int(100.0, anchors), 5)
	assert_eq(BabelRules.level_int(999.0, anchors), 5)
	# 分段线性：12.5 在 1~25 段中点 → level ≈ 2.5
	assert_almost_eq(BabelRules.level_for_xp(13.0, anchors), 2.5, 0.01)


func test_xp_to_next_and_progress() -> void:
	var anchors: Array = [1.0, 25.0, 60.0, 100.0]
	assert_almost_eq(BabelRules.xp_to_next(0.0, anchors), 1.0, 0.001)
	assert_almost_eq(BabelRules.xp_to_next(90.0, anchors), 10.0, 0.001)
	assert_almost_eq(BabelRules.xp_to_next(200.0, anchors), 0.0, 0.001)
	assert_almost_eq(BabelRules.level_progress(0.0, anchors), 0.0, 0.001)
	assert_almost_eq(BabelRules.level_progress(13.0, anchors), 0.5, 0.01)


func test_punishment_timer() -> void:
	var cfg: Dictionary = {"start_s": 75.0, "tick_s": 10.0, "hp_loss_ratio": 0.10}
	assert_almost_eq(BabelRules.punishment_ratio(70.0, 0.0, cfg), 0.0, 0.001)
	assert_almost_eq(BabelRules.punishment_ratio(76.0, 0.0, cfg), 0.10, 0.001)
	assert_almost_eq(BabelRules.punishment_ratio(76.0, 1.0, cfg), 0.0, 0.001)
	assert_almost_eq(BabelRules.punishment_ratio(86.0, 1.0, cfg), 0.10, 0.001)


func test_roll_rarity_all_weights_zero_fallback() -> void:
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 42
	var r: String = BabelRules.roll_rarity(rng, {"white_w": 0, "blue_w": 0, "gold_w": 100})
	assert_eq(r, "gold")
