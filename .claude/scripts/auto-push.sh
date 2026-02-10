#!/usr/bin/env bash
# Auto-push to the current branch after a successful commit.
# Only pushes if the current branch is a claude/* branch to avoid
# accidentally pushing to master or other protected branches.
#
# When gh CLI is authenticated, also creates a PR directly via the
# GitHub API instead of waiting for the GitHub Actions workflow.

set -euo pipefail

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")

# Only auto-push claude/* branches
if [[ "$CURRENT_BRANCH" != claude/* ]]; then
  echo "[auto-push] Not on a claude/* branch ($CURRENT_BRANCH). Skipping auto-push."
  exit 0
fi

echo "[auto-push] Pushing $CURRENT_BRANCH to origin..."

RETRY_COUNT=0
MAX_RETRIES=4
BACKOFF=2
PUSH_OK=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if git push -u origin "$CURRENT_BRANCH" 2>/dev/null; then
    echo "[auto-push] Successfully pushed $CURRENT_BRANCH."
    PUSH_OK=true
    break
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "[auto-push] Push failed. Retrying in ${BACKOFF}s... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep $BACKOFF
    BACKOFF=$((BACKOFF * 2))
  fi
done

if [ "$PUSH_OK" = false ]; then
  echo "[auto-push] Push failed after $MAX_RETRIES attempts. You can push manually later."
  exit 0
fi

# ── Create PR via gh if authenticated (direct GitHub connection) ───
if command -v gh &>/dev/null && gh auth status &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "${SCRIPT_DIR}/create-pr.sh" || true
else
  echo "[auto-push] gh not authenticated — PR will be created by GitHub Actions."
fi
