#!/usr/bin/env bash
# Configure gh CLI for direct GitHub API access.
#
# Usage:
#   GH_TOKEN=ghp_xxx bash .claude/scripts/setup-gh.sh
#   — or —
#   bash .claude/scripts/setup-gh.sh <token>
#
# The script will:
#   1. Install gh if it is not already present
#   2. Authenticate gh with the provided token
#   3. Set the default repository to the current git remote

set -euo pipefail

TOKEN="${1:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"

# ── Install gh if missing ───────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "[setup-gh] gh CLI not found. Installing..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq gh 2>/dev/null
  else
    echo "[setup-gh] ERROR: Cannot install gh — no supported package manager."
    exit 1
  fi
  echo "[setup-gh] gh $(gh --version | head -1) installed."
fi

# ── Authenticate ────────────────────────────────────────────────────
if [ -z "$TOKEN" ]; then
  # Check if already authenticated
  if gh auth status &>/dev/null; then
    echo "[setup-gh] gh is already authenticated."
  else
    echo "[setup-gh] No token provided and gh is not authenticated."
    echo ""
    echo "To set up GitHub direct access, provide a Personal Access Token:"
    echo ""
    echo "  Option 1:  GH_TOKEN=ghp_xxx bash .claude/scripts/setup-gh.sh"
    echo "  Option 2:  bash .claude/scripts/setup-gh.sh ghp_xxx"
    echo ""
    echo "Required token scopes: repo, read:org"
    echo "Create one at: https://github.com/settings/tokens/new"
    exit 1
  fi
else
  echo "$TOKEN" | gh auth login --with-token 2>/dev/null
  echo "[setup-gh] Authenticated with GitHub."
fi

# ── Set default repo from git remote ───────────────────────────────
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
# Extract owner/repo from various URL formats
REPO=$(echo "$REMOTE_URL" | sed -E 's|.*[:/]([^/]+/[^/.]+)(\.git)?$|\1|')

if [ -n "$REPO" ] && [ "$REPO" != "$REMOTE_URL" ]; then
  gh repo set-default "$REPO" 2>/dev/null || true
  echo "[setup-gh] Default repository set to $REPO"
fi

echo "[setup-gh] GitHub direct connection ready."
gh auth status 2>&1 | head -5
