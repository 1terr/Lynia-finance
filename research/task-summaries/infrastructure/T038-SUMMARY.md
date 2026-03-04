# T038: Supabase Storage

**Task:** Research Supabase Storage (file upload, signed URLs, automatic image optimization)
**Phase:** Phase 0: Research
**Status:** ✅ Completed
**Date:** November 14, 2025

---

## Executive Summary

Supabase Storage provides **S3-compatible object storage** with automatic image transformation, RLS security, CDN delivery, and signed URLs—perfect for storing **ID documents, selfies, device photos**, and other customer files in Lynia Finance.

**Key Features:**
- **Free tier**: 1GB storage + 2GB bandwidth/month (sufficient for 1,000+ customers)
- **RLS integration**: Row Level Security for file access control
- **Image transformations**: Automatic resize, crop, compress (on-demand via URL params)
- **Signed URLs**: Temporary, expiring download links for secure access
- **CDN delivery**: Fast global access via Supabase CDN
- **Resumable uploads**: Large file support with tus protocol
- **Webhooks**: Trigger Edge Functions on file upload

**Perfect for Lynia Finance**:
- ID card photos (KYC verification)
- Selfies (liveness detection)
- Loan agreements (signed PDFs)
- Device photos (inventory management)
- Payment receipts (proof of payment)

---

## Table of Contents

1. [Storage Overview](#1-storage-overview)
2. [Bucket Configuration](#2-bucket-configuration)
3. [File Upload](#3-file-upload)
4. [File Download & Signed URLs](#4-file-download--signed-urls)
5. [Image Transformations](#5-image-transformations)
6. [RLS Policies](#6-rls-policies)
7. [Storage Webhooks](#7-storage-webhooks)
8. [Cost Analysis](#8-cost-analysis)
9. [Implementation Examples](#9-implementation-examples)
10. [Summary](#10-summary)

---

## 1. Storage Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE STORAGE ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client (React/Mobile)                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Upload ID card photo                                   │ │
│  │  supabase.storage.from('kyc-documents')                    │ │
│  │    .upload('customer-123/id-card.jpg', file)               │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  Supabase Storage API                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  2. Check RLS policies (customer can upload to own folder) │ │
│  │  3. Upload to S3-compatible storage                        │ │
│  │  4. Generate metadata (size, mimetype, etc.)               │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  S3-Compatible Storage (PostgREST + GoTrue)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  File: kyc-documents/customer-123/id-card.jpg             │ │
│  │  Size: 1.2MB                                               │ │
│  │  MIME: image/jpeg                                          │ │
│  │  Owner: customer-123                                       │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  CDN (Global Delivery)                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  https://xxx.supabase.co/storage/v1/object/public/...     │ │
│  │  Image transformations: ?width=400&height=400              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Bucket** | Top-level container for files | `kyc-documents`, `device-photos` |
| **Path** | File location within bucket | `customer-123/id-card.jpg` |
| **RLS** | Row Level Security for file access | Only customer-123 can access their files |
| **Public Bucket** | Files accessible without authentication | Device catalog photos |
| **Private Bucket** | Files require authentication | ID cards, loan agreements |
| **Signed URL** | Temporary, expiring download link | Valid for 60 seconds |

---

## 2. Bucket Configuration

### 2.1 Create Storage Buckets

```sql
-- Create private bucket for KYC documents (ID cards, selfies)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false);

-- Create private bucket for loan agreements
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan-agreements', 'loan-agreements', false);

-- Create public bucket for device photos (product catalog)
INSERT INTO storage.buckets (id, name, public)
VALUES ('device-photos', 'device-photos', true);

-- Create private bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false);
```

### 2.2 Bucket Configuration Options

```typescript
// Via Supabase Dashboard or API
const bucketConfig = {
  id: 'kyc-documents',
  name: 'kyc-documents',
  public: false,  // Requires authentication
  file_size_limit: 5242880,  // 5MB max file size
  allowed_mime_types: ['image/jpeg', 'image/png', 'application/pdf']
};
```

---

## 3. File Upload

### 3.1 Upload from Client (React/TypeScript)

```typescript
// Upload ID card photo
const uploadIDCard = async (customerId: string, file: File) => {
  const filePath = `${customerId}/id-card.jpg`;

  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false  // Don't overwrite existing file
    });

  if (error) {
    console.error('Upload failed:', error);
    return null;
  }

  return data.path;  // 'customer-123/id-card.jpg'
};

// Usage
const file = event.target.files[0];
const path = await uploadIDCard('customer-123', file);
```

### 3.2 Upload from Edge Function (Server-Side)

```typescript
// supabase/functions/process-kyc/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''  // Bypass RLS
  );

  const { customerId, imageBase64 } = await req.json();

  // Decode base64 image
  const imageData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .upload(`${customerId}/selfie.jpg`, imageData, {
      contentType: 'image/jpeg'
    });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ path: data.path }), { status: 200 });
});
```

### 3.3 Resumable Uploads (Large Files)

```typescript
// Upload large PDF (loan agreement) with progress tracking
const uploadLoanAgreement = async (loanId: string, file: File) => {
  const filePath = `${loanId}/agreement.pdf`;

  const { data, error } = await supabase.storage
    .from('loan-agreements')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  // Supabase automatically uses tus protocol for files > 6MB
  // Progress events available via XMLHttpRequest if needed

  return data;
};
```

---

## 4. File Download & Signed URLs

### 4.1 Public URL (Public Buckets)

```typescript
// Get public URL for device photo
const { data } = supabase.storage
  .from('device-photos')
  .getPublicUrl('samsung-galaxy-a04.jpg');

console.log(data.publicUrl);
// https://xxx.supabase.co/storage/v1/object/public/device-photos/samsung-galaxy-a04.jpg
```

### 4.2 Signed URL (Private Buckets)

```typescript
// Generate temporary download link (expires in 60 seconds)
const { data, error } = await supabase.storage
  .from('kyc-documents')
  .createSignedUrl('customer-123/id-card.jpg', 60);

console.log(data.signedUrl);
// https://xxx.supabase.co/storage/v1/object/sign/kyc-documents/customer-123/id-card.jpg?token=...

// URL is valid for 60 seconds, then expires
```

### 4.3 Download File to Client

```typescript
// Download ID card photo
const downloadIDCard = async (customerId: string) => {
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .download(`${customerId}/id-card.jpg`);

  if (error) {
    console.error('Download failed:', error);
    return null;
  }

  // data is a Blob
  const url = URL.createObjectURL(data);
  return url;
};

// Display in browser
const imageUrl = await downloadIDCard('customer-123');
document.querySelector('img').src = imageUrl;
```

---

## 5. Image Transformations

### 5.1 On-Demand Transformations (URL Parameters)

```typescript
// Original image (1.2MB, 3000x4000px)
const originalUrl = supabase.storage
  .from('kyc-documents')
  .getPublicUrl('customer-123/id-card.jpg').data.publicUrl;

// Resize to 400x400 (auto-crop, maintain aspect ratio)
const thumbnailUrl = `${originalUrl}?width=400&height=400`;

// Resize to max width 800px (maintain aspect ratio)
const mediumUrl = `${originalUrl}?width=800`;

// Compress quality to 60% (reduce file size)
const compressedUrl = `${originalUrl}?quality=60`;

// Combine: resize + compress
const optimizedUrl = `${originalUrl}?width=400&height=400&quality=70`;
```

### 5.2 Supported Transformations

| Parameter | Description | Example |
|-----------|-------------|---------|
| **width** | Resize to specified width (px) | `?width=800` |
| **height** | Resize to specified height (px) | `?height=600` |
| **quality** | JPEG/WebP quality (1-100) | `?quality=75` |
| **resize** | Resize mode (cover, contain, fill) | `?resize=cover` |
| **format** | Output format (jpeg, png, webp) | `?format=webp` |

### 5.3 Example: Thumbnail Generation

```typescript
// Generate thumbnail for ID card preview
const getThumbnail = (customerId: string) => {
  const { data } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(`${customerId}/id-card.jpg`);

  // 200x200 thumbnail, 60% quality, WebP format
  return `${data.publicUrl}?width=200&height=200&quality=60&format=webp`;
};

// Use in UI
<img src={getThumbnail('customer-123')} alt="ID card thumbnail" />
```

---

## 6. RLS Policies

### 6.1 Customer Access Control

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Customers can upload to their own folder
CREATE POLICY "Customers can upload own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Customers can view their own files
CREATE POLICY "Customers can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Customers can update their own files
CREATE POLICY "Customers can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Customers can delete their own files
CREATE POLICY "Customers can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 6.2 Staff Access (Read-Only)

```sql
-- Policy: Staff can view all KYC documents
CREATE POLICY "Staff can view all KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
  )
);
```

### 6.3 Public Access (Device Photos)

```sql
-- Policy: Anyone can view device photos
CREATE POLICY "Public can view device photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'device-photos');

-- Policy: Only admins can upload device photos
CREATE POLICY "Admins can upload device photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'device-photos'
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE staff.user_id = auth.uid()
    AND staff.role = 'admin'
  )
);
```

---

## 7. Storage Webhooks

### 7.1 Trigger Edge Function on File Upload

```sql
-- Create function to trigger Edge Function on file upload
CREATE OR REPLACE FUNCTION notify_file_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/process-uploaded-file',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'bucket', NEW.bucket_id,
      'path', NEW.name,
      'size', NEW.metadata->>'size',
      'mimetype', NEW.metadata->>'mimetype'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to storage.objects
CREATE TRIGGER on_file_uploaded
AFTER INSERT ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION notify_file_uploaded();
```

### 7.2 Process Uploaded File (Edge Function)

```typescript
// supabase/functions/process-uploaded-file/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  const { bucket, path, size, mimetype } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Example: Submit ID card to DIDIT for verification
  if (bucket === 'kyc-documents' && path.includes('id-card')) {
    const customerId = path.split('/')[0];

    // Download file
    const { data: file } = await supabase.storage
      .from(bucket)
      .download(path);

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Submit to DIDIT (example)
    await fetch('https://api.diditidentity.com/v1/biometric_kyc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('DIDIT_WEBHOOK_SECRET')}`,
      },
      body: JSON.stringify({
        customer_id: customerId,
        id_card_base64: base64,
      }),
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ ignored: true }), { status: 200 });
});
```

---

## 8. Cost Analysis

### 8.1 Free Tier Limits

| Metric | Free Tier | Overage Cost |
|--------|-----------|--------------|
| **Storage** | 1GB | $0.021/GB/month |
| **Bandwidth** | 2GB/month | $0.09/GB |
| **API Requests** | Unlimited (in free tier) | N/A |

### 8.2 Lynia Finance Estimate (500 customers/month)

**Assumptions**:
- 3 files per customer (ID card, selfie, loan agreement)
- Average file size: 500KB (ID card), 200KB (selfie), 100KB (PDF)
- Total per customer: 800KB

| Metric | Value | Cost |
|--------|-------|------|
| **Storage** (500 customers × 800KB) | 400MB | Free (within 1GB) |
| **Bandwidth** (500 customers × 3 downloads × 800KB) | 1.2GB | Free (within 2GB) |
| **TOTAL** | - | **$0/month** ✅ |

### 8.3 At Scale (5,000 customers/month)

| Metric | Value | Cost |
|--------|-------|------|
| **Storage** (5,000 customers × 800KB) | 4GB | $0.063/month (3GB overage) |
| **Bandwidth** (5,000 × 3 × 800KB) | 12GB | $0.90/month (10GB overage) |
| **TOTAL** | - | **$0.96/month** ✅ |

**Conclusion**: Lynia Finance will have **negligible storage costs** even at scale.

---

## 9. Implementation Examples

### 9.1 Complete KYC Upload Flow

```typescript
// components/KYCUpload.tsx
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function KYCUpload({ customerId }: { customerId: string }) {
  const [uploading, setUploading] = useState(false);
  const [idCardUrl, setIdCardUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const uploadIDCard = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const filePath = `${customerId}/id-card.jpg`;

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, { upsert: false });

    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }

    // Get signed URL for preview
    const { data: urlData } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 3600);  // Valid for 1 hour

    setIdCardUrl(urlData!.signedUrl);
    setUploading(false);
  };

  const uploadSelfie = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const filePath = `${customerId}/selfie.jpg`;

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, { upsert: false });

    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 3600);

    setSelfieUrl(urlData!.signedUrl);
    setUploading(false);
  };

  return (
    <div>
      <h2>Upload KYC Documents</h2>

      <div>
        <label>ID Card Photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={uploadIDCard}
          disabled={uploading}
        />
        {idCardUrl && (
          <img
            src={`${idCardUrl}?width=400&height=400`}
            alt="ID card"
            style={{ maxWidth: '400px' }}
          />
        )}
      </div>

      <div>
        <label>Selfie</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={uploadSelfie}
          disabled={uploading}
        />
        {selfieUrl && (
          <img
            src={`${selfieUrl}?width=400&height=400`}
            alt="Selfie"
            style={{ maxWidth: '400px' }}
          />
        )}
      </div>

      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### 9.2 Device Photo Gallery (Public Bucket)

```typescript
// components/DeviceGallery.tsx
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DeviceGallery() {
  const [devices, setDevices] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    // List all files in device-photos bucket
    const { data: files } = await supabase.storage
      .from('device-photos')
      .list('', { limit: 100 });

    const deviceImages = files?.map((file) => {
      const { data } = supabase.storage
        .from('device-photos')
        .getPublicUrl(file.name);

      return {
        name: file.name,
        url: `${data.publicUrl}?width=400&height=400&quality=80`,
      };
    }) || [];

    setDevices(deviceImages);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {devices.map((device) => (
        <div key={device.name}>
          <img src={device.url} alt={device.name} />
          <p>{device.name}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 10. Summary

### 10.1 Key Takeaways

✅ **S3-Compatible Storage**: Standard API, easy integration
✅ **RLS Integration**: Secure file access with Row Level Security
✅ **Image Transformations**: Automatic resize, crop, compress via URL params
✅ **Signed URLs**: Temporary, expiring download links for private files
✅ **Free Tier**: 1GB storage + 2GB bandwidth/month (sufficient for 1,000+ customers)
✅ **CDN Delivery**: Fast global access
✅ **Webhooks**: Trigger Edge Functions on file upload

### 10.2 Recommended Buckets for Lynia Finance

| Bucket | Public/Private | Purpose | RLS Policy |
|--------|---------------|---------|------------|
| **kyc-documents** | Private | ID cards, selfies | Customer can only access own files |
| **loan-agreements** | Private | Signed PDFs | Customer can only access own files |
| **device-photos** | Public | Product catalog | Public read, admin write |
| **payment-receipts** | Private | Proof of payment | Customer can only access own files |

### 10.3 Next Steps

- [ ] Create storage buckets (kyc-documents, loan-agreements, device-photos, payment-receipts)
- [ ] Set up RLS policies for each bucket
- [ ] Deploy Edge Function for file upload webhook (process-uploaded-file)
- [ ] Implement KYC upload UI component
- [ ] Test image transformations (resize, compress, format)
- [ ] Monitor storage usage (should stay within 1GB free tier)

---

**Status**: ✅ T038 Complete
**Next Task**: T039 - Document event architecture (PostgreSQL triggers + pg_notify() + event_log table)
**Related**: T037 (Database triggers), T039 (Event architecture), T040+ (Supabase testing)
