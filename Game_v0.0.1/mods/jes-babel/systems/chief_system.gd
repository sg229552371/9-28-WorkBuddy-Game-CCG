## 《巴别回路》六神权被动 + 祭司技能结算，纯逻辑 RefCounted，headless 可测。
## 被动真源 = cfg/srpg_chiefs.json 的 passive 段；create_default 内嵌同值默认表。
class_name BabelChiefSystem
extends RefCounted

## 祭司表（id -> 条目），passive/skills 从此查询
var chiefs: Dictionary = {}


const DEFAULT_CHIEFS: Array = [
	{"id": "CH_jin", "passive": {"type": "reflect_adjacent", "value": 2}, "skills": ["SK_PYRE", "SK_OFFER"]},
	{"id": "CH_tong", "passive": {"type": "far_damage_bonus", "value": 0.4, "range": 3}, "skills": ["SK_STARFALL", "SK_REWIND"]},
	{"id": "CH_pan", "passive": {"type": "side_guard", "value": 0.25}, "skills": ["SK_COFFIN_WALL", "SK_COFFIN_CHARGE"]},
	{"id": "CH_xi", "passive": {"type": "water_free_move"}, "skills": ["SK_TIDE", "SK_HOLY_RAIN"]},
	{"id": "CH_mo", "passive": {"type": "silence_aura", "value": 2}, "skills": ["SK_CUT_TONGUE", "SK_SHADOW_SWAP"]},
	{"id": "CH_man", "passive": {"type": "death_shield", "value": 1, "cap": 6}, "skills": ["SK_BONE_SPEAR", "SK_BONE_MAUSOLEUM"]},
]


func _init(p_chiefs: Array = DEFAULT_CHIEFS) -> void:
	for c: Variant in p_chiefs:
		if c is Dictionary:
			chiefs[str((c as Dictionary).get("id", ""))] = c as Dictionary


## 用与策划书一致的默认表构建（测试入口，不依赖 Cfg autoload）
static func create_default() -> BabelChiefSystem:
	return BabelChiefSystem.new(DEFAULT_CHIEFS)


## 从 cfg/srpg_chiefs.json 构建
static func create_from_cfg() -> BabelChiefSystem:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node is Object:
		var cfg_obj: Object = cfg_node as Object
		if cfg_obj.has_method("get_table"):
			var t: Variant = cfg_obj.call("get_table", "srpg_chiefs")
			if t is Array:
				return BabelChiefSystem.new(t as Array)
	return BabelChiefSystem.new(DEFAULT_CHIEFS)


## 取某祭司的被动段；无表返回 {}
static func passive_of(chiefs: Dictionary, chief_id: String) -> Dictionary:
	var c: Variant = chiefs.get(chief_id)
	if c is Dictionary:
		var p: Variant = (c as Dictionary).get("passive")
		if p is Dictionary:
			return p as Dictionary
	return {}


## 烬：相邻友军受击后反伤 value 点（返回 return_fire 结算）
func on_damage_taken(victim: BabelUnit, attacker: Variant, resolver: BabelResolver, board: BabelBoard) -> Dictionary:
	var p: Dictionary = passive_of(chiefs, victim.chief_id)
	if str(p.get("type", "")) != "reflect_adjacent":
		return {"raw": 0, "after_facing": 0, "to_shield": 0, "to_hp": 0, "killed": false}
	return resolver.return_fire(attacker, victim, int(p.get("value", 2)), board)


## 瞳：与攻击目标距离 ≥range 时伤害 ×(1+value)；否则 ×1
func damage_bonus(attacker: BabelUnit, target: BabelUnit, board: BabelBoard) -> float:
	var p: Dictionary = passive_of(chiefs, attacker.chief_id)
	if str(p.get("type", "")) != "far_damage_bonus":
		return 1.0
	var rng_n: int = int(p.get("range", 3))
	if board.manhattan(attacker.pos, target.pos) >= rng_n:
		return 1.0 + float(p.get("value", 0.4))
	return 1.0


## 磐：覆盖 unit 的侧向盾标记
func apply_unit_mod(unit: BabelUnit) -> void:
	var p: Dictionary = passive_of(chiefs, unit.chief_id)
	if str(p.get("type", "")) == "side_guard":
		unit.side_guard = true


## 汐：目标格 terrain=water 时移动不耗 move_left（供 try_move 钩子）
func can_free_move(unit: BabelUnit, board: BabelBoard, to: Vector2i) -> bool:
	var p: Dictionary = passive_of(chiefs, unit.chief_id)
	if str(p.get("type", "")) != "water_free_move":
		return false
	return board.terrain_at(to) == "water"


## 默：敌人距任一沉默光环祭司 ≤value 格时视作被沉默
static func is_silenced(enemy: BabelUnit, players: Array[BabelUnit], chiefs: Dictionary) -> bool:
	for u: BabelUnit in players:
		if not u.alive or u.is_player == false:
			continue
		var p: Dictionary = passive_of(chiefs, u.chief_id)
		if str(p.get("type", "")) == "silence_aura":
			var rng_n: int = int(p.get("value", 2))
			var dist: int = absi(enemy.pos.x - u.pos.x) + absi(enemy.pos.y - u.pos.y)
			if dist <= rng_n:
				return true
	return false


## 蔓：敌死时随机存活友军 +1 盾（≤cap）。返回获得盾的单位或 null。
func on_enemy_died(players: Array[BabelUnit], rng: RandomNumberGenerator) -> Variant:
	var holder: BabelUnit = null
	var cap: int = 0
	var value: int = 0
	for u: BabelUnit in players:
		if not u.alive:
			continue
		var p: Dictionary = passive_of(chiefs, u.chief_id)
		if str(p.get("type", "")) == "death_shield":
			holder = u
			cap = int(p.get("cap", u.shield_cap))
			value = int(p.get("value", 1))
			break
	if holder == null:
		return null
	var alive_list: Array[BabelUnit] = []
	for u2: BabelUnit in players:
		if u2.alive:
			alive_list.append(u2)
	if alive_list.is_empty():
		return null
	var target: BabelUnit = alive_list[rng.randi_range(0, alive_list.size() - 1)]
	target.shield = mini(target.shield + value, cap)
	return target


## 技能施放主入口。targets 为目标格坐标数组；options 可带 {"sacrifice_redirect": bool, "corpses": int}。
## 返回各阶段结算结果数组；SK_REWIND/召唤类返回计划由外部执行。
func execute_skill(skill: Dictionary, caster: BabelUnit, targets: Array, board: BabelBoard, resolver: BabelResolver, units: Array[BabelUnit], options: Dictionary = {}) -> Array[Dictionary]:
	var results: Array[Dictionary] = []
	if board == null or caster == null or not caster.alive:
		return results
	var skill_id: String = str(skill.get("id", ""))
	var pm: Variant = skill.get("params")
	var params: Dictionary = {}
	if pm is Dictionary:
		params = pm as Dictionary
	var origin: Vector2i = caster.pos
	if not targets.is_empty() and targets[0] is Vector2i:
		origin = targets[0] as Vector2i
	var dir: Vector2i = Vector2i(signi(origin.x - caster.pos.x), signi(origin.y - caster.pos.y))
	if dir == Vector2i.ZERO:
		dir = Vector2i(1, 0)
	match skill_id:
		"SK_PYRE":
			var cells: Array[Vector2i] = board.cells_in_shape(str(skill.get("shape", "cross")), origin, dir, int(skill.get("range", 1)))
			for c: Vector2i in cells:
				board.set_terrain(c, "fire")
			results.append({"action": "terrain_fire", "cells": cells})
		"SK_OFFER":
			results.append(_skill_offer(skill, caster, units, board, resolver, options, params))
		"SK_REWIND":
			var u: Variant = board.unit_at(origin)
			results.append({"action": "rewind", "unit": u})
		"SK_COFFIN_WALL":
			results.append(_skill_coffin_wall(origin, board, params))
		"SK_COFFIN_CHARGE":
			results.append(_skill_coffin_charge(skill, caster, board, resolver, dir))
		"SK_TIDE":
			results.append(_skill_tide(skill, caster, board, dir))
		"SK_HOLY_RAIN":
			results.append(_skill_holy_rain(skill, origin, board, params))
		"SK_CUT_TONGUE":
			var u2: Variant = board.unit_at(origin)
			if u2 is BabelUnit:
				var enemy: BabelUnit = u2 as BabelUnit
				enemy.state["silenced_rounds"] = int(params.get("silence_rounds", 2))
				results.append({"action": "silence", "unit": enemy, "rounds": int(params.get("silence_rounds", 2))})
		"SK_SHADOW_SWAP":
			results.append(_skill_shadow_swap(origin, caster, board, params))
		"SK_BONE_MAUSOLEUM":
			var corpses: int = int(options.get("corpses", 0))
			results.append({"action": "summon", "count": corpses, "unit": {"hp": int(params.get("bone_hp", 3))}})
		_:
			# 通用伤害形状：按 shape 取格后 AoE 结算
			var shape: String = str(skill.get("shape", "single"))
			var cells2: Array[Vector2i] = board.cells_in_shape(shape, origin, dir, int(skill.get("range", 1)))
			var base: int = int(skill.get("value", 0))
			var res: Array[Dictionary] = resolver.apply_aoe(caster, cells2, base, board)
			results.append({"action": "damage", "cells": cells2, "results": res})
	return results


## 献祭：自损 self_loss_hp，全队 atk_bonus；sacrifice_redirect 开启时改为对敌方全体等量伤害
func _skill_offer(skill: Dictionary, caster: BabelUnit, units: Array[BabelUnit], board: BabelBoard, resolver: BabelResolver, options: Dictionary, params: Dictionary) -> Dictionary:
	var loss: int = int(params.get("self_loss_hp", 5))
	var redirect: bool = bool(options.get("sacrifice_redirect", false))
	var team_add: int = int(params.get("team_atk_add", 2))
	var rounds: int = int(params.get("buff_rounds", 1))
	if redirect:
		var hits: Array[Dictionary] = []
		for u: BabelUnit in units:
			if u.alive and not u.is_player:
				hits.append(resolver.resolve_damage(caster, u, loss, board))
		return {"action": "offer", "redirected": true, "hits": hits}
	caster.apply_hp(-loss)
	for u2: BabelUnit in units:
		if u2.alive and u2.is_player:
			u2.state["atk_bonus"] = int(u2.state.get("atk_bonus", 0)) + team_add
			u2.state["atk_bonus_rounds"] = int(u2.state.get("atk_bonus_rounds", 0)) + rounds
	return {"action": "offer", "redirected": false, "self_loss": loss, "team_add": team_add}


## 棺墙：目标格及相邻空格放 cover_count 格掩体
func _skill_coffin_wall(origin: Vector2i, board: BabelBoard, params: Dictionary) -> Dictionary:
	var count: int = int(params.get("cover_count", 2))
	var hp: int = int(params.get("cover_hp", 20))
	var placed: Array[Vector2i] = []
	if board.in_bounds(origin) and not board.units.has(origin):
		board.set_terrain(origin, "cover", hp)
		placed.append(origin)
	for p: Vector2i in board.neighbors4(origin):
		if placed.size() >= count:
			break
		if board.in_bounds(p) and not board.units.has(p) and not placed.has(p):
			board.set_terrain(p, "cover", hp)
			placed.append(p)
	return {"action": "coffin_wall", "cells": placed, "hp": hp}


## 扛棺冲锋：直线上首个敌人受击并推 1 格；推不动则额外撞墙伤害
func _skill_coffin_charge(skill: Dictionary, caster: BabelUnit, board: BabelBoard, resolver: BabelResolver, dir: Vector2i) -> Dictionary:
	var params: Variant = skill.get("params")
	var pm: Dictionary = {}
	if params is Dictionary:
		pm = params as Dictionary
	var dmg: int = int(skill.get("value", 6))
	var wall_bonus: int = int(pm.get("wall_bonus_dmg", 6))
	var push_n: int = int(pm.get("push", 1))
	var cells: Array[Vector2i] = board.cells_in_shape("line", caster.pos, dir, int(skill.get("range", 1)))
	for c: Vector2i in cells:
		var u: Variant = board.unit_at(c)
		if u is BabelUnit:
			var enemy: BabelUnit = u as BabelUnit
			var res: Dictionary = resolver.resolve_damage(caster, enemy, dmg, board)
			var extra: int = 0
			var pushed_to: Vector2i = c
			var cur: Vector2i = c
			for i: int in range(push_n):
				var to: Vector2i = cur + dir
				if board.in_bounds(to) and not board.units.has(to) and board.move_unit(enemy, to):
					cur = to
					pushed_to = to
				else:
					extra += wall_bonus
					break
			if extra > 0:
				resolver.resolve_damage(caster, enemy, extra, board)
			return {"action": "coffin_charge", "target": enemy, "damage": res, "pushed_to": pushed_to, "wall_extra": extra}
	return {"action": "coffin_charge", "target": null, "damage": {"raw": 0}, "pushed_to": caster.pos, "wall_extra": 0}


## 潮涌：直线上敌人推离 push_n 格，撞墙停步
func _skill_tide(skill: Dictionary, caster: BabelUnit, board: BabelBoard, dir: Vector2i) -> Dictionary:
	var params: Variant = skill.get("params")
	var pm: Dictionary = {}
	if params is Dictionary:
		pm = params as Dictionary
	var push_n: int = int(pm.get("push", 2))
	var cells: Array[Vector2i] = board.cells_in_shape("line", caster.pos, dir, int(skill.get("range", 3)))
	var pushed: Array[Dictionary] = []
	for c: Vector2i in cells:
		var u: Variant = board.unit_at(c)
		if u is BabelUnit:
			var enemy: BabelUnit = u as BabelUnit
			var cur: Vector2i = c
			for i: int in range(push_n):
				var to: Vector2i = cur + dir
				if board.in_bounds(to) and not board.units.has(to) and board.move_unit(enemy, to):
					cur = to
				else:
					break
			pushed.append({"unit": enemy, "from": c, "to": enemy.pos})
	return {"action": "tide", "pushed": pushed}


## 圣雨：3×3 内敌人获得 wet_hits 标记
func _skill_holy_rain(skill: Dictionary, origin: Vector2i, board: BabelBoard, params: Dictionary) -> Dictionary:
	var wet_hits: int = int(params.get("wet_hits", 2))
	var cells: Array[Vector2i] = board.cells_in_shape(str(skill.get("shape", "3x3")), origin, Vector2i(1, 0), 0)
	var hit: Array[BabelUnit] = []
	for c: Vector2i in cells:
		var u: Variant = board.unit_at(c)
		if u is BabelUnit:
			var enemy: BabelUnit = u as BabelUnit
			if not enemy.is_player and enemy.alive:
				enemy.state["wet_hits"] = wet_hits
				hit.append(enemy)
	return {"action": "holy_rain", "wet_hits": wet_hits, "units": hit}


## 影替：与目标格友军换位，双方各 +swap_shield 盾（≤cap）
func _skill_shadow_swap(origin: Vector2i, caster: BabelUnit, board: BabelBoard, params: Dictionary) -> Dictionary:
	var u: Variant = board.unit_at(origin)
	if not (u is BabelUnit):
		return {"action": "shadow_swap", "ok": false}
	var other: BabelUnit = u as BabelUnit
	if other == caster:
		return {"action": "shadow_swap", "ok": false}
	var pa: Vector2i = caster.pos
	var pb: Vector2i = other.pos
	board.units.erase(pa)
	board.units.erase(pb)
	board.units[pb] = caster
	caster.pos = pb
	board.units[pa] = other
	other.pos = pa
	var shield_add: int = int(params.get("swap_shield", 5))
	for un: BabelUnit in [caster, other]:
		un.shield = mini(un.shield + shield_add, un.shield_cap)
	return {"action": "shadow_swap", "ok": true, "units": [caster, other]}
