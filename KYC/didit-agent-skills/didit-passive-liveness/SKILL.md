# Didit Passive Liveness API

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-passive-liveness

## What It Does
Verifies physical user presence by analyzing a single image — no interaction needed. Detects spoofing, deepfakes, masks, and duplicate faces.

---

## Key Constraints
- Formats: JPEG, PNG, WebP, TIFF (max 5MB)
- Exactly one visible face required
- Accuracy: 99.9% liveness detection accuracy, <0.1% false acceptance rate

---

## Endpoint
```
POST https://verification.didit.me/v3/passive-liveness/
```

**Required headers:** `x-api-key`, `Content-Type: multipart/form-data`

**Key parameters:**

| Parameter | Required | Notes |
|---|---|---|
| `user_image` | Yes | Face image file |
| `face_liveness_score_decline_threshold` | No | 0-100 integer |
| `rotate_image` | No | Auto-orientation |
| `vendor_data` | No | Your session ID |

---

## Response Summary
Returns `"Approved"` or `"Declined"` with a score (0-100), face quality, luminance, and age/gender estimates.

Auto-decline triggers include `NO_FACE_DETECTED`, `LIVENESS_FACE_ATTACK`, and blocklist matches.

---

## Quick Python Example
```python
response = requests.post(
    "https://verification.didit.me/v3/passive-liveness/",
    headers={"x-api-key": "YOUR_API_KEY"},
    files={"user_image": ("selfie.jpg", open("selfie.jpg", "rb"), "image/jpeg")},
)
```

**Docs:** https://docs.didit.me/reference/passive-liveness-api
