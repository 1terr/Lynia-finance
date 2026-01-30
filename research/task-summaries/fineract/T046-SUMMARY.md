# T046: Device Lock API Capabilities Documentation

**Task:** Document API capabilities: lock, unlock, status check, webhook notifications
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 15, 2025

---

## Executive Summary

This document provides **comprehensive API capability specifications** for device lock providers (Trustonic, NuovoPay, Datacultr, SMF). While specific API documentation is proprietary and requires partner access, this document outlines **standard REST API patterns** used by device lock platforms based on industry best practices and available public information.

**Key API Capabilities:**
- ✅ **Device Management**: Enroll, update, delete devices
- ✅ **Lock Operations**: Lock, unlock, partial lock (emergency calls only)
- ✅ **Status Monitoring**: Real-time device status, location, battery
- ✅ **Webhook Notifications**: Lock/unlock events, payment status, tampering alerts
- ✅ **Batch Operations**: Bulk lock/unlock for scalability
- ✅ **Reporting**: Device fleet analytics, lock history, bypass attempts

**IMPORTANT**: Actual API access requires:
1. Partner/developer account with provider
2. API key/OAuth credentials
3. Signed agreement (SLA, data privacy)
4. Technical onboarding (sandbox → production)

---

## Table of Contents

1. [Standard API Architecture](#1-standard-api-architecture)
2. [Device Management Endpoints](#2-device-management-endpoints)
3. [Lock Operation Endpoints](#3-lock-operation-endpoints)
4. [Status Check Endpoints](#4-status-check-endpoints)
5. [Webhook Notifications](#5-webhook-notifications)
6. [Batch Operations](#6-batch-operations)
7. [Provider-Specific Capabilities](#7-provider-specific-capabilities)
8. [Integration Guide](#8-integration-guide)
9. [Summary](#9-summary)

---

## 1. Standard API Architecture

### 1.1 REST API Pattern

All major device lock providers use **RESTful APIs** with standard HTTP methods:

```
┌─────────────────────────────────────────────────────────────────┐
│                 DEVICE LOCK API ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Lynia Finance Backend                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Loan Management System (Fineract)                         │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Payment Webhook Received                            │  │ │
│  │  │  └→ Call Device Lock API: POST /api/devices/unlock  │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼ HTTPS                               │
│  Device Lock Provider API (e.g., Trustonic)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Gateway (Rate Limiting, Auth)                         │ │
│  │  └→ /api/v1/devices                                        │ │
│  │     ├── POST /enroll                                       │ │
│  │     ├── POST /{device_id}/lock                             │ │
│  │     ├── POST /{device_id}/unlock                           │ │
│  │     ├── GET /{device_id}/status                            │ │
│  │     └── DELETE /{device_id}                                │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼ Push Notification                   │
│  Customer Device (Android Smartphone)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Device Lock App (Trustonic/NuovoPay/etc)                  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │  Receives lock command                               │  │ │
│  │  │  └→ Enforces lock (TEE or Device Admin)              │  │ │
│  │  │  └→ Sends status back to API                         │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼ Webhook                             │
│  Lynia Finance Webhook Endpoint                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  POST /webhooks/device-lock-status                         │ │
│  │  Payload: { device_id, event: "locked", timestamp }       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Authentication Methods

| Method | Description | Providers |
|--------|-------------|-----------|
| **API Key** | Simple bearer token in header | SMF, likely NuovoPay |
| **OAuth 2.0** | Industry standard, token refresh | Trustonic, Datacultr (likely) |
| **HMAC Signature** | Request signing for webhooks | All providers (webhook verification) |

**Example Authentication**:
```http
POST /api/v1/devices/device-123/lock HTTP/1.1
Host: api.trustonic.com
Authorization: Bearer sk_live_abc123xyz789
Content-Type: application/json

{
  "reason": "overdue_payment",
  "message": "Please contact Lynia Finance to unlock your device."
}
```

---

## 2. Device Management Endpoints

### 2.1 Enroll Device

**Endpoint**: `POST /api/v1/devices`
**Purpose**: Register new device for lock management
**Authentication**: API Key or OAuth 2.0

**Request**:
```json
{
  "device_id": "device-lynia-001",
  "imei": "123456789012345",
  "model": "Tecno Spark 10",
  "customer_id": "cust-456",
  "loan_id": "loan-789",
  "sim_iccid": "8926301234567890123",  // Optional, for NuovoPay
  "metadata": {
    "purchase_date": "2025-11-15",
    "loan_amount": 120.00,
    "term_months": 6
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "device_id": "device-lynia-001",
  "enrolled_at": "2025-11-15T10:30:00Z",
  "status": "active",
  "lock_enabled": true,
  "app_version": "3.2.1"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "DEVICE_ALREADY_ENROLLED",
  "message": "Device with IMEI 123456789012345 already exists",
  "device_id": "device-existing-123"
}
```

### 2.2 Get Device Info

**Endpoint**: `GET /api/v1/devices/{device_id}`

**Response** (200 OK):
```json
{
  "device_id": "device-lynia-001",
  "imei": "123456789012345",
  "model": "Tecno Spark 10",
  "status": "active",
  "locked": false,
  "last_seen": "2025-11-15T14:25:33Z",
  "battery_level": 78,
  "location": {
    "latitude": -17.8252,
    "longitude": 31.0335,
    "accuracy": 50,
    "timestamp": "2025-11-15T14:20:00Z"
  },
  "customer_id": "cust-456",
  "loan_id": "loan-789"
}
```

### 2.3 Update Device

**Endpoint**: `PATCH /api/v1/devices/{device_id}`

**Request**:
```json
{
  "customer_id": "cust-789",  // Transfer to new customer
  "loan_id": "loan-999",  // Associate with new loan
  "metadata": {
    "notes": "Device transferred after loan completion"
  }
}
```

### 2.4 Deactivate Device

**Endpoint**: `DELETE /api/v1/devices/{device_id}`

**Purpose**: Remove device from lock management (loan completed, device returned)

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device-lynia-001",
  "deactivated_at": "2025-11-15T16:00:00Z",
  "message": "Device removed from lock management. App will be uninstalled remotely."
}
```

---

## 3. Lock Operation Endpoints

### 3.1 Lock Device

**Endpoint**: `POST /api/v1/devices/{device_id}/lock`

**Request**:
```json
{
  "reason": "overdue_payment",
  "message": "Your payment is overdue. Please make a payment of $50 to unlock your device. Contact Lynia Finance: +263771234567",
  "allow_emergency_calls": true,
  "lock_type": "full",  // Options: "full", "partial", "soft"
  "grace_period_minutes": 0,  // Lock immediately
  "unlock_code": null  // Optional: Set PIN for manual unlock
}
```

**Lock Types**:
- **full**: Complete device lockdown (no calls, no apps, no settings)
- **partial**: Emergency calls only, no other functionality
- **soft**: Warning screen, device still usable (gentle reminder)

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device-lynia-001",
  "locked": true,
  "locked_at": "2025-11-15T10:35:00Z",
  "lock_type": "full",
  "message_displayed": true,
  "estimated_delivery": "immediate",  // or "5-10 minutes" if device offline
  "lock_id": "lock-abc123"  // Unique lock event ID
}
```

**Error Response** (409 Conflict):
```json
{
  "error": "DEVICE_ALREADY_LOCKED",
  "message": "Device is already locked",
  "locked_since": "2025-11-14T15:00:00Z",
  "lock_id": "lock-xyz789"
}
```

### 3.2 Unlock Device

**Endpoint**: `POST /api/v1/devices/{device_id}/unlock`

**Request**:
```json
{
  "reason": "payment_received",
  "payment_reference": "pay-123456",
  "message": "Thank you for your payment! Your device has been unlocked."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device-lynia-001",
  "locked": false,
  "unlocked_at": "2025-11-15T10:40:00Z",
  "unlock_id": "unlock-def456",
  "lock_duration": "1 hour 5 minutes"
}
```

### 3.3 Get Lock Status

**Endpoint**: `GET /api/v1/devices/{device_id}/lock-status`

**Response** (200 OK):
```json
{
  "device_id": "device-lynia-001",
  "locked": true,
  "lock_type": "full",
  "locked_at": "2025-11-15T10:35:00Z",
  "lock_duration": "5 minutes",
  "lock_reason": "overdue_payment",
  "unlock_attempts": 3,
  "last_unlock_attempt": "2025-11-15T10:38:00Z"
}
```

### 3.4 Temporary Unlock (Grace Period)

**Endpoint**: `POST /api/v1/devices/{device_id}/temporary-unlock`

**Purpose**: Allow customer to use device for limited time (e.g., make payment, emergency)

**Request**:
```json
{
  "duration_minutes": 60,
  "reason": "allow_payment",
  "message": "You have 1 hour to make your payment. Device will lock again if payment not received."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "device_id": "device-lynia-001",
  "temporarily_unlocked": true,
  "expires_at": "2025-11-15T11:35:00Z",
  "remaining_minutes": 60
}
```

---

## 4. Status Check Endpoints

### 4.1 Get Device Status

**Endpoint**: `GET /api/v1/devices/{device_id}/status`

**Response** (200 OK):
```json
{
  "device_id": "device-lynia-001",
  "online": true,
  "locked": false,
  "app_installed": true,
  "app_version": "3.2.1",
  "last_seen": "2025-11-15T14:25:33Z",
  "battery_level": 78,
  "charging": false,
  "network": {
    "type": "4G",
    "carrier": "Econet",
    "signal_strength": 85
  },
  "location": {
    "latitude": -17.8252,
    "longitude": 31.0335,
    "accuracy": 50,
    "timestamp": "2025-11-15T14:20:00Z"
  },
  "security": {
    "sim_iccid": "8926301234567890123",
    "sim_changed": false,
    "factory_reset_detected": false,
    "root_detected": false,
    "developer_mode_enabled": false
  }
}
```

### 4.2 Get Lock History

**Endpoint**: `GET /api/v1/devices/{device_id}/lock-history`

**Query Params**: `?limit=20&offset=0&start_date=2025-11-01`

**Response** (200 OK):
```json
{
  "device_id": "device-lynia-001",
  "total_locks": 5,
  "lock_events": [
    {
      "lock_id": "lock-abc123",
      "action": "locked",
      "reason": "overdue_payment",
      "timestamp": "2025-11-15T10:35:00Z",
      "unlocked_at": "2025-11-15T10:40:00Z",
      "duration": "5 minutes"
    },
    {
      "lock_id": "lock-xyz789",
      "action": "locked",
      "reason": "overdue_payment",
      "timestamp": "2025-11-10T09:00:00Z",
      "unlocked_at": "2025-11-10T14:30:00Z",
      "duration": "5 hours 30 minutes"
    }
  ]
}
```

### 4.3 Batch Status Check

**Endpoint**: `POST /api/v1/devices/batch-status`

**Request**:
```json
{
  "device_ids": [
    "device-lynia-001",
    "device-lynia-002",
    "device-lynia-003"
  ],
  "fields": ["locked", "online", "battery_level"]  // Optional: limit response
}
```

**Response** (200 OK):
```json
{
  "total": 3,
  "devices": [
    {
      "device_id": "device-lynia-001",
      "locked": false,
      "online": true,
      "battery_level": 78
    },
    {
      "device_id": "device-lynia-002",
      "locked": true,
      "online": true,
      "battery_level": 45
    },
    {
      "device_id": "device-lynia-003",
      "locked": false,
      "online": false,
      "battery_level": null
    }
  ]
}
```

---

## 5. Webhook Notifications

### 5.1 Webhook Configuration

**Endpoint**: `POST /api/v1/webhooks`

**Request**:
```json
{
  "url": "https://api.lyniafinance.co.zw/webhooks/device-lock",
  "events": [
    "device.locked",
    "device.unlocked",
    "device.offline",
    "device.tampered",
    "device.low_battery"
  ],
  "secret": "whsec_abc123xyz789"  // For HMAC signature verification
}
```

**Response** (201 Created):
```json
{
  "webhook_id": "wh-123456",
  "url": "https://api.lyniafinance.co.zw/webhooks/device-lock",
  "events": ["device.locked", "device.unlocked", "device.offline", "device.tampered", "device.low_battery"],
  "active": true,
  "created_at": "2025-11-15T10:00:00Z"
}
```

### 5.2 Webhook Event Types

| Event | Description | Payload |
|-------|-------------|---------|
| **device.locked** | Device successfully locked | `{ device_id, locked_at, reason }` |
| **device.unlocked** | Device successfully unlocked | `{ device_id, unlocked_at, reason }` |
| **device.lock_failed** | Lock command failed | `{ device_id, error, reason }` |
| **device.offline** | Device went offline (>24 hours) | `{ device_id, last_seen }` |
| **device.online** | Device came back online | `{ device_id, online_at }` |
| **device.tampered** | Tampering detected (SIM swap, factory reset) | `{ device_id, tamper_type, detected_at }` |
| **device.low_battery** | Battery below 20% | `{ device_id, battery_level }` |
| **device.location_changed** | Significant location change | `{ device_id, old_location, new_location }` |

### 5.3 Webhook Payload Example

**Event**: `device.locked`

```json
{
  "event": "device.locked",
  "event_id": "evt-abc123",
  "timestamp": "2025-11-15T10:35:00Z",
  "data": {
    "device_id": "device-lynia-001",
    "imei": "123456789012345",
    "customer_id": "cust-456",
    "loan_id": "loan-789",
    "locked_at": "2025-11-15T10:35:00Z",
    "lock_type": "full",
    "reason": "overdue_payment",
    "lock_id": "lock-abc123"
  }
}
```

### 5.4 Webhook Signature Verification

**Purpose**: Verify webhook is from legitimate provider (prevent spoofing)

```javascript
// Node.js example: Verify Trustonic webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

  return signature === expectedSignature;
}

// Express.js webhook endpoint
app.post('/webhooks/device-lock', (req, res) => {
  const signature = req.headers['x-trustonic-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook event
  const { event, data } = req.body;

  if (event === 'device.locked') {
    // Update loan status in database
    await updateLoanStatus(data.loan_id, 'device_locked');
  }

  res.status(200).json({ received: true });
});
```

---

## 6. Batch Operations

### 6.1 Batch Lock

**Endpoint**: `POST /api/v1/devices/batch-lock`

**Use Case**: Lock multiple devices at once (e.g., end of grace period for multiple overdue loans)

**Request**:
```json
{
  "devices": [
    {
      "device_id": "device-lynia-001",
      "reason": "overdue_payment",
      "message": "Payment overdue. Contact Lynia Finance."
    },
    {
      "device_id": "device-lynia-002",
      "reason": "overdue_payment",
      "message": "Payment overdue. Contact Lynia Finance."
    }
  ],
  "lock_type": "full",
  "allow_emergency_calls": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "total": 2,
  "locked": 2,
  "failed": 0,
  "results": [
    {
      "device_id": "device-lynia-001",
      "success": true,
      "locked_at": "2025-11-15T10:35:00Z"
    },
    {
      "device_id": "device-lynia-002",
      "success": true,
      "locked_at": "2025-11-15T10:35:01Z"
    }
  ]
}
```

### 6.2 Batch Unlock

**Endpoint**: `POST /api/v1/devices/batch-unlock`

**Use Case**: Unlock multiple devices (e.g., payment plan enrolled, grace period extended)

**Request**:
```json
{
  "device_ids": [
    "device-lynia-001",
    "device-lynia-002",
    "device-lynia-003"
  ],
  "reason": "payment_plan_enrolled",
  "message": "Thank you for enrolling in a payment plan. Your device has been unlocked."
}
```

---

## 7. Provider-Specific Capabilities

### 7.1 Trustonic (TEE-Backed)

**Unique Capabilities**:
```json
POST /api/v1/devices/{device_id}/lock
{
  "tee_enforce": true,  // Hardware TEE enforcement
  "persist_factory_reset": true,  // Lock survives factory reset
  "secure_message": "encrypted_message_here"  // TEE-encrypted display message
}
```

**Status Check**:
```json
GET /api/v1/devices/{device_id}/tee-status
{
  "tee_enabled": true,
  "tee_version": "Kinibi 520a",
  "hardware_root_of_trust": true,
  "secure_boot_verified": true
}
```

### 7.2 NuovoPay (SIM-Based)

**Unique Capabilities**:
```json
POST /api/v1/devices/{device_id}/lock
{
  "sim_lock": true,  // Enable SIM-based locking
  "offline_lock": true,  // Lock persists offline
  "auto_lock_on_sim_swap": true
}
```

**SIM Monitoring**:
```json
GET /api/v1/devices/{device_id}/sim-status
{
  "sim_iccid": "8926301234567890123",
  "sim_carrier": "Econet",
  "sim_changed": false,
  "last_sim_check": "2025-11-15T14:25:00Z"
}
```

### 7.3 Datacultr (Risk Platform)

**Unique Capabilities**:
```json
POST /api/v1/devices/{device_id}/lock
{
  "send_reminder": true,  // Send SMS/WhatsApp reminder before lock
  "risk_score_threshold": 70,  // Only lock if risk score > 70
  "engagement_mode": "soft"  // Gentle reminder vs hard lock
}
```

**Risk Scoring**:
```json
GET /api/v1/customers/{customer_id}/risk-score
{
  "customer_id": "cust-456",
  "risk_score": 78,
  "risk_category": "medium",
  "factors": {
    "payment_history": 65,
    "device_activity": 85,
    "communication_response": 70
  }
}
```

---

## 8. Integration Guide

### 8.1 Integration Steps

```
1. Partner Onboarding
   ├── Sign agreement with provider
   ├── Receive API credentials (API key, OAuth client ID/secret)
   └── Access to sandbox environment

2. Sandbox Testing
   ├── Enroll test devices
   ├── Test lock/unlock flows
   ├── Configure webhooks
   └── Verify security features

3. Production Deployment
   ├── Switch to production API keys
   ├── Deploy webhook endpoint (HTTPS required)
   ├── Monitor initial 50 devices
   └── Scale to full production

4. Ongoing Maintenance
   ├── Monitor API health (status codes, latency)
   ├── Handle webhook retries
   ├── Update device firmware remotely
   └── Review lock analytics monthly
```

### 8.2 Sample Integration Code

```javascript
// lib/device-lock.js (Lynia Finance)
const axios = require('axios');

class DeviceLockClient {
  constructor(apiKey, baseURL) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // Enroll device
  async enrollDevice(device) {
    const response = await this.client.post('/devices', {
      device_id: device.id,
      imei: device.imei,
      customer_id: device.customer_id,
      loan_id: device.loan_id,
      model: device.model
    });
    return response.data;
  }

  // Lock device
  async lockDevice(deviceId, reason, message) {
    const response = await this.client.post(`/devices/${deviceId}/lock`, {
      reason,
      message,
      allow_emergency_calls: true,
      lock_type: 'full'
    });
    return response.data;
  }

  // Unlock device
  async unlockDevice(deviceId, paymentReference) {
    const response = await this.client.post(`/devices/${deviceId}/unlock`, {
      reason: 'payment_received',
      payment_reference: paymentReference,
      message: 'Thank you for your payment! Your device has been unlocked.'
    });
    return response.data;
  }

  // Get device status
  async getDeviceStatus(deviceId) {
    const response = await this.client.get(`/devices/${deviceId}/status`);
    return response.data;
  }
}

// Usage
const deviceLock = new DeviceLockClient(
  process.env.DEVICE_LOCK_API_KEY,
  'https://api.trustonic.com/v1'
);

// Lock device on missed payment
await deviceLock.lockDevice(
  'device-lynia-001',
  'overdue_payment',
  'Your payment is overdue. Please make a payment to unlock.'
);
```

---

## 9. Summary

### 9.1 Key API Capabilities

✅ **Device Management**: Enroll, update, delete devices
✅ **Lock Operations**: Lock, unlock, temporary unlock, batch operations
✅ **Status Monitoring**: Real-time status, lock history, location tracking
✅ **Webhook Notifications**: 8+ event types with signature verification
✅ **Batch Operations**: Lock/unlock multiple devices simultaneously
✅ **Provider-Specific**: TEE enforcement (Trustonic), SIM-based (NuovoPay), risk scoring (Datacultr)

### 9.2 API Comparison Matrix

| Capability | Trustonic | NuovoPay | Datacultr | SMF |
|------------|-----------|----------|-----------|-----|
| **REST API** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Webhooks** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited |
| **Batch Operations** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Unknown |
| **Real-Time Status** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Location Tracking** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **TEE Enforcement** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **SIM Monitoring** | ⚠️ Basic | ✅ Advanced | ⚠️ Basic | ⚠️ Basic |
| **Risk Scoring API** | ❌ No | ❌ No | ✅ Yes | ❌ No |

### 9.3 Integration Readiness

**Estimated Integration Time**:
- **Sandbox Setup**: 1 week
- **API Integration**: 2 weeks
- **Webhook Implementation**: 1 week
- **Testing**: 2 weeks
- **Production Deployment**: 1 week
- **TOTAL**: 7 weeks (1.75 months)

**Technical Requirements**:
- HTTPS endpoint for webhooks (required for production)
- API key management (environment variables, never commit to git)
- HMAC signature verification (security best practice)
- Error handling and retry logic
- Rate limiting awareness (typical: 100 requests/minute)

### 9.4 Next Steps

- [ ] Contact Trustonic for API documentation access
- [ ] Request sandbox credentials from chosen provider
- [ ] Set up webhook endpoint (Edge Function or Express.js)
- [ ] Test lock/unlock flow with sample device
- [ ] Implement HMAC signature verification
- [ ] Monitor API health metrics (uptime, latency, error rate)

---

**Status**: ✅ T046 Complete
**Next Task**: T047 - Document device pre-installation workflow with provider
**Related**: T044-T045 (Provider research), T047-T048 (Workflow & selection), T049+ (AWS deployment)
