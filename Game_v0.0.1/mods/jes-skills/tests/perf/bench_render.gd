# 渲染层压测（规格 §11 M8「100 弹并发同屏 ≥ 60fps」的渲染侧证据）
#
# 与 bench_projectiles.gd 的分工：
#   bench_projectiles 只量「逻辑层」（tick + 碰撞查询），headless 可跑；
#   本脚本量「逻辑 + 渲染整帧」，**必须有图形上下文**，headless 下会退化（dummy 渲染器）。
#
# 跑法（不要加 --headless）：
#   godot --path . -s res://mods/jes-skills/tests/perf/bench_render.gd
#   godot --path . --rendering-driver opengl3 -s res://mods/jes-skills/tests/perf/bench_render.gd
#
# 说明：
# - 用真实的一个 MultiMeshInstance2D 画全部子弹（1 次 draw call），
#   与沙盒 SandboxProjectileLayer 同一套实现，不是另写一个简化版。
# - 帧率读数取 Engine.get_frames_per_second()，同时统计帧时间分布（p99 / max）。
# - 无显示器 / 无 GPU 的环境会自动跳过渲染部分并打印原因，不会假装达标。
extends SceneTree

const BULLET_COUNT := 300
const ENEMY_COUNT := 80
const FRAMES := 240
const WARMUP := 60
const FIELD_W := 1280.0
const FIELD_H := 720.0
const TARGET_FPS := 60.0


var _field: ProjectileField = null
var _grid: SkillSpatialHash = null
var _layer = null
var _targets: Array = []
var _setup_rng := RandomNumberGenerator.new()
var _combat_rng := RngService.new(20261019)
var _shared_stats := StatsComponent.new()
var _shared_packet := DamagePacket.new()
var _frame_us := PackedInt32Array()   # 端到端帧间隔（含渲染 + 提交 + 呈现）
var _logic_us := PackedInt32Array()   # 只含本脚本驱动的逻辑（refill + tick + sync）
var _idx := 0


func _initialize() -> void:
	_setup_rng.seed = 20261019
	_shared_packet.elements = {&"physical": 10.0}

	_field = ProjectileField.new(512)
	_grid = SkillSpatialHash.new(64.0)
	_layer = preload("res://mods/jes-skills/sandbox/sandbox_projectile_layer.gd").new()
	root.add_child(_layer)
	_layer.setup(_field, Color(0.62, 0.86, 1.0))

	for i in ENEMY_COUNT:
		var t := DummyTarget.new()
		t.global_position = Vector2(_setup_rng.randf_range(0, FIELD_W), _setup_rng.randf_range(0, FIELD_H))
		_targets.append(t)

	_frame_us.resize(FRAMES)
	_logic_us.resize(FRAMES)

	# 关 vsync 与帧率上限：否则读数是"屏幕刷新率"，不是"渲染成本"
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = 0

	var driver := RenderingServer.get_video_adapter_name()
	print("=== 渲染压测：%d 弹 × %d 敌，%d 帧 ===" % [BULLET_COUNT, ENEMY_COUNT, FRAMES])
	print("渲染后端: %s / 驱动: %s" % [
		ProjectSettings.get_setting("rendering/renderer/rendering_method", "?"), driver])
	# headless 的 DisplayServer 名字就是 "headless"；dummy 渲染器不画像素，读数无意义
	if DisplayServer.get_name() == "headless":
		print("!! 当前是 headless：dummy 渲染器不画像素，帧率读数无意义。请去掉 --headless 重跑。")
	print("")


func _process(delta: float) -> bool:
	_idx += 1
	if _idx <= WARMUP:
		_refill()
		_rebuild_grid()
		_field.tick(delta, _grid, 24.0, _targets, _combat_rng)
		_layer.sync()
		return false

	var f := _idx - WARMUP
	var t0 := Time.get_ticks_usec()
	_refill()
	_rebuild_grid()
	_field.tick(delta, _grid, 24.0, _targets, _combat_rng)
	_layer.sync()
	var logic := Time.get_ticks_usec() - t0
	var i := mini(f - 1, FRAMES - 1)
	_logic_us[i] = logic
	# delta 是引擎实际帧间隔：关掉 vsync 后它反映"跑完这一帧真正花了多久"
	_frame_us[i] = int(delta * 1000000.0)

	if f < FRAMES:
		return false

	_report()
	quit(0)
	return true


func _report() -> void:
	var sorted := _frame_us.duplicate()
	sorted.sort()
	var total := 0
	for v in _frame_us:
		total += v
	var frame_mean := float(total) / float(FRAMES)
	var frame_p99 := float(sorted[mini(int(FRAMES * 0.99), FRAMES - 1)])
	var frame_max := float(sorted[FRAMES - 1])

	var logic_total := 0
	for v in _logic_us:
		logic_total += v
	var logic_mean := float(logic_total) / float(FRAMES)

	var fps := 1000000.0 / maxf(frame_mean, 0.0001)

	print("存活子弹           %d / %d" % [_field.active_count(), BULLET_COUNT])
	print("draw call          1（全部子弹在同一个 MultiMeshInstance2D 里）")
	print("端到端帧间隔       均值 %.2f ms   p99 %.2f ms   max %.2f ms" % [
		frame_mean / 1000.0, frame_p99 / 1000.0, frame_max / 1000.0])
	print("其中本脚本逻辑     均值 %.2f ms（refill + tick + sync）" % (logic_mean / 1000.0))
	print("渲染+呈现（推算）  均值 %.2f ms" % ((frame_mean - logic_mean) / 1000.0))
	print("等效帧率           %.1f fps（目标 ≥ %.0f，vsync 已关闭、不限帧）" % [fps, TARGET_FPS])
	print("16.6ms 预算占用    %.1f%%" % (frame_mean / 16600.0 * 100.0))
	print("结论：%s（本机为桌面 GPU，非 Android 目标机型）" % (
		"达标" if fps >= TARGET_FPS else "未达标"))


## 每帧重建空间哈希（敌人位置会变；80 个 insert 很便宜，量级见 bench_projectiles）
func _rebuild_grid() -> void:
	_grid.clear()
	for i in _targets.size():
		_grid.insert(i, _targets[i].global_position)


func _refill() -> void:
	var need := BULLET_COUNT - _field.active_count()
	if need <= 0:
		return
	for i in need:
		var pos := Vector2(_setup_rng.randf_range(0, FIELD_W), _setup_rng.randf_range(0, FIELD_H))
		_field.spawn(pos, Vector2.RIGHT.rotated(_setup_rng.randf() * TAU),
				420.0, 3.0, 7.0, 2, _shared_packet, null, _shared_stats)


class DummyHurtbox extends RefCounted:
	func receive_hit(_hit: Dictionary, _source) -> void:
		pass


class DummyTarget extends RefCounted:
	var stats := StatsComponent.new()
	var hurtbox := DummyHurtbox.new()
	var global_position := Vector2.ZERO

	func is_dead() -> bool:
		return false

	func radius() -> float:
		return 20.0
