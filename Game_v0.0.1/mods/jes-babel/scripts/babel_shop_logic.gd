## 《巴别回路》神殿商店纯逻辑（读 srpg_shop：reroll_cost_base/relic_price/skill_upgrade_cost/gold_chance）
## 商店货币口径 = 局内神话残片（推荐默认：香火为 meta 货币不进局内商店）。
class_name BabelShopLogic
extends RefCounted


## 圣物标价（稀有度 -> 残片价），price_mul 来自图腾/事件折扣
static func relic_price(rarity: String, shop_cfg: Dictionary, price_mul: float) -> int:
	var table: Variant = shop_cfg.get("relic_price", {})
	var base: int = 10
	if table is Dictionary:
		var v: Variant = (table as Dictionary).get(rarity, 10)
		if v is float or v is int:
			base = int(v)
	return maxi(int(round(float(base) * price_mul)), 1)


## 第 n 次刷新价格：base * (n+1)（线性递增，推荐默认）
static func reroll_cost(shop_cfg: Dictionary, reroll_count: int, price_mul: float) -> int:
	var base: float = float(shop_cfg.get("reroll_cost_base", 5.0))
	return maxi(int(round(base * float(reroll_count + 1) * price_mul)), 1)


## 技能升级价
static func skill_upgrade_cost(shop_cfg: Dictionary, price_mul: float) -> int:
	var base: float = float(shop_cfg.get("skill_upgrade_cost", 8.0))
	return maxi(int(round(base * price_mul)), 1)


## 商店金圣物概率（覆盖掉落口径的 shop_gold_chance）
static func gold_chance(shop_cfg: Dictionary) -> float:
	return clampf(float(shop_cfg.get("gold_chance", 0.12)), 0.0, 1.0)


## 抽一货架（默认 3 件，金概率按 gold_chance，其余 白70/蓝25 归一）
## 返回元素 {"rarity": String, "price": int, "relic": Dictionary}
static func roll_stock(rng: RandomNumberGenerator, shop_cfg: Dictionary, relic_table: Array, price_mul: float, count: int) -> Array:
	var out: Array = []
	var gold: float = gold_chance(shop_cfg)
	for i: int in range(count):
		var rarity: String = "white"
		var r: float = rng.randf()
		if r < gold:
			rarity = "gold"
		elif r < gold + (1.0 - gold) * 0.25:
			rarity = "blue"
		var relic: Dictionary = BabelRelicLogic.roll_relic(rng, relic_table, rarity)
		out.append({
			"rarity": rarity,
			"price": relic_price(rarity, shop_cfg, price_mul),
			"relic": relic,
		})
	return out
