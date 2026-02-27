## Description

<!-- What does this PR do and why? -->

## Type of Change

- [ ] Feature (new functionality)
- [ ] Bug fix (non-breaking fix)
- [ ] Refactor (no functional change)
- [ ] Documentation
- [ ] Infrastructure / CI/CD
- [ ] Security fix

## Services Affected

<!-- Check all services this PR modifies -->
- [ ] admin-service
- [ ] distributor-service
- [ ] dw-sync-service
- [ ] fineract-proxy-service
- [ ] form-submission-service
- [ ] investor-reporting-service
- [ ] kyc-service
- [ ] lock-service
- [ ] notification-service
- [ ] payment-service
- [ ] scoring-service
- [ ] whatsapp-service
- [ ] shared/
- [ ] frontend (admin-portal / distributor-dashboard)
- [ ] infrastructure

## Checklist

- [ ] Code follows existing patterns (Lambda Router, structured logging, barrel re-exports)
- [ ] No hardcoded secrets or API keys
- [ ] All inputs validated and sanitized
- [ ] TypeScript strict mode — no `any` types without justification
- [ ] Tests added/updated (85%+ coverage maintained)
- [ ] `pnpm test` passes locally
- [ ] `pnpm lint` passes locally
- [ ] Error messages do not leak system information
- [ ] No PII logged (phone numbers, national IDs, passwords masked)
- [ ] Database migrations are backwards compatible (if applicable)
- [ ] Service README updated (if endpoints changed)

## Test Plan

<!-- How was this tested? -->

## Screenshots

<!-- If UI changes, include before/after screenshots -->
