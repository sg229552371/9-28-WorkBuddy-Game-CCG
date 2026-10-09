#!/usr/bin/env bash
# 全量测试运行器（跨平台：Windows Git Bash / Linux / macOS / 云端沙箱）
# 用法：
#   bash run_tests.sh              # 全量门禁（4 套件并行，口径不变：exit=0 且 bad=0）
#   bash run_tests.sh --quick      # 快速模式 = core 套件 + 冒烟（日常开发用，非全量）
#   bash run_tests.sh --suite=ui   # 只跑某个套件（core|ui|feature|perf）
#   bash run_tests.sh --list       # 列出套件与测试
#
# 判绿标准：每个测试 exit=0 且 bad=0（bad = FAIL|Assertion failed|Error 计数）
# 只看退出码或只 grep 一个关键词都会漏：部分测试用 console.assert，失败只写 stderr、不改退出码。
# （所以 pass=0 不代表没有断言 —— 那是该测试走 console.assert，只能靠 exit 码 + bad 判定。）
#
# 口径铁律（dev_guide 10.3 坑 4）：PASS 文案不能含英文 "error"；pass 计数按行首 `^PASS `。
# 本脚本只做「分组 + 并行」，不改任何口径；汇总两行格式与串行版逐字一致。
#
# 并行实现：所有测试放进一个全局作业池并发执行（并发数 = min(核心数, 8)），
# 每个测试把 stdout/stderr 与结果写入临时文件；结束后按固定套件顺序汇总打印，
# 保证输出稳定可读、与运行顺序无关。

set -u

# --- 套件分组（组内顺序 = 原 TESTS 顺序；26.x 新增 battle_rules_test / altar_timeline_test）---
# 2026-10-09 新增 boss_ux_test（Boss 体验四件套：贴图区分 / 吞噬反馈 / 招式名横幅 / 转阶段宝箱）。
# 26.x 新增 hero_kit_test（12 角重做四件套：属性说明 / 近战引擎 / 特色技能零重复 / scaleBy 属性成长 / 辅助三件套）。
# ⚠️ 21.20「层级退役」曾把 endless_affix/arena/record/team_test 连同已下线的 endless-tier_test 一起摘掉，
#    但前 4 个模块（js/endless-affix|arena|record|team.js）**至今仍被 index.html 加载并在运行**
#    （EndlessRecord 就是战绩榜在用的模块），摘掉 = 白丢覆盖。2026-10-09 已全部加回。
CORE="smoke_test runtime_test econ_test backpack_test skill_module_test skill_table_test \
chip_test chip_behavior_test levelup_test exp_test grant_test freeze_test \
team_trigger_test content_test level_content_test level_tuning_test meta_growth_test \
out_level_flow_test settle_crystal_test boot_guard_test cache_version_test perf_asset_test \
asset_timeout_test \
battle_rules_test"

UI="ui_flow_test ui_v2_test ui_layout_test ui_global_test unlock_ui_test \
mobile_test mobile_ctrl_test mobile_polish_test artisan_test artisan_layout_test \
hero_roster_test hero_kit_test hero_portrait_test sprite_view_test camera_view_test audio_sprite_test autofight_test \
endless_hud_test"

FEATURE="rift_test extract_test boss_test boss_ux_test bugfix_test shop_test laser_test season_test \
levels_11_20_test special_monster_test assets_hook_test stress_test \
endless_test endless_flow_test hud_endless_test endless_reward_test rift_extract_test rift_hud_test endless_growth_test \
endless_restart_test \
endless_affix_test endless_arena_test endless_record_test endless_team_test \
ui_abyss_test endless_pause_test altar_timeline_test"

PERF="perf_test perf_guard_test quality_tier_test render_opt_test spatial_test pool_test low_quality_test"

SUITES="core ui feature perf"

suite_tests() {
  case "$1" in
    core)    echo "$CORE" ;;
    ui)      echo "$UI" ;;
    feature) echo "$FEATURE" ;;
    perf)    echo "$PERF" ;;
  esac
}

# --- 参数解析 ---
MODE="full"
ONLY_SUITE=""
for arg in "$@"; do
  case "$arg" in
    --quick)          MODE="quick" ;;
    --suite=*)        ONLY_SUITE="${arg#--suite=}" ;;
    --list)           MODE="list" ;;
    -h|--help)
      echo "用法: bash run_tests.sh [--quick | --suite=core|ui|feature|perf | --list]"
      exit 0 ;;
    *)
      echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "list" ]; then
  for s in $SUITES; do
    echo "[$s]"
    for t in $(suite_tests "$s"); do echo "  $t"; done
  done
  exit 0
fi

if [ -n "$ONLY_SUITE" ]; then
  valid=""
  for s in $SUITES; do [ "$s" = "$ONLY_SUITE" ] && valid=1; done
  if [ -z "$valid" ]; then
    echo "未知套件: $ONLY_SUITE（可选: $SUITES）" >&2; exit 2
  fi
  MODE="suite"
fi

# --- 选 node：优先 PATH 里的 node，其次本机 WorkBuddy 托管运行时 ---
NODE="${NODE:-}"
if [ -z "$NODE" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE="node"
  elif [ -x "C:/Users/jinyishun/.workbuddy/binaries/node/versions/22.22.2-3/node.exe" ]; then
    NODE="C:/Users/jinyishun/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
  else
    echo "找不到 node，请设置 NODE 环境变量" >&2
    exit 2
  fi
fi

# --- 决定要跑哪些套件 ---
RUN_SUITES=""
case "$MODE" in
  full)  RUN_SUITES="$SUITES" ;;
  quick) RUN_SUITES="core" ;;
  suite) RUN_SUITES="$ONLY_SUITE" ;;
esac

# 并发上限 = min(核心数, 8)，避免过载反而变慢
CORES="$( (command -v nproc >/dev/null 2>&1 && nproc) || (command -v sysctl >/dev/null 2>&1 && sysctl -n hw.ncpu) || echo 4 )"
MAXJ=8
[ "$CORES" -lt "$MAXJ" ] && MAXJ="$CORES"
[ "$MAXJ" -lt 1 ] && MAXJ=1

# --- 临时目录（结果落盘，避免乱序；不依赖 mktemp 以防沙箱拦截）---
WORK="${TMPDIR:-/tmp}/run_tests_$$"
mkdir -p "$WORK" 2>/dev/null || WORK="./.run_tests_$$"
mkdir -p "$WORK"
cleanup() { rm -rf "$WORK" 2>/dev/null || true; }
trap cleanup EXIT

echo "node = $NODE"
[ "$MODE" = "quick" ] && echo "===== QUICK 模式（仅 core + 冒烟，未跑全量）====="
[ "$MODE" = "suite" ] && echo "===== 单套件模式：$ONLY_SUITE ====="
echo "并发 = $MAXJ（核心数 $CORES）"
echo "----------------------------------------"

# --- 单个测试：跑一次、算 bad/pass、写结果文件 ---
run_one() {
  t="$1"
  if [ ! -f "$t.js" ]; then
    printf "MISSING\n"        > "$WORK/$t.code"
    printf "0\n"              > "$WORK/$t.pass"
    printf "1\n"              > "$WORK/$t.bad"
    : > "$WORK/$t.out"
    return
  fi
  out="$("$NODE" "$t.js" 2>&1)"
  code=$?
  n=$(printf '%s\n' "$out" | grep -ci "Assertion failed\|FAIL\|Error")
  p=$(printf '%s\n' "$out" | grep -c "^PASS ")
  if [ "$code" -ne 0 ] && [ "$n" -eq 0 ]; then n=1; fi
  printf '%s\n' "$code" > "$WORK/$t.code"
  printf '%s\n' "$p"    > "$WORK/$t.pass"
  printf '%s\n' "$n"    > "$WORK/$t.bad"
  printf '%s\n' "$out"  > "$WORK/$t.out"
}

# --- 收集所有待跑测试，构建全局作业池 ---
ALL=""
for s in $RUN_SUITES; do
  for t in $(suite_tests "$s"); do ALL="$ALL $t"; done
done

running=0
for t in $ALL; do
  while [ "$running" -ge "$MAXJ" ]; do
    wait -n 2>/dev/null || true
    running=$((running - 1))
  done
  run_one "$t" &
  running=$((running + 1))
done
wait

# --- 按固定顺序汇总打印（口径与串行版逐字一致）---
total_pass=0
total_bad=0
failed_list=""

for s in $RUN_SUITES; do
  echo "[$s]"
  for t in $(suite_tests "$s"); do
    if [ ! -f "$WORK/$t.code" ]; then
      continue
    fi
    code="$(cat "$WORK/$t.code")"
    p="$(cat "$WORK/$t.pass")"
    n="$(cat "$WORK/$t.bad")"
    total_pass=$((total_pass + p))

    if [ "$code" = "MISSING" ]; then
      printf "%-20s MISSING\n" "$t"
      failed_list="$failed_list $t(缺失)"
      total_bad=$((total_bad + 1))
    elif [ "$code" -eq 0 ] && [ "$n" -eq 0 ]; then
      printf "%-20s exit=0 bad=0 pass=%s\n" "$t" "$p"
    else
      printf "%-20s exit=%s bad=%s  <-- 失败\n" "$t" "$code" "$n"
      grep -i "Assertion failed\|FAIL\|Error" "$WORK/$t.out" | head -5 | sed 's/^/    | /'
      failed_list="$failed_list $t"
      total_bad=$((total_bad + n))
    fi
  done
done

echo "----------------------------------------"
echo "PASS 合计 = $total_pass   bad = $total_bad"
if [ "$total_bad" -ne 0 ]; then
  echo "失败项：$failed_list"
  exit 1
fi
echo "全绿"
if [ "$MODE" = "quick" ]; then
  echo "（QUICK 模式：仅 core 套件 + 冒烟，未跑全量！）"
fi
# 显式 exit 0：否则末行 `[ cond ] && echo` 在条件为假时会让脚本返回 1，
# 全量模式下即使 "全绿" 也会被 push.sh 误判为失败（历史 bug，2026-10-09 修）。
exit 0
