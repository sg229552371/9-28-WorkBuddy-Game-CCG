# 属性组件（规格 §3.5 / 附录 B 抄 kit 的接口签名：add/remove_by_source）
# 单一职责：持有 Modifier 列表、按来源注入与卸载。
# 聚合计算不在本类做（管线负责），避免双管线。
#
# 脏标记 + 按需重算（规格 §13.2 第 9 条）：
#   每次 add/remove 让 _version +1；聚合结果按 (stat, op) 缓存在 _sum_cache，
#   命中条件 = 缓存写入时的 version 仍等于当前 version。
#   这样"同一帧内多次读同一 stat"只算一次，而"改了词缀"会自动失效。
#
# 注意：外部若直接修改 modifier.value（不经过 add/remove），必须调 invalidate()，
#   否则缓存还是旧值。约定：**改词缀一律走 remove + add**，测试里有守卫用例。
class_name StatsComponent
extends RefCounted

var _modifiers: Array[StatModifier] = []
var _version: int = 0

# stat -> {op: float}
var _sum_cache: Dictionary = {}
# stat -> {op: version}，用于判断缓存是否过期
var _ver_cache: Dictionary = {}
# MORE 连乘单独一张表：它与"按 op 求和"语义不同，共用同一 bucket 会互相覆盖
var _mul_cache: Dictionary = {}
var _mul_ver: Dictionary = {}

var _cache_hits: int = 0
var _cache_misses: int = 0


func add_modifier(m: StatModifier) -> void:
	_modifiers.append(m)
	_version += 1


func add_modifiers(mods: Array, source_id: StringName) -> void:
	for m in mods:
		m.source_id = source_id
		_modifiers.append(m)
	_version += 1


func remove_by_source(source_id: StringName) -> void:
	var kept: Array[StatModifier] = []
	for m in _modifiers:
		if m.source_id != source_id:
			kept.append(m)
	_modifiers = kept
	_version += 1


func get_modifiers() -> Array[StatModifier]:
	return _modifiers


## 手动失效（外部直接改了 modifier.value 之后必须调用）
func invalidate() -> void:
	_version += 1


## 版本号（测试与调试用）
func version() -> int:
	return _version


## 求和型聚合：FLAT_ADD 与 INCREASED 用它。带脏标记缓存。
func aggregate(stat: StringName, op: int) -> float:
	var bucket: Dictionary = _sum_cache.get(stat, {})
	var ver_bucket: Dictionary = _ver_cache.get(stat, {})
	if int(ver_bucket.get(op, -1)) == _version:
		_cache_hits += 1
		return float(bucket.get(op, 0.0))
	_cache_misses += 1
	var total := 0.0
	for m in _modifiers:
		if m.stat == stat and m.op == op:
			total += m.value
	bucket[op] = total
	ver_bucket[op] = _version
	_sum_cache[stat] = bucket
	_ver_cache[stat] = ver_bucket
	return total


## 连乘型聚合：MORE 必须逐条相乘，不能求和（规格 §4.2 第 ⑤ 步）。
## 返回 Π(1 + value/100)，空表返回 1.0。
func multiplier_of(stat: StringName) -> float:
	if int(_mul_ver.get(stat, -1)) == _version:
		_cache_hits += 1
		return float(_mul_cache[stat])
	_cache_misses += 1
	var prod := 1.0
	for m in _modifiers:
		if m.stat == stat and m.op == StatModifier.Op.MORE:
			prod *= 1.0 + m.value / 100.0
	_mul_cache[stat] = prod
	_mul_ver[stat] = _version
	return prod


## 缓存统计（HUD / 测试用）
func cache_stats() -> Dictionary:
	return {&"hits": _cache_hits, &"misses": _cache_misses,
			&"entries": _sum_cache.size() + _mul_cache.size()}


## 清空缓存（不改变词缀，只让下次重新算）
func clear_cache() -> void:
	_sum_cache.clear()
	_ver_cache.clear()
	_mul_cache.clear()
	_mul_ver.clear()
