# P1-T028: Smile Identity Integration Flow

**Task ID:** P1-T028
**Section:** 1.5 KYC & Onboarding Design
**Priority:** Critical
**Estimated Duration:** 6 hours
**Dependencies:** P1-T027, Phase 0 (T010-T012)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Smile Identity Product Selection](#smile-identity-product-selection)
3. [API Integration Architecture](#api-integration-architecture)
4. [Document Upload Flow](#document-upload-flow)
5. [Verification Callback Handling](#verification-callback-handling)
6. [Retry Logic for Failed Verifications](#retry-logic-for-failed-verifications)
7. [Manual Review Escalation](#manual-review-escalation)
8. [Error Handling](#error-handling)
9. [Implementation](#implementation)

---

## 1. Overview

Smile Identity is our chosen KYC verification provider for Zimbabwe. This document details the complete integration flow, from document submission to verification callback handling.

### Why Smile Identity?

**Advantages:**
- ✅ **Zimbabwe Support**: Verified National ID support
- ✅ **Biometric Matching**: Face recognition + liveness detection
- ✅ **High Accuracy**: 95%+ verification accuracy
- ✅ **Fast**: <10 second verification time
- ✅ **Affordable**: $0.20-0.50 per verification

**Products Used:**
1. **Enhanced KYC** - Document + biometric verification
2. **Biometric KYC** - Face matching only (fallback)

---

## 2. Smile Identity Product Selection

### 2.1 Product Comparison

| Feature | Enhanced KYC | Biometric KYC | Document Verification |
|---------|--------------|---------------|----------------------|
| **National ID Verification** | ✅ Yes | ❌ No | ✅ Yes |
| **Face Match** | ✅ Yes | ✅ Yes | ❌ No |
| **Liveness Detection** | ✅ Yes | ✅ Yes | ❌ No |
| **Cost per Check** | $0.50 | $0.20 | $0.30 |
| **Verification Time** | 5-10s | 2-5s | 3-8s |
| **Accuracy** | 95%+ | 90%+ | 85%+ |

**Decision: Use Enhanced KYC (job_type: 5)**

---

### 2.2 Enhanced KYC Flow

```
Customer WhatsApp Flow
          │
          ▼
┌─────────────────────────────────┐
│  1. Customer Uploads National ID │
│     - Photo via WhatsApp Camera  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  2. Customer Takes Selfie        │
│     - Real-time camera capture   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  3. Lynia Backend Processing     │
│     - Quality validation         │
│     - Base64 encoding            │
│     - Prepare API request        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  4. Submit to Smile Identity API │
│     - Enhanced KYC (job_type: 5) │
│     - Async verification         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  5. Smile Identity Processing    │
│     a) Document validation       │
│     b) Face extraction from ID   │
│     c) Face match (ID vs Selfie) │
│     d) Liveness detection        │
│     e) National ID database check│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  6. Verification Result          │
│     - Confidence score (0-100)   │
│     - Match result (Y/N/Review)  │
│     - Extracted data             │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  7. Lynia Decision Logic         │
│     - ≥85%: Auto-approve         │
│     - 50-84%: Manual review      │
│     - <50%: Auto-reject          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  8. Notify Customer              │
│     - Approved → Credit scoring  │
│     - Review → Wait message      │
│     - Rejected → Retry or appeal │
└─────────────────────────────────┘
```

---

## 3. API Integration Architecture

### 3.1 Smile Identity API Credentials

```typescript
interface SmileIdentityConfig {
  partner_id: string;           // Lynia's Smile partner ID
  api_key: string;              // API authentication key
  sid_server: string;           // Production: 'https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test'
  callback_url: string;         // Webhook for async results
  environment: 'test' | 'prod'; // Sandbox vs Production
}

const smileConfig: SmileIdentityConfig = {
  partner_id: process.env.SMILE_PARTNER_ID,
  api_key: process.env.SMILE_API_KEY,
  sid_server: process.env.SMILE_SERVER_URL,
  callback_url: `${process.env.API_BASE_URL}/webhooks/smile-identity`,
  environment: process.env.NODE_ENV === 'production' ? 'prod' : 'test'
};
```

**Environment Variables:**
```bash
SMILE_PARTNER_ID=<partner_id_from_smile>
SMILE_API_KEY=<api_key_from_smile>
SMILE_SERVER_URL=https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test
```

---

### 3.2 API Request Structure

**Enhanced KYC Request:**

```typescript
interface SmileEnhancedKYCRequest {
  // Partner credentials
  partner_id: string;
  partner_params: {
    user_id: string;            // Our customer ID
    job_id: string;             // Unique job ID (UUID)
    job_type: 5;                // Enhanced KYC
  };

  // Source country
  source_sdk: 'rest_api';
  source_sdk_version: '1.0.0';
  timestamp: string;            // ISO 8601 format

  // Document information
  country: 'ZW';                // Zimbabwe
  id_type: 'NATIONAL_ID';
  id_number: string;            // e.g., "63-123456A47"

  // Biometric images (Base64 encoded)
  image_type_id: 2;             // Selfie
  images: Array<{
    image_type_id: number;      // 0: Selfie, 1: ID front, 3: ID back
    image: string;              // Base64 encoded JPEG/PNG
  }>;

  // Optional: User information for matching
  first_name?: string;
  last_name?: string;
  dob?: string;                 // YYYY-MM-DD
  phone_number?: string;        // +263...

  // Callback configuration
  callback_url: string;
  use_enrolled_image: boolean;  // false for first-time users
}
```

**Example Request:**

```typescript
const kycRequest: SmileEnhancedKYCRequest = {
  partner_id: 'lynia_finance_001',
  partner_params: {
    user_id: 'cust_abc123',
    job_id: 'job_xyz789',
    job_type: 5
  },
  source_sdk: 'rest_api',
  source_sdk_version: '1.0.0',
  timestamp: new Date().toISOString(),
  country: 'ZW',
  id_type: 'NATIONAL_ID',
  id_number: '63-123456A47',
  images: [
    {
      image_type_id: 0,  // Selfie
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYA...'
    },
    {
      image_type_id: 1,  // ID front
      image: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUg...'
    }
  ],
  callback_url: 'https://api.lyniafinance.co.zw/webhooks/smile-identity',
  use_enrolled_image: false
};
```

---

### 3.3 API Response Structure

**Synchronous Response (Immediate):**

```typescript
interface SmileImmediateResponse {
  success: boolean;
  smile_job_id: string;         // Smile's internal job ID
  timestamp: string;
  code: string;                 // Status code
  message: string;              // Human-readable message
}
```

**Asynchronous Response (Webhook):**

```typescript
interface SmileWebhookPayload {
  // Job identification
  partner_id: string;
  smile_job_id: string;
  job_success: boolean;
  job_complete: boolean;

  // Result details
  result: {
    // Confidence & match
    confidence_value: number;   // 0-100
    match_result: 'Verified' | 'Not Verified' | 'Under Manual Review';

    // Document validation
    document_check: {
      authentic: boolean;
      tampered: boolean;
      expired: boolean;
      quality_score: number;    // 0-100
    };

    // Liveness detection
    liveness_check: {
      passed: boolean;
      score: number;            // 0-100
      spoof_type: null | 'photo_of_photo' | 'video_replay' | 'mask';
    };

    // Face match
    face_match: {
      score: number;            // 0-100
      match: boolean;
    };

    // Extracted ID data
    id_info: {
      full_name: string;
      id_number: string;
      dob: string;              // YYYY-MM-DD
      gender: 'M' | 'F';
      address: string;
      nationality: string;
    };
  };

  // Timestamps
  timestamp: string;
  created_at: string;
  updated_at: string;

  // Partner-specific data
  partner_params: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
}
```

---

## 4. Document Upload Flow

### 4.1 Step-by-Step Integration

```typescript
// src/services/kyc/smile-identity.ts

import { createHmac } from 'crypto';
import axios from 'axios';

class SmileIdentityService {

  private config: SmileIdentityConfig;

  constructor(config: SmileIdentityConfig) {
    this.config = config;
  }

  /**
   * Step 1: Submit Enhanced KYC request
   */
  async submitEnhancedKYC(
    customer_id: string,
    id_number: string,
    nationalIDImage: Buffer,
    selfieImage: Buffer
  ): Promise<SmileEnhancedKYCResult> {

    const job_id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert images to Base64
    const idImageBase64 = `data:image/jpeg;base64,${nationalIDImage.toString('base64')}`;
    const selfieBase64 = `data:image/jpeg;base64,${selfieImage.toString('base64')}`;

    // Construct request payload
    const payload: SmileEnhancedKYCRequest = {
      partner_id: this.config.partner_id,
      partner_params: {
        user_id: customer_id,
        job_id: job_id,
        job_type: 5
      },
      source_sdk: 'rest_api',
      source_sdk_version: '1.0.0',
      timestamp: new Date().toISOString(),
      country: 'ZW',
      id_type: 'NATIONAL_ID',
      id_number: id_number,
      images: [
        { image_type_id: 0, image: selfieBase64 },    // Selfie
        { image_type_id: 1, image: idImageBase64 }    // ID front
      ],
      callback_url: this.config.callback_url,
      use_enrolled_image: false
    };

    // Generate signature for authentication
    const signature = this.generateSignature(payload);

    // Make API request
    try {
      const response = await axios.post(
        `${this.config.sid_server}/v1/id_verification`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.api_key}`,
            'X-Signature': signature
          },
          timeout: 30000  // 30 second timeout
        }
      );

      return {
        success: true,
        smile_job_id: response.data.smile_job_id,
        job_id: job_id,
        timestamp: response.data.timestamp
      };

    } catch (error) {
      console.error('Smile Identity API error:', error);
      throw new Error(`KYC verification failed: ${error.message}`);
    }
  }

  /**
   * Generate HMAC signature for request authentication
   */
  private generateSignature(payload: SmileEnhancedKYCRequest): string {

    const signatureData = {
      partner_id: payload.partner_id,
      timestamp: payload.timestamp,
      job_id: payload.partner_params.job_id
    };

    const signatureString = JSON.stringify(signatureData);

    const signature = createHmac('sha256', this.config.api_key)
      .update(signatureString)
      .digest('hex');

    return signature;
  }
}
```

---

### 4.2 Image Preprocessing

Before submitting to Smile Identity, preprocess images:

```typescript
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {

  // 1. Resize if too large (max 5MB)
  let processedImage = imageBuffer;

  if (imageBuffer.length > 5 * 1024 * 1024) {
    processedImage = await resizeImage(imageBuffer, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 85
    });
  }

  // 2. Ensure correct orientation (EXIF rotation)
  processedImage = await autoRotate(processedImage);

  // 3. Convert to JPEG if PNG (smaller file size)
  processedImage = await convertToJPEG(processedImage);

  return processedImage;
}
```

---

## 5. Verification Callback Handling

### 5.1 Webhook Endpoint

```typescript
// src/api/webhooks/smile-identity.ts

export async function handleSmileIdentityWebhook(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {

  try {
    const payload: SmileWebhookPayload = JSON.parse(event.body);

    // Step 1: Verify webhook signature
    const isValid = verifySmileWebhookSignature(event);
    if (!isValid) {
      console.error('Invalid Smile webhook signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    // Step 2: Extract customer and job IDs
    const customer_id = payload.partner_params.user_id;
    const job_id = payload.partner_params.job_id;

    console.log(`Processing Smile webhook for customer ${customer_id}, job ${job_id}`);

    // Step 3: Fetch KYC submission record
    const { data: submission } = await supabase
      .from('kyc_submissions')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('smile_identity_transaction_id', job_id)
      .single();

    if (!submission) {
      console.error(`KYC submission not found for job ${job_id}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Submission not found' })
      };
    }

    // Step 4: Extract verification result
    const confidence = payload.result.confidence_value;
    const match_result = payload.result.match_result;
    const liveness_passed = payload.result.liveness_check.passed;
    const document_authentic = payload.result.document_check.authentic;

    // Step 5: Determine verification decision
    let decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
    let reason: string;

    if (
      match_result === 'Verified' &&
      confidence >= 85 &&
      liveness_passed &&
      document_authentic
    ) {
      decision = 'APPROVED';
      reason = 'Automatic verification successful';
    } else if (
      match_result === 'Not Verified' ||
      confidence < 50 ||
      !liveness_passed ||
      !document_authentic
    ) {
      decision = 'REJECTED';
      reason = `Verification failed: ${!liveness_passed ? 'Liveness check failed' : !document_authentic ? 'Document not authentic' : 'Low confidence score'}`;
    } else {
      decision = 'MANUAL_REVIEW';
      reason = `Confidence score ${confidence}% requires manual review`;
    }

    // Step 6: Update KYC submission record
    await supabase.from('kyc_submissions').update({
      status: decision === 'APPROVED' ? 'verified' :
              decision === 'REJECTED' ? 'rejected' : 'manual_review',
      verification_decision: decision,
      verification_reason: reason,
      verification_confidence: confidence,
      liveness_score: payload.result.liveness_check.score,
      face_match_score: payload.result.face_match.score,
      smile_identity_response: payload,
      verified_at: decision === 'APPROVED' ? new Date() : null,
      updated_at: new Date()
    }).eq('id', submission.id);

    // Step 7: Update customer KYC status
    if (decision === 'APPROVED') {
      await supabase.from('customers').update({
        kyc_status: 'verified',
        kyc_verified_at: new Date(),
        full_name: payload.result.id_info.full_name,
        date_of_birth: payload.result.id_info.dob,
        gender: payload.result.id_info.gender === 'M' ? 'male' : 'female'
      }).eq('id', customer_id);

      // Trigger credit scoring
      await triggerCreditScoring(customer_id);
    }

    // Step 8: Create manual review task if needed
    if (decision === 'MANUAL_REVIEW') {
      await createManualKYCReview(submission.id, customer_id);
    }

    // Step 9: Send notification to customer
    await notifyCustomerKYCResult(customer_id, decision, reason);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook processed successfully' })
    };

  } catch (error) {
    console.error('Error processing Smile webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
```

---

### 5.2 Webhook Signature Verification

```typescript
function verifySmileWebhookSignature(event: APIGatewayProxyEvent): boolean {

  const receivedSignature = event.headers['x-signature'] || event.headers['X-Signature'];

  if (!receivedSignature) {
    return false;
  }

  const payload = event.body;

  const expectedSignature = createHmac('sha256', process.env.SMILE_API_KEY)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

---

## 6. Retry Logic for Failed Verifications

### 6.1 Retriable vs Non-Retriable Failures

| Failure Type | Retriable? | Reason |
|--------------|------------|--------|
| **Network Timeout** | ✅ Yes | Temporary connection issue |
| **Smile API Unavailable (503)** | ✅ Yes | Service temporarily down |
| **Poor Image Quality** | ✅ Yes | Customer can retake photo |
| **Liveness Check Failed** | ✅ Yes | Customer can retry selfie |
| **Face Mismatch** | ✅ Yes (1 time) | Allow one retry |
| **Document Tampered** | ❌ No | Fraud indicator |
| **ID Not Found in Database** | ❌ No | Invalid/fake ID |
| **Expired ID** | ❌ No | Customer needs new ID |

---

### 6.2 Retry Implementation

```typescript
async function retryKYCVerification(
  customer_id: string,
  retry_reason: string
): Promise<RetryEligibility> {

  // Check retry state
  const { data: retryState } = await supabase
    .from('kyc_retry_state')
    .select('*')
    .eq('customer_id', customer_id)
    .single();

  // Non-retriable failures
  const nonRetriableReasons = [
    'document_tampered',
    'id_not_found',
    'expired_id',
    'blocked_customer'
  ];

  if (nonRetriableReasons.includes(retry_reason)) {
    return {
      allowed: false,
      reason: 'This issue cannot be resolved by retrying. Please contact support.'
    };
  }

  // Check attempt limits
  if (retryState.total_kyc_attempts >= 3) {
    return {
      allowed: false,
      reason: 'Maximum retry attempts reached. Please wait 24 hours.'
    };
  }

  // Allow retry
  return {
    allowed: true,
    attempts_remaining: 3 - retryState.total_kyc_attempts
  };
}
```

---

## 7. Manual Review Escalation

### 7.1 When to Escalate to Manual Review

**Automatic Escalation Triggers:**

1. **Confidence Score 50-84%**: Uncertain automated decision
2. **Liveness Score 60-79%**: Borderline liveness detection
3. **Face Match 60-74%**: Weak face match
4. **Document Quality Issues**: Damaged ID, poor photo
5. **Data Discrepancies**: Name mismatch between ID and phone registration

---

### 7.2 Manual Review Workflow

```typescript
async function createManualKYCReview(
  submission_id: string,
  customer_id: string
): Promise<void> {

  const sla_deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await supabase.from('kyc_manual_reviews').insert({
    kyc_submission_id: submission_id,
    customer_id: customer_id,
    review_status: 'pending',
    sla_deadline: sla_deadline,
    priority: 'normal',
    created_at: new Date()
  });

  // Notify admin team
  await notifyAdminNewManualReview(submission_id);

  // Notify customer
  await sendWhatsAppMessage(customer_id, {
    template: 'kyc_manual_review',
    params: {
      customer_name: '{{customer_name}}',
      review_time: '24 hours'
    }
  });
}
```

---

## 8. Error Handling

### 8.1 Smile Identity Error Codes

| Error Code | Meaning | Action |
|-----------|---------|--------|
| `2201` | Invalid partner credentials | Check API key |
| `2202` | Invalid request signature | Regenerate signature |
| `2203` | Invalid country/ID type | Use 'ZW' + 'NATIONAL_ID' |
| `2204` | Poor image quality | Reject with guidance |
| `2205` | Missing required fields | Validate request |
| `2206` | Rate limit exceeded | Implement backoff |
| `2207` | ID not found in database | Reject (invalid ID) |
| `2208` | Service unavailable | Retry after 5 minutes |

---

### 8.2 Error Handling Implementation

```typescript
async function handleSmileError(error: any): Promise<KYCErrorResponse> {

  const errorCode = error.response?.data?.code;
  const errorMessage = error.response?.data?.message;

  switch (errorCode) {
    case '2201':
    case '2202':
      // Authentication errors - alert dev team
      await alertDevTeam('Smile Identity authentication error', error);
      return {
        retriable: false,
        user_message: 'Verification service error. Please try again later.',
        admin_action_required: true
      };

    case '2204':
      // Poor image quality
      return {
        retriable: true,
        user_message: 'Photo quality too low. Please retake with better lighting.',
        admin_action_required: false
      };

    case '2206':
      // Rate limit
      return {
        retriable: true,
        user_message: 'Service temporarily busy. Please try again in 5 minutes.',
        retry_after: new Date(Date.now() + 5 * 60 * 1000)
      };

    case '2207':
      // ID not found
      return {
        retriable: false,
        user_message: 'National ID not found in registry. Please verify your ID number.',
        admin_action_required: false
      };

    case '2208':
      // Service unavailable
      return {
        retriable: true,
        user_message: 'Verification service temporarily unavailable. Please try again shortly.',
        retry_after: new Date(Date.now() + 10 * 60 * 1000)
      };

    default:
      // Unknown error
      await logError('Unknown Smile Identity error', { code: errorCode, message: errorMessage });
      return {
        retriable: true,
        user_message: 'Verification failed. Please try again.',
        admin_action_required: false
      };
  }
}
```

---

## 9. Implementation

### 9.1 Complete Integration Service

```typescript
// src/services/kyc/smile-identity-service.ts

export class SmileIdentityService {

  private config: SmileIdentityConfig;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      partner_id: process.env.SMILE_PARTNER_ID!,
      api_key: process.env.SMILE_API_KEY!,
      sid_server: process.env.SMILE_SERVER_URL!,
      callback_url: `${process.env.API_BASE_URL}/webhooks/smile-identity`,
      environment: process.env.NODE_ENV === 'production' ? 'prod' : 'test'
    };

    this.client = axios.create({
      baseURL: this.config.sid_server,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.api_key}`
      }
    });
  }

  /**
   * Main KYC verification method
   */
  async verifyKYC(params: {
    customer_id: string;
    id_number: string;
    nationalIDImage: Buffer;
    selfieImage: Buffer;
  }): Promise<KYCVerificationResponse> {

    const { customer_id, id_number, nationalIDImage, selfieImage } = params;

    // 1. Preprocess images
    const processedIDImage = await preprocessImage(nationalIDImage);
    const processedSelfie = await preprocessImage(selfieImage);

    // 2. Submit to Smile Identity
    const result = await this.submitEnhancedKYC(
      customer_id,
      id_number,
      processedIDImage,
      processedSelfie
    );

    // 3. Save submission record
    await this.saveKYCSubmission(customer_id, result);

    return {
      success: true,
      smile_job_id: result.smile_job_id,
      message: 'KYC verification submitted. You will be notified when complete.'
    };
  }

  private async submitEnhancedKYC(
    customer_id: string,
    id_number: string,
    idImage: Buffer,
    selfie: Buffer
  ): Promise<SmileEnhancedKYCResult> {
    // Implementation from section 4.1
    // ...
  }

  private async saveKYCSubmission(
    customer_id: string,
    result: SmileEnhancedKYCResult
  ): Promise<void> {
    // Save to database
    // ...
  }
}
```

---

## Summary

**Smile Identity Integration Deliverables:**
- ✅ **Product Selection**: Enhanced KYC (job_type: 5)
- ✅ **API Integration**: Complete request/response handling
- ✅ **Document Upload Flow**: Image preprocessing + Base64 encoding
- ✅ **Webhook Handler**: Async verification callback processing
- ✅ **Decision Logic**: 85%+ auto-approve, 50-84% manual review, <50% reject
- ✅ **Retry Logic**: Intelligent retry for transient failures
- ✅ **Error Handling**: Comprehensive error mapping and user guidance

**Key Features:**
- <10 second verification time
- 95%+ accuracy with liveness detection
- Automatic fallback to manual review
- Comprehensive error handling
- Webhook-based async processing

**Next Steps:**
1. Set up Smile Identity test account
2. Implement webhook endpoint
3. Test with sample Zimbabwe National IDs
4. Proceed to P1-T029 (Customer Onboarding Flow)

---

**References:**
- Smile Identity Documentation: https://docs.usesmileidentity.com
- KYC Document Requirements: [kyc-document-requirements.md](kyc-document-requirements.md)
- API Specification: [api-specification.md](api-specification.md)
