# 运行时修饰符实例（规格 §3.2）
# source_id 必填：卸下辅助石/装备时按 source_id 精确批量移除，
# 这是"卸下即还原"（G6）的唯一实现方式。
class_name StatModifier
extends RefCounted

enum Op { FLAT_ADD, INCREASED, MORE }

var stat: StringName = &""
var op: int = Op.FLAT_ADD
var value: float = 0.0
var source_id: StringName = &""
var channel_mask: int = SkillChannel.Channel.ALL
var require_tags: Array[StringName] = []
var exclude_tags: Array[StringName] = []
