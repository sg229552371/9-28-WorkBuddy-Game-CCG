## 《巴别回路》圣物商店，纯逻辑 RefCounted，headless 可测。
## 价格 = 基础价（白10/蓝18/金30）× price_mod；刷新收费 5 残片。
class_name BabelShopSystem
extends RefCounted

## 基础价表：稀有度 -> 价格
const BASE_PRICE: Dictionary = {"white": 10, "blue": 18, "gold": 30}
## 刷新收费
const REROLL_COST: int = 5

## 复用圣物系统的加权抽取（含商店金概率提升）
var relic_sys: BabelRelicSystem


func _init(p_relic_sys: BabelRelicSystem) -> void:
	relic_sys = p_relic_sys


## 用默认值构建（测试入口）
static func create_default() -> BabelShopSystem:
	return BabelShopSystem.new(BabelRelicSystem.create_default())


## 某圣物的现价
static func price_of(relic: Dictionary, price_mod: float = 1.0) -> int:
	var rarity: String = str(relic.get("rarity", "white"))
	return int(ceil(float(int(BASE_PRICE.get(rarity, 10))) * price_mod))


## 进货 count 件（金概率提升走 relic_sys.roll_rarity(shop=true)）
func stock(rng: RandomNumberGenerator, relic_pool: Array[Dictionary], count: int = 3) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for i: int in range(count):
		var r: Dictionary = relic_sys.roll_relic(rng, relic_pool, true)
		if not r.is_empty():
			out.append(r)
	return out


## 购买：够钱扣残片返回 {"ok":true,"shards_left":...}，否则 {"ok":false}
func buy(relic: Dictionary, shards: int, price_mod: float = 1.0) -> Dictionary:
	var cost: int = price_of(relic, price_mod)
	if shards < cost:
		return {"ok": false, "shards_left": shards, "cost": cost}
	return {"ok": true, "shards_left": shards - cost, "cost": cost}


## 刷新货架：残片不足 REROLL_COST 返回空数组；否则扣费重抽
func reroll(rng: RandomNumberGenerator, relic_pool: Array[Dictionary], shards: int, count: int = 3, price_mod: float = 1.0) -> Array[Dictionary]:
	if shards < REROLL_COST:
		return []
	return stock(rng, relic_pool, count)
