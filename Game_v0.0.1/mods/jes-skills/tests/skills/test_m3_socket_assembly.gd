# M3 测试：SocketGraph + Assembly（规格 §5 / §11 M3，验收 G5–G7 + G7b）
# G5 辅助装配 / G6 卸下逐位还原（== 精确比较）/ G7 兼容排除装配失败
# G7b 镶嵌准入（R1 PoE2 语义）：非法组合在镶嵌那一刻被拒，且不入槽位
# 附加：add_tags 多轮收敛（六步第 2 步）、并查集分组隔离、conflicts_with 独占
# 硬门禁：被测实现中禁止出现任何 if gem_id == 分支
extends GutTest

const SkillSlotScript := preload("res://mods/jes-skills/systems/skills/data/skill_slot.gd")
const SupportGemDataScript := preload("res://mods/jes-skills/systems/skills/data/support_gem_data.gd")
const ModifierSpecScript := preload("res://mods/jes-skills/systems/skills/data/modifier_spec.gd")
const AssemblyResultScript := preload("res://mods/jes-skills/systems/skills/assembly_result.gd")
const SocketGraphScript := preload("res://mods/jes-skills/systems/skills/socket_graph.gd")
const StatModifierScript := preload("res://mods/jes-skills/systems/skills/stat_modifier.gd")
const FROST_SHARD_PATH := "res://mods/jes-skills/content/gems/active/frost_shard.tres"


func _slot(gem, supports: Array) -> SkillSlot:
	var s: SkillSlot = SkillSlotScript.new()
	s.active_gem = gem
	s.active_level = 1
	s.supports.assign(supports)
	return s


func _spec(stat: StringName, op: int, value: float, req: Array = [], exc: Array = []) -> ModifierSpec:
	var sp: ModifierSpec = ModifierSpecScript.new()
	sp.stat = stat
	sp.op = op
	sp.value = value
	sp.require_tags.assign(req)
	sp.exclude_tags.assign(exc)
	return sp


func _support(id: StringName, require: Array, cost := 1.0, overrides := {},
		add_tags: Array = [], exclude: Array = [], mods: Array = [], conflicts: Array = []) -> SupportGemData:
	var g: SupportGemData = SupportGemDataScript.new()
	g.support_id = id
	g.display_name = String(id)
	g.require_tags.assign(require)
	g.exclude_tags.assign(exclude)
	g.add_tags.assign(add_tags)
	g.cost_multiplier = cost
	g.behavior_overrides = overrides
	g.stat_modifiers.assign(mods)
	g.conflicts_with.assign(conflicts)
	return g


func _multishot() -> SupportGemData:
	return _support(&"multishot", [&"projectile"], 1.5, {&"projectile_count": {&"add": 2.0}})


func _chain() -> SupportGemData:
	return _support(&"chain", [&"projectile"], 1.3, {&"chain_count": {&"add": 2.0}})


func _brutality() -> SupportGemData:
	return _support(&"brutality", [&"melee"], 1.2, {}, [], [&"spell"],
		[_spec(&"melee_damage", StatModifierScript.Op.INCREASED, 40.0)])


func _snapshot(sc) -> Array:
	var out := []
	for m in sc.get_modifiers():
		out.append({
			&"stat": m.stat, &"op": m.op, &"value": m.value,
			&"source": m.source_id, &"channel": m.channel_mask,
			&"require": m.require_tags.duplicate(), &"exclude": m.exclude_tags.duplicate(),
		})
	return out


# ---------- G5：冰矛 + 多重投射(+2) + 连锁(+2) ----------
func test_g5_multishot_chain_assemble() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var res: AssemblyResult = SocketGraphScript.assemble(_slot(gem, [_multishot(), _chain()]))
	assert_true(res.ok, "双辅助应装配成功")
	assert_eq(res.error_code, AssemblyResultScript.ErrorCode.OK)
	var ov: Dictionary = res.behavior_overrides
	assert_true(ov.has(&"projectile_count"), "应有 projectile_count 覆盖")
	assert_true(ov.has(&"chain_count"), "应有 chain_count 覆盖")
	assert_eq(float(ov[&"projectile_count"][&"add"]), 2.0, "多重投射 +2")
	assert_eq(float(ov[&"chain_count"][&"add"]), 2.0, "连锁 +2")
	# count_base=1，+2 后 = 3 发
	assert_eq(int(1 + float(ov[&"projectile_count"][&"add"])), 3, "projectile_count = 3")
	assert_almost_eq(res.cost_multiplier, 1.5 * 1.3, 0.0001, "消耗 ×1.5×1.3 = 1.95")
	# 多重投射/连锁无 stat_modifiers
	assert_eq(res.modifiers.size(), 0, "两辅助均无静态词缀")


# ---------- G5b：add_tags 多轮收敛（六步第 2 步：靠前辅助打开靠后辅助兼容性）----------
func test_g5b_add_tags_convergence() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)  # tags: projectile, cold, spell（无 fire）
	var opener := _support(&"flame_infusion", [&"projectile"], 1.1, {}, [&"fire"])
	var dependent := _support(&"fire_savant", [&"fire"], 1.2, {}, [], [],
		[_spec(&"fire_damage", StatModifierScript.Op.FLAT_ADD, 10.0, [&"fire"])])
	var res: AssemblyResult = SocketGraphScript.assemble(_slot(gem, [opener, dependent]))
	assert_true(res.ok, "add_tags 打开后续辅助兼容性 → 装配成功")
	assert_true(res.effective_tags.has(&"fire"), "有效标签集应含 fire")
	assert_eq(res.modifiers.size(), 1, "依赖方的词缀应被注入")


# ---------- G6：装上再卸下 → 所有 stat 逐位相等（==，非 is_equal_approx）----------
func test_g6_remove_restores_bitwise() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var sc := StatsComponent.new()
	var before := _snapshot(sc)
	# 带一条静态词缀的辅助，覆盖"注入-移除"全路径
	var ms := _support(&"multishot", [&"projectile"], 1.5, {&"projectile_count": {&"add": 2.0}}, [], [],
		[_spec(&"projectile_damage", StatModifierScript.Op.INCREASED, 30.0)])
	var res: AssemblyResult = SocketGraphScript.assemble(_slot(gem, [ms]))
	assert_true(res.ok)
	sc.add_modifiers(res.modifiers, ms.support_id)
	assert_eq(sc.get_modifiers().size(), before.size() + 1, "注入应实际发生（非空转）")
	sc.remove_by_source(ms.support_id)
	var after := _snapshot(sc)
	assert_eq(after.size(), before.size(), "移除后数量还原")
	# G6 硬要求：逐位相等，用 ==（GUT assert_eq 内部即 ==，字典/数组递归精确比较）
	assert_eq(after, before, "卸下后所有 modifier 逐位等于装配前")


# ---------- G7：无情（require=melee, exclude=spell）挂法术技能 → 装配失败 ----------
func test_g7_incompatible_support_fails_assembly() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)  # tags 含 spell
	var res: AssemblyResult = SocketGraphScript.assemble(_slot(gem, [_brutality()]))
	assert_false(res.ok, "不兼容辅助必须装配失败，不得静默忽略")
	assert_eq(res.error_code, AssemblyResultScript.ErrorCode.ERR_INCOMPATIBLE_SUPPORT, "返回明确错误码")
	assert_eq(res.error_support_id, &"brutality", "错误应指明问题辅助")
	assert_eq(res.modifiers.size(), 0, "失败装配不得泄漏任何注入")
	assert_almost_eq(res.cost_multiplier, 1.0, 0.0001, "失败装配消耗不得被改写")


# ---------- 并查集分组：未与主动宝石连通的辅助不参与装配 ----------
func test_unlinked_support_ignored() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var slot := _slot(gem, [_multishot(), _chain()])
	slot.links = [0, 1]  # 孔0(主动)↔孔1(多重投射)；孔2(连锁)独立 → 忽略
	var res: AssemblyResult = SocketGraphScript.assemble(slot)
	assert_true(res.ok)
	var ov: Dictionary = res.behavior_overrides
	assert_true(ov.has(&"projectile_count"), "同组辅助生效")
	assert_false(ov.has(&"chain_count"), "异组辅助不生效")
	assert_almost_eq(res.cost_multiplier, 1.5, 0.0001, "仅计同组辅助消耗")


# ---------- conflicts_with 独占组：命中即装配失败（六步第 6 步）----------
func test_conflict_fails_assembly() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	# frost_shard 非 melee，先造两个互相冲突且兼容的投射辅助
	var a := _support(&"savage_shot", [&"projectile"], 1.4, {}, [], [],
		[_spec(&"projectile_damage", StatModifierScript.Op.MORE, 30.0)], [&"echo_shot"])
	var b := _support(&"echo_shot", [&"projectile"], 1.5, {}, [], [],
		[_spec(&"projectile_damage", StatModifierScript.Op.MORE, 20.0)], [&"savage_shot"])
	var res: AssemblyResult = SocketGraphScript.assemble(_slot(gem, [a, b]))
	assert_false(res.ok, "独占冲突必须装配失败")
	assert_eq(res.error_code, AssemblyResultScript.ErrorCode.ERR_CONFLICT)


# ==================== G7b：镶嵌准入（§12 G7b / §5.2「准入层」，2026-10-19 R1 语义） ====================
#
# 与 G7 的分工（两者必须并存，缺一不可）：
#   G7   = assemble() 对"已存在配置"做校验 → fail-fast 兜底（数据层被绕过时仍不静默）
#   G7b  = socket_check() 对"准备镶嵌的辅助"做准入 → 非法组合根本进不了槽位
# 关键断言不是"assemble 会失败"，而是"**入参槽位没有被改动**"—— 准入必须无副作用。


## G7b-1：不兼容辅助被拒，返回 ERR_INCOMPATIBLE_SUPPORT，且槽位未被写入
func test_g7b_reject_incompatible_without_mutating_slot() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)   # frost_shard：spell + projectile + cold
	var slot: SkillSlot = _slot(gem, [])
	slot.socket_count = 4
	# 要求 melee 的辅助挂不上法术技能
	var melee_only := _support(&"brutal_slam", [&"melee"], 1.5)
	var before := slot.supports.size()

	var chk: AssemblyResult = SocketGraphScript.socket_check(slot, melee_only)

	assert_false(chk.ok, "G7b：不兼容辅助必须被准入拒绝")
	assert_eq(chk.error_code, AssemblyResultScript.ErrorCode.ERR_INCOMPATIBLE_SUPPORT)
	assert_eq(chk.error_support_id, &"brutal_slam", "必须指明是哪颗辅助被拒")
	assert_eq(slot.supports.size(), before, "G7b：准入失败不得改动槽位（无副作用）")
	assert_false(SocketGraphScript.can_socket(slot, melee_only), "can_socket 应与 socket_check 一致")


## G7b-2：孔位已满 → ERR_NO_SOCKET，且不尝试装配
func test_g7b_reject_when_socket_full() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var ok_support := _support(&"wide_area", [], 1.2)
	var slot: SkillSlot = _slot(gem, [ok_support, ok_support, ok_support, ok_support])
	slot.socket_count = 4
	assert_eq(slot.supports.size(), 4)

	var chk: AssemblyResult = SocketGraphScript.socket_check(slot, ok_support)

	assert_false(chk.ok, "G7b：孔位满时不得镶嵌")
	assert_eq(chk.error_code, AssemblyResultScript.ErrorCode.ERR_NO_SOCKET)
	assert_eq(slot.supports.size(), 4, "G7b：拒绝后孔位数不变")


## G7b-3：互斥组合 → ERR_CONFLICT（即便单颗自身兼容）
func test_g7b_reject_conflict_pair() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var a := _support(&"savage_shot", [&"projectile"], 1.4, {}, [], [], [], [&"echo_shot"])
	var b := _support(&"echo_shot", [&"projectile"], 1.5, {}, [], [], [], [&"savage_shot"])
	var slot: SkillSlot = _slot(gem, [a])
	slot.socket_count = 4

	var chk: AssemblyResult = SocketGraphScript.socket_check(slot, b)

	assert_false(chk.ok, "G7b：互斥辅助不得共存")
	assert_eq(chk.error_code, AssemblyResultScript.ErrorCode.ERR_CONFLICT)
	assert_eq(slot.supports.size(), 1, "G7b：冲突拒绝后槽位不变")


## G7b-4：槽位无主动宝石 → ERR_NO_ACTIVE_GEM（前置条件先于孔位判定）
func test_g7b_reject_without_active_gem() -> void:
	var slot: SkillSlot = _slot(null, [])
	slot.socket_count = 4
	var any_support := _support(&"wide_area", [], 1.2)

	var chk: AssemblyResult = SocketGraphScript.socket_check(slot, any_support)

	assert_false(chk.ok)
	assert_eq(chk.error_code, AssemblyResultScript.ErrorCode.ERR_NO_ACTIVE_GEM)


## G7b-5：合法辅助放行，且"准入结果"必须与"真装上去再 assemble"逐项一致
## 这条是防"两套判定逻辑漂移"的关键：准入层不能自己另写一份兼容规则。
func test_g7b_accept_matches_real_assembly() -> void:
	var gem: SkillData = load(FROST_SHARD_PATH)
	var slot: SkillSlot = _slot(gem, [])
	slot.socket_count = 4
	var multi := _support(&"multi_shot", [&"projectile"], 1.5, {&"projectile_count": {&"add": 2.0}})

	var chk: AssemblyResult = SocketGraphScript.socket_check(slot, multi)
	assert_true(chk.ok, "G7b：兼容辅助应放行")

	# 真装上去再装配，结果必须等价
	slot.supports.append(multi)
	var real: AssemblyResult = SocketGraphScript.assemble(slot)
	assert_true(real.ok)
	assert_eq(real.modifiers.size(), chk.modifiers.size(), "准入预演与真装配的词缀数必须一致")
	assert_almost_eq(real.cost_multiplier, chk.cost_multiplier, 0.0001, "耗魔倍率必须一致")
	for key in chk.behavior_overrides:
		assert_true(real.behavior_overrides.has(key), "行为覆盖键 %s 应一致" % key)
