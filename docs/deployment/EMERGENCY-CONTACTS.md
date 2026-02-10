# Emergency Contact List & Escalation Matrix

**Document:** Lynia Finance - Emergency Contact List
**Version:** 1.0
**Last Updated:** February 10, 2026
**Owner:** Engineering Team
**Classification:** Internal - Confidential

---

## On-Call Rotation

### Primary On-Call

The primary on-call engineer is the first responder for all production alerts.

| Week | Primary On-Call | Backup |
|------|----------------|--------|
| Current | [Engineer 1] | [Engineer 2] |
| Next | [Engineer 2] | [Engineer 3] |
| Following | [Engineer 3] | [Engineer 1] |

**On-call responsibilities:**
- Respond to all critical/warning alerts within 15 minutes
- Perform initial triage and assessment
- Escalate per the escalation matrix below
- Document all incidents

---

## Internal Engineering Team

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| CTO | [Name] | [+263-XXX-XXXXXX] | [cto@lynia.co.zw] | @cto |
| Engineering Lead | [Name] | [+263-XXX-XXXXXX] | [eng-lead@lynia.co.zw] | @eng-lead |
| Backend Engineer 1 | [Name] | [+263-XXX-XXXXXX] | [dev1@lynia.co.zw] | @dev1 |
| Backend Engineer 2 | [Name] | [+263-XXX-XXXXXX] | [dev2@lynia.co.zw] | @dev2 |
| Frontend Engineer | [Name] | [+263-XXX-XXXXXX] | [frontend@lynia.co.zw] | @frontend |
| DevOps Engineer | [Name] | [+263-XXX-XXXXXX] | [devops@lynia.co.zw] | @devops |

---

## Business & Operations

| Role | Name | Phone | Email |
|------|------|-------|-------|
| CEO | [Name] | [+263-XXX-XXXXXX] | [ceo@lynia.co.zw] |
| COO | [Name] | [+263-XXX-XXXXXX] | [coo@lynia.co.zw] |
| Head of Customer Support | [Name] | [+263-XXX-XXXXXX] | [support-lead@lynia.co.zw] |
| Legal / Compliance Officer | [Name] | [+263-XXX-XXXXXX] | [legal@lynia.co.zw] |

---

## External Service Providers

### AWS Support

| Tier | Contact Method | Response Time |
|------|---------------|---------------|
| AWS Business Support | AWS Console > Support > Create Case | < 1 hour (P1) |
| AWS Account Manager | [Name] - [email] | Business hours |
| AWS Emergency | +1-206-266-4064 | 24/7 for P1 |

**AWS Account ID:** [XXXXXXXXXXXX]
**Region:** us-east-1

### Supabase

| Contact | Method |
|---------|--------|
| Supabase Support | support@supabase.io |
| Supabase Dashboard | https://app.supabase.com |
| Supabase Status | https://status.supabase.com |

**Project Ref (Production):** [project-ref]
**Project Ref (Staging):** [project-ref]

### WhatsApp / Meta Business

| Contact | Method |
|---------|--------|
| Meta Business Support | https://business.facebook.com/help |
| WhatsApp API Status | https://developers.facebook.com/status |
| Meta Business Manager | https://business.facebook.com |

**Business Account ID:** [XXXXXXXXX]

### Smile Identity (KYC Provider)

| Contact | Method |
|---------|--------|
| Smile Identity Support | support@smileidentity.com |
| Technical Contact | [Name] - [email] |
| API Status | https://status.smileidentity.com |

**Partner ID:** [XXXXX]

### EcoCash (Econet Wireless)

| Contact | Method |
|---------|--------|
| EcoCash Technical Support | [email / phone] |
| EcoCash API Status | [URL] |
| Merchant Support Line | [+263-XXX-XXXXXXX] |

**Merchant ID:** [XXXXXXXXX]

### OneMoney (NetOne)

| Contact | Method |
|---------|--------|
| OneMoney Technical Support | [email / phone] |
| Merchant Support Line | [+263-XXX-XXXXXXX] |

**Merchant ID:** [XXXXXXXXX]

### Trustonic (Device Lock)

| Contact | Method |
|---------|--------|
| Trustonic Support | support@trustonic.com |
| Technical Contact | [Name] - [email] |
| API Status | [URL] |

### SMS Provider (Twilio)

| Contact | Method |
|---------|--------|
| Twilio Support | https://www.twilio.com/help/contact |
| Twilio Status | https://status.twilio.com |
| Account Dashboard | https://console.twilio.com |

---

## Regulatory Contacts

### Reserve Bank of Zimbabwe (RBZ)

| Purpose | Contact |
|---------|---------|
| General Enquiries | [+263-XXX-XXXXXX] |
| Suspicious Transaction Reports | [str-reporting@rbz.co.zw] |
| Compliance Officer | [Name] - [email] |

**Reporting Requirements:**
- Suspicious Transaction Reports (STRs): Within 24 hours
- Monthly transaction reports: By 5th of following month
- Annual compliance audit: By March 31 annually

### Zimbabwe Data Protection Authority

| Purpose | Contact |
|---------|---------|
| Data breach notification | [contact details] |
| Compliance enquiries | [contact details] |

---

## Escalation Matrix

### Severity-Based Escalation

```
P1 - CRITICAL (Service down, data breach)
├── T+0:   On-call engineer (auto-page via SNS)
├── T+15m: Engineering Lead (if not mitigated)
├── T+30m: CTO (if not resolved)
├── T+1h:  CEO (if customer/financial impact)
└── T+24h: Post-incident review (all engineering)

P2 - HIGH (Major degradation)
├── T+0:   On-call engineer (auto-page via SNS)
├── T+30m: Engineering Lead (if not mitigated)
├── T+2h:  CTO (if not resolved)
└── T+48h: Post-incident review

P3 - MEDIUM (Minor degradation)
├── T+0:   On-call engineer (Slack notification)
├── T+2h:  Engineering Lead (if no progress)
└── T+24h: Fix in next deployment

P4 - LOW (Cosmetic, no impact)
├── T+0:   GitHub issue created
└── T+1w:  Fix in upcoming sprint
```

### Special Escalation Paths

| Scenario | Immediate Contact | Escalation |
|----------|-------------------|-----------|
| **Data breach confirmed** | CTO + Legal | CEO within 1 hour |
| **Payment reconciliation mismatch** | Engineering Lead + COO | CTO within 2 hours |
| **Regulatory inquiry** | Legal / Compliance Officer | CEO + CTO |
| **Complete infrastructure failure** | DevOps + AWS Support | CTO within 15 minutes |
| **Third-party API permanent failure** | Engineering Lead | CTO + vendor contact |

---

## Communication Channels

| Channel | Purpose | Members |
|---------|---------|---------|
| Slack `#incidents` | Active incident coordination | All engineering |
| Slack `#deployments` | Deployment announcements | All engineering |
| Slack `#alerts` | Automated alert feed | All engineering |
| Email: alerts@lynia.co.zw | SNS alert delivery | On-call + leads |
| SMS alerts | Critical P1 alerts only | On-call + CTO |

---

## Maintenance Windows

| Window | Time (CAT) | Purpose |
|--------|-----------|---------|
| Preferred | Tuesday 02:00-06:00 | Scheduled maintenance |
| Backup | Thursday 02:00-06:00 | If Tuesday window missed |
| Emergency | Any time | With CTO approval |

**Note:** Zimbabwe business hours are 06:00-20:00 CAT. Lambda auto-scaling is configured for these hours.

---

## Document Maintenance

- **Update frequency:** Monthly or after any team change
- **Verification:** All phone numbers tested quarterly
- **Owner:** Engineering Lead
- **Distribution:** Stored in Git, accessible to all engineering team members

**ACTION REQUIRED:** Replace all `[placeholder]` values with actual contact information before go-live.

---

**Document Owner:** Engineering Team
**Last Verified:** February 10, 2026
**Next Verification:** Before go-live (P4-T015)
