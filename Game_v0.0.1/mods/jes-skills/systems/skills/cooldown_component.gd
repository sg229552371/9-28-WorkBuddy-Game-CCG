# CooldownComponent（规格 §8.3）：冷却 + 充能双模式。
# 冷却模式：duration = base_cooldown / cooldown_recovery，结束发一次 cooldown_finished。
# 充能模式（max_charges > 0）：消耗按层扣，每 charge_recharge_time 秒回 1 层，上限钳制。
## 硬门禁：时间推进由外部 advance(dt) 驱动（不用 Timer 节点，便于测试与对象池）。
class_name CooldownComponent
extends RefCounted

signal cooldown_finished

var base_cooldown: float = 0.0
var cooldown_recovery: float = 1.0
var max_charges: int = 0
var charge_recharge_time: float = 0.0

var charges: int = 0
var _remaining: float = 0.0        # 冷却模式剩余时间
var _recharge_progress: float = 0.0  # 充能模式当前层已积累时间


## 配置冷却/充能参数并复位状态。
func configure(p_base_cooldown: float, p_cooldown_recovery: float,
		p_max_charges: int, p_charge_recharge_time: float) -> void:
	base_cooldown = p_base_cooldown
	cooldown_recovery = p_cooldown_recovery
	max_charges = p_max_charges
	charge_recharge_time = p_charge_recharge_time
	charges = p_max_charges
	_remaining = 0.0
	_recharge_progress = 0.0


func is_charged_mode() -> bool:
	return max_charges > 0


func is_ready() -> bool:
	if is_charged_mode():
		return charges > 0
	return _remaining <= 0.0


## 触发一次消耗：冷却模式进入冷却；充能模式扣 1 层。
func start() -> void:
	if is_charged_mode():
		if charges > 0:
			charges -= 1
		return
	if _remaining <= 0.0 and cooldown_duration() > 0.0:
		_remaining = cooldown_duration()


## 冷却总时长 = base_cooldown / cooldown_recovery。
func cooldown_duration() -> float:
	if cooldown_recovery <= 0.0:
		return base_cooldown
	return base_cooldown / cooldown_recovery


## 推进时间。冷却模式：倒数并在归零时发一次 cooldown_finished。
## 充能模式：每 charge_recharge_time 秒回 1 层，满层不积累。
func advance(dt: float) -> void:
	if is_charged_mode():
		_advance_charges(dt)
		return
	if _remaining <= 0.0:
		return
	_remaining -= dt
	if _remaining <= 0.0:
		_remaining = 0.0
		cooldown_finished.emit()


func _advance_charges(dt: float) -> void:
	if charges >= max_charges or charge_recharge_time <= 0.0:
		_recharge_progress = 0.0
		return
	_recharge_progress += dt
	while _recharge_progress >= charge_recharge_time and charges < max_charges:
		_recharge_progress -= charge_recharge_time
		charges += 1
	if charges >= max_charges:
		_recharge_progress = 0.0
