# TagContract（D-25 后续）：「标签—参数对齐」契约表。
#
# 为什么需要它：
#   辅助宝石兼容判定只看 require_tags，不看技能行为是否真的消费对应参数。
#   一颗「贴身环绕」技能只要手写 projectile 标签就能装上多重投射，
#   但 bhv_aoe_burst 不读 count_base → 「装得上、没效果」（P-06 同族的静默失效）。
#   本表把标签从「文案」升级为「合同」：
#     produce —— 声明了该 form 标签的技能，parts 参数必须真的产出其中至少一键；
#     allow   —— require 该 form 标签的辅助，behavior_overrides 只许覆盖其中的键。
#   两条都由 tests/skills/test_tag_contract.gd 门禁执行（仅测试期拦截，不影响运行时）。
#
# 基准：00_总纲 §4 v1.2 实测校准表（✅ 键）。键名与 bhv_*.gd 的 params.get 逐一对齐。
# 硬规则：
#   ① 本表只许引用 §4 的 ✅ 键，禁止引用 ◇ 规划键（门禁校验）；
#   ② 新增标签必须先在 TagRegistry 注册，再在这里加契约；
#   ③ damage_type（五元素）与 cast_type（attack/spell）不设参数契约——
#      前者由伤害包元素验证，后者只参与辅助兼容、无参数语义。
class_name TagContract
extends RefCounted

## 对外别名 → 存储键（P-06：SkillExecutor.cast 归一 count_base；数据文件一律写右值）
const ALIAS := {
	&"projectile_count": &"count_base",
}

## form 标签 → 参数契约。
## produce：技能侧「至少产出其一」；allow：辅助侧「overrides 只许覆盖这些键」。
const CONTRACT := {
	&"melee": {
		&"produce": [&"arc_deg", &"range"],
		&"allow": [&"arc_deg", &"range"],
	},
	&"projectile": {
		&"produce": [&"speed", &"count_base", &"lifetime"],
		&"allow": [&"speed", &"count_base", &"lifetime", &"spread_deg",
				&"pierce", &"fork_count", &"chain_count", &"radius",
				&"motion", &"orbit_radius"],
	},
	&"aoe": {
		&"produce": [&"radius", &"hit_count"],
		&"allow": [&"radius", &"hit_count", &"hit_interval", &"delay"],
	},
	&"channel": {
		&"produce": [&"max_channel_time"],
		&"allow": [&"max_channel_time", &"tick_interval"],
	},
	&"movement": {
		&"produce": [&"distance", &"speed"],
		&"allow": [&"distance", &"speed"],
	},
	&"summon": {
		&"produce": [&"max_count", &"lifetime"],
		&"allow": [&"max_count", &"lifetime"],
	},
	&"buff": {
		&"produce": [&"buff_mods"],
		&"allow": [&"buff_mods"],
	},
	# trap：TagRegistry 已注册（D-25 预留），契约参数引用 §4 ◇ 键 delay（已实现）
	# 与 zone_duration（未实现）——故暂不入表；启用时与 zone_duration 实现同批。
}


## 把对外别名归一到存储键；非别名原样返回。
static func canonical(key: StringName) -> StringName:
	return ALIAS.get(key, key)


## tags 里有参数契约的 form 标签集合。
static func contracted_tags(tags: Array) -> Array[StringName]:
	var out: Array[StringName] = []
	for t in tags:
		if CONTRACT.has(t):
			out.append(t)
	return out


## 技能侧校验：contracted 中每个标签，param_keys（已 canonical）须产出其一。
## 返回违规标签数组（空 = 通过）。
static func skill_violations(contracted: Array, param_keys: Array) -> Array[StringName]:
	var keys: Array = []
	for k in param_keys:
		keys.append(canonical(k))
	var bad: Array[StringName] = []
	for tag in contracted:
		var entry: Dictionary = CONTRACT[tag]
		var hit := false
		for p in entry[&"produce"]:
			if keys.has(p):
				hit = true
				break
		if not hit:
			bad.append(tag)
	return bad


## 辅助侧校验：require 的 form 标签并集给出 allow 范围，
## override_keys（已 canonical）越界即违规。无 form 标签的辅助不受限。
## 返回违规键数组（空 = 通过）。
static func support_violations(require_tags: Array, override_keys: Array) -> Array[StringName]:
	var allowed: Array = []
	for t in require_tags:
		if CONTRACT.has(t):
			for p in CONTRACT[t][&"allow"]:
				allowed.append(p)
	if allowed.is_empty():
		return []
	var bad: Array[StringName] = []
	for k in override_keys:
		if not allowed.has(canonical(k)):
			bad.append(k)
	return bad
