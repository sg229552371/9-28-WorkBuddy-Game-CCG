class_name EndlessMode
extends RefCounted

## ============================================================================
## 无尽深渊模式核心（对译 HTLM/mods/jes-endless/systems/endless.js，21.17 口径）
## ----------------------------------------------------------------------------
## 对外接口（供集成方调用）：
##   · begin()                       开局：层 1、击杀 0、按层抽词缀、清记录
##   · next_floor() -> Array         层数推进 +1，按新层重抽词缀，生成「层间奖励三选一」
##   · current_affixes() -> Array    本层生效词缀对象数组（cfg 条目）
##   · affix_mods() -> Dictionary    词缀聚合倍率（8 键缺省全 1）
##   · scale_monster(tpl) -> Dictionary  按层强度缩放 + 词缀修正后的怪物模板（战斗层直接用）
##   · record_kill() -> int          击杀计数
##   · settle() -> Dictionary        结算数据（层 / 击杀 / 结晶 / 超时 / 最佳层）
## 数值真源 = cfg/endless.json（项目铁律：逻辑不硬编码数值）。
## 纯逻辑层，不碰场景节点，headless 可测。
## ============================================================================

## 无尽配置表（cfg/endless.json 的 endless 表内容）
var cfg: Dictionary = {}
## 怪物定义表（cfg/monsters.json；供 _kind_of 判定怪种）
var monsters_cfg: Dictionary = {}

## 词缀子系统（endless_affix.gd）
var affix: EndlessAffix

## 随机源（可注入种子，供测试复现）
var rng := RandomNumberGenerator.new()

## 运行时状态（begin 初始化 / reset 清空）
var wave := 0                  # 当前层号（未开始为 0；next_floor 递增）
var kills := 0                 # 本局击杀数
var crystals := 0              # 累计结晶（每层结算累加，按 wave_reward 曲线）
var best_wave := 0             # 层数记录（历史最佳层）
var timed_out := false         # 是否超时（供 settle）
var last_offer: Array = []     # 最近一次「三选一」候选（层间奖励）
var last_chest := false        # 刚结算的层是否掉宝箱（chestEvery 口径）


func _init(endless_cfg: Dictionary = {}, monsters_table: Dictionary = {}) -> void:
	if endless_cfg.is_empty():
		endless_cfg = _load_cfg_table("endless")
	if monsters_table.is_empty():
		monsters_table = _load_cfg_table("monsters")
	cfg = endless_cfg
	monsters_cfg = monsters_table
	affix = EndlessAffix.new(_affix_sub_cfg())
	rng.randomize()


## 从 Cfg autoload 读取配置表；autoload 缺失时直接读 res://cfg/*.json（headless 兜底）
func _load_cfg_table(key: String) -> Dictionary:
	var main_loop := Engine.get_main_loop()
	if main_loop != null and main_loop is SceneTree:
		var root: Node = (main_loop as SceneTree).root
		var cfg_node := root.get_node_or_null("Cfg")
		if cfg_node != null:
			var v: Variant = cfg_node.get("tables")
			if v is Dictionary and (v as Dictionary).has(key):
				var t: Variant = (v as Dictionary)[key]
				if t is Dictionary:
					return t
	var text := FileAccess.get_file_as_string("res://cfg/%s.json" % key)
	if text.is_empty():
		push_warning("[EndlessMode] 配置表缺失: " + key)
		return {}
	var parsed: Variant = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}


## endless.affixes 子表（词缀配置冻结只读）
func _affix_sub_cfg() -> Dictionary:
	var v: Variant = cfg.get("affixes")
	return v if v is Dictionary else {}


## 注入随机种子（测试复现用）
func set_seed(seed_value: int) -> void:
	rng.seed = seed_value
	affix.set_seed(seed_value)


## ============================================================================
## 难度曲线（全部来自 cfg 表，对译 endless.js 的查询函数）
## ============================================================================

## 分段线性插值（对译 Endless._lerpAnchors；委托词缀模块的静态实现）
static func lerp_anchors(anchors: Variant, x: float, fallback: float) -> float:
	return EndlessAffix.lerp_anchors(anchors, x, fallback)


## 每层只数（分段线性插值）：锚点 = cfg.waveCapAnchors（[层, 只数] 递增对）。
## 层 ≤ 首锚点 → 首锚点只数；层 ≥ 末锚点 → 末锚点只数；中间逐段线性取整。
func wave_cap(floor_no: int) -> int:
	var anchors: Variant = cfg.get("waveCapAnchors")
	var n := lerp_anchors(anchors, float(maxi(0, floor_no)), 10.0)
	return int(round(n))


## 同屏上限（海量敌人闸门，与每层配额解耦）
func field_cap() -> int:
	return int(cfg.get("capMax", 3000))


## 血量倍率：1 + (层 - 1) * hpMulPerWave（层 1 = 1.00 基准）
func hp_mul(floor_no: int) -> float:
	return 1.0 + float(maxi(0, floor_no - 1)) * float(cfg.get("hpMulPerWave", 0.0))


## 伤害倍率：配置了常量 atkMul 则为常量（21.17 口径），否则回退旧线性公式
func dmg_mul(floor_no: int) -> float:
	if cfg.has("atkMul") and (cfg["atkMul"] is float or cfg["atkMul"] is int):
		return float(cfg["atkMul"])
	return 1.0 + float(maxi(0, floor_no - 1)) * float(cfg.get("dmgMulPerWave", 0.0))


## 每层结晶：round(reward.base * 层 ^ reward.exp)
func wave_reward(floor_no: int) -> int:
	var rw: Variant = cfg.get("reward")
	var base := 8.0
	var exp_v := 1.0
	if rw is Dictionary:
		base = float((rw as Dictionary).get("base", 8.0))
		exp_v = float((rw as Dictionary).get("exp", 1.0))
	var w := float(maxi(1, floor_no))
	return int(round(base * pow(w, exp_v)))


## 该层是否额外掉宝箱（每 chestEvery 层一枚）
func drops_chest(floor_no: int) -> bool:
	var n := int(cfg.get("chestEvery", 0))
	return n > 0 and floor_no > 0 and floor_no % n == 0


## 该层怪物等级：max(1, round(monsterLevelBase + (层-1) * monsterLevelPerWave))
func monster_lv(floor_no: int) -> int:
	var base := float(cfg.get("monsterLevelBase", 1.0))
	var per := float(cfg.get("monsterLevelPerWave", 0.0))
	return maxi(1, int(round(base + float(maxi(0, floor_no - 1)) * per)))


## 本层刷怪间隔（秒）：先快后慢线性插值（spawnIntervalStart → spawnIntervalEnd）
func spawn_interval_for(floor_no: int) -> float:
	var start := float(cfg.get("spawnIntervalStart", 4.0))
	var end_v := float(cfg.get("spawnIntervalEnd", 11.0))
	var span := float(int(cfg.get("spawnIntervalWaves", 99)) - 1)
	var t := 0.0 if span <= 0.0 else (float(maxi(0, floor_no)) - 1.0) / span
	t = clampf(t, 0.0, 1.0)
	return start + t * (end_v - start)


## 本层三类怪只数（{normal, elite, boss}，和恒 = wave_cap）：
##   层 1~79 → 精英占比沿 eliteRatioAnchors 上升，其余小怪；
##   层 80~89 → 无小怪，BOSS 占比沿 bossMixRatioAnchors 上升，其余精英；
##   层 90+ → 全 BOSS（bossOnlyRatio）。断点 79/89 为构成曲线口径（与原型一致）。
func mix_counts(floor_no: int, n: int) -> Dictionary:
	var w := maxi(1, floor_no)
	var cap := maxi(0, n)
	if w <= 79:
		var er := clampf(lerp_anchors(cfg.get("eliteRatioAnchors"), float(w), 0.10), 0.0, 1.0)
		var ne := int(round(float(cap) * er))
		return {"normal": cap - ne, "elite": ne, "boss": 0}
	if w <= 89:
		var br := clampf(lerp_anchors(cfg.get("bossMixRatioAnchors"), float(w), 0.05), 0.0, 1.0)
		var nb := int(round(float(cap) * br))
		return {"normal": 0, "elite": cap - nb, "boss": nb}
	var oratio := clampf(float(cfg.get("bossOnlyRatio", 1.0)), 0.0, 1.0)
	var nbo := int(round(float(cap) * oratio))
	return {"normal": 0, "elite": cap - nbo, "boss": nbo}


## 对外：本层构成摘要（供测试 / HUD / 调试）
func wave_composition(floor_no: int) -> Dictionary:
	var n := wave_cap(floor_no)
	var r := mix_counts(floor_no, n)
	r["cap"] = n
	return r


## ============================================================================
## 生命周期
## ============================================================================

## 开局：层 1、击杀 0、结晶 0、按层抽词缀、清记录
func begin() -> int:
	wave = 1
	kills = 0
	crystals = 0
	best_wave = 1
	timed_out = false
	last_offer = []
	last_chest = false
	affix.roll_affixes(wave)
	return wave


## 层数推进：层号 +1，按新层重抽词缀，生成「层间奖励三选一」候选。
## 结晶按刚打完的那层（旧层号）结算曲线累加；宝箱判定同口径。
## 返回三选一候选数组（元素 = cfg.rewardNodes.types 条目）。
func next_floor() -> Array:
	var cleared := wave          # 刚打完的层
	wave += 1
	best_wave = maxi(best_wave, wave)
	crystals += wave_reward(cleared)
	last_chest = drops_chest(cleared)
	affix.roll_affixes(wave)
	last_offer = roll_reward_offer()
	return last_offer.duplicate(true)


## 击杀计数（由战斗层击杀回调 / 测试调用）
func record_kill() -> int:
	kills += 1
	return kills


## 结算数据（供结算面板）
func settle() -> Dictionary:
	return {
		"wave": wave,
		"kills": kills,
		"crystals": crystals,
		"timedOut": timed_out,
		"bestWave": best_wave,
	}


## 清状态（重开 / 退出）
func reset() -> void:
	wave = 0
	kills = 0
	crystals = 0
	best_wave = 0
	timed_out = false
	last_offer = []
	last_chest = false
	affix.picked_ids = []


## ============================================================================
## 层间奖励三选一（候选从 cfg 表按权重生成，无重复）
## ============================================================================

## 生成「三选一」候选：从 cfg.rewardNodes.types 按 weight 加权无重复抽取。
## 候选数 = min(rewardNodes.count, 池大小)（配置口径 count=4，池 3 种 → 全 3 条）。
func roll_reward_offer() -> Array:
	var rn: Variant = cfg.get("rewardNodes")
	if rn == null or not (rn is Dictionary):
		return []
	var types: Variant = (rn as Dictionary).get("types")
	if types == null or not (types is Array) or (types as Array).is_empty():
		return []
	var pool: Array = (types as Array).duplicate(true)
	var want := int((rn as Dictionary).get("count", 3))
	want = mini(want, pool.size())
	var picked: Array = []
	var guard := pool.size()
	while picked.size() < want and not pool.is_empty() and guard > 0:
		guard -= 1
		var idx := _weighted_pick(pool)
		picked.append(pool[idx])
		pool.remove_at(idx)
	return picked


## 加权抽取池内一个下标（与词缀模块同口径）
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
	return pool.size() - 1


## ============================================================================
## 词缀透传（供集成方读取）与怪物强度缩放
## ============================================================================

## 本层生效词缀对象数组（cfg.list 条目）
func current_affixes() -> Array:
	return affix.active_affixes()


## 词缀聚合倍率（8 键缺省全 1）
func affix_mods() -> Dictionary:
	return affix.affix_mods()


## 测试 / 集成注入：直接指定本层词缀
func set_affixes(ids: Array) -> void:
	affix.set_affixes(ids)


## 怪种判定：boss（type==="boss"）→ 精英（ED 前缀）→ 小怪（对译 Endless._kindOf）
func kind_of(def_id: String) -> String:
	if def_id.is_empty():
		return "normal"
	var d: Variant = monsters_cfg.get(def_id)
	if d is Dictionary and (d as Dictionary).get("type", "") == "boss":
		return "boss"
	if def_id.begins_with("ED"):
		return "elite"
	return "normal"


## 按层缩放 + 词缀修正怪物模板（供战斗层直接用）：
##   ① 层强度曲线：hp / hpMax × hp_mul(层)（取整）；atk × dmg_mul(层)；lv = monster_lv(层)
##   ② 词缀修正（纯 mutate_number，改倍率）：hp/hpMax × monsterHpMul；atk × monsterAtkMul；spd × monsterSpdMul
## 不改传入模板（duplicate 后修改），返回新字典；模板缺字段则跳过对应修正。
func scale_monster(tpl: Dictionary) -> Dictionary:
	var out := tpl.duplicate(true)
	var mods := affix_mods()
	var hp_m := hp_mul(wave) * float(mods.get("monsterHpMul", 1.0))
	var atk_m := dmg_mul(wave) * float(mods.get("monsterAtkMul", 1.0))
	if out.has("hp") and (out["hp"] is float or out["hp"] is int):
		out["hp"] = int(round(float(out["hp"]) * hp_m))
	if out.has("hpMax") and (out["hpMax"] is float or out["hpMax"] is int):
		out["hpMax"] = int(round(float(out["hpMax"]) * hp_m))
	elif out.has("hp"):
		out["hpMax"] = out["hp"]   # 无 hpMax 时以缩放后 hp 为满血口径
	EndlessAffix.mutate_number(out, "atk", atk_m)
	EndlessAffix.mutate_number(out, "spd", float(mods.get("monsterSpdMul", 1.0)))
	out["lv"] = monster_lv(wave)
	return out
