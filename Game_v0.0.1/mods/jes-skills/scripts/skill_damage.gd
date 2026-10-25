## ============================================================
## 技能水晶系统 · 伤害结算（对译 HTLM/mods/jes-skill-crystal/systems/skill-damage.js 逐份结算口径的最小闭环）
## 口径（冻结，勿改）：
##   - 一条 hit 内多个结算份（parts[]）：每个结算份独立判闪避、独立算减免
##   - 结算顺序固定：逐份判闪避 → 未闪避才算减免 → 减免到 0 仍是 hit
##     （减免到 0 与闪避不同，不能因为数字为 0 就当「未命中」）
##   - hit 判定：至少一份未闪避 = hit 成立（hits=1，一次候选接触只发一条）；
##     全部份被闪避 = 不成立（hits=0）
##   - 事件只有两个：hit（命中成立）与 vanish（正常消失）；本模块只产出 hit 结果数据，
##     vanish 由实例生命周期层负责（purge 不发 vanish、不派生、不补 hit）
## 铁律：函数/变量名纯 ASCII；不用 push_error；缩进 Tab；不碰场景节点
## ============================================================
class_name SkillDamageCore
extends RefCounted


## 逐份结算一次候选接触。
## parts:  Array[Dictionary]，每份 = {"amount": float}（结算前伤害值）
## target: Dictionary = {"evasion": 0.0~1.0, "def": 平减值}（缺字段按 0 处理）
## rng:  闪避掷骰源，需提供 randf() -> float（可为 RandomNumberGenerator；
##       测试可注入定值桩）；null 时内部新建 RandomNumberGenerator
## 返回：
## {
##   hit: bool,               # hit 是否成立（≥1 份未闪避）
##   hits: int,               # 命中事件条数：成立=1，不成立=0
##   damage_total: float,     # 全部未闪避份减免后之和（可为 0，仍算 hit）
##   parts: Array[{index, evaded, final_amount}],   # 份级结果各自保留状态
## }
static func settle_hit(parts: Array, target: Dictionary, rng = null) -> Dictionary:
	if rng == null:
		rng = RandomNumberGenerator.new()
	var evasion := clampf(float(target.get("evasion", 0.0)), 0.0, 1.0)
	var def := float(target.get("def", 0.0))
	var part_results: Array = []
	var damage_total := 0.0
	var landed := false
	for i in parts.size():
		var amount := 0.0
		var p: Variant = parts[i]
		if typeof(p) == TYPE_DICTIONARY:
			amount = float(p.get("amount", 0.0))
		# ① 逐份判闪避（口径顺序固定：先闪避，未闪避才算减免，不得对调）
		var evaded := false
		if evasion > 0.0:
			evaded = rng.randf() < evasion
		# ② 未闪避 → 算减免（平减，下限 0：减免到 0 仍是 hit）
		var final_amount := 0.0
		if not evaded:
			landed = true
			final_amount = maxf(amount - def, 0.0)
			damage_total += final_amount
		part_results.append({"index": i, "evaded": evaded, "final_amount": final_amount})
	# ③ hit 判定：至少一份未闪避 = 成立；全部闪避 = 不成立
	return {
		"hit": landed,
		"hits": 1 if landed else 0,
		"damage_total": damage_total,
		"parts": part_results,
	}
