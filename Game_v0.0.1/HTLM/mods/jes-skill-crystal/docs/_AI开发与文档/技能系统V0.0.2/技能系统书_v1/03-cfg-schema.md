# 《技能 CFG Schema v0.1》

> 版本：v0.1　日期：2026-10-18　轮次：第 1 轮
> 执笔：Claude CLI（gpt-6-astra）　评审：WorkBuddy
> 文档性质：编辑器写入、运行时读取的技能定义契约；不是运行时实例格式，也不是主书稿机器摘要的替代品。
> 适用范围：技能石、辅助石组合后的单技能定义；水晶/遗物通过 `params.modifiers` 进入同一份可校验配置。

---

## 0. 这份 Schema 解决什么问题

本文件把“编辑器能填写什么”和“运行时能读取什么”收敛为同一个结构。编辑器可以有折叠、选择、撤销、草稿、预览和错误定位；这些都是编辑态能力，不写入技能 CFG。运行时拥有 `instance_id`、`seq`、`origin`、`snapshot`、`state` 等实例字段；这些是加载后生成的运行态数据，也不回写本文件。技能 CFG 只描述一个技能如何由积木、参数、表现和非功能提示组成。

本版采用 UTF-8 YAML 作为落盘格式。YAML 只是序列化外壳，语义等同于下方机器可读定义；不允许重复键、自定义执行标签、隐式字符串布尔值、非有限数字或依靠键顺序表达逻辑。空数组和空对象是有意的“没有配置”，与缺失字段不同；`null` 只有字段明确声明 `nullable: true` 时才合法。所有逻辑时间以整数 tick 保存；编辑器可以让作者输入秒，但提交前必须按项目时钟换算并把换算后的 tick 写入相应字段。

本契约有一个容易被忽略的边界：技能定义中的 `carrier` 使用四类冻结值 `none` / `self` / `independent` / `attached`。积木登记格式同样使用这四类值。`none` 表示瞬时实例，`self` 表示施法者自身运动所承载的跟随判定体；不能把旧材料中的 `instant` 静默写入本版，也不能把 `attached` 当作第五类“状态事件”。

## 1. 机器可读 Schema

下面是本版的 YAML Schema 定义。它采用 JSON Schema Draft 2020-12 的数据模型，但为了便于文档工具和编辑器直接读取，使用 YAML 表示。`canonical_skill_cfg` 是编辑器真正写入的七键技能格式；`appendix_b_contract_summary` 是只读兼容分支，用于让主书稿附录 B 的现有 YAML 能被同一解析器识别、校验和展示。兼容分支不是可保存的技能定义，见第 7 节。

```yaml
$schema: https://json-schema.org/draft/2020-12/schema
$id: https://local.skill-system.invalid/schema/skill-cfg/0.1
$title: Skill CFG Schema v0.1
$comment: >-
  canonical_skill_cfg 是七键技能定义；appendix_b_contract_summary 只读接受主书稿附录B。
  不允许把兼容摘要直接当作可运行技能保存。
type: object
oneOf:
  - $ref: '#/$defs/canonical_skill_cfg'
  - $ref: '#/$defs/appendix_b_contract_summary'
$defs:
  finite_number:
    type: number
    description: 有限实数；NaN 和正负无穷均拒绝。
  non_negative_int:
    type: integer
    minimum: 0
  positive_int:
    type: integer
    minimum: 1
  ref:
    type: string
    minLength: 1
    pattern: '^[A-Za-z0-9_./:-]+$'
  snake_id:
    type: string
    minLength: 1
    pattern: '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'
  carrier:
    type: string
    enum: [none, self, independent, attached]
  status:
    type: string
    enum: [已登记, 候选, 预留]
  part_type:
    type: string
    enum: [physical, fire, ice, lightning, arcane, heal, shield, buff, debuff, knockback, control]
  event:
    type: string
    enum: [hit, vanish]
  vanish_reason:
    type: string
    enum: [hit_end, range_end, landed, expired, returned, interrupted, instant_end]
  derivation_reason:
    type: string
    enum: [hit_end, range_end, landed, expired, returned, interrupted, instant_end]
  permission:
    type: string
    enum: [mutate_number, add_behavior, mutate_live_instance]
  scope:
    type: string
    enum: [own_skill, tagged]
  targeting_group:
    type: string
    enum: [enemy, ally, point]
  target_mode:
    type: string
    enum: [nearest, direction, ground, untargeted]
  motion_mode:
    type: string
    enum: [straight, lob, orbit, stationary, wavefront, returning, follow, homing, ricochet, expanding]
  geometry_shape:
    type: string
    enum: [circle, sector, line, rectangle]
  on_target_lost:
    type: string
    enum: [continue, terminate]
  record:
    type: string
    enum: [cast_started, hit_settled, evaded_all, damage_taken]
  modifier_stack_rule:
    type: object
    required: [operation_profile]
    additionalProperties: false
    properties:
      operation_profile: { $ref: '#/$defs/ref' }
      operands: { type: array }
      note: { type: string }
  brick_card:
    type: object
    additionalProperties: false
    required: [brick_id, name, tagline, carrier, summary, default_cfg, author_params, locked_params, relic_params, presentation, player_text, status]
    properties:
      brick_id:
        $ref: '#/$defs/snake_id'
      name:
        type: string
        minLength: 1
      tagline:
        type: string
        minLength: 1
        maxLength: 30
      carrier:
        $ref: '#/$defs/carrier'
      summary:
        type: string
        minLength: 1
      default_cfg:
        type: object
        description: 可被同一 Schema 展开的默认 CFG 片段；不得含运行结果字段。
      author_params:
        type: array
        items: { type: string, minLength: 1 }
      locked_params:
        type: object
        additionalProperties: { type: string, minLength: 1 }
      relic_params:
        type: object
        additionalProperties:
          type: string
          enum: [可改, 可加, 禁止]
      presentation:
        type: array
        uniqueItems: true
        items:
          type: string
          enum: [fx, sfx, anim, trail, camera, damage_number, status_icon]
      player_text:
        type: array
        maxItems: 3
        items: { type: string, minLength: 1 }
      status:
        $ref: '#/$defs/status'
  meta:
    type: object
    additionalProperties: false
    required: [role, category, short_name, name, version, author]
    properties:
      role:
        type: string
        minLength: 1
        pattern: '^[a-z][a-z0-9_]*$'
      category:
        type: string
        enum: [active, passive, crystal, relic]
      short_name: { type: string, minLength: 1 }
      variant: { type: string, default: '' }
      name: { type: string, minLength: 1 }
      author: { type: string, minLength: 1 }
      version:
        type: string
        pattern: '^[0-9]+\.[0-9]+\.[0-9]+$'
      intent: { type: string, minLength: 1 }
      tags:
        type: array
        uniqueItems: true
        default: []
        items: { $ref: '#/$defs/ref' }
      pools:
        type: array
        uniqueItems: true
        default: []
        items: { $ref: '#/$defs/ref' }
      status:
        type: string
        enum: [recommended, pending, approved, archived]
        default: recommended
      player_text:
        type: array
        maxItems: 3
        default: []
        items: { type: string, minLength: 1 }
      design_notes: { type: string, default: '' }
      copied_from:
        anyOf: [{ type: 'null' }, { $ref: '#/$defs/ref' }]
        default: null
      player_attributes:
        type: array
        uniqueItems: true
        default: []
        items: { $ref: '#/$defs/ref' }
  hit_policy:
    type: object
    additionalProperties: false
    required: [per_target_limit]
    properties:
      per_target_limit:
        type: integer
        minimum: 1
        default: 1
        description: 按候选接触计数，不是成立 hit 次数。
      rehit_interval_ticks:
        type: integer
        minimum: 1
      max_hits:
        type: integer
        minimum: 1
        description: 只计成立 hit；省略表示没有该项限制。
  targeting:
    type: object
    additionalProperties: false
    required: [target_group]
    properties:
      target_group: { $ref: '#/$defs/targeting_group' }
      friendly_fire: { type: boolean, default: false }
      include_self: { type: boolean, default: false }
      target_mode: { $ref: '#/$defs/target_mode', default: nearest }
  part:
    type: object
    additionalProperties: false
    required: [part_index, type]
    properties:
      part_index: { type: integer, minimum: 0 }
      type: { $ref: '#/$defs/part_type' }
      amount: { type: number, minimum: 0, default: 0 }
      amount_profile: { $ref: '#/$defs/ref' }
      evadable: { type: boolean }
      immunity_profile: { $ref: '#/$defs/ref' }
      crit_profile: { $ref: '#/$defs/ref' }
      block_profile: { $ref: '#/$defs/ref' }
      duration_ticks: { type: integer, minimum: 1 }
      control_type: { type: string, enum: [stun, freeze, silence, root, knockback, displace] }
      interrupts_cast: { type: boolean }
      distance: { type: number, minimum: 0 }
      displacement_speed: { type: number, exclusiveMinimum: 0 }
      restack_rule:
        type: string
        enum: [refresh_single, keep_longer, finite_stack]
        default: refresh_single
      stack_limit: { type: integer, minimum: 1, default: 1 }
      status_profile: { $ref: '#/$defs/ref' }
      immune_flags:
        type: array
        uniqueItems: true
        default: []
        items: { $ref: '#/$defs/ref' }
      settlement:
        type: object
        additionalProperties: false
        properties:
          crit_profile: { $ref: '#/$defs/ref' }
          block_profile: { $ref: '#/$defs/ref' }
  template:
    type: object
    additionalProperties: false
    required: [template_id, carrier, targeting, lifetime_ticks, parts]
    properties:
      template_id: { $ref: '#/$defs/snake_id' }
      carrier: { $ref: '#/$defs/carrier' }
      targeting: { $ref: '#/$defs/targeting' }
      lifetime_ticks:
        type: integer
        minimum: 0
        description: none 必须为 0；其他载体通常为正整数。
      timing:
        type: object
        additionalProperties: false
        properties:
          start_delay_ticks: { type: integer, minimum: 0, default: 0 }
          active_ticks: { type: integer, minimum: 1 }
      cast:
        type: object
        additionalProperties: false
        properties:
          target_mode: { $ref: '#/$defs/target_mode' }
          windup_ticks: { type: integer, minimum: 0, default: 0 }
          shot_count: { type: integer, minimum: 1, default: 1 }
          shot_interval_ticks: { type: integer, minimum: 0, default: 0 }
          cooldown_seconds: { type: number, minimum: 0 }
          cooldown_start:
            type: string
            enum: [last_actual_shot]
            default: last_actual_shot
          shot_ticks:
            type: array
            items: { type: integer, minimum: 0 }
      emission:
        type: object
        additionalProperties: false
        properties:
          count: { type: integer, minimum: 0, default: 1 }
          shotgun_allowed: { type: boolean, default: false }
      motion:
        type: object
        additionalProperties: false
        properties:
          mode: { $ref: '#/$defs/motion_mode' }
          speed: { type: number, minimum: 0 }
          acceleration: { type: number }
          speed_cap: { type: number, minimum: 0 }
          range: { type: number, exclusiveMinimum: 0 }
          tracking_profile: { $ref: '#/$defs/ref' }
          orbit_radius: { type: number, exclusiveMinimum: 0 }
          angular_speed: { type: number }
          phase: { type: number }
          attach_to_caster: { type: boolean, default: false }
          displacement_profile: { $ref: '#/$defs/ref' }
          bounce_profile: { $ref: '#/$defs/ref' }
          bounce_limit: { type: integer, minimum: 0, default: 0 }
          split_budget: { type: integer, minimum: 0, default: 0 }
          split_count: { type: integer, minimum: 0, default: 0 }
          split_template: { $ref: '#/$defs/ref' }
          chain_remaining: { type: integer, minimum: 0, default: 0 }
          chain_template: { $ref: '#/$defs/ref' }
          search_radius: { type: number, exclusiveMinimum: 0 }
          visited: { type: array, items: { type: string } }
      geometry:
        type: object
        additionalProperties: false
        properties:
          shape: { $ref: '#/$defs/geometry_shape' }
          radius: { type: number, exclusiveMinimum: 0 }
          sector_angle: { type: number, exclusiveMinimum: 0, maximum: 100, default: 25 }
          length: { type: number, exclusiveMinimum: 0 }
          width: { type: number, exclusiveMinimum: 0 }
          wavefront_start_radius: { type: number, minimum: 0, default: 0 }
          wavefront_end_radius: { type: number, exclusiveMinimum: 0 }
          wavefront_speed: { type: number, exclusiveMinimum: 0 }
          area_profile: { $ref: '#/$defs/ref' }
      hit_policy: { $ref: '#/$defs/hit_policy' }
      termination:
        type: object
        additionalProperties: false
        properties:
          possible_reasons:
            type: array
            uniqueItems: true
            minItems: 1
            items: { $ref: '#/$defs/vanish_reason' }
      on_target_lost: { $ref: '#/$defs/on_target_lost', default: continue }
      parts:
        type: array
        items: { $ref: '#/$defs/part' }
      attached:
        type: object
        additionalProperties: false
        properties:
          periodic_tick: { type: integer, minimum: 1 }
          anchor_source: { type: string, enum: [hit_target, caster] }
          immune_flags: { type: array, items: { $ref: '#/$defs/ref' }, default: [] }
      summon:
        type: object
        additionalProperties: false
        properties:
          summon_cap: { type: integer, minimum: 1 }
          summon_profile: { $ref: '#/$defs/ref' }
          owner_source: { type: string, enum: [caster], default: caster }
          bind_owner: { type: boolean, default: true }
      derivations:
        type: array
        items: { $ref: '#/$defs/derivation' }
  derivation:
    type: object
    additionalProperties: false
    required: [event, reasons, child_template, count]
    properties:
      trigger_id: { $ref: '#/$defs/snake_id' }
      event: { $ref: '#/$defs/event' }
      reasons:
        type: array
        items: { $ref: '#/$defs/derivation_reason' }
      child_template: { $ref: '#/$defs/snake_id' }
      count: { type: integer, minimum: 1, default: 1 }
      allow_restricted_reason: { type: boolean, default: false }
  trigger:
    type: object
    additionalProperties: false
    required: [trigger_id, record, condition, action_profile, max_chain_depth]
    properties:
      trigger_id: { $ref: '#/$defs/snake_id' }
      record: { $ref: '#/$defs/record' }
      condition: { $ref: '#/$defs/ref' }
      chance: { type: number, minimum: 0, maximum: 1, default: 1 }
      internal_cooldown_ticks: { type: integer, minimum: 0, default: 0 }
      max_chain_depth: { type: integer, minimum: 0 }
      allow_self_chain: { type: boolean, default: false }
      action_profile: { $ref: '#/$defs/ref' }
      produces: { type: array, items: { $ref: '#/$defs/snake_id' } }
      strength_coeff: { type: number, minimum: 0 }
      zero_cooldown_note: { type: string }
      self_chain_note: { type: string }
  modifier:
    type: object
    additionalProperties: false
    required: [modifier_id, permission, scope, inheritable, targets, stack_rule]
    properties:
      modifier_id: { $ref: '#/$defs/snake_id' }
      permission: { $ref: '#/$defs/permission' }
      scope: { $ref: '#/$defs/scope', default: own_skill }
      inheritable: { type: boolean, default: false }
      targets:
        type: array
        minItems: 1
        uniqueItems: true
        items: { $ref: '#/$defs/ref' }
      stack_rule: { $ref: '#/$defs/modifier_stack_rule' }
      tag_filter: { type: array, uniqueItems: true, items: { $ref: '#/$defs/ref' }, default: [] }
      operation_profile: { $ref: '#/$defs/ref' }
  exposed_field:
    type: object
    additionalProperties: false
    required: [field_path, permissions, live, inheritable]
    properties:
      field_path: { $ref: '#/$defs/ref' }
      permissions:
        type: array
        minItems: 1
        uniqueItems: true
        items: { $ref: '#/$defs/permission' }
      min: { type: number }
      max: { type: number }
      live: { type: boolean, default: false }
      inheritable: { type: boolean, default: false }
      set_conflict_note: { type: string }
  params:
    type: object
    additionalProperties: false
    required: [carrier, lifetime_ticks, templates]
    properties:
      carrier: { $ref: '#/$defs/carrier' }
      lifetime_ticks: { type: integer, minimum: 0 }
      windup_ticks: { type: integer, minimum: 0, default: 0 }
      cooldown_ticks: { type: integer, minimum: 0 }
      shot_ticks: { type: array, items: { type: integer, minimum: 0 } }
      start_delay_ticks: { type: integer, minimum: 0, default: 0 }
      projectile_speed: { type: number, minimum: 0 }
      hit_radius: { type: number, exclusiveMinimum: 0 }
      hit_policy: { $ref: '#/$defs/hit_policy' }
      shotgun_allowed: { type: boolean, default: false }
      on_target_lost: { $ref: '#/$defs/on_target_lost', default: continue }
      attach_to_caster: { type: boolean, default: false }
      bind_owner: { type: boolean, default: true }
      summon_cap: { type: integer, minimum: 1 }
      max_generation: { type: integer, minimum: 0, default: 1 }
      cast_budget: { type: integer, minimum: 0 }
      split_budget: { type: integer, minimum: 0, default: 0 }
      chain_remaining: { type: integer, minimum: 0, default: 0 }
      templates:
        type: array
        minItems: 1
        items: { $ref: '#/$defs/template' }
      parts:
        type: array
        items: { $ref: '#/$defs/part' }
      brick_overrides:
        type: array
        items:
          type: object
          additionalProperties: false
          required: [brick_index, values]
          properties:
            brick_index: { type: integer, minimum: 0 }
            values: { type: object }
      derivations:
        type: array
        items: { $ref: '#/$defs/derivation' }
      triggers:
        type: array
        items: { $ref: '#/$defs/trigger' }
      modifiers:
        type: array
        items: { $ref: '#/$defs/modifier' }
      exposed_fields:
        type: array
        items: { $ref: '#/$defs/exposed_field' }
      passive:
        type: object
        additionalProperties: false
        properties:
          allowed_records: { type: array, items: { $ref: '#/$defs/record' }, default: [] }
          triggers: { type: array, items: { $ref: '#/$defs/trigger' }, default: [] }
          allow_self_chain: { type: boolean, default: false }
      safety:
        type: object
        additionalProperties: false
        properties:
          max_chain_depth: { type: integer, minimum: 0 }
          cast_budget: { type: integer, minimum: 0 }
  fx:
    type: object
    additionalProperties: false
    properties:
      spawn: { type: array, items: { type: object } , default: []}
      tick: { type: array, items: { type: object }, default: [] }
      vanish: { type: array, items: { type: object }, default: [] }
      on_hit: { type: array, items: { type: object }, default: [] }
      on_settled: { type: array, items: { type: object }, default: [] }
      resource_ref: { $ref: '#/$defs/ref' }
      anchor: { type: string, enum: [caster, instance, target, world], default: instance }
      follow_mode: { type: string, enum: [none, position, rotation, full], default: none }
      spawn_count: { type: integer, minimum: 0, default: 1 }
      loop: { type: boolean, default: false }
      duration_ticks: { type: integer, minimum: 0, default: 0 }
      vanish_by_reason: { type: object, additionalProperties: { type: object }, default: {} }
      color_mode: { type: string, enum: [fixed, snapshot, team, status], default: fixed }
      random_seed_stream: { type: string, enum: [presentation], default: presentation }
  sfx:
    type: object
    additionalProperties: false
    required: [max_concurrency]
    properties:
      spawn: { type: array, items: { type: object } }
      tick_loop: { type: object }
      on_hit: { type: array, items: { type: object } }
      on_settled: { type: array, items: { type: object } }
      vanish: { type: object }
      trigger_scope: { type: string, enum: [per_hit, per_target, per_cast, per_tick], default: per_hit }
      priority: { type: integer, minimum: 0, maximum: 100, default: 50 }
      max_concurrency: { type: integer, minimum: 0 }
      concurrency_group: { type: string, minLength: 1, default: skill_id }
      steal_mode: { type: string, enum: [oldest, quietest, lowest_priority, none], default: oldest }
      cooldown_ticks: { type: integer, minimum: 0, default: 0 }
      volume_db: { type: number, minimum: -80, maximum: 24, default: 0 }
      pitch_range: { type: array, minItems: 2, maxItems: 2, items: { type: number, minimum: 0.01, maximum: 4 }, default: [1, 1] }
      bus: { type: string, default: sfx }
  anim:
    type: object
    additionalProperties: false
    properties:
      cast_clip: { $ref: '#/$defs/ref' }
      release_marker: { type: string, minLength: 1, default: release }
      logic_release_tick: { type: integer, minimum: 0, default: 0 }
      release_frame: { type: integer, minimum: 0, default: 0 }
      tick_rate: { type: integer, minimum: 1 }
      frame_policy: { type: string, enum: [marker_locked, time_locked, nearest], default: marker_locked }
      pre_roll_ticks: { type: integer, minimum: 0, default: 0 }
      on_hit: { type: object }
      on_settled: { type: object }
      interrupt_policy: { type: string, enum: [recover_to_idle, crossfade, hold_last], default: recover_to_idle }
      fast_forward_policy: { type: string, enum: [seek_release, clip_end, cancel], default: seek_release }
      blend_ticks: { type: integer, minimum: 0, default: 4 }
      callback_mode: { type: string, enum: [none, presentation_only], default: none }
  trail:
    type: object
    additionalProperties: false
    required: [carrier]
    properties:
      carrier: { type: string, enum: [independent, self, attached, none] }  # 〔2026-10-18 第 3 轮〕按裁决 C04-01 移除 instant；瞬时实例的拖尾用 none + instant_end_policy 表达
      resource_ref: { $ref: '#/$defs/ref' }
      follow_mode: { type: string, enum: [position, rotation, full, none], default: position }
      sample_interval_ticks: { type: integer, minimum: 1, default: 1 }
      max_points: { type: integer, minimum: 0, default: 16 }
      lifetime_ticks: { type: integer, minimum: 0, default: 6 }
      fade_in_ticks: { type: integer, minimum: 0, default: 0 }
      fade_out_ticks: { type: integer, minimum: 0, default: 6 }
      independent_end_policy: { type: string, enum: [fade_then_free, free_on_vanish], default: fade_then_free }
      instant_end_policy: { type: string, enum: [fixed_short_fade, none], default: fixed_short_fade }
      on_hit: { type: object }
      on_settled: { type: object }
      opacity_curve: { type: string, default: linear }
  camera:
    type: object
    additionalProperties: false
    properties:
      enabled: { type: boolean, default: true }
      trigger: { type: string, enum: [spawn, hit, hit_settled, vanish, manual_preview], default: hit }
      shake_amplitude: { type: number, minimum: 0, default: 0 }
      shake_frequency: { type: number, minimum: 0, maximum: 240, default: 20 }
      shake_duration_ticks: { type: integer, minimum: 0, default: 0 }
      zoom_delta: { type: number, minimum: -0.9, maximum: 4, default: 0 }
      zoom_duration_ticks: { type: integer, minimum: 0, default: 0 }
      blend_mode: { type: string, enum: [additive, max, replace], default: additive }
      priority: { type: integer, minimum: 0, maximum: 100, default: 50 }
      logic_effect: { const: none }
  damage_number:
    type: object
    additionalProperties: false
    properties:
      source: { type: string, enum: [hit, hit_settled], default: hit_settled }
      merge_policy: { type: string, enum: [per_hit, per_target_tick, per_cast, none], default: per_hit }
      show_evaded: { type: boolean, default: false }
      show_immune: { type: boolean, default: true }
      show_killed: { type: boolean, default: true }
      pressure_policy: { type: string, enum: [merge_more, drop_visual_only], default: merge_more }
      fallback_total: { type: boolean, const: true, default: true }
      number_style_ref: { $ref: '#/$defs/ref' }
  status_icon:
    type: object
    additionalProperties: false
    properties:
      resource_ref: { type: object }
      source: { type: string, enum: [hit, hit_settled], default: hit_settled }
      type_filter:
        type: array
        items: { type: string, enum: [buff, debuff, control] }
        default: [buff, debuff, control]
      anchor: { type: string, enum: [target, caster, ui_list], default: target }
      stack_mode: { type: string, enum: [count, level, refresh_only, unique], default: count }
      max_visible_stacks: { type: integer, minimum: 1, default: 5 }
      duration_mode: { type: string, enum: [remaining_ticks, refresh_flash, fixed], default: remaining_ticks }
      refresh_style: { $ref: '#/$defs/ref' }
      dispel_style: { $ref: '#/$defs/ref' }
      control_badge: { type: object }
      interrupts_cast_text: { type: string, enum: [hidden, show_badge], default: hidden }
      visibility_filter: { type: string, enum: [owner, target, team, all, owner_and_target], default: owner_and_target }
      expire_fade_ticks: { type: integer, minimum: 0, default: 4 }
  presentation:
    type: object
    additionalProperties: false
    required: [fx, sfx, anim, trail, camera, damage_number, status_icon]
    properties:
      fx: { $ref: '#/$defs/fx' }
      sfx: { $ref: '#/$defs/sfx' }
      anim: { $ref: '#/$defs/anim' }
      trail: { $ref: '#/$defs/trail' }
      camera: { $ref: '#/$defs/camera' }
      damage_number: { $ref: '#/$defs/damage_number' }
      status_icon: { $ref: '#/$defs/status_icon' }
  runtime_hints:
    type: object
    additionalProperties: false
    properties:
      budget_tier: { $ref: '#/$defs/ref' }
      discard_priority: { $ref: '#/$defs/ref' }
      bucket_profile: { $ref: '#/$defs/ref' }
      deterministic: { const: true, default: true }
      rng_stream: { type: string, enum: [logic, presentation], default: logic }
      contract_notes: { type: array, items: { type: string }, default: [] }
  canonical_skill_cfg:
    type: object
    additionalProperties: false
    required: [schema_version, skill_id, meta, bricks, params, presentation, runtime_hints]
    properties:
      schema_version:
        type: string
        const: '0.1'
      skill_id:
        type: string
        pattern: '^[a-z][a-z0-9]*_[a-z][a-z0-9]*_[a-z0-9]+(?:_[a-z0-9]+)*$'
      meta: { $ref: '#/$defs/meta' }
      bricks:
        type: array
        minItems: 1
        items: { $ref: '#/$defs/brick_card' }
      params: { $ref: '#/$defs/params' }
      presentation: { $ref: '#/$defs/presentation' }
      runtime_hints: { $ref: '#/$defs/runtime_hints' }
  appendix_b_contract_summary:
    type: object
    additionalProperties: false
    required: [doc, events, vanish_reasons, purge, carriers, instance_states, instance_fields, origin_fields, hit_policy, hit_payload, vanish_payload, settlement_records, debug_record, defense_semantics, invulnerable_extension, snapshot_layers, snapshot_fields, input_buffer, modifier, card_extra_fields, collision_priority_reference, budget_priority_levels, budget_rule, runtime]
    properties:
      doc: { type: object }
      events:
        type: array
        const: [hit, vanish]
      vanish_reasons: { type: object }
      purge: { type: object }
      carriers:
        type: array
        const: [none, self, independent, attached]
      instance_states:
        type: array
        const: [live, terminating, gone]
      instance_fields:
        type: array
        items: { type: string }
      origin_fields:
        type: array
        const: [origin_skill, origin_cast_id, chain_depth, proc_mask]
      hit_policy: { type: object }
      hit_payload: { type: array }
      vanish_payload: { type: array }
      settlement_records: { type: object }
      debug_record: { type: object }
      defense_semantics: { type: object }
      invulnerable_extension: { type: object }
      snapshot_layers: { type: object }
      snapshot_fields: { type: object }
      input_buffer: { type: object }
      modifier: { type: object }
      card_extra_fields: { type: object }
      collision_priority_reference: { type: array }
      budget_priority_levels: { type: integer, const: 5 }
      budget_rule: { type: object }
      runtime: { type: object }
```

### 1.1 七个顶层键的固定性

规范技能定义的顶层 `additionalProperties: false` 是硬约束。七个键必须同时存在，且不能新增 `doc`、`events`、`debug`、`instances`、`editor_state` 等键。主书稿附录 B 的 `doc` 等键属于契约摘要兼容分支，只能被读取器识别为“摘要”；编辑器不把它写回技能目录。这样同时满足两项边界：技能 CFG 的七键不可变，旧摘要又能被同一 Schema 解析器安全检查。

顶层对象的语义如下：

| 顶层键 | 职责（一句话） | 写入限制 |
|---|---|---|
| `schema_version` | 声明本文件结构和解释规则的版本。 | 当前只能是字符串 `"0.1"`，不写数值 `0.1`。 |
| `skill_id` | 声明跨目录唯一、稳定的技能身份。 | 采用 `<role>_<category>_<name>[_<variant>]`，不含运行时实例编号。 |
| `meta` | 保存归属、显示信息、技能自身修订和设计说明。 | 不放实时战斗状态，不用文档版本覆盖技能版本。 |
| `bricks` | 保存完整的积木登记卡实例，供编辑器展示和默认展开。 | 每项严格十二字段，不增加第十三个卡字段。 |
| `params` | 保存作者对积木默认值的逻辑配置、模板、份和触发关系。 | 只能写可登记参数，不能写结算结果或内部工序。 |
| `presentation` | 保存七段只读逻辑结果的表现映射。 | 不通过回调改变命中、伤害、冷却、目标或 RNG。 |
| `runtime_hints` | 提供预算档位、分桶等已登记非功能提示。 | 不能以提示字段绕过逻辑安全上限或重排运行时顺序。 |

### 1.2 默认值、覆盖与规范化

规范化顺序为：登记卡 `default_cfg` → 通用 `params` → `brick_overrides[]`。对象按叶字段覆盖，数组整体替换；锁字段先检查，冲突必须显式处理。

每个最终叶字段保留来源路径供编辑器诊断；来源表不追加到七键 CFG。`locked_params` 先于覆盖检查，锁死字段被覆盖即拒绝；同一叶字段只能有一个最终权威值。

`default_cfg` 也必须递归通过同一 Schema；目录卡更新不自动改变旧技能，作者确认差异后再递增 `meta.version`。

### 1.3 严格数值和条件校验

类型校验之外还必须检查：身份与载体一致；tick 为有限非负整数；`none` 的寿命和延迟为 0；`amount` 与 `amount_profile` 二选一；原因码不得含 `purge`；派生引用必须存在且先过代数/预算；触发只能读四类结算记录；修饰器目标必须在白名单；七段表现齐全、音效有并发上限、镜头 `logic_effect` 为 `none`。错误必须定位到具体 Schema 路径。

“顺序不可配，数值可配”是安全线：作者可以改速度、半径、寿命、输入量和已登记预算字段，不能用 `order`、`callback`、`script` 或数组排列改写固定结算阶段。

### 1.4 运行时字段与 CFG 字段的边界

CFG 中的 `params.parts[]` 只描述份定义；`evaded`、`final_amount`、`killed` 等属于运行时结果。`instance_id`、`seq`、`parent_ref`、`origin`、`state` 也只在运行时生成，不能由作者伪造。

固定事件只有 `hit` 和 `vanish`；`cast_started`、`hit_settled`、`evaded_all`、`damage_taken` 是记录，`debug_record` 只供调试工具读取。表现不得以记录补发战斗逻辑。

---

## 2. 积木登记卡字段说明

`bricks[]` 的每项必须是冻结约定第一节的十二字段，顺序可以由序列化器规范化，但字段集合不可变。下表给出编辑器和运行时共同采用的语义。

| 字段 | 类型 | 必填 | 默认/范围 | 说明 |
|---|---|---:|---|---|
| `brick_id` | string | 是 | 全局唯一 snake_case | 稳定目录身份，不因中文名变化而改变。 |
| `name` | string | 是 | 非空 | 编辑器和设计文档展示名。 |
| `tagline` | string | 是 | 1–30 字 | 一句话能力摘要，不承载隐藏规则。 |
| `carrier` | enum | 是 | 四类载体 | 必须与卡的默认 CFG 及当前模板相容。 |
| `summary` | string | 是 | 3–5 句为宜 | 说明效果体、命中方式、典型使用边界。 |
| `default_cfg` | object | 是 | 可展开片段 | 默认值真源之一，必须可被 Schema 校验。 |
| `author_params` | array | 是 | 字段路径列表 | 作者可填写的叶字段，必须能解析到 Schema 路径。 |
| `locked_params` | object | 是 | 字段→理由 | 不可修改的结构安全约束；理由不可为空。 |
| `relic_params` | object | 是 | 字段→权限 | 只能使用“可改/可加/禁止”三档。 |
| `presentation` | array | 是 | 七段 key 的子集 | 表示该卡需要哪些表现段，不得写同义词。 |
| `player_text` | array | 是 | 最多三句 | 面向玩家的结果说明，不写内部术语。 |
| `status` | enum | 是 | 已登记/候选/预留 | 候选与预留不能被当作已登记运行能力。 |

积木数量不固定；新增必须补登记卡、默认配置、参数路径、表现引用和验收例子。候选/预留卡不能导出为可运行能力。`locked_params` 是强制锁，`relic_params` 只能使用三档权限，`presentation` 只是引用集合。

---

## 3. `params` 参数组织与冻结枚举

### 3.1 通用技能参数

`params` 同时容纳顶层通用参数和可组合模板。通用字段用于编辑器快速表单，`templates[]` 用于表达一个技能内的一个或多个效果体配方。两种写法如果描述同一语义，规范化器必须选择一个权威落点并报告冲突；不能让保存器写 `params.projectile_speed` 而运行时读取另一个未登记路径。

| 路径 | 类型 | 默认/范围 | 条件 |
|---|---|---|---|
| `params.carrier` | enum | `none/self/independent/attached` | 必填；与模板和卡一致。 |
| `params.lifetime_ticks` | int | `>=0` | `none` 固定 0，其余通常为正数。 |
| `params.windup_ticks` | int | `0..` | 前摇，不等同于效果体寿命。 |
| `params.cooldown_ticks` | int | `0..` | 运行时冷却；冷却不属于效果体。 |
| `params.shot_ticks[]` | int[] | `0..` | 相对闭环出手时间；不把齐发误计为多次出手。 |
| `params.start_delay_ticks` | int | 默认 0 | 效果体可存活但尚不判定；延迟不是事件。 |
| `params.hit_policy` | object | 见 `hit_policy` | 逐实例约束；不跨实例合并。 |
| `params.max_generation` | int | 推荐默认 1 | 派生代数安全上限，修饰器不得改。 |
| `params.cast_budget` | int | `>=0` | 逻辑生成安全预算，不是性能验收指标。 |
| `params.split_budget` | int | 默认 0 | 传给裂变能力的额度；子体不得重置。 |
| `params.chain_remaining` | int | 默认 0 | 连锁剩余额度，不是 `max_generation`。 |

冻结事件、原因码和载体枚举不得由技能作者扩展。`derivations[].event` 只能是 `hit` 或 `vanish`；`vanish` 的原因只能是 `hit_end`、`range_end`、`landed`、`expired`、`returned`、`interrupted`、`instant_end`。`purge` 不是 `vanish_reason`，清场、预算丢弃、场景卸载和阵亡清理都不发 vanish，也不产生派生。

### 3.2 模板与份

一个模板至少有 `template_id`、`carrier`、`targeting`、`lifetime_ticks`、`parts`。模板可以是无份的纯表现效果体，但有判定意义的模板必须有至少一份结算份。`targeting.target_group` 只取 `enemy`、`ally`、`point`；`friendly_fire` 和 `include_self` 必须显式表达，不能从技能名称推断。

`parts[]` 的 `type` 是已登记份类型。伤害、治疗、护盾、增益、减益、击退和控制共享 hit 模型，但防御语义不同：无敌只使伤害份视为闪避，有益份照常生效，有害非伤害份按目标免疫标记处理；某类型免疫把该份最终值减为 0，但 hit 仍成立。作者不能在 Schema 中添加一个“无敌时整技能关闭”的隐式开关来改写冻结语义。

`amount` 和 `amount_profile` 二选一。`amount` 是有限非负输入；`amount_profile` 是已登记公式引用。`final_amount`、`evaded`、`killed`、`any_reduced_to_zero` 属于运行时结果，不得写入 `params.parts[]`。控制份的 `duration_ticks`、`control_type`、`interrupts_cast` 由登记表约束；“眩晕暂停前摇”和“击退打断前摇”不是同一布尔语义，不能为了省字段合并。

### 3.3 派生与被动触发

`params.derivations[]` 只能使用 `hit`/`vanish`，并引用当前技能的 `child_template`；`vanish` 派生必须列出合法原因码，`purge` 永远不是原因码。`params.triggers[]` 只能读取 `cast_started`、`hit_settled`、`evaded_all`、`damage_taken`，不得订阅 `debug_record`，也不得绕过结算直接扣血。`allow_self_chain` 默认 false，`max_chain_depth` 和预算在创建前检查。

`generation` 只数派生，根为 0；`chain_depth` 同时计派生与被动触发。派生子体默认从 `spawn_tick+1` 起接触；出手阶段创建的瞬时实例可在同 tick 接触。

### 3.4 修饰器与暴露字段

`params.modifiers[]` 必须包含 `modifier_id`、`permission`、`scope`、`inheritable`、`targets`、`stack_rule` 六个核心字段；`scope=tagged` 必须有非空 `tag_filter`。三档权限分别是：`mutate_number` 只能改已暴露数值，`add_behavior` 只能接已登记行为，`mutate_live_instance` 只对明确批准的 live 字段生效，默认关闭。数值合并顺序固定为 `set → add → mul → clamp`，不由配置重排。

`exposed_fields[]` 是字段白名单；每个 `targets[]` 都必须指向白名单路径。`max_chain_depth`、`allow_self_chain`、`origin`、`visited`、`instance_id`、`seq` 不得暴露给修饰器。

---

## 4. `presentation` 七段契约

七段 key 固定为 `fx`、`sfx`、`anim`、`trail`、`camera`、`damage_number`、`status_icon`，不可合并成一个自由文本字段。未配置的细项使用表现默认，不改变逻辑默认。表现层只能读 `hit`、`hit_settled` 及冻结的映射结果；不能监听 `debug_record`，不能由动画回调创建效果体，不能把声音并发上限当成命中上限。

### 4.1 七段字段速览

| 段 | 必须表达的硬指标 | 本版关键字段 |
|---|---|---|
| `fx` | 能挂到 spawn/tick/vanish，并可读 hit/settled。 | `spawn`、`tick`、`vanish`、`on_hit`、`on_settled`、`vanish_by_reason`。 |
| `sfx` | 必须有触发时点、优先级和并发上限。 | `trigger_scope`、`priority`、`max_concurrency`、`concurrency_group`。 |
| `anim` | 必须对齐逻辑出手 tick 与动画帧。 | `logic_release_tick`、`release_frame`、`release_marker`。 |
| `trail` | 必须区分 independent 与 instant。 | `carrier`、`independent_end_policy`、`instant_end_policy`。 |
| `camera` | 必须显式不影响逻辑。 | `logic_effect: none`。 |
| `damage_number` | 必须服从 hit/settled 合并规则。 | `source`、`merge_policy`、`fallback_total: true`。 |
| `status_icon` | 必须对齐 buff/debuff/control 与堆叠显示。 | `type_filter`、`stack_mode`、`duration_mode`。 |

`fx.vanish_by_reason` 只接受自然原因码；`fx.on_hit` 一条 hit 默认一次；`sfx.max_concurrency` 只控制声音表现。`anim.logic_release_tick` 与 `release_frame` 完成对齐但动画不决定出手；拖尾不碰撞，瞬时载体只能短淡出。`damage_number.fallback_total` 必须为 true；图标和镜头均不得回写逻辑。

### 4.2 表现与运行时的读写方向

表现可读取 `hit` 的成立信息、`hit_settled` 的合计与份类型、`vanish` 的自然原因；不得读取 `debug_record`，不得重新判定、补发 hit、修改金额或改变目标顺序。关闭表现段、丢弃纯表现、合并数字和抢占声音都必须保持逻辑结果不变。

---

## 5. `runtime_hints` 的使用边界

`runtime_hints` 只引用项目层已登记的预算档位、分桶建议和确定性提示。`budget_tier`、`discard_priority`、`bucket_profile` 不在技能中定义优先级算法，也不能取消根判定实例保护。超预算按 `purge` 处理，不发 vanish、不派生，必要时只写 `debug_record{kind: budget_drop}`。本书不在技能 CFG 中定义帧率、同屏实例数、子弹数等项目性能验收指标；具体项目基线由项目层文件给出。

---

## 6. 版本策略、保存事务与旧档迁移

### 6.1 三种版本不要混淆

`schema_version`（当前 `"0.1"`）只表示文件结构；`meta.version`（如 `"0.1.0"`）表示技能内容修订；本文标题版本只表示说明文档。数值、积木组合、表现或触发改变只递增 `meta.version`；字段结构、枚举解释或读取方式改变才升级 Schema，并登记迁移边。

### 6.2 保存事务

保存顺序固定为：身份与依赖检查 → 展开默认和覆盖 → 类型/范围/语义校验 → 内容指纹冲突检查 → 原子提交 → 重读比对。任一步失败，旧文件保持可加载；保存、另存、导出和批量保存不得绕过同一校验入口。

### 6.3 迁移矩阵

| 输入状态 | 处理 |
|---|---|
| 当前 `0.1` | 正常编辑，完整校验后保存。 |
| 已知旧版且链完整 | 只读预览路径、旧值、新值和理由，确认后逐边迁移。 |
| 缺迁移边、未来版、缺版本 | 只读，禁止改版本字符串或降级覆盖。 |
| 类型合法但语义冲突 | 并列差异，阻止认证和提交。 |

每条迁移边必须声明前置、字段变换、默认补入、丢失信息和行为影响；涉及载体、单位、输入缓冲或派生时序时必须重跑契约测试。迁移应幂等，不得重置权限、扩大标签、把未知事件改成 `hit` 或截断非法时间。技能身份保持不变，来源写入 `meta.design_notes` 或迁移报告，不增加第八个顶层键。

### 6.4 目录卡更新

目录卡更新不自动改变旧技能的 `default_cfg`。作者确认差异后再加入新卡或新默认，并递增 `meta.version`；载体、权限或终止语义变化还必须重跑相关契约测试。

---

## 7. 主书稿附录 B 的兼容与自检结论

### 7.1 为什么附录 B 不直接改造成七键技能

附录 B 是整套运行时契约摘要，不是单个技能定义，不能改名后塞入 `runtime_hints`。根部 `oneOf` 注册了只读 `appendix_b_contract_summary` 分支，因此解析器可检查它，保存器则必须提示“契约摘要，不是技能定义”并拒绝写入；canonical 分支仍严格七键。

### 7.2 逐项比对结果

以下结论针对主书稿附录 B（主书稿 3867–4011 行的 YAML 块），不是针对任意相似 YAML。

| 附录 B 项 | Schema 兼容分支 | 比对结论 |
|---|---|---|
| `doc` | `appendix_b_contract_summary.doc` | **通过**：接受对象，且不把文档版本当 `schema_version`。 |
| `events: [hit, vanish]` | `events.const` | **通过**：顺序和值均固定，不允许第三事件。 |
| `vanish_reasons` 七项 | `vanish_reasons` object | **通过**：逐项保留 `derive_allowed/default_false/only_for` 等信息；原因语义由运行时契约解释。 |
| `purge` | `purge` object | **通过**：保留不发 vanish、不派生、不是原因码。 |
| `carriers` | `carriers.const` | **通过**：精确接受 `[none, self, independent, attached]`。 |
| `instance_states` | `instance_states.const` | **通过**：精确接受 `[live, terminating, gone]`。 |
| `instance_fields` | string array | **通过**：允许附录列出的 14 个实例字段，不把它们写入技能定义。 |
| `origin_fields` | `origin_fields.const` | **通过**：四个来源字段一致。 |
| `hit_policy` | object | **通过**：保留默认、候选接触计数和成功 hit 计数说明。 |
| `hit_payload` / `vanish_payload` | array | **通过**：作为载荷词表只读，结果不会进入 `params.parts`。 |
| `settlement_records` | object | **通过**：接受四类结算记录及 `parts[]{part_index,type}` 记法。 |
| `debug_record` | object | **通过**：接受不可订阅、不可正式 UI 读取及三类 kind。 |
| `defense_semantics` | object | **通过**：保留无敌、免疫、全闪避的冻结摘要。 |
| `invulnerable_extension` | object | **通过**：保留 D-90 扩展，不生成技能级绕过开关。 |
| `snapshot_layers` / `snapshot_fields` | object | **通过**：保留 L0–L3 和字段观察器词表。 |
| `input_buffer` | object | **通过**：接受建议窗口和执行/丢弃语义，不把它变成技能自由参数。 |
| `modifier` | object | **通过**：接受三权限、作用域、继承和固定数值顺序。 |
| `card_extra_fields` | object | **通过**：接受 `shotgun_allowed`、`on_target_lost`、召唤/触发安全字段。 |
| `collision_priority_reference` | array | **通过**：接受 `[split, pierce, fork, chain, return]` 参考顺序，但不开放重排。 |
| `budget_priority_levels: 5` | const 5 | **通过**：精确接受五级预算档位。 |
| `budget_rule` | object | **通过**：保留不挤根判定、purge 和 debug_record 规则。 |
| `runtime` | object | **通过**：接受 fixed、injectable_seeded、false netplay、determinism 和 tick_order。 |

**自检结论：**附录 B YAML 作为 `appendix_b_contract_summary` 的合法实例逐项通过；其键、枚举、数组常量和对象结构均有对应 Schema 节点。它被识别为只读契约摘要，不能作为 canonical 七键技能保存。canonical 技能 CFG 的七个固定顶层键、十二字段积木卡和七段表现配置也分别有 `required`、`additionalProperties: false` 与枚举约束。上述结论不声称运行时已经实现所有字段；它只证明 Schema 对冻结接口的结构承载和兼容解析范围。

---

## 8. 扩展规则

### 8.1 新增积木

新增积木只新增十二字段登记卡，不改变七键和旧卡字段；必须补 `default_cfg`、参数路径、表现引用、权限边界和验收例子。旧技能不会自动吸收新卡。若需要第五类载体、第三事件、自由脚本或新结算阶段，必须升 Schema 版本并登记迁移链；`0.1` 中只能标为候选/预留。

### 8.2 新增参数

新增参数只能是已登记对象的新叶字段，必须登记类型、默认、范围、单位、必填级别和完整路径；同一语义只能有一个 canonical 路径。可被水晶/遗物修改的字段还须进入 `exposed_fields`，不得开放代数、来源链、事件集合或结算顺序。

### 8.3 新增表现段

七段是冻结接口；新视觉能力应先归入现有段，确实不能归类才升 Schema 版本。表现始终只读逻辑结果，不得增加 hit、改伤害/冷却/目标或消耗逻辑 RNG；未知段不能静默丢弃后宣称兼容。

### 8.4 向后兼容原则

保持旧字段含义、技能身份和迁移幂等优先于自动修复。允许去重标签、排序键等无语义修复；不自动改载体、权限、预算、单位、事件或删除无法解释的字段。

---

## 9. 字段名 → Schema 路径速查表

下表覆盖编辑器最常用字段和运行时交接字段；完整机器路径以第 1 节代码块为准。路径中的 `i` 表示数组索引，`*` 表示已登记的动态键，不代表可以随意增加未经登记的结构。

| 字段名 | Schema 路径 | 类型/备注 |
|---|---|---|
| `schema_version` | `schema_version` | string，固定 `0.1` |
| `skill_id` | `skill_id` | 稳定技能身份 |
| `role` | `meta.role` | 角色标识 |
| `category` | `meta.category` | active/passive/crystal/relic |
| `name` | `meta.name` / `bricks[i].name` | 显示名，按上下文区分 |
| `version` | `meta.version` | 技能内容三段版本 |
| `tags` | `meta.tags[]` | 去重标签 |
| `brick_id` | `bricks[i].brick_id` | 卡身份 |
| `tagline` | `bricks[i].tagline` | 不超过 30 字 |
| `carrier` | `bricks[i].carrier` / `params.carrier` / `params.templates[i].carrier` | 四类冻结枚举 |
| `default_cfg` | `bricks[i].default_cfg` | 默认 CFG 片段 |
| `author_params` | `bricks[i].author_params[]` | 作者可填路径 |
| `locked_params` | `bricks[i].locked_params.*` | 字段与锁死理由 |
| `relic_params` | `bricks[i].relic_params.*` | 三档权限声明 |
| `brick_status` | `bricks[i].status` | 已登记/候选/预留 |
| `template_id` | `params.templates[i].template_id` | 当前技能内唯一 |
| `target_group` | `params.templates[i].targeting.target_group` | enemy/ally/point |
| `windup_ticks` | `params.windup_ticks` / `params.templates[i].cast.windup_ticks` | 非负 tick |
| `shot_count` | `params.templates[i].cast.shot_count` | 出手次数 |
| `cooldown_ticks` | `params.cooldown_ticks` | 运行时冷却 |
| `shot_ticks` | `params.shot_ticks` / `params.templates[i].cast.shot_ticks` | 时间表 |
| `count` | `params.templates[i].emission.count` / `params.derivations[i].count` | 实例/派生数量 |
| `lifetime_ticks` | `params.lifetime_ticks` / `params.templates[i].lifetime_ticks` | none 固定 0 |
| `hit_policy` | `params.hit_policy` / `params.templates[i].hit_policy` | 接触与 hit 计数 |
| `motion.mode` | `params.templates[i].motion.mode` | 已登记运动 |
| `motion.speed` | `params.templates[i].motion.speed` | 每 tick 像素 |
| `motion.range` | `params.templates[i].motion.range` | 正实数 |
| `geometry.shape` | `params.templates[i].geometry.shape` | 四种形状 |
| `geometry.radius` | `params.templates[i].geometry.radius` | 逻辑半径 |
| `parts` | `params.parts[]` / `params.templates[i].parts[]` | 份定义，不是结果 |
| `part_index/type/amount` | `params.templates[i].parts[j].*` | 份定义字段 |
| `duration_ticks` | `params.templates[i].parts[j].duration_ticks` | 状态寿命 |
| `event/reasons` | `params.derivations[i].event/reasons` | 事件与原因码 |
| `child_template` | `params.derivations[i].child_template` | 模板引用 |
| `trigger_id/record` | `params.triggers[i].trigger_id/record` | 触发记录白名单 |
| `max_chain_depth` | `params.triggers[i].max_chain_depth` | 安全上限 |
| `modifier_id/permission/scope` | `params.modifiers[i].*` | 三档修饰器接口 |
| `targets/field_path/live` | `params.modifiers[i].targets[]` / `params.exposed_fields[i].*` | 白名单与实时性 |
| `fx.spawn` | `presentation.fx.spawn[]` | 生成表现 |
| `sfx.max_concurrency` | `presentation.sfx.max_concurrency` | 必填 |
| `anim.logic_release_tick/release_frame` | `presentation.anim.*` | 出手对齐 |
| `trail.carrier` | `presentation.trail.carrier` | 区分载体 |
| `camera.logic_effect` | `presentation.camera.logic_effect` | 固定 none |
| `damage_number.fallback_total` | `presentation.damage_number.fallback_total` | 必须 true |
| `status_icon.type_filter` | `presentation.status_icon.type_filter[]` | 份类型过滤 |
| `budget_tier/bucket_profile` | `runtime_hints.*` | 项目层引用 |

---

---

## 与运行时契约的引用关系

| 本 Schema 条款 | 主书稿章节／决策号 | 引用关系 |
|---|---|---|
| 七个顶层键 | `_shared/10_冻结接口约定.md` 第七节；第16章 16.1 | 冻结存档形状，canonical 分支严格七键。 |
| 十二字段积木登记卡 | `_shared/10_冻结接口约定.md` 第一节；第4章 | `bricks[i]` 不增不减字段。 |
| 参数类型、范围和路径 | 第5章《积木参数表》 | 表单、校验器、序列化器和加载器共用路径。 |
| 四类载体 | 铁律四；附录 B `carriers`；第36.4 | 采用 `none/self/independent/attached`，不静默接受 `instant`。 |
| 两个事件 | 第36.2；附录 B `events` | 仅 `hit`、`vanish`，其余为记录或内部阶段。 |
| 七种 vanish 原因 | 第36.3；附录 B `vanish_reasons` | `purge` 不属于原因码，不发 vanish。 |
| instance 字段边界 | `_shared/03_字段与冻结接口.md` 5.4；第36.4 | 运行态字段不回写技能定义。 |
| hit_policy | 第14章、第36.4、附录 B | 候选接触与成立 hit 的计次分离。 |
| 份和防御语义 | 第11章、22章、D-05、D-90、D-104 | 伤害/有益/有害非伤害按冻结规则处理。 |
| 派生和时序 | 第14章、第20章、第36.7、D-17a/D-33 | `generation`、`chain_depth`、下一 tick 接触规则。 |
| 结算记录和触发 | 第21章、第36.5、D-54/D-57 | 触发读取记录，不能订阅 debug 或绕过结算。 |
| 修饰器三权限 | 第17章、第36.6、D-40/D-42/D-43 | 白名单、作用域、继承和 set→add→mul→clamp。 |
| 快照分层 | 附录 B `snapshot_layers`、D-92 | L0–L2 入快照，L3 修改技能字段。 |
| 七段表现 | 第9–10章、冻结接口第三节、铁律八 | 只读 hit/hit_settled，不反向影响逻辑。 |
| 预算与清理 | 第15章、附录 B `budget_rule`、D-38/D-39 | 技能只引用项目策略，不定义性能验收数值。 |
| 保存与迁移 | 第16章 16.5–16.7 | 原子提交、差异预览、逐边迁移、失败保护。 |
| 确定性 | D-09、附录 B `runtime` | 固定步长、可注入种子 RNG；表现 RNG 分离。 |

## 未决问题

1. `_shared/10_冻结接口约定.md` 的积木登记卡载体示例写过 `instant`，而冻结词表和附录 B 使用 `none` 表示瞬时载体。本 Schema 按主书稿第36章、附录 B 和 `_shared/03_字段与冻结接口.md` 采用 `none`；旧 `instant` 只允许在明确导入适配器中候选映射，不能静默转换。
2. 附录 B 的 `same_tick_spawn_hits_next_tick` 是摘要级布尔表达，无法单独表达“出手创建的瞬时实例同 tick、派生实例下一 tick”的细分规则。本 Schema 按第14章和第36.7采用细分规则；兼容摘要只读保留原布尔值。
3. `params.templates[]` 与部分材料中的通用路径并存，最终实现应以本 Schema 路径为唯一规范，并在编辑器中提供来源路径表；不能让两个路径同时成为运行时真源。
4. `scope=tagged` 使用 `meta.tags[]` 作为匹配集合是〔推荐默认〕，若未来需要一个物品内多组不同标签，应新增登记结构或 Schema 版本，不得偷偷扩展冻结六字段。
5. `status_icon.resource_ref` 与部分表现登记表允许的 map 形态需要在资源目录规范中继续收口；本版保留 object 以承载 `buff/debuff/control` 映射，但不允许自由脚本。
6. 具体 `budget_tier`、`bucket_profile`、`discard_priority` 的项目层目录不在本文件范围；本文件只规定引用、只读和不改变逻辑语义。
7. 本版没有把任意伤害类型、状态 profile、追踪 profile 的目录全集硬编码进 Schema；它们必须由项目登记表提供并在保存时做引用存在性检查，避免 Schema 与目录重复漂移。

DONE::SCHEMA::约11200字
