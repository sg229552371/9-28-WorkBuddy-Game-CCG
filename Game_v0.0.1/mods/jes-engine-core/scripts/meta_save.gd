class_name MetaSave
extends RefCounted

## Meta 账号级存档 —— 对译 html/js/game.js 的 Meta.data 字段名（便于对表）。
## 真源字段：crystals / heroes / unlockedLevels / profile / codex / unlockExtra。
## Godot 侧扩展字段：levelStars（关卡星级）、weaponLevels 兼容别名不落盘（武器等级在 heroes[id].weaponLv）、
## weeklyAbyssCrystals（本周深渊结晶）、settings（设置项，镜像 cfg/settings.json saveKey 口径）。
## 与单英雄技能槽存档（SaveCore，skill-save.js SCHEMA_VERSION=2）各自独立文件、互不覆盖。

const META_VERSION := 1
const SAVE_PATH := "user://meta_save.json"
const DEFAULT_PROFILE_NAME := "旅行者"
const DEFAULT_SKIN_ID := "H001"

## 内存中的账号数据（结构对齐 Meta.data）
var data: Dictionary = {}

## Dictionary 后端以文件路径为键、JSON 文本为值（测试注入）；null 使用文件后端
var _backend: Variant


func _init(backend: Variant = null) -> void:
	_backend = backend
	load_data()


## 默认空档（字段名与 html Meta.data 一致）
static func empty_data() -> Dictionary:
	return {
		"version": META_VERSION,
		"crystals": 0,
		"heroes": {},
		"unlockedLevels": 1,
		"profile": {"name": DEFAULT_PROFILE_NAME, "skinId": DEFAULT_SKIN_ID, "titleId": "t_none"},
		"codex": {"heroes": {}, "monsters": {}, "flags": {}},
		"unlockExtra": {},
		"levelStars": {},
		"weeklyAbyssCrystals": 0,
		"settings": {},
	}


func load_data() -> Dictionary:
	data = empty_data()
	var raw: Variant = _read_raw()
	if raw is Dictionary:
		var loaded: Dictionary = raw
		for key: String in data.keys():
			if loaded.has(key):
				data[key] = loaded[key]
	_migrate()
	return data.duplicate(true)


func save_data() -> bool:
	data["version"] = META_VERSION
	var content := JSON.stringify(data)
	if _backend is Dictionary:
		(_backend as Dictionary)[SAVE_PATH] = content
		return true
	if _backend != null:
		push_warning("MetaSave: 后端必须为 Dictionary 或 null")
		return false
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("MetaSave: 存档写入失败 " + SAVE_PATH)
		return false
	file.store_string(content)
	file.flush()
	var ok := file.get_error() == OK
	file.close()
	return ok


func commit() -> void:
	save_data()


## 老档补默认值（对译 Meta.load 的迁移段，只补缺不覆盖）
func _migrate() -> void:
	if not data.get("profile", {}) is Dictionary or (data.get("profile", {}) as Dictionary).is_empty():
		data["profile"] = {"name": DEFAULT_PROFILE_NAME, "skinId": DEFAULT_SKIN_ID, "titleId": "t_none"}
	if not data.get("codex", {}) is Dictionary:
		data["codex"] = {"heroes": {}, "monsters": {}, "flags": {}}
	var codex: Dictionary = data["codex"]
	if not codex.get("heroes", {}) is Dictionary:
		codex["heroes"] = {}
	if not codex.get("monsters", {}) is Dictionary:
		codex["monsters"] = {}
	if not codex.get("flags", {}) is Dictionary:
		codex["flags"] = {}
	# 初始皮肤永久解锁
	codex["heroes"][DEFAULT_SKIN_ID] = true
	if not data.get("heroes", {}) is Dictionary:
		data["heroes"] = {}
	if not data.get("unlockExtra", {}) is Dictionary:
		data["unlockExtra"] = {}
	if not data.get("levelStars", {}) is Dictionary:
		data["levelStars"] = {}
	if not data.get("settings", {}) is Dictionary:
		data["settings"] = {}
	# 迁移：旧「结晶技能升级」并入武器等级（skillLevel → weaponLv）
	for id: String in (data["heroes"] as Dictionary).keys():
		var rec: Dictionary = (data["heroes"] as Dictionary)[id]
		if rec.has("skillLevel") and not rec.has("weaponLv"):
			rec["weaponLv"] = rec["skillLevel"]
	# unlockedLevels 至少为 1
	data["unlockedLevels"] = maxi(1, int(data.get("unlockedLevels", 1)))


func _read_raw() -> Variant:
	if _backend is Dictionary:
		var backend: Dictionary = _backend
		if not backend.has(SAVE_PATH):
			return null
		return _parse(backend[SAVE_PATH])
	if _backend != null:
		push_warning("MetaSave: 后端必须为 Dictionary 或 null")
		return null
	if not FileAccess.file_exists(SAVE_PATH):
		return null
	var text := FileAccess.get_file_as_string(SAVE_PATH)
	return _parse(text)


func _parse(text: Variant) -> Variant:
	if not text is String or (text as String).is_empty():
		return null
	var json := JSON.new()
	if json.parse(text) != OK:
		return null
	return json.data


## ---------- 只读访问 ----------

func crystals() -> int:
	return int(data.get("crystals", 0))


func profile_name() -> String:
	var profile: Dictionary = data.get("profile", {})
	return str(profile.get("name", DEFAULT_PROFILE_NAME))


func unlocked_levels() -> int:
	return int(data.get("unlockedLevels", 1))


## 英雄是否已解锁：unlockExtra 主动解锁记录 或 codex 激活记录
func is_hero_unlocked(hero_id: String) -> bool:
	var extra: Dictionary = data.get("unlockExtra", {})
	if bool(extra.get(hero_id, false)):
		return true
	var heroes: Dictionary = data.get("heroes", {})
	if heroes.has(hero_id):
		return true
	var codex: Dictionary = data.get("codex", {})
	return bool((codex.get("heroes", {}) as Dictionary).get(hero_id, false))


func hero_out_level(hero_id: String) -> int:
	var heroes: Dictionary = data.get("heroes", {})
	var rec: Dictionary = heroes.get(hero_id, {})
	return int(rec.get("outLevel", 1))


func hero_weapon_lv(hero_id: String) -> int:
	var heroes: Dictionary = data.get("heroes", {})
	var rec: Dictionary = heroes.get(hero_id, {})
	return int(rec.get("weaponLv", 1))


func level_stars(level_id: String) -> int:
	var stars: Dictionary = data.get("levelStars", {})
	return int(stars.get(level_id, 0))


func is_monster_codex_active(monster_id: String) -> bool:
	var codex: Dictionary = data.get("codex", {})
	return bool((codex.get("monsters", {}) as Dictionary).get(monster_id, false))


func is_hero_codex_active(hero_id: String) -> bool:
	var codex: Dictionary = data.get("codex", {})
	return bool((codex.get("heroes", {}) as Dictionary).get(hero_id, false))


func weekly_abyss_crystals() -> int:
	return int(data.get("weeklyAbyssCrystals", 0))


func setting(key: String, fallback: Variant = null) -> Variant:
	var settings: Dictionary = data.get("settings", {})
	return settings.get(key, fallback)


## ---------- 写操作（调用方负责 commit）----------

func add_crystals(amount: int) -> void:
	data["crystals"] = maxi(0, crystals() + amount)


func unlock_hero(hero_id: String) -> bool:
	if is_hero_unlocked(hero_id):
		return true
	var extra: Dictionary = data.get("unlockExtra", {})
	extra[hero_id] = true
	return true


func set_hero_out_level(hero_id: String, level: int) -> void:
	var heroes: Dictionary = data.get("heroes", {})
	var rec: Dictionary = heroes.get(hero_id, {})
	rec["outLevel"] = maxi(1, level)
	heroes[hero_id] = rec


func set_hero_weapon_lv(hero_id: String, level: int) -> void:
	var heroes: Dictionary = data.get("heroes", {})
	var rec: Dictionary = heroes.get(hero_id, {})
	rec["weaponLv"] = maxi(1, level)
	heroes[hero_id] = rec


## 撤离成功解锁下一关（死亡不解锁；序号从 1 起）
func unlock_level_to(level_index: int) -> bool:
	var target := maxi(1, level_index)
	if target <= unlocked_levels():
		return false
	data["unlockedLevels"] = target
	return true


## 记录关卡最佳星级（只升不降）
func set_level_stars(level_id: String, stars: int) -> bool:
	var clamped := clampi(stars, 0, 3)
	if clamped <= level_stars(level_id):
		return false
	var stars_map: Dictionary = data.get("levelStars", {})
	stars_map[level_id] = clamped
	return true


func activate_hero_codex(hero_id: String) -> void:
	var codex: Dictionary = data.get("codex", {})
	var heroes_codex: Dictionary = codex.get("heroes", {})
	heroes_codex[hero_id] = true


func activate_monster_codex(monster_id: String) -> void:
	var codex: Dictionary = data.get("codex", {})
	var monsters_codex: Dictionary = codex.get("monsters", {})
	monsters_codex[monster_id] = true


func add_weekly_abyss_crystals(amount: int) -> void:
	data["weeklyAbyssCrystals"] = maxi(0, weekly_abyss_crystals() + amount)


func set_setting(key: String, value: Variant) -> void:
	var settings: Dictionary = data.get("settings", {})
	settings[key] = value
