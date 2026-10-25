# M0 冒烟测试：仅验证 GUT 测试基建可用。
# 不测试任何技能系统实现（M0 无实现代码，实现从 M1 开始，测试先行）。
# 注：jes-skills 所有文件位于 res://mods/jes-skills/ 下，便于整体迁移。
extends GutTest

func test_gut_infra_works() -> void:
	assert_true(true, "GUT 测试基建可用")

func test_skeleton_dirs_exist() -> void:
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/systems/skills"), "systems/skills 目录存在")
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/systems/perf"), "systems/perf 目录存在")
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/content/gems/active"), "content/gems/active 目录存在")
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/content/gems/supports"), "content/gems/supports 目录存在")
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/content/gems/triggers"), "content/gems/triggers 目录存在")
	assert_true(DirAccess.dir_exists_absolute("res://mods/jes-skills/tests/skills"), "tests/skills 目录存在")
