## 《巴别回路》主流程：9:16 竖屏状态机
## main_city → hero_select → battle ⇄ (event|shop|canonize) → … → settle → totem/main_city
## 全部界面代码构建（无美术资源，色块+粗描边风格）；meta 存档走 BabelSave（与单局分离）。
class_name BabelMain
extends Control

const STATE_MAIN_CITY: String = "main_city"
const STATE_HERO_SELECT: String = "hero_select"
const STATE_BATTLE: String = "battle"
const STATE_EVENT: String = "event"
const STATE_SHOP: String = "shop"
const STATE_CANONIZE: String = "canonize"
const STATE_SETTLE: String = "settle"
const STATE_TOTEM: String = "totem"

## 合法状态迁移表（headless 测试用）
const VALID_TRANSITIONS: Dictionary = {
	"main_city": ["hero_select", "totem"],
	"hero_select": ["battle", "main_city"],
	"battle": ["event", "shop", "canonize", "settle"],
	"event": ["battle", "shop", "canonize", "settle"],
	"shop": ["battle", "canonize", "settle"],
	"canonize": ["battle", "settle", "shop"],
	"settle": ["main_city", "totem"],
	"totem": ["main_city"],
}
## MVP 组合词条卡规格（480×270 比例）
const MVP_CARD_SIZE: Vector2 = Vector2(480, 270)
const TEAM_MAX: int = 3
## 残片→香火换算系数（期望单局 60 香火口径）# PLACEHOLDER
const SHARD_TO_INCENSE: float = 0.4
## 战间回复比例 # PLACEHOLDER
const INTER_BATTLE_HEAL: float = 0.3

## ---------- 视觉常量（HTML 风格，仅表现层） ----------
## 页面底色 = 战场深藏青
const COLOR_PAGE: Color = Color("131c2c")
## 按钮深蓝底 / 主行动金色
const COLOR_BTN: Color = Color("2a3a52")
const COLOR_BTN_PRIMARY: Color = Color("e8b33c")
## 卡片底色（比页面亮一档）
const COLOR_CARD: Color = Color("162234")

## 调试截图模式（--shot / BABEL_SHOT_DIR）
var shot_mode: bool = false
var shot_dir: String = ""
var shot_idx: int = 0

## 状态切换完成（state: String）
signal state_changed(state: String)

var cfg: BabelCfgData = BabelCfgData.load_default()
var save: BabelSave = BabelSave.new()
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
## meta 持久化段：{"incense": int, "totems": Array[String], "unlocked_chiefs": Array[String]}
var meta_data: Dictionary = {}
## 当前状态
var state: String = STATE_MAIN_CITY
## 单局会话数据
var run: Dictionary = {}
## 事件页当前事件
var pending_event: Dictionary = {}
## 商店当前货架
var shop_stock: Array = []
var shop_rerolls: int = 0
## 封圣三选一缓存
var canonize_choices: Array = []
## 场景引用
var battle_scene: BabelBattle = null
var screens: Dictionary = {}
var hero_picked: Array[String] = []
var hero_checks: Array[Button] = []
var hero_box: VBoxContainer = null
var lbl_hero_hint: Label = null
var lbl_main_incense: Label = null
var lbl_event_name: Label = null
var lbl_event_desc: Label = null
var shop_box: VBoxContainer = null
var lbl_shop_shards: Label = null
var canon_box: HBoxContainer = null
var lbl_settle: Label = null
var mvp_card: Panel = null
var lbl_mvp: Label = null
var totem_box: VBoxContainer = null
var lbl_totem_incense: Label = null


func _ready() -> void:
	rng.randomize()
	meta_data = save.load_meta()
	_ensure_meta()
	_build_screens()
	_show_state(STATE_MAIN_CITY)
	_check_shot_mode()


## ---------- 调试截图钩子：--shot 或 BABEL_SHOT_DIR 时自动进战斗截图后退出 ----------
func _check_shot_mode() -> void:
	var want_shot: bool = false
	var dir: String = OS.get_environment("BABEL_SHOT_DIR")
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var next_is_dir: bool = false
	for a: String in args:
		if next_is_dir:
			dir = a
			next_is_dir = false
		elif a == "--shot":
			want_shot = true
		elif a.begins_with("--babel-shot-dir="):
			dir = a.trim_prefix("--babel-shot-dir=")
			want_shot = true
		elif a == "--babel-shot-dir":
			next_is_dir = true
	if OS.get_environment("BABEL_SHOT_DIR") != "":
		want_shot = true
	if not want_shot:
		return
	shot_mode = true
	shot_dir = dir
	if shot_dir == "":
		shot_dir = OS.get_user_data_dir() + "/shots"
	_auto_enter_battle()


func _auto_enter_battle() -> void:
	# 自动选 3 人（默认解锁优先，不足补前 3 名）
	var team: Array[String] = []
	var unlocked: Array[String] = []
	var locked: Array[String] = []
	for c: Variant in cfg.chiefs():
		if c is Dictionary:
			var cd: Dictionary = c as Dictionary
			var cid: String = str(cd.get("id", ""))
			if bool(cd.get("unlocked_default", false)) or (meta_data.get("unlocked_chiefs", []) as Array).has(cid):
				unlocked.append(cid)
			else:
				locked.append(cid)
	for cid2: String in unlocked:
		team.append(cid2)
	for cid3: String in locked:
		if team.size() < 3:
			team.append(cid3)
	# 上限 3 人
	while team.size() > 3:
		team.remove_at(team.size() - 1)
	start_run(team)
	_refresh_hero_select()
	_enter_battle()
	_shot_loop()


func _shot_loop() -> void:
	var dir: String = shot_dir
	var err: int = DirAccess.make_dir_recursive_absolute(dir)
	if err != OK:
		push_warning("[BabelMain] 截图目录创建失败: " + dir)
	for i: int in range(5):
		await get_tree().create_timer(2.0).timeout
		await RenderingServer.frame_post_draw
		var img: Image = get_viewport().get_texture().get_image()
		if img != null:
			img.save_png(dir + "/shot_%d.png" % [shot_idx])
			shot_idx += 1
	get_tree().quit()


func _ensure_meta() -> void:
	if not (meta_data.get("incense") is float or meta_data.get("incense") is int):
		meta_data["incense"] = 0
	if not (meta_data.get("totems") is Array):
		meta_data["totems"] = []
	if not (meta_data.get("unlocked_chiefs") is Array):
		meta_data["unlocked_chiefs"] = []


## ---------- 纯逻辑（可 headless 测试） ----------

static func is_transition_valid(from: String, to: String) -> bool:
	var nexts: Variant = VALID_TRANSITIONS.get(from, [])
	if nexts is Array:
		return (nexts as Array).has(to)
	return false


func switch_state(to: String) -> bool:
	if not is_transition_valid(state, to):
		push_warning("[BabelMain] 非法状态迁移: " + state + " -> " + to)
		return false
	state = to
	_show_state(to)
	state_changed.emit(to)
	return true


## 开新局：读图腾开局规则注入
func start_run(team: Array[String]) -> void:
	var totem_rules: Dictionary = BabelTotemLogic.start_rules(meta_data.get("totems", []) as Array, cfg.totems())
	run = {
		"team": team,
		"relics": [] as Array,
		"chapter_idx": 0,
		"battles_done": 0,
		"event_done": false,
		"shop_done": false,
		"canon_done": false,
		"shards": 0,
		"kills": 0,
		"incense_add": 0.0,
		"team_shield": 0.0,
		"team_dmg_add": 0.0,
		"cd_penalty_s": 0.0,
		"cd_penalty_targets": 1,
		"boss_stacks": 0.0,
		"boss_mod": {},
		"price_mul": BabelTotemLogic.rule_val(totem_rules, "shop_price_mul", 1.0),
		"mvp_line": "",
		"settle_incense": 0,
	}
	# 图腾开局赠送圣物
	for rarity: String in BabelTotemLogic.start_relics(totem_rules):
		var relic: Dictionary = BabelRelicLogic.roll_relic(rng, cfg.relics(), rarity)
		if not relic.is_empty():
			(run["relics"] as Array).append(str(relic.get("id", "")))


## 单局香火结算（残片→香火 + 事件加成 + 圣物 battle_end 加成），并写 meta
func settle_run(result: Dictionary) -> Dictionary:
	var shards: int = int(result.get("shards", 0))
	var incense: int = int(round(float(shards) * SHARD_TO_INCENSE)) + int(round(float(run.get("incense_add", 0.0))))
	var relic_dicts: Array = _relic_dicts()
	for trig: Dictionary in BabelRelicLogic.triggers_for(relic_dicts, "battle_end"):
		incense += int(round(float((trig.get("params", {}) as Dictionary).get("incense_add", 0.0))))
	meta_data["incense"] = int(meta_data.get("incense", 0)) + incense
	save.save_meta(meta_data)
	save.clear_run()
	run["settle_incense"] = incense
	# MVP 组合词条（白话一句话，推荐默认 = 第 1 条组合词条）
	var lines: Array[String] = BabelRelicLogic.combo_lines(_team_dicts(), relic_dicts)
	run["mvp_line"] = lines[0] if lines.size() > 0 else "-empty-"
	return {"incense": incense, "shards": shards, "kills": int(result.get("kills", 0))}


func _team_dicts() -> Array:
	var out: Array = []
	var chiefs: Array = cfg.chiefs()
	for cid: Variant in run.get("team", []) as Array:
		for c: Variant in chiefs:
			if c is Dictionary and str((c as Dictionary).get("id", "")) == str(cid):
				out.append(c as Dictionary)
	return out


func _relic_dicts() -> Array:
	var out: Array = []
	var rmap: Dictionary = cfg.relic_map()
	for rid: Variant in run.get("relics", []) as Array:
		var rd: Variant = rmap.get(str(rid), null)
		if rd is Dictionary:
			out.append(rd as Dictionary)
	return out


## 战斗结算后的推进：返回下一状态名（event/shop/canonize/settle/battle）
func next_after_battle(result: Dictionary) -> String:
	var chs: Array = cfg.chapters()
	var idx: int = int(run.get("chapter_idx", 0))
	if idx >= chs.size():
		return STATE_SETTLE
	var ch: Dictionary = chs[idx] as Dictionary
	run["shards"] = int(run.get("shards", 0)) + int(result.get("shards", 0))
	run["kills"] = int(run.get("kills", 0)) + int(result.get("kills", 0))
	# 渎神叠层：每章战斗 +1（Boss 伤害成长载体）# PLACEHOLDER
	run["boss_stacks"] = float(run.get("boss_stacks", 0.0)) + 1.0
	run["battles_done"] = int(run.get("battles_done", 0)) + 1
	var battles_total: int = int(ch.get("battles", 1))
	var more_battles: bool = int(run.get("battles_done", 0)) < battles_total
	if not bool(run.get("event_done", false)) and bool(ch.get("has_event", false)):
		return STATE_EVENT
	if more_battles:
		return STATE_BATTLE
	if not bool(run.get("shop_done", false)) and bool(ch.get("has_shop", false)):
		return STATE_SHOP
	if not bool(run.get("canon_done", false)) and bool(ch.get("has_canonization", false)):
		return STATE_CANONIZE
	run["event_done"] = false
	run["shop_done"] = false
	run["canon_done"] = false
	run["battles_done"] = 0
	run["chapter_idx"] = idx + 1
	if int(run["chapter_idx"]) >= chs.size():
		return STATE_SETTLE
	return STATE_BATTLE


## 是否还有本章战斗未打
func has_more_battles() -> bool:
	var chs: Array = cfg.chapters()
	var idx: int = int(run.get("chapter_idx", 0))
	if idx >= chs.size():
		return false
	var ch: Dictionary = chs[idx] as Dictionary
	return int(run.get("battles_done", 0)) < int(ch.get("battles", 1))


## ---------- 界面构建 ----------

func _build_screens() -> void:
	for k: String in [STATE_MAIN_CITY, STATE_HERO_SELECT, STATE_EVENT, STATE_SHOP, STATE_CANONIZE, STATE_SETTLE, STATE_TOTEM]:
		var scr: Control = Control.new()
		scr.name = "Scr_" + k
		scr.set_anchors_preset(Control.PRESET_FULL_RECT)
		scr.visible = false
		scr.draw.connect(_draw_screen_bg.bind(scr))
		add_child(scr)
		screens[k] = scr
	_build_main_city()
	_build_hero_select()
	_build_event()
	_build_shop()
	_build_canonize()
	_build_settle()
	_build_totem()


func _mk_label(parent: Control, pos: Vector2, text: String, size: int = 18) -> Label:
	var lbl: Label = Label.new()
	lbl.position = pos
	lbl.text = text
	lbl.add_theme_font_size_override("font_size", size)
	parent.add_child(lbl)
	return lbl


func _mk_button(parent: Control, pos: Vector2, sz: Vector2, text: String, cb: Callable) -> Button:
	var b: Button = Button.new()
	b.position = pos
	b.size = sz
	b.text = text
	b.pressed.connect(cb)
	_style_button(b, false)
	parent.add_child(b)
	return b


## HTML 风格按钮：深蓝圆角胶囊白字；primary = 金底深色字
func _style_button(b: Button, primary: bool) -> void:
	var bg: Color = COLOR_BTN_PRIMARY if primary else COLOR_BTN
	var fg: Color = Color("1a1408") if primary else Color.WHITE
	var normal: StyleBoxFlat = StyleBoxFlat.new()
	normal.bg_color = bg
	normal.set_corner_radius_all(8)
	normal.content_margin_left = 14.0
	normal.content_margin_right = 14.0
	normal.content_margin_top = 6.0
	normal.content_margin_bottom = 6.0
	var hover: StyleBoxFlat = normal.duplicate() as StyleBoxFlat
	hover.bg_color = bg.lightened(0.1)
	var pressed: StyleBoxFlat = normal.duplicate() as StyleBoxFlat
	pressed.bg_color = bg.darkened(0.12)
	var disabled: StyleBoxFlat = normal.duplicate() as StyleBoxFlat
	disabled.bg_color = Color(bg.darkened(0.4), 0.6)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("disabled", disabled)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("font_color", fg)
	b.add_theme_color_override("font_hover_color", fg)
	b.add_theme_color_override("font_pressed_color", fg)
	b.add_theme_color_override("font_disabled_color", Color(fg, 0.5))
	b.add_theme_color_override("font_focus_color", fg)


## 页面底色（深藏青）
func _draw_screen_bg(scr: Control) -> void:
	scr.draw_rect(Rect2(Vector2.ZERO, scr.size), COLOR_PAGE)


func _build_main_city() -> void:
	var scr: Control = screens[STATE_MAIN_CITY] as Control
	var title: Label = _mk_label(scr, Vector2(190, 180), "巴别回路", 48)
	title.add_theme_color_override("font_color", Color("c63d2f"))
	_mk_label(scr, Vector2(240, 250), "神话拼图割草 · v1.2 即时制", 16)
	lbl_main_incense = _mk_label(scr, Vector2(280, 330), "", 20)
	var b_start: Button = _mk_button(scr, Vector2(260, 420), Vector2(200, 60), "开始游戏", _on_start_pressed)
	_style_button(b_start, true)
	_mk_button(scr, Vector2(260, 500), Vector2(200, 60), "失落之城 · 图腾", func() -> void: switch_state(STATE_TOTEM))
	_mk_button(scr, Vector2(260, 580), Vector2(200, 60), "渎神教义树（占位）", func() -> void: pass)
	_mk_button(scr, Vector2(260, 660), Vector2(200, 48), "重置存档", _on_reset_save)


func _draw_main_bg() -> void:
	var scr: Control = screens.get(STATE_MAIN_CITY, null) as Control
	if scr != null:
		scr.draw_rect(Rect2(Vector2.ZERO, scr.size), COLOR_PAGE)


func _on_reset_save() -> void:
	meta_data = {"incense": 0, "totems": [], "unlocked_chiefs": []}
	save.save_meta(meta_data)
	_refresh_main_city()


func _refresh_main_city() -> void:
	if lbl_main_incense != null:
		lbl_main_incense.text = "香火：%d" % [int(meta_data.get("incense", 0))]


func _on_start_pressed() -> void:
	_refresh_hero_select()
	switch_state(STATE_HERO_SELECT)


func _build_hero_select() -> void:
	var scr: Control = screens[STATE_HERO_SELECT] as Control
	_mk_label(scr, Vector2(140, 40), "选人（1~3 人，第 1 位勾选者为队长）", 22)
	lbl_hero_hint = _mk_label(scr, Vector2(60, 92), "", 16)
	hero_box = VBoxContainer.new()
	hero_box.position = Vector2(50, 130)
	hero_box.custom_minimum_size = Vector2(620, 980)
	hero_box.add_theme_constant_override("separation", 14)
	scr.add_child(hero_box)
	var b_go: Button = _mk_button(scr, Vector2(120, 1150), Vector2(220, 70), "出战！", _on_team_confirm)
	_style_button(b_go, true)
	_mk_button(scr, Vector2(400, 1150), Vector2(200, 70), "返回", func() -> void: switch_state(STATE_MAIN_CITY))


func _refresh_hero_select() -> void:
	for c: Node in hero_box.get_children():
		c.queue_free()
	hero_checks.clear()
	hero_picked.clear()
	var chiefs: Array = cfg.chiefs()
	var unlocked: Array = meta_data.get("unlocked_chiefs", []) as Array
	for c: Variant in chiefs:
		if not (c is Dictionary):
			continue
		var cd: Dictionary = c as Dictionary
		var cid: String = str(cd.get("id", ""))
		var is_unlocked: bool = bool(cd.get("unlocked_default", false)) or unlocked.has(cid)
		# 竖排大卡：名字 + 神权一句话，勾选态金框
		var cb: Button = Button.new()
		cb.toggle_mode = true
		cb.disabled = not is_unlocked
		cb.text = "%s  %s\n%s" % [
			str(cd.get("name_cn", "?")),
			"已解锁" if is_unlocked else "未解锁",
			str((cd.get("passive", {}) as Dictionary).get("desc_cn", "")),
		]
		cb.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var card: StyleBoxFlat = StyleBoxFlat.new()
		card.bg_color = COLOR_CARD if is_unlocked else Color(COLOR_CARD.darkened(0.3), 0.6)
		card.set_corner_radius_all(10)
		card.set_border_width_all(2)
		card.border_color = Color(1, 1, 1, 0.15) if is_unlocked else Color(1, 1, 1, 0.06)
		card.content_margin_left = 16.0
		card.content_margin_top = 10.0
		card.content_margin_bottom = 10.0
		card.content_margin_right = 16.0
		var card_on: StyleBoxFlat = card.duplicate() as StyleBoxFlat
		card_on.border_color = COLOR_BTN_PRIMARY
		card_on.bg_color = COLOR_CARD.lightened(0.06)
		var card_hover: StyleBoxFlat = card.duplicate() as StyleBoxFlat
		card_hover.border_color = Color(COLOR_BTN_PRIMARY, 0.5)
		cb.add_theme_stylebox_override("normal", card)
		cb.add_theme_stylebox_override("hover", card_hover)
		cb.add_theme_stylebox_override("pressed", card_on)
		cb.add_theme_stylebox_override("pressed_hover", card_on)
		cb.add_theme_stylebox_override("pressed_focus", card_on)
		cb.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		cb.add_theme_stylebox_override("disabled", card)
		cb.add_theme_color_override("font_color", Color.WHITE if is_unlocked else Color(1, 1, 1, 0.4))
		cb.add_theme_color_override("font_pressed_color", COLOR_BTN_PRIMARY)
		cb.add_theme_color_override("font_hover_color", Color.WHITE)
		cb.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.35))
		cb.add_theme_font_size_override("font_size", 16)
		cb.custom_minimum_size = Vector2(620, 88)
		cb.toggled.connect(_on_hero_toggled.bind(cid))
		hero_checks.append(cb)
		hero_box.add_child(cb)


func _on_hero_toggled(on: bool, cid: String) -> void:
	if on:
		if hero_picked.size() >= TEAM_MAX:
			# 超编：拒绝最后一个勾选（保持前 3 个）
			for i: int in range(hero_checks.size()):
				var cid_i: String = _check_cid(i)
				if cid_i == cid:
					hero_checks[i].set_pressed_no_signal(false)
			return
		hero_picked.append(cid)
	else:
		hero_picked.erase(cid)
	if lbl_hero_hint != null:
		var hint: String = ", ".join(hero_picked)
		var leader: String = hero_picked[0] if hero_picked.size() > 0 else "-"
		lbl_hero_hint.text = "组合提示：%s（队长=%s）" % [hint, leader]


func _check_cid(i: int) -> String:
	# hero_checks 与 chiefs 表同序
	var chiefs: Array = cfg.chiefs()
	if i >= 0 and i < chiefs.size() and chiefs[i] is Dictionary:
		return str((chiefs[i] as Dictionary).get("id", ""))
	return ""


func _on_team_confirm() -> void:
	if hero_picked.is_empty():
		return
	start_run(hero_picked.duplicate() as Array[String])
	_enter_battle()


## ---------- 战斗 ----------

func _enter_battle() -> void:
	if battle_scene != null:
		battle_scene.queue_free()
		battle_scene = null
	_show_state(STATE_BATTLE)
	state = STATE_BATTLE
	state_changed.emit(STATE_BATTLE)
	battle_scene = (load("res://mods/jes-babel/scenes/babel_battle.tscn") as PackedScene).instantiate() as BabelBattle
	add_child(battle_scene)
	var chs: Array = cfg.chapters()
	var idx: int = int(run.get("chapter_idx", 0))
	var ch: Dictionary = chs[idx] as Dictionary if idx < chs.size() else {}
	battle_scene.setup(cfg, ch, _build_team_dicts(), BabelTotemLogic.start_rules(meta_data.get("totems", []) as Array, cfg.totems()), run.get("relics", []) as Array, run.get("boss_mod", {}) as Dictionary, {
		"team_shield": float(run.get("team_shield", 0.0)),
		"team_dmg_add": float(run.get("team_dmg_add", 0.0)),
		"cd_penalty_s": float(run.get("cd_penalty_s", 0.0)),
		"cd_penalty_targets": int(run.get("cd_penalty_targets", 1)),
		"boss_stacks": float(run.get("boss_stacks", 0.0)),
		"dps_mul": 1.0,
		"shard_mul": 1.0,
	})
	battle_scene.battle_finished.connect(_on_battle_finished)


func _build_team_dicts() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var chiefs: Array = cfg.chiefs()
	var smap: Dictionary = cfg.skill_map()
	for cid: Variant in run.get("team", []) as Array:
		for c: Variant in chiefs:
			if c is Dictionary and str((c as Dictionary).get("id", "")) == str(cid):
				var cd: Dictionary = c as Dictionary
				out.append({
					"id": str(cid),
					"name_cn": str(cd.get("name_cn", "?")),
					"passive": cd.get("passive", {}),
					"skill_a": smap.get(str(cd.get("skill_a", "")), {}),
					"skill_b": smap.get(str(cd.get("skill_b", "")), {}),
				})
	return out


func _on_battle_finished(result: Dictionary) -> void:
	if str(result.get("winner", "enemy")) == "enemy":
		settle_run(result)
		switch_state(STATE_SETTLE)
		_refresh_settle()
		return
	var next: String = next_after_battle(result)
	match next:
		STATE_EVENT:
			_open_event()
		STATE_SHOP:
			_open_shop()
		STATE_CANONIZE:
			_open_canonize()
		STATE_SETTLE:
			settle_run(result)
			switch_state(STATE_SETTLE)
			_refresh_settle()
		_:
			_enter_battle()


## ---------- 事件页（渎神/敬神二选一） ----------

func _build_event() -> void:
	var scr: Control = screens[STATE_EVENT] as Control
	lbl_event_name = _mk_label(scr, Vector2(200, 200), "", 30)
	lbl_event_desc = _mk_label(scr, Vector2(80, 320), "", 18)
	lbl_event_desc.custom_minimum_size = Vector2(560, 300)
	lbl_event_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_mk_button(scr, Vector2(120, 700), Vector2(220, 90), "敬神", func() -> void: _on_event_pick("devotion"))
	_mk_button(scr, Vector2(400, 700), Vector2(220, 90), "渎神", func() -> void: _on_event_pick("blasphemy"))


func _open_event() -> void:
	var idx: int = int(run.get("chapter_idx", 0))
	var ev: Dictionary = {}
	for e: Variant in cfg.events():
		if e is Dictionary and int((e as Dictionary).get("chapter", 1)) == idx + 1:
			ev = e as Dictionary
			break
	if ev.is_empty() and cfg.events().size() > 0:
		ev = cfg.events()[0] as Dictionary
	pending_event = ev
	var dev: Dictionary = ev.get("devotion", {}) as Dictionary
	var bla: Dictionary = ev.get("blasphemy", {}) as Dictionary
	lbl_event_name.text = str(ev.get("name_cn", "无名事件"))
	lbl_event_desc.text = "敬神：%s\n\n渎神：%s\n（代价：每次开战随机 1 人技能 CD 翻倍 10s）" % [
		str(dev.get("desc_cn", "")), str(bla.get("desc_cn", "")),
	]
	switch_state(STATE_EVENT)


func _on_event_pick(track: String) -> void:
	var res: Dictionary = BabelEventLogic.apply_choice(pending_event, track, run)
	run["boss_mod"] = BabelEventLogic.normalize_boss_mod(res.get("boss_mod", {}) as Dictionary)
	run["event_done"] = true
	_after_interstitial()


## 章内间隙页之后的推进
func _after_interstitial() -> void:
	var chs: Array = cfg.chapters()
	var idx: int = int(run.get("chapter_idx", 0))
	if idx >= chs.size():
		switch_state(STATE_SETTLE)
		_refresh_settle()
		return
	var ch: Dictionary = chs[idx] as Dictionary
	if has_more_battles():
		_enter_battle()
	elif not bool(run.get("shop_done", false)) and bool(ch.get("has_shop", false)):
		_open_shop()
	elif not bool(run.get("canon_done", false)) and bool(ch.get("has_canonization", false)):
		_open_canonize()
	else:
		_advance_chapter()


## ---------- 商店页（残片货币，推荐默认） ----------

func _build_shop() -> void:
	var scr: Control = screens[STATE_SHOP] as Control
	_mk_label(scr, Vector2(220, 80), "神殿商店（货币：神话残片）", 22)
	lbl_shop_shards = _mk_label(scr, Vector2(300, 130), "", 18)
	shop_box = VBoxContainer.new()
	shop_box.position = Vector2(60, 180)
	shop_box.custom_minimum_size = Vector2(600, 640)
	scr.add_child(shop_box)
	_mk_button(scr, Vector2(80, 950), Vector2(260, 70), "刷新货架", _on_shop_reroll)
	_mk_button(scr, Vector2(400, 950), Vector2(240, 70), "离开商店", _on_shop_leave)


func _open_shop() -> void:
	shop_rerolls = 0
	_roll_shop()
	switch_state(STATE_SHOP)


func _roll_shop() -> void:
	shop_stock = BabelShopLogic.roll_stock(rng, cfg.shop(), cfg.relics(), float(run.get("price_mul", 1.0)), 3)
	_refresh_shop()


func _on_shop_reroll() -> void:
	var cost: int = BabelShopLogic.reroll_cost(cfg.shop(), shop_rerolls, float(run.get("price_mul", 1.0)))
	if int(run.get("shards", 0)) < cost:
		return
	run["shards"] = int(run.get("shards", 0)) - cost
	shop_rerolls += 1
	_roll_shop()


func _refresh_shop() -> void:
	if shop_box == null:
		return
	for c: Node in shop_box.get_children():
		c.queue_free()
	lbl_shop_shards.text = "残片：%d" % [int(run.get("shards", 0))]
	var shop_cfg: Dictionary = cfg.shop()
	var up_cost: int = BabelShopLogic.skill_upgrade_cost(shop_cfg, float(run.get("price_mul", 1.0)))
	var up_btn: Button = Button.new()
	up_btn.text = "升级技能（全队伤害 +2）— %d 残片" % [up_cost]
	up_btn.custom_minimum_size = Vector2(600, 60)
	up_btn.pressed.connect(_on_skill_upgrade.bind(up_cost))
	shop_box.add_child(up_btn)
	for i: int in range(shop_stock.size()):
		var offer: Dictionary = shop_stock[i] as Dictionary
		var relic: Dictionary = offer.get("relic", {}) as Dictionary
		var b: Button = Button.new()
		b.text = "[%s] %s — %d 残片\n%s" % [
			str(offer.get("rarity", "?")), str(relic.get("name_cn", "缺货")),
			int(offer.get("price", 0)), str(relic.get("desc_cn", "")),
		]
		b.custom_minimum_size = Vector2(600, 80)
		b.pressed.connect(_on_buy.bind(i))
		shop_box.add_child(b)


func _on_skill_upgrade(cost: int) -> void:
	if int(run.get("shards", 0)) >= cost:
		run["shards"] = int(run.get("shards", 0)) - cost
		run["team_dmg_add"] = float(run.get("team_dmg_add", 0.0)) + 2.0
		_refresh_shop()


func _on_buy(i: int) -> void:
	if i < 0 or i >= shop_stock.size():
		return
	var offer: Dictionary = shop_stock[i] as Dictionary
	var price: int = int(offer.get("price", 999999))
	if int(run.get("shards", 0)) < price:
		return
	run["shards"] = int(run.get("shards", 0)) - price
	var relic: Dictionary = offer.get("relic", {}) as Dictionary
	if not relic.is_empty():
		(run["relics"] as Array).append(str(relic.get("id", "")))
	shop_stock.remove_at(i)
	_refresh_shop()


func _on_shop_leave() -> void:
	run["shop_done"] = true
	_after_interstitial()


## ---------- 封圣抉择（3 选 1 圣物卡） ----------

func _build_canonize() -> void:
	var scr: Control = screens[STATE_CANONIZE] as Control
	_mk_label(scr, Vector2(230, 120), "封圣抉择：三选一圣物", 24)
	canon_box = HBoxContainer.new()
	canon_box.position = Vector2(30, 300)
	canon_box.custom_minimum_size = Vector2(660, 300)
	canon_box.add_theme_constant_override("separation", 10)
	scr.add_child(canon_box)


func _open_canonize() -> void:
	canonize_choices = []
	var table: Array = cfg.relics()
	for i: int in range(3):
		var rarity: String = ["white", "blue", "gold"][mini(i, 2)]
		canonize_choices.append(BabelRelicLogic.roll_relic(rng, table, rarity))
	for c: Node in canon_box.get_children():
		c.queue_free()
	for i: int in range(canonize_choices.size()):
		var relic: Dictionary = canonize_choices[i] as Dictionary
		var b: Button = Button.new()
		b.text = "[%s]\n%s\n%s" % [str(relic.get("rarity", "?")), str(relic.get("name_cn", "?")), str(relic.get("desc_cn", ""))]
		b.custom_minimum_size = Vector2(210, 260)
		b.pressed.connect(_on_canon_pick.bind(i))
		canon_box.add_child(b)
	switch_state(STATE_CANONIZE)


func _on_canon_pick(i: int) -> void:
	if i < 0 or i >= canonize_choices.size():
		return
	var relic: Dictionary = canonize_choices[i] as Dictionary
	if not relic.is_empty():
		(run["relics"] as Array).append(str(relic.get("id", "")))
	run["canon_done"] = true
	_after_interstitial()


## ---------- 章节推进 ----------

func _advance_chapter() -> void:
	run["event_done"] = false
	run["shop_done"] = false
	run["canon_done"] = false
	run["battles_done"] = 0
	run["chapter_idx"] = int(run.get("chapter_idx", 0)) + 1
	if int(run.get("chapter_idx", 0)) >= cfg.chapters().size():
		settle_run({"shards": int(run.get("shards", 0)), "kills": int(run.get("kills", 0))})
		switch_state(STATE_SETTLE)
		_refresh_settle()
	else:
		_enter_battle()


## ---------- 结算页 ----------

func _build_settle() -> void:
	var scr: Control = screens[STATE_SETTLE] as Control
	_mk_label(scr, Vector2(280, 100), "结算", 32)
	lbl_settle = _mk_label(scr, Vector2(80, 180), "", 18)
	lbl_settle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_settle.custom_minimum_size = Vector2(560, 200)
	mvp_card = Panel.new()
	mvp_card.position = Vector2(120, 420)
	mvp_card.size = MVP_CARD_SIZE
	var sb: StyleBoxFlat = StyleBoxFlat.new()
	sb.bg_color = COLOR_CARD
	sb.border_color = Color("e8b33c")
	sb.set_border_width_all(4)
	mvp_card.add_theme_stylebox_override("panel", sb)
	scr.add_child(mvp_card)
	lbl_mvp = _mk_label(mvp_card, Vector2(20, 20), "", 18)
	lbl_mvp.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl_mvp.custom_minimum_size = Vector2(440, 220)
	_mk_button(scr, Vector2(120, 780), Vector2(220, 70), "返回主城", func() -> void:
		switch_state(STATE_MAIN_CITY)
		_refresh_main_city())
	_mk_button(scr, Vector2(400, 780), Vector2(220, 70), "失落之城 · 图腾", func() -> void: switch_state(STATE_TOTEM))


func _refresh_settle() -> void:
	lbl_settle.text = "击杀 %d　残片 %d　获得香火 %d\n队伍：%s" % [
		int(run.get("kills", 0)), int(run.get("shards", 0)), int(run.get("settle_incense", 0)),
		", ".join(_team_names()),
	]
	lbl_mvp.text = "本局 MVP 组合\n%s\n\n圣物：%s" % [str(run.get("mvp_line", "-")), ", ".join(_relic_names())]


func _team_names() -> Array[String]:
	var out: Array[String] = []
	for c: Dictionary in _team_dicts():
		out.append(str(c.get("name_cn", "?")))
	return out


func _relic_names() -> Array[String]:
	var out: Array[String] = []
	var rmap: Dictionary = cfg.relic_map()
	for rid: Variant in run.get("relics", []) as Array:
		var rd: Variant = rmap.get(str(rid), null)
		if rd is Dictionary:
			out.append(str((rd as Dictionary).get("name_cn", "?")))
	return out


## ---------- 图腾页（失落之城 meta） ----------

func _build_totem() -> void:
	var scr: Control = screens[STATE_TOTEM] as Control
	lbl_totem_incense = _mk_label(scr, Vector2(280, 60), "", 20)
	totem_box = VBoxContainer.new()
	totem_box.position = Vector2(30, 120)
	totem_box.custom_minimum_size = Vector2(660, 950)
	scr.add_child(totem_box)
	_mk_button(scr, Vector2(260, 1150), Vector2(200, 70), "返回主城", func() -> void: switch_state(STATE_MAIN_CITY))


func _refresh_totem() -> void:
	if totem_box == null:
		return
	for c: Node in totem_box.get_children():
		c.queue_free()
	lbl_totem_incense.text = "香火：%d" % [int(meta_data.get("incense", 0))]
	var owned: Array = meta_data.get("totems", []) as Array
	for t: Variant in cfg.totems():
		if not (t is Dictionary):
			continue
		var td: Dictionary = t as Dictionary
		var tid: String = str(td.get("id", ""))
		var is_owned: bool = owned.has(tid)
		var b: Button = Button.new()
		b.text = "%s [%s] %d 香火\n%s" % [
			str(td.get("name_cn", "?")), "已购" if is_owned else "未购",
			int(td.get("cost", 30)), str(td.get("desc_cn", "")),
		]
		b.custom_minimum_size = Vector2(660, 84)
		b.disabled = is_owned or not BabelTotemLogic.can_buy(td, int(meta_data.get("incense", 0)), owned)
		b.pressed.connect(_on_buy_totem.bind(td))
		totem_box.add_child(b)


func _on_buy_totem(t: Dictionary) -> void:
	var owned: Array = meta_data.get("totems", []) as Array
	if not BabelTotemLogic.can_buy(t, int(meta_data.get("incense", 0)), owned):
		return
	meta_data["incense"] = int(meta_data.get("incense", 0)) - int(t.get("cost", 30))
	owned.append(str(t.get("id", "")))
	meta_data["totems"] = owned
	save.save_meta(meta_data)
	_refresh_totem()


## ---------- 状态显示 ----------

func _show_state(to: String) -> void:
	for k: String in screens.keys():
		(screens[k] as Control).visible = (k == to)
	if battle_scene != null:
		battle_scene.visible = (to == STATE_BATTLE)
		battle_scene.process_mode = Node.PROCESS_MODE_INHERIT if to == STATE_BATTLE else Node.PROCESS_MODE_DISABLED
	if to == STATE_MAIN_CITY:
		_refresh_main_city()
	if to == STATE_TOTEM:
		_refresh_totem()
