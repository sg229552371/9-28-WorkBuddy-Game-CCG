# ProjectilePool（规格 §9.3）：固定容量对象池。
# 硬规则：
#   - 硬上限在构造时固定（建议投射物 512、特效 128），永不扩容
#   - 池满时 acquire() 回收**最旧**的活跃槽位（seq 最小），而非新建
#   - release 重复调用安全（已空闲槽位再 release 无效果）
class_name ProjectilePool
extends RefCounted

var _cap: int
var _slots: Array[ProjectileSlot] = []
var _free: Array[ProjectileSlot] = []
var _seq_counter: int = 0


func _init(p_capacity: int = 512) -> void:
	_cap = maxi(p_capacity, 1)


func acquire() -> ProjectileSlot:
	var slot: ProjectileSlot
	if not _free.is_empty():
		slot = _free.pop_back()
	else:
		if _slots.size() < _cap:
			slot = ProjectileSlot.new()
			slot.index = _slots.size()   # 容器下标在创建时钉死，回收不改变
			slot.seq = _seq_counter
			_seq_counter += 1
			_slots.append(slot)
		else:
			# 池满：回收最旧（seq 最小的活跃槽位），不扩容
			slot = _oldest_active()
	slot.active = true
	slot.seq = _seq_counter
	_seq_counter += 1
	return slot


func release(slot: ProjectileSlot) -> void:
	if slot == null or not slot.active:
		return
	slot.active = false
	_free.append(slot)


func active_count() -> int:
	var n := 0
	for s in _slots:
		if s.active:
			n += 1
	return n


func capacity() -> int:
	return _cap


func _oldest_active() -> ProjectileSlot:
	var oldest: ProjectileSlot = null
	for s in _slots:
		if s.active and (oldest == null or s.seq < oldest.seq):
			oldest = s
	return oldest
