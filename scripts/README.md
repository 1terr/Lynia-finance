# GitHub Issues Creator

This script automatically creates GitHub issues from your [tasks.md](../lynia-specs/lynia-lending/tasks.md) file.

## Prerequisites

1. **GitHub CLI installed** ✅ (You already have this!)
2. **Authenticated with GitHub**

Check if you're authenticated:
```bash
gh auth status
```

If not authenticated, run:
```bash
gh auth login
```

## Quick Start

### 1. Test Run (Preview Only - Recommended First!)

Preview what issues will be created without actually creating them:

```bash
node scripts/create-github-issues.js --dry-run --limit 5
```

This shows you the first 5 issues that would be created.

### 2. Create Phase 0 (Research) Issues Only

Start with just the research tasks (about 50 issues):

```bash
node scripts/create-github-issues.js --phase "Phase 0"
```

### 3. Create All Issues

⚠️ **Warning:** This will create 410+ issues!

```bash
node scripts/create-github-issues.js
```

## Usage Options

```bash
node scripts/create-github-issues.js [OPTIONS]
```

### Options:

| Option | Description | Example |
|--------|-------------|---------|
| `--dry-run` | Preview without creating issues | `--dry-run` |
| `--phase PHASE` | Only create issues for specific phase | `--phase "Phase 0"` |
| `--limit N` | Limit number of issues created | `--limit 10` |

### Examples:

**Preview first 10 tasks:**
```bash
node scripts/create-github-issues.js --dry-run --limit 10
```

**Create Phase 0 (Research) issues:**
```bash
node scripts/create-github-issues.js --phase "Phase 0"
```

**Create Phase 1 (Design) issues:**
```bash
node scripts/create-github-issues.js --phase "Phase 1"
```

**Create first 20 issues (testing):**
```bash
node scripts/create-github-issues.js --limit 20
```

## What Gets Created

Each GitHub issue will include:

- **Title:** `T001: Research Fineract loan creation API`
- **Body:**
  - Phase information
  - Section information
  - Milestone (M0, M1, etc.)
  - Whether it can run in parallel
  - Full task description from tasks.md
- **Labels:**
  - Milestone labels (`M0`, `M1`, etc.)
  - Phase labels (`research`, `design`, `foundation`, `user-story`, `admin`)
  - Special labels (`parallel`, `testing`)

## Recommended Workflow

### Step 1: Test First (5 minutes)
```bash
# Preview what will be created
node scripts/create-github-issues.js --dry-run --limit 5
```

### Step 2: Create Research Tasks (Phase 0)
```bash
# Create ~50 research tasks
node scripts/create-github-issues.js --phase "Phase 0"
```

### Step 3: Work on Research Tasks
- Complete research tasks in GitHub
- Update tasks.md as you go

### Step 4: Create Next Phase
```bash
# When ready for design phase
node scripts/create-github-issues.js --phase "Phase 1"
```

### Step 5: Continue Incrementally
Create issues phase by phase as you progress through the project.

## GitHub Labels

The script will attempt to add these labels (create them in GitHub first for best results):

**Milestone Labels:**
- `M0`, `M1`, `M2`, `M3`, `M4`, `M5`, `M6`, `M7`, `M8`, `M9`, `M10`, `M11`, `M12`

**Phase Labels:**
- `research` - Phase 0 tasks
- `design` - Phase 1 tasks
- `foundation` - Phase 2 tasks
- `user-story` - Phase 3-8 tasks
- `admin` - Phase 9-12 tasks
- `testing` - Test-related tasks

**Special Labels:**
- `parallel` - Can be worked on in parallel with other tasks

### How to Create Labels in GitHub:

1. Go to: https://github.com/1terr/Lynia-finance/labels
2. Click **"New label"**
3. Create labels as listed above
4. Suggested colors:
   - Milestones: Blue (`#0366d6`)
   - Phases: Green (`#0e8a16`)
   - Special: Yellow (`#fbca04`)

## Troubleshooting

### Error: "gh: command not found"
- GitHub CLI is not installed or not in PATH
- You already have it, so this shouldn't happen!

### Error: "failed to run gh: not logged in"
```bash
gh auth login
```

### Error: "rate limit exceeded"
- GitHub has rate limits
- The script waits 1 second between each issue
- If you hit limits, wait an hour and continue

### Issues created with wrong labels
- Labels must exist in GitHub first
- Create them manually at: https://github.com/1terr/Lynia-finance/labels

### Want to delete all issues and start over?
⚠️ **Be careful!** You can't bulk delete easily.

Option 1: Close all issues manually
Option 2: Use GitHub API to close them programmatically

## Script Details

The script:
1. ✅ Parses `tasks.md` and extracts all tasks
2. ✅ Preserves task ID, milestone, phase, section info
3. ✅ Automatically assigns appropriate labels
4. ✅ Handles parallel tasks (adds `parallel` label)
5. ✅ Includes full task descriptions
6. ✅ Links back to tasks.md for context
7. ✅ Respects rate limits (1 second delay between issues)
8. ✅ Provides progress feedback and summary

## Next Steps After Creating Issues

1. **Create a GitHub Project:**
   - Go to: https://github.com/1terr/Lynia-finance/projects
   - Click **"New project"**
   - Choose **"Board"** or **"Table"** view
   - Add your issues to the project

2. **Organize by Milestone:**
   - Filter issues by milestone labels
   - Create project views for each phase

3. **Start Working:**
   - Assign issues to yourself
   - Move issues through: `Todo` → `In Progress` → `Done`
   - Link pull requests to issues

4. **Track Progress:**
   - Use GitHub's built-in progress tracking
   - View burndown charts
   - Monitor velocity

## Support

If you encounter issues:
1. Check GitHub CLI is authenticated: `gh auth status`
2. Ensure you have write access to the repository
3. Check that tasks.md exists and is readable
4. Try with `--dry-run` first to debug

---

**Repository:** https://github.com/1terr/Lynia-finance
**Issues:** https://github.com/1terr/Lynia-finance/issues
