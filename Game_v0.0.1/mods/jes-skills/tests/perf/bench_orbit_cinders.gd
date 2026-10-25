# 环绕飞刃 / 落烬环 数值实测（调参用，非门禁；输出供 D-31/D-36 的 [PLACEHOLDER] 定值）
# 运行：godot --headless --path . -s res://mods/jes-skills/tests/perf/bench_orbit_cinders.gd
# 方法：复用冒烟测试的 headless 驱动（_build_entities/_build_skills/try_cast/tick），
#       把 3 个木桩摆到指定半径，记录血量差 = 实际承受伤害。
extends SceneTree

const SandboxMainScript := preload("res://mods/jes-skills/sandbox/sandbox_main.gd")
const DT := 1.0 / 60.0
const PLAYER := Vector2(300, 300)

var main: SandboxMain


func _init() -> void:
	main = SandboxMainScript.new()
	main._build_entities()
	main._build_skills()
	_print_header()
	_bench_ring_of_cinders()
	_bench_orbit_single_set()
	_bench_orbit_recast_stack()
	_bench_orbit_multi_enemy()
	quit(0)


## 把 3 个木桩摆到指定半径（角度 0°/90°/180°，避免同线干扰瞄准）
func _place_stumps(radii: Array) -> void:
	var angles := [0.0, PI * 0.5, PI]
	for i in 3:
		var s = main.stumps[i]
		s.position = PLAYER + Vector2.RIGHT.rotated(angles[i]) * float(radii[i])
		s.health.current_health = s.health.max_health


func _damage_of(idx: int) -> float:
	var s = main.stumps[idx]
	var hp = s.health
	return hp.max_health - hp.current_health


func _tick_for(seconds: float) -> void:
	var steps := int(round(seconds / DT))
	for i in steps:
		main.tick(DT)


func _print_header() -> void:
	print("=== 环绕飞刃 / 落烬环 数值实测（4.7.1 headless，dt=1/60） ===")
	print("木桩半径取值依据：环绕飞刃 orbit_radius=90；落烬环 内90/外150")


# ---------- 落烬环：槽 8，环形带 [90,150]，3 段 × 1s，火 62 ----------
func _bench_ring_of_cinders() -> void:
	print("\n--- A. 落烬环：单次施放，tick 3.5s（伤害窗口 0.1+1.0+1.0+1.0） ---")
	_place_stumps([120.0, 60.0, 200.0])  # 带内 / 内洞 / 带外
	assert(main.try_cast(8), "落烬环应施放成功")
	_tick_for(3.5)
	print("  r=120(带内): %.0f  |  r=60(内洞): %.0f  |  r=200(带外): %.0f" % [
		_damage_of(0), _damage_of(1), _damage_of(2)])
	print("  理论：带内 3 段×62=186；内洞/带外应为 0（环形判定）")
	# 验证持续 DPS 口径：CD 6s，窗口 3.1s → 占空比
	print("  持续 DPS（含 CD）：186/6 = %.1f；窗口 DPS：186/3.1 = %.1f" % [186.0 / 6.0, 186.0 / 3.1])


# ---------- 环绕飞刃：3 刃 orbit r=90，speed 375（一圈 1.51s），寿命 4s ----------
func _bench_orbit_single_set() -> void:
	print("\n--- B. 环绕飞刃：单套 3 刃，tick 4.0s（= 寿命） ---")
	main.slot_bar.get_slot(0).active_gem = GemRegistry.skill(&"orbit_blades")
	main.slot_bar.get_slot(0).supports.clear()  # 寒冰聚焦要求 cold，会拒绝物理弹的装配
	_place_stumps([90.0, 120.0, 45.0])  # 正在环上 / 环外 30 / 内洞
	assert(main.try_cast(0), "环绕飞刃应施放成功（当前 CD 默认 0，恰好证明占位问题）")
	_tick_for(4.0)
	var d := [_damage_of(0), _damage_of(1), _damage_of(2)]
	print("  r=90(环上): %.0f (每秒 %.0f)  |  r=120: %.0f  |  r=45(内洞): %.0f" % [
		d[0], d[0] / 4.0, d[1], d[2]])
	print("  理论上界：环上敌人 3 刃 × 1~2 hit/圈 / 1.51s × 55 ≈ 109~218 每秒")


func _bench_orbit_recast_stack() -> void:
	print("\n--- C. 环绕飞刃：冷却修复后叠层应被禁止（CD=寿命=4s） ---")
	_place_stumps([90.0, 999.0, 999.0])  # 只留环上 1 个
	# 冷却挂在实例上（§5.3「冷却跟槽走」），须对实例重配而非替换 main.cooldowns 数组
	var skill := GemRegistry.skill(&"orbit_blades")
	var inst = main.slot_bar.instance_of(0, main.cooldowns[0])
	inst.cooldown.configure(skill.base_cooldown, 1.0, skill.max_charges, skill.charge_recharge_time)
	main.try_cast(0)
	_tick_for(2.0)
	var recast_ok := main.try_cast(0)  # CD 4s 未到，应被拒绝
	_tick_for(2.0)
	print("  4s 总承伤 %.0f（≈ 单套 480）；CD 未到时第二次施放被拒绝: %s" % [
		_damage_of(0), str(not recast_ok)])


func _bench_orbit_multi_enemy() -> void:
	print("\n--- D. 环绕飞刃：全环覆盖（3 敌都在环上，不同角度） ---")
	# 重置冷却（C 节的 CD 恰好在 4s 时到期，避免边界抖动）
	var inst = main.slot_bar.instance_of(0, main.cooldowns[0])
	inst.cooldown.configure(4.0, 1.0, 0, 0.0)
	_place_stumps([90.0, 90.0, 90.0])
	main.try_cast(0)
	_tick_for(4.0)
	print("  三敌承伤：%.0f / %.0f / %.0f（差异来自出生相位：刃从瞄准方向起转，属测量噪声非平衡问题）" % [
		_damage_of(0), _damage_of(1), _damage_of(2)])
