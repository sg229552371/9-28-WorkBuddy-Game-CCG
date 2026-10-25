# GemLevelScaling（规格 §3.1）
#
# 等级缩放：把 part 的 base_damage 按等级放大。两种模式，由 knee_level 区分：
#
#   ① 不分段（knee_level <= 0，默认）—— 旧行为，逐位不变
#        factor(L) = 1 + per_level × (L − 1)
#
#   ② 两段（knee_level >= 1）
#        factor(L) = 1 + per_level × (min(L, knee) − 1) + per_level_late × max(L − knee, 0)
#
# 为什么是"两段"而不是 `Curve`：
#   · 技能数值真正需要区分的是「前期发力」与「后期发力」两类形状，两段已能表达；
#   · Curve 在 `.tres` 里是点数组（SubResource + 采样），手改几乎不可能、批量生成更难，
#     而内容制作的前提是「一个数就是一列」；
#   · 三参数是解析式，单调性与终值可以在测试里精确断言，Curve 只能采样近似。
#   若将来确需多段，应当新增 `early/late` 之外的显式模式，而不是偷偷把 Curve 塞进来。
class_name GemLevelScaling
extends Resource

## 每级成长率（0.1 = 每级 +10% 基础值）。分段模式下只作用于 1..knee_level。
@export var per_level: float = 0.0

## 拐点等级。0 = 不分段（纯线性，兼容既有内容）；N = 1..N 用 per_level，N 之后用 per_level_late。
@export var knee_level: int = 0

## 拐点之后的每级成长率。仅在 knee_level >= 1 时生效。
@export var per_level_late: float = 0.0


func factor_for(level: int) -> float:
	var lv := maxi(level, 1)
	if knee_level <= 0:
		# 旧路径：与 R10 之前的实现逐位相同，不得"顺手优化"成等价式
		return 1.0 + per_level * float(lv - 1)
	var early_steps := mini(lv, knee_level) - 1
	var late_steps := maxi(lv - knee_level, 0)
	return 1.0 + per_level * float(early_steps) + per_level_late * float(late_steps)


## 是否处于分段模式（内容 lint 与编辑器展示用，避免各处自行判断 knee_level）。
func is_segmented() -> bool:
	return knee_level >= 1
