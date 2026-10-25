# 内容契约测试（附录 C 第 1 条 / §10 content/）：.tres 是唯一真源。
#
# 这类测试容易被写成"文件存在就行"，但那样挡不住真正的退化：
# 有人为了让某个用例快点过，又在 .gd 里写一个工厂函数，测试照样绿。
# 所以这里断言的是**来源**（resource_path 必须指向磁盘文件），不是内容本身。
extends GutTest

const BEHAVIOR_IDS := [
	&"bhv_projectile", &"bhv_melee_swing", &"bhv_aoe_burst",
	&"bhv_channel", &"bhv_summon", &"bhv_dash", &"bhv_buff_self",
]


func before_all() -> void:
	GemRegistry.reload()


func test_c1_registry_loads_without_errors() -> void:
	assert_eq(GemRegistry.errors, [], "内容目录应无加载错误（缺 id / 重复 id / 类型不符）")


func test_c2_expected_counts() -> void:
	# 8 个主动 = 规格 §11 M6 门禁「W1 内容集 8 主动全部上线」的字面要求
	# 第 9 个 ring_of_cinders = FLY·RING·ZONE 首格（D-31 环判定落地），按 P-23 同步增计数
	# 第 10 个 orbit_blades = 环绕弹道首格（D-36）
	# 第 11~22 个 = 第 2 批 12 技能（D-38 制作人拍板「独立技能」后按规划稿 §9 落盘，P-23 同步增计数）
	# 第 23~30 个 = P1 正选八格（夜间施工批次 B，任务书授权按展开表 v2 §1 落盘，D-44）：
	#   空心冲击波 / 冲撞踩踏 / 原地领域 / 扇形喷火 / 瞬发光束 / 留下火径 / 环形召4 / 召唤墙
	# 第 31~44 个 = 批次 C 第一波（夜间施工批次 C，FLY 投送 14 格，展开表 v2 §1.1 全部 ● 空位，D-45）：
	#   载荷箭 / 留痕火弹 / 延时爆弹 / 毒云弹 / 环爆弹 / 延时环爆弹 / 扇爆弹 / 延时扇爆弹 /
	#   光束弹 / 行进光束弹 / 轨迹爆弹 / 光墙弹 / 星落弹幕 / 多重毒圈弹
	# 第 45~53 个 = 批次 C 第二波（INST 瞬发 9 格，展开表 v2 §1.2 全部 ● 空位，D-45）：
	#   单体瞬击 / 引信印记 / 预警爆圈 / 延迟冲击环 / 三段连斩 / 延迟光轨 / 光墙 / 周身多点爆 / 天降多点
	# 第 54~61 个 = 批次 C 第三波（CHAN 引导 8 格，展开表 v2 §1.3 全部 ● 空位，D-45）：
	#   聚焦光束 / 蓄力单爆 / 原地旋风 / 蓄力大爆 / 引导领域 / 蓄力扇爆 / 蓄力激光 / 持续光束
	# 第 62~67 个 = 批次 C 第四波（DASH 4 格 + SUMN 2 格，展开表 v2 §1.4/§1.6 可表达 ● 空位，D-45）：
	#   冲撞落点爆 / 终点环爆 / 延迟终点环爆 / 路径延迟爆 / 图腾阵 / 沿线雷阵
	assert_eq(GemRegistry.skills().size(), 67,
		"67 个主动技能（61 存量 + 批次 C 第四波 DASH 4 格 + SUMN 2 格，D-45）")
	assert_eq(GemRegistry.supports().size(), 13,
		"13 个辅助石（10 存量 + 批次 D 补缺三颗：持续延长/召唤强化/持久引导，D-45）")
	assert_eq(GemRegistry.triggers().size(), 1, "1 个演示触发器")


func test_c3_every_content_comes_from_disk() -> void:
	# 关键断言：resource_path 非空 ⇒ 这个对象是从 .tres 加载的，
	# 不是代码里 .new() 构造的。这条挡住"悄悄加回工厂函数"的退化。
	for s in GemRegistry.skills():
		assert_false(String(s.resource_path).is_empty(),
			"技能 %s 必须来自 .tres，resource_path 不能为空" % s.gem_id)
	for s in GemRegistry.supports():
		assert_false(String(s.resource_path).is_empty(),
			"辅助 %s 必须来自 .tres，resource_path 不能为空" % s.support_id)
	for t in GemRegistry.triggers():
		assert_false(String(t.resource_path).is_empty(), "触发器必须来自 .tres")


func test_c4_ids_are_unique_and_non_empty() -> void:
	var seen := {}
	for s in GemRegistry.skills():
		assert_ne(String(s.gem_id), "", "技能 id 不能为空")
		assert_false(seen.has(s.gem_id), "技能 id 重复：%s" % s.gem_id)
		seen[s.gem_id] = true

	seen.clear()
	for s in GemRegistry.supports():
		assert_ne(String(s.support_id), "", "辅助 id 不能为空")
		assert_false(seen.has(s.support_id), "辅助 id 重复：%s" % s.support_id)
		seen[s.support_id] = true


func test_c5_every_skill_has_legal_behavior() -> void:
	for s in GemRegistry.skills():
		assert_gt(s.parts.size(), 0, "技能 %s 至少要有一个 part" % s.gem_id)
		for p in s.parts:
			assert_true(BEHAVIOR_IDS.has(p.behavior_id),
				"技能 %s 的 behavior_id「%s」不在 7 个合法行为内" % [s.gem_id, p.behavior_id])


func test_c6_support_triples_are_sane() -> void:
	for s in GemRegistry.supports():
		# require 为空是合法的：表示"对任何技能都生效"（范围扩大就是这种通用辅助）。
		# 真正非法的是 require 与 exclude 命中同一个标签 —— 那样永远装配不上。
		for tag in s.require_tags:
			assert_false(s.exclude_tags.has(tag),
				"辅助 %s 同时 require 与 exclude 了「%s」，永远无法装配" % [s.support_id, tag])
		assert_gt(s.cost_multiplier, 0.0, "辅助 %s 的耗魔倍率必须为正" % s.support_id)


func test_c7_conflicts_are_declared_both_ways() -> void:
	# 寒冷聚焦 ↔ 烈焰专注互斥：只在一侧声明会让"先装谁"决定结果
	var cold: SupportGemData = GemRegistry.support(&"support_cold_focus")
	var fire: SupportGemData = GemRegistry.support(&"support_fire_focus")
	assert_not_null(cold, "应有 support_cold_focus")
	assert_not_null(fire, "应有 support_fire_focus")
	assert_true(cold.conflicts_with.has(&"support_fire_focus"), "寒冷聚焦应声明与烈焰专注互斥")
	assert_true(fire.conflicts_with.has(&"support_cold_focus"),
		"烈焰专注也必须反向声明互斥（否则先装后装结果不同）")


func test_c8_order_is_deterministic() -> void:
	# 连续两次 reload 后顺序必须一致：UI 下拉与测试下标都依赖这一点
	var a: Array = []
	for s in GemRegistry.supports():
		a.append(s.support_id)
	GemRegistry.reload()
	var b: Array = []
	for s in GemRegistry.supports():
		b.append(s.support_id)
	assert_eq(a, b, "reload 后辅助顺序应完全一致")
