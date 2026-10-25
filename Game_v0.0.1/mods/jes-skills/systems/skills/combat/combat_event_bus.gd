# CombatEventBus（规格 §7.1）：战斗事件单一总线。
# 全局唯一实例（autoload），触发系统据此驱动 trigger_cast。
# 本工程为纯数据管线：总线只承载信号，不做任何判定。
#
# 为什么每个信号都带 @warning_ignore("unused_signal")：
# 总线是**纯契约类** —— 信号在这里声明、在别处 emit / connect
# （sandbox_main.gd 发命中事件，TriggerManager 用 EVENT_SIGNALS 动态 connect）。
# GDScript 的未用信号警告只看「声明它的类自己有没有用」，契约类天然全中，
# 压警告不代表信号是死数据 —— 它们有 `test_m7_triggers.gd` 的 has_signal 断言兜底。
class_name CombatEventBus
extends RefCounted

@warning_ignore("unused_signal")
signal hit_landed(packet, target)
@warning_ignore("unused_signal")
signal crit_landed(packet, target)
@warning_ignore("unused_signal")
signal entity_killed(victim, killer)
@warning_ignore("unused_signal")
signal damage_taken(entity, packet)
@warning_ignore("unused_signal")
signal block_occurred(entity, packet)
@warning_ignore("unused_signal")
signal skill_cooldown_finished(instance)
