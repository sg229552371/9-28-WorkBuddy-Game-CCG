# 标签—参数对齐契约测试（D-25 后续）：把 TagContract 的两条合同落到 CI。
#   技能侧：声明了 form 标签的技能，parts 参数必须真的产出契约键之一
#           ——否则该标签的辅助「装得上、没效果」（静默失效族，同 P-06 教训）。
#   辅助侧：require 了 form 标签的辅助，behavior_overrides 只许覆盖契约 allow 键
#           ——越界键等于把数值写进没人读的参数（虚胖）。
#   契约侧：契约键必须是 00_总纲 §4 的 ✅ 已实现键；◇ 规划键混入即红。
# 约定：本测试只拦内容与契约，不拦运行时（方案③：仅测试门禁）。
extends GutTest

## §4 v1.2 的 ✅ 已实现键全集（含别名存储键）。契约键 ⊆ 此集合。
const IMPLEMENTED_KEYS := [
	&"speed", &"lifetime", &"pierce", &"count_base", &"spread_deg",
	&"fork_count", &"chain_count", &"motion", &"orbit_radius",
	&"distance",
	&"max_channel_time", &"tick_interval",
	&"max_count",
	&"radius", &"arc_deg", &"range",
	&"hit_count", &"hit_interval", &"delay",
	&"buff_mods",
]


# ---------------- 契约自检 ----------------

func test_c1_contract_tags_are_registered() -> void:
	# 契约里的标签必须先在 TagRegistry 注册，否则 unknown_in 会拦内容但拦不住契约自身
	for tag in TagContract.CONTRACT:
		assert_true(TagRegistry.has_tag(tag),
				"契约标签 %s 未在 TagRegistry 注册" % tag)


func test_c2_contract_keys_are_implemented() -> void:
	# 契约只许引用 §4 的 ✅ 键；把 ◇ 规划键（如 zone_duration / point_count）抄进来必须当场红
	for tag in TagContract.CONTRACT:
		var entry: Dictionary = TagContract.CONTRACT[tag]
		for p in entry[&"produce"]:
			assert_true(IMPLEMENTED_KEYS.has(p),
					"%s.produce 键 %s 不是 §4 已实现键" % [tag, p])
		for p in entry[&"allow"]:
			assert_true(IMPLEMENTED_KEYS.has(p),
					"%s.allow 键 %s 不是 §4 已实现键" % [tag, p])


func test_c3_alias_points_to_implemented_key() -> void:
	for alias in TagContract.ALIAS:
		var target: StringName = TagContract.ALIAS[alias]
		assert_true(IMPLEMENTED_KEYS.has(target),
				"别名 %s 指向未实现键 %s" % [alias, target])


# ---------------- 技能侧：声明标签必须产出参数 ----------------

func test_c4_every_skill_form_tag_produces_contract_params() -> void:
	for skill in GemRegistry.skills():
		var all_param_keys: Array = []
		for part in skill.parts:
			for k in part.behavior_params:
				all_param_keys.append(k)
		var contracted := TagContract.contracted_tags(skill.tags)
		var bad := TagContract.skill_violations(contracted, all_param_keys)
		assert_eq(bad, [], "技能 %s：标签 %s 未产出任何契约参数（装对应辅助会没效果）"
				% [skill.gem_id, str(bad)])


# ---------------- 辅助侧：overrides 不得越出 allow 范围 ----------------

func test_c5_every_support_override_is_in_scope() -> void:
	for sup in GemRegistry.supports():
		if sup.behavior_overrides.is_empty():
			continue
		var keys: Array = []
		for k in sup.behavior_overrides:
			keys.append(k)
		var bad := TagContract.support_violations(sup.require_tags, keys)
		assert_eq(bad, [], "辅助 %s：overrides 键 %s 超出其 require 标签的 allow 范围"
				% [sup.support_id, str(bad)])


# ---------------- 机制自证（各一条正反例，防契约函数本身静默失效） ----------------

func test_c6_skill_side_catches_missing_produce() -> void:
	# 反例：声明 projectile 但参数里只有 radius（弹体半径不算产出键）→ 必须报 projectile
	var bad := TagContract.skill_violations([&"projectile"], [&"radius"])
	assert_eq(bad, [&"projectile"], "缺产出键时必须报出标签")


func test_c7_skill_side_passes_real_projectile() -> void:
	# 正例：霜矛形态参数（count_base/speed/lifetime）→ 通过
	var ok := TagContract.skill_violations(
			[&"projectile"], [&"count_base", &"speed", &"lifetime", &"radius"])
	assert_eq(ok, [], "产出任一契约键即通过")


func test_c8_support_side_catches_out_of_scope_override() -> void:
	# 反例：require projectile 却改 arc_deg → 越界必须被抓
	var bad := TagContract.support_violations([&"projectile"], [&"arc_deg"])
	assert_eq(bad, [&"arc_deg"], "越界键必须报出")


func test_c9_support_side_canonicalizes_alias() -> void:
	# 正例：多重投射写对外别名 projectile_count，归一后落在 allow（count_base）内
	var bad := TagContract.support_violations(
			[&"projectile"], [&"projectile_count"])
	assert_eq(bad, [], "别名应归一到 count_base 后放行")


func test_c10_support_without_form_tag_is_unrestricted() -> void:
	# 元素类辅助（如 cold_focus）require 里没有 form 标签 → 不设参数约束
	var bad := TagContract.support_violations([&"cold"], [&"anything"])
	assert_eq(bad, [], "无 form 标签的辅助不受参数契约限制")
