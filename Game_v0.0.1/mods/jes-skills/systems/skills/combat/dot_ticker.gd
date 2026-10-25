# DotTicker（规格 §8.1）：唯一的 DoT 全局 ticker。
# 硬规则：
#   - 禁止每个 DoT 一个 Timer；一个 ticker 实例推进全部效果
#   - 固定网格（默认 0.25s），每个效果记录 next_tick_at
#   - 异常伤害走 AILMENT 通道：不吃 hit 通道倍率，只吃 AILMENT/DOT 通道倍率
#   - 点燃等基础伤害为施加瞬间快照（apply_dot 时即算死 dps/tick_damage）
class_name DotTicker
extends RefCounted

signal tick_dealt(amount: float, dot: DotInstance)

const DEFAULT_GRID: float = 0.25

var grid: float = DEFAULT_GRID
var _dots: Array[DotInstance] = []
var _channel_mult: Dictionary = {}   # Channel 枚举值 -> float，未设置按 1.0

const CHANNEL_DOT := 2               # SkillChannel.Channel.DOT
const CHANNEL_AILMENT := 4           # SkillChannel.Channel.AILMENT


func _init(tick_grid: float = DEFAULT_GRID) -> void:
	grid = maxf(tick_grid, 0.05)


func apply_dot(ailment_type: StringName, base_damage: float, coeff: float, duration: float) -> DotInstance:
	var dot := DotInstance.new()
	dot.ailment_type = ailment_type
	dot.dps = base_damage * coeff            # 施加瞬间快照
	dot.tick_damage = dot.dps * grid
	dot.duration = duration
	dot.remaining = duration
	dot.next_tick_at = grid                  # 首个 tick 在满一个网格后
	_dots.append(dot)
	return dot


func set_channel_mult(channel: int, mult: float) -> void:
	_channel_mult[channel] = mult


func _channel_factor(channel: int) -> float:
	return _channel_mult.get(channel, 1.0)


func active_count() -> int:
	return _dots.size()


func dots_of(ailment_type: StringName) -> Array[DotInstance]:
	var out: Array[DotInstance] = []
	for d in _dots:
		if d.ailment_type == ailment_type:
			out.append(d)
	return out


## 外部驱动：每帧调用。异常伤害最终倍率 = AILMENT × DOT 通道倍率（不吃 HIT）。
func advance(dt: float) -> void:
	var factor := _channel_factor(CHANNEL_AILMENT) * _channel_factor(CHANNEL_DOT)
	# 顺序：先结算 tick，再判过期——最后一个网格（remaining 归零）仍要打满，
	# 保证总量 = DPS × duration（4s × 4Hz = 16 tick）。
	# catch-up 封顶：大步长 advance 时 tick 数不超过剩余寿命对应的网格数。
	var i := _dots.size() - 1
	while i >= 0:
		var dot: DotInstance = _dots[i]
		var budget := int(ceilf(minf(dot.remaining, dt) / grid - 0.0001))
		var emitted := 0
		dot.next_tick_at -= dt
		while dot.next_tick_at <= 0.0 and emitted < budget:
			dot.next_tick_at += grid
			tick_dealt.emit(dot.tick_damage * factor, dot)
			emitted += 1
		dot.remaining -= dt
		if dot.remaining <= 0.0:
			dot.remaining = 0.0
			_dots.remove_at(i)
		i -= 1
