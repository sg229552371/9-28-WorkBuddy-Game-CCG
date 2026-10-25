## 《巴别回路》地形格生成器：连续大地图上的 64px 格（水/火/掩体/圣坛）
## 覆盖率 ≥30%（设计支柱 1）；掩体格同时登记为流场墙。
class_name BabelTerrain
extends RefCounted

const TYPE_NONE: String = ""
const TYPE_WATER: String = "water"
const TYPE_FIRE: String = "fire"
const TYPE_COVER: String = "cover"
const TYPE_ALTAR: String = "altar"

var tile: float = 64.0
var cols: int = 0
var rows: int = 0
## 格类型：Vector2i -> String
var grid: Dictionary = {}


## world_px = 世界尺寸；coverage = 非空格占比目标（默认 0.35，≥0.30 达标）
func generate(rng: RandomNumberGenerator, world_px: Vector2, tile_px: float, coverage: float = 0.35) -> void:
	tile = maxf(tile_px, 1.0)
	cols = maxi(int(world_px.x / tile), 1)
	rows = maxi(int(world_px.y / tile), 1)
	grid.clear()
	var total: int = cols * rows
	var target: int = int(round(float(total) * clampf(coverage, 0.30, 0.6)))
	var placed: int = 0
	var guard: int = 0
	while placed < target and guard < total * 10:
		guard += 1
		var c: Vector2i = Vector2i(rng.randi_range(0, cols - 1), rng.randi_range(0, rows - 1))
		if grid.has(c):
			continue
		# 圣坛/掩体不成片贴出生点行（底部两行留空，推荐默认）
		if c.y >= rows - 2:
			continue
		var roll: int = rng.randi_range(0, 9)
		if roll < 3:
			grid[c] = TYPE_WATER
		elif roll < 6:
			grid[c] = TYPE_FIRE
		elif roll < 9:
			grid[c] = TYPE_COVER
		else:
			grid[c] = TYPE_ALTAR
		placed += 1


## 查询世界坐标格类型
func type_at(world_pos: Vector2) -> String:
	var c: Vector2i = cell_of(world_pos)
	return str(grid.get(c, TYPE_NONE))


## 世界坐标 -> 格坐标
func cell_of(world_pos: Vector2) -> Vector2i:
	return Vector2i(int(floor(world_pos.x / tile)), int(floor(world_pos.y / tile)))


## 格坐标 -> 格中心世界坐标
func cell_center(c: Vector2i) -> Vector2:
	return Vector2((float(c.x) + 0.5) * tile, (float(c.y) + 0.5) * tile)


## 覆盖率（非空格占比，验收 ≥0.30）
func coverage() -> float:
	if cols <= 0 or rows <= 0:
		return 0.0
	return float(grid.size()) / float(cols * rows)


## 掩体格列表（流场墙 + 圆 vs AABB 碰撞用）
func cover_cells() -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for c: Variant in grid.keys():
		if not (c is Vector2i):
			continue
		if str(grid.get(c as Vector2i, "")) == TYPE_COVER:
			out.append(c as Vector2i)
	return out


## 火格每秒伤害（推荐默认 2 点/秒）
const FIRE_DPS: float = 2.0


## 单位在火格上的持续伤害查询
func fire_dps_at(world_pos: Vector2) -> float:
	return FIRE_DPS if type_at(world_pos) == TYPE_FIRE else 0.0


## 水格移速加成（唤雨者神权用，默认 +50%）
func speed_mul_at(world_pos: Vector2, is_rain_caller: bool) -> float:
	if is_rain_caller and type_at(world_pos) == TYPE_WATER:
		return 1.5
	return 1.0


## 圆形单位与掩体格的推出（Vector2 为值类型，必须返回新位置；调用方须把返回值写回实体坐标）
func resolve_cover_circle(pos: Vector2, radius: float) -> Vector2:
	var pushed: bool = false
	var c0: Vector2i = cell_of(pos - Vector2(radius, radius))
	var c1: Vector2i = cell_of(pos + Vector2(radius, radius))
	for cy: int in range(c0.y, c1.y + 1):
		for cx: int in range(c0.x, c1.x + 1):
			var c: Vector2i = Vector2i(cx, cy)
			if str(grid.get(c, TYPE_NONE)) != TYPE_COVER:
				continue
			var box: Rect2 = Rect2(Vector2(float(cx) * tile, float(cy) * tile), Vector2(tile, tile))
			var closest: Vector2 = pos.clamp(box.position, box.end)
			var d: Vector2 = pos - closest
			var dl: float = d.length()
			if dl < radius:
				if dl < 0.0001:
					# 圆心在掩体内：沿最短轴推出
					var to_center: Vector2 = box.get_center() - pos
					if absf(to_center.x) >= absf(to_center.y):
						pos.x -= signf(to_center.x) * (radius + 1.0)
					else:
						pos.y -= signf(to_center.y) * (radius + 1.0)
				else:
					pos += d.normalized() * (radius - dl)
				pushed = true
	return pos
