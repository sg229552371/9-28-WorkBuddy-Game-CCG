## 《巴别回路》敌方 AI，纯逻辑 RefCounted，headless 可测。
## 敌人配置（traits/params/dmg）存于 unit.state 的 "traits"/"params"/"dmg" 键，
## 由 build_enemy() 或调用方装配。
class_name BabelEnemyAI
extends RefCounted

## 敌人决策完成后广播
signal enemy_act(enemy: Variant, plan: Dictionary)

## cfg trait 名 -> 内部 trait 名别名
const TRAIT_ALIASES: Dictionary = {
	"post_move_aoe": "aoe3x3",
	"phase_move": "phase_through",
	"smoke_terrain": "smoke",
	"guard_aura": "altar_guard",
	"flank": "backstab",
	"bell_knockback": "shockwave",
}


func _init() -> void:
	pass


## 用默认值构建（测试入口）
static func create_default() -> BabelEnemyAI:
	return BabelEnemyAI.new()


## 从敌人 cfg 条目装配 BabelUnit（traits/params 存入 state）
static func build_enemy(p_unit_id: String, cfg_entry: Dictionary) -> BabelUnit:
	var u: BabelUnit = BabelUnit.create_default(p_unit_id, false)
	var hp: int = int(cfg_entry.get("hp", 10))
	u.max_hp = hp
	u.hp = hp
	var mv: int = int(cfg_entry.get("move", 2))
	u.move_max = mv
	u.move_left = mv
	u.enemy_id = str(cfg_entry.get("id", ""))
	var traits: Variant = cfg_entry.get("traits")
	var tl: Array[String] = []
	if traits is Array:
		for t: Variant in traits as Array:
			tl.append(_alias(str(t)))
	u.state["traits"] = tl
	u.state["params"] = cfg_entry.get("params", {})
	u.state["dmg"] = int(cfg_entry.get("dmg", 0))
	return u


static func _alias(t: String) -> String:
	return str(TRAIT_ALIASES.get(t, t))


## 敌人是否拥有某内部 trait
static func has_trait(enemy: BabelUnit, trait_name: String) -> bool:
	var traits: Variant = enemy.state.get("traits")
	if traits is Array:
		return (traits as Array).has(trait_name)
	return false


static func params_of(enemy: BabelUnit) -> Dictionary:
	var p: Variant = enemy.state.get("params")
	if p is Dictionary:
		return p as Dictionary
	return {}


## 通用决策：选最近玩家 -> 贪心直线移动（先横后纵，被占格跳过）->
## 进入近战范围（manhattan<=1）则攻击，否则待命。特性分支见各函数。
func decide_action(enemy: BabelUnit, board: BabelBoard, players: Array[BabelUnit]) -> Dictionary:
	var plan: Dictionary = {"action": "wait"}
	if enemy == null or not enemy.alive or board == null or players.is_empty():
		enemy_act.emit(enemy, plan)
		return plan
	enemy.move_left = enemy.move_max
	var target: BabelUnit = nearest_player(enemy, board, players)
	if target == null:
		enemy_act.emit(enemy, plan)
		return plan
	# summoner：到点召唤，替换本回合其余行动
	if has_trait(enemy, "summoner"):
		var s_plan: Dictionary = _try_summon(enemy, board)
		if not s_plan.is_empty():
			enemy_act.emit(enemy, s_plan)
			return s_plan
	# shockwave：到点震退相邻单位，替换本回合其余行动
	if has_trait(enemy, "shockwave"):
		var sw_plan: Dictionary = _try_shockwave(enemy, board)
		if not sw_plan.is_empty():
			enemy_act.emit(enemy, sw_plan)
			return sw_plan
	# aura_shield：不攻击，给相邻敌加盾
	if has_trait(enemy, "aura_shield"):
		var a_plan: Dictionary = _aura_shield(enemy, board)
		enemy_act.emit(enemy, a_plan)
		return a_plan
	# pull：玩家已处拉拽射程（且不相邻）时优先拉拽，不再靠近
	if has_trait(enemy, "pull"):
		var pre_dist: int = board.manhattan(enemy.pos, target.pos)
		if pre_dist > 1 and pre_dist <= int(params_of(enemy).get("pull_range", 3)):
			var p_pre: Dictionary = _try_pull(enemy, board, target)
			if not p_pre.is_empty():
				enemy_act.emit(enemy, p_pre)
				return p_pre
	# 移动（phase_through 可穿单位）
	var from: Vector2i = enemy.pos
	var to: Vector2i = _greedy_move(enemy, board, target.pos)
	if to != from:
		board.move_unit(enemy, to)
	# heal_aura：移动后为半径内其他敌回复
	if has_trait(enemy, "heal_aura"):
		_apply_heal_aura(enemy, board)
	plan["from"] = from
	plan["to"] = to
	# 移动后判定攻击
	var dist: int = board.manhattan(enemy.pos, target.pos)
	if dist <= 1:
		plan["action"] = "attack"
		plan["target"] = target
		plan["dmg"] = int(enemy.state.get("dmg", 0))
	elif has_trait(enemy, "aoe3x3"):
		plan["action"] = "aoe"
		plan["cells"] = board.cells_in_shape("3x3", enemy.pos, Vector2i(1, 0), 0)
		plan["center_dmg"] = int(params_of(enemy).get("aoe_center_dmg", 0))
		plan["edge_dmg"] = int(params_of(enemy).get("aoe_edge_dmg", 0))
	elif has_trait(enemy, "pull"):
		var p_plan: Dictionary = _try_pull(enemy, board, target)
		if not p_plan.is_empty():
			enemy_act.emit(enemy, p_plan)
			return p_plan
	enemy_act.emit(enemy, plan)
	return plan


## 最近玩家（manhattan 最小，平手取先到者）
static func nearest_player(enemy: BabelUnit, board: BabelBoard, players: Array[BabelUnit]) -> BabelUnit:
	var best: BabelUnit = null
	var best_d: int = 999999
	for p: BabelUnit in players:
		if not p.alive:
			continue
		var d: int = board.manhattan(enemy.pos, p.pos)
		if d < best_d:
			best_d = d
			best = p
	return best


## 直线贪心：每步先横后纵，目标格被占/越界则尝试另一轴，都失败则停步。
## phase_through 可穿过被占格（落点仍须为空格）。
func _greedy_move(enemy: BabelUnit, board: BabelBoard, goal: Vector2i) -> Vector2i:
	var phase: bool = has_trait(enemy, "phase_through")
	var pos: Vector2i = enemy.pos
	var steps: int = enemy.move_left
	var last_free: Vector2i = pos
	for i: int in range(steps):
		var dx: int = signi(goal.x - pos.x)
		var dy: int = signi(goal.y - pos.y)
		var moved: bool = false
		# 先横后纵
		if dx != 0:
			var cand: Vector2i = pos + Vector2i(dx, 0)
			if _step_ok(board, cand, phase):
				pos = cand
				moved = true
		if not moved and dy != 0:
			var cand2: Vector2i = pos + Vector2i(0, dy)
			if _step_ok(board, cand2, phase):
				pos = cand2
				moved = true
		if not moved:
			break
		if not board.units.has(pos):
			last_free = pos
	return last_free


## 单步可行性：界内；非 phase_through 不得落在占格；phase_through 可视为穿过
func _step_ok(board: BabelBoard, cand: Vector2i, phase: bool) -> bool:
	if not board.in_bounds(cand):
		return false
	if board.units.has(cand):
		return phase
	return true


## aura_shield：相邻其他敌人 +params.aura_shield 盾（clamp 到各自 cap）
func _aura_shield(enemy: BabelUnit, board: BabelBoard) -> Dictionary:
	var amount: int = int(params_of(enemy).get("aura_shield", 2))
	var targets: Array[BabelUnit] = []
	for p: Vector2i in board.neighbors4(enemy.pos):
		var u: Variant = board.unit_at(p)
		if u is BabelUnit:
			var other: BabelUnit = u as BabelUnit
			if other.alive and not other.is_player and other != enemy:
				other.shield = mini(other.shield + amount, other.shield_cap)
				targets.append(other)
	return {"action": "aura_shield", "targets": targets, "amount": amount}


## heal_aura：半径内其他敌每回合回复
func _apply_heal_aura(enemy: BabelUnit, board: BabelBoard) -> void:
	var pm: Dictionary = params_of(enemy)
	var radius: int = int(pm.get("heal_radius", 2))
	var heal: int = int(pm.get("heal_per_round", 3))
	for u: Variant in board.units.values():
		if u is BabelUnit:
			var other: BabelUnit = u as BabelUnit
			if other != enemy and other.alive and not other.is_player:
				if board.manhattan(enemy.pos, other.pos) <= radius:
					other.apply_hp(heal)


## summoner：state.summon_cd 倒数，归零时返回召唤计划
func _try_summon(enemy: BabelUnit, board: BabelBoard) -> Dictionary:
	var pm: Dictionary = params_of(enemy)
	var interval: int = int(pm.get("summon_interval_rounds", 3))
	var cd: int = int(enemy.state.get("summon_cd", interval))
	if cd > 1:
		enemy.state["summon_cd"] = cd - 1
		return {}
	enemy.state["summon_cd"] = interval
	# 找身边空格
	var spot: Vector2i = Vector2i(-999, -999)
	for p: Vector2i in board.neighbors4(enemy.pos):
		if board.in_bounds(p) and not board.units.has(p):
			spot = p
			break
	return {
		"action": "summon",
		"unit": {"id": str(pm.get("summon_id", "EN01")), "hp": int(pm.get("summon_hp", 6)), "pos": spot},
	}


## shockwave：state.shockwave_cd 倒数，归零时震退相邻单位 1 格
func _try_shockwave(enemy: BabelUnit, board: BabelBoard) -> Dictionary:
	var pm: Dictionary = params_of(enemy)
	var cd_max: int = int(pm.get("bell_cooldown", 2))
	var cd: int = int(enemy.state.get("shockwave_cd", cd_max))
	if cd > 1:
		enemy.state["shockwave_cd"] = cd - 1
		return {}
	enemy.state["shockwave_cd"] = cd_max
	var pushed: Array[BabelUnit] = []
	for p: Vector2i in board.neighbors4(enemy.pos):
		var u: Variant = board.unit_at(p)
		if u is BabelUnit:
			var other: BabelUnit = u as BabelUnit
			var dir: Vector2i = p - enemy.pos
			var to: Vector2i = p + dir
			if board.in_bounds(to) and not board.units.has(to):
				board.move_unit(other, to)
			pushed.append(other)
	return {"action": "shockwave", "pushed": pushed, "cells": pushed.map(func(u2: BabelUnit) -> Vector2i: return u2.pos)}


## pull：最近玩家在 pull_range 内且不相邻时，拉到敌人朝向玩家一步的格子
func _try_pull(enemy: BabelUnit, board: BabelBoard, target: BabelUnit) -> Dictionary:
	var pm: Dictionary = params_of(enemy)
	var prange: int = int(pm.get("pull_range", 3))
	var dist: int = board.manhattan(enemy.pos, target.pos)
	if dist > prange or dist <= 1:
		return {}
	var dx: int = signi(target.pos.x - enemy.pos.x)
	var dy: int = signi(target.pos.y - enemy.pos.y)
	var step: Vector2i = Vector2i(dx, 0) if dx != 0 else Vector2i(0, dy)
	var to: Vector2i = enemy.pos + step
	if not board.in_bounds(to) or board.units.has(to):
		return {}
	var from: Vector2i = target.pos
	if not board.move_unit(target, to):
		return {}
	return {"action": "pull", "unit": target, "from": from, "to": to}


## front_block 正面承伤乘区（供 resolver 调用方乘算）
static func front_block_mul(enemy: BabelUnit) -> float:
	if has_trait(enemy, "front_block"):
		return float(params_of(enemy).get("front_block", 0.5))
	return 1.0


## backstab 背刺额外伤害（供 resolver 调用方加算）
static func backstab_bonus(enemy: BabelUnit) -> int:
	if has_trait(enemy, "backstab"):
		return int(params_of(enemy).get("backstab_dmg", 3))
	if has_trait(enemy, "flank"):
		return int(params_of(enemy).get("flank_bonus_dmg", 3))
	return 0


## smoke 死亡留烟格（供战斗层在死亡时调用）
static func on_death_cells(enemy: BabelUnit) -> Array[Dictionary]:
	if not has_trait(enemy, "smoke"):
		return []
	var pm: Dictionary = params_of(enemy)
	return [{
		"pos": enemy.pos,
		"rounds": int(pm.get("smoke_rounds", 2)),
		"dmg": int(pm.get("smoke_dmg", 2)),
	}]


## boss_dread 层数累加
static func add_dread(enemy: BabelUnit, stacks: int) -> void:
	enemy.state["dread_stacks"] = int(enemy.state.get("dread_stacks", 0)) + stacks


## boss_dread 当前伤害（每层 +mul）
static func boss_damage(enemy: BabelUnit) -> int:
	var base: int = int(enemy.state.get("dmg", 0))
	if not has_trait(enemy, "boss_dread"):
		return base
	var mul: float = float(params_of(enemy).get("dread_dmg_mul_per_stack", 0.1))
	var stacks: int = int(enemy.state.get("dread_stacks", 0))
	return int(round(float(base) * (1.0 + mul * float(stacks))))
