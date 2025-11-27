# P1-T027: KYC Document Requirements

**Task ID:** P1-T027
**Section:** 1.5 KYC & Onboarding Design
**Priority:** Critical
**Estimated Duration:** 4 hours
**Dependencies:** Phase 0 (T010-T013)
**Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Required Documents](#required-documents)
3. [Zimbabwe National ID Validation](#zimbabwe-national-id-validation)
4. [Selfie Verification Requirements](#selfie-verification-requirements)
5. [Document Quality Checks](#document-quality-checks)
6. [Retry Limits and Fallbacks](#retry-limits-and-fallbacks)
7. [Data Schema](#data-schema)
8. [Implementation](#implementation)

---

## 1. Overview

KYC (Know Your Customer) is a critical regulatory requirement for financial services in Zimbabwe. This document specifies the exact documents required, validation rules, quality standards, and retry logic for the Lynia Finance onboarding process.

### Regulatory Context

**Zimbabwe KYC Requirements:**
- **Reserve Bank of Zimbabwe (RBZ)**: Financial institutions must verify customer identity
- **Anti-Money Laundering (AML)**: Compliance with FATF recommendations
- **Data Protection Act (2021)**: Customer data privacy and consent

### Business Goals

1. **Fraud Prevention**: Ensure customers are who they claim to be
2. **Compliance**: Meet regulatory requirements for lending license
3. **User Experience**: Fast, mobile-first verification (<5 minutes)
4. **Accessibility**: Support low-literacy users via WhatsApp

---

## 2. Required Documents

### 2.1 Primary Identity Document (REQUIRED)

**Zimbabwe National ID Card**

- **Document Type**: Physical National ID issued by Registrar General's Office
- **Format**: Laminated card with photo, ID number, personal details
- **Validity**: Must be current and not expired
- **Upload Method**: Photo via WhatsApp camera
- **Alternative**: Scanned copy or high-quality photo

**What We Capture:**
```typescript
interface NationalIDCapture {
  id_number: string;              // Format: 00-000000X00
  full_name: string;              // As appears on ID
  date_of_birth: Date;            // Extracted from ID
  gender: 'male' | 'female';      // Extracted from ID
  address: string;                // As appears on ID
  issue_date: Date;               // When ID was issued
  expiry_date: Date | null;       // Some IDs don't expire

  // Image metadata
  front_image_url: string;        // S3 URL
  back_image_url: string | null;  // S3 URL (if applicable)
  upload_timestamp: Date;
}
```

---

### 2.2 Selfie Verification (REQUIRED)

**Live Selfie Photo**

- **Purpose**: Match face to National ID photo (biometric verification)
- **Capture Method**: WhatsApp camera (real-time)
- **Requirements**:
  - Clear, well-lit photo
  - Face must be centered and visible
  - No sunglasses or face coverings
  - Neutral expression
  - No filters or editing

**Technical Specifications:**
- **Min Resolution**: 640x480 pixels
- **File Format**: JPEG, PNG
- **Max File Size**: 5MB
- **Liveness Detection**: Smile Identity liveness check

```typescript
interface SelfieCapture {
  selfie_image_url: string;       // S3 URL
  liveness_check: boolean;        // True if passed liveness
  liveness_score: number;         // 0-100 confidence
  upload_timestamp: Date;
  camera_metadata: {
    device_model?: string;
    camera_type?: 'front' | 'back';
  };
}
```

---

### 2.3 Optional Supporting Documents

**Proof of Address (OPTIONAL - for higher credit limits)**

Not required for Tier 1 ($200 loans), but may be requested for Tier 2+ ($350+):

- Utility bill (ZESA, water, council rates)
- Bank statement
- Rental agreement
- Employer letter with address

**Proof of Income (OPTIONAL - for Tier 3 loans)**

May be requested for $500+ loans:
- Payslip
- Bank statement showing regular deposits
- Business registration certificate
- Tax clearance certificate

---

## 3. Zimbabwe National ID Validation

### 3.1 ID Number Format

**Standard Format:** `00-000000X00`

- **Positions 1-2**: Registration district code (01-99)
- **Positions 4-9**: Sequential number (000000-999999)
- **Position 10**: Check digit letter (A-Z)
- **Positions 11-12**: Suffix (00-99)

**Examples of Valid IDs:**
- `63-123456A47`
- `08-789012B23`
- `14-567890C88`

---

### 3.2 Validation Rules

```typescript
function validateZimbabweNationalID(idNumber: string): ValidationResult {

  const errors: string[] = [];

  // Rule 1: Format check
  const ID_REGEX = /^\d{2}-\d{6}[A-Z]\d{2}$/;
  if (!ID_REGEX.test(idNumber)) {
    errors.push('Invalid ID format. Expected format: 00-000000X00');
  }

  // Rule 2: District code validation
  const districtCode = parseInt(idNumber.substring(0, 2));
  if (districtCode < 1 || districtCode > 99) {
    errors.push('Invalid district code. Must be 01-99');
  }

  // Rule 3: Check for common test/fake IDs
  const BLACKLIST = ['00-000000A00', '99-999999Z99'];
  if (BLACKLIST.includes(idNumber)) {
    errors.push('ID number appears to be invalid or test ID');
  }

  // Rule 4: Check digit validation (if algorithm known)
  // TODO: Implement Zimbabwean ID check digit algorithm if available

  return {
    valid: errors.length === 0,
    errors: errors,
    formatted_id: idNumber.toUpperCase()
  };
}
```

---

### 3.3 Smile Identity Verification

**Integration with Smile Identity:**

Smile Identity provides biometric verification services for Zimbabwe:

```typescript
interface SmileIdentityRequest {
  country: 'ZW';                  // Zimbabwe
  id_type: 'NATIONAL_ID';
  id_number: string;              // e.g., "63-123456A47"

  // Biometric data
  selfie_image: string;           // Base64 encoded

  // Optional: ID document images
  id_card_image?: string;         // Base64 encoded front

  // User info for matching
  first_name: string;
  last_name: string;
  dob?: string;                   // YYYY-MM-DD
  phone_number: string;           // +263...
}

interface SmileIdentityResponse {
  success: boolean;
  confidence_score: number;       // 0-100
  match_result: 'VERIFIED' | 'NOT_VERIFIED' | 'REVIEW_REQUIRED';

  // Extracted data
  extracted_data: {
    full_name: string;
    id_number: string;
    dob: string;
    gender: string;
  };

  // Liveness check
  liveness: {
    passed: boolean;
    score: number;
  };

  // Document validation
  document_validation: {
    authentic: boolean;
    tampered: boolean;
    expired: boolean;
  };
}
```

---

### 3.4 Verification Decision Logic

```typescript
function evaluateKYCVerification(smileResponse: SmileIdentityResponse): KYCDecision {

  // Auto-approve criteria
  if (
    smileResponse.match_result === 'VERIFIED' &&
    smileResponse.confidence_score >= 85 &&
    smileResponse.liveness.passed &&
    !smileResponse.document_validation.tampered
  ) {
    return {
      decision: 'APPROVED',
      reason: 'Automatic verification passed',
      confidence: smileResponse.confidence_score
    };
  }

  // Auto-reject criteria
  if (
    smileResponse.match_result === 'NOT_VERIFIED' ||
    smileResponse.confidence_score < 50 ||
    smileResponse.document_validation.tampered ||
    smileResponse.document_validation.expired
  ) {
    return {
      decision: 'REJECTED',
      reason: 'Verification failed',
      confidence: smileResponse.confidence_score
    };
  }

  // Manual review required
  return {
    decision: 'MANUAL_REVIEW',
    reason: 'Confidence score 50-84, requires human verification',
    confidence: smileResponse.confidence_score
  };
}
```

**Thresholds:**
- **≥85% confidence**: Auto-approve
- **50-84% confidence**: Manual review
- **<50% confidence**: Auto-reject

---

## 4. Selfie Verification Requirements

### 4.1 Image Quality Standards

**Minimum Requirements:**

| Criteria | Requirement | Rejection Reason |
|----------|-------------|------------------|
| **Resolution** | ≥640x480 pixels | "Photo too blurry" |
| **Face Size** | Face occupies 40-70% of frame | "Face too small/large" |
| **Lighting** | Evenly lit, no harsh shadows | "Poor lighting" |
| **Focus** | Sharp focus on face | "Photo out of focus" |
| **Angle** | Front-facing (±15° rotation) | "Face not centered" |
| **Obstructions** | No sunglasses, hats, masks | "Face partially covered" |
| **Liveness** | Passes liveness detection | "Possible photo of photo" |

---

### 4.2 Liveness Detection

**Purpose:** Prevent fraud (using printed photos, videos, deepfakes)

**Smile Identity Liveness Methods:**
1. **Passive Liveness**: Analyzes single image for signs of life (texture, depth, reflection)
2. **Active Liveness**: User performs action (smile, blink, turn head) - NOT USED (poor WhatsApp UX)

**Implementation:**
```typescript
async function checkLiveness(selfieImageBase64: string): Promise<LivenessResult> {

  const response = await smileIdentity.checkLiveness({
    image: selfieImageBase64,
    liveness_type: 'passive'  // No user action required
  });

  return {
    passed: response.liveness_check === 'passed',
    score: response.liveness_score,  // 0-100
    analysis: {
      is_live: response.is_live,
      is_photo_of_photo: response.spoof_check.photo_of_photo,
      is_video_replay: response.spoof_check.video_replay,
      is_mask: response.spoof_check.mask
    }
  };
}
```

**Liveness Score Thresholds:**
- **≥80**: Pass (high confidence live person)
- **60-79**: Review (medium confidence)
- **<60**: Fail (likely spoof attempt)

---

### 4.3 Face Matching

**Matching National ID Photo to Selfie:**

```typescript
async function matchFaceToID(
  idPhotoUrl: string,
  selfieUrl: string
): Promise<FaceMatchResult> {

  const result = await smileIdentity.compareFaces({
    reference_image: idPhotoUrl,   // National ID photo
    comparison_image: selfieUrl    // Customer selfie
  });

  return {
    match: result.match_score >= 75,
    confidence: result.match_score,  // 0-100
    decision: result.match_score >= 75 ? 'MATCH' : 'NO_MATCH',
    threshold_used: 75
  };
}
```

**Match Score Interpretation:**
- **≥85%**: Strong match (auto-approve)
- **75-84%**: Good match (approve with monitoring)
- **60-74%**: Weak match (manual review)
- **<60%**: No match (reject)

---

## 5. Document Quality Checks

### 5.1 Automated Image Quality Validation

Before sending to Smile Identity, validate image quality locally:

```typescript
async function validateDocumentImage(
  imageBuffer: Buffer,
  documentType: 'national_id' | 'selfie'
): Promise<ImageValidationResult> {

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: File size
  const fileSizeMB = imageBuffer.length / (1024 * 1024);
  if (fileSizeMB > 5) {
    errors.push('File size exceeds 5MB. Please compress or retake photo.');
  }
  if (fileSizeMB < 0.05) {  // < 50KB
    warnings.push('File size very small. Photo may be low quality.');
  }

  // Check 2: Image dimensions
  const dimensions = await getImageDimensions(imageBuffer);
  if (dimensions.width < 640 || dimensions.height < 480) {
    errors.push('Image resolution too low. Minimum 640x480 required.');
  }

  // Check 3: Image format
  const format = await getImageFormat(imageBuffer);
  if (!['jpeg', 'jpg', 'png'].includes(format)) {
    errors.push('Invalid image format. Please upload JPEG or PNG.');
  }

  // Check 4: Brightness (avoid too dark/bright images)
  const brightness = await calculateAverageBrightness(imageBuffer);
  if (brightness < 20) {
    warnings.push('Image appears too dark. Try better lighting.');
  }
  if (brightness > 235) {
    warnings.push('Image appears overexposed. Reduce lighting.');
  }

  // Check 5: Blur detection
  const blurScore = await detectBlur(imageBuffer);
  if (blurScore < 30) {  // Lower = more blurry
    errors.push('Image is too blurry. Hold phone steady and retake.');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    quality_score: calculateQualityScore(dimensions, brightness, blurScore)
  };
}
```

---

### 5.2 User Guidance for Better Photos

**WhatsApp Message Templates:**

**For National ID Upload:**
```
📸 *Please upload your National ID*

Tips for a clear photo:
✓ Place ID on flat, dark surface
✓ Ensure good lighting (no shadows)
✓ Capture entire ID in frame
✓ Hold phone steady
✓ All text must be readable

Take photo now 📷
```

**For Selfie Upload:**
```
🤳 *Please take a selfie*

Tips for verification:
✓ Face the camera directly
✓ Remove sunglasses/hat
✓ Use good lighting
✓ Don't smile too much
✓ Hold phone at eye level

Take selfie now 📷
```

---

### 5.3 Rejection Reasons and Guidance

| Rejection Reason | User Message | Retry Guidance |
|-----------------|--------------|----------------|
| **Blurry Image** | "Your photo is too blurry." | "Hold your phone steady and tap to focus before taking the photo." |
| **Poor Lighting** | "The image is too dark." | "Move to a well-lit area or turn on more lights." |
| **Face Not Visible** | "We can't see your face clearly." | "Make sure your face is centered and fully visible." |
| **ID Not Readable** | "We can't read the details on your ID." | "Lay your ID flat on a dark surface and ensure all text is visible." |
| **Liveness Failed** | "We couldn't verify this is a live photo." | "Please take a new selfie with your phone camera (don't upload saved photos)." |
| **Face Mismatch** | "Your selfie doesn't match your ID photo." | "Ensure you're using your own ID and take a clear selfie facing the camera." |

---

## 6. Retry Limits and Fallbacks

### 6.1 Retry Policy

**Maximum Attempts:**
- **National ID Upload**: 3 attempts
- **Selfie Upload**: 3 attempts
- **Total KYC Process**: 3 complete attempts

**Cooldown Periods:**
- After 3 failed attempts: 24-hour cooldown
- After 3 cooldowns: Permanent block → Manual review required

```typescript
interface KYCRetryState {
  customer_id: string;

  // Attempt tracking
  national_id_attempts: number;     // Max 3
  selfie_attempts: number;          // Max 3
  total_kyc_attempts: number;       // Max 3

  // Cooldown tracking
  cooldown_count: number;           // Max 3
  last_attempt_at: Date;
  cooldown_until: Date | null;

  // Status
  blocked: boolean;
  blocked_reason: string | null;
}

async function checkRetryEligibility(customer_id: string): Promise<RetryEligibility> {

  const state = await getKYCRetryState(customer_id);

  // Check if blocked
  if (state.blocked) {
    return {
      eligible: false,
      reason: 'Account blocked. Contact support for manual review.',
      contact_support: true
    };
  }

  // Check if in cooldown
  if (state.cooldown_until && new Date() < state.cooldown_until) {
    const hoursRemaining = Math.ceil(
      (state.cooldown_until.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    return {
      eligible: false,
      reason: `Please wait ${hoursRemaining} hours before trying again.`,
      retry_after: state.cooldown_until
    };
  }

  // Check attempt limits
  if (state.total_kyc_attempts >= 3) {
    // Trigger 24-hour cooldown
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await updateKYCRetryState(customer_id, {
      cooldown_count: state.cooldown_count + 1,
      cooldown_until: cooldownUntil,
      total_kyc_attempts: 0  // Reset attempts after cooldown
    });

    // Block after 3 cooldowns
    if (state.cooldown_count >= 2) {  // This is the 3rd cooldown
      await updateKYCRetryState(customer_id, {
        blocked: true,
        blocked_reason: 'Multiple failed KYC attempts. Manual review required.'
      });
    }

    return {
      eligible: false,
      reason: 'Maximum attempts reached. Please try again in 24 hours.',
      retry_after: cooldownUntil
    };
  }

  return {
    eligible: true,
    attempts_remaining: 3 - state.total_kyc_attempts
  };
}
```

---

### 6.2 Manual Review Fallback

**Triggers for Manual Review:**

1. **Smile Identity Confidence 50-84%**: Uncertain match
2. **3 Failed Automated Attempts**: Customer struggling with automation
3. **Document Quality Issues**: Damaged/old ID cards
4. **Name Discrepancies**: Name on ID doesn't match phone registration
5. **Customer Request**: Customer claims error and requests human review

**Manual Review Process:**

```typescript
interface ManualKYCReview {
  review_id: string;
  customer_id: string;

  // Documents submitted
  national_id_image_url: string;
  selfie_image_url: string;

  // Automated verification results
  smile_identity_response: SmileIdentityResponse;
  auto_decision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  auto_confidence: number;

  // Manual review
  assigned_to: string;                // Admin user ID
  assigned_at: Date;
  review_status: 'pending' | 'in_progress' | 'completed';

  // Reviewer decision
  manual_decision: 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO' | null;
  manual_decision_reason: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;

  // SLA tracking
  sla_deadline: Date;                 // 24 hours from assignment
  sla_breached: boolean;
}
```

**Manual Review SLA:**
- **Target**: Review within 12 hours
- **Maximum**: 24 hours
- **Escalation**: If not reviewed in 24h, escalate to senior admin

---

### 6.3 Alternative Verification Methods

**For Edge Cases Where Smile Identity Fails:**

**Option 1: Video Call Verification**
- Schedule WhatsApp video call with admin
- Customer shows ID to camera in real-time
- Admin manually verifies

**Option 2: In-Person Verification at Distributor**
- Customer visits distributor location
- Distributor physically verifies ID
- Distributor submits verification via admin portal

**Option 3: Bank Account Verification**
- Customer provides bank statement
- Lynia deposits small amount (e.g., $0.25)
- Customer confirms amount received
- Bank account name must match ID name

---

## 7. Data Schema

### 7.1 KYC Submissions Table

```sql
CREATE TABLE kyc_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Submission metadata
  submission_number INT NOT NULL,        -- 1st, 2nd, 3rd attempt
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submission_method TEXT NOT NULL,       -- 'whatsapp' | 'admin_portal'

  -- National ID data
  id_number TEXT NOT NULL,
  id_type TEXT DEFAULT 'NATIONAL_ID',
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,

  -- Document images
  id_front_image_url TEXT NOT NULL,
  id_back_image_url TEXT,
  selfie_image_url TEXT NOT NULL,

  -- Image quality scores
  id_image_quality_score INT,            -- 0-100
  selfie_quality_score INT,              -- 0-100

  -- Smile Identity verification
  smile_identity_transaction_id TEXT,
  smile_identity_response JSONB,
  verification_confidence DECIMAL(5,2),  -- 0.00-100.00
  liveness_score DECIMAL(5,2),
  face_match_score DECIMAL(5,2),

  -- Verification status
  status TEXT NOT NULL,                  -- 'pending' | 'verified' | 'rejected' | 'manual_review'
  verification_decision TEXT,            -- 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW'
  verification_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES admin_users(id),

  -- Retry tracking
  retry_count INT DEFAULT 0,
  previous_submission_id UUID REFERENCES kyc_submissions(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'rejected', 'manual_review')),
  CONSTRAINT valid_gender CHECK (gender IN ('male', 'female', 'other', NULL))
);

CREATE INDEX idx_kyc_customer ON kyc_submissions(customer_id);
CREATE INDEX idx_kyc_status ON kyc_submissions(status);
CREATE INDEX idx_kyc_id_number ON kyc_submissions(id_number);
```

---

### 7.2 KYC Retry State Table

```sql
CREATE TABLE kyc_retry_state (
  customer_id UUID PRIMARY KEY REFERENCES customers(id),

  -- Attempt tracking
  national_id_attempts INT DEFAULT 0,
  selfie_attempts INT DEFAULT 0,
  total_kyc_attempts INT DEFAULT 0,

  -- Cooldown tracking
  cooldown_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,

  -- Blocking
  blocked BOOLEAN DEFAULT FALSE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 7.3 Manual Review Queue Table

```sql
CREATE TABLE kyc_manual_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kyc_submission_id UUID NOT NULL REFERENCES kyc_submissions(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Assignment
  assigned_to UUID REFERENCES admin_users(id),
  assigned_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'in_progress' | 'completed'

  -- SLA tracking
  sla_deadline TIMESTAMPTZ NOT NULL,              -- 24 hours from creation
  sla_breached BOOLEAN DEFAULT FALSE,

  -- Review decision
  manual_decision TEXT,                           -- 'APPROVE' | 'REJECT' | 'REQUEST_MORE_INFO'
  decision_reason TEXT,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id),

  -- Priority
  priority TEXT DEFAULT 'normal',                 -- 'low' | 'normal' | 'high' | 'urgent'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_review_status CHECK (review_status IN ('pending', 'in_progress', 'completed')),
  CONSTRAINT valid_manual_decision CHECK (manual_decision IN ('APPROVE', 'REJECT', 'REQUEST_MORE_INFO', NULL))
);

CREATE INDEX idx_manual_review_status ON kyc_manual_reviews(review_status);
CREATE INDEX idx_manual_review_assigned ON kyc_manual_reviews(assigned_to);
CREATE INDEX idx_manual_review_sla ON kyc_manual_reviews(sla_deadline) WHERE review_status != 'completed';
```

---

## 8. Implementation

### 8.1 KYC Verification Service

```typescript
// src/services/kyc/verification.ts

export async function submitKYCDocuments(
  customer_id: string,
  nationalIDImage: Buffer,
  selfieImage: Buffer,
  id_number: string
): Promise<KYCVerificationResult> {

  // Step 1: Check retry eligibility
  const retryCheck = await checkRetryEligibility(customer_id);
  if (!retryCheck.eligible) {
    throw new Error(retryCheck.reason);
  }

  // Step 2: Validate ID number format
  const idValidation = validateZimbabweNationalID(id_number);
  if (!idValidation.valid) {
    await incrementRetryCount(customer_id, 'national_id');
    throw new Error(`Invalid ID number: ${idValidation.errors.join(', ')}`);
  }

  // Step 3: Validate image quality
  const idImageValidation = await validateDocumentImage(nationalIDImage, 'national_id');
  if (!idImageValidation.valid) {
    await incrementRetryCount(customer_id, 'national_id');
    throw new Error(`ID image quality issue: ${idImageValidation.errors.join(', ')}`);
  }

  const selfieValidation = await validateDocumentImage(selfieImage, 'selfie');
  if (!selfieValidation.valid) {
    await incrementRetryCount(customer_id, 'selfie');
    throw new Error(`Selfie quality issue: ${selfieValidation.errors.join(', ')}`);
  }

  // Step 4: Upload images to S3
  const idImageUrl = await uploadToS3(nationalIDImage, `kyc/${customer_id}/id-${Date.now()}.jpg`);
  const selfieUrl = await uploadToS3(selfieImage, `kyc/${customer_id}/selfie-${Date.now()}.jpg`);

  // Step 5: Submit to Smile Identity
  const smileResponse = await smileIdentity.verify({
    country: 'ZW',
    id_type: 'NATIONAL_ID',
    id_number: id_number,
    selfie_image: selfieImage.toString('base64'),
    id_card_image: nationalIDImage.toString('base64'),
    user_id: customer_id,
    job_type: 5  // Biometric KYC
  });

  // Step 6: Evaluate decision
  const decision = evaluateKYCVerification(smileResponse);

  // Step 7: Create KYC submission record
  const submission = await supabase.from('kyc_submissions').insert({
    customer_id: customer_id,
    submission_number: retryCheck.attempts_remaining,
    id_number: id_number,
    id_front_image_url: idImageUrl,
    selfie_image_url: selfieUrl,
    smile_identity_transaction_id: smileResponse.transaction_id,
    smile_identity_response: smileResponse,
    verification_confidence: decision.confidence,
    liveness_score: smileResponse.liveness.score,
    face_match_score: smileResponse.confidence_score,
    status: decision.decision === 'APPROVED' ? 'verified' :
            decision.decision === 'REJECTED' ? 'rejected' : 'manual_review',
    verification_decision: decision.decision,
    verification_reason: decision.reason,
    verified_at: decision.decision === 'APPROVED' ? new Date() : null
  }).select().single();

  // Step 8: Handle manual review if needed
  if (decision.decision === 'MANUAL_REVIEW') {
    await createManualReviewTask(submission.data.id, customer_id);
  }

  // Step 9: Update customer KYC status
  if (decision.decision === 'APPROVED') {
    await supabase.from('customers').update({
      kyc_status: 'verified',
      kyc_verified_at: new Date()
    }).eq('id', customer_id);
  }

  // Step 10: Increment retry count
  await incrementRetryCount(customer_id, 'total');

  return {
    submission_id: submission.data.id,
    decision: decision.decision,
    confidence: decision.confidence,
    reason: decision.reason,
    requires_manual_review: decision.decision === 'MANUAL_REVIEW'
  };
}
```

---

### 8.2 Integration Points

**External Services:**
1. **Smile Identity API** - Biometric verification
2. **AWS S3** - Document image storage
3. **WhatsApp Cloud API** - Document upload via WhatsApp
4. **Supabase Storage** - Alternative to S3 (consider for cost)

**Internal Services:**
1. **WhatsApp Bot** - Guides user through upload process
2. **Admin Dashboard** - Manual review interface
3. **Notification Service** - Sends verification results

---

## Summary

### Executive Summary
This specification defines the complete KYC (Know Your Customer) document requirements for Lynia Finance's WhatsApp-based device financing platform. It ensures regulatory compliance with Zimbabwe's Reserve Bank and Data Protection Act while maintaining a fast, mobile-first verification process that takes under 5 minutes.

### What Was Delivered
This document provides:
1. **Document Requirements**: Zimbabwe National ID + Live Selfie as required documents for all customers
2. **Validation System**: Automated ID number format validation (00-000000X00) with district code verification
3. **Quality Standards**: Image quality checks (resolution, lighting, blur detection) with user-friendly guidance
4. **Biometric Verification**: Smile Identity integration with 85%+ auto-approval threshold
5. **Retry Policy**: 3-attempt limit with 24-hour cooldowns and manual review fallback
6. **Data Architecture**: Complete database schema for KYC submissions, retry tracking, and manual review queue

### Technical Components
- **Validation Functions**: Zimbabwe National ID format validator, image quality checker
- **Smile Identity Integration**: Enhanced KYC (job_type: 5) with liveness detection
- **Decision Logic**: Auto-approve (≥85%), manual review (50-84%), auto-reject (<50%)
- **Database Tables**: `kyc_submissions`, `kyc_retry_state`, `kyc_manual_reviews`
- **WhatsApp Integration**: Document upload flow with user guidance templates

### Business Impact
- **Fraud Prevention**: Biometric verification prevents identity theft
- **Regulatory Compliance**: Meets RBZ and AML requirements for lending license
- **User Experience**: 5-minute verification via WhatsApp (no app download required)
- **Scalability**: Automated verification handles 85%+ of submissions without human intervention

### Implementation Checklist
- [ ] Set up Smile Identity API credentials and test environment
- [ ] Implement Zimbabwe National ID validator
- [ ] Build image quality pre-validation service
- [ ] Create S3 bucket for document storage with encryption
- [ ] Set up database tables (kyc_submissions, kyc_retry_state, kyc_manual_reviews)
- [ ] Integrate Smile Identity biometric verification API
- [ ] Build retry tracking and cooldown logic
- [ ] Create manual review admin interface
- [ ] Set up webhook endpoint for async Smile Identity callbacks
- [ ] Implement WhatsApp message templates for document upload guidance

### Dependencies
- **Smile Identity Account**: Enhanced KYC product subscription required
- **AWS S3 or Supabase Storage**: For secure document image storage
- **Database Schema**: Supabase tables (customers, kyc_submissions, etc.)
- **WhatsApp Cloud API**: For document media handling

### Related Specifications
- [Smile Identity Integration Flow](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/smile-identity-integration.md) - Complete API integration details
- [Customer Onboarding Flow](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/customer-onboarding-flow.md) - Full customer journey including KYC
- [KYC Status Management](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/kyc-status-management.md) - Status lifecycle and transitions
- [Privacy & Consent Management](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/privacy-consent-management.md) - Data protection compliance
- [Data Privacy Compliance](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/data-privacy-compliance.md) - Zimbabwe Data Protection Act requirements
- [WhatsApp Media Handling](https://github.com/1terr/Lynia-finance/blob/master/lynia-specs/lynia-lending/whatsapp-media-handling.md) - Document upload via WhatsApp

### External References
- [Smile Identity Documentation](https://docs.usesmileidentity.com) - Biometric verification API
- [Zimbabwe Registrar General's Office](https://www.rg.gov.zw) - National ID information
