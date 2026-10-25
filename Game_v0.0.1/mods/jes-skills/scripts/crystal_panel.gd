## ============================================================
## 技能水晶面板：装备槽位、14 颗水晶卡片、编译预览
## 只负责 UI 与 SkillCompilerCore 的只读预览；战斗接入由主场景负责。
## ============================================================
extends CanvasLayer

signal crystals_changed(crystals: Array)

const SkillConfigCore := preload("res://mods/jes-skills/scripts/skill_config.gd")
const SkillCompilerCore := preload("res://mods/jes-skills/scripts/skill_compiler.gd")

const CRYSTAL_IDS := [
	"CR_PIERCE", "CR_MULTISHOT", "CR_HOMING", "CR_SPLIT",
	"CR_EXPLOSION", "CR_AFTERFLAME", "CR_EXPANSE", "CR_ORBIT",
	"CR_ARCANE_AMP", "CR_COOLDOWN", "CR_SPEED", "CR_BOUNCE",
	"CR_CHAIN", "CR_BURN",
]
const LOCALIZED_NAMES := {
	"CR_PIERCE": "贯穿水晶", "CR_MULTISHOT": "多重射击", "CR_HOMING": "追踪水晶",
	"CR_SPLIT": "分裂水晶", "CR_EXPLOSION": "爆裂水晶", "CR_AFTERFLAME": "余焰水晶",
	"CR_EXPANSE": "扩散水晶", "CR_ORBIT": "环绕水晶", "CR_ARCANE_AMP": "奥术增幅",
	"CR_COOLDOWN": "冷却水晶", "CR_SPEED": "迅捷水晶", "CR_BOUNCE": "弹射水晶",
	"CR_CHAIN": "连锁水晶", "CR_BURN": "灼烧水晶",
}

@export var skill_id := "SK_FIREBALL"
@export var skill_level := 1

var config: SkillConfigCore
var equipped_crystals: Array = []
var card_buttons: Array[Button] = []
var slot_labels: Array[Label] = []
var preview_labels: Array[Label] = []
var preview_result: Dictionary = {}
var cards_grid: GridContainer
var slots_row: HBoxContainer
var preview_row: HBoxContainer
var panel_root: Control

func _ready() -> void:
	config = SkillConfigCore.new()
	_build_ui()
	_refresh_all()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_C:
		toggle_panel()
		get_viewport().set_input_as_handled()

func toggle_panel() -> void:
	visible = not visible

func set_skill(skill: String, level: int = 1) -> void:
	skill_id = skill
	skill_level = maxi(1, level)
	_refresh_preview()

func get_card_count() -> int:
	return card_buttons.size()

func get_equipped_crystals() -> Array:
	return equipped_crystals.duplicate(true)

func get_preview() -> Dictionary:
	return preview_result.duplicate(true)

## 外部联动也可调用此方法，行为与点击卡片一致。
func equip_crystal(crystal_id: String, level: int = 1) -> bool:
	if not CRYSTAL_IDS.has(crystal_id) or _find_crystal(crystal_id) >= 0:
		return false
	var limit := maxi(0, config.slot_count if config != null else 4)
	if equipped_crystals.size() >= limit:
		return false
	equipped_crystals.append({"id": crystal_id, "level": maxi(1, level)})
	_refresh_all()
	crystals_changed.emit(get_equipped_crystals())
	return true

func unequip_crystal(crystal_id: String) -> bool:
	var index := _find_crystal(crystal_id)
	if index < 0:
		return false
	equipped_crystals.remove_at(index)
	_refresh_all()
	crystals_changed.emit(get_equipped_crystals())
	return true

func _build_ui() -> void:
	panel_root = get_node_or_null("Panel") as Control
	if panel_root == null:
		panel_root = PanelContainer.new()
		panel_root.name = "Panel"
		panel_root.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE, 24)
		add_child(panel_root)
	var outer := VBoxContainer.new()
	outer.name = "Outer"
	outer.add_theme_constant_override("separation", 10)
	panel_root.add_child(outer)
	var title := Label.new()
	title.text = "技能水晶  [C]"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 22)
	outer.add_child(title)
	var slots_title := Label.new()
	slots_title.text = "水晶槽位"
	outer.add_child(slots_title)
	slots_row = HBoxContainer.new()
	slots_row.name = "Slots"
	slots_row.add_theme_constant_override("separation", 6)
	outer.add_child(slots_row)
	var cards_title := Label.new()
	cards_title.text = "可用水晶"
	outer.add_child(cards_title)
	cards_grid = GridContainer.new()
	cards_grid.name = "Cards"
	cards_grid.columns = 4
	cards_grid.add_theme_constant_override("h_separation", 6)
	cards_grid.add_theme_constant_override("v_separation", 6)
	outer.add_child(cards_grid)
	var preview_title := Label.new()
	preview_title.text = "最终数值预览"
	outer.add_child(preview_title)
	preview_row = HBoxContainer.new()
	preview_row.name = "Preview"
	preview_row.add_theme_constant_override("separation", 12)
	outer.add_child(preview_row)
	for field in ["coefficient", "cooldown", "speed", "pierce", "count"]:
		var label := Label.new()
		label.name = field
		preview_row.add_child(label)
		preview_labels.append(label)
	_build_slots()
	_build_cards()
	_apply_panel_style()

func _build_slots() -> void:
	for child in slots_row.get_children():
		child.queue_free()
	slot_labels.clear()
	var count := maxi(0, config.slot_count if config != null else 4)
	for i in count:
		var label := Label.new()
		label.custom_minimum_size = Vector2(126, 32)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slots_row.add_child(label)
		slot_labels.append(label)

func _build_cards() -> void:
	for child in cards_grid.get_children():
		child.queue_free()
	card_buttons.clear()
	for crystal_id in CRYSTAL_IDS:
		var button := Button.new()
		button.name = crystal_id
		button.custom_minimum_size = Vector2(142, 42)
		button.text = _crystal_name(crystal_id)
		button.tooltip_text = crystal_id
		button.set_meta("crystal_id", crystal_id)
		button.pressed.connect(_on_card_pressed.bind(crystal_id))
		cards_grid.add_child(button)
		card_buttons.append(button)

func _on_card_pressed(crystal_id: String) -> void:
	if _find_crystal(crystal_id) >= 0:
		unequip_crystal(crystal_id)
	else:
		equip_crystal(crystal_id)

func _refresh_all() -> void:
	_refresh_slots()
	_refresh_cards()
	_refresh_preview()

func _refresh_slots() -> void:
	for i in slot_labels.size():
		var label := slot_labels[i]
		if i < equipped_crystals.size():
			var c: Dictionary = equipped_crystals[i]
			label.text = "%s Lv.%d" % [_crystal_name(str(c.get("id", ""))), int(c.get("level", 1))]
		else:
			label.text = "空槽"

func _refresh_cards() -> void:
	for button in card_buttons:
		var id := str(button.get_meta("crystal_id", ""))
		button.button_pressed = _find_crystal(id) >= 0
		button.text = ("✓ " if button.button_pressed else "") + _crystal_name(id)

func _refresh_preview() -> void:
	if config == null:
		return
	preview_result = SkillCompilerCore.compile(config, skill_id, skill_level, equipped_crystals)
	var params: Dictionary = preview_result.get("params", {})
	var values := [
		"伤害倍率 %.2f" % float(params.get("coefficient", 0.0)),
		"冷却 %.2fs" % float(params.get("cooldown", 0.0)),
		"弹速 %.0f" % float(params.get("speed", 0.0)),
		"贯穿 %d" % int(params.get("pierce", 0) + params.get("extraPierceCount", 0)),
		"弹数 %d" % int(params.get("count", 0)),
	]
	for i in mini_int(preview_labels.size(), values.size()):
		preview_labels[i].text = values[i]

func _crystal_name(crystal_id: String) -> String:
	var cdef: Dictionary = {}
	if config != null:
		cdef = config.get_crystal_def(crystal_id)
	var key := str(cdef.get("nameKey", ""))
	if not key.is_empty():
		var translated := TranslationServer.translate(key)
		if translated != key:
			return translated
	if LOCALIZED_NAMES.has(crystal_id):
		return LOCALIZED_NAMES[crystal_id]
	return crystal_id

func _find_crystal(crystal_id: String) -> int:
	for i in equipped_crystals.size():
		if str(equipped_crystals[i].get("id", "")) == crystal_id:
			return i
	return -1

func _apply_panel_style() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.035, 0.045, 0.075, 0.98)
	style.border_color = Color(0.88, 0.68, 0.22, 1.0)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 16.0
	style.content_margin_right = 16.0
	style.content_margin_top = 12.0
	style.content_margin_bottom = 12.0
	panel_root.add_theme_stylebox_override("panel", style)

func mini_int(a: int, b: int) -> int:
	return a if a < b else b
