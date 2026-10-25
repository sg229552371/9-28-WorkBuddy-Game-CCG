# SupportGemData（规格 §3.3）：辅助宝石三元组是核心。
# require_tags / add_tags / exclude_tags + stat_modifiers + behavior_overrides
# + cost_multiplier + flags + conflicts_with。
# 硬规则：所有标签均为 StringName 精确匹配，禁止字符串包含判断。
class_name SupportGemData
extends Resource

@export var support_id: StringName = &""
@export var display_name: String = ""
@export var require_tags: Array[StringName] = []       # 必须全部具备
@export var require_any_tags: Array[StringName] = []   # 任一具备即可（D-42：属性契约要求「至少一个部件消费目标属性」时用）
@export var add_tags: Array[StringName] = []           # 给技能追加标签（多轮收敛）
@export var exclude_tags: Array[StringName] = []       # 命中任一即不兼容
@export var cost_multiplier: float = 1.0
@export var stat_modifiers: Array[ModifierSpec] = []
@export var behavior_overrides: Dictionary = {}        # {&"projectile_count": {&"add": 2.0}}
@export var flags: Array[StringName] = []              # &"cannot_crit" / &"cost_life"
@export var conflicts_with: Array[StringName] = []     # 独占组
