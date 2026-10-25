## 主城场景 —— 场景串联流（主城 → 选人 → 进战 → 回城）
## 复用三合一导航屏（screens.tscn）：传送门 → 选人 → hero_selected 信号切战斗场景。
## 死亡结算由 battle.gd 弹「返回主城」按钮，change_scene 回本场景形成闭环。
extends Node2D

var screens_ui: CanvasLayer = null      # 三合一屏（主城/选人/结算）
var hint: Label = null                  # 底部操作提示
var settle_label: Label = null          # 上局结算回顾（有 last_settlement 才显示）

const BATTLE_SCENE := "res://mods/jes-engine-core/scenes/battle.tscn"

func _ready() -> void:
	GameState.set_state("city")
	print("[City] 主城就绪")
	# 三合一屏：进场直接展开面板，选人走 hero_selected 信号
	var sc_scene: PackedScene = load("res://mods/jes-engine-core/scenes/screens.tscn")
	if sc_scene != null:
		screens_ui = sc_scene.instantiate()
		add_child(screens_ui)
		screens_ui.toggle_panel()
		screens_ui.hero_selected.connect(_on_hero_selected)
	_build_labels()

func _build_labels() -> void:
	hint = Label.new()
	hint.text = "操作：M 开关导航面板 · 点击传送门选英雄出征"
	hint.position = Vector2(24, 620)
	hint.add_theme_font_size_override("font_size", 20)
	add_child(hint)
	var s: Dictionary = GameState.last_settlement
	if not s.is_empty():
		settle_label = Label.new()
		settle_label.text = "上局结算：击杀 %d · 波次 %d · 金币 %d · 经验 %d" % [
			int(s.get("kills", 0)), int(s.get("wave", 0)),
			int(s.get("coins", 0)), int(s.get("exp", 0))]
		settle_label.position = Vector2(24, 660)
		settle_label.add_theme_font_size_override("font_size", 18)
		add_child(settle_label)

## 选人确认 → 记录英雄 → 切战斗场景（串联流主环节）
func _on_hero_selected(hero_id: String) -> void:
	GameState.hero_id = hero_id if hero_id != "" else "H001"
	GameState.last_settlement = {}   # 新征程清空上局结算
	print("[City] 出征英雄: ", GameState.hero_id)
	get_tree().change_scene_to_file(BATTLE_SCENE)
