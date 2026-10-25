## 单测：主流程状态迁移合法性与推进逻辑（babel_main.gd 静态部分）
extends GutTest

func test_valid_transitions() -> void:
	assert_true(BabelMain.is_transition_valid("main_city", "hero_select"))
	assert_true(BabelMain.is_transition_valid("hero_select", "battle"))
	assert_true(BabelMain.is_transition_valid("battle", "event"))
	assert_true(BabelMain.is_transition_valid("battle", "settle"))
	assert_true(BabelMain.is_transition_valid("settle", "totem"))
	assert_true(BabelMain.is_transition_valid("totem", "main_city"))
	assert_false(BabelMain.is_transition_valid("main_city", "battle"))
	assert_false(BabelMain.is_transition_valid("settle", "battle"))


func test_next_after_battle_flow() -> void:
	# 屏蔽真实表 → 走防御默认单章（has_event=true, has_shop=true）
	var main: BabelMain = BabelMain.new()
	main.cfg = BabelCfgData.new()
	main.cfg.inject_table("srpg_chapters", null)
	# 表缺省时 chapters 用默认单章：battles=1, has_event=true
	main.run = {
		"team": ["CH_x"], "relics": [], "chapter_idx": 0, "battles_done": 0,
		"event_done": false, "shop_done": false, "canon_done": false,
		"shards": 0, "kills": 0, "incense_add": 0.0, "team_shield": 0.0,
		"team_dmg_add": 0.0, "cd_penalty_s": 0.0, "cd_penalty_targets": 1,
		"boss_stacks": 0.0, "boss_mod": {}, "price_mul": 1.0, "mvp_line": "", "settle_incense": 0,
	}
	var next: String = main.next_after_battle({"shards": 5, "kills": 3, "winner": "player"})
	assert_eq(next, "event")
	# 事件后无更多战斗 → 商店
	main.run["event_done"] = true
	assert_false(main.has_more_battles())
	# 商店与封圣也完成 → 章末推进；防御默认单章 → chapter_idx=1 ≥ 1 → settle
	main.run["shop_done"] = true
	main.run["canon_done"] = true
	var next2: String = main.next_after_battle({"shards": 5, "kills": 3, "winner": "player"})
	# 单章表（防御默认）章末推进后 chapter_idx=1 ≥ chapters.size()=1 → settle
	assert_eq(next2, "settle")


func test_settle_incense_conversion() -> void:
	var main: BabelMain = autofree(BabelMain.new())
	main.run = {
		"team": [], "relics": [], "chapter_idx": 0, "battles_done": 0,
		"event_done": false, "shop_done": false, "canon_done": false,
		"shards": 150, "kills": 10, "incense_add": 5.0, "team_shield": 0.0,
		"team_dmg_add": 0.0, "cd_penalty_s": 0.0, "cd_penalty_targets": 1,
		"boss_stacks": 0.0, "boss_mod": {}, "price_mul": 1.0, "mvp_line": "", "settle_incense": 0,
	}
	main.meta_data = {"incense": 0, "totems": [], "unlocked_chiefs": []}
	var res: Dictionary = main.settle_run({"shards": 150, "kills": 10, "winner": "player"})
	# 150 残片 × 0.4 + 事件加成 5 = 65（期望单局 60 口径）
	assert_eq(int(res.get("incense", 0)), 65)
	assert_eq(int(main.meta_data.get("incense", 0)), 65)
