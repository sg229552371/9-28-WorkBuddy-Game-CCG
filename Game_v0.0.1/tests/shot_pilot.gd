## 实机截图驱动（临时工具）：走 主菜单→选关→选人→战斗，各截一张 PNG
## 用法：注入 autoload 后 `godot --path . -- --shot`；用完移除本 autoload。
extends Node

const OUT_DIR := "res://shots"

func _ready() -> void:
	if not ("--shot" in OS.get_cmdline_user_args()):
		return
	_run()

func _run() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	await _wait(2.0)
	_press("开始游戏")
	await _wait(1.5)
	var flow: Node = _find_by_class(get_tree().root, "FlowRoot")
	if flow != null and flow.has_method("open_level_select"):
		flow.call("open_level_select")
	await _wait(1.2)
	await _shot("1_level_select.png")
	if flow != null:
		flow.call("_on_level_card_pressed", "LEVEL_001")
		await _wait(0.8)
		await _shot("2_character_select.png")
		flow.call("_on_char_card_pressed", {"id": "H001"}, Control.new())
		flow.call("_on_char_card_pressed", {"id": "H002"}, Control.new())
		await _wait(0.5)
		# 复现回归：选人屏期间重复收到传送门事件，不应弹回选关
		EventBus.emit_event("cityPortalEnter", {"portal": "portal_exit"})
		await _wait(1.5)
		await _shot("4_still_character.png")
		_press("开始出战")
	await _wait(3.5)
	await _shot("3_battle.png")
	await _wait(0.5)
	get_tree().quit(0)

func _shot(fname: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := ProjectSettings.globalize_path(OUT_DIR + "/" + fname)
	img.save_png(path)
	print("[Shot] saved=", path)

func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout

func _press(text: String) -> void:
	_press_rec(get_tree().root, text)

func _press_rec(node: Node, text: String) -> void:
	if node is Button and (node as Button).text.find(text) >= 0 and (node as Button).visible:
		(node as Button).pressed.emit()
		return
	for ch: Node in node.get_children():
		_press_rec(ch, text)

func _find_by_class(node: Node, cls: String) -> Node:
	if node.get_script() != null and (node.get_script() as Script).get_global_name() == cls:
		return node
	for ch: Node in node.get_children():
		var r: Node = _find_by_class(ch, cls)
		if r != null:
			return r
	return null
