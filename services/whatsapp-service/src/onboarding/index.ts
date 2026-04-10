/**
 * WhatsApp Onboarding - State Machine Router
 *
 * 11-Step Onboarding Process:
 * 1. Welcome & Language Selection
 * 2. Zimbabwe Phone Validation
 * 3. Personal Information Collection
 * 4. Employment & Income Collection
 * 5. Product Selection
 * 6. KYC Document Upload
 * 7. Credit Scoring
 * 8. Device Selection
 * 9. Term Selection
 * 10. Loan Summary
 * 11. Terms Acceptance
 *
 * Decomposed from the original onboarding monolith into modular state handlers.
 */

import { logger } from '../../../shared/utils/logger';
import { getOrCreateSession, updateSession } from './session';
import { handleWelcome } from './states/welcome';
import { handlePersonalInfo } from './states/personal-info';
import { handleEmployment } from './states/employment-info';
import { handleProductSelection } from './states/product-selection';
import { handleOrgVerification } from './states/org-verification';
import { handleDigitalProductSelection } from './states/digital-product-selection';
import { handleKYCIdUpload, handleKYCSelfieUpload } from './states/kyc-upload';
import { handleCreditScoring } from './states/credit-scoring';
import { handleDeviceSelection } from './states/device-selection';
import { handleAmountSelection } from './states/amount-selection';
import { handleTermSelection } from './states/term-selection';
import { handleLoanSummary, handleLoanOffer, handleTermsAcceptance } from './states/loan-offer';
import { handleDisbursementMethodSelection } from './states/disbursement-method';
import handleKYCProcessing from './states/kyc-processing';
import type { MessageContext, WhatsAppResponse } from './types';

// ===================================================================
// MAIN ONBOARDING ROUTER
// ===================================================================

/**
 * Route incoming message to appropriate state handler.
 * Returns a WhatsAppResponse: either a plain string (text message)
 * or a ButtonsResponse/ListResponse (interactive message).
 */
export async function routeOnboardingMessage(
  context: MessageContext,
  imageUrl?: string
): Promise<WhatsAppResponse> {
  try {
    const session = await getOrCreateSession(context.from);

    logger.debug('Routing onboarding message', { action: 'onboarding.route', meta: { state: session.current_state } });

    // Handle restart command
    if (context.message.toLowerCase().includes('restart')) {
      await updateSession(context.from, {
        current_state: 'welcome',
        state_data: {}
      });
      return handleWelcome(context);
    }

    // Route based on current state
    switch (session.current_state) {
      case 'welcome':
        return handleWelcome(context);

      case 'collecting_personal_info':
        return handlePersonalInfo(session, context);

      case 'collecting_employment':
        return handleEmployment(session, context);

      case 'product_selection':
        return handleProductSelection(session, context);

      case 'org_verification':
        return handleOrgVerification(session, context);

      case 'digital_product_selection':
        return handleDigitalProductSelection(session, context);

      case 'kyc_id_upload':
        return handleKYCIdUpload(session, context, imageUrl);

      case 'kyc_selfie_upload':
        return handleKYCSelfieUpload(session, context, imageUrl);

      case 'kyc_processing':
        return handleKYCProcessing(session, context);

      case 'credit_scoring':
        return handleCreditScoring(session, context);

      case 'device_selection':
        return handleDeviceSelection(session, context);

      case 'amount_selection':
        return handleAmountSelection(session, context);

      case 'term_selection':
        return handleTermSelection(session, context);

      case 'loan_summary':
        return handleLoanSummary(session, context);

      // Backward compat for in-flight sessions
      case 'loan_offer':
        return handleLoanOffer(session, context);

      case 'disbursement_method_selection':
        return handleDisbursementMethodSelection(session, context);

      case 'terms_acceptance':
        return handleTermsAcceptance(session, context);

      case 'completed': {
        const isDigital = session.state_data.selected_product === 'digital_credit';
        if (isDigital) {
          return `You've already completed onboarding!

Your digital loan is approved and funds have been sent to your mobile money account.

Type *BALANCE* to check your loan or *SUPPORT* for help.`;
        }
        return `You've already completed onboarding!

Your application is approved. Visit your nearest distributor to collect your device.

Need help? Reply *Support*`;
      }

      default:
        return `Something went wrong. Reply *Restart* to begin again.`;
    }
  } catch (error) {
    logger.error('Onboarding routing error', { action: 'onboarding.route', meta: { error: error instanceof Error ? error.message : 'Unknown' } });
    return '⚠️ Technical error. Please try again or contact support@lynia.finance';
  }
}

// ===================================================================
// RE-EXPORTS for backward compatibility
// ===================================================================

export type { OnboardingState, OnboardingSession, MessageContext, WhatsAppResponse, ButtonsResponse, ListResponse } from './types';
export { getOrCreateSession, updateSession } from './session';
export { handleWelcome } from './states/welcome';
export { handlePersonalInfo } from './states/personal-info';
export { handleEmployment } from './states/employment-info';
export { handleProductSelection } from './states/product-selection';
export { handleOrgVerification } from './states/org-verification';
export { handleDigitalProductSelection } from './states/digital-product-selection';
export { handleKYCIdUpload, handleKYCSelfieUpload } from './states/kyc-upload';
export { handleCreditScoring } from './states/credit-scoring';
export { handleDeviceSelection } from './states/device-selection';
export { handleAmountSelection } from './states/amount-selection';
export { handleTermSelection } from './states/term-selection';
export { handleLoanSummary, handleLoanOffer, handleTermsAcceptance } from './states/loan-offer';
export { handleDisbursementMethodSelection } from './states/disbursement-method';
export { resumeOnboardingAfterKYC } from './states/kyc-processing';
