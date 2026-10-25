## 战斗核心测试（P3）—— 覆盖本次两大修复的验收口径：
##   ① 子弹 substep 检测：撞墙必 vanish、永不穿墙（修复穿障 bug）
##   ② 凹形死端：怪靠流场绕出（修复卡障碍 bug）
## 另覆盖：命中击杀 / 接触伤害 / 分离力 / 玩家移动与撞墙。
extends GutTest

var c: JesCombat

func _mk() -> JesCombat:
	var hero := {"hp": 94.0, "spd": 306.0, "radius": 18.0, "atk": 16.0, "def": 2.0}
	var c2 := JesCombat.new()
	c2.setup(hero, {
		"NM0010": {"hp": 20.0, "atk": 8.0, "def": 1.0, "spd": 115.0, "radius": 17.0, "exp": 3, "coin": 2, "type": "melee"},
		"NM0011": {"hp": 13.0, "atk": 6.0, "def": 0.0, "spd": 95.0, "radius": 15.0, "exp": 4, "coin": 3, "type": "ranged"},
	}, {"mapW": 1920, "mapH": 1920})
	c2.monster_cap = 0        # 关掉自动刷波，测试手工摆怪
	c2.spawn_pool = ["NM0010"]
	return c2

func before_each() -> void:
	c = _mk()

## ① 子弹撞墙：substep 检测下命中即消失，永不越过墙面
func test_bullet_stops_at_wall() -> void:
	c.player.pos = Vector2(500, 930)   # 中央横墙 (720,900,360,60) 左侧，正对墙面
	var gone := [Vector2(-1, -1)]      # lambda 按引用捕获数组，按值捕获标量无效
	c.bullet_vanished.connect(func(b): gone[0] = Vector2(b.pos))
	for i in range(60):                # 3 秒足够飞完全程
		c.step(0.05, Vector2.ZERO, Vector2.RIGHT, true)
		if c.bullets.is_empty():
			break
	assert_eq(c.bullets.size(), 0, "子弹应已撞墙消失")
	assert_gt(gone[0].x, 700.0, "消失点应在墙面附近（而非枪口）")
	assert_lt(gone[0].x, 1092.0, "消失点绝不越过墙箱右缘 (1080+半径6+容差)")

## ② 凹形死端：L 形口袋（凹口朝右下）里的怪，须绕出口走向玩家
func test_monster_escapes_concave_deadend() -> void:
	c.player.pos = Vector2(960, 960)
	c.field.recompute(c.player.pos)
	# 口袋开阔点（两臂围合区 x 180..340 / y 120..320）
	var m := {"tpl": "NM0010", "pos": Vector2(250, 200), "hp": 20.0, "spd": 115.0,
		"radius": 17.0, "atk": 8.0, "def": 1.0, "exp": 3, "coin": 2,
		"ranged": false, "dead": false, "hit_cd": 0.0}
	c.monsters.append(m)
	for i in range(240):               # 模拟 12 秒
		c.step(0.05, Vector2.ZERO, Vector2.RIGHT, false)
	var p: Vector2 = m.pos
	assert_true(p.x > 360.0 or p.y > 400.0,
		"怪应在 12 秒内绕出口袋（终点 %s），而非卡死在死端" % str(p))

## ③ 命中击杀：伤害减免、死亡信号、战利品计数
func test_bullet_kills_monster() -> void:
	c.player.pos = Vector2(500, 960)
	var m := {"tpl": "NM0010", "pos": Vector2(700, 960), "hp": 20.0, "spd": 115.0,
		"radius": 17.0, "atk": 8.0, "def": 1.0, "exp": 3, "coin": 2,
		"ranged": false, "dead": false, "hit_cd": 0.0}
	c.monsters.append(m)
	var killed := [false]
	c.monster_killed.connect(func(_m): killed[0] = true)
	# 一发 12-1=11，两发击杀；cd 0.5 → 至少 0.5s 两发
	for i in range(30):
		c.step(0.05, Vector2.ZERO, Vector2.RIGHT, true)
		if bool(m.dead):
			break
	assert_true(bool(m.dead), "两发速射应击杀 20 血怪")
	assert_true(killed[0], "monster_killed 信号应触发")
	assert_eq(c.kills, 1)
	assert_eq(c.exp_gained, 3)
	assert_eq(c.coin_gained, 2)

## ④ 近战接触伤害：减免生效、hp 扣减
func test_melee_contact_damage() -> void:
	var hp0: float = float(c.player.hp)
	c.player.pos = Vector2(960, 960)
	c.monsters.append({"tpl": "NM0010", "pos": Vector2(990, 960), "hp": 99999.0,
		"spd": 0.0, "radius": 17.0, "atk": 8.0, "def": 0.0, "exp": 3, "coin": 2,
		"ranged": false, "dead": false, "hit_cd": 0.0})
	c.step(0.1, Vector2.ZERO, Vector2.RIGHT, false)
	assert_lt(float(c.player.hp), hp0, "贴脸近战怪应造成接触伤害")
	assert_eq(float(c.player.hp), hp0 - 6.0, "伤害 = max(8-2防,1) = 6")

## ⑤ 分离力：重叠怪被推开
func test_separation_pushes_overlapping_monsters() -> void:
	c.player.pos = Vector2(1700, 1700)
	c.field.recompute(c.player.pos)
	var a := {"tpl": "NM0010", "pos": Vector2(200, 200), "hp": 99999.0, "spd": 100.0,
		"radius": 17.0, "atk": 0.0, "def": 0.0, "exp": 0, "coin": 0,
		"ranged": false, "dead": false, "hit_cd": 0.0}
	var b := {"tpl": "NM0010", "pos": Vector2(210, 200), "hp": 99999.0, "spd": 100.0,
		"radius": 17.0, "atk": 0.0, "def": 0.0, "exp": 0, "coin": 0,
		"ranged": false, "dead": false, "hit_cd": 0.0}
	c.monsters.append(a)
	c.monsters.append(b)
	var d0: float = (Vector2(a.pos) - Vector2(b.pos)).length()
	for i in range(20):
		c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	var d1: float = (Vector2(a.pos) - Vector2(b.pos)).length()
	assert_gt(d1, d0, "重叠怪应被分离力推开（%f → %f）" % [d0, d1])

## ⑥ 玩家移动与撞墙
func test_player_move_and_wall_block() -> void:
	c.player.pos = Vector2(500, 930)   # 墙面 x=720 左侧
	var x0: float = c.player.pos.x
	c.step(0.05, Vector2.RIGHT, Vector2.RIGHT, false)
	assert_gt(float(c.player.pos.x), x0, "向右输入应使玩家右移")
	# 连续向右 3 秒，玩家必须停在墙前（墙面 x=720，圆半径 18 → 圆心 x<=702）而非穿入
	for i in range(60):
		c.step(0.05, Vector2.RIGHT, Vector2.RIGHT, false)
	assert_true(float(c.player.pos.x) <= 703.0, "玩家必须停在墙面前（实测 %f）" % float(c.player.pos.x))

## ⑦ 远程怪保持距离开火（弹道取 y=700 避开中央横墙 y 900..960）
func test_ranged_monster_shoots() -> void:
	c.player.pos = Vector2(960, 700)
	c.monsters.append({"tpl": "NM0011", "pos": Vector2(1260, 700), "hp": 99999.0,
		"spd": 0.0, "radius": 15.0, "atk": 6.0, "def": 0.0, "exp": 0, "coin": 0,
		"ranged": true, "dead": false, "hit_cd": 0.0})
	var got_bullet := [false]
	c.bullet_vanished.connect(func(b): if not bool(b.from_player): got_bullet[0] = true)
	for i in range(20):
		c.step(0.05, Vector2.ZERO, Vector2.ZERO, false)
	assert_true(got_bullet[0], "远程怪 1 秒内应向玩家开火（敌方弹存在）")
	assert_eq(c.bullets.size(), 0, "敌方弹飞到玩家身上应 vanish")
	assert_lt(float(c.player.hp), float(c.player.hp_max), "玩家应被敌方弹命中扣血")
