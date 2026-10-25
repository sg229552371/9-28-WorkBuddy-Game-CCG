# SkillData（规格 §3.1）：主动技能宝石数据。
# 运行时逻辑只写一次，技能差异全部来自数据（新增技能 = 新增 .tres）。
class_name SkillData
extends Resource

@export var gem_id: StringName = &""
@export var display_name: String = ""
@export var icon: Texture2D
@export var parts: Array[SkillPart] = []
@export var tags: Array[StringName] = []
@export var cast_mode: int = 0                # 0=ACTIVE, 1=TRIGGER_ONLY
@export var base_cast_time: float = 0.5
@export var cost_type: int = 0                # 0=MANA, 1=LIFE, 2=ENERGY_SHIELD, 3=NONE
@export var base_cost: float = 10.0
@export var base_cooldown: float = 0.0
@export var max_charges: int = 0
@export var charge_recharge_time: float = 0.0
@export var level_scaling: GemLevelScaling
@export var allowed_support_tags: Array[StringName] = []
