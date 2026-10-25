class_name ExtractPoint
extends RefCounted

## 撤离点纯逻辑。英雄由调用方传入字典：{id, position: Vector2, dead}。
## 不持有场景节点；成功事件供集成层结算，库存发放不在此处。
signal succeeded

var cfg: Dictionary = {}
var position := Vector2.ZERO
var active := false
var done := false
var progress := 0.0
var holder: Variant = null
var channeling := false
var judge_mul := 1.0
var _warned: Dictionary = {}


func _init(extract_cfg: Dictionary = {}, radius_mul: float = -1.0) -> void:
	cfg = extract_cfg.duplicate(true) if not extract_cfg.is_empty() else load_table("extract")
	if radius_mul < 0.0:
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://cfg/altarJudgeMul.json"))
		if value is float or value is int:
			judge_mul = maxf(0.0, float(value))
		else:
			_warn_once("judge_mul", "判定半径倍率缺失，使用原半径")
	else:
		judge_mul = maxf(0.0, radius_mul)


static func load_table(key: String) -> Dictionary:
	var path := "res://cfg/%s.json" % key
	if not FileAccess.file_exists(path):
		push_warning("[ExtractPoint] 配置表缺失: " + key)
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Dictionary:
		return parsed
	push_warning("[ExtractPoint] 配置表格式错误: " + key)
	return {}


func activate(at: Vector2, condition_met: bool = true) -> bool:
	if not condition_met or active or done:
		return false
	position = at
	active = true
	return true


func contains(at: Vector2) -> bool:
	return active and position.distance_to(at) < _number("radius", 0.0) * judge_mul


## 同圈多人只选择首位存活英雄，不按英雄人数加速。
func update(delta: float, heroes: Array, frozen: bool = false, weight: float = 0.0) -> bool:
	if not active or done or frozen or not is_finite(delta) or delta <= 0.0:
		return false
	holder = null
	for hero in heroes:
		if hero is Dictionary and not hero.get("dead", false) and contains(hero.get("position", Vector2.INF)):
			holder = hero.get("id", "hero")
			break
	channeling = holder != null
	if channeling:
		var base := _number("channel", 0.0)
		var duration := channel_seconds(weight)
		if duration > 0.0:
			progress += delta * base / duration
	elif progress > 0.0:
		# cfg 未导出衰退键，回退 extract_test.js 第④段的一点二倍，告警一次。
		progress = maxf(0.0, progress - delta * maxf(0.0, _number("decayRate", 1.2)))
	var need := _number("channel", 0.0)
	if need > 0.0 and progress >= need:
		done = true
		active = false
		progress = 0.0
		holder = null
		channeling = false
		succeeded.emit()
		return true
	return false


## 进度存为基准秒数；负重只降低推进速率，不改变完成阈值。
func channel_seconds(weight: float = 0.0) -> float:
	var base := maxf(0.0, _number("channel", 0.0))
	if not cfg.get("enabled", false) or not cfg.get("weightPenaltyEnabled", false):
		return base
	var over := maxf(0.0, weight - _number("weightThreshold", 0.0)) if is_finite(weight) else 0.0
	var scale := 1.0 + maxf(0.0, _number("weightSlopePer100", 0.0)) * over / 100.0
	return base * clampf(scale, 1.0, maxf(1.0, _number("weightTimeScaleMax", 1.0)))


## 仅计算请求只数；怪物实体生成与全局容量由集成方负责。
func wave_size(index: int, available_slots: int = -1) -> int:
	if not cfg.get("enabled", false) or not cfg.get("waveEnabled", false):
		return 0
	var count := maxi(0, int(floor(_number("waveSizeBase", 0.0) + _number("waveSizeGrowth", 0.0) * float(maxi(0, index - 1)) + 0.5)))
	return mini(count, maxi(0, available_slots)) if available_slots >= 0 else count


func interrupt() -> bool:
	if not active or done:
		return false
	var interrupted := channeling or progress > 0.0
	progress = 0.0
	holder = null
	channeling = false
	return interrupted


## 死亡时雕像消散；重新使用对象前显式 reset。
func deactivate() -> void:
	active = false
	progress = 0.0
	holder = null
	channeling = false


func reset() -> void:
	deactivate()
	done = false
	position = Vector2.ZERO


func _number(key: String, fallback: float) -> float:
	var value: Variant = cfg.get(key)
	if (value is int or value is float) and is_finite(float(value)):
		return float(value)
	_warn_once(key, "配置缺失，使用保守默认值: " + key)
	return fallback


func _warn_once(key: String, text: String) -> void:
	if not _warned.has(key):
		_warned[key] = true
		push_warning("[ExtractPoint] " + text)
