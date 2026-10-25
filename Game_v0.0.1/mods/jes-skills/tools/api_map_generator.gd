class_name ApiMapGenerator
extends RefCounted

## D-47 API 地图生成器（自动生成，勿手改产物）
## 扫描三类真源，产出单文件速查表：
##   1. 行为层：systems/skills/behavior/*.gd 的 class_name + produced_params() + consumed_stats()
##   2. 标签承诺面：util/tag_registry.gd 的 DEFS（kind + promises）
##   3. 内容层：content/gems/{active,supports}/*.tres（中文名/gem_id/三维签名/装配口子）
## 生成命令（见 tools/gen_api_map.gd）；门禁 tests/docs/test_api_map.gd 比对磁盘内容防过期失真。

const BEHAVIOR_DIR := "res://mods/jes-skills/systems/skills/behavior"
const ACTIVE_DIR := "res://mods/jes-skills/content/gems/active"
const SUPPORT_DIR := "res://mods/jes-skills/content/gems/supports"
# 时序/弹道线索键（出现在 behavior_params 里就摘进签名列）
const SIGNATURE_KEYS: Array[StringName] = [
	&"shape", &"delay", &"hit_count", &"hit_interval",
	&"zone_duration", &"motion", &"formation", &"per_cast",
]

static func generate() -> String:
	var L: Array[String] = []
	L.append("# API 地图（自动生成，勿手改）")
	L.append("")
	L.append("> D-47：本文件由 `tools/gen_api_map.gd` 扫描三类真源自动产出。")
	L.append("> 接口/内容改动后必须重跑生成；门禁 `tests/docs/test_api_map.gd` 比对磁盘内容，过期即红。")
	L.append("> 重新生成：`Godot --headless --path . -s res://mods/jes-skills/tools/gen_api_map.gd`")
	L.append(">")
	L.append("> 生成时间戳不写入本文件（保证逐字节确定性，便于门禁比对）。")
	L.append("")
	L.append(_section_behaviors())
	L.append(_section_tags())
	L.append(_section_actives())
	L.append(_section_supports())
	return "\n".join(L)

## —— 第一节：行为层声明面 ——
static func _section_behaviors() -> String:
	var L: Array[String] = []
	L.append("## 一、行为层声明面（behavior/*.gd）")
	L.append("")
	var scripts: Array[String] = _list_scripts(BEHAVIOR_DIR)
	for path in scripts:
		var s: Script = load(path)
		if s == null:
			continue
		var cname: String = s.get_global_name()
		if cname == "":
			continue
		L.append("### %s（`%s`）" % [cname, _short(path)])
		var produced: Array = s.produced_params()
		var consumed: Array = s.consumed_stats()
		L.append("- produced_params（参数键承诺）: %s" % _names(produced))
		L.append("- consumed_stats（消费属性）: %s" % _names(consumed))
		L.append("")
	return "\n".join(L)

## —— 第二节：标签承诺面 ——
static func _section_tags() -> String:
	var L: Array[String] = []
	L.append("## 二、标签承诺面（util/tag_registry.gd）")
	L.append("")
	var tags: Array = TagRegistry.all_tags()
	tags.sort()
	var rows: Array[String] = []
	for t in tags:
		var kind: String = String(TagRegistry.kind_of(t))
		var promises: Array = TagRegistry.promises_of(t)
		rows.append("| `%s` | %s | %s |" % [String(t), kind, _names(promises)])
	L.append("| 标签 | 类别 | 承诺参数面 |")
	L.append("|---|---|---|")
	for r in rows:
		L.append(r)
	L.append("")
	return "\n".join(L)

## —— 第三节：主动技能总表 ——
static func _section_actives() -> String:
	var L: Array[String] = []
	L.append("## 三、主动技能总表（content/gems/active）")
	L.append("")
	var paths: Array[String] = _list_scripts(ACTIVE_DIR)
	var rows: Array[String] = []
	for p in paths:
		var gem: Resource = load(p)
		if gem == null or gem.get("gem_id") == null:
			continue
		var sig: String = _signature(gem.get("parts"))
		var tags: Array = gem.get("tags")
		rows.append("| %s | `%s` | %s | %s | %s |" % [
			String(gem.get("display_name")), String(gem.get("gem_id")),
			sig, _names(tags),
			"%.1f / %.1fs" % [float(gem.get("base_cost")), float(gem.get("base_cooldown"))],
		])
	rows.sort()
	L.append("共 %d 颗。" % rows.size())
	L.append("")
	L.append("| 中文名 | gem_id | 行为段（行为×形状×时序线索） | 标签 | 耗蓝/冷却 |")
	L.append("|---|---|---|---|---|")
	for r in rows:
		L.append(r)
	L.append("")
	return "\n".join(L)

## —— 第四节：辅助宝石总表 ——
static func _section_supports() -> String:
	var L: Array[String] = []
	L.append("## 四、辅助宝石总表（content/gems/supports）")
	L.append("")
	var paths: Array[String] = _list_scripts(SUPPORT_DIR)
	var rows: Array[String] = []
	for p in paths:
		var gem: Resource = load(p)
		if gem == null or gem.get("support_id") == null:
			continue
		var mods: Array = gem.get("stat_modifiers")
		var mod_strs: Array[String] = []
		for m in mods:
			mod_strs.append("%s%s%s" % [String(m.stat), _op_str(int(m.op)), _num(float(m.value))])
		var overrides: Dictionary = gem.get("behavior_overrides")
		var ov_keys: Array = overrides.keys()
		ov_keys.sort()
		rows.append("| %s | `%s` | %s | %s | %s | %s | %s |" % [
			String(gem.get("display_name")), String(gem.get("support_id")),
			_names(gem.get("require_tags")), _names(gem.get("require_any_tags")),
			_names(gem.get("exclude_tags")),
			"; ".join(mod_strs) if not mod_strs.is_empty() else "—",
			_names(ov_keys) if not ov_keys.is_empty() else "—",
		])
	rows.sort()
	L.append("共 %d 颗。四个作用口子：stat_modifiers / add-require-exclude tags / behavior_overrides / conditions（D-15 暂缓）。" % rows.size())
	L.append("")
	L.append("| 中文名 | support_id | require | require_any | exclude | stat_modifiers | overrides 键 |")
	L.append("|---|---|---|---|---|---|---|")
	for r in rows:
		L.append(r)
	L.append("")
	return "\n".join(L)

## —— 工具函数 ——

# 一个技能的「行为×形状×时序」签名：逐 part 摘 SIGNATURE_KEYS 在场的键值
static func _signature(parts: Array) -> String:
	var segs: Array[String] = []
	for part in parts:
		if part == null:
			continue
		var bid: String = String(part.get("behavior_id")).trim_prefix("bhv_")
		var params: Dictionary = part.get("behavior_params")
		var hints: Array[String] = []
		for k in SIGNATURE_KEYS:
			if params.has(k):
				hints.append("%s=%s" % [String(k), _val_str(params[k])])
		segs.append("%s(%s)" % [bid, "; ".join(hints) if not hints.is_empty() else "默认"])
	return " → ".join(segs)

static func _val_str(v) -> String:
	if v is StringName or v is String:
		return String(v)
	if v is float or v is int:
		return _num(float(v))
	return str(v)

# GDScript 的 % 格式化不支持 %g：整数去掉 .0，小数最多保留两位
static func _num(x: float) -> String:
	if is_equal_approx(x, round(x)):
		return "%d" % int(round(x))
	return "%.2f" % x

static func _op_str(op: int) -> String:
	match op:
		0: return "+"
		1: return "×"
		_: return "?%d" % op

static func _names(arr) -> String:
	if arr == null or (arr is Array and arr.is_empty()):
		return "—"
	var out: Array[String] = []
	for v in arr:
		out.append("`%s`" % String(v))
	return ", ".join(out)

static func _short(path: String) -> String:
	return path.trim_prefix("res://mods/jes-skills/")

static func _list_scripts(dir_path: String) -> Array[String]:
	var out: Array[String] = []
	var d := DirAccess.open(dir_path)
	if d == null:
		return out
	# 注意：Godot 4.7 的 list_dir_begin() 不带 skip_hidden 参数，且 get_next() 语义
	# 会随当前模式变化（实测在 res:// 下只吐目录名）——一律走 get_files() 取文件名，最稳。
	var names: Array = d.get_files()
	for f in names:
		var name: String = String(f)
		if name.ends_with(".gd") or name.ends_with(".tres"):
			out.append(dir_path + "/" + name)
	out.sort()
	return out
