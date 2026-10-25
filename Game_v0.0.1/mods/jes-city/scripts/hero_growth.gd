class_name HeroGrowth
extends RefCounted
## 局外结晶升级与局内经验分开，避免把局内经验写成永久养成。

const Tables = preload("res://mods/jes-city/scripts/city_mode.gd")
const UnlockScript = preload("res://mods/jes-city/scripts/unlock.gd")

var unlock: RefCounted
var out_config: Dictionary
var exp_config: Dictionary
var role_config: Dictionary
var team_limit: int


func _init(tables: Dictionary = {}) -> void:
	unlock = UnlockScript.new(tables)
	out_config = tables.get("outLevel", Tables.read_config("outLevel", {})).duplicate(true)
	exp_config = tables.get("levelUp", Tables.read_config("levelUp", {})).get("curve", {}).duplicate(true)
	role_config = tables.get("heroRoles", Tables.read_config("heroRoles", {})).duplicate(true)
	var team_config: Dictionary = tables.get("team", Tables.read_config("team", {}))
	team_limit = maxi(0, int(team_config.get("maxSize", 0)))


func hero_definition(hero_id: String) -> Dictionary:
	for hero in unlock.heroes:
		if hero.id == hero_id:
			return hero.duplicate(true)
	return {}


func hero_level(hero_id: String, snapshot: Dictionary) -> int:
	return maxi(1, int(snapshot.get("heroes", {}).get(hero_id, {}).get("level", 1)))


func level_up_cost(hero_id: String, snapshot: Dictionary) -> int:
	if not unlock.has_hero(hero_id):
		return 0
	var level := hero_level(hero_id, snapshot)
	if level >= int(out_config.get("maxLevel", 1)):
		return 0
	var base := float(out_config.get("costBase", 0))
	var rate := float(out_config.get("growthRate", 0))
	if rate > 1:
		return int(floor(base * pow(rate, level - 1) + 0.5))
	Tables.warn_once("growthRate", "局外升级缺少有效指数配置，回落真源线性费用")
	return int(base + (level - 1) * float(out_config.get("costStep", 0)))


func level_up(hero_id: String, snapshot: Dictionary) -> bool:
	if not unlock.has_hero(hero_id):
		return false
	var level := hero_level(hero_id, snapshot)
	if level >= int(out_config.get("maxLevel", 1)):
		return false
	var cost := level_up_cost(hero_id, snapshot)
	if cost <= 0 or int(snapshot.get("crystals", 0)) < cost:
		return false
	snapshot["crystals"] = int(snapshot.get("crystals", 0)) - cost
	if not snapshot.get("heroes") is Dictionary:
		snapshot["heroes"] = {}
	var record: Dictionary = snapshot.heroes.get(hero_id, {}).duplicate(true)
	record["level"] = level + 1
	snapshot.heroes[hero_id] = record
	return true


func out_level_stats(hero_id: String, level: int) -> Dictionary:
	var hero := hero_definition(hero_id)
	if hero.is_empty():
		return {}
	var role: String = role_config.get("byHero", {}).get(hero_id, "")
	var growth: Dictionary = out_config.get("growthByRole", {}).get(role, out_config.get("growth", {}))
	var stages: Array = out_config.get("growthTable", [])
	var multiplier := 0.0
	if stages.is_empty():
		Tables.warn_once("growthTable", "局外成长缺少分段配置，回落真源线性成长")
		multiplier = maxi(0, level - 1)
	else:
		for target in range(2, level + 1):
			var mul := float(stages.back().get("mul", 1))
			for stage in stages:
				if target <= int(stage.get("upTo", 0)):
					mul = float(stage.get("mul", 1))
					break
			multiplier += mul if mul != 0 else 1.0
	var result := {}
	for key in ["hp", "atk", "def"]:
		result[key] = int(floor(float(hero.get(key, 0)) + float(growth.get(key, 0)) * multiplier + 0.5))
	return result


func exp_next_for(level: int) -> int:
	if exp_config.is_empty():
		Tables.warn_once("levelUp.curve", "经验曲线缺失，禁用经验升级")
		return 0
	var value := float(exp_config.get("base", 0)) * pow(float(exp_config.get("growth", 1)), maxi(1, level) - 1)
	if level <= int(exp_config.get("softCapLv", 0)):
		value *= float(exp_config.get("softCapMul", 1))
	return maxi(1, int(floor(value + 0.5)))


func gain_exp(run_state: Dictionary, amount: int) -> int:
	if amount <= 0 or exp_config.is_empty():
		return 0
	var level := maxi(1, int(run_state.get("lv", 1)))
	var cap := int(exp_config.get("maxLv", 1))
	if level >= cap:
		return 0
	var experience := maxi(0, int(run_state.get("exp", 0))) + amount
	var count := 0
	while level < cap:
		var needed := exp_next_for(level)
		if needed <= 0 or experience < needed:
			break
		experience -= needed
		level += 1
		count += 1
	run_state["lv"] = level
	run_state["expNext"] = exp_next_for(level)
	run_state["exp"] = 0 if level >= cap else experience
	return count


func is_hero_unlocked(hero_id: String, snapshot: Dictionary = {}) -> bool:
	return unlock.is_unlocked(hero_id, snapshot)


func unlock_hero(hero_id: String, snapshot: Dictionary) -> bool:
	return unlock.unlock_hero(hero_id, snapshot)


func add_to_team(hero_id: String, selected: Array, snapshot: Dictionary) -> bool:
	if selected.size() >= team_limit or hero_id in selected or not is_hero_unlocked(hero_id, snapshot):
		return false
	selected.append(hero_id)
	return true
