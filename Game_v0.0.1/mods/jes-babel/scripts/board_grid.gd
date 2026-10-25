## 《巴别回路》SRPG 棋盘（11x9），纯逻辑 RefCounted，headless 可测。
## 口径：数值不硬编码，静态工厂 create_from_cfg()/create_default()。
class_name BabelBoard
extends RefCounted

## 列数
var cols: int = 11
## 行数
var rows: int = 9
## 占位表：键 Vector2i -> BabelUnit 引用
var units: Dictionary = {}
## 地形表：键 Vector2i -> Dictionary {"type": String, "hp": int}（type: fire|water|cover）
var terrain: Dictionary = {}


func _init(p_cols: int = 11, p_rows: int = 9) -> void:
	cols = p_cols
	rows = p_rows


## 从 cfg/srpg_rules.json 构建；缺表时回退默认值
static func create_from_cfg() -> BabelBoard:
	var board_size: Dictionary = {}
	var rules: Variant = _read_cfg_table("srpg_rules")
	if rules is Dictionary:
		var bs: Variant = (rules as Dictionary).get("board_size")
		if bs is Dictionary:
			board_size = bs
	var c: int = int(board_size.get("cols", 11))
	var r: int = int(board_size.get("rows", 9))
	return BabelBoard.new(c, r)


## 用与策划书一致的默认值构建（测试入口，不依赖 Cfg autoload）
static func create_default() -> BabelBoard:
	return BabelBoard.new(11, 9)


static func _read_cfg_table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


## 是否在棋盘内
func in_bounds(p: Vector2i) -> bool:
	return p.x >= 0 and p.x < cols and p.y >= 0 and p.y < rows


## 取格上单位；空格返回 null
func unit_at(p: Vector2i) -> Variant:
	if not units.has(p):
		return null
	return units.get(p)


## 放置单位（目标格必须空且在界内）
func place(unit: BabelUnit, p: Vector2i) -> bool:
	if not in_bounds(p) or units.has(p):
		return false
	units[p] = unit
	unit.pos = p
	return true


## 移除某格单位
func remove_at(p: Vector2i) -> void:
	if units.has(p):
		var u: Variant = units.get(p)
		if u is BabelUnit:
			(u as BabelUnit).pos = Vector2i(-999, -999)
		units.erase(p)


## 移动单位到空格（含占位校验与移动距离由调用方把关）
func move_unit(unit: BabelUnit, to: Vector2i) -> bool:
	if not in_bounds(to):
		return false
	if units.has(to):
		return false
	var from: Vector2i = unit.pos
	if units.get(from, null) != unit:
		return false
	units.erase(from)
	units[to] = unit
	unit.pos = to
	return true


## 曼哈顿距离
func manhattan(a: Vector2i, b: Vector2i) -> int:
	return absi(a.x - b.x) + absi(a.y - b.y)


## 4 邻格（含越界格，由调用方按需过滤）
func neighbors4(p: Vector2i) -> Array[Vector2i]:
	return [
		p + Vector2i(0, -1),
		p + Vector2i(1, 0),
		p + Vector2i(0, 1),
		p + Vector2i(-1, 0),
	]


## 设置地形；cover 格带 hp，fire/water 无需 hp
func set_terrain(p: Vector2i, type: String, hp: int = 0) -> void:
	if not in_bounds(p):
		push_warning("[BabelBoard] set_terrain 越界: %s" % [p])
		return
	terrain[p] = {"type": type, "hp": hp}


## 取地形类型；无地形返回 ""
func terrain_at(p: Vector2i) -> String:
	var t: Variant = terrain.get(p)
	if t is Dictionary:
		return str((t as Dictionary).get("type", ""))
	return ""


## 形状取格：single/cross/3x3/line/pierce，越界格剔除
func cells_in_shape(shape: String, origin: Vector2i, dir: Vector2i, range_n: int) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	if not in_bounds(origin):
		return out
	match shape:
		"single":
			out.append(origin)
		"cross":
			out.append(origin)
			var ring: int = 1
			while ring <= range_n:
				out.append(origin + Vector2i(0, -ring))
				out.append(origin + Vector2i(ring, 0))
				out.append(origin + Vector2i(0, ring))
				out.append(origin + Vector2i(-ring, 0))
				ring += 1
		"3x3":
			for dy: int in range(-1, 2):
				for dx: int in range(-1, 2):
					out.append(origin + Vector2i(dx, dy))
		"line", "pierce":
			var step: int = 1
			while step <= range_n:
				out.append(origin + dir * step)
				step += 1
		_:
			push_warning("[BabelBoard] 未知形状: %s" % [shape])
	var clipped: Array[Vector2i] = []
	for cell: Vector2i in out:
		if in_bounds(cell):
			clipped.append(cell)
	return clipped


## 所有火格坐标，供外部每回合结算 burn
func get_fire_cells() -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for p: Variant in terrain.keys():
		var pv: Vector2i = p as Vector2i
		if terrain_at(pv) == "fire":
			out.append(pv)
	return out
