# 记忆图谱门禁（《项目记忆图谱与证据链 v1》§七 / §八、决策 D-20）。
#
# 目的：让"依据"这件事可被机器检验。三条断言分别防三种腐烂：
#   1. 图谱文件丢了 / 被改名          → 后来者没有入口，只能靠猜
#   2. 台账新增 D-* 却没进图谱        → 决策成了孤儿，没人知道它挂在哪
#   3. 图谱引用了不存在的文件         → **编造依据**，这是证据链最常见的死法
#
# 第 3 条最要紧：引用一个不存在的路径，文字读起来和真依据一模一样，
# 人工 review 抓不住；只有机器能稳定拦住。
extends GutTest

const DOCS_DIR := "res://mods/jes-skills/docs"
## R20：docs/ 重排为三个顶层文件夹后，两份真源都进了 `_AI开发与文档/`。
## 这两个常量硬编码路径，目录一动门禁立即红——这是**设计意图**，不是脆弱：
## 图谱与台账是证据链的两端，位置变更必须让人显式确认，不能靠"文件还在某处"蒙过去。
const GRAPH_PATH := "res://mods/jes-skills/docs/_AI开发与文档/03_查规则/项目记忆图谱与证据链_v1.md"
const LEDGER_PATH := "res://mods/jes-skills/docs/_AI开发与文档/03_查规则/踩坑与决策台账.md"

## 图谱至少要有这么多节点；只增不减，删节点等于删历史。
const MIN_NODES := 9

const DECISION_PATTERN := "D-[0-9][0-9]"
## 路径字符集：字母数字下划线点斜杠连字符 + CJK（本项目文件名是中文）。
## R20 修正：追加**空格**与**间隔号 `·`**（U+00B7）。
## 起因是 E-10 的文件名「流放之路风格 · 高自由度技能系统规格（Godot 4.7.1 落地方案）.md」——
## 旧字符集在「风格」后的空格处截断，正则只吃到 `…/追本述源/流放之路风格`，
## 于是门禁报「引用了不存在的路径」。**这是门禁误报，不是文档写错**：
## 路径本身完全正确，是判据假定"文件名不含空格"，而人类投放的文件恰恰含空格。
const PATH_PATTERN := "res://[A-Za-z0-9_./\\-\\x{4e00}-\\x{9fff}\\x{00b7} ]+"


func _read(path: String) -> String:
	assert_true(FileAccess.file_exists(path), "文件必须存在：%s" % path)
	return FileAccess.get_file_as_string(path)


func _match_all(pattern: String, text: String) -> Array[String]:
	var out: Array[String] = []
	var re := RegEx.new()
	if re.compile(pattern) != OK:
		assert_true(false, "正则必须可编译：%s" % pattern)
		return out
	for m in re.search_all(text):
		out.append(m.get_string())
	return out


func test_graph_exists_and_has_nodes() -> void:
	var text := _read(GRAPH_PATH)
	assert_gt(text.length(), 1000, "图谱内容不能为空壳")
	var nodes: Array[String] = []
	for n in _match_all("N[0-9][0-9]", text):
		if not nodes.has(n):
			nodes.append(n)
	assert_gte(nodes.size(), MIN_NODES, "图谱节点数不得少于 %d（只增不减）" % MIN_NODES)


func test_every_decision_is_mounted_on_graph() -> void:
	# 台账里的每条 D-* 都必须能在图谱里找到挂载点。
	# 找不到 = 这条决策没有历史位置，后来者无法判断它是否还成立。
	var decisions: Array[String] = []
	for d in _match_all(DECISION_PATTERN, _read(LEDGER_PATH)):
		if not decisions.has(d):
			decisions.append(d)

	var graph := _read(GRAPH_PATH)
	var orphans: Array[String] = []
	for d in decisions:
		if not graph.contains(d):
			orphans.append(d)

	assert_eq(
		orphans.size(), 0,
		"下列决策未挂载到《项目记忆图谱与证据链 v1》§三：\n" + ", ".join(orphans)
	)


func test_all_res_references_resolve() -> void:
	# 图谱里每个 res:// 引用都必须真实存在（文件或目录）。
	# 允许尾部标点，先剥掉再判。
	var graph := _read(GRAPH_PATH)
	var paths: Array[String] = _match_all(PATH_PATTERN, graph)
	assert_gt(paths.size(), 5, "图谱至少要引用 6 个真实路径，否则不构成证据链")

	var missing: Array[String] = []
	for raw in paths:
		var p := raw
		while p.length() > 0 and (p.ends_with(".") or p.ends_with("/")):
			p = p.substr(0, p.length() - 1)
		if p.is_empty():
			continue
		if FileAccess.file_exists(p):
			continue
		if DirAccess.dir_exists_absolute(p):
			continue
		# R20 双保险：正则可能截断含特殊字符的文件名（见 PATH_PATTERN 注释），
		# 而「整个反引号片段是一个路径」时不需要猜——直接按反引号取。
		var precise := _path_from_backticks(graph, raw)
		if not precise.is_empty() and (FileAccess.file_exists(precise) or DirAccess.dir_exists_absolute(precise)):
			continue
		if not missing.has(p):
			missing.append(p)

	assert_eq(
		missing.size(), 0,
		"图谱引用了不存在的路径（编造依据）：\n" + "\n".join(missing)
	)


## 从原文里找 `raw` 所在的整段反引号内容，若它比匹配到的前缀更长且以 `raw` 开头，则返回它。
##
## 为什么需要：CJK / 空格 / 间隔号都能进字符集，但**全角括号 `（）` 不行**——
## E-10 的文件名「流放之路风格 · 高自由度技能系统规格（Godot 4.7.1 落地方案）.md」就是这种情况。
## 与其把括号也塞进字符集（会让"括号外的正文"被一起吞掉），不如在**反引号已明确划定边界**时直接用边界。
func _path_from_backticks(text: String, raw: String) -> String:
	var probe := "`%s" % raw
	var at := text.find(probe)
	if at < 0:
		return ""
	var close := text.find("`", at + 1)
	if close < 0:
		return ""
	var candidate := text.substr(at + 1, close - at - 1)
	if candidate.length() > raw.length():
		return candidate
	return ""


func test_evidence_files_are_frozen_and_sourced() -> void:
	# _重要资料记录/人工资料源/证据_*.md 是逐字摘录：必须自带冻结声明 + 可追溯来源（R20 迁入该目录）。
	# 两者缺一，它就退化成"某个 AI 的转述"，不再是证据。
	# R20：证据不再在 docs/ 根，改为递归收集——否则迁移后 found == 0，用例静默变成"永远通过"。
	var candidates: Array[String] = []
	_collect(DOCS_DIR, "", candidates, 0)
	var found := 0
	for rel in candidates:
		var base := rel.get_file()
		if not base.begins_with("证据_") or not base.ends_with(".md"):
			continue
		found += 1
		var text := FileAccess.get_file_as_string("%s/%s" % [DOCS_DIR, rel])
		assert_true(text.contains("逐字摘录"), "证据文件必须标明【逐字摘录｜冻结】：%s" % rel)
		assert_true(text.contains("冻结"), "证据文件必须含冻结声明：%s" % rel)
		assert_true(text.contains("https://"), "证据文件必须写明可追溯来源 URL：%s" % rel)

	assert_gt(found, 0, "至少要有一份 docs/_重要资料记录/人工资料源/证据_*.md 作为源头证据")


## 递归收集 docs/ 下全部 .md（相对 docs/ 的路径）。R20 新增：证据文件已进三层子目录。
const MAX_SCAN_DEPTH := 6


func _collect(dir_path: String, prefix: String, out: Array[String], depth: int) -> void:
	if depth > MAX_SCAN_DEPTH:
		return
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	for f in dir.get_files():
		if f.ends_with(".md"):
			out.append(prefix + f)
	for sub in dir.get_directories():
		if sub.begins_with("."):
			continue
		_collect("%s/%s" % [dir_path, sub], "%s%s/" % [prefix, sub], out, depth + 1)
