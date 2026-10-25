# SkillInstance（规格 §5.1 / §5.3 / §13.1 第 5 条）：一个 SkillSlot 在某一时刻的运行时实例。
#
# 职责边界：
#   - 由 SkillSlot **派生**，负责「装配 → 冷却 → 出行为计划」这条链
#   - 资源判定（蓝量）不在这里：ResourcePool 属于实体，实例只管技能自身状态
#
# 硬规则（§13.1 第 5 条）：**禁止持有插槽数据副本**。
#   slot 只存引用；玩家换技能 / 换辅助都直接改 SkillSlot，
#   实例靠 cache_key 变化感知配置变更并重装配。
#   如果实例复制了一份 supports 数组，装上去的辅助就会「实例里看不见」。
#
# 与缓存的关系（§5.2 第 5 条）：
#   装配走 SocketGraph.assemble_cached，实例自己只记「上次装配对应的 key」，
#   不重复保存 modifiers —— 避免与缓存层各存一份而漂移。
class_name SkillInstance
extends RefCounted

var slot: SkillSlot = null
var cooldown: CooldownComponent = null

var _assembly: AssemblyResult = null
var _assembly_key: String = ""
var rebuild_count: int = 0      # 重装配次数（测试与 HUD 观察用）

# 条件判定用的两个标记位（§6 第 4 条）。
# 它们属于辅助宝石的条件概念，其来源由槽位配置或装备层写入；
# 未设置时保守为 false —— 拿不到证据就不让条件生效。
var is_rare: bool = false
var is_initial: bool = false


## 绑定槽位。p_cooldown 可复用外部已有对象（保持「冷却跟着槽走」的语义：
## 切武器栏重建实例时把同一个 CooldownComponent 传进来，冷却不会被白送重置）。
func bind(p_slot: SkillSlot, p_cooldown: CooldownComponent = null) -> void:
	slot = p_slot
	if p_cooldown != null:
		cooldown = p_cooldown
	elif cooldown == null:
		cooldown = CooldownComponent.new()
		if p_slot != null and p_slot.active_gem != null:
			var gem := p_slot.active_gem
			cooldown.configure(gem.base_cooldown, 1.0, gem.max_charges, gem.charge_recharge_time)
	discard_assembly()


func skill() -> SkillData:
	return slot.active_gem if slot != null else null


func is_ready() -> bool:
	return cooldown != null and cooldown.is_ready()


## 丢弃装配缓存（切武器栏 / 换技能时调用；下次 begin() 会重新装配）
func discard_assembly() -> void:
	_assembly = null
	_assembly_key = ""


## 取当前装配结果。配置变了（key 变）就重装配，否则复用。
## key 由 SocketGraph.cache_key 生成，与装配缓存同源 —— 两处不会各算一套。
func assembly() -> AssemblyResult:
	if slot == null or slot.active_gem == null:
		return null
	var key := SocketGraph.cache_key(slot)
	if _assembly != null and key == _assembly_key:
		return _assembly
	_assembly = SocketGraph.assemble_cached(slot)
	_assembly_key = key
	rebuild_count += 1
	return _assembly


## 施法前置：装配 + 就绪判定。**无副作用**，调用方可以在这里插资源判定。
func begin() -> AssemblyResult:
	if slot == null or slot.active_gem == null:
		return null
	if not is_ready():
		return null
	return assembly()


## 确认出手：扣冷却 / 扣充能。只有在资源判定通过后调用。
func commit() -> void:
	if cooldown != null:
		cooldown.start()


## 出行为计划（消费最近一次装配的 behavior_overrides）。
## 调用约定：先 begin() 成功、再 commit()，最后 cast_plans()。
func cast_plans(stats: StatsComponent) -> Array:
	if slot == null or slot.active_gem == null:
		return []
	var asm := assembly()
	if asm == null or not asm.ok:
		return []
	return SkillExecutor.cast(slot.active_gem, slot.active_level, stats, [], asm.behavior_overrides)


## 推进冷却时间
func advance(dt: float) -> void:
	if cooldown != null:
		cooldown.advance(dt)


# ---------------- 条件门（§6 第 4 条） ----------------

## 条件判定上下文。ConditionSpec 只读这里，不自己去猜技能稀有度。
func condition_context() -> Dictionary:
	var gem := skill()
	return {
		&"tags": gem.tags if gem != null else [],
		&"level": slot.active_level if slot != null else 0,
		&"slot_index": slot.slot_index if slot != null else -1,
		&"is_rare": is_rare,
		&"is_initial": is_initial,
	}


## 条件求值入口：辅助宝石挂 modifiers 前先过这一关（AND 语义）。
func conditions_pass(conds: Array) -> bool:
	return ConditionSpec.all_match(conds, condition_context())
