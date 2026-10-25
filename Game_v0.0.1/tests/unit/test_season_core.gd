## 对译 season_test.js / season_loop_test.js：逐级经验与封顶。
extends GutTest

const SeasonModeScript = preload("res://mods/jes-season/scripts/season_mode.gd")


func test_exp_curve_and_cap() -> void:
	var mode = SeasonModeScript.new()
	assert_eq(mode.season_lv, 1, "初始赛季等级为一级")
	assert_true(mode.add_exp(1000), "一千经验应被接受")
	assert_eq(mode.season_lv, 2, "一千经验恰好升二级")
	assert_eq(mode.season_exp, 0.0, "升级扣除当前等级经验")
	mode.add_exp(1199)
	assert_eq(mode.season_lv, 2, "差一点经验不能升级")
	mode.add_exp(1)
	assert_eq(mode.season_lv, 3, "补一点后升级")
	mode.add_exp(99999)
	assert_eq(mode.season_lv, 10, "大额经验逐级结算直至封顶")
	assert_eq(mode.season_exp, 0.0, "封顶清除多余经验")
	assert_false(mode.add_exp(5000), "封顶后不再累计经验")
	assert_false(mode.add_exp(-50), "负数经验应拒绝")
	assert_false(mode.add_exp("abc"), "非数字经验应拒绝")


func test_weeklies_events_and_reset() -> void:
	var mode = SeasonModeScript.new()
	assert_eq(mode.weeklies().size(), 3, "周任务为击杀、撤离、局内升级三条")
	mode.on_kill(false)
	mode.on_kill(true)
	mode.on_level_up()
	mode.on_extract()
	assert_eq(mode.season_exp, 546.0, "事件经验读取当前表：六加四十加二百加三百")
	var weekly: Array = mode.weeklies()
	assert_eq(weekly[0]["id"], "weekly-kill", "击杀周任务标识对齐真源")
	assert_eq(weekly[0]["progress"], 2.0, "普通与精英击杀都驱动周任务")
	assert_eq(weekly[1]["progress"], 1.0, "撤离同时驱动周任务")
	assert_eq(weekly[2]["progress"], 1.0, "局内升级同时驱动周任务")
	assert_eq(weekly[0]["goal"], 200.0, "周击杀目标读取配置")
	mode.reset_weekly()
	mode.add_weekly_progress("weekly-kill", 30)
	mode.add_weekly_progress("weekly-kill", 12)
	assert_eq(mode.weeklies()[0]["progress"], 42.0, "周任务进度累加而非替换")
	assert_eq(mode.weeklies()[1]["progress"], 0.0, "其他任务不受影响")
	assert_false(mode.add_weekly_progress("unknown", 1), "未知任务拒绝")
	mode.reset_season()
	assert_eq(mode.season_lv, 1, "赛季重置到一级")
	assert_eq(mode.season_exp, 0.0, "重置清空经验")
	for entry in mode.weeklies():
		assert_eq(entry["progress"], 0.0, "重置清空所有周任务")


func test_reward_gate_claim_once_and_payload() -> void:
	var mode = SeasonModeScript.new()
	var granted := []
	mode.reward_claimed.connect(func(reward): granted.append(reward))
	assert_eq(mode.rewards().size(), 5, "当前配置有五个奖励节点")
	assert_true(mode.claim_reward("SR001"), "一级奖励可领")
	assert_false(mode.claim_reward("SR001"), "重复领取拒绝")
	assert_false(mode.claim_reward("SR005"), "等级未达十级不可领取末档")
	assert_false(mode.claim_reward("SR999"), "不存在的奖励拒绝")
	assert_eq(granted.size(), 1, "合法领奖发送一次发放描述")
	assert_eq(int(granted[0]["amount"]), 200, "奖励数量来自表")
	assert_true(mode.rewards()[0]["claimed"], "列表反映已领状态")
	var copy: Array = mode.rewards()
	copy[0]["amount"] = 999
	assert_eq(int(mode.rewards()[0]["amount"]), 200, "外部不能通过列表修改配置")
	mode.reset_season()
	assert_true(mode.claim_reward("SR001"), "新赛季可重新领一级奖励")
	mode.cfg.erase("rewards")
	assert_eq(mode.rewards().size(), 0, "缺奖励表安全返回空，不自造奖励")
	assert_push_warning_count(1, "缺奖励表只给保守告警，不抛错误")


func test_unlock_and_challenge_accounting() -> void:
	var mode = SeasonModeScript.new()
	assert_false(mode.is_unlocked(19), "通关十九关未解锁")
	assert_true(mode.is_unlocked(20), "通关二十关恰好解锁")
	mode.mark_level_cleared(19)
	assert_false(mode.start_season_challenge(), "未解锁入口拒绝且不改状态")
	assert_false(mode.challenge_active, "入口被拒不置挑战标记")
	mode.mark_level_cleared(20)
	mode.mark_level_cleared(5)
	assert_eq(mode.cleared_levels, 20, "通关记录只增不减")
	assert_true(mode.start_season_challenge(), "解锁后入口可进入挑战")
	assert_false(mode.start_challenge(), "重复开启挑战拒绝")
	mode.on_kill(false)
	mode.on_extract()
	var result: Dictionary = mode.end_challenge()
	assert_eq(result["levelBefore"], 1, "结算含起始等级")
	assert_eq(result["levelAfter"], 1, "结算含结束等级")
	assert_eq(result["expGained"], 306.0, "挑战累计使用现行六加三百经验")
	assert_eq(result["weeklies"].size(), 3, "结算带三条周任务")
	assert_false(mode.challenge_active, "结算后清挑战标记")
	assert_eq(mode.end_challenge()["expGained"], 0.0, "二次结束不重复计经验")
	mode.start_challenge()
	mode.reset_season()
	assert_false(mode.challenge_active, "跨赛季重置不能留下挑战标记")
	assert_eq(mode.cleared_levels, 20, "赛季重置不抹除主线通关记录")


func test_duration_and_explicit_reset() -> void:
	var mode = SeasonModeScript.new()
	assert_eq(mode.duration_seconds(), 2419200.0, "赛季二十八天转换为秒")
	assert_eq(mode.challenge_time_limit(), 900.0, "挑战时限从配置读取")
	assert_false(mode.advance_time(2419199.0), "未到赛季边界不提示到期")
	assert_true(mode.advance_time(1.0), "赛季时长边界提示到期")
	mode.add_exp(1000)
	assert_eq(mode.season_lv, 2, "真源没有自动结算规则，不擅自删除到期进度")
	mode.reset_season()
	assert_eq(mode.elapsed, 0.0, "显式重置清除赛季计时")
	assert_false(mode.is_expired(), "重置开启新的时长窗口")


func test_injected_cfg_and_invalid_numbers() -> void:
	var mode = SeasonModeScript.new({"maxLv": 3, "expBase": 10, "expStep": 5, "durationDays": 1, "weekly": {"killGoal": 7, "extractGoal": 2, "levelUpGoal": 3}, "expGain": {"kill": 4, "killElite": 9, "levelUp": 5, "extract": 6}, "challenge": {"enabled": false, "timeLimit": 2}, "unlock": {"afterLevels": 2}})
	assert_false(mode.add_exp(NAN), "非数值浮点拒绝")
	assert_false(mode.add_exp(INF), "无穷经验拒绝，避免升级状态异常")
	assert_false(mode.add_weekly_progress("weekly-kill", INF), "无穷任务进度拒绝")
	mode.on_kill()
	assert_eq(mode.season_exp, 4.0, "注入配置覆盖经验值，不硬编码现行数值")
	mode.add_exp(6)
	assert_eq(mode.season_lv, 2, "注入经验曲线也能按边界升级")
	assert_eq(mode.weeklies()[0]["goal"], 7.0, "周任务目标取注入表")
	mode.mark_level_cleared(2)
	assert_false(mode.start_season_challenge(), "挑战开关关闭时入口拒绝")
	assert_eq(mode.duration_seconds(), 86400.0, "时长读取注入表")


func test_cap_keeps_weeklies_but_stops_challenge_exp() -> void:
	var mode = SeasonModeScript.new()
	mode.add_exp(99999)
	mode.start_challenge()
	assert_true(mode.on_kill(true), "封顶仍能推进周任务")
	assert_eq(mode.weeklies()[0]["progress"], 1.0, "封顶不阻止击杀周任务")
	assert_eq(mode.season_exp, 0.0, "封顶不累计经验")
	assert_eq(mode.end_challenge()["expGained"], 0.0, "封顶拒收经验不计入挑战获得值")


func test_reward_gate_at_unlock_level() -> void:
	var mode = SeasonModeScript.new()
	assert_false(mode.claim_reward("SR002"), "三级奖励在一级拒领")
	mode.add_exp(2200)
	assert_eq(mode.season_lv, 3, "两级所需经验之和恰好升三级")
	assert_true(mode.claim_reward("SR002"), "达到解锁等级恰好可领")
	assert_false(mode.claim_reward("SR002"), "跨等级奖励同样防重领")
