# 06 - Storage Migration

## Current State

Supabase Storage is **planned but not actively used** in production. The
architecture defines 4 buckets:

| Bucket | Purpose | Current Status |
|--------|---------|---------------|
| `commission-pdfs` | Auto-generated commission statements | Planned |
| `kyc-documents` | DIDIT results, encrypted | Planned |
| `reconciliation-photos` | Inventory reconciliation photos | Planned |
| `model-files` | ML model versions | Planned |

Since storage isn't actively used yet, this is the simplest migration --
we implement directly on S3 instead of migrating data.

## Target State: Amazon S3

S3 is already used for frontend hosting and log archival. Adding application
storage buckets is straightforward.

## Implementation

### Step 1: S3 Bucket Configuration

Add to `infrastructure/aws/storage-buckets.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lynia Finance - Application Storage Buckets

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, production]

Conditions:
  IsProduction: !Equals [!Ref Environment, production]

Resources:
  KYCDocumentsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${Environment}-lynia-kyc-documents-${AWS::AccountId}"
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: aws:kms  # KMS encryption for PII
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: ArchiveOldDocuments
            Status: Enabled
            Transitions:
              - StorageClass: INTELLIGENT_TIERING
                TransitionInDays: 90
            # 10-year retention per RBZ requirements
            ExpirationInDays: 3650
      Tags:
        - Key: DataClassification
          Value: PII-Sensitive

  CommissionPDFsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${Environment}-lynia-commission-pdfs-${AWS::AccountId}"
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LifecycleConfiguration:
        Rules:
          - Id: ArchiveOldStatements
            Status: Enabled
            Transitions:
              - StorageClass: GLACIER
                TransitionInDays: 365
            ExpirationInDays: 2555  # 7-year retention

  ReconciliationPhotosBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${Environment}-lynia-reconciliation-${AWS::AccountId}"
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldPhotos
            Status: Enabled
            ExpirationInDays: 365  # 1-year retention

  MLModelsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${Environment}-lynia-ml-models-${AWS::AccountId}"
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      VersioningConfiguration:
        Status: Enabled  # Keep all model versions

Outputs:
  KYCDocumentsBucketName:
    Value: !Ref KYCDocumentsBucket
    Export:
      Name: !Sub "${Environment}-lynia-kyc-bucket"
  CommissionPDFsBucketName:
    Value: !Ref CommissionPDFsBucket
    Export:
      Name: !Sub "${Environment}-lynia-commission-bucket"
```

### Step 2: Storage Client (Replaces Supabase Storage SDK)

Create `services/shared/clients/storage.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

// Bucket names from environment
const BUCKETS = {
  kyc: process.env.KYC_BUCKET!,
  commissions: process.env.COMMISSION_BUCKET!,
  reconciliation: process.env.RECONCILIATION_BUCKET!,
  models: process.env.ML_MODELS_BUCKET!,
} as const;

type BucketKey = keyof typeof BUCKETS;

/**
 * Upload a file to S3.
 * Replaces: supabase.storage.from(bucket).upload(path, file)
 */
export async function uploadFile(
  bucket: BucketKey,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; error: Error | null }> {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKETS[bucket],
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return { key, error: null };
  } catch (error) {
    return { key: '', error: error as Error };
  }
}

/**
 * Generate a presigned URL for downloading.
 * Replaces: supabase.storage.from(bucket).createSignedUrl(path, expiry)
 */
export async function getSignedDownloadUrl(
  bucket: BucketKey,
  key: string,
  expiresInSeconds = 3600
): Promise<{ url: string; error: Error | null }> {
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKETS[bucket],
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    );
    return { url, error: null };
  } catch (error) {
    return { url: '', error: error as Error };
  }
}

/**
 * Generate a presigned URL for uploading (client-side upload).
 * No Supabase equivalent -- but useful for large file uploads.
 */
export async function getSignedUploadUrl(
  bucket: BucketKey,
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<{ url: string; error: Error | null }> {
  try {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKETS[bucket],
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds }
    );
    return { url, error: null };
  } catch (error) {
    return { url: '', error: error as Error };
  }
}

/**
 * Delete a file from S3.
 * Replaces: supabase.storage.from(bucket).remove([path])
 */
export async function deleteFile(
  bucket: BucketKey,
  key: string
): Promise<{ error: Error | null }> {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKETS[bucket],
      Key: key,
    }));
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}
```

### Step 3: Update Lambda IAM Permissions

Add S3 permissions to Lambda functions that need storage access:

```yaml
# In template.yaml, add to KYC function policies:
- Statement:
    - Effect: Allow
      Action:
        - s3:PutObject
        - s3:GetObject
        - s3:DeleteObject
      Resource:
        - !Sub "arn:aws:s3:::${Environment}-lynia-kyc-documents-${AWS::AccountId}/*"
```

### Step 4: Update Service Code

**KYC Service** -- store verification results:
```typescript
// services/kyc-service/src/index.ts
import { uploadFile, getSignedDownloadUrl } from '../../shared/clients/storage';

// After DIDIT callback:
await uploadFile(
  'kyc',
  `${customerId}/verification-${Date.now()}.json`,
  JSON.stringify(diditResult),
  'application/json'
);
```

**Commission Statements** -- generate and store PDFs:
```typescript
// In commission processing Lambda:
await uploadFile(
  'commissions',
  `${distributorId}/${year}/${month}/statement.pdf`,
  pdfBuffer,
  'application/pdf'
);

// Generate download link for distributor dashboard:
const { url } = await getSignedDownloadUrl(
  'commissions',
  `${distributorId}/${year}/${month}/statement.pdf`,
  3600 // 1 hour
);
```

## Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| S3 Standard (first 5 GB) | $0.00 (free tier) |
| S3 Standard (5-50 GB) | ~$1.15 |
| S3 Intelligent-Tiering | Automatic cost optimization |
| GET requests (10,000/mo) | $0.004 |
| PUT requests (1,000/mo) | $0.005 |
| Data transfer (intra-region) | $0.00 |
| **Total (Year 1)** | **< $2/month** |

Compare to Supabase Storage: 1 GB free, then $0.021/GB. Similar pricing, but
S3 gives unlimited scale with lifecycle policies and KMS encryption.

## Security

- All buckets block public access
- KYC documents use KMS encryption (stronger than AES256)
- Presigned URLs expire after configurable time (default 1 hour)
- IAM policies scope each Lambda to only its required buckets
- Versioning enabled on KYC and ML model buckets
- Lifecycle policies enforce retention requirements (RBZ: 10 years for KYC)
