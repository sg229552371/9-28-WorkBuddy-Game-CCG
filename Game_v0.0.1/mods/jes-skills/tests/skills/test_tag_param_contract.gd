# extends test_content_registry.gd（GUT）
# D-42 标签承诺契约：内容级对账测试。
#
# 制作人定案（2026-10-22）：「每个标签必须声明它承诺提供哪些参数，
# 装了该标签但行为不产出这些参数，就是数据错误。」
#
# 四条规则（任何一条红 = 内容数据错误，必须修数据而不是放宽测试）：
#   T0 形态标签在场：每个部件的行为必须能在技能标签里找到对应形态标签
#      （辅助石按标签过滤装配，缺标签 = 辅助永远装不上或乱装）。
#   T1 承诺可满足：技能标签里每个 form 标签承诺的参数键，
#      必须被该技能至少一个部件的行为产出。
#   T2 覆盖有落点：辅助石 behavior_overrides 的每个键，
#      必须落在其 require/add 标签承诺的参数面内。
#   T3 属性有消费者：辅助石 stat_modifiers 改动的倍率型属性
#      （area_size / duration），必须有行为消费，且辅助的标签过滤能命中消费行为。
extends "res://addons/gut/test.gd"


# ---------- 工具 ----------

func _behavior_script(behavior_id: StringName) -> GDScript:
	assert_true(SkillExecutor.BEHAVIORS.has(behavior_id), "未知行为「%s」" % behavior_id)
	return load(SkillExecutor.BEHAVIORS[behavior_id])


## 从行为声明出发构建「倍率型属性 → 消费形态标签集」映射（单一真源 = 行为文件）
func _stat_consumers() -> Dictionary:
	var out := {}
	for bid in SkillExecutor.BEHAVIOR_FORM_TAG:
		var script: GDScript = _behavior_script(bid)
		var form: StringName = SkillExecutor.BEHAVIOR_FORM_TAG[bid]
		for stat in script.consumed_stats():
			if not out.has(stat):
				out[stat] = []
			if not out[stat].has(form):
				out[stat].append(form)
	return out


# ---------- T0：每个部件必须携带行为对应的形态标签 ----------

func test_t0_part_must_carry_behavior_form_tag() -> void:
	var checked := 0
	for s in GemRegistry.skills():
		for part in s.parts:
			var expected: StringName = SkillExecutor.BEHAVIOR_FORM_TAG.get(part.behavior_id, &"")
			if expected == &"":
				continue
			assert_true(s.tags.has(expected),
				"技能「%s」部件行为 %s 缺形态标签「%s」——辅助按标签过滤将失准" % [s.gem_id, part.behavior_id, expected])
			checked += 1
	assert_gt(checked, 0, "至少校验过一个部件（内容集不得为空）")


# ---------- T1：标签承诺的参数必须被至少一个部件产出 ----------

func test_t1_tag_promises_produced_by_some_part() -> void:
	var checked := 0
	for s in GemRegistry.skills():
		# 技能级实现期：承诺参数由「全部部件的产出并集」满足（部件级派生切换后改为逐部件）
		var produced: Array = []
		for part in s.parts:
			for p in _behavior_script(part.behavior_id).produced_params():
				if not produced.has(p):
					produced.append(p)
		for tag in s.tags:
			for promised in TagRegistry.promises_of(tag):
				assert_true(produced.has(promised),
					"技能「%s」标签「%s」承诺参数「%s」但无任何部件产出——数据错误（D-42）" % [s.gem_id, tag, promised])
				checked += 1
	assert_gt(checked, 0, "至少对账过一条承诺")


# ---------- T2：辅助覆盖键必须落在标签承诺面内 ----------

func test_t2_support_overrides_within_tag_promises() -> void:
	var checked := 0
	for g in GemRegistry.supports():
		if g.behavior_overrides.is_empty():
			continue
		var promised := TagRegistry.promises_union(g.require_tags)
		for t in g.add_tags:
			for p in TagRegistry.promises_of(t):
				if not promised.has(p):
					promised.append(p)
		for key in g.behavior_overrides:
			assert_true(promised.has(key),
				"辅助「%s」覆盖参数「%s」不在其标签承诺面内——装上必然静默无效（D-42）" % [g.support_id, key])
			checked += 1
	assert_gt(checked, 0, "至少校验过一个覆盖键")


# ---------- T3：倍率型属性必须有消费者且标签过滤可命中 ----------

func test_t3_stat_supports_must_target_consumers() -> void:
	var consumers := _stat_consumers()
	var checked := 0
	for g in GemRegistry.supports():
		for m in g.stat_modifiers:
			if not consumers.has(m.stat):
				continue  # 非倍率型属性（伤害/暴击等）走伤害管线，全体技能消费
			var filter: Array = []
			for t in g.require_tags:
				filter.append(t)
			for t in g.require_any_tags:
				filter.append(t)
			var hit := false
			for t in filter:
				if consumers[m.stat].has(t):
					hit = true
					break
			assert_true(hit,
				"辅助「%s」改动属性「%s」，但标签过滤 %s 无法命中任何消费形态 %s——装上静默无效（D-42）"
					% [g.support_id, m.stat, filter, consumers[m.stat]])
			checked += 1
	assert_gt(checked, 0, "至少校验过一个属性型辅助")
