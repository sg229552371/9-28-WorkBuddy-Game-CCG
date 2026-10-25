# ProjectileSlot（规格 §9.3）：池内一个投射物槽位。
class_name ProjectileSlot
extends RefCounted

var active: bool = false
var seq: int = 0            # 单调递增序号：越新越大，用于"回收最旧"
var index: int = -1         # 在容器里的固定下标（SoA 数组 / 节点数组都用它）
