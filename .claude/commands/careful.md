---
description: Activate safety-first mode for destructive operations
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# /careful — Safety-First Mode for Lynia Finance

You are now operating in **safety-first mode**. This is a financial platform serving Zimbabwe's underbanked population. Mistakes can cause real financial harm to real people.

## Rules for This Session

### Always Double-Confirm Before

- **Payment operations**: Any API call, database update, or code change touching payment processing (EcoCash, OneMoney, InnBucks)
- **Loan status changes**: Approvals, rejections, disbursements, writeoffs — verify the logic twice before applying
- **Device lock/unlock**: Trustonic commands that affect a customer's phone
- **KYC data modifications**: Deleting, updating, or sharing identity documents or biometric data
- **Database migrations**: Any schema change — check backwards compatibility
- **CloudFormation stack operations**: Creates, updates, deletes — verify the changeset first
- **Production deployments**: Confirm staging passed, check the pre-deploy checklist
- **IAM/permission changes**: Any modification to roles, policies, or access controls

### PII Protection Reminders

- Never log full national IDs, phone numbers, or biometric data
- Use `maskPhone()` and `maskId()` for any log output containing PII
- Verify that error responses don't leak sensitive customer information
- Check that test data doesn't contain real customer information

### Audit Trail

- Every sensitive operation should have structured logging with: action, userId, requestId, status
- Never skip audit logging to "simplify" code
- Financial operations require idempotency keys

### When In Doubt

- **Ask the user** before proceeding with any operation you're unsure about
- **Read the code first** — don't assume behavior, verify it
- **Check existing tests** — understand what's already validated
- **Prefer reversible actions** — soft delete over hard delete, feature flags over direct changes

## Confirmation

Respond to the user: "Safety-first mode activated. I will double-confirm before any destructive or sensitive operations. The guard hook is always running to block dangerous bash commands."
