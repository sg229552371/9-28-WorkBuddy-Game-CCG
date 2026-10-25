# M4 测试：伤害与命中管线（规格 §10 / §13 M4，验收：数值与 §10 一致，暴击/抗性可测）
# H1 元素伤害计算（暴击⑥）/ H2 抗性减免（⑦）/ H3 护甲减伤（⑦）/ H4 击杀事件
# 硬约束（规格 §14）：
#   - 伤害计算全部纯函数、无演出逻辑
#   - RNG 通过参数注入（统一 RNG 服务，便于测试与回放）
#   - 数值全部为规格示例手算基准
extends GutTest

const DamagePacketScript := preload("res://mods/jes-skills/systems/skills/combat/damage_packet.gd")
const DamageCalculatorScript := preload("res://mods/jes-skills/systems/skills/combat/damage_calculator.gd")
const HealthScript := preload("res://mods/jes-skills/systems/skills/combat/health_component.gd")
const StatsScript := preload("res://mods/jes-skills/systems/skills/stats_component.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")


func _mod(stat: StringName, op: int, value: float) -> StatModifier:
	var m: StatModifier = StatModifierScript.new()
	m.stat = stat
	m.op = op
	m.value = value
	return m


func _packet(elements: Dictionary) -> DamagePacket:
	var p: DamagePacket = DamagePacketScript.new()
	for el in elements:
		p.elements[el] = float(elements[el])
	return p


func _fake_rng(v: float) -> _FakeRng:
	var f := _FakeRng.new()
	f.fixed_value = v
	return f


# ---------- H1：暴击判定（⑥）----------
# crit_chance=25%，roll 0.1 < 0.25 → 暴击，×crit_multi
func test_h1_crit_roll_applies_crit_multi() -> void:
	var stats: StatsComponent = StatsScript.new()
	stats.add_modifier(_mod(&"crit_chance", StatModifierScript.Op.FLAT_ADD, 25.0))
	stats.add_modifier(_mod(&"crit_multi", StatModifierScript.Op.FLAT_ADD, 50.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), stats, _defender(), _fake_rng(0.1))
	assert_true(hit[&"crit"], "roll 0.1 < 0.25 应暴击")
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 150.0, 0.001,
		"100 × crit_multi(1.5+0.5=... → base 1.5 + 0.5 = 2.0 × ...)")


# roll 0.5 ≥ 0.25 → 不暴击
func test_h1_no_crit_when_roll_above_chance() -> void:
	var stats: StatsComponent = StatsScript.new()
	stats.add_modifier(_mod(&"crit_chance", StatModifierScript.Op.FLAT_ADD, 25.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), stats, _defender(), _fake_rng(0.5))
	assert_false(hit[&"crit"], "roll 0.5 >= 0.25 不暴击")
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 100.0, 0.001, "无暴击伤害不变")


func test_h1_zero_crit_chance_never_crits() -> void:
	var calc := DamageCalculatorScript.new()
	# 即使 roll=0，0% 暴击率也不应暴击
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), StatsScript.new(),
		_defender(), _fake_rng(0.0))
	assert_false(hit[&"crit"], "0% 暴击率永不暴击")


# crit_multi 走 INCREASED 管线：base 1.5 × (1+20%) = 1.8
func test_h1_crit_multi_increased_stat() -> void:
	var stats: StatsComponent = StatsScript.new()
	stats.add_modifier(_mod(&"crit_chance", StatModifierScript.Op.FLAT_ADD, 100.0))
	stats.add_modifier(_mod(&"crit_multi", StatModifierScript.Op.INCREASED, 20.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), stats, _defender(), _fake_rng(0.0))
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 180.0, 0.001,
		"crit_multi = base 1.5 × (1+20%) = 1.8")


# ---------- H2：元素抗性减免（⑦ 目标侧）----------
func test_h2_resistance_reduces_elemental() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"cold_resistance", StatModifierScript.Op.FLAT_ADD, 30.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 70.0, 0.001, "100 × (1-30%) = 70")


func test_h2_physical_ignores_resistance() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"cold_resistance", StatModifierScript.Op.FLAT_ADD, 30.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"physical": 100.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 100.0, 0.001, "物理不受元素抗性影响")


func test_h2_chaos_uses_chaos_resistance() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"chaos_resistance", StatModifierScript.Op.FLAT_ADD, 75.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"chaos": 100.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"chaos"]), 25.0, 0.001, "chaos 100 × (1-75%) = 25")


# 抗性上限 75%：即使堆到 90% 也只减免 75%
func test_h2_resistance_capped_at_75() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"cold_resistance", StatModifierScript.Op.FLAT_ADD, 90.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"cold": 100.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 25.0, 0.001, "90% 抗性被 cap 到 75% → 100×0.25")


# ---------- H3：护甲减伤（⑦ 物理侧）----------
# 护甲公式：减免 = armor / (armor + 10 × damage_before)
func test_h3_armor_formula_matches_spec() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"armor", StatModifierScript.Op.FLAT_ADD, 600.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"physical": 200.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	# 200 物理：600 / (600 + 10×200) = 0.230769... → 200 × 0.769230... = 153.846
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 153.846, 0.01, "护甲公式 600/(600+2000)")
	assert_almost_eq(float(hit[&"total"]), 153.846, 0.01, "total = 各元素之和")


func test_h3_zero_armor_no_reduction() -> void:
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"physical": 200.0}), StatsScript.new(),
		_defender(), _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 200.0, 0.001, "0 护甲无减免")


# ---------- 混合：暴击(⑥)在目标侧减免(⑦)之前 ----------
# 100 physical ×1.5 = 150 → 护甲 600/(600+10×150) = 0.28571 → 150×0.71428 = 107.14
func test_h3_crit_before_defense() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"armor", StatModifierScript.Op.FLAT_ADD, 600.0))
	var stats: StatsComponent = StatsScript.new()
	stats.add_modifier(_mod(&"crit_chance", StatModifierScript.Op.FLAT_ADD, 100.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(_packet({&"physical": 100.0}), stats, defender, _fake_rng(0.0))
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 107.14, 0.01, "暴击在减免之前")
	assert_almost_eq(float(hit[&"total"]), 107.14, 0.01)


# 混合元素各自走各的减免通道，total = Σ
# physical 100（0 护甲不变）+ cold 100（30% 抗 → 70）= 170
func test_h3_mixed_elements_sum_to_total() -> void:
	var defender: DefenderStub = _defender()
	defender.stats.add_modifier(_mod(&"cold_resistance", StatModifierScript.Op.FLAT_ADD, 30.0))
	var calc := DamageCalculatorScript.new()
	var hit: Dictionary = calc.resolve(
		_packet({&"physical": 100.0, &"cold": 100.0}), StatsScript.new(),
		defender, _fake_rng(0.9))
	assert_almost_eq(float(hit[&"elements"][&"physical"]), 100.0, 0.001)
	assert_almost_eq(float(hit[&"elements"][&"cold"]), 70.0, 0.001)
	assert_almost_eq(float(hit[&"total"]), 170.0, 0.001, "total = 100 + 70")


# ---------- H4：HealthComponent + 击杀事件 ----------
func test_h4_health_damage_and_death() -> void:
	var hp: HealthComponent = HealthScript.new()
	hp.max_health = 100.0
	hp.current_health = 100.0
	watch_signals(hp)
	hp.apply_damage(30.0)
	assert_eq(hp.current_health, 70.0, "扣血 30")
	assert_false(hp.is_dead(), "70/100 未死亡")
	hp.apply_damage(50.0)
	assert_eq(hp.current_health, 20.0, "再扣 50 剩 20")
	assert_signal_emit_count(hp, &"damaged", 2)
	assert_signal_not_emitted(hp, &"died")
	hp.apply_damage(50.0)  # 20-50 → 钳到 0 → 死亡
	assert_eq(hp.current_health, 0.0, "血量钳制到 0")
	assert_true(hp.is_dead(), "血量归零即死亡")
	assert_signal_emit_count(hp, &"damaged", 3)
	assert_signal_emitted(hp, &"died", "血量归零必须发 died 信号（击杀事件）")


func test_h4_overkill_damage_clamps() -> void:
	var hp: HealthComponent = HealthScript.new()
	hp.max_health = 50.0
	hp.current_health = 50.0
	watch_signals(hp)
	hp.apply_damage(999.0)
	assert_eq(hp.current_health, 0.0, "过量伤害钳到 0，负血不允许")
	assert_true(hp.is_dead())
	assert_signal_emitted(hp, &"died")


func test_h4_damage_zero_no_death() -> void:
	var hp: HealthComponent = HealthScript.new()
	hp.max_health = 10.0
	hp.current_health = 10.0
	watch_signals(hp)
	hp.apply_damage(0.0)
	assert_eq(hp.current_health, 10.0, "0 伤害无变化")
	assert_false(hp.is_dead())
	assert_signal_not_emitted(hp, &"died")


# 已死亡后不再重复发 died
func test_h4_dead_no_repeat_died() -> void:
	var hp: HealthComponent = HealthScript.new()
	hp.max_health = 10.0
	hp.current_health = 10.0
	watch_signals(hp)
	hp.apply_damage(10.0)
	assert_signal_emit_count(hp, &"died", 1)
	hp.apply_damage(5.0)
	assert_signal_emit_count(hp, &"died", 1, "尸体不再触发 died")


# ---------- 辅助构造 ----------
func _defender() -> DefenderStub:
	var d := DefenderStub.new()
	d.stats = StatsScript.new()
	return d


class _FakeRng:
	extends RefCounted
	var fixed_value: float = 0.0
	# RNG 契约（§9.4）：DamageCalculator 只认 next_float(stream)，
	# 假体固定返回同一个值，用于强制"必暴 / 必不暴"两种分支。
	func next_float(_stream: StringName) -> float:
		return fixed_value


class DefenderStub:
	extends RefCounted
	var stats: StatsComponent
