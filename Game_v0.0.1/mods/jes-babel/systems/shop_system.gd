## 《巴别回路》圣物商店，纯逻辑 RefCounted，headless 可测。
## 价格 = 基础价（白10/蓝18/金30）× price_mod；刷新收费 5 残片。
class_name BabelShopSystem
extends RefCounted

## 基础价表（缺省兜底）：稀有度 -> 价格；正式定价读 cfg/srpg_shop.json
const BASE_PRICE: Dictionary = {"white": 10, "blue": 18, "gold": 30}
## 刷新收费（缺省兜底）
const REROLL_COST: int = 5
## 缺省进货件数
const DEF_STOCK_COUNT: int = 3
## 定价表路径
const CFG_PATH: String = "res://cfg/srpg_shop.json"

## 复用圣物系统的加权抽取（含商店金概率提升）
var relic_sys: BabelRelicSystem


func _init(p_relic_sys: BabelRelicSystem) -> void:
	relic_sys = p_relic_sys


## 用默认值构建（测试入口）
static func create_default() -> BabelShopSystem:
	return BabelShopSystem.new(BabelRelicSystem.create_default())


## 读 cfg/srpg_shop.json；缺文件/损坏返回 {}（调用方走兜底值）
static func load_cfg() -> Dictionary:
	if not FileAccess.file_exists(CFG_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(CFG_PATH))
	if parsed is Dictionary:
		return parsed as Dictionary
	push_warning("[BabelShopSystem] 定价表损坏，使用兜底价格: %s" % [CFG_PATH])
	return {}


## 某圣物的现价（基础价读 cfg/srpg_shop.json 的 base_price，缺键回退 BASE_PRICE）
static func price_of(relic: Dictionary, price_mod: float = 1.0) -> int:
	var rarity: String = str(relic.get("rarity", "white"))
	var cfg: Dictionary = load_cfg()
	var bp: Variant = cfg.get("base_price")
	var base: int = int(BASE_PRICE.get(rarity, 10))
	if bp is Dictionary:
		base = int((bp as Dictionary).get(rarity, base))
	return int(ceil(float(base) * price_mod))


## 刷新收费（读表，缺省 REROLL_COST）
static func reroll_cost() -> int:
	return int(load_cfg().get("reroll_cost", REROLL_COST))


## 货架件数（读表，缺省 DEF_STOCK_COUNT）
static func stock_count() -> int:
	return int(load_cfg().get("stock_count", DEF_STOCK_COUNT))


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


## 刷新货架：残片不足刷新费返回空数组；否则扣费重抽
func reroll(rng: RandomNumberGenerator, relic_pool: Array[Dictionary], shards: int, count: int = 3, price_mod: float = 1.0) -> Array[Dictionary]:
	if shards < reroll_cost():
		return []
	return stock(rng, relic_pool, count)
