## ============================================================
## 技能水晶系统 · 配置加载层（对译 HTLM/mods/jes-skill-crystal/systems/skill-config.js 的读取职责）
## 真源表：cfg/skillSystem.json（skillDefs=技能石 / crystalDefs=水晶 / effectTemplates=模板）
##         旧表 cfg/skills.json 仅作技能石兜底（dmgMul/cd/bulletSpd 归一到真源字段名）
## 边界：纯逻辑层，不碰场景节点，headless 可测；缺字段给保守默认值并对同一 (id, field) 只 push_warning 一次
## ============================================================
class_name SkillConfigCore
extends RefCounted

const SOURCE_PATH := "res://cfg/skillSystem.json"
const LEGACY_SKILLS_PATH := "res://cfg/skills.json"

## 期望字段 → 保守默认值（对齐 TP_FLIGHT_PROJECTILE 模板默认与真源 _sdNum 兜底口径）
const FIELD_DEFAULTS := {
	"coefficient": 1.0,        # 伤害倍率（真源 levels[].parameters.coefficient；旧表 dmgMul 归一于此）
	"cooldown": 1.0,           # 冷却秒数（真源 levels[].cooldown；旧表 cd 归一于此）
	"speed": 480.0,            # 弹速（真源 parameters.speed；旧表 bulletSpd 归一于此）
	"life": 1.6,               # 弹寿命
	"radius": 8.0,             # 半径
	"count": 1,                # 数量
	"pierce": 0,               # 模板默认贯穿
	"extraPierceCount": 0,     # 额外贯穿（CR_PIERCE 目标暴露字段）
	"moreDamageMul": 1.0,      # 独立 More 因子（真源 damage 公式 Π(mores)，初始 1）
}

## 旧表字段名 → 真源字段名（cfg/skills.json 归一映射；字段名跟真源一致）
const LEGACY_FIELD_MAP := {
	"dmgMul": "coefficient",
	"damageMul": "coefficient",
	"cd": "cooldown",
	"bulletSpd": "speed",
}

## 技能等级参数的期望字段清单（get_base_params 逐项兜底）
const SKILL_PARAM_FIELDS := [
	"coefficient", "cooldown", "speed", "life", "radius", "count",
	"pierce", "extraPierceCount", "moreDamageMul",
]

var ok := false                          # 主表是否加载成功
var config_version := ""                 # 主表 configVersion（对译 defs.configVersion）
var slot_count := 4                      # 水晶槽位上限（真源默认 4）
var skill_defs := {}                     # id -> Dictionary（技能石定义）
var crystal_defs := {}                   # id -> Dictionary（水晶定义）
var legacy_skills := {}                  # id -> Dictionary（旧表兜底，已归一字段名）
var _warned := {}                        # 去重表："id|field" -> true，保证 push_warning 只一次


func _init() -> void:
	_load()


## 加载主表与旧表兜底；解析失败不抛错，置 ok=false 并 push_warning
func _load() -> void:
	var raw := _read_json(SOURCE_PATH)
	if raw.is_empty():
		push_warning("SkillConfigCore: 主表加载失败或为空: %s" % SOURCE_PATH)
		return
	ok = true
	config_version = str(raw.get("configVersion", ""))
	slot_count = int(raw.get("slotCount", 4))
	var sd: Dictionary = raw.get("skillDefs", {})
	for id in sd:
		skill_defs[id] = sd[id]
	var cd: Dictionary = raw.get("crystalDefs", {})
	for id in cd:
		crystal_defs[id] = cd[id]
	# 旧表兜底：主表没有的技能石才收（字段名归一到真源）
	var legacy := _read_json(LEGACY_SKILLS_PATH)
	for id in legacy:
		if not skill_defs.has(id):
			legacy_skills[id] = _normalize_legacy(legacy[id])


## 读 JSON 文件（不存在/解析失败返回空 Dictionary）
func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed


## 旧表条目 → 真源字段名结构（只搬数值字段，其余原样保留）
func _normalize_legacy(entry: Dictionary) -> Dictionary:
	var out := {}
	for k in entry:
		if LEGACY_FIELD_MAP.has(k):
			out[LEGACY_FIELD_MAP[k]] = entry[k]
		else:
			out[k] = entry[k]
	return out


## 缺字段兜底：默认值 + 同一 (id, field) 只 push_warning 一次
func _fill_default(id: String, field: String, params: Dictionary) -> void:
	if not FIELD_DEFAULTS.has(field):
		return
	if not _warned.has(id + "|" + field):
		_warned[id + "|" + field] = true
		push_warning("SkillConfigCore: %s 缺字段 %s，用默认值 %s" % [id, field, str(FIELD_DEFAULTS[field])])
	params[field] = FIELD_DEFAULTS[field]


## 取技能石定义（主表优先，旧表兜底；缺失返回 {}）
func get_skill_def(id: String) -> Dictionary:
	if skill_defs.has(id):
		return skill_defs[id]
	if legacy_skills.has(id):
		return legacy_skills[id]
	return {}


## 取水晶定义（缺失返回 {}）
func get_crystal_def(id: String) -> Dictionary:
	if crystal_defs.has(id):
		return crystal_defs[id]
	return {}


## 水晶指定等级的等级参数表（levels[level-1].parameters；越界/缺失返回 {}）
func get_crystal_level_params(cdef: Dictionary, level: int) -> Dictionary:
	var levels: Array = cdef.get("levels", [])
	if levels.is_empty():
		return {}
	var idx := clampi(level - 1, 0, levels.size() - 1)
	var lv: Variant = levels[idx]
	if typeof(lv) != TYPE_DICTIONARY:
		return {}
	return lv.get("parameters", {})


## 取技能石某等级的基础参数（base 值，编译器修饰器链的起点）
## 口径：base 值 → 依次过每个修饰器 → 最终值；本函数只产出 base 值
func get_base_params(skill_id: String, level: int) -> Dictionary:
	var sdef := get_skill_def(skill_id)
	if sdef.is_empty():
		return {}
	var out := {}
	# 模板默认兜底（真源 _cloneNode：先模板 params 再等级行覆盖）
	for field in FIELD_DEFAULTS:
		out[field] = FIELD_DEFAULTS[field]
	# 等级行：levels[level-1]（越界钳到最高级，与真源 lvSpec 取法一致）
	var levels: Array = sdef.get("levels", [])
	if not levels.is_empty():
		var idx := clampi(level - 1, 0, levels.size() - 1)
		var lv: Variant = levels[idx]
		if typeof(lv) == TYPE_DICTIONARY:
			# 旧表等级行：cd/dmgMul/bulletSpd 直接归一
			for k in lv:
				if LEGACY_FIELD_MAP.has(k):
					out[LEGACY_FIELD_MAP[k]] = lv[k]
				else:
					out[k] = lv[k]
			# 真源等级行：parameters 子袋覆盖
			var ps: Dictionary = lv.get("parameters", {})
			for k in ps:
				out[k] = ps[k]
	else:
		# 旧表条目为平铺结构（cd/dmgMul/bulletSpd 在顶层）：只收数值字段
		for k in sdef:
			var v2: Variant = sdef[k]
			if typeof(v2) == TYPE_FLOAT or typeof(v2) == TYPE_INT:
				if LEGACY_FIELD_MAP.has(k):
					out[LEGACY_FIELD_MAP[k]] = v2
				else:
					out[k] = v2
	# 期望字段逐一兜底（缺的给默认值并 push_warning 一次）
	for field in SKILL_PARAM_FIELDS:
		var v: Variant = out.get(field, null)
		if typeof(v) != TYPE_FLOAT and typeof(v) != TYPE_INT:
			_fill_default(skill_id, field, out)
		else:
			out[field] = float(v)
	return out
