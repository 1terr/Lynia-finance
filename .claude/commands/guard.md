---
description: Activate full safety guard (destructive command protection + optional edit boundary)
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# /guard — Full Safety Guard for Lynia Finance

You are activating the full Lynia safety guard. This combines always-on destructive command protection with an optional edit boundary and safety-first mindset.

## What's Always Protected (PreToolUse Hook)

The `guard-destructive.sh` hook runs on **every** Bash command automatically. It blocks:

### Git Destructive
- `git push --force` / `git push -f` — prevents overwriting remote history
- `git reset --hard` — prevents discarding uncommitted changes
- `git checkout -- .` — prevents discarding unstaged changes
- `git clean -f` — prevents deleting untracked files
- `git branch -D` — prevents force-deleting branches

### Filesystem Destructive
- `rm -rf /` or `rm -rf .` — prevents catastrophic deletion
- `mkfs` — prevents formatting filesystems
- `dd if=` — prevents disk overwrite

### Database Destructive
- `DROP TABLE` / `DROP DATABASE` — prevents data loss (RBZ requires 7-year retention)
- `TRUNCATE TABLE` — prevents unrecoverable row deletion
- `DELETE FROM` without `WHERE` — prevents full-table wipes

### AWS Destructive
- `aws cloudformation delete-stack` — prevents destroying infrastructure
- `aws s3 rm --recursive` / `aws s3 rb` — prevents deleting KYC docs and ML models
- `aws rds delete-db` — prevents destroying the production database
- `aws lambda delete-function` — prevents removing production functions

### Lynia Payment Safety
- Direct `curl` to `ecocash.co.zw` / `onemoney.co.zw` — bypasses safety controls
- Direct `curl` to production API Gateway (`kly80hrgca`) — bypasses middleware

## Instructions

Parse the user's argument:

### With directory argument: `/guard <directory>`

1. Activate safety-first mode (see /careful rules below)
2. Activate edit boundary on the specified directory:
   - Resolve to absolute path
   - Write to `$HOME/.claude/freeze-state`
   - Confirm: "Guard activated with edit boundary: `<directory>`"
3. List what's protected (the categories above)

### Without argument: `/guard`

1. Activate safety-first mode
2. Report current freeze status (read `$HOME/.claude/freeze-state`)
3. List what's protected
4. Confirm: "Guard activated. Destructive command protection is always on. No edit boundary set — run `/guard <dir>` or `/freeze <dir>` to add one."

## Safety-First Mode Rules

When guard is active, follow these additional rules for the session:

- **Double-confirm** before: payment operations, loan status changes, device lock/unlock, KYC modifications, database migrations, CloudFormation operations, production deploys, IAM changes
- **PII protection**: Never log full national IDs or phone numbers. Use `maskPhone()`/`maskId()`
- **Audit trail**: Every sensitive operation needs structured logging (action, userId, requestId, status)
- **Prefer reversible**: Soft delete over hard delete, feature flags over direct changes
- **When unsure**: Ask the user before proceeding

## Self-Enforcement for Edit/Write Tools

The hook only guards Bash commands. For Edit and Write tool calls, you must self-enforce:
- If freeze is active, check that the target file is inside the frozen directory before editing
- If outside the boundary, refuse and explain: "This file is outside the freeze boundary (`<dir>`). Run `/freeze off` to edit it."
