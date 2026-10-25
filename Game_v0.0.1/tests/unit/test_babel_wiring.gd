## 批次 D 接线串测：8 技能走 BabelChiefSystem、敌方完整 AI、事件/封圣/商店/存档闭环。
## 全部纯逻辑 headless；不依赖 Cfg autoload（表内联）。
extends GutTest

const SKILLS: Dictionary = {
	"SK_PYRE": {"id": "SK_PYRE", "name_cn": "火刑柱", "cd": 3, "shape": "cross", "range": 1, "value": 0, "params": {"burn_dmg": 5}, "tags": ["terrain", "damage"]},
	"SK_OFFER": {"id": "SK_OFFER", "name_cn": "献祭", "cd": 2, "shape": "single", "range": 0, "value": 2, "params": {"self_loss_hp": 5, "team_atk_add": 2, "buff_rounds": 1}, "tags": ["buff"]},
	"SK_STARFALL": {"id": "SK_STARFALL", "name_cn": "星坠", "cd": 4, "shape": "cross", "range": 3, "value": 6, "params": {}, "tags": ["damage"]},
	"SK_REWIND": {"id": "SK_REWIND", "name_cn": "回溯", "cd": 5, "shape": "single", "range": 3, "value": 0, "params": {"reset_action": true}, "tags": ["move", "buff"]},
	"SK_COFFIN_WALL": {"id": "SK_COFFIN_WALL", "name_cn": "棺墙", "cd": 4, "shape": "single", "range": 2, "value": 0, "params": {"cover_hp": 20, "cover_count": 2}, "tags": ["terrain"]},
	"SK_TIDE": {"id": "SK_TIDE", "name_cn": "潮涌", "cd": 3, "shape": "line", "range": 3, "value": 0, "params": {"push": 2}, "tags": ["move"]},
	"SK_HOLY_RAIN": {"id": "SK_HOLY_RAIN", "name_cn": "圣雨", "cd": 4, "shape": "3x3", "range": 3, "value": 0, "params": {"wet_hits": 2}, "tags": ["debuff"]},
	"SK_CUT_TONGUE": {"id": "SK_CUT_TONGUE", "name_cn": "割舌", "cd": 4, "shape": "single", "range": 3, "value": 0, "params": {"silence_rounds": 2}, "tags": ["silence"]},
	"SK_SHADOW_SWAP": {"id": "SK_SHADOW_SWAP", "name_cn": "影替", "cd": 5, "shape": "single", "range": 3, "value": 5, "params": {"swap_shield": 5}, "tags": ["move", "shield"]},
	"SK_BONE_MAUSOLEUM": {"id": "SK_BONE_MAUSOLEUM", "name_cn": "万骨冢", "cd": 6, "shape": "single", "range": 1, "value": 0, "params": {"bone_hp": 3}, "tags": ["summon"]},
}

const SAVE_PATH: String = "user://test_babel_wiring_save.json"


func _mk_battle(team_ids: Array[String], n_enemies: int, enemy_hp: int = 10) -> BabelBattle:
	var b: BabelBattle = BabelBattle.new()
	b.skills_cfg = SKILLS
	add_child_autofree(b)
	var team: Array[Dictionary] = []
	for tid: String in team_ids:
		team.append({"id": tid, "name_cn": tid, "hp": 30, "move": 3, "skills": []})
	var enemies: Array[Dictionary] = []
	for i: int in range(n_enemies):
		enemies.append({"id": "EN%02d" % [i], "name_cn": "敌%d" % [i], "hp": enemy_hp, "dmg": 3, "move": 2})
	b.setup("测试章", team, enemies)
	return b


func _move_unit(b: BabelBattle, u: BabelUnit, to: Vector2i) -> void:
	b.board.remove_at(u.pos)
	b.board.place(u, to)


func _mk_enemy(b: BabelBattle, idx: int, to: Vector2i) -> BabelUnit:
	var e: BabelUnit = b.tm.enemies[idx]
	_move_unit(b, e, to)
	return e


# ---------- 8 技能接线 ----------

func test_sk_tide_pushes_two_cells() -> void:
	var b: BabelBattle = _mk_battle(["CH_xi", "CH_mo", "CH_man"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	var e: BabelUnit = _mk_enemy(b, 0, Vector2i(2, 5))
	assert_true(b.cast_skill(caster, SKILLS.get("SK_TIDE") as Dictionary, Vector2i(2, 3)), "潮涌施放成功")
	assert_eq(e.pos, Vector2i(2, 3), "直线上敌人被推离 2 格")


func test_sk_shadow_swap_positions_and_shields() -> void:
	var b: BabelBattle = _mk_battle(["CH_mo", "CH_xi", "CH_man"] as Array[String], 1)
	var a: BabelUnit = b.tm.players[0]
	var c: BabelUnit = b.tm.players[1]
	assert_true(b.cast_skill(a, SKILLS.get("SK_SHADOW_SWAP") as Dictionary, c.pos), "影替施放成功")
	assert_eq(a.pos, Vector2i(5, 7), "施法者换到友军位")
	assert_eq(c.pos, Vector2i(2, 7), "友军换到施法者位")
	assert_eq(a.shield, 5, "施法者 +5 盾")
	assert_eq(c.shield, 5, "友军 +5 盾")


func test_sk_bone_mausoleum_corpse_to_servant() -> void:
	var b: BabelBattle = _mk_battle(["CH_man", "CH_mo", "CH_xi"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	var e: BabelUnit = _mk_enemy(b, 0, Vector2i(2, 6))
	var corpse_cell: Vector2i = e.pos
	b.resolver.resolve_damage(null, e, e.hp, b.board)
	assert_false(e.alive, "敌人被击杀")
	assert_eq(b.corpses.size(), 1, "尸体已登记")
	var players_before: int = b.tm.players.size()
	assert_true(b.cast_skill(caster, SKILLS.get("SK_BONE_MAUSOLEUM") as Dictionary, caster.pos), "万骨冢施放成功")
	assert_eq(b.tm.players.size(), players_before + 1, "生成 1 名骨仆")
	var bone: BabelUnit = b.tm.players[players_before]
	assert_true(bone.is_player, "骨仆归我方")
	assert_eq(bone.hp, 3, "骨仆 3 HP")
	assert_eq(bone.pos, corpse_cell, "骨仆站在尸体格")
	assert_eq(b.corpses.size(), 0, "尸体已消耗")
	assert_true(b.board.unit_at(bone.pos) == bone, "骨仆占位合法")


func test_sk_offer_self_loss_and_team_atk() -> void:
	var b: BabelBattle = _mk_battle(["CH_jin"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	assert_true(b.cast_skill(caster, SKILLS.get("SK_OFFER") as Dictionary, caster.pos), "献祭施放成功")
	assert_eq(caster.hp, 25, "自损 5 HP")
	assert_eq(int(caster.state.get("atk_bonus", 0)), 2, "全队攻击 +2")


func test_sk_rewind_returns_to_round_start() -> void:
	var b: BabelBattle = _mk_battle(["CH_tong"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	var start: Vector2i = caster.pos
	assert_true(b.try_player_move(caster, start + Vector2i(0, -2)), "移动 2 格")
	assert_ne(caster.pos, start, "已离开回合开始位")
	assert_true(b.cast_skill(caster, SKILLS.get("SK_REWIND") as Dictionary, caster.pos), "回溯施放成功")
	assert_eq(caster.pos, start, "复位到本回合开始位置")
	assert_false(caster.acted, "行动被重置")


func test_sk_coffin_wall_places_cover_with_hp() -> void:
	var b: BabelBattle = _mk_battle(["CH_pan"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	assert_true(b.cast_skill(caster, SKILLS.get("SK_COFFIN_WALL") as Dictionary, Vector2i(2, 5)), "棺墙施放成功")
	assert_eq(b.board.terrain_at(Vector2i(2, 5)), "cover", "目标格变为掩体")
	assert_eq(int((b.board.terrain.get(Vector2i(2, 5)) as Dictionary).get("hp", 0)), 20, "掩体 HP 20")
	var covers: int = 0
	for p: Variant in b.board.terrain.keys():
		if b.board.terrain_at(p as Vector2i) == "cover":
			covers += 1
	assert_ge(covers, 2, "至少铺出 2 格掩体")


func test_sk_holy_rain_marks_wet() -> void:
	var b: BabelBattle = _mk_battle(["CH_xi"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	var e: BabelUnit = _mk_enemy(b, 0, Vector2i(2, 5))
	assert_true(b.cast_skill(caster, SKILLS.get("SK_HOLY_RAIN") as Dictionary, e.pos), "圣雨施放成功")
	assert_eq(int(e.state.get("wet_hits", 0)), 2, "敌人获得 wet 标记（后续受击 +3）")
	e.facing = Vector2i(0, -1)  # 背击 1.3 倍，排除朝向干扰后断言 wet 加成
	var hp_before: int = e.hp
	b.resolver.resolve_damage(caster, e, 4, b.board)
	assert_eq(e.hp, hp_before - 9, "受击结算吃 wet +3（base 4+3=7，背击 ×1.3）")


func test_sk_cut_tongue_silences_two_rounds() -> void:
	var b: BabelBattle = _mk_battle(["CH_mo"] as Array[String], 1)
	var caster: BabelUnit = b.tm.players[0]
	var e: BabelUnit = _mk_enemy(b, 0, Vector2i(2, 4))
	assert_true(b.cast_skill(caster, SKILLS.get("SK_CUT_TONGUE") as Dictionary, e.pos), "割舌施放成功")
	assert_eq(int(e.state.get("silenced_rounds", 0)), 2, "敌人被沉默 2 回合")


# ---------- 敌方回合 / front_block / boss ----------

func test_enemy_ai_decides_executable_plan() -> void:
	var b: BabelBattle = _mk_battle(["CH_xi"] as Array[String], 1)
	var e: BabelUnit = b.tm.enemies[0]
	var plan: Dictionary = b.enemy_ai.decide_action(e, b.board, b.tm.players)
	assert_true(plan.has("action"), "决策产出含 action")
	assert_true(["wait", "attack", "aoe", "summon", "pull", "shockwave", "aura_shield"].has(str(plan.get("action", ""))), "action 属于可执行集合")
	b._execute_enemy_ai(e)
	assert_true(b.board.in_bounds(e.pos) and b.board.unit_at(e.pos) == e, "执行后敌人占位合法")


func test_front_block_halves_player_damage() -> void:
	var b: BabelBattle = _mk_battle(["CH_tong"] as Array[String], 2)
	var caster: BabelUnit = b.tm.players[0]
	# 无特征敌人（对照）
	var plain: BabelUnit = b.tm.enemies[0]
	_move_unit(b, plain, Vector2i(2, 4))
	# front_block 敌人（对称位，朝向/距离一致）
	var blocker: BabelUnit = b.tm.enemies[1]
	blocker.state["traits"] = ["front_block"] as Array[String]
	blocker.state["params"] = {"front_block": 0.5}
	_move_unit(b, blocker, Vector2i(2, 6))
	var hp_plain: int = plain.hp
	b._apply_damage(caster, [Vector2i(2, 4)] as Array[Vector2i], 6)
	var loss_plain: int = hp_plain - plain.hp
	var hp_block: int = blocker.hp
	b._apply_damage(caster, [Vector2i(2, 6)] as Array[Vector2i], 6)
	var loss_block: int = hp_block - blocker.hp
	assert_gt(loss_plain, 0, "对照敌人受伤")
	assert_lt(loss_block, loss_plain, "front_block 敌人承伤低于对照")


func test_boss_dread_stacks_increase_damage() -> void:
	var b2: BabelBattle = BabelBattle.new()
	b2.skills_cfg = SKILLS
	add_child_autofree(b2)
	b2.boss_dread_stacks = 2
	var team: Array[Dictionary] = [{"id": "CH_xi", "name_cn": "汐", "hp": 30, "move": 3, "skills": []}]
	var enemies: Array[Dictionary] = [{"id": "EN13", "name_cn": "神孽", "hp": 100, "dmg": 20, "move": 3, "traits": ["boss_dread"], "params": {"dread_dmg_mul_per_stack": 0.1}}]
	b2.setup("终章", team, enemies)
	assert_eq(int(b2.boss_unit.state.get("dread_stacks", 0)), 2, "boss_dread 层数按章注入")
	assert_gt(BabelEnemyAI.boss_damage(b2.boss_unit), 20, "层数提升 Boss 伤害")


func test_boss_mutation_divine_wrath_aoe_once() -> void:
	var b2: BabelBattle = BabelBattle.new()
	b2.skills_cfg = SKILLS
	add_child_autofree(b2)
	b2.boss_id = "EN13"
	b2.boss_mutation = {"type": "divine_wrath", "params": {"threshold": 0.5, "aoe_dmg": 12}}
	var team: Array[Dictionary] = [{"id": "CH_xi", "name_cn": "汐", "hp": 30, "move": 3, "skills": []}]
	var enemies: Array[Dictionary] = [{"id": "EN13", "name_cn": "神孽", "hp": 100, "dmg": 20, "move": 3}]
	b2.setup("终章", team, enemies)
	var boss: BabelUnit = b2.boss_unit
	assert_false(boss == null, "Boss 单位已解析")
	boss.apply_hp(-60)
	assert_lt(b2.tm.players[0].hp, 30, "神怒触发：全体玩家受伤")
	var hp_after_first: int = b2.tm.players[0].hp
	boss.apply_hp(-1)
	assert_eq(b2.tm.players[0].hp, hp_after_first, "神怒只触发一次")


# ---------- 事件 / 封圣 / 商店 ----------

func test_event_effects_apply_to_team() -> void:
	var es: BabelEventSystem = BabelEventSystem.new()
	var group: Dictionary = {"chapter": 1, "options": [
		{"track": "devotion", "effects": [{"type": "team_shield", "value": 8}], "boss_mutation": {}},
		{"track": "blasphemy", "effects": [{"type": "team_atk_add", "value": 2}, {"type": "battle_start_stun", "value": 2, "targets": 1}], "boss_mutation": {"type": "divine_wrath", "params": {"threshold": 0.5, "aoe_dmg": 12}}},
	]}
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var u: BabelUnit = BabelUnit.create_default("p1", true)
	var units: Array[BabelUnit] = [u]
	assert_false(es.choose(group, "devotion").is_empty(), "事件选项命中")
	es.apply_effects(units, null)
	assert_eq(u.shield, 8, "事件效果 apply 后队伍护盾 +8")
	# 渎神：开场眩晕
	assert_false(es.choose(group, "blasphemy").is_empty(), "渎神选项命中")
	var stunned: BabelUnit = es.roll_stun_target(units, rng)
	assert_true(stunned == u, "渎神命中队员")
	assert_eq(int(stunned.state.get("stunned_rounds", 0)), 2, "渎神开场眩晕 2 回合")
	assert_false(stunned.can_act(), "眩晕期间不可行动")
	assert_false(es.boss_mutation.is_empty(), "Boss mutation 已记录")


func test_canonize_rolls_three_choices() -> void:
	var relic_sys: BabelRelicSystem = BabelRelicSystem.create_default()
	var pool: Array[Dictionary] = [
		{"id": "W1", "name_cn": "白", "rarity": "white", "effect": {"type": "stat_add", "params": {"melee_dmg_add": 3}}},
		{"id": "B1", "name_cn": "蓝", "rarity": "blue", "effect": {"type": "trigger", "params": {}}},
		{"id": "G1", "name_cn": "金", "rarity": "gold", "effect": {"type": "sacrifice_redirect", "params": {}}},
		{"id": "W2", "name_cn": "白2", "rarity": "white", "effect": {"type": "stat_add", "params": {}}},
	]
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var picks: Array[Dictionary] = []
	for i: int in range(3):
		var r: Dictionary = relic_sys.roll_relic(rng, pool, false)
		assert_false(r.is_empty(), "封圣第 %d 抽非空" % [i + 1])
		picks.append(r)
	assert_eq(picks.size(), 3, "封圣三选一抽 3 枚")
	var chosen: Dictionary = picks[0]
	relic_sys.add_relic(chosen)
	assert_eq(relic_sys.relics.size(), 1, "选一入包")


func test_shop_prices_read_config_table() -> void:
	assert_eq(BabelShopSystem.price_of({"rarity": "white"}), 10, "白基础价 10（读表）")
	assert_eq(BabelShopSystem.price_of({"rarity": "blue"}), 18, "蓝基础价 18（读表）")
	assert_eq(BabelShopSystem.price_of({"rarity": "gold"}), 30, "金基础价 30（读表）")
	assert_eq(BabelShopSystem.reroll_cost(), 5, "刷新费 5（读表）")
	assert_eq(BabelShopSystem.stock_count(), 3, "货架 3 件（读表）")


# ---------- 存档 ----------

func test_save_meta_run_roundtrip_and_clear() -> void:
	var s: BabelSave = BabelSave.new(SAVE_PATH)
	assert_true(s.save_meta({"incense": 55, "totems": ["TT01"], "unlocked_chiefs": ["CH_jin"]}), "meta 写入成功")
	assert_true(s.save_run({"chapter_idx": 2, "shards": 12, "relics": ["RL01"]}), "run 写入成功")
	var meta: Dictionary = s.load_meta()
	assert_eq(int(meta.get("incense", 0)), 55, "meta 往返一致（香火）")
	assert_eq((meta.get("totems", []) as Array).size(), 1, "meta 往返一致（图腾）")
	var run: Dictionary = s.load_run()
	assert_eq(int(run.get("chapter_idx", 0)), 2, "run 往返一致（章节）")
	assert_eq(int(run.get("shards", 0)), 12, "run 往返一致（残片）")
	assert_true(s.clear_run(), "clear_run 成功")
	assert_true(s.load_run().is_empty(), "clear_run 后 run 为空")
	assert_eq(int(s.load_meta().get("incense", 0)), 55, "clear_run 不清 meta")


func test_save_corruption_tolerated() -> void:
	var s: BabelSave = BabelSave.new(SAVE_PATH)
	var f: FileAccess = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	f.store_string("{not valid json!!")
	f.close()
	assert_true(s.load_meta().is_empty(), "损坏文件 load_meta 返回空")
	assert_true(s.load_run().is_empty(), "损坏文件 load_run 返回空")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
