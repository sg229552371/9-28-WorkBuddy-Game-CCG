# bhv_dash（规格 §5 / M6）：冲刺位移行为。路径伤害可选（path_damage 非空即启用）。
# 不认识具体宝石，只消费行为计划。本里程碑只产出纯数据计划参数。
class_name BhvDash
extends RefCounted


## 从单条计划提取冲刺参数。
##
## 批次 A 判定形状化（D-43）：冲刺路径判定宽度参数化——`path_width` 是路径两侧的
## 判定半带宽（长度量纲，供运行时路径判定消费；默认 24 为占位值 [PLACEHOLDER]，
## 现运行时未消费该键，行为与加键前逐位一致）。`path_zone_duration` 为「留下火径」
## 类（位移×持续区域）的区域存续时长，0 = 不留区域（现状）。
## D-56 合并键批次：冲刺路径多段判定——`hit_count`（默认 1 = 现状单段）×
## `tick_interval`（默认 0 = 一次结算）。>1 时路径按 hit_count 等分逐段判定，
## 解锁 DASH·LINE·TICK（路径多段）与 DASH·CIRC·TICK（路径多段碾）两格。
static func plan_to_dash(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var distance: float = maxf(float(params.get(&"distance", 300.0)), 0.0)
	var speed: float = maxf(float(params.get(&"speed", 1500.0)), 0.01)
	var has_path_damage: bool = params.has(&"path_damage")
	return {
		&"distance": distance,
		&"speed": speed,
		&"move_time": distance / speed,
		&"path_width": maxf(float(params.get(&"path_width", 24.0)), 0.0),
		&"path_zone_duration": maxf(float(params.get(&"path_zone_duration", 0.0)), 0.0),
		&"hit_count": maxi(int(params.get(&"hit_count", 1)), 1),
		&"tick_interval": maxf(float(params.get(&"tick_interval", 0.0)), 0.0),
		&"has_path_damage": has_path_damage,
		&"path_damage": params.get(&"path_damage", {}),
		&"angle_deg": float(plan.get(&"angle_deg", 0.0)),
	}


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 movement 承诺对账）。
## 注意：冲刺速度是位移速度，不吃范围扩大（D-40，PoE 同口径）。
## 批次 A（D-43）：扩 path_width / path_zone_duration（路径判定宽度 + 位移×持续区域）。
## D-56 合并键批次：扩 hit_count / tick_interval（路径多段判定）。
static func produced_params() -> Array:
	return [&"distance", &"speed", &"path_damage", &"path_width", &"path_zone_duration",
		&"hit_count", &"tick_interval"]


## D-42：本行为消费的倍率型 stat（位移距离与速度均为固有量，不消费倍率）。
static func consumed_stats() -> Array:
	return []
