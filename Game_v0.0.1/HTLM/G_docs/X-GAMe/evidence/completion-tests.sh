#!/usr/bin/env bash
cd /f/AI-Game/Game_v0.0.1 || exit 2
export PATH="/c/Program Files/nodejs:$PATH"
export TMPDIR="$PWD/G_docs/X-GAMe/evidence/tmp"
for mode in full quick clone; do
 base="G_docs/X-GAMe/evidence/completion-$mode"
 date -Iseconds > "$base.started"
 case "$mode" in
 full) bash run_tests.sh > "$base.log" 2>&1 ;;
 quick) bash run_tests.sh --quick > "$base.log" 2>&1 ;;
 clone) bash verify_clone.sh > "$base.log" 2>&1 ;;
 esac
 rc=$?
 printf '%s\n' "$rc" > "$base.exit"
 date -Iseconds > "$base.finished"
 tail -n 5 "$base.log"
 printf 'mode=%s exit=%s\n' "$mode" "$rc"
done
