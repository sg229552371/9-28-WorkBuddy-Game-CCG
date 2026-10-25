## GameScreens 纯逻辑屏状态机与数据组装测试。
extends GutTest

var screens: GameScreens

func before_each() -> void:
	screens = GameScreens.new()

func test_initial_state_is_boot() -> void:
	assert_eq(screens.state, GameScreens.STATE_BOOT, "初始屏幕应为 boot")

func test_legal_state_flow() -> void:
	assert_true(screens.transition_to(GameScreens.STATE_MENU), "boot 应能进入主城")
	assert_true(screens.transition_to(GameScreens.STATE_CHAR_SELECT), "主城应能进入选人")
	assert_true(screens.transition_to(GameScreens.STATE_PLAYING), "选人应能进入战斗")
	assert_true(screens.transition_to(GameScreens.STATE_SETTLED), "战斗应能进入结算")
	assert_eq(screens.state, GameScreens.STATE_SETTLED, "合法流转后的状态应为结算")

func test_illegal_state_flow_is_rejected() -> void:
	var old_state := screens.state
	assert_false(screens.transition_to(GameScreens.STATE_SETTLED), "boot 不应直接进入结算")
	assert_eq(screens.state, old_state, "非法流转不应改变状态")

func test_menu_entries_are_loaded_from_city_cfg() -> void:
	var entries := screens.build_menu_entries()
	assert_gt(entries.size(), 0, "主城入口列表不应为空")
	assert_eq(entries[0]["id"], "portal", "首个主城入口应为出征传送门")
	assert_true(entries[0].has("desc"), "入口应携带配置文案")

func test_character_cards_load_heroes_and_inject_unlock_state() -> void:
	screens.set_unlock_state({"H001": true, "H002": false})
	var cards := screens.build_character_cards()
	assert_eq(cards.size(), screens.heroes.size(), "选人卡数量应等于英雄配置数量")
	assert_true(bool(cards[0]["unlocked"]), "注入的 H001 解锁态应生效")
	assert_false(bool(cards[1]["unlocked"]), "注入的 H002 锁定态应生效")
	assert_true(cards[0].has("hp"), "选人卡应保留 cfg 英雄属性")

func test_character_cards_accept_per_call_unlock_override() -> void:
	screens.set_unlock_state({"H001": false})
	var cards := screens.build_character_cards({"H001": true})
	assert_true(bool(cards[0]["unlocked"]), "调用级解锁态应覆盖默认解锁态")
	assert_true(screens.is_hero_unlocked("H001", {"hero_ids": ["H001"]}), "hero_ids 注入格式应支持")

func test_settlement_lines_are_chinese_and_data_driven() -> void:
	var lines := screens.build_settlement_lines({
		"reason": "extract",
		"kills": 7,
		"wave": 3,
		"crystals": 12,
		"bossKills": 1,
		"elapsed": 65,
	})
	assert_gte(lines.size(), 5, "结算应生成多行明细")
	assert_true(lines[0].contains("撤离成功"), "结算第一行应包含中文结局")
	assert_true(lines[1].contains("击杀") and lines[1].contains("7"), "结算应包含击杀数")
	assert_true(lines[3].contains("结晶") and lines[3].contains("12"), "结算应包含结晶数")
	assert_true(lines.back().contains("01:05"), "战斗时长应格式化为 MM:SS")

func test_timeout_and_death_outcomes() -> void:
	var timeout_lines := screens.build_settlement_lines({"timedOut": true})
	var death_lines := screens.build_settlement_lines({})
	assert_true(timeout_lines[0].contains("时限耗尽"), "超时结算应显示时限耗尽")
	assert_true(death_lines[0].contains("战斗失败"), "未指定原因应显示战斗失败")


func teardown() -> void:
	if GameState.state != GameScreens.STATE_BOOT:
		GameState.state = GameScreens.STATE_BOOT
