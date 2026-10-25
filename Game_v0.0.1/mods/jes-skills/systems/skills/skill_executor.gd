# SkillExecutor（规格 §11 M2）：把 SkillData + level + stats 结算成行为计划。
# 纯函数、无 Node 依赖，输出"行为计划数组"，行为层（bhv_*）只消费计划。
# 计划字段：behavior_id / elements / channel / tags / params / angle_deg / arc_deg / range
class_name SkillExecutor
extends RefCounted

## 行为脚本注册表：behavior_id -> 脚本路径。
## 新增行为 = 在此注册，禁止在运行时代码中出现具体宝石 id。
const BEHAVIORS := {
	&"bhv_projectile": "res://mods/jes-skills/systems/skills/behavior/bhv_projectile.gd",
	&"bhv_melee_swing": "res://mods/jes-skills/systems/skills/behavior/bhv_melee_swing.gd",
	&"bhv_aoe_burst": "res://mods/jes-skills/systems/skills/behavior/bhv_aoe_burst.gd",
	&"bhv_channel": "res://mods/jes-skills/systems/skills/behavior/bhv_channel.gd",
	&"bhv_summon": "res://mods/jes-skills/systems/skills/behavior/bhv_summon.gd",
	&"bhv_dash": "res://mods/jes-skills/systems/skills/behavior/bhv_dash.gd",
	&"bhv_buff_self": "res://mods/jes-skills/systems/skills/behavior/bhv_buff_self.gd",
}

## D-42 标签承诺契约：behavior_id -> 该行为必须携带的形态标签。
## 内容校验测试用两条规则对账：
##   T0 正向：每个部件必须携带其行为对应的形态标签（辅助过滤依赖它）；
##   T1 反向：技能标签里每个 form 标签承诺的参数键，必须被该技能至少一个部件产出。
const BEHAVIOR_FORM_TAG := {
	&"bhv_projectile": &"projectile",
	&"bhv_melee_swing": &"melee",
	&"bhv_aoe_burst": &"aoe",
	&"bhv_channel": &"channel",
	&"bhv_summon": &"summon",
	&"bhv_dash": &"movement",
	&"bhv_buff_self": &"buff",
}

## 整数型 stat（规格 §3.5）：真源在 StatRegistry.INT_STATS，这里不再另写一份。
## 管线末端统一 floor 一次，中途不取整。


## 通用倍率型 stat：值域管线走 (base+flat)×(1+inc)×more，base=1.0。
## area_size（范围半径倍率）/ duration（持续时间倍率）共用此求值。
## 聚合走 StatsComponent 的脏标记缓存（§13.2 第 9 条）；MORE 是连乘不是求和。
static func mult_stat(stat: StringName, stats: StatsComponent) -> float:
	var flat := stats.aggregate(stat, StatModifier.Op.FLAT_ADD)
	var inc := stats.aggregate(stat, StatModifier.Op.INCREASED)
	var more := stats.multiplier_of(stat)
	return (1.0 + flat) * (1.0 + inc / 100.0) * more


## 出手结算：对每个 part 产出若干条行为计划（投射物多发 = 多条）。
## 返回 Array[Dictionary]；未知 behavior_id 的 part 被跳过。
static func cast(
	skill: SkillData,
	level: int,
	stats: StatsComponent,
	conversions: Array[DamageConversion] = [],
	behavior_overrides: Dictionary = {},
) -> Array[Dictionary]:
	var scale := 1.0
	if skill.level_scaling:
		scale = skill.level_scaling.factor_for(level)
	var plans: Array[Dictionary] = []
	for part in skill.parts:
		if not BEHAVIORS.has(part.behavior_id):
			continue
		# ① 基础值：base × level_scaling
		var base: Dictionary = {}
		for el in part.base_damage:
			base[el] = float(part.base_damage[el]) * scale
		# ②–⑤ 数值管线（复用 M1 纯函数管线，宪法顺序不变）
		var elements := DamagePipeline.compute_elements(
			base, stats, part.damage_effectiveness,
			part.damage_channel, skill.tags, conversions)
		# ⑤.5 装配层 behavior_overrides 合并（六步 4 同语义：add 先合并，mul 后乘）
		var params := part.behavior_params.duplicate()
		for ov_key in behavior_overrides:
			var ov: Dictionary = behavior_overrides[ov_key]
			# projectile_count 的规范化 base 键是 count_base（见 _stat_value），
			# add 语义必须落到同一个键上，否则会被 count_base 覆盖丢失
			var target_key: StringName = ov_key
			if ov_key == &"projectile_count" and params.has(&"count_base"):
				target_key = &"count_base"
			if ov.has(&"add"):
				params[target_key] = float(params.get(target_key, 0.0)) + float(ov[&"add"])
			elif ov.has(&"mul"):
				params[target_key] = float(params.get(target_key, 1.0)) * float(ov[&"mul"])
			elif ov.has(&"set"):
				params[target_key] = ov[&"set"]   # D-36：整值替换（轨迹 motion 等非数值键的覆盖语义）
			else:
				params[target_key] = ov
		# ⑥ 行为参数：整数型 stat 末端统一 floor 一次，中途不取整
		# floor 收口点只有 StatRegistry.finalize 一处，调用方不自己判断类型
		for s in StatRegistry.INT_STATS:
			params[s] = int(StatRegistry.finalize(s, _stat_value(s, params, stats, skill.tags, part.damage_channel)))
		# 每发投射物一条计划；其他行为单条
		var count := 1
		if part.behavior_id == &"bhv_projectile":
			count = int(params.get(&"projectile_count", 1))
		var spread := float(params.get(&"spread_deg", 0.0))
		for i in maxi(count, 0):
			var plan := {
				&"behavior_id": part.behavior_id,
				&"elements": elements,
				&"channel": part.damage_channel,
				&"tags": skill.tags,
				&"params": params,
			}
			# P-25 修：环绕分支必须排在散角分支之前——自带 spread_deg 的技能（霜矛 6°）
			# 装环绕转化 + 多重投射时，散角分支抢先把 N 发挤进 spread 扇缝，
			# 与 D-36 口径「多发环绕按圈均布、散角不参与」相悖。环绕语义下散角整体失效。
			if count > 1 and String(params.get(&"motion", &"linear")) == &"orbit":
				# D-36：环绕弹按圈均布初相（多重投射 = 刀变多且均匀分布），散角不参与
				plan[&"angle_deg"] = 360.0 * float(i) / float(count)
			elif count > 1 and spread > 0.0:
				plan[&"angle_deg"] = -spread / 2.0 + spread * float(i) / float(count - 1)
			else:
				plan[&"angle_deg"] = 0.0
			if params.has(&"arc_deg"):
				plan[&"arc_deg"] = float(params[&"arc_deg"])
			if params.has(&"range"):
				plan[&"range"] = float(params[&"range"])
			# 倍率型 stat：area_size / duration 挂到计划上，行为层按需消费
			plan[&"area_mult"] = mult_stat(&"area_size", stats)
			plan[&"duration_mult"] = mult_stat(&"duration", stats)
			plans.append(plan)
	return plans


## 整数型 stat 求值：base 来自 params，FLAT/INC/MORE 来自 stats（带通道/标签判定）。
static func _stat_value(
	stat: StringName,
	params: Dictionary,
	stats: StatsComponent,
	tags: Array[StringName],
	channel: int,
) -> float:
	var base := 0.0
	if stat == &"projectile_count" and params.has(&"count_base"):
		base = float(params[&"count_base"])
	elif params.has(stat):
		base = float(params[stat])
	var flat := 0.0
	var inc := 0.0
	var more := 1.0
	for m in stats.get_modifiers():
		if m.stat != stat:
			continue
		if (m.channel_mask & channel) == 0:
			continue
		var ok := true
		for t in m.require_tags:
			if not tags.has(t):
				ok = false
				break
		if not ok:
			continue
		for t in m.exclude_tags:
			if tags.has(t):
				ok = false
				break
		if not ok:
			continue
		match m.op:
			StatModifier.Op.FLAT_ADD:
				flat += m.value
			StatModifier.Op.INCREASED:
				inc += m.value
			StatModifier.Op.MORE:
				more *= 1.0 + m.value / 100.0
	return (base + flat) * (1.0 + inc / 100.0) * more
