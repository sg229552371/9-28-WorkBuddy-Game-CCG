## BabelTurnManager 单测：移动/施法/回合推进/沉默/眩晕/胜负。
extends GutTest

const BoardScript = preload("res://mods/jes-babel/scripts/board_grid.gd")
const UnitScript = preload("res://mods/jes-babel/scripts/unit_state.gd")
const ResolverScript = preload("res://mods/jes-babel/scripts/combat_resolver.gd")
const TurnScript = preload("res://mods/jes-babel/scripts/turn_manager.gd")

var tm: BabelTurnManager
var board: BabelBoard
var hero: BabelUnit


func before_each() -> void:
	tm = TurnScript.create_default()
	board = tm.board
	hero = UnitScript.create_default("hero", true)
	board.place(hero, Vector2i(2, 2))
	tm.players.append(hero)


func test_initial_round_state() -> void:
	assert_eq(hero.move_left, 3, "开局 move_left=3")
	assert_false(hero.acted, "开局未行动")
	assert_eq(tm.round_idx, 1, "开局第 1 回合")
	assert_eq(tm.phase, "player", "开局玩家阶段")


func test_move_consumes_move_left() -> void:
	assert_true(tm.try_move(hero, Vector2i(3, 2)), "一格内移动成功")
	assert_eq(hero.move_left, 2, "移动一次后 move_left 减 1")
	assert_eq(hero.pos, Vector2i(3, 2), "坐标更新")


func test_move_rejects_out_of_range_and_occupied() -> void:
	assert_false(tm.try_move(hero, Vector2i(6, 2)), "超出剩余移动被拒绝")
	var foe: BabelUnit = UnitScript.create_default("foe", false)
	board.place(foe, Vector2i(3, 2))
	assert_false(tm.try_move(hero, Vector2i(3, 2)), "已占格移动被拒绝")


func test_cast_sets_acted_and_blocks_skill() -> void:
	var skill: Dictionary = {"id": "fire_pillar", "cd": 3}
	var targets: Array[Vector2i] = [Vector2i(4, 2)]
	assert_true(tm.try_cast(hero, skill, targets), "首次施法成功")
	assert_true(hero.acted, "施法后 acted=true")
	assert_false(tm.try_cast(hero, skill, targets), "已行动不能再施法")
	assert_eq(int(hero.cds["fire_pillar"]), 3, "技能进入冷却")


func test_cast_blocked_on_cooldown() -> void:
	var skill: Dictionary = {"id": "star_fall", "cd": 4}
	hero.cds["star_fall"] = 2
	assert_false(tm.try_cast(hero, skill, [] as Array[Vector2i]), "冷却中不能施法")


func test_end_round_advances_and_resets() -> void:
	hero.acted = true
	var foe: BabelUnit = UnitScript.create_default("foe", false)
	board.place(foe, Vector2i(8, 8))
	tm.enemies.append(foe)
	tm.end_player_round()
	assert_eq(tm.round_idx, 2, "回合推进到 2")
	assert_eq(hero.move_left, 3, "新回合 move_left 重置")
	assert_false(hero.acted, "新回合 acted 重置")
	assert_eq(tm.phase, "player", "回到玩家阶段")


func test_silenced_cannot_cast_but_can_move() -> void:
	hero.state["silenced_rounds"] = 2
	var skill: Dictionary = {"id": "holy_rain", "cd": 4}
	assert_false(tm.try_cast(hero, skill, [] as Array[Vector2i]), "沉默单位不能施法")
	assert_true(tm.try_move(hero, Vector2i(3, 2)), "沉默单位仍可移动")


func test_stun_countdown_decrements_on_round_end() -> void:
	hero.state["stunned_rounds"] = 2
	hero.acted = true
	tm.end_player_round()
	assert_eq(int(hero.state["stunned_rounds"]), 1, "回合推进后眩晕倒计时递减")
	assert_eq(tm.round_idx, 2, "回合已推进")


func test_players_wiped_emits_battle_over_enemy() -> void:
	var foe: BabelUnit = UnitScript.create_default("foe", false)
	board.place(foe, Vector2i(8, 8))
	tm.enemies.append(foe)
	var winners: Array = []
	tm.battle_over.connect(func(w: String): winners.append(w))
	hero.apply_hp(-999)
	tm.check_battle_over()
	assert_eq(winners.size(), 1, "胜负信号发出一次")
	assert_eq(str(winners[0]), "enemy", "玩家全灭判负")


func test_all_acted_signal() -> void:
	var signals: Array = []
	tm.all_acted.connect(func(): signals.append(true))
	hero.acted = true
	tm.end_player_round()
	assert_eq(signals.size(), 1, "全员行动后发出 all_acted")
