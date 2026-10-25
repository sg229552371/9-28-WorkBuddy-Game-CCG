## 单测：圣物效果聚合 / 触发查询 / 负反馈 / 组合词条 / 商店定价（babel_relic_logic + babel_shop_logic）
extends GutTest

const R1: Dictionary = {
	"id": "RL01", "name_cn": "断角", "rarity": "white",
	"effect": {"type": "stat_add", "params": {"melee_dmg_add": 3}},
	"desc_cn": "近战伤害 +3",
}
const R2: Dictionary = {
	"id": "RL04", "name_cn": "干粮陶罐", "rarity": "white",
	"effect": {"type": "stat_add", "params": {"team_hp_add": 4}},
	"desc_cn": "全队最大 HP +4",
}
const R_BLUE: Dictionary = {
	"id": "RL21", "name_cn": "双子神像", "rarity": "blue",
	"effect": {"type": "split_damage", "params": {"share_ratio": 0.3}},
	"desc_cn": "相邻友军分摊 30% 伤害",
}
const R_TRIG: Dictionary = {
	"id": "RL20", "name_cn": "无名骨灰瓮", "rarity": "white",
	"effect": {"type": "trigger", "params": {"event": "battle_end", "incense_add": 2}},
	"desc_cn": "战斗结束 +2 香火",
}


func test_collect_stats() -> void:
	var stats: Dictionary = BabelRelicLogic.collect_stats([R1, R2, R_BLUE])
	assert_almost_eq(float(stats.get("melee_dmg_add", 0.0)), 3.0, 0.001)
	assert_almost_eq(float(stats.get("team_hp_add", 0.0)), 4.0, 0.001)
	assert_false(stats.has("share_ratio"))


func test_triggers_for() -> void:
	var trigs: Array = BabelRelicLogic.triggers_for([R_TRIG, R1], "battle_end")
	assert_eq(trigs.size(), 1)
	assert_eq(str((trigs[0] as Dictionary).get("id", "")), "RL20")
	var none: Array = BabelRelicLogic.triggers_for([R_TRIG], "kill")
	assert_eq(none.size(), 0)


func test_count_blue_plus_and_event_bonus() -> void:
	assert_eq(BabelRelicLogic.count_blue_plus([R1, R2]), 0)
	assert_eq(BabelRelicLogic.count_blue_plus([R_BLUE, R_BLUE, R_BLUE, R_BLUE, R1]), 4)
	assert_almost_eq(BabelRelicLogic.blasphemy_event_bonus([R_BLUE, R_BLUE, R_BLUE, R_BLUE], 4, 0.15), 0.15, 0.001)
	assert_almost_eq(BabelRelicLogic.blasphemy_event_bonus([R_BLUE], 4, 0.15), 0.0, 0.001)


func test_combo_lines() -> void:
	var team: Array = [{"name_cn": "焚香者·烬", "passive": {"desc_cn": "相邻友军受击反弹 2 点"}}]
	var lines: Array[String] = BabelRelicLogic.combo_lines(team, [R1])
	assert_eq(lines.size(), 2)
	assert_true(lines[0].contains("焚香者"))
	assert_true(lines[1].contains("断角"))


func test_shop_pricing() -> void:
	var shop: Dictionary = {"reroll_cost_base": 5.0, "relic_price": {"white": 10, "blue": 18, "gold": 30}, "skill_upgrade_cost": 8.0, "gold_chance": 0.12}
	assert_eq(BabelShopLogic.relic_price("white", shop, 1.0), 10)
	assert_eq(BabelShopLogic.relic_price("gold", shop, 0.8), 24)
	assert_eq(BabelShopLogic.reroll_cost(shop, 0, 1.0), 5)
	assert_eq(BabelShopLogic.reroll_cost(shop, 2, 1.0), 15)
	assert_eq(BabelShopLogic.skill_upgrade_cost(shop, 1.0), 8)
	assert_almost_eq(BabelShopLogic.gold_chance(shop), 0.12, 0.001)


func test_roll_relic_fallback() -> void:
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 7
	# gold 池无货 → 回退任意
	var r: Dictionary = BabelRelicLogic.roll_relic(rng, [R1, R_BLUE], "gold")
	assert_false(r.is_empty())
	assert_true(BabelRelicLogic.roll_relic(rng, [R1], "white").get("id", "") == "RL01" or BabelRelicLogic.roll_relic(rng, [R1], "white").is_empty() == false)
