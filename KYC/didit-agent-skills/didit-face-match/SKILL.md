# Didit Face Match API

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-face-match

## What It Does
Compares two facial images, returning a similarity score (0-100) to determine if they belong to the same person.

---

## Key Requirements
- **Auth:** `x-api-key` header (from [business.didit.me](https://business.didit.me))
- **Endpoint:** `POST https://verification.didit.me/v3/face-match/`
- **Both** `user_image` and `ref_image` are required
- Accepted formats: JPEG, PNG, WebP, TIFF — max **5MB** each
- When multiple faces exist, the **largest face** is used for comparison

---

## Core Parameters

| Parameter | Default | Notes |
|---|---|---|
| `face_match_score_decline_threshold` | `30` | Scores below = Declined |
| `rotate_image` | `false` | Tests 0/90/180/270 rotations |
| `save_api_request` | `true` | Logs to Business Console |

---

## Status Outcomes
- **Approved** — score meets threshold
- **Declined** — score too low or no face detected
- **In Review** — manual review required

---

## Score Guide

| Range | Meaning |
|---|---|
| 90-100 | Very high confidence |
| 70-89 | Likely same person |
| 50-69 | Possible match |
| 0-49 | Likely different people |

---

## Security Note
Best practice: Only store the status and score. Minimize biometric image data on your servers.
