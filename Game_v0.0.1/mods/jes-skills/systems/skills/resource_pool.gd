# ResourcePool（规格 §8.3）：多资源类型池 + 保留资源。
# 可用资源 = max_stat − Σ(reserved)
# 硬规则：资源不足时 spend() 返回 false 且不扣任何资源
#（禁止"扣成负数再回滚"），can_cast 判定必须在进入 cast 之前。
## 硬门禁：无 gem_id 分支；纯数据无演出；常量集中声明。
class_name ResourcePool
extends RefCounted

var _current: Dictionary = {}      # StringName -> float
var _max: Dictionary = {}          # StringName -> float
var _reserved: Dictionary = {}     # StringName -> float（Σ 按 source_id 累加后存总量）
var _reserve_sources: Dictionary = {}  # StringName -> Dictionary(source_id -> float)


## 设置某资源上限（同时将当前值钳制到新上限内）。
func set_max(resource: StringName, max_value: float) -> void:
	_max[resource] = max_value
	if not _current.has(resource):
		_current[resource] = max_value
	else:
		_current[resource] = minf(_current[resource], max_value)


## 直接设置当前值（测试与回蓝逻辑用；上限钳制）。
func set_current(resource: StringName, value: float) -> void:
	_current[resource] = clampf(value, 0.0, float(_max.get(resource, value)))


func get_current(resource: StringName) -> float:
	return float(_current.get(resource, 0.0))


## 可用资源 = min(current, max − Σ reserved)。
func available(resource: StringName) -> float:
	var cur := get_current(resource)
	var reserved_total := float(_reserved.get(resource, 0.0))
	var cap := float(_max.get(resource, 0.0)) - reserved_total
	return clampf(cur, 0.0, cap)


func can_afford(resource: StringName, amount: float) -> bool:
	return available(resource) >= amount


## 消耗资源。不足时返回 false 且不改动任何数值。
func spend(resource: StringName, amount: float) -> bool:
	if not can_afford(resource, amount):
		return false
	_current[resource] = get_current(resource) - amount
	return true


## 保留资源（光环/持续引导占用）：按 source_id 记账，可叠加。
func reserve(resource: StringName, amount: float, source_id: StringName) -> void:
	var per_source: Dictionary = _reserve_sources.get(resource, {})
	per_source[source_id] = amount
	_reserve_sources[resource] = per_source
	_reserved[resource] = float(_reserved.get(resource, 0.0)) + amount


## 按 source_id 卸载保留。
func unreserve(resource: StringName, source_id: StringName) -> void:
	var per_source: Dictionary = _reserve_sources.get(resource, {})
	if not per_source.has(source_id):
		return
	_reserved[resource] = maxf(0.0, float(_reserved.get(resource, 0.0)) - float(per_source[source_id]))
	per_source.erase(source_id)
