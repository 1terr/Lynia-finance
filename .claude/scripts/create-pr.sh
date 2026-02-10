#!/usr/bin/env bash
# Create a pull request using gh CLI (direct GitHub API).
#
# Usage:
#   bash .claude/scripts/create-pr.sh
#
# Creates a PR from the current branch to master. If a PR already exists,
# it prints the existing PR URL instead.

set -euo pipefail

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
BASE_BRANCH="master"

# ── Pre-flight checks ──────────────────────────────────────────────
if [ "$CURRENT_BRANCH" = "DETACHED" ] || [ "$CURRENT_BRANCH" = "$BASE_BRANCH" ]; then
  echo "[create-pr] Cannot create PR from $CURRENT_BRANCH. Skipping."
  exit 0
fi

if ! command -v gh &>/dev/null; then
  echo "[create-pr] gh CLI not installed. Run: bash .claude/scripts/setup-gh.sh"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "[create-pr] gh not authenticated. Run: bash .claude/scripts/setup-gh.sh <token>"
  exit 1
fi

# ── Check for existing PR ──────────────────────────────────────────
EXISTING_PR=$(gh pr list \
  --head "$CURRENT_BRANCH" \
  --base "$BASE_BRANCH" \
  --state open \
  --json number,url \
  --jq '.[0].url // empty' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ]; then
  echo "[create-pr] PR already exists: $EXISTING_PR"
  exit 0
fi

# ── Gather commit info ─────────────────────────────────────────────
AHEAD=$(git rev-list --count "origin/${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")

if [ "$AHEAD" = "0" ]; then
  echo "[create-pr] No new commits ahead of $BASE_BRANCH. Skipping."
  exit 0
fi

COMMITS=$(git log --oneline "origin/${BASE_BRANCH}..HEAD" 2>/dev/null | head -20)
FILES_CHANGED=$(git diff --stat "origin/${BASE_BRANCH}..HEAD" 2>/dev/null | tail -1)

# Build a title from the branch name
# claude/some-description-XYZ -> Some description
TITLE=$(echo "$CURRENT_BRANCH" \
  | sed 's|claude/||' \
  | sed 's|-[A-Za-z0-9]*$||' \
  | tr '-' ' ' \
  | sed 's/.*/\L&/' \
  | sed 's/^./\U&/')

# ── Create PR ──────────────────────────────────────────────────────
PR_BODY=$(cat <<EOF
## Summary

**Branch:** \`${CURRENT_BRANCH}\`
**Commits ahead of master:** ${AHEAD}
**Changes:** ${FILES_CHANGED}

### Commits included
\`\`\`
${COMMITS}
\`\`\`

### Merge policy
This PR will auto-merge after CI checks pass (lint + tests).

---
*Created via gh CLI direct GitHub connection.*
EOF
)

MAX_RETRIES=4
RETRY_DELAY=2

for attempt in $(seq 1 $MAX_RETRIES); do
  PR_URL=$(gh pr create \
    --base "$BASE_BRANCH" \
    --head "$CURRENT_BRANCH" \
    --title "$TITLE" \
    --body "$PR_BODY" 2>&1) && break

  echo "[create-pr] Attempt $attempt failed: $PR_URL"
  if [ "$attempt" -lt "$MAX_RETRIES" ]; then
    echo "[create-pr] Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
    RETRY_DELAY=$((RETRY_DELAY * 2))
  else
    echo "[create-pr] Failed to create PR after $MAX_RETRIES attempts."
    exit 1
  fi
done

echo "[create-pr] PR created: $PR_URL"

# Enable auto-merge if available
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || true)
if [ -n "$PR_NUMBER" ]; then
  gh pr merge "$PR_NUMBER" --auto --merge --delete-branch 2>/dev/null \
    && echo "[create-pr] Auto-merge enabled for PR #${PR_NUMBER}." \
    || echo "[create-pr] Auto-merge not available (branch protection may not be configured)."
fi
