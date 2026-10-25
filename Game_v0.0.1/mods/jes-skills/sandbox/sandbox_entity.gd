# 沙盒实体（S3）：玩家与木桩通用。
# 组合：StatsComponent + HealthComponent + HurtboxComponent + DotTicker（tick → 扣血闭环）。
# 纯几何绘制与命中判定，不依赖物理引擎（便于 headless 冒烟测试）。
# 硬门禁：无 gem_id 分支；无 Timer 节点；时间推进由外部 tick(dt) 驱动。
class_name SandboxEntity
extends Node2D

const BASE_MAX_HEALTH := 1000.0

var entity_name: String = "entity"
var is_player: bool = false
var stats: StatsComponent = null          # DamageCalculator 鸭子类型要求此属性名
var health: HealthComponent = null
var hurtbox: HurtboxComponent = null
var dot_ticker: DotTicker = null

var _radius: float = 24.0
var _respawn_timer: float = 0.0


func _init(p_name: String, p_is_player: bool, p_radius: float = 24.0) -> void:
	entity_name = p_name
	is_player = p_is_player
	_radius = p_radius
	stats = StatsComponent.new()
	health = HealthComponent.new()
	health.max_health = BASE_MAX_HEALTH
	health.current_health = BASE_MAX_HEALTH
	dot_ticker = DotTicker.new()
	dot_ticker.tick_dealt.connect(_on_dot_tick)
	hurtbox = HurtboxComponent.new()
	hurtbox.name = "Hurtbox"
	hurtbox.bind_health(health)
	# 在 _init 挂树而非 _ready：冒烟测试里实体常由 main 树外驱动，_ready 不执行，
	# 会导致 hurtbox 成为孤儿节点（OS 泄漏）。_init 挂树对入树场景同样安全。
	# 注意：必须真的 add_child，只 new 出来不挂树 = 永久孤儿（ObjectDB 泄漏）。
	add_child(hurtbox)


func _ready() -> void:
	pass


## 外部驱动推进：DoT 结算 + 死亡重生计时。
func tick(dt: float) -> void:
	if health.is_dead():
		if _respawn_timer > 0.0:
			_respawn_timer -= dt
			if _respawn_timer <= 0.0:
				respawn()
		return
	dot_ticker.advance(dt)


func _on_dot_tick(amount: float, _dot: DotInstance) -> void:
	health.apply_damage(amount)


func is_dead() -> bool:
	return health.is_dead()


## 由 SandboxMain 在死亡事件时调用：进入重生倒计时。
func start_respawn(wait: float) -> void:
	_respawn_timer = wait


func respawn() -> void:
	health.current_health = health.max_health
	_respawn_timer = 0.0


func radius() -> float:
	return _radius


func _draw() -> void:
	var body := Color(0.35, 0.6, 1.0) if is_player else Color(0.75, 0.7, 0.6)
	if health.is_dead():
		draw_arc(Vector2.ZERO, _radius, 0.0, TAU, 24, Color(0.9, 0.25, 0.25), 3.0)
		return
	draw_circle(Vector2.ZERO, _radius, body)
	draw_arc(Vector2.ZERO, _radius + 2.0, 0.0, TAU, 32, body.darkened(0.35), 2.0)
	# 迷你血条
	var frac := health.current_health / health.max_health
	draw_rect(Rect2(-_radius, -_radius - 10.0, _radius * 2.0, 4.0), Color(0.1, 0.1, 0.1))
	draw_rect(Rect2(-_radius, -_radius - 10.0, _radius * 2.0 * frac, 4.0), Color(0.2, 0.9, 0.2))
