# SocketGraph（规格 §5.2）：插槽连通分量 + 装配纯函数（自研层，无参考实现）。
#
# 装配六步（规格 §3.3，顺序不可交换）：
#   1. 兼容判定（allowed_support_tags × require_tags / exclude_tags）
#   2. add_tags 多轮收敛（靠前辅助可"打开"靠后辅助的兼容性）
#   3. 逐个辅助注入 stat_modifiers（source_id = support_id，由注入方填写）
#   4. behavior_overrides：加法先合并，乘法后合并
#   5. cost = Π(cost_multiplier)
#   6. conflicts_with 检查，命中即装配失败、回滚全部注入
#
# 硬门禁：禁止出现任何 if gem_id == / if support_id == 分支（规格 §11）。
# 硬规则：装配结果只含数据、不持 Node；装配是纯函数，可缓存
#（key = (gem_id, level, support_ids 排序后哈希, links) —— 见文件末尾「装配缓存」一节）。
class_name SocketGraph
extends RefCounted

const AssemblyResultScript := preload("res://mods/jes-skills/systems/skills/assembly_result.gd")


static func _find(parent: Array, i: int) -> int:
	while parent[i] != i:
		parent[i] = parent[parent[i]]  # 路径减半
		i = parent[i]
	return i


static func _union(parent: Array, a: int, b: int) -> void:
	var ra := _find(parent, a)
	var rb := _find(parent, b)
	if ra != rb:
		parent[ra] = rb


## 装配纯函数：SkillSlot → AssemblyResult。
static func assemble(slot: SkillSlot) -> AssemblyResult:
	var res: AssemblyResult = AssemblyResultScript.new()

	if slot.active_gem == null:
		res.error_code = AssemblyResult.ErrorCode.ERR_NO_ACTIVE_GEM
		return res

	# ---------- 并查集分组 ----------
	var groups := _build_groups(slot.links, slot.supports.size())
	var any_ok := false
	for group in groups:
		var sub := _assemble_group(slot, group)
		if sub.ok:
			any_ok = true
			_merge_result(res, sub)
		elif sub.error_code == AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT \
				or sub.error_code == AssemblyResult.ErrorCode.ERR_CONFLICT:
			# 兼容/冲突失败必须整体失败（G7：不得静默忽略）
			return sub
		# ERR_NO_ACTIVE_GEM 的空组（全辅助组无主动石）属于合法结构：辅助不生效，跳过
	if not any_ok:
		# 没有任何含主动宝石的组：视为无可装配内容（例如全辅助未连通），返回成功空结果
		pass
	res.ok = true  # 走到这里说明没有任何兼容/冲突失败（失败已在上面提前 return）
	return res


## 构建 groups：孔 0 = 主动宝石；孔 i+1 = supports[i]。links 里的下标即孔位。
## 契约：links 为空 = 全部孔位默认全连通（未显式断连的辅助都参与装配）。
static func _build_groups(links: Array, support_count: int) -> Array:
	var n := support_count + 1
	var parent: Array[int] = []
	parent.resize(n)
	for i in n:
		parent[i] = i
	if links.is_empty():
		# 默认全连通：所有孔并入同一分量
		for i in range(1, n):
			_union(parent, 0, i)
	for k in range(0, links.size() - 1, 2):
		var a := int(links[k])
		var b := int(links[k + 1])
		if a >= 0 and a < n and b >= 0 and b < n:
			_union(parent, a, b)
	var groups: Array = []
	var seen := {}
	for i in n:
		var root := _find(parent, i)
		if seen.has(root):
			continue
		seen[root] = true
		var g: Array[int] = []
		for j in n:
			if _find(parent, j) == root:
				g.append(j)
		groups.append(g)
	return groups


## 装配单个连通分量（六步全部在此，组内标签集独立收敛）
static func _assemble_group(slot: SkillSlot, group: Array) -> AssemblyResult:
	var res: AssemblyResult = AssemblyResultScript.new()
	var gem: SkillData = null
	var group_supports: Array[SupportGemData] = []

	for hole in group:
		if hole == 0:
			gem = slot.active_gem
		else:
			group_supports.append(slot.supports[hole - 1])

	if gem == null:
		res.error_code = AssemblyResult.ErrorCode.ERR_NO_ACTIVE_GEM
		return res

	# ---------- 六步 1+2：兼容判定 + add_tags 多轮收敛 ----------
	var effective: Array[StringName] = []
	effective.assign(gem.tags)
	var pending: Array[SupportGemData] = []
	for g in group_supports:
		pending.append(g)

	# 多轮收敛：每一轮尝试装配全部 pending，至少有一个通过则重复，直到一轮内无新增
	var accepted: Array[SupportGemData] = []
	while not pending.is_empty():
		var progressed := false
		var still_pending: Array[SupportGemData] = []
		for g in pending:
			if _compatible(gem, g, effective):
				progressed = true
				accepted.append(g)
				for t in g.add_tags:
					if not effective.has(t):
						effective.append(t)
			else:
				still_pending.append(g)
		if not progressed:
			# 一整轮无新增 → 剩余全部不兼容，取第一个报告（确定性）
			res.error_code = AssemblyResult.ErrorCode.ERR_INCOMPATIBLE_SUPPORT
			res.error_support_id = still_pending[0].support_id
			return res
		pending = still_pending

	# ---------- 六步 3：注入 stat_modifiers（source_id 由注入方按 support 填写）----------
	for g in accepted:
		for spec in g.stat_modifiers:
			res.modifiers.append(spec.to_modifier())

	# ---------- 六步 4：behavior_overrides（加法先合并，乘法后合并）----------
	var adds := {}    # stat -> float（相加）
	var muls := {}    # stat -> float（连乘因子）
	var other := {}   # 非 add/mul 的覆盖原样合并（后者覆盖前者，同声明顺序）
	for g in accepted:
		for stat_key in g.behavior_overrides:
			var v = g.behavior_overrides[stat_key]
			if v is Dictionary and (v.has(&"add") or v.has(&"mul")):
				if v.has(&"add"):
					adds[stat_key] = float(adds.get(stat_key, 0.0)) + float(v[&"add"])
				if v.has(&"mul"):
					muls[stat_key] = float(muls.get(stat_key, 1.0)) * float(v[&"mul"])
			else:
				other[stat_key] = v
	for stat_key in adds:
		var entry := {}
		entry[&"add"] = adds[stat_key]
		res.behavior_overrides[stat_key] = entry
	for stat_key in muls:
		var entry2: Dictionary = res.behavior_overrides.get(stat_key, {})
		entry2[&"mul"] = muls[stat_key]
		res.behavior_overrides[stat_key] = entry2
	for stat_key in other:
		res.behavior_overrides[stat_key] = other[stat_key]

	# ---------- 六步 5：cost 连乘 ----------
	res.cost_multiplier = 1.0
	for g in accepted:
		res.cost_multiplier *= g.cost_multiplier

	# ---------- 六步 6：conflicts_with 独占检查（失败即回滚）----------
	for a in accepted:
		for b in accepted:
			if a == b:
				continue
			if a.conflicts_with.has(b.support_id):
				res.error_code = AssemblyResult.ErrorCode.ERR_CONFLICT
				res.error_support_id = a.support_id
				# 回滚 = 丢弃本组已组装的全部数据（res 不再被调用方采信）
				res.modifiers.clear()
				res.behavior_overrides.clear()
				return res

	res.effective_tags = effective
	res.ok = true
	return res


## 兼容判定（六步 1）：require 全具备 + require_any 任一 + exclude 不命中 + 主动石 allowed 白名单
static func _compatible(gem: SkillData, g: SupportGemData, effective_tags: Array[StringName]) -> bool:
	for t in g.require_tags:
		if not effective_tags.has(t):
			return false
	# D-42 require_any_tags：任一命中即过（空数组 = 不限制）。
	# 用途：属性型辅助（如范围扩大 → area_size）要求目标技能至少有一个
	# 能消费该属性的形态，杜绝「装上静默无效」。
	if not g.require_any_tags.is_empty():
		var any_ok := false
		for t in g.require_any_tags:
			if effective_tags.has(t):
				any_ok = true
				break
		if not any_ok:
			return false
	for t in g.exclude_tags:
		if effective_tags.has(t):
			return false
	# allowed_support_tags 空数组 = 接受所有辅助
	if not gem.allowed_support_tags.is_empty():
		var allowed := false
		for t in g.require_tags:
			if gem.allowed_support_tags.has(t):
				allowed = true
				break
		if not allowed:
			for t in g.require_any_tags:
				if gem.allowed_support_tags.has(t):
					allowed = true
					break
			if not allowed:
				return false
	return true


## 多组结果合并到主结果
static func _merge_result(main: AssemblyResult, sub: AssemblyResult) -> void:
	for m in sub.modifiers:
		main.modifiers.append(m)
	for stat_key in sub.behavior_overrides:
		main.behavior_overrides[stat_key] = sub.behavior_overrides[stat_key]
	for t in sub.effective_tags:
		if not main.effective_tags.has(t):
			main.effective_tags.append(t)
	main.cost_multiplier *= sub.cost_multiplier
	for f in sub.flags:
		if not main.flags.has(f):
			main.flags.append(f)


# ---------------- 镶嵌前置校验（PoE2 语义，2026-10-19 R1） ----------------
#
# 语义分工（两者不冲突，缺一不可）：
#   assemble()      = 对"已存在的配置"做校验 → G7：fail-fast + 明确错误码（数据错误兜底）
#   socket_check()  = 对"准备加入的辅助"做准入 → 非法组合在镶嵌那一刻就被拒绝
# 结果是：运行时永不出现不兼容组合，玩家看到的是"这颗辅助放不进去"，而不是技能整体失效。

## 镶嵌准入：把 support 加进 slot 后，整组是否仍合法（含孔位上限）。
## 返回的 AssemblyResult 即"假想装配"的结果，error_support_id 指明问题辅助。
static func socket_check(slot: SkillSlot, support: SupportGemData) -> AssemblyResult:
	if slot == null or slot.active_gem == null:
		var err: AssemblyResult = AssemblyResultScript.new()
		err.error_code = AssemblyResult.ErrorCode.ERR_NO_ACTIVE_GEM
		return err
	if slot.supports.size() >= maxi(slot.socket_count, 0):
		var full: AssemblyResult = AssemblyResultScript.new()
		full.error_code = AssemblyResult.ErrorCode.ERR_NO_SOCKET
		return full
	var probe := clone_slot(slot)
	probe.supports.append(support)
	return assemble(probe)


## 布尔快捷方式（UI 置灰用）
static func can_socket(slot: SkillSlot, support: SupportGemData) -> bool:
	return socket_check(slot, support).ok


## 浅拷贝槽位（supports/links 只复制引用，装配是纯函数不会改写入参）
static func clone_slot(slot: SkillSlot) -> SkillSlot:
	var out := SkillSlot.new()
	out.slot_index = slot.slot_index
	out.active_gem = slot.active_gem
	out.active_level = slot.active_level
	out.active_quality = slot.active_quality
	out.socket_count = slot.socket_count
	for s in slot.supports:
		out.supports.append(s)
	for l in slot.links:
		out.links.append(l)
	return out


# ---------------- 装配缓存（规格 §5.2 第 5 条） ----------------
#
# 为什么要缓存：装配六步里有「多轮标签收敛」，输入是槽位数据，输出是纯数据。
# 施法热路径每帧可能问同一套配置好几遍（施法 / 触发 / UI 预览），
# 每次都跑并查集 + 多轮收敛是纯浪费。
#
# 为什么命中时要 clone：
#   调用方拿到结果会 `StatsComponent.add_modifiers(res.modifiers, source_id)`，
#   而 add_modifiers 会**改写 modifier 的 source_id**。若缓存直接返回本体，
#   第二个槽注入后会把第一个槽的 modifier 也染成自己的 source_id，
#   卸下时就会误删（G6「卸下即还原」直接崩）。所以缓存进出都走深拷贝。
#
# key 必须包含 links：links 决定连通分组，同一组辅助换一种连法结果完全不同。
# 失败结果一并缓存：非法配置反复重算同样浪费，且错误码是确定性的。

static var _cache: Dictionary = {}
static var _hits: int = 0
static var _misses: int = 0


## 缓存 key。空 slot / 无主动宝石返回空串（这类不缓存，直接走 assemble）
static func cache_key(slot: SkillSlot) -> String:
	if slot == null or slot.active_gem == null:
		return ""
	var ids := PackedStringArray()
	for s in slot.supports:
		if s != null:
			ids.append(String(s.support_id))
	ids.sort()   # 辅助顺序不影响装配结果（多轮收敛对全序收敛），排序后同 key
	var link_s := PackedStringArray()
	for l in slot.links:
		link_s.append(str(int(l)))
	return "%s|%d|%s|%s" % [slot.active_gem.gem_id, slot.active_level,
			",".join(ids), ",".join(link_s)]


## 带缓存的装配入口（生产路径用这个；assemble 仍保留为无缓存纯函数）
static func assemble_cached(slot: SkillSlot) -> AssemblyResult:
	var key := cache_key(slot)
	if key.is_empty():
		_misses += 1
		return assemble(slot)
	if _cache.has(key):
		_hits += 1
		return _clone_result(_cache[key])
	_misses += 1
	var res := assemble(slot)
	_cache[key] = _clone_result(res)
	return res


## 深拷贝装配结果（缓存隔离 + 调用方自由改写）
static func _clone_result(src: AssemblyResult) -> AssemblyResult:
	var out: AssemblyResult = AssemblyResultScript.new()
	out.ok = src.ok
	out.error_code = src.error_code
	out.error_support_id = src.error_support_id
	out.cost_multiplier = src.cost_multiplier
	for m in src.modifiers:
		var copy := StatModifier.new()
		copy.stat = m.stat
		copy.op = m.op
		copy.value = m.value
		copy.source_id = m.source_id
		copy.channel_mask = m.channel_mask
		for t in m.require_tags:
			copy.require_tags.append(t)
		for t in m.exclude_tags:
			copy.exclude_tags.append(t)
		out.modifiers.append(copy)
	out.behavior_overrides = src.behavior_overrides.duplicate(true)
	for t in src.effective_tags:
		out.effective_tags.append(t)
	for f in src.flags:
		out.flags.append(f)
	return out


## 清空缓存（改内容 .tres / 热重载 / 测试隔离时调用）
static func clear_cache() -> void:
	_cache.clear()
	_hits = 0
	_misses = 0


## 命中统计（HUD / 压测观察用）
static func cache_stats() -> Dictionary:
	return {&"size": _cache.size(), &"hits": _hits, &"misses": _misses}
