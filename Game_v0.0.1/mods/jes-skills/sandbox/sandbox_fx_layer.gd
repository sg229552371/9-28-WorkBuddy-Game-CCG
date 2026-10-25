# SandboxFxLayer（沙盒表现层，D-32 表现债）：绘制瞬态特效。
# 覆盖四类此前无视觉的行为表现：
#   近战挥砍（melee_arc）—— 扇形弧光，0.18s 淡出
#   引导光束（读 _channel 状态）—— 玩家沿瞄准方向的脉动光束
#   冲刺轨迹（dash_ghost + _dash 起点）—— 残影链 + 起点标记
#   buff 光环（读 _buffs 状态）—— 玩家身上的呼吸光环
# 纯表现：只读 main 状态画图形，不参与任何判定；生命周期剪枝在 SandboxMain._tick_fx()。
class_name SandboxFxLayer
extends Node2D

var main: SandboxMain = null

const MELEE_COLOR := Color(1.0, 0.82, 0.42, 0.75)   # 与 MELEE_FX_TINT 同族
const BEAM_COLOR := Color(0.62, 0.5, 1.0, 0.65)
const DASH_COLOR := Color(0.5, 0.8, 1.0, 0.45)
const BUFF_COLOR := Color(1.0, 0.35, 0.3, 0.4)


func _process(_dt: float) -> void:
	queue_redraw()


func _draw() -> void:
	if main == null or main.player == null:
		return
	_draw_melee_arcs()
	_draw_channel_beam()
	_draw_dash()
	_draw_buff_aura()


## 近战扇形弧光：外弧 + 内弧 + 两条半径线，随寿命淡出
func _draw_melee_arcs() -> void:
	for fx in main._fx:
		if fx[&"kind"] != &"melee_arc":
			continue
		var t: float = clampf(
				(main._elapsed - float(fx[&"born_at"])) / float(fx[&"ttl"]), 0.0, 1.0)
		var a := 1.0 - t
		var c: Vector2 = fx[&"center"]
		var ang: float = float(fx[&"angle"])
		var half: float = float(fx[&"half"])
		var rng: float = float(fx[&"range"])
		var col := MELEE_COLOR
		col.a *= a
		draw_arc(c, rng, ang - half, ang + half, 24, col, 5.0)
		draw_arc(c, rng * 0.62, ang - half, ang + half, 24, Color(col.r, col.g, col.b, col.a * 0.4), 3.0)
		draw_line(c, c + Vector2.RIGHT.rotated(ang - half) * rng, Color(col.r, col.g, col.b, col.a * 0.6), 2.0)
		draw_line(c, c + Vector2.RIGHT.rotated(ang + half) * rng, Color(col.r, col.g, col.b, col.a * 0.6), 2.0)


## 引导光束：_channel 活着时画一条脉动光束（长度与判定一致，来自 plan 状态）
func _draw_channel_beam() -> void:
	if main._channel.is_empty():
		return
	var pulse := 0.55 + 0.45 * absf(sin(main._elapsed * 18.0))
	var from: Vector2 = main.player.global_position
	var to := from + Vector2.RIGHT.rotated(main._aim_angle()) * float(main._channel.get(&"beam_len", 400.0))
	var col := BEAM_COLOR
	col.a *= pulse
	draw_line(from, to, col, 8.0)
	draw_line(from, to, Color(col.r, col.g, col.b, col.a * 0.35), 16.0)
	draw_circle(to, 6.0, col)


## 冲刺：起点标记 + 残影链
func _draw_dash() -> void:
	if not main._dash.is_empty():
		var start: Vector2 = main._dash[&"start_pos"]
		draw_circle(start, 4.0, DASH_COLOR)
		draw_line(start, main.player.global_position,
				Color(DASH_COLOR.r, DASH_COLOR.g, DASH_COLOR.b, DASH_COLOR.a * 0.5), 2.0)
	for fx in main._fx:
		if fx[&"kind"] != &"dash_ghost":
			continue
		var t: float = clampf(
				(main._elapsed - float(fx[&"born_at"])) / float(fx[&"ttl"]), 0.0, 1.0)
		var col := DASH_COLOR
		col.a *= 1.0 - t
		draw_arc(fx[&"pos"], float(fx[&"radius"]) + 3.0, 0.0, TAU, 20, col, 2.0)


## buff 光环：有 buff 时玩家身上画呼吸圆环
func _draw_buff_aura() -> void:
	if main._buffs.is_empty():
		return
	var breathe := 0.75 + 0.25 * sin(main._elapsed * 6.0)
	var p: Vector2 = main.player.global_position
	var r: float = main.player.radius() + 10.0
	draw_arc(p, r, 0.0, TAU, 32, BUFF_COLOR, 3.0)
	draw_circle(p, r * breathe, Color(BUFF_COLOR.r, BUFF_COLOR.g, BUFF_COLOR.b, BUFF_COLOR.a * 0.25))
