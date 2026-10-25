extends GutTest
## 主城视觉/交互纯逻辑测试（city_logic.gd）：点位表、进圈判定、读条、面板状态机。

const LogicScript = preload("res://mods/jes-city/scripts/city_logic.gd")
const ModeScript = preload("res://mods/jes-city/scripts/city_mode.gd")


func _make_logic() -> RefCounted:
	return LogicScript.new(ModeScript.read_config("city", {}))


func test_npc_table_fully_instantiated() -> void:
	var logic := _make_logic()
	var cfg: Dictionary = ModeScript.read_config("city", {})
	var npc_count: int = (cfg.get("npcs", []) as Array).size()
	# NPC 表全量实例化，另有出征传送门 + 深渊之门两个门类点位
	assert_eq(logic.entries.size(), npc_count + 2, "点位数 = NPC 数 + 双门")
	var ids: Array = []
	for e: Dictionary in logic.entries:
		ids.append(str(e.get("id", "")))
		assert_true(str(e.get("name", "")) != "", "每个点位有名称")
		assert_true(float(e.get("radius", 0)) > 0.0, "每个点位有半径")
		assert_true((e.get("pos", Vector2.ZERO) as Vector2) != Vector2.ZERO, "每个点位有坐标")
	assert_has(ids, "PORTAL_MAIN", "出征传送门在场")
	assert_has(ids, "PORTAL_ABYSS", "深渊之门在场")
	assert_eq(str(logic.entry_by_id("PORTAL_ABYSS").get("kind", "")), "abyss", "深渊门类型正确")


func test_spawn_matches_config() -> void:
	var logic := _make_logic()
	var cfg: Dictionary = ModeScript.read_config("city", {})
	var s: Dictionary = cfg.get("spawn", {})
	var expect := Vector2(float(s.get("x", 0.5)) * float(cfg.get("mapW", 0)), float(s.get("y", 0.78)) * float(cfg.get("mapH", 0)))
	assert_eq(logic.spawn, expect, "出生点读 cfg/city.json")
	assert_eq(logic.player_pos, logic.spawn, "玩家初始在出生点")


func test_entry_at_circle_judgement() -> void:
	var logic := _make_logic()
	var first: Dictionary = logic.entries[0]
	var pos: Vector2 = first.get("pos", Vector2.ZERO)
	assert_eq(logic.entry_at(pos), str(first.get("id", "")), "圈心命中该点位")
	var far := Vector2(1.0, 1.0)
	if logic.entry_at(far) == "":
		assert_eq(logic.entry_at(far), "", "圈外无命中")
	# 圈边界外一点点不命中
	var outside: Vector2 = pos + Vector2(float(first.get("radius", 60)) + 5.0, 0)
	if logic.entry_at(outside) == "":
		assert_eq(logic.entry_at(outside), "", "半径外不命中")


func test_panel_state_machine() -> void:
	var logic := _make_logic()
	var first: Dictionary = logic.entries[0]
	var nid: String = str(first.get("id", ""))
	assert_false(logic.open_panel("NOPE"), "未知点位拒绝开面板")
	assert_true(logic.open_panel(nid), "合法点位开面板")
	assert_eq(logic.open_panel_id, nid, "记录当前面板")
	assert_false(logic.open_panel(nid), "重复开同一面板拒绝")
	assert_true(logic.close_panel(), "有关可关")
	assert_false(logic.close_panel(), "无面板再关返回 false")
	assert_eq(logic.open_panel_id, "", "关闭后面板清空")


func test_panel_blocked_during_channel() -> void:
	var logic := _make_logic()
	var portal: Dictionary = logic.entry_by_id("PORTAL_MAIN")
	logic.player_pos = portal.get("pos", Vector2.ZERO)
	assert_true(logic.start_channel("PORTAL_MAIN"), "进圈可启动读条")
	var npc: Dictionary = logic.entries[0]
	assert_false(logic.open_panel(str(npc.get("id", ""))), "读条中禁止开面板")
	assert_true(logic.close_panel() == false or logic.open_panel_id == "", "面板保持关闭")


func test_channel_progress_and_completion() -> void:
	var logic := _make_logic()
	var portal: Dictionary = logic.entry_by_id("PORTAL_MAIN")
	var channel: float = float(portal.get("channel", 2.0))
	logic.player_pos = portal.get("pos", Vector2.ZERO)
	assert_true(logic.start_channel("PORTAL_MAIN"), "读条启动")
	assert_eq(logic.channel_progress(), 0.0, "初始进度 0")
	assert_false(logic.tick_channel(channel * 0.5), "半程未完成")
	assert_between(logic.channel_progress(), 0.49, 0.51, "进度约一半")
	assert_true(logic.tick_channel(channel * 0.5 + 0.01), "读满即完成")
	assert_false(logic.is_channel_active(), "完成后读条状态清空")
	assert_eq(logic.channel_progress(), 0.0, "完成后进度归零")


func test_channel_requires_inside_and_npc_rejected() -> void:
	var logic := _make_logic()
	assert_false(logic.start_channel("PORTAL_MAIN"), "不在圈内拒绝读条")
	var npc: Dictionary = logic.entries[0]
	logic.player_pos = npc.get("pos", Vector2.ZERO)
	assert_false(logic.start_channel(str(npc.get("id", ""))), "NPC 点位不读条")


func test_move_player_clamps_and_speed() -> void:
	var logic := _make_logic()
	var moved: Vector2 = logic.move_player(Vector2(1, 0), 10.0)
	assert_eq(moved.x, logic.map_size.x, "右移 1 秒钳制到地图右缘")
	logic.player_pos = logic.spawn
	var back: Vector2 = logic.move_player(Vector2(-2, 0), 0.1)
	assert_eq(back.x, logic.spawn.x - logic.move_speed * 0.1, "速度读 moveSpd")
