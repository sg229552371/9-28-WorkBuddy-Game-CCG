## 《巴别回路》圣物效果纯逻辑：stat_add 聚合 / 触发查询 / 组合白话词条
## effect 形如 {"type": String, "params": Dictionary}；未知类型 push_warning 并忽略。
class_name BabelRelicLogic
extends RefCounted

## 聚合结果支持的数值键
const STAT_KEYS: Array[String] = [
	"melee_dmg_add", "ranged_dmg_add", "skill_dmg_add", "team_hp_add",
	"team_dmg_add", "shield_cap_add", "shield_start", "move_add",
	"cd_reduce", "crit_chance_add", "dmg_mul_add", "incense_add",
]


## 聚合一组圣物的 stat_add 数值加成（返回键 -> float）
static func collect_stats(relic_dicts: Array) -> Dictionary:
	var out: Dictionary = {}
	for r: Variant in relic_dicts:
		if not (r is Dictionary):
			continue
		var effect: Variant = (r as Dictionary).get("effect", {})
		if not (effect is Dictionary):
			continue
		var eff: Dictionary = effect as Dictionary
		if str(eff.get("type", "")) != "stat_add":
			continue
		var params: Variant = eff.get("params", {})
		if not (params is Dictionary):
			continue
		for k: String in STAT_KEYS:
			var v: Variant = (params as Dictionary).get(k)
			if v is float or v is int:
				out[k] = out.get(k, 0.0) + float(v)
	return out


## 是否携带指定 id 圣物
static func has(relic_dicts: Array, relic_id: String) -> bool:
	for r: Variant in relic_dicts:
		if r is Dictionary and str((r as Dictionary).get("id", "")) == relic_id:
			return true
	return false


## 收集满足条件的触发型效果列表（effect.type == "trigger"）
## 返回数组元素形如 {"id": String, "event": String, "params": Dictionary}
static func triggers_for(relic_dicts: Array, event_name: String) -> Array:
	var out: Array = []
	for r: Variant in relic_dicts:
		if not (r is Dictionary):
			continue
		var rd: Dictionary = r as Dictionary
		var effect: Variant = rd.get("effect", {})
		if not (effect is Dictionary):
			continue
		var eff: Dictionary = effect as Dictionary
		if str(eff.get("type", "")) != "trigger":
			continue
		var params: Variant = eff.get("params", {})
		if not (params is Dictionary):
			continue
		var pd: Dictionary = params as Dictionary
		if str(pd.get("event", "")) == event_name:
			out.append({"id": str(rd.get("id", "")), "event": event_name, "params": pd})
	return out


## 蓝色及以上圣物数量（负反馈：≥4 枚渎神事件率 +15%）
static func count_blue_plus(relic_dicts: Array) -> int:
	var n: int = 0
	for r: Variant in relic_dicts:
		if not (r is Dictionary):
			continue
		var rarity: String = str((r as Dictionary).get("rarity", "white"))
		if rarity == "blue" or rarity == "gold":
			n += 1
	return n


## 渎神事件出现率加成（≥4 蓝 +15%）
static func blasphemy_event_bonus(relic_dicts: Array, threshold: int, bonus: float) -> float:
	if count_blue_plus(relic_dicts) >= threshold:
		return bonus
	return 0.0


## 组合面板白话词条：队内神权 + 圣物各生成一行
static func combo_lines(team_dicts: Array, relic_dicts: Array) -> Array[String]:
	var lines: Array[String] = []
	for t: Variant in team_dicts:
		if not (t is Dictionary):
			continue
		var td: Dictionary = t as Dictionary
		var passive: Variant = td.get("passive", {})
		if passive is Dictionary:
			var pd: Dictionary = passive as Dictionary
			var desc: String = str(pd.get("desc_cn", ""))
			if desc != "":
				lines.append("神权·%s：%s" % [str(td.get("name_cn", "?")), desc])
	for r: Variant in relic_dicts:
		if not (r is Dictionary):
			continue
		var rd: Dictionary = r as Dictionary
		var desc2: String = str(rd.get("desc_cn", ""))
		if desc2 != "":
			lines.append("圣物·%s：%s" % [str(rd.get("name_cn", "?")), desc2])
	return lines


## 圣物稀有度价格
static func rarity_price(rarity: String, price_cfg: Dictionary) -> int:
	var v: Variant = price_cfg.get(rarity, 10)
	if v is float or v is int:
		return int(v)
	return 10


## 圣物掉落/商店抽取：从 relics 表按稀有度过滤随机取 1 枚
static func roll_relic(rng: RandomNumberGenerator, relic_table: Array, rarity: String) -> Dictionary:
	var pool: Array = []
	for r: Variant in relic_table:
		if r is Dictionary and str((r as Dictionary).get("rarity", "white")) == rarity:
			pool.append(r as Dictionary)
	if pool.is_empty():
		# 该稀有度无货：回退任意一枚（推荐默认）
		for r2: Variant in relic_table:
			if r2 is Dictionary:
				pool.append(r2 as Dictionary)
	if pool.is_empty():
		return {}
	return pool[rng.randi_range(0, pool.size() - 1)]
