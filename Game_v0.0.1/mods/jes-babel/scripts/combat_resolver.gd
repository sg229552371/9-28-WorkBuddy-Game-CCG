## 《巴别回路》SRPG 伤害结算器，纯逻辑 RefCounted，headless 可测。
## 规则真源 = 策划书 §3.1/§3.3；数值可经 cfg 覆盖，默认值与策划书一致。
class_name BabelResolver
extends RefCounted

## 正面承伤倍率
var front_mul: float = 0.7
## 背面承伤倍率
var back_mul: float = 1.3
## 侧面承伤倍率
var side_mul: float = 1.0
## 磐（side_guard）侧面承伤倍率
var side_mul_coffin: float = 0.75
## 湿润标记每次受击加成
var wet_bonus: int = 3
## 超时保护每回合伤害增幅（第 26 回合起）
var overcap_step: float = 0.10
## 神罚倒计时起始回合
var punishment_start: int = 18
## 神罚每回合扣最大生命比例
var punishment_ratio: float = 0.10


## overrides 可覆盖以上任一数值（键同字段名）
func _init(overrides: Dictionary = {}) -> void:
	for key: String in overrides.keys():
		set(key, overrides[key])


## 从 cfg/srpg_rules.json 构建；缺表时回退默认值
static func create_from_cfg() -> BabelResolver:
	var rules: Variant = _read_cfg_table("srpg_rules")
	if rules is Dictionary:
		return BabelResolver.new(rules as Dictionary)
	return BabelResolver.new()


## 用与策划书一致的默认值构建（测试入口，不依赖 Cfg autoload）
static func create_default() -> BabelResolver:
	return BabelResolver.new()


static func _read_cfg_table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


## 伤害结算主流程。
## attacker == null 表示地形/火格来源，按侧面 1.0 处理。
## 返回 {"raw":int,"after_facing":int,"to_shield":int,"to_hp":int,"killed":bool}
func resolve_damage(attacker: Variant, target: Variant, base: int, board: BabelBoard) -> Dictionary:
	var t: BabelUnit = target as BabelUnit
	if t == null or not t.alive:
		return {"raw": 0, "after_facing": 0, "to_shield": 0, "to_hp": 0, "killed": false}
	var a: BabelUnit = null
	if attacker is BabelUnit:
		a = attacker as BabelUnit
	var mul: float = _facing_mul(a, t)
	var after_facing: int = maxi(int(floor(float(base) * mul)), 1)
	var wet_hits: int = int(t.state.get("wet_hits", 0))
	if wet_hits > 0:
		after_facing += wet_bonus
		t.state["wet_hits"] = wet_hits - 1
	var to_shield: int = mini(t.shield, after_facing)
	var to_hp: int = after_facing - to_shield
	if to_shield > 0:
		t.shield = maxi(t.shield - to_shield, 0)
	var killed: bool = false
	if to_hp > 0:
		var was_alive: bool = t.alive
		t.apply_hp(-to_hp)
		killed = was_alive and not t.alive
		if killed and board != null:
			board.remove_at(t.pos)
	return {"raw": base, "after_facing": after_facing, "to_shield": to_shield, "to_hp": to_hp, "killed": killed}


## 朝向倍率：攻击来源方向与 target.facing 同向=正面，反向=背面，垂直=侧面
func _facing_mul(attacker: BabelUnit, target: BabelUnit) -> float:
	if attacker == null:
		return side_mul
	var dir: Vector2i = target.pos - attacker.pos
	var facing: Vector2i = target.facing
	var dot: int = dir.x * facing.x + dir.y * facing.y
	if dot > 0:
		return front_mul
	if dot < 0:
		return back_mul
	if target.side_guard:
		return side_mul_coffin
	return side_mul


## 反伤：attacker 收到来自 target 方向的 reflect_value 点反伤（无 wet 加成）
func return_fire(attacker: Variant, target: Variant, reflect_value: int, board: BabelBoard) -> Dictionary:
	var a: Variant = attacker
	if a is BabelUnit and not (a as BabelUnit).alive:
		return {"raw": 0, "after_facing": 0, "to_shield": 0, "to_hp": 0, "killed": false}
	return resolve_damage(target, a, reflect_value, board)


## AoE：对每格上的单位逐个结算，返回各格结算结果
func apply_aoe(caster: Variant, cells: Array[Vector2i], base: int, board: BabelBoard) -> Array[Dictionary]:
	var results: Array[Dictionary] = []
	for cell: Vector2i in cells:
		if board == null:
			break
		var u: Variant = board.unit_at(cell)
		if u is BabelUnit:
			results.append(resolve_damage(caster, u, base, board))
	return results


## 超时保护倍率：round_idx > 25 时 1 + step * (round_idx - 25)
func overcap_mul(round_idx: int) -> float:
	if round_idx > 25:
		return 1.0 + overcap_step * float(round_idx - 25)
	return 1.0


## 神罚倒计时：round_idx >= 起始回合时，每个存活单位扣 max_hp * ratio（向上取整）
func apply_punishment(units: Array, round_idx: int) -> void:
	if round_idx < punishment_start:
		return
	var dmg: int = 0
	for u: Variant in units:
		if u is BabelUnit:
			var unit: BabelUnit = u as BabelUnit
			if unit.alive:
				dmg = int(ceil(float(unit.max_hp) * punishment_ratio))
				resolve_damage(null, unit, dmg, null)
