# Lynia Finance - UAT Bug Tracker

**Document ID:** LYN-UAT-BUG-001
**Version:** 1.0
**Date:** 2026-02-10
**Reference:** UAT Test Plan LYN-UAT-PLAN-001

---

## Bug Severity Definitions

| Severity | Definition | SLA |
|----------|-----------|-----|
| CRITICAL | System crash, data loss, payment failure, security breach | Fix within 4 hours. Blocks UAT. |
| HIGH | Major feature broken, incorrect calculations, KYC failure | Fix within 24 hours. |
| MEDIUM | Feature partially working, UI issues, minor workflow disruption | Fix before go-live or first sprint post-launch. |
| LOW | Cosmetic issues, minor UX improvements, edge cases | Add to backlog. |

## Bug Status Definitions

| Status | Definition |
|--------|-----------|
| OPEN | Bug reported, not yet assigned |
| IN PROGRESS | Developer working on fix |
| FIXED | Fix deployed to staging |
| VERIFIED | Fix verified by UAT tester |
| CLOSED | Verified and accepted |
| DEFERRED | Will not fix before go-live (MEDIUM/LOW only) |
| DUPLICATE | Duplicate of another bug |

---

## Bug Log

### Template

```
### BUG-XXX: [Title]

| Field | Value |
|-------|-------|
| **ID** | BUG-XXX |
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Status** | OPEN |
| **Test Case** | UAT-SX-XXX |
| **Scenario** | S1-S8 |
| **Reported By** | Name |
| **Reported Date** | YYYY-MM-DD |
| **Assigned To** | Developer Name |
| **Fixed Date** | - |
| **Verified Date** | - |

**Description:**
[Clear description of the bug]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Environment:**
- Device: [e.g., Samsung Galaxy A14 / Chrome Desktop]
- OS: [e.g., Android 13 / Windows 11]
- Browser: [if applicable]

**Screenshots/Evidence:**
[Attach or link screenshots]

**Resolution Notes:**
[Developer notes on the fix]
```

---

## Reported Bugs

_No bugs reported yet. Bugs will be logged here as UAT testing proceeds._

<!-- Copy the template above for each new bug. Number sequentially: BUG-001, BUG-002, etc. -->

---

## Bug Summary Dashboard

| Severity | Open | In Progress | Fixed | Verified | Closed | Deferred | Total |
|----------|------|-------------|-------|----------|--------|----------|-------|
| CRITICAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| MEDIUM | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| LOW | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **TOTAL** | **0** | **0** | **0** | **0** | **0** | **0** | **0** |

---

## Bug Trend

| Date | Opened | Closed | Open Total |
|------|--------|--------|------------|
| | | | |

---

## Go-Live Readiness

**Blocking bugs (CRITICAL/HIGH open):** 0
**Deferred bugs (MEDIUM/LOW):** 0

**Verdict:** [ ] No blocking bugs - ready for go-live | [ ] Blocking bugs remain - not ready

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-10 | Engineering | Initial bug tracker template |
