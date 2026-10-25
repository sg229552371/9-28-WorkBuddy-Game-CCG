extends GutTest

const SaveCoreScript := preload("res://mods/jes-engine-core/scripts/save_core.gd")

var backend: Dictionary
var core


func before_each() -> void:
	backend = {}
	core = SaveCoreScript.new(backend)


func make_profile(version: int = 2) -> Dictionary:
	return {"version": version, "hero_id": "H001", "skills": {
		"SK_FIREBALL": {"level": 3, "crystals": [{"crystalId": "CR_PIERCE", "level": 1, "slot": 0}]}
	}, "coins": 23, "exp": 45, "best_wave": 7, "updated_at": 0}


func test_round_trip_and_immediate_persistence() -> void:
	var data := make_profile()
	assert_true(core.save("round_trip", data), "存档应立即持久化成功")
	assert_true(backend["user://save_round_trip.json"] is String, "桩后端应存 JSON 文本")
	var loaded: Dictionary = core.load_save("round_trip")
	# JS/JSON 没有 int/float 区分；按同一 JSON 数值域核对嵌套载荷。
	var expected: Dictionary = JSON.parse_string(JSON.stringify(data))
	for key in ["version", "hero_id", "skills", "coins", "exp", "best_wave"]:
		assert_eq(loaded[key], expected[key], "往返应保留字段：" + key)
	loaded.skills.clear()
	assert_false(core.load_save("round_trip").skills.is_empty(), "读取应深拷贝隔离")
	assert_eq(data.updated_at, 0, "保存不修改调用方输入")


func test_missing_slot_returns_empty_archive() -> void:
	assert_eq(core.load_save("missing"), SaveCoreScript.empty_archive(), "无档返回结构完整空档案")
	assert_true(backend.is_empty(), "无档读取不产生持久化副作用")


func test_bad_json_returns_empty_archive() -> void:
	for raw in ["{broken", "", "[]", "null", "23"]:
		backend["user://save_bad.json"] = raw
		assert_eq(core.load_save("bad"), SaveCoreScript.empty_archive(), "坏 JSON/非对象返回空档案")
		assert_eq(backend["user://save_bad.json"], raw, "坏档不可被空档自动覆盖")


func test_missing_version_returns_empty_archive() -> void:
	var data := make_profile()
	data.erase("version")
	backend["user://save_old.json"] = JSON.stringify(data)
	assert_eq(core.load_save("old"), SaveCoreScript.empty_archive(), "缺版本不可猜测迁移起点")


func test_unknown_and_invalid_versions_return_empty_archive() -> void:
	for version in [0, -1, 3, 999, 1.5, "2", null, true, [], {}]:
		var data := make_profile()
		data.version = version
		backend["user://save_version.json"] = JSON.stringify(data)
		assert_eq(core.load_save("version"), SaveCoreScript.empty_archive(), "未知/非法版本应 fail-open")


func test_updated_at_is_save_time_and_read_does_not_change_it() -> void:
	var start := int(Time.get_unix_time_from_system())
	assert_true(core.save("time", make_profile()), "保存应成功")
	var loaded: Dictionary = core.load_save("time")
	assert_between(int(loaded.updated_at), start, int(Time.get_unix_time_from_system()), "时间戳为保存时 Unix 秒")
	assert_eq(core.load_save("time").updated_at, loaded.updated_at, "读取不可更新时间戳")


func test_v1_migration_uses_reviewed_maps_and_preserves_assets() -> void:
	var definitions: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/skillSystem.json"))
	# 只注入测试审核映射；等级上限仍来自真实配置。
	definitions.migrationMaps = {"crystals": {"OLD_PIERCE": "CR_PIERCE"}}
	core = SaveCoreScript.new(backend, definitions)
	var max_level: int = definitions.crystalDefs.CR_PIERCE.levels.size()
	var data := make_profile(1)
	data.configVersion = "old-test-config"
	data.skills.SK_FIREBALL.crystals = [
		{"crystalId": "OLD_PIERCE", "level": max_level + 1, "slot": 0},
		{"crystalId": "UNKNOWN_TEST", "level": 1, "slot": 1},
		{"crystalId": "CR_PIERCE", "level": 1, "slot": 2}]
	var original := data.duplicate(true)
	backend["user://save_migration.json"] = JSON.stringify(data)
	var loaded: Dictionary = core.load_save("migration")
	assert_eq(int(loaded.version), 2, "v1 应经单级链升级到 v2")
	var crystals: Array = loaded.skills.SK_FIREBALL.crystals
	assert_eq(crystals.size(), 3, "禁止静默丢弃资产")
	assert_eq(crystals[0].crystalId, "CR_PIERCE", "只执行审核映射")
	assert_eq(int(crystals[0].level), max_level + 1, "越界等级保留，不截断")
	assert_true(crystals[0].overflow, "越界应标记")
	assert_eq(crystals[1].crystalId, "UNKNOWN_TEST", "未知资产保留原 ID")
	assert_true(crystals[1].unknown, "未知资产应标记")
	var report: Dictionary = core.last_migration.report
	assert_eq(report.migrated.size(), 1, "仅一次显式映射")
	assert_eq(report.unknownIds.size(), 1, "报告未知资产")
	assert_eq(report.levelOverflow.size(), 1, "报告等级越界")
	assert_eq(report.conflicts.size(), 1, "报告映射后重复冲突")
	assert_true(report.configVersionMismatch, "配置版本不符应打标")
	assert_eq(core.last_migration.preservedOriginal, JSON.parse_string(JSON.stringify(original)), "必须保留原始有效档案")
	assert_eq(data, original, "迁移不修改调用方对象")
	assert_eq(backend["user://save_migration.json"], JSON.stringify(original), "读取迁移不自动覆盖原盘")
	var again: Dictionary = core.migrate(loaded)
	assert_eq(again, loaded, "已升级档案重复迁移幂等，无重复补偿")


func test_v1_missing_fields_use_conservative_defaults() -> void:
	backend["user://save_sparse.json"] = JSON.stringify({"version": 1, "skills": {"SK_FIREBALL": {}}})
	var loaded: Dictionary = core.load_save("sparse")
	assert_eq(int(loaded.version), 2, "稀疏旧档升级")
	assert_eq(loaded.skills.SK_FIREBALL.crystals, [], "缺水晶补空数组")
	var definitions: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/skillSystem.json"))
	assert_eq(loaded.skills.SK_FIREBALL.level, int(definitions.skillLevelStart), "缺等级读配置默认值")
	assert_eq(loaded.coins, 0, "缺货币补零，不赠送资产")


func test_malformed_fields_return_empty_without_crashing() -> void:
	for field in ["skills", "hero_id", "coins", "exp", "best_wave", "updated_at"]:
		var data := make_profile()
		data[field] = []
		backend["user://save_shape.json"] = JSON.stringify(data)
		assert_eq(core.load_save("shape"), SaveCoreScript.empty_archive(), "错误字段类型不崩溃：" + field)
	for skill in [null, [], {"level": []}, {"crystals": {}}, {"crystals": [null]}]:
		var data := make_profile()
		data.skills.SK_FIREBALL = skill
		backend["user://save_shape.json"] = JSON.stringify(data)
		assert_eq(core.load_save("shape"), SaveCoreScript.empty_archive(), "错误技能/水晶结构不崩溃")


func test_save_rejects_future_version_without_overwrite() -> void:
	assert_true(core.save("future", make_profile()), "先保存有效档案")
	var previous: String = backend["user://save_future.json"]
	assert_false(core.save("future", make_profile(3)), "不可静默降级未来档案")
	assert_eq(backend["user://save_future.json"], previous, "拒存不覆盖已有档案")


func test_current_version_preserves_extra_data_and_cooldowns() -> void:
	var data := make_profile()
	data.skills.SK_FIREBALL.cdLeft = 0.4
	data.rewardTransactions = {"test": {"status": "OPEN"}}
	data.skills.SK_FIREBALL.crystals.append({"crystalId": "UNKNOWN_TEST", "level": 99})
	assert_true(core.save("extra", data), "当前版本存档成功")
	var loaded: Dictionary = core.load_save("extra")
	assert_eq(loaded.rewardTransactions, data.rewardTransactions, "不删额外事务字段")
	assert_eq(loaded.skills.SK_FIREBALL.cdLeft, 0.4, "不删额外冷却字段")
	assert_eq(loaded.skills.SK_FIREBALL.crystals.size(), 2, "当前版本未知资产不丢弃")


func test_invalid_slot_cannot_escape_user_directory() -> void:
	for slot in ["", "../outside", "a/b", "a\\b", "a:b"]:
		assert_false(core.save(slot, make_profile()), "禁止槽位路径穿越")
		assert_eq(core.load_save(slot), SaveCoreScript.empty_archive(), "非法槽位读取空档案")
	assert_true(backend.is_empty(), "非法槽位不写后端")


func test_default_file_backend_round_trip() -> void:
	var file_core = SaveCoreScript.new()
	# 使用唯一临时槽，不触碰玩家/已有档案；结束仅删除本测试创建的档。
	var slot := "test_save_core_" + str(Time.get_ticks_usec())
	var path: String = SaveCoreScript.SAVE_KEY_PREFIX % slot
	assert_false(FileAccess.file_exists(path), "临时槽位必须不存在")
	assert_true(file_core.save(slot, make_profile()), "默认文件后端应写盘成功")
	assert_true(FileAccess.file_exists(path), "文件应位于指定 user 路径")
	var loaded: Dictionary = SaveCoreScript.new().load_save(slot)
	assert_eq(loaded.hero_id, "H001", "新实例能恢复已落盘档案")
	assert_eq(int(loaded.coins), 23, "文件后端货币往返保留")
	assert_eq(DirAccess.remove_absolute(path), OK, "清理本测试创建的临时档案")


func test_invalid_backend_fails_without_crash() -> void:
	var invalid_core = SaveCoreScript.new([])
	assert_false(invalid_core.save("bad_backend", make_profile()), "错误后端不能假报保存成功")
	assert_eq(invalid_core.load_save("bad_backend"), SaveCoreScript.empty_archive(), "错误后端读空档而非崩溃")
