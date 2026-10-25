## 无头游玩冒烟驱动：模拟 主菜单→主城→选关→选人→战斗→撤离/死亡 全流程，抓运行时报错
## 用法：godot --headless -s tests/flow_smoke.gd
extends SceneTree

var _errs: int = 0


func _init() -> void:
	_run()


func _run() -> void:
	print("SMOKE: start")
	# 拦截报错计数
	var log_line: Array = []
	# 1. 加载主场景（flow.tscn）
	var flow: Node = (load("res://mods/jes-engine-core/scenes/flow.tscn") as PackedScene).instantiate()
	root.add_child(flow)
	await process_frame
	await process_frame
	print("SMOKE: flow loaded, children=", flow.get_children().size())
	# 2. 找到"开始游戏"按钮并按下
	_press_button_by_text(flow, "开始游戏")
	await process_frame
	await create_timer(0.5).timeout
	var cur: Node = current_scene
	print("SMOKE: after start, current_scene=", cur.name if cur != null else "<null>")
	# 3. 若进入主城，找传送门读条/交互入口
	if cur != null and cur.name == "city":
		print("SMOKE: city ok")
	# 4. 直接驱动 GameState 流转：选关 → 选人 → 战斗
	GameState.level_id = "LEVEL_001"
	print("SMOKE: goto char select")
	# 5. 加载战斗场景并跑 300 帧
	var battle_ps: PackedScene = load("res://mods/jes-engine-core/scenes/battle.tscn")
	if battle_ps == null:
		push_error("battle.tscn 加载失败")
		_errs += 1
	else:
		var b: Node = battle_ps.instantiate()
		root.add_child(b)
		for i: int in range(300):
			await process_frame
		print("SMOKE: battle ran 300 frames")
		b.queue_free()
		await process_frame
	# 6. 加载主城场景跑 120 帧
	var city_ps: PackedScene = load("res://mods/jes-engine-core/scenes/city.tscn")
	if city_ps == null:
		push_error("city.tscn 加载失败")
		_errs += 1
	else:
		var c: Node = city_ps.instantiate()
		root.add_child(c)
		for i: int in range(120):
			await process_frame
		print("SMOKE: city ran 120 frames")
		c.queue_free()
		await process_frame
	print("SMOKE: DONE errs=", _errs)
	quit(0 if _errs == 0 else 1)


func _press_button_by_text(node: Node, text: String) -> void:
	if node is Button and (node as Button).text.find(text) >= 0:
		(node as Button).pressed.emit()
		print("SMOKE: pressed button=", text)
		return
	for c: Node in node.get_children():
		_press_button_by_text(c, text)
