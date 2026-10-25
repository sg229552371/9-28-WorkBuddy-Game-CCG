## 主循环 —— 对译 HTLM/js/main.js 的 Game.loop（2026-10-24 核对）
## 真源口径：**变步长**（非固定步长）+ 步长双钳制（下界 0 / 上界 0.05，兜底 0.016）。
## 与真源差异声明：rAF 续帧与异常隔离由 Godot 场景树承担，无需手工续帧。
extends Node

const DT_MAX := 0.05        # 步长上界（真源 Math.min(0.05, ...)）
const DT_FALLBACK := 0.016  # 兜底步长（真源 || 0.016）

## playing 状态下按注册顺序执行的系统更新（P3 各系统在此注册）
var playing_systems: Array[Callable] = []
## city 状态下的更新（主城模块 P3 接入）
var city_systems: Array[Callable] = []

func _process(delta: float) -> void:
	# 步长双钳制：Godot delta 恒正且单调，钳制保留为防御口径（对齐真源注释）
	var dt := clampf(delta, 0.0, DT_MAX)
	if dt <= 0.0:
		dt = DT_FALLBACK
	GameState.advance_time(dt)
	match GameState.state:
		"playing":
			# 真源 playing 分支：玩家/世界/技能/无尽/撤离等（P3 逐个注册进 playing_systems）
			for fn in playing_systems:
				fn.call(dt)
		"city":
			for fn in city_systems:
				fn.call(dt)
		_:
			pass  # 真源其余状态仅 updateFX（P3 接入特效系统后在此挂载）
