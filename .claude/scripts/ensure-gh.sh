#!/usr/bin/env bash
# Ensure gh CLI is installed at session start.
# Called from the SessionStart hook alongside update-master.sh.

set -euo pipefail

if command -v gh &>/dev/null; then
  GH_VER=$(gh --version 2>/dev/null | head -1)
  echo "[ensure-gh] $GH_VER"
else
  echo "[ensure-gh] gh CLI not found. Installing..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq 2>/dev/null && apt-get install -y -qq gh 2>/dev/null
    echo "[ensure-gh] Installed $(gh --version | head -1)"
  else
    echo "[ensure-gh] Cannot install gh — no supported package manager. Skipping."
    exit 0
  fi
fi

# Report auth status (informational only — don't fail)
if gh auth status &>/dev/null; then
  echo "[ensure-gh] GitHub direct connection active."
else
  echo "[ensure-gh] gh not authenticated. Run: bash .claude/scripts/setup-gh.sh <token>"
fi

exit 0
