## 《巴别回路》SRPG 回合管理器，纯逻辑 RefCounted，headless 可测。
class_name BabelTurnManager
extends RefCounted

## 当前阶段：player | enemy
var phase: String = "player"
## 当前回合（从 1 起）
var round_idx: int = 1
## 玩家方单位列表
var players: Array[BabelUnit] = []
## 敌方单位列表
var enemies: Array[BabelUnit] = []
## 棋盘引用（注入）
var board: BabelBoard
## 结算器引用（注入）
var resolver: BabelResolver
## 敌方回合回调（注入；在 enemy 阶段执行一次）
var enemy_turn_callback: Callable = Callable()


## 回合开始
signal round_started(idx: int)
## 阶段切换
signal phase_changed(phase: String)
## 战斗结束
signal battle_over(winner: String)
## 玩家全员行动完毕
signal all_acted


func _init(p_board: BabelBoard, p_resolver: BabelResolver) -> void:
	board = p_board
	resolver = p_resolver


## 从 cfg 构建；缺表时回退默认值
static func create_from_cfg() -> BabelTurnManager:
	return BabelTurnManager.new(BabelBoard.create_from_cfg(), BabelResolver.create_from_cfg())


## 用与策划书一致的默认值构建（测试入口，不依赖 Cfg autoload）
static func create_default() -> BabelTurnManager:
	return BabelTurnManager.new(BabelBoard.create_default(), BabelResolver.create_default())


## 回合开始：全员状态重置并广播
func begin_round() -> void:
	for u: BabelUnit in players:
		u.reset_for_round()
	for u: BabelUnit in enemies:
		u.reset_for_round()
	round_started.emit(round_idx)


## 玩家尝试移动：要求剩余移动足够、目标空且在界内
func try_move(u: BabelUnit, to: Vector2i) -> bool:
	if u == null or not u.alive:
		return false
	if u.move_left <= 0:
		return false
	if board == null:
		return false
	if not board.in_bounds(to) or board.unit_at(to) != null:
		return false
	var dist: int = board.manhattan(u.pos, to)
	if dist > u.move_left:
		return false
	if not board.move_unit(u, to):
		return false
	u.consume_move()
	return true


## 瞬移圣物钩子：不查距离，只查占位与边界
func teleport_move(u: BabelUnit, to: Vector2i) -> bool:
	if u == null or not u.alive or board == null:
		return false
	if not board.in_bounds(to) or board.unit_at(to) != null:
		return false
	if not board.move_unit(u, to):
		return false
	u.consume_move()
	return true


## 尝试施法：需未行动、未沉默、冷却就绪。
## skill 形如 {"id": String, "cd": int}；targets 由调用方在结算时使用。
func try_cast(u: BabelUnit, skill: Dictionary, targets: Array[Vector2i]) -> bool:
	if u == null or not u.can_act():
		return false
	if int(u.state.get("silenced_rounds", 0)) > 0:
		return false
	var skill_id: String = str(skill.get("id", ""))
	var cd: int = int(skill.get("cd", 0))
	if int(u.cds.get(skill_id, 0)) > 0:
		return false
	u.cds[skill_id] = cd
	u.consume_action()
	# targets 仅作占位签名；伤害结算由外部经 resolver 完成
	return true


## 玩家回合结束：切敌方阶段→回调→推进回合→超时惩罚→新回合→回玩家阶段
func end_player_round() -> void:
	if phase != "player":
		return
	if _all_players_acted():
		all_acted.emit()
	phase = "enemy"
	phase_changed.emit(phase)
	if enemy_turn_callback.is_valid():
		enemy_turn_callback.call()
	round_idx += 1
	resolver.apply_punishment(_all_units(), round_idx)
	begin_round()
	phase = "player"
	phase_changed.emit(phase)
	check_battle_over()


## 玩家全员是否已行动
func _all_players_acted() -> bool:
	for u: BabelUnit in players:
		if u.alive and not u.acted:
			return false
	return true


## 双方全部单位
func _all_units() -> Array:
	var out: Array = []
	for u: BabelUnit in players:
		out.append(u)
	for u: BabelUnit in enemies:
		out.append(u)
	return out


## 胜负判定：一方全灭即结束
func check_battle_over() -> void:
	var players_alive: bool = false
	for u: BabelUnit in players:
		if u.alive:
			players_alive = true
	var enemies_alive: bool = false
	for u: BabelUnit in enemies:
		if u.alive:
			enemies_alive = true
	if not players_alive:
		battle_over.emit("enemy")
	elif not enemies_alive:
		battle_over.emit("player")
