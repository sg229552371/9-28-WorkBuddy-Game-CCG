## 背包 / 网格仓储（P3 jes-inventory 模块）—— 逐函数对译 HTLM/js/items.js class Inventory
## 真源口径：网格 cells（cols*rows，存物品引用或 null）+ items 列表；
## 物品有占格尺寸（w×h），放置需全占格空闲且不越界；
## 同品质同 ID 可叠加（宝箱按 chestQualities 堆叠表、普通物品读自身 stack_max）；
## 负重统计 total_weight：宝箱按品质重量×数量，其余按物品自重×数量。
## 制作人拍板口径：临时背包 5 行×6 列、遗物背包 5 行×7 列（cfg/backpack.json 的 6×4 属旧数据，
## 运行时默认用 D-口径 5×6，保留构造参数作为配置覆盖口）。
## 物品体契约（Dictionary）：{ uid, kind, id, name, w, h, quality, affixes, weight, value, count? }
##   quality = 0白 / 1绿 / 2蓝 / 3紫 / 4金；affixes = Array[Dictionary]（词缀数组）。
## 命名铁律：函数与变量一律 ASCII，中文只进注释与字符串；本类纯逻辑、零节点依赖，可 headless 测试。
class_name JesInventory
extends RefCounted

const QUALITY_COUNT := 5

var cols: int = 6
var rows: int = 5
var id: String = ""
## cells[j * cols + i] = Dictionary（物品）或 null
var cells: Array = []
## 物品列表（与真源 items 数组同构）
var items: Array[Dictionary] = []
## 全局 UID 计数器（真源 let UID = 1）
static var _uid: int = 1

func _init(p_cols: int = 6, p_rows: int = 5, p_id: String = "") -> void:
	cols = maxi(p_cols, 1)
	rows = maxi(p_rows, 1)
	id = p_id
	cells.resize(cols * rows)
	for i in range(cells.size()):
		cells[i] = null

## 全局唯一 UID（真源 UID++）
static func next_uid() -> int:
	_uid += 1
	return _uid - 1

## ---- 物品占格尺寸读取（兼容 w/h 键与旧 shape 数组两种形态）----
static func item_w(it: Dictionary) -> int:
	if it.has("w"):
		return maxi(int(it["w"]), 1)
	var s: Variant = it.get("shape", [1, 1])
	if s is Array and (s as Array).size() >= 1:
		return maxi(int(s[0]), 1)
	return 1

static func item_h(it: Dictionary) -> int:
	if it.has("h"):
		return maxi(int(it["h"]), 1)
	var s: Variant = it.get("shape", [1, 1])
	if s is Array and (s as Array).size() >= 2:
		return maxi(int(s[1]), 1)
	return 1

## 越界判定（真源 inBounds）
func in_bounds(x: int, y: int, w: int, h: int) -> bool:
	return x >= 0 and y >= 0 and x + w <= cols and y + h <= rows

## 占格查询：返回第一个占用格的物品；ignore 用于「搬家时忽略自己」（真源 occupied）
func occupied(x: int, y: int, w: int, h: int, ignore: Variant = null) -> Variant:
	for j in range(y, y + h):
		for i in range(x, x + w):
			var c: Variant = cells[j * cols + i]
			if c != null and c != ignore:
				return c
	return null

func can_place(item: Dictionary, x: int, y: int, ignore: Variant = null) -> bool:
	var w := item_w(item)
	var h := item_h(item)
	return in_bounds(x, y, w, h) and occupied(x, y, w, h, ignore) == null

## 放置：成功则写占格与物品坐标并加入列表（真源 place）
func place(item: Dictionary, x: int, y: int) -> bool:
	if not can_place(item, x, y):
		return false
	var w := item_w(item)
	var h := item_h(item)
	for j in range(y, y + h):
		for i in range(x, x + w):
			cells[j * cols + i] = item
	item["inv"] = id
	item["x"] = x
	item["y"] = y
	items.append(item)
	return true

## 移除：清占格 + 从列表剔除 + 清物品坐标（真源 remove）
func remove_item(item: Dictionary) -> void:
	var w := item_w(item)
	var h := item_h(item)
	var ox := int(item.get("x", 0))
	var oy := int(item.get("y", 0))
	for j in range(oy, oy + h):
		for i in range(ox, ox + w):
			if i >= 0 and i < cols and j >= 0 and j < rows and cells[j * cols + i] == item:
				cells[j * cols + i] = null
	items.erase(item)
	item["inv"] = null

## 找任意空位（真源 findSpot）——返回 {x, y} 或空 Dictionary
func find_spot(item: Dictionary) -> Dictionary:
	var w := item_w(item)
	var h := item_h(item)
	for y in range(rows - h + 1):
		for x in range(cols - w + 1):
			if can_place(item, x, y):
				return { "x": x, "y": y }
	return {}

## 同品质叠加（真源 tryStackChest 6.3 + 通用化）：
##  ① 宝箱：kind=="chest" 且 stack_map[chestQ] 有 {stackMax, value} → 同品质宝箱 count+1、价值同步累加
##  ② 普通物品：自身 stack_max > 1 且已有同 id + 同 quality 且未满堆 → count+1
## 叠加成功返回 true（不占新格）。
func try_stack(item: Dictionary, stack_map: Dictionary = {}) -> bool:
	if item.get("kind", "") == "chest":
		var q: String = item.get("chestQ", "")
		var qdef: Dictionary = stack_map.get(q, {})
		if qdef.is_empty():
			return false
		for it in items:
			if it.get("kind", "") == "chest" and it.get("chestQ", "") == q \
					and int(it.get("count", 1)) < int(qdef.get("stackMax", 1)):
				it["count"] = int(it.get("count", 1)) + 1
				it["value"] = int(qdef.get("value", 0)) * int(it["count"])
				return true
		return false
	var stack_max := int(item.get("stack_max", 1))
	if stack_max <= 1:
		return false
	for it in items:
		if it.get("kind", "") == item.get("kind", "") \
				and it.get("id", "") == item.get("id", "") \
				and int(it.get("quality", 0)) == int(item.get("quality", 0)) \
				and int(it.get("count", 1)) < stack_max:
			it["count"] = int(it.get("count", 1)) + 1
			it["value"] = int(item.get("value", 0)) * int(it["count"])
			return true
	return false

## 总负重（真源 totalWeight）：宝箱按品质重量×数量，其余按自重×数量
func total_weight(stack_map: Dictionary = {}) -> int:
	var s := 0
	for it in items:
		if it.get("kind", "") == "chest":
			var qdef: Dictionary = stack_map.get(it.get("chestQ", ""), {})
			s += int(qdef.get("weight", 0)) * int(it.get("count", 1))
		else:
			s += int(it.get("weight", 0)) * maxi(int(it.get("count", 1)), 1)
	return s

## 入包便捷口（真源 grantItemToRun 的仓储侧）：先试叠加，再找空位放置；成功返回 true
func auto_add(item: Dictionary, stack_map: Dictionary = {}) -> bool:
	if try_stack(item, stack_map):
		return true
	var spot := find_spot(item)
	if spot.is_empty():
		return false
	return place(item, int(spot["x"]), int(spot["y"]))

## 一键整理（auto_arrange）：全部取出 → 按占格面积降序（大件优先）→ 逐件找位回填。
## 返回 true = 全部放回成功（同网格容量下理论上恒真）；false = 有物品放不回（保持已放回的部分）。
func auto_arrange(stack_map: Dictionary = {}) -> bool:
	if items.is_empty():
		return true
	var snapshot: Array[Dictionary] = []
	for it in items:
		snapshot.append(it)
	# 大件优先：面积降序，同面积按高降序（稳定填装，避免碎片化）
	snapshot.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var aa := item_w(a) * item_h(a)
		var bb := item_w(b) * item_h(b)
		if aa != bb:
			return aa > bb
		return item_h(a) > item_h(b))
	for it in snapshot:
		remove_item(it)
	for it in snapshot:
		if not auto_add(it, stack_map):
			return false
	return true

## 清空（测试 / 调试用）
func clear() -> void:
	for it in items.duplicate():
		remove_item(it)
