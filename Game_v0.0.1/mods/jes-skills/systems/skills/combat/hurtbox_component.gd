# HurtboxComponent（M4，规格 §10）：受击判定框。
# 职责：绑定所属实体的 HealthComponent；接收 HitEvent 并扣血。
# 硬规则：不做减免计算（减免已在 DamageCalculator 完成）；
# 对外广播 hit_received / owner_died 信号，供演出层与 M7 TriggerManager 订阅。
class_name HurtboxComponent
extends Area2D

signal hit_received(hit: Dictionary)
signal owner_died

var health: HealthComponent = null


## 接收一次已结算的命中（HitEvent），按 total 扣血。
func receive_hit(hit: Dictionary, _source: HitboxComponent) -> void:
	if health == null:
		return
	if not health.is_dead():
		health.apply_damage(float(hit.get(&"total", 0.0)))
		hit_received.emit(hit)
		if health.is_dead():
			owner_died.emit()


## 便捷绑定：把 HealthComponent 挂进来，并转发死亡事件。
func bind_health(h: HealthComponent) -> void:
	health = h
	if not h.died.is_connected(_on_health_died):
		h.died.connect(_on_health_died)


func _on_health_died() -> void:
	owner_died.emit()