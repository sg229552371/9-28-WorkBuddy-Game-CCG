# DamageCalculator（M4，规格 §10 / §4.2）：伤害计算纯函数工具类。
# 职责：⑥ 暴击判定 + ⑦ 目标侧减免（护甲/抗性），产出 HitEvent 字典。
# 顺序契约（§4.2 七步严格固定）：⑥ 暴击必须发生在 ⑦ 目标侧减免之前。
# 硬规则（§14）：
#   - 全部纯函数，无演出逻辑、无 Node 依赖
#   - RNG 由调用方注入；契约是 `next_float(stream: StringName) -> float`
#     （RngService 提供，按 §9.4 分流域：暴击只消费 damage 流）
#   - 数值常量集中声明（护甲系数、抗性 cap），代码中不出现散落魔数
#   - 暴击率无基础值（完全由词缀提供，0% 永不暴击）；暴击倍率有基础值 1.5
# defender 契约：鸭子类型，只要求持有 stats: StatsComponent 属性
# （不引用测试内部类，避免实现侧对测试的类型依赖）。
class_name DamageCalculator
extends RefCounted

const ARMOR_COEFFICIENT := 10.0   # 护甲公式分母系数（规格 §10）
const RESIST_CAP := 0.75          # 元素/混沌抗性上限（规格 §10）
const CRIT_MULTI_BASE := 1.5      # 基础暴击倍率 150%
const RESIST_SUFFIX := StatRegistry.RESIST_SUFFIX


## HitEvent 字典：
## {
##   &"elements": {&"physical": 最终值, ...},  # ⑦ 之后的目标侧最终伤害
##   &"total": 各元素之和,
##   &"crit": bool,
##   &"crit_multi": 本次暴击倍率,
## }
static func resolve(packet: DamagePacket, attacker_stats: StatsComponent,
		defender, rng: Object) -> Dictionary:
	# ⑥ 暴击：roll < crit_chance → 伤害 × crit_multi（在减免之前）
	var crit_chance: float = _agg(attacker_stats, &"crit_chance", StatModifier.Op.FLAT_ADD) / 100.0
	var crit_multi: float = CRIT_MULTI_BASE \
		* (1.0 + _agg(attacker_stats, &"crit_multi", StatModifier.Op.INCREASED) / 100.0)

	var crit := false
	if crit_chance > 0.0 and rng.next_float(RngService.STREAM_DAMAGE) < crit_chance:
		crit = true

	# ⑥ 先把暴击倍率乘进快照，再交给 ⑦ 目标侧减免
	var scaled := {}
	for el in packet.elements:
		scaled[el] = float(packet.elements[el]) * (crit_multi if crit else 1.0)

	# ⑦ 目标侧减免
	var elements := _apply_defense(scaled, defender)

	var total := 0.0
	for el in elements:
		total += elements[el]

	return {
		&"elements": elements,
		&"total": total,
		&"crit": crit,
		&"crit_multi": crit_multi,
	}


## ⑦ 目标侧减免：物理走护甲公式（对暴击后的物理总量整体结算），
## 元素/混沌走对应抗性（cap 75%）。
static func _apply_defense(scaled: Dictionary, defender) -> Dictionary:
	var out := {}
	var ds: StatsComponent = defender.stats

	var phys_total: float = float(scaled.get(&"physical", 0.0))
	if phys_total > 0.0:
		var armor: float = _agg(ds, &"armor", StatModifier.Op.FLAT_ADD)
		var reduction: float = 0.0
		if armor > 0.0:
			reduction = armor / (armor + ARMOR_COEFFICIENT * phys_total)
		out[&"physical"] = phys_total * (1.0 - reduction)

	for el in scaled:
		if el == &"physical":
			continue
		var resist_stat := StringName(String(el) + RESIST_SUFFIX)
		var resist: float = _agg(ds, resist_stat, StatModifier.Op.FLAT_ADD) / 100.0
		resist = minf(resist, RESIST_CAP)
		out[el] = float(scaled[el]) * (1.0 - resist)
	return out


## 按 op 聚合某条 stat 的词缀值（对齐 DamagePipeline 的取数语义）。
## 聚合与缓存由 StatsComponent 负责（脏标记 + 按需重算，规格 §13.2 第 9 条），
## 这里只做转发 —— 避免第二处"遍历 modifiers 求和"的实现漂移。
static func _agg(stats: StatsComponent, stat: StringName, op: int) -> float:
	return stats.aggregate(stat, op)