# Task B5: WhatsApp End-to-End Testing

> **Track:** B - WhatsApp Cloud API Integration
> **Status:** Not Started
> **Priority:** High
> **Depends On:** B2, B3, B4
> **Estimated Effort:** Medium

---

## Objective

Validate the full WhatsApp service works end-to-end with real Meta Cloud API: inbound messages, outbound responses, onboarding flow, loan commands, error handling, and session management.

## Tasks

### B5.1: Inbound Message Tests
- [ ] Send text "Hi" → receive welcome message
- [ ] Send image → receive appropriate response (only accepted during KYC states)
- [ ] Send voice note → receive "text only" guidance message
- [ ] Send message from non-Zimbabwe number → logged to `international_interest`

### B5.2: Onboarding Flow Tests (without real KYC)
- [ ] Welcome → personal info collection (name, DOB, gender, location)
- [ ] Zimbabwe phone validation works (`+263`/`0` + `71-78XXXXXXX`)
- [ ] Employment info collection (type, income, debts, household)
- [ ] Product selection (smartphone / digital credit)
- [ ] KYC ID upload state (accepts image message)
- [ ] KYC selfie upload state (accepts image message)
- [ ] State persists across messages (session management)

### B5.3: Session Management Tests
- [ ] Session expires after 30 minutes of inactivity
- [ ] RESTART command resets to welcome state
- [ ] CANCEL command saves progress and resets
- [ ] CONTINUE command resumes from last state
- [ ] Multiple concurrent sessions (different phone numbers)

### B5.4: Loan Command Tests (for completed customers)
- [ ] BALANCE / BAL → shows loan balance (Fineract or DB fallback)
- [ ] HISTORY / PAYMENTS → shows payment history
- [ ] SCHEDULE / PLAN → shows repayment schedule
- [ ] HELP / MENU → shows available commands
- [ ] DEVICE / STATUS → shows device lock status
- [ ] Fuzzy matching works (typos within edit distance 2)
- [ ] Rate limiting: 10 commands/hour per phone

### B5.5: Error Handling Tests
- [ ] Rapid messages (5 in 5 seconds) → throttle response
- [ ] XSS/SQL injection patterns → sanitized and blocked
- [ ] Message > 500 chars → length validation error
- [ ] Inappropriate language → filtered
- [ ] Unknown message type → guidance message
- [ ] Global commands (HELP, LANGUAGE) work from any state

### B5.6: Multi-Language Test
- [ ] LANGUAGE command switches language preference
- [ ] Shona keywords auto-detected
- [ ] Ndebele keywords auto-detected
- [ ] Language preference persisted in `customer_preferences`

### B5.7: Template Message Tests
- [ ] Welcome template sends with customer name parameter
- [ ] KYC request template sends correctly
- [ ] Payment reminder template sends with all 6 parameters
- [ ] Templates work after 24h window (verify delivery)

## Acceptance Criteria

- [ ] All test scenarios pass
- [ ] Messages logged in `whatsapp_messages` table
- [ ] Sessions managed correctly in `whatsapp_onboarding_sessions`
- [ ] Error handling catches all edge cases
- [ ] Circuit breaker triggers on simulated Meta API failures
- [ ] SQS retry queue receives failed messages
- [ ] CloudWatch logs show structured log entries
- [ ] No PII in logs (phone numbers masked)

## Progress Report

| Date | Status | Notes |
|------|--------|-------|
| | | |
