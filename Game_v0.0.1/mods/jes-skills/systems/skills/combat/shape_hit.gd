# ShapeHit（批次 A 判定形状化，D-43）：七种封闭枚举形状的纯函数命中判定。
#
# 为什么独立成文件：
#   形状轴（点/圆/环/扇/线/矩形/多点）此前只以「隐含形状」散落在各行为里
#   （aoe=圆/环、melee=扇、channel=线）。展开表 v2 要求形状轴显式化后可被
#   任意投送×时序组合复用，所以判定收敛为一个纯函数模块——行为层只负责
#   把计划参数归一成 cfg 传进来，本文件不认识行为、宝石与倍率。
#
# 枚举封闭（加值 = 口径变更，须过制作人裁定，同 motion 的 D-36 先例）：
#   pt / circ / ring / sec / line / rect / multi
#
# cfg 按形状取键（与总纲 §4 参数挂轴表一致，未给的键走安全默认）：
#   pt    ——（无）点判定：目标圆压住该点即命中
#   circ  —— radius
#   ring  —— radius / inner_radius（内圈不命中 = 空心环，D-31 语义）
#   sec   —— arc_deg / range（从 origin 沿 angle_deg 方向张开的扇形）
#   line  —— length（缺省回退 range 承载）/ width（从 origin 沿 angle_deg 前向延伸的线段）
#   rect  —— length / width（以 origin 为中心、沿 angle_deg 取向的矩形）
#   multi —— point_count / point_spacing / radius（沿朝向均布 N 点，每点独立判定）
#
# 量纲规则（P-26 延续）：长度量纲（radius/length/width/point_spacing/range）
# 的 area_size 缩放由行为层完成，本文件只做几何判定、不碰倍率。
class_name ShapeHit
extends RefCounted

const SHAPES := [
	&"pt", &"circ", &"ring", &"sec", &"line", &"rect", &"multi",
]


## 形状是否在封闭枚举内
static func is_valid(shape: StringName) -> bool:
	return SHAPES.has(shape)


## 判定「目标圆（target_pos 半径 target_radius）」是否被形状命中。
## 纯函数：不给默认参数留静默空间——形状未知时显式报错并返回不命中。
static func hits(shape: StringName, origin: Vector2, angle_deg: float,
		cfg: Dictionary, target_pos: Vector2, target_radius: float) -> bool:
	match shape:
		&"pt":
			return origin.distance_to(target_pos) <= target_radius
		&"circ":
			return origin.distance_to(target_pos) <= float(cfg.get(&"radius", 0.0)) + target_radius
		&"ring":
			return _hits_ring(origin, target_pos, target_radius,
				float(cfg.get(&"radius", 0.0)), float(cfg.get(&"inner_radius", 0.0)))
		&"sec":
			return _hits_sec(origin, angle_deg, target_pos, target_radius,
				float(cfg.get(&"range", 0.0)), float(cfg.get(&"arc_deg", 0.0)))
		&"line":
			var length: float = float(cfg.get(&"length", cfg.get(&"range", 0.0)))
			return _hits_line(origin, angle_deg, target_pos, target_radius,
				length, float(cfg.get(&"width", 0.0)))
		&"rect":
			return _hits_rect(origin, angle_deg, target_pos, target_radius,
				float(cfg.get(&"length", 0.0)), float(cfg.get(&"width", 0.0)))
		&"multi":
			return _hits_multi(origin, angle_deg, target_pos, target_radius,
				int(cfg.get(&"point_count", 0)), float(cfg.get(&"point_spacing", 0.0)),
				float(cfg.get(&"radius", 0.0)))
		_:
			push_error("ShapeHit：未知形状「%s」（枚举封闭：pt/circ/ring/sec/line/rect/multi）" % shape)
			return false


## 环判定（与 bhv_aoe_burst.hits_ring 同一语义：目标圆与描边环带相交即命中，
## 内圈留空 = 贴脸打不到）。收敛到这里供全部形状共用一个真源。
static func _hits_ring(origin: Vector2, target_pos: Vector2, target_radius: float,
		outer: float, inner: float) -> bool:
	var d := origin.distance_to(target_pos)
	if d > outer + target_radius:
		return false
	if inner > 0.0 and d < inner - target_radius:
		return false
	return true


## 扇判定：距离在 reach 内 + 与朝向的夹角在半扇角内（含目标半径张开的角容差）。
## arc_deg >= 360 时退化为全周圆（雷光斩 360° 全周斩的既有口径）。
static func _hits_sec(origin: Vector2, angle_deg: float, target_pos: Vector2,
		target_radius: float, reach: float, arc_deg: float) -> bool:
	var d := origin.distance_to(target_pos)
	if d > reach + target_radius:
		return false
	if arc_deg >= 360.0:
		return true
	var half := arc_deg * 0.5
	var to_target := (target_pos - origin).angle()
	var diff := absf(wrapf(to_target - deg_to_rad(angle_deg), -PI, PI))
	# 角容差：目标半径在当前距离处张开的圆心角（扇边擦到目标边缘也算命中）
	var tol := 0.0
	if d > 0.0001:
		tol = asin(clampf(target_radius / d, 0.0, 1.0))
	return rad_to_deg(diff) <= half + rad_to_deg(tol)


## 线判定：目标圆心到「origin 沿朝向延伸 length 的线段」的距离 <= 半宽 + 目标半径。
static func _hits_line(origin: Vector2, angle_deg: float, target_pos: Vector2,
		target_radius: float, length: float, width: float) -> bool:
	var dir := Vector2.RIGHT.rotated(deg_to_rad(angle_deg))
	var end := origin + dir * length
	return _dist_to_segment(target_pos, origin, end) <= width * 0.5 + target_radius


## 矩形判定：以 origin 为中心、沿朝向取向的 length×width 矩形（目标圆膨胀）。
## 与 line 的区别：line 从 origin 向前延伸，rect 向前后对称延展。
static func _hits_rect(origin: Vector2, angle_deg: float, target_pos: Vector2,
		target_radius: float, length: float, width: float) -> bool:
	var local := (target_pos - origin).rotated(-deg_to_rad(angle_deg))
	return absf(local.x) <= length * 0.5 + target_radius \
		and absf(local.y) <= width * 0.5 + target_radius


## 多点判定：沿朝向从 origin 起以 point_spacing 均布 point_count 个判定点，
## 任一点命中即命中（每点判定半径 radius，默认 0 = 纯点）。
static func _hits_multi(origin: Vector2, angle_deg: float, target_pos: Vector2,
		target_radius: float, point_count: int, point_spacing: float,
		point_radius: float) -> bool:
	var dir := Vector2.RIGHT.rotated(deg_to_rad(angle_deg))
	for i in maxi(point_count, 0):
		var p := origin + dir * (point_spacing * float(i))
		if p.distance_to(target_pos) <= point_radius + target_radius:
			return true
	return false


## 点到线段最短距离（标准几何：投影 clamp 到 [0,1] 后取距离）。
static func _dist_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len_sq := ab.length_squared()
	if len_sq <= 0.0001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	return p.distance_to(a + ab * t)
