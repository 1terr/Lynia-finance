# WhatsApp Media Handling Design

**Document**: P1-T010 - WhatsApp Media Handling Design
**Status**: Complete
**Last Updated**: 2025-11-24
**Owner**: Engineering Team

## Table of Contents
1. [Overview](#overview)
2. [Media Upload Flow](#media-upload-flow)
3. [Media Download Flow](#media-download-flow)
4. [S3 Storage Strategy](#s3-storage-strategy)
5. [Supported Media Types](#supported-media-types)
6. [File Size Limits](#file-size-limits)
7. [Image Processing](#image-processing)
8. [Thumbnail Generation](#thumbnail-generation)
9. [Security & Encryption](#security--encryption)
10. [CDN Integration](#cdn-integration)
11. [Error Handling](#error-handling)
12. [Performance Optimization](#performance-optimization)

---

## 1. Overview

### 1.1 Purpose

WhatsApp Media Handling manages all image and file uploads/downloads for:
- **KYC Documents**: National ID (front/back), Passport, Driver's License
- **Selfie Verification**: Customer selfie for identity verification
- **Device Photos**: Device condition photos at pickup
- **Loan Documents**: Signed agreements, receipts (future)

### 1.2 Design Goals

**Reliability**:
- ✅ 99.99% upload success rate
- ✅ Automatic retry on failures
- ✅ Corruption detection (checksums)

**Security**:
- ✅ End-to-end encryption (TLS + S3 SSE-KMS)
- ✅ Signed URLs with expiry
- ✅ Access control (presigned URLs, IAM policies)

**Performance**:
- ✅ <2 seconds upload time (up to 5MB)
- ✅ <500ms image processing
- ✅ CDN-accelerated downloads

**User Experience**:
- ✅ Support WhatsApp's native image picker
- ✅ Real-time upload progress feedback
- ✅ Clear error messages

### 1.3 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Storage** | AWS S3 | Durable object storage |
| **Encryption** | AWS KMS | Server-side encryption |
| **CDN** | AWS CloudFront | Fast global delivery |
| **Processing** | AWS Lambda + Sharp | Image resizing, thumbnails |
| **Queue** | AWS SQS | Async processing |
| **Metadata** | Supabase PostgreSQL | File metadata, references |

---

## 2. Media Upload Flow

### 2.1 High-Level Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  WhatsApp Media Upload Flow                  │
└──────────────────────────────────────────────────────────────┘

[1] Customer sends image via WhatsApp
         │
         ▼
[2] WhatsApp sends webhook to our API
    POST /webhooks/whatsapp
    {
      "type": "image",
      "media_id": "abc123",
      "mime_type": "image/jpeg",
      "sha256": "hash...",
      "from": "+263771234567"
    }
         │
         ▼
[3] Lambda retrieves image from WhatsApp API
    GET https://graph.facebook.com/v17.0/{media_id}
    Authorization: Bearer {access_token}
         │
         ▼
[4] Download image to /tmp (Lambda)
    Validate: size, type, checksum
         │
         ▼
[5] Upload to S3 with encryption
    s3://lynia-kyc-documents/{customer_id}/{timestamp}_{filename}.jpg
    ServerSideEncryption: aws:kms
         │
         ▼
[6] Trigger async processing (SQS)
    • Generate thumbnails
    • Extract EXIF data
    • Run image quality checks
         │
         ▼
[7] Save metadata to database
    INSERT INTO media_files (...)
         │
         ▼
[8] Return success to customer
    "✅ Photo received! Processing..."
```

### 2.2 Detailed Upload Implementation

**Step 1: WhatsApp Webhook Handler**
```typescript
// Lambda: POST /webhooks/whatsapp
export async function handleWhatsAppWebhook(event: APIGatewayProxyEvent) {
  const body = JSON.parse(event.body);

  // Verify webhook signature
  if (!verifyWhatsAppSignature(event.headers, event.body)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  // Extract media message
  const message = body.entry[0].changes[0].value.messages[0];

  if (message.type === 'image') {
    await handleImageUpload(message);
  }

  return { statusCode: 200, body: 'OK' };
}
```

**Step 2: Retrieve Image from WhatsApp**
```typescript
async function handleImageUpload(message: WhatsAppImageMessage) {
  const { id: mediaId, mime_type, sha256 } = message.image;
  const fromPhone = message.from;

  // 1. Get media URL from WhatsApp API
  const mediaUrl = await getWhatsAppMediaUrl(mediaId);

  // 2. Download image to Lambda /tmp
  const imageBuffer = await downloadImage(mediaUrl);

  // 3. Validate image
  const validation = await validateImage(imageBuffer, mime_type, sha256);
  if (!validation.valid) {
    await sendMessage(fromPhone, {
      text: `❌ ${validation.error}\n\nPlease send a valid image.`
    });
    return;
  }

  // 4. Get customer session
  const session = await getSession(fromPhone);
  if (!session?.customer_id) {
    throw new Error('Customer ID not found');
  }

  // 5. Upload to S3
  const s3Key = await uploadToS3(imageBuffer, {
    customerId: session.customer_id,
    mediaId: mediaId,
    mimeType: mime_type
  });

  // 6. Queue for processing
  await queueImageProcessing(s3Key, session.customer_id);

  // 7. Save metadata
  await saveMediaMetadata({
    customer_id: session.customer_id,
    s3_key: s3Key,
    media_id: mediaId,
    mime_type: mime_type,
    file_size: imageBuffer.length,
    sha256: sha256,
    uploaded_from: fromPhone,
    uploaded_at: new Date()
  });

  // 8. Send confirmation
  await sendMessage(fromPhone, {
    text: '✅ Photo received! Processing...'
  });
}
```

**Step 3: Download from WhatsApp**
```typescript
async function getWhatsAppMediaUrl(mediaId: string): Promise<string> {
  const response = await axios.get(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
      }
    }
  );

  return response.data.url;
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`
    },
    timeout: 30000, // 30 seconds
    maxContentLength: 16 * 1024 * 1024 // 16MB max
  });

  return Buffer.from(response.data);
}
```

**Step 4: Image Validation**
```typescript
interface ImageValidation {
  valid: boolean;
  error?: string;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

async function validateImage(
  buffer: Buffer,
  mimeType: string,
  expectedSha256?: string
): Promise<ImageValidation> {
  // 1. Verify checksum
  if (expectedSha256) {
    const actualSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actualSha256 !== expectedSha256) {
      return {
        valid: false,
        error: 'File corrupted during transfer. Please try again.'
      };
    }
  }

  // 2. Verify MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Please send JPEG or PNG.`
    };
  }

  // 3. Verify file size
  if (buffer.length > 5 * 1024 * 1024) { // 5MB
    return {
      valid: false,
      error: 'File too large (max 5MB). Please compress and try again.'
    };
  }

  if (buffer.length < 1024) { // 1KB minimum
    return {
      valid: false,
      error: 'File too small. Please send a clear photo.'
    };
  }

  // 4. Verify image integrity with Sharp
  try {
    const metadata = await sharp(buffer).metadata();

    // Check dimensions
    if (metadata.width < 400 || metadata.height < 400) {
      return {
        valid: false,
        error: 'Image resolution too low (min 400x400). Please send a higher quality photo.'
      };
    }

    if (metadata.width > 5000 || metadata.height > 5000) {
      return {
        valid: false,
        error: 'Image resolution too high (max 5000x5000). Please resize and try again.'
      };
    }

    return {
      valid: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid image file. Please send a different photo.'
    };
  }
}
```

**Step 5: Upload to S3**
```typescript
async function uploadToS3(
  buffer: Buffer,
  options: {
    customerId: string;
    mediaId: string;
    mimeType: string;
  }
): Promise<string> {
  const s3 = new AWS.S3();

  // Generate S3 key
  const timestamp = Date.now();
  const extension = options.mimeType.split('/')[1]; // jpeg, png
  const s3Key = `kyc/${options.customerId}/${timestamp}_${options.mediaId}.${extension}`;

  // Upload with encryption
  await s3.putObject({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: options.mimeType,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: process.env.KMS_KEY_ID,
    Metadata: {
      'customer-id': options.customerId,
      'media-id': options.mediaId,
      'uploaded-at': new Date().toISOString()
    },
    Tagging: `customer_id=${options.customerId}&media_id=${options.mediaId}`
  }).promise();

  return s3Key;
}
```

---

## 3. Media Download Flow

### 3.1 Secure Download with Presigned URLs

**Use Case**: Allow customer to view their uploaded KYC documents

```typescript
async function getMediaDownloadUrl(
  customerId: string,
  mediaFileId: string
): Promise<string> {
  // 1. Verify ownership
  const mediaFile = await db.media_files.findOne({
    id: mediaFileId,
    customer_id: customerId
  });

  if (!mediaFile) {
    throw new Error('Media file not found or access denied');
  }

  // 2. Generate presigned URL (expires in 5 minutes)
  const s3 = new AWS.S3();
  const url = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: mediaFile.s3_key,
    Expires: 300 // 5 minutes
  });

  // 3. Log access
  await db.media_access_logs.insert({
    media_file_id: mediaFileId,
    customer_id: customerId,
    access_type: 'download',
    accessed_at: new Date()
  });

  return url;
}
```

**WhatsApp Response**:
```typescript
// Customer asks: "Show me my ID photos"
const idPhotos = await db.media_files.find({
  customer_id: customerId,
  media_type: 'national_id'
});

for (const photo of idPhotos) {
  const downloadUrl = await getMediaDownloadUrl(customerId, photo.id);

  await sendMessage(phoneNumber, {
    type: 'image',
    image: {
      link: downloadUrl,
      caption: `National ID - ${photo.side} (uploaded ${photo.uploaded_at})`
    }
  });
}
```

### 3.2 CDN-Accelerated Delivery

**CloudFront Configuration**:
```yaml
# CloudFront Distribution
Distribution:
  Origins:
    - Id: S3Origin
      DomainName: lynia-kyc-documents.s3.amazonaws.com
      S3OriginConfig:
        OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${CloudFrontOAI}'

  DefaultCacheBehavior:
    TargetOriginId: S3Origin
    ViewerProtocolPolicy: https-only
    AllowedMethods: [GET, HEAD]
    CachedMethods: [GET, HEAD]
    Compress: true
    DefaultTTL: 86400 # 24 hours
    MaxTTL: 31536000 # 1 year
    MinTTL: 0

  PriceClass: PriceClass_200 # North America, Europe, Africa

  # Custom domain
  Aliases:
    - media.lyniafinance.com

  ViewerCertificate:
    AcmCertificateArn: !Ref SSLCertificate
    SslSupportMethod: sni-only
```

**Using CloudFront URLs**:
```typescript
async function getMediaDownloadUrl(
  customerId: string,
  mediaFileId: string
): Promise<string> {
  const mediaFile = await db.media_files.findOne({
    id: mediaFileId,
    customer_id: customerId
  });

  // Use CloudFront signed URL (for private content)
  const cloudfront = new AWS.CloudFront.Signer(
    process.env.CLOUDFRONT_KEY_PAIR_ID,
    process.env.CLOUDFRONT_PRIVATE_KEY
  );

  const signedUrl = cloudfront.getSignedUrl({
    url: `https://media.lyniafinance.com/${mediaFile.s3_key}`,
    expires: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  });

  return signedUrl;
}
```

---

## 4. S3 Storage Strategy

### 4.1 Bucket Structure

```
lynia-kyc-documents/
├── kyc/
│   ├── {customer_id}/
│   │   ├── {timestamp}_national_id_front.jpg
│   │   ├── {timestamp}_national_id_back.jpg
│   │   ├── {timestamp}_selfie.jpg
│   │   └── thumbnails/
│   │       ├── {timestamp}_national_id_front_thumb.jpg
│   │       └── {timestamp}_selfie_thumb.jpg
│   └── ...
├── devices/
│   ├── {device_id}/
│   │   ├── {timestamp}_condition_front.jpg
│   │   ├── {timestamp}_condition_back.jpg
│   │   └── thumbnails/
│   └── ...
├── receipts/
│   ├── {customer_id}/
│   │   ├── {timestamp}_payment_{payment_id}.pdf
│   │   └── ...
│   └── ...
└── temp/
    └── {session_id}/
        └── {timestamp}_upload.jpg (24h TTL)
```

### 4.2 Naming Convention

**Format**: `{category}/{entity_id}/{timestamp}_{type}_{identifier}.{ext}`

**Examples**:
- `kyc/uuid-123/1700000000000_national_id_front.jpg`
- `devices/uuid-456/1700000000000_condition_photo.jpg`
- `receipts/uuid-789/1700000000000_payment_abc123.pdf`

**Benefits**:
- Easy to browse by customer
- Sortable by timestamp
- Clear file purpose from name
- Avoids name collisions

### 4.3 S3 Bucket Configuration

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceSSLOnly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::lynia-kyc-documents",
        "arn:aws:s3:::lynia-kyc-documents/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::lynia-kyc-documents/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    }
  ]
}
```

### 4.4 Lifecycle Policies

```json
{
  "Rules": [
    {
      "Id": "DeleteTempUploads",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "ArchiveOldKYCDocuments",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "kyc/"
      },
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "GLACIER_IR"
        }
      ]
    },
    {
      "Id": "DeleteOldThumbnails",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "kyc/",
        "Tag": {
          "Key": "type",
          "Value": "thumbnail"
        }
      },
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
```

---

## 5. Supported Media Types

### 5.1 Allowed Media Types

| Type | MIME Type | Extension | Use Case | Max Size |
|------|-----------|-----------|----------|----------|
| **JPEG** | image/jpeg | .jpg, .jpeg | Photos, KYC documents | 5MB |
| **PNG** | image/png | .png | Screenshots, clear images | 5MB |
| **WebP** | image/webp | .webp | Modern compressed images | 5MB |
| **PDF** | application/pdf | .pdf | Loan agreements, receipts | 10MB |

### 5.2 Rejected Media Types

| Type | Reason |
|------|--------|
| GIF | Animated images not needed, can be large |
| BMP | Uncompressed, too large |
| TIFF | Not supported by WhatsApp viewer |
| HEIC | iPhone format, convert to JPEG first |
| Video | Not currently supported (future feature) |

### 5.3 MIME Type Detection

```typescript
import fileType from 'file-type';

async function detectMimeType(buffer: Buffer): Promise<string> {
  // Use magic bytes for accurate detection
  const type = await fileType.fromBuffer(buffer);

  if (!type) {
    throw new Error('Could not determine file type');
  }

  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (!allowedMimes.includes(type.mime)) {
    throw new Error(`Unsupported file type: ${type.mime}`);
  }

  return type.mime;
}
```

---

## 6. File Size Limits

### 6.1 Size Limits by Type

| Category | Min Size | Max Size | Reason |
|----------|----------|----------|--------|
| **KYC Photos** | 10KB | 5MB | Balance quality vs upload time |
| **Selfies** | 10KB | 5MB | Same as KYC |
| **Device Photos** | 10KB | 5MB | Same as KYC |
| **PDF Documents** | 1KB | 10MB | Larger for multi-page docs |

### 6.2 Why These Limits?

**Maximum 5MB for Images**:
- ✅ Sufficient for high-quality photos (4000x3000px)
- ✅ Fast upload even on slow 3G (< 60 seconds)
- ✅ Reasonable Lambda /tmp storage (512MB limit)
- ✅ DIDIT API limit is 10MB

**Minimum 10KB for Images**:
- ❌ Rejects tiny, low-quality images
- ❌ Prevents accidental thumbnail uploads
- ❌ Ensures minimum readability

**Maximum 10MB for PDFs**:
- ✅ Enough for 20+ page documents
- ✅ Multi-page loan agreements
- ✅ Bank statements (if needed)

### 6.3 Size Validation

```typescript
function validateFileSize(
  fileSize: number,
  mimeType: string
): { valid: boolean; error?: string } {
  const limits = {
    'image/jpeg': { min: 10 * 1024, max: 5 * 1024 * 1024 },
    'image/png': { min: 10 * 1024, max: 5 * 1024 * 1024 },
    'image/webp': { min: 10 * 1024, max: 5 * 1024 * 1024 },
    'application/pdf': { min: 1024, max: 10 * 1024 * 1024 }
  };

  const limit = limits[mimeType];
  if (!limit) {
    return { valid: false, error: 'Unsupported file type' };
  }

  if (fileSize < limit.min) {
    return {
      valid: false,
      error: `File too small (min ${formatBytes(limit.min)}). Please send a higher quality file.`
    };
  }

  if (fileSize > limit.max) {
    return {
      valid: false,
      error: `File too large (max ${formatBytes(limit.max)}). Please compress and try again.`
    };
  }

  return { valid: true };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
```

---

## 7. Image Processing

### 7.1 Processing Pipeline

```
[Upload] → [Validate] → [Save Original] → [SQS Queue] → [Lambda Processor]
                                               ↓
                          ┌────────────────────┴────────────────────┐
                          │                                         │
                          ▼                                         ▼
                  [Generate Thumbnails]                [Extract Metadata]
                          │                                         │
                          ├─ Small (150x150)                       ├─ EXIF data
                          ├─ Medium (400x400)                      ├─ GPS (remove!)
                          └─ Large (800x800)                       └─ Orientation
                          │                                         │
                          └─────────────────┬─────────────────────┘
                                            ▼
                                   [Quality Checks]
                                            │
                                            ├─ Blur detection
                                            ├─ Brightness check
                                            └─ Face detection (selfies)
                                            │
                                            ▼
                                   [Update Database]
```

### 7.2 Image Processing Lambda

```typescript
import sharp from 'sharp';
import { S3Event } from 'aws-lambda';

export async function processImage(event: S3Event) {
  const s3 = new AWS.S3();

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    // Download original
    const originalImage = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    const imageBuffer = originalImage.Body as Buffer;

    // Process
    await Promise.all([
      generateThumbnails(bucket, key, imageBuffer),
      extractMetadata(bucket, key, imageBuffer),
      runQualityChecks(bucket, key, imageBuffer)
    ]);
  }
}

async function generateThumbnails(
  bucket: string,
  key: string,
  imageBuffer: Buffer
) {
  const sizes = [
    { name: 'small', width: 150, height: 150 },
    { name: 'medium', width: 400, height: 400 },
    { name: 'large', width: 800, height: 800 }
  ];

  const basePath = key.replace(/\.[^.]+$/, ''); // Remove extension
  const thumbnailsPath = basePath.replace(/\/([^/]+)$/, '/thumbnails/$1');

  for (const size of sizes) {
    const thumbnail = await sharp(imageBuffer)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailKey = `${thumbnailsPath}_${size.name}.jpg`;

    await s3.putObject({
      Bucket: bucket,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/jpeg',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
      Metadata: {
        'original-key': key,
        'thumbnail-size': size.name
      }
    }).promise();

    // Update database
    await db.media_files.update(
      { s3_key: key },
      {
        [`thumbnail_${size.name}_key`]: thumbnailKey
      }
    );
  }
}
```

### 7.3 Metadata Extraction

```typescript
async function extractMetadata(
  bucket: string,
  key: string,
  imageBuffer: Buffer
) {
  const metadata = await sharp(imageBuffer).metadata();

  // Extract EXIF
  const exif = metadata.exif ? parseExif(metadata.exif) : null;

  // IMPORTANT: Remove GPS data for privacy
  if (exif?.gps) {
    delete exif.gps;
  }

  // Save metadata
  await db.media_files.update(
    { s3_key: key },
    {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      orientation: metadata.orientation,
      exif_data: exif,
      color_space: metadata.space,
      has_alpha: metadata.hasAlpha,
      processed_at: new Date()
    }
  );
}

function parseExif(exifBuffer: Buffer): any {
  // Use exif-parser library
  const parser = require('exif-parser').create(exifBuffer);
  const result = parser.parse();

  return {
    make: result.tags.Make,
    model: result.tags.Model,
    date_time: result.tags.DateTime,
    software: result.tags.Software,
    // DO NOT include GPS data
  };
}
```

---

## 8. Thumbnail Generation

### 8.1 Thumbnail Sizes

| Size | Dimensions | Use Case | Quality | File Size |
|------|------------|----------|---------|-----------|
| **Small** | 150x150 | List views, previews | 80% | ~5-10KB |
| **Medium** | 400x400 | Modal previews | 80% | ~15-30KB |
| **Large** | 800x800 | Full-screen view | 85% | ~50-100KB |

### 8.2 Thumbnail Strategy

**Why Multiple Sizes?**
- **Performance**: Load appropriate size for context
- **Bandwidth**: Save data on mobile
- **UX**: Fast preview, detailed zoom

**When to Generate?**
- **Async**: After upload completes (SQS queue)
- **Lazy**: On first access (cache miss)
- **Proactive**: During KYC submission

### 8.3 Sharp Configuration

```typescript
import sharp from 'sharp';

async function createThumbnail(
  input: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(input)
    .resize(width, height, {
      fit: 'cover', // Crop to fit exact dimensions
      position: 'center', // Center crop
      withoutEnlargement: false // Allow upscaling if needed
    })
    .jpeg({
      quality: 80,
      progressive: true, // Progressive JPEG (loads faster)
      mozjpeg: true // Use mozjpeg for better compression
    })
    .toBuffer();
}
```

### 8.4 Lazy Thumbnail Generation

```typescript
async function getMediaThumbnailUrl(
  customerId: string,
  mediaFileId: string,
  size: 'small' | 'medium' | 'large'
): Promise<string> {
  const mediaFile = await db.media_files.findOne({
    id: mediaFileId,
    customer_id: customerId
  });

  // Check if thumbnail exists
  const thumbnailKey = mediaFile[`thumbnail_${size}_key`];

  if (!thumbnailKey) {
    // Generate on-demand
    await generateThumbnailOnDemand(mediaFile.s3_key, size);

    // Refresh mediaFile
    const updated = await db.media_files.findOne({ id: mediaFileId });
    thumbnailKey = updated[`thumbnail_${size}_key`];
  }

  // Return presigned URL
  return getPresignedUrl(thumbnailKey);
}
```

---

## 9. Security & Encryption

### 9.1 Encryption Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: In Transit (TLS 1.3)                          │
│ • WhatsApp → Lambda: HTTPS                             │
│ • Lambda → S3: HTTPS                                   │
│ • S3 → CloudFront: HTTPS                               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: At Rest (S3 SSE-KMS)                          │
│ • AES-256 encryption                                    │
│ • Customer-managed KMS key                             │
│ • Automatic key rotation (90 days)                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Access Control                                │
│ • IAM policies (least privilege)                       │
│ • Presigned URLs (5-minute expiry)                     │
│ • CloudFront signed URLs                               │
│ • Audit logging (CloudTrail)                           │
└─────────────────────────────────────────────────────────┘
```

### 9.2 IAM Policy (Lambda)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3Upload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::lynia-kyc-documents/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    },
    {
      "Sid": "AllowS3Download",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::lynia-kyc-documents/*"
    },
    {
      "Sid": "AllowKMSEncryption",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/*"
    }
  ]
}
```

### 9.3 Presigned URL Generation

```typescript
async function generatePresignedUrl(
  s3Key: string,
  expiresIn: number = 300 // 5 minutes
): Promise<string> {
  const s3 = new AWS.S3();

  const url = s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    Expires: expiresIn,
    ResponseContentDisposition: 'inline', // View in browser
    ResponseCacheControl: 'no-cache' // Don't cache sensitive data
  });

  return url;
}
```

### 9.4 Privacy: GPS Stripping

**Why?**
- Customer selfies may contain GPS coordinates
- Privacy risk: reveals exact location of home/work
- GDPR/data minimization: don't collect unnecessary data

**Implementation**:
```typescript
async function stripExifData(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate() // Auto-rotate based on EXIF (preserves orientation)
    .withMetadata({
      exif: {
        // Keep only essential metadata
        IFD0: {
          Orientation: metadata.orientation
        }
        // Remove all other EXIF (including GPS)
      }
    })
    .toBuffer();
}
```

---

## 10. CDN Integration

### 10.1 CloudFront Distribution

**Configuration**:
```yaml
CloudFrontDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Enabled: true
      HttpVersion: http2and3
      PriceClass: PriceClass_200 # US, EU, Africa

      Origins:
        - Id: S3Origin
          DomainName: lynia-kyc-documents.s3.amazonaws.com
          S3OriginConfig:
            OriginAccessIdentity: !Ref CloudFrontOAI

      DefaultCacheBehavior:
        TargetOriginId: S3Origin
        ViewerProtocolPolicy: https-only
        AllowedMethods: [GET, HEAD]
        CachedMethods: [GET, HEAD]
        Compress: true

        ForwardedValues:
          QueryString: true
          QueryStringCacheKeys: [expires, signature]

        DefaultTTL: 86400 # 24 hours
        MaxTTL: 31536000 # 1 year
        MinTTL: 0

      CustomErrorResponses:
        - ErrorCode: 403
          ResponseCode: 404
          ResponsePagePath: /404.html
          ErrorCachingMinTTL: 300

      Logging:
        Bucket: lynia-cloudfront-logs.s3.amazonaws.com
        Prefix: media/
```

### 10.2 Benefits of CDN

| Benefit | Impact |
|---------|--------|
| **Faster Downloads** | 200ms → 50ms (global edge locations) |
| **Reduced Bandwidth Costs** | $0.085/GB → $0.025/GB (caching) |
| **DDoS Protection** | Built-in AWS Shield Standard |
| **Automatic Compression** | Gzip/Brotli for 30-50% size reduction |

### 10.3 Cache Invalidation

```typescript
async function invalidateCloudFrontCache(s3Keys: string[]) {
  const cloudfront = new AWS.CloudFront();

  const paths = s3Keys.map(key => `/${key}`);

  await cloudfront.createInvalidation({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `invalidation-${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths
      }
    }
  }).promise();

  console.log(`Invalidated ${paths.length} CloudFront cache entries`);
}
```

---

## 11. Error Handling

### 11.1 Common Errors

| Error | Cause | User Message | Retry? |
|-------|-------|--------------|--------|
| **FILE_TOO_LARGE** | File > 5MB | "Image too large (max 5MB). Please compress and try again." | ✅ Yes |
| **FILE_TOO_SMALL** | File < 10KB | "Image too small. Please send a clear, high-quality photo." | ✅ Yes |
| **INVALID_FORMAT** | Not JPEG/PNG | "Unsupported file type. Please send JPEG or PNG." | ✅ Yes |
| **CORRUPTED_FILE** | Checksum mismatch | "File corrupted during upload. Please try again." | ✅ Yes |
| **LOW_QUALITY** | Resolution < 400px | "Image quality too low. Please send a clearer photo." | ✅ Yes |
| **UPLOAD_FAILED** | S3 error | "Upload failed. Please try again in a moment." | ✅ Yes |
| **NETWORK_TIMEOUT** | WhatsApp API timeout | "Network issue. Please check your connection and try again." | ✅ Yes |
| **QUOTA_EXCEEDED** | Too many uploads | "Upload limit reached. Please contact support." | ❌ No |

### 11.2 Error Response Format

```typescript
interface MediaError {
  code: string;
  message: string;
  details?: {
    max_size?: string;
    min_size?: string;
    allowed_types?: string[];
    actual_size?: string;
    actual_type?: string;
  };
  retry_able: boolean;
  help_url?: string;
}

function sendMediaError(phoneNumber: string, error: MediaError) {
  let message = `❌ ${error.message}`;

  if (error.details) {
    message += '\n\n' + formatErrorDetails(error.details);
  }

  if (error.retry_able) {
    message += '\n\n💡 Please try again.';
  } else if (error.help_url) {
    message += `\n\nNeed help? Visit: ${error.help_url}`;
  }

  return sendMessage(phoneNumber, { text: message });
}
```

### 11.3 Retry Logic

```typescript
async function uploadWithRetry(
  buffer: Buffer,
  s3Key: string,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await uploadToS3(buffer, s3Key);
      return; // Success
    } catch (error) {
      lastError = error;
      console.error(`Upload attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

---

## 12. Performance Optimization

### 12.1 Parallel Processing

```typescript
async function handleImageUpload(message: WhatsAppImageMessage) {
  const imageBuffer = await downloadImage(message.image.url);

  // Process in parallel
  const [s3Key, validation] = await Promise.all([
    uploadToS3(imageBuffer, {
      customerId: session.customer_id,
      mediaId: message.image.id,
      mimeType: message.image.mime_type
    }),
    validateImage(imageBuffer, message.image.mime_type)
  ]);

  if (!validation.valid) {
    // Delete uploaded file
    await deleteFromS3(s3Key);
    throw new Error(validation.error);
  }

  // Queue processing (non-blocking)
  queueImageProcessing(s3Key, session.customer_id);

  return s3Key;
}
```

### 12.2 Lambda Optimization

**Memory Configuration**:
- **Upload Handler**: 512MB (network I/O)
- **Image Processor**: 1024MB (CPU-intensive Sharp operations)

**Concurrency Limits**:
- **Upload Handler**: 100 concurrent (burst)
- **Image Processor**: 10 concurrent (controlled for cost)

**Cold Start Mitigation**:
```typescript
// Provisioned concurrency for critical functions
ProvisionedConcurrencyConfig:
  ProvisionedConcurrentExecutions: 5
  FunctionArn: !GetAtt UploadHandlerFunction.Arn
```

### 12.3 Monitoring Metrics

**CloudWatch Metrics**:
- Upload success rate (target: >99%)
- Upload latency (p50, p95, p99)
- Processing duration
- Thumbnail generation time
- Error rate by type
- S3 PUT/GET request count
- CloudFront cache hit rate

**Alarms**:
```yaml
UploadErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: lynia-media-upload-high-error-rate
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref CriticalAlertsTopic
```

---

## 13. Database Schema

### 13.1 media_files Table

```sql
CREATE TABLE media_files (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- File Info
  s3_key TEXT NOT NULL UNIQUE,
  s3_bucket VARCHAR(100) NOT NULL DEFAULT 'lynia-kyc-documents',
  cloudfront_url TEXT,

  -- Media Type
  media_type VARCHAR(50) NOT NULL, -- 'national_id', 'selfie', 'device_photo', 'receipt'
  media_subtype VARCHAR(50), -- 'front', 'back', 'condition'

  -- File Metadata
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  sha256 VARCHAR(64),

  -- Image Metadata
  width INTEGER,
  height INTEGER,
  format VARCHAR(20),
  orientation INTEGER,
  exif_data JSONB,

  -- Thumbnails
  thumbnail_small_key TEXT,
  thumbnail_medium_key TEXT,
  thumbnail_large_key TEXT,

  -- Source
  whatsapp_media_id VARCHAR(100),
  uploaded_from VARCHAR(15), -- Phone number
  uploaded_via VARCHAR(50) DEFAULT 'whatsapp', -- 'whatsapp', 'web', 'api'

  -- Processing
  processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,

  -- Quality Checks
  quality_score DECIMAL(3,2), -- 0.00 to 1.00
  is_blurry BOOLEAN,
  is_too_dark BOOLEAN,
  has_face BOOLEAN, -- For selfies

  -- Timestamps
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_media_type CHECK (media_type IN (
    'national_id', 'passport', 'drivers_license',
    'selfie', 'device_photo', 'receipt', 'other'
  )),
  CONSTRAINT valid_processing_status CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed'
  ))
);

-- Indexes
CREATE INDEX idx_media_files_customer ON media_files(customer_id, uploaded_at DESC);
CREATE INDEX idx_media_files_type ON media_files(media_type, media_subtype);
CREATE INDEX idx_media_files_processing ON media_files(processing_status)
  WHERE processing_status IN ('pending', 'processing');
CREATE INDEX idx_media_files_s3_key ON media_files(s3_key);

COMMENT ON TABLE media_files IS 'Media files uploaded by customers (images, PDFs)';
```

### 13.2 media_access_logs Table

```sql
CREATE TABLE media_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  access_type VARCHAR(20) NOT NULL, -- 'download', 'view', 'delete'
  accessed_by UUID REFERENCES admin_users(id), -- NULL for customer access
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_access_type CHECK (access_type IN ('download', 'view', 'delete'))
);

CREATE INDEX idx_media_access_logs_file ON media_access_logs(media_file_id, accessed_at DESC);
CREATE INDEX idx_media_access_logs_customer ON media_access_logs(customer_id, accessed_at DESC);
```

---

## 14. Implementation Checklist

### Phase 1: Core Upload/Download (Week 1)
- [ ] WhatsApp webhook handler
- [ ] Image download from WhatsApp API
- [ ] Image validation (size, type, checksum)
- [ ] S3 upload with encryption
- [ ] Database schema (media_files table)
- [ ] Presigned URL generation

### Phase 2: Processing (Week 2)
- [ ] SQS queue setup
- [ ] Image processing Lambda
- [ ] Thumbnail generation (3 sizes)
- [ ] Metadata extraction
- [ ] Quality checks (blur, brightness)
- [ ] GPS stripping for privacy

### Phase 3: CDN & Optimization (Week 3)
- [ ] CloudFront distribution setup
- [ ] Custom domain (media.lyniafinance.com)
- [ ] Cache configuration
- [ ] Signed URLs for private content
- [ ] Connection pooling
- [ ] Parallel processing

### Phase 4: Monitoring & Testing (Week 4)
- [ ] CloudWatch metrics
- [ ] Error rate alarms
- [ ] Upload success tracking
- [ ] Load testing (100 concurrent uploads)
- [ ] Error scenario testing
- [ ] End-to-end integration tests

---

## 15. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-24 | Engineering Team | Initial media handling design |

**Review Schedule**: Bi-weekly
**Next Review**: 2025-12-08
**Owner**: Backend Lead
**Approvers**: CTO, Security Team

---

**End of Document**
