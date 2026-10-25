## 战斗流程补齐测试——对齐 html combat.js/modes.js 口径的纯逻辑验收：
##   ① progressGoal/timeLimit 触发 BOSS（combat.js 731）
##   ② 撤离流：BOSS 死 → 撤离点 → 压力波参数 → 读条完成发 run_settled
##   ③ 负重减速插值（weight.json：threshold/minFactor/slope/divisor）
##   ④ 开场冻结：冻结期不刷怪不可动、计时停摆
##   ⑤ 升级 4 选 1：pending 暂停闸门 + 选完恢复
##   ⑥ 难度分档：monsterScale 倍率套用（applyHp/applyAtk）
extends GutTest

var c: JesCombat

func _mk(level: Dictionary = {}, extract_cfg: Dictionary = {}) -> JesCombat:
	var hero := {"hp": 94.0, "spd": 306.0, "radius": 18.0, "atk": 16.0, "def": 2.0}
	var c2 := JesCombat.new()
	c2.setup(hero, {
		"NM0010": {"hp": 20.0, "atk": 8.0, "def": 1.0, "spd": 115.0, "radius": 17.0, "exp": 3, "coin": 2, "type": "melee"},
		"BS_T": {"hp": 100.0, "atk": 15.0, "def": 3.0, "spd": 72.0, "radius": 46.0, "exp": 60, "coin": 80, "type": "boss", "patternCd": 3.2},
	}, level, {
		"extract": extract_cfg,
		"weight": {"threshold": 100.0, "minFactor": 0.2, "slope": 0.8, "divisor": 100.0},
		"levelUp": {"curve": {"base": 8.0, "growth": 1.32, "softCapLv": 12, "softCapMul": 0.7},
			"choiceCount": 4, "statPack": [
				{"id": "pack_atk", "name": "强攻包", "stat": "atk", "value": 3.0},
				{"id": "pack_hp", "name": "坚韧包", "stat": "hp", "value": 15.0},
				{"id": "pack_def", "name": "铁壁包", "stat": "def", "value": 1.0},
				{"id": "pack_spd", "name": "疾行包", "stat": "spd", "value": 8.0}]},
		"warBuffs": [{"skillId": "BF001", "id": "狂力", "stat": "atk", "mul": 1.3, "label": "攻击力 +30%"}],
		"monsterScale": {"targets": {"小怪属性": {"key": "smallStat", "applyHp": true, "applyAtk": true}}},
	})
	c2.monster_cap = 0   # 关自动刷波，手工摆怪
	c2.spawn_pool = ["NM0010"]
	return c2

func before_each() -> void:
	_last_settled = {}
	EventBus.run_settled.connect(_on_settled)
	c = _mk({"id": "LEVEL_T", "mapW": 1920, "mapH": 1920, "boss": "BS_T",
		"progressGoal": 2, "timeLimit": 0})

func after_each() -> void:
	if EventBus.run_settled.is_connected(_on_settled):
		EventBus.run_settled.disconnect(_on_settled)

## ① 击杀达标 → 刷 BOSS（波次 Boss 已让位给 progressGoal 口径）
func test_progress_goal_triggers_boss() -> void:
	assert_eq(c.boss_every_waves, 0, "progressGoal 关卡应关闭波次 Boss 口径")
	for i in range(2):
		var m := c.spawn_monster("NM0010")
		c._damage_monster(m, 999.0)
	assert_eq(c.kills, 2, "击杀计数应达标")
	c.step(0.05, Vector2.ZERO, Vector2.RIGHT, false)
	assert_eq(c.boss_triggered, true, "击杀达 progressGoal 应触发 BOSS")
	var live := c.monsters.filter(func(m): return not bool(m.dead))
	assert_eq(live.size(), 1, "BOSS 应已入场")
	assert_true(bool(live[0].get("boss", false)), "入场怪应为 BOSS")

## ①b 超时也可触发 BOSS（timeLimit 先到者口径）
func test_time_limit_triggers_boss() -> void:
	var c2 := _mk({"id": "LEVEL_T", "mapW": 1920, "mapH": 1920, "boss": "BS_T",
		"progressGoal": 999, "timeLimit": 1.0})
	c2.step(0.6, Vector2.ZERO, Vector2.RIGHT, false)
	assert_false(c2.boss_triggered, "未到时限不应触发")
	c2.step(0.6, Vector2.ZERO, Vector2.RIGHT, false)
	assert_true(c2.boss_triggered, "超时 timeLimit 应触发 BOSS")

## ② 撤离流：BOSS 死 → 撤离点 → 压力波（base 2 + growth 1，间隔 2.5s）→ 读条完成结算
func test_extract_flow_full() -> void:
	var ext := {
		"enabled": true, "waveEnabled": true, "waveFirstDelay": 0.0,
		"waveInterval": 2.5, "waveSizeBase": 2.0, "waveSizeGrowth": 1.0,
		"waveEliteChance": 0.08, "waveSpawnRadius": 420.0,
		"channel": 0.5, "radius": 100.0,
		"weightPenaltyEnabled": true, "weightThreshold": 100.0,
		"weightSlopePer100": 0.25, "weightTimeScaleMax": 2.0,
	}
	var c2 := _mk({"id": "LEVEL_T", "mapW": 1920, "mapH": 1920, "boss": "BS_T",
		"progressGoal": 1, "timeLimit": 0}, ext)
	c2.monster_cap = 20   # 撤离波需要容量槽位
	watch_signals(EventBus)
	var boss := c2.spawn_boss("BS_T")
	c2._damage_monster(boss, 999.0)
	assert_true(c2.extract_point != null and c2.extract_point.active, "BOSS 死后撤离点应激活")
	# 压力波参数（ExtractPoint.wave_size：base + growth*(n-1)）
	assert_eq(c2.extract_point.wave_size(1), 2, "第 1 波应 2 只")
	assert_eq(c2.extract_point.wave_size(3), 4, "第 3 波应 4 只（逐波 +1）")
	# 玩家进圈读条：第 1 波立即刷出，读条 0.5s 完成结算
	c2.player.pos = c2.extract_point.position
	var before := c2.monsters.size()
	for i in range(12):
		c2.step(0.05, Vector2.ZERO, Vector2.RIGHT, false)
	assert_gte(c2.monsters.size() - before, 2, "读条期间应刷出压力波")
	assert_true(c2.settled, "读条完成应结算")
	assert_signal_emitted(EventBus, "run_settled", "结算应发 run_settled")
	assert_eq(str(_last_settled.get("winner", "")), "extract", "结算 winner 应为 extract")
	assert_eq(str(_last_settled.get("level_id", "")), "LEVEL_T", "结算应带 level_id")
	assert_true(_last_settled.has("shards") and _last_settled.has("kills")
		and _last_settled.has("time"), "结算应带 shards/kills/time")

var _last_settled: Dictionary = {}
func _on_settled(r: Dictionary) -> void:
	_last_settled = r

## ②b 死亡也发同信号（winner = dead）
func test_death_emits_settled_dead() -> void:
	watch_signals(EventBus)
	c.player.hp = 1.0
	c._damage_player(999.0)
	assert_signal_emitted(EventBus, "run_settled", "死亡应发 run_settled")
	assert_eq(str(_last_settled.get("winner", "")), "dead", "死亡结算 winner 应为 dead")
	assert_false(c.player.alive, "玩家应已阵亡")

## ③ 负重减速插值：<=100 恒 1；超重线性衰减，保底 minFactor
func test_weight_factor_interpolation() -> void:
	c.add_weight(50.0)
	assert_almost_eq(c.weight_factor(), 1.0, 0.0001, "未超重应为 1")
	c.add_weight(50.0)
	assert_almost_eq(c.weight_factor(), 1.0, 0.0001, "恰好 100 应为 1")
	c.add_weight(50.0)   # 150：1 - 0.8*50/100 = 0.6
	assert_almost_eq(c.weight_factor(), 0.6, 0.0001, "超重 50 应插值到 0.6")
	c.add_weight(500.0)  # 远超：保底 0.2
	assert_almost_eq(c.weight_factor(), 0.2, 0.0001, "极端超重应保底 minFactor")

## ④ 开场冻结：冻结期不刷怪不可动、计时停摆；解冻后恢复正常
func test_freeze_gate_blocks_world() -> void:
	c.freeze_time = 1.0
	c.player.pos = Vector2(960, 960)
	var pos := Vector2(c.player.pos)
	for i in range(10):
		c.step(0.05, Vector2.RIGHT, Vector2.RIGHT, false)
	assert_eq(c.monsters.size(), 0, "冻结期不应刷怪")
	assert_eq(Vector2(c.player.pos), pos, "冻结期玩家不可动")
	assert_almost_eq(c.run_time, 0.0, 0.0001, "冻结期计时停摆")
	for i in range(20):
		c.step(0.05, Vector2.ZERO, Vector2.RIGHT, false)
	assert_lt(c.run_time, 1.5, "解冻后计时恢复")

## ⑤ 升级 4 选 1：经验达标 pending+1（暂停闸门），选完恢复
func test_levelup_pause_and_resume() -> void:
	assert_eq(c.pending_levelups, 0, "初始无待处理升级")
	c.gain_exp(100)
	assert_gt(c.pending_levelups, 0, "经验达标应触发升级暂停闸门")
	assert_gt(c.player_lv, 1, "等级应提升")
	var offers := c.make_levelup_offers()
	assert_eq(offers.size(), 4, "应弹 4 选 1")
	var pending_before := c.pending_levelups
	# 优先选 atk 属性包（效果可断言）；否则选第一个，只验证 pending 递减
	var pick := 0
	for i in range(offers.size()):
		if str(offers[i].get("type", "")) == "stat" and str(offers[i].get("stat", "")) == "atk":
			pick = i
			break
	var atk_before := float(c.player.atk)
	c.apply_levelup_choice(offers[pick])
	assert_lt(c.pending_levelups, pending_before, "选择后 pending 应递减")
	if str(offers[pick].get("type", "")) == "stat" and str(offers[pick].get("stat", "")) == "atk":
		assert_gt(float(c.player.atk), atk_before, "属性包应立即生效")

## ⑥ 难度分档：monsterScale 倍率只影响后续生成（applyHp/applyAtk）
func test_monster_scale_tiers() -> void:
	var m := c.spawn_monster("NM0010")
	assert_almost_eq(float(m.hp), 20.0, 0.0001, "无倍率时 HP 不变")
	c.scale_muls = {"smallStat": 2.0}
	var m2 := c.spawn_monster("NM0010")
	assert_almost_eq(float(m2.hp), 40.0, 0.0001, "小怪属性倍率应翻倍 HP（只影响后续生成）")
	assert_almost_eq(float(m.hp), 20.0, 0.0001, "已生成怪不回溯")
	assert_almost_eq(float(m2.hp_max), 40.0, 0.0001, "hp_max 应同步翻倍")

## ⑦ 升级所需经验曲线（levelUp.curve：base*growth^(lv-1)，软帽后乘 softCapMul）
func test_exp_curve() -> void:
	assert_eq(c.exp_to_next(), 8, "Lv1 需求应为 base=8")
	c.player_lv = 12
	assert_almost_eq(float(c.exp_to_next()), 8.0 * pow(1.32, 11.0) * 0.7, 2.0,
		"软帽后需求应乘 softCapMul")
