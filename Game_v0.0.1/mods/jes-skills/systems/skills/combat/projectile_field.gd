# ProjectileField（规格 §9.1 / §9.2 / §9.3）：SoA 投射物容器。
#
# 为什么要它：一个投射物一个 Node2D 会带来节点树开销 + 每帧 _draw 调用，
# 300 发就撑不住。这里把全部状态放在平行数组里（位置/速度/寿命/半径/穿透/连锁/分裂），
# 渲染交给表现层（见 sandbox_projectile_layer.gd）。
#
# 连锁/分裂（D-34，演出欠账清偿）：
# - chain：命中后朝「最近的、本弹没打过的」目标偏转并继续飞（不消耗穿透、不消亡）
# - fork：命中后原地分裂出两发 ±35° 的弹（继承剩余连锁/穿透/寿命），本体消亡
# - 两者在计划层（bhv_projectile.chain/fork）早已存在，这里只是让运行时真正消费
#
# 硬规则：
# - 容量固定，**永不扩容**；满了回收最旧（复用 ProjectilePool 的 seq 语义）
# - 命中走 SpatialHash 邻域查询，禁止 O(m×n) 全扫；距离用平方比较，不开方
# - 不持有 Node 引用（target 是鸭子类型的数组元素，渲染层单独负责）
# - **不按发创建 Node**：全是 512 个 Area2D 就没有 SoA 的意义了。
#   命中结算复用一个 HitboxComponent（它只是无状态结算器，hurtbox 不看 source）
# - 目标 id == targets 数组下标（调用方每帧重建哈希，下标稳定）
# - **命中冷却也不进 Dictionary**：Dictionary 每次 new 都是一个堆对象，
#   300 发 × 每帧重发会让对象数持续爬升（实测 200 帧涨 50 个）。改成定长 SoA 记忆槽。
class_name ProjectileField
extends RefCounted

const HIT_COOLDOWN_SEC := 0.1
const HIT_MEMO := 4   # 每发最多记住 4 个近期命中目标（足以覆盖穿透多目标）

var capacity: int
var pool: ProjectilePool

# ---- SoA 主体 ----
var px := PackedFloat32Array()
var py := PackedFloat32Array()
var vx := PackedFloat32Array()
var vy := PackedFloat32Array()
var age := PackedFloat32Array()
var life := PackedFloat32Array()
var radius := PackedFloat32Array()
var pierce := PackedInt32Array()
var chain := PackedInt32Array()   # 剩余连锁次数（D-34）
var fork := PackedInt32Array()    # 剩余分裂数（D-34）
# ---- 环绕轨迹（D-36）：orb_radius < 0 = 直线弹（默认）；>= 0 = 绕 anchor 旋转 ----
var orb_radius := PackedFloat32Array()
var orb_angle := PackedFloat32Array()     # 当前相位（弧度）
var orb_follow := PackedByteArray()       # 1 = anchor 跟随发射者（手雷跟人语义）
var orb_anchor_x := PackedFloat32Array()  # 静态锚点（follow=0 时使用）
var orb_anchor_y := PackedFloat32Array()
var alive := PackedByteArray()

# ---- 逐发射物的附属数据（对象引用，不进热循环的数值运算） ----
var _slots: Array = []        # Array[ProjectileSlot]
var _packets: Array = []      # Array[DamagePacket]
var _stats: Array = []        # Array[StatsComponent]
var _attackers: Array = []    # Array[Object] 发射者，命中时跳过
var _memo_tid := PackedInt32Array()   # capacity * HIT_MEMO：命中过的目标 id（-1 = 空）
var _memo_t := PackedFloat32Array()   # capacity * HIT_MEMO：对应命中时刻

var _hitbox: HitboxComponent = null   # 全局复用 1 个，命中前改 packet/attacker_stats

var _clock: float = 0.0
var _buf: Array = []          # 复用查询缓冲，避免每帧分配
var last_query_candidates: int = 0   # 上次 tick 遍历到的候选总数（压测判据）
var last_hit_points: Array = []      # 上次 tick 的命中点（演出层拿去放特效，不参与结算）


func _init(p_capacity: int = 512) -> void:
	capacity = maxi(p_capacity, 1)
	pool = ProjectilePool.new(capacity)
	px.resize(capacity)
	py.resize(capacity)
	vx.resize(capacity)
	vy.resize(capacity)
	age.resize(capacity)
	life.resize(capacity)
	radius.resize(capacity)
	pierce.resize(capacity)
	chain.resize(capacity)
	fork.resize(capacity)
	orb_radius.resize(capacity)
	orb_angle.resize(capacity)
	orb_follow.resize(capacity)
	orb_anchor_x.resize(capacity)
	orb_anchor_y.resize(capacity)
	orb_radius.fill(-1.0)
	alive.resize(capacity)
	alive.fill(0)
	_slots.resize(capacity)
	_packets.resize(capacity)
	_stats.resize(capacity)
	_attackers.resize(capacity)
	_memo_tid.resize(capacity * HIT_MEMO)
	_memo_tid.fill(-1)
	_memo_t.resize(capacity * HIT_MEMO)
	_memo_t.fill(0.0)
	_hitbox = HitboxComponent.new()


func _notification(what: int) -> void:
	# Area2D 不是 RefCounted，必须显式 free，否则退出时报 ObjectDB 泄漏
	if what == NOTIFICATION_PREDELETE and _hitbox != null:
		_hitbox.free()
		_hitbox = null


## 发射一发，返回索引；容量满时最旧的一发被顶掉（视觉舍弃，帧率优先）。
## p_chain / p_fork 为可选尾参（D-34）：旧调用点（bench / 既有测试）零改动兼容。
func spawn(pos: Vector2, direction: Vector2, speed: float, lifetime: float,
		p_radius: float, p_pierce: int, packet: DamagePacket,
		attacker: Object, attacker_stats: StatsComponent,
		p_chain: int = 0, p_fork: int = 0) -> int:
	var slot: ProjectileSlot = pool.acquire()
	if slot == null:
		return -1
	var i := slot.index
	if i < 0 or i >= capacity:
		return -1
	px[i] = pos.x
	py[i] = pos.y
	var dir := direction.normalized()
	vx[i] = dir.x * speed
	vy[i] = dir.y * speed
	age[i] = 0.0
	life[i] = maxf(lifetime, 0.001)
	radius[i] = p_radius
	pierce[i] = p_pierce
	chain[i] = maxi(p_chain, 0)
	fork[i] = maxi(p_fork, 0)
	orb_radius[i] = -1.0   # 默认直线弹；环绕弹由 configure_orbit() 开启（D-36）
	alive[i] = 1
	_slots[i] = slot
	_packets[i] = packet
	_stats[i] = attacker_stats
	_attackers[i] = attacker
	_clear_memo(i)
	return i


## 开启环绕轨迹（D-36）。速度真源仍是弹体 vx/vy 的模长；
## 角速度 = 线速度 ÷ orbit_radius（导出量），弹速辅助天然生效。
## angle0 < 0 = 自动取「锚点指向弹体当前位置」的相位。
## 环绕弹不吃连锁/分裂（运动积分互斥，_strike_if_hit 里跳过）；命中冷却照常。
func configure_orbit(i: int, radius: float, follow: bool = true, angle0: float = -2.0) -> void:
	if not is_alive(i):
		return
	orb_radius[i] = maxf(radius, 1.0)
	orb_follow[i] = 1 if follow else 0
	var anchor := _orbit_anchor(i)
	if angle0 < -1.5:
		orb_angle[i] = (Vector2(px[i], py[i]) - anchor).angle()
	else:
		orb_angle[i] = angle0
	# 立即落位到环上，切向速度同步（供渲染/调试读取）
	_apply_orbit_pos(i, anchor)


func _orbit_anchor(i: int) -> Vector2:
	if orb_follow[i] == 1 and _attackers[i] != null and is_instance_valid(_attackers[i]):
		var p: Vector2 = _attackers[i].global_position
		orb_anchor_x[i] = p.x
		orb_anchor_y[i] = p.y
	return Vector2(orb_anchor_x[i], orb_anchor_y[i])


func _apply_orbit_pos(i: int, anchor: Vector2) -> void:
	var spd := Vector2(vx[i], vy[i]).length()
	var dirv := Vector2(cos(orb_angle[i]), sin(orb_angle[i]))
	px[i] = anchor.x + dirv.x * orb_radius[i]
	py[i] = anchor.y + dirv.y * orb_radius[i]
	vx[i] = -dirv.y * spd   # 切向（逆时针）
	vy[i] = dirv.x * spd


## 清空某发的命中记忆（spawn 时调用；release 不清，下次 spawn 会覆盖）
func _clear_memo(i: int) -> void:
	var base := i * HIT_MEMO
	for k in HIT_MEMO:
		_memo_tid[base + k] = -1
		_memo_t[base + k] = 0.0


func release(i: int) -> void:
	if i < 0 or i >= capacity or alive[i] == 0:
		return
	alive[i] = 0
	pool.release(_slots[i])


func active_count() -> int:
	var n := 0
	for i in capacity:
		if alive[i] == 1:
			n += 1
	return n


func is_alive(i: int) -> bool:
	return i >= 0 and i < capacity and alive[i] == 1


## 只读快照：某发弹的当前位置 + 是否已消亡（D-50 FLY 复合落点结算用）。
## 演出层拿它决定「爆发段该在哪儿爆」——弹还在飞就挂账，弹没了就在消亡点结算。
## 注意：已回收的下标仍返回最后一次位置（空间可被复用，调用方必须先查 alive）。
func snapshot(i: int) -> Dictionary:
	if i < 0 or i >= capacity:
		return {&"alive": false, &"pos": Vector2.ZERO}
	return {&"alive": alive[i] == 1, &"pos": Vector2(px[i], py[i])}


## 推进一帧。targets[tid] 需有 is_dead()/global_position/radius()/hurtbox。
## grid 为空时退化为线性扫（仅供无哈希的单测；生产路径必须传 grid）。
## 返回本帧命中次数。
## 命名注意：参数不能叫 hash —— 那是 GDScript 内置函数名（SHADOWED_BUILTIN）。
func tick(dt: float, grid: SkillSpatialHash, max_target_radius: float,
		targets: Array, rng: Object) -> int:
	_clock += dt
	var hits := 0
	last_query_candidates = 0
	last_hit_points.clear()
	for i in capacity:
		if alive[i] == 0:
			continue
		age[i] += dt
		if orb_radius[i] >= 0.0:
			# 环绕轨迹（D-36）：相位推进 → 直接落位，不做线性积分
			orb_angle[i] += Vector2(vx[i], vy[i]).length() / orb_radius[i] * dt
			_apply_orbit_pos(i, _orbit_anchor(i))
		else:
			px[i] += vx[i] * dt
			py[i] += vy[i] * dt
		var pos := Vector2(px[i], py[i])
		var reach := radius[i] + max_target_radius

		if grid != null:
			grid.query_near_into(_buf, pos, reach)
			last_query_candidates += _buf.size()
			for tid in _buf:
				if _strike_if_hit(i, int(tid), targets, rng):
					hits += 1
					if alive[i] == 0:
						break
		else:
			for tid in targets.size():
				last_query_candidates += 1
				if _strike_if_hit(i, tid, targets, rng):
					hits += 1
					if alive[i] == 0:
						break

		if alive[i] == 1 and age[i] >= life[i]:
			release(i)
	return hits


## 命中判定 + 结算；返回是否真的打中
func _strike_if_hit(i: int, tid: int, targets: Array, rng: Object) -> bool:
	if tid < 0 or tid >= targets.size():
		return false
	var t = targets[tid]
	if t == _attackers[i]:
		return false
	if t.is_dead():
		return false
	var base := i * HIT_MEMO
	# 命中冷却：只查该发自己的定长记忆槽，零分配
	for k in HIT_MEMO:
		if _memo_tid[base + k] == tid and _clock - _memo_t[base + k] < HIT_COOLDOWN_SEC:
			return false
	var to_t: Vector2 = t.global_position - Vector2(px[i], py[i])
	var rr: float = radius[i] + t.radius()
	if to_t.length_squared() > rr * rr:
		return false

	# defender 契约：必须传带 .stats 的实体本身（G7 时代的同一个坑）
	# 复用同一个 hitbox：它只做 packet 快照 + 调纯函数结算，不持有归属状态
	_hitbox.packet = _packets[i]
	_hitbox.attacker_stats = _stats[i]
	_hitbox.strike(t.hurtbox, rng, t)
	last_hit_points.append(t.global_position)
	# 写入记忆槽：优先占空位，满了顶掉最旧的一条
	var slot_k := 0
	var oldest := INF
	for k in HIT_MEMO:
		var idx := base + k
		if _memo_tid[idx] < 0:
			slot_k = k
			oldest = -1.0
			break
		if _memo_t[idx] < oldest:
			oldest = _memo_t[idx]
			slot_k = k
	_memo_tid[base + slot_k] = tid
	_memo_t[base + slot_k] = _clock
	# ---- 连锁 / 分裂（D-34）：先偏转，再分裂，最后才走穿透/消亡 ----
	# 环绕弹（D-36）跳过：角速度积分与偏转/分裂的运动语义互斥
	var chained := false
	if chain[i] > 0 and orb_radius[i] < 0.0:
		var cid := _pick_chain_target(i, targets)
		if cid >= 0:
			_redirect(i, targets[cid].global_position)
			chain[i] -= 1
			chained = true
	if fork[i] > 0 and orb_radius[i] < 0.0:
		var f := fork[i]
		fork[i] = 0
		_spawn_forks(i, f - 1, tid)
		if not chained:
			release(i)   # 分裂本体消亡（除非本轮已连锁偏转，让连锁优先续命）
			return true
	if chained:
		return true   # 连锁偏转后继续飞，不消耗穿透
	if orb_radius[i] >= 0.0:
		return true   # 环绕弹命中不消亡（D-36）：持续期内反复接触，靠命中冷却限频，寿命到期才回收
	if pierce[i] <= 0:
		release(i)
	else:
		pierce[i] -= 1
	return true


## 连锁目标选取（D-34）：最近的、本弹没打过的存活目标。
## 「没打过」查整段命中记忆（不做时间窗），保证连锁不会原地打转。
## 无射程限制：沙盒三木桩场景下无意义，接竞技场时再补 chain_range 参数。
func _pick_chain_target(i: int, targets: Array) -> int:
	var best := -1
	var best_d := INF
	var base := i * HIT_MEMO
	for tid in targets.size():
		var t = targets[tid]
		if t == _attackers[i] or t.is_dead():
			continue
		var hit_before := false
		for k in HIT_MEMO:
			if _memo_tid[base + k] == tid:
				hit_before = true
				break
		if hit_before:
			continue
		var d: float = Vector2(px[i], py[i]).distance_squared_to(t.global_position)
		if d < best_d:
			best_d = d
			best = tid
	return best


## 连锁偏转：保持速率，改朝目标方向（D-34）
func _redirect(i: int, target_pos: Vector2) -> void:
	var speed := Vector2(vx[i], vy[i]).length()
	var dir := (target_pos - Vector2(px[i], py[i])).normalized()
	if speed <= 0.001:
		speed = 1.0   # 静止弹也给出方向（测试里 speed=0 仍可断言朝向）
	vx[i] = dir.x * speed
	vy[i] = dir.y * speed


## 分裂（D-34）：本体位置生成 ±35° 两发，继承剩余连锁/穿透/寿命/半径/弹速。
## 分裂弹继承 packet/stats 引用 —— packet 是只读快照，共享安全（与 pierce 同一约定）。
## hit_tid 写进分裂弹的命中记忆：分裂点就在被击目标身上，不预记会同一帧回打目标。
func _spawn_forks(i: int, fork_remaining: int, hit_tid: int) -> void:
	var pos := Vector2(px[i], py[i])
	var speed := Vector2(vx[i], vy[i]).length()
	var dir := Vector2(vx[i], vy[i]).normalized()
	var life_left := maxf(life[i] - age[i], 0.05)
	for angle in [-35.0, 35.0]:
		var j := spawn(pos + dir * (radius[i] + 2.0), dir.rotated(deg_to_rad(angle)),
				speed, life_left, radius[i], pierce[i], _packets[i],
				_attackers[i], _stats[i], chain[i], fork_remaining)
		if j >= 0:
			var base := j * HIT_MEMO
			_memo_tid[base] = hit_tid
			_memo_t[base] = _clock


## 渲染层用：取第 i 发的视觉参数（不暴露内部数组语义）
func visual(i: int) -> Dictionary:
	return {&"pos": Vector2(px[i], py[i]), &"radius": radius[i], &"age": age[i], &"life": life[i]}


## 清空（测试/切场景用）
func clear_all() -> void:
	for i in capacity:
		if alive[i] == 1:
			release(i)
	_clock = 0.0
