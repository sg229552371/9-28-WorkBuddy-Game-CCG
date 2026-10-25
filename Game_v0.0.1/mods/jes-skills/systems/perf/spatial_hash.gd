# SpatialHash（规格 §9.2）：均匀网格空间哈希，用于投射物邻域查询。
#
# 每帧标准用法：
#   hash.clear()
#   for e in enemies: hash.insert(e.id, e.global_position)
#   for p in projectiles: hash.query_near_into(buf, p.pos, p.radius + max_enemy_radius)
#
# 硬规则：
# - 只用距离平方比较，不开方
# - 只扫 pos±radius 覆盖的格子（3×3 是 radius <= cell_size 时的特例）
# - 不持有 Node 引用（id 由调用方定义），可整体复用、可单测
# - **桶对象复用**：每帧 clear 把格子的 Array 收进池，insert 再从池里取，
#   避免"每帧重建 80 个 Array"（实测那是对象数爬升的主因）
class_name SkillSpatialHash
extends RefCounted

var cell_size: float = 32.0

var _cells: Dictionary = {}   # Vector2i -> Array[int]
var _pos: Dictionary = {}     # id -> Vector2
var _bucket_pool: Array = []  # 回收的空桶，留给下一帧 insert 复用


func _init(p_cell_size: float = 32.0) -> void:
	cell_size = maxf(p_cell_size, 1.0)


func clear() -> void:
	for k in _cells:
		var arr: Array = _cells[k]
		arr.clear()
		_bucket_pool.append(arr)
	_cells.clear()
	_pos.clear()


func count() -> int:
	return _pos.size()


func is_empty() -> bool:
	return _pos.is_empty()


## 世界坐标 → 格子坐标（负数也正确向下取整）
func cell_of(pos: Vector2) -> Vector2i:
	return Vector2i(floori(pos.x / cell_size), floori(pos.y / cell_size))


## 插入一个实体（同 id 重复插入会覆盖位置，但旧格子里的残留 id 会在查询时被距离过滤掉）
func insert(id: int, pos: Vector2) -> void:
	var key := cell_of(pos)
	if _cells.has(key):
		(_cells[key] as Array).append(id)
	else:
		var bucket: Array
		if _bucket_pool.is_empty():
			bucket = []
		else:
			bucket = _bucket_pool.pop_back()
		bucket.append(id)
		_cells[key] = bucket
	_pos[id] = pos


## 查询半径内全部 id，写入 out（复用数组，避免每次分配）
func query_near_into(out: Array, pos: Vector2, radius: float) -> Array:
	out.clear()
	if _pos.is_empty():
		return out
	var r2 := radius * radius
	var min_key := cell_of(pos - Vector2(radius, radius))
	var max_key := cell_of(pos + Vector2(radius, radius))
	for cx in range(min_key.x, max_key.x + 1):
		for cy in range(min_key.y, max_key.y + 1):
			var key := Vector2i(cx, cy)
			if not _cells.has(key):
				continue
			for id in _cells[key]:
				var p: Vector2 = _pos[id]
				if p.distance_squared_to(pos) <= r2:
					out.append(id)
	return out


## 便捷版本（会分配数组，热路径请用 query_near_into）
func query_near(pos: Vector2, radius: float) -> Array:
	var out: Array = []
	return query_near_into(out, pos, radius)


## 最近目标（距离平方比较，命中即返回最小者）；查不到返回 -1
func nearest(pos: Vector2, radius: float) -> int:
	var best_id := -1
	var best_d2 := INF
	var min_key := cell_of(pos - Vector2(radius, radius))
	var max_key := cell_of(pos + Vector2(radius, radius))
	for cx in range(min_key.x, max_key.x + 1):
		for cy in range(min_key.y, max_key.y + 1):
			var key := Vector2i(cx, cy)
			if not _cells.has(key):
				continue
			for id in _cells[key]:
				var d2: float = (_pos[id] as Vector2).distance_squared_to(pos)
				if d2 <= radius * radius and d2 < best_d2:
					best_d2 = d2
					best_id = int(id)
	return best_id
