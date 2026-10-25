## G 状态单例 —— 对译 HTLM/js/game.js 顶部 const G（P1 骨架）
## 真源：HTLM/js/game.js `const G = {...}`（2026-10-24 核对）
## 口径：状态取值与真源完全一致（字符串，不自创）；战斗/世界字段随 P3 扩充。
extends Node

signal state_changed(old_state: String, new_state: String)

## 战斗结算信号（新增）：战斗侧可直接 emit 本信号，或统一走
## EventBus.emit_event("run_settled", payload)。FlowRoot 两条通道都监听。
## TODO(event_bus.gd)：该文件归战斗线代理所有、禁止本侧改动；若后续在
## EventBus 中补 "run_settled" 专用信号，请迁移到该信号并保持 payload 字段一致。
signal run_settled(payload: Dictionary)

## 状态取值（真源注释列出 boot|menu|charSel|playing|settled|dead；
## main.js loop 分支另识别 "city"（主城），证明其也是合法值，故一并列入）
const STATES: Array[String] = ["boot", "menu", "charSel", "playing", "settled", "dead", "city"]

## 当前状态（真源 G.state）
var state: String = "boot"
## 画布逻辑尺寸（真源 G.W/G.H 默认 1920×1080）
var W: float = 1920.0
var H: float = 1080.0
## 全局时间（秒）——由主循环每帧步进（真源 G.time += dt）
var time: float = 0.0
## 模式开关（真源同名字段；P3 接线）
var in_artisan: bool = false
var in_endless: bool = false
## 输入镜像（真源 G.keys / G.mouse / G.joy；P1 仅建结构）
var keys: Dictionary = {}
var mouse: Dictionary = { "x": 0.0, "y": 0.0 }
var joy: Dictionary = { "active": false, "dx": 0.0, "dy": 0.0 }

## 跨场景传递（场景串联流：主城→选人→进战→回城）
## 选人界面写入，战斗场景读取；默认 H001 保持旧口径（直启 battle 不炸）
var hero_id: String = "H001"
var level_id: String = "LEVEL_001"
## 最近一次战斗结算（死亡回城后主城展示）
var last_settlement: Dictionary = {}

## 组队出征英雄（第 1 位为队长，玩家操控；上限读 cfg/team.json maxSize）
var team_ids: Array[String] = []

## Meta 账号级存档（结晶/英雄解锁/关卡星级/图鉴/设置/本周深渊结晶）
## 与单英雄技能槽存档（SaveCore）各自独立文件、互不覆盖。
var meta: MetaSave = MetaSave.new()


## ---------- Meta 只读访问辅助（写操作请经 FlowRoot / MetaSave 接口）----------

func meta_crystals() -> int:
	return meta.crystals()


func meta_unlocked_levels() -> int:
	return meta.unlocked_levels()


func meta_level_stars(level_id: String) -> int:
	return meta.level_stars(level_id)


func is_hero_unlocked(hero_id: String) -> bool:
	return meta.is_hero_unlocked(hero_id)


## 战斗侧结算入口：payload 建议字段 won/reason/kills/elapsed/pickups/stars/loot
func emit_run_settled(payload: Dictionary) -> void:
	last_settlement = payload.duplicate(true)
	run_settled.emit(payload)

## 切换状态：非法值拒绝并报错（保守口径，不静默吞）
func set_state(new_state: String) -> void:
	if new_state == state:
		return
	if not STATES.has(new_state):
		push_warning("[GameState] 非法状态: " + new_state)
		return
	var old := state
	state = new_state
	state_changed.emit(old, new_state)

## 每帧步进全局时间（由 main.gd 调用；测试可直接调用）
func advance_time(dt: float) -> void:
	time += dt
