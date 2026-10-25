# GemRegistry（规格 §10 content/）：内容加载器 —— .tres 是唯一真源。
#
# 为什么必须存在这个类：
#   附录 C 第 1 条要求「新增一个辅助石，改几个 .gd 文件？答案必须是 0」。
#   只要内容still由 .gd 里的工厂函数构造，答案就永远是 1。
#   所以运行时不再认识任何具体宝石，只认识「从 content/gems/ 里加载出来的 Resource」。
#
# 硬规则：
#   - 本类不含任何具体 gem_id / support_id 字面量，只按目录扫描
#   - 加载顺序按文件名排序，保证跨平台、跨次运行一致（测试断言依赖这一点）
#   - 缺 id / 重复 id 直接报错，不静默跳过（与 G7「整组拒绝」同一哲学）
class_name GemRegistry
extends RefCounted

const ACTIVE_DIR := "res://mods/jes-skills/content/gems/active"
const SUPPORT_DIR := "res://mods/jes-skills/content/gems/supports"
const TRIGGER_DIR := "res://mods/jes-skills/content/gems/triggers"

static var _skills: Dictionary = {}      # StringName -> SkillData
static var _supports: Dictionary = {}    # StringName -> SupportGemData
static var _triggers: Dictionary = {}    # StringName -> TriggerData
static var _loaded: bool = false
static var errors: Array[String] = []    # 加载期错误（缺 id / 重复 id / 类型不符）


## 全部主动技能（按 gem_id 排序，顺序稳定）
static func skills() -> Array:
	_ensure()
	return _sorted_values(_skills)


## 全部辅助石（按 support_id 排序，顺序稳定）
static func supports() -> Array:
	_ensure()
	return _sorted_values(_supports)


## 全部触发器（按文件名排序）
static func triggers() -> Array:
	_ensure()
	return _sorted_values(_triggers)


static func skill(id: StringName) -> SkillData:
	_ensure()
	return _skills.get(id, null)


static func support(id: StringName) -> SupportGemData:
	_ensure()
	return _supports.get(id, null)


static func trigger(id: StringName) -> TriggerData:
	_ensure()
	return _triggers.get(id, null)


static func has_support(id: StringName) -> bool:
	_ensure()
	return _supports.has(id)


static func has_skill(id: StringName) -> bool:
	_ensure()
	return _skills.has(id)


## 丢弃缓存，下次访问重新扫描磁盘（测试 / 热重载用）
static func reload() -> void:
	_loaded = false
	_skills.clear()
	_supports.clear()
	_triggers.clear()
	errors.clear()


# ---------------- 内部 ----------------

static func _ensure() -> void:
	if _loaded:
		return
	_loaded = true
	errors.clear()
	_skills = _load_dir(ACTIVE_DIR, &"gem_id", "SkillData")
	_supports = _load_dir(SUPPORT_DIR, &"support_id", "SupportGemData")
	# 触发器没有 id 字段（§3.4 只有 event/chance/cooldown/linked_slot），
	# 用文件名做键：on_crit.tres → &"on_crit"
	_triggers = _load_dir(TRIGGER_DIR, &"", "TriggerData")


## 扫描一个目录：文件名排序 → load → 按 id 字段建索引。
## id_field 为空时用「文件名去扩展名」作 id（触发器走这条）。
## expected 只用于错误信息，不做强制类型转换（Godot 侧类型已由 .tres 的 script 决定）。
static func _load_dir(dir: String, id_field: StringName, expected: String) -> Dictionary:
	var out := {}
	if not DirAccess.dir_exists_absolute(dir):
		errors.append("目录不存在：%s" % dir)
		return out

	var files := DirAccess.get_files_at(dir)
	files.sort()                     # 排序保证加载顺序稳定
	for f in files:
		if not f.ends_with(".tres"):
			continue
		var path := dir + "/" + f
		var res: Resource = load(path)
		if res == null:
			errors.append("加载失败：%s" % path)
			continue

		var id := StringName("")
		if id_field == &"":
			id = StringName(f.get_basename())
		else:
			var raw = res.get(id_field)
			if raw == null or String(raw).is_empty():
				errors.append("缺少 %s：%s（期望 %s）" % [id_field, path, expected])
				continue
			id = StringName(raw)

		if out.has(id):
			errors.append("重复 id「%s」：%s 与已有条目冲突" % [id, path])
			continue
		out[id] = res
	return out


static func _sorted_values(d: Dictionary) -> Array:
	var keys := d.keys()
	# 按字符串比较，不用 Array.sort()：StringName 的默认排序不保证是字典序，
	# 而"顺序稳定"是测试与 UI 下拉可复现的前提。
	keys.sort_custom(func(a, b): return String(a) < String(b))
	var out: Array = []
	for k in keys:
		out.append(d[k])
	return out
