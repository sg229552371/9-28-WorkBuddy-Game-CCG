class_name FxFeedback
extends Node2D
## Battle feedback FX layer (S1-S3 presentation port from html CFG.feedback).
## Owns: damage float text, enemy hit flash, kill burst particles, hitstop,
## extract red vignette pulse + heartbeat, procedural SFX (AudioStreamWAV).
## NOTE: combat.gd / battle.gd are read-only for this module. All wiring is
## defensive: connect signal if it exists, else poll public members.

const CFG_PATH := "res://cfg/feedback.json"
const PARTICLE_MIN := 8
const PARTICLE_MAX := 12

var cfg: Dictionary = {}
var _battle: Node = null
var _combat: Node = null
var _sig_hit := false
var _sig_kill := false
var _sig_extract_on := false
var _sig_extract_off := false
var _hit_idx := 0

# hitstop state
var _hitstop_until_ms := -1000000
var _last_hitstop_ms := -1000000

# kill particle pool (object_pool.gd reuses particle dicts)
var _particle_pool: ObjectPool = null

# extract state
var _extract_active := false
var _extract_elapsed := 0.0
var _extract_total := 0.0
var _heartbeat_accum := 0.0

# audio
var _streams: Dictionary = {}
var _players: Array = []
var _player_idx := 0
var _vignette: Vignette = null
var _fx_layer: Node2D = null

# ---------------------------------------------------------------- lifecycle
func _ready() -> void:
	_load_cfg()
	_fx_layer = Node2D.new()
	_fx_layer.name = "FxLayer"
	add_child(_fx_layer)
	if _particle_pool == null:
		var factory := func(): return {"vel": Vector2.ZERO, "life": 0.0, "max_life": 0.0}
		var reset := func(p): p.vel = Vector2.ZERO; p.life = 0.0; p.max_life = 0.0
		_particle_pool = ObjectPool.new(factory, reset, 16)
	_build_streams()
	for i in 6:
		var pl := AudioStreamPlayer.new()
		pl.stream = null
		add_child(pl)
		_players.append(pl)
	var master_vol: float = float(_aud().get("master", 0.45))
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(master_vol, 0.001)))
	_setup_vignette()
	_connect_signals()

func setup(battle: Node) -> void:
	_battle = battle

func _load_cfg() -> void:
	if FileAccess.file_exists(CFG_PATH):
		var f := FileAccess.open(CFG_PATH, FileAccess.READ)
		if f != null:
			var parsed: Variant = JSON.parse_string(f.get_as_text())
			if parsed is Dictionary:
				cfg = parsed
	else:
		push_warning("[FxFeedback] missing cfg: " + CFG_PATH)

func _sec(key: String) -> Dictionary:
	var d: Variant = cfg.get(key, {})
	return d if d is Dictionary else {}

func _aud() -> Dictionary:
	return _sec("audio")

# ---------------------------------------------------------------- signal wiring
func _connect_signals() -> void:
	if _battle == null:
		_battle = get_parent()
	if _battle != null:
		var c: Variant = _battle.get("combat")
		_combat = c if c is Node else null
	# damage -> float text / flash / hitstop
	if _combat != null and _combat.has_signal("damage_dealt"):
		_combat.connect("damage_dealt", _on_damage_dealt)
		_sig_hit = true
	else:
		push_warning("[FxFeedback] combat.damage_dealt missing -> poll last_hits")
	# kill -> burst
	if _combat != null and _combat.has_signal("monster_killed"):
		_combat.connect("monster_killed", _on_monster_killed)
		_sig_kill = true
	else:
		push_warning("[FxFeedback] combat.monster_killed missing -> poll disabled")
	# extract on/off
	_sig_extract_on = _try_connect_extract("extract_started", _on_extract_started)
	_sig_extract_off = _try_connect_extract("extract_ended", _on_extract_ended)
	if not (_sig_extract_on and _sig_extract_off):
		push_warning("[FxFeedback] extract signals missing -> poll battle state")

func _try_connect_extract(sig: String, fn: Callable) -> bool:
	for node: Node in [_battle, _combat]:
		if node != null and node.has_signal(sig):
			node.connect(sig, fn)
			return true
	return false

# ---------------------------------------------------------------- event intake
func _on_damage_dealt(payload: Variant) -> void:
	var h := _parse_hit(payload)
	if h.is_empty():
		return
	_spawn_hit_fx(h)

func _on_monster_killed(m: Variant) -> void:
	var d: Dictionary = m if m is Dictionary else {}
	var pos := _vec_of(d.get("pos", d.get("position", Vector2.ZERO)))
	_spawn_kill_burst(pos)
	_play("kill_pop")

func _on_extract_started() -> void:
	_extract_active = true
	_extract_elapsed = 0.0
	_extract_total = 0.0
	if FileAccess.file_exists("res://cfg/extract.json"):
		var f := FileAccess.open("res://cfg/extract.json", FileAccess.READ)
		if f != null:
			var parsed: Variant = JSON.parse_string(f.get_as_text())
			if parsed is Dictionary:
				_extract_total = float(parsed.get("channel", 8.0))

func _on_extract_ended() -> void:
	_extract_active = false

## Normalize a hit record (signal payload or last_hits entry) defensively.
func _parse_hit(v: Variant) -> Dictionary:
	if not (v is Dictionary):
		return {}
	var d: Dictionary = v
	var dmg := float(d.get("dmg", d.get("amount", 0.0)))
	if dmg <= 0.0:
		return {}
	var pos := _vec_of(d.get("pos", d.get("position", Vector2.ZERO)))
	var max_hp := float(d.get("max_hp", d.get("maxHp", 0.0)))
	return {
		"dmg": dmg,
		"pos": pos,
		"crit": bool(d.get("crit", d.get("is_crit", false))),
		"killed": bool(d.get("killed", d.get("is_kill", false))),
		"max_hp": max_hp,
		"boss": bool(d.get("boss", d.get("is_boss", false))),
	}

func _vec_of(v: Variant) -> Vector2:
	if v is Vector2:
		return v
	if v is Array and (v as Array).size() >= 2:
		return Vector2(float((v as Array)[0]), float((v as Array)[1]))
	return Vector2.ZERO

# ---------------------------------------------------------------- polling fallback
func _process(delta: float) -> void:
	if not _sig_hit:
		_poll_hits()
	if not (_sig_extract_on and _sig_extract_off):
		_poll_extract()
	_update_particles(delta)
	_update_extract(delta)
	_process_hitstop()

func _poll_hits() -> void:
	if _combat == null:
		return
	var arr: Variant = _combat.get("last_hits")
	if not (arr is Array):
		return
	var a: Array = arr
	while _hit_idx < a.size():
		var h := _parse_hit(a[_hit_idx])
		_hit_idx += 1
		if not h.is_empty():
			_spawn_hit_fx(h)

func _poll_extract() -> void:
	var prev := _extract_active
	_extract_active = false
	for node: Node in [_battle, _combat]:
		if node == null:
			continue
		for prop: String in ["extracting", "extract_active"]:
			var v: Variant = node.get(prop)
			if v is bool:
				_extract_active = _extract_active or v
	if _extract_active and not prev:
		_extract_elapsed = 0.0

# ---------------------------------------------------------------- hit fx
func _spawn_hit_fx(h: Dictionary) -> void:
	var crit := bool(h.get("crit", false))
	var dmg := float(h.get("dmg", 0.0))
	var pos: Vector2 = h.get("pos", Vector2.ZERO)
	_spawn_float(pos, dmg, crit)
	_spawn_flash(pos)
	if crit or _big_hit(h):
		if try_hitstop(float(h.get("dmg", 0.0)), float(h.get("max_hp", 0.0)), bool(h.get("boss", false))):
			_play("hitstop_thud")
	if crit:
		_play("crit")
	if dmg > 0.0:
		_play_hit_tier(h)

func _big_hit(h: Dictionary) -> bool:
	var hp := float(h.get("max_hp", 0.0))
	if hp <= 0.0:
		return false
	var ratio: float = _sec("hitstop").get("hpRatio", 0.06)
	return float(h.get("dmg", 0.0)) >= hp * ratio

func _spawn_float(pos: Vector2, dmg: float, crit: bool) -> void:
	var fl := _sec("float")
	var jit := float(fl.get("jitter", 6.0))
	var off := Vector2(randf_range(-jit, jit), randf_range(-jit, jit))
	var ft := FloatText.new()
	ft.position = pos + off
	ft.amount = dmg
	ft.is_crit = crit
	ft.life_max = float(fl.get("dur", 1.2))
	ft.scale_mul = float(fl.get("critScale", 1.5)) if crit else 1.0
	ft.z_index = 100
	_fx_layer.add_child(ft)
	ft.start()

func _spawn_flash(pos: Vector2) -> void:
	var fs := FlashCircle.new()
	fs.position = pos
	fs.life_max = 0.12
	fs.z_index = 90
	_fx_layer.add_child(fs)
	fs.start()

func _spawn_kill_burst(pos: Vector2) -> void:
	var n := randi_range(PARTICLE_MIN, PARTICLE_MAX)
	for i in n:
		var p: Dictionary = _particle_pool.obtain()
		var ang := randf() * TAU
		var spd := randf_range(60.0, 180.0)
		p.vel = Vector2(cos(ang), sin(ang)) * spd
		p.max_life = randf_range(0.25, 0.5)
		p.life = p.max_life
		p["pos"] = pos

func _update_particles(delta: float) -> void:
	if _particle_pool == null:
		return
	var i := _particle_pool.buf.size() - 1
	while i >= 0:
		var p: Dictionary = _particle_pool.buf[i]
		p.life = float(p.life) - delta
		if float(p.life) <= 0.0:
			_particle_pool.release(p)
		else:
			p["pos"] = _vec_of(p.get("pos", Vector2.ZERO)) + Vector2(p.vel) * delta
		i -= 1
	queue_redraw()

# ---------------------------------------------------------------- hitstop
## Returns true if hitstop engaged (40ms at 0.15 time_scale, 0.5s cooldown).
func try_hitstop(dmg: float, max_hp: float, is_boss: bool) -> bool:
	var hs := _sec("hitstop")
	if is_boss and bool(hs.get("bossExempt", true)):
		return false
	if max_hp > 0.0 and dmg < max_hp * float(hs.get("hpRatio", 0.06)):
		return false
	var now := Time.get_ticks_msec()
	if now - _last_hitstop_ms < int(float(hs.get("cooldown", 0.5)) * 1000.0):
		return false
	_last_hitstop_ms = now
	_hitstop_until_ms = now + int(float(hs.get("dur", 0.04)) * 1000.0)
	Engine.time_scale = float(hs.get("timeScale", 0.15))
	return true

func _process_hitstop() -> void:
	if Engine.time_scale < 1.0 and Time.get_ticks_msec() >= _hitstop_until_ms:
		Engine.time_scale = 1.0

func _notification(what: int) -> void:
	if what == NOTIFICATION_EXIT_TREE and Engine.time_scale < 1.0:
		Engine.time_scale = 1.0

func _reset_hitstop_for_test() -> void:
	Engine.time_scale = 1.0
	_last_hitstop_ms = -1000000

# ---------------------------------------------------------------- extract pulse
func _setup_vignette() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 90
	_vignette = Vignette.new()
	_vignette.fx = self
	layer.add_child(_vignette)
	add_child(layer)

func _update_extract(delta: float) -> void:
	if _extract_active:
		_extract_elapsed += delta
		# heartbeat bpm ramps 60 -> 120 across the channel duration
		var hb_v: Variant = _aud().get("heartbeat", {})
		var hb: Dictionary = hb_v if hb_v is Dictionary else {}
		var bpm0 := float(hb.get("bpmStart", 60.0))
		var bpm1 := float(hb.get("bpmEnd", 120.0))
		var t := clampf(_extract_elapsed / maxf(_extract_total, 0.001), 0.0, 1.0)
		var bpm := lerpf(bpm0, bpm1, t)
		_heartbeat_accum += delta * bpm / 60.0
		if _heartbeat_accum >= 1.0:
			_heartbeat_accum -= 1.0
			_play("heartbeat", float(hb.get("gain", 0.16)))
	else:
		_heartbeat_accum = 0.0
	if _vignette != null:
		_vignette.queue_redraw()

# ---------------------------------------------------------------- draw (particles)
func _draw() -> void:
	if _particle_pool == null:
		return
	for p: Dictionary in _particle_pool.buf:
		var t := float(p.life) / maxf(float(p.max_life), 0.001)
		var col := Color(1.0, 0.92, 0.6, t)
		draw_circle(Vector2(p.get("pos", Vector2.ZERO)), 2.5, col)

# ---------------------------------------------------------------- audio
## 12 SFX mappings (event -> waveform), built once, cached in _streams.
func _build_streams() -> void:
	var rate := int(_aud().get("sampleRate", 22050))
	var sp: Variant = _aud().get("shootPitch", {})
	if not (sp is Dictionary):
		sp = {}
	var shoot_f := 660.0 * float(sp.get("min", 0.8))
	_streams["shoot"] = _synth(rate, "square", [[shoot_f, 0.08]], 0.20)
	_streams["hit_s"] = _synth(rate, "noise", [[300.0, 0.07]], 0.25)
	_streams["hit_m"] = _synth(rate, "noise", [[500.0, 0.09]], 0.30)
	_streams["hit_l"] = _synth(rate, "noise", [[800.0, 0.12]], 0.35)
	_streams["crit"] = _synth(rate, "square", [[520.0, 0.06], [780.0, 0.10]], 0.28)
	_streams["pickup"] = _synth(rate, "sine", [[523.0, 0.07], [784.0, 0.09]], 0.28)
	_streams["levelup"] = _synth(rate, "sine", [[523.0, 0.16], [659.0, 0.16], [784.0, 0.16], [1046.0, 0.24]], 0.24)
	_streams["ui"] = _synth(rate, "square", [[880.0, 0.03]], 0.14)
	_streams["death"] = _synth(rate, "saw", [[440.0, 0.16], [330.0, 0.16], [220.0, 0.30]], 0.30)
	_streams["settle"] = _synth(rate, "sine", [[523.0, 0.10], [659.0, 0.10], [784.0, 0.18]], 0.26)
	_streams["heartbeat"] = _synth(rate, "sine", [[60.0, 0.09], [0.0, 0.04], [55.0, 0.09]], 0.35)
	_streams["kill_pop"] = _synth(rate, "noise", [[220.0, 0.06]], 0.22)
	_streams["hitstop_thud"] = _synth(rate, "sine", [[90.0, 0.08]], 0.30)
	_streams["extract_alarm"] = _synth(rate, "square", [[440.0, 0.12], [554.0, 0.12]], 0.20)

## notes: Array of [freq_hz, dur_s]; freq 0 = silence gap.
func _synth(rate: int, wave: String, notes: Array, gain: float) -> AudioStreamWAV:
	var total_frames := 0
	for n: Array in notes:
		total_frames += int(float(n[1]) * float(rate))
	var data := PackedByteArray()
	data.resize(total_frames * 2)
	var frame := 0
	var phase := 0.0
	for n: Array in notes:
		var freq := float(n[0])
		var frames := int(float(n[1]) * float(rate))
		for i in frames:
			var s := 0.0
			if freq > 0.0:
				phase += TAU * freq / float(rate)
				if phase > TAU:
					phase -= TAU
				match wave:
					"square": s = 1.0 if sin(phase) >= 0.0 else -1.0
					"saw": s = (phase / TAU) * 2.0 - 1.0
					"noise": s = randf_range(-1.0, 1.0)
					_: s = sin(phase)
				# short attack/decay envelope per note
				var env := minf(float(i) / 64.0, 1.0) * minf(float(frames - i) / float(rate * 0.02), 1.0)
				s *= env
			var v := int(clampf(s * gain, -1.0, 1.0) * 32767.0)
			data[frame * 2] = v & 0xFF
			data[frame * 2 + 1] = (v >> 8) & 0xFF
			frame += 1
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = rate
	wav.stereo = false
	wav.data = data
	return wav

func _play(name: String, gain_mul: float = 1.0) -> void:
	var st: Variant = _streams.get(name)
	if not (st is AudioStreamWAV):
		return
	var pl: AudioStreamPlayer = _players[_player_idx]
	_player_idx = (_player_idx + 1) % _players.size()
	pl.stream = st
	pl.volume_db = linear_to_db(maxf(gain_mul, 0.001))
	pl.play()

## Hit tier sound by dmg/max_hp ratio (CFG.audio.hitTiers thresholds).
func _play_hit_tier(h: Dictionary) -> void:
	var hp := float(h.get("max_hp", 0.0))
	var tiers: Variant = _aud().get("hitTiers", {})
	if not (tiers is Dictionary):
		tiers = {}
	var r := float(h.get("dmg", 0.0)) / maxf(hp, 0.001)
	if hp > 0.0 and r >= float(tiers.get("big", 0.15)):
		_play("hit_l")
	elif hp > 0.0 and r >= float(tiers.get("mid", 0.06)):
		_play("hit_m")
	else:
		_play("hit_s")

func streams() -> Dictionary:
	return _streams

func particle_pool() -> ObjectPool:
	return _particle_pool

func extract_active() -> bool:
	return _extract_active

# ================================================================ inner nodes
class FloatText extends Node2D:
	var amount := 0.0
	var is_crit := false
	var life_max := 1.2
	var life := 0.0
	var scale_mul := 1.0

	func start() -> void:
		life = life_max

	func _process(delta: float) -> void:
		life -= delta
		position.y -= 36.0 * delta
		modulate.a = clampf(life / life_max, 0.0, 1.0)
		if life <= 0.0:
			queue_free()
		queue_redraw()

	func _draw() -> void:
		var f := ThemeDB.fallback_font
		if f == null:
			return
		var size := int(16.0 * scale_mul)
		var col := Color(1.0, 0.84, 0.25) if is_crit else Color.WHITE
		var txt := str(int(round(amount)))
		draw_string_outline(f, Vector2.ZERO, txt, HORIZONTAL_ALIGNMENT_CENTER, -40.0, size, 3, Color.BLACK)
		draw_string(f, Vector2.ZERO, txt, HORIZONTAL_ALIGNMENT_CENTER, -40.0, size, col)

class FlashCircle extends Node2D:
	var life_max := 0.12
	var life := 0.0

	func start() -> void:
		life = life_max

	func _process(delta: float) -> void:
		life -= delta
		if life <= 0.0:
			queue_free()
		queue_redraw()

	func _draw() -> void:
		var t := clampf(life / life_max, 0.0, 1.0)
		draw_circle(Vector2.ZERO, 14.0 + (1.0 - t) * 10.0, Color(1.0, 1.0, 1.0, t * 0.85))

class Vignette extends Node2D:
	var fx: FxFeedback = null

	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		if fx == null or not fx.extract_active():
			return
		var ep: Dictionary = fx.cfg.get("extractPulse", {})
		if not (ep is Dictionary) or ep.is_empty():
			return
		var parts: PackedStringArray = str(ep.get("color", "229,72,77")).split(",")
		var base := Color8(int(parts[0]), int(parts[1]), int(parts[2]))
		var base_a := float(ep.get("baseAlpha", 0.22))
		var amp := float(ep.get("ampAlpha", 0.18))
		var speed := float(ep.get("speed", 6.0))
		var edge := float(ep.get("edge", 150.0))
		var a := base_a + amp * (0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.001 * speed))
		var col := base
		col.a = a
		var vp := get_viewport_rect().size
		draw_rect(Rect2(Vector2.ZERO, vp), col, false, edge)
		draw_rect(Rect2(Vector2.ZERO, vp), Color(col.r, col.g, col.b, a * 0.35))
