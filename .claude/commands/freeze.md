---
description: Restrict file edits to a specific directory (edit boundary)
allowed-tools: Bash, Read
---

# /freeze — Edit Boundary Control

You are activating or deactivating the Lynia Guard edit boundary.

## Instructions

Parse the user's argument:

- **`/freeze <directory>`** — Activate freeze on the given directory
- **`/freeze off`** — Deactivate freeze (clear the boundary)
- **`/freeze`** (no argument) — Show current freeze status

### Activating Freeze

1. Resolve the directory to an absolute path. If the user gives a relative path (e.g., `services/payment-service`), resolve it relative to the project root.
2. Verify the directory exists using the Read or Bash tool.
3. Write the absolute path (one line, no trailing newline) to `$HOME/.claude/freeze-state`:
   ```bash
   echo "/absolute/path/to/directory" > "$HOME/.claude/freeze-state"
   ```
4. Confirm to the user:
   ```
   Freeze activated. Edit boundary set to: <directory>
   The guard hook will block file-write commands targeting paths outside this directory.
   Run /freeze off to deactivate.
   ```

### Deactivating Freeze

1. Clear the freeze state file:
   ```bash
   echo "" > "$HOME/.claude/freeze-state"
   ```
2. Confirm: `Freeze deactivated. No edit boundary is active.`

### Showing Status

1. Read `$HOME/.claude/freeze-state`. If the file exists and contains a non-empty path, report it. Otherwise report that freeze is inactive.

## Important

- The freeze boundary is enforced by the `guard-destructive.sh` PreToolUse hook on Bash commands.
- For Edit/Write tool calls, you (Claude) must self-enforce: before editing any file, check if freeze is active and whether the file is inside the frozen directory. If not, refuse and explain.
- Freeze persists across conversation turns but resets when the file is cleared.
