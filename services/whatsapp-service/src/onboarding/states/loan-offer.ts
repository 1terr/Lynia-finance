/**
 * WhatsApp Onboarding - Loan Offer & Terms Acceptance State Handlers
 *
 * Presents loan offer details and handles terms acceptance flow.
 */

import { db } from '../../../../shared/clients/database';
import { updateSession } from '../session';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle LOAN_OFFER state
 */
export async function handleLoanOffer(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim().toLowerCase();

  if (message.includes('yes') || message.includes('continue')) {
    await updateSession(context.from, {
      current_state: 'terms_acceptance'
    });

    const creditLimit = session.state_data.credit_limit_usd || 200;

    return `\uD83D\uDCC4 *Loan Terms & Conditions*

Before we proceed, please review:

1. You'll make 6-8 monthly payments
2. Device will be locked if payment is missed
3. Device unlocks after final payment
4. No early repayment penalties
5. 10% down payment required

*Your Loan Details:*
\u2022 Maximum: $${creditLimit}
\u2022 Term: 6-8 months
\u2022 Monthly payment: ~$${Math.round((creditLimit * 1.15) / 6)}
\u2022 Down payment: $${Math.round(creditLimit * 0.1)}

Do you accept these terms?

Reply *I Accept* to continue`;
  }

  return `Please reply *Yes* to continue with your loan application.`;
}

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

    return `\u2705 *Onboarding Complete!*

Congratulations! Your application is approved.

*Next Steps:*
1. Visit a Lynia distributor
2. Choose your device
3. Pay deposit (${session.state_data.credit_limit_usd ? Math.round(session.state_data.credit_limit_usd * 0.1) : 20} USD)
4. Collect your device

*Nearest Distributor:*
\uD83D\uDCCD Tech Hub Harare
   123 Jason Moyo Ave, Harare
   Mon-Sat, 9am-6pm

*What to bring:*
\u2705 Your National ID
\u2705 This phone (for verification)

We'll send you payment instructions shortly.

Welcome to Lynia Finance! \uD83C\uDF89`;
  }

  return `Please reply *I Accept* to accept the loan terms and complete your application.`;
}
