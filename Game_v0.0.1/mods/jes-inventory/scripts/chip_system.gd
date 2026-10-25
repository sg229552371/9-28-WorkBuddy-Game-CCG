## 芯片 / 模块系统：生成、网格镶嵌、连接套装、等级与数值修正。
## 纯逻辑 RefCounted，不依赖 Inventory 节点；网格可由调用方传入 Dictionary。
class_name JesChipSystem
extends RefCounted

var chips_cfg: Dictionary = {}
var module_defs: Array = []
var module_pool: Dictionary = {}
var module_slot: Dictionary = {}
var module_sets: Dictionary = {}
var module_level: Dictionary = {}
var rng := RandomNumberGenerator.new()

func _init(config: Dictionary = {}) -> void:
	chips_cfg = _dict_or_load(config.get("chips", {}), "res://cfg/chips.json")
	module_defs = _array_or_load(config.get("moduleDefs", []), "res://cfg/moduleDefs.json")
	module_pool = _dict_or_load(config.get("modulePool", {}), "res://cfg/modulePool.json")
	module_slot = _dict_or_load(config.get("moduleSlot", {}), "res://cfg/moduleSlot.json")
	module_sets = _dict_or_load(config.get("moduleSets", {}), "res://cfg/moduleSets.json")
	module_level = _dict_or_load(config.get("moduleLevel", {}), "res://cfg/moduleLevel.json")
	rng.randomize()

func set_seed(seed_value: int) -> void:
	rng.seed = seed_value

func _load(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		push_warning("[JesChipSystem] 配置表不存在: " + path)
		return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func _dict_or_load(value: Variant, path: String) -> Dictionary:
	if value is Dictionary and not (value as Dictionary).is_empty():
		return (value as Dictionary).duplicate(true)
	var parsed: Variant = _load(path)
	return parsed if parsed is Dictionary else {}

func _array_or_load(value: Variant, path: String) -> Array:
	if value is Array and not (value as Array).is_empty():
		return (value as Array).duplicate(true)
	var parsed: Variant = _load(path)
	return parsed if parsed is Array else []

func _find_def(def_id: String) -> Dictionary:
	for entry in module_defs:
		if entry is Dictionary and String(entry.get("id", "")) == def_id:
			return entry
	return {}

func _find_pool(def_id: String) -> Dictionary:
	for pool_name in ["valuePool", "behaviorPool"]:
		var pool: Variant = chips_cfg.get(pool_name, [])
		if pool is Array:
			for entry in pool:
				if entry is Dictionary and String(entry.get("id", "")) == def_id:
					return entry
	return {}

func make_module(def_id: String, quality: int = 0, level: int = 1) -> Dictionary:
	var def := _find_def(def_id)
	if def.is_empty():
		push_warning("[JesChipSystem] 未知模块定义: " + def_id)
		return {}
	var q := clampi(quality, 0, 3)
	var affix: Dictionary = def.get("affix", {})
	var vals: Array = affix.get("vals", [])
	var value: Variant = vals[q] if q < vals.size() else 0
	return {"uid": _next_uid(), "kind": "module", "defId": def_id, "name": def.get("name", def_id),
		"shape": def.get("shape", [1, 1]), "q": q, "quality": q, "lv": clampi(level, 1, max_level()),
		"affix": affix.duplicate(true), "tag": affix.get("tag", ""), "mode": affix.get("mode", "flat"), "value": value}

func make_chip(def_id: String, quality: int = 0, level: int = 1) -> Dictionary:
	var def := _find_pool(def_id)
	if def.is_empty():
		push_warning("[JesChipSystem] 未知芯片定义: " + def_id)
		return {}
	var q := clampi(quality, 0, 3)
	var is_behavior := def.has("behavior")
	var shape_cfg: Variant = chips_cfg.get("shapes", {}).get("behavior" if is_behavior else "value", [1, 1])
	var vals: Array = def.get("vals", [])
	var item := {"uid": _next_uid(), "kind": "chip", "defId": def_id, "name": def.get("name", def_id),
		"shape": shape_cfg, "q": q, "quality": q, "lv": clampi(level, 1, 9), "value": vals[q] if q < vals.size() else 0}
	if is_behavior:
		item["behavior"] = def.get("behavior", "")
	else:
		item["affix"] = {"tag": def.get("tag", ""), "mode": def.get("mode", "flat"), "vals": vals.duplicate()}
	return item

static var _uid: int = 1
func _next_uid() -> int:
	_uid += 1
	return _uid - 1

func max_level() -> int:
	return int(module_slot.get("maxLv", module_level.get("maxLv", 9)))

func level_value(item: Dictionary) -> float:
	var lv := clampi(int(item.get("lv", 1)), 1, max_level())
	var stage := 1
	var per_stage := maxi(int(module_level.get("perStage", 3)), 1)
	stage = clampi(int(ceil(float(lv) / float(per_stage))), 1, 3)
	return float(item.get("value", 0.0)) + float(stage - 1) * float(module_level.get("valueStep", 0.15))

## 在通用网格 Dictionary 中放置物品；支持 cells/items/cols/rows 字段。
func place_item(grid: Dictionary, item: Dictionary, x: int, y: int) -> bool:
	var shape: Array = item.get("shape", [1, 1])
	var w := maxi(int(shape[0]), 1)
	var h := maxi(int(shape[1]), 1)
	var cols := maxi(int(grid.get("cols", 0)), 1)
	var rows := maxi(int(grid.get("rows", 0)), 1)
	if x < 0 or y < 0 or x + w > cols or y + h > rows:
		return false
	var cells: Array = grid.get("cells", [])
	if cells.size() != cols * rows:
		cells.resize(cols * rows)
		grid["cells"] = cells
	for yy in range(y, y + h):
		for xx in range(x, x + w):
			if cells[yy * cols + xx] != null:
				return false
	for yy in range(y, y + h):
		for xx in range(x, x + w):
			cells[yy * cols + xx] = item
	item["x"] = x
	item["y"] = y
	var items: Array = grid.get("items", [])
	if not items.has(item):
		items.append(item)
	grid["items"] = items
	return true

func find_spot(grid: Dictionary, item: Dictionary) -> Vector2i:
	var cols := int(grid.get("cols", 0))
	var rows := int(grid.get("rows", 0))
	for y in range(rows):
		for x in range(cols):
			var copy := grid.duplicate(true)
			if place_item(copy, item.duplicate(true), x, y):
				return Vector2i(x, y)
	return Vector2i(-1, -1)

## 统计相邻同品质连接，并按 moduleSets 返回套装名称和数值效果。
func module_synergy(items: Array) -> Dictionary:
	var links := 0
	var active_ids: Dictionary = {}
	for item in items:
		if item is Dictionary:
			active_ids[String(item.get("defId", ""))] = item
	for i in range(items.size()):
		for j in range(i + 1, items.size()):
			var a: Dictionary = items[i]
			var b: Dictionary = items[j]
			if int(a.get("q", a.get("quality", 0))) != int(b.get("q", b.get("quality", 0))):
				continue
			if _adjacent(a, b):
				links += 1
	var sets: Array = []
	var effects: Array = []
	for set_id in module_sets:
		# 元数据键（如 removed: true）不是套装条目，非 Dictionary 一律跳过
		var set_entry: Variant = module_sets[set_id]
		if not set_entry is Dictionary:
			continue
		var s: Dictionary = set_entry
		var members: Array = s.get("members", [])
		var count := 0
		for member in members:
			if active_ids.has(String(member)):
				count += 1
		var bonuses: Dictionary = s.get("bonuses", {})
		if count >= members.size() and count > 0:
			sets.append(s.get("name", set_id))
			var bonus: Variant = bonuses.get(str(count), {})
			if bonus is Dictionary:
				effects.append(bonus.duplicate(true))
	return {"links": links, "sets": sets, "effects": effects}

func _adjacent(a: Dictionary, b: Dictionary) -> bool:
	var ax := int(a.get("x", 0)); var ay := int(a.get("y", 0))
	var bx := int(b.get("x", 0)); var by := int(b.get("y", 0))
	var aw := int(a.get("shape", [1, 1])[0]); var ah := int(a.get("shape", [1, 1])[1])
	var bw := int(b.get("shape", [1, 1])[0]); var bh := int(b.get("shape", [1, 1])[1])
	return (ax + aw == bx or bx + bw == ax) and not (ay + ah <= by or by + bh <= ay) or (ay + ah == by or by + bh == ay) and not (ax + aw <= bx or bx + bw <= ax)

## 数值型芯片/模块统一先加效应再乘；behavior 芯片不进入数值链。
func aggregate_affixes(items: Array, tag: String) -> Dictionary:
	var flat := 0.0
	var mult := 1.0
	for item in items:
		if not item is Dictionary or item.has("behavior"):
			continue
		var affix: Dictionary = item.get("affix", {})
		if String(affix.get("tag", item.get("tag", ""))) != tag:
			continue
		var value := float(item.get("value", 0.0))
		if String(affix.get("mode", item.get("mode", "flat"))) == "mult":
			mult *= 1.0 + value
		else:
			flat += value
	return {"flat": flat, "mult": mult}

func apply_mutate_number(target: Dictionary, tag: String, items: Array) -> Dictionary:
	var effect := aggregate_affixes(items, tag)
	if target.has(tag) and (target[tag] is float or target[tag] is int):
		target[tag] = (float(target[tag]) + float(effect["flat"])) * float(effect["mult"])
	return target

func behavior_effects(items: Array) -> Dictionary:
	var out: Dictionary = {}
	for item in items:
		if not item is Dictionary or not item.has("behavior"):
			continue
		var key := String(item["behavior"])
		var value := float(item.get("value", 0.0))
		if not out.has(key) or value > float(out[key].get("value", 0.0)):
			out[key] = {"type": key, "value": value}
	return out
