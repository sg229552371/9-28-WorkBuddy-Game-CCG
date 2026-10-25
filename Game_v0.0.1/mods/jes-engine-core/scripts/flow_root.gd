class_name FlowRoot
extends Control

## 场景流 UI 宿主 —— 对齐 html 原型屏幕：主菜单/操作说明/设置/图鉴/退出确认/选关/选人/结算。
## 规则真源：cfg/*.json（数值全读表）；Meta 账号存档走 MetaSave。
## 设计：本节点脱离 current_scene（见 _detach_from_scene_flow），
## change_scene 切主城/战斗不会销毁本 UI；战斗侧 EventBus.run_settled(winner="extract"/"dead")
## 到达即弹结算屏（game_event "run_settled" 作为兼容备用通道）。
## TODO(战斗侧)：event_bus.gd 归另一代理所有、禁止本侧改动；当前其已定义
##   signal run_settled(result)（winner=extract/dead），本类直接连接该专用信号。

signal level_picked(level_id: String)
signal team_confirmed(hero_ids: Array)

## 屏幕流转图（键=当前屏，值=允许前往的屏集合）；与 html showScreen 合法跳转对齐
const SCREEN_GRAPH := {
	"screen-main": ["screen-help", "screen-settings", "screen-codex", "screen-goodbye", "city"],
	"screen-help": ["screen-main"],
	"screen-settings": ["screen-main"],
	"screen-codex": ["screen-main"],
	"screen-goodbye": ["screen-main", "quit"],
	"screen-level": ["screen-character", "city"],
	"screen-character": ["screen-level", "battle"],
	"screen-settle": ["city", "screen-main"],
}

const COL_BG := Color("131c2c")
const COL_PANEL := Color("1d2027")
const COL_CARD := Color("252a34")
const COL_GOLD := Color("e8b33c")
const COL_TEXT := Color("e2e6ee")
const COL_SUB := Color("8a93a5")
const COL_LOCKED := Color("5a6572")

const QUALITY_NAMES: Array[String] = ["低", "中", "高"]
const FLOW_SCENE_CITY := "res://mods/jes-engine-core/scenes/city.tscn"
const FLOW_SCENE_BATTLE := "res://mods/jes-engine-core/scenes/battle.tscn"

var current_screen: String = "screen-main"
var selected_level_id: String = ""
var selected_hero_ids: Array[String] = []
var settle_payload: Dictionary = {}

var _screens: Dictionary = {}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.name = "Bg"
	bg.color = COL_BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(bg)
	_build_all_screens()
	EventBus.game_event.connect(_on_game_event)
	if EventBus.has_signal("run_settled"):
		EventBus.run_settled.connect(_on_run_settled_payload)
	GameState.run_settled.connect(_on_run_settled_payload)
	show_screen("screen-main")
	call_deferred("_detach_from_scene_flow")


## 把自己从 current_scene 摘出来挂到 root：后续 change_scene 不会销毁本 UI
## 并套一层高层 CanvasLayer：主城/战斗场景自带 CanvasLayer 时，叠加层不被压在下面
func _detach_from_scene_flow() -> void:
	var tree := get_tree()
	if tree == null or tree.current_scene != self:
		return
	var placeholder := Node.new()
	placeholder.name = "FlowScenePlaceholder"
	tree.root.add_child(placeholder)
	tree.current_scene = placeholder
	var layer := CanvasLayer.new()
	layer.name = "FlowLayer"
	layer.layer = 100
	tree.root.add_child(layer)
	tree.root.remove_child(self)
	layer.add_child(self)


## ---------- EventBus 通道（不修改 event_bus.gd）----------

func _on_game_event(event_name: String, payload: Dictionary) -> void:
	if event_name == "cityPortalEnter":
		open_level_select()
	elif event_name == "run_settled":
		_on_run_settled_payload(payload)


func _on_run_settled_payload(payload: Dictionary) -> void:
	settle_payload = payload.duplicate(true)
	_normalize_settle_payload()
	_apply_settle_to_meta()
	current_screen = "screen-settle"
	_show_settle()


## 兼容战斗侧 payload 字段（winner=extract/dead、shards、time、level_id）
func _normalize_settle_payload() -> void:
	var winner := str(settle_payload.get("winner", settle_payload.get("reason", "")))
	if settle_payload.has("winner") or settle_payload.has("reason"):
		settle_payload["won"] = winner == "extract"
	var time_val: Variant = settle_payload.get("time", null)
	if time_val != null and not settle_payload.has("elapsed"):
		settle_payload["elapsed"] = float(time_val)
	if not settle_payload.has("crystals"):
		settle_payload["crystals"] = int(settle_payload.get("shards", 0))
	var payload_level := str(settle_payload.get("level_id", ""))
	if not payload_level.is_empty():
		selected_level_id = payload_level


## ---------- 流转合法性 ----------

func can_navigate(from_screen: String, to_screen: String) -> bool:
	var nexts: Array = SCREEN_GRAPH.get(from_screen, [])
	return (nexts as Array).has(to_screen)


func show_screen(name_key: String, force: bool = false) -> void:
	if not _screens.has(name_key):
		push_warning("[FlowRoot] 未知屏幕: " + name_key)
		return
	if not force and not can_navigate(current_screen, name_key) and name_key != current_screen:
		push_warning("[FlowRoot] 非法屏幕流转: %s -> %s" % [current_screen, name_key])
		return
	current_screen = name_key
	for key: String in _screens.keys():
		var node: Control = _screens[key]
		node.visible = key == name_key
	visible = name_key != "hidden"


## 进入主城：切场景并整体隐藏本 UI（主城由另一代理的场景负责，portal 事件回来再弹选关）
func go_city() -> void:
	visible = false
	current_screen = "screen-main"
	get_tree().change_scene_to_file(FLOW_SCENE_CITY)


func open_level_select() -> void:
	_rebuild_level_grid()
	selected_hero_ids.clear()
	visible = true
	show_screen("screen-level", true)


## ---------- 选关锁关规则（levels.json 顺序解锁）----------

static func is_level_index_unlocked(index_zero_based: int, unlocked_levels: int) -> bool:
	return index_zero_based < maxi(1, unlocked_levels)


## ---------- 结算入账（Meta 只在撤离成功解锁下一关与星级；死亡仅 30% 结晶）----------

func _apply_settle_to_meta() -> void:
	var won: bool = bool(settle_payload.get("won", false)) or str(settle_payload.get("reason", "")) == "extract"
	var kills := int(settle_payload.get("kills", 0))
	var crystal_gain := 0
	if won:
		crystal_gain = int(settle_payload.get("crystals", kills))
		var level_index := _level_index_of(selected_level_id)
		if level_index >= 0:
			var stars := int(settle_payload.get("stars", 1))
			GameState.meta.set_level_stars(selected_level_id, stars)
			GameState.meta.unlock_level_to(level_index + 2)
	else:
		var death_ratio := 0.3
		var out_level: Variant = Cfg.get_table("outLevel")
		if out_level is Dictionary:
			death_ratio = float((out_level as Dictionary).get("deathRatio", 0.3))
		crystal_gain = int(float(kills) * death_ratio)
	GameState.meta.add_crystals(crystal_gain)
	settle_payload["crystalGain"] = crystal_gain
	settle_payload["won"] = won
	GameState.meta.commit()


func _level_index_of(level_id: String) -> int:
	var levels: Variant = Cfg.get_table("levels")
	if not levels is Array:
		return -1
	for i: int in (levels as Array).size():
		var lv: Dictionary = (levels as Array)[i]
		if str(lv.get("id", "")) == level_id:
			return i
	return -1


## ---------- 屏幕构建 ----------

func _build_all_screens() -> void:
	_screens["screen-main"] = _build_main()
	_screens["screen-help"] = _build_help()
	_screens["screen-settings"] = _build_settings()
	_screens["screen-codex"] = _build_codex()
	_screens["screen-goodbye"] = _build_goodbye()
	_screens["screen-level"] = _build_level_select()
	_screens["screen-character"] = _build_char_select()
	_screens["screen-settle"] = _build_settle()
	for key: String in _screens.keys():
		var screen: Control = _screens[key]
		screen.visible = false
		add_child(screen)


func _make_panel(title_text: String) -> Dictionary:
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	var style := StyleBoxFlat.new()
	style.bg_color = COL_PANEL
	style.border_color = COL_CARD
	style.set_border_width_all(2)
	style.set_corner_radius_all(10)
	style.content_margin_left = 24.0
	style.content_margin_right = 24.0
	style.content_margin_top = 16.0
	style.content_margin_bottom = 16.0
	panel.add_theme_stylebox_override("panel", style)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.add_child(scroll)
	var margin := MarginContainer.new()
	margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margin.add_theme_constant_override("margin_left", 0)
	margin.add_theme_constant_override("margin_right", 0)
	scroll.add_child(margin)
	var vbox := VBoxContainer.new()
	vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.add_theme_constant_override("separation", 10)
	margin.add_child(vbox)
	var title := Label.new()
	title.text = title_text
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", COL_GOLD)
	vbox.add_child(title)
	return {"panel": panel, "vbox": vbox}


func _make_button(text_key: String, gold: bool) -> Button:
	var btn := Button.new()
	btn.text = text_key
	btn.custom_minimum_size = Vector2(320.0, 52.0)
	btn.add_theme_font_size_override("font_size", 20)
	btn.add_theme_color_override("font_color", COL_GOLD if gold else COL_TEXT)
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	if gold:
		style.border_color = COL_GOLD
		style.set_border_width_all(2)
	btn.add_theme_stylebox_override("normal", style)
	return btn


func _make_card_label(lines: Array[String], locked: bool, small: bool) -> PanelContainer:
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	style.content_margin_left = 10.0
	style.content_margin_right = 10.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	card.add_theme_stylebox_override("panel", style)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	card.add_child(vbox)
	for i: int in lines.size():
		var label := Label.new()
		label.text = lines[i]
		label.add_theme_font_size_override("font_size", 22 if (i == 0 and not small) else 16)
		if i == 0:
			label.add_theme_color_override("font_color", COL_LOCKED if locked else COL_TEXT)
		else:
			label.add_theme_color_override("font_color", COL_SUB)
		vbox.add_child(label)
	return card


func _make_color_swatch(color_hex: String, sw_size: Vector2) -> ColorRect:
	var swatch := ColorRect.new()
	swatch.color = Color(color_hex)
	swatch.custom_minimum_size = sw_size
	swatch.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	return swatch


## 主菜单（html screen-main）
func _build_main() -> Control:
	var holder := _make_panel("弹幕射击 × 背包肉鸽")
	var vbox: VBoxContainer = holder["vbox"]
	var user_line := Label.new()
	user_line.name = "UserLine"
	user_line.add_theme_color_override("font_color", COL_SUB)
	user_line.text = "%s · ◆ %d · 已解锁 %d 关" % [
		GameState.meta.profile_name(), GameState.meta.crystals(), GameState.meta.unlocked_levels()]
	vbox.add_child(user_line)
	var start := _make_button("开始游戏", true)
	start.pressed.connect(go_city)
	vbox.add_child(start)
	var help := _make_button("操作说明", false)
	help.pressed.connect(func() -> void: show_screen("screen-help"))
	vbox.add_child(help)
	var settings_btn := _make_button("设置", false)
	settings_btn.pressed.connect(func() -> void:
		_sync_settings_ui()
		show_screen("screen-settings"))
	vbox.add_child(settings_btn)
	var codex := _make_button("图鉴", false)
	codex.pressed.connect(func() -> void:
		_rebuild_codex_grids()
		show_screen("screen-codex"))
	vbox.add_child(codex)
	var quit := _make_button("退出游戏", false)
	quit.pressed.connect(func() -> void: show_screen("screen-goodbye"))
	vbox.add_child(quit)
	return holder["panel"]


## 操作说明（html screen-help）
func _build_help() -> Control:
	var holder := _make_panel("操作说明")
	var vbox: VBoxContainer = holder["vbox"]
	for line: String in [
		"移动：WASD / 方向键（触屏为左下摇杆）",
		"技能：自动释放（Space 触发爆发）",
		"背包：B 开关背包，拖拽整理格子",
		"撤离：任一队员站进雕像圈自动读条，读满即撤离成功",
		"撤离成功解锁下一关；死亡仅保留 30% 结晶收益",
	]:
		var label := Label.new()
		label.text = line
		label.add_theme_color_override("font_color", COL_TEXT)
		vbox.add_child(label)
	var back := _make_button("返回首页", false)
	back.pressed.connect(func() -> void: show_screen("screen-main"))
	vbox.add_child(back)
	return holder["panel"]


## 设置（html screen-settings）：音量滑杆 + 静音 + 画质三档；存档进 Meta.settings
func _build_settings() -> Control:
	var holder := _make_panel("设置")
	var vbox: VBoxContainer = holder["vbox"]
	var vol_row := HBoxContainer.new()
	vol_row.add_theme_constant_override("separation", 12)
	var vol_label := Label.new()
	vol_label.text = "音效音量"
	vol_label.add_theme_color_override("font_color", COL_TEXT)
	vol_label.custom_minimum_size = Vector2(120.0, 0.0)
	vol_row.add_child(vol_label)
	var slider := HSlider.new()
	slider.name = "SfxSlider"
	slider.min_value = 0.0
	slider.max_value = 1.0
	slider.step = 0.1
	slider.custom_minimum_size = Vector2(300.0, 24.0)
	slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vol_row.add_child(slider)
	var vol_value := Label.new()
	vol_value.name = "SfxValue"
	vol_value.add_theme_color_override("font_color", COL_SUB)
	vol_row.add_child(vol_value)
	vbox.add_child(vol_row)
	var mute := _make_button("静音", false)
	mute.pressed.connect(func() -> void:
		var current: Variant = GameState.meta.setting("sfxVolume", 0.8)
		var new_value := 0.8 if float(current) <= 0.0 else 0.0
		GameState.meta.set_setting("sfxVolume", new_value)
		GameState.meta.commit()
		_apply_audio_volume(new_value)
		_sync_settings_ui())
	vbox.add_child(mute)
	var quality_label := Label.new()
	quality_label.text = "画质"
	quality_label.add_theme_color_override("font_color", COL_TEXT)
	vbox.add_child(quality_label)
	var quality_row := HBoxContainer.new()
	quality_row.name = "QualityRow"
	quality_row.add_theme_constant_override("separation", 8)
	for i: int in QUALITY_NAMES.size():
		var qbtn := _make_button(QUALITY_NAMES[i], false)
		qbtn.custom_minimum_size = Vector2(96.0, 44.0)
		var level := i
		qbtn.pressed.connect(func() -> void:
			GameState.meta.set_setting("quality", level)
			GameState.meta.commit()
			_sync_settings_ui())
		quality_row.add_child(qbtn)
	vbox.add_child(quality_row)
	var back := _make_button("返回首页", false)
	back.pressed.connect(func() -> void: show_screen("screen-main"))
	vbox.add_child(back)
	return holder["panel"]


## 音频应用接口：Godot 侧尚无 SFX 节点，先落存档；接线后在此驱动 AudioServer 主音量
func _apply_audio_volume(volume: float) -> void:
	# TODO(SFX 侧)：接入 AudioServer.set_bus_volume_db(0, linear_to_db(volume)) 与静音总线
	push_warning("[FlowRoot] 音频应用接口待 SFX 接线，当前仅存档 volume=%.2f" % volume)


func _sync_settings_ui() -> void:
	var screen: Control = _screens.get("screen-settings")
	if screen == null:
		return
	var slider: HSlider = screen.find_child("SfxSlider", true, false)
	var value_label: Label = screen.find_child("SfxValue", true, false)
	var volume := float(GameState.meta.setting("sfxVolume", 0.8))
	if slider != null:
		slider.value = volume
		if not slider.value_changed.is_connected(_on_sfx_slider_changed):
			slider.value_changed.connect(_on_sfx_slider_changed)
	if value_label != null:
		value_label.text = "%.1f%s" % [volume, "（静音）" if volume <= 0.0 else ""]
	var quality_row: HBoxContainer = screen.find_child("QualityRow", true, false)
	if quality_row != null:
		var quality := clampi(int(GameState.meta.setting("quality", 2)), 0, 2)
		for i: int in quality_row.get_child_count():
			var qbtn: Button = quality_row.get_child(i)
			qbtn.add_theme_color_override("font_color", COL_GOLD if i == quality else COL_TEXT)


func _on_sfx_slider_changed(value: float) -> void:
	GameState.meta.set_setting("sfxVolume", value)
	GameState.meta.commit()
	_apply_audio_volume(value)
	_sync_settings_ui()


## 图鉴（html screen-codex）：英雄 + 怪物网格；缺图用色块占位 + 名字
func _build_codex() -> Control:
	var holder := _make_panel("图鉴")
	var vbox: VBoxContainer = holder["vbox"]
	var count_label := Label.new()
	count_label.name = "CodexCount"
	count_label.add_theme_color_override("font_color", COL_SUB)
	vbox.add_child(count_label)
	var hero_title := Label.new()
	hero_title.text = "英雄图鉴"
	hero_title.add_theme_color_override("font_color", COL_TEXT)
	vbox.add_child(hero_title)
	var hero_grid := GridContainer.new()
	hero_grid.name = "HeroGrid"
	hero_grid.columns = 4
	hero_grid.add_theme_constant_override("h_separation", 8)
	hero_grid.add_theme_constant_override("v_separation", 8)
	vbox.add_child(hero_grid)
	var mon_title := Label.new()
	mon_title.text = "怪物图鉴"
	mon_title.add_theme_color_override("font_color", COL_TEXT)
	vbox.add_child(mon_title)
	var mon_scroll := ScrollContainer.new()
	mon_scroll.custom_minimum_size = Vector2(0.0, 320.0)
	mon_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vbox.add_child(mon_scroll)
	var mon_grid := GridContainer.new()
	mon_grid.name = "MonsterGrid"
	mon_grid.columns = 5
	mon_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mon_grid.add_theme_constant_override("h_separation", 8)
	mon_grid.add_theme_constant_override("v_separation", 8)
	mon_scroll.add_child(mon_grid)
	var back := _make_button("返回首页", false)
	back.pressed.connect(func() -> void: show_screen("screen-main"))
	vbox.add_child(back)
	return holder["panel"]


func _rebuild_codex_grids() -> void:
	var screen: Control = _screens.get("screen-codex")
	if screen == null:
		return
	var hero_grid: GridContainer = screen.find_child("HeroGrid", true, false)
	var mon_grid: GridContainer = screen.find_child("MonsterGrid", true, false)
	var count_label: Label = screen.find_child("CodexCount", true, false)
	for child: Node in hero_grid.get_children():
		child.queue_free()
	for child: Node in mon_grid.get_children():
		child.queue_free()
	var heroes: Variant = Cfg.get_table("heroes")
	var hero_total := 0
	var hero_seen := 0
	if heroes is Array:
		for hero: Dictionary in (heroes as Array):
			if not hero is Dictionary:
				continue
			hero_total += 1
			var hero_id := str(hero.get("id", ""))
			var active: bool = GameState.meta.is_hero_codex_active(hero_id)
			if active:
				hero_seen += 1
			hero_grid.add_child(_codex_card(str(hero.get("name", hero_id)), str(hero.get("desc", "")), active, "#2a3a5a"))
	var monsters: Variant = Cfg.get_table("monsters")
	var mon_total := 0
	var mon_seen := 0
	if monsters is Dictionary:
		for monster_id: String in (monsters as Dictionary).keys():
			var mon: Dictionary = (monsters as Dictionary)[monster_id]
			if not mon is Dictionary:
				continue
			mon_total += 1
			var active_mon: bool = GameState.meta.is_monster_codex_active(monster_id)
			if active_mon:
				mon_seen += 1
			mon_grid.add_child(_codex_card(str(mon.get("name", monster_id)),
				"HP %d · 攻 %d" % [int(mon.get("hp", 0)), int(mon.get("atk", 0))], active_mon, "#3a2a4a"))
	count_label.text = "英雄 %d/%d · 怪物 %d/%d" % [hero_seen, hero_total, mon_seen, mon_total]


func _codex_card(display_name: String, desc: String, active: bool, swatch_hex: String) -> Control:
	var lines: Array[String] = []
	lines.append("???" if not active else display_name)
	lines.append("未激活" if not active else desc)
	var card := _make_card_label(lines, not active, true)
	var swatch := _make_color_swatch(swatch_hex if active else "10131a", Vector2(64.0, 64.0))
	(card.get_child(0) as VBoxContainer).add_child(swatch)
	card.custom_minimum_size = Vector2(150.0, 0.0)
	return card


## 退出确认（html screen-goodbye）
func _build_goodbye() -> Control:
	var holder := _make_panel("退出游戏")
	var vbox: VBoxContainer = holder["vbox"]
	var tip := Label.new()
	tip.text = "确定要退出游戏吗？"
	tip.add_theme_color_override("font_color", COL_TEXT)
	vbox.add_child(tip)
	var confirm := _make_button("确认退出", true)
	confirm.pressed.connect(func() -> void: get_tree().quit())
	vbox.add_child(confirm)
	var cancel := _make_button("返回首页", false)
	cancel.pressed.connect(func() -> void: show_screen("screen-main"))
	vbox.add_child(cancel)
	return holder["panel"]


## 选关（html screen-level）：99 关三列卡片；锁定灰显；金色高亮可打
func _build_level_select() -> Control:
	var holder := _make_panel("选择关卡")
	var vbox: VBoxContainer = holder["vbox"]
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0.0, 620.0)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vbox.add_child(scroll)
	var grid := GridContainer.new()
	grid.name = "LevelGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)
	var back := _make_button("返回主城", false)
	back.pressed.connect(go_city)
	vbox.add_child(back)
	return holder["panel"]


func _rebuild_level_grid() -> void:
	var screen: Control = _screens.get("screen-level")
	if screen == null:
		return
	var grid: GridContainer = screen.find_child("LevelGrid", true, false)
	for child: Node in grid.get_children():
		child.queue_free()
	var levels: Variant = Cfg.get_table("levels")
	if not levels is Array:
		push_warning("[FlowRoot] levels.json 缺失或格式错误")
		return
	for i: int in (levels as Array).size():
		var lv: Dictionary = (levels as Array)[i]
		if not lv is Dictionary:
			continue
		grid.add_child(_level_card(lv, i))


func _level_card(lv: Dictionary, index: int) -> Control:
	var level_id := str(lv.get("id", ""))
	var unlocked := is_level_index_unlocked(index, GameState.meta.unlocked_levels())
	var stars := GameState.meta.level_stars(level_id)
	var star_text := ""
	for s: int in 3:
		star_text += "★" if s < stars else "☆"
	var lines: Array[String] = []
	lines.append("第 %d 关 · %s" % [index + 1, str(lv.get("name", ""))])
	lines.append("目标进度 %d · 时限 %d 秒" % [int(lv.get("progressGoal", 0)), int(lv.get("timeLimit", 0))])
	lines.append(star_text)
	var card := _make_card_label(lines, not unlocked, false)
	card.custom_minimum_size = Vector2(220.0, 96.0)
	card.tooltip_text = str(lv.get("name", ""))
	if not unlocked:
		return card
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.border_color = COL_GOLD
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 10.0
	style.content_margin_right = 10.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	card.add_theme_stylebox_override("panel", style)
	var click := Button.new()
	click.flat = true
	click.set_anchors_preset(Control.PRESET_FULL_RECT)
	click.mouse_filter = Control.MOUSE_FILTER_STOP
	click.pressed.connect(_on_level_card_pressed.bind(level_id))
	card.add_child(click)
	return card


func _on_level_card_pressed(level_id: String) -> void:
	selected_level_id = level_id
	GameState.level_id = level_id
	level_picked.emit(level_id)
	_rebuild_char_grid()
	show_screen("screen-character")


## 选人（html screen-character）：12 英雄网格 + 详情面板 + 1~3 人组队
func _build_char_select() -> Control:
	var holder := _make_panel("选择出征英雄")
	var vbox: VBoxContainer = holder["vbox"]
	var grid := GridContainer.new()
	grid.name = "CharGrid"
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	vbox.add_child(grid)
	var detail := PanelContainer.new()
	detail.name = "CharDetail"
	detail.custom_minimum_size = Vector2(0.0, 170.0)
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	style.content_margin_left = 12.0
	style.content_margin_right = 12.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	detail.add_theme_stylebox_override("panel", style)
	vbox.add_child(detail)
	var start_row := HBoxContainer.new()
	start_row.add_theme_constant_override("separation", 12)
	var team_label := Label.new()
	team_label.name = "TeamLabel"
	team_label.add_theme_color_override("font_color", COL_SUB)
	team_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	start_row.add_child(team_label)
	var start := _make_button("开始出战 (0/3)", true)
	start.name = "StartButton"
	start.pressed.connect(_on_start_run_pressed)
	start_row.add_child(start)
	vbox.add_child(start_row)
	var back := _make_button("返回选关", false)
	back.pressed.connect(func() -> void: show_screen("screen-level"))
	vbox.add_child(back)
	return holder["panel"]


func _rebuild_char_grid() -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var grid: GridContainer = screen.find_child("CharGrid", true, false)
	for child: Node in grid.get_children():
		child.queue_free()
	selected_hero_ids.clear()
	var heroes: Variant = Cfg.get_table("heroes")
	if not heroes is Array:
		push_warning("[FlowRoot] heroes.json 缺失或格式错误")
		return
	for hero: Dictionary in (heroes as Array):
		if not hero is Dictionary:
			continue
		grid.add_child(_char_card(hero))
	_sync_team_ui()


func _char_card(hero: Dictionary) -> Control:
	var hero_id := str(hero.get("id", ""))
	var unlocked := GameState.meta.is_hero_unlocked(hero_id)
	var out_level := GameState.meta.hero_out_level(hero_id)
	var lines: Array[String] = []
	lines.append(str(hero.get("name", hero_id)))
	lines.append("★%d · 局外 LV%d" % [int(hero.get("difficulty", 1)), out_level])
	var card := _make_card_label(lines, not unlocked, true)
	card.custom_minimum_size = Vector2(150.0, 110.0)
	var vbox: VBoxContainer = card.get_child(0)
	vbox.add_child(_make_color_swatch("2a3a5a" if unlocked else "10131a", Vector2(64.0, 40.0)))
	if unlocked:
		var click := Button.new()
		click.flat = true
		click.set_anchors_preset(Control.PRESET_FULL_RECT)
		click.mouse_filter = Control.MOUSE_FILTER_STOP
		click.pressed.connect(_on_char_card_pressed.bind(hero, card))
		card.add_child(click)
	return card


func _on_char_card_pressed(hero: Dictionary, card: Control) -> void:
	var hero_id := str(hero.get("id", ""))
	if selected_hero_ids.has(hero_id):
		selected_hero_ids.erase(hero_id)
		var style := StyleBoxFlat.new()
		style.bg_color = COL_CARD
		style.set_corner_radius_all(8)
		card.add_theme_stylebox_override("panel", style)
	else:
		var max_size := Cfg.get_team_max_size()
		if selected_hero_ids.size() >= max_size:
			push_warning("[FlowRoot] 组队人数已达上限 %d" % max_size)
			return
		selected_hero_ids.append(hero_id)
		var style := StyleBoxFlat.new()
		style.bg_color = COL_CARD
		style.border_color = COL_GOLD
		style.set_border_width_all(2)
		style.set_corner_radius_all(8)
		card.add_theme_stylebox_override("panel", style)
	_show_char_detail(hero)
	_sync_team_ui()


func _show_char_detail(hero: Dictionary) -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var detail: PanelContainer = screen.find_child("CharDetail", true, false)
	for child: Node in detail.get_children():
		child.queue_free()
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	detail.add_child(vbox)
	var weapon_name := Cfg.get_weapon_name(str(hero.get("weapon", "")))
	var out_level_cfg: Variant = Cfg.get_table("outLevel")
	var crystal_kill := 1
	var crystal_boss := 60
	if out_level_cfg is Dictionary:
		crystal_kill = int((out_level_cfg as Dictionary).get("crystalKill", 1))
		crystal_boss = int((out_level_cfg as Dictionary).get("crystalBoss", 60))
	var hero_id := str(hero.get("id", ""))
	var lines: Array[String] = [
		"%s · 局外 LV%d" % [str(hero.get("name", hero_id)), GameState.meta.hero_out_level(hero_id)],
		"HP %d · 攻击 %d · 移速 %d" % [int(hero.get("hp", 0)), int(hero.get("atk", 0)), int(hero.get("spd", 0))],
		"武器：%s · 优势标签：%s" % [weapon_name, str(hero.get("playtag", ""))],
		str(hero.get("desc", "")),
		"进化结晶：击败小怪 ◆%d / 首领 ◆%d，撤离后用于局外升级" % [crystal_kill, crystal_boss],
	]
	for line: String in lines:
		var label := Label.new()
		label.text = line
		label.add_theme_font_size_override("font_size", 18)
		label.add_theme_color_override("font_color", COL_TEXT if line == lines[0] else COL_SUB)
		vbox.add_child(label)


func _sync_team_ui() -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var max_size := Cfg.get_team_max_size()
	var team_label: Label = screen.find_child("TeamLabel", true, false)
	if team_label != null:
		team_label.text = "组队 %d/%d（第 1 位为队长，其余 AI 队友）" % [selected_hero_ids.size(), max_size]
	var start: Button = screen.find_child("StartButton", true, false)
	if start != null:
		start.text = "开始出战 (%d/%d)" % [selected_hero_ids.size(), max_size]
		start.disabled = selected_hero_ids.is_empty()


func _on_start_run_pressed() -> void:
	if selected_hero_ids.is_empty():
		push_warning("[FlowRoot] 尚未选择出征英雄")
		return
	GameState.hero_id = selected_hero_ids[0]
	GameState.team_ids = selected_hero_ids.duplicate()
	team_confirmed.emit(selected_hero_ids.duplicate())
	visible = false
	current_screen = "screen-settle"
	get_tree().change_scene_to_file(FLOW_SCENE_BATTLE)


## 结算（html screen-settle / screen-death）：胜利=星级+结晶收益；死亡=30% 结晶
func _build_settle() -> Control:
	var holder := _make_panel("战斗结算")
	var vbox: VBoxContainer = holder["vbox"]
	var outcome := Label.new()
	outcome.name = "SettleOutcome"
	outcome.add_theme_font_size_override("font_size", 32)
	outcome.add_theme_color_override("font_color", COL_GOLD)
	vbox.add_child(outcome)
	var stats := Label.new()
	stats.name = "SettleStats"
	stats.add_theme_color_override("font_color", COL_TEXT)
	stats.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(stats)
	var gain := Label.new()
	gain.name = "SettleGain"
	gain.add_theme_color_override("font_color", COL_GOLD)
	vbox.add_child(gain)
	var loot_title := Label.new()
	loot_title.text = "战利品"
	loot_title.add_theme_color_override("font_color", COL_TEXT)
	vbox.add_child(loot_title)
	var loot := Label.new()
	loot.name = "SettleLoot"
	loot.add_theme_color_override("font_color", COL_SUB)
	loot.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	vbox.add_child(loot)
	var city_btn := _make_button("返回主城", true)
	city_btn.pressed.connect(func() -> void:
		visible = false
		current_screen = "screen-main"
		get_tree().change_scene_to_file(FLOW_SCENE_CITY))
	vbox.add_child(city_btn)
	var menu_btn := _make_button("回主菜单", false)
	menu_btn.pressed.connect(func() -> void:
		visible = true
		show_screen("screen-main"))
	vbox.add_child(menu_btn)
	return holder["panel"]


func _show_settle() -> void:
	var screen: Control = _screens.get("screen-settle")
	if screen == null:
		return
	var won: bool = bool(settle_payload.get("won", false))
	var outcome: Label = screen.find_child("SettleOutcome", true, false)
	var stats: Label = screen.find_child("SettleStats", true, false)
	var gain: Label = screen.find_child("SettleGain", true, false)
	var loot: Label = screen.find_child("SettleLoot", true, false)
	if outcome != null:
		outcome.text = "撤离成功！" if won else "不幸阵亡…"
	var elapsed := float(settle_payload.get("elapsed", 0.0))
	var minutes := floori(elapsed / 60.0)
	var seconds := int(elapsed) % 60
	if stats != null:
		stats.text = "击杀 %d · 用时 %02d:%02d · 拾取 %d 件" % [
			int(settle_payload.get("kills", 0)), minutes, seconds, int(settle_payload.get("pickups", 0))]
	if gain != null:
		if won:
			var stars := clampi(int(settle_payload.get("stars", 1)), 0, 3)
			var star_text := ""
			for s: int in 3:
				star_text += "★" if s < stars else "☆"
			gain.text = "本关评级 %s · 结晶收益 ◆%d" % [star_text, int(settle_payload.get("crystalGain", 0))]
		else:
			gain.text = "结晶收益 ◆%d（死亡仅保留 30%%）" % int(settle_payload.get("crystalGain", 0))
	if loot != null:
		var loot_list: Variant = settle_payload.get("loot", [])
		if loot_list is Array and not (loot_list as Array).is_empty():
			var names: Array[String] = []
			for item: Variant in (loot_list as Array):
				names.append(str(item))
			loot.text = " · ".join(names)
		else:
			loot.text = "（战利品清单占位：待战斗侧接入）"
	visible = true
	show_screen("screen-settle")
