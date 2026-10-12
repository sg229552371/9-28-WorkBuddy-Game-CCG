#!/usr/bin/env bash
# ============================================================
#  克隆一致性校验（AI-Game / 弹幕背包搜打撤）
#  用法：在仓库根目录执行   bash verify_clone.sh
#  作用：核对当前工作区是否 == 指定快照
#        （2026-10-12 经济修复：秘宝撤离折算 + Boss 结晶击败即发 + 门禁去随机化 · APP_VERSION 20261047 · 98 套 / 4191）
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

# ---- 自动适配「脚本位于仓库子目录」的情况 ----
# 项目拆分后脚本可能位于 old_Game/ 或 Game_v0.0.1/，此时 git 对象路径需要带前缀。
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
# Git Bash 下 --show-toplevel 返回 "F:/..." 而 pwd 返回 "/f/..."，需归一化为同一路径形式
if [ -n "$REPO_ROOT" ]; then
  REPO_ROOT=$(cd "$REPO_ROOT" 2>/dev/null && pwd || echo "$REPO_ROOT")
fi
SELF_DIR=$(pwd)
PREFIX=""
if [ -n "$REPO_ROOT" ]; then
  case "$SELF_DIR" in
    "$REPO_ROOT"/*) PREFIX="${SELF_DIR#"$REPO_ROOT"/}/" ;;
  esac
fi

EXPECT_VERSION="20261048"

# 核心文件 → 期望的 git blob 哈希（该快照的权威指纹；23 个）
EXPECT_FILES="
index.html a86d75447623118c16a1c0e518e8d218a8be9620
js/config.js 1ebca588ff5346e592a5aec9ac7a2219c635c071
js/game.js c39f87462e0470c24964a7c2958095350fceea69
js/combat.js a1edcd52e0175757af96e469b09ccf5acf2c9c68
js/items.js 57c3fe551b8c24baf5ca237f4e9f04ec7390564a
js/ui.js d8ae96866382904b7140e88ef82a11f2606214f8
js/ui-panels.js c04f72855cdf1daa5de016d71afdc88a21adc9b9
js/main.js f535f112baaa290e3c34049ee642c9e59f9797ac
js/core.js 994b306483fd54e3375a4c343745b3ebc96b34df
js/modes.js 274ba9e319b532e451efab24f0c80523e0879122
css/style.css 49a277f655d8e5f9db426e994aac80e67513b891
run_tests.sh 98597cf50a7fd726d635756a2d5208db80d405b6
js/skill-compiler.js 7e92332cc376979f069273532646ff12a99a3e73
js/skill-playtest.js da357b70fe57a56a06617a35a21e32d68c39efe8
js/skill-scheduler.js b4d4598650d601293667c58829689f6886f4a346
js/skill-config.js 0f90f3e750c6bfd3bb4fc3fe30a4f65ac4e2c411
js/skill-runtime.js 3c98ef41509e1c2d1c7621642aaf2e4482d3d1e3
js/skill-events.js a2fa6c17807b6ba7242a0197b58b87f4d9f1fe7e
skill_playtest_test.js ee6be680cd83bcab7c5c458642e04e978797c913
skill_rule_binding_test.js ee36d2281b59b8f384a7a1082fc81a5ab22d0bf2
crystal_ui_test.js 68adf392e953f33913a96472c397c05117ef8d75
crystal_expansion_test.js a8a4e5fdc54689694a9f214616d2aba315b9baff
skill_enable_runtime_test.js 436cefdd5f3208d5a69a4ba569f3c39233ed5871
"

echo "============================================================"
echo " AI-Game 克隆一致性校验"
echo "============================================================"
echo " commit      : $(git rev-parse HEAD 2>/dev/null || echo '??')"
echo " commit(短)  : $(git rev-parse --short HEAD 2>/dev/null || echo '??')"
echo " tree        : $(git rev-parse HEAD^{tree} 2>/dev/null || echo '??')"
echo " 提交日期    : $(git log -1 --format=%ci 2>/dev/null || echo '??')"
echo " 路径前缀    : ${PREFIX:-（仓库根）}"
echo " 跟踪文件数  : $(git ls-files -- . | wc -l | tr -d ' ')"
echo " 测试文件数  : $(git ls-files -- . | grep -c '_test[.]js$')"
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
  a=$(git rev-parse "HEAD:${PREFIX}$f" 2>/dev/null)
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
DIRTY=$(git status --porcelain -- . | wc -l | tr -d ' ')
if [ "$DIRTY" = "0" ]; then
  echo " ✅ 工作区干净（无未提交改动）"
else
  echo " ⚠️  工作区有 $DIRTY 处未提交改动（不影响快照比对，但回家前建议清理或另存）"
fi

# ④ 结论
echo "============================================================"
if [ "$BAD" = "0" ]; then
  echo " ✅ 一致：本工作区 == 2026-10-12 经济修复快照（秘宝折算 + Boss 结晶即发 + 门禁去随机化 · APP_VERSION $EXPECT_VERSION）"
  echo "    继续开发前可跑一次全量门禁：bash run_tests.sh"
  echo "    期望结果：98 套 / PASS 合计 = 4191 / bad = 0 / 全绿"
else
  echo " ❌ 不一致：本地不是该快照，请先同步远程："
  echo "     git fetch origin && git reset --hard origin/main"
  echo "    （本仓库历史被 force push 重写过，直接 git pull 可能分叉）"
fi
echo "============================================================"
exit "$BAD"
