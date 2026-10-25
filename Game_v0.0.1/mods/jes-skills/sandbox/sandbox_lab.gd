# 装配实验台（S4 UI 层）：技能下拉 × 辅助宝石多选，实时展示「是否生效 + 具体效果」。
# 硬门禁：不出现 gem_id / support_id 逻辑分支 —— 下拉项与勾选项全部来自 GEMS 数据表，
#         预览走 SocketGraph.assemble / SkillExecutor.cast 同一条通用管线。
# 交互：勾选即写入槽 0（SandboxMain.apply_lab_loadout），Q 实放当前配置；
#       默认勾选自动施法，持续开火（D-33 用户裁定：不再设 1~9 槽位键）。
class_name SandboxLab
extends Control


const PANEL_LEFT := 10.0
const PANEL_TOP := 172.0        # 让开左上角 HUD 文字
const PANEL_WIDTH := 352.0
const PANEL_BOTTOM_MARGIN := 10.0
const FONT_SMALL := 12

# 参数键 → 中文显示名（纯展示映射，不参与任何判定）
const PARAM_NAMES := {
	&"projectile_count": "投射物",
	&"pierce": "穿透",
	&"chain_count": "连锁",
	&"fork_count": "分裂",
	&"radius": "半径",
	&"speed": "弹速",
	&"lifetime": "寿命",
	&"arc_deg": "扇形角",
	&"range": "射程",
	&"hit_count": "段数",
	&"hit_interval": "段间隔",
	&"delay": "延迟",
	&"tick_interval": "tick间隔",
	&"max_channel_time": "引导时长",
	&"duration": "持续",
	&"distance": "距离",
	&"max_count": "召唤数",
}

# 内部规范化键（projectile_count 的 base 载体）：报告里只显示 projectile_count
const HIDDEN_PARAMS := [&"count_base"]

# ---------------- 三维筛选（四轴模型前三轴，00_总纲 §2；轴值运行时推导，不碰数据文件） ----------------
# 投送轴：behavior_id → 轴值（与契约测试同源推导；aoe_burst 属瞬时点发）
const BEHAVIOR_DELIVERY := {
	&"bhv_projectile": "飞行",
	&"bhv_melee_swing": "瞬时",
	&"bhv_aoe_burst": "瞬时",
	&"bhv_channel": "引导",
	&"bhv_dash": "位移",
	&"bhv_buff_self": "自身",
	&"bhv_summon": "召唤",
}
# 形状轴：behavior_params.shape 缺省时各行为的默认形状。
# aoe/melee/channel 来自 00_总纲 §3 形状通用行（= 代码默认值）；
# projectile→点 / dash→线 来自运行时事实：弹体走碰撞体（点判定）、冲刺走路径半带宽（线状）；
# buff_self / summon 无判定形状，形状集合留空（不被形状轴筛中）。
const BEHAVIOR_SHAPE_DEFAULT := {
	&"bhv_aoe_burst": "圆",
	&"bhv_melee_swing": "扇",
	&"bhv_channel": "线",
	&"bhv_projectile": "点",
	&"bhv_dash": "线",
}
const SHAPE_NAMES := {
	&"pt": "点", &"circ": "圆", &"ring": "环", &"sec": "扇",
	&"line": "线", &"multi": "多点", &"rect": "矩形",
}
const SHAPE_ORDER := ["点", "圆", "环", "扇", "线", "多点", "矩形"]
const DELIVERY_ORDER := ["飞行", "瞬时", "引导", "位移", "自身", "召唤"]
const TIMING_ORDER := ["单段", "多段", "延迟", "区域"]
const FILTER_ALL := "全部"

var main: SandboxMain = null
var _skills: Array = []        # Array[SkillData]
var _supports: Array = []      # Array[SupportGemData]
var _checks: Array[CheckBox] = []

var _picker: OptionButton = null
var _report: RichTextLabel = null
var _auto_cast_check: CheckBox = null
var _applying := false
var _notice := ""              # 一次性的操作提示（镶嵌被拒 / 换技能自动卸下）

# 三维筛选状态：_visible_skills 是当前过滤后的技能列表（_picker 的下标以它为准）
var _visible_skills: Array = []
var _filter_all: CheckBox = null
var _f_delivery: OptionButton = null
var _f_shape: OptionButton = null
var _f_timing: OptionButton = null


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_skills = GemRegistry.skills()
	_supports = GemRegistry.supports()
	_build_ui()


## 由 SandboxMain 在自身 _ready 后调用（此时槽位已建好）
func bind(p_main: SandboxMain) -> void:
	main = p_main
	if _auto_cast_check != null:
		_auto_cast_check.set_pressed_no_signal(main.auto_cast)
	_sync_from_slot()


# ---------------- UI 构建 ----------------

func _build_ui() -> void:
	var panel := PanelContainer.new()
	panel.anchor_top = 0.0
	panel.anchor_bottom = 1.0
	panel.anchor_left = 0.0
	panel.anchor_right = 0.0
	panel.offset_left = PANEL_LEFT
	panel.offset_right = PANEL_LEFT + PANEL_WIDTH
	panel.offset_top = PANEL_TOP
	panel.offset_bottom = -PANEL_BOTTOM_MARGIN
	panel.add_theme_stylebox_override(&"panel", _panel_style())
	add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override(&"margin_left", 8)
	margin.add_theme_constant_override(&"margin_right", 8)
	margin.add_theme_constant_override(&"margin_top", 8)
	margin.add_theme_constant_override(&"margin_bottom", 8)
	panel.add_child(margin)

	var root := VBoxContainer.new()
	root.add_theme_constant_override(&"separation", 6)
	margin.add_child(root)

	var title_row := HBoxContainer.new()
	title_row.add_theme_constant_override(&"separation", 6)
	root.add_child(title_row)

	var title := Label.new()
	title.text = "装配实验台"
	title.add_theme_font_size_override(&"font_size", 15)
	title_row.add_child(title)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_row.add_child(spacer)

	_auto_cast_check = CheckBox.new()
	_auto_cast_check.text = "每秒自动放技能"
	_auto_cast_check.tooltip_text = "每 %.0f 秒自动施放实验台当前配置（仍走冷却与蓝量门禁）" % SandboxMain.AUTO_CAST_INTERVAL
	_auto_cast_check.add_theme_font_size_override(&"font_size", FONT_SMALL)
	_auto_cast_check.toggled.connect(_on_auto_cast_toggled)
	title_row.add_child(_auto_cast_check)

	# 三维筛选行：全部勾选框 + 投送/形状/时序三个下拉（交集过滤）
	var filter_row := HBoxContainer.new()
	filter_row.add_theme_constant_override(&"separation", 4)
	root.add_child(filter_row)
	_filter_all = CheckBox.new()
	_filter_all.text = "全部"
	_filter_all.button_pressed = true
	_filter_all.add_theme_font_size_override(&"font_size", FONT_SMALL)
	_filter_all.tooltip_text = "勾上 = 不过滤（三个下拉复位为全部）；任一下拉选了具体轴值会自动取消勾选"
	_filter_all.toggled.connect(_on_filter_all_toggled)
	filter_row.add_child(_filter_all)
	_f_delivery = _make_axis_filter(filter_row, "投送", DELIVERY_ORDER)
	_f_shape = _make_axis_filter(filter_row, "形状", SHAPE_ORDER)
	_f_timing = _make_axis_filter(filter_row, "时序", TIMING_ORDER)

	# 技能下拉
	var skill_row := HBoxContainer.new()
	root.add_child(skill_row)
	var skill_label := Label.new()
	skill_label.text = "技能"
	skill_label.add_theme_font_size_override(&"font_size", FONT_SMALL)
	skill_row.add_child(skill_label)
	_picker = OptionButton.new()
	_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_picker.add_theme_font_size_override(&"font_size", FONT_SMALL)
	_picker.item_selected.connect(_on_skill_selected)
	skill_row.add_child(_picker)
	_rebuild_picker()

	# 辅助宝石池（多选）
	var pool_title := Label.new()
	pool_title.text = "辅助宝石池（勾选生效）"
	pool_title.add_theme_font_size_override(&"font_size", FONT_SMALL)
	root.add_child(pool_title)

	var pool_scroll := ScrollContainer.new()
	pool_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	pool_scroll.custom_minimum_size = Vector2(0, 132)
	pool_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(pool_scroll)

	var pool_box := VBoxContainer.new()
	pool_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pool_box.add_theme_constant_override(&"separation", 0)
	pool_scroll.add_child(pool_box)

	for i in _supports.size():
		var sp: SupportGemData = _supports[i]
		var cb := CheckBox.new()
		cb.text = _support_label(sp)
		cb.add_theme_font_size_override(&"font_size", FONT_SMALL)
		cb.toggled.connect(_on_support_toggled.bind(i))
		pool_box.add_child(cb)
		_checks.append(cb)

	root.add_child(HSeparator.new())

	# 结算报告
	var report_scroll := ScrollContainer.new()
	report_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	report_scroll.custom_minimum_size = Vector2(0, 148)
	report_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(report_scroll)

	_report = RichTextLabel.new()
	_report.bbcode_enabled = true
	_report.fit_content = true
	_report.scroll_active = false
	_report.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_report.add_theme_font_size_override(&"normal_font_size", FONT_SMALL)
	_report.add_theme_font_size_override(&"bold_font_size", FONT_SMALL)
	report_scroll.add_child(_report)

	# 操作按钮
	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override(&"separation", 6)
	root.add_child(buttons)
	var cast_btn := Button.new()
	cast_btn.text = "施放 (Q)"
	cast_btn.pressed.connect(_on_cast_pressed)
	buttons.add_child(cast_btn)
	var clear_btn := Button.new()
	clear_btn.text = "清空辅助"
	clear_btn.pressed.connect(_on_clear_pressed)
	buttons.add_child(clear_btn)


func _panel_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.07, 0.09, 0.92)
	sb.set_corner_radius_all(6)
	sb.set_border_width_all(1)
	sb.border_color = Color(1.0, 1.0, 1.0, 0.12)
	return sb


# ---------------- 三维筛选（交集：各轴同时满足才显示） ----------------

func _make_axis_filter(row: HBoxContainer, label_text: String, values: Array) -> OptionButton:
	var lb := Label.new()
	lb.text = label_text
	lb.add_theme_font_size_override(&"font_size", FONT_SMALL)
	row.add_child(lb)
	var ob := OptionButton.new()
	ob.add_theme_font_size_override(&"font_size", FONT_SMALL)
	ob.add_item(FILTER_ALL, 0)
	for i in values.size():
		ob.add_item(String(values[i]), i + 1)
	ob.item_selected.connect(_on_axis_filter_changed)
	row.add_child(ob)
	return ob


## 勾上「全部」= 三个下拉复位为「全部」；取消勾选不改动下拉（由下拉自身变化触发）
func _on_filter_all_toggled(pressed: bool) -> void:
	if not pressed:
		return
	_applying = true
	_f_delivery.selected = 0
	_f_shape.selected = 0
	_f_timing.selected = 0
	_applying = false
	_rebuild_picker()


## 任一轴选了具体轴值 → 「全部」勾选框自动取消；三轴交集过滤
func _on_axis_filter_changed(_index: int) -> void:
	if _applying:
		return
	if _filter_all.button_pressed:
		_filter_all.set_pressed_no_signal(false)
	elif _f_delivery.selected == 0 and _f_shape.selected == 0 and _f_timing.selected == 0:
		_filter_all.set_pressed_no_signal(true)
	_rebuild_picker()


## 轴值运行时推导（与契约测试同源，不碰数据文件）。
## 关键：聚合技能**全部伤害段**——多段技能（如 飞行弹+落点爆发）的形状/时序
## 往往在第二段上，只读第一段会把大片轴值错判为无。返回各轴的轴值集合。
func _axis_sets(sk: SkillData) -> Dictionary:
	var delivery := {}
	var shape := {}
	var timing := {}
	for part in sk.parts:
		var p: SkillPart = part
		var d := String(BEHAVIOR_DELIVERY.get(p.behavior_id, ""))
		if d != "":
			delivery[d] = true
		var shape_key: StringName = p.behavior_params.get(&"shape", &"")
		var s := String(SHAPE_NAMES.get(shape_key,
			BEHAVIOR_SHAPE_DEFAULT.get(p.behavior_id, "")))
		if s != "":
			shape[s] = true
		timing[_timing_of(p)] = true
	return {&"delivery": delivery, &"shape": shape, &"timing": timing}


## 时序轴推导：延迟 > 多段 > 区域 > 单段（优先取更特殊的时序特征）
func _timing_of(part: SkillPart) -> String:
	var p: Dictionary = part.behavior_params
	if float(p.get(&"delay", 0.0)) > 0.0:
		return "延迟"
	if int(p.get(&"hit_count", 1)) > 1 or p.has(&"tick_interval"):
		return "多段"
	if p.has(&"zone_duration") or p.has(&"path_zone_duration"):
		return "区域"
	return "单段"


func _passes_filter(sk: SkillData, skip_axis: StringName = &"", skip_val: String = "") -> bool:
	var ax := _axis_sets(sk)
	if not _axis_match(ax[&"delivery"], _f_delivery, skip_axis, &"delivery", skip_val):
		return false
	if not _axis_match(ax[&"shape"], _f_shape, skip_axis, &"shape", skip_val):
		return false
	if not _axis_match(ax[&"timing"], _f_timing, skip_axis, &"timing", skip_val):
		return false
	return true


## 单轴匹配：技能轴值集合命中下拉选项即算匹配；
## skip_axis 非空时用 skip_val 替代该轴的当前选择（用于统计「选它会剩几个」）
func _axis_match(ax_set: Dictionary, ob: OptionButton, skip_axis: StringName, axis: StringName, skip_val: String) -> bool:
	if skip_axis == axis:
		return skip_val == "" or ax_set.has(skip_val)
	if ob.selected > 0 and not ax_set.has(ob.get_item_text(ob.selected)):
		return false
	return true


## 轴值预检：选了必空的轴值直接置灰（与辅助池「不可镶嵌即置灰」同一语义）；
## 当前已选中的项永不置灰，保证能改选
func _refresh_axis_options() -> void:
	_grey_empty_axis(_f_delivery, &"delivery")
	_grey_empty_axis(_f_shape, &"shape")
	_grey_empty_axis(_f_timing, &"timing")


func _grey_empty_axis(ob: OptionButton, axis: StringName) -> void:
	for i in ob.item_count:
		if i == 0 or i == ob.selected:
			ob.set_item_disabled(i, false)
			continue
		var n := 0
		for sk in _skills:
			if _passes_filter(sk as SkillData, axis, ob.get_item_text(i)):
				n += 1
		ob.set_item_disabled(i, n == 0)


## 按当前筛选重建技能下拉；尽量保住原选择，丢了则落到第一项并写回槽 0
func _rebuild_picker() -> void:
	_refresh_axis_options()
	var keep := _current_gem()
	_visible_skills.clear()
	for sk in _skills:
		if _passes_filter(sk as SkillData):
			_visible_skills.append(sk)
	_picker.clear()
	for i in _visible_skills.size():
		var sk: SkillData = _visible_skills[i]
		_picker.add_item("%d  %s" % [i + 1, sk.display_name], i)
	if keep != null:
		for i in _visible_skills.size():
			if (_visible_skills[i] as SkillData).gem_id == keep.gem_id:
				_picker.selected = i
				return
	if _visible_skills.is_empty():
		# 交集无匹配：不清空配置——下拉显示置灰占位，槽 0 保持原技能可继续施放
		_picker.clear()
		_picker.add_item("(无匹配 · 放宽筛选)")
		_picker.set_item_disabled(0, true)
		_picker.selected = 0
		if keep != null:
			_notice = "[color=#d8b45a]筛选无匹配，槽 0 仍为 %s（Q 可继续施放）[/color]" % keep.display_name
			if main != null:
				_report.text = _build_report(keep, _checked_supports())
		return
	_picker.selected = 0
	# 原选择被过滤掉：配置已变为新第一项，需写回槽 0
	if keep != null:
		_notice = "[color=#d8b45a]当前技能不在筛选结果内，已切换到 %s[/color]" % (_visible_skills[0] as SkillData).display_name
		_apply()


func _reset_filters() -> void:
	_applying = true
	_filter_all.set_pressed_no_signal(true)
	_f_delivery.selected = 0
	_f_shape.selected = 0
	_f_timing.selected = 0
	_applying = false


func _support_label(sp: SupportGemData, suffix: String = "") -> String:
	var need := "通用"
	if not sp.require_tags.is_empty():
		need = "需 " + _join_tags(sp.require_tags)
	var label := "%s  ·  %s  ·  耗魔×%s" % [sp.display_name, need, _num(sp.cost_multiplier)]
	if suffix != "":
		label += "  [%s]" % suffix
	return label


## 临时槽位（socket_count 固定为上限，用于准入校验与预览）
func _temp_slot(gem: SkillData, supports: Array) -> SkillSlot:
	var slot := SkillSlot.new()
	slot.slot_index = 0
	slot.active_gem = gem
	slot.active_level = 1
	slot.socket_count = SandboxMain.SOCKET_COUNT
	for s in supports:
		slot.supports.append(s)
	return slot


func _error_reason(chk: AssemblyResult, sp: SupportGemData) -> String:
	match chk.error_code:
		AssemblyResult.ErrorCode.ERR_NO_SOCKET:
			return "孔位已满"
		AssemblyResult.ErrorCode.ERR_CONFLICT:
			return "与已选辅助互斥"
		AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT:
			if chk.error_support_id == sp.support_id:
				return "与技能不兼容"
			return "与已选辅助不兼容"
		_:
			return "不可镶嵌"


# ---------------- 交互 ----------------

func _on_skill_selected(_index: int) -> void:
	_drop_invalid_after_skill_change()
	_apply()


## 换技能后，已勾但不再合法的辅助会被移除（等价 PoE2：非法组合不允许存在）
func _drop_invalid_after_skill_change() -> void:
	var gem := _current_gem()
	if gem == null:
		return
	var removed := PackedStringArray()
	for _round in 12:
		var picked := _checked_supports()
		var chk := SocketGraph.assemble_cached(_temp_slot(gem, picked))
		if chk.ok:
			break
		var bad_id := StringName(chk.error_support_id)
		var hit := false
		_applying = true
		for i in _checks.size():
			if not _checks[i].button_pressed:
				continue
			if (_supports[i] as SupportGemData).support_id == bad_id:
				_checks[i].button_pressed = false
				removed.append((_supports[i] as SupportGemData).display_name)
				hit = true
				break
		_applying = false
		if not hit:
			break
	if not removed.is_empty():
		_notice = "[color=#ff8f8f]换技能后自动卸下：%s（不再兼容）[/color]" % "、".join(removed)


func _on_support_toggled(pressed: bool, index: int) -> void:
	if _applying:
		return
	if pressed:
		var gem := _current_gem()
		if gem != null:
			# 用「除自己以外」的已选集合做准入判定（此刻按钮已是按下状态）
			var others: Array = []
			for i in _checks.size():
				if i != index and _checks[i].button_pressed:
					others.append(_supports[i])
			var sp: SupportGemData = _supports[index]
			var chk := SocketGraph.socket_check(_temp_slot(gem, others), sp)
			if not chk.ok:
				_applying = true
				_checks[index].button_pressed = false
				_applying = false
				_notice = "[color=#ff8f8f]%s 无法镶嵌：%s[/color]" % [sp.display_name, _error_reason(chk, sp)]
				_apply()
				return
	_notice = ""
	_apply()


func _on_cast_pressed() -> void:
	if main != null:
		main.try_cast(0)


func _current_gem() -> SkillData:
	var idx := _picker.selected
	if idx < 0 or idx >= _visible_skills.size():
		return null
	return _visible_skills[idx]


func _checked_supports() -> Array:
	var picked: Array = []
	for i in _checks.size():
		if _checks[i].button_pressed:
			picked.append(_supports[i])
	return picked


## 单独装配某个辅助是否兼容（用于失败时区分「不兼容」与「被连坐」）
func _single_ok(gem: SkillData, sp: SupportGemData) -> bool:
	var slot := SkillSlot.new()
	slot.active_gem = gem
	slot.supports.append(sp)
	return SocketGraph.assemble_cached(slot).ok


## 剔除问题辅助：循环移除「单独不兼容」与「互斥报告」的勾选项，直到装配成功
## 说明：正常路径下不可达（准入层已拦住非法组合），保留用于"外部导入的非法配置"兜底。
func _on_prune_pressed() -> void:
	if main == null or _applying:
		return
	for _round in 10:
		var gem := _current_gem()
		var picked := _checked_supports()
		if gem == null or _evaluate(gem, picked)[&"ok"]:
			break
		var bad_id := StringName(_evaluate(gem, picked)[&"error_support"])
		var removed := false
		_applying = true
		for i in _checks.size():
			if not _checks[i].button_pressed:
				continue
			var sp: SupportGemData = _supports[i]
			if sp.support_id == bad_id or not _single_ok(gem, sp):
				_checks[i].button_pressed = false
				removed = true
		_applying = false
		if not removed:
			break
	_apply()


func _on_clear_pressed() -> void:
	_applying = true
	for cb in _checks:
		cb.button_pressed = false
	_applying = false
	_notice = ""
	_apply()


## 自动施法开关（勾选即生效，取消即停）
func _on_auto_cast_toggled(on: bool) -> void:
	if main != null:
		main.set_auto_cast(on)


## 按 PoE2 语义刷新可镶嵌状态：非法/满孔的未勾选项直接置灰禁用
func _refresh_availability() -> void:
	var gem := _current_gem()
	if gem == null:
		return
	var picked := _checked_supports()
	var probe := _temp_slot(gem, picked)
	var full := picked.size() >= SandboxMain.SOCKET_COUNT
	for i in _checks.size():
		var cb: CheckBox = _checks[i]
		var sp: SupportGemData = _supports[i]
		if cb.button_pressed:
			cb.disabled = false
			cb.text = _support_label(sp)
			continue
		if full:
			cb.disabled = true
			cb.text = _support_label(sp, "孔位已满")
			continue
		var chk := SocketGraph.socket_check(probe, sp)
		cb.disabled = not chk.ok
		cb.text = _support_label(sp, "" if chk.ok else _error_reason(chk, sp))


## 用槽 0 当前状态回填 UI（初次绑定时调用）
func _sync_from_slot() -> void:
	if main == null:
		return
	var slot := main.slot_bar.get_slot(0)
	if slot == null or slot.active_gem == null:
		return
	_applying = true
	var gem_id: StringName = slot.active_gem.gem_id
	var found := -1
	for i in _visible_skills.size():
		if (_visible_skills[i] as SkillData).gem_id == gem_id:
			found = i
			break
	_applying = false
	if found < 0:
		# 目标技能被筛选掉了：复位筛选后再找一次（必然命中）
		_reset_filters()
		_rebuild_picker()
		for i in _visible_skills.size():
			if (_visible_skills[i] as SkillData).gem_id == gem_id:
				found = i
				break
	_picker.selected = found
	for i in _supports.size():
		var sid: StringName = (_supports[i] as SupportGemData).support_id
		var on := false
		for s in slot.supports:
			if (s as SupportGemData).support_id == sid:
				on = true
				break
		_checks[i].button_pressed = on
	_applying = false
	_apply()


# ---------------- 应用 + 结算 ----------------

func _apply() -> void:
	if _applying or main == null:
		return
	var gem := _current_gem()
	if gem == null:
		return
	var picked := _checked_supports()
	main.apply_lab_loadout(gem, picked)
	_report.text = _build_report(gem, picked)
	_refresh_availability()


## 预览结算：装配 → 注入词缀 → 施法计划（与 SandboxMain.try_cast 同序，纯预览不落盘）
func _evaluate(gem: SkillData, supports: Array) -> Dictionary:
	var slot := _temp_slot(gem, supports)

	var asm := SocketGraph.assemble_cached(slot)
	var out := {
		&"ok": asm.ok,
		&"error_code": asm.error_code,
		&"error_support": asm.error_support_id,
		&"cost_mult": asm.cost_multiplier,
		&"tags": asm.effective_tags,
		&"mods": asm.modifiers,
		&"cost": CostCalculator.compute_cost(gem, asm.cost_multiplier, 1.0),
		&"plans": [],
	}
	if asm.ok:
		var stats := StatsComponent.new()
		stats.add_modifiers(asm.modifiers, &"lab_preview")
		out[&"plans"] = SkillExecutor.cast(gem, 1, stats, [], asm.behavior_overrides)
		stats.remove_by_source(&"lab_preview")
	return out


func _build_report(gem: SkillData, picked: Array) -> String:
	var base := _evaluate(gem, [])
	var cur := _evaluate(gem, picked)
	var lines := PackedStringArray()

	if _notice != "":
		lines.append(_notice)

	lines.append("[b][color=#9ecbff]%s[/color][/b]  [color=#7a8798]%s[/color]"
		% [gem.display_name, _join_tags(gem.tags)])

	if cur[&"ok"]:
		lines.append("[color=#8fd18f]✓ 装配成功[/color]  孔位 %d/%d  耗魔 %s → %s（×%s）" % [
			picked.size(), SandboxMain.SOCKET_COUNT,
			_num(base[&"cost"]), _num(cur[&"cost"]), _num(cur[&"cost_mult"]),
		])
	else:
		var reason := _error_text(int(cur[&"error_code"]))
		var bad := _find_support(cur[&"error_support"])
		var detail := ""
		if bad != null:
			detail = "（%s：需 %s）" % [bad.display_name, _join_tags(bad.require_tags)]
		lines.append("[color=#ff8f8f]✗ 装配失败 %s[/color]%s" % [reason, detail])
		lines.append("[color=#8a97a8]整组不生效（G7 兜底）；正常操作不会走到这里，非法项已置灰[/color]")

	# 逐项状态：✓ 生效 / ✗ 问题源 / ○ 本身可用但被整组失败拖累
	if not picked.is_empty():
		var marks := PackedStringArray()
		for s in picked:
			var sp: SupportGemData = s
			if cur[&"ok"]:
				marks.append("[color=#8fd18f]✓ 生效[/color] %s" % sp.display_name)
			elif sp.support_id == StringName(cur[&"error_support"]):
				var why := "不兼容" if int(cur[&"error_code"]) \
						== AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT else "互斥"
				marks.append("[color=#ff8f8f]✗ %s（%s，拖累整组）[/color]" % [sp.display_name, why])
			elif _single_ok(gem, sp):
				marks.append("[color=#d8b45a]○ %s（本身兼容，被整组失败拖累）[/color]" % sp.display_name)
			else:
				marks.append("[color=#ff8f8f]✗ %s（不兼容）[/color]" % sp.display_name)
		lines.append("逐项 " + "\n逐项 ".join(marks))
		if not cur[&"ok"]:
			lines.append("[color=#8a97a8]整组失败 = 所有辅助都不生效；点「剔除问题辅助」自动移除[/color]")

	# 伤害与参数差异（只在装配成功时有意义）
	if cur[&"ok"]:
		var bp := _first_plan(base)
		var cp := _first_plan(cur)
		if cp.is_empty():
			lines.append("[color=#d8b45a]该技能无伤害段（增益/召唤类）[/color]")
		else:
			var be: Dictionary = bp.get(&"elements", {})
			var ce: Dictionary = cp.get(&"elements", {})
			var keys := {}
			for k in be:
				keys[k] = true
			for k in ce:
				keys[k] = true
			var dmg := PackedStringArray()
			for k in keys:
				dmg.append("%s %s" % [String(k), _arrow(float(be.get(k, 0.0)), float(ce.get(k, 0.0)))])
			lines.append("伤害 " + " · ".join(dmg))

			var bparams: Dictionary = bp.get(&"params", {})
			var cparams: Dictionary = cp.get(&"params", {})
			var diffs := PackedStringArray()
			for k in cparams:
				if HIDDEN_PARAMS.has(k):
					continue
				var cv = cparams[k]
				if not (cv is float or cv is int):
					continue
				var bv := float(bparams.get(k, 0.0))
				var cf := float(cv)
				if absf(bv - cf) > 0.0001:
					diffs.append("%s %s" % [_param_name(k), _arrow(bv, cf)])
			if diffs.is_empty():
				lines.append("[color=#8a97a8]行为参数无变化[/color]")
			else:
				lines.append("参数 " + " · ".join(diffs))

			var ba := float(bp.get(&"area_mult", 1.0))
			var ca := float(cp.get(&"area_mult", 1.0))
			var bd := float(bp.get(&"duration_mult", 1.0))
			var cd := float(cp.get(&"duration_mult", 1.0))
			# 命名注意：不能叫 scale —— Control 基类已有同名属性（SHADOWED_BASE_CLASS）
			var mult_lines := PackedStringArray()
			if absf(ba - ca) > 0.0001:
				mult_lines.append("范围倍率 %s" % _arrow(ba, ca))
			if absf(bd - cd) > 0.0001:
				mult_lines.append("持续倍率 %s" % _arrow(bd, cd))
			if not mult_lines.is_empty():
				lines.append("倍率 " + " · ".join(mult_lines))

		if not cur[&"mods"].is_empty():
			var ms := PackedStringArray()
			for m in cur[&"mods"]:
				ms.append("%s%s%s" % [String(m.stat), _op_text(m.op), _num(m.value)])
			lines.append("词缀 " + " · ".join(ms))

	lines.append("[color=#6f7c8c]已写入槽 0 —— 按 Q 实放 / 勾选自动施法持续开火；不可镶嵌的辅助已置灰（PoE2 前置拦截）[/color]")
	return "\n".join(lines)


func _first_plan(res: Dictionary) -> Dictionary:
	var plans: Array = res[&"plans"]
	if plans.is_empty():
		return {}
	return plans[0]


func _find_support(sid: StringName) -> SupportGemData:
	for s in _supports:
		if (s as SupportGemData).support_id == sid:
			return s
	return null


# ---------------- 文本工具 ----------------

func _error_text(code: int) -> String:
	match code:
		AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT:
			return "· 不兼容"
		AssemblyResult.ErrorCode.ERR_CONFLICT:
			return "· 辅助互斥"
		AssemblyResult.ErrorCode.ERR_NO_ACTIVE_GEM:
			return "· 缺少主动宝石"
		AssemblyResult.ErrorCode.ERR_MULTIPLE_ACTIVE:
			return "· 组内多个主动宝石"
		_:
			return ""


func _arrow(before: float, after: float) -> String:
	if absf(before - after) < 0.0001:
		return _num(before)
	var col := "#8fd18f" if after > before else "#ff8f8f"
	return "%s→[color=%s]%s[/color]" % [_num(before), col, _num(after)]


func _num(v: float) -> String:
	if absf(v - round(v)) < 0.0001:
		return str(int(round(v)))
	return "%.2f" % v


func _op_text(op: int) -> String:
	match op:
		StatModifier.Op.FLAT_ADD:
			return " +"
		StatModifier.Op.INCREASED:
			return " +%"
		StatModifier.Op.MORE:
			return " ×%"
		_:
			return " "


func _param_name(key: StringName) -> String:
	return PARAM_NAMES.get(key, String(key))


func _join_tags(tags: Array) -> String:
	var out := PackedStringArray()
	for t in tags:
		out.append(String(t))
	return " · ".join(out)
