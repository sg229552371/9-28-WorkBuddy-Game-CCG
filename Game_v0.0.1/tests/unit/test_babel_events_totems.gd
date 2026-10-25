## 单测：渎神/敬神事件效果与 Boss 突变 / 图腾开局规则（babel_event_logic + babel_totem_logic）
extends GutTest


func test_devotion_reward_and_boss_mod() -> void:
	var ev: Dictionary = {
		"id": "EV1", "chapter": 1, "name_cn": "开光",
		"devotion": {
			"desc_cn": "全队 +8 盾",
			"reward": [{"type": "team_shield", "value": 8}],
			"boss_mod": {"type": "holy_repay", "params": {"interval_s": 15.0, "heal_ratio": 0.05}},
		},
		"blasphemy": {"desc_cn": "", "reward": [], "cost": [], "boss_mod": {}},
	}
	var run: Dictionary = {}
	var res: Dictionary = BabelEventLogic.apply_choice(ev, "devotion", run)
	assert_almost_eq(float(run.get("team_shield", 0.0)), 8.0, 0.001)
	var bm: Dictionary = res.get("boss_mod", {}) as Dictionary
	assert_eq(str(bm.get("type", "")), "holy_repay")


func test_blasphemy_reward_cost_cd_double() -> void:
	var ev: Dictionary = {
		"id": "EV1", "chapter": 1, "name_cn": "凿面",
		"devotion": {"desc_cn": "", "reward": [], "boss_mod": {}},
		"blasphemy": {
			"desc_cn": "圣物栏 +1",
			"reward": [{"type": "relic_slot_add", "value": 1}],
			"cost": [{"type": "battle_start_stun", "value": 2, "targets": 1}],
			"boss_mod": {"type": "divine_wrath", "params": {"threshold": 0.5, "aoe_dmg": 12.0}},
		},
	}
	var run: Dictionary = {}
	var res: Dictionary = BabelEventLogic.apply_choice(ev, "blasphemy", run)
	assert_eq(int(run.get("relic_slot_add", 0)), 1)
	assert_almost_eq(float(run.get("cd_penalty_s", 0.0)), 10.0, 0.001)
	var bm: Dictionary = res.get("boss_mod", {}) as Dictionary
	assert_eq(str(bm.get("type", "")), "divine_wrath")


func test_cd_penalty_doubles_random_member() -> void:
	var cds: Dictionary = {"A": {"a": 4.0}, "B": {"a": 6.0}, "C": {"a": 8.0}}
	var hit: Array[String] = BabelEventLogic.apply_cd_penalty(cds, ["A", "B", "C"], 1)
	assert_eq(hit.size(), 1)
	# 恰好一个成员 CD 变为原来的 2 倍
	var doubled: int = 0
	var originals: Dictionary = {"A": 4.0, "B": 6.0, "C": 8.0}
	for k: String in cds.keys():
		var c: Dictionary = cds[k] as Dictionary
		if absf(float(c.get("a", 0.0)) - float(originals[k]) * 2.0) < 0.001:
			doubled += 1
	assert_eq(doubled, 1)


func test_totem_start_rules_merge() -> void:
	var totems: Array = [
		{"id": "TT03", "cost": 50, "effect": {"type": "start_rule", "params": {"team_start_shield": 3}}},
		{"id": "TT09", "cost": 120, "effect": {"type": "start_rule", "params": {"team_hp_add": 5, "start_relic_count": 1}}},
		{"id": "TT02", "cost": 40, "effect": {"type": "start_rule", "params": {"shop_price_mul": 0.8}}},
	]
	var rules: Dictionary = BabelTotemLogic.start_rules(["TT03", "TT09", "TT02"], totems)
	assert_almost_eq(float(rules.get("team_start_shield", 0.0)), 3.0, 0.001)
	assert_almost_eq(float(rules.get("team_hp_add", 0.0)), 5.0, 0.001)
	assert_almost_eq(float(rules.get("shop_price_mul", 1.0)), 0.8, 0.001)
	var none: Dictionary = BabelTotemLogic.start_rules(["TT99"], totems)
	assert_true(none.is_empty())


func test_totem_can_buy() -> void:
	var t: Dictionary = {"id": "TT01", "cost": 30}
	assert_true(BabelTotemLogic.can_buy(t, 30, []))
	assert_false(BabelTotemLogic.can_buy(t, 29, []))
	assert_false(BabelTotemLogic.can_buy(t, 100, ["TT01"]))


func test_start_relics() -> void:
	var rules: Dictionary = {"start_relic_count": 2.0, "start_relic_rarity": "blue"}
	var out: Array[String] = BabelTotemLogic.start_relics(rules)
	assert_eq(out.size(), 2)
	assert_eq(out[0], "blue")
