#!/usr/bin/env bash
# Pre-commit validation for Claude Code sessions.
# Runs lightweight checks on staged files before allowing a commit.

set -euo pipefail

echo "[pre-commit] Validating staged changes..."

# Check for accidentally staged secrets or env files
FORBIDDEN_PATTERNS=('.env' 'credentials.json' '.pem' '.key')
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if echo "$STAGED_FILES" | grep -q "$pattern"; then
    echo "[pre-commit] BLOCKED: Staged file matches forbidden pattern '$pattern'."
    echo "[pre-commit] Remove it from staging with: git reset HEAD <file>"
    exit 1
  fi
done

# Check for hardcoded secrets in staged diffs
if git diff --cached -U0 2>/dev/null | grep -iE '(api_key|secret_key|password|token)\s*[:=]\s*["\x27][A-Za-z0-9+/=]{16,}' >/dev/null 2>&1; then
  echo "[pre-commit] WARNING: Possible hardcoded secret detected in staged changes."
  echo "[pre-commit] Review your changes before committing."
  # Warn but don't block — Claude may be working with test data
fi

echo "[pre-commit] Checks passed."
exit 0
