# Lynia Finance - Authentication & Authorization Design

**Document:** P1-T004 Deliverable
**Version:** 1.0
**Date:** November 24, 2025
**Status:** Phase 1 - Security Design

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [JWT Token Structure](#jwt-token-structure)
4. [Supabase Auth Integration](#supabase-auth-integration)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [API Key Management](#api-key-management)
7. [Session Management](#session-management)
8. [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
9. [Security Best Practices](#security-best-practices)
10. [Threat Model & Mitigations](#threat-model--mitigations)

---

## Overview

### Security Principles

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Minimal access by default
3. **Zero Trust**: Always verify, never assume
4. **Audit Everything**: Complete activity logging
5. **Fail Secure**: Deny access on error

### Authentication Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Methods                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │    Customers     │  │   Distributors   │  │    Admins     │ │
│  │                  │  │                  │  │               │ │
│  │  WhatsApp OTP    │  │  Email/Password  │  │Email/Password │ │
│  │  (Phone Auth)    │  │  + Optional MFA  │  │  + MFA (TOTP) │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │          │
│           └─────────────────────┴─────────────────────┘          │
│                                 │                                 │
│                                 ▼                                 │
│                      ┌──────────────────┐                        │
│                      │  Supabase Auth   │                        │
│                      │  (PostgreSQL)    │                        │
│                      └────────┬─────────┘                        │
│                               │                                   │
│                               ▼                                   │
│                      ┌──────────────────┐                        │
│                      │   JWT Token      │                        │
│                      │  (Access Token)  │                        │
│                      └──────────────────┘                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Methods

### 1. Customer Authentication (WhatsApp OTP)

**Use Case**: Customer login via WhatsApp
**Method**: Phone number + OTP
**Provider**: Supabase Auth (Phone Auth)

#### Flow:

```
Customer                WhatsApp Bot         Supabase Auth        Database
   │                         │                     │                 │
   │ 1. Send "Hi"           │                     │                 │
   ├────────────────────────>│                     │                 │
   │                         │                     │                 │
   │                         │ 2. Check if exists  │                 │
   │                         ├─────────────────────┼────────────────>│
   │                         │                     │  3. User found  │
   │                         │<────────────────────┼─────────────────┤
   │                         │                     │                 │
   │                         │ 4. Request OTP      │                 │
   │                         ├────────────────────>│                 │
   │                         │  5. Generate OTP    │                 │
   │                         │<────────────────────┤                 │
   │                         │                     │                 │
   │ 6. "Enter OTP: XXXXXX" │                     │                 │
   │<────────────────────────┤                     │                 │
   │                         │                     │                 │
   │ 7. Enter: "123456"     │                     │                 │
   ├────────────────────────>│                     │                 │
   │                         │ 8. Verify OTP       │                 │
   │                         ├────────────────────>│                 │
   │                         │  9. OTP Valid ✓     │                 │
   │                         │<────────────────────┤                 │
   │                         │ 10. Create session  │                 │
   │                         ├─────────────────────┼────────────────>│
   │                         │                     │                 │
   │ 11. "Logged in! 🎉"    │                     │                 │
   │<────────────────────────┤                     │                 │
   │                         │                     │                 │
```

#### Implementation:

```javascript
// Customer authentication via OTP
async function authenticateCustomer(phoneNumber) {
  // 1. Request OTP
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phoneNumber,
    options: {
      channel: 'sms', // or 'whatsapp'
    }
  });

  if (error) throw error;

  // 2. Store session_id for OTP verification
  return data.session_id;
}

// Verify OTP
async function verifyOTP(phoneNumber, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneNumber,
    token: token,
    type: 'sms'
  });

  if (error) throw error;

  // Returns JWT access token and refresh token
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in
  };
}
```

---

### 2. Distributor Authentication (Email + Password)

**Use Case**: Distributor login to dashboard
**Method**: Email/Password + Optional MFA
**Provider**: Supabase Auth

#### Flow:

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "distributor@example.com",
  "password": "SecurePassword123!"
}

Response (No MFA):
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh_token_xyz",
  "user": {
    "id": "uuid",
    "email": "distributor@example.com",
    "role": "distributor"
  }
}

Response (MFA Enabled):
{
  "mfa_required": true,
  "mfa_token": "temp_token_xyz",
  "mfa_methods": ["totp", "sms"]
}

POST /v1/auth/verify-mfa
{
  "mfa_token": "temp_token_xyz",
  "mfa_code": "123456",
  "method": "totp"
}

Response:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh_token_xyz"
}
```

---

### 3. Admin Authentication (Email + Password + MFA Required)

**Use Case**: Admin login to portal
**Method**: Email/Password + TOTP MFA (Mandatory)
**Provider**: Supabase Auth + Custom MFA

#### Requirements:

- ✅ Strong password (12+ chars, uppercase, lowercase, number, symbol)
- ✅ TOTP MFA required (Google Authenticator, Authy)
- ✅ Session timeout: 1 day (admins must re-auth daily)
- ✅ IP whitelist (optional for super_admin)

---

### 4. Service-to-Service Authentication (API Keys)

**Use Case**: Internal microservice communication
**Method**: API Key in header
**Storage**: Environment variables (AWS Secrets Manager)

```http
GET /v1/scoring/evaluate
X-API-Key: sk_live_abc123xyz...
Content-Type: application/json
```

---

## JWT Token Structure

### Access Token Claims

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "aud": "authenticated",
  "role": "customer",
  "email": null,
  "phone": "+263771234567",
  "app_metadata": {
    "provider": "phone",
    "customer_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "user_metadata": {
    "name": "John Doe",
    "kyc_status": "approved",
    "credit_tier": 2
  },
  "iat": 1700000000,
  "exp": 1700086400,
  "iss": "https://your-project.supabase.co/auth/v1",
  "custom_claims": {
    "credit_limit": 350,
    "active_loans": 1,
    "can_apply_loan": false
  }
}
```

### Token Types

| Token Type | Purpose | Expiry | Storage |
|------------|---------|--------|---------|
| **Access Token** | API authentication | 1 hour (customers/distributors), 1 day (admins) | Memory (never localStorage) |
| **Refresh Token** | Renew access token | 30 days | HttpOnly cookie (secure) |
| **MFA Token** | Temporary MFA verification | 5 minutes | Memory only |
| **API Key** | Service-to-service | Never (rotatable) | AWS Secrets Manager |

### Custom Claims

Custom claims added based on user role:

```javascript
// Customer claims
{
  credit_limit: 350,
  credit_tier: 2,
  kyc_status: "approved",
  active_loans: 1,
  can_apply_loan: false
}

// Distributor claims
{
  distributor_id: "uuid",
  province: "Harare",
  commission_rate: 5.0,
  status: "active"
}

// Admin claims
{
  admin_role: "operations_manager",
  permissions: ["loans:approve", "customers:view", "payments:reconcile"],
  mfa_verified: true
}
```

---

## Supabase Auth Integration

### Setup

```javascript
// supabase/config.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: customSecureStorage, // HttpOnly cookies for web
  }
});
```

### Authentication Hooks

```javascript
// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in:', session.user);
      // Update user context
      updateUserContext(session.user);
      break;

    case 'SIGNED_OUT':
      console.log('User signed out');
      // Clear user context
      clearUserContext();
      break;

    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      break;

    case 'USER_UPDATED':
      console.log('User updated');
      break;
  }
});
```

### RLS (Row Level Security) Integration

Supabase RLS policies use JWT claims:

```sql
-- Customers can only see their own data
CREATE POLICY customers_select_own ON customers
  FOR SELECT
  USING (
    auth.uid() = id
  );

-- Distributors can see their assigned loans
CREATE POLICY loans_select_distributor ON loans
  FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors
      WHERE user_id = auth.uid()
    )
  );

-- Admins can see everything
CREATE POLICY customers_select_admin ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );
```

---

## Role-Based Access Control (RBAC)

### User Roles

| Role | Description | Authentication | MFA Required |
|------|-------------|----------------|--------------|
| **Customer** | End users applying for loans | Phone OTP | No |
| **Distributor** | Agents distributing devices | Email/Password | Optional |
| **Admin (Customer Support)** | View-only + messaging | Email/Password | Yes |
| **Admin (Operations Manager)** | Loan approval, reconciliation | Email/Password | Yes |
| **Admin (Finance Team)** | Reports, financial data | Email/Password | Yes |
| **Admin (Super Admin)** | Full system access | Email/Password | Yes |
| **System** | Internal services | API Key | N/A |

### Permission Matrix

| Resource | Customer | Distributor | CS Agent | Ops Manager | Finance | Super Admin |
|----------|----------|-------------|----------|-------------|---------|-------------|
| **Customers** |
| View own profile | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| View all profiles | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Update any profile | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Loans** |
| Apply for loan | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own loans | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View assigned loans | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve/reject loans | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Disburse loans | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Payments** |
| Make payment | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View payment history | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Reconcile payments | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Issue refunds | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Devices** |
| Browse devices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage inventory | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Lock/unlock devices | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Reports** |
| View own reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Export reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Admin** |
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| System config | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

### Permission Implementation

```javascript
// Define permissions
const PERMISSIONS = {
  // Customer permissions
  'customers:view_own': ['customer'],
  'customers:update_own': ['customer'],
  'loans:create': ['customer'],
  'loans:view_own': ['customer'],
  'payments:create': ['customer'],

  // Distributor permissions
  'devices:browse': ['customer', 'distributor', 'admin'],
  'devices:manage': ['distributor', 'admin'],
  'loans:disburse': ['distributor', 'admin'],

  // Admin permissions
  'customers:view_all': ['admin'],
  'loans:approve': ['admin'],
  'loans:reject': ['admin'],
  'payments:reconcile': ['admin'],
  'reports:view': ['admin'],
  'reports:export': ['admin'],

  // Super admin only
  'users:manage': ['super_admin'],
  'system:config': ['super_admin'],
  'audit:view': ['super_admin'],
};

// Check permission
function hasPermission(user, permission) {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles && allowedRoles.includes(user.role);
}

// Middleware example
function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }
    next();
  };
}

// Usage
app.post('/loans/:id/approve',
  requireAuth,
  requirePermission('loans:approve'),
  approveLoan
);
```

---

## API Key Management

### API Key Structure

```
sk_live_abc123xyz789...      (Production)
sk_test_abc123xyz789...      (Testing)
sk_dev_abc123xyz789...       (Development)
```

**Format**: `{prefix}_{environment}_{random_32_chars}`

### API Key Storage

```javascript
// AWS Secrets Manager
{
  "lynia-finance/api-keys/production": {
    "whatsapp_service": "sk_live_whatsapp_xyz...",
    "kyc_service": "sk_live_kyc_abc...",
    "payment_service": "sk_live_payment_def...",
    "scoring_service": "sk_live_scoring_ghi...",
    "device_lock_service": "sk_live_devicelock_jkl...",
    "notification_service": "sk_live_notify_mno..."
  }
}
```

### API Key Validation

```javascript
// Validate API key middleware
async function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key required'
      }
    });
  }

  // Verify API key (check against Secrets Manager or database)
  const isValid = await verifyApiKey(apiKey);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key'
      }
    });
  }

  // Attach service identity to request
  req.service = getServiceFromApiKey(apiKey);
  next();
}
```

### API Key Rotation

- **Rotation Schedule**: Every 90 days
- **Process**:
  1. Generate new key
  2. Update environment variables
  3. Deploy services with new key
  4. Revoke old key after 7-day grace period

---

## Session Management

### Session Storage

**WhatsApp Sessions (Customers)**:
```javascript
// sessions table
{
  id: "uuid",
  phone_number: "+263771234567",
  customer_id: "uuid",
  state: "browsing",  // idle, onboarding, kyc, browsing, applying, payment
  context: {
    selected_device_id: "uuid",
    loan_draft_id: "uuid",
    last_action: "view_device"
  },
  expires_at: "2025-12-24T12:00:00Z",  // 30 days
  active: true
}
```

**Web Sessions (Distributors/Admins)**:
- Stored in Supabase Auth
- HttpOnly cookies (secure, SameSite=strict)
- Refresh token rotation on use

### Session Timeout

| User Type | Idle Timeout | Absolute Timeout |
|-----------|--------------|------------------|
| Customer (WhatsApp) | 30 minutes | 30 days |
| Distributor (Web) | 30 minutes | 7 days |
| Admin (Web) | 15 minutes | 1 day |

### Concurrent Sessions

**Policy**:
- **Customers**: Unlimited (WhatsApp multi-device)
- **Distributors**: Up to 3 concurrent sessions
- **Admins**: 1 session only (enforce single sign-on)

---

## Multi-Factor Authentication (MFA)

### MFA Methods

| Method | User Type | Required | Implementation |
|--------|-----------|----------|----------------|
| **TOTP** | Admin | ✅ Yes | Google Authenticator, Authy |
| **SMS** | Distributor | Optional | Twilio SMS OTP |
| **Email** | Distributor | Optional | Email OTP |
| **WhatsApp** | Customer | ✅ Yes (via OTP) | Built-in phone auth |

### TOTP Setup Flow

```
Admin User          Admin Portal         Supabase Auth        Database
   │                     │                     │                 │
   │ 1. Enable MFA      │                     │                 │
   ├────────────────────>│                     │                 │
   │                     │ 2. Generate secret  │                 │
   │                     ├────────────────────>│                 │
   │                     │  3. QR code + secret│                 │
   │                     │<────────────────────┤                 │
   │                     │                     │                 │
   │ 4. Display QR code │                     │                 │
   │<────────────────────┤                     │                 │
   │                     │                     │                 │
   │ 5. Scan QR code    │                     │                 │
   │   (Google Auth)    │                     │                 │
   │                     │                     │                 │
   │ 6. Enter code      │                     │                 │
   ├────────────────────>│                     │                 │
   │                     │ 7. Verify code      │                 │
   │                     ├────────────────────>│                 │
   │                     │  8. Verified ✓      │                 │
   │                     │<────────────────────┤                 │
   │                     │ 9. Save MFA enabled │                 │
   │                     ├─────────────────────┼────────────────>│
   │                     │                     │                 │
   │ 10. "MFA enabled!" │                     │                 │
   │<────────────────────┤                     │                 │
```

### TOTP Implementation

```javascript
import * as OTPAuth from 'otpauth';

// Generate TOTP secret
function generateTOTPSecret(userEmail) {
  const totp = new OTPAuth.TOTP({
    issuer: 'Lynia Finance',
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(generateRandomBase32())
  });

  return {
    secret: totp.secret.base32,
    qr_code: totp.toString(), // otpauth:// URL for QR code
    uri: totp.toString()
  };
}

// Verify TOTP code
function verifyTOTPCode(secret, code) {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret)
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null; // Returns true if valid
}
```

---

## Security Best Practices

### 1. Password Requirements

**Minimum Requirements**:
- Length: 12+ characters
- Uppercase: At least 1
- Lowercase: At least 1
- Number: At least 1
- Special character: At least 1

**Validation**:
```javascript
function validatePassword(password) {
  const minLength = 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial
  );
}
```

**Password Hashing**: Bcrypt (Supabase default, 10 rounds)

---

### 2. Rate Limiting (Authentication Endpoints)

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/auth/login` | 5 attempts | Per IP, 15 min |
| `/auth/signup` | 3 attempts | Per IP, 1 hour |
| `/auth/otp/request` | 5 attempts | Per phone, 1 hour |
| `/auth/otp/verify` | 5 attempts | Per phone, 15 min |
| `/auth/password-reset` | 3 attempts | Per email, 1 hour |
| `/auth/mfa/verify` | 5 attempts | Per user, 15 min |

**Lockout**: After max attempts, lockout for 1 hour

---

### 3. Token Security

**Storage Rules**:
- ✅ **Access Token**: Memory only (never localStorage)
- ✅ **Refresh Token**: HttpOnly cookie (secure, SameSite=strict)
- ❌ **Never**: localStorage (vulnerable to XSS)

**Transmission**:
- ✅ Always use HTTPS (TLS 1.3)
- ✅ Include tokens in `Authorization` header
- ❌ Never in URL query params

---

### 4. CSRF Protection

```javascript
// Generate CSRF token
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Verify CSRF token
function verifyCSRFToken(req, res, next) {
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.session.csrfToken;

  if (!token || token !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Invalid CSRF token'
      }
    });
  }

  next();
}
```

---

### 5. IP Whitelisting (Optional for Admins)

```javascript
// IP whitelist for super admins
const ADMIN_IP_WHITELIST = [
  '1.2.3.4',      // Office IP
  '5.6.7.8',      // VPN IP
];

function checkIPWhitelist(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;

  if (req.user.role === 'super_admin' && !ADMIN_IP_WHITELIST.includes(clientIP)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'IP_NOT_WHITELISTED',
        message: 'Access denied from this IP address'
      }
    });
  }

  next();
}
```

---

### 6. Audit Logging

All authentication events must be logged:

```javascript
// Log authentication event
async function logAuthEvent(event, userId, metadata) {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: event,
    table_name: 'auth',
    ip_address: metadata.ip,
    user_agent: metadata.user_agent,
    severity: getSeverity(event),
    description: getDescription(event),
    created_at: new Date()
  });
}

// Events to log
const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  PASSWORD_CHANGED: 'password_changed',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  TOKEN_REFRESHED: 'token_refreshed',
  SESSION_EXPIRED: 'session_expired',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
};
```

---

## Threat Model & Mitigations

### Threat 1: Credential Stuffing

**Risk**: Attackers use leaked credentials from other sites
**Likelihood**: High
**Impact**: High

**Mitigations**:
- ✅ Rate limiting on login (5 attempts per 15 min)
- ✅ CAPTCHA after 3 failed attempts
- ✅ Account lockout after 5 failed attempts
- ✅ MFA for admins (required)
- ✅ Monitor for unusual login patterns

---

### Threat 2: Session Hijacking

**Risk**: Attacker steals session token
**Likelihood**: Medium
**Impact**: High

**Mitigations**:
- ✅ HTTPS only (TLS 1.3)
- ✅ HttpOnly, Secure, SameSite=strict cookies
- ✅ Short token expiry (1 hour)
- ✅ Refresh token rotation
- ✅ IP address validation (optional)
- ✅ User-Agent validation

---

### Threat 3: Brute Force Attacks

**Risk**: Attacker tries to guess passwords/OTPs
**Likelihood**: High
**Impact**: Medium

**Mitigations**:
- ✅ Strong password requirements
- ✅ Rate limiting (5 attempts per 15 min)
- ✅ Account lockout
- ✅ CAPTCHA
- ✅ Alert on suspicious activity

---

### Threat 4: Man-in-the-Middle (MITM)

**Risk**: Attacker intercepts communication
**Likelihood**: Low
**Impact**: Critical

**Mitigations**:
- ✅ HTTPS everywhere (TLS 1.3)
- ✅ HSTS headers (strict-transport-security)
- ✅ Certificate pinning (mobile apps)
- ✅ No mixed content

---

### Threat 5: XSS (Cross-Site Scripting)

**Risk**: Attacker injects malicious scripts
**Likelihood**: Medium
**Impact**: High

**Mitigations**:
- ✅ Content Security Policy (CSP) headers
- ✅ Input sanitization (DOMPurify)
- ✅ Output encoding
- ✅ HttpOnly cookies (tokens not accessible via JS)
- ✅ Never use `innerHTML` with user input

---

### Threat 6: Privilege Escalation

**Risk**: User gains unauthorized access
**Likelihood**: Low
**Impact**: Critical

**Mitigations**:
- ✅ Row Level Security (RLS) in database
- ✅ Permission checks on every API call
- ✅ Least privilege by default
- ✅ Audit all permission changes
- ✅ Regular permission audits

---

## Security Checklist

### Development Phase
- [ ] Environment variables stored in AWS Secrets Manager
- [ ] No hardcoded credentials in code
- [ ] All API keys rotatable
- [ ] RLS policies tested for all tables
- [ ] Permission matrix implemented
- [ ] Rate limiting on all endpoints
- [ ] CSRF protection on state-changing endpoints

### Pre-Production
- [ ] Security audit completed
- [ ] Penetration testing done
- [ ] All dependencies updated
- [ ] SSL/TLS certificates valid
- [ ] Backup and recovery tested
- [ ] Incident response plan documented

### Production
- [ ] HTTPS enforced (HSTS enabled)
- [ ] MFA required for all admins
- [ ] Audit logs enabled
- [ ] Monitoring and alerts configured
- [ ] Regular security reviews scheduled
- [ ] Bug bounty program (future)

---

## Summary

### Authentication Methods (4 Total)

1. ✅ **Customer**: Phone OTP (WhatsApp)
2. ✅ **Distributor**: Email/Password + Optional MFA
3. ✅ **Admin**: Email/Password + MFA Required
4. ✅ **System**: API Key

### User Roles (7 Total)

1. Customer
2. Distributor
3. Admin (Customer Support)
4. Admin (Operations Manager)
5. Admin (Finance Team)
6. Admin (Super Admin)
7. System

### Security Features

- ✅ JWT tokens (1 hour - 30 days expiry)
- ✅ Refresh token rotation
- ✅ TOTP MFA for admins
- ✅ Row Level Security (RLS)
- ✅ API key rotation (90 days)
- ✅ Rate limiting (5-1000 req/min)
- ✅ Audit logging (all auth events)
- ✅ HTTPS only (TLS 1.3)
- ✅ CSRF protection
- ✅ IP whitelisting (optional)

---

**Document Status:** ✅ Complete
**Next Task:** P1-T005 - Error Handling & Logging Strategy
**Approval Required:** Security Team + Technical Lead
**Last Updated:** November 24, 2025
