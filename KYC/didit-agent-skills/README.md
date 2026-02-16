# DIDIT Agent Skills

API reference and CLI tools from the DIDIT Identity Verification Platform.

**Source:** https://github.com/didit-protocol/didit-agent-skills

---

## Active Skills (Used in Current Integration)

These skills are directly used by `services/kyc-service/src/didit-service.ts`:

| Skill | API | Lynia Usage |
|-------|-----|-------------|
| [didit-id-verification](./didit-id-verification/) | `POST /v3/id-verification/` | Zimbabwe National ID document OCR + authenticity |
| [didit-passive-liveness](./didit-passive-liveness/) | `POST /v3/passive-liveness/` | Selfie spoof detection (anti-deepfake, anti-mask) |
| [didit-face-match](./didit-face-match/) | `POST /v3/face-match/` | Selfie-to-ID portrait comparison |
| [didit-sessions](./didit-sessions/) | `POST /v3/session/` + 10 more | Session lifecycle, decisions, blocklist, PDF reports |

## Future Skills (Roadmap)

These skills are relevant to Lynia's roadmap but not yet integrated:

| Skill | API | Potential Use |
|-------|-----|---------------|
| [didit-aml-screening](./didit-aml-screening/) | `POST /v3/aml/` | RBZ compliance — sanctions/PEP screening for loans > $1000 |
| [didit-phone-verification](./didit-phone-verification/) | `POST /v3/phone/send/` + `check/` | WhatsApp OTP delivery for customer onboarding |
| [didit-email-verification](./didit-email-verification/) | `POST /v3/email/send/` + `check/` | Email verification with breach/disposable detection |

## Not Included (Available in Source Repo)

These skills exist in the source repo but are not currently relevant:

- `didit-face-search` — 1:N face search (duplicate account detection)
- `didit-age-estimation` — Age estimation from selfie
- `didit-proof-of-address` — Utility bill/bank statement OCR
- `didit-database-validation` — Government database validation (18 countries)

---

## CLI Scripts

Each active skill includes a Python CLI script for manual testing:

```bash
# Set API key
export DIDIT_API_KEY="your-api-key"

# Verify an ID document
python didit-id-verification/scripts/verify_id.py front.jpg

# Check liveness from selfie
python didit-passive-liveness/scripts/check_liveness.py selfie.jpg

# Match selfie to ID photo
python didit-face-match/scripts/match_faces.py selfie.jpg id_photo.jpg

# Send phone OTP via WhatsApp
python didit-phone-verification/scripts/verify_phone.py send +263771234567 --channel whatsapp
```

## Authentication

All DIDIT APIs use a single `x-api-key` header. Obtain credentials from the [Didit Business Console](https://business.didit.me).

For Lynia production: API key stored in AWS Secrets Manager at `{env}/lynia/didit-api-key`.
