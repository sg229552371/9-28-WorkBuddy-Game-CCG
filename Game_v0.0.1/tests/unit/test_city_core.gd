extends GutTest

const CityScript = preload("res://mods/jes-city/scripts/city_mode.gd")
const UnlockScript = preload("res://mods/jes-city/scripts/unlock.gd")
const GrowthScript = preload("res://mods/jes-city/scripts/hero_growth.gd")
const ShopScript = preload("res://mods/jes-city/scripts/shop.gd")


func _item_factory(request: Dictionary) -> Dictionary:
	var item := request.duplicate(true)
	item["name"] = "测试物品"
	return item


func test_shop_context_and_coin_failure_atomic() -> void:
	var shop = ShopScript.new()
	shop.set_item_factory(_item_factory)
	var cost := int(CityScript.read_config("artisanServices", {}).buyModule.cost)
	var run := {"coin": cost, "pendingItems": []}
	assert_false(shop.buy("buyModule", run, false).ok, "非工匠世界禁止购买")
	assert_eq(run.coin, cost, "上下文拒绝不扣款")
	run.coin = cost - 1
	assert_false(shop.buy("buyModule", run, true).ok, "金币不足拒绝购买")
	assert_eq(run.coin, cost - 1, "余额不足不扣款")
	assert_eq(run.pendingItems.size(), 0, "失败没有产物")


func test_shop_module_payment_and_delivery() -> void:
	var shop = ShopScript.new()
	shop.set_item_factory(_item_factory)
	var items: Array = []
	shop.set_item_grant(func(item): items.append(item); return true)
	var cost := int(CityScript.read_config("artisanServices", {}).buyModule.cost)
	var run := {"coin": cost * 2, "pendingItems": []}
	assert_true(shop.buy("buyModule", run, true).ok, "购买成功")
	assert_true(shop.buy("buyModule", run, true).ok, "允许连续按次购买")
	assert_eq(run.coin, 0, "两次购买仅扣两次费用")
	assert_eq(items.size(), 2, "每次恰好交付一件")
	assert_eq(items[0].kind, "module", "模块商品使用模块构造请求")
	assert_between(int(items[0].itemQ), 0, 3, "品质按四档权重生成")
	assert_true(CityScript.read_config("moduleDefs", []).any(func(d): return d.id == items[0].defId), "模块定义来自导出表")
	assert_eq(run.pendingItems.size(), 0, "成功入包不重复进待分配区")


func test_shop_full_inventory_to_pending() -> void:
	var shop = ShopScript.new()
	shop.set_item_factory(_item_factory)
	shop.set_item_grant(func(_item): return false)
	var cost := int(CityScript.read_config("artisanServices", {}).buyItem.cost)
	var run := {"coin": cost, "pendingItems": []}
	var result: Dictionary = shop.buy("buyItem", run, true)
	assert_true(result.ok, "背包满仍完成购买")
	assert_eq(run.coin, 0, "待分配物品仍扣等额费用")
	assert_eq(run.pendingItems.size(), 1, "背包满只进入待分配区一次")
	assert_true(result.msg.contains("待分配区"), "返回明确去向文案")
	assert_true(run.pendingItems[0].kind in ["insurance", "curse"], "只生成真源现有消耗品")


func test_shop_item_weights_cover_existing_kinds() -> void:
	var shop = ShopScript.new()
	shop.set_seed(20261024)
	shop.set_item_factory(_item_factory)
	var cost := int(CityScript.read_config("artisanServices", {}).buyItem.cost)
	var run := {"coin": cost * 60, "pendingItems": []}
	var kinds := {}
	for index in range(60):
		assert_true(shop.buy("buyItem", run, true).ok, "每笔购买必须成功")
	for item in run.pendingItems:
		kinds[item.kind] = true
	assert_true(kinds.has("insurance") and kinds.has("curse"), "固定种子覆盖保险和诅咒两类")
	assert_eq(run.coin, 0, "每笔严格按表扣费")


func test_shop_stock_and_refresh_retirement() -> void:
	var shop = ShopScript.new()
	var offers: Array = shop.shelves()
	assert_eq(offers.size(), 2, "真源金币商店只有两个随机商品")
	assert_eq(shop.stock("buyModule"), -1, "真源可重复购买，无有限库存")
	var run := {"coin": 1000}
	assert_false(shop.refresh(run).ok, "旧卡牌刷新已退役，不补造刷新规则")
	assert_eq(run.coin, 1000, "无刷新配置不扣款")


func test_shop_missing_factory_preserves_wallet() -> void:
	var shop = ShopScript.new()
	var cost := int(CityScript.read_config("artisanServices", {}).buyModule.cost)
	var run := {"coin": cost}
	assert_false(shop.buy("buyModule", run, true).ok, "未接物品工厂时保守拒绝交易")
	assert_eq(run.coin, cost, "无法交付时不得吃掉金币")
	shop.set_item_factory(func(_request): return {})
	assert_false(shop.buy("buyModule", run, true).ok, "工厂生成失败不扣钱")
	assert_eq(run.coin, cost, "空产物交易不扣款")


func test_growth_level_cost_and_cap() -> void:
	var growth = GrowthScript.new({"testUnlockAllHeroes": false})
	var cfg: Dictionary = CityScript.read_config("outLevel", {})
	var state := {"heroes": {"H001": {"level": 1, "weaponLv": 4}}, "crystals": int(cfg.costBase) - 1}
	assert_false(growth.level_up("H001", state), "余额不足不能升级")
	state.crystals = int(cfg.costBase)
	assert_true(growth.level_up("H001", state), "恰好满足费用可升级")
	assert_eq(state.crystals, 0, "扣除配置费用")
	assert_eq(growth.hero_level("H001", state), 2, "局外等级增加一级")
	assert_eq(state.heroes.H001.weaponLv, 4, "保留其他养成字段")
	assert_eq(growth.level_up_cost("H001", state), int(floor(float(cfg.costBase) * float(cfg.growthRate) + 0.5)), "第二级费用走指数曲线")
	state.heroes.H001.level = cfg.maxLevel
	assert_eq(growth.level_up_cost("H001", state), 0, "满级费用归零")
	assert_false(growth.level_up("H001", state), "满级拒绝升级")


func test_growth_role_stages_and_linear_fallback() -> void:
	var growth = GrowthScript.new()
	var hero: Dictionary = growth.hero_definition("H004")
	var cfg: Dictionary = CityScript.read_config("outLevel", {})
	var role: Dictionary = cfg.growthByRole.defense
	var stats: Dictionary = growth.out_level_stats("H004", 4)
	assert_eq(stats.hp, int(floor(float(hero.hp) + float(role.hp) * (2.0 + 1.35) + 0.5)), "防御定位按目标等级逐段累加血量")
	assert_eq(growth.out_level_stats("H004", 1).atk, int(hero.atk), "一级属性等于基础值")
	var old_cfg := cfg.duplicate(true)
	old_cfg.erase("growthRate")
	old_cfg.erase("growthTable")
	var legacy = GrowthScript.new({"outLevel": old_cfg})
	var state := {"heroes": {"H004": {"level": 3}}}
	assert_eq(legacy.level_up_cost("H004", state), int(cfg.costBase + 2 * cfg.costStep), "缺指数配置回落真源线性费用")
	assert_eq(legacy.out_level_stats("H004", 3).hp, int(hero.hp + 2 * role.hp), "缺分段表回落线性成长")


func test_growth_exp_curve_and_multi_level() -> void:
	var growth = GrowthScript.new()
	var cfg: Dictionary = CityScript.read_config("levelUp", {}).curve
	assert_eq(growth.exp_next_for(1), int(floor(float(cfg.base) * float(cfg.softCapMul) + 0.5)), "前期经验享受宽松系数")
	var after := int(cfg.softCapLv) + 1
	assert_eq(growth.exp_next_for(after), int(floor(float(cfg.base) * pow(float(cfg.growth), after - 1) + 0.5)), "越过软上限不再乘宽松系数")
	var run := {"lv": 1, "exp": 0}
	var required := growth.exp_next_for(1) + growth.exp_next_for(2)
	assert_eq(growth.gain_exp(run, required), 2, "一次经验可连升两级")
	assert_eq(run.lv, 3, "局内等级累计推进")
	assert_eq(run.exp, 0, "扣除两级所需经验")
	assert_eq(run.expNext, growth.exp_next_for(3), "经验门槛随局内等级更新")
	assert_eq(growth.gain_exp(run, -1), 0, "负经验不得降级")
	run.lv = int(cfg.maxLv) - 1
	run.exp = 0
	assert_eq(growth.gain_exp(run, growth.exp_next_for(run.lv) + 1), 1, "最后一级仍按曲线升级")
	assert_eq(run.exp, 0, "升至上限后经验清零")
	assert_eq(growth.gain_exp(run, required), 0, "经验满级后不突破上限")


func test_growth_team_limit_and_locked_block() -> void:
	var growth = GrowthScript.new({"testUnlockAllHeroes": false})
	var state := {"heroes": {}, "crystals": 0, "unlockExtra": {}}
	var selected: Array = []
	assert_false(growth.add_to_team("H007", selected, state), "未解锁英雄禁止上阵")
	var starters: Array = CityScript.read_config("starterHeroIds", [])
	var limit := int(CityScript.read_config("team", {}).maxSize)
	for index in range(limit):
		assert_true(growth.add_to_team(starters[index], selected, state), "已解锁英雄可以入队")
	assert_false(growth.add_to_team(starters[0], selected, state), "重复英雄不占第二个位置")
	assert_false(growth.add_to_team(starters[limit], selected, state), "队伍人数不得超过配置上限")
	assert_eq(selected.size(), limit, "失败后队伍保持不变")
	assert_eq(growth.hero_definition("H007").name, CityScript.read_config("heroes", [])[6].name, "未解锁英雄仍公开真实信息")


func test_unlock_starters_and_query_rollback() -> void:
	var unlock = UnlockScript.new({"testUnlockAllHeroes": false})
	var state := {"heroes": {}, "crystals": 0, "unlockExtra": {}}
	assert_eq(unlock.unlocked_heroes(state), CityScript.read_config("heroes", []).filter(func(h): return h.id in CityScript.read_config("starterHeroIds", [])).map(func(h): return h.id), "首发名单按英雄表顺序返回")
	var cond: Dictionary = unlock.rules.H007.heroLv
	state.heroes[cond.heroId] = {"level": int(cond.lv) - 1}
	assert_false(unlock.is_unlocked("H007", state), "低于门槛不解锁")
	state.heroes[cond.heroId].level = cond.lv
	assert_true(unlock.is_unlocked("H007", state), "达到门槛自动解锁")
	state.heroes[cond.heroId].level = 1
	assert_false(unlock.is_unlocked("H007", state), "条件回退后不残留解锁状态")


func test_unlock_crystal_payment_and_idempotence() -> void:
	var unlock = UnlockScript.new({"testUnlockAllHeroes": false})
	var cost := int(unlock.rules.H008.crystal)
	var state := {"heroes": {}, "crystals": cost - 1, "unlockExtra": {}}
	assert_false(unlock.unlock_hero("H008", state), "结晶不足拒绝交易")
	assert_eq(state.crystals, cost - 1, "失败不扣结晶")
	state.crystals = cost
	assert_false(unlock.is_unlocked("H008", state), "余额达到门槛不会自动花钱解锁")
	assert_true(unlock.unlock_hero("H008", state), "精确门槛允许解锁")
	assert_eq(state.crystals, 0, "扣除等额结晶")
	assert_true(state.unlockExtra.H008, "解锁结果写入快照")
	assert_true(unlock.unlock_hero("H008", state), "重复调用幂等成功")
	assert_eq(state.crystals, 0, "重复解锁不再扣款")


func test_unlock_injected_snapshot_and_unknown() -> void:
	var unlock = UnlockScript.new({"testUnlockAllHeroes": false})
	var state := {"heroes": {"H006": {"level": 3}}}
	unlock.set_state_provider(func(): return state)
	assert_true(unlock.is_unlocked("H007"), "允许注入快照提供函数")
	assert_false(unlock.is_unlocked("H999"), "未知英雄保持锁定")
	assert_eq(unlock.rule_info("H999").desc, "暂未解锁", "无规则提供保守提示")
	assert_eq(unlock.rule_info("H007").kind, "heroLv", "等级规则可供界面展示")


func test_unlock_debug_switch_from_config() -> void:
	var unlock = UnlockScript.new()
	assert_eq(unlock.is_unlocked("H008", {}), bool(CityScript.read_config("testUnlockAllHeroes", false)), "正式读取测试全解锁开关")


func test_unlock_all_level_rules_thresholds() -> void:
	var unlock = UnlockScript.new({"testUnlockAllHeroes": false})
	var checked := 0
	for hero_id in unlock.rules:
		var rule: Dictionary = unlock.rules[hero_id]
		if not rule.has("heroLv"):
			continue
		var state := {"heroes": {}, "unlockExtra": {}}
		state.heroes[rule.heroLv.heroId] = {"level": int(rule.heroLv.lv) - 1}
		assert_false(unlock.is_unlocked(hero_id, state), "每条等级规则均检验门槛以下")
		state.heroes[rule.heroLv.heroId].level = rule.heroLv.lv
		assert_true(unlock.is_unlocked(hero_id, state), "每条等级规则均检验精确门槛")
		assert_true(state.unlockExtra.is_empty(), "自动解锁查询不写永久标记")
		checked += 1
	assert_gt(checked, 0, "必须实际覆盖等级规则，避免空循环恒真")


func test_unlock_legacy_starter_order() -> void:
	var unlock = UnlockScript.new({"starterHeroIds": [], "testUnlockAllHeroes": false})
	var limit := int(CityScript.read_config("starterCount", 0))
	assert_eq(unlock.starter_count, limit, "数字配置可正常解析，不误判为缺表")
	for index in range(limit):
		assert_true(unlock.is_unlocked(unlock.order[index], {}), "缺首发列表时回落原始解锁顺序")
	assert_false(unlock.is_unlocked(unlock.order[limit], {}), "首发数量边界以外保持锁定")


func test_city_entrances_and_snapshot_isolation() -> void:
	var city = CityScript.new()
	var cfg: Dictionary = CityScript.read_config("city", {})
	var entries: Array = city.entrances()
	assert_eq(entries.size(), 2, "空赛季传送门不生成入口")
	assert_eq(entries[0].name, cfg.portal.name, "主线入口名称读表")
	assert_eq(entries[1].channel, cfg.abyssPortal.channel, "深渊入口读条时间读表")
	var buildings: Array = city.buildings()
	buildings[0].name = "外部改名"
	assert_eq(city.buildings()[0].name, cfg.npcs[0].name, "对外数据副本不得污染内部配置")


func test_city_interaction_range_boundary() -> void:
	var city = CityScript.new()
	var npc: Dictionary = city.buildings()[0]
	var center := Vector2(npc.x, npc.y)
	var radius: float = float(city.config.npcRadius) * city.judge_mul
	city.update_position(center + Vector2(radius, 0))
	assert_false(city.interact(npc.id).ok, "真源严格小于半径，边界不进入交互圈")
	city.update_position(center)
	assert_false(city.interact("NPC_MISSING").ok, "不得点击其他或不存在的目标")
	assert_true(city.interact().ok, "键盘交互可使用当前最近目标")


func test_city_buildings_from_config() -> void:
	var city = CityScript.new()
	var cfg: Dictionary = CityScript.read_config("city", {})
	assert_eq(city.buildings().size(), cfg.npcs.size(), "建筑数量必须来自配置")
	assert_eq(city.buildings()[0].id, cfg.npcs[0].id, "建筑顺序与配置一致")


func test_city_npc_interaction_and_leave() -> void:
	var city = CityScript.new()
	var npc: Dictionary = city.buildings()[0]
	city.update_position(Vector2(npc.x, npc.y))
	assert_eq(city.near_npc_id, npc.id, "进圈标亮目标")
	assert_eq(city.open_npc_id, "", "进圈不自动弹面板")
	assert_true(city.interact(npc.id).ok, "圈内点击可打开面板")
	city.update_position(Vector2.ZERO)
	assert_eq(city.open_npc_id, "", "离圈自动关闭面板")
