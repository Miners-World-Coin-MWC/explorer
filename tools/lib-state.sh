#!/usr/bin/env bash
# Shared helper: prints the block height stored in a resume-state file (or -1 if missing/unreadable).
# Only the first few KB are read, so it is instant even for a large state file.
state_height() {
  local f="$1" h=""
  if [ -f "$f" ]; then
    h="$(head -c 4000 "$f" | grep -o '"lastHeight":-\{0,1\}[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
  fi
  echo "${h:--1}"
}
