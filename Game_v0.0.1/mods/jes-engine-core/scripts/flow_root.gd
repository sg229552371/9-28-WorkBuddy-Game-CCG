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
const COL_GOOD_BG := Color("2e4a36")
const COL_GOOD_TX := Color("9fe0af")
const COL_BAD_BG := Color("4a2e2e")
const COL_BAD_TX := Color("e0a3a3")
const COL_AVATAR_BG := Color("2a3a5a")

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
	# 防重入：已在选关/选人流程中时，重复的传送门事件不再弹回选关
	if current_screen == "screen-level" or current_screen == "screen-character":
		return
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


## 主菜单（html screen-main）：标题+副标题；底部 profile 行与版本行
func _build_main() -> Control:
	var holder := _make_panel("弹幕射击 × 背包肉鸽")
	var vbox: VBoxContainer = holder["vbox"]
	var subtitle := Label.new()
	subtitle.text = "组队下矿 · 撤离拿结晶 · 局外养成"
	subtitle.add_theme_color_override("font_color", COL_SUB)
	vbox.add_child(subtitle)
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
	# 底部 profile 行：名字读 MetaSave.profile_name；称号无字段，静态占位
	var traveler := GameState.meta.profile_name()
	if traveler.is_empty():
		traveler = "无名旅者"
	var profile_line := Label.new()
	profile_line.name = "ProfileLine"
	profile_line.text = "%s ·「初出茅庐」 · ✦%d" % [traveler, GameState.meta.crystals()]
	profile_line.add_theme_color_override("font_color", COL_SUB)
	vbox.add_child(profile_line)
	# 最底版本行（静态文案）
	var version_line := Label.new()
	version_line.text = "v0.6 · 主城 → 串行关卡 → 边界"
	version_line.add_theme_font_size_override("font_size", 13)
	version_line.add_theme_color_override("font_color", COL_LOCKED)
	vbox.add_child(version_line)
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


## 选关（html screen-level）：居中面板 + 副标题 + 三列可滚动关卡卡片
func _build_level_select() -> Control:
	var holder := _make_panel("选择出发关卡")
	var vbox: VBoxContainer = holder["vbox"]
	var sub := Label.new()
	sub.text = "按顺序解锁 · 目标进度 → 时限 → 星级 → 奖励"
	sub.add_theme_color_override("font_color", COL_SUB)
	vbox.add_child(sub)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0.0, 560.0)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(scroll)
	var grid := GridContainer.new()
	grid.name = "LevelGrid"
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	scroll.add_child(grid)
	var back_row := HBoxContainer.new()
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	back_row.add_child(spacer)
	var back := _make_button("返回主城", false)
	back.custom_minimum_size = Vector2(180.0, 48.0)
	back.pressed.connect(go_city)
	back_row.add_child(back)
	vbox.add_child(back_row)
	# 居中面板式：外包 CenterContainer，面板限定 560~720 宽
	var panel: PanelContainer = holder["panel"]
	panel.custom_minimum_size = Vector2(680.0, 760.0)
	var center := CenterContainer.new()
	center.name = "LevelCenter"
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	center.add_child(panel)
	return center


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
	# 修复标题重复：levels.name 已带「第 X 关 · 」前缀时不再拼接序号
	var level_name := str(lv.get("name", ""))
	if not level_name.begins_with("第"):
		level_name = "第 %d 关 · %s" % [index + 1, level_name]
	# TODO: levels.json 暂无奖励字段（reward/coin 均缺失），先显示 0，表补充后自动接入
	var reward := int(lv.get("reward", lv.get("coin", 0)))
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	style.content_margin_left = 10.0
	style.content_margin_right = 10.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	if unlocked:
		style.border_color = COL_GOLD
		style.set_border_width_all(2)
	card.add_theme_stylebox_override("panel", style)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	card.add_child(vbox)
	var name_label := Label.new()
	name_label.text = level_name
	name_label.add_theme_font_size_override("font_size", 20)
	name_label.add_theme_color_override("font_color", COL_LOCKED if not unlocked else COL_GOLD)
	vbox.add_child(name_label)
	var stat_label := Label.new()
	stat_label.text = "目标进度 %d · 时限 %ds" % [int(lv.get("progressGoal", 0)), int(lv.get("timeLimit", 0))]
	stat_label.add_theme_font_size_override("font_size", 15)
	stat_label.add_theme_color_override("font_color", COL_SUB)
	vbox.add_child(stat_label)
	var reward_label := Label.new()
	reward_label.text = "✦奖励 %d" % reward
	reward_label.add_theme_font_size_override("font_size", 14)
	reward_label.add_theme_color_override("font_color", COL_LOCKED if not unlocked else COL_GOLD)
	vbox.add_child(reward_label)
	card.custom_minimum_size = Vector2(200.0, 96.0)
	card.tooltip_text = level_name
	if not unlocked:
		return card
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


## 选人（html screen-character）：顶部结晶行 + 12 英雄网格 + 详情面板 + 底部按钮行
func _build_char_select() -> Control:
	var holder := _make_panel("角色选择")
	var vbox: VBoxContainer = holder["vbox"]
	var crystal_label := Label.new()
	crystal_label.name = "CrystalLabel"
	crystal_label.text = "✦结晶 0"
	crystal_label.add_theme_color_override("font_color", COL_GOLD)
	crystal_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	crystal_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vbox.add_child(crystal_label)
	var grid := GridContainer.new()
	grid.name = "CharGrid"
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	vbox.add_child(grid)
	var detail := PanelContainer.new()
	detail.name = "CharDetail"
	detail.custom_minimum_size = Vector2(0.0, 190.0)
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	style.content_margin_left = 12.0
	style.content_margin_right = 12.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	detail.add_theme_stylebox_override("panel", style)
	vbox.add_child(detail)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0.0, 190.0)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	detail.add_child(scroll)
	var detail_box := VBoxContainer.new()
	detail_box.name = "CharDetailBox"
	detail_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_box.add_theme_constant_override("separation", 4)
	scroll.add_child(detail_box)
	var bottom_row := HBoxContainer.new()
	bottom_row.add_theme_constant_override("separation", 12)
	var back := _make_button("返回", false)
	back.custom_minimum_size = Vector2(140.0, 48.0)
	back.pressed.connect(func() -> void: show_screen("screen-level"))
	bottom_row.add_child(back)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom_row.add_child(spacer)
	var start := _make_button("开始出战 (0/3)", true)
	start.name = "StartButton"
	start.custom_minimum_size = Vector2(220.0, 48.0)
	start.pressed.connect(_on_start_run_pressed)
	bottom_row.add_child(start)
	vbox.add_child(bottom_row)
	return holder["panel"]


func _rebuild_char_grid() -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var grid: GridContainer = screen.find_child("CharGrid", true, false)
	for child: Node in grid.get_children():
		child.queue_free()
	selected_hero_ids.clear()
	var crystal_label: Label = screen.find_child("CrystalLabel", true, false)
	if crystal_label != null:
		crystal_label.text = "✦结晶 %d" % GameState.meta.crystals()
	var heroes: Variant = Cfg.get_table("heroes")
	if not heroes is Array:
		push_warning("[FlowRoot] heroes.json 缺失或格式错误")
		return
	for hero: Dictionary in (heroes as Array):
		if not hero is Dictionary:
			continue
		grid.add_child(_char_card(hero))
	_sync_team_ui()


## 职业信息：读 heroRoles 表（role -> {name,color}），缺失返回空 Dictionary
func _role_info(role_key: String) -> Dictionary:
	var roles: Variant = Cfg.get_table("heroRoles")
	if not roles is Dictionary:
		return {}
	var info: Variant = (roles as Dictionary).get(role_key, {})
	return info if info is Dictionary else {}


## 英雄卡头像：48x48 职业色块 + 中央叠英雄名首字
func _make_avatar(hero: Dictionary, unlocked: bool) -> Control:
	var role_key := str(hero.get("role", ""))
	var role_info := _role_info(role_key)
	var avatar := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COL_AVATAR_BG if not unlocked else Color(str(role_info.get("color", "#2a3a5a")))
	style.set_corner_radius_all(6)
	avatar.add_theme_stylebox_override("panel", style)
	avatar.custom_minimum_size = Vector2(48.0, 48.0)
	avatar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var hero_name := str(hero.get("name", "?"))
	var initial := Label.new()
	initial.text = hero_name.substr(0, 1)
	initial.add_theme_font_size_override("font_size", 24)
	initial.add_theme_color_override("font_color", COL_TEXT if unlocked else COL_LOCKED)
	initial.set_anchors_preset(Control.PRESET_FULL_RECT)
	initial.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	initial.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	initial.mouse_filter = Control.MOUSE_FILTER_IGNORE
	avatar.add_child(initial)
	return avatar


## 星级行：实心★金色 + 空心★灰色（总数取英雄表 difficulty 字段）
func _make_star_row(stars: int, unlocked: bool) -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 0)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	var total := maxi(1, stars)
	for s: int in total:
		var star := Label.new()
		star.text = "★" if (s < stars and unlocked) else "☆"
		star.add_theme_font_size_override("font_size", 14)
		star.add_theme_color_override("font_color", COL_GOLD if unlocked else COL_LOCKED)
		row.add_child(star)
	return row


func _char_card(hero: Dictionary) -> Control:
	var hero_id := str(hero.get("id", ""))
	var unlocked := GameState.meta.is_hero_unlocked(hero_id)
	var out_level := GameState.meta.hero_out_level(hero_id)
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = COL_CARD
	style.set_corner_radius_all(8)
	style.content_margin_left = 8.0
	style.content_margin_right = 8.0
	style.content_margin_top = 8.0
	style.content_margin_bottom = 8.0
	card.add_theme_stylebox_override("panel", style)
	card.custom_minimum_size = Vector2(150.0, 150.0)
	card.tooltip_text = str(hero.get("name", hero_id))
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	card.add_child(vbox)
	vbox.add_child(_make_avatar(hero, unlocked))
	var name_label := Label.new()
	name_label.text = str(hero.get("name", hero_id))
	name_label.add_theme_font_size_override("font_size", 17)
	name_label.add_theme_color_override("font_color", COL_LOCKED if not unlocked else COL_TEXT)
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(name_label)
	vbox.add_child(_make_star_row(int(hero.get("difficulty", 1)), unlocked))
	var lv_label := Label.new()
	lv_label.text = "局外 LV%d" % out_level
	lv_label.add_theme_font_size_override("font_size", 13)
	lv_label.add_theme_color_override("font_color", COL_SUB)
	lv_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(lv_label)
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


## 小标签（优点绿底/缺点红底/中性灰底）
func _make_chip(text: String, bg: Color, fg: Color) -> Control:
	var chip := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.set_corner_radius_all(4)
	style.content_margin_left = 6.0
	style.content_margin_right = 6.0
	style.content_margin_top = 2.0
	style.content_margin_bottom = 2.0
	chip.add_theme_stylebox_override("panel", style)
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", fg)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chip.add_child(label)
	return chip


## statBias 标签列表：stat 键经 statNames 表转中文；列表为空返回「待配置」占位
func _bias_chips(hero: Dictionary, bias_key: String, stat_names: Dictionary, good: bool) -> Array[Control]:
	var chips: Array[Control] = []
	var bias_raw: Variant = hero.get("statBias", {})
	var bias: Variant = bias_raw.get(bias_key, []) if bias_raw is Dictionary else []
	if bias is Array:
		for key: Variant in (bias as Array):
			var stat_key := str(key)
			chips.append(_make_chip(str(stat_names.get(stat_key, stat_key)),
				COL_GOOD_BG if good else COL_BAD_BG, COL_GOOD_TX if good else COL_BAD_TX))
	if chips.is_empty():
		var placeholder := _make_chip("待配置", COL_CARD, COL_LOCKED)
		chips.append(placeholder)
	return chips


func _show_char_detail(hero: Dictionary) -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var detail_box: VBoxContainer = screen.find_child("CharDetailBox", true, false)
	if detail_box == null:
		return
	for child: Node in detail_box.get_children():
		child.queue_free()
	var hero_id := str(hero.get("id", ""))
	var hero_name := str(hero.get("name", hero_id))
	var stat_names: Variant = Cfg.get_table("statNames")
	var stat_map: Dictionary = stat_names if stat_names is Dictionary else {}
	var role_info := _role_info(str(hero.get("role", "")))
	# 名字行：名字 + 职业标签 + HOPS + Lv
	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 8)
	var title := Label.new()
	title.text = hero_name
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", COL_GOLD)
	name_row.add_child(title)
	name_row.add_child(_make_chip(str(role_info.get("name", hero.get("role", "?"))), COL_AVATAR_BG, COL_TEXT))
	var hops := Label.new()
	hops.text = "HOPS"
	hops.add_theme_font_size_override("font_size", 15)
	hops.add_theme_color_override("font_color", COL_SUB)
	name_row.add_child(hops)
	var lv := Label.new()
	lv.text = "Lv%d" % GameState.meta.hero_out_level(hero_id)
	lv.add_theme_font_size_override("font_size", 15)
	lv.add_theme_color_override("font_color", COL_TEXT)
	name_row.add_child(lv)
	detail_box.add_child(name_row)
	# 属性行：数值全部读英雄表（含 statNames 中文映射），缺字段的属性自动跳过
	var stat_keys: Array[String] = ["hp", "atk", "spd", "dig", "def", "str", "agi", "int"]
	var stat_parts: Array[String] = []
	for key: String in stat_keys:
		if not hero.has(key):
			continue
		stat_parts.append("%s %d" % [str(stat_map.get(key, key)), int(hero.get(key, 0))])
	var stats := Label.new()
	stats.text = " · ".join(stat_parts) if not stat_parts.is_empty() else "待配置"
	stats.add_theme_font_size_override("font_size", 15)
	stats.add_theme_color_override("font_color", COL_TEXT)
	detail_box.add_child(stats)
	# 优点 / 缺点 标签行
	var pros_row := HBoxContainer.new()
	pros_row.add_theme_constant_override("separation", 6)
	pros_row.add_child(_make_chip("优点", COL_GOOD_BG, COL_GOOD_TX))
	for chip: Control in _bias_chips(hero, "high", stat_map, true):
		pros_row.add_child(chip)
	detail_box.add_child(pros_row)
	var cons_row := HBoxContainer.new()
	cons_row.add_theme_constant_override("separation", 6)
	cons_row.add_child(_make_chip("缺点", COL_BAD_BG, COL_BAD_TX))
	for chip: Control in _bias_chips(hero, "low", stat_map, false):
		cons_row.add_child(chip)
	detail_box.add_child(cons_row)
	# 羁绊行：英雄表暂无羁绊字段，显示待配置
	var bond_tags: Variant = hero.get("bonds", hero.get("bondTags", []))
	var bond_text := "待配置"
	if bond_tags is Array and not (bond_tags as Array).is_empty():
		var bond_parts: Array[String] = []
		for tag: Variant in (bond_tags as Array):
			bond_parts.append(str(tag))
		bond_text = " · ".join(bond_parts)
	var bond := Label.new()
	bond.text = "羁绊：%s" % bond_text
	bond.add_theme_font_size_override("font_size", 15)
	bond.add_theme_color_override("font_color", COL_SUB)
	detail_box.add_child(bond)
	# 进化结晶行：数值读 outLevel 表
	var out_level_cfg: Variant = Cfg.get_table("outLevel")
	var crystal_kill := 1
	var crystal_boss := 60
	if out_level_cfg is Dictionary:
		crystal_kill = int((out_level_cfg as Dictionary).get("crystalKill", 1))
		crystal_boss = int((out_level_cfg as Dictionary).get("crystalBoss", 60))
	var evolve := Label.new()
	evolve.text = "进化结晶：击败小怪 ✦%d / 首领 ✦%d，撤离后用于局外升级" % [crystal_kill, crystal_boss]
	evolve.add_theme_font_size_override("font_size", 15)
	evolve.add_theme_color_override("font_color", COL_SUB)
	detail_box.add_child(evolve)


func _sync_team_ui() -> void:
	var screen: Control = _screens.get("screen-character")
	if screen == null:
		return
	var max_size := Cfg.get_team_max_size()
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
