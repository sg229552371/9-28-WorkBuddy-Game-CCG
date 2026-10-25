class_name CityMode
extends RefCounted
## 主城数据与 NPC 交互状态；不创建节点，不负责绘制和输入。

static var _warnings: Dictionary = {}

var config: Dictionary
var judge_mul: float
var near_npc_id: String = ""
var open_npc_id: String = ""
var position: Vector2


func _init(tables: Dictionary = {}) -> void:
	config = tables.get("city", read_config("city", {})).duplicate(true)
	judge_mul = float(tables.get("altarJudgeMul", read_config("altarJudgeMul", 1.0)))
	var spawn: Dictionary = config.get("spawn", {})
	position = Vector2(float(spawn.get("x", 0)) * float(config.get("mapW", 0)), float(spawn.get("y", 0)) * float(config.get("mapH", 0)))


static func warn_once(key: String, message: String) -> void:
	if not _warnings.has(key):
		_warnings[key] = true
		push_warning(message)


static func read_config(table: String, fallback: Variant) -> Variant:
	var path := "res://cfg/%s.json" % table
	if FileAccess.file_exists(path):
		var parser := JSON.new()
		if parser.parse(FileAccess.get_file_as_string(path)) == OK:
			var numeric := (parser.data is float or parser.data is int) and (fallback is float or fallback is int)
			if numeric or typeof(parser.data) == typeof(fallback):
				return parser.data
	warn_once(table, "配置表缺失或格式不符，采用保守默认值：%s" % table)
	return fallback


func buildings() -> Array:
	var result: Array = []
	for entry in config.get("npcs", []):
		var npc: Dictionary = entry.duplicate(true)
		npc["x"] = float(npc.get("fx", 0)) * float(config.get("mapW", 0))
		npc["y"] = float(npc.get("fy", 0)) * float(config.get("mapH", 0))
		result.append(npc)
	return result


func entrances() -> Array:
	var result: Array = []
	for key in ["portal", "seasonPortal", "abyssPortal"]:
		if config.get(key) is Dictionary:
			var entry: Dictionary = config[key].duplicate(true)
			entry["id"] = key
			result.append(entry)
	return result


func update_position(value: Vector2) -> void:
	position = value
	near_npc_id = ""
	var radius := float(config.get("npcRadius", 0)) * judge_mul
	for npc in buildings():
		if position.distance_to(Vector2(npc.x, npc.y)) < radius:
			near_npc_id = str(npc.id)
			break
	if near_npc_id.is_empty():
		open_npc_id = ""


func interact(npc_id: String = "") -> Dictionary:
	if near_npc_id.is_empty() or (not npc_id.is_empty() and npc_id != near_npc_id):
		return {"ok": false, "reason": "out_of_range", "msg": "请先靠近目标"}
	for npc in buildings():
		if npc.id == near_npc_id:
			open_npc_id = near_npc_id
			return {"ok": true, "npc": npc, "func": npc.get("func", "")}
	return {"ok": false, "reason": "unknown_npc", "msg": "目标不存在"}


func close_panel() -> void:
	open_npc_id = ""
