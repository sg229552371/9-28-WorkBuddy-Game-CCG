# CostCalculator（规格 §8.3）：纯函数消耗计算。
# cost = base_cost × Π(support.cost_multiplier) × skill_cost_multiplier
# 消耗类型 NONE → cost 恒为 0（技能免费）。
## 硬门禁：无 gem_id 分支；无演出逻辑；常量集中声明。
class_name CostCalculator
extends RefCounted

const COST_TYPE_MANA := 0
const COST_TYPE_LIFE := 1
const COST_TYPE_ENERGY_SHIELD := 2
const COST_TYPE_NONE := 3


## 计算一次施法的最终消耗。support_cost_mult 为装配阶段 Π 各辅助的乘积
## （AssemblyResult.cost_multiplier），skill_cost_mult 为技能自身消耗倍率。
static func compute_cost(skill: SkillData, support_cost_mult: float, skill_cost_mult: float) -> float:
	if skill.cost_type == COST_TYPE_NONE:
		return 0.0
	return skill.base_cost * support_cost_mult * skill_cost_mult
