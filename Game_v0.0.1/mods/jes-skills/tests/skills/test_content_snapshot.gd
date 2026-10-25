# 数值快照测试（R-1 配套，2026-10-22）。
#
# ## 它解决什么
#
# 结构性契约（test_content_contract.gd）能拦「缺字段 / 没注册 / 缺参数」，
# 拦不住「某个技能耗蓝 12 被静默改成 120」——只要还在区间内，一切照绿。
# 本文件把 80 条内容的**真实生效值**（含默认值兜底后的运行时值）冻进快照，
# 任何数值变化都会红，并提示「你改了数值：确认是有意的就重跑生成器更新快照」。
#
# ## 配套
#
# - 快照生成器：`gen_content_snapshot.gd`（SceneTree 脚本，运行时导出，含默认值）
# - 快照文件：`content_snapshot.json`（80 条，键排序，逐字段比对）
#
# ## 纪律
#
# - 改数值 → 重跑生成器 → diff 快照 → 确认每一处变化都是你有意的 → 提交
# - 本测试红 ≠ 坏事：它是「变更留痕」，不是「禁止变更」
extends GutTest

const SNAPSHOT_PATH := "res://mods/jes-skills/tests/skills/content_snapshot.json"
const ACTIVE_DIR := "res://mods/jes-skills/content/gems/active"
const SUPPORT_DIR := "res://mods/jes-skills/content/gems/supports"

var _snapshot: Dictionary = {}
var _current: Dictionary = {}


func before_all() -> void:
	GemRegistry.reload()
	var txt := FileAccess.get_file_as_string(SNAPSHOT_PATH)
	assert_ne(txt.length(), 0, "快照文件缺失或为空：%s" % SNAPSHOT_PATH)
	var parsed: Variant = JSON.parse_string(txt)
	assert_true(parsed is Dictionary, "快照不是合法 JSON 对象")
	if parsed is Dictionary:
		_snapshot = parsed

	for s in GemRegistry.skills():
		_current[String(s.gem_id)] = _snap_active(s)
	for g in GemRegistry.supports():
		_current[String(g.support_id)] = _snap_support(g)


# ---------------- 主动技能 ----------------

func _snap_active(s: SkillData) -> Dictionary:
	return {
		"kind": "active",
		"base_cost": s.base_cost,
		"base_cooldown": s.base_cooldown,
		"base_cast_time": s.base_cast_time,
		"cost_type": s.cost_type,
		"parts": _snap_parts(s),
	}


func _snap_parts(s: SkillData) -> Array:
	var arr: Array = []
	for part in s.parts:
		var params := {}
		var pkeys := part.behavior_params.keys()
		pkeys.sort()
		for k in pkeys:
			params[String(k)] = _jsonify(part.behavior_params[k])
		arr.append({
			"behavior_id": String(part.behavior_id),
			"channel": part.damage_channel,
			"effectiveness": part.damage_effectiveness,
			"base_damage": _jsonify(part.base_damage),
			"params": params,
		})
	return arr


func _snap_support(g: SupportGemData) -> Dictionary:
	var mods: Array = []
	for m in g.stat_modifiers:
		mods.append({"stat": String(m.stat), "value": m.value})
	return {
		"kind": "supports",
		"cost_multiplier": g.cost_multiplier,
		"stat_modifiers": mods,
	}


func _jsonify(v) -> Variant:
	if v is Dictionary:
		var out := {}
		var ks := (v as Dictionary).keys()
		ks.sort()
		for k in ks:
			out[String(k)] = _jsonify((v as Dictionary)[k])
		return out
	if v is Array:
		var out2: Array = []
		for e in v:
			out2.append(_jsonify(e))
		return out2
	if v is StringName:
		return String(v)
	if v is float:
		return snappedf(v, 0.0001)
	return v


# ---------------- 断言 ----------------

## 运行时内容集与快照的 id 集合一致（新增/删除内容必须重新生成快照）
func test_s1_id_sets_match() -> void:
	var snap_ids: Array = _snapshot.keys()
	var cur_ids: Array = _current.keys()
	snap_ids.sort()
	cur_ids.sort()
	assert_eq(
		cur_ids, snap_ids,
		"内容集与快照不一致。新增/删除了内容？重跑 tests/skills/gen_content_snapshot.gd"
	)


## 逐条逐字段比对（批量报告全部差异，而不是红一个停一个）
func test_s2_values_match_snapshot() -> void:
	var diffs: Array[String] = []
	for id in _current:
		if not _snapshot.has(id):
			continue  # id 集合不一致已由 s1 报告
		var cur: Dictionary = _current[id]
		var snap: Dictionary = _snapshot[id]
		if cur.get("kind") != snap.get("kind"):
			diffs.append("%s: kind %s → %s" % [id, snap.get("kind"), cur.get("kind")])
			continue
		for key in ["base_cost", "base_cooldown", "base_cast_time", "cost_type", "cost_multiplier"]:
			if cur.has(key) and snap.has(key):
				if not _equal_num(cur[key], snap[key]):
					diffs.append("%s.%s: %s → %s" % [id, key, snap[key], cur[key]])
		# parts 数值
		if cur.has("parts") and snap.has("parts"):
			var cp: Array = cur["parts"]
			var sp: Array = snap["parts"]
			if cp.size() != sp.size():
				diffs.append("%s: parts 数量 %d → %d" % [id, sp.size(), cp.size()])
			else:
				for i in cp.size():
					_diff_part(id, i, sp[i], cp[i], diffs)
		# 辅助的 stat_modifiers（归一化后比较：JSON 往返会把 int 变 float）
		if cur.has("stat_modifiers") and snap.has("stat_modifiers"):
			var cm: Array = cur["stat_modifiers"]
			var sm: Array = snap["stat_modifiers"]
			if cm.size() != sm.size():
				diffs.append("%s: stat_modifiers 数量 %d → %d" % [id, sm.size(), cm.size()])
			else:
				for i in cm.size():
					if str(_norm(sm[i])) != str(_norm(cm[i])):
						diffs.append("%s.stat_modifiers[%d]: %s → %s" % [id, i, sm[i], cm[i]])

	assert_eq(
		diffs.size(), 0,
		"数值与快照不一致 %d 处。若是有意改动：重跑 tests/skills/gen_content_snapshot.gd 并提交新快照。\n"
		+ "\n".join(diffs)
	)


func _diff_part(id: String, idx: int, snap_p: Dictionary, cur_p: Dictionary, diffs: Array[String]) -> void:
	if snap_p.get("behavior_id") != cur_p.get("behavior_id"):
		diffs.append("%s.parts[%d].behavior_id: %s → %s"
				% [id, idx, snap_p.get("behavior_id"), cur_p.get("behavior_id")])
		return
	var sp: Dictionary = snap_p.get("params", {})
	var cp: Dictionary = cur_p.get("params", {})
	for k in sp:
		if not cp.has(k):
			diffs.append("%s.parts[%d].%s: 快照有 %s，运行时被删" % [id, idx, k, sp[k]])
		elif str(_norm(sp[k])) != str(_norm(cp[k])):
			diffs.append("%s.parts[%d].%s: %s → %s" % [id, idx, k, sp[k], cp[k]])
	for k in cp:
		if not sp.has(k):
			diffs.append("%s.parts[%d].%s: 新增 %s（快照没有）" % [id, idx, k, cp[k]])
	# 伤害与效果缩放（归一化后比较）
	if str(_norm(snap_p.get("base_damage"))) != str(_norm(cur_p.get("base_damage"))):
		diffs.append("%s.parts[%d].base_damage: %s → %s"
				% [id, idx, snap_p.get("base_damage"), cur_p.get("base_damage")])
	if not _equal_num(snap_p.get("effectiveness", 1.0), cur_p.get("effectiveness", 1.0)):
		diffs.append("%s.parts[%d].effectiveness: %s → %s"
				% [id, idx, snap_p.get("effectiveness"), cur_p.get("effectiveness")])


func _equal_num(a, b) -> bool:
	if a is float or b is float:
		return absf(float(a) - float(b)) < 0.0001
	return a == b


## JSON 往返会把 int 变 float（op:1 → 1.0），且字典字符串化依赖键序。
## 比较前两侧都过一遍归一化：数值一律转 float，字典键排序重建。
func _norm(v) -> Variant:
	if v is Dictionary:
		var out := {}
		var ks := (v as Dictionary).keys()
		ks.sort()
		for k in ks:
			out[String(k)] = _norm((v as Dictionary)[k])
		return out
	if v is Array:
		var arr: Array = []
		for e in v:
			arr.append(_norm(e))
		return arr
	if v is int:
		return float(v)
	if v is float:
		return snappedf(v, 0.0001)
	return v
