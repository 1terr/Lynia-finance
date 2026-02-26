/**
 * WhatsApp Onboarding - KYC Processing State Handler
 *
 * Handles the waiting state while KYC verification is in progress,
 * and provides a callback entry point for async KYC results.
 */

import { db } from '../../../../shared/clients/database';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle KYC_PROCESSING state
 * Customer messages while KYC is being verified — tell them to wait.
 */
async function handleKYCProcessing(
  session: OnboardingSession,
  _context: MessageContext
): Promise<string> {
  // Check if KYC has been completed while they were waiting
  if (session.state_data.kyc_verification_id) {
    const { data: customer } = await db
      .from('customers')
      .select('id')
      .eq('whatsapp_number', _context.from)
      .single()
      .execute();

    if (customer) {
      const { data: kycSubmission } = await db
        .from('kyc_submissions')
        .select('status, verification_decision, verification_reason')
        .eq('id', session.state_data.kyc_verification_id)
        .single()
        .execute();

      if (kycSubmission) {
        if (kycSubmission.status === 'verified') {
          await updateSession(_context.from, {
            current_state: 'credit_scoring',
            state_data: { ...session.state_data, kyc_status: 'verified' }
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

        if (kycSubmission.status === 'rejected') {
          const retryCount = (session.state_data.retry_count || 0) + 1;
          const attemptsRemaining = 3 - retryCount;

          if (attemptsRemaining <= 0) {
            await updateSession(_context.from, {
              current_state: 'rejected',
              state_data: { ...session.state_data, kyc_status: 'failed' }
            });

            return `\u274C *Verification Failed*

You have used all 3 verification attempts.

Please contact support: support@lynia.finance`;
          }

          await updateSession(_context.from, {
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

${kycSubmission.verification_reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
        }
      }
    }
  }

  return `\u23F3 *Still Verifying...*

Your identity verification is being processed.

This usually takes 1-5 minutes. We'll message you as soon as it's complete.

Please wait a bit longer.`;
}

// Default export for internal use by the router
export default handleKYCProcessing;

/**
 * Resume onboarding after KYC callback completes.
 * Called by the KYC service when a verification result arrives.
 * Returns the message to send to the customer.
 */
export async function resumeOnboardingAfterKYC(
  phoneNumber: string,
  kycStatus: 'verified' | 'rejected' | 'manual_review',
  reason?: string
): Promise<string | null> {
  const { data: session } = await db
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!session || session.current_state !== 'kyc_processing') {
    return null;
  }

  const stateData = session.state_data || {};

  if (kycStatus === 'verified') {
    await updateSession(phoneNumber, {
      current_state: 'credit_scoring',
      state_data: { ...stateData, kyc_status: 'verified' }
    });

    return `\u2705 *Identity Verified!*

Great news! Your identity has been confirmed.

\u23F3 *Assessing your eligibility...*

We're calculating your loan amount based on:
\u2713 Identity verification
\u2713 Income information
\u2713 First-time borrower status

Reply with any message to continue.`;
  }

  if (kycStatus === 'rejected') {
    const retryCount = (stateData.retry_count || 0) + 1;
    const attemptsRemaining = 3 - retryCount;

    if (attemptsRemaining <= 0) {
      await updateSession(phoneNumber, {
        current_state: 'rejected',
        state_data: { ...stateData, kyc_status: 'failed' }
      });

      return `\u274C *Verification Failed*

You have used all 3 verification attempts.

Please contact support: support@lynia.finance`;
    }

    await updateSession(phoneNumber, {
      current_state: 'kyc_id_upload',
      state_data: {
        ...stateData,
        kyc_status: 'failed',
        id_photo_url: undefined,
        selfie_photo_url: undefined,
        id_number: undefined,
        retry_count: retryCount
      }
    });

    return `\u274C *Verification Unsuccessful*

${reason || 'We could not verify your identity.'}

You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.

Enter your National ID number to try again:
Format: *XX-XXXXXXX-X-XX*`;
  }

  // manual_review
  return `\u23F8\uFE0F *Manual Review Required*

Your verification needs additional review by our team. This typically takes 2-12 hours.

You'll receive a WhatsApp message when complete.`;
}
