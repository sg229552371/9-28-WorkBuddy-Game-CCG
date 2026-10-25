## 工匠服务系统：服务价格、品质提升、词条重掷与购买结果。
## 纯逻辑 RefCounted；默认从 res://cfg 读取，测试可注入配置。
class_name JesArtisan
extends RefCounted

var services: Dictionary = {}
var artisan_cfg: Dictionary = {}
var rng := RandomNumberGenerator.new()
var _warned_missing_chance := false

func _init(service_cfg: Dictionary = {}, pool_cfg: Dictionary = {}) -> void:
	services = service_cfg if not service_cfg.is_empty() else _load_dict("res://cfg/artisanServices.json")
	artisan_cfg = pool_cfg if not pool_cfg.is_empty() else _load_dict("res://cfg/artisan.json")
	rng.randomize()

func set_seed(seed_value: int) -> void:
	rng.seed = seed_value

func _load_dict(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_warning("[JesArtisan] 配置表不存在: " + path)
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed
	push_warning("[JesArtisan] 配置表格式错误: " + path)
	return {}

func service_config(service_id: String) -> Dictionary:
	var value: Variant = services.get(service_id, {})
	return value.duplicate(true) if value is Dictionary else {}

func service_cost(service_id: String, tier: int = 0) -> int:
	var cfg := service_config(service_id)
	if service_id == "qualityUp":
		var costs: Variant = cfg.get("costs", [])
		if costs is Array and not (costs as Array).is_empty():
			return int((costs as Array)[clampi(tier, 0, (costs as Array).size() - 1)])
	return int(cfg.get("cost", 0))

func can_afford(run: Dictionary, cost: int) -> bool:
	return int(run.get("coin", run.get("coins", 0))) >= maxi(cost, 0)

func spend(run: Dictionary, cost: int) -> bool:
	if cost < 0 or not can_afford(run, cost):
		return false
	if run.has("coin"):
		run["coin"] = int(run.get("coin", 0)) - cost
	else:
		run["coins"] = int(run.get("coins", 0)) - cost
	return true

func _success(chance: float) -> bool:
	return rng.randf() <= clampf(chance, 0.0, 1.0)

func _success_chance(cfg: Dictionary) -> float:
	if cfg.has("successChance"):
		return float(cfg["successChance"])
	if not _warned_missing_chance:
		push_warning("[JesArtisan] 服务未提供成功概率，按 1.0 处理")
		_warned_missing_chance = true
	return 1.0

## 品质提升一档；module 的 q/quality 均兼容，返回 {ok, msg, item}。
func quality_up(run: Dictionary, module: Dictionary) -> Dictionary:
	var old_q := int(module.get("q", module.get("quality", 0)))
	var vals: Variant = module.get("affix", {}).get("vals", [])
	var max_q := int(vals.size() - 1) if vals is Array and not (vals as Array).is_empty() else 0
	var cost := service_cost("qualityUp", old_q)
	if old_q >= max_q:
		return {"ok": false, "msg": "已是最高品质", "item": module}
	if not spend(run, cost):
		return {"ok": false, "msg": "金币不足", "item": module}
	if not _success(_success_chance(service_config("qualityUp"))):
		return {"ok": false, "msg": "强化失败", "item": module}
	module["q"] = old_q + 1
	if module.has("quality"):
		module["quality"] = old_q + 1
	_refresh_value(module)
	return {"ok": true, "msg": "品质提升成功", "item": module}

## 重掷词条档位，保留模块 id、品质和类型。
func reroll_module(run: Dictionary, module: Dictionary) -> Dictionary:
	var cfg := service_config("rerollModule")
	var cost := int(cfg.get("cost", 0))
	if not spend(run, cost):
		return {"ok": false, "msg": "金币不足", "item": module}
	var vals: Variant = module.get("affix", {}).get("vals", [])
	if vals is Array and not (vals as Array).is_empty():
		var idx := rng.randi_range(0, (vals as Array).size() - 1)
		module["value"] = (vals as Array)[idx]
		module["reroll_q"] = idx
	elif module.has("value"):
		push_warning("[JesArtisan] 物品缺少可重掷 vals，保留原值")
	return {"ok": true, "msg": "词条已重掷", "item": module}

func buy_insurance(run: Dictionary) -> Dictionary:
	var cost := service_cost("buyInsurance")
	if not spend(run, cost):
		return {"ok": false, "msg": "金币不足"}
	var count := int(run.get("insurance", 0)) + 1
	run["insurance"] = count
	return {"ok": true, "msg": "已购买保险", "count": count}

func roll_quality(weights: Array = []) -> int:
	var pool: Array = weights
	if pool.is_empty():
		var cfg := service_config("buyModule")
		var table: Variant = cfg.get("qualityWeights", {})
		if table is Dictionary:
			pool = [table.get("normal", 0), table.get("advanced", 0), table.get("epic", 0), table.get("divine", 0)]
	if pool.is_empty():
		return 0
	var total := 0.0
	for value in pool:
		total += maxf(float(value), 0.0)
	if total <= 0.0:
		return 0
	var roll := rng.randf() * total
	for i in range(pool.size()):
		roll -= maxf(float(pool[i]), 0.0)
		if roll <= 0.0:
			return i
	return pool.size() - 1

func buy_module(run: Dictionary, module_factory: Callable) -> Dictionary:
	var cost := service_cost("buyModule")
	if not spend(run, cost):
		return {"ok": false, "msg": "金币不足"}
	var item = module_factory.call(roll_quality())
	return {"ok": true, "msg": "已购买模块", "item": item}

func _refresh_value(item: Dictionary) -> void:
	var affix: Variant = item.get("affix", {})
	var vals: Variant = affix.get("vals", []) if affix is Dictionary else []
	if vals is Array and not (vals as Array).is_empty():
		var q := clampi(int(item.get("q", item.get("quality", 0))), 0, (vals as Array).size() - 1)
		item["value"] = (vals as Array)[q]
