#!/usr/bin/env bash
# Prepares ./data for the builder: picks the FURTHEST-AHEAD saved crawl state, so progress is never thrown away.
#   - state committed in the repo (data/$STATE_NAME), e.g. a crawl you ran locally
#   - state saved on the data branch by earlier workflow runs
# Used by the GitHub Action.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-state.sh"

BRANCH="${BRANCH:-richlist-data}"
STATE_NAME="${STATE_NAME:-.richlist-state.json}"   # resume-state file inside data/ and on the branch
OUT_NAME="${OUT_NAME:-richlist.json}"              # published output file
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

mkdir -p data
seed_h="$(state_height "data/$STATE_NAME")"

if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$tmp"
  branch_h="$(state_height "$tmp/$STATE_NAME")"

  if [ "$OUT_NAME" != "$STATE_NAME" ] && [ -f "$tmp/$OUT_NAME" ]; then cp "$tmp/$OUT_NAME" "data/$OUT_NAME"; fi

  if [ "$branch_h" -ge "$seed_h" ]; then
    if [ -f "$tmp/$STATE_NAME" ]; then cp "$tmp/$STATE_NAME" "data/$STATE_NAME"; fi
    echo "Continuing from the saved state on branch '$BRANCH' (block $branch_h)."
  else
    echo "The state committed in the repo (block $seed_h) is ahead of the data branch (block $branch_h) - using the repo state."
  fi
else
  if [ "$seed_h" -ge 0 ]; then
    echo "No '$BRANCH' branch yet - continuing from the state committed in the repo (block $seed_h)."
  else
    echo "No '$BRANCH' branch yet and no committed state - starting from scratch (this is the slow first crawl)."
  fi
fi
