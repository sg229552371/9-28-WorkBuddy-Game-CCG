## 批次 B 串测：神权被动 + 技能结算 + 事件 + 商店 + 元进度 + 一条小流程。
extends GutTest

const ChiefScript = preload("res://mods/jes-babel/systems/chief_system.gd")
const EventScript = preload("res://mods/jes-babel/systems/event_system.gd")
const ShopScript = preload("res://mods/jes-babel/systems/shop_system.gd")
const MetaScript = preload("res://mods/jes-babel/systems/meta_system.gd")
const RelicScript = preload("res://mods/jes-babel/systems/relic_system.gd")

## 精简内联表（字段与 cfg 一致）
const EVENTS: Array[Dictionary] = [
	{"chapter": 1, "options": [
		{"track": "devotion", "effects": [{"type": "team_shield", "value": 8}],
			"boss_mutation": {"type": "holy_repay", "params": {"interval_rounds": 5, "heal_ratio": 0.05}}},
		{"track": "blasphemy", "effects": [{"type": "relic_slot_add", "value": 1}, {"type": "battle_start_stun", "value": 2, "targets": 1}],
			"boss_mutation": {"type": "divine_wrath", "params": {"threshold": 0.5, "aoe_dmg": 12}}},
	]},
	{"chapter": 2, "options": [
		{"track": "devotion", "effects": [{"type": "team_max_hp_add", "value": 4}],
			"boss_mutation": {"type": "holy_repay", "params": {"interval_rounds": 4}}},
	]},
]
const RELIC_POOL: Array[Dictionary] = [
	{"id": "W1", "name_cn": "白", "rarity": "white", "effect": {"type": "stat_add", "params": {"melee_dmg_add": 3}}},
	{"id": "B1", "name_cn": "蓝", "rarity": "blue", "effect": {"type": "trigger", "params": {"event": "battle_start", "shield": 2}}},
	{"id": "G1", "name_cn": "金", "rarity": "gold", "effect": {"type": "sacrifice_redirect", "params": {"self_loss_to_enemy_aoe": true}}},
]
const SKILLS: Dictionary = {
	"SK_STARFALL": {"id": "SK_STARFALL", "shape": "cross", "range": 3, "value": 6, "params": {}},
	"SK_OFFER": {"id": "SK_OFFER", "shape": "single", "range": 0, "value": 2, "params": {"self_loss_hp": 5, "team_atk_add": 2, "buff_rounds": 1}},
	"SK_HOLY_RAIN": {"id": "SK_HOLY_RAIN", "shape": "3x3", "range": 3, "value": 0, "params": {"wet_bonus": 3, "wet_hits": 2}},
}


func _chief_sys() -> BabelChiefSystem:
	return ChiefScript.create_default()


func _mk_player(id: String, chief: String) -> BabelUnit:
	var u: BabelUnit = BabelUnit.create_default(id, true)
	u.chief_id = chief
	return u


# ---------- 神权被动 ----------

func test_far_damage_bonus_boundary() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	var a: BabelUnit = _mk_player("a", "CH_tong")
	var t: BabelUnit = BabelUnit.create_default("t", false)
	board.place(a, Vector2i(0, 0))
	board.place(t, Vector2i(2, 0))
	assert_almost_eq(cs.damage_bonus(a, t, board), 1.0, 0.0001, "距离 2 不加成")
	t.pos = Vector2i(3, 0)
	assert_almost_eq(cs.damage_bonus(a, t, board), 1.4, 0.0001, "距离 3 加成 ×1.4")
	t.pos = Vector2i(5, 4)
	assert_almost_eq(cs.damage_bonus(a, t, board), 1.4, 0.0001, "距离 8 加成 ×1.4")


func test_side_guard_override() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var u: BabelUnit = _mk_player("p", "CH_pan")
	assert_false(u.side_guard, "未应用前无侧盾")
	cs.apply_unit_mod(u)
	assert_true(u.side_guard, "磐被动覆盖 side_guard 标记")


func test_water_free_move() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	board.set_terrain(Vector2i(3, 3), "water")
	board.set_terrain(Vector2i(4, 3), "cover")
	var xi: BabelUnit = _mk_player("xi", "CH_xi")
	assert_true(cs.can_free_move(xi, board, Vector2i(3, 3)), "水格免耗移动")
	assert_false(cs.can_free_move(xi, board, Vector2i(4, 3)), "非水格不免耗")
	var jin: BabelUnit = _mk_player("jin", "CH_jin")
	assert_false(cs.can_free_move(jin, board, Vector2i(3, 3)), "非汐被动不免耗")


func test_silence_aura_boundary() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var mo: BabelUnit = _mk_player("mo", "CH_mo")
	mo.pos = Vector2i(5, 4)
	var near: BabelUnit = BabelUnit.create_default("e1", false)
	near.pos = Vector2i(7, 4)
	var far: BabelUnit = BabelUnit.create_default("e2", false)
	far.pos = Vector2i(8, 4)
	var players: Array[BabelUnit] = [mo]
	assert_true(BabelChiefSystem.is_silenced(near, players, cs.chiefs), "距 2 格被沉默")
	assert_false(BabelChiefSystem.is_silenced(far, players, cs.chiefs), "距 3 格不被沉默")


func test_death_shield_cap() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 11
	var man: BabelUnit = _mk_player("man", "CH_man")
	var mate: BabelUnit = _mk_player("mate", "CH_jin")
	var players: Array[BabelUnit] = [man, mate]
	var got: Variant = cs.on_enemy_died(players, rng)
	assert_true(got is BabelUnit, "敌死触发随机友军加盾")
	assert_eq((got as BabelUnit).shield, 1, "获得 1 点盾")
	# 顶到 cap（蔓被动 cap=6）
	var capped: BabelUnit = players[0]
	capped.shield = 6
	for i: int in range(10):
		var g2: Variant = cs.on_enemy_died(players, rng)
		if g2 is BabelUnit:
			assert_true((g2 as BabelUnit).shield <= 6, "盾不超过 cap")
	assert_true(capped.shield <= 6, "上限 clamp 生效")


func test_reflect_adjacent_hook() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	var jin: BabelUnit = _mk_player("jin", "CH_jin")
	var enemy: BabelUnit = BabelUnit.create_default("e", false)
	board.place(jin, Vector2i(5, 4))
	board.place(enemy, Vector2i(6, 4))
	var resolver: BabelResolver = BabelResolver.create_default()
	var res: Dictionary = cs.on_damage_taken(jin, enemy, resolver, board)
	assert_eq(int(res.get("raw", 0)), 2, "烬受击反伤 2 点")
	assert_eq(enemy.hp, 28, "敌人被反伤扣血")


# ---------- 技能结算 ----------

func test_sk_starfall_cross_damage() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	var tong: BabelUnit = _mk_player("tong", "CH_tong")
	var e1: BabelUnit = BabelUnit.create_default("e1", false)
	var e2: BabelUnit = BabelUnit.create_default("e2", false)
	board.place(tong, Vector2i(0, 4))
	board.place(e1, Vector2i(5, 4))
	board.place(e2, Vector2i(8, 5))
	var resolver: BabelResolver = BabelResolver.create_default()
	var units: Array[BabelUnit] = [tong, e1, e2]
	var tgt2: Array = [Vector2i(5, 4)]
	var results: Array[Dictionary] = cs.execute_skill(SKILLS["SK_STARFALL"], tong, tgt2, board, resolver, units)
	assert_eq(results.size(), 1, "星坠返回一段结算")
	assert_eq(e1.hp, 24, "十字中心敌受 6 点（无朝向修正）")
	assert_eq(e2.hp, 30, "十字外敌人不受影响")


func test_sk_offer_self_loss_and_redirect() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	var jin: BabelUnit = _mk_player("jin", "CH_jin")
	var mate: BabelUnit = _mk_player("mate", "CH_pan")
	var e1: BabelUnit = BabelUnit.create_default("e1", false)
	board.place(jin, Vector2i(2, 2))
	board.place(e1, Vector2i(6, 2))
	var resolver: BabelResolver = BabelResolver.create_default()
	var units: Array[BabelUnit] = [jin, mate, e1]
	# 无 redirect：自损 + 全队攻击加成
	var tgt3: Array = [Vector2i(2, 2)]
	cs.execute_skill(SKILLS["SK_OFFER"], jin, tgt3, board, resolver, units, {})
	assert_eq(jin.hp, 25, "自损 5 点 HP")
	assert_eq(int(mate.state.get("atk_bonus", 0)), 2, "全队攻击 +2")
	# redirect：自损转敌方全体
	var e2: BabelUnit = BabelUnit.create_default("e2", false)
	e2.pos = Vector2i(8, 8)
	units.append(e2)
	var jin_hp_before: int = jin.hp
	cs.execute_skill(SKILLS["SK_OFFER"], jin, tgt3, board, resolver, units, {"sacrifice_redirect": true})
	assert_eq(jin.hp, jin_hp_before, "redirect 时不自损")
	assert_eq(e1.hp, 25, "敌方全体受 5 点等量伤害")


func test_sk_holy_rain_wet_hits() -> void:
	var cs: BabelChiefSystem = _chief_sys()
	var board: BabelBoard = BabelBoard.create_default()
	var xi: BabelUnit = _mk_player("xi", "CH_xi")
	var e1: BabelUnit = BabelUnit.create_default("e1", false)
	board.place(xi, Vector2i(0, 0))
	board.place(e1, Vector2i(5, 4))
	var resolver: BabelResolver = BabelResolver.create_default()
	var units: Array[BabelUnit] = [xi, e1]
	var tgt: Array = [Vector2i(5, 4)]
	cs.execute_skill(SKILLS["SK_HOLY_RAIN"], xi, tgt, board, resolver, units)
	assert_eq(int(e1.state.get("wet_hits", 0)), 2, "圣雨标记 wet_hits=2")


# ---------- 事件 / 商店 / 元进度 ----------

func test_event_pick_by_chapter() -> void:
	var es: BabelEventSystem = EventScript.create_default()
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 5
	var g1: Dictionary = es.pick(EVENTS, 1, rng)
	assert_eq(int(g1.get("chapter", 0)), 1, "按章节取组")
	var g2: Dictionary = es.pick(EVENTS, 2, rng)
	assert_eq(int(g2.get("chapter", 0)), 2, "第 2 章取到第 2 组")
	var g9: Dictionary = es.pick(EVENTS, 9, rng)
	assert_true(g9.is_empty(), "无匹配章节返回空")


func test_event_choose_tracks_and_effects() -> void:
	var es: BabelEventSystem = EventScript.create_default()
	var opt: Dictionary = es.choose(EVENTS[0], "devotion")
	assert_eq(str(opt.get("track", "")), "devotion", "选择虔信轨")
	assert_eq(es.pending_effects.size(), 1, "虔信效果入队")
	var bm: Dictionary = es.get("boss_mutation") as Dictionary
	assert_eq(str(bm.get("type", "")), "holy_repay", "虔信突变 holy_repay")
	var opt2: Dictionary = es.choose(EVENTS[0], "blasphemy")
	assert_eq(str(opt2.get("track", "")), "blasphemy", "选择渎神轨")
	var bm2: Dictionary = es.get("boss_mutation") as Dictionary
	assert_eq(str(bm2.get("type", "")), "divine_wrath", "渎神突变 divine_wrath")


func test_event_apply_effects_and_stun_roll() -> void:
	var es: BabelEventSystem = EventScript.create_default()
	es.choose(EVENTS[0], "devotion")
	var u1: BabelUnit = _mk_player("u1", "CH_jin")
	var u2: BabelUnit = _mk_player("u2", "CH_pan")
	var units: Array[BabelUnit] = [u1, u2]
	var board: BabelBoard = BabelBoard.create_default()
	es.apply_effects(units, board, null)
	assert_eq(u1.shield, 6, "team_shield +8 但受 cap=6 限制")
	assert_eq(u2.shield, 6, "全队生效")
	# 渎神眩晕：随机 1 名角色 stunned_rounds=2
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 3
	es.choose(EVENTS[0], "blasphemy")
	var target: BabelUnit = es.roll_stun_target(units, rng)
	assert_true(target == u1 or target == u2, "随机眩晕目标为存活玩家之一")
	assert_eq(int(target.state.get("stunned_rounds", 0)), 2, "眩晕 2 回合")


func test_shop_buy_and_reroll() -> void:
	var shop: BabelShopSystem = ShopScript.create_default()
	var white: Dictionary = RELIC_POOL[0]
	# 白基础价 10
	assert_eq(BabelShopSystem.price_of(white), 10, "白基础价 10")
	assert_eq(BabelShopSystem.price_of(RELIC_POOL[1]), 18, "蓝基础价 18")
	assert_eq(BabelShopSystem.price_of(RELIC_POOL[2]), 30, "金基础价 30")
	var ok: Dictionary = shop.buy(white, 12)
	assert_true(bool(ok.get("ok", false)), "够钱购买成功")
	assert_eq(int(ok.get("shards_left", -1)), 2, "扣款后剩 2 残片")
	var fail: Dictionary = shop.buy(white, 5)
	assert_false(bool(fail.get("ok", true)), "不够钱购买失败")
	assert_eq(int(fail.get("shards_left", -1)), 5, "失败不扣款")
	# price_mod
	assert_eq(BabelShopSystem.price_of(white, 1.5), 15, "价格乘区生效")
	# reroll：残片不足返回空
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 9
	assert_eq(shop.reroll(rng, RELIC_POOL, 3).size(), 0, "残片 <5 不能刷新")
	var stocked: Array[Dictionary] = shop.stock(rng, RELIC_POOL, 3)
	assert_eq(stocked.size(), 3, "默认进货 3 件")


func test_meta_settle_and_totems() -> void:
	var meta: BabelMetaSystem = MetaScript.create_default()
	assert_eq(meta.settle(12, 3), 42, "香火 = 残片×1 + 每章×10 = 12+30")
	# 图腾购买
	var cheap: Dictionary = {"id": "TT01", "cost": 30}
	var ok: Dictionary = meta.buy_totem(cheap, 40)
	assert_true(bool(ok.get("ok", false)), "香火足够可购图腾")
	assert_eq(int(ok.get("incense_left", -1)), 10, "购买后剩 10 香火")
	var expensive: Dictionary = {"id": "TT09", "cost": 120}
	assert_false(bool(meta.buy_totem(expensive, 50).get("ok", true)), "香火不足购买失败")
	# 开局规则归并：atk_add 累加 / shop_price_mul 乘算 / start_shield 累加
	var totems: Array = [
		{"id": "T1", "effect": {"type": "start_rule", "params": {"chief": "CH_jin", "atk_add": 3}}},
		{"id": "T2", "effect": {"type": "start_rule", "params": {"atk_add": 3, "shop_price_mul": 0.8, "team_start_shield": 3}}},
		{"id": "T3", "effect": {"type": "start_rule", "params": {"shop_price_mul": 0.5, "team_start_shield": 2}}},
	]
	var rules: Dictionary = meta.start_rules(totems)
	assert_eq(int(rules.get("atk_add", 0)), 6, "atk_add 累加为 6")
	assert_almost_eq(float(rules.get("shop_price_mul", 1.0)), 0.4, 0.0001, "shop_price_mul 乘算为 0.4")
	assert_eq(int(rules.get("team_start_shield", 0)), 5, "team_start_shield 累加为 5")
	assert_eq(str(rules.get("chief", "")), "CH_jin", "非数值同键后写覆盖")


# ---------- 串流程 ----------

func test_flow_shop_relic_event_meta() -> void:
	# 1. 商店买圣物
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = 77
	var relic_sys: BabelRelicSystem = RelicScript.create_default()
	var shop: BabelShopSystem = ShopScript.new(relic_sys)
	var stock: Array[Dictionary] = shop.stock(rng, RELIC_POOL, 3)
	assert_eq(stock.size(), 3, "流程：商店进货 3 件")
	var bought: Dictionary = shop.buy(stock[0], 100)
	assert_true(bool(bought.get("ok", false)), "流程：购买成功")
	# 2. 圣物效果应用到单位
	var hero: BabelUnit = _mk_player("hero", "CH_jin")
	var apply_res: Dictionary = relic_sys.apply_effect(stock[0], hero, null)
	assert_true(bool(apply_res.get("ok", false)), "流程：圣物效果应用成功")
	relic_sys.add_relic(stock[0])
	# 3. 事件选择 devotion，效果入队并应用
	var es: BabelEventSystem = EventScript.create_default()
	es.choose(EVENTS[0], "devotion")
	var hero_units: Array[BabelUnit] = [hero]
	es.apply_effects(hero_units, null, null)
	# 4. boss_mutation 存在
	var bm: Dictionary = es.get("boss_mutation") as Dictionary
	assert_false(bm.is_empty(), "流程：boss_mutation 已记录")
	assert_eq(str(bm.get("type", "")), "holy_repay", "流程：突变类型正确")
	# 5. 元进度结算
	var meta: BabelMetaSystem = MetaScript.create_default()
	assert_eq(meta.settle(int(bought.get("shards_left", 0)), 3), int(bought.get("shards_left", 0)) + 30, "流程：香火结算正确")
