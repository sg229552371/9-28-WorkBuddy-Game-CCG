# M8 测试：DoT/异常系统 + 对象池（规格 §8.1 / §9.3 / §12 G9）
# 验收：DoT tick 数值可手算；AILMENT 通道隔离（hit 增益不影响点燃）；
#       中毒叠层独立计时；池硬上限回收最旧。
# 硬约束（规格 §8.1 / §9.3 / §13）：
#   - DoT 用一个全局 ticker（0.25s 网格），每效果记录 next_tick_at；禁止每个 DoT 一个 Timer
#   - 异常伤害走 AILMENT 通道，不吃 "hit damage increased"，只吃 "dot/ailment damage"
#   - 池有硬上限，达上限时回收最旧而非扩容
#   - 无 gem_id 分支；网格为规格定义常量；时间推进由测试手动 advance(dt)
extends GutTest

const DotTickerScript := preload("res://mods/jes-skills/systems/skills/combat/dot_ticker.gd")
const AilmentComponentScript := preload("res://mods/jes-skills/systems/skills/combat/ailment_component.gd")
const ProjectilePoolScript := preload("res://mods/jes-skills/systems/skills/combat/projectile_pool.gd")

const TICK_GRID: float = 0.25


# ---------- D1：DoT tick 数值（点燃 DPS 手算）----------
# 点燃：火伤快照 60，系数 0.2 → DPS 12；网格 0.25 → 每 tick 伤害 3。
func test_d1_ignite_tick_values() -> void:
	var ticker: DotTicker = DotTickerScript.new(TICK_GRID)
	var dot: DotInstance = ticker.apply_dot(&"ignite", 60.0, 0.2, 4.0)
	assert_almost_eq(dot.dps, 12.0, 0.0001, "60 × 0.2 = 12 DPS")
	assert_almost_eq(dot.tick_damage, 3.0, 0.0001, "12 × 0.25 = 3 每 tick")
	assert_eq(dot.ailment_type, &"ignite")
	assert_almost_eq(dot.remaining, 4.0, 0.0001, "持续 4s")


# ---------- D2：tick 时刻与总量（4s 内 16 tick，过期后不再 tick）----------
func test_d2_tick_schedule_and_total() -> void:
	var ticker: DotTicker = DotTickerScript.new(TICK_GRID)
	var dealt: Array[float] = []
	ticker.tick_dealt.connect(func(amount: float, dot: DotInstance) -> void:
		dealt.append(amount))
	ticker.apply_dot(&"ignite", 60.0, 0.2, 4.0)
	for i in 16:
		ticker.advance(TICK_GRID)
		assert_almost_eq(dealt[i], 3.0, 0.0001, "第 %d tick = 3.0" % (i + 1))
	assert_eq(dealt.size(), 16, "4s 内共 16 tick")
	ticker.advance(1.0)
	assert_eq(dealt.size(), 16, "过期后不再 tick")


# ---------- D3：G9 通道隔离——hit damage +100% 不影响点燃，ailment +50% 才影响 ----------
func test_d3_g9_ailment_channel_isolation() -> void:
	var ticker: DotTicker = DotTickerScript.new(TICK_GRID)
	var dealt: Array[float] = []
	ticker.tick_dealt.connect(func(amount: float, dot: DotInstance) -> void:
		dealt.append(amount))
	ticker.apply_dot(&"ignite", 60.0, 0.2, 4.0)
	ticker.set_channel_mult(SkillChannel.Channel.HIT, 2.0)
	ticker.advance(TICK_GRID)
	assert_almost_eq(dealt[0], 3.0, 0.0001, "hit 增益不影响点燃 DPS")
	ticker.set_channel_mult(SkillChannel.Channel.AILMENT, 1.5)
	ticker.advance(TICK_GRID)
	assert_almost_eq(dealt[1], 4.5, 0.0001, "ailment 增益按倍率生效")


# ---------- D4：中毒可叠层，每层独立计时 ----------
# 每层：快照 40 × 0.25 = DPS 10 → 每 tick 2.5。A 持续 1s（4 tick），B 晚 0.5s 施加、持续 2s（8 tick）。
func test_d4_poison_stacks_independent_timing() -> void:
	var ticker: DotTicker = DotTickerScript.new(TICK_GRID)
	var ticks_a: Array[int] = []
	var ticks_b: Array[int] = []
	var dot_a := ticker.apply_dot(&"poison", 40.0, 0.25, 1.0)
	ticker.tick_dealt.connect(func(amount: float, dot: DotInstance) -> void:
		if dot == dot_a:
			ticks_a.append(1)
		else:
			ticks_b.append(1))
	ticker.advance(2 * TICK_GRID)
	assert_eq(ticks_a.size(), 2, "A 先 tick 2 次")
	var dot_b := ticker.apply_dot(&"poison", 40.0, 0.25, 2.0)
	assert_almost_eq(dot_b.tick_damage, 2.5, 0.0001, "B 层每 tick 2.5")
	ticker.advance(10 * TICK_GRID)
	assert_eq(ticks_a.size(), 4, "A 共 4 tick 后过期")
	assert_eq(ticks_b.size(), 8, "B 独立计时共 8 tick")
	assert_almost_eq(dot_a.remaining, 0.0, 0.0001, "A 已过期")
	assert_almost_eq(dot_b.remaining, 0.0, 0.0001, "B 已过期")


# ---------- D5：池硬上限——达上限回收最旧而非扩容 ----------
func test_d5_pool_hard_cap_recycles_oldest() -> void:
	var pool: ProjectilePool = ProjectilePoolScript.new(3)
	var s1 = pool.acquire()
	var s2 = pool.acquire()
	var s3 = pool.acquire()
	assert_eq(pool.active_count(), 3, "三个活跃槽位")
	assert_ne(s1, s2)
	assert_ne(s2, s3)
	var r1 = pool.acquire()
	assert_eq(r1, s1, "池满时回收最旧的 s1")
	assert_eq(pool.active_count(), 3, "总量不超硬上限")
	var r2 = pool.acquire()
	assert_eq(r2, s2, "第二次回收次旧的 s2")
	assert_eq(pool.active_count(), 3)


# ---------- D6：release 后优先复用空闲槽位，重复 release 安全 ----------
func test_d6_pool_release_and_reuse() -> void:
	var pool: ProjectilePool = ProjectilePoolScript.new(2)
	var s1 = pool.acquire()
	var s2 = pool.acquire()
	pool.release(s1)
	assert_eq(pool.active_count(), 1)
	var s3 = pool.acquire()
	assert_eq(s3, s1, "优先复用已释放槽位")
	assert_eq(pool.active_count(), 2)
	pool.release(s3)
	pool.release(s3)
	assert_eq(pool.active_count(), 1, "重复 release 不重复计数")


# ---------- D7：AilmentComponent 委托全局 ticker，无自有 Timer ----------
func test_d7_ailment_component_delegates_to_global_ticker() -> void:
	var ticker: DotTicker = DotTickerScript.new(TICK_GRID)
	var ail: AilmentComponent = AilmentComponentScript.new(ticker)
	ail.apply(&"ignite", 60.0, 0.2, 4.0)
	ail.apply(&"poison", 40.0, 0.25, 1.0)
	assert_eq(ail.active_count(), 2, "两个活跃异常")
	ticker.advance(1.0)
	assert_eq(ail.active_count(), 1, "中毒 1s 过期，点燃仍在")
	assert_eq(ail.dots_of(&"ignite").size(), 1)
	ticker.advance(3.0)
	assert_eq(ail.active_count(), 0, "全部过期")
