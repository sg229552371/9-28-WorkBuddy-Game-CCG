## 对译 rift_test.js：进场一次投放，冻结期间不推进任务。
extends GutTest

const RiftModeScript = preload("res://mods/jes-rift/scripts/rift_mode.gd")
const ExtractPointScript = preload("res://mods/jes-rift/scripts/extract_point.gd")


func test_entry_batch_and_freeze() -> void:
	var mode = RiftModeScript.new()
	mode.set_seed(20261024)
	assert_true(mode.begin("purge"), "应可进入配置中的歼灭任务")
	assert_eq(mode.spawn_count, 20, "普通怪一次投放数量来自任务表")
	assert_eq(mode.elite_count, 3, "独立精英数量来自裂缝表")
	assert_eq(mode.total_spawned, 23, "一次投放总数为普通怪加独立精英")
	assert_eq(mode.freeze_timer, 3.0, "开场冻结时长来自配置")
	mode.update(2.0)
	assert_eq(mode.task["remain"], 75.0, "冻结期间任务限时暂停")
	assert_eq(mode.record_kill(), 0, "冻结期间不能发生击杀")
	mode.update(1.0)
	assert_eq(mode.freeze_timer, 0.0, "冻结到点后解除")
	assert_eq(mode.task["remain"], 75.0, "解除冻结的这一帧仍不推进战斗")
	assert_true(mode.return_beacon["position"].x > 0, "入场生成返回信标描述")


func test_point_activation_radius_and_single_success() -> void:
	var point = ExtractPointScript.new()
	var pos := Vector2(800, 600)
	var mate := {"id": "mate", "position": pos, "dead": false}
	var leader := {"id": "leader", "position": pos, "dead": false}
	var emitted := [0]
	point.succeeded.connect(func(): emitted[0] += 1)
	assert_false(point.activate(pos, false), "未满足首领条件不能激活")
	assert_false(point.update(1.0, [mate]), "未激活不能读条")
	assert_true(point.activate(pos, true), "满足首领条件生成撤离点")
	assert_false(point.activate(Vector2.ZERO, true), "重复首领结算不能移动已有点")
	assert_true(point.contains(pos + Vector2(119, 0)), "实际判定半径读配置倍率为一百二十")
	assert_false(point.contains(pos + Vector2(120, 0)), "真源严格小于判定半径，不包含边界")
	point.update(0.5, [mate])
	assert_eq(point.holder, "mate", "任一队友均可占用单一读条")
	point.update(0.5, [leader, mate])
	assert_eq(point.progress, 1.0, "多人同圈不加速")
	assert_true(point.update(7.0, [leader, mate]), "累计八秒后成功")
	assert_eq(point.progress, 0.0, "读满后判定被消费，进度归零")
	assert_null(point.holder, "读满后清除持有者")
	assert_eq(emitted[0], 1, "成功信号仅发送一次")
	point.update(100.0, [mate])
	assert_eq(emitted[0], 1, "已消费判定不得重复触发")


func test_task_success_timeout_and_no_reinforcements() -> void:
	var mode = RiftModeScript.new()
	mode.begin("hunt")
	mode.update(3.0)
	for i in range(20):
		mode.record_kill()
	mode.update(0.1)
	assert_true(mode.task["done"], "达任务目标后完成猎杀任务")
	assert_eq(mode.reward_nodes().size(), 2, "基础箱和任务箱均可取得")
	var batch: int = mode.total_spawned
	mode.update(400.0)
	assert_eq(mode.total_spawned, batch, "任务成功后不再增援")
	mode.begin("raid")
	mode.update(3.0)
	mode.update(40.0)
	assert_true(mode.task["failed"], "限时耗尽判任务失败")
	assert_false(mode.task["done"], "超时后不能又判成功")
	batch = mode.total_spawned
	for i in range(14):
		mode.record_kill()
	mode.update(100.0)
	assert_eq(mode.total_spawned, batch, "任务失败也不再增援")
	assert_eq(mode.reward_nodes().size(), 1, "超时仍可清剿拿基础箱，但无任务箱")
	assert_eq(mode.reward_nodes()[0]["weights"], mode.cfg["chestWeights"], "基础箱权重完全来自表")
	assert_false(mode.begin("missing"), "未知任务不改变当前状态")


func test_leave_circle_damage_and_freeze() -> void:
	var point = ExtractPointScript.new()
	var hero := {"id": "hero", "position": Vector2.ZERO}
	point.activate(Vector2.ZERO)
	point.update(1.0, [hero])
	point.update(0.1, [])
	assert_almost_eq(point.progress, 0.88, 0.00001, "离圈按一点二倍衰退而非瞬间清零")
	assert_push_warning_count(1, "衰退键未导出时按真源测试回退并告警一次")
	point.update(1.0, [hero], true)
	assert_almost_eq(point.progress, 0.88, 0.00001, "冻结时不推进读条")
	assert_true(point.interrupt(), "受击打断返回确实打断")
	assert_eq(point.progress, 0.0, "受击进度归零")
	assert_null(point.holder, "受击清空持有者")
	assert_true(point.active, "打断后点保留，可重读")
	point.update(1.0, [{"id": "dead", "position": Vector2.ZERO, "dead": true}])
	assert_eq(point.progress, 0.0, "死亡英雄不能占用撤离点")
	point.update(8.0, [hero])
	assert_true(point.done, "打断后重读可成功")


func test_weight_duration_and_wave_budget() -> void:
	var point = ExtractPointScript.new()
	assert_eq(point.channel_seconds(0), 8.0, "零负重使用八秒基础读条")
	assert_almost_eq(point.channel_seconds(340), 12.8, 0.00001, "三百四十负重是一点六倍读条")
	assert_eq(point.channel_seconds(100000), 16.0, "极高负重封顶两倍")
	point.activate(Vector2.ZERO)
	point.update(1.0, [{"id": "hero", "position": Vector2.ZERO}], false, 340)
	assert_almost_eq(point.progress, 0.625, 0.00001, "按归一化进度推进，高负重读条更慢")
	assert_eq(point.wave_size(1), 2, "第一波数量读表")
	assert_eq(point.wave_size(4), 5, "第四波按基础加成长计算")
	assert_eq(point.wave_size(9, 3), 3, "波次数量不得超过剩余怪物容量")
	point.cfg["enabled"] = false
	assert_eq(point.channel_seconds(340), 8.0, "关闭压力机制时负重不影响读条")


func test_final_boss_point_and_full_settlement() -> void:
	var mode = RiftModeScript.new()
	assert_false(mode.spawn_extract_point(Vector2(900, 900), false, "endless"), "非最终首领不生成深渊撤离点")
	assert_true(mode.spawn_extract_point(Vector2(900, 900), true, "endless"), "最终首领在死亡位置生成撤离点")
	assert_false(mode.spawn_extract_point(Vector2(800, 800), true, "endless"), "每局只生成一个撤离点")
	assert_eq(mode.extract_point.position, Vector2(900, 900), "重复调用不移动点")
	assert_eq(mode.extract_point.channel_seconds(), 3.0, "深渊读条使用深渊表三秒，不用主线八秒")
	var heroes := [{"id": "hero", "position": Vector2(900, 900)}]
	mode.extract_point.update(1.0, heroes)
	assert_false(mode.extract_point.done, "不足三秒不能成功")
	mode.extract_point.interrupt()
	assert_eq(mode.extract_point.progress, 0.0, "深渊受击同样归零")
	mode.extract_point.update(3.1, heroes)
	var report: Dictionary = mode.settle(101, "extract")
	assert_true(report["extracted"], "撤离结算标全收益")
	assert_eq(report["carriedCrystals"], 101, "成功全额带出结晶")
	assert_eq(report["title"], "撤离成功", "结局标题来自配置")
	report["carriedCrystals"] = 0
	assert_eq(mode.settle(999, "death")["carriedCrystals"], 101, "结算幂等且不被外部报告修改污染")


func test_failure_penalty_and_outcome_priority() -> void:
	var mode = RiftModeScript.new()
	var report: Dictionary = mode.settle(101, "death")
	assert_eq(report["carriedCrystals"], 30, "失败按表保留三成并向下取整")
	assert_eq(report["lostCrystals"], 71, "损失与带出合计等于原结晶")
	assert_eq(report["title"], "深渊阵亡", "死亡结局文案来自表")
	mode.reset()
	report = mode.settle(101, "extract", true)
	assert_eq(report["reason"], "timeout", "超时优先于同时存在的撤离成功标记")
	assert_false(report["extracted"], "超时走失败口径")
	assert_eq(report["carriedCrystals"], 30, "超时和死亡同惩罚")
	assert_eq(report["title"], "时限耗尽", "超时结局文案与死亡不同")


func test_injected_tables_and_threat_fallback() -> void:
	var mode = RiftModeScript.new({"worldSize": 200, "freezeTime": 1, "channel": 2, "eliteBase": 2, "threatLevel": 4, "tasks": [{"id": "custom", "spawnCount": 6, "goal": 5}]})
	mode.begin("custom", 1.5)
	assert_eq(mode.elite_count, 3, "独立精英数量可由外部邪神倍率修正")
	assert_eq(mode.threat_level(), 4.0, "显式威胁等级来自注入配置，不自行生成成长曲线")
	assert_eq(mode.floor_no, 1, "进入裂隙层后层号为一")
	mode.reset()
	assert_eq(mode.floor_no, 0, "重置清除层号")
	assert_false(mode.active, "重置清除运行状态")
	assert_true(mode.return_beacon.is_empty(), "重置清除返回点")


func test_config_tasks_and_return_to_main() -> void:
	var mode = RiftModeScript.new()
	for entry in mode.cfg["tasks"]:
		assert_true(int(entry["spawnCount"]) >= int(entry["goal"]), "投放数量必须覆盖任务目标")
		assert_true(int(entry["spawnCount"]) >= int(mode.cfg["rewardKills"]), "每个任务均能达到基础奖励阈值")
	mode.begin("hunt")
	mode.update(3.0)
	mode.record_kill()
	var snapshot: Dictionary = mode.task.duplicate(true)
	mode.return_to_main()
	mode.update(100.0)
	assert_false(mode.active, "返回主图退出裂缝运行态")
	assert_eq(mode.task, snapshot, "返回不篡改任务记录")
	assert_eq(mode.kills, 1, "返回不等价于整局失败，不清收益计数")
	assert_false(mode.spawn_extract_point(Vector2.ZERO, true, "rift"), "裂缝返回信标不能混为深渊撤离点")


func test_missing_threat_warns_once_and_reset_point() -> void:
	var mode = RiftModeScript.new()
	assert_eq(mode.threat_level(), 1.0, "真源未定义威胁，保守回退中性一级")
	assert_eq(mode.threat_level(), 1.0, "重复读取威胁不改变值")
	assert_push_warning_count(1, "同一缺失字段每实例只告警一次")
	mode.spawn_extract_point(Vector2.ZERO, true, "main")
	assert_eq(mode.extract_point.channel_seconds(), 8.0, "主线点仍使用八秒读条")
	var old_point: RefCounted = mode.extract_point
	mode.reset()
	assert_false(old_point.active, "重开必须使旧撤离点失效")
	assert_null(mode.extract_point, "重开不保留旧撤离点引用")
	assert_true(mode.spawn_extract_point(Vector2.ONE, true, "main"), "新一局允许重新生成撤离点")
