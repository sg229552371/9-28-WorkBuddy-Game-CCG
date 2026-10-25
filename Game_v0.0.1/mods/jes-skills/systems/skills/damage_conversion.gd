# 伤害转换声明（规格 §4.3）
# 语义：from_element 的 ratio 比例转换为 to_element。
# 多源对同一目标相加；总和超 100% 按比例归一化；禁止链式二次转换。
class_name DamageConversion
extends RefCounted

var from_element: StringName = &""
var to_element: StringName = &""
var ratio: float = 0.0


func _init(p_from: StringName = &"", p_to: StringName = &"", p_ratio: float = 0.0) -> void:
	from_element = p_from
	to_element = p_to
	ratio = p_ratio
