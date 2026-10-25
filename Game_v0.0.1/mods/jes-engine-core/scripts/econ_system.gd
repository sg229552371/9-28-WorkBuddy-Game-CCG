## 经济闭环：金币 source/sink、祭坛判定、诅咒、保险与死亡惩罚。
## 纯逻辑 RefCounted；所有数值从 cfg 表读取，run 仅使用 Dictionary。
class_name JesEconSystem
extends RefCounted

var altar_cfg: Dictionary = {}
var altar_judge_mul: float = 1.0
var curse_cfg: Dictionary = {}
var insurance_cfg: Dictionary = {}
var death_ratio: float = 0.0
var settle_cfg: Dictionary = {}
var chips_cfg: Dictionary = {}
var rng := RandomNumberGenerator.new()

func _init(config: Dictionary = {}) -> void:
	altar_cfg = _dict_or_load(config.get("altars", {}), "res://cfg/altars.json")
	altar_judge_mul = _number_or_load(config.get("altarJudgeMul", null), "res://cfg/altarJudgeMul.json", 1.0)
	curse_cfg = _dict_or_load(config.get("curseItems", {}), "res://cfg/curseItems.json")
	insurance_cfg = _dict_or_load(config.get("insurance", {}), "res://cfg/insurance.json")
	var penalty_cfg := _dict_or_load(config.get("deathPenalty", {}), "res://cfg/deathPenalty.json")
	death_ratio = float(penalty_cfg.get("loseRatio", 0.0))
	settle_cfg = _dict_or_load(config.get("settleConvert", {}), "res://cfg/settleConvert.json")
	chips_cfg = _dict_or_load(config.get("chips", {}), "res://cfg/chips.json")
	rng.randomize()

func set_seed(seed_value: int) -> void:
	rng.seed = seed_value

func _load(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		push_warning("[JesEconSystem] 配置表不存在: " + path)
		return null
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func _dict_or_load(value: Variant, path: String) -> Dictionary:
	if value is Dictionary and not (value as Dictionary).is_empty():
		return (value as Dictionary).duplicate(true)
	var parsed: Variant = _load(path)
	return parsed if parsed is Dictionary else {}

func _number_or_load(value: Variant, path: String, fallback: float) -> float:
	if value is float or value is int:
		return float(value)
	var parsed: Variant = _load(path)
	if parsed is float or parsed is int:
		return float(parsed)
	push_warning("[JesEconSystem] 数值配置缺失，使用保守默认值")
	return fallback

func _coin_key(run: Dictionary) -> String:
	return "coin" if run.has("coin") else "coins"

func balance(run: Dictionary) -> int:
	return int(run.get(_coin_key(run), 0))

func record_source(run: Dictionary, amount: int, source: String = "") -> int:
	var key := _coin_key(run)
	run[key] = balance(run) + maxi(amount, 0)
	var ledger: Array = run.get("econLedger", [])
	ledger.append({"kind": "source", "source": source, "amount": maxi(amount, 0)})
	run["econLedger"] = ledger
	return balance(run)

func record_sink(run: Dictionary, amount: int, sink: String = "") -> bool:
	var spend := maxi(amount, 0)
	if balance(run) < spend:
		return false
	var key := _coin_key(run)
	run[key] = balance(run) - spend
	var ledger: Array = run.get("econLedger", [])
	ledger.append({"kind": "sink", "sink": sink, "amount": spend})
	run["econLedger"] = ledger
	return true

## 按祭坛权重抽取；judge multiplier 只改变候选权重，不改变效果数值。
func judge_altar(weights: Dictionary = {}) -> String:
	var pool := weights if not weights.is_empty() else altar_cfg
	var ids: Array = []
	var values: Array = []
	var total := 0.0
	for id in pool:
		var entry: Variant = pool[id]
		var weight := float(entry.get("weight", 0)) if entry is Dictionary else float(entry)
		weight = maxf(weight * altar_judge_mul, 0.0)
		if weight > 0.0:
			ids.append(String(id)); values.append(weight); total += weight
	if ids.is_empty() or total <= 0.0:
		return ""
	var roll := rng.randf() * total
	for i in range(ids.size()):
		roll -= values[i]
		if roll <= 0.0:
			return ids[i]
	return ids.back()

func altar_effect(altar_id: String, run: Dictionary, context: Dictionary = {}) -> Dictionary:
	var cfg: Dictionary = altar_cfg.get(altar_id, {})
	var effects: Variant = cfg.get("effects", [])
	var result := {"ok": not cfg.is_empty(), "id": altar_id, "effects": []}
	if effects is Array:
		for effect in effects:
			if effect is Dictionary:
				var e: Dictionary = effect.duplicate(true)
				match String(e.get("type", "")):
					"heal":
						run["heal_pct"] = float(e.get("pct", 0.0))
					"giveInsurance":
						run["insurance"] = int(run.get("insurance", 0)) + int(e.get("count", 1))
				result["effects"].append(e)
	return result

func curse_defs() -> Array:
	var list: Variant = curse_cfg.get("list", [])
	return list if list is Array else []

func apply_curse(run: Dictionary, curse_id: String = "") -> Dictionary:
	var list := curse_defs()
	if list.is_empty():
		return {}
	var selected: Dictionary = {}
	for entry in list:
		if String(entry.get("id", "")) == curse_id:
			selected = entry.duplicate(true)
			break
	if selected.is_empty():
		selected = list[rng.randi_range(0, list.size() - 1)].duplicate(true)
	selected["remain"] = int(selected.get("duration", curse_cfg.get("duration", 0)))
	run["curse"] = selected
	return selected

func use_curse(run: Dictionary, curse_item: Dictionary, location: String = "main") -> bool:
	if location == "artisan" or location == "rift" or run.get("curse", null) != null:
		return false
	var curse := apply_curse(run, String(curse_item.get("curseId", "")))
	if curse.is_empty():
		return false
	var items: Array = run.get("backpack", [])
	if items is Array and items.has(curse_item):
		items.erase(curse_item)
		run["backpack"] = items
	return true

func tick_curse(run: Dictionary, delta: float) -> bool:
	var curse: Variant = run.get("curse", null)
	if not curse is Dictionary:
		return false
	curse["remain"] = float(curse.get("remain", 0.0)) - maxf(delta, 0.0)
	if float(curse["remain"]) <= 0.0:
		run["curse"] = null
		return true
	return false

func apply_curse_monster(monster: Dictionary, run: Dictionary) -> Dictionary:
	var curse: Variant = run.get("curse", null)
	if not curse is Dictionary:
		return monster
	var out := monster.duplicate(true)
	for pair in [["def", "defMul"], ["hp", "hpMul"], ["hpMax", "hpMul"], ["atk", "atkMul"], ["spd", "spdMul"]]:
		var key: String = pair[0]; var mul_key: String = pair[1]
		if out.has(key):
			out[key] = float(out[key]) * float(curse.get(mul_key, 1.0))
	if out.has("hp"):
		out["hp"] = roundi(float(out["hp"]))
	if out.has("hpMax"):
		out["hpMax"] = roundi(float(out["hpMax"]))
	return out

func curse_reward(value: float, run: Dictionary) -> int:
	var curse: Variant = run.get("curse", null)
	var mul := float(curse.get("rewardMul", 1.0)) if curse is Dictionary else 1.0
	return roundi(value * mul)

func make_insurance(count: int = 1) -> Dictionary:
	return {"kind": "insurance", "id": "insurance", "count": maxi(count, 1), "value": int(insurance_cfg.get("value", 0)), "weight": int(insurance_cfg.get("weight", 0))}

func consume_insurance(run: Dictionary) -> bool:
	var count := int(run.get("insurance", 0))
	if count <= 0:
		return false
	run["insurance"] = count - 1
	return true

## 结算：金币不折算；背包/武器/芯片按 valueRate，芯片按品质价值表。
func settle_convert(run: Dictionary) -> Dictionary:
	var rate := float(settle_cfg.get("valueRate", 0.5))
	var result := {"chest": 0, "gear": 0, "item": 0, "chip": 0}
	for item in _items_from(run.get("backpack", [])):
		var value := int(item.get("value", 0)) * maxi(int(item.get("count", 1)), 1)
		match String(item.get("kind", "")):
			"chest": result["chest"] += floori(value * rate)
			"insurance", "item": result["item"] += floori(value * rate)
			_: result["gear"] += floori(value * rate)
	for item in _items_from(run.get("weaponInv", [])):
		result["gear"] += floori(int(item.get("value", 0)) * rate)
	var values: Variant = chips_cfg.get("valueByQuality", [])
	for item in _items_from(run.get("chipInv", [])):
		if String(item.get("kind", "")) != "chip":
			continue
		var q := clampi(int(item.get("q", item.get("quality", 0))), 0, 3)
		var base := float(values[q]) if values is Array and q < values.size() else 0.0
		result["chip"] += floori(base * maxi(int(item.get("lv", 1)), 1) * rate)
	result["total"] = result["chest"] + result["gear"] + result["item"] + result["chip"]
	return result

func _items_from(value: Variant) -> Array:
	if value is Array:
		return value
	if value is Dictionary and value.has("items") and value["items"] is Array:
		return value["items"]
	return []

## 死亡损失：按 loseRatio 取整，芯片明确不进入损失清单；保险优先返还一件物品。
func death_penalty(run: Dictionary, items: Array = []) -> Dictionary:
	var source := items if not items.is_empty() else _items_from(run.get("backpack", []))
	var eligible: Array = []
	for item in source:
		if item is Dictionary and String(item.get("kind", "")) != "chip":
			eligible.append(item)
	var lose_count := clampi(int(floor(float(eligible.size()) * death_ratio)), 0, eligible.size())
	var lost: Array = []
	var returned: Array = []
	if consume_insurance(run) and not eligible.is_empty():
		returned.append(eligible.pop_front())
	lose_count = mini(lose_count, eligible.size())
	for i in range(lose_count):
		lost.append(eligible[i])
	return {"lost": lost, "returned": returned, "ratio": death_ratio}
