## 《巴别回路》元进度（香火/图腾/开局规则），纯逻辑 RefCounted，headless 可测。
## 香火公式：shards×1 + 每章 ×10；rules.meta 提供键则覆盖，缺省告警一次。
class_name BabelMetaSystem
extends RefCounted

## rules.meta 段（可选键：incense_per_shard / incense_per_chapter）
var meta_rules: Dictionary = {}
## 乘算合并键（同键乘算）
const MUL_KEYS: Array = ["shop_price_mul", "shop_price_mod"]
## 香火缺省公式已告警标记
var _warned_formula: bool = false


func _init(p_meta_rules: Dictionary = {}) -> void:
	meta_rules = p_meta_rules


## 用与策划书一致的默认值构建（测试入口）
static func create_default() -> BabelMetaSystem:
	return BabelMetaSystem.new({})


## 从 cfg/srpg_rules.json 的 meta 段构建
static func create_from_cfg() -> BabelMetaSystem:
	var rules_table: Variant = _read_cfg_table("srpg_rules")
	if rules_table is Dictionary:
		var m: Variant = (rules_table as Dictionary).get("meta")
		if m is Dictionary:
			return BabelMetaSystem.new(m as Dictionary)
	return BabelMetaSystem.new({})


static func _read_cfg_table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


## 香火结算：残片×per_shard + 章节数×per_chapter；公式缺省时 push_warning 一次
func settle(shards: int, chapters_cleared: int) -> int:
	var per_shard: int = 1
	var per_chapter: int = 10
	var has_formula: bool = meta_rules.has("incense_per_shard") or meta_rules.has("incense_per_chapter")
	if has_formula:
		per_shard = int(meta_rules.get("incense_per_shard", per_shard))
		per_chapter = int(meta_rules.get("incense_per_chapter", per_chapter))
	elif not _warned_formula:
		push_warning("[BabelMetaSystem] rules.meta 未提供香火公式，使用默认：shards×1 + 每章×10")
		_warned_formula = true
	return shards * per_shard + chapters_cleared * per_chapter


## 购买图腾：香火足够返回 {"ok":true,"incense_left":...}，否则 {"ok":false}
func buy_totem(totem: Dictionary, incense: int) -> Dictionary:
	var cost: int = int(totem.get("cost", 30))
	if incense < cost:
		return {"ok": false, "incense_left": incense, "cost": cost}
	return {"ok": true, "incense_left": incense - cost, "totem": str(totem.get("id", ""))}


## 归并所有图腾 effect.params 为一张开局规则表：
## atk_add/team_start_shield 等数值累加；shop_price_mul/mod 乘算；其余同键后写覆盖
func start_rules(totems: Array) -> Dictionary:
	var out: Dictionary = {}
	for t: Variant in totems:
		if not (t is Dictionary):
			continue
		var totem: Dictionary = t as Dictionary
		var effect: Variant = totem.get("effect")
		if not (effect is Dictionary):
			continue
		var params: Variant = (effect as Dictionary).get("params")
		if not (params is Dictionary):
			continue
		for key: String in (params as Dictionary).keys():
			var v: Variant = (params as Dictionary).get(key)
			if MUL_KEYS.has(key):
				out[key] = float(out.get(key, 1.0)) * float(v)
			elif v is int or v is float:
				out[key] = out.get(key, 0) + v
			else:
				out[key] = v
	return out
