#!/usr/bin/env bash
# Publishes data/game-assets.json + its resume state to the game-assets-data
# branch as a SINGLE commit (force-pushed, so the repo never grows snapshot
# history) — same policy as the richlist. The explorer loads the snapshot
# same-origin (when committed to the deployed branch) with this branch's
# raw.githubusercontent URL as fallback.
# Used by the GitHub Action; can also be run by hand:
#   GITHUB_TOKEN=… GITHUB_REPOSITORY=org/explorer bash tools/publish-game-assets.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BRANCH="${BRANCH:-game-assets-data}"
STATE_NAME="${STATE_NAME:-.game-assets-state.json}"
OUT_NAME="${OUT_NAME:-game-assets.json}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

# How far this snapshot has scanned (cursor height) — used for the ahead-guard.
scan_height() {
  local f="$1" h=""
  if [ -f "$f" ]; then
    h="$(head -c 4000 "$f" | grep -o '"scannedThrough":[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
    if [ -z "$h" ]; then
      h="$(head -c 4000 "$f" | grep -o '"cursorHeight":[0-9]\{1,\}' | head -1 | sed 's/.*://' || true)"
    fi
  fi
  echo "${h:--1}"
}

pub="$(mktemp -d)"
for f in "$STATE_NAME" "$OUT_NAME"; do
  if [ -f "data/$f" ]; then cp "data/$f" "$pub/$f"; fi
done
if [ ! -f "$pub/$OUT_NAME" ]; then echo "Nothing to publish."; exit 0; fi

# Safety: never overwrite a branch that is already further ahead.
if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  chk="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$chk"
  remote_h="$(scan_height "$chk/$OUT_NAME")"
  local_h="$(scan_height "$pub/$OUT_NAME")"
  if [ "$remote_h" -gt "$local_h" ]; then
    echo "The '$BRANCH' branch is already ahead (scannedThrough $remote_h vs $local_h) - not overwriting it."
    exit 0
  fi
fi

cd "$pub"
git init -q -b "$BRANCH"
git config user.name  "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git add -A
git commit -q -m "Game-asset registry snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE_URL" "$BRANCH"
echo "Published $OUT_NAME (scan height $(scan_height "$pub/$OUT_NAME")) to branch $BRANCH"
