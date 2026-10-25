## 空间哈希网格 —— 逐函数对译 HTLM/js/core.js 的 SpatialHash（含 §5.45 autoCell/retune）
## 真源：HTLM/js/core.js 第 40 行起 + 文件末尾独立区块（2026-10-24 核对）
## 口径：整数键、clear 时 tick 自增不清零、去重标记用「帧序号×4096+查询序号」组合值。
class_name SpatialHash
extends RefCounted

var cell: int = 96
var _buckets: Dictionary = {}   # 键 = _key(cx,cy)，值 = Array[Object]
var tick: int = 0               # 帧序号：clear() 自增（不清零），让上一帧去重标记自然失效
var _q_seq: int = 0             # 查询序号：同帧多次查询互不干扰

func _init(cell_size: int = 96) -> void:
	cell = cell_size

## 整数键，避免字符串开销（真源同式；与真源一样要求 |cx|,|cy| < 2048）
func _key(cx: int, cy: int) -> int:
	return cx * 4096 + cy

func clear() -> void:
	_buckets.clear()
	tick += 1   # 真源口径：自增不清零

## 插入以 (x,y) 为圆心、r 为半径的对象（跨桶写入）
func insert(obj: Object, x: float, y: float, r: float) -> void:
	var c := float(cell)
	var x0 := int(floor((x - r) / c))
	var x1 := int(floor((x + r) / c))
	var y0 := int(floor((y - r) / c))
	var y1 := int(floor((y + r) / c))
	for cx in range(x0, x1 + 1):
		for cy in range(y0, y1 + 1):
			var k := _key(cx, cy)
			if not _buckets.has(k):
				_buckets[k] = []
			_buckets[k].append(obj)

## 查询圆邻域内的候选（去重后追加进 out 并返回 out）
## 去重标记存对象 meta（"_qh_tick"），语义与真源 o._qhTick 完全一致
func query(x: float, y: float, r: float, out: Array) -> Array:
	_q_seq += 1   # 真源 ++this._qSeq：先自增再拼标记
	var t := tick * 4096 + _q_seq
	out.clear()
	var c := float(cell)
	var x0 := int(floor((x - r) / c))
	var x1 := int(floor((x + r) / c))
	var y0 := int(floor((y - r) / c))
	var y1 := int(floor((y + r) / c))
	for cx in range(x0, x1 + 1):
		for cy in range(y0, y1 + 1):
			var b: Variant = _buckets.get(_key(cx, cy))
			if b == null:
				continue
			for o: Object in b:
				if int(o.get_meta("_qh_tick", -1)) != t:
					o.set_meta("_qh_tick", t)
					out.append(o)
	return out

## 自适应 cell（真源 §5.45）：按实体数量推荐桶尺寸
static func auto_cell(count: int) -> int:
	if count < 500:
		return 96
	if count < 1500:
		return 128
	return 192

## 档位变化才改 cell 并清空桶表（键随 cell 变化，旧桶一律丢弃）；返回是否变更
func retune(count: int) -> bool:
	var next := auto_cell(count)
	if next == cell:
		return false
	cell = next
	_buckets.clear()
	return true
