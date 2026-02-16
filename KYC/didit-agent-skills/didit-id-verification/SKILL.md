# Didit ID Verification API Reference

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-id-verification

## Overview
A document verification service supporting 4,000+ document types, 220+ countries, 130+ languages including passports, national IDs, driver's licenses, and residence permits.

---

## Endpoint
```
POST https://verification.didit.me/v3/id-verification/
```

**Authentication:** Include `x-api-key` header. Obtain credentials via the Didit Business Console.

---

## Key Constraints
- Formats: JPEG, PNG, WebP, TIFF
- Max size: 5MB per image
- Original real-time photos only (no screenshots, scans, or digital copies)

---

## Request Parameters

| Parameter | Required | Notes |
|---|---|---|
| `front_image` | Yes | Primary document side |
| `back_image` | No | When applicable |
| `save_api_request` | No | Defaults to `true` |
| `vendor_data` | No | Your session tracking ID |

---

## Response Status Values

| Status | Meaning |
|---|---|
| `"Approved"` | Verified successfully |
| `"Declined"` | Failed; inspect `warnings` array |
| `"In Review"` | Needs manual review |

---

## Processing Pipeline
1. Document type detection
2. OCR + MRZ/barcode parsing
3. Security feature validation
4. Document liveness checks

---

## Error Codes
- `400` — Bad request
- `401` — Invalid API key
- `403` — Insufficient credits
