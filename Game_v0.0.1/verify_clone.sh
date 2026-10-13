#!/usr/bin/env bash
# ============================================================
#  克隆一致性校验（AI-Game / 弹幕背包搜打撤）
#  用法：在仓库根目录执行   bash verify_clone.sh
#  作用：核对当前工作区是否 == 指定快照
#        （2026-10-13 C2/C6 落库：D017 等级成长改数据驱动倍率 + D018 属性卡牌系统彻底退役物理清理
#         ；在 B 类落库 + A4 前摇 + B4 宝箱主来源之上 · APP_VERSION 20261052 · 106 套 / 4494）
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

EXPECT_VERSION="20261053"

# 核心文件 → 期望的 git blob 哈希（该快照的权威指纹；30 个）
EXPECT_FILES="
index.html 0ec033be065f9573f8c40662b4f593474997ab7d
js/config.js 4043cc631e426252e5e4732c140747687b303232
js/game.js 99200dd493eddedb17151b1bec1acfdc793ca2b0
js/combat.js c092387b598e3a84084842ea03ee7e5401163aa8
js/items.js 0ce8327b59b692a018c4a4302a52cf0ec7030ce1
js/ui.js 4bb46c62de9b178be6ed00748351b29907ec1564
js/ui-panels.js c04f72855cdf1daa5de016d71afdc88a21adc9b9
js/main.js b2facf85812f5b20262b045a180ea12dac8caeb9
js/core.js eb05752a9252975195d92880b672f7c86e1604ac
js/modes.js 1aa22bcb8e3a6e7786535db49b573b7b6f948a6e
css/style.css b5d7805727ab557c767556dd4cd4dc29bdb25498
run_tests.sh 60f31ff1a37e175a4590aca81f828da4eaf02c14
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
  echo " ✅ 一致：本工作区 == 2026-10-13 C2/C6 落库快照（D017 等级成长倍率 + D018 卡牌系统物理清理 · APP_VERSION $EXPECT_VERSION）"
  echo "    继续开发前可跑一次全量门禁：bash run_tests.sh"
  echo "    期望结果：106 套 / PASS 合计 = 4494 / bad = 0 / 全绿"
else
  echo " ❌ 不一致：本地不是该快照，请先同步远程："
  echo "     git fetch origin && git reset --hard origin/main"
  echo "    （本仓库历史被 force push 重写过，直接 git pull 可能分叉）"
fi
echo "============================================================"
exit "$BAD"
