# -*- coding: utf-8 -*-
"""apply 运行时补洞补丁到主书稿 v0.2.6 -> v0.2.7
规则：按行号降序执行（避免行号漂移）；每条操作先做文字锚点校验；失败即停并报告。
"""
import io, os, re, sys, shutil

BASE = r"D:/AI-game-All/HTML_TEST_002/Game_v0.0.1/G_docs/技能系统V0.0.2"
DOC  = os.path.join(BASE, "技能系统_需求交接包_2026-10-18", "01_主书稿_运行时契约", "全新技能系统设计书_v0.2.md")
PATCH= os.path.join(BASE, "运行时补洞_补丁草案_v0.1.md")

lines = io.open(DOC, encoding="utf-8").read().split("\n")
ptxt  = io.open(PATCH, encoding="utf-8").read()
plines= ptxt.split("\n")

def block(tag):
    """从补丁中提取 <!-- 原文开始：tag --> ... <!-- 原文结束：tag --> 之间的正文"""
    s = e = -1
    for i, l in enumerate(plines):
        if l.strip() == "<!-- 原文开始：%s -->" % tag: s = i
        if l.strip() == "<!-- 原文结束：%s -->" % tag: e = i
    if s < 0 or e < 0 or e <= s:
        raise SystemExit("提取原文块失败: %s" % tag)
    return plines[s+1:e]

BLK_33C   = block("33C")
BLK_33D   = block("33D")
BLK_369   = block("36.9新增行")
BLK_341   = block("34.1")
BLK_64REF = block("6.4交叉引用")
BLK_33B3A = block("33B.3A")
BLK_CSTAT = block("附录C状态说明")
BLK_C110  = block("C.1.10")

CFG_RUNTIME_FAILURE = """  cfg_placeholders: # 〔2026-10-18 第1轮〕
    runtime_failure:
      schema_path: params.runtime_failure
      author_locked: true
      unknown_skill: skip_with_debug_record
      invalid_field_type: skip_with_debug_record
      unknown_modifier_target: skip_with_debug_record
      budget_exhausted: skip_with_debug_record
      schema_version_mismatch: degrade
    control_dr: # 〔2026-10-18 第1轮〕
      schema_path: params.control_dr
      status: bounded_not_enabled
      enabled: false
      target_tag: control_dr
      multipliers: [1.0, 0.5, 0.25, 0.0]
      reset_window_seconds: 18.0
      reset_from: last_control_end
      buckets: []""".split("\n")

# (行号1-based, 类型, 锚点文字片段, 载荷)
# 类型 R=替换该行  AI=在该行之后插入  AB=在该行之前插入
OPS = [
 (4340, "R", "F-23",
  "| F-23 | 第16—22章 | 控制递减的启用与配置边界 | **已定边界、未启用**；默认enabled=false；仅目标control_dr标签适用；阶梯[1.0,0.5,0.25,0]；18秒窗口从最后实际控制结束起算，见D-100／D-115〔推荐默认〕〔2026-10-18 第1轮〕 | 22.8、33B.3A、附录B的runtime.cfg_placeholders.control_dr |"),
 (4288, "AI", "v0.2.6",
  "| v0.2.7 | 2026-10-18 | 第1轮运行时补洞：新增33C增益／减益、33D召唤，各5条AC，验收73→83；新增34.1五类失败行为与config_error诊断枚举，登记D-108…D-115；6.4交叉引用T2；F-23已定边界、未启用，补CFG占位并同步状态。既有14条已确认决策原文不动，不修改游戏代码，不新增性能验收指标。〔2026-10-18 第1轮〕 |"),
 (4217, "R", "D-90",
  "- D-90…D-115：已分配；第二至第四轮见C.1.7—C.1.9，本轮D-108…D-115见C.1.10。D-116及以后未分配。〔2026-10-18 第1轮〕"),
 (4208, "R", "R9 debug_record",
  "| R9 debug_record | 非事件非结算记录；kind=budget_drop/proc_blocked/gen_limit/config_error；任何层不得订阅，正式UI不得读取 | 推荐默认 | D-19d、D-39、D-84、D-94；配置诊断扩展见34.1及D-108—D-112〔2026-10-18 第1轮〕 |"),
 (4194, "AI", "D-107", BLK_C110),
 (4177, "R", "D-100",
  "| D-100 | 控制递减候选C（仅带 control_dr 标签的目标递减） | 推荐默认 | 33B | F-23已定边界、未启用；33B.3A与D-115补齐CFG占位，默认不递减；替代原待确认状态，不提升为用户已确认。〔2026-10-18 第1轮〕 |"),
 (4017, "R", "状态只有三种", BLK_CSTAT),
 (4010, "AI", "dead_target_no_new_hit", CFG_RUNTIME_FAILURE),
 (3940, "R", "kinds:",
  "  kinds: [budget_drop, proc_blocked, gen_limit, config_error] # 〔2026-10-18 第1轮〕"),
 (3870, "R", "version:",
  "  version: v0.2.7 # 〔2026-10-18 第1轮〕"),
 (3859, "R", "待用户确认",
  "| 待用户确认 | 方向性、需用户表态；本轮无此状态条目，F-23已转为“已定边界、未启用”，不代表用户确认递减规则〔2026-10-18 第1轮〕 | 第2章、33B.3A |"),
 (3841, "R", "debug_record",
  "| `debug_record` | 非事件、非结算记录，仅供测试与调试；任何层不得订阅触发逻辑；kind：`budget_drop`、`proc_blocked`、`gen_limit`、`config_error`〔2026-10-18 第1轮〕 | 6.7、34.1、36.5 |"),
 (3738, "R", "36.9 验收行汇总",
  "## 36.9 验收行汇总（自动抽取，共83行；历史62→63→73，本轮73→83，新增AC-33C-01…05、AC-33D-01…05）〔2026-10-18 第1轮〕"),
 (3727, "R", "见第27",
  "见第27—33章、第33A—33D章各章末尾的验收行；全部验收行汇总见36.9。原有73条保留，本轮新增33C增益／减益、33D召唤两个案例，各5条，合计83条；不复用 AC-36 的19—29保留段。〔2026-10-18 第1轮〕"),
 (3725, "R", "36.8.2",
  "### 36.8.2 贯穿案例验收（AC-27…AC-33、AC-33A…AC-33D）"),
 (3677, "R", "debug_record",
  "| `debug_record` | `kind`（`budget_drop`／`proc_blocked`／`gen_limit`／`config_error`） `detail` `tick` | 仅测试与调试，任何层不得订阅触发逻辑；正式 UI 与游戏逻辑层不得读取，仅调试面板／性能分析工具可读；`config_error` 见34.1，D-108—D-112〔推荐默认〕〔2026-10-18 第1轮〕 |"),
 (3584, "AI", "interrupted", BLK_341),
 (3562, "AB", "第七部", BLK_33C + [""] + BLK_33D),
 (3512, "AI", "刷新（D-46", BLK_33B3A),
 (3511, "R", "递减（F-23）",
  "| 递减（F-23） | 本卡默认不启用；状态为已定边界、未启用。采用D-100目标标签方向，D-115补齐阶梯与18秒结束后窗口；配置和未来启用语义见33B.3A。不新增事件、不改变RNG抽取次数。〔2026-10-18 第1轮〕 |"),
 (3490, "R", "修饰器接口",
  "| **修饰器接口** | 暴露：`stun_duration_ticks`、`knockback_distance`、`radius`。递减参数不暴露；F-23已定边界、未启用，CFG占位见33B.3A。〔2026-10-18 第1轮〕 |"),
 (2139, "R", "叠加",
  "| 叠加 | 同类控制默认刷新单例，刷新=重置为满寿命（D-46）；需要取剩余与新值较大者时，由设计卡显式声明 restack_rule: keep_longer（D-101），默认不启用该选项。控制递减F-23为已定边界、未启用；标签、阶梯、18秒窗口见33B.3A，默认不递减。〔2026-10-18 第1轮〕 |"),
 (1474, "R", "kind",
  "| `kind` | 本章预算诊断只用 `budget_drop`；全书取值为 `budget_drop`、`proc_blocked`、`gen_limit`、`config_error`；后者仅用于34.1配置失败〔2026-10-18 第1轮〕 |"),
 (511,  "AI", "gen_limit",
  ["| `config_error` | 配置接纳、技能引用或修饰器字段校验失败；detail 说明具体路径与处置 | 34.1；D-108、D-109、D-110、D-112〔推荐默认〕〔2026-10-18 第1轮〕 |"]),
 (471,  "AI", "purge", BLK_64REF),
 (127,  "R", "待用户确认",
  "| **待用户确认** | 影响方向、需要用户明确表态 | 本轮无此状态条目；F-23转为“已定边界、未启用”，其规则仍为推荐默认〔2026-10-18 第1轮〕 |"),
 (5,    "R", "版本",
  "> **版本：书稿v0.2（当前v0.2.7，2026-10-18 第1轮运行时补洞）**"),
]

# 额外：36.9 中在最后一条 AC-33B-05 汇总行之后插入十行（文字定位）
def insert_ac_rows(lines):
    idxs = [i for i, l in enumerate(lines) if "AC-33B-05" in l]
    # 案例章与 36.9 汇总各一处，取后者（汇总表行号更大）
    if not idxs:
        raise SystemExit("AC-33B-05 定位失败，零命中")
    start = idxs[-1]
    # 找该行之后第一个 AC-36-01 行
    nxt = None
    for j in range(start + 1, len(lines)):
        if "AC-36-01" in lines[j]:
            nxt = j; break
    if nxt is None:
        raise SystemExit("AC-36-01 定位失败")
    return lines[:nxt] + BLK_369 + lines[nxt:]

backup = DOC + ".bak_v026"
if not os.path.exists(backup):
    shutil.copy2(DOC, backup)
print("备份 -> %s" % os.path.basename(backup))

OPS.sort(key=lambda x: -x[0])
done = []
for ln, kind, anchor, payload in OPS:
    i = ln - 1
    if not (0 <= i < len(lines)):
        raise SystemExit("行号越界 L%d" % ln)
    if anchor not in lines[i]:
        raise SystemExit("锚点校验失败 L%d: 期望含『%s』实际『%s』" % (ln, anchor, lines[i][:80]))
    if isinstance(payload, str):
        payload = [payload]
    if kind == "R":
        lines[i:i+1] = payload
    elif kind == "AI":
        lines[i+1:i+1] = payload
    elif kind == "AB":
        lines[i:i] = payload
    done.append("L%-5d %s %s" % (ln, kind, anchor))
    print("  OK  L%-5d %s  %s" % (ln, kind, anchor))

lines = insert_ac_rows(lines)
print("  OK  36.9 新增 AC 十行（AC-33B-05 之后 / AC-36-01 之前）")

io.open(DOC, "w", encoding="utf-8").write("\n".join(lines))
print("\napply 完成：%d 处正文操作 + 1 处 AC 汇总插入" % len(OPS))
print("文件大小 %d -> %d 字节" % (os.path.getsize(backup), os.path.getsize(DOC)))
