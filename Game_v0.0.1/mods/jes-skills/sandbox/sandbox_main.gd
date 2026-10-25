# 沙盒主控（S3）：程序化搭建玩家 + 木桩 + 技能栏，把整套运行时串成闭环。
# 施法链路：SocketGraph.assemble → 注入 modifiers → 消耗 → 冷却 → SkillExecutor.cast
#         → 行为计划 → 演出（投射物/近战/范围/引导/冲刺/buff/召唤）→ 命中结算 → 事件总线
# 硬门禁：无 gem_id 运行时分支（行为分派读计划 behavior_id）；无 Timer 节点；
#         RNG 注入（种子固定，确定性可回放）。
class_name SandboxMain
extends Node2D

const RNG_SEED := 20261019
const PLAYER_START := Vector2(300, 300)
const STUMP_SPACING := Vector2(0, 110)
const STUMP_START := Vector2(700, 190)
const RESPAWN_WAIT := 2.0
const MANA_MAX := 200.0
const MANA_REGEN_PER_SEC := 20.0
const AUTO_CAST_INTERVAL := 1.0   # 自动施法周期（实验台勾选框控制）
const ACTIVE_SLOT_COUNT := 9
# 演示槽位编排：0~8 号槽位各自对应的技能（D-33 起不再绑按键，Q 统一放槽 0）。
# 只影响"哪个槽放哪个技能"，不影响任何结算逻辑。
# 这是演示层**唯一**允许出现具体宝石 id 的地方（内容编排表），运行时代码一律经
# GemRegistry 按 id 取内容，不得在分支里判 id（规格 §13.1 第 1 条）。
# 槽 8 = 落烬环（FLY·RING·ZONE 首格）：空心环判定，用来在沙盒里肉眼验收环形。
const DEMO_SLOT_ORDER: Array[StringName] = [
	&"frost_shard", &"fire_burst", &"lightning_slash", &"chaos_beam",
	&"shadow_dash", &"berserk", &"spirit_summon", &"frost_nova",
	&"ring_of_cinders",
]
# 槽 0 预挂的双辅助（演示 G5/G6 装配链路）：霜矛为 projectile+cold，两颗均兼容；
# cost = 10 × 1.4 × 1.2 = 16.8。同属内容编排，集中在此处便于查阅。
const DEMO_SLOT0_SUPPORTS: Array[StringName] = [&"support_multi", &"support_cold_focus"]
const SOCKET_COUNT := 6        # 孔位上限（规格首版 4~6，实验台统一 6）
const PROJECTILE_CAP := 512    # 投射物硬上限（规格 §9.3）
const PROJECTILE_TINT := Color(0.62, 0.86, 1.0)
const MELEE_FX_TINT := Color(1.0, 0.82, 0.42)

# 行为分派只认计划里的 behavior_id（数据驱动，与宝石无关）
const BEHAVIOR_HANDLERS := {
	&"bhv_projectile": &"_exec_projectile",
	&"bhv_melee_swing": &"_exec_melee",
	&"bhv_aoe_burst": &"_exec_aoe",
	&"bhv_channel": &"_exec_channel",
	&"bhv_dash": &"_exec_dash",
	&"bhv_buff_self": &"_exec_buff",
	&"bhv_summon": &"_exec_summon",
}

# 战斗随机统一走 RngService（规格 §9.4）：分流域 + 同 seed 可回放。
# 不再用 RandomNumberGenerator —— 后者无处安放"流派"语义，改特效会移动战斗序列。
var rng := RngService.new(RNG_SEED)
var bus := CombatEventBus.new()

var player: SandboxEntity = null
var stumps: Array = []          # Array[SandboxEntity]
var entities: Array = []        # Array[SandboxEntity]（玩家 + 木桩，投射物目标列表）

var mana := ResourcePool.new()
var slot_bar := SkillSlotBar.new()
var cooldowns: Array = []       # Array[CooldownComponent]，与槽位对齐
var trigger_mgr := TriggerManager.new()

var projectile_field := ProjectileField.new(PROJECTILE_CAP)
var target_hash := SkillSpatialHash.new(64.0)
var projectile_layer: SandboxProjectileLayer = null
var aoe_layer: SandboxAoeLayer = null        # AoE 落地区域可视化（纯表现，D-31）
var fx_layer: SandboxFxLayer = null          # 瞬态特效层：近战挥砍/引导光束/冲刺轨迹/buff 光环（纯表现，D-32）
var effect_pool: EffectPool = null
var _max_target_radius: float = 24.0

# 兼容旧读数：HUD/测试历史上读 projectile_pool，语义转到 SoA 容器内部的池
var projectile_pool: ProjectilePool:
	get:
		return projectile_field.pool

# 进行中效果状态
var _pending_aoe: Array = []    # {fire_at, radius, elements, tags}
# D-50 FLY 复合落点结算：同一技能里「投射段 → 爆发段」相邻两条 plan，
# 投射段把自己的弹下标登记在这里，紧随其后的爆发段认领它并改为锚定模式。
var _pending_launch_idx: int = -1
## 最近一次范围结算实际使用的中心点（D-50）：演出/测试用它确认「爆心=弹体落点」。
var last_burst_center: Vector2 = Vector2.ZERO
var _channel: Dictionary = {}   # {tick_times, next_idx, plan, start_at}
var _dash: Dictionary = {}      # {remaining, dir, speed, plan, hit_cd}
var _buffs: Array = []          # {until, mods, source_id}
var _fx: Array = []             # 瞬态特效 {kind, born_at, ttl, ...}，只给表现层读，tick 里剪枝
var minions := MinionRegistry.new()   # 召唤物数据层（§8.2：子集继承 / 顶掉最旧 / 寿命）
var _elapsed: float = 0.0
var _hud = null                 # SandboxHud（可选）

# 自动施法（实验台勾选框）：每 AUTO_CAST_INTERVAL 秒对槽 0 调一次 try_cast
var auto_cast: bool = false
var _auto_cast_timer: float = 0.0
var cast_count: int = 0          # 成功施放次数（实验台/测试观测用）


func _ready() -> void:
	_build_entities()
	_build_skills()
	_build_projectile_layer()
	trigger_mgr.bus = bus
	trigger_mgr._ready()
	trigger_mgr.trigger_cast_requested.connect(_on_trigger_cast)
	# 默认勾选自动施法（D-33 用户裁定）：实验台配置好技能就持续开火，
	# 手动施法统一按 Q。只改运行场景默认值；测试里直接 new 的实例不受影响。
	set_auto_cast(true)
	# 总线演出观测（HUD 计数）
	var hud := get_node_or_null("Hud/HudView")
	if hud != null:
		_hud = hud
		_hud.main = self
	# 装配实验台（技能下拉 + 辅助多选）
	var lab := get_node_or_null("Hud/Lab")
	if lab != null:
		lab.bind(self)


## 玩家 + 三种木桩（普通 / 50% 全抗 / 200 护甲）
func _build_entities() -> void:
	if effect_pool == null:
		# 挂在 _build_entities 而不是 _ready：冒烟测试不走 _ready，
		# 不 add_child 的话 128 个粒子节点会变成孤儿（ObjectDB 泄漏）
		effect_pool = EffectPool.new()
		effect_pool.name = "Effects"
		effect_pool.z_index = 6
		add_child(effect_pool)
	player = SandboxEntity.new("player", true)
	player.position = PLAYER_START
	add_child(player)
	entities.append(player)
	player.hurtbox.owner_died.connect(_on_entity_died.bind(player))

	var stump_defs := [
		{"name": "stump_plain", "mods": []},
		{"name": "stump_resist", "mods": [
			{"stat": &"fire_resistance", "op": 0, "value": 50.0},
			{"stat": &"cold_resistance", "op": 0, "value": 50.0},
			{"stat": &"lightning_resistance", "op": 0, "value": 50.0},
			{"stat": &"chaos_resistance", "op": 0, "value": 50.0},
		]},
		{"name": "stump_armor", "mods": [
			{"stat": &"armor", "op": 0, "value": 200.0},
		]},
	]
	for i in stump_defs.size():
		var def: Dictionary = stump_defs[i]
		var e := SandboxEntity.new(def["name"], false)
		e.position = STUMP_START + STUMP_SPACING * float(i)
		add_child(e)
		var idx := 0
		for m in def["mods"]:
			var mod := StatModifier.new()
			mod.stat = m["stat"]
			mod.op = m["op"]
			mod.value = m["value"]
			mod.source_id = StringName("stump_def_%d" % idx)
			e.stats.add_modifier(mod)
			idx += 1
		stumps.append(e)
		entities.append(e)
		e.hurtbox.owner_died.connect(_on_entity_died.bind(e))
	# 邻域查询半径 = 投射物半径 + 最大目标半径，进攻时用它算覆盖格数
	for e in entities:
		_max_target_radius = maxf(_max_target_radius, e.radius())


## 批量绘制层：整个沙盒只有 1 个 MultiMeshInstance2D（规格 §9.1）
func _build_projectile_layer() -> void:
	projectile_layer = SandboxProjectileLayer.new()
	projectile_layer.name = "ProjectileLayer"
	projectile_layer.z_index = 5
	add_child(projectile_layer)
	projectile_layer.setup(projectile_field, PROJECTILE_TINT)
	# AoE 区域绘制层（D-31 表现债）：环/实心圆落地区域可视化，纯表现不参与判定
	aoe_layer = SandboxAoeLayer.new()
	aoe_layer.name = "AoeLayer"
	aoe_layer.z_index = 4
	aoe_layer.main = self
	add_child(aoe_layer)
	# 瞬态特效层（D-32 表现债）：近战弧光 / 引导光束 / 冲刺轨迹 / buff 光环
	fx_layer = SandboxFxLayer.new()
	fx_layer.name = "FxLayer"
	fx_layer.z_index = 6
	fx_layer.main = self
	add_child(fx_layer)


## 7 个主动槽（0~6 演示技能）+ 槽 7（触发器专用雷光斩复制）+ 演示辅助/触发器
func _build_skills() -> void:
	mana.set_max(&"mana", MANA_MAX)
	mana.set_current(&"mana", MANA_MAX)

	# 槽位编排只属于沙盒：决定 0~8 号槽各放哪个技能。
	# 这是"内容编排列表"，不是运行时分支 —— 装配、消耗、施法都与具体 id 无关。
	# 不能依赖 GemRegistry.skills() 的返回顺序：那是按 id 排序的，改个文件名就会
	# 把冰系辅助装到火技能上，触发 G7 整组拒绝（本文件 R5 就踩过这一下）。
	for i in mini(ACTIVE_SLOT_COUNT, DEMO_SLOT_ORDER.size()):
		_bind_skill_slot(i, GemRegistry.skill(DEMO_SLOT_ORDER[i]))

	# 槽 0 挂多重投射 + 寒冰聚焦双辅助（演示 G5/G6 装配链路 + stat_modifiers 注入链路）
	var slot0 := slot_bar.get_slot(0)
	for sid in DEMO_SLOT0_SUPPORTS:
		slot0.supports.append(GemRegistry.support(sid))

	# 演示触发器：暴击 → 施放槽 7
	trigger_mgr.add_trigger(GemRegistry.trigger(&"on_crit"))


func _bind_skill_slot(index: int, skill: SkillData) -> void:
	var slot := SkillSlot.new()
	slot.slot_index = index
	slot.active_gem = skill
	slot.active_level = 1
	slot.socket_count = SOCKET_COUNT
	slot_bar.bind_slot(index, slot)
	var cd := CooldownComponent.new()
	cd.configure(skill.base_cooldown, 1.0, skill.max_charges, skill.charge_recharge_time)
	cooldowns.append(cd)
	# 冷却挂到实例上：实例负责「装配 → 冷却 → 出计划」（§5.3），
	# cooldowns 数组保留只是为了 HUD/测试按槽读取，与实例共用同一对象
	slot_bar.instance_of(index, cd)


## 实验台入口：把「技能 + 辅助宝石集合」写入槽 0，并同步冷却/充能参数。
## 只改数据，装配与结算仍走 SocketGraph / SkillExecutor 通用管线。
func apply_lab_loadout(gem: SkillData, supports: Array) -> void:
	if gem == null:
		return
	var slot := slot_bar.get_slot(0)
	if slot == null:
		return
	slot.active_gem = gem
	slot.active_level = 1
	slot.supports.clear()
	for s in supports:
		slot.supports.append(s)
	slot.socket_count = SOCKET_COUNT
	var cd0: CooldownComponent = null
	if cooldowns.size() > 0:
		cd0 = cooldowns[0]
		cd0.configure(gem.base_cooldown, 1.0, gem.max_charges, gem.charge_recharge_time)
	# 换技能 = 配置变了：丢弃实例的装配缓存，下次施法重新装配
	var inst := slot_bar.instance_of(0, cd0)
	if inst != null:
		inst.discard_assembly()


# ---------------- 输入 ----------------

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key: InputEventKey = event
		# D-33 输入简化：不再按 1~9 选槽，Q 统一施放实验台当前配置（槽 0）；
		# R 全体木桩回满血。触发器链路（槽 7）走 TriggerManager，不经按键。
		if key.physical_keycode == KEY_Q:
			try_cast(0)
		elif key.physical_keycode == KEY_R:
			for s in stumps:
				s.respawn()


# ---------------- 施法主链路 ----------------

## 完整施法流程：装配 → 注词缀 → 消耗/冷却 → 计划 → 执行。供按键与触发器共用。
func try_cast(slot_index: int) -> bool:
	var slot := slot_bar.get_slot(slot_index)
	if slot == null or slot.active_gem == null:
		return false
	var skill: SkillData = slot.active_gem

	# 实例由槽位派生（§5.3）：一槽一实例，实例不复制槽数据
	var inst := slot_bar.instance_of(slot_index, cooldowns[slot_index])
	if inst == null or not inst.is_ready():
		return false

	# ① 装配（实例内走装配缓存；配置没变直接复用，§5.2 第 5 条）
	var res := inst.begin()
	if res == null or not res.ok:
		return false
	# ② 辅助词缀注入（source_id = 槽位，卸下即还原）
	var source_id := StringName("slot_%d" % slot_index)
	player.stats.add_modifiers(res.modifiers, source_id)

	# ③ 消耗判定（资源不足不进入 cast，规格 §8.3）
	var cost := CostCalculator.compute_cost(skill, res.cost_multiplier, 1.0)
	if not mana.can_afford(&"mana", cost):
		player.stats.remove_by_source(source_id)
		return false
	mana.spend(&"mana", cost)

	# ④ 冷却/充能消耗（实例持有）
	inst.commit()

	# ⑤ 出手结算 → 行为计划
	var plans := inst.cast_plans(player.stats)
	player.stats.remove_by_source(source_id)

	# ⑥ 执行计划（演出层）
	# D-50：先清零「本帧投射段首发的下标」，供紧随其后的爆发段认领（成对施放时两段同帧执行）
	_pending_launch_idx = -1
	for plan in plans:
		_execute_plan(plan)
	cast_count += 1
	return true


func _execute_plan(plan: Dictionary) -> void:
	var behavior: StringName = plan.get(&"behavior_id", &"")
	var handler: StringName = BEHAVIOR_HANDLERS.get(behavior, &"")
	if handler != &"":
		call(handler, plan)


# ---------------- 各行为执行（只读计划，不认识宝石） ----------------

func _nearest_stump_pos() -> Vector2:
	# AOE 落点对准最近的存活木桩；无目标时回退玩家右前方 120px
	for t in stumps:
		if not t.is_dead():
			return t.global_position
	return player.global_position + Vector2.RIGHT * 120.0


func _aim_angle() -> float:
	# 朝最近存活木桩瞄准；无目标则朝右
	var best: SandboxEntity = null
	var best_d := INF
	for t in stumps:
		if t.is_dead():
			continue
		var d: float = t.global_position.distance_to(player.global_position)
		if d < best_d:
			best_d = d
			best = t
	if best == null:
		return 0.0
	return (best.global_position - player.global_position).angle()


func _exec_projectile(plan: Dictionary) -> void:
	var launch := BhvProjectile.plan_to_launch(plan)
	# SkillExecutor 已把多发拆成「每发一个 plan」，所以这里只出 1 发，
	# 位置/速度/寿命/半径全部来自计划（数据驱动，不看宝石）
	var angle := _aim_angle() + deg_to_rad(float(launch[&"angle_deg"]))
	var is_orbit: bool = String(launch[&"motion"]) == &"orbit"
	var spawn_pos := player.global_position
	var dir := Vector2.RIGHT.rotated(angle)
	if is_orbit:
		# D-36 环绕弹：出生在环上（angle_deg 已由 SkillExecutor 均布），初速取切向
		spawn_pos = player.global_position \
				+ Vector2.RIGHT.rotated(angle) * float(launch[&"orbit_radius"])
		dir = Vector2.RIGHT.rotated(angle + PI * 0.5)
	var idx := projectile_field.spawn(
			spawn_pos,
			dir,
			float(launch[&"speed"]),
			float(launch[&"lifetime"]),
			float(launch[&"radius"]),
			int(launch[&"pierce"]),
			_make_packet(plan),
			player,
			player.stats,
			int(launch[&"chain"]),
			int(launch[&"fork"]))
	if is_orbit and idx >= 0:
		projectile_field.configure_orbit(idx, float(launch[&"orbit_radius"]), true)
	# D-50：登记本发弹的下标，供同一技能里的爆发段认领（做「飞到落点再爆」）
	_pending_launch_idx = idx


func _exec_melee(plan: Dictionary) -> void:
	var swing := BhvMeleeSwing.plan_to_swing(plan)
	var aim := _aim_angle()
	var half := deg_to_rad(float(swing[&"arc_deg"])) / 2.0
	var rng_len := float(swing[&"range"])
	# 瞬态弧光（D-32）：0.18s 淡出，纯表现
	_fx.append({
		&"kind": &"melee_arc", &"born_at": _elapsed, &"ttl": 0.18,
		&"center": player.global_position,
		&"angle": aim, &"half": half, &"range": rng_len,
	})
	var packet := _make_packet(plan)
	for t in stumps:
		if t.is_dead():
			continue
		var to_t: Vector2 = t.global_position - player.global_position
		if to_t.length() > rng_len + t.radius():
			continue
		if absf(angle_difference(aim, to_t.angle())) > half:
			continue
		_strike(packet, t)


func _exec_aoe(plan: Dictionary) -> void:
	var burst := BhvAoeBurst.plan_to_burst(plan)
	# D-50：若紧跟在一发投射物之后（复合技能的爆发段），爆发中心改锚定到「弹体消亡点」，
	# 而不是像纯瞬时技能那样立刻瞄准最近目标。认领后清空，避免后续段误用。
	var anchor_idx := _pending_launch_idx
	_pending_launch_idx = -1
	var is_anchored := anchor_idx >= 0
	var center: Vector2 = player.global_position + Vector2.RIGHT.rotated(_aim_angle()) \
			* player.global_position.distance_to(_nearest_stump_pos())
	for fire_time in burst[&"hits"]:
		var entry := {
			&"fire_at": _elapsed + float(fire_time),
			&"radius": float(burst[&"radius"]),
			&"inner_radius": float(burst.get(&"inner_radius", 0.0)),
			&"center": center,
			&"plan": plan,
		}
		if is_anchored:
			# 锚定模式：fire_at 无意义（弹可能提前撞爆或飞满寿命），等弹消亡再结算
			entry[&"anchor_proj"] = anchor_idx
			entry[&"fire_at"] = INF
		_pending_aoe.append(entry)


func _exec_channel(plan: Dictionary) -> void:
	var ch := BhvChannel.plan_to_channel(plan)
	_channel = {
		&"tick_times": ch[&"ticks"],
		&"next_idx": 0,
		&"plan": plan,
		&"start_at": _elapsed,
		&"beam_len": 400.0,   # 与 _tick_channel 的判定长度同一数值（表现 ≠ 判定真源，改判定要两处同步）
	}


func _exec_dash(plan: Dictionary) -> void:
	var dash := BhvDash.plan_to_dash(plan)
	_dash = {
		&"remaining": float(dash[&"move_time"]),
		&"speed": float(dash[&"speed"]),
		&"dir": Vector2.RIGHT.rotated(_aim_angle()),
		&"plan": plan,
		&"has_path_damage": dash[&"has_path_damage"],
		&"start_pos": player.global_position,   # 冲刺轨迹可视化的起点（D-32）
	}


func _exec_buff(plan: Dictionary) -> void:
	var buff := BhvBuffSelf.plan_to_buff(plan)
	var source_id := StringName("buff_%f" % _elapsed)
	player.stats.add_modifiers(_dicts_to_modifiers(buff[&"buff_mods"]), source_id)
	_buffs.append({&"until": _elapsed + float(buff[&"duration"]), &"source_id": source_id})


func _exec_summon(plan: Dictionary) -> void:
	var s := BhvSummon.plan_to_summon(plan)
	var max_count := int(s[&"max_count"])
	if max_count <= 0:
		return
	# 一次施法召唤 1 只；上限由 MinionRegistry 管理（§8.2「到达上限顶掉最旧的」）
	var idx := int(rng.next_range_float(RngService.STREAM_SPAWN, 0.0, 1000.0))
	var entity := SandboxEntity.new("minion_%d" % idx, false, 12.0)
	entity.position = player.global_position + Vector2(-48.0, -24.0 + 16.0 * float(minions.active_count() % 4))
	add_child(entity)

	# skill 传 null = 本 registry 内全部召唤物统一计数（"最多 N 只"语义）
	var res := minions.spawn(player.stats, null, 1, float(s[&"lifetime"]), max_count, entity)
	var rec = res[&"record"]
	# ① 只继承 minion_* 子集（§8.2），不继承施法者全部属性
	entity.stats = rec.stats

	# ③ 被顶掉的旧召唤物：数据层已移除，表现层在这里释放
	for old in res[&"evicted"]:
		var node = old.payload
		if node != null and is_instance_valid(node):
			node.free()


# ---------------- 命中与事件 ----------------

func _make_packet(plan: Dictionary) -> DamagePacket:
	var packet := DamagePacket.new()
	packet.elements = plan.get(&"elements", {})
	packet.tags = plan.get(&"tags", [])
	packet.source_instance_id = &"sandbox"
	return packet


## 命中闭环：Hitbox.strike → DamageCalculator.resolve → receive_hit → 扣血 + 总线广播。
func _strike(packet: DamagePacket, target: SandboxEntity) -> Dictionary:
	var hitbox := HitboxComponent.new()
	hitbox.packet = packet
	hitbox.attacker_stats = player.stats
	# DamageCalculator defender 契约要求传含 .stats 的实体本身（hurtbox 只负责收伤）
	var hit := hitbox.strike(target.hurtbox, rng, target)
	hitbox.free()
	# 命中反馈：近战/范围/引导/冲刺共用这一个出口（投射物走 ProjectileField 自己的）
	if effect_pool != null:
		effect_pool.emit_at(target.global_position, MELEE_FX_TINT)
	# 总线事件（触发器链路的数据源）：命中 + 暴击
	bus.hit_landed.emit(packet, target)
	if hit.get(&"crit", false):
		bus.crit_landed.emit(packet, target)
	return hit


## 木桩死亡：总线击杀事件 + 定时重生。
func _on_entity_died(e: SandboxEntity) -> void:
	if e == player:
		return   # 玩家死亡本沙盒不做失败结算，只标记
	bus.entity_killed.emit(e, null)
	e.start_respawn(RESPAWN_WAIT)


func _on_trigger_cast(slot_index: int) -> void:
	try_cast(slot_index)


# ---------------- 主循环驱动（统一 tick，无 Timer 节点） ----------------

func _process(delta: float) -> void:
	tick(delta)


## 实验台入口：开关自动施法（立即重置计时，勾上后下一帧就放一次）
func set_auto_cast(on: bool) -> void:
	auto_cast = on
	_auto_cast_timer = 0.0


func tick(dt: float) -> void:
	_elapsed += dt
	# 回蓝（简单线性回蓝，演示资源系统）
	mana.set_current(&"mana", mana.get_current(&"mana") + MANA_REGEN_PER_SEC * dt)
	# 自动施法（冷却/资源门禁仍由 try_cast 内部判定，失败就等下一拍）
	if auto_cast:
		_auto_cast_timer += dt
		if _auto_cast_timer >= AUTO_CAST_INTERVAL:
			_auto_cast_timer -= AUTO_CAST_INTERVAL
			try_cast(0)
	# 冷却推进
	for cd in cooldowns:
		cd.advance(dt)
	# 触发器推进
	trigger_mgr.advance(dt)
	# 实体推进（DoT / 重生）
	for e in entities:
		e.tick(dt)
	# 投射物推进：先重建目标网格（O(n)），再让 SoA 批量推进（哈希邻域，非 O(m×n)）
	_rebuild_target_hash()
	projectile_field.tick(dt, target_hash, _max_target_radius, entities, rng)
	if projectile_layer != null:
		projectile_layer.sync()
	if effect_pool != null:
		# 投射物命中点交给特效池（演出与结算分离：这边只读 last_hit_points）
		for hp in projectile_field.last_hit_points:
			effect_pool.emit_at(hp, PROJECTILE_TINT)
		effect_pool.advance(dt)
	_tick_aoe(dt)
	_tick_channel()
	_tick_dash(dt)
	_tick_buffs()
	_tick_fx()
	_tick_summons(dt)


## 每帧重建目标网格。id 用 entities 下标：下标稳定，查询回来的 id 可直接索引
func _rebuild_target_hash() -> void:
	target_hash.clear()
	for i in entities.size():
		target_hash.insert(i, entities[i].global_position)


func _tick_aoe(_dt: float) -> void:
	var remaining: Array = []
	for a in _pending_aoe:
		var center: Vector2 = a[&"center"]
		var ready := _elapsed >= float(a[&"fire_at"])
		if a.has(&"anchor_proj"):
			# D-50 锚定模式：弹还在飞 → 冻结等待（爆发段不提前落地）；
			# 弹一消亡 → 取其最后位置作为爆发中心，当帧立即结算。
			var snap := projectile_field.snapshot(int(a[&"anchor_proj"]))
			if snap[&"alive"]:
				remaining.append(a)
				continue
			center = snap[&"pos"]
			ready = true
		if ready:
			last_burst_center = center   # D-50：记录本次结算中心，供测试断言「爆心=落点」
			var packet := _make_packet(a[&"plan"])
			for t in stumps:
				if not t.is_dead() and BhvAoeBurst.hits_ring(
						center, t.global_position, t.radius(),
						float(a[&"radius"]), float(a[&"inner_radius"])):
					_strike(packet, t)
		else:
			remaining.append(a)
	_pending_aoe = remaining


func _tick_channel() -> void:
	if _channel.is_empty():
		return
	var times: Array = _channel[&"tick_times"]
	var idx := int(_channel[&"next_idx"])
	var start: float = _channel[&"start_at"]
	while idx < times.size() and _elapsed - start >= float(times[idx]):
		# 每 tick 沿引导方向做一次小范围判定
		var packet := _make_packet(_channel[&"plan"])
		var beam_end: Vector2 = player.global_position + Vector2.RIGHT.rotated(_aim_angle()) * 400.0
		for t in stumps:
			if t.is_dead():
				continue
			# 点到线段距离
			var closest: Vector2 = _closest_point(player.global_position, beam_end, t.global_position)
			if closest.distance_to(t.global_position) <= t.radius() + 10.0:
				_strike(packet, t)
		idx += 1
	_channel[&"next_idx"] = idx
	if idx >= times.size():
		_channel = {}


func _tick_dash(dt: float) -> void:
	if _dash.is_empty():
		return
	var step: float = float(_dash[&"speed"]) * dt
	player.global_position += Vector2(_dash[&"dir"]) * step
	_dash[&"remaining"] = float(_dash[&"remaining"]) - dt
	# 冲刺残影（D-32）：每帧一枚小残影，0.25s 淡出，纯表现
	_fx.append({
		&"kind": &"dash_ghost", &"born_at": _elapsed, &"ttl": 0.25,
		&"pos": player.global_position, &"radius": player.radius(),
	})
	if bool(_dash[&"has_path_damage"]):
		var packet := _make_packet(_dash[&"plan"])
		for t in stumps:
			if not t.is_dead() \
					and t.global_position.distance_to(player.global_position) <= 40.0 + t.radius():
				_strike(packet, t)
	if float(_dash[&"remaining"]) <= 0.0:
		_dash = {}


func _tick_buffs() -> void:
	var remaining: Array = []
	for b in _buffs:
		if _elapsed < float(b[&"until"]):
			remaining.append(b)
		else:
			player.stats.remove_by_source(b[&"source_id"])
	_buffs = remaining


## 瞬态特效剪枝（D-32）：只管生命周期，画什么由 SandboxFxLayer 决定
func _tick_fx() -> void:
	var remaining: Array = []
	for fx in _fx:
		if _elapsed - float(fx[&"born_at"]) < float(fx[&"ttl"]):
			remaining.append(fx)
	_fx = remaining


func _tick_summons(dt: float) -> void:
	# 寿命到期回收：数据层返回过期记录，表现层按 payload 释放
	for rec in minions.tick(dt):
		var node = rec.payload
		if node != null and is_instance_valid(node):
			# 冒烟测试中 main 常在树外驱动，queue_free 不生效，演示层统一用 free()
			node.free()


# ---------------- 工具 ----------------

func _closest_point(a: Vector2, b: Vector2, p: Vector2) -> Vector2:
	var ab := b - a
	var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 0.0001), 0.0, 1.0)
	return a + ab * t


func _dicts_to_modifiers(arr: Array) -> Array:
	var out: Array = []
	for d in arr:
		var m := StatModifier.new()
		m.stat = d.get(&"stat", &"")
		m.op = int(d.get(&"op", 0))
		m.value = float(d.get(&"value", 0.0))
		out.append(m)
	return out
