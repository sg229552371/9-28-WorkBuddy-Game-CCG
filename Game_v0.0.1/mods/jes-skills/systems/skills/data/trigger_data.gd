# TriggerData（规格 §3.4）：触发器数据单一真源。
# event: &"on_hit" &"on_crit" &"on_kill" &"on_take_damage" &"on_block" &"on_cooldown_end" &"on_interval"
class_name TriggerData
extends Resource

@export var event: StringName = &""
@export var chance: float = 1.0
@export var cooldown: float = 0.0
@export var interval: float = 0.0   # 仅 on_interval 使用
## 触发后要施放的**目标槽**（不是触发源槽）。`TriggerManager._fire()` 直接拿它 emit
## `trigger_cast_requested(linked_slot_index)`，由槽/实例层消费（仍走消耗与自身冷却）。
## 历史坑（台账 P-22）：曾有注释把某槽写成"触发器目标"，但这里指的是另一个槽，
## 导致那个槽既不能手动按键、也永远不会被触发 —— 改内容时务必核对本字段。
@export var linked_slot_index: int = 0
