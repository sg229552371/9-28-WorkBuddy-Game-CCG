# -*- coding: utf-8 -*-
"""R6 回放格式 apply：插入 14.11 节 + 登记 C.1.11 + 更新 C.3 可用性声明"""
import io, os, re, shutil, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "_tasks", "out_M_R6回放格式.md")
TARGET = os.path.join(BASE, "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约",
                      "全新技能系统设计书_v0.2.md")
BAK = TARGET + ".bak_v028"

# ---- 备份 ----
if not os.path.exists(BAK):
    shutil.copy2(TARGET, BAK)
    print("[备份] -> %s" % os.path.basename(BAK))
else:
    print("[备份] 已存在，跳过")

lines = io.open(TARGET, encoding="utf-8").read().split("\n")
src = io.open(SRC, encoding="utf-8").read()

# ---- 提取草案 1-6 节 ----
m = re.search(r'^## 1\..*?(?=^## 7\.)', src, re.S | re.M)
if not m:
    raise SystemExit("未提取到草案 1-6 节")
body = m.group(0).rstrip()

# 转成 14.11.x
def conv(mm):
    return "### 14.11.%s %s" % (mm.group(1), mm.group(2))
body = re.sub(r'^## (\d)\. (.+)$', conv, body, flags=re.M)

sec = "## 14.11 单机回放格式〔2026-10-18 第 3 轮〕\n\n" + body
sec_lines = sec.split("\n")

# ---- 定位插入点（14.11）----
anchor = None
for i, l in enumerate(lines):
    if l.startswith("| 14.8 防霰弹 |"):
        anchor = i
        break
if anchor is None:
    raise SystemExit("未找到 14.8 防霰弹 锚点")
# 确认后面第一个非空行是「## 常见误写」
j = anchor + 1
while j < len(lines) and lines[j].strip() == "":
    j += 1
if not lines[j].startswith("## 常见误写"):
    raise SystemExit("后锚点不符，实际为：%s" % lines[j][:60])
print("[锚点] 14.11 插入于第 %d 行之后（原 14.8 行）" % (anchor + 1))

# ---- 定位 C.3 位置（在插入 14.11 之前先算，因 C.3 在后面，行号不受影响）----
c3 = None
for i, l in enumerate(lines):
    if l.startswith("## C.3 "):
        c3 = i
        break
if c3 is None:
    raise SystemExit("未找到 C.3 锚点")
print("[锚点] C.3 在第 %d 行" % (c3 + 1))

c111 = """### C.1.11 单机回放格式登记（D-116…D-118）〔2026-10-18 第 3 轮〕

| 编号 | 决策 | 状态 | 章节 | 备注 |
|---|---|---|---|---|
| D-116 | 单机回放以版本三元组、逻辑种子、固定时间轴、固化开局条件和有序输入重算；表现 RNG 与检索元数据不参与逻辑 | 推荐默认 | 14.11 | 对应 14.11.1–14.11.2；替代"录制画面"思路 |
| D-117 | 逻辑状态按稳定标识规范化后生成累计链校验和；以可选检查点与终局摘要验证；稀疏点只给区间，精确首差需可信参考重算 | 推荐默认 | 14.11 | 对应 14.11.3–14.11.4；校验和不得含渲染字段 |
| D-118 | 版本不匹配禁止静默比较；基线从 0 tick 起算；快照起播须另审、具自身校验和且不含输入序列；本格式不扩展联机或跨平台位级一致承诺 | 推荐默认 | 14.11 | 对应 14.11.5–14.11.6；对齐 14.9 边界 |

"""

# ---- 降序执行：先 C.1.11（行号大），再 14.11（行号小）----
lines[c3:c3] = c111.split("\n")

lines[anchor + 1:anchor + 1] = [""] + sec_lines + [""]

# ---- 更新 C.3 可用性声明 ----
old_decl = "- D-90…D-115：已分配；第二至第四轮见C.1.7—C.1.9，本轮D-108…D-115见C.1.10。D-116及以后未分配。〔2026-10-18 第1轮〕"
new_decl = ("- D-90…D-115：已分配；第二至第四轮见C.1.7—C.1.9，D-108…D-115见C.1.10。〔2026-10-18 第1轮〕\n"
            "- D-116…D-118：已分配，见 C.1.11（单机回放格式）。**D-119 及以后未分配**。〔2026-10-18 第 3 轮〕")
hit = 0
for i, l in enumerate(lines):
    if l == old_decl:
        lines[i] = new_decl
        hit = 1
        break
if not hit:
    raise SystemExit("C.3 可用性声明未匹配，未落盘")

io.open(TARGET, "w", encoding="utf-8", newline="").write("\n".join(lines))
print("[APPLY 完成] 新大小 %d 字节 / %d 行" % (os.path.getsize(TARGET), len(lines)))
print("  插入 14.11 节：%d 行" % len(sec_lines))
print("  插入 C.1.11 登记：3 条决策")
print("  更新 C.3：D-116…D-118 已分配，D-119 起未分配")
