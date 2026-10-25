## ============================================================
## 技能水晶系统 · 弹幕表现建议
## 纯逻辑：不创建节点，不修改运行时实例；渲染层可按返回值自行取用。
## ============================================================
class_name ProjectileStyle
extends RefCounted

const DEFAULT_COLOR := Color(0.96, 0.96, 1.0, 1.0)
const DEFAULT_SIZE := 8.0

## 每颗水晶的颜色和尺寸建议。尺寸是相对基础半径的乘数。
const CRYSTAL_STYLES := {
	"CR_PIERCE": {"color": Color(0.72, 0.90, 1.0), "size": 1.05, "priority": 20},
	"CR_MULTISHOT": {"color": Color(0.76, 0.88, 1.0), "size": 0.85, "priority": 10},
	"CR_HOMING": {"color": Color(0.35, 1.0, 0.72), "size": 1.0, "priority": 30},
	"CR_SPLIT": {"color": Color(0.80, 0.46, 1.0), "size": 0.95, "priority": 40},
	"CR_EXPLOSION": {"color": Color(1.0, 0.62, 0.16), "size": 1.35, "priority": 80},
	"CR_AFTERFLAME": {"color": Color(1.0, 0.30, 0.08), "size": 1.1, "priority": 60},
	"CR_EXPANSE": {"color": Color(0.34, 0.76, 1.0), "size": 1.25, "priority": 50},
	"CR_ORBIT": {"color": Color(0.62, 0.48, 1.0), "size": 1.15, "priority": 45},
	"CR_ARCANE_AMP": {"color": Color(1.0, 0.42, 0.92), "size": 1.1, "priority": 55},
	"CR_COOLDOWN": {"color": Color(0.55, 0.72, 1.0), "size": 0.9, "priority": 15},
	"CR_SPEED": {"color": Color(0.38, 1.0, 1.0), "size": 0.82, "priority": 25},
	"CR_BOUNCE": {"color": Color(1.0, 0.88, 0.32), "size": 1.0, "priority": 35},
	"CR_CHAIN": {"color": Color(0.48, 0.38, 1.0), "size": 1.08, "priority": 70},
	"CR_BURN": {"color": Color(1.0, 0.16, 0.04), "size": 1.18, "priority": 75},
}

## 返回 {color: Color, size: float, crystals: Array[String]}。
## 多颗水晶采用加权混色，尺寸取最大建议，未知/空数组返回默认白色小弹。
static func style_for(crystals: Array) -> Dictionary:
	var total_weight := 0.0
	var mixed := Color(0.0, 0.0, 0.0, 1.0)
	var size := DEFAULT_SIZE
	var known: Array[String] = []
	for crystal in crystals:
		var item: Dictionary = crystal if typeof(crystal) == TYPE_DICTIONARY else {}
		var id := str(item.get("id", crystal if typeof(crystal) == TYPE_STRING else ""))
		if not CRYSTAL_STYLES.has(id):
			continue
		var spec: Dictionary = CRYSTAL_STYLES[id]
		var weight := maxf(1.0, float(spec.get("priority", 1)))
		mixed += spec["color"] * weight
		total_weight += weight
		size = maxf(size, DEFAULT_SIZE * float(spec.get("size", 1.0)))
		if not known.has(id):
			known.append(id)
	if total_weight <= 0.0:
		return {"color": DEFAULT_COLOR, "size": DEFAULT_SIZE, "crystals": known}
	mixed /= total_weight
	mixed.a = 1.0
	return {"color": mixed, "size": size, "crystals": known}
