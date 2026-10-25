extends GutTest
## FxFeedback unit tests: float lifecycle, hitstop cooldown, WAV generation,
## feedback.json field integrity.

const FxScript := preload("res://mods/jes-engine-core/scripts/fx_feedback.gd")
const CFG_PATH := "res://cfg/feedback.json"

func _make_fx() -> FxFeedback:
	var fx := FxScript.new()
	add_child_autofree(fx)
	return fx

func _cfg() -> Dictionary:
	var f := FileAccess.open(CFG_PATH, FileAccess.READ)
	assert_true(f != null, "feedback.json exists")
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	assert_true(parsed is Dictionary, "feedback.json parses to Dictionary")
	return parsed if parsed is Dictionary else {}

func test_feedback_json_field_integrity() -> void:
	var c := _cfg()
	for key: String in ["crit", "hitstop", "float", "extractPulse", "audio"]:
		assert_true(c.has(key), "top-level key: " + key)
	assert_true(c.get("crit", {}).has("chance"), "crit.chance")
	assert_true(c.get("crit", {}).has("dmgMul"), "crit.dmgMul")
	assert_true(c.get("crit", {}).has("minDmg"), "crit.minDmg")
	var hs: Variant = c.get("hitstop", {})
	for k: String in ["dur", "timeScale", "cooldown", "hpRatio", "bossExempt"]:
		assert_true(hs.has(k), "hitstop." + k)
	var fl: Variant = c.get("float", {})
	for k: String in ["jitter", "critScale", "dur"]:
		assert_true(fl.has(k), "float." + k)
	var ep: Variant = c.get("extractPulse", {})
	for k: String in ["color", "baseAlpha", "ampAlpha", "speed", "edge"]:
		assert_true(ep.has(k), "extractPulse." + k)
	var aud: Variant = c.get("audio", {})
	for k: String in ["sampleRate", "shootPitch", "hitTiers", "heartbeat", "master"]:
		assert_true(aud.has(k), "audio." + k)

func test_float_text_lifecycle() -> void:
	var fx := _make_fx()
	fx._spawn_float(Vector2.ZERO, 42.0, false)
	assert_eq(fx._fx_layer.get_child_count(), 1, "one float spawned")
	var ft: Variant = fx._fx_layer.get_child(0)
	assert_true(ft is Node2D, "float is Node2D")
	await get_tree().create_timer(0.1).timeout
	assert_true(is_instance_valid(ft), "float alive shortly after spawn")
	ft.life = 0.02
	await get_tree().create_timer(0.2).timeout
	assert_false(is_instance_valid(ft), "float freed after lifetime + margin")

func test_hitstop_cooldown() -> void:
	var fx := _make_fx()
	assert_true(fx.try_hitstop(100.0, 1000.0, false), "first hitstop engages")
	assert_true(Engine.time_scale < 1.0, "time_scale lowered during hitstop")
	assert_false(fx.try_hitstop(100.0, 1000.0, false), "second hitstop blocked by cooldown")
	assert_false(fx.try_hitstop(100.0, 1000.0, true), "boss exempt blocks hitstop")
	fx._reset_hitstop_for_test()
	assert_eq(Engine.time_scale, 1.0, "time_scale restored")

func test_hitstop_respects_cooldown_after_expiry() -> void:
	var fx := _make_fx()
	assert_true(fx.try_hitstop(100.0, 1000.0, false))
	fx._reset_hitstop_for_test()
	fx._last_hitstop_ms -= 1000
	assert_true(fx.try_hitstop(100.0, 1000.0, false), "cooldown elapsed -> engage again")
	fx._reset_hitstop_for_test()

func test_wav_streams_generated_nonempty() -> void:
	var fx := _make_fx()
	var st := fx.streams()
	assert_eq(st.size(), 14, "14 cached streams (12 mapping + thud + alarm)")
	for key: String in ["shoot", "hit_s", "hit_m", "hit_l", "crit", "pickup",
			"levelup", "ui", "death", "settle", "heartbeat", "kill_pop", "extract_alarm"]:
		var wav: Variant = st.get(key)
		assert_true(wav is AudioStreamWAV, "stream is AudioStreamWAV: " + key)
		if wav is AudioStreamWAV:
			assert_true((wav as AudioStreamWAV).data.size() > 0, "wav data nonempty: " + key)

func test_parse_hit_defensive() -> void:
	var fx := _make_fx()
	assert_true(fx._parse_hit(null).is_empty(), "non-dict rejected")
	assert_true(fx._parse_hit({"dmg": 0.0}).is_empty(), "zero dmg rejected")
	var h := fx._parse_hit({"dmg": 5.0, "pos": [1.0, 2.0], "crit": true, "max_hp": 50.0})
	assert_eq(float(h.get("dmg", 0.0)), 5.0, "dmg parsed")
	assert_eq(Vector2(h.get("pos", Vector2.ZERO)), Vector2(1.0, 2.0), "array pos parsed")
	assert_true(bool(h.get("crit", false)), "crit parsed")

func test_kill_burst_pool_reuse() -> void:
	var fx := _make_fx()
	fx._spawn_kill_burst(Vector2.ZERO)
	var created_first: int = fx.particle_pool().created
	assert_true(fx.particle_pool().buf.size() >= 8, "8-12 particles spawned")
	fx._update_particles(10.0)
	assert_eq(fx.particle_pool().buf.size(), 0, "particles expired after big delta")
	fx._spawn_kill_burst(Vector2.ZERO)
	fx._update_particles(10.0)
	fx._spawn_kill_burst(Vector2.ZERO)
	assert_eq(fx.particle_pool().created, created_first, "pool reused, no new allocs")
