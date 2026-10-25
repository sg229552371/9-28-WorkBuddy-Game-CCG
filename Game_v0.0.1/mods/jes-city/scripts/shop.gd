class_name CityShop
extends RefCounted
## 真源商店是工匠世界的按次随机购买，不是主城神秘商人的未开放面板。
## 物品工厂负责复用库存模块的构造器，本类只负责抽取请求、扣款和交付路由。

const Tables = preload("res://mods/jes-city/scripts/city_mode.gd")

var services: Dictionary
var module_defs: Array
var insurance: Dictionary
var curse_items: Dictionary
var item_factory: Callable
var item_grant: Callable
var rng := RandomNumberGenerator.new()


func _init(tables: Dictionary = {}) -> void:
	services = tables.get("artisanServices", Tables.read_config("artisanServices", {})).duplicate(true)
	module_defs = tables.get("moduleDefs", Tables.read_config("moduleDefs", [])).duplicate(true)
	insurance = tables.get("insurance", Tables.read_config("insurance", {})).duplicate(true)
	curse_items = tables.get("curseItems", Tables.read_config("curseItems", {})).duplicate(true)
	rng.randomize()


func set_seed(value: int) -> void:
	rng.seed = value


func set_item_factory(factory: Callable) -> void:
	item_factory = factory


func set_item_grant(grant: Callable) -> void:
	item_grant = grant


func shelves() -> Array:
	var result: Array = []
	for key in ["buyModule", "buyItem"]:
		if services.get(key) is Dictionary:
			var offer: Dictionary = services[key].duplicate(true)
			offer["id"] = key
			offer["stock"] = -1
			result.append(offer)
	return result


func stock(offer_id: String) -> int:
	return -1 if offer_id in ["buyModule", "buyItem"] and services.has(offer_id) else 0


func refresh(_run_state: Dictionary) -> Dictionary:
	Tables.warn_once("shop.refresh", "真源卡牌刷新已退役，商店未配置货架刷新；保持原状且不扣费")
	return {"ok": false, "reason": "not_configured", "msg": "商店未配置刷新规则"}


func _weighted_index(weights: Array) -> int:
	var total := 0.0
	for weight in weights:
		total += maxf(0, float(weight))
	if total <= 0:
		return -1
	var roll := rng.randf() * total
	for index in range(weights.size()):
		roll -= maxf(0, float(weights[index]))
		if roll < 0:
			return index
	return weights.size() - 1


func _request(offer_id: String) -> Dictionary:
	if offer_id == "buyModule":
		if module_defs.is_empty():
			Tables.warn_once("shop.moduleDefs", "模块定义缺失，拒绝生成商店产物")
			return {}
		var weights: Dictionary = services[offer_id].get("qualityWeights", {})
		var quality := _weighted_index([weights.get("normal", 0), weights.get("advanced", 0), weights.get("epic", 0), weights.get("divine", 0)])
		if quality < 0:
			Tables.warn_once("shop.qualityWeights", "品质权重缺失，拒绝生成商店产物")
			return {}
		var definition: Dictionary = module_defs[rng.randi_range(0, module_defs.size() - 1)]
		return {"kind": "module", "defId": definition.id, "itemQ": quality}
	var kind := _weighted_index([insurance.get("chance", 0), curse_items.get("chance", 0)])
	if kind < 0:
		Tables.warn_once("shop.itemWeights", "消耗品权重缺失，拒绝生成商店产物")
		return {}
	return {"kind": "insurance" if kind == 0 else "curse"}


func buy(offer_id: String, run_state: Dictionary, in_artisan: bool = false) -> Dictionary:
	if not in_artisan or run_state.is_empty():
		return {"ok": false, "reason": "not_artisan", "msg": "仅可在工匠世界内购买"}
	if stock(offer_id) == 0:
		return {"ok": false, "reason": "unknown_offer", "msg": "商品不存在"}
	var cost := int(services[offer_id].get("cost", 0))
	if cost <= 0:
		Tables.warn_once("shop.cost." + offer_id, "商品费用未配置，保守拒绝交易")
		return {"ok": false, "reason": "not_configured", "msg": "商品费用未配置"}
	var coins := int(run_state.get("coin", 0))
	if coins < cost:
		return {"ok": false, "reason": "insufficient_coin", "msg": "金币不足（需 %d）" % cost}
	if not item_factory.is_valid():
		Tables.warn_once("shop.factory", "未接入物品构造回调，拒绝扣款，避免产生残缺物品")
		return {"ok": false, "reason": "missing_factory", "msg": "物品工厂未接入"}
	var request := _request(offer_id)
	if request.is_empty():
		return {"ok": false, "reason": "not_configured", "msg": "物品配置缺失"}
	var generated: Variant = item_factory.call(request)
	if not generated is Dictionary or generated.is_empty():
		return {"ok": false, "reason": "generation_failed", "msg": "物品生成失败"}
	var item: Dictionary = generated
	run_state["coin"] = coins - cost
	var placed := false
	if item_grant.is_valid():
		placed = bool(item_grant.call(item))
	if not placed:
		if not run_state.get("pendingItems") is Array:
			run_state["pendingItems"] = []
		run_state.pendingItems.append(item)
	var message := "已购买：%s" % str(item.get("name", request.kind))
	if not placed:
		message += "（背包已满，已放入待分配区）"
	return {"ok": true, "item": item, "placed": placed, "cost": cost, "msg": message}
