# EffectPool（规格 §9.1 / §9.3）：特效对象池，硬上限 128，复用 emitting 开关。
#
# 为什么不用一次 instantiate 一次：粒子节点创建要走 RenderingServer 建缓冲，
# 战斗高潮时每秒几十次创建/销毁就是卡顿源。这里全部节点在启动时建好，
# 之后只改 position / modulate / restart()。
#
# 硬规则：
# - 节点数**永不增长**超过 cap；满了回收「最旧」的槽位（seq 最小），宁可掉视觉不掉帧
# - 到期由外部 advance(dt) 驱动（无 Timer 节点，与全项目时间推进口径一致）
# - 池只管生命周期，不认识任何业务（谁触发、什么颜色由调用方给）
class_name EffectPool
extends Node2D

const HARD_CAP := 128          # 规格 §9.3 建议值
const PREWARM := 16            # 启动预建（避免第一波战斗现建）
const DEFAULT_LIFETIME := 0.3
const DEFAULT_AMOUNT := 8      # 单次爆发的粒子数

var cap: int = HARD_CAP

var _nodes: Array = []                 # Array[GPUParticles2D]，下标即槽位
var _remaining := PackedFloat32Array() # > 0 表示占用中（剩余秒数）
var _seq_of := PackedInt32Array()      # 占用序号，用于「回收最旧」
var _free: Array[int] = []
var _used: int = 0
var _seq: int = 0


func _init(p_cap: int = HARD_CAP, p_prewarm: int = PREWARM) -> void:
	cap = clampi(p_cap, 1, 4096)
	_remaining.resize(cap)
	_remaining.fill(0.0)
	_seq_of.resize(cap)
	_seq_of.fill(0)
	prewarm(p_prewarm)


## 预建 n 个粒子节点（不发射）。重复调用只会补齐到 n。
func prewarm(n: int) -> void:
	var target := mini(n, cap)
	while _used < target:
		_create_slot(_used)
		_free.append(_used)
		_used += 1


## 在某点播一次爆发；返回槽位下标（-1 表示失败）。
## 满容量时回收最旧的槽位，不扩容。
func emit_at(pos: Vector2, tint: Color = Color.WHITE, lifetime: float = DEFAULT_LIFETIME) -> int:
	var i := -1
	if not _free.is_empty():
		i = int(_free.pop_back())
	elif _used < cap:
		i = _used
		_create_slot(i)
		_used += 1
	else:
		i = _oldest_slot()
		if i < 0:
			return -1
	var node: GPUParticles2D = _nodes[i]
	node.position = pos
	node.modulate = tint
	node.lifetime = maxf(lifetime, 0.05)
	node.restart()              # one_shot + explosiveness=1.0：restart 即发射一次
	node.emitting = true
	_seq += 1
	_seq_of[i] = _seq
	_remaining[i] = maxf(lifetime, 0.05)
	return i


## 到期回收（外部每帧调一次）
func advance(dt: float) -> void:
	for i in _used:
		if _remaining[i] <= 0.0:
			continue
		_remaining[i] -= dt
		if _remaining[i] <= 0.0:
			_remaining[i] = 0.0
			(_nodes[i] as GPUParticles2D).emitting = false
			_free.append(i)


func active_count() -> int:
	var n := 0
	for i in _used:
		if _remaining[i] > 0.0:
			n += 1
	return n


func node_count() -> int:
	return _used


func is_active(slot: int) -> bool:
	return slot >= 0 and slot < cap and _remaining[slot] > 0.0


func get_node_at(slot: int) -> GPUParticles2D:
	if slot < 0 or slot >= _used:
		return null
	return _nodes[slot]


## 全部立刻熄灭（切场景/测试用）
func clear_all() -> void:
	_free.clear()
	for i in _used:
		_remaining[i] = 0.0
		(_nodes[i] as GPUParticles2D).emitting = false
		_free.append(i)


func _oldest_slot() -> int:
	var best := -1
	var best_seq := 0x7FFFFFFF
	for i in _used:
		if _remaining[i] > 0.0 and _seq_of[i] < best_seq:
			best_seq = _seq_of[i]
			best = i
	return best


func _create_slot(i: int) -> void:
	var node := GPUParticles2D.new()
	node.name = "Fx%d" % i
	node.emitting = false
	node.one_shot = true
	node.amount = DEFAULT_AMOUNT
	node.lifetime = DEFAULT_LIFETIME
	node.explosiveness = 1.0
	node.local_coords = false       # 世界坐标：发射后不跟着父节点跑
	node.texture = _soft_dot()
	node.process_material = _burst_material()
	add_child(node)
	# 下标即槽位，节点顺序与数组必须严格对应
	if _nodes.size() <= i:
		_nodes.resize(i + 1)
	_nodes[i] = node


## 程序化软圆点（不依赖美术资源，与投射物共用同一套观感）
## 用静态缓存：128 个节点共享 1 张纹理 / 1 份粒子材质
static var _tex_cache: Texture2D = null
static var _mat_cache: ParticleProcessMaterial = null


func _soft_dot() -> Texture2D:
	if _tex_cache != null:
		return _tex_cache
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0))
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 32
	tex.height = 32
	_tex_cache = tex
	return tex


## 2D 爆发：无重力、向四周均匀散开、迅速减速
func _burst_material() -> ParticleProcessMaterial:
	if _mat_cache != null:
		return _mat_cache
	var mat := ParticleProcessMaterial.new()
	mat.particle_flag_rotate_y = false
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 3.0
	mat.direction = Vector3(1.0, 0.0, 0.0)
	mat.spread = 180.0
	mat.initial_velocity_min = 90.0
	mat.initial_velocity_max = 220.0
	mat.gravity = Vector3.ZERO
	mat.damping_min = 120.0
	mat.damping_max = 200.0
	mat.scale_min = 0.35
	mat.scale_max = 0.8
	_mat_cache = mat
	return mat
