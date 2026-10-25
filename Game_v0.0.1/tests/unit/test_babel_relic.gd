## BabelRelicSystem 单测：加权分布/商店金概率/蓝反馈阈值/stat_add/未知类型安全。
extends GutTest

const RelicScript = preload("res://mods/jes-babel/systems/relic_system.gd")

## 精简内联圣物池（字段与 cfg/srpg_relics.json 一致）
var pool: Array[Dictionary] = [
	{"id": "W1", "name_cn": "白一", "rarity": "white", "effect": {"type": "stat_add", "params": {"melee_dmg_add": 3}}},
	{"id": "W2", "name_cn": "白二", "rarity": "white", "effect": {"type": "stat_add", "params": {"shield_cap_add": 1}}},
	{"id": "W3", "name_cn": "白三", "rarity": "white", "effect": {"type": "stat_add", "params": {"team_hp_add": 4}}},
	{"id": "B1", "name_cn": "蓝一", "rarity": "blue", "effect": {"type": "trigger", "params": {"event": "battle_start", "shield": 2}}},
	{"id": "B2", "name_cn": "蓝二", "rarity": "blue", "effect": {"type": "move_override", "params": {"first_move_blink": true}}},
	{"id": "G1", "name_cn": "金一", "rarity": "gold", "effect": {"type": "sacrifice_redirect", "params": {"self_loss_to_enemy_aoe": true}}},
]


func _sys(rules: Dictionary = {}) -> BabelRelicSystem:
	return RelicScript.create_default() if rules.is_empty() else RelicScript.new(rules)


func _mk_unit(id: String) -> BabelUnit:
	return BabelUnit.create_default(id, true)


func test_rarity_distribution_default() -> void:
	var sys: BabelRelicSystem = _sys()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 20261025
	var counts: Dictionary = {"white": 0, "blue": 0, "gold": 0}
	var n: int = 1000
	for i: int in range(n):
		var r: String = sys.roll_rarity(rng, false)
		counts[r] = int(counts.get(r, 0)) + 1
	var gold_ratio: float = float(counts["gold"]) / float(n)
	var blue_ratio: float = float(counts["blue"]) / float(n)
	assert_between(gold_ratio, 0.01, 0.10, "默认金概率约 5%，样本区间 1%~10%")
	assert_between(blue_ratio, 0.15, 0.35, "默认蓝概率约 25%，样本区间 15%~35%")


func test_shop_gold_chance_raised() -> void:
	var sys: BabelRelicSystem = _sys()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 42
	var gold_n: int = 0
	var n: int = 1000
	for i: int in range(n):
		if sys.roll_rarity(rng, true) == "gold":
			gold_n += 1
	var ratio: float = float(gold_n) / float(n)
	assert_between(ratio, 0.06, 0.20, "商店金概率约 12%，明显高于默认 5%")
	# 蓝保持 25 不变
	var blue_n: int = 0
	rng.seed = 42
	for i: int in range(n):
		if sys.roll_rarity(rng, true) == "blue":
			blue_n += 1
	assert_between(float(blue_n) / float(n), 0.15, 0.35, "商店蓝概率不变（约 25%）")


func test_roll_relic_excludes_owned_and_rarity() -> void:
	var sys: BabelRelicSystem = _sys()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 7
	# 持有全部白色后，white 抽取应落到其他稀有度
	sys.add_relic(pool[0])
	sys.add_relic(pool[1])
	sys.add_relic(pool[2])
	for i: int in range(50):
		var r: Dictionary = sys.roll_relic(rng, pool, false)
		assert_false(str(r.get("rarity", "")) == "white" and ["W1", "W2", "W3"].has(str(r.get("id", ""))), "已持有白不再被抽到")
	# 全池持有后返回空
	sys.add_relic(pool[3])
	sys.add_relic(pool[4])
	sys.add_relic(pool[5])
	var empty: Dictionary = sys.roll_relic(rng, pool, false)
	assert_true(empty.is_empty(), "全池持有后 roll_relic 返回空字典")
	assert_push_warning("圣物池已抽空")


func test_blue_feedback_threshold_and_bonus() -> void:
	var sys: BabelRelicSystem = _sys({"blue_feedback_threshold": 4, "blue_feedback_event_bonus": 0.15})
	assert_eq(sys.get_blasphemy_bonus(), 0.0, "蓝不足阈值时渎神加成为 0")
	sys.add_relic(pool[3])
	sys.add_relic(pool[4])
	assert_eq(sys.count_blue(), 2, "蓝计数正确")
	sys.add_relic({"id": "B3", "rarity": "blue"})
	sys.add_relic({"id": "B4", "rarity": "blue"})
	assert_true(sys.blue_feedback_active(), "蓝达到 4 件激活反馈")
	assert_almost_eq(sys.get_blasphemy_bonus(), 0.15, 0.0001, "渎神事件率 +0.15")


func test_stat_add_applied_to_unit() -> void:
	var sys: BabelRelicSystem = _sys()
	var u: BabelUnit = _mk_unit("u1")
	var res: Dictionary = sys.apply_effect(pool[0], u, null)
	assert_true(bool(res.get("ok", false)), "stat_add 应用成功")
	assert_eq(int(u.state.get("melee_dmg_add", 0)), 3, "近战伤害 +3 写入 state")
	var res2: Dictionary = sys.apply_effect(pool[2], u, null)
	assert_true(bool(res2.get("ok", false)), "team_hp_add 应用成功")
	assert_eq(u.max_hp, 34, "全队最大 HP +4（30 -> 34）")


func test_move_override_and_trigger_stored() -> void:
	var sys: BabelRelicSystem = _sys()
	var u: BabelUnit = _mk_unit("u1")
	var r1: Dictionary = sys.apply_effect(pool[4], u, null)
	assert_true(bool(r1.get("ok", false)), "move_override 应用成功")
	var mv: Variant = u.state.get("move_override")
	assert_true(mv is Dictionary and bool((mv as Dictionary).get("first_move_blink", false)), "瞬移参数存入 unit.state")
	var r2: Dictionary = sys.apply_effect(pool[3], u, null)
	assert_true(bool(r2.get("ok", false)), "trigger 应用成功")
	var tg: Variant = u.state.get("relic_triggers")
	assert_true(tg is Array and (tg as Array).size() == 1, "trigger 存入 relic_triggers")


func test_unknown_effect_type_safe() -> void:
	var sys: BabelRelicSystem = _sys()
	var u: BabelUnit = _mk_unit("u1")
	var bad: Dictionary = {"id": "X", "rarity": "white", "effect": {"type": "totally_unknown", "params": {}}}
	var res: Dictionary = sys.apply_effect(bad, u, null)
	assert_false(bool(res.get("ok", true)), "未知 effect.type 返回 ok=false")
	assert_push_warning("未支持的 effect.type")
	assert_true(u.alive, "未知类型不崩不误伤单位")


func test_relic_acquired_signal() -> void:
	var sys: BabelRelicSystem = _sys()
	watch_signals(sys)
	sys.add_relic(pool[0])
	assert_signal_emitted(sys, "relic_acquired", "获得圣物广播")
	assert_signal_emit_count(sys, "relic_acquired", 1, "广播恰好一次")
	assert_eq(sys.relics.size(), 1, "圣物登记入列")
