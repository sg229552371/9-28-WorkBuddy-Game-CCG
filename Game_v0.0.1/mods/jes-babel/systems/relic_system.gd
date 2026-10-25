## 《巴别回路》圣物系统，纯逻辑 RefCounted，headless 可测。
## 数值真源 = cfg/srpg_rules.json 的 relic_drop 段；缺省值与策划书一致。
class_name BabelRelicSystem
extends RefCounted

## 获得圣物时广播
signal relic_acquired(relic: Dictionary)

## 本局已获得圣物列表
var relics: Array[Dictionary] = []
## relic_drop 规则段（white_w/blue_w/gold_w/shop_gold_chance/blue_feedback_threshold/blue_feedback_event_bonus）
var rules: Dictionary = {}
## 蓝色反馈警告只发一次
var _warned_no_pool: bool = false


const DEF_WHITE_W: int = 70
const DEF_BLUE_W: int = 25
const DEF_GOLD_W: int = 5
const DEF_SHOP_GOLD_CHANCE: float = 0.12
const DEF_BLUE_FEEDBACK_THRESHOLD: int = 4
const DEF_BLUE_FEEDBACK_BONUS: float = 0.15


func _init(p_rules: Dictionary = {}) -> void:
	rules = p_rules


## 用与策划书一致的默认值构建（测试入口，不依赖 Cfg autoload）
static func create_default() -> BabelRelicSystem:
	return BabelRelicSystem.new({})


## 从 cfg/srpg_rules.json 的 relic_drop 段构建
static func create_from_cfg() -> BabelRelicSystem:
	var rules_table: Variant = _read_cfg_table("srpg_rules")
	if rules_table is Dictionary:
		var rd: Variant = (rules_table as Dictionary).get("relic_drop")
		if rd is Dictionary:
			return BabelRelicSystem.new(rd as Dictionary)
	return BabelRelicSystem.new({})


static func _read_cfg_table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


## 按权重抽稀有度；shop=true 时金权重升为 shop_gold_chance*100，白权重相应下调
func roll_rarity(rng: RandomNumberGenerator, shop: bool) -> String:
	var w_gold: int = DEF_GOLD_W
	if shop:
		w_gold = int(round(float(rules.get("shop_gold_chance", DEF_SHOP_GOLD_CHANCE)) * 100.0))
	else:
		w_gold = int(rules.get("gold_w", DEF_GOLD_W))
	var w_blue: int = int(rules.get("blue_w", DEF_BLUE_W))
	var w_white: int = maxi(100 - w_blue - w_gold, 1)
	var roll: int = rng.randi_range(1, 100)
	if roll <= w_white:
		return "white"
	if roll <= w_white + w_blue:
		return "blue"
	return "gold"


## 先稀有度后同稀有度均匀抽取，排除已持有；全满时返回 {}
func roll_relic(rng: RandomNumberGenerator, pool: Array[Dictionary], shop: bool) -> Dictionary:
	var rarity: String = roll_rarity(rng, shop)
	var owned: Array[String] = []
	for r: Dictionary in relics:
		owned.append(str(r.get("id", "")))
	var candidates: Array[Dictionary] = []
	for r: Dictionary in pool:
		if owned.has(str(r.get("id", ""))):
			continue
		if str(r.get("rarity", "white")) == rarity:
			candidates.append(r)
	if candidates.is_empty():
		for r: Dictionary in pool:
			if not owned.has(str(r.get("id", ""))):
				candidates.append(r)
	if candidates.is_empty():
		if not _warned_no_pool:
			push_warning("[BabelRelicSystem] 圣物池已抽空")
			_warned_no_pool = true
		return {}
	var pick: Dictionary = candidates[rng.randi_range(0, candidates.size() - 1)]
	return pick


## 登记圣物并广播
func add_relic(relic: Dictionary) -> void:
	relics.append(relic)
	relic_acquired.emit(relic)


## 蓝色圣物计数
func count_blue() -> int:
	var n: int = 0
	for r: Dictionary in relics:
		if str(r.get("rarity", "white")) == "blue":
			n += 1
	return n


## 蓝色反馈是否激活（蓝 ≥ 阈值）
func blue_feedback_active() -> bool:
	return count_blue() >= int(rules.get("blue_feedback_threshold", DEF_BLUE_FEEDBACK_THRESHOLD))


## 渎神事件率修正：激活时 +blue_feedback_event_bonus，否则 0
func get_blasphemy_bonus() -> float:
	if blue_feedback_active():
		return float(rules.get("blue_feedback_event_bonus", DEF_BLUE_FEEDBACK_BONUS))
	return 0.0


## 把圣物效果分派到目标（target 通常为 BabelUnit，可为 null 表示全队/全局）。
## 返回 {"ok": bool, "applied": Array[String]}；未支持类型只 push_warning 不崩。
func apply_effect(relic: Dictionary, target: Variant, board: Variant) -> Dictionary:
	var effect: Variant = relic.get("effect")
	if not (effect is Dictionary):
		push_warning("[BabelRelicSystem] 圣物缺少 effect: %s" % [str(relic.get("id", "?"))])
		return {"ok": false, "applied": []}
	var eff: Dictionary = effect as Dictionary
	var etype: String = str(eff.get("type", ""))
	var params: Variant = eff.get("params")
	var pm: Dictionary = {}
	if params is Dictionary:
		pm = params as Dictionary
	var applied: Array[String] = []
	match etype:
		"stat_add":
			applied = _apply_stat_add(pm, target)
		"shield_cap":
			if target is BabelUnit:
				var u: BabelUnit = target as BabelUnit
				u.shield_cap = int(pm.get("shield_cap", u.shield_cap))
				applied.append("shield_cap")
		"move_override":
			if target is BabelUnit:
				(target as BabelUnit).state["move_override"] = pm
				applied.append("move_override")
		"trigger":
			if target is BabelUnit:
				var u2: BabelUnit = target as BabelUnit
				var triggers: Variant = u2.state.get("relic_triggers")
				if not (triggers is Array):
					triggers = []
					u2.state["relic_triggers"] = triggers
				(triggers as Array).append({"id": str(relic.get("id", "")), "params": pm})
				applied.append("trigger")
		"split_damage", "passive_override", "sacrifice_redirect":
			if target is BabelUnit:
				(target as BabelUnit).state["relic_" + etype] = pm
			applied.append(etype)
		_:
			push_warning("[BabelRelicSystem] 未支持的 effect.type: %s" % [etype])
			return {"ok": false, "applied": []}
	return {"ok": true, "applied": applied}


## stat_add 参数映射到 BabelUnit 字段/state；team_* 键作用于单目标（调用方逐个传全队）
func _apply_stat_add(pm: Dictionary, target: Variant) -> Array[String]:
	var applied: Array[String] = []
	if not (target is BabelUnit):
		return applied
	var u: BabelUnit = target as BabelUnit
	for key: String in pm.keys():
		var v: int = int(pm.get(key, 0))
		match key:
			"melee_dmg_add", "ranged_dmg_add", "skill_dmg_add", "cd_reduce", "push_bonus", "shield_start":
				u.state[key] = int(u.state.get(key, 0)) + v
				applied.append(key)
			"shield_cap", "shield_cap_add":
				u.shield_cap = u.shield_cap + v
				applied.append(key)
			"team_hp_add", "max_hp_add":
				u.max_hp = u.max_hp + v
				u.hp = u.hp + v
				applied.append(key)
			"move_add":
				u.move_max = u.move_max + v
				u.move_left = u.move_left + v
				applied.append(key)
			"atk_add", "atk_bonus":
				u.state["atk_bonus"] = int(u.state.get("atk_bonus", 0)) + v
				applied.append(key)
			_:
				push_warning("[BabelRelicSystem] 未支持的 stat_add 键: %s" % [key])
	return applied
