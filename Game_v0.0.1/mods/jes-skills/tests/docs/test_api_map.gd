extends GutTest

## D-47 门禁：API 地图防过期失真
## 磁盘上的《API地图.md》必须与生成器现算输出逐字节一致——
## 行为声明面 / 标签承诺面 / 内容集任一改动后忘记重跑生成，本测试即红。

const MAP_PATH := "res://mods/jes-skills/docs/_AI开发与文档/03_查规则/API地图.md"
const ACTIVE_DIR := "res://mods/jes-skills/content/gems/active"
const SUPPORT_DIR := "res://mods/jes-skills/content/gems/supports"

func test_map_on_disk_matches_generator() -> void:
	assert_file_exists(MAP_PATH)
	var disk := FileAccess.get_file_as_string(MAP_PATH)
	var fresh := ApiMapGenerator.generate()
	assert_eq(disk.length(), fresh.length(), "地图长度与生成器输出不一致（先看是否漏重跑）")
	assert_eq(disk, fresh, "API 地图过期：接口或内容已改动但未重跑 tools/gen_api_map.gd")

func test_map_covers_full_content_set() -> void:
	var disk := FileAccess.get_file_as_string(MAP_PATH)
	var actives := _count_tres(ACTIVE_DIR)
	var supports := _count_tres(SUPPORT_DIR)
	assert_gt(actives, 0, "active 目录为空，路径写错？")
	assert_gt(supports, 0, "supports 目录为空，路径写错？")
	assert_eq(_count_rows(disk, "## 三、"), actives, "主动技能行数应与目录 .tres 数一致")
	assert_eq(_count_rows(disk, "## 四、"), supports, "辅助宝石行数应与目录 .tres 数一致")

func test_map_lists_all_behavior_classes() -> void:
	var disk := FileAccess.get_file_as_string(MAP_PATH)
	var scripts := _list_behavior_scripts()
	assert_gt(scripts.size(), 0, "行为目录扫描为空，路径写错？")
	for s in scripts:
		var cname: String = s.get_global_name()
		assert_true(disk.contains(cname), "地图缺行为类 %s（漏重跑？）" % cname)

func _count_tres(dir_path: String) -> int:
	var n := 0
	var d := DirAccess.open(dir_path)
	for f in d.get_files():
		if String(f).ends_with(".tres"):
			n += 1
	return n

func _count_rows(text: String, section_header: String) -> int:
	var idx := text.find(section_header)
	assert_true(idx >= 0, "找不到章节 %s" % section_header)
	var nxt := text.find("## ", idx + 3)
	var body := text.substr(idx, (nxt if nxt >= 0 else text.length()) - idx)
	var n := 0
	for line in body.split("\n"):
		if line.begins_with("| ") and not line.begins_with("|--") \
				and not line.begins_with("| 中文名") and not line.begins_with("| 标签"):
			n += 1
	return n

func _list_behavior_scripts() -> Array:
	var out: Array = []
	var d := DirAccess.open("res://mods/jes-skills/systems/skills/behavior")
	for f in d.get_files():
		if String(f).ends_with(".gd"):
			out.append(load("res://mods/jes-skills/systems/skills/behavior/" + String(f)))
	out.sort_custom(func(a, b): return a.get_global_name() < b.get_global_name())
	return out
