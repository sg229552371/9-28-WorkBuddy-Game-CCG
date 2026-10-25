## ============================================================
## 技能水晶系统核心单元测试（配置加载 + 编译器 + 伤害结算）
## 真源：HTLM/mods/jes-skill-crystal/systems/skill-compiler.js / skill-damage.js
## 数据：cfg/skillSystem.json（SK_FIREBALL L1 = cd 1.8 / coefficient 1.5 / speed 480 ...）
## ============================================================
extends GutTest

## preload 引用（--check-only 单文件模式下全局类名缓存不可用，自包含更稳）
const SkillConfigCore := preload("res://mods/jes-skills/scripts/skill_config.gd")
const SkillCompilerCore := preload("res://mods/jes-skills/scripts/skill_compiler.gd")
const SkillDamageCore := preload("res://mods/jes-skills/scripts/skill_damage.gd")

var cfg


func before_each() -> void:
	cfg = SkillConfigCore.new()


## ---------- 配置加载层 ----------

func test_config_loads_real_tables() -> void:
	assert_true(cfg.ok, "skillSystem.json 应加载成功")
	assert_eq(cfg.config_version, "skill-v1.0.0")
	assert_eq(cfg.slot_count, 4)
	assert_true(cfg.get_skill_def("SK_FIREBALL").size() > 0, "技能石定义存在")
	assert_true(cfg.get_crystal_def("CR_PIERCE").size() > 0, "水晶定义存在")
	assert_true(cfg.get_skill_def("NO_SUCH_SKILL").is_empty(), "缺失定义返回空")


## ---------- 用例 1：编译基础实例（无水晶） ----------

func test_compile_basic_instance() -> void:
	var r := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, [])
	assert_true(r["ok"], "编译应成功")
	var p: Dictionary = r["params"]
	# 与 cfg/skillSystem.json SK_FIREBALL L1 逐字段对表（真源字段名）
	assert_almost_eq(float(p["coefficient"]), 1.5, 0.0001)
	assert_almost_eq(float(p["cooldown"]), 1.8, 0.0001)
	assert_almost_eq(float(p["speed"]), 480.0, 0.0001)
	assert_almost_eq(float(p["life"]), 1.6, 0.0001)
	assert_almost_eq(float(p["radius"]), 8.0, 0.0001)
	assert_eq(int(p["count"]), 1)
	assert_almost_eq(float(p["moreDamageMul"]), 1.0, 0.0001)   # More 因子初始 1
	assert_eq(r["crystal_results"].size(), 0)
	assert_eq(r["cast_stats"], {})


## ---------- 用例 2：水晶 mutate_number 改数字生效 ----------

func test_crystal_mutate_number_applies() -> void:
	# CR_PIERCE L1: modifyParameter add extraPierceCount <- lvParams.count = 1
	var crystals := [{"id": "CR_PIERCE", "level": 1}]
	var r := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, crystals)
	assert_true(r["ok"])
	var p: Dictionary = r["params"]
	assert_almost_eq(float(p["extraPierceCount"]), 1.0, 0.0001)   # 0 + 1
	var cr: Dictionary = r["crystal_results"][0]
	assert_eq(cr["status"], "applied")
	# L7: count = 2 → extraPierceCount = 2（等级参数随水晶等级接线）
	var r7 := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, [{"id": "CR_PIERCE", "level": 7}])
	assert_almost_eq(float(r7["params"]["extraPierceCount"]), 2.0, 0.0001)


## ---------- 用例 3：多水晶按槽位顺序叠加 ----------

func test_multiple_crystals_stack_in_slot_order() -> void:
	# CR_MULTISHOT L1: count +1、coefficient *0.8；CR_EXPANSE L1: radius *1.2；
	# CR_ARCANE_AMP L1: moreDamageMul *1.12；CR_COOLDOWN L1: cdMul *0.94（modifyStat）
	var crystals := [
		{"id": "CR_MULTISHOT", "level": 1},
		{"id": "CR_EXPANSE", "level": 1},
		{"id": "CR_ARCANE_AMP", "level": 1},
		{"id": "CR_COOLDOWN", "level": 1},
	]
	var r := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, crystals)
	assert_true(r["ok"])
	var p: Dictionary = r["params"]
	assert_eq(int(p["count"]), 2, "count: 1 + 1")
	assert_almost_eq(float(p["coefficient"]), 1.5 * 0.8, 0.0001, "coefficient: 1.5 * 0.8")
	assert_almost_eq(float(p["radius"]), 8.0 * 1.2, 0.0001, "radius: 8 * 1.2")
	assert_almost_eq(float(p["moreDamageMul"]), 1.12, 0.0001, "moreDamageMul: 1 * 1.12")
	# cdMul 折进最终 cooldown：1.8 * 0.94 = 1.692
	assert_almost_eq(float(p["cooldown"]), 1.8 * 0.94, 0.0001, "cooldown 折算 cdMul")
	assert_almost_eq(float(r["cast_stats"]["cdMul"]), 0.94, 0.0001)
	# 四颗水晶全部 applied（mutate_number 槽位顺序逐个应用）
	for cr in r["crystal_results"]:
		assert_eq(cr["status"], "applied")


## ---------- 用例 4：伤害减免路径（未闪避 → 平减） ----------

func test_damage_mitigation_path() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var parts := [{"amount": 30.0}, {"amount": 10.0}]
	# evasion = 0：全未闪避，逐份平减 def=4 → 26 + 6 = 32
	var r := SkillDamageCore.settle_hit(parts, {"evasion": 0.0, "def": 4.0}, rng)
	assert_eq(r["hits"], 1, "至少一份未闪避 = hit 成立")
	assert_true(r["hit"])
	assert_almost_eq(float(r["damage_total"]), 32.0, 0.0001)
	assert_false(r["parts"][0]["evaded"])
	assert_almost_eq(float(r["parts"][0]["final_amount"]), 26.0, 0.0001)


## ---------- 用例 5：减免到 0 仍是 hit（与闪避不同） ----------

func test_mitigation_to_zero_is_still_hit() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 1
	# 全闪避：evasion=1.0 → hits=0（不成立）
	var all_evaded := SkillDamageCore.settle_hit([{"amount": 10.0}], {"evasion": 1.0, "def": 0.0}, rng)
	assert_eq(all_evaded["hits"], 0)
	# 未闪避但 def 吃光伤害：final=0 仍算 hit，evaded=false（口径：不能因数字为 0 假装未命中）
	# 份1: 5-5=0（减免到 0）；份2: 8-5=3 → 总伤 3，两份都未闪避
	var zeroed := SkillDamageCore.settle_hit([{"amount": 5.0}, {"amount": 8.0}], {"evasion": 0.0, "def": 5.0}, rng)
	assert_eq(zeroed["hits"], 1, "减免到 0 仍是 hit")
	assert_true(zeroed["hit"])
	assert_false(zeroed["parts"][0]["evaded"], "减免到 0 与闪避不同")
	assert_almost_eq(float(zeroed["parts"][0]["final_amount"]), 0.0, 0.0001, "份1 减免到 0")
	assert_almost_eq(float(zeroed["damage_total"]), 3.0, 0.0001)


## ---------- 用例 5b：逐份独立闪避（部分闪避仍成立一条 hit） ----------

func test_partial_evade_single_hit() -> void:
	# 定值序列 RNG：恒返回 0.0（<0.5 → 全闪避） / 恒返回 0.9（≥0.5 → 全不闪避）
	var rng_always_evade := AlwaysRoll.new(0.0)
	var r1 := SkillDamageCore.settle_hit(
		[{"amount": 10.0}, {"amount": 20.0}], {"evasion": 0.5, "def": 0.0}, rng_always_evade)
	assert_eq(r1["hits"], 0, "全部份闪避 = 不成立")
	var rng_never_evade := AlwaysRoll.new(0.9)
	var r2 := SkillDamageCore.settle_hit(
		[{"amount": 10.0}, {"amount": 20.0}], {"evasion": 0.5, "def": 0.0}, rng_never_evade)
	assert_eq(r2["hits"], 1, "一次候选接触只发一条 hit")
	assert_almost_eq(float(r2["damage_total"]), 30.0, 0.0001)


## ---------- 用例 6：add_behavior 预留接口（未支持标记，不崩溃） ----------

func test_add_behavior_unsupported_marker() -> void:
	# CR_SPLIT 是 addNode（add_behavior 类）；CR_ORBIT 是 convertNode
	var crystals := [
		{"id": "CR_SPLIT", "level": 1},
		{"id": "CR_ORBIT", "level": 1},
	]
	var r := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, crystals)
	# 关键：不崩溃，编译整体仍成功，参数不被 add_behavior 污染
	assert_true(r["ok"], "遇到 add_behavior 不崩溃，编译仍成功")
	assert_eq(int(r["params"]["count"]), 1, "未支持操作不得改参数")
	assert_eq(r["crystal_results"].size(), 2)
	for cr in r["crystal_results"]:
		assert_eq(cr["status"], "unsupported", "add_behavior 返回未支持标记")
		assert_true(cr["reason_codes"].has("NOT_IMPLEMENTED"))
	assert_true(r["reason_codes"].has("NOT_IMPLEMENTED"), "原因码上报未实现")
	assert_true(r["diagnostics"].size() >= 2)


## ---------- 用例 6b：compile() 签名对未知输入 fail-closed ----------

func test_compile_fail_closed_on_bad_reference() -> void:
	var r := SkillCompilerCore.compile(cfg, "SK_NOPE", 1, [])
	assert_false(r["ok"], "未知技能石编译失败")
	assert_true(r["params"].is_empty(), "失败不发布半成品")
	assert_true(r["reason_codes"].has("INVALID_REFERENCE"))
	# 未知水晶引用：编译可继续（诊断上报），该水晶标记 inactive
	var r2 := SkillCompilerCore.compile(cfg, "SK_FIREBALL", 1, [{"id": "CR_NOPE", "level": 1}])
	assert_true(r2["ok"])
	assert_eq(r2["crystal_results"][0]["status"], "inactive")
	assert_true(r2["reason_codes"].has("INVALID_REFERENCE"))


## ---------- 用例 7：旧表字段归一（damageMul/cd/bulletSpd → 真源字段名） ----------

func test_legacy_skill_table_normalized() -> void:
	# cfg/skills.json AT101: cd 0.5 / dmgMul 0.75 / bulletSpd 620（真源无此 id，走旧表兜底）
	var p: Dictionary = cfg.get_base_params("AT101", 1)
	assert_almost_eq(float(p["coefficient"]), 0.75, 0.0001, "dmgMul → coefficient")
	assert_almost_eq(float(p["cooldown"]), 0.5, 0.0001, "cd → cooldown")
	assert_almost_eq(float(p["speed"]), 620.0, 0.0001, "bulletSpd → speed")


## 定值 RNG 桩：randf() 恒返回注入值（逐份闪避判定确定性用例）
## 不继承 RandomNumberGenerator：覆写原生方法会被引擎警告当错误
class AlwaysRoll:
	extends RefCounted
	var v: float
	func _init(fixed: float) -> void:
		v = fixed
	func randf() -> float:
		return v
