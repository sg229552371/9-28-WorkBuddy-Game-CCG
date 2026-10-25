#!/usr/bin/env bash
cd /f/AI-Game/Game_v0.0.1 || exit 2
export PATH="/c/Program Files/nodejs:$PATH"
export TMPDIR="$PWD/G_docs/X-GAMe/evidence/tmp"
mkdir -p "$TMPDIR"
result=0
for mode in quick clone; do
  base="G_docs/X-GAMe/evidence/closeout-$mode"
  date -Iseconds > "$base.started"
  if [ "$mode" = quick ]; then
    bash run_tests.sh --quick > "$base.log" 2>&1
  else
    bash verify_clone.sh > "$base.log" 2>&1
  fi
  code=$?
  printf '%s\n' "$code" > "$base.exit"
  date -Iseconds > "$base.finished"
  printf '%s exit=%s\n' "$mode" "$code"
  tail -n 5 "$base.log"
  if [ "$code" -ne 0 ]; then result=1; fi
 done
exit "$result"
