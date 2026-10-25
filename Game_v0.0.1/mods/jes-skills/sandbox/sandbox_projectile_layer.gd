# 投射物批量绘制层（M8 / 规格 §9.1；D-33 重写）。
#
# 为什么改写：旧实现用 MultiMeshInstance2D + StandardMaterial3D + QuadMesh（3D 材质），
# 而 2D canvas 渲染管线不消费 3D 材质 → 整层实例全部隐形（用户实测"投射物未渲染"）。
# 沙盒规模上限 512 发，Node2D._draw 逐发 draw_circle 完全够便宜，与其他表现层
# （AoeLayer / FxLayer / Hud）统一为同一套 _draw 方案。
#
# 硬规则：
# - 只读 ProjectileField 的 SoA 数组，不回写任何战斗状态（渲染不得影响结算）
# - 位置/缩放/淡出数学仍收敛在纯静态函数 instance_state()（D-04 API 不变，
#   headless 可断言；bench_render 与本层共用同一实现）
class_name SandboxProjectileLayer
extends Node2D

const DEFAULT_TINT := Color(0.62, 0.86, 1.0)
const FADE_START := 0.8      # 寿命进度超过这个值开始收边淡出

var field: ProjectileField = null
var tint: Color = DEFAULT_TINT


func setup(p_field: ProjectileField, p_tint: Color = DEFAULT_TINT) -> void:
	field = p_field
	tint = p_tint


func _process(_dt: float) -> void:
	queue_redraw()


## 兼容旧调用点（SandboxMain.tick / bench_render）：触发重绘并返回存活数。
## 返回值让 headless 测试可以断言「存活数 == 应绘制数」。
func sync() -> int:
	if field == null:
		return 0
	var n := 0
	for i in field.capacity:
		if field.alive[i] != 0:
			n += 1
	queue_redraw()
	return n


func _draw() -> void:
	if field == null:
		return
	for i in field.capacity:
		if field.alive[i] == 0:
			continue
		var st := instance_state(field.px[i], field.py[i], field.radius[i],
				field.age[i], field.life[i], tint)
		var t: Transform2D = st[&"transform"]
		var c: Color = st[&"color"]
		# 外圈光晕 + 内圈亮核：接近旧径向渐变的观感
		draw_circle(t.origin, t.x.x, c)
		draw_circle(t.origin, t.x.x * 0.45,
				Color(c.r, c.g, c.b, minf(c.a * 1.6, 1.0)))


## 纯函数：一发投射物的 SoA 状态 → 位置/半径/颜色。
## 抽出来是为了让「位置/缩放/淡出」这套数学能在 headless 下被断言
## （dummy 渲染器不产生绘制命令，读不到 _draw 的内容）。
static func instance_state(px: float, py: float, radius: float,
		age: float, life: float, tint_color: Color) -> Dictionary:
	# 生命末期收边：半径收缩 + 透明度衰减，替代逐发动画
	var frac := age / maxf(life, 0.0001)
	var k := 1.0 - clampf((frac - FADE_START) / (1.0 - FADE_START), 0.0, 1.0)
	var r := radius * (0.55 + 0.45 * k)
	var c := tint_color
	c.a = (0.45 + 0.55 * k) * tint_color.a
	return {
		&"transform": Transform2D(Vector2(r, 0.0), Vector2(0.0, r), Vector2(px, py)),
		&"color": c,
	}
