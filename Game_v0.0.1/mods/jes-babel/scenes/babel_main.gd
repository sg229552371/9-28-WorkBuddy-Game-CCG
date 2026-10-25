## 《巴别回路》主流程：9:16 竖屏状态机 main_city|hero_select|battle|settle|totem。
## 只接线 scripts/ 四核心类 + Cfg 表；systems 六系统预留 Callable 注入口。
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
## 商店价格（按稀有度，PLACEHOLDER：正式定价留给批次 D meta 系统）
const SHOP_PRICE: Dictionary = {"white": 15, "blue": 30, "gold": 60}
## 残片兑换香火：击杀数 × 2（PLACEHOLDER，批次 D 接 meta）
const SHARD_PER_KILL: int = 2
const CHAPTER_COUNT: int = 3

## 状态切换完成（state: String）
signal state_changed(state: String)

var state: String = STATE_MAIN_CITY
## 本局会话数据（存档持久化留给批次 D）
var run: Dictionary = {
	"team": [],
	"incense": 0,
	"kills": 0,
	"totems": [],
	"relics": [],
	"chapter_idx": 0,
	"hp_carry": {},
	"pending_shield": 0,
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


## 按章节滚动敌人：mob 数 = 3 + 章序号（3~6 含 Boss 位），最终章附加 Boss
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
		})
	if is_final:
		var boss_id: String = str(chapter.get("boss_id", ""))
		if boss_id != "" and enemies_table is Array:
			for e: Variant in (enemies_table as Array):
				if e is Dictionary and str((e as Dictionary).get("id", "")) == boss_id:
					var bd: Dictionary = e as Dictionary
					out.append({
						"id": boss_id,
						"name_cn": str(bd.get("name_cn", "")),
						"hp": int(chapter.get("boss_hp", int(bd.get("hp", 90)))),
						"dmg": int(chapter.get("boss_dmg", int(bd.get("dmg", 8)))),
						"move": int(bd.get("move", 3)),
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


## 香火结算：残片模拟 = 击杀数 × 2（PLACEHOLDER）
static func settle_incense(kills: int) -> int:
	return kills * SHARD_PER_KILL


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
	_mk_label(scr_totem, "图腾页（本会话生效，持久化留给批次 D）", Vector2(0, 40), 720, 50, 24)
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for i: int in range(totems.size()):
		var t: Dictionary = totems[i] as Dictionary
		var b: Button = _mk_button(scr_totem, "%s（%d 香火）" % [str(t.get("name_cn", "")), int(t.get("cost", 0))], Vector2(40 + (i % 2) * 330, 110 + (i / 2) * 105), Vector2(310, 90), _on_totem_buy.bind(str(t.get("id", ""))))
		b.name = "totem_" + str(t.get("id", ""))
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
	run = {
		"team": [],
		"incense": 0,
		"kills": 0,
		"totems": run.get("totems", []),
		"relics": [],
		"chapter_idx": 0,
		"hp_carry": {},
		"pending_shield": 0,
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


## 组队装配留口：systems/meta 就绪后可在此附加圣物/图腾起始效果
func _start_battle() -> void:
	var chapter_idx: int = int(run.get("chapter_idx", 0))
	var chapters: Array = _table("srpg_chapters") as Array if _table("srpg_chapters") is Array else []
	if chapter_idx >= chapters.size():
		transition_to(STATE_TOTEM)
		return
	var chapter: Dictionary = chapters[chapter_idx] as Dictionary
	var team: Array[Dictionary] = build_team(_table("srpg_chiefs"), run.get("team", []) as Array[String])
	for d: Dictionary in team:
		var uid: String = str(d.get("id", ""))
		var carry: int = int((run.get("hp_carry", {}) as Dictionary).get(uid, 0))
		if carry > 0:
			d["hp"] = carry
		if int(run.get("pending_shield", 0)) > 0:
			d["shield"] = int(run.get("pending_shield", 0))
	var enemies: Array[Dictionary] = roll_enemies(_table("srpg_enemies"), chapter, chapter_idx == CHAPTER_COUNT - 1)
	if battle != null:
		battle.queue_free()
	battle = BabelBattle.new()
	battle.skills_cfg = _table("srpg_skills") as Dictionary if _table("srpg_skills") is Dictionary else {}
	battle.battle_finished.connect(_on_battle_finished)
	battle.kills_changed.connect(_on_kills_changed)
	scr_battle.add_child(battle)
	battle.setup("第 %d 章 %s" % [chapter_idx + 1, str(chapter.get("name_cn", ""))], team, enemies)
	run["pending_shield"] = 0
	transition_to(STATE_BATTLE)


func _on_kills_changed(count: int) -> void:
	run["kills"] = count


func _on_battle_finished(winner: String) -> void:
	run["hp_carry"] = {}
	if battle != null:
		for u: BabelUnit in battle.tm.players:
			run["hp_carry"][u.chief_id] = u.hp if u.alive else 0
	var gained: int = settle_incense(int(run.get("kills", 0)))
	run["incense"] = int(run.get("incense", 0)) + gained
	_fill_settle(winner, gained)
	transition_to(STATE_SETTLE)


func _fill_settle(winner: String, gained: int) -> void:
	var lines: String = "胜者：%s\n剩余 HP：%s\n总回合数：%s\n击杀 %d → 香火 +%d（残片模拟）" % [
		winner, _hp_carry_text(), str(battle.tm.round_idx if battle != null else 0),
		int(run.get("kills", 0)), gained,
	]
	lbl_settle_body.text = lines
	lbl_incense.text = "当前香火：%d" % int(run.get("incense", 0))
	for c: Node in settle_event_box.get_children():
		c.queue_free()
	var chapter_idx: int = int(run.get("chapter_idx", 0))
	var events: Array = _table("srpg_events") as Array if _table("srpg_events") is Array else []
	if chapter_idx < events.size():
		var opts: Array = ((events[chapter_idx] as Dictionary).get("options", []) as Array)
		for i: int in range(opts.size()):
			var opt: Dictionary = opts[i] as Dictionary
			var b: Button = Button.new()
			b.text = "事件：%s" % str(opt.get("name_cn", ""))
			b.size = Vector2(640, 56)
			b.pressed.connect(_on_event_pick.bind(opt))
			settle_event_box.add_child(b)
	if winner != "player":
		settle_next_btn.text = "重打本章"
	else:
		settle_next_btn.text = "继续"


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


## 事件二选一：team_shield 立即生效，其余记录留待 systems 接线（Callable 注入口）
func _on_event_pick(opt: Dictionary) -> void:
	var effects: Array = opt.get("effects", []) as Array
	for e: Variant in effects:
		if e is Dictionary:
			var ed: Dictionary = e as Dictionary
			if str(ed.get("type", "")) == "team_shield":
				run["pending_shield"] = int(run.get("pending_shield", 0)) + int(ed.get("value", 0))
	lbl_incense.text = "已选事件：%s（未接线效果记录留待 systems）" % str(opt.get("name_cn", ""))
	for c: Node in settle_event_box.get_children():
		(c as Node).queue_free()


## 商店：简单出售圣物（PLACEHOLDER 定价；systems/shop 就绪后替换为 hook）
func _on_shop_pressed() -> void:
	var relics: Array = _table("srpg_relics") as Array if _table("srpg_relics") is Array else []
	var bought: int = 0
	for r: Variant in relics:
		if bought >= 3:
			break
		var d: Dictionary = r as Dictionary
		var rid: String = str(d.get("id", ""))
		if (run.get("relics", []) as Array).has(rid):
			continue
		var price: int = int(SHOP_PRICE.get(str(d.get("rarity", "white")), 15))
		if int(run.get("incense", 0)) >= price:
			run["incense"] = int(run.get("incense", 0)) - price
			(run["relics"] as Array).append(rid)
			bought += 1
	lbl_incense.text = "商店：购入 %d 件圣物（%s），剩余香火 %d" % [bought, ", ".join(run.get("relics", []) as Array), int(run.get("incense", 0))]


func _on_settle_next() -> void:
	if int(run.get("chapter_idx", 0)) < CHAPTER_COUNT - 1:
		run["chapter_idx"] = int(run.get("chapter_idx", 0)) + 1
		transition_to(STATE_BATTLE)
		_start_battle()
	else:
		transition_to(STATE_TOTEM)


## 图腾：买入只存本会话 Dictionary；买不起置灰
func _on_totem_buy(tid: String) -> void:
	var totems: Array = _table("srpg_totems") as Array if _table("srpg_totems") is Array else []
	for t: Variant in totems:
		if t is Dictionary and str((t as Dictionary).get("id", "")) == tid:
			var d: Dictionary = t as Dictionary
			var cost: int = int(d.get("cost", 0))
			if (run.get("totems", []) as Array).has(tid):
				return
			if int(run.get("incense", 0)) < cost:
				return
			run["incense"] = int(run.get("incense", 0)) - cost
			(run["totems"] as Array).append(tid)
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
				var owned: bool = (run.get("totems", []) as Array).has(tid)
				b.disabled = owned or int(run.get("incense", 0)) < int(d.get("cost", 0))
				b.text = "%s（%d 香火）%s" % [str(d.get("name_cn", "")), int(d.get("cost", 0)), "已购" if owned else ""]
