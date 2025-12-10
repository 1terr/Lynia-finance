/**
 * Image Processor
 * Handles image validation and preprocessing for KYC submissions
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  size?: number;
  format?: string;
}

/**
 * Validate image buffer and size
 */
export function validateImage(imageBuffer: Buffer): ImageValidationResult {
  // Check if buffer is empty
  if (!imageBuffer || imageBuffer.length === 0) {
    return {
      valid: false,
      error: 'Image buffer is empty'
    };
  }

  // Check size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (imageBuffer.length > maxSize) {
    return {
      valid: false,
      error: `Image size ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum of 10MB`
    };
  }

  // Check minimum size (1KB)
  const minSize = 1024; // 1KB
  if (imageBuffer.length < minSize) {
    return {
      valid: false,
      error: 'Image size too small, must be at least 1KB'
    };
  }

  // Detect image format by checking magic bytes
  const format = detectImageFormat(imageBuffer);
  if (!format) {
    return {
      valid: false,
      error: 'Invalid image format. Only JPEG and PNG are supported.'
    };
  }

  return {
    valid: true,
    size: imageBuffer.length,
    format
  };
}

/**
 * Detect image format from buffer magic bytes
 */
function detectImageFormat(buffer: Buffer): string | null {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  return null;
}

/**
 * Convert image buffer to Base64 string
 */
export function bufferToBase64(buffer: Buffer, format: string = 'jpeg'): string {
  const base64 = buffer.toString('base64');
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Download image from WhatsApp API
 */
export async function downloadWhatsAppImage(
  imageId: string,
  accessToken: string
): Promise<Buffer> {
  const axios = require('axios');

  try {
    // Step 1: Get image URL from WhatsApp API
    const urlResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${imageId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const imageUrl = urlResponse.data.url;

    // Step 2: Download image from URL
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return Buffer.from(imageResponse.data);
  } catch (error) {
    console.error('Error downloading WhatsApp image:', error);
    throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract ID number from text using regex patterns
 * Zimbabwe National ID format: XX-XXXXXXAXX (e.g., 63-123456A47)
 */
export function extractZimbabweIDNumber(text: string): string | null {
  // Pattern: XX-XXXXXXAXX where XX is 2 digits, XXXXXX is 6 digits, A is a letter, XX is 2 digits
  const pattern = /\b(\d{2}-\d{6}[A-Z]\d{2})\b/i;
  const match = text.match(pattern);

  if (match) {
    return match[1].toUpperCase();
  }

  // Alternative pattern without hyphen: XXXXXXXXAXX
  const patternNoHyphen = /\b(\d{8}[A-Z]\d{2})\b/i;
  const matchNoHyphen = text.match(patternNoHyphen);

  if (matchNoHyphen) {
    const idNumber = matchNoHyphen[1].toUpperCase();
    // Add hyphen after first 2 digits
    return `${idNumber.substring(0, 2)}-${idNumber.substring(2)}`;
  }

  return null;
}

/**
 * Validate Zimbabwe ID number format
 */
export function validateZimbabweIDNumber(idNumber: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  // Remove whitespace
  const cleaned = idNumber.trim();

  // Pattern: XX-XXXXXXAXX
  const pattern = /^(\d{2})-(\d{6})([A-Z])(\d{2})$/i;
  const match = cleaned.match(pattern);

  if (!match) {
    return {
      valid: false,
      error: 'Invalid ID number format. Expected format: XX-XXXXXXAXX (e.g., 63-123456A47)'
    };
  }

  // Normalize to uppercase
  const normalized = cleaned.toUpperCase();

  return {
    valid: true,
    normalized
  };
}

/**
 * Estimate image quality based on size and dimensions
 */
export function estimateImageQuality(buffer: Buffer): {
  quality: 'low' | 'medium' | 'high';
  message: string;
} {
  const sizeInKB = buffer.length / 1024;

  // Low quality: < 100KB
  if (sizeInKB < 100) {
    return {
      quality: 'low',
      message: 'Image quality appears low. Please retake with better resolution.'
    };
  }

  // Medium quality: 100KB - 500KB
  if (sizeInKB < 500) {
    return {
      quality: 'medium',
      message: 'Image quality acceptable'
    };
  }

  // High quality: > 500KB
  return {
    quality: 'high',
    message: 'Image quality good'
  };
}
