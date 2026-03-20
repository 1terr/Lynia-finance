#!/usr/bin/env bash
# guard-destructive.sh — PreToolUse hook that blocks destructive bash commands
# and enforces directory freeze boundaries for Lynia Finance.
#
# Runs on every Bash tool call. Exits non-zero to block the command.
# Performance target: <100ms (pure bash + grep, no external tools).

set -euo pipefail

# Extract command from CLAUDE_TOOL_INPUT (JSON string)
CMD="${CLAUDE_TOOL_INPUT:-}"

# If empty, allow (nothing to check)
if [ -z "$CMD" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. DESTRUCTIVE COMMAND PATTERNS
# ---------------------------------------------------------------------------

blocked=""
reason=""

# --- Git destructive ---
if echo "$CMD" | grep -qiE 'git\s+push\s+.*--force|git\s+push\s+-f\b'; then
  blocked="git push --force"
  reason="Force-pushing can overwrite remote history and destroy teammates' work."
elif echo "$CMD" | grep -qiE 'git\s+reset\s+--hard'; then
  blocked="git reset --hard"
  reason="Hard reset discards all uncommitted changes permanently."
elif echo "$CMD" | grep -qiE 'git\s+checkout\s+--\s+\.'; then
  blocked="git checkout -- ."
  reason="This discards all unstaged changes in the working directory."
elif echo "$CMD" | grep -qiE 'git\s+clean\s+-[a-zA-Z]*f'; then
  blocked="git clean -f"
  reason="This permanently deletes untracked files."
elif echo "$CMD" | grep -qiE 'git\s+branch\s+-D\b'; then
  blocked="git branch -D"
  reason="Force-deleting a branch can lose unmerged work."

# --- File system destructive ---
elif echo "$CMD" | grep -qiE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+/|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+/'; then
  blocked="rm -rf /"
  reason="Recursive force-delete from root would destroy the entire filesystem."
elif echo "$CMD" | grep -qiE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\.\s|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+\.\s|rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\.$|rm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+\.$'; then
  blocked="rm -rf ."
  reason="Recursive force-delete of current directory would destroy the project."
elif echo "$CMD" | grep -qiE '\bmkfs\b'; then
  blocked="mkfs"
  reason="Formatting a filesystem destroys all data on the device."
elif echo "$CMD" | grep -qiE '\bdd\s+if='; then
  blocked="dd if="
  reason="dd can overwrite entire disks or partitions."

# --- Database destructive ---
elif echo "$CMD" | grep -qiE '\bDROP\s+TABLE\b'; then
  blocked="DROP TABLE"
  reason="Dropping a table permanently deletes all its data. Lynia financial records require 7-year retention."
elif echo "$CMD" | grep -qiE '\bDROP\s+DATABASE\b'; then
  blocked="DROP DATABASE"
  reason="Dropping the database destroys all application data."
elif echo "$CMD" | grep -qiE '\bTRUNCATE\s+TABLE\b'; then
  blocked="TRUNCATE TABLE"
  reason="Truncating removes all rows without logging — unrecoverable."
elif echo "$CMD" | grep -qiE '\bDELETE\s+FROM\b' && ! echo "$CMD" | grep -qiE '\bWHERE\b'; then
  blocked="DELETE FROM (without WHERE)"
  reason="DELETE without WHERE clause deletes all rows in the table."

# --- AWS destructive ---
elif echo "$CMD" | grep -qiE 'aws\s+cloudformation\s+delete-stack'; then
  blocked="aws cloudformation delete-stack"
  reason="Deleting a CloudFormation stack destroys all its resources (Lambda, API Gateway, etc.)."
elif echo "$CMD" | grep -qiE 'aws\s+s3\s+rm\s+.*--recursive'; then
  blocked="aws s3 rm --recursive"
  reason="Recursively deleting S3 objects can destroy KYC documents and ML models."
elif echo "$CMD" | grep -qiE 'aws\s+s3\s+rb\b'; then
  blocked="aws s3 rb"
  reason="Removing an S3 bucket destroys the bucket and potentially all its contents."
elif echo "$CMD" | grep -qiE 'aws\s+rds\s+delete-db'; then
  blocked="aws rds delete-db"
  reason="Deleting the RDS instance destroys the production database."
elif echo "$CMD" | grep -qiE 'aws\s+lambda\s+delete-function'; then
  blocked="aws lambda delete-function"
  reason="Deleting a Lambda function removes it from production immediately."

# --- Lynia payment safety ---
elif echo "$CMD" | grep -qiE 'curl.*ecocash\.co\.zw|curl.*onemoney\.co\.zw'; then
  blocked="Direct curl to production payment API"
  reason="Direct API calls to EcoCash/OneMoney bypass safety controls (idempotency, rate limiting, audit logging)."
elif echo "$CMD" | grep -qiE 'curl.*kly80hrgca\.execute-api'; then
  blocked="Direct curl to production API Gateway"
  reason="Direct calls to the production API Gateway bypass the application's safety middleware."
fi

# Block if a destructive pattern was matched
if [ -n "$blocked" ]; then
  echo "BLOCKED by Lynia Guard: $blocked"
  echo "Reason: $reason"
  echo ""
  echo "If you need to perform this action, ask the user for explicit confirmation first."
  exit 2
fi

# ---------------------------------------------------------------------------
# 2. FREEZE ENFORCEMENT
# ---------------------------------------------------------------------------

FREEZE_FILE="$HOME/.claude/freeze-state"

if [ -f "$FREEZE_FILE" ]; then
  FREEZE_DIR=$(cat "$FREEZE_FILE" 2>/dev/null | head -1 | tr -d '[:space:]')

  if [ -n "$FREEZE_DIR" ]; then
    # Check if the command references file paths outside the frozen directory.
    # We look for common file-manipulation commands targeting paths.
    # This is a heuristic — it catches most cases without being overly strict.

    for pattern in \
      'Edit\|Write\|mv\s\|cp\s\|rm\s\|mkdir\s\|touch\s\|chmod\s\|chown\s'; do
      :  # placeholder — freeze checks file tool use, not bash commands primarily
    done

    # For Bash commands: check if the command explicitly references paths
    # outside the freeze directory. We extract path-like tokens and compare.
    # Only block write-like operations (mv, cp to, >, >>), not reads.
    if echo "$CMD" | grep -qiE '(mv|cp|rm|mkdir|touch|chmod|chown|cat\s*>|echo\s*>|tee)\s'; then
      # Extract the freeze dir basename for a simple containment check
      if ! echo "$CMD" | grep -qF "$FREEZE_DIR"; then
        # The command uses file-write operations but doesn't reference the frozen dir
        # Check if it references any project paths at all (heuristic)
        if echo "$CMD" | grep -qE '(services/|frontend/|infrastructure/|database/)'; then
          echo "BLOCKED by Lynia Guard (Freeze): Edit boundary active."
          echo "Allowed directory: $FREEZE_DIR"
          echo "The command appears to modify files outside the frozen directory."
          echo ""
          echo "Run /freeze off to disable the boundary, or /freeze <new-dir> to change it."
          exit 2
        fi
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# All checks passed
# ---------------------------------------------------------------------------
exit 0