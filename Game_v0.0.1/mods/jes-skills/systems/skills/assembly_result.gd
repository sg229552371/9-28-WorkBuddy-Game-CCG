# AssemblyResult（规格 §5.2）：装配纯函数的输出。
# 硬规则：只包含数据，不持有 Node 引用 —— 这样"换辅助 = 重算 + 重挂 modifier"。
class_name AssemblyResult
extends RefCounted

enum ErrorCode {
	OK = 0,
	ERR_NO_ACTIVE_GEM = 1,           # 组内 0 个主动宝石
	ERR_MULTIPLE_ACTIVE = 2,         # 组内 ≥2 个主动宝石
	ERR_INCOMPATIBLE_SUPPORT = 3,    # require/exclude/allowed 不兼容（G7）
	ERR_CONFLICT = 4,                # conflicts_with 独占冲突
	ERR_NO_SOCKET = 5,               # 孔位已满（镶嵌前置校验，2026-10-19 R1）
}

var ok: bool = false
var error_code: int = ErrorCode.OK
var error_support_id: StringName = &""    # 失败时指明问题辅助
var modifiers: Array[StatModifier] = []   # 待注入的运行时词缀（source_id 由注入方填写）
var behavior_overrides: Dictionary = {}   # 加法先合并、乘法后合并
var effective_tags: Array[StringName] = []  # 技能 tags + 所有辅助 add_tags（多轮收敛后）
var cost_multiplier: float = 1.0          # Π(各辅助 cost_multiplier)
var flags: Array[StringName] = []         # 汇总各辅助 flags
