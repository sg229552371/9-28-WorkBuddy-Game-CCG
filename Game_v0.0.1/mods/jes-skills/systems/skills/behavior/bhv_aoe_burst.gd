# bhv_aoe_burst（规格 §5 / M6）：范围爆发行为。
# 不认识具体宝石，只消费 SkillExecutor 产出的行为计划。
# 本里程碑只产出纯数据计划参数（延迟/半径/打击时刻），真实 Area2D 结算在命中闭环接入。
class_name BhvAoeBurst
extends RefCounted


## 从单条计划提取范围爆发参数。
##
## 批次 A 判定形状化（D-43）：新增 `shape` 参数键（枚举封闭，默认 circ = 与加形状前逐位一致）。
## 长度量纲（radius / inner_radius / length / width / point_spacing / range）吃 area_size 缩放；
## 角度量纲（arc_deg）与数量（point_count / hit_count）不缩放（P-26 量纲规则）。
static func plan_to_burst(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var area_mult: float = plan.get(&"area_mult", 1.0)
	var radius: float = _scaled_area(float(params.get(&"radius", 160.0)), plan)
	# 内半径（环）：默认 0 = 实心圆，行为与加环前逐位一致。
	# 只由 area_size 缩放外半径，内半径按同一倍率缩放，保证环带宽度比例不变。
	var inner_radius: float = _scaled_area(float(params.get(&"inner_radius", 0.0)), plan)
	inner_radius = clampf(inner_radius, 0.0, radius)
	var delay: float = _scaled_delay(float(params.get(&"delay", 0.0)), plan)
	var hit_count := maxi(int(params.get(&"hit_count", 1)), 1)
	var hit_interval := float(params.get(&"hit_interval", 0.0))
	var hits: Array[float] = []
	for i in hit_count:
		hits.append(delay + hit_interval * float(i))
	# 形状键：line 的长缺省回退 range 承载（总纲 §4 承载口径）
	var length := float(params.get(&"length", params.get(&"range", 0.0))) * area_mult
	return {
		&"shape": StringName(params.get(&"shape", &"circ")),
		&"radius": radius,
		&"inner_radius": inner_radius,
		&"length": length,
		&"width": float(params.get(&"width", 0.0)) * area_mult,
		&"arc_deg": float(params.get(&"arc_deg", 0.0)),
		&"point_count": maxi(int(params.get(&"point_count", 0)), 0),
		&"point_spacing": float(params.get(&"point_spacing", 0.0)) * area_mult,
		&"range": float(params.get(&"range", 0.0)) * area_mult,
		&"delay": delay,
		&"hit_count": hit_count,
		&"hits": hits,
		&"angle_deg": float(plan.get(&"angle_deg", 0.0)),
	}


## 批次 A（D-43）：按计划判定目标是否被爆发形状命中（几何真源 = ShapeHit）。
## burst = plan_to_burst 的产物；origin 为爆发中心，朝向取计划 angle_deg。
static func hits(burst: Dictionary, origin: Vector2, target_pos: Vector2,
		target_radius: float) -> bool:
	var cfg := {
		&"radius": float(burst.get(&"radius", 0.0)),
		&"inner_radius": float(burst.get(&"inner_radius", 0.0)),
		&"length": float(burst.get(&"length", 0.0)),
		&"width": float(burst.get(&"width", 0.0)),
		&"arc_deg": float(burst.get(&"arc_deg", 0.0)),
		&"range": float(burst.get(&"range", 0.0)),
		&"point_count": int(burst.get(&"point_count", 0)),
		&"point_spacing": float(burst.get(&"point_spacing", 0.0)),
	}
	return ShapeHit.hits(StringName(burst.get(&"shape", &"circ")),
		origin, float(burst.get(&"angle_deg", 0.0)), cfg, target_pos, target_radius)


## area_size 词缀缩放半径（§3.3：范围半径倍率）。
static func _scaled_area(base: float, plan: Dictionary) -> float:
	var area_mult: float = plan.get(&"area_mult", 1.0)
	return base * area_mult


## 环形命中判定纯函数（D-31）：目标圆与描边环带相交即命中。
## 中心点落在内圈（含目标自身半径的容差）即为「空心」：贴脸时打不到。
static func hits_ring(center: Vector2, target_pos: Vector2, target_radius: float,
		outer: float, inner: float) -> bool:
	var d := center.distance_to(target_pos)
	if d > outer + target_radius:
		return false
	if inner > 0.0 and d < inner - target_radius:
		return false
	return true


## duration 词缀缩放延迟（§3.3：持续时间倍率）。
static func _scaled_delay(base: float, plan: Dictionary) -> float:
	var duration_mult: float = plan.get(&"duration_mult", 1.0)
	return base * duration_mult


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 aoe 承诺对账）。
## 批次 A（D-43）：扩形状键面——shape + 各形状专属键（sec/line/rect/multi 复用本行为结算）。
static func produced_params() -> Array:
	return [
		&"shape", &"radius", &"inner_radius", &"delay", &"hit_count", &"hit_interval",
		&"arc_deg", &"range", &"length", &"width", &"point_count", &"point_spacing",
	]


## D-42：本行为消费的倍率型 stat（半径吃面积倍率，延迟吃持续倍率）。
static func consumed_stats() -> Array:
	return [&"area_size", &"duration"]
