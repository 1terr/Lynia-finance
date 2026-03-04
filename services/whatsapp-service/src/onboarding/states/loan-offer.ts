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
    const downPaymentPct = session.state_data.down_payment_percentage || 20;
    const interestRate = session.state_data.interest_rate_apr || 4;
    const downPayment = Math.round(creditLimit * (downPaymentPct / 100));
    const financed = creditLimit - downPayment;
    const monthlyPayment = Math.round((financed * (1 + interestRate / 100)) / 6);

    return `\uD83D\uDCC4 *Loan Terms & Conditions*

Before we proceed, please review:

1. You'll make 6-12 monthly payments
2. Device will be locked if payment is missed
3. Device unlocks after final payment
4. No early repayment penalties
5. ${downPaymentPct}% down payment required

*Your Loan Details:*
\u2022 Maximum: $${creditLimit}
\u2022 Term: 6-12 months
\u2022 Interest rate: ${interestRate}% APR
\u2022 Monthly payment: ~$${monthlyPayment}
\u2022 Down payment: $${downPayment} (${downPaymentPct}%)

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

    const depositPct = session.state_data.down_payment_percentage || 20;
    const creditLimitVal = session.state_data.credit_limit_usd || 200;
    const depositAmount = Math.round(creditLimitVal * (depositPct / 100));

    return `\u2705 *Application Approved!*

Congratulations! Your loan application is approved.

*Step 1: Pay Your Deposit*
\uD83D\uDCB5 Amount: $${depositAmount} USD (${depositPct}% of $${creditLimitVal})

*How to pay:*
\u2022 EcoCash: Dial *151*2*1# and pay to merchant code *LYNIA*
\u2022 OneMoney: Dial *111# and pay to merchant *LYNIA*
\u2022 InnBucks: Send to LYNIA in the InnBucks app

Use your phone number as reference.

*Step 2: Visit a Distributor (after deposit is confirmed)*
We'll send you a confirmation message once your deposit is received. Then visit:

\uD83D\uDCCD *Tech Hub Harare*
   123 Jason Moyo Ave, Harare
   Mon-Sat, 9am-6pm

*What to bring:*
\u2705 Your National ID
\u2705 This phone (for verification)
\u2705 Deposit payment confirmation

Welcome to Lynia Finance! \uD83C\uDF89`;
  }

  return `Please reply *I Accept* to accept the loan terms and complete your application.`;
}
