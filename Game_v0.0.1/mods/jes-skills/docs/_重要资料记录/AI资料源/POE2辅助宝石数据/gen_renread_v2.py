# -*- coding: utf-8 -*-
"""POE2 辅助宝石人读版 v2 生成器
数据：t_gems_full.json（sup_str/dex/int.lua 解析产物：名称/描述/constantStats）
     + 原全集 MD（567 条清单与家族标签，复用 generate_renread 的解析与译名）
输出：docs/_重要资料记录/人工查阅/POE2辅助宝石_人读版_v2.md
说明：描述中文为参考意译（DESC_CN_1/2/3，按唯一描述字典序对位）；数值取 constantStats，
     高频属性 ID 已汉化，低频回退原始 ID（生成时会打印清单供后续补充）。"""
import io, re, os, json, collections, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
# 向上查找 project.godot 定位仓库根（脚本放仓库内任意位置都能跑）
ROOT = HERE
for _ in range(8):
    if os.path.exists(os.path.join(ROOT, "project.godot")):
        break
    ROOT = os.path.dirname(ROOT)
SRC_MD = os.path.join(ROOT, "mods/jes-skills/docs/_重要资料记录/AI资料源/POE2辅助宝石数据/POE2辅助宝石全集_PoB2数据_v1.md")
RENREAD = os.path.join(ROOT, "mods/jes-skills/docs/_重要资料记录/AI资料源/POE2辅助宝石数据/generate_renread.py")
JSON_IN = os.path.join(ROOT, "t_gems_full.json")
OUT_DIR = os.path.join(ROOT, "mods/jes-skills/docs/_重要资料记录/人工查阅")
OUT = os.path.join(OUT_DIR, "POE2辅助宝石_人读版_v2.md")

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from desc_cn_1 import DESC_CN_1
from desc_cn_2 import DESC_CN_2
from desc_cn_3 import DESC_CN_3
DESC_CN = DESC_CN_1 + DESC_CN_2 + DESC_CN_3

spec = importlib.util.spec_from_file_location("renread", RENREAD)
ren = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ren)

# 高频属性 ID 中文（数值渲染；未覆盖的回退原始 ID）
STAT_CN = {
 "number_of_additional_projectiles": "额外投射物 {v}",
 "support_multiple_damage_+%_final": "伤害总增 {v}%",
 "support_scattershot_skill_speed_+%_final": "技能速度总增 {v}%",
 "active_skill_base_area_of_effect_radius": "基础范围半径 {v}",
 "base_skill_effect_duration": "技能效果持续时间 {v} 毫秒",
 "active_skill_base_secondary_area_of_effect_radius": "次级范围半径 {v}",
 "number_of_chains": "连锁次数 {v}",
 "base_skill_area_of_effect_+%": "范围 {v}%",
 "base_chance_to_poison_on_hit_%": "命中中毒概率 {v}%",
 "attack_speed_+%": "攻击速度 {v}%",
 "base_maximum_seals_for_skill": "最大封印数 {v}",
 "ground_effect_duration_+%": "地面效果持续 {v}%",
 "minion_command_skill_cooldown_speed_+%": "随从号令冷却速度 {v}%",
 "base_number_of_projectiles": "投射物数量 {v}",
 "skill_maximum_number_of_combo_stacks": "最大连段层数 {v}",
 "base_movement_velocity_+%": "移动速度 {v}%",
 "base_projectile_speed_+%": "投射物速度 {v}%",
 "cast_speed_+%": "施法速度 {v}%",
 "critical_strike_chance_+%": "暴击率 {v}%",
 "damage_+%": "伤害 {v}%",
 "physical_damage_+%": "物理伤害 {v}%",
 "fire_damage_+%": "火焰伤害 {v}%",
 "cold_damage_+%": "冰霜伤害 {v}%",
 "lightning_damage_+%": "闪电伤害 {v}%",
 "chaos_damage_+%": "混沌伤害 {v}%",
 "melee_damage_+%": "近战伤害 {v}%",
 "projectile_damage_+%": "投射物伤害 {v}%",
 "area_damage_+%": "范围伤害 {v}%",
 "spell_damage_+%": "法术伤害 {v}%",
 "damage_over_time_+%": "持续伤害 {v}%",
 "bleeding_damage_+%": "流血伤害 {v}%",
 "poison_damage_+%": "中毒伤害 {v}%",
 "ignite_damage_+%": "点燃伤害 {v}%",
 "base_stun_duration_+%": "眩晕持续 {v}%",
 "base_ailment_duration_+%": "异常持续 {v}%",
 "base_bleeding_duration_+%": "流血持续 {v}%",
 "base_poison_duration_+%": "中毒持续 {v}%",
 "base_ignite_duration_+%": "点燃持续 {v}%",
 "base_freeze_duration_+%": "冰冻持续 {v}%",
 "base_skill_duration_+%": "技能持续 {v}%",
 "mana_cost_+%": "魔力消耗 {v}%",
 "life_cost_+%": "生命消耗 {v}%",
 "cooldown_recovery_+%": "冷却回复 {v}%",
 "base_cooldown_speed_+%": "冷却速度 {v}%",
 "base_critical_strike_chance_+%": "暴击率 {v}%",
 "critical_damage_bonus_+%": "暴击伤害 {v}%",
 "accuracy_rating_+%": "精度 {v}%",
 "knockback_distance_+%": "击退距离 {v}%",
 "base_global_chance_to_knockback_%": "击退概率 {v}%",
 "base_maim_duration_+ms": "致残持续 {v} 毫秒",
 "base_blind_duration_+%": "致盲持续 {v}%",
 "base_chance_to_blind_on_hit_%": "命中致盲概率 {v}%",
 "global_chance_to_blind_on_hit_%": "命中致盲概率 {v}%",
 "base_chance_to_shock_%": "感电概率 {v}%",
 "base_chance_to_ignite_%": "点燃概率 {v}%",
 "base_chance_to_freeze_%": "冰冻概率 {v}%",
 "base_chance_to_shock_on_hit_%": "命中感电概率 {v}%",
 "chance_to_poison_on_hit_%": "命中中毒概率 {v}%",
 "base_chance_to_maim_on_hit_%": "命中致残概率 {v}%",
 "base_physcial_%_damage_reduction": "物理减伤 {v}%",
 "base_armour_break_on_hit_%": "命中破甲 {v}%",
 "armour_break_physical_damage_%_to_break": "物理伤害破甲比例 {v}%",
 "life_leech_from_physical_damage_permyriad": "物理伤害生命偷取 {v}/万",
 "mana_leech_from_physical_damage_permyriad": "物理伤害魔力偷取 {v}/万",
 "base_life_leech_from_damage_taken_permyriad": "承伤生命偿还 {v}/万",
 "base_mana_leech_from_damage_taken_permyriad": "承伤魔力偿还 {v}/万",
 "support_minion_damage_+%_final": "随从伤害总增 {v}%",
 "support_minion_life_+%_final": "随从生命总增 {v}%",
 "support_minion_attack_speed_+%_final": "随从攻速总增 {v}%",
 "minion_damage_+%": "随从伤害 {v}%",
 "minion_maximum_life_+%": "随从生命 {v}%",
 "minion_movement_speed_+%": "随从移动速度 {v}%",
 "base_number_of_totems_allowed": "图腾数量上限 {v}",
 "totem_placement_speed_+%": "图腾放置速度 {v}%",
 "totem_life_+%": "图腾生命 {v}%",
 "base_totem_duration_+ms": "图腾持续 {v} 毫秒",
 "number_of_warcries_allowed": "战吼数量上限 {v}",
 "warcry_speed_+%": "战吼速度 {v}%",
 "base_reservation_+%": "保留 {v}%",
 "spirit_cost_+%": "魂力消耗 {v}%",
 "base_mana_reservation_+%": "魔力保留 {v}%",
 "base_life_reservation_+%": "生命保留 {v}%",
}

def render_stat(sid, val):
    tmpl = STAT_CN.get(sid)
    if tmpl:
        try:
            return tmpl.format(v=int(float(val))) if float(val) == int(float(val)) else tmpl.format(v=val)
        except Exception:
            return tmpl.format(v=val)
    return "%s = %s" % (sid, val)

def main():
    gems_full = json.load(io.open(JSON_IN, encoding="utf-8"))

    # 唯一描述字典序索引（与 t_descs.txt 同一排序）
    uniq = sorted(set(g["desc"] for g in gems_full.values() if g["desc"]))
    assert len(uniq) == len(DESC_CN), "描述译文数(%d) != 唯一描述数(%d)" % (len(DESC_CN), len(uniq))
    desc_idx = {d: i for i, d in enumerate(uniq)}

    # 解析原全集 MD（567 条：名称/tier/标签/grantedEffectId）
    text = io.open(SRC_MD, encoding="utf-8").read()
    detail = text.split("## 明细")[1]
    gems = []  # (name, family, tags, geid)
    cur = None
    for line in detail.splitlines():
        m = re.match(r"^### (.+)$", line)
        if m:
            cur = m.group(1).strip(); continue
        m = re.match(r"^\| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$", line)
        if m and m.group(1).strip() != "名称":
            tags = [t.strip() for t in m.group(3).strip().split(",") if t.strip() and t.strip() != "标签"]
            gems.append({"name": m.group(1).strip(), "family": cur, "tags": tags, "geid": m.group(5).strip()})
    assert len(gems) == 567, "原清单条目异常: %d" % len(gems)

    cat_fams = collections.OrderedDict((c, set()) for c in ren.CATEGORY_ORDER)
    for g in gems:
        cat_fams[ren.classify(set(g["tags"]))].add(g["family"])
    fam_of = {g["name"]: g["family"] for g in gems}
    cat_of = {g["name"]: ren.classify(set(g["tags"])) for g in gems}

    lines, ap = [], None
    lines = []; ap = lines.append
    ap("# POE2 辅助宝石全集 · 人读版 v2（含描述与数值）")
    ap("")
    ap("> **用途**：人工翻阅。数据三源合一：宝石清单与分类同 v1（PoB2 Gems.lua），")
    ap("> 功能描述与数值取自 PoB2 仓库 `src/Data/Skills/sup_str/dex/int.lua`（2026-10-22 抓取）。")
    ap("> 机器查证以 `AI资料源/POE2辅助宝石数据/` 内原始文件为准，本文件不是施工依据。")
    ap("")
    ap("> **译名口径**：宝石名与描述均为**参考意译**，非官方国服译名。")
    ap("> **数值说明**：取自数据内 constantStats（真实生效值）；未汉化的属性 ID 回退显示原文。")
    ap("> 描述与数值冲突时以游戏内实装为准；无描述条目已在文末列出。")
    ap("")
    missing_desc = []
    for cat in ren.CATEGORY_ORDER:
        fams = cat_fams[cat]
        members = sorted((g for g in gems if g["family"] in fams and cat_of[g["name"]] == cat),
                         key=lambda g: (g["family"].lower(), g["name"].lower()))
        if not members:
            continue
        n = len(members)
        ap("")
        ap("## %s（%d 条）" % (cat, n))
        ap(">")
        ap("> " + ren.CAT_DESC[cat])
        ap("")
        for g in members:
            cn = ren.NAME_CN.get(g["name"], "（待译）")
            fcn = ren.fam_cn([{"name": g["name"]}], g["family"])
            ap("### %s（%s）" % (cn, g["name"]))
            ap("")
            e = gems_full.get(g["geid"])
            if e and e["desc"]:
                di = desc_idx.get(e["desc"])
                ap("- **功能**：" + (DESC_CN[di] if di is not None else e["desc"] + "〔未译〕"))
            else:
                ap("- **功能**：（数据源无描述）")
                missing_desc.append(g["name"])
            if e and e.get("stats"):
                vals = []
                seen = set()
                for sid, v in e["stats"]:
                    if sid in seen:
                        continue
                    seen.add(sid)
                    vals.append(render_stat(sid, v))
                ap("- **数值**：" + "；".join(vals))
            else:
                ap("- **数值**：—")
            ap("- 家族：%s｜标签：%s" % (fcn, "、".join(ren.TAG_CN.get(t, t) for t in g["tags"]) or "—"))
            ap("")

    ap("---")
    ap("")
    ap("## 附：数据源无描述的条目（%d 条）" % len(missing_desc))
    ap("")
    for nm in missing_desc:
        ap("- %s（%s）" % (ren.NAME_CN.get(nm, "（待译）"), nm))

    os.makedirs(OUT_DIR, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    print("已生成:", OUT)
    print("总行:", len(lines))
    print("无描述条目:", len(missing_desc), missing_desc)
    # 未汉化属性 ID 统计
    used = collections.Counter()
    for g in gems:
        e = gems_full.get(g["geid"])
        if e:
            for sid, _ in e["stats"]:
                if sid not in STAT_CN:
                    used[sid] += 1
    print("回退原始ID的种类:", len(used))

if __name__ == "__main__":
    main()
