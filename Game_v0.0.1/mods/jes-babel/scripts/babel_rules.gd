## 《巴别回路》规则纯逻辑：朝向盾 4 向吸附减伤 / 1~2 人出战补偿 / 经验锚点分段线性插值
## 全部静态函数，无场景依赖，可 headless 单测。
class_name BabelRules
extends RefCounted


## 任意方向向量吸附到 4 向单位格（|x|>=|y| 取横向，否则纵向）
static func snap4(dir: Vector2) -> Vector2i:
	if dir == Vector2.ZERO:
		return Vector2i(0, 1)
	if absf(dir.x) >= absf(dir.y):
		return Vector2i(signi(int(dir.x)) if dir.x != 0.0 else 1, 0)
	return Vector2i(0, signi(int(dir.y)) if dir.y != 0.0 else 1)


## 朝向减伤系数：facing 规则表 {front_mul, back_mul, side_mul}
## attack_dir = 攻击行进方向（指向受击者）。攻击从受击者正面袭来（行进方向 = -facing）取 front_mul；
## 从背面袭来（行进方向 = facing）取 back_mul；侧面取 side_mul。
static func facing_mul(defender_facing: Vector2i, attack_dir: Vector2i, facing_cfg: Dictionary) -> float:
	var front: float = float(facing_cfg.get("front_mul", 0.7))
	var back: float = float(facing_cfg.get("back_mul", 1.3))
	var side: float = float(facing_cfg.get("side_mul", 1.0))
	if attack_dir == -defender_facing:
		return front
	if attack_dir == defender_facing:
		return back
	return side


## 出战人数补偿：hp_mul/dps_mul/shard_mul；人数越界夹到 1~3
static func compensation(team_size: int, comp_cfg: Dictionary) -> Dictionary:
	var idx: int = clampi(team_size, 1, 3) - 1
	var hp_arr: Variant = comp_cfg.get("hp_mul", [1.25, 1.12, 1.0])
	var dps_arr: Variant = comp_cfg.get("dps_mul", [1.12, 1.12, 1.0])
	var shard_arr: Variant = comp_cfg.get("shard_mul", [1.10, 1.05, 1.0])
	return {
		"hp_mul": _arr_at(hp_arr, idx, 1.0),
		"dps_mul": _arr_at(dps_arr, idx, 1.0),
		"shard_mul": _arr_at(shard_arr, idx, 1.0),
	}


static func _arr_at(arr: Variant, idx: int, def: float) -> float:
	if arr is Array and idx >= 0 and idx < (arr as Array).size():
		var v: Variant = (arr as Array)[idx]
		if v is float or v is int:
			return float(v)
	return def


## 经验锚点分段线性插值：anchors = 累计经验锚点（升到第 2、3、4、5 级所需累计经验）。
## level_for_xp 返回浮点等级（1.0 起，封顶 anchors.size()+1）。
static func level_for_xp(xp: float, anchors: Array) -> float:
	var level: float = 1.0
	var prev: float = 0.0
	for i: int in range(anchors.size()):
		var a_v: Variant = anchors[i]
		if not (a_v is float or a_v is int):
			continue
		var a: float = float(a_v)
		if xp <= a:
			var span: float = maxf(a - prev, 0.0001)
			return level + clampf((xp - prev) / span, 0.0, 1.0)
		level += 1.0
		prev = a
	return level


## 当前整数等级
static func level_int(xp: float, anchors: Array) -> int:
	return int(floorf(level_for_xp(xp, anchors)))


## 升到下一级还差多少经验（已满级返回 0）
static func xp_to_next(xp: float, anchors: Array) -> float:
	var li: int = level_int(xp, anchors)
	if li >= anchors.size() + 1:
		return 0.0
	var next_v: Variant = anchors[mini(li - 1, anchors.size() - 1)]
	if next_v is float or next_v is int:
		return maxf(float(next_v) - xp, 0.0)
	return 0.0


## 当前级内进度 0~1（满级返回 1）
static func level_progress(xp: float, anchors: Array) -> float:
	var li: int = level_int(xp, anchors)
	if li >= anchors.size() + 1:
		return 1.0
	var lo: float = 0.0
	if li > 1:
		var lo_v: Variant = anchors[li - 2]
		if lo_v is float or lo_v is int:
			lo = float(lo_v)
	var hi_v: Variant = anchors[li - 1]
	if not (hi_v is float or hi_v is int):
		return 1.0
	var hi: float = float(hi_v)
	return clampf((xp - lo) / maxf(hi - lo, 0.0001), 0.0, 1.0)


## 稀有度按权重抽取（weights 形如 {"white_w":70,"blue_w":25,"gold_w":5}）
static func roll_rarity(rng: RandomNumberGenerator, weights: Dictionary) -> String:
	var w_white: float = float(weights.get("white_w", 70.0))
	var w_blue: float = float(weights.get("blue_w", 25.0))
	var w_gold: float = float(weights.get("gold_w", 5.0))
	var total: float = maxf(w_white + w_blue + w_gold, 0.0001)
	var r: float = rng.randf() * total
	if r < w_white:
		return "white"
	if r < w_white + w_blue:
		return "blue"
	return "gold"


## 神罚计时：返回本次应扣血比例（0 = 未触发）。battle_t 累计秒。
static func punishment_ratio(battle_t: float, last_tick: float, cfg: Dictionary) -> float:
	var start_s: float = float(cfg.get("start_s", 75.0))
	var tick_s: float = float(cfg.get("tick_s", 10.0))
	var ratio: float = float(cfg.get("hp_loss_ratio", 0.10))
	if battle_t < start_s:
		return 0.0
	var due: float = floorf((battle_t - start_s) / tick_s) + 1.0
	if last_tick < due:
		return ratio
	return 0.0


## 神罚已到期次数（供外部更新 last_tick）
static func punishment_due_count(battle_t: float, cfg: Dictionary) -> float:
	var start_s: float = float(cfg.get("start_s", 75.0))
	var tick_s: float = float(cfg.get("tick_s", 10.0))
	if battle_t < start_s:
		return 0.0
	return floorf((battle_t - start_s) / tick_s) + 1.0
