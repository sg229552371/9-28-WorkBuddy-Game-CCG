extends RefCounted
## 主城纯逻辑层：NPC/门点位、进圈判定、读条进度、面板开闭状态机。
## 不创建节点、不做绘制与输入；渲染与交互见 city_visual.gd。
## 真源 = cfg/city.json（坐标/半径/文案全读表，不硬编码）。

const ModeScript = preload("res://mods/jes-city/scripts/city_mode.gd")
const GrowthScript = preload("res://mods/jes-city/scripts/hero_growth.gd")

var cfg: Dictionary
var map_size: Vector2
var move_speed: float
var spawn: Vector2
var entries: Array[Dictionary] = []
var player_pos: Vector2
var open_panel_id: String = ""
var channel_id: String = ""
var channel_time: float = 0.0
var channel_duration: float = 0.0
## TODO: GameState/save_core 尚无 Meta 存档接口，先挂在本地快照；接口就绪后整体迁移。
var meta: Dictionary = {"crystals": 0, "nickname": "无名旅者", "title": "初始守护", "weapons": {}, "codex": {}, "bag": []}


func _init(city_cfg: Dictionary = {}) -> void:
	cfg = city_cfg.duplicate(true)
	if cfg.is_empty():
		cfg = ModeScript.read_config("city", {}).duplicate(true)
	var w := float(cfg.get("mapW", 1280))
	var h := float(cfg.get("mapH", 960))
	map_size = Vector2(w, h)
	move_speed = float(cfg.get("moveSpd", 210))
	var s: Dictionary = cfg.get("spawn", {})
	spawn = _point(float(s.get("x", 0.5)), float(s.get("y", 0.78)))
	player_pos = spawn
	_build_entries()


func _point(fx: float, fy: float) -> Vector2:
	return Vector2(fx * map_size.x, fy * map_size.y)


func _build_entries() -> void:
	entries.clear()
	var radius := float(cfg.get("npcRadius", 76))
	for npc: Dictionary in cfg.get("npcs", []):
		entries.append({
			"id": str(npc.get("id", "")),
			"name": str(npc.get("name", "")),
			"desc": str(npc.get("desc", "")),
			"icon": str(npc.get("icon", "")),
			"color": str(npc.get("color", "#cccccc")),
			"func": str(npc.get("func", "")),
			"pos": _point(float(npc.get("fx", 0.5)), float(npc.get("fy", 0.5))),
			"radius": radius,
			"kind": "npc",
		})
	var p: Dictionary = cfg.get("portal", {})
	if not p.is_empty():
		# city.json 未给传送门坐标：按原型布局取顶部中央，半径/读条时长仍读表。
		entries.append({
			"id": "PORTAL_MAIN",
			"name": str(p.get("name", "出征传送门")),
			"desc": str(p.get("desc", "")),
			"icon": ">>",
			"color": "#ffd76a",
			"func": "portal",
			"pos": Vector2(map_size.x * 0.5, map_size.y * 0.12),
			"radius": float(p.get("radius", 90)),
			"kind": "portal",
			"channel": float(p.get("channel", 2)),
		})
	var a: Dictionary = cfg.get("abyssPortal", {})
	if not a.is_empty() and bool(a.get("ready", false)):
		entries.append({
			"id": "PORTAL_ABYSS",
			"name": str(a.get("name", "深渊之门")),
			"desc": str(a.get("desc", "")),
			"icon": "!!",
			"color": str(a.get("color", "#ff7a3c")),
			"func": "abyss",
			"pos": _point(float(a.get("fx", 0.86)), float(a.get("fy", 0.6))),
			"radius": float(a.get("radius", 84)),
			"kind": "abyss",
			"channel": float(a.get("channel", 2)),
		})


func entry_by_id(id: String) -> Dictionary:
	for e: Dictionary in entries:
		if str(e.get("id", "")) == id:
			return e
	return {}


## 进圈判定：返回命中的点位 id（圆形距离 < 半径），都不在圈里返回空串。
func entry_at(pos: Vector2) -> String:
	var best: String = ""
	var best_d: float = -1.0
	for e: Dictionary in entries:
		var d := pos.distance_to(e.get("pos", Vector2.ZERO))
		if d < float(e.get("radius", 0)) and (best_d < 0.0 or d < best_d):
			best_d = d
			best = str(e.get("id", ""))
	return best


## 面板状态机：开面板（重复开同一面板返回 false；未知点位返回 false）
func open_panel(id: String) -> bool:
	if entry_by_id(id).is_empty() or open_panel_id == id:
		return false
	if is_channel_active():
		return false
	open_panel_id = id
	return true


func close_panel() -> bool:
	if open_panel_id == "":
		return false
	open_panel_id = ""
	return true


## 读条：进读条圈才启动；tick 返回「本帧刚好完成」
func start_channel(id: String) -> bool:
	var e := entry_by_id(id)
	if e.is_empty() or str(e.get("kind", "")) == "npc":
		return false
	if not entry_at(player_pos) == id:
		return false
	channel_id = id
	channel_time = 0.0
	channel_duration = float(e.get("channel", 2.0))
	return true


func tick_channel(dt: float) -> bool:
	if not is_channel_active():
		return false
	channel_time += dt
	if channel_time >= channel_duration:
		channel_id = ""
		channel_time = 0.0
		channel_duration = 0.0
		return true
	return false


func is_channel_active() -> bool:
	return channel_id != ""


func channel_progress() -> float:
	if not is_channel_active() or channel_duration <= 0.0:
		return 0.0
	return clampf(channel_time / channel_duration, 0.0, 1.0)


## 走位：返回新位置并写回，钳制在地图范围内
func move_player(dir: Vector2, dt: float) -> Vector2:
	if dir.length_squared() > 1.0:
		dir = dir.normalized()
	player_pos += dir * move_speed * dt
	player_pos.x = clampf(player_pos.x, 0.0, map_size.x)
	player_pos.y = clampf(player_pos.y, 0.0, map_size.y)
	return player_pos


func growth() -> HeroGrowth:
	return GrowthScript.new({})
