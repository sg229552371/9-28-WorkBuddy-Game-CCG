# SkillSlotBar（规格 §5.3）：技能栏 1~9 键，每键绑定一个 SkillSlot。
# 同一时刻一个 SkillSlot 派生一个 SkillInstance（§5.1 / §13.1 第 5 条）。
##
## 硬门禁：纯数据容器无演出逻辑；越界操作安全返回（null / false）。
## 实例是 RefCounted 纯数据对象（不是 Node），持有它的引用不违反"数据容器"定位。
class_name SkillSlotBar
extends RefCounted

# 槽 8 = 落烬环（FLY·RING·ZONE 首格，D-31）：原上限 8 与沙盒 ACTIVE_SLOT_COUNT 同步扩到 9。
const MAX_SLOTS := 9

var slot_count: int = MAX_SLOTS
var _slots: Array = []
var _instances: Array = []     # Array[SkillInstance]，与槽位一一对齐


func _init() -> void:
	_slots.resize(MAX_SLOTS)
	_slots.fill(null)
	_instances.resize(MAX_SLOTS)
	_instances.fill(null)


## 绑定技能位。索引越界返回 false，不做任何修改。
## 换绑会让该槽的旧实例作废（§5.3：切换武器栏时重建实例，但 SkillSlot 数据不变）。
func bind_slot(index: int, slot: SkillSlot) -> bool:
	if index < 0 or index >= MAX_SLOTS:
		return false
	_slots[index] = slot
	_instances[index] = null
	return true


## 读取技能位。越界返回 null。
func get_slot(index: int) -> SkillSlot:
	if index < 0 or index >= MAX_SLOTS:
		return null
	return _slots[index]


## 取该槽的实例（懒创建）。
## p_cooldown 传入外部冷却对象时复用之 —— 「冷却跟着槽走」，
## 重建实例不会白送冷却重置（否则来回切武器栏可以无限放技能）。
func instance_of(index: int, p_cooldown: CooldownComponent = null) -> SkillInstance:
	if index < 0 or index >= MAX_SLOTS:
		return null
	var slot: SkillSlot = _slots[index]
	if slot == null:
		return null
	var inst: SkillInstance = _instances[index]
	if inst == null or inst.slot != slot:
		inst = SkillInstance.new()
		inst.bind(slot, p_cooldown)
		_instances[index] = inst
	return inst


## 显式重建实例（切换武器栏语义）：保留冷却对象，丢弃装配缓存。
func rebuild_instance(index: int) -> SkillInstance:
	if index < 0 or index >= MAX_SLOTS:
		return null
	var old: SkillInstance = _instances[index]
	var keep_cd: CooldownComponent = old.cooldown if old != null else null
	_instances[index] = null
	return instance_of(index, keep_cd)
