# TagRegistry（规格 §3.5 / §10 util）：标签注册表 —— 全项目标签名的唯一真源。
#
# 为什么需要它：
#   辅助石靠「标签三元组」生效（§3.3），标签写错一个字，兼容判定就永远不通过，
#   而玩家看到的只是「这颗辅助装上没效果」。注册表 + 内容校验测试把这类错误挡在 CI。
#
# kind 的用途：
#   damage_type  伤害类型标签，参与元素归属（与 StatRegistry.ELEMENTS 对齐）
#   cast_type    施法类型（attack / spell）
#   form         形态与行为特征（melee / projectile / aoe / channel / movement / summon / buff）
#
# promises（D-42 标签承诺契约）：
#   form 标签承诺一份「参数面」——部件只要声明了该标签，其行为就必须产出这些参数键。
#   装了标签但行为不产出承诺参数 = 数据错误（内容校验测试把这类错误挡在 CI）。
#   该契约的直接教训：P-26「范围扩大装在投射物上静默失效」——area 标签承诺了
#   半径参数，但投射物行为当年不产出它。承诺面必须与行为参数面逐键对账。
#   damage_type / cast_type 承诺的是「参与伤害管线」，不是参数键，故无 promises。
#
# 硬规则：新增标签必须在这里注册，否则 `unknown_in()` 会把内容里的标签报出来。
class_name TagRegistry
extends RefCounted

const KIND_DAMAGE := &"damage_type"
const KIND_CAST := &"cast_type"
const KIND_FORM := &"form"

const DEFS := {
	# ---- 伤害类型（必须与 StatRegistry.ELEMENTS 一一对应）----
	&"physical": {&"kind": &"damage_type"},
	&"fire": {&"kind": &"damage_type"},
	&"cold": {&"kind": &"damage_type"},
	&"lightning": {&"kind": &"damage_type"},
	&"chaos": {&"kind": &"damage_type"},

	# ---- 施法类型 ----
	&"attack": {&"kind": &"cast_type"},
	&"spell": {&"kind": &"cast_type"},

	# ---- 形态与行为特征（承诺参数面 = 该形态家族的全部参数键）----
	# 批次 A 判定形状化（D-43）：aoe/melee/channel/movement/summon 承诺面扩形状键。
	&"melee": {&"kind": &"form", &"promises": [&"shape", &"arc_deg", &"range", &"angle_deg"]},
	&"projectile": {&"kind": &"form", &"promises": [
		&"projectile_count", &"speed", &"radius", &"pierce", &"fork_count",
		&"chain_count", &"motion", &"orbit_radius", &"lifetime", &"spread_deg",
	]},
	&"aoe": {&"kind": &"form", &"promises": [
		&"shape", &"radius", &"inner_radius", &"delay", &"hit_count", &"hit_interval",
		&"arc_deg", &"range", &"length", &"width", &"point_count", &"point_spacing",
	]},
	&"channel": {&"kind": &"form", &"promises": [
		&"shape", &"arc_deg", &"range", &"tick_interval", &"max_channel_time",
	]},
	&"movement": {&"kind": &"form", &"promises": [
		&"distance", &"speed", &"path_width", &"path_zone_duration",
		&"tick_interval", &"hit_count",
		# D-56 合并键批次：冲刺路径多段判定（DASH·LINE·TICK / DASH·CIRC·TICK 解锁）
	]},
	&"summon": {&"kind": &"form", &"promises": [
		&"max_count", &"scene", &"lifetime",
		&"formation", &"per_cast", &"formation_radius", &"formation_spacing",
		&"point_count", &"point_spacing", &"delay",
		# D-56 合并键批次：formation 补 circ/multi 值 + 多点键（SUMN·CIRC·S1 / SUMN·MULTI·S1 / SUMN·MULTI·DLY 解锁）
	]},
	&"buff": {&"kind": &"form", &"promises": [&"duration", &"buff_mods"]},
	# 预留：陷阱/预埋类（D-25 注册，尚无内容使用；启用前先过制作人裁定）
	&"trap": {&"kind": &"form", &"promises": [&"delay"]},
}


static func has_tag(tag: StringName) -> bool:
	return DEFS.has(tag)


static func kind_of(tag: StringName) -> StringName:
	if not DEFS.has(tag):
		push_error("TagRegistry：未注册的标签「%s」" % tag)
		return &""
	return DEFS[tag][&"kind"]


static func all_tags() -> Array:
	return DEFS.keys()


static func tags_of_kind(kind: StringName) -> Array:
	var out: Array = []
	for t in DEFS:
		if DEFS[t][&"kind"] == kind:
			out.append(t)
	return out


## 校验一组标签是否全部已注册；返回未注册的（空数组 = 全通过）
static func unknown_in(tags: Array) -> Array:
	var out: Array = []
	for t in tags:
		var key := StringName(t)
		if not DEFS.has(key) and not out.has(key):
			out.append(key)
	return out


## D-42 标签承诺契约：单个标签承诺的参数键（非 form 标签 = 空）
static func promises_of(tag: StringName) -> Array:
	if not DEFS.has(tag):
		return []
	return DEFS[tag].get(&"promises", [])


## D-42 标签承诺契约：一组标签承诺参数键的并集（去重）
static func promises_union(tags: Array) -> Array:
	var out: Array = []
	for t in tags:
		for p in promises_of(StringName(t)):
			if not out.has(p):
				out.append(p)
	return out
