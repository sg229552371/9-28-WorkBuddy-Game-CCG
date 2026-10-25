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
			# 真源 CFG 顶层值有三类：对象（多数表）、数组（heroes/levels 等）、标量（altarJudgeMul=1.2）
			if parsed != null:
				tables[key] = parsed
			else:
				push_error("[Cfg] 配置表解析失败: " + fname)
		fname = dir.get_next()

## 便捷读取：Cfg.get_table("heroes") 返回整表（对象/数组/标量皆可）；找不到返回 null
func get_table(key: String) -> Variant:
	return tables.get(key)

## 字典表便捷读取（值确为 Dictionary 时用；找不到返回空字典）
func get_dict(key: String) -> Dictionary:
	var v: Variant = tables.get(key)
	return v if v is Dictionary else {}

## 导入校验：cfg/ 目录为空或全空表时给出醒目警告（P2 数据迁移前属预期状态）
func assert_not_empty() -> bool:
	return not tables.is_empty()


## ---------- 只读辅助方法（场景流 UI 用；不修改任何表内容）----------

## 关卡表（cfg/levels.json，数组）；缺失返回空数组
func get_levels() -> Array:
	var v: Variant = tables.get("levels")
	return v if v is Array else []


## 英雄表（cfg/heroes.json，数组）；缺失返回空数组
func get_heroes() -> Array:
	var v: Variant = tables.get("heroes")
	return v if v is Array else []


## 怪物表（cfg/monsters.json，字典）；缺失返回空字典
func get_monsters() -> Dictionary:
	var v: Variant = tables.get("monsters")
	return v if v is Dictionary else {}


## 组队上限（cfg/team.json maxSize；缺省 3）
func get_team_max_size() -> int:
	var team: Variant = tables.get("team")
	if team is Dictionary:
		return int((team as Dictionary).get("maxSize", 3))
	return 3


## 主线关卡总数（cfg/mainLevelCount.json 或 levels.json 长度兜底）
func get_main_level_count() -> int:
	var v: Variant = tables.get("mainLevelCount")
	if v is int:
		return int(v)
	return get_levels().size()


## 设置项规格（cfg/settings.json 中某键的范围/默认值字典）；缺失返回空字典
func get_setting_spec(key: String) -> Dictionary:
	var settings: Variant = tables.get("settings")
	if settings is Dictionary:
		var spec: Variant = (settings as Dictionary).get(key)
		return spec if spec is Dictionary else {}
	return {}


## 武器名（cfg/weapons.json[weaponId].name）；缺失回退武器 ID
func get_weapon_name(weapon_id: String) -> String:
	var weapons: Variant = tables.get("weapons")
	if weapons is Dictionary and (weapons as Dictionary).has(weapon_id):
		var w: Variant = (weapons as Dictionary)[weapon_id]
		if w is Dictionary:
			return str((w as Dictionary).get("name", weapon_id))
	return weapon_id
