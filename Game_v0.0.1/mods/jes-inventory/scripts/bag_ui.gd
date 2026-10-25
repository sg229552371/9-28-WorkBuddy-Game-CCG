## 背包 UI（jes-inventory 模块）—— CanvasLayer 面板，Tab 键开/关
## 制作人拍板口径：临时背包 5 行×6 列（左）、遗物背包 5 行×7 列（右），
## 两本背包单格尺寸（CELL）与间距（GAP）必须完全一致（后续支持跨背包互动）。
## 品质底色：物品面板按品质着色（白/绿/蓝/紫/金），带同色描边；点击选中显示中文 tooltip。
## 拖拽：仅留接口（item_drag_started 信号 + move_item_between 方法），不强制实现。
## 铁律：逻辑与 UI 分离——本文件只碰节点，仓储逻辑全在 inventory.gd（纯逻辑可 headless 测试）。
## 缺省演示：未注入背包时自动建 5×6 / 5×7 双包并塞入示范装备（读 cfg/gearDefs.json）。
class_name BagUI
extends CanvasLayer

signal item_selected(item: Dictionary)
signal item_drag_started(item: Dictionary, from_inv_id: String)

## 两本背包共用的单格尺寸 / 间距 / 内边距（硬性规格：完全一致）
const CELL := 52.0
const GAP := 4.0
const INNER_PAD := 10.0
const GRID_GAP := 26.0
const TEMP_COLS := 6
const TEMP_ROWS := 5
const RELIC_COLS := 7
const RELIC_ROWS := 5

const PANEL_BG := Color(0.07, 0.09, 0.12, 0.96)
const CELL_BG := Color(0.13, 0.16, 0.20, 1.0)
const SELECT_COLOR := Color(1, 1, 1)

var inv_temp: JesInventory
var inv_relic: JesInventory
var gear_gen := JesGearGen.new()
var selected: Dictionary = {}
var chest_stack_map: Dictionary = {}

var _panel: Panel
var _tooltip: PanelContainer
var _tooltip_box: VBoxContainer
var _grid_meta: Array[Dictionary] = []      # [{inv, origin:Vector2, cols, rows}]
var _item_nodes: Array[Control] = []
var _built := false

func _ready() -> void:
	layer = 30
	visible = false
	gear_gen.load_gear_defs()
	if inv_temp == null:
		inv_temp = JesInventory.new(TEMP_COLS, TEMP_ROWS, "temp")
	_fill_chest_map()
	if inv_temp.items.is_empty():
		_fill_demo(inv_temp)
	if inv_relic == null:
		inv_relic = JesInventory.new(RELIC_COLS, RELIC_ROWS, "relic")
	_fill_chest_map()
	_build()
	refresh()

## 注入口：外部（主场景 / 测试）传入已有背包实例，UI 只做渲染
func set_inventories(p_temp: JesInventory, p_relic: JesInventory) -> void:
	inv_temp = p_temp
	inv_relic = p_relic
	selected = {}
	if _built:
		refresh()

## Tab 开/关（project.godot 禁改，用裸 keycode 不依赖输入映射表）
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_TAB:
		toggle()
		get_viewport().set_input_as_handled()

func toggle() -> void:
	visible = not visible
	if visible:
		refresh()

## ---- 构建静态骨架：底板 + 两个网格标题 + 网格格子 ----
func _build() -> void:
	_built = true
	_grid_meta.clear()
	_panel = Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = PANEL_BG
	sb.corner_radius_top_left = 8
	sb.corner_radius_top_right = 8
	sb.corner_radius_bottom_left = 8
	sb.corner_radius_bottom_right = 8
	_panel.add_theme_stylebox_override("panel", sb)
	add_child(_panel)

	var grid_w := RELIC_COLS * CELL + (RELIC_COLS - 1) * GAP + INNER_PAD * 2.0
	var grid_h := TEMP_ROWS * CELL + (TEMP_ROWS - 1) * GAP + INNER_PAD * 2.0
	var panel_size := Vector2(grid_w * 2.0 + GRID_GAP * 3.0, grid_h + 46.0)
	_panel.size = panel_size
	_panel.position = Vector2(640, 360) - panel_size / 2.0

	_make_grid("临时背包", inv_temp, Vector2(GRID_GAP, 40.0))
	_make_grid("遗物背包", inv_relic, Vector2(GRID_GAP * 2.0 + grid_w, 40.0))

	_tooltip = PanelContainer.new()
	var tsb := StyleBoxFlat.new()
	tsb.bg_color = Color(0.05, 0.06, 0.09, 0.97)
	tsb.border_color = Color(0.5, 0.55, 0.65)
	tsb.set_border_width_all(1)
	_tooltip.add_theme_stylebox_override("panel", tsb)
	_tooltip.visible = false
	_tooltip.z_index = 5
	add_child(_tooltip)
	_tooltip_box = VBoxContainer.new()
	_tooltip.add_child(_tooltip_box)

## 单个网格：标题 Label + 背景板 + 逐格 ColorRect
func _make_grid(title: String, inv: JesInventory, origin: Vector2) -> void:
	var lbl := Label.new()
	lbl.text = title
	lbl.position = origin
	_panel.add_child(lbl)
	var board := Control.new()
	board.position = origin + Vector2(0, 26.0)
	_panel.add_child(board)
	var w := int(inv.cols) * CELL + (int(inv.cols) - 1) * GAP + INNER_PAD * 2.0
	var h := int(inv.rows) * CELL + (int(inv.rows) - 1) * GAP + INNER_PAD * 2.0
	var bsb := StyleBoxFlat.new()
	bsb.bg_color = CELL_BG.darkened(0.25)
	var board_panel := Panel.new()
	board_panel.add_theme_stylebox_override("panel", bsb)
	board_panel.size = Vector2(w, h)
	board.add_child(board_panel)
	for j in range(int(inv.rows)):
		for i in range(int(inv.cols)):
			var cell := ColorRect.new()
			cell.color = CELL_BG
			cell.position = Vector2(INNER_PAD + i * (CELL + GAP), INNER_PAD + j * (CELL + GAP))
			cell.size = Vector2(CELL, CELL)
			board.add_child(cell)
	_grid_meta.append({ "inv": inv, "board": board, "cols": int(inv.cols), "rows": int(inv.rows) })

## ---- 物品渲染：每次 refresh 全量重建物品面板（量级 < 40，可接受）----
func refresh() -> void:
	if not _built:
		return
	for n in _item_nodes:
		n.queue_free()
	_item_nodes.clear()
	for meta: Dictionary in _grid_meta:
		var inv: JesInventory = meta["inv"]
		var board: Control = meta["board"]
		for it in inv.items:
			_item_nodes.append(_make_item_node(it, inv, board))
	_update_tooltip()

func _make_item_node(it: Dictionary, inv: JesInventory, board: Control) -> Control:
	var q := clampi(int(it.get("quality", 0)), 0, JesGearGen.QUALITY_COLORS.size() - 1)
	var qc := Color(JesGearGen.QUALITY_COLORS[q])
	var node := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(qc.r, qc.g, qc.b, 0.30)
	sb.border_color = qc
	sb.set_border_width_all(2)
	if it == selected:
		sb.border_color = SELECT_COLOR
		sb.set_border_width_all(3)
	node.add_theme_stylebox_override("panel", sb)
	var w := JesInventory.item_w(it)
	var h := JesInventory.item_h(it)
	node.position = Vector2(INNER_PAD + int(it.get("x", 0)) * (CELL + GAP) + 1.0,
		INNER_PAD + int(it.get("y", 0)) * (CELL + GAP) + 1.0)
	node.size = Vector2(w * CELL + (w - 1) * GAP - 2.0, h * CELL + (h - 1) * GAP - 2.0)
	node.mouse_filter = Control.MOUSE_FILTER_STOP
	node.set_meta("item_uid", int(it.get("uid", -1)))
	var name_lbl := Label.new()
	name_lbl.text = String(it.get("name", "?"))
	name_lbl.add_theme_font_size_override("font_size", 12)
	name_lbl.position = Vector2(4, 2)
	node.add_child(name_lbl)
	var count := int(it.get("count", 1))
	if count > 1:
		var cnt_lbl := Label.new()
		cnt_lbl.text = "×%d" % count
		cnt_lbl.add_theme_font_size_override("font_size", 12)
		cnt_lbl.position = Vector2(4, 16)
		node.add_child(cnt_lbl)
	node.gui_input.connect(_on_item_gui_input.bind(it, inv))
	board.add_child(node)
	return node

## 点击选中 + tooltip；按住左键移动即触发拖拽开始信号（接口预留，具体搬运由上层消费）
func _on_item_gui_input(event: InputEvent, it: Dictionary, inv: JesInventory) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			selected = it
			item_selected.emit(it)
			refresh()
		elif selected == it:
			item_drag_started.emit(selected, inv.id)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and selected == it:
		item_drag_started.emit(selected, inv.id)

## ---- tooltip：名称 + 词条中文（词缀数组走 gear_gen 文案）----
func _update_tooltip() -> void:
	if not _built:
		return
	if selected.is_empty() or not visible:
		_tooltip.visible = false
		return
	for c in _tooltip_box.get_children():
		c.queue_free()
	var lines := JesGearGen.item_tooltip_lines(selected)
	for k in range(lines.size()):
		var l := Label.new()
		l.text = lines[k]
		if k == 0:
			var q := clampi(int(selected.get("quality", 0)), 0, JesGearGen.QUALITY_COLORS.size() - 1)
			l.modulate = Color(JesGearGen.QUALITY_COLORS[q])
			l.add_theme_font_size_override("font_size", 15)
		else:
			l.add_theme_font_size_override("font_size", 13)
		_tooltip_box.add_child(l)
	_tooltip.visible = true
	# 贴在选中物品右侧，越界则翻到左侧
	var node := _node_of(selected)
	var vp_size := _panel.get_viewport_rect().size
	var pos := _panel.position + Vector2(0, 0)
	if node != null:
		pos = node.get_global_position() + Vector2(node.size.x + 8.0, 0)
		if pos.x + 190.0 > vp_size.x:
			pos.x = node.get_global_position().x - 190.0
		_tooltip.position = pos.clamp(Vector2.ZERO, vp_size - Vector2(190, 40))
	else:
		_tooltip.position = pos

func _node_of(it: Dictionary) -> Control:
	for n in _item_nodes:
		if n.has_meta("item_uid") and int(n.get_meta("item_uid")) == int(it.get("uid", -1)):
			return n
	return null

## ---- 跨背包搬运接口（拖拽落地时上层调用；find_spot 找位放不下则回滚）----
func move_item_between(item: Dictionary, to_inv: JesInventory) -> bool:
	var from_inv := _inv_of(item)
	if from_inv == null or to_inv == null:
		return false
	if from_inv == to_inv:
		return true
	var spot := to_inv.find_spot(item)
	if spot.is_empty():
		return false
	from_inv.remove_item(item)
	if not to_inv.place(item, int(spot["x"]), int(spot["y"])):
		from_inv.place(item, int(item.get("x", 0)), int(item.get("y", 0)))
		return false
	selected = {}
	refresh()
	return true

## 一键整理（两本背包各整理各的，格子口径一致故可后续做跨包整理）
func arrange_all() -> void:
	inv_temp.auto_arrange(chest_stack_map)
	inv_relic.auto_arrange(chest_stack_map)
	selected = {}
	refresh()

func _inv_of(item: Dictionary) -> JesInventory:
	var inv_id := String(item.get("inv", ""))
	if inv_id == inv_temp.id:
		return inv_temp
	if inv_id == inv_relic.id:
		return inv_relic
	return null

## 宝箱堆叠表注入（对齐真源 CFG.chestQualities 的 {stackMax, value, weight}）
func set_chest_stack_map(m: Dictionary) -> void:
	chest_stack_map = m
	_fill_chest_map()

func _fill_chest_map() -> void:
	if not chest_stack_map.is_empty():
		return
	# Cfg autoload 存在则读表（禁改 autoload，故只读）；读不到用内置缺省
	var cfg_node := get_node_or_null("/root/Cfg")
	if cfg_node != null and "get_table" in cfg_node:
		var t: Variant = cfg_node.get_table("chestQualities")
		if t is Dictionary and not (t as Dictionary).is_empty():
			chest_stack_map = t
			return
		chest_stack_map = {
			"normal": { "stackMax": 5, "value": 20, "weight": 4 },
			"advanced": { "stackMax": 4, "value": 45, "weight": 6 },
			"epic": { "stackMax": 3, "value": 90, "weight": 8 },
			"divine": { "stackMax": 2, "value": 180, "weight": 10 },
			"mythic": { "stackMax": 1, "value": 360, "weight": 12 },
		}

## 演示数据：塞几件装备 + 一个 2×2 大件，验证品质底色与占格渲染
func _fill_demo(inv: JesInventory) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261024
	var defs: Array = gear_gen.gear_defs
	for k in range(mini(6, defs.size())):
		var d: Variant = defs[k]
		if d is Dictionary:
			inv.auto_add(gear_gen.make_gear(d, mini(k, 4), rng), chest_stack_map)
