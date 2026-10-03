#!/usr/bin/env bash
# 全量测试运行器（跨平台：Windows Git Bash / Linux / macOS / 云端沙箱）
# 用法：bash run_tests.sh
#
# 判绿标准：每个测试 exit=0 且 bad=0（bad = FAIL|Assertion failed|Error 计数）
# 只看退出码或只 grep 一个关键词都会漏：部分测试用 console.assert，失败只写 stderr、不改退出码。
# （所以 pass=0 不代表没有断言 —— 那是该测试走 console.assert，只能靠 exit 码 + bad 判定。）
#
# 实现注意：本机沙箱有「安全删除保护」，rm 掉 mktemp 生成的临时文件会被拦截并卡住脚本，
# 所以这里全部用命令替换捕获输出，不落任何临时文件。

set -u

TESTS="smoke_test runtime_test backpack_test econ_test skill_module_test \
team_trigger_test artisan_test ui_flow_test rift_test extract_test shop_test \
skill_table_test autofight_test mobile_test boss_test bugfix_test grant_test freeze_test exp_test \
ui_v2_test levelup_test chip_test laser_test chip_behavior_test content_test \
level_content_test meta_growth_test audio_sprite_test hero_roster_test unlock_ui_test sprite_view_test"

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

echo "node = $NODE"
echo "----------------------------------------"

total_pass=0
total_bad=0
failed_list=""

for t in $TESTS; do
  if [ ! -f "$t.js" ]; then
    printf "%-20s MISSING\n" "$t"
    failed_list="$failed_list $t(缺失)"
    total_bad=$((total_bad + 1))
    continue
  fi

  # stdout + stderr 合并捕获（console.assert 的失败只写 stderr）
  out="$("$NODE" "$t.js" 2>&1)"
  code=$?
  n=$(printf '%s\n' "$out" | grep -ci "Assertion failed\|FAIL\|Error")
  p=$(printf '%s\n' "$out" | grep -c "^PASS ")

  total_pass=$((total_pass + p))

  if [ "$code" -eq 0 ] && [ "$n" -eq 0 ]; then
    printf "%-20s exit=0 bad=0 pass=%s\n" "$t" "$p"
  else
    if [ "$code" -ne 0 ] && [ "$n" -eq 0 ]; then
      n=1
    fi
    printf "%-20s exit=%s bad=%s  <-- 失败\n" "$t" "$code" "$n"
    printf '%s\n' "$out" | grep -i "Assertion failed\|FAIL\|Error" | head -5 | sed 's/^/    | /'
    failed_list="$failed_list $t"
    total_bad=$((total_bad + n))
  fi
done

echo "----------------------------------------"
echo "PASS 合计 = $total_pass   bad = $total_bad"
if [ "$total_bad" -ne 0 ]; then
  echo "失败项：$failed_list"
  exit 1
fi
echo "全绿"
