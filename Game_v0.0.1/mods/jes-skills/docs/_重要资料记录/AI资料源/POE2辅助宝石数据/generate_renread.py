# -*- coding: utf-8 -*-
"""POE2 辅助宝石数据 → 人读版生成器
输入：POE2辅助宝石全集_PoB2数据_v1.md（机器格式，英文名+标签+ID）
输出：docs/_重要资料记录/人工查阅/POE2辅助宝石_人读版_v1.md
译名口径：参考意译（非官方国服译名）；数据本身不含效果描述与逐级数值。
"""
import io, re, os, collections

SRC = "mods/jes-skills/docs/_重要资料记录/AI资料源/POE2辅助宝石数据/POE2辅助宝石全集_PoB2数据_v1.md"
OUT_DIR = "mods/jes-skills/docs/_重要资料记录/人工查阅"
OUT = os.path.join(OUT_DIR, "POE2辅助宝石_人读版_v1.md")

# ---------- 标签中文对照 ----------
TAG_CN = {
    "Ammunition": "弹药", "AoE": "范围", "Attack": "攻击", "Banner": "旗帜",
    "Buff": "增益", "Chaining": "连锁", "Channelling": "引导", "Chaos": "混沌",
    "Cold": "冰霜", "Command": "号令", "Conditional": "条件", "Curse": "诅咒",
    "Duration": "持续", "Fire": "火焰", "Grenade": "手雷", "Hazard": "险域",
    "Herald": "战旗", "Lightning": "闪电", "Lineage": "血统(传奇)",
    "Mark": "印记", "Melee": "近战", "Minion": "随从", "Payoff": "结算",
    "Persistent": "常驻", "Physical": "物理", "Plant": "草木",
    "Projectile": "投射物", "Remnant": "残息", "Shapeshift": "变形",
    "Slam": "猛击", "Spell": "法术", "Staged": "段式", "Storm": "风暴",
    "Strike": "打击", "Sustained": "续航", "Totem": "图腾", "Trigger": "触发",
    "Warcry": "战吼",
}

# ---------- 分类优先级（家族按聚合标签归类，先命中优先） ----------
CATEGORY_RULES = [
    ("召唤与随从", ["Minion"]),
    ("图腾", ["Totem"]),
    ("旗帜与战旗", ["Banner", "Herald"]),
    ("战吼与号令", ["Warcry", "Command"]),
    ("诅咒、咒言与印记", ["Curse", "Mark"]),
    ("弹药与手雷", ["Ammunition", "Grenade"]),
    ("投射物", ["Projectile"]),
    ("近战打击", ["Melee", "Strike", "Slam"]),
    ("法术施放", ["Spell"]),
    ("触发与结算", ["Trigger", "Payoff"]),
    ("物理、流血与中毒", ["Physical"]),
    ("混沌与毒系", ["Chaos"]),
    ("火焰", ["Fire"]),
    ("冰霜", ["Cold"]),
    ("闪电与风暴", ["Lightning", "Storm"]),
    ("范围与持续", ["AoE", "Duration", "Hazard"]),
    ("资源与续航", ["Buff", "Sustained", "Conditional"]),
]

CATEGORY_ORDER = [c for c, _ in CATEGORY_RULES] + ["通用与其他"]
CAT_DESC = {
    "召唤与随从": "强化随从的伤害、生存、体型与行为",
    "图腾": "放置图腾类技能的放置、强化与回收",
    "旗帜与战旗": "常驻或插旗式团队增益",
    "战吼与号令": "战吼强化、号令联动与怒气体系",
    "诅咒、咒言与印记": "给敌人上诅咒/印记并强化其效果",
    "弹药与手雷": "弩/猎枪的弹药管理、手雷投掷强化",
    "投射物": "投射物数量、弹道、穿透、跳弹与速度",
    "近战打击": "近战打击/猛击的范围、连锁与眩晕",
    "法术施放": "施法速度、回响、封印与层叠",
    "触发与结算": "触发机制、延迟结算与标记 payoff",
    "物理、流血与中毒": "物理伤害与创伤类异常",
    "混沌与毒系": "混沌伤害与毒系异常",
    "火焰": "点燃、燃烧与火焰穿透/易伤",
    "冰霜": "冰冻、冰缓与冰霜穿透/易伤",
    "闪电与风暴": "感电、闪电穿透与易伤",
    "范围与持续": "范围扩大/缩小、持续时间增减",
    "资源与续航": "魔力/生命回复、偷取、充能与冷却",
    "通用与其他": "无法归入上述类别的家族",
}

# ---------- 宝石名中文参考译名（567 条，意译口径） ----------
NAME_CN = {
 "Abiding Hex": "持驻咒言", "Accelerated Growth": "加速生长", "Accelerated Growth II": "加速生长Ⅱ",
 "Acrimony": "刻毒", "Adhesive Grenades I": "黏着手雷Ⅰ", "Adhesive Grenades II": "黏着手雷Ⅱ",
 "Admixture": "调和", "Advancing Storm": "推进风暴", "Aftershock I": "余震Ⅰ", "Aftershock II": "余震Ⅱ",
 "Ahn's Citadel": "阿恩的堡垒", "Ailith's Chimes": "艾莉丝的风铃", "Alignment I": "校准Ⅰ",
 "Alignment II": "校准Ⅱ", "Alignment III": "校准Ⅲ", "Amanamu's Tithe": "阿玛纳穆的贡赋",
 "Ambrosia": "琼浆", "Ambrosia II": "琼浆Ⅱ", "Ambush": "埋伏", "Ammo Conservation I": "弹药节约Ⅰ",
 "Ammo Conservation II": "弹药节约Ⅱ", "Ammo Conservation III": "弹药节约Ⅲ",
 "Ancestral Aid": "先祖援助", "Ancestral Call I": "先祖召唤Ⅰ", "Ancestral Call II": "先祖召唤Ⅱ",
 "Arakaali's Lust": "阿拉卡利的欲望", "Arbiter's Ignition": "仲裁者的点燃", "Arbiter's Reach": "仲裁者的及远",
 "Arcane Surge": "奥术涌动", "Arjun's Medal": "阿尔君的勋章", "Armour Break I": "破甲Ⅰ",
 "Armour Break II": "破甲Ⅱ", "Armour Break III": "破甲Ⅲ", "Armour Demolisher I": "甲胄粉碎Ⅰ",
 "Armour Demolisher II": "甲胄粉碎Ⅱ", "Armour Explosion": "护甲爆裂", "Arms Length": "一臂之距",
 "Astral Projection": "星界投影", "Atalui's Bloodletting": "阿塔露伊的放血",
 "Atziri's Allure": "阿兹里的魅惑", "Atziri's Communion": "阿兹里的共融",
 "Atziri's Impatience": "阿兹里的急切", "Auto Reload": "自动装填", "Barbs I": "倒刺Ⅰ",
 "Barbs II": "倒刺Ⅱ", "Barbs III": "倒刺Ⅲ", "Battershout": "碎喝", "Behead I": "斩首Ⅰ",
 "Behead II": "斩首Ⅱ", "Bhatair's Vengeance": "巴泰尔的复仇", "Bidding I": "嘱令Ⅰ",
 "Bidding II": "嘱令Ⅱ", "Bidding III": "嘱令Ⅲ", "Biting Frost I": "凛霜噬骨Ⅰ",
 "Biting Frost II": "凛霜噬骨Ⅱ", "Blazing Critical": "炽焰暴击", "Bleed I": "流血Ⅰ",
 "Bleed II": "流血Ⅱ", "Bleed III": "流血Ⅲ", "Bleed IV": "流血Ⅳ", "Blind I": "致盲Ⅰ",
 "Blind II": "致盲Ⅱ", "Blindside": "掩袭", "Bloodlust": "嗜血", "Bone Shrapnel": "骨片飞溅",
 "Boundless Energy I": "无穷能量Ⅰ", "Boundless Energy II": "无穷能量Ⅱ", "Bounty I": "猎赏Ⅰ",
 "Bounty II": "猎赏Ⅱ", "Brambleslam": "荆棘猛击", "Branching Fissures I": "分叉裂隙Ⅰ",
 "Branching Fissures II": "分叉裂隙Ⅱ", "Breachlord's Amalgam": "裂隙之主的融合",
 "Breachlord's Rift": "裂隙之主的裂口", "Brink I": "濒界Ⅰ", "Brink II": "濒界Ⅱ",
 "Brittle Armour": "脆化护甲", "Brutality I": "残暴Ⅰ", "Brutality II": "残暴Ⅱ",
 "Brutality III": "残暴Ⅲ", "Brutus' Brain": "布鲁图斯之脑", "Burgeon I": "绽发Ⅰ",
 "Burgeon II": "绽发Ⅱ", "Burning Inscription": "燃烧铭刻", "Bursting Plague": "迸裂瘟疫",
 "Cadence": "节奏", "Caltrops": "铁蒺藜", "Cannibalism I": "食尸Ⅰ", "Cannibalism II": "食尸Ⅱ",
 "Catalysing Elements": "元素催化", "Catha's Brilliance": "卡莎的辉光", "Catharsis": "宣泄",
 "Chain I": "连锁Ⅰ", "Chain II": "连锁Ⅱ", "Chain III": "连锁Ⅲ", "Chaos Attunement": "混沌调谐",
 "Chaos Mastery": "混沌专精", "Chaotic Freeze": "混沌冰冻", "Charge Profusion I": "充能丰盈Ⅰ",
 "Charge Profusion II": "充能丰盈Ⅱ", "Charged Mark": "充能印记", "Charged Shots I": "蓄能射击Ⅰ",
 "Charged Shots II": "蓄能射击Ⅱ", "Charm Bounty": "护符猎赏", "Cirel's Cultivation": "西瑞尔的培育",
 "Clarity I": "清晰Ⅰ", "Clarity II": "清晰Ⅱ", "Clash": "碰撞", "Close Combat I": "近身格斗Ⅰ",
 "Close Combat II": "近身格斗Ⅱ", "Cold Attunement": "冰霜调谐", "Cold Exposure": "冰霜易伤",
 "Cold Mastery": "冰霜专精", "Cold Penetration": "冰霜穿透", "Combo Finisher I": "连段终结Ⅰ",
 "Combo Finisher II": "连段终结Ⅱ", "Commandment": "诫命", "Commiserate": "同悲",
 "Compressed Duration I": "压缩持续Ⅰ", "Compressed Duration II": "压缩持续Ⅱ",
 "Concentrated Area": "集中区域", "Concoct I": "调制Ⅰ", "Concoct II": "调制Ⅱ",
 "Concussive Runes": "震荡符文", "Concussive Spells": "震荡法术", "Considered Casting": "审慎施法",
 "Controlled Destruction": "受控毁灭", "Controlled Hazard": "受控险域", "Cool Headed": "冷静",
 "Cooldown Recovery I": "冷却回复Ⅰ", "Cooldown Recovery II": "冷却回复Ⅱ",
 "Corpse Conservation": "尸体节约", "Corrosion": "腐蚀", "Corrupting Cry I": "腐化战吼Ⅰ",
 "Corrupting Cry II": "腐化战吼Ⅱ", "Coursing Current": "奔涌电流", "Crackling Barrier": "噼啪屏障",
 "Crater": "弹坑", "Crazed Minions": "狂乱随从", "Creeping Chill": "蔓延寒意",
 "Crescendo I": "渐强Ⅰ", "Crescendo II": "渐强Ⅱ", "Crescendo III": "渐强Ⅲ",
 "Crystalline Shards": "晶棱碎片", "Culling Strike I": "斩杀Ⅰ", "Culling Strike II": "斩杀Ⅱ",
 "Culmination I": "圆满Ⅰ", "Culmination II": "圆满Ⅱ", "Cursed Ground": "诅咒之地",
 "Danse Macabre": "死亡之舞", "Daresso's Passion": "达瑞索的激情", "Dauntless": "无畏",
 "Daze": "恍惚", "Deadly Herald": "致命之捷", "Deadly Poison I": "剧毒Ⅰ",
 "Deadly Poison II": "剧毒Ⅱ", "Deadly Resolve": "刚毅决心", "Deathmarch": "死亡进军",
 "Decaying Hex": "腐朽咒言", "Deep Cuts I": "深创Ⅰ", "Deep Cuts II": "深创Ⅱ",
 "Deep Freeze": "深度冰冻", "Defy I": "违抗Ⅰ", "Defy II": "违抗Ⅱ",
 "Delayed Gratification": "延迟满足", "Delayed Reaction": "延迟反应", "Deliberation": "深思",
 "Derange": "错乱", "Dialla's Desire": "迪亚拉的心愿", "Direstrike I": "凄厉打击Ⅰ",
 "Direstrike II": "凄厉打击Ⅱ", "Doedre's Undoing": "多德里多的作祟",
 "Dominus' Grasp": "多米努斯的掌握", "Double Barrel I": "双管齐发Ⅰ", "Double Barrel II": "双管齐发Ⅱ",
 "Double Barrel III": "双管齐发Ⅲ", "Drain Ailments": "抽纳异常", "Durability": "耐久",
 "Echoing Cry": "回响战吼", "Efficiency I": "效率Ⅰ", "Efficiency II": "效率Ⅱ",
 "Einhar's Beastrite": "埃尼哈的驯兽之晶", "Electrocute": "电殛", "Electromagnetism": "电磁",
 "Elemental Armament I": "元素武装Ⅰ", "Elemental Armament II": "元素武装Ⅱ",
 "Elemental Armament III": "元素武装Ⅲ", "Elemental Army": "元素军团",
 "Elemental Discharge": "元素宣泄", "Elemental Focus": "元素集中", "Embitter": "怨愤",
 "Empowered Sparks I": "火花增幅Ⅰ", "Encroaching Ground": "侵进之地",
 "Enduring Impact I": "持久冲击Ⅰ", "Enduring Impact II": "持久冲击Ⅱ", "Energy Capacitor": "能量电容",
 "Energy Retention": "能量存续", "Enraged Warcry I": "激怒战吼Ⅰ", "Enraged Warcry II": "激怒战吼Ⅱ",
 "Eonyr's Thunder": "埃奥尼尔的雷霆", "Escalating Poison": "递增剧毒", "Esh's Prowess": "艾许的精通",
 "Esh's Radiance": "艾许的光辉", "Essence Harvest": "精华收割", "Eternal Flame I": "永恒之焰Ⅰ",
 "Eternal Flame II": "永恒之焰Ⅱ", "Eternal Flame III": "永恒之焰Ⅲ", "Eternal Mark": "永恒印记",
 "Excise": "剔除", "Execrate": "憎咒", "Execute I": "处决Ⅰ", "Execute II": "处决Ⅱ",
 "Execute III": "处决Ⅲ", "Expand": "扩张", "Expanse": "广域", "Exploit Weakness": "弱点利用",
 "Exposing Cry": "破绽战吼", "Extraction": "榨取", "Fan The Flames": "火上浇油",
 "Fan The Flames II": "火上浇油Ⅱ", "Feeding Frenzy I": "饲喂狂热Ⅰ", "Feeding Frenzy II": "饲喂狂热Ⅱ",
 "Ferocity": "凶暴", "Fiery Death": "火中送葬", "Fire Attunement": "火焰调谐",
 "Fire Exposure": "火焰易伤", "Fire Mastery": "火焰专精", "Fire Penetration I": "火焰穿透Ⅰ",
 "Fire Penetration II": "火焰穿透Ⅱ", "Fist Of Kalguur": "卡尔古之拳", "Fist of War I": "战争之拳Ⅰ",
 "Fist of War II": "战争之拳Ⅱ", "Fist of War III": "战争之拳Ⅲ", "Flame Pillar": "火焰之柱",
 "Flamepierce": "燃火穿刺", "Fluke": "侥幸", "Focused Curse": "集中诅咒",
 "Font of Blood": "血之源泉", "Font of Mana": "魔力源泉", "Fork": "叉射", "Fortress I": "堡垒Ⅰ",
 "Fortress II": "堡垒Ⅱ", "Freeze": "冰冻", "Freezefork": "冰霜叉射", "Frenzied Riposte": "疾风回刺",
 "Fresh Clip I": "换弹如新Ⅰ", "Fresh Clip II": "换弹如新Ⅱ", "Frost Nexus": "霜寒枢纽",
 "Frostfire": "霜火", "Frozen Spite": "冰冻怨毒", "Gambleshot": "赌命射击",
 "Garukhan's Resolve": "加鲁坎的决心", "Glacier": "冰川", "Gorge": "饕噬",
 "Guatelitzi's Ablation": "瓜特利齐的剥蚀", "Haemocrystals": "血晶", "Hardy Totems I": "强韧图腾Ⅰ",
 "Hardy Totems II": "强韧图腾Ⅱ", "Harmonic Remnants I": "谐振残息Ⅰ", "Harmonic Remnants II": "谐振残息Ⅱ",
 "Hayoxi's Fulmination": "哈约西的雷殛", "Healing Runes": "治疗符文", "Heavy Swing": "重挥",
 "Heft": "厚重", "Heightened Accuracy I": "高度精准Ⅰ", "Heightened Accuracy II": "高度精准Ⅱ",
 "Heightened Charges": "充能强化", "Heightened Curse": "诅咒强化", "Helbrym's Hide": "赫尔布林之皮",
 "Her Declaration": "她的宣言", "Herbalism I": "草药采集Ⅰ", "Herbalism II": "草药采集Ⅱ",
 "Hex Bloom": "咒言绽放", "Hit and Run": "游击", "Holy Descent": "圣洁降临", "Hourglass": "沙漏",
 "Hulking Minions": "魁梧随从", "Ice Bite I": "冰噬Ⅰ", "Ice Bite II": "冰噬Ⅱ",
 "Icicle": "冰锥", "Ignite I": "点燃Ⅰ", "Ignite II": "点燃Ⅱ", "Ignite III": "点燃Ⅲ",
 "Immolate": "焚身", "Impact Shockwave": "冲击震荡波", "Impale": "戳刺",
 "Impending Doom": "末日将至", "Incision": "切割", "Inexorable Critical I": "势不可挡暴击Ⅰ",
 "Inexorable Critical II": "势不可挡暴击Ⅱ", "Infernal Legion I": "炼狱军团Ⅰ",
 "Infernal Legion II": "炼狱军团Ⅱ", "Infernal Legion III": "炼狱军团Ⅲ", "Inhibitor": "抑制者",
 "Innervate": "神经激发", "Intense Agony": "剧烈苦痛", "Ixchel's Torment": "伊克切尔的折磨",
 "Jagged Ground I": "碎棱之地Ⅰ", "Jagged Ground II": "碎棱之地Ⅱ", "Kalisa's Crescendo": "卡丽莎的渐强",
 "Kaom's Madness": "卡欧的疯狂", "Khatal's Rejuvenation": "卡塔尔的回春", "Knockback": "击退",
 "Kulemak's Dominion": "库莱马克的统治", "Kurgal's Leash": "库尔加尔的锁链",
 "Last Gasp": "回光返照", "Lasting Ground": "持久地面", "Lasting Shock": "持久感电",
 "Life Bounty": "生命猎赏", "Life Drain": "生命吸取", "Life Leech I": "生命偷取Ⅰ",
 "Life Leech II": "生命偷取Ⅱ", "Life Leech III": "生命偷取Ⅲ", "Lifetap": "生命汲取",
 "Lightning Attunement": "闪电调谐", "Lightning Exposure": "闪电易伤",
 "Lightning Mastery": "闪电专精", "Lightning Penetration": "闪电穿透",
 "Living Lightning": "活体闪电", "Living Lightning II": "活体闪电Ⅱ", "Lockdown": "锁控",
 "Long Fuse I": "长引信Ⅰ", "Long Fuse II": "长引信Ⅱ", "Longshot I": "远程射击Ⅰ",
 "Longshot II": "远程射击Ⅱ", "Loyalty": "忠诚", "Magnetic Remnants": "磁性残息",
 "Magnified Area I": "放大区域Ⅰ", "Magnified Area II": "放大区域Ⅱ", "Maim": "致残",
 "Malady": "疾患", "Mana Bounty": "魔力猎赏", "Mana Flare": "魔力闪光", "Mana Leech": "魔力偷取",
 "Mark for Death": "死刑标记", "Mark for Death II": "死刑标记Ⅱ", "Mark of Siphoning": "虹吸印记",
 "Mark of Siphoning II": "虹吸印记Ⅱ", "Meat Shield I": "肉盾Ⅰ", "Meat Shield II": "肉盾Ⅱ",
 "Medved's Felling": "梅德维的伐斩", "Minion Instability": "随从不稳定",
 "Minion Mastery": "随从专精", "Minion Pact I": "随从契约Ⅰ", "Minion Pact II": "随从契约Ⅱ",
 "Minion Splash I": "随从泼溅Ⅰ", "Minion Splash II": "随从泼溅Ⅱ", "Mobility": "机动",
 "Momentum": "动量", "Morgana's Tempest": "摩根娜的风暴", "Morrigan's Insight": "莫瑞甘的洞悉",
 "Multishot I": "多重射击Ⅰ", "Multishot II": "多重射击Ⅱ", "Murderous Intent": "杀意",
 "Muster": "集结", "Mysticism I": "神秘学Ⅰ", "Mysticism II": "神秘学Ⅱ",
 "Neural Overload": "神经过载", "Nimble Reload": "灵巧装填", "Nova Projectiles I": "新星投射Ⅰ",
 "Nova Projectiles II": "新星投射Ⅱ", "Oisin's Oath": "奥辛的誓言",
 "Olroth's Conviction": "奥罗斯的信念", "Olroth's Hubris": "奥罗斯的狂妄",
 "Opening Move": "先手", "Overabundance I": "过剩Ⅰ", "Overabundance II": "过剩Ⅱ",
 "Overcharge": "过载", "Overextend": "冒进", "Overreach": "贪远",
 "Paquate's Pact": "帕夸特的契约", "Payload": "载荷", "Perfected Endurance": "精纯耐力",
 "Perfection": "完美", "Perpetual Charge": "永续充能", "Persistent Ground I": "持久地面Ⅰ",
 "Persistent Ground II": "持久地面Ⅱ", "Persistent Ground III": "持久地面Ⅲ",
 "Physical Mastery": "物理专精", "Pierce I": "穿透Ⅰ", "Pierce II": "穿透Ⅱ", "Pierce III": "穿透Ⅲ",
 "Pin I": "钉固Ⅰ", "Pin II": "钉固Ⅱ", "Pin III": "钉固Ⅲ", "Pinpoint Critical": "精确暴击",
 "Poison I": "毒化Ⅰ", "Poison II": "毒化Ⅱ", "Poison III": "毒化Ⅲ", "Poison Spores": "毒孢子",
 "Potent Exposure": "强效易伤", "Practical Magic I": "实用魔法Ⅰ", "Practical Magic II": "实用魔法Ⅱ",
 "Practiced Combo": "熟练连段", "Precision I": "精准Ⅰ", "Precision II": "精准Ⅱ",
 "Profanity I": "亵渎Ⅰ", "Profanity II": "亵渎Ⅱ", "Projectile Acceleration I": "投射物加速Ⅰ",
 "Projectile Acceleration II": "投射物加速Ⅱ", "Projectile Acceleration III": "投射物加速Ⅲ",
 "Projectile Deceleration I": "投射物减速Ⅰ", "Projectile Deceleration II": "投射物减速Ⅱ",
 "Prolonged Duration I": "延长持续Ⅰ", "Prolonged Duration II": "延长持续Ⅱ",
 "Prototype Seventeen": "十七号原型", "Punch Through": "凿穿", "Pursuit I": "追击Ⅰ",
 "Pursuit II": "追击Ⅱ", "Pursuit III": "追击Ⅲ", "Quill Burst": "羽刺迸发",
 "Rage I": "暴怒Ⅰ", "Rage II": "暴怒Ⅱ", "Rage III": "暴怒Ⅲ", "Rageforged I": "怒铸Ⅰ",
 "Rageforged II": "怒铸Ⅱ", "Raging Cry": "狂怒之吼", "Rakiata's Flow": "拉基亚塔的奔流",
 "Rapid Attacks I": "迅捷攻击Ⅰ", "Rapid Attacks II": "迅捷攻击Ⅱ", "Rapid Attacks III": "迅捷攻击Ⅲ",
 "Rapid Casting I": "迅捷施法Ⅰ", "Rapid Casting II": "迅捷施法Ⅱ", "Rapid Casting III": "迅捷施法Ⅲ",
 "Ratha's Assault": "拉莎的强袭", "Rearm I": "重整武装Ⅰ", "Rearm II": "重整武装Ⅱ",
 "Refraction I": "折射Ⅰ", "Refraction II": "折射Ⅱ", "Refraction III": "折射Ⅲ",
 "Reinforced Totems I": "强化图腾Ⅰ", "Reinforced Totems II": "强化图腾Ⅱ",
 "Relentless Rage": "无休暴怒", "Remnant Potency I": "残息增效Ⅰ", "Remnant Potency II": "残息增效Ⅱ",
 "Remnant Potency III": "残息增效Ⅲ", "Rending Apex": "撕裂之巅", "Retaliate I": "还击Ⅰ",
 "Retaliate II": "还击Ⅱ", "Retreat I": "撤退Ⅰ", "Retreat II": "撤退Ⅱ", "Retreat III": "撤退Ⅲ",
 "Reverberate": "回荡", "Ricochet I": "跳弹Ⅰ", "Ricochet II": "跳弹Ⅱ",
 "Rigwald's Ferocity": "里格瓦德的凶暴", "Rip": "撕裂", "Rising Tempest": "升腾风暴",
 "Ritualistic Curse": "仪式诅咒", "Romira's Requital": "罗米拉的回报",
 "Runeforged Blades": "符文锻刃", "Runic Extraction": "符文榨取", "Runic Infusion": "符文灌注",
 "Rupture": "破裂", "Rusted Spikes": "锈刺", "Ruthless": "冷酷",
 "Sacrificial Lamb I": "祭献羔羊Ⅰ", "Sacrificial Lamb II": "祭献羔羊Ⅱ",
 "Sacrificial Offering": "祭献供品", "Salvo": "齐射", "Scouring Flame": "涤荡之焰",
 "Searing Flame I": "灼烧之焰Ⅰ", "Searing Flame II": "灼烧之焰Ⅱ", "Second Wind I": "回气Ⅰ",
 "Second Wind II": "回气Ⅱ", "Second Wind III": "回气Ⅲ", "Selfless Remnants": "无私残息",
 "Seraph's Heart": "炽天使之心", "Shock": "感电", "Shock Conduction": "感电传导",
 "Shock Conduction II": "感电传导Ⅱ", "Shock Siphon": "感电虹吸", "Shocking Leap": "感电跃击",
 "Short Fuse I": "短引信Ⅰ", "Short Fuse II": "短引信Ⅱ", "Sione's Temper": "西恩的怒火",
 "Skittering Stone I": "疾走之石Ⅰ", "Skittering Stone II": "疾走之石Ⅱ", "Slow Potency": "缓速增效",
 "Soul Drain": "灵魂吸取", "Spar": "切磋", "Spectral Volley": "幽灵齐射",
 "Spell Cascade": "法术叠瀑", "Spell Echo": "法术回响", "Splinter Totem I": "裂片图腾Ⅰ",
 "Splinter Totem II": "裂片图腾Ⅱ", "Static Shocks": "静电冲击", "Steadfast I": "坚定Ⅰ",
 "Steadfast II": "坚定Ⅱ", "Stoicism I": "泰然Ⅰ", "Stoicism II": "泰然Ⅱ",
 "Stomping Ground": "践踏之地", "Stormchain": "风暴锁链", "Stormfire": "风暴之火",
 "Streamlined Rounds": "流线弹丸", "Strong Hearted": "强心", "Stun I": "眩晕Ⅰ",
 "Stun II": "眩晕Ⅱ", "Stun III": "眩晕Ⅲ", "Styrn's Ferocity": "斯特恩的凶暴",
 "Styrn's Mountain": "斯特恩之山", "Supercritical": "超临界",
 "Swift Affliction I": "迅疾苦痛Ⅰ", "Swift Affliction II": "迅疾苦痛Ⅱ",
 "Swift Affliction III": "迅疾苦痛Ⅲ", "Syzygy": "朔望", "Tacati's Ire": "塔卡蒂的怒火",
 "Tangmazu's Thurible": "坦玛祖的香炉", "Tasalio's Rhythm": "塔萨利奥的韵律",
 "Tawhoa's Tending": "塔沃亚的照料", "Tear": "割裂", "Tecrod's Revenge": "特克洛德的复仇",
 "Tectonic Slams": "构造猛击", "Thornskin I": "荆棘之肤Ⅰ", "Thornskin II": "荆棘之肤Ⅱ",
 "Thrill of the Kill": "杀戮快感", "Thrill of the Kill II": "杀戮快感Ⅱ", "Tireless": "不倦",
 "Trickster's Shard": "骗徒碎片", "Tul's Avalanche": "图尔的雪崩", "Tul's Stillness": "图尔的静滞",
 "Uhtred's Augury": "乌特雷德的预兆", "Uhtred's Constellation": "乌特雷德的星阵",
 "Uhtred's Exodus": "乌特雷德的迁徙", "Uhtred's Omen": "乌特雷德的征兆",
 "Uhtred's Rite": "乌特雷德的仪式", "Undermine": "掘蚀", "Unerring Power": "精准之力",
 "Unleash": "解放", "Untouchable": "难以触及", "Upheaval I": "剧变Ⅰ", "Upheaval II": "剧变Ⅱ",
 "Upwelling I": "涌升Ⅰ", "Upwelling II": "涌升Ⅱ", "Urgent Totems I": "急速图腾Ⅰ",
 "Urgent Totems II": "急速图腾Ⅱ", "Urgent Totems III": "急速图腾Ⅲ", "Uruk's Smelting": "乌鲁克的熔炼",
 "Uul-Netol's Embrace": "乌尔尼托的怀抱", "Vanguard I": "先锋Ⅰ", "Vanguard II": "先锋Ⅱ",
 "Varashta's Blessing": "瓦拉沙的祝福", "Verglas": "冰壳", "Vilenta's Propulsion": "维伦塔的推进",
 "Vitality I": "活力Ⅰ", "Vitality II": "活力Ⅱ", "Volatility": "不稳定性",
 "Volcanic Eruption": "火山喷发", "Volt": "电势", "Vorana's Siege": "沃拉娜的围城",
 "Vruun's Aftermath": "弗鲁恩的余波", "Vruun's Inevitability": "弗鲁恩的必然",
 "Warm Blooded": "温血", "Wildfire": "野火", "Wildshards I": "野性碎片Ⅰ",
 "Wildshards II": "野性碎片Ⅱ", "Wind Wave": "风之波", "Window of Opportunity I": "机会之窗Ⅰ",
 "Window of Opportunity II": "机会之窗Ⅱ", "Withering Touch": "凋零之触",
 "Xibaqua's Rending": "希巴夸的撕裂", "Xoph's Pyre": "佐夫的火堆",
 "Zarokh's Refrain": "扎洛克的叠唱", "Zarokh's Revolt": "扎洛克的反叛",
 "Zenith I": "天顶Ⅰ", "Zenith II": "天顶Ⅱ", "Zerphi's Infamy": "泽菲的恶名",
}

# 家族名中文：优先查覆盖表（家族名与宝石名不一致/复合家族），再试家族名直译，
# 再退化用首条宝石译名去罗马数字。
FAM_CN_OVERRIDES = {
    "(无家族)": "(未归家族)",
    "Mastery": "专精系",
    "Additional Projectiles": "附加投射物系",
    "Additional Projectiles, Nova Projectiles": "附加投射物·新星投射系",
    "Additional Projectiles, Seal": "附加投射物·封印系",
    "Alignment, Additional Projectiles": "校准·附加投射物系",
    "Advancing Storm, Overabundance": "推进风暴·过剩系",
    "Double Barrel, Rapid Attacks": "双管齐发·迅捷攻击系",
    "Increased Area of Effect, Concentrated Area": "扩大范围·集中区域系",
    "Seal, Increased Area of Effect": "封印·扩大范围系",
}

ROMAN = re.compile(r"\s*(?:I|II|III|IV)$")

def fam_cn(entries, family):
    if family in FAM_CN_OVERRIDES:
        return FAM_CN_OVERRIDES[family]
    direct = NAME_CN.get(family)
    if direct:
        return ROMAN.sub("", direct)
    first = entries[0]["name"]
    base = ROMAN.sub("", first)
    cn = NAME_CN.get(first) or NAME_CN.get(base)
    if cn:
        return ROMAN.sub("", cn)
    return "(待译)"

def classify(tags):
    for cat, keys in CATEGORY_RULES:
        for k in keys:
            if k in tags:
                return cat
    return "通用与其他"

def main():
    text = io.open(SRC, encoding="utf-8").read()
    detail = text.split("## 明细")[1]
    families = collections.OrderedDict()
    cur = None
    for line in detail.splitlines():
        m = re.match(r"^### (.+)$", line)
        if m:
            cur = m.group(1).strip()
            families.setdefault(cur, [])
            continue
        m = re.match(r"^\| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", line)
        if m and m.group(1).strip() != "名称":
            name, tier, tags_s = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
            tags = [t.strip() for t in tags_s.split(",") if t.strip() and t.strip() != "标签"]
            families[cur].append({"name": name, "tier": tier, "tags": tags,
                                  "ids": (m.group(5).strip(), m.group(6).strip())})

    total = sum(len(v) for v in families.values())
    assert total == 567, "条目数异常: %d" % total

    # 分类：按每条宝石自身标签归类（同一家族可跨类），家族中文按覆盖表/直译
    entry_cat = {}
    cat_fams = collections.OrderedDict((c, set()) for c in CATEGORY_ORDER)
    for fam, entries in families.items():
        for e in entries:
            cat = classify(set(e["tags"]))
            entry_cat[e["name"]] = cat
            cat_fams[cat].add(fam)

    lines = []
    ap = lines.append
    ap("# POE2 辅助宝石全集 · 人读版 v1")
    ap("")
    ap("> **用途**：人工翻阅参考。数据与 `AI资料源/POE2辅助宝石数据/` 同源（PoB2 Gems.lua，2026-10-22 抓取），")
    ap("> 机器查证仍以原文件为准，本文件是它的中文重排版，**不是施工依据**。")
    ap("")
    ap("> **译名口径**：全部为**参考意译**，非官方国服译名；如需精确名称以英文原名为准。")
    ap("> **数据边界**：PoB2 Gems.lua 只含元数据（名称/标签/家族/ID），**不含效果描述与逐级数值**，")
    ap("> 效果数值需另行抓取 granted effects / stat descriptions（见资料夹索引「已知边界」）。")
    ap("")
    ap("- 条目总数：567｜家族总数：351｜分类数：%d" % sum(1 for c in CATEGORY_ORDER if cat_fams[c]))
    ap("")
    ap("## 一、标签中文对照（38 个）")
    ap("")
    ap("| 英文标签 | 中文 | 英文标签 | 中文 |")
    ap("|---|---|---|---|")
    items = sorted(TAG_CN.items())
    half = (len(items) + 1) // 2
    for i in range(half):
        l = items[i]
        r = items[i + half] if i + half < len(items) else ("", "")
        ap("| %s | %s | %s | %s |" % (l[0], l[1], r[0], r[1]))
    ap("")
    ap("## 二、分类总览")
    ap("")
    ap("| 分类 | 定位 | 家族数 | 宝石数 |")
    ap("|---|---|---|---|")
    for cat in CATEGORY_ORDER:
        fams = cat_fams[cat]
        n = sum(len(families[f]) for f in fams)
        if n:
            ap("| %s | %s | %d | %d |" % (cat, CAT_DESC[cat], len(fams), n))
    ap("")
    ap("## 三、分类明细")
    ap("")
    ap("> 每类一张总表，按家族归组；同一家族若条目标签不同可跨类出现。查内部 ID 请回原文件。")
    for cat in CATEGORY_ORDER:
        fams = cat_fams[cat]
        n = sum(1 for fam in fams for e in families[fam] if entry_cat[e["name"]] == cat)
        if not n:
            continue
        ap("")
        ap("### %s（%d 条）" % (cat, n))
        ap("")
        ap("| 中文参考名 | 原英文名 | 家族 | 标签（中文） |")
        ap("|---|---|---|---|")
        rows = []
        for fam in fams:
            fcn = fam_cn(families[fam], fam)
            for e in families[fam]:
                if entry_cat[e["name"]] != cat:
                    continue
                cn = NAME_CN.get(e["name"], "（待译）")
                tags_cn = "、".join(TAG_CN.get(t, t) for t in e["tags"]) or "—"
                rows.append((fam.lower(), fam, "| %s | %s | %s | %s |" % (cn, e["name"], fcn, tags_cn)))
        rows.sort(key=lambda r: (r[0], r[1]))
        for _, _, row in rows:
            ap(row)
    ap("")

    os.makedirs(OUT_DIR, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    print("已生成:", OUT)
    print("行数:", len(lines), "条目:", total)
    # 未译检查
    missing = [e["name"] for fam in families for e in families[fam] if e["name"] not in NAME_CN]
    print("未译条目:", len(missing), missing[:10])

if __name__ == "__main__":
    main()
