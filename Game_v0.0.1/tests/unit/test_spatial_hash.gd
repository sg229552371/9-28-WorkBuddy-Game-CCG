## SpatialHash 单元测试（对译自 HTLM 全量门禁中 spatial_test 的口径）
extends GutTest

func _mk(id: int) -> Object:
	var o := RefCounted.new()
	o.set_meta("id", id)
	return o

func test_query_hits_circle() -> void:
	var h := SpatialHash.new(96)
	var a := _mk(1)
	h.insert(a, 100.0, 100.0, 10.0)
	var out: Array = []
	h.query(110.0, 100.0, 20.0, out)
	assert_eq(out.size(), 1)
	assert_eq(out[0], a)

func test_query_misses_outside() -> void:
	var h := SpatialHash.new(96)
	h.insert(_mk(1), 500.0, 500.0, 5.0)
	var out: Array = []
	h.query(100.0, 100.0, 20.0, out)
	assert_eq(out.size(), 0)

func test_cross_cell_dedup() -> void:
	var h := SpatialHash.new(96)
	var a := _mk(7)
	# 半径 150 跨多个桶
	h.insert(a, 100.0, 100.0, 150.0)
	var out: Array = []
	h.query(0.0, 0.0, 1.0, out)
	assert_eq(out.size(), 1)
	out = []
	h.query(200.0, 200.0, 1.0, out)
	assert_eq(out.size(), 1)

func test_multi_query_same_frame() -> void:
	var h := SpatialHash.new(96)
	var a := _mk(1)
	var b := _mk(2)
	h.insert(a, 100.0, 100.0, 5.0)
	h.insert(b, 100.0, 100.0, 5.0)
	var out1: Array = []
	h.query(100.0, 100.0, 10.0, out1)
	assert_eq(out1.size(), 2)
	var out2: Array = []
	h.query(100.0, 100.0, 10.0, out2)
	assert_eq(out2.size(), 2)   # 第二次查询去重标记不同，不丢对象

func test_clear_invalidates() -> void:
	var h := SpatialHash.new(96)
	var a := _mk(1)
	h.insert(a, 100.0, 100.0, 5.0)
	var out: Array = []
	h.query(100.0, 100.0, 10.0, out)
	assert_eq(out.size(), 1)
	h.clear()   # 桶清空：即使标记失效也无对象可查
	out = []
	h.query(100.0, 100.0, 10.0, out)
	assert_eq(out.size(), 0)

func test_auto_cell_tiers() -> void:
	assert_eq(SpatialHash.auto_cell(499), 96)
	assert_eq(SpatialHash.auto_cell(500), 128)
	assert_eq(SpatialHash.auto_cell(1499), 128)
	assert_eq(SpatialHash.auto_cell(1500), 192)

func test_retune_clears_buckets() -> void:
	var h := SpatialHash.new(96)
	assert_false(h.retune(100))       # 同档 96 → 不变
	assert_true(h.retune(1000))       # 96 → 128，清桶
	assert_eq(h.cell, 128)
	assert_true(h._buckets.is_empty())
