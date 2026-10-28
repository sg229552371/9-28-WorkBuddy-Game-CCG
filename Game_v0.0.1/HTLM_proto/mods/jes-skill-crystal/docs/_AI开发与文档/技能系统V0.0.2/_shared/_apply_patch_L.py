# -*- coding: utf-8 -*-
"""
B 类一致性定正补丁 apply 脚本
特性：备份 -> 解析草案 -> 锚点文字校验 -> 行号降序执行 -> 失败不落盘
"""
import io, os, re, shutil, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATCH = os.path.join(BASE, "B类一致性定正_补丁草案_v0.1.md")
TARGET = os.path.join(
    BASE, "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约", "全新技能系统设计书_v0.2.md"
)
BAK = TARGET + ".bak_v027"

if not os.path.exists(PATCH):
    raise SystemExit("补丁草案不存在: %s" % PATCH)
if not os.path.exists(TARGET):
    raise SystemExit("目标文件不存在: %s" % TARGET)

# ---------- 1. 备份 ----------
if not os.path.exists(BAK):
    shutil.copy2(TARGET, BAK)
    print("[备份] %s -> %s" % (os.path.basename(TARGET), os.path.basename(BAK)))
else:
    print("[备份] 已存在，跳过：%s" % os.path.basename(BAK))

# ---------- 2. 解析补丁草案 ----------
raw = io.open(PATCH, encoding="utf-8").read()

# 匹配：**L3577｜当前行3577｜行内替换（整行）** ... 原文：```text\n...\n``` 新文本：```text\n...\n```
pat = re.compile(
    r"\*\*L(\d+)｜当前行(\d+)｜([^｜*]+?)\*\*.*?原文：\s*```text\s*\n(.*?)\n```\s*新文本：\s*```text\s*\n(.*?)\n```",
    re.S,
)

ops = []
for m in pat.finditer(raw):
    op_id, line_no, op_type, old_txt, new_txt = m.groups()
    ops.append({
        "id": "L" + op_id,
        "line": int(line_no),
        "type": op_type.strip(),
        "old": old_txt.rstrip("\n"),
        "new": new_txt.rstrip("\n"),
    })

print("[解析] 共识别出 %d 条操作指令" % len(ops))
if not ops:
    raise SystemExit("未解析出任何操作指令，检查草案格式")

# 去重（同一行号可能重复出现）
seen = {}
for o in ops:
    if o["line"] in seen:
        print("  [警告] 行号 %d 出现多次，保留首次" % o["line"])
        continue
    seen[o["line"]] = o
ops = list(seen.values())
print("[解析] 去重后 %d 条" % len(ops))

# ---------- 3. 读取目标文件 ----------
lines = io.open(TARGET, encoding="utf-8").read().split("\n")
total = len(lines)
print("[目标] %s  %d 行 / %d 字节" % (os.path.basename(TARGET), total, os.path.getsize(TARGET)))

# ---------- 4. 锚点校验 ----------
ok, fail = [], []
for o in ops:
    ln = o["line"]
    if ln < 1 or ln > total:
        fail.append((o["id"], ln, "行号越界（文件仅 %d 行）" % total))
        continue
    cur = lines[ln - 1]
    if cur.rstrip() != o["old"].rstrip():
        fail.append((o["id"], ln, "原文不匹配"))
        continue
    ok.append(o)

print()
print("=" * 68)
print("锚点校验：通过 %d / %d" % (len(ok), len(ops)))
for fid, ln, why in fail:
    print("  X %-8s 行%d  %s" % (fid, ln, why))
    print("      当前: %s" % lines[ln - 1][:100])
print("=" * 68)

if fail:
    print()
    print("存在校验失败，按铁律**不落盘**。请修正草案后重跑。")
    sys.exit(1)

# ---------- 5. 降序执行 ----------
ok.sort(key=lambda x: -x["line"])
for o in ok:
    lines[o["line"] - 1] = o["new"]

out = "\n".join(lines)
io.open(TARGET, "w", encoding="utf-8", newline="").write(out)

print()
print("[APPLY 完成] %d 条操作已写入" % len(ok))
print("  新大小: %d 字节" % os.path.getsize(TARGET))
print()
print("=" * 68)
print("请执行复跑校验：")
print("  1. AC 去重计数应仍 = 83")
print("  2. events 仍 [hit, vanish]")
print("  3. carriers 仍 [none, self, independent, attached]")
print("  4. 14 条已确认决策逐字未动")
print("  5. 普攻/弹幕实体/技能对象 旧词 = 0")
print("  6. 无 instant 作 carrier 枚举")
