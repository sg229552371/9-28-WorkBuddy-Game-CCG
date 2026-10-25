# -*- coding: utf-8 -*-
import io, re, os, glob
BASE = r"D:/AI-game-All/HTML_TEST_002/Game_v0.0.1/G_docs/技能系统V0.0.2"
DOC = os.path.join(BASE, "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约", "全新技能系统设计书_v0.2.md")
new = io.open(DOC, encoding="utf-8").read()

print("【5 冻结接口】")
for pat, name in [(r"events:[ ]*\[([^\]]*)\]", "events  "), (r"carriers:[ ]*\[([^\]]*)\]", "carriers")]:
    m = re.search(pat, new)
    print("  %s: %s" % (name, m.group(1) if m else "(未匹配)"))
print("  purge 未被写成原因码:", len(re.findall(r"reason_codes[^\n|]*purge", new)) == 0)

print("\n【4 旧词扫描】")
for w in ["普攻", "弹幕实体", "技能对象"]:
    n = len([l for l in new.split("\n") if w in l])
    print("  %-6s %d 处" % (w, n))
print("  carrier 取 instant 残留:", len(re.findall(r"carrier[^\n|]*instant", new)))
print("  旧四值枚举并列残留:", len(re.findall(r"independent[ ]*/[ ]*instant", new)))

print("\n【6 交叉引用可到达性】")
for t in ["第33C章", "第33D章", "34.1", "33B.3A", "D-108", "D-115", "AC-33C-01", "AC-33D-05", "config_error"]:
    print("  %-12s %d 次" % (t, new.count(t)))

print("\n【未决问题精确统计（各分册去重）】")
allq = {}
for f in sorted(glob.glob(os.path.join(BASE, "*.md"))):
    name = os.path.basename(f)
    if name.startswith("_") or name.startswith("总验收"):
        continue
    try:
        txt = io.open(f, encoding="utf-8").read()
    except UnicodeDecodeError:
        print("  (跳过非UTF-8: %s)" % name)
        continue
    m = re.search(r"\n## 未决问题[^\n]*\n(.*?)(?=\n# |\Z)", txt, re.S)
    if not m:
        continue
    ids = re.findall(r"^\|\s*([UCA][-\w]*\d[\w-]*)\s*\|", m.group(1), re.M)
    if ids:
        allq[name] = ids
        print("  %-38s %2d 条  %s" % (name, len(ids), ",".join(ids[:14])))
flat = [i for v in allq.values() for i in v]
print("-" * 60)
print("  合计 %d 条，去重后 %d 个不同编号" % (len(flat), len(set(flat))))
print("  编号空间: " + ", ".join(sorted(set(flat))))
