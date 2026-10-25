# HealthComponent（M4）：血量容器 + 击杀信号。
# 硬规则：本类只做血量记账与信号广播，不做伤害计算（计算在 DamageCalculator）。
# 击杀事件 = died 信号，供 M7 TriggerManager 订阅（on_kill 联动）。
class_name HealthComponent
extends RefCounted

signal damaged(amount: float)
signal died

var max_health: float = 100.0
var current_health: float = 100.0


func is_dead() -> bool:
	return current_health <= 0.0


## 扣血。过量伤害钳制到 0（不允许负血）；死亡只广播一次。
func apply_damage(amount: float) -> void:
	if is_dead():
		return
	var clamped: float = maxf(amount, 0.0)
	current_health = maxf(current_health - clamped, 0.0)
	damaged.emit(clamped)
	if current_health <= 0.0:
		died.emit()
