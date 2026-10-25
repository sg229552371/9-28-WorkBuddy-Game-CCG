# POE2 辅助宝石全集 · 人读版 v1

> **用途**：人工翻阅参考。数据与 `AI资料源/POE2辅助宝石数据/` 同源（PoB2 Gems.lua，2026-10-22 抓取），
> 机器查证仍以原文件为准，本文件是它的中文重排版，**不是施工依据**。

> **译名口径**：全部为**参考意译**，非官方国服译名；如需精确名称以英文原名为准。
> **数据边界**：PoB2 Gems.lua 只含元数据（名称/标签/家族/ID），**不含效果描述与逐级数值**，
> 效果数值需另行抓取 granted effects / stat descriptions（见资料夹索引「已知边界」）。

- 条目总数：567｜家族总数：351｜分类数：18

## 一、标签中文对照（38 个）

| 英文标签 | 中文 | 英文标签 | 中文 |
|---|---|---|---|
| Ammunition | 弹药 | Mark | 印记 |
| AoE | 范围 | Melee | 近战 |
| Attack | 攻击 | Minion | 随从 |
| Banner | 旗帜 | Payoff | 结算 |
| Buff | 增益 | Persistent | 常驻 |
| Chaining | 连锁 | Physical | 物理 |
| Channelling | 引导 | Plant | 草木 |
| Chaos | 混沌 | Projectile | 投射物 |
| Cold | 冰霜 | Remnant | 残息 |
| Command | 号令 | Shapeshift | 变形 |
| Conditional | 条件 | Slam | 猛击 |
| Curse | 诅咒 | Spell | 法术 |
| Duration | 持续 | Staged | 段式 |
| Fire | 火焰 | Storm | 风暴 |
| Grenade | 手雷 | Strike | 打击 |
| Hazard | 险域 | Sustained | 续航 |
| Herald | 战旗 | Totem | 图腾 |
| Lightning | 闪电 | Trigger | 触发 |
| Lineage | 血统(传奇) | Warcry | 战吼 |

## 二、分类总览

| 分类 | 定位 | 家族数 | 宝石数 |
|---|---|---|---|
| 召唤与随从 | 强化随从的伤害、生存、体型与行为 | 22 | 44 |
| 图腾 | 放置图腾类技能的放置、强化与回收 | 5 | 13 |
| 旗帜与战旗 | 常驻或插旗式团队增益 | 2 | 2 |
| 战吼与号令 | 战吼强化、号令联动与怒气体系 | 11 | 16 |
| 诅咒、咒言与印记 | 给敌人上诅咒/印记并强化其效果 | 12 | 16 |
| 弹药与手雷 | 弩/猎枪的弹药管理、手雷投掷强化 | 8 | 14 |
| 投射物 | 投射物数量、弹道、穿透、跳弹与速度 | 27 | 49 |
| 近战打击 | 近战打击/猛击的范围、连锁与眩晕 | 31 | 61 |
| 法术施放 | 施法速度、回响、封印与层叠 | 28 | 40 |
| 触发与结算 | 触发机制、延迟结算与标记 payoff | 18 | 22 |
| 物理、流血与中毒 | 物理伤害与创伤类异常 | 22 | 51 |
| 混沌与毒系 | 混沌伤害与毒系异常 | 9 | 22 |
| 火焰 | 点燃、燃烧与火焰穿透/易伤 | 10 | 23 |
| 冰霜 | 冰冻、冰缓与冰霜穿透/易伤 | 10 | 21 |
| 闪电与风暴 | 感电、闪电穿透与易伤 | 15 | 25 |
| 范围与持续 | 范围扩大/缩小、持续时间增减 | 15 | 28 |
| 资源与续航 | 魔力/生命回复、偷取、充能与冷却 | 20 | 31 |
| 通用与其他 | 无法归入上述类别的家族 | 102 | 165 |

## 三、分类明细

> 每类一张总表，按家族归组；同一家族若条目标签不同可跨类出现。查内部 ID 请回原文件。

### 召唤与随从（38 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 阿玛纳穆的贡赋 | Amanamu's Tithe | 阿玛纳穆的贡赋 | 血统(传奇)、随从、常驻 |
| 嘱令Ⅰ | Bidding I | 嘱令Ⅰ | 随从、号令 |
| 嘱令Ⅱ | Bidding II | 嘱令Ⅰ | 随从、号令 |
| 嘱令Ⅲ | Bidding III | 嘱令Ⅰ | 随从、号令 |
| 库尔加尔的锁链 | Kurgal's Leash | 库尔加尔的锁链 | 血统(传奇)、随从、混沌 |
| 诫命 | Commandment | 诫命 | 随从、号令 |
| 狂乱随从 | Crazed Minions | 狂乱随从 | 随从、常驻 |
| 死亡进军 | Deathmarch | 死亡进军 | 随从、常驻 |
| 元素军团 | Elemental Army | 元素军团 | 随从 |
| 精华收割 | Essence Harvest | 精华收割 | 随从、常驻 |
| 饲喂狂热Ⅰ | Feeding Frenzy I | 饲喂狂热Ⅰ | 随从 |
| 饲喂狂热Ⅱ | Feeding Frenzy II | 饲喂狂热Ⅰ | 随从 |
| 魁梧随从 | Hulking Minions | 魁梧随从 | 随从、常驻 |
| 坦玛祖的香炉 | Tangmazu's Thurible | 魁梧随从 | 血统(传奇)、随从、常驻 |
| 卡莎的辉光 | Catha's Brilliance | 卡莎的辉光 | 血统(传奇)、随从、范围、火焰 |
| 炼狱军团Ⅰ | Infernal Legion I | 卡莎的辉光 | 随从、范围、火焰 |
| 炼狱军团Ⅱ | Infernal Legion II | 卡莎的辉光 | 随从、范围、火焰 |
| 炼狱军团Ⅲ | Infernal Legion III | 卡莎的辉光 | 随从、范围、火焰 |
| 回光返照 | Last Gasp | 回光返照 | 随从、常驻、持续 |
| 特克洛德的复仇 | Tecrod's Revenge | 回光返照 | 血统(传奇)、随从、常驻、持续 |
| 活体闪电 | Living Lightning | 活体闪电 | 随从、触发、闪电、持续 |
| 活体闪电Ⅱ | Living Lightning II | 活体闪电 | 随从、触发、闪电、持续 |
| 忠诚 | Loyalty | 忠诚 | 随从 |
| 罗米拉的回报 | Romira's Requital | 忠诚 | 血统(传奇)、随从 |
| 随从专精 | Minion Mastery | 专精系 | 随从 |
| 布鲁图斯之脑 | Brutus' Brain | 布鲁图斯之脑 | 血统(传奇)、随从 |
| 肉盾Ⅰ | Meat Shield I | 布鲁图斯之脑 | 随从 |
| 肉盾Ⅱ | Meat Shield II | 布鲁图斯之脑 | 随从 |
| 随从泼溅Ⅰ | Minion Splash I | 随从泼溅Ⅰ | 攻击、随从、近战、打击 |
| 随从泼溅Ⅱ | Minion Splash II | 随从泼溅Ⅰ | 攻击、随从、近战、打击 |
| 随从不稳定 | Minion Instability | 随从不稳定 | 随从、火焰 |
| 随从契约Ⅰ | Minion Pact I | 随从契约Ⅰ | 随从 |
| 随从契约Ⅱ | Minion Pact II | 随从契约Ⅰ | 随从 |
| 集结 | Muster | 集结 | 随从 |
| 祭献羔羊Ⅰ | Sacrificial Lamb I | 祭献羔羊Ⅰ | 随从 |
| 祭献羔羊Ⅱ | Sacrificial Lamb II | 祭献羔羊Ⅰ | 随从 |
| 疾走之石Ⅰ | Skittering Stone I | 疾走之石Ⅰ | 随从、触发、物理、持续 |
| 疾走之石Ⅱ | Skittering Stone II | 疾走之石Ⅰ | 随从、触发、物理、持续 |

### 图腾（13 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 血之源泉 | Font of Blood | 血之源泉 | 图腾 |
| 魔力源泉 | Font of Mana | 血之源泉 | 图腾 |
| 强韧图腾Ⅰ | Hardy Totems I | 强韧图腾Ⅰ | 图腾 |
| 强韧图腾Ⅱ | Hardy Totems II | 强韧图腾Ⅰ | 图腾 |
| 塔沃亚的照料 | Tawhoa's Tending | 强韧图腾Ⅰ | 血统(传奇)、图腾、范围、触发、物理 |
| 强化图腾Ⅰ | Reinforced Totems I | 强化图腾Ⅰ | 图腾 |
| 强化图腾Ⅱ | Reinforced Totems II | 强化图腾Ⅰ | 图腾 |
| 西瑞尔的培育 | Cirel's Cultivation | 西瑞尔的培育 | 血统(传奇)、图腾 |
| 裂片图腾Ⅰ | Splinter Totem I | 西瑞尔的培育 | 图腾 |
| 裂片图腾Ⅱ | Splinter Totem II | 西瑞尔的培育 | 图腾 |
| 急速图腾Ⅰ | Urgent Totems I | 急速图腾Ⅰ | 图腾 |
| 急速图腾Ⅱ | Urgent Totems II | 急速图腾Ⅰ | 图腾 |
| 急速图腾Ⅲ | Urgent Totems III | 急速图腾Ⅰ | 图腾 |

### 旗帜与战旗（2 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 达瑞索的激情 | Daresso's Passion | 达瑞索的激情 | 旗帜、血统(传奇) |
| 致命之捷 | Deadly Herald | 致命之捷 | 战旗 |

### 战吼与号令（16 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 护甲爆裂 | Armour Explosion | 护甲爆裂 | 攻击、战吼、范围、触发、火焰、结算 |
| 碎喝 | Battershout | 碎喝 | 战吼、范围、触发、物理、结算 |
| 腐化战吼Ⅰ | Corrupting Cry I | 腐化战吼Ⅰ | 战吼、触发、物理、持续 |
| 腐化战吼Ⅱ | Corrupting Cry II | 腐化战吼Ⅰ | 战吼、触发、物理、持续 |
| 帕夸特的契约 | Paquate's Pact | 腐化战吼Ⅰ | 血统(传奇)、战吼、触发、物理、持续 |
| 回响战吼 | Echoing Cry | 回响战吼 | 战吼、范围、条件 |
| 激怒战吼Ⅰ | Enraged Warcry I | 激怒战吼Ⅰ | 战吼 |
| 激怒战吼Ⅱ | Enraged Warcry II | 激怒战吼Ⅰ | 战吼 |
| 破绽战吼 | Exposing Cry | 破绽战吼 | 战吼、持续 |
| 巴泰尔的复仇 | Bhatair's Vengeance | 巴泰尔的复仇 | 攻击、战吼、冰霜、持续 |
| 冰噬Ⅰ | Ice Bite I | 巴泰尔的复仇 | 战吼、冰霜、持续 |
| 冰噬Ⅱ | Ice Bite II | 巴泰尔的复仇 | 战吼、冰霜、持续 |
| 狂怒之吼 | Raging Cry | 狂怒之吼 | 战吼 |
| 不倦 | Tireless | 不倦 | 战吼 |
| 弗鲁恩的余波 | Vruun's Aftermath | 弗鲁恩的余波 | 血统(传奇)、战吼 |
| 泽菲的恶名 | Zerphi's Infamy | 泽菲的恶名 | 血统(传奇)、战吼 |

### 诅咒、咒言与印记（16 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 持驻咒言 | Abiding Hex | 持驻咒言 | 诅咒 |
| 阿兹里的魅惑 | Atziri's Allure | 阿兹里的魅惑 | 血统(传奇)、诅咒 |
| 充能印记 | Charged Mark | 充能印记 | 法术、范围、触发、印记、持续 |
| 诅咒之地 | Cursed Ground | 诅咒之地 | 诅咒 |
| 多德里多的作祟 | Doedre's Undoing | 诅咒之地 | 血统(传奇)、法术、范围、触发、混沌、诅咒 |
| 哈约西的雷殛 | Hayoxi's Fulmination | 诅咒之地 | 血统(传奇)、法术、范围、触发、物理、闪电、冰霜、火焰、混沌、诅咒 |
| 腐朽咒言 | Decaying Hex | 腐朽咒言 | 法术、触发、混沌、持续、诅咒 |
| 永恒印记 | Eternal Mark | 永恒印记 | 印记 |
| 集中诅咒 | Focused Curse | 集中诅咒 | 诅咒 |
| 诅咒强化 | Heightened Curse | 诅咒强化 | 诅咒 |
| 咒言绽放 | Hex Bloom | 咒言绽放 | 范围、诅咒 |
| 死刑标记 | Mark for Death | 死刑标记 | 印记、物理 |
| 死刑标记Ⅱ | Mark for Death II | 死刑标记 | 印记、物理 |
| 虹吸印记 | Mark of Siphoning | 虹吸印记 | 印记 |
| 虹吸印记Ⅱ | Mark of Siphoning II | 虹吸印记 | 印记 |
| 仪式诅咒 | Ritualistic Curse | 仪式诅咒 | 范围、诅咒 |

### 弹药与手雷（14 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 黏着手雷Ⅰ | Adhesive Grenades I | 黏着手雷Ⅰ | 手雷 |
| 黏着手雷Ⅱ | Adhesive Grenades II | 黏着手雷Ⅰ | 手雷 |
| 弹药节约Ⅰ | Ammo Conservation I | 弹药节约Ⅰ | 弹药、投射物 |
| 弹药节约Ⅱ | Ammo Conservation II | 弹药节约Ⅰ | 弹药、投射物 |
| 弹药节约Ⅲ | Ammo Conservation III | 弹药节约Ⅰ | 弹药、投射物 |
| 阿尔君的勋章 | Arjun's Medal | 弹药节约Ⅰ | 血统(传奇)、弹药、投射物 |
| 自动装填 | Auto Reload | 自动装填 | 弹药、投射物 |
| 双管齐发Ⅰ | Double Barrel I | 双管齐发Ⅰ | 弹药、投射物 |
| 双管齐发Ⅱ | Double Barrel II | 双管齐发Ⅰ | 弹药、投射物 |
| 双管齐发Ⅲ | Double Barrel III | 双管齐发Ⅰ | 弹药、投射物 |
| 拉莎的强袭 | Ratha's Assault | 双管齐发·迅捷攻击系 | 血统(传奇)、弹药、投射物 |
| 灵巧装填 | Nimble Reload | 灵巧装填 | 弹药、投射物 |
| 载荷 | Payload | 载荷 | 手雷 |
| 流线弹丸 | Streamlined Rounds | 流线弹丸 | 弹药、投射物 |

### 投射物（45 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 符文锻刃 | Runeforged Blades | (未归家族) | 攻击、投射物、触发、结算 |
| 多重射击Ⅰ | Multishot I | 附加投射物系 | 投射物 |
| 多重射击Ⅱ | Multishot II | 附加投射物系 | 投射物 |
| 西恩的怒火 | Sione's Temper | 附加投射物系 | 血统(传奇)、法术、投射物 |
| 野性碎片Ⅰ | Wildshards I | 附加投射物系 | 法术、投射物 |
| 野性碎片Ⅱ | Wildshards II | 附加投射物系 | 法术、投射物 |
| 新星投射Ⅱ | Nova Projectiles II | 附加投射物·新星投射系 | 投射物 |
| 齐射 | Salvo | 附加投射物·封印系 | 攻击、投射物 |
| 校准Ⅰ | Alignment I | 校准Ⅰ | 攻击、投射物 |
| 校准Ⅱ | Alignment II | 校准Ⅰ | 攻击、投射物 |
| 校准Ⅲ | Alignment III | 校准·附加投射物系 | 攻击、投射物 |
| 铁蒺藜 | Caltrops | 铁蒺藜 | 攻击、范围、投射物、触发、持续、险域 |
| 连锁Ⅰ | Chain I | 连锁Ⅰ | 投射物、连锁 |
| 连锁Ⅱ | Chain II | 连锁Ⅰ | 投射物、连锁 |
| 连锁Ⅲ | Chain III | 连锁Ⅰ | 投射物、连锁 |
| 蓄能射击Ⅰ | Charged Shots I | 蓄能射击Ⅰ | 攻击、投射物 |
| 蓄能射击Ⅱ | Charged Shots II | 蓄能射击Ⅰ | 攻击、投射物 |
| 奔涌电流 | Coursing Current | 奔涌电流 | 法术、投射物、触发、闪电、连锁 |
| 多米努斯的掌握 | Dominus' Grasp | 多米努斯的掌握 | 血统(传奇)、投射物、连锁 |
| 火花增幅Ⅰ | Empowered Sparks I | 火花增幅Ⅰ | 投射物、触发、闪电、持续 |
| 燃火穿刺 | Flamepierce | 燃火穿刺 | 投射物、火焰 |
| 叉射 | Fork | 叉射 | 投射物 |
| 冰霜叉射 | Freezefork | 冰霜叉射 | 投射物、冰霜 |
| 冰冻怨毒 | Frozen Spite | 冰冻怨毒 | 范围、投射物、触发、冰霜 |
| 赌命射击 | Gambleshot | 赌命射击 | 投射物 |
| 裂隙之主的融合 | Breachlord's Amalgam | 裂隙之主的融合 | 血统(传奇)、投射物、闪电、冰霜 |
| 新星投射Ⅰ | Nova Projectiles I | 新星投射Ⅰ | 投射物 |
| 穿透Ⅰ | Pierce I | 穿透Ⅰ | 投射物 |
| 穿透Ⅱ | Pierce II | 穿透Ⅰ | 投射物 |
| 穿透Ⅲ | Pierce III | 穿透Ⅰ | 投射物 |
| 投射物加速Ⅰ | Projectile Acceleration I | 投射物加速Ⅰ | 投射物 |
| 投射物加速Ⅱ | Projectile Acceleration II | 投射物加速Ⅰ | 投射物 |
| 投射物加速Ⅲ | Projectile Acceleration III | 投射物加速Ⅰ | 投射物 |
| 投射物减速Ⅰ | Projectile Deceleration I | 投射物加速Ⅰ | 投射物 |
| 投射物减速Ⅱ | Projectile Deceleration II | 投射物加速Ⅰ | 投射物 |
| 维伦塔的推进 | Vilenta's Propulsion | 投射物加速Ⅰ | 血统(传奇)、法术、投射物 |
| 撤退Ⅰ | Retreat I | 撤退Ⅰ | 投射物 |
| 撤退Ⅱ | Retreat II | 撤退Ⅰ | 投射物 |
| 撤退Ⅲ | Retreat III | 撤退Ⅰ | 投射物 |
| 跳弹Ⅰ | Ricochet I | 跳弹Ⅰ | 投射物 |
| 跳弹Ⅱ | Ricochet II | 跳弹Ⅰ | 投射物 |
| 幽灵齐射 | Spectral Volley | 幽灵齐射 | 攻击、投射物 |
| 风暴锁链 | Stormchain | 风暴锁链 | 投射物、闪电、连锁 |
| 火山喷发 | Volcanic Eruption | 火山喷发 | 攻击、范围、近战、打击、投射物、触发、火焰 |
| 电势 | Volt | 电势 | 攻击、投射物、闪电 |

### 近战打击（54 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 余震Ⅰ | Aftershock I | 余震Ⅰ | 攻击、近战、猛击 |
| 余震Ⅱ | Aftershock II | 余震Ⅰ | 攻击、近战、猛击 |
| 构造猛击 | Tectonic Slams | 余震Ⅰ | 攻击、近战、猛击 |
| 先祖援助 | Ancestral Aid | 先祖援助 | 攻击、近战、打击、条件 |
| 先祖召唤Ⅰ | Ancestral Call I | 先祖援助 | 攻击、近战、打击 |
| 先祖召唤Ⅱ | Ancestral Call II | 先祖援助 | 攻击、近战、打击 |
| 倒刺Ⅰ | Barbs I | 倒刺Ⅰ | 攻击、近战、打击 |
| 倒刺Ⅱ | Barbs II | 倒刺Ⅰ | 攻击、近战、打击 |
| 倒刺Ⅲ | Barbs III | 倒刺Ⅰ | 攻击、近战、打击 |
| 斩首Ⅰ | Behead I | 斩首Ⅰ | 攻击、近战、打击 |
| 斩首Ⅱ | Behead II | 斩首Ⅰ | 攻击、近战、打击 |
| 埃尼哈的驯兽之晶 | Einhar's Beastrite | 斩首Ⅰ | 血统(传奇)、攻击、近战、打击 |
| 嗜血 | Bloodlust | 嗜血 | 攻击、近战、物理 |
| 荆棘猛击 | Brambleslam | 荆棘猛击 | 攻击、范围、近战、猛击、触发、物理、险域、草木 |
| 濒界Ⅰ | Brink I | 濒界Ⅰ | 攻击、近战 |
| 濒界Ⅱ | Brink II | 濒界Ⅰ | 攻击、近战 |
| 碰撞 | Clash | 碰撞 | 攻击、近战 |
| 连段终结Ⅰ | Combo Finisher I | 连段终结Ⅰ | 攻击、近战、打击、条件 |
| 连段终结Ⅱ | Combo Finisher II | 连段终结Ⅰ | 攻击、近战、打击、条件 |
| 震荡符文 | Concussive Runes | 震荡符文 | 攻击、范围、近战、猛击、触发 |
| 弹坑 | Crater | 弹坑 | 攻击、范围、近战、触发、火焰、持续 |
| 渐强Ⅰ | Crescendo I | 渐强Ⅰ | 攻击、近战、打击 |
| 渐强Ⅱ | Crescendo II | 渐强Ⅰ | 攻击、近战、打击 |
| 渐强Ⅲ | Crescendo III | 渐强Ⅰ | 攻击、近战、打击 |
| 圆满Ⅰ | Culmination I | 圆满Ⅰ | 攻击、近战、条件 |
| 圆满Ⅱ | Culmination II | 圆满Ⅰ | 攻击、近战、条件 |
| 卡欧的疯狂 | Kaom's Madness | 分叉裂隙Ⅰ | 血统(传奇)、攻击、近战 |
| 卡尔古之拳 | Fist Of Kalguur | 卡尔古之拳 | 攻击、范围、近战、猛击、触发、物理、持续 |
| 战争之拳Ⅰ | Fist of War I | 卡尔古之拳 | 攻击、近战、猛击 |
| 战争之拳Ⅱ | Fist of War II | 卡尔古之拳 | 攻击、近战、猛击 |
| 战争之拳Ⅲ | Fist of War III | 卡尔古之拳 | 攻击、近战、猛击 |
| 重挥 | Heavy Swing | 重挥 | 攻击、近战、物理 |
| 冲击震荡波 | Impact Shockwave | 冲击震荡波 | 攻击、范围、近战、打击 |
| 弗鲁恩的必然 | Vruun's Inevitability | 放大区域Ⅰ | 血统(传奇)、攻击、近战、条件 |
| 碎棱之地Ⅰ | Jagged Ground I | 碎棱之地Ⅰ | 攻击、范围、近战、猛击、持续 |
| 碎棱之地Ⅱ | Jagged Ground II | 碎棱之地Ⅰ | 攻击、范围、近战、猛击、持续 |
| 熟练连段 | Practiced Combo | 熟练连段 | 攻击、近战、打击 |
| 凿穿 | Punch Through | 凿穿 | 攻击、近战 |
| 追击Ⅰ | Pursuit I | 追击Ⅰ | 攻击、近战 |
| 追击Ⅱ | Pursuit II | 追击Ⅰ | 攻击、近战 |
| 追击Ⅲ | Pursuit III | 追击Ⅰ | 攻击、近战 |
| 羽刺迸发 | Quill Burst | 羽刺迸发 | 攻击、范围、近战、触发、物理 |
| 梅德维的伐斩 | Medved's Felling | 梅德维的伐斩 | 血统(传奇)、攻击、近战 |
| 暴怒Ⅰ | Rage I | 梅德维的伐斩 | 攻击、近战 |
| 暴怒Ⅱ | Rage II | 梅德维的伐斩 | 攻击、近战 |
| 暴怒Ⅲ | Rage III | 梅德维的伐斩 | 攻击、近战 |
| 撕裂之巅 | Rending Apex | 撕裂之巅 | 攻击、近战、打击 |
| 还击Ⅰ | Retaliate I | 还击Ⅰ | 攻击、近战 |
| 还击Ⅱ | Retaliate II | 还击Ⅰ | 攻击、近战 |
| 回荡 | Reverberate | 回荡 | 攻击、近战、猛击 |
| 撕裂 | Rip | 撕裂 | 攻击、近战、物理、持续、残息 |
| 切磋 | Spar | 切磋 | 攻击、近战 |
| 朔望 | Syzygy | 朔望 | 攻击、近战、猛击、火焰 |
| 割裂 | Tear | 割裂 | 攻击、近战、物理 |

### 法术施放（37 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 加速生长 | Accelerated Growth | 加速生长 | 法术、范围、触发、草木 |
| 加速生长Ⅱ | Accelerated Growth II | 加速生长 | 法术、范围、触发、草木 |
| 仲裁者的点燃 | Arbiter's Ignition | 仲裁者的点燃 | 血统(传奇)、法术、火焰 |
| 奥术涌动 | Arcane Surge | 奥术涌动 | 法术、持续 |
| 混沌冰冻 | Chaotic Freeze | 混沌冰冻 | 法术、混沌 |
| 震荡法术 | Concussive Spells | 震荡法术 | 法术、物理 |
| 审慎施法 | Considered Casting | 审慎施法 | 法术 |
| 受控毁灭 | Controlled Destruction | 受控毁灭 | 法术 |
| 抽纳异常 | Drain Ailments | 抽纳异常 | 法术 |
| 埃奥尼尔的雷霆 | Eonyr's Thunder | 电殛 | 血统(传奇)、法术、范围、触发、闪电 |
| 电磁 | Electromagnetism | 电磁 | 法术、范围、触发、续航、闪电、结算 |
| 元素催化 | Catalysing Elements | 元素宣泄 | 法术、范围、触发、闪电、冰霜、火焰 |
| 元素宣泄 | Elemental Discharge | 元素宣泄 | 法术、范围、触发、闪电、冰霜、火焰、结算 |
| 缓速增效 | Slow Potency | 缓速增效 | 法术 |
| 榨取 | Extraction | 榨取 | 法术、混沌 |
| 火中送葬 | Fiery Death | 火中送葬 | 法术、范围、触发、火焰 |
| 末日将至 | Impending Doom | 末日将至 | 法术、范围、触发、混沌 |
| 抑制者 | Inhibitor | 抑制者 | 法术 |
| 剧烈苦痛 | Intense Agony | 剧烈苦痛 | 法术、持续 |
| 魔力闪光 | Mana Flare | 魔力闪光 | 法术、范围、触发、火焰 |
| 奥辛的誓言 | Oisin's Oath | 魔力偷取 | 血统(传奇)、法术 |
| 强效易伤 | Potent Exposure | 强效易伤 | 法术 |
| 实用魔法Ⅰ | Practical Magic I | 实用魔法Ⅰ | 法术、持续 |
| 实用魔法Ⅱ | Practical Magic II | 实用魔法Ⅰ | 法术、持续 |
| 迅捷施法Ⅰ | Rapid Casting I | 迅捷施法Ⅰ | 法术 |
| 迅捷施法Ⅱ | Rapid Casting II | 迅捷施法Ⅰ | 法术 |
| 迅捷施法Ⅲ | Rapid Casting III | 迅捷施法Ⅰ | 法术 |
| 解放 | Unleash | 解放 | 法术 |
| 扎洛克的反叛 | Zarokh's Revolt | 解放 | 法术 |
| 扩张 | Expand | 封印·扩大范围系 | 法术、范围 |
| 法术回响 | Spell Echo | 法术回响 | 法术、范围 |
| 骗徒碎片 | Trickster's Shard | 法术回响 | 血统(传奇)、法术、范围、触发、持续 |
| 扎洛克的叠唱 | Zarokh's Refrain | 法术回响 | 血统(传奇)、法术、范围 |
| 图尔的雪崩 | Tul's Avalanche | 图尔的雪崩 | 血统(传奇)、法术、范围 |
| 静电冲击 | Static Shocks | 静电冲击 | 法术、范围、触发、续航、闪电、持续 |
| 天顶Ⅰ | Zenith I | 天顶Ⅰ | 法术 |
| 天顶Ⅱ | Zenith II | 天顶Ⅰ | 法术 |

### 触发与结算（22 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 凛霜噬骨Ⅰ | Biting Frost I | 凛霜噬骨Ⅰ | 冰霜、结算 |
| 凛霜噬骨Ⅱ | Biting Frost II | 凛霜噬骨Ⅰ | 冰霜、结算 |
| 莫瑞甘的洞悉 | Morrigan's Insight | 凛霜噬骨Ⅰ | 血统(传奇)、触发、冰霜、持续、结算 |
| 骨片飞溅 | Bone Shrapnel | 骨片飞溅 | 范围、触发、物理 |
| 燃烧铭刻 | Burning Inscription | 燃烧铭刻 | 范围、触发、火焰 |
| 迸裂瘟疫 | Bursting Plague | 迸裂瘟疫 | 范围、触发、物理、混沌 |
| 蔓延寒意 | Creeping Chill | 蔓延寒意 | 范围、触发、冰霜 |
| 刚毅决心 | Deadly Resolve | 刚毅决心 | 攻击、范围、触发、物理、引导、段式 |
| 能量存续 | Energy Retention | 能量存续 | 触发 |
| 弱点利用 | Exploit Weakness | 弱点利用 | 结算 |
| 火上浇油 | Fan The Flames | 火上浇油 | 攻击、范围、触发、火焰 |
| 火上浇油Ⅱ | Fan The Flames II | 火上浇油 | 攻击、范围、触发、火焰 |
| 火焰之柱 | Flame Pillar | 火焰之柱 | 范围、触发、火焰 |
| 侥幸 | Fluke | 侥幸 | 触发 |
| 伊克切尔的折磨 | Ixchel's Torment | 侥幸 | 血统(传奇)、触发 |
| 霜火 | Frostfire | 霜火 | 冰霜、火焰、结算 |
| 血晶 | Haemocrystals | 血晶 | 攻击、范围、触发、物理 |
| 焚身 | Immolate | 焚身 | 火焰、结算 |
| 毒孢子 | Poison Spores | 毒孢子 | 攻击、增益、范围、触发、物理、混沌、持续、草木 |
| 践踏之地 | Stomping Ground | 践踏之地 | 攻击、范围、触发 |
| 风之波 | Wind Wave | 风之波 | 范围、触发 |
| 希巴夸的撕裂 | Xibaqua's Rending | 希巴夸的撕裂 | 血统(传奇)、范围、触发、火焰 |

### 物理、流血与中毒（36 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 调和 | Admixture | 调和 | 物理、混沌 |
| 破甲Ⅰ | Armour Break I | 破甲Ⅰ | 物理 |
| 破甲Ⅱ | Armour Break II | 破甲Ⅰ | 物理 |
| 破甲Ⅲ | Armour Break III | 破甲Ⅰ | 物理 |
| 脆化护甲 | Brittle Armour | 破甲Ⅰ | 物理、冰霜 |
| 斯特恩的凶暴 | Styrn's Ferocity | 破甲Ⅰ | 血统(传奇)、物理 |
| 乌鲁克的熔炼 | Uruk's Smelting | 甲胄粉碎Ⅰ | 血统(传奇)、物理 |
| 流血Ⅰ | Bleed I | 流血Ⅰ | 物理 |
| 流血Ⅱ | Bleed II | 流血Ⅰ | 物理 |
| 流血Ⅲ | Bleed III | 流血Ⅰ | 物理 |
| 流血Ⅳ | Bleed IV | 流血Ⅰ | 物理 |
| 乌尔尼托的怀抱 | Uul-Netol's Embrace | 艾许的光辉 | 血统(传奇)、物理、混沌 |
| 残暴Ⅰ | Brutality I | 残暴Ⅰ | 物理 |
| 残暴Ⅱ | Brutality II | 残暴Ⅰ | 物理 |
| 残暴Ⅲ | Brutality III | 残暴Ⅰ | 物理 |
| 宣泄 | Catharsis | 宣泄 | 物理、混沌、条件 |
| 腐蚀 | Corrosion | 腐蚀 | 物理、混沌 |
| 深创Ⅰ | Deep Cuts I | 深创Ⅰ | 物理 |
| 深创Ⅱ | Deep Cuts II | 深创Ⅰ | 物理 |
| 恍惚 | Daze | 恍惚 | 攻击、物理 |
| 厚重 | Heft | 厚重 | 物理 |
| 戳刺 | Impale | 戳刺 | 攻击、物理 |
| 切割 | Incision | 切割 | 攻击、物理 |
| 生命偷取Ⅰ | Life Leech I | 生命偷取Ⅰ | 攻击、物理 |
| 生命偷取Ⅱ | Life Leech II | 生命偷取Ⅰ | 攻击、物理 |
| 生命偷取Ⅲ | Life Leech III | 生命偷取Ⅰ | 攻击、物理 |
| 阿塔露伊的放血 | Atalui's Bloodletting | 生命汲取 | 血统(传奇)、物理 |
| 魔力偷取 | Mana Leech | 魔力偷取 | 攻击、物理 |
| 物理专精 | Physical Mastery | 专精系 | 物理 |
| 钉固Ⅰ | Pin I | 钉固Ⅰ | 物理 |
| 钉固Ⅱ | Pin II | 钉固Ⅰ | 物理 |
| 钉固Ⅲ | Pin III | 钉固Ⅰ | 物理 |
| 符文灌注 | Runic Infusion | 符文灌注 | 攻击、物理 |
| 破裂 | Rupture | 破裂 | 物理 |
| 掘蚀 | Undermine | 掘蚀 | 物理 |
| 不稳定性 | Volatility | 不稳定性 | 物理、混沌 |

### 混沌与毒系（15 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 艾许的光辉 | Esh's Radiance | 艾许的光辉 | 血统(传奇)、闪电、混沌 |
| 图尔的静滞 | Tul's Stillness | 艾许的光辉 | 血统(传奇)、冰霜、混沌 |
| 佐夫的火堆 | Xoph's Pyre | 艾许的光辉 | 血统(传奇)、火焰、混沌 |
| 混沌调谐 | Chaos Attunement | 混沌调谐 | 混沌 |
| 剧毒Ⅰ | Deadly Poison I | 剧毒Ⅰ | 混沌 |
| 剧毒Ⅱ | Deadly Poison II | 剧毒Ⅰ | 混沌 |
| 递增剧毒 | Escalating Poison | 递增剧毒 | 混沌 |
| 混沌专精 | Chaos Mastery | 专精系 | 混沌 |
| 毒化Ⅰ | Poison I | 毒化Ⅰ | 混沌 |
| 毒化Ⅱ | Poison II | 毒化Ⅰ | 混沌 |
| 毒化Ⅲ | Poison III | 毒化Ⅰ | 混沌 |
| 亵渎Ⅰ | Profanity I | 亵渎Ⅰ | 混沌 |
| 亵渎Ⅱ | Profanity II | 亵渎Ⅰ | 混沌 |
| 塔卡蒂的怒火 | Tacati's Ire | 塔卡蒂的怒火 | 血统(传奇)、混沌 |
| 凋零之触 | Withering Touch | 凋零之触 | 混沌、持续 |

### 火焰（17 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 炽焰暴击 | Blazing Critical | 炽焰暴击 | 攻击、火焰、持续 |
| 永恒之焰Ⅰ | Eternal Flame I | 永恒之焰Ⅰ | 火焰 |
| 永恒之焰Ⅱ | Eternal Flame II | 永恒之焰Ⅰ | 火焰 |
| 永恒之焰Ⅲ | Eternal Flame III | 永恒之焰Ⅰ | 火焰 |
| 火焰调谐 | Fire Attunement | 火焰调谐 | 火焰 |
| 火焰易伤 | Fire Exposure | 火焰易伤 | 火焰、持续 |
| 火焰穿透Ⅰ | Fire Penetration I | 火焰穿透Ⅰ | 火焰 |
| 火焰穿透Ⅱ | Fire Penetration II | 火焰穿透Ⅰ | 火焰 |
| 点燃Ⅰ | Ignite I | 点燃Ⅰ | 火焰 |
| 点燃Ⅱ | Ignite II | 点燃Ⅰ | 火焰 |
| 点燃Ⅲ | Ignite III | 点燃Ⅰ | 火焰 |
| 火焰专精 | Fire Mastery | 专精系 | 火焰 |
| 涤荡之焰 | Scouring Flame | 涤荡之焰 | 火焰 |
| 灼烧之焰Ⅰ | Searing Flame I | 涤荡之焰 | 火焰 |
| 灼烧之焰Ⅱ | Searing Flame II | 涤荡之焰 | 火焰 |
| 风暴之火 | Stormfire | 风暴之火 | 闪电、火焰 |
| 野火 | Wildfire | 野火 | 范围、火焰 |

### 冰霜（10 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 裂隙之主的裂口 | Breachlord's Rift | 破甲Ⅰ | 血统(传奇)、闪电、冰霜 |
| 冰霜调谐 | Cold Attunement | 冰霜调谐 | 冰霜 |
| 冰霜易伤 | Cold Exposure | 冰霜易伤 | 冰霜、持续 |
| 冰霜穿透 | Cold Penetration | 冰霜穿透 | 冰霜 |
| 深度冰冻 | Deep Freeze | 深度冰冻 | 冰霜 |
| 怨愤 | Embitter | 怨愤 | 冰霜 |
| 冰冻 | Freeze | 冰冻 | 冰霜 |
| 霜寒枢纽 | Frost Nexus | 霜寒枢纽 | 范围、冰霜 |
| 冰霜专精 | Cold Mastery | 专精系 | 冰霜 |
| 冰壳 | Verglas | 冰壳 | 冰霜 |

### 闪电与风暴（19 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 推进风暴 | Advancing Storm | 推进风暴 | 风暴 |
| 摩根娜的风暴 | Morgana's Tempest | 推进风暴·过剩系 | 血统(传奇)、风暴 |
| 噼啪屏障 | Crackling Barrier | 噼啪屏障 | 闪电、引导 |
| 电殛 | Electrocute | 电殛 | 闪电 |
| 神经过载 | Neural Overload | 电殛 | 闪电 |
| 神经激发 | Innervate | 神经激发 | 闪电、持续 |
| 持久感电 | Lasting Shock | 持久感电 | 闪电 |
| 闪电调谐 | Lightning Attunement | 闪电调谐 | 闪电 |
| 闪电易伤 | Lightning Exposure | 闪电易伤 | 闪电、持续 |
| 闪电穿透 | Lightning Penetration | 闪电穿透 | 闪电 |
| 艾许的精通 | Esh's Prowess | 专精系 | 血统(传奇)、闪电 |
| 闪电专精 | Lightning Mastery | 专精系 | 闪电 |
| 过载 | Overcharge | 过载 | 闪电 |
| 感电 | Shock | 感电 | 闪电 |
| 感电传导 | Shock Conduction | 感电传导 | 范围、闪电 |
| 感电传导Ⅱ | Shock Conduction II | 感电传导 | 范围、闪电 |
| 感电虹吸 | Shock Siphon | 感电虹吸 | 闪电 |
| 杀戮快感 | Thrill of the Kill | 杀戮快感 | 攻击、闪电、持续 |
| 杀戮快感Ⅱ | Thrill of the Kill II | 杀戮快感 | 攻击、闪电、持续 |

### 范围与持续（23 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 仲裁者的及远 | Arbiter's Reach | 仲裁者的及远 | 血统(传奇)、增益、常驻、持续 |
| 压缩持续Ⅰ | Compressed Duration I | 压缩持续Ⅰ | 持续 |
| 压缩持续Ⅱ | Compressed Duration II | 压缩持续Ⅰ | 持续 |
| 集中区域 | Concentrated Area | 集中区域 | 范围 |
| 受控险域 | Controlled Hazard | 延迟反应 | 险域 |
| 延迟反应 | Delayed Reaction | 延迟反应 | 险域 |
| 侵进之地 | Encroaching Ground | 侵进之地 | 范围 |
| 广域 | Expanse | 裂隙之主的融合 | 范围 |
| 圣洁降临 | Holy Descent | 圣洁降临 | 范围、持续 |
| 放大区域Ⅰ | Magnified Area I | 放大区域Ⅰ | 范围 |
| 放大区域Ⅱ | Magnified Area II | 放大区域Ⅰ | 范围 |
| 贪远 | Overreach | 放大区域Ⅰ | 攻击、范围 |
| 沃拉娜的围城 | Vorana's Siege | 扩大范围·集中区域系 | 血统(传奇)、范围 |
| 延长持续Ⅰ | Prolonged Duration I | 延长持续Ⅰ | 持续 |
| 延长持续Ⅱ | Prolonged Duration II | 延长持续Ⅰ | 持续 |
| 重整武装Ⅰ | Rearm I | 重整武装Ⅰ | 险域 |
| 重整武装Ⅱ | Rearm II | 重整武装Ⅰ | 险域 |
| 感电跃击 | Shocking Leap | 感电跃击 | 范围、持续 |
| 法术叠瀑 | Spell Cascade | 法术叠瀑 | 范围 |
| 迅疾苦痛Ⅰ | Swift Affliction I | 迅疾苦痛Ⅰ | 持续 |
| 迅疾苦痛Ⅱ | Swift Affliction II | 迅疾苦痛Ⅰ | 持续 |
| 迅疾苦痛Ⅲ | Swift Affliction III | 迅疾苦痛Ⅰ | 持续 |
| 乌特雷德的仪式 | Uhtred's Rite | 乌特雷德的仪式 | 血统(传奇)、持续 |

### 资源与续航（31 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 食尸Ⅰ | Cannibalism I | 食尸Ⅰ | 增益、常驻 |
| 食尸Ⅱ | Cannibalism II | 食尸Ⅰ | 增益、常驻 |
| 清晰Ⅰ | Clarity I | 清晰Ⅰ | 增益、常驻 |
| 清晰Ⅱ | Clarity II | 清晰Ⅰ | 增益、常驻 |
| 冷静 | Cool Headed | 冷静 | 增益、常驻 |
| 无畏 | Dauntless | 无畏 | 条件 |
| 凄厉打击Ⅰ | Direstrike I | 凄厉打击Ⅰ | 增益、常驻 |
| 凄厉打击Ⅱ | Direstrike II | 凄厉打击Ⅰ | 增益、常驻 |
| 加鲁坎的决心 | Garukhan's Resolve | 加鲁坎的决心 | 血统(传奇)、攻击、条件 |
| 治疗符文 | Healing Runes | 治疗符文 | 增益、常驻 |
| 赫尔布林之皮 | Helbrym's Hide | 赫尔布林之皮 | 血统(传奇)、变形、增益 |
| 她的宣言 | Her Declaration | 她的宣言 | 血统(传奇)、增益、常驻 |
| 草药采集Ⅰ | Herbalism I | 草药采集Ⅰ | 增益、常驻 |
| 草药采集Ⅱ | Herbalism II | 草药采集Ⅰ | 增益、常驻 |
| 游击 | Hit and Run | 游击 | 攻击、条件 |
| 神秘学Ⅰ | Mysticism I | 神秘学Ⅰ | 增益、常驻 |
| 神秘学Ⅱ | Mysticism II | 神秘学Ⅰ | 增益、常驻 |
| 精准Ⅰ | Precision I | 精准Ⅰ | 增益、常驻 |
| 精准Ⅱ | Precision II | 精准Ⅰ | 增益、常驻 |
| 折射Ⅰ | Refraction I | 折射Ⅰ | 增益、常驻 |
| 折射Ⅱ | Refraction II | 折射Ⅰ | 增益、常驻 |
| 折射Ⅲ | Refraction III | 折射Ⅰ | 增益、常驻 |
| 炽天使之心 | Seraph's Heart | 炽天使之心 | 血统(传奇)、增益、常驻 |
| 强心 | Strong Hearted | 强心 | 增益、常驻 |
| 荆棘之肤Ⅰ | Thornskin I | 荆棘之肤Ⅰ | 增益、常驻 |
| 荆棘之肤Ⅱ | Thornskin II | 荆棘之肤Ⅰ | 增益、常驻 |
| 涌升Ⅰ | Upwelling I | 涌升Ⅰ | 增益、常驻 |
| 涌升Ⅱ | Upwelling II | 涌升Ⅰ | 增益、常驻 |
| 活力Ⅰ | Vitality I | 活力Ⅰ | 增益、常驻 |
| 活力Ⅱ | Vitality II | 活力Ⅰ | 增益、常驻 |
| 温血 | Warm Blooded | 温血 | 增益、常驻 |

### 通用与其他（159 条）

| 中文参考名 | 原英文名 | 家族 | 标签（中文） |
|---|---|---|---|
| 刻毒 | Acrimony | 刻毒 | — |
| 艾莉丝的风铃 | Ailith's Chimes | 艾莉丝的风铃 | 血统(传奇) |
| 琼浆 | Ambrosia | 琼浆 | — |
| 琼浆Ⅱ | Ambrosia II | 琼浆 | — |
| 埋伏 | Ambush | 埋伏 | — |
| 阿拉卡利的欲望 | Arakaali's Lust | 阿拉卡利的欲望 | 血统(传奇) |
| 甲胄粉碎Ⅰ | Armour Demolisher I | 甲胄粉碎Ⅰ | — |
| 甲胄粉碎Ⅱ | Armour Demolisher II | 甲胄粉碎Ⅰ | — |
| 一臂之距 | Arms Length | 一臂之距 | — |
| 星界投影 | Astral Projection | 星界投影 | — |
| 阿兹里的共融 | Atziri's Communion | 阿兹里的共融 | 血统(传奇)、常驻 |
| 致盲Ⅰ | Blind I | 致盲Ⅰ | — |
| 致盲Ⅱ | Blind II | 致盲Ⅰ | — |
| 掩袭 | Blindside | 掩袭 | — |
| 无穷能量Ⅰ | Boundless Energy I | 无穷能量Ⅰ | — |
| 无穷能量Ⅱ | Boundless Energy II | 无穷能量Ⅰ | — |
| 猎赏Ⅰ | Bounty I | 猎赏Ⅰ | — |
| 猎赏Ⅱ | Bounty II | 猎赏Ⅰ | — |
| 护符猎赏 | Charm Bounty | 猎赏Ⅰ | — |
| 生命猎赏 | Life Bounty | 猎赏Ⅰ | — |
| 魔力猎赏 | Mana Bounty | 猎赏Ⅰ | — |
| 绽发Ⅰ | Burgeon I | 绽发Ⅰ | 引导 |
| 绽发Ⅱ | Burgeon II | 绽发Ⅰ | 引导 |
| 节奏 | Cadence | 节奏 | 攻击 |
| 充能丰盈Ⅰ | Charge Profusion I | 充能丰盈Ⅰ | — |
| 充能丰盈Ⅱ | Charge Profusion II | 充能丰盈Ⅰ | — |
| 近身格斗Ⅰ | Close Combat I | 近身格斗Ⅰ | 攻击 |
| 近身格斗Ⅱ | Close Combat II | 近身格斗Ⅰ | 攻击 |
| 同悲 | Commiserate | 同悲 | — |
| 调制Ⅰ | Concoct I | 调制Ⅰ | — |
| 调制Ⅱ | Concoct II | 调制Ⅰ | — |
| 阿兹里的急切 | Atziri's Impatience | 阿兹里的急切 | 血统(传奇) |
| 冷却回复Ⅰ | Cooldown Recovery I | 阿兹里的急切 | — |
| 冷却回复Ⅱ | Cooldown Recovery II | 阿兹里的急切 | — |
| 尸体节约 | Corpse Conservation | 尸体节约 | — |
| 晶棱碎片 | Crystalline Shards | 晶棱碎片 | — |
| 斩杀Ⅰ | Culling Strike I | 斩杀Ⅰ | 攻击 |
| 斩杀Ⅱ | Culling Strike II | 斩杀Ⅰ | 攻击 |
| 死亡之舞 | Danse Macabre | 死亡之舞 | — |
| 违抗Ⅰ | Defy I | 违抗Ⅰ | 攻击 |
| 违抗Ⅱ | Defy II | 违抗Ⅰ | 攻击 |
| 延迟满足 | Delayed Gratification | 延迟满足 | — |
| 深思 | Deliberation | 深思 | — |
| 错乱 | Derange | 错乱 | — |
| 迪亚拉的心愿 | Dialla's Desire | 迪亚拉的心愿 | 血统(传奇) |
| 耐久 | Durability | 耐久 | — |
| 效率Ⅰ | Efficiency I | 效率Ⅰ | — |
| 效率Ⅱ | Efficiency II | 效率Ⅰ | — |
| 元素武装Ⅰ | Elemental Armament I | 元素武装Ⅰ | 攻击 |
| 元素武装Ⅱ | Elemental Armament II | 元素武装Ⅰ | 攻击 |
| 元素武装Ⅲ | Elemental Armament III | 元素武装Ⅰ | 攻击 |
| 元素集中 | Elemental Focus | 元素集中 | — |
| 持久冲击Ⅰ | Enduring Impact I | 持久冲击Ⅰ | — |
| 持久冲击Ⅱ | Enduring Impact II | 持久冲击Ⅰ | — |
| 能量电容 | Energy Capacitor | 能量电容 | — |
| 处决Ⅰ | Execute I | 处决Ⅰ | — |
| 处决Ⅱ | Execute II | 处决Ⅰ | — |
| 处决Ⅲ | Execute III | 处决Ⅰ | — |
| 凶暴 | Ferocity | 凶暴 | — |
| 分叉裂隙Ⅰ | Branching Fissures I | 分叉裂隙Ⅰ | — |
| 分叉裂隙Ⅱ | Branching Fissures II | 分叉裂隙Ⅰ | — |
| 剧变Ⅰ | Upheaval I | 分叉裂隙Ⅰ | — |
| 剧变Ⅱ | Upheaval II | 分叉裂隙Ⅰ | — |
| 阿恩的堡垒 | Ahn's Citadel | 阿恩的堡垒 | 血统(传奇) |
| 堡垒Ⅰ | Fortress I | 阿恩的堡垒 | — |
| 堡垒Ⅱ | Fortress II | 阿恩的堡垒 | — |
| 换弹如新Ⅰ | Fresh Clip I | 换弹如新Ⅰ | — |
| 换弹如新Ⅱ | Fresh Clip II | 换弹如新Ⅰ | — |
| 冰川 | Glacier | 冰川 | — |
| 饕噬 | Gorge | 饕噬 | — |
| 剔除 | Excise | 裂隙之主的融合 | — |
| 憎咒 | Execrate | 裂隙之主的融合 | — |
| 沙漏 | Hourglass | 裂隙之主的融合 | — |
| 谐振残息Ⅰ | Harmonic Remnants I | 谐振残息Ⅰ | 残息 |
| 谐振残息Ⅱ | Harmonic Remnants II | 谐振残息Ⅰ | 残息 |
| 高度精准Ⅰ | Heightened Accuracy I | 高度精准Ⅰ | 攻击 |
| 高度精准Ⅱ | Heightened Accuracy II | 高度精准Ⅰ | 攻击 |
| 冰锥 | Icicle | 冰锥 | — |
| 势不可挡暴击Ⅰ | Inexorable Critical I | 势不可挡暴击Ⅰ | — |
| 势不可挡暴击Ⅱ | Inexorable Critical II | 势不可挡暴击Ⅰ | — |
| 卡丽莎的渐强 | Kalisa's Crescendo | 卡丽莎的渐强 | 血统(传奇) |
| 卡塔尔的回春 | Khatal's Rejuvenation | 卡塔尔的回春 | 血统(传奇)、残息 |
| 击退 | Knockback | 击退 | — |
| 库莱马克的统治 | Kulemak's Dominion | 库莱马克的统治 | 血统(传奇) |
| 持久地面 | Lasting Ground | 持久地面 | — |
| 生命吸取 | Life Drain | 生命吸取 | — |
| 生命汲取 | Lifetap | 生命汲取 | — |
| 锁控 | Lockdown | 锁控 | — |
| 长引信Ⅰ | Long Fuse I | 长引信Ⅰ | — |
| 长引信Ⅱ | Long Fuse II | 长引信Ⅰ | — |
| 远程射击Ⅰ | Longshot I | 远程射击Ⅰ | 攻击 |
| 远程射击Ⅱ | Longshot II | 远程射击Ⅰ | 攻击 |
| 磁性残息 | Magnetic Remnants | 磁性残息 | — |
| 致残 | Maim | 致残 | 攻击 |
| 疾患 | Malady | 疾患 | — |
| 机动 | Mobility | 机动 | — |
| 动量 | Momentum | 动量 | — |
| 杀意 | Murderous Intent | 杀意 | — |
| 奥罗斯的信念 | Olroth's Conviction | 奥罗斯的信念 | 血统(传奇) |
| 先手 | Opening Move | 先手 | — |
| 过剩Ⅰ | Overabundance I | 过剩Ⅰ | — |
| 过剩Ⅱ | Overabundance II | 过剩Ⅰ | — |
| 冒进 | Overextend | 冒进 | 攻击 |
| 精纯耐力 | Perfected Endurance | 精纯耐力 | 引导 |
| 完美 | Perfection | 完美 | — |
| 塔萨利奥的韵律 | Tasalio's Rhythm | 完美 | 血统(传奇) |
| 永续充能 | Perpetual Charge | 永续充能 | — |
| 持久地面Ⅰ | Persistent Ground I | 持久地面Ⅰ | — |
| 持久地面Ⅱ | Persistent Ground II | 持久地面Ⅰ | — |
| 持久地面Ⅲ | Persistent Ground III | 持久地面Ⅰ | — |
| 精确暴击 | Pinpoint Critical | 精确暴击 | — |
| 十七号原型 | Prototype Seventeen | 十七号原型 | 血统(传奇) |
| 怒铸Ⅰ | Rageforged I | 怒铸Ⅰ | — |
| 怒铸Ⅱ | Rageforged II | 怒铸Ⅰ | — |
| 拉基亚塔的奔流 | Rakiata's Flow | 拉基亚塔的奔流 | 血统(传奇) |
| 迅捷攻击Ⅰ | Rapid Attacks I | 迅捷攻击Ⅰ | 攻击 |
| 迅捷攻击Ⅱ | Rapid Attacks II | 迅捷攻击Ⅰ | 攻击 |
| 迅捷攻击Ⅲ | Rapid Attacks III | 迅捷攻击Ⅰ | 攻击 |
| 无休暴怒 | Relentless Rage | 无休暴怒 | — |
| 残息增效Ⅰ | Remnant Potency I | 残息增效Ⅰ | 残息 |
| 残息增效Ⅱ | Remnant Potency II | 残息增效Ⅰ | 残息 |
| 残息增效Ⅲ | Remnant Potency III | 残息增效Ⅰ | 残息 |
| 疾风回刺 | Frenzied Riposte | 疾风回刺 | 攻击 |
| 里格瓦德的凶暴 | Rigwald's Ferocity | 里格瓦德的凶暴 | 血统(传奇)、攻击 |
| 升腾风暴 | Rising Tempest | 升腾风暴 | — |
| 符文榨取 | Runic Extraction | 符文榨取 | 残息 |
| 奥罗斯的狂妄 | Olroth's Hubris | 符文灌注 | 血统(传奇) |
| 锈刺 | Rusted Spikes | 锈刺 | — |
| 冷酷 | Ruthless | 冷酷 | — |
| 瓜特利齐的剥蚀 | Guatelitzi's Ablation | 祭献供品 | 血统(传奇) |
| 祭献供品 | Sacrificial Offering | 祭献供品 | — |
| 回气Ⅰ | Second Wind I | 回气Ⅰ | — |
| 回气Ⅱ | Second Wind II | 回气Ⅰ | — |
| 回气Ⅲ | Second Wind III | 回气Ⅰ | — |
| 乌特雷德的星阵 | Uhtred's Constellation | 回气Ⅰ | 血统(传奇) |
| 无私残息 | Selfless Remnants | 无私残息 | 残息 |
| 短引信Ⅰ | Short Fuse I | 短引信Ⅰ | — |
| 短引信Ⅱ | Short Fuse II | 短引信Ⅰ | — |
| 灵魂吸取 | Soul Drain | 灵魂吸取 | — |
| 坚定Ⅰ | Steadfast I | 坚定Ⅰ | 引导 |
| 坚定Ⅱ | Steadfast II | 坚定Ⅰ | 引导 |
| 泰然Ⅰ | Stoicism I | 泰然Ⅰ | — |
| 泰然Ⅱ | Stoicism II | 泰然Ⅰ | — |
| 眩晕Ⅰ | Stun I | 眩晕Ⅰ | — |
| 眩晕Ⅱ | Stun II | 眩晕Ⅰ | — |
| 眩晕Ⅲ | Stun III | 眩晕Ⅰ | — |
| 斯特恩之山 | Styrn's Mountain | 斯特恩之山 | 血统(传奇) |
| 超临界 | Supercritical | 超临界 | — |
| 充能强化 | Heightened Charges | 充能强化 | — |
| 乌特雷德的预兆 | Uhtred's Augury | 乌特雷德的预兆 | 血统(传奇) |
| 乌特雷德的迁徙 | Uhtred's Exodus | 乌特雷德的预兆 | 血统(传奇) |
| 乌特雷德的征兆 | Uhtred's Omen | 乌特雷德的预兆 | 血统(传奇) |
| 精准之力 | Unerring Power | 精准之力 | 攻击 |
| 难以触及 | Untouchable | 难以触及 | 攻击 |
| 先锋Ⅰ | Vanguard I | 先锋Ⅰ | — |
| 先锋Ⅱ | Vanguard II | 先锋Ⅰ | — |
| 瓦拉沙的祝福 | Varashta's Blessing | 瓦拉沙的祝福 | 血统(传奇) |
| 机会之窗Ⅰ | Window of Opportunity I | 机会之窗Ⅰ | 引导 |
| 机会之窗Ⅱ | Window of Opportunity II | 机会之窗Ⅰ | 引导 |
