# -*- coding: utf-8 -*-
"""合书器：把各执笔包产出的分册合并为《技能编辑器规格 v0.1》成书（按章号重排 + 生成目录）。"""
import io, os, re, glob, sys

OUT = r"D:/AI-game-All/HTML_TEST_002/Game_v0.0.1/G_docs/技能系统V0.0.2"
BOOK = os.path.join(OUT, "技能编辑器规格_v0.1.md")

# 参与合书的分册（按优先级；章号由正则识别，不依赖文件顺序）
PARTS = [
    "ch01-03_定位术语数据模型.md",
    "ch04_积木清单.md",
    "ch05_积木参数表.md",
    "ch06-12_挂点成长文案.md",
    "ch09-10_表现层配置与对齐.md",
    "ch13-20_组织校验保存验收.md",
    "ch21_积木扩展性与未决问题处置.md",
    "ch22_L5表达式逃逸口规格.md",
]

CHAP_RE = re.compile(r"^#{1,3}\s*第\s*(\d+)\s*章\s*(.*)$")
# 33A/33B 这类带字母的章号也要支持（本合书暂不涉及，预留）
CHAP_RE2 = re.compile(r"^#{1,3}\s*第\s*(\d+[A-Z]?)\s*章\s*(.*)$")

chapters = {}   # 章号 -> (标题后缀, 正文行列表)
orphans = []    # 各分册章标题之前的前言内容
missing = []

for fn in PARTS:
    p = os.path.join(OUT, fn)
    if not os.path.exists(p):
        missing.append(fn)
        continue
    with io.open(p, encoding="utf-8") as f:
        lines = f.readlines()
    cur = None
    head = []
    for ln in lines:
        m = CHAP_RE2.match(ln.rstrip(u"\n"))
        if m:
            cur = m.group(1)
            chapters.setdefault(cur, [m.group(2).strip(), []])
            head = None
            continue
        if cur is None:
            if head is not None:
                head.append(ln)
        else:
            chapters[cur][1].append(ln)
    if head:
        orphans.append((fn, u"".join(head)))


def ckey(k):
    m = re.match(r"^(\d+)([A-Z]?)$", k)
    return (int(m.group(1)), m.group(2))


order = sorted(chapters.keys(), key=ckey)

# ---------- 生成目录 ----------
toc = []
for k in order:
    toc.append(u"- 第 %s 章　%s" % (k, chapters[k][0] or u"（待补标题）"))

body = []
for k in order:
    title = chapters[k][0] or u"（待补标题）"
    body.append(u"\n---\n\n## 第 %s 章　%s\n" % (k, title))
    body.append(u"".join(chapters[k][1]).rstrip() + u"\n")

cover = u"""# 《技能编辑器规格》v0.1

> 版本：v0.1　日期：2026-10-18　轮次：第 1 轮
> 执笔：本地 Claude CLI（gpt-6-astra）　评审与合书：WorkBuddy　拍板：用户
> 上游真源：《全新技能系统设计书 v0.2.6》（运行时契约，4361 行 / 73 条验收例子）
> 接线契约：CFG Schema —— 编辑器写入，运行时读取，两者之间唯一不可变契约

## 本书回答什么

> **定义"一个技能在数据上是什么"——把策划脑子里的技能，变成一份合法、可预览、可保存、能被运行时 100% 还原的 CFG。**

## 四根核心柱子

| # | 柱子 | 一句话 |
|---|---|---|
| 1 | 积木体系 | 有名字的能力预设 = 四类载体之一的预设组合 + 默认参数，数量不固定 |
| 2 | 表单与校验 | 每块积木的字段表 + 非法组合检测，报错定位到具体字段 |
| 3 | 表现层配置 | 特效/音效/动画/拖尾/镜头/伤害数字/状态图标，填完即可预览 |
| 4 | 组织与版本 | 技能 ID 命名、角色归属、技能池、标签、搜索、Schema 版本与迁移 |

## 设计红线

**顺序不可配，数值可配。** 一旦允许策划配置结算顺序，组合数爆炸、验收写不完、任何一个配错都是查不出来的平衡灾难。

## 目录

__TOC__

---
"""
cover = cover.replace(u"__TOC__", u"\n".join(toc))

with io.open(BOOK, "w", encoding="utf-8") as f:
    f.write(cover + u"".join(body))

print(u"==> 成书：%s  (%d bytes)" % (BOOK, os.path.getsize(BOOK)))
print(u"==> 入册章号：%s" % u", ".join(order))
if missing:
    print(u"!! 缺失分册：%s" % u", ".join(missing))
expect = [str(i) for i in range(1, 21)]
lack = [c for c in expect if c not in chapters]
print(u"==> 缺章：%s" % (u", ".join(lack) if lack else u"无"))
