## 任务 F：工匠、芯片/模块与经济系统验收。
extends GutTest

const ArtisanScript = preload("res://mods/jes-artisan/scripts/artisan.gd")
const ChipScript = preload("res://mods/jes-inventory/scripts/chip_system.gd")
const EconScript = preload("res://mods/jes-engine-core/scripts/econ_system.gd")

var artisan: RefCounted
var chips: RefCounted
var econ: RefCounted

func before_each() -> void:
	artisan = ArtisanScript.new()
	artisan.set_seed(20261024)
	chips = ChipScript.new()
	chips.set_seed(20261024)
	econ = EconScript.new()
	econ.set_seed(20261024)

func test_artisan_reads_service_costs() -> void:
	assert_eq(artisan.service_cost("qualityUp", 0), 80, "品质强化第一档费用应来自配置")
	assert_eq(artisan.service_cost("qualityUp", 2), 320, "品质强化第三档费用应来自配置")
	assert_eq(artisan.service_cost("rerollModule"), 120, "重掷费用应来自配置")

func test_artisan_quality_up_and_insufficient_coins() -> void:
	var run := {"coin": 100}
	var item: Dictionary = chips.make_module("M009", 0)
	var result: Dictionary = artisan.quality_up(run, item)
	assert_true(bool(result["ok"]), "金币足够时品质提升应成功")
	assert_eq(int(item["q"]), 1, "品质提升应只提升一档")
	assert_eq(int(run["coin"]), 20, "服务应扣除配置费用")
	var poor := {"coin": 0}
	var rejected: Dictionary = artisan.quality_up(poor, chips.make_module("M009", 0))
	assert_false(bool(rejected["ok"]), "金币不足应拒绝服务")

func test_artisan_reroll_preserves_identity() -> void:
	var run := {"coin": 200}
	var item: Dictionary = chips.make_module("M009", 1)
	var old_id := String(item["defId"])
	var result: Dictionary = artisan.reroll_module(run, item)
	assert_true(bool(result["ok"]), "金币足够时重掷应成功")
	assert_eq(String(item["defId"]), old_id, "重掷不得改变模块类型")
	assert_eq(int(run["coin"]), 80, "重掷应扣配置费用")

func test_chip_make_value_and_behavior() -> void:
	var value_chip: Dictionary = chips.make_chip("C_V_DMG", 3)
	assert_eq(String(value_chip["kind"]), "chip", "芯片 kind 应为 chip")
	assert_almost_eq(float(value_chip["value"]), 0.45, 0.00001, "数值芯片应读取品质词条")
	assert_false(value_chip.has("behavior"), "数值芯片不得带行为字段")
	var behavior_chip: Dictionary = chips.make_chip("C_B_BURN", 2)
	assert_eq(String(behavior_chip["behavior"]), "burn", "行为芯片应保留行为类型")
	assert_eq(int(behavior_chip["value"]), 8, "行为值应读取品质档位")
	assert_false(behavior_chip.has("affix"), "行为芯片不得进入数值词条链")

func test_chip_grid_placement_and_shape() -> void:
	var grid := {"cols": 6, "rows": 5, "cells": [], "items": []}
	var module: Dictionary = chips.make_module("M005", 1)
	assert_true(chips.place_item(grid, module, 0, 0), "合法模块应可镶嵌")
	assert_false(chips.place_item(grid, chips.make_module("M001", 1), 0, 0), "重叠模块应拒绝")
	assert_false(chips.place_item(grid, chips.make_module("M005", 1), 5, 4), "越界模块应拒绝")
	assert_eq(grid["items"].size(), 1, "成功镶嵌后物品列表应增加")

func test_chip_synergy_requires_adjacent_same_quality() -> void:
	var a: Dictionary = chips.make_module("M001", 2)
	var b: Dictionary = chips.make_module("M005", 2)
	a["x"] = 0; a["y"] = 0
	b["x"] = 1; b["y"] = 0
	var synergy: Dictionary = chips.module_synergy([a, b])
	assert_eq(int(synergy["links"]), 1, "相邻同品质模块应形成一条连接")
	assert_true((synergy["sets"] as Array).has("弹道套装"), "两件弹道模块应触发套装")
	b["q"] = 0
	var separated: Dictionary = chips.module_synergy([a, b])
	assert_eq(int(separated["links"]), 0, "不同品质不得形成连接")

func test_chip_behavior_takes_max() -> void:
	var low: Dictionary = chips.make_chip("C_B_BURN", 1)
	var high: Dictionary = chips.make_chip("C_B_BURN", 3)
	var effects: Dictionary = chips.behavior_effects([low, high])
	assert_eq(int(effects["burn"]["value"]), 12, "同类行为芯片应取最大值")

func test_chip_mutate_number_excludes_behavior() -> void:
	var target := {"伤害": 1.0}
	var value_chip: Dictionary = chips.make_chip("C_V_DMG", 0)
	var behavior_chip: Dictionary = chips.make_chip("C_B_BURN", 3)
	chips.apply_mutate_number(target, "伤害", [value_chip, behavior_chip])
	assert_almost_eq(float(target["伤害"]), 1.12, 0.00001, "数值芯片应以 mutate_number 方式修正")

func test_economy_ledger_source_and_sink() -> void:
	var run := {"coin": 10}
	econ.record_source(run, 5, "击杀")
	assert_eq(int(run["coin"]), 15, "source 应增加金币")
	assert_true(econ.record_sink(run, 7, "工匠"), "余额足够时 sink 应成功")
	assert_eq(int(run["coin"]), 8, "sink 应扣除金币")
	assert_false(econ.record_sink(run, 99, "超支"), "余额不足时 sink 应拒绝")

func test_altar_judgement_and_effect() -> void:
	var selected: String = econ.judge_altar({"A": {"weight": 1}, "B": {"weight": 0}})
	assert_eq(selected, "A", "唯一正权重祭坛应被判定")
	var run := {"insurance": 0}
	var result: Dictionary = econ.altar_effect("ALTAR_007", run)
	assert_true(bool(result["ok"]), "保险祭坛应读取到配置")
	assert_eq(int(run["insurance"]), 1, "保险祭坛应增加一份保险")

func test_curse_apply_tick_and_monster_mutation() -> void:
	var run := {}
	var curse: Dictionary = econ.apply_curse(run, "DB001")
	assert_eq(String(curse["id"]), "DB001", "应能按 id 施加诅咒")
	var monster: Dictionary = {"def": 1.0, "hp": 20.0, "hpMax": 20.0}
	var adjusted: Dictionary = econ.apply_curse_monster(monster, run)
	assert_almost_eq(float(adjusted["def"]), 3.0, 0.00001, "铁壁诅咒应使防御乘三")
	assert_eq(int(adjusted["hpMax"]), 30, "铁壁诅咒应使生命乘一点五")
	assert_true(econ.tick_curse(run, 45.0), "诅咒倒计时结束应清除")
	assert_null(run.get("curse"), "诅咒到期后应为空")

func test_settle_convert_chips_use_quality_value() -> void:
	var chip: Dictionary = chips.make_chip("C_V_DMG", 3, 2)
	var run := {"backpack": [], "weaponInv": [], "chipInv": [chip]}
	var result: Dictionary = econ.settle_convert(run)
	assert_eq(int(result["chip"]), 120, "芯片撤离折算应使用品质价值乘等级乘折算率")
	assert_eq(int(result["total"]), int(result["chip"]), "仅有芯片时总值应等于芯片桶")

func test_death_penalty_excludes_chips_and_insurance_returns_item() -> void:
	var run := {"insurance": 1}
	var items := [{"kind": "gear", "id": "G001"}, {"kind": "chip", "defId": "C_V_DMG"}]
	var result: Dictionary = econ.death_penalty(run, items)
	assert_eq((result["lost"] as Array).size(), 0, "保险应返还唯一可损失物品")
	assert_eq((result["returned"] as Array).size(), 1, "保险应返还一件物品")
	assert_eq(int(run["insurance"]), 0, "使用保险后数量应减少")
