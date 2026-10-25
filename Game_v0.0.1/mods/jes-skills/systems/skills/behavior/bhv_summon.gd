# bhv_summon（规格 §5 / M6）：召唤行为。实例化数量受词缀缩放，共享施法者召唤物伤害词缀。
# 不认识具体宝石，只消费行为计划。本里程碑只产出纯数据计划参数（真实场景实例化在演出层接入）。
class_name BhvSummon
extends RefCounted


## 从单条计划提取召唤参数。
##
## 批次 A 判定形状化（D-43）：召唤阵型参数化——
##   formation = point（默认，逐次召唤在施法者位置，D-10 上限语义不变）/ ring（环形均布）/ line（沿朝向一排）。
##   per_cast = 一次施放的生成数量（默认 0 = 走 D-10 逐次召唤；阵型类内容须显式声明）。
##   formation_radius（ring）/ formation_spacing（line）是长度量纲，吃 area_size 缩放。
## 环形均布复用 D-36 公式：第 i 只角度 = 360° × i ÷ per_cast。
## spawn_offsets 是相对施法者、已按计划朝向旋转好的落点偏移（表现层直接用）。
## D-56 合并键批次：formation 补两个封闭枚举值——
##   circ（散布召一群：向日葵螺旋均布撒在 formation_radius 圆内，确定性分布可测）；
##   multi（多点召唤：沿朝向 point_count 个点、点距 point_spacing，各点一只）。
##   delay（默认 0）为多点陷阱阵（SUMN·MULTI·DLY）的预埋延迟，整组统一延迟（纯透传）。
static func plan_to_summon(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var area_mult: float = float(plan.get(&"area_mult", 1.0))
	var max_count := maxi(int(params.get(&"max_count", 1)), 0)
	var formation: StringName = StringName(params.get(&"formation", &"point"))
	var per_cast := maxi(int(params.get(&"per_cast", 0)), 0)
	var radius := maxf(float(params.get(&"formation_radius", 0.0)), 0.0) * area_mult
	var spacing := maxf(float(params.get(&"formation_spacing", 0.0)), 0.0) * area_mult
	var point_count := maxi(int(params.get(&"point_count", 0)), 0)
	var point_spacing := maxf(float(params.get(&"point_spacing", 0.0)), 0.0) * area_mult
	var offsets: Array[Vector2] = []
	if formation == &"ring" and per_cast > 0:
		# D-36 均布公式：整圈等分，散角不参与
		for i in per_cast:
			var ang := deg_to_rad(360.0 * float(i) / float(per_cast))
			offsets.append(Vector2.RIGHT.rotated(ang) * radius)
	elif formation == &"line" and per_cast > 0:
		# 沿朝向一排，以施法者为中心前后对称展开
		var dir := Vector2.RIGHT.rotated(deg_to_rad(float(plan.get(&"angle_deg", 0.0))))
		for i in per_cast:
			var along := (float(i) - float(per_cast - 1) * 0.5) * spacing
			offsets.append(dir * along)
	elif formation == &"circ" and per_cast > 0:
		# D-56 散布：向日葵螺旋（golden angle）——半径方向 sqrt 均匀覆盖圆盘，确定性可测
		const GOLDEN_ANGLE := 2.399963229728653
		for i in per_cast:
			var r := radius * sqrt((float(i) + 0.5) / float(per_cast))
			offsets.append(Vector2.RIGHT.rotated(float(i) * GOLDEN_ANGLE) * r)
	elif formation == &"multi" and point_count > 0:
		# D-56 多点：沿朝向 point_count 个点（point_spacing 点距），语义与 multi 形状对齐
		var count := point_count
		var gap := point_spacing if point_spacing > 0.0 else spacing
		var dir2 := Vector2.RIGHT.rotated(deg_to_rad(float(plan.get(&"angle_deg", 0.0))))
		for i in count:
			var along2 := (float(i) - float(count - 1) * 0.5) * gap
			offsets.append(dir2 * along2)
	return {
		&"max_count": max_count,
		&"scene_path": String(params.get(&"scene", "")),
		&"lifetime": _scaled_lifetime(float(params.get(&"lifetime", 0.0)), plan),
		&"formation": formation,
		&"per_cast": per_cast,
		&"formation_radius": radius,
		&"formation_spacing": spacing,
		&"point_count": point_count,
		&"point_spacing": point_spacing,
		&"delay": maxf(float(params.get(&"delay", 0.0)), 0.0),
		&"spawn_offsets": offsets,
	}


## duration 词缀缩放召唤物存续时间；0 = 永久（跟随上限管理）。
static func _scaled_lifetime(base: float, plan: Dictionary) -> float:
	var duration_mult: float = plan.get(&"duration_mult", 1.0)
	return base * duration_mult


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 summon 承诺对账）。
## 批次 A（D-43）：扩阵型键面 formation / per_cast / formation_radius / formation_spacing。
## D-56 合并键批次：扩 point_count / point_spacing / delay（多点召唤与陷阱阵）。
static func produced_params() -> Array:
	return [&"max_count", &"scene", &"lifetime",
		&"formation", &"per_cast", &"formation_radius", &"formation_spacing",
		&"point_count", &"point_spacing", &"delay"]


## D-42：本行为消费的倍率型 stat（存续时长吃持续倍率；
## 批次 A 起阵型半径/间距吃面积倍率——现有内容无阵型键，零回归）。
static func consumed_stats() -> Array:
	return [&"duration", &"area_size"]
