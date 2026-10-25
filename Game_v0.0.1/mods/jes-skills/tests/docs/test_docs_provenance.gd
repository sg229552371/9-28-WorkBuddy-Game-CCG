# 文档来源门禁（《信息来源与真源清单》R1 / R3、决策 D-16）。
#
# 目的：阻止「文档里写项目外绝对路径」这种断链引用再次出现。
#
# 为什么必须自动化：2026-10-20 的事故不是笔误，而是整份文档引用了项目外的文件
# （换机器 / 换 AI 就不存在）。这类文字读起来完全合理，人工 review 抓不住；
# 只有机器能稳定拦住。
#
# 白名单说明：「信息来源与真源清单」本身要记录 E-01~E-05 的原位置用于审计，
# 因此单独豁免——那是唯一的合法例外，新增豁免必须在这里写明理由。
extends GutTest

const DOCS_DIR := "res://mods/jes-skills/docs"

## 唯一豁免：清单自身必须能写出「哪些外部来源已作废」。
## R20：改为**带目录的相对路径**。R20 把 docs/ 重排为三个顶层文件夹后，
## 若仍只写裸文件名，本豁免会静默失效（_md_files() 返回的是 `_AI开发与文档/xxx.md`），
## 表现为「清单里的 E-0x 来源被自家门禁判成断链」。
const ALLOW_EXTERNAL_PATH: Array[String] = ["_AI开发与文档/03_查规则/信息来源与真源清单.md"]

## 缺任何一个，都说明「单一真源」被拆散了。
## 2026-10-21 R14：追加「主动技能体系」三份定稿口径（总纲 / AI 执行版 / 白名单矩阵），
## 它们是内容层的现行真源（总纲自述「本文件夹内唯一现行口径」），缺了内容就会按旧口径生产。
## 2026-10-21 R16：追加证据链图谱（S6）——它是新 AI 的接手入口，缺了就只剩通读推断。
## 2026-10-21 R20：docs/ 重排为三个顶层文件夹（_AI开发与文档 / _人工文档流程 / _重要资料记录），
## 全部改为带目录的相对路径。R20 删掉 `reference/README.md`（投放规则改为由本清单 §六 承担），
## 故该项移除；「01_写内容」三份与「原始设计案/内容设计手册」的**相对位置发生变化**，
## 但仍是同一批真源——REQUIRED_DOCS 校验的是「缺了就会按旧口径生产」，不是路径习惯。
## 2026-10-21 R22：① `开工提示词.md` 重写并改名为 `00_开工必读.md`（docs 唯一入口）——
##   它是"新 AI 接手后第一份该读的"，改名后仍必须存在，否则新 AI 只能靠通读推断。
## ② `内容设计手册` 由 `_人工文档流程/原始设计案/` 迁入 `_AI开发与文档/`（R22 解决 Q4：
##   S1 手册不该待在"AI 默认不读"区）。**校验语义未变**：仍是"缺了就会按旧口径写内容"。
## ③ 4 份 S6 追溯型文档迁去 AI资料源/架构溯源/（冷区），本表不含——它们是"按需查"不是"缺了就错"。
const REQUIRED_DOCS: Array[String] = [
	"_AI开发与文档/00_开工必读.md",
	"_AI开发与文档/02_改代码/施工规格_Godot技能系统_AI执行版_v1.0.md",
	"_AI开发与文档/01_写内容/内容设计手册_技能与辅助宝石_v1.md",
	"_AI开发与文档/03_查规则/踩坑与决策台账.md",
	"_AI开发与文档/03_查规则/信息来源与真源清单.md",
	"_AI开发与文档/03_查规则/项目记忆图谱与证据链_v1.md",
	"_AI开发与文档/01_写内容/00_总纲_主动技能体系_v1.md",
	"_AI开发与文档/01_写内容/01_AI执行版_主动技能体系_v1.md",
	"_AI开发与文档/01_写内容/02_行为名称全集_白名单矩阵_v1.md",
]

## 项目外路径特征：盘符 + 分隔符，或已知的姊妹项目目录名。
## 注意：`res://` / `user://` / `uid://` 会被 `s:/` 这种形式误伤，判定前先剥掉协议前缀。
## R14 追加：`https://` / `http://` 同样会命中 `s:/`（如 `poe2skills.com`）。
## 网页 URL 是**可追溯来源**（S4 资料集必须能写明抓取站点），不是断链文件路径，故一并剥离。
## 注意顺序：先剥 `https://` 再剥 `http://`，否则 `https://` 会残留 `s://` 再被 `s:/` 命中。
const EXTERNAL_PATH_PATTERN := "[A-Za-z]:[/\\\\]"
const EXTERNAL_DIR_MARKERS: Array[String] = ["S_docs"]
const RES_PROTOCOLS: Array[String] = ["https://", "http://", "res://", "user://", "uid://"]


## 递归遍历 docs/ 下的全部 .md，返回**相对 docs/ 的路径**（如 `设计方案_X/00_总纲.md`）。
##
## R14 修正：2026-10-21 前本函数用 `dir.get_files()` **不递归**，只覆盖 docs 顶层 4 份；
## 而 10-21 拉回的 `设计方案_主动技能原稿/` 有 10 份 md 藏在子目录里，既不受「禁外部路径」
## 也不受「必须登记」约束 —— 门禁全绿，但根本没看它们。盲区比违规更危险，故改为递归。
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
		# 跳过 . / .. 与隐藏目录（如 .godot），避免自指或扫进引擎缓存。
		if sub.begins_with("."):
			continue
		_collect("%s/%s" % [dir_path, sub], "%s%s/" % [prefix, sub], out, depth + 1)


func _md_files() -> Array[String]:
	var out: Array[String] = []
	_collect(DOCS_DIR, "", out, 0)
	out.sort()
	return out


func test_docs_dir_is_readable() -> void:
	assert_not_null(DirAccess.open(DOCS_DIR), "docs 目录必须存在")
	assert_gt(_md_files().size(), 0, "docs 下至少要有一份 markdown 文档")


func test_required_docs_present() -> void:
	for name in REQUIRED_DOCS:
		var path := "%s/%s" % [DOCS_DIR, name]
		assert_true(FileAccess.file_exists(path), "必需的真源文档缺失：%s" % name)


func test_no_external_path_in_docs() -> void:
	var re := RegEx.new()
	assert_eq(re.compile(EXTERNAL_PATH_PATTERN), OK, "正则必须可编译")

	var bad: Array[String] = []
	for f in _md_files():
		if ALLOW_EXTERNAL_PATH.has(f):
			continue
		var text := FileAccess.get_file_as_string("%s/%s" % [DOCS_DIR, f])
		var lines := text.split("\n")
		for i in lines.size():
			var line: String = lines[i]
			var probe := line
			for protocol in RES_PROTOCOLS:
				probe = probe.replace(protocol, "")
			var hit := re.search(probe) != null
			if not hit:
				for marker in EXTERNAL_DIR_MARKERS:
					if line.contains(marker):
						hit = true
						break
			if hit:
				bad.append("%s:%d  %s" % [f, i + 1, line.strip_edges().substr(0, 80)])

	assert_eq(
		bad.size(), 0,
		"文档不得引用项目外路径（R3）。需要外部依据：请人类投放至 docs/_重要资料记录/人工资料源/ 并登记。\n"
		+ "\n".join(bad)
	)


func test_every_doc_is_registered_in_provenance() -> void:
	# 「新增文档但不登记」会让下个 AI 不知道该读谁、谁优先。
	# R14：按**带目录的相对路径**匹配（`docs/设计方案_X/00_.md`），不再只比文件名——
	# 只比文件名时，子目录里同名文件会互相顶替，登记了 A 却让 B 蒙过去。
	# R22：清单本体在 R20 三分区后已归入 `_AI开发与文档/`，此处必须带子目录；
	# 否则读到空串，断言「清单必须可读且非空」先红，表现为「全部文档都未登记」的假象。
	var register_path := "%s/%s" % [DOCS_DIR, ALLOW_EXTERNAL_PATH[0]]
	var register := FileAccess.get_file_as_string(register_path)
	assert_ne(register.length(), 0, "来源清单必须可读且非空")

	var missing: Array[String] = []
	for f in _md_files():
		if ALLOW_EXTERNAL_PATH.has(f):
			continue
		if not register.contains("docs/" + f):
			missing.append(f)

	assert_eq(missing.size(), 0, "下列文档未在来源清单 §四 按 `docs/<相对路径>` 登记：\n" + "\n".join(missing))
