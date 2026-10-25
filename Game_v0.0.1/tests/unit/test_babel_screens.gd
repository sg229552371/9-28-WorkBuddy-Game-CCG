## 《巴别回路》批次 C 屏幕层测试：状态机/装配/战斗初始化/朝向/敌 AI/胜负。
## 不依赖鼠标输入；直接 new BabelBoard 等核心类与 BabelBattle/BabelMain 纯逻辑。
extends GutTest

const BattleScript = preload("res://mods/jes-babel/scenes/babel_battle.gd")
const MainScript = preload("res://mods/jes-babel/scenes/babel_main.gd")

var skills: Dictionary = {}


func before_all() -> void:
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/srpg_skills.json"))
	if raw is Dictionary:
		skills = raw as Dictionary


func _mk_battle() -> BabelBattle:
	var b: BabelBattle = BattleScript.new()
	b.skills_cfg = skills
	return b


func _team_desc() -> Array[Dictionary]:
	return [
		{"id": "CH_jin", "name_cn": "焚香者·烬", "hp": 30, "move": 3, "skills": ["SK_PYRE", "SK_OFFER"]},
		{"id": "CH_tong", "name_cn": "观星者·瞳", "hp": 30, "move": 3, "skills": ["SK_STARFALL", "SK_REWIND"]},
	]


func _enemy_desc(n: int) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i: int in range(n):
		out.append({"id": "EN%02d" % [i], "name_cn": "泥塑俑%d" % [i], "hp": 10, "dmg": 3, "move": 2})
	return out


func test_state_machine_valid_paths() -> void:
	assert_true(MainScript.is_transition_valid("main_city", "hero_select"), "主城可进选人")
	assert_true(MainScript.is_transition_valid("main_city", "totem"), "主城可进图腾")
	assert_true(MainScript.is_transition_valid("hero_select", "battle"), "选人可进战斗")
	assert_true(MainScript.is_transition_valid("battle", "settle"), "战斗可进结算")
	assert_true(MainScript.is_transition_valid("settle", "battle"), "结算可进下一章战斗")
	assert_true(MainScript.is_transition_valid("settle", "totem"), "结算可进图腾")
	assert_true(MainScript.is_transition_valid("totem", "main_city"), "图腾可回主城")
	assert_false(MainScript.is_transition_valid("main_city", "battle"), "主城不可跳进战斗")
	assert_false(MainScript.is_transition_valid("battle", "main_city"), "战斗不可直接回主城")
	assert_false(MainScript.is_transition_valid("totem", "battle"), "图腾不可直接进战斗")


func test_transition_rejects_invalid() -> void:
	var m: BabelMain = MainScript.new()
	autofree(m)
	m.state = MainScript.STATE_MAIN_CITY
	assert_false(m.transition_to(MainScript.STATE_BATTLE), "非法迁移被拒绝")
	assert_eq(m.state, MainScript.STATE_MAIN_CITY, "非法迁移后状态不变")
	m.state = MainScript.STATE_SETTLE
	assert_true(m.transition_to(MainScript.STATE_TOTEM), "合法迁移生效")
	assert_eq(m.state, MainScript.STATE_TOTEM, "合法迁移后状态更新")


func test_build_team_picks_three() -> void:
	var chiefs: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/srpg_chiefs.json"))
	var picked: Array[String] = ["CH_jin", "CH_pan", "CH_mo"]
	var team: Array[Dictionary] = MainScript.build_team(chiefs, picked)
	assert_eq(team.size(), 3, "装配出 3 名祭司")
	var ids: Array[String] = []
	for d: Dictionary in team:
		ids.append(str(d.get("id", "")))
	assert_has(ids, "CH_jin", "烬在队")
	assert_has(ids, "CH_pan", "磐在队")
	assert_has(ids, "CH_mo", "默在队")
	var team2: Array[Dictionary] = MainScript.build_team(chiefs, [] as Array[String])
	assert_eq(team2.size(), 0, "空选装配为空队")


func test_battle_init_units_and_factions() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(3))
	assert_eq(b.tm.players.size(), 2, "玩家 2 名")
	assert_eq(b.tm.enemies.size(), 3, "敌人 3 名")
	var all_on_board: int = b.board.units.size()
	assert_eq(all_on_board, 5, "全场 5 个占位")
	for u: BabelUnit in b.tm.players:
		assert_true(u.is_player, "玩家阵营正确")
		assert_true(b.board.in_bounds(u.pos), "玩家在界内")
	for u: BabelUnit in b.tm.enemies:
		assert_false(u.is_player, "敌方阵营正确")


func test_battle_roll_enemies_count_and_boss() -> void:
	var enemies: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/srpg_enemies.json"))
	var ch1: Dictionary = {"id": "CH1", "boss_id": "EN13", "mob_hp_min": 8, "mob_hp_max": 12, "mob_dmg_min": 3, "mob_dmg_max": 4}
	var ch3: Dictionary = {"id": "CH3", "boss_id": "EN13", "mob_hp_min": 30, "mob_hp_max": 45, "mob_dmg_min": 10, "mob_dmg_max": 14}
	var e1: Array[Dictionary] = MainScript.roll_enemies(enemies, ch1, false)
	assert_eq(e1.size(), 3, "第 1 章 3 个小怪")
	var e3: Array[Dictionary] = MainScript.roll_enemies(enemies, ch3, true)
	assert_eq(e3.size(), 6, "终章 5 小怪 + Boss")
	var last: Dictionary = e3[e3.size() - 1]
	assert_eq(str(last.get("id", "")), "EN13", "末位为 Boss")
	assert_eq(int(last.get("hp", 0)), 300, "Boss HP 读章节表")


func test_facing_rotation_cycles() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(1))
	var u: BabelUnit = b.tm.players[0]
	u.facing = Vector2i(0, 1)
	assert_eq(b.rotate_facing(u), Vector2i(1, 0), "下转右")
	assert_eq(b.rotate_facing(u), Vector2i(0, -1), "右上")
	assert_eq(b.rotate_facing(u), Vector2i(-1, 0), "上转左")
	assert_eq(b.rotate_facing(u), Vector2i(0, 1), "左转下，循环闭合")


func test_reachable_cells_respect_move_left() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(1))
	var u: BabelUnit = b.tm.players[0]
	b.board.remove_at(u.pos)
	b.board.place(u, Vector2i(5, 5))
	var cells: Array[Vector2i] = b.reachable_cells(u)
	assert_eq(cells.size(), 23, "棋盘中心移动 3 可达 24 格扣除 1 个队友占位")
	u.move_left = 1
	assert_eq(b.reachable_cells(u).size(), 4, "移动 1 可达 4 邻格")
	u.move_left = 0
	assert_eq(b.reachable_cells(u).size(), 0, "无移动力不可达")


func test_player_move_updates_facing() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(1))
	var u: BabelUnit = b.tm.players[0]
	b.board.remove_at(u.pos)
	b.board.place(u, Vector2i(5, 5))
	var to: Vector2i = u.pos + Vector2i(2, 0)
	assert_true(b.try_player_move(u, to), "向右移动成功")
	assert_eq(u.facing, Vector2i(1, 0), "位移主轴更新朝向为右")
	assert_eq(u.move_left, 2, "一次移动消耗 1 格移动力（manhattan<=move_left 口径）")
	assert_eq(b.board.unit_at(to), u, "占位表更新")


func test_skill_supported_and_damage_cast() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(2))
	var starfall: Dictionary = skills.get("SK_STARFALL") as Dictionary
	assert_true(BabelBattle.is_skill_supported(starfall), "星坠（damage）已接线")
	assert_false(BabelBattle.is_skill_supported(skills.get("SK_REWIND") as Dictionary), "回溯待接线")
	assert_false(BabelBattle.is_skill_supported(skills.get("SK_HOLY_RAIN") as Dictionary), "圣雨待接线")
	var caster: BabelUnit = b.tm.players[0]
	caster.facing = Vector2i(0, -1)
	var victim: BabelUnit = b.tm.enemies[0]
	b.board.remove_at(caster.pos)
	b.board.place(caster, Vector2i(5, 5))
	b.board.remove_at(victim.pos)
	b.board.place(victim, Vector2i(5, 4))
	var hp_before: int = victim.hp
	assert_true(b.cast_skill(caster, starfall, Vector2i(5, 4)), "十字星坠施放成功")
	assert_true(victim.hp < hp_before or not victim.alive, "敌人掉血")
	assert_true(caster.acted, "施法消耗行动")
	assert_eq(int(caster.cds.get("SK_STARFALL", 0)), 4, "进入冷却")


func test_enemy_ai_moves_legally_and_attacks() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(1))
	var e: BabelUnit = b.tm.enemies[0]
	b.board.remove_at(e.pos)
	b.board.place(e, Vector2i(5, 1))
	var p: BabelUnit = b.tm.players[0]
	b.board.remove_at(p.pos)
	b.board.place(p, Vector2i(5, 5))
	var dist_before: int = b.board.manhattan(e.pos, p.pos)
	b.enemy_ai_step(e)
	assert_true(b.board.in_bounds(e.pos), "敌 AI 移动后在界内")
	assert_true(b.board.unit_at(e.pos) == e, "敌 AI 占位合法")
	assert_true(b.board.manhattan(e.pos, p.pos) < dist_before or b.board.manhattan(e.pos, p.pos) <= 1, "敌 AI 拉近距离")
	if b.board.manhattan(e.pos, p.pos) <= 1:
		assert_true(p.hp < p.max_hp, "贴身后发起攻击")


func test_battle_over_triggers_settle_path() -> void:
	var b: BabelBattle = _mk_battle()
	add_child_autofree(b)
	b.setup("测试章", _team_desc(), _enemy_desc(1))
	watch_signals(b)
	for e: BabelUnit in b.tm.enemies:
		e.apply_hp(-e.hp)
	b.tm.check_battle_over()
	assert_signal_emitted_with_parameters(b, "battle_finished", ["player"], 0)
	assert_eq(MainScript.settle_incense(5), 10, "香火 = 击杀 x2（残片模拟）")


func test_settle_incense_zero_kills() -> void:
	assert_eq(MainScript.settle_incense(0), 0, "零击杀零香火")
