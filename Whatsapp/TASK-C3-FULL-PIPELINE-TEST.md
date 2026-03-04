# Task C3: Full Pipeline Testing & Production Deployment

> **Track:** C - Integration (WhatsApp + KYC + Fineract)
> **Status:** Not Started
> **Priority:** Critical (final gate before production)
> **Depends On:** All A, B, and C tasks
> **Estimated Effort:** Large

---

## Objective

Validate the complete end-to-end pipeline: WhatsApp → KYC (Didit) → Credit Scoring → Fineract loan creation → WhatsApp loan offer. Then deploy to staging, validate, and promote to production.

## Part 1: Full Pipeline Tests

### C3.1: Happy Path - New Customer Onboarding
1. Send "Hi" from test WhatsApp number
2. Receive welcome message → reply to start application
3. Provide personal info (name, DOB, gender, location)
4. Provide employment info (type, income, debts, household)
5. Select product (smartphone)
6. Send National ID photo
7. Send selfie
8. **Verify:** KYC initiate called with real photos → Didit API processes them
9. **Verify:** KYC callback received → customer notified via template
10. **Verify:** Credit scoring runs → score calculated with Didit KYC component
11. **Verify:** Fineract client created (non-blocking)
12. **Verify:** Fineract loan created and approved (non-blocking)
13. **Verify:** Loan offer sent via WhatsApp
14. Reply "ACCEPT" → consent logged, onboarding complete

**Database verification at each step:**
- [ ] `customers` row created with correct fields
- [ ] `whatsapp_onboarding_sessions` state transitions logged
- [ ] `whatsapp_messages` all messages logged (inbound + outbound)
- [ ] `kyc_submissions` row with `kyc_provider='didit'`, `provider_response` populated
- [ ] `credit_scores` row with all 5 components
- [ ] `loans` row with `fineract_loan_id` populated (may be async)
- [ ] `customer_consents` row on terms acceptance
- [ ] `fineract_sync_log` entries for client and loan creation

### C3.2: KYC Rejection + Retry Flow
1. Submit with poor quality photos → Didit rejects
2. **Verify:** Customer receives rejection template with reason
3. **Verify:** Session resets to `kyc_id_upload` state
4. Customer sends better photos → Didit approves
5. Flow continues to credit scoring
- [ ] `kyc_submissions.attempt_number` incremented
- [ ] Max 3 attempts enforced

### C3.3: KYC Manual Review Flow
1. Submit with borderline photos → Didit returns "In Review"
2. **Verify:** Customer receives "in review" template
3. Admin approves in portal → customer receives approval notification
4. Flow continues to credit scoring
- [ ] `kyc_manual_reviews` row created
- [ ] SLA indicator visible in admin portal

### C3.4: Credit Score Rejection Flow
1. Customer with low affordability scores
2. **Verify:** Score calculates correctly
3. **Verify:** Rejection message sent via WhatsApp
4. **Verify:** No Fineract sync attempted

### C3.5: Fineract Failure Recovery
1. Simulate Fineract unavailability during loan creation
2. **Verify:** Customer still gets loan offer (non-blocking)
3. **Verify:** `fineract_sync_log` shows failed status
4. **Verify:** Reconciliation retry picks up and syncs successfully

### C3.6: Loan Commands (Post-Onboarding)
1. Completed customer sends "BALANCE"
2. **Verify:** Response shows Fineract balance (or DB fallback)
3. Send "SCHEDULE" → verify repayment schedule
4. Send "HISTORY" → verify payment history
5. Send "HELP" → verify command menu
6. Test fuzzy matching: "BALANSE" → still works

### C3.7: Dual-Provider Validation
1. Set `KYC_PROVIDER=didit` → verify DIDIT path still works
2. Set `KYC_PROVIDER=didit` → verify Didit path works
3. Admin portal shows correct provider badge for each submission
4. Scoring correctly normalizes both providers' face_match scores

## Part 2: Staging Deployment

### C3.8: Deploy to Staging
```bash
sam build --cached --parallel
sam deploy --config-env staging \
  --parameter-overrides \
    KYCProvider=didit \
    DiditApiKey=<staging-key> \
    DiditWebhookSecret=<staging-secret>
```
- [ ] All Lambda functions deploy successfully
- [ ] API Gateway endpoints accessible
- [ ] Database migration applied to staging RDS
- [ ] Secrets Manager secrets stored for staging

### C3.9: Staging Validation
- [ ] Run all contract tests against staging
- [ ] Run full pipeline test (C3.1) against staging
- [ ] Verify CloudWatch logs are structured and PII-masked
- [ ] Verify Fineract reconciliation runs on schedule
- [ ] Verify admin portal displays Didit results correctly
- [ ] Monitor for 24 hours before production promotion

## Part 3: Production Deployment

### C3.10: Production Deploy
```bash
sam deploy --config-env production --no-confirm-changeset \
  --parameter-overrides \
    KYCProvider=didit \
    DiditApiKey=<production-key> \
    DiditWebhookSecret=<production-secret>
```
- [ ] Production deployment successful
- [ ] Database migration applied to production RDS
- [ ] Production secrets stored
- [ ] Webhook URL updated in Meta Dashboard (if different from staging)

### C3.11: Production Monitoring (First 48 Hours)
- [ ] Monitor first 20 real customer verifications
- [ ] Check Didit confidence score distributions
- [ ] Check approve/reject/review ratios vs historical DIDIT data
- [ ] Verify Fineract sync log shows successes
- [ ] Verify no sensitive data in CloudWatch logs
- [ ] Check WhatsApp delivery rates (no 131047/130472 errors)
- [ ] Keep DIDIT credentials active for 30-day rollback window

## Acceptance Criteria

- [ ] All 7 test scenarios pass on staging
- [ ] Staging stable for 24+ hours
- [ ] Production deployment successful
- [ ] First 20 real verifications complete without errors
- [ ] No data loss, no security incidents
- [ ] Rollback plan tested (switch `KYC_PROVIDER` back to `didit`)

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |
