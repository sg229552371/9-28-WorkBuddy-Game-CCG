## 单英雄档案适配层；真源 skill-save.js SCHEMA_VERSION = 2。
## 不恢复运行时 builds，不接管宿主其它存档，也不自动覆盖读入的旧档。
class_name SaveCore
extends RefCounted

const CURRENT_VERSION := 2
const SAVE_KEY_PREFIX := "user://save_%s.json"

var last_migration: Dictionary = {}
var _backend: Variant
var _definitions: Dictionary
var _warned: Dictionary = {}


## Dictionary 后端以完整 user:// 路径为键、JSON 文本为值，按引用共享。
## null 使用文件后端；definitions 为测试/审核后迁移表注入，缺省直接读 cfg。
func _init(backend: Variant = null, definitions: Variant = null) -> void:
	_backend = backend
	if definitions is Dictionary:
		_definitions = definitions.duplicate(true)
	else:
		var file := FileAccess.open("res://cfg/skillSystem.json", FileAccess.READ)
		if file != null:
			var parsed: Variant = JSON.parse_string(file.get_as_text())
			if parsed is Dictionary:
				_definitions = parsed
		if _definitions.is_empty():
			_warn_once("definitions", "技能配置缺失，保守保留资产，不执行未经审核的映射")


static func empty_archive() -> Dictionary:
	return {"version": CURRENT_VERSION, "hero_id": "", "skills": {},
		"coins": 0, "exp": 0, "best_wave": 0, "updated_at": 0}


func save(slot: String, data: Dictionary) -> bool:
	var path := _slot_path(slot)
	if path.is_empty():
		return false
	# 有显式版本时不可直接盖章跳过迁移，更不能降级覆盖未来版本。
	var candidate := data.duplicate(true)
	if not candidate.has("version"):
		candidate["version"] = CURRENT_VERSION
	var out := migrate(candidate)
	if out.is_empty():
		return false
	out["updated_at"] = int(Time.get_unix_time_from_system())
	var content := JSON.stringify(out)
	if _backend is Dictionary:
		_backend[path] = content
		return true
	if _backend != null:
		_warn_once("backend", "后端必须为 Dictionary 或 null")
		return false
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		_warn_once("write:" + path, "存档写入失败：" + path)
		return false
	file.store_string(content)
	file.flush()
	var ok := file.get_error() == OK
	file.close()
	if not ok:
		_warn_once("write:" + path, "存档写入失败：" + path)
	return ok


func load_save(slot: String) -> Dictionary:
	last_migration = {}
	var path := _slot_path(slot)
	if path.is_empty():
		return empty_archive()
	var raw: Variant
	if _backend is Dictionary:
		if not _backend.has(path):
			return empty_archive()
		raw = _backend[path]
	elif _backend == null:
		if not FileAccess.file_exists(path):
			return empty_archive()
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			_warn_once("read:" + path, "存档读取失败：" + path)
			return empty_archive()
		raw = file.get_as_text()
	else:
		_warn_once("backend", "后端必须为 Dictionary 或 null")
		return empty_archive()
	var json := JSON.new()
	if not raw is String or json.parse(raw) != OK or not json.data is Dictionary:
		_warn_once("json:" + path, "坏 JSON 或非对象存档，返回空档案：" + path)
		return empty_archive()
	var out := migrate(json.data)
	return empty_archive() if out.is_empty() else out


## 对外迁移入口：失败返回 {}；成功返回新档，不改变原对象。
## last_migration 暴露真源的 state/report/preservedOriginal 三元结果。
func migrate(data: Dictionary) -> Dictionary:
	last_migration = {"state": null, "report": {}, "preservedOriginal": data.duplicate(true)}
	if not _valid_version(data.get("version")):
		_warn_once("version", "存档缺版本或版本非法/超界，返回空档案")
		return {}
	if not _valid_shape(data):
		_warn_once("shape", "存档字段类型错误，返回空档案；原始载荷仍保留")
		return {}
	var out := data.duplicate(true)
	while int(out.version) < CURRENT_VERSION:
		match int(out.version):
			1:
				out = _migrate_v1_to_v2(out)
			_:
				_warn_once("migration", "迁移链缺失，返回空档案")
				return {}
	var result := empty_archive()
	result.merge(out, true)
	for sid in result.skills:
		var skill: Dictionary = result.skills[sid]
		if not skill.has("level"):
			skill.level = _default_level()
		if not skill.has("crystals"):
			skill.crystals = []
	last_migration.state = result.duplicate(true)
	return result


## 真源 migrate 没有 gold 更名规则；这里仅适配单英雄 skills[*].crystals。
## 对译显式 migrationMaps、未知/越界保留、冲突报告与 __migratedTo 标记。
func _migrate_v1_to_v2(data: Dictionary) -> Dictionary:
	var out := data.duplicate(true)
	var target: Variant = _definitions.get("configVersion")
	var report := {"schemaVersionFrom": 1, "schemaVersionTo": CURRENT_VERSION,
		"configVersionFrom": data.get("configVersion"), "configVersionTo": target,
		"configVersionMismatch": data.get("configVersion") != null and target != null and data.configVersion != target,
		"alreadyMigrated": false, "migrated": [], "unknownIds": [],
		"levelOverflow": [], "conflicts": [], "notes": []}
	var defs: Dictionary = _definitions.get("crystalDefs", {})
	var maps: Dictionary = _definitions.get("migrationMaps", {})
	var mapping: Dictionary = maps.get("crystals", {})
	var rules: Dictionary = _definitions.get("supportGroupRules", {})
	var groups: Array = rules.get("motionConflictGroups", maps.get("motionConflictGroups", []))
	for sid in out.get("skills", {}):
		var skill: Dictionary = out.skills[sid]
		var seen := {}
		for crystal in skill.get("crystals", []):
			var old_id: String = str(crystal.get("crystalId", ""))
			if old_id.is_empty():
				# 不删无法识别的条目（防腐层比 JS 的 continue 更保守）。
				continue
			var mapped: bool = mapping.has(old_id) and mapping[old_id] != null
			var new_id: Variant = mapping.get(old_id) if mapped else old_id if defs.has(old_id) else null
			var level: Variant = crystal.get("level", _default_level())
			if not crystal.has("level"):
				crystal.level = level
			if new_id == null or str(new_id).is_empty():
				crystal.unknown = true
				report.unknownIds.append({"heroId": out.get("hero_id", ""), "crystalId": old_id, "level": level, "action": "preserved"})
				continue
			crystal.crystalId = new_id
			var definition: Dictionary = defs.get(new_id, {})
			var levels: Array = definition.get("levels", [])
			if not levels.is_empty() and float(level) > levels.size():
				crystal.overflow = true
				report.levelOverflow.append({"crystalId": new_id, "originalLevel": level, "maxLevel": levels.size(), "action": "preserved"})
			if mapped:
				report.migrated.append({"from": old_id, "to": new_id, "level": level, "kind": "crystal"})
			if seen.has(new_id):
				report.conflicts.append({"crystalId": new_id, "type": "DUPLICATE_CRYSTAL", "action": "preserved"})
			seen[new_id] = true
		for group in groups:
			var present := []
			for id in group:
				if seen.has(id):
					present.append(id)
			if present.size() >= 2:
				report.conflicts.append({"type": "MOTION_CONFLICT", "crystals": present, "action": "preserved"})
	out.version = CURRENT_VERSION
	out.configVersion = target
	out.__migratedTo = target
	last_migration.report = report
	return out


func _valid_version(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) == floor(float(value)) and value >= 1 and value <= CURRENT_VERSION


func _valid_shape(data: Dictionary) -> bool:
	if not data.get("hero_id", "") is String or not data.get("skills", {}) is Dictionary:
		return false
	for key in ["coins", "exp", "best_wave", "updated_at"]:
		var value: Variant = data.get(key, 0)
		if not (value is int or value is float) or not is_finite(float(value)):
			return false
	for sid in data.get("skills", {}):
		var skill: Variant = data.skills[sid]
		if not sid is String or not skill is Dictionary or not skill.get("crystals", []) is Array:
			return false
		var level: Variant = skill.get("level", 1)
		if not (level is int or level is float) or not is_finite(float(level)):
			return false
		for crystal in skill.get("crystals", []):
			if not crystal is Dictionary:
				return false
			var crystal_level: Variant = crystal.get("level", 1)
			if not (crystal_level is int or crystal_level is float) or not is_finite(float(crystal_level)):
				return false
	return true


func _default_level() -> int:
	if _definitions.has("skillLevelStart"):
		return int(_definitions.skillLevelStart)
	_warn_once("level", "配置缺少 skillLevelStart，沿用真源保守默认等级 1")
	return 1


func _slot_path(slot: String) -> String:
	if slot.is_empty():
		_warn_once("slot", "存档槽位为空或含路径字符")
		return ""
	for character in slot:
		if not character in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-":
			_warn_once("slot", "存档槽位为空或含路径字符")
			return ""
	return SAVE_KEY_PREFIX % slot


func _warn_once(key: String, message: String) -> void:
	if not _warned.has(key):
		_warned[key] = true
		push_warning("SaveCore: " + message)
