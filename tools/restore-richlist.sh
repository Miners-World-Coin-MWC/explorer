#!/usr/bin/env bash
# Pulls the saved crawl state (and last published richlist) from the data branch into ./data
# so the builder can continue from where it left off. Used by the GitHub Action.
set -euo pipefail
BRANCH="${BRANCH:-richlist-data}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

mkdir -p data
if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$tmp"
  for f in .richlist-state.json richlist.json; do
    if [ -f "$tmp/$f" ]; then cp "$tmp/$f" "data/$f"; fi
  done
  echo "Restored saved state from branch '$BRANCH'."
else
  if [ -f data/.richlist-state.json ]; then
    echo "No '$BRANCH' branch yet - continuing from data/.richlist-state.json committed in the repo."
  else
    echo "No '$BRANCH' branch yet - starting from scratch."
  fi
fi
