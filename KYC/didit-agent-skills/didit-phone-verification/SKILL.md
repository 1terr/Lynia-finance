# Didit Phone Verification API

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-phone-verification

## Overview
A two-step phone verification system using one-time codes:
1. **Send** a code to a phone number
2. **Check** the code the user provides

## Key Constraints
- Codes expire after **5 minutes**
- Max **3 check attempts** per code
- Max **2 resends** within 24 hours
- Rate limit: **4 sends/hour** per number
- Phone numbers must use **E.164 format** (e.g., `+263771234567`)

## Authentication
All requests require `x-api-key` in the header, obtained from the Didit Business Console.

---

## Step 1 - Send Code
`POST https://verification.didit.me/v3/phone/send/`

Key body parameters:
- `phone_number` *(required)* — E.164 format
- `options.preferred_channel` — `sms`, `whatsapp`, `telegram`, or `voice`
- `options.code_size` — 4-8 digits (default: 6)
- `signals.*` — optional fraud detection fields (IP, device, platform, etc.)

Send statuses: `Success`, `Retry`, `Undeliverable`, `Blocked`

---

## Step 2 - Check Code
`POST https://verification.didit.me/v3/phone/check/`

Key body parameters:
- `phone_number` + `code` *(both required)*
- Policy actions (each `"NO_ACTION"` or `"DECLINE"`):
  - `disposable_number_action`
  - `voip_number_action`
  - `duplicated_phone_number_action`

Check statuses:

| Status | Meaning |
|---|---|
| `Approved` | Verified — proceed |
| `Failed` | Wrong code — retry (up to 3x) |
| `Declined` | Policy violation — check `phone.warnings` |
| `Expired or Not Found` | Resend required |

---

## Phone Response Object Highlights
- `carrier.type`: `mobile`, `landline`, `voip`, or `unknown`
- `is_disposable` / `is_virtual`: boolean fraud signals
- `warnings`: array with risk tags like `"VOIP_NUMBER_DETECTED"` or `"DISPOSABLE_NUMBER_DETECTED"`

---

## Typical Flow
```
Send -> user receives code -> Check -> handle status
```
For stricter security, include fraud signals on send and set decline policies on check.

---

## Lynia Finance Relevance
Supports **WhatsApp as a delivery channel** — aligns with WhatsApp-first customer flow. Can replace or supplement existing OTP mechanisms for Zimbabwe mobile numbers (+263).
