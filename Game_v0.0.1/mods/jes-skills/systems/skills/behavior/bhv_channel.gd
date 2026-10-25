# bhv_channel（规格 §5 / M6）：引导行为。按 tick 结算，受 duration 词缀缩放。
# 不认识具体宝石，只消费行为计划。本里程碑只产出纯数据计划参数。
class_name BhvChannel
extends RefCounted


## 从单条计划提取引导参数（tick 时刻列表供真实结算器消费）。
##
## 批次 A 判定形状化（D-43）：新增 `shape` 参数键（默认 line = 与加形状前的隐含光束逐位一致）；
## 扇形引导（sec）读 arc_deg / range。range 是长度量纲吃 area_size 缩放（P-26），
## arc_deg 是角度量纲不缩放。
static func plan_to_channel(plan: Dictionary) -> Dictionary:
	var params: Dictionary = plan.get(&"params", {})
	var area_mult: float = float(plan.get(&"area_mult", 1.0))
	var tick_interval: float = maxf(float(params.get(&"tick_interval", 0.25)), 0.01)
	var max_time: float = _scaled_channel_time(float(params.get(&"max_channel_time", 3.0)), plan)
	var tick_count := int(floor(max_time / tick_interval))
	var ticks: Array[float] = []
	for i in tick_count:
		ticks.append(tick_interval * float(i + 1))
	return {
		&"shape": StringName(params.get(&"shape", &"line")),
		&"arc_deg": float(params.get(&"arc_deg", 0.0)),
		&"range": float(params.get(&"range", 0.0)) * area_mult,
		&"tick_interval": tick_interval,
		&"max_channel_time": max_time,
		&"tick_count": tick_count,
		&"ticks": ticks,
	}


## duration 词缀缩放引导时长（§3.3：持续时间倍率）。
static func _scaled_channel_time(base: float, plan: Dictionary) -> float:
	var duration_mult: float = plan.get(&"duration_mult", 1.0)
	return base * duration_mult


## D-42 标签承诺契约：本行为产出的参数键面（与 TagRegistry 的 channel 承诺对账）。
## 批次 A（D-43）：扩形状键面 shape / arc_deg / range（扇形引导，P1 扇形喷火用）。
static func produced_params() -> Array:
	return [&"shape", &"arc_deg", &"range", &"tick_interval", &"max_channel_time"]


## D-42：本行为消费的倍率型 stat（引导时长吃持续倍率；
## 批次 A 起扇形/线形的 range 吃面积倍率——现有内容无 channel 带 range，零回归）。
static func consumed_stats() -> Array:
	return [&"duration", &"area_size"]
