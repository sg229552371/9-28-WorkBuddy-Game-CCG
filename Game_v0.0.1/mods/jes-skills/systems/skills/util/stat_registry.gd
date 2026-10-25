# StatRegistry（规格 §3.5）：属性注册表 —— 全项目 stat 名的唯一真源。
#
# 为什么需要它：
#   stat 是字符串键，写错了不会报错，只会**静默不生效**（词缀加了但没人读）。
#   把「有哪些 stat / 默认值多少 / 怎么聚合 / 是不是整数型」集中到一张表，
#   再让测试遍历内容目录做一致性校验，拼写错误就会在 CI 暴露而不是在玩家手里。
#
# aggregate 语义（聚合算法本身在管线里，本表只声明"用哪种"）：
#   flat                : 只累加（护甲、抗性、暴击率；单位 %）
#   increased           : 累加百分比，作用到某个基础值上（crit_multi 叠加到基础 150%）
#   multiplicative_base : (1+flat) × (1+inc/100) × Π(1+more/100)，base = 1.0（倍率型）
#   flat_then_round     : 同 multiplicative_base，但**管线末端统一 floor 一次**（整数型）
#
# 硬规则（规格 §3.5）：
#   整数型属性中途不得取整，只在管线末端 floor 一次 ——
#   否则「+2」与「×1.5」的先后会改变结果。
class_name StatRegistry
extends RefCounted

const AGG_FLAT := &"flat"
const AGG_INCREASED := &"increased"
const AGG_MULT_BASE := &"multiplicative_base"
const AGG_FLAT_THEN_ROUND := &"flat_then_round"

## 五种伤害元素/类型。元素伤害 stat = `<element>_damage`，抗性 stat = `<element>_resistance`
const ELEMENTS: Array[StringName] = [&"physical", &"fire", &"cold", &"lightning", &"chaos"]
const DAMAGE_SUFFIX := "_damage"
const RESIST_SUFFIX := "_resistance"

## 全量属性定义。
## 说明：元素伤害与抗性在这里显式展开，便于 `unknown_in()` 直接比对；
## 运行时拼 `<el>_damage` 的地方仍走 element_damage_stat()，两边必须一致（有测试守）。
const DEFS := {
	# ---------------- 攻方：元素伤害 ----------------
	&"physical_damage": {&"default": 0.0, &"aggregate": &"flat"},
	&"fire_damage": {&"default": 0.0, &"aggregate": &"flat"},
	&"cold_damage": {&"default": 0.0, &"aggregate": &"flat"},
	&"lightning_damage": {&"default": 0.0, &"aggregate": &"flat"},
	&"chaos_damage": {&"default": 0.0, &"aggregate": &"flat"},

	# ---------------- 攻方：暴击 ----------------
	# 暴击率无基础值（完全由词缀提供，0% 永不暴击）
	&"crit_chance": {&"default": 0.0, &"aggregate": &"flat"},
	# 暴击倍率：DamageCalculator 内部 base = 1.5，本 stat 为 additional increased（%）
	&"crit_multi": {&"default": 0.0, &"aggregate": &"increased"},

	# ---------------- 攻方：倍率型 ----------------
	&"area_size": {&"default": 1.0, &"aggregate": &"multiplicative_base"},
	&"duration": {&"default": 1.0, &"aggregate": &"multiplicative_base"},
	&"cast_speed": {&"default": 1.0, &"aggregate": &"multiplicative_base"},

	# ---------------- 攻方：整数型（末端 floor） ----------------
	&"projectile_count": {&"default": 1.0, &"aggregate": &"flat_then_round"},
	&"chain_count": {&"default": 0.0, &"aggregate": &"flat_then_round"},
	&"fork_count": {&"default": 0.0, &"aggregate": &"flat_then_round"},
	&"pierce": {&"default": 0.0, &"aggregate": &"flat_then_round"},

	# ---------------- 守方：防御 ----------------
	&"armor": {&"default": 0.0, &"aggregate": &"flat"},
	&"physical_resistance": {&"default": 0.0, &"aggregate": &"flat"},
	&"fire_resistance": {&"default": 0.0, &"aggregate": &"flat"},
	&"cold_resistance": {&"default": 0.0, &"aggregate": &"flat"},
	&"lightning_resistance": {&"default": 0.0, &"aggregate": &"flat"},
	&"chaos_resistance": {&"default": 0.0, &"aggregate": &"flat"},

	# ---------------- 召唤物继承子集（§8.2：只继承这三项，不继承全部 stats）----------------
	# 这三个 stat 挂在**施法者**身上，召唤时按 MinionRegistry.INHERIT_STATS 拷给召唤物。
	&"minion_damage": {&"default": 0.0, &"aggregate": &"flat"},
	&"minion_attack_speed": {&"default": 0.0, &"aggregate": &"increased"},
	&"minion_life": {&"default": 0.0, &"aggregate": &"flat"},
}

## 整数型 stat 白名单（由 DEFS 派生，禁止在别处另写一份）
const INT_STATS: Array[StringName] = [&"projectile_count", &"chain_count", &"fork_count", &"pierce"]

## 名字以 _damage 结尾但**不是元素伤害**的 stat。
## minion_damage 是"召唤物伤害总加成"，不归属任何元素；
## 列在这里是为了让「元素名一致性」校验不会把它当成拼错的元素。
const NON_ELEMENT_DAMAGE_STATS: Array[StringName] = [&"minion_damage"]


static func has_stat(stat: StringName) -> bool:
	return DEFS.has(stat)


static func default_of(stat: StringName) -> float:
	if not DEFS.has(stat):
		push_error("StatRegistry：未注册的属性「%s」" % stat)
		return 0.0
	return float(DEFS[stat][&"default"])


static func aggregate_of(stat: StringName) -> StringName:
	if not DEFS.has(stat):
		push_error("StatRegistry：未注册的属性「%s」" % stat)
		return AGG_FLAT
	return DEFS[stat][&"aggregate"]


static func is_int_stat(stat: StringName) -> bool:
	return aggregate_of(stat) == AGG_FLAT_THEN_ROUND


## 整数型 stat 的管线末端收口：**只在这一处 floor**。
## 非整数型原样返回（避免调用方自己判断类型，判断写错就会悄悄截断倍率）。
static func finalize(stat: StringName, value: float) -> float:
	if is_int_stat(stat):
		return floorf(value)
	return value


## 元素伤害 stat 名：&"fire" -> &"fire_damage"
static func element_damage_stat(element: StringName) -> StringName:
	return StringName(String(element) + DAMAGE_SUFFIX)


## 元素抗性 stat 名：&"fire" -> &"fire_resistance"
static func resist_stat(element: StringName) -> StringName:
	return StringName(String(element) + RESIST_SUFFIX)


## 校验一组 stat 名是否全部已注册；返回未注册的（空数组 = 全通过）。
## 测试用它守「内容 .tres 里没有拼错的 stat」——没人读的词缀是静默 bug。
static func unknown_in(stats: Array) -> Array:
	var out: Array = []
	for s in stats:
		var key := StringName(s)
		if not DEFS.has(key) and not out.has(key):
			out.append(key)
	return out


## 元素列表是否与动态拼接的 stat 名一致（防两张表漂移）
static func element_stats() -> Array:
	var out: Array = []
	for el in ELEMENTS:
		out.append(element_damage_stat(el))
		out.append(resist_stat(el))
	return out
