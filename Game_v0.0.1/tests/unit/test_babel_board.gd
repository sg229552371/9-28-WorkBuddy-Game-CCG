## BabelBoard 单测：越界/占位/形状裁边/地形。
extends GutTest

const BoardScript = preload("res://mods/jes-babel/scripts/board_grid.gd")
const UnitScript = preload("res://mods/jes-babel/scripts/unit_state.gd")


func _mk_unit(id: String, is_player: bool = true) -> BabelUnit:
	return UnitScript.create_default(id, is_player)


func test_in_bounds() -> void:
	var b: BabelBoard = BoardScript.create_default()
	assert_true(b.in_bounds(Vector2i(0, 0)), "左上角在界内")
	assert_true(b.in_bounds(Vector2i(10, 8)), "右下角在界内")
	assert_false(b.in_bounds(Vector2i(11, 8)), "超出列数为越界")
	assert_false(b.in_bounds(Vector2i(5, 9)), "超出行数为越界")
	assert_false(b.in_bounds(Vector2i(-1, 0)), "负坐标越界")


func test_place_and_occupied_mutex() -> void:
	var b: BabelBoard = BoardScript.create_default()
	var a: BabelUnit = _mk_unit("a")
	var c: BabelUnit = _mk_unit("c")
	assert_true(b.place(a, Vector2i(2, 2)), "空格可放置")
	assert_false(b.place(c, Vector2i(2, 2)), "已占格不能放置")
	assert_eq(b.unit_at(Vector2i(2, 2)), a, "占位表记录先放置者")


func test_move_unit_blocked_by_occupied() -> void:
	var b: BabelBoard = BoardScript.create_default()
	var a: BabelUnit = _mk_unit("a")
	var c: BabelUnit = _mk_unit("c")
	b.place(a, Vector2i(1, 1))
	b.place(c, Vector2i(2, 1))
	assert_false(b.move_unit(a, Vector2i(2, 1)), "不能移动到已占格")
	assert_eq(b.unit_at(Vector2i(1, 1)), a, "移动失败后原格保留")
	assert_true(b.move_unit(a, Vector2i(3, 1)), "空格可移动")
	assert_eq(b.unit_at(Vector2i(3, 1)), a, "移动后新格登记")
	assert_null(b.unit_at(Vector2i(1, 1)), "移动后原格清空")


func test_cross_shape_five_cells_and_corner_clip() -> void:
	var b: BabelBoard = BoardScript.create_default()
	var cells: Array[Vector2i] = b.cells_in_shape("cross", Vector2i(5, 4), Vector2i(1, 0), 1)
	assert_eq(cells.size(), 5, "十字 1 格射程共 5 格")
	assert_true(cells.has(Vector2i(5, 4)), "十字含原格")
	var corner: Array[Vector2i] = b.cells_in_shape("cross", Vector2i(0, 0), Vector2i(1, 0), 1)
	assert_eq(corner.size(), 3, "角落十字裁边后剩原格与右下两格")
	assert_false(corner.has(Vector2i(-1, 0)), "越界格被剔除")


func test_3x3_nine_cells_and_corner_clip() -> void:
	var b: BabelBoard = BoardScript.create_default()
	var center: Array[Vector2i] = b.cells_in_shape("3x3", Vector2i(5, 4), Vector2i(1, 0), 0)
	assert_eq(center.size(), 9, "3x3 共 9 格")
	var corner: Array[Vector2i] = b.cells_in_shape("3x3", Vector2i(0, 0), Vector2i(1, 0), 0)
	assert_eq(corner.size(), 4, "角落 3x3 裁边后剩 4 格")


func test_line_and_pierce_exclude_origin() -> void:
	var b: BabelBoard = BoardScript.create_default()
	var line: Array[Vector2i] = b.cells_in_shape("line", Vector2i(2, 2), Vector2i(1, 0), 2)
	assert_eq(line.size(), 2, "直线 2 格")
	assert_false(line.has(Vector2i(2, 2)), "直线不含原格")
	assert_true(line.has(Vector2i(3, 2)) and line.has(Vector2i(4, 2)), "直线沿方向延伸")
	var pierce: Array[Vector2i] = b.cells_in_shape("pierce", Vector2i(2, 2), Vector2i(0, 1), 2)
	assert_false(pierce.has(Vector2i(2, 2)), "穿透不含原格")
	assert_true(pierce.has(Vector2i(2, 3)) and pierce.has(Vector2i(2, 4)), "穿透沿方向逐格")


func test_cover_terrain_recorded() -> void:
	var b: BabelBoard = BoardScript.create_default()
	b.set_terrain(Vector2i(4, 4), "cover", 20)
	b.set_terrain(Vector2i(5, 4), "fire")
	assert_eq(b.terrain_at(Vector2i(4, 4)), "cover", "掩体格类型记录")
	assert_eq(int((b.terrain[Vector2i(4, 4)] as Dictionary)["hp"]), 20, "掩体格带 hp")
	assert_eq(b.terrain_at(Vector2i(5, 4)), "fire", "火格类型记录")
	assert_eq(b.get_fire_cells().size(), 1, "火格可被外部枚举结算")
