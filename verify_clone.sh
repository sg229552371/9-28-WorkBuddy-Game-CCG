#!/usr/bin/env bash
# ============================================================
#  克隆一致性校验（AI-Game / 弹幕背包搜打撤）
#  用法：在仓库根目录执行   bash verify_clone.sh
#  作用：核对当前工作区是否 == 指定快照（2026-10-10 收工版 · APP_VERSION 20261034）
#
#  原理：比对的是 **git 对象哈希**（git rev-parse HEAD:<file>），
#        只看仓库内容，不受 core.autocrlf / 编辑器换行设置影响，
#        Windows(Git Bash) / macOS / Linux 结果完全一致。
#
#  若输出 ❌，说明本地不是该快照，按提示先同步远程：
#      git fetch origin && git reset --hard origin/main
#  （本仓库历史上被 force push 重写过，直接 git pull 可能分叉）
# ============================================================
set -u
cd "$(dirname "$0")" || { echo "❌ 无法进入脚本所在目录"; exit 1; }

EXPECT_VERSION="20261034"

# 核心文件 → 期望的 git blob 哈希（该快照的权威指纹）
EXPECT_FILES="
index.html dc5a3d228ec1b333d0eb65a23113026411e05dc8
js/config.js 456b36cded3f26ea1a52f1b4ec4fec639a0cf7ea
js/game.js 9af37652c4ff17c6b5dbe49b87ba94c35a764f3c
js/combat.js e3b97ce18f5256eaeab48f27f5c346b98621233b
js/items.js 9694445260b5b97b3a4cf6336113afb753510577
js/ui.js d1901b685994e3f7b0a69e50e58c8517719f89f3
js/ui-panels.js 8c50b06869ace1e8e64c158f58d1e4486e8ba5b5
js/main.js 3e304c7c67c0961e935dfe35e155963b8a2470fa
js/core.js c7999993c6d8386347e11991fed4fa105fb0b0ea
js/modes.js 003c55448bb3e68714d171558cdb9a84c22ac681
css/style.css ebb513f69789bdecf74e8a41cad7baa4ffa670d2
run_tests.sh 4ff715e7e7e28e7bd46e1b66d9e0ac52f0b41c36
"

echo "============================================================"
echo " AI-Game 克隆一致性校验"
echo "============================================================"
echo " commit      : $(git rev-parse HEAD 2>/dev/null || echo '??')"
echo " commit(短)  : $(git rev-parse --short HEAD 2>/dev/null || echo '??')"
echo " tree        : $(git rev-parse HEAD^{tree} 2>/dev/null || echo '??')"
echo " 提交日期    : $(git log -1 --format=%ci 2>/dev/null || echo '??')"
echo " 跟踪文件数  : $(git ls-files | wc -l | tr -d ' ')"
echo " 测试文件数  : $(git ls-files '*_test.js' | wc -l | tr -d ' ')"
echo "------------------------------------------------------------"

# ① 版本号
LOCAL_VERSION=$(grep -o 'app-version" content="[0-9]*"' index.html 2>/dev/null | head -1 | grep -o '[0-9]*')
if [ "$LOCAL_VERSION" = "$EXPECT_VERSION" ]; then
  echo " ✅ APP_VERSION = $LOCAL_VERSION（期望 $EXPECT_VERSION）"
  BAD=0
else
  echo " ❌ APP_VERSION = ${LOCAL_VERSION:-缺失}（期望 $EXPECT_VERSION）"
  BAD=1
fi

# ② 核心文件逐个比对（仓库对象哈希）
echo "------------------------------------------------------------"
echo " 核心文件（git blob 哈希）"
while read -r f h; do
  [ -z "$f" ] && continue
  a=$(git rev-parse "HEAD:$f" 2>/dev/null)
  if [ "$a" = "$h" ]; then
    printf " ✅ %-18s %s\n" "$f" "${h:0:12}"
  else
    printf " ❌ %-18s 期望 %s / 实际 %s\n" "$f" "$h" "${a:-缺失}"
    BAD=1
  fi
done <<EOF
$EXPECT_FILES
EOF

# ③ 工作区是否干净（有未提交改动 = 与快照不一致）
echo "------------------------------------------------------------"
DIRTY=$(git status --porcelain | wc -l | tr -d ' ')
if [ "$DIRTY" = "0" ]; then
  echo " ✅ 工作区干净（无未提交改动）"
else
  echo " ⚠️  工作区有 $DIRTY 处未提交改动（不影响快照比对，但回家前建议清理或另存）"
fi

# ④ 结论
echo "============================================================"
if [ "$BAD" = "0" ]; then
  echo " ✅ 一致：本工作区 == 2026-10-10 收工快照（APP_VERSION $EXPECT_VERSION）"
  echo "    继续开发前可跑一次全量门禁：bash run_tests.sh"
  echo "    期望结果：76 套 / PASS 合计 = 3368 / bad = 0 / 全绿"
else
  echo " ❌ 不一致：本地不是该快照，请先同步远程："
  echo "     git fetch origin && git reset --hard origin/main"
  echo "    （本仓库历史被 force push 重写过，直接 git pull 可能分叉）"
fi
echo "============================================================"
exit "$BAD"
