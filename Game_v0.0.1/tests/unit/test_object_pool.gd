## 对象池单元测试（对译自 HTLM mods/jes-quality-perf/tests/pool_test.js 的口径）
extends GutTest

class Stub:
	var v: int = 0

func test_obtain_create_and_reuse() -> void:
	var p := ObjectPool.new(func(): return Stub.new(), Callable(), 2)
	assert_eq(p.created, 2)              # 预分配 2
	var a: Stub = p.obtain()
	var b: Stub = p.obtain()
	assert_eq(p.created, 2)              # 未超出预热：不新建
	var c: Stub = p.obtain()
	assert_eq(p.created, 3)              # 池空自动扩容
	assert_eq(p.size(), 3)

func test_release_then_reuse() -> void:
	var p := ObjectPool.new(func(): return Stub.new())
	var a: Stub = p.obtain()
	p.release(a)
	assert_eq(p.size(), 0)
	var b: Stub = p.obtain()
	assert_same(b, a)                    # LIFO 复用同一对象
	assert_eq(p.created, 1)              # 没有新建

func test_reset_hook() -> void:
	var p := ObjectPool.new(func(): return Stub.new(), func(o): o.v = 42)
	var a: Stub = p.obtain()
	a.v = 1
	p.release(a)
	var b: Stub = p.obtain()
	assert_eq(b.v, 42)                   # 复位钩子写回约定值

func test_release_swap_remove() -> void:
	var p := ObjectPool.new(func(): return Stub.new())
	var a: Stub = p.obtain()
	var b: Stub = p.obtain()
	var c: Stub = p.obtain()
	assert_true(p.release(b))            # 中间元素 swap-remove
	assert_eq(p.size(), 2)
	assert_eq(p.buf[0], a)               # 末位补位：c 挪到 b 的位置
	assert_eq(p.buf[1], c)
	assert_false(p.release(b))           # 重复归还 → false
	assert_eq(p._free_stack.size(), 1)   # 空闲栈只有一份

func test_high_water() -> void:
	var p := ObjectPool.new(func(): return Stub.new())
	for i in 5:
		p.obtain()
	assert_eq(p.high_water, 5)
	p.release(p.buf[0])
	assert_eq(p.high_water, 5)           # 峰值不回落

func test_for_each_alive_iter() -> void:
	var p := ObjectPool.new(func(): return Stub.new())
	for i in 3:
		p.obtain().v = i
	var seen: Array = []
	p.for_each_alive(func(o, idx): seen.append(o.v))
	assert_eq(seen.size(), 3)

func test_clear_pool_reuse() -> void:
	var p := ObjectPool.new(func(): return Stub.new())
	var a: Stub = p.obtain()
	var b: Stub = p.obtain()
	p.clear_pool()
	assert_eq(p.size(), 0)
	assert_eq(p._free_stack.size(), 2)
	var c: Stub = p.obtain()
	assert_eq(p.created, 2)              # 复用，不新建
