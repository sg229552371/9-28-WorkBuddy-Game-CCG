## BabelEnemyAI 单测：最近目标/贪心移动/穿行/光环盾/拉拽/召唤/Boss 层数/AoE 形状。
extends GutTest

const AIScript = preload("res://mods/jes-babel/systems/enemy_ai.gd")

## 敌人 cfg 精简内联（字段与 cfg/srpg_enemies.json 一致）
const EN_STRAIGHT: Dictionary = {"id": "EN01", "hp": 10, "dmg": 3, "move": 2, "traits": ["straight"], "params": {}}
const EN_AURA: Dictionary = {"id": "EN02", "hp": 14, "dmg": 0, "move": 2, "traits": ["aura_shield"], "params": {"aura_shield": 2}}
const EN_PHASE: Dictionary = {"id": "EN09", "hp": 30, "dmg": 10, "move": 3, "traits": ["phase_move"], "params": {}}
const EN_PULL: Dictionary = {"id": "EN05", "hp": 12, "dmg": 4, "move": 3, "traits": ["pull"], "params": {"pull_range": 3}}
const EN_SUMMON: Dictionary = {"id": "EN14", "hp": 38, "dmg": 11, "move": 2, "traits": ["summoner"], "params": {"summon_id": "EN01", "summon_hp": 6, "summon_interval_rounds": 3}}
const EN_AOE: Dictionary = {"id": "EN04", "hp": 26, "dmg": 6, "move": 2, "traits": ["post_move_aoe"], "params": {"aoe_shape": "3x3", "aoe_center_dmg": 6, "aoe_edge_dmg": 3}}
const EN_SMOKE: Dictionary = {"id": "EN07", "hp": 20, "dmg": 5, "move": 2, "traits": ["smoke_terrain"], "params": {"smoke_rounds": 2, "smoke_dmg": 2}}
const EN_FRONT: Dictionary = {"id": "EN03", "hp": 20, "dmg": 5, "move": 2, "traits": ["front_block"], "params": {"front_block": 0.5}}
const EN_BOSS: Dictionary = {"id": "EN13", "hp": 300, "dmg": 20, "move": 3, "traits": ["boss_dread"], "params": {"dread_dmg_mul_per_stack": 0.1}}


func _ai() -> BabelEnemyAI:
	return AIScript.create_default()


func _setup(board: BabelBoard, enemy_cfg: Dictionary, enemy_pos: Vector2i, player_positions: Array[Vector2i]) -> Array[BabelUnit]:
	var e: BabelUnit = AIScript.build_enemy("e1", enemy_cfg)
	board.place(e, enemy_pos)
	var players: Array[BabelUnit] = []
	for i: int in range(player_positions.size()):
		var p: BabelUnit = BabelUnit.create_default("p%d" % [i], true)
		board.place(p, player_positions[i])
		players.append(p)
	return players


func test_nearest_target_and_move() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_STRAIGHT, Vector2i(1, 1), [Vector2i(8, 1), Vector2i(4, 1)])
	var plan: Dictionary = _ai().decide_action(board.unit_at(Vector2i(1, 1)) as BabelUnit, board, players)
	# 最近的是 (4,1)，move=2，直线走到 (3,1)
	assert_eq((plan.get("to", Vector2i()) as Vector2i), Vector2i(3, 1), "朝最近玩家直线贪心移动 2 格")
	assert_eq(plan.get("action", ""), "attack", "移动 2 格后进入攻击范围则攻击")


func test_move_blocked_skips_occupied() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_STRAIGHT, Vector2i(1, 1), [Vector2i(5, 1)])
	var blocker: BabelUnit = BabelUnit.create_default("blk", false)
	board.place(blocker, Vector2i(2, 1))
	var e: BabelUnit = board.unit_at(Vector2i(1, 1)) as BabelUnit
	var plan: Dictionary = _ai().decide_action(e, board, players)
	var to: Vector2i = plan.get("to", Vector2i()) as Vector2i
	assert_false(to == Vector2i(2, 1), "不落在被占格")
	assert_eq(board.unit_at(Vector2i(2, 1)), blocker, "占位未被覆盖")


func test_attack_when_adjacent() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_STRAIGHT, Vector2i(3, 3), [Vector2i(4, 3)])
	var plan: Dictionary = _ai().decide_action(board.unit_at(Vector2i(3, 3)) as BabelUnit, board, players)
	assert_eq(plan.get("action", ""), "attack", "相邻即攻击")
	assert_eq(plan.get("dmg", 0), 3, "攻击计划带 cfg 伤害")


func test_phase_through_passes_units() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_PHASE, Vector2i(1, 1), [Vector2i(6, 1)])
	var blocker: BabelUnit = BabelUnit.create_default("blk", false)
	board.place(blocker, Vector2i(2, 1))
	var e: BabelUnit = board.unit_at(Vector2i(1, 1)) as BabelUnit
	var plan: Dictionary = _ai().decide_action(e, board, players)
	assert_eq((plan.get("to", Vector2i()) as Vector2i), Vector2i(4, 1), "相位移动可穿过占位直行 3 格")


func test_aura_shield_grants_shield_to_adjacent_enemy() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_AURA, Vector2i(5, 4), [Vector2i(1, 1)])
	var mate: BabelUnit = BabelUnit.create_default("mate", false)
	board.place(mate, Vector2i(6, 4))
	var e: BabelUnit = board.unit_at(Vector2i(5, 4)) as BabelUnit
	var plan: Dictionary = _ai().decide_action(e, board, players)
	assert_eq(plan.get("action", ""), "aura_shield", "光环盾行动")
	assert_eq(mate.shield, 2, "相邻敌获得 +2 盾")
	assert_eq(e.pos, Vector2i(5, 4), "光环单位不移动")


func test_pull_drags_nearest_player() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_PULL, Vector2i(1, 1), [Vector2i(4, 1)])
	var e: BabelUnit = board.unit_at(Vector2i(1, 1)) as BabelUnit
	var plan: Dictionary = _ai().decide_action(e, board, players)
	assert_eq(plan.get("action", ""), "pull", "射程内触发拉拽")
	assert_eq(players[0].pos, Vector2i(2, 1), "玩家被拉到敌人身前一格")


func test_pull_adjacent_cannot_drag() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_PULL, Vector2i(1, 1), [Vector2i(2, 1)])
	var plan: Dictionary = _ai().decide_action(board.unit_at(Vector2i(1, 1)) as BabelUnit, board, players)
	assert_false(plan.get("action", "") == "pull", "相邻玩家拉不动")


func test_summon_interval() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_SUMMON, Vector2i(5, 4), [Vector2i(0, 1)])
	var e: BabelUnit = board.unit_at(Vector2i(5, 4)) as BabelUnit
	var ai: BabelEnemyAI = _ai()
	assert_eq(ai.decide_action(e, board, players).get("action", ""), "wait", "第 1 次不召唤")
	assert_eq(ai.decide_action(e, board, players).get("action", ""), "wait", "第 2 次不召唤")
	var p3: Dictionary = ai.decide_action(e, board, players)
	assert_eq(p3.get("action", ""), "summon", "第 3 次触发召唤")
	var unit_cfg: Variant = p3.get("unit")
	assert_true(unit_cfg is Dictionary and int((unit_cfg as Dictionary).get("hp", 0)) == 6, "召唤数据带 6 点 HP 的泥塑俑")
	assert_eq(ai.decide_action(e, board, players).get("action", ""), "wait", "召唤后重新计数")


func test_aoe3x3_shape() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_AOE, Vector2i(3, 3), [Vector2i(8, 8)])
	var e: BabelUnit = board.unit_at(Vector2i(3, 3)) as BabelUnit
	var plan: Dictionary = _ai().decide_action(e, board, players)
	assert_eq(plan.get("action", ""), "aoe", "AoE 敌人移动后必放 AoE")
	var cells: Variant = plan.get("cells")
	assert_true(cells is Array and (cells as Array).size() == 9, "3×3 共 9 格")
	assert_true((cells as Array).has(Vector2i(5, 3)), "以终点为中心")


func test_smoke_death_cells() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var e: BabelUnit = AIScript.build_enemy("e1", EN_SMOKE)
	board.place(e, Vector2i(4, 4))
	var cells: Array[Dictionary] = AIScript.on_death_cells(e)
	assert_eq(cells.size(), 1, "熏烟缠尸死亡留 1 片烟格")
	assert_eq((cells[0].get("pos", Vector2i()) as Vector2i), Vector2i(4, 4), "烟格即死亡位置")
	assert_eq(int(cells[0].get("rounds", 0)), 2, "烟持续 2 回合")


func test_front_block_mul() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var e: BabelUnit = AIScript.build_enemy("e1", EN_FRONT)
	assert_almost_eq(AIScript.front_block_mul(e), 0.5, 0.0001, "正面承伤乘区 0.5")


func test_boss_dread_stacks() -> void:
	var e: BabelUnit = AIScript.build_enemy("e1", EN_BOSS)
	assert_eq(AIScript.boss_damage(e), 20, "0 层时基础伤害 20")
	AIScript.add_dread(e, 2)
	assert_eq(AIScript.boss_damage(e), 24, "2 层每层 +10% => 24")
	AIScript.add_dread(e, 3)
	assert_eq(AIScript.boss_damage(e), 30, "5 层 => 30")


func test_enemy_act_signal_emitted() -> void:
	var board: BabelBoard = BabelBoard.create_default()
	var players: Array[BabelUnit] = _setup(board, EN_STRAIGHT, Vector2i(1, 1), [Vector2i(4, 1)])
	var ai: BabelEnemyAI = _ai()
	watch_signals(ai)
	ai.decide_action(board.unit_at(Vector2i(1, 1)) as BabelUnit, board, players)
	assert_signal_emitted(ai, "enemy_act", "决策后广播 enemy_act")
