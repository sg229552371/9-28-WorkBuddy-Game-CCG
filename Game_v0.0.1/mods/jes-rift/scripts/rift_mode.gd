class_name RiftMode
extends RefCounted

## 裂缝任务与撤离结算核心：只返回投放/奖励描述，由集成层操作世界和库存。
const ExtractPointScript = preload("res://mods/jes-rift/scripts/extract_point.gd")

var cfg: Dictionary = {}
var extract_cfg: Dictionary = {}
var endless_cfg: Dictionary = {}
var out_cfg: Dictionary = {}
var rng := RandomNumberGenerator.new()
var task: Dictionary = {}
var active := false
var freeze_timer := 0.0
var kills := 0
var spawn_count := 0
var elite_count := 0
var total_spawned := 0
var return_beacon: Dictionary = {}
var floor_no := 0
var extract_point: RefCounted = null
var _settlement: Dictionary = {}
var _warned: Dictionary = {}


func _init(rift_cfg: Dictionary = {}, extraction_cfg: Dictionary = {}, abyss_cfg: Dictionary = {}, settlement_cfg: Dictionary = {}) -> void:
	cfg = rift_cfg.duplicate(true) if not rift_cfg.is_empty() else ExtractPointScript.load_table("rift")
	extract_cfg = extraction_cfg.duplicate(true) if not extraction_cfg.is_empty() else ExtractPointScript.load_table("extract")
	endless_cfg = abyss_cfg.duplicate(true) if not abyss_cfg.is_empty() else ExtractPointScript.load_table("endless")
	out_cfg = settlement_cfg.duplicate(true) if not settlement_cfg.is_empty() else ExtractPointScript.load_table("outLevel")
	rng.randomize()


func set_seed(seed_value: int) -> void:
	rng.seed = seed_value


func begin(task_id: String = "", elite_multiplier: float = 1.0) -> bool:
	var selected: Dictionary = {}
	var tasks: Array = cfg.get("tasks", [])
	if task_id.is_empty():
		var total := 0.0
		for entry in tasks:
			total += maxf(0.0, float(entry.get("weight", 0.0)))
		var roll := rng.randf() * total
		for entry in tasks:
			roll -= maxf(0.0, float(entry.get("weight", 0.0)))
			if roll < 0.0:
				selected = entry
				break
	else:
		for entry in tasks:
			if str(entry.get("id", "")) == task_id:
				selected = entry
				break
	if selected.is_empty():
		return false
	reset()
	floor_no = 1
	task = selected.duplicate(true)
	task["remain"] = float(task.get("time", 0.0))
	task["done"] = false
	task["failed"] = false
	active = true
	kills = 0
	freeze_timer = maxf(0.0, _number(cfg, "freezeTime", 0.0))
	spawn_count = maxi(0, int(task.get("spawnCount", cfg.get("defaultSpawnCount", 0))))
	elite_count = maxi(0, int(floor(_number(cfg, "eliteBase", 0.0) * maxf(0.0, elite_multiplier) + 0.5)))
	total_spawned = spawn_count + elite_count
	# 无场景障碍采样器时返回中心描述；调用方可按地图障碍另选落点。
	var size := _number(cfg, "worldSize", 0.0)
	return_beacon = {"position": Vector2(size / 2.0, size / 2.0), "channel": _number(cfg, "channel", 0.0)}
	return true


func update(delta: float) -> void:
	if not active or not is_finite(delta) or delta <= 0.0:
		return
	if freeze_timer > 0.0:
		freeze_timer = maxf(0.0, freeze_timer - delta)
		return
	if not task["done"] and not task["failed"]:
		if float(task.get("time", 0.0)) > 0.0:
			task["remain"] = maxf(0.0, float(task["remain"]) - delta)
			if float(task["remain"]) <= 0.0:
				task["failed"] = true
		if not task["failed"] and kills >= int(task.get("goal", 0)):
			task["done"] = true


func record_kill() -> int:
	if active and freeze_timer <= 0.0:
		kills += 1
	return kills


## 真源空间裂缝没有逐层威胁曲线，缺省为中性一级且仅告警一次。
func threat_level() -> float:
	return maxf(1.0, _number(cfg, "threatLevel", 1.0))


## 返回可生成奖励节点的稳定 id 与权重；不在本类写入背包或重复发奖。
func reward_nodes() -> Array:
	var result: Array = []
	if kills >= int(_number(cfg, "rewardKills", 0.0)) and kills > 0:
		result.append({"id": "RIFT_REWARD", "weights": cfg.get("chestWeights", {}).duplicate(true)})
	if task.get("done", false):
		result.append({"id": "RIFT_TASK", "weights": cfg.get("taskBonusWeights", {}).duplicate(true)})
	return result


## 主线仅首领生成八秒点；深渊仅最终首领生成三秒点。
## 几何避障/边界夹取属于世界层；此处返回死亡原点，不自行编造落点参数。
func spawn_extract_point(at: Vector2, boss_condition: bool, world_kind: String = "endless") -> bool:
	if not boss_condition or extract_point != null or not _settlement.is_empty():
		return false
	if world_kind != "endless" and world_kind != "main":
		return false
	var point_cfg := extract_cfg.duplicate(true)
	if world_kind == "endless":
		point_cfg["channel"] = _number(endless_cfg, "extractChannel", 0.0)
		point_cfg["enabled"] = false
	var point = ExtractPointScript.new(point_cfg)
	if not point.activate(at):
		return false
	extract_point = point
	return true


## 只生成结算报告，不实际发放。集成方每局消费报告一次。
## timeout 优先级来自 rift_hud_test.js 四11；惩罚只适用于结晶。
func settle(crystals: int, reason: String = "death", timed_out: bool = false) -> Dictionary:
	if not _settlement.is_empty():
		return _settlement.duplicate(true)
	var outcome := "timeout" if timed_out or reason == "timeout" else ("extract" if reason == "extract" else "death")
	var extracted := outcome == "extract"
	var total := maxi(0, crystals)
	var kept := total if extracted else int(floor(float(total) * clampf(_number(out_cfg, "deathRatio", 0.0), 0.0, 1.0)))
	var titles: Dictionary = endless_cfg.get("settle", {})
	var title_key := "extractTitle" if extracted else ("timeoutTitle" if outcome == "timeout" else "deathTitle")
	_settlement = {
		"reason": outcome, "extracted": extracted, "timedOut": outcome == "timeout",
		"crystals": total, "carriedCrystals": kept, "lostCrystals": total - kept,
		"kills": kills, "floor": floor_no, "title": titles.get(title_key, outcome),
	}
	active = false
	if extract_point != null:
		extract_point.deactivate()
	return _settlement.duplicate(true)


## 离开裂缝回主图只改模式标记，不等价于整局撤离。
func return_to_main() -> void:
	active = false


func reset() -> void:
	if extract_point != null:
		extract_point.deactivate()
	extract_point = null
	_settlement = {}
	task = {}
	active = false
	floor_no = 0
	freeze_timer = 0.0
	kills = 0
	spawn_count = 0
	elite_count = 0
	total_spawned = 0
	return_beacon = {}


func _number(table: Dictionary, key: String, fallback: float) -> float:
	var value: Variant = table.get(key)
	if (value is int or value is float) and is_finite(float(value)):
		return float(value)
	if not _warned.has(key):
		_warned[key] = true
		push_warning("[RiftMode] 配置缺失，使用保守默认值: " + key)
	return fallback
