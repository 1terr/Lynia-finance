import { db } from '../../../shared/clients/database';
import logger from '../../../shared/utils/logger';
import axios from 'axios';
import type { KYCVerificationResult } from '../../../shared/types/kyc-provider';
import { kycProvider } from './provider-instance';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Process a KYC verification result (used by both synchronous and callback flows).
 */
export async function processKYCResult(
  submissionId: string,
  customerId: string,
  result: KYCVerificationResult
): Promise<void> {
  // Determine verification decision
  const { decision, reason } = kycProvider.determineDecision(result);

  logger.info(`KYC decision for ${customerId}: ${decision} - ${reason}`, {
    action: 'kyc.decision',
    status: 'completed',
    customerId,
    decision,
    reason,
  });

  // Update KYC submission with provider-agnostic columns
  const updateData: Record<string, unknown> = {
    verification_decision: decision,
    verification_reason: reason,
    verification_confidence: result.confidence_score,
    liveness_score: result.liveness_score,
    face_match_score: result.face_match_score,
    provider_response: result.raw_response
  };

  if (decision === 'APPROVED') {
    updateData.status = 'verified';
    updateData.verified_at = new Date().toISOString();
  } else if (decision === 'REJECTED') {
    updateData.status = 'rejected';
    updateData.rejected_at = new Date().toISOString();
  } else {
    updateData.status = 'manual_review';
    updateData.manual_review_required = true;
  }

  const { error: updateError } = await db
    .from('kyc_submissions')
    .update(updateData)
    .eq('id', submissionId)
    .execute();

  if (updateError) {
    logger.error('Failed to update KYC submission', {
      action: 'kyc.decision',
      status: 'failed',
      customerId,
      submissionId,
      errorMessage: updateError.message,
    });
  }

  // Update customer KYC status
  if (decision === 'APPROVED') {
    const { error: customerError } = await db
      .from('customers')
      .update({
        kyc_status: 'verified',
        kyc_verified_at: new Date().toISOString(),
        date_of_birth: result.id_info.date_of_birth,
        gender: result.id_info.gender === 'M' ? 'male' : 'female'
      })
      .eq('id', customerId)
      .execute();

    if (customerError) {
      logger.error('Failed to update customer KYC status', {
        action: 'kyc.customer-update',
        status: 'failed',
        customerId,
        errorMessage: customerError.message,
      });
    }

    logger.info(`Customer ${customerId} KYC approved via ${result.provider}`, {
      action: 'kyc.approved',
      status: 'completed',
      customerId,
      provider: result.provider,
    });
  } else if (decision === 'MANUAL_REVIEW') {
    // Create manual review task
    await db
      .from('kyc_manual_reviews')
      .insert({
        kyc_submission_id: submissionId,
        customer_id: customerId,
        review_status: 'pending',
        sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'normal',
        created_at: new Date().toISOString()
      })
      .execute();

    logger.info(`Manual review created for customer ${customerId}`, {
      action: 'kyc.manual_review.created',
      status: 'completed',
      customerId,
      submissionId,
    });
  }

  // Send KYC result notification to customer via WhatsApp
  await sendKYCResultNotification(customerId, decision, reason);
}

/**
 * Send KYC result notification to customer via WhatsApp Cloud API.
 * Updates the onboarding session state based on the KYC decision.
 */
async function sendKYCResultNotification(
  customerId: string,
  decision: string,
  reason: string
): Promise<void> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    logger.warn('WhatsApp credentials not configured, skipping KYC notification', {
      action: 'kyc.notification',
      status: 'failed',
      errorMessage: 'Missing WhatsApp credentials',
    });
    return;
  }

  try {
    // Look up customer phone number
    const { data: customer } = await db
      .from('customers')
      .select('phone_number, whatsapp_number')
      .eq('id', customerId)
      .single()
      .execute();

    if (!customer) {
      logger.warn(`Customer ${customerId} not found, skipping notification`, {
        action: 'kyc.notification',
        status: 'failed',
        errorMessage: 'Customer not found',
        customerId,
      });
      return;
    }

    const phoneNumber = customer.whatsapp_number || customer.phone_number;
    if (!phoneNumber) {
      logger.warn(`No phone number for customer ${customerId}`, {
        action: 'kyc.notification',
        status: 'failed',
        errorMessage: 'No phone number',
        customerId,
      });
      return;
    }

    // Build notification message based on decision
    let message: string;
    if (decision === 'APPROVED') {
      message = `✅ *Identity Verified!*

Great news! Your identity has been confirmed.

⏳ *Assessing your eligibility...*

We're calculating your loan amount based on:
✓ Identity verification
✓ Income information
✓ First-time borrower status

Reply with any message to continue.`;
    } else if (decision === 'REJECTED') {
      message = `❌ *Verification Unsuccessful*

${reason || 'We could not verify your identity.'}

You may have remaining attempts. Reply with any message to check your options.`;
    } else {
      // MANUAL_REVIEW
      message = `⏸️ *Manual Review Required*

Your verification needs additional review by our team. This typically takes 2-12 hours.

You'll receive a WhatsApp message when complete.`;
    }

    // Update onboarding session state
    const kycStatus = decision === 'APPROVED' ? 'verified'
      : decision === 'REJECTED' ? 'rejected'
      : 'manual_review';

    // Update session: move to credit_scoring if approved, back to kyc_id_upload if rejected
    const { data: session } = await db
      .from('whatsapp_sessions')
      .select('current_state, state_data')
      .eq('phone_number', phoneNumber)
      .single()
      .execute();

    if (session && session.current_state === 'kyc_processing') {
      const stateData = session.state_data || {};

      if (decision === 'APPROVED') {
        await db
          .from('whatsapp_sessions')
          .update({
            current_state: 'credit_scoring',
            state_data: { ...stateData, kyc_status: 'verified' },
            last_activity_at: new Date()
          })
          .eq('phone_number', phoneNumber)
          .execute();
      } else if (decision === 'REJECTED') {
        const retryCount = (stateData.retry_count || 0) + 1;
        const nextState = retryCount >= 3 ? 'rejected' : 'kyc_id_upload';

        await db
          .from('whatsapp_sessions')
          .update({
            current_state: nextState,
            state_data: {
              ...stateData,
              kyc_status: kycStatus,
              id_photo_url: undefined,
              selfie_photo_url: undefined,
              id_number: undefined,
              retry_count: retryCount
            },
            last_activity_at: new Date()
          })
          .eq('phone_number', phoneNumber)
          .execute();
      }
    }

    // Send WhatsApp message via Cloud API
    const sanitizedPhone = phoneNumber.replace(/[\s\-+()]/g, '');
    await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: sanitizedPhone,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`KYC notification sent to customer ${customerId} (${decision})`, {
      action: 'kyc.notification',
      status: 'completed',
      customerId,
      decision,
    });

  } catch (error) {
    // Non-fatal: log but don't fail the KYC processing
    logger.error('Failed to send KYC notification', {
      action: 'kyc.notification',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      customerId,
    });
  }
}
