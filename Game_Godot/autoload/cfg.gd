## 全局配置表加载器（对应 js/config.js 的 CFG）
## 口径铁律 1：数值一律进 CFG；逻辑里不硬编码。
## 数据真源 = res://cfg/*.json（由 HTML 版 js/config.js 的 CFG 表导出，导出脚本见 docs/迁移总纲_v1.md）。
extends Node

## 全部配置表；键 = 文件名（不含扩展名），值 = Dictionary
var tables: Dictionary = {}

const TABLE_DIR := "res://cfg"

func _ready() -> void:
	_load_all()
	print("[Cfg] 已加载配置表: ", tables.keys())

func _load_all() -> void:
	tables.clear()
	var dir := DirAccess.open(TABLE_DIR)
	if dir == null:
		push_warning("[Cfg] 配置目录不存在: " + TABLE_DIR)
		return
	dir.list_dir_begin()
	var fname := dir.get_next()
	while fname != "":
		if not dir.current_is_dir() and fname.ends_with(".json"):
			var key := fname.trim_suffix(".json")
			var text := FileAccess.get_file_as_string(TABLE_DIR + "/" + fname)
			var parsed: Variant = JSON.parse_string(text)
			if parsed is Dictionary:
				tables[key] = parsed
			else:
				push_error("[Cfg] 配置表解析失败: " + fname)
		fname = dir.get_next()

## 便捷读取：Cfg.get_table("heroes") 返回整表；找不到返回空字典
func get_table(key: String) -> Dictionary:
	return tables.get(key, {})

## 导入校验：cfg/ 目录为空或全空表时给出醒目警告（P2 数据迁移前属预期状态）
func assert_not_empty() -> bool:
	return not tables.is_empty()
