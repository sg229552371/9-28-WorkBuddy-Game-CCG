# M8 特效池测试（2026-10-19 R4）：EffectPool
# 目标：验证「节点数永不超 cap」「满了回收最旧」「到期自动熄灭」三条硬规则。
# 说明：headless 下 GPUParticles2D 不真正渲染，但节点、emitting 状态、槽位账本都能断言。
extends GutTest

const PoolScript := preload("res://mods/jes-skills/systems/perf/effect_pool.gd")

var pool: EffectPool = null


func before_each() -> void:
	pool = autofree(PoolScript.new(4, 2))


func after_each() -> void:
	pool = null


func test_ef1_prewarm_builds_idle_nodes() -> void:
	assert_eq(pool.node_count(), 2, "预建数量应等于 prewarm 参数")
	assert_eq(pool.active_count(), 0, "预建节点都是空闲的")
	assert_eq(pool.get_node_at(0).emitting, false, "预建节点不得处于发射状态")
	assert_eq(pool.get_node_at(0).one_shot, true, "特效是一次性爆发")


func test_ef2_emit_starts_particles() -> void:
	var i := pool.emit_at(Vector2(12, 34), Color.RED, 0.4)
	assert_gte(i, 0, "应拿到槽位")
	assert_eq(pool.active_count(), 1)
	assert_true(pool.get_node_at(i).emitting, "发射中 emitting 必须为 true")
	assert_eq(pool.get_node_at(i).position, Vector2(12, 34), "位置应落在命中点")
	assert_eq(pool.get_node_at(i).modulate, Color.RED)


func test_ef3_advance_expires_and_frees_slot() -> void:
	var i := pool.emit_at(Vector2.ZERO, Color.WHITE, 0.3)
	pool.advance(0.1)
	assert_true(pool.is_active(i), "未到期应仍在占用")
	pool.advance(0.25)
	assert_false(pool.is_active(i), "到期应归还槽位")
	assert_eq(pool.get_node_at(i).emitting, false, "到期必须熄灭，否则粒子会一直挂在那")
	assert_eq(pool.active_count(), 0)


func test_ef4_advance_twice_does_not_double_free() -> void:
	var i := pool.emit_at(Vector2.ZERO, Color.WHITE, 0.1)
	pool.advance(0.2)
	pool.advance(0.2)
	assert_eq(pool.active_count(), 0)
	# 双归还会把同一槽位塞进空闲表两次 → 两发特效抢一个节点
	assert_eq(pool.emit_at(Vector2.ZERO), i, "空闲表应只含一个该槽位")
	pool.advance(0.0)
	assert_eq(pool.active_count(), 1)


func test_ef5_grows_only_up_to_cap() -> void:
	for i in 4:
		pool.emit_at(Vector2.ZERO, Color.WHITE, 10.0)
	assert_eq(pool.node_count(), 4, "应增长到 cap")
	assert_eq(pool.active_count(), 4)
	# 第 5 发：已满 → 复用，不再建节点
	var slot := pool.emit_at(Vector2.ONE, Color.BLUE, 10.0)
	assert_eq(pool.node_count(), 4, "硬上限：节点数永不增长")
	assert_gte(slot, 0, "满容量时应回收而非失败")


func test_ef6_recycles_oldest_slot() -> void:
	var first := pool.emit_at(Vector2.ZERO, Color.WHITE, 10.0)
	pool.emit_at(Vector2.ONE, Color.WHITE, 10.0)
	pool.emit_at(Vector2.ONE * 2, Color.WHITE, 10.0)
	pool.emit_at(Vector2.ONE * 3, Color.WHITE, 10.0)
	var recycled := pool.emit_at(Vector2(9, 9), Color.GREEN, 10.0)
	assert_eq(recycled, first, "满容量应回收最旧的那个槽位")
	assert_eq(pool.get_node_at(recycled).position, Vector2(9, 9), "回收槽位应写入新位置")


func test_ef7_children_never_exceed_cap() -> void:
	for i in 20:
		pool.emit_at(Vector2.ZERO, Color.WHITE, 10.0)
	assert_eq(pool.get_child_count(), 4, "子节点数必须恒等于 cap")


func test_ef8_clear_all_frees_everything() -> void:
	pool.emit_at(Vector2.ZERO, Color.WHITE, 10.0)
	pool.emit_at(Vector2.ONE, Color.WHITE, 10.0)
	pool.clear_all()
	assert_eq(pool.active_count(), 0, "全部熄灭")
	assert_false(pool.get_node_at(0).emitting)
	# 清空后复用已有节点，不销毁也不重建
	var i := pool.emit_at(Vector2.ONE, Color.WHITE, 10.0)
	assert_gte(i, 0)
	assert_eq(pool.node_count(), 2, "clear 只归还槽位，节点数不变")


func test_ef9_reuse_does_not_reset_position_of_others() -> void:
	var a := pool.emit_at(Vector2(1, 1), Color.WHITE, 10.0)
	var b := pool.emit_at(Vector2(2, 2), Color.WHITE, 10.0)
	assert_ne(a, b, "两发特效必须落在不同槽位")
	assert_eq(pool.get_node_at(a).position, Vector2(1, 1))
	assert_eq(pool.get_node_at(b).position, Vector2(2, 2))
