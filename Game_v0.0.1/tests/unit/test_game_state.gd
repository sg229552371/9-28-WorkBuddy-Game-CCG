## GameState / 主循环单元测试（口径对齐真源 js/game.js G 与 js/main.js loop）
extends GutTest

const MainScript = preload("res://mods/jes-engine-core/scripts/main.gd")

func test_initial_boot() -> void:
	assert_eq(GameState.state, "boot")

func test_set_state_signal() -> void:
	watch_signals(GameState)
	GameState.set_state("menu")
	assert_eq(GameState.state, "menu")
	assert_signal_emitted_with_parameters(GameState, "state_changed", ["boot", "menu"])
	GameState.set_state("boot")   # 收尾还原，避免污染其他用例
	assert_eq(GameState.state, "boot")

func test_set_state_rejects_invalid() -> void:
	var old: String = GameState.state
	GameState.set_state("不存在的状态")
	assert_eq(GameState.state, old)   # 非法值不改状态

## 场景串联流（D051）：跨场景字段默认值与回写
func test_scene_flow_fields() -> void:
	assert_eq(GameState.hero_id, "H001")     # 默认英雄，直启 battle 不炸
	assert_eq(GameState.level_id, "LEVEL_001")
	assert_eq(GameState.last_settlement, {})
	GameState.hero_id = "H002"               # 选人界面回写口径
	GameState.last_settlement = {"kills": 3, "wave": 2}
	assert_eq(GameState.hero_id, "H002")
	assert_eq(int(GameState.last_settlement.get("kills", 0)), 3)
	GameState.hero_id = "H001"               # 收尾还原
	GameState.last_settlement = {}

## 场景串联流：city 是合法状态（真源 main.js loop 分支识别 city）
func test_city_state_valid() -> void:
	GameState.set_state("city")
	assert_eq(GameState.state, "city")
	GameState.set_state("boot")

## D051 集成胶水：场景脚本可加载、关键方法存在（裂隙/赛季/回城）
## 口径：用实例级 has_method（脚本资源级 has_method 在 Godot 4.7 不可靠）
func test_scene_scripts_and_methods() -> void:
	var city_s: GDScript = load("res://mods/jes-engine-core/scripts/city.gd")
	assert_not_null(city_s)
	var city_inst: Node = city_s.new()
	add_child_autofree(city_inst)
	assert_true(city_inst.has_method("_on_hero_selected"))
	var battle_s: GDScript = load("res://mods/jes-engine-core/scripts/battle.gd")
	assert_not_null(battle_s)
	var battle_inst: Node = battle_s.new()   # 不入树，_ready 不触发，免加载战斗场景
	for method in ["_back_to_city", "_start_rift", "_show_death_settlement", "_restore_season", "_on_monster_killed"]:
		assert_true(battle_inst.has_method(method), "battle 缺少方法: " + method)
	battle_inst.free()

func test_loop_dt_clamp() -> void:
	var main: Node = MainScript.new()
	add_child_autofree(main)
	# delta 超上界 → 钳到 0.05
	main._process(1.0)
	assert_almost_eq(GameState.time, 0.05, 0.0001)
	# 正常步长原样通过
	main._process(0.016)
	assert_almost_eq(GameState.time, 0.066, 0.0001)

func test_loop_only_playing_runs_systems() -> void:
	var main: Node = MainScript.new()
	add_child_autofree(main)
	var calls: Array = []
	main.playing_systems.append(func(dt): calls.append(dt))
	GameState.set_state("menu")
	main._process(0.016)
	assert_eq(calls.size(), 0)            # 非 playing：不执行
	GameState.set_state("playing")
	main._process(0.016)
	assert_eq(calls.size(), 1)            # playing：执行
	assert_almost_eq(calls[0], 0.016, 0.0001)
	GameState.set_state("boot")   # 收尾还原

func teardown() -> void:
	GameState.time = 0.0
	if GameState.state != "boot":
		GameState.state = "boot"
