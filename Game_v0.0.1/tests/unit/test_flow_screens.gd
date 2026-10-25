## 场景流流转合法性与锁关规则测试（FlowRoot）
extends GutTest

var flow: FlowRoot


func before_each() -> void:
	flow = FlowRoot.new()
	add_child_autofree(flow)


func test_screen_graph_covers_html_screens() -> void:
	for screen_key: String in ["screen-main", "screen-help", "screen-settings", "screen-codex",
			"screen-goodbye", "screen-level", "screen-character", "screen-settle"]:
		assert_true(flow.SCREEN_GRAPH.has(screen_key), "流转图应包含屏幕 " + screen_key)


func test_legal_navigation_chain() -> void:
	assert_true(flow.can_navigate("screen-main", "screen-help"), "主菜单可进操作说明")
	assert_true(flow.can_navigate("screen-help", "screen-main"), "操作说明可返回主菜单")
	assert_true(flow.can_navigate("screen-main", "screen-settings"), "主菜单可进设置")
	assert_true(flow.can_navigate("screen-main", "screen-codex"), "主菜单可进图鉴")
	assert_true(flow.can_navigate("screen-main", "screen-goodbye"), "主菜单可进退出确认")
	assert_true(flow.can_navigate("screen-level", "screen-character"), "选关可进选人")
	assert_true(flow.can_navigate("screen-character", "screen-level"), "选人可返回选关")
	assert_true(flow.can_navigate("screen-settle", "city"), "结算可回城")
	assert_true(flow.can_navigate("screen-settle", "screen-main"), "结算可回主菜单")


func test_illegal_navigation_is_rejected() -> void:
	assert_false(flow.can_navigate("screen-main", "screen-level"), "主菜单不应直跳选关（须经主城）")
	assert_false(flow.can_navigate("screen-help", "screen-codex"), "帮助不应直跳图鉴")
	assert_false(flow.can_navigate("screen-goodbye", "screen-level"), "退出确认不应直跳选关")
	assert_false(flow.can_navigate("screen-character", "screen-settle"), "选人不应直跳结算")


func test_initial_screen_is_main_menu() -> void:
	assert_eq(flow.current_screen, "screen-main", "初始屏幕应为主菜单")


func test_level_unlock_rule_is_order_based() -> void:
	assert_true(FlowRoot.is_level_index_unlocked(0, 1), "第 1 关初始应解锁")
	assert_false(FlowRoot.is_level_index_unlocked(1, 1), "第 2 关初始应锁定")
	assert_true(FlowRoot.is_level_index_unlocked(2, 3), "解锁 3 关时第 3 关应可打")
	assert_false(FlowRoot.is_level_index_unlocked(3, 3), "解锁 3 关时第 4 关应锁定")
	assert_true(FlowRoot.is_level_index_unlocked(0, 0), "异常档位 0 也应放行第 1 关")


func test_level_grid_built_from_cfg() -> void:
	var expected: int = Cfg.get_levels().size()
	flow.open_level_select()
	assert_eq(flow.current_screen, "screen-level", "选关屏应打开")
	var grid: GridContainer = flow.find_child("LevelGrid", true, false)
	assert_not_null(grid, "关卡网格应存在")
	assert_eq(grid.get_child_count(), expected, "关卡卡数量应等于 levels.json 条数")
	if expected > 0:
		var card: Control = grid.get_child(1)
		assert_true(card is PanelContainer, "锁定关也应渲染卡片（灰显）")


func test_pick_level_routes_to_char_select_and_sets_state() -> void:
	var levels := Cfg.get_levels()
	if levels.is_empty():
		fail_test("levels.json 不应为空")
		return
	flow.open_level_select()
	flow._on_level_card_pressed(str((levels[0] as Dictionary).get("id", "")))
	assert_eq(GameState.level_id, str((levels[0] as Dictionary).get("id", "")), "选卡应写入 GameState.level_id")
	assert_eq(flow.current_screen, "screen-character", "选关后应进入选人屏")


func test_team_selection_respects_max_size() -> void:
	var heroes := Cfg.get_heroes()
	var max_size := Cfg.get_team_max_size()
	flow.open_level_select()
	flow._on_level_card_pressed(str((Cfg.get_levels()[0] as Dictionary).get("id", "")))
	for i: int in maxi(max_size + 1, heroes.size()):
		if i >= heroes.size():
			break
		flow._on_char_card_pressed(heroes[i], Control.new())
	assert_eq(flow.selected_hero_ids.size(), max_size, "组队人数应被 maxSize 截断")
	assert_eq(str((heroes[0] as Dictionary).get("id", "")), flow.selected_hero_ids[0], "第 1 位应为队长")
	var start: Button = flow.find_child("StartButton", true, false)
	assert_eq(start.text, "开始出战 (%d/%d)" % [max_size, max_size], "开始按钮文案应对齐原型")
