# M8 投射物 SoA 容器测试（2026-10-19 R4）：ProjectileField
# 目标：headless 验证「无 Node 的投射物」在生命周期/命中/穿透/容量/哈希一致性上全部正确。
# 硬门禁：不建任何投射物 Node；目标用鸭子类型假体；RNG 注入固定种子。
extends GutTest

const FieldScript := preload("res://mods/jes-skills/systems/skills/combat/projectile_field.gd")


# ---------------- 假体（鸭子类型契约：is_dead/global_position/radius/hurtbox/stats） ----------------

class FakeHurtbox extends RefCounted:
	var hits: Array = []

	func receive_hit(hit: Dictionary, _source) -> void:
		hits.append(hit)


class FakeTarget extends RefCounted:
	var stats := StatsComponent.new()
	var hurtbox := FakeHurtbox.new()
	var global_position := Vector2.ZERO
	var dead := false
	var _radius := 20.0

	func _init(pos: Vector2, r: float = 20.0) -> void:
		global_position = pos
		_radius = r
		# 注意：这里**不能**让 hurtbox 反向持有 target —— RefCounted 不回收引用环，
		# 双向引用会直接变成 ObjectDB 泄漏（824 个实例的教训）

	func is_dead() -> bool:
		return dead

	func radius() -> float:
		return _radius

	func hit_count() -> int:
		return hurtbox.hits.size()

	func damage_taken() -> float:
		var total := 0.0
		for h in hurtbox.hits:
			total += float(h.get(&"total", 0.0))
		return total


# ---------------- 工具 ----------------

var field: ProjectileField = null
var rng := RngService.new(12345)


func before_each() -> void:
	rng = RngService.new(12345)   # 每个用例重置：同 seed ⇒ 同暴击序列
	field = FieldScript.new(16)


func after_each() -> void:
	# RefCounted 靠引用计数释放；显式置空让内部的复用 Hitbox(Area2D) 及时 free
	field = null


func _packet(amount: float = 10.0) -> DamagePacket:
	var p := DamagePacket.new()
	p.elements = {&"physical": amount}
	p.source_instance_id = &"test"
	return p


func _spawn(from: Vector2, dir: Vector2, speed: float, life: float,
		radius: float, pierce: int) -> int:
	return field.spawn(from, dir, speed, life, radius, pierce,
			_packet(), null, StatsComponent.new())


func _hash_of(targets: Array, cell: float = 64.0) -> SkillSpatialHash:
	var h := SkillSpatialHash.new(cell)
	for i in targets.size():
		h.insert(i, targets[i].global_position)
	return h


# ---------------- 生命周期 ----------------

func test_pf1_spawn_writes_soa_fields() -> void:
	var i := _spawn(Vector2(10, 20), Vector2.RIGHT, 400.0, 1.5, 8.0, 2)
	assert_eq(i, 0, "首发应落在下标 0")
	assert_eq(field.alive[i], 1)
	assert_almost_eq(field.px[i], 10.0, 0.0001)
	assert_almost_eq(field.py[i], 20.0, 0.0001)
	assert_almost_eq(field.vx[i], 400.0, 0.0001, "朝右速度应全在 x 上")
	assert_almost_eq(field.vy[i], 0.0, 0.0001)
	assert_almost_eq(field.life[i], 1.5, 0.0001)
	assert_almost_eq(field.radius[i], 8.0, 0.0001)
	assert_eq(field.pierce[i], 2)
	assert_eq(field.active_count(), 1)


func test_pf2_direction_is_normalized() -> void:
	var i := _spawn(Vector2.ZERO, Vector2(3, 4), 100.0, 1.0, 4.0, 0)
	# (3,4) 归一化 = (0.6,0.8)：速度大小必须等于 speed，否则斜射更快
	assert_almost_eq(Vector2(field.vx[i], field.vy[i]).length(), 100.0, 0.0001)


func test_pf3_expires_after_lifetime() -> void:
	_spawn(Vector2.ZERO, Vector2.RIGHT, 60.0, 0.5, 4.0, 0)
	field.tick(0.2, null, 20.0, [], rng)
	assert_eq(field.active_count(), 1, "未到寿命应存活")
	field.tick(0.4, null, 20.0, [], rng)
	assert_eq(field.active_count(), 0, "超过寿命应自动回收")


func test_pf4_moves_along_velocity() -> void:
	var i := _spawn(Vector2.ZERO, Vector2.RIGHT, 100.0, 10.0, 4.0, 0)
	field.tick(0.5, null, 20.0, [], rng)
	assert_almost_eq(field.px[i], 50.0, 0.0001, "x 应前进 speed × dt")


# ---------------- 命中 ----------------

func test_pf5_hits_target_in_range_and_dies() -> void:
	var t := FakeTarget.new(Vector2(10, 0), 20.0)
	var targets := [t]
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 0)
	var hits := field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(hits, 1, "射程内应命中 1 次")
	assert_eq(t.hit_count(), 1, "hurtbox 应收到 1 次结算")
	assert_almost_eq(t.damage_taken(), 10.0, 0.0001, "无护甲时应吃满 10 点物理")
	assert_eq(field.active_count(), 0, "pierce=0 命中即消亡")


func test_pf6_pierce_keeps_projectile_alive() -> void:
	var t := FakeTarget.new(Vector2(10, 0), 20.0)
	var targets := [t]
	var i := _spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 2)
	field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(field.active_count(), 1, "还有穿透次数应存活")
	assert_eq(field.pierce[i], 1, "穿透次数应递减")


func test_pf7_out_of_range_misses() -> void:
	var t := FakeTarget.new(Vector2(200, 0), 20.0)
	var targets := [t]
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 0)
	var hits := field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(hits, 0, "超出 radius + target_radius 不应命中")
	assert_eq(t.hit_count(), 0)


func test_pf8_skips_attacker_itself() -> void:
	var self_target := FakeTarget.new(Vector2(5, 0), 20.0)
	var targets := [self_target]
	# attacker 就是自己 → 出生点重叠也不能自伤
	field.spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 0,
			_packet(), self_target, StatsComponent.new())
	field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(self_target.hit_count(), 0, "不得命中发射者自身")
	assert_eq(field.active_count(), 1, "未命中不应消亡")


func test_pf9_skips_dead_target() -> void:
	var t := FakeTarget.new(Vector2(10, 0), 20.0)
	t.dead = true
	var targets := [t]
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 0)
	field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(t.hit_count(), 0, "尸体不该被再次结算")


func test_pf10_hit_cooldown_blocks_retick() -> void:
	var t := FakeTarget.new(Vector2(10, 0), 20.0)
	var targets := [t]
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 99)
	field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(t.hit_count(), 1, "同一目标的重复命中受冷却限制（0.1s 内只结算 1 次）")
	# 冷却过后可以再次命中（穿透型弹幕持续啃同一个目标）
	field.tick(0.2, _hash_of(targets), 20.0, targets, rng)
	assert_eq(t.hit_count(), 2, "冷却结束后应可再次命中")


func test_pf11_multiple_targets_with_pierce() -> void:
	var a := FakeTarget.new(Vector2(10, 0), 14.0)
	var b := FakeTarget.new(Vector2(16, 0), 14.0)
	var c := FakeTarget.new(Vector2(22, 0), 14.0)
	var targets := [a, b, c]
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 2)
	var hits := field.tick(0.016, _hash_of(targets), 20.0, targets, rng)
	assert_eq(hits, 3, "pierce=2 应能连续命中 3 个目标（2 次后仍有 1 次）")
	assert_eq(field.active_count(), 0, "穿透耗尽后消亡")


# ---------------- 容量与池 ----------------

func test_pf12_capacity_recycles_oldest() -> void:
	field = FieldScript.new(3)
	var i0 := _spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	_spawn(Vector2(1, 0), Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	_spawn(Vector2(2, 0), Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	assert_eq(field.active_count(), 3)
	var i3 := _spawn(Vector2(99, 0), Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	assert_eq(field.active_count(), 3, "容量固定，永远不扩容")
	assert_eq(i3, i0, "满容量时应回收最旧的槽位（下标复用）")
	assert_almost_eq(field.px[i3], 99.0, 0.0001, "回收的槽位应写入新状态")


func test_pf13_release_is_idempotent() -> void:
	var i := _spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	field.release(i)
	field.release(i)
	field.release(999)
	assert_eq(field.active_count(), 0)
	# 二次 release 不应把槽位塞进空闲队列两次（否则会拿到同一槽位的两个持有者）
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	assert_eq(field.active_count(), 1)


func test_pf14_clear_all_empties_field() -> void:
	_spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	_spawn(Vector2.ONE, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	field.clear_all()
	assert_eq(field.active_count(), 0)
	assert_eq(field.pool.active_count(), 0, "池内的活跃计数也要归零")


# ---------------- 哈希正确性与收益 ----------------

func test_pf15_hash_result_matches_bruteforce() -> void:
	# 64 个目标排成 8×8 网格，间距 40px；一发大半径弹幕扫过去
	var targets: Array = []
	for gy in 8:
		for gx in 8:
			targets.append(FakeTarget.new(Vector2(gx * 40.0, gy * 40.0), 12.0))
	var with_hash := FieldScript.new(16)
	var no_hash := FieldScript.new(16)
	with_hash.spawn(Vector2(-30, -30), Vector2.RIGHT, 0.0, 9.0, 60.0, 999,
			_packet(), null, StatsComponent.new())
	no_hash.spawn(Vector2(-30, -30), Vector2.RIGHT, 0.0, 9.0, 60.0, 999,
			_packet(), null, StatsComponent.new())
	var h1 := with_hash.tick(0.016, _hash_of(targets, 40.0), 12.0, targets, rng)
	var h2 := no_hash.tick(0.016, null, 12.0, targets, rng)
	assert_eq(h1, h2, "哈希路径与暴力路径的命中数必须一致")
	assert_gt(h1, 0, "该场景应至少命中一个目标")
	with_hash = null
	no_hash = null


func test_pf16_hash_reduces_candidate_scan() -> void:
	# 200 个目标铺满 4000px 长条，弹幕只在一角：哈希应只扫到极小一部分
	var targets: Array = []
	for i in 200:
		targets.append(FakeTarget.new(Vector2(float(i) * 20.0, 0.0), 10.0))
	var hashed := FieldScript.new(4)
	hashed.spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 30.0, 999,
			_packet(), null, StatsComponent.new())
	hashed.tick(0.016, _hash_of(targets, 64.0), 10.0, targets, rng)
	var hashed_candidates := hashed.last_query_candidates

	var linear := FieldScript.new(4)
	linear.spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 30.0, 999,
			_packet(), null, StatsComponent.new())
	linear.tick(0.016, null, 10.0, targets, rng)
	var linear_candidates := linear.last_query_candidates

	assert_lt(hashed_candidates, linear_candidates,
			"哈希候选数（%d）必须远小于线性全扫（%d）" % [hashed_candidates, linear_candidates])
	assert_lt(hashed_candidates, 20, "本场景哈希候选应少于 20 个")
	hashed = null
	linear = null


# ---------------- 渲染接口 ----------------

func test_pf17_visual_reads_without_mutating() -> void:
	var i := _spawn(Vector2(7, 8), Vector2.RIGHT, 100.0, 2.0, 6.0, 0)
	var v := field.visual(i)
	assert_eq(v[&"pos"], Vector2(7, 8))
	assert_almost_eq(float(v[&"radius"]), 6.0, 0.0001)
	field.tick(0.1, null, 20.0, [], rng)
	var v2 := field.visual(i)
	assert_almost_eq(float(v2[&"pos"].x), 17.0, 0.0001, "visual 应反映推进后的位置")
	assert_almost_eq(float(v2[&"age"]), 0.1, 0.0001)


func test_pf18_is_alive_guards_bounds() -> void:
	assert_false(field.is_alive(-1))
	assert_false(field.is_alive(0))
	assert_false(field.is_alive(999))
	var i := _spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 4.0, 0)
	assert_true(field.is_alive(i))


# ---------------- 连锁 / 分裂（D-34） ----------------

func _spawn_full(from: Vector2, dir: Vector2, speed: float,
		chain: int, fork: int, pierce: int = 0) -> int:
	return field.spawn(from, dir, speed, 5.0, 8.0, pierce,
			_packet(), null, StatsComponent.new(), chain, fork)


func test_pf19_chain_redirects_to_nearest_unhit_target() -> void:
	var a := FakeTarget.new(Vector2(10, 0), 14.0)
	var b := FakeTarget.new(Vector2(100, -40), 14.0)
	var targets := [a, b]
	var i := _spawn_full(Vector2.ZERO, Vector2.RIGHT, 400.0, 1, 0)
	field.tick(0.016, _hash_of(targets), 14.0, targets, rng)
	assert_eq(a.hit_count(), 1, "应先命中最近的 A")
	assert_eq(field.chain[i], 0, "连锁次数应消耗 1")
	assert_true(field.is_alive(i), "连锁偏转后应继续飞")
	# 速度方向应改为朝向 B（速率不变）
	var vel := Vector2(field.vx[i], field.vy[i])
	assert_almost_eq(vel.length(), 400.0, 0.001, "偏转不得改变弹速")
	var to_b := (b.global_position - Vector2(field.px[i], field.py[i])).normalized()
	assert_gt(vel.normalized().dot(to_b), 0.99, "弹道应转向 B")


func test_pf20_chain_bounces_through_all_targets_then_dies() -> void:
	var a := FakeTarget.new(Vector2(10, 0), 14.0)
	var b := FakeTarget.new(Vector2(30, 0), 14.0)
	var c := FakeTarget.new(Vector2(50, 0), 14.0)
	var targets := [a, b, c]
	_spawn_full(Vector2.ZERO, Vector2.RIGHT, 400.0, 2, 0)
	# 有界循环推进：连锁 2 次应把 A→B→C 全部各打 1 次后消亡
	for _step in 40:
		if field.active_count() == 0:
			break
		field.tick(0.016, _hash_of(targets), 14.0, targets, rng)
	assert_eq(a.hit_count(), 1, "A 应被命中 1 次")
	assert_eq(b.hit_count(), 1, "B 应被连锁命中 1 次")
	assert_eq(c.hit_count(), 1, "C 应被连锁命中 1 次")
	assert_eq(field.active_count(), 0, "连锁耗尽且无穿透应消亡")


func test_pf21_fork_splits_into_two_on_hit() -> void:
	var a := FakeTarget.new(Vector2(10, 0), 14.0)
	var targets := [a]
	var i := _spawn_full(Vector2.ZERO, Vector2.RIGHT, 400.0, 0, 1)
	field.tick(0.016, _hash_of(targets), 14.0, targets, rng)
	assert_eq(a.hit_count(), 1)
	assert_eq(field.active_count(), 2, "分裂应产生两发新弹（本体消亡）")
	assert_false(field.is_alive(i), "分裂本体应消亡")
	# 两发分裂弹：fork 次数耗尽，弹道各偏 ±35°（速度方向都不再朝右）
	var dirs := []
	for j in field.capacity:
		if field.is_alive(j):
			assert_eq(field.fork[j], 0, "分裂弹不应再带分层次数")
			assert_eq(field.chain[j], 0)
			dirs.append(Vector2(field.vx[j], field.vy[j]).normalized().angle())
	assert_eq(dirs.size(), 2)
	assert_ne(absf(dirs[0] - dirs[1]), 0.0, "两发分裂弹方向应不同")
	assert_lt(absf(absf(dirs[0] - dirs[1]) - deg_to_rad(70.0)), 0.01,
			"两发分裂弹夹角应为 70°（±35°）")


func test_pf22_no_chain_fork_defaults_unchanged() -> void:
	# 旧调用点（不传尾参）行为必须逐位不变：命中即消亡、chain/fork 为 0
	var a := FakeTarget.new(Vector2(10, 0), 14.0)
	var targets := [a]
	var i := _spawn(Vector2.ZERO, Vector2.RIGHT, 0.0, 5.0, 8.0, 0)
	assert_eq(field.chain[i], 0)
	assert_eq(field.fork[i], 0)
	field.tick(0.016, _hash_of(targets), 14.0, targets, rng)
	assert_eq(a.hit_count(), 1)
	assert_eq(field.active_count(), 0, "默认参数下命中即消亡（零回归）")


# ---------------- 环绕轨迹（D-36） ----------------

func test_pf23_orbit_position_stays_on_circle() -> void:
	var i := _spawn_full(Vector2(90, 0), Vector2(0, 1), 375.0, 0, 0)
	field.configure_orbit(i, 90.0, false, 0.0)   # 静态锚点在原点，初相 0
	assert_almost_eq(field.px[i], 90.0, 0.001, "开启环绕后应立即落位到环上")
	# 推进 0.5s：角速度 = 375/90 ≈ 4.17 rad/s → 相位前进 ~2.08 rad，仍在半径 90 的圆上
	field.tick(0.5, null, 24.0, [], rng)
	var pos := Vector2(field.px[i], field.py[i])
	assert_almost_eq(pos.length(), 90.0, 0.01, "任意时刻都应留在环上")
	assert_gt(absf(pos.angle()), 1.5, "0.5s 应转过约 2 弧度（转速随 speed 走）")
	# 切向速度：模长不变
	assert_almost_eq(Vector2(field.vx[i], field.vy[i]).length(), 375.0, 0.001,
			"环绕不得改变弹速真源")


func test_pf24_orbit_follows_attacker() -> void:
	var attacker := FakeTarget.new(Vector2(1000, 0), 12.0)   # 借用假体当"可移动发射者"
	var i := field.spawn(Vector2(1090, 0), Vector2(0, 1), 375.0, 5.0, 8.0, 0,
			_packet(), attacker, StatsComponent.new())
	field.configure_orbit(i, 90.0, true, 0.0)
	# 发射者移动后，环绕中心应跟着走（手雷跟人语义）
	attacker.global_position = Vector2(2000, 0)
	field.tick(0.016, null, 24.0, [], rng)
	var pos := Vector2(field.px[i], field.py[i])
	assert_almost_eq((pos - Vector2(2000, 0)).length(), 90.0, 0.01,
			"环绕中心应跟随发射者当前位置")


func test_pf25_orbit_survives_hits_and_skips_chain() -> void:
	var a := FakeTarget.new(Vector2(90, 0), 14.0)
	var targets := [a]
	var i := _spawn_full(Vector2(90, 0), Vector2(0, 1), 375.0, 1, 0)   # 带连锁 1
	field.configure_orbit(i, 90.0, false, 0.0)
	field.tick(0.016, _hash_of(targets), 14.0, targets, rng)
	assert_eq(a.hit_count(), 1, "环绕弹扫过目标应命中")
	assert_true(field.is_alive(i), "环绕弹命中不消亡（寿命到期才回收）")
	assert_eq(field.chain[i], 1, "环绕弹不吃连锁（运动积分互斥）")
