## G 状态单例 —— 对译 HTLM/js/game.js 顶部 const G（P1 骨架）
## 真源：HTLM/js/game.js `const G = {...}`（2026-10-24 核对）
## 口径：状态取值与真源完全一致（字符串，不自创）；战斗/世界字段随 P3 扩充。
extends Node

signal state_changed(old_state: String, new_state: String)

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
