# M8 压测脚本（规格 §9.1）：300 弹 × 80 敌人，量「纯逻辑层」每帧开销。
#
# 跑法（headless，不需要显卡）：
#   godot --headless --path . -s res://mods/jes-skills/tests/perf/bench_projectiles.gd
#
# 说明：
# - 本脚本只测「更新 + 碰撞查询」这一层，不含渲染（headless 无渲染器）。
#   渲染层的成本是 1 个 MultiMeshInstance2D 的 1 次 draw call，与弹数无关。
# - 稳态补弹：每帧把到寿命的子弹补回 300 发，避免「后半段空场」把均值压低。
# - 同时跑一遍 hash=null 的暴力路径做对照，验证 §9.2 的收益不是纸面推算。
extends SceneTree

const FRAMES := 400
const WARMUP := 30
const ENEMY_COUNT := 80
const BULLET_COUNT := 300
const BULLET_SPEED := 700.0
const BULLET_RADIUS := 8.0
const ENEMY_RADIUS := 20.0
const CELL_SIZE := 64.0
const FIELD_W := 1600.0
const FIELD_H := 1200.0


class DummyHurtbox extends RefCounted:
	var receives: int = 0

	func receive_hit(_hit: Dictionary, _source) -> void:
		receives += 1


class DummyTarget extends RefCounted:
	var stats := StatsComponent.new()
	var hurtbox := DummyHurtbox.new()
	var global_position := Vector2.ZERO
	var _radius := 20.0

	func is_dead() -> bool:
		return false

	func radius() -> float:
		return _radius


func _initialize() -> void:
	# 造数据用一个 RNG；战斗 roll 走 RngService 的 damage 流（规格 §9.4 分流域）
	var setup_rng := RandomNumberGenerator.new()
	setup_rng.seed = 20261019
	var combat_rng := RngService.new(20261019)

	var targets: Array = []
	for i in ENEMY_COUNT:
		var t := DummyTarget.new()
		t.global_position = Vector2(setup_rng.randf_range(0, FIELD_W), setup_rng.randf_range(0, FIELD_H))
		targets.append(t)

	print("=== 投射物压测：%d 弹 × %d 敌（稳态） ===" % [BULLET_COUNT, ENEMY_COUNT])

	# 所有子弹共享同一个 attacker_stats 与 packet。
	# 早期版本每帧 new 一个 DamagePacket，而子弹寿命 3 秒 → 稳态会积压 180 个，
	# 被误读成"对象数爬升"。压测脚手架不应把自身分配算进被测代码。
	var shared_stats := StatsComponent.new()
	var shared_packet := DamagePacket.new()
	shared_packet.elements = {&"physical": 10.0}

	var hashed := ProjectileField.new(512)
	_run(hashed, targets, combat_rng, setup_rng, shared_stats, shared_packet, WARMUP)       # 预热
	var hr := _run(hashed, targets, combat_rng, setup_rng, shared_stats, shared_packet, FRAMES)
	print("哈希路径   tick 平均 %.3f ms/帧   平均候选 %d 个/帧" % [
		hr[&"ms"], int(hr[&"cand"])])
	print("网格重建   insert 平均 %.3f ms/帧（%d 个敌人）" % [hr[&"rebuild_ms"], ENEMY_COUNT])

	var brute := ProjectileField.new(512)
	_run(brute, targets, RngService.new(20261019), setup_rng, shared_stats, shared_packet, 3)   # 暴力路径太慢，少量预热
	var br := _run_brute(brute, targets, RngService.new(20261019), setup_rng, shared_stats, shared_packet, 20)
	print("暴力路径   tick 平均 %.3f ms/帧（%d 次/帧的距离判定）" % [
		br[&"ms"], BULLET_COUNT * ENEMY_COUNT])

	var total: float = hr[&"ms"] + hr[&"rebuild_ms"]
	print("哈希方案逻辑层合计 %.3f ms/帧 → 16.6ms 预算占用 %.1f%%" % [total, total / 16.6 * 100.0])
	print("加速比 %.1f×（相对暴力全扫）" % [float(br[&"ms"]) / maxf(float(hr[&"ms"]), 0.0001)])

	# ---- 分配尖刺（§11 M8 门禁「GC 峰值无尖刺」）----
	print("")
	print("--- 分配尖刺（%d 帧稳态）---" % FRAMES)
	print("单帧耗时   均值 %.1f us   p99 %.1f us   max %.1f us   尖刺比 max/mean %.2f×" % [
		hr[&"mean_us"], hr[&"p99_us"], hr[&"max_us"], hr[&"spike_ratio"]])
	print("对象数     峰值 +%d 个   稳态增长 %+d 个（应 == 0）" % [
		int(hr[&"obj_delta"]), int(hr[&"obj_growth"])])
	print("静态内存   峰值 +%.1f KB   稳态增长 %+.1f KB（应 ≈ 0）" % [
		float(hr[&"mem_delta_kb"]), float(hr[&"mem_growth_kb"])])
	var spike_ok: bool = float(hr[&"spike_ratio"]) < 10.0
	var obj_ok: bool = int(hr[&"obj_growth"] ) <= 0
	print("尖刺结论：%s" % (
		"达标（尖刺比 < 10×、稳态对象数无增长）" if (spike_ok and obj_ok)
		else "未达标（稳态对象数仍爬升，检查每帧分配）"))

	print("结论：%s" % ("达标（< 4ms）" if total < 4.0 else "未达标，需要继续压"))

	quit(0)


## 补足到 BULLET_COUNT 发（不计入测量时间）
## 注意：stats 复用同一个实例 —— 真实游戏里 attacker_stats 是发射者的引用，
## 不是每发一份。早期版本在这里 new 了 300 个 StatsComponent，会把对象数曲线撑坏。
func _refill(field: ProjectileField, rng: RandomNumberGenerator,
		shared_stats: StatsComponent, shared_packet: DamagePacket) -> void:
	var need := BULLET_COUNT - field.active_count()
	if need <= 0:
		return
	for i in need:
		var pos := Vector2(rng.randf_range(0, FIELD_W), rng.randf_range(0, FIELD_H))
		field.spawn(pos, Vector2.RIGHT.rotated(rng.randf() * TAU),
				BULLET_SPEED, 3.0, BULLET_RADIUS, 2, shared_packet, null, shared_stats)


func _run(field: ProjectileField, targets: Array, rng: RngService, setup_rng: RandomNumberGenerator,
		shared_stats: StatsComponent, shared_packet: DamagePacket, frames: int) -> Dictionary:
	var grid := SkillSpatialHash.new(CELL_SIZE)
	var acc_us := 0
	var rebuild_us := 0
	var cand := 0
	var samples := PackedInt32Array()
	samples.resize(frames)
	var obj_at := PackedInt32Array()
	obj_at.resize(frames)
	var mem_at := PackedInt32Array()
	mem_at.resize(frames)

	# 分配尖刺基线（规格 §11 M8 门禁「GC 峰值无尖刺」）
	# Godot 用引用计数而非分代 GC，这里的等价判据是：稳态下对象数 / 静态内存不持续爬升，
	# 且单帧耗时的 max/均值 比不出现数量级尖刺。
	var obj_base := int(Performance.get_monitor(Performance.OBJECT_COUNT))
	var mem_base := int(Performance.get_monitor(Performance.MEMORY_STATIC))
	var obj_peak := obj_base
	var mem_peak := mem_base

	for f in frames:
		_refill(field, setup_rng, shared_stats, shared_packet)
		var t0 := Time.get_ticks_usec()
		grid.clear()
		for i in targets.size():
			grid.insert(i, targets[i].global_position)
		var t1 := Time.get_ticks_usec()
		field.tick(1.0 / 60.0, grid, ENEMY_RADIUS, targets, rng)
		var t2 := Time.get_ticks_usec()
		rebuild_us += t1 - t0
		acc_us += t2 - t1
		cand += field.last_query_candidates
		samples[f] = t2 - t0
		obj_at[f] = int(Performance.get_monitor(Performance.OBJECT_COUNT))
		mem_at[f] = int(Performance.get_monitor(Performance.MEMORY_STATIC))
		obj_peak = maxi(obj_peak, obj_at[f])
		mem_peak = maxi(mem_peak, mem_at[f])

	samples.sort()
	var mean_us := float(acc_us + rebuild_us) / float(frames)
	var p99_us := float(samples[mini(int(float(frames) * 0.99), frames - 1)])
	var max_us := float(samples[frames - 1])
	# 稳态判据：预热后的对象数/内存**不得继续爬升**。
	# 只看峰值会把"预热期填充池"误判成泄漏，所以取后半段（第 50% 帧）与末帧的差。
	var warm := mini(maxi(frames / 2, 1), frames - 1)
	return {
		&"ms": float(acc_us) / float(frames) / 1000.0,
		&"rebuild_ms": float(rebuild_us) / float(frames) / 1000.0,
		&"cand": float(cand) / float(frames),
		&"mean_us": mean_us,
		&"p99_us": p99_us,
		&"max_us": max_us,
		&"spike_ratio": max_us / maxf(mean_us, 0.0001),
		&"obj_delta": obj_peak - obj_base,
		&"obj_growth": obj_at[frames - 1] - obj_at[warm],
		&"mem_delta_kb": float(mem_peak - mem_base) / 1024.0,
		&"mem_growth_kb": float(mem_at[frames - 1] - mem_at[warm]) / 1024.0,
	}


func _run_brute(field: ProjectileField, targets: Array, rng: RngService,
		setup_rng: RandomNumberGenerator, shared_stats: StatsComponent,
		shared_packet: DamagePacket, frames: int) -> Dictionary:
	var acc_us := 0
	for f in frames:
		_refill(field, setup_rng, shared_stats, shared_packet)
		var t0 := Time.get_ticks_usec()
		field.tick(1.0 / 60.0, null, ENEMY_RADIUS, targets, rng)
		acc_us += Time.get_ticks_usec() - t0
	return {&"ms": float(acc_us) / float(frames) / 1000.0}
