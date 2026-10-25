## 全局事件总线（对应 js/core.js 的 EventBus）
## 口径：与 HTML 版一致，事件只承载「发生了什么」，监听方自行决定反应。
extends Node

signal game_event(event_name: String, payload: Dictionary)

# ---- 战斗流程补齐（对齐 html combat.js/modes.js 口径；只增不改） ----
## 结算：winner = "extract" / "dead"；payload: winner/shards/kills/time/level_id
signal run_settled(result: Dictionary)
## 伤害事件（表现层挂点，只发不渲染）：pos/amount/is_crit/killed
signal damage_dealt(info: Dictionary)
## 负重变化（HUD 侧）：当前总负重
signal weight_changed(weight: float)
## 自动战斗开关切换
signal auto_fight_toggled(on: bool)
## 升级 4 选 1：弹窗开始/选择完成（19.10 暂停闸门配套）
signal levelup_started(lv: int)
signal levelup_finished(lv: int)
## 开场冻结开始：seconds/hint
signal freeze_started(seconds: float, hint: String)
## BOSS 被击败（撤离点生成时机，combat.js onBossDefeated）
signal boss_defeated(pos: Vector2)
## 撤离点就位（pos 为雕像位置）
signal extract_ready(pos: Vector2)

func emit_event(event_name: String, payload: Dictionary = {}) -> void:
	game_event.emit(event_name, payload)
