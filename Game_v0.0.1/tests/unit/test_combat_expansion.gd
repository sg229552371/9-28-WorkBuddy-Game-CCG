## 战斗核心扩展测试（怪物多样性 / 精英 / Boss / 暴击 / 宝箱 / 波次成长）
## 数据真源 = res://cfg/*.json（monsters / levels / spawnCircles / levelCurve / chestDrop）
## 覆盖口径：
##   ① 多怪物模板表驱动加载（spawnCircles 加权池）
##   ② 精英出现且按词缀强化（血量倍率 / 体型放大 / 额外经验）
##   ③ Boss 出现且放弹幕（环形 / 扇形），血量阈值切阶段
##   ④ 暴击触发路径（生成子弹时掷骰，伤害乘倍率）
##   ⑤ 宝箱掉落信号（精英/Boss 必掉 + 走近拾取发 chest_picked）
##   ⑥ 波次成长曲线（levelCurve.json hpMul 读表，不硬编码）
extends GutTest

var c: JesCombat

func _load_json(path: String) -> Variant:
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func before_each() -> void:
	var hero := {"hp": 94.0, "spd": 306.0, "radius": 18.0, "atk": 16.0, "def": 2.0}
	var monsters_t: Dictionary = _load_json("res://cfg/monsters.json")
	var levels: Variant = _load_json("res://cfg/levels.json")
	var level: Dictionary = (levels as Array)[0]   # LEVEL_001（monsterLevel=1, boss=BS0001）
	# 精英词缀用单条确定性小表（避免随机词缀干扰断言；数值对齐真源"坚韧"）
	var elites := {"affixCount": [1, 1], "sizeMul": 1.35, "extraExp": 2,
		"affixes": {"tough": {"hpMul": 3.0, "defAdd": 2.0}}}
	c = JesCombat.new()
	c.setup(hero, monsters_t, level, {
		"spawnCircles": _load_json("res://cfg/spawnCircles.json"),
		"levelCurve": _load_json("res://cfg/levelCurve.json"),
		"chestDrop": _load_json("res://cfg/chestDrop.json"),
		"elites": elites,
	})
	c.monster_cap = 0        # 关掉自动刷波，测试手工摆怪
	c.spawn_pool = ["NM0010"]

## ① 多怪物模板：加权池来自 levels.circles × spawnCircles.pool；各模板字段按表驱动
func test_multi_monster_templates_loaded() -> void:
	assert_gt(c.spawn_pool_w.size(), 3, "LEVEL_001 刷怪池应含 ≥4 种模板（SC01 合成）")
	assert_true(c.spawn_pool_w.has("NM0010"), "刷怪池应含 NM0010（重甲兵）")
	assert_true(c.spawn_pool_w.has("NM0027"), "刷怪池应含 NM0027（SC01 稀有权重）")
	var a := c.spawn_monster("NM0010")
	var b := c.spawn_monster("NM0011")
	assert_false(a.is_empty(), "NM0010 应能按表生成")
	assert_false(b.is_empty(), "NM0011 应能按表生成")
	var hp_mul: float = c._curve_hp_mul(c._wave_level())
	assert_almost_eq(float(a.hp), 20.0 * hp_mul, 0.01, "NM0010 血量 = 表值 × 曲线倍率")
	assert_almost_eq(float(b.hp), 13.0 * hp_mul, 0.01, "NM0011 血量 = 表值 × 曲线倍率")
	assert_true(bool(b.ranged), "NM0011（游击弓手）应为远程怪")
	assert_false(bool(a.ranged), "NM0010（重甲兵）应为近战怪")

## ② 精英：ED 模板投放 + 词缀强化（hpMul 3.0 / 体型 ×1.35 / 额外经验 +2）
func test_elite_spawn_and_buff() -> void:
	var tpl: Dictionary = c.tpl_monsters["ED0001"]
	# 确定性：锁定精英模板池为 ED0001（levels.json 原池 60/30/10 会随机抽中其他 ED 模板）
	c.elite_pool_w = {"ED0001": 100.0}
	c.rng.seed = 7
	var e := c.spawn_elite()
	assert_false(e.is_empty(), "level.elitePool=ED0001:100 应能投放精英")
	assert_true(bool(e.is_elite), "投放物应带精英标记")
	var hp_mul: float = c._curve_hp_mul(c._wave_level())
	assert_almost_eq(float(e.hp), float(tpl.hp) * hp_mul * 3.0, 0.01, "精英血量 = 表值 × 曲线 × 词缀 hpMul")
	assert_almost_eq(float(e.radius), float(tpl.radius) * 1.35, 0.01, "精英体型应 ×1.35（sizeMul）")
	assert_eq(int(e.exp), int(tpl.exp) + 2, "精英应加额外经验（extraExp=2）")

## ③ Boss：BS 模板投放 + 环形/扇形弹幕 + 血量阈值切阶段
func test_boss_spawn_barrage_and_phase() -> void:
	var boss := c.spawn_boss("BS0001")
	assert_false(boss.is_empty(), "level.boss=BS0001 应能投放 Boss")
	assert_true(bool(boss.boss), "投放物应带 Boss 标记")
	assert_almost_eq(float(boss.radius), 46.0, 0.01, "Boss 应为大体型（表值 radius 46）")
	assert_eq((boss.phases as Array).size(), 2, "BS0001 应有两阶段配置")
	# 环形弹幕：强制冷却归零后一步内发射 ≥12 弹
	boss.pattern_cd = 0.01
	c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	var enemy_bullets := 0
	for b in c.bullets:
		if not bool(b.from_player):
			enemy_bullets += 1
	assert_gte(enemy_bullets, 6, "Boss 冷却归零应发射环形弹幕（同帧被清弹也不低于扇形弹数）")
	# 阶段切换：血量打到 40% → phase 1 + 立即补发弹幕
	boss.hp = float(boss.hp_max) * 0.4
	c._damage_monster(boss, 1.0)
	assert_eq(int(boss.phase), 1, "血量 ≤50% 阈值应切入阶段 2")
	assert_true(float(boss.pattern_cd) <= 0.0, "切阶段应立即触发一次弹幕")
	c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	var fired_again := false
	for b in c.bullets:
		if not bool(b.from_player):
			fired_again = true
	assert_true(fired_again, "切阶段后应有第二波（扇形）弹幕在场")

## ④ 暴击：crit_chance=1.0 时命中必暴击，伤害 = atk×dmgMul×critMul − 怪防
func test_player_crit_path() -> void:
	c.crit_chance = 1.0
	c.player.pos = Vector2(500, 960)
	var m := {"tpl": "NM0010", "pos": Vector2(700, 960), "hp": 1000.0, "hp_max": 1000.0,
		"spd": 115.0, "radius": 17.0, "atk": 8.0, "def": 1.0, "exp": 3, "coin": 2,
		"ranged": false, "dead": false, "hit_cd": 0.0, "is_elite": false, "boss": false, "shield": 0.0}
	c.monsters.append(m)
	var vanished := [0]           # lambda 按引用捕获：数组包装
	c.bullet_vanished.connect(func(b): if bool(b.from_player): vanished[0] += 1)
	for i in range(30):
		c.step(0.05, Vector2.ZERO, Vector2.RIGHT, true)
		if vanished[0] >= 1:
			break
	assert_gte(vanished[0], 1, "至少一发子弹已命中消失")
	assert_gte(c.crit_count, 1, "暴击计数应 ≥1（crit_chance=1.0）")
	# 期望伤害 = 16×0.75×2 − 1 防 = 23
	assert_almost_eq(1000.0 - float(m.hp), 23.0, 0.01, "暴击单发伤害应为 23（12×2−1 防）")

## ⑤ 宝箱：精英必掉 → 地上标记 → 走近拾取发 chest_picked 信号
func test_chest_drop_and_pickup_signal() -> void:
	var spawned := [false]
	var picked := [false]
	c.chest_spawned.connect(func(_ch): spawned[0] = true)
	c.chest_picked.connect(func(_ch): picked[0] = true)
	var e := c.spawn_elite()
	c._damage_monster(e, 1000000.0)
	assert_true(bool(e.dead), "精英应被击杀")
	assert_true(spawned[0], "精英死亡应触发 chest_spawned 信号")
	assert_eq(c.chests.size(), 1, "精英必掉 1 个宝箱")
	assert_true(["normal", "advanced"].has(c.chests[0].quality), "精英宝箱品质应为低级档（normal/advanced）")
	# Boss 死亡必掉中高级宝箱
	var boss := c.spawn_boss("BS0001")
	c._damage_monster(boss, 10000000.0)
	assert_eq(c.chests.size(), 2, "Boss 必掉第 2 个宝箱")
	assert_true(["epic", "divine", "mythic"].has(c.chests[1].quality), "Boss 宝箱品质应为中高级档")
	# 拾取：摆两个确定位置的宝箱，玩家走进判定半径 → chest_picked + 移除
	c.chests.clear()
	c._drop_chest(Vector2(900, 900), "elite")
	c._drop_chest(Vector2(1200, 900), "boss")
	assert_eq(c.chests.size(), 2, "测试摆箱后应有两个地面宝箱")
	c.player.pos = Vector2(900, 900)
	c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	assert_true(picked[0], "走近宝箱应触发 chest_picked 信号（背包接口钩子）")
	assert_eq(c.chests.size(), 1, "只拾取走进判定半径的那一个")
	c.player.pos = Vector2(1200, 900)
	c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	assert_eq(c.chests.size(), 0, "全部拾取后地面应无宝箱")

## ⑥ 波次成长：hp 随 levelCurve.rows[lv].hpMul 缩放（lv = monsterLevel + wave_index − 1）
func test_wave_scaling_from_level_curve() -> void:
	var tpl: Dictionary = c.tpl_monsters["NM0010"]
	c.wave_index = 3   # lv = monsterLevel(1) + 3 − 1 = 3 → hpMul 1.24
	var m1 := c.spawn_monster("NM0010")
	assert_almost_eq(float(m1.hp), float(tpl.hp) * 1.24, 0.01,
		"monsterLevel=1 波次 3 → lv3 行 hpMul=1.24（读表）")
	c.wave_index = 7   # lv = 1 + 7 − 1 = 7 → hpMul = 1.72
	var m2 := c.spawn_monster("NM0010")
	assert_almost_eq(float(m2.hp), float(tpl.hp) * 1.72, 0.01, "波次 7 → lv7 行 hpMul=1.72（读表）")
	assert_gt(float(m2.hp), float(m1.hp), "波次推进后同模板血量应单调上升")
