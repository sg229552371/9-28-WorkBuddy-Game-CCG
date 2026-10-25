# 沙盒 HUD（S3）：显示资源/冷却/命中/DoT 状态与操作说明。
# 纯展示，只读 SandboxMain 公开状态，不参与任何判定。
# 注意：绘制必须发生在 CanvasItem 上（Control/Node2D）。
# 分层由父节点 CanvasLayer "Hud"（layer=10）负责，本脚本挂在它的子 Control "HudView" 上。
#
# 性能约束（规格 §13.2 第 10 条「禁止在 _process 里做字符串拼接/字典分配」）：
#   - _draw() 只负责把 _lines 画出来，**不做任何字符串操作**
#   - 文本在 _rebuild_lines() 里按 10Hz 节拍重建（调试面板不需要 60Hz）
#   - _lines 走 clear() 复用容量，不每拍新建 PackedStringArray
class_name SandboxHud
extends Control

const REFRESH_INTERVAL := 0.1   # 10Hz 文本刷新节拍

var main: SandboxMain = null
var _lines: PackedStringArray = []
var _accum: float = 0.0
var _dirty: bool = true         # 首帧强制刷新（_accum 还没攒够）


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	_accum += delta
	if _accum < REFRESH_INTERVAL and not _dirty:
		return
	_accum = 0.0
	_dirty = false
	_rebuild_lines()
	queue_redraw()


## 文本重建：只在刷新节拍上跑一次
func _rebuild_lines() -> void:
	if main == null:
		return
	_lines.clear()   # 保留已分配容量
	var title := "=== 技能系统沙盒 ===  Q 施放实验台技能  R 木桩回血"
	if main.auto_cast:
		title += "   [自动施法 ON]"
	_lines.append(title)
	var mana_cur: float = main.mana.get_current(&"mana")
	_lines.append("蓝量: %d / %d" % [int(mana_cur), int(SandboxMain.MANA_MAX)])
	# 各槽位冷却/充能状态
	var cd_status := ""
	for i in main.cooldowns.size():
		var cd: CooldownComponent = main.cooldowns[i]
		if cd.is_ready():
			continue
		if cd.is_charged_mode():
			cd_status += " [槽%d 充能 %d/%d]" % [i, cd.charges, cd.max_charges]
		else:
			cd_status += " [槽%d CD %.1fs]" % [i, cd.cooldown_duration()]
	if cd_status == "":
		cd_status = " 全部就绪"
	_lines.append("冷却:%s" % cd_status)
	var fx_active := main.effect_pool.active_count() if main.effect_pool != null else 0
	var fx_cap := main.effect_pool.cap if main.effect_pool != null else 0
	_lines.append("投射物: %d/%d   特效: %d/%d   DoT 活跃: %d" % [
		main.projectile_pool.active_count(), main.projectile_pool.capacity(),
		fx_active, fx_cap,
		main.player.dot_ticker.active_count(),
	])
	# 木桩血量
	for s in main.stumps:
		var hp: float = s.health.current_health
		_lines.append("%s: %d / %d%s" % [
			s.entity_name, int(hp), int(s.health.max_health),
			"  (死亡,重生中)" if s.is_dead() else "",
		])
	# baseline 从 24 起：字号 14 的上伸部分约 11px，从 8 起会被窗口顶边裁掉


## 纯绘制：不查数据、不拼字符串，只把已生成的文本行刷到画布
func _draw() -> void:
	if main == null:
		return
	var y := 24.0
	for line in _lines:
		draw_string(ThemeDB.fallback_font, Vector2(8.0, y), line,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 1, 1))
		y += 18.0
