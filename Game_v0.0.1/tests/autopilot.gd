## 无头游玩冒烟驱动（autoload 注入，不顶掉主场景）
## 用法：godot --headless --path . -- --ap
extends Node


func _ready() -> void:
	if not ("--ap" in OS.get_cmdline_user_args()):
		return
	_run()


func _run() -> void:
	await _wait(1.5)
	print("SMOKE: main=", get_tree().current_scene.name)
	# 主菜单：开始游戏
	_press("开始游戏")
	await _wait(1.0)
	print("SMOKE: after 开始游戏 -> ", get_tree().current_scene.name)
	# 主城：找玩家/传送门，直接调 change_scene 走选关（读 FlowRoot 的公开方法）
	var flow: Node = _find_by_class(get_tree().root, "FlowRoot")
	print("SMOKE: FlowRoot=", flow != null)
	if flow != null and flow.has_method("open_level_select"):
		flow.call("open_level_select")
	elif flow != null:
		print("SMOKE: FlowRoot methods=", flow.get_method_list().filter(func(m: Dictionary) -> bool: return str(m["name"]).begins_with("open")).map(func(m: Dictionary) -> String: return str(m["name"])))
	await _wait(1.0)
	print("SMOKE: after open_level_select -> ", get_tree().current_scene.name)
	# 选关：点第一张关卡卡 → 选人 → 点开始出战
	if flow != null:
		flow.call("open_level_select")
		await _wait(0.5)
		print("SMOKE: screen=", flow.get("current_screen"))
		flow.call("_on_level_card_pressed", "LEVEL_001")
		await _wait(0.5)
		print("SMOKE: after 关卡卡 -> ", flow.get("current_screen"))
		flow.call("_on_char_card_pressed", {"id": "H001"}, Control.new())
		await _wait(0.2)
		flow.call("_on_char_card_pressed", {"id": "H002"}, Control.new())
		await _wait(0.3)
		print("SMOKE: team=", flow.get("selected_hero_ids"))
		_press("开始出战")
		await _wait(1.5)
		print("SMOKE: after 出战 -> ", get_tree().current_scene.name)
	if not str(get_tree().current_scene.name).begins_with("Battle"):
		print("SMOKE: FORCE battle")
		get_tree().change_scene_to_file("res://mods/jes-engine-core/scenes/battle.tscn")
		await _wait(1.0)
	await _wait(4.0)
	var b: Node = get_tree().current_scene
	print("SMOKE: battle scene=", b.name, " script=", b.get_script().resource_path if b.get_script() != null else "<null>")
	# 跑 300 帧
	for i: int in range(300):
		await get_tree().process_frame
	print("SMOKE: battle frames done, state=", str(b.get("state")))
	# 模拟撤离结算 → 结算屏
	GameState.emit_run_settled({"winner": "extract", "shards": 66, "kills": 61, "time": 95.0, "level_id": "LEVEL_001"})
	await _wait(1.0)
	print("SMOKE: settle screen=", flow.get("current_screen"))
	print("SMOKE: DONE")
	get_tree().quit(0)


func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout


func _press(text: String) -> void:
	_press_rec(get_tree().root, text)


func _press_rec(node: Node, text: String) -> void:
	if node is Button and (node as Button).text.find(text) >= 0 and (node as Button).visible:
		(node as Button).pressed.emit()
		print("SMOKE: pressed=", text)
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
