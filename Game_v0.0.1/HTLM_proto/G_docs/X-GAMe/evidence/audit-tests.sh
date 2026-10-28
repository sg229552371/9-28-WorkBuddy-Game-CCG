#!/usr/bin/env bash
cd /f/AI-Game/Game_v0.0.1 || exit 2
export PATH="/c/Program Files/nodejs:$PATH"
export TMPDIR="$PWD/G_docs/X-GAMe/evidence/tmp"
for mode in full quick clone; do
  case "$mode" in
    full) bash run_tests.sh > G_docs/X-GAMe/evidence/audit-full.log 2>&1 ;;
    quick) bash run_tests.sh --quick > G_docs/X-GAMe/evidence/audit-quick.log 2>&1 ;;
    clone) bash verify_clone.sh > G_docs/X-GAMe/evidence/audit-clone.log 2>&1 ;;
  esac
  rc=$?
  printf '%s\n' "$rc" > "G_docs/X-GAMe/evidence/audit-$mode.exit"
done
