# 内容契约测试（R-1 整改，2026-10-22）。
#
# 目的：把「新增内容不改任何 .gd」从口号变成机器保证。
#
# ## 为什么存在（R-1 的事故描述）
#
# R-1 之前，内容断言散落在批次测试（test_p1/batch2/batch_c）里，名单硬编码在测试里。
# 后果：71/80 个内容 id 被 13 个测试文件硬编码；三批名单 8+12+37=57，但目录已有 67，
# 剩 10 个（frost_shard / orbit_blades 等早期技能）没有任何契约断言——**门禁全绿但盲区存在**。
#
# ## 本文件的纪律（这就是 R-1 的整改本体）
#
# 1. **零硬编码内容 id**：全部从 `content/gems/{active,supports}` 目录遍历得出。
#    自我检查由 test_z1 保证：本文件源码里出现任何内容 id 字面量就红。
# 2. **只断言结构性事实**：标签已注册、施放显式、必填参数齐全。
#    具体数值走独立快照（test_content_snapshot.gd），本文件不管数值。
# 3. **空目录防护**：目录为空时先红，防止「零循环全绿」（D-23 教训：门禁没跑 ≠ 门禁绿）。
# 4. **旧批次测试保留**：P1/batch2/batchC 验证的是「批次交付完整性」（哪些格已铺），
#    与「内容契约」（所有内容必须合规）是两件事。批次名单过时了，契约层也不会漏。
extends GutTest

const ACTIVE_DIR := "res://mods/jes-skills/content/gems/active"
const SUPPORT_DIR := "res://mods/jes-skills/content/gems/supports"
const SELF_PATH := "res://mods/jes-skills/tests/skills/test_content_contract.gd"

# 行为必填参数表 —— 真源是《内容设计手册》§1.1「必填 behavior_params」列。
# 注意：批次 C 测试的 C4 比这张表更严（要求 delay/hit_count 等也显式），
# 那是批次施工纪律，不是全局契约；本表按手册口径，兜底默认值存在且安全的键不算违规。
# 行为层改动时同步这里（改动回写纪律）。
const BEHAVIOR_COMMON := {
	&"bhv_projectile": [&"speed", &"radius", &"lifetime"],
	&"bhv_melee_swing": [&"range", &"arc_deg"],
	# bhv_aoe_burst 的空间尺寸按 shape 分派（见 test_a6 内注释），不列通用必填
	&"bhv_channel": [&"max_channel_time"],
	&"bhv_summon": [&"max_count", &"lifetime"],
	&"bhv_dash": [&"distance", &"speed"],
	&"bhv_buff_self": [&"buff_mods", &"duration"],
}

var _active: Array = []
var _supports: Array = []


func before_all() -> void:
	GemRegistry.reload()
	_active = _load_dir(ACTIVE_DIR)
	_supports = _load_dir(SUPPORT_DIR)


func _load_dir(dir_path: String) -> Array:
	var out: Array = []
	var d := DirAccess.open(dir_path)
	assert_not_null(d, "内容目录必须存在：%s" % dir_path)
	if d == null:
		return out
	for f in d.get_files():
		if not String(f).ends_with(".tres"):
			continue
		var res := load("%s/%s" % [dir_path, String(f)])
		if res != null:
			out.append(res)
	return out


## 通用执行器：空目录先红；逐项跑断言，失败清单一次性报告（红一个停一个会拖慢修复）。
func _check_all(items: Array, label: String, fn: Callable) -> void:
	if items.is_empty():
		assert_true(false, "%s 目录遍历结果为空——路径错了还是内容全删了？（防「零循环全绿」哨兵）" % label)
		return
	var problems: Array[String] = []
	for item in items:
		var errs: Array = fn.call(item)
		if not errs.is_empty():
			problems.append_array(errs)
	assert_eq(
		problems.size(), 0,
		"【%s】契约违规 %d 处：\n%s" % [label, problems.size(), "\n".join(problems)]
	)


# ================= 主动技能契约 =================

func test_a1_active_not_empty() -> void:
	assert_gt(_active.size(), 0, "active 目录为空")


## 文件名 == gem_id（命名即索引，与背包模块 P2 同款纪律）
func test_a2_filename_matches_gem_id() -> void:
	_check_all(_active, "主动技能", func(s: SkillData) -> Array:
		var base := String(s.resource_path.get_file().get_basename())
		if base != String(s.gem_id):
			return ["%s.tres 的 gem_id 是 %s（文件名与 id 不一致）" % [base, s.gem_id]]
		return []
	)


## 标签全部注册
func test_a3_all_tags_registered() -> void:
	_check_all(_active, "主动技能", func(s: SkillData) -> Array:
		var unknown := TagRegistry.unknown_in(s.tags)
		if not unknown.is_empty():
			return ["%s 存在未注册标签：%s" % [s.gem_id, unknown]]
		return []
	)


## 施放层显式（手册 §4.1：不靠默认值）
func test_a4_cast_layer_explicit() -> void:
	_check_all(_active, "主动技能", func(s: SkillData) -> Array:
		var errs: Array = []
		if s.base_cost <= 0.0:
			errs.append("%s base_cost=%s 必须 >0" % [s.gem_id, s.base_cost])
		if s.base_cast_time <= 0.0:
			errs.append("%s base_cast_time=%s 必须 >0" % [s.gem_id, s.base_cast_time])
		if s.level_scaling == null:
			errs.append("%s 缺 level_scaling（等级曲线必须显式）" % s.gem_id)
		return errs
	)


## parts 非空 + 每段行为有对应形态标签（与 tag_param_contract T0 同口径：
## 形态标签不存在 SkillPart 上，而是由 SkillExecutor.BEHAVIOR_FORM_TAG 从 behavior_id 推导，
## 再要求技能 tags 包含它——否则「辅助按标签过滤」会失准）
func test_a5_parts_have_form_tags() -> void:
	_check_all(_active, "主动技能", func(s: SkillData) -> Array:
		var errs: Array = []
		if s.parts.is_empty():
			errs.append("%s 没有任何 parts（技能必须至少有一段）" % s.gem_id)
			return errs
		for part in s.parts:
			if part.behavior_id == &"":
				errs.append("%s 有一段没写 behavior_id" % s.gem_id)
				continue
			var expected: StringName = SkillExecutor.BEHAVIOR_FORM_TAG.get(part.behavior_id, &"")
			if expected != &"" and not s.tags.has(expected):
				errs.append("%s 的 %s 段缺形态标签「%s」（辅助按标签过滤会失准）"
						% [s.gem_id, part.behavior_id, expected])
		return errs
	)


## 必填参数齐全（按行为 × 形状；「静默失效」的第一道闸）
func test_a6_required_params_present() -> void:
	_check_all(_active, "主动技能", func(s: SkillData) -> Array:
		var errs: Array = []
		for part in s.parts:
			var p: Dictionary = part.behavior_params
			var bid: StringName = part.behavior_id

			if BEHAVIOR_COMMON.has(bid):
				for k in BEHAVIOR_COMMON[bid]:
					if not p.has(k):
						errs.append("%s 的 %s 段缺必填参数 %s（手册 §1.1）" % [s.gem_id, bid, k])

			# 爆发段的空间尺寸按 shape 分派（实测数据口径：line 用 length/width，
			# circ/ring 用 radius，sec 用 arc_deg+range，pt 点爆不需要尺寸）。
			# 至少要有一组，否则段没有空间形态。
			if bid == &"bhv_aoe_burst":
				var shape: StringName = p.get(&"shape", &"")
				var has_dim: bool = p.has(&"radius") \
						or (p.has(&"length") and p.has(&"width")) \
						or (p.has(&"arc_deg") and p.has(&"range"))
				if shape != &"pt" and not has_dim:
					errs.append("%s 爆发段没有任何空间尺寸（需要 radius，或 length+width，或 arc_deg+range；pt 点爆豁免）"
							% s.gem_id)
		return errs
	)


# ================= 辅助宝石契约 =================

func test_b1_supports_not_empty() -> void:
	assert_gt(_supports.size(), 0, "supports 目录为空")


## 文件名 == support_id
func test_b2_filename_matches_support_id() -> void:
	_check_all(_supports, "辅助宝石", func(s: SupportGemData) -> Array:
		var base := String(s.resource_path.get_file().get_basename())
		if base != String(s.support_id):
			return ["%s.tres 的 support_id 是 %s（文件名与 id 不一致）" % [base, s.support_id]]
		return []
	)


## 辅助侧 require_tags 必须注册
func test_b3_support_tags_registered() -> void:
	_check_all(_supports, "辅助宝石", func(s: SupportGemData) -> Array:
		var unknown := TagRegistry.unknown_in(s.require_tags)
		if not unknown.is_empty():
			return ["%s require_tags 有未注册标签：%s" % [s.support_id, unknown]]
		return []
	)


## cost_multiplier 必须 >0（防 0 成本辅助）
func test_b4_cost_multiplier_sane() -> void:
	_check_all(_supports, "辅助宝石", func(s: SupportGemData) -> Array:
		if s.cost_multiplier <= 0.0:
			return ["%s cost_multiplier=%s 必须 >0" % [s.support_id, s.cost_multiplier]]
		return []
	)


# ================= 门禁的门禁 =================

## 本文件源码里不允许出现任何内容 id 字面量（R-1 复发哨兵）。
func test_z1_no_literal_content_ids() -> void:
	var ids: Array[String] = []
	for dir_path in [ACTIVE_DIR, SUPPORT_DIR]:
		var d := DirAccess.open(dir_path)
		if d == null:
			continue
		for f in d.get_files():
			if String(f).ends_with(".tres"):
				ids.append(String(f).get_basename())
	assert_gt(ids.size(), 0, "目录扫描为空")

	var text := FileAccess.get_file_as_string(SELF_PATH)
	assert_ne(text.length(), 0, "读不到自身源码")
	var bad: Array[String] = []
	for id in ids:
		if text.contains("&\"%s\"" % id):
			bad.append(id)
	assert_eq(
		bad.size(), 0,
		"契约测试自身硬编码了内容 id（R-1 复发），涉及：%s" % ", ".join(bad)
	)
