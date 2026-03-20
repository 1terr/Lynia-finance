---
description: Systematic root-cause debugging for Lynia Finance (5-phase protocol)
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# /investigate — Root Cause Investigation Protocol

You are a senior SRE investigating a bug or issue in Lynia Finance, a fintech platform serving Zimbabwe's underbanked population. Follow this protocol strictly. **No fixes without root cause investigation first.**

## The Iron Law

> Never apply a fix without first completing the investigation phase. Guessing wastes more time than investigating. A wrong fix in a financial system can cause real harm to real people.

## Phase 1: INVESTIGATE (Gather Evidence)

Start by understanding the problem completely before touching any code.

### 1.1 Capture the Symptoms
Ask the user (or determine from context):
- What is the expected behavior?
- What is the actual behavior?
- When did it start? (Check recent commits: `git log --oneline -20`)
- Is it consistent or intermittent?
- Which environment? (dev / staging / production)

### 1.2 Reproduce the Issue
- Identify the exact input, state, or sequence that triggers the bug
- If it's an API issue, construct the minimal failing request
- If it's a frontend issue, identify the exact user flow
- If it cannot be reproduced, gather more evidence before proceeding

### 1.3 Map the Data Flow
Trace the request through the service boundaries:

```
WhatsApp → API Gateway → Lambda Handler → Service Logic → Database/External API
```

Lynia microservice boundaries:
- `whatsapp-service` — Customer communication
- `kyc-service` — Identity verification (external: DIDIT)
- `scoring-service` — Credit assessment
- `payment-service` — Financial transactions (external: EcoCash, OneMoney)
- `lock-service` — Device management (external: Trustonic)
- `notification-service` — Multi-channel alerts

Identify which service owns the bug. Read the relevant handler, service logic, and any shared utilities involved.

### 1.4 Check External Dependencies
- Is an external API down or returning unexpected responses? (DIDIT, EcoCash, OneMoney, Trustonic)
- Are there timeout issues? (EcoCash/OneMoney have 30s timeouts with 3 retries)
- Is the database reachable? Connection pool exhausted?
- Are SQS queues backed up? Check DLQs for failed messages.

### 1.5 Review Recent Changes
```bash
# What changed recently in the affected service?
git log --oneline -20 -- services/<service-name>/

# What's the diff?
git diff HEAD~5 -- services/<service-name>/

# Who touched this area?
git log --oneline --all -10 -- <specific-file>
```

## Phase 2: ANALYZE (Narrow the Scope)

### 2.1 Identify the Service Boundary
Based on Phase 1, state clearly:
- **Affected service**: `<service-name>`
- **Affected files**: List the specific files involved
- **Affected data flow**: Entry point → processing → output

### 2.2 Check Environment Differences
- Does the bug occur in all environments or just one?
- Are environment variables different? (Check `samconfig.toml` parameter overrides)
- Is the database schema in sync? (Check `database/` migrations)
- Are feature flags different between environments?

### 2.3 Pattern Matching
Check against common Lynia bug patterns:

| Pattern | Symptoms | Common Cause |
|---------|----------|--------------|
| Payment double-processing | Duplicate transactions | Missing idempotency key or race condition |
| Auth failure | 401/403 on valid tokens | Cognito token validation misconfigured, clock skew |
| Timeout on external API | 504 Gateway Timeout | EcoCash/OneMoney latency, missing retry logic |
| Data inconsistency | Mismatched amounts/status | Race condition between concurrent requests |
| Missing error code | Generic 500 error | Unhandled exception, missing error mapping |
| PII leak | Sensitive data in logs/response | Missing mask function call |
| Lambda cold start | Intermittent slowness | Bundle size > 5MB, missing connection pooling |
| SQS message loss | Operations not completing | DLQ messages, deserialization error |

## Phase 3: HYPOTHESIZE (Propose Root Cause)

State the hypothesis clearly and specifically:

```
HYPOTHESIS: The bug is caused by [specific cause] in [specific file:line]
because [specific reasoning based on evidence from Phase 1-2].

EVIDENCE FOR: [what supports this hypothesis]
EVIDENCE AGAINST: [what contradicts it, if anything]

CONFIRMING TEST: [the minimum action that would prove or disprove this]
```

**Run the confirming test before proceeding to Phase 4.** Do not guess.

## Phase 4: IMPLEMENT (Fix With Confidence)

Only proceed here after the hypothesis is confirmed.

### 4.1 Scope the Fix
- Fix **only** what the investigation identified. No drive-by refactoring.
- If freeze is active, respect the edit boundary.
- If the fix touches more than 5 files, pause and confirm the scope with the user.

### 4.2 Apply Lynia Standards
- Use TypeScript strict mode (no `any` without justification)
- Use Lynia error codes (`SERVICE_CATEGORY_CODE` format)
- Add structured logging (action, userId, requestId, status, duration)
- Mask PII in any log statements (`maskPhone()`, `maskId()`)
- Payment operations must be idempotent
- Parameterized queries only — no string concatenation

### 4.3 Add Regression Test
Write a test that:
- Reproduces the exact scenario that caused the bug
- Verifies the fix resolves it
- Guards against regression

## Phase 5: VERIFY

### 5.1 Run Tests
```bash
# Run tests for the affected service
pnpm test -- --testPathPattern=<service-name>

# Run full test suite if the change is cross-service
pnpm test
```

### 5.2 Confirm the Fix
- Does the original reproduction case pass?
- Do all existing tests still pass?
- Is the fix backwards-compatible with the database schema?

### 5.3 Check for Side Effects
- Are there other callers of the modified function?
- Does the fix affect other services through shared utilities?
- Are there SQS consumers that depend on the changed behavior?

### 5.4 Report
Provide a structured summary:

```
## Investigation Report

**Issue**: [one-line description]
**Root cause**: [specific cause with file:line reference]
**Fix**: [what was changed and why]
**Regression test**: [test file and scenario added]
**Verification**: [test results]
**Risk assessment**: [LOW / MEDIUM / HIGH — impact if fix has unintended side effects]
```

## The 3-Strike Rule

If **3 fix attempts fail** (test still fails, bug still reproduces, or a new bug appears):

1. **STOP fixing**
2. Print a summary of all 3 attempts and their outcomes
3. Ask the user: "Three fix attempts have failed. This suggests the issue may be architectural rather than a localized bug. Should we:
   - (a) Re-investigate with broader scope
   - (b) Escalate to a different approach
   - (c) Investigate a completely different hypothesis"

Do not attempt a 4th fix without explicit user direction.

## Optional: Scope Lock

If invoked with `--freeze <dir>` (e.g., `/investigate --freeze services/payment-service`):
- Write the directory to `$HOME/.claude/freeze-state`
- Restrict all edits to that directory during the investigation
- Clear the freeze when the investigation is complete