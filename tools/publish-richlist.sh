#!/usr/bin/env bash
# Publishes data/richlist.json + the resume state to the data branch as a SINGLE commit
# (force-pushed, so the repository never grows with history of snapshots).
# Used by the GitHub Action, and can be run by hand to seed the branch from a local crawl:
#   REMOTE_URL=git@github.com:YOUR-ORG/explorer.git bash tools/publish-richlist.sh
set -euo pipefail
BRANCH="${BRANCH:-richlist-data}"
REMOTE_URL="${REMOTE_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

pub="$(mktemp -d)"
for f in .richlist-state.json richlist.json; do
  if [ -f "data/$f" ]; then cp "data/$f" "$pub/$f"; fi
done
if [ ! -f "$pub/.richlist-state.json" ]; then echo "Nothing to publish."; exit 0; fi

cd "$pub"
git init -q -b "$BRANCH"
git config user.name  "${GIT_AUTHOR_NAME:-github-actions[bot]}"
git config user.email "${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
git add -A
git commit -q -m "Richlist snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE_URL" "$BRANCH"
echo "Published to branch '$BRANCH'."
