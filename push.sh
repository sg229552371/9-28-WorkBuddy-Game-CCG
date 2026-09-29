#!/usr/bin/env bash
# ============================================================
#  手机端一键推送（跑测试 -> 全绿才提交 -> 推送 -> 回读确认）
#
#  用法：
#      bash push.sh "这次改了什么"
#
#  特点：
#      * 测试不全绿就直接中止，**什么都不提交**（防止把坏代码推上去）
#      * 没有改动时安静退出，不会产生空提交
#      * 推送被拒时打印出修复命令，不用猜
# ============================================================
set -u
MSG="${1:-chore: 手机端改动}"
REPO="sg229552371/9-28-WorkBuddy-Game-CCG"

echo "==== 1/4  跑测试（必须 bad=0） ===="
if ! bash run_tests.sh; then
  echo ""
  echo "!! 测试未全部通过，已中止 —— 没有提交任何东西。"
  echo "!! 修好后再跑一次 bash push.sh \"...\""
  exit 1
fi

echo ""
echo "==== 2/4  暂存改动 ===="
git add -A
if git diff --cached --quiet; then
  echo "!! 没有任何改动，无需提交。"
  exit 0
fi
git status --short

echo ""
echo "==== 3/4  提交 ===="
if ! git commit -q -m "$MSG"; then
  echo "!! 提交失败（上面有原因）。"
  exit 1
fi
git log --oneline -1

echo ""
echo "==== 4/4  推送到 GitHub ===="
if ! git push origin main; then
  echo ""
  echo "!! 推送被拒 —— 远程有你在电脑端推的新提交。执行这三条即可："
  echo "     git pull --rebase origin main"
  echo "     bash run_tests.sh"
  echo "     git push origin main"
  exit 1
fi

echo ""
echo "==== 完成：远程 main 已更新 ===="
git log --oneline -1 origin/main
echo "线上稍后自动部署（约 1~2 分钟）：https://sg229552371.github.io/9-28-WorkBuddy-Game-CCG/"
