## 流向场寻路（Flow Field）—— 《玩法问题诊断与修复方案_v1.md》全局层落地
## 方案：从目标 BFS 扩散出「整合代价场」，所有单位 O(1) 查表得前进方向。
## 适用：群体杂兵（千级）共享同一目标（玩家）；精英/Boss 后续接 NavigationAgent2D（精确层）。
## 口径：4 向 BFS（杜绝 8 向斜穿墙角）；墙格与不可达格 sample 返回零向量（调用方回退 steering）。
class_name FlowField
extends RefCounted

var cell: float = 48.0
var w_cells: int = 0
var h_cells: int = 0
## 整合代价：-1 = 墙或不可达；>=0 = 到目标的步数。一维数组，索引 = cy * w_cells + cx
var _cost: PackedInt32Array = PackedInt32Array()
var _walls: Array = []   # Array[Rect2]（障碍 AABB，世界坐标）

func setup(world_size: Vector2, cell_size: float) -> void:
	cell = maxf(cell_size, 1.0)
	w_cells = maxi(int(ceil(world_size.x / cell)), 1)
	h_cells = maxi(int(ceil(world_size.y / cell)), 1)
	_cost.resize(w_cells * h_cells)

## 登记障碍 AABB（整表覆盖其触及的格）
func set_walls(rects: Array) -> void:
	_walls = rects

## 从目标重算代价场（4 向 BFS；每 0.1~0.2s 调一次，千怪共享）
func recompute(goal: Vector2) -> void:
	_cost.fill(-1)
	var walls := PackedByteArray()
	walls.resize(w_cells * h_cells)
	for r: Rect2 in _walls:
		var x0 := maxi(int(floor(r.position.x / cell)), 0)
		var x1 := mini(int(floor((r.end.x - 0.001) / cell)), w_cells - 1)
		var y0 := maxi(int(floor(r.position.y / cell)), 0)
		var y1 := mini(int(floor((r.end.y - 0.001) / cell)), h_cells - 1)
		for cy in range(y0, y1 + 1):
			for cx in range(x0, x1 + 1):
				walls[cy * w_cells + cx] = 1
	var gx := clampi(int(goal.x / cell), 0, w_cells - 1)
	var gy := clampi(int(goal.y / cell), 0, h_cells - 1)
	var g := gy * w_cells + gx
	if walls[g] == 1:
		return   # 目标在墙内：调用方语义错误，代价场保持全 -1（sample 全零向量）
	# BFS（数组 + 头游标，避免 pop_front 的 O(n)）
	var queue := PackedInt32Array()
	queue.resize(w_cells * h_cells)
	var head := 0
	var tail := 0
	queue[tail] = g
	tail += 1
	_cost[g] = 0
	while head < tail:
		var cur := queue[head]
		head += 1
		var cx := cur % w_cells
		var cy := cur / w_cells
		var nc: int = _cost[cur] + 1
		for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var nx := cx + d.x
			var ny := cy + d.y
			if nx < 0 or nx >= w_cells or ny < 0 or ny >= h_cells:
				continue
			var ni := ny * w_cells + nx
			if walls[ni] == 1 or _cost[ni] != -1:
				continue
			_cost[ni] = nc
			queue[tail] = ni
			tail += 1

## 查询位置的前进方向（单位向量）：指向 4 邻中代价最小的格中心。
## 已在目标格 / 墙内 / 不可达 → 返回零向量（调用方回退 steering 推挤）。
func sample(pos: Vector2) -> Vector2:
	var cx := clampi(int(pos.x / cell), 0, w_cells - 1)
	var cy := clampi(int(pos.y / cell), 0, h_cells - 1)
	var ci := cy * w_cells + cx
	var c: int = _cost[ci]
	if c <= 0:
		return Vector2.ZERO   # 0 = 已在目标格；-1 = 墙/不可达
	var best := ci
	var best_cost: int = c
	for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		var nx := cx + d.x
		var ny := cy + d.y
		if nx < 0 or nx >= w_cells or ny < 0 or ny >= h_cells:
			continue
		var ni := ny * w_cells + nx
		if _cost[ni] != -1 and _cost[ni] < best_cost:
			best_cost = _cost[ni]
			best = ni
	if best == ci:
		return Vector2.ZERO
	var bx := (best % w_cells + 0.5) * cell
	var by := (best / w_cells + 0.5) * cell
	return (Vector2(bx, by) - pos).normalized()

## 位置是否在墙/不可达格（供调用方决定是否回退局部避障）
func is_blocked(pos: Vector2) -> bool:
	var cx := clampi(int(pos.x / cell), 0, w_cells - 1)
	var cy := clampi(int(pos.y / cell), 0, h_cells - 1)
	return _cost[cy * w_cells + cx] == -1
