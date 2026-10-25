# -*- coding: utf-8 -*-
"""从 PoB2 Gems.lua 抽取全部辅助宝石元数据，生成 MD。
原始真源：Gems_原始PoB2数据.lua（同目录，勿改）
"""
import re, io, sys

SRC = "Gems_原始PoB2数据.lua"
OUT = "POE2辅助宝石全集_PoB2数据_v1.md"

text = io.open(SRC, encoding="utf-8").read()

# 按 ["Metadata/..."] = { ... } 顶层条目切分
entries = re.findall(r'\t\["(Metadata/Items/Gems/[^"]+)"\] = \{(.*?)\n\t\},', text, re.S)

def field(body, key):
    m = re.search(r'\t\t%s = "(.*?)",\n' % key, body)
    return m.group(1) if m else ""

def tags_of(body):
    m = re.search(r'\t\ttags = \{(.*?)\n\t\t\},', body, re.S)
    if not m:
        return []
    return re.findall(r'(\w+) = true', m.group(1))

rows = []
for key, body in entries:
    tags = tags_of(body)
    if "support" not in tags:
        continue
    rows.append({
        "name": field(body, "name"),
        "key": key,
        "gameId": field(body, "gameId"),
        "variantId": field(body, "variantId"),
        "grantedEffectId": field(body, "grantedEffectId"),
        "family": field(body, "gemFamily"),
        "tagString": field(body, "tagString"),
        "reqStr": field(body, "reqStr"),
        "reqDex": field(body, "reqDex"),
        "reqInt": field(body, "reqInt"),
        "tier": field(body, "Tier"),
        "tags": ",".join(t for t in tags if t != "support"),
    })

# 按 家族 → 名称 → Tier 排序
rows.sort(key=lambda r: (r["family"].lower(), r["name"].lower(), r["tier"]))

families = {}
for r in rows:
    families.setdefault(r["family"] or "(无家族)", []).append(r)

buf = []
buf.append("# POE2 辅助宝石全集（PoB2 数据抽取）\n")
buf.append("> **真源**：`Gems_原始PoB2数据.lua`（同目录，PathOfBuildingCommunity/PathOfBuilding-PoE2 dev 分支 `src/Data/Gems.lua`，2026-10-22 抓取）。\n")
buf.append("> **性质**：只查不写的外部参考（S6 冷区）。数值校对以游戏内/官方为准，本表不含逐级数值（Gems.lua 仅元数据）。\n")
buf.append("> **说明**：`名称` 为 PoB2 英文名；I/II/III 为同一家族不同层级的变体；`Tier` 为宝石解锁层级。\n")
buf.append("\n- 辅助宝石条目总数：%d" % len(rows))
buf.append("- 家族总数：%d\n" % len(families))
buf.append("## 目录（按家族）\n")
buf.append("| 家族 | 变体数 |")
buf.append("|---|---|")
for fam in sorted(families):
    buf.append("| %s | %d |" % (fam, len(families[fam])))
buf.append("\n## 明细\n")
for fam in sorted(families):
    buf.append("### %s\n" % fam)
    buf.append("| 名称 | Tier | 标签 | 属性需求(S/D/I) | grantedEffectId | variantId |")
    buf.append("|---|---|---|---|---|---|")
    for r in families[fam]:
        req = "%s/%s/%s" % (r["reqStr"], r["reqDex"], r["reqInt"])
        buf.append("| %s | %s | %s | %s | %s | %s |" % (
            r["name"], r["tier"], r["tagString"], req,
            r["grantedEffectId"], r["variantId"]))
    buf.append("")

io.open(OUT, "w", encoding="utf-8").write("\n".join(buf))
print("support entries:", len(rows), "families:", len(families), "-> ", OUT)
