## 全局事件总线（对应 js/core.js 的 EventBus）
## 口径：与 HTML 版一致，事件只承载「发生了什么」，监听方自行决定反应。
extends Node

signal game_event(event_name: String, payload: Dictionary)

# ---- 战斗流程补齐（对齐 html combat.js/modes.js 口径；只增不改） ----
@warning_ignore("unused_signal")
signal run_settled(result: Dictionary)
@warning_ignore("unused_signal")
signal damage_dealt(info: Dictionary)
@warning_ignore("unused_signal")
signal weight_changed(weight: float)
@warning_ignore("unused_signal")
signal auto_fight_toggled(on: bool)
@warning_ignore("unused_signal")
signal levelup_started(lv: int)
@warning_ignore("unused_signal")
signal levelup_finished(lv: int)
@warning_ignore("unused_signal")
signal freeze_started(seconds: float, hint: String)
@warning_ignore("unused_signal")
signal boss_defeated(pos: Vector2)
@warning_ignore("unused_signal")
signal extract_ready(pos: Vector2)

func emit_event(event_name: String, payload: Dictionary = {}) -> void:
	game_event.emit(event_name, payload)
