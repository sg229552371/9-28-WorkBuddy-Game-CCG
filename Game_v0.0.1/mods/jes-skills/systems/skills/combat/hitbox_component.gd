# HitboxComponent（M4，规格 §10）：攻击判定框。
# 职责：持有出手快照 DamagePacket + 攻击方 StatsComponent；
# 命中 Hurtbox 时调用 DamageCalculator（纯函数）结算，再把 HitEvent 交给对方。
# 硬规则：本类不做任何数值计算（计算全部在 DamageCalculator）；
# 不认识具体宝石；对象池化归 M8（当前允许普通 instantiate，非热路径）。
class_name HitboxComponent
extends Area2D

var packet: DamagePacket = null
var attacker_stats: StatsComponent = null


## 结算一次命中并交给 hurtbox。
## rng 契约：`next_float(stream: StringName) -> float`（RngService 提供，§9.4 分流域）。
## 返回 HitEvent 字典（与 DamageCalculator.resolve 的返回一致）。
func strike(hurtbox, rng: Object, defender = null) -> Dictionary:
	# defender duck-type contract: must expose .stats: StatsComponent.
	# Fallback to hurtbox keeps old M4-era call sites working; new code should
	# pass the owning entity itself.
	var d = defender if defender != null else hurtbox
	var hit := DamageCalculator.resolve(packet, attacker_stats, d, rng)
	hurtbox.receive_hit(hit, self)
	return hit