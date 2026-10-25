## 《巴别回路》战斗屏：_draw 棋盘 + 点选移动 + 8 技能全接线（BabelChiefSystem）+ 完整敌方 AI（BabelEnemyAI）。
class_name BabelBattle
extends Node2D

const TILE: int = 64
const BOARD_ORIGIN: Vector2 = Vector2(8, 130)
const COLOR_PLAYER: Color = Color("2a9d8f")
const COLOR_ENEMY: Color = Color("c63d2f")
const COLOR_FIRE: Color = Color("e76f51")
const COLOR_WATER: Color = Color("3a86ff")
const COLOR_COVER: Color = Color("6c757d")
const COLOR_BOARD: Color = Color("2b2b2b")
const COLOR_REACH: Color = Color(1, 1, 1, 0.18)
const COLOR_TARGET: Color = Color("ffd166")
const COLOR_HOVER: Color = Color(1, 1, 1, 0.9)
const COLOR_SELECT: Color = Color(1, 1, 1, 1)
const FACING_CYCLE: Array[Vector2i] = [Vector2i(0, 1), Vector2i(1, 0), Vector2i(0, -1), Vector2i(-1, 0)]
const LOG_LINES_MAX: int = 6
## 走 BabelChiefSystem 专用分支的技能 id（其余 damage 技能走通用伤害路径）
const CHIEF_SKILL_IDS: Array[String] = [
	"SK_OFFER", "SK_REWIND", "SK_COFFIN_WALL", "SK_TIDE",
	"SK_HOLY_RAIN", "SK_CUT_TONGUE", "SK_SHADOW_SWAP", "SK_BONE_MAUSOLEUM",
	"SK_PYRE", "SK_COFFIN_CHARGE",
]
## 骨仆基础属性
const BONE_HP: int = 3
const BONE_MOVE: int = 2
const BONE_DMG: int = 2

## 战斗结束（winner: "player" | "enemy"）
signal battle_finished(winner: String)
## 击杀数变化（结算香火用）
signal kills_changed(count: int)
## 日志追加一行
signal log_added(line: String)

var board: BabelBoard
var resolver: BabelResolver
var tm: BabelTurnManager
## 技能表（键 = 技能 id），由 babel_main 从 Cfg 注入
var skills_cfg: Dictionary = {}
var chapter_label: String = ""
var kills: int = 0
## 单位附加数据：unit_id -> 名称
var unit_names: Dictionary = {}
## 单位附加数据：unit_id -> 敌人攻击力
var unit_dmg: Dictionary = {}
## 单位附加数据：unit_id -> 技能 id 列表
var unit_skills: Dictionary = {}
## 敌方回合注入口（Callable(unit)；默认用 BabelEnemyAI 完整决策）
var enemy_turn_hook: Callable = Callable()
## Boss 突变（holy_repay / divine_wrath），由 babel_main 注入
var boss_mutation: Dictionary = {}
## 章节 Boss 的 enemy_id（突变载体），由 babel_main 注入
var boss_id: String = ""
## boss_dread 起始层数（每章战斗 +1），由 babel_main 注入
var boss_dread_stacks: int = 0

var selected: BabelUnit = null
var mode: String = "idle"
var pending_skill: Dictionary = {}
var hover_cell: Vector2i = Vector2i(-1, -1)
var fire_dmg: int = 5
var log_lines: PackedStringArray = PackedStringArray()
## 技能结算系统（8 技能走 execute_skill）
var chief_sys: BabelChiefSystem = null
## 敌方完整 AI
var enemy_ai: BabelEnemyAI = null
## 尸体格列表（SK_BONE_MAUSOLEUM 召唤素材）
var corpses: Array[Vector2i] = []
## 每单位本回合开始位置（SK_REWIND 复位用）：unit_id -> Vector2i
var round_start_pos: Dictionary = {}
## 章节 Boss 单位引用（突变效果载体）
var boss_unit: BabelUnit = null
## divine_wrath 是否已触发（每场一次）
var wrath_done: bool = false

var panel: Panel
var lbl_actor: Label
var lbl_info: Label
var lbl_log: Label
var lbl_round: Label
var bar_round: ProgressBar
var btn_skills: Array[Button] = []
var btn_wait: Button
var btn_face: Button


## 装配一场战斗：p_team/p_enemies 元素形如
## {"id": String, "name_cn": String, "hp": int, "move": int, "skills": Array[String](可选), "dmg": int(敌), "shield": int(可选), "traits": Array[String](敌,可选), "params": Dictionary(敌,可选)}
func setup(p_chapter_label: String, p_team: Array[Dictionary], p_enemies: Array[Dictionary]) -> void:
	chapter_label = p_chapter_label
	board = BabelBoard.create_from_cfg()
	resolver = BabelResolver.create_from_cfg()
	tm = BabelTurnManager.new(board, resolver)
	chief_sys = BabelChiefSystem.create_default()
	enemy_ai = BabelEnemyAI.new()
	tm.enemy_turn_callback = Callable(self, "_run_enemy_phase")
	tm.battle_over.connect(_on_battle_over)
	tm.round_started.connect(_on_round_started)
	_build_terrain()
	var player_slots: Array[Vector2i] = [Vector2i(2, 7), Vector2i(5, 7), Vector2i(8, 7)]
	var idx: int = 0
	for d: Dictionary in p_team:
		var u: BabelUnit = _mk_unit(d, true)
		var slot: Vector2i = player_slots[mini(idx, player_slots.size() - 1)]
		board.place(u, slot)
		tm.players.append(u)
		idx += 1
	var enemy_slots: Array[Vector2i] = [Vector2i(1, 1), Vector2i(4, 0), Vector2i(6, 1), Vector2i(9, 0), Vector2i(10, 1), Vector2i(2, 0), Vector2i(8, 1)]
	idx = 0
	for d: Dictionary in p_enemies:
		var u2: BabelUnit = _mk_unit(d, false)
		var slot2: Vector2i = enemy_slots[mini(idx, enemy_slots.size() - 1)]
		board.place(u2, slot2)
		tm.enemies.append(u2)
		idx += 1
	for u3: BabelUnit in tm.players:
		u3.hp_changed.connect(_on_unit_hp_changed)
		u3.unit_died.connect(_on_unit_died)
	for u4: BabelUnit in tm.enemies:
		u4.hp_changed.connect(_on_unit_hp_changed)
		u4.unit_died.connect(_on_unit_died)
	_resolve_boss_unit()
	for e: BabelUnit in tm.enemies:
		if BabelEnemyAI.has_trait(e, "boss_dread") and boss_dread_stacks > 0:
			BabelEnemyAI.add_dread(e, boss_dread_stacks)
	selected = _first_alive_player()
	tm.begin_round()
	_build_panel()
	_refresh_panel()
	queue_redraw()


func _mk_unit(d: Dictionary, is_player: bool) -> BabelUnit:
	var uid: String = str(d.get("id", ""))
	var u: BabelUnit = BabelUnit.new(uid, is_player)
	if is_player:
		u.chief_id = uid
	else:
		u.enemy_id = uid
	u.max_hp = int(d.get("hp", 30))
	u.hp = u.max_hp
	u.move_max = int(d.get("move", 3))
	u.move_left = u.move_max
	u.shield = int(d.get("shield", 0))
	unit_names[uid] = str(d.get("name_cn", uid))
	unit_dmg[uid] = int(d.get("dmg", 0))
	var sk: Variant = d.get("skills", [])
	var skill_list: Array[String] = []
	if sk is Array:
		for s: Variant in (sk as Array):
			skill_list.append(str(s))
	unit_skills[uid] = skill_list
	if not is_player:
		# 敌人 traits/params 装入 state（BabelEnemyAI 按此读取）
		var traits: Variant = d.get("traits", [])
		var tl: Array[String] = []
		if traits is Array:
			for t: Variant in (traits as Array):
				tl.append(str(BabelEnemyAI.TRAIT_ALIASES.get(str(t), str(t))))
		u.state["traits"] = tl
		var params: Variant = d.get("params", {})
		if params is Dictionary:
			u.state["params"] = params
		u.state["dmg"] = int(d.get("dmg", 0))
	var extras: Variant = d.get("state", {})
	if extras is Dictionary:
		for key: String in (extras as Dictionary).keys():
			u.state[key] = (extras as Dictionary).get(key)
	return u


## 解析章节 Boss 单位：优先 boss_id 匹配，其次 boss_dread 特征
func _resolve_boss_unit() -> void:
	boss_unit = null
	if boss_id != "":
		for e: BabelUnit in tm.enemies:
			if e.enemy_id == boss_id:
				boss_unit = e
				return
	for e2: BabelUnit in tm.enemies:
		if BabelEnemyAI.has_trait(e2, "boss_dread"):
			boss_unit = e2
			return


func _build_terrain() -> void:
	board.set_terrain(Vector2i(5, 4), "fire")
	board.set_terrain(Vector2i(2, 3), "water")
	board.set_terrain(Vector2i(8, 5), "water")
	board.set_terrain(Vector2i(4, 6), "cover")
	board.set_terrain(Vector2i(6, 6), "cover")


## ---------- 纯逻辑（可 headless 测试） ----------

## 朝向按固定环循环切换，返回新朝向
func rotate_facing(u: BabelUnit) -> Vector2i:
	var idx: int = FACING_CYCLE.find(u.facing)
	if idx < 0:
		idx = 0
	var next: Vector2i = FACING_CYCLE[(idx + 1) % FACING_CYCLE.size()]
	u.facing = next
	queue_redraw()
	return next


## 可达格：曼哈顿距离 <= 剩余移动 且为空格（不含自身格）
func reachable_cells(u: BabelUnit) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	if u == null or not u.alive or board == null:
		return out
	for y: int in range(board.rows):
		for x: int in range(board.cols):
			var p: Vector2i = Vector2i(x, y)
			if p == u.pos or board.unit_at(p) != null:
				continue
			if board.manhattan(u.pos, p) <= u.move_left:
				out.append(p)
	return out


## 玩家移动：走 BabelTurnManager.try_move，按位移主轴自动更新朝向
func try_player_move(u: BabelUnit, to: Vector2i) -> bool:
	if u == null or to == u.pos:
		return false
	var dir: Vector2i = to - u.pos
	if not tm.try_move(u, to):
		return false
	u.facing = _axis_dir(dir)
	_refresh_panel()
	queue_redraw()
	return true


func _axis_dir(v: Vector2i) -> Vector2i:
	if absi(v.x) >= absi(v.y):
		return Vector2i(signi(v.x), 0)
	return Vector2i(0, signi(v.y))


## 技能是否已接线（damage 且 value>0，或火刑柱式铺地形）
static func is_skill_supported(skill: Dictionary) -> bool:
	if str(skill.get("id", "")) == "SK_PYRE":
		return true
	var tags: Variant = skill.get("tags", [])
	if tags is Array and (tags as Array).has("damage"):
		return int(skill.get("value", 0)) > 0
	return false


## 技能目标格合法性：single/cross/3x3 按曼哈顿距离；line/pierce 需同行或同列
func is_target_valid(u: BabelUnit, skill: Dictionary, target: Vector2i) -> bool:
	if not board.in_bounds(target):
		return false
	var rng: int = int(skill.get("range", 0))
	var shape: String = str(skill.get("shape", "single"))
	if shape == "line" or shape == "pierce":
		if target == u.pos:
			return false
		return target.x == u.pos.x or target.y == u.pos.y
	return board.manhattan(u.pos, target) <= maxi(rng, 0)


## 形状取格：以目标格为中心；line/pierce 沿施法者→目标主轴延伸
func skill_cells(u: BabelUnit, skill: Dictionary, target: Vector2i) -> Array[Vector2i]:
	var shape: String = str(skill.get("shape", "single"))
	var rng: int = int(skill.get("range", 0))
	var dir: Vector2i = _axis_dir(target - u.pos)
	if dir == Vector2i.ZERO:
		dir = u.facing
	return board.cells_in_shape(shape, target, dir, rng)


## 施放技能（目标格已合法）；返回是否成功。
## 8 个技能 + 火刑柱/扛棺冲锋走 BabelChiefSystem.execute_skill；其余 damage 技能走通用伤害。
func cast_skill(u: BabelUnit, skill: Dictionary, target: Vector2i) -> bool:
	if u == null or not u.can_act() or tm.phase != "player":
		return false
	if not is_target_valid(u, skill, target):
		return false
	if int(u.cds.get(str(skill.get("id", "")), 0)) > 0:
		return false
	if not tm.try_cast(u, skill, [target]):
		return false
	var sid: String = str(skill.get("id", ""))
	_log("%s 施放 [%s]" % [unit_names.get(u.unit_id, u.unit_id), str(skill.get("name_cn", sid))])
	_spawn_float(u.pos, str(skill.get("name_cn", sid)), Color("ffd166"))
	var options: Dictionary = {"corpses": corpses.size()}
	if u.state.has("relic_sacrifice_redirect"):
		options["sacrifice_redirect"] = true
	if CHIEF_SKILL_IDS.has(sid):
		if sid == "SK_PYRE":
			var pm: Variant = skill.get("params")
			if pm is Dictionary:
				fire_dmg = int((pm as Dictionary).get("burn_dmg", fire_dmg))
		var results: Array[Dictionary] = chief_sys.execute_skill(skill, u, [target] as Array, board, resolver, tm.players, options)
		_apply_skill_results(sid, results)
	else:
		var tags: Variant = skill.get("tags", [])
		var value: int = int(skill.get("value", 0))
		if tags is Array and (tags as Array).has("damage") and value > 0:
			_apply_damage(u, skill_cells(u, skill, target), value)
	_refresh_panel()
	queue_redraw()
	return true


## execute_skill 返回结果落地：回溯复位 / 骨仆召唤 / 日志
func _apply_skill_results(_sid: String, results: Array[Dictionary]) -> void:
	for r: Dictionary in results:
		var action: String = str(r.get("action", ""))
		match action:
			"rewind":
				var v: Variant = r.get("unit")
				if v is BabelUnit:
					_rewind_unit(v as BabelUnit)
			"summon":
				_spawn_bone_servants()
			"damage":
				var res_list: Variant = r.get("results")
				if res_list is Array:
					for d: Variant in (res_list as Array):
						if d is Dictionary and bool((d as Dictionary).get("killed", false)):
							_log("命中目标被击破")
			"tide":
				var pushed: Variant = r.get("pushed")
				if pushed is Array:
					for p: Variant in (pushed as Array):
						if p is Dictionary:
							var pd: Dictionary = p as Dictionary
							var pu: Variant = pd.get("unit")
							if pu is BabelUnit:
								_log("潮涌推动 %s → %s" % [unit_names.get((pu as BabelUnit).unit_id, "?"), str(pd.get("to", ""))])
			"coffin_wall":
				_log("棺墙铺就 %d 格掩体（HP %d）" % [(r.get("cells") as Array).size(), int(r.get("hp", 0))])
			"holy_rain":
				_log("圣雨浸湿 %d 名敌人（后续受击 +3）" % [(r.get("units") as Array).size()])
			"silence":
				var silenced: BabelUnit = r.get("unit") as BabelUnit
				_log("%s 被沉默 %d 回合" % [unit_names.get(silenced.unit_id, silenced.unit_id), int(r.get("rounds", 0))])
			"shadow_swap":
				if bool(r.get("ok", false)):
					_log("影替换位完成，双方 +5 盾")
			"offer":
				if bool(r.get("redirected", false)):
					_log("献祭转向敌方全体")
				else:
					_log("献祭：自损 %d，全队攻击 +%d" % [int(r.get("self_loss", 0)), int(r.get("team_add", 0))])
			"terrain_fire":
				_log("目标格燃起火格")
			_:
				pass


## SK_REWIND：单位回到本回合开始位置并重置行动
func _rewind_unit(u: BabelUnit) -> void:
	var sp: Variant = round_start_pos.get(u.unit_id, u.pos)
	if sp is Vector2i and board.in_bounds(sp as Vector2i) and board.unit_at(sp as Vector2i) == null:
		board.move_unit(u, sp as Vector2i)
	u.acted = false
	_log("%s 回溯到回合开始位置 %s" % [unit_names.get(u.unit_id, u.unit_id), str(u.pos)])


## SK_BONE_MAUSOLEUM：每具尸体生成 1 个 3HP 骨仆（我方召唤单位，可移动可攻击）
func _spawn_bone_servants() -> void:
	var n: int = corpses.size()
	for i: int in range(n):
		var pos: Vector2i = corpses[i]
		if board.unit_at(pos) != null or not board.in_bounds(pos):
			continue
		var bone: BabelUnit = BabelUnit.new("bone_%d_%d" % [tm.round_idx, i], true)
		bone.max_hp = BONE_HP
		bone.hp = BONE_HP
		bone.move_max = BONE_MOVE
		bone.move_left = BONE_MOVE
		bone.chief_id = ""
		board.place(bone, pos)
		tm.players.append(bone)
		bone.hp_changed.connect(_on_unit_hp_changed)
		bone.unit_died.connect(_on_unit_died)
		unit_names[bone.unit_id] = "骨仆"
		unit_dmg[bone.unit_id] = BONE_DMG
		unit_skills[bone.unit_id] = [] as Array[String]
		_log("骨仆自尸堆中站起（HP %d）" % [BONE_HP])
	corpses.clear()


func _apply_damage(caster: BabelUnit, cells: Array[Vector2i], base: int) -> void:
	for cell: Vector2i in cells:
		var v: Variant = board.unit_at(cell)
		if v is BabelUnit:
			var t: BabelUnit = v as BabelUnit
			if t.is_player == caster.is_player:
				continue
			var bonus: int = int(caster.state.get("atk_bonus", 0))
			var dmg: int = base + bonus
			dmg = int(round(float(dmg) * chief_sys.damage_bonus(caster, t, board)))
			# front_block：正面减伤敌人（玩家攻击结算时乘区）
			if not t.is_player:
				dmg = maxi(int(round(float(dmg) * BabelEnemyAI.front_block_mul(t))), 1)
			var res: Dictionary = resolver.resolve_damage(caster, t, dmg, board)
			_spawn_float(t.pos, str(int(res.get("after_facing", 0))), Color("ff6b6b"))
			if bool(res.get("killed", false)):
				_log("%s 被击破" % [unit_names.get(t.unit_id, t.unit_id)])


## 全员行动完则推进回合；否则切到下一名未行动的玩家单位
func advance_actor() -> void:
	selected = null
	mode = "idle"
	pending_skill = {}
	var next: BabelUnit = _next_unacted_player()
	if next != null:
		selected = next
		_refresh_panel()
		return
	tm.end_player_round()
	selected = _first_alive_player()
	_refresh_panel()
	queue_redraw()


func _next_unacted_player() -> BabelUnit:
	for u: BabelUnit in tm.players:
		if u.alive and not u.acted and int(u.state.get("stunned_rounds", 0)) == 0:
			return u
	return null


func _first_alive_player() -> BabelUnit:
	for u: BabelUnit in tm.players:
		if u.alive:
			return u
	return null


func _nearest_player(from: Vector2i) -> BabelUnit:
	var best: BabelUnit = null
	var best_d: int = 999999
	for u: BabelUnit in tm.players:
		if not u.alive:
			continue
		var d: int = board.manhattan(from, u.pos)
		if d < best_d:
			best_d = d
			best = u
	return best


## 简版敌方 AI（兼容保留）：贪心走近最近玩家，贴身则攻击。
func enemy_ai_step(e: BabelUnit) -> void:
	var target: BabelUnit = _nearest_player(e.pos)
	if target == null:
		return
	var guard: int = 0
	while e.alive and e.move_left > 0 and guard < 16:
		guard += 1
		if board.manhattan(e.pos, target.pos) <= 1:
			break
		var best: Vector2i = e.pos
		var best_d: int = board.manhattan(e.pos, target.pos)
		for n: Vector2i in board.neighbors4(e.pos):
			if board.in_bounds(n) and board.unit_at(n) == null:
				var d: int = board.manhattan(n, target.pos)
				if d < best_d:
					best_d = d
					best = n
		if best == e.pos:
			break
		board.move_unit(e, best)
		e.consume_move()
	if e.alive and board.manhattan(e.pos, target.pos) <= 1:
		e.facing = _axis_dir(target.pos - e.pos)
		var dmg: int = int(unit_dmg.get(e.unit_id, 0))
		var res: Dictionary = resolver.resolve_damage(e, target, dmg, board)
		_spawn_float(target.pos, str(int(res.get("after_facing", 0))), Color("ff6b6b"))
		_log("%s 攻击 %s" % [unit_names.get(e.unit_id, e.unit_id), unit_names.get(target.unit_id, target.unit_id)])
	queue_redraw()


## 完整敌方 AI：BabelEnemyAI.decide_action 决策并落地
## （移动/AoE/光环/拉人/召唤/震退在 decide 内执行；attack/aoe/summon 在此结算）。每步 _log 保证可读。
func _execute_enemy_ai(e: BabelUnit) -> void:
	var plan: Dictionary = enemy_ai.decide_action(e, board, tm.players)
	var action: String = str(plan.get("action", "wait"))
	match action:
		"attack":
			var t: Variant = plan.get("target")
			if t is BabelUnit:
				var target: BabelUnit = t as BabelUnit
				var dmg: int = int(plan.get("dmg", 0))
				dmg += BabelEnemyAI.backstab_bonus(e)
				if BabelEnemyAI.has_trait(e, "boss_dread"):
					dmg = BabelEnemyAI.boss_damage(e)
				var res: Dictionary = resolver.resolve_damage(e, target, dmg, board)
				_spawn_float(target.pos, str(int(res.get("after_facing", 0))), Color("ff6b6b"))
				_log("%s 攻击 %s（%d 伤）" % [unit_names.get(e.unit_id, e.unit_id), unit_names.get(target.unit_id, target.unit_id), int(res.get("after_facing", 0))])
		"aoe":
			var center_dmg: int = int(plan.get("center_dmg", 0))
			var edge_dmg: int = int(plan.get("edge_dmg", 0))
			var cells: Variant = plan.get("cells")
			if cells is Array:
				for c: Variant in (cells as Array):
					if not (c is Vector2i):
						continue
					var cell: Vector2i = c as Vector2i
					var v: Variant = board.unit_at(cell)
					if v is BabelUnit and (v as BabelUnit).is_player and (v as BabelUnit).alive:
						var dmg2: int = center_dmg if cell == e.pos else edge_dmg
						if dmg2 > 0:
							resolver.resolve_damage(e, v as BabelUnit, dmg2, board)
				_log("%s 释放 AoE（中心 %d / 外圈 %d）" % [unit_names.get(e.unit_id, e.unit_id), center_dmg, edge_dmg])
		"summon":
			var spec: Variant = plan.get("unit")
			if spec is Dictionary:
				_spawn_enemy_summon(e, spec as Dictionary)
		"pull":
			_log("%s 拉拽 %s" % [unit_names.get(e.unit_id, e.unit_id), unit_names.get((plan.get("unit") as BabelUnit).unit_id, "?")])
		"shockwave":
			_log("%s 鸣钟震退 %d 个单位" % [unit_names.get(e.unit_id, e.unit_id), (plan.get("pushed") as Array).size()])
		"aura_shield":
			_log("%s 光环加持 %d 名友军护盾" % [unit_names.get(e.unit_id, e.unit_id), (plan.get("targets") as Array).size()])
		_:
			_log("%s 待命" % [unit_names.get(e.unit_id, e.unit_id)])
	queue_redraw()


## 敌方召唤落地：在计划格生成敌人单位并入队
func _spawn_enemy_summon(caster: BabelUnit, spec: Dictionary) -> void:
	var pos_v: Variant = spec.get("pos", Vector2i(-999, -999))
	if not (pos_v is Vector2i):
		return
	var pos: Vector2i = pos_v as Vector2i
	if not board.in_bounds(pos) or board.unit_at(pos) != null:
		return
	var uid: String = str(spec.get("id", "EN01")) + "_s%d" % [tm.round_idx]
	var u: BabelUnit = BabelUnit.new(uid, false)
	u.enemy_id = str(spec.get("id", "EN01"))
	u.max_hp = int(spec.get("hp", 6))
	u.hp = u.max_hp
	u.move_max = 2
	u.move_left = 2
	u.state["traits"] = [] as Array[String]
	u.state["params"] = {}
	u.state["dmg"] = 2
	board.place(u, pos)
	tm.enemies.append(u)
	u.hp_changed.connect(_on_unit_hp_changed)
	u.unit_died.connect(_on_unit_died)
	unit_names[uid] = "召唤物·" + u.enemy_id
	unit_dmg[uid] = 2
	unit_skills[uid] = [] as Array[String]
	_log("%s 召唤了 %s" % [unit_names.get(caster.unit_id, caster.unit_id), unit_names[uid]])


## 敌方回合（BabelTurnManager.enemy_turn_callback 注入点）
func _run_enemy_phase() -> void:
	for e: BabelUnit in tm.enemies:
		if not e.alive:
			continue
		if enemy_turn_hook.is_valid():
			enemy_turn_hook.call(e)
		else:
			_execute_enemy_ai(e)


func _on_round_started(idx: int) -> void:
	_log("回合 %d 开始" % [idx])
	# 记录回合开始位置（SK_REWIND 复位基准）
	for u: BabelUnit in tm.players:
		round_start_pos[u.unit_id] = u.pos
	for e: BabelUnit in tm.enemies:
		round_start_pos[e.unit_id] = e.pos
	# 火格持续伤害
	for u2: BabelUnit in tm.players:
		if u2.alive and board.terrain_at(u2.pos) == "fire":
			var res: Dictionary = resolver.resolve_damage(null, u2, fire_dmg, board)
			_spawn_float(u2.pos, str(int(res.get("after_facing", 0))), Color("e76f51"))
	for e2: BabelUnit in tm.enemies:
		if e2.alive and board.terrain_at(e2.pos) == "fire":
			resolver.resolve_damage(null, e2, fire_dmg, board)
	# Boss 突变：圣偿（每 interval 回合回复比例 HP）
	if boss_unit != null and boss_unit.alive and str(boss_mutation.get("type", "")) == "holy_repay":
		var pm: Variant = boss_mutation.get("params")
		if pm is Dictionary:
			var interval: int = int((pm as Dictionary).get("interval_rounds", 5))
			if interval > 0 and idx % interval == 0:
				var heal: int = int(ceil(float(boss_unit.max_hp) * float((pm as Dictionary).get("heal_ratio", 0.05))))
				boss_unit.apply_hp(heal)
				_log("圣偿：%s 回复 %d HP" % [unit_names.get(boss_unit.unit_id, boss_unit.unit_id), heal])


func _on_battle_over(winner: String) -> void:
	_log("战斗结束：%s 胜" % [winner])
	battle_finished.emit(winner)


func _on_unit_hp_changed(unit: Variant, delta: int) -> void:
	if unit is BabelUnit:
		var u: BabelUnit = unit as BabelUnit
		if delta < 0:
			_log("%s 受 %d 伤（HP %d）" % [unit_names.get(u.unit_id, u.unit_id), -delta, u.hp])
		# Boss 突变：神怒（首次跌破阈值对全体玩家 AoE）
		if u == boss_unit and not wrath_done and u.alive and str(boss_mutation.get("type", "")) == "divine_wrath":
			var pm: Variant = boss_mutation.get("params")
			if pm is Dictionary:
				var threshold: float = float((pm as Dictionary).get("threshold", 0.5))
				if float(u.hp) <= float(u.max_hp) * threshold:
					wrath_done = true
					var aoe: int = int((pm as Dictionary).get("aoe_dmg", 12))
					_log("神怒降临：%s 对全队释放 %d 点 AoE" % [unit_names.get(u.unit_id, u.unit_id), aoe])
					for p: BabelUnit in tm.players:
						if p.alive:
							resolver.resolve_damage(u, p, aoe, board)
	_refresh_panel()


func _on_unit_died(unit: Variant) -> void:
	if unit is BabelUnit:
		var u: BabelUnit = unit as BabelUnit
		_log("%s 阵亡" % [unit_names.get(u.unit_id, u.unit_id)])
		# 尸体登记（SK_BONE_MAUSOLEUM 素材）
		if board.in_bounds(u.pos) and not corpses.has(u.pos):
			corpses.append(u.pos)
		if not u.is_player:
			kills += 1
			kills_changed.emit(kills)
		# smoke 特征：死亡留烟格
		for cell: Dictionary in BabelEnemyAI.on_death_cells(u):
			var pos_v: Variant = cell.get("pos")
			if pos_v is Vector2i:
				board.set_terrain(pos_v as Vector2i, "fire", int(cell.get("dmg", 2)))
	queue_redraw()


## ---------- 交互 ----------

func _unhandled_input(event: InputEvent) -> void:
	if board == null:
		return
	if event is InputEventMouseMotion:
		hover_cell = _cell_at((event as InputEventMouseMotion).position)
		queue_redraw()
	elif event is InputEventMouseButton:
		var mb: InputEventMouseButton = event as InputEventMouseButton
		if not mb.pressed:
			return
		if mb.button_index == MOUSE_BUTTON_RIGHT:
			mode = "idle"
			pending_skill = {}
			queue_redraw()
			return
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_on_cell_clicked(_cell_at(mb.position))


func _cell_at(screen_pos: Vector2) -> Vector2i:
	var rel: Vector2 = screen_pos - BOARD_ORIGIN
	var c: int = int(floor(rel.x / float(TILE)))
	var r: int = int(floor(rel.y / float(TILE)))
	return Vector2i(c, r)


func _on_cell_clicked(cell: Vector2i) -> void:
	if not board.in_bounds(cell) or tm.phase != "player":
		return
	if mode == "target" and selected != null:
		if is_target_valid(selected, pending_skill, cell):
			var skill: Dictionary = pending_skill
			mode = "idle"
			pending_skill = {}
			if cast_skill(selected, skill, cell):
				advance_actor()
			else:
				_log("施放失败")
		else:
			_log("目标超出范围")
		queue_redraw()
		return
	var v: Variant = board.unit_at(cell)
	if v is BabelUnit and (v as BabelUnit).is_player and (v as BabelUnit).alive:
		selected = v as BabelUnit
		_refresh_panel()
		queue_redraw()
		return
	if selected != null and selected.alive:
		if reachable_cells(selected).has(cell):
			try_player_move(selected, cell)


## 技能按钮点击：进入目标选择
func on_skill_button_pressed(skill_idx: int) -> void:
	if selected == null or not selected.alive:
		return
	var skill_list: Array[String] = unit_skills.get(selected.unit_id, []) as Array[String]
	if skill_idx >= skill_list.size():
		return
	var skill: Variant = skills_cfg.get(skill_list[skill_idx])
	if skill is Dictionary:
		pending_skill = skill as Dictionary
		mode = "target"
		_log("选择目标格施放 [%s]，右键取消" % [str(pending_skill.get("name_cn", ""))])
		queue_redraw()


func on_wait_pressed() -> void:
	if selected != null and selected.alive:
		selected.consume_action()
		advance_actor()


func on_face_pressed() -> void:
	if selected != null and selected.alive:
		rotate_facing(selected)


## ---------- 绘制 ----------

func _draw() -> void:
	if board == null:
		return
	var reach: Array[Vector2i] = []
	var targets: Array[Vector2i] = []
	if selected != null and selected.alive and tm.phase == "player" and mode == "idle":
		reach = reachable_cells(selected)
	if mode == "target" and selected != null:
		for y: int in range(board.rows):
			for x: int in range(board.cols):
				var p: Vector2i = Vector2i(x, y)
				if is_target_valid(selected, pending_skill, p):
					targets.append(p)
	for y: int in range(board.rows):
		for x: int in range(board.cols):
			var p2: Vector2i = Vector2i(x, y)
			var rect: Rect2 = Rect2(BOARD_ORIGIN + Vector2(x * TILE, y * TILE), Vector2(TILE - 2, TILE - 2))
			var col: Color = COLOR_BOARD
			var terr: String = board.terrain_at(p2)
			if terr == "fire":
				col = COLOR_FIRE
			elif terr == "water":
				col = COLOR_WATER
			elif terr == "cover":
				col = COLOR_COVER
			draw_rect(rect, col)
			if reach.has(p2):
				draw_rect(rect, COLOR_REACH)
			if targets.has(p2):
				draw_rect(rect.grow(-4), COLOR_TARGET, false, 3)
			if p2 == hover_cell:
				draw_rect(rect, COLOR_HOVER, false, 2)
			var v: Variant = board.unit_at(p2)
			if v is BabelUnit:
				var u: BabelUnit = v as BabelUnit
				_draw_unit(u, rect)


func _draw_unit(u: BabelUnit, rect: Rect2) -> void:
	var body: Rect2 = rect.grow(-8)
	draw_rect(body, COLOR_PLAYER if u.is_player else COLOR_ENEMY)
	if u == selected:
		draw_rect(rect, COLOR_SELECT, false, 3)
	# 朝向指示：朝向边中点小方块
	var center: Vector2 = rect.get_center()
	var tip: Vector2 = center + Vector2(u.facing) * (TILE * 0.38)
	draw_circle(tip, 5.0, Color(1, 1, 1, 0.9))
	# 血条
	var hp_ratio: float = float(u.hp) / float(maxi(u.max_hp, 1))
	var bar_bg: Rect2 = Rect2(rect.position + Vector2(4, -10), Vector2(TILE - 10, 6))
	draw_rect(bar_bg, Color(0, 0, 0, 0.6))
	draw_rect(Rect2(bar_bg.position, Vector2(bar_bg.size.x * hp_ratio, 6)), Color("4caf50"))
	# 盾条
	if u.shield > 0:
		var sh_ratio: float = float(u.shield) / float(maxi(u.shield_cap, 1))
		var sh_bg: Rect2 = Rect2(rect.position + Vector2(4, -18), Vector2(TILE - 10, 5))
		draw_rect(sh_bg, Color(0, 0, 0, 0.6))
		draw_rect(Rect2(sh_bg.position, Vector2(sh_bg.size.x * clampf(sh_ratio, 0.0, 1.0), 5)), Color("90caf9"))
	var font: Font = ThemeDB.fallback_font
	draw_string(font, rect.position + Vector2(6, TILE - 10), unit_names.get(u.unit_id, u.unit_id) as String, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1, 1, 1, 0.85))


## ---------- 面板与飘字 ----------

func _build_panel() -> void:
	if panel != null:
		panel.queue_free()
	panel = Panel.new()
	panel.position = Vector2(0, 720)
	panel.size = Vector2(720, 560)
	add_child(panel)
	lbl_round = Label.new()
	lbl_round.position = Vector2(16, 10)
	lbl_round.text = ""
	panel.add_child(lbl_round)
	bar_round = ProgressBar.new()
	bar_round.position = Vector2(160, 12)
	bar_round.size = Vector2(400, 18)
	bar_round.min_value = 0
	bar_round.max_value = 25
	panel.add_child(bar_round)
	lbl_actor = Label.new()
	lbl_actor.position = Vector2(16, 40)
	panel.add_child(lbl_actor)
	lbl_info = Label.new()
	lbl_info.position = Vector2(16, 70)
	panel.add_child(lbl_info)
	btn_skills.clear()
	for i: int in range(2):
		var b: Button = Button.new()
		b.position = Vector2(16 + i * 350, 110)
		b.size = Vector2(330, 52)
		var captured: int = i
		b.pressed.connect(func() -> void: on_skill_button_pressed(captured))
		panel.add_child(b)
		btn_skills.append(b)
	btn_face = Button.new()
	btn_face.position = Vector2(16, 175)
	btn_face.size = Vector2(160, 44)
	btn_face.text = "转向"
	btn_face.pressed.connect(on_face_pressed)
	panel.add_child(btn_face)
	btn_wait = Button.new()
	btn_wait.position = Vector2(200, 175)
	btn_wait.size = Vector2(160, 44)
	btn_wait.text = "待机"
	btn_wait.pressed.connect(on_wait_pressed)
	panel.add_child(btn_wait)
	lbl_log = Label.new()
	lbl_log.position = Vector2(16, 240)
	lbl_log.size = Vector2(690, 300)
	lbl_log.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	panel.add_child(lbl_log)


func _refresh_panel() -> void:
	if panel == null or tm == null:
		return
	lbl_round.text = "回合 %d / 25" % [tm.round_idx]
	bar_round.value = tm.round_idx
	var acting: String = "敌方回合" if tm.phase != "player" else "—"
	if tm.phase == "player" and selected != null:
		acting = "行动中：%s" % str(unit_names.get(selected.unit_id, selected.unit_id))
	lbl_actor.text = "%s  %s" % [chapter_label, acting]
	if selected != null:
		var sk_txt: String = ""
		var skill_list: Array[String] = (unit_skills.get(selected.unit_id, []) as Array).slice(0, 2) as Array[String]
		for i: int in range(btn_skills.size()):
			var b: Button = btn_skills[i]
			if i < skill_list.size():
				var skill: Variant = skills_cfg.get(skill_list[i])
				if skill is Dictionary:
					var sd: Dictionary = skill as Dictionary
					var cd_left: int = int(selected.cds.get(str(sd.get("id", "")), 0))
					if cd_left > 0:
						b.text = "%s 冷却 %d" % [str(sd.get("name_cn", "")), cd_left]
						b.disabled = true
					else:
						b.text = "%s (%d 伤 CD%d)" % [str(sd.get("name_cn", "")), int(sd.get("value", 0)), int(sd.get("cd", 0))]
						b.disabled = false
					sk_txt += "%s：%s\n" % [str(sd.get("name_cn", "")), str(sd.get("desc", ""))]
					continue
			b.text = "-"
			b.disabled = true
		lbl_info.text = "HP %d/%d  盾 %d/%d  移动 %d  朝向 %s\n%s" % [
			selected.hp, selected.max_hp, selected.shield, selected.shield_cap,
			selected.move_left, _facing_cn(selected.facing), sk_txt
		]
	else:
		lbl_info.text = ""
	lbl_log.text = "\n".join(log_lines)


func _facing_cn(f: Vector2i) -> String:
	if f == Vector2i(0, -1):
		return "上"
	if f == Vector2i(1, 0):
		return "右"
	if f == Vector2i(0, 1):
		return "下"
	if f == Vector2i(-1, 0):
		return "左"
	return "?"


func _log(line: String) -> void:
	log_lines.append(line)
	while log_lines.size() > LOG_LINES_MAX:
		log_lines.remove_at(0)
	log_added.emit(line)
	if lbl_log != null:
		lbl_log.text = "\n".join(log_lines)


## 录屏 3 秒定律：伤害/技能飘字，1.2s 上浮消失
func _spawn_float(cell: Vector2i, text: String, color: Color) -> void:
	if not is_inside_tree():
		return
	var lbl: Label = Label.new()
	lbl.text = text
	lbl.add_theme_color_override("font_color", color)
	lbl.add_theme_font_size_override("font_size", 22)
	lbl.position = BOARD_ORIGIN + Vector2(cell.x * TILE + 8, cell.y * TILE - 6)
	lbl.z_index = 10
	add_child(lbl)
	var tw: Tween = create_tween()
	tw.set_parallel(true)
	tw.tween_property(lbl, "position:y", lbl.position.y - 44.0, 1.2)
	tw.tween_property(lbl, "modulate:a", 0.0, 1.2).set_delay(0.2)
	tw.chain().tween_callback(lbl.queue_free)
