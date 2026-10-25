# MinionRegistry（规格 §8.2）：召唤物数据层管理。
#
# §8.2 三条规则，逐条落在这里：
#   ① 召唤物只继承**指定子集**（minion_damage / minion_attack_speed / minion_life），
#      不继承施法者的全部 stats —— 见 inherit_stats()，白名单写死在 INHERIT_STATS。
#   ② 召唤物技能**复用** bhv_* 行为组件，不新写一套 —— 见 cast_plans()，
#      它就是 SkillExecutor.cast 的直通口，本类不引入任何新的行为分派。
#   ③ max_count 到达时**新召唤顶掉最旧的** —— 见 spawn() 的 evicted 返回。
#
# 职责边界：本类只管数据（StatsComponent / 寿命 / 计数），不碰 Node。
#   表现层对象通过 payload 挂上来，被顶掉/过期时由调用方从返回值里取走并自行释放。
class_name MinionRegistry
extends RefCounted

## 允许继承的属性白名单（§8.2「指定子集」，写死为常量，禁止改成"全部 stats"）
const INHERIT_STATS: Array[StringName] = [&"minion_damage", &"minion_attack_speed", &"minion_life"]

## 全局硬上限（防止配置写错 max_count 导致无限召唤）
const HARD_CAP := 64


class MinionRecord extends RefCounted:
	var id: int = 0
	var stats: StatsComponent = null      # 只含继承子集
	var skill: SkillData = null           # 召唤物出招复用同一个 SkillData
	var level: int = 1
	var lifetime: float = 0.0             # 0 = 永久（只受 max_count 约束）
	var age: float = 0.0
	var seq: int = 0                      # 越新越大，用于"顶掉最旧"
	var payload: Object = null            # 表现层对象（沙盒里是 SandboxEntity）

	func is_expired() -> bool:
		return lifetime > 0.0 and age >= lifetime


var _records: Array = []     # Array[MinionRecord]
var _seq: int = 0
var _id: int = 0
var evicted_total: int = 0   # 统计：被顶掉的次数（测试观察用）


func active_count() -> int:
	return _records.size()


## 召唤。返回 {&"record": MinionRecord, &"evicted": Array[MinionRecord]}
## p_max_count 来自行为计划（§3.6 的 max_count），<= 0 视为不限（仍受 HARD_CAP 约束）。
func spawn(caster_stats: StatsComponent, skill: SkillData, level: int,
		lifetime: float, p_max_count: int, payload: Object = null) -> Dictionary:
	var evicted: Array = []

	# ③ 同技能召唤物达到上限 → 逐个顶掉最旧的
	var limit := p_max_count if p_max_count > 0 else HARD_CAP
	limit = mini(limit, HARD_CAP)
	while _count_of(skill) >= limit:
		var oldest := _oldest_of(skill)
		if oldest == null:
			break
		_drop(oldest)
		evicted.append(oldest)
		evicted_total += 1

	# 全局硬上限兜底（不同技能各配大 max_count 时也不会爆）
	while _records.size() >= HARD_CAP:
		var oldest_any := _oldest_of(null)
		if oldest_any == null:
			break
		_drop(oldest_any)
		evicted.append(oldest_any)
		evicted_total += 1

	var rec := MinionRecord.new()
	_id += 1
	_seq += 1
	rec.id = _id
	rec.seq = _seq
	rec.stats = inherit_stats(caster_stats)
	rec.skill = skill
	rec.level = level
	rec.lifetime = maxf(lifetime, 0.0)
	rec.payload = payload
	_records.append(rec)

	return {&"record": rec, &"evicted": evicted}


## ① 只拷贝白名单里的属性；召唤物不会继承暴击、抗性、护甲等施法者属性。
func inherit_stats(caster_stats: StatsComponent) -> StatsComponent:
	var out := StatsComponent.new()
	if caster_stats == null:
		return out
	for m in caster_stats.get_modifiers():
		if not INHERIT_STATS.has(m.stat):
			continue
		var copy := StatModifier.new()
		copy.stat = m.stat
		copy.op = m.op
		copy.value = m.value
		copy.channel_mask = m.channel_mask
		copy.source_id = &"minion_inherit"
		out.add_modifier(copy)
	return out


## ② 出招走同一个 SkillExecutor —— 本类不新增行为分派逻辑
func cast_plans(rec: MinionRecord) -> Array:
	if rec == null or rec.skill == null:
		return []
	return SkillExecutor.cast(rec.skill, rec.level, rec.stats, [], {})


## 推进寿命。返回本帧过期的记录（调用方负责释放其 payload）。
func tick(dt: float) -> Array:
	var expired: Array = []
	var kept: Array = []
	for r in _records:
		r.age += dt
		if r.is_expired():
			expired.append(r)
		else:
			kept.append(r)
	_records = kept
	return expired


## 主动移除某个召唤物（返回是否移除成功）
func despawn(rec: MinionRecord) -> bool:
	if rec == null:
		return false
	for i in _records.size():
		if _records[i] == rec:
			_records.remove_at(i)
			return true
	return false


## 清空（切场景 / 测试隔离）
func clear_all() -> Array:
	var all := _records.duplicate()
	_records.clear()
	return all


func records() -> Array:
	return _records


# ---------------- 内部 ----------------

## 分组键：同技能单独计数；skill 为 null 表示"本 registry 全部召唤物统一计数"
func _key_of(skill: SkillData) -> StringName:
	return skill.gem_id if skill != null else &""


func _key_of_record(r: MinionRecord) -> StringName:
	return r.skill.gem_id if r.skill != null else &""


func _count_of(skill: SkillData) -> int:
	var key := _key_of(skill)
	var n := 0
	for r in _records:
		if skill == null or _key_of_record(r) == key:
			n += 1
	return n


func _oldest_of(skill: SkillData) -> MinionRecord:
	var key := _key_of(skill)
	var best: MinionRecord = null
	for r in _records:
		if skill != null and _key_of_record(r) != key:
			continue
		if best == null or r.seq < best.seq:
			best = r
	return best


func _drop(rec: MinionRecord) -> void:
	for i in _records.size():
		if _records[i] == rec:
			_records.remove_at(i)
			return
