# M8 性能地基测试（2026-10-19 R3）：SpatialHash + RngService
# 这两个模块是 §9.2 / §9.4 的硬要求，且都是纯逻辑，可全量 headless 验证。
extends GutTest

const SpatialHashScript := preload("res://mods/jes-skills/systems/perf/spatial_hash.gd")
const RngServiceScript := preload("res://mods/jes-skills/systems/skills/util/rng_service.gd")


# ---------------- SpatialHash ----------------

func _make_hash(cell: float = 32.0) -> SkillSpatialHash:
	return SpatialHashScript.new(cell)


func test_p1_insert_count_clear() -> void:
	var h := _make_hash()
	assert_true(h.is_empty())
	h.insert(1, Vector2(10, 10))
	h.insert(2, Vector2(100, 100))
	assert_eq(h.count(), 2)
	h.clear()
	assert_true(h.is_empty(), "clear 后应为空")

func test_p2_query_filters_by_distance() -> void:
	var h := _make_hash(32.0)
	h.insert(1, Vector2(0, 0))
	h.insert(2, Vector2(20, 0))     # 同格附近
	h.insert(3, Vector2(200, 0))    # 远处
	var got := h.query_near(Vector2(0, 0), 25.0)
	got.sort()
	assert_eq(got, [1, 2], "只返回半径内的")

func test_p3_query_across_cell_boundary() -> void:
	var h := _make_hash(32.0)
	# (31,31) 与 (33,33) 属不同格子，但直线距离 < 3
	h.insert(7, Vector2(33, 33))
	var got := h.query_near(Vector2(31, 31), 4.0)
	assert_eq(got, [7], "跨格邻居必须能查到")

func test_p4_negative_coordinates() -> void:
	var h := _make_hash(32.0)
	h.insert(5, Vector2(-40, -40))
	assert_eq(h.cell_of(Vector2(-40, -40)), Vector2i(-2, -2), "负数坐标应向下取整")
	assert_eq(h.query_near(Vector2(-38, -38), 6.0), [5])

func test_p5_query_into_reuses_buffer() -> void:
	var h := _make_hash()
	h.insert(1, Vector2.ZERO)
	var buf: Array = [99, 98]      # 脏数据
	h.query_near_into(buf, Vector2.ZERO, 10.0)
	assert_eq(buf, [1], "query_near_into 必须先清空再写入")

func test_p6_nearest() -> void:
	var h := _make_hash()
	assert_eq(h.nearest(Vector2.ZERO, 100.0), -1, "空哈希应返回 -1")
	h.insert(1, Vector2(30, 0))
	h.insert(2, Vector2(10, 0))
	h.insert(3, Vector2(500, 0))
	assert_eq(h.nearest(Vector2.ZERO, 100.0), 2, "应返回最近且在半径内的")
	assert_eq(h.nearest(Vector2.ZERO, 5.0), -1, "半径内无目标应返回 -1")

## 与暴力遍历结果逐项一致（这是哈希正确性的唯一可信判据），并顺带验证有效性
func test_p7_matches_brute_force() -> void:
	var h := _make_hash(24.0)
	var ids: Array = []
	var pts: Array = []
	for i in 300:
		var p := Vector2(float((i * 37) % 800) - 400.0, float((i * 53) % 800) - 400.0)
		ids.append(i)
		pts.append(p)
		h.insert(i, p)
	var mismatches := 0
	var max_hits := 0
	for i in 120:
		var q := Vector2(float((i * 71) % 800) - 400.0, float((i * 29) % 800) - 400.0)
		var r := 30.0
		var fast: Array = h.query_near(q, r)
		var slow: Array = []
		for k in pts.size():
			if (pts[k] as Vector2).distance_squared_to(q) <= r * r:
				slow.append(ids[k])
		fast.sort()
		slow.sort()
		if fast != slow:
			mismatches += 1
		max_hits = maxi(max_hits, fast.size())
	assert_eq(mismatches, 0, "哈希查询必须与暴力遍历完全一致")
	assert_lt(max_hits, 60, "单次查询返回量应远小于总数 300（哈希生效）")


# ---------------- RngService ----------------

func test_r1_deterministic_same_seed() -> void:
	var a: RngService = RngServiceScript.new(12345)
	var b: RngService = RngServiceScript.new(12345)
	for i in 50:
		assert_eq(a.roll(RngService.STREAM_DAMAGE, i, 3), b.roll(RngService.STREAM_DAMAGE, i, 3),
			"同 seed 同输入必须同结果（第 %d 次）" % i)

func test_r2_stream_independence() -> void:
	var a: RngService = RngServiceScript.new(777)
	var b: RngService = RngServiceScript.new(777)
	# b 先大量消耗 cosmetic 流，不应影响 damage 流
	for i in 100:
		b.roll(RngService.STREAM_COSMETIC, i, 0)
	assert_eq(a.roll(RngService.STREAM_DAMAGE, 10, 0), b.roll(RngService.STREAM_DAMAGE, 10, 0),
		"表现层随机不得污染战斗随机")
	# 不同流之间应当拿到不同值（极高概率）
	assert_ne(a.roll(RngService.STREAM_DAMAGE, 10, 0), a.roll(RngService.STREAM_COSMETIC, 10, 0),
		"不同 stream 应产生不同序列")

func test_r3_different_seed_changes_sequence() -> void:
	var a: RngService = RngServiceScript.new(1)
	var b: RngService = RngServiceScript.new(2)
	var same := 0
	for i in 20:
		if is_equal_approx(a.roll(RngService.STREAM_DAMAGE, i), b.roll(RngService.STREAM_DAMAGE, i)):
			same += 1
	assert_eq(same, 0, "不同 seed 的序列不应重合")

func test_r4_uniform_distribution() -> void:
	var rng: RngService = RngServiceScript.new(20261019)
	var sum := 0.0
	var n := 10000
	var lo := 1.0
	var hi := 0.0
	for i in n:
		var v := rng.roll(RngService.STREAM_DAMAGE, 0, i)
		sum += v
		lo = minf(lo, v)
		hi = maxf(hi, v)
	var mean := sum / float(n)
	assert_almost_eq(mean, 0.5, 0.02, "均值应接近 0.5，实测 %.4f" % mean)
	assert_true(lo >= 0.0 and hi < 1.0, "取值范围必须落在 [0,1)")
	assert_gt(hi - lo, 0.99, "应覆盖几乎整个区间")

func test_r5_chance_extremes() -> void:
	var rng: RngService = RngServiceScript.new(9)
	for i in 20:
		assert_false(rng.chance(RngService.STREAM_DAMAGE, i, 0, 0.0), "概率 0 永不命中")
		assert_true(rng.chance(RngService.STREAM_DAMAGE, i, 0, 1.0), "概率 1 必定命中")

func test_r6_range_bounds() -> void:
	var rng: RngService = RngServiceScript.new(31)
	for i in 200:
		var f := rng.range_float(RngService.STREAM_LOOT, i, 0, -5.0, 5.0)
		assert_true(f >= -5.0 and f < 5.0, "range_float 越界: %f" % f)
		var n := rng.range_int(RngService.STREAM_LOOT, i, 1, 3, 7)
		assert_true(n >= 3 and n <= 7, "range_int 越界: %d" % n)

func test_r7_hash32_bounds() -> void:
	for x in [-1, 0, 1, 12345, 0x7FFFFFFF, -123456789]:
		var h: int = RngServiceScript.hash32(x)
		assert_true(h >= 0 and h <= 0xFFFFFFFF, "hash32 必须落在 32 位无符号范围")
