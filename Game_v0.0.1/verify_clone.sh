#!/usr/bin/env bash
# ============================================================
#  克隆一致性校验（AI-Game / 弹幕背包搜打撤）
#  用法：在仓库根目录执行   bash verify_clone.sh
#  作用：核对当前工作区是否 == 指定快照
#        （2026-10-13 B 类落库 + A4 前摇 + B4 宝箱主来源：B1 整数锚点/B2 Buff 锚点/B3 祭坛加权/B5 货物占格
#         + A4 castTime「不可打断+可移动」+ B4「精英几率低级箱/BOSS 几率中高级箱/落地/读条拾取」· APP_VERSION 20261051 · 106 套 / 4506）
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

EXPECT_VERSION="20261051"

# 核心文件 → 期望的 git blob 哈希（该快照的权威指纹；30 个）
EXPECT_FILES="
index.html e393aa729e45a2b036222761d6a8309605810303
js/config.js 5550dc01c462437fb7c2c4fe59e756b3a508b94c
js/game.js 9a10473e7b3c098c2fbb7a46f0600fae34348829
js/combat.js c092387b598e3a84084842ea03ee7e5401163aa8
js/items.js e727d5f28b47da8c38e179b99f4d70472e288a7f
js/ui.js d8ae96866382904b7140e88ef82a11f2606214f8
js/ui-panels.js c04f72855cdf1daa5de016d71afdc88a21adc9b9
js/main.js f535f112baaa290e3c34049ee642c9e59f9797ac
js/core.js b24ae85a5179b4e33eebbbc987d6837fdd22bc9c
js/modes.js 274ba9e319b532e451efab24f0c80523e0879122
css/style.css 49a277f655d8e5f9db426e994aac80e67513b891
run_tests.sh d6a99faf21a622357bee53fb9aa1a419d6c2843c
js/skill-compiler.js 61f92b5cc89886f9c567f8b735fce3fac6564784
js/skill-playtest.js da357b70fe57a56a06617a35a21e32d68c39efe8
js/skill-scheduler.js ee30f6d3810410080afb01aa4574e22b712c86a5
js/skill-config.js 47aba0aaea00c645ecf50d098c83f296027bfd3b
js/skill-runtime.js 9684af1113ebc1c44c49786091b964ca1263e828
js/skill-events.js a2fa6c17807b6ba7242a0197b58b87f4d9f1fe7e
skill_playtest_test.js 1f1b60d290c8dc2466be6bd7b8527ab424549aa5
skill_rule_binding_test.js 1984a54fd39b303432ac4e39bb5b00837324b8eb
crystal_ui_test.js 982376add0ca3bcd7ec0b773e03371cfc7b681aa
crystal_expansion_test.js d511b80d71a4c9c0f0b4b23de64dc8eb770ffee5
skill_enable_runtime_test.js 023642f33e8ec3467933ce88c31f29c0cf49386c
hero_skill_migration_test.js bf4c75f6a82a012ca82c6187311bd33bb1834738
skill_save_session_test.js 30170e7d16a40edf6e05cf2cf2bb60733229e173
hero_nondamage_skill_test.js ceaa972085bc7d4ff132c49e7ca1920ef1b09575
skill_effect_runtime_test.js fa7cca4d8d3313297ee80e632bfc830c0325e719
skill_integration_test.js 7f06e350c96624b38818429745391977eb979320
skill_balance_anchors_test.js d61f2b555d263ff8b7961e2aed74d78cc0a4c4c1
chest_drop_source_test.js 42548c9cbab3ad170363e7be4ef64c0c80adeedb
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
  echo " ✅ 一致：本工作区 == 2026-10-13 B 类落库快照（B1/B2/B3/B5 + A4 前摇 + B4 宝箱主来源 · APP_VERSION $EXPECT_VERSION）"
  echo "    继续开发前可跑一次全量门禁：bash run_tests.sh"
  echo "    期望结果：106 套 / PASS 合计 = 4506 / bad = 0 / 全绿"
else
  echo " ❌ 不一致：本地不是该快照，请先同步远程："
  echo "     git fetch origin && git reset --hard origin/main"
  echo "    （本仓库历史被 force push 重写过，直接 git pull 可能分叉）"
fi
echo "============================================================"
exit "$BAD"
