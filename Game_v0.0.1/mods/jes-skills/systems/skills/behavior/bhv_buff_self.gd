# bhv_buff_self（规格 §5 / M6）：自身增益行为。给自身挂带持续时间的 Modifier 集合。
# 不认识具体宝石，只消费行为计划。本里程碑只产出纯数据计划参数（duration 走 stat 缩放）。
class_name BhvBuffSelf
extends RefCounted


## 从单条计划提取增益参数：词缀透传 + duration 缩放。
static func plan_to_buff(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var out_mods: Array = []
	var raw_mods: Array = params.get(&"buff_mods", [])
	for m in raw_mods:
		if m is Dictionary:
			out_mods.append(m.duplicate(true))
	return {
		&"duration": _scaled_duration(float(params.get(&"duration", 1.0)), plan),
		&"buff_mods": out_mods,
	}


## duration 词缀缩放增益时长（§3.3：持续时间倍率）。
static func _scaled_duration(base: float, plan: Dictionary) -> float:
	var duration_mult: float = plan.get(&"duration_mult", 1.0)
	return base * duration_mult


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 buff 承诺对账）。
static func produced_params() -> Array:
	return [&"duration", &"buff_mods"]


## D-42：本行为消费的倍率型 stat。
static func consumed_stats() -> Array:
	return [&"duration"]
