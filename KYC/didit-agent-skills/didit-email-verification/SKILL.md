# Didit Email Verification API

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-email-verification

## Overview
A two-step email verification service using one-time codes:
1. **Send** a code to an email address
2. **Check** the code submitted by the user

Key limits: codes expire in **5 minutes**, max **3 check attempts**, max **2 resends per 24 hours**.

---

## Authentication
All requests need `x-api-key` in the header. Obtain from the [Didit Business Console](https://business.didit.me).

---

## Step 1 - Send Code
**`POST https://verification.didit.me/v3/email/send/`**

Required body field: `email`. Optional extras include code size (4-8 digits), alphanumeric mode, locale, fraud signals (IP, device ID, user agent), and a vendor tracking string.

**Send statuses:**

| Status | Meaning |
|---|---|
| `Success` | Code dispatched |
| `Retry` | Temporary issue — retry |
| `Undeliverable` | Email can't receive mail |

---

## Step 2 - Check Code
**`POST https://verification.didit.me/v3/email/check/`**

Required: `email` + `code`. Optional policy flags (`"DECLINE"` or `"NO_ACTION"`) for breached, disposable, duplicated, or undeliverable emails.

**Check statuses:**

| Status | Meaning |
|---|---|
| `Approved` | Verified successfully |
| `Failed` | Wrong code |
| `Declined` | Code correct but policy blocked it |
| `Expired or Not Found` | Resend required |

> When a policy action is set to `"DECLINE"`, verification is rejected even if the code is correct.

---

## Risk Detection
The API flags:
- **Breached** emails (known data leaks)
- **Disposable** / temporary providers
- **Undeliverable** addresses

Warnings appear in `email.warnings` with severity levels: `error`, `warning`, or `information`.

---

## Basic Flow
```
Send -> User enters code -> Check -> Handle status
```
For stricter security, include fraud signals on Send and set all `*_action` fields to `"DECLINE"` on Check.
