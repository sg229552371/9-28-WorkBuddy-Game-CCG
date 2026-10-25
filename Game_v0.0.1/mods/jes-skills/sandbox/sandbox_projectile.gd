# 沙盒投射物（S3）：消费 ProjectilePool 槽位的可视化投射物。
# ⚠️ 已被 M8 的 ProjectileField（SoA）+ SandboxProjectileLayer（MultiMesh）取代，
#    场景不再使用本类，留作「每发一个 Node2D」的对照实现，勿在新代码里引用。
# 几何命中（点-圆距离判定），不依赖物理引擎；伤害结算仍走 HitboxComponent 通用闭环。
# 硬门禁：无 gem_id 分支；无 Timer 节点；时间推进由外部 tick(dt) 驱动。
class_name SandboxProjectile
extends Node2D

const HIT_COOLDOWN_SEC := 0.1   # 同一投射物对同一目标的最小重复命中间隔

var speed: float = 900.0
var lifetime: float = 1.2
var radius: float = 12.0
var direction: Vector2 = Vector2.RIGHT
var packet: DamagePacket = null
var attacker_stats: StatsComponent = null
var attacker: Node = null        # 发射者本体（tick 中跳过，防止出生即自伤）
var pierce: int = 0
var pool: ProjectilePool = null
var slot: ProjectileSlot = null
var hitbox: HitboxComponent = null

var _age: float = 0.0
# target_id -> 剩余禁止命中时间（防一帧内重复结算）
var _hit_cooldowns: Dictionary = {}


func setup(p_packet: DamagePacket, p_attacker_stats: StatsComponent,
		p_pool: ProjectilePool, p_pierce: int) -> void:
	packet = p_packet
	attacker_stats = p_attacker_stats
	pool = p_pool
	pierce = p_pierce
	slot = pool.acquire()
	hitbox = HitboxComponent.new()
	hitbox.packet = packet
	hitbox.attacker_stats = attacker_stats
	# 注意：不在这里重置 position —— 出生点由演示层在 setup 前后自行指定，
	# 否则会把 _exec_projectile 先设好的 global_position 抹成 (0,0)。


## 外部驱动：移动 + 寿命 + 几何命中检测。
## targets: Array[SandboxEntity]（存活实体）；rng: 注入的 RNG。
func tick(dt: float, targets: Array, rng: Object) -> void:
	if slot == null:
		return
	_age += dt
	position += direction * speed * dt
	# 命中冷却倒数
	for k in _hit_cooldowns.keys():
		_hit_cooldowns[k] = float(_hit_cooldowns[k]) - dt
		if float(_hit_cooldowns[k]) <= 0.0:
			_hit_cooldowns.erase(k)
	# 几何命中：点-圆距离
	for t in targets:
		if t == attacker:
			continue   # 不与发射者自身判定
		if t.is_dead():
			continue
		var tid: int = t.get_instance_id()
		if _hit_cooldowns.has(tid):
			continue
		var to_t: Vector2 = t.global_position - global_position
		if to_t.length() <= radius + t.radius():
			# defender 契约：必须传带 .stats 的实体本身（与 SandboxMain._strike 一致）
			var hit: Dictionary = hitbox.strike(t.hurtbox, rng, t)
			_hit_cooldowns[tid] = HIT_COOLDOWN_SEC
			# 未穿透即消亡
			if pierce <= 0:
				retire()
				return
			pierce -= 1
	if _age >= lifetime:
		retire()


func retire() -> void:
	if slot != null and pool != null:
		pool.release(slot)
		slot = null
	if hitbox != null:
		hitbox.free()
		hitbox = null


func is_active() -> bool:
	return slot != null


func _draw() -> void:
	if not is_active():
		return
	draw_circle(Vector2.ZERO, radius, Color(0.6, 0.85, 1.0, 0.9))
	draw_arc(Vector2.ZERO, radius, 0.0, TAU, 16, Color(1, 1, 1, 0.8), 1.5)
