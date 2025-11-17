# T028: Smile Identity API Request/Response Schemas

**Task ID**: T028 (GitHub Issue #33)
**Phase**: Phase 0 - Research
**Date**: 2025-11-14
**Status**: ✅ Completed

---

## Executive Summary

This document provides comprehensive API request/response schemas for all Smile Identity products used by Lynia Finance: **Enhanced KYC**, **Biometric KYC**, **Document Verification**, and **SmartSelfie™ Authentication**. Each schema includes field definitions, data types, validation rules, complete result code mappings, and TypeScript/JavaScript type definitions for implementation.

**Purpose**: Serve as the single source of truth for Smile Identity API integration, reducing development errors and ensuring consistent error handling across all KYC verification flows.

---

## Table of Contents

1. [Enhanced KYC API](#1-enhanced-kyc-api)
2. [Biometric KYC API](#2-biometric-kyc-api)
3. [Document Verification API](#3-document-verification-api)
4. [SmartSelfie™ Authentication API](#4-smartselfie-authentication-api)
5. [Result Codes Reference](#5-result-codes-reference)
6. [TypeScript Type Definitions](#6-typescript-type-definitions)
7. [Error Handling Guide](#7-error-handling-guide)

---

## 1. Enhanced KYC API

### Overview

**Product**: Enhanced KYC (Identity Lookup)
**Job Type**: 5
**Purpose**: Query government ID authority database to retrieve and verify personal information
**Use Case**: Initial customer onboarding for Lynia Finance

### Request Schema

#### IDApi.submit_job() Parameters

```javascript
const partner_params = {
  user_id: string,      // Required: Unique identifier for customer
  job_id: string,       // Required: Unique identifier for this verification job
  job_type: 5           // Required: 5 = Enhanced KYC
};

const id_info = {
  country: string,      // Required: ISO 3166-1 alpha-2 code (e.g., "ZW")
  id_type: string,      // Required: ID type (e.g., "NATIONAL_ID_NO_PHOTO")
  id_number: string     // Required: National ID number
};

// Example for Zimbabwe
const zimbabweRequest = {
  partner_params: {
    user_id: "customer_12345",
    job_id: "job_abc123def456",
    job_type: 5
  },
  id_info: {
    country: "ZW",
    id_type: "NATIONAL_ID_NO_PHOTO",
    id_number: "123456789A12"
  }
};
```

#### Field Validation

| Field | Type | Required | Format | Example |
|-------|------|----------|--------|---------|
| `user_id` | string | ✅ Yes | Alphanumeric, max 255 chars | `customer_12345` |
| `job_id` | string | ✅ Yes | Alphanumeric, max 255 chars | `job_abc123` |
| `job_type` | number | ✅ Yes | Must be `5` | `5` |
| `country` | string | ✅ Yes | ISO 3166-1 alpha-2 | `ZW` |
| `id_type` | string | ✅ Yes | See supported types | `NATIONAL_ID_NO_PHOTO` |
| `id_number` | string | ✅ Yes | Format varies by country | `123456789A12` |

#### Supported Zimbabwe ID Types

| ID Type Code | Description | Format |
|--------------|-------------|--------|
| `NATIONAL_ID_NO_PHOTO` | Zimbabwe National ID | `/^[0-9]{8,9}[A-Za-z]\d{2}$/` |

### Response Schema

#### Success Response (Code 1012)

```json
{
  "ResultCode": "1012",
  "ResultText": "ID Number Validated",
  "Country": "ZW",
  "IDType": "NATIONAL_ID_NO_PHOTO",
  "IDNumber": "123456789A12",
  "FirstName": "John",
  "LastName": "Doe",
  "FullName": "John Doe",
  "DOB": "1990-05-15",
  "Gender": "Male",
  "IsAlive": true
}
```

#### Field Reference

| Field | Type | Always Returned | Description |
|-------|------|-----------------|-------------|
| `ResultCode` | string | ✅ Yes | Result code (see codes below) |
| `ResultText` | string | ✅ Yes | Human-readable result |
| `Country` | string | ✅ Yes | ISO country code |
| `IDType` | string | ✅ Yes | ID type queried |
| `IDNumber` | string | ✅ Yes | ID number queried |
| `FirstName` | string | ✅ Yes | Given name |
| `LastName` | string | ✅ Yes | Family name |
| `FullName` | string | ✅ Yes | Complete name |
| `DOB` | string | ✅ Yes | Date of birth (YYYY-MM-DD) |
| `Gender` | string | ✅ Yes | "Male" or "Female" |
| `IsAlive` | boolean | ✅ Yes | Vital status (true/false) |
| `Photo` | string | ❌ No | Base64 image (Zimbabwe: NOT available) |
| `Address` | string | ❌ No | Residential address (Zimbabwe: NOT available) |
| `PhoneNumber` | string | ❌ No | Contact number (Zimbabwe: NOT available) |
| `IssuanceDate` | string | ❌ No | ID issue date (Zimbabwe: NOT available) |
| `ExpirationDate` | string | ❌ No | ID expiry date (Zimbabwe: NOT available) |

#### Error Response (Code 1013)

```json
{
  "ResultCode": "1013",
  "ResultText": "Unable to Validate ID",
  "Country": "ZW",
  "IDType": "NATIONAL_ID_NO_PHOTO",
  "IDNumber": "123456789A12"
}
```

#### Result Codes for Enhanced KYC

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **1012** | ID Number Validated | ✅ Success | Proceed with data |
| **1013** | Unable to Validate ID | ❌ Failed | ID not found in database |
| **1014** | Invalid Format | ❌ Error | Check ID number format |
| **1015** | Database Unavailable | ⏳ Retry | ID authority offline, retry later |
| **1016** | Need to Activate Product | ❌ Error | Contact Smile ID support |

### Usage Example

```javascript
const SmileIdentityCore = require('smile-identity-core');
const IDApi = SmileIdentityCore.IDApi;

const connection = new IDApi(
  process.env.SMILE_PARTNER_ID,
  process.env.SMILE_API_KEY,
  '0'  // 0 = sandbox, 1 = production
);

async function verifyZimbabweID(idNumber, customerId) {
  const partner_params = {
    user_id: `customer_${customerId}`,
    job_id: `job_${Date.now()}`,
    job_type: 5
  };

  const id_info = {
    country: 'ZW',
    id_type: 'NATIONAL_ID_NO_PHOTO',
    id_number: idNumber
  };

  try {
    const response = await connection.submit_job(partner_params, id_info);

    if (response.ResultCode === '1012') {
      return {
        success: true,
        data: {
          firstName: response.FirstName,
          lastName: response.LastName,
          dob: response.DOB,
          gender: response.Gender,
          isAlive: response.IsAlive
        }
      };
    } else {
      return {
        success: false,
        error: response.ResultText,
        code: response.ResultCode
      };
    }
  } catch (error) {
    console.error('Enhanced KYC error:', error);
    throw error;
  }
}
```

---

## 2. Biometric KYC API

### Overview

**Product**: Biometric KYC
**Job Type**: 1
**Purpose**: Verify identity by comparing selfie to government database photo and/or uploaded ID card photo
**Use Case**: Customer onboarding with liveness detection and face matching

### Request Schema

#### WebApi.submit_job() Parameters

```javascript
const partner_params = {
  user_id: string,              // Required: Unique customer identifier
  job_id: string,               // Required: Unique job identifier
  job_type: 1                   // Required: 1 = Biometric KYC
};

const id_info = {
  country: string,              // Required: ISO country code
  id_type: string,              // Required: ID type
  id_number: string,            // Required: ID number
  first_name: string,           // Optional but recommended
  last_name: string,            // Optional but recommended
  dob: string,                  // Optional: YYYY-MM-DD format
  entered: boolean              // Required: true
};

const options = {
  return_job_status: boolean,   // Optional: Get immediate result (default: false)
  return_history: boolean,      // Optional: Include verification history (default: false)
  return_images: boolean,       // Optional: Return images in response (default: false)
  use_enrolled_image: boolean   // Optional: Use previously enrolled selfie (default: false)
};

// Example
const biometricKYCRequest = {
  partner_params: {
    user_id: "customer_12345",
    job_id: "job_abc123",
    job_type: 1
  },
  id_info: {
    country: "ZW",
    id_type: "NATIONAL_ID",
    id_number: "123456789A12",
    first_name: "John",
    last_name: "Doe",
    dob: "1990-05-15",
    entered: true
  },
  options: {
    return_job_status: true,
    return_history: false,
    return_images: true,
    use_enrolled_image: false
  }
};
```

#### Image Package Structure

Images must be uploaded as a **ZIP file** containing:

**Files**:
1. `selfie.jpg` - Primary selfie image (RGB, JPEG/PNG)
2. `liveness_1.jpg` - Liveness frame 1 (optional)
3. `liveness_2.jpg` - Liveness frame 2 (optional)
4. ... up to `liveness_8.jpg`
5. `id_card.jpg` - Photo of physical ID card
6. `info.json` - Metadata file

**info.json Structure**:

```json
{
  "package_information": {
    "apiVersion": {
      "buildNumber": 0,
      "majorVersion": 2,
      "minorVersion": 0
    },
    "language": "javascript"
  },
  "misc_information": {
    "retry": "false",
    "partner_params": {
      "user_id": "customer_12345",
      "job_id": "job_abc123",
      "job_type": 1
    },
    "file_name": "selfie.jpg",
    "smile_client_id": "your_partner_id",
    "timestamp": "2025-11-14T10:30:00Z"
  },
  "id_info": {
    "country": "ZW",
    "id_type": "NATIONAL_ID",
    "id_number": "123456789A12",
    "first_name": "John",
    "last_name": "Doe",
    "dob": "1990-05-15",
    "entered": true
  }
}
```

### Response Schema

#### Webhook Callback Response

Smile ID sends results to your configured callback URL via HTTP POST.

```json
{
  "Actions": {
    "Liveness_Check": "Passed",
    "Selfie_Check": "Passed",
    "Selfie_To_ID_Authority_Compare": "Passed",
    "Selfie_To_ID_Card_Compare": "Passed",
    "Human_Review_Liveness_Check": "Not Applicable",
    "Human_Review_Selfie_Check": "Not Applicable",
    "Human_Review_Update_Selfie_To_ID_Authority_Compare": "Not Applicable",
    "Human_Review_Update_Selfie_To_ID_Card_Compare": "Not Applicable"
  },
  "ResultCode": "0810",
  "ResultText": "Enroll User",
  "PartnerParams": {
    "user_id": "customer_12345",
    "job_id": "job_abc123",
    "job_type": 1
  },
  "Source": "WebAPI",
  "Timestamp": "2025-11-14T10:35:22Z",
  "signature": "generated_signature_string",
  "IDInfo": {
    "Country": "ZW",
    "IDType": "NATIONAL_ID",
    "IDNumber": "123456789A12",
    "FirstName": "John",
    "LastName": "Doe",
    "FullName": "John Doe",
    "DOB": "1990-05-15",
    "Gender": "Male",
    "Photo": "base64_encoded_image_string...",
    "IsAlive": true
  },
  "Confidence": 99.8,
  "IDNumberPreviouslyRegistered": "false",
  "ExistingUserIDUsedForThisIDNumber": []
}
```

#### Actions Field Reference

| Action | Possible Values | Description |
|--------|-----------------|-------------|
| `Liveness_Check` | Passed / Failed / Not Applicable | Active liveness detection (smile test) |
| `Selfie_Check` | Passed / Failed / Not Applicable | Passive liveness detection (AI analysis) |
| `Selfie_To_ID_Authority_Compare` | Passed / Failed / Not Applicable | Selfie vs government database photo |
| `Selfie_To_ID_Card_Compare` | Passed / Failed / Not Applicable | Selfie vs uploaded ID card photo |
| `Human_Review_Liveness_Check` | Approved / Rejected / Not Applicable | Human reviewer liveness verdict |
| `Human_Review_Selfie_Check` | Approved / Rejected / Not Applicable | Human reviewer selfie quality verdict |
| `Human_Review_Update_Selfie_To_ID_Authority_Compare` | Approved / Rejected / Not Applicable | Human reviewer authority comparison |
| `Human_Review_Update_Selfie_To_ID_Card_Compare` | Approved / Rejected / Not Applicable | Human reviewer ID card comparison |

#### Result Codes for Biometric KYC

##### Machine Judgment (0810-0815)

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **0810** | Enroll User - Machine Judgement PASS | ✅ Approved | All checks passed |
| **0811** | Images Didn't Match | ❌ Rejected | Face mismatch detected |
| **0812** | Pure Provisional | ⏳ Provisionally Approved | Awaiting human review |
| **0813** | Possible Spoof | ❌ Rejected | Fraud attempt detected |
| **0814** | Provisional - Possible Spoof | ⏳ Suspected | Sent to human reviewer |
| **0815** | Provisional - Compare Unsure | ⏳ Provisionally Approved | Reviewer will compare images |

##### Human Review (1210-1214)

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **1210** | Enroll User - Human Judgement PASS | ✅ Approved | Reviewer confirmed |
| **1211** | Human Compare Failed | ❌ Rejected | Different persons identified |
| **1212** | Reviewer Detected Fraud | ❌ Rejected | Spoof confirmed by human |
| **1213** | Liveness Unsure | ⚠️ Inconclusive | Uncertain about fraud |
| **1214** | ID Card Check Failed | ❌ Rejected | Problem with ID photo |

##### Image Quality Issues (0911-0922)

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **0911** | No Face Found | ❌ Rejected | Upload image with visible face |
| **0912** | Image Quality Too Poor | ❌ Rejected | Retake selfie with better quality |
| **0921** | No Face Detected | ❌ Rejected | No face in uploaded selfie |
| **0922** | Selfie Quality Insufficient | ❌ Rejected | Selfie too low quality |

#### Confidence Score

The `Confidence` field (0-100) indicates face matching confidence:

| Range | Interpretation |
|-------|----------------|
| **95-100** | Very high confidence match |
| **90-94** | High confidence match |
| **80-89** | Medium confidence match |
| **70-79** | Low confidence match (may require review) |
| **< 70** | Very low confidence (likely rejected) |

### Usage Example

```javascript
const SmileIdentityCore = require('smile-identity-core');
const WebApi = SmileIdentityCore.WebApi;
const fs = require('fs');

const connection = new WebApi(
  process.env.SMILE_PARTNER_ID,
  process.env.SMILE_CALLBACK_URL,
  process.env.SMILE_API_KEY,
  '0'  // sandbox
);

async function submitBiometricKYC(customerId, selfieBase64, idCardBase64) {
  const partner_params = {
    user_id: `customer_${customerId}`,
    job_id: `job_${Date.now()}`,
    job_type: 1
  };

  const id_info = {
    country: 'ZW',
    id_type: 'NATIONAL_ID',
    id_number: '123456789A12',
    first_name: 'John',
    last_name: 'Doe',
    dob: '1990-05-15',
    entered: true
  };

  const options = {
    return_job_status: true,
    return_images: true
  };

  // Create ZIP package
  const zipPath = await createImagePackage(
    partner_params,
    selfieBase64,
    idCardBase64,
    id_info
  );

  try {
    const response = await connection.submit_job(
      partner_params,
      zipPath,
      id_info,
      options
    );

    // Clean up temp file
    fs.unlinkSync(zipPath);

    return response;
  } catch (error) {
    console.error('Biometric KYC error:', error);
    throw error;
  }
}
```

---

## 3. Document Verification API

### Overview

**Product**: Document Verification
**Job Type**: 6
**Purpose**: Verify document authenticity and match selfie to ID card photo (with OCR and human review)
**Use Case**: Backup verification when government database unavailable

### Request Schema

```javascript
const partner_params = {
  user_id: string,              // Required: Unique customer identifier
  job_id: string,               // Required: Unique job identifier
  job_type: 6                   // Required: 6 = Document Verification
};

const id_info = {
  country: string,              // Required: ISO country code
  id_type: string               // Required: Document type
};

const options = {
  return_job_status: boolean,   // Optional: Get immediate result
  return_history: boolean,      // Optional: Include history
  return_images: boolean        // Optional: Return images
};

// Example
const docVerificationRequest = {
  partner_params: {
    user_id: "customer_12345",
    job_id: "job_abc123",
    job_type: 6
  },
  id_info: {
    country: "ZW",
    id_type: "NATIONAL_ID"  // or "PASSPORT", "DRIVERS_LICENSE"
  },
  options: {
    return_job_status: true,
    return_images: true
  }
};
```

#### Supported Zimbabwe Document Types

| ID Type | Description |
|---------|-------------|
| `NATIONAL_ID` | Zimbabwe National ID Card |
| `PASSPORT` | Zimbabwe Passport |
| `DRIVERS_LICENSE` | Zimbabwe Driver's License |

### Response Schema

#### Success Response (Code 0810)

```json
{
  "Actions": {
    "Liveness_Check": "Passed",
    "Document_Authenticity": "Passed",
    "Selfie_To_ID_Card_Compare": "Passed",
    "Human_Review_Document": "Approved",
    "Human_Review_Liveness_Check": "Approved"
  },
  "ResultCode": "0810",
  "ResultText": "Document Verified",
  "PartnerParams": {
    "user_id": "customer_12345",
    "job_id": "job_abc123",
    "job_type": 6
  },
  "DocumentInfo": {
    "Country": "ZW",
    "DocumentType": "NATIONAL_ID",
    "IDNumber": "123456789A12",
    "FirstName": "JOHN",
    "LastName": "DOE",
    "FullName": "JOHN DOE",
    "DOB": "15 MAY 1990",
    "Gender": "M",
    "Address": "123 Main Street, Harare, Zimbabwe",
    "IssueDate": "01 JAN 2020",
    "ExpiryDate": "01 JAN 2030",
    "Nationality": "ZIMBABWEAN"
  },
  "DocumentImage": "base64_encoded_document_image...",
  "SelfieImage": "base64_encoded_selfie...",
  "Confidence": 98.5,
  "Timestamp": "2025-11-14T10:40:15Z"
}
```

#### Actions Reference

| Action | Possible Values | Description |
|--------|-----------------|-------------|
| `Liveness_Check` | Passed / Failed | Liveness detection on selfie |
| `Document_Authenticity` | Passed / Failed | Security features, MRZ, barcode validation |
| `Selfie_To_ID_Card_Compare` | Passed / Failed | Face match: selfie vs document photo |
| `Human_Review_Document` | Approved / Rejected | Expert document validation |
| `Human_Review_Liveness_Check` | Approved / Rejected | Expert liveness confirmation |

#### Result Codes for Document Verification

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **0810** | Document Verified | ✅ Approved | All checks passed |
| **0811** | Document Verification Failed | ❌ Rejected | Expired, no match, failed liveness, etc. |
| **0812** | Unusable Document Image | ❌ Rejected | Invalid document type or poor quality |
| **0816** | Unsupported Document | ❌ Rejected | Minors' passport, permits, etc. |
| **0817** | Approved with Attention - Document Expired | ⚠️ Approved | Document expired but face matched |

#### DocumentInfo Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `Country` | string | Document issuing country | `ZW` |
| `DocumentType` | string | Type of document | `NATIONAL_ID` |
| `IDNumber` | string | ID/document number | `123456789A12` |
| `FirstName` | string | Given name (OCR extracted) | `JOHN` |
| `LastName` | string | Family name (OCR extracted) | `DOE` |
| `FullName` | string | Complete name | `JOHN DOE` |
| `DOB` | string | Date of birth | `15 MAY 1990` |
| `Gender` | string | Gender (M/F) | `M` |
| `Address` | string | Residential address | `123 Main St, Harare` |
| `IssueDate` | string | Document issue date | `01 JAN 2020` |
| `ExpiryDate` | string | Document expiry date | `01 JAN 2030` |
| `Nationality` | string | Nationality | `ZIMBABWEAN` |

**Note**: OCR extraction quality varies. Fields may be incomplete or have extraction errors.

### Usage Example

```javascript
async function verifyDocument(customerId, selfieBase64, documentBase64, documentType) {
  const partner_params = {
    user_id: `customer_${customerId}`,
    job_id: `job_${Date.now()}`,
    job_type: 6
  };

  const id_info = {
    country: 'ZW',
    id_type: documentType  // 'NATIONAL_ID', 'PASSPORT', or 'DRIVERS_LICENSE'
  };

  const options = {
    return_job_status: true,
    return_images: true
  };

  const zipPath = await createDocumentPackage(
    partner_params,
    selfieBase64,
    documentBase64,
    id_info
  );

  try {
    const response = await connection.submit_job(
      partner_params,
      zipPath,
      id_info,
      options
    );

    fs.unlinkSync(zipPath);

    return {
      success: response.ResultCode === '0810',
      actions: response.Actions,
      documentInfo: response.DocumentInfo,
      confidence: response.Confidence
    };
  } catch (error) {
    console.error('Document verification error:', error);
    throw error;
  }
}
```

---

## 4. SmartSelfie™ Authentication API

### Overview

**Product**: SmartSelfie™ Authentication
**Job Type**: 2
**Purpose**: Re-verify returning customer by comparing new selfie to enrolled selfie
**Use Case**: Device collection authorization, sensitive transactions

### Request Schema

```javascript
const partner_params = {
  user_id: string,              // Required: SAME user_id from original enrollment
  job_id: string,               // Required: Unique job identifier
  job_type: 2                   // Required: 2 = SmartSelfie Authentication
};

const id_info = {};             // Empty object (no ID info needed)

const options = {
  return_job_status: boolean    // Optional: Get immediate result
};

// Example
const authRequest = {
  partner_params: {
    user_id: "customer_12345",  // Must match original Biometric KYC user_id
    job_id: "job_auth_xyz789",
    job_type: 2
  },
  id_info: {},
  options: {
    return_job_status: true
  }
};
```

**IMPORTANT**: The `user_id` MUST be the same as used in the original Biometric KYC or Document Verification enrollment. If the user_id doesn't exist, authentication will fail.

### Response Schema

#### Success Response (Code 0820)

```json
{
  "Actions": {
    "Liveness_Check": "Passed",
    "Selfie_To_Enrolled_Compare": "Passed",
    "Human_Review_Liveness_Check": "Not Applicable",
    "Human_Review_Compare": "Not Applicable"
  },
  "ResultCode": "0820",
  "ResultText": "Authentication Successful",
  "PartnerParams": {
    "user_id": "customer_12345",
    "job_id": "job_auth_xyz789",
    "job_type": 2
  },
  "Confidence": 99.5,
  "Timestamp": "2025-11-14T11:00:00Z"
}
```

#### Actions Reference

| Action | Possible Values | Description |
|--------|-----------------|-------------|
| `Liveness_Check` | Passed / Failed | Liveness detection on new selfie |
| `Selfie_To_Enrolled_Compare` | Passed / Failed | New selfie vs enrolled selfie |
| `Human_Review_Liveness_Check` | Approved / Rejected / Not Applicable | Human liveness review |
| `Human_Review_Compare` | Approved / Rejected / Not Applicable | Human comparison review |

#### Result Codes for SmartSelfie™ Authentication

##### Machine Judgment (0820-0825)

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **0820** | Authentication Successful | ✅ Approved | All checks passed |
| **0821** | Authentication Failed - Images Don't Match | ❌ Rejected | Different person |
| **0822** | Pure Provisional | ⏳ Provisionally Approved | Awaiting human review |
| **0823** | Possible Spoof Detected | ❌ Rejected | Fraud attempt detected |
| **0824** | Provisional - Possible Spoof | ⏳ Suspected | Sent to reviewer |
| **0825** | Provisional - Compare Unsure | ⏳ Provisionally Approved | Reviewer will compare |

##### Human Review (1220-1222)

| Code | Meaning | Status | Action |
|------|---------|--------|--------|
| **1220** | Authentication Successful - Human Approved | ✅ Approved | Reviewer confirmed match |
| **1221** | Authentication Failed - Human Rejected | ❌ Rejected | Reviewer confirmed different person |
| **1222** | Fraud Detected by Reviewer | ❌ Rejected | Spoof confirmed |

### Usage Example

```javascript
async function authenticateCustomer(customerId, newSelfieBase64) {
  const partner_params = {
    user_id: `customer_${customerId}`,  // MUST match enrollment
    job_id: `job_auth_${Date.now()}`,
    job_type: 2
  };

  const id_info = {};  // No ID info needed

  const options = {
    return_job_status: true
  };

  // Create ZIP with only selfie (no ID card photo)
  const zipPath = await createAuthPackage(
    partner_params,
    newSelfieBase64
  );

  try {
    const response = await connection.submit_job(
      partner_params,
      zipPath,
      id_info,
      options
    );

    fs.unlinkSync(zipPath);

    const authenticated = (
      response.ResultCode === '0820' ||
      response.ResultCode === '1220'
    );

    return {
      success: authenticated,
      confidence: response.Confidence,
      resultCode: response.ResultCode,
      resultText: response.ResultText
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}
```

---

## 5. Result Codes Reference

### Complete Result Code List

#### ID Verification Codes

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **1012** | ID Number Validated | ✅ Approved | Success |
| **1013** | Unable to Validate ID | ❌ Rejected | ID not found |
| **1014** | Invalid Format | ❌ Error | Format validation failed |
| **1015** | Database Unavailable | ⏳ Retry | Authority offline |
| **1016** | Need to Activate Product | ❌ Error | No access to ID type |
| **1020** | Exact Match | ✅ Approved | All details match |
| **1021** | Partial Match | ✅ Approved | Some details match |
| **1022** | No Match | ❌ Rejected | Details don't match |
| **1023** | Not Found | ❌ Rejected | No record, no charge |

#### Biometric Verification Codes (Machine)

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **0810** | Enroll User - Machine PASS | ✅ Approved | All checks passed |
| **0811** | Images Didn't Match | ❌ Rejected | Face mismatch |
| **0812** | Pure Provisional | ⏳ Provisional | Awaiting review |
| **0813** | Possible Spoof | ❌ Rejected | Fraud detected |
| **0814** | Provisional - Possible Spoof | ⏳ Suspected | Review needed |
| **0815** | Provisional - Compare Unsure | ⏳ Provisional | Review needed |

#### Biometric Verification Codes (Human)

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **1210** | Enroll User - Human PASS | ✅ Approved | Reviewer approved |
| **1211** | Human Compare Failed | ❌ Rejected | Different persons |
| **1212** | Reviewer Detected Fraud | ❌ Rejected | Spoof confirmed |
| **1213** | Liveness Unsure | ⚠️ Inconclusive | Uncertain |
| **1214** | ID Card Check Failed | ❌ Rejected | ID photo problem |

#### Authentication Codes (Machine)

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **0820** | Authentication Successful | ✅ Approved | Match confirmed |
| **0821** | Authentication Failed | ❌ Rejected | No match |
| **0822** | Pure Provisional | ⏳ Provisional | Review needed |
| **0823** | Possible Spoof | ❌ Rejected | Fraud detected |
| **0824** | Provisional - Possible Spoof | ⏳ Suspected | Review needed |
| **0825** | Provisional - Compare Unsure | ⏳ Provisional | Review needed |

#### Authentication Codes (Human)

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **1220** | Authentication - Human PASS | ✅ Approved | Reviewer approved |
| **1221** | Authentication Failed | ❌ Rejected | Reviewer rejected |
| **1222** | Fraud Detected | ❌ Rejected | Spoof confirmed |

#### Document Verification Codes

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **0810** | Document Verified | ✅ Approved | All checks passed |
| **0811** | Document Verification Failed | ❌ Rejected | Failed checks |
| **0812** | Unusable Document | ❌ Rejected | Poor quality/invalid |
| **0816** | Unsupported Document | ❌ Rejected | Invalid for KYC |
| **0817** | Approved - Document Expired | ⚠️ Approved | Expired but matched |

#### Image Quality Codes

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **0911** | No Face Found | ❌ Rejected | Face not detected |
| **0912** | Image Quality Too Poor | ❌ Rejected | Quality insufficient |
| **0921** | No Face Detected | ❌ Rejected | Face not in image |
| **0922** | Selfie Quality Insufficient | ❌ Rejected | Poor quality |

#### System Error Codes

| Code | Meaning | Status | Category |
|------|---------|--------|----------|
| **0001** | Unknown Error | ❌ Error | System error |
| **0908** | Issuer Not Available | ⏳ Retry | Authority offline |
| **2211** | ID Validation Failed (Mobile) | ❌ Rejected | Mobile SDK error |
| **2212** | HTTP Request Failed (Mobile) | ❌ Error | Network error |

### Result Code Decision Tree

```javascript
function handleResultCode(code) {
  // Success codes
  if (['1012', '1020', '1021', '0810', '1210', '0820', '1220'].includes(code)) {
    return { status: 'approved', action: 'proceed' };
  }

  // Provisional codes (human review pending)
  if (['0812', '0814', '0815', '0822', '0824', '0825'].includes(code)) {
    return { status: 'provisional', action: 'wait_for_review' };
  }

  // Retry codes (temporary issues)
  if (['1015', '0908'].includes(code)) {
    return { status: 'retry', action: 'retry_later' };
  }

  // Rejected codes
  return { status: 'rejected', action: 'reject_application' };
}
```

---

## 6. TypeScript Type Definitions

### Enhanced KYC Types

```typescript
// Request types
interface EnhancedKYCPartnerParams {
  user_id: string;
  job_id: string;
  job_type: 5;
}

interface EnhancedKYCIdInfo {
  country: string;
  id_type: string;
  id_number: string;
}

interface EnhancedKYCRequest {
  partner_params: EnhancedKYCPartnerParams;
  id_info: EnhancedKYCIdInfo;
}

// Response types
interface EnhancedKYCResponse {
  ResultCode: string;
  ResultText: string;
  Country: string;
  IDType: string;
  IDNumber: string;
  FirstName: string;
  LastName: string;
  FullName: string;
  DOB: string;  // YYYY-MM-DD
  Gender: 'Male' | 'Female';
  IsAlive: boolean;
  Photo?: string;
  Address?: string;
  PhoneNumber?: string;
  IssuanceDate?: string;
  ExpirationDate?: string;
}
```

### Biometric KYC Types

```typescript
// Request types
interface BiometricKYCPartnerParams {
  user_id: string;
  job_id: string;
  job_type: 1;
}

interface BiometricKYCIdInfo {
  country: string;
  id_type: string;
  id_number: string;
  first_name?: string;
  last_name?: string;
  dob?: string;  // YYYY-MM-DD
  entered: boolean;
}

interface BiometricKYCOptions {
  return_job_status?: boolean;
  return_history?: boolean;
  return_images?: boolean;
  use_enrolled_image?: boolean;
}

// Response types
type ActionResult = 'Passed' | 'Failed' | 'Not Applicable';
type HumanReviewResult = 'Approved' | 'Rejected' | 'Not Applicable';

interface BiometricKYCActions {
  Liveness_Check: ActionResult;
  Selfie_Check: ActionResult;
  Selfie_To_ID_Authority_Compare: ActionResult;
  Selfie_To_ID_Card_Compare: ActionResult;
  Human_Review_Liveness_Check: HumanReviewResult;
  Human_Review_Selfie_Check: HumanReviewResult;
  Human_Review_Update_Selfie_To_ID_Authority_Compare: HumanReviewResult;
  Human_Review_Update_Selfie_To_ID_Card_Compare: HumanReviewResult;
}

interface BiometricKYCIDInfo {
  Country: string;
  IDType: string;
  IDNumber: string;
  FirstName: string;
  LastName: string;
  FullName: string;
  DOB: string;
  Gender: string;
  Photo?: string;
  IsAlive: boolean;
}

interface BiometricKYCResponse {
  Actions: BiometricKYCActions;
  ResultCode: string;
  ResultText: string;
  PartnerParams: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
  Source: string;
  Timestamp: string;
  signature: string;
  IDInfo?: BiometricKYCIDInfo;
  Confidence?: number;
  IDNumberPreviouslyRegistered?: string;
  ExistingUserIDUsedForThisIDNumber?: string[];
}
```

### Document Verification Types

```typescript
interface DocumentVerificationActions {
  Liveness_Check: ActionResult;
  Document_Authenticity: ActionResult;
  Selfie_To_ID_Card_Compare: ActionResult;
  Human_Review_Document: HumanReviewResult;
  Human_Review_Liveness_Check: HumanReviewResult;
}

interface DocumentInfo {
  Country: string;
  DocumentType: string;
  IDNumber: string;
  FirstName: string;
  LastName: string;
  FullName: string;
  DOB: string;
  Gender: string;
  Address?: string;
  IssueDate?: string;
  ExpiryDate?: string;
  Nationality?: string;
}

interface DocumentVerificationResponse {
  Actions: DocumentVerificationActions;
  ResultCode: string;
  ResultText: string;
  PartnerParams: {
    user_id: string;
    job_id: string;
    job_type: 6;
  };
  DocumentInfo?: DocumentInfo;
  DocumentImage?: string;
  SelfieImage?: string;
  Confidence?: number;
  Timestamp: string;
}
```

### SmartSelfie™ Authentication Types

```typescript
interface SmartSelfieAuthActions {
  Liveness_Check: ActionResult;
  Selfie_To_Enrolled_Compare: ActionResult;
  Human_Review_Liveness_Check: HumanReviewResult;
  Human_Review_Compare: HumanReviewResult;
}

interface SmartSelfieAuthResponse {
  Actions: SmartSelfieAuthActions;
  ResultCode: string;
  ResultText: string;
  PartnerParams: {
    user_id: string;
    job_id: string;
    job_type: 2;
  };
  Confidence?: number;
  Timestamp: string;
}
```

### Complete Type Union

```typescript
type SmileIDResponse =
  | EnhancedKYCResponse
  | BiometricKYCResponse
  | DocumentVerificationResponse
  | SmartSelfieAuthResponse;

type ResultCode =
  // Success
  | '1012' | '1020' | '1021' | '0810' | '1210' | '0820' | '1220'
  // Rejected
  | '1013' | '1022' | '1023' | '0811' | '1211' | '1212' | '1214' | '0821' | '1221' | '1222' | '0813' | '0823'
  // Provisional
  | '0812' | '0814' | '0815' | '0822' | '0824' | '0825'
  // Errors
  | '1014' | '1015' | '1016' | '0001' | '0908' | '0911' | '0912' | '0921' | '0922' | '2211' | '2212'
  // Document
  | '0816' | '0817';
```

---

## 7. Error Handling Guide

### Comprehensive Error Handler

```typescript
interface KYCErrorContext {
  code: string;
  message: string;
  retryable: boolean;
  action: 'proceed' | 'retry' | 'reject' | 'wait' | 'contact_support';
  userMessage: string;
}

function handleSmileIDResult(resultCode: string, resultText: string): KYCErrorContext {
  const errorMap: Record<string, KYCErrorContext> = {
    // Success codes
    '1012': {
      code: '1012',
      message: 'ID Number Validated',
      retryable: false,
      action: 'proceed',
      userMessage: 'Verification successful'
    },
    '0810': {
      code: '0810',
      message: 'Enroll User - Machine PASS',
      retryable: false,
      action: 'proceed',
      userMessage: 'Verification successful'
    },
    '1210': {
      code: '1210',
      message: 'Enroll User - Human PASS',
      retryable: false,
      action: 'proceed',
      userMessage: 'Verification approved'
    },
    '0820': {
      code: '0820',
      message: 'Authentication Successful',
      retryable: false,
      action: 'proceed',
      userMessage: 'Authentication successful'
    },

    // ID not found
    '1013': {
      code: '1013',
      message: 'Unable to Validate ID',
      retryable: false,
      action: 'reject',
      userMessage: 'National ID not found in database. Please verify your ID number.'
    },
    '1023': {
      code: '1023',
      message: 'Not Found',
      retryable: false,
      action: 'reject',
      userMessage: 'ID not found. Please check your National ID number.'
    },

    // Format errors
    '1014': {
      code: '1014',
      message: 'Invalid Format',
      retryable: true,
      action: 'retry',
      userMessage: 'Invalid ID number format. Please check and try again.'
    },

    // Database unavailable
    '1015': {
      code: '1015',
      message: 'Database Unavailable',
      retryable: true,
      action: 'retry',
      userMessage: 'Verification service temporarily unavailable. Please try again in a few minutes.'
    },
    '0908': {
      code: '0908',
      message: 'Issuer Not Available',
      retryable: true,
      action: 'retry',
      userMessage: 'Government database temporarily unavailable. Please try again later.'
    },

    // Biometric failures
    '0811': {
      code: '0811',
      message: 'Images Didn\'t Match',
      retryable: true,
      action: 'retry',
      userMessage: 'Face does not match ID card photo. Please ensure you are the ID card holder and try again.'
    },
    '0813': {
      code: '0813',
      message: 'Possible Spoof',
      retryable: true,
      action: 'retry',
      userMessage: 'Verification failed. Please ensure good lighting and take a clear selfie.'
    },
    '1211': {
      code: '1211',
      message: 'Human Compare Failed',
      retryable: false,
      action: 'reject',
      userMessage: 'Identity verification failed. Face does not match ID card.'
    },
    '1212': {
      code: '1212',
      message: 'Reviewer Detected Fraud',
      retryable: false,
      action: 'reject',
      userMessage: 'Verification failed. Please contact support.'
    },

    // Image quality
    '0911': {
      code: '0911',
      message: 'No Face Found',
      retryable: true,
      action: 'retry',
      userMessage: 'No face detected in photo. Please ensure your face is clearly visible.'
    },
    '0912': {
      code: '0912',
      message: 'Image Quality Too Poor',
      retryable: true,
      action: 'retry',
      userMessage: 'Photo quality is too low. Please retake in good lighting.'
    },

    // Provisional
    '0812': {
      code: '0812',
      message: 'Pure Provisional',
      retryable: false,
      action: 'wait',
      userMessage: 'Verification in progress. You will be notified within 3 minutes.'
    },
    '0814': {
      code: '0814',
      message: 'Provisional - Possible Spoof',
      retryable: false,
      action: 'wait',
      userMessage: 'Verification under review. Please wait for confirmation.'
    },

    // System errors
    '0001': {
      code: '0001',
      message: 'Unknown Error',
      retryable: true,
      action: 'contact_support',
      userMessage: 'An error occurred. Please contact support.'
    },
    '1016': {
      code: '1016',
      message: 'Need to Activate Product',
      retryable: false,
      action: 'contact_support',
      userMessage: 'Service configuration error. Please contact support.'
    }
  };

  return errorMap[resultCode] || {
    code: resultCode,
    message: resultText,
    retryable: false,
    action: 'contact_support',
    userMessage: 'Verification failed. Please contact support.'
  };
}
```

### Usage in Application

```typescript
async function processKYCResult(response: BiometricKYCResponse) {
  const context = handleSmileIDResult(response.ResultCode, response.ResultText);

  switch (context.action) {
    case 'proceed':
      // Update customer status to verified
      await Customer.update({
        kycStatus: 'VERIFIED',
        kycVerifiedAt: new Date()
      }, {
        where: { id: customerId }
      });
      return { success: true, message: context.userMessage };

    case 'reject':
      // Update customer status to failed
      await Customer.update({
        kycStatus: 'FAILED',
        kycFailureReason: context.message
      }, {
        where: { id: customerId }
      });
      return { success: false, error: context.userMessage };

    case 'retry':
      // Allow customer to retry
      return {
        success: false,
        retryable: true,
        error: context.userMessage
      };

    case 'wait':
      // Human review pending
      await Customer.update({
        kycStatus: 'PENDING_REVIEW'
      }, {
        where: { id: customerId }
      });
      return {
        success: false,
        pending: true,
        message: context.userMessage
      };

    case 'contact_support':
      // System error - escalate
      await createSupportTicket(customerId, context.code, context.message);
      return {
        success: false,
        error: context.userMessage
      };
  }
}
```

---

## Summary

This document provides complete API schemas for all four Smile Identity products used by Lynia Finance:

1. **Enhanced KYC**: Government database lookup for PII retrieval
2. **Biometric KYC**: Selfie + ID card photo with liveness detection
3. **Document Verification**: Document authenticity + OCR + human review
4. **SmartSelfie™ Authentication**: Returning customer re-verification

**Key Takeaways**:
- All requests require `partner_params` with `user_id`, `job_id`, and `job_type`
- Biometric products require ZIP packages with images + metadata
- Webhook callbacks provide asynchronous results
- Result codes range from 0001-9999 with specific meanings
- TypeScript types ensure type-safe implementation
- Error handling must account for retryable vs permanent failures

**Next Steps**: Implement type-safe wrappers using TypeScript definitions, create comprehensive error handling middleware, and set up webhook endpoint with signature verification.

---

**Document Information**:
- **Created**: 2025-11-14
- **Author**: Research Team
- **Task**: T028 (GitHub Issue #33)
- **Phase**: Phase 0 - Research
- **Related**: T026 (Enhanced KYC), T027 (Liveness Detection)
- **Next Task**: T029 (GitHub Issue #34)

