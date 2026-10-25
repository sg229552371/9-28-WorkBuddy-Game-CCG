# RngService（规格 §9.4）：分流域确定性随机。
#
# 目标：同一 seed + 同一输入序列 ⇒ 同一结果（可回放、可复现 BUG）。
# 硬规则：战斗相关 roll 不得与表现层（粒子随机）共用流，
#         否则改特效会改变战斗结果 —— 所以按 stream 名分流：
#         damage / loot / spawn / cosmetic。
#
# 实现：低偏置 32 位混淆（lowbias32）；不需要 RandomNumberGenerator 实例，
#       也不依赖全局随机状态，所以同一 (seed, stream, tick, salt) 永远得到同一个值。
class_name RngService
extends RefCounted

const STREAM_DAMAGE := &"damage"
const STREAM_LOOT := &"loot"
const STREAM_SPAWN := &"spawn"
const STREAM_COSMETIC := &"cosmetic"

const MASK32 := 0xFFFFFFFF
const INV_24 := 1.0 / 16777216.0

var seed_value: int = 0

var _stream_seed: Dictionary = {}   # StringName -> int
var _cursor: Dictionary = {}        # StringName -> int，该流已取样次数


func _init(p_seed: int = 0) -> void:
	seed_value = p_seed


## 32 位低偏置混淆（lowbias32）；返回值恒在 [0, 2^32)
static func hash32(x: int) -> int:
	var v := x & MASK32
	v = (v ^ (v >> 16)) & MASK32
	v = (v * 0x7FEB352D) & MASK32
	v = (v ^ (v >> 15)) & MASK32
	v = (v * 0x846CA68B) & MASK32
	v = (v ^ (v >> 16)) & MASK32
	return v


func _stream_seed_of(stream: StringName) -> int:
	if _stream_seed.has(stream):
		return _stream_seed[stream]
	var h := hash32(seed_value ^ String(stream).hash())
	_stream_seed[stream] = h
	return h


## 主入口：[0.0, 1.0) 均匀分布
func roll(stream: StringName, tick: int, salt: int = 0) -> float:
	var h := _stream_seed_of(stream)
	h = hash32(h ^ (tick & MASK32))
	h = hash32(h ^ (salt & MASK32))
	return float(h & 0xFFFFFF) * INV_24


func chance(stream: StringName, tick: int, salt: int, probability: float) -> bool:
	if probability <= 0.0:
		return false
	if probability >= 1.0:
		return true
	return roll(stream, tick, salt) < probability


func range_float(stream: StringName, tick: int, salt: int, from: float, to: float) -> float:
	return from + (to - from) * roll(stream, tick, salt)


func range_int(stream: StringName, tick: int, salt: int, from: int, to: int) -> int:
	if to <= from:
		return from
	return from + int(roll(stream, tick, salt) * float(to - from + 1))


## 同一条流上的第 n 次取样（salt 递增），避免调用方自己管 salt
func roll_seq(stream: StringName, tick: int, index: int) -> float:
	return roll(stream, tick, index)


# ---------------- 游标模式（热路径用） ----------------
#
# 无状态的 roll() 要求调用方自己提供 (tick, salt)，适合"每次事件有明确 tick"的场景。
# 但战斗命中这种热路径没有天然 tick，于是提供游标：每条流各自一个计数器，
# 第 n 次取样恒等于 roll(stream, n, 0)。
#
# 关键性质：**各流的游标互相独立**。所以表现层多消耗 1000 次 cosmetic，
# damage 流的第 n 个值仍然不变 —— 这正是 §9.4「改特效不得改变战斗结果」的落地保证。
# 同一 seed + 同一调用序列 ⇒ 同一结果，可回放。

## 从指定流取下一个 [0.0, 1.0) 均匀值，并推进该流游标
func next_float(stream: StringName) -> float:
	var c: int = _cursor.get(stream, 0)
	_cursor[stream] = c + 1
	return roll(stream, c, 0)


## 从指定流取下一个概率判定，并推进该流游标。
## 概率为 0 / 1 时短路且**不消耗游标**（边界结果无需随机）。
func next_chance(stream: StringName, probability: float) -> bool:
	if probability <= 0.0:
		return false
	if probability >= 1.0:
		return true
	return next_float(stream) < probability


## 从指定流取下一个区间浮点值，并推进该流游标
func next_range_float(stream: StringName, from: float, to: float) -> float:
	return from + (to - from) * next_float(stream)


## 查询某条流已取样次数（调试 / 断言用，不推进游标）
func cursor_of(stream: StringName) -> int:
	return _cursor.get(stream, 0)


## 清空全部游标（不影响 seed 与流派生缓存）。回放时调用，从头重演。
func reset_cursors() -> void:
	_cursor.clear()
