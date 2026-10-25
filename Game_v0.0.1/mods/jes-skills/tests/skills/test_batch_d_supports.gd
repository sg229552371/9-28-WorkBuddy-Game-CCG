# 批次 D 辅助宝石补缺契约测试（夜间施工批次 D，D-45）。
#
# 缺口排查方向（任务书 §3 批次 D）：时长延长（duration stat）、召唤强化（随从三属性）、
# 引导类。环绕（环绕转化）/ 连锁（连锁反应）/ 穿透（穿透之势）已有，不重复。
#
# 断言：
#   D1 三颗新辅助存在且来自磁盘      D2 标签全部注册
#   D3 每颗新辅助至少与一个现役技能兼容（防死数据，S4 lab2 同款）
#   D4 duration 辅助的标签过滤必命中 duration 消费形态（T3 口径的内容级复检）
#   D5 引导辅助覆盖键落在 channel 契约 allow 面内（T2 口径的内容级复检）
#   D6 require 与 exclude 不得同时命中同一标签（C6 同款）
extends GutTest

const NEW_SUPPORT_IDS: Array[StringName] = [
	&"support_duration", &"support_minion", &"support_channel_focus",
]


func before_all() -> void:
	GemRegistry.reload()


# ---------- D1：三颗存在 + 来自磁盘 ----------
func test_d1_new_supports_exist_from_disk() -> void:
	for id in NEW_SUPPORT_IDS:
		var s: SupportGemData = GemRegistry.support(id)
		assert_not_null(s, "辅助「%s」应已注册" % id)
		if s != null:
			assert_false(String(s.resource_path).is_empty(),
				"辅助「%s」必须来自 .tres 磁盘文件" % id)


# ---------- D2：标签全部注册 ----------
func test_d2_all_tags_registered() -> void:
	for id in NEW_SUPPORT_IDS:
		var s: SupportGemData = GemRegistry.support(id)
		if s == null:
			continue
		var unknown := TagRegistry.unknown_in(s.require_tags)
		assert_eq(unknown, [], "辅助「%s」存在未注册标签：%s" % [id, unknown])
		unknown = TagRegistry.unknown_in(s.require_any_tags)
		assert_eq(unknown, [], "辅助「%s」存在未注册标签：%s" % [id, unknown])


# ---------- D3：每颗新辅助至少与一个现役技能兼容（防死数据） ----------
func test_d3_every_new_support_matches_some_skill() -> void:
	var skills: Array = GemRegistry.skills()
	for id in NEW_SUPPORT_IDS:
		var sp: SupportGemData = GemRegistry.support(id)
		if sp == null:
			continue
		var matched := false
		for sk in skills:
			var slot := SkillSlot.new()
			slot.active_gem = sk
			slot.supports.append(sp)
			if SocketGraph.assemble(slot).ok:
				matched = true
				break
		assert_true(matched, "辅助「%s」与任何技能都不兼容（死数据）" % id)


# ---------- D4：持续延长的过滤必须命中 duration 消费形态 ----------
func test_d4_duration_support_hits_consumer_forms() -> void:
	var sp: SupportGemData = GemRegistry.support(&"support_duration")
	assert_not_null(sp)
	if sp == null:
		return
	# 行为真源：哪些形态消费 duration（与 TagRegistry form 标签对齐）
	var consumers: Array = []
	for bid in SkillExecutor.BEHAVIOR_FORM_TAG:
		var script: GDScript = load(SkillExecutor.BEHAVIORS[bid])
		if script.consumed_stats().has(&"duration"):
			consumers.append(String(SkillExecutor.BEHAVIOR_FORM_TAG[bid]))
	var hit := false
	for t in sp.require_tags:
		if consumers.has(String(t)):
			hit = true
	for t in sp.require_any_tags:
		if consumers.has(String(t)):
			hit = true
	assert_true(hit, "持续延长的标签过滤 %s 未命中任何 duration 消费形态 %s" % [sp.require_any_tags, consumers])


# ---------- D5：持久引导的覆盖键落在 channel 契约 allow 面内 ----------
func test_d5_channel_focus_override_in_scope() -> void:
	var sp: SupportGemData = GemRegistry.support(&"support_channel_focus")
	assert_not_null(sp)
	if sp == null:
		return
	assert_true(sp.behavior_overrides.has(&"max_channel_time"),
		"持久引导应覆盖 max_channel_time（引导时长）")
	var bad := TagContract.support_violations(sp.require_tags, sp.behavior_overrides.keys())
	assert_eq(bad, [], "持久引导覆盖键越出 channel 契约 allow 面：%s" % str(bad))


# ---------- D6：require 与 exclude 不得同时命中同一标签 ----------
func test_d6_no_require_exclude_overlap() -> void:
	for id in NEW_SUPPORT_IDS:
		var s: SupportGemData = GemRegistry.support(id)
		if s == null:
			continue
		for tag in s.require_tags:
			assert_false(s.exclude_tags.has(tag),
				"辅助「%s」同时 require 与 exclude 了「%s」，永远无法装配" % [id, tag])
