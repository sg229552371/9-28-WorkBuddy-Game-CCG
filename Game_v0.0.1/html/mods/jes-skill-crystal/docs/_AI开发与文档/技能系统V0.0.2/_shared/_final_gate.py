# -*- coding: utf-8 -*-
"""第 12 章完成判定逐项核验"""
import io, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(BASE, "技能编辑器规格_v0.1.md")
MS = os.path.join(BASE, "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约",
                 "全新技能系统设计书_v0.2.md")
SCHEMA = os.path.join(BASE, "技能CFG_Schema_v0.1.md")
TBL = os.path.join(BASE, "交界映射表_v0.1.md")

book = io.open(BOOK, encoding="utf-8").read()
ms = io.open(MS, encoding="utf-8").read()
sch = io.open(SCHEMA, encoding="utf-8").read()
tbl = io.open(TBL, encoding="utf-8").read()

R = []
def chk(i, name, ok, detail):
    R.append((i, name, ok, detail))

# ---- 12.1-1 20章有正文 ----
chs = re.findall(r'^## 第\s*(\d+)\s*章', book, re.M)
nums = sorted(set(int(c) for c in chs))
missing = [n for n in range(1, 21) if n not in nums]
chk("12.1-1", "20章全部有正文", len(missing) == 0,
    "实有 %d 章（%s）%s" % (len(nums), ",".join(map(str, nums)),
                          "" if not missing else "缺 %s" % missing))

# ---- 12.1-2 每章末尾引用关系 ----
parts = re.split(r'^## 第\s*(\d+)\s*章', book, flags=re.M)
bad = []
for k in range(1, len(parts) - 1, 2):
    n, body = parts[k], parts[k + 1]
    if "与运行时契约的引用关系" not in body:
        bad.append(n)
chk("12.1-2", "每章末尾有引用关系小节", len(bad) == 0,
    "缺失章：%s" % (",".join(bad) if bad else "无"))

# ---- 12.1-3 积木映射四类载体 ----
# 注意：\w 在 Python Unicode 模式下会匹配中文，必须用 ASCII 字符类限定枚举值
VALID = {"none", "self", "independent", "attached"}
carriers = set(re.findall(r'carrier:\s*([A-Za-z_][A-Za-z0-9_]*)', book))
stray = carriers - VALID
chk("12.1-3", "积木映射到四类载体", len(stray) == 0,
    "越界取值：%s" % (",".join(stray) if stray else "无"))

# ---- 12.1-4 第9章七类表现 ----
m9 = re.search(r'## 第\s*9\s*章(.*?)(?=\n## 第\s*10\s*章)', book, re.S)
c9 = m9.group(1) if m9 else ""
need = ["特效", "音效", "动画", "拖尾", "镜头", "伤害数字", "状态图标"]
hit = [x for x in need if x in c9]
chk("12.1-4", "第9章表现层七类覆盖", len(hit) == 7,
    "覆盖 %d/7（缺 %s）" % (len(hit), "、".join([x for x in need if x not in hit]) or "无"))

# ---- 12.1-5 第13章 12角色 × 多技能 × 水晶池索引 ----
m13 = re.search(r'## 第\s*13\s*章(.*?)(?=\n## 第\s*14\s*章)', book, re.S)
c13 = m13.group(1) if m13 else ""
t = [x for x in ["十二个角色", "水晶池", "分面", "meta.role", "meta.pools"] if x in c13]
chk("12.1-5", "第13章支撑12角色×多技能×水晶池索引", len(t) >= 4,
    "命中关键词 %d/5：%s" % (len(t), "、".join(t)))

# ---- 12.1-6 第16章保存格式与CFG Schema一致 ----
m16 = re.search(r'## 第\s*16\s*章(.*?)(?=\n## 第\s*17\s*章)', book, re.S)
c16 = m16.group(1) if m16 else ""
keys7 = ["schema_version", "skill_id", "meta", "bricks", "params", "presentation", "runtime_hints"]
hitk = [k for k in keys7 if k in c16]
schk = [k for k in keys7 if k in sch]
chk("12.1-6", "第16章保存格式与CFG Schema一致",
    len(hitk) == 7 and len(schk) == 7,
    "第16章 %d/7 键；Schema %d/7 键" % (len(hitk), len(schk)))

# ---- 12.2 运行时补洞 ----
ac = len(set(re.findall(r'AC-[0-9]{2}[A-Z]*-[0-9]{2}', ms)))
chk("12.2-1", "33C/33D入库且AC=83", ac == 83, "AC 去重计数 = %d" % ac)
chk("12.2-2", "运行时失败行为一节已入库", "运行时失败行为" in ms,
    "34.1 节存在：%s" % ("是" if "运行时失败行为" in ms else "否"))
chk("12.2-3", "F-23 收口为已定边界/未启用",
    "F-23" in ms and "未启用" in ms, "F-23 与「未启用」同现：%s" %
    ("是" if ("F-23" in ms and "未启用" in ms) else "否"))

# ---- 12.3 三张交界表 ----
hast = all(x in tbl for x in ["T1", "T2", "T3"])
mn = ["evaded", "budget_drop", "any_reduced_to_zero", "killed"]
cov = sum(1 for x in mn if x in tbl)
chk("12.3-1", "T1/T2/T3入库且T2覆盖最小集合", hast and cov >= 4,
    "三表齐：%s；最小集合 %d/4" % ("是" if hast else "否", cov))

print("=" * 70)
print("第 12 章完成判定 · 逐项核验")
print("=" * 70)
nfail = 0
for i, name, ok, detail in R:
    print("%-9s %-32s %s" % (i, name, "PASS" if ok else "FAIL"))
    print("          %s" % detail)
    if not ok:
        nfail += 1
print("=" * 70)
print("合计 %d 项，通过 %d，失败 %d" % (len(R), len(R) - nfail, nfail))
