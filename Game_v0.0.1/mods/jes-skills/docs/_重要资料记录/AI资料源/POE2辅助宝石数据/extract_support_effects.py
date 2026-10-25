# -*- coding: utf-8 -*-
"""从 PoB2 原始 lua 抽取辅助宝石完整数据（含效果文本与数值），生成 MD。

输入（同目录 原始PoB2数据/）：
  Gems.lua                            宝石元数据
  Skills/sup_*.lua other.lua act_*.lua 技能效果定义（含 description / 类型门槛 / 数值）
  StatDescriptions/gem_stat_descriptions.lua  stat key -> 可读文本模板

输出：
  POE2辅助宝石效果与数值_v1.md
"""
import io, os, re, json

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = BASE
OUT = os.path.join(BASE, "POE2辅助宝石效果与数值_v1.md")

SKILL_FILES = ["原始PoB2数据_sup_str.lua", "原始PoB2数据_sup_dex.lua", "原始PoB2数据_sup_int.lua",
               "原始PoB2数据_other.lua", "原始PoB2数据_act_str.lua", "原始PoB2数据_act_dex.lua",
               "原始PoB2数据_act_int.lua"]


def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()


# ---------- 1. 解析 stat 描述模板 ----------
def parse_stat_desc(path):
    """返回 {stat_key: 文本模板}，模板占位符保留 {0} {1}。"""
    txt = read(path)
    # 索引：[id]={ ... stats={[1]="key",[2]="key"} }
    id2keys = {}
    for m in re.finditer(r"\t\[(\d+)\]=\{\n(.*?)\n\t\},\n(?=\t\[\d+\]=\{|$|\tstats=|\}\n)", txt, re.S):
        pass
    # 更稳：按顶层条目切分
    blocks = re.findall(r"\n\t\[(\d+)\]=\{(.*?)\n\t\},", txt, re.S)
    for bid, body in blocks:
        sm = re.search(r"stats=\{([^}]*)\}", body)
        if not sm:
            continue
        keys = re.findall(r'"([^"]+)"', sm.group(1))
        tm = re.search(r'text="((?:[^"\\]|\\.)*)"', body)
        if not tm:
            continue
        text = tm.group(1)
        for k in keys:
            id2keys.setdefault(k, text)
    # 直接映射区：["key"]=id
    for k, i in re.findall(r'\n\t\["([^"]+)"\]=(\d+),', txt):
        if i in dict((b, 1) for b, _ in blocks):
            pass
    # 用 id -> text 建立，再用直接映射表补 key
    id2text = {}
    for bid, body in blocks:
        tm = re.search(r'text="((?:[^"\\]|\\.)*)"', body)
        if tm:
            id2text[bid] = tm.group(1)
    result = {}
    for k, i in re.findall(r'\n\t\["([^"]+)"\]=(\d+),', txt):
        if i in id2text:
            result[k] = id2text[i]
    result.update(id2keys)
    return result


# ---------- 2. 解析技能定义块 ----------
def split_blocks(txt):
    """按 skills["Key"] = { ... } 切出顶层块（花括号配平）。"""
    out = []
    idx = 0
    pat = re.compile(r'skills\["([^"]+)"\] = \{')
    while True:
        m = pat.search(txt, idx)
        if not m:
            break
        start = m.end() - 1
        depth = 0
        i = start
        while i < len(txt):
            ch = txt[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        out.append((m.group(1), txt[start:i + 1]))
        idx = i + 1
    return out


def get_str(body, key):
    m = re.search(r'\n\t+%s = "((?:[^"\\]|\\.)*)",' % key, body)
    return m.group(1) if m else ""


def get_num(body, key):
    m = re.search(r"\n\t+%s = ([\-\d.]+)," % key, body)
    return m.group(1) if m else ""


CONNECTORS = {"AND", "NOT", "OR"}


def get_list_raw(body, key):
    """保留 AND/NOT/OR 逻辑连接符的原始 token 序列。"""
    m = re.search(r"\n\t+%s = \{([^}]*)\}," % key, body, re.S)
    if not m:
        return []
    return re.findall(r"SkillType\.(\w+)", m.group(1))


def get_list(body, key):
    """只要技能类型，丢掉逻辑连接符。"""
    return [t for t in get_list_raw(body, key) if t not in CONNECTORS]


def render_types(tokens):
    """按 PoB2 CalcTools.doesTypeExpressionMatch 的真实语义渲染（后缀表达式）：
    AND/OR 为二元后缀运算符，NOT 为一元后缀；剩余并列操作数之间是「或」。
    """
    stack = []
    for t in tokens:
        if t == "AND":
            if len(stack) >= 2:
                b = stack.pop()
                a = stack.pop()
                stack.append("(%s AND %s)" % (a, b))
        elif t == "OR":
            if len(stack) >= 2:
                b = stack.pop()
                a = stack.pop()
                stack.append("(%s OR %s)" % (a, b))
        elif t == "NOT":
            if stack:
                stack.append("NOT %s" % stack.pop())
        else:
            stack.append(t)
    if not stack:
        return ""
    if len(stack) == 1:
        out = stack[0]
        if out.startswith("(") and out.endswith(")"):
            out = out[1:-1]
        return out
    return " OR ".join(stack)


def get_family(body):
    m = re.search(r"\n\t+gemFamily = \{([^}]*)\},", body)
    if not m:
        return ""
    fams = re.findall(r'"([^"]+)"', m.group(1))
    return fams[0] if fams else ""


def get_constant_stats(body):
    out = []
    for m in re.finditer(r'\n\t\t\t\t\{ "([^"]+)", ([-\d.]+) \},', body):
        out.append((m.group(1), m.group(2)))
    return out


def get_stat_keys(body):
    """statSets 内的 stats 列表（只取 key）。"""
    m = re.search(r"\n\t\t\tstats = \{(.*?)\n\t\t\t\},", body, re.S)
    if not m:
        return []
    return re.findall(r'\{ "([^"]+)"', m.group(1))


def get_level_info(body):
    lm = re.search(r"\n\tlevels = \{(.*?)\n\t\},", body, re.S)
    n = 0
    if lm:
        n = len(re.findall(r"\n\t\t\[\d+\] = \{", lm.group(1)))
    return n


def fmt_value(v):
    try:
        f = float(v)
        return ("%g" % f)
    except ValueError:
        return v


def render_stat(key, value, desc_map):
    tpl = desc_map.get(key)
    if not tpl:
        return None
    tpl = tpl.replace("\\n", " ")
    # 单个数值占位
    if "{0}" in tpl and value is not None:
        tpl = tpl.replace("{0}", fmt_value(value))
    # 去残留占位
    tpl = re.sub(r"\{-?\d+\}", "#", tpl)
    return tpl


# ---------- 3. 汇总 ----------
desc_map = parse_stat_desc(os.path.join(RAW, "原始PoB2数据_gem_stat_descriptions.lua"))
print("stat desc keys:", len(desc_map))

effects = {}
for f in SKILL_FILES:
    p = os.path.join(RAW, f)
    if not os.path.exists(p):
        continue
    for key, body in split_blocks(read(p)):
        if not re.search(r"\n\t+support = true,", body):
            continue
        effects[key] = {
            "source": f,
            "name": get_str(body, "name"),
            "description": get_str(body, "description"),
            "require": get_list(body, "requireSkillTypes"),
            "requireExpr": render_types(get_list_raw(body, "requireSkillTypes")),
            "excludeExpr": render_types(get_list_raw(body, "excludeSkillTypes")),
            "exclude": get_list(body, "excludeSkillTypes"),
            "add": get_list(body, "addSkillTypes"),
            "family": get_family(body),
            "const": get_constant_stats(body),
            "stats": get_stat_keys(body),
            "levelCount": get_level_info(body),
        }
print("support effects:", len(effects))

# 宝石元数据
gems = {}
if os.path.exists(os.path.join(RAW, "Gems_原始PoB2数据.lua")):
    gtxt = read(os.path.join(RAW, "Gems_原始PoB2数据.lua"))
    for m in re.finditer(r'\t\["(Metadata/Items/Gems/[^"]+)"\] = \{(.*?)\n\t\},', gtxt, re.S):
        key, body = m.group(1), m.group(2)
        if "support = true" not in body:
            continue
        gems[key] = {
            "name": get_str(body, "name"),
            "effectId": get_str(body, "grantedEffectId"),
            "req": (get_num(body, "reqStr"), get_num(body, "reqDex"), get_num(body, "reqInt")),
            "tier": get_num(body, "Tier"),
            "tagString": get_str(body, "tagString"),
            "family": get_str(body, "gemFamily"),
        }
print("gem entries:", len(gems))

# 合并：按 effectId 关联
merged = []
for gid, g in gems.items():
    e = effects.get(g["effectId"])
    merged.append((g, e))

orphan_effects = [k for k in effects if k not in
                  {g["effectId"] for g in gems.values()}]

merged.sort(key=lambda p: (p[0]["family"].lower(), p[0]["name"].lower()))

# ---------- 4. 输出 MD ----------
L = []
L.append("# POE2 辅助宝石效果与数值（PoB2 抽取 v1）\n")
L.append("> **真源**：`原始PoB2数据/`（PoB2 `dev` 分支 commit `bb52d6b`，commit 时间 2026-10-01）。")
L.append("> **抽取时间**：2026-10-23。**性质**：只查不写的外部参考（S6 冷区），**不是施工依据**。")
L.append("> **内容**：名称 / 家族 / Tier / 属性需求 / 官方效果描述 / 可辅助与禁止的技能类型 / 数值条目。")
L.append("> **未含**：逐级成长表（辅助宝石大多单级，`levelCount` 已在明细中标注）、中文名。")
L.append("> **判定语义**（照 PoB2 `CalcTools.doesTypeExpressionMatch` 实现）：条件串是后缀表达式，"
         "并列的操作数之间是 **或**，`AND` / `NOT` 才是与/非。例：`Attack OR Bow` = 有任一类型即可；"
         "`(Attack AND Bow)` 才要求同时具备。")
L.append("> **数值文本**：由 `gem_stat_descriptions.lua` 模板回填，反引号包裹的是未找到文本模板的原始 stat key（值为常量）。\n")
L.append("- 宝石条目：%d　效果定义：%d　无法关联的孤立效果：%d\n"
         % (len(gems), len(effects), len(orphan_effects)))
L.append("## 一、家族总览\n")
L.append("| 家族 | 变体 | Tier | 属性需求 S/D/I |")
L.append("|---|---|---|---|")
fam_map = {}
for g, e in merged:
    fam_map.setdefault(g["family"] or "(无家族)", []).append(g)
for fam in sorted(fam_map):
    gs = fam_map[fam]
    variants = " / ".join(sorted(x["name"].replace(fam, "").strip() or "I" for x in gs))
    tiers = ",".join(sorted(set(x["tier"] for x in gs), key=lambda t: (len(t), t)))
    L.append("| %s | %s | %s | %s |" % (fam, variants, tiers, gs[0]["req"][0] + "/" + gs[0]["req"][1] + "/" + gs[0]["req"][2]))
L.append("")

L.append("## 二、明细（按家族）\n")
for fam in sorted(fam_map):
    L.append("### %s\n" % fam)
    for g in fam_map[fam]:
        e = effects.get(g["effectId"])
        L.append("**%s** · Tier %s · 需求 %s/%s/%s · 标签 `%s`"
                 % (g["name"], g["tier"], g["req"][0], g["req"][1], g["req"][2], g["tagString"]))
        if e:
            L.append("- 效果：%s" % (e["description"] or "—"))
            L.append("- 可辅助条件：%s" % (e["requireExpr"] or "（无限制）"))
            if e["exclude"]:
                L.append("- 禁止条件：%s" % e["excludeExpr"])
            if e["add"]:
                L.append("- 赋予类型：%s" % ", ".join(e["add"]))
            nums = []
            for k, v in e["const"]:
                tx = render_stat(k, v, desc_map)
                nums.append(tx if tx else "`%s` = %s" % (k, fmt_value(v)))
            if nums:
                L.append("- 数值：" + "；".join(nums))
            if e["stats"]:
                L.append("- 其它 stat key：`%s`" % "`, `".join(e["stats"]))
            if e["levelCount"] > 1:
                L.append("- 等级表：%d 级" % e["levelCount"])
        else:
            L.append("- ⚠ 未找到对应效果定义（`%s`）" % g["effectId"])
        L.append("")
    L.append("")

# 反查：技能类型 -> 支持它的辅助宝石
type2gems = {}
for g, e in merged:
    if not e:
        continue
    for t in e["require"]:
        type2gems.setdefault(t, []).append(g["name"])
L.append("## 三、反查索引：技能类型 → 出现的宝石（含 AND 的宝石需同时满足多个类型）\n")
L.append("| 技能类型 | 辅助宝石数 | 宝石 |")
L.append("|---|---|---|")
for t in sorted(type2gems):
    names = sorted(set(type2gems[t]))
    L.append("| %s | %d | %s |" % (t, len(names), ", ".join(names)))
L.append("")

exclude_count = {}
for g, e in merged:
    if not e:
        continue
    for t in e["exclude"]:
        exclude_count[t] = exclude_count.get(t, 0) + 1
L.append("### 禁止类型出现频次（excludeSkillTypes）\n")
L.append("| 类型 | 被禁止次数 |")
L.append("|---|---|")
for t, c in sorted(exclude_count.items(), key=lambda kv: -kv[1]):
    L.append("| %s | %d |" % (t, c))
L.append("")

if orphan_effects:
    L.append("## 四、未关联到宝石条目的效果（%d）\n" % len(orphan_effects))
    L.append("| 效果 id | 名称 | 效果 |")
    L.append("|---|---|---|")
    for k in sorted(orphan_effects):
        e = effects[k]
        L.append("| `%s` | %s | %s |" % (k, e["name"], (e["description"] or "—").replace("|", "\\|")))
    L.append("")

io.open(OUT, "w", encoding="utf-8").write("\n".join(L))
print("written:", OUT)

# 机器可读版
json.dump({"gems": [dict(g, effect=effects.get(g["effectId"])) for g, _ in merged],
           "orphanEffects": {k: effects[k] for k in orphan_effects}},
          io.open(os.path.join(BASE, "POE2辅助宝石效果与数值_v1.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("json written")
