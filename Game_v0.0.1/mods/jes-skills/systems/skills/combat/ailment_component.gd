# AilmentComponent（规格 §8.1）：挂在实体上的异常状态容器。
# 硬规则：自身无 Timer、无 advance——全部委托外部 DotTicker 推进；
#         apply 只是转发 apply_dot，快照语义由 ticker 保证。
class_name AilmentComponent
extends RefCounted

var _ticker: DotTicker


func _init(ticker: DotTicker) -> void:
	_ticker = ticker


func apply(ailment_type: StringName, base_damage: float, coeff: float, duration: float) -> DotInstance:
	return _ticker.apply_dot(ailment_type, base_damage, coeff, duration)


func active_count() -> int:
	return _ticker.active_count()


func dots_of(ailment_type: StringName) -> Array[DotInstance]:
	return _ticker.dots_of(ailment_type)
