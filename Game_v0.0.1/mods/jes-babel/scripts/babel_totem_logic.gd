## 《巴别回路》图腾（失落之城 meta）纯逻辑：购买校验 + 下局开局规则注入
## effect 形如 {"type": "start_rule", "params": {...}}；未知 type push_warning 忽略。
class_name BabelTotemLogic
extends RefCounted


## 是否可购买：未拥有 且 香火足够
static func can_buy(totem: Dictionary, incense: int, owned: Array) -> bool:
	if owned.has(str(totem.get("id", ""))):
		return false
	return incense >= int(totem.get("cost", 30))


## 汇总已拥有图腾的开局规则：params 键合并（数值相加，其余覆盖）
## 返回 flat 规则字典，如 {"team_start_shield": 3.0, "shop_price_mul": 0.8, "start_relic_count": 1.0, ...}
static func start_rules(owned_ids: Array, totem_table: Array) -> Dictionary:
	var out: Dictionary = {}
	for t: Variant in totem_table:
		if not (t is Dictionary):
			continue
		var td: Dictionary = t as Dictionary
		if not owned_ids.has(str(td.get("id", ""))):
			continue
		var effect: Variant = td.get("effect", {})
		if not (effect is Dictionary):
			continue
		var eff: Dictionary = effect as Dictionary
		if str(eff.get("type", "")) != "start_rule":
			push_warning("[BabelTotem] 未知图腾效果类型: " + str(eff.get("type", "")))
			continue
		var params: Variant = eff.get("params", {})
		if not (params is Dictionary):
			continue
		for k: String in (params as Dictionary).keys():
			var v: Variant = (params as Dictionary).get(k)
			if v is float or v is int:
				out[k] = float(out.get(k, 0.0)) + float(v)
			else:
				out[k] = v
	return out


## 规则读取快捷：图腾规则缺省值
static func rule_val(rules: Dictionary, key: String, def: float) -> float:
	var v: Variant = rules.get(key)
	if v is float or v is int:
		return float(v)
	return def


## 开局赠送圣物规则（start_relic_rarity + start_relic_count）
static func start_relics(rules: Dictionary) -> Array[String]:
	var n: int = int(rule_val(rules, "start_relic_count", 0.0))
	var rarity: String = str(rules.get("start_relic_rarity", "white"))
	var out: Array[String] = []
	for i: int in range(maxi(n, 0)):
		out.append(rarity)
	return out
