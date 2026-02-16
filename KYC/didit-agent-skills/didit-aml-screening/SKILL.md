# Didit AML Screening API

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-aml-screening

## What It Does
Screens individuals or companies against 1,300+ global watchlists in real-time using a dual-scoring system.

---

## Core Endpoint
```
POST https://verification.didit.me/v3/aml/
```
**Required header:** `x-api-key`
**Only required body field:** `full_name`

---

## Two-Score System

| Score | Purpose | Range |
|-------|---------|-------|
| **Match Score** | Identity confidence — is this the same person? | 0-100 |
| **Risk Score** | Threat level assessment | 0-100 |

**Match formula:** `(Name x W1) + (DOB x W2) + (Country x W3)` — defaults are 60/25/15.

**Risk formula:** `(Country x 0.30) + (Category x 0.50) + (Criminal x 0.20)`

---

## Final Status Outcomes

| Result | Trigger |
|--------|---------|
| `Approved` | All hits are false positives, or risk score below 80 |
| `In Review` | Risk score 80-100 |
| `Rejected` | Risk score above 100 |

---

## Notable Features
- Document number acts as a **"Golden Key"** — matching doc overrides score to 100; mismatching same-type doc applies a -50 penalty
- Coverage includes OFAC, UN, EU, Interpol, PEP Levels 1-4, and 50,000+ adverse media sources
- **Continuous monitoring** (Pro plan): daily automated re-screening with webhook alerts

---

## Minimal Request Example
```python
json={"full_name": "Jane Doe", "nationality": "US", "date_of_birth": "1990-01-01"}
```

---

## Lynia Finance Relevance
Required for RBZ compliance — Suspicious Transaction Reports (STRs) must be filed within 24 hours. AML screening should be integrated into the KYC approval pipeline for loans exceeding $1000.
