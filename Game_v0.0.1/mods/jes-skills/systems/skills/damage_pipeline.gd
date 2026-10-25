# 七步伤害管线（规格 §4.2 / §4.3）——本项目的"宪法"
#
# ① 基础值 ② 加平值(FLAT×effectiveness) ③ 转换 ④ INCREASED 求和后一次乘
# ⑤ MORE 独立连乘 ⑥ 暴击 ⑦ 目标侧减免。
# M1 实现 ①–⑤（⑥⑦ 属 M4 目标侧/暴击阶段）。
#
# 硬规则：
# - FLAT_ADD 乘 damage_effectiveness；INC/MORE 不乘
# - 转换在 ② 之后 ④ 之前；多源相加、超 100% 归一化；转换后吃新类型词缀；禁止链式
# - ④ 与 ⑤ 之间不得插入任何逻辑
# - stat 命名约定：元素伤害 stat 为 &"<element>_damage"，元素键为 &"<element>"
#   后缀常量真源在 StatRegistry（避免两处各写一份字符串）
class_name DamagePipeline
extends RefCounted

const DAMAGE_SUFFIX := StatRegistry.DAMAGE_SUFFIX


## 纯函数：输入基础元素伤害与 stats，输出各元素最终伤害。
## base_elements: {&"physical": 100.0, ...}
## channel: SkillChannel.Channel.*；tags: 技能形态标签
## conversions: Array[DamageConversion]
static func compute_elements(
	base_elements: Dictionary,
	stats: StatsComponent,
	damage_effectiveness: float,
	channel: int,
	tags: Array[StringName],
	conversions: Array[DamageConversion],
) -> Dictionary:
	# 按 modifier 的元素聚合三档算子（只统计生效的）
	var flat := {}   # el -> float（未乘 effectiveness）
	var inc := {}    # el -> float（求和）
	var more := {}   # el -> float（连乘因子，默认 1.0）
	for m in stats.get_modifiers():
		if not _matches(m, channel, tags):
			continue
		var el := _element_of(m.stat)
		match m.op:
			StatModifier.Op.FLAT_ADD:
				flat[el] = flat.get(el, 0.0) + m.value
			StatModifier.Op.INCREASED:
				inc[el] = inc.get(el, 0.0) + m.value
			StatModifier.Op.MORE:
				more[el] = more.get(el, 1.0) * (1.0 + m.value / 100.0)

	# ① + ② 基础值 + 加平值（FLAT 乘 damage_effectiveness）
	var work := {}
	for el in base_elements:
		work[el] = float(base_elements[el]) + flat.get(el, 0.0) * damage_effectiveness

	# ③ 伤害转换：基于 ② 后的快照做单 pass，禁止链式二次转换
	var by_from := {}
	for c in conversions:
		if not by_from.has(c.from_element):
			by_from[c.from_element] = []
		(by_from[c.from_element] as Array).append(c)
	var snapshot := work.duplicate()
	for from_el in by_from:
		if not snapshot.has(from_el):
			continue
		var convs: Array = by_from[from_el]
		var total := 0.0
		for c in convs:
			total += (c as DamageConversion).ratio
		# 多源相加后超 100% 按比例归一化
		var scale := 1.0
		if total > 1.0:
			scale = 1.0 / total
		var moved := 0.0
		for c in convs:
			var cv := c as DamageConversion
			var amount: float = snapshot[from_el] * cv.ratio * scale
			work[cv.to_element] = work.get(cv.to_element, 0.0) + amount
			moved += amount
		work[from_el] = work[from_el] - moved

	# ④ INCREASED 求和后一次乘（不乘 effectiveness）
	# ⑤ MORE 独立连乘（④⑤ 之间无任何逻辑）
	var out := {}
	for el in work:
		var v: float = work[el]
		v = v * (1.0 + inc.get(el, 0.0) / 100.0)
		v = v * more.get(el, 1.0)
		out[el] = v
	return out


## modifier 生效判定（规格 §4.1）
static func _matches(m: StatModifier, channel: int, tags: Array[StringName]) -> bool:
	if (m.channel_mask & channel) == 0:
		return false
	for t in m.require_tags:
		if not tags.has(t):
			return false
	for t in m.exclude_tags:
		if tags.has(t):
			return false
	return true


static func _element_of(stat: StringName) -> StringName:
	var s := String(stat)
	if s.ends_with(DAMAGE_SUFFIX):
		return StringName(s.substr(0, s.length() - DAMAGE_SUFFIX.length()))
	return stat
