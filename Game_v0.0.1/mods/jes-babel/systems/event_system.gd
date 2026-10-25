## 《巴别回路》事件系统，纯逻辑 RefCounted，headless 可测。
## 数据真源 = cfg/srpg_events.json（chapter 分组 + options 双轨）。
class_name BabelEventSystem
extends RefCounted

## 待应用的选项效果列表
var pending_effects: Array[Dictionary] = []
## 当前选择的 boss 突变（未选择时为空字典）
var boss_mutation: Dictionary = {}
## 最近一次选择结果缓存
var last_choice: Dictionary = {}


func _init() -> void:
	pass


## 用默认值构建（测试入口）
static func create_default() -> BabelEventSystem:
	return BabelEventSystem.new()


## 按章节取事件组（随机取一个匹配组；无匹配返回 {}）
func pick(events: Array[Dictionary], chapter: int, rng: RandomNumberGenerator) -> Dictionary:
	var candidates: Array[Dictionary] = []
	for g: Dictionary in events:
		if int(g.get("chapter", 0)) == chapter:
			candidates.append(g)
	if candidates.is_empty():
		return {}
	return candidates[rng.randi_range(0, candidates.size() - 1)]


## 在组内按 track 选 option，记录 effects 与 boss_mutation；找不到返回 {}
func choose(group: Dictionary, track: String) -> Dictionary:
	boss_mutation = {}
	pending_effects.clear()
	last_choice = {}
	var opts: Variant = group.get("options")
	if not (opts is Array):
		return {}
	for o: Variant in opts as Array:
		if o is Dictionary and str((o as Dictionary).get("track", "")) == track:
			var opt: Dictionary = o as Dictionary
			last_choice = opt
			var fx: Variant = opt.get("effects")
			if fx is Array:
				for e: Variant in fx as Array:
					if e is Dictionary:
						pending_effects.append(e as Dictionary)
			var bm: Variant = opt.get("boss_mutation")
			if bm is Dictionary:
				boss_mutation = bm as Dictionary
			return opt
	return {}


## 应用效果到全队/棋盘；relic_hook 预留（如 relic_slot_add 转发圣物系统）。
func apply_effects(units: Array[BabelUnit], board: BabelBoard, relic_hook: Variant = null) -> void:
	for fx: Dictionary in pending_effects:
		var ftype: String = str(fx.get("type", ""))
		var value: int = int(fx.get("value", 0))
		match ftype:
			"team_shield":
				for u: BabelUnit in units:
					if u.alive and u.is_player:
						u.shield = mini(u.shield + value, u.shield_cap)
			"team_max_hp_add":
				for u2: BabelUnit in units:
					if u2.alive and u2.is_player:
						u2.max_hp = u2.max_hp + value
						u2.hp = u2.hp + value
			"team_atk_add":
				for u3: BabelUnit in units:
					if u3.alive and u3.is_player:
						u3.state["atk_bonus"] = int(u3.state.get("atk_bonus", 0)) + value
			"relic_slot_add":
				if relic_hook is Object:
					var hook: Object = relic_hook as Object
					if hook.has_method("call"):
						hook.call("add_relic_slot", value)
			"shop_price_add":
				if board != null:
					board.set_meta("shop_price_add", float(fx.get("value", 0.0)))
			"battle_start_stun":
				# 数值由 roll_stun_target 在开打时消费
				pass
			_:
				push_warning("[BabelEventSystem] 未支持的效果类型: %s" % [ftype])


## 渎神事件开打随机 1 名角色眩晕（由战斗层在开打时调用）
func roll_stun_target(units: Array[BabelUnit], rng: RandomNumberGenerator) -> BabelUnit:
	var alive: Array[BabelUnit] = []
	for u: BabelUnit in units:
		if u.alive and u.is_player:
			alive.append(u)
	if alive.is_empty():
		return null
	var target: BabelUnit = alive[rng.randi_range(0, alive.size() - 1)]
	target.state["stunned_rounds"] = 2
	return target
