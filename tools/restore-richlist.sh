#!/usr/bin/env bash
# Prepares ./data for the builder: picks the FURTHEST-AHEAD saved crawl state, so progress is never thrown away.
#   - state committed in the repo (data/.richlist-state.json), e.g. a crawl you ran locally
#   - state saved on the data branch by earlier workflow runs
# Used by the GitHub Action.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-state.sh"

BRANCH="${BRANCH:-richlist-data}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

mkdir -p data
seed_h="$(state_height data/.richlist-state.json)"

if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$tmp"
  branch_h="$(state_height "$tmp/.richlist-state.json")"

  if [ -f "$tmp/richlist.json" ]; then cp "$tmp/richlist.json" data/richlist.json; fi

  if [ "$branch_h" -ge "$seed_h" ]; then
    if [ -f "$tmp/.richlist-state.json" ]; then cp "$tmp/.richlist-state.json" data/.richlist-state.json; fi
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
