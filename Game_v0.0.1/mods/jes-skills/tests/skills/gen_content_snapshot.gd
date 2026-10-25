## 数值快照生成器（R-1 配套）：从运行时导出全部内容的「真实生效值」。
## 跑法：godot --headless --path . -s res://mods/jes-skills/tests/skills/gen_content_snapshot.gd
## 产物：mods/jes-skills/tests/skills/content_snapshot.json（与 test_content_snapshot.gd 配对）
## 内容或数值改动后重跑本脚本并提交，快照测试会提示「改了数值，确认后更新快照」。
extends SceneTree


func _init() -> void:
	GemRegistry.reload()
	var out := {}
	for s in GemRegistry.skills():
		out[String(s.gem_id)] = _snap_active(s)
	for g in GemRegistry.supports():
		out[String(g.support_id)] = _snap_support(g)

	var keys := out.keys()
	keys.sort()
	var sorted_out := {}
	for k in keys:
		sorted_out[k] = out[k]

	var path := "res://mods/jes-skills/tests/skills/content_snapshot.json"
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify(sorted_out, "  "))
	f.close()
	print("快照已写入 %s（%d 条）" % [path, out.size()])
	quit(0)


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


## Dictionary/Array 里的 StringName 键与值转成普通字符串，保证 JSON 可序列化且稳定
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
