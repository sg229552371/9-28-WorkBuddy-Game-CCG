class_name GameScreens
extends RefCounted

## 三合一屏幕的纯逻辑状态机。
## 数据真源为 cfg/*.json；UI 层只消费本类组装后的字典，不在节点脚本中复制规则。

const HEROES_PATH := "res://cfg/heroes.json"
const CITY_PATH := "res://cfg/city.json"

const STATE_BOOT := "boot"
const STATE_MENU := "menu"
const STATE_CHAR_SELECT := "charSel"
const STATE_PLAYING := "playing"
const STATE_SETTLED := "settled"
const STATE_DEAD := "dead"
const STATE_CITY := "city"

const TRANSITIONS := {
	"boot": ["menu", "city"],
	"menu": ["charSel", "city"],
	"charSel": ["playing", "menu"],
	"playing": ["settled", "dead"],
	"settled": ["menu", "city"],
	"dead": ["menu", "city"],
	"city": ["menu"],
}

var state: String = STATE_BOOT
var heroes: Array = []
var city_cfg: Dictionary = {}
var unlock_state: Dictionary = {}
var settle_data: Dictionary = {}


func _init(hero_table: Variant = null, city_table: Variant = null) -> void:
	heroes = _load_array_or_fallback(hero_table, HEROES_PATH)
	city_cfg = _load_dictionary_or_fallback(city_table, CITY_PATH)


## 只允许真源流程中的相邻屏幕切换；拒绝不会改变当前状态。
func transition_to(next_state: String) -> bool:
	if next_state == state:
		return true
	var next_states: Array = TRANSITIONS.get(state, [])
	if not next_states.has(next_state):
		push_warning("[GameScreens] 非法屏幕流转: %s -> %s" % [state, next_state])
		return false
	var old_state := state
	state = next_state
	if next_state == STATE_SETTLED or next_state == STATE_DEAD:
		settle_data = settle_data.duplicate(true)
		_sync_game_state(next_state)
	else:
		_sync_game_state(next_state)
	return old_state != state


func can_transition(next_state: String) -> bool:
	return next_state == state or (TRANSITIONS.get(state, []) as Array).has(next_state)


func enter_menu() -> bool:
	return transition_to(STATE_MENU)


func enter_char_select() -> bool:
	return transition_to(STATE_CHAR_SELECT)


func enter_playing() -> bool:
	return transition_to(STATE_PLAYING)


func settle(result: Dictionary = {}) -> bool:
	if not result.is_empty():
		set_settlement(result)
	return transition_to(STATE_SETTLED)


func enter_dead(result: Dictionary = {}) -> bool:
	if not result.is_empty():
		set_settlement(result)
	return transition_to(STATE_DEAD)


func set_unlock_state(unlocks: Dictionary) -> void:
	unlock_state = unlocks.duplicate(true)


func set_hero_unlocked(hero_id: String, unlocked: bool) -> void:
	unlock_state[hero_id] = unlocked


## 主城入口：传送门与 NPC 均从 cfg/city.json 组装，不复制入口数值。
func build_menu_entries() -> Array:
	var entries: Array = []
	var portal: Variant = city_cfg.get("portal")
	if portal is Dictionary:
		var portal_entry: Dictionary = (portal as Dictionary).duplicate(true)
		portal_entry["id"] = "portal"
		portal_entry["kind"] = "portal"
		entries.append(portal_entry)
	var npcs: Variant = city_cfg.get("npcs", [])
	if npcs is Array:
		for npc in npcs:
			if npc is Dictionary:
				var entry: Dictionary = (npc as Dictionary).duplicate(true)
				entry["kind"] = "npc"
				entries.append(entry)
	return entries


## 选人卡片：保留 cfg 英雄字段，并注入本局解锁态；不改变 cfg 原数组。
func build_character_cards(unlocks: Dictionary = {}) -> Array:
	var effective_unlocks := unlock_state
	if not unlocks.is_empty():
		effective_unlocks = unlocks
	var cards: Array = []
	for hero in heroes:
		if not hero is Dictionary:
			continue
		var card: Dictionary = (hero as Dictionary).duplicate(true)
		var hero_id := str(card.get("id", ""))
		card["unlocked"] = _is_unlocked(hero_id, effective_unlocks)
		cards.append(card)
	return cards


func is_hero_unlocked(hero_id: String, unlocks: Dictionary = {}) -> bool:
	var effective_unlocks := unlock_state if unlocks.is_empty() else unlocks
	return _is_unlocked(hero_id, effective_unlocks)


## 战斗结果到中文结算行。字段缺失时使用零值/保守文案，保证结算页可渲染。
func build_settlement_lines(result: Dictionary = {}) -> Array[String]:
	var lines: Array[String] = []
	var reason := str(result.get("reason", ""))
	var extracted: bool = bool(result.get("extracted", false)) or reason == "extract"
	var timed_out: bool = bool(result.get("timedOut", false)) or reason == "timeout"
	var outcome := "撤离成功" if extracted else ("时限耗尽" if timed_out else "战斗失败")
	lines.append("结局：" + outcome)
	lines.append("击杀：%d" % int(result.get("kills", 0)))
	lines.append("波次：%d" % int(result.get("wave", 0)))
	lines.append("获得结晶：%d" % int(result.get("crystals", 0)))
	if result.has("bossKills"):
		lines.append("首领击杀：%d" % int(result.get("bossKills", 0)))
	if result.has("elapsed"):
		lines.append("战斗时长：" + _format_elapsed(result.get("elapsed", 0)))
	return lines


func set_settlement(result: Dictionary) -> void:
	settle_data = result.duplicate(true)


func _is_unlocked(hero_id: String, unlocks: Dictionary) -> bool:
	if unlocks.has(hero_id):
		return bool(unlocks[hero_id])
	var ids: Variant = unlocks.get("hero_ids", [])
	if ids is Array and (ids as Array).has(hero_id):
		return true
	return false


func _sync_game_state(next_state: String) -> void:
	var tree := Engine.get_main_loop()
	if tree == null or not tree is SceneTree:
		return
	var root := (tree as SceneTree).root
	if root == null:
		return
	var game_state := root.get_node_or_null("GameState")
	if game_state != null and game_state.has_method("set_state"):
		game_state.set_state(next_state)


func _load_array_or_fallback(value: Variant, path: String) -> Array:
	if value is Array:
		return (value as Array).duplicate(true)
	var parsed: Variant = _read_json(path)
	if parsed is Array:
		return parsed
	push_warning("[GameScreens] 配置表缺失或格式错误: " + path)
	return []


func _load_dictionary_or_fallback(value: Variant, path: String) -> Dictionary:
	if value is Dictionary:
		return (value as Dictionary).duplicate(true)
	var parsed: Variant = _read_json(path)
	if parsed is Dictionary:
		return parsed
	push_warning("[GameScreens] 配置表缺失或格式错误: " + path)
	return {}


func _read_json(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		return null
	return JSON.parse_string(text)


func _format_elapsed(value: Variant) -> String:
	var seconds := maxi(0, int(value))
	return "%02d:%02d" % [seconds / 60, seconds % 60]
