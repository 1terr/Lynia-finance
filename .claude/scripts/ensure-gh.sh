#!/usr/bin/env bash
# Ensure gh CLI is installed at session start.
# Called from the SessionStart hook alongside update-master.sh.

set -euo pipefail

if command -v gh &>/dev/null; then
  GH_VER=$(gh --version 2>/dev/null | head -1)
  echo "[ensure-gh] $GH_VER"
else
  GH_VERSION="2.88.1"
  GH_BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../bin"
  mkdir -p "$GH_BIN_DIR"
  export PATH="$GH_BIN_DIR:$PATH"
  echo "[ensure-gh] gh CLI not found. Installing v${GH_VERSION}..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq 2>/dev/null && apt-get install -y -qq gh 2>/dev/null
    echo "[ensure-gh] Installed $(gh --version | head -1)"
  elif command -v curl &>/dev/null; then
    ZIP_URL="https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_windows_amd64.zip"
    TMP_ZIP="$(mktemp).zip"
    curl -fsSL -o "$TMP_ZIP" "$ZIP_URL"
    unzip -p "$TMP_ZIP" "bin/gh.exe" > "$GH_BIN_DIR/gh"
    chmod +x "$GH_BIN_DIR/gh"
    rm -f "$TMP_ZIP"
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
