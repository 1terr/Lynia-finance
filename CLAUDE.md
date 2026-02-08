# Claude Code Project Configuration

## Auto-Update Master Branch

A `SessionStart` hook is configured in `.claude/settings.local.json` to
automatically update the local `master` branch every time a new Claude Code
session begins.

**How it works:**

1. On session start, `.claude/scripts/update-master.sh` runs automatically.
2. The script fetches `origin/master` and fast-forwards the local `master` ref.
3. If the network is unavailable or `master` has diverged, the update is
   gracefully skipped so it never blocks work.
4. The update happens without switching branches -- your current feature branch
   stays checked out.

**No manual intervention required.** Every Claude Code session starts with an
up-to-date `master` branch.

## Build & Test

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Lint
pnpm lint
```

## Project Structure

- `services/` -- AWS Lambda microservices (TypeScript)
- `frontend/` -- Next.js admin portal and distributor dashboard
- `fineract/` -- Apache Fineract core lending platform (Java/Gradle)
- `infrastructure/` -- Terraform / CloudFormation IaC
- `database/` -- Supabase PostgreSQL migrations
