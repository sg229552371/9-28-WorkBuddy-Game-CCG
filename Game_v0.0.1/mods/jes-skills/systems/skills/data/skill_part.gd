# SkillPart（规格 §3.1）：技能的一个伤害段。
# damage_channel 与 tags 是正交维度（规格 §4.1）。
class_name SkillPart
extends Resource

@export var damage_channel: int = 1            # SkillChannel.Channel.HIT
@export var base_damage: Dictionary = {}       # {&"physical": 100.0, &"cold": 20.0}
@export var damage_effectiveness: float = 1.0  # 附加伤害缩放系数
@export var behavior_id: StringName = &""
@export var behavior_params: Dictionary = {}   # 见规格 §3.6
