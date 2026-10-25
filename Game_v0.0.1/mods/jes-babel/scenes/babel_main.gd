## 《巴别回路》主流程：9:16 竖屏状态机 main_city|hero_select|battle|settle|totem。
## 批次 D：事件二选一/商店（读表定价）/封圣三选一/meta 存档（BabelSave）全闭环。
class_name BabelMain
extends Control

const STATE_MAIN_CITY: String = "main_city"
const STATE_HERO_SELECT: String = "hero_select"
const STATE_BATTLE: String = "battle"
const STATE_SETTLE: String = "settle"
const STATE_TOTEM: String = "totem"
## 合法状态迁移表（headless 测试用）
const VALID_TRANSITIONS: Dictionary = {
	"main_city": ["hero_select", "totem"],
	"hero_select": ["battle", "main_city"],
	"battle": ["settle"],
	"settle": ["battle", "totem", "main_city"],
	"totem": ["main_city"],
}
## 残片兑换香火：击杀数 × 2（兼容保留；正式香火走 meta_system.settle）
const SHARD_PER_KILL: int = 2
const CHAPTER_COUNT: int = 3
## 封圣章（第二章末，chapter_idx = 1）
const CANONIZE_CHAPTER_IDX: int = 1

## 状态切换完成（state: String）
signal state_changed(state: String)

## systems 装配
var event_sys: BabelEventSystem = BabelEventSystem.new()
var relic_sys: BabelRelicSystem = BabelRelicSystem.create_from_cfg()
var shop_sys: BabelShopSystem = BabelShopSystem.new(BabelRelicSystem.create_from_cfg())
var meta_sys: BabelMetaSystem = BabelMetaSystem.create_from_cfg()
var save: BabelSave = BabelSave.new()
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
## 元进度（持久化段）：{"incense": int, "totems": Array[String], "unlocked_chiefs": Array[String]}
var meta_data: Dictionary = {}
## 事件系统当前待选组
var pending_event_group: Dictionary = {}
## 封圣三选一缓存
var canonize_choices: Array[Dictionary] = []

var state: String = STATE_MAIN_CITY
## 本局会话数据
var run: Dictionary = {
	"team": [],
	"incense": 0,
	"shards": 0,
	"kills": 0,
	"totems": [],
	"relics": [],
	"chapter_idx": 0,
	"hp_carry": {},
	"pending_shield": 0,
	"stun_next": false,
	"boss_mutation": {},
	"price_mod": 1.0,
	"start_rules": {},
}
var battle: BabelBattle = null

var scr_main: Control
var scr_hero: Control
var scr_battle: Control
var scr_settle: Control
var scr_totem: Control
var hero_picked: Array[String] = []
var hero_buttons: Array[Button] = []
var lbl_settle_body: Label
var lbl_hero_hint: Label
var lbl_incense: Label
var settle_event_box: VBoxContainer
var settle_next_btn: Button


func _ready() -> void:
	rng.randomize()
	meta_data = save.load_meta()
	if not meta_data.has("incense"):
		meta_data["incense"] = 0
	if not meta_data.has("totems"):
		meta_data["totems"] = []
	if not meta_data.has("unlocked_chiefs"):
		meta_data["unlocked_chiefs"] = []
	_build_screens()
	_show_state(STATE_MAIN_CITY)


## ---------- 纯逻辑（可 headless 测试） ----------

## 状态迁移是否合法
static func is_transition_valid(from: String, to: String) -> bool:
	var nexts: Variant = VALID_TRANSITIONS.get(from, [])
	if nexts is Array:
		return (nexts as Array).has(to)
	return false


## 切换状态（合法迁移才生效，返回是否成功）
func transition_to(to: String) -> bool:
	if not is_transition_valid(state, to):
		return false
	state = to
	_show_state(to)
	state_changed.emit(to)
	return true


## 选人装配：从 chiefs 表挑 picked 的职业描述数组
static func build_team(chiefs_table: Variant, picked: Array[String]) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if chiefs_table is Array:
		for c: Variant in (chiefs_table as Array):
			if c is Dictionary:
				var d: Dictionary = c as Dictionary
				if picked.has(str(d.get("id", ""))):
					out.append({
						"id": str(d.get("id", "")),
						"name_cn": str(d.get("name_cn", "")),
						"hp": int(d.get("hp", 30)),
						"move": int(d.get("move", 3)),
						"skills": d.get("skills", []),
					})
	return out


## 按章节滚动敌人：mob 数 = 3 + 章序号（3~6 含 Boss 位），最终章附加 Boss；traits/params 透传
static func roll_enemies(enemies_table: Variant, chapter: Dictionary, is_final: bool) -> Array[Dictionary]:
	var ch_num: int = _chapter_number(str(chapter.get("id", "CH1")))
	var pool: Array[Dictionary] = []
	if enemies_table is Array:
		for e: Variant in (enemies_table as Array):
			if e is Dictionary:
				var d: Dictionary = e as Dictionary
				if int(d.get("chapter", 0)) == ch_num and ch_num < 3 or (ch_num == 3 and int(d.get("chapter", 0)) == 3 and str(d.get("id", "")) != str(chapter.get("boss_id", ""))):
					pool.append(d)
	var out: Array[Dictionary] = []
	var count: int = 3 + mini(ch_num, CHAPTER_COUNT) - 1
	for i: int in range(count):
		if pool.is_empty():
			break
		var pick: Dictionary = pool[randi() % pool.size()]
		var hp_lo: int = int(chapter.get("mob_hp_min", 8))
		var hp_hi: int = maxi(int(chapter.get("mob_hp_max", 12)), hp_lo)
		var dmg_lo: int = int(chapter.get("mob_dmg_min", 3))
		var dmg_hi: int = maxi(int(chapter.get("mob_dmg_max", 4)), dmg_lo)
		out.append({
			"id": str(pick.get("id", "")) + "_%d" % [i],
			"name_cn": str(pick.get("name_cn", "")),
			"hp": randi_range(hp_lo, hp_hi),
			"dmg": randi_range(dmg_lo, dmg_hi),
			"move": int(pick.get("move", 2)),
			"traits": pick.get("traits", []),
			"params": pick.get("params", {}),
		})
	if is_final:
		var boss_id: String = str(chapter.get("boss_id", ""))
		if boss_id != "" and enemies_table is Array:
			for e2: Variant in (enemies_table as Array):
				if e2 is Dictionary and str((e2 as Dictionary).get("id", "")) == boss_id:
					var bd: Dictionary = e2 as Dictionary
					out.append({
						"id": boss_id,
						"name_cn": str(bd.get("name_cn", "")),
						"hp": int(chapter.get("boss_hp", int(bd.get("hp", 90)))),
						"dmg": int(chapter.get("boss_dmg", int(bd.get("dmg", 8)))),
						"move": int(bd.get("move", 3)),
						"traits": bd.get("traits", []),
						"params": bd.get("params", {}),
					})
					break
	return out


static func _chapter_number(chapter_id: String) -> int:
	var digits: String = ""
	for ch: String in chapter_id:
		if ch >= "0" and ch <= "9":
			digits += ch
	if digits != "":
		return int(digits)
	return 1


## 香火结算：残片模拟 = 击杀数 × 2（兼容保留）
static func settle_incense(kills: int) -> int:
	return kills * SHARD_PER_KILL


## 把开局规则应用到队伍描述（team_start_shield/team_hp_add/atk_add/起始圣物）
func apply_start_rules(team: Array[Dictionary], rules: Dictionary) -> void:
	for d: Dictionary in team:
		if rules.has("team_start_shield"):
			d["shield"] = int(d.get("shield", 0)) + int(rules.get("team_start_shield", 0))
		if rules.has("team_hp_add"):
			d["hp"] = int(d.get("hp", 30)) + int(rules.get("team_hp_add", 0))
		var extras: Dictionary = d.get("state", {}) as Dictionary
		if rules.has("atk_add"):
			extras["atk_bonus"] = int(extras.get("atk_bonus", 0)) + int(rules.get("atk_add", 0))
		d["state"] = extras
	# 起始圣物
	var count: int = int(rules.get("start_relic_count", 0))
	if count > 0:
		var pool: Array[Dictionary] = _relic_pool()
		for i: int in range(count):
			var r: Dictionary = relic_sys.roll_relic(rng, pool, false)
			if not r.is_empty():
				relic_sys.add_relic(r)


## ---------- 场景 UI ----------

func _build_screens() -> void:
	scr_main = _mk_screen()
	var title: Label = _mk_label(scr_main, "《巴别回路》", Vector2(0, 300), 720, 64, 40)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var sub: Label = _mk_label(scr_main, "SRPG 组队肉鸽 · 竖屏闭环", Vector2(0, 380), 720, 40, 20)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_mk_button(scr_main, "开始远征", Vector2(210, 560), Vector2(300, 70), _on_start_run)
	_mk_button(scr_main, "图腾页", Vector2(210, 660), Vector2(300, 70), func() -> void: transition_to(STATE_TOTEM))

	scr_hero = _mk_screen()
	_mk_label(scr_hero, "选人：六祭司选三", Vector2(0, 60), 720, 50, 30)
	lbl_hero_hint = _mk_label(scr_hero, "已选 0/3", Vector2(0, 110), 720, 36, 22)
	var chiefs: Array = _table("srpg_chiefs") as Array if _table("srpg_chiefs") is Array else []
	hero_buttons.clear()
	for i: int in range(chiefs.size()):
		var c: Dictionary = chiefs[i] as Dictionary
		var b: Button = _mk_button(scr_hero, str(c.get("name_cn", "")), Vector2(60 + (i % 2) * 320, 180 + (i / 2) * 130), Vector2(290, 100), _on_hero_toggled.bind(i))
		b.toggle_mode = true
		hero_buttons.append(b)
	_mk_button(scr_hero, "确认出征", Vector2(210, 780), Vector2(300, 70), _on_team_confirmed)
	_mk_button(scr_hero, "返回主城", Vector2(210, 880), Vector2(300, 60), func() -> void: transition_to(STATE_MAIN_CITY))

	scr_battle = _mk_screen()

	scr_settle = _mk_screen()
	_mk_label(scr_settle, "战斗结算", Vector2(0, 40), 720, 50, 30)
	lbl_settle_body = _mk_label(scr_settle, "", Vector2(40, 110), 640, 200, 20)
	settle_event_box = VBoxContainer.new()
	settle_event_box.position = Vector2(40, 330)
	settle_event_box.size = Vector2(640, 200)
	scr_settle.add_child(settle_event_box)
	_mk_button(scr_settle, "商店", Vector2(40, 560), Vector2(180, 60), _on_shop_pressed)
	settle_next_btn = _mk_button(scr_settle, "继续", Vector2(500, 560), Vector2(180, 60), _on_settle_next)
	_mk_button(scr_settle, "回主城", Vector2(270, 650), Vector2(180, 60), func() -> void: transition_to(STATE_MAIN_CITY))
	lbl_incense = _mk_label(scr_settle, "", Vector2(40, 740), 640, 40, 22)

	scr_totem = _mk_screen()
	_mk_label(scr_totem, "图腾页（香火持久化）", Vector2(0, 40), 720, 50, 24)
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for i: int in range(totems.size()):
		var t: Dictionary = totems[i] as Dictionary
		var b2: Button = _mk_button(scr_totem, "%s（%d 香火）" % [str(t.get("name_cn", "")), int(t.get("cost", 0))], Vector2(40 + (i % 2) * 330, 110 + (i / 2) * 105), Vector2(310, 90), _on_totem_buy.bind(str(t.get("id", ""))))
		b2.name = "totem_" + str(t.get("id", ""))
	_mk_button(scr_totem, "返回主城", Vector2(210, 1080), Vector2(300, 70), func() -> void: transition_to(STATE_MAIN_CITY))


func _mk_screen() -> Control:
	var c: Control = Control.new()
	c.position = Vector2.ZERO
	c.size = Vector2(720, 1280)
	c.visible = false
	add_child(c)
	return c


func _mk_label(parent: Control, text: String, pos: Vector2, w: int, h: int, font_size: int) -> Label:
	var l: Label = Label.new()
	l.position = pos
	l.size = Vector2(w, h)
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	parent.add_child(l)
	return l


func _mk_button(parent: Control, text: String, pos: Vector2, sz: Vector2, cb: Callable) -> Button:
	var b: Button = Button.new()
	b.position = pos
	b.size = sz
	b.text = text
	b.pressed.connect(cb)
	parent.add_child(b)
	return b


func _table(key: String) -> Variant:
	var cfg_node: Variant = Engine.get_main_loop().root.get_node_or_null("Cfg")
	if cfg_node == null:
		return null
	var cfg_obj: Object = cfg_node as Object
	if cfg_obj.has_method("get_table"):
		return cfg_obj.call("get_table", key)
	return null


func _relic_pool() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var raw: Variant = _table("srpg_relics")
	if raw is Array:
		for r: Variant in (raw as Array):
			if r is Dictionary:
				out.append(r as Dictionary)
	return out


func _show_state(to: String) -> void:
	if scr_main == null:
		state = to
		return
	scr_main.visible = to == STATE_MAIN_CITY
	scr_hero.visible = to == STATE_HERO_SELECT
	scr_battle.visible = to == STATE_BATTLE
	scr_settle.visible = to == STATE_SETTLE
	scr_totem.visible = to == STATE_TOTEM
	if to == STATE_HERO_SELECT:
		_refresh_hero_hint()
	elif to == STATE_TOTEM:
		_refresh_totems()


## ---------- 状态流转 ----------

func _on_start_run() -> void:
	# 已购图腾写进开局规则（meta 持久化）
	var owned_totems: Array[Dictionary] = []
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for t: Variant in totems:
		if t is Dictionary and (meta_data.get("totems", []) as Array).has(str((t as Dictionary).get("id", ""))):
			owned_totems.append(t as Dictionary)
	run = {
		"team": [],
		"incense": int(meta_data.get("incense", 0)),
		"shards": 0,
		"kills": 0,
		"totems": meta_data.get("totems", []).duplicate(),
		"relics": [],
		"chapter_idx": 0,
		"hp_carry": {},
		"pending_shield": 0,
		"stun_next": false,
		"boss_mutation": {},
		"price_mod": 1.0,
		"start_rules": meta_sys.start_rules(owned_totems),
	}
	hero_picked.clear()
	transition_to(STATE_HERO_SELECT)


func _on_hero_toggled(idx: int) -> void:
	var chiefs: Array = _table("srpg_chiefs") as Array if _table("srpg_chiefs") is Array else []
	if idx >= chiefs.size():
		return
	var cid: String = str((chiefs[idx] as Dictionary).get("id", ""))
	if hero_picked.has(cid):
		hero_picked.erase(cid)
		hero_buttons[idx].button_pressed = false
	else:
		if hero_picked.size() >= 3:
			return
		hero_picked.append(cid)
		hero_buttons[idx].button_pressed = true
	_refresh_hero_hint()


func _refresh_hero_hint() -> void:
	lbl_hero_hint.text = "已选 %d/3" % [hero_picked.size()]


func _on_team_confirmed() -> void:
	if hero_picked.size() != 3:
		lbl_hero_hint.text = "必须选满 3 名祭司"
		return
	run["team"] = hero_picked.duplicate()
	run["chapter_idx"] = 0
	_start_battle()


## 开局规则 / 携带 HP / 渎神眩晕 / Boss 突变 / boss_dread 层数 全部在此装配
func _start_battle() -> void:
	var chapter_idx: int = int(run.get("chapter_idx", 0))
	var chapters: Array = _table("srpg_chapters") as Array if _table("srpg_chapters") is Array else []
	if chapter_idx >= chapters.size():
		transition_to(STATE_TOTEM)
		return
	var chapter: Dictionary = chapters[chapter_idx] as Dictionary
	var team: Array[Dictionary] = build_team(_table("srpg_chiefs"), run.get("team", []) as Array[String])
	apply_start_rules(team, run.get("start_rules", {}) as Dictionary)
	for d: Dictionary in team:
		var uid: String = str(d.get("id", ""))
		var carry: int = int((run.get("hp_carry", {}) as Dictionary).get(uid, 0))
		if carry > 0:
			d["hp"] = carry
		if int(run.get("pending_shield", 0)) > 0:
			d["shield"] = int(d.get("shield", 0)) + int(run.get("pending_shield", 0))
	var enemies: Array[Dictionary] = roll_enemies(_table("srpg_enemies"), chapter, chapter_idx == CHAPTER_COUNT - 1)
	if battle != null:
		battle.queue_free()
	battle = BabelBattle.new()
	battle.skills_cfg = _table("srpg_skills") as Dictionary if _table("srpg_skills") is Dictionary else {}
	battle.boss_mutation = run.get("boss_mutation", {}) as Dictionary
	battle.boss_id = str(chapter.get("boss_id", ""))
	battle.boss_dread_stacks = chapter_idx
	battle.enemy_turn_hook = Callable()
	battle.battle_finished.connect(_on_battle_finished)
	battle.kills_changed.connect(_on_kills_changed)
	scr_battle.add_child(battle)
	battle.setup("第 %d 章 %s" % [chapter_idx + 1, str(chapter.get("name_cn", ""))], team, enemies)
	# 圣物效果落地到全队
	for r: Dictionary in relic_sys.relics:
		for u: BabelUnit in battle.tm.players:
			relic_sys.apply_effect(r, u, battle.board)
	# 渎神事件：下场战斗开打随机 1 人眩晕 2 回合
	if bool(run.get("stun_next", false)):
		var stunned: BabelUnit = event_sys.roll_stun_target(battle.tm.players, rng)
		if stunned != null:
			print("[BabelMain] 渎神惩罚：%s 开场眩晕" % [str(stunned.unit_id)])
		run["stun_next"] = false
	run["pending_shield"] = 0
	transition_to(STATE_BATTLE)


func _on_kills_changed(count: int) -> void:
	run["kills"] = count


func _on_battle_finished(winner: String) -> void:
	run["hp_carry"] = {}
	if battle != null:
		for u: BabelUnit in battle.tm.players:
			run["hp_carry"][u.chief_id] = u.hp if u.alive else 0
	# 残片入包 + 香火写 meta（meta_system.settle）
	var kills: int = int(run.get("kills", 0))
	run["shards"] = int(run.get("shards", 0)) + kills
	var gained: int = meta_sys.settle(kills, 1)
	meta_data["incense"] = int(meta_data.get("incense", 0)) + gained
	run["incense"] = int(meta_data.get("incense", 0))
	save.save_meta(meta_data)
	_fill_settle(winner, gained)
	transition_to(STATE_SETTLE)


func _fill_settle(winner: String, gained: int) -> void:
	var lines: String = "胜者：%s\n剩余 HP：%s\n总回合数：%s\n击杀 %d → 香火 +%d\n残片：%d" % [
		winner, _hp_carry_text(), str(battle.tm.round_idx if battle != null else 0),
		int(run.get("kills", 0)), gained, int(run.get("shards", 0)),
	]
	lbl_settle_body.text = lines
	lbl_incense.text = "当前香火：%d" % int(meta_data.get("incense", 0))
	_clear_event_box()
	# 事件二选一（BabelEventSystem.pick + choose）
	var chapter_idx: int = int(run.get("chapter_idx", 0))
	var events: Array[Dictionary] = []
	var raw: Variant = _table("srpg_events")
	if raw is Array:
		for g: Variant in (raw as Array):
			if g is Dictionary:
				events.append(g as Dictionary)
	pending_event_group = event_sys.pick(events, chapter_idx + 1, rng)
	var opts: Variant = pending_event_group.get("options", [])
	if opts is Array:
		for o: Variant in (opts as Array):
			if o is Dictionary:
				var opt: Dictionary = o as Dictionary
				var b: Button = Button.new()
				b.text = "事件：%s" % str(opt.get("name_cn", ""))
				b.size = Vector2(640, 56)
				b.pressed.connect(_on_event_pick.bind(opt))
				settle_event_box.add_child(b)
	if winner != "player":
		settle_next_btn.text = "重打本章"
	else:
		settle_next_btn.text = "继续"


func _clear_event_box() -> void:
	for c: Node in settle_event_box.get_children():
		c.queue_free()


func _hp_carry_text() -> String:
	var parts: PackedStringArray = PackedStringArray()
	var chiefs: Array = _table("srpg_chiefs") as Array if _table("srpg_chiefs") is Array else []
	for c: Variant in chiefs:
		if c is Dictionary:
			var d: Dictionary = c as Dictionary
			var cid: String = str(d.get("id", ""))
			if (run.get("team", []) as Array).has(cid):
				var hp: int = int((run.get("hp_carry", {}) as Dictionary).get(cid, int(d.get("hp", 30))))
				parts.append("%s %d/%d" % [str(d.get("name_cn", "")), hp, int(d.get("hp", 30))])
	return ", ".join(parts)


## 事件二选一：效果真正 apply 到队伍；渎神记录眩晕；Boss mutation 存入章 Boss
func _on_event_pick(opt: Dictionary) -> void:
	event_sys.choose(pending_event_group, str(opt.get("track", "")))
	if battle != null:
		event_sys.apply_effects(battle.tm.players, battle.board, relic_sys)
	for fx: Variant in event_sys.pending_effects:
		if fx is Dictionary and str((fx as Dictionary).get("type", "")) == "battle_start_stun":
			run["stun_next"] = true
	if not event_sys.boss_mutation.is_empty():
		run["boss_mutation"] = event_sys.boss_mutation
	# 事件加价（shop_price_add 落在 board meta）
	if battle != null and battle.board.has_meta("shop_price_add"):
		run["price_mod"] = float(run.get("price_mod", 1.0)) + float(battle.board.get_meta("shop_price_add"))
	lbl_incense.text = "已选事件：%s（效果已生效）" % str(event_sys.last_choice.get("name_cn", ""))
	_clear_event_box()
	# 第二章末：封圣三选一（relic_system.roll 三选一 UI）
	if int(run.get("chapter_idx", 0)) == CANONIZE_CHAPTER_IDX:
		_show_canonize_choices()


## 封圣三选一：抽 3 枚圣物供选择，选一入包
func _show_canonize_choices() -> void:
	canonize_choices.clear()
	var pool: Array[Dictionary] = _relic_pool()
	for i: int in range(3):
		var r: Dictionary = relic_sys.roll_relic(rng, pool, false)
		if r.is_empty():
			continue
		canonize_choices.append(r)
		var b: Button = Button.new()
		b.text = "封圣：%s（%s）" % [str(r.get("name_cn", "")), str(r.get("rarity", "white"))]
		b.size = Vector2(640, 56)
		b.pressed.connect(_on_canonize_pick.bind(r))
		settle_event_box.add_child(b)


func _on_canonize_pick(relic: Dictionary) -> void:
	relic_sys.add_relic(relic)
	if not (run.get("relics", []) as Array).has(str(relic.get("id", ""))):
		(run["relics"] as Array).append(str(relic.get("id", "")))
	lbl_incense.text = "封圣完成：%s 已入圣物栏" % str(relic.get("name_cn", ""))
	_clear_event_box()


## 商店：BabelShopSystem 进货（读 cfg/srpg_shop.json 定价），残片支付
func _on_shop_pressed() -> void:
	var pool: Array[Dictionary] = _relic_pool()
	var price_mod: float = float(run.get("price_mod", 1.0))
	var stock_n: int = BabelShopSystem.stock_count()
	var items: Array[Dictionary] = shop_sys.stock(rng, pool, stock_n)
	var bought: int = 0
	var lines: PackedStringArray = PackedStringArray()
	for item: Dictionary in items:
		var rid: String = str(item.get("id", ""))
		if (run.get("relics", []) as Array).has(rid):
			continue
		var result: Dictionary = shop_sys.buy(item, int(run.get("shards", 0)), price_mod)
		if bool(result.get("ok", false)):
			run["shards"] = int(result.get("shards_left", 0))
			relic_sys.add_relic(item)
			(run["relics"] as Array).append(rid)
			bought += 1
			lines.append("%s（%d 残片）" % [str(item.get("name_cn", rid)), int(result.get("cost", 0))])
	# 未购入的货架提供刷新（reroll 读表计费）
	if bought == 0 and int(run.get("shards", 0)) >= BabelShopSystem.reroll_cost():
		var refreshed: Array[Dictionary] = shop_sys.reroll(rng, pool, int(run.get("shards", 0)), stock_n, price_mod)
		if not refreshed.is_empty():
			run["shards"] = int(run.get("shards", 0)) - BabelShopSystem.reroll_cost()
			lines.append("已刷新货架（-%d 残片）" % [BabelShopSystem.reroll_cost()])
	save.save_run(run)
	lbl_incense.text = "商店：购入 %d 件%s，剩余残片 %d" % [bought, " | ".join(lines) if not lines.is_empty() else "", int(run.get("shards", 0))]


func _on_settle_next() -> void:
	if int(run.get("chapter_idx", 0)) < CHAPTER_COUNT - 1:
		run["chapter_idx"] = int(run.get("chapter_idx", 0)) + 1
		save.save_run(run)
		transition_to(STATE_BATTLE)
		_start_battle()
	else:
		# 局结束：清 run 快照，meta（香火/图腾）保留
		save.clear_run()
		transition_to(STATE_TOTEM)


## 图腾：meta_system.buy_totem 扣香火；购买写 meta 并持久化
func _on_totem_buy(tid: String) -> void:
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for t: Variant in totems:
		if t is Dictionary and str((t as Dictionary).get("id", "")) == tid:
			var d: Dictionary = t as Dictionary
			if (meta_data.get("totems", []) as Array).has(tid):
				return
			var result: Dictionary = meta_sys.buy_totem(d, int(meta_data.get("incense", 0)))
			if bool(result.get("ok", false)):
				meta_data["incense"] = int(result.get("incense_left", 0))
				(meta_data["totems"] as Array).append(tid)
				if not (run.get("totems", []) as Array).has(tid):
					(run["totems"] as Array).append(tid)
				save.save_meta(meta_data)
	_refresh_totems()


func _refresh_totems() -> void:
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for t: Variant in totems:
		if t is Dictionary:
			var d: Dictionary = t as Dictionary
			var tid: String = str(d.get("id", ""))
			var node: Node = scr_totem.find_child("totem_" + tid, false, false)
			if node is Button:
				var b: Button = node as Button
				var owned: bool = (meta_data.get("totems", []) as Array).has(tid)
				b.disabled = owned or int(meta_data.get("incense", 0)) < int(d.get("cost", 0))
				b.text = "%s（%d 香火）%s" % [str(d.get("name_cn", "")), int(d.get("cost", 0)), "已购" if owned else ""]
