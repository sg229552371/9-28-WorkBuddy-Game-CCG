# M4 门禁 G8（规格 §12 / §11 M4）：统计口径用例。
#
# 为什么单独一个文件：h1_* 系列只验证"这一枪暴没暴"，是确定性单测；
# G8 验证的是"一千枪打下来，期望对不对"，属于分布性质。
# 两者都不能替代对方 —— 没有 G8，M4 门禁严格来说没闭合。
#
# 手算基准（规格 §12 G8）：
#   base 100，crit 30%，crit_multi 150%
#   期望 = 100 × (1 - 0.3) + 100 × 1.5 × 0.3 = 70 + 45 = 115
#
# 全部用 RngService 固定 seed：同 seed ⇒ 同一串 roll ⇒ 断言值确定，不存在 flake。
# 样本量的选择：
#   - 均值与暴击率用规格写死的 1000 次（±3 是 4σ 以上，稳）
#   - DPS 要求误差 ≤ 0.5%，1000 次的相对标准误约 0.72%，不够；
#     取 20000 次后相对标准误 0.16%，3σ ≈ 0.48% < 0.5%，才敢断言
extends GutTest

const StatsScript := preload("res://mods/jes-skills/systems/skills/stats_component.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")
const DamagePacketScript := preload("res://mods/jes-skills/systems/skills/combat/damage_packet.gd")
const DamageCalculatorScript := preload("res://mods/jes-skills/systems/skills/combat/damage_calculator.gd")

const SEED := 20261019
const BASE := 100.0
const CRIT_CHANCE := 30.0
const CRIT_MULTI := 1.5
const EXPECTED := BASE * (1.0 - CRIT_CHANCE / 100.0) + BASE * CRIT_MULTI * (CRIT_CHANCE / 100.0)
const CASTS_PER_SECOND := 2.0          # 端到端 DPS 口径：每秒 2 次施法，每次 1 发


# ---------------- 工具 ----------------

## 攻击方：只给暴击率，暴击倍率留基础值 1.5
func _attacker(crit_pct: float = CRIT_CHANCE) -> StatsComponent:
	var s: StatsComponent = StatsScript.new()
	if crit_pct > 0.0:
		s.add_modifier(_mod(&"crit_chance", StatModifierScript.Op.FLAT_ADD, crit_pct))
	return s


func _mod(stat: StringName, op: int, value: float) -> StatModifier:
	var m: StatModifier = StatModifierScript.new()
	m.stat = stat
	m.op = op
	m.value = value
	return m


## 裸木桩：无护甲无抗性，保证 100 物理全吃（不从默认值"清零"，而是本来就没有词缀）
func _naked_defender() -> NakedDefender:
	return NakedDefender.new()


func _packet_100() -> DamagePacket:
	var p: DamagePacket = DamagePacketScript.new()
	p.elements[&"physical"] = BASE
	return p


## 跑 n 次命中，返回 {total, crits, rolls:Array}
func _sample(stats: StatsComponent, defender, rng: RngService, n: int) -> Dictionary:
	var calc := DamageCalculatorScript.new()
	var total := 0.0
	var crits := 0
	var rolls: Array = []
	for i in n:
		var hit: Dictionary = calc.resolve(_packet_100(), stats, defender, rng)
		var t: float = float(hit[&"total"])
		total += t
		rolls.append(t)
		if bool(hit[&"crit"]):
			crits += 1
	return {&"total": total, &"crits": crits, &"rolls": rolls, &"n": n}


class NakedDefender extends RefCounted:
	var stats: StatsComponent

	func _init() -> void:
		stats = StatsComponent.new()


# ---------------- G8：暴击期望 ----------------

func test_g8a_mean_of_1000_samples_is_115() -> void:
	var rng := RngService.new(SEED)
	var r := _sample(_attacker(), _naked_defender(), rng, 1000)
	var mean: float = float(r[&"total"]) / float(r[&"n"])
	# 规格 §12 G8：均值 ≈ 115 ± 3
	assert_almost_eq(mean, EXPECTED, 3.0,
		"1000 次采样均值应落在 115±3（手算 %.1f）" % EXPECTED)
	assert_almost_eq(EXPECTED, 115.0, 0.0001, "手算基准自检：期望必须是 115")


func test_g8a_crit_rate_matches_declared_chance() -> void:
	var rng := RngService.new(SEED)
	var r := _sample(_attacker(), _naked_defender(), rng, 1000)
	var rate: float = float(r[&"crits"]) / 1000.0
	# 1000 次、p=0.3 时 σ=1.45%；±4.5% 是 3σ 以上，固定 seed 下确定成立
	assert_almost_eq(rate, 0.30, 0.045, "实测暴击率应贴近声明的 30%")


func test_g8a_same_seed_reproduces_same_samples() -> void:
	# 可回放是 §9.4 的核心承诺：换一个 RngService 实例、同 seed，必须逐位相同
	var a := _sample(_attacker(), _naked_defender(), RngService.new(SEED), 200)
	var b := _sample(_attacker(), _naked_defender(), RngService.new(SEED), 200)
	assert_eq(a[&"rolls"], b[&"rolls"], "同 seed 的 200 次采样应逐个相等")
	assert_eq(a[&"crits"], b[&"crits"], "同 seed 的暴击次数应相等")


func test_g8a_zero_crit_chance_never_deviates() -> void:
	# 反向对照：暴击率 0 时 1000 枪总伤害必须恰好 100000，一分不多
	var rng := RngService.new(SEED)
	var r := _sample(_attacker(0.0), _naked_defender(), rng, 1000)
	assert_eq(float(r[&"total"]), BASE * 1000.0, "无暴击时总伤害应精确等于 base×次数")
	assert_eq(int(r[&"crits"]), 0, "暴击率 0 不应出现暴击")


# ---------------- 端到端 DPS：与手算差 ≤ 0.5% ----------------

func test_g8b_pipeline_dps_matches_hand_calc() -> void:
	# 20000 次命中 = 10000 秒（每秒 2 次施法）
	var n := 20000
	var rng := RngService.new(SEED)
	var r := _sample(_attacker(), _naked_defender(), rng, n)
	var seconds: float = float(n) / CASTS_PER_SECOND
	var dps: float = float(r[&"total"]) / seconds
	var expected_dps: float = EXPECTED * CASTS_PER_SECOND
	var err: float = absf(dps - expected_dps) / expected_dps
	assert_lt(err, 0.005,
		"端到端 DPS %.3f 与手算 %.3f 的相对误差 %.3f%% 应 ≤ 0.5%%" % [dps, expected_dps, err * 100.0])


# ---------------- 分流域：改表现层不得改战斗结果 ----------------

func test_g8c_cosmetic_stream_does_not_shift_damage_sequence() -> void:
	# §9.4 的落地保证：表现层狂吃 cosmetic 流，damage 流第 n 个值必须纹丝不动
	var quiet := RngService.new(SEED)
	var first_quiet := quiet.next_float(RngService.STREAM_DAMAGE)

	var noisy := RngService.new(SEED)
	for i in 5000:
		noisy.next_float(RngService.STREAM_COSMETIC)   # 模拟 5000 次粒子随机
	var first_noisy := noisy.next_float(RngService.STREAM_DAMAGE)

	assert_eq(first_noisy, first_quiet,
		"cosmetic 消耗 5000 次后，damage 流首个值应完全相同")
	assert_eq(noisy.cursor_of(RngService.STREAM_COSMETIC), 5000, "cosmetic 游标应推进 5000")
	assert_eq(noisy.cursor_of(RngService.STREAM_DAMAGE), 1, "damage 游标只应推进 1")


func test_g8c_reset_cursors_replays_from_scratch() -> void:
	var rng := RngService.new(SEED)
	var seq_a: Array = []
	for i in 10:
		seq_a.append(rng.next_float(RngService.STREAM_DAMAGE))
	rng.reset_cursors()
	var seq_b: Array = []
	for i in 10:
		seq_b.append(rng.next_float(RngService.STREAM_DAMAGE))
	assert_eq(seq_b, seq_a, "reset_cursors 后应从头重演同一序列")
