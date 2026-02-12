/**
 * S3 Storage Client
 *
 * Replaces Supabase Storage SDK with direct S3 operations.
 * Provides presigned URL generation for secure uploads/downloads.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKETS = {
  kyc: process.env.KYC_BUCKET!,
  commissions: process.env.COMMISSION_BUCKET!,
  reconciliation: process.env.RECONCILIATION_BUCKET!,
  models: process.env.ML_MODELS_BUCKET!,
} as const;

type BucketKey = keyof typeof BUCKETS;

/**
 * Upload a file to S3.
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
