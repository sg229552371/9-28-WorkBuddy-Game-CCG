# API 地图（自动生成，勿手改）

> D-47：本文件由 `tools/gen_api_map.gd` 扫描三类真源自动产出。
> 接口/内容改动后必须重跑生成；门禁 `tests/docs/test_api_map.gd` 比对磁盘内容，过期即红。
> 重新生成：`Godot --headless --path . -s res://mods/jes-skills/tools/gen_api_map.gd`
>
> 生成时间戳不写入本文件（保证逐字节确定性，便于门禁比对）。

## 一、行为层声明面（behavior/*.gd）

### BhvAoeBurst（`systems/skills/behavior/bhv_aoe_burst.gd`）
- produced_params（参数键承诺）: `shape`, `radius`, `inner_radius`, `delay`, `hit_count`, `hit_interval`, `arc_deg`, `range`, `length`, `width`, `point_count`, `point_spacing`
- consumed_stats（消费属性）: `area_size`, `duration`

### BhvBuffSelf（`systems/skills/behavior/bhv_buff_self.gd`）
- produced_params（参数键承诺）: `duration`, `buff_mods`
- consumed_stats（消费属性）: `duration`

### BhvChannel（`systems/skills/behavior/bhv_channel.gd`）
- produced_params（参数键承诺）: `shape`, `arc_deg`, `range`, `tick_interval`, `max_channel_time`
- consumed_stats（消费属性）: `duration`, `area_size`

### BhvDash（`systems/skills/behavior/bhv_dash.gd`）
- produced_params（参数键承诺）: `distance`, `speed`, `path_damage`, `path_width`, `path_zone_duration`, `hit_count`, `tick_interval`
- consumed_stats（消费属性）: —

### BhvMeleeSwing（`systems/skills/behavior/bhv_melee_swing.gd`）
- produced_params（参数键承诺）: `shape`, `arc_deg`, `range`, `angle_deg`
- consumed_stats（消费属性）: `area_size`

### BhvProjectile（`systems/skills/behavior/bhv_projectile.gd`）
- produced_params（参数键承诺）: `projectile_count`, `speed`, `radius`, `pierce`, `fork_count`, `chain_count`, `motion`, `orbit_radius`, `lifetime`, `spread_deg`
- consumed_stats（消费属性）: `area_size`

### BhvSummon（`systems/skills/behavior/bhv_summon.gd`）
- produced_params（参数键承诺）: `max_count`, `scene`, `lifetime`, `formation`, `per_cast`, `formation_radius`, `formation_spacing`, `point_count`, `point_spacing`, `delay`
- consumed_stats（消费属性）: `duration`, `area_size`

## 二、标签承诺面（util/tag_registry.gd）

| 标签 | 类别 | 承诺参数面 |
|---|---|---|
| `channel` | form | `shape`, `arc_deg`, `range`, `tick_interval`, `max_channel_time` |
| `trap` | form | `delay` |
| `buff` | form | `duration`, `buff_mods` |
| `summon` | form | `max_count`, `scene`, `lifetime`, `formation`, `per_cast`, `formation_radius`, `formation_spacing`, `point_count`, `point_spacing`, `delay` |
| `movement` | form | `distance`, `speed`, `path_width`, `path_zone_duration`, `tick_interval`, `hit_count` |
| `aoe` | form | `shape`, `radius`, `inner_radius`, `delay`, `hit_count`, `hit_interval`, `arc_deg`, `range`, `length`, `width`, `point_count`, `point_spacing` |
| `projectile` | form | `projectile_count`, `speed`, `radius`, `pierce`, `fork_count`, `chain_count`, `motion`, `orbit_radius`, `lifetime`, `spread_deg` |
| `melee` | form | `shape`, `arc_deg`, `range`, `angle_deg` |
| `spell` | cast_type | — |
| `attack` | cast_type | — |
| `chaos` | damage_type | — |
| `lightning` | damage_type | — |
| `cold` | damage_type | — |
| `fire` | damage_type | — |
| `physical` | damage_type | — |

## 三、主动技能总表（content/gems/active）

共 67 颗。

| 中文名 | gem_id | 行为段（行为×形状×时序线索） | 标签 | 耗蓝/冷却 |
|---|---|---|---|---|
| 三段连斩 | `triple_slash` | aoe_burst(shape=sec; delay=0; hit_count=3; hit_interval=0.35) | `attack`, `aoe`, `physical` | 10.0 / 2.8s |
| 元素壁障 | `elemental_ward` | buff_self(默认) | `spell`, `buff` | 14.0 / 7.0s |
| 光墙 | `light_wall` | aoe_burst(shape=line; delay=0; hit_count=6; hit_interval=0.80) | `spell`, `aoe`, `cold` | 14.0 / 4.2s |
| 光墙弹 | `beam_wall_bomb` | projectile(默认) → aoe_burst(shape=line; delay=0; hit_count=6; hit_interval=0.80) | `spell`, `projectile`, `aoe`, `lightning` | 13.0 / 4.0s |
| 光束弹 | `beam_bolt` | projectile(默认) → aoe_burst(shape=line; delay=0; hit_count=1; hit_interval=0) | `spell`, `projectile`, `aoe`, `lightning` | 11.0 / 3.0s |
| 冲撞落点爆 | `crash_land_burst` | dash(默认) → aoe_burst(shape=circ; delay=0.50; hit_count=1; hit_interval=0) | `attack`, `movement`, `aoe`, `fire` | 13.0 / 4.2s |
| 冲撞踩踏 | `trample_charge` | dash(默认) | `attack`, `movement`, `physical` | 12.0 / 5.0s |
| 单体瞬击 | `point_snap` | aoe_burst(shape=pt; delay=0; hit_count=1; hit_interval=0) | `attack`, `aoe`, `lightning` | 9.0 / 2.6s |
| 原地旋风 | `whirl_channel` | channel(shape=circ) | `spell`, `channel`, `physical` | 12.0 / 3.4s |
| 原地领域 | `standing_field` | aoe_burst(shape=circ; delay=0; hit_count=5; hit_interval=1) | `spell`, `aoe`, `lightning` | 18.0 / 6.0s |
| 召唤墙 | `summon_wall` | summon(formation=line; per_cast=3) → aoe_burst(shape=line; delay=0; hit_count=8; hit_interval=1) | `spell`, `summon`, `aoe`, `fire` | 20.0 / 7.0s |
| 周身多点爆 | `multi_burst` | aoe_burst(shape=multi; delay=0; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 11.0 / 3.2s |
| 图腾阵 | `totem_array` | aoe_burst(shape=circ; delay=0.80; hit_count=1; hit_interval=0) → summon(formation=ring; per_cast=3) | `spell`, `aoe`, `summon` | 18.0 / 6.0s |
| 地刺壁垒 | `field_fortify` | aoe_burst(delay=0; hit_count=3; hit_interval=0.70) → buff_self(默认) | `spell`, `aoe`, `chaos`, `buff` | 18.0 / 5.0s |
| 多重毒圈弹 | `multi_venom_bomb` | projectile(默认) → aoe_burst(shape=circ; delay=0; hit_count=5; hit_interval=0.80) | `spell`, `projectile`, `aoe`, `chaos` | 15.0 / 4.5s |
| 天降多点 | `sky_multi_burst` | aoe_burst(shape=multi; delay=0.70; hit_count=1; hit_interval=0) | `spell`, `aoe`, `physical` | 15.0 / 4.5s |
| 延时扇爆弹 | `delayed_fan_bomb` | projectile(默认) → aoe_burst(shape=sec; delay=0.70; hit_count=1; hit_interval=0) | `attack`, `projectile`, `aoe`, `cold` | 15.0 / 4.5s |
| 延时爆弹 | `delayed_blast_bomb` | projectile(默认) → aoe_burst(shape=circ; delay=0.70; hit_count=1; hit_interval=0) | `attack`, `projectile`, `aoe`, `fire` | 13.0 / 4.0s |
| 延时环爆弹 | `delayed_ring_bomb` | projectile(默认) → aoe_burst(shape=ring; delay=0.80; hit_count=1; hit_interval=0) | `spell`, `projectile`, `aoe`, `fire` | 15.0 / 4.5s |
| 延迟光轨 | `delayed_light_track` | aoe_burst(shape=line; delay=0.80; hit_count=1; hit_interval=0) | `spell`, `aoe`, `lightning` | 13.0 / 4.0s |
| 延迟冲击环 | `delayed_shock_ring` | aoe_burst(shape=ring; delay=0.80; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 14.0 / 4.2s |
| 延迟终点环爆 | `delayed_end_ring` | dash(默认) → aoe_burst(shape=ring; delay=0.70; hit_count=1; hit_interval=0) | `attack`, `movement`, `aoe`, `fire` | 14.0 / 4.4s |
| 引信印记 | `mark_detonate` | aoe_burst(shape=pt; delay=0.90; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 13.0 / 4.0s |
| 引导领域 | `channel_field` | channel(shape=circ) | `spell`, `channel`, `cold` | 13.0 / 3.9s |
| 影缝闪避 | `rift_step` | dash(默认) | `attack`, `movement`, `physical` | 8.0 / 2.0s |
| 扇形喷火 | `cone_flame` | channel(shape=sec) | `spell`, `channel`, `fire` | 14.0 / 3.5s |
| 扇爆弹 | `fan_blast_bomb` | projectile(默认) → aoe_burst(shape=sec; delay=0; hit_count=1; hit_interval=0) | `attack`, `projectile`, `aoe`, `cold` | 12.0 / 3.5s |
| 持续光束 | `sustained_beam` | channel(shape=line) | `spell`, `channel`, `lightning` | 13.0 / 3.8s |
| 星屑连射 | `stardust_volley` | projectile(默认) | `spell`, `projectile`, `lightning` | 18.0 / 1.2s |
| 星落弹幕 | `starfall_barrage` | projectile(默认) → aoe_burst(shape=circ; delay=0.60; hit_count=1; hit_interval=0) | `spell`, `projectile`, `aoe`, `lightning` | 14.0 / 4.0s |
| 暗影冲刺 | `shadow_dash` | dash(默认) | `attack`, `movement`, `physical` | 10.0 / 4.0s |
| 毒云弹 | `venom_cloud_bomb` | projectile(默认) → aoe_burst(shape=circ; delay=0; hit_count=5; hit_interval=0.80) | `spell`, `projectile`, `aoe`, `chaos` | 12.0 / 3.5s |
| 沿线雷阵 | `line_mine_array` | aoe_burst(shape=line; delay=0.60; hit_count=1; hit_interval=0) → summon(formation=line; per_cast=4) | `spell`, `aoe`, `summon` | 19.0 / 6.5s |
| 火烛守卫 | `everflame_warden` | buff_self(默认) → summon(默认) | `spell`, `summon`, `physical`, `buff` | 16.0 / 8.0s |
| 灵魂召唤 | `spirit_summon` | summon(默认) | `spell`, `summon`, `physical` | 20.0 / 5.0s |
| 烈焰爆发 | `fire_burst` | aoe_burst(delay=0.50; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 10.0 / 2.0s |
| 熔核引爆 | `core_detonate` | aoe_burst(delay=1.20; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 22.0 / 3.2s |
| 狂暴 | `berserk` | buff_self(默认) | `spell`, `buff` | 10.0 / 6.0s |
| 猎杀号令 | `hunt_call` | buff_self(默认) | `attack`, `buff` | 16.0 / 7.0s |
| 环形召4 | `ring_summon_4` | summon(formation=ring; per_cast=4) | `spell`, `summon`, `physical` | 22.0 / 6.0s |
| 环爆弹 | `ring_blast_bomb` | projectile(默认) → aoe_burst(shape=ring; delay=0; hit_count=1; hit_interval=0) | `spell`, `projectile`, `aoe`, `fire` | 12.0 / 3.5s |
| 环绕飞刃 | `orbit_blades` | projectile(motion=orbit) | `attack`, `projectile`, `physical` | 12.0 / 4.0s |
| 留下火径 | `fire_trail` | dash(默认) | `attack`, `movement`, `fire` | 14.0 / 6.0s |
| 留痕火弹 | `scorch_trail_bolt` | projectile(默认) → aoe_burst(shape=line; delay=0; hit_count=5; hit_interval=0.30) | `spell`, `projectile`, `aoe`, `fire` | 13.0 / 4.0s |
| 瞬发光束 | `instant_beam` | aoe_burst(shape=line; delay=0; hit_count=1; hit_interval=0) | `spell`, `aoe`, `lightning` | 13.0 / 3.0s |
| 磐石架势 | `stone_stance` | buff_self(默认) | `spell`, `buff`, `physical` | 12.0 / 8.0s |
| 空心冲击波 | `hollow_shockwave` | aoe_burst(shape=ring; delay=0.35; hit_count=1; hit_interval=0) | `spell`, `aoe`, `fire` | 14.0 / 3.5s |
| 终点环爆 | `end_ring_burst` | dash(默认) → aoe_burst(shape=ring; delay=0; hit_count=1; hit_interval=0) | `attack`, `movement`, `aoe`, `physical` | 12.0 / 3.8s |
| 翻滚闪避 | `breach_roll` | dash(默认) → buff_self(默认) | `attack`, `movement`, `physical`, `buff` | 12.0 / 5.0s |
| 聚焦光束 | `focus_beam` | channel(shape=pt) | `spell`, `channel`, `cold` | 11.0 / 3.0s |
| 落烬环 | `ring_of_cinders` | aoe_burst(delay=0.10; hit_count=3; hit_interval=1) | `spell`, `aoe`, `fire` | 22.0 / 6.0s |
| 蓄力单爆 | `charge_snap` | channel(shape=pt) → aoe_burst(shape=pt; delay=0.25; hit_count=1; hit_interval=0) | `spell`, `channel`, `aoe`, `lightning` | 14.0 / 4.0s |
| 蓄力大爆 | `charge_big_blast` | channel(shape=circ) → aoe_burst(shape=circ; delay=0.30; hit_count=1; hit_interval=0) | `spell`, `channel`, `aoe`, `fire` | 15.0 / 4.5s |
| 蓄力扇爆 | `charge_fan_blast` | channel(shape=sec) → aoe_burst(shape=sec; delay=0.25; hit_count=1; hit_interval=0) | `spell`, `channel`, `aoe`, `fire` | 15.0 / 4.4s |
| 蓄力激光 | `charge_laser` | channel(shape=line) → aoe_burst(shape=line; delay=0.20; hit_count=1; hit_interval=0) | `spell`, `channel`, `aoe`, `chaos` | 15.0 / 4.4s |
| 蚀骨引线 | `chaos_beam` | channel(默认) | `spell`, `channel`, `chaos` | 10.0 / 3.0s |
| 行进光束弹 | `traveling_beam_bolt` | projectile(默认) → aoe_burst(shape=line; delay=0; hit_count=4; hit_interval=0.25) | `spell`, `projectile`, `aoe`, `lightning` | 11.0 / 3.0s |
| 裂地余震 | `quake_field` | aoe_burst(delay=0; hit_count=4; hit_interval=0.70) | `spell`, `aoe`, `physical` | 18.0 / 4.5s |
| 裂石重击 | `sunder_strike` | melee_swing(默认) | `attack`, `melee`, `physical` | 16.0 / 1.4s |
| 贯空箭 | `piercing_bolt` | projectile(默认) | `attack`, `projectile`, `physical` | 12.0 / 0.9s |
| 路径延迟爆 | `path_delay_blast` | dash(默认) → aoe_burst(shape=line; delay=0.40; hit_count=2; hit_interval=0.40) | `attack`, `movement`, `aoe`, `fire` | 13.0 / 4.2s |
| 轨迹爆弹 | `trajectory_burst_bomb` | projectile(默认) → aoe_burst(shape=line; delay=0.60; hit_count=3; hit_interval=0.25) | `spell`, `projectile`, `aoe`, `lightning` | 12.0 / 3.5s |
| 载荷箭 | `payload_arrow` | projectile(默认) → aoe_burst(shape=circ; delay=0.35; hit_count=1; hit_interval=0) | `attack`, `projectile`, `aoe`, `fire` | 12.0 / 3.5s |
| 雷光斩 | `lightning_slash` | melee_swing(默认) | `attack`, `melee`, `lightning` | 10.0 / 0.0s |
| 霜爆新星 | `frost_nova` | aoe_burst(delay=0.35; hit_count=1; hit_interval=0) | `spell`, `aoe`, `cold` | 12.0 / 2.5s |
| 霜矛 | `frost_shard` | projectile(默认) | `attack`, `projectile`, `cold` | 10.0 / 0.0s |
| 预警爆圈 | `warning_circle_burst` | aoe_burst(shape=circ; delay=0.90; hit_count=1; hit_interval=0) | `spell`, `aoe`, `cold` | 14.0 / 4.2s |

## 四、辅助宝石总表（content/gems/supports）

共 13 颗。四个作用口子：stat_modifiers / add-require-exclude tags / behavior_overrides / conditions（D-15 暂缓）。

| 中文名 | support_id | require | require_any | exclude | stat_modifiers | overrides 键 |
|---|---|---|---|---|---|---|
| 召唤强化 | `support_minion` | `summon` | — | — | minion_damage+40; minion_life+60; minion_attack_speed×25 | — |
| 多重投射 | `support_multi` | `projectile` | — | — | — | `projectile_count` |
| 寒冷聚焦 | `support_cold_focus` | `cold` | — | — | cold_damage×50 | — |
| 弹道加速 | `support_velocity` | `projectile` | — | — | — | `speed` |
| 持久引导 | `support_channel_focus` | `channel` | — | — | — | `max_channel_time` |
| 持续延长 | `support_duration` | — | `aoe`, `channel`, `summon`, `buff` | — | duration×30 | — |
| 暴击强化 | `support_crit` | `attack` | — | — | crit_chance+15 | — |
| 烈焰专注 | `support_fire_focus` | `fire` | — | — | fire_damage×45 | — |
| 环绕转化 | `support_orbit` | `projectile` | — | — | — | `motion`, `orbit_radius` |
| 穿透强化 | `support_pierce` | `projectile` | — | — | — | `pierce` |
| 范围扩大 | `support_area` | — | `projectile`, `melee`, `aoe` | — | area_size×30 | — |
| 近战专精 | `support_melee_focus` | `melee` | — | — | physical_damage×40 | — |
| 连锁反应 | `support_chain` | `projectile` | — | — | — | `chain_count` |
