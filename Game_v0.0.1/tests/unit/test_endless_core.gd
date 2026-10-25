## 无尽深渊核心单元测试（对译真源 HTLM/mods/jes-endless/systems/endless.js 与 endless-affix.js）
## 覆盖：层数推进 / 强度单调递增 / 词缀抽取数量 / 词缀数值修正 / 三选一候选不重复
extends GutTest

const EndlessModeScript = preload("res://mods/jes-endless/scripts/endless_mode.gd")

var mode: RefCounted


func before_each() -> void:
	mode = EndlessModeScript.new()
	mode.set_seed(20261024)


## ---------- ① 层数推进 ----------
func test_floor_progression() -> void:
	assert_eq(mode.wave, 0, "未开局层号为 0")
	mode.begin()
	assert_eq(mode.wave, 1, "begin 后为层 1")
	mode.next_floor()
	assert_eq(mode.wave, 2, "next_floor 后层号 +1")
	mode.next_floor()
	mode.next_floor()
	assert_eq(mode.wave, 4, "连续推进到层 4")
	assert_eq(mode.best_wave, 4, "层数记录同步最佳层")
	var s: Dictionary = mode.settle()
	assert_eq(s["wave"], 4)
	assert_eq(s["bestWave"], 4)


## ---------- ② 每层怪物强度单调递增 ----------
func test_strength_monotonic_increase() -> void:
	mode.begin()
	var prev_hp: float = mode.hp_mul(1)
	var prev_cap: int = mode.wave_cap(1)
	var prev_lv: int = mode.monster_lv(1)
	for f in range(2, 101):
		assert_true(mode.hp_mul(f) > prev_hp, "层 %d 血量倍率应严格递增" % f)
		assert_true(mode.wave_cap(f) >= prev_cap, "层 %d 每层只数应非降" % f)
		assert_true(mode.monster_lv(f) >= prev_lv, "层 %d 怪物等级应非降" % f)
		prev_hp = mode.hp_mul(f)
		prev_cap = mode.wave_cap(f)
		prev_lv = mode.monster_lv(f)
	# 抽查配置锚点口径：层 1 血量倍率 = 1.00，每层只数层 1 = 10（waveCapAnchors 首锚点）
	assert_almost_eq(mode.hp_mul(1), 1.0, 0.0001)
	assert_eq(mode.wave_cap(1), 10)
	assert_eq(mode.wave_cap(100), 300)
	# scale_monster 随层数缩放后 hp 同样单调递增
	var m1: Dictionary = mode.scale_monster({"hp": 20, "atk": 8, "spd": 115})
	mode.next_floor()
	var m2: Dictionary = mode.scale_monster({"hp": 20, "atk": 8, "spd": 115})
	assert_true(int(m2["hp"]) > int(m1["hp"]), "缩放后怪物血量随层数递增")
	assert_true(float(m2["atk"]) >= float(m1["atk"]), "缩放后怪物攻击非降（atkMul 常量口径）")


## ---------- ③ 词缀抽取数量 ----------
func test_affix_count_by_tier() -> void:
	var affix: RefCounted = mode.affix
	# 冻结配置口径（按 lerp+round 实算，与 JS Math.round 半值远离零一致）：
	# 层 1 → 0｜层 2~6 → 1｜层 7~13 → 2｜层 ≥14 → 3
	assert_eq(affix.affix_count_for(1), 0)
	assert_eq(affix.affix_count_for(2), 1)
	assert_eq(affix.affix_count_for(3), 1)
	assert_eq(affix.affix_count_for(7), 2)
	assert_eq(affix.affix_count_for(8), 2)
	assert_eq(affix.affix_count_for(14), 3)
	assert_eq(affix.affix_count_for(15), 3)
	assert_eq(affix.affix_count_for(99), 3)
	# 按层抽取：层 15 抽 3 条且无重复 id
	var picked: Array = affix.roll_affixes(15)
	assert_eq(picked.size(), 3, "层 15 应抽满 3 条")
	var seen := {}
	for id in picked:
		assert_false(seen.has(id), "词缀抽取无重复: %s" % str(id))
		seen[id] = true
	# 层 1 抽 0 条
	assert_eq(affix.roll_affixes(1).size(), 0)


## ---------- ④ 词缀数值修正正确 ----------
func test_affix_mods_and_monster_correction() -> void:
	mode.begin()
	# 注入词缀：tough（hp×1.3）+ greed（atk×1.15, reward×1.4）
	mode.set_affixes(["tough", "greed"])
	var mods: Dictionary = mode.affix_mods()
	assert_almost_eq(float(mods["monsterHpMul"]), 1.3, 0.0001, "tough → monsterHpMul 1.3")
	assert_almost_eq(float(mods["monsterAtkMul"]), 1.15, 0.0001, "greed → monsterAtkMul 1.15")
	assert_almost_eq(float(mods["rewardMul"]), 1.4, 0.0001, "greed → rewardMul 1.4")
	assert_eq(float(mods["timeLimitMul"]), 1.0, "未选 haste → timeLimitMul 缺省 1")
	assert_eq(mode.current_affixes().size(), 2, "生效词缀 2 条")
	# scale_monster：层 1 → hpMul=1.0, dmgMul=1.25（atkMul 常量）
	# hp: 20 * 1.0 * 1.3 = 26；atk: 8 * 1.25 * 1.15 = 11.5；spd: 115 * 1.0 = 115
	var tpl := {"hp": 20, "atk": 8, "spd": 115}
	var out: Dictionary = mode.scale_monster(tpl)
	assert_eq(int(out["hp"]), 26, "词缀 hp 修正：20×1.3=26")
	assert_eq(int(out["hpMax"]), 26, "hpMax 同步修正")
	assert_almost_eq(float(out["atk"]), 11.5, 0.0001, "词缀+层强度 atk 修正：8×1.25×1.15")
	assert_almost_eq(float(out["spd"]), 115.0, 0.0001, "未选迅捷 → spd 不变")
	assert_eq(int(out["lv"]), 1, "层 1 怪物等级 = 1")
	# 原模板不被污染（duplicate 语义）
	assert_eq(int(tpl["hp"]), 20, "传入模板保持原值")
	# 词缀 apply_to_monster 独立口径：仅词缀倍率、不乘层曲线
	var m2: Dictionary = {"hp": 100.0, "atk": 10.0}
	mode.affix.apply_to_monster(m2)
	assert_eq(int(m2["hp"]), 130, "apply_to_monster hp: 100×1.3=130")
	assert_almost_eq(float(m2["atk"]), 11.5, 0.0001, "apply_to_monster atk: 10×1.15")


## ---------- ⑤ 三选一候选不重复 ----------
func test_reward_offer_unique() -> void:
	mode.begin()
	for i in range(20):
		var offer: Array = mode.next_floor()
		assert_eq(offer.size(), 3, "三选一候选应为 3 条（cfg 池 3 种）")
		var seen := {}
		for entry in offer:
			var id: String = entry.get("id", "")
			assert_false(seen.has(id), "候选不重复: %s" % id)
			seen[id] = true
			assert_true(entry.has("weight"), "候选条目来自 cfg.rewardNodes.types（含 weight）")
	# 候选均来自配置池
	var rn: Dictionary = mode.cfg.get("rewardNodes")
	var pool_ids := {}
	for t in rn["types"]:
		pool_ids[t["id"]] = true
	for entry in mode.last_offer:
		assert_true(pool_ids.has(entry["id"]), "候选 id 必须在配置池内")


## ---------- 补充：结晶曲线与宝箱判定（读表口径） ----------
func test_crystal_reward_and_chest() -> void:
	mode.begin()
	var rw: Dictionary = mode.cfg.get("reward")
	# 推进到层 4：依次结算已打完的层 1~3
	for i in range(3):
		mode.next_floor()
	# 层 1~3 结晶 = sum(round(8 * w^1.15)) for w=1..3
	var total := 0
	for w in range(1, 4):
		total += int(round(float(rw["base"]) * pow(float(w), float(rw["exp"]))))
	assert_eq(mode.crystals, total, "结晶按 wave_reward 曲线逐层累加")
	# 宝箱：chestEvery=5 → 打完层 5 后 last_chest=true（再推进 2 层，结算层 4、5）
	for i in range(2):
		mode.next_floor()
	assert_true(mode.last_chest, "打完层 5（chestEvery=5）应掉宝箱")
