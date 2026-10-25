## 全局事件总线（对应 js/core.js 的 EventBus）
## 口径：与 HTML 版一致，事件只承载「发生了什么」，监听方自行决定反应。
extends Node

signal game_event(event_name: String, payload: Dictionary)

func emit_event(event_name: String, payload: Dictionary = {}) -> void:
	game_event.emit(event_name, payload)
