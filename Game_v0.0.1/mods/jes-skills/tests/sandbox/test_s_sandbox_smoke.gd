# S 沙盒冒烟测试（独立于 M0~M8 基线，放 tests/sandbox/ 不计入 85/85 硬门禁）
# 目标：headless 下验证沙盒完整闭环 —— 装配 → 注入 → 消耗 → 冷却 → cast → 行为计划 → 命中结算
# 硬门禁：确定性（固定种子 RNG）、无 gem_id 分支、时间全部由 tick(dt) 驱动
extends GutTest

const SandboxMainScript := preload("res://mods/jes-skills/sandbox/sandbox_main.gd")

var main: SandboxMain = null


func before_each() -> void:
	main = autofree(SandboxMainScript.new())


func after_each() -> void:
	main = null


# ---------- 装配链路 ----------

## 槽 0 双辅助装配成功，cost = 10 × 1.4 × 1.2 = 16.8
func test_s1_slot0_dual_support_assembly() -> void:
	main._build_entities()
	main._build_skills()
	var res := SocketGraph.assemble(main.slot_bar.get_slot(0))
	assert_true(res.ok, "槽 0 双辅助应装配成功")
	assert_almost_eq(res.cost_multiplier, 1.4 * 1.2, 0.0001, "cost 倍率应连乘 1.68")

## 槽 1 纯火技能无辅助，cost 倍率恒为 1
func test_s2_slot1_no_support_cost_unchanged() -> void:
	main._build_entities()
	main._build_skills()
	var res := SocketGraph.assemble(main.slot_bar.get_slot(1))
	assert_true(res.ok, "槽 1 无辅助装配应成功")
	assert_almost_eq(res.cost_multiplier, 1.0, 0.0001, "无辅助时 cost 倍率应为 1")

## 9 个演示技能全部产出合法行为计划（规格 §11 M5「槽位全可用」/ M6「8 主动」
## + 槽 8「落烬环」= FLY·RING·ZONE 首格，D-31）
func test_s3_all_seven_skills_yield_plans() -> void:
	main._build_entities()
	main._build_skills()
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var behaviors := [
		&"bhv_projectile", &"bhv_aoe_burst", &"bhv_melee_swing",
		&"bhv_channel", &"bhv_dash", &"bhv_buff_self", &"bhv_summon",
	]
	assert_eq(main.DEMO_SLOT_ORDER.size(), 9, "演示内容集应为 9 个主动（8 W1 + 落烬环）")
	for i in main.ACTIVE_SLOT_COUNT:
		var plans := SkillExecutor.cast(main.slot_bar.get_slot(i).active_gem, 1, main.player.stats)
		assert_gt(plans.size(), 0, "槽 %d 应产出计划" % i)
		assert_has(behaviors, plans[0][&"behavior_id"], "槽 %d 行为应注册" % i)


# ---------- 施法主链路（真实消耗/冷却/执行） ----------

## 按键施放槽 0：扣魔 16.8、投射物生成 3 发（1 基础 + 辅助 +2）
func test_s4_cast_slot0_spends_mana_and_spawns_projectiles() -> void:
	main._build_entities()
	main._build_skills()
	var mana_before := main.mana.get_current(&"mana")
	assert_true(main.try_cast(0), "槽 0 应施放成功")
	assert_almost_eq(mana_before - main.mana.get_current(&"mana"), 16.8, 0.0001,
		"应扣魔 10 × 1.4 × 1.2 = 16.8")
	assert_eq(main.projectile_field.active_count(), 3, "1 基础 + 多重投射 +2 应共 3 发")

## 第 8 槽（键 8）可独立施放：M5「8 个技能位全可用」+ M6「8 主动」的字面闭合
func test_s4b_eighth_slot_is_castable() -> void:
	main._build_entities()
	main._build_skills()
	var slot := main.slot_bar.get_slot(7)
	assert_not_null(slot, "槽 7 应存在")
	assert_not_null(slot.active_gem, "槽 7 应绑定主动技能")
	assert_eq(slot.active_gem.gem_id, main.DEMO_SLOT_ORDER[7], "槽 7 应为演示编排的第 8 个技能")
	var before := main.mana.get_current(&"mana")
	assert_true(main.try_cast(7), "槽 7 应可施放（触发器目标槽）")
	assert_almost_eq(before - main.mana.get_current(&"mana"), 12.0, 0.0001, "霜爆新星耗魔 12")

## 冷却未就绪时禁止施放（§8.3：资源/冷却不满足不进入 cast）
func test_s5_cooldown_blocks_recash() -> void:
	main._build_entities()
	main._build_skills()
	assert_true(main.try_cast(1), "首次施放槽 1 应成功")
	assert_false(main.try_cast(1), "冷却未结束再次施放应被拒绝")
	main.tick(2.1)
	assert_true(main.try_cast(1), "tick 过 CD 2s 后应可再施放")

## 蓝量不足时不进入 cast（耗魔不发生、冷却不启动）
func test_s6_insufficient_mana_blocks_cast() -> void:
	main._build_entities()
	main._build_skills()
	main.mana.set_current(&"mana", 5.0)
	assert_false(main.try_cast(1), "蓝不足应拒绝施放")
	assert_almost_eq(main.mana.get_current(&"mana"), 5.0, 0.0001, "蓝量不应被扣")
	assert_true(main.cooldowns[1].is_ready(), "冷却不应启动")

## 充能技能（槽 2 雷光斩，3 充能 1s 回充）逐层扣 + 回充
func test_s7_charge_skill_consumes_and_recharges() -> void:
	main._build_entities()
	main._build_skills()
	var cd = main.cooldowns[2]
	assert_eq(cd.charges, 3, "初始应满 3 充能")
	assert_true(main.try_cast(2), "第 1 次施放")
	assert_true(main.try_cast(2), "第 2 次施放")
	assert_true(main.try_cast(2), "第 3 次施放")
	assert_eq(cd.charges, 0, "充能应耗尽")
	assert_false(main.try_cast(2), "无充能应拒绝")
	main.tick(1.05)
	assert_eq(cd.charges, 1, "1s 后应回充 1 层")
	assert_true(main.try_cast(2), "回充后应可再施放")


# ---------- 命中结算与事件总线 ----------

## 引导技能（槽 3）tick 驱动命中木桩，扣血 + hit_landed 事件
func test_s8_channel_ticks_damage_stump() -> void:
	main._build_entities()
	main._build_skills()
	# _aim_angle() targets the nearest stump: stumps[1] (y=300, dist 400).
	# The beam only hits that stump; stumps[0] is 110px off-axis.
	var stump = main.stumps[1]
	var hp_before: float = stump.health.current_health
	assert_true(main.try_cast(3), "引导应施放成功")
	main.tick(0.6)
	assert_lt(stump.health.current_health, hp_before, "引导 tick 应造成伤害")

## 范围技能（槽 1）延迟爆发命中范围内木桩
func test_s9_aoe_burst_hits_stump_after_delay() -> void:
	main._build_entities()
	main._build_skills()
	var stump = main.stumps[0]
	var hp_before: float = stump.health.current_health
	assert_true(main.try_cast(1), "AOE 应施放成功")
	main.tick(0.2)
	assert_eq(stump.health.current_health, hp_before, "延迟期内不应结算")
	main.tick(0.4)
	assert_lt(stump.health.current_health, hp_before, "0.5s 延迟后应结算伤害")

## 暴击触发器链路：on_crit（linked_slot_index=2）→ 施放槽 2（雷光斩二连）
func test_s10_crit_trigger_fires_linked_slot() -> void:
	main._build_entities()
	main._build_skills()
	# main is not in the tree in tests, so _ready() never ran:
	# wire the trigger manager manually (subscription is idempotent).
	main.trigger_mgr.bus = main.bus
	main.trigger_mgr._ready()
	var fired := [false]
	main.trigger_mgr.trigger_cast_requested.connect(func(_idx: int) -> void:
		fired[0] = true)
	# 构造暴击命中事件
	var packet := DamagePacket.new()
	packet.elements[&"physical"] = 50.0
	main._strike(packet, main.stumps[0])
	# 玩家自带 crit_chance 需保证暴击：直接往事件总线发暴击事件更直接
	main.bus.crit_landed.emit(packet, main.stumps[0])
	main.trigger_mgr.advance(0.1)
	assert_true(fired[0], "暴击事件应触发 trigger_cast_requested")


# ---------- 全元素覆盖 ----------

## 8 技能各元素（cold/fire/lightning/chaos/physical）全部出现在计划中
func test_s11_all_five_elements_covered() -> void:
	main._build_entities()
	main._build_skills()
	var seen := {}
	for i in main.ACTIVE_SLOT_COUNT:
		var plans := SkillExecutor.cast(main.slot_bar.get_slot(i).active_gem, 1, main.player.stats)
		for plan in plans:
			for el in plan.get(&"elements", {}):
				seen[el] = true
	assert_has(seen, &"cold", "应覆盖 cold")
	assert_has(seen, &"fire", "应覆盖 fire")
	assert_has(seen, &"lightning", "应覆盖 lightning")
	assert_has(seen, &"chaos", "应覆盖 chaos")
	assert_has(seen, &"physical", "应覆盖 physical")

## 木桩回满血（R 键逻辑）：respawn 复位血量
func test_s12_stump_respawn_restores_health() -> void:
	main._build_entities()
	main._build_skills()
	var stump = main.stumps[0]
	stump.health.current_health = 0.0
	stump.start_respawn(2.0)
	stump.tick(2.5)
	assert_eq(stump.health.current_health, stump.health.max_health, "重生后应满血")

## 召唤物（槽 6）：每次施法召唤 1 只，max_count 是**上限**（§8.2「到达上限顶掉最旧的」）
## 旧实现把 max_count 当"每次召唤数"，导致"顶掉最旧"永远不会触发，与规格语义不符。
func test_s13_summon_spawn_and_expire() -> void:
	main._build_entities()
	main._build_skills()
	var before := main.get_child_count()

	assert_true(main.try_cast(6), "第一次召唤应成功")
	assert_eq(main.minions.active_count(), 1, "每次施法召唤 1 只")

	# 第 2 次：达到上限
	main.cooldowns[6].configure(0.0, 1.0, 0, 0.0)
	assert_true(main.try_cast(6))
	assert_eq(main.minions.active_count(), 2, "连放 2 次后达到上限 2")
	assert_eq(main.minions.evicted_total, 0, "未超上限时不应顶掉任何一只")

	# 第 3 次：顶掉最旧的，总数不超上限
	main.cooldowns[6].configure(0.0, 1.0, 0, 0.0)
	assert_true(main.try_cast(6))
	assert_eq(main.minions.active_count(), 2, "上限到达后总数不变")
	assert_eq(main.minions.evicted_total, 1, "应顶掉 1 只最旧的")

	main.tick(10.5)
	assert_eq(main.minions.active_count(), 0, "寿命 10s 到期后应全部回收")
	assert_eq(main.get_child_count(), before, "表现层节点也应释放")
