# Didit Session & Workflow API Reference

> Source: https://github.com/didit-protocol/didit-agent-skills/tree/main/skills/didit-sessions

## Core Concept
Sessions are the fundamental unit of verification. Each session links to a **workflow** (configured in Console) that defines which checks run and the decision logic.

**Base URL:** `https://verification.didit.me/v3`

---

## Authentication
All requests require an `x-api-key` header, obtained from the Didit Business Console under API & Webhooks.

---

## Session Lifecycle
```
Create Session -> User verifies at URL -> Webhook/poll for decision -> Optionally update status
```

---

## Session Statuses

| Status | Terminal? |
|---|---|
| Not Started | No |
| In Progress | No |
| In Review | No |
| Approved | Yes |
| Declined | Yes |
| Abandoned | Yes |
| Expired | Yes |
| Resubmitted | No |

---

## Workflow Types

| Template | Starting Point |
|---|---|
| KYC | ID Verification (OCR) |
| Adaptive Age Verification | Selfie age estimation |
| Biometric Authentication | Liveness detection |
| Address Verification | Proof of Address |
| Questionnaire | Custom questionnaire |

Workflows are created **only via Business Console UI**, not through the API. Each receives a unique `workflow_id`.

---

## API Endpoints

### 1. Create Session
**POST** `/v3/session/`

**Required headers:** `x-api-key`, `Content-Type: application/json`

**Key body parameters:**

| Parameter | Type | Required |
|---|---|---|
| `workflow_id` | uuid | Yes |
| `vendor_data` | string | No |
| `callback` | url | No |
| `callback_method` | string | No |
| `metadata` | JSON string | No |
| `language` | string | No |
| `contact_details.email` | string | No |
| `contact_details.phone` | string | No |
| `expected_details.*` | various | No |
| `portrait_image` | base64 | No |

**Python example:**
```python
response = requests.post(
    "https://verification.didit.me/v3/session/",
    headers={"x-api-key": "YOUR_API_KEY", "Content-Type": "application/json"},
    json={
        "workflow_id": "d8d2fa2d-c69c-471c-b7bc-bc71512b43ef",
        "vendor_data": "user-123",
        "callback": "https://yourapp.com/callback",
        "language": "en",
    },
)
```

**Response (201):**
```json
{
  "session_id": "11111111-2222-3333-4444-555555555555",
  "session_token": "abcdef123456",
  "url": "https://verify.didit.me/session/abcdef123456",
  "status": "Not Started"
}
```

---

### 2. Retrieve Session Decision
**GET** `/v3/session/{sessionId}/decision/`

Returns all verification results. Note: image/media URLs expire after **60 minutes**.

Response includes arrays for: `id_verifications`, `liveness_checks`, `face_matches`, `phone_verifications`, `email_verifications`, `aml_screenings`, and more.

---

### 3. List Sessions
**GET** `/v3/sessions/`

Query params: `vendor_data`, `status`, `page`, `page_size`

Returns paginated results with `count`, `next`, `previous`, and `results`.

---

### 4. Delete Session
**DELETE** `/v3/session/{sessionId}/delete/`

Permanently removes the session and **all associated data**. Returns `204 No Content` on success.

---

### 5. Update Session Status
**PATCH** `/v3/session/{sessionId}/update-status/`

| Parameter | Required | Values |
|---|---|---|
| `new_status` | Yes | `"Approved"`, `"Declined"`, `"Resubmitted"` |
| `comment` | No | Reason text |
| `send_email` | No | boolean |
| `email_address` | Conditional | Required when `send_email: true` |
| `nodes_to_resubmit` | No | Array of node objects |

> For resubmission, session must be Declined, In Review, or Abandoned. Previously approved steps are preserved.

---

### 6. Generate PDF Report
**GET** `/v3/session/{sessionId}/generate-pdf`

Rate limited to 100 req/min (CPU-bound operation).

---

### 7. Share Session
**POST** `/v3/session/{sessionId}/share/`

Works only for finished sessions (Approved, Declined, In Review). Returns a `share_token` for B2B KYC sharing.

---

### 8. Import Shared Session
**POST** `/v3/session/import-shared/`

| Parameter | Required |
|---|---|
| `share_token` | Yes |
| `trust_review` | Yes |
| `workflow_id` | Yes |
| `vendor_data` | No |

A session may only be imported **once** per partner application.

---

### 9. Blocklist - Add
**POST** `/v3/blocklist/add/`

| Parameter | Default |
|---|---|
| `session_id` | - |
| `blocklist_face` | false |
| `blocklist_document` | false |
| `blocklist_phone` | false |
| `blocklist_email` | false |

Matched items trigger auto-decline warnings: `FACE_IN_BLOCKLIST`, `ID_DOCUMENT_IN_BLOCKLIST`, `PHONE_NUMBER_IN_BLOCKLIST`, `EMAIL_IN_BLOCKLIST`.

---

### 10. Blocklist - Remove
**POST** `/v3/blocklist/remove/`

Same structure as Add, using `unblock_face`, `unblock_document`, `unblock_phone`, `unblock_email`.

---

### 11. Blocklist - List
**GET** `/v3/blocklist/`

Optional query param `item_type`: `"face"`, `"document"`, `"phone"`, or `"email"`. Omit to retrieve all.

---

## Rate Limits

| Operation | Limit |
|---|---|
| General | 300 req/min |
| Session creation | 600 req/min |
| Decision polling | 100 req/min |
| PDF generation | 100 req/min |

On `429`, check the `Retry-After` header and apply exponential backoff.

---

## Error Reference

| Code | Meaning |
|---|---|
| `400` | Invalid request body or parameters |
| `401` | Invalid or missing API key |
| `403` | Insufficient credits or no permission |
| `404` | Session not found |
| `429` | Rate limited |

---

## Common Patterns

### Basic KYC
1. Create session -> redirect user to returned URL
2. Await webhook or poll `/decision/`
3. Handle `Approved`, `Declined`, or `In Review` outcomes

### Programmatic Review + Blocklist
1. Receive `In Review` webhook
2. Fetch decision, apply business logic
3. Approve or decline via PATCH; block fraud entities via blocklist add

### B2B KYC Sharing
- **Sharer:** POST to `/share/` -> transmit `share_token` to partner
- **Receiver:** POST to `/import-shared/` with `trust_review` flag

### Biometric Re-Authentication
1. Retrieve `portrait_image` from original approved session
2. Create new session with biometric auth workflow + portrait
3. User selfie matched against stored portrait
