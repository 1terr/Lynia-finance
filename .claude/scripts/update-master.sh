#!/usr/bin/env bash
# Auto-update the local master branch from origin without switching branches.
# This script is invoked by Claude Code's SessionStart hook so every new
# session starts with the latest master, reducing merge conflicts and keeping
# feature branches up-to-date.

set -euo pipefail

REMOTE="origin"
BRANCH="master"

echo "[update-master] Fetching latest ${BRANCH} from ${REMOTE}..."

# Fetch the remote branch. If the network is unreachable we just skip
# (the developer can still work offline).
if ! git fetch "${REMOTE}" "${BRANCH}" 2>/dev/null; then
  echo "[update-master] Fetch failed (network issue?). Skipping update."
  exit 0
fi

# Fast-forward the local master ref to match origin/master WITHOUT checking
# it out. This is safe even when we're on a different branch.
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")

if [ "${CURRENT_BRANCH}" = "${BRANCH}" ]; then
  # We're on master – do a fast-forward merge.
  if git merge --ff-only "${REMOTE}/${BRANCH}" 2>/dev/null; then
    echo "[update-master] master branch fast-forwarded to latest."
  else
    echo "[update-master] master cannot be fast-forwarded (local diverged). Skipping."
  fi
else
  # We're on a feature branch – update the local master ref directly.
  if git update-ref "refs/heads/${BRANCH}" "${REMOTE}/${BRANCH}" 2>/dev/null; then
    echo "[update-master] Local master ref updated to match ${REMOTE}/${BRANCH}."
  else
    echo "[update-master] Could not update local master ref. Skipping."
  fi
fi
