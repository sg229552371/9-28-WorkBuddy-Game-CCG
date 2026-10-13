#!/usr/bin/env bash
# ============================================================
#  刷新 verify_clone.sh 的「期望快照」（版本号 + 逐文件 git blob 哈希）
#
#  为什么需要它：
#     verify_clone.sh 里硬编码了「核心文件 → git blob 哈希」的期望表。
#     每次改运行代码，哈希都会变；靠人记得同步必然漂移
#     （2026-10-13 已因漏同步导致新克隆误报 9 项 ❌）。
#     本脚本在**提交前**自动重算，保证「提交里的 verify_clone.sh」
#     与本提交的文件内容始终自洽 —— 从此新克隆不会再看到假红。
#
#  用法：
#     git add -A && bash refresh_verify_table.sh     # 手动刷新（需先暂存）
#     由 push.sh / old_Game/push.sh 自动调用          # 提交流程内置（推荐）
#
#  口径（重要）：
#     * 哈希一律取自**暂存区**（git rev-parse :<path>）—— 它就是要被提交的内容，
#       与提交后 `git rev-parse HEAD:<path>` 必然一致。
#     * 版本号取自同目录 index.html 的 <meta app-version>；**不自动 +1**
#       （版本号增幅是人的决定，本脚本只保证「期望值 == 实际值」不漂移）。
#     * 处理仓库内**每一个** verify_clone.sh（Game_v0.0.1/ 与 old_Game/ 各一份）。
#     * 文件清单**成员不变**，只重算哈希 —— 增删条目仍由人决定。
#     * 防呆：若重算结果条目数对不上，**拒绝写入并保留原表**（绝不写空）。
#     * 全程**不建临时文件**（只用进程内变量），避免残留与 rm 包装干扰。
# ============================================================
set -u

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "refresh: 不在 git 仓库内，跳过"; exit 1; }
cd "$ROOT" || { echo "refresh: 无法进入仓库根"; exit 1; }

mapfile -t SCRIPTS < <(git ls-files '*verify_clone.sh')
if [ "${#SCRIPTS[@]}" -eq 0 ]; then
  echo "refresh: 未找到 verify_clone.sh，跳过"
  exit 0
fi

CHANGED=0
for vf in "${SCRIPTS[@]}"; do
  [ -f "$vf" ] || continue
  vdir=$(dirname "$vf")
  [ "$vdir" = "." ] && vdir=""
  prefix=""
  [ -n "$vdir" ] && prefix="$vdir/"

  # ---- 版本号：同级 index.html 的 app-version ----
  ver=""
  if [ -f "$vdir/index.html" ]; then
    ver=$(grep -o 'app-version" content="[0-9]*"' "$vdir/index.html" 2>/dev/null | head -1 | grep -o '[0-9]*')
  fi
  if [ -z "$ver" ]; then
    ver=$(grep -o '^EXPECT_VERSION="[0-9]*"' "$vf" 2>/dev/null | head -1 | grep -o '[0-9]*')
    echo "refresh: ⚠ ${vf} 同级 index.html 无 app-version，保留原版本号 ${ver:-（空）}"
  fi

  # ---- 旧清单里的文件路径（保持成员不变） ----
  files=$(awk '/^EXPECT_FILES="/{f=1;next} f&&/^"$/{f=0} f&&NF{print $1}' "$vf")
  if [ -z "$files" ]; then
    echo "refresh: ⚠ ${vf} 未解析到 EXPECT_FILES，跳过"
    continue
  fi

  # ---- 重算哈希（取自暂存区），拼成新的块 ----
  newblock=""
  n=0
  miss=0
  for f in $files; do
    h=$(git rev-parse ":${prefix}${f}" 2>/dev/null || true)
    if [ -z "$h" ]; then
      h=$(git rev-parse "HEAD:${prefix}${f}" 2>/dev/null || true)
      if [ -n "$h" ]; then
        echo "refresh: ⚠ ${vf} 的 ${f} 未在暂存区（先 git add -A），暂用 HEAD 值"
      else
        h="(缺失)"
        miss=$((miss + 1))
      fi
    fi
    newblock="${newblock}${f} ${h}"$'\n'
    n=$((n + 1))
  done

  # ---- 在内存里重建整个文件：换掉 EXPECT_VERSION 行与 EXPECT_FILES 块 ----
  newcontent=$(
    inblk=0
    while IFS= read -r line || [ -n "$line" ]; do
      if [ "$inblk" = "1" ]; then
        if [ "$line" = '"' ]; then printf '%s\n' "$line"; inblk=0; fi
        continue
      fi
      case "$line" in
        EXPECT_VERSION=*) printf 'EXPECT_VERSION="%s"\n' "$ver" ;;
        EXPECT_FILES=*)   printf '%s\n' "$line"; printf '%s' "$newblock"; inblk=1 ;;
        *)                printf '%s\n' "$line" ;;
      esac
    done < "$vf"
  )

  # ---- 防呆 1：有任何一项算不出哈希 → 拒绝写入（绝不写半残表） ----
  if [ "$miss" -gt 0 ]; then
    echo "refresh: 🔴 ${vf} 有 ${miss} 项算不出哈希，已保留原表不动（请人工确认清单后再提交）"
    continue
  fi

  # ---- 防呆 2：新块条目数必须 == 源清单条目数，否则拒绝写入 ----
  newn=$(printf '%s\n' "$newcontent" | awk '/^EXPECT_FILES="/{f=1;next} f&&/^"$/{f=0} f&&NF{c++} END{print c+0}')
  if [ "$newn" -ne "$n" ]; then
    echo "refresh: 🔴 ${vf} 重算条目数异常（源 ${n} / 新 ${newn}），已保留原表不动"
    continue
  fi

  # ---- 同步注释里的条目数「（该快照的权威指纹；N 个）」 ----
  newcontent=$(printf '%s\n' "$newcontent" | sed -E "s/（该快照的权威指纹；[0-9]+ 个）/（该快照的权威指纹；${n} 个）/")

  # ---- 与原文件比较（末尾换行不参与比较，两边等价） ----
  if [ "$newcontent" = "$(cat "$vf")" ]; then
    echo "refresh: ✓ ${vf}（版本 ${ver} · ${n} 项）无需改动"
  else
    printf '%s\n' "$newcontent" > "$vf"
    git add -- "$vf"          # 刷新结果必须一起进本次提交
    echo "refresh: ✅ 已刷新 ${vf}（版本 ${ver} · ${n} 项${miss:+ · 缺失 ${miss} 项}）"
    CHANGED=1
  fi
done

[ "$CHANGED" = "1" ] && echo "refresh: 刷新结果已重新暂存，将随本次提交一起入库"
exit 0
