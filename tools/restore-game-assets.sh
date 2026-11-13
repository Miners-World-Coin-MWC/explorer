#!/usr/bin/env bash
# Prepares ./data for the game-asset snapshot builder: picks the furthest-ahead
# saved scan state (committed in the repo, or on the game-assets-data branch)
# so the incremental cursor is never thrown away. Mirrors restore-richlist.sh.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BRANCH="${BRANCH:-game-assets-data}"
STATE_NAME="${STATE_NAME:-.game-assets-state.json}"
OUT_NAME="${OUT_NAME:-game-assets.json}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

scan_height() {
  local f="$1" h=""
  if [ -f "$f" ]; then
    h="$(head -c 4000 "$f" | grep -o '"cursorHeight":[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
  fi
  echo "${h:--1}"
}

mkdir -p data
seed_h="$(scan_height "data/$STATE_NAME")"

if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$tmp"
  branch_h="$(scan_height "$tmp/$STATE_NAME")"

  # The existing snapshot keeps old entries fresh even before this run finishes.
  if [ -f "$tmp/$OUT_NAME" ]; then cp "$tmp/$OUT_NAME" "data/$OUT_NAME"; fi

  if [ "$branch_h" -ge "$seed_h" ]; then
    if [ -f "$tmp/$STATE_NAME" ]; then cp "$tmp/$STATE_NAME" "data/$STATE_NAME"; fi
    echo "Continuing from the saved state on branch '$BRANCH' (cursor $branch_h)."
  else
    echo "The state committed in the repo (cursor $seed_h) is ahead of the branch (cursor $branch_h) - using the repo state."
  fi
else
  echo "No saved state yet - first run scans from the builder's default start height."
fi
