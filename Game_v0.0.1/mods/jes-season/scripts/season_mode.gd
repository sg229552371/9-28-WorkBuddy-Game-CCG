class_name SeasonMode
extends RefCounted

## 赛季等级/经验为唯一推进口径；真源没有段位积分系统，不另造段位。
signal reward_claimed(reward: Dictionary)

var cfg: Dictionary = {}
var season_lv := 1
var season_exp := 0.0
var weekly_progress := {"weekly-kill": 0.0, "weekly-extract": 0.0, "weekly-levelup": 0.0}
var cleared_levels := 0
var challenge_active := false
var claimed_rewards: Dictionary = {}
var elapsed := 0.0
var _challenge_lv_start := 1
var _challenge_exp_gained := 0.0
var _warned: Dictionary = {}


func _init(season_cfg: Dictionary = {}) -> void:
	cfg = season_cfg.duplicate(true) if not season_cfg.is_empty() else _load_cfg_table()


func _load_cfg_table() -> Dictionary:
	var path := "res://cfg/season.json"
	if FileAccess.file_exists(path):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
		if parsed is Dictionary:
			return parsed
	push_warning("[SeasonMode] 赛季配置缺失或格式错误，使用保守默认值")
	return {}


func exp_needed(level: int = -1) -> float:
	var lv := season_lv if level < 1 else level
	return maxf(0.0, _number(cfg, "expBase", 0.0) + float(lv - 1) * _number(cfg, "expStep", 0.0))


func add_exp(amount: Variant) -> bool:
	if not (amount is int or amount is float):
		return false
	var value := float(amount)
	if not is_finite(value) or value < 0.0:
		return false
	var cap := maxi(1, int(_number(cfg, "maxLv", 1.0)))
	if season_lv >= cap or exp_needed() <= 0.0:
		return false
	season_exp += value
	while season_lv < cap:
		var need := exp_needed()
		if need <= 0.0 or season_exp < need:
			break
		season_exp -= need
		season_lv += 1
	if season_lv >= cap:
		season_exp = 0.0
	return true


func weeklies() -> Array:
	var weekly: Dictionary = cfg.get("weekly", {})
	return [
		{"id": "weekly-kill", "name": "击杀敌人", "goal": _number(weekly, "killGoal", 0.0), "progress": weekly_progress["weekly-kill"]},
		{"id": "weekly-extract", "name": "成功撤离", "goal": _number(weekly, "extractGoal", 0.0), "progress": weekly_progress["weekly-extract"]},
		{"id": "weekly-levelup", "name": "局内升级", "goal": _number(weekly, "levelUpGoal", 0.0), "progress": weekly_progress["weekly-levelup"]},
	]


func add_weekly_progress(id: String, amount: Variant) -> bool:
	if not weekly_progress.has(id) or not (amount is int or amount is float):
		return false
	if not is_finite(float(amount)) or float(amount) <= 0.0:
		return false
	weekly_progress[id] += float(amount)
	return true


func reset_weekly() -> void:
	for id in weekly_progress:
		weekly_progress[id] = 0.0


func on_kill(is_elite: bool = false) -> bool:
	return _event("killElite" if is_elite else "kill", "weekly-kill")


func on_level_up() -> bool:
	return _event("levelUp", "weekly-levelup")


func on_extract() -> bool:
	return _event("extract", "weekly-extract")


func _event(key: String, weekly_id: String) -> bool:
	var gains: Dictionary = cfg.get("expGain", {})
	var value := maxf(0.0, _number(gains, key, 0.0))
	var accepted := add_exp(value)
	var advanced := add_weekly_progress(weekly_id, 1)
	if challenge_active and accepted:
		_challenge_exp_gained += value
	return accepted or advanced


func reset_season() -> void:
	season_lv = 1
	season_exp = 0.0
	reset_weekly()
	claimed_rewards.clear()
	challenge_active = false
	_challenge_lv_start = 1
	_challenge_exp_gained = 0.0
	elapsed = 0.0


func mark_level_cleared(count: int) -> void:
	cleared_levels = maxi(cleared_levels, count)


func is_unlocked(cleared: int = -1) -> bool:
	var unlock: Dictionary = cfg.get("unlock", {})
	# 缺门槛时保持锁定，避免错误开放入口。
	var need := _number(unlock, "afterLevels", INF)
	return float(cleared_levels if cleared < 0 else cleared) >= need


func rewards() -> Array:
	var result: Array = []
	var entries: Variant = cfg.get("rewards")
	if not entries is Array:
		if not _warned.has("rewards"):
			_warned["rewards"] = true
			push_warning("[SeasonMode] 奖励表缺失，不生成奖励")
		return result
	for entry in entries:
		if not entry is Dictionary or not entry.has("id"):
			continue
		var reward: Dictionary = entry.duplicate(true)
		reward["claimed"] = claimed_rewards.has(str(reward["id"]))
		result.append(reward)
	return result


## 仅记录已领并发送发放描述；集成方负责将 type/amount 写入实际库存。
func claim_reward(id: String) -> bool:
	for reward in rewards():
		if str(reward["id"]) != id:
			continue
		if reward["claimed"] or float(season_lv) < _number(reward, "unlockAtLv", INF):
			return false
		claimed_rewards[id] = true
		reward["claimed"] = true
		reward_claimed.emit(reward.duplicate(true))
		return true
	return false


## 与真源一致，底层 start_challenge 只防重复；入口守卫在 start_season_challenge。
func start_challenge() -> bool:
	if challenge_active:
		return false
	challenge_active = true
	_challenge_lv_start = season_lv
	_challenge_exp_gained = 0.0
	return true


func start_season_challenge() -> bool:
	var challenge: Dictionary = cfg.get("challenge", {})
	if not is_unlocked() or not challenge.get("enabled", false):
		return false
	return start_challenge()


func end_challenge() -> Dictionary:
	var result := {"levelBefore": _challenge_lv_start, "levelAfter": season_lv, "expGained": _challenge_exp_gained, "weeklies": weeklies()}
	challenge_active = false
	_challenge_lv_start = season_lv
	_challenge_exp_gained = 0.0
	return result


func duration_seconds() -> float:
	return maxf(0.0, _number(cfg, "durationDays", 0.0)) * 24.0 * 60.0 * 60.0


func challenge_time_limit() -> float:
	var challenge: Dictionary = cfg.get("challenge", {})
	return maxf(0.0, _number(challenge, "timeLimit", 0.0))


## 原型仅配置时长，未定义自动换季/补发。只提供到期查询，由集成方显式重置。
func advance_time(delta: float) -> bool:
	if is_finite(delta) and delta > 0.0:
		elapsed += delta
	return is_expired()


func is_expired() -> bool:
	var duration := duration_seconds()
	return duration > 0.0 and elapsed >= duration


func _number(table: Dictionary, key: String, fallback: float) -> float:
	var value: Variant = table.get(key)
	if (value is int or value is float) and is_finite(float(value)):
		return float(value)
	if not _warned.has(key):
		_warned[key] = true
		push_warning("[SeasonMode] 配置缺失，使用保守默认值: " + key)
	return fallback
