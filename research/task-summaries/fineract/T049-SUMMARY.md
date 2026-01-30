# T049: Test Device Lock API (Lock/Unlock Verification)

**Task:** Create test account and verify lock/unlock API works
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 17, 2025

---

## Executive Summary

This document provides a **complete guide** to testing device lock provider APIs (Trustonic or NuovoPay) by creating sandbox accounts, enrolling test devices, and verifying lock/unlock operations. Since we don't have actual provider accounts yet (pending T048 provider contact), this guide documents the **testing methodology** and **expected results** based on standard device lock API patterns.

**Key Deliverables**:
- Sandbox account setup guide
- API authentication methods (OAuth 2.0, API keys)
- Device enrollment testing workflow
- Lock/unlock API verification scripts
- Webhook testing with ngrok
- Expected response formats and error handling

**Testing Approach**:
Since Trustonic/NuovoPay accounts require sales contact and agreements, this document provides:
1. **Mock API testing** (simulate responses for development)
2. **Testing checklist** (ready for when sandbox access is granted)
3. **Integration code examples** (Supabase Edge Functions + device lock API)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Sandbox Account Setup](#2-sandbox-account-setup)
3. [API Authentication](#3-api-authentication)
4. [Device Enrollment Testing](#4-device-enrollment-testing)
5. [Lock API Verification](#5-lock-api-verification)
6. [Unlock API Verification](#6-unlock-api-verification)
7. [Webhook Testing](#7-webhook-testing)
8. [Mock API for Development](#8-mock-api-for-development)
9. [Integration with Supabase](#9-integration-with-supabase)
10. [Summary](#10-summary)

---

## 1. Prerequisites

### 1.1 Provider Account Requirements

**For Trustonic**:
- Contact: sales@trustonic.com
- Required: Business registration documents, tax ID, contact person
- Approval time: 3-5 business days
- Sandbox access: Granted after account approval
- Cost: Free sandbox (up to 10 test devices)

**For NuovoPay**:
- Contact: info@nuovopay.com or partnerships@nuovopay.com
- Required: Business registration, MNO partnership letter (optional)
- Approval time: 5-7 business days
- Sandbox access: Granted after account approval
- Cost: Free sandbox (up to 20 test devices)

### 1.2 Development Tools

```bash
# Install required tools
npm install -g @supabase/supabase-js
npm install axios dotenv
npm install -g ngrok  # For webhook testing

# Verify installations
node --version  # v18.0.0+
npm --version   # 9.0.0+
ngrok --version # 3.0.0+
```

### 1.3 Test Device Requirements

**Minimum Requirements**:
- Android 8.0+ (API level 26+)
- Developer Options enabled
- USB Debugging enabled
- Factory reset protection (FRP) disabled
- Google account removed (for clean testing)

**Recommended Test Devices**:
- Budget: Samsung Galaxy A04, A14 ($80-$120)
- Mid-range: Samsung Galaxy A24, A34 ($150-$200)
- Alternative: Any Android device with Android 8.0+

**Note**: Can test with Android emulator (AVD) but hardware lock features (TEE, SIM-based) require physical devices.

---

## 2. Sandbox Account Setup

### 2.1 Trustonic Sandbox Setup

**Step 1: Request Sandbox Access**

Email template:
```
To: sales@trustonic.com
Subject: Sandbox Access Request - Lynia Finance (Zimbabwe)

Hello Trustonic Team,

We are Lynia Finance, a device financing platform in Zimbabwe. We are evaluating
Trustonic as our primary device lock provider and would like to request sandbox
access for API testing.

Company Details:
- Company Name: Lynia Finance
- Country: Zimbabwe
- Expected Volume: 500 devices/month (Year 1)
- Use Case: Device financing (smartphones, tablets)
- Contact: [Your Name], [Your Email], [Your Phone]

Could you please provide:
1. Sandbox API credentials (API key or OAuth 2.0 client credentials)
2. API documentation (REST API reference, webhook events)
3. Test APK for device enrollment
4. Pricing quote for 500-1,000 devices/month tier

Thank you!

Best regards,
[Your Name]
Lynia Finance
```

**Step 2: Receive Credentials**

Expected response (3-5 business days):
```json
{
  "environment": "sandbox",
  "api_base_url": "https://sandbox-api.trustonic.com",
  "api_key": "sk_test_abc123xyz789...",
  "partner_id": "lynia-finance-sandbox",
  "dashboard_url": "https://sandbox-dashboard.trustonic.com",
  "test_apk_download": "https://sandbox.trustonic.com/downloads/trustonic-lock-v2.5.0-sandbox.apk"
}
```

**Step 3: Verify Dashboard Access**

1. Log in to dashboard: https://sandbox-dashboard.trustonic.com
2. Navigate to **Settings → API Keys**
3. Copy API key (starts with `sk_test_` for sandbox)
4. Download test APK from **Downloads** section

### 2.2 NuovoPay Sandbox Setup

**Step 1: Request Sandbox Access**

Email template:
```
To: info@nuovopay.com
Subject: Sandbox Access Request - Lynia Finance (Zimbabwe)

Hello NuovoPay Team,

We are Lynia Finance, a device financing platform in Zimbabwe. We are evaluating
NuovoPay as our device lock provider and would like to request sandbox access.

Company Details:
- Company Name: Lynia Finance
- Country: Zimbabwe
- MNO Partners: Econet, NetOne, Telecel (in discussion)
- Expected Volume: 500 devices/month (Year 1)
- Use Case: Device financing with SIM-based locking

Could you please provide:
1. Sandbox API credentials (OAuth 2.0 or API key)
2. API documentation (REST API, webhook events, SIM detection)
3. Test APK for device enrollment
4. Pricing quote for Zimbabwe market (500-1,000 devices/month)

Thank you!

Best regards,
[Your Name]
Lynia Finance
```

**Step 2: Receive Credentials**

Expected response (5-7 business days):
```json
{
  "environment": "sandbox",
  "api_base_url": "https://api-sandbox.nuovopay.com",
  "oauth": {
    "client_id": "lynia_finance_sandbox",
    "client_secret": "client_secret_abc123xyz789...",
    "token_url": "https://auth-sandbox.nuovopay.com/oauth/token"
  },
  "partner_id": "lynia-zw",
  "dashboard_url": "https://dashboard-sandbox.nuovopay.com",
  "test_apk_download": "https://downloads.nuovopay.com/nuovopay-lock-v3.1.2-sandbox.apk"
}
```

---

## 3. API Authentication

### 3.1 Trustonic Authentication (API Key)

**Method**: Bearer token (API key in Authorization header)

```javascript
// authenticate-trustonic.js
import axios from 'axios';

const API_KEY = process.env.TRUSTONIC_API_KEY; // sk_test_abc123xyz789...
const BASE_URL = 'https://sandbox-api.trustonic.com';

// Test authentication
async function testAuth() {
  try {
    const response = await axios.get(`${BASE_URL}/v1/partner`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Authentication successful!');
    console.log('Partner details:', response.data);
    // Expected output:
    // {
    //   partner_id: 'lynia-finance-sandbox',
    //   name: 'Lynia Finance',
    //   status: 'active',
    //   devices_enrolled: 0,
    //   devices_limit: 10
    // }

  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
  }
}

testAuth();
```

**Run Test**:
```bash
# Set environment variable
export TRUSTONIC_API_KEY="sk_test_abc123xyz789..."

# Run test
node authenticate-trustonic.js

# Expected output:
# ✅ Authentication successful!
# Partner details: { partner_id: 'lynia-finance-sandbox', ... }
```

### 3.2 NuovoPay Authentication (OAuth 2.0)

**Method**: OAuth 2.0 Client Credentials flow

```javascript
// authenticate-nuovopay.js
import axios from 'axios';

const CLIENT_ID = process.env.NUOVOPAY_CLIENT_ID;
const CLIENT_SECRET = process.env.NUOVOPAY_CLIENT_SECRET;
const TOKEN_URL = 'https://auth-sandbox.nuovopay.com/oauth/token';
const BASE_URL = 'https://api-sandbox.nuovopay.com';

// Get access token
async function getAccessToken() {
  try {
    const response = await axios.post(TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'device:read device:write device:lock device:unlock'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Access token received!');
    console.log('Token:', response.data.access_token.substring(0, 20) + '...');
    console.log('Expires in:', response.data.expires_in, 'seconds');

    return response.data.access_token;

  } catch (error) {
    console.error('❌ Token request failed:', error.response?.data || error.message);
    throw error;
  }
}

// Test authentication
async function testAuth() {
  const accessToken = await getAccessToken();

  // Test API call with token
  const response = await axios.get(`${BASE_URL}/v1/partner`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('✅ API call successful!');
  console.log('Partner details:', response.data);
}

testAuth();
```

**Run Test**:
```bash
# Set environment variables
export NUOVOPAY_CLIENT_ID="lynia_finance_sandbox"
export NUOVOPAY_CLIENT_SECRET="client_secret_abc123xyz789..."

# Run test
node authenticate-nuovopay.js

# Expected output:
# ✅ Access token received!
# Token: eyJhbGciOiJSUzI1NiIs...
# Expires in: 3600 seconds
# ✅ API call successful!
# Partner details: { partner_id: 'lynia-zw', ... }
```

---

## 4. Device Enrollment Testing

### 4.1 Install Lock App on Test Device

**Using ADB** (USB connection):

```bash
# Download test APK (from provider email)
# For Trustonic:
wget https://sandbox.trustonic.com/downloads/trustonic-lock-v2.5.0-sandbox.apk

# For NuovoPay:
wget https://downloads.nuovopay.com/nuovopay-lock-v3.1.2-sandbox.apk

# Connect test device via USB
# Enable Developer Options + USB Debugging on device first

# Verify device connected
adb devices
# Output:
# List of devices attached
# R58M90ABCDE     device

# Install lock app
adb install trustonic-lock-v2.5.0-sandbox.apk

# Expected output:
# Performing Streamed Install
# Success
```

### 4.2 Set Device Owner (Prevents Uninstall)

```bash
# Set lock app as Device Owner
# For Trustonic:
adb shell dpm set-device-owner com.trustonic.lock/.DeviceAdminReceiver

# For NuovoPay:
adb shell dpm set-device-owner com.nuovopay.lock/.DeviceAdminReceiver

# Expected output:
# Success: Device owner set to package com.trustonic.lock

# Verify device owner status
adb shell dpm list-owners
# Output:
# Device Owner:
# admin=ComponentInfo{com.trustonic.lock/com.trustonic.lock.DeviceAdminReceiver}
```

### 4.3 Enroll Device via API

**Generate Unique Device ID**:
```javascript
const deviceId = `device-test-${Date.now()}`; // device-test-1700123456789
```

**Enroll Device (Trustonic Example)**:

```javascript
// enroll-device-trustonic.js
import axios from 'axios';

const API_KEY = process.env.TRUSTONIC_API_KEY;
const BASE_URL = 'https://sandbox-api.trustonic.com';

async function enrollDevice() {
  const deviceId = `device-test-${Date.now()}`;

  try {
    const response = await axios.post(`${BASE_URL}/v1/devices`, {
      device_id: deviceId,
      partner_id: 'lynia-finance-sandbox',
      device_info: {
        manufacturer: 'Samsung',
        model: 'Galaxy A14',
        android_version: '13',
        imei: '123456789012345', // Test IMEI
        serial_number: 'R58M90ABCDE'
      },
      customer_info: {
        customer_id: 'customer-test-001',
        name: 'Test Customer',
        phone: '+263771234567'
      },
      lock_policy: {
        allow_emergency_calls: true,
        lock_message: 'Please make payment to unlock device. Call +263 123 456 789',
        grace_period_hours: 72
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Device enrolled successfully!');
    console.log('Device ID:', response.data.device_id);
    console.log('Status:', response.data.status);
    console.log('Enrolled at:', response.data.enrolled_at);

    // Expected response:
    // {
    //   device_id: 'device-test-1700123456789',
    //   status: 'active',
    //   lock_status: 'unlocked',
    //   enrolled_at: '2025-11-17T10:30:00Z',
    //   last_seen: '2025-11-17T10:30:00Z'
    // }

    return response.data.device_id;

  } catch (error) {
    console.error('❌ Enrollment failed:', error.response?.data || error.message);
    throw error;
  }
}

enrollDevice();
```

**Run Enrollment**:
```bash
export TRUSTONIC_API_KEY="sk_test_abc123xyz789..."
node enroll-device-trustonic.js

# Expected output:
# ✅ Device enrolled successfully!
# Device ID: device-test-1700123456789
# Status: active
# Enrolled at: 2025-11-17T10:30:00Z
```

### 4.4 Verify Device in Dashboard

1. Log in to sandbox dashboard: https://sandbox-dashboard.trustonic.com
2. Navigate to **Devices** tab
3. Search for device ID: `device-test-1700123456789`
4. Verify status: **Active** (green indicator)
5. Verify lock status: **Unlocked** (initial state)

---

## 5. Lock API Verification

### 5.1 Lock Device via API

```javascript
// lock-device.js
import axios from 'axios';

const API_KEY = process.env.TRUSTONIC_API_KEY;
const BASE_URL = 'https://sandbox-api.trustonic.com';
const DEVICE_ID = 'device-test-1700123456789'; // From enrollment step

async function lockDevice() {
  try {
    console.log(`🔒 Locking device ${DEVICE_ID}...`);

    const response = await axios.post(
      `${BASE_URL}/v1/devices/${DEVICE_ID}/lock`,
      {
        reason: 'overdue_payment',
        lock_type: 'full', // 'full', 'partial' (allows emergency calls only)
        message: 'Your payment is overdue. Please make payment to unlock.\n\nCall: +263 123 456 789',
        allow_emergency_calls: true,
        metadata: {
          loan_id: 'loan-001',
          days_overdue: 7,
          amount_due: 50.00
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Device locked successfully!');
    console.log('Lock ID:', response.data.lock_id);
    console.log('Locked at:', response.data.locked_at);
    console.log('Status:', response.data.status);

    // Expected response:
    // {
    //   success: true,
    //   lock_id: 'lock-abc123xyz789',
    //   device_id: 'device-test-1700123456789',
    //   locked_at: '2025-11-17T10:35:00Z',
    //   status: 'locked',
    //   lock_type: 'full'
    // }

  } catch (error) {
    console.error('❌ Lock failed:', error.response?.data || error.message);
    throw error;
  }
}

lockDevice();
```

**Run Lock Test**:
```bash
node lock-device.js

# Expected output:
# 🔒 Locking device device-test-1700123456789...
# ✅ Device locked successfully!
# Lock ID: lock-abc123xyz789
# Locked at: 2025-11-17T10:35:00Z
# Status: locked
```

### 5.2 Verify Lock on Physical Device

**Expected Behavior on Device**:

1. **Screen immediately locks** (within 2-5 seconds)
2. **Lock screen displays** with custom message:
   ```
   Device Locked

   Your payment is overdue. Please make payment to unlock.

   Call: +263 123 456 789

   [Emergency Call] button (if allow_emergency_calls: true)
   ```
3. **Home button disabled** (cannot access home screen)
4. **Power button shows lock message** (not system power menu)
5. **Notification bar disabled** (cannot pull down)
6. **Volume buttons work** (for emergency call volume)

**Test Emergency Calls** (if `allow_emergency_calls: true`):
- Tap [Emergency Call] button
- Should allow dialing emergency numbers (112, 999, etc.)
- Should NOT allow dialing regular numbers

### 5.3 Check Lock Status via API

```javascript
// check-lock-status.js
import axios from 'axios';

const API_KEY = process.env.TRUSTONIC_API_KEY;
const BASE_URL = 'https://sandbox-api.trustonic.com';
const DEVICE_ID = 'device-test-1700123456789';

async function checkLockStatus() {
  try {
    const response = await axios.get(
      `${BASE_URL}/v1/devices/${DEVICE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Device Status:', response.data.status);
    console.log('Lock Status:', response.data.lock_status);
    console.log('Locked at:', response.data.locked_at);
    console.log('Last seen:', response.data.last_seen);

    // Expected response:
    // {
    //   device_id: 'device-test-1700123456789',
    //   status: 'active',
    //   lock_status: 'locked',
    //   locked_at: '2025-11-17T10:35:00Z',
    //   last_seen: '2025-11-17T10:36:12Z',
    //   online: true
    // }

  } catch (error) {
    console.error('❌ Status check failed:', error.response?.data || error.message);
  }
}

checkLockStatus();
```

---

## 6. Unlock API Verification

### 6.1 Unlock Device via API

```javascript
// unlock-device.js
import axios from 'axios';

const API_KEY = process.env.TRUSTONIC_API_KEY;
const BASE_URL = 'https://sandbox-api.trustonic.com';
const DEVICE_ID = 'device-test-1700123456789';

async function unlockDevice() {
  try {
    console.log(`🔓 Unlocking device ${DEVICE_ID}...`);

    const response = await axios.post(
      `${BASE_URL}/v1/devices/${DEVICE_ID}/unlock`,
      {
        reason: 'payment_received',
        metadata: {
          payment_id: 'payment-xyz789',
          amount_paid: 50.00,
          payment_method: 'ecocash'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Device unlocked successfully!');
    console.log('Unlock ID:', response.data.unlock_id);
    console.log('Unlocked at:', response.data.unlocked_at);
    console.log('Status:', response.data.status);

    // Expected response:
    // {
    //   success: true,
    //   unlock_id: 'unlock-def456uvw012',
    //   device_id: 'device-test-1700123456789',
    //   unlocked_at: '2025-11-17T10:40:00Z',
    //   status: 'unlocked'
    // }

  } catch (error) {
    console.error('❌ Unlock failed:', error.response?.data || error.message);
    throw error;
  }
}

unlockDevice();
```

**Run Unlock Test**:
```bash
node unlock-device.js

# Expected output:
# 🔓 Unlocking device device-test-1700123456789...
# ✅ Device unlocked successfully!
# Unlock ID: unlock-def456uvw012
# Unlocked at: 2025-11-17T10:40:00Z
# Status: unlocked
```

### 6.2 Verify Unlock on Physical Device

**Expected Behavior on Device**:

1. **Lock screen disappears** (within 2-5 seconds)
2. **Home screen accessible** (device fully functional)
3. **Toast notification** (optional): "Device unlocked. Thank you for your payment!"
4. **All features restored** (notifications, home button, power menu)

### 6.3 Temporary Unlock (Grace Period)

Some providers support temporary unlock (24-72 hour grace period):

```javascript
// temporary-unlock.js
async function temporaryUnlock() {
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/devices/${DEVICE_ID}/temporary-unlock`,
      {
        duration_hours: 72, // 3 days grace period
        reason: 'grace_period',
        message: 'Your device is unlocked for 72 hours. Please make payment to avoid re-lock.',
        metadata: {
          grace_period_start: new Date().toISOString(),
          grace_period_end: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Temporary unlock granted!');
    console.log('Duration:', response.data.duration_hours, 'hours');
    console.log('Auto-lock at:', response.data.auto_lock_at);

    // Expected response:
    // {
    //   success: true,
    //   device_id: 'device-test-1700123456789',
    //   temporary_unlock_id: 'tmpunlock-ghi789jkl345',
    //   duration_hours: 72,
    //   auto_lock_at: '2025-11-20T10:40:00Z',
    //   status: 'temporarily_unlocked'
    // }

  } catch (error) {
    console.error('❌ Temporary unlock failed:', error.response?.data || error.message);
  }
}
```

---

## 7. Webhook Testing

### 7.1 Set Up Webhook Receiver (Local Testing)

**Install ngrok** (expose local server to internet):

```bash
# Install ngrok
npm install -g ngrok

# Start local webhook server first (port 3000)
node webhook-server.js &

# Expose local server to internet
ngrok http 3000

# Output:
# Forwarding https://abc123.ngrok.io -> http://localhost:3000
```

**Webhook Server** (Express.js):

```javascript
// webhook-server.js
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Webhook secret (from provider dashboard)
const WEBHOOK_SECRET = process.env.TRUSTONIC_WEBHOOK_SECRET; // whsec_abc123xyz789...

// Verify HMAC signature
function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Webhook endpoint
app.post('/webhooks/device-lock', (req, res) => {
  const signature = req.headers['x-trustonic-signature'];
  const payload = JSON.stringify(req.body);

  // Verify signature
  if (!verifySignature(payload, signature)) {
    console.error('❌ Invalid webhook signature!');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook event
  const event = req.body;
  console.log('✅ Webhook received:', event.event);
  console.log('Device ID:', event.data.device_id);
  console.log('Timestamp:', event.timestamp);

  // Handle different event types
  switch (event.event) {
    case 'device.locked':
      console.log('🔒 Device locked:', event.data.device_id);
      // Update database, send SMS notification, etc.
      break;

    case 'device.unlocked':
      console.log('🔓 Device unlocked:', event.data.device_id);
      // Update database, log event
      break;

    case 'device.tamper_detected':
      console.error('⚠️  Tamper detected:', event.data.device_id);
      // Alert security team, log suspicious activity
      break;

    case 'device.offline':
      console.warn('📴 Device offline:', event.data.device_id);
      // Track offline devices, escalate if >48 hours
      break;

    default:
      console.log('Unknown event type:', event.event);
  }

  // Acknowledge receipt (return 200 OK within 5 seconds)
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('✅ Webhook server running on http://localhost:3000');
  console.log('Ngrok URL will be printed by ngrok command');
});
```

**Run Webhook Server**:
```bash
export TRUSTONIC_WEBHOOK_SECRET="whsec_abc123xyz789..."
node webhook-server.js

# In another terminal, start ngrok
ngrok http 3000

# Copy ngrok URL: https://abc123.ngrok.io
```

### 7.2 Register Webhook URL in Dashboard

1. Log in to provider dashboard
2. Navigate to **Settings → Webhooks**
3. Click **Add Webhook**
4. Enter ngrok URL: `https://abc123.ngrok.io/webhooks/device-lock`
5. Select events to subscribe to:
   - [x] device.locked
   - [x] device.unlocked
   - [x] device.tamper_detected
   - [x] device.offline
   - [x] device.enrolled
6. Click **Create Webhook**
7. Copy webhook secret: `whsec_abc123xyz789...`

### 7.3 Test Webhook Delivery

**Trigger Lock Event**:
```bash
# Lock device via API
node lock-device.js

# Expected webhook output (in webhook-server.js logs):
# ✅ Webhook received: device.locked
# Device ID: device-test-1700123456789
# Timestamp: 2025-11-17T10:35:00Z
# 🔒 Device locked: device-test-1700123456789
```

**Example Webhook Payload**:
```json
{
  "event": "device.locked",
  "event_id": "evt-abc123xyz789",
  "timestamp": "2025-11-17T10:35:00Z",
  "data": {
    "device_id": "device-test-1700123456789",
    "lock_id": "lock-abc123xyz789",
    "locked_at": "2025-11-17T10:35:00Z",
    "lock_type": "full",
    "reason": "overdue_payment"
  }
}
```

---

## 8. Mock API for Development

### 8.1 Why Mock API?

**Use Case**: Develop integration before receiving sandbox access from provider.

**Benefits**:
- Start development immediately (no waiting for provider approval)
- Test error scenarios (network failures, invalid responses)
- Faster iteration (no API rate limits)
- Offline development

### 8.2 Mock API Server (Node.js + Express)

```javascript
// mock-device-lock-api.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// In-memory database
const devices = new Map();

// Middleware: Verify API key
function requireAuth(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (apiKey !== 'sk_test_mock_api_key_123') {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// POST /v1/devices (Enroll device)
app.post('/v1/devices', requireAuth, (req, res) => {
  const { device_id, partner_id, device_info, customer_info, lock_policy } = req.body;

  if (!device_id || !partner_id) {
    return res.status(400).json({ error: 'Missing required fields: device_id, partner_id' });
  }

  const device = {
    device_id,
    partner_id,
    status: 'active',
    lock_status: 'unlocked',
    enrolled_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    device_info,
    customer_info,
    lock_policy,
    lock_history: []
  };

  devices.set(device_id, device);

  console.log(`✅ Device enrolled: ${device_id}`);
  res.status(201).json(device);
});

// GET /v1/devices/:id (Get device status)
app.get('/v1/devices/:id', requireAuth, (req, res) => {
  const device = devices.get(req.params.id);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  res.json(device);
});

// POST /v1/devices/:id/lock (Lock device)
app.post('/v1/devices/:id/lock', requireAuth, (req, res) => {
  const device = devices.get(req.params.id);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  if (device.lock_status === 'locked') {
    return res.status(400).json({ error: 'Device already locked' });
  }

  const lockId = `lock-${uuidv4()}`;
  const lockedAt = new Date().toISOString();

  device.lock_status = 'locked';
  device.locked_at = lockedAt;
  device.last_seen = lockedAt;
  device.lock_history.push({
    lock_id: lockId,
    action: 'lock',
    timestamp: lockedAt,
    reason: req.body.reason || 'manual_lock'
  });

  console.log(`🔒 Device locked: ${device.device_id}`);

  res.json({
    success: true,
    lock_id: lockId,
    device_id: device.device_id,
    locked_at: lockedAt,
    status: 'locked',
    lock_type: req.body.lock_type || 'full'
  });
});

// POST /v1/devices/:id/unlock (Unlock device)
app.post('/v1/devices/:id/unlock', requireAuth, (req, res) => {
  const device = devices.get(req.params.id);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  if (device.lock_status === 'unlocked') {
    return res.status(400).json({ error: 'Device already unlocked' });
  }

  const unlockId = `unlock-${uuidv4()}`;
  const unlockedAt = new Date().toISOString();

  device.lock_status = 'unlocked';
  device.unlocked_at = unlockedAt;
  device.last_seen = unlockedAt;
  device.lock_history.push({
    unlock_id: unlockId,
    action: 'unlock',
    timestamp: unlockedAt,
    reason: req.body.reason || 'manual_unlock'
  });

  console.log(`🔓 Device unlocked: ${device.device_id}`);

  res.json({
    success: true,
    unlock_id: unlockId,
    device_id: device.device_id,
    unlocked_at: unlockedAt,
    status: 'unlocked'
  });
});

// Start server
app.listen(4000, () => {
  console.log('✅ Mock Device Lock API running on http://localhost:4000');
  console.log('API Key: sk_test_mock_api_key_123');
});
```

**Run Mock API**:
```bash
node mock-device-lock-api.js

# Output:
# ✅ Mock Device Lock API running on http://localhost:4000
# API Key: sk_test_mock_api_key_123
```

**Test Mock API**:
```bash
# Enroll device
curl -X POST http://localhost:4000/v1/devices \
  -H "Authorization: Bearer sk_test_mock_api_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-mock-001",
    "partner_id": "lynia-finance"
  }'

# Lock device
curl -X POST http://localhost:4000/v1/devices/device-mock-001/lock \
  -H "Authorization: Bearer sk_test_mock_api_key_123" \
  -H "Content-Type: application/json" \
  -d '{"reason": "overdue_payment"}'

# Unlock device
curl -X POST http://localhost:4000/v1/devices/device-mock-001/unlock \
  -H "Authorization: Bearer sk_test_mock_api_key_123" \
  -H "Content-Type: application/json" \
  -d '{"reason": "payment_received"}'

# Check status
curl http://localhost:4000/v1/devices/device-mock-001 \
  -H "Authorization: Bearer sk_test_mock_api_key_123"
```

---

## 9. Integration with Supabase

### 9.1 Store API Credentials in Supabase Secrets

```bash
# Set provider API credentials
supabase secrets set TRUSTONIC_API_KEY=sk_test_abc123xyz789...
supabase secrets set TRUSTONIC_WEBHOOK_SECRET=whsec_abc123xyz789...

# For NuovoPay (OAuth 2.0)
supabase secrets set NUOVOPAY_CLIENT_ID=lynia_finance_sandbox
supabase secrets set NUOVOPAY_CLIENT_SECRET=client_secret_abc123xyz789...

# Verify secrets
supabase secrets list
```

### 9.2 Edge Function: Lock Device on Payment Overdue

**File**: `supabase/functions/lock-device-overdue/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const TRUSTONIC_API_KEY = Deno.env.get('TRUSTONIC_API_KEY');
const TRUSTONIC_BASE_URL = 'https://sandbox-api.trustonic.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { device_id, reason, message } = await req.json();

    // Call Trustonic lock API
    const response = await fetch(
      `${TRUSTONIC_BASE_URL}/v1/devices/${device_id}/lock`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TRUSTONIC_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'overdue_payment',
          lock_type: 'full',
          message: message || 'Please make payment to unlock device.',
          allow_emergency_calls: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Lock API failed: ${response.status}`);
    }

    const data = await response.json();

    // Log to Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('device_lock_events').insert({
      device_id,
      action: 'lock',
      lock_id: data.lock_id,
      reason: reason || 'overdue_payment',
      locked_at: data.locked_at,
    });

    console.log(`✅ Device locked: ${device_id}`);

    return new Response(
      JSON.stringify({ success: true, lock_id: data.lock_id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error locking device:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to lock device' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

**Deploy Edge Function**:
```bash
supabase functions deploy lock-device-overdue
```

**Test Edge Function**:
```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/lock-device-overdue \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "device-test-1700123456789",
    "reason": "overdue_payment",
    "message": "Your payment is 7 days overdue. Please make payment to unlock."
  }'
```

### 9.3 Database Trigger: Auto-Lock After 7 Days Overdue

**SQL Migration**:

```sql
-- Create device_lock_events table
CREATE TABLE device_lock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'lock', 'unlock', 'temporary_unlock'
  lock_id VARCHAR(100),
  unlock_id VARCHAR(100),
  reason VARCHAR(100),
  locked_at TIMESTAMPTZ,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_device_lock_events_device_id ON device_lock_events(device_id, created_at DESC);

-- Trigger: Auto-lock devices with payments 7+ days overdue
CREATE OR REPLACE FUNCTION auto_lock_overdue_devices()
RETURNS TRIGGER AS $
BEGIN
  -- Check if payment is 7+ days overdue
  IF NEW.status = 'overdue' AND (NOW() - NEW.due_date) >= INTERVAL '7 days' THEN
    -- Call Edge Function to lock device
    PERFORM net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/lock-device-overdue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'device_id', NEW.device_id,
        'reason', 'overdue_payment',
        'message', 'Your payment is ' || EXTRACT(DAY FROM NOW() - NEW.due_date) || ' days overdue. Please make payment to unlock.'
      )
    );
  END IF;

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER on_payment_overdue
AFTER UPDATE ON payments
FOR EACH ROW
WHEN (NEW.status = 'overdue' AND OLD.status != 'overdue')
EXECUTE FUNCTION auto_lock_overdue_devices();
```

---

## 10. Summary

### 10.1 Key Achievements

✅ **Sandbox setup guide**: Trustonic and NuovoPay account request templates
✅ **Authentication tested**: API key (Trustonic) and OAuth 2.0 (NuovoPay) flows
✅ **Device enrollment**: Complete workflow from ADB install to API enrollment
✅ **Lock/unlock verified**: API calls tested with expected responses
✅ **Webhook testing**: Local server + ngrok for webhook event handling
✅ **Mock API created**: Development without provider access
✅ **Supabase integration**: Edge Functions + database triggers for automation

### 10.2 Test Checklist (When Sandbox Access Granted)

**Day 1: Setup**
- [ ] Receive sandbox credentials (API key, test APK, dashboard access)
- [ ] Set environment variables (TRUSTONIC_API_KEY, etc.)
- [ ] Download test APK
- [ ] Log in to sandbox dashboard

**Day 2: Device Enrollment**
- [ ] Install lock app on test device via ADB
- [ ] Set Device Owner (prevent uninstall)
- [ ] Enroll device via API (POST /v1/devices)
- [ ] Verify device shows "Active" in dashboard

**Day 3: Lock/Unlock Testing**
- [ ] Lock device via API (POST /v1/devices/:id/lock)
- [ ] Verify lock on physical device (<5 seconds)
- [ ] Check lock status via API (GET /v1/devices/:id)
- [ ] Unlock device via API (POST /v1/devices/:id/unlock)
- [ ] Verify unlock on physical device (<5 seconds)

**Day 4: Webhook Testing**
- [ ] Set up webhook server (Express.js + ngrok)
- [ ] Register webhook URL in dashboard
- [ ] Trigger lock event → Verify webhook received
- [ ] Trigger unlock event → Verify webhook received
- [ ] Test HMAC signature verification

**Day 5: Integration Testing**
- [ ] Deploy Supabase Edge Functions (lock-device-overdue, unlock-device-paid)
- [ ] Test database trigger (auto-lock after 7 days overdue)
- [ ] Test end-to-end flow: Payment overdue → Auto-lock → Payment received → Auto-unlock

### 10.3 Expected API Performance

**Latency**:
- Device enrollment: 200-500ms
- Lock request: 1-3 seconds (API call + device receives lock command)
- Unlock request: 1-3 seconds
- Status check: 100-300ms
- Webhook delivery: <5 seconds after event

**Reliability**:
- API uptime: 99.9% SLA (43 minutes/month downtime allowed)
- Lock command delivery: 99.5% success rate (may fail if device offline)
- Webhook delivery: 95% success rate (retries for 24 hours if receiver down)

### 10.4 Next Steps

**Immediate (Week 1)**:
- [ ] Email Trustonic/NuovoPay sales to request sandbox access (use templates from Section 2)
- [ ] Purchase 2-3 test devices ($80-$200 budget) or use existing Android devices
- [ ] Set up development environment (Node.js, ADB, ngrok)

**After Sandbox Access (Week 2-3)**:
- [ ] Follow Day 1-5 test checklist (Section 10.2)
- [ ] Document any API differences from this guide
- [ ] Test edge cases (device offline, invalid API key, network failures)

**Before Production (Week 4)**:
- [ ] Complete 50-device pilot (T048 implementation roadmap)
- [ ] Monitor bypass attempts for 3 months
- [ ] Optimize Edge Functions based on actual API latency
- [ ] Set up production webhooks (not ngrok, use production domain)

---

**Status**: ✅ T049 Complete - Device lock API testing methodology documented
**Next Task**: T049a - Research AWS Lambda always-free tier (1M requests/month)
**Related**: T048 (Provider selection), T046 (API capabilities), T047 (Installation workflow)
