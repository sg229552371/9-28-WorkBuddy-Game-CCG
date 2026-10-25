## 战斗场景（P3 纵向切片）—— 渲染层：持有 JesCombat 逻辑实例，负责输入/绘制/HUD
## 口径：逻辑全部在 combat.gd（可 headless 测试）；本文件只做「画 + 按键」。
## 操作：WASD/方向键移动，鼠标瞄准，按住左键或 J 射击；Esc 暂停切换 playing/menu。
extends Node2D

var combat := JesCombat.new()
var cam: Camera2D
var hud_layer: CanvasLayer = null        # HUD 挂 CanvasLayer（不随镜头移动）
var hud_top: Label                       # 顶部击杀进度胶囊
var hud_hp: Label                        # 左上 HP / 等级 / 经验
var hud_res: Label                       # 右上 金币 / 宝箱 / 波次
var hud_skill: Label                     # 底部技能栏
var hud_weight: Label                    # 左下负重
var hud_hint: Label                      # 右下操作提示
var hud_notice: Label                    # 左中信息行（裂隙/无尽/冻结提示）
var paused := false
var bag_ui: BagUI                        # 背包 UI（Tab 开关；临时 5×6 + 遗物 5×7）
var _skill_cfg := SkillConfigCore.new()  # 技能水晶配置加载层
var _skill_id := ""                      # 当前编译的技能石（英雄初始绑定）
var _crystals: Array = []                # 已装备水晶（宝箱拾取获得，mutate_number 链）
var crystal_panel: CanvasLayer = null    # 水晶面板（C 键开关；水晶装卸信号回写战斗数值）
var screens_ui: CanvasLayer = null       # 三合一 UI 屏（M 键开关：主城/选人/结算）
var save_core: SaveCore = null           # 存档系统（死亡结算自动存档）
var _saved := false                      # 死亡存档只落一次
var _settle_shown := false               # 死亡结算面板只弹一次
var _settle_layer: CanvasLayer = null    # 死亡结算面板（含「返回主城」按钮）
var _skill_table: Dictionary = {}        # skillSystem 表（水晶池/绑定表）
var _endless_rewards: Array = []
var _endless_notice := ""
var _endless_settlement: Dictionary = {}
var _reward_warning_shown := false
var hud_top_fill: ColorRect = null       # 顶部胶囊进度条金色填充
var hud_lv: Label = null                 # 右上 Lv 大字
var hud_ready: Panel = null              # 左上 READY 冻结徽章
var hud_skill_bar: Panel = null          # 底部英雄技能栏组（半透明 Panel）
var auto_btn: Button = null              # 右下自动战斗按钮
var bag_btn: Button = null               # 右下背包按钮
var weight_limit := 100                  # 负重上限（cfg/weight.json threshold）

const EndlessModeScript = preload("res://mods/jes-endless/scripts/endless_mode.gd")
const RiftModeScript = preload("res://mods/jes-rift/scripts/rift_mode.gd")
const SeasonModeScript = preload("res://mods/jes-season/scripts/season_mode.gd")

var rift_mode: RiftMode = null           # 裂隙任务（R 键开启；击杀计数 → 奖励宝箱）
var season: SeasonMode = null            # 赛季（击杀累积经验；死亡存档持久化等级）
var _rift_rewarded_kills := false        # 里程碑击杀奖励只掉一次
var _rift_task_rewarded := false         # 任务完成奖励只掉一次

func _ready() -> void:
	var wcfg: Variant = Cfg.get_table("weight")
	if wcfg is Dictionary:
		weight_limit = maxi(1, int((wcfg as Dictionary).get("threshold", 100)))
	else:
		push_warning("[Battle] weight 表缺失，负重上限回退 100")
	var heroes: Variant = Cfg.get_table("heroes")
	var monsters: Variant = Cfg.get_table("monsters")
	var levels: Variant = Cfg.get_table("levels")
	var hero: Dictionary = {}
	if heroes is Array and (heroes as Array).size() > 0:
		hero = (heroes as Array)[0]        # 兜底：找不到指定英雄时用 H001
		# 场景串联流：主城选人写入的 GameState.hero_id 优先
		var want_id := str(GameState.hero_id) if str(GameState.hero_id) != "" else "H001"
		for h in (heroes as Array):
			if str(h.get("id", "")) == want_id:
				hero = h
				break
	var level: Dictionary = {}
	if levels is Array:
		# 场景串联流：GameState.level_id 选关（缺省 LEVEL_001）
		var want_lv := str(GameState.level_id) if str(GameState.level_id) != "" else "LEVEL_001"
		for lv in (levels as Array):
			if str(lv.get("id", "")) == want_lv:
				level = lv
				break
		if level.is_empty() and (levels as Array).size() > 0:
			level = (levels as Array)[0]
	combat.setup(hero, monsters if monsters is Dictionary else {}, level, {
		"spawnCircles": Cfg.get_table("spawnCircles"),
		"levelCurve": Cfg.get_table("levelCurve"),
		"elites": Cfg.get_table("elites"),
		"chestDrop": Cfg.get_table("chestDrop"),
		"extract": Cfg.get_table("extract"),
		"weight": Cfg.get_table("weight"),
		"levelFreeze": Cfg.get_table("levelFreeze"),
		"autoFight": Cfg.get_table("autoFight"),
		"levelUp": Cfg.get_table("levelUp"),
		"warBuffs": Cfg.get_table("warBuffs"),
		"monsterScale": Cfg.get_table("monsterScale"),
	})
	GameState.set_state("playing")
	print("[Battle] 开局：英雄=", hero.get("id", "?"), " 关卡=", level.get("id", "?"),
		" 怪表=", (monsters as Dictionary).size() if monsters is Dictionary else 0)
	# 相机跟随玩家：make_current 生效 + 按地图尺寸设边界（不越界露出黑边）
	cam = Camera2D.new()
	cam.zoom = Vector2(1.0, 1.0)   # 视口 1280x720 → 可见世界 1280x720 像素（对齐 HTML 观感）
	add_child(cam)
	cam.make_current()
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = maxi(int(combat.world_size.x), 1280)
	cam.limit_bottom = maxi(int(combat.world_size.y), 720)
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 8.0
	_build_hud()
	# --- 背包 UI（Tab 开关；未注入时 BagUI 自建双包 + 示范装备）---
	var bag_scene: PackedScene = load("res://mods/jes-inventory/scenes/bag_ui.tscn")
	if bag_scene != null:
		bag_ui = bag_scene.instantiate()
		add_child(bag_ui)
	# --- 技能水晶编译：英雄初始技能数值接进战斗层（mutate_number 链生效处）---
	var st: Variant = Cfg.get_table("skillSystem")
	_skill_table = st if st is Dictionary else {}
	var binds: Dictionary = _skill_table.get("initialSkillBindings", {})
	var bind: Dictionary = binds.get(str(hero.get("id", "H001")), {}) if binds is Dictionary else {}
	_skill_id = str(bind.get("skillId", ""))
	if _skill_id == "":
		var sdefs: Dictionary = _skill_table.get("skillDefs", {})
		if not sdefs.is_empty():
			_skill_id = str(sdefs.keys()[0])
	_recompile_skill()
	# 宝箱拾取 → 装备入临时背包 + 随机水晶一颗（立即重编译生效）
	combat.chest_picked.connect(_on_chest_picked)
	# --- 水晶面板（C 键）：装卸水晶 → 回写 _crystals 并重编译战斗数值 ---
	var cp_scene: PackedScene = load("res://mods/jes-skills/scenes/crystal_panel.tscn")
	if cp_scene != null:
		crystal_panel = cp_scene.instantiate()
		add_child(crystal_panel)
		crystal_panel.set_skill(_skill_id, 1)
		crystal_panel.crystals_changed.connect(_on_panel_crystals)
	# --- 三合一 UI 屏（M 键：主城/选人/结算）---
	var sc_scene: PackedScene = load("res://mods/jes-engine-core/scenes/screens.tscn")
	if sc_scene != null:
		screens_ui = sc_scene.instantiate()
		add_child(screens_ui)
	# --- 存档系统：死亡时自动落档 ---
	save_core = SaveCore.new()
	# --- 赛季：击杀累积经验，等级随存档跨局持久 ---
	season = SeasonModeScript.new()
	_restore_season()
	# --- 击杀事件总线：裂隙计数 + 赛季经验 ---
	combat.monster_killed.connect(_on_monster_killed)
	# --- 流程补齐接线：结算信号 / 升级暂停闸门 ---
	EventBus.run_settled.connect(_on_run_settled)

## 结算信号（combat 发一次）：撤离胜利或阵亡，统一弹结算面板
func _on_run_settled(result: Dictionary) -> void:
	_settle_result = result
	if str(result.get("winner", "")) == "extract":
		GameState.last_settlement = {
			"kills": combat.kills, "wave": combat.wave_index,
			"coins": combat.coin_gained, "exp": combat.exp_gained,
		}
		_save_on_death()   # 撤离同样落档（存档口径不变）
		_show_death_settlement()

var _settle_result: Dictionary = {}
var _levelup_offers: Array = []
var _levelup_layer: CanvasLayer = null

## 升级 4 选 1 面板（19.10 暂停闸门：state="levelup"，主循环跳过世界更新、渲染照常）
func _show_levelup_panel() -> void:
	if _levelup_layer != null:
		return
	_levelup_offers = combat.make_levelup_offers()
	GameState.set_state("levelup")
	_levelup_layer = CanvasLayer.new()
	add_child(_levelup_layer)
	var panel := Panel.new()
	panel.offset_left = 240.0
	panel.offset_top = 160.0
	panel.offset_right = 1040.0
	panel.offset_bottom = 560.0
	_levelup_layer.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)
	var title := Label.new()
	title.text = "升级！选择一项强化（Lv%d）" % combat.player_lv
	title.add_theme_font_size_override("font_size", 28)
	vbox.add_child(title)
	for i in range(_levelup_offers.size()):
		var offer: Dictionary = _levelup_offers[i]
		var txt := "[%d] %s" % [i + 1, str(offer.get("name", "?"))]
		if str(offer.get("type", "stat")) == "warbuff":
			txt += "（%s）" % str(offer.get("label", ""))
		else:
			txt += "（%s +%d）" % [str(offer.get("stat", "")), int(offer.get("value", 0.0))]
		var btn := Button.new()
		btn.text = txt
		btn.add_theme_font_size_override("font_size", 22)
		var idx := i
		btn.pressed.connect(func() -> void: _choose_levelup(idx))
		vbox.add_child(btn)

func _choose_levelup(index: int) -> void:
	if index < 0 or index >= _levelup_offers.size():
		return
	combat.apply_levelup_choice(_levelup_offers[index])
	_levelup_offers.clear()
	if _levelup_layer != null:
		_levelup_layer.queue_free()
		_levelup_layer = null
	# 还有未处理的升级 → 立即弹下一轮；否则恢复
	if combat.pending_levelups > 0:
		_show_levelup_panel()
	else:
		GameState.set_state("playing")

## 自动战斗开关（G 键；EventBus 通知 HUD 侧）
func _toggle_auto_fight() -> void:
	combat.auto_fight = not combat.auto_fight
	EventBus.auto_fight_toggled.emit(combat.auto_fight)

## 水晶面板装卸回写：面板发来的水晶数组覆盖本地，重编译生效
func _on_panel_crystals(crystals: Array) -> void:
	_crystals = crystals.duplicate(true)
	_recompile_skill()

## 死亡结算存档（只落一次）：英雄/技能水晶/金币经验/最佳波次
func _save_on_death() -> void:
	if _saved or save_core == null:
		return
	_saved = true
	var arch := SaveCore.empty_archive()
	arch["hero_id"] = str(GameState.hero_id) if "hero_id" in GameState else "H001"
	arch["skills"] = {_skill_id: {"level": 1, "crystals": _crystals}} if _skill_id != "" else {}
	arch["coins"] = combat.coin_gained
	arch["exp"] = combat.exp_gained
	arch["best_wave"] = combat.wave_index
	# 赛季等级跨局持久（D051：赛季接战斗层）
	if season != null:
		arch["season"] = {"lv": season.season_lv, "exp": season.season_exp}
	save_core.save("auto", arch)
	combat.floor_advanced.connect(_on_floor_advanced)

## 死亡结算面板（只弹一次）：汇总战绩 + 「返回主城」按钮 → 场景串联流闭环
func _show_death_settlement() -> void:
	if _settle_shown:
		return
	_settle_shown = true
	# 结算数据回写 GameState，回城后主城展示上局战绩
	GameState.last_settlement = {
		"kills": combat.kills, "wave": combat.wave_index,
		"coins": combat.coin_gained, "exp": combat.exp_gained,
	}
	_settle_layer = CanvasLayer.new()
	add_child(_settle_layer)
	var panel := Panel.new()
	panel.offset_left = 240.0
	panel.offset_top = 140.0
	panel.offset_right = 1040.0
	panel.offset_bottom = 620.0
	_settle_layer.add_child(panel)
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 16)
	panel.add_child(vbox)
	var title := Label.new()
	title.text = "战斗结算（阵亡）"
	title.add_theme_font_size_override("font_size", 32)
	vbox.add_child(title)
	var lines := [
		"击杀：%d" % combat.kills,
		"波次：%d" % combat.wave_index,
		"金币：%d" % combat.coin_gained,
		"经验：%d" % combat.exp_gained,
		"暴击：%d" % combat.crit_count,
		"技能：%s（水晶 %d 颗）" % [_skill_id if _skill_id != "" else "无", _crystals.size()],
	]
	for line in lines:
		var label := Label.new()
		label.text = line
		label.add_theme_font_size_override("font_size", 22)
		vbox.add_child(label)
	var back := Button.new()
	back.text = "返回主城"
	back.custom_minimum_size = Vector2(0.0, 56.0)
	back.add_theme_font_size_override("font_size", 24)
	back.pressed.connect(_back_to_city)
	vbox.add_child(back)

## 返回主城：change_scene 切 city.tscn（串联流闭环）
func _back_to_city() -> void:
	get_tree().change_scene_to_file("res://mods/jes-engine-core/scenes/city.tscn")

## 赛季等级恢复：从自动存档读回（跨局持久）
func _restore_season() -> void:
	var data: Dictionary = save_core.load_save("auto")
	var s: Variant = data.get("season", {})
	if s is Dictionary and not (s as Dictionary).is_empty():
		season.season_lv = maxi(1, int((s as Dictionary).get("lv", 1)))
		season.season_exp = maxf(0.0, float((s as Dictionary).get("exp", 0.0)))

## 击杀事件：裂隙任务计数（完成/里程碑掉奖励宝箱）+ 赛季经验
func _on_monster_killed(m: Dictionary) -> void:
	if rift_mode != null and rift_mode.active:
		rift_mode.record_kill()
		if not _rift_task_rewarded and bool(rift_mode.task.get("done", false)):
			_rift_task_rewarded = true
			combat._drop_chest(Vector2(combat.player.pos), "rift")
		elif not _rift_rewarded_kills and rift_mode.kills >= int(rift_mode.cfg.get("rewardKills", 12)):
			_rift_rewarded_kills = true
			combat._drop_chest(Vector2(combat.player.pos), "rift")
	if season != null:
		season.on_kill(bool(m.get("is_elite", false)))

## R 键开启裂隙任务（随机加权抽一；冻结期 3s 由 RiftMode.update 自行处理）
func _start_rift() -> void:
	if (rift_mode != null and rift_mode.active) or paused or not combat.player.alive:
		return
	rift_mode = RiftModeScript.new()
	if not rift_mode.begin():
		rift_mode = null
		push_warning("[Battle] 裂隙任务开启失败（任务表为空？）")
		return
	_rift_rewarded_kills = false
	_rift_task_rewarded = false
	_endless_notice = "裂隙任务：" + str(rift_mode.task.get("desc", rift_mode.task.get("name", "")))
	_update_hud()

## 重编译当前技能：水晶修饰后的最终数值写入战斗层（伤害倍率/冷却/弹速）
func _recompile_skill() -> void:
	if _skill_id == "":
		return
	var r := SkillCompilerCore.compile(_skill_cfg, _skill_id, 1, _crystals)
	if not bool(r.get("ok", false)):
		push_warning("[Battle] 技能编译失败: " + _skill_id)
		return
	var p: Dictionary = r.get("params", {})
	combat.bullet_dmg_mul = float(p.get("coefficient", 1.0))
	combat.shoot_interval = maxf(float(p.get("cooldown", 1.0)), 0.08)
	combat.bullet_spd = float(p.get("speed", 480.0))

## 宝箱拾取闭环：装备入包（背包模块）+ 水晶入槽（技能模块）→ 数值实时变强
func _on_chest_picked(chest: Dictionary) -> void:
	# ① 装备：按宝箱品质生成一件 gear 入临时背包
	if bag_ui != null and bag_ui.inv_temp != null:
		var gg := bag_ui.gear_gen
		if gg.gear_defs.is_empty():
			gg.load_gear_defs()
		if not gg.gear_defs.is_empty():
			var def: Dictionary = gg.gear_defs[combat.rng.randi_range(0, gg.gear_defs.size() - 1)]
			var q := clampi(int(chest.get("quality", 0)), 0, 4)
			var item := gg.make_gear(def, q, combat.rng)
			bag_ui.inv_temp.auto_add(item, bag_ui.chest_stack_map)
			bag_ui.refresh()
			# 负重：装备入包计重（cfg/weight.json 惩罚；gearDefs.weight 缺省 5）
			combat.add_weight(float(def.get("weight", 5.0)))
	# ② 水晶：从 crystalDefs 随机一颗，重编译后战斗数值立即变化
	var cdefs: Dictionary = _skill_table.get("crystalDefs", {})
	if not cdefs.is_empty():
		var ids: Array = cdefs.keys()
		_crystals.append({"id": str(ids[combat.rng.randi_range(0, ids.size() - 1)]), "level": 1})
		_recompile_skill()

func _start_endless() -> void:
	if combat.endless_mode != null or not combat.player.alive or paused:
		return
	combat.endless_mode = EndlessModeScript.new(Cfg.get_table("endless"), Cfg.get_table("monsters"))
	combat.endless_mode.begin()
	combat.wave_index = 0
	combat.wave_timer = 0.0
	# 普通关卡的存量敌人不带入无尽；背包、水晶和地上宝箱保留。
	combat.monsters.clear()
	combat.bullets.clear()
	_endless_rewards.clear()
	_endless_settlement.clear()
	_endless_notice = "无尽已开启"
	_update_hud()

func _on_floor_advanced(floor_no: int, rewards: Array) -> void:
	_endless_rewards = rewards.duplicate(true)
	_endless_notice = "已进入第%d层" % floor_no
	_update_hud()

func _choose_endless_reward(index: int) -> void:
	if paused or not combat.player.alive or index < 0 or index >= _endless_rewards.size():
		return
	var reward: Dictionary = _endless_rewards[index]
	# 任务要求统一兑金币；无 amount 的候选保守给 0，不另造数值。
	if not reward.has("amount") and not _reward_warning_shown:
		_reward_warning_shown = true
		push_warning("[Battle] 无尽奖励候选缺少 amount，金币按 0 处理")
	var amount := int(reward.get("amount", 0))
	combat.coin_gained += amount
	_endless_notice = "已选择%s，金币 +%d" % [str(reward.get("name", "奖励")), amount]
	_endless_rewards.clear()
	_update_hud()

func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	var key := (event as InputEventKey).keycode
	if key == KEY_ESCAPE:
		paused = not paused
		GameState.set_state("menu" if paused else "playing")
	elif key == KEY_F:
		_start_endless()
	elif key == KEY_R:
		_start_rift()
	elif key in [KEY_1, KEY_2, KEY_3, KEY_4]:
		# 升级 4 选 1 优先（暂停闸门期间数字键选词条）
		if combat.pending_levelups > 0:
			_choose_levelup(int(key - KEY_1))
		else:
			_choose_endless_reward(int(key - KEY_1))
	elif key == KEY_G:
		_toggle_auto_fight()

func _process(delta: float) -> void:
	# 升级 4 选 1 暂停闸门（19.10）：弹窗期间跳过世界更新、渲染照常
	if combat.pending_levelups > 0 and combat.player.alive:
		_show_levelup_panel()
		queue_redraw()
		_update_hud()
		return
	if paused or not combat.player.alive or not _endless_rewards.is_empty():
		if not combat.player.alive:
			_save_on_death()
			_show_death_settlement()
		queue_redraw()
		_update_hud()
		return
	var dt := clampf(delta, 0.0, 0.05)
	# --- 输入：移动 + 瞄准 + 开火 ---
	var move := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	# 兜底键位（未配置 InputMap 时直接读键）
	if move == Vector2.ZERO:
		move = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var mouse_world := get_global_mouse_position()
	var aim := mouse_world - Vector2(combat.player.pos)
	if aim.length_squared() < 1.0:
		aim = Vector2.RIGHT
	var fire := Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) or Input.is_key_pressed(KEY_J)
	combat.step(dt, move, aim.normalized(), fire)
	# 裂隙任务计时/冻结推进
	if rift_mode != null:
		rift_mode.update(dt)
	# 死怪清理（每 0.5s 一次足够）
	combat.compact_monsters()
	# 相机跟随
	cam.position = Vector2(combat.player.pos)
	queue_redraw()
	_update_hud()

## HUD 构建（对齐 HTML 布局：顶部击杀胶囊 / 左上血蓝 / 右上资源 / 底部技能栏）
func _make_label(size: int, color := Color.WHITE) -> Label:
	var lb := Label.new()
	lb.add_theme_font_size_override("font_size", size)
	lb.add_theme_color_override("font_color", color)
	lb.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	lb.add_theme_constant_override("outline_size", 6)
	return lb

func _build_hud() -> void:
	hud_layer = CanvasLayer.new()
	hud_layer.layer = 10
	add_child(hud_layer)
	# 顶部居中：击杀进度胶囊条（黑底圆条 420x14 + 金色填充）+ 条下文字
	var bar_style := StyleBoxFlat.new()
	bar_style.bg_color = Color(0.05, 0.05, 0.08, 0.9)
	bar_style.set_corner_radius_all(7)
	var bar := Panel.new()
	bar.add_theme_stylebox_override("panel", bar_style)
	bar.set_anchors_preset(Control.PRESET_CENTER_TOP)
	bar.anchor_left = 0.5
	bar.anchor_right = 0.5
	bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	bar.offset_left = -210.0
	bar.offset_right = 210.0
	bar.offset_top = 8.0
	bar.offset_bottom = 22.0
	hud_layer.add_child(bar)
	hud_top_fill = ColorRect.new()
	hud_top_fill.color = Color(1.0, 0.82, 0.25)
	hud_top_fill.position = Vector2(2.0, 2.0)
	hud_top_fill.size = Vector2(0.0, 10.0)
	bar.add_child(hud_top_fill)
	hud_top = _make_label(18, Color(1.0, 1.0, 1.0))
	hud_top.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_top.set_anchors_preset(Control.PRESET_CENTER_TOP)
	hud_top.anchor_left = 0.5
	hud_top.anchor_right = 0.5
	hud_top.grow_horizontal = Control.GROW_DIRECTION_BOTH
	hud_top.offset_top = 26.0
	hud_layer.add_child(hud_top)
	# 左上：READY 冻结徽章（绿描边圆形 + 绿字 + 小字说明，冻结期显示）
	var ready_style := StyleBoxFlat.new()
	ready_style.bg_color = Color(0.1, 0.2, 0.12, 0.85)
	ready_style.border_color = Color(0.3, 0.9, 0.4)
	ready_style.set_border_width_all(2)
	ready_style.set_corner_radius_all(28)
	hud_ready = Panel.new()
	hud_ready.add_theme_stylebox_override("panel", ready_style)
	hud_ready.position = Vector2(16, 42)
	hud_ready.size = Vector2(56.0, 56.0)
	hud_ready.visible = false
	hud_layer.add_child(hud_ready)
	var ready_lb := _make_label(14, Color(0.3, 0.9, 0.4))
	ready_lb.text = "READY"
	ready_lb.set_anchors_preset(Control.PRESET_FULL_RECT)
	ready_lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ready_lb.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	hud_ready.add_child(ready_lb)
	var ready_sub := _make_label(12, Color(0.55, 0.85, 0.6))
	ready_sub.text = "全场冻结"
	ready_sub.position = Vector2(2, 58)
	ready_sub.size = Vector2(52.0, 16.0)
	ready_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_ready.add_child(ready_sub)
	# 左上：HP / Lv / 经验（徽章在其下方错开，信息行下移避让）
	hud_hp = _make_label(24, Color(0.95, 0.98, 1.0))
	hud_hp.position = Vector2(16, 10)
	hud_layer.add_child(hud_hp)
	# 右上：Lv 大字 + 金币/经验小字（宝箱/波次次行）
	hud_lv = _make_label(34, Color(0.95, 0.98, 1.0))
	hud_lv.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hud_lv.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	hud_lv.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hud_lv.offset_right = -16.0
	hud_lv.offset_top = 6.0
	hud_layer.add_child(hud_lv)
	hud_res = _make_label(18, Color(1.0, 0.88, 0.45))
	hud_res.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hud_res.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	hud_res.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hud_res.offset_right = -16.0
	hud_res.offset_top = 48.0
	hud_layer.add_child(hud_res)
	# 左中：信息行（冻结 / 裂隙 / 无尽 / 撤离提示）
	hud_notice = _make_label(20, Color(0.75, 0.95, 1.0))
	hud_notice.position = Vector2(16, 120)
	hud_layer.add_child(hud_notice)
	# 左下：负重
	hud_weight = _make_label(22, Color(0.9, 0.85, 0.7))
	hud_weight.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hud_weight.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hud_weight.offset_left = 16.0
	hud_weight.offset_top = -42.0
	hud_layer.add_child(hud_weight)
	# 底部居中：英雄技能栏组（半透明 Panel；构建失败回退 hud_skill 文本）
	_build_skill_bar()
	hud_skill = _make_label(18, Color(1.0, 0.95, 0.8))
	hud_skill.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_skill.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hud_skill.grow_horizontal = Control.GROW_DIRECTION_BOTH
	hud_skill.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hud_skill.offset_top = -22.0
	hud_layer.add_child(hud_skill)
	# 右下：按钮行（自动战斗 / 背包）+ 操作提示
	auto_btn = Button.new()
	auto_btn.text = "自动战斗 · 关"
	auto_btn.custom_minimum_size = Vector2(150.0, 30.0)
	auto_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	auto_btn.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	auto_btn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	auto_btn.offset_right = -16.0
	auto_btn.offset_top = -108.0
	auto_btn.offset_bottom = -78.0
	auto_btn.pressed.connect(_toggle_auto_fight)
	hud_layer.add_child(auto_btn)
	bag_btn = Button.new()
	bag_btn.text = "背包 (Tab)"
	bag_btn.custom_minimum_size = Vector2(150.0, 30.0)
	bag_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	bag_btn.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	bag_btn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bag_btn.offset_right = -16.0
	bag_btn.offset_top = -74.0
	bag_btn.offset_bottom = -44.0
	bag_btn.pressed.connect(_toggle_bag)
	hud_layer.add_child(bag_btn)
	hud_hint = _make_label(18, Color(0.8, 0.85, 0.9, 0.9))
	hud_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	hud_hint.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	hud_hint.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	hud_hint.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hud_hint.offset_right = -16.0
	hud_hint.offset_top = -40.0
	hud_hint.text = "WASD移动 · 鼠标瞄准 · 左键/J射击 · Tab背包 · C水晶 · Esc暂停 · G自动战斗"
	hud_layer.add_child(hud_hint)

## 底部英雄技能栏组：从 GameState.team_ids 读队伍（缺省单人），每组英雄一个 HBox；
## 队伍/英雄表读不到时隐藏栏组并回退显示 hud_skill 文本（不报错）
func _build_skill_bar() -> void:
	var team: Array[String] = []
	var ids: Variant = GameState.get("team_ids")
	if ids is Array:
		for e in (ids as Array):
			team.append(str(e))
	if team.is_empty():
		var hid := str(GameState.get("hero_id"))
		team.append(hid if hid != "" else "H001")
	var heroes: Variant = Cfg.get_table("heroes")
	if not (heroes is Array):
		push_warning("[Battle] heroes 表缺失，底部技能栏回退文本模式")
		return
	var hero_map := {}
	for h in (heroes as Array):
		if h is Dictionary:
			hero_map[str((h as Dictionary).get("id", ""))] = h
	var bar_style := StyleBoxFlat.new()
	bar_style.bg_color = Color(0.05, 0.06, 0.1, 0.62)
	bar_style.set_corner_radius_all(10)
	hud_skill_bar = Panel.new()
	hud_skill_bar.add_theme_stylebox_override("panel", bar_style)
	hud_skill_bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hud_skill_bar.anchor_left = 0.5
	hud_skill_bar.anchor_right = 0.5
	hud_skill_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	hud_skill_bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hud_skill_bar.offset_top = -190.0
	hud_skill_bar.offset_bottom = -60.0
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 24)
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	hud_skill_bar.add_child(row)
	var built := 0
	for hid in team:
		if not hero_map.has(hid):
			continue
		var hero: Dictionary = hero_map[hid]
		var hname := str(hero.get("name", hid))
		var role := str(hero.get("role", ""))
		var lv := maxi(1, int(hero.get("hero_out_level", 1)))
		var grp := HBoxContainer.new()
		grp.add_theme_constant_override("separation", 6)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 4)
		var name_lb := _make_label(14, Color(0.95, 0.98, 1.0))
		name_lb.text = hname + (" · " + role if role != "" else "")
		col.add_child(name_lb)
		var slots := HBoxContainer.new()
		slots.add_theme_constant_override("separation", 5)
		var av := Button.new()
		av.text = hname.substr(0, 1)
		av.custom_minimum_size = Vector2(44.0, 44.0)
		var av_style := StyleBoxFlat.new()
		av_style.bg_color = _role_color(role)
		av_style.set_corner_radius_all(22)
		av.add_theme_stylebox_override("normal", av_style)
		av.add_theme_font_size_override("font_size", 20)
		slots.add_child(av)
		for i in range(4):
			var cell := VBoxContainer.new()
			cell.add_theme_constant_override("separation", 2)
			var slot_style := StyleBoxFlat.new()
			slot_style.bg_color = Color(0.12, 0.13, 0.18, 0.9)
			slot_style.set_corner_radius_all(4)
			var slot := Panel.new()
			slot.add_theme_stylebox_override("panel", slot_style)
			slot.custom_minimum_size = Vector2(28.0, 28.0)
			cell.add_child(slot)
			var lv_lb := _make_label(10, Color(0.75, 0.8, 0.85))
			lv_lb.text = "Lv%d" % lv
			cell.add_child(lv_lb)
			slots.add_child(cell)
		col.add_child(slots)
		grp.add_child(col)
		row.add_child(grp)
		built += 1
	if built == 0:
		push_warning("[Battle] 队伍英雄未匹配到 heroes 表，底部技能栏回退文本模式")
		hud_skill_bar.queue_free()
		hud_skill_bar = null
		return
	hud_layer.add_child(hud_skill_bar)

## 职业配色（role 字段 → 色块；未知职业给灰蓝）
func _role_color(role: String) -> Color:
	if role == "output":
		return Color(0.85, 0.45, 0.2)
	if role == "tank":
		return Color(0.25, 0.5, 0.85)
	if role == "support":
		return Color(0.3, 0.75, 0.45)
	return Color(0.45, 0.5, 0.6)

## 背包按钮：调 bag_ui.toggle()（BagUI 公开开关；找不到时仅提示不崩溃）
func _toggle_bag() -> void:
	if bag_ui != null and bag_ui.has_method("toggle"):
		bag_ui.call("toggle")
	else:
		push_warning("[Battle] bag_ui 不可用，背包按钮无效果")

func _update_hud() -> void:
	if hud_top == null:
		return
	var p := combat.player
	# 顶部胶囊条：金色填充 = kills/progress_goal；条下文字（冻结/阵亡/暂停/击杀进度）
	if hud_top_fill != null:
		var ratio := 0.0
		if combat.progress_goal > 0:
			ratio = clampf(float(combat.kills) / float(combat.progress_goal), 0.0, 1.0)
		hud_top_fill.size = Vector2(416.0 * ratio, 10.0)
	var top_txt := "击败精英 %d / %d" % [combat.kills, combat.progress_goal]
	if combat.time_limit > 0.0:
		top_txt += " (剩余 %.0fs)" % maxf(0.0, combat.time_limit - combat.run_time)
	if combat.freeze_time > 0.0:
		top_txt = "全场冻结中 · %s %.1fs" % [combat.freeze_hint, combat.freeze_time]
	elif not bool(p.alive):
		top_txt = "阵亡"
	elif paused:
		top_txt = "已暂停"
	hud_top.text = top_txt
	# 左上：READY 冻结徽章（冻结期显示）
	if hud_ready != null:
		hud_ready.visible = combat.freeze_time > 0.0
	# 左上：HP / Lv / 经验
	hud_hp.text = "HP %d/%d   Lv%d   经验 %d" % [
		int(p.hp), int(p.hp_max), combat.player_lv, combat.exp_gained]
	# 右上：Lv 大字 + 金币/经验（宝箱/波次次行）
	hud_lv.text = "Lv %d" % combat.player_lv
	hud_res.text = "✦金币 %d · ✦经验 %d\n宝箱 %d · 波次 %d · 场上怪 %d" % [
		combat.coin_gained, combat.exp_gained,
		combat.chests.size(), combat.wave_index, combat.monsters.size()]
	# 左下：负重 X / 上限
	hud_weight.text = "负重 %d / %d" % [int(combat.weight), weight_limit]
	# 底部：技能回退文本 + 自动战斗 + 赛季（英雄栏组由 _build_skill_bar 承载，静态显示）
	var skill_txt := ""
	if hud_skill_bar == null:
		skill_txt = "技能 %s · 水晶 %d · 冷却 %.1fs" % [
			_skill_id if _skill_id != "" else "无", _crystals.size(), combat.shoot_interval]
	if not skill_txt.is_empty():
		skill_txt += " · 自动战斗[%s]" % ("开" if combat.auto_fight else "关")
	else:
		skill_txt = "自动战斗[%s]" % ("开" if combat.auto_fight else "关")
	if season != null:
		skill_txt += " · 赛季Lv%d" % season.season_lv
	hud_skill.text = skill_txt
	if auto_btn != null:
		auto_btn.text = "自动战斗 · " + ("开" if combat.auto_fight else "关")
	# 左中信息行：撤离 / 裂隙 / 无尽
	var lines: Array[String] = []
	var ep: ExtractPoint = combat.extract_point
	if ep != null and ep.active and bool(p.alive):
		var need := maxf(0.1, ep.channel_seconds(combat.weight))
		var inside := ep.contains(Vector2(p.pos))
		var base := maxf(0.1, float(ep.cfg.get("channel", 1.0)))
		var pct := ep.progress / base * 100.0
		lines.append("撤离点已出现（读条 %.0fs）%s" % [need,
			"（读条中 %.0f%%）" % pct if inside else "：进圈读条撤离"])
	if combat.endless_mode == null:
		if rift_mode != null and rift_mode.active:
			var t: Dictionary = rift_mode.task
			var remain := ""
			if float(t.get("time", 0.0)) > 0.0:
				remain = " · 剩余%.0fs" % maxf(0.0, float(t.get("remain", 0.0)))
			var rstatus := "失败" if bool(t.get("failed", false)) else ("完成" if bool(t.get("done", false)) else "进行中")
			lines.append("裂隙任务[%s]：%s %d/%d%s" % [rstatus,
				str(t.get("name", "")), rift_mode.kills, int(t.get("goal", 0)), remain])
		if _endless_notice != "":
			lines.append(_endless_notice)
	else:
		var mode = combat.endless_mode
		var affix_names: Array[String] = []
		for entry in mode.current_affixes():
			affix_names.append(str(entry.get("name", entry.get("id", ""))))
		lines.append("无尽 第%d层 · 词缀：%s · 层内波次 %d/%d" % [
			mode.wave, "、".join(affix_names) if not affix_names.is_empty() else "无",
			combat.wave_index, mode.wave_cap(mode.wave)])
		if not bool(p.alive):
			if _endless_settlement.is_empty():
				_endless_settlement = mode.settle()
			var result := _endless_settlement
			lines.append("无尽结算：第%d层 · 击杀%d · 结晶%d · 最佳层%d" % [
				int(result.get("wave", 0)), int(result.get("kills", 0)),
				int(result.get("crystals", 0)), int(result.get("bestWave", 0))])
		elif not _endless_rewards.is_empty():
			lines.append("层间奖励三选一（按数字键选择）：")
			for i in range(mini(3, _endless_rewards.size())):
				var reward: Dictionary = _endless_rewards[i]
				lines.append("[%d] %s（金币 +%d）" % [i + 1,
					str(reward.get("name", "奖励")), int(reward.get("amount", 0))])
		else:
			lines.append(_endless_notice)
	hud_notice.text = "\n".join(lines)

## ============================================================
## 绘制（纯 _draw，不依赖美术资源；P4 换贴图）
## ============================================================
func _draw() -> void:
	# 背景（地图边界）
	draw_rect(Rect2(Vector2.ZERO, combat.world_size), Color(0.13, 0.15, 0.13))
	draw_rect(Rect2(Vector2.ZERO, combat.world_size), Color(0.3, 0.35, 0.3), false, 4.0)
	# 网格
	var grid := 240.0
	var g := grid
	while g < combat.world_size.x:
		draw_line(Vector2(g, 0), Vector2(g, combat.world_size.y), Color(0.17, 0.19, 0.17), 2.0)
		draw_line(Vector2(0, g), Vector2(combat.world_size.x, g), Color(0.17, 0.19, 0.17), 2.0)
		g += grid
	# 墙
	for r: Rect2 in combat.walls:
		draw_rect(r, Color(0.42, 0.38, 0.30))
		draw_rect(r, Color(0.55, 0.5, 0.4), false, 3.0)
	# 怪（近战红 / 远程紫；精英金色描边 / Boss 暗紫大圈 + 头顶血条；P4 接特效）
	for m in combat.monsters:
		if bool(m.dead):
			continue
		var col := Color(0.85, 0.3, 0.25) if not bool(m.ranged) else Color(0.7, 0.35, 0.8)
		if bool(m.get("boss", false)):
			col = Color(0.55, 0.25, 0.75)
		draw_circle(Vector2(m.pos), float(m.radius), col)
		draw_circle(Vector2(m.pos), float(m.radius), Color(1, 1, 1, 0.15))
		if bool(m.get("is_elite", false)):
			# 精英：金色描边区分（真源词缀光环的矢量简化）
			draw_arc(Vector2(m.pos), float(m.radius) + 3.0, 0.0, TAU, 32, Color(1.0, 0.82, 0.25), 3.0)
		if bool(m.get("boss", false)):
			_draw_boss_hp_bar(m)
	# 宝箱（地上标记：金色小箱；拾取只发信号，背包接口留空钩子）
	for ch in combat.chests:
		var cp := Vector2(ch.pos)
		draw_rect(Rect2(cp - Vector2(10, 10), Vector2(20, 20)), Color(0.85, 0.65, 0.2))
		draw_rect(Rect2(cp - Vector2(10, 10), Vector2(20, 20)), Color(1.0, 0.9, 0.4), false, 2.0)
		draw_line(cp - Vector2(10, 0), cp + Vector2(10, 0), Color(1.0, 0.9, 0.4), 2.0)
	# 子弹（玩家黄 / 怪弹橙红）
	for b in combat.bullets:
		var col := Color(1.0, 0.9, 0.3) if bool(b.from_player) else Color(1.0, 0.5, 0.2)
		draw_circle(Vector2(b.pos), float(b.radius), col)
	# 撤离点雕像（金色圈 + 读条弧）：进圈自动读条撤离
	var ep: ExtractPoint = combat.extract_point
	if ep != null and ep.active:
		var sp := ep.position
		var radius := float(ep.cfg.get("radius", 100.0)) * ep.judge_mul
		draw_arc(sp, radius, 0.0, TAU, 48, Color(1.0, 0.85, 0.3), 4.0)
		draw_circle(sp, 12.0, Color(1.0, 0.85, 0.3))
		var base := maxf(0.1, float(ep.cfg.get("channel", 1.0)))
		var frac := clampf(float(ep.progress) / base, 0.0, 1.0)
		if frac > 0.0:
			draw_arc(sp, radius + 10.0, -TAU / 4.0, -TAU / 4.0 + TAU * frac, 48,
				Color(0.4, 1.0, 0.5), 6.0)
	# 玩家（白圈 + 瞄准线）
	if bool(combat.player.alive):
		var pp := Vector2(combat.player.pos)
		draw_circle(pp, float(combat.player.radius), Color(0.9, 0.95, 1.0))
		draw_circle(pp, float(combat.player.radius) - 6.0, Color(0.2, 0.5, 0.9))
		var aim := (get_global_mouse_position() - pp).normalized()
		draw_line(pp + aim * 24.0, pp + aim * 42.0, Color(1.0, 0.9, 0.3), 3.0)
	# 血条（玩家脚下）
	var p2 := Vector2(combat.player.pos)
	var hp_ratio: float = float(combat.player.hp) / float(combat.player.hp_max)
	draw_rect(Rect2(p2 + Vector2(-24, 30), Vector2(48, 6)), Color(0.2, 0.2, 0.2))
	draw_rect(Rect2(p2 + Vector2(-24, 30), Vector2(48 * hp_ratio, 6)),
		Color(0.3, 0.9, 0.3) if hp_ratio > 0.35 else Color(0.9, 0.25, 0.2))

## Boss 血条：头顶固定宽 110（真源 CFG.boss 血条口径），阶段切换时血条变紫
func _draw_boss_hp_bar(m: Dictionary) -> void:
	var bp := Vector2(m.pos)
	var r: float = float(m.hp) / maxf(float(m.hp_max), 1.0)
	var bar := Rect2(bp + Vector2(-55, -float(m.radius) - 22), Vector2(110, 8))
	draw_rect(bar, Color(0.15, 0.1, 0.15))
	var col := Color(0.9, 0.2, 0.35) if int(m.get("phase", 0)) == 0 else Color(0.7, 0.3, 0.9)
	draw_rect(Rect2(bar.position, Vector2(110.0 * r, 8.0)), col)
