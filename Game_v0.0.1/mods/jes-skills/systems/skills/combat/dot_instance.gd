# DotInstance（规格 §8.1）：一个异常效果的独立实例。
# 硬规则：纯数据，每层独立计时（中毒可叠层）；快照在施加瞬间固定，不吃后续增益。
class_name DotInstance
extends RefCounted

var ailment_type: StringName = &""
var dps: float = 0.0              # 施加瞬间快照：base × coeff
var tick_damage: float = 0.0      # dps × ticker 网格
var duration: float = 0.0
var remaining: float = 0.0
var next_tick_at: float = 0.0     # 相对下一 tick 的倒计时（网格对齐）
