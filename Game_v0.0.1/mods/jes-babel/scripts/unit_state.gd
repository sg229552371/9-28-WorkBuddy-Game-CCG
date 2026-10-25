## 《巴别回路》SRPG 单位状态，纯逻辑 RefCounted，headless 可测。
class_name BabelUnit
extends RefCounted

## 单位唯一标识
var unit_id: String = ""
## 是否玩家方
var is_player: bool = true
## 祭司职业 id（如 "jin"/"tong"/"pan"），敌人为 ""
var chief_id: String = ""
## 敌人图鉴 id，玩家单位为 ""
var enemy_id: String = ""
## 当前生命
var hp: int = 30
## 最大生命
var max_hp: int = 30
## 当前护盾
var shield: int = 0
## 护盾上限
var shield_cap: int = 6
## 当前格坐标（不在场上时为越界哨兵值）
var pos: Vector2i = Vector2i(0, 0)
## 朝向（4 向主轴）
var facing: Vector2i = Vector2i(0, 1)
## 本回合剩余移动格数
var move_left: int = 3
## 每回合移动上限
var move_max: int = 3
## 本回合是否已用技能/攻击
var acted: bool = false
## 是否存活
var alive: bool = true
## 承棺者·磐的侧向盾标记（侧面倍率 0.75）
var side_guard: bool = false
## 回合性状态：silenced_rounds/wet_hits/stunned_rounds/atk_bonus/atk_bonus_rounds
var state: Dictionary = {
	"silenced_rounds": 0,
	"wet_hits": 0,
	"stunned_rounds": 0,
	"atk_bonus": 0,
	"atk_bonus_rounds": 0,
}
## 技能冷却表：键 = 技能 id，值 = 剩余回合数
var cds: Dictionary = {}


## hp 变化（delta 可为负）
signal hp_changed(unit: Variant, delta: int)
## 单位死亡
signal unit_died(unit: Variant)


func _init(p_unit_id: String = "", p_is_player: bool = true) -> void:
	unit_id = p_unit_id
	is_player = p_is_player


## 从 cfg/srpg_rules.json 构建；缺表时回退默认值
static func create_from_cfg(p_unit_id: String, p_is_player: bool) -> BabelUnit:
	var base_hp: int = 30
	var move_n: int = 3
	var shield_cap_n: int = 6
	var rules: Variant = _read_cfg_table("srpg_rules")
	if rules is Dictionary:
		var rd: Dictionary = rules as Dictionary
		base_hp = int(rd.get("unit_base_hp", base_hp))
		move_n = int(rd.get("unit_move", move_n))
		shield_cap_n = int(rd.get("shield_cap", shield_cap_n))
	return _build(p_unit_id, p_is_player, base_hp, move_n, shield_cap_n)


## 用与策划书一致的默认值构建（测试入口，不依赖 Cfg autoload）
static func create_default(p_unit_id: String = "u1", p_is_player: bool = true) -> BabelUnit:
	return _build(p_unit_id, p_is_player, 30, 3, 6)


static func _build(p_unit_id: String, p_is_player: bool, base_hp: int, move_n: int, cap_n: int) -> BabelUnit:
	var u: BabelUnit = BabelUnit.new(p_unit_id, p_is_player)
	u.max_hp = base_hp
	u.hp = base_hp
	u.move_max = move_n
	u.move_left = move_n
	u.shield_cap = cap_n
	return u


static func _read_cfg_table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


## 是否可行动（未用技能、存活、未眩晕）
func can_act() -> bool:
	return (not acted) and alive and int(state.get("stunned_rounds", 0)) == 0


## 消耗 1 格移动
func consume_move() -> void:
	move_left = maxi(move_left - 1, 0)


## 消耗本回合技能/攻击
func consume_action() -> void:
	acted = true


## 受到生命变化（正=治疗，负=受伤）；死亡在此判定并广播
func apply_hp(delta: int) -> void:
	if not alive:
		return
	hp = clampi(hp + delta, 0, max_hp)
	hp_changed.emit(self, delta)
	if hp <= 0:
		alive = false
		unit_died.emit(self)


## 回合开始重置：移动恢复、行动复位、回合性状态倒计时递减
func reset_for_round() -> void:
	move_left = move_max
	acted = false
	if int(state.get("silenced_rounds", 0)) > 0:
		state["silenced_rounds"] = int(state["silenced_rounds"]) - 1
	if int(state.get("stunned_rounds", 0)) > 0:
		state["stunned_rounds"] = int(state["stunned_rounds"]) - 1
	if int(state.get("atk_bonus_rounds", 0)) > 0:
		state["atk_bonus_rounds"] = int(state["atk_bonus_rounds"]) - 1
		if int(state["atk_bonus_rounds"]) == 0:
			state["atk_bonus"] = 0
	for key: String in cds.keys():
		var left: int = int(cds[key])
		cds[key] = maxi(left - 1, 0)
