## FlowField 单元测试（验收口径：docs/玩法问题诊断与修复方案_v1.md §2.3）
extends GutTest

func _ff(w: int, h: int, cs: float) -> FlowField:
	var f := FlowField.new()
	f.setup(Vector2(w * cs, h * cs), cs)
	return f

func test_无墙_直线指向目标() -> void:
	var f := _ff(8, 6, 48.0)
	f.recompute(Vector2(384.0, 48.0))          # 目标在格 (8,1) 右上角附近 → 取 (7,0)? 换用格中心更稳
	f = _ff(8, 6, 48.0)
	f.recompute(Vector2(96.0, 48.0))           # 目标 = 格 (2,1) 中心
	var dir: Vector2 = f.sample(Vector2(24.0, 24.0))   # 格 (0,0) 中心
	assert_gt(dir.x, 0.7)                       # 主要向右
	assert_almost_eq(dir.y, 0.0, 0.5)           # 垂直分量次要

func test_已到目标格_零向量() -> void:
	var f := _ff(8, 6, 48.0)
	f.recompute(Vector2(24.0, 24.0))
	assert_eq(f.sample(Vector2(24.0, 24.0)), Vector2.ZERO)

func test_凹形墙_死端指向出口() -> void:
	# 12x6 格，格尺寸 48：在 y=2~3 行铺横墙，仅 x=8 处留口（2 格宽）
	var f := _ff(12, 6, 48.0)
	f.set_walls([Rect2(0, 96, 384, 96), Rect2(432, 96, 144, 96)])   # 口在 x∈[384,432)
	f.recompute(Vector2(408.0, 120.0))                          # 目标 = 下方格中心 (8,2)... 下方在口右
	# 口下方格 (8,3)：方向应向上穿口（Godot y 向下为正 → 向上 = 负）
	var dir: Vector2 = f.sample(Vector2(408.0, 168.0))
	assert_lt(dir.y, -0.5)                                       # 向上穿口
	# 目标放在口上方：死端选下半场非墙格 (0,4)，应向右绕到口
	f.recompute(Vector2(408.0, 72.0))
	var d2: Vector2 = f.sample(Vector2(24.0, 216.0))
	assert_gt(d2.x, 0.5)                                         # 死端必须向右走（口在右侧）

func test_墙格_不可达与零向量() -> void:
	var f := _ff(6, 6, 48.0)
	f.set_walls([Rect2(96, 0, 48, 48)])     # 格 (2,0) 是墙
	f.recompute(Vector2(24.0, 24.0))
	assert_true(f.is_blocked(Vector2(120.0, 24.0)))
	assert_false(f.is_blocked(Vector2(24.0, 24.0)))
	assert_eq(f.sample(Vector2(120.0, 24.0)), Vector2.ZERO)   # 墙内零向量

func test_被墙完全围死_不可达回退() -> void:
	var f := _ff(6, 6, 48.0)
	f.set_walls([Rect2(96, 0, 48, 288), Rect2(96, 336, 48, 48)])   # 竖墙封死 x=2 列
	f.recompute(Vector2(24.0, 24.0))
	assert_true(f.is_blocked(Vector2(120.0, 312.0)))               # 右侧小口袋不可达
	assert_eq(f.sample(Vector2(120.0, 312.0)), Vector2.ZERO)

func test_目标更新_方向反转() -> void:
	var f := _ff(8, 2, 48.0)
	f.recompute(Vector2(24.0, 24.0))            # 目标在最左
	var right: Vector2 = f.sample(Vector2(336.0, 24.0))
	assert_lt(right.x, -0.5)                    # 向左
	f.recompute(Vector2(360.0, 24.0))           # 目标改到最右
	var left: Vector2 = f.sample(Vector2(24.0, 24.0))
	assert_gt(left.x, 0.5)                      # 向右
