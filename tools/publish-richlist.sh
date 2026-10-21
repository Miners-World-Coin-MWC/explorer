#!/usr/bin/env bash
# Publishes data/richlist.json + the resume state to the data branch as a SINGLE commit
# (force-pushed, so the repository never grows with history of snapshots).
# Never overwrites a branch that is already further ahead than this run.
# Used by the GitHub Action, and can be run by hand to seed the branch from a local crawl:
#   REMOTE_URL=git@github.com:YOUR-ORG/explorer.git bash tools/publish-richlist.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/lib-state.sh"

BRANCH="${BRANCH:-richlist-data}"
STATE_NAME="${STATE_NAME:-.richlist-state.json}"
OUT_NAME="${OUT_NAME:-richlist.json}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

pub="$(mktemp -d)"
for f in "$STATE_NAME" "$OUT_NAME"; do
  if [ -f "data/$f" ]; then cp "data/$f" "$pub/$f"; fi
done
if [ ! -f "$pub/$STATE_NAME" ]; then echo "Nothing to publish."; exit 0; fi

# Safety: if the branch already holds a more advanced crawl (e.g. you seeded it while this run was busy), keep it.
if git ls-remote --exit-code --heads "$REMOTE_URL" "$BRANCH" >/dev/null 2>&1; then
  chk="$(mktemp -d)"
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE_URL" "$chk"
  remote_h="$(state_height "$chk/$STATE_NAME")"
  local_h="$(state_height "$pub/$STATE_NAME")"
  if [ "$remote_h" -gt "$local_h" ]; then
    echo "The '$BRANCH' branch is already ahead (block $remote_h vs this run's $local_h) - not overwriting it."
    exit 0
  fi
fi

cd "$pub"
git init -q -b "$BRANCH"
git config user.name  "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git add -A
git commit -q -m "Data snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE_URL" "$BRANCH"
echo "Published to branch '$BRANCH'."
