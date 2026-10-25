## ============================================================
## 技能水晶面板与弹幕样式单元测试
## ============================================================
extends GutTest

const CrystalPanelScene := preload("res://mods/jes-skills/scenes/crystal_panel.tscn")
const ProjectileStyle := preload("res://mods/jes-skills/scripts/projectile_style.gd")
const CRYSTAL_IDS := [
	"CR_PIERCE", "CR_MULTISHOT", "CR_HOMING", "CR_SPLIT",
	"CR_EXPLOSION", "CR_AFTERFLAME", "CR_EXPANSE", "CR_ORBIT",
	"CR_ARCANE_AMP", "CR_COOLDOWN", "CR_SPEED", "CR_BOUNCE",
	"CR_CHAIN", "CR_BURN",
]

var panel

func before_each() -> void:
	panel = CrystalPanelScene.instantiate()
	add_child(panel)
	await get_tree().process_frame

func after_each() -> void:
	if is_instance_valid(panel):
		panel.queue_free()

func test_builds_all_fourteen_crystal_cards() -> void:
	assert_eq(panel.get_card_count(), 14, "面板应构建 14 颗水晶卡片")
	for crystal_id in CRYSTAL_IDS:
		assert_not_null(panel.get_node_or_null("Panel/Outer/Cards/" + crystal_id), "卡片节点应存在: " + crystal_id)

func test_equip_unequip_emits_changed_signal() -> void:
	var events: Array = []
	panel.crystals_changed.connect(func(value: Array) -> void: events.append(value))
	assert_true(panel.equip_crystal("CR_PIERCE"), "首次装备应成功")
	assert_eq(events.size(), 1, "装备应发出一次变更信号")
	assert_eq(events[0].size(), 1)
	assert_eq(events[0][0]["id"], "CR_PIERCE")
	assert_true(panel.unequip_crystal("CR_PIERCE"), "卸下已装备水晶应成功")
	assert_eq(events.size(), 2, "卸下应再次发出变更信号")
	assert_true(events[1].is_empty(), "卸下后槽位数组应为空")

func test_preview_uses_compiler_final_values() -> void:
	assert_true(panel.equip_crystal("CR_MULTISHOT"), "多重水晶应可装备")
	var preview: Dictionary = panel.get_preview()
	assert_true(preview["ok"], "预览编译应成功")
	var params: Dictionary = preview["params"]
	assert_eq(int(params["count"]), 2, "预览弹数应使用编译后的值")
	assert_almost_eq(float(params["coefficient"]), 1.5 * 0.8, 0.0001, "预览伤害倍率应使用编译后的值")

func test_style_maps_every_crystal() -> void:
	for crystal_id in CRYSTAL_IDS:
		var style: Dictionary = ProjectileStyle.style_for([{"id": crystal_id}])
		assert_true(style["color"] is Color, "样式颜色应为 Color: " + crystal_id)
		assert_gt(float(style["size"]), 0.0, "样式尺寸应为正数: " + crystal_id)
		assert_true(style["crystals"].has(crystal_id), "样式应记录已识别水晶: " + crystal_id)

func test_default_style_is_white_small_projectile() -> void:
	var style: Dictionary = ProjectileStyle.style_for([])
	assert_eq(style["color"], ProjectileStyle.DEFAULT_COLOR, "无水晶时应为默认白色")
	assert_almost_eq(float(style["size"]), ProjectileStyle.DEFAULT_SIZE, 0.0001, "无水晶时应为基础尺寸")
	assert_true(style["crystals"].is_empty(), "无水晶时识别列表应为空")
