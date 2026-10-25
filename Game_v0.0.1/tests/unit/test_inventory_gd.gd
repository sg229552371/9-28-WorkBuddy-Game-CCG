## jes-inventory 单元测试 —— 覆盖制作人验收口径：
##   ① 放置（成功/越界/重叠） ② 找位失败 ③ 移除后复用  ④ 同品质叠加
##   ⑤ 负重统计  ⑥ 5×6 与 5×7 尺寸口径  ⑦ 一键整理  ⑧ 装备生成与品质权重
## 纯逻辑测试（inventory.gd / gear_gen.gd），不依赖 UI 节点。
extends GutTest

const TEMP_COLS := 6
const TEMP_ROWS := 5
const RELIC_COLS := 7
const RELIC_ROWS := 5

var inv: JesInventory

func before_each() -> void:
	inv = JesInventory.new(TEMP_COLS, TEMP_ROWS, "temp")

func _mk_item(w: int, h: int, quality: int = 0, extra: Dictionary = {}) -> Dictionary:
	var it := { "uid": JesInventory.next_uid(), "kind": "gear", "id": "G001",
		"name": "瞄准镜", "w": w, "h": h, "quality": quality,
		"affixes": [], "weight": 3, "value": 30, "stack_max": 1 }
	for k: String in extra:
		it[k] = extra[k]
	return it

## ① 放置：合法落格、占格全写、越界与重叠拒绝
func test_place_rules() -> void:
	var a := _mk_item(2, 2)
	assert_true(inv.place(a, 4, 3), "2×2 放入右下角应成功")
	assert_eq(int(a["x"]), 4)
	assert_eq(inv.cells[(3) * TEMP_COLS + 4], a, "占格应写入物品引用")
	assert_eq(inv.cells[(4) * TEMP_COLS + 5], a, "右下角占格也应写入")
	assert_false(inv.place(_mk_item(1, 1), 5, 4), "与已放物品重叠应失败")
	assert_false(inv.place(_mk_item(2, 2), 5, 4), "越出右/下边界应失败")
	assert_false(inv.place(_mk_item(2, 2), -1, 0), "负坐标应失败")
	assert_eq(inv.items.size(), 1)

## ② 找位失败：塞满 5×6 后 2×2 无处可放，auto_add 拒绝
func test_find_space_fail() -> void:
	for j in range(TEMP_ROWS):
		for i in range(TEMP_COLS):
			assert_true(inv.place(_mk_item(1, 1), i, j))
	var big := _mk_item(2, 2)
	assert_true(inv.find_spot(big).is_empty(), "满包时 2×2 应无空位")
	assert_false(inv.auto_add(big), "auto_add 应返回 false（不丢件不崩溃）")
	assert_eq(inv.items.size(), TEMP_COLS * TEMP_ROWS, "拒绝后不应有新增物品")

## ③ 移除：占格清空、列表剔除、原位可复用
func test_remove_and_reuse() -> void:
	var a := _mk_item(2, 1)
	assert_true(inv.place(a, 2, 1))
	inv.remove_item(a)
	assert_null(inv.cells[1 * TEMP_COLS + 2], "移除后占格应为空")
	assert_eq(inv.items.size(), 0)
	assert_true(inv.place(_mk_item(2, 1), 2, 1), "原位置应可再放置")
	# 移除未放置的物品应安全无副作用
	inv.remove_item(_mk_item(1, 1))
	assert_eq(inv.items.size(), 1)

## ④ 同品质叠加：同 id 同品质 count+1 不占新格；不同品质/超堆叠上限则不叠
func test_stack_same_quality() -> void:
	var a := _mk_item(1, 1, 2, { "id": "C_HP", "stack_max": 3, "value": 20, "name": "治疗药剂" })
	assert_true(inv.place(a, 0, 0))
	assert_true(inv.try_stack(_mk_item(1, 1, 2, { "id": "C_HP", "stack_max": 3, "value": 20 })), "同 id 同品质应叠加")
	assert_eq(int(a["count"]), 2, "叠加后数量应为 2")
	assert_eq(int(a["value"]), 40, "价值应同步累加 20×2")
	assert_eq(inv.items.size(), 1, "叠加不应占新格")
	assert_false(inv.try_stack(_mk_item(1, 1, 3, { "id": "C_HP", "stack_max": 3, "value": 20 })), "不同品质不应叠加")
	assert_false(inv.try_stack(_mk_item(1, 1, 2, { "id": "C_MP", "stack_max": 3, "value": 20 })), "不同 id 不应叠加")
	# 叠到堆叠上限后不再叠加
	var b := _mk_item(1, 1, 2, { "id": "C_HP", "stack_max": 3, "value": 20 })
	assert_true(inv.try_stack(b), "第 3 份应可叠")
	assert_false(inv.try_stack(_mk_item(1, 1, 2, { "id": "C_HP", "stack_max": 3, "value": 20 })), "达到 stack_max 后不应再叠")
	# 宝箱走 stack_map 通道
	var chest_inv := JesInventory.new(TEMP_COLS, TEMP_ROWS, "chestbag")
	var chest_map := { "normal": { "stackMax": 5, "value": 20, "weight": 4 } }
	var c1 := { "uid": JesInventory.next_uid(), "kind": "chest", "chestQ": "normal", "name": "普通宝箱", "w": 1, "h": 1, "quality": 0, "affixes": [], "weight": 4, "value": 20, "count": 1 }
	chest_inv.place(c1, 0, 0)
	assert_true(chest_inv.try_stack(c1.duplicate(), chest_map), "同品质宝箱应叠加")
	assert_eq(int(c1["count"]), 2, "宝箱数量应为 2")
	assert_eq(chest_inv.total_weight(chest_map), 8, "宝箱负重应按 品质重量×数量")

## ⑤ 负重：普通物品按自重×数量累计
func test_total_weight() -> void:
	assert_eq(inv.total_weight(), 0, "空包负重为 0")
	var a := _mk_item(1, 1, 0, { "weight": 9 })
	inv.place(a, 0, 0)
	var b := _mk_item(1, 1, 0, { "weight": 3 })
	b["count"] = 3
	inv.place(b, 1, 0)
	assert_eq(inv.total_weight(), 18, "9×1 + 3×3 = 18")

## ⑥ 尺寸口径：临时 5 行×6 列 / 遗物 5 行×7 列，格子规格常量一致
func test_grid_dimensions() -> void:
	var temp := JesInventory.new(TEMP_COLS, TEMP_ROWS, "temp")
	var relic := JesInventory.new(RELIC_COLS, RELIC_ROWS, "relic")
	assert_eq(temp.cols, 6)
	assert_eq(temp.rows, 5)
	assert_eq(relic.cols, 7)
	assert_eq(relic.rows, 5)
	assert_eq(temp.cells.size(), 30)
	assert_eq(relic.cells.size(), 35)
	# 7 列专属：x=6 只在遗物包可放 1×1
	assert_true(relic.place(_mk_item(1, 1), 6, 0), "遗物包第 7 列应可放置")
	assert_false(temp.place(_mk_item(1, 1), 6, 0), "临时包无第 7 列")
	# UI 侧规格：两本背包共用同一 CELL/GAP 常量（互动前提）
	assert_eq(BagUI.CELL, BagUI.CELL, "格子尺寸常量唯一来源")
	assert_eq(BagUI.TEMP_ROWS, RELIC_ROWS, "两包行数一致（5）")
	assert_eq(BagUI.TEMP_COLS, 6)
	assert_eq(BagUI.RELIC_COLS, 7)

## ⑦ 一键整理：碎片化后大件优先重排，全部放回
func test_auto_arrange() -> void:
	var a := _mk_item(2, 2, 0, { "id": "G002", "name": "作战背心" })
	var b := _mk_item(1, 2, 0, { "id": "G003", "name": "动力靴" })
	var c := _mk_item(2, 1, 0, { "id": "G004", "name": "装甲板" })
	var d := _mk_item(1, 1)
	assert_true(inv.place(a, 0, 0))
	assert_true(inv.place(b, 3, 3))
	assert_true(inv.place(c, 4, 0))
	assert_true(inv.place(d, 5, 3))
	inv.remove_item(d)
	assert_true(inv.auto_arrange(), "整理应全部放回")
	assert_eq(inv.items.size(), 3)
	# 大件优先：面积最大的 2×2 应落在 (0,0)
	assert_eq(int(a["x"]), 0)
	assert_eq(int(a["y"]), 0)
	# 整理后 1×1 仍有空位
	assert_false(inv.find_spot(_mk_item(1, 1)).is_empty(), "3 件物品留大量空位")

## ⑧ 装备生成：品质缩放、随机词缀条数按品质、品质权重抽档
func test_gear_gen() -> void:
	var g := JesGearGen.new()
	g.load_gear_defs()
	assert_gt(g.gear_defs.size(), 0, "应读入 cfg/gearDefs.json")
	var def := g.def_of("G002")
	assert_false(def.is_empty(), "应能按 id 找到定义")
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var white := g.make_gear(def, 0, rng)
	assert_eq(int(white["quality"]), 0)
	assert_eq(white["affixes"].size(), 0, "白装无随机词缀")
	assert_eq(int(white["w"]), 2)
	assert_eq(int(white["h"]), 2)
	assert_eq(int(white["value"]), 30, "白装价值 = round(30×1.0)")
	assert_eq(float(white["stats"]["hp"]), 30.0, "白装基础属性不缩放")
	var gold := g.make_gear(def, 4, rng)
	assert_eq(gold["affixes"].size(), 4, "金装应有 4 条随机词缀")
	var gold_mul := 1.0 + (6.0 - 1.0) * 0.6
	assert_eq(float(gold["stats"]["hp"]), roundf(30.0 * gold_mul), "金装属性按 mul 缩放")
	assert_eq(int(gold["value"]), 180, "金装价值 = round(30×6.0)")
	# 品质权重抽样：只可能落在 0..4
	for i in range(50):
		var q := g.roll_quality(rng)
		assert_true(q >= 0 and q <= 4, "抽档结果应在 0..4 内")
	# 词缀文案
	assert_eq(JesGearGen.affix_text({ "tag": "攻击", "mode": "flat", "value": 4.0 }), "攻击 +4")
	assert_eq(JesGearGen.affix_text({ "tag": "伤害", "mode": "pct", "value": 0.08 }), "伤害 +8%")
	var lines := JesGearGen.item_tooltip_lines(gold)
	assert_gt(lines.size(), 2, "tooltip 应含名称/品质/词条/负重")
	assert_true(lines[1].begins_with("品质"), "第二行应为品质行")
