# bhv_projectile（规格 §3.6 / M2）：投射物行为。
# 不认识具体宝石，只读 SkillExecutor 产出的行为计划。
# 热路径禁止 instantiate/free —— 真实发射走对象池（M8），本里程碑只产出计划参数。
class_name BhvProjectile
extends RefCounted


## 从单条计划提取发射参数（供真实投射物生成器或测试消费）。
##
## P-26：范围扩大（area_mult）对投射物生效——弹体碰撞盒与环绕半径按同倍率缩放，
## 环形比例不变；角速度 ω = speed ÷ orbit_radius 随环变大自然变慢（范围换频率）。
## 量纲规则：倍率只作用于长度量纲（radius / orbit_radius），不作用于角度量纲（spread）。
static func plan_to_launch(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var area_mult: float = float(plan.get(&"area_mult", 1.0))
	return {
		&"count": int(params.get(&"projectile_count", 1)),
		&"speed": float(params.get(&"speed", 900.0)),
		&"radius": float(params.get(&"radius", 12.0)) * area_mult,
		&"pierce": int(params.get(&"pierce", 0)),
		&"fork": int(params.get(&"fork_count", 0)),
		&"chain": int(params.get(&"chain_count", 0)),
		&"motion": params.get(&"motion", &"linear"),          # D-36：linear / orbit（枚举封闭，加值=口径变更）
		&"orbit_radius": float(params.get(&"orbit_radius", 0.0)) * area_mult,
		&"lifetime": float(params.get(&"lifetime", 1.2)),
		&"angle_deg": float(plan.get(&"angle_deg", 0.0)),
	}


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 projectile 承诺对账）。
## 新增参数键必须同步：①这里 ②TagRegistry 承诺面 ③内容校验测试自动对账。
static func produced_params() -> Array:
	return [
		&"projectile_count", &"speed", &"radius", &"pierce", &"fork_count",
		&"chain_count", &"motion", &"orbit_radius", &"lifetime", &"spread_deg",
	]


## D-42：本行为消费的倍率型 stat（供辅助石属性契约对账：承诺 stat 必须有行为消费）。
static func consumed_stats() -> Array:
	return [&"area_size"]
