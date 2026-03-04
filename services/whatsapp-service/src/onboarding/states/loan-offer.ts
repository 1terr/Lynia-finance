/**
 * WhatsApp Onboarding - Loan Summary & Terms Acceptance State Handlers
 *
 * Presents the final loan summary (device-based, declining balance) and
 * handles terms acceptance flow.
 */

import { db } from '../../../../shared/clients/database';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle LOAN_SUMMARY state (and legacy LOAN_OFFER state for in-flight sessions).
 *
 * The customer has already seen the summary in the term_selection response.
 * Here we handle their Yes/Back responses.
 */
export async function handleLoanSummary(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  // "Back" — return to credit_scoring which will re-show device list
  if (message === 'back' || message.includes('change')) {
    await updateSession(context.from, {
      current_state: 'credit_scoring',
      state_data: {
        ...session.state_data,
        selected_device_id: undefined,
        selected_device_price: undefined,
        selected_device_name: undefined,
        selected_term_months: undefined,
        monthly_payment: undefined,
        total_repayment: undefined,
        financed_amount: undefined,
        deposit_amount: undefined,
        available_devices: undefined,
        allowed_terms: undefined,
      }
    });

    return 'No problem! Let\'s start again.\n\nReply with any message to see the available devices.';
  }

  if (message.includes('yes') || message.includes('continue') || message.includes('accept')) {
    await updateSession(context.from, {
      current_state: 'terms_acceptance'
    });

    const deviceName = session.state_data.selected_device_name || 'Smartphone';
    const depositAmt = session.state_data.deposit_amount || 0;
    const termMonths = session.state_data.selected_term_months || 6;
    const interestRate = session.state_data.interest_rate_apr || 4;
    const monthlyPayment = session.state_data.monthly_payment || 0;
    const downPct = session.state_data.down_payment_percentage || 20;

    return `*Loan Terms & Conditions*

Please review before accepting:

1. Device: ${deviceName}
2. You will make ${termMonths} monthly payments of $${monthlyPayment.toFixed(2)}
3. Deposit of $${depositAmt.toFixed(2)} (${downPct}%) required before collection
4. Device will be locked if payment is missed
5. Device unlocks permanently after final payment
6. No early repayment penalties
7. Interest rate: ${interestRate}% APR (declining balance)

Do you accept these terms?

Reply *I Accept* to continue`;
  }

  // Unrecognized input — re-show summary
  const deviceName = session.state_data.selected_device_name || 'Selected device';
  const devicePrice = session.state_data.selected_device_price || 0;
  const depositAmt = session.state_data.deposit_amount || 0;
  const financedAmt = session.state_data.financed_amount || 0;
  const termMonths = session.state_data.selected_term_months || 6;
  const monthlyPayment = session.state_data.monthly_payment || 0;

  return `*Your Loan Summary*

Device: ${deviceName} ($${devicePrice.toFixed(2)})
Deposit: $${depositAmt.toFixed(2)}
Financed: $${financedAmt.toFixed(2)}
Term: ${termMonths} months
Monthly Payment: *$${monthlyPayment.toFixed(2)}*

Reply *Yes* to accept or *Back* to change your selection.`;
}

// Backward compatibility alias for in-flight sessions
export const handleLoanOffer = handleLoanSummary;

/**
 * Handle TERMS_ACCEPTANCE state
 */
export async function handleTermsAcceptance(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  if (message.includes('accept') || message.includes('i accept')) {
    // Log consent (schema: migration 007 - customer_consents table)
    await db.from('customer_consents').insert({
      customer_id: session.customer_id,
      purpose: 'loan_terms',
      granted: true,
      granted_at: new Date(),
      consent_method: 'whatsapp'
    }).execute();

    await updateSession(context.from, {
      current_state: 'completed',
      state_data: {
        ...session.state_data
      }
    });

    const depositAmount = session.state_data.deposit_amount || 0;
    const deviceName = session.state_data.selected_device_name || 'your device';
    const termMonths = session.state_data.selected_term_months || 6;
    const monthlyPayment = session.state_data.monthly_payment || 0;

    return `*Application Approved!*

Congratulations! Your loan for ${deviceName} is approved.

*Step 1: Pay Your Deposit*
Amount: $${depositAmount.toFixed(2)}

*How to pay:*
- EcoCash: Dial *151*2*1# and pay to merchant code *LYNIA*
- OneMoney: Dial *111# and pay to merchant *LYNIA*
- InnBucks: Send to LYNIA in the InnBucks app

Use your phone number as reference.

*Step 2: Visit a Distributor (after deposit is confirmed)*
We will send you a confirmation once your deposit is received.

*Your Payment Plan:*
${termMonths} monthly payments of $${monthlyPayment.toFixed(2)}

*What to bring:*
- Your National ID
- This phone (for verification)
- Deposit payment confirmation

Welcome to Lynia Finance!`;
  }

  return 'Please reply *I Accept* to accept the loan terms and complete your application.';
}
