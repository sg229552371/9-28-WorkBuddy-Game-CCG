extends GutTest

const EndlessModeScript = preload("res://mods/jes-endless/scripts/endless_mode.gd")

var combat: JesCombat
var endless_cfg: Dictionary
var monster_table: Dictionary
var monster_id: String

func before_each() -> void:
	endless_cfg = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/endless.json"))
	monster_table = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/monsters.json"))
	monster_id = "NM0010"
	combat = JesCombat.new()
	combat.setup({}, monster_table, {"monsterLevel": 1}, {
		"levelCurve": {"rows": [{"hpMul": 3.0}]},
	})
	combat.spawn_pool = [monster_id]
	combat.elite_every_waves = 0
	combat.boss_every_waves = 0

func _start_endless() -> void:
	combat.endless_mode = EndlessModeScript.new(endless_cfg, monster_table)
	combat.endless_mode.set_seed(20261024)
	combat.endless_mode.begin()

func _tick_wave() -> void:
	combat.wave_timer = combat.wave_interval
	combat.step(0.0, Vector2.ZERO, Vector2.ZERO, false)

func _kill_all() -> void:
	for monster in combat.monsters:
		combat._damage_monster(monster, float(monster.hp) + float(monster.def) + float(monster.get("shield", 0.0)))

func test_normal_mode_keeps_curve_and_unlimited_waves() -> void:
	assert_null(combat.get("endless_mode"), "默认应为普通关卡")
	var monster := combat.spawn_monster(monster_id)
	var tpl: Dictionary = monster_table[monster_id]
	assert_almost_eq(float(monster.hp), float(tpl.hp) * 3.0, 0.001, "普通关卡仍使用关卡曲线")
	assert_almost_eq(float(monster.atk), float(tpl.atk) * combat.enemy_atk_mul, 0.001, "普通关卡仍使用原攻击倍率")
	combat.wave_index = 100
	_tick_wave()
	assert_eq(combat.wave_index, 101, "普通关卡刷波不受无尽上限限制")

func test_endless_scales_template_without_normal_curve() -> void:
	_start_endless()
	combat.endless_mode.next_floor()
	combat.endless_mode.set_affixes(["tough", "swift", "frenzy"])
	var tpl: Dictionary = monster_table[monster_id]
	var original := tpl.duplicate(true)
	var expected: Dictionary = combat.endless_mode.scale_monster(tpl)
	var monster := combat.spawn_monster(monster_id)
	assert_almost_eq(float(monster.hp), float(expected.hp), 0.001, "无尽生命只使用无尽缩放，不叠普通曲线")
	assert_almost_eq(float(monster.hp_max), float(expected.hpMax), 0.001, "最大生命同步无尽模板")
	assert_almost_eq(float(monster.atk), float(expected.atk), 0.001, "无尽攻击倍率只应用一次")
	assert_almost_eq(float(monster.spd), float(expected.spd), 0.001, "词缀速度进入战斗实体")
	assert_eq(tpl, original, "怪物配置模板不得被污染")

func test_floor_advanced_signal_after_final_wave_is_cleared() -> void:
	_start_endless()
	watch_signals(combat)
	var cap: int = combat.endless_mode.wave_cap(1)
	for i in range(cap):
		_tick_wave()
		_kill_all()
	combat.step(0.0, Vector2.ZERO, Vector2.ZERO, false)
	assert_eq(combat.endless_mode.wave, 2, "清完本层全部波次自动进入第二层")
	assert_signal_emit_count(combat, "floor_advanced", 1, "推进只发一次信号")
	var args: Array = get_signal_parameters(combat, "floor_advanced")
	assert_eq(args[0], 2, "信号携带新层号")
	assert_eq(args[1].size(), 3, "信号携带配置生成的三选一")
	assert_eq(combat.wave_index, 0, "新层重置层内波数")

func test_wave_cap_blocks_spawning_until_live_enemies_are_cleared() -> void:
	_start_endless()
	var cap: int = combat.endless_mode.wave_cap(1)
	for i in range(cap):
		if i > 0:
			_kill_all()
		_tick_wave()
	assert_eq(combat.wave_index, cap, "波数达到配置上限")
	var count := combat.monsters.size()
	_tick_wave()
	assert_eq(combat.wave_index, cap, "有存活怪时不能超过本层波数上限")
	assert_eq(combat.monsters.size(), count, "达到上限不得继续刷怪")
	assert_eq(combat.endless_mode.wave, 1, "最后一波未清完不能升层")

func test_kill_recorded_once_and_settlement_matches() -> void:
	_start_endless()
	var monster := combat.spawn_monster(monster_id)
	_kill_all()
	combat._damage_monster(monster, 1.0)
	var result: Dictionary = combat.endless_mode.settle()
	assert_eq(result.kills, 1, "死亡怪重复受击不能重复累计无尽击杀")
	assert_eq(combat.kills, 1, "战斗击杀计数仍正常累计")

func test_endless_boss_uses_same_scaling_path() -> void:
	_start_endless()
	combat.endless_mode.next_floor()
	combat.endless_mode.set_affixes(["tough", "frenzy"])
	var boss_id := "BS0001"
	var expected: Dictionary = combat.endless_mode.scale_monster(monster_table[boss_id])
	var boss := combat.spawn_boss(boss_id)
	assert_false(boss.is_empty(), "配置中的首个首领可生成")
	assert_almost_eq(float(boss.hp), float(expected.hp), 0.001, "首领血量也使用无尽缩放")
	assert_almost_eq(float(boss.atk), float(expected.atk), 0.001, "首领攻击不重复乘普通关卡倍率")

func test_full_field_does_not_consume_endless_wave() -> void:
	_start_endless()
	combat.monster_cap = 1
	combat.spawn_monster(monster_id)
	_tick_wave()
	assert_eq(combat.wave_index, 0, "同屏已满不能空耗波次配额")
	_kill_all()
	_tick_wave()
	assert_eq(combat.wave_index, 1, "死亡怪不阻塞下一波生成")

func _make_battle() -> Node2D:
	var script = load("res://mods/jes-engine-core/scripts/battle.gd")
	var battle = script.new()
	autofree(battle)
	battle.combat = combat
	battle.hud = Label.new()
	battle.add_child(battle.hud)
	combat.floor_advanced.connect(battle._on_floor_advanced)
	return battle

func _press_key(battle: Node2D, key: Key) -> void:
	var event := InputEventKey.new()
	event.keycode = key
	event.pressed = true
	battle._unhandled_input(event)

func test_f_key_starts_endless_and_preserves_crystals_and_chests() -> void:
	var battle = _make_battle()
	battle._crystals.append({"id": "kept", "level": 1})
	combat.chests.append({"pos": Vector2.ZERO, "quality": "normal"})
	combat.spawn_monster(monster_id)
	combat.wave_index = 5
	_press_key(battle, KEY_F)
	assert_not_null(combat.endless_mode, "F 键接入无尽核心")
	assert_eq(combat.endless_mode.wave, 1, "开局为第一层")
	assert_eq(combat.wave_index, 0, "普通关卡波数不带入无尽")
	assert_eq(combat.monsters.size(), 0, "旧关卡怪物不带入无尽")
	assert_eq(combat.chests.size(), 1, "开启无尽不丢弃地上宝箱")
	assert_eq(battle._crystals.size(), 1, "开启无尽不丢弃已装备水晶")
	assert_string_contains(battle.hud.text, "无尽 第1层", "HUD 显示当前无尽层数")
	combat.endless_mode.next_floor()
	_press_key(battle, KEY_F)
	assert_eq(combat.endless_mode.wave, 2, "重复按 F 不重置本局进度")

func test_reward_keys_grant_configured_coins_once_and_refresh_hud() -> void:
	_start_endless()
	var battle = _make_battle()
	var offer: Array = combat.endless_mode.next_floor()
	battle._on_floor_advanced(2, offer)
	assert_eq(battle._endless_rewards.size(), 3, "HUD 接收三选一候选")
	assert_string_contains(battle.hud.text, "层间奖励三选一", "层间提示选择按键")
	var gold_index := -1
	for i in range(offer.size()):
		if offer[i].id == "gold":
			gold_index = i
	assert_gte(gold_index, 0, "候选中包含配置金币项")
	if gold_index < 0:
		return
	var coins_before := combat.coin_gained
	var keys := [KEY_1, KEY_2, KEY_3]
	_press_key(battle, keys[gold_index])
	assert_eq(combat.coin_gained, coins_before + int(offer[gold_index].amount), "数字键奖励金币直接来自候选配置")
	assert_true(battle._endless_rewards.is_empty(), "选中后清空候选恢复战斗")
	assert_string_contains(battle.hud.text, "已选择", "奖励领取后立即刷新提示")
	_press_key(battle, keys[gold_index])
	assert_eq(combat.coin_gained, coins_before + int(offer[gold_index].amount), "重复按键不能重复领奖")

func test_death_hud_contains_settlement_and_affix_names() -> void:
	_start_endless()
	var battle = _make_battle()
	combat.endless_mode.set_affixes(["tough", "swift"])
	combat.spawn_monster(monster_id)
	_kill_all()
	combat._damage_player(float(combat.player.hp) + float(combat.player.def))
	battle._update_hud()
	assert_string_contains(battle.hud.text, "坚韧", "HUD 显示词缀中文名")
	assert_string_contains(battle.hud.text, "迅捷", "HUD 显示全部当前词缀")
	assert_string_contains(battle.hud.text, "无尽结算", "死亡 HUD 显示结算")
	assert_eq(battle._endless_settlement, combat.endless_mode.settle(), "HUD 结算直接使用核心 settle 返回值")

