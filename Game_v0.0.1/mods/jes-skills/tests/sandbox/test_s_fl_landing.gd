# D-50 FLY 复合落点结算测试（不依赖槽位编排，直接注入 plan）
#
# 背景：FLY 复合 14 格是「投射段 + 爆发段」双段。夜间批次 C 只落了数据，
# 爆发段当时仍在「施放瞬间的最近目标」位置结算 —— 弹飞哪儿与爆哪儿无关。
# 这里锁死修正后的语义：爆发中心 = 弹体消亡点（撞爆或飞满寿命都算）。

extends GutTest

const SandboxMainScript := preload("res://mods/jes-skills/sandbox/sandbox_main.gd")

var main: SandboxMain = null
var stump = null


func before_each() -> void:
	main = autofree(SandboxMainScript.new())
	main._build_entities()
	main._build_skills()
	main.set_auto_cast(false)   # 关自动施法，避免每拍偷放槽 0 干扰计数
	stump = main.stumps[0]


func after_each() -> void:
	main = null
	stump = null


## p1：投射段之后紧跟爆发段 → 爆发改为「等弹消亡」，不在施放瞬间落地
func test_fl1_burst_waits_for_projectile() -> void:
	_launch_then_burst(600.0)
	assert_eq(main._pending_aoe.size(), 1, "应挂账 1 条爆发")
	assert_true(main._pending_aoe[0].has(&"anchor_proj"), "爆发应进入锚定模式")
	assert_eq(float(main._pending_aoe[0][&"fire_at"]), INF, "锚定模式不吃 delay（等弹消亡）")
	# 弹还在飞 → 推进 0.05s 不应结算
	main.tick(0.05)
	assert_true(projectile_alive(), "此时弹应仍在飞")
	assert_eq(main._pending_aoe.size(), 1, "弹未消亡前爆发不该落地")

## p2：弹一消亡（撞桩或飞满寿命），爆发当帧在消亡点结算
func test_fl2_burst_fires_at_projectile_death_point() -> void:
	_launch_then_burst(600.0)
	# 桩在 300px 外，弹速 600 → 约 0.5s 内撞上（射程 600 的 1/2）
	main.tick(0.02)
	_step_until_projectile_dead(3.0)
	assert_false(projectile_alive(), "弹应已消亡")
	assert_eq(main._pending_aoe.size(), 0, "弹消亡后爆发应已结算出队")

## p3：端到端 —— 结算时**实际使用的爆心**必须等于弹体消亡点。
## 这条不看伤害、不看半径：直接比对坐标，任何一环读错位置都会红。
func test_fl3_burst_center_equals_projectile_death_point() -> void:
	_launch_then_burst(600.0, 120.0)
	var idx: int = int(main._pending_aoe[0][&"anchor_proj"])
	_step_until_projectile_dead(3.0)
	var death_pos: Vector2 = main.projectile_field.snapshot(idx)[&"pos"]
	main.tick(0.02)   # 这一帧爆发结算并出队
	assert_eq(main._pending_aoe.size(), 0, "爆发应已结算出队")
	assert_eq(main.last_burst_center, death_pos, "结算中心必须等于弹体消亡点")
	# 落点确实远离施放点（否则这条断言没有区分力）
	assert_gt(death_pos.distance_to(main.player.global_position), 200.0,
			"弹应已飞离施放点（否则观察不到落点差异）")

## p3b：反向对照 —— 同样的半径若按旧口径在施放点结算，桩不该掉血。
func test_fl3b_same_radius_at_cast_point_would_miss() -> void:
	var hp_before: float = stump.health.current_health
	main._pending_launch_idx = -1
	main._exec_aoe(_aoe_plan(120.0, 0.0))
	# 模拟「旧口径」：把爆心改回玩家位置
	main._pending_aoe[0][&"center"] = main.player.global_position
	main.tick(0.02)
	assert_eq(stump.health.current_health, hp_before,
			"施放点距桩 414px > 半径 120，不该命中（证明落点确实不同于施放点）")

## p4：纯范围技能（前面没有投射段）不受影响，仍走原延迟语义（零回归）
func test_fl4_pure_aoe_keeps_old_delay_behavior() -> void:
	main._pending_launch_idx = -1
	main._exec_aoe(_aoe_plan(120.0, 0.5))
	assert_eq(main._pending_aoe.size(), 1)
	assert_false(main._pending_aoe[0].has(&"anchor_proj"), "纯范围技能不该进锚定模式")
	assert_ne(float(main._pending_aoe[0][&"fire_at"]), INF, "纯范围技能应保留 delay")

## p5：认领是一次性的 —— 爆发段认领后清空，后续再放爆发不会误挂到同一发弹
func test_fl5_anchor_claim_is_single_use() -> void:
	_launch_then_burst(600.0)
	assert_eq(main._pending_launch_idx, -1, "爆发段认领后应清空登记，防止后续段误用")

# ---------------- helpers ----------------

## 先发一发弹，再紧跟着发爆发段（复刻 SkillExecutor 对 FLY 复合技能的 plan 顺序）
func _launch_then_burst(distance_hint: float, burst_radius: float = 120.0) -> void:
	main._exec_projectile(_projectile_plan(distance_hint))
	main._exec_aoe(_aoe_plan(burst_radius, 0.0))

## 逐帧推进直到弹消亡或超时（dt 固定 1/60，保证确定性）
func _step_until_projectile_dead(max_seconds: float) -> void:
	var dt := 1.0 / 60.0
	var t := 0.0
	while t < max_seconds and projectile_alive():
		main.tick(dt)
		t += dt

func projectile_alive() -> bool:
	return main.projectile_field.active_count() > 0

func _projectile_plan(speed: float) -> Dictionary:
	return {
		&"behavior_id": &"bhv_projectile",
		&"elements": {&"physical": 10.0},
		&"channel": 0,
		&"tags": Array([&"attack", &"projectile", &"physical"], TYPE_STRING_NAME, &"", null),
		&"params": {
			&"count_base": 1.0,
			&"speed": 600.0,
			&"lifetime": 2.0,
			&"radius": 12.0,
			&"pierce": 0.0,
			&"chain_count": 0.0,
			&"fork_count": 0.0,
			&"spread_deg": 0.0,
			&"motion": &"linear",
			&"orbit_radius": 0.0,
		},
		&"area_mult": 1.0,
		&"angle_deg": 0.0,
	}

func _aoe_plan(radius: float, delay: float) -> Dictionary:
	return {
		&"behavior_id": &"bhv_aoe_burst",
		&"elements": {&"fire": 40.0},
		&"channel": 0,
		&"tags": Array([&"spell", &"aoe", &"fire"], TYPE_STRING_NAME, &"", null),
		&"params": {
			&"shape": &"circ",
			&"radius": radius,
			&"inner_radius": 0.0,
			&"delay": delay,
			&"hit_count": 1.0,
			&"hit_interval": 0.0,
		},
		&"area_mult": 1.0,
	}
