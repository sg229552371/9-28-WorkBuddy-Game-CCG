## 《巴别回路》存档持久化，纯逻辑 RefCounted，headless 可测。
## 纯 JSON 序列化；路径由构造注入（默认 user://babel_save.json）。
## meta（香火/图腾/已解锁祭司）与 run（局内快照）两段分离；
## 局结束 clear_run 只清 run 不清 meta；损坏文件返回空并 push_warning。
class_name BabelSave
extends RefCounted

## 存档文件路径
var path: String = "user://babel_save.json"


func _init(p_path: String = "user://babel_save.json") -> void:
	path = p_path


## 写入 meta 段（保留 run 段）
func save_meta(meta: Dictionary) -> bool:
	var doc: Dictionary = _read_doc()
	doc["meta"] = meta
	return _write_doc(doc)


## 读取 meta 段；无文件/损坏返回 {}
func load_meta() -> Dictionary:
	var doc: Dictionary = _read_doc()
	var m: Variant = doc.get("meta")
	if m is Dictionary:
		return m as Dictionary
	return {}


## 写入 run 快照段（保留 meta 段）
func save_run(run: Dictionary) -> bool:
	var doc: Dictionary = _read_doc()
	doc["run"] = run
	return _write_doc(doc)


## 读取 run 快照段；无文件/损坏返回 {}
func load_run() -> Dictionary:
	var doc: Dictionary = _read_doc()
	var r: Variant = doc.get("run")
	if r is Dictionary:
		return r as Dictionary
	return {}


## 清除 run 段（局结束调用），meta 保留
func clear_run() -> bool:
	var doc: Dictionary = _read_doc()
	doc.erase("run")
	return _write_doc(doc)


## ---------- 内部 ----------

func _read_doc() -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var raw: String = FileAccess.get_file_as_string(path)
	if raw.strip_edges() == "":
		return {}
	var parsed: Variant = JSON.parse_string(raw)
	if not (parsed is Dictionary):
		push_warning("[BabelSave] 存档损坏，按空档处理: %s" % [path])
		return {}
	return parsed as Dictionary


func _write_doc(doc: Dictionary) -> bool:
	var f: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		push_warning("[BabelSave] 存档写入失败: %s" % [path])
		return false
	f.store_string(JSON.stringify(doc, "  "))
	f.close()
	return true
