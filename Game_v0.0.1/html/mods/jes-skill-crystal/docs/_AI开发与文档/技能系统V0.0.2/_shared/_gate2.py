# -*- coding: utf-8 -*-
"""12.1-3 / 12.1-5 精确复核"""
import io, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
book = io.open(os.path.join(BASE, "技能编辑器规格_v0.1.md"), encoding="utf-8").read()
ch4 = io.open(os.path.join(BASE, "ch04_积木清单.md"), encoding="utf-8").read()

VALID = {"none", "self", "independent", "attached"}

# 找所有积木卡标题（### 4.x.y）——仅 4.2~4.5 为积木卡，4.1/4.7/4.9 为说明节
cards = [c for c in re.findall(r'^### (4\.\d+\.\d+)\s+(.+)$', ch4, re.M)
         if c[0].split('.')[1] in ('2', '3', '4', '5')]
print("积木卡总数（4.2–4.5）：%d" % len(cards))
print()

# 对每张卡，取其后 40 行内的 carrier: 取值
lines = ch4.split("\n")
idx = [(i, m.group(1), m.group(2)) for i, l in enumerate(lines)
       for m in [re.match(r'^### (4\.\d+\.\d+)\s+(.+)$', l)]
       if m]
idx = [x for x in idx if x[1].split('.')[1] in ('2', '3', '4', '5')]

no_carrier, bad_val = [], []
for k, (i, cid, title) in enumerate(idx):
    end = idx[k + 1][0] if k + 1 < len(idx) else len(lines)
    body = "\n".join(lines[i:end])
    vals = re.findall(r'^\s*carrier:\s*([A-Za-z_][A-Za-z0-9_]*)\s*$', body, re.M)
    if not vals and 'carrier:' in body:
        vals = re.findall(r'carrier:\s*([A-Za-z_][A-Za-z0-9_]*)', body)
    if not vals:
        no_carrier.append((cid, title))
    else:
        for v in set(vals):
            if v not in VALID:
                bad_val.append((cid, title, v))

print("=" * 66)
print("12.1-3 积木 → 四类载体映射")
print("=" * 66)
print("越界取值：%s" % ("、".join("%s(%s)" % (c, v) for c, t, v in bad_val) if bad_val else "无 ✅"))
print("未声明 carrier 的卡：%s" % ("、".join(c for c, t in no_carrier) if no_carrier else "无 ✅"))

# 统计各载体卡片数
from collections import Counter
cnt = Counter()
for k, (i, cid, title) in enumerate(idx):
    end = idx[k + 1][0] if k + 1 < len(idx) else len(lines)
    body = "\n".join(lines[i:end])
    vals = set(re.findall(r'carrier:\s*([A-Za-z_][A-Za-z0-9_]*)', body))
    for v in vals:
        if v in VALID:
            cnt[v] += 1
print()
print("载体分布：%s" % dict(cnt))

print()
print("=" * 66)
print("12.1-5 第13章 12角色 × 多技能 × 水晶池索引")
print("=" * 66)
m13 = re.search(r'## 第\s*13\s*章(.*?)(?=\n## 第\s*14\s*章)', book, re.S)
c13 = m13.group(1) if m13 else ""
for kw in ["十二个角色", "水晶池", "索引", "分面", "meta.role", "meta.pools"]:
    print("  %-14s %s" % (kw, "有" if kw in c13 else "无"))
