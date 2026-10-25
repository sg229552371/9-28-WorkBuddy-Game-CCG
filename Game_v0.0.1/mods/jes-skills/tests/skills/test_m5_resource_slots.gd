# M5 测试：资源/冷却/充能/多技能栏（规格 §8.3 / §5.3 / §11 M5）
# 验收：资源不足无法施法；8 个技能位全可用；数值可手算。
# 硬约束（规格 §14 / §8.3）：
#   - 资源不足时 can_cast() 返回 false，且不得进入 cast（禁止扣成负数再回滚）
#   - 可用资源 = max_stat − Σ(reserved)
#   - cost = base_cost × Π(cost_multiplier) × skill_cost_multiplier
#   - 冷却 = base_cooldown / cooldown_recovery
#   - 充能型 = max_charges > 0 时改为每 charge_recharge_time 秒回复 1 层
#   - 无 gem_id 分支；时间推进由测试手动 advance(dt)（不用 Timer 节点）
extends GutTest

const ResourcePoolScript := preload("res://mods/jes-skills/systems/skills/resource_pool.gd")
const CostCalculatorScript := preload("res://mods/jes-skills/systems/skills/cost_calculator.gd")
const CooldownScript := preload("res://mods/jes-skills/systems/skills/cooldown_component.gd")
const SlotBarScript := preload("res://mods/jes-skills/systems/skills/skill_slot_bar.gd")
const SlotScript := preload("res://mods/jes-skills/systems/skills/data/skill_slot.gd")
const SkillDataScript := preload("res://mods/jes-skills/systems/skills/data/skill_data.gd")


func _skill(cost_type: int, base_cost: float, cd: float = 0.0,
		charges: int = 0, recharge: float = 0.0) -> SkillData:
	var s: SkillData = SkillDataScript.new()
	s.gem_id = &"test_gem"
	s.cost_type = cost_type
	s.base_cost = base_cost
	s.base_cooldown = cd
	s.max_charges = charges
	s.charge_recharge_time = recharge
	return s


# ---------- R1：消耗计算（cost = base × Π(support mult) × skill mult）----------
# G5 数值：多重投射 1.5 × 连锁 1.3 → 10 × 1.5 × 1.3 = 19.5
func test_r1_cost_formula_matches_g5() -> void:
	var skill := _skill(0, 10.0)  # MANA
	var pool: ResourcePool = ResourcePoolScript.new()
	pool.set_max(&"mana", 100.0)
	var cost: float = CostCalculatorScript.compute_cost(skill, 1.5 * 1.3, 1.0)
	assert_almost_eq(cost, 19.5, 0.0001, "10 × 1.5 × 1.3 = 19.5")
	assert_true(pool.can_afford(&"mana", cost), "100 蓝够付 19.5")


func test_r1_skill_cost_multiplier_applies() -> void:
	var skill := _skill(0, 10.0)
	var cost: float = CostCalculatorScript.compute_cost(skill, 1.0, 1.2)
	assert_almost_eq(cost, 12.0, 0.0001, "10 × 1.0 × 1.2 = 12")


# ---------- R2：资源不足 → can_cast false，不得扣成负数 ----------
func test_r2_insufficient_resource_blocks() -> void:
	var pool: ResourcePool = ResourcePoolScript.new()
	pool.set_max(&"mana", 10.0)
	pool.set_current(&"mana", 10.0)
	assert_false(pool.can_afford(&"mana", 19.5), "10 蓝付不起 19.5")
	var spent: bool = pool.spend(&"mana", 19.5)
	assert_false(spent, "spend 失败")
	assert_eq(pool.get_current(&"mana"), 10.0, "失败不扣资源（禁止负数回滚）")


func test_r2_spend_success_deducts() -> void:
	var pool: ResourcePool = ResourcePoolScript.new()
	pool.set_max(&"mana", 100.0)
	pool.set_current(&"mana", 100.0)
	assert_true(pool.spend(&"mana", 19.5))
	assert_almost_eq(pool.get_current(&"mana"), 80.5, 0.0001, "100 − 19.5 = 80.5")


# ---------- R3：保留资源（可用 = max − Σ reserved）----------
func test_r3_reserved_reduces_available() -> void:
	var pool: ResourcePool = ResourcePoolScript.new()
	pool.set_max(&"mana", 100.0)
	pool.set_current(&"mana", 100.0)
	pool.reserve(&"mana", 60.0, &"aura:test")
	assert_almost_eq(pool.available(&"mana"), 40.0, 0.0001, "可用 = 100 − 60")
	assert_false(pool.can_afford(&"mana", 50.0), "可用 40 < 50 → 不可施放")
	assert_true(pool.can_afford(&"mana", 40.0), "恰好 40 可付")


func test_r3_unreserve_restores() -> void:
	var pool: ResourcePool = ResourcePoolScript.new()
	pool.set_max(&"mana", 100.0)
	pool.set_current(&"mana", 100.0)
	pool.reserve(&"mana", 60.0, &"aura:test")
	pool.unreserve(&"mana", &"aura:test")
	assert_almost_eq(pool.available(&"mana"), 100.0, 0.0001, "按 source_id 卸载保留后恢复")


# ---------- R4：NONE 消耗类型 ----------
func test_r4_none_cost_always_castable() -> void:
	var skill := _skill(3, 10.0)  # NONE
	var cost: float = CostCalculatorScript.compute_cost(skill, 1.0, 1.0)
	assert_almost_eq(cost, 0.0, 0.0001, "NONE → cost 0")


# ---------- C1：冷却（duration = base / cooldown_recovery）----------
func test_c1_cooldown_duration_divided_by_recovery() -> void:
	var cd: CooldownComponent = CooldownScript.new()
	cd.configure(2.0, 2.0, 0, 0.0)  # base 2s / recovery 2.0 → 1s
	assert_true(cd.is_ready(), "初始就绪")
	cd.start()
	assert_false(cd.is_ready(), "进入冷却")
	advance_cooldowns([cd], 0.5)
	assert_false(cd.is_ready(), "0.5s < 1s 未好")
	advance_cooldowns([cd], 0.5)
	assert_true(cd.is_ready(), "1s 后冷却结束")


func test_c1_cooldown_finished_signal_once() -> void:
	var cd: CooldownComponent = CooldownScript.new()
	cd.configure(1.0, 1.0, 0, 0.0)
	watch_signals(cd)
	cd.start()
	advance_cooldowns([cd], 2.0)
	assert_signal_emit_count(cd, &"cooldown_finished", 1, "结束信号只发一次")


# ---------- C2：充能型（max_charges > 0）----------
func test_c2_charges_consume_and_recharge() -> void:
	var cd: CooldownComponent = CooldownScript.new()
	cd.configure(0.0, 1.0, 3, 2.0)  # 3 层充能，每 2s 回 1 层
	assert_eq(cd.charges, 3, "初始满层")
	cd.start()
	cd.start()
	assert_eq(cd.charges, 1, "用掉 2 层")
	assert_true(cd.is_ready(), "还剩 1 层可用")
	cd.start()
	assert_eq(cd.charges, 0)
	assert_false(cd.is_ready(), "0 层不可用")
	advance_cooldowns([cd], 2.0)
	assert_eq(cd.charges, 1, "2s 回 1 层")
	assert_true(cd.is_ready())
	advance_cooldowns([cd], 4.0)
	assert_eq(cd.charges, 3, "继续回满，上限 3")


func test_c2_charges_cap_at_max() -> void:
	var cd: CooldownComponent = CooldownScript.new()
	cd.configure(0.0, 1.0, 2, 1.0)
	advance_cooldowns([cd], 10.0)
	assert_eq(cd.charges, 2, "长时间不充爆，钳制在 max_charges")


# ---------- S1：SkillSlotBar（技能位全可用）----------
func test_s1_bar_has_eight_slots() -> void:
	# 9 = 原 8 键 + 槽 8「落烬环」（FLY·RING·ZONE 首格，D-31）；
	# 与沙盒 ACTIVE_SLOT_COUNT 同步，按 P-23 改断言并写明依据
	var bar: SkillSlotBar = SlotBarScript.new()
	assert_eq(bar.slot_count, 9, "技能栏 1~9 键（8 W1 槽 + 落烬环槽）")


func test_s1_bind_and_get_all_slots() -> void:
	var bar: SkillSlotBar = SlotBarScript.new()
	for i in 8:
		var slot: SkillSlot = SlotScript.new()
		slot.slot_index = i
		var gem: SkillData = _skill(0, 1.0)
		slot.active_gem = gem
		bar.bind_slot(i, slot)
	for i in 8:
		var slot: SkillSlot = bar.get_slot(i)
		assert_ne(slot, null, "技能位 %d 全可用" % (i + 1))
		assert_eq(slot.active_gem.gem_id, &"test_gem")


func test_s1_out_of_range_returns_null() -> void:
	# 越界基准从 8 改为 MAX_SLOTS（D-31 扩到 9 后，原来的 8 已是合法槽 8）
	var bar: SkillSlotBar = SlotBarScript.new()
	assert_eq(bar.get_slot(SkillSlotBar.MAX_SLOTS), null, "越界返回 null")
	assert_eq(bar.get_slot(-1), null, "负索引返回 null")
	assert_eq(bar.bind_slot(SkillSlotBar.MAX_SLOTS, null), false, "越界绑定失败")


# ---------- 辅助：手动推进时间（不用 Timer 节点）----------
func advance_cooldowns(list: Array, dt: float) -> void:
	for c in list:
		c.advance(dt)
