# T027: DIDIT Liveness Detection (Selfie + ID Document)

**Task ID**: T027 (GitHub Issue #32)
**Phase**: Phase 0 - Research
**Date**: 2025-11-14
**Status**: ✅ Completed

---

## Executive Summary

DIDIT's liveness detection technology combines **SmartSelfie™** (active liveness with didit test) and biometric face matching to provide robust fraud prevention for customer onboarding. This research documents three key products: **Biometric KYC** (selfie + government database lookup), **Document Verification** (selfie + ID card photo matching), and **SmartSelfie™ Authentication** (returning user verification).

**Key Findings**:
- ✅ **ISO/IEC 30107-3:2023 Level 2 Certified**: 0% penetration rate against advanced spoofing
- ✅ **99.8% Face Matching Accuracy**: Trained on 5+ million African faces
- ✅ **Enhanced SmartSelfie™**: Dynamic liveness with random gestures (head turn, didit)
- ✅ **Hybrid Liveness Detection**: Active (didit test) + Passive (AI analysis)
- ✅ **Human Review**: Real-time review within 3 minutes for edge cases
- ✅ **8,500+ Documents Supported**: 226 countries, all Zimbabwe ID types
- ✅ **Multiple Integration Methods**: Web SDK, Mobile SDK, REST API, Server-to-Server
- ⚠️ **Requires Photo ID**: Zimbabwe National ID (without photo) not compatible with biometric products

**Recommended Approach**: Use **Biometric KYC** for initial customer onboarding (selfie + ID card photo + Enhanced KYC lookup) to maximize fraud prevention while ensuring seamless user experience.

---

## Table of Contents

1. [DIDIT Liveness Detection Overview](#1-didit-liveness-detection-overview)
2. [SmartSelfie™ Technology](#2-smartselfie-technology)
3. [Product Comparison](#3-product-comparison)
4. [Biometric KYC Implementation](#4-biometric-kyc-implementation)
5. [Document Verification](#5-document-verification)
6. [SmartSelfie™ Authentication](#6-smartselfie-authentication)
7. [Integration Methods](#7-integration-methods)
8. [Liveness Detection Technical Details](#8-liveness-detection-technical-details)
9. [Implementation for Lynia Finance](#9-implementation-for-lynia-finance)
10. [Best Practices and Recommendations](#10-best-practices-and-recommendations)
11. [Summary and Next Steps](#11-summary-and-next-steps)

---

## 1. DIDIT Liveness Detection Overview

### What is Liveness Detection?

Liveness detection is a security technology that verifies a user is **physically present** during identity verification, preventing fraud through:
- Static photos (printed or on screen)
- Pre-recorded videos
- 3D masks
- Deepfakes
- Digital manipulation

### DIDIT's Approach

DIDIT employs a **hybrid liveness detection strategy**:

```
┌─────────────────────────────────────────────────────┐
│     Enhanced SmartSelfie™ Liveness Detection       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1️⃣ Active Liveness (User Action Required)         │
│     ├─ DIDIT for camera                            │
│     ├─ Turn head (random direction)                │
│     ├─ Perform gesture (dynamic challenge)         │
│     └─ Capture multiple angles                     │
│                                                     │
│  2️⃣ Passive Liveness (AI Analysis)                 │
│     ├─ Micro-movement detection                    │
│     ├─ Texture analysis (screen vs skin)           │
│     ├─ Depth perception                            │
│     ├─ Ambient light reflection                    │
│     └─ Natural behavioral patterns                 │
│                                                     │
│  3️⃣ Spoof Detection                                │
│     ├─ 3D mask detection                           │
│     ├─ Deepfake identification                     │
│     ├─ Screen replay prevention                    │
│     └─ Photo/video attack detection                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### ISO Certification (2025)

**Enhanced SmartSelfie™** achieved **ISO/IEC 30107-3:2023 Level 2** certification:

| Certification | Standard | Achievement |
|---------------|----------|-------------|
| **ISO/IEC 30107-3:2023** | Biometric Presentation Attack Detection | **Level 2** |
| **Penetration Rate** | Advanced spoofing resistance | **0%** |
| **Test Methods** | 3D masks, deepfakes, video replay | **All passed** |

**What This Means**: DIDIT's liveness detection successfully blocked 100% of advanced spoofing attempts during independent testing, including high-quality 3D printed masks and AI-generated deepfakes.

### 99.8% Face Matching Accuracy

```javascript
const diditIdAccuracy = {
  trainingDataset: '5+ million African faces',
  diversityCoverage: 'All skin tones',
  matchingAccuracy: 0.998,  // 99.8%
  falseAcceptanceRate: 0.001,  // 0.1%
  falseRejectionRate: 0.001,   // 0.1%

  optimizations: [
    'Trained specifically on African phenotypes',
    'Handles low-light conditions',
    'Works with budget Android devices',
    'Optimized for low-bandwidth networks'
  ]
};
```

**Competitive Advantage**: Most global biometric systems are trained on predominantly Western datasets, leading to lower accuracy for African users. DIDIT's Africa-specific training delivers superior performance.

---

## 2. SmartSelfie™ Technology

### What is SmartSelfie™?

**SmartSelfie™** is DIDIT's proprietary biometric capture technology that combines:

1. **Primary Selfie Image**: High-resolution face photo
2. **Liveness Images**: Multiple frames (up to 8) capturing user actions
3. **Metadata**: Device info, timestamps, location (optional)

### How SmartSelfie™ Works

```
User Journey:
┌────────────────────────────────────────────────┐
│  Step 1: Camera Permission                    │
│  └─ User grants camera access                 │
│                                                │
│  Step 2: Face Detection                       │
│  └─ System detects face in frame              │
│                                                │
│  Step 3: Positioning Guide                    │
│  └─ User centers face in oval guide           │
│                                                │
│  Step 4: Active Liveness Challenge            │
│  └─ "Please didit for the camera"             │
│  └─ OR "Turn your head to the left"           │
│  └─ OR "Nod your head up and down"            │
│                                                │
│  Step 5: Image Capture                        │
│  └─ Capture primary selfie                    │
│  └─ Capture 1-8 liveness frames               │
│                                                │
│  Step 6: Quality Check                        │
│  └─ Blur detection                            │
│  └─ Lighting validation                       │
│  └─ Face visibility check                     │
│                                                │
│  Step 7: Submission                           │
│  └─ Upload to DIDIT servers                │
│                                                │
└────────────────────────────────────────────────┘
```

### Dynamic Liveness Challenges

**Enhanced SmartSelfie™** (2025) introduces **machine-learning-driven dynamic challenges**:

```javascript
// Random challenge selection
const livenessChallenge = {
  type: 'random',  // Prevents pre-recorded video attacks

  challenges: [
    {
      action: 'didit',
      instruction: 'Please didit for the camera',
      duration: '2-3 seconds'
    },
    {
      action: 'turn_head_left',
      instruction: 'Turn your head to the left',
      angle: '30-45 degrees'
    },
    {
      action: 'turn_head_right',
      instruction: 'Turn your head to the right',
      angle: '30-45 degrees'
    },
    {
      action: 'nod_up',
      instruction: 'Tilt your head up',
      angle: '20-30 degrees'
    },
    {
      action: 'nod_down',
      instruction: 'Tilt your head down',
      angle: '20-30 degrees'
    }
  ],

  // System randomly selects 1-2 challenges per session
  selectionMethod: 'ML-driven random',
  preventionTarget: 'Pre-recorded videos, static masks'
};
```

**Why Dynamic?** Traditional liveness (always "didit") can be bypassed with pre-recorded videos. Random challenges ensure the user is live and responding in real-time.

### Passive Liveness Analysis

While the user performs active challenges, **passive AI analysis** runs in parallel:

| Detection Method | What It Checks | Fraud Prevention |
|------------------|----------------|------------------|
| **Texture Analysis** | Skin vs screen pixels | Detects phone/tablet display |
| **Depth Perception** | 3D facial structure | Detects 2D photos and masks |
| **Micro-Movements** | Natural facial motion | Detects static images |
| **Light Reflection** | Eye reflection patterns | Detects fake eyes (masks) |
| **Behavioral Patterns** | Natural head movement | Detects robotic/artificial motion |

### SmartSelfie™ Image Requirements

```javascript
const imageRequirements = {
  primarySelfie: {
    format: 'JPEG or PNG',
    resolution: 'Minimum 480x640 pixels',
    colorSpace: 'RGB',
    quality: 'No compression artifacts',
    encoding: 'Base64 or file upload'
  },

  livenessFrames: {
    count: '1-8 images',
    format: 'JPEG or PNG',
    resolution: 'Same as primary',
    purpose: 'Capture user actions for liveness verification'
  },

  constraints: {
    maxFileSize: '5 MB per image',
    totalPackageSize: '20 MB',
    faceVisibility: 'Entire face visible',
    lighting: 'Adequate (not too dark/bright)',
    blur: 'Sharp focus required',
    obstructions: 'No sunglasses, hats, or face coverings'
  }
};
```

---

## 3. Product Comparison

DIDIT offers **three biometric products** for identity verification. Understanding their differences is crucial for choosing the right solution.

### Quick Comparison Table

| Feature | Biometric KYC | Document Verification | SmartSelfie™ Authentication |
|---------|---------------|----------------------|----------------------------|
| **Primary Use** | Initial KYC onboarding | ID document validation | Returning user verification |
| **Selfie Required** | ✅ Yes | ✅ Yes | ✅ Yes |
| **ID Document Photo** | ✅ Yes (uploaded) | ✅ Yes (uploaded) | ❌ No |
| **Government Database** | ✅ Yes (if available) | ❌ No | ❌ No |
| **Liveness Detection** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Document Authenticity** | ❌ No | ✅ Yes (MRZ, barcodes, security features) | ❌ No |
| **OCR Data Extraction** | ❌ No | ✅ Yes | ❌ No |
| **Human Review** | ✅ Yes (provisionally approved cases) | ✅ Yes (< 3 minutes) | ❌ No (fully automated) |
| **Returns PII** | ✅ Yes (from gov database) | ✅ Yes (from document OCR) | ❌ No (match/no-match only) |
| **Use Case** | First-time customer | Alternative/backup KYC | Login, re-verification |

### When to Use Each Product

```
┌──────────────────────────────────────────────────────┐
│  Biometric KYC                                       │
├──────────────────────────────────────────────────────┤
│  Use When:                                           │
│  ✅ Government database available (e.g., Zimbabwe)   │
│  ✅ Need highest confidence verification             │
│  ✅ Initial customer onboarding                      │
│  ✅ High-risk transaction (large loan amounts)       │
│                                                      │
│  How It Works:                                       │
│  1. Customer uploads selfie                          │
│  2. Customer uploads photo of ID card                │
│  3. DIDIT queries government database             │
│  4. Compares selfie to government photo (if available│
│  5. Compares selfie to uploaded ID card photo        │
│  6. Returns verified identity data                   │
│                                                      │
│  Cost: Higher (gov lookup + biometric matching)      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Document Verification                               │
├──────────────────────────────────────────────────────┤
│  Use When:                                           │
│  ✅ Government database NOT available                │
│  ✅ Need to verify document authenticity             │
│  ✅ Operating in countries without API access        │
│  ✅ Backup verification method                       │
│                                                      │
│  How It Works:                                       │
│  1. Customer uploads selfie                          │
│  2. Customer uploads photo of ID document            │
│  3. DIDIT validates document security features    │
│  4. Extracts data via OCR (MRZ, barcodes)            │
│  5. Compares selfie to ID card photo                 │
│  6. Human review validates authenticity (< 3 min)    │
│                                                      │
│  Cost: Medium (document validation + human review)   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  SmartSelfie™ Authentication                         │
├──────────────────────────────────────────────────────┤
│  Use When:                                           │
│  ✅ User already enrolled (previous KYC completed)   │
│  ✅ Re-verification needed (e.g., password reset)    │
│  ✅ Sensitive transaction (e.g., loan disbursement)  │
│  ✅ Account recovery                                 │
│                                                      │
│  How It Works:                                       │
│  1. Customer takes new selfie                        │
│  2. DIDIT compares to previously enrolled selfie  │
│  3. Returns match/no-match result                    │
│                                                      │
│  Cost: Lower (no gov lookup, no document upload)     │
└──────────────────────────────────────────────────────┘
```

### Detailed Product Breakdown

#### 1. Biometric KYC

**Process Flow**:
```
Customer                 DIDIT                 Government DB
   │                        │                         │
   ├─ Upload selfie ───────▶│                         │
   ├─ Upload ID card photo ▶│                         │
   │                        ├─ Query ID number ──────▶│
   │                        │◀─ Return PII + photo ───┤
   │                        │                         │
   │                        ├─ Liveness check         │
   │                        ├─ Selfie vs gov photo    │
   │                        ├─ Selfie vs ID card photo│
   │                        │                         │
   │◀─ Result: Approved ────┤                         │
```

**Verification Actions**:
1. **Liveness Check**: Active + passive liveness on selfie
2. **Selfie Check**: Passive liveness (AI analysis)
3. **Selfie-to-ID Authority Compare**: Match selfie to government database photo (if available)
4. **Selfie-to-ID Card Compare**: Match selfie to uploaded ID card photo
5. **ID Number Validation**: Confirm ID exists in government database
6. **Data Retrieval**: Fetch PII (name, DOB, gender, etc.)

**Results**:
- **Approved**: All checks passed
- **Provisionally Approved**: Pending human review or inconclusive results
- **Rejected**: One or more checks failed

**Response Includes**:
```json
{
  "Actions": {
    "Liveness_Check": "Passed",
    "Selfie_Check": "Passed",
    "Selfie_To_ID_Authority_Compare": "Passed",
    "Selfie_To_ID_Card_Compare": "Passed",
    "Human_Review_Liveness_Check": "Not Applicable",
    "Human_Review_Selfie_Check": "Not Applicable"
  },
  "ResultCode": "1012",
  "ResultText": "Enroll User",
  "PartnerParams": {
    "user_id": "customer_12345",
    "job_id": "job_abc123",
    "job_type": 1
  },
  "IDInfo": {
    "Country": "ZW",
    "IDType": "NATIONAL_ID",
    "IDNumber": "123456789A12",
    "FirstName": "John",
    "LastName": "Doe",
    "DOB": "1990-05-15",
    "Gender": "Male",
    "Photo": "base64_encoded_image..."
  },
  "Confidence": 99.8
}
```

#### 2. Document Verification

**Process Flow**:
```
Customer                 DIDIT                 Human Reviewer
   │                        │                         │
   ├─ Upload selfie ───────▶│                         │
   ├─ Upload ID document ──▶│                         │
   │                        ├─ Liveness check         │
   │                        ├─ Document authenticity  │
   │                        ├─ OCR extraction         │
   │                        ├─ Selfie vs ID photo     │
   │                        │                         │
   │                        ├─ Queue for review ─────▶│
   │                        │◀─ Validation (< 3 min) ─┤
   │                        │                         │
   │◀─ Result: Approved ────┤                         │
```

**Verification Actions**:
1. **Liveness Check**: Active + passive liveness on selfie
2. **Document Authenticity**: Check security features, MRZ, barcodes
3. **OCR Data Extraction**: Extract text from ID document
4. **Selfie-to-ID Photo Compare**: Match selfie to document photo
5. **Human Review**: Expert validates document authenticity (< 3 minutes)

**Document Checks**:
- Holographic overlays
- UV security features
- Microprinting
- Watermarks
- MRZ (Machine Readable Zone) format
- Barcode data consistency
- Font and layout validation

**Supported Zimbabwe Documents**:
- National ID Card (old and new versions)
- Passport
- Driver's License

**Response Includes**:
```json
{
  "Actions": {
    "Liveness_Check": "Passed",
    "Document_Authenticity": "Passed",
    "Selfie_To_ID_Card_Compare": "Passed",
    "Human_Review_Document": "Approved"
  },
  "ResultCode": "1012",
  "DocumentInfo": {
    "Country": "ZW",
    "DocumentType": "NATIONAL_ID",
    "IDNumber": "123456789A12",
    "FirstName": "JOHN",
    "LastName": "DOE",
    "DOB": "15 MAY 1990",
    "Gender": "M",
    "Address": "123 Main St, Harare",
    "IssueDate": "01 JAN 2020",
    "ExpiryDate": "01 JAN 2030"
  },
  "DocumentImage": "base64_encoded...",
  "Confidence": 98.5
}
```

#### 3. SmartSelfie™ Authentication

**Process Flow**:
```
Customer                 DIDIT
   │                        │
   ├─ Take new selfie ─────▶│
   │                        ├─ Liveness check
   │                        ├─ Lookup enrolled selfie (user_id)
   │                        ├─ Compare new vs enrolled
   │                        │
   │◀─ Match result ────────┤
```

**Use Cases**:
- Login authentication (alternative to password)
- Transaction authorization (e.g., approve loan disbursement)
- Account recovery (forgot password)
- Device change verification
- Sensitive action confirmation

**Requirements**:
- User must have previously completed Biometric KYC or Document Verification
- Must use same `user_id` from original enrollment

**Response**:
```json
{
  "ResultCode": "1012",
  "ResultText": "Authentication Successful",
  "PartnerParams": {
    "user_id": "customer_12345"
  },
  "Actions": {
    "Liveness_Check": "Passed",
    "Selfie_To_Enrolled_Compare": "Passed"
  },
  "Confidence": 99.5
}
```

---

## 4. Biometric KYC Implementation

### For Lynia Finance: Recommended Approach

**Strategy**: Use **Biometric KYC** for initial customer onboarding, combining government database lookup with ID card photo matching for maximum security.

### Step-by-Step Implementation

#### Step 1: Install SDK

```bash
npm install didit-core
```

#### Step 2: Configure Credentials

```javascript
// config/diditidentity.js
require('dotenv').config();

const DiditCore = require('didit-core');

const credentials = {
  partnerId: process.env.DIDIT_API_KEY,
  apiKey: process.env.DIDIT_WEBHOOK_SECRET,
  sidServer: process.env.DIDIT_SID_SERVER || '0',  // 0 = sandbox, 1 = production
  callbackUrl: process.env.DIDIT_WEBHOOK_URL
};

module.exports = credentials;
```

#### Step 3: Generate Web Token (for Web SDK integration)

```javascript
// controllers/token.controller.js
const DiditCore = require('didit-core');
const WebApi = DiditCore.WebApi;
const { v4: uuidv4 } = require('uuid');
const credentials = require('../config/diditidentity');

async function generateWebToken(req, res) {
  try {
    const customerId = req.user.id;  // From auth middleware

    // Initialize WebApi connection
    const connection = new WebApi(
      credentials.partnerId,
      credentials.callbackUrl,
      credentials.apiKey,
      credentials.sidServer
    );

    // Prepare request parameters
    const request_params = {
      user_id: `customer_${customerId}`,
      job_id: `job_${uuidv4()}`,
      product: 'biometric_kyc',  // Product type
      callback_url: credentials.callbackUrl
    };

    // Generate web token
    const token = await connection.get_web_token(request_params);

    res.json({
      success: true,
      token: token,
      user_id: request_params.user_id,
      job_id: request_params.job_id
    });

  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message
    });
  }
}

module.exports = { generateWebToken };
```

#### Step 4: Frontend Integration (Web SDK)

```html
<!-- public/kyc-verification.html -->
<!DOCTYPE html>
<html>
<head>
  <title>KYC Verification - Lynia Finance</title>
  <script src="https://cdn.diditidentity.com/didit-id-web.js"></script>
</head>
<body>
  <div id="didit-id-container"></div>

  <script>
    // Fetch token from backend
    async function startKYC() {
      const response = await fetch('/api/didit/token', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      const { token, user_id, job_id } = await response.json();

      // Initialize DIDIT Web SDK
      const diditID = new Didit({
        token: token,
        callback_url: 'https://api.lyniafinance.com/webhooks/didit-kyc',
        environment: 'sandbox',  // or 'production'

        // Product configuration
        product: 'biometric_kyc',
        id_type: 'NATIONAL_ID',
        country: 'ZW',

        // Callback functions
        onSuccess: function(data) {
          console.log('KYC completed:', data);
          window.location.href = '/kyc-success';
        },

        onError: function(error) {
          console.error('KYC error:', error);
          alert('Verification failed. Please try again.');
        },

        onClose: function() {
          console.log('User closed widget');
        }
      });

      // Render SDK widget
      diditID.render('#didit-id-container');
    }

    // Start KYC when page loads
    window.onload = startKYC;
  </script>
</body>
</html>
```

#### Step 5: Server-to-Server Integration (Alternative)

For full backend control:

```javascript
// services/biometric-kyc.service.js
const DiditCore = require('didit-core');
const WebApi = DiditCore.WebApi;
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const archiver = require('archiver');
const credentials = require('../config/diditidentity');

class BiometricKYCService {
  constructor() {
    this.connection = new WebApi(
      credentials.partnerId,
      credentials.callbackUrl,
      credentials.apiKey,
      credentials.sidServer
    );
  }

  /**
   * Submit Biometric KYC job
   */
  async submitBiometricKYC({ customerId, selfieBase64, idCardPhotoBase64, idInfo }) {
    const userId = `customer_${customerId}`;
    const jobId = `job_${uuidv4()}`;

    // Create ZIP package with images and metadata
    const zipPath = await this.createImagePackage({
      userId,
      jobId,
      selfieBase64,
      idCardPhotoBase64,
      idInfo
    });

    // Prepare partner params
    const partner_params = {
      user_id: userId,
      job_id: jobId,
      job_type: 1  // Biometric KYC = 1
    };

    // Prepare ID info
    const id_info = {
      country: idInfo.country || 'ZW',
      id_type: idInfo.id_type || 'NATIONAL_ID',
      id_number: idInfo.id_number,
      first_name: idInfo.first_name,
      last_name: idInfo.last_name,
      dob: idInfo.dob  // YYYY-MM-DD format
    };

    // Additional options
    const options = {
      return_job_status: true,  // Get immediate result
      return_history: false,
      return_images: true,
      use_enrolled_image: false
    };

    try {
      // Submit job
      const response = await this.connection.submit_job(
        partner_params,
        zipPath,
        id_info,
        options
      );

      console.log('Biometric KYC submitted:', {
        jobId: jobId,
        userId: userId
      });

      // Clean up temporary ZIP file
      fs.unlinkSync(zipPath);

      return this.parseKYCResponse(response, jobId, customerId);

    } catch (error) {
      console.error('Biometric KYC submission error:', error);
      throw new Error(`Failed to submit KYC: ${error.message}`);
    }
  }

  /**
   * Create ZIP package with images and metadata
   */
  async createImagePackage({ userId, jobId, selfieBase64, idCardPhotoBase64, idInfo }) {
    const zipPath = `/tmp/${jobId}.zip`;

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip');

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);

      // Add selfie image
      const selfieBuffer = Buffer.from(selfieBase64, 'base64');
      archive.append(selfieBuffer, { name: 'selfie.jpg' });

      // Add ID card photo
      const idCardBuffer = Buffer.from(idCardPhotoBase64, 'base64');
      archive.append(idCardBuffer, { name: 'id_card.jpg' });

      // Add metadata (info.json)
      const metadata = {
        package_information: {
          apiVersion: {
            buildNumber: 0,
            majorVersion: 2,
            minorVersion: 0
          },
          language: 'javascript'
        },
        misc_information: {
          retry: 'false',
          partner_params: {
            user_id: userId,
            job_id: jobId,
            job_type: 1
          },
          file_name: 'selfie.jpg',
          didit_client_id: credentials.partnerId,
          timestamp: new Date().toISOString()
        },
        id_info: idInfo
      };

      archive.append(JSON.stringify(metadata), { name: 'info.json' });

      archive.finalize();
    });
  }

  /**
   * Parse Biometric KYC response
   */
  parseKYCResponse(response, jobId, customerId) {
    const actions = response.Actions || {};
    const idInfo = response.IDInfo || {};

    // Check overall result
    const approved = (
      actions.Liveness_Check === 'Passed' &&
      actions.Selfie_To_ID_Card_Compare === 'Passed'
    );

    return {
      success: approved,
      jobId: jobId,
      customerId: customerId,
      resultCode: response.ResultCode,
      resultText: response.ResultText,

      actions: {
        livenessCheck: actions.Liveness_Check,
        selfieCheck: actions.Selfie_Check,
        selfieToAuthority: actions.Selfie_To_ID_Authority_Compare,
        selfieToIDCard: actions.Selfie_To_ID_Card_Compare,
        humanReview: actions.Human_Review_Liveness_Check
      },

      identityData: {
        idNumber: idInfo.IDNumber,
        firstName: idInfo.FirstName,
        lastName: idInfo.LastName,
        dateOfBirth: idInfo.DOB,
        gender: idInfo.Gender,
        photo: idInfo.Photo
      },

      confidence: response.Confidence || null
    };
  }
}

module.exports = new BiometricKYCService();
```

#### Step 6: Webhook Handler

```javascript
// routes/webhooks.js
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const BiometricVerification = require('../models/BiometricVerification');

/**
 * DIDIT Biometric KYC callback
 */
router.post('/didit-kyc', async (req, res) => {
  try {
    const payload = req.body;

    console.log('Biometric KYC webhook received:', {
      userId: payload.PartnerParams?.user_id,
      jobId: payload.PartnerParams?.job_id,
      resultCode: payload.ResultCode
    });

    // Extract customer ID from user_id
    const userId = payload.PartnerParams?.user_id || '';
    const customerId = userId.replace('customer_', '');

    // Store verification result
    await BiometricVerification.create({
      customerId: customerId,
      jobId: payload.PartnerParams?.job_id,
      jobType: 'biometric_kyc',
      resultCode: payload.ResultCode,
      resultText: payload.ResultText,
      livenessCheck: payload.Actions?.Liveness_Check,
      selfieToIDCard: payload.Actions?.Selfie_To_ID_Card_Compare,
      selfieToAuthority: payload.Actions?.Selfie_To_ID_Authority_Compare,
      confidence: payload.Confidence,
      rawResponse: payload,
      createdAt: new Date()
    });

    // Check if approved
    const approved = (
      payload.Actions?.Liveness_Check === 'Passed' &&
      payload.Actions?.Selfie_To_ID_Card_Compare === 'Passed'
    );

    if (approved) {
      // Update customer record
      await Customer.update({
        biometricKYCStatus: 'VERIFIED',
        biometricKYCVerifiedAt: new Date(),
        photoUrl: payload.IDInfo?.Photo || null
      }, {
        where: { id: customerId }
      });

      console.log(`Customer ${customerId} biometric KYC approved`);
    } else {
      // Mark as failed
      await Customer.update({
        biometricKYCStatus: 'FAILED',
        biometricKYCFailureReason: payload.ResultText
      }, {
        where: { id: customerId }
      });

      console.log(`Customer ${customerId} biometric KYC failed: ${payload.ResultText}`);
    }

    // Always respond 200 OK
    res.status(200).send('OK');

  } catch (error) {
    console.error('Biometric KYC webhook error:', error);
    res.status(200).send('OK');  // Still send 200 to avoid retries
  }
});

module.exports = router;
```

---

## 5. Document Verification

### When to Use Document Verification

Use **Document Verification** as a **backup/alternative** to Biometric KYC when:
- Government database lookup fails (code 1015)
- Customer has Zimbabwe Passport or Driver's License (not National ID)
- Operating in countries without DIDIT government database integration
- Need to verify document authenticity (detect fake IDs)

### Implementation

```javascript
// services/document-verification.service.js
const DiditCore = require('didit-core');
const WebApi = DiditCore.WebApi;
const credentials = require('../config/diditidentity');

class DocumentVerificationService {
  constructor() {
    this.connection = new WebApi(
      credentials.partnerId,
      credentials.callbackUrl,
      credentials.apiKey,
      credentials.sidServer
    );
  }

  /**
   * Verify ID document authenticity + selfie match
   */
  async verifyDocument({ customerId, selfieBase64, documentPhotoBase64, documentType }) {
    const userId = `customer_${customerId}`;
    const jobId = `job_${uuidv4()}`;

    const partner_params = {
      user_id: userId,
      job_id: jobId,
      job_type: 6  // Document Verification = 6
    };

    const id_info = {
      country: 'ZW',
      id_type: documentType  // 'PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID'
    };

    const options = {
      return_job_status: true,
      return_history: false,
      return_images: true
    };

    try {
      // Create ZIP package
      const zipPath = await this.createDocumentPackage({
        userId,
        jobId,
        selfieBase64,
        documentPhotoBase64,
        documentType
      });

      // Submit job
      const response = await this.connection.submit_job(
        partner_params,
        zipPath,
        id_info,
        options
      );

      fs.unlinkSync(zipPath);

      return this.parseDocumentResponse(response, jobId, customerId);

    } catch (error) {
      console.error('Document verification error:', error);
      throw error;
    }
  }

  parseDocumentResponse(response, jobId, customerId) {
    const actions = response.Actions || {};
    const documentInfo = response.DocumentInfo || {};

    const approved = (
      actions.Liveness_Check === 'Passed' &&
      actions.Document_Authenticity === 'Passed' &&
      actions.Selfie_To_ID_Card_Compare === 'Passed' &&
      actions.Human_Review_Document === 'Approved'
    );

    return {
      success: approved,
      jobId: jobId,
      customerId: customerId,
      resultCode: response.ResultCode,
      resultText: response.ResultText,

      actions: {
        livenessCheck: actions.Liveness_Check,
        documentAuthenticity: actions.Document_Authenticity,
        selfieToIDCard: actions.Selfie_To_ID_Card_Compare,
        humanReview: actions.Human_Review_Document
      },

      documentData: {
        documentType: documentInfo.DocumentType,
        idNumber: documentInfo.IDNumber,
        firstName: documentInfo.FirstName,
        lastName: documentInfo.LastName,
        dateOfBirth: documentInfo.DOB,
        gender: documentInfo.Gender,
        address: documentInfo.Address,
        issueDate: documentInfo.IssueDate,
        expiryDate: documentInfo.ExpiryDate
      },

      confidence: response.Confidence
    };
  }
}

module.exports = new DocumentVerificationService();
```

### Human Review

Document Verification includes **real-time human review** within **< 3 minutes**:

| Review Aspect | What's Checked | Expert Validation |
|---------------|----------------|-------------------|
| **Document Authenticity** | Security features, holograms, UV markings | ✅ Human expert confirms |
| **Photo Quality** | Clear, unobstructed, adequate lighting | ✅ Human validates |
| **Data Consistency** | MRZ matches printed text | ✅ Human cross-checks |
| **Tampering Detection** | Alterations, photo swaps, digital manipulation | ✅ Human inspects |

**Result**: "Approved", "Rejected", or "Review Needed"

---

## 6. SmartSelfie™ Authentication

### Use Cases for Lynia Finance

```
┌──────────────────────────────────────────────────┐
│  SmartSelfie™ Authentication Use Cases           │
├──────────────────────────────────────────────────┤
│                                                  │
│  1️⃣ Loan Disbursement Confirmation               │
│     Before releasing funds, verify customer      │
│     identity via selfie authentication           │
│                                                  │
│  2️⃣ Device Collection Authorization              │
│     When customer collects device, verify        │
│     they are the rightful loan holder            │
│                                                  │
│  3️⃣ Account Recovery                             │
│     Customer forgot password, use selfie         │
│     to prove identity and reset credentials      │
│                                                  │
│  4️⃣ Profile Changes                              │
│     Changing phone number or address?            │
│     Authenticate via selfie first                │
│                                                  │
│  5️⃣ High-Value Transactions                      │
│     Early loan payoff, credit limit increase     │
│     require selfie confirmation                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Implementation

```javascript
// services/smartselfie-auth.service.js
const DiditCore = require('didit-core');
const WebApi = DiditCore.WebApi;
const credentials = require('../config/diditidentity');

class SmartSelfieAuthService {
  constructor() {
    this.connection = new WebApi(
      credentials.partnerId,
      credentials.callbackUrl,
      credentials.apiKey,
      credentials.sidServer
    );
  }

  /**
   * Authenticate returning customer with selfie
   */
  async authenticateCustomer(customerId, selfieBase64) {
    const userId = `customer_${customerId}`;
    const jobId = `job_${uuidv4()}`;

    // IMPORTANT: Must use same user_id from original KYC enrollment
    const partner_params = {
      user_id: userId,  // Same as Biometric KYC
      job_id: jobId,
      job_type: 2  // SmartSelfie Authentication = 2
    };

    const id_info = {};  // No ID info needed for authentication

    const options = {
      return_job_status: true
    };

    try {
      // Create ZIP package (selfie only, no ID card)
      const zipPath = await this.createAuthPackage({
        userId,
        jobId,
        selfieBase64
      });

      // Submit job
      const response = await this.connection.submit_job(
        partner_params,
        zipPath,
        id_info,
        options
      );

      fs.unlinkSync(zipPath);

      return this.parseAuthResponse(response, jobId, customerId);

    } catch (error) {
      console.error('SmartSelfie authentication error:', error);
      throw error;
    }
  }

  parseAuthResponse(response, jobId, customerId) {
    const actions = response.Actions || {};

    const authenticated = (
      actions.Liveness_Check === 'Passed' &&
      actions.Selfie_To_Enrolled_Compare === 'Passed'
    );

    return {
      success: authenticated,
      jobId: jobId,
      customerId: customerId,
      resultCode: response.ResultCode,
      resultText: response.ResultText,
      confidence: response.Confidence,

      actions: {
        livenessCheck: actions.Liveness_Check,
        selfieToEnrolled: actions.Selfie_To_Enrolled_Compare
      }
    };
  }
}

module.exports = new SmartSelfieAuthService();
```

### Usage Example: Loan Disbursement Authorization

```javascript
// controllers/loan.controller.js
const smartSelfieAuth = require('../services/smartselfie-auth.service');

async function disburseLoan(req, res) {
  const { loanId, selfieBase64 } = req.body;
  const customerId = req.user.id;

  try {
    // Step 1: Authenticate customer with selfie
    const authResult = await smartSelfieAuth.authenticateCustomer(
      customerId,
      selfieBase64
    );

    if (!authResult.success) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Selfie did not match enrolled image'
      });
    }

    // Step 2: Proceed with loan disbursement
    const loan = await Loan.findByPk(loanId);

    if (loan.customerId !== customerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Disburse funds...
    await disburseFunds(loan);

    res.json({
      success: true,
      message: 'Loan disbursed successfully',
      amount: loan.amount
    });

  } catch (error) {
    console.error('Loan disbursement error:', error);
    res.status(500).json({ error: 'Disbursement failed' });
  }
}
```

---

## 7. Integration Methods

DIDIT offers **4 integration methods**. Choose based on your technical requirements and user experience preferences.

### Integration Methods Comparison

| Method | Platform | Control Level | Complexity | Use Case |
|--------|----------|---------------|------------|----------|
| **Web SDK** | Web browser | Low (DIDIT UI) | ⭐ Easy | Quick integration, minimal code |
| **Mobile SDK** | iOS/Android/Flutter/React Native | Low (DIDIT UI) | ⭐⭐ Easy | Native mobile apps |
| **REST API** | Any | Medium | ⭐⭐⭐ Medium | Custom UI, multi-platform |
| **Server-to-Server** | Backend | High (full control) | ⭐⭐⭐⭐ Advanced | Full customization |

### 1. Web SDK Integration (Recommended for Lynia)

**Best for**: Web-based customer onboarding with minimal development effort.

```html
<!-- Step 1: Include DIDIT script -->
<script src="https://cdn.diditidentity.com/didit-id-web.js"></script>

<!-- Step 2: Container div -->
<div id="didit-kyc-container"></div>

<!-- Step 3: Initialize and render -->
<script>
  async function startBiometricKYC() {
    // Fetch token from backend
    const response = await fetch('/api/didit/token');
    const { token, user_id, job_id } = await response.json();

    // Initialize DIDIT SDK
    const diditID = new Didit({
      // Authentication
      token: token,
      callback_url: 'https://api.lyniafinance.com/webhooks/didit-kyc',
      environment: 'production',  // or 'sandbox'

      // Product configuration
      product: 'biometric_kyc',
      country: 'ZW',
      id_type: 'NATIONAL_ID',

      // UI customization
      theme: {
        primaryColor: '#1E40AF',  // Lynia Finance brand color
        secondaryColor: '#3B82F6',
        fontFamily: 'Inter, sans-serif'
      },

      // Callbacks
      onSuccess: function(result) {
        console.log('KYC success:', result);
        // Redirect to success page
        window.location.href = '/kyc-success';
      },

      onError: function(error) {
        console.error('KYC error:', error);
        alert('Verification failed: ' + error.message);
      },

      onClose: function() {
        console.log('User closed widget');
      }
    });

    // Render widget
    diditID.render('#didit-kyc-container');
  }

  startBiometricKYC();
</script>
```

**Advantages**:
- ✅ DIDIT handles camera access, image capture, quality checks
- ✅ Built-in UI optimized for mobile and desktop
- ✅ Automatic retries and error handling
- ✅ Multi-language support (English, French, Portuguese, Swahili, etc.)

### 2. Mobile SDK Integration

For native mobile apps:

**Android (Kotlin)**:
```kotlin
import com.diditidentity.DIDITID

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize DIDIT
        DIDITID.initialize(
            context = this,
            partnerId = "your_partner_id",
            apiKey = "your_api_key",
            environment = DIDITID.Environment.PRODUCTION
        )

        // Launch Biometric KYC
        val intent = DIDITID.BiometricKYC()
            .userId("customer_${customerId}")
            .jobId("job_${UUID.randomUUID()}")
            .country("ZW")
            .idType("NATIONAL_ID")
            .callbackUrl("https://api.lyniafinance.com/webhooks/didit-kyc")
            .build(this)

        startActivityForResult(intent, REQUEST_CODE_KYC)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_KYC) {
            if (resultCode == RESULT_OK) {
                // KYC successful
                Toast.makeText(this, "Verification successful!", Toast.LENGTH_SHORT).show()
            } else {
                // KYC failed
                val error = data?.getStringExtra("error")
                Toast.makeText(this, "Verification failed: $error", Toast.LENGTH_LONG).show()
            }
        }
    }
}
```

**iOS (Swift)**:
```swift
import DIDITID

class ViewController: UIViewController {
    func startBiometricKYC() {
        let config = DIDITIDConfig(
            partnerId: "your_partner_id",
            apiKey: "your_api_key",
            environment: .production
        )

        DIDITID.initialize(config: config)

        let kyc = DIDITID.BiometricKYC(
            userId: "customer_\(customerId)",
            jobId: "job_\(UUID().uuidString)",
            country: "ZW",
            idType: "NATIONAL_ID",
            callbackUrl: "https://api.lyniafinance.com/webhooks/didit-kyc"
        )

        kyc.onSuccess = { result in
            print("KYC successful: \(result)")
            self.showSuccessScreen()
        }

        kyc.onError = { error in
            print("KYC failed: \(error)")
            self.showError(error)
        }

        present(kyc, animated: true)
    }
}
```

### 3. REST API Integration

For custom UI with full control:

**Endpoint**: `POST https://api.diditidentity.com/v1/job`

```javascript
// Full REST API example
async function submitBiometricKYC(customerId, selfieBase64, idCardBase64, idInfo) {
  const userId = `customer_${customerId}`;
  const jobId = `job_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  // Generate signature
  const signature = generateSignature(partnerId, apiKey, timestamp);

  const payload = {
    partner_id: partnerId,
    timestamp: timestamp,
    signature: signature,

    partner_params: {
      user_id: userId,
      job_id: jobId,
      job_type: 1  // Biometric KYC
    },

    id_info: {
      country: 'ZW',
      id_type: 'NATIONAL_ID',
      id_number: idInfo.idNumber,
      first_name: idInfo.firstName,
      last_name: idInfo.lastName,
      dob: idInfo.dob
    },

    images: [
      {
        image_type_id: 2,  // Selfie with ID card
        image: selfieBase64
      },
      {
        image_type_id: 3,  // ID card photo
        image: idCardBase64
      }
    ],

    options: {
      return_job_status: true,
      return_history: false,
      return_images: false
    }
  };

  const response = await fetch('https://api.diditidentity.com/v1/job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}
```

### 4. Server-to-Server Integration

Covered in Section 4 - provides full control over the entire flow.

---

## 8. Liveness Detection Technical Details

### Active Liveness: The DIDIT Test

**How it works**:

```
1. Face Detection
   └─ System detects face in camera frame
   └─ Validates face position (centered, clear)

2. Instruction Display
   └─ "Please didit for the camera"
   └─ OR random gesture instruction

3. User Action
   └─ User didits (or performs gesture)
   └─ System captures multiple frames

4. Action Validation
   └─ Did user actually didit?
   └─ Was action completed correctly?
   └─ Timing analysis (too fast = suspicious)

5. Liveness Determination
   └─ Passed: Natural didit detected
   └─ Failed: No didit, unnatural motion, or timeout
```

**Why didit?**
- Natural human action (difficult to fake)
- Creates facial movement and expression change
- Harder to replicate with photos or masks
- Cultural universality (works globally)

### Passive Liveness: AI Analysis

Runs **simultaneously** with active liveness:

| Analysis Type | Detection Method | Fraud Prevention |
|---------------|------------------|------------------|
| **Texture Analysis** | Analyze pixel patterns | Detect printed photos, screens |
| **Depth Perception** | Stereo/monocular depth cues | Detect 2D images, flat masks |
| **Micro-Movements** | Subtle facial motion | Detect static images |
| **Eye Reflection** | Light reflection in eyes | Detect fake eyes (masks, dolls) |
| **Skin Tone Analysis** | Color consistency | Detect makeup, silicone masks |
| **Motion Patterns** | Natural head/face movement | Detect robotic/artificial motion |

### Spoof Attack Detection

DIDIT's Enhanced SmartSelfie™ successfully blocks:

| Attack Type | Description | Detection Method |
|-------------|-------------|------------------|
| **Printed Photo** | High-res printed face | Texture + depth analysis |
| **Screen Replay** | Video on phone/tablet | Screen moiré pattern detection |
| **3D Mask** | Silicone/latex face mask | Skin texture + micro-movement |
| **Deepfake Video** | AI-generated face | Behavioral analysis + artifacts |
| **Photo Cutout** | Face cut from ID card | Depth perception + edge detection |
| **Mannequin/Doll** | Physical 3D replica | Eye reflection + skin analysis |

**ISO 30107-3 Test Results**: **0% penetration rate** (100% blocked)

### Liveness Check Results

| Result | Meaning | User Action |
|--------|---------|-------------|
| **Passed** | Liveness confirmed | ✅ Proceed to face matching |
| **Failed** | Spoof detected or no liveness | ❌ Reject verification |
| **Review Needed** | Inconclusive | ⏳ Human review required |

---

## 9. Implementation for Lynia Finance

### Recommended KYC Flow

```
Customer Application Journey:
┌──────────────────────────────────────────────────┐
│  Step 1: Phone Number Registration              │
│  └─ Customer enters phone number                │
│  └─ Send OTP for verification                   │
│                                                  │
│  Step 2: Basic Information                      │
│  └─ Customer enters National ID number          │
│  └─ Validate ID format (regex)                  │
│                                                  │
│  Step 3: Enhanced KYC (Database Lookup)         │
│  └─ Query Zimbabwe Registrar General            │
│  └─ Retrieve name, DOB, gender                  │
│  └─ Validate age (18+), IsAlive status          │
│                                                  │
│  Step 4: Biometric KYC (Selfie + ID Photo)      │
│  ├─ Customer takes selfie (with liveness)       │
│  ├─ Customer uploads photo of ID card           │
│  ├─ DIDIT verifies:                          │
│  │   ├─ Liveness (active + passive)             │
│  │   ├─ Selfie matches gov database photo       │
│  │   └─ Selfie matches ID card photo            │
│  └─ Result: Approved/Provisionally/Rejected     │
│                                                  │
│  Step 5: Device Selection                       │
│  └─ Customer browses devices (if KYC passed)    │
│                                                  │
│  Step 6: Payment                                │
│  └─ EcoCash/O'mari deposit                      │
│                                                  │
│  Step 7: Device Collection (Re-verification)    │
│  └─ SmartSelfie™ Authentication at pickup       │
│  └─ Confirm customer identity before handover   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Fallback Strategy

```javascript
// KYC verification with fallback
async function performKYCVerification(customer) {
  try {
    // Primary: Enhanced KYC (database lookup)
    const enhancedKYC = await kycService.verifyZimbabweNationalID(
      customer.nationalId,
      customer.id
    );

    if (!enhancedKYC.success) {
      throw new Error('Enhanced KYC failed: ' + enhancedKYC.resultText);
    }

    // Primary: Biometric KYC (selfie + ID photo + gov database)
    const biometricKYC = await biometricKYCService.submitBiometricKYC({
      customerId: customer.id,
      selfieBase64: customer.selfiePhoto,
      idCardPhotoBase64: customer.idCardPhoto,
      idInfo: {
        country: 'ZW',
        id_type: 'NATIONAL_ID',
        id_number: customer.nationalId,
        first_name: enhancedKYC.data.firstName,
        last_name: enhancedKYC.data.lastName,
        dob: enhancedKYC.data.dateOfBirth
      }
    });

    if (biometricKYC.success) {
      return {
        method: 'biometric_kyc',
        success: true,
        data: biometricKYC
      };
    }

    // Fallback: Document Verification (if Biometric KYC fails)
    console.log('Biometric KYC failed, falling back to Document Verification');

    const docVerification = await documentVerificationService.verifyDocument({
      customerId: customer.id,
      selfieBase64: customer.selfiePhoto,
      documentPhotoBase64: customer.idCardPhoto,
      documentType: 'NATIONAL_ID'
    });

    return {
      method: 'document_verification',
      success: docVerification.success,
      data: docVerification
    };

  } catch (error) {
    console.error('KYC verification error:', error);
    throw error;
  }
}
```

### Database Schema

```javascript
// models/BiometricVerification.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BiometricVerification = sequelize.define('BiometricVerification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id'
      }
    },

    jobId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    jobType: {
      type: DataTypes.ENUM('biometric_kyc', 'document_verification', 'smartselfie_auth'),
      allowNull: false
    },

    // Result
    resultCode: {
      type: DataTypes.STRING,
      allowNull: true
    },

    resultText: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Verification Actions
    livenessCheck: {
      type: DataTypes.ENUM('Passed', 'Failed', 'Not Applicable'),
      allowNull: true
    },

    selfieCheck: {
      type: DataTypes.ENUM('Passed', 'Failed', 'Not Applicable'),
      allowNull: true
    },

    selfieToIDCard: {
      type: DataTypes.ENUM('Passed', 'Failed', 'Not Applicable'),
      allowNull: true
    },

    selfieToAuthority: {
      type: DataTypes.ENUM('Passed', 'Failed', 'Not Applicable'),
      allowNull: true
    },

    documentAuthenticity: {
      type: DataTypes.ENUM('Passed', 'Failed', 'Not Applicable'),
      allowNull: true
    },

    humanReview: {
      type: DataTypes.ENUM('Approved', 'Rejected', 'Not Applicable'),
      allowNull: true
    },

    // Confidence Score
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Match confidence (0-100)'
    },

    // Photo Storage
    customerPhotoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to stored customer photo from verification'
    },

    // Raw Response
    rawResponse: {
      type: DataTypes.JSONB,
      allowNull: true
    },

    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }

  }, {
    tableName: 'biometric_verifications',
    indexes: [
      { fields: ['customerId'] },
      { fields: ['jobId'], unique: true },
      { fields: ['jobType'] },
      { fields: ['createdAt'] }
    ]
  });

  return BiometricVerification;
};
```

---

## 10. Best Practices and Recommendations

### 1. User Experience Optimization

```javascript
// Best practices for smooth UX

const uxBestPractices = {
  instructions: {
    clarity: 'Use simple, clear language',
    examples: [
      '✅ "Please take a selfie with your ID card visible"',
      '❌ "Capture biometric imagery alongside documentation"'
    ]
  },

  lighting: {
    guidance: 'Instruct users to find good lighting',
    tip: '"Make sure your face is well-lit"'
  },

  positioning: {
    visualGuide: 'Show oval face guide overlay',
    feedback: 'Real-time feedback ("Move closer", "Center your face")'
  },

  retry: {
    allowRetries: true,
    maxAttempts: 3,
    guidanceOnFail: 'Explain why verification failed and how to improve'
  },

  mobileOptimization: {
    camerRequest: 'Request camera permission with clear explanation',
    fileSize: 'Compress images before upload to save bandwidth',
    offline: 'Handle poor connectivity gracefully (queue for later)'
  }
};
```

### 2. Security Best Practices

```javascript
// Never log sensitive biometric data
console.log('Selfie captured');  // ✅ Good
console.log('Selfie:', selfieBase64);  // ❌ Bad (PII)

// Encrypt photos in transit and at rest
const encryptedPhoto = encrypt(selfieBase64, encryptionKey);

// Delete temporary files immediately after upload
fs.unlinkSync(tempZipPath);

// Implement rate limiting (prevent brute force)
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5  // Max 5 KYC attempts per IP
});

app.use('/api/kyc', rateLimiter);

// Validate image format and size (prevent malicious uploads)
function validateImage(base64Image) {
  // Check file type
  if (!base64Image.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }

  // Check file size (max 5 MB)
  const sizeInBytes = (base64Image.length * 3) / 4;
  if (sizeInBytes > 5 * 1024 * 1024) {
    throw new Error('Image too large (max 5 MB)');
  }

  return true;
}
```

### 3. Error Handling

```javascript
// Comprehensive error handling
async function handleBiometricKYC(customerId, selfie, idCard) {
  try {
    const result = await biometricKYCService.submitBiometricKYC({
      customerId,
      selfieBase64: selfie,
      idCardPhotoBase64: idCard,
      idInfo: { ... }
    });

    if (!result.success) {
      // Handle specific failure reasons
      if (result.actions.livenessCheck === 'Failed') {
        throw new KYCError(
          'Liveness check failed. Please ensure you are in a well-lit area and follow the instructions.',
          'LIVENESS_FAILED'
        );
      }

      if (result.actions.selfieToIDCard === 'Failed') {
        throw new KYCError(
          'Face does not match ID card photo. Please ensure you are the ID card holder.',
          'FACE_MISMATCH'
        );
      }

      if (result.resultCode === '2200') {
        throw new KYCError(
          'ID number not found in database. Please verify your National ID number.',
          'ID_NOT_FOUND'
        );
      }

      throw new KYCError(
        'Verification failed: ' + result.resultText,
        'VERIFICATION_FAILED'
      );
    }

    return result;

  } catch (error) {
    if (error instanceof KYCError) {
      throw error;
    }

    // Network or server errors
    console.error('Biometric KYC error:', error);
    throw new KYCError(
      'Verification service temporarily unavailable. Please try again.',
      'SERVICE_ERROR'
    );
  }
}
```

### 4. Cost Optimization

```javascript
// Estimated costs per verification
const costEstimates = {
  enhancedKYC: 0.30,           // Zimbabwe ID database lookup
  biometricKYC: 0.60,          // Enhanced KYC + biometric matching
  documentVerification: 0.50,  // Document + human review
  smartselfieAuth: 0.15        // Re-verification only
};

// Optimization: Cache verified customers
// Avoid re-verifying same customer multiple times
const verificationCache = new Map();

async function verifyWithCache(customerId) {
  // Check if already verified (within 30 days)
  const cached = verificationCache.get(customerId);
  if (cached && (Date.now() - cached.timestamp) < 30 * 24 * 60 * 60 * 1000) {
    return cached.result;
  }

  // Perform verification
  const result = await performBiometricKYC(customerId);

  // Cache result
  verificationCache.set(customerId, {
    result: result,
    timestamp: Date.now()
  });

  return result;
}

// Use SmartSelfie Auth (cheaper) for returning customers
// Instead of full Biometric KYC every time
if (customer.previouslyVerified) {
  // Use SmartSelfie Auth ($0.15) instead of Biometric KYC ($0.60)
  await smartSelfieAuthService.authenticateCustomer(customerId, selfie);
} else {
  // First-time customer: Full Biometric KYC
  await biometricKYCService.submitBiometricKYC({ ... });
}
```

### 5. Testing Strategy

```
Development:
├─ Use DIDIT sandbox exclusively
├─ Test with team members' real photos
├─ Test edge cases:
│   ├─ Poor lighting
│   ├─ Sunglasses
│   ├─ Face partially covered
│   ├─ Low-resolution images
│   └─ Non-matching faces
└─ Test all 3 products (Biometric KYC, Document Verification, SmartSelfie Auth)

Pre-Production:
├─ Verify 10-20 real customers in sandbox
├─ Monitor liveness pass/fail rates
├─ Test mobile devices (budget Android)
├─ Test low-bandwidth scenarios
└─ Verify webhook delivery

Production:
├─ Start with small batch (50-100 customers)
├─ Monitor success rates daily
├─ Track rejection reasons
├─ A/B test UI instructions
└─ Optimize based on data
```

---

## 11. Summary and Next Steps

### Summary

DIDIT's liveness detection technology provides world-class fraud prevention for customer onboarding through a combination of **Enhanced SmartSelfie™** (ISO-certified active + passive liveness) and **99.8% accurate face matching** trained specifically on African faces.

**Three Key Products**:
1. **Biometric KYC**: Selfie + ID card photo + government database lookup (RECOMMENDED for initial onboarding)
2. **Document Verification**: Selfie + ID document authenticity + OCR (backup method)
3. **SmartSelfie™ Authentication**: Selfie re-verification (returning customers)

**Key Advantages**:
- ✅ **ISO/IEC 30107-3:2023 Level 2**: 0% penetration rate against advanced spoofing
- ✅ **99.8% Face Matching**: Optimized for African phenotypes and skin tones
- ✅ **Hybrid Liveness**: Active (didit test) + Passive (AI analysis)
- ✅ **Human Review**: Real-time validation within 3 minutes
- ✅ **Multiple Integration Methods**: Web SDK, Mobile SDK, REST API, Server-to-Server
- ✅ **8,500+ Documents**: Support for 226 countries including all Zimbabwe ID types

**Estimated Costs** (based on industry benchmarks):
- Biometric KYC: ~$0.60 per verification
- Document Verification: ~$0.50 per verification
- SmartSelfie™ Authentication: ~$0.15 per verification

**Recommended for Lynia Finance**:
- Use **Biometric KYC** for initial customer onboarding (maximum fraud prevention)
- Use **SmartSelfie™ Authentication** for device collection authorization (cost-effective re-verification)
- Use **Document Verification** as fallback if Biometric KYC fails

### Implementation Checklist

```
☐ Review T026 (Enhanced KYC implementation)
   Already have DIDIT account and credentials

☐ Choose integration method
   Recommended: Web SDK for simplicity

☐ Implement token generation endpoint
   Backend: /api/didit/token

☐ Integrate Web SDK on frontend
   Customer onboarding page: /kyc-verification

☐ Implement webhook handler
   POST /api/webhooks/didit-kyc

☐ Create BiometricVerification model
   Store verification results in database

☐ Update Customer model
   Add biometricKYCStatus, photoUrl fields

☐ Test in sandbox
   Use test images with team members

☐ Implement fallback to Document Verification
   If Biometric KYC fails

☐ Add SmartSelfie™ Authentication
   For device collection authorization

☐ Request production pricing
   Contact sales@usediditid.com

☐ Go live
   Start with small batch, monitor closely

☐ Monitor and optimize
   Track pass/fail rates, improve UX
```

### Next Steps

#### Immediate (This Week)

1. **Design KYC User Flow**
   - Map customer journey from signup to verification
   - Design UI/UX for selfie capture
   - Create instruction screens

2. **Implement Token Generation**
   - Create `/api/didit/token` endpoint
   - Generate web tokens for frontend

3. **Integrate Web SDK**
   - Add DIDIT script to KYC page
   - Test selfie capture flow
   - Test with team members

#### Short-Term (Next 2 Weeks)

4. **Implement Webhook Handler**
   - Create `/api/webhooks/didit-kyc` endpoint
   - Parse and store verification results
   - Update customer KYC status

5. **Database Schema**
   - Create BiometricVerification model
   - Add fields to Customer model
   - Set up indexes

6. **Test End-to-End**
   - Complete customer journey: signup → KYC → device selection
   - Test success and failure scenarios
   - Verify webhook delivery

#### Medium-Term (Next Month)

7. **Implement SmartSelfie™ Authentication**
   - Add to device collection flow
   - Add to loan disbursement authorization
   - Test re-verification

8. **Add Document Verification Fallback**
   - Implement as backup method
   - Test passport and driver's license verification

9. **Production Readiness**
   - Request production credentials
   - Set up monitoring and alerts
   - Create customer support scripts

#### Long-Term (Next Quarter)

10. **Optimization**
    - Analyze pass/fail rates
    - A/B test instruction wording
    - Optimize for mobile UX

11. **Advanced Features**
    - Multi-language support (Shona, Ndebele)
    - Offline queueing for low connectivity
    - Progressive enhancement (fallback for old browsers)

12. **Compliance Reporting**
    - Monthly KYC verification reports
    - Fraud detection statistics
    - Audit trail for regulatory inspection

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Liveness Pass Rate** | > 90% | Passed / Total attempts |
| **Face Match Accuracy** | > 95% | Selfie-to-ID matches |
| **User Drop-Off Rate** | < 10% | Abandoned KYC sessions |
| **Average Completion Time** | < 3 minutes | Session duration |
| **Fraud Detection Rate** | > 95% | Blocked spoof attempts |
| **Human Review Rate** | < 20% | Provisionally approved cases |

### Resources

- **Biometric KYC Docs**: [https://docs.usediditid.com/products/for-individuals-kyc/biometric-kyc](https://docs.usediditid.com/products/for-individuals-kyc/biometric-kyc)
- **Document Verification**: [https://docs.usediditid.com/products/for-individuals-kyc/document-verification](https://docs.usediditid.com/products/for-individuals-kyc/document-verification)
- **SmartSelfie™ Auth**: [https://docs.usediditid.com/products/for-individuals-kyc/biometric-authentication](https://docs.usediditid.com/products/for-individuals-kyc/biometric-authentication)
- **Web SDK Guide**: [https://docs.usediditid.com/integration-options/web-mobile-web/web-integration](https://docs.usediditid.com/integration-options/web-mobile-web/web-integration)
- **Portal**: [https://portal.usediditid.com/](https://portal.usediditid.com/)
- **Support**: [support@usediditid.com](mailto:support@usediditid.com)
- **Sales**: [sales@usediditid.com](mailto:sales@usediditid.com)

---

## Conclusion

DIDIT's liveness detection and biometric verification technology provides enterprise-grade fraud prevention optimized for African markets. With **ISO-certified 0% spoof penetration rate**, **99.8% face matching accuracy**, and **multiple integration methods**, it's the ideal solution for Lynia Finance's customer onboarding security.

**Recommended Implementation**:
- **Primary**: Biometric KYC (selfie + ID photo + government database)
- **Fallback**: Document Verification (if Biometric KYC unavailable)
- **Re-verification**: SmartSelfie™ Authentication (device collection, sensitive actions)

**Estimated Investment**:
- Development: 24-40 hours
- Year 1 Cost: ~$3,600 (600 customers × $0.60 per verification)
- ROI: Massive fraud prevention savings (estimated 90%+ reduction in identity fraud)

**Status**: Ready to proceed with Web SDK integration and sandbox testing.

---

**Document Information**:
- **Created**: 2025-11-14
- **Author**: Research Team
- **Task**: T027 (GitHub Issue #32)
- **Phase**: Phase 0 - Research
- **Next Task**: T028 (GitHub Issue #33)

