#!/usr/bin/env bash
# ============================================================================
# Godot 侧测试门禁（口径对齐 HTLM/run_tests.sh：exit=0 且 bad=0，PASS 文案禁英文 error）
# 用法：bash tests/run_godot_tests.sh   （可用环境变量 GODOT_EXE 覆盖可执行路径）
# ============================================================================
set -u
GODOT_EXE="${GODOT_EXE:-C:/Users/Administrator/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$GODOT_EXE" ]; then
  echo "❌ 未找到 Godot 可执行: $GODOT_EXE（用 GODOT_EXE=路径 覆盖）"
  exit 1
fi

# 首次/资源变更后先导入（headless，静默）
"$GODOT_EXE" --headless --path "$ROOT" --import >/dev/null 2>&1

OUT="$("$GODOT_EXE" --headless --path "$ROOT" -s addons/gut/gut_cmdln.gd \
  -gdir=res://tests/unit -ginclude_subdirs -gexit 2>&1)"
CODE=$?
echo "$OUT" | tail -20

if [ $CODE -ne 0 ]; then
  echo "----------------------------------------"
  echo "Godot 门禁：失败（exit=$CODE）"
  exit 1
fi

# GUT 可能 exit=0 但有用例失败，输出里兜底核对
if echo "$OUT" | grep -qE "failures?[^0-9]*[1-9]"; then
  echo "----------------------------------------"
  echo "Godot 门禁：存在失败用例"
  exit 1
fi

echo "----------------------------------------"
echo "Godot 门禁：全绿（exit=0，无失败用例）"
