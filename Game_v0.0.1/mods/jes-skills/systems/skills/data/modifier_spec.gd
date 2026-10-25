# ModifierSpec（规格 §3.2）：辅助宝石携带的静态词缀"规格"。
# 运行时注入时转换为 StatModifier（M1），source_id 由装配层填写。
class_name ModifierSpec
extends Resource

@export var stat: StringName = &""
@export var op: int = 0                       # StatModifier.Op
@export var value: float = 0.0
@export var channel_mask: int = SkillChannel.Channel.ALL
@export var require_tags: Array[StringName] = []   # 全部命中才生效（AND）
@export var exclude_tags: Array[StringName] = []   # 命中任一即失效


## 转换为运行时 StatModifier（不设 source_id，由注入方填写）
func to_modifier() -> StatModifier:
	var m := StatModifier.new()
	m.stat = stat
	m.op = op
	m.value = value
	m.channel_mask = channel_mask
	m.require_tags = require_tags.duplicate()
	m.exclude_tags = exclude_tags.duplicate()
	return m
