## BabelResolver 单测：朝向倍率/护盾/wet/保底/击杀/AoE/超时与神罚。
extends GutTest

const BoardScript = preload("res://mods/jes-babel/scripts/board_grid.gd")
const UnitScript = preload("res://mods/jes-babel/scripts/unit_state.gd")
const ResolverScript = preload("res://mods/jes-babel/scripts/combat_resolver.gd")

var board: BabelBoard
var resolver: BabelResolver


func before_each() -> void:
	board = BoardScript.create_default()
	resolver = ResolverScript.create_default()


func _mk(id: String, pos: Vector2i, facing: Vector2i, is_player: bool = true) -> BabelUnit:
	var u: BabelUnit = UnitScript.create_default(id, is_player)
	u.facing = facing
	board.place(u, pos)
	return u


## 目标朝向 (0,1)：上方攻击=正面，下方=背面，右侧=侧面
func test_front_damage_mul() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	var attacker: BabelUnit = _mk("a", Vector2i(5, 3), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 7, "正面受击 x0.7：10 变 7")
	assert_eq(target.hp, 23, "生命扣除 7 点")
	assert_eq(int(res["raw"]), 10, "原始伤害保留在结果中")


func test_back_damage_mul() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	var attacker: BabelUnit = _mk("a", Vector2i(5, 5), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 13, "背面受击 x1.3：10 变 13")


func test_side_damage_mul() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	var attacker: BabelUnit = _mk("a", Vector2i(6, 4), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 10, "侧面基础倍率 1.0")


func test_coffin_side_guard_mul() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	target.side_guard = true
	var attacker: BabelUnit = _mk("a", Vector2i(6, 4), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 7, "磐侧向盾 x0.75：10 变 7（向下取整）")


func test_shield_absorbs_first() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	target.max_hp = 10
	target.hp = 10
	target.shield = 3
	var attacker: BabelUnit = _mk("a", Vector2i(6, 4), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 10, "侧面无倍率：收伤 10")
	assert_eq(int(res["to_shield"]), 3, "护盾先吸收 3 点")
	assert_eq(target.shield, 0, "护盾清零")
	assert_eq(int(res["to_hp"]), 7, "剩余 7 点入血")
	assert_eq(target.hp, 3, "生命 10 减 7 剩 3")


func test_wet_bonus_once_then_consumed() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	target.state["wet_hits"] = 1
	var attacker: BabelUnit = _mk("a", Vector2i(5, 3), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_eq(int(res["after_facing"]), 10, "湿面正面 7+3=10")
	assert_eq(int(target.state["wet_hits"]), 0, "命中一次后 wet_hits 减 1")


func test_minimum_damage_floor() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	var attacker: BabelUnit = _mk("a", Vector2i(5, 5), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 1, board)
	assert_eq(int(res["after_facing"]), 1, "保底 1：1 点背面取整不为 0")


func test_kill_emits_and_removed_from_board() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	target.hp = 5
	var deaths: Array = []
	target.unit_died.connect(func(u: Variant): deaths.append(u))
	var attacker: BabelUnit = _mk("a", Vector2i(5, 3), Vector2i(0, 1))
	var res: Dictionary = resolver.resolve_damage(attacker, target, 10, board)
	assert_true(bool(res["killed"]), "结果标记击杀")
	assert_eq(deaths.size(), 1, "unit_died 信号发出一次")
	assert_null(board.unit_at(Vector2i(5, 4)), "死亡单位从棋盘移除")
	assert_false(target.alive, "存活位翻转")


func test_aoe_cross_multi_targets() -> void:
	var a: BabelUnit = _mk("a", Vector2i(5, 4), Vector2i(0, 1))
	var b: BabelUnit = _mk("b", Vector2i(5, 3), Vector2i(0, 1))
	var c: BabelUnit = _mk("c", Vector2i(6, 4), Vector2i(0, 1), false)
	var cells: Array[Vector2i] = board.cells_in_shape("cross", Vector2i(5, 4), Vector2i(1, 0), 1)
	var results: Array[Dictionary] = resolver.apply_aoe(a, cells, 6, board)
	assert_eq(results.size(), 3, "十字 AoE 命中原格与两邻共 3 个单位")
	assert_eq(a.hp, 24, "原格单位承伤 6")
	assert_eq(b.hp, 23, "上邻单位背面承伤 x1.3 取整 7")
	assert_eq(c.hp, 24, "侧邻敌人承伤 6")


func test_overcap_from_round_26() -> void:
	assert_eq(resolver.overcap_mul(25), 1.0, "第 25 回合无超时增幅")
	assert_eq(resolver.overcap_mul(26), 1.1, "第 26 回合增幅 10%")


func test_punishment_from_round_18() -> void:
	var target: BabelUnit = _mk("t", Vector2i(5, 4), Vector2i(0, 1))
	target.max_hp = 30
	target.hp = 30
	var units: Array = [target]
	resolver.apply_punishment(units, 17)
	assert_eq(target.hp, 30, "第 17 回合无神罚")
	resolver.apply_punishment(units, 18)
	assert_eq(target.hp, 27, "第 18 回合起每回合扣 10% 最大生命（向上取整=3）")
