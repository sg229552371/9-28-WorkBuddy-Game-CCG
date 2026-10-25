# bhv_melee_swing（规格 §11 M2）：近战挥砍行为。
# 不认识具体宝石，只读行为计划。扇形范围判定在 M4 命中闭环接入。
class_name BhvMeleeSwing
extends RefCounted


## 从单条计划提取挥砍参数。
##
## P-26：范围扩大（area_mult）对近战生效——挥砍距离按倍率缩放。
## 量纲规则：倍率只作用于长度量纲（range），不作用于角度量纲（arc_deg 扇形不变宽）。
static func plan_to_swing(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var area_mult: float = float(plan.get(&"area_mult", 1.0))
	return {
		# 批次 A 判定形状化（D-43）：默认 sec = 与加形状前的隐含扇形逐位一致
		&"shape": StringName(params.get(&"shape", &"sec")),
		&"arc_deg": float(params.get(&"arc_deg", 90.0)),
		&"range": float(params.get(&"range", 80.0)) * area_mult,
		&"angle_deg": float(plan.get(&"angle_deg", 0.0)),
	}


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 melee 承诺对账）。
static func produced_params() -> Array:
	return [&"shape", &"arc_deg", &"range", &"angle_deg"]


## D-42：本行为消费的倍率型 stat。
static func consumed_stats() -> Array:
	return [&"area_size"]
