## 装备生成 / 词条逻辑（jes-inventory 模块）—— 对译 HTLM/js/items.js makeGear + 词缀文案 affixText
## 真源口径（makeGear）：
##   属性缩放 mul = 1 + (q.valueMul - 1) * 0.6，基础属性逐条 Math.round(d.stats[k] * mul)；
##   价值 = Math.round(30 * q.valueMul)；占格/重量读 gearDefs 定义。
## 扩展（制作人规格）：品质 5 档 白/绿/蓝/紫/金；随机词缀条数按品质权重档位递增；
##   词缀池默认内置（中文 tag），可用 set_affix_pool 注入 cfg 表覆盖。
## 数据驱动：装备定义读 res://cfg/gearDefs.json；品质表默认内置（含 valueMul / 底色），可注入覆盖。
## 命名铁律：函数与变量一律 ASCII，中文只进注释与字符串；纯逻辑、零节点依赖。
class_name JesGearGen
extends RefCounted

## 品质名（0..4）：白 / 绿 / 蓝 / 紫 / 金
const QUALITY_NAMES: Array[String] = ["白", "绿", "蓝", "紫", "金"]
## 品质底色（格子着色口径，色值对齐 HTLM/js/config.js CFG.itemQualities，绿档为制作人新增）
const QUALITY_COLORS: Array[String] = ["#b8c4d4", "#5fd35f", "#5aa2ff", "#b06cff", "#ffd76a"]
## 价值系数（白 1.0 / 绿 1.4 / 蓝 1.8 / 紫 3.2 / 金 6.0，绿档按蓝金几何中值取 1.4）
const QUALITY_VALUE_MUL: Array[float] = [1.0, 1.4, 1.8, 3.2, 6.0]
## 随机词缀条数按品质递增：白 0 / 绿 1 / 蓝 2 / 紫 3 / 金 4
const QUALITY_AFFIX_COUNT: Array[int] = [0, 1, 2, 3, 4]
## 出金/紫权重表（roll_quality 用，可被 cfg 覆盖）：白 55 / 绿 26 / 蓝 13 / 紫 5 / 金 1
const DEFAULT_QUALITY_WEIGHTS: Array[float] = [55.0, 26.0, 13.0, 5.0, 1.0]

## 默认随机词缀池：{ tag(中文显示), stat(属性键), mode(flat/pct), min, max }
const DEFAULT_AFFIX_POOL: Array[Dictionary] = [
	{ "tag": "攻击", "stat": "atk", "mode": "flat", "min": 2, "max": 6 },
	{ "tag": "生命", "stat": "hpMax", "mode": "flat", "min": 8, "max": 24 },
	{ "tag": "防御", "stat": "def", "mode": "flat", "min": 1, "max": 3 },
	{ "tag": "速度", "stat": "spd", "mode": "flat", "min": 5, "max": 15 },
	{ "tag": "吸血", "stat": "lifesteal", "mode": "pct", "min": 0.02, "max": 0.06 },
	{ "tag": "伤害", "stat": "dmgMul", "mode": "pct", "min": 0.04, "max": 0.12 },
]

var gear_defs: Array = []
var quality_weights: Array = DEFAULT_QUALITY_WEIGHTS.duplicate()
var affix_pool: Array[Dictionary] = DEFAULT_AFFIX_POOL.duplicate()

## 读取 cfg/gearDefs.json（路径可覆盖，测试可注入）。失败给空表 + push_warning。
func load_gear_defs(path: String = "res://cfg/gearDefs.json") -> void:
	gear_defs = []
	if not FileAccess.file_exists(path):
		push_warning("[JesGearGen] 装备定义表不存在: " + path)
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed is Array:
		gear_defs = parsed
	else:
		push_warning("[JesGearGen] 装备定义表格式错误（应为数组）: " + path)

## 注入覆盖口：品质权重（5 元素数组）与词缀池（cfg 表驱动时用）
func set_quality_weights(w: Array) -> void:
	if w.size() == QUALITY_NAMES.size():
		quality_weights = w.duplicate()

func set_affix_pool(pool: Array) -> void:
	if pool.is_empty():
		return
	var out: Array[Dictionary] = []
	for a: Variant in pool:
		if a is Dictionary and (a as Dictionary).has("tag") and (a as Dictionary).has("stat"):
			out.append(a)
	if not out.is_empty():
		affix_pool = out

## 按 defId 找装备定义
func def_of(def_id: String) -> Dictionary:
	for d: Variant in gear_defs:
		if d is Dictionary and (d as Dictionary).get("id", "") == def_id:
			return d
	return {}

## 按品质权重随机抽品质（0..4）；rng 可注入（测试 / 回放用）
func roll_quality(rng: RandomNumberGenerator) -> int:
	var total := 0.0
	for w: Variant in quality_weights:
		total += float(w)
	if total <= 0.0:
		return 0
	var r := rng.randf() * total
	for q in range(quality_weights.size()):
		r -= float(quality_weights[q])
		if r <= 0.0:
			return q
	return quality_weights.size() - 1

## 从词缀池抽 n 条不重复词缀，数值在 [min, max] 内随机；flat 取整，pct 保留 3 位小数
func roll_affixes(count: int, rng: RandomNumberGenerator) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if affix_pool.is_empty() or count <= 0:
		return out
	var idx_pool: Array[int] = []
	for i in range(affix_pool.size()):
		idx_pool.append(i)
	for k in range(mini(count, idx_pool.size())):
		var pick := rng.randi_range(0, idx_pool.size() - 1)
		var ai: int = idx_pool[pick]
		idx_pool.remove_at(pick)
		var src: Dictionary = affix_pool[ai]
		var v: float = rng.randf_range(float(src["min"]), float(src["max"]))
		if String(src.get("mode", "flat")) == "pct":
			v = snappedf(v, 0.001)
		else:
			v = roundf(v)
		out.append({ "tag": src["tag"], "stat": src["stat"], "mode": src.get("mode", "flat"), "value": v })
	return out

## 构造装备（真源 makeGear 对译 + 随机词缀扩展）：
## 返回物品体 Dictionary：{ uid, kind:"gear", id, name, w, h, quality, affixes, weight, value, stats }
## stats = 基础属性按品质缩放（进战斗属性链）；affixes = 随机词缀数组（进 tooltip）。
func make_gear(def: Dictionary, quality: int, rng: RandomNumberGenerator) -> Dictionary:
	var q := clampi(quality, 0, QUALITY_NAMES.size() - 1)
	var mul := 1.0 + (QUALITY_VALUE_MUL[q] - 1.0) * 0.6
	var stats := {}
	var base: Variant = def.get("stats", {})
	if base is Dictionary:
		for k: Variant in (base as Dictionary):
			stats[String(k)] = roundf(float((base as Dictionary)[k]) * mul)
	var shape: Variant = def.get("shape", [1, 1])
	var w := 1
	var h := 1
	if shape is Array and (shape as Array).size() >= 2:
		w = int(shape[0])
		h = int(shape[1])
	return {
		"uid": JesInventory.next_uid(),
		"kind": "gear",
		"id": String(def.get("id", "")),
		"name": String(def.get("name", def.get("id", "装备"))),
		"w": w,
		"h": h,
		"quality": q,
		"affixes": roll_affixes(QUALITY_AFFIX_COUNT[q], rng),
		"weight": int(def.get("weight", 1)),
		"value": roundi(30.0 * QUALITY_VALUE_MUL[q]),
		"stats": stats,
	}

## 带符号数值文案（GDScript 不支持 %+g，手动拼正负号）：+4 / -3.5
static func signed_num(v: float) -> String:
	var r := roundf(v)
	var s := String.num(absf(r), 1).trim_suffix(".0")
	return ("+" if r >= 0.0 else "-") + s

## 词缀中文文案（真源 affixText 对译）：flat → 「tag +v」；pct → 「tag +p%」（正负号自适应）
static func affix_text(affix: Dictionary) -> String:
	var v: float = float(affix.get("value", 0.0))
	if String(affix.get("mode", "flat")) == "flat":
		return "%s %s" % [String(affix.get("tag", "")), signed_num(v)]
	return "%s %s%%" % [String(affix.get("tag", "")), signed_num(roundf(v * 100.0))]

## 物品 tooltip 多行中文（名称 / 品质 / 词缀数组 / 负重价值），供 bag_ui 调用
static func item_tooltip_lines(it: Dictionary) -> Array[String]:
	var lines: Array[String] = []
	var q := clampi(int(it.get("quality", 0)), 0, QUALITY_NAMES.size() - 1)
	lines.append(String(it.get("name", it.get("id", "物品"))))
	lines.append("品质：" + QUALITY_NAMES[q])
	var count := maxi(int(it.get("count", 1)), 1)
	if count > 1:
		lines.append("数量：×%d" % count)
	var affixes: Variant = it.get("affixes", [])
	if affixes is Array:
		for a: Variant in (affixes as Array):
			if a is Dictionary:
				lines.append(affix_text(a))
	var stats: Variant = it.get("stats", {})
	if stats is Dictionary:
		for k: Variant in (stats as Dictionary):
			lines.append("%s %s" % [String(k), signed_num(float((stats as Dictionary)[k]))])
	lines.append("负重：%d　价值：%d" % [int(it.get("weight", 0)), int(it.get("value", 0))])
	return lines
