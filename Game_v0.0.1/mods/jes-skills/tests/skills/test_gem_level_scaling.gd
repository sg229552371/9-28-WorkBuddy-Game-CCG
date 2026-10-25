# GemLevelScaling 测试（规格 §3.1）：等级曲线。
#
# 两条底线：
#   ① **旧内容零影响** —— `knee_level = 0` 时结果必须与旧实现逐位相等（用 `==`，不是近似）。
#   ② **两段模式可解析验证** —— 单调性、拐点、平台期都用精确值断言，不做采样近似。
extends GutTest

const ScalingScript := preload("res://mods/jes-skills/systems/skills/data/gem_level_scaling.gd")


func _linear(per_level: float) -> GemLevelScaling:
	var s: GemLevelScaling = ScalingScript.new()
	s.per_level = per_level
	return s


func _segmented(early: float, knee: int, late: float) -> GemLevelScaling:
	var s: GemLevelScaling = ScalingScript.new()
	s.per_level = early
	s.knee_level = knee
	s.per_level_late = late
	return s


# ---------- 不分段：Lv1=1.0 / Lv10=1.9 / Lv20=2.9 ----------
func test_linear_baseline() -> void:
	var s := _linear(0.1)
	assert_eq(s.factor_for(1), 1.0, "1 级不缩放")
	assert_almost_eq(s.factor_for(10), 1.9, 0.000001)
	assert_almost_eq(s.factor_for(20), 2.9, 0.000001)


# ---------- 旧内容零影响：与 R10 公式 1 + p*(L-1) 逐位相等 ----------
func test_linear_is_bitwise_identical_to_legacy() -> void:
	for p in [0.0, 0.05, 0.1, 0.137, 0.5]:
		var rate: float = p
		var s := _linear(rate)
		for level in range(1, 31):
			var legacy: float = 1.0 + rate * float(level - 1)
			assert_eq(s.factor_for(level), legacy, "per_level=%s Lv%d 必须逐位一致" % [rate, level])


# ---------- 分段：1..10 用 0.05，之后用 0.2 ----------
func test_segmented_values() -> void:
	var s := _segmented(0.05, 10, 0.2)
	assert_eq(s.factor_for(1), 1.0)
	assert_almost_eq(s.factor_for(10), 1.45, 0.000001, "1 + 0.05×9")
	assert_almost_eq(s.factor_for(11), 1.65, 0.000001, "拐点后 +0.2")
	assert_almost_eq(s.factor_for(20), 3.45, 0.000001, "1.45 + 0.2×10")


# ---------- 拐点语义：第 knee 级本身不含后期项 ----------
func test_knee_level_excludes_late_growth() -> void:
	var s := _segmented(0.05, 10, 0.2)
	assert_almost_eq(s.factor_for(10), 1.0 + 0.05 * 9.0, 0.000001)
	assert_almost_eq(s.factor_for(10) - s.factor_for(9), 0.05, 0.000001, "拐点前一级仍按前期率")
	assert_almost_eq(s.factor_for(11) - s.factor_for(10), 0.2, 0.000001, "拐点后一级按后期率")


# ---------- 后期率为 0 是合法设计（平台期），不能被当成"未设置" ----------
func test_zero_late_rate_is_plateau_not_fallback() -> void:
	var s := _segmented(0.1, 10, 0.0)
	assert_true(s.is_segmented(), "knee_level=10 即为分段模式")
	assert_almost_eq(s.factor_for(10), 1.9, 0.000001)
	assert_almost_eq(s.factor_for(20), 1.9, 0.000001, "10 级后封顶，不得退回线性")


# ---------- 早晚期同率时退化为线性（近似，因为加法结合顺序不同） ----------
func test_equal_rates_degenerates_to_linear() -> void:
	var s := _segmented(0.1, 10, 0.1)
	var plain := _linear(0.1)
	for level in range(1, 21):
		assert_almost_eq(s.factor_for(level), plain.factor_for(level), 0.000001)


# ---------- 单调递增：任何合法参数下 1..20 不得出现下降 ----------
func test_monotonic_across_20_levels() -> void:
	for cfg in [[0.1, 0, 0.0], [0.05, 10, 0.2], [0.2, 5, 0.05], [0.0, 8, 0.15]]:
		var s := _segmented(cfg[0], cfg[1], cfg[2])
		var prev := s.factor_for(1)
		for level in range(2, 21):
			var cur := s.factor_for(level)
			assert_true(cur >= prev, "配置 %s 在 Lv%d 出现下降：%s → %s" % [cfg, level, prev, cur])
			prev = cur


# ---------- 边界：0 级与负数级按 1 级处理，不产生负成长 ----------
func test_non_positive_level_clamps_to_one() -> void:
	var s := _segmented(0.05, 10, 0.2)
	assert_eq(s.factor_for(0), 1.0, "0 级不得倒退")
	assert_eq(s.factor_for(-5), 1.0)


func test_is_segmented_flag() -> void:
	assert_false(_linear(0.1).is_segmented(), "未设拐点即线性模式")
	assert_true(_segmented(0.1, 1, 0.1).is_segmented(), "knee_level=1 也是分段模式")


# ---------- 既有内容零影响（内容层，不只是公式层）----------
# 若将来某颗主动真的要分段，这里会变红——那是**正确**的：
# 改内容就必须同步改断言并写明依据（台账 P-23），不要改成 `>= 1` 糊过去。
## 首批使用两段曲线的技能（D-31）：落烬环走「前期弱、10 级后爆发」成型型曲线。
## 名单制而非放过全部分段内容——新增分段技能必须显式登记，否则本条仍会红。
## 第 2 批 12 技能（D-38 拍板后按规划稿 §9 第 2 步落地）四种曲线：
##   开荒型 16%/8级/+4%：贯空箭；成型型 4%/10级/+20%：熔核引爆/星屑连射/猎杀号令/长明烛火；
##   防御封顶 12%/10级/0：磐石架势/元素壁障/影缝闪避/破阵翻滚；
##   平滑 10% 不分段：裂石重击/裂地余震/战地工事（规划稿遗漏 T3 曲线，按与 T1 同类的平滑落地）。
const SEGMENTED_BY_DESIGN := [
	&"ring_of_cinders",
	&"piercing_bolt", &"core_detonate", &"stardust_volley", &"hunt_call", &"everflame_warden",
	&"stone_stance", &"elemental_ward", &"rift_step", &"breach_roll",
]


func test_existing_content_stays_on_linear_branch() -> void:
	var skills: Array = GemRegistry.skills()
	assert_gt(skills.size(), 0, "内容必须已加载")
	for s in skills:
		var data: SkillData = s
		if data.level_scaling == null:
			continue
		if SEGMENTED_BY_DESIGN.has(data.gem_id):
			assert_true(
				data.level_scaling.is_segmented(),
				"%s 已登记为分段曲线，应为 knee_level>0" % data.gem_id
			)
			continue
		assert_false(
			data.level_scaling.is_segmented(),
			"%s 仍应走线性分支（knee_level=0）" % data.gem_id
		)
