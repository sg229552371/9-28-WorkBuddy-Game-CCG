class_name EndlessAffix
extends RefCounted

## ============================================================================
## 深渊词缀系统（对译 HTLM/mods/jes-endless/systems/endless-affix.js，21.19-W2）
## ----------------------------------------------------------------------------
## 契约（消费 cfg/endless.json 的 endless.affixes，配置冻结只读）：
##   · picked_ids                    本局词缀 id 数组（运行时状态）
##   · affix_count_for(tier)         按 countAnchors 分段线性求条数，夹到 [0, maxActive]
##   · roll_affixes(tier)            按 list[].weight 加权「无重复」抽取，写 picked_ids
##   · active_affixes()              本局词缀对象数组（list 条目）
##   · affix_mods()                  聚合倍率（缺省 1），必含全部 8 键
##   · apply_to_monster(tpl)         纯 mutate_number：按倍率修正怪物模板数值
## 设计原则：纯逻辑层，无节点依赖，headless 可测；CFG 缺失时安全降级（0 条词缀 / 全 1 倍率）。
## ============================================================================

## 聚合倍率的全部 8 键（与 JS 版 affixMods 一一对应）
const MOD_KEYS := [
	"monsterSpdMul", "monsterHpMul", "monsterAtkMul", "waveCapMul",
	"rewardMul", "playerHpMul", "timeLimitMul", "expMul",
]

## 词缀配置（endless.affixes 子表；缺失时全程安全降级）
var cfg: Dictionary = {}
## 本局词缀 id 数组（roll_affixes / set_affixes 写入）
var picked_ids: Array = []
## 随机源（可注入种子，供测试复现）
var rng := RandomNumberGenerator.new()


func _init(affix_cfg: Dictionary = {}) -> void:
	cfg = affix_cfg
	rng.randomize()


## 注入随机种子（测试复现用）
func set_seed(seed_value: int) -> void:
	rng.seed = seed_value


## 分段线性插值：anchors = [[x, y], ...] 递增；x ≤ 首锚点 → 首值；x ≥ 末锚点 → 末值。
## 与 JS 版 Endless._lerpAnchors 同口径。缺 anchors 时返回 fallback。
static func lerp_anchors(anchors: Variant, x: float, fallback: float) -> float:
	if anchors == null or not (anchors is Array) or (anchors as Array).is_empty():
		return fallback
	var a: Array = anchors
	var n := a.size()
	if x <= float(a[0][0]):
		return float(a[0][1])
	if x >= float(a[n - 1][0]):
		return float(a[n - 1][1])
	for i in range(n - 1):
		var x0 := float(a[i][0])
		var x1 := float(a[i + 1][0])
		if x >= x0 and x <= x1:
			var t := 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
			return float(a[i][1]) + t * (float(a[i + 1][1]) - float(a[i][1]))
	return float(a[n - 1][1])


## 词缀条数：按 countAnchors 分段线性插值后取整，夹到 [0, maxActive] 与词缀池大小内。
## 口径（冻结配置）：层 1~2 → 0｜层 3~7 → 1｜层 8~14 → 2｜层 ≥15 → 3。
func affix_count_for(tier: int) -> int:
	if cfg.is_empty() or not cfg.has("countAnchors"):
		return 0
	var anchors: Variant = cfg.get("countAnchors")
	if anchors == null or (anchors as Array).is_empty():
		return 0
	var n := int(round(lerp_anchors(anchors, float(maxi(1, tier)), 0.0)))
	var cap := 3
	if cfg.has("maxActive") and cfg.get("maxActive") is float:
		cap = int(cfg.get("maxActive"))
	elif cfg.has("maxActive") and cfg.get("maxActive") is int:
		cap = int(cfg.get("maxActive"))
	var list: Variant = cfg.get("list")
	if list is Array and not (list as Array).is_empty():
		cap = mini(cap, (list as Array).size())
	else:
		return 0
	return clampi(n, 0, cap)


## 抽取本层词缀：按 weight 加权、无重复（抽取后移出候选池）；写 picked_ids 并返回 id 副本。
## 纯逻辑，不依赖任何节点；全零权重时退化为均匀抽取（与 JS 版同口径）。
func roll_affixes(tier: int) -> Array:
	picked_ids = []
	var list: Variant = cfg.get("list") if not cfg.is_empty() else null
	if list is Array and not (list as Array).is_empty():
		var pool: Array = (list as Array).duplicate(true)
		var count := affix_count_for(tier)
		var guard := pool.size()   # 保险：至多抽池大小次，防死循环
		while picked_ids.size() < count and not pool.is_empty() and guard > 0:
			guard -= 1
			var idx := _weighted_pick(pool)
			picked_ids.append(pool[idx].get("id"))
			pool.remove_at(idx)
	return picked_ids.duplicate()


## 加权抽取池内一个下标（weight ≤ 0 视为无权重；全零权重退化为均匀）
func _weighted_pick(pool: Array) -> int:
	var total := 0.0
	for entry in pool:
		var w: Variant = entry.get("weight")
		if w is float or w is int:
			total += maxf(0.0, float(w))
	if total <= 0.0:
		return rng.randi_range(0, pool.size() - 1)
	var r := rng.randf() * total
	var acc := 0.0
	for i in range(pool.size()):
		var w: Variant = pool[i].get("weight")
		if w is float or w is int:
			acc += maxf(0.0, float(w))
		if r < acc:
			return i
	return pool.size() - 1   # 浮点边界兜底


## 测试 / 集成注入：直接指定本局词缀（跳过随机抽取）
func set_affixes(ids: Array) -> void:
	picked_ids = ids.duplicate()


## 本局词缀对象数组（cfg.list 条目；未知 id 跳过，防脏数据）
func active_affixes() -> Array:
	if cfg.is_empty():
		return []
	var by_id := {}
	var list: Variant = cfg.get("list")
	if list is Array:
		for entry in list:
			by_id[entry.get("id")] = entry
	var out: Array = []
	for id in picked_ids:
		if by_id.has(id):
			out.append(by_id[id])
	return out


## 聚合倍率：缺省全 1；active_affixes 的 mods 逐键连乘。
## ⚠️ 必含全部 8 键（供集成方统一消费，即便部分效果尚未接线）。
func affix_mods() -> Dictionary:
	var mods := {}
	for key in MOD_KEYS:
		mods[key] = 1.0
	for affix in active_affixes():
		var m: Variant = affix.get("mods")
		if m == null or not (m is Dictionary):
			continue
		for key in (m as Dictionary):
			var v: Variant = (m as Dictionary)[key]
			if v is float or v is int:
				mods[key] = float(mods.get(key, 1.0)) * float(v)
	return mods


## 时限倍率（催命 haste）：集成方在进入深渊首帧用 timeLimit × 本值折算（只乘一次）
func affix_time_limit_mul() -> float:
	return float(affix_mods().get("timeLimitMul", 1.0))


## 纯 mutate_number：字典中 key 若为数值则乘以 mul（就地修改）
static func mutate_number(d: Dictionary, key: String, mul: float) -> void:
	if d.has(key):
		var v: Variant = d[key]
		if v is float or v is int:
			d[key] = float(v) * mul


## 对怪物模板施加词缀数值修正（纯 mutate_number，改倍率，不改结构）：
##   hp / hpMax × monsterHpMul（取整，血量为整数口径）
##   atk × monsterAtkMul；spd × monsterSpdMul
## 返回修改后的同一字典（与 JS 版 applyElite 的就地语义一致）。
func apply_to_monster(tpl: Dictionary) -> Dictionary:
	var mods := affix_mods()
	mutate_number(tpl, "hp", float(mods.get("monsterHpMul", 1.0)))
	mutate_number(tpl, "hpMax", float(mods.get("monsterHpMul", 1.0)))
	if tpl.has("hp") and (tpl["hp"] is float or tpl["hp"] is int):
		tpl["hp"] = int(round(float(tpl["hp"])))
	if tpl.has("hpMax") and (tpl["hpMax"] is float or tpl["hpMax"] is int):
		tpl["hpMax"] = int(round(float(tpl["hpMax"])))
	mutate_number(tpl, "atk", float(mods.get("monsterAtkMul", 1.0)))
	mutate_number(tpl, "spd", float(mods.get("monsterSpdMul", 1.0)))
	return tpl
