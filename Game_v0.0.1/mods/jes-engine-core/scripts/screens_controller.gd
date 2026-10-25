extends CanvasLayer

## 三合一导航面板：节点只负责展示与输入，规则由 GameScreens 处理。
signal hero_selected(hero_id: String)

var logic: GameScreens
var panel: Panel
var content: VBoxContainer
var tab_buttons: Array[Button] = []
var visible_panel := false


func _ready() -> void:
	var hero_table: Variant = Cfg.get_table("heroes") if Cfg != null else null
	var city_table: Variant = Cfg.get_table("city") if Cfg != null else null
	logic = GameScreens.new(hero_table, city_table)
	var starter_ids: Variant = Cfg.get_table("starterHeroIds") if Cfg != null else null
	if starter_ids is Array:
		logic.set_unlock_state({"hero_ids": starter_ids})
	panel = get_node_or_null("Panel")
	content = get_node_or_null("Panel/Margin/VBox/Content")
	if panel == null or content == null:
		return
	panel.visible = false
	_build_tabs()
	_show_menu()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and (event as InputEventKey).keycode == KEY_M and event.pressed and not event.echo:
		toggle_panel()
		get_viewport().set_input_as_handled()


func toggle_panel() -> void:
	visible_panel = not visible_panel
	if panel != null:
		panel.visible = visible_panel


func set_unlock_state(unlocks: Dictionary) -> void:
	if logic == null:
		return
	logic.set_unlock_state(unlocks)
	if logic.state == GameScreens.STATE_CHAR_SELECT:
		_show_characters()


func show_settlement(result: Dictionary) -> void:
	if logic == null:
		return
	logic.set_settlement(result)
	logic.transition_to(GameScreens.STATE_SETTLED)
	_show_settlement()
	visible_panel = true
	if panel != null:
		panel.visible = true


func _build_tabs() -> void:
	var tabs: HBoxContainer = get_node_or_null("Panel/Margin/VBox/Tabs")
	if tabs == null:
		return
	for old_button in tabs.get_children():
		old_button.queue_free()
	tab_buttons.clear()
	var definitions := [
		["主城", GameScreens.STATE_MENU],
		["选人", GameScreens.STATE_CHAR_SELECT],
		["结算", GameScreens.STATE_SETTLED],
	]
	for definition in definitions:
		var button := Button.new()
		button.text = definition[0]
		button.custom_minimum_size = Vector2(120.0, 36.0)
		button.pressed.connect(_on_tab_pressed.bind(definition[1]))
		tabs.add_child(button)
		tab_buttons.append(button)


func _on_tab_pressed(next_state: String) -> void:
	if logic == null:
		return
	if next_state == GameScreens.STATE_SETTLED:
		if not logic.can_transition(GameScreens.STATE_SETTLED):
			return
		logic.transition_to(next_state)
		_show_settlement()
	elif next_state == GameScreens.STATE_CHAR_SELECT:
		if logic.state == GameScreens.STATE_BOOT:
			logic.transition_to(GameScreens.STATE_MENU)
		if logic.can_transition(next_state):
			logic.transition_to(next_state)
			_show_characters()
	elif next_state == GameScreens.STATE_MENU:
		if logic.state == GameScreens.STATE_BOOT:
			logic.transition_to(next_state)
		elif logic.can_transition(next_state):
			logic.transition_to(next_state)
		_show_menu()


func _clear_content() -> void:
	if content == null:
		return
	for child in content.get_children():
		child.queue_free()


func _show_menu() -> void:
	_clear_content()
	if content == null or logic == null:
		return
	var title := Label.new()
	title.text = "主城入口"
	title.add_theme_font_size_override("font_size", 24)
	content.add_child(title)
	for entry in logic.build_menu_entries():
		var button := Button.new()
		button.text = "%s\n%s" % [str(entry.get("name", entry.get("id", "入口"))), str(entry.get("desc", ""))]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.custom_minimum_size = Vector2(0.0, 52.0)
		if str(entry.get("kind", "")) == "portal":
			button.pressed.connect(_open_character_select)
		content.add_child(button)


func _open_character_select() -> void:
	if logic.state == GameScreens.STATE_BOOT:
		logic.transition_to(GameScreens.STATE_MENU)
	if logic.transition_to(GameScreens.STATE_CHAR_SELECT):
		_show_characters()


func _show_characters() -> void:
	_clear_content()
	if content == null or logic == null:
		return
	var title := Label.new()
	title.text = "选择出征英雄"
	title.add_theme_font_size_override("font_size", 24)
	content.add_child(title)
	for card in logic.build_character_cards():
		var button := Button.new()
		var lock_text := "（已解锁）" if bool(card.get("unlocked", false)) else "（未解锁）"
		button.text = "%s %s\n%s" % [str(card.get("name", card.get("id", "英雄"))), lock_text, str(card.get("desc", ""))]
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.disabled = not bool(card.get("unlocked", false))
		button.custom_minimum_size = Vector2(0.0, 56.0)
		button.pressed.connect(_on_hero_pressed.bind(str(card.get("id", ""))))
		content.add_child(button)


func _on_hero_pressed(hero_id: String) -> void:
	hero_selected.emit(hero_id)
	logic.transition_to(GameScreens.STATE_PLAYING)


func _show_settlement() -> void:
	_clear_content()
	if content == null or logic == null:
		return
	var title := Label.new()
	title.text = "战斗结算"
	title.add_theme_font_size_override("font_size", 24)
	content.add_child(title)
	for line in logic.build_settlement_lines(logic.settle_data):
		var label := Label.new()
		label.text = line
		content.add_child(label)
