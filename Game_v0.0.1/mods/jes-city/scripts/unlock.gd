class_name CityUnlock
extends RefCounted
## 只读查询不落档；仅结晶主动解锁修改传入的存档快照。

const Tables = preload("res://mods/jes-city/scripts/city_mode.gd")

var rules: Dictionary
var heroes: Array
var starters: Array
var order: Array
var starter_count: int
var unlock_all: bool
var state_provider: Callable


func _init(tables: Dictionary = {}) -> void:
	rules = tables.get("unlockRules", Tables.read_config("unlockRules", {})).duplicate(true)
	heroes = tables.get("heroes", Tables.read_config("heroes", [])).duplicate(true)
	starters = tables.get("starterHeroIds", Tables.read_config("starterHeroIds", [])).duplicate()
	order = tables.get("unlockOrder", Tables.read_config("unlockOrder", [])).duplicate()
	starter_count = int(tables.get("starterCount", Tables.read_config("starterCount", 0)))
	unlock_all = bool(tables.get("testUnlockAllHeroes", Tables.read_config("testUnlockAllHeroes", false)))


func set_state_provider(provider: Callable) -> void:
	state_provider = provider


func _snapshot(snapshot: Dictionary) -> Dictionary:
	if not snapshot.is_empty() or not state_provider.is_valid():
		return snapshot
	var value: Variant = state_provider.call()
	return value if value is Dictionary else {}


func has_hero(hero_id: String) -> bool:
	for hero in heroes:
		if hero.get("id", "") == hero_id:
			return true
	return false


func is_unlocked(hero_id: String, snapshot: Dictionary = {}) -> bool:
	if not has_hero(hero_id):
		return false
	if unlock_all:
		return true
	if not starters.is_empty():
		if hero_id in starters:
			return true
	else:
		var index := order.find(hero_id)
		if index >= 0 and index < (starter_count if starter_count > 0 else order.size()):
			return true
	var state := _snapshot(snapshot)
	if state.get("unlockExtra", {}).get(hero_id, false):
		return true
	var rule: Dictionary = rules.get(hero_id, {})
	if rule.get("heroLv") is Dictionary:
		var condition: Dictionary = rule.heroLv
		var record: Dictionary = state.get("heroes", {}).get(condition.get("heroId", ""), {})
		return int(record.get("level", 1)) >= int(condition.get("lv", 1))
	return false


func unlocked_heroes(snapshot: Dictionary = {}) -> Array:
	var state := _snapshot(snapshot)
	var result: Array = []
	for hero in heroes:
		if is_unlocked(str(hero.id), state):
			result.append(hero.id)
	return result


func unlock_hero(hero_id: String, snapshot: Dictionary) -> bool:
	if is_unlocked(hero_id, snapshot):
		return true
	if not has_hero(hero_id):
		return false
	var cost := int(rules.get(hero_id, {}).get("crystal", 0))
	if cost <= 0 or int(snapshot.get("crystals", 0)) < cost:
		return false
	snapshot["crystals"] = int(snapshot.get("crystals", 0)) - cost
	if not snapshot.get("unlockExtra") is Dictionary:
		snapshot["unlockExtra"] = {}
	snapshot.unlockExtra[hero_id] = true
	return true


func rule_info(hero_id: String) -> Dictionary:
	var rule: Dictionary = rules.get(hero_id, {}).duplicate(true)
	if rule.has("heroLv"):
		rule["kind"] = "heroLv"
	elif rule.has("crystal"):
		rule["kind"] = "crystal"
	else:
		rule["kind"] = "none"
	rule["desc"] = rule.get("desc", "暂未解锁")
	return rule
