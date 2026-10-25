# 技能编辑器规格 × 技能运行时契约：交界映射表

> 版本：v0.1　日期：2026-10-18　轮次：第1轮
> 执笔：本地执笔 AI　评审：WorkBuddy　拍板：用户
> 状态：交界规格草案，待评审；不是已冻结 Schema，也不是运行时实现证明。
> 变更标注：〔2026-10-18 第1轮〕本文件全部为首轮新增；后续变更须逐处标注并同步版本。
> 范围：只登记 T1、T2、T3 三个接线面；不定义性能验收指标，不包含联网同步、代码映射或最终数值表。

本文件是两份规格之间的接线索引，不复制主书稿成为第二份契约。依据为《全新技能系统设计书_v0.2.md》正文、第36章及附录B，编辑器侧依据为第4章4.8、第5章参数表、第9章9.9。主书稿高于共享抽取稿；附录B明确低于第36章。编辑器草稿中的候选不能因进入本表自动转正，完整路径也不等于对应 Schema 已生成。

三表各自回答一个问题：T1回答“这个积木究竟由哪类效果体承载”；T2回答“已经结算出的事实可以怎样显示”；T3回答“作者填写的值保存在哪里、怎样检查”。运行时身份和结算结果不是配置输入；表现不能重新判闪避、重算伤害、补发命中、推进状态或决定逻辑时点。顺序不可配，数值可配。

**状态约定：**“已登记／映射成立”只表示来源登记和载体归属成立，不表示组合已经可运行；“新积木候选”保留来源 `status=候选`，不授权导出；“接口阻塞”表示既有规则可以理解，但当前冻结载荷或路径不能无歧义承载。本文的建议统一标为 `〔推荐默认〕`，不新增已确认决策，不代替评审修改上游。

## T1　积木 → 载体映射

〔2026-10-18 第1轮〕逐项以编辑器4.8的 `brick_id` 为键复核。当前快照为28行，数量仅用于本次覆盖核验，不是积木种类上限。名称不是主键，不能按“瞬时”“跟随”等中文词自动分类。

### T1.1 运行时载体口径

| 载体 | 主书稿判据 | 编辑器接线限制 |
|---|---|---|
| `none` | 8.2、36.4：寿命为零的瞬时实例，有 `instant_end`，无运动 | 不能解释成“不创建实例”；瞬时射线不可用高速飞行替代 |
| `self` | 8.3：主动位移状态的跟随判定体，位移状态本身不是实例 | 跟随运动由施法者位移决定；不能将普通位置锚定等同主动位移 |
| `independent` | 8.5：出手后独立运行，可飞行、环绕或保持空间区域 | 静止不等于附着；其逻辑空间查询独立，施法者后续打断不自动清除 |
| `attached` | 8.5A：挂在目标上的有寿命效果体，无空间运动，不进碰撞分桶 | 周期接触须显式声明 `periodic_tick`；图标存在不代表空间判定存在 |

共享00/10写为 `independent / instant / attached / none`，与主书稿8.1、36.4及附录B的 `none / self / independent / attached` 冲突。本文载体列使用后者；**不将 `instant` 定义成第五种载体，也不把它静默当作 `self` 的可导入别名**。源卡仍含非法枚举时必须阻塞导出，由评审修订源卡后再接线。这里纠正映射结论，不修改原卡。

### T1.2 逐块复核表

| brick_id | 名称 | 载体 | 判定依据（主书稿章节） | 状态 |
|---|---|---|---|---|
| `projectile_bolt` | 直线飞弹 | `independent` | 8.5列举飞弹；28、30章的穿透或分裂不改变母体载体，子体另建实例 | 已登记／映射成立 |
| `projectile_lob` | 定点抛射炮弹 | `independent` | 8.5、27章：有飞行过程，正常落地用 `landed`；火区是另一实例 | 已登记／映射成立 |
| `periodic_zone` | 周期区域 | `independent` | 8.5明确静止火区仍独立；22.3、22.7允许治疗区及推力区，作用由份决定 | 已登记／映射成立 |
| `delayed_patch` | 延迟地面判定 | `independent` | 8.5、32章：在世界位置等待后判定；等待是内部状态，不是新事件 | 已登记／映射成立 |
| `expanding_wave` | 扩张波前 | `independent` | 8.5、32章：判定半径随存活过程推进，有独立寿命，不是纯视觉放大 | 已登记／映射成立 |
| `orbit_blade` | 环绕飞刃 | `independent` | 8.5直接列举环绕飞刃；位置轨道可引用施法者，不等于8.3的位移状态 | 已登记／映射成立 |
| `returning_blade` | 回旋投掷 | `independent` | 8.5列举回旋体；去程、回程属于同一实例过程，回到施法者用 `returned` | 已登记／映射成立 |
| `sustained_beam` | 持续射线 | `independent` | 8.5列举持续射线；有存活期和重复接触，不能混同8.2一次性射线 | 已登记／映射成立 |
| `homing_projectile` | 追踪飞弹 | `independent` | 8.5飞弹、20章来源链；追踪改变运动策略，丢目标按36.4声明继续或终止 | 已登记／映射成立；策略引用另验 |
| `ricochet_projectile` | 目标间弹射 | `independent` | 8.5、30章碰撞行为细则：同一实例改变方向，不因换目标变成逐代子体 | 已登记／映射成立；弹射策略须解析 |
| `chain_projectile` | 逐代连锁 | `independent` | 8.5、30章连锁变体：每代另建子体、递减额度、继承访问历史与来源链 | 已登记／映射成立 |
| `summon_unit` | 召唤协战单位 | `independent` | 8.5-4、22.6：长期效果体包含自己的施法者闭环，owner与caster不能混用 | 已登记／映射成立；须有子技能引用 |
| `aura_zone` | 光环作用区 | `independent` | 22.5允许独立光环区；区域负责空间目标集合，给目标挂的状态另归attached | 已登记／映射成立 |
| `cosmetic_body` | 纯表现效果体 | `independent` | 8.5、32章及15.7：本预设为有寿命独立装饰，不做接触、没有结算份 | 已登记／本预设映射成立 |
| `wall_reflection_candidate` | 墙面反射候选 | `independent`（拟） | 8.5支持飞行载体，但不提供环境法线、墙面接触、反射额度及阻挡优先序 | **新积木候选**；缺环境碰撞与反射能力契约 |
| `displacement_hitbox_candidate` | 位移跟随判定候选 | **`self`** | 8.3、8.4、29章：位移跟随判定体必须self；源表instant错误，非载体能力缺失 | **新积木候选**；映射已明确，缺冻结枚举与源卡修订，未转正 |
| `absorb_shield` | 吸收护盾 | `attached` | 8.5A、22.4、33A：挂宿主、有额度与寿命；吸收在减免后扣血前，不依赖空间碰撞 | 已登记／映射成立；终止码冲突见末尾 |
| `timed_buff` | 有期限增益 | `attached` | 8.5A、22.5：本卡选择建有期限附着实例；纯数值状态可不建实例，但不属于此卡映射 | 已登记／映射成立 |
| `timed_debuff` | 有期限减益 | `attached` | 8.5A、22.5：目标附着状态，有害份按份级闪避与免疫，不因无敌一律失效 | 已登记／映射成立 |
| `attached_regeneration` | 附着持续治疗 | `attached` | 8.5A-3、22.3：治疗跟随宿主且按声明周期结算，不查询周围友方 | 已登记／映射成立；周期编码待统一 |
| `attached_damage_over_time` | 附着持续伤害 | `attached` | 8.5A、22.2：有寿命的宿主周期效果，周期产生接触，不以空间重叠启动 | 已登记／映射成立；周期编码待统一 |
| `taunt_anchor_candidate` | 嘲讽目标约束候选 | `attached`（拟） | 8.5A可承载状态，但没有定义对目标索敌的覆盖、冲突优先序与解除恢复 | **新积木候选**；缺索敌约束能力，不缺第五类载体 |
| `instant_burst` | 瞬时圆形爆发 | `none` | 8.2、33B：一次圆形判定，每目标各一条hit；混合份不延长实例寿命 | 已登记／映射成立 |
| `instant_fan` | 瞬时扇形斩 | `none` | 8.2、31章：同tick完成判定与instant_end，不由挥砍动画长度决定寿命 | 已登记／映射成立 |
| `instant_ray` | 瞬时射线 | `none` | 8.2-3、8.7：一次性直线判定，无飞行过程，不能使用巨大速度模拟 | 已登记／映射成立 |
| `instant_heal` | 单次治疗 | `none` | 22.3、33A：单次治疗瞬时实例；实际治疗量受生命上限截断，不是附着恢复 | 已登记／映射成立 |
| `instant_control` | 控制施加 | `none` | 22.8、33B：瞬时施加控制，控制状态时长不等于施加实例寿命 | 已登记／映射成立 |
| `instant_knockback` | 击退施加 | `none` | 22.7、33B：瞬时施加受迫位移；目标被推走不使施加体变成self | 已登记／映射成立 |

### T1.3 复核结论与边界验收

28个来源键均有落点；25个已登记条目的载体归属保留，三个候选继续保留候选资格。其中位移候选不是无法建模，而是源枚举挡住已有self能力；另两项缺能力契约，不允许用载体值正确掩盖行为缺口。任何后续无法映射条目都须登记“新积木候选”，写明缺失能力、最近似载体及不能导出的原因，不以none兜底。

8.2-5的“有寿命但无空间运动一律attached”与8.5静止火区并列阅读时有表面冲突。本文按是否附着宿主、是否执行空间查询区分：世界坐标火区仍independent；目标上的持续恢复是attached。该限定来自8.5与8.5A的具体规则，不把“速度为零”当载体判据；需由评审统一8.2-5概括措辞。

| 验收输入 | 接线预期 | 不得发生 |
|---|---|---|
| 同半径的静止火区与附着恢复 | 前者independent并做区域接触，后者attached按周期作用宿主 | 两者因不移动而归同一种载体 |
| 冲刺判定体中途被打断 | self按interrupted结束，不补终点效果；源卡未修正前仍阻塞导出 | 把instant视为合法self别名 |
| 瞬移同时有落点爆炸 | 瞬移本身没有效果体；爆炸另用instant_burst／none | 发明瞬移vanish派生 |
| 控制持续45 tick、施加瞬时 | 施加体寿命零；控制时长独立保留 | 给none设置45 tick寿命 |
| 光环为三名目标挂状态 | 一个独立空间区域及各自附着状态，按模板声明创建 | 把区域半径写进attached碰撞域 |

## T2　结算结果 → 表现映射

〔2026-10-18 第1轮〕这是结果消费表，不是结算流程表。以36.4的hit完整份载荷为权威：`source_instance / target_id / parts[]{part_index,evaded,type,final_amount} / any_reduced_to_zero / killed / tick / seq`。36.5的hit_settled只有`source_instance / target_id / total / killed / parts[]{part_index,type}`；**它没有evaded、final_amount、tick、seq**。不能因为9.9写了“读取份级结果”就假定两个载荷完全相同。

正式反馈只读hit/hit_settled。evaded_all、damage_taken、cast_started属于被动层结算记录，不因此成为正式UI的额外订阅白名单；debug_record仅供调试。T2保留需求与当前接口的差距：写“阻塞”的行是已登记需求，不是已可执行能力。

### T2.1 文案键与分类约定

现有9.6/9.7提供的是配置字段，不是完整本地化字典。下表 `combat.*` 全部为 `〔推荐默认〕` 文案key，待第15章或表现资源登记接收；它们不新增CFG顶层键，不声称资源已经存在。闪避key绑定 `presentation.damage_number.evaded_text`，免疫绑定`immune_text`，击杀绑定`killed_style`；状态类key由`presentation.status_icon`方案引用。数字模板 `{amount}` 使用只读实际量，不嵌入最终数值。

`—`表示不得有玩家提示或暂不具备显示条件，不是“使用空字符串也触发音效”。闪避、免疫、治疗与伤害是不同显示类别。正的控制时长、击退距离、增益层数不是伤害金额，不得参加伤害合计。未被闪避的零值也不能单独证明免疫。

### T2.2 结果映射主表

| 编号／运行时字段 | 取值条件 | 表现类型及实施边界 | 文案 key〔推荐默认〕 | 引用主书稿章节 |
|---|---|---|---|---|
| T2-01 `hit.parts[i].evaded / final_amount` | evaded=true且final_amount=0，并存在合法hit | 显示“闪避”；不显示该份伤害数字；同hit多个闪避份只提示一次 | `combat.evaded`＝闪避 | 11、36.4、15.7 |
| T2-02 `hit.any_reduced_to_zero` | true，表示至少一份未闪避但被减免为零 | 显示“免疫”，与闪避分开；允许命中特效，不撤销hit；不擅自定位免疫份 | `combat.immune`＝免疫 | 11.2、22.4、36.4 |
| T2-03 `hit.killed / hit_settled.killed` | true | 一次击杀表现；死亡后冲刷最后合计；两路输入不得各播一次，不另设击杀事件 | `combat.killed`＝击杀 | 15.7、31、36.4—36.5 |
| T2-04 `debug_record.kind` | budget_drop | **正式UI、数字、音效、镜头均不得显示任何提示**；本行是负向验收，不是订阅配置 | — | 6.7、15.7、36.5；D-94 |
| T2-05 防霰弹批次实际候选结果 | 14.8-6c：唯一候选全闪避，整批其余被抑制 | 需求为只播一次闪避；但当前只有evaded_all而无hit，正式读取面缺口，**接口阻塞** | `combat.evaded` | 14.8-2/6、36.5 |
| T2-06 `evaded_all`存在且无hit | 全部份被闪避，含仅伤害份对无敌目标 | 需求为一次闪避字样；不得偷读该记录或伪造hit；**接口阻塞** | `combat.evaded` | 11.4、22.10、36.8 AC-36-02 |
| T2-07 `hit.parts[]`混合evaded | 至少一份未闪避，至少一份闪避 | 一次命中反馈附一次闪避标记；仅未闪避伤害份进入数字，不逐份派生 | `combat.evaded`、`combat.damage` | 11、22.10、36.8 AC-36-01 |
| T2-08 `parts[i].type / final_amount` | 已登记伤害类型、evaded=false、final_amount>0 | 按类型输出普通伤害数字；只代表减免后吸收前的量 | `combat.damage`＝{amount} | 11.2、15.7、22.4 |
| T2-09 `parts[i].final_amount` | 0、evaded=false、any_reduced_to_zero=false | 默认不显示数字，不推断闪避或免疫；不能从零值证明无命中 | — | 22.3、36.4；编辑器9.6 |
| T2-10 `parts[i].type=heal / final_amount` | evaded=false、final_amount>0 | 治疗数字单独分组，以实际恢复量显示，不与伤害相加 | `combat.heal`＝+{amount} | 22.2—22.3、33A |
| T2-11 `type=heal / final_amount=0` | any_reduced_to_zero=false，可能满血或输入量为零 | 默认静默；不能显示“免疫治疗”或计算溢出数字，载荷没有溢出量 | — | 22.3、33A AC-33A-01 |
| T2-12 `any_reduced_to_zero=true`且有heal份 | 仅能确认hit内存在减免为零 | 通用免疫提示；混合份时不得断言治疗份被免疫，精确免疫治疗提示待份级原因 | `combat.immune` | 22.3、36.4 |
| T2-13 `type=shield / final_amount>0` | 未闪避的护盾授予份 | 可显示“获得护盾”或授予额度；不能当作本次吸收量或剩余盾值 | `combat.shield_granted`＝获得护盾 | 22.2、22.4、33A |
| T2-14 `hit_settled.total`与伤害份 | 伤害结算成立，即使被护盾完全吸收 | 保留吸收前伤害数字；不得改为免疫，不把吸收后零扣血称为零伤害份 | `combat.damage` | 22.4；D-96 |
| T2-15 护盾吸收量／剩余额度 | 当前hit/hit_settled无对应字段 | “吸收{amount}”、盾条减少、破盾瞬间精确提示均**接口阻塞**；禁止借读damage_taken求差 | `combat.shield_absorbed`（保留未启用） | 22.4、33A AC-33A-04、36.5 |
| T2-16 `type=control / final_amount` | evaded=false且实际时长>0 | 可作通用控制生效反馈；控件单位依22.8与项目tick口径；精确控制类型图标需绑定证据 | `combat.control_applied`＝控制生效 | 22.8、33B |
| T2-17 控制递减结果 | final_amount较某配置值小 | 仅显示实际时长，不得据差值标“递减”；机制未定且无递减原因字段，专用提示**阻塞** | `combat.control_diminished`（保留未启用） | 22.8、36.4 |
| T2-18 `type=knockback / final_amount` | evaded=false、实际位移量>0 | 可播击退命中反馈；距离不是伤害数字；表现不推动目标坐标 | `combat.knockback`＝击退 | 22.7、33B |
| T2-19 `type=buff/debuff / final_amount` | 未闪避且实际状态量>0 | 可显示一次增益／减益施加反馈；仅在注册语义明确时将量解释为层数变化 | `combat.buff_applied`／`combat.debuff_applied` | 22.5、36.4 |
| T2-20 状态身份、当前层数、剩余寿命 | 冻结载荷只有type与actual量，没有状态实例ID及权威剩余值 | 持续图标、准确叠层与倒计时**接口阻塞**；不得把施加量当当前总层数 | `combat.status_stack`（保留未启用） | 8.5A、22.5、22.8、36.4 |
| T2-21 控制刷新／取长 | 配方声明refresh_single或keep_longer，但未返回已结算状态身份 | 短促控制反馈可用；精确刷新、取长及提前解除显示**阻塞**，不从动画时间推算 | `combat.status_refresh`（保留未启用） | 22.8、33B AC-33B-01 |
| T2-22 暴击标记 | 冻结parts无暴击标记，算法入口尚为候选 | 暴击高亮与专属数字**阻塞**；不能根据数值较大猜暴击；有字段后也须与普通数字分组 | `combat.critical`（保留未启用） | 15.7、第26章、36.4 |
| T2-23 格挡标记／格挡量 | 冻结parts无对应字段 | 格挡字样、音效和抵挡量**阻塞**；零值不能推出格挡，不能读取配置概率重掷 | `combat.blocked`（保留未启用） | 第26章、36.4 |
| T2-24 混合伤害及有益份 | 同hit内伤害evaded=true，heal/buff份未闪避 | 闪避与治疗／增益反馈可并存；不以伤害失败隐藏合法有益结果 | 对应上述类别key | 11.4、22.10；D-90、D-104 |
| T2-25 被过滤、已死亡、家族或批次抑制目标 | 没有合法候选结果，没有hit | 正式反馈静默，不制造闪避、免疫或击杀字样 | — | 14、14.8、22.9、30章 |
| T2-26 `debug_record.kind` | proc_blocked或gen_limit | 正式表现静默，不用提示触发补偿效果；仅调试工具可查看 | — | 20、21、36.5；D-94 |

### T2.3 可消费精度与去重规则

份类型可从hit读取，但 `type=control` 不是 `control_type=stun`，`type=buff`也不是具体增益ID。`part_index`可以保留顺序，却没有在36.4冻结“每个实际份必定对应哪个作者模板项”的完整绑定。`〔推荐默认〕` 在绑定被注册前只给通用施加反馈，不显示具体状态名、精确图标倒计时或破盾提示。此为保守降级，不是把缺失结果当成失败。

免疫标记是hit级“至少一份”，不是逐份的原因标签。例如同条hit中有满血治疗零值和免疫控制零值，仅凭两个零值不能判断哪份免疫。显示一次通用“免疫”成立；分别显示“治疗免疫”和“控制免疫”不成立。护盾吸收不置该标记，任何拿实际扣血零值反推免疫的实现都违反22.4。

`〔推荐默认〕` 普通份数字以hit作为唯一金额入口，按 `target_id + type + 表现类别` 建显示桶，再按配置窗口合并。份模式可选逐份或按类型，但来源只计一次；不能将hit各份金额与hit_settled.total再相加。混合非伤害份时，不将total解释成“伤害＋治疗＋时长＋距离”的可显示金额，按份型分别消费。hit_settled可为明确纯伤害记录提供合计降级，但不与已计hit重复累计。

`hit`的`tick/seq/source_instance/target_id`可用于稳定处理单次命中。周期命中在不同tick可以再次产生相同实例与目标组合，故不能只用`source_instance+target_id`去重全部历史。hit_settled没有tick/seq，不能仅靠这两个字段可靠关联所有周期记录。`〔推荐默认〕` 本轮正式数字选hit单通道，hit_settled作为替代消费通道而非并行加数通道；若需要跨通道重投或补齐，先冻结关联标识，不由表现猜测。

| 合并／降级情形 | 必须保留 | 禁止行为 |
|---|---|---|
| 同目标同类型窗口内多条hit | 各条结算不变，只合并显示和保存正确合计 | 用合计替换运行时parts或降低派生次数 |
| 同hit有多种伤害类型 | 至少分类型累计，再按已审核样式呈现 | 混入治疗、控制、护盾授予量 |
| 目标死亡、尚有未显示数字 | 按15.7冲刷最后合计一次，击杀表现一次 | 丢失最后伤害或再制造一条击杀事件 |
| 数字实例被清理 | 从合法结算消费账本保留合计 | 订阅budget_drop才补数字，或因粒子被删修改结果 |
| 资源缺失 | 合法文字／基础数字降级，不阻塞结算 | 等动画资源到位才产生伤害 |
| 防霰弹唯一候选有混合份hit | 按该hit显示一次闪避及成立份，抑制体无反馈 | 按同批飞弹数量复制闪避提示 |

T2-05与T2-06不能以“最多一次”偷换“必须显示一次”：当前白名单下全闪避会缺显示，属于真实交付阻塞。`〔推荐默认〕` 后续由评审选择合法只读结果扩展方案，保持事件集仍只有hit/vanish；不得先增加第三事件，也不得先让正式UI订阅evaded_all。本文不虚构扩展字段名，不在当前冻结接口中写入不存在的零伤害hit。

## T3　字段 → Schema 路径

〔2026-10-18 第1轮〕路径逐行承接编辑器第5章“Schema路径”列。完整路径从七个CFG顶层键开始，不再加不存在的`CFG`包装；`[]`表示数组元素占位，诊断时替换为实际下标并保留template_id关联。以下内层组织与类型中未被36章冻结的内容均承接第5章的 `〔推荐默认〕`，不是另行冻结。

### T3.1 校验ID与路径使用方式

校验ID引用编辑器第14章现有 `V-001…V-084`，不新占编号。该章多用扁平params或第16章覆盖结构，而第5章用params.templates；**本文复用规则语义，定位改为本表源路径的建议接线，不宣称现有校验器已接受这些路径**。语义或路径不一致的规则在未决问题列明；泛型V-020仅代表类型、范围检查，不代表所有行为探针已完成。

每行规则均须在真实叶字段上实例化。V-016用于可生成引用的解析；一般ref也需V-020检查注册类型与存在性。tick字段加V-021；需要具体载体行为证据时加V-079。V-019拒绝运行时结果注入和未登记字段；V-014阻止覆盖卡片锁定值。这些是通用门禁，不为每行重复增加长串编号。

### T3.2 基础信息与施法者闭环（八栏1、2）

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| schema_version | string | 通用 | `schema_version` | 5.2.3／格式版本只读 | V-001 |
| skill_id | string | 通用 | `skill_id` | 5.2.3／技能身份 | V-002、V-003 |
| name | string | 通用 | `meta.name` | 栏1／名称 | V-008 |
| intent | string | 通用 | `meta.intent` | 栏1／设计意图 | V-020 |
| tags | array | 通用 | `meta.tags` | 栏1／标签 | V-010 |
| status | enum | 通用 | `meta.status` | 栏1／recommended或pending | V-020 |
| player_text | array | 通用 | `meta.player_text` | 栏1／三句玩家文字 | V-017、V-018 |
| template_id | string | 全载体 | `params.templates[].template_id` | 5.2.3／模板身份 | V-020、V-016 |
| carrier | enum | 全载体 | `params.templates[].carrier` | 栏3／载体标签页 | V-024 |
| target_group | enum | 全载体 | `params.templates[].targeting.target_group` | 栏1／攻击对象 | V-020、V-079 |
| friendly_fire | bool | 有害份模板 | `params.templates[].targeting.friendly_fire` | 5.2.3／误伤声明 | V-020、V-079 |
| include_self | bool | 友方效果模板 | `params.templates[].targeting.include_self` | 5.2.3／包括自身 | V-020、V-079 |
| target_mode | enum | 通用 | `params.cast.target_mode` | 栏2／索敌方式 | V-020 |
| windup_ticks | int | 通用 | `params.cast.windup_ticks` | 栏2／前摇 | V-021 |
| shot_count | int | 通用 | `params.cast.shot_count` | 栏2／出手次数X | V-020、V-023 |
| shot_interval_ticks | int | 通用 | `params.cast.shot_interval_ticks` | 栏2／出手间隔 | V-021、V-023 |
| cooldown_seconds | float | 通用 | `params.cast.cooldown_seconds` | 栏2／冷却秒值 | V-020、V-079 |
| cooldown_start | enum | 通用 | `params.cast.cooldown_start` | 栏2／末次实际出手起算，只读 | V-020、V-079 |
| count | int | 全载体 | `params.templates[].emission.count` | 栏3／每次出手生成数量 | V-020 |
| shotgun_allowed | bool | 同批独立实例 | `params.templates[].emission.shotgun_allowed` | 5.3／防霰弹 | V-069、V-079 |

攻击对象落在模板目标域，索敌方式落在闭环，两者不能用一个选择器互相覆盖。一次出手生成三枚与三次出手各一枚不同；parts长度也不增加X。冷却秒值按项目统一时钟换算，运行时仍按tick推进；不在此增加第二份可编辑cooldown_ticks造成双重真相。

### T3.3 效果体、命中策略与终止原因（八栏3、4、6）

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| lifetime_ticks | int | 全载体 | `params.templates[].lifetime_ticks` | 栏3／寿命 | V-021、V-025、V-026 |
| start_delay_ticks | int | 延迟判定模板 | `params.templates[].timing.start_delay_ticks` | 5.4／开始延迟 | V-022、V-079 |
| per_target_limit | int | 判定模板 | `params.templates[].hit_policy.per_target_limit` | 栏4／候选接触额度 | V-027 |
| rehit_interval_ticks | int | 周期区域、周期附着 | `params.templates[].hit_policy.rehit_interval_ticks` | 栏4／重复间隔 | V-028、V-029 |
| max_hits | int | 判定模板 | `params.templates[].hit_policy.max_hits` | 栏4／成立hit上限 | V-027、V-030 |
| possible_reasons | array | 全载体 | `params.templates[].termination.possible_reasons` | 栏6／允许的终止原因 | V-020、V-035、V-036 |
| on_target_lost | enum | 追踪等模板 | `params.templates[].on_target_lost` | 5.4／目标丢失处理 | V-031 |
| periodic_tick | int | 周期attached | `params.templates[].attached.periodic_tick` | 5.4／附着周期 | V-021、V-079 |
| mode | enum | independent、self | `params.templates[].motion.mode` | 栏3／运动方式 | V-020、V-079 |
| speed | float | 移动independent | `params.templates[].motion.speed` | 5.5.1／每tick速度 | V-020 |
| acceleration | float | 加速飞行模板 | `params.templates[].motion.acceleration` | 5.5.1／加速度 | V-020 |
| speed_cap | float | 加速飞行模板 | `params.templates[].motion.speed_cap` | 5.5.1／速度上限 | V-020 |
| range | float | 距离终止模板 | `params.templates[].motion.range` | 5.5.1／射程 | V-020 |
| tracking_profile | ref | homing_projectile | `params.templates[].motion.tracking_profile` | 5.5.1／追踪策略 | V-020、V-079 |
| orbit_radius | float | orbit_blade | `params.templates[].motion.orbit_radius` | 5.5.1／轨道半径 | V-020 |
| attach_to_caster | bool | 允许锚定的模板 | `params.templates[].attach_to_caster` | 5.5.1／位置跟随 | V-069 |
| displacement_profile | ref | self | `params.templates[].motion.displacement_profile` | 5.5.1／位移规则 | V-020、V-079 |
| bounce_profile | ref | ricochet_projectile | `params.templates[].motion.bounce_profile` | 5.5.2／弹射策略 | V-020、V-079 |
| bounce_limit | int | ricochet_projectile | `params.templates[].motion.bounce_limit` | 5.5.2／弹射额度 | V-020 |
| split_budget | int | 分裂飞弹 | `params.templates[].motion.split_budget` | 5.5.2／分裂额度 | V-020、V-057 |
| split_count | int | 分裂飞弹 | `params.templates[].motion.split_count` | 5.5.2／分裂数量 | V-020、V-079 |
| split_template | ref | 分裂飞弹 | `params.templates[].motion.split_template` | 5.5.2／分裂子模板 | V-016 |
| chain_remaining | int | chain_projectile | `params.templates[].motion.chain_remaining` | 5.5.2／剩余连锁额度 | V-020、V-058 |
| chain_template | ref | chain_projectile | `params.templates[].motion.chain_template` | 5.5.2／连锁子模板 | V-016 |
| shape | enum | 空间判定模板 | `params.templates[].geometry.shape` | 栏3／判定形状 | V-020 |
| radius | float | 圆、扇形模板 | `params.templates[].geometry.radius` | 5.6／逻辑半径 | V-020 |
| sector_angle | float | 扇形模板 | `params.templates[].geometry.sector_angle` | 5.6／整圆百分比 | V-020 |
| length | float | 线、矩形模板 | `params.templates[].geometry.length` | 5.6／判定长度 | V-020 |
| width | float | 线、矩形模板 | `params.templates[].geometry.width` | 5.6／判定宽度 | V-020 |
| wavefront_start_radius | float | expanding_wave | `params.templates[].geometry.wavefront_start_radius` | 5.6／波前起半径 | V-020 |
| wavefront_end_radius | float | expanding_wave | `params.templates[].geometry.wavefront_end_radius` | 5.6／波前末半径 | V-020 |
| wavefront_speed | float | expanding_wave | `params.templates[].geometry.wavefront_speed` | 5.6／扩张速度 | V-020 |
| area_profile | ref | 周期区、波前 | `params.templates[].geometry.area_profile` | 5.6／区域策略 | V-020、V-079 |

none锁定寿命与延迟为零，不开放motion；attached不开放空间geometry。正整数周期不能被零间隔替代；开始延迟不得吞掉全部有效寿命。sector_angle沿源表用整圆百分比，25表示四分之一圆，不是25度。possible_reasons是声明而不是制造结束能力；purge不是原因码，landed仅限抛射，self的终点通常为range_end或expired。

### T3.4 结算份与非伤害模板（八栏4及22.x）

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| parts | array | 结算模板 | `params.templates[].parts` | 栏4／份卡片增删 | V-020、V-038 |
| type | enum | 所有结算份 | `params.templates[].parts[].type` | 栏4／份类型 | V-038 |
| amount | float | 伤害、治疗、护盾份 | `params.templates[].parts[].amount` | 5.7.1／名义量输入 | V-020 |
| amount_profile | ref | 属性缩放份 | `params.templates[].parts[].amount_profile` | 5.7.1／名义量公式 | V-020、V-079 |
| evadable | bool | 有益／有害份 | `params.templates[].parts[].evadable` | 5.7.1／逐份闪避声明 | V-020、V-079 |
| immunity_profile | ref | 份级免疫 | `params.templates[].parts[].immunity_profile` | 5.7.1／免疫规则 | V-020、V-079 |
| crit_profile | ref | 暴击入口候选 | `params.templates[].settlement.crit_profile` | 5.7.1／批准策略选择 | V-020、V-079 |
| block_profile | ref | 格挡入口候选 | `params.templates[].settlement.block_profile` | 5.7.1／批准策略选择 | V-020、V-079 |
| duration_ticks | int | 控制、有限状态份 | `params.templates[].parts[].duration_ticks` | 5.7.2／状态时长 | V-021、V-079 |
| control_type | enum | 控制份 | `params.templates[].parts[].control_type` | 5.7.2／注册控制类型 | V-020、V-079 |
| interrupts_cast | bool | 控制份 | `params.templates[].parts[].interrupts_cast` | 5.7.2／类型注册值只读 | V-020、V-079 |
| distance | float | 击退份 | `params.templates[].parts[].distance` | 5.7.2／位移距离 | V-020 |
| displacement_speed | float | 击退份 | `params.templates[].parts[].displacement_speed` | 5.7.2／受迫位移速度 | V-020 |
| restack_rule | enum | 护盾、状态、控制 | `params.templates[].parts[].restack_rule` | 5.7.2／刷新或叠加 | V-020、V-079 |
| stack_limit | int | 有限叠层状态 | `params.templates[].parts[].stack_limit` | 5.7.2／层数上限 | V-020 |
| status_profile | ref | 增益、减益、附着状态 | `params.templates[].parts[].status_profile` | 5.7.2／状态模板 | V-020、V-079 |
| immune_flags | array | 授权attached模板 | `params.templates[].attached.immune_flags` | 5.7.2／免疫注册标记 | V-020、V-079 |
| anchor_source | enum | attached | `params.templates[].attached.anchor_source` | 5.8／宿主来源 | V-020、V-079 |
| bind_owner | bool | summon_unit | `params.templates[].summon.bind_owner` | 5.4／召唤者阵亡绑定 | V-069 |
| summon_cap | int | summon_unit | `params.templates[].summon.summon_cap` | 5.8／同类召唤上限 | V-068 |
| summon_profile | ref | summon_unit | `params.templates[].summon.summon_profile` | 5.8／单位与子闭环 | V-016、V-079 |
| owner_source | enum | summon_unit | `params.templates[].summon.owner_source` | 5.8／召唤归属 | V-020、V-079 |

伤害份数由parts长度表达，不另造part_count。amount与amount_profile二选一；结果final_amount不能作为覆盖值。免疫注册与控制注册必须有可解析定义，空引用不等于默认所有免疫。眩晕的interrupts_cast=false不代表不封闭施放门；它与暂停、打断的区别由22.8决定。

增益减益的默认有限叠层与控制的默认刷新单例不同。源表restack_rule的通用refresh_single不能覆盖22.5，须由具体预设选正确规则；护盾额度授予也不能当作吸收结果。anchor_source=hit_target要求真实命中上下文；vanish载荷不含target_id，不得默认找最近目标充当宿主。

### T3.5 派生与被动挂点（八栏5、8）

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| derivations | array | 允许派生模板 | `params.templates[].derivations` | 栏5／命中后或结束后 | V-020、V-037 |
| event | enum | 派生规则 | `params.templates[].derivations[].event` | 栏5／hit或vanish | V-032 |
| reasons | array | vanish派生 | `params.templates[].derivations[].reasons` | 栏5／原因过滤 | V-033、V-034、V-035、V-036 |
| child_template | ref | 派生规则 | `params.templates[].derivations[].child_template` | 栏5／子模板选择 | V-016 |
| count | int | 派生规则 | `params.templates[].derivations[].count` | 栏5／单次生成数量 | V-020、V-079 |
| max_chain_depth | int | 派生及被动链 | `params.safety.max_chain_depth` | 5.9／因果深度安全上限 | V-066、V-047 |
| allow_self_chain | bool | 被动链 | `params.passive.allow_self_chain` | 5.9／自链声明 | V-067、V-069 |
| allowed_records | array | 被动挂点声明 | `params.passive.allowed_records` | 栏8／可订阅记录 | V-060 |
| triggers | array | 被动挂点声明 | `params.passive.triggers` | 栏8／触发条目 | V-020 |
| trigger_id | string | 被动触发器 | `params.passive.triggers[].trigger_id` | 5.10／稳定触发身份 | V-059 |
| record | enum | 被动触发器 | `params.passive.triggers[].record` | 5.10／记录入口 | V-060 |
| condition | ref | 被动触发器 | `params.passive.triggers[].condition` | 5.10／目标与份过滤 | V-020、V-062 |
| internal_cooldown_ticks | int | 被动触发器 | `params.passive.triggers[].internal_cooldown_ticks` | 5.10／内部冷却 | V-064、V-065 |
| action_profile | ref | 被动触发器 | `params.passive.triggers[].action_profile` | 5.10／生成或挂修饰器 | V-016、V-061 |

event只能hit或vanish；两个入口可在同一列表分别登记，空列表表示均无，不需要两个冗余布尔值。hit规则不填终止原因，vanish必须显式过滤；允许某原因派生不等于自动创建子体。子模板引用失效不可静默忽略。分裂快捷字段与derivations对应项只能有一个权威生成入口，否则会重复生成。

被动记录白名单为cast_started、hit_settled、evaded_all、damage_taken，不包括debug_record；这不扩大T2的正式UI白名单。condition不得访问记录中不存在的字段；监听治疗必须按heal与目标身份过滤。安全上限不可经修饰器放大，子链不能重置。零内置冷却需显式安全保障，不等于关闭来源链保护。

### T3.6 修饰器接口（八栏7）与外围引用

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| exposed_fields | array | 通用 | `params.exposed_fields` | 栏7／暴露字段列表 | V-020、V-043 |
| field_path | ref | 暴露声明 | `params.exposed_fields[].field_path` | 栏7／具体字段 | V-043、V-046、V-047 |
| permissions | array | 暴露声明 | `params.exposed_fields[].permissions` | 栏7／三档许可集合 | V-020、V-045 |
| live | bool | 暴露声明 | `params.exposed_fields[].live` | 栏7／允许在场修改 | V-020、V-045 |
| modifier_id | string | 修饰条目 | `params.modifiers[].modifier_id` | 5.12／修饰身份 | V-039 |
| permission | enum | 修饰条目 | `params.modifiers[].permission` | 5.12／单项权限 | V-040 |
| scope | enum | 修饰条目 | `params.modifiers[].scope` | 5.12／own_skill或tagged | V-042 |
| inheritable | bool | 修饰条目 | `params.modifiers[].inheritable` | 5.12／允许继承 | V-052 |
| targets | array | 修饰条目 | `params.modifiers[].targets` | 5.12／暴露目标勾选 | V-043、V-044、V-046、V-047 |
| stack_rule | ref | 修饰条目 | `params.modifiers[].stack_rule` | 5.12／叠加规则引用 | V-020；V-049待适配 |
| tag_filter | array | tagged修饰 | `params.modifiers[].tag_filter` | 5.12／标签选择 | V-010、V-042 |
| operation_profile | ref | 修饰条目 | `params.modifiers[].operation_profile` | 5.12／已登记操作 | V-020、V-079 |
| budget_tier | ref | 通用 | `runtime_hints.budget_tier` | 5.11／项目预算档位 | V-020、V-080 |
| discard_priority | ref | 通用 | `runtime_hints.discard_priority` | 5.11／丢弃策略引用 | V-020、V-080 |
| bucket_profile | ref | 空间实例 | `runtime_hints.bucket_profile` | 5.11／分桶建议 | V-020、V-080 |
| cast_budget | int | 生成链 | `params.safety.cast_budget` | 5.11／生成安全预算 | V-055、V-056 |
| ref | ref | 全载体 | `presentation.fx.ref` | 5.13／特效方案 | V-020、V-070、V-072 |
| ref | ref | 全载体 | `presentation.sfx.ref` | 5.13／声音方案 | V-020、V-070、V-073 |
| ref | ref | 全载体 | `presentation.anim.ref` | 5.13／动画方案 | V-020、V-070、V-074 |
| ref | ref | 载体兼容方案 | `presentation.trail.ref` | 5.13／拖尾方案 | V-020、V-070、V-075 |
| ref | ref | 全载体 | `presentation.camera.ref` | 5.13／镜头方案 | V-020、V-070、V-072 |
| ref | ref | 结算模板 | `presentation.damage_number.ref` | 5.13／数字方案 | V-020、V-071、V-076 |
| ref | ref | 状态模板 | `presentation.status_icon.ref` | 5.13／状态图标方案 | V-020、V-071、V-072 |

七个表现ref是第5章推荐封装，引用解析后才检查第9章具体段约束，不把V-073等错误定位到一个无关字符串上。三档权限取物品申请、字段暴露、积木锁定范围的交集；空暴露不等于默认全开放。叠加顺序固定set→add→mul→clamp，不能拖拽重排。预算引用缺失不能按无限处理，本表不填写项目性能指标。

### T3.7 5.4及22.x运行时字段：显式无CFG路径

以下行补齐运行时词表，不是可编辑字段。完整路径列写“无”是明确的禁止序列化结论，不能为了凑齐路径而发明params.instance_id。由模板输入生成实例时，载体、寿命、hit_policy分别取上述对应路径，skill_id取顶层身份；它们在配置和实例中的职责仍不同。

| 字段名 | 类型 | 所属载体或积木 | CFG Schema完整路径 | 编辑器表单位置 | 校验规则ID |
|---|---|---|---|---|---|
| instance_id | 唯一标识，编码未冻结 | 全实例 | 无：运行时分配 | 5.9.2／只读检查 | V-019、V-046 |
| seq | 创建序号 | 全实例 | 无：运行时定序 | 5.9.2／只读检查 | V-019、V-046 |
| caster_id | 单位标识 | 全实例 | 无：运行时施放上下文 | 5.9.2／归属说明 | V-019、V-046 |
| generation | int | 全实例 | 无：根0，派生递增 | 5.9.2／来源图 | V-019、V-046 |
| parent_ref | 实例引用或空 | 派生实例 | 无：真实父实例关联 | 5.9.2／来源图 | V-019、V-046 |
| origin | 来源结构 | 全实例 | 无：运行时来源链 | 5.9.2／来源图 | V-019、V-046 |
| origin_skill | 技能标识 | 来源链 | 无：按20章继承 | 5.9.2／根技能说明 | V-019、V-046 |
| origin_cast_id | 施放标识 | 来源链 | 无：实际施放分配 | 5.9.2／根施放说明 | V-019、V-046 |
| chain_depth | int | 来源链 | 无：派生及被动触发递增 | 5.9.2／深度预览 | V-019、V-046 |
| proc_mask | 来源标记，编码未冻结 | 来源链 | 无：运行时防回灌 | 5.9.2／触发解释 | V-019、V-046 |
| spawn_tick | tick编号 | 全实例 | 无：创建时分配 | 5.9.2／只读时间 | V-019、V-046 |
| snapshot | 属性快照 | 全实例 | 无：出手时捕获 | 5.9.2／公式取值说明 | V-019、V-046 |
| params | 实例参数集 | 全实例 | 无直接整体镜像：由已登记模板叶字段构建 | 5.9.2／只读参数 | V-019、V-046 |
| hit_policy | 命中策略结构 | 判定实例 | 无额外整包输入：三个子字段路径见T3.3 | 栏4／策略分项 | V-027、V-028、V-030 |
| state | enum | 全实例 | 无：live/terminating/gone由系统转换 | 5.9.2／状态预览 | V-019、V-046 |
| anchor_target_id | 单位标识 | attached | 无：anchor_source解析实际宿主 | 5.8／宿主说明 | V-019、V-046 |
| owner_id | 单位标识 | 召唤及附着归属 | 无：运行时归属关系 | 5.8／归属说明 | V-019、V-046 |
| visited | 访问历史 | 连锁实例 | 无：运行时逐次累积 | 5.5.2／连锁解释 | V-019、V-058 |
| part_index | 份索引 | 结算结果 | 无：不是作者填写项 | 5.7／只读结果 | V-019、V-038 |
| evaded、final_amount、any_reduced_to_zero、killed | bool／实际量 | 结算结果 | 无：仅由运行时写结果 | T2预览／禁止保存 | V-019、V-046 |

5.4的lifetime_ticks、carrier、skill_id、hit_policy子字段已经有配置输入落点；并非每一个运行时字段都必须有CFG路径。22.x的召唤上限、宿主来源、绑定策略、状态叠加与控制注册均已在T3.4落点；授予的名义量与实际结果不可混合保存。没有具体编码冻结的ID或结构不强行宣布为string或array，避免把文档说明升级成未经批准的二进制／序列化约定。

### T3.8 八栏全字段覆盖账本与验收例子

| 24.2栏位 | 原文全部关键字段 | T3落点 | 完成判据 |
|---|---|---|---|
| 1 基础信息 | 名称、意图、攻击对象、标签、状态 | T3.2：name、intent、target_group、tags、status | 五项逐一有路径；攻击对象不被索敌替代 |
| 2 施法者闭环 | 索敌、前摇、出手次数X、冷却；默认中的起算点 | T3.2：target_mode、windup_ticks、shot_count、cooldown_seconds、cooldown_start | 数量不与实例count混用，起算点只读 |
| 3 效果体 | 载体、寿命、运动、判定形状 | T3.2 carrier；T3.3 lifetime_ticks、motion.mode、geometry.shape及参数 | 每模板按载体条件展开；不适用域禁填 |
| 4 命中与伤害份 | hit_policy、伤害份数、类型 | T3.3三个策略子字段；T3.4 parts长度、parts[].type | 份数通过数组增删，不能另填不一致数量 |
| 5 派生 | hit派生、vanish派生 | T3.5 derivations[].event及原因、子模板、数量 | 两类入口可分别登记；空列表表示均无 |
| 6 终止原因 | 允许哪些reason | T3.3 termination.possible_reasons | 取载体合法子集，不能包含purge |
| 7 修饰器接口 | 暴露字段声明 | T3.6 exposed_fields及field_path、permissions、live | 具体路径与权限同时明确，不默认任意修改 |
| 8 被动触发挂点 | 可订阅的结算记录 | T3.5 allowed_records、triggers | 默认空；记录不升级为事件 |
| 附加玩家文字 | 三句 | T3.2 meta.player_text | 至多三句，与实际行为一致 |

八栏覆盖达成指字段映射完备，不代表第16章路径冲突已解决。源表九列的默认、单位、分级、必填条件仍回引第5章；T3不重写一份数值表。表单的“必填”按载体与能力条件判断，不能要求瞬时治疗填写飞行速度、要求纯表现填写伤害份或要求所有技能挂被动。

| 文档级验收 | 输入 | 期望 |
|---|---|---|
| 八栏覆盖 | 按24.2逐字段核对 | 上表无缺项，玩家文字额外覆盖 |
| 路径完整性 | 对比第5章所有九列表行 | 每条Schema路径在T3出现；同名count、ref不互相覆盖 |
| 输入／结果分离 | 导入params中的final_amount或instance_id | V-019拒绝；不能把结果伪装作者默认 |
| 类型与单位 | sector_angle填25；rehit_interval_ticks填0 | 前者按四分之一圆解释，后者V-028拒绝 |
| 载体合法性 | none寿命大于零；carrier=instant | 分别V-025、V-024拒绝 |
| 派生安全 | vanish选择purge；子引用失效 | 分别V-033、V-016拒绝，不以空行为吞掉 |
| 权限边界 | 数值修饰器指向max_chain_depth | V-047拒绝，不能扩大安全上限 |
| 被动白名单 | record=debug_record | V-060拒绝，不生成补偿效果 |
| 表现独立性 | 动画回调请求改命中tick | V-072拒绝，结算不依赖动画 |

本轮验证对象是文档集合：键覆盖、路径覆盖、必填列、枚举、旧词、引用和已知冲突。没有修改游戏代码，也没有运行游戏行为测试；上述例子为交接验收期望，不宣称实现已通过。评审批准后才进入Schema实现与TDD任务，三张表不得充当跳过人审核的凭据。

## 与运行时契约的引用关系

〔2026-10-18 第1轮〕本节给出两份文档唯一接线面的回指。编辑器章节通过本表引用契约，不重复定义事件、原因码、身份或结算顺序。编号引用均指本次读取的v0.2主书稿，文件名未随内文v0.2.6状态改名。

| 本文件条款 | 编辑器来源 | 主书稿章节／决策号 | 接线责任 |
|---|---|---|---|
| T1.1四类载体 | 4.8、共享10 | 8.1—8.5A、36.4、附录B；D-01、D-18、D-106 | 运行时给词表，编辑器按合法枚举选择 |
| T1.2位移候选纠正 | 4.8位移行 | 8.3、8.4、29章；D-06 | 评审修订源卡，本文不授权转正 |
| T1附着、召唤、区域边界 | 4.8、5.8 | 22.3—22.8；D-07、D-90、D-104 | 模板分别声明宿主、空间与闭环 |
| T2-01…07五行硬集合 | 9.9 | 11、14.8-6c、15.7、36.4—36.5；D-05、D-94 | 可消费项落表，白名单缺口不得伪补 |
| T2治疗与护盾 | 9.9、5.7 | 22.3、22.4、33A；D-90、D-95、D-96 | 区分名义量、实际量与吸收前后 |
| T2状态与控制 | 9.7、5.7.2 | 22.5、22.8、33B；D-101、D-104、D-107 | 不从配置推断未返回的运行时状态 |
| T2合并及降级 | 9.6、10.2 | 15.7、36.4—36.5；D-94 | 只改变显示，不重复计数或读调试记录 |
| T3完整路径 | 第5章九列表 | 5.4、22.x、24.2、36.4及附录B | 路径保持源表，推荐结构待评审统一 |
| T3派生与被动 | 5.9、5.10 | 20、21、36.2—36.5 | 事件与结算记录两种入口分开 |
| T3修饰器接口 | 5.12、第14章 | 17、18、36.6；D-04、D-91、D-92、D-105 | 三档权限、快照与live边界不得扩大 |
| T3八栏账本 | 5.2.2与各参数域 | 24.2、24.3 | 逐字段覆盖，不以“八个标题齐了”代替 |
| 全文范围与状态 | 共享00、10 | 第36章、附录B | 不改变已确认决策，不定义项目性能线 |

## 未决问题

〔2026-10-18 第1轮〕以下为交给WorkBuddy的反向质疑与收口项，不向用户提出日常设定题；不在本轮修改其他文件。所有推荐均为项目内接口保守处置，不援引未经抓取的外部事实。任务完成表示本文件已交付，不表示这些阻塞已解除。

| 编号 | 冲突／缺口与证据 | 当前处置与推荐 | 责任及验收出口 |
|---|---|---|---|
| U-01 | 共享00/10含instant不含self；主书稿8.1、36.4、附录B相反；4.8位移候选因此错配 | 按主书稿映射self，保留候选；〔推荐默认〕统一枚举后修源卡，不做静默别名 | WorkBuddy协调共享接口与第4章；四处词表及默认片段一致 |
| U-02 | 8.2-5概括所有无空间运动实例为attached，但8.5明确静止火区independent | 以宿主附着与空间接触区分；〔推荐默认〕限定8.2-5适用目标附着状态 | 运行时契约评审；静止区与附着恢复验收不混类 |
| U-03 | 8.5A含dispelled、anchor_gone，36.3无这两码；宿主阵亡另要求purge | 不扩充可提交原因枚举，涉及驱散的完整生命周期暂阻塞；〔推荐默认〕统一原因表与清理优先序 | 契约责任方；驱散和宿主阵亡分别有明确结果 |
| U-04 | 全闪避没有hit，只有evaded_all；T2要求全闪避及防霰弹一次提示，但正式UI白名单不含该记录 | 明确T2-05/06阻塞；〔推荐默认〕先冻结合法只读反馈扩展，保持两个事件，不偷读记录 | WorkBuddy协调36章与表现章；全闪避恰显示一次且无新增hit |
| U-05 | hit_settled.parts只有index/type，缺份实际量、闪避及稳定时间关联；9.9容易误用成完整hit | 本轮选hit单金额通道；〔推荐默认〕有跨通道补齐需求再冻结关联机制 | 契约与表现责任方；周期多次结果不串联、不重复累计 |
| U-06 | any_reduced_to_zero是hit级标记，不能逐份区分免疫零、满血零或原始零 | 显示一次通用免疫，不标具体份免疫；〔推荐默认〕精确归因待份级原因契约 | 契约责任方；混合零值案例不误报治疗免疫 |
| U-07 | 护盾吸收、状态实例身份、剩余层数／寿命不在正式可读结果；9.9曾引用damage_taken | 禁止正式读取damage_taken；精确盾条、状态倒计时阻塞；〔推荐默认〕补只读权威结果后再启用 | 契约与第9章；不从图标或数值差猜状态 |
| U-08 | 控制递减仍待确认，暴击／格挡无冻结结果标记；配置profile不能证明实际发生 | 仅保留映射需求和未启用文案key，不发明算法；〔推荐默认〕缺标记不显示专属反馈 | 机制评审与契约责任方；规则、载荷、表现同时闭合 |
| U-09 | 第5章templates结构与第14/16章扁平params、brick_overrides、on/produces路径不同 | T3逐字保留第5章路径；V号仅语义接线；〔推荐默认〕评审统一规范化结构后生成Schema与路径诊断 | 编辑器Schema责任方；源表、T3、校验、导出同路径 |
| U-10 | 第5章stack_rule是ref，第14章V-049要求set/add/mul/clamp类别；V-048还要求未登记min/max | 不把ref硬改枚举，也不私增字段；〔推荐默认〕把操作类别校验放到引用资源内，补齐暴露边界来源 | 第5、14、16章责任方；每个V号有实际可定位字段 |
| U-11 | 第5章cast_budget可非负，第14章V-055要求正数或项目默认；零内部冷却的说明字段也未在第5章落点 | 列出差异，不宣称零值可执行；〔推荐默认〕生成链发布采用从严校验并明确项目默认来源 | 预算与Schema责任方；缺省、零、正数各有验收 |
| U-12 | periodic_tick类型未冻；第5章暂为正整数并与rehit相等；派生瞬时体零寿命与下tick接触有跨章时序疑义 | 保留周期建议，瞬时派生组合不宣称已可执行；〔推荐默认〕以36.7为顺序基准补完整生命周期说明 | 契约责任方；创建、首次接触、终止tick三者可核验 |
| U-13 | 第9章将同类状态一概刷新单例，与22.5增益减益有限叠层不同；精确状态绑定也未冻结 | 按具体模板区分控制刷新与状态叠层；〔推荐默认〕不把图标数量当逻辑层数 | 表现与状态责任方；同类控制和增益分别验收 |
| U-14 | 七段ref封装及combat.*本地化key尚未被第9/15/16章接收 | 全部显式推荐，不声称资源存在；〔推荐默认〕接收后配置引用解析，再启用对应反馈 | 表现、文案、Schema责任方；每key可解析且无逻辑回写 |
| U-15 | 墙面反射、嘲讽缺环境／索敌覆盖能力；已登记卡也可能缺可解析策略资源 | 保留新积木候选和策略依赖，不以carrier合法代替能力完成；〔推荐默认〕按第4章登记流程逐项补契约 | 积木与外部接口责任方；正常、失败、清理用例均闭合 |

交接顺序建议：优先关闭U-01、U-04、U-09三个直接接线阻塞，再补T2所需结果精度及附着终止语义。任何关闭都应由责任方改其拥有的文件并回传版本；本文件不替上游宣称已修复。已确认决策保持原文不变，必要限定进入备注或经评审的接口修订。
