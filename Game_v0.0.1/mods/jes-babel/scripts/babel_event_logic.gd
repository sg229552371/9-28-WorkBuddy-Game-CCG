## 《巴别回路》渎神/敬神事件纯逻辑（新 schema：devotion{desc_cn,reward,boss_mod} / blasphemy{desc_cn,reward,cost,boss_mod}）
## reward/cost 元素形如 {"type": String, "value": float, "targets": int(可选)}
## 已实现 reward/cost 类型：team_shield / team_heal / relic_slot_add / skill_cd_double /
##   team_dmg_add / incense_add / relic_grant；未知类型 push_warning 并忽略。
class_name BabelEventLogic
extends RefCounted


## 应用一串效果到局内状态 run（就地修改 run 键：team_shield/team_heal/relic_slot_add/team_dmg_add/incense_add/pending_relic/cd_penalty）
## 返回应用的类型列表（便于测试与日志）
static func apply_effects(effects: Variant, run: Dictionary) -> Array[String]:
	var applied: Array[String] = []
	if not (effects is Array):
		push_warning("[BabelEvent] 效果列表缺失/类型错")
		return applied
	for e: Variant in (effects as Array):
		if not (e is Dictionary):
			continue
		var ed: Dictionary = e as Dictionary
		var t: String = str(ed.get("type", ""))
		var v: float = float(ed.get("value", 0.0))
		match t:
			"team_shield":
				run["team_shield"] = float(run.get("team_shield", 0.0)) + v
				applied.append(t)
			"team_heal":
				run["team_heal"] = float(run.get("team_heal", 0.0)) + v
				applied.append(t)
			"relic_slot_add":
				run["relic_slot_add"] = int(run.get("relic_slot_add", 0)) + int(v)
				applied.append(t)
			"team_dmg_add":
				run["team_dmg_add"] = float(run.get("team_dmg_add", 0.0)) + v
				applied.append(t)
			"incense_add":
				run["incense_add"] = float(run.get("incense_add", 0.0)) + v
				applied.append(t)
			"relic_grant":
				run["pending_relic"] = str(ed.get("relic_id", ""))
				applied.append(t)
			"battle_start_stun":
				# v1.2 口径：即时制下「无法行动」过重 → 渎神惩罚改为技能 CD 翻倍 10s
				run["cd_penalty_s"] = float(run.get("cd_penalty_s", 0.0)) + 10.0
				run["cd_penalty_targets"] = int(ed.get("targets", 1))
				applied.append("skill_cd_double")
			_:
				push_warning("[BabelEvent] 未知效果类型: " + t)
	return applied


## 处理一次事件选择：track = "devotion" | "blasphemy"
## 返回 {"applied": Array[String], "boss_mod": Dictionary}
static func apply_choice(event: Dictionary, track: String, run: Dictionary) -> Dictionary:
	var side: Variant = event.get(track, {})
	if not (side is Dictionary):
		push_warning("[BabelEvent] 事件缺少 " + track + " 分支")
		return {"applied": [] as Array[String], "boss_mod": {}}
	var sd: Dictionary = side as Dictionary
	var applied: Array[String] = apply_effects(sd.get("reward", []), run)
	if track == "blasphemy":
		applied.append_array(apply_effects(sd.get("cost", []), run))
	var boss_mod: Variant = sd.get("boss_mod", {})
	if not (boss_mod is Dictionary):
		boss_mod = {}
	return {"applied": applied, "boss_mod": boss_mod}


## Boss 突变应用：holy_repay（周期回血）/ divine_wrath（半血 AoE）
## 返回战斗内可直接使用的突变描述 {"type": String, "params": Dictionary}
static func normalize_boss_mod(boss_mod: Dictionary) -> Dictionary:
	var t: String = str(boss_mod.get("type", ""))
	var params: Variant = boss_mod.get("params", {})
	if not (params is Dictionary):
		params = {}
	return {"type": t, "params": params as Dictionary}


## 应用渎神开战 CD 惩罚：随机 targets 名成员的技能 CD 翻倍（10s 口径）
## cds 形如 {"成员id": {"skill_a": float, "skill_b": float}}，就地修改
static func apply_cd_penalty(cds: Dictionary, members: Array, targets: int) -> Array[String]:
	var hit: Array[String] = []
	var pool: Array = members.duplicate()
	pool.shuffle()
	for i: int in range(mini(targets, pool.size())):
		var mid: String = str(pool[i])
		var c: Variant = cds.get(mid, {})
		if not (c is Dictionary):
			continue
		var cd: Dictionary = c as Dictionary
		for k: String in cd.keys():
			var v: Variant = cd[k]
			if v is float or v is int:
				cd[k] = float(v) * 2.0
		hit.append(mid)
	return hit
