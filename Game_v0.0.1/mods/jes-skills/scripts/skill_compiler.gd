## ============================================================
## 技能水晶系统 · 编译器（对译 HTLM/mods/jes-skill-crystal/systems/skill-compiler.js 编译主流程的最小闭环）
## 输入：玩家装备的技能石 id + 等级 + 水晶列表（槽位顺序）→ 输出：攻击实例 Dictionary（含最终数值）
## 口径（冻结，勿改）：
##   - 水晶与遗物是同一套修饰器机制，三档权限：
##       mutate_number（改已有数字）/ add_behavior（加行为）/ mutate_live_instance（改场上实例）
##   - 当前口径：水晶 = 只做 mutate_number（改数字）；
##       add_behavior 本期不实现，编译时遇到返回「未支持」标记（NOT_IMPLEMENTED）不崩溃
##   - 修饰器是纯数据函数链：base 值 → 依次过每个修饰器 → 最终值
##   - 同字段多来源按固定算子顺序归并：set → add → mul → clamp（36.6 冻结接口；
##     对译 JS _OP_ORDER 的桶归并，JS 的 merge 名映射：exclusive→set / add→add /
##     multiply→mul / min→clamp_max / max→clamp_min）
##   - 事件只有两个：hit（命中成立）与 vanish（正常消失）；编译产物只带数据，事件由运行时发
## 铁律：函数/变量名纯 ASCII；不用 push_error；缩进 Tab；不碰场景节点
## ============================================================
class_name SkillCompilerCore
extends RefCounted

const STRATEGY_VERSION := "sc-godot-v1"

## 真源 merge 名 → 固定归并批次（set → add → mul → clamp）
const MERGE_KIND := {
	"exclusive": "set",
	"add": "add",
	"multiply": "mul",
	"min": "clamp_max",
	"max": "clamp_min",
}

## add_behavior 类执行器（本期不实现，遇到打「未支持」标记）
const ADD_BEHAVIOR_EXECUTORS := {
	"addNode": true,
	"convertNode": true,
	"removeNode": true,
}

## 施放层统计白名单（对译真源 _STATS：首版仅开 cdMul，越小越快）
const STAT_WHITELIST := {
	"cdMul": true,
}


## 编译主流程。
## config: SkillConfigCore（已加载 cfg 表）
## skill_id: 技能石 id；level: 技能等级（1 起）
## crystals: Array[Dictionary]，槽位顺序，元素 = {"id": String, "level": int}
## 返回：
## {
##   ok: bool,
##   skill_id, level, strategy_version,
##   params: Dictionary（最终数值：coefficient/cooldown/speed/life/radius/count/...）,
##   cast_stats: Dictionary（施放层统计，如 {"cdMul": 0.94}；无贡献 = {}）,
##   crystal_results: Array[{crystal_id, status, reason_codes}],
##     status ∈ "applied"（mutate_number 生效）/ "unsupported"（add_behavior 未支持）/ "inactive"（无匹配暴露字段）
##   diagnostics: Array[{code, message}],
##   reason_codes: Array[String]（去重后的原因码）,
## }
static func compile(config: SkillConfigCore, skill_id: String, level: int, crystals: Array) -> Dictionary:
	var diagnostics: Array = []
	var crystal_results: Array = []
	var reason_codes: Array = []

	var sdef: Dictionary = config.get_skill_def(skill_id)
	if sdef.is_empty():
		_add_diag(diagnostics, reason_codes, "INVALID_REFERENCE",
			"技能实例或技能定义缺失: " + skill_id)
		return _fail(skill_id, level, diagnostics, crystal_results, reason_codes)

	# 阶段 1：base 值（修饰器链起点，纯数据）
	var params: Dictionary = config.get_base_params(skill_id, level)
	var cast_stats: Dictionary = {}
	var cd_mul_value := -1.0   # -1 = 无贡献；>0 = 已合并的 cdMul

	# 阶段 2~4：逐水晶（槽位顺序）逐操作收集贡献；mutate_number 立即入桶，add_behavior 打未支持标记
	# 贡献桶：field -> Array[{op_id, crystal_id, kind, value}]（同字段按固定算子批次归并）
	var buckets: Dictionary = {}
	for c in crystals:
		var cdict: Dictionary = c if typeof(c) == TYPE_DICTIONARY else {}
		var cid := str(cdict.get("id", cdict.get("crystal_id", "")))
		var clevel := int(cdict.get("level", 1))
		var cdef: Dictionary = config.get_crystal_def(cid)
		if cdef.is_empty():
			_add_diag(diagnostics, reason_codes, "INVALID_REFERENCE",
				"水晶引用缺失: " + cid)
			crystal_results.append({"crystal_id": cid, "status": "inactive",
				"reason_codes": ["INVALID_REFERENCE"]})
			continue
		var lv_params: Dictionary = config.get_crystal_level_params(cdef, clevel)
		var ops: Array = cdef.get("operations", [])
		var applied_any := false
		var unsupported_any := false
		for op_v in ops:
			var op: Dictionary = op_v if typeof(op_v) == TYPE_DICTIONARY else {}
			var executor := str(op.get("executor", ""))
			# add_behavior 类：本期不实现，打「未支持」标记，不崩溃、不应用
			if ADD_BEHAVIOR_EXECUTORS.has(executor):
				unsupported_any = true
				_add_diag(diagnostics, reason_codes, "NOT_IMPLEMENTED",
					"add_behavior 类执行器本期未支持: %s.%s (%s)" % [cid, str(op.get("id", "")), executor])
				continue
			if executor == "modifyParameter":
				# mutate_number：改已有数字（仅暴露字段；未暴露 = 不应用）
				if _collect_param_op(op, cid, lv_params, params, buckets, diagnostics, reason_codes):
					applied_any = true
				continue
			if executor == "modifyStat":
				# mutate_number（施放层统计）：白名单硬闸门，防「配了不生效」的静默 bug
				var stat := str(op.get("stat", ""))
				if not STAT_WHITELIST.has(stat):
					_add_diag(diagnostics, reason_codes, "UNKNOWN_STAT",
						"未知施放层统计: " + stat)
					continue
				var sv: Variant = _op_value(op, lv_params, stat)
				if typeof(sv) != TYPE_FLOAT and typeof(sv) != TYPE_INT:
					continue
				if stat == "cdMul":
					cd_mul_value = _merge_scalar("mul", cd_mul_value, float(sv))
					applied_any = true
				continue
			# 未知执行器（对译 UNKNOWN_EXECUTOR）
			_add_diag(diagnostics, reason_codes, "UNKNOWN_EXECUTOR",
				"未知执行器: " + executor)
		# 水晶级结果：未支持优先级最高（可见性），其次 applied，最后 inactive
		var status := "inactive"
		if unsupported_any:
			status = "unsupported"
		elif applied_any:
			status = "applied"
		crystal_results.append({"crystal_id": cid, "status": status,
			"reason_codes": [] if status == "applied" else (["NOT_IMPLEMENTED"] if status == "unsupported" else ["NO_COMPATIBLE_NODE"])})

	# 阶段 5：同字段按固定算子顺序归并（set → add → mul → clamp），批次内按 operationId 排序保稳定
	for field in buckets:
		var base_v := float(params.get(field, 0.0))
		var final_v := _resolve_field(buckets[field], base_v, diagnostics, reason_codes, field)
		params[field] = final_v

	# 阶段 6：施放层统计落最终数值（cdMul 折进 cooldown，同时保留 cd_mul 供 UI 读）
	if cd_mul_value > 0.0:
		params["cooldown"] = float(params.get("cooldown", 1.0)) * cd_mul_value
		params["cd_mul"] = cd_mul_value
		cast_stats["cdMul"] = cd_mul_value

	return {
		"ok": true,
		"skill_id": skill_id,
		"level": level,
		"strategy_version": STRATEGY_VERSION,
		"params": params,
		"cast_stats": cast_stats,
		"crystal_results": crystal_results,
		"diagnostics": diagnostics,
		"reason_codes": reason_codes,
	}


## mutate_number 贡献收集：modifyParameter → 桶。返回是否成功收集。
static func _collect_param_op(op: Dictionary, cid: String, lv_params: Dictionary,
		params: Dictionary, buckets: Dictionary, diagnostics: Array, reason_codes: Array) -> bool:
	var field := str(op.get("field", ""))
	if field.begins_with("parameters."):
		field = field.substr("parameters.".length())
	if field.is_empty():
		_add_diag(diagnostics, reason_codes, "INVALID_REFERENCE",
			"modifyParameter 缺 field: " + cid)
		return false
	# 仅暴露字段：目标字段必须已在 base 参数里暴露，否则视为无匹配（不自创字段）
	if not params.has(field):
		_add_diag(diagnostics, reason_codes, "NO_COMPATIBLE_NODE",
			"目标字段未暴露，水晶不生效: %s.%s" % [cid, field])
		return false
	var value: Variant = _op_value(op, lv_params, field)
	if typeof(value) != TYPE_FLOAT and typeof(value) != TYPE_INT:
		_add_diag(diagnostics, reason_codes, "INVALID_PARAMETER",
			"操作取值缺失或非数值: %s.%s" % [cid, field])
		return false
	var merge_name := str(op.get("merge", "add"))
	if not MERGE_KIND.has(merge_name):
		_add_diag(diagnostics, reason_codes, "INVALID_PARAMETER",
			"未知合并算子: " + merge_name)
		return false
	var op_id := str(op.get("id", ""))
	var key := str(cid) + "|" + op_id
	if not buckets.has(field):
		buckets[field] = []
	buckets[field].append({
		"op_id": op_id,
		"crystal_id": cid,
		"key": key,
		"kind": MERGE_KIND[merge_name],
		"value": float(value),
	})
	return true


## 操作取值：lv_params[op.parameter] → op.value → lv_params[field]（对译 _addParamContribution 取值链）
static func _op_value(op: Dictionary, lv_params: Dictionary, field: String) -> Variant:
	var parameter := str(op.get("parameter", ""))
	if not parameter.is_empty() and lv_params.has(parameter):
		return lv_params[parameter]
	if op.has("value"):
		return op["value"]
	if lv_params.has(field):
		return lv_params[field]
	return null


## 同字段归并：set → add → mul → clamp_max → clamp_min（批次内按 key 排序，浮点同序）
## exclusive 多来源 = MOTION_CONFLICT（对译 _resolveMerges：冲突时不应用 set）
static func _resolve_field(list: Array, base_v: float, diagnostics: Array,
		reason_codes: Array, field: String) -> float:
	var sorted := list.duplicate()
	sorted.sort_custom(func(a, b): return str(a["key"]) < str(b["key"]))
	var v := base_v
	# set（exclusive）
	var sets := sorted.filter(func(x): return x["kind"] == "set")
	if sets.size() > 1:
		_add_diag(diagnostics, reason_codes, "MOTION_CONFLICT",
			"exclusive 字段多来源: " + field)
	elif sets.size() == 1:
		v = float(sets[0]["value"])
	# add
	for x in sorted:
		if x["kind"] == "add":
			v += float(x["value"])
	# mul
	for x in sorted:
		if x["kind"] == "mul":
			v *= float(x["value"])
	# clamp（min → 上限，max → 下限）
	for x in sorted:
		if x["kind"] == "clamp_max":
			v = minf(v, float(x["value"]))
	for x in sorted:
		if x["kind"] == "clamp_min":
			v = maxf(v, float(x["value"]))
	return v


## 标量合并（施放层统计用）：cur = -1 视为无贡献基准
static func _merge_scalar(kind: String, cur: float, value: float) -> float:
	if cur < 0.0:
		cur = 1.0
	if kind == "add":
		return cur + value
	if kind == "mul":
		return cur * value
	if kind == "clamp_max":
		return minf(cur, value)
	if kind == "clamp_min":
		return maxf(cur, value)
	return value


## 诊断登记：diagnostics 追加明细，reason_codes 去重收集
static func _add_diag(diagnostics: Array, reason_codes: Array, code: String, message: String) -> void:
	diagnostics.append({"code": code, "message": message})
	if not reason_codes.has(code):
		reason_codes.append(code)


## 失败产物：ok=false，params 恒空（不发布半成品，对译 _fail）
static func _fail(skill_id: String, level: int, diagnostics: Array,
		crystal_results: Array, reason_codes: Array) -> Dictionary:
	return {
		"ok": false,
		"skill_id": skill_id,
		"level": level,
		"strategy_version": STRATEGY_VERSION,
		"params": {},
		"cast_stats": {},
		"crystal_results": crystal_results,
		"diagnostics": diagnostics,
		"reason_codes": reason_codes,
	}
