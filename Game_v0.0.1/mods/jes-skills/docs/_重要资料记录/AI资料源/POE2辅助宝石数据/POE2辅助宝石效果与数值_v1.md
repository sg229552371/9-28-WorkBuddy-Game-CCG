# POE2 辅助宝石效果与数值（PoB2 抽取 v1）

> **真源**：`原始PoB2数据/`（PoB2 `dev` 分支 commit `bb52d6b`，commit 时间 2026-10-01）。
> **抽取时间**：2026-10-23。**性质**：只查不写的外部参考（S6 冷区），**不是施工依据**。
> **内容**：名称 / 家族 / Tier / 属性需求 / 官方效果描述 / 可辅助与禁止的技能类型 / 数值条目。
> **未含**：逐级成长表（辅助宝石大多单级，`levelCount` 已在明细中标注）、中文名。
> **判定语义**（照 PoB2 `CalcTools.doesTypeExpressionMatch` 实现）：条件串是后缀表达式，并列的操作数之间是 **或**，`AND` / `NOT` 才是与/非。例：`Attack OR Bow` = 有任一类型即可；`(Attack AND Bow)` 才要求同时具备。
> **数值文本**：由 `gem_stat_descriptions.lua` 模板回填，反引号包裹的是未找到文本模板的原始 stat key（值为常量）。

- 宝石条目：567　效果定义：596　无法关联的孤立效果：29

## 一、家族总览

| 家族 | 变体 | Tier | 属性需求 S/D/I |
|---|---|---|---|
| (无家族) | Runeforged Blades | 0 | 0/0/0 |
| Abiding Hex | I | 2 | 0/0/100 |
| Accelerated Growth | I / II | 2,5 | 0/0/100 |
| Acrimony | I | 2 | 0/0/100 |
| Additional Projectiles | Multishot I / Multishot II / Sione's Temper / Wildshards I / Wildshards II | 0,1,2,3,5 | 0/100/0 |
| Additional Projectiles, Nova Projectiles | Nova Projectiles II | 4 | 0/100/0 |
| Additional Projectiles, Seal | Salvo | 3 | 0/100/0 |
| Adhesive Grenades | I / II | 2,3 | 0/100/0 |
| Admixture | I | 2 | 0/100/0 |
| Advancing Storm | I | 4 | 0/0/100 |
| Advancing Storm, Overabundance | Morgana's Tempest | 0 | 0/0/100 |
| Aftershock | I / II / Tectonic Slams | 2,4 | 100/0/0 |
| Ailith's Chimes | I | 0 | 0/100/0 |
| Alignment | I / II | 3,4 | 0/100/0 |
| Alignment, Additional Projectiles | Alignment III | 5 | 0/100/0 |
| Amanamu's Tithe | I | 0 | 100/0/0 |
| Ambrosia | I / II | 2,3 | 0/0/100 |
| Ambush | I | 1 | 0/0/100 |
| Ammo Conservation | Arjun's Medal / I / II / III | 0,2,4,5 | 0/100/0 |
| Ancestral Call | Ancestral Aid / I / II | 0,4,5 | 100/0/0 |
| Arakaali's Lust | I | 0 | 0/100/0 |
| Arbiter's Ignition | I | 0 | 0/0/100 |
| Arbiter's Reach | I | 0 | 0/0/0 |
| Arcane Surge | I | 1 | 0/0/100 |
| Armour Break | Breachlord's Rift / Brittle Armour / I / II / III / Styrn's Ferocity | 0,2,3,4 | 100/0/0 |
| Armour Demolisher | I / II / Uruk's Smelting | 0,1,3 | 100/0/0 |
| Armour Explosion | I | 1 | 100/0/0 |
| Arms' Length | Arms Length | 0 | 100/0/0 |
| Astral Projection | I | 3 | 0/0/100 |
| Atziri's Allure | I | 0 | 0/0/100 |
| Atziri's Communion | I | 0 | 0/0/100 |
| Auto Reload | I | 0 | 100/0/0 |
| Barbs | I / II / III | 3,5 | 100/0/0 |
| Battershout | I | 1 | 100/0/0 |
| Behead | Einhar's Beastrite / I / II | 0,2,3 | 100/0/0 |
| Bidding | I / II / III | 2,4,5 | 0/0/100 |
| Biting Frost | I / II / Morrigan's Insight | 0,3,5 | 0/0/100 |
| Blackblood | Kurgal's Leash | 0 | 0/0/100 |
| Blazing Critical | I | 4 | 0/0/100 |
| Bleed | I / II / III / IV | 1,3,5 | 100/0/0 |
| Blind | I / II | 2,5 | 0/100/0 |
| Blindside | I | 1 | 0/100/0 |
| Bloodlust | I | 0 | 100/0/0 |
| Bone Shrapnel | I | 2 | 0/0/100 |
| Boundless Energy | I / II | 2,4 | 0/0/100 |
| Bounty | Charm / I / II / Life / Mana | 0,2,4 | 0/100/0 |
| Brambleslam | I | 5 | 100/0/0 |
| Breachlord | Esh's Radiance / Tul's Stillness / Uul-Netol's Embrace / Xoph's Pyre | 0 | 0/0/100 |
| Brink | I / II | 1,3 | 100/0/0 |
| Brutality | I / II / III | 1,2,5 | 100/0/0 |
| Burgeon | I / II | 1,4 | 0/0/100 |
| Burning Inscription | I | 4 | 0/0/100 |
| Bursting Plague | I | 2 | 0/100/0 |
| Cadence | I | 2 | 0/100/0 |
| Caltrops | I | 3 | 0/100/0 |
| Cannibalism | I / II | 3,4 | 100/0/0 |
| Catharsis | I | 2 | 0/0/100 |
| Chain | I / II / III | 1,2,5 | 0/100/0 |
| Chaos Attunement | I | 3 | 0/0/100 |
| Chaotic Freeze | I | 3 | 0/0/100 |
| Charge Profusion | I / II | 1,5 | 0/100/0 |
| Charged Mark | I | 5 | 0/100/0 |
| Charged Shots | I / II | 3,5 | 0/100/0 |
| Clarity | I / II | 1,4 | 0/0/100 |
| Clash | I | 3 | 100/0/0 |
| Close Combat | I / II | 3,5 | 0/100/0 |
| Cold Attunement | I | 1 | 0/0/100 |
| Cold Exposure | I | 4 | 0/0/100 |
| Cold Penetration | I | 2 | 0/0/100 |
| Combo Finisher | I / II | 1,3 | 0/100/0 |
| Commandment | I | 0 | 0/0/100 |
| Commiserate | I | 2 | 0/100/0 |
| Compressed Duration | I / II | 1,3 | 100/0/0 |
| Concentrated Area | I | 1 | 0/0/100 |
| Concoct | I / II | 2,4 | 100/0/0 |
| Concussive Runes | I | 0 | 0/0/0 |
| Concussive Spells | I | 4 | 0/0/100 |
| Considered Casting | I | 2 | 0/0/100 |
| Controlled Destruction | I | 1 | 0/0/100 |
| Cool Headed | I | 3 | 100/0/0 |
| Cooldown Recovery | Atziri's Impatience / I / II | 0,3,4 | 0/100/0 |
| Corpse Conservation | I | 3 | 0/0/100 |
| Corrosion | I | 1 | 0/100/0 |
| Corrupting Cry | I / II / Paquate's Pact | 0,3,5 | 100/0/0 |
| Coursing Current | I | 1 | 0/0/100 |
| Crackling Barrier | I | 2 | 0/0/100 |
| Crater | I | 2 | 100/0/0 |
| Crazed Minions | I | 4 | 0/0/100 |
| Creeping Chill | I | 1 | 0/0/100 |
| Crescendo | I / II / III | 1,4,5 | 0/0/100 |
| Crystalline Shards | I | 1 | 0/0/100 |
| Culling Strike | I / II | 4,5 | 0/100/0 |
| Culmination | I / II | 3,5 | 0/100/0 |
| Cursed Ground | Doedre's Undoing / Hayoxi's Fulmination / I | 0,3 | 0/0/100 |
| Danse Macabre | I | 2 | 0/0/100 |
| Daresso's Passion | I | 0 | 100/0/0 |
| Dauntless | I | 0 | 100/0/0 |
| Deadly Heralds | Deadly Herald | 3 | 0/100/0 |
| Deadly Poison | I / II | 2,4 | 0/100/0 |
| Deadly Resolve | I | 3 | 100/0/0 |
| Deathmarch | I | 2 | 0/0/100 |
| Decaying Hex | I | 3 | 0/0/100 |
| Deep Cuts | I / II | 3,5 | 100/0/0 |
| Deep Freeze | I | 1 | 0/0/100 |
| Defy | I / II | 2,5 | 100/0/0 |
| Delayed Gratification | I | 2 | 0/100/0 |
| Delayed Reaction | Controlled Hazard / I | 4 | 0/100/0 |
| Deliberation | I | 3 | 0/100/0 |
| Derange | I | 4 | 0/0/100 |
| Dialla's Desire | I | 0 | 0/0/100 |
| Direstrike | I / II | 2,4 | 100/0/0 |
| Discombobulate | Daze | 0 | 0/100/0 |
| Dominus' Grasp | I | 0 | 0/100/0 |
| Double Barrel | I / II / III | 1,2,5 | 100/0/0 |
| Double Barrel, Rapid Attacks | Ratha's Assault | 0 | 0/100/0 |
| Drain Ailments | I | 3 | 0/0/100 |
| Durability | I | 2 | 0/100/0 |
| Echoing Cry | I | 4 | 100/0/0 |
| Efficiency | I / II | 1,4 | 100/0/0 |
| Electrocute | Eonyr's Thunder / I / Neural Overload | 0,2,3 | 0/100/0 |
| Electromagnetism | I | 3 | 0/0/100 |
| Elemental Armament | I / II / III | 1,2,5 | 100/0/0 |
| Elemental Army | I | 1 | 0/0/100 |
| Elemental Discharge | Catalysing Elements / I | 3,5 | 0/0/100 |
| Elemental Focus | I | 3 | 0/0/100 |
| Embitter | I | 2 | 0/0/100 |
| Empowered Sparks | I | 2 | 0/0/100 |
| Encroaching Ground | I | 2 | 0/0/100 |
| Encumbrance | Slow Potency | 1 | 0/100/0 |
| Enduring Impact | I / II | 1,4 | 100/0/0 |
| Energy Capacitor | I | 3 | 0/0/100 |
| Energy Retention | I | 3 | 0/0/100 |
| Enraged Warcry | I / II | 4,5 | 100/0/0 |
| Escalating Poison | I | 1 | 0/100/0 |
| Essence Harvest | I | 3 | 0/0/100 |
| Eternal Flame | I / II / III | 1,3,4 | 100/0/0 |
| Eternal Mark | I | 3 | 0/0/100 |
| Execute | I / II / III | 1,4,5 | 100/0/0 |
| Exploit Weakness | I | 2 | 100/0/0 |
| Exposing Cry | I | 4 | 100/0/0 |
| Extraction | I | 3 | 0/0/100 |
| Fan The Flames | I / II | 2,4 | 100/0/0 |
| Feeding Frenzy | I / II | 3,4 | 0/0/100 |
| Ferocity | I | 0 | 0/100/0 |
| Fiery Death | I | 2 | 0/0/100 |
| Fire Attunement | I | 1 | 100/0/0 |
| Fire Exposure | I | 4 | 100/0/0 |
| Fire Penetration | I / II | 2,5 | 100/0/0 |
| Fissures | Branching  I / Branching  II / Kaom's Madness / Upheaval I / Upheaval II | 0,1,3,5 | 100/0/0 |
| Fist of War | Fist Of Kalguur / I / II / III | 0,1,3,5 | 0/0/0 |
| Flame Pillar | I | 0 | 100/0/0 |
| Flamepierce | I | 0 | 100/0/0 |
| Fluke | I / Ixchel's Torment | 0,3 | 0/0/100 |
| Focused Curse | I | 2 | 0/0/100 |
| Font | of Blood / of Mana | 2 | 100/0/0 |
| Fork | I | 3 | 0/100/0 |
| Fortress | Ahn's Citadel / I / II | 0,1,3 | 0/0/100 |
| Freeze | I | 2 | 0/0/100 |
| Freezefork | I | 0 | 0/0/100 |
| Fresh Clip | I / II | 2,4 | 100/0/0 |
| Frost Nexus | I | 2 | 0/0/100 |
| Frostfire | I | 3 | 0/0/100 |
| Frozen Spite | I | 2 | 0/100/0 |
| Gambleshot | I | 3 | 0/0/100 |
| Garukhan's Resolve | I | 0 | 0/100/0 |
| Glacier | I | 2 | 0/0/100 |
| Gorge | I | 2 | 0/0/100 |
| Grants Cooldown | Breachlord's Amalgam / Excise / Execrate / Expanse / Hourglass | 0,1,2,3 | 0/0/0 |
| Haemocrystals | I | 3 | 100/0/0 |
| Hardy Totems | I / II / Tawhoa's Tending | 0,2,4 | 100/0/0 |
| Harmonic Remnants | I / II | 2,3 | 0/0/100 |
| Healing Runes | I | 0 | 0/0/0 |
| Heavy Swing | I | 4 | 100/0/0 |
| Heft | I | 5 | 100/0/0 |
| Heightened Accuracy | I / II | 1,3 | 0/100/0 |
| Heightened Curse | I | 1 | 0/0/100 |
| Helbrym's Hide | I | 0 | 100/0/0 |
| Her Declaration | I | 0 | 0/0/0 |
| Herbalism | I / II | 2,4 | 100/0/0 |
| Hex Bloom | I | 3 | 0/0/100 |
| Hit and Run | I | 4 | 0/100/0 |
| Holy Descent | I | 5 | 100/0/0 |
| Hulking Minions | I / Tangmazu's Thurible | 0,4 | 0/0/100 |
| Ice Bite | Bhatair's Vengeance / I / II | 0,1,3 | 0/0/100 |
| Icicle | I | 2 | 0/0/100 |
| Ignite | I / II / III | 1,3,5 | 100/0/0 |
| Immolate | I | 3 | 100/0/0 |
| Impact Shockwave | I | 1 | 100/0/0 |
| Impale | I | 4 | 0/100/0 |
| Impending Doom | I | 1 | 0/0/100 |
| Incision | I | 4 | 100/0/0 |
| Increased Area of Effect | Magnified Area I / Magnified Area II / Overreach / Vruun's Inevitability | 0,1,2,3 | 0/0/100 |
| Increased Area of Effect, Concentrated Area | Vorana's Siege | 0 | 0/0/0 |
| Inexorable Critical | I / II | 3,4 | 0/0/100 |
| Infernal Legion | Catha's Brilliance / I / II / III | 0,2,5 | 0/0/0 |
| Inhibitor | I | 2 | 0/100/0 |
| Innervate | I | 1 | 0/100/0 |
| Intense Agony | I | 2 | 0/0/100 |
| Jagged Ground | I / II | 2,5 | 100/0/0 |
| Kalisa's Crescendo | I | 0 | 0/0/100 |
| Khatal's Rejuvenation | I | 0 | 0/0/100 |
| Knockback | I | 3 | 100/0/0 |
| Kulemak's Dominion | I | 0 | 0/0/100 |
| Last Gasp | I / Tecrod's Revenge | 0,1 | 0/0/100 |
| Lasting Ground | I | 0 | 100/0/0 |
| Lasting Shock | I | 2 | 0/100/0 |
| Life Drain | I | 1 | 0/100/0 |
| Life Leech | I / II / III | 2,3,5 | 100/0/0 |
| Lifetap | Atalui's Bloodletting / I | 0,2 | 100/0/0 |
| Lightning Attunement | I | 1 | 0/100/0 |
| Lightning Exposure | I | 4 | 0/100/0 |
| Lightning Penetration | I | 2 | 0/100/0 |
| Living Lightning | I / II | 2,4 | 0/0/100 |
| Lockdown | I | 0 | 0/100/0 |
| Long Fuse | I / II | 4,5 | 100/0/0 |
| Longshot | I / II | 2,3 | 0/100/0 |
| Loyalty | I / Romira's Requital | 0,2 | 0/0/100 |
| Magnetism | Magnetic Remnants | 0 | 0/0/100 |
| Maim | I | 2 | 0/100/0 |
| Malady | I | 0 | 0/100/0 |
| Mana Flare | I | 2 | 0/0/100 |
| Mana Leech | I / Oisin's Oath | 0,2 | 0/0/100 |
| Mark for Death | I / II | 2,4 | 100/0/0 |
| Mark of Siphoning | I / II | 1,4 | 0/0/100 |
| Mastery | Chaos / Cold / Esh's Prowess / Fire / Lightning / Minion / Physical | 0,5 | 0/0/100 |
| Meat Shield | Brutus' Brain / I / II | 0,1,3 | 100/0/0 |
| Minion Area of Effect | Minion Splash I / Minion Splash II | 2,5 | 100/0/0 |
| Minion Instability | I | 2 | 0/0/100 |
| Minion Pact | I / II | 1,4 | 0/0/100 |
| Mobility | I | 3 | 0/100/0 |
| Momentum | I | 2 | 0/100/0 |
| Murderous Intent | I | 0 | 0/100/0 |
| Muster | I | 3 | 0/0/100 |
| Mysticism | I / II | 2,4 | 0/0/100 |
| Nimble Reload | I | 4 | 0/100/0 |
| Nova Projectiles | I | 2 | 0/100/0 |
| Olroth's Conviction | I | 0 | 0/0/0 |
| Opening Move | I | 1 | 100/0/0 |
| Overabundance | I / II | 1,4 | 0/100/0 |
| Overcharge | I | 4 | 0/100/0 |
| Overextend | I | 0 | 0/100/0 |
| Payload | I | 4 | 0/100/0 |
| Perfected Endurance | I | 4 | 0/100/0 |
| Perfection | I / Tasalio's Rhythm | 0,4 | 0/100/0 |
| Perpetual Charge | I | 1 | 0/0/100 |
| Persistent Ground | I / II / III | 2,3,5 | 100/0/0 |
| Pierce | I / II / III | 1,3,5 | 0/100/0 |
| Pin | I / II / III | 1,2,5 | 0/100/0 |
| Pinpoint Critical | I | 2 | 0/0/100 |
| Poison | I / II / III | 1,3,5 | 0/100/0 |
| Poison Spores | I | 3 | 0/100/0 |
| Potent Exposure | I | 2 | 0/0/100 |
| Practical Magic | I / II | 3,5 | 0/0/100 |
| Practiced Combo | I | 3 | 0/100/0 |
| Precision | I / II | 1,4 | 0/100/0 |
| Profanity | I / II | 1,5 | 0/0/100 |
| Projectile Speed | Projectile Acceleration I / Projectile Acceleration II / Projectile Acceleration III / Projectile Deceleration I / Projectile Deceleration II / Vilenta's Propulsion | 0,1,3,4,5 | 0/100/0 |
| Prolonged Duration | I / II | 1,3 | 100/0/0 |
| Prototype | Seventeen | 0 | 0/0/0 |
| Punch Through | I | 3 | 0/100/0 |
| Pursuit | I / II / III | 1,3,5 | 0/100/0 |
| Quill Burst | I | 3 | 100/0/0 |
| Rage | I / II / III / Medved's Felling | 0,1,4,5 | 0/0/0 |
| Rageforged | I / II | 4,5 | 100/0/0 |
| Raging Cry | I | 2 | 100/0/0 |
| Rakiata's Flow | I | 0 | 0/100/0 |
| Rapid Attacks | I / II / III | 1,4,5 | 0/100/0 |
| Rapid Casting | I / II / III | 1,4,5 | 0/0/100 |
| Rearm | I / II | 3,5 | 0/100/0 |
| Refraction | I / II / III | 2,3,5 | 100/0/0 |
| Reinforced Totems | I / II | 3,5 | 100/0/0 |
| Relentless Rage | I | 0 | 100/0/0 |
| Remnant Potency | I / II / III | 2,3,4 | 100/0/0 |
| Rending Apex | I | 3 | 100/0/0 |
| Retaliate | I / II | 2,4 | 100/0/0 |
| Retort | Frenzied Riposte | 2 | 0/100/0 |
| Retreat | I / II / III | 1,3,5 | 0/100/0 |
| Reverberate | I | 0 | 100/0/0 |
| Ricochet | I / II | 2,4 | 0/100/0 |
| Rigwald's Ferocity | I | 0 | 0/100/0 |
| Rip | I | 3 | 100/0/0 |
| Rising Tempest | I | 2 | 0/0/100 |
| Ritualistic Curse | I | 3 | 0/0/100 |
| Runic Extraction | I | 0 | 0/0/0 |
| Runic Infusion | I / Olroth's Hubris | 0 | 0/0/0 |
| Rupture | I | 3 | 100/0/0 |
| Rusted Spikes | I | 0 | 100/0/0 |
| Ruthless | I | 0 | 100/0/0 |
| Sacrificial Lamb | I / II | 1,3 | 0/0/100 |
| Sacrificial Offering | Guatelitzi's Ablation / I | 0,3 | 0/0/100 |
| Seal | Unleash / Zarokh's Revolt | 0,1 | 0/0/100 |
| Seal, Increased Area of Effect | Expand | 5 | 0/0/100 |
| Searing Flame | I / II / Scouring Flame | 0,3,4 | 0/0/0 |
| Second Wind | I / II / III / Uhtred's Constellation | 0,2,4,5 | 0/100/0 |
| Selfless Remnants | I | 2 | 100/0/0 |
| Seraph's Heart | I | 0 | 0/0/0 |
| Shock | I | 1 | 0/100/0 |
| Shock Conduction | I / II | 0,2 | 0/0/100 |
| Shock Siphon | I | 0 | 0/0/100 |
| Shocking Leap | I | 2 | 0/100/0 |
| Short Fuse | I / II | 2,4 | 100/0/0 |
| Skittering Stone | I / II | 2,4 | 100/0/0 |
| Soul Drain | I | 3 | 0/100/0 |
| Spar | I | 0 | 100/0/0 |
| Spectral Volley | I | 4 | 0/100/0 |
| Spell Cascade | I | 1 | 0/0/100 |
| Spell Echo | I / Trickster's Shard / Zarokh's Refrain | 0,2 | 0/0/100 |
| Spell Echo, Seal | Tul's Avalanche | 0 | 0/0/0 |
| Static Shocks | I | 3 | 0/0/100 |
| Steadfast | I / II | 1,3 | 100/0/0 |
| Stoicism | I / II | 3,5 | 100/0/0 |
| Stomping Ground | I | 1 | 100/0/0 |
| Stormchain | I | 0 | 0/100/0 |
| Stormfire | I | 3 | 0/0/100 |
| Streamlined Rounds | I | 3 | 0/100/0 |
| Strong Hearted | I | 3 | 0/0/100 |
| Stun | I / II / III | 2,4,5 | 100/0/0 |
| Styrn's Mountain | I | 0 | 0/0/0 |
| Supercritical | I | 3 | 0/0/100 |
| Swift Affliction | I / II / III | 1,3,5 | 0/100/0 |
| Syzygy | I | 4 | 100/0/0 |
| Tacati's Ire | I | 0 | 0/100/0 |
| Tear | I | 3 | 100/0/0 |
| Thornskin | I / II | 2,4 | 100/0/0 |
| Thrill of the Kill | I / II | 1,3 | 0/0/100 |
| Tireless | I | 1 | 100/0/0 |
| Totemic Control | Cirel's Cultivation / Splinter Totem I / Splinter Totem II | 0,3,5 | 100/0/0 |
| Twofold | Heightened Charges | 2 | 0/100/0 |
| Uhtred of Kalguur | Uhtred's Augury / Uhtred's Exodus / Uhtred's Omen | 0 | 100/0/0 |
| Uhtred's Rite | I | 0 | 0/0/0 |
| Undermine | I | 0 | 100/0/0 |
| Unerring Power | I | 0 | 0/100/0 |
| Untouchable | I | 0 | 0/100/0 |
| Upwellling | Upwelling I / Upwelling II | 2,4 | 0/0/100 |
| Urgent Totems | I / II / III | 2,3,4 | 100/0/0 |
| Vanguard | I / II | 1,2 | 100/0/0 |
| Varashta's Blessing | I | 0 | 0/0/100 |
| Verglas | I | 3 | 0/0/100 |
| Vitality | I / II | 1,4 | 100/0/0 |
| Volatility | I | 3 | 0/0/100 |
| Volcanic Eruption | I | 2 | 100/0/0 |
| Volt | I | 2 | 0/100/0 |
| Vruun's Aftermath | I | 0 | 0/0/0 |
| Warm Blooded | I | 3 | 0/100/0 |
| Wildfire | I | 2 | 0/0/100 |
| Wind Wave | I | 0 | 0/100/0 |
| Window of Opportunity | I / II | 1,5 | 0/100/0 |
| Withering Touch | I | 1 | 0/0/100 |
| Xibaqua's Rending | I | 0 | 0/0/100 |
| Zenith | I / II | 1,3 | 0/0/100 |
| Zerphi's Legacy | Zerphi's Infamy | 0 | 100/0/0 |

## 二、明细（按家族）

### (无家族)

**Runeforged Blades** · Tier 0 · 需求 0/0/0 · 标签 `Attack, Projectile, Trigger, Payoff`
- 效果：Supports Attacks you use yourself, causing them to Consume Fully Broken Armour on enemies to fire a nova of runic Projectiles at the cost of Runic Ward. The Projectiles cannot Hit the enemy from which they originated. Cannot support skills that Consume Broken Armour.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Channel OR Sustained OR (ConsumesFullyBrokenArmour AND NOT SupportedByRuneforgedBlades)
- 赋予类型：ConsumesFullyBrokenArmour, SupportedByRuneforgedBlades


### Abiding Hex

**Abiding Hex** · Tier 2 · 需求 0/0/100 · 标签 `Curse`
- 效果：Supports Curse Skills you cast yourself. Supported Skills will consume Power Charges on use, gaining significant Curse duration if they do. Cannot Support Skills which consume Power Charges.
- 可辅助条件：AppliesCurse
- 禁止条件：Aura OR UsedByProxy OR Triggered OR Persistent OR (SkillConsumesPowerChargesOnUse AND NOT SupportedByAbidingHex)
- 赋予类型：ConsumesCharges, SkillConsumesPowerChargesOnUse, SupportedByAbidingHex
- 数值：Supported Skills consume a Power Charge on use Supported Skills have 80% more duration when consuming a Power Charge


### Accelerated Growth

**Accelerated Growth** · Tier 2 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Plant`
- 效果：Supports Plant Skills, causing them to Trigger an explosion after they have been Overgrown.
- 可辅助条件：Plant

**Accelerated Growth II** · Tier 5 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Plant`
- 效果：Supports Plant Skills, causing them to Trigger an explosion after they have been Overgrown, Blinding enemies Hit.
- 可辅助条件：Plant


### Acrimony

**Acrimony** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills which can Damage Enemies. Enemies affected by Damage over time from Supported Skills which was not caused by a Damaging Ailment have reduced Life regeneration rate. Only the strongest instance of this Debuff will apply. Does not Support Skills used by Minions.
- 可辅助条件：DegenOnlySpellDamage OR DamageOverTime
- 数值：Enemies affected by non-Ailment Damage over time from Supported Skills have -50% increased Life regeneration rate


### Additional Projectiles

**Multishot I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making them fire extra Projectiles. Also lowers Attack and Cast speed of supported skills, as well as lessening their damage.
- 可辅助条件：Projectile OR ProjectileNumber
- 禁止条件：ProjectilesNumberModifiersNotApplied
- 数值：Supported Skills fire an additional Projectile；Supported Skills deal -35% more Damage；`terrain_arrow_attachment_chance_reduction_+%` = 200；Supported Skills have -20% more Skill Speed

**Multishot II** · Tier 2 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making them fire extra Projectiles. Also lowers Attack and Cast speed of supported skills, as well as lessening their damage.
- 可辅助条件：Projectile OR ProjectileNumber
- 禁止条件：ProjectilesNumberModifiersNotApplied
- 数值：Supported Skills fire an additional Projectile；Supported Skills deal -25% more Damage；`terrain_arrow_attachment_chance_reduction_+%` = 200；Supported Skills have -20% more Skill Speed

**Sione's Temper** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, Projectile`
- 效果：Supports Projectile Spells. Supported Spells have an increasingly higher chance to fire many additional Projectiles in a circle, resetting when they do.
- 可辅助条件：Spell AND Projectile
- 禁止条件：ProjectilesNumberModifiersNotApplied
- 数值：Gain 1 Wildshard on casting Supported Spells；Supported Skills have a 20% chance to fire 8 additional Projectiles in a circle per Wildshard All Wildshards are lost when Supported Skills fire Projectiles in a circle

**Wildshards I** · Tier 3 · 需求 0/0/100 · 标签 `Spell, Projectile`
- 效果：Supports Projectile Spells. Supported Spells have a chance to fire many additional Projectiles in a circle.
- 可辅助条件：Spell AND Projectile
- 禁止条件：ProjectilesNumberModifiersNotApplied
- 数值：Supported Skills have a 20% chance to fire 8 additional Projectiles in a circle

**Wildshards II** · Tier 5 · 需求 0/0/100 · 标签 `Spell, Projectile`
- 效果：Supports Projectile Spells. Supported Spells have a chance to fire many additional Projectiles in a circle.
- 可辅助条件：Spell AND Projectile
- 禁止条件：ProjectilesNumberModifiersNotApplied
- 数值：Supported Skills have a 25% chance to fire 8 additional Projectiles in a circle


### Additional Projectiles, Nova Projectiles

**Nova Projectiles II** · Tier 4 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile Skills, making them fire extra Projectiles in a circle, at the cost of Damage and gaining a cooldown. Does not Support Skills which rain down Projectiles from above. Cannot Support Skills which already have a cooldown.
- 可辅助条件：Projectile OR ProjectileNumber OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：(Cooldown AND NOT SupportedByNovaProjectiles) OR SummonsTotem OR UsedByTotem OR Trapped OR RemoteMined OR Persistent OR Vaal OR Rain OR ProjectilesNumberModifiersNotApplied
- 赋予类型：Cooldown, SupportedByNovaProjectiles
- 数值：Supported Skills fire an additional Projectile；Supported Skills deal -50% more Damage


### Additional Projectiles, Seal

**Salvo** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Attack Skills you use yourself which fire Projectiles, Sealing them over time. The Seals are broken when used, causing additional Projectiles to be fired. Projectiles from Supported Skills are fired in random directions. Cannot Support Skills which require Combo, have a Cooldown or which already gain Seals.
- 可辅助条件：Attack AND Projectile
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Cooldown OR ComboStacking OR (HasSeals AND NOT SupportedBySalvo)
- 赋予类型：HasSeals, SupportedBySalvo
- 数值：Supported Skills gain a Seal every 1000 second；Supported Skills fire 1 additional Projectile per Seal broken；Supported Skills have a maximum of 6 Seal


### Adhesive Grenades

**Adhesive Grenades I** · Tier 2 · 需求 0/100/0 · 标签 `Grenade`
- 效果：Supports Grenade Skills. Grenades from Supported Skills do not bounce, instead halting movement where they intially land, but doing lower damage when they detonate.
- 可辅助条件：Grenade
- 数值：Supported Grenade Skills deal -10% more Damage

**Adhesive Grenades II** · Tier 3 · 需求 0/100/0 · 标签 `Grenade`
- 效果：Supports Grenade Skills. Grenades from Supported Skills do not bounce, instead halting movement where they intially land.
- 可辅助条件：Grenade


### Admixture

**Admixture** · Tier 2 · 需求 0/100/0 · 标签 `Physical, Chaos`
- 效果：Supports Skills which can cause Damaging Hits. Bleeding inflicted by those Hits is more effective against Poisoned Enemies, and Poison inflicted by Supported Skills is more effective against Bleeding Enemies.
- 可辅助条件：Attack OR Damage OR CrossbowSkill
- 禁止条件：DegenOnlySpellDamage
- 数值：20% more Magnitude of Poison inflicted by Supported Skills against Bleeding Enemies；20% more Magnitude of Bleeding inflicted by Supported Skills against Poisoned Enemies


### Advancing Storm

**Advancing Storm** · Tier 4 · 需求 0/0/100 · 标签 `Storm`
- 效果：Supports Storm skills, causing them to appear at the user's location and move towards the target location.
- 可辅助条件：Storm
- 数值：`support_storm_base_movement_speed` = 25


### Advancing Storm, Overabundance

**Morgana's Tempest** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Storm`
- 效果：Supports Storm skills, increasing their Limit and causing them to move quickly from the user to the target location, but become less effective. Cannot Support Triggered Skills.
- 可辅助条件：Storm
- 数值：`support_storm_base_movement_speed` = 25；`support_approaching_storms_movement_speed_+%_final` = 60；`support_approaching_storms_area_of_effect_+%_final` = -25；`support_approaching_storms_damage_+%_final` = -35；Supported Storm Skills have +1 to Limit


### Aftershock

**Aftershock I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, giving them a chance to create an Aftershock.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported skills have 25% chance to cause an additional Aftershock

**Aftershock II** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, giving them a chance to create an Aftershock.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported skills have 35% chance to cause an additional Aftershock

**Tectonic Slams** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, causing them to create simultaneous Aftershocks behind the Slam, but lowering Aftershock damage and area of effect with Supported Skills. Cannot Support Skills which create Fissures.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR CreatesFissure
- 数值：Supported Skills cause 1 additional Aftershock ahead and to each side of the initial area；Supported Skills deal -45% more damage with Aftershocks；Supported Skills have -30% more Aftershock area of effect；Supported Skills have -15% more Attack Speed


### Ailith's Chimes

**Ailith's Chimes** · Tier 0 · 需求 0/100/0 · 标签 `Lineage`
- 效果：Supports Skills which can expend Combo. On expending Combo with Supported Skills, you have a chance to gain Power Charges based on the amount of Combo expended.
- 可辅助条件：ComboStacking
- 赋予类型：GeneratesCharges
- 数值：25% Surpassing chance to gain a Power Charge when expending Combo with Supported Skills per Combo expended


### Alignment

**Alignment I** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow Attacks. Supported Skills indicate one of four directions, changing indicated direction when an Attack with Supported Skill matches that direction. Attacks from Supported Skills which match the indicated direction deal much more Damage. Cannot Support Channelled Skills.
- 可辅助条件：Attack AND Bow
- 禁止条件：Channel
- 数值：Supported Skills deal 30% more Projectile Damage when Attacking in indicated direction；`called_shot_aiming_delay_ms` = 1000；`called_shot_angle_allowance_degs` = 40

**Alignment II** · Tier 4 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow Attacks. Supported Skills indicate one of four directions, changing indicated direction when an Attack with Supported Skill matches that direction. Attacks from Supported Skills which match the indicated direction deal much more Damage. Cannot Support Channelled Skills.
- 可辅助条件：Attack AND Bow
- 禁止条件：Channel
- 数值：Supported Skills deal 40% more Projectile Damage when Attacking in indicated direction；`called_shot_aiming_delay_ms` = 1000；`called_shot_angle_allowance_degs` = 40


### Alignment, Additional Projectiles

**Alignment III** · Tier 5 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow Attacks. Supported Skills indicate one of four directions, changing indicated direction when an Attack with Supported Skill matches that direction. Attacks from Supported Skills which match the indicated direction fire additional Projectiles. Cannot Support Channelled Skills.
- 可辅助条件：Attack AND Bow
- 禁止条件：Channel
- 数值：`called_shot_aiming_delay_ms` = 1000；`called_shot_angle_allowance_degs` = 40；Supported Skills fire 4 additional Projectiles when Attacking in indicated direction


### Amanamu's Tithe

**Amanamu's Tithe** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Minion, Persistent`
- 效果：Supports Persistent Minion Skills, granting a chance when Supported Minions die for you to gain an Abyssal Monster Modifier.
- 可辅助条件：Persistent AND Minion
- 数值：50% chance to gain an Abyssal Monster Modifier for 20 seconds when a Minion from Supported Skills dies Maximum 3 Abyssal Monster Modifiers gained this way


### Ambrosia

**Ambrosia** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills you use yourself which damage enemies with Hits. Supported Skills consume a percentage of your maximum Mana Flask charges, Gaining a percentage of damage as extra Lightning damage per Mana Flask charge consumed.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills consume #% of your maximum Mana Flask charges on use Supported Skills Gain 14% of Damage as extra Lightning Damage per Mana Flask charge consumed；Supported Skills consume #% of your maximum Mana Flask charges on use Supported Skills Gain 2% of Damage as extra Lightning Damage per Mana Flask charge consumed

**Ambrosia II** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills you use yourself which damage enemies with Hits. Supported Skills consume a percentage of your maximum Mana Flask charges, Gaining a percentage of damage as extra Lightning damage per Mana Flask charge consumed.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills consume #% of your maximum Mana Flask charges on use Supported Skills Gain 35% of Damage as extra Lightning Damage per Mana Flask charge consumed；Supported Skills consume #% of your maximum Mana Flask charges on use Supported Skills Gain 1% of Damage as extra Lightning Damage per Mana Flask charge consumed


### Ambush

**Ambush** · Tier 1 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill that Hits enemies, making it more likely to Critically Hit enemies on full life.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skill has 100% more Critical Hit Chance against Enemies that are on Full Life


### Ammo Conservation

**Ammo Conservation I** · Tier 2 · 需求 0/100/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, granting a chance to not consume a Bolt when firing.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Bolts fired by Supported Crossbow Attacks have 20% chance to not expend Ammunition

**Ammo Conservation II** · Tier 4 · 需求 0/100/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, granting a chance to not consume a Bolt when firing.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Bolts fired by Supported Crossbow Attacks have 25% chance to not expend Ammunition

**Ammo Conservation III** · Tier 5 · 需求 0/100/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, granting a chance to not consume a Bolt when firing, at the cost of Reload speed.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Bolts fired by Supported Crossbow Attacks have 30% chance to not expend Ammunition；Supported Skills have -20% more Reload speed

**Arjun's Medal** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Ammunition, Projectile`
- 效果：Supports Crossbow Skills, causing them to load a bolt into all Crossbow Ammunition on kill.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：25% chance to load a bolt into all Crossbow skills on dealing a Killing Blow with Supported Skill


### Ancestral Call

**Ancestral Aid** · Tier 0 · 需求 100/0/0 · 标签 `Attack, Melee, Strike, Conditional`
- 效果：Supports Strikes you use yourself. Supported Skills cannot be used until you have Blocked a certain number of Hits, but will be Ancestrally Boosted when used. After use, this Blocked Hit counter will reset. Cannot Support Channelled Skills or Skills which already have a Condition for use.
- 可辅助条件：MeleeSingleTarget
- 禁止条件：(HasUsageCondition AND NOT SupportedByAncestralAid) OR CannotSpiritStrike OR Channel OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：HasUsageCondition, SupportedByAncestralAid
- 数值：Supported Skills cannot be used until you have Blocked 3 Hits

**Ancestral Call I** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes you use yourself, providing a powerful Ancestral Boost every few seconds. Cannot Support Channelled Skills and does not modify Skills used by Minions.
- 可辅助条件：MeleeSingleTarget OR SpecialAncestralBoost
- 禁止条件：CannotSpiritStrike OR Channel OR UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills are Ancestrally Boosted once every 5000 second

**Ancestral Call II** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes you use yourself, providing a powerful Ancestral Boost every few seconds. Cannot Support Channelled Skills and does not modify Skills used by Minions.
- 可辅助条件：MeleeSingleTarget OR SpecialAncestralBoost
- 禁止条件：CannotSpiritStrike OR Channel OR UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills are Ancestrally Boosted once every 3000 second


### Arakaali's Lust

**Arakaali's Lust** · Tier 0 · 需求 0/100/0 · 标签 `Lineage`
- 效果：Supports any Skill that Hits Enemies, causing it to deal increasingly higher damage the more Poisons are on the target.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Supported Skills deal 8% more Damage with Hits for each Poison on the Enemy, up to #%；Supported Skills deal 40% more Damage with Hits for each Poison on the Enemy, up to #%


### Arbiter's Ignition

**Arbiter's Ignition** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, Fire`
- 效果：Supports Fire Spell Skills causing you to gain Elemental Archon when Igniting with them.
- 可辅助条件：Spell AND Damage
- 数值：`gain_archon_elemental_when_you_ignite_enemy_chance_%` = 100


### Arbiter's Reach

**Arbiter's Reach** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Buff, Persistent, Duration`
- 效果：Supports Persistent Buff Skills, causing you periodically grant Guard to allies in your Presence while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 赋予类型：Duration
- 数值：Allies in your Presence gain Guard equal to 10% of your maximum Life for 4000 seconds, every 6 seconds while a Supported Skill is active


### Arcane Surge

**Arcane Surge** · Tier 1 · 需求 0/0/100 · 标签 `Spell, Duration`
- 效果：Supports Spells you cast yourself, tracking the mana you spend to cast them. Spending enough mana grants a burst of Mana Regeneration and Cast Speed.
- 可辅助条件：Spell
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR (HasReservation AND NOT ReservationBecomesCost)
- 赋予类型：Duration
- 数值：Gain Arcane Surge for # second after Spending a total of 10000% of your Maximum Mana on Supported Skills；Gain Arcane Surge for # second after Spending a total of 100% of your Maximum Mana on Supported Skills


### Armour Break

**Armour Break I** · Tier 2 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports Skills that Hit Enemies, causing those Hits to Break Armour based on a portion of Physical Damage dealt.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Break Armour equal to 15% of Physical Damage dealt by Supported Skill

**Armour Break II** · Tier 3 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports Skills that Hit Enemies, causing those Hits to Break Armour based on a portion of Physical Damage dealt. On Fully Breaking Armour with Supported Skills, you have a chance to gain an Endurance Charge.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Break Armour equal to 15% of Physical Damage dealt by Supported Skill；15% chance to gain an Endurance Charge when Supported Skills Fully Break Armour

**Armour Break III** · Tier 4 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports Skills that Hit Enemies, causing those Hits to Break Armour based on a portion of Physical Damage dealt. On Fully Breaking Armour with Supported Skills, you have a chance to gain an Endurance Charge.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Break Armour equal to 20% of Physical Damage dealt by Supported Skill；20% chance to gain an Endurance Charge when Supported Skills Fully Break Armour

**Breachlord's Rift** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Lightning, Cold`
- 效果：Supports any skill that Hits enemies, causing it to Break Armour of enemies it Freezes or Electrocutes.
- 可辅助条件：（无限制）
- 数值：Supported Skills Break 50% of Armour when Freezing or Electrocuting targets

**Brittle Armour** · Tier 3 · 需求 0/0/100 · 标签 `Physical, Cold`
- 效果：Supports Skills which can Hit enemies. Hits with Supported Skills which Freeze enemies cause Physical damage against them to Break their Armour while they remain Frozen.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Hits against targets Frozen by Supported Skills Break Armour equal to 100% of Physical damage dealt

**Styrn's Ferocity** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Physical`
- 效果：Supports Shield Skills that Hit, causing those Hits to Crush their targets, and Physical Hits against those targets while Crushed to Break their Armour.
- 可辅助条件：(Attack OR Damage) AND RequiresShield
- 数值：Supported Skills Crush targets they Hit for 8000 seconds；Hits against targets Crushed by Supported Skills Break Armour equal to 10% of Physical damage dealt


### Armour Demolisher

**Armour Demolisher I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill, causing Armour Break it inflicts to be stronger.
- 可辅助条件：（无限制）
- 数值：Supported Skills Break 50% more Armour

**Armour Demolisher II** · Tier 3 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill, causing Armour Break it inflicts to be stronger.
- 可辅助条件：（无限制）
- 数值：Supported Skills Break 70% more Armour

**Uruk's Smelting** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Physical`
- 效果：Supports any skill, causing Armour Break it inflicts to be stronger. Fully Breaking Armour with Supported Skills permanently increases the Physical Damage taken by those affected, up to a cap.
- 可辅助条件：（无限制）
- 数值：Fully Breaking Armour with Supported Skills causes affected targets to permanently take 5% increased Physical Damage, up to 20%；Supported Skills Break 70% more Armour


### Armour Explosion

**Armour Explosion** · Tier 1 · 需求 100/0/0 · 标签 `Attack, Warcry, AoE, Trigger, Fire, Payoff`
- 效果：Supports Attacks and Warcries, causing them to trigger a Fiery explosion when they Fully Break an enemy's Armour.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Warcry


### Arms' Length

**Arms Length** · Tier 0 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which Hit Enemies, causing Knockback from those Hits to be significantly more effective.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：DegenOnlySpellDamage
- 数值：Supported Skills have 40% more Knockback Distance


### Astral Projection

**Astral Projection** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports Nova Skills, causing those Skills to take place at the targeted location when used instead of around you.
- 可辅助条件：Nova
- 数值：Supported Skills have -25% more Area of Effect


### Atziri's Allure

**Atziri's Allure** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Curse`
- 效果：Supports Curse Spells you cast yourself, causing those Curses to ignore the usual Curse Limit, but be reflected back to you when inflicted.
- 可辅助条件：AppliesCurse
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills have -20% more Curse Effect


### Atziri's Communion

**Atziri's Communion** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Persistent`
- 效果：Supports Persistent Skills, making them Reserve Life instead of Spirit. Cannot Support Skills which create Minions.
- 可辅助条件：Persistent
- 禁止条件：CreatesMinion
- 数值：Supported Skills Reserve a percentage of your maximum Life equal to 66% of base Spirit Reservation


### Auto Reload

**Auto Reload** · Tier 0 · 需求 100/0/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to automatically reload when they Heavy Stun an enemy.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill


### Barbs

**Barbs I** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Melee Strike Skills. After you Retaliate with Thorns Damage, you also deal your Thorns damage to enemies you Hit with Supported Skills.
- 可辅助条件：MeleeSingleTarget
- 数值：Deal your Thorns damage to the next enemy Hit by Supported Skills after you Retaliate with Thorns

**Barbs II** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Melee Strike Skills. After you Retaliate with Thorns Damage, you also deal your Thorns damage to enemies you Hit with Supported Skills.
- 可辅助条件：MeleeSingleTarget
- 数值：Deal your Thorns damage to the next enemy Hit by Supported Skills after you Retaliate with Thorns

**Barbs III** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Melee Strike Skills. After you Retaliate with Thorns Damage, you also deal your Thorns damage twice to enemies you Hit with Supported Skills.
- 可辅助条件：MeleeSingleTarget
- 数值：Deal your Thorns damage twice to the next enemy Hit by Supported Skills after you Retaliate with Thorns


### Battershout

**Battershout** · Tier 1 · 需求 100/0/0 · 标签 `Warcry, AoE, Trigger, Physical, Payoff`
- 效果：Supports Warcry Skills. Supported Skills Consume Fully Broken Armour to trigger Physical Damage explosions on Enemies within their range but cannot themselves Break Armour. 
- 可辅助条件：Warcry
- 禁止条件：ConsumesFullyBrokenArmour AND NOT SupportedByBattershout
- 赋予类型：ConsumesFullyBrokenArmour, SupportedByBattershout


### Behead

**Behead I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strike skills, causing them to steal a Modifier from Rare monsters they kill.
- 可辅助条件：MeleeSingleTarget
- 数值：Killing Blows from Supported Strike Skills against Rare monsters grant one of their Modifiers for 20000 seconds

**Behead II** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strike skills, causing them to steal two Modifiers from Rare monsters they kill.
- 可辅助条件：MeleeSingleTarget
- 数值：Killing Blows from Supported Strike Skills against Rare monsters grant two of their Modifiers for 20000 seconds

**Einhar's Beastrite** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Attack, Melee, Strike`
- 效果：Supports Melee Strike skills, causing them to steal a Modifier from Rare monsters they kill for a lengthy duration, while being unable to damage enemies not on low Life. Does not modify skills used by Minions.
- 可辅助条件：MeleeSingleTarget
- 数值：Killing Blows from Supported Strike Skills against Rare monsters grant two of their Modifiers for 300000 seconds


### Bidding

**Bidding I** · Tier 2 · 需求 0/0/100 · 标签 `Minion, Command`
- 效果：Supports Minion Skills. Supported Minions deal more damage and have increased Cooldown Recovery Rate with Command Skills.
- 可辅助条件：CommandableMinion OR CommandsMinions
- 数值：Supported Minions' Command Skills deal 20% more Damage；Supported Minions have 20% increased Cooldown Recovery Rate for Command Skills

**Bidding II** · Tier 4 · 需求 0/0/100 · 标签 `Minion, Command`
- 效果：Supports Minion Skills. Supported Minions deal more damage and have increased Cooldown Recovery Rate with Command Skills.
- 可辅助条件：CommandableMinion OR CommandsMinions
- 数值：Supported Minions' Command Skills deal 30% more Damage；Supported Minions have 30% increased Cooldown Recovery Rate for Command Skills

**Bidding III** · Tier 5 · 需求 0/0/100 · 标签 `Minion, Command`
- 效果：Supports Minion Skills. Supported Minions have significantly increased Cooldown Recovery Rate with Command Skills.
- 可辅助条件：CommandableMinion OR CommandsMinions
- 数值：Supported Minions have 80% increased Cooldown Recovery Rate for Command Skills


### Biting Frost

**Biting Frost I** · Tier 3 · 需求 0/0/100 · 标签 `Cold, Payoff`
- 效果：Supports any skill that Hits enemies, causing them to deal more damage to Frozen enemies but consume their Freeze. Cannot support skills that Consume Freeze.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：SkillConsumesFreeze AND NOT SupportedByBitingFrost
- 赋予类型：SkillConsumesFreeze, SupportedByBitingFrost
- 数值：Supported Skills Consume Freeze on enemies to deal 40% more Damage；Supported Skills deal 20% more damage to Frozen Unique enemies

**Biting Frost II** · Tier 5 · 需求 0/0/100 · 标签 `Cold, Payoff`
- 效果：Supports any skill that Hits enemies, causing them to deal more damage to Frozen enemies but consume their Freeze, leaving them Chilled. Cannot support skills that Consume Freeze.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：SkillConsumesFreeze AND NOT SupportedByBitingFrost
- 赋予类型：SkillConsumesFreeze, SupportedByBitingFrost
- 数值：Supported Skills Consume Freeze on enemies to deal 40% more Damage；Supported Skills deal 20% more damage to Frozen Unique enemies

**Morrigan's Insight** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Trigger, Cold, Duration, Payoff`
- 效果：Supports any skill that Hits enemies, causing them to deal more damage and trigger Nature's Exchange when consuming Freeze on enemies. Cannot support skills that Consume Freeze.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：SkillConsumesFreeze AND NOT SupportedByBitingFrost
- 赋予类型：SkillConsumesFreeze, SupportedByBitingFrost
- 数值：Supported Skills Consume Freeze on enemies to deal 50% more Damage


### Blackblood

**Kurgal's Leash** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Minion, Chaos`
- 效果：Supports Commandable Minions causing you and the Supported Minion to gain Unholy Might when you Command them.
- 可辅助条件：CommandsMinions OR CommandableMinion
- 数值：Gain Unholy Might for 15000 second on Commanding Minions from Supported Skills；Minions from Supported Skills gain Unholy Might for 15000 second when Commanded


### Blazing Critical

**Blazing Critical** · Tier 4 · 需求 0/0/100 · 标签 `Attack, Fire, Duration`
- 效果：Supports Skills you use yourself which Hit enemies. Critical Hits with Supported Skills imbue all of your Attacks with Fire damage for a duration.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Attacks Gain 15% of Damage as Fire Damage for # second on Critically Hitting with Supported Skills；Attacks Gain 5000% of Damage as Fire Damage for # second on Critically Hitting with Supported Skills


### Bleed

**Bleed I** · Tier 1 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, giving it a chance to inflict Bleeding.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have {}% chance to inflict Bleeding

**Bleed II** · Tier 3 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, giving it a chance to inflict Bleeding.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have {}% chance to inflict Bleeding

**Bleed III** · Tier 5 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, causing it to inflict Bleeding.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have {}% chance to inflict Bleeding

**Bleed IV** · Tier 5 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, causing it to deal more Melee Physical Damage to Bleeding Enemies, but be unable to inflict Bleeding itself. Supported Skills also inflict Incision on Hit.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Hits from Supported Skills inflict Incision；Supported Skills deal 30% more Melee Physical Damage against Bleeding enemies


### Blind

**Blind I** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing them to Blind on Hit.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% chance to Blind Enemies on Hit

**Blind II** · Tier 5 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing them to Blind on Hit with increased effect.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% chance to Blind Enemies on Hit；Blind inflicted with Supported Skills has 20% increased Effect


### Blindside

**Blindside** · Tier 1 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which can cause Damaging Hits. Supported Skills are more likely to Critically Hit Blinded Enemies, and deal more Damage with Critical Hits against Blinded Enemies, but cannot themselves inflict Blind.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：DegenOnlySpellDamage
- 数值：Supported Skills have 15% more Critical Damage Bonus with Hits against Blinded Enemies；Supported Skills have 15% more chance to Critically Hit Blinded Enemies


### Bloodlust

**Bloodlust** · Tier 0 · 需求 100/0/0 · 标签 `Attack, Melee, Physical`
- 效果：Supports Melee Attacks, causing them to deal more damage against Bleeding enemies, but preventing them from inflicting Bleeding.
- 可辅助条件：Melee
- 数值：Supported Skills deal 30% more Melee Physical Damage against Bleeding enemies


### Bone Shrapnel

**Bone Shrapnel** · Tier 2 · 需求 0/0/100 · 标签 `AoE, Trigger, Physical`
- 效果：Supports Skills which Hit Enemies. Supported Skills trigger Bone Shrapnel explosions when killing Pinned Enemies.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：SkillGrantedBySupport


### Boundless Energy

**Boundless Energy I** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports Meta Skills. Supported Skills generate Energy significantly faster.
- 可辅助条件：GeneratesEnergy
- 数值：Supported Skills gain 35% increased Energy

**Boundless Energy II** · Tier 4 · 需求 0/0/100 · 标签 ``
- 效果：Supports Meta Skills. Supported Skills generate Energy significantly faster.
- 可辅助条件：GeneratesEnergy
- 数值：Supported Skills gain 45% increased Energy


### Bounty

**Bounty I** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports any Skill that Hits Enemies, causing Enemies it kills to grant more Flask and Charm charges.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Enemies killed by Hits from Supported Skills grant 50% more Mana Flask Charges；Enemies killed by Hits from Supported Skills grant 50% more Life Flask Charges；Enemies killed by Hits from Supported Skills grant 50% more Charm charges

**Bounty II** · Tier 4 · 需求 0/100/0 · 标签 ``
- 效果：Supports any Skill that Hits Enemies, causing Enemies it kills to grant more Flask and Charm charges.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Enemies killed by Hits from Supported Skills grant 100% more Mana Flask Charges；Enemies killed by Hits from Supported Skills grant 100% more Life Flask Charges；Enemies killed by Hits from Supported Skills grant 100% more Charm charges

**Charm Bounty** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports any Skill that Hits Enemies, causing Enemies it kills to grant more Charm charges.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Enemies killed by Hits from Supported Skills grant 100% more Charm charges

**Life Bounty** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing enemies it kills to grant more Life Flask charges.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Enemies killed by Hits from Supported Skills grant 100% more Life Flask Charges

**Mana Bounty** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing enemies it kills to grant more Mana Flask charges.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Enemies killed by Hits from Supported Skills grant 100% more Mana Flask Charges


### Brambleslam

**Brambleslam** · Tier 5 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Slam, Trigger, Physical, Hazard, Plant`
- 效果：Supports Slam Skills, making them Trigger Brambles to create Hazardous brambles which damage and Maim enemies. Does not modify Skills used by Minions or Totems.
- 可辅助条件：Slam
- 禁止条件：UsedByTotem
- 数值：Supported Slams create 3 Brambles


### Breachlord

**Esh's Radiance** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Lightning, Chaos`
- 效果：Supports Skills that can cause Damaging Hits, granting extra Chaos damage and causing Chaos damage to Contribute to Shock.
- 可辅助条件：Damage OR Attack
- 数值：Supported Skills Gain 40% of Lightning Damage as Extra Chaos Damage

**Tul's Stillness** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Cold, Chaos`
- 效果：Supports Skills that can cause Damaging Hits, granting extra Chaos damage and causing Chaos damage to Contribute to Freeze Buildup.
- 可辅助条件：Damage OR Attack
- 数值：Supported Skills Gain 40% of Cold Damage as Extra Chaos Damage

**Uul-Netol's Embrace** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Physical, Chaos`
- 效果：Supports Skills that can cause Damaging Hits, granting extra Chaos damage and causing Chaos damage to Break Armour.
- 可辅助条件：Damage OR Attack
- 数值：Supported Skills Gain 40% of Physical Damage as Extra Chaos Damage；Break Armour equal to 20% of Chaos Damage dealt by Supported Skills

**Xoph's Pyre** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Fire, Chaos`
- 效果：Supports Skills that can cause Damaging Hits, granting extra Chaos damage and causing Chaos damage to Contribute to Ignites.
- 可辅助条件：Damage OR Attack
- 数值：Supported Skills Gain 40% of Fire Damage as Extra Chaos Damage


### Brink

**Brink I** · Tier 1 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills. Supported Skills build up Heavy Stun more quickly, but cannot themselves Heavy Stun.
- 可辅助条件：Melee
- 数值：Hits with Supported Skills cause 30% more Stun buildup

**Brink II** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills. Supported Skills build up Stun more quickly, but cannot themselves Stun.
- 可辅助条件：Melee
- 数值：Hits with Supported Skills cause 50% more Stun buildup


### Brutality

**Brutality I** · Tier 1 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that deals damage, boosting its Physical damage at the expense of all other Damage Types.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills deal 25% more Physical Damage

**Brutality II** · Tier 2 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that deals damage, boosting its Physical damage at the expense of all other Damage Types.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more Physical Damage

**Brutality III** · Tier 5 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that deals damage, boosting its Physical damage at the expense of all other Damage Types, as well as giving Hits from that skill a chance to ignore Physical Damage reduction.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more Physical Damage；Hits with Supported Skills have 20% chance to ignore Enemy Physical Damage reduction


### Burgeon

**Burgeon I** · Tier 1 · 需求 0/0/100 · 标签 `Channelling`
- 效果：Supports Channelling Skills you use yourself, causing them to deal more damage the longer they have been Channelled.
- 可辅助条件：Channel
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills deal 10% more Damage per second spent Channelling, up to #%；Supported Skills deal 40% more Damage per second spent Channelling, up to #%

**Burgeon II** · Tier 4 · 需求 0/0/100 · 标签 `Channelling`
- 效果：Supports Channelling Skills you use yourself, causing them to deal more damage the longer they have been Channelled.
- 可辅助条件：Channel
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills deal 20% more Damage per second spent Channelling, up to #%；Supported Skills deal 40% more Damage per second spent Channelling, up to #%


### Burning Inscription

**Burning Inscription** · Tier 4 · 需求 0/0/100 · 标签 `AoE, Trigger, Fire`
- 效果：Supports any Skill which creates Runic Inscriptions when Cast, causing those Runic Inscriptions to trigger Burning Inscription when they expire. Burning Inscription is a Spell which creates Ignited Ground based off of your Maximum Mana.
- 可辅助条件：AppliesCurse OR CreatesGroundRune


### Bursting Plague

**Bursting Plague** · Tier 2 · 需求 0/100/0 · 标签 `AoE, Trigger, Physical, Chaos`
- 效果：Supports skills that can Poison enemies, causing Poisoned enemies to gain Plague over time and explode in a Plague Burst on death. Cannot support the skills of Minions.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Poison from Supported Skills also adds 100% of Damage per Second to Enemy as Plague, up to a maximum of #% of Enemy's maximum Life；Poison from Supported Skills also adds 20% of Damage per Second to Enemy as Plague, up to a maximum of #% of Enemy's maximum Life


### Cadence

**Cadence** · Tier 2 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks you use yourself. Supported Skills gain more Attack speed each time you use them, but will become unusable if used too frequently in a short time frame. Sustained Skills will instead gain Attack speed periodically while being used.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR NoAttackOrCastTime
- 数值：Supported Skills have 8% more Attack speed for each time they've been used Recently；Supported Skills are unusable for # second after being used 6 or more times within four seconds；Supported Skills are unusable for # second after being used 10000 or more times within four seconds


### Caltrops

**Caltrops** · Tier 3 · 需求 0/100/0 · 标签 `Attack, AoE, Projectile, Trigger, Duration, Hazard`
- 效果：Supports Ranged Spear Attacks. Supported Skills create Caltrops when Projectiles they create reach the end of their flight.
- 可辅助条件：Spear AND RangedAttack
- 禁止条件：SkillGrantedBySupport


### Cannibalism

**Cannibalism I** · Tier 3 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to recover Life on kill while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：2% of maximum Life recovered on kill while a Supported Skill is active

**Cannibalism II** · Tier 4 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to recover Life on kill while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：3% of maximum Life recovered on kill while a Supported Skill is active


### Catharsis

**Catharsis** · Tier 2 · 需求 0/0/100 · 标签 `Physical, Chaos, Conditional`
- 效果：Supports any Skill you use yourself, causing supported Skill to detonate Volatility that is present on you. Supported Skill can only be used while you have a certain amount of Volatility and cannot support Skills which already have another Condition.
- 可辅助条件：（无限制）
- 禁止条件：(HasUsageCondition AND NOT SupportedByCleanse) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：HasUsageCondition, SupportedByCleanse
- 数值：Supported Skill requires 20 Volatility on you to use


### Chain

**Chain I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile, Chaining`
- 效果：Supports Projectile skills and any other skills that Chain, causing them to Chain additional times.
- 可辅助条件：Chains OR Projectile
- 禁止条件：CannotChain OR ProjectileNoCollision
- 数值：Supported Skills Chain {0:+d} times；Supported Skills deal -30% more Damage with Hits

**Chain II** · Tier 2 · 需求 0/100/0 · 标签 `Projectile, Chaining`
- 效果：Supports Projectile skills and any other skills that Chain, causing them to Chain additional times.
- 可辅助条件：Chains OR Projectile
- 禁止条件：CannotChain OR ProjectileNoCollision
- 数值：Supported Skills Chain {0:+d} times；Supported Skills deal -50% more Damage with Hits

**Chain III** · Tier 5 · 需求 0/100/0 · 标签 `Projectile, Chaining`
- 效果：Supports Projectile skills and any other skills that Chain, causing them to Chain additional times.
- 可辅助条件：Chains OR Projectile
- 禁止条件：CannotChain OR ProjectileNoCollision
- 数值：Supported Skills Chain {0:+d} times；Supported Skills deal -40% more Damage with Hits


### Chaos Attunement

**Chaos Attunement** · Tier 3 · 需求 0/0/100 · 标签 `Chaos`
- 效果：Supports any skill that deals damage, causing them to Gain Chaos Damage but deal less Damage of other Types.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage
- 数值：Supported Skills Gain 25% of Damage as extra Chaos Damage；Supported Skills deal -50% more non-Chaos Damage


### Chaotic Freeze

**Chaotic Freeze** · Tier 3 · 需求 0/0/100 · 标签 `Spell, Chaos`
- 效果：Supports Spells that deal non-Ailment Chaos damage over time. Enemies taking damage over time from Debuffs caused by supported skills will suffer Freeze build up from Chaos damage Hits from any source. Does not Support Skills used by Minions.
- 可辅助条件：Spell AND (DamageOverTime AND Chaos)


### Charge Profusion

**Charge Profusion I** · Tier 1 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills that can generate Charges, giving them a chance to generate an additional Charge when they do so.
- 可辅助条件：GeneratesCharges
- 数值：Supported Skills have 30% chance to grant an additional Charge

**Charge Profusion II** · Tier 5 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills that can generate Charges, giving them a chance to generate an additional Charge when they do so, as well as a chance to generate an additional Charge of a random type.
- 可辅助条件：GeneratesCharges
- 数值：Supported Skills have 30% chance to grant an additional Charge；Supported Skills have 15% chance to grant an additional random Charge


### Charged Mark

**Charged Mark** · Tier 5 · 需求 0/100/0 · 标签 `Spell, AoE, Trigger, Mark, Duration`
- 效果：Supports Mark Skills, causing them to Trigger Charged Mark when they are Activated. Charged Mark creates Shocked Ground at the target's location.
- 可辅助条件：Mark


### Charged Shots

**Charged Shots I** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow Attacks. Every third shot with Supported Skills restores a portion of its Mana cost and Gains Damage as extra Lightning Damage.
- 可辅助条件：Attack AND Bow
- 数值：Every shot with Supported Skills is a Charged Shot；Charged Shots with Supported Skills recover 100% of their Mana cost when used；Charged Shots with Supported Skills Gain 30% of Damage as extra Lightning Damage

**Charged Shots II** · Tier 5 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow Attacks. Every third shot with Supported Skills Gains Damage as extra Lightning Damage.
- 可辅助条件：Attack AND Bow
- 数值：Every shot with Supported Skills is a Charged Shot；Charged Shots with Supported Skills Gain 60% of Damage as extra Lightning Damage


### Clarity

**Clarity I** · Tier 1 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Mana Regeneration while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：30% Increased Mana Regeneration Rate while a Supported Skill is active

**Clarity II** · Tier 4 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Mana Regeneration while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：50% Increased Mana Regeneration Rate while a Supported Skill is active


### Clash

**Clash** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills. Supported Skills deal more Damage while you have a lower percentage of your Life remaining than the target struck, but less Damage when the reverse is true.
- 可辅助条件：Attack AND Melee
- 禁止条件：Minion OR UsedByTotem OR SummonsTotem
- 数值：Supported Skills deal 40% more Melee Damage against Enemies with a higher percentage of their Life remaining than you, and deal #% more Melee Damage against Enemies with a lower percentage of their Life remaining than you；Supported Skills deal -20% more Melee Damage against Enemies with a higher percentage of their Life remaining than you, and deal #% more Melee Damage against Enemies with a lower percentage of their Life remaining than you


### Close Combat

**Close Combat I** · Tier 3 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more damage to enemies based on how close they are to you.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 20% more Attack Damage to  enemies within 1 metre of you, scaling down to no bonus at 3.5 metres or further

**Close Combat II** · Tier 5 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more damage to enemies based on how close they are to you.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more Attack Damage to  enemies within 1 metre of you, scaling down to no bonus at 3.5 metres or further


### Cold Attunement

**Cold Attunement** · Tier 1 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports any skill that deals damage, causing them to Gain Cold Damage but deal less Fire and Lightning Damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage
- 数值：`non_skill_base_all_damage_%_to_gain_as_cold` = 25；Supported Skills deal -50% more Fire and Lightning Damage


### Cold Exposure

**Cold Exposure** · Tier 4 · 需求 0/0/100 · 标签 `Cold, Duration`
- 效果：Supports any skill that Hits enemies, causing it to inflict Exposure when it inflicts Freeze.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Supported Skills inflict Exposure for 8000 second on Critical Hit with Cold Damage


### Cold Penetration

**Cold Penetration** · Tier 2 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports any skill that Hits enemies, making those Hits Penetrate enemy Cold resistance.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills Penetrate 30% Cold Resistance


### Combo Finisher

**Combo Finisher I** · Tier 1 · 需求 0/100/0 · 标签 `Attack, Melee, Strike, Conditional`
- 效果：Supports Melee Attacks you use yourself. Supported Skills cannot be used until enough Combo has been built up, but deal more damage. Cannot support skills which already Combo.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Cooldown OR (HasUsageCondition AND NOT SupportedByComboFinisher)
- 赋予类型：ComboStacking, SupportedByComboFinisher, HasUsageCondition
- 数值：Supported Skills require 3 Combo to use；Supported Skills deal 25% more Damage；Supported Skills lose Combo if they generate no Combo for 4000 second

**Combo Finisher II** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Melee, Strike, Conditional`
- 效果：Supports Melee Attacks you use yourself. Supported Skills cannot be used until enough Combo has been built up, but deal massively more damage. Cannot support skills which already Combo.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Cooldown OR (HasUsageCondition AND NOT SupportedByComboFinisher)
- 赋予类型：ComboStacking, SupportedByComboFinisher, HasUsageCondition
- 数值：Supported Skills require 5 Combo to use；Supported Skills deal 40% more Damage；Supported Skills lose Combo if they generate no Combo for 4000 second


### Commandment

**Commandment** · Tier 0 · 需求 0/0/100 · 标签 `Minion, Command`
- 效果：Supports Minions which have Command Skills. Supported Minions have massively increased cooldown recovery speed for Command Skills they use, but deal no damage with non-Command Skills.
- 可辅助条件：CommandableMinion
- 数值：Supported Minions deal -100% more Damage with non-command Skills；Supported Minions have 100% increased Cooldown Recovery Rate for Command Skills


### Commiserate

**Commiserate** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills you use or Trigger yourself, which can cause Damaging Hits. Supported Skills inflict more powerful Ailments if you are afflicted with those Ailments when you inflict them, while also removing from you any Ailment that they inflict.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Persistent
- 数值：Ailments inflicted by Supported Skills have 40% more Magnitude if you are afflicted with that Ailment when inflicting it


### Compressed Duration

**Compressed Duration I** · Tier 1 · 需求 100/0/0 · 标签 `Duration`
- 效果：Supports any skill that has a duration making that duration shorter.
- 可辅助条件：Duration
- 数值：Supported Skills have -30% more Skill Effect Duration；Supported Skills deal 0% more Damage

**Compressed Duration II** · Tier 3 · 需求 100/0/0 · 标签 `Duration`
- 效果：Supports any skill that has a duration making that duration shorter.
- 可辅助条件：Duration
- 数值：Supported Skills have -35% more Skill Effect Duration；Supported Skills deal 0% more Damage


### Concentrated Area

**Concentrated Area** · Tier 1 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports any skill with an area of effect, causing that area to be smaller but any area damage it deals to be higher.
- 可辅助条件：Area OR MinionsCanExplode
- 数值：Supported Skills have -50% more Area of Effect；Supported Skills deal 30% more Area Damage


### Concoct

**Concoct I** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills you use yourself which Damage enemies with Hits. Supported Skills consume a percentage of your maximum Life Flask charges, inflicting more powerful Bleeding based on Life Flask charges consumed.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills consume #% of your maximum Life Flask charges on use Supported Skills have 20% more Magnitude of Bleeding they inflict per Life Flask charge consumed；Supported Skills consume #% of your maximum Life Flask charges on use Supported Skills have 3% more Magnitude of Bleeding they inflict per Life Flask charge consumed

**Concoct II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills you use yourself which Damage enemies with Hits. Supported Skills consume a percentage of your maximum Life Flask charges, inflicting more powerful Bleeding based on Life Flask charges consumed.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills consume #% of your maximum Life Flask charges on use Supported Skills have 30% more Magnitude of Bleeding they inflict per Life Flask charge consumed；Supported Skills consume #% of your maximum Life Flask charges on use Supported Skills have 3% more Magnitude of Bleeding they inflict per Life Flask charge consumed


### Concussive Runes

**Concussive Runes** · Tier 0 · 需求 0/0/0 · 标签 `Attack, AoE, Melee, Slam, Trigger`
- 效果：Supports Attacks, causing a Runic Shockwave to erupt under enemies they Heavy Stun. The Shockwave costs Runic Ward, and will not Trigger if you do not have enough Runic Ward.
- 可辅助条件：Attack OR CrossbowAmmoSkill


### Concussive Spells

**Concussive Spells** · Tier 4 · 需求 0/0/100 · 标签 `Spell, Physical`
- 效果：Supports Spells which Hit enemies. Supported Skills Daze on Critically Hitting enemies with Physical damage.
- 可辅助条件：Damage


### Considered Casting

**Considered Casting** · Tier 2 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spell Skills that Hit Enemies and you cast yourself, boosting Damage at the cost of Cast Speed.
- 可辅助条件：Spell
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR FixedCastTime OR (HasReservation AND NOT ReservationBecomesCost)
- 数值：Supported Spell Skills have -15% more Cast Speed；Supported Spells deal 35% more Damage


### Controlled Destruction

**Controlled Destruction** · Tier 1 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spells that Hit enemies, boosting their damage but preventing them from dealing Critical Hits.
- 可辅助条件：Damage AND Spell
- 数值：Supported Spells deal 25% more Hit Damage


### Cool Headed

**Cool Headed** · Tier 3 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing Ignite applied to you to last for a shorter duration while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：-50% more Ignite duration on you while a Supported Skill is active


### Cooldown Recovery

**Atziri's Impatience** · Tier 0 · 需求 0/100/0 · 标签 `Lineage`
- 效果：Supports Skills you use yourself that have Cooldowns, dramatically increasing the rate at which those Cooldowns Recover, but causing you to lose Life, Mana, and Energy Shield when they are used. Cannot Support Meta Skills or Persistent Skills, or modify the Skills of Minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 禁止条件：Triggered OR Meta OR UsedByProxy OR Persistent
- 数值：Supported Skills have 100% increased cooldown recovery rate；Lose 25% of maximum Life, Mana, and Energy Shield when you use Supported Skills

**Cooldown Recovery I** · Tier 3 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills with Cooldowns, increasing the rate at which those Cooldowns Recover. Cannot modify the skills of minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 数值：Supported Skills have 25% increased cooldown recovery rate

**Cooldown Recovery II** · Tier 4 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills with Cooldowns, increasing the rate at which those Cooldowns Recover. Cannot modify the skills of minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 数值：Supported Skills have 30% increased cooldown recovery rate


### Corpse Conservation

**Corpse Conservation** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports skills that consume Corpses, giving them a chance to take effect without destroying the Corpse.
- 可辅助条件：TargetsDestructibleCorpses OR TargetsDestructibleRareCorpses
- 数值：Corpses consumed by Supported Skills have 25% chance to not be destroyed


### Corrosion

**Corrosion** · Tier 1 · 需求 0/100/0 · 标签 `Physical, Chaos`
- 效果：Supports any skill that Hits enemies, causing Poison it applies to also Break enemy Armour. Cannot support skills that Consume Fully Broken Armour.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：ConsumesFullyBrokenArmour
- 数值：Poison applied by supported Skills also Breaks Armour equal to 80% of Poison damage


### Corrupting Cry

**Corrupting Cry I** · Tier 3 · 需求 100/0/0 · 标签 `Warcry, Trigger, Physical, Duration`
- 效果：Supports Warcries, Triggering Corrupted Cry to inflict Corrupted Blood on enemies in their area of effect.
- 可辅助条件：Warcry
- 赋予类型：DamageOverTime, Duration
- 数值：Supported Warcries have -30% more Area of Effect

**Corrupting Cry II** · Tier 5 · 需求 100/0/0 · 标签 `Warcry, Trigger, Physical, Duration`
- 效果：Supports Warcries, Triggering Corrupted Cry to inflict Corrupted Blood on enemies in their area of effect.
- 可辅助条件：Warcry
- 赋予类型：DamageOverTime, Duration

**Paquate's Pact** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Warcry, Trigger, Physical, Duration`
- 效果：Supports Warcries, Triggering Twisted Pact  to inflict Corrupted Blood on enemies in their area of effect., at the cost of your Life.
- 可辅助条件：Warcry
- 赋予类型：DamageOverTime, Duration
- 数值：Supported Skills Cost 10% of maximum Life for each time they have been used or Triggered Recently, up to a maximum of 30%


### Coursing Current

**Coursing Current** · Tier 1 · 需求 0/0/100 · 标签 `Spell, Projectile, Trigger, Lightning, Chaining`
- 效果：Supports Skills which Hit enemies. Shocking an enemy with Supported Skills Triggers Coursing Current, which sends Chaining Lightning Projectiles to nearby Drenched enemies.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：100% chance to Trigger Coursing Current when a Hit from Supported Skills Shocks


### Crackling Barrier

**Crackling Barrier** · Tier 2 · 需求 0/0/100 · 标签 `Lightning, Channelling`
- 效果：Supports Channelling Skills. While Channelling Supported Skills, you gain Lightning Thorns based off of your maximum Mana.
- 可辅助条件：Channel
- 禁止条件：Minion OR UsedByTotem
- 数值：Gain 15% of your maximum Mana as Lightning Thorns Damage while Channelling Supported Skills


### Crater

**Crater** · Tier 2 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Trigger, Fire, Duration`
- 效果：Supports Melee Skills that leap into the air, causing them to create Fissures when you land. Cannot Support Totem Skills, and does not modify Skills used by Minions.
- 可辅助条件：Melee AND Jumping
- 禁止条件：UsedByTotem OR SummonsTotem
- 赋予类型：CreatesFissure
- 数值：Supported Skills create 3 Fissure on landing


### Crazed Minions

**Crazed Minions** · Tier 4 · 需求 0/0/100 · 标签 `Minion, Persistent`
- 效果：Supports Minion Skills which summon Reviving Minions. Supported Minions deal significantly more Damage if they have Revived Recently.
- 可辅助条件：Minion AND Persistent
- 禁止条件：MinionsAreUndamagable
- 数值：Supported Minions deal 30% more Damage if they have Revived Recently


### Creeping Chill

**Creeping Chill** · Tier 1 · 需求 0/0/100 · 标签 `AoE, Trigger, Cold`
- 效果：Supports any Skill that creates Ice Crystals, causing that Skill to Consume a Power Charge if possible to create Chilled Ground around the Crystal.
- 可辅助条件：IceCrystal
- 禁止条件：SkillConsumesPowerChargesOnUse AND NOT SupportedByCreepingChill
- 赋予类型：ConsumesCharges, SkillConsumesPowerChargesOnUse, SupportedByCreepingChill
- 数值：Consume a Power Charge to Trigger Creeping Chill on an Ice Crystal created by Supported Skills


### Crescendo

**Crescendo I** · Tier 1 · 需求 0/0/100 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes that perform a Final Strike at the end of a combination of attacks, allowing you to use the Final Strike twice in succession.
- 可辅助条件：PerformsFinalStrike

**Crescendo II** · Tier 4 · 需求 0/0/100 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes that perform a Final Strike at the end of a combination of attacks, allowing you to use the Final Strike twice in succession, and causing Non-Final Strike Attacks to be faster.
- 可辅助条件：PerformsFinalStrike
- 数值：Attacks with Supported Skills that are not Final Strikes have 15% more Attack Speed

**Crescendo III** · Tier 5 · 需求 0/0/100 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes that perform a Final Strike at the end of a combination of attacks, causing the Final Strike to be Ancestrally Boosted.
- 可辅助条件：PerformsFinalStrike


### Crystalline Shards

**Crystalline Shards** · Tier 1 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills which create Ice Crystals. Damaging Explosions caused by Ice Crystals from Supported Skills will Impale Enemies.
- 可辅助条件：IceCrystal
- 数值：Ice Crystals created by Supported Skills have 100% chance to Impale


### Culling Strike

**Culling Strike I** · Tier 4 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attack Skills, causing them to Cull Rare and Unique Enemies on Hit.
- 可辅助条件：Attack OR CrossbowAmmoSkill

**Culling Strike II** · Tier 5 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attack Skills, causing them to Cull Rare and Unique Enemies on Hit, and increasing the threshold at which they will Cull Enemies.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Gain 20% increased Culling Strike Threshold for 20 seconds on Culling with Supported Skills


### Culmination

**Culmination I** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Melee, Conditional`
- 效果：Supports Melee Attack Skills. Supported Skills gain Combo when you successfully Strike Enemies with other Melee Attacks. Supported Skills reset their Combo on use, dealing more Damage the higher Combo you had on use. Cannot support skills which already gain Combo. Cannot modify the Skills of Minions.
- 可辅助条件：Attack AND Melee
- 禁止条件：HasUsageCondition AND NOT SupportedByComboMastery
- 赋予类型：ComboStacking, SupportedByComboMastery, HasUsageCondition
- 数值：Supported Skills deal 3% more Damage per Combo expended；Supported Skills lose Combo if they generate no Combo for 4000 second；Supported Skills can gain up to 10 Combo Supported Skills expend all Combo on use

**Culmination II** · Tier 5 · 需求 0/100/0 · 标签 `Attack, Melee, Conditional`
- 效果：Supports Melee Attack Skills. Supported Skills gain Combo when you successfully Strike Enemies with other Melee Attacks. Supported Skills reset their Combo on use, dealing more Damage the higher Combo you had on use. Cannot support skills which already gain Combo. Cannot modify the Skills of Minions.
- 可辅助条件：Attack AND Melee
- 禁止条件：HasUsageCondition AND NOT SupportedByComboMastery
- 赋予类型：ComboStacking, SupportedByComboMastery, HasUsageCondition
- 数值：Supported Skills deal 4% more Damage per Combo expended；Supported Skills lose Combo if they generate no Combo for 6000 second；Supported Skills can gain up to 10 Combo Supported Skills expend all Combo on use


### Cursed Ground

**Cursed Ground** · Tier 3 · 需求 0/0/100 · 标签 `Curse`
- 效果：Supports Curse Skills. Supported Curse Skills create areas which Curse Enemies so long as they are within them.
- 可辅助条件：AppliesCurse
- 赋予类型：Limit
- 数值：Limit 2 area of Cursed Ground

**Doedre's Undoing** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, AoE, Trigger, Chaos, Curse`
- 效果：Supports Curse Skills. Supported Skills create an area which Curses Enemies within it, and spawns Witchtoads in that area. Witchtoads leap at enemies that get close, and seek out Cursed enemies with higher aggression. Dark Consequences will be Triggered when they hit enemies with their leap, violently exploding the Witchtoad.
- 可辅助条件：AppliesCurse
- 赋予类型：Limit
- 数值：Limit 2 area of Cursed Ground；Each Cursed Ground area from Supported Skills spawns a Witchtoad every 4 second, up to a Limit of #；Each Cursed Ground area from Supported Skills spawns a Witchtoad every 250 second, up to a Limit of #

**Hayoxi's Fulmination** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, AoE, Trigger, Physical, Lightning, Cold, Fire, Chaos, Curse`
- 效果：Supports Curse Skills, giving them a short cooldown but causing them to create areas which Curse enemies so long as they are within them. Cursed areas from Supported Skills gather power before erupting in a column of annihilating light after a moderate delay.
- 可辅助条件：AppliesCurse
- 禁止条件：(Cooldown AND NOT SupportedByHayoxi) OR SummonsTotem OR UsedByTotem OR Trapped OR RemoteMined OR Vaal OR Channel OR Attack OR Triggered
- 赋予类型：Cooldown, SupportedByHayoxi, Limit
- 数值：Limit 2 area of Cursed Ground；Trigger Annihilation when Cursed Ground from Supported Skills have persisted for 7000 second


### Danse Macabre

**Danse Macabre** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports Offering Skills. Supported Skills have increased Buff effect and deal more damage, but will target an additional skeletal Minion when cast. If there is not an additional skeletal Minion to target, no damage or Buff effect will be granted.
- 可辅助条件：Offering
- 数值：Supported Offering Skills deal 30% more Damage；Supported Offering Skills have 30% increased Buff effect


### Daresso's Passion

**Daresso's Passion** · Tier 0 · 需求 100/0/0 · 标签 `Banner, Lineage`
- 效果：Supports Banner Skills, causing them to require significantly less Glory to use.
- 可辅助条件：Banner
- 数值：Supported Skills require -50% more Glory to use


### Dauntless

**Dauntless** · Tier 0 · 需求 100/0/0 · 标签 `Conditional`
- 效果：Supports Skills you use yourself which can cause Damaging Hits. Supported Skills cannot be used unless you have been stationary for a certain duration, but deal increasingly more damage the longer you are stationary. Cannot support Skills which have a cooldown or another usage Condition.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：(HasUsageCondition AND NOT SupportedByUnmoving) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：HasUsageCondition, SupportedByUnmoving
- 数值：Supported Skills cannot be used unless you have been stationary for 1500 second This timer resets when you move；Supported Skills deal 3% more Damage with Hits for each quarter second you have been stationary, up to #% This Damage bonus resets when you move；Supported Skills deal 45% more Damage with Hits for each quarter second you have been stationary, up to #% This Damage bonus resets when you move


### Deadly Heralds

**Deadly Herald** · Tier 3 · 需求 0/100/0 · 标签 `Herald`
- 效果：Supports Herald Skills, making their triggered effects deal more damage at the expense of higher Spirit cost.
- 可辅助条件：Herald
- 数值：`support_deadly_heralds_damage_+%_final` = 30


### Deadly Poison

**Deadly Poison I** · Tier 2 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, causing it to deal less damage but inflict more potent Poison.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skills deal -25% more Damage with Hits；75% more Magnitude of Poison inflicted with Supported Skills

**Deadly Poison II** · Tier 4 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, causing it to deal less damage but inflict more potent Poison.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skills deal -30% more Damage with Hits；100% more Magnitude of Poison inflicted with Supported Skills


### Deadly Resolve

**Deadly Resolve** · Tier 3 · 需求 100/0/0 · 标签 `Attack, AoE, Trigger, Physical, Channelling, Staged`
- 效果：Supports Channelling Skills you use yourself. While Channelling Supported Skills, periodically gain stages of Deadly Resolve. Expend a stage of Deadly Resolve when an enemy Hits you to Trigger a deadly slash towards that enemy, dealing more damage based on your Armour.
- 可辅助条件：Channel
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：3 maximum stages；Stage duration is 10000 second；Gain a stage every 1000 second；Can Trigger Deadly Resolve once every second


### Deathmarch

**Deathmarch** · Tier 2 · 需求 0/0/100 · 标签 `Minion, Persistent`
- 效果：Supports Skills which create Persistent Minions. Supported Minions will restore Life to nearby Allied Minions on death, as well as removing Ailments from those Minions.
- 可辅助条件：Minion AND Persistent
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills heal Allied Minions within # metres for 30% of Supported Minions' life on death, as well as removing all Ailments from those Minions；Minions from Supported Skills heal Allied Minions within # metres for 25% of Supported Minions' life on death, as well as removing all Ailments from those Minions


### Decaying Hex

**Decaying Hex** · Tier 3 · 需求 0/0/100 · 标签 `Spell, Trigger, Chaos, Duration, Curse`
- 效果：Supports Curse skills. Supported skill Trigger Profane Decay on each target they curse to inflict a damaging Debuff.
- 可辅助条件：AppliesCurse
- 赋予类型：Chaos, Damage, DamageOverTime


### Deep Cuts

**Deep Cuts I** · Tier 3 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, causing it to deal less damage but inflict more potent Bleeding.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skills deal -25% more Damage with Hits；75% more Magnitude of Bleeding inflicted with Supported Skills

**Deep Cuts II** · Tier 5 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, causing it to deal less damage but inflict more potent Bleeding.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skills deal -30% more Damage with Hits；100% more Magnitude of Bleeding inflicted with Supported Skills


### Deep Freeze

**Deep Freeze** · Tier 1 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports any skill that Hits enemies, causing Freeze it inflicts to last longer.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 50% increased Freeze Duration on Enemies


### Defy

**Defy I** · Tier 2 · 需求 100/0/0 · 标签 `Attack`
- 效果：Supports Attack Skills you use yourself. Hit Damage from Supported Skills is Lucky if you are Surrounded.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Triggered OR Persistent

**Defy II** · Tier 5 · 需求 100/0/0 · 标签 `Attack`
- 效果：Supports Attack Skills you use yourself. Hit Damage from Supported Skills is Lucky and Insufficient Mana doesn't prevent Supported Skills from being used if you are Surrounded.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Triggered OR Persistent


### Delayed Gratification

**Delayed Gratification** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which require some Condition to be met for use. Supported Skills can be used an additional time after their Condition has been met, but meeting that Condition is harder.
- 可辅助条件：HasUsageCondition
- 数值：Conditional requirements of Supported Skills are 150% harder to meet；Supported Conditional Skills can be used an additional time within # second of using them after meeting their requirements；Supported Conditional Skills can be used an additional time within # second of using them after meeting their requirements


### Delayed Reaction

**Controlled Hazard** · Tier 4 · 需求 0/100/0 · 标签 `Hazard`
- 效果：Supports Skills which create Hazards, causing those Hazards to be unable to be triggered for 3 seconds after being created.
- 可辅助条件：Hazard
- 数值：`hazards_cant_trigger_x_seconds_after_creation` = 3

**Delayed Reaction** · Tier 4 · 需求 0/100/0 · 标签 `Hazard`
- 效果：Supports Skills which create Hazards, causing those Hazards to only be able to trigger immediately after creation or at the end of their duration. Created Hazards have significantly lowered duration, and deal more damage.
- 可辅助条件：Hazard
- 数值：Hazards created by Supported Skills deal 15% more Damage；Hazards created by Supported Skills have -70% more duration


### Deliberation

**Deliberation** · Tier 3 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills that can be used while moving, causing you to move slower while using them, but granting more damage in exchange.
- 可辅助条件：UsableWhileMoving
- 数值：30% more Movement Speed penalty while using Supported Skills；Supported Skills deal 20% more Damage


### Derange

**Derange** · Tier 4 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills which you use yourself which can deal damage. Supported Skills gain an Energy Shield cost equal to your Intelligence, while also dealing more non-Ailment Damage over time based off of your Intelligence. Cannot support Channelling Skills.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR DegenOnlySpellDamage OR CrossbowAmmoSkill OR CrossbowSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Channel
- 数值：Supported Skills deal 8% more non-Ailment Damage over time per 100 Intelligence


### Dialla's Desire

**Dialla's Desire** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports any Skill which has levels, increasing the level and Quality, while reducing the cost and Reservation.
- 可辅助条件：（无限制）
- 数值：{0:+d} to Level of Supported Skill Gems；`supported_active_skill_gem_quality_%` = 5


### Direstrike

**Direstrike I** · Tier 2 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Attack Damage while on Low Life while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 50% increased Attack Damage while on Low Life while a Supported Skill is active

**Direstrike II** · Tier 4 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Attack Damage while on Low Life while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 70% increased Attack Damage while on Low Life while a Supported Skill is active


### Discombobulate

**Daze** · Tier 0 · 需求 0/100/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing them to build up Daze based on a portion of Physical Damage dealt.
- 可辅助条件：Attack OR CrossbowAmmoSkill


### Dominus' Grasp

**Dominus' Grasp** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Projectile, Chaining`
- 效果：Supports Projectile skills and any other skills that Chain, causing them to Chain more times.
- 可辅助条件：Chains OR Projectile
- 禁止条件：CannotChain OR ProjectileNoCollision
- 数值：Supported Skills Chain 100% more times


### Double Barrel

**Double Barrel I** · Tier 1 · 需求 100/0/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to load an extra bolt at the cost of reload speed.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Skills load an additional bolt；Supported Skills have 30% less Reload Speed

**Double Barrel II** · Tier 2 · 需求 100/0/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to load an extra bolt at the cost of reload speed.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Skills load an additional bolt；Supported Skills have 20% less Reload Speed

**Double Barrel III** · Tier 5 · 需求 100/0/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to load an extra bolt at the cost of reload speed. Supported Skills will also automatically reload when they Heavy Stun an enemy.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Skills load an additional bolt；Supported Skills have 20% less Reload Speed


### Double Barrel, Rapid Attacks

**Ratha's Assault** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to load multiple extra bolts and attack faster. Supported Skills cannot reload normally, instead loading bolts when you Dodge.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Skills load 4 bolt when you Dodge；Supported Skills load an additional bolt；Supported Skills have 10% increased Attack Speed


### Drain Ailments

**Drain Ailments** · Tier 3 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spells that deal non-Ailment damage over time, causing them to consume Ailments on enemies it applies damage over time Debuffs to in order to deal substantially more damage over time.
- 可辅助条件：Spell AND DamageOverTime
- 禁止条件：((((SkillConsumesFreeze OR SkillConsumesIgnite) OR SkillConsumesShock) OR SkillConsumesBleeding) OR SkillConsumesPoison) AND NOT SupportedByDrainedAilment
- 赋予类型：SkillConsumesFreeze, SkillConsumesIgnite, SkillConsumesShock, SkillConsumesBleeding, SkillConsumesPoison, SupportedByDrainedAilment
- 数值：Supported Skills Consume all Ailments of a random type on the target when inflicting damage over time Debuffs, causing the Debuff to deal 35% more damage if any Ailments were consumed


### Durability

**Durability** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which create objects that are destroyed after being Hit a number of times, allowing for them to last for additional Hits. Does not modify Skills used by Minions.
- 可辅助条件：ObjectDurability
- 数值：Objects created by Supported Skills can be Hit {0:+d} time


### Echoing Cry

**Echoing Cry** · Tier 4 · 需求 100/0/0 · 标签 `Warcry, AoE, Conditional`
- 效果：Supports Warcries. Supported Skills Echo twice, and their area grows larger each time, but are less effective and require you to have travelled a certain distance before use.
- 可辅助条件：Warcry
- 禁止条件：HasUsageCondition AND NOT SupportedByEchoingCry
- 赋予类型：HasUsageCondition, SupportedByEchoingCry
- 数值：Supported Skills Echo 1300 time, with a 0.5 second delay；Supported Skills Echo 2 time, with a 0.5 second delay；Supported Skills have -50% more Area of Effect；Supported Skills have 100% less area of effect per time they have Echoed；Supported Skills become usable after you have moved 100 metres Supported Skills become unusable again after use；Supported Skills count enemies as having -50% less Power；Supported Skills deal -40% more Damage


### Efficiency

**Efficiency I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill, making it cost less to use. Cannot support skills which reserve Spirit.
- 可辅助条件：（无限制）
- 禁止条件：Persistent
- 数值：Supported Skills have -30% more Cost

**Efficiency II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill, making it cost less to use. Cannot support skills which reserve Spirit.
- 可辅助条件：（无限制）
- 禁止条件：Persistent
- 数值：Supported Skills have -40% more Cost


### Electrocute

**Electrocute** · Tier 2 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any Skill which can deal Damage. Lightning Damage from Supported Skills can inflict Electrocute, but Supported Skills cannot inflict Shock.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill

**Eonyr's Thunder** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Spell, AoE, Trigger, Lightning`
- 效果：Supports any Skill which can deal damage. Lightning damage from Supported Skills can inflict Electrocute, but Supported Skills cannot inflict Shock. Enemies slain while Electrocuted by Supported Skills explode, dealing a percentage of their maximum Life as Lightning damage.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill

**Neural Overload** · Tier 3 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies. Nearby enemies are marked when they are Primed for Electrocution, and hitting a marked enemy with a supported skill will Electrocute them.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill


### Electromagnetism

**Electromagnetism** · Tier 3 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Sustained, Lightning, Payoff`
- 效果：Supports Skills that Hit enemies. When Supported Skills Shock an enemy that is nearby other Shocked enemies, trigger Electromagnetism, sucking in nearby enemies, Hindering them, and dealing Lightning damage at an interval.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：On Shocking an enemy where there is at least # Shocked enemy within 40 metre that are not already in a Shocking Rift, Supported Skills Consume Shock of all enemies within 40 metre to trigger Shocking Rift；On Shocking an enemy where there is at least # Shocked enemy within 3 metre that are not already in a Shocking Rift, Supported Skills Consume Shock of all enemies within 3 metre to trigger Shocking Rift


### Elemental Armament

**Elemental Armament I** · Tier 1 · 需求 100/0/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more Elemental damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 20% more Elemental Attack damage

**Elemental Armament II** · Tier 2 · 需求 100/0/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more Elemental damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 25% more Elemental Attack damage

**Elemental Armament III** · Tier 5 · 需求 100/0/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more Damage for each Elemental Ailment on Enemies they Hit. Supported Skills cannot themselves inflict Elemental Ailments.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 12% more Attack Damage for each Elemental Ailment on Enemies they Hit


### Elemental Army

**Elemental Army** · Tier 1 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports skills which create Minions, bolstering the Elemental Resistances of those Minions. Cannot support skills which create undamageable Minions.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills have {0:+d}% to all Elemental Resistances


### Elemental Discharge

**Catalysing Elements** · Tier 5 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Lightning, Cold, Fire`
- 效果：Supports Skills which are boosted by Elemental Ground Surfaces, Triggering Catalysing Discharge of the corresponding type when they are boosted by an allied Elemental Ground Surface.
- 可辅助条件：InteractsWithElementalGround

**Elemental Discharge** · Tier 3 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Lightning, Cold, Fire, Payoff`
- 效果：Supports any Spell that Hits enemies, causing it to Consume Elemental Ailments on hit to trigger an Elemental Discharge. Cannot support the skills of Minions or skills which already Consume Elemental Ailments.
- 可辅助条件：Spell AND Damage
- 禁止条件：((SkillConsumesFreeze OR SkillConsumesIgnite) OR SkillConsumesShock) AND NOT SupportedByElementalDischarge
- 赋予类型：SkillConsumesFreeze, SkillConsumesIgnite, SkillConsumesShock, SupportedByElementalDischarge


### Elemental Focus

**Elemental Focus** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to deal more Elemental Damage but be unable to inflict Elemental Ailments.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 25% more Elemental Damage


### Embitter

**Embitter** · Tier 2 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports Skills which can Damage Enemies with Hits, causing all sources of Damage Gained to instead be treated as Damage Gained as extra Cold for Supported Skills.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：DegenOnlySpellDamage


### Empowered Sparks

**Empowered Sparks I** · Tier 2 · 需求 0/0/100 · 标签 `Projectile, Trigger, Lightning, Duration`
- 效果：Supports Skills which generate Charges. When generating Power Charge with Supported Skills, Empower some of your Attacks to Trigger Spark Projectiles on use.
- 可辅助条件：GeneratesCharges


### Encroaching Ground

**Encroaching Ground** · Tier 2 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports Skills that create Ground Surfaces, causing those Surfaces to grow over time, up to a limit.
- 可辅助条件：CreatesGroundEffect
- 数值：Ground Surfaces created by Supported Skills gain 20% increased Area of Effect per second, up to a maximum of #%；Ground Surfaces created by Supported Skills gain 100% increased Area of Effect per second, up to a maximum of #%


### Encumbrance

**Slow Potency** · Tier 1 · 需求 0/100/0 · 标签 `Spell`
- 效果：Supports any skill, causing inflicted Slows to be more powerful.
- 可辅助条件：Damage OR Attack OR Spell OR DegenOnlySpellDamage OR CrossbowAmmoSkill
- 数值：Debuffs inflicted with Supported Skills have 15% increased Slow Magnitude


### Enduring Impact

**Enduring Impact I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, giving it a chance to gain an Endurance Charge when causing a Heavy Stun. 
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：30% chance to gain an Endurance Charge when Heavily Stunning a non-Unique Enemy with Supported Skills；Gain 1 Endurance Charge on Heavily Stunning a Unique Enemy with Supported Skill

**Enduring Impact II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, giving it a chance to gain an Endurance Charge when causing a Heavy Stun. 
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：30% chance to gain an Endurance Charge when Heavily Stunning a non-Unique Enemy with Supported Skills；Gain 3 Endurance Charge on Heavily Stunning a Unique Enemy with Supported Skill


### Energy Capacitor

**Energy Capacitor** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports Invocation Skills which Trigger other Skills. Supported Skills have significantly higher Maximum Energy.
- 可辅助条件：Invocation
- 数值：Supported Meta Gems have 80% increased Maximum Energy


### Energy Retention

**Energy Retention** · Tier 3 · 需求 0/0/100 · 标签 `Trigger`
- 效果：Supports Meta Skills. Supported Skills gain a chance to partially Refund a portion of Energy cost when Triggering or Invoking other Skills.
- 可辅助条件：GeneratesEnergy
- 数值：Skills Triggered by Supported Meta Skills have 35% chance to refund half of their Energy cost


### Enraged Warcry

**Enraged Warcry I** · Tier 4 · 需求 100/0/0 · 标签 `Warcry`
- 效果：Supports Warcries, causing them to spend Rage to bypass their usual Cooldown.
- 可辅助条件：Warcry
- 赋予类型：ConsumesRage
- 数值：Supported Warcries spend 20 Rage to bypass their Cooldown, instead of an Endurance Charge

**Enraged Warcry II** · Tier 5 · 需求 100/0/0 · 标签 `Warcry`
- 效果：Supports Warcries, causing them to spend Rage to bypass their usual Cooldown.
- 可辅助条件：Warcry
- 数值：Supported Warcries spend 15 Rage to bypass their Cooldown, instead of an Endurance Charge


### Escalating Poison

**Escalating Poison** · Tier 1 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, allowing it to inflict an extra Poison on enemies but shortening the duration of those Poisons.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Targets can be affected by {0:+d} Poisons from Supported Skills at the same time；Supported Skills have -20% more Poison Duration


### Essence Harvest

**Essence Harvest** · Tier 3 · 需求 0/0/100 · 标签 `Minion, Persistent`
- 效果：Supports Skills which create Reviving Persistent Minions. When those Minions die, you Recoup a percentage of your maximum Mana.
- 可辅助条件：Minion AND Persistent
- 禁止条件：Buff OR OngoingSkill OR MinionsAreUndamagable
- 数值：Recoup 8% of your maximum Mana when a Persistent Reviving Minion created by Supported Skill dies


### Eternal Flame

**Eternal Flame I** · Tier 1 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing its Ignites to be inflicted less often but last longer.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% increased Ignite Duration on Enemies；Supported Skills have -25% more Flammability Magnitude

**Eternal Flame II** · Tier 3 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing its Ignites to last longer.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% increased Ignite Duration on Enemies

**Eternal Flame III** · Tier 4 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing it to refresh Ignites on Critical Hit.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 20% chance to refresh Ignite duration on Critical Hit


### Eternal Mark

**Eternal Mark** · Tier 3 · 需求 0/0/100 · 标签 `Mark`
- 效果：Supports Mark Skills, causing them to not be Consumed the first time they are Activated.
- 可辅助条件：Mark


### Execute

**Execute I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to deal more damage against enemies on Low Life.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 40% more Damage with Hits against Enemies that are on Low Life

**Execute II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to deal more damage against enemies on Low Life.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 50% more Damage with Hits against Enemies that are on Low Life

**Execute III** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to deal more damage against enemies on Low Life, as well as dealing more damage while you are on Low Life.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more Damage with Hits against Enemies that are on Low Life；Supported Skills deal 30% more Damage with Hits while you are on Low Life


### Exploit Weakness

**Exploit Weakness** · Tier 2 · 需求 100/0/0 · 标签 `Payoff`
- 效果：Supports any skill that Hits enemies, causing them to deal more Damage against enemies with Broken Armour but preventing them from Breaking Armour themselves. Cannot support skills that Consume Broken Armour.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：ConsumesFullyBrokenArmour AND NOT SupportedByExploitWeakness
- 赋予类型：ConsumesFullyBrokenArmour, SupportedByExploitWeakness
- 数值：Supported Skills Consume Enemy Fully Broken Armour to deal 40% more Damage


### Exposing Cry

**Exposing Cry** · Tier 4 · 需求 100/0/0 · 标签 `Warcry, Duration`
- 效果：Supports Warcries. Supported Skills apply Exposure on Hitting enemies.
- 可辅助条件：Warcry
- 赋予类型：Duration
- 数值：Supported Skills apply Exposure on Hit for 5000 second


### Extraction

**Extraction** · Tier 3 · 需求 0/0/100 · 标签 `Spell, Chaos`
- 效果：Supports Spell Skills which cause Damaging Hits. Using supported Spells will cause you to Sacrifice a portion of your Life on use, gaining extra Chaos Damage in exchange. Does not support Persistent Skills, Minion Skills, or Triggered Skills.
- 可辅助条件：Damage AND Spell
- 禁止条件：HasReservation OR Persistent OR Triggered OR Attack OR Minion OR CreatesMinion
- 数值：Supported Skills Sacrifice 10% of Life on use；Supported Skills Gain 35% of Damage as extra Chaos Damage


### Fan The Flames

**Fan The Flames** · Tier 2 · 需求 100/0/0 · 标签 `Attack, AoE, Trigger, Fire`
- 效果：Supports Wind Skills which Hit enemies. Hits with Supported Skills against Ignited enemies Trigger a fiery explosion, dealing damage to that enemy and enemies in a cone behind them.
- 可辅助条件：(Attack OR Damage) AND Wind

**Fan The Flames II** · Tier 4 · 需求 100/0/0 · 标签 `Attack, AoE, Trigger, Fire`
- 效果：Supports Wind Skills which Hit enemies. Hits with Supported Skills against Ignited enemies Trigger a fiery explosion, dealing damage to that enemy and enemies in a cone behind them. The explosion Spreads the initial enemy's Ignite to other enemies Hit.
- 可辅助条件：(Attack OR Damage) AND Wind


### Feeding Frenzy

**Feeding Frenzy I** · Tier 3 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports skills which create Minions, making them deal and take more damage. Cannot support skills which create undamageable Minions.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills take 20% more Damage；Minions from Supported Skills deal 30% more Damage

**Feeding Frenzy II** · Tier 4 · 需求 0/0/100 · 标签 `Minion`
- 效果：—
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills take 15% more Damage；Minions from Supported Skills deal 30% more Damage


### Ferocity

**Ferocity** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills that you use yourself. Supported Skills will consume a Frenzy Charge on use if possible, and will gain significant Skill Speed if they do, but cannot generate Frenzy Charges. Cannot Support Skills which consume Frenzy Charges.
- 可辅助条件：Damage OR CrossbowAmmoSkill OR Attack
- 禁止条件：(SkillConsumesFrenzyChargesOnUse AND NOT SupportedByFerocity) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：ConsumesCharges, SupportedByFerocity, SkillConsumesFrenzyChargesOnUse
- 数值：Supported Skills will consume a Frenzy Charge on use if possible Supported Skills have 40% more Skill Speed when consuming Frenzy Charges


### Fiery Death

**Fiery Death** · Tier 2 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Fire`
- 效果：Supports any skill that Hits enemies, causing enemies it Ignites to have a chance to explode on death.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：SkillGrantedBySupport
- 数值：Enemies Ignited by Supported Skills have 60% chance to explode on death


### Fire Attunement

**Fire Attunement** · Tier 1 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that deals damage, causing them to Gain Fire Damage but deal less Cold and Lightning Damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage
- 数值：`non_skill_base_all_damage_%_to_gain_as_fire` = 25；Supported Skills deal -50% more Cold and Lightning Damage


### Fire Exposure

**Fire Exposure** · Tier 4 · 需求 100/0/0 · 标签 `Fire, Duration`
- 效果：Supports any skill that Hits enemies, causing it to inflict Exposure when Igniting.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Supported Skills inflict Exposure for 8000 second on Igniting a target


### Fire Penetration

**Fire Penetration I** · Tier 2 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, making those Hits Penetrate enemy Fire resistance.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills Penetrate 30% Fire Resistance

**Fire Penetration II** · Tier 5 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, making those Hits ignore enemy Fire resistance.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill


### Fissures

**Branching Fissures I** · Tier 3 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create Fissures in the ground, causing them to create additional secondary Fissures which branch off from the primary fissure, with lowered area of effect and Damage.
- 可辅助条件：CreatesFissure
- 数值：Supported Skills' Fissures branch branch 2 time；Supported Skills' Branched Fissures have -35% more area of effect；Supported Skills' Branched Fissures deal -40% more damage

**Branching Fissures II** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create Fissures in the ground, causing them to create additional secondary Fissures which branch off from the primary fissure, with lowered area of effect and Damage.
- 可辅助条件：CreatesFissure
- 数值：Supported Skills' Fissures branch branch 2 time；Supported Skills' Branched Fissures have -35% more area of effect；Supported Skills' Branched Fissures deal -30% more damage

**Kaom's Madness** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Attack, Melee`
- 效果：Supports Skills which create fissures in the ground, causing them to create many additional fissures at the cost of damage, speed, and area of effect.
- 可辅助条件：CreatesFissure
- 数值：Supported Skills create an additional fissure；Supported Skills deal -20% more Damage；Supported Skills have -20% more Skill Speed；Supported Skills have -30% more Area of Effect

**Upheaval I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create fissures in the ground, causing them to create an additional fissure at the cost of damage and speed.
- 可辅助条件：CreatesFissure
- 数值：Supported Skills create an additional fissure；Supported Skills deal -20% more Damage；Supported Skills have -20% more Skill Speed

**Upheaval II** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create fissures in the ground, causing them to create additional fissures at the cost of damage and speed.
- 可辅助条件：CreatesFissure
- 数值：Supported Skills create an additional fissure；Supported Skills deal -40% more Damage；Supported Skills have -20% more Skill Speed


### Fist of War

**Fist Of Kalguur** · Tier 0 · 需求 0/0/0 · 标签 `Attack, AoE, Melee, Slam, Trigger, Physical, Duration`
- 效果：Supports Slams you use yourself, allowing them to spend large amounts of Runic Ward to become Runically Boosted. Runically Boosted Slams are Empowered with extra Physical damage and create a rune the first time they hit an enemy. The rune erupts in an Aftershock after a duration. Cannot support Channelling Skills.
- 可辅助条件：Slam
- 禁止条件：Persistent OR Triggered OR UsedByProxy OR Channel
- 数值：Limit 1 active rune；Runically Boosted Skills Gain 20% of Damage as Extra Physical Damage；Supported Skills spend Runic Ward equal to their Life and Mana Cost if possible to become Runically Boosted

**Fist of War I** · Tier 1 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, providing a powerful Ancestral Boost every few seconds.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：`support_ancestral_slam_big_hit_max_count` = 1；Attacks with Supported Skill are Ancestrally Boosted, no more than once every 6000 seconds

**Fist of War II** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, providing a powerful Ancestral Boost every few seconds.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：`support_ancestral_slam_big_hit_max_count` = 1；Attacks with Supported Skill are Ancestrally Boosted, no more than once every 4000 seconds

**Fist of War III** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slams you use yourself, providing a very powerful Ancestral Boost infrequently.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：`support_ancestral_slam_big_hit_max_count` = 1；Attacks with Supported Skill are Ancestrally Boosted, no more than once every 14000 seconds


### Flame Pillar

**Flame Pillar** · Tier 0 · 需求 100/0/0 · 标签 `AoE, Trigger, Fire`
- 效果：Supports any Skill you use yourself which can cause Damaging Hits. Supported Skills Consume Ignite on Hit to create pillars of flame, but cannot themselves inflict Ignite. Cannot Support Skills which already Consume Ignite, and does not modify the Skills of Minions.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：(SkillConsumesIgnite AND NOT SupportedByFlamePillar) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SkillConsumesIgnite, SupportedByFlamePillar
- 数值：Maximum 10 Flame Pillars；Supported Skills Consume Ignite on Enemies they Hit, creating a Flame Pillar；Supported Skills create 0 additional Flame Pillar when Consuming Aggravated Ignite


### Flamepierce

**Flamepierce** · Tier 0 · 需求 100/0/0 · 标签 `Projectile, Fire`
- 效果：Supports Skills which can fire Projectiles. Initial Projectile created by Supported Skills will always Pierce Ignited Enemies, but Supported Skills cannot inflict Ignite themselves.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 赋予类型：SupportedByFlamepierce
- 数值：Projectiles from Supported Skills have 100% chance to Pierce Ignited Enemies


### Fluke

**Fluke** · Tier 3 · 需求 0/0/100 · 标签 `Trigger`
- 效果：Supports Skills which Trigger other Skills. Skills Triggered by Supported Skills have their Damage randomly raised or lowered when Triggered, as well as recovering a random amount of their cost when Triggered.
- 可辅助条件：Triggers
- 数值：Skills Triggered by Supported Skills recover between 0% and #% of cost on use；Skills Triggered by Supported Skills recover between 20% and #% of cost on use；Skills Triggered by Supported Skills deal between -40% less and #% more Damage；Skills Triggered by Supported Skills deal between 60% less and #% more Damage

**Ixchel's Torment** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Trigger`
- 效果：Supports Skills which Trigger other Skills. Skills Triggered by Supported Skills have their Damage, Area of Effect, and Projectile Speed randomly raised or lowered when Triggered, as well as recovering a random amount of their cost when Triggered.
- 可辅助条件：Triggers
- 数值：Skills Triggered by Supported Skills recover between 0% and #% of cost on use；Skills Triggered by Supported Skills recover between 20% and #% of cost on use；Skills Triggered by Supported Skills deal between -40% less and #% more Damage；Skills Triggered by Supported Skills deal between 60% less and #% more Damage；Skills Triggered by Supported Skills have between 50% less and #% more Area of Effect；Skills Triggered by Supported Skills have between -40% less and #% more Area of Effect；Skills Triggered by Supported Skills have between 50% less and #% more Projectile Speed；Skills Triggered by Supported Skills have between -40% less and #% more Projectile Speed


### Focused Curse

**Focused Curse** · Tier 2 · 需求 0/0/100 · 标签 `Curse`
- 效果：Supports Curse skills, causing them to Curse enemies more quickly after being cast.
- 可辅助条件：AppliesCurse
- 数值：Curse zones from Supported Skills erupt after -50% more delay


### Font

**Font of Blood** · Tier 2 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems. Totems created by supported Skills generate a Font of Blood which will Leech Life to Allies within it.
- 可辅助条件：SummonsTotem
- 禁止条件：Minion AND Persistent
- 数值：Totems created by Supported Skills create a Blood Font with a radius of # metres Allies in Blood Fonts Leech Life equal to 12% of Physical Damage dealt by Supported Totem；Totems created by Supported Skills create a Blood Font with a radius of # metres Allies in Blood Fonts Leech Life equal to 40% of Physical Damage dealt by Supported Totem

**Font of Mana** · Tier 2 · 需求 0/0/100 · 标签 `Totem`
- 效果：Supports Skills which create Totems. Totems created by supported Skills generate a Font of Mana which will Leech Mana to Allies within it.
- 可辅助条件：SummonsTotem
- 禁止条件：Minion AND Persistent
- 数值：Totems created by Supported Skills create a Mana Font with a radius of # metres Allies in Mana Fonts Leech Mana equal to 12% of Physical Damage dealt by Supported Totem；Totems created by Supported Skills create a Mana Font with a radius of # metres Allies in Mana Fonts Leech Mana equal to 40% of Physical Damage dealt by Supported Totem


### Fork

**Fork** · Tier 3 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making their Projectiles Fork.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 数值：`terrain_arrow_attachment_chance_reduction_+%` = 100；Projectiles from Supported Skills deal -30% more Damage after Forking


### Fortress

**Ahn's Citadel** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports skills that create walls in a line, causing them to instead be created along a fissure.
- 可辅助条件：Wall
- 赋予类型：CreatesFissure
- 数值：`wall_maximum_length_+%` = 65

**Fortress I** · Tier 1 · 需求 0/0/100 · 标签 ``
- 效果：Supports skills that create walls in a line, causing them to be created in a circle instead but deal less Hit damage.
- 可辅助条件：Wall
- 数值：`wall_maximum_length_+%` = 100；Supported Skills deal -40% more damage with Hits

**Fortress II** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports skills that create walls in a line, causing them to be created in a circle instead but deal less Hit damage and have lowered Area of Effect.
- 可辅助条件：Wall
- 数值：`wall_maximum_length_+%` = 100；Supported Skills deal -30% more damage with Hits；Supported Skills have -20% more Area of Effect


### Freeze

**Freeze** · Tier 2 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports any skill that Hits enemies, making it more effective at Freezing enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills cause 50% more Freeze Buildup


### Freezefork

**Freezefork** · Tier 0 · 需求 0/0/100 · 标签 `Projectile, Cold`
- 效果：Supports Skills which can fire Projectiles. Projectiles from Supported Skills always Fork when the initial Projectile Hits Frozen Enemies, but Supported Skills cannot build up Freeze themselves.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 赋予类型：SupportedByFreezefork
- 数值：Supported Skills have 100% chance to Fork when hitting Frozen Enemies


### Fresh Clip

**Fresh Clip I** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports Crossbow Skills, granting them more damage for each bolt reloaded by that Skill in the last 6 seconds.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Crossbow Skills deal 1% more Damage for each bolt Reloaded by that skill in the past 6 seconds

**Fresh Clip II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports Crossbow Skills, granting them more damage for each bolt reloaded by that Skill in the last 8 seconds.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Crossbow Skills deal 1% more Damage for each bolt Reloaded by that skill in the past 8 seconds


### Frost Nexus

**Frost Nexus** · Tier 2 · 需求 0/0/100 · 标签 `AoE, Cold`
- 效果：Supports any skill that Hits enemies, causing it to create patches of Chilled Ground around Frozen enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 赋予类型：CreatesGroundEffect
- 数值：`chilling_ice_freezing_area_base_radius` = 30；Supported Skills create Chilled Ground for 8000 seconds when they Freeze an Enemy


### Frostfire

**Frostfire** · Tier 3 · 需求 0/0/100 · 标签 `Cold, Fire, Payoff`
- 效果：Supports any skill that Hits enemies, causing it to Consume Freeze on Igniting a Frozen enemy to boost the effect of the Ignite. Cannot support skills that Consume Freeze or Ignite.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：SkillConsumesIgnite OR (SkillConsumesFreeze AND NOT SupportedByFrostfire)
- 赋予类型：SkillConsumesFreeze, SupportedByFrostfire
- 数值：50% more Magnitude of Ignite inflicted on Frozen targets with Supported Skills；25% more Magnitude of Ignite inflicted on Frozen Unique enemies with Supported Skills


### Frozen Spite

**Frozen Spite** · Tier 2 · 需求 0/100/0 · 标签 `AoE, Projectile, Trigger, Cold`
- 效果：Supports Skills that Hit enemies, causing them to create Ice Fragments on killing Frozen Enemies. Cannot Support Totem Skills and does not modify Skills used by Minions.
- 可辅助条件：Attack
- 禁止条件：FrozenSpite OR UsedByTotem OR RemoteMined OR Trapped OR SummonsTotem


### Gambleshot

**Gambleshot** · Tier 3 · 需求 0/0/100 · 标签 `Projectile`
- 效果：Supports Skills which fire Projectiles that are not ground targeted. Projectiles from Supported Skills randomly Fork, Chain or Pierce.
- 可辅助条件：Projectile
- 禁止条件：GroundTargetedProjectile
- 数值：Projectiles from Supported Skills deal -15% more Damage


### Garukhan's Resolve

**Garukhan's Resolve** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Attack, Conditional`
- 效果：Supports Attack Skills you use yourself which do not already have some Condition for use. Supported Skills have a maximum Critical Hit chance, but will Bifurcate Critical Hit Chance.
- 可辅助条件：Attack
- 禁止条件：(HasUsageCondition AND NOT SupportedByGarukhan) OR Instant OR Cooldown OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SupportedByGarukhan, HasUsageCondition
- 数值：`maximum_critical_strike_chance_is_%_from_support_garukhans_resolve` = 50


### Glacier

**Glacier** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports any Skill which creates Ice Crystals, causing them to be created with higher Life.
- 可辅助条件：IceCrystal
- 数值：Ice Crystals created by Supported Skills have 100% more Life


### Gorge

**Gorge** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports skills that consume Corpses. Consuming Corpses with supported skills grants Flask charges.
- 可辅助条件：TargetsDestructibleCorpses OR TargetsDestructibleRareCorpses
- 数值：Supported Skills grant 10 Life Flask Charges for each Corpse Consumed；Supported Skills grant 10 Mana Flask Charges for each Corpse Consumed


### Grants Cooldown

**Breachlord's Amalgam** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Projectile, Lightning, Cold`
- 效果：Supports Lightning or Cold skills you use yourself which fire Projectiles and do not already have cooldowns, adding a cooldown and making the Projectiles return, piercing through targets as they do so.
- 可辅助条件：(Cold OR Lightning) AND Projectile
- 禁止条件：(Cooldown AND NOT SupportedByBreachlordsAmalgam) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：Cooldown, SupportedByBreachlordsAmalgam

**Excise** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports any damaging Skill that you use yourself, granting it significantly higher chance to Critically Hit, but causing it to gain a long cooldown. Cannot support Skills which already have a cooldown.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：(Cooldown AND NOT SupportedByExcise) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SupportedByExcise, Cooldown
- 数值：Supported Skills have a Cooldown of 8000 second；Supported Skills have 40% more chance to Critically Hit

**Execrate** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports any damaging Skill that you use yourself, granting it significantly higher chance to inflict Ailments on hit, but causing it to gain a long cooldown. Cannot support Skills which already have a cooldown.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：(Cooldown AND NOT SupportedByExecrate) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SupportedByExecrate, Cooldown
- 数值：Supported Skills have a Cooldown of 8000 second；Supported Skills have 100% more chance to inflict Ailments

**Expanse** · Tier 1 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports any Skill that you use yourself, granting it significantly higher Area of Effect but causing it to gain a long cooldown. Cannot support Skills which already have a cooldown.
- 可辅助条件：Area OR MinionsCanExplode
- 禁止条件：(Cooldown AND NOT SupportedByExpanse) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SupportedByExpanse, Cooldown
- 数值：Supported Skills have a Cooldown of 8000 second；Supported Skills have 50% increased Area of Effect

**Hourglass** · Tier 1 · 需求 0/0/100 · 标签 ``
- 效果：Supports any damaging skill that you use yourself, causing it to deal significantly more damage but gain a long cooldown. Cannot support Skills which already have a cooldown.
- 可辅助条件：Attack OR Damage OR DegenOnlySpellDamage OR CrossbowAmmoSkill OR DamageOverTime
- 禁止条件：(Cooldown AND NOT SupportedByHourglass) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：Cooldown, SupportedByHourglass
- 数值：`support_hourglass_damage_+%_final` = 30；Supported Skills have a Cooldown of 10000 second


### Haemocrystals

**Haemocrystals** · Tier 3 · 需求 100/0/0 · 标签 `Attack, AoE, Trigger, Physical`
- 效果：Supports Attack Skills you use yourself which can cause Damaging Hits. Supported Skills Consume Bleeding on Hit to create explosive blood-filled crystals, but cannot themselves inflict Bleeding. Cannot Support Skills which already Consume Bleeding.
- 可辅助条件：Attack
- 禁止条件：(SkillConsumesBleeding AND NOT SupportedByHaemoCrystals) OR UsedByProxy OR Triggered OR Persistent
- 赋予类型：SkillConsumesBleeding, SupportedByHaemoCrystals
- 数值：Supported Skills Consume Bleeding on Enemies they Hit, creating 4 Haemocrystal；Maximum 20 active Haemocrystals；Supported Skills create 2 additional Haemocrystal when Consuming Aggravated Bleeding


### Hardy Totems

**Hardy Totems I** · Tier 2 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, causing those Totems to have more Life.
- 可辅助条件：SummonsTotem
- 数值：Totems created by Supported Skills have 40% more maximum Life

**Hardy Totems II** · Tier 4 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, causing those Totems to have more Life.
- 可辅助条件：SummonsTotem
- 数值：Totems created by Supported Skills have 50% more maximum Life

**Tawhoa's Tending** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Totem, AoE, Trigger, Physical`
- 效果：Supports Skills which create Totems, causing those Totems to have more Life. Totems created by Supported Skills explode on death, dealing Physical damage based on their Life.
- 可辅助条件：SummonsTotem
- 数值：Totems created by Supported Skills have 25% more maximum Life；Totems created by Supported Skills have 100% chance to trigger Tawhoa's Vengeance on death


### Harmonic Remnants

**Harmonic Remnants I** · Tier 2 · 需求 0/0/100 · 标签 `Remnant`
- 效果：Supports Skills which create Remnants, allowing those Remnants to be collected from further away. 
- 可辅助条件：GeneratesRemnants
- 数值：Remnants created by Supported Skills can be collected from 35% further away

**Harmonic Remnants II** · Tier 3 · 需求 0/0/100 · 标签 `Remnant`
- 效果：Supports Skills which create Remnants, allowing those Remnants to be collected from further away, with a chance to create an additional Remnant.
- 可辅助条件：GeneratesRemnants
- 数值：Remnants created by Supported Skills can be collected from 35% further away；20% chance for Supported Skills to create an additional Remnant


### Healing Runes

**Healing Runes** · Tier 0 · 需求 0/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to lose Runic Ward and heal nearby allies based on the Ward lost. Healing done is split between allies who are not on full Life.
- 可辅助条件：Persistent AND Buff
- 数值：Lose up to 10% of your maximum Runic Ward every # second to heal nearby allies for a total of #% of the amount of Ward lost；Lose up to 5000% of your maximum Runic Ward every # second to heal nearby allies for a total of #% of the amount of Ward lost；Lose up to 200% of your maximum Runic Ward every # second to heal nearby allies for a total of #% of the amount of Ward lost


### Heavy Swing

**Heavy Swing** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee, Physical`
- 效果：Supports Melee Attacks, boosting their Physical damage at the cost of Attack Speed.
- 可辅助条件：Melee
- 数值：Supported Skills deal 35% more Melee Physical Damage；Supported Skills have -10% more Attack Speed


### Heft

**Heft** · Tier 5 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports Skills which deal Damage, increasing the maximum Physical Damage of their Hits.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more Maximum Physical Hit Damage


### Heightened Accuracy

**Heightened Accuracy I** · Tier 1 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to gain Accuracy.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 50% more Accuracy Rating

**Heightened Accuracy II** · Tier 3 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to gain Accuracy, and never miss against Enemies on full Life.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 50% more Accuracy Rating


### Heightened Curse

**Heightened Curse** · Tier 1 · 需求 0/0/100 · 标签 `Curse`
- 效果：Supports Curse Skills, magnifying their power.
- 可辅助条件：AppliesCurse OR IsBlasphemy
- 数值：Supported Curses have 25% increased Magnitudes


### Helbrym's Hide

**Helbrym's Hide** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Shapeshift, Buff`
- 效果：Supports Shapeshifting Skills, causing them to grant Helbrym's Composure for a brief duration when they cause you to Shapeshift. Shapeshifting into a different form before the Buff expires causes it to be removed without effect.
- 可辅助条件：Shapeshift
- 数值：Gain Helbrym's Composure for 2000 second when Supported Skills cause you to Shapeshift；`support_hide_of_helbrym_guard_duration_ms` = 4000；`support_hide_of_helbrym_gain_guard_from_%_of_damage_taken` = 50；`support_hide_of_helbrym_gain_rage_from_%_of_damage_taken` = 3


### Her Declaration

**Her Declaration** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing enemies that enter your Presence to become Intimidated while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Enemies entering your Presence while a Supported Skill is active are Intimidated for 4000 second


### Herbalism

**Herbalism I** · Tier 2 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Life recovery from Flasks while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：30% Increased Recovery from Life Flasks while a Supported Skill is active

**Herbalism II** · Tier 4 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Life recovery from Flasks while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：50% Increased Recovery from Life Flasks while a Supported Skill is active


### Hex Bloom

**Hex Bloom** · Tier 3 · 需求 0/0/100 · 标签 `AoE, Curse`
- 效果：Supports Curses, spreading their effects when a Cursed enemy dies.
- 可辅助条件：AppliesCurse
- 赋予类型：Area
- 数值：Curses from Supported Skills spread to enemies within 3 metres when a Cursed enemy dies


### Hit and Run

**Hit and Run** · Tier 4 · 需求 0/100/0 · 标签 `Attack, Conditional`
- 效果：Supports Attack Skills you use yourself which do not already have some Condition for use. Supported Skills can only be used after you have moved a certain distance, but have massively increased Skill Speed. Cannot support Skills which have a cooldown.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR (HasUsageCondition AND NOT SupportedByMobileAssault) OR Instant OR Cooldown
- 赋予类型：HasUsageCondition, SupportedByMobileAssault
- 数值：Supported Skills have 40% more Skill Speed；Supported Skills become usable after you have moved 100 metres Supported Skills become unusable again after use


### Holy Descent

**Holy Descent** · Tier 5 · 需求 100/0/0 · 标签 `AoE, Duration`
- 效果：Supports Skills that leap into the air, causing them to create Consecrated Ground when you land.
- 可辅助条件：Jumping
- 赋予类型：CreatesGroundEffect, Area, Duration
- 数值：Supported Skills create Consecrated Ground for 4000 seconds on landing；Supported Skills create Consecrated Ground in an area of 22 metre


### Hulking Minions

**Hulking Minions** · Tier 4 · 需求 0/0/100 · 标签 `Minion, Persistent`
- 效果：Supports Skills which summon Persistent Minions. Supported Minions are larger, have more Life, and deal more Damage, but cost significantly more Spirit.
- 可辅助条件：Minion AND Persistent

**Tangmazu's Thurible** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Minion, Persistent`
- 效果：Supports Skills which summon Companions causing them to be Gigantic and gain Evasion and Deflection based on your own.
- 可辅助条件：Companion
- 数值：Companions from Supported Skills have {0:+d} to Evasion Rating per 10 Evasion Rating you have；Companions from Supported Skills have {0:+d} to Deflection Rating per 10 Deflection Rating you have


### Ice Bite

**Bhatair's Vengeance** · Tier 0 · 需求 0/0/100 · 标签 `Attack, Warcry, Cold, Duration`
- 效果：Supports Attacks and Warcries you use yourself. Freezing an enemy with Supported Skills infuses you and your allies with Cold damage for a short time. 
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Warcry
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：When you Freeze a target with Supported Skills, for each 2 Rage you have, you and Allies in your Presence gain 1% of Damage as Cold Damage for 15000 second

**Ice Bite I** · Tier 1 · 需求 0/0/100 · 标签 `Warcry, Cold, Duration`
- 效果：Supports damaging skills and Warcries you use yourself. Freezing an enemy with supported skills infuses your damage with Cold damage for a short time.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Warcry OR Damage
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Gain 25% of Damage as Cold Damage for # seconds on Freezing an enemy with Supported Skills；Gain 5000% of Damage as Cold Damage for # seconds on Freezing an enemy with Supported Skills

**Ice Bite II** · Tier 3 · 需求 0/0/100 · 标签 `Warcry, Cold, Duration`
- 效果：Supports damaging skills and Warcries you use yourself. Freezing an enemy with supported skills infuses your damage with Cold damage for a short time.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Warcry OR Damage
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Gain 30% of Damage as Cold Damage for # seconds on Freezing an enemy with Supported Skills；Gain 6000% of Damage as Cold Damage for # seconds on Freezing an enemy with Supported Skills


### Icicle

**Icicle** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports any Skill which creates Ice Crystals, causing them to be created with lower Life.
- 可辅助条件：IceCrystal
- 数值：Ice Crystals created by Supported Skills have -50% more Life


### Ignite

**Ignite I** · Tier 1 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, making it more likely to Ignite.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% more Flammability Magnitude

**Ignite II** · Tier 3 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, making it more likely to Ignite.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 150% more Flammability Magnitude

**Ignite III** · Tier 5 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, making it more likely to Ignite and causing inflicted Ignites to deal their damage more quickly.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 200% more Flammability Magnitude；Ignites from Supported Skills deal Damage 15% faster


### Immolate

**Immolate** · Tier 3 · 需求 100/0/0 · 标签 `Fire, Payoff`
- 效果：Supports Attacks, granting them extra Fire damage against Ignited enemies but making them unable to Ignite enemies themselves.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Attacks Gain 30% of Damage as extra Fire Damage against Ignited enemies


### Impact Shockwave

**Impact Shockwave** · Tier 1 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Strike`
- 效果：Supports Melee Strike Skills and Wind Attack Skills, causing them to create an Aftershock that damages enemies around the target when they Heavy Stun an enemy.
- 可辅助条件：MeleeSingleTarget OR (Wind AND Attack)
- 禁止条件：Slam
- 数值：Supported Skills cause an Aftershock when they Heavy Stun an enemy, Damaging other enemies within 15 metre Aftershocks caused this way cannot Stun


### Impale

**Impale** · Tier 4 · 需求 0/100/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing them to Impale on Hit but making them unable to Extract Impale themselves.
- 可辅助条件：Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% chance to Impale Enemies on Hit


### Impending Doom

**Impending Doom** · Tier 1 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Chaos`
- 效果：Supports Curse skills you cast yourself, causing them to trigger Doom Blast on Cursed enemies when the Curse expires.
- 可辅助条件：AppliesCurse
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Aura


### Incision

**Incision** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Physical`
- 效果：Supports Attack Skills. Supported Skills inflict Incision on Hit, which causes Enemies to be increasingly more likely to be inflicted with Bleeding. All Incision is removed from a target on inflicting it with Bleeding.
- 可辅助条件：Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Hits from Supported Skills inflict Incision；3% more Magnitude of Bleeding inflicted with Supported Skills per Incision consumed Recently, up to 30%


### Increased Area of Effect

**Magnified Area I** · Tier 1 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports any skill with an area of effect, making it larger.
- 可辅助条件：Area OR MinionsCanExplode
- 数值：Supported Skills have 35% increased Area of Effect；Supported Skills deal 0% more Area Damage

**Magnified Area II** · Tier 3 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports any skill with an area of effect, making it larger.
- 可辅助条件：Area OR MinionsCanExplode
- 数值：Supported Skills have 45% increased Area of Effect；Supported Skills deal 0% more Area Damage

**Overreach** · Tier 2 · 需求 0/100/0 · 标签 `Attack, AoE`
- 效果：Supports Attack Skills which deal Damage in an Area. Supported Skills have significantly increased Area of Effect, but are less Accurate against nearby targets.
- 可辅助条件：Attack AND Area
- 数值：Supported Skills have 40% increased Area of Effect；Supported Skills have -80% more Accuracy Rating against Enemies within two metres

**Vruun's Inevitability** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Attack, Melee, Conditional`
- 效果：Supports Melee Attack Skills. Supported Skills gain Combo when you successfully Strike Enemies with other Melee Attacks. Supported Skills expend their Combo when used, gaining more area of effect the higher Combo they had. Cannot support skills which already gain Combo. Cannot modify the Skills of Minions.
- 可辅助条件：Attack AND Melee
- 禁止条件：HasUsageCondition AND NOT SupportedByVruunsInevitablity
- 赋予类型：ComboStacking, SupportedByVruunsInevitablity, HasUsageCondition
- 数值：Supported Skills have 6% increased area of effect per Combo expended；Supported Skills lose Combo if they generate no Combo for 6000 second；Supported Skills can gain up to 10 Combo Supported Skills expend all Combo on use


### Increased Area of Effect, Concentrated Area

**Vorana's Siege** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, AoE`
- 效果：Supports skills which Hit targets and have an area of effect, increasing the affected area and causing it to Hit Isolated targets harder.
- 可辅助条件：(Area OR MinionsCanExplode) AND (Damage OR Attack)
- 数值：Supported Skills have 35% increased Area of Effect；Supported Skills deal 20% more Damage with Hits against Isolated targets


### Inexorable Critical

**Inexorable Critical I** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill you use yourself that Hits enemies, causing it to accumulate Critical Hit chance over time. 
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills gain 10% increased Critical Hit Chance each second, up to #%. This Critical Hit Chance is lost whenever a skill supported by Inexorable Critical Critically Hits；Supported Skills gain 100% increased Critical Hit Chance each second, up to #%. This Critical Hit Chance is lost whenever a skill supported by Inexorable Critical Critically Hits

**Inexorable Critical II** · Tier 4 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill you use yourself that Hits enemies, causing it to accumulate Critical Hit chance over time, but also reduce your Critical Damage Bonus.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills gain 40% increased Critical Hit Chance each second, up to #%. This Critical Hit Chance is lost whenever a skill supported by Inexorable Critical Critically Hits；Supported Skills gain 200% increased Critical Hit Chance each second, up to #%. This Critical Hit Chance is lost whenever a skill supported by Inexorable Critical Critically Hits；Supported Skills gain -10% more Critical Damage Bonus each second, up to #%. This Critical Damage Bonus is lost whenever a skill supported by Inexorable Critical Critically Hits；Supported Skills gain -50% more Critical Damage Bonus each second, up to #%. This Critical Damage Bonus is lost whenever a skill supported by Inexorable Critical Critically Hits


### Infernal Legion

**Catha's Brilliance** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Minion, AoE, Fire`
- 效果：Supports skills which create Companions, causing enemies near them to be Blinded and Ignited. The damage of the Ignite is based on the Life of the supported Minion.
- 可辅助条件：Companion
- 数值：Minions from Supported Skills Blind Enemies within a 20 metre radius；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 20% of Minion's Maximum Life

**Infernal Legion I** · Tier 2 · 需求 100/0/0 · 标签 `Minion, AoE, Fire`
- 效果：Supports skills which create Minions which can be damaged, causing them and enemies near them to Ignite. The damage of the Ignite is based on the Life of the supported Minion.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 赋予类型：CausesBurning
- 数值：Minions from Supported Skills take 600% of their maximum Life as Fire Damage per second；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 15% of Minion's Maximum Life

**Infernal Legion II** · Tier 5 · 需求 100/0/0 · 标签 `Minion, AoE, Fire`
- 效果：Supports skills which create Minions which can be damaged, causing them and enemies near them to Ignite. The damage of the Ignite is based on the Life of the supported Minion.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 赋予类型：CausesBurning
- 数值：Minions from Supported Skills take 600% of their maximum Life as Fire Damage per second；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 20% of Minion's Maximum Life；Minions from Supported Skills have {0:+d}% to Fire Resistance

**Infernal Legion III** · Tier 0 · 需求 100/0/0 · 标签 `Minion, AoE, Fire`
- 效果：Supports skills which create Minions which can be damaged, causing them and enemies near them to Ignite. The damage of the Ignite is based on the Life of the supported Minion.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 赋予类型：CausesBurning
- 数值：Minions from Supported Skills take 600% of their maximum Life as Fire Damage per second；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 10% of Minion's Maximum Life；Minions from Supported Skills Ignite Enemies within a radius of # metres as though dealing Base Fire Damage equal to 20% of Minion's Maximum Life；Minions from Supported Skills have {0:+d}% to Fire Resistance


### Inhibitor

**Inhibitor** · Tier 2 · 需求 0/100/0 · 标签 `Spell`
- 效果：Supports any Skill you use or Trigger yourself. Supported Skills cannot consume Charges or Infusion by any means. Cannot Support Skills which require Charges or Infusion to be used.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill OR Spell OR DegenOnlySpellDamage
- 禁止条件：UsedByProxy OR Persistent OR RequiresCharges
- 赋予类型：CannotConsumeCharges
- 数值：Supported Skills deal 4% more Damage per different type of Charge or Infusion on you


### Innervate

**Innervate** · Tier 1 · 需求 0/100/0 · 标签 `Lightning, Duration`
- 效果：Supports damaging skills you use yourself. Killing a Shocked enemy with supported skills imbues your damage with Lightning damage for a short time.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Gain 25% of Damage as Lightning Damage for # seconds on killing a Shocked enemy with Supported Skills；Gain 5000% of Damage as Lightning Damage for # seconds on killing a Shocked enemy with Supported Skills


### Intense Agony

**Intense Agony** · Tier 2 · 需求 0/0/100 · 标签 `Spell, Duration`
- 效果：Supports Spells that deal non-Ailment damage over time, causing them to have a shorter duration but deal substantially more damage over time with Debuffs inflicted against enemies on full life.
- 可辅助条件：Spell AND DamageOverTime
- 数值：Damage over time with non-Ailment Debuffs inflicted on full-life enemies by Supported Skills deal 50% more damage；Supported Skills have -25% more Skill Effect Duration


### Jagged Ground

**Jagged Ground I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Slam, Duration`
- 效果：Supports Slam skills. Supported Skills will consume Endurance Charges on use to create Jagged Ground. Cannot Support Skills which consume Endurance Charges.
- 可辅助条件：Slam
- 禁止条件：CannotCreateJaggedGround OR (SkillConsumesEnduranceChargesOnUse AND NOT SupportedByJaggedGround)
- 赋予类型：Duration, Area, CreatesGroundEffect, ConsumesCharges, SkillConsumesEnduranceChargesOnUse, SupportedByJaggedGround
- 数值：Supported Skills consume an Endurance Charge on Use；Jagged Ground lasts 4000 seconds；Supported Skills create Jagged Ground when consuming an Endurance Charge

**Jagged Ground II** · Tier 5 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Slam, Duration`
- 效果：Supports Slam skills. Aftershocks caused by Supported Slam Skills always create patches of Jagged Ground.
- 可辅助条件：Slam
- 禁止条件：CannotCreateJaggedGround
- 赋予类型：Duration, Area, CreatesGroundEffect
- 数值：Jagged Ground lasts 4000 seconds


### Kalisa's Crescendo

**Kalisa's Crescendo** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports Curse Skills. Enemies Cursed by Supported Skills are Pacified for the final portion of the Supported Curse's duration.
- 可辅助条件：AppliesCurse
- 数值：Enemies affected by Curses from Supported Skills are Pacified for the final 30% of Supported Curse's duration；Enemies Pacified this way cannot be Pacified again for 8000 second


### Khatal's Rejuvenation

**Khatal's Rejuvenation** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Remnant`
- 效果：Supports Skills that generate Remnants. Picking up Remnants from Supported Skills grants Khatal's Rejuvenation.
- 可辅助条件：GeneratesRemnants


### Knockback

**Knockback** · Tier 3 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to Knock Back enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：`generic_knockback_distance_limit` = 30；Supported Skills have 40% more Knockback Distance


### Kulemak's Dominion

**Kulemak's Dominion** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports Offering Skills, causing your Cascadable Spells to Cascade to the locations of Supported Offerings.
- 可辅助条件：Offering
- 数值：Spells you cast which affect an area around you or a targeted location also affect an area around Supported Offerings Spells deal #% more damage when affecting areas around Offerings this way


### Last Gasp

**Last Gasp** · Tier 1 · 需求 0/0/100 · 标签 `Minion, Persistent, Duration`
- 效果：Supports Skills that create Persistent Minions, causing those Minions to fight on when they are fatally wounded, dying after a short duration.
- 可辅助条件：CreatesMinion AND Persistent
- 禁止条件：MinionsAreUndamagable
- 赋予类型：Duration
- 数值：Minions from Supported Skills die 4000 second after their Life is reduced to 0

**Tecrod's Revenge** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Minion, Persistent, Duration`
- 效果：Supports Skills that create Persistent Minions, causing those Minions to fight on when they are fatally wounded, dying after a duration. Minions from Supported Skills gain Soul Eater and a burst of speed on entering this state.
- 可辅助条件：CreatesMinion AND Persistent
- 禁止条件：MinionsAreUndamagable
- 赋予类型：Duration
- 数值：Minions from Supported Skills die 20000 second after their Life is reduced to 0；Minions from Supported Skills gain 40% increased Attack and Cast Speed when their Life is reduced to 0


### Lasting Ground

**Lasting Ground** · Tier 0 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills that create Ground Surfaces, causing those surfaces to last longer.
- 可辅助条件：CreatesGroundEffect
- 数值：`ground_effect_duration_+%` = 50


### Lasting Shock

**Lasting Shock** · Tier 2 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies or inflicts Shock, causing its Shocks to be inflicted less often but last longer.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% increased Shock Duration；Supported Skills have -30% more chance to Shock


### Life Drain

**Life Drain** · Tier 1 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing you to recover Life when it Culls an enemy.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Recover 12% of maximum Life over four seconds on Culling an Enemy


### Life Leech

**Life Leech I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing their Physical damage to Leech Life.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Leech 1200% of Physical Attack Damage from Supported Skills as Life

**Life Leech II** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing their Physical damage to Leech Life.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Leech 1600% of Physical Attack Damage from Supported Skills as Life

**Life Leech III** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing their Physical damage to Leech Life and preventing Leech gained this way from being removed at full Life.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Leech 1600% of Physical Attack Damage from Supported Skills as Life


### Lifetap

**Atalui's Bloodletting** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Physical`
- 效果：Supports any Skill, turning a portion of its Mana cost into a Life cost. Does not support Skills which reserve Spirit. Supported Skills Gain a portion of their Life cost as extra Physical Damage.
- 可辅助条件：（无限制）
- 禁止条件：Blessing OR Persistent
- 数值：Supported Skills cost 0% more Life；Supported Skills have 100% of Mana Costs Converted to Life Costs；Supported Skills Gain 2% of Damage as extra Physical Damage per 20 Life cost, up to 40%

**Lifetap** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports any Skill, turning its Mana cost into a Life cost. Does not support Skills which reserve Spirit.
- 可辅助条件：（无限制）
- 禁止条件：Blessing OR Persistent
- 数值：Supported Skills cost 0% more Life；Supported Skills have 100% of Mana Costs Converted to Life Costs


### Lightning Attunement

**Lightning Attunement** · Tier 1 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that deals damage, causing them to Gain Lightning Damage but deal less Cold and Fire Damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage
- 数值：`non_skill_base_all_damage_%_to_gain_as_lightning` = 25；Supported Skills deal -50% more Cold and Fire Damage


### Lightning Exposure

**Lightning Exposure** · Tier 4 · 需求 0/100/0 · 标签 `Lightning, Duration`
- 效果：Supports any skill that Hits enemies, causing it to inflict Exposure when inflicting Shock.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Supported Skills inflict Exposure for 8000 second on Shocking a target


### Lightning Penetration

**Lightning Penetration** · Tier 2 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies, making those Hits Penetrate enemy Lightning resistance.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills Penetrate 30% Lightning Resistance


### Living Lightning

**Living Lightning** · Tier 2 · 需求 0/0/100 · 标签 `Minion, Trigger, Lightning, Duration`
- 效果：Supports Skills which cause Damaging Hits. Living Lightning Minions are created when dealing Lightning damage with Supported Skills - bundles of living electricity that target nearby enemies with Chaining Attacks. Enemies will not directly engage these Minions, and can pass through them. Does not modify skills used by Minions.
- 可辅助条件：Attack OR Damage

**Living Lightning II** · Tier 4 · 需求 0/0/100 · 标签 `Minion, Trigger, Lightning, Duration`
- 效果：Supports Skills which cause Damaging Hits. Living Lightning Minions are created when dealing Lightning damage with Supported Skills - bundles of living electricity that target nearby enemies with Chaining Attacks. Enemies will not directly engage these Minions, and can pass through them. Does not modify skills used by Minions.
- 可辅助条件：Attack OR Damage


### Lockdown

**Lockdown** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing any Pin buildup it inflicts to be stronger the closer the enemy is to you.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Supported Skills have 120% more Pin Buildup against enemies within 2 metres of you, scaling to no change at 12 metres


### Long Fuse

**Long Fuse I** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which have a Detonation Time, causing those Skills to have much higher Detonation Time and detonation damage.
- 可辅助条件：DetonatesAfterTime
- 数值：Detonations from supported Skills deal 30% more Damage；50% increased Detonation Time

**Long Fuse II** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which have a Detonation Time, causing those Skills to have much higher Detonation Time and detonation damage.
- 可辅助条件：DetonatesAfterTime
- 数值：Detonations from supported Skills deal 35% more Damage；70% increased Detonation Time


### Longshot

**Longshot I** · Tier 2 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more damage from farther away.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 25% more Attack Damage to  enemies further than 7 metres from you, scaling down to no bonus at 3.5 metres or closer

**Longshot II** · Tier 3 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to deal more damage from farther away.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal 35% more Attack Damage to  enemies further than 7 metres from you, scaling down to no bonus at 3.5 metres or closer


### Loyalty

**Loyalty** · Tier 2 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports Skills that create Companions which can be damaged. Minions created by Supported Skills take a portion of Hit Damage you would otherwise have taken, but have lowered maximum Life.
- 可辅助条件：Companion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills have -30% more maximum Life；10% of Damage from Hits is taken from Supported Companion's Life before you

**Romira's Requital** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Minion`
- 效果：Supports Skills that create Companions which can be damaged. Minions created by Supported Skills take a portion of Hit Damage you would otherwise have taken, but have lowered maximum Life. A percentage of Damage taken this way is Recouped by you as Life.
- 可辅助条件：Companion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills have -30% more maximum Life；10% of Damage from Hits is taken from Supported Companion's Life before you；You Recoup 200% of Damage taken from Supported Minion's Life this way as Life


### Magnetism

**Magnetic Remnants** · Tier 0 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills which create Remnants, allowing those Remnants to be collected from further away.
- 可辅助条件：GeneratesRemnants
- 数值：Remnants created by Supported Skills can be collected from 35% further away


### Maim

**Maim** · Tier 2 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to Maim enemies.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 赋予类型：AppliesMaim
- 数值：Supported Attacks have 100% chance to Maim on Hit


### Malady

**Malady** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which can cause Damaging Hits, causing base chance to inflict Bleeding with Supported Skills to instead apply to base chance to Poison, and causing base chance to Poison to instead apply to Bleeding.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill


### Mana Flare

**Mana Flare** · Tier 2 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Fire`
- 效果：Supports any Spell that Hits enemies, causing it to trigger a Mana Flare on Critical Hit. The Mana Flare consumes your Mana to deal Fire damage. Cannot support the skills of Minions.
- 可辅助条件：Spell AND Damage
- 禁止条件：SkillGrantedBySupport


### Mana Leech

**Mana Leech** · Tier 2 · 需求 0/0/100 · 标签 `Attack, Physical`
- 效果：Supports Attacks, causing their Physical damage to Leech Mana.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 数值：Leech 800% of Physical Attack Damage from Supported Skills as Mana

**Oisin's Oath** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell`
- 效果：Supports Skills which Hit enemies, causing their Mana Leech to recover based on Elemental damage instead of Physical damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill OR Damage OR Spell


### Mark for Death

**Mark for Death** · Tier 2 · 需求 100/0/0 · 标签 `Mark, Physical`
- 效果：Supports Mark Skills. Enemies affected by Supported Marks will have their Armour Broken by Physical Damage they take.
- 可辅助条件：Mark
- 数值：Hits against targets Marked by Supported Skills Break Armour equal to 10% of Physical damage dealt

**Mark for Death II** · Tier 4 · 需求 100/0/0 · 标签 `Mark, Physical`
- 效果：Supports Mark Skills. Enemies affected by Supported Marks will have their Armour Broken by Physical Damage they take.
- 可辅助条件：Mark
- 数值：Hits against targets Marked by Supported Skills Break Armour equal to 15% of Physical damage dealt


### Mark of Siphoning

**Mark of Siphoning** · Tier 1 · 需求 0/0/100 · 标签 `Mark`
- 效果：Supports Mark Skills, causing enemies they Mark to Leech Mana to you when you Hit them with Attacks.
- 可辅助条件：Mark
- 数值：Enemies Marked by Supported Skills cause you to Leech Mana equal to 800% of Physical Attack Damage they take from your Hits

**Mark of Siphoning II** · Tier 4 · 需求 0/0/100 · 标签 `Mark`
- 效果：Supports Mark Skills, causing enemies they Mark to Leech Life and Mana to you when you Hit them with Attacks.
- 可辅助条件：Mark
- 数值：Enemies Marked by Supported Skills cause you to Leech Mana equal to 800% of Physical Attack Damage they take from your Hits；Enemies Marked by Supported Skills cause you to Leech Life equal to 800% of Physical Attack Damage they take from your Hits


### Mastery

**Chaos Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Chaos`
- 效果：Supports Chaos skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Chaos
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Chaos Skills

**Cold Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports Cold skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Cold
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Cold Skills

**Esh's Prowess** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Lightning`
- 效果：Supports Lightning Skills that Hit, granting them an additional level and causing them to only roll the minimum or maximum value for Lightning damage. Does not Support Skills which do not have levels.
- 可辅助条件：Lightning OR Damage
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Lightning Skills

**Fire Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Fire`
- 效果：Supports Fire skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Fire
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Fire Skills

**Lightning Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Lightning`
- 效果：Supports Lightning skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Lightning
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Lightning Skills

**Minion Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports Minion skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Minion
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Minion Skills

**Physical Mastery** · Tier 5 · 需求 0/0/100 · 标签 `Physical`
- 效果：Supports Physical skills, granting them an additional level. Does not support skills which do not have levels.
- 可辅助条件：Physical
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to Level of Supported Physical Skills


### Meat Shield

**Brutus' Brain** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Minion`
- 效果：Supports skills which create Minions, causing those Minions to be unable to deal or take Damage. Cannot support skills which create undamageable Minions.
- 可辅助条件：CreatesMinion
- 赋予类型：MinionsAreUndamagable

**Meat Shield I** · Tier 1 · 需求 100/0/0 · 标签 `Minion`
- 效果：Supports skills which create Minions, granting them less damage taken but making them deal less damage. Cannot support skills which create undamageable Minions.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills take -35% more Damage；Minions from Supported Skills deal -35% more Damage

**Meat Shield II** · Tier 3 · 需求 100/0/0 · 标签 `Minion`
- 效果：Supports skills which create Minions, granting them less damage taken but making them deal less damage.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills take -40% more Damage；Minions from Supported Skills deal -40% more Damage


### Minion Area of Effect

**Minion Splash I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Minion, Melee, Strike`
- 效果：Supports Skills which create Minions which Strike, causing those Minions' Strikes to have Melee Splash.
- 可辅助条件：CreatesMinion AND MeleeSingleTarget

**Minion Splash II** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Minion, Melee, Strike`
- 效果：Supports Skills which create Minions which Strike, increasing their Area of Effect and causing those Minions' Strikes to have Melee Splash.
- 可辅助条件：CreatesMinion AND MeleeSingleTarget
- 数值：`minion_skill_area_of_effect_+%` = 20


### Minion Instability

**Minion Instability** · Tier 2 · 需求 0/0/100 · 标签 `Minion, Fire`
- 效果：Supports skills which create Minions, causing them to violently explode when reduced to Low Life.
- 可辅助条件：CreatesMinion
- 禁止条件：MinionsAreUndamagable
- 数值：Minions from Supported Skills explode when reduced to Low Life, dealing 15% of their maximum Life as Fire Damage to surrounding Enemies


### Minion Pact

**Minion Pact I** · Tier 1 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports damaging skills you use yourself, draining the life from one of your Minions on use in order to boost the skill's damage. Only takes effect if you have a Minion with enough life to drain the full amount.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills remove 100% of your maximum Life from a nearby Minion on use to deal #% more damage；Supported Skills remove 30% of your maximum Life from a nearby Minion on use to deal #% more damage

**Minion Pact II** · Tier 4 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports damaging skills you use yourself, draining the life from one of your Minions on use in order to boost the skill's damage. Only takes effect if you have a Minion with enough life to drain the full amount.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills remove 150% of your maximum Life from a nearby Minion on use to deal #% more damage；Supported Skills remove 35% of your maximum Life from a nearby Minion on use to deal #% more damage


### Mobility

**Mobility** · Tier 3 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills that can be used while moving, allowing you to move faster while using them.
- 可辅助条件：UsableWhileMoving
- 数值：Supported Skills deal 0% more Damage；-25% more Movement Speed penalty while using Supported Skills


### Momentum

**Momentum** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports any damaging skill that you use yourself, causing it to deal more damage if you move a sufficient distance while using the skill. Teleportation does not count towards the distance travelled.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：After moving at least 20 metre during a single use of a Supported Skill, the rest of that use deals #% more Damage；After moving at least 40 metre during a single use of a Supported Skill, the rest of that use deals #% more Damage


### Murderous Intent

**Murderous Intent** · Tier 0 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills that can Empower skills other than themselves, causing skills they Empower to Cull enemies.
- 可辅助条件：EmpowersOtherSkill


### Muster

**Muster** · Tier 3 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports Skills which summon Minions. Supported Minions deal more Damage the more different kinds of Reviving Minions you have summoned.
- 可辅助条件：CreatesMinion
- 数值：Supported Minions deal 7% more damage for each different type of Reviving Minion you have summoned


### Mysticism

**Mysticism I** · Tier 2 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Spell Damage while on full Energy Shield while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 30% increased Spell Damage while on full Energy Shield while a Supported Skill is active

**Mysticism II** · Tier 4 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Spell Damage while on full Energy Shield while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 40% increased Spell Damage while on full Energy Shield while a Supported Skill is active


### Nimble Reload

**Nimble Reload** · Tier 4 · 需求 0/100/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills, causing them to Reload bolts significantly faster.
- 可辅助条件：CrossbowAmmoSkill OR CrossbowSkill
- 数值：Supported Skills have 60% increased Crossbow Reload Speed


### Nova Projectiles

**Nova Projectiles I** · Tier 2 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile Skills, making them fire Projectiles in a circle. Does not Support Skills which rain down Projectiles from above.
- 可辅助条件：Projectile OR ProjectileNumber OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：Rain OR ProjectilesNumberModifiersNotApplied
- 赋予类型：SupportedByNovaProjectiles


### Olroth's Conviction

**Olroth's Conviction** · Tier 0 · 需求 0/0/0 · 标签 `Lineage`
- 效果：Supports skills that can Empower a specific number of other skills, causing them to apply to more skill uses.
- 可辅助条件：EmpowersOtherSkill
- 禁止条件：IndeterminateEmpowermentAmount
- 数值：Supported Skills Gain 100% of Life and Mana Cost as Extra Runic Ward Cost；Supported Skills Empower an additional Skill use


### Opening Move

**Opening Move** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports Travel Skills which Hit enemies. Hits with Supported Skills against enemies on full life will Daze.
- 可辅助条件：(Attack OR Damage) AND Travel


### Overabundance

**Overabundance I** · Tier 1 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which have a Limit, increasing that Limit at the cost of their duration. Only applies to restrictions that use the word \"Limit\".
- 可辅助条件：Limit
- 数值：Supported Skills have +1 to Limit；Supported Skills have -50% more Skill Effect Duration

**Overabundance II** · Tier 4 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which have a Limit, increasing that Limit at the cost of their duration. Only applies to restrictions that use the word \"Limit\".
- 可辅助条件：Limit
- 数值：Supported Skills have +1 to Limit；Supported Skills have -40% more Skill Effect Duration


### Overcharge

**Overcharge** · Tier 4 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies, making its Shocks more effective but reflecting them back to you as well.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：50% increased Magnitude of Shocks inflicted with Supported Skills


### Overextend

**Overextend** · Tier 0 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attack Skills you use yourself. Supported Skills deal more Damage with Critical Hits, but Critically Hitting an Enemy with them will Daze you for a short time.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills have 30% more Critical Damage Bonus；You are Dazed for 5000 second on Critically Striking with Supported Skill


### Payload

**Payload** · Tier 4 · 需求 0/100/0 · 标签 `Grenade`
- 效果：Supports Skills which fire Grenades, giving fired Grenades a chance to activate again, but lengthening their cooldowns.
- 可辅助条件：Grenade
- 数值：Grenades fired by Supported Skills have 50% chance to activate a second time；Supported Skills have -70% increased Cooldown Recovery Rate


### Perfected Endurance

**Perfected Endurance** · Tier 4 · 需求 0/100/0 · 标签 `Channelling`
- 效果：Supports skills which have a benefit for Perfect Timing. Supported Skills grant at least one Endurance Charge when Hitting an enemy with Perfect Timing.
- 可辅助条件：PerfectTiming
- 数值：100% chance to gain an Endurance Charge when hitting an Enemy with Supported Skill when Perfectly Timed


### Perfection

**Perfection** · Tier 4 · 需求 0/100/0 · 标签 ``
- 效果：Supports skills which have a benefit for Perfectly Timing their use. On successfully executing Perfect Timing with Supported Skills, gain Perfection, which is a powerful damage buff. However, failing to execute any Perfect Timing (even with skills not supported by Perfection) will remove all Perfection on you.
- 可辅助条件：PerfectTiming
- 数值：Successfully executing Perfect Timing with Supported Skills grants Perfection All Perfection is lost on failing to execute any Perfect Timing

**Tasalio's Rhythm** · Tier 0 · 需求 0/100/0 · 标签 `Lineage`
- 效果：Supports Skills which have a benefit for Perfectly Timing their use. On successfully executing Perfect Timing with Supported Skills, gain Tasalio's Rhythm. Tasalio's Rhythm causes Supported Skills to deal more damage and have shorter Perfect Timing windows for each stack. Failing to execute any Perfect Timing (even with skills not supported by Tasalio's Rhythm) will remove all Tasalio's Rhythm on you.
- 可辅助条件：PerfectTiming
- 数值：Successfully executing Perfect Timing with Supported Skills grants a stack of Tasalio's Rhythm All Tasalio's Rhythm is lost on failing to execute any Perfect Timing  Supported Skills deal 10% more Damage for each stack of Tasalio's Rhythm  Supported Skills have a 30% shorter Perfect Timing window for each stack of Tasalio's Rhythm  Tasalio's Rhythm stacks up to 5 times；100% longer Perfect Timing window


### Perpetual Charge

**Perpetual Charge** · Tier 1 · 需求 0/0/100 · 标签 ``
- 效果：Supports skills that consume Power, Frenzy or Endurance Charges on use, giving them a chance not to remove each Charge while still gaining the benefits of consuming them.
- 可辅助条件：ConsumesCharges
- 数值：Supported Skills have 25% chance to not remove Charges but still count as consuming them


### Persistent Ground

**Persistent Ground I** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create Ground Surfaces, causing created Surfaces to last much longer.
- 可辅助条件：CreatesGroundEffect
- 数值：`ground_effect_duration_+%` = 50

**Persistent Ground II** · Tier 3 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create Ground Surfaces, causing created Surfaces to last much longer and only end when their duration expires.
- 可辅助条件：CreatesGroundEffect
- 数值：`ground_effect_duration_+%` = 50

**Persistent Ground III** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which create Ground Surfaces, causing created Surfaces to last much longer as well as lowering the Cooldown Recovery Speed of affected Enemies. Ground Surfaces from Supported Skills only end when their duration expires.
- 可辅助条件：CreatesGroundEffect
- 数值：`ground_effect_duration_+%` = 50；Ground Surfaces from Supported Skills apply Suppressive Ground Suppressive Ground grants -30% more Cooldown Recovery Rate


### Pierce

**Pierce I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making their Projectiles Pierce an enemy but deal less damage after doing so.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 数值：Projectiles from Supported Skills have 100% chance to Pierce an Enemy；Projectiles from Supported Skills deal -20% more Damage if they've Pierced an enemy

**Pierce II** · Tier 3 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making their Projectiles Pierce an enemy.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 数值：Projectiles from Supported Skills have 100% chance to Pierce an Enemy

**Pierce III** · Tier 5 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making their Projectiles Pierce an unlimited number of enemies, losing damage as they do so.
- 可辅助条件：Projectile
- 禁止条件：ProjectileNoCollision
- 数值：Projectiles from Supported Skills deal -20% more Damage for each Enemy they Pierce


### Pin

**Pin I** · Tier 1 · 需求 0/100/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, allowing its Physical damage to Pin enemies but making it unable to Stun.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：`support_pin_spell_pinned_art_variation` = 1

**Pin II** · Tier 2 · 需求 0/100/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, allowing its Physical damage to Pin enemies but making it unable to Stun, as well as granting Critial Hit Chance against Immobilised enemies.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：`support_pin_spell_pinned_art_variation` = 1；Supported Skills have 50% increased Critical Hit Chance against Immobilised Enemies

**Pin III** · Tier 5 · 需求 0/100/0 · 标签 `Physical`
- 效果：Supports any skill that Hits enemies, allowing its Physical damage to Pin enemies but making it unable to Stun. Pin buildup caused by Supported Skill is lessened, but Pin duration is significantly longer.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：`support_pin_spell_pinned_art_variation` = 1；Hits with Supported Skills cause -60% more Pin buildup；Pin caused by Supported Skills has 30% more duration


### Pinpoint Critical

**Pinpoint Critical** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill that Hits Enemies, causing it to Critically Hit more often but deal less damage with Critical Hits.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 60% more Critical Hit Chance；Supported Skills have -30% more Critical Damage Bonus


### Poison

**Poison I** · Tier 1 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, giving it a chance to Poison enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 40% chance to Poison on Hit

**Poison II** · Tier 3 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, giving it a chance to Poison enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 60% chance to Poison on Hit

**Poison III** · Tier 5 · 需求 0/100/0 · 标签 `Chaos`
- 效果：Supports any skill that Hits enemies, giving it a chance to Poison enemies and causing it to inflict more powerful Poisons against Bleeding Enemies.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 60% chance to Poison on Hit；20% more Magnitude of Poison inflicted by Supported Skills against Bleeding Enemies


### Poison Spores

**Poison Spores** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Buff, AoE, Trigger, Physical, Chaos, Duration, Plant`
- 效果：Supports Plant Skills which Hit enemies. Supported Skills Trigger Toxic Pustule on Hitting an enemy.
- 可辅助条件：(Attack OR Damage) AND Plant


### Potent Exposure

**Potent Exposure** · Tier 2 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Skills which apply Exposure to Enemies, increasing the effect of applied Exposure.
- 可辅助条件：Damage OR Spell OR DegenOnlySpellDamage OR CrossbowAmmoSkill OR Attack
- 数值：Exposure applied has 20% increased effect


### Practical Magic

**Practical Magic I** · Tier 3 · 需求 0/0/100 · 标签 `Spell, Duration`
- 效果：Supports Skills which Hit enemies. Heavy Stunning an enemy with Supported Skills increases your Spell damage for a duration.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Gain 30% increased Spell damage for # second on Heavy Stunning an enemy with Supported Skills；Gain 8000% increased Spell damage for # second on Heavy Stunning an enemy with Supported Skills

**Practical Magic II** · Tier 5 · 需求 0/0/100 · 标签 `Spell, Duration`
- 效果：Supports Skills which Hit enemies. Heavy Stunning an enemy with Supported Skills increases your Spell damage for a duration.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Gain 40% increased Spell damage for # second on Heavy Stunning an enemy with Supported Skills；Gain 8000% increased Spell damage for # second on Heavy Stunning an enemy with Supported Skills


### Practiced Combo

**Practiced Combo** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strike Skills. Supported Skills have a chance to build additional Combo on Hit. Cannot support Skills used by Minions.
- 可辅助条件：Attack AND MeleeSingleTarget
- 禁止条件：Minion
- 数值：Supported Strike Skills have a 40% chance to build an additional Combo on Hit


### Precision

**Precision I** · Tier 1 · 需求 0/100/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Accuracy while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：30% Increased Accuracy Rating while a Supported Skill is active

**Precision II** · Tier 4 · 需求 0/100/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain increased Accuracy while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：50% Increased Accuracy Rating while a Supported Skill is active


### Profanity

**Profanity I** · Tier 1 · 需求 0/0/100 · 标签 `Chaos`
- 效果：Supports Skills you use yourself. Supported Skills consume a Corpse on use, dealing more Chaos Damage if they do.
- 可辅助条件：（无限制）
- 禁止条件：Aura OR UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills deal 30% more Chaos Damage if consuming a Corpse；Supported Skills consume a Corpse within 50 metres on use, if possible；Supported Skills consume a Corpse within 1 metres on use, if possible

**Profanity II** · Tier 5 · 需求 0/0/100 · 标签 `Chaos`
- 效果：Supports Skills you use yourself. Supported Skills consume many Corpses on use, dealing more Chaos Damage per Corpse consumed.
- 可辅助条件：（无限制）
- 禁止条件：Aura OR UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills consume a Corpse within 50 metres on use, if possible；Supported Skills consume a Corpse within 10 metres on use, if possible；Supported Skills deal 5% more Chaos Damage for each Corpse consumed this way


### Projectile Speed

**Projectile Acceleration I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making those Projectiles travel faster.
- 可辅助条件：Projectile OR ProjectileSpeed
- 禁止条件：FixedSpeedProjectile
- 数值：Supported Skills have 40% more Projectile Speed

**Projectile Acceleration II** · Tier 4 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making those Projectiles travel faster, and granting them a chance to Pierce Enemies.
- 可辅助条件：Projectile OR ProjectileSpeed
- 禁止条件：FixedSpeedProjectile
- 数值：Supported Skills have 40% more Projectile Speed；Projectiles from Supported Skills have 40% chance to Pierce an Enemy

**Projectile Acceleration III** · Tier 5 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making those Projectiles travel faster, and causing increases and reductions to Projectile speed to also apply to Damage.
- 可辅助条件：Projectile OR ProjectileSpeed
- 禁止条件：FixedSpeedProjectile
- 数值：Supported Skills have 40% more Projectile Speed

**Projectile Deceleration I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making those Projectiles travel more slowly.
- 可辅助条件：Projectile OR ProjectileSpeed
- 禁止条件：FixedSpeedProjectile
- 数值：Supported Skills have -25% more Projectile Speed

**Projectile Deceleration II** · Tier 3 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Projectile skills, making those Projectiles travel more slowly.
- 可辅助条件：Projectile OR ProjectileSpeed
- 禁止条件：FixedSpeedProjectile
- 数值：Supported Skills have -30% more Projectile Speed

**Vilenta's Propulsion** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, Projectile`
- 效果：Supports Spell Skills that fire Projectiles, causing increases and reductions to cast speed to also apply to Projectile speed.
- 可辅助条件：Spell AND Projectile
- 禁止条件：FixedSpeedProjectile
- 数值：75% of increases and reductions to Cast speed also apply to Projectile Speed for Supported Skills


### Prolonged Duration

**Prolonged Duration I** · Tier 1 · 需求 100/0/0 · 标签 `Duration`
- 效果：Supports any skill that has a duration, making that duration longer.
- 可辅助条件：Duration
- 数值：Supported Skills have 30% more Skill Effect Duration

**Prolonged Duration II** · Tier 3 · 需求 100/0/0 · 标签 `Duration`
- 效果：Supports any skill that has a duration, making that duration longer.
- 可辅助条件：Duration
- 数值：Supported Skills have 35% more Skill Effect Duration


### Prototype

**Prototype Seventeen** · Tier 0 · 需求 0/0/0 · 标签 `Lineage`
- 效果：Supports non-Channelling skill you use yourself that Hits enemies, causing it to gain Critical Hit chance based on Rage, but also remove all Rage upon Critically Hitting.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Channel
- 数值：Supported Skills get 20% increased Critical Hit chance per 5 Rage；Lose 100% of your Maximum Rage when you deal a Critical Hit with Supported Skills


### Punch Through

**Punch Through** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills. Supported Skills apply Easy Target when Knocking Back Enemies, causing the next Projectile Attack Hit they take to deal increased Damage.
- 可辅助条件：Melee
- 数值：Supported Skills apply Easy Target on Knockback Easy Target applied this way has a magnitude of 3% per metre of Expected Knockback Distance


### Pursuit

**Pursuit I** · Tier 1 · 需求 0/100/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks. Supported Skills deal more Melee damage if you have struck with a Projectile Attack Hit in the last eight seconds, but cannot themselves deal Projectile Damage.
- 可辅助条件：Melee AND Attack
- 数值：Supported Skills deal 20% more Melee Damage if you have Damaged an Enemy with a Projectile Attack Hit in the last eight seconds；Supported Skills deal no Projectile damage

**Pursuit II** · Tier 3 · 需求 0/100/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks. Supported Skills deal more Melee damage if you have struck with a Projectile Attack Hit in the last eight seconds, but cannot themselves deal Projectile Damage.
- 可辅助条件：Melee AND Attack
- 数值：Supported Skills deal 25% more Melee Damage if you have Damaged an Enemy with a Projectile Attack Hit in the last eight seconds；Supported Skills deal no Projectile damage

**Pursuit III** · Tier 5 · 需求 0/100/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks. Supported Skills deal more Melee damage if you have struck with a Projectile Attack Hit in the last two seconds, but cannot themselves deal Projectile Damage.
- 可辅助条件：Melee AND Attack
- 数值：Supported Skills deal 30% more Melee Damage if you have Damaged an Enemy with a Projectile Attack Hit in the last two seconds；Supported Skills deal no Projectile damage


### Quill Burst

**Quill Burst** · Tier 3 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Trigger, Physical`
- 效果：Supports Melee Attack Skills. Supported Skills trigger Quill Burst, which deals your Thorns Damage in an Area around the target struck. Quill Burst can only be triggered on Hit after you've\nRetaliated with Thorns Damage.
- 可辅助条件：Melee AND Attack
- 禁止条件：SkillGrantedBySupport
- 数值：Supported Skills trigger Quill Burst on their next Hit after you Retaliate with Thorns


### Rage

**Medved's Felling** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Attack, Melee`
- 效果：Supports Melee Attacks you use yourself, causing them to attack faster the more Rage you have and grant Rage on Hit, but also making you lose Life based on your Rage when using them. 
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills grant 10% of Maximum Rage on Melee hit；Lose 1% of Maximum Life per 5 Rage when  you use Supported Skills；Supported Skills have 5% increased Attack Speed per 5 Rage

**Rage I** · Tier 1 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks, causing them to grant Rage on Hit.
- 可辅助条件：Melee
- 数值：Supported Skills grant 3 Rage on Melee Hit；Supported Skills deal 0% more Attack Damage

**Rage II** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks, causing them to grant Rage on Hit.
- 可辅助条件：Melee
- 数值：Supported Skills grant 5 Rage on Melee Hit；Supported Skills deal 0% more Attack Damage

**Rage III** · Tier 5 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attacks, causing them to grant Rage on Hit. Supported Skills have signficantly higher Attack speed while you or supported minion are not at maximum Rage.
- 可辅助条件：Melee
- 数值：Supported Skills grant 5 Rage on Melee Hit；Supported Skills deal 0% more Attack Damage；Supported Skills have 15% increased Attack speed while you are not at maximum Rage


### Rageforged

**Rageforged I** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports any damaging skill that you use or Trigger yourself, causing it to spend Rage to deal more damage. If you don't have enough Rage to spend, the damage bonus will not apply.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill OR DegenOnlySpellDamage OR DamageOverTime
- 禁止条件：UsedByProxy OR Persistent
- 赋予类型：ConsumesRage
- 数值：Supported Skills spend 10 Rage if possible to deal #% more Damage；Supported Skills spend 35 Rage if possible to deal #% more Damage

**Rageforged II** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports any damaging skill that you use or Trigger yourself, causing it to spend Rage to deal more damage, with a chance to skip spending Rage while still benefitting as though it had. If you don't have enough Rage to spend, the damage bonus will not apply.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill OR DegenOnlySpellDamage OR DamageOverTime
- 禁止条件：UsedByProxy OR Persistent
- 赋予类型：ConsumesRage
- 数值：Supported Skills spend 10 Rage if possible to deal #% more Damage；Supported Skills spend 35 Rage if possible to deal #% more Damage；Supported Skills have 30% chance to gain the benefits of this Support without spending additional Rage


### Raging Cry

**Raging Cry** · Tier 2 · 需求 100/0/0 · 标签 `Warcry`
- 效果：Supports Warcry skills, causing them to grant you Rage on use depending on counted monster Power.
- 可辅助条件：Warcry
- 数值：Supported Skills grant 4 Rage per 5 Power of counted Enemies in range


### Rakiata's Flow

**Rakiata's Flow** · Tier 0 · 需求 0/100/0 · 标签 `Lineage`
- 效果：Supports Skills that can cause Damaging Hits, causing those Hits to treat Enemy Elemental Resistances as inverted.
- 可辅助条件：Damage OR Attack
- 数值：Hits with Supported Skills have 100% chance to treat Enemy Monster Elemental Resistance values as inverted


### Rapid Attacks

**Rapid Attacks I** · Tier 1 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to Attack faster.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：Herald OR NoAttackOrCastTime
- 数值：Supported Skills have 15% increased Attack Speed

**Rapid Attacks II** · Tier 4 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to Attack faster.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：Herald OR NoAttackOrCastTime
- 数值：Supported Skills have 25% increased Attack Speed

**Rapid Attacks III** · Tier 5 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks, causing them to Attack faster at the cost of Damage.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：Herald OR NoAttackOrCastTime
- 数值：Supported Skills have 35% increased Attack Speed；Supported Skills deal -50% more Damage


### Rapid Casting

**Rapid Casting I** · Tier 1 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spells, causing them to cast faster.
- 可辅助条件：Spell
- 禁止条件：Instant OR FixedCastTime OR NoAttackOrCastTime
- 数值：Supported Skills have 15% increased Cast Speed

**Rapid Casting II** · Tier 4 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spells, causing them to cast faster.
- 可辅助条件：Spell
- 禁止条件：Instant OR FixedCastTime OR NoAttackOrCastTime
- 数值：Supported Skills have 20% increased Cast Speed

**Rapid Casting III** · Tier 5 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spells, causing them to cast faster for each different Spell you've cast in the last eight seconds.
- 可辅助条件：Spell
- 禁止条件：Instant OR FixedCastTime OR NoAttackOrCastTime
- 数值：Supported Skills have 10% increased Cast Speed for each different Spell you've Cast in the last eight seconds


### Rearm

**Rearm I** · Tier 3 · 需求 0/100/0 · 标签 `Hazard`
- 效果：Supports Skills which create Hazards. Hazards created by Supported Skills have a chance to be rearmed a short duration after triggering.
- 可辅助条件：Hazard
- 数值：Hazards created by Supported Skills rearm after they are triggered

**Rearm II** · Tier 5 · 需求 0/100/0 · 标签 `Hazard`
- 效果：Supports Skills which create Hazards. Hazards created by Supported Skills have a chance to be rearmed a short duration after triggering.
- 可辅助条件：Hazard
- 数值：Hazards created by Supported Skills rearm after they are triggered


### Refraction

**Refraction I** · Tier 2 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Banner Skills, causing those affected by Auras they create to gain Refractive Plating, a Buff which grants Deflection Rating and causes Armour to partially apply to Elemental Hit Damage.
- 可辅助条件：Banner AND (Persistent AND Buff)
- 数值：Refractive Plating causes 20% of Armour to apply to Elemental Hit Damage taken；Refractive Plating grants Deflection Rating equal to 15% of Evasion Rating

**Refraction II** · Tier 3 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Banner Skills, causing those affected by Auras they create to gain Refractive Plating, a Buff which grants Deflection Rating and causes Armour to partially apply to Elemental Hit Damage.
- 可辅助条件：Banner AND (Persistent AND Buff)
- 数值：Refractive Plating causes 30% of Armour to apply to Elemental Hit Damage taken；Refractive Plating grants Deflection Rating equal to 20% of Evasion Rating

**Refraction III** · Tier 5 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Banner Skills, causing Enemies within their area to gain Refractive Dissolution, a Debuff which lowers Elemental Resistances.
- 可辅助条件：Banner AND (Persistent AND Buff)
- 数值：Supported Banners apply Refractive Dissolution to Enemies in their radius Refractive Dissolution applies 2% Elemental Exposure per 1000 player Armour, up to 80%


### Reinforced Totems

**Reinforced Totems I** · Tier 3 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems. Totems created by Supported Skills have additional Elemental Resistances.
- 可辅助条件：SummonsTotem
- 数值：Totems summoned by Supported Skills have +40% to all Elemental Resistances；Totems summoned by Supported Skills have {0:+d}% to all Maximum Elemental Resistances

**Reinforced Totems II** · Tier 5 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems. Totems created by Supported Skills have additional Elemental Resistances.
- 可辅助条件：SummonsTotem
- 数值：Totems summoned by Supported Skills have +40% to all Elemental Resistances；Totems summoned by Supported Skills have {0:+d}% to all Maximum Elemental Resistances


### Relentless Rage

**Relentless Rage** · Tier 0 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills you use yourself. On spending Rage with any skill you will gain a Buff. Using Supported Skills consumes this Buff to grant you Rage.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Spending 30 Rage grants you a Relentless Rage Buff, causing the next use of Supported Skills to consume that Buff to grant # Rage；Spending 10 Rage grants you a Relentless Rage Buff, causing the next use of Supported Skills to consume that Buff to grant # Rage


### Remnant Potency

**Remnant Potency I** · Tier 2 · 需求 100/0/0 · 标签 `Remnant`
- 效果：Supports Skills which create Remnants, making those Remnants more powerful.
- 可辅助条件：GeneratesRemnants
- 数值：Remnants from Supported Skills have 20% increased effect

**Remnant Potency II** · Tier 3 · 需求 100/0/0 · 标签 `Remnant`
- 效果：Supports Skills which create Remnants, making those Remnants more powerful, but delaying their effect.
- 可辅助条件：GeneratesRemnants
- 数值：Effects of Remnants generated by Supported Skills occur 4000 second after being collected；Remnants from Supported Skills have 30% increased effect

**Remnant Potency III** · Tier 4 · 需求 100/0/0 · 标签 `Remnant`
- 效果：Supports Skills which create Remnants, making those Remnants more powerful, but delaying their effect.
- 可辅助条件：GeneratesRemnants
- 数值：Remnants from Supported Skills have 40% increased effect；Effects of Remnants generated by Supported Skills occur 3000 second after being collected


### Rending Apex

**Rending Apex** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Strike`
- 效果：Supports Strikes that perform a Final Strike at the end of a combination of attacks, causing the Final Strike to Break Armour based on a portion of Attack damage dealt.
- 可辅助条件：PerformsFinalStrike
- 数值：Final Strikes of Supported Skills Break Armour equal to 75% of Attack Damage dealt


### Retaliate

**Retaliate I** · Tier 2 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills you use yourself. Supported Skills gain much more damage the closer you are to being Heavily Stunned.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills deal up to 40% more Attack Damage, scaling up as your Stun Bar increases

**Retaliate II** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills you use yourself. Supported Skills gain much more damage and are more capable of Stunning Enemies the closer you are to being Heavily Stunned.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills deal up to 40% more Attack Damage, scaling up as your Stun Bar increases；Hits from Supported Skills Stun Enemies as though dealing more Damage equivalent to the current percentage of your Stun Bar


### Retort

**Frenzied Riposte** · Tier 2 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attacks you use or Trigger yourself, causing them to Consume the Parried Debuff on Hit to grant you a Frenzy Charge. Cannot support Skills which already Consume the Parried Debuff.
- 可辅助条件：Attack
- 禁止条件：UsedByProxy OR Persistent OR (SkillConsumesParried AND NOT SupportedByFrenziedRiposte)
- 赋予类型：SkillConsumesParried, SupportedByFrenziedRiposte
- 数值：Supported Skills Consume Parried Debuff on Hit to grant a Frenzy Charge


### Retreat

**Retreat I** · Tier 1 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Skills which create Projectiles. Supported Skills deal more damage with Projectiles if you have struck with a Melee Hit in the last eight seconds, but cannot themselves deal Melee Damage.
- 可辅助条件：Projectile
- 数值：Supported Skills deal 20% more Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last 8 seconds；Supported Skills deal no Melee damage

**Retreat II** · Tier 3 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Skills which create Projectiles. Supported Skills deal more damage with Projectiles if you have struck with a Melee Hit in the last eight seconds, but cannot themselves deal Melee Damage.
- 可辅助条件：Projectile
- 数值：Supported Skills deal 25% more Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last 8 seconds；Supported Skills deal no Melee damage

**Retreat III** · Tier 5 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports Skills which create Projectiles. Supported Skills deal more damage with Projectiles if you have struck with a Melee Hit in the last two seconds, but cannot themselves deal Melee Damage.
- 可辅助条件：Projectile
- 数值：Supported Skills deal 30% more Projectile Damage if you have Damaged an Enemy with a Melee Hit in the last 2 seconds；Supported Skills deal no Melee damage


### Reverberate

**Reverberate** · Tier 0 · 需求 100/0/0 · 标签 `Attack, Melee, Slam`
- 效果：Supports Slam Skills. Supported Skills that have a chance to Aftershock have increased chance to cause Aftershocks the longer their Attack time.
- 可辅助条件：Slam
- 数值：Supported Skills have 15% increased chance to cause Aftershocks for every quarter second of Attack time


### Ricochet

**Ricochet I** · Tier 2 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports any Skill which creates Projectiles, giving those Projectiles a chance to Chain when impacting terrain.
- 可辅助条件：Projectile
- 禁止条件：CannotChain OR CannotTerrainChain
- 数值：Projectiles from Supported Skills have 40% chance to Chain an additional time from terrain

**Ricochet II** · Tier 4 · 需求 0/100/0 · 标签 `Projectile`
- 效果：Supports any Skill which creates Projectiles, giving those Projectiles a chance to Chain when impacting terrain.
- 可辅助条件：Projectile
- 禁止条件：CannotChain OR CannotTerrainChain
- 数值：Projectiles from Supported Skills have 50% chance to Chain an additional time from terrain


### Rigwald's Ferocity

**Rigwald's Ferocity** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Attack`
- 效果：Supports Attack skills, granting them Attack Speed at the cost of Damage or Damage at the cost of Attack Speed depending on Weapon Set they are used in. Does not modify skills used by Minions.
- 可辅助条件：Attack
- 禁止条件：NoAttackOrCastTime OR Instant
- 数值：Supported Skills have 30% increased Attack Speed if used in Weapon Set I；Supported Skills deal -15% more Damage if used in Weapon Set I；Supported Skills have -10% increased Attack Speed if used in Weapon Set II；Supported Skills deal 30% more Damage if used in Weapon Set II


### Rip

**Rip** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Physical, Duration, Remnant`
- 效果：Supports Melee Attack Skills you use or Trigger yourself. Killing Blows with Supported Skills on Bleeding enemies create a Blood Remnant. Blood Remnants increase your Life regeneration rate for a short while after being collected.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Persistent
- 赋予类型：GeneratesRemnants, Duration
- 数值：Supported Skills have 100% chance to create a Blood Remnant when dealing a killing blow to a Bleeding Enemy Remnants created this way increase Life regeneration rate by #% for # seconds when collected, up to a maximum of 100%；Remnants are created within a 15 metre radius of the slain Enemy；Remnants created by Supported Skills last for 8000 second；Supported Skills have 5000% chance to create a Blood Remnant when dealing a killing blow to a Bleeding Enemy Remnants created this way increase Life regeneration rate by #% for # seconds when collected, up to a maximum of 100%；Supported Skills have 10% chance to create a Blood Remnant when dealing a killing blow to a Bleeding Enemy Remnants created this way increase Life regeneration rate by #% for # seconds when collected, up to a maximum of 100%


### Rising Tempest

**Rising Tempest** · Tier 2 · 需求 0/0/100 · 标签 ``
- 效果：Supports Skills which deal Damage, raising Elemental Damage dealt for each Skill used Recently of a different Elemental type. Cannot support Minion Skills.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 禁止条件：Minion OR Persistent
- 数值：Supported Skills deal 12% more Elemental Damage for each Skill used Recently of a different Elemental type


### Ritualistic Curse

**Ritualistic Curse** · Tier 3 · 需求 0/0/100 · 标签 `AoE, Curse`
- 效果：Supports Curse skills, causing them to cover a larger area but take longer to Curse enemies.
- 可辅助条件：AppliesCurse
- 数值：Curse zones from Supported Skills erupt after 30% more delay；Supported Skills have 50% increased Area of Effect


### Runic Extraction

**Runic Extraction** · Tier 0 · 需求 0/0/0 · 标签 `Remnant`
- 效果：Supports any Skill that deals damage. Enemies you kill with supported Skills have a chance to drop a Verisium Infusion Remnant.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills have 35% chance create a Verisium Infusion Remnant on kill；Remnants created by Supported Skills last for 8000 second；Supported Skills Gain 20% of Life and Mana Cost as Extra Runic Ward Cost


### Runic Infusion

**Olroth's Hubris** · Tier 0 · 需求 0/0/0 · 标签 `Lineage`
- 效果：Supports Attacks you use or Trigger yourself, causing them to cost Runic Ward to use but deal additional Physical and Cold damage based on their Runic Ward cost, in addition to causing Physical damage to Contribute to Freeze buildup. Cannot Support Channelling Skills, Sustained Skills, or Skills without a cost.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：Persistent OR Minion OR UsedByTotem OR SummonsTotem OR Channel OR Sustained OR HasNoCost
- 数值：Supported Skills cost an additional 20% of maximum Runic Ward；Supported Skills deal added Physical damage equal to 15% of Runic Ward cost；Supported Skills deal added Cold damage equal to 15% of Runic Ward cost

**Runic Infusion** · Tier 0 · 需求 0/0/0 · 标签 `Attack, Physical`
- 效果：Supports Attacks you use or Trigger yourself, causing them to cost Runic Ward to use but deal additional Physical damage based on their Runic Ward cost. Cannot Support Channelling Skills, Sustained Skills, or Skills without a cost.
- 可辅助条件：Attack OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Persistent OR Channel OR Sustained OR HasNoCost
- 数值：Supported Skills cost an additional 20% of maximum Runic Ward；Supported Skills deal added Physical damage equal to 25% of Runic Ward cost


### Rupture

**Rupture** · Tier 3 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports skills that Hit Enemies. Supported skills Aggravate Bleeding on Hitting Heavily Stunned Enemies.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill


### Rusted Spikes

**Rusted Spikes** · Tier 0 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which deal Damage with Hits. When Supported Skills Pin an Enemy, they also Aggravate Bleeding on that Enemy.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：DegenOnlySpellDamage
- 数值：Supported Skills have 100% chance to Aggravate Bleeding on Enemies when Pinning them


### Ruthless

**Ruthless** · Tier 0 · 需求 100/0/0 · 标签 ``
- 效果：Supports Attacks, causing repeated uses to be more effective at Stunning enemies.
- 可辅助条件：Attack
- 数值：Every second use of Supported Attacks causes #% more Stun Buildup；Every second use of Supported Attacks causes #% more Stun Buildup


### Sacrificial Lamb

**Sacrificial Lamb I** · Tier 1 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports Skills which create Minions, causing your Skills which can target Minions to prioritise targeting Minions from the Supported Skill before your other Minions where possible.
- 可辅助条件：CreatesMinion
- 数值：Your Skills target Minions from Supported Skills within 60 metre if possible

**Sacrificial Lamb II** · Tier 3 · 需求 0/0/100 · 标签 `Minion`
- 效果：Supports Skills which create Minions, causing your Skills which can target Minions to prioritise targeting Minions from the Supported Skill before your other Minions where possible, as well as causing them to always be considered Detonatable.
- 可辅助条件：CreatesMinion
- 数值：Your Skills target Minions from Supported Skills within 60 metre if possible


### Sacrificial Offering

**Guatelitzi's Ablation** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports Offering Skills. Supported Skills Sacrifice a portion of your life on use. While Offering spikes from Supported Skills persist, you are periodically granted a Power Charge. When spikes from Supported Skills die, Regenerate a percentage of your maximum Life and Mana per second based on the duration the Offering persisted.
- 可辅助条件：Offering
- 赋予类型：GeneratesCharges
- 数值：Supported Skills Sacrifice 25% of Life on use；When an Offering from Supported Skills dies, Regenerate 300% of your Life and Mana per second, for as long as that Offering was alive；Offerings from Supported Skills grant you a Power Charge every 4000 seconds

**Sacrificial Offering** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports Offering Skills. Supported Skills Sacrifice a portion of your life on use, but deal much more damage and have more powerful Buffs in return.
- 可辅助条件：Offering
- 数值：Supported Offering Skills deal 30% more Damage；Supported Offering Skills have 30% increased Buff effect；Supported Skills Sacrifice 15% of Life on use


### Seal

**Unleash** · Tier 1 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Repeatable Spells you cast yourself, Sealing them over time. The Seals are broken when cast, each causing the Spell to Repeat. Cannot support skills with a Cooldown or which already gain Seals.
- 可辅助条件：Unleashable AND Spell
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Instant OR Channel OR Cooldown OR ComboStacking OR (HasSeals AND NOT SupportedByUnleash)
- 赋予类型：HasSeals, SupportedByUnleash
- 数值：Supported Skills deal -50% more Damage when Repeating；Supported Spells gain a Seal every 200% of cast time；Supported Skills have a maximum of 2 Seal；Supported Skills Repeat 1 time per Seal broken

**Zarokh's Revolt** · Tier 0 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Repeatable Spells you cast yourself, Sealing them over time and giving them a moderate Cooldown. The Seals are broken when cast, each causing the Spell to Repeat. Cannot support skills which already have a Cooldown or gain seals.
- 可辅助条件：Unleashable AND Spell
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Instant OR Channel OR ComboStacking OR (HasSeals AND NOT SupportedByUnleash)
- 赋予类型：HasSeals, SupportedByUnleash, Cooldown
- 数值：Supported Skills deal -20% more Damage when Repeating；Supported Spells gain a Seal every 50% of cast time；Supported Skills have a maximum of 5 Seal；Supported Skills Repeat 1 time per Seal broken


### Seal, Increased Area of Effect

**Expand** · Tier 5 · 需求 0/0/100 · 标签 `Spell, AoE`
- 效果：Supports Spells you cast yourself, Sealing them over time. The Seals are broken when cast, increasing area of effect. Cannot support Channelling Skills or Skills with a Cooldown or which already gain Seals.
- 可辅助条件：Spell AND Area
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Instant OR Channel OR Cooldown OR ComboStacking OR (HasSeals AND NOT SupportedByExpand)
- 赋予类型：HasSeals, SupportedByExpand
- 数值：Supported Skills have a maximum of 3 Seal；Supported Spells gain a Seal every 200% of cast time；Supported Skills get 30% increased area of effect per Seal broken


### Searing Flame

**Scouring Flame** · Tier 0 · 需求 0/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing inflicted Ignites to deal more damage but the skill to gain a Runic Ward cost.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：50% more Magnitude of Ignite inflicted with Supported Skills；Supported Skills Gain 25% of Life and Mana Cost as Extra Runic Ward Cost

**Searing Flame I** · Tier 3 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing inflicted Ignites to deal more damage but its Hits to deal less damage.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal -25% more Damage with Hits；75% more Magnitude of Ignite inflicted with Supported Skills

**Searing Flame II** · Tier 4 · 需求 100/0/0 · 标签 `Fire`
- 效果：Supports any skill that Hits enemies, causing inflicted Ignites to deal more damage but its Hits to deal less damage.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills deal -30% more Damage with Hits；100% more Magnitude of Ignite inflicted with Supported Skills


### Second Wind

**Second Wind I** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which have a cooldown, giving them extra uses of that cooldown. Cannot support Meta, instant, or Triggered Skills, and cannot modify the Skills of Minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 禁止条件：Triggered OR Instant OR Meta
- 数值：Supported Skills have -50% more Cooldown Recovery Rate

**Second Wind II** · Tier 4 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which have a cooldown, giving them extra uses of that cooldown. Cannot support Meta, instant, or Triggered Skills, and cannot modify the Skills of Minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 禁止条件：Triggered OR Instant OR Meta
- 数值：Supported Skills have -40% more Cooldown Recovery Rate

**Second Wind III** · Tier 5 · 需求 0/100/0 · 标签 ``
- 效果：Supports Skills which have a cooldown, giving them extra uses of that cooldown and causing them to recover your Life when a Skill is used and goes on cooldown. Cannot support Meta, instant, or Triggered Skills, and cannot modify the Skills of Minions.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 禁止条件：Triggered OR Instant OR Meta
- 数值：Supported Skills have -40% more Cooldown Recovery Rate；When a Supported Skill is used and goes on cooldown, recover 1% of maximum Life per second of cooldown

**Uhtred's Constellation** · Tier 0 · 需求 0/0/0 · 标签 `Lineage`
- 效果：Supports non-instant skills which have a cooldown, granting them two additional cooldown uses and more damage per different skill with a cooldown you have used recently.
- 可辅助条件：Cooldown OR AffectedByCooldownRate
- 禁止条件：Instant
- 数值：Supported Skills deal 8% more Damage for each different Skill with a Cooldown you have used in the last 8 seconds；Supported Non-Instant Skills have {0:+d} Cooldown Use；Supported Skills have -50% more Cooldown Recovery Rate


### Selfless Remnants

**Selfless Remnants** · Tier 2 · 需求 100/0/0 · 标签 `Remnant`
- 效果：Supports Skills that generate Remnants, causing those Remnants to affect Allies in your Presence when collected instead of you.
- 可辅助条件：GeneratesRemnants
- 禁止条件：RemnantCannotBeShared


### Seraph's Heart

**Seraph's Heart** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Buff, Persistent`
- 效果：Supports Persistent Buff Skills, providing a chance for enemies to calculate their Hits as though your Resistances were 90% while the skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Enemy Hits have 20% chance to treat all your Resistances as being 90% while a Supported Skill is active


### Shock

**Shock** · Tier 1 · 需求 0/100/0 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies, making it more likely to Shock.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% more chance to Shock


### Shock Conduction

**Shock Conduction** · Tier 2 · 需求 0/0/100 · 标签 `AoE, Lightning`
- 效果：Supports any skill that Hits enemies, giving it a chance to also Shock nearby enemies when you Shock an enemy.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Shocking Hits from supported Skills have a 50% chance to also Shock enemies in a # metre radius；Shocking Hits from supported Skills have a 25% chance to also Shock enemies in a # metre radius

**Shock Conduction II** · Tier 0 · 需求 0/0/100 · 标签 `AoE, Lightning`
- 效果：Supports any skill that Hits enemies, giving it a chance to also Shock nearby enemies when you Shock an enemy. Always Shocks enemies which are Drenched.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Shocking Hits from supported Skills have a 50% chance to also Shock enemies in a # metre radius；Shocking Hits from supported Skills have a 25% chance to also Shock enemies in a # metre radius


### Shock Siphon

**Shock Siphon** · Tier 0 · 需求 0/0/100 · 标签 `Lightning`
- 效果：Supports any skill that Hits enemies, causing you to recover Energy Shield when it kills a Shocked enemy.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Recover 4% of maximum Energy Shield when a Supported Skill deals a Killing Blow to a Shocked enemy


### Shocking Leap

**Shocking Leap** · Tier 2 · 需求 0/100/0 · 标签 `AoE, Duration`
- 效果：Supports Skills that leap into the air and deal damage, causing them to create Shocked Ground the first time they Critically Hit an enemy.
- 可辅助条件：Jumping
- 赋予类型：CreatesGroundEffect, Area, Duration
- 数值：Supported Skills create Shocked Ground for 4000 second when they Critically Hit, no more than once per Skill use Shocked Ground created this way has a radius of # metre；Supported Skills create Shocked Ground for 20 second when they Critically Hit, no more than once per Skill use Shocked Ground created this way has a radius of # metre


### Short Fuse

**Short Fuse I** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which Detonate after some amount of time has elapsed, shortening the time before Detonation. 
- 可辅助条件：DetonatesAfterTime
- 数值：`support_fast_forward_detonation_time_+%_final` = -40

**Short Fuse II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports Skills which Detonate after some amount of time has elapsed, massively shortening the time before Detonation at the cost of Damage.
- 可辅助条件：DetonatesAfterTime
- 数值：`support_fast_forward_detonation_time_+%_final` = -80；Supported Skills deal -30% more Damage


### Skittering Stone

**Skittering Stone I** · Tier 2 · 需求 100/0/0 · 标签 `Minion, Trigger, Physical, Duration`
- 效果：Supports Skills which create shatterable earthen objects. After killing enough Enemies in range of these objects, they will shatter, releasing skittering stone Minions.
- 可辅助条件：CanCreateStoneElementals
- 数值：After 5 Enemy is killed within # metre of objects created by Supported Skills, they will shatter and Trigger Skittering Stones；After 40 Enemy is killed within # metre of objects created by Supported Skills, they will shatter and Trigger Skittering Stones；`support_chance_to_trigger_hatching_elementals_%` = 100

**Skittering Stone II** · Tier 4 · 需求 100/0/0 · 标签 `Minion, Trigger, Physical, Duration`
- 效果：Supports Skills which create shatterable earthen objects. After killing enough Enemies in range of these objects, they will shatter, releasing skittering stone Minions.
- 可辅助条件：CanCreateStoneElementals
- 数值：After 5 Enemy is killed within # metre of objects created by Supported Skills, they will shatter and Trigger Skittering Stones；After 40 Enemy is killed within # metre of objects created by Supported Skills, they will shatter and Trigger Skittering Stones；`support_chance_to_trigger_hatching_elementals_%` = 100


### Soul Drain

**Soul Drain** · Tier 3 · 需求 0/100/0 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing you to recover Mana when it Culls an enemy.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Recover {}% of maximum Mana over four seconds when Supported Skills Cull an Enemy


### Spar

**Spar** · Tier 0 · 需求 100/0/0 · 标签 `Attack, Melee`
- 效果：Supports Melee Attack Skills. Supported Skills are more capable of Stunning Enemies the closer you are to being Heavily Stunned.
- 可辅助条件：Attack AND Melee
- 数值：Hits from Supported Skills Stun Enemies as though dealing more Damage equivalent to the current percentage of your Stun Bar


### Spectral Volley

**Spectral Volley** · Tier 4 · 需求 0/100/0 · 标签 `Attack, Projectile`
- 效果：Supports Bow or Spear Projectile Attacks you use yourself. Supported Skills deal lower damage initially, but generate Spectral Projectiles, which deal more damage when they fire. Spectral Projectiles linger and will fire a short duration after no new Spectral Projectiles have been created. Cannot support Channelling Skills, Leaping skills, or skills which rain Projectiles from above.
- 可辅助条件：(Bow AND Attack) OR ((Spear AND Projectile) AND Attack)
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Rain OR Channel OR Jumping
- 数值：Supported Skills deal 20% more Damage when fired from Spectral Projectiles；Supported Skills deal -60% more Damage when not fired from Spectral Projectiles；Spectral Projectiles will fire if no Spectral Projectiles have been created in the last 3000 second；`support_spectral_arrows_delay_between_projectiles_ms` = 100；Maximum 5 Spectral Projectiles


### Spell Cascade

**Spell Cascade** · Tier 1 · 需求 0/0/100 · 标签 `AoE`
- 效果：Supports Cascadable Spells, causing them to Cascade to either side of the target area, along a randomly chosen axis.
- 可辅助条件：Cascadable
- 数值：Supported Skills Cascade to either side of the targeted Area along a random axis；Cascades from Supported Skills have -20% more Area of Effect；Supported Skills have -20% more Area of Effect；Supported Skills deal -30% more Damage


### Spell Echo

**Spell Echo** · Tier 2 · 需求 0/0/100 · 标签 `Spell, AoE`
- 效果：Supports Cascadable Spells you use yourself. Supported Spells Echo.
- 可辅助条件：Cascadable
- 禁止条件：Triggered OR UsedByProxy OR Persistent
- 数值：Supported Skills have -30% more Cast Speed；Supported Spells Echo 1 time；Echoes from Supported Spells have 40% increased Area of Effect

**Trickster's Shard** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Spell, AoE, Trigger, Duration`
- 效果：Supports non-instant Spells you cast yourself. Supported Spells will Trigger Fragment Self, creating a Fractured Mimic which will cast that Spell if you get enough of them.
- 可辅助条件：Spell
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Instant
- 数值：Supported Spells deal -50% more Damage when cast by Fractured Mimics

**Zarokh's Refrain** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, Spell, AoE`
- 效果：Supports Cascadable Spells you cast yourself. Supported Spells Echo thrice, but are given a Cooldown. Cannot support skills which already have a Cooldown.
- 可辅助条件：Cascadable
- 禁止条件：(Cooldown AND NOT SupportedByZarokh) OR UsedByProxy OR Triggered OR Persistent OR Channel OR Attack
- 赋予类型：Cooldown, SupportedByZarokh
- 数值：Supported Spells Echo 3 time；Echoes from Supported Spells have 40% increased Area of Effect


### Spell Echo, Seal

**Tul's Avalanche** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Spell, AoE`
- 效果：Supports Cascadable Spells you cast yourself, Sealing them when you Block, The Seals are broken when used, each making the Spell Echo. Cannot support skills with a Cooldown or which already gain Seals.
- 可辅助条件：Cascadable
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR (HasSeals AND NOT SupportedByTulsAvalanche)
- 赋予类型：HasSeals, SupportedByTulsAvalanche
- 数值：Supported Skills have a maximum of 4 Seal；Supported Skills gain a Seal every time you Block；Supported Spells Echo 1 time per Seal broken


### Static Shocks

**Static Shocks** · Tier 3 · 需求 0/0/100 · 标签 `Spell, AoE, Trigger, Sustained, Lightning, Duration`
- 效果：Supports Skills which can Hit enemies. Shocking an enemy with Hits from Supported Skills Triggers Static Shocks, causing that enemy to become a source of Lightning damage sending pulses towards nearby enemies.
- 可辅助条件：Damage OR Attack OR CrossbowSkill
- 禁止条件：Minion OR SkillGrantedBySupport
- 数值：Supported Skills have 100% chance to Trigger Static Shocks on Shocking an enemy


### Steadfast

**Steadfast I** · Tier 1 · 需求 100/0/0 · 标签 `Channelling`
- 效果：Supports Channelling Skills you use yourself, granting you higher Stun Threshold while Channelling them.
- 可辅助条件：Channel
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：You have 50% more Stun Threshold while Channelling Supported Skills

**Steadfast II** · Tier 3 · 需求 100/0/0 · 标签 `Channelling`
- 效果：Supports Channelling Skills you use yourself, granting you higher Stun Threshold and Ailment Threshold  while Channelling them.
- 可辅助条件：Channel
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：You have 100% more Ailment Threshold while Channelling Supported Skills；You have 50% more Stun Threshold while Channelling Supported Skills


### Stoicism

**Stoicism I** · Tier 3 · 需求 100/0/0 · 标签 ``
- 效果：Supports Attack Skills you use yourself. Supported Skills steadily gain more Damage, up to a cap. This Damage bonus is reset if you Dodge Roll or use a Travel Skill.
- 可辅助条件：Damage OR Attack OR CrossbowSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Spell
- 数值：Supported Skills gain 1% more Damage every second, up to 20% This Damage Bonus resets if you Dodge Roll or use a Travel Skill

**Stoicism II** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports Attack Skills you use yourself. Supported Skills steadily gain more Damage, up to a cap. This Damage bonus is reset if you Dodge Roll or use a Travel Skill.
- 可辅助条件：Damage OR Attack OR CrossbowSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent OR Spell
- 数值：Supported Skills gain 2% more Damage every second, up to 20% This Damage Bonus resets if you Dodge Roll or use a Travel Skill


### Stomping Ground

**Stomping Ground** · Tier 1 · 需求 100/0/0 · 标签 `Attack, AoE, Trigger`
- 效果：Supports Travel skills, causing your footsteps to crack the earth and emit damaging shockwaves while using the skill.
- 可辅助条件：Travel


### Stormchain

**Stormchain** · Tier 0 · 需求 0/100/0 · 标签 `Projectile, Lightning, Chaining`
- 效果：Supports Projectile Skills and Skills which can Chain. Supported Skills always Chain when initially Hitting a Shocked Enemy, but cannot themselves inflict Shock. Does not support Skills which cannot Chain.
- 可辅助条件：Chains OR Projectile
- 禁止条件：ProjectileNoCollision OR CannotChain
- 赋予类型：SupportedByStormchain


### Stormfire

**Stormfire** · Tier 3 · 需求 0/0/100 · 标签 `Lightning, Fire`
- 效果：Supports any skill that Hits enemies. Enemies Shocked by Supported Skills take a percentage of damage from Ignite as Lightning damage as well as Fire damage.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Enemies Shocked by Supported Skills take 20% of damage from Ignite as Lightning damage as well as Fire damage


### Streamlined Rounds

**Streamlined Rounds** · Tier 3 · 需求 0/100/0 · 标签 `Ammunition, Projectile`
- 效果：Supports Crossbow Ammunition Skills. Supported Skills have significantly higher Attack speed and bolt capacity, but deal less damage and have longer reload time.
- 可辅助条件：CrossbowSkill OR CrossbowAmmoSkill
- 数值：Supported Skills load an additional bolt；Supported Skills have 50% more Attack speed；Supported Skills deal -60% more Damage；Supported Skills fire 0% more Projectiles；Supported Skills have -50% more reload speed


### Strong Hearted

**Strong Hearted** · Tier 3 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing Shock applied to you to last for a shorter duration while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：-50% more Shock duration on you while a Supported Skill is active


### Stun

**Stun I** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits Enemies, causing it to build up Stun more quickly.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Hits with Supported Skills cause 50% more Stun buildup

**Stun II** · Tier 4 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits Enemies, causing it to build up Stun more quickly.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Hits with Supported Skills cause 70% more Stun buildup

**Stun III** · Tier 5 · 需求 100/0/0 · 标签 ``
- 效果：Supports any skill that Hits Enemies, causing it to build up Stun significantly more quickly, at the cost of Damage.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 数值：Hits with Supported Skills cause 300% more Stun buildup；Supported Skills deal -50% more Damage


### Styrn's Mountain

**Styrn's Mountain** · Tier 0 · 需求 0/0/0 · 标签 `Lineage`
- 效果：Supports Skills that Raise your Shield causing your other melee skills to deal more damage if you block.
- 可辅助条件：ActiveBlock
- 数值：Melee Skills that don't raise a Shield deal 20% more Damage if you've Blocked while using Supported Skills Recently；50% more Stun Threshold for Heavy Stuns while using Supported Skills


### Supercritical

**Supercritical** · Tier 3 · 需求 0/0/100 · 标签 ``
- 效果：Supports any skill that Hits enemies, causing it to deal more damage with Critical Hits but have less Critical Hit chance.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 数值：Supported Skills have 100% increased Critical Damage Bonus；Supported Skills have -20% more Critical Hit chance


### Swift Affliction

**Swift Affliction I** · Tier 1 · 需求 0/100/0 · 标签 `Duration`
- 效果：Supports any skill that deals damage, causing it to deal more non-Ailment damage over time but have a shorter duration.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more non-Ailment Damage over Time；-20% more Duration of Supported Skills and Damaging Ailments they inflict

**Swift Affliction II** · Tier 3 · 需求 0/100/0 · 标签 `Duration`
- 效果：Supports any skill that deals damage, causing it to deal more non-Ailment damage over time but have a shorter duration.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：Supported Skills deal 30% more non-Ailment Damage over Time；-10% more Duration of Supported Skills and Damaging Ailments they inflict

**Swift Affliction III** · Tier 5 · 需求 0/100/0 · 标签 `Duration`
- 效果：Supports any skill that deals damage, causing effects with a duration of one second or less to deal more non-Ailment damage over time.
- 可辅助条件：Damage OR Attack OR DamageOverTime OR CrossbowAmmoSkill
- 数值：-30% more Duration of Supported Skills and Damaging Ailments they inflict；Supported Skills deal 50% more non-Ailment damage over time if their duration is less than one second


### Syzygy

**Syzygy** · Tier 4 · 需求 100/0/0 · 标签 `Attack, Melee, Slam, Fire`
- 效果：Supports Slam Skills you use yourself. Hits from Supported Skills are considered Crushing Blows against Enemies which are both Ignited and Fully Armour Broken. Hits with Supported Skills that Heavily Stun Ignited and Fully Armour Broken Enemies will Intimidate them.
- 可辅助条件：Slam
- 禁止条件：UsedByProxy OR Triggered OR Persistent


### Tacati's Ire

**Tacati's Ire** · Tier 0 · 需求 0/100/0 · 标签 `Lineage, Chaos`
- 效果：Supports Skills which can cause Damaging Hits. Poison inflicted with Supported Skills deals Damage faster the higher your Rage.
- 可辅助条件：Attack OR Damage
- 数值：Poisons from Supported Skills deal Damage 2% faster per Rage


### Tear

**Tear** · Tier 3 · 需求 100/0/0 · 标签 `Attack, Melee, Physical`
- 效果：Supports Melee Attacks you use or Trigger yourself. On-Kill effects caused by Killing Blows with Supported Skills on Bleeding enemies have a chance to occur twice.
- 可辅助条件：Melee
- 禁止条件：UsedByProxy OR Persistent
- 数值：On-Kill Effects caused by killing blows on Bleeding Enemies with Supported Skills occur twice


### Thornskin

**Thornskin I** · Tier 2 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Thorns Damage while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 40% increased Thorns Damage while a Supported Skill is active

**Thornskin II** · Tier 4 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to deal increased Thorns Damage while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Deal 70% increased Thorns Damage while a Supported Skill is active


### Thrill of the Kill

**Thrill of the Kill** · Tier 1 · 需求 0/0/100 · 标签 `Attack, Lightning, Duration`
- 效果：Supports Skills you use yourself which Hit enemies. Culling a Shocked enemy with Supported Skills infuses all of your Attacks with Lightning damage for a short time.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Attacks Gain 25% of Damage as Lightning Damage for # seconds on Culling an enemy with Supported Skills；Attacks Gain 8000% of Damage as Lightning Damage for # seconds on Culling an enemy with Supported Skills

**Thrill of the Kill II** · Tier 3 · 需求 0/0/100 · 标签 `Attack, Lightning, Duration`
- 效果：Supports Skills you use yourself which Hit enemies. Culling a Shocked enemy with Supported Skills infuses all of your Attacks with Lightning damage and grants an increased chance to Shock for a short time.
- 可辅助条件：Attack OR Damage OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 赋予类型：Duration
- 数值：Attacks Gain 25% of Damage as Lightning Damage for # seconds on Culling an enemy with Supported Skills；Attacks Gain 8000% of Damage as Lightning Damage for # seconds on Culling an enemy with Supported Skills；Thrill of the Kill Buff also grants 40% increased Shock chance


### Tireless

**Tireless** · Tier 1 · 需求 100/0/0 · 标签 `Warcry`
- 效果：Supports Warcry Skills. Attacks Empowered by Supported Skills have a chance not to lower the Empowerment count of Supported Skills when they are used.
- 可辅助条件：Warcry
- 数值：Supported Skills have 25% chance to not count Attacks they Empower


### Totemic Control

**Cirel's Cultivation** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Totem`
- 效果：Supports Skills which create Totems, preventing you from having more than one of that Totem but granting significant benefits for Supported Totems based how many allied Totems are near them. Does not Support Skills used by Minions.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 禁止条件：UnlimitedTotems
- 数值：Counts allied Totems in radius of 40 metre；Supported Totems can gain benefits for having up to 5 Totems in effect radius；Totems created by supported Skills regenerate 60% of maximum Life per second per allied Totem in effect radius；Totems created by Supported Skills deal 10% more damage per allied Totem in effect radius；Totems created by Supported Skills have 5% increased area of effect per allied Totem in effect radius

**Splinter Totem I** · Tier 3 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, preventing having more than one active Totem but causing that Totem to splinter into smaller versions of itself after it uses an Attack or Spell, with each Totem becoming less effective. Each splintered Totem can further splinter, up to a maximum. Does not Support Skills used by Minions. Only one Totem can be splintering at a time.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 禁止条件：UnlimitedTotems
- 数值：Totems created by Supported Skills can splinter 2 time；Totems created by Supported Skills splinter after performing 1 action；Totems created by Supported Skills have -10% less Skill Speed for each time they have splintered；Totems created by Supported Skills deal -20% less damage for each time they have splintered；Totems created by Supported Skills have -20% less maximum Life for each time they have splintered；Totems created by Supported Skills have -20% less area of effect for each time they have splintered

**Splinter Totem II** · Tier 5 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, preventing having more than one active Totem but causing that Totem to splinter into smaller versions of itself after it uses an Attack or Spell, with each Totem becoming less effective. Each splintered Totem can further splinter, up to a maximum. Does not Support Skills used by Minions. Only one Totem can be splintering at a time.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 禁止条件：UnlimitedTotems
- 数值：Totems created by Supported Skills can splinter 2 time；Totems created by Supported Skills splinter after performing 1 action；Totems created by Supported Skills have -7% less Skill Speed for each time they have splintered；Totems created by Supported Skills deal -15% less damage for each time they have splintered；Totems created by Supported Skills have -15% less maximum Life for each time they have splintered；Totems created by Supported Skills have -15% less area of effect for each time they have splintered


### Twofold

**Heightened Charges** · Tier 2 · 需求 0/100/0 · 标签 ``
- 效果：Supports any Skill that Consumes Charges, granting a chance for benefits of that Consumption to be doubled.
- 可辅助条件：ConsumesCharges
- 数值：Benefits from consuming Charges for Supported Skill have 20% chance to be doubled


### Uhtred of Kalguur

**Uhtred's Augury** · Tier 0 · 需求 100/0/0 · 标签 `Lineage`
- 效果：Supports Skills which can gain levels, granting them additional levels provided exactly two other supports are used with the supported Skill. Does not support skills which do not have levels.
- 可辅助条件：（无限制）
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to level of Supported Skills if exactly two other Supports are modifying them

**Uhtred's Exodus** · Tier 0 · 需求 100/0/0 · 标签 `Lineage`
- 效果：Supports Skills which can gain levels, granting them many additional levels provided no other supports are used with the supported Skill. Does not support skills which do not have levels.
- 可辅助条件：（无限制）
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to level of Supported Skills if no other Supports are modifying them

**Uhtred's Omen** · Tier 0 · 需求 100/0/0 · 标签 `Lineage`
- 效果：Supports Skills which can gain levels, granting them additional levels provided exactly one other support is used with the supported Skill. Does not support skills which do not have levels.
- 可辅助条件：（无限制）
- 禁止条件：SingleLevelSkill
- 数值：{0:+d} to level of Supported Skills if exactly one other Support is modifying them


### Uhtred's Rite

**Uhtred's Rite** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Duration`
- 效果：Supports skills with Cooldowns, causing them to grant Overflowing Chalice when used. Supported skills deal more damage during the effect of your Life Flask and have increased Mana Cost Efficiency during the effect of your Mana Flask.
- 可辅助条件：Cooldown
- 赋予类型：Duration, Buff
- 数值：Supported Skills grant Overflowing Chalice when used, for 1000 second per 1 second of their cooldown；Supported Skills deal 20% more damage during effect of any Life Flask；Supported Skills have 20% increased Mana Cost Efficiency during effect of any Mana Flask


### Undermine

**Undermine** · Tier 0 · 需求 100/0/0 · 标签 `Physical`
- 效果：Supports Attack Skills. Supported Skills Consume Maim on hit, Breaking a percentage of the Maimed target's Armour in doing so. Supported Skills cannot themselves inflict Maim.
- 可辅助条件：Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Supported Skills Consume Maim on Hit to Break 35% of the Maimed target's Armour


### Unerring Power

**Unerring Power** · Tier 0 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attack Skills you use yourself. When Supported Attacks are Empowered, they have significantly lowered cost and raised Accuracy.
- 可辅助条件：Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills cost -30% more if used while Empowered；Supported Skills have 30% more Accuracy Rating if used while Empowered


### Untouchable

**Untouchable** · Tier 0 · 需求 0/100/0 · 标签 `Attack`
- 效果：Supports Attack Skills you use yourself. While using Supported Skills, you gain increased Evasion Rating, with the increase scaling higher the longer the Attack time of the supported Skill. Cannot Support Channelling Skills.
- 可辅助条件：Attack
- 禁止条件：Channel OR UsedByProxy OR Triggered OR Persistent
- 数值：25% increased Evasion Rating while using Supported Skills per quarter second of Attack time of Supported Skill


### Upwellling

**Upwelling I** · Tier 2 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing your Minions to deal increased Damage while you are not on full Mana while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Your Minions deal 30% increased Damage while you are not on full Mana while a Supported Skill is active

**Upwelling II** · Tier 4 · 需求 0/0/100 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing your Minions to deal increased Damage while you are not on full Mana while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Your Minions deal 50% increased Damage while you are not on full Mana while a Supported Skill is active


### Urgent Totems

**Urgent Totems I** · Tier 2 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, causing those Skills to place Totems much more quickly.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 数值：Supported Skills have 80% increased Totem Placement speed

**Urgent Totems II** · Tier 3 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, causing those Skills to place Totems much more quickly.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 数值：Supported Skills have 100% increased Totem Placement speed

**Urgent Totems III** · Tier 4 · 需求 100/0/0 · 标签 `Totem`
- 效果：Supports Skills which create Totems, causing those Skills to place Totems much more quickly. Totems created by Supported Skills have increased Attack and Cast Speed.
- 可辅助条件：SummonsTotem OR UsedByTotem
- 数值：Supported Skills have 100% increased Totem Placement speed；Spells Cast by Totems created by Supported Skills have 20% increased Cast Speed；Attacks used by Totems created by Supported Skills have 20% increased Attack Speed


### Vanguard

**Vanguard I** · Tier 1 · 需求 100/0/0 · 标签 ``
- 效果：Supports Shield Skills, causing you to gain Guard on Stunning Enemies with the Supported Skill.
- 可辅助条件：Attack AND RequiresShield
- 数值：Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 4 Guard per ten Strength if Heavily Stunning Guard duration is # second；Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 2 Guard per ten Strength if Heavily Stunning Guard duration is # second；Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 4000 Guard per ten Strength if Heavily Stunning Guard duration is # second

**Vanguard II** · Tier 2 · 需求 100/0/0 · 标签 ``
- 效果：Supports Shield Skills, causing you to gain Guard on Stunning Enemies with the Supported Skill.
- 可辅助条件：Attack AND RequiresShield
- 数值：Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 6 Guard per ten Strength if Heavily Stunning Guard duration is # second；Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 2 Guard per ten Strength if Heavily Stunning Guard duration is # second；Gain # Guard per ten Strength when you Stun an Enemy Gain an additional 4000 Guard per ten Strength if Heavily Stunning Guard duration is # second


### Varashta's Blessing

**Varashta's Blessing** · Tier 0 · 需求 0/0/100 · 标签 `Lineage`
- 效果：Supports any Skill that can deal damage, causing it to deal more damage for each different Command Skill you have used in the past few seconds. Cannot modify the Skills of Minions.
- 可辅助条件：Attack OR Damage OR DegenOnlySpellDamage OR CrossbowSkill OR CrossbowAmmoSkill
- 数值：Supported Skills deal 10% more Damage for each different Command Skill you have used in the last 15 seconds


### Verglas

**Verglas** · Tier 3 · 需求 0/0/100 · 标签 `Cold`
- 效果：Supports Skills you use yourself which can Hit Enemies. Supported Skills Gain a percentage of their Damage as Cold Damage when you destroy Ice Crystals.
- 可辅助条件：Damage OR Attack OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Destroying an Ice Crystal grants Supported Skills 1% of Damage Gained as extra Cold for # seconds, per two thousand maximum Life of the destroyed Ice Crystal；Destroying an Ice Crystal grants Supported Skills 6000% of Damage Gained as extra Cold for # seconds, per two thousand maximum Life of the destroyed Ice Crystal


### Vitality

**Vitality I** · Tier 1 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain Life Regeneration while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Regenerate 60% of maximum Life per second while a Supported Skill is active

**Vitality II** · Tier 4 · 需求 100/0/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing you to gain Life Regeneration while the Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：Regenerate 120% of maximum Life per second while a Supported Skill is active


### Volatility

**Volatility** · Tier 3 · 需求 0/0/100 · 标签 `Physical, Chaos`
- 效果：Supports Skills you use yourself which can cause Damaging Hits. Supported Skills grant Volatility on Critical Hit.
- 可辅助条件：Attack OR Damage OR CrossbowSkill OR CrossbowAmmoSkill
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills grant Volatility on Critical Hit


### Volcanic Eruption

**Volcanic Eruption** · Tier 2 · 需求 100/0/0 · 标签 `Attack, AoE, Melee, Strike, Projectile, Trigger, Fire`
- 效果：Supports Melee Strike Skills you use yourself. Supported Skills trigger Volcanic Eruption on Hit against Ignited Enemies.
- 可辅助条件：MeleeSingleTarget
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Strikes trigger Volcanic Eruption on Hitting Ignited Enemies


### Volt

**Volt** · Tier 2 · 需求 0/100/0 · 标签 `Attack, Projectile, Lightning`
- 效果：Supports Projectile Attack Skills you use yourself. Supported Skills gain Voltaic Charge as you move, up to a maximum. When used, Supported Skills expend that Charge to gain extra Lightning Damage.
- 可辅助条件：Attack AND Projectile
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills gain 2 Voltaic Charge per Metre travelled；Supported Skills gain 1% of Damage as extra Lightning Damage per Voltaic Charge consumed；Supported Skills have 30 maximum Voltaic Charge Supported Skills consume all Voltaic Charge on use


### Vruun's Aftermath

**Vruun's Aftermath** · Tier 0 · 需求 0/0/0 · 标签 `Lineage, Warcry`
- 效果：Supports Warcries, causing them to destroy Ice Crystals and Ice Fragments. Supported Skills empower additional Attacks if they destroy enough Ice Crystals and Ice Fragments.
- 可辅助条件：Warcry
- 数值：Supported Warcries Empower 3 additional Attacks if they destroy at least 5 total Ice Crystals and Ice Fragments


### Warm Blooded

**Warm Blooded** · Tier 3 · 需求 0/100/0 · 标签 `Buff, Persistent`
- 效果：Supports Persistent Buff Skills, causing Freeze applied to you to last for a shorter duration while the Supported Skill is active.
- 可辅助条件：Persistent AND Buff
- 数值：-50% more Freeze duration on you while a Supported Skill is active


### Wildfire

**Wildfire** · Tier 2 · 需求 0/0/100 · 标签 `AoE, Fire`
- 效果：Supports any skill that Hits enemies, Spreading Ignites it inflicts to nearby enemies after a delay.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 赋予类型：Area
- 数值：Ignites inflicted by Supported Skills Spread to other enemies that stay within 15 metre for 1 second


### Wind Wave

**Wind Wave** · Tier 0 · 需求 0/100/0 · 标签 `AoE, Trigger`
- 效果：Supports any skill that you can use, triggering a blast of wind that Knocks Back enemies if you are Stunned while using it.
- 可辅助条件：（无限制）
- 禁止条件：Instant OR Persistent


### Window of Opportunity

**Window of Opportunity I** · Tier 1 · 需求 0/100/0 · 标签 `Channelling`
- 效果：Supports Channelling skills that have special effects if released with Perfect Timing, causing them to deal much more damage if released with Perfect Timing but reducing the Perfect Timing window.
- 可辅助条件：PerfectTiming
- 数值：-35% longer Perfect Timing window；Supported Skills deal 35% more Damage when released with Perfect Timing

**Window of Opportunity II** · Tier 5 · 需求 0/100/0 · 标签 `Channelling`
- 效果：Supports Channelling skills that have special effects if released with Perfect Timing, causing them to deal much more damage and grant Perfect Deflection if released with Perfect Timing but reducing the Perfect Timing window.
- 可辅助条件：PerfectTiming
- 数值：-35% longer Perfect Timing window；Supported Skills deal 35% more Damage when released with Perfect Timing；Releasing Supported Skills with Perfect Timing grants Deflection Rating equal to 15% of Evasion Rating for 8 seconds


### Withering Touch

**Withering Touch** · Tier 1 · 需求 0/0/100 · 标签 `Chaos, Duration`
- 效果：Supports any skill that Hits enemies, giving it a chance to Wither enemies on Hit.
- 可辅助条件：Damage OR Attack OR CrossbowAmmoSkill
- 赋予类型：Duration
- 数值：Supported Skills deal -25% more Damage；Withered lasts 4000 second；Supported Skills have 1% chance to inflict Withered on Hit for every 175% of enemy Ailment Threshold dealt as Chaos damage


### Xibaqua's Rending

**Xibaqua's Rending** · Tier 0 · 需求 0/0/100 · 标签 `Lineage, AoE, Trigger, Fire`
- 效果：Supports Skills that leap into the air, causing Corpses in the area you land to violently explode, damaging surrounding enemies.
- 可辅助条件：Jumping
- 赋予类型：Area, Fire, Damage, Triggers


### Zenith

**Zenith I** · Tier 1 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spell Skills. Supported Skills deal more damage while you are above 90% of your Maximum Mana. Does not modify Skills used by Minions.
- 可辅助条件：(Spell AND Damage) OR DegenOnlySpellDamage
- 数值：Supported Spells deal 30% more Damage while you are above 90% of your Maximum Mana

**Zenith II** · Tier 3 · 需求 0/0/100 · 标签 `Spell`
- 效果：Supports Spell Skills. Supported Skills have increased Mana cost Efficiency and deal more damage while you are above 90% of your maximum Mana. Does not modify Skills used by Minions.
- 可辅助条件：(Spell AND Damage) OR DegenOnlySpellDamage
- 数值：Supported Spells deal 30% more Damage while you are above 90% of your Maximum Mana；Supported Skills have 25% increased Mana Cost Efficiency


### Zerphi's Legacy

**Zerphi's Infamy** · Tier 0 · 需求 100/0/0 · 标签 `Lineage, Warcry`
- 效果：Supports Attacks and Warcries you use yourself. Supported Skills gain a Glory requirement, and build Glory when you spend Life on Skills. Supported Skills deal more damage and have significantly\n increased area of effect.
- 可辅助条件：Attack OR Warcry
- 禁止条件：UsedByProxy OR Triggered OR Persistent
- 数值：Supported Skills requires 50 Glory to use；Supported Skills gain Glory equal to 5% of  Life spent on other Skills；Supported Skills have 50% increased Area of Effect；Supported Skills deal 50% more Damage


## 三、反查索引：技能类型 → 出现的宝石（含 AND 的宝石需同时满足多个类型）

| 技能类型 | 辅助宝石数 | 宝石 |
|---|---|---|
| ActiveBlock | 1 | Styrn's Mountain |
| AffectedByCooldownRate | 7 | Atziri's Impatience, Cooldown Recovery I, Cooldown Recovery II, Second Wind I, Second Wind II, Second Wind III, Uhtred's Constellation |
| AppliesCurse | 13 | Abiding Hex, Atziri's Allure, Burning Inscription, Cursed Ground, Decaying Hex, Doedre's Undoing, Focused Curse, Hayoxi's Fulmination, Heightened Curse, Hex Bloom, Impending Doom, Kalisa's Crescendo, Ritualistic Curse |
| Area | 7 | Concentrated Area, Expand, Expanse, Magnified Area I, Magnified Area II, Overreach, Vorana's Siege |
| Attack | 224 | Admixture, Alignment I, Alignment II, Alignment III, Ambrosia, Ambrosia II, Ambush, Arakaali's Lust, Armour Break I, Armour Break II, Armour Break III, Armour Explosion, Arms Length, Bhatair's Vengeance, Biting Frost I, Biting Frost II, Blazing Critical, Bleed I, Bleed II, Bleed III, Bleed IV, Blind I, Blind II, Blindside, Bone Shrapnel, Bounty I, Bounty II, Brittle Armour, Brutality I, Brutality II, Brutality III, Bursting Plague, Cadence, Chaos Attunement, Charged Shots I, Charged Shots II, Charm Bounty, Clash, Close Combat I, Close Combat II, Cold Attunement, Cold Exposure, Cold Penetration, Commiserate, Concoct I, Concoct II, Concussive Runes, Corrosion, Coursing Current, Culling Strike I, Culling Strike II, Culmination I, Culmination II, Dauntless, Daze, Deadly Poison I, Deadly Poison II, Deep Cuts I, Deep Cuts II, Deep Freeze, Defy I, Defy II, Derange, Electrocute, Electromagnetism, Elemental Armament I, Elemental Armament II, Elemental Armament III, Elemental Focus, Embitter, Enduring Impact I, Enduring Impact II, Eonyr's Thunder, Escalating Poison, Esh's Radiance, Eternal Flame I, Eternal Flame II, Eternal Flame III, Excise, Execrate, Execute I, Execute II, Execute III, Exploit Weakness, Fan The Flames, Fan The Flames II, Ferocity, Fiery Death, Fire Attunement, Fire Exposure, Fire Penetration I, Fire Penetration II, Flame Pillar, Freeze, Frenzied Riposte, Frost Nexus, Frostfire, Frozen Spite, Garukhan's Resolve, Haemocrystals, Heft, Heightened Accuracy I, Heightened Accuracy II, Hit and Run, Hourglass, Ice Bite I, Ice Bite II, Ignite I, Ignite II, Ignite III, Immolate, Impact Shockwave, Impale, Incision, Inexorable Critical I, Inexorable Critical II, Inhibitor, Innervate, Knockback, Lasting Shock, Life Bounty, Life Drain, Life Leech I, Life Leech II, Life Leech III, Lightning Attunement, Lightning Exposure, Lightning Penetration, Living Lightning, Living Lightning II, Lockdown, Longshot I, Longshot II, Maim, Malady, Mana Bounty, Mana Leech, Minion Pact I, Minion Pact II, Momentum, Morrigan's Insight, Neural Overload, Oisin's Oath, Olroth's Hubris, Opening Move, Overcharge, Overextend, Overreach, Pin I, Pin II, Pin III, Pinpoint Critical, Poison I, Poison II, Poison III, Poison Spores, Potent Exposure, Practical Magic I, Practical Magic II, Practiced Combo, Prototype Seventeen, Pursuit I, Pursuit II, Pursuit III, Quill Burst, Rageforged I, Rageforged II, Rakiata's Flow, Rapid Attacks I, Rapid Attacks II, Rapid Attacks III, Relentless Rage, Rigwald's Ferocity, Rising Tempest, Runeforged Blades, Runic Extraction, Runic Infusion, Rupture, Rusted Spikes, Ruthless, Salvo, Scouring Flame, Searing Flame I, Searing Flame II, Shock, Shock Conduction, Shock Conduction II, Shock Siphon, Slow Potency, Soul Drain, Spar, Spectral Volley, Static Shocks, Stoicism I, Stoicism II, Stormfire, Stun I, Stun II, Stun III, Styrn's Ferocity, Supercritical, Swift Affliction I, Swift Affliction II, Swift Affliction III, Tacati's Ire, Thrill of the Kill, Thrill of the Kill II, Tul's Stillness, Undermine, Unerring Power, Untouchable, Uul-Netol's Embrace, Vanguard I, Vanguard II, Varashta's Blessing, Verglas, Volatility, Volt, Vorana's Siege, Vruun's Inevitability, Wildfire, Withering Touch, Xoph's Pyre, Zerphi's Infamy |
| Banner | 4 | Daresso's Passion, Refraction I, Refraction II, Refraction III |
| Bow | 6 | Alignment I, Alignment II, Alignment III, Charged Shots I, Charged Shots II, Spectral Volley |
| Buff | 28 | Arbiter's Reach, Cannibalism I, Cannibalism II, Clarity I, Clarity II, Cool Headed, Direstrike I, Direstrike II, Healing Runes, Her Declaration, Herbalism I, Herbalism II, Mysticism I, Mysticism II, Precision I, Precision II, Refraction I, Refraction II, Refraction III, Seraph's Heart, Strong Hearted, Thornskin I, Thornskin II, Upwelling I, Upwelling II, Vitality I, Vitality II, Warm Blooded |
| CanCreateStoneElementals | 2 | Skittering Stone I, Skittering Stone II |
| Cascadable | 4 | Spell Cascade, Spell Echo, Tul's Avalanche, Zarokh's Refrain |
| Chains | 5 | Chain I, Chain II, Chain III, Dominus' Grasp, Stormchain |
| Channel | 6 | Burgeon I, Burgeon II, Crackling Barrier, Deadly Resolve, Steadfast I, Steadfast II |
| Chaos | 2 | Chaos Mastery, Chaotic Freeze |
| Cold | 2 | Breachlord's Amalgam, Cold Mastery |
| ComboStacking | 1 | Ailith's Chimes |
| CommandableMinion | 5 | Bidding I, Bidding II, Bidding III, Commandment, Kurgal's Leash |
| CommandsMinions | 4 | Bidding I, Bidding II, Bidding III, Kurgal's Leash |
| Companion | 4 | Catha's Brilliance, Loyalty, Romira's Requital, Tangmazu's Thurible |
| ConsumesCharges | 2 | Heightened Charges, Perpetual Charge |
| Cooldown | 8 | Atziri's Impatience, Cooldown Recovery I, Cooldown Recovery II, Second Wind I, Second Wind II, Second Wind III, Uhtred's Constellation, Uhtred's Rite |
| CreatesFissure | 5 | Branching Fissures I, Branching Fissures II, Kaom's Madness, Upheaval I, Upheaval II |
| CreatesGroundEffect | 5 | Encroaching Ground, Lasting Ground, Persistent Ground I, Persistent Ground II, Persistent Ground III |
| CreatesGroundRune | 1 | Burning Inscription |
| CreatesMinion | 17 | Brutus' Brain, Elemental Army, Feeding Frenzy I, Feeding Frenzy II, Infernal Legion I, Infernal Legion II, Infernal Legion III, Last Gasp, Meat Shield I, Meat Shield II, Minion Instability, Minion Splash I, Minion Splash II, Muster, Sacrificial Lamb I, Sacrificial Lamb II, Tecrod's Revenge |
| CrossbowAmmoSkill | 186 | Ambrosia, Ambrosia II, Ambush, Ammo Conservation I, Ammo Conservation II, Ammo Conservation III, Arakaali's Lust, Arjun's Medal, Armour Break I, Armour Break II, Armour Break III, Armour Explosion, Arms Length, Auto Reload, Bhatair's Vengeance, Biting Frost I, Biting Frost II, Blazing Critical, Bleed I, Bleed II, Bleed III, Bleed IV, Blind I, Blind II, Blindside, Bone Shrapnel, Bounty I, Bounty II, Brittle Armour, Brutality I, Brutality II, Brutality III, Bursting Plague, Chaos Attunement, Charm Bounty, Close Combat I, Close Combat II, Cold Attunement, Cold Exposure, Cold Penetration, Commiserate, Concoct I, Concoct II, Concussive Runes, Corrosion, Coursing Current, Culling Strike I, Culling Strike II, Dauntless, Daze, Deadly Poison I, Deadly Poison II, Deep Cuts I, Deep Cuts II, Deep Freeze, Derange, Double Barrel I, Double Barrel II, Double Barrel III, Electrocute, Electromagnetism, Elemental Armament I, Elemental Armament II, Elemental Armament III, Elemental Focus, Embitter, Enduring Impact I, Enduring Impact II, Eonyr's Thunder, Escalating Poison, Eternal Flame I, Eternal Flame II, Eternal Flame III, Excise, Execrate, Execute I, Execute II, Execute III, Exploit Weakness, Ferocity, Fiery Death, Fire Attunement, Fire Exposure, Fire Penetration I, Fire Penetration II, Flame Pillar, Freeze, Fresh Clip I, Fresh Clip II, Frost Nexus, Frostfire, Heft, Heightened Accuracy I, Heightened Accuracy II, Hourglass, Ice Bite I, Ice Bite II, Ignite I, Ignite II, Ignite III, Immolate, Impale, Incision, Inexorable Critical I, Inexorable Critical II, Inhibitor, Innervate, Knockback, Lasting Shock, Life Bounty, Life Drain, Life Leech I, Life Leech II, Life Leech III, Lightning Attunement, Lightning Exposure, Lightning Penetration, Lockdown, Longshot I, Longshot II, Maim, Malady, Mana Bounty, Mana Leech, Minion Pact I, Minion Pact II, Momentum, Morrigan's Insight, Neural Overload, Nimble Reload, Nova Projectiles I, Nova Projectiles II, Oisin's Oath, Olroth's Hubris, Overcharge, Pin I, Pin II, Pin III, Pinpoint Critical, Poison I, Poison II, Poison III, Potent Exposure, Practical Magic I, Practical Magic II, Prototype Seventeen, Rageforged I, Rageforged II, Rapid Attacks I, Rapid Attacks II, Rapid Attacks III, Ratha's Assault, Relentless Rage, Rising Tempest, Runeforged Blades, Runic Extraction, Runic Infusion, Rupture, Rusted Spikes, Scouring Flame, Searing Flame I, Searing Flame II, Shock, Shock Conduction, Shock Conduction II, Shock Siphon, Slow Potency, Soul Drain, Stormfire, Streamlined Rounds, Stun I, Stun II, Stun III, Supercritical, Swift Affliction I, Swift Affliction II, Swift Affliction III, Thrill of the Kill, Thrill of the Kill II, Undermine, Unerring Power, Varashta's Blessing, Verglas, Volatility, Wildfire, Withering Touch |
| CrossbowSkill | 43 | Admixture, Ambrosia, Ambrosia II, Ammo Conservation I, Ammo Conservation II, Ammo Conservation III, Arakaali's Lust, Arjun's Medal, Arms Length, Auto Reload, Blindside, Bone Shrapnel, Charm Bounty, Commiserate, Concoct I, Concoct II, Dauntless, Derange, Double Barrel I, Double Barrel II, Double Barrel III, Embitter, Flame Pillar, Fresh Clip I, Fresh Clip II, Impale, Incision, Inhibitor, Malady, Nimble Reload, Nova Projectiles I, Nova Projectiles II, Ratha's Assault, Rusted Spikes, Static Shocks, Stoicism I, Stoicism II, Streamlined Rounds, Undermine, Unerring Power, Varashta's Blessing, Verglas, Volatility |
| Damage | 167 | Admixture, Ambrosia, Ambrosia II, Ambush, Arakaali's Lust, Arbiter's Ignition, Armour Break I, Armour Break II, Armour Break III, Arms Length, Biting Frost I, Biting Frost II, Blazing Critical, Bleed I, Bleed II, Bleed III, Bleed IV, Blind I, Blind II, Blindside, Bone Shrapnel, Bounty I, Bounty II, Brittle Armour, Brutality I, Brutality II, Brutality III, Bursting Plague, Chaos Attunement, Charm Bounty, Cold Attunement, Cold Exposure, Cold Penetration, Commiserate, Concoct I, Concoct II, Concussive Spells, Controlled Destruction, Corrosion, Coursing Current, Dauntless, Deadly Poison I, Deadly Poison II, Deep Cuts I, Deep Cuts II, Deep Freeze, Derange, Electrocute, Electromagnetism, Elemental Discharge, Elemental Focus, Embitter, Enduring Impact I, Enduring Impact II, Eonyr's Thunder, Escalating Poison, Esh's Prowess, Esh's Radiance, Eternal Flame I, Eternal Flame II, Eternal Flame III, Excise, Execrate, Execute I, Execute II, Execute III, Exploit Weakness, Extraction, Fan The Flames, Fan The Flames II, Ferocity, Fiery Death, Fire Attunement, Fire Exposure, Fire Penetration I, Fire Penetration II, Flame Pillar, Freeze, Frost Nexus, Frostfire, Heft, Hourglass, Ice Bite I, Ice Bite II, Ignite I, Ignite II, Ignite III, Inexorable Critical I, Inexorable Critical II, Inhibitor, Innervate, Knockback, Lasting Shock, Life Bounty, Life Drain, Lightning Attunement, Lightning Exposure, Lightning Penetration, Living Lightning, Living Lightning II, Lockdown, Malady, Mana Bounty, Mana Flare, Minion Pact I, Minion Pact II, Momentum, Morrigan's Insight, Neural Overload, Oisin's Oath, Opening Move, Overcharge, Pin I, Pin II, Pin III, Pinpoint Critical, Poison I, Poison II, Poison III, Poison Spores, Potent Exposure, Practical Magic I, Practical Magic II, Prototype Seventeen, Rageforged I, Rageforged II, Rakiata's Flow, Relentless Rage, Rising Tempest, Runic Extraction, Rupture, Rusted Spikes, Scouring Flame, Searing Flame I, Searing Flame II, Shock, Shock Conduction, Shock Conduction II, Shock Siphon, Slow Potency, Soul Drain, Static Shocks, Stoicism I, Stoicism II, Stormfire, Stun I, Stun II, Stun III, Styrn's Ferocity, Supercritical, Swift Affliction I, Swift Affliction II, Swift Affliction III, Tacati's Ire, Thrill of the Kill, Thrill of the Kill II, Tul's Stillness, Uul-Netol's Embrace, Varashta's Blessing, Verglas, Volatility, Vorana's Siege, Wildfire, Withering Touch, Xoph's Pyre, Zenith I, Zenith II |
| DamageOverTime | 17 | Acrimony, Brutality I, Brutality II, Brutality III, Chaotic Freeze, Derange, Drain Ailments, Hourglass, Intense Agony, Minion Pact I, Minion Pact II, Rageforged I, Rageforged II, Runic Extraction, Swift Affliction I, Swift Affliction II, Swift Affliction III |
| DegenOnlySpellDamage | 11 | Acrimony, Derange, Hourglass, Inhibitor, Potent Exposure, Rageforged I, Rageforged II, Slow Potency, Varashta's Blessing, Zenith I, Zenith II |
| DetonatesAfterTime | 4 | Long Fuse I, Long Fuse II, Short Fuse I, Short Fuse II |
| Duration | 4 | Compressed Duration I, Compressed Duration II, Prolonged Duration I, Prolonged Duration II |
| EmpowersOtherSkill | 2 | Murderous Intent, Olroth's Conviction |
| Fire | 1 | Fire Mastery |
| GeneratesCharges | 3 | Charge Profusion I, Charge Profusion II, Empowered Sparks I |
| GeneratesEnergy | 3 | Boundless Energy I, Boundless Energy II, Energy Retention |
| GeneratesRemnants | 8 | Harmonic Remnants I, Harmonic Remnants II, Khatal's Rejuvenation, Magnetic Remnants, Remnant Potency I, Remnant Potency II, Remnant Potency III, Selfless Remnants |
| Grenade | 3 | Adhesive Grenades I, Adhesive Grenades II, Payload |
| HasUsageCondition | 1 | Delayed Gratification |
| Hazard | 4 | Controlled Hazard, Delayed Reaction, Rearm I, Rearm II |
| Herald | 1 | Deadly Herald |
| IceCrystal | 4 | Creeping Chill, Crystalline Shards, Glacier, Icicle |
| InteractsWithElementalGround | 1 | Catalysing Elements |
| Invocation | 1 | Energy Capacitor |
| IsBlasphemy | 1 | Heightened Curse |
| Jumping | 4 | Crater, Holy Descent, Shocking Leap, Xibaqua's Rending |
| Lightning | 3 | Breachlord's Amalgam, Esh's Prowess, Lightning Mastery |
| Limit | 2 | Overabundance I, Overabundance II |
| Mark | 6 | Charged Mark, Eternal Mark, Mark for Death, Mark for Death II, Mark of Siphoning, Mark of Siphoning II |
| Melee | 25 | Bloodlust, Brink I, Brink II, Clash, Combo Finisher I, Combo Finisher II, Crater, Culmination I, Culmination II, Heavy Swing, Medved's Felling, Punch Through, Pursuit I, Pursuit II, Pursuit III, Quill Burst, Rage I, Rage II, Rage III, Retaliate I, Retaliate II, Rip, Spar, Tear, Vruun's Inevitability |
| MeleeSingleTarget | 14 | Ancestral Aid, Ancestral Call I, Ancestral Call II, Barbs I, Barbs II, Barbs III, Behead I, Behead II, Einhar's Beastrite, Impact Shockwave, Minion Splash I, Minion Splash II, Practiced Combo, Volcanic Eruption |
| Minion | 6 | Amanamu's Tithe, Crazed Minions, Deathmarch, Essence Harvest, Hulking Minions, Minion Mastery |
| MinionsCanExplode | 5 | Concentrated Area, Expanse, Magnified Area I, Magnified Area II, Vorana's Siege |
| Nova | 1 | Astral Projection |
| ObjectDurability | 1 | Durability |
| Offering | 4 | Danse Macabre, Guatelitzi's Ablation, Kulemak's Dominion, Sacrificial Offering |
| PerfectTiming | 5 | Perfected Endurance, Perfection, Tasalio's Rhythm, Window of Opportunity I, Window of Opportunity II |
| PerformsFinalStrike | 4 | Crescendo I, Crescendo II, Crescendo III, Rending Apex |
| Persistent | 36 | Amanamu's Tithe, Arbiter's Reach, Atziri's Communion, Cannibalism I, Cannibalism II, Clarity I, Clarity II, Cool Headed, Crazed Minions, Deathmarch, Direstrike I, Direstrike II, Essence Harvest, Healing Runes, Her Declaration, Herbalism I, Herbalism II, Hulking Minions, Last Gasp, Mysticism I, Mysticism II, Precision I, Precision II, Refraction I, Refraction II, Refraction III, Seraph's Heart, Strong Hearted, Tecrod's Revenge, Thornskin I, Thornskin II, Upwelling I, Upwelling II, Vitality I, Vitality II, Warm Blooded |
| Physical | 1 | Physical Mastery |
| Plant | 3 | Accelerated Growth, Accelerated Growth II, Poison Spores |
| Projectile | 34 | Breachlord's Amalgam, Chain I, Chain II, Chain III, Dominus' Grasp, Flamepierce, Fork, Freezefork, Gambleshot, Multishot I, Multishot II, Nova Projectiles I, Nova Projectiles II, Pierce I, Pierce II, Pierce III, Projectile Acceleration I, Projectile Acceleration II, Projectile Acceleration III, Projectile Deceleration I, Projectile Deceleration II, Retreat I, Retreat II, Retreat III, Ricochet I, Ricochet II, Salvo, Sione's Temper, Spectral Volley, Stormchain, Vilenta's Propulsion, Volt, Wildshards I, Wildshards II |
| ProjectileNumber | 4 | Multishot I, Multishot II, Nova Projectiles I, Nova Projectiles II |
| ProjectileSpeed | 5 | Projectile Acceleration I, Projectile Acceleration II, Projectile Acceleration III, Projectile Deceleration I, Projectile Deceleration II |
| RangedAttack | 1 | Caltrops |
| RequiresShield | 3 | Styrn's Ferocity, Vanguard I, Vanguard II |
| Shapeshift | 1 | Helbrym's Hide |
| Slam | 12 | Aftershock I, Aftershock II, Brambleslam, Fist Of Kalguur, Fist of War I, Fist of War II, Fist of War III, Jagged Ground I, Jagged Ground II, Reverberate, Syzygy, Tectonic Slams |
| Spear | 2 | Caltrops, Spectral Volley |
| SpecialAncestralBoost | 2 | Ancestral Call I, Ancestral Call II |
| Spell | 27 | Arbiter's Ignition, Arcane Surge, Chaotic Freeze, Considered Casting, Controlled Destruction, Drain Ailments, Elemental Discharge, Expand, Extraction, Inhibitor, Intense Agony, Mana Flare, Oisin's Oath, Potent Exposure, Rapid Casting I, Rapid Casting II, Rapid Casting III, Sione's Temper, Slow Potency, Trickster's Shard, Unleash, Vilenta's Propulsion, Wildshards I, Wildshards II, Zarokh's Revolt, Zenith I, Zenith II |
| Storm | 2 | Advancing Storm, Morgana's Tempest |
| SummonsTotem | 13 | Cirel's Cultivation, Font of Blood, Font of Mana, Hardy Totems I, Hardy Totems II, Reinforced Totems I, Reinforced Totems II, Splinter Totem I, Splinter Totem II, Tawhoa's Tending, Urgent Totems I, Urgent Totems II, Urgent Totems III |
| TargetsDestructibleCorpses | 2 | Corpse Conservation, Gorge |
| TargetsDestructibleRareCorpses | 2 | Corpse Conservation, Gorge |
| Travel | 2 | Opening Move, Stomping Ground |
| Triggers | 2 | Fluke, Ixchel's Torment |
| Unleashable | 2 | Unleash, Zarokh's Revolt |
| UsableWhileMoving | 2 | Deliberation, Mobility |
| UsedByTotem | 6 | Cirel's Cultivation, Splinter Totem I, Splinter Totem II, Urgent Totems I, Urgent Totems II, Urgent Totems III |
| Wall | 3 | Ahn's Citadel, Fortress I, Fortress II |
| Warcry | 16 | Armour Explosion, Battershout, Bhatair's Vengeance, Corrupting Cry I, Corrupting Cry II, Echoing Cry, Enraged Warcry I, Enraged Warcry II, Exposing Cry, Ice Bite I, Ice Bite II, Paquate's Pact, Raging Cry, Tireless, Vruun's Aftermath, Zerphi's Infamy |
| Wind | 3 | Fan The Flames, Fan The Flames II, Impact Shockwave |

### 禁止类型出现频次（excludeSkillTypes）

| 类型 | 被禁止次数 |
|---|---|
| Persistent | 102 |
| UsedByProxy | 91 |
| Triggered | 88 |
| Channel | 19 |
| MinionsAreUndamagable | 16 |
| Cooldown | 15 |
| Instant | 15 |
| HasUsageCondition | 11 |
| ProjectileNoCollision | 11 |
| SingleLevelSkill | 10 |
| Minion | 9 |
| UsedByTotem | 8 |
| NoAttackOrCastTime | 8 |
| ProjectilesNumberModifiersNotApplied | 7 |
| CannotChain | 7 |
| SummonsTotem | 6 |
| SkillConsumesFreeze | 6 |
| SkillGrantedBySupport | 6 |
| FixedSpeedProjectile | 6 |
| HasSeals | 5 |
| DegenOnlySpellDamage | 5 |
| ConsumesFullyBrokenArmour | 4 |
| Aura | 4 |
| ComboStacking | 4 |
| FixedCastTime | 4 |
| Meta | 4 |
| SkillConsumesIgnite | 4 |
| Sustained | 3 |
| Trapped | 3 |
| RemoteMined | 3 |
| Rain | 3 |
| CannotSpiritStrike | 3 |
| HasReservation | 3 |
| SupportedByBitingFrost | 3 |
| Attack | 3 |
| Herald | 3 |
| UnlimitedTotems | 3 |
| SkillConsumesPowerChargesOnUse | 2 |
| Vaal | 2 |
| ReservationBecomesCost | 2 |
| CreatesMinion | 2 |
| SupportedByComboFinisher | 2 |
| SupportedByComboMastery | 2 |
| SkillConsumesShock | 2 |
| SkillConsumesBleeding | 2 |
| CannotCreateJaggedGround | 2 |
| Blessing | 2 |
| CannotTerrainChain | 2 |
| HasNoCost | 2 |
| SupportedByUnleash | 2 |
| Spell | 2 |
| SupportedByRuneforgedBlades | 1 |
| SupportedByAbidingHex | 1 |
| SupportedByNovaProjectiles | 1 |
| SupportedBySalvo | 1 |
| CreatesFissure | 1 |
| SupportedByAncestralAid | 1 |
| SupportedByBattershout | 1 |
| SupportedByCleanse | 1 |
| SupportedByCreepingChill | 1 |
| SupportedByHayoxi | 1 |
| SupportedByUnmoving | 1 |
| SkillConsumesPoison | 1 |
| SupportedByDrainedAilment | 1 |
| SupportedByEchoingCry | 1 |
| SupportedByElementalDischarge | 1 |
| Buff | 1 |
| OngoingSkill | 1 |
| SupportedByExploitWeakness | 1 |
| SkillConsumesFrenzyChargesOnUse | 1 |
| SupportedByFerocity | 1 |
| SupportedByFlamePillar | 1 |
| SupportedByFrostfire | 1 |
| FrozenSpite | 1 |
| GroundTargetedProjectile | 1 |
| SupportedByGarukhan | 1 |
| SupportedByBreachlordsAmalgam | 1 |
| SupportedByExcise | 1 |
| SupportedByExecrate | 1 |
| SupportedByExpanse | 1 |
| SupportedByHourglass | 1 |
| SupportedByHaemoCrystals | 1 |
| SupportedByMobileAssault | 1 |
| Slam | 1 |
| SupportedByVruunsInevitablity | 1 |
| RequiresCharges | 1 |
| SkillConsumesEnduranceChargesOnUse | 1 |
| SupportedByJaggedGround | 1 |
| IndeterminateEmpowermentAmount | 1 |
| SkillConsumesParried | 1 |
| SupportedByFrenziedRiposte | 1 |
| SupportedByExpand | 1 |
| RemnantCannotBeShared | 1 |
| Jumping | 1 |
| SupportedByZarokh | 1 |
| SupportedByTulsAvalanche | 1 |

## 四、未关联到宝石条目的效果（29）

| 效果 id | 名称 | 效果 |
|---|---|---|
| `SpiritVesselSupport` | SpiritVesselSupport | — |
| `SupportAncestralWarriorTotemPlayer` | SupportAncestralWarriorTotemPlayer | — |
| `SupportAnimusSplintersPlayer` | SupportAnimusSplintersPlayer | — |
| `SupportBarrierInvocationPlayer` | SupportBarrierInvocationPlayer | — |
| `SupportBlasphemyPlayer` | SupportBlasphemyPlayer | — |
| `SupportElementalInvocationPlayer` | SupportElementalInvocationPlayer | — |
| `SupportFeralInvocationPlayer` | SupportFeralInvocationPlayer | — |
| `SupportFerociousRoarPlayer` | SupportFerociousRoarPlayer | — |
| `SupportHandOfChayulaPlayer` | SupportHandOfChayulaPlayer | — |
| `SupportHollowFormPlayer` | SupportHollowFormPlayer | — |
| `SupportMetaCastCurseOnBlockPlayer` | SupportMetaCastCurseOnBlockPlayer | — |
| `SupportMetaCastFireSpellOnHitPlayer` | SupportMetaCastFireSpellOnHitPlayer | — |
| `SupportMetaCastLightningSpellOnHitPlayer` | SupportMetaCastLightningSpellOnHitPlayer | — |
| `SupportMetaCastOnBlockPlayer` | SupportMetaCastOnBlockPlayer | — |
| `SupportMetaCastOnCharmUsePlayer` | SupportMetaCastOnCharmUsePlayer | — |
| `SupportMetaCastOnCritPlayer` | SupportMetaCastOnCritPlayer | — |
| `SupportMetaCastOnDodgePlayer` | SupportMetaCastOnDodgePlayer | — |
| `SupportMetaCastOnElementalAilmentPlayer` | SupportMetaCastOnElementalAilmentPlayer | — |
| `SupportMetaCastOnMeleeKillPlayer` | SupportMetaCastOnMeleeKillPlayer | — |
| `SupportMetaCastOnMeleeStunPlayer` | SupportMetaCastOnMeleeStunPlayer | — |
| `SupportMetaCastOnMinionDeathPlayer` | SupportMetaCastOnMinionDeathPlayer | — |
| `SupportMetaDeadeyeMarksPlayer` | SupportMetaDeadeyeMarksPlayer | — |
| `SupportMetaTotemSpellTotemPlayer` | SupportMetaTotemSpellTotemPlayer | — |
| `SupportMirageArcherPlayer` | SupportMirageArcherPlayer | — |
| `SupportMirageDeadeyePlayer` | SupportMirageDeadeyePlayer | — |
| `SupportMortarCannonPlayer` | SupportMortarCannonPlayer | — |
| `SupportReapersInvocationPlayer` | SupportReapersInvocationPlayer | — |
| `SupportSpellslingerPlayer` | SupportSpellslingerPlayer | — |
| `SupportWolfPouncePlayer` | SupportWolfPouncePlayer | — |
