# POE2 辅助宝石全集 · 人读版 v2（含描述与数值）

> **用途**：人工翻阅。数据三源合一：宝石清单与分类同 v1（PoB2 Gems.lua），
> 功能描述与数值取自 PoB2 仓库 `src/Data/Skills/sup_str/dex/int.lua`（2026-10-22 抓取）。
> 机器查证以 `AI资料源/POE2辅助宝石数据/` 内原始文件为准，本文件不是施工依据。

> **译名口径**：宝石名与描述均为**参考意译**，非官方国服译名。
> **数值说明**：取自数据内 constantStats（真实生效值）；未汉化的属性 ID 回退显示原文。
> 描述与数值冲突时以游戏内实装为准；无描述条目已在文末列出。


## 召唤与随从（38 条）
>
> 强化随从的伤害、生存、体型与行为

### 阿玛纳穆的贡赋（Amanamu's Tithe）

- **功能**：辅助常驻随从技能：辅助随从死亡时有概率使你获得一个深渊怪物词缀。
- **数值**：chance_%_to_gain_abyssal_modifier_on_minion_death = 50
- 家族：阿玛纳穆的贡赋｜标签：血统(传奇)、随从、常驻

### 嘱令Ⅰ（Bidding I）

- **功能**：辅助随从技能。辅助随从伤害更高，且号令技能的冷却回复更快。
- **数值**：support_command_skill_damage_+%_final = 20；随从号令冷却速度 20%
- 家族：嘱令Ⅰ｜标签：随从、号令

### 嘱令Ⅱ（Bidding II）

- **功能**：辅助随从技能。辅助随从伤害更高，且号令技能的冷却回复更快。
- **数值**：support_command_skill_damage_+%_final = 30；随从号令冷却速度 30%
- 家族：嘱令Ⅱ｜标签：随从、号令

### 嘱令Ⅲ（Bidding III）

- **功能**：辅助随从技能。辅助随从的号令技能冷却回复显著加快。
- **数值**：随从号令冷却速度 80%
- 家族：嘱令Ⅲ｜标签：随从、号令

### 库尔加尔的锁链（Kurgal's Leash）

- **功能**：辅助可受号令的随从：你号令时，你与该随从获得邪恶魔力。
- **数值**：—
- 家族：库尔加尔的锁链｜标签：血统(传奇)、随从、混沌

### 诫命（Commandment）

- **功能**：辅助有号令技能的随从。辅助随从的号令技能冷却回复大幅加快，但其非号令技能不造成伤害。
- **数值**：support_minion_damage_with_non_command_skills_+%_final = -100；随从号令冷却速度 100%
- 家族：诫命｜标签：随从、号令

### 狂乱随从（Crazed Minions）

- **功能**：辅助召唤可复活随从的随从技能。辅助随从若最近复活过，伤害显著提高。
- **数值**：support_crazed_minions_minion_damage_+%_final_if_revived_recently = 30
- 家族：狂乱随从｜标签：随从、常驻

### 死亡进军（Deathmarch）

- **功能**：辅助创建常驻随从的技能。辅助随从死亡时为附近盟友随从回复生命，并移除其异常状态。
- **数值**：minion_on_death_heal_radius = 30；minion_on_death_heal_nearby_minions_for_%_of_life_and_remove_ailments = 25
- 家族：死亡进军｜标签：随从、常驻

### 元素军团（Elemental Army）

- **功能**：辅助创建随从的技能，提高这些随从的元素抗性。不能辅助创建不可伤害随从的技能。
- **数值**：minion_elemental_resistance_% = 30
- 家族：元素军团｜标签：随从

### 精华收割（Essence Harvest）

- **功能**：辅助召唤可复活的常驻随从的技能。这些随从死亡时，你按最大魔力的一定百分比获得偿还。
- **数值**：recoup_mana_%_on_minion_death = 8
- 家族：精华收割｜标签：随从、常驻

### 饲喂狂热Ⅰ（Feeding Frenzy I）

- **功能**：辅助创建随从的技能，使随从造成与受到的伤害都提高。不能辅助创建不可伤害随从的技能。
- **数值**：feeding_frenzy_minion_damage_taken_+%_final = 20；feeding_frenzy_minion_damage_+%_final = 30
- 家族：饲喂狂热Ⅰ｜标签：随从

### 饲喂狂热Ⅱ（Feeding Frenzy II）

- **功能**：（数据源无描述）
- **数值**：feeding_frenzy_minion_damage_taken_+%_final = 15；feeding_frenzy_minion_damage_+%_final = 30
- 家族：饲喂狂热Ⅱ｜标签：随从

### 魁梧随从（Hulking Minions）

- **功能**：辅助召唤常驻随从的技能。辅助随从体型更大、生命更多、伤害更高，但魂力消耗显著提高。
- **数值**：—
- 家族：魁梧随从｜标签：随从、常驻

### 坦玛祖的香炉（Tangmazu's Thurible）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：魁梧随从｜标签：血统(传奇)、随从、常驻

### 卡莎的辉光（Catha's Brilliance）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：卡莎的辉光｜标签：血统(传奇)、随从、范围、火焰

### 炼狱军团Ⅰ（Infernal Legion I）

- **功能**：辅助创建可受伤害随从的技能，使这些随从及附近敌人被点燃。点燃伤害基于辅助随从的生命。
- **数值**：minion_fire_damage_%_of_maximum_life_taken_per_minute = 600；support_minions_ignite_for_%_max_life = 10；infernal_legion_minion_burning_effect_radius = 15
- 家族：炼狱军团Ⅰ｜标签：随从、范围、火焰

### 炼狱军团Ⅱ（Infernal Legion II）

- **功能**：辅助创建可受伤害随从的技能，使这些随从及附近敌人被点燃。点燃伤害基于辅助随从的生命。
- **数值**：minion_fire_damage_%_of_maximum_life_taken_per_minute = 600；support_minions_ignite_for_%_max_life = 10；infernal_legion_minion_burning_effect_radius = 20；minion_fire_damage_resistance_% = 20
- 家族：炼狱军团Ⅱ｜标签：随从、范围、火焰

### 炼狱军团Ⅲ（Infernal Legion III）

- **功能**：辅助创建可受伤害随从的技能，使这些随从及附近敌人被点燃。点燃伤害基于辅助随从的生命。
- **数值**：minion_fire_damage_%_of_maximum_life_taken_per_minute = 600；support_minions_ignite_for_%_max_life = 10；infernal_legion_minion_burning_effect_radius = 20；minion_fire_damage_resistance_% = 20
- 家族：炼狱军团Ⅲ｜标签：随从、范围、火焰

### 回光返照（Last Gasp）

- **功能**：辅助创建常驻随从的技能，使随从在致命伤后仍继续作战，短暂持续后死亡。
- **数值**：support_last_gasp_duration_ms = 4000
- 家族：回光返照｜标签：随从、常驻、持续

### 特克洛德的复仇（Tecrod's Revenge）

- **功能**：辅助创建常驻随从的技能，使随从在致命伤后仍继续作战，持续一段时间后死亡。进入该状态时辅助随从获得噬魂与一阵加速。
- **数值**：support_last_gasp_duration_ms = 20000；support_last_gasp_attack_and_cast_speed_+%_while_undying = 40
- 家族：回光返照｜标签：血统(传奇)、随从、常驻、持续

### 活体闪电（Living Lightning）

- **功能**：辅助造成伤害命中的技能。用辅助技能造成闪电伤害时生成活体闪电随从——成束的活体电流，以连锁攻击瞄准附近敌人。敌人不会主动攻击这些随从，可从其身位穿过。不改变随从的技能。
- **数值**：—
- 家族：活体闪电｜标签：随从、触发、闪电、持续

### 活体闪电Ⅱ（Living Lightning II）

- **功能**：辅助造成伤害命中的技能。用辅助技能造成闪电伤害时生成活体闪电随从——成束的活体电流，以连锁攻击瞄准附近敌人。敌人不会主动攻击这些随从，可从其身位穿过。不改变随从的技能。
- **数值**：—
- 家族：活体闪电｜标签：随从、触发、闪电、持续

### 忠诚（Loyalty）

- **功能**：辅助创建可受伤害的同伴的技能。辅助技能创建的随从替你承受一部分命中伤害，但最大生命降低。
- **数值**：support_trusty_companion_minion_life_+%_final = -30；companion_takes_%_damage_before_you_from_support = 10
- 家族：忠诚｜标签：随从

### 罗米拉的回报（Romira's Requital）

- **功能**：辅助创建可受伤害的同伴的技能。辅助技能创建的随从替你承受一部分命中伤害，但最大生命降低；所受伤害的一部分以生命形式偿还给你。
- **数值**：support_trusty_companion_minion_life_+%_final = -30；companion_takes_%_damage_before_you_from_support = 10；loyalty_%_of_redirected_damage_recouped_as_life_for_owner = 200
- 家族：忠诚｜标签：血统(传奇)、随从

### 随从专精（Minion Mastery）

- **功能**：辅助随从技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_minion_skill_gem_level_+ = 1
- 家族：专精系｜标签：随从

### 布鲁图斯之脑（Brutus' Brain）

- **功能**：辅助创建随从的技能，使这些随从无法造成或承受伤害。不能辅助创建不可伤害随从的技能。
- **数值**：—
- 家族：布鲁图斯之脑｜标签：血统(传奇)、随从

### 肉盾Ⅰ（Meat Shield I）

- **功能**：辅助创建随从的技能：随从受到的伤害降低，但造成的伤害也降低。不能辅助创建不可伤害随从的技能。
- **数值**：support_minion_defensive_stance_minion_damage_taken_+%_final = -35；support_meat_shield_minion_damage_+%_final = -35
- 家族：肉盾Ⅰ｜标签：随从

### 肉盾Ⅱ（Meat Shield II）

- **功能**：辅助创建随从的技能：随从受到的伤害降低，但造成的伤害也降低。
- **数值**：support_minion_defensive_stance_minion_damage_taken_+%_final = -40；support_meat_shield_minion_damage_+%_final = -40
- 家族：肉盾Ⅱ｜标签：随从

### 随从泼溅Ⅰ（Minion Splash I）

- **功能**：辅助创建打击型随从的技能，使这些随从的打击具有近战泼溅。
- **数值**：—
- 家族：随从泼溅Ⅰ｜标签：攻击、随从、近战、打击

### 随从泼溅Ⅱ（Minion Splash II）

- **功能**：辅助创建打击型随从的技能，提高其范围并使这些随从的打击具有近战泼溅。
- **数值**：minion_skill_area_of_effect_+% = 20
- 家族：随从泼溅Ⅱ｜标签：攻击、随从、近战、打击

### 随从不稳定（Minion Instability）

- **功能**：辅助创建随从的技能，使其在濒死时猛烈爆炸。
- **数值**：explode_on_low_life_%_maximum_life_to_deal = 15
- 家族：随从不稳定｜标签：随从、火焰

### 随从契约Ⅰ（Minion Pact I）

- **功能**：辅助你自己使用的伤害技能，使用时抽取你一名随从的生命以强化技能伤害。只有在有随从生命足以被抽取全额时才生效。
- **数值**：support_minion_pact_user_life_%_removed_from_nearby_minion = 100；support_minion_pact_damage_+%_final = 30
- 家族：随从契约Ⅰ｜标签：随从

### 随从契约Ⅱ（Minion Pact II）

- **功能**：辅助你自己使用的伤害技能，使用时抽取你一名随从的生命以强化技能伤害。只有在有随从生命足以被抽取全额时才生效。
- **数值**：support_minion_pact_user_life_%_removed_from_nearby_minion = 150；support_minion_pact_damage_+%_final = 35
- 家族：随从契约Ⅱ｜标签：随从

### 集结（Muster）

- **功能**：辅助召唤随从的技能。你召唤的可复活随从种类越多，辅助随从伤害越高。
- **数值**：support_varied_troops_damage_+%_final_per_different_persistent_ominion = 7
- 家族：集结｜标签：随从

### 祭献羔羊Ⅰ（Sacrificial Lamb I）

- **功能**：辅助创建随从的技能：使你能指定随从的技能尽可能优先指定辅助技能的随从。
- **数值**：support_sacrificial_lamb_base_radius = 60
- 家族：祭献羔羊Ⅰ｜标签：随从

### 祭献羔羊Ⅱ（Sacrificial Lamb II）

- **功能**：辅助创建随从的技能：使你能指定随从的技能优先指定辅助技能的随从，且它们总被视为可引爆。
- **数值**：support_sacrificial_lamb_base_radius = 60
- 家族：祭献羔羊Ⅱ｜标签：随从

### 疾走之石Ⅰ（Skittering Stone I）

- **功能**：辅助创建可击碎土制之物的技能。在其范围内击杀足够多的敌人后，该物破碎，释放疾走之石随从。
- **数值**：support_hatching_elementals_base_radius = 40；support_chance_to_trigger_hatching_elementals_% = 100
- 家族：疾走之石Ⅰ｜标签：随从、触发、物理、持续

### 疾走之石Ⅱ（Skittering Stone II）

- **功能**：辅助创建可击碎土制之物的技能。在其范围内击杀足够多的敌人后，该物破碎，释放疾走之石随从。
- **数值**：support_hatching_elementals_base_radius = 40；support_chance_to_trigger_hatching_elementals_% = 100
- 家族：疾走之石Ⅱ｜标签：随从、触发、物理、持续


## 图腾（13 条）
>
> 放置图腾类技能的放置、强化与回收

### 血之源泉（Font of Blood）

- **功能**：辅助创建图腾的技能。辅助图腾生成血之源泉，对其中盟友偷取生命。
- **数值**：allies_in_font_of_blood_radius_leech_%_of_my_physical_damage_as_life = 12；font_of_blood_radius = 40
- 家族：血之源泉｜标签：图腾

### 魔力源泉（Font of Mana）

- **功能**：辅助创建图腾的技能。辅助图腾生成魔力源泉，对其中盟友偷取魔力。
- **数值**：allies_in_font_of_mana_radius_leech_%_of_my_physical_damage_as_mana = 12；font_of_mana_radius = 40
- 家族：魔力源泉｜标签：图腾

### 强韧图腾Ⅰ（Hardy Totems I）

- **功能**：辅助创建图腾的技能，使图腾生命更高。
- **数值**：support_totem_life_+%_final = 40
- 家族：强韧图腾Ⅰ｜标签：图腾

### 强韧图腾Ⅱ（Hardy Totems II）

- **功能**：辅助创建图腾的技能，使图腾生命更高。
- **数值**：support_totem_life_+%_final = 50
- 家族：强韧图腾Ⅱ｜标签：图腾

### 塔沃亚的照料（Tawhoa's Tending）

- **功能**：辅助创建图腾的技能：图腾生命更高，且死亡时爆炸，按其生命造成物理伤害。
- **数值**：support_totem_life_+%_final = 25；support_hardy_totems_trigger_splinter_explosion_on_death_chance_% = 100
- 家族：塔沃亚的照料｜标签：血统(传奇)、图腾、范围、触发、物理

### 强化图腾Ⅰ（Reinforced Totems I）

- **功能**：辅助创建图腾的技能。辅助技能生成的图腾拥有额外的元素抗性。
- **数值**：totem_elemental_resistance_% = 40；totem_maximum_all_elemental_resistances_% = 0
- 家族：强化图腾Ⅰ｜标签：图腾

### 强化图腾Ⅱ（Reinforced Totems II）

- **功能**：辅助创建图腾的技能。辅助技能生成的图腾拥有额外的元素抗性。
- **数值**：totem_elemental_resistance_% = 40；totem_maximum_all_elemental_resistances_% = 10
- 家族：强化图腾Ⅱ｜标签：图腾

### 西瑞尔的培育（Cirel's Cultivation）

- **功能**：辅助创建图腾的技能：同种图腾只能有一个，但根据附近盟友图腾数量为辅助图腾提供显著增益。不辅助随从使用的技能。
- **数值**：support_greatwood_number_of_active_totems_in_base_radius_to_track = 40；support_greatwood_maximum_number_of_active_totems_in_radius_for_effects = 5；support_greatwood_life_regeneration_rate_per_minute_%_per_totem_in_radius = 60；damage_+%_final_per_totem_in_radius_from_support_greatwood = 10；area_of_effect_+%_per_totem_in_radius_from_support_greatwood = 5
- 家族：西瑞尔的培育｜标签：血统(传奇)、图腾

### 裂片图腾Ⅰ（Splinter Totem I）

- **功能**：辅助创建图腾的技能：最多同时存在一个图腾，但该图腾在攻击或施法后分裂成多个弱化版小图腾，每个还可继续分裂直至上限。不辅助随从使用的技能。同一时间只能有一个图腾在分裂。
- **数值**：support_splinter_totem_skill_speed_+%_final_each_splinter = -10；support_splinter_totem_damage_+%_final_each_splinter = -20；support_splinter_totem_maximum_life_+%_final_each_splinter = -20；support_splinter_totem_area_of_effect_+%_final_each_splinter = -20
- 家族：裂片图腾Ⅰ｜标签：图腾

### 裂片图腾Ⅱ（Splinter Totem II）

- **功能**：辅助创建图腾的技能：最多同时存在一个图腾，但该图腾在攻击或施法后分裂成多个弱化版小图腾，每个还可继续分裂直至上限。不辅助随从使用的技能。同一时间只能有一个图腾在分裂。
- **数值**：support_splinter_totem_skill_speed_+%_final_each_splinter = -7；support_splinter_totem_damage_+%_final_each_splinter = -15；support_splinter_totem_maximum_life_+%_final_each_splinter = -15；support_splinter_totem_area_of_effect_+%_final_each_splinter = -15
- 家族：裂片图腾Ⅱ｜标签：图腾

### 急速图腾Ⅰ（Urgent Totems I）

- **功能**：辅助创建图腾的技能，使其放置图腾大幅加快。
- **数值**：summon_totem_cast_speed_+% = 80
- 家族：急速图腾Ⅰ｜标签：图腾

### 急速图腾Ⅱ（Urgent Totems II）

- **功能**：辅助创建图腾的技能，使其放置图腾大幅加快。
- **数值**：summon_totem_cast_speed_+% = 100
- 家族：急速图腾Ⅱ｜标签：图腾

### 急速图腾Ⅲ（Urgent Totems III）

- **功能**：辅助创建图腾的技能，放置大幅加快，且图腾攻速与施速提高。
- **数值**：summon_totem_cast_speed_+% = 100；totem_skill_cast_speed_+% = 20；totem_skill_attack_speed_+% = 20
- 家族：急速图腾Ⅲ｜标签：图腾


## 旗帜与战旗（2 条）
>
> 常驻或插旗式团队增益

### 达瑞索的激情（Daresso's Passion）

- **功能**：辅助旗帜技能，使其使用所需荣耀大幅降低。
- **数值**：support_glory_required_+%_final = -50
- 家族：达瑞索的激情｜标签：旗帜、血统(传奇)

### 致命之捷（Deadly Herald）

- **功能**：辅助战旗技能，其触发效果伤害更高，但魂力消耗提高。
- **数值**：support_deadly_heralds_damage_+%_final = 30
- 家族：致命之捷｜标签：战旗


## 战吼与号令（16 条）
>
> 战吼强化、号令联动与怒气体系

### 护甲爆裂（Armour Explosion）

- **功能**：辅助攻击与战吼，在其完全击破敌人护甲时触发火焰爆炸。
- **数值**：—
- 家族：护甲爆裂｜标签：攻击、战吼、范围、触发、火焰、结算

### 碎喝（Battershout）

- **功能**：辅助战吼技能。辅助技能消耗完全破甲状态，对其范围内敌人触发物理爆炸，但其自身不能破甲。
- **数值**：—
- 家族：碎喝｜标签：战吼、范围、触发、物理、结算

### 腐化战吼Ⅰ（Corrupting Cry I）

- **功能**：辅助战吼，触发腐化之吼，对其范围内敌人施加腐蚀之血。
- **数值**：support_corrupting_cry_area_of_effect_+%_final = -30
- 家族：腐化战吼Ⅰ｜标签：战吼、触发、物理、持续

### 腐化战吼Ⅱ（Corrupting Cry II）

- **功能**：辅助战吼，触发腐化之吼，对其范围内敌人施加腐蚀之血。
- **数值**：—
- 家族：腐化战吼Ⅱ｜标签：战吼、触发、物理、持续

### 帕夸特的契约（Paquate's Pact）

- **功能**：辅助战吼，触发扭曲之契对其范围内敌人施加腐蚀之血，代价是消耗你的生命。
- **数值**：support_corrupting_cry_%_life_cost_per_supported_skill_trigger_or_use_recently_up_to_30% = 10
- 家族：帕夸特的契约｜标签：血统(传奇)、战吼、触发、物理、持续

### 回响战吼（Echoing Cry）

- **功能**：辅助战吼。辅助技能回响两次且范围逐次扩大，但效果减弱，且需移动一定距离后才能使用。
- **数值**：warcry_echo_delay_ms_from_support = 1300；support_echoing_cry_area_of_effect_+%_final = -50；warcry_echo_area_of_effect_+%_final_per_repeat = 100；support_echoing_cry_warcry_monster_power_+%_final = -50；support_echoing_cry_damage_+%_final = -40
- 家族：回响战吼｜标签：战吼、范围、条件

### 激怒战吼Ⅰ（Enraged Warcry I）

- **功能**：辅助战吼，使其消耗怒气跳过通常的冷却。
- **数值**：—
- 家族：激怒战吼Ⅰ｜标签：战吼

### 激怒战吼Ⅱ（Enraged Warcry II）

- **功能**：辅助战吼，使其消耗怒气跳过通常的冷却。
- **数值**：—
- 家族：激怒战吼Ⅱ｜标签：战吼

### 破绽战吼（Exposing Cry）

- **功能**：辅助战吼。辅助技能命中敌人时施加易伤。
- **数值**：all_exposure_on_hit_for_duration_ms = 5000
- 家族：破绽战吼｜标签：战吼、持续

### 巴泰尔的复仇（Bhatair's Vengeance）

- **功能**：辅助你自己使用的攻击与战吼。用辅助技能冰冻敌人时，会短时间内使你和盟友的攻击附带冰霜伤害。
- **数值**：—
- 家族：巴泰尔的复仇｜标签：攻击、战吼、冰霜、持续

### 冰噬Ⅰ（Ice Bite I）

- **功能**：辅助你自己使用的伤害技能与战吼。用辅助技能冰冻敌人时，短时间内你的伤害附带冰霜伤害。
- **数值**：support_ice_bite_buff_grant_%_added_cold_attack_damage = 25；support_ice_bite_base_buff_duration = 5000
- 家族：冰噬Ⅰ｜标签：战吼、冰霜、持续

### 冰噬Ⅱ（Ice Bite II）

- **功能**：辅助你自己使用的伤害技能与战吼。用辅助技能冰冻敌人时，短时间内你的伤害附带冰霜伤害。
- **数值**：support_ice_bite_buff_grant_%_added_cold_attack_damage = 30；support_ice_bite_base_buff_duration = 6000
- 家族：冰噬Ⅱ｜标签：战吼、冰霜、持续

### 狂怒之吼（Raging Cry）

- **功能**：辅助战吼技能，使用时按统计到的怪物威力给予你怒气。
- **数值**：—
- 家族：狂怒之吼｜标签：战吼

### 不倦（Tireless）

- **功能**：辅助战吼技能。被辅助技能强化的攻击使用时有概率不降低强化层数。
- **数值**：chance_for_exerted_attacks_to_not_reduce_count_% = 25
- 家族：不倦｜标签：战吼

### 弗鲁恩的余波（Vruun's Aftermath）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：弗鲁恩的余波｜标签：血统(传奇)、战吼

### 泽菲的恶名（Zerphi's Infamy）

- **功能**：辅助你自己使用的攻击与战吼。辅助技能获得荣耀需求，并在你因技能消耗生命时累积荣耀。辅助技能伤害更高且范围显著扩大。
- **数值**：active_skill_generates_%_of_life_spent_as_glory = 5；support_zerphis_legacy_area_of_effect_+% = 50；support_zerphis_legacy_damage_+%_final = 50
- 家族：泽菲的恶名｜标签：血统(传奇)、战吼


## 诅咒、咒言与印记（16 条）
>
> 给敌人上诅咒/印记并强化其效果

### 持驻咒言（Abiding Hex）

- **功能**：辅助你自己施放的诅咒技能。辅助技能使用时消耗暴击球，若消耗则诅咒持续时间大幅提高。不能辅助会消耗暴击球的技能。
- **数值**：support_consume_power_charge_to_gain_curse_duration_+%_final = 80
- 家族：持驻咒言｜标签：诅咒

### 阿兹里的魅惑（Atziri's Allure）

- **功能**：辅助你自己施放的诅咒法术：这些诅咒无视通常的诅咒上限，但施加后会反弹回你身上。
- **数值**：support_atziri_curse_effect_+%_final = -20
- 家族：阿兹里的魅惑｜标签：血统(传奇)、诅咒

### 充能印记（Charged Mark）

- **功能**：辅助印记技能，印记激活时触发充能印记，在目标位置生成感电地面。
- **数值**：—
- 家族：充能印记｜标签：法术、范围、触发、印记、持续

### 诅咒之地（Cursed Ground）

- **功能**：辅助诅咒技能。辅助诅咒技能生成持续诅咒其中敌人的区域。
- **数值**：maximum_curse_zones_allowed = 2
- 家族：诅咒之地｜标签：诅咒

### 多德里多的作祟（Doedre's Undoing）

- **功能**：辅助诅咒技能。辅助技能生成诅咒其中敌人的区域，并在区域内生成蟾蜍法灵。蟾蜍扑向靠近的敌人，并更凶猛地追踪被诅咒的敌人。扑击命中时触发黑暗后果，猛烈爆炸。
- **数值**：maximum_curse_zones_allowed = 2；max_toads_per_doedre_cursed_ground = 4；doedre_cursed_ground_toad_spawn_interval_ms = 250
- 家族：诅咒之地｜标签：血统(传奇)、法术、范围、触发、混沌、诅咒

### 哈约西的雷殛（Hayoxi's Fulmination）

- **功能**：辅助诅咒技能：给予其短冷却，但会生成持续诅咒其中敌人的区域。辅助诅咒的区域会蓄力，中等延迟后喷发毁灭光柱。
- **数值**：maximum_curse_zones_allowed = 2；trigger_from_hayhoxis_binding_after_x_ms = 7000
- 家族：诅咒之地｜标签：血统(传奇)、法术、范围、触发、物理、闪电、冰霜、火焰、混沌、诅咒

### 腐朽咒言（Decaying Hex）

- **功能**：辅助诅咒技能。对每个被诅咒的目标触发亵渎衰变，施加造成伤害的减益。
- **数值**：—
- 家族：腐朽咒言｜标签：法术、触发、混沌、持续、诅咒

### 永恒印记（Eternal Mark）

- **功能**：辅助印记技能，印记首次激活时不被消耗。
- **数值**：—
- 家族：永恒印记｜标签：印记

### 集中诅咒（Focused Curse）

- **功能**：辅助诅咒技能，施放后更快地诅咒敌人。
- **数值**：support_focus_curse_curse_delay_+%_final = -50
- 家族：集中诅咒｜标签：诅咒

### 诅咒强化（Heightened Curse）

- **功能**：辅助诅咒技能，放大其威力。
- **数值**：curse_effect_+% = 25
- 家族：诅咒强化｜标签：诅咒

### 咒言绽放（Hex Bloom）

- **功能**：辅助诅咒，在被诅咒敌人死亡时扩散其效果。
- **数值**：—
- 家族：咒言绽放｜标签：范围、诅咒

### 死刑标记（Mark for Death）

- **功能**：辅助印记技能。受辅助印记影响的敌人，其受到的物理伤害会打破其护甲。
- **数值**：marked_target_%_physical_damage_taken_as_armour_break = 10
- 家族：死刑标记｜标签：印记、物理

### 死刑标记Ⅱ（Mark for Death II）

- **功能**：辅助印记技能。受辅助印记影响的敌人，其受到的物理伤害会打破其护甲。
- **数值**：marked_target_%_physical_damage_taken_as_armour_break = 15
- 家族：死刑标记｜标签：印记、物理

### 虹吸印记（Mark of Siphoning）

- **功能**：辅助印记技能，你用攻击命中被标记的敌人时，其偷取魔力给你。
- **数值**：marked_enemies_leech_physical_attack_damage_taken_as_mana_to_you_permyriad = 800
- 家族：虹吸印记｜标签：印记

### 虹吸印记Ⅱ（Mark of Siphoning II）

- **功能**：辅助印记技能，你用攻击命中被标记的敌人时，其偷取生命与魔力给你。
- **数值**：marked_enemies_leech_physical_attack_damage_taken_as_mana_to_you_permyriad = 800；marked_enemies_leech_physical_attack_damage_taken_as_life_to_you_permyriad = 800
- 家族：虹吸印记｜标签：印记

### 仪式诅咒（Ritualistic Curse）

- **功能**：辅助诅咒技能，覆盖范围更大但诅咒生效更慢。
- **数值**：support_ritual_curse_curse_delay_+%_final = 30；curse_area_of_effect_+% = 50
- 家族：仪式诅咒｜标签：范围、诅咒


## 弹药与手雷（14 条）
>
> 弩/猎枪的弹药管理、手雷投掷强化

### 黏着手雷Ⅰ（Adhesive Grenades I）

- **功能**：辅助手雷技能。辅助技能的手雷不再弹跳，而是停在最初落点，但爆炸伤害降低。
- **数值**：support_sticky_grenade_damage_+%_final = -10
- 家族：黏着手雷Ⅰ｜标签：手雷

### 黏着手雷Ⅱ（Adhesive Grenades II）

- **功能**：辅助手雷技能。辅助技能的手雷不再弹跳，而是停在最初落点。
- **数值**：—
- 家族：黏着手雷Ⅱ｜标签：手雷

### 弹药节约Ⅰ（Ammo Conservation I）

- **功能**：辅助弩的弹药技能，射击时有概率不消耗弩箭。
- **数值**：crossbow_attack_%_chance_to_not_consume_ammo = 20
- 家族：弹药节约Ⅰ｜标签：弹药、投射物

### 弹药节约Ⅱ（Ammo Conservation II）

- **功能**：辅助弩的弹药技能，射击时有概率不消耗弩箭。
- **数值**：crossbow_attack_%_chance_to_not_consume_ammo = 25
- 家族：弹药节约Ⅱ｜标签：弹药、投射物

### 弹药节约Ⅲ（Ammo Conservation III）

- **功能**：辅助弩的弹药技能，射击时有概率不消耗弩箭，但装填速度降低。
- **数值**：crossbow_attack_%_chance_to_not_consume_ammo = 30；support_ammo_conservation_crossbow_reload_speed_+%_final = -20
- 家族：弹药节约Ⅲ｜标签：弹药、投射物

### 阿尔君的勋章（Arjun's Medal）

- **功能**：辅助弩技能，击杀时为所有弩弹药装填一支弩箭。
- **数值**：chance_to_load_a_bolt_on_killing_an_enemy_% = 25
- 家族：阿尔君的勋章｜标签：血统(传奇)、弹药、投射物

### 自动装填（Auto Reload）

- **功能**：辅助弩的弹药技能，使其重度眩晕敌人时自动装填。
- **数值**：—
- 家族：自动装填｜标签：弹药、投射物

### 双管齐发Ⅰ（Double Barrel I）

- **功能**：辅助弩的弹药技能，使其多装填一支弩箭但装填速度降低。
- **数值**：support_double_barrel_number_of_crossbow_bolts_+ = 1
- 家族：双管齐发Ⅰ｜标签：弹药、投射物

### 双管齐发Ⅱ（Double Barrel II）

- **功能**：辅助弩的弹药技能，使其多装填一支弩箭但装填速度降低。
- **数值**：support_double_barrel_number_of_crossbow_bolts_+ = 1
- 家族：双管齐发Ⅱ｜标签：弹药、投射物

### 双管齐发Ⅲ（Double Barrel III）

- **功能**：辅助弩的弹药技能，使其多装填一支弩箭但装填速度降低，且重度眩晕敌人时自动装填。
- **数值**：support_double_barrel_number_of_crossbow_bolts_+ = 1
- 家族：双管齐发Ⅲ｜标签：弹药、投射物

### 拉莎的强袭（Ratha's Assault）

- **功能**：辅助弩的弹药技能，使其一次装填多支弩箭并加快攻击。辅助技能无法正常装填，改为翻滚时装填。
- **数值**：crossbow_load_x_bolts_on_dodge = 4；support_double_barrel_number_of_crossbow_bolts_+ = 3；攻击速度 10%
- 家族：双管齐发·迅捷攻击系｜标签：血统(传奇)、弹药、投射物

### 灵巧装填（Nimble Reload）

- **功能**：辅助弩的弹药技能，使其装填弩箭显著加快。
- **数值**：reload_speed_+% = 60
- 家族：灵巧装填｜标签：弹药、投射物

### 载荷（Payload）

- **功能**：辅助发射手雷的技能，使射出的手雷有概率再次激活，但冷却延长。
- **数值**：grenade_skill_%_chance_to_explode_twice = 50；冷却速度 -70%
- 家族：载荷｜标签：手雷

### 流线弹丸（Streamlined Rounds）

- **功能**：辅助弩的弹药技能：攻击速度与弩箭容量大幅提高，但伤害降低且装填时间更长。
- **数值**：support_double_barrel_number_of_crossbow_bolts_+ = 5；support_auto_shotgun_attack_speed_+%_final = 50；support_auto_shotgun_damage_+%_final = -60；support_auto_shotgun_projectile_count_+%_final = 0；support_auto_shotgun_reload_speed_+%_final = -50
- 家族：流线弹丸｜标签：弹药、投射物


## 投射物（45 条）
>
> 投射物数量、弹道、穿透、跳弹与速度

### 符文锻刃（Runeforged Blades）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：(未归家族)｜标签：攻击、投射物、触发、结算

### 多重射击Ⅰ（Multishot I）

- **功能**：辅助投射技能，使其发射额外投射物，同时降低辅助技能的攻速与施速并减轻其伤害。
- **数值**：额外投射物 2；伤害总增 -35%；terrain_arrow_attachment_chance_reduction_+% = 200；技能速度总增 -20%
- 家族：附加投射物系｜标签：投射物

### 多重射击Ⅱ（Multishot II）

- **功能**：辅助投射技能，使其发射额外投射物，同时降低辅助技能的攻速与施速并减轻其伤害。
- **数值**：额外投射物 2；伤害总增 -25%；terrain_arrow_attachment_chance_reduction_+% = 200；技能速度总增 -20%
- 家族：附加投射物系｜标签：投射物

### 西恩的怒火（Sione's Temper）

- **功能**：辅助投射法术。辅助法术呈环形发射大量额外投射物的概率逐次提高，触发后重置。
- **数值**：spell_skill_%_chance_to_fire_8_additional_projectiles_in_nova_per_wildshard_stack = 20
- 家族：附加投射物系｜标签：血统(传奇)、法术、投射物

### 野性碎片Ⅰ（Wildshards I）

- **功能**：辅助投射法术。辅助法术有概率呈环形发射大量额外投射物。
- **数值**：spell_skill_%_chance_to_fire_8_additional_projectiles_in_nova = 20
- 家族：附加投射物系｜标签：法术、投射物

### 野性碎片Ⅱ（Wildshards II）

- **功能**：辅助投射法术。辅助法术有概率呈环形发射大量额外投射物。
- **数值**：spell_skill_%_chance_to_fire_8_additional_projectiles_in_nova = 25
- 家族：附加投射物系｜标签：法术、投射物

### 新星投射Ⅱ（Nova Projectiles II）

- **功能**：辅助投射技能，使其呈环形发射额外投射物，代价是降低伤害并获得冷却。不辅助从天而降的弹雨技能。不能辅助已有冷却的技能。
- **数值**：额外投射物 6；support_nova_projectiles_damage_+%_final = -50
- 家族：附加投射物·新星投射系｜标签：投射物

### 齐射（Salvo）

- **功能**：辅助自己使用的发射投射物的攻击技能，随时间为其封印。封印在使用时破碎，额外发射投射物。辅助技能的投射物向随机方向发射。不能辅助需要连段、有冷却或已有封印的技能。
- **数值**：base_skill_seal_gain_interval_ms = 1000；skill_additional_projectiles_per_seal_broken = 1；最大封印数 6
- 家族：附加投射物·封印系｜标签：攻击、投射物

### 校准Ⅰ（Alignment I）

- **功能**：辅助弓类攻击。辅助技能会指示四个方向之一，当攻击与指示方向一致时切换方向。方向一致的攻击造成远更高的伤害。不能辅助引导技能。
- **数值**：support_called_shots_projectile_damage_+%_final_when_matching_direction = 30；called_shot_aiming_delay_ms = 1000；called_shot_angle_allowance_degs = 40
- 家族：校准Ⅰ｜标签：攻击、投射物

### 校准Ⅱ（Alignment II）

- **功能**：辅助弓类攻击。辅助技能会指示四个方向之一，当攻击与指示方向一致时切换方向。方向一致的攻击造成远更高的伤害。不能辅助引导技能。
- **数值**：support_called_shots_projectile_damage_+%_final_when_matching_direction = 40；called_shot_aiming_delay_ms = 1000；called_shot_angle_allowance_degs = 40
- 家族：校准Ⅱ｜标签：攻击、投射物

### 校准Ⅲ（Alignment III）

- **功能**：辅助弓类攻击。辅助技能会指示四个方向之一，当攻击与指示方向一致时切换方向。方向一致的攻击发射额外投射物。不能辅助引导技能。
- **数值**：called_shot_aiming_delay_ms = 1000；called_shot_angle_allowance_degs = 40；support_called_shots_additional_projectiles_when_matching_indicated_direction = 4
- 家族：校准·附加投射物系｜标签：攻击、投射物

### 铁蒺藜（Caltrops）

- **功能**：辅助远程长矛攻击。辅助技能的投射物到达飞行终点时生成铁蒺藜。
- **数值**：—
- 家族：铁蒺藜｜标签：攻击、范围、投射物、触发、持续、险域

### 连锁Ⅰ（Chain I）

- **功能**：辅助投射技能及其他可连锁的技能，使其连锁更多次。
- **数值**：连锁次数 1；support_chain_hit_damage_+%_final = -30
- 家族：连锁Ⅰ｜标签：投射物、连锁

### 连锁Ⅱ（Chain II）

- **功能**：辅助投射技能及其他可连锁的技能，使其连锁更多次。
- **数值**：连锁次数 2；support_chain_hit_damage_+%_final = -50
- 家族：连锁Ⅱ｜标签：投射物、连锁

### 连锁Ⅲ（Chain III）

- **功能**：辅助投射技能及其他可连锁的技能，使其连锁更多次。
- **数值**：连锁次数 2；support_chain_hit_damage_+%_final = -40
- 家族：连锁Ⅲ｜标签：投射物、连锁

### 蓄能射击Ⅰ（Charged Shots I）

- **功能**：辅助弓类攻击。辅助技能每第三次射击回复一部分魔力消耗并获得额外闪电伤害。
- **数值**：support_charged_shots_recover_%_mana_cost_on_use = 100；support_charged_shots_%_damage_to_gain_as_lightning = 30
- 家族：蓄能射击Ⅰ｜标签：攻击、投射物

### 蓄能射击Ⅱ（Charged Shots II）

- **功能**：辅助弓类攻击。辅助技能每第三次射击获得额外闪电伤害。
- **数值**：support_charged_shots_%_damage_to_gain_as_lightning = 60
- 家族：蓄能射击Ⅱ｜标签：攻击、投射物

### 奔涌电流（Coursing Current）

- **功能**：辅助命中敌人的技能。用辅助技能使敌人感电时触发奔涌电流，向附近浸湿的敌人发射连锁闪电投射物。
- **数值**：support_%_chance_to_trigger_deadly_current_on_shock = 100
- 家族：奔涌电流｜标签：法术、投射物、触发、闪电、连锁

### 多米努斯的掌握（Dominus' Grasp）

- **功能**：辅助投射技能及其他可连锁的技能，使其连锁次数更多。
- **数值**：support_dominus_grasp_chain_count_+%_final = 100
- 家族：多米努斯的掌握｜标签：血统(传奇)、投射物、连锁

### 火花增幅Ⅰ（Empowered Sparks I）

- **功能**：辅助生成充能球的技能。用辅助技能生成暴击球时，强化你的部分攻击，使用时触发火花投射物。
- **数值**：—
- 家族：火花增幅Ⅰ｜标签：投射物、触发、闪电、持续

### 燃火穿刺（Flamepierce）

- **功能**：辅助可发射投射物的技能。辅助技能的首枚投射物必定穿透被点燃敌人，但其自身不能施加点燃。
- **数值**：chance_to_pierce_ignited_enemy_% = 100
- 家族：燃火穿刺｜标签：投射物、火焰

### 叉射（Fork）

- **功能**：辅助投射技能，使其投射物分叉。
- **数值**：terrain_arrow_attachment_chance_reduction_+% = 100；support_fork_forked_projectile_damage_+%_final = -30
- 家族：叉射｜标签：投射物

### 冰霜叉射（Freezefork）

- **功能**：辅助可发射投射物的技能。辅助技能的首枚投射物命中冰冻敌人时必定分叉，但其自身不能累积冰冻。
- **数值**：chance_to_fork_from_frozen_enemy_% = 100
- 家族：冰霜叉射｜标签：投射物、冰霜

### 冰冻怨毒（Frozen Spite）

- **功能**：辅助命中敌人的技能，击杀冰冻敌人时生成冰晶碎片。不能辅助图腾技能，不改变随从的技能。
- **数值**：—
- 家族：冰冻怨毒｜标签：范围、投射物、触发、冰霜

### 赌命射击（Gambleshot）

- **功能**：辅助发射非地面指定投射物的技能。辅助技能的投射物随机分叉、连锁或穿透。
- **数值**：support_gambleshot_projectile_damage_+%_final = -15
- 家族：赌命射击｜标签：投射物

### 裂隙之主的融合（Breachlord's Amalgam）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：裂隙之主的融合｜标签：血统(传奇)、投射物、闪电、冰霜

### 新星投射Ⅰ（Nova Projectiles I）

- **功能**：辅助投射技能，使其投射物呈环形发射。不辅助从天而降的弹雨技能。
- **数值**：—
- 家族：新星投射Ⅰ｜标签：投射物

### 穿透Ⅰ（Pierce I）

- **功能**：辅助投射技能，使其投射物穿透敌人，但穿透后伤害降低。
- **数值**：base_chance_to_pierce_% = 100；support_pierce_projectile_damage_+%_final_if_pierced_enemy = -20
- 家族：穿透Ⅰ｜标签：投射物

### 穿透Ⅱ（Pierce II）

- **功能**：辅助投射技能，使其投射物穿透敌人。
- **数值**：base_chance_to_pierce_% = 100
- 家族：穿透Ⅱ｜标签：投射物

### 穿透Ⅲ（Pierce III）

- **功能**：辅助投射技能，使其投射物穿透无限个敌人，并随穿透逐个降低伤害。
- **数值**：support_pierce_damage_+%_final_per_pierced_target = -20
- 家族：穿透Ⅲ｜标签：投射物

### 投射物加速Ⅰ（Projectile Acceleration I）

- **功能**：辅助投射技能，使投射物飞行更快。
- **数值**：support_faster_projectiles_projectile_speed_+%_final = 40
- 家族：投射物加速Ⅰ｜标签：投射物

### 投射物加速Ⅱ（Projectile Acceleration II）

- **功能**：辅助投射技能，使投射物飞行更快，并给予其穿透敌人的概率。
- **数值**：support_faster_projectiles_projectile_speed_+%_final = 40；base_chance_to_pierce_% = 40
- 家族：投射物加速Ⅱ｜标签：投射物

### 投射物加速Ⅲ（Projectile Acceleration III）

- **功能**：辅助投射技能，使投射物飞行更快，且投射物速度的增减同时作用于伤害。
- **数值**：support_faster_projectiles_projectile_speed_+%_final = 40
- 家族：投射物加速Ⅲ｜标签：投射物

### 投射物减速Ⅰ（Projectile Deceleration I）

- **功能**：辅助投射技能，使投射物飞行更慢。
- **数值**：support_slower_projectiles_projectile_speed_+%_final = -25
- 家族：投射物减速Ⅰ｜标签：投射物

### 投射物减速Ⅱ（Projectile Deceleration II）

- **功能**：辅助投射技能，使投射物飞行更慢。
- **数值**：support_slower_projectiles_projectile_speed_+%_final = -30
- 家族：投射物减速Ⅱ｜标签：投射物

### 维伦塔的推进（Vilenta's Propulsion）

- **功能**：辅助发射投射物的法术技能，使施法速度的增减同时作用于投射物速度。
- **数值**：cast_speed_additive_modifiers_also_apply_to_projectile_speed_at_%_value = 75
- 家族：维伦塔的推进｜标签：血统(传奇)、法术、投射物

### 撤退Ⅰ（Retreat I）

- **功能**：辅助创建投射物的技能。若过去 8 秒内你曾以近战命中，辅助技能投射物伤害更高，但其自身无法造成近战伤害。
- **数值**：support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_8_seconds = 20；support_retreating_assault_melee_damage_+%_final = -100
- 家族：撤退Ⅰ｜标签：投射物

### 撤退Ⅱ（Retreat II）

- **功能**：辅助创建投射物的技能。若过去 8 秒内你曾以近战命中，辅助技能投射物伤害更高，但其自身无法造成近战伤害。
- **数值**：support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_8_seconds = 25；support_retreating_assault_melee_damage_+%_final = -100
- 家族：撤退Ⅱ｜标签：投射物

### 撤退Ⅲ（Retreat III）

- **功能**：辅助创建投射物的技能。若过去 2 秒内你曾以近战命中，辅助技能投射物伤害更高，但其自身无法造成近战伤害。
- **数值**：support_retreating_assault_projectile_damage_+%_final_if_melee_hit_in_past_2_seconds = 30；support_retreating_assault_melee_damage_+%_final = -100
- 家族：撤退Ⅲ｜标签：投射物

### 跳弹Ⅰ（Ricochet I）

- **功能**：辅助任何创建投射物的技能，使投射物撞到地形时有概率连锁。
- **数值**：projectile_chance_to_chain_1_extra_time_from_terrain_% = 40
- 家族：跳弹Ⅰ｜标签：投射物

### 跳弹Ⅱ（Ricochet II）

- **功能**：辅助任何创建投射物的技能，使投射物撞到地形时有概率连锁。
- **数值**：projectile_chance_to_chain_1_extra_time_from_terrain_% = 50
- 家族：跳弹Ⅱ｜标签：投射物

### 幽灵齐射（Spectral Volley）

- **功能**：辅助你自己使用的弓或长矛投射攻击。辅助技能初始伤害较低，但会生成幽影投射物，稍后发射且伤害更高。幽影投射物会停留，并在不再生成新投射物后短暂持续发射。不能辅助引导技能、跳跃技能或从天而降的弹雨技能。
- **数值**：support_spectral_arrows_damage_+%_final_with_spectral_projectiles = 20；support_spectral_arrows_damage_+%_final_with_non_spectral_projectiles = -60；support_spectral_arrows_base_duration_ms = 3000；support_spectral_arrows_delay_between_projectiles_ms = 100；support_spectral_arrows_maximum_spectral_arrows = 5
- 家族：幽灵齐射｜标签：攻击、投射物

### 风暴锁链（Stormchain）

- **功能**：辅助投射技能与可连锁的技能。辅助技能初次命中感电敌人时必定连锁，但其自身不能施加感电。不辅助无法连锁的技能。
- **数值**：—
- 家族：风暴锁链｜标签：投射物、闪电、连锁

### 火山喷发（Volcanic Eruption）

- **功能**：辅助你自己使用的近战打击技能。辅助技能对被点燃敌人命中时触发火山喷发。
- **数值**：support_volcanic_eruption_%_chance_to_trigger_vs_ignited_enemies = 100
- 家族：火山喷发｜标签：攻击、范围、近战、打击、投射物、触发、火焰

### 电势（Volt）

- **功能**：辅助你自己使用的投射攻击技能。移动时辅助技能累积伏特充能直至上限。使用时消耗这些充能，获得额外闪电伤害。
- **数值**：support_static_charge_charge_gain_per_metre = 2；support_static_charge_%_damage_gained_as_lightning_per_10_charge = 10；support_static_charge_maximum_charge = 30
- 家族：电势｜标签：攻击、投射物、闪电


## 近战打击（54 条）
>
> 近战打击/猛击的范围、连锁与眩晕

### 余震Ⅰ（Aftershock I）

- **功能**：辅助你自己使用的猛击，使其有概率生成余震。
- **数值**：slam_aftershock_chance_% = 25
- 家族：余震Ⅰ｜标签：攻击、近战、猛击

### 余震Ⅱ（Aftershock II）

- **功能**：辅助你自己使用的猛击，使其有概率生成余震。
- **数值**：slam_aftershock_chance_% = 35
- 家族：余震Ⅱ｜标签：攻击、近战、猛击

### 构造猛击（Tectonic Slams）

- **功能**：辅助你自己使用的猛击，使其在猛击后方同时生成余震，但降低辅助技能余震的伤害与范围。不能辅助生成裂隙的技能。
- **数值**：number_of_dual_cascade_aftershocks = 1；aftershock_damage_+%_final_from_support_dual_cascade_aftershocks = -45；aftershock_area_of_effect_+%_final_from_support_dual_cascade_aftershocks = -30；support_dual_cascade_aftershocks_attack_speed_+%_final = -15
- 家族：构造猛击｜标签：攻击、近战、猛击

### 先祖援助（Ancestral Aid）

- **功能**：辅助你自己使用的打击。累积格挡一定次数的命中前辅助技能无法使用，使用时获得先祖强化；使用后格挡计数重置。不能辅助引导技能或已有使用条件的技能。
- **数值**：ancestral_aid_required_count_of_recent_blocks = 3
- 家族：先祖援助｜标签：攻击、近战、打击、条件

### 先祖召唤Ⅰ（Ancestral Call I）

- **功能**：辅助你自己使用的打击，每几秒提供一次强力的先祖强化。不能辅助引导技能，不改变随从的技能。
- **数值**：ancestral_call_spirit_strike_interval_ms = 5000
- 家族：先祖召唤Ⅰ｜标签：攻击、近战、打击

### 先祖召唤Ⅱ（Ancestral Call II）

- **功能**：辅助你自己使用的打击，每几秒提供一次强力的先祖强化。不能辅助引导技能，不改变随从的技能。
- **数值**：ancestral_call_spirit_strike_interval_ms = 3000
- 家族：先祖召唤Ⅱ｜标签：攻击、近战、打击

### 倒刺Ⅰ（Barbs I）

- **功能**：辅助近战打击技能。你以荆棘伤害还击后，用辅助技能命中的敌人也会受到你的荆棘伤害。
- **数值**：—
- 家族：倒刺Ⅰ｜标签：攻击、近战、打击

### 倒刺Ⅱ（Barbs II）

- **功能**：辅助近战打击技能。你以荆棘伤害还击后，用辅助技能命中的敌人也会受到你的荆棘伤害。
- **数值**：—
- 家族：倒刺Ⅱ｜标签：攻击、近战、打击

### 倒刺Ⅲ（Barbs III）

- **功能**：辅助近战打击技能。你以荆棘伤害还击后，用辅助技能命中的敌人受到两倍荆棘伤害。
- **数值**：—
- 家族：倒刺Ⅲ｜标签：攻击、近战、打击

### 斩首Ⅰ（Behead I）

- **功能**：辅助打击技能，从其击杀的稀有怪物身上偷取一个词缀。
- **数值**：support_executioner_gain_one_rare_monster_mod_on_kill_ms = 20000
- 家族：斩首Ⅰ｜标签：攻击、近战、打击

### 斩首Ⅱ（Behead II）

- **功能**：辅助打击技能，从其击杀的稀有怪物身上偷取两个词缀。
- **数值**：support_executioner_gain_two_rare_monster_mod_on_kill_ms = 20000
- 家族：斩首Ⅱ｜标签：攻击、近战、打击

### 埃尼哈的驯兽之晶（Einhar's Beastrite）

- **功能**：辅助近战打击技能，从其击杀的稀有怪物身上偷取一个词缀并持续较长时间，但其无法伤害非低血状态的敌人。不改变随从的技能。
- **数值**：support_executioner_gain_two_rare_monster_mod_on_kill_ms = 300000
- 家族：埃尼哈的驯兽之晶｜标签：血统(传奇)、攻击、近战、打击

### 嗜血（Bloodlust）

- **功能**：辅助近战攻击，对流血敌人伤害更高，但其自身无法施加流血。
- **数值**：support_bloodlust_melee_physical_damage_+%_final_vs_bleeding_enemies = 30
- 家族：嗜血｜标签：攻击、近战、物理

### 荆棘猛击（Brambleslam）

- **功能**：辅助猛击技能，使其触发荆棘，生成伤害并致残敌人的危险荆棘。不改变随从与图腾的技能。
- **数值**：—
- 家族：荆棘猛击｜标签：攻击、范围、近战、猛击、触发、物理、险域、草木

### 濒界Ⅰ（Brink I）

- **功能**：辅助近战攻击技能。辅助技能更快累积重度眩晕，但其自身无法重度眩晕。
- **数值**：support_brink_hit_damage_stun_multiplier_+%_final = 30
- 家族：濒界Ⅰ｜标签：攻击、近战

### 濒界Ⅱ（Brink II）

- **功能**：辅助近战攻击技能。辅助技能更快累积眩晕，但其自身无法眩晕。
- **数值**：support_brink_hit_damage_stun_multiplier_+%_final = 50
- 家族：濒界Ⅱ｜标签：攻击、近战

### 碰撞（Clash）

- **功能**：辅助近战攻击技能。当你剩余生命百分比低于被击中目标时伤害更高，反之则更低。
- **数值**：support_melee_damage_+%_final_vs_higher_percent_life_target = 40；support_melee_damage_+%_final_vs_lower_percent_life_target = -20
- 家族：碰撞｜标签：攻击、近战

### 连段终结Ⅰ（Combo Finisher I）

- **功能**：辅助你自己使用的近战攻击。辅助技能在累积足够连段前无法使用，但伤害更高。不能辅助已有连段的技能。
- **数值**：support_combo_finisher_required_number_of_combo_stacks = 3；support_combo_finisher_damage_+%_final = 25；base_combo_stacks_decay_delay_ms = 4000
- 家族：连段终结Ⅰ｜标签：攻击、近战、打击、条件

### 连段终结Ⅱ（Combo Finisher II）

- **功能**：辅助你自己使用的近战攻击。辅助技能在累积足够连段前无法使用，但伤害大幅提高。不能辅助已有连段的技能。
- **数值**：support_combo_finisher_required_number_of_combo_stacks = 5；support_combo_finisher_damage_+%_final = 40；base_combo_stacks_decay_delay_ms = 4000
- 家族：连段终结Ⅱ｜标签：攻击、近战、打击、条件

### 震荡符文（Concussive Runes）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：震荡符文｜标签：攻击、范围、近战、猛击、触发

### 弹坑（Crater）

- **功能**：辅助腾空的近战技能，落地时生成裂隙。不能辅助图腾技能，不改变随从的技能。
- **数值**：—
- 家族：弹坑｜标签：攻击、范围、近战、触发、火焰、持续

### 渐强Ⅰ（Crescendo I）

- **功能**：辅助以终结技收尾的连段打击，使终结技可连续使用两次。
- **数值**：—
- 家族：渐强Ⅰ｜标签：攻击、近战、打击

### 渐强Ⅱ（Crescendo II）

- **功能**：辅助以终结技收尾的连段打击：终结技可连续使用两次，且非终结攻击更快。
- **数值**：support_crescendo_non_final_strike_attack_speed_+%_final = 15
- 家族：渐强Ⅱ｜标签：攻击、近战、打击

### 渐强Ⅲ（Crescendo III）

- **功能**：辅助以终结技收尾的连段打击，使终结技获得先祖强化。
- **数值**：—
- 家族：渐强Ⅲ｜标签：攻击、近战、打击

### 圆满Ⅰ（Culmination I）

- **功能**：辅助近战攻击技能。你用其他近战攻击成功打击敌人时辅助技能获得连段。使用时重置连段，使用时连段越高伤害越高。不能辅助已有连段的技能。不改变随从的技能。
- **数值**：support_culmination_damage_+%_final_per_combo_stack = 3；base_combo_stacks_decay_delay_ms = 4000；最大连段层数 10
- 家族：圆满Ⅰ｜标签：攻击、近战、条件

### 圆满Ⅱ（Culmination II）

- **功能**：辅助近战攻击技能。你用其他近战攻击成功打击敌人时辅助技能获得连段。使用时重置连段，使用时连段越高伤害越高。不能辅助已有连段的技能。不改变随从的技能。
- **数值**：support_culmination_damage_+%_final_per_combo_stack = 4；base_combo_stacks_decay_delay_ms = 6000；最大连段层数 10
- 家族：圆满Ⅱ｜标签：攻击、近战、条件

### 卡欧的疯狂（Kaom's Madness）

- **功能**：辅助在地面生成裂隙的技能，使其生成大量额外裂隙，代价是伤害、速度与范围。
- **数值**：base_number_of_additional_fissures = 3；support_additional_fissures_damage_+%_final = -20；support_additional_fissures_skill_speed_+%_final = -20；support_upheaval_area_of_effect_+%_final = -30
- 家族：卡欧的疯狂｜标签：血统(传奇)、攻击、近战

### 卡尔古之拳（Fist Of Kalguur）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：卡尔古之拳｜标签：攻击、范围、近战、猛击、触发、物理、持续

### 战争之拳Ⅰ（Fist of War I）

- **功能**：辅助你自己使用的猛击，每几秒提供一次强力的先祖强化。
- **数值**：support_ancestral_slam_big_hit_max_count = 1；ancestral_slam_interval_duration = 6000
- 家族：战争之拳Ⅰ｜标签：攻击、近战、猛击

### 战争之拳Ⅱ（Fist of War II）

- **功能**：辅助你自己使用的猛击，每几秒提供一次强力的先祖强化。
- **数值**：support_ancestral_slam_big_hit_max_count = 1；ancestral_slam_interval_duration = 4000
- 家族：战争之拳Ⅱ｜标签：攻击、近战、猛击

### 战争之拳Ⅲ（Fist of War III）

- **功能**：辅助你自己使用的猛击，低频但极其强力的先祖强化。
- **数值**：support_ancestral_slam_big_hit_max_count = 1；ancestral_slam_interval_duration = 14000
- 家族：战争之拳Ⅲ｜标签：攻击、近战、猛击

### 重挥（Heavy Swing）

- **功能**：辅助近战攻击，提高其物理伤害但降低攻击速度。
- **数值**：support_melee_physical_damage_+%_final = 35；support_melee_physical_damage_attack_speed_+%_final = -10
- 家族：重挥｜标签：攻击、近战、物理

### 冲击震荡波（Impact Shockwave）

- **功能**：辅助近战打击与风系技能，重度眩晕敌人时生成余震，伤害目标周围敌人。
- **数值**：support_impact_shockwave_base_non_slam_aftershock_on_heavy_stun_radius = 15
- 家族：冲击震荡波｜标签：攻击、范围、近战、打击

### 弗鲁恩的必然（Vruun's Inevitability）

- **功能**：辅助近战攻击技能。你用其他近战攻击成功打击敌人时辅助技能获得连段。使用时消耗连段，连段越高范围越大。不能辅助已有连段的技能。不改变随从的技能。
- **数值**：area_of_effect_+%_per_combo_stack = 6；base_combo_stacks_decay_delay_ms = 6000；最大连段层数 10
- 家族：弗鲁恩的必然｜标签：血统(传奇)、攻击、近战、条件

### 碎棱之地Ⅰ（Jagged Ground I）

- **功能**：辅助猛击技能。辅助技能使用时消耗耐力球以生成碎棱之地。不能辅助会消耗耐力球的技能。
- **数值**：support_jagged_ground_base_duration_ms = 4000；support_create_jagged_ground_if_consumed_endurance_charge = 1
- 家族：碎棱之地Ⅰ｜标签：攻击、范围、近战、猛击、持续

### 碎棱之地Ⅱ（Jagged Ground II）

- **功能**：辅助猛击技能。辅助猛击技能造成的余震必定生成碎棱之地。
- **数值**：support_jagged_ground_base_duration_ms = 4000
- 家族：碎棱之地Ⅱ｜标签：攻击、范围、近战、猛击、持续

### 熟练连段（Practiced Combo）

- **功能**：辅助打击技能。辅助技能命中时有概率获得额外连段。不能辅助随使用的技能。
- **数值**：additional_combo_gain_chance_% = 40
- 家族：熟练连段｜标签：攻击、近战、打击

### 凿穿（Punch Through）

- **功能**：辅助近战攻击技能。辅助技能击退敌人时施加易被命中，使敌人受到的下一次投射物攻击命中伤害提高。
- **数值**：apply_attack_projectile_weakness_%_per_1m_knockback = 3
- 家族：凿穿｜标签：攻击、近战

### 追击Ⅰ（Pursuit I）

- **功能**：辅助近战攻击。若过去 8 秒内你曾以投射物攻击命中，辅助技能近战伤害更高，但其自身无法造成投射物伤害。
- **数值**：support_advancing_assault_melee_damage_+%_final_if_projectile_attack_damage_hit_in_past_8_seconds = 20；support_advancing_assault_projectile_damage_+%_final = -100
- 家族：追击Ⅰ｜标签：攻击、近战

### 追击Ⅱ（Pursuit II）

- **功能**：辅助近战攻击。若过去 8 秒内你曾以投射物攻击命中，辅助技能近战伤害更高，但其自身无法造成投射物伤害。
- **数值**：support_advancing_assault_melee_damage_+%_final_if_projectile_attack_damage_hit_in_past_8_seconds = 25；support_advancing_assault_projectile_damage_+%_final = -100
- 家族：追击Ⅱ｜标签：攻击、近战

### 追击Ⅲ（Pursuit III）

- **功能**：辅助近战攻击。若过去 2 秒内你曾以投射物攻击命中，辅助技能近战伤害更高，但其自身无法造成投射物伤害。
- **数值**：support_advancing_assault_melee_damage_+%_final_if_projectile_attack_damage_hit_in_past_2_seconds = 30；support_advancing_assault_projectile_damage_+%_final = -100
- 家族：追击Ⅲ｜标签：攻击、近战

### 羽刺迸发（Quill Burst）

- **功能**：辅助近战攻击技能。辅助技能触发羽刺迸发，在被击中目标周围区域造成你的荆棘伤害。羽刺迸发只能在你以荆棘伤害还击后命中时触发。
- **数值**：—
- 家族：羽刺迸发｜标签：攻击、范围、近战、触发、物理

### 梅德维的伐斩（Medved's Felling）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：梅德维的伐斩｜标签：血统(传奇)、攻击、近战

### 暴怒Ⅰ（Rage I）

- **功能**：辅助近战攻击，命中时给予怒气。
- **数值**：gain_x_rage_on_melee_hit = 3；support_rage_attack_damage_+%_final = 0
- 家族：暴怒Ⅰ｜标签：攻击、近战

### 暴怒Ⅱ（Rage II）

- **功能**：辅助近战攻击，命中时给予怒气。
- **数值**：gain_x_rage_on_melee_hit = 5；support_rage_attack_damage_+%_final = 0
- 家族：暴怒Ⅱ｜标签：攻击、近战

### 暴怒Ⅲ（Rage III）

- **功能**：辅助近战攻击，命中时给予怒气。你或辅助随从未满怒时，辅助技能攻击速度显著提高。
- **数值**：gain_x_rage_on_melee_hit = 5；support_rage_attack_damage_+%_final = 0；support_rage_attack_speed_+%_while_not_at_maximum_rage = 15
- 家族：暴怒Ⅲ｜标签：攻击、近战

### 撕裂之巅（Rending Apex）

- **功能**：辅助以终结技收尾的连段打击，使终结技按所造成攻击伤害的一部分破甲。
- **数值**：final_strike_attack_damage_%_dealt_as_armour_break = 75
- 家族：撕裂之巅｜标签：攻击、近战、打击

### 还击Ⅰ（Retaliate I）

- **功能**：辅助你自己使用的近战攻击技能。你越接近被重度眩晕，辅助技能获得越多伤害。
- **数值**：support_max_attack_damage_+%_final_from_current_poise = 40
- 家族：还击Ⅰ｜标签：攻击、近战

### 还击Ⅱ（Retaliate II）

- **功能**：辅助你自己使用的近战攻击技能。你越接近被重度眩晕，辅助技能获得越多伤害且更容易眩晕敌人。
- **数值**：support_max_attack_damage_+%_final_from_current_poise = 40；support_hit_damage_stun_multiplier_+%_final_from_current_poise = 100
- 家族：还击Ⅱ｜标签：攻击、近战

### 回荡（Reverberate）

- **功能**：辅助猛击技能。有余震概率的辅助猛击技能，攻击时间越长余震概率越高。
- **数值**：chance_to_aftershock_+%_per_250_ms_attack_time = 15
- 家族：回荡｜标签：攻击、近战、猛击

### 撕裂（Rip）

- **功能**：辅助你自己使用或触发的近战攻击技能。用辅助技能击杀流血敌人会生成血之残息。收集后短时间内提高你的生命回复。
- **数值**：create_life_remnant_on_melee_kill_bleeding_enemy_% = 100；rip_support_life_remnant_creation_radius = 15；base_remnant_duration_ms = 8000；rip_support_buff_base_duration = 5000；rip_support_life_regeneration_rate_+% = 10
- 家族：撕裂｜标签：攻击、近战、物理、持续、残息

### 切磋（Spar）

- **功能**：辅助近战攻击技能。你越接近被重度眩晕，辅助技能越容易眩晕敌人。
- **数值**：support_hit_damage_stun_multiplier_+%_final_from_current_poise = 100
- 家族：切磋｜标签：攻击、近战

### 朔望（Syzygy）

- **功能**：辅助你自己使用的猛击技能。对既被点燃又被完全破甲的敌人，辅助技能的命中视为碾压之击。重度眩晕这类敌人时将其威慑。
- **数值**：—
- 家族：朔望｜标签：攻击、近战、猛击、火焰

### 割裂（Tear）

- **功能**：辅助你自己使用或触发的近战攻击。用辅助技能击杀流血敌人时，其击杀特效有概率触发两次。
- **数值**：on_kill_effect_occur_twice_chance_%_vs_bleeding_enemies = 50
- 家族：割裂｜标签：攻击、近战、物理


## 法术施放（37 条）
>
> 施法速度、回响、封印与层叠

### 加速生长（Accelerated Growth）

- **功能**：辅助草木技能，其被过度生长后触发爆炸。
- **数值**：—
- 家族：加速生长｜标签：法术、范围、触发、草木

### 加速生长Ⅱ（Accelerated Growth II）

- **功能**：辅助草木技能，其被过度生长后触发爆炸，致盲命中的敌人。
- **数值**：—
- 家族：加速生长｜标签：法术、范围、触发、草木

### 仲裁者的点燃（Arbiter's Ignition）

- **功能**：辅助火焰法术技能，用其点燃时使你获得元素主宰。
- **数值**：gain_archon_elemental_when_you_ignite_enemy_chance_% = 100
- 家族：仲裁者的点燃｜标签：血统(传奇)、法术、火焰

### 奥术涌动（Arcane Surge）

- **功能**：辅助你自己施放的法术，追踪其魔力消耗。累计消耗足够魔力后获得一阵魔力回复与施法速度。
- **数值**：support_arcane_surge_base_duration_ms = 10000；support_arcane_surge_gain_buff_on_%_of_maximum_mana_use_threshold = 100
- 家族：奥术涌动｜标签：法术、持续

### 混沌冰冻（Chaotic Freeze）

- **功能**：辅助造成非异常混沌持续伤害的法术。受辅助技能减益持续伤害的敌人，会因任何来源的混沌伤害命中而累积冰冻。不辅助随从使用的技能。
- **数值**：—
- 家族：混沌冰冻｜标签：法术、混沌

### 震荡法术（Concussive Spells）

- **功能**：辅助命中敌人的法术。辅助技能以物理伤害暴击敌人时使其恍惚。
- **数值**：—
- 家族：震荡法术｜标签：法术、物理

### 审慎施法（Considered Casting）

- **功能**：辅助你自己施放、命中敌人的法术技能，提高伤害但降低施法速度。
- **数值**：support_slow_cast_cast_speed_+%_final = -15；support_slow_cast_spell_damage_+%_final = 35
- 家族：审慎施法｜标签：法术

### 受控毁灭（Controlled Destruction）

- **功能**：辅助命中敌人的法术，提高伤害但其无法暴击。
- **数值**：support_controlled_destruction_spell_damage_+%_final = 25
- 家族：受控毁灭｜标签：法术

### 抽纳异常（Drain Ailments）

- **功能**：辅助造成非异常持续伤害的法术，使其消耗所施加持续伤害减益目标身上的异常，以造成大幅更高的持续伤害。
- **数值**：support_drained_ailment_damage_over_time_+%_final_if_ailment_consumed = 35
- 家族：抽纳异常｜标签：法术

### 埃奥尼尔的雷霆（Eonyr's Thunder）

- **功能**：辅助任何能造成伤害的技能。辅助技能的闪电伤害可以电殛敌人，但其自身不能施加感电；被电殛状态下被击杀的敌人爆炸，按其最大生命一定百分比造成闪电伤害。
- **数值**：—
- 家族：电殛｜标签：血统(传奇)、法术、范围、触发、闪电

### 电磁（Electromagnetism）

- **功能**：辅助命中敌人的技能。当辅助技能对附近有其他感电敌人的敌人施加感电时，触发电磁吸引，把附近敌人拉向中心、使其迟缓并间隔放射闪电伤害。
- **数值**：try_consuming_shock_to_trigger_shocking_rift_in_radius_on_shocking_enemy = 40
- 家族：电磁｜标签：法术、范围、触发、续航、闪电、结算

### 元素催化（Catalysing Elements）

- **功能**：辅助受元素地面强化的技能，当其被盟友的元素地面强化时，触发对应类型的催化放电。
- **数值**：—
- 家族：元素宣泄｜标签：法术、范围、触发、闪电、冰霜、火焰

### 元素宣泄（Elemental Discharge）

- **功能**：辅助任何命中敌人的法术，命中时消耗元素异常以触发元素宣泄。不能辅助随从的技能或已会消耗元素异常的技能。
- **数值**：—
- 家族：元素宣泄｜标签：法术、范围、触发、闪电、冰霜、火焰、结算

### 缓速增效（Slow Potency）

- **功能**：辅助任何技能，使其施加的减速更强大。
- **数值**：base_debuff_slow_magnitude_+% = 15
- 家族：缓速增效｜标签：法术

### 榨取（Extraction）

- **功能**：辅助造成伤害命中的法术技能。施放辅助法术时献祭你的一部分生命，换取额外混沌伤害。不辅助常驻、随从或触发技能。
- **数值**：sacrifice_%_life_on_skill_use = 10；non_skill_base_all_damage_%_to_gain_as_chaos = 35
- 家族：榨取｜标签：法术、混沌

### 火中送葬（Fiery Death）

- **功能**：辅助任何命中敌人的技能，使其点燃的敌人死亡时有概率爆炸。
- **数值**：chance_to_trigger_fiery_death_on_ignited_enemy_death_% = 60
- 家族：火中送葬｜标签：法术、范围、触发、火焰

### 末日将至（Impending Doom）

- **功能**：辅助你自己施放的诅咒技能，诅咒到期时对被诅咒敌人触发厄运爆破。
- **数值**：—
- 家族：末日将至｜标签：法术、范围、触发、混沌

### 抑制者（Inhibitor）

- **功能**：辅助你自己使用或触发的任何技能。辅助技能无法以任何方式消耗充能球或元素灌注。不能辅助需要充能球或灌注才能使用的技能。
- **数值**：support_inhibitor_damage_+%_final_per_charge_type_or_infusion_type = 4
- 家族：抑制者｜标签：法术

### 剧烈苦痛（Intense Agony）

- **功能**：辅助造成非异常持续伤害的法术：持续时间缩短，但对满血敌人施加的减益持续伤害大幅提高。
- **数值**：support_chaotic_assassination_damage_over_time_+%_final_against_full_life_enemies = 50；support_chaotic_assassination_skill_effect_duration_+%_final = -25
- 家族：剧烈苦痛｜标签：法术、持续

### 魔力闪光（Mana Flare）

- **功能**：辅助任何命中敌人的法术，暴击时触发魔力闪光。魔力闪光消耗你的魔力造成火焰伤害。不能辅助随从的技能。
- **数值**：—
- 家族：魔力闪光｜标签：法术、范围、触发、火焰

### 奥辛的誓言（Oisin's Oath）

- **功能**：辅助命中敌人的技能，使其魔力偷取改为按元素伤害而非物理伤害回复。
- **数值**：—
- 家族：魔力偷取｜标签：血统(传奇)、法术

### 强效易伤（Potent Exposure）

- **功能**：辅助对敌人施加易伤的技能，提高所施加易伤的效果。
- **数值**：exposure_effect_+% = 20
- 家族：强效易伤｜标签：法术

### 实用魔法Ⅰ（Practical Magic I）

- **功能**：辅助命中敌人的技能。用辅助技能重度眩晕敌人时，短时间内你的法术伤害提高。
- **数值**：support_stunning_magic_grant_spell_damage_+%_buff_on_heavy_stunning = 30；support_stunning_magic_buff_duration_ms = 8000
- 家族：实用魔法Ⅰ｜标签：法术、持续

### 实用魔法Ⅱ（Practical Magic II）

- **功能**：辅助命中敌人的技能。用辅助技能重度眩晕敌人时，短时间内你的法术伤害提高。
- **数值**：support_stunning_magic_grant_spell_damage_+%_buff_on_heavy_stunning = 40；support_stunning_magic_buff_duration_ms = 8000
- 家族：实用魔法Ⅱ｜标签：法术、持续

### 迅捷施法Ⅰ（Rapid Casting I）

- **功能**：辅助法术，使其施放更快。
- **数值**：base_cast_speed_+% = 15
- 家族：迅捷施法Ⅰ｜标签：法术

### 迅捷施法Ⅱ（Rapid Casting II）

- **功能**：辅助法术，使其施放更快。
- **数值**：base_cast_speed_+% = 20
- 家族：迅捷施法Ⅱ｜标签：法术

### 迅捷施法Ⅲ（Rapid Casting III）

- **功能**：辅助法术，过去 8 秒内你每施放过一种不同法术，其施放更快。
- **数值**：cast_speed_+%_per_num_unique_spells_cast_in_last_8_seconds = 10
- 家族：迅捷施法Ⅲ｜标签：法术

### 解放（Unleash）

- **功能**：辅助你自己施放的可重复法术，随时间为其封印。施放时封印破碎，每道使法术重复一次。不能辅助有冷却或已有封印的技能。
- **数值**：support_spell_rapid_fire_repeat_use_damage_+%_final = -50；support_%_of_total_cast_time_as_base_skill_seal_gain_interval = 200；最大封印数 2；skill_rapid_fire_repeats_per_broken_seal = 1
- 家族：解放｜标签：法术

### 扎洛克的反叛（Zarokh's Revolt）

- **功能**：辅助你自己施放的可重复法术，随时间为其封印并给予中等冷却。施放时封印破碎，每道使法术重复一次。不能辅助有冷却或已有封印的技能。
- **数值**：support_spell_rapid_fire_repeat_use_damage_+%_final = -20；support_%_of_total_cast_time_as_base_skill_seal_gain_interval = 50；最大封印数 5；skill_rapid_fire_repeats_per_broken_seal = 1
- 家族：扎洛克的反叛｜标签：法术

### 扩张（Expand）

- **功能**：辅助你自己施放的法术，随时间为其封印。施放时封印破碎，提高范围。不能辅助引导技能、有冷却或已有封印的技能。
- **数值**：最大封印数 3；support_%_of_total_cast_time_as_base_skill_seal_gain_interval = 200；skill_area_of_effect_+%_per_broken_seal = 30
- 家族：封印·扩大范围系｜标签：法术、范围

### 法术回响（Spell Echo）

- **功能**：辅助你自己使用的可叠瀑法术。辅助法术回响。
- **数值**：support_multicast_cast_speed_+%_final = -30；support_spell_echo_number_of_echo_cascades = 1；echoed_spell_area_of_effect_+% = 40
- 家族：法术回响｜标签：法术、范围

### 骗徒碎片（Trickster's Shard）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：法术回响｜标签：血统(传奇)、法术、范围、触发、持续

### 扎洛克的叠唱（Zarokh's Refrain）

- **功能**：辅助你自己施放的可叠瀑法术。辅助法术回响三次，但获得冷却。不能辅助已有冷却的技能。
- **数值**：support_spell_echo_number_of_echo_cascades = 3；echoed_spell_area_of_effect_+% = 40
- 家族：法术回响｜标签：血统(传奇)、法术、范围

### 图尔的雪崩（Tul's Avalanche）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：图尔的雪崩｜标签：血统(传奇)、法术、范围

### 静电冲击（Static Shocks）

- **功能**：辅助可命中敌人的技能。用辅助技能命中使敌人感电时触发静电冲击，使该敌人成为闪电伤害源，向附近敌人放射脉冲。
- **数值**：grounding_shocks_chance_%_to_create_orb_on_shocking_enemy = 100
- 家族：静电冲击｜标签：法术、范围、触发、续航、闪电、持续

### 天顶Ⅰ（Zenith I）

- **功能**：辅助法术技能。你的魔力高于 90% 上限时辅助技能伤害更高。不改变随从的技能。
- **数值**：support_spell_damage_+%_final_while_above_90%_maximum_mana = 30
- 家族：天顶Ⅰ｜标签：法术

### 天顶Ⅱ（Zenith II）

- **功能**：辅助法术技能。魔力高于 90% 上限时伤害更高，且魔力消耗效率提高。不改变随从的技能。
- **数值**：support_spell_damage_+%_final_while_above_90%_maximum_mana = 30；base_mana_cost_efficiency_+% = 25
- 家族：天顶Ⅱ｜标签：法术


## 触发与结算（22 条）
>
> 触发机制、延迟结算与标记 payoff

### 凛霜噬骨Ⅰ（Biting Frost I）

- **功能**：辅助任何命中敌人的技能，对冰冻敌人伤害更高并消耗其冰冻。不能辅助会消耗冰冻的技能。
- **数值**：support_active_skill_consume_enemy_freeze_to_gain_damage_+%_final = 40；support_biting_frost_damage_+%_final_vs_frozen_unique_enemies = 20
- 家族：凛霜噬骨Ⅰ｜标签：冰霜、结算

### 凛霜噬骨Ⅱ（Biting Frost II）

- **功能**：辅助任何命中敌人的技能，对冰冻敌人伤害更高但消耗其冰冻，使其余留寒冻。不能辅助会消耗冰冻的技能。
- **数值**：support_active_skill_consume_enemy_freeze_to_gain_damage_+%_final = 40；support_biting_frost_damage_+%_final_vs_frozen_unique_enemies = 20
- 家族：凛霜噬骨Ⅱ｜标签：冰霜、结算

### 莫瑞甘的洞悉（Morrigan's Insight）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：莫瑞甘的洞悉｜标签：血统(传奇)、触发、冰霜、持续、结算

### 骨片飞溅（Bone Shrapnel）

- **功能**：辅助命中敌人的技能。辅助技能击杀被钉固的敌人时触发骨片飞溅爆炸。
- **数值**：—
- 家族：骨片飞溅｜标签：范围、触发、物理

### 燃烧铭刻（Burning Inscription）

- **功能**：辅助施放时生成符文铭刻的技能，使符文铭刻到期时触发燃烧铭刻。燃烧铭刻是一个法术，按你最大魔力生成点燃地面。
- **数值**：—
- 家族：燃烧铭刻｜标签：范围、触发、火焰

### 迸裂瘟疫（Bursting Plague）

- **功能**：辅助能中毒敌人的技能，中毒敌人随时间积累瘟疫，死亡时瘟疫迸裂爆炸。不能辅助随从的技能。
- **数值**：support_bursting_plague_store_%_poison_applied_magnitude_towards_burst = 100；support_bursting_plague_max_value_%_of_max_life = 20
- 家族：迸裂瘟疫｜标签：范围、触发、物理、混沌

### 蔓延寒意（Creeping Chill）

- **功能**：辅助任何生成冰晶的技能：若可能则消耗一个暴击球，在冰晶周围生成寒冰地面。
- **数值**：—
- 家族：蔓延寒意｜标签：范围、触发、冰霜

### 刚毅决心（Deadly Resolve）

- **功能**：辅助你自己使用的引导技能。引导期间周期性获得刚毅决断层。敌人命中你时消耗一层，向其触发致命一斩，伤害按你的护甲提高。
- **数值**：maximum_dangerous_resolve_stacks = 3；dangerous_resolve_stack_duration_ms = 10000；dangerous_resolve_explosion_cooldown_ms = 300
- 家族：刚毅决心｜标签：攻击、范围、触发、物理、引导、段式

### 能量存续（Energy Retention）

- **功能**：辅助元技能。辅助技能触发或祈唤其他技能时，有概率返还一部分能量消耗。
- **数值**：trigger_skills_refund_half_energy_spent_chance_% = 35
- 家族：能量存续｜标签：触发

### 弱点利用（Exploit Weakness）

- **功能**：辅助任何命中敌人的技能，对破甲敌人伤害更高，但其自身不能破甲。不能辅助会消耗破甲状态的技能。
- **数值**：support_gem_consume_enemy_fully_broken_armour_to_gain_damage_+%_final = 40
- 家族：弱点利用｜标签：结算

### 火上浇油（Fan The Flames）

- **功能**：辅助命中敌人的风系技能。对被点燃敌人的命中触发火焰爆炸，伤害该敌人及其身后锥形区域内的敌人。
- **数值**：—
- 家族：火上浇油｜标签：攻击、范围、触发、火焰

### 火上浇油Ⅱ（Fan The Flames II）

- **功能**：辅助命中敌人的风系技能。对被点燃敌人的命中触发火焰爆炸，伤害该敌人及其身后锥形区域内的敌人，并把初始敌人的点燃传播给其他被命中者。
- **数值**：—
- 家族：火上浇油｜标签：攻击、范围、触发、火焰

### 火焰之柱（Flame Pillar）

- **功能**：辅助你自己使用、命中敌人的任何技能。辅助技能命中时消耗点燃，生成火焰之柱，但其自身不能施加点燃。不能辅助已会消耗点燃的技能，不改变随从的技能。
- **数值**：flame_pillar_support_maximum_pillars_per_skill_use = 10
- 家族：火焰之柱｜标签：范围、触发、火焰

### 侥幸（Fluke）

- **功能**：辅助触发其他技能的技能。被辅助技能触发的技能，触发时伤害随机提高或降低，并随机返还一部分消耗。
- **数值**：support_randomise_lower_recover_%_cost_on_use = 0；support_randomise_higher_recover_%_cost_on_use = 20；support_randomise_lower_damage_+%_final = -40；support_randomise_higher_damage_+%_final = 60
- 家族：侥幸｜标签：触发

### 伊克切尔的折磨（Ixchel's Torment）

- **功能**：辅助触发其他技能的技能。被辅助技能触发的技能，触发时伤害、范围与投射物速度随机提高或降低，并随机返还一部分消耗。
- **数值**：support_randomise_lower_recover_%_cost_on_use = 0；support_randomise_higher_recover_%_cost_on_use = 20；support_randomise_lower_damage_+%_final = -40；support_randomise_higher_damage_+%_final = 60；support_randomise_higher_aoe_+%_final = 50；support_randomise_lower_aoe_+%_final = -40；support_randomise_higher_projectile_speed_+%_final = 50；support_randomise_lower_projectile_speed_+%_final = -40
- 家族：侥幸｜标签：血统(传奇)、触发

### 霜火（Frostfire）

- **功能**：辅助任何命中敌人的技能，点燃冰冻敌人时消耗冰冻以强化点燃效果。不能辅助会消耗冰冻或点燃的技能。
- **数值**：ignite_effect_+%_final_against_frozen_enemies = 50；support_frostfire_ignite_effect_+%_final_vs_frozen_unique_enemies = 25
- 家族：霜火｜标签：冰霜、火焰、结算

### 血晶（Haemocrystals）

- **功能**：辅助自己使用的、可造成伤害命中的攻击技能。辅助技能命中时消耗流血，生成装满血液的爆炸晶体，但其自身不能施加流血。不能辅助已经会消耗流血的技能。
- **数值**：support_haemocrystals_maximum_allowed_crystals = 20
- 家族：血晶｜标签：攻击、范围、触发、物理

### 焚身（Immolate）

- **功能**：辅助攻击技能，对被点燃敌人附加火焰伤害，但其自身无法点燃敌人。
- **数值**：non_skill_base_all_damage_%_to_gain_as_fire_with_attacks_vs_burning_enemies = 30
- 家族：焚身｜标签：火焰、结算

### 毒孢子（Poison Spores）

- **功能**：辅助命中敌人的草木技能。辅助技能命中敌人时触发毒疱。
- **数值**：—
- 家族：毒孢子｜标签：攻击、增益、范围、触发、物理、混沌、持续、草木

### 践踏之地（Stomping Ground）

- **功能**：辅助位移技能，使用期间你的脚步碎裂地面并放射伤害性震荡波。
- **数值**：—
- 家族：践踏之地｜标签：攻击、范围、触发

### 风之波（Wind Wave）

- **功能**：辅助任何你能使用的技能：使用中若你被眩晕，触发一阵风击退敌人。
- **数值**：—
- 家族：风之波｜标签：范围、触发

### 希巴夸的撕裂（Xibaqua's Rending）

- **功能**：辅助腾空的技能，使你落地处的尸体猛烈爆炸，伤害周围敌人。
- **数值**：—
- 家族：希巴夸的撕裂｜标签：血统(传奇)、范围、触发、火焰


## 物理、流血与中毒（36 条）
>
> 物理伤害与创伤类异常

### 调和（Admixture）

- **功能**：辅助可造成伤害命中的技能。其造成的流血对中毒敌人更有效，其造成的中毒对流血敌人更有效。
- **数值**：mixed_maladies_poison_effect_+%_final_vs_bleeding = 20；mixed_maladies_bleed_effect_+%_final_vs_poisoned = 20
- 家族：调和｜标签：物理、混沌

### 破甲Ⅰ（Armour Break I）

- **功能**：辅助命中敌人的技能，使这些命中按所造成物理伤害的一部分打破护甲。
- **数值**：armour_break_physical_damage_%_dealt_as_armour_break = 15
- 家族：破甲Ⅰ｜标签：物理

### 破甲Ⅱ（Armour Break II）

- **功能**：辅助命中敌人的技能，使这些命中按所造成物理伤害的一部分打破护甲。用辅助技能完全破甲时，有概率获得一个耐力球。
- **数值**：armour_break_physical_damage_%_dealt_as_armour_break = 15；chance_to_gain_endurance_charge_on_armour_break_% = 15
- 家族：破甲Ⅱ｜标签：物理

### 破甲Ⅲ（Armour Break III）

- **功能**：辅助命中敌人的技能，使这些命中按所造成物理伤害的一部分打破护甲。用辅助技能完全破甲时，有概率获得一个耐力球。
- **数值**：armour_break_physical_damage_%_dealt_as_armour_break = 20；chance_to_gain_endurance_charge_on_armour_break_% = 20
- 家族：破甲Ⅲ｜标签：物理

### 脆化护甲（Brittle Armour）

- **功能**：辅助可命中敌人的技能。辅助技能的命中冰冻敌人时，对其造成的物理伤害会破甲，冰冻期间有效。
- **数值**：freeze_applies_%_physical_damage_taken_as_armour_break = 100
- 家族：脆化护甲｜标签：物理、冰霜

### 斯特恩的凶暴（Styrn's Ferocity）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：斯特恩的凶暴｜标签：血统(传奇)、物理

### 乌鲁克的熔炼（Uruk's Smelting）

- **功能**：辅助任何技能，使其施加的破甲更强；用辅助技能完全破甲时，受影响敌人受到的物理伤害永久提高（有上限）。
- **数值**：support_demolisher_physical_damage_taken_+%_on_fully_armour_breaking_up_to_20% = 5；support_increased_armour_break_armour_break_amount_+%_final = 70
- 家族：乌鲁克的熔炼｜标签：血统(传奇)、物理

### 流血Ⅰ（Bleed I）

- **功能**：辅助任何命中敌人的技能，给予其流血概率。
- **数值**：base_chance_to_inflict_bleeding_% = 50
- 家族：流血Ⅰ｜标签：物理

### 流血Ⅱ（Bleed II）

- **功能**：辅助任何命中敌人的技能，给予其流血概率。
- **数值**：base_chance_to_inflict_bleeding_% = 75
- 家族：流血Ⅱ｜标签：物理

### 流血Ⅲ（Bleed III）

- **功能**：辅助任何命中敌人的技能，使其施加流血。
- **数值**：base_chance_to_inflict_bleeding_% = 100
- 家族：流血Ⅲ｜标签：物理

### 流血Ⅳ（Bleed IV）

- **功能**：辅助任何命中敌人的技能，对流血敌人的近战物理伤害更高，但其自身不能施加流血。辅助技能命中时还施加切创。
- **数值**：support_bloodlust_melee_physical_damage_+%_final_vs_bleeding_enemies = 30
- 家族：流血Ⅳ｜标签：物理

### 乌尔尼托的怀抱（Uul-Netol's Embrace）

- **功能**：辅助可造成伤害命中的技能，给予额外混沌伤害，并使混沌伤害可以破甲。
- **数值**：non_skill_base_physical_damage_%_to_gain_as_chaos = 40；chaos_damage_%_dealt_as_armour_break = 20
- 家族：乌尔尼托的怀抱｜标签：血统(传奇)、物理、混沌

### 残暴Ⅰ（Brutality I）

- **功能**：辅助任何造成伤害的技能，提高其物理伤害而牺牲其他所有伤害类型。
- **数值**：support_brutality_physical_damage_+%_final = 25
- 家族：残暴Ⅰ｜标签：物理

### 残暴Ⅱ（Brutality II）

- **功能**：辅助任何造成伤害的技能，提高其物理伤害而牺牲其他所有伤害类型。
- **数值**：support_brutality_physical_damage_+%_final = 30
- 家族：残暴Ⅱ｜标签：物理

### 残暴Ⅲ（Brutality III）

- **功能**：辅助任何造成伤害的技能，提高其物理伤害而牺牲其他所有伤害类型，并使该技能的命中有概率无视物理伤害减免。
- **数值**：support_brutality_physical_damage_+%_final = 30；hits_ignore_enemy_monster_physical_damage_reduction_%_chance = 20
- 家族：残暴Ⅲ｜标签：物理

### 宣泄（Catharsis）

- **功能**：辅助你自己使用的任何技能，使辅助技能引爆你身上的不稳定性。辅助技能需在你拥有一定量不稳定性时才能使用，不能辅助已有其他使用条件的技能。
- **数值**：—
- 家族：宣泄｜标签：物理、混沌、条件

### 腐蚀（Corrosion）

- **功能**：辅助任何命中敌人的技能，使其施加的中毒同时打破敌人护甲。不能辅助会消耗完全破甲的技能。
- **数值**：armour_break_for_%_of_poison_damage_over_poison_duration = 80
- 家族：腐蚀｜标签：物理、混沌

### 深创Ⅰ（Deep Cuts I）

- **功能**：辅助任何命中敌人的技能，伤害降低但施加的流血更强。
- **数值**：support_deep_cuts_hit_damage_+%_final = -25；support_deep_cuts_bleeding_effect_+%_final = 75
- 家族：深创Ⅰ｜标签：物理

### 深创Ⅱ（Deep Cuts II）

- **功能**：辅助任何命中敌人的技能，伤害降低但施加的流血更强。
- **数值**：support_deep_cuts_hit_damage_+%_final = -30；support_deep_cuts_bleeding_effect_+%_final = 100
- 家族：深创Ⅱ｜标签：物理

### 恍惚（Daze）

- **功能**：辅助攻击技能，使其按所造成物理伤害的一部分累积恍惚。
- **数值**：—
- 家族：恍惚｜标签：攻击、物理

### 厚重（Heft）

- **功能**：辅助造成伤害的技能，提高其命中伤害的物理上限。
- **数值**：support_heft_maximum_physical_damage_+%_final = 30
- 家族：厚重｜标签：物理

### 戳刺（Impale）

- **功能**：辅助攻击技能，命中时戳刺敌人，但其自身无法提取戳刺。
- **数值**：impale_on_hit_%_chance = 100
- 家族：戳刺｜标签：攻击、物理

### 切割（Incision）

- **功能**：辅助攻击技能。辅助技能命中时施加切创，使敌人更容易被施加流血。对目标施加流血时会移除其身上的全部切创。
- **数值**：support_incision_bleeding_effect_+%_final_per_incision_consumed_recently_up_to_30% = 3
- 家族：切割｜标签：攻击、物理

### 生命偷取Ⅰ（Life Leech I）

- **功能**：辅助攻击技能，使其物理伤害偷取生命。
- **数值**：base_life_leech_from_physical_attack_damage_permyriad = 1200
- 家族：生命偷取Ⅰ｜标签：攻击、物理

### 生命偷取Ⅱ（Life Leech II）

- **功能**：辅助攻击技能，使其物理伤害偷取生命。
- **数值**：base_life_leech_from_physical_attack_damage_permyriad = 1600
- 家族：生命偷取Ⅱ｜标签：攻击、物理

### 生命偷取Ⅲ（Life Leech III）

- **功能**：辅助攻击技能，使其物理伤害偷取生命，且满血时该偷取不会失效。
- **数值**：base_life_leech_from_physical_attack_damage_permyriad = 1600
- 家族：生命偷取Ⅲ｜标签：攻击、物理

### 阿塔露伊的放血（Atalui's Bloodletting）

- **功能**：辅助任何技能，把其一部分魔力消耗转为生命消耗。不辅助保留魂力的技能。辅助技能把其生命消耗的一部分作为额外物理伤害获得。
- **数值**：blood_magic_skill_life_cost_+%_final = 0；base_skill_cost_life_instead_of_mana_% = 100；gain_%_of_damage_as_physical_per_20_life_cost_up_to_40_% = 2
- 家族：生命汲取｜标签：血统(传奇)、物理

### 魔力偷取（Mana Leech）

- **功能**：辅助攻击技能，使其物理伤害偷取魔力。
- **数值**：base_mana_leech_from_physical_attack_damage_permyriad = 800
- 家族：魔力偷取｜标签：攻击、物理

### 物理专精（Physical Mastery）

- **功能**：辅助物理技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_physical_skill_gem_level_+ = 1
- 家族：专精系｜标签：物理

### 钉固Ⅰ（Pin I）

- **功能**：辅助任何命中敌人的技能，使其物理伤害可以钉固敌人但无法眩晕。
- **数值**：support_pin_spell_pinned_art_variation = 1
- 家族：钉固Ⅰ｜标签：物理

### 钉固Ⅱ（Pin II）

- **功能**：辅助任何命中敌人的技能，使其物理伤害可以钉固敌人但无法眩晕，并对被定身敌人给予暴击率。
- **数值**：support_pin_spell_pinned_art_variation = 1；critical_strike_chance_+%_vs_immobilised_enemies = 50
- 家族：钉固Ⅱ｜标签：物理

### 钉固Ⅲ（Pin III）

- **功能**：辅助任何命中敌人的技能，使其物理伤害可以钉固敌人但无法眩晕；辅助技能的钉固累积降低，但钉固持续大幅延长。
- **数值**：support_pin_spell_pinned_art_variation = 1；support_pin_pin_buildup_+%_final = -60；support_pin_pin_duration_+%_final = 30
- 家族：钉固Ⅲ｜标签：物理

### 符文灌注（Runic Infusion）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：符文灌注｜标签：攻击、物理

### 破裂（Rupture）

- **功能**：辅助命中敌人的技能。辅助技能命中重度眩晕的敌人时加剧其流血。
- **数值**：—
- 家族：破裂｜标签：物理

### 掘蚀（Undermine）

- **功能**：辅助攻击技能。辅助技能命中时消耗致残，按比例打破被致残目标的护甲，但其自身不能施加致残。
- **数值**：consume_maim_on_hit_to_break_%_armour = 35
- 家族：掘蚀｜标签：物理

### 不稳定性（Volatility）

- **功能**：辅助你自己使用、可造成伤害命中的技能。辅助技能暴击时获得不稳定性。
- **数值**：instability_on_critical_%_chance = 100
- 家族：不稳定性｜标签：物理、混沌


## 混沌与毒系（15 条）
>
> 混沌伤害与毒系异常

### 艾许的光辉（Esh's Radiance）

- **功能**：辅助可造成伤害命中的技能，给予额外混沌伤害，并使混沌伤害参与感电。
- **数值**：non_skill_base_lightning_damage_%_to_gain_as_chaos = 40
- 家族：艾许的光辉｜标签：血统(传奇)、闪电、混沌

### 图尔的静滞（Tul's Stillness）

- **功能**：辅助可造成伤害命中的技能，给予额外混沌伤害，并使混沌伤害参与冰冻累积。
- **数值**：non_skill_base_cold_damage_%_to_gain_as_chaos = 40
- 家族：图尔的静滞｜标签：血统(传奇)、冰霜、混沌

### 佐夫的火堆（Xoph's Pyre）

- **功能**：辅助可造成伤害命中的技能，给予额外混沌伤害，并使混沌伤害参与点燃。
- **数值**：non_skill_base_fire_damage_%_to_gain_as_chaos = 40
- 家族：佐夫的火堆｜标签：血统(传奇)、火焰、混沌

### 混沌调谐（Chaos Attunement）

- **功能**：辅助任何造成伤害的技能，使其获得混沌伤害，但其他类型伤害降低。
- **数值**：non_skill_base_all_damage_%_to_gain_as_chaos = 25；support_chaos_support_non_chaos_damage_+%_final = -50
- 家族：混沌调谐｜标签：混沌

### 剧毒Ⅰ（Deadly Poison I）

- **功能**：辅助任何命中敌人的技能，伤害降低但施加的中毒更强。
- **数值**：support_deadly_poison_hit_damage_+%_final = -25；support_deadly_poison_poison_effect_+%_final = 75
- 家族：剧毒Ⅰ｜标签：混沌

### 剧毒Ⅱ（Deadly Poison II）

- **功能**：辅助任何命中敌人的技能，伤害降低但施加的中毒更强。
- **数值**：support_deadly_poison_hit_damage_+%_final = -30；support_deadly_poison_poison_effect_+%_final = 100
- 家族：剧毒Ⅱ｜标签：混沌

### 递增剧毒（Escalating Poison）

- **功能**：辅助任何命中敌人的技能，使其可以对敌人施加额外一层中毒，但缩短这些中毒的持续时间。
- **数值**：number_of_additional_poison_stacks = 1；support_multi_poison_poison_duration_+%_final = -20
- 家族：递增剧毒｜标签：混沌

### 混沌专精（Chaos Mastery）

- **功能**：辅助混沌技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_chaos_skill_gem_level_+ = 1
- 家族：专精系｜标签：混沌

### 毒化Ⅰ（Poison I）

- **功能**：辅助任何命中敌人的技能，给予其中毒概率。
- **数值**：命中中毒概率 40%
- 家族：毒化Ⅰ｜标签：混沌

### 毒化Ⅱ（Poison II）

- **功能**：辅助任何命中敌人的技能，给予其中毒概率。
- **数值**：命中中毒概率 60%
- 家族：毒化Ⅱ｜标签：混沌

### 毒化Ⅲ（Poison III）

- **功能**：辅助任何命中敌人的技能：给予其中毒概率，且对流血敌人施加的中毒更强。
- **数值**：命中中毒概率 60%；mixed_maladies_poison_effect_+%_final_vs_bleeding = 20
- 家族：毒化Ⅲ｜标签：混沌

### 亵渎Ⅰ（Profanity I）

- **功能**：辅助你自己使用的技能。辅助技能使用时消耗一具尸体，若消耗则混沌伤害更高。
- **数值**：support_chaos_damage_+%_final_if_corpse_consumed_on_use = 30
- 家族：亵渎Ⅰ｜标签：混沌

### 亵渎Ⅱ（Profanity II）

- **功能**：辅助你自己使用的技能。辅助技能使用时消耗多具尸体，每具尸体提高混沌伤害。
- **数值**：support_chaos_damage_+%_final_per_corpse_consumed_on_use = 5
- 家族：亵渎Ⅱ｜标签：混沌

### 塔卡蒂的怒火（Tacati's Ire）

- **功能**：辅助可造成伤害命中的技能。你的怒气越高，辅助技能造成的中毒伤害结算越快。
- **数值**：faster_poison_%_per_current_rage = 2
- 家族：塔卡蒂的怒火｜标签：血统(传奇)、混沌

### 凋零之触（Withering Touch）

- **功能**：辅助任何命中敌人的技能，命中时有概率使敌人凋零。
- **数值**：support_withering_touch_damage_+%_final = -25；support_withered_base_duration_ms = 4000；withered_on_hit_chance_%_for_every_100%_target_ailment_threshold_dealt_as_chaos_damage = 175
- 家族：凋零之触｜标签：混沌、持续


## 火焰（17 条）
>
> 点燃、燃烧与火焰穿透/易伤

### 炽焰暴击（Blazing Critical）

- **功能**：辅助你自己命中敌人的技能。用辅助技能暴击时，短时间内你的全部攻击附带火焰伤害。
- **数值**：support_blazing_crits_gain_%_fire_damage_with_attacks_on_critical_hit = 15；support_blazing_crits_base_duration_ms = 5000
- 家族：炽焰暴击｜标签：攻击、火焰、持续

### 永恒之焰Ⅰ（Eternal Flame I）

- **功能**：辅助任何命中敌人的技能，其点燃更少触发但持续更久。
- **数值**：ignite_duration_+% = 100；support_eternal_flame_chance_to_ignite_+%_final = -25
- 家族：永恒之焰Ⅰ｜标签：火焰

### 永恒之焰Ⅱ（Eternal Flame II）

- **功能**：辅助任何命中敌人的技能，其点燃持续更久。
- **数值**：ignite_duration_+% = 100
- 家族：永恒之焰Ⅱ｜标签：火焰

### 永恒之焰Ⅲ（Eternal Flame III）

- **功能**：辅助任何命中敌人的技能，暴击时刷新其点燃。
- **数值**：refresh_ignite_duration_on_critical_strike_chance_% = 20
- 家族：永恒之焰Ⅲ｜标签：火焰

### 火焰调谐（Fire Attunement）

- **功能**：辅助任何造成伤害的技能，使其获得火焰伤害，但冰霜与闪电伤害降低。
- **数值**：non_skill_base_all_damage_%_to_gain_as_fire = 25；support_cold_and_lightning_damage_+%_final = -50
- 家族：火焰调谐｜标签：火焰

### 火焰易伤（Fire Exposure）

- **功能**：辅助任何命中敌人的技能，点燃时施加易伤。
- **数值**：inflict_exposure_for_x_ms_on_ignite = 8000
- 家族：火焰易伤｜标签：火焰、持续

### 火焰穿透Ⅰ（Fire Penetration I）

- **功能**：辅助任何命中敌人的技能，使这些命中穿透敌人的火焰抗性。
- **数值**：base_reduce_enemy_fire_resistance_% = 30
- 家族：火焰穿透Ⅰ｜标签：火焰

### 火焰穿透Ⅱ（Fire Penetration II）

- **功能**：辅助任何命中敌人的技能，使这些命中无视敌人的火焰抗性。
- **数值**：—
- 家族：火焰穿透Ⅱ｜标签：火焰

### 点燃Ⅰ（Ignite I）

- **功能**：辅助任何命中敌人的技能，更容易点燃。
- **数值**：support_ignition_chance_to_ignite_+%_final = 100
- 家族：点燃Ⅰ｜标签：火焰

### 点燃Ⅱ（Ignite II）

- **功能**：辅助任何命中敌人的技能，更容易点燃。
- **数值**：support_ignition_chance_to_ignite_+%_final = 150
- 家族：点燃Ⅱ｜标签：火焰

### 点燃Ⅲ（Ignite III）

- **功能**：辅助任何命中敌人的技能，更容易点燃，且施加的点燃伤害结算更快。
- **数值**：support_ignition_chance_to_ignite_+%_final = 200；faster_burn_% = 15
- 家族：点燃Ⅲ｜标签：火焰

### 火焰专精（Fire Mastery）

- **功能**：辅助火焰技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_fire_skill_gem_level_+ = 1
- 家族：专精系｜标签：火焰

### 涤荡之焰（Scouring Flame）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：涤荡之焰｜标签：火焰

### 灼烧之焰Ⅰ（Searing Flame I）

- **功能**：辅助任何命中敌人的技能，施加的点燃伤害更高但命中伤害降低。
- **数值**：support_stronger_ignites_hit_damage_+%_final = -25；support_stronger_ignites_ignite_effect_+%_final = 75
- 家族：灼烧之焰Ⅰ｜标签：火焰

### 灼烧之焰Ⅱ（Searing Flame II）

- **功能**：辅助任何命中敌人的技能，施加的点燃伤害更高但命中伤害降低。
- **数值**：support_stronger_ignites_hit_damage_+%_final = -30；support_stronger_ignites_ignite_effect_+%_final = 100
- 家族：灼烧之焰Ⅱ｜标签：火焰

### 风暴之火（Stormfire）

- **功能**：辅助任何命中敌人的技能。被辅助技能感电的敌人，其点燃伤害的一部分同时以闪电伤害结算。
- **数值**：support_stormfire_targets_shocked_by_this_take_%_of_damage_from_ignite_as_lightning_damage = 20
- 家族：风暴之火｜标签：闪电、火焰

### 野火（Wildfire）

- **功能**：辅助任何命中敌人的技能，使其施加的点燃延迟后传播给附近敌人。
- **数值**：support_ignite_proliferation_radius = 15
- 家族：野火｜标签：范围、火焰


## 冰霜（10 条）
>
> 冰冻、冰缓与冰霜穿透/易伤

### 裂隙之主的裂口（Breachlord's Rift）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：裂隙之主的裂口｜标签：血统(传奇)、闪电、冰霜

### 冰霜调谐（Cold Attunement）

- **功能**：辅助任何造成伤害的技能，使其获得冰霜伤害，但火焰与闪电伤害降低。
- **数值**：non_skill_base_all_damage_%_to_gain_as_cold = 25；support_fire_and_lightning_damage_+%_final = -50
- 家族：冰霜调谐｜标签：冰霜

### 冰霜易伤（Cold Exposure）

- **功能**：辅助任何命中敌人的技能，施加冰冻时施加易伤。
- **数值**：inflict_exposure_for_x_ms_on_cold_crit = 8000
- 家族：冰霜易伤｜标签：冰霜、持续

### 冰霜穿透（Cold Penetration）

- **功能**：辅助任何命中敌人的技能，使这些命中穿透敌人的冰霜抗性。
- **数值**：base_reduce_enemy_cold_resistance_% = 30
- 家族：冰霜穿透｜标签：冰霜

### 深度冰冻（Deep Freeze）

- **功能**：辅助任何命中敌人的技能，使其施加的冰冻持续更久。
- **数值**：freeze_duration_+% = 50
- 家族：深度冰冻｜标签：冰霜

### 怨愤（Embitter）

- **功能**：辅助可用命中伤害敌人的技能，使辅助技能获得的各类「伤害获得」全部改为获得额外冰霜伤害。
- **数值**：—
- 家族：怨愤｜标签：冰霜

### 冰冻（Freeze）

- **功能**：辅助任何命中敌人的技能，使其更有效地冰冻敌人。
- **数值**：support_hypothermia_hit_damage_freeze_multiplier_+%_final = 50
- 家族：冰冻｜标签：冰霜

### 霜寒枢纽（Frost Nexus）

- **功能**：辅助任何命中敌人的技能，使其在冰冻敌人周围生成寒冰地面。
- **数值**：chilling_ice_freezing_area_base_radius = 30；chilling_ice_create_chilled_ground_on_freeze_base_duration_ms = 8000
- 家族：霜寒枢纽｜标签：范围、冰霜

### 冰霜专精（Cold Mastery）

- **功能**：辅助冰霜技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_cold_skill_gem_level_+ = 1
- 家族：专精系｜标签：冰霜

### 冰壳（Verglas）

- **功能**：辅助你自己可命中敌人的技能。摧毁冰晶时，辅助技能获得其伤害一定百分比的额外冰霜伤害。
- **数值**：support_crystalshatter_buff_damage_%_gained_as_extra_cold_per_2000_crystal_life = 1；support_crystalshatter_buff_duration = 6000
- 家族：冰壳｜标签：冰霜


## 闪电与风暴（19 条）
>
> 感电、闪电穿透与易伤

### 推进风暴（Advancing Storm）

- **功能**：辅助风暴技能，使其出现在使用者位置并朝目标位置移动。
- **数值**：support_storm_base_movement_speed = 25
- 家族：推进风暴｜标签：风暴

### 摩根娜的风暴（Morgana's Tempest）

- **功能**：辅助风暴技能，提高其上限并使其快速从使用者移向目标位置，但效果减弱。不能辅助触发技能。
- **数值**：support_storm_base_movement_speed = 25；support_approaching_storms_movement_speed_+%_final = 60；support_approaching_storms_area_of_effect_+%_final = -25；support_approaching_storms_damage_+%_final = -35；support_storm_skill_limit_+ = 1
- 家族：推进风暴·过剩系｜标签：血统(传奇)、风暴

### 噼啪屏障（Crackling Barrier）

- **功能**：辅助引导技能。引导期间，基于你最大魔力获得闪电荆棘。
- **数值**：return_%_of_maximum_mana_as_lightning_damage_to_attacker_while_channelling = 15
- 家族：噼啪屏障｜标签：闪电、引导

### 电殛（Electrocute）

- **功能**：辅助任何能造成伤害的技能。辅助技能的闪电伤害可以电殛敌人，但其自身不能施加感电。
- **数值**：—
- 家族：电殛｜标签：闪电

### 神经过载（Neural Overload）

- **功能**：辅助任何命中敌人的技能。敌人即将被电殛时被标记，用辅助技能命中被标记敌人即对其电殛。
- **数值**：—
- 家族：电殛｜标签：闪电

### 神经激发（Innervate）

- **功能**：辅助你自己使用的伤害技能。用辅助技能击杀感电敌人时，短时间内你的伤害附带闪电伤害。
- **数值**：support_innervate_buff_grant_%_added_lightning_attack_damage = 25；support_innervate_buff_base_duration_ms = 5000
- 家族：神经激发｜标签：闪电、持续

### 持久感电（Lasting Shock）

- **功能**：辅助任何命中敌人或施加感电的技能，使其感电更少触发但持续更久。
- **数值**：shock_duration_+% = 100；support_lasting_shock_chance_to_shock_+%_final = -30
- 家族：持久感电｜标签：闪电

### 闪电调谐（Lightning Attunement）

- **功能**：辅助任何造成伤害的技能，使其获得闪电伤害，但冰霜与火焰伤害降低。
- **数值**：non_skill_base_all_damage_%_to_gain_as_lightning = 25；support_cold_and_fire_damage_+%_final = -50
- 家族：闪电调谐｜标签：闪电

### 闪电易伤（Lightning Exposure）

- **功能**：辅助任何命中敌人的技能，施加感电时施加易伤。
- **数值**：inflict_exposure_for_x_ms_on_shock = 8000
- 家族：闪电易伤｜标签：闪电、持续

### 闪电穿透（Lightning Penetration）

- **功能**：辅助任何命中敌人的技能，使这些命中穿透敌人的闪电抗性。
- **数值**：base_reduce_enemy_lightning_resistance_% = 30
- 家族：闪电穿透｜标签：闪电

### 艾许的精通（Esh's Prowess）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：专精系｜标签：血统(传奇)、闪电

### 闪电专精（Lightning Mastery）

- **功能**：辅助闪电技能，使其等级+1。不辅助没有等级的技能。
- **数值**：supported_lightning_skill_gem_level_+ = 1
- 家族：专精系｜标签：闪电

### 过载（Overcharge）

- **功能**：辅助任何命中敌人的技能，感电更有效但也会反弹回你身上。
- **数值**：shock_effect_+% = 50
- 家族：过载｜标签：闪电

### 感电（Shock）

- **功能**：辅助任何命中敌人的技能，更容易感电。
- **数值**：support_conduction_chance_to_shock_+%_final = 100
- 家族：感电｜标签：闪电

### 感电传导（Shock Conduction）

- **功能**：辅助任何命中敌人的技能，你感电敌人时有概率同时感电附近敌人。
- **数值**：support_%_chance_to_shock_nearby_enemy_on_shock = 50；shock_nearby_enemy_base_area_of_effect_radius = 25
- 家族：感电传导｜标签：范围、闪电

### 感电传导Ⅱ（Shock Conduction II）

- **功能**：辅助任何命中敌人的技能，你感电敌人时有概率同时感电附近敌人；对浸湿的敌人必定感电。
- **数值**：support_%_chance_to_shock_nearby_enemy_on_shock = 50；shock_nearby_enemy_base_area_of_effect_radius = 25
- 家族：感电传导｜标签：范围、闪电

### 感电虹吸（Shock Siphon）

- **功能**：辅助任何命中敌人的技能，击杀感电敌人时回复能量护盾。
- **数值**：support_recover_%_maximum_energy_shield_killing_shocked_enemies = 4
- 家族：感电虹吸｜标签：闪电

### 杀戮快感（Thrill of the Kill）

- **功能**：辅助你自己命中敌人的技能。用辅助技能斩杀感电敌人时，短时间内你的全部攻击附带闪电伤害。
- **数值**：support_thrill_of_the_kill_buff_grant_%_added_lightning_attack_damage = 25；support_thrill_of_the_kill_buff_base_duration_ms = 8000
- 家族：杀戮快感｜标签：攻击、闪电、持续

### 杀戮快感Ⅱ（Thrill of the Kill II）

- **功能**：辅助你自己命中敌人的技能。用辅助技能斩杀感电敌人时，短时间内你的全部攻击附带闪电伤害并提高感电概率。
- **数值**：support_thrill_of_the_kill_buff_grant_%_added_lightning_attack_damage = 25；support_thrill_of_the_kill_buff_base_duration_ms = 8000；support_thrill_of_the_kill_buff_shock_chance_+% = 40
- 家族：杀戮快感｜标签：攻击、闪电、持续


## 范围与持续（23 条）
>
> 范围扩大/缩小、持续时间增减

### 仲裁者的及远（Arbiter's Reach）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：仲裁者的及远｜标签：血统(传奇)、增益、常驻、持续

### 压缩持续Ⅰ（Compressed Duration I）

- **功能**：辅助任何有持续时间的技能，缩短其持续时间。
- **数值**：support_reduced_duration_skill_effect_duration_+%_final = -30；support_reduced_duration_damage_+%_final = 0
- 家族：压缩持续Ⅰ｜标签：持续

### 压缩持续Ⅱ（Compressed Duration II）

- **功能**：辅助任何有持续时间的技能，缩短其持续时间。
- **数值**：support_reduced_duration_skill_effect_duration_+%_final = -35；support_reduced_duration_damage_+%_final = 0
- 家族：压缩持续Ⅱ｜标签：持续

### 集中区域（Concentrated Area）

- **功能**：辅助任何有范围的技能：范围缩小，但其范围伤害更高。
- **数值**：support_concentrated_effect_skill_area_of_effect_+%_final = -50；support_area_concentrate_area_damage_+%_final = 30
- 家族：集中区域｜标签：范围

### 受控险域（Controlled Hazard）

- **功能**：辅助生成险域的技能，使险域生成后的 3 秒内无法被触发。
- **数值**：hazards_cant_trigger_x_seconds_after_creation = 3
- 家族：延迟反应｜标签：险域

### 延迟反应（Delayed Reaction）

- **功能**：辅助生成险域的技能，使险域只能在刚生成时或持续时间结束时触发。生成的险域持续时间大幅缩短，伤害更高。
- **数值**：support_sunblast_hazard_hazard_damage_+%_final = 15；support_sunblast_hazard_hazard_duration_+%_final = -70
- 家族：延迟反应｜标签：险域

### 侵进之地（Encroaching Ground）

- **功能**：辅助生成地面的技能，使地面随时间生长，直至上限。
- **数值**：support_ground_effect_area_of_effect_+%_final_per_second = 20；support_ground_effect_area_of_effect_+%_final_per_second_max = 100
- 家族：侵进之地｜标签：范围

### 广域（Expanse）

- **功能**：辅助你自己使用的任何技能：范围显著扩大，但获得长冷却。不能辅助已有冷却的技能。
- **数值**：support_hourglass_display_cooldown_time_ms = 8000；范围 50%
- 家族：广域｜标签：范围

### 圣洁降临（Holy Descent）

- **功能**：辅助腾空的技能，落地时生成圣洁地面。
- **数值**：support_holy_descent_consecrated_ground_base_duration_ms = 4000；support_holy_descent_consecrated_ground_on_landing_radius = 22
- 家族：圣洁降临｜标签：范围、持续

### 放大区域Ⅰ（Magnified Area I）

- **功能**：辅助任何有范围的技能，使其范围更大。
- **数值**：范围 35%；support_increased_area_damage_+%_final = 0
- 家族：放大区域Ⅰ｜标签：范围

### 放大区域Ⅱ（Magnified Area II）

- **功能**：辅助任何有范围的技能，使其范围更大。
- **数值**：范围 45%；support_increased_area_damage_+%_final = 0
- 家族：放大区域Ⅱ｜标签：范围

### 贪远（Overreach）

- **功能**：辅助自己使用的、在范围内造成伤害的攻击技能。辅助技能的范围显著扩大，但对近处目标的命中精度下降。
- **数值**：范围 40%；support_reach_accuracy_within_2m_+%_final = -80
- 家族：贪远｜标签：攻击、范围

### 沃拉娜的围城（Vorana's Siege）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：扩大范围·集中区域系｜标签：血统(传奇)、范围

### 延长持续Ⅰ（Prolonged Duration I）

- **功能**：辅助任何有持续时间的技能，延长其持续时间。
- **数值**：support_more_duration_skill_effect_duration_+%_final = 30
- 家族：延长持续Ⅰ｜标签：持续

### 延长持续Ⅱ（Prolonged Duration II）

- **功能**：辅助任何有持续时间的技能，延长其持续时间。
- **数值**：support_more_duration_skill_effect_duration_+%_final = 35
- 家族：延长持续Ⅱ｜标签：持续

### 重整武装Ⅰ（Rearm I）

- **功能**：辅助生成险域的技能。辅助技能生成的险域触发后有概率在短暂延迟后重新待命。
- **数值**：hazard_rearm_%_chance = 20
- 家族：重整武装Ⅰ｜标签：险域

### 重整武装Ⅱ（Rearm II）

- **功能**：辅助生成险域的技能。辅助技能生成的险域触发后有概率在短暂延迟后重新待命。
- **数值**：hazard_rearm_%_chance = 30
- 家族：重整武装Ⅱ｜标签：险域

### 感电跃击（Shocking Leap）

- **功能**：辅助腾空并造成伤害的技能，其首次暴击敌人时生成感电地面。
- **数值**：support_shocking_leap_shocked_ground_duration_ms = 4000；support_shocking_leap_shocked_ground_radius = 20
- 家族：感电跃击｜标签：范围、持续

### 法术叠瀑（Spell Cascade）

- **功能**：辅助可叠瀑法术，使其沿随机选择的轴向目标区域两侧叠瀑。
- **数值**：support_spell_cascade_number_of_cascades_per_side = 1；support_spell_cascade_area_of_effect_+%_for_cascade = -20；support_spell_cascade_area_of_effect_+%_final = -20；support_spell_cascade_damage_+%_final = -30
- 家族：法术叠瀑｜标签：范围

### 迅疾苦痛Ⅰ（Swift Affliction I）

- **功能**：辅助任何造成伤害的技能，非异常持续伤害更高但持续时间缩短。
- **数值**：support_rapid_decay_damage_over_time_+%_final = 30；support_swift_affliction_skill_effect_and_damaging_ailment_duration_+%_final = -20
- 家族：迅疾苦痛Ⅰ｜标签：持续

### 迅疾苦痛Ⅱ（Swift Affliction II）

- **功能**：辅助任何造成伤害的技能，非异常持续伤害更高但持续时间缩短。
- **数值**：support_rapid_decay_damage_over_time_+%_final = 30；support_swift_affliction_skill_effect_and_damaging_ailment_duration_+%_final = -10
- 家族：迅疾苦痛Ⅱ｜标签：持续

### 迅疾苦痛Ⅲ（Swift Affliction III）

- **功能**：辅助任何造成伤害的技能，使持续时间一秒以内的效果造成更高的非异常持续伤害。
- **数值**：support_swift_affliction_skill_effect_and_damaging_ailment_duration_+%_final = -30；support_swift_affliction_non_ailment_damage_over_time_+%_final_if_duration_below_1_second = 50
- 家族：迅疾苦痛Ⅲ｜标签：持续

### 乌特雷德的仪式（Uhtred's Rite）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：乌特雷德的仪式｜标签：血统(传奇)、持续


## 资源与续航（31 条）
>
> 魔力/生命回复、偷取、充能与冷却

### 食尸Ⅰ（Cannibalism I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你击杀时回复生命。
- **数值**：support_cannibalism_recover_%_maximum_life_on_kill = 2
- 家族：食尸Ⅰ｜标签：增益、常驻

### 食尸Ⅱ（Cannibalism II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你击杀时回复生命。
- **数值**：support_cannibalism_recover_%_maximum_life_on_kill = 3
- 家族：食尸Ⅱ｜标签：增益、常驻

### 清晰Ⅰ（Clarity I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得更高的魔力回复。
- **数值**：support_clarity_mana_regeneration_rate_+% = 30
- 家族：清晰Ⅰ｜标签：增益、常驻

### 清晰Ⅱ（Clarity II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得更高的魔力回复。
- **数值**：support_clarity_mana_regeneration_rate_+% = 50
- 家族：清晰Ⅱ｜标签：增益、常驻

### 冷静（Cool Headed）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你被施加的点燃持续时间缩短。
- **数值**：support_ignite_protection_spirit_cost_ignite_duration_on_self_+%_final = -50
- 家族：冷静｜标签：增益、常驻

### 无畏（Dauntless）

- **功能**：辅助你自己使用、可造成伤害命中的技能。辅助技能需保持原地站立一定时间后才能使用，站立越久伤害越高。不能辅助有冷却或其他使用条件的技能。
- **数值**：support_unmoving_damage_+%_final_per_250_ms_stationary = 3；support_unmoving_damage_multiplier_cap = 45
- 家族：无畏｜标签：条件

### 凄厉打击Ⅰ（Direstrike I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你低血状态下的攻击伤害提高。
- **数值**：support_attack_damage_spirit_cost_attack_damage_+%_on_low_life = 50
- 家族：凄厉打击Ⅰ｜标签：增益、常驻

### 凄厉打击Ⅱ（Direstrike II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你低血状态下的攻击伤害提高。
- **数值**：support_attack_damage_spirit_cost_attack_damage_+%_on_low_life = 70
- 家族：凄厉打击Ⅱ｜标签：增益、常驻

### 加鲁坎的决心（Garukhan's Resolve）

- **功能**：辅助自己使用的、没有其他使用条件的攻击技能。辅助技能的暴击率有上限，但会分叉暴击率。
- **数值**：maximum_critical_strike_chance_is_%_from_support_garukhans_resolve = 50
- 家族：加鲁坎的决心｜标签：血统(传奇)、攻击、条件

### 治疗符文（Healing Runes）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：治疗符文｜标签：增益、常驻

### 赫尔布林之皮（Helbrym's Hide）

- **功能**：辅助变形技能：变形时短暂给予赫尔布林的镇定。增益到期前变形为其他形态会使其无效移除。
- **数值**：support_hide_of_helbrym_soak_duration_ms = 2000；support_hide_of_helbrym_guard_duration_ms = 4000；support_hide_of_helbrym_gain_guard_from_%_of_damage_taken = 50；support_hide_of_helbrym_gain_rage_from_%_of_damage_taken = 3
- 家族：赫尔布林之皮｜标签：血统(传奇)、变形、增益

### 她的宣言（Her Declaration）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：她的宣言｜标签：血统(传奇)、增益、常驻

### 草药采集Ⅰ（Herbalism I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，药瓶提供的生命回复提高。
- **数值**：support_herbalism_life_recovery_+%_from_life_flasks = 30
- 家族：草药采集Ⅰ｜标签：增益、常驻

### 草药采集Ⅱ（Herbalism II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，药瓶提供的生命回复提高。
- **数值**：support_herbalism_life_recovery_+%_from_life_flasks = 50
- 家族：草药采集Ⅱ｜标签：增益、常驻

### 游击（Hit and Run）

- **功能**：辅助自己使用的、没有其他使用条件的攻击技能。辅助技能只有在你移动一定距离后才能使用，但技能速度大幅提高。不能辅助有冷却的技能。
- **数值**：support_mobile_assault_skill_speed_+%_final = 40
- 家族：游击｜标签：攻击、条件

### 神秘学Ⅰ（Mysticism I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你满能量护盾时的法术伤害提高。
- **数值**：support_spell_damage_spirit_cost_spell_damage_+%_on_full_energy_shield = 30
- 家族：神秘学Ⅰ｜标签：增益、常驻

### 神秘学Ⅱ（Mysticism II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你满能量护盾时的法术伤害提高。
- **数值**：support_spell_damage_spirit_cost_spell_damage_+%_on_full_energy_shield = 40
- 家族：神秘学Ⅱ｜标签：增益、常驻

### 精准Ⅰ（Precision I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得更高的精度。
- **数值**：support_precision_accuracy_rating_+% = 30
- 家族：精准Ⅰ｜标签：增益、常驻

### 精准Ⅱ（Precision II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得更高的精度。
- **数值**：support_precision_accuracy_rating_+% = 50
- 家族：精准Ⅱ｜标签：增益、常驻

### 折射Ⅰ（Refraction I）

- **功能**：辅助旗帜技能，使其光环影响的人获得折射镀层——一种提供偏转值、并让护甲部分应用于元素命中伤害的增益。
- **数值**：support_tempered_valour_%_armour_to_apply_to_elemental_damage = 20；support_tempered_valour_deflection_rating_%_of_evasion_rating = 15
- 家族：折射Ⅰ｜标签：增益、常驻

### 折射Ⅱ（Refraction II）

- **功能**：辅助旗帜技能，使其光环影响的人获得折射镀层——一种提供偏转值、并让护甲部分应用于元素命中伤害的增益。
- **数值**：support_tempered_valour_%_armour_to_apply_to_elemental_damage = 30；support_tempered_valour_deflection_rating_%_of_evasion_rating = 20
- 家族：折射Ⅱ｜标签：增益、常驻

### 折射Ⅲ（Refraction III）

- **功能**：辅助旗帜技能，使其范围内敌人获得折射溶解——一种降低元素抗性的减益。
- **数值**：support_tempered_valour_banner_applies_%_elemental_exposure_per_1000_armour = 2
- 家族：折射Ⅲ｜标签：增益、常驻

### 炽天使之心（Seraph's Heart）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：炽天使之心｜标签：血统(传奇)、增益、常驻

### 强心（Strong Hearted）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你被施加的感电持续时间缩短。
- **数值**：support_shock_protection_spirit_cost_shock_duration_on_self_+%_final = -50
- 家族：强心｜标签：增益、常驻

### 荆棘之肤Ⅰ（Thornskin I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你的荆棘伤害提高。
- **数值**：support_thorns_spirit_cost_thorns_damage_+% = 40
- 家族：荆棘之肤Ⅰ｜标签：增益、常驻

### 荆棘之肤Ⅱ（Thornskin II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你的荆棘伤害提高。
- **数值**：support_thorns_spirit_cost_thorns_damage_+% = 70
- 家族：荆棘之肤Ⅱ｜标签：增益、常驻

### 涌升Ⅰ（Upwelling I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你不处于满魔力时随从伤害提高。
- **数值**：support_minion_damage_spirit_cost_minion_damage_+%_while_missing_mana = 30
- 家族：涌升Ⅰ｜标签：增益、常驻

### 涌升Ⅱ（Upwelling II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你不处于满魔力时随从伤害提高。
- **数值**：support_minion_damage_spirit_cost_minion_damage_+%_while_missing_mana = 50
- 家族：涌升Ⅱ｜标签：增益、常驻

### 活力Ⅰ（Vitality I）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得生命回复。
- **数值**：support_vitality_life_regeneration_rate_per_minute_% = 60
- 家族：活力Ⅰ｜标签：增益、常驻

### 活力Ⅱ（Vitality II）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你获得生命回复。
- **数值**：support_vitality_life_regeneration_rate_per_minute_% = 120
- 家族：活力Ⅱ｜标签：增益、常驻

### 温血（Warm Blooded）

- **功能**：辅助常驻增益技能：辅助技能激活期间，你被施加的冰冻持续时间缩短。
- **数值**：support_freeze_protection_spirit_cost_freeze_duration_on_self_+%_final = -50
- 家族：温血｜标签：增益、常驻


## 通用与其他（159 条）
>
> 无法归入上述类别的家族

### 刻毒（Acrimony）

- **功能**：辅助可伤害敌人的技能。受到辅助技能造成的非异常类持续伤害的敌人，生命回复降低。该减益只取最强一层生效。不辅助随从使用的技能。
- **数值**：skill_enemies_affected_by_non_ailment_damage_over_time_life_regeneration_rate_+% = -50
- 家族：刻毒｜标签：—

### 艾莉丝的风铃（Ailith's Chimes）

- **功能**：辅助可消耗连段的技能。辅助技能消耗连段时，按消耗量有概率获得暴击球。
- **数值**：chance_%_to_gain_power_charges_per_combo_spent = 25
- 家族：艾莉丝的风铃｜标签：血统(传奇)

### 琼浆（Ambrosia）

- **功能**：辅助你自己用命中伤害敌人的技能。辅助技能消耗你最大魔力药瓶的一部分充能，每消耗一份按百分比获得额外闪电伤害。
- **数值**：consume_%_of_maximum_mana_flask_charges_on_skill_use = 14；gain_%_damage_as_lighting_per_mana_flask_charge_consumed = 2
- 家族：琼浆｜标签：—

### 琼浆Ⅱ（Ambrosia II）

- **功能**：辅助你自己用命中伤害敌人的技能。辅助技能消耗你最大魔力药瓶的一部分充能，每消耗一份按百分比获得额外闪电伤害。
- **数值**：consume_%_of_maximum_mana_flask_charges_on_skill_use = 35；gain_%_damage_as_lighting_per_mana_flask_charge_consumed = 1
- 家族：琼浆｜标签：—

### 埋伏（Ambush）

- **功能**：辅助任何命中敌人的技能，更容易暴击满血的敌人。
- **数值**：support_ambush_critical_strike_chance_vs_enemies_on_full_life_+%_final = 100
- 家族：埋伏｜标签：—

### 阿拉卡利的欲望（Arakaali's Lust）

- **功能**：辅助任何命中敌人的技能，目标身上中毒层数越多，伤害越高。
- **数值**：support_debilitate_hit_damage_+%_final_per_poison_stack = 8；support_debilitate_hit_damage_max_poison_stacks = 40
- 家族：阿拉卡利的欲望｜标签：血统(传奇)

### 甲胄粉碎Ⅰ（Armour Demolisher I）

- **功能**：辅助任何技能，使其施加的破甲更强。
- **数值**：support_increased_armour_break_armour_break_amount_+%_final = 50
- 家族：甲胄粉碎Ⅰ｜标签：—

### 甲胄粉碎Ⅱ（Armour Demolisher II）

- **功能**：辅助任何技能，使其施加的破甲更强。
- **数值**：support_increased_armour_break_armour_break_amount_+%_final = 70
- 家族：甲胄粉碎Ⅱ｜标签：—

### 一臂之距（Arms Length）

- **功能**：辅助命中敌人的技能，使这些命中产生的击退显著增强。
- **数值**：support_arms_length_knockback_distance_+%_final = 40
- 家族：一臂之距｜标签：—

### 星界投影（Astral Projection）

- **功能**：辅助新星技能，使其使用时在目标位置而非围绕你施放。
- **数值**：support_astral_projection_aoe_+%_final = -25
- 家族：星界投影｜标签：—

### 阿兹里的共融（Atziri's Communion）

- **功能**：辅助常驻技能，使其保留生命而非魂力。不能辅助会创建随从的技能。
- **数值**：—
- 家族：阿兹里的共融｜标签：血统(传奇)、常驻

### 致盲Ⅰ（Blind I）

- **功能**：辅助任何命中敌人的技能，命中时致盲。
- **数值**：命中致盲概率 100%
- 家族：致盲Ⅰ｜标签：—

### 致盲Ⅱ（Blind II）

- **功能**：辅助任何命中敌人的技能，命中时致盲且效果提高。
- **数值**：命中致盲概率 100%；blind_effect_+% = 20
- 家族：致盲Ⅱ｜标签：—

### 掩袭（Blindside）

- **功能**：辅助可造成伤害命中的技能。辅助技能更容易暴击被致盲的敌人，且对被致盲敌人暴击伤害更高，但其自身不能施加致盲。
- **数值**：support_unseen_critical_damage_multiplier_+%_final_vs_blinded_enemies = 15；support_unseen_critical_strike_chance_+%_final_vs_blinded_enemies = 15
- 家族：掩袭｜标签：—

### 无穷能量Ⅰ（Boundless Energy I）

- **功能**：辅助元技能。辅助技能能量生成显著加快。
- **数值**：energy_generated_+% = 35
- 家族：无穷能量Ⅰ｜标签：—

### 无穷能量Ⅱ（Boundless Energy II）

- **功能**：辅助元技能。辅助技能能量生成显著加快。
- **数值**：energy_generated_+% = 45
- 家族：无穷能量Ⅱ｜标签：—

### 猎赏Ⅰ（Bounty I）

- **功能**：辅助任何命中敌人的技能，使其击杀的敌人给予更多药瓶与护符充能。
- **数值**：support_mana_flask_charges_gained_+%_final_from_killing_blow = 50；support_life_flask_charges_gained_+%_final_from_killing_blow = 50；support_charm_charges_gained_+%_final_from_killing_blow = 50
- 家族：猎赏Ⅰ｜标签：—

### 猎赏Ⅱ（Bounty II）

- **功能**：辅助任何命中敌人的技能，使其击杀的敌人给予更多药瓶与护符充能。
- **数值**：support_mana_flask_charges_gained_+%_final_from_killing_blow = 100；support_life_flask_charges_gained_+%_final_from_killing_blow = 100；support_charm_charges_gained_+%_final_from_killing_blow = 100
- 家族：猎赏Ⅱ｜标签：—

### 护符猎赏（Charm Bounty）

- **功能**：辅助任何命中敌人的技能，使其击杀的敌人给予更多护符充能。
- **数值**：support_charm_charges_gained_+%_final_from_killing_blow = 100
- 家族：护符猎赏｜标签：—

### 生命猎赏（Life Bounty）

- **功能**：辅助任何命中敌人的技能，使其击杀的敌人给予更多生命药瓶充能。
- **数值**：support_life_flask_charges_gained_+%_final_from_killing_blow = 100
- 家族：生命猎赏｜标签：—

### 魔力猎赏（Mana Bounty）

- **功能**：辅助任何命中敌人的技能，使其击杀的敌人给予更多魔力药瓶充能。
- **数值**：support_mana_flask_charges_gained_+%_final_from_killing_blow = 100
- 家族：魔力猎赏｜标签：—

### 绽发Ⅰ（Burgeon I）

- **功能**：辅助你自己使用的引导技能，引导时间越长伤害越高。
- **数值**：support_chanelling_damage_+%_final_per_second_channelling = 10；support_channelling_damage_cap = 40
- 家族：绽发Ⅰ｜标签：引导

### 绽发Ⅱ（Burgeon II）

- **功能**：辅助你自己使用的引导技能，引导时间越长伤害越高。
- **数值**：support_chanelling_damage_+%_final_per_second_channelling = 20；support_channelling_damage_cap = 40
- 家族：绽发Ⅱ｜标签：引导

### 节奏（Cadence）

- **功能**：辅助你自己使用的攻击。辅助技能每次使用都获得更多攻击速度，但短时间频繁使用会暂时无法使用。持续型技能则在使用期间周期性获得攻击速度。
- **数值**：support_measured_speed_attack_speed_+%_final_per_stack = 8；support_measured_speed_maximum_stacks = 6；support_measured_speed_disabled_ms = 10000
- 家族：节奏｜标签：攻击

### 充能丰盈Ⅰ（Charge Profusion I）

- **功能**：辅助能生成充能球的技能，生成时有概率额外生成一个。
- **数值**：chance_to_gain_1_more_charge_% = 30
- 家族：充能丰盈Ⅰ｜标签：—

### 充能丰盈Ⅱ（Charge Profusion II）

- **功能**：辅助能生成充能球的技能，生成时有概率额外生成一个，并有概率额外生成一个随机类型的充能球。
- **数值**：chance_to_gain_1_more_charge_% = 30；chance_to_gain_1_more_random_charge_% = 15
- 家族：充能丰盈Ⅱ｜标签：—

### 近身格斗Ⅰ（Close Combat I）

- **功能**：辅助攻击技能，根据敌人与你的距离造成更高伤害。
- **数值**：support_close_combat_attack_damage_+%_final_from_distance = 20
- 家族：近身格斗Ⅰ｜标签：攻击

### 近身格斗Ⅱ（Close Combat II）

- **功能**：辅助攻击技能，根据敌人与你的距离造成更高伤害。
- **数值**：support_close_combat_attack_damage_+%_final_from_distance = 30
- 家族：近身格斗Ⅱ｜标签：攻击

### 同悲（Commiserate）

- **功能**：辅助你自己使用或触发、可造成伤害命中的技能。施加异常时若你自己也正受该异常影响，则施加的异常更强，同时移除你身上的该异常。
- **数值**：support_ailment_effect_+%_final_while_afflicted_by_relevant_ailment = 40
- 家族：同悲｜标签：—

### 调制Ⅰ（Concoct I）

- **功能**：辅助你自己用命中伤害敌人的技能。辅助技能消耗你最大生命药瓶的一部分充能，按消耗量施加更强的流血。
- **数值**：consume_%_of_maximum_life_flask_charges_on_skill_use = 20；support_concoct_bleed_effect_+%_final_per_life_flask_charge_consumed = 3
- 家族：调制Ⅰ｜标签：—

### 调制Ⅱ（Concoct II）

- **功能**：辅助你自己用命中伤害敌人的技能。辅助技能消耗你最大生命药瓶的一部分充能，按消耗量施加更强的流血。
- **数值**：consume_%_of_maximum_life_flask_charges_on_skill_use = 30；support_concoct_bleed_effect_+%_final_per_life_flask_charge_consumed = 3
- 家族：调制Ⅱ｜标签：—

### 阿兹里的急切（Atziri's Impatience）

- **功能**：辅助你自己使用的有冷却技能：冷却回复速度大幅提高，但使用时损失生命、魔力与能量护盾。不能辅助元技能或常驻技能，不改变随从的技能。
- **数值**：support_cooldown_reduction_cooldown_recovery_+% = 100；lose_%_of_life_es_and_mana_when_skill_is_used = 25
- 家族：阿兹里的急切｜标签：血统(传奇)

### 冷却回复Ⅰ（Cooldown Recovery I）

- **功能**：辅助有冷却的技能，提高其冷却回复速度。不改变随从的技能。
- **数值**：support_cooldown_reduction_cooldown_recovery_+% = 25
- 家族：冷却回复Ⅰ｜标签：—

### 冷却回复Ⅱ（Cooldown Recovery II）

- **功能**：辅助有冷却的技能，提高其冷却回复速度。不改变随从的技能。
- **数值**：support_cooldown_reduction_cooldown_recovery_+% = 30
- 家族：冷却回复Ⅱ｜标签：—

### 尸体节约（Corpse Conservation）

- **功能**：辅助消耗尸体的技能，使其有概率生效而不摧毁尸体。
- **数值**：base_chance_to_not_consume_corpse_% = 25
- 家族：尸体节约｜标签：—

### 晶棱碎片（Crystalline Shards）

- **功能**：辅助生成冰晶的技能。辅助技能冰晶造成的伤害性爆炸会戳刺敌人。
- **数值**：ice_crystal_explosion_impale_chance_% = 100
- 家族：晶棱碎片｜标签：—

### 斩杀Ⅰ（Culling Strike I）

- **功能**：辅助攻击技能，使其命中时对稀有和传奇敌人斩杀。
- **数值**：—
- 家族：斩杀Ⅰ｜标签：攻击

### 斩杀Ⅱ（Culling Strike II）

- **功能**：辅助攻击技能，使其命中时对稀有和传奇敌人斩杀，并提高斩杀触发阈值。
- **数值**：support_culling_strike_threshold_+%_on_cull_for_seconds_from_code = 20
- 家族：斩杀Ⅱ｜标签：攻击

### 死亡之舞（Danse Macabre）

- **功能**：辅助祭献技能。辅助技能增益效果提高且伤害更高，但施放时会额外指定一个骷髅随从。若没有额外骷髅可指定，则不提供伤害与增益。
- **数值**：support_danse_macabre_offering_skill_damage_+%_final_if_consumed_additional_skeleton = 30；offering_spells_effect_+%_if_consumed_additional_skeleton = 30
- 家族：死亡之舞｜标签：—

### 违抗Ⅰ（Defy I）

- **功能**：辅助你自己使用的攻击技能。被围困时辅助技能的命中伤害变得幸运。
- **数值**：—
- 家族：违抗Ⅰ｜标签：攻击

### 违抗Ⅱ（Defy II）

- **功能**：辅助你自己使用的攻击技能。辅助技能的命中伤害变得幸运，且在被围困时魔力不足也不会阻止使用。
- **数值**：—
- 家族：违抗Ⅱ｜标签：攻击

### 延迟满足（Delayed Gratification）

- **功能**：辅助需满足条件才能使用的技能。条件满足后辅助技能可额外使用一次，但条件更难达成。
- **数值**：difficulty_of_meeting_conditional_requirement_+% = 150；conditional_skill_additional_usages_after_meeting_requirement = 1；conditional_skill_additional_usages_duration_ms = 10000
- 家族：延迟满足｜标签：—

### 深思（Deliberation）

- **功能**：辅助可在移动中使用的技能，使用期间移动变慢，换取更高伤害。
- **数值**：support_deliberation_movement_speed_penalty_+%_final_while_performing_action = 30；support_deliberation_damage_+%_final = 20
- 家族：深思｜标签：—

### 错乱（Derange）

- **功能**：辅助你自己使用的可造成伤害的技能。辅助技能获得等于你智力值的能量护盾消耗，同时按智力提高非异常类持续伤害。不能辅助引导技能。
- **数值**：support_shield_sacrifice_damage_over_time_+%_final_per_100_intelligence = 8
- 家族：错乱｜标签：—

### 迪亚拉的心愿（Dialla's Desire）

- **功能**：辅助任何有等级的技能：提高其等级与品质，同时降低消耗与保留。
- **数值**：supported_active_skill_gem_level_+ = 1；supported_active_skill_gem_quality_% = 5
- 家族：迪亚拉的心愿｜标签：血统(传奇)

### 耐久（Durability）

- **功能**：辅助创建可被击打数次后毁坏之物的技能，使其能承受更多次击打。不改变随从的技能。
- **数值**：support_number_of_additional_uses_before_expiry = 2
- 家族：耐久｜标签：—

### 效率Ⅰ（Efficiency I）

- **功能**：辅助任何技能，降低其使用消耗。不能辅助保留魂力的技能。
- **数值**：support_inspiration_cost_+%_final = -30
- 家族：效率Ⅰ｜标签：—

### 效率Ⅱ（Efficiency II）

- **功能**：辅助任何技能，降低其使用消耗。不能辅助保留魂力的技能。
- **数值**：support_inspiration_cost_+%_final = -40
- 家族：效率Ⅱ｜标签：—

### 元素武装Ⅰ（Elemental Armament I）

- **功能**：辅助攻击技能，使其元素伤害更高。
- **数值**：support_attack_skills_elemental_damage_+%_final = 20
- 家族：元素武装Ⅰ｜标签：攻击

### 元素武装Ⅱ（Elemental Armament II）

- **功能**：辅助攻击技能，使其元素伤害更高。
- **数值**：support_attack_skills_elemental_damage_+%_final = 25
- 家族：元素武装Ⅱ｜标签：攻击

### 元素武装Ⅲ（Elemental Armament III）

- **功能**：辅助攻击技能，命中敌人时敌人身上每有一种元素异常，伤害越高。辅助技能自身不能施加元素异常。
- **数值**：support_elemental_armament_attack_damage_+%_final_per_elemental_ailment_on_target = 12
- 家族：元素武装Ⅲ｜标签：攻击

### 元素集中（Elemental Focus）

- **功能**：辅助任何命中敌人的技能，元素伤害更高但其无法施加元素异常。
- **数值**：support_gem_elemental_damage_+%_final = 25
- 家族：元素集中｜标签：—

### 持久冲击Ⅰ（Enduring Impact I）

- **功能**：辅助任何命中敌人的技能，造成重度眩晕时有概率获得耐力球。
- **数值**：chance_to_gain_endurance_charge_on_heavy_stunning_non_unique_enemy_% = 30；gain_x_endurance_charges_on_heavy_stunning_unique_enemy = 1
- 家族：持久冲击Ⅰ｜标签：—

### 持久冲击Ⅱ（Enduring Impact II）

- **功能**：辅助任何命中敌人的技能，造成重度眩晕时有概率获得耐力球。
- **数值**：chance_to_gain_endurance_charge_on_heavy_stunning_non_unique_enemy_% = 30；gain_x_endurance_charges_on_heavy_stunning_unique_enemy = 3
- 家族：持久冲击Ⅱ｜标签：—

### 能量电容（Energy Capacitor）

- **功能**：辅助触发其他技能的祈唤技能。辅助技能的最大能量显著提高。
- **数值**：skill_maximum_energy_+% = 80
- 家族：能量电容｜标签：—

### 处决Ⅰ（Execute I）

- **功能**：辅助任何命中敌人的技能，对低血敌人伤害更高。
- **数值**：support_executioner_damage_vs_enemies_on_low_life_+%_final = 40
- 家族：处决Ⅰ｜标签：—

### 处决Ⅱ（Execute II）

- **功能**：辅助任何命中敌人的技能，对低血敌人伤害更高。
- **数值**：support_executioner_damage_vs_enemies_on_low_life_+%_final = 50
- 家族：处决Ⅱ｜标签：—

### 处决Ⅲ（Execute III）

- **功能**：辅助任何命中敌人的技能，对低血敌人伤害更高，且你自己低血时伤害也更高。
- **数值**：support_executioner_damage_vs_enemies_on_low_life_+%_final = 30；support_executioner_damage_+%_final_while_on_low_life = 30
- 家族：处决Ⅲ｜标签：—

### 凶暴（Ferocity）

- **功能**：辅助你自己使用的技能。辅助技能使用时若可能则消耗一个狂怒球，若消耗则获得显著技能速度，但其自身不能生成狂怒球。不能辅助会消耗狂怒球的技能。
- **数值**：skill_consume_frenzy_charge_to_gain_skill_speed_+%_final = 40
- 家族：凶暴｜标签：—

### 分叉裂隙Ⅰ（Branching Fissures I）

- **功能**：辅助在地面生成裂隙的技能，使其生成额外的次级裂隙，从主裂隙分支而出，范围与伤害降低。
- **数值**：number_of_branching_fissures = 2；branching_fissure_area_of_effect_+%_final = -35；branching_fissure_damage_+%_final = -40
- 家族：分叉裂隙Ⅰ｜标签：—

### 分叉裂隙Ⅱ（Branching Fissures II）

- **功能**：辅助在地面生成裂隙的技能，使其生成额外的次级裂隙，从主裂隙分支而出，范围与伤害降低。
- **数值**：number_of_branching_fissures = 2；branching_fissure_area_of_effect_+%_final = -35；branching_fissure_damage_+%_final = -30
- 家族：分叉裂隙Ⅱ｜标签：—

### 剧变Ⅰ（Upheaval I）

- **功能**：辅助在地面生成裂隙的技能，使其生成一道额外裂隙，代价是伤害与速度。
- **数值**：base_number_of_additional_fissures = 1；support_additional_fissures_damage_+%_final = -20；support_additional_fissures_skill_speed_+%_final = -20
- 家族：剧变Ⅰ｜标签：—

### 剧变Ⅱ（Upheaval II）

- **功能**：辅助在地面生成裂隙的技能，使其生成额外裂隙，代价是伤害与速度。
- **数值**：base_number_of_additional_fissures = 2；support_additional_fissures_damage_+%_final = -40；support_additional_fissures_skill_speed_+%_final = -20
- 家族：剧变Ⅱ｜标签：—

### 阿恩的堡垒（Ahn's Citadel）

- **功能**：辅助沿直线生成墙壁的技能：改为沿裂隙生成。
- **数值**：wall_maximum_length_+% = 65
- 家族：阿恩的堡垒｜标签：血统(传奇)

### 堡垒Ⅰ（Fortress I）

- **功能**：辅助沿直线生成墙壁的技能：改为生成环形墙，但命中伤害降低。
- **数值**：wall_maximum_length_+% = 100；support_wall_fortress_hit_damage_+%_final = -40
- 家族：堡垒Ⅰ｜标签：—

### 堡垒Ⅱ（Fortress II）

- **功能**：辅助沿直线生成墙壁的技能：改为生成环形墙，但命中伤害降低、范围缩小。
- **数值**：wall_maximum_length_+% = 100；support_wall_fortress_hit_damage_+%_final = -30；support_wall_fortress_area_of_effect_+%_final = -20
- 家族：堡垒Ⅱ｜标签：—

### 换弹如新Ⅰ（Fresh Clip I）

- **功能**：辅助弩技能，过去 6 秒内该技能每装填一支弩箭便获得更高伤害。
- **数值**：support_damage_+%_final_per_crossbow_bolt_reloaded_in_past_6_seconds = 1
- 家族：换弹如新Ⅰ｜标签：—

### 换弹如新Ⅱ（Fresh Clip II）

- **功能**：辅助弩技能，过去 8 秒内该技能每装填一支弩箭便获得更高伤害。
- **数值**：support_damage_+%_final_per_crossbow_bolt_reloaded_in_past_8_seconds = 1
- 家族：换弹如新Ⅱ｜标签：—

### 冰川（Glacier）

- **功能**：辅助任何生成冰晶的技能，使冰晶以更高生命生成。
- **数值**：support_glacier_ice_crystal_maximum_life_+%_final = 100
- 家族：冰川｜标签：—

### 饕噬（Gorge）

- **功能**：辅助消耗尸体的技能。用辅助技能消耗尸体时获得药瓶充能。
- **数值**：—
- 家族：饕噬｜标签：—

### 剔除（Excise）

- **功能**：辅助你自己使用的任何伤害技能：暴击率显著提高，但获得长冷却。不能辅助已有冷却的技能。
- **数值**：support_hourglass_display_cooldown_time_ms = 8000；support_crit_cooldown_crit_chance_+%_final = 40
- 家族：剔除｜标签：—

### 憎咒（Execrate）

- **功能**：辅助你自己使用的任何伤害技能：命中施加异常的概率显著提高，但获得长冷却。不能辅助已有冷却的技能。
- **数值**：support_hourglass_display_cooldown_time_ms = 8000；support_ailment_cooldown_ailment_chance_+%_final = 100
- 家族：憎咒｜标签：—

### 沙漏（Hourglass）

- **功能**：辅助你自己使用的任何伤害技能：伤害显著提高，但获得长冷却。不能辅助已有冷却的技能。
- **数值**：support_hourglass_damage_+%_final = 30；support_hourglass_display_cooldown_time_ms = 10000
- 家族：沙漏｜标签：—

### 谐振残息Ⅰ（Harmonic Remnants I）

- **功能**：辅助生成残息的技能，使残息可从更远处拾取。
- **数值**：remnant_pickup_range_+% = 35
- 家族：谐振残息Ⅰ｜标签：残息

### 谐振残息Ⅱ（Harmonic Remnants II）

- **功能**：辅助生成残息的技能，使残息可从更远处拾取，并有概率生成额外残息。
- **数值**：remnant_pickup_range_+% = 35；chance_%_to_create_additional_remnant = 20
- 家族：谐振残息Ⅱ｜标签：残息

### 高度精准Ⅰ（Heightened Accuracy I）

- **功能**：辅助攻击技能，使其获得精度。
- **数值**：support_additional_accurary_rating_+%_final = 50
- 家族：高度精准Ⅰ｜标签：攻击

### 高度精准Ⅱ（Heightened Accuracy II）

- **功能**：辅助攻击技能，使其获得精度，且对满血敌人永不落空。
- **数值**：support_additional_accurary_rating_+%_final = 50
- 家族：高度精准Ⅱ｜标签：攻击

### 冰锥（Icicle）

- **功能**：辅助任何生成冰晶的技能，使冰晶以更低生命生成。
- **数值**：support_icicle_ice_crystal_maximum_life_+%_final = -50
- 家族：冰锥｜标签：—

### 势不可挡暴击Ⅰ（Inexorable Critical I）

- **功能**：辅助你自己使用、命中敌人的任何技能，使其随时间累积暴击率。
- **数值**：support_inevitable_criticals_critical_strike_chance_+%_per_second = 10；support_inevitable_criticals_critical_strike_chance_+%_cap = 100
- 家族：势不可挡暴击Ⅰ｜标签：—

### 势不可挡暴击Ⅱ（Inexorable Critical II）

- **功能**：辅助你自己使用、命中敌人的任何技能，使其随时间累积暴击率，但降低你的暴击伤害加成。
- **数值**：support_inevitable_criticals_critical_strike_chance_+%_per_second = 40；support_inevitable_criticals_critical_strike_chance_+%_cap = 200；support_inevitable_criticals_critical_strike_multiplier_+%_final_per_second = -10；support_inevitable_criticals_critical_strike_multiplier_+%_final_cap = -50
- 家族：势不可挡暴击Ⅱ｜标签：—

### 卡丽莎的渐强（Kalisa's Crescendo）

- **功能**：辅助诅咒技能。被辅助诅咒的敌人在诅咒持续的最后阶段被安抚。
- **数值**：curse_pacify_for_final_%_of_duration = 30；apply_unaffected_by_pacifying_curses_for_x_ms_on_curse_expiry = 8000
- 家族：卡丽莎的渐强｜标签：血统(传奇)

### 卡塔尔的回春（Khatal's Rejuvenation）

- **功能**：辅助生成残息的技能。拾取辅助技能的残息会给予卡塔尔的回春。
- **数值**：—
- 家族：卡塔尔的回春｜标签：血统(传奇)、残息

### 击退（Knockback）

- **功能**：辅助任何命中敌人的技能，使其击退敌人。
- **数值**：generic_knockback_distance_limit = 30；support_arms_length_knockback_distance_+%_final = 40
- 家族：击退｜标签：—

### 库莱马克的统治（Kulemak's Dominion）

- **功能**：辅助祭献技能，使你的可叠瀑法术叠瀑至辅助祭献所在的位置。
- **数值**：cascadeable_offering_support_offering_casted_spell_damage_+%_final = -50
- 家族：库莱马克的统治｜标签：血统(传奇)

### 持久地面（Lasting Ground）

- **功能**：辅助生成地面的技能，使地面持续更久。
- **数值**：地面效果持续 50%
- 家族：持久地面｜标签：—

### 生命吸取（Life Drain）

- **功能**：辅助任何命中敌人的技能，斩杀敌人时回复生命。
- **数值**：recover_%_maximum_life_on_cull = 12
- 家族：生命吸取｜标签：—

### 生命汲取（Lifetap）

- **功能**：辅助任何技能，把其魔力消耗转为生命消耗。不辅助保留魂力的技能。
- **数值**：blood_magic_skill_life_cost_+%_final = 0；base_skill_cost_life_instead_of_mana_% = 100
- 家族：生命汲取｜标签：—

### 锁控（Lockdown）

- **功能**：辅助任何命中敌人的技能，其施加的钉固累积随敌人距离越近越强。
- **数值**：support_lockdown_distance_based_pin_damage_+%_final = 120
- 家族：锁控｜标签：—

### 长引信Ⅰ（Long Fuse I）

- **功能**：辅助有引爆时间的技能，使其引爆时间与爆炸伤害大幅提高。
- **数值**：support_long_fuse_detonation_damage_+%_final = 30；skill_detonation_time_+% = 50
- 家族：长引信Ⅰ｜标签：—

### 长引信Ⅱ（Long Fuse II）

- **功能**：辅助有引爆时间的技能，使其引爆时间与爆炸伤害大幅提高。
- **数值**：support_long_fuse_detonation_damage_+%_final = 35；skill_detonation_time_+% = 70
- 家族：长引信Ⅱ｜标签：—

### 远程射击Ⅰ（Longshot I）

- **功能**：辅助攻击技能，距离越远伤害越高。
- **数值**：support_far_combat_attack_damage_+%_final_from_distance = 25
- 家族：远程射击Ⅰ｜标签：攻击

### 远程射击Ⅱ（Longshot II）

- **功能**：辅助攻击技能，距离越远伤害越高。
- **数值**：support_far_combat_attack_damage_+%_final_from_distance = 35
- 家族：远程射击Ⅱ｜标签：攻击

### 磁性残息（Magnetic Remnants）

- **功能**：辅助生成残息的技能，使残息可从更远处拾取。
- **数值**：remnant_pickup_range_+% = 35
- 家族：磁性残息｜标签：—

### 致残（Maim）

- **功能**：辅助攻击技能，使其致残敌人。
- **数值**：maim_on_hit_% = 100
- 家族：致残｜标签：攻击

### 疾患（Malady）

- **功能**：辅助可造成伤害命中的技能，使基础流血概率改为作用于基础中毒，基础中毒概率改为作用于流血。
- **数值**：—
- 家族：疾患｜标签：—

### 机动（Mobility）

- **功能**：辅助可在移动中使用的技能，使用期间你的移动更快。
- **数值**：support_mobility_damage_+%_final = 0；support_mobility_movement_speed_penalty_+%_final_while_performing_action = -25
- 家族：机动｜标签：—

### 动量（Momentum）

- **功能**：辅助你自己使用的任何伤害技能，使用技能期间移动足够距离则伤害更高。瞬移不计入移动距离。
- **数值**：support_momentum_distance_travelled_to_gain_momentum = 20；support_momnetum_damage_+%_final_with_momentum = 40
- 家族：动量｜标签：—

### 杀意（Murderous Intent）

- **功能**：辅助可强化其他技能的技能，使被其强化的技能斩杀敌人。
- **数值**：—
- 家族：杀意｜标签：—

### 奥罗斯的信念（Olroth's Conviction）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：奥罗斯的信念｜标签：血统(传奇)

### 先手（Opening Move）

- **功能**：辅助命中敌人的位移技能。辅助技能对满血敌人的命中使其恍惚。
- **数值**：—
- 家族：先手｜标签：—

### 过剩Ⅰ（Overabundance I）

- **功能**：辅助有「上限」的技能，提高其上限但缩短持续时间。只对名称含「上限」的限制生效。
- **数值**：base_limit_+ = 1；support_limit_skill_effect_duration_+%_final = -50
- 家族：过剩Ⅰ｜标签：—

### 过剩Ⅱ（Overabundance II）

- **功能**：辅助有「上限」的技能，提高其上限但缩短持续时间。只对名称含「上限」的限制生效。
- **数值**：base_limit_+ = 1；support_limit_skill_effect_duration_+%_final = -40
- 家族：过剩Ⅱ｜标签：—

### 冒进（Overextend）

- **功能**：辅助你自己使用的攻击技能。辅助技能暴击伤害更高，但对其暴击会让你短暂恍惚。
- **数值**：support_overextend_critical_strike_multiplier_+%_final = 30
- 家族：冒进｜标签：攻击

### 精纯耐力（Perfected Endurance）

- **功能**：辅助有完美时机收益的技能。辅助技能以完美时机命中敌人时至少获得一个耐力球。
- **数值**：chance_to_gain_endurance_charge_on_perfect_timing_hit_% = 100
- 家族：精纯耐力｜标签：引导

### 完美（Perfection）

- **功能**：辅助有完美时机收益的技能。成功执行完美时机时获得「完美」——一个强力伤害增益；但任何完美时机失败（即使来自非辅助技能）都会移除你身上的全部完美。
- **数值**：—
- 家族：完美｜标签：—

### 塔萨利奥的韵律（Tasalio's Rhythm）

- **功能**：辅助有完美时机收益的技能。用辅助技能成功执行完美时机时，获得塔萨利奥的韵律：层数越多辅助技能伤害越高、完美时机窗口越短。任何完美时机失败（即使来自非辅助技能）都会移除你身上的全部韵律。
- **数值**：perfect_timing_window_ms_+% = 100
- 家族：完美｜标签：血统(传奇)

### 永续充能（Perpetual Charge）

- **功能**：辅助使用时消耗暴击球、狂怒球或耐力球的技能：有概率不移除每个充能球，却照常获得消耗收益。
- **数值**：charge_skip_consume_chance_% = 25
- 家族：永续充能｜标签：—

### 持久地面Ⅰ（Persistent Ground I）

- **功能**：辅助生成地面的技能，使生成的地面持续大幅更久。
- **数值**：地面效果持续 50%
- 家族：持久地面Ⅰ｜标签：—

### 持久地面Ⅱ（Persistent Ground II）

- **功能**：辅助生成地面的技能，使生成的地面持续大幅更久，且只在持续时间结束时消失。
- **数值**：地面效果持续 50%
- 家族：持久地面Ⅱ｜标签：—

### 持久地面Ⅲ（Persistent Ground III）

- **功能**：辅助生成地面的技能：生成的地面持续大幅更久，并降低受影响敌人的冷却回复速度；地面只在持续时间结束时消失。
- **数值**：地面效果持续 50%；ground_effects_apply_cooldown_speed_+%_final = -30
- 家族：持久地面Ⅲ｜标签：—

### 精确暴击（Pinpoint Critical）

- **功能**：辅助任何命中敌人的技能，使其更常暴击但暴击伤害降低。
- **数值**：support_pinpoint_critical_strike_chance_+%_final = 60；support_pinpoint_critical_strike_multiplier_+%_final = -30
- 家族：精确暴击｜标签：—

### 十七号原型（Prototype Seventeen）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：十七号原型｜标签：血统(传奇)

### 怒铸Ⅰ（Rageforged I）

- **功能**：辅助你自己使用或触发的任何伤害技能，使其消耗怒气以提高伤害。怒气不足时加成不生效。
- **数值**：support_rageforged_enraged_damage_+%_final = 35
- 家族：怒铸Ⅰ｜标签：—

### 怒铸Ⅱ（Rageforged II）

- **功能**：辅助你自己使用或触发的任何伤害技能，使其消耗怒气以提高伤害，并有概率不消耗怒气却照常获得加成。怒气不足时加成不生效。
- **数值**：support_rageforged_enraged_damage_+%_final = 35；rage_skip_consume_chance_% = 30
- 家族：怒铸Ⅱ｜标签：—

### 拉基亚塔的奔流（Rakiata's Flow）

- **功能**：辅助可造成伤害命中的技能，使这些命中把敌人的元素抗性视为反向。
- **数值**：treat_enemy_resistances_as_negated_on_elemental_damage_hit_%_chance = 100
- 家族：拉基亚塔的奔流｜标签：血统(传奇)

### 迅捷攻击Ⅰ（Rapid Attacks I）

- **功能**：辅助攻击技能，使其攻击速度提高。
- **数值**：攻击速度 15%
- 家族：迅捷攻击Ⅰ｜标签：攻击

### 迅捷攻击Ⅱ（Rapid Attacks II）

- **功能**：辅助攻击技能，使其攻击速度提高。
- **数值**：攻击速度 25%
- 家族：迅捷攻击Ⅱ｜标签：攻击

### 迅捷攻击Ⅲ（Rapid Attacks III）

- **功能**：辅助攻击技能，使其攻击更快但降低伤害。
- **数值**：攻击速度 35%；support_faster_attacks_damage_+%_final = -50
- 家族：迅捷攻击Ⅲ｜标签：攻击

### 无休暴怒（Relentless Rage）

- **功能**：辅助你自己使用的技能。任意技能消耗怒气时你获得一个增益。使用辅助技能消耗该增益以获得怒气。
- **数值**：—
- 家族：无休暴怒｜标签：—

### 残息增效Ⅰ（Remnant Potency I）

- **功能**：辅助生成残息的技能，使残息更强大。
- **数值**：remnant_effect_+% = 20
- 家族：残息增效Ⅰ｜标签：残息

### 残息增效Ⅱ（Remnant Potency II）

- **功能**：辅助生成残息的技能，使残息更强大，但延迟其效果。
- **数值**：remnant_effect_+% = 30
- 家族：残息增效Ⅱ｜标签：残息

### 残息增效Ⅲ（Remnant Potency III）

- **功能**：辅助生成残息的技能，使残息更强大，但延迟其效果。
- **数值**：remnant_effect_+% = 40
- 家族：残息增效Ⅲ｜标签：残息

### 疾风回刺（Frenzied Riposte）

- **功能**：辅助你自己使用或触发的攻击，命中时消耗被格挡反击的减益，给予你一个狂怒球。不能辅助已会消耗该减益的技能。
- **数值**：—
- 家族：疾风回刺｜标签：攻击

### 里格瓦德的凶暴（Rigwald's Ferocity）

- **功能**：辅助攻击技能，根据所用的武器配置，给予其攻击速度但降低伤害，或提高伤害但降低攻击速度。不改变随从使用的技能。
- **数值**：support_rigwald_attack_speed_+%_in_weapon_set_one = 30；support_rigwald_damage_+%_final_in_weapon_set_one = -15；support_rigwald_attack_speed_+%_in_weapon_set_two = -10；support_rigwald_damage_+%_final_in_weapon_set_two = 30
- 家族：里格瓦德的凶暴｜标签：血统(传奇)、攻击

### 升腾风暴（Rising Tempest）

- **功能**：辅助造成伤害的技能，每近期使用过一种不同元素类型的技能便提高元素伤害。不能辅助随从技能。
- **数值**：support_elemental_damage_+%_final_per_different_elemental_skill_used_recently = 12
- 家族：升腾风暴｜标签：—

### 符文榨取（Runic Extraction）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：符文榨取｜标签：残息

### 奥罗斯的狂妄（Olroth's Hubris）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：符文灌注｜标签：血统(传奇)

### 锈刺（Rusted Spikes）

- **功能**：辅助以命中造成伤害的技能。辅助技能钉固敌人时，还会加剧该敌人身上的流血。
- **数值**：aggravate_bleeding_on_pin_chance_% = 100
- 家族：锈刺｜标签：—

### 冷酷（Ruthless）

- **功能**：辅助攻击技能，使其重复使用时更容易眩晕敌人。
- **数值**：support_ruthless_big_hit_max_count = 5；support_ruthless_big_hit_stun_damage_+%_final = 500
- 家族：冷酷｜标签：—

### 瓜特利齐的剥蚀（Guatelitzi's Ablation）

- **功能**：辅助祭献技能。辅助技能使用时献祭你的一部分生命。祭献尖刺持续期间你周期性获得暴击球；尖刺消失时，按祭献持续时间每秒回复你最大生命与魔力的一定百分比。
- **数值**：sacrifice_%_life_on_skill_use = 25；recover_%_life_and_mana_per_minute_for_supported_offering_lifetime = 300；supported_offerings_grant_you_a_powercharge_every_x_ms = 4000
- 家族：祭献供品｜标签：血统(传奇)

### 祭献供品（Sacrificial Offering）

- **功能**：辅助祭献技能。辅助技能使用时献祭你的一部分生命，作为回报伤害大幅提高且增益更强。
- **数值**：support_ablation_offering_skill_damage_+%_final = 30；offering_spells_effect_+% = 30；sacrifice_%_life_on_skill_use = 15
- 家族：祭献供品｜标签：—

### 回气Ⅰ（Second Wind I）

- **功能**：辅助有冷却的技能，给予其额外使用次数。不能辅助元技能、瞬发技能或触发技能，不改变随从的技能。
- **数值**：base_cooldown_speed_+%_final = -50
- 家族：回气Ⅰ｜标签：—

### 回气Ⅱ（Second Wind II）

- **功能**：辅助有冷却的技能，给予其额外使用次数。不能辅助元技能、瞬发技能或触发技能，不改变随从的技能。
- **数值**：base_cooldown_speed_+%_final = -40
- 家族：回气Ⅱ｜标签：—

### 回气Ⅲ（Second Wind III）

- **功能**：辅助有冷却的技能，给予其额外使用次数，且技能使用进入冷却时回复你的生命。不能辅助元技能、瞬发技能或触发技能，不改变随从的技能。
- **数值**：base_cooldown_speed_+%_final = -40；restore_%_life_on_skill_use_per_1000_ms_cooldown = 1
- 家族：回气Ⅲ｜标签：—

### 乌特雷德的星阵（Uhtred's Constellation）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：乌特雷德的星阵｜标签：血统(传奇)

### 无私残息（Selfless Remnants）

- **功能**：辅助生成残息的技能，使残息被拾取时改为影响你身边的盟友而非你。
- **数值**：—
- 家族：无私残息｜标签：残息

### 短引信Ⅰ（Short Fuse I）

- **功能**：辅助会在一段时间后引爆的技能，缩短引爆时间。
- **数值**：support_fast_forward_detonation_time_+%_final = -40
- 家族：短引信Ⅰ｜标签：—

### 短引信Ⅱ（Short Fuse II）

- **功能**：辅助会在一段时间后引爆的技能，大幅缩短引爆时间，代价是降低伤害。
- **数值**：support_fast_forward_detonation_time_+%_final = -80；support_short_fuse_damage_+%_final = -30
- 家族：短引信Ⅱ｜标签：—

### 灵魂吸取（Soul Drain）

- **功能**：辅助任何命中敌人的技能，斩杀敌人时回复魔力。
- **数值**：recover_%_maximum_mana_on_cull = 12
- 家族：灵魂吸取｜标签：—

### 坚定Ⅰ（Steadfast I）

- **功能**：辅助你自己使用的引导技能，引导期间提供更高的眩晕阈值。
- **数值**：support_steadfast_stun_threshold_+%_final_while_channelling = 50
- 家族：坚定Ⅰ｜标签：引导

### 坚定Ⅱ（Steadfast II）

- **功能**：辅助你自己使用的引导技能，引导期间提供更高的眩晕阈值与异常阈值。
- **数值**：support_steadfast_ailment_threshold_+%_final_while_channelling = 100；support_steadfast_stun_threshold_+%_final_while_channelling = 50
- 家族：坚定Ⅱ｜标签：引导

### 泰然Ⅰ（Stoicism I）

- **功能**：辅助你自己使用的攻击技能。辅助技能稳定累积更高伤害直至上限。若你翻滚或使用位移技能，此加成重置。
- **数值**：support_no_fear_damage_+%_final_per_second_up_to_30% = 1
- 家族：泰然Ⅰ｜标签：—

### 泰然Ⅱ（Stoicism II）

- **功能**：辅助你自己使用的攻击技能。辅助技能稳定累积更高伤害直至上限。若你翻滚或使用位移技能，此加成重置。
- **数值**：support_no_fear_damage_+%_final_per_second_up_to_30% = 2
- 家族：泰然Ⅱ｜标签：—

### 眩晕Ⅰ（Stun I）

- **功能**：辅助任何命中敌人的技能，使其更快累积眩晕。
- **数值**：support_overpower_hit_damage_stun_multiplier_+%_final = 50
- 家族：眩晕Ⅰ｜标签：—

### 眩晕Ⅱ（Stun II）

- **功能**：辅助任何命中敌人的技能，使其更快累积眩晕。
- **数值**：support_overpower_hit_damage_stun_multiplier_+%_final = 70
- 家族：眩晕Ⅱ｜标签：—

### 眩晕Ⅲ（Stun III）

- **功能**：辅助任何命中敌人的技能，使其显著更快累积眩晕，代价是降低伤害。
- **数值**：support_overpower_hit_damage_stun_multiplier_+%_final = 300；support_overpower_damage_+%_final = -50
- 家族：眩晕Ⅲ｜标签：—

### 斯特恩之山（Styrn's Mountain）

- **功能**：（数据源无描述）
- **数值**：—
- 家族：斯特恩之山｜标签：血统(传奇)

### 超临界（Supercritical）

- **功能**：辅助任何命中敌人的技能，暴击伤害更高但暴击率降低。
- **数值**：base_critical_strike_multiplier_+ = 100；support_critical_damage_critical_strike_chance_+%_final = -20
- 家族：超临界｜标签：—

### 充能强化（Heightened Charges）

- **功能**：辅助任何消耗充能球的技能，使其消耗所获收益有概率翻倍。
- **数值**：chance_%_to_double_effect_of_removing_charges = 20
- 家族：充能强化｜标签：—

### 乌特雷德的预兆（Uhtred's Augury）

- **功能**：辅助可获得等级的技能，当恰好与其他 2 个辅助石搭配时给予额外等级。不辅助没有等级的技能。
- **数值**：supported_active_skill_gem_level_+_if_two_other_supports = 2
- 家族：乌特雷德的预兆｜标签：血统(传奇)

### 乌特雷德的迁徙（Uhtred's Exodus）

- **功能**：辅助可获得等级的技能，当不与其他任何辅助石搭配时给予大量额外等级。不辅助没有等级的技能。
- **数值**：supported_active_skill_gem_level_+_if_no_other_supports = 3
- 家族：乌特雷德的迁徙｜标签：血统(传奇)

### 乌特雷德的征兆（Uhtred's Omen）

- **功能**：辅助可获得等级的技能，当恰好与其他 1 个辅助石搭配时给予额外等级。不辅助没有等级的技能。
- **数值**：supported_active_skill_gem_level_+_if_one_other_support = 2
- 家族：乌特雷德的征兆｜标签：血统(传奇)

### 精准之力（Unerring Power）

- **功能**：辅助你自己使用的攻击技能。辅助攻击被强化时，消耗大幅降低且精度大幅提高。
- **数值**：support_discount_skill_cost_+%_final_if_empowered = -30；support_discount_accuracy_rating_+%_final_if_empowered = 30
- 家族：精准之力｜标签：攻击

### 难以触及（Untouchable）

- **功能**：辅助你自己使用的攻击技能。使用辅助技能时你获得闪避值提升，攻击时间越长的技能提升越高。不能辅助引导技能。
- **数值**：evasion_+%_while_performing_action_per_250_ms_attack_time = 25
- 家族：难以触及｜标签：攻击

### 先锋Ⅰ（Vanguard I）

- **功能**：辅助盾牌技能，用辅助技能眩晕敌人时获得守护。
- **数值**：guard_on_stun_guard_duration_ms = 4000
- 家族：先锋Ⅰ｜标签：—

### 先锋Ⅱ（Vanguard II）

- **功能**：辅助盾牌技能，用辅助技能眩晕敌人时获得守护。
- **数值**：guard_on_stun_guard_duration_ms = 4000
- 家族：先锋Ⅱ｜标签：—

### 瓦拉沙的祝福（Varashta's Blessing）

- **功能**：辅助任何能造成伤害的技能，过去几秒内你每使用过一种不同的号令技能伤害越高。不改变随从的技能。
- **数值**：support_djinn_lineage_damage_+%_final_per_different_command_in_last_8_seconds = 10
- 家族：瓦拉沙的祝福｜标签：血统(传奇)

### 机会之窗Ⅰ（Window of Opportunity I）

- **功能**：辅助有完美时机释放特效的引导技能：完美时机释放时伤害大幅提高，但完美时机窗口缩短。
- **数值**：perfect_timing_window_ms_+% = -35；support_window_of_opportunity_perfect_timing_damage_+%_final = 35
- 家族：机会之窗Ⅰ｜标签：引导

### 机会之窗Ⅱ（Window of Opportunity II）

- **功能**：辅助有完美时机释放特效的引导技能：完美时机释放时伤害大幅提高并获得完美偏转，但完美时机窗口缩短。
- **数值**：perfect_timing_window_ms_+% = -35；support_window_of_opportunity_perfect_timing_damage_+%_final = 35；gain_%_of_evasion_as_deflection_rating_on_perfect_timing_for_8_seconds = 15
- 家族：机会之窗Ⅱ｜标签：引导

---

## 附：数据源无描述的条目（29 条）

- 饲喂狂热Ⅱ（Feeding Frenzy II）
- 坦玛祖的香炉（Tangmazu's Thurible）
- 卡莎的辉光（Catha's Brilliance）
- 弗鲁恩的余波（Vruun's Aftermath）
- 符文锻刃（Runeforged Blades）
- 裂隙之主的融合（Breachlord's Amalgam）
- 震荡符文（Concussive Runes）
- 卡尔古之拳（Fist Of Kalguur）
- 梅德维的伐斩（Medved's Felling）
- 骗徒碎片（Trickster's Shard）
- 图尔的雪崩（Tul's Avalanche）
- 莫瑞甘的洞悉（Morrigan's Insight）
- 斯特恩的凶暴（Styrn's Ferocity）
- 符文灌注（Runic Infusion）
- 涤荡之焰（Scouring Flame）
- 裂隙之主的裂口（Breachlord's Rift）
- 艾许的精通（Esh's Prowess）
- 仲裁者的及远（Arbiter's Reach）
- 沃拉娜的围城（Vorana's Siege）
- 乌特雷德的仪式（Uhtred's Rite）
- 治疗符文（Healing Runes）
- 她的宣言（Her Declaration）
- 炽天使之心（Seraph's Heart）
- 奥罗斯的信念（Olroth's Conviction）
- 十七号原型（Prototype Seventeen）
- 符文榨取（Runic Extraction）
- 奥罗斯的狂妄（Olroth's Hubris）
- 乌特雷德的星阵（Uhtred's Constellation）
- 斯特恩之山（Styrn's Mountain）