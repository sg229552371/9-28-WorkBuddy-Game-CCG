# M8 批量绘制层测试（2026-10-19 R4 建立；2026-10-21 D-33 随层重写适配）
# 目标：验证 setup 绑定正确、sync 返回存活数、位置/尺寸/淡出跟着 SoA 走。
# 说明：D-33 起层改为 Node2D._draw（旧 MultiMesh + 3D 材质在 2D canvas 不渲染，
# 投射物整体隐形）。headless 的 dummy 渲染器不产生绘制命令，所以：
#   - 「画几发」的断言打在 sync() 返回值（= 本帧存活数）上
#   - 「画在哪/多大/多透明」的断言打在纯函数 instance_state() 上
extends GutTest

const LayerScript := preload("res://mods/jes-skills/sandbox/sandbox_projectile_layer.gd")
const FieldScript := preload("res://mods/jes-skills/systems/skills/combat/projectile_field.gd")

var field: ProjectileField = null
var layer: SandboxProjectileLayer = null


func before_each() -> void:
	field = FieldScript.new(8)
	layer = autofree(LayerScript.new())
	layer.setup(field)


func after_each() -> void:
	layer = null
	field = null


func _spawn(pos: Vector2, radius: float = 8.0) -> int:
	var p := DamagePacket.new()
	p.elements = {&"physical": 1.0}
	return field.spawn(pos, Vector2.RIGHT, 0.0, 5.0, radius, 0, p, null, StatsComponent.new())


func test_pl1_setup_binds_field_and_default_tint() -> void:
	assert_not_null(layer.field, "setup 必须绑定 ProjectileField")
	assert_eq(layer.field, field, "绑定的应是传入的 field 实例")
	assert_eq(layer.tint, SandboxProjectileLayer.DEFAULT_TINT, "缺省色应为浅蓝弹丸色")
	assert_eq(layer.sync(), 0, "空场时存活数为 0")


func test_pl2_sync_count_tracks_active() -> void:
	_spawn(Vector2(10, 10))
	_spawn(Vector2(20, 20))
	assert_eq(layer.sync(), 2, "两发存活应计数为 2")


func test_pl3_instance_state_follows_soa() -> void:
	var i := _spawn(Vector2(7, 9), 12.0)
	layer.sync()
	var st := SandboxProjectileLayer.instance_state(
			field.px[i], field.py[i], field.radius[i], field.age[i], field.life[i],
			SandboxProjectileLayer.DEFAULT_TINT)
	var t: Transform2D = st[&"transform"]
	assert_almost_eq(t.origin.x, 7.0, 0.001)
	assert_almost_eq(t.origin.y, 9.0, 0.001)
	# 满寿命时缩放系数应等于半径（末期才收边）
	assert_almost_eq(t.x.x, 12.0, 0.001, "缩放系数应等于半径")
	# 推进后位置应跟着 SoA 走
	field.tick(0.1, null, 20.0, [], RngService.new(0))
	var st2 := SandboxProjectileLayer.instance_state(
			field.px[i], field.py[i], field.radius[i], field.age[i], field.life[i],
			SandboxProjectileLayer.DEFAULT_TINT)
	assert_almost_eq(float((st2[&"transform"] as Transform2D).origin.x), 7.0, 0.001,
			"speed=0 时不应移动")


func test_pl4_release_hides_instance() -> void:
	var i := _spawn(Vector2.ZERO)
	assert_eq(layer.sync(), 1)
	field.release(i)
	assert_eq(layer.sync(), 0, "回收后不应继续绘制")


func test_pl5_color_alpha_fades_near_end_of_life() -> void:
	var tint := SandboxProjectileLayer.DEFAULT_TINT
	var full := SandboxProjectileLayer.instance_state(0.0, 0.0, 8.0, 0.0, 5.0, tint)
	var mid := SandboxProjectileLayer.instance_state(0.0, 0.0, 8.0, 4.5, 5.0, tint)
	var end := SandboxProjectileLayer.instance_state(0.0, 0.0, 8.0, 4.9, 5.0, tint)
	assert_gt(float((full[&"color"] as Color).a), float((mid[&"color"] as Color).a),
			"进入末期后透明度应下降")
	assert_lt(float((end[&"color"] as Color).a), float((mid[&"color"] as Color).a),
			"越接近寿命越透明")
	assert_gt(float((end[&"color"] as Color).a), 0.0, "未到寿命不应完全透明")
	# 半径收边但不会缩成 0（否则看起来像提前消失）
	assert_lt(float((end[&"transform"] as Transform2D).x.x), 8.0)
	assert_gt(float((end[&"transform"] as Transform2D).x.x), 4.0)
