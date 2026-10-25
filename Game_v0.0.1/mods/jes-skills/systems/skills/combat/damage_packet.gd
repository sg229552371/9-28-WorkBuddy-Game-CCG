# DamagePacket（规格 §10.1）：出手瞬间快照。
# 硬规则：只含数据，无 Node 引用；行进途中可被转换/增益改写，结算时交 DamageCalculator。
class_name DamagePacket
extends RefCounted

var elements: Dictionary = {}          # {&"physical": x, &"cold": y, ...}
var crit: bool = false
var crit_multi: float = 1.0
var tags: Array[StringName] = []       # 命中类型 tags（供触发器与异常判定）
var source_instance_id: StringName = &""
