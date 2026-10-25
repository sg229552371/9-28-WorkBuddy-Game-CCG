# -*- coding: utf-8 -*-
"""验收器：WorkBuddy 对执笔产出的机器可判部分做客观校验（内容质量由评审人工判）。"""
import io, os, re, sys

OUT = r"D:/AI-game-All/HTML_TEST_002/Game_v0.0.1/G_docs/技能系统V0.0.2"
BOOK = os.path.join(OUT, "技能编辑器规格_v0.1.md")

BANNED = [u"普攻", u"弹幕实体", u"技能对象", u"Buff/Debuff混写"]
REQUIRED_SEC = u"与运行时契约的引用关系"

CHAP_RE = re.compile(r"^#{1,3}\s*第\s*(\d+[A-Z]?)\s*章\s*(.*)$")


def ckey(k):
    m = re.match(r"^(\d+)([A-Z]?)$", k)
    return (int(m.group(1)), m.group(2))


def main():
    if not os.path.exists(BOOK):
        print(u"!! 成书不存在：%s" % BOOK)
        return 1
    with io.open(BOOK, encoding="utf-8") as f:
        text = f.read()
    lines = text.split(u"\n")

    # 切章
    idx = []
    for i, ln in enumerate(lines):
        m = CHAP_RE.match(ln)
        if m:
            idx.append((m.group(1), m.group(2).strip(), i))
    idx_sorted = sorted(idx, key=lambda x: ckey(x[0]))

    print(u"=" * 74)
    print(u"《技能编辑器规格 v0.1》验收报告　〔2026-10-18 第 1 轮〕")
    print(u"=" * 74)

    # 1. 章节完整性
    expect = [str(i) for i in range(1, 21)]
    have = [c[0] for c in idx_sorted]
    lack = [c for c in expect if c not in have]
    print(u"\n[1] 章节完整性（12.1 硬指标）")
    print(u"    应有 20 章，实有 %d 章" % len(have))
    print(u"    缺章：%s" % (u", ".join(lack) if lack else u"无  ✅"))

    # 2. 每章「与运行时契约的引用关系」
    print(u"\n[2] 每章末尾「与运行时契约的引用关系」（12.1 硬指标）")
    bounds = []
    for n, (cid, title, start) in enumerate(idx_sorted):
        end = idx_sorted[n + 1][2] if n + 1 < len(idx_sorted) else len(lines)
        bounds.append((cid, title, start, end))
    no_ref = []
    for cid, title, s, e in bounds:
        seg = u"\n".join(lines[s:e])
        if REQUIRED_SEC not in seg:
            no_ref.append(cid)
    print(u"    缺该小节的章：%s" % (u", ".join(no_ref) if no_ref else u"无  ✅"))

    # 3. 旧词扫描
    print(u"\n[3] 旧词扫描（铁律：统一术语）")
    hits = {}
    for w in BANNED:
        c = text.count(w)
        if c:
            hits[w] = c
    print(u"    %s" % (u", ".join(u"%s×%d" % (k, v) for k, v in hits.items()) if hits else u"无违规  ✅"))

    # 4. 各章字数
    print(u"\n[4] 各章字数（不含代码块）")
    total = 0
    for cid, title, s, e in bounds:
        seg = u"\n".join(lines[s:e])
        seg_nocode = re.sub(r"```.*?```", u"", seg, flags=re.S)
        n = len(re.sub(r"\s", u"", seg_nocode))
        total += n
        flag = u"  ⚠️偏薄" if n < 1500 else u""
        print(u"    第 %-3s 章 %-22s %6d%s" % (cid, title[:20], n, flag))
    print(u"    %s" % (u"-" * 46))
    print(u"    合计（正文） %6d 字" % total)

    # 5. 关键标志
    print(u"\n[5] 关键内容标志")
    checks = [
        (u"顺序不可配，数值可配", u"设计红线"),
        (u"independent", u"四类载体 independent"),
        (u"instant", u"四类载体 instant"),
        (u"attached", u"四类载体 attached"),
        (u"brick_id", u"积木登记格式"),
        (u"damage_number", u"表现层 伤害数字"),
        (u"status_icon", u"表现层 状态图标"),
        (u"schema_version", u"CFG Schema 版本"),
        (u"推荐默认", u"推荐默认标注"),
        (u"未决问题", u"未决问题小节"),
    ]
    for kw, label in checks:
        c = text.count(kw)
        print(u"    %-28s %5d 次  %s" % (label, c, u"✅" if c else u"❌"))

    print(u"\n" + u"=" * 74)
    return 0


sys.exit(main())
