# SandboxAoeLayer（沙盒表现层，D-31 表现债）：绘制 AoE 落地区域。
# 之前 _pending_aoe 完全无视觉——实心圆"打了就是打了"掩盖了缺口，
# 环形（inner_radius > 0）必须看见环带才验得了手感。
# 纯表现：只读 main 的 AoE 队列画图形，不参与任何判定；判定唯一真源仍是
# BhvAoeBurst.hits_ring()（门禁由 test_m6_behaviors 锁定）。
# 颜色语义：未到打击时刻（预警）= 40% 透明度；已进入打击窗口 = 全亮度。
class_name SandboxAoeLayer
extends Node2D

var main: SandboxMain = null

const RING_COLOR := Color(1.0, 0.45, 0.15, 0.5)      # 环带：粗弧线
const SOLID_FILL := Color(1.0, 0.45, 0.15, 0.16)     # 实心圆：淡填充
const EDGE_COLOR := Color(1.0, 0.45, 0.15, 0.65)     # 实心圆：描边


func _process(_dt: float) -> void:
	queue_redraw()


func _draw() -> void:
	if main == null:
		return
	for a in main._pending_aoe:
		var c: Vector2 = a[&"center"]
		var outer: float = float(a[&"radius"])
		var inner: float = float(a.get(&"inner_radius", 0.0))
		var active: bool = main._elapsed >= float(a[&"fire_at"])
		if inner > 0.0:
			# 环：用一条粗弧线画环带（宽 = 外-内），中心天然留空
			var mid: float = (outer + inner) * 0.5
			var width: float = maxf(outer - inner, 2.0)
			draw_arc(c, mid, 0.0, TAU, 48, _alpha(RING_COLOR, active), width)
		else:
			# 实心圆：淡填充 + 细描边（霜爆新星等老技能保持轻量观感）
			draw_circle(c, outer, _alpha(SOLID_FILL, active))
			draw_arc(c, outer, 0.0, TAU, 48, _alpha(EDGE_COLOR, active), 2.0)


static func _alpha(base: Color, active: bool) -> Color:
	if active:
		return base
	return Color(base.r, base.g, base.b, base.a * 0.4)
