#!/usr/bin/env bash
# 文档复验：仅在副本内写证据，不调用发布脚本。
cd /f/AI-Game/Game_v0.0.1 || exit 2
export PATH="/c/Program Files/nodejs:$PATH"
export TMPDIR="$PWD/G_docs/X-GAMe/evidence/tmp"
date -Iseconds > G_docs/X-GAMe/evidence/verified-run.started
bash run_tests.sh > G_docs/X-GAMe/evidence/verified-run.log 2>&1
rc=$?
printf '%s\n' "$rc" > G_docs/X-GAMe/evidence/verified-run.exit
date -Iseconds > G_docs/X-GAMe/evidence/verified-run.finished
exit "$rc"
