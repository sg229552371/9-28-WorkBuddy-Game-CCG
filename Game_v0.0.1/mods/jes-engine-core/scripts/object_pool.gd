## 通用对象池 —— 逐函数对译 HTLM/js/pool.js 的 PoolImpl（版本 21.14-pool）
## 真源：HTLM/js/pool.js（2026-10-24 核对）
## 口径：obtain 取用（池空自动扩容）/ release 尾部交换删除（防重复归还）/
##       recycle 只回收不摘除 / buf 为紧凑存活数组 / high_water 峰值埋点。
class_name ObjectPool
extends RefCounted

var _factory: Callable                  # 新建对象的工厂：() -> Object
var _reset: Callable                    # 复用前的复位钩子（可空）
var _free_stack: Array = []             # 空闲对象栈（LIFO → 缓存友好）
var buf: Array = []                     # ★ 紧凑存活数组（存活恒在 [0, size)）
var high_water: int = 0                 # 峰值占用（性能埋点）
var created: int = 0                    # 累计新建数（诊断：衡量池是否真的在复用）

## factory 必填；reset 可传空 Callable；cap>0 时预分配（初始容量，非硬上限）
func _init(factory: Callable, reset: Callable = Callable(), cap: int = 0) -> void:
	_factory = factory
	_reset = reset
	for i in maxi(cap, 0):
		_free_stack.append(_make())

func _make() -> Variant:
	created += 1
	return _factory.call()

## 取一个对象：优先复用空闲对象（复位后返回），池空则新建；尾插存活数组
func obtain() -> Variant:
	var obj: Variant
	if not _free_stack.is_empty():
		obj = _free_stack.pop_back()
	else:
		obj = _make()
	if _reset.is_valid():
		_reset.call(obj)
	buf.append(obj)
	if buf.size() > high_water:
		high_water = buf.size()
	return obj

## 归还：尾部交换删除（swap-remove）摘出存活数组并压回空闲栈。
## 返回 false 表示对象不在存活集合（重复归还天然防重，真源同口径）
func release(obj: Variant) -> bool:
	var i := buf.find(obj)   # 与真源 indexOf 同口径
	if i < 0:
		return false
	var last := buf.size() - 1
	if i != last:
		buf[i] = buf[last]
	buf.pop_back()
	_free_stack.append(obj)
	return true

## 仅回收进空闲栈，不动 buf（调用方已自行摘除时用；真源同口径，调用方自证对象已不在 buf）
func recycle(obj: Variant) -> bool:
	if obj == null:
		return false
	_free_stack.append(obj)
	return true

## 遍历存活对象 fn(obj, index)。回调内禁止 obtain/release（真源同口径：会漏遍历/越界）
func for_each_alive(fn: Callable) -> void:
	for i in buf.size():
		fn.call(buf[i], i)

## 可选裁剪：GDScript 数组无手动容量接口，此处保留语义（返回存活数），无额外开销
func compact() -> int:
	return buf.size()

## 存活数（= buf.size() 的语义化别名，真源同口径）
func size() -> int:
	return buf.size()

## 清空存活集合，全部对象回收到空闲栈（重置场景用；不销毁对象，之后 obtain 仍走复用）
func clear_pool() -> void:
	for i in range(buf.size() - 1, -1, -1):
		_free_stack.append(buf[i])
	buf.clear()
