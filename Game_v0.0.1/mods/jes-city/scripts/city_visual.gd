extends Node2D
## 主城视觉与交互层（对齐 html 原型）：深藏青底 + 暗网格 + 虚线 NPC 圈 +
## 头顶名称/副标题 + 顶部出征传送门 + 深渊之门 + 中央出生图腾 + 玩家圆点。
## 进 NPC 圈自动弹面板；传送门/深渊门进圈读条 2 秒（圈上进度环）。
## 纯逻辑在 city_logic.gd；坐标/半径/文案全读 cfg/city.json。

const LogicScript = preload("res://mods/jes-city/scripts/city_logic.gd")
const ModeScript = preload("res://mods/jes-city/scripts/city_mode.gd")
const GrowthScript = preload("res://mods/jes-city/scripts/hero_growth.gd")
const ShopScript = preload("res://mods/jes-city/scripts/shop.gd")
const ScreensScene := "res://mods/jes-engine-core/scenes/screens.tscn"

const BG_COLOR := Color("131c2c")
const GRID_COLOR := Color(0.24, 0.31, 0.42, 0.25)
const PLAYER_COLOR := Color("40e0c0")
const STAMP_BG := Color(0.07, 0.11, 0.18, 0.9)
const TEXT_COLOR := Color("e8e2c8")
const PANEL_BG := Color("16233a")
const PANEL_BORDER := Color("c9a84c")
const GOLD := Color("ffd76a")

var logic: RefCounted
var hud: Label = null
var panel_layer: CanvasLayer = null
var panel_root: PanelContainer = null
var shop_rng := RandomNumberGenerator.new()

func _ready() -> void:
	GameState.set_state("city")
	logic = LogicScript.new(LogicScript.ModeScript.read_config("city", {}))
	panel_layer = CanvasLayer.new()
	panel_layer.layer = 10
	add_child(panel_layer)
	_build_hud()
	shop_rng.randomize()
	print("[CityVisual] 主城就绪：点位 %d 个" % logic.entries.size())

func _build_hud() -> void:
	hud = Label.new()
	hud.position = Vector2(16, 12)
	hud.add_theme_font_size_override("font_size", 20)
	hud.add_theme_color_override("font_color", GOLD)
	add_child(hud)
	_refresh_hud()

func _refresh_hud() -> void:
	if hud == null:
		return
	# TODO: GameState/save_core 暂无 Meta 存档接口，昵称/结晶先读本地快照（logic.meta）。
	hud.text = "%s·%s  +  ◆%d" % [
		str(logic.meta.get("nickname", "无名旅者")),
		str(logic.meta.get("title", "初始守护")),
		int(logic.meta.get("crystals", 0)),
	]

func _process(dt: float) -> void:
	if logic == null:
		return
	if Input.is_action_just_pressed("ui_cancel"):
		if logic.close_panel():
			_close_panel_ui()
			return
	var dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if dir == Vector2.ZERO:
		dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	logic.move_player(dir, dt)
	_update_interaction(dt)
	queue_redraw()

## 进圈交互：NPC 弹面板；门类启动读条；出圈且不在读条则自动关面板
func _update_interaction(dt: float) -> void:
	var near: String = logic.entry_at(logic.player_pos)
	if near == "":
		if logic.open_panel_id != "":
			logic.close_panel()
			_close_panel_ui()
		return
	var e: Dictionary = logic.entry_by_id(near)
	var kind: String = str(e.get("kind", "npc"))
	if kind == "npc":
		if logic.open_panel_id != near:
			if logic.open_panel(near):
				_open_panel_ui(near)
		return
	if kind == "portal" or kind == "abyss":
		if logic.open_panel_id != "":
			logic.close_panel()
			_close_panel_ui()
		if not logic.is_channel_active():
			logic.start_channel(near)
		if logic.tick_channel(dt):
			_on_channel_done(near, kind)

func _on_channel_done(id: String, kind: String) -> void:
	if kind == "abyss":
		# 深渊之门：读条完发进入深渊意图（不改 event_bus.gd，只发既有信号）
		EventBus.emit_event("enter_abyss", {"portal": id})
		return
	# 出征传送门：读条完广播 cityPortalEnter —— FlowRoot 监听后弹出选关屏（叠加层，不切场景）
	EventBus.emit_event("portal_ready", {"portal": id})
	EventBus.emit_event("cityPortalEnter", {"portal": id})

# ---------------------------------------------------------------- 绘制

func _draw() -> void:
	if logic == null:
		return
	draw_rect(Rect2(Vector2.ZERO, logic.map_size), BG_COLOR)
	_draw_grid()
	_draw_spawn_totem()
	for e: Dictionary in logic.entries:
		_draw_entry(e)
	_draw_player()
	_draw_channel_ring()

func _draw_grid() -> void:
	var step := 64.0
	var x := 0.0
	while x <= logic.map_size.x:
		draw_line(Vector2(x, 0), Vector2(x, logic.map_size.y), GRID_COLOR, 1.0)
		x += step
	var y := 0.0
	while y <= logic.map_size.y:
		draw_line(Vector2(0, y), Vector2(logic.map_size.x, y), GRID_COLOR, 1.0)
		y += step

func _draw_spawn_totem() -> void:
	draw_circle(logic.spawn, 14.0, STAMP_BG)
	draw_arc(logic.spawn, 14.0, 0.0, TAU, 24, Color(0.5, 0.55, 0.6, 0.6), 2.0)
	draw_circle(logic.spawn, 5.0, Color(0.7, 0.75, 0.8, 0.8))

func _draw_entry(e: Dictionary) -> void:
	var pos: Vector2 = e.get("pos", Vector2.ZERO)
	var radius: float = e.get("radius", 60.0)
	var col := _color_of(str(e.get("color", "#cccccc")))
	var active: bool = str(e.get("id", "")) == str(logic.entry_at(logic.player_pos))
	var ring_col := col if active else Color(col.r, col.g, col.b, 0.7)
	_draw_dashed_circle(pos, radius, ring_col, 36, 0.55)
	_draw_stamp(pos, e, col)
	_draw_labels(pos, radius, e)

## 虚线圆：分段弧线，dash 比例决定实/空比
func _draw_dashed_circle(center: Vector2, radius: float, col: Color, segs: int, dash_ratio: float) -> void:
	var span := TAU / float(segs)
	for i in range(segs):
		if fmod(float(i), 2.0) >= 2.0 * dash_ratio:
			continue
		var a0 := float(i) * span
		draw_arc(center, radius, a0, a0 + span * dash_ratio, 4, col, 2.0)

func _draw_stamp(pos: Vector2, e: Dictionary, col: Color) -> void:
	var r := 22.0
	draw_circle(pos, r, STAMP_BG)
	draw_arc(pos, r, 0.0, TAU, 32, col, 2.5)
	var icon: String = str(e.get("icon", ""))
	if icon != "":
		var font := ThemeDB.fallback_font
		var size := 18
		var w := font.get_string_size(icon, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		draw_string(font, pos + Vector2(-w * 0.5, 6.0), icon, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)

func _draw_labels(pos: Vector2, radius: float, e: Dictionary) -> void:
	var font := ThemeDB.fallback_font
	var name_s: String = str(e.get("name", ""))
	var desc: String = str(e.get("desc", ""))
	var top := pos.y - radius - 34.0
	var ns := 16
	var ds := 12
	var nw := font.get_string_size(name_s, HORIZONTAL_ALIGNMENT_LEFT, -1, ns).x
	var dw := font.get_string_size(desc, HORIZONTAL_ALIGNMENT_LEFT, -1, ds).x
	draw_string(font, pos + Vector2(-nw * 0.5, top), name_s, HORIZONTAL_ALIGNMENT_LEFT, -1, ns, TEXT_COLOR)
	draw_string(font, pos + Vector2(-dw * 0.5, top + 18.0), desc, HORIZONTAL_ALIGNMENT_LEFT, -1, ds, Color(0.65, 0.7, 0.78))

func _draw_player() -> void:
	var p: Vector2 = logic.player_pos
	draw_circle(p, 11.0, PLAYER_COLOR)
	draw_arc(p, 11.0, 0.0, TAU, 24, Color(0.9, 1.0, 0.97), 2.0)

## 读条进度环：画在当前读条圈外沿
func _draw_channel_ring() -> void:
	if not logic.is_channel_active():
		return
	var e: Dictionary = logic.entry_by_id(logic.channel_id)
	if e.is_empty():
		return
	var pos: Vector2 = e.get("pos", Vector2.ZERO)
	var r: float = float(e.get("radius", 60.0)) + 12.0
	var prog: float = logic.channel_progress()
	if prog <= 0.0:
		return
	draw_arc(pos, r, -PI / 2.0, -PI / 2.0 + TAU * prog, 48, GOLD, 5.0)

func _color_of(hex: String) -> Color:
	var c := Color.from_string(hex, Color.WHITE)
	return c

# ---------------------------------------------------------------- 面板

func _open_panel_ui(id: String) -> void:
	_close_panel_ui()
	var e: Dictionary = logic.entry_by_id(id)
	if e.is_empty():
		return
	panel_root = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = PANEL_BG
	style.border_color = PANEL_BORDER
	style.set_border_width_all(2)
	style.set_corner_radius_all(10)
	style.content_margin_left = 18.0
	style.content_margin_right = 18.0
	style.content_margin_top = 14.0
	style.content_margin_bottom = 14.0
	panel_root.add_theme_stylebox_override("panel", style)
	panel_root.custom_minimum_size = Vector2(420, 0)
	panel_root.position = Vector2(logic.map_size.x - 470, 90)
	var kind: String = str(e.get("func", ""))
	var title: String = str(e.get("name", ""))
	match kind:
		"outlevel":
			_build_hero_panel(title)
		"weapon":
			_build_weapon_panel(title)
		"shop":
			_build_shop_panel(title)
		"codex":
			_build_codex_panel(title)
		"profile":
			_build_profile_panel(title)
		"season":
			_build_season_panel(title)
		_:
			_build_generic_panel(title, str(e.get("desc", "")))
	panel_layer.add_child(panel_root)

func _close_panel_ui() -> void:
	if panel_root != null:
		panel_root.queue_free()
		panel_root = null

func _panel_header(box: VBoxContainer, title: String, subtitle: String) -> void:
	var t := Label.new()
	t.text = title
	t.add_theme_font_size_override("font_size", 22)
	t.add_theme_color_override("font_color", GOLD)
	box.add_child(t)
	if subtitle != "":
		var s := Label.new()
		s.text = subtitle
		s.add_theme_color_override("font_color", Color(0.65, 0.7, 0.78))
		box.add_child(s)
	box.add_child(HSeparator.new())

func _new_panel_box() -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel_root.add_child(box)
	return box

## 英雄升级面板：英雄列表 + 等级 + 升级按钮（结晶消耗，复用 hero_growth.gd）
func _build_hero_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "消耗结晶提升局外等级")
	var growth: HeroGrowth = GrowthScript.new({})
	var snapshot: Dictionary = logic.meta
	for hero: Dictionary in growth.unlock.heroes:
		var hid: String = str(hero.get("id", ""))
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = "%s  Lv.%d" % [str(hero.get("name", hid)), growth.hero_level(hid, snapshot)]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_color_override("font_color", TEXT_COLOR)
		row.add_child(label)
		var cost := growth.level_up_cost(hid, snapshot)
		var btn := Button.new()
		btn.text = "升级 ◆%d" % cost if cost > 0 else "已满级"
		btn.disabled = cost <= 0
		btn.pressed.connect(_on_hero_upgrade.bind(hid))
		row.add_child(btn)
		box.add_child(row)

func _on_hero_upgrade(hid: String) -> void:
	var growth: HeroGrowth = GrowthScript.new({})
	if growth.level_up(hid, logic.meta):
		_refresh_hud()
		_open_panel_ui(logic.open_panel_id)
	else:
		push_warning("[CityVisual] 升级失败（结晶不足或已满级）: " + hid)

## 武器强化面板：武器列表 + 等级 + 升级按钮
func _build_weapon_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "消耗结晶强化专属武器")
	var weapons: Dictionary = ModeScript.read_config("weapons", {})
	var lv_cfg: Dictionary = ModeScript.read_config("weaponLevel", {})
	for wid: String in weapons:
		var w: Dictionary = weapons.get(wid, {})
		var lv_map: Dictionary = logic.meta.get("weapons", {})
		var lv := maxi(1, int(lv_map.get(wid, 1)))
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = "%s  Lv.%d" % [str(w.get("name", wid)), lv]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_color_override("font_color", TEXT_COLOR)
		row.add_child(label)
		var max_lv := int(lv_cfg.get("maxLv", 1))
		var btn := Button.new()
		if lv >= max_lv:
			btn.text = "已满级"
			btn.disabled = true
		else:
			var cost := _weapon_cost(lv, lv_cfg)
			btn.text = "强化 ◆%d" % cost
			btn.pressed.connect(_on_weapon_upgrade.bind(wid, lv_cfg))
		row.add_child(btn)
		box.add_child(row)

func _weapon_cost(lv: int, lv_cfg: Dictionary) -> int:
	var base := float(lv_cfg.get("costBase", 100))
	var growth := float(lv_cfg.get("costGrowth", 1.0))
	var rnd := float(lv_cfg.get("costRound", 1))
	return int(ceil(base * pow(growth, float(lv - 1)) / rnd) * rnd)

func _on_weapon_upgrade(wid: String, lv_cfg: Dictionary) -> void:
	var lv_map: Dictionary = logic.meta.get("weapons", {})
	var lv := maxi(1, int(lv_map.get(wid, 1)))
	var cost := _weapon_cost(lv, lv_cfg)
	if int(logic.meta.get("crystals", 0)) < cost:
		push_warning("[CityVisual] 结晶不足，无法强化: " + wid)
		return
	logic.meta["crystals"] = int(logic.meta.get("crystals", 0)) - cost
	lv_map[wid] = lv + 1
	logic.meta["weapons"] = lv_map
	_refresh_hud()
	_open_panel_ui(logic.open_panel_id)

## 商人面板：货架 + 购买 + 刷新（复用 shop.gd）
func _build_shop_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "购买搜刮补给 · 每次随机交付")
	var services: Dictionary = ModeScript.read_config("artisanServices", {})
	for sid: String in services:
		var row := HBoxContainer.new()
		var label := Label.new()
		label.text = sid
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.add_theme_color_override("font_color", TEXT_COLOR)
		row.add_child(label)
		var btn := Button.new()
		btn.text = "购买"
		btn.pressed.connect(_on_shop_buy.bind(sid))
		row.add_child(btn)
		box.add_child(row)
	var refresh := Button.new()
	refresh.text = "刷新货架"
	refresh.pressed.connect(_on_shop_refresh)
	box.add_child(refresh)
	var bag := Label.new()
	var items: Array = logic.meta.get("bag", [])
	bag.text = "已购入 %d 件" % items.size()
	bag.add_theme_color_override("font_color", GOLD)
	box.add_child(bag)

func _on_shop_buy(sid: String) -> void:
	var shop: CityShop = ShopScript.new()
	shop.set_item_factory(func(req: Dictionary) -> Dictionary:
		var item := req.duplicate(true)
		item["name"] = sid
		return item)
	shop.set_item_grant(func(_item: Dictionary) -> bool:
		var bag: Array = logic.meta.get("bag", [])
		bag.append(_item)
		logic.meta["bag"] = bag
		return true)
	var run := {"coin": int(logic.meta.get("crystals", 0)), "pendingItems": []}
	var result: Dictionary = shop.buy(sid, run, true)
	if bool(result.get("ok", false)):
		logic.meta["crystals"] = int(run.get("coin", 0))
		_refresh_hud()
		_open_panel_ui(logic.open_panel_id)
	else:
		push_warning("[CityVisual] 购买失败: " + str(result.get("msg", "")))

func _on_shop_refresh() -> void:
	shop_rng.randomize()
	_open_panel_ui(logic.open_panel_id)

## 图鉴面板：色块网格 + 名称 + 解锁态
func _build_codex_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "点亮的条目表示已收录")
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	var monsters: Dictionary = ModeScript.read_config("monsters", {})
	var codex: Dictionary = logic.meta.get("codex", {})
	for mid: String in monsters:
		var m: Dictionary = monsters.get(mid, {})
		var unlocked: bool = bool(codex.get(mid, false))
		var cell := VBoxContainer.new()
		var chip := Panel.new()
		var style := StyleBoxFlat.new()
		style.bg_color = Color.from_string(str(m.get("sprite", "")), Color(0.2, 0.25, 0.33)) if unlocked else Color(0.12, 0.15, 0.2)
		style.set_corner_radius_all(6)
		chip.add_theme_stylebox_override("panel", style)
		chip.custom_minimum_size = Vector2(72, 40)
		cell.add_child(chip)
		var name_l := Label.new()
		name_l.text = str(m.get("name", mid)) if unlocked else "???"
		name_l.add_theme_font_size_override("font_size", 12)
		name_l.add_theme_color_override("font_color", TEXT_COLOR if unlocked else Color(0.4, 0.45, 0.52))
		cell.add_child(name_l)
		grid.add_child(cell)
	box.add_child(grid)

## 形象师面板：更名（写本地快照，存档接口就绪后迁移）
func _build_profile_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "旅者名号")
	var profile: Dictionary = ModeScript.read_config("profile", {})
	var input := LineEdit.new()
	input.text = str(logic.meta.get("nickname", profile.get("defaultName", "无名旅者")))
	input.max_length = int(profile.get("nameMax", 8))
	box.add_child(input)
	var btn := Button.new()
	btn.text = "确定更名"
	btn.pressed.connect(func() -> void:
		var name_s := input.text.strip_edges()
		if name_s.length() < int(profile.get("nameMin", 2)):
			push_warning("[CityVisual] 名号过短")
			return
		logic.meta["nickname"] = name_s
		_refresh_hud())
	box.add_child(btn)

## 赛季使者：占位面板
func _build_season_panel(title: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, "赛季挑战大厅")
	var tip := Label.new()
	tip.text = "赛季系统尚未开放，敬请期待"
	tip.add_theme_color_override("font_color", TEXT_COLOR)
	box.add_child(tip)

func _build_generic_panel(title: String, desc: String) -> void:
	var box := _new_panel_box()
	_panel_header(box, title, desc)
	var tip := Label.new()
	tip.text = "功能建设中"
	tip.add_theme_color_override("font_color", TEXT_COLOR)
	box.add_child(tip)
