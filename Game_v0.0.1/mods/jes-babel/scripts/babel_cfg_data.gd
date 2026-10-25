## 《巴别回路》配置表防御性读取层（9 张 srpg_*.json，schema v1.2）
## 键缺失/类型不符时 push_warning 并回退代码内默认值（默认值标 # PLACEHOLDER），绝不崩。
class_name BabelCfgData
extends RefCounted

const DEF_FACING: Dictionary = {"front_mul": 0.7, "back_mul": 1.3, "side_mul": 1.0}
const DEF_COMPENSATION: Dictionary = {
	"hp_mul": [1.25, 1.12, 1.0],
	"dps_mul": [1.12, 1.12, 1.0],
	"shard_mul": [1.10, 1.05, 1.0],
}
const DEF_REALTIME: Dictionary = {
	"tile_px": 64.0,
	"map_width_screens": 3,
	"switch_cd": 2.0,
	"compensation": DEF_COMPENSATION,
}
const DEF_XP_ANCHORS: Array = [1.0, 25.0, 60.0, 100.0]
const DEF_PUNISHMENT_TIMER: Dictionary = {"start_s": 75.0, "tick_s": 10.0, "hp_loss_ratio": 0.10}
const DEF_SHOP: Dictionary = {
	"reroll_cost_base": 5,
	"relic_price": {"white": 10, "blue": 18, "gold": 30},
	"skill_upgrade_cost": 8,
	"gold_chance": 0.12,
}
const DEF_RELIC_DROP: Dictionary = {"white_w": 70, "blue_w": 25, "gold_w": 5, "shop_gold_chance": 0.12}
const DEF_CHAPTER: Dictionary = {
	"id": "CH1", "name_cn": "泥胎", "minion_hp": [8, 12], "minion_damage": [3, 4],
	"boss_id": "EN13", "boss_hp": 90, "boss_damage": 8, "shard_xp": 1,
	"waves": [], "battles": 1, "has_event": true, "has_shop": true, "has_canonization": false,
}

## 表缓存：键 = "srpg_xxx"，值 = Variant（Array/Dictionary/null）
var _tables: Dictionary = {}
## 已告警键集合（避免刷屏）
var _warned: Dictionary = {}


## 从 Cfg autoload 构建读取器
static func load_default() -> BabelCfgData:
	var inst: BabelCfgData = BabelCfgData.new()
	return inst


## 注入表数据（供单测绕过 Cfg autoload 使用）
func inject_table(key: String, value: Variant) -> void:
	_tables[key] = value


func _table(key: String) -> Variant:
	if _tables.has(key):
		return _tables.get(key)
	var v: Variant = Cfg.get_table(key)
	_tables[key] = v
	return v


func _warn_once(msg: String) -> void:
	if not _warned.has(msg):
		_warned[msg] = true
		push_warning("[BabelCfg] " + msg)


func _f(d: Dictionary, key: String, def: float) -> float:
	var v: Variant = d.get(key)
	if v is float or v is int:
		return float(v)
	_warn_once("键缺失/类型错: " + key + "，用默认 " + str(def))
	return def


func _i(d: Dictionary, key: String, def: int) -> int:
	return int(_f(d, key, float(def)))


func _s(d: Dictionary, key: String, def: String) -> String:
	var v: Variant = d.get(key)
	if v is String:
		return v
	_warn_once("键缺失/类型错: " + key + "，用默认 " + def)
	return def


func _arr_f(d: Dictionary, key: String, def: Array) -> Array:
	var v: Variant = d.get(key)
	if v is Array:
		return v
	_warn_once("键缺失/类型错: " + key + "，用默认 " + str(def))
	return def


## ---------- 祭司表 srpg_chiefs ----------
## 返回数组，元素含 id/name_cn/unlocked_default/passive/skill_a/skill_b（skill 为 id 字符串或缺省）
func chiefs() -> Array:
	var t: Variant = _table("srpg_chiefs")
	var out: Array = []
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out.append({
					"id": _s(d, "id", ""),
					"name_cn": _s(d, "name_cn", "无名祭司"),
					"unlocked_default": bool(d.get("unlocked_default", false)),
					"passive": d.get("passive", {}) if d.get("passive") is Dictionary else {},
					"skill_a": _s(d, "skill_a", ""),
					"skill_b": _s(d, "skill_b", ""),
				})
			else:
				_warn_once("srpg_chiefs 含非字典元素，已跳过")
	else:
		_warn_once("srpg_chiefs 缺失或非数组，返回空表")
	return out


## 技能表 srpg_skills：返回 id -> Dictionary
func skill_map() -> Dictionary:
	var t: Variant = _table("srpg_skills")
	var out: Dictionary = {}
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out[_s(d, "id", "")] = {
					"id": _s(d, "id", ""),
					"chief_id": _s(d, "chief_id", ""),
					"slot": _s(d, "slot", "a"),
					"name_cn": _s(d, "name_cn", "无名技能"),
					"cd": _f(d, "cd", 4.0),
					"damage": _f(d, "damage", 0.0),
					"shape": _s(d, "shape", "projectile"),
					"duration": _f(d, "duration", 0.0),
					"params": d.get("params", {}) if d.get("params") is Dictionary else {},
				}
	else:
		_warn_once("srpg_skills 缺失或非数组，返回空表")
	return out


## 敌人表 srpg_enemies：返回 id -> Dictionary
func enemy_map() -> Dictionary:
	var t: Variant = _table("srpg_enemies")
	var out: Dictionary = {}
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out[_s(d, "id", "")] = {
					"id": _s(d, "id", ""),
					"name_cn": _s(d, "name_cn", "泥塑俑"),
					"hp": _f(d, "hp", 10.0),
					"damage": _f(d, "damage", 3.0),
					"speed_px": _f(d, "speed_px", 60.0),
					"radius_px": _f(d, "radius_px", 16.0),
					"trait": _s(d, "trait", "none"),
					"trait_params": d.get("trait_params", {}) if d.get("trait_params") is Dictionary else {},
					"chapter": _i(d, "chapter", 1),
				}
	else:
		_warn_once("srpg_enemies 缺失或非数组，返回空表")
	return out


## 圣物表 srpg_relics：返回数组
func relics() -> Array:
	var t: Variant = _table("srpg_relics")
	var out: Array = []
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out.append({
					"id": _s(d, "id", ""),
					"name_cn": _s(d, "name_cn", "无名圣物"),
					"rarity": _s(d, "rarity", "white"),
					"desc_cn": _s(d, "desc_cn", ""),
					"effect": d.get("effect", {}) if d.get("effect") is Dictionary else {},
				})
	else:
		_warn_once("srpg_relics 缺失或非数组，返回空表")
	return out


## 圣物 id -> Dictionary
func relic_map() -> Dictionary:
	var out: Dictionary = {}
	for r: Dictionary in relics():
		out[str(r.get("id", ""))] = r
	return out


## 事件表 srpg_events：返回数组
func events() -> Array:
	var t: Variant = _table("srpg_events")
	var out: Array = []
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out.append({
					"id": _s(d, "id", ""),
					"chapter": _i(d, "chapter", 1),
					"name_cn": _s(d, "name_cn", "无名事件"),
					"devotion": d.get("devotion", {}) if d.get("devotion") is Dictionary else {},
					"blasphemy": d.get("blasphemy", {}) if d.get("blasphemy") is Dictionary else {},
				})
	else:
		_warn_once("srpg_events 缺失或非数组，返回空表")
	return out


## 图腾表 srpg_totems：返回数组（9 座）
func totems() -> Array:
	var t: Variant = _table("srpg_totems")
	var out: Array = []
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				out.append({
					"id": _s(d, "id", ""),
					"name_cn": _s(d, "name_cn", "无名图腾"),
					"cost": _i(d, "cost", 30),
					"desc_cn": _s(d, "desc_cn", ""),
					"effect": d.get("effect", {}) if d.get("effect") is Dictionary else {},
				})
	else:
		_warn_once("srpg_totems 缺失或非数组，返回空表")
	return out


## 章节表 srpg_chapters：返回数组（防御性补齐默认键）
func chapters() -> Array:
	var t: Variant = _table("srpg_chapters")
	var out: Array = []
	if t is Array:
		for raw: Variant in (t as Array):
			if raw is Dictionary:
				var d: Dictionary = raw as Dictionary
				var ch: Dictionary = DEF_CHAPTER.duplicate(true)
				for k: String in d.keys():
					ch[k] = d.get(k)
				if not (ch.get("minion_hp") is Array):
					ch["minion_hp"] = [8, 12]
				if not (ch.get("minion_damage") is Array):
					ch["minion_damage"] = [3, 4]
				if not (ch.get("waves") is Array):
					ch["waves"] = []
				out.append(ch)
			else:
				_warn_once("srpg_chapters 含非字典元素，已跳过")
	else:
		_warn_once("srpg_chapters 缺失或非数组，返回默认单章")
		out.append(DEF_CHAPTER.duplicate(true))
	return out


## 商店表 srpg_shop：合并默认
func shop() -> Dictionary:
	var t: Variant = _table("srpg_shop")
	var out: Dictionary = DEF_SHOP.duplicate(true)
	if t is Dictionary:
		var d: Dictionary = t as Dictionary
		for k: String in d.keys():
			out[k] = d.get(k)
		if not (out.get("relic_price") is Dictionary):
			out["relic_price"] = {"white": 10, "blue": 18, "gold": 30}
	else:
		_warn_once("srpg_shop 缺失或非字典，用默认定价")
	return out


## 规则表 srpg_rules：合并默认（realtime/xp_anchors/punishment_timer/facing 等）
func rules() -> Dictionary:
	var t: Variant = _table("srpg_rules")
	var out: Dictionary = {
		"facing": DEF_FACING.duplicate(true),
		"realtime": DEF_REALTIME.duplicate(true),
		"xp_anchors": DEF_XP_ANCHORS.duplicate(),
		"punishment_timer": DEF_PUNISHMENT_TIMER.duplicate(true),
		"relic_drop": DEF_RELIC_DROP.duplicate(true),
		"meta": {"incense_per_run_expect": 60},
	}
	if t is Dictionary:
		var d: Dictionary = t as Dictionary
		for k: String in d.keys():
			out[k] = d.get(k)
		if not (out.get("facing") is Dictionary):
			out["facing"] = DEF_FACING.duplicate(true)
		if not (out.get("realtime") is Dictionary):
			out["realtime"] = DEF_REALTIME.duplicate(true)
		else:
			var rt: Dictionary = out.get("realtime") as Dictionary
			if not (rt.get("compensation") is Dictionary):
				rt["compensation"] = DEF_COMPENSATION.duplicate(true)
		if not (out.get("xp_anchors") is Array):
			out["xp_anchors"] = DEF_XP_ANCHORS.duplicate()
		if not (out.get("punishment_timer") is Dictionary):
			out["punishment_timer"] = DEF_PUNISHMENT_TIMER.duplicate(true)
		if not (out.get("relic_drop") is Dictionary):
			out["relic_drop"] = DEF_RELIC_DROP.duplicate(true)
	else:
		_warn_once("srpg_rules 缺失或非字典，用默认规则")
	return out
