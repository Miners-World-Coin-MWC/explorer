#!/usr/bin/env bash
# Shared helper: prints how far a resume-state file has got (or -1 if missing/unreadable).
# Uses the "progress" field when the file has one (pool stats: blocks covered), otherwise "lastHeight" (richlist).
# Only the first few KB are read, so it is instant even for a large state file.
state_height() {
  local f="$1" h=""
  if [ -f "$f" ]; then
    h="$(head -c 4000 "$f" | grep -o '"progress":[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
    if [ -z "$h" ]; then
      h="$(head -c 4000 "$f" | grep -o '"lastHeight":-\{0,1\}[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
    fi
  fi
  echo "${h:--1}"
}
