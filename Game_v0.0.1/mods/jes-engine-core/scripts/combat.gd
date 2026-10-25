## 战斗核心（P3 纵向切片）—— 逻辑层，无场景依赖，可 headless 测试
## 真源口径：
##   - 怪移动 = FlowField 全局寻路（修复 HTML 版 resolveObstacles 局部推挤死锁）
##     + SpatialHash 邻域分离力（steering 局部层）
##   - 子弹 = substep 检测（步长 <= 半径，杜绝穿墙/穿怪；命中即 vanish，pierce>0 穿透计数）
##   - 数据全部来自 cfg/*.json（P2 导出表）：heroes / monsters / skills / levels
## 命名铁律：函数与变量一律 ASCII；中文只进注释与字符串。
class_name JesCombat
extends RefCounted

signal monster_killed(m: Dictionary)
signal player_damaged(amount: float)
signal bullet_vanished(b: Dictionary)
signal boss_spawned(m: Dictionary)
signal chest_spawned(chest: Dictionary)
signal chest_picked(chest: Dictionary)
signal floor_advanced(floor_no: int, rewards: Array)

## null 保持普通关卡原行为；无尽由调用方 begin 后注入。
var endless_mode = null

## ---------- 世界参数（LEVEL_001：1920×1920） ----------
var world_size := Vector2(1920, 1920)
## 障碍 AABB 列表（Rect2 世界坐标；渲染层同用此列表画墙）
var walls: Array[Rect2] = []

## ---------- 玩家（H001 猎手） ----------
var player := {
	"pos": Vector2(960, 960), "hp": 94.0, "hp_max": 94.0,
	"spd": 306.0, "radius": 18.0, "atk": 16.0, "def": 2.0,
	"alive": true, "hit_cd": 0.0,
}
## 武器基础技能 AT101 速射：cd 0.5 / dmgMul 0.75 / 1 弹 / 弹速 620
var shoot_cd := 0.0
var shoot_interval := 0.5
var bullet_dmg_mul := 0.75
var bullet_spd := 620.0

## ---------- 实体 ----------
## 怪：{tpl, pos, hp, spd, radius, atk, def, dead, hit_flash, atk_cd, ranged}
var monsters: Array[Dictionary] = []
## 子弹：{pos, vel, dmg, radius, life, pierce, from_player}
var bullets: Array[Dictionary] = []
## 掉落经验球计数（简化：直接吸收）
var kills := 0
var exp_gained := 0
var coin_gained := 0

## ---------- 波次（LEVEL_001 circles 简化为循环刷怪队列） ----------
var wave_timer := 0.0
var wave_interval := 4.0
var wave_index := 0
## 刷怪模板池（近战 NM0010 + 远程 NM0011 + 快速 NM0013，权重见 _pick_tpl）
var spawn_pool: Array[String] = ["NM0010", "NM0010", "NM0011", "NM0013"]
var monster_cap := 120

## ---------- 怪物多样性 / 精英 / Boss / 波次成长（迁移自 HTLM/js/game.js + combat.js） ----------
## 加权刷怪池（由 levels.json circles + spawnCircles.json pool 表驱动；空则回落 spawn_pool）
var spawn_pool_w: Dictionary = {}
## 精英投放：每 elite_every_waves 波投 1 只，模板从 level.elitePool 加权取（真源 eliteSpawn 定点投放的波次化简版）
var elite_every_waves := 5
var elite_pool_w: Dictionary = {}
## Boss：每 boss_every_waves 波投 1 只（真源关卡制 Boss 的波次化简版），同屏仅 1 只
var boss_every_waves := 10
## 精英词缀表（真源 CFG.elites；键 = 词缀名，测试可注入小表）
var elite_cfg: Dictionary = {}
## 宝箱掉落表（真源 CFG.chestDrop：elite/boss 两档品质权重）
var chest_cfg: Dictionary = {}
## 波次成长曲线（真源 levelCurve.json rows[].hpMul；lv = monsterLevel + wave_index - 1）
var wave_curve: Dictionary = {}
## 关卡配置（levels.json 条目；供 monsterLevel / monsterCap / boss / elitePool 读取）
var level_cfg: Dictionary = {}
## 刷怪圆模板（spawnCircles.json；与 level.circles 一起合成 spawn_pool_w）
var spawn_circles: Dictionary = {}
## 敌人攻击倍率（真源 config.js：atkMul = 1.25 常量，不随波次涨）
var enemy_atk_mul := 1.25
## 精英体型放大（真源 CFG.elites.sizeMul）
var elite_size_mul := 1.35
## 精英额外经验（真源 CFG.elites.extraExp）
var elite_extra_exp := 2
## 宝箱拾取判定半径（地上标记，走近即拾；背包接口留 chest_picked 信号钩子）
var chest_pickup_radius := 40.0
## Boss 弹幕参数（真源 CFG.boss.bulletLife / PatternSystem 几何）
var boss_bullet_life := 6.0
var boss_bullet_spd_ring := 240.0
var boss_bullet_spd_fan := 280.0
var boss_ring_count := 12
var boss_fan_count := 7
var boss_fan_arc := TAU / 3.0

## ---------- 精英 / Boss / 宝箱实体 ----------
## 宝箱（数据体）：{pos, quality, from}；from = "elite"/"boss"
var chests: Array[Dictionary] = []

## ---------- 暴击（HTML 真源无暴击表，取通用缺省：15% / 2.0 倍；挂接点在玩家子弹生成） ----------
var crit_chance := 0.15
var crit_mul := 2.0
var crit_count := 0

## 真源缺省词缀（elite_cfg 未注入时用；数值对齐 CFG.elites.affixes）
var _default_affixes := {
	"坚韧": {"hpMul": 3.0, "defAdd": 2.0},
	"迅捷": {"spdMul": 1.5, "atkMul": 1.1},
	"狂暴": {"atkMul": 1.7, "spdMul": 1.15},
	"护盾": {"shieldHp": 60.0, "hpMul": 1.5},
}

## ---------- 基础设施 ----------
var field := FlowField.new()
var hash_mon: SpatialHash = SpatialHash.new(96)
var rng := RandomNumberGenerator.new()
## 流场重算节流（每 0.15s 一次，玩家移动中足够跟手）
var _field_timer := 0.0
var _field_interval := 0.15

## 配置表（setup 时注入，便于测试用小表）
var tpl_monsters: Dictionary = {}
var tpl_hero: Dictionary = {}

## ============================================================
## 初始化
## ============================================================
## extras 可选注入（测试用小表 / 渲染层传 Cfg 表）：
##   "spawnCircles" / "levelCurve" / "elites" / "chestDrop"（缺省用内置真源缺省值）
func setup(hero: Dictionary, monsters_table: Dictionary, level: Dictionary, extras: Dictionary = {}) -> void:
	rng.randomize()
	tpl_hero = hero
	tpl_monsters = monsters_table
	level_cfg = level
	var sc: Variant = extras.get("spawnCircles")
	spawn_circles = sc if sc is Dictionary else {}
	var lc: Variant = extras.get("levelCurve")
	wave_curve = lc if lc is Dictionary else {}
	var ec: Variant = extras.get("elites")
	elite_cfg = ec if ec is Dictionary else {}
	var cc: Variant = extras.get("chestDrop")
	chest_cfg = cc if cc is Dictionary else {}
	if level.has("mapW"):
		world_size = Vector2(float(level.mapW), float(level.mapH))
	player.hp_max = float(hero.get("hp", 94))
	player.hp = player.hp_max
	player.spd = float(hero.get("spd", 306))
	player.radius = float(hero.get("radius", 18))
	player.atk = float(hero.get("atk", 16))
	player.def = float(hero.get("def", 2))
	monster_cap = int(level.get("monsterCap", 120))
	# 刷怪池：levels.json circles → spawnCircles 模板 pool 权重合并；空表回落旧数组池
	spawn_pool_w = _build_spawn_pool(level)
	elite_pool_w = _parse_weight_pool(str(level.get("elitePool", "")))
	field.setup(world_size, 48.0)
	# 内圈开阔 + 四周留怪的示例障碍（正式关卡障碍表随 P3.5 接 levels 布局）
	_default_walls()
	field.set_walls(walls)
	field.recompute(player.pos)

## 示例障碍：中央十字掩体 + 四角 L 形（含凹形死端，验证流场绕行）
func _default_walls() -> void:
	var w := world_size
	var cx := w.x * 0.5
	var cy := w.y * 0.5
	walls = [
		Rect2(cx - 240, cy - 60, 360, 60),      # 中央横墙（左段，留右侧口）
		Rect2(cx + 200, cy + 60, 60, 300),      # 中央竖墙（下段，留上口）
		Rect2(120, 120, 60, 260),               # 左上 L 形竖臂
		Rect2(120, 320, 220, 60),               # 左上 L 形横臂（凹口朝右下）
		Rect2(w.x - 340, w.y - 380, 60, 260),   # 右下 L 形
		Rect2(w.x - 340, w.y - 380, 220, 60),
	]

## ============================================================
## 主步进（由 main.gd / 测试驱动；dt 已被主循环钳制）
## ============================================================
func step(dt: float, move_dir: Vector2, aim_dir: Vector2, want_shoot: bool) -> void:
	if not player.alive:
		return
	# --- 玩家移动（撞墙钳制：逐轴推回） ---
	if move_dir.length_squared() > 0.0:
		var np: Vector2 = player.pos + move_dir.normalized() * player.spd * dt
		np.x = clampf(np.x, player.radius, world_size.x - player.radius)
		np.y = clampf(np.y, player.radius, world_size.y - player.radius)
		for r in walls:
			np = _push_out(np, player.radius, r)
		player.pos = np
	# --- 玩家射击 ---
	shoot_cd = maxf(shoot_cd - dt, 0.0)
	if want_shoot and shoot_cd <= 0.0 and aim_dir.length_squared() > 0.0:
		_player_shoot(aim_dir.normalized())
	# --- 怪刷波 ---
	if endless_mode == null:
		wave_timer += dt
		if wave_timer >= wave_interval:
			wave_timer = 0.0
			wave_index += 1
			_spawn_wave()
	else:
		_step_endless_waves(dt)
	# --- 怪移动（流场 + 分离力）---
	_update_field(dt)
	_update_monsters(dt)
	# --- 子弹（substep 检测）---
	_update_bullets(dt)
	# --- 怪对玩家伤害 ---
	_monster_attack(dt)
	# --- Boss 弹幕（多阶段：血量阈值换弹幕模式）---
	_update_bosses(dt)
	# --- 宝箱拾取（数据体；背包接口走 chest_picked 信号钩子）---
	_pickup_chests()

## 无尽按层限制刷怪波数，最后一波清场后才推进；满屏不消耗波数。
func _step_endless_waves(dt: float) -> void:
	if endless_mode.wave <= 0:
		return
	compact_monsters()
	var cap: int = endless_mode.wave_cap(endless_mode.wave)
	if wave_index >= cap:
		if monsters.is_empty():
			var rewards: Array = endless_mode.next_floor()
			wave_index = 0
			wave_timer = 0.0
			bullets.clear()
			floor_advanced.emit(endless_mode.wave, rewards)
		return
	wave_timer += dt
	if wave_timer >= wave_interval and monsters.size() < monster_cap:
		wave_timer = 0.0
		wave_index += 1
		_spawn_wave()

## 流场节流重算（目标 = 玩家）
func _update_field(dt: float) -> void:
	_field_timer -= dt
	if _field_timer <= 0.0:
		_field_timer = _field_interval
		field.recompute(player.pos)

## ============================================================
## 玩家射击与子弹
## ============================================================
func _player_shoot(dir: Vector2) -> void:
	shoot_cd = shoot_interval
	# 暴击：生成子弹时掷骰，伤害直接乘倍率（飘字/HUD 简化为 crit_count 计数）
	var is_crit := rng.randf() < crit_chance
	var dmg: float = float(player.atk) * bullet_dmg_mul
	if is_crit:
		dmg *= crit_mul
		crit_count += 1
	_spawn_bullet(player.pos + dir * (player.radius + 6.0), dir * bullet_spd,
		dmg, 6.0, 1.4, 0, true, is_crit)

func _spawn_bullet(pos: Vector2, vel: Vector2, dmg: float, radius: float, life: float, pierce: int, from_player: bool, crit := false) -> void:
	bullets.append({
		"pos": pos, "vel": vel, "dmg": dmg, "radius": radius,
		"life": life, "pierce": pierce, "from_player": from_player, "crit": crit,
	})

## 子弹 substep：把一帧位移切成 <=半径/2 的步长，逐步检墙+检怪，杜绝隧穿
func _update_bullets(dt: float) -> void:
	var keep: Array[Dictionary] = []
	for b in bullets:
		b.life = float(b.life) - dt
		if b.life <= 0.0:
			bullet_vanished.emit(b)
			continue
		var remain: Vector2 = Vector2(b.vel) * dt
		var step_len: float = maxf(float(b.radius) * 0.5, 1.0)
		var steps := maxi(int(ceil(remain.length() / step_len)), 1)
		var gone := false
		for i in range(steps):
			b.pos = Vector2(b.pos) + remain / float(steps)
			# ① 墙检测（命中即 vanish；修复 HTML 版 Bullet.update 0 处检测的穿障 bug）
			if _point_in_walls(Vector2(b.pos), float(b.radius)):
				bullet_vanished.emit(b)
				gone = true
				break
			# ② 目标检测（玩家子弹查怪 / 怪子弹查玩家）
			if bool(b.from_player):
				if _bullet_hit_monster(b):
					if int(b.pierce) > 0:
						b.pierce = int(b.pierce) - 1
					else:
						bullet_vanished.emit(b)
						gone = true
						break
			else:
				var dp: Vector2 = Vector2(b.pos) - Vector2(player.pos)
				if dp.length() <= float(b.radius) + float(player.radius):
					_damage_player(float(b.dmg))
					bullet_vanished.emit(b)
					gone = true
					break
		if not gone:
			keep.append(b)
	bullets = keep

func _point_in_walls(p: Vector2, r: float) -> bool:
	for rect in walls:
		if rect.grow(r).has_point(p):
			return true
	return false

func _bullet_hit_monster(b: Dictionary) -> bool:
	for m in monsters:
		if bool(m.get("dead", false)):
			continue
		var d: Vector2 = Vector2(b.pos) - Vector2(m.pos)
		if d.length() <= float(b.radius) + float(m.radius):
			_damage_monster(m, float(b.dmg))
			return true
	return false

## ============================================================
## 怪：刷波 / 移动 / 伤害
## ============================================================
func _spawn_wave() -> void:
	if monsters.size() >= monster_cap:
		return
	# Boss 波：每 boss_every_waves 波投 1 只（真源关卡 Boss 的波次化简版）
	if boss_every_waves > 0 and wave_index > 0 and wave_index % boss_every_waves == 0:
		spawn_boss(str(level_cfg.get("boss", "")))
	# 精英波：每 elite_every_waves 波投 1 只（真源 elitePool 加权取模板）
	if elite_every_waves > 0 and wave_index > 0 and wave_index % elite_every_waves == 0 \
			and not elite_pool_w.is_empty():
		spawn_elite()
	var count := mini(3 + wave_index, 12)
	for i in range(count):
		if monsters.size() >= monster_cap:
			break
		var tpl_id := _pick_tpl()
		if tpl_id == "":
			continue
		spawn_monster(tpl_id)

func _pick_tpl() -> String:
	if not spawn_pool_w.is_empty():
		return _weighted_pick(spawn_pool_w)
	if spawn_pool.is_empty():
		return ""
	return spawn_pool[rng.randi_range(0, spawn_pool.size() - 1)]

## ============================================================
## 怪物生成（表驱动 + 精英/Boss 强化）：真源 game.js spawnElite / applyElite / Monster
## ============================================================
## 通用生成：hp/atk 按 levelCurve 曲线（lv = monsterLevel + wave_index - 1）缩放；
## as_elite = true 时套用词缀（血量倍率/防御加成/攻速倍率/护盾/体型放大/额外经验）。
func spawn_monster(tpl_id: String, as_elite := false) -> Dictionary:
	var tpl: Dictionary = tpl_monsters.get(tpl_id, {})
	if tpl.is_empty():
		return {}
	if endless_mode != null:
		tpl = endless_mode.scale_monster(tpl)
	var pos := _edge_spawn_pos()
	var lv := _wave_level()
	var hp_mul := _curve_hp_mul(lv) if endless_mode == null else 1.0
	var m := {
		"tpl": tpl_id, "pos": pos,
		"hp": float(tpl.get("hp", 20)) * hp_mul,
		"hp_max": float(tpl.get("hp", 20)) * hp_mul,
		"spd": float(tpl.get("spd", 115)),
		"radius": float(tpl.get("radius", 17)),
		"atk": float(tpl.get("atk", 8)) * (enemy_atk_mul if endless_mode == null else 1.0),
		"def": float(tpl.get("def", 1)), "exp": int(tpl.get("exp", 3)),
		"coin": int(tpl.get("coin", 2)),
		"ranged": str(tpl.get("type", "melee")) == "ranged",
		"dead": false, "hit_cd": 0.0,
		"is_elite": false, "boss": false, "shield": 0.0,
	}
	if as_elite:
		m.is_elite = true
		_apply_elite(m)
	monsters.append(m)
	return m

## 精英词缀加持（真源 combat.js applyElite 口径：随机 1~2 条词缀，血量乘算/防御加算/护盾先扣）
func _apply_elite(m: Dictionary) -> void:
	var affixes: Dictionary = elite_cfg.get("affixes", _default_affixes)
	if affixes.is_empty():
		affixes = _default_affixes
	var names: Array = affixes.keys()
	names.shuffle()
	var cnt_rng: Array = elite_cfg.get("affixCount", [1, 2])
	var n := rng.randi_range(int(cnt_rng[0]), int(cnt_rng[1]))
	for i in range(mini(n, names.size())):
		var a: Dictionary = affixes[names[i]]
		var hp_mul := float(a.get("hpMul", 1.0))
		m.hp = float(m.hp) * hp_mul
		m.hp_max = float(m.hp_max) * hp_mul
		m.def = float(m.def) + float(a.get("defAdd", 0.0))
		m.atk = float(m.atk) * float(a.get("atkMul", 1.0))
		m.spd = float(m.spd) * float(a.get("spdMul", 1.0))
		m.shield = float(m.shield) + float(a.get("shieldHp", 0.0))
	var size_mul := float(elite_cfg.get("sizeMul", elite_size_mul))
	m.radius = float(m.radius) * size_mul
	m.exp = int(m.exp) + int(elite_cfg.get("extraExp", elite_extra_exp))

## 精英投放：模板从 level.elitePool 加权取（真源 game.js spawnElite）
func spawn_elite() -> Dictionary:
	var id := _weighted_pick(elite_pool_w)
	if id == "":
		return {}
	return spawn_monster(id, true)

## Boss 投放：大体型 + 多阶段（phases 血量阈值）+ 定时弹幕（真源 Boss 表 patternCd）
func spawn_boss(boss_id: String) -> Dictionary:
	if boss_id == "" or _has_live_boss():
		return {}
	var tpl: Dictionary = tpl_monsters.get(boss_id, {})
	if tpl.is_empty():
		return {}
	if endless_mode != null:
		tpl = endless_mode.scale_monster(tpl)
	var lv := _wave_level()
	var hp_mul := _curve_hp_mul(lv) if endless_mode == null else 1.0
	var hp := float(tpl.get("hp", 600)) * hp_mul
	var m := {
		"tpl": boss_id, "pos": _edge_spawn_pos(),
		"hp": hp, "hp_max": hp,
		"spd": float(tpl.get("spd", 72)),
		"radius": float(tpl.get("radius", 46)),
		"atk": float(tpl.get("atk", 15)) * (enemy_atk_mul if endless_mode == null else 1.0),
		"def": float(tpl.get("def", 3)), "exp": int(tpl.get("exp", 60)),
		"coin": int(tpl.get("coin", 80)),
		"ranged": false, "dead": false, "hit_cd": 0.0,
		"is_elite": false, "boss": true, "shield": 0.0,
		"phases": tpl.get("phases", []), "phase": 0,
		"pattern_cd": float(tpl.get("patternCd", 3.2)), "pattern_toggle": 0,
	}
	monsters.append(m)
	boss_spawned.emit(m)
	return m

func _has_live_boss() -> bool:
	for m in monsters:
		if not bool(m.dead) and bool(m.get("boss", false)):
			return true
	return false

## Boss 弹幕节拍 + 阶段推进（阶段阈值在 _damage_monster 内判定，切阶立即补一发）
func _update_bosses(dt: float) -> void:
	for m in monsters:
		if bool(m.dead) or not bool(m.get("boss", false)):
			continue
		m.pattern_cd = float(m.pattern_cd) - dt
		if m.pattern_cd <= 0.0:
			m.pattern_cd = float(tpl_monsters.get(m.tpl, {}).get("patternCd", 3.2))
			_boss_fire(m)

## Boss 弹幕发射（真源 combat.js PatternSystem 简化版）：环形 ring / 扇形 fan 交替
func _boss_fire(m: Dictionary) -> void:
	var aim: Vector2 = Vector2(player.pos) - Vector2(m.pos)
	if aim.length_squared() < 0.0001:
		aim = Vector2.RIGHT
	var dir := aim.normalized()
	var dmg := float(m.atk) * 0.6
	var ring := int(m.pattern_toggle) % 2 == 0
	m.pattern_toggle = int(m.pattern_toggle) + 1
	if ring:
		# 环形弹幕：360° 均匀铺开（PatternSystem "radial"/"ring" 的单层口径）
		for i in range(boss_ring_count):
			var ang := TAU * float(i) / float(boss_ring_count)
			var d := Vector2(cos(ang), sin(ang))
			_spawn_bullet(Vector2(m.pos) + d * (float(m.radius) + 8.0), d * boss_bullet_spd_ring,
				dmg, 7.0, boss_bullet_life, 0, false)
	else:
		# 扇形弹幕：以瞄准角为中心 ±arc/2 均分（PatternSystem "fan"，逼走位）
		for i in range(boss_fan_count):
			var t := 0.0 if boss_fan_count <= 1 else float(i) / float(boss_fan_count - 1)
			var ang := t * boss_fan_arc - boss_fan_arc * 0.5
			var d := dir.rotated(ang)
			_spawn_bullet(Vector2(m.pos) + d * (float(m.radius) + 8.0), d * boss_bullet_spd_fan,
				dmg, 7.0, boss_bullet_life, 0, false)

## ============================================================
## 波次成长曲线（真源 levelCurve.json rows[].hpMul；不硬编码）
## ============================================================
func _wave_level() -> int:
	var ml := int(level_cfg.get("monsterLevel", 1))
	return clampi(ml + wave_index - 1, 1, 99)

func _curve_hp_mul(lv: int) -> float:
	var rows: Variant = wave_curve.get("rows")
	if rows is Array and (rows as Array).size() > 0:
		var idx := clampi(lv - 1, 0, (rows as Array).size() - 1)
		return float((rows as Array)[idx].get("hpMul", 1.0))
	return 1.0

## ============================================================
## 加权池工具（真源 U.weightedPick / parseWeightPool 口径："ID:权重/ID:权重"）
## ============================================================
func _parse_weight_pool(s: String) -> Dictionary:
	var out := {}
	for part in s.split("/", false):
		var bits := part.split(":")
		if bits.size() != 2:
			continue
		out[bits[0].strip_edges()] = float(bits[1])
	return out

func _weighted_pick(weights: Dictionary) -> String:
	var total := 0.0
	for k in weights:
		total += float(weights[k])
	if total <= 0.0:
		return ""
	var roll := rng.randf() * total
	for k in weights:
		roll -= float(weights[k])
		if roll <= 0.0:
			return k
	return ""

## levels.json circles → spawnCircles 模板 pool 权重合并（count 作权 重倍数）
func _build_spawn_pool(level: Dictionary) -> Dictionary:
	var out := {}
	for c in level.get("circles", []):
		var tpl_id := str(c.get("tpl", ""))
		var cnt := float(c.get("count", 1))
		var sc: Dictionary = spawn_circles.get(tpl_id, {})
		var pool := _parse_weight_pool(str(sc.get("pool", "")))
		for id in pool:
			out[id] = float(out.get(id, 0.0)) + float(pool[id]) * cnt
	return out

## ============================================================
## 宝箱掉落 / 拾取（真源 game.js spawnGroundChest 简化：数据体 + 地上标记）
## 精英/Boss 必掉；品质按 chestDrop.elite / chestDrop.boss 权重掷骰；
## 拾取只发 chest_picked 信号（背包接口留空钩子）。
## ============================================================
func _drop_chest(pos: Vector2, kind: String) -> void:
	var weights: Dictionary = chest_cfg.get(kind, {}).get("weights",
		{"normal": 70.0, "advanced": 30.0} if kind == "elite" else {"epic": 55.0, "divine": 35.0, "mythic": 10.0})
	var chest := {"pos": pos, "quality": _weighted_pick(weights), "from": kind}
	chests.append(chest)
	chest_spawned.emit(chest)

func _pickup_chests() -> void:
	for i in range(chests.size() - 1, -1, -1):
		if Vector2(chests[i].pos).distance_to(Vector2(player.pos)) <= chest_pickup_radius:
			chest_picked.emit(chests[i])
			chests.remove_at(i)

func _edge_spawn_pos() -> Vector2:
	for attempt in range(8):
		var side := rng.randi_range(0, 3)
		var p := Vector2.ZERO
		match side:
			0: p = Vector2(rng.randf_range(0, world_size.x), 40)
			1: p = Vector2(rng.randf_range(0, world_size.x), world_size.y - 40)
			2: p = Vector2(40, rng.randf_range(0, world_size.y))
			3: p = Vector2(world_size.x - 40, rng.randf_range(0, world_size.y))
		if p.distance_to(Vector2(player.pos)) >= 500.0 and not _point_in_walls(p, 24.0):
			return p
	return Vector2(40, 40)

## 怪移动：流场方向 * 速度 + 邻域分离力；到近战距离则停下输出
## 分离力口径：当前怪上限 120（monster_cap），O(n²) 成对遍历 ≈ 1.4 万次/帧可忽略；
## 上量到千级时再切 SpatialHash 邻域版（hash_mon 已备，届时怪需换成 Object 载体）。
func _update_monsters(dt: float) -> void:
	for m in monsters:
		if bool(m.dead):
			continue
		m.hit_cd = maxf(float(m.hit_cd) - dt, 0.0)
	var n := monsters.size()
	for i in range(n):
		var m: Dictionary = monsters[i]
		if bool(m.dead):
			continue
		var pos := Vector2(m.pos)
		var to_player: Vector2 = Vector2(player.pos) - pos
		var attack_range: float = float(m.radius) + float(player.radius) + 4.0
		# 远程怪保持 320 距离游走，近战贴脸
		var desired: Vector2
		if bool(m.ranged):
			if to_player.length() > 360.0:
				desired = field.sample(pos)
				if desired == Vector2.ZERO:
					desired = to_player.normalized()
			else:
				desired = -to_player.normalized() * 0.4
		else:
			if to_player.length() > attack_range:
				desired = field.sample(pos)
				if desired == Vector2.ZERO:
					desired = to_player.normalized()   # 流场死格回退直线
			else:
				desired = Vector2.ZERO
		# 分离力（steering 局部层）：与近邻怪重叠时推开（成对遍历只算 i<j，双向施加）
		# 优化：先用平方距离粗筛（免开方），命中范围才算长度与方向
		var sep := Vector2.ZERO
		for j in range(i + 1, n):
			var o: Dictionary = monsters[j]
			if bool(o.dead):
				continue
			var d: Vector2 = pos - Vector2(o.pos)
			var min_d: float = float(m.radius) + float(o.radius) + 8.0
			if d.length_squared() >= min_d * min_d or d.length_squared() < 0.000001:
				continue
			var dist := sqrt(d.length_squared())
			var push := d / dist * (1.0 - dist / min_d)
			sep += push
			o.pos = Vector2(o.pos) - push * 0.5   # 对称反推，省一遍外层循环
		var vel: Vector2 = desired * float(m.spd) + sep * float(m.spd) * 0.8
		if vel.length() > float(m.spd):
			vel = vel.normalized() * float(m.spd)
		var np := pos + vel * dt
		np.x = clampf(np.x, float(m.radius), world_size.x - float(m.radius))
		np.y = clampf(np.y, float(m.radius), world_size.y - float(m.radius))
		for r in walls:
			np = _push_out(np, float(m.radius), r)
		m.pos = np

func _monster_attack(dt: float) -> void:
	for m in monsters:
		if bool(m.dead) or float(m.hit_cd) > 0.0:
			continue
		var to_player: Vector2 = Vector2(player.pos) - Vector2(m.pos)
		if bool(m.ranged):
			if to_player.length() <= 380.0:
				m.hit_cd = 1.6
				var dir := to_player.normalized()
				_spawn_bullet(Vector2(m.pos) + dir * (float(m.radius) + 6.0), dir * 320.0,
					float(m.atk), 6.0, 3.0, 0, false)
		else:
			if to_player.length() <= float(m.radius) + float(player.radius) + 6.0:
				m.hit_cd = 1.0
				_damage_player(float(m.atk))

## ============================================================
## 伤害结算（逐份：先减免后扣血；死亡只触发一次信号）
## ============================================================
func _damage_monster(m: Dictionary, raw: float) -> void:
	if bool(m.dead):
		return
	var real := maxf(raw - float(m.def), 1.0)   # 保底 1，防高防完全免疫
	# 护盾词缀：先扣盾后扣血（真源 applyElite 的 shieldHp 口径）
	if float(m.get("shield", 0.0)) > 0.0:
		var s := float(m.shield)
		if s >= real:
			m.shield = s - real
			return
		real -= s
		m.shield = 0.0
	m.hp = float(m.hp) - real
	# Boss 多阶段：血量阈值触发换阶段（phases[].hp 升序判定），切阶立即补发一次弹幕
	if bool(m.get("boss", false)):
		var phases: Array = m.get("phases", [])
		while int(m.phase) + 1 < phases.size() \
				and float(m.hp) / maxf(float(m.hp_max), 1.0) <= float(phases[int(m.phase) + 1].get("hp", 0.5)):
			m.phase = int(m.phase) + 1
			m.pattern_cd = 0.0
	if float(m.hp) <= 0.0:
		m.dead = true
		kills += 1
		if endless_mode != null:
			endless_mode.record_kill()
		exp_gained += int(m.get("exp", 3))
		coin_gained += int(m.get("coin", 2))
		# 宝箱掉落：精英/Boss 必掉（真源 chestDrop 品质权重；pickUp 走信号钩子）
		if bool(m.get("boss", false)):
			_drop_chest(Vector2(m.pos), "boss")
		elif bool(m.get("is_elite", false)):
			_drop_chest(Vector2(m.pos), "elite")
		monster_killed.emit(m)

func _damage_player(raw: float) -> void:
	if not player.alive:
		return
	var real := maxf(raw - float(player.def), 1.0)
	player.hp = float(player.hp) - real
	player_damaged.emit(real)
	if float(player.hp) <= 0.0:
		player.hp = 0.0
		player.alive = false

## 清理死亡怪（波间调用，渲染层与逻辑共享同一数组引用）
func compact_monsters() -> void:
	monsters = monsters.filter(func(m): return not bool(m.dead))

## 圆 vs AABB 推挤（标准最近点法）：只在圆真重叠时沿「最近点→圆心」方向推出，
## 贴墙单位可沿墙面自由滑行（修复旧「膨胀矩形」法把墙角单位永久锁死的问题）
func _push_out(p: Vector2, r: float, rect: Rect2) -> Vector2:
	var cp := Vector2(clampf(p.x, rect.position.x, rect.end.x),
		clampf(p.y, rect.position.y, rect.end.y))
	var d := p - cp
	var dl := d.length()
	if dl >= r:
		return p
	if dl > 0.001:
		return cp + d / dl * r
	# 圆心在矩形内部：沿最浅穿透轴推出
	var left := p.x - rect.position.x
	var right := rect.end.x - p.x
	var top := p.y - rect.position.y
	var bottom := rect.end.y - p.y
	var m := minf(minf(left, right), minf(top, bottom))
	if m == left:
		p.x = rect.position.x - r
	elif m == right:
		p.x = rect.end.x + r
	elif m == top:
		p.y = rect.position.y - r
	else:
		p.y = rect.end.y + r
	return p
