/**
 * WhatsApp Onboarding - KYC Upload State Handlers
 *
 * Handles National ID number collection, ID photo upload, selfie upload,
 * and KYC service submission.
 */

import { db } from '../../../../shared/clients/database';
import axios from 'axios';
import { logger } from '../../../../shared/utils/logger';
import { updateSession } from '../session';
import { downloadWhatsAppMedia } from '../media';
import type { OnboardingSession, MessageContext } from '../types';

const KYC_API_URL = process.env.KYC_API_URL!;

/**
 * Handle KYC_ID_UPLOAD state
 * Collects National ID number (text) then ID photo (image).
 */
export async function handleKYCIdUpload(
  session: OnboardingSession,
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  // Step 1: Collect National ID number (text input)
  if (!session.state_data.id_number) {
    const idNumber = context.message.trim();

    // If user sent an image before providing ID number, ask for text first
    if (imageUrl || idNumber === '[Image received]') {
      return `First, please type your *National ID number*.

Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*`;
    }

    // Validate Zimbabwe national ID format (e.g., "63-2345678-B-08")
    // Strip all Unicode dash variants (en-dash, em-dash, etc.) that mobile keyboards may insert
    const stripped = idNumber.replace(/[\s\u002D\u2010-\u2015\u2212\uFE58\uFE63\uFF0D./]/g, '');
    const idPattern = /^(\d{2})(\d{6,7})([A-Z])(\d{2})$/i;
    const idMatch = stripped.match(idPattern);
    if (!idMatch) {
      return `Invalid ID number format.

Please enter your National ID number:
Format: *XX-XXXXXXX-X-XX*
Example: *63-2345678-B-08*`;
    }

    // Normalize to canonical format: XX-XXXXXXXAXX
    const normalizedId = `${idMatch[1]}-${idMatch[2]}${idMatch[3].toUpperCase()}${idMatch[4]}`;

    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        id_number: normalizedId
      }
    });

    return `\u2705 *ID Number Received!*

\uD83D\uDCF8 *Now send a photo of your National ID*

Tips for a clear photo:
\u2705 Place ID on flat surface
\u2705 Good lighting, no shadows
\u2705 All text visible
\u2705 Hold phone steady

*Send photo now*`;
  }

  // Step 2: Collect ID photo (image input)
  if (!imageUrl) {
    return `Please send a photo of your National ID.

Make sure:
\u2705 Photo is clear and readable
\u2705 All corners visible
\u2705 Good lighting

*Send photo now*`;
  }

  // Store ID photo media ID and move to selfie capture
  await updateSession(context.from, {
    current_state: 'kyc_selfie_upload',
    state_data: {
      ...session.state_data,
      id_photo_url: imageUrl
    }
  });

  return `\u2705 *ID Photo Received!*

\uD83D\uDCF8 *Step 2: Take a Selfie*

This helps us match your face to your ID.

Tips:
\u2705 Face the camera directly
\u2705 Remove sunglasses/hat
\u2705 Good lighting on face
\u2705 Neutral expression

\uD83D\uDD12 Your privacy matters - we never share your photos.

*Send selfie now*`;
}

/**
 * Handle KYC_SELFIE_UPLOAD state
 * Downloads images from WhatsApp and submits to the KYC service.
 */
export async function handleKYCSelfieUpload(
  session: OnboardingSession,
  context: MessageContext,
  imageUrl?: string
): Promise<string> {
  if (!imageUrl) {
    return `Please send a clear selfie.

Make sure:
\u2705 Your face is clearly visible
\u2705 Looking directly at camera
\u2705 Good lighting
\u2705 No sunglasses or hat

*Send selfie now*`;
  }

  // Store selfie media ID and transition to processing
  await updateSession(context.from, {
    current_state: 'kyc_processing',
    state_data: {
      ...session.state_data,
      selfie_photo_url: imageUrl,
      kyc_status: 'pending'
    }
  });

  try {
    // Download both images from WhatsApp Cloud API as base64
    const [idImageBase64, selfieImageBase64] = await Promise.all([
      downloadWhatsAppMedia(session.state_data.id_photo_url!),
      downloadWhatsAppMedia(imageUrl)
    ]);

    // Find the customer record
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('whatsapp_number', context.from)
      .single()
      .execute();

    if (!customer) {
      throw new Error('Customer record not found');
    }

    // Parse name into first/last
    const nameParts = (session.state_data.full_name || '').split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Convert DOB from DD/MM/YYYY to YYYY-MM-DD
    let dobFormatted: string | undefined;
    if (session.state_data.date_of_birth) {
      const [day, month, year] = session.state_data.date_of_birth.split('/');
      dobFormatted = `${year}-${month}-${day}`;
    }

    // Call KYC service
    const kycResponse = await axios.post(`${KYC_API_URL}/kyc/initiate`, {
      customer_id: customer.id,
      id_number: session.state_data.id_number,
      id_image_base64: idImageBase64,
      selfie_image_base64: selfieImageBase64,
      first_name: firstName,
      last_name: lastName,
      dob: dobFormatted,
      phone_number: context.from
    });

    const kycResult = kycResponse.data;

    // Store the KYC submission ID
    await updateSession(context.from, {
      state_data: {
        ...session.state_data,
        selfie_photo_url: imageUrl,
        kyc_verification_id: kycResult.kyc_submission_id,
        kyc_status: 'pending'
      }
    });

    // If KYC was processed synchronously (e.g., Didit), check result immediately
    if (kycResult.status === 'processing') {
      const statusResponse = await axios.get(
        `${KYC_API_URL}/kyc/${customer.id}`
      );
      const statusResult = statusResponse.data;

      if (statusResult.kyc_status === 'verified') {
        // Deduplicate by national ID — if another customer already has this ID,
        // merge to their record so loan history is preserved across phone changes.
        const customerId = await deduplicateByNationalId(
          customer.id as string,
          session.state_data.id_number!,
          context.from
        );

        await updateSession(context.from, {
          current_state: 'credit_scoring',
          customer_id: customerId,
          state_data: {
            ...session.state_data,
            selfie_photo_url: imageUrl,
            kyc_verification_id: kycResult.kyc_submission_id,
            kyc_status: 'verified'
          }
        });

        return `\u2705 *Identity Verified!*

Great news! Your identity has been confirmed.

\u23F3 *Assessing your eligibility...*

We're calculating your loan amount based on:
\u2713 Identity verification
\u2713 Income information
\u2713 First-time borrower status

This takes about 10 seconds...`;
      }

      if (statusResult.kyc_status === 'rejected') {
        const retryCount = (session.state_data.retry_count || 0) + 1;
        const attemptsRemaining = 3 - retryCount;

        if (attemptsRemaining <= 0) {
          await updateSession(context.from, {
            current_state: 'rejected',
            state_data: {
              ...session.state_data,
              kyc_status: 'failed'
            }
          });

          return `\u274C *Verification Failed*

You have used all 3 verification attempts.

Please contact support for assistance: support@lynia.finance`;
        }

        // Reset to ID upload for retry
        await updateSession(context.from, {
          current_state: 'kyc_id_upload',
          state_data: {
            ...session.state_data,
            kyc_status: 'failed',
            id_photo_url: undefined,
            selfie_photo_url: undefined,
            id_number: undefined,
            retry_count: retryCount
          }
        });

        return `\u274C *Verification Unsuccessful*

${statusResult.verification_reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Please enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
      }
    }

    // Async flow (e.g., DIDIT) — tell customer to wait
    return `\u23F3 *Verifying Your Identity...*

Your documents have been submitted for verification.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait...`;

  } catch (error) {
    // Detailed error logging to diagnose KYC failures
    const isAxiosError = error && typeof error === 'object' && 'isAxiosError' in error;
    const axiosErr = isAxiosError ? (error as { response?: { status?: number; data?: unknown }; code?: string }) : null;

    const errorDetails: Record<string, unknown> = {
      action: 'kyc.initiate',
      customer_phone: context.from,
      error_message: error instanceof Error ? error.message : 'Unknown',
    };

    if (axiosErr?.response) {
      errorDetails.error_type = 'kyc_api_error';
      errorDetails.http_status = axiosErr.response.status;
      errorDetails.response_data = axiosErr.response.data;
    } else if (axiosErr?.code) {
      errorDetails.error_type = 'network_error';
      errorDetails.error_code = axiosErr.code;
    } else if (error instanceof Error && error.message === 'Customer record not found') {
      errorDetails.error_type = 'customer_not_found';
    } else {
      errorDetails.error_type = 'unexpected_error';
    }

    logger.error('KYC initiation failed', errorDetails);

    // Revert to ID upload state for retry
    await updateSession(context.from, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...session.state_data,
        kyc_status: 'failed',
        id_photo_url: undefined,
        selfie_photo_url: undefined,
        id_number: undefined
      }
    });

    // Provide more specific error messages based on failure type
    const httpStatus = axiosErr?.response?.status;
    if (httpStatus === 401 || httpStatus === 403) {
      return `\u26A0\uFE0F *Service Temporarily Unavailable*

Our verification service is being configured. Please try again later or contact support.

Reference: KYC-AUTH-${Date.now()}`;
    }

    return `\u26A0\uFE0F *Verification Error*

We had trouble processing your documents. This could be due to:
\u2022 Image quality too low
\u2022 Network issues

Please try again. Type your National ID number to restart verification.
Format: *XX-XXXXXXX-X-XX*`;
  }
}

// ===================================================================
// CUSTOMER DEDUPLICATION BY NATIONAL ID
// ===================================================================

/**
 * Check if another customer already has this national ID.
 * If so, merge to the existing record (preserving loan history).
 * If not, store the national ID on the current customer.
 *
 * Returns the customer_id to use going forward (may differ from currentCustomerId
 * if a merge occurred).
 */
async function deduplicateByNationalId(
  currentCustomerId: string,
  nationalId: string,
  whatsappNumber: string
): Promise<string> {
  try {
    // Check if another customer already owns this national ID
    const { data: existingCustomer } = await db
      .from('customers')
      .select('id')
      .eq('national_id', nationalId)
      .neq('id', currentCustomerId)
      .maybeSingle()
      .execute();

    if (existingCustomer) {
      // Existing customer found — merge to their record
      logger.info('Customer dedup: merging to existing record', {
        action: 'kyc.dedup',
        status: 'completed',
        meta: {
          existing_customer_id: existingCustomer.id,
          duplicate_customer_id: currentCustomerId,
        },
      });

      // Update existing customer's whatsapp_number to current phone
      await db.from('customers')
        .update({ whatsapp_number: whatsappNumber })
        .eq('id', existingCustomer.id)
        .execute();

      // Delete the duplicate customer record created during this session
      await db.from('customers')
        .delete()
        .eq('id', currentCustomerId)
        .execute();

      return existingCustomer.id as string;
    }

    // No duplicate — store national_id on current customer
    await db.from('customers')
      .update({ national_id: nationalId })
      .eq('id', currentCustomerId)
      .execute();

    return currentCustomerId;
  } catch (error) {
    // Non-fatal: if dedup fails, continue with current customer
    logger.error('Customer dedup failed', {
      action: 'kyc.dedup',
      status: 'failed',
      meta: { error: error instanceof Error ? error.message : 'Unknown' },
    });
    return currentCustomerId;
  }
}
