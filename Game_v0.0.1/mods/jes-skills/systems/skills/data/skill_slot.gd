# SkillSlot（规格 §5.1）：插槽单一真源。
# SkillInstance 禁止持有插槽数据副本（规格 §13.1 第 5 条）。
class_name SkillSlot
extends Resource

@export var slot_index: int = 0
@export var active_gem: SkillData
@export var active_level: int = 1
@export var active_quality: int = 0
@export var supports: Array[SupportGemData] = []
@export var socket_count: int = 4          # 首版 4~6
@export var links: Array[int] = []         # 连通关系：links 成对 [i, j] 表示 i 孔与 j 孔相连
