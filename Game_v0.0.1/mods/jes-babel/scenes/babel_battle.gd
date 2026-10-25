## 《巴别回路》即时制战斗场景（v1.2 吸血鬼幸存者like）
## 竖屏上半屏战场（镜头跟随队长）/下半屏信息面板；连续大地图 3 屏宽 + 64px 地形格；
## WASD 移动 + 鼠标瞄准；队友 AI 跟随 + 自动攻击；Tab 切人 CD2s；流场寻路敌潮；
## 波次按 srpg_chapters.waves；升级三选一；神罚倒计时；Boss 突变；圣物/补偿全生效。
## 数据全部由 setup 注入（BabelCfgData 防御读取），本场景可独立运行（未 setup 时用默认演示局）。
class_name BabelBattle
extends Node2D

## 战斗结束（result: {"winner": "player"|"enemy", "kills": int, "shards": int, "time_s": float}）
signal battle_finished(result: Dictionary)

const COLOR_ENEMY: Color = Color("c63d2f")
const COLOR_ALLY: Color = Color("2a9d8f")
const COLOR_RELIC_GOLD: Color = Color("e8b33c")
const COLOR_NEON: Color = Color("35e0d8")
const COLOR_SAND: Color = Color("d8b98a")
const COLOR_WATER: Color = Color("3a86ff")
const COLOR_FIRE: Color = Color("e76f51")
const COLOR_COVER: Color = Color("6c757d")
const COLOR_ALTAR: Color = Color("35e0d8")
const COLOR_BG: Color = Color("2b2620")

const VIEW_W: float = 720.0
const VIEW_H: float = 1280.0
const PLAY_H: float = 720.0
const FLOAT_LIFE: float = 1.2
const CRIT_CHANCE: float = 0.15 # PLACEHOLDER
const CRIT_MUL: float = 1.5
const DANMAKU_INTERVAL: float = 3.0
const FLOW_RECALC: float = 0.2

## 竖屏世界：宽 = map_width_screens 屏
var world_w: float = 2160.0
var world_h: float = 720.0
var tile_px: float = 64.0
var switch_cd_max: float = 2.0
var punish_cfg: Dictionary = {"start_s": 75.0, "tick_s": 10.0, "hp_loss_ratio": 0.10}
var xp_anchors: Array = [1.0, 25.0, 60.0, 100.0]
var facing_cfg: Dictionary = {"front_mul": 0.7, "back_mul": 1.3, "side_mul": 1.0}
var shard_xp: float = 1.0

var cfg: BabelCfgData = null
var terrain: BabelTerrain = BabelTerrain.new()
var flow: FlowField = FlowField.new()
var rng: RandomNumberGenerator = RandomNumberGenerator.new()

## 本局修饰（来自 main/run）：dps_mul/hp_mul/shard_mul/team_dmg_add/incense_add/price_mul 等
var run_mods: Dictionary = {}
## 圣物字典列表
var relics: Array = []
## Boss 突变 {"type","params"}
var boss_mod: Dictionary = {"type": "", "params": {}}
## 章节数据
var chapter: Dictionary = {}

var heroes: Array[Dictionary] = []
var enemies: Array[Dictionary] = []
var bullets: Array[Dictionary] = []
var shards: Array[Dictionary] = []
var telegraphs: Array[Dictionary] = []

var leader_idx: int = 0
var switch_cd: float = 0.0
var battle_t: float = 0.0
var punish_last_due: float = 0.0
var kills: int = 0
var shards_total: int = 0
var xp: float = 0.0
var level: int = 1
var state: String = "fight"
var flow_t: float = 0.0
var danmaku_t: float = 0.0
var danmaku_lines: PackedStringArray = PackedStringArray()
## 波次推进
var wave_idx: int = 0
var wave_state: String = "spawning"
var spawn_queue: Array[Dictionary] = []
var spawn_timer: float = 0.0
var clear_pause: float = 0.0
var boss_spawned: bool = false
var boss: Dictionary = {}
var boss_half_done: bool = false
var boss_heal_t: float = 0.0
## 神权触发数据
var bone_shield_cap: float = 6.0 # PLACEHOLDER

var cam: Camera2D = null
var hud: CanvasLayer = null
var world_node: Node2D = null
var terrain_node: Node2D = null
var unit_node: Node2D = null
var portraits_box: HBoxContainer = null
var lbl_timer: Label = null
var bar_timer: ProgressBar = null
var bar_xp: ProgressBar = null
var lbl_combo: Label = null
var lbl_danmaku: Label = null
var btn_q: Button = null
var btn_e: Button = null
var btn_tab: Button = null
var levelup_box: Control = null


func _ready() -> void:
	rng.randomize()
	if heroes.is_empty():
		_setup_demo()
	if terrain_node == null:
		_build_scene()


## 默认演示局（场景 F6 独立运行口径）
func _setup_demo() -> void:
	var data: BabelCfgData = BabelCfgData.load_default()
	var chiefs: Array = data.chiefs()
	var smap: Dictionary = data.skill_map()
	var team: Array[Dictionary] = []
	for c: Variant in chiefs:
		if c is Dictionary and bool((c as Dictionary).get("unlocked_default", false)):
			var cd: Dictionary = c as Dictionary
			team.append({
				"id": str(cd.get("id", "")),
				"name_cn": str(cd.get("name_cn", "?")),
				"passive": cd.get("passive", {}),
				"skill_a": smap.get(str(cd.get("skill_a", "")), {}),
				"skill_b": smap.get(str(cd.get("skill_b", "")), {}),
			})
	var chs: Array = data.chapters()
	setup(data, chs[0] if chs.size() > 0 else {}, team, {}, [], {"type": "", "params": {}}, {})


## 装配战斗（main 调用）
func setup(p_cfg: BabelCfgData, p_chapter: Dictionary, p_team: Array[Dictionary], start_rules: Dictionary, p_relics: Array, p_boss_mod: Dictionary, p_run_mods: Dictionary) -> void:
	cfg = p_cfg
	chapter = p_chapter
	relics = p_relics
	boss_mod = BabelEventLogic.normalize_boss_mod(p_boss_mod)
	run_mods = p_run_mods
	var rules: Dictionary = cfg.rules()
	var rt: Dictionary = rules.get("realtime", {}) if rules.get("realtime") is Dictionary else {}
	tile_px = float(rt.get("tile_px", 64.0))
	var screens: float = float(rt.get("map_width_screens", 3.0))
	world_w = VIEW_W * screens
	world_h = PLAY_H
	switch_cd_max = float(rt.get("switch_cd", 2.0))
	var comp_cfg: Dictionary = rt.get("compensation", {}) if rt.get("compensation") is Dictionary else {}
	var comp: Dictionary = BabelRules.compensation(p_team.size(), comp_cfg)
	facing_cfg = rules.get("facing", {}) if rules.get("facing") is Dictionary else {}
	xp_anchors = rules.get("xp_anchors", [1.0, 25.0, 60.0, 100.0]) if rules.get("xp_anchors") is Array else [1.0, 25.0, 60.0, 100.0]
	punish_cfg = rules.get("punishment_timer", {}) if rules.get("punishment_timer") is Dictionary else {}
	shard_xp = float(chapter.get("shard_xp", 1.0))
	# 地形：3 屏宽 1 屏高
	terrain.generate(rng, Vector2(world_w, world_h), tile_px, 0.35)
	flow.setup(Vector2(world_w, world_h), tile_px)
	var walls: Array = []
	for c: Vector2i in terrain.cover_cells():
		walls.append(Rect2(Vector2(float(c.x) * tile_px, float(c.y) * tile_px), Vector2(tile_px, tile_px)))
	flow.set_walls(walls)
	# 圣物聚合
	var rmap: Dictionary = cfg.relic_map()
	var relic_dicts: Array = []
	for rid: Variant in relics:
		var rd: Variant = rmap.get(str(rid), null)
		if rd is Dictionary:
			relic_dicts.append(rd as Dictionary)
	var stats: Dictionary = BabelRelicLogic.collect_stats(relic_dicts)
	var team_dmg: float = float(stats.get("team_dmg_add", 0.0)) + float(stats.get("skill_dmg_add", 0.0)) + float(run_mods.get("team_dmg_add", 0.0))
	# 编队
	var start_shield: float = float(run_mods.get("team_shield", 0.0)) + float(start_rules.get("team_start_shield", 0.0)) + float(stats.get("shield_start", 0.0))
	var idx: int = 0
	for t: Dictionary in p_team:
		var base_hp: float = 30.0 + float(stats.get("team_hp_add", 0.0)) + float(start_rules.get("team_hp_add", 0.0)) # PLACEHOLDER 基础HP
		var h: Dictionary = {
			"id": str(t.get("id", "")),
			"name_cn": str(t.get("name_cn", "?")),
			"passive": t.get("passive", {}),
			"skill_a": t.get("skill_a", {}),
			"skill_b": t.get("skill_b", {}),
			"pos": Vector2(200.0 + float(idx) * 60.0, world_h - 140.0),
			"facing": Vector2i(0, -1),
			"hp": base_hp * float(comp["hp_mul"]),
			"max_hp": base_hp * float(comp["hp_mul"]),
			"shield": start_shield,
			"shield_cap": 6.0 + float(stats.get("shield_cap_add", 0.0)),
			"dmg_add": team_dmg,
			"crit_add": float(stats.get("crit_chance_add", 0.0)),
			"mul_add": float(stats.get("dmg_mul_add", 0.0)),
			"cd_reduce": float(stats.get("cd_reduce", 0.0)),
			"cds": {"a": 0.0, "b": 0.0},
			"alive": true,
			"first_hit_left": float(stats.get("first_hit_block", 0.0)),
			"speed": 220.0,
		}
		heroes.append(h)
		idx += 1
	# 图腾开局规则：chief 专属加成 → dmg_add
	for h2: Dictionary in heroes:
		var chief_key: String = str(start_rules.get("chief", ""))
		if chief_key != "" and chief_key == str(h2["id"]):
			h2["dmg_add"] = float(h2["dmg_add"]) + float(start_rules.get("atk_add", 0.0))
			h2["cd_reduce"] = float(h2["cd_reduce"]) + float(start_rules.get("skill_cd_reduce", 0.0))
	# 渎神开战 CD 惩罚（随机 1 人 CD 翻倍 10s）
	if float(run_mods.get("cd_penalty_s", 0.0)) > 0.0:
		var cds_map: Dictionary = {}
		var members: Array = []
		for h3: Dictionary in heroes:
			cds_map[str(h3["id"])] = {"a": float((h3["skill_a"] as Dictionary).get("cd", 4.0))}
			members.append(str(h3["id"]))
		BabelEventLogic.apply_cd_penalty(cds_map, members, int(run_mods.get("cd_penalty_targets", 1)))
		for h4: Dictionary in heroes:
			var pc: Dictionary = cds_map.get(str(h4["id"]), {}) as Dictionary
			h4["cds"]["a"] = float(pc.get("a", 0.0))
	# 敬神即时盾已并入 team_shield
	_build_scene()
	_start_wave(0)


## ---------- 场景构建 ----------

func _build_scene() -> void:
	world_node = Node2D.new()
	world_node.name = "World"
	add_child(world_node)
	terrain_node = Node2D.new()
	terrain_node.name = "Terrain"
	world_node.add_child(terrain_node)
	unit_node = Node2D.new()
	unit_node.name = "Units"
	world_node.add_child(unit_node)
	cam = Camera2D.new()
	cam.name = "Cam"
	cam.position = Vector2(world_w * 0.5, PLAY_H * 0.5)
	add_child(cam)
	cam.make_current()
	hud = CanvasLayer.new()
	hud.name = "Hud"
	add_child(hud)
	_build_hud()
	# 地形/单位绘制挂在本节点 _draw（world_node 空绘制壳，绘制走 self）
	terrain_node.draw.connect(_draw_terrain)
	unit_node.draw.connect(_draw_world)
	set_process(true)


func _build_hud() -> void:
	# 顶部头像血条
	portraits_box = HBoxContainer.new()
	portraits_box.position = Vector2(8, 8)
	portraits_box.add_theme_constant_override("separation", 8)
	hud.add_child(portraits_box)
	_refresh_portraits()
	# 底部信息面板
	var panel: Panel = Panel.new()
	panel.position = Vector2(0, PLAY_H)
	panel.size = Vector2(VIEW_W, VIEW_H - PLAY_H)
	var sb: StyleBoxFlat = StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.07, 0.06, 0.96)
	panel.add_theme_stylebox_override("panel", sb)
	hud.add_child(panel)
	lbl_timer = Label.new()
	lbl_timer.position = Vector2(16, 12)
	lbl_timer.text = ""
	panel.add_child(lbl_timer)
	bar_timer = ProgressBar.new()
	bar_timer.position = Vector2(16, 40)
	bar_timer.size = Vector2(VIEW_W - 32, 16)
	bar_timer.min_value = 0.0
	bar_timer.max_value = float(punish_cfg.get("start_s", 75.0))
	bar_timer.show_percentage = false
	panel.add_child(bar_timer)
	bar_xp = ProgressBar.new()
	bar_xp.position = Vector2(16, 64)
	bar_xp.size = Vector2(VIEW_W - 32, 10)
	bar_xp.min_value = 0.0
	bar_xp.max_value = 1.0
	bar_xp.show_percentage = false
	panel.add_child(bar_xp)
	btn_q = Button.new()
	btn_q.position = Vector2(16, 88)
	btn_q.size = Vector2(150, 64)
	btn_q.pressed.connect(_on_q_pressed)
	panel.add_child(btn_q)
	btn_e = Button.new()
	btn_e.position = Vector2(180, 88)
	btn_e.size = Vector2(150, 64)
	btn_e.pressed.connect(_on_e_pressed)
	panel.add_child(btn_e)
	btn_tab = Button.new()
	btn_tab.position = Vector2(344, 88)
	btn_tab.size = Vector2(150, 64)
	btn_tab.text = "Tab 切人"
	btn_tab.pressed.connect(_on_tab_pressed)
	panel.add_child(btn_tab)
	lbl_danmaku = Label.new()
	lbl_danmaku.position = Vector2(16, 166)
	lbl_danmaku.size = Vector2(VIEW_W - 32, 90)
	panel.add_child(lbl_danmaku)
	lbl_combo = Label.new()
	lbl_combo.position = Vector2(16, 262)
	lbl_combo.size = Vector2(VIEW_W - 32, 280)
	lbl_combo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(lbl_combo)
	var combo_text: Array[String] = BabelRelicLogic.combo_lines(_team_display(), _relic_display())
	lbl_combo.text = "\n".join(combo_text)


func _team_display() -> Array:
	var out: Array = []
	for h: Dictionary in heroes:
		out.append(h)
	return out


func _relic_display() -> Array:
	var rmap: Dictionary = cfg.relic_map() if cfg != null else {}
	var out: Array = []
	for rid: Variant in relics:
		var rd: Variant = rmap.get(str(rid), null)
		if rd is Dictionary:
			out.append(rd as Dictionary)
	return out


func _refresh_portraits() -> void:
	if portraits_box == null:
		return
	for c: Node in portraits_box.get_children():
		c.queue_free()
	for i: int in range(heroes.size()):
		var h: Dictionary = heroes[i]
		var p: Panel = Panel.new()
		p.custom_minimum_size = Vector2(150, 46)
		var sb: StyleBoxFlat = StyleBoxFlat.new()
		sb.bg_color = Color(0.1, 0.1, 0.1, 0.85)
		sb.border_color = COLOR_RELIC_GOLD if i == leader_idx else Color(0.3, 0.3, 0.3)
		sb.set_border_width_all(3 if i == leader_idx else 1)
		p.add_theme_stylebox_override("panel", sb)
		portraits_box.add_child(p)
		var lbl: Label = Label.new()
		lbl.position = Vector2(6, 2)
		lbl.text = str(h.get("name_cn", "?"))
		p.add_child(lbl)
		var bar: ProgressBar = ProgressBar.new()
		bar.position = Vector2(6, 26)
		bar.size = Vector2(138, 12)
		bar.min_value = 0.0
		bar.max_value = 1.0
		bar.value = float(h.get("hp", 0.0)) / maxf(float(h.get("max_hp", 1.0)), 1.0)
		bar.show_percentage = false
		p.add_child(bar)


## ---------- 波次 ----------

func _start_wave(idx: int) -> void:
	wave_idx = idx
	spawn_queue.clear()
	var waves: Variant = chapter.get("waves", [])
	var wave: Dictionary = {}
	if waves is Array and idx < (waves as Array).size():
		wave = (waves as Array)[idx] as Dictionary
	if wave.is_empty():
		wave = _default_wave(idx)
	var interval: float = float(wave.get("spawn_interval_s", 1.0))
	var is_elite: bool = bool(wave.get("elite", false))
	var enemies_cfg: Dictionary = cfg.enemy_map()
	var list: Variant = wave.get("enemies", [])
	if list is Array:
		for e: Variant in (list as Array):
			if not (e is Dictionary):
				continue
			var ed: Dictionary = e as Dictionary
			var eid: String = str(ed.get("enemy_id", ""))
			var count: int = int(ed.get("count", 1))
			var spec: Dictionary = enemies_cfg.get(eid, {}) as Dictionary
			for i: int in range(count):
				spawn_queue.append({"spec": spec, "delay": interval * float(i % 8), "elite": is_elite})
	spawn_timer = 0.0
	clear_pause = 2.0
	wave_state = "spawning"


## 表缺 waves 时的默认波次（防御，推荐默认）
func _default_wave(idx: int) -> Dictionary:
	var hp_rng: Variant = chapter.get("minion_hp", [8, 12])
	var counts: Array = [8, 12, 16]
	return {
		"enemies": [{"enemy_id": "EN01", "count": int(counts[mini(idx, 2)])}],
		"elite": idx == 1,
		"spawn_interval_s": 1.0,
		"_hp_fallback": hp_rng,
	}


## ---------- 主循环（变步长 + 双钳制） ----------

func _process(delta: float) -> void:
	var dt: float = clampf(clampf(delta, 0.0, 0.05), 0.0, 0.05)
	if dt <= 0.0:
		dt = 0.016
	if state == "levelup" or state == "done":
		return
	battle_t += dt
	_update_leader(dt)
	_update_allies(dt)
	_update_flow_and_enemies(dt)
	_update_bullets(dt)
	_update_telegraphs(dt)
	_update_shards()
	_update_waves(dt)
	_update_punish()
	_update_boss_mod(dt)
	_update_hud()
	_update_danmaku(dt)
	if terrain_node != null:
		terrain_node.queue_redraw()
	if unit_node != null:
		unit_node.queue_redraw()


func _leader() -> Dictionary:
	if leader_idx < 0 or leader_idx >= heroes.size():
		return {}
	var h: Dictionary = heroes[leader_idx]
	if not bool(h.get("alive", false)):
		h = _first_alive_hero()
	return h


func _first_alive_hero() -> Dictionary:
	for h: Dictionary in heroes:
		if bool(h.get("alive", false)):
			return h
	return {}


func _update_leader(dt: float) -> void:
	var l: Dictionary = _leader()
	if l.is_empty():
		return
	var dir: Vector2 = Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_W):
		dir.y -= 1.0
	if Input.is_physical_key_pressed(KEY_S):
		dir.y += 1.0
	if Input.is_physical_key_pressed(KEY_A):
		dir.x -= 1.0
	if Input.is_physical_key_pressed(KEY_D):
		dir.x += 1.0
	if dir != Vector2.ZERO:
		var sp: float = float(l.get("speed", 220.0)) * terrain.speed_mul_at(l["pos"], _has_passive(l, "water_speed"))
		l["pos"] = _clamp_world((l["pos"] as Vector2 + dir.normalized() * sp * dt))
		l["facing"] = BabelRules.snap4(dir)
	l["pos"] = terrain.resolve_cover_circle(l["pos"], 18.0)
	switch_cd = maxf(switch_cd - dt, 0.0)
	# 技能 CD 与自动攻击
	for h: Dictionary in heroes:
		if not bool(h.get("alive", false)):
			continue
		var cds: Dictionary = h["cds"] as Dictionary
		cds["a"] = maxf(float(cds.get("a", 0.0)) - dt, 0.0)
		cds["b"] = maxf(float(cds.get("b", 0.0)) - dt, 0.0)
	# 自动攻击：全员 skill_a 循环（Q 为手动瞄准版，自动版打最近敌）
	for h2: Dictionary in heroes:
		if not bool(h2.get("alive", false)):
			continue
		if float((h2["cds"] as Dictionary).get("a", 1.0)) <= 0.0:
			var target: Vector2 = (h2["pos"] as Vector2)
			var near: Dictionary = _nearest_enemy(h2["pos"])
			if not near.is_empty():
				target = near["pos"] as Vector2
			_cast_skill(h2, h2["skill_a"] as Dictionary, target, "a")
	# 地形：火格烧血 / 圣坛回血
	for h3: Dictionary in heroes:
		if not bool(h3.get("alive", false)):
			continue
		var pos: Vector2 = h3["pos"] as Vector2
		var fire: float = terrain.fire_dps_at(pos)
		if fire > 0.0:
			_damage_hero_raw(h3, fire * dt, true)
		elif terrain.type_at(pos) == BabelTerrain.TYPE_ALTAR:
			_heal_hero(h3, 1.0 * dt)


func _has_passive(h: Dictionary, ptype: String) -> bool:
	var p: Variant = h.get("passive", {})
	if p is Dictionary:
		return str((p as Dictionary).get("type", "")) == ptype
	return false


func _update_allies(dt: float) -> void:
	var l: Dictionary = _leader()
	if l.is_empty():
		return
	var lpos: Vector2 = l["pos"] as Vector2
	var lf: Vector2i = l["facing"] as Vector2i
	# 队形位：队长身后左右 45°，间距 1.5 格
	var back: Vector2 = Vector2(-lf) * tile_px * 1.5
	var side: Vector2 = Vector2(-lf.y, lf.x) * tile_px * 1.5 * 0.7071
	var slots: Array[Vector2] = [lpos + back + side, lpos + back - side]
	var slot_i: int = 0
	for i: int in range(heroes.size()):
		if i == leader_idx:
			continue
		var h: Dictionary = heroes[i]
		if not bool(h.get("alive", false)):
			continue
		var goal: Vector2 = slots[mini(slot_i, slots.size() - 1)]
		slot_i += 1
		var pos: Vector2 = h["pos"] as Vector2
		var d: Vector2 = goal - pos
		if d.length() > 8.0:
			var sp2: float = float(h.get("speed", 220.0))
			pos += d.normalized() * minf(sp2 * dt, d.length())
			h["pos"] = _clamp_world(pos)
			h["facing"] = BabelRules.snap4(d)
		h["pos"] = terrain.resolve_cover_circle(h["pos"], 18.0)


func _update_flow_and_enemies(dt: float) -> void:
	flow_t -= dt
	if flow_t <= 0.0:
		flow_t = FLOW_RECALC
		var l: Dictionary = _leader()
		if not l.is_empty():
			flow.recompute(l["pos"] as Vector2)
	for e: Dictionary in enemies:
		if not bool(e.get("alive", false)):
			continue
		var pos: Vector2 = e["pos"] as Vector2
		# 流场寻路追队长；无流场时回退直追最近英雄
		var v: Vector2 = flow.sample(pos)
		if v == Vector2.ZERO:
			var near: Dictionary = _nearest_hero(pos)
			if not near.is_empty():
				v = ((near["pos"] as Vector2) - pos).normalized()
		var sp: float = float(e.get("speed_px", 60.0))
		# 缄默者沉默圈：敌人被沉默时只移动不施技
		var silenced: bool = _is_silenced(e)
		if not silenced:
			pos += v * sp * dt
			e["pos"] = _clamp_world(pos)
			# 分离力（简单 O(n²)，同屏 ≤100 预算内）
			_separate(e)
			e["pos"] = terrain.resolve_cover_circle(e["pos"], float(e.get("radius_px", 16.0)))
			# 分离力（简单 O(n²)，同屏 ≤100 预算内）
			_separate(e)
			# 接触攻击
			e["atk_cd"] = maxf(float(e.get("atk_cd", 0.0)) - dt, 0.0)
			var near_h: Dictionary = _nearest_hero(pos)
			if not near_h.is_empty() and float(e.get("atk_cd", 0.0)) <= 0.0:
				var hd: float = ((near_h["pos"] as Vector2) - pos).length()
				if hd <= float(e.get("radius_px", 16.0)) + 34.0:
					e["atk_cd"] = 1.0
					var atk_dir: Vector2i = BabelRules.snap4((near_h["pos"] as Vector2) - pos)
					_damage_hero(near_h, float(e.get("dmg", 3.0)) * _boss_mul(e), atk_dir)
			_update_trait(e, dt)
		else:
			pos += v * sp * 0.5 * dt
			e["pos"] = _clamp_world(pos)
			e["pos"] = terrain.resolve_cover_circle(e["pos"], float(e.get("radius_px", 16.0)))
	# 清尸（手动过滤保持类型）
	var alive_enemies: Array[Dictionary] = []
	for e2: Dictionary in enemies:
		if bool(e2.get("alive", false)):
			alive_enemies.append(e2)
	enemies = alive_enemies


func _boss_mul(e: Dictionary) -> float:
	if str(e.get("trait", "")) != "boss_stack":
		return 1.0
	var stacks: float = float(e.get("stacks", 0.0))
	return 1.0 + 0.10 * stacks


func _is_silenced(e: Dictionary) -> bool:
	for h: Dictionary in heroes:
		if bool(h.get("alive", false)) and _has_passive(h, "silence_aura"):
			if ((h["pos"] as Vector2) - (e["pos"] as Vector2)).length() <= tile_px * 2.0:
				return true
	return false


func _separate(e: Dictionary) -> void:
	var pos: Vector2 = e["pos"] as Vector2
	var r: float = float(e.get("radius_px", 16.0))
	for o: Dictionary in enemies:
		if o == e or not bool(o.get("alive", false)):
			continue
		var op: Vector2 = o["pos"] as Vector2
		var d: Vector2 = pos - op
		var dist: float = d.length()
		var min_d: float = r + float(o.get("radius_px", 16.0))
		if dist < min_d and dist > 0.001:
			pos += d.normalized() * (min_d - dist) * 0.5
	e["pos"] = _clamp_world(pos)


## 敌人特性 AI（格挡/拉人/红圈预警1s/给盾/Boss叠层）
func _update_trait(e: Dictionary, dt: float) -> void:
	var trait_name: String = str(e.get("trait", "none"))
	var tp: Dictionary = e.get("tparams", {}) as Dictionary
	if trait_name == "none":
		return
	e["trait_t"] = float(e.get("trait_t", float(tp.get("interval_s", 6.0)))) - dt
	if float(e.get("trait_t", 0.0)) > 0.0:
		return
	match trait_name:
		"shield_ally":
			e["trait_t"] = float(tp.get("interval_s", 6.0))
			var n: int = 0
			for o: Dictionary in enemies:
				if bool(o.get("alive", false)) and ((o["pos"] as Vector2) - (e["pos"] as Vector2)).length() <= tile_px * 3.0:
					o["shield"] = minf(float(o.get("shield", 0.0)) + float(tp.get("shield", 2.0)), float(tp.get("cap", 6.0)))
					n += 1
			_push_danmaku("%s 给 %d 名友军 +盾" % [str(e.get("name_cn", "?")), n])
		"aoe_telegraph":
			e["trait_t"] = float(tp.get("interval_s", 8.0))
			var near: Dictionary = _nearest_hero(e["pos"] as Vector2)
			if not near.is_empty():
				telegraphs.append({
					"pos": near["pos"] as Vector2,
					"r": float(tp.get("radius_px", 96.0)),
					"t": 1.0,
					"dmg": float(e.get("damage", 6.0)),
					"src": e,
				})
		"pull":
			e["trait_t"] = float(tp.get("interval_s", 7.0))
			var near2: Dictionary = _nearest_hero(e["pos"] as Vector2)
			if not near2.is_empty() and ((near2["pos"] as Vector2) - (e["pos"] as Vector2)).length() <= 320.0:
				var dir: Vector2 = ((e["pos"] as Vector2) - (near2["pos"] as Vector2)).normalized()
				near2["pos"] = _clamp_world((e["pos"] as Vector2) - dir * 48.0)
				_push_danmaku("%s 拉拽了 %s" % [str(e.get("name_cn", "?")), str(near2.get("name_cn", "?"))])
		"front_block", "boss_stack":
			e["trait_t"] = 999.0
		_:
			e["trait_t"] = 999.0
			push_warning("[BabelBattle] 未知敌人特性: " + trait_name)


func _update_bullets(dt: float) -> void:
	var next_bullets: Array[Dictionary] = []
	for b: Dictionary in bullets:
		var pos: Vector2 = b["pos"] as Vector2
		var vel: Vector2 = b["vel"] as Vector2
		var life: float = float(b.get("life", 2.0)) - dt
		var hit: bool = false
		# substep 碰撞（防高速穿障）
		var steps: int = maxi(int(ceil(vel.length() * dt / 16.0)), 1)
		for s: int in range(steps):
			pos += vel * (dt / float(steps))
			# 掩体阻挡
			if terrain.type_at(pos) == BabelTerrain.TYPE_COVER:
				hit = true
				break
			if b.get("from_player", true):
				for e: Dictionary in enemies:
					if bool(e.get("alive", false)) and ((e["pos"] as Vector2) - pos).length() <= float(e.get("radius_px", 16.0)) + 6.0:
						_damage_enemy(e, float(b.get("dmg", 0.0)), BabelRules.snap4(vel))
						hit = true
						break
			else:
				for h: Dictionary in heroes:
					if bool(h.get("alive", false)) and ((h["pos"] as Vector2) - pos).length() <= 22.0:
						_damage_hero(h, float(b.get("dmg", 0.0)), BabelRules.snap4(vel))
						hit = true
						break
			if hit:
				break
		if not hit and life > 0.0 and pos.x > -32.0 and pos.x < world_w + 32.0 and pos.y > -32.0 and pos.y < world_h + 32.0:
			b["pos"] = pos
			b["life"] = life
			next_bullets.append(b)
	bullets = next_bullets


func _update_telegraphs(dt: float) -> void:
	var next_t: Array[Dictionary] = []
	for tg: Dictionary in telegraphs:
		tg["t"] = float(tg.get("t", 1.0)) - dt
		if float(tg.get("t", 0.0)) <= 0.0:
			var center: Vector2 = tg["pos"] as Vector2
			var r: float = float(tg.get("r", 96.0))
			var dmg: float = float(tg.get("dmg", 6.0))
			for h: Dictionary in heroes:
				if bool(h.get("alive", false)) and ((h["pos"] as Vector2) - center).length() <= r:
					_damage_hero(h, dmg, Vector2i(0, 1))
		else:
			next_t.append(tg)
	telegraphs = next_t


func _update_shards() -> void:
	var next_s: Array[Dictionary] = []
	for s: Dictionary in shards:
		var taken: bool = false
		for h: Dictionary in heroes:
			if bool(h.get("alive", false)) and ((h["pos"] as Vector2) - (s["pos"] as Vector2)).length() <= 28.0:
				taken = true
				break
		if taken:
			_gain_xp(shard_xp)
		else:
			next_s.append(s)
	shards = next_s


func _update_waves(dt: float) -> void:
	if wave_state == "spawning":
		spawn_timer -= dt
		if spawn_timer <= 0.0 and not spawn_queue.is_empty():
			var job: Dictionary = spawn_queue.pop_front() as Dictionary
			_spawn_enemy(job["spec"] as Dictionary, bool(job.get("elite", false)))
			spawn_timer = clampf(float(job.get("delay", 0.5)), 0.1, 3.0)
		if spawn_queue.is_empty():
			wave_state = "clearing"
	elif wave_state == "clearing":
		var alive_n: int = 0
		for e: Dictionary in enemies:
			if bool(e.get("alive", false)):
				alive_n += 1
		if alive_n == 0:
			clear_pause -= dt
			if clear_pause <= 0.0:
				var waves: Variant = chapter.get("waves", [])
				var wave_count: int = (waves as Array).size() if waves is Array else 0
				if wave_idx + 1 < wave_count:
					clear_pause = 2.0
					_start_wave(wave_idx + 1)
				elif not boss_spawned and str(chapter.get("boss_id", "")) != "":
					clear_pause = 5.0
					boss_spawned = true
					_spawn_boss()
				elif not boss_spawned:
					_finish("player")
				# Boss 在场时等待击杀
				if boss_spawned and not boss.is_empty():
					wave_state = "boss"
	elif wave_state == "boss":
		if boss.is_empty() or not bool(boss.get("alive", true)):
			_finish("player")


## Boss 战：半血 AoE（渎神·神怒）/ 周期回血（敬神·圣偿）
func _update_boss_mod(dt: float) -> void:
	if boss.is_empty() or not bool(boss.get("alive", false)):
		return
	var mtype: String = str(boss_mod.get("type", ""))
	var params: Dictionary = boss_mod.get("params", {}) as Dictionary
	if mtype == "divine_wrath" and not boss_half_done:
		if float(boss.get("hp", 1.0)) <= float(boss.get("max_hp", 1.0)) * float(params.get("threshold", 0.5)):
			boss_half_done = true
			var aoe: float = float(params.get("aoe_dmg", 12.0))
			for h: Dictionary in heroes:
				if bool(h.get("alive", false)):
					_damage_hero(h, aoe, Vector2i(0, 1))
			_push_danmaku("神怒降临：全体 %d 点 AoE" % [int(aoe)])
	elif mtype == "holy_repay":
		boss_heal_t -= dt
		if boss_heal_t <= 0.0:
			boss_heal_t = float(params.get("interval_s", 15.0))
			var heal: float = float(boss.get("max_hp", 1.0)) * float(params.get("heal_ratio", 0.05))
			boss["hp"] = minf(float(boss.get("hp", 0.0)) + heal, float(boss.get("max_hp", 1.0)))
			_push_danmaku("圣偿：Boss 回复 %d 点" % [int(heal)])


func _spawn_boss() -> void:
	var enemies_cfg: Dictionary = cfg.enemy_map() if cfg != null else {}
	var spec: Dictionary = enemies_cfg.get(str(chapter.get("boss_id", "")), {}) as Dictionary
	var e: Dictionary = _make_enemy(spec, false)
	e["hp"] = float(chapter.get("boss_hp", float(spec.get("hp", 90.0))))
	e["max_hp"] = e["hp"]
	e["dmg"] = float(chapter.get("boss_damage", float(spec.get("damage", 8.0))))
	e["stacks"] = float(run_mods.get("boss_stacks", 0.0))
	e["pos"] = Vector2(world_w * 0.5, 160.0)
	e["radius_px"] = 40.0
	e["trait"] = str(spec.get("trait", "boss_stack"))
	e["tparams"] = spec.get("trait_params", {}) if spec.get("trait_params") is Dictionary else {}
	e["name_cn"] = str(spec.get("name_cn", "神孽"))
	enemies.append(e)
	boss = e
	_push_danmaku("BOSS 降临：%s" % str(e.get("name_cn", "?")))


func _spawn_enemy(spec: Dictionary, is_elite: bool) -> void:
	var e: Dictionary = _make_enemy(spec, is_elite)
	# 出生点：远离队长的地图边缘
	var l: Dictionary = _leader()
	var lx: float = float((l.get("pos", Vector2(world_w * 0.5, 0.0)) as Vector2).x)
	var side_x: float = 40.0 if lx > world_w * 0.5 else world_w - 40.0
	e["pos"] = Vector2(side_x + rng.randf_range(-40.0, 40.0), rng.randf_range(60.0, world_h - 60.0))
	enemies.append(e)


func _make_enemy(spec: Dictionary, is_elite: bool) -> Dictionary:
	var hp_rng: Variant = chapter.get("minion_hp", [8.0, 12.0])
	var dmg_rng: Variant = chapter.get("minion_damage", [3.0, 4.0])
	var hp: float = _rand_range(hp_rng, 10.0)
	var dmg: float = _rand_range(dmg_rng, 3.0)
	if spec.is_empty():
		hp = _rand_range(hp_rng, 10.0)
		dmg = _rand_range(dmg_rng, 3.0)
	else:
		hp = float(spec.get("hp", hp))
		dmg = float(spec.get("damage", dmg))
	if is_elite:
		hp *= 1.5
		var roll: int = rng.randi_range(0, 2)
		var affix: String = ["迅捷", "坚甲", "自爆"][roll]
		return {
			"id": str(spec.get("id", "EN01")), "name_cn": str(spec.get("name_cn", "泥塑俑")) + "·" + affix,
			"hp": hp, "max_hp": hp, "dmg": dmg, "shield": 4.0 if affix == "坚甲" else 0.0,
			"speed_px": float(spec.get("speed_px", 60.0)) * (1.4 if affix == "迅捷" else 1.0),
			"radius_px": float(spec.get("radius_px", 16.0)),
			"trait": str(spec.get("trait", "none")), "tparams": spec.get("trait_params", {}) if spec.get("trait_params") is Dictionary else {},
			"atk_cd": 0.0, "trait_t": float((spec.get("trait_params", {}) as Dictionary).get("interval_s", 6.0)) if spec.get("trait_params") is Dictionary else 6.0,
			"alive": true, "stacks": 0.0, "elite_affix": affix, "explode": affix == "自爆",
		}
	return {
		"id": str(spec.get("id", "EN01")), "name_cn": str(spec.get("name_cn", "泥塑俑")),
		"hp": hp, "max_hp": hp, "dmg": dmg, "shield": 0.0,
		"speed_px": float(spec.get("speed_px", 60.0)) if not spec.is_empty() else 60.0,
		"radius_px": float(spec.get("radius_px", 16.0)) if not spec.is_empty() else 16.0,
		"trait": str(spec.get("trait", "none")) if not spec.is_empty() else "none",
		"tparams": spec.get("trait_params", {}) if spec.get("trait_params") is Dictionary else {},
		"atk_cd": 0.0, "trait_t": 6.0, "alive": true, "stacks": 0.0, "elite_affix": "", "explode": false,
	}


func _rand_range(arr: Variant, def: float) -> float:
	if arr is Array and (arr as Array).size() >= 2:
		var a: float = float((arr as Array)[0])
		var b: float = float((arr as Array)[1])
		return rng.randf_range(minf(a, b), maxf(a, b))
	return def


## ---------- 技能（形状：cross/circle3/line/projectile/self/dash/swap） ----------

func _cast_skill(h: Dictionary, skill: Dictionary, target: Vector2, slot: String) -> void:
	if skill.is_empty() or not bool(h.get("alive", false)):
		return
	var cds: Dictionary = h["cds"] as Dictionary
	if float(cds.get(slot, 0.0)) > 0.0:
		return
	var cd_base: float = maxf(float(skill.get("cd", 4.0)) - float(h.get("cd_reduce", 0.0)), 0.5)
	cds[slot] = cd_base
	var dmg_base: float = float(skill.get("damage", 0.0)) + float(h.get("dmg_add", 0.0))
	dmg_base *= float(run_mods.get("dps_mul", 1.0))
	var shape: String = str(skill.get("shape", "projectile"))
	var sname: String = str(skill.get("name_cn", "?"))
	_push_danmaku("%s 施放 %s" % [str(h.get("name_cn", "?")), sname])
	var pos: Vector2 = h["pos"] as Vector2
	match shape:
		"projectile":
			var dir: Vector2 = (target - pos).normalized()
			if dir == Vector2.ZERO:
				dir = Vector2(0, -1)
			bullets.append({"pos": pos, "vel": dir * 600.0, "dmg": dmg_base, "from_player": true, "life": 2.0})
		"cross":
			_aoe_damage(h, target, dmg_base, 0.0, tile_px * 2.0, true, false)
		"circle3":
			_aoe_damage(h, target, dmg_base, tile_px * 1.5, 0.0, false, false)
		"line":
			var dir2: Vector2 = (target - pos).normalized()
			if dir2 == Vector2.ZERO:
				dir2 = Vector2(0, -1)
			for d_i: int in range(1, 4):
				var p: Vector2 = pos + dir2 * tile_px * float(d_i)
				_aoe_damage(h, p, dmg_base, tile_px * 0.5, 0.0, false, false)
		"self":
			_aoe_damage(h, pos, dmg_base, tile_px * 1.5, 0.0, false, false)
		"dash":
			var dir3: Vector2 = (target - pos).normalized()
			if dir3 == Vector2.ZERO:
				dir3 = Vector2(0, -1)
			var dest: Vector2 = _clamp_world(pos + dir3 * tile_px * 2.0)
			h["pos"] = dest
			h["facing"] = BabelRules.snap4(dir3)
			_aoe_damage(h, (pos + dest) * 0.5, dmg_base, tile_px * 0.9, 0.0, false, false)
		"swap":
			var ally: Dictionary = _nearest_ally(h)
			if not ally.is_empty():
				var tmp: Vector2 = ally["pos"] as Vector2
				ally["pos"] = pos
				h["pos"] = tmp
				ally["shield"] = minf(float(ally.get("shield", 0.0)) + 5.0, float(ally.get("shield_cap", 6.0)))
				h["shield"] = minf(float(h.get("shield", 0.0)) + 5.0, float(h.get("shield_cap", 6.0)))
		_:
			# 未知形状按 projectile 兜底（防御）
			var dir4: Vector2 = (target - pos).normalized()
			if dir4 == Vector2.ZERO:
				dir4 = Vector2(0, -1)
			bullets.append({"pos": pos, "vel": dir4 * 600.0, "dmg": dmg_base, "from_player": true, "life": 2.0})
	queue_redraw()


## AoE：十字用 half_cross 口径，圆用 radius
func _aoe_damage(h: Dictionary, center: Vector2, dmg: float, radius: float, cross_half: float, is_cross: bool, _unused: bool) -> void:
	for e: Dictionary in enemies:
		if not bool(e.get("alive", false)):
			continue
		var ep: Vector2 = e["pos"] as Vector2
		var in_range: bool = false
		if is_cross:
			in_range = absf(ep.x - center.x) <= cross_half or absf(ep.y - center.y) <= cross_half
		else:
			in_range = (ep - center).length() <= radius
		if in_range:
			_damage_enemy(e, dmg, BabelRules.snap4(ep - center))


## ---------- 伤害结算 ----------

## 对敌伤害：暴击 / 正面格挡 / 护盾 / 死亡掉残片
func _damage_enemy(e: Dictionary, base: float, _atk_dir: Vector2i) -> void:
	var dmg: float = base
	var crit_add: float = 0.0
	var l: Dictionary = _leader()
	if not l.is_empty():
		crit_add = float(l.get("crit_add", 0.0))
	var crit: bool = rng.randf() < (CRIT_CHANCE + crit_add)
	if crit:
		dmg *= CRIT_MUL
	# front_block：正面受击减伤（正面 = 攻击来向与敌人朝向相反；敌人朝向 = 追击方向近似 -y）
	if str(e.get("trait", "")) == "front_block":
		dmg *= float((e.get("tparams", {}) as Dictionary).get("front_mul", 0.5))
	var shield: float = float(e.get("shield", 0.0))
	if shield > 0.0:
		var absorb: float = minf(shield, dmg)
		e["shield"] = shield - absorb
		dmg -= absorb
	if dmg > 0.0:
		e["hp"] = float(e.get("hp", 0.0)) - dmg
		_spawn_float(e["pos"] as Vector2, str(int(round(base))), COLOR_RELIC_GOLD if crit else Color(1, 1, 1))
	if float(e.get("hp", 0.0)) <= 0.0:
		_kill_enemy(e)


func _kill_enemy(e: Dictionary) -> void:
	e["alive"] = false
	kills += 1
	# 拾骨者：击杀供盾
	for h: Dictionary in heroes:
		if bool(h.get("alive", false)) and _has_passive(h, "kill_shield"):
			h["shield"] = minf(float(h.get("shield", 0.0)) + 1.0, bone_shield_cap)
	# 自爆词缀
	if bool(e.get("explode", false)):
		for h2: Dictionary in heroes:
			if bool(h2.get("alive", false)) and ((h2["pos"] as Vector2) - (e["pos"] as Vector2)).length() <= tile_px * 1.5:
				_damage_hero(h2, float(e.get("dmg", 3.0)) * 2.0, Vector2i(0, 1))
	# 掉残片（1~2 枚）
	var n: int = rng.randi_range(1, 2)
	for i: int in range(n):
		shards.append({"pos": (e["pos"] as Vector2) + Vector2(rng.randf_range(-20.0, 20.0), rng.randf_range(-20.0, 20.0))})
	if e == boss:
		boss = {}


## 对英雄伤害：朝向减伤 / 首次受击减免 / 护盾 / 死亡
func _damage_hero(h: Dictionary, base: float, atk_dir: Vector2i) -> void:
	var mul: float = BabelRules.facing_mul(h["facing"] as Vector2i, atk_dir, facing_cfg)
	# 承棺者：侧面也减伤 25%
	if mul > 0.99 and _has_passive(h, "side_guard"):
		mul = 0.75
	var dmg: float = base * mul
	var first_hit: float = float(h.get("first_hit_left", 0.0))
	if first_hit > 0.0:
		dmg = maxf(dmg - first_hit, 0.0)
		h["first_hit_left"] = 0.0
	_damage_hero_raw(h, dmg, false)
	# 焚香者反伤：受击时反弹相邻敌人 2 点
	if dmg > 0.0 and _has_passive(h, "reflect"):
		var near: Dictionary = _nearest_enemy(h["pos"] as Vector2)
		if not near.is_empty() and ((near["pos"] as Vector2) - (h["pos"] as Vector2)).length() <= tile_px * 1.5:
			_damage_enemy(near, 2.0, Vector2i(0, 1))


func _damage_hero_raw(h: Dictionary, dmg: float, ignore_shield: bool) -> void:
	if dmg <= 0.0 or not bool(h.get("alive", false)):
		return
	if not ignore_shield:
		var shield: float = float(h.get("shield", 0.0))
		if shield > 0.0:
			var absorb: float = minf(shield, dmg)
			h["shield"] = shield - absorb
			dmg -= absorb
	h["hp"] = float(h.get("hp", 0.0)) - dmg
	if dmg >= 1.0:
		_spawn_float(h["pos"] as Vector2, str(int(round(dmg))), COLOR_ENEMY)
	if float(h.get("hp", 0.0)) <= 0.0:
		h["alive"] = false
		h["hp"] = 0.0
		_push_danmaku("%s 阵亡" % str(h.get("name_cn", "?")))
		if _first_alive_hero().is_empty():
			_finish("enemy")
		_refresh_portraits()


func _heal_hero(h: Dictionary, amount: float) -> void:
	h["hp"] = minf(float(h.get("hp", 0.0)) + amount, float(h.get("max_hp", 1.0)))


func _update_punish() -> void:
	var ratio: float = BabelRules.punishment_ratio(battle_t, punish_last_due, punish_cfg)
	var due: float = BabelRules.punishment_due_count(battle_t, punish_cfg)
	if ratio > 0.0 and due > punish_last_due:
		punish_last_due = due
		for h: Dictionary in heroes:
			if bool(h.get("alive", false)):
				_damage_hero_raw(h, float(h.get("max_hp", 1.0)) * ratio, true)
		_push_danmaku("神罚：全场掉落 10%% 最大 HP")


## ---------- 经验与升级三选一 ----------

func _gain_xp(amount: float) -> void:
	shards_total += 1
	xp += amount * float(run_mods.get("shard_mul", 1.0))
	var new_level: int = BabelRules.level_int(xp, xp_anchors)
	if new_level > level:
		level = new_level
		_open_levelup()


func _open_levelup() -> void:
	state = "levelup"
	if levelup_box != null:
		levelup_box.queue_free()
	levelup_box = Control.new()
	levelup_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.add_child(levelup_box)
	var panel: Panel = Panel.new()
	panel.position = Vector2(60, 400)
	panel.size = Vector2(600, 360)
	levelup_box.add_child(panel)
	var lbl: Label = Label.new()
	lbl.position = Vector2(16, 12)
	lbl.text = "升级！三选一（Lv.%d）" % [level]
	panel.add_child(lbl)
	var choices: Array[Dictionary] = _roll_choices()
	for i: int in range(choices.size()):
		var b: Button = Button.new()
		b.position = Vector2(16, 50 + i * 96)
		b.size = Vector2(560, 84)
		var c: Dictionary = choices[i]
		b.text = "%s\n%s" % [str(c.get("title", "?")), str(c.get("desc", ""))]
		var ci: int = i
		b.pressed.connect(func() -> void: _pick_choice(choices[ci]))
		panel.add_child(b)


## 三池：技能强化 / 神权强化 / 新圣物
func _roll_choices() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var l: Dictionary = _first_alive_hero()
	# 池 1：技能强化（dmg +25% 或 CD -15%）
	var sk: Dictionary = l.get("skill_a", {}) as Dictionary
	if not sk.is_empty():
		out.append({"pool": "skill", "title": "技能强化：%s" % str(sk.get("name_cn", "?")), "desc": "该技能伤害 +25%（推荐默认）", "apply": "skill_dmg"})
	out.append({"pool": "skill", "title": "技能强化：全队技能", "desc": "技能 CD -10%", "apply": "skill_cd"})
	# 池 2：神权强化
	out.append({"pool": "divine", "title": "神权强化", "desc": "全队伤害 +2（点）", "apply": "divine_dmg"})
	out.append({"pool": "divine", "title": "神权强化", "desc": "全队最大 HP +6 并回满", "apply": "divine_hp"})
	# 池 3：新圣物
	var drop_cfg: Dictionary = {}
	var rules: Dictionary = cfg.rules() if cfg != null else {}
	if rules.get("relic_drop") is Dictionary:
		drop_cfg = rules.get("relic_drop") as Dictionary
	var rarity: String = BabelRules.roll_rarity(rng, drop_cfg)
	var all_relics: Array = cfg.relics() if cfg != null else []
	var relic: Dictionary = BabelRelicLogic.roll_relic(rng, all_relics, rarity)
	out.append({"pool": "relic", "title": "新圣物（%s）" % rarity, "desc": str(relic.get("name_cn", "?")) + "：" + str(relic.get("desc_cn", "")), "apply": "relic", "relic_id": str(relic.get("id", ""))})
	# 抽 3 个
	out.shuffle()
	var picked: Array[Dictionary] = []
	for i: int in range(mini(3, out.size())):
		picked.append(out[i])
	return picked


func _pick_choice(c: Dictionary) -> void:
	match str(c.get("apply", "")):
		"skill_dmg":
			for h: Dictionary in heroes:
				h["dmg_add"] = float(h.get("dmg_add", 0.0)) + 2.0
		"skill_cd":
			for h: Dictionary in heroes:
				h["cd_reduce"] = float(h.get("cd_reduce", 0.0)) + 0.4
		"divine_dmg":
			for h: Dictionary in heroes:
				h["dmg_add"] = float(h.get("dmg_add", 0.0)) + 2.0
		"divine_hp":
			for h: Dictionary in heroes:
				h["max_hp"] = float(h.get("max_hp", 1.0)) + 6.0
				h["hp"] = float(h["max_hp"])
		"relic":
			relics.append(str(c.get("relic_id", "")))
		_:
			push_warning("[BabelBattle] 未知升级选项")
	if levelup_box != null:
		levelup_box.queue_free()
		levelup_box = null
	state = "fight"


## ---------- 交互（Q/E/Tab） ----------

func _on_q_pressed() -> void:
	var l: Dictionary = _leader()
	if l.is_empty():
		return
	var target: Vector2 = get_global_mouse_position()
	_cast_skill(l, l["skill_a"] as Dictionary, target, "a")


func _on_e_pressed() -> void:
	var l: Dictionary = _leader()
	if l.is_empty():
		return
	var near: Dictionary = _nearest_enemy(l["pos"] as Vector2)
	var target: Vector2 = (near.get("pos", l["pos"]) as Vector2) if not near.is_empty() else get_global_mouse_position()
	_cast_skill(l, l["skill_b"] as Dictionary, target, "b")


func _on_tab_pressed() -> void:
	_switch_leader()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and (event as InputEventKey).pressed:
		var k: int = (event as InputEventKey).keycode
		if k == KEY_TAB:
			_switch_leader()
		elif k == KEY_Q:
			_on_q_pressed()
		elif k == KEY_E:
			_on_e_pressed()


func _switch_leader() -> void:
	if switch_cd > 0.0:
		return
	switch_cd = switch_cd_max
	# 轮换到下一名存活者
	for i: int in range(1, heroes.size() + 1):
		var ni: int = (leader_idx + i) % heroes.size()
		if bool(heroes[ni].get("alive", false)):
			leader_idx = ni
			break
	_refresh_portraits()


## ---------- 工具 ----------

func _clamp_world(p: Vector2) -> Vector2:
	return Vector2(clampf(p.x, 20.0, world_w - 20.0), clampf(p.y, 20.0, world_h - 20.0))


func _nearest_enemy(from: Vector2) -> Dictionary:
	var best: Dictionary = {}
	var best_d: float = 999999.0
	for e: Dictionary in enemies:
		if not bool(e.get("alive", false)):
			continue
		var d: float = ((e["pos"] as Vector2) - from).length()
		if d < best_d:
			best_d = d
			best = e
	return best


func _nearest_hero(from: Vector2) -> Dictionary:
	var best: Dictionary = {}
	var best_d: float = 999999.0
	for h: Dictionary in heroes:
		if not bool(h.get("alive", false)):
			continue
		var d: float = ((h["pos"] as Vector2) - from).length()
		if d < best_d:
			best_d = d
			best = h
	return best


func _nearest_ally(h: Dictionary) -> Dictionary:
	for o: Dictionary in heroes:
		if o != h and bool(o.get("alive", false)):
			return o
	return {}


func _update_danmaku(dt: float) -> void:
	danmaku_t -= dt
	if danmaku_t <= 0.0:
		danmaku_t = DANMAKU_INTERVAL
		if danmaku_lines.size() > 0:
			lbl_danmaku.text = danmaku_lines[danmaku_lines.size() - 1]


func _push_danmaku(line: String) -> void:
	danmaku_lines.append(line)
	while danmaku_lines.size() > 6:
		danmaku_lines.remove_at(0)
	if lbl_danmaku != null:
		lbl_danmaku.text = line


func _update_hud() -> void:
	if lbl_timer != null:
		var punish_left: float = maxf(float(punish_cfg.get("start_s", 75.0)) - battle_t, 0.0)
		if punish_left > 0.0:
			lbl_timer.text = "%s 战斗 %ds（神罚 %ds）" % [str(chapter.get("name_cn", "?")), int(battle_t), int(punish_left)]
			lbl_timer.add_theme_color_override("font_color", Color.WHITE)
		else:
			lbl_timer.text = "%s 神罚进行中！每 %ds 掉 10%% 最大HP" % [str(chapter.get("name_cn", "?")), int(float(punish_cfg.get("tick_s", 10.0)))]
			lbl_timer.add_theme_color_override("font_color", COLOR_ENEMY)
	if bar_timer != null:
		bar_timer.value = minf(battle_t, float(punish_cfg.get("start_s", 75.0)))
	if bar_xp != null:
		bar_xp.value = BabelRules.level_progress(xp, xp_anchors)
	if btn_q != null:
		var l: Dictionary = _leader()
		if not l.is_empty():
			var sk: Dictionary = l.get("skill_a", {}) as Dictionary
			var cd_left: float = float((l["cds"] as Dictionary).get("a", 0.0))
			btn_q.text = "Q %s\n%s" % [str(sk.get("name_cn", "-")), ("%.1fs" % [cd_left]) if cd_left > 0.0 else "就绪"]
	if btn_e != null:
		var l2: Dictionary = _leader()
		if not l2.is_empty():
			var sk2: Dictionary = l2.get("skill_b", {}) as Dictionary
			var cd2: float = float((l2["cds"] as Dictionary).get("b", 0.0))
			btn_e.text = "E %s\n%s" % [str(sk2.get("name_cn", "-")), ("%.1fs" % [cd2]) if cd2 > 0.0 else "就绪"]
	if btn_tab != null:
		btn_tab.text = "Tab 切人" if switch_cd <= 0.0 else "切人 CD %.1f" % [switch_cd]


func _spawn_float(pos: Vector2, text: String, color: Color) -> void:
	if not is_inside_tree():
		return
	var lbl: Label = Label.new()
	lbl.text = text
	lbl.position = pos + Vector2(-10, -30)
	lbl.z_index = 20
	lbl.add_theme_color_override("font_color", color)
	lbl.add_theme_font_size_override("font_size", 18 if color != COLOR_RELIC_GOLD else 26)
	unit_node.add_child(lbl)
	var tw: Tween = create_tween()
	tw.set_parallel(true)
	tw.tween_property(lbl, "position:y", lbl.position.y - 40.0, FLOAT_LIFE)
	tw.tween_property(lbl, "modulate:a", 0.0, FLOAT_LIFE).set_delay(0.2)
	tw.chain().tween_callback(lbl.queue_free)


func _finish(winner: String) -> void:
	if state == "done":
		return
	state = "done"
	battle_finished.emit({
		"winner": winner,
		"kills": kills,
		"shards": shards_total,
		"time_s": battle_t,
	})


## ---------- 绘制 ----------

func _draw_terrain() -> void:
	var vp_center: Vector2 = cam.get_screen_center_position() if cam != null else Vector2(world_w * 0.5, PLAY_H * 0.5)
	var x0: int = maxi(int((vp_center.x - VIEW_W * 0.5) / tile_px) - 1, 0)
	var x1: int = mini(int((vp_center.x + VIEW_W * 0.5) / tile_px) + 1, terrain.cols - 1)
	# 底色
	terrain_node.draw_rect(Rect2(0, 0, world_w, world_h), COLOR_BG)
	for cy: int in range(terrain.rows):
		for cx: int in range(x0, x1 + 1):
			var t: String = str(terrain.grid.get(Vector2i(cx, cy), ""))
			if t == "":
				continue
			var rect: Rect2 = Rect2(float(cx) * tile_px, float(cy) * tile_px, tile_px, tile_px)
			match t:
				BabelTerrain.TYPE_WATER:
					terrain_node.draw_rect(rect, Color(COLOR_WATER, 0.35))
				BabelTerrain.TYPE_FIRE:
					terrain_node.draw_rect(rect, Color(COLOR_FIRE, 0.4))
				BabelTerrain.TYPE_COVER:
					terrain_node.draw_rect(rect.grow(-4), COLOR_COVER)
					terrain_node.draw_rect(rect.grow(-4), Color(1, 1, 1, 0.4), false, 3.0)
				BabelTerrain.TYPE_ALTAR:
					terrain_node.draw_rect(rect.grow(-6), Color(COLOR_ALTAR, 0.3))
					terrain_node.draw_circle(rect.get_center(), 10.0, Color(COLOR_NEON, 0.8))


func _draw_world() -> void:
	# 残片
	for s: Dictionary in shards:
		unit_node.draw_circle(s["pos"] as Vector2, 7.0, COLOR_RELIC_GOLD)
	# 预警红圈
	for tg: Dictionary in telegraphs:
		var p: float = 1.0 - float(tg.get("t", 1.0))
		unit_node.draw_circle(tg["pos"] as Vector2, float(tg.get("r", 96.0)) * p, Color(0.8, 0.1, 0.1, 0.15))
		unit_node.draw_arc(tg["pos"] as Vector2, float(tg.get("r", 96.0)), 0.0, TAU, 40, Color(0.9, 0.15, 0.1, 0.9), 4.0)
	# 子弹
	for b: Dictionary in bullets:
		unit_node.draw_circle(b["pos"] as Vector2, 5.0, COLOR_NEON if bool(b.get("from_player", true)) else COLOR_ENEMY)
	# 敌人
	for e: Dictionary in enemies:
		if not bool(e.get("alive", false)):
			continue
		var pos: Vector2 = e["pos"] as Vector2
		var r: float = float(e.get("radius_px", 16.0))
		unit_node.draw_circle(pos, r, COLOR_ENEMY)
		unit_node.draw_circle(pos, r, Color(1, 1, 1, 0.9), false, 3.0)
		if float(e.get("shield", 0.0)) > 0.0:
			unit_node.draw_arc(pos, r + 5.0, 0.0, TAU, 24, Color("90caf9"), 3.0)
		_draw_hp_bar(pos, r + 12.0, float(e.get("hp", 0.0)), float(e.get("max_hp", 1.0)), COLOR_ENEMY)
	# 英雄
	for i: int in range(heroes.size()):
		var h: Dictionary = heroes[i]
		if not bool(h.get("alive", false)):
			continue
		var hpos: Vector2 = h["pos"] as Vector2
		var hr: float = 18.0
		unit_node.draw_circle(hpos, hr, COLOR_ALLY)
		unit_node.draw_circle(hpos, hr, Color(1, 1, 1, 1.0), false, 3.0)
		if i == leader_idx:
			unit_node.draw_arc(hpos, hr + 6.0, 0.0, TAU, 32, COLOR_RELIC_GOLD, 3.0)
		# 朝向箭头（4 向吸附示意）
		var f: Vector2i = h["facing"] as Vector2i
		unit_node.draw_line(hpos, hpos + Vector2(f) * (hr + 10.0), Color(1, 1, 1, 0.9), 3.0)
		if float(h.get("shield", 0.0)) > 0.0:
			unit_node.draw_arc(hpos, hr + 4.0, 0.0, TAU, 24, Color("90caf9"), 3.0)
		_draw_hp_bar(hpos, hr + 12.0, float(h.get("hp", 0.0)), float(h.get("max_hp", 1.0)), COLOR_ALLY)
		# 名字
		var font: Font = ThemeDB.fallback_font
		unit_node.draw_string(font, hpos + Vector2(-20, -hr - 16), str(h.get("name_cn", "?")), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1, 1, 1, 0.85))
	# 镜头跟随队长（在绘制回调外更新也可以，此处同步）
	if cam != null:
		var l: Dictionary = _leader()
		if not l.is_empty():
			cam.position = Vector2(clampf((l["pos"] as Vector2).x, VIEW_W * 0.5, world_w - VIEW_W * 0.5), PLAY_H * 0.5)


func _draw_hp_bar(pos: Vector2, y_off: float, hp: float, max_hp: float, col: Color) -> void:
	var w: float = 40.0
	var bg: Rect2 = Rect2(pos + Vector2(-w * 0.5, -y_off), Vector2(w, 5))
	unit_node.draw_rect(bg, Color(0, 0, 0, 0.6))
	var ratio: float = clampf(hp / maxf(max_hp, 1.0), 0.0, 1.0)
	unit_node.draw_rect(Rect2(bg.position, Vector2(w * ratio, 5)), col)
