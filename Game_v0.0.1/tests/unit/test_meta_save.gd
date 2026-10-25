## Meta 账号级存档测试（MetaSave）：读写/迁移/解锁/星级/设置
extends GutTest

var backend: Dictionary
var save: MetaSave


func before_each() -> void:
	backend = {}
	save = MetaSave.new(backend)


func test_default_data_matches_html_meta_fields() -> void:
	var empty := MetaSave.empty_data()
	for key: String in ["crystals", "heroes", "unlockedLevels", "profile", "codex", "unlockExtra"]:
		assert_true(empty.has(key), "默认档应包含 html Meta.data 字段 " + key)
	assert_eq(int(empty["crystals"]), 0, "初始结晶应为 0")
	assert_eq(int(empty["unlockedLevels"]), 1, "初始应只解锁第 1 关")


func test_save_and_load_roundtrip() -> void:
	save.add_crystals(120)
	save.set_hero_out_level("H001", 4)
	save.set_level_stars("LEVEL_001", 2)
	save.activate_monster_codex("NM0010")
	save.set_setting("sfxVolume", 0.5)
	assert_true(save.save_data(), "存档写入应成功")
	assert_true(backend.has(MetaSave.SAVE_PATH), "后端应记录存档文件")
	var loaded := MetaSave.new(backend)
	assert_eq(loaded.crystals(), 120, "结晶读写应一致")
	assert_eq(loaded.hero_out_level("H001"), 4, "局外等级读写应一致")
	assert_eq(loaded.level_stars("LEVEL_001"), 2, "星级读写应一致")
	assert_true(loaded.is_monster_codex_active("NM0010"), "怪物图鉴激活态应保留")
	assert_almost_eq(float(loaded.setting("sfxVolume", 0.0)), 0.5, 0.001, "设置项读写应一致")


func test_bad_json_returns_default() -> void:
	backend[MetaSave.SAVE_PATH] = "{not-json"
	var loaded := MetaSave.new(backend)
	assert_eq(loaded.crystals(), 0, "坏档应回落默认档不崩溃")


func test_hero_unlock_via_crystal_record() -> void:
	assert_false(save.is_hero_unlocked("H008"), "陷阱师初始应未解锁")
	save.unlock_hero("H008")
	assert_true(save.is_hero_unlocked("H008"), "解锁记录后应为已解锁")
	assert_true(save.is_hero_unlocked("H001"), "初始皮肤英雄应永久解锁（codex 激活）")


func test_unlock_level_only_advances() -> void:
	assert_true(save.unlock_level_to(3), "解锁到第 3 关应生效")
	assert_eq(save.unlocked_levels(), 3, "解锁档位应为 3")
	assert_false(save.unlock_level_to(2), "回退解锁应被拒绝")
	assert_eq(save.unlocked_levels(), 3, "回退不应改变档位")


func test_level_stars_only_improve() -> void:
	assert_true(save.set_level_stars("LEVEL_001", 2), "首次记录 2 星应生效")
	assert_false(save.set_level_stars("LEVEL_001", 1), "更低星级不应覆盖")
	assert_eq(save.level_stars("LEVEL_001"), 2, "最佳星级应保留")
	assert_true(save.set_level_stars("LEVEL_001", 3), "更高星级应覆盖")
	assert_eq(save.level_stars("LEVEL_001"), 3, "最佳星级应更新为 3 星")
	assert_false(save.set_level_stars("LEVEL_001", 5), "越界星级应被拒绝（上限 3）")


func test_weapon_level_and_skill_level_migration() -> void:
	save.set_hero_weapon_lv("H001", 7)
	assert_eq(save.hero_weapon_lv("H001"), 7, "武器等级应写入")
	backend[MetaSave.SAVE_PATH] = JSON.stringify({
		"version": 1, "crystals": 5, "unlockedLevels": 2,
		"heroes": {"H002": {"skillLevel": 4}},
	})
	var loaded := MetaSave.new(backend)
	assert_eq(loaded.hero_weapon_lv("H002"), 4, "旧档 skillLevel 应迁移为 weaponLv")


func test_weekly_abyss_crystals_accumulate() -> void:
	save.add_weekly_abyss_crystals(30)
	save.add_weekly_abyss_crystals(15)
	assert_eq(save.weekly_abyss_crystals(), 45, "本周深渊结晶应累加")
