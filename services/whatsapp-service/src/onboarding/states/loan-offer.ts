/**
 * WhatsApp Onboarding - Loan Summary & Terms Acceptance State Handlers
 *
 * Presents the final loan summary (device-based, declining balance) and
 * handles terms acceptance flow.
 */

import { db, query } from '../../../../shared/clients/database';
import { updateSession } from '../session';
import { getAllowedTermsForProduct } from '../../../../shared/utils/loan-calculator';
import { syncLoanToFineract, approveLoanInFineract } from '../../../../shared/clients/fineract-sync';
import { logger } from '../../../../shared/utils/logger';
import { t, type SupportedLanguage } from '../../i18n';
import type { OnboardingSession, MessageContext } from '../types';

function formatDisbursementMethod(method: string): string {
  switch (method) {
    case 'ecocash': return 'EcoCash';
    case 'onemoney': return 'OneMoney';
    case 'innbucks': return 'InnBucks';
    default: return method;
  }
}

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

  const isDigital = session.state_data.selected_product === 'digital_credit';

  // "Back" — return to term_selection, preserving device/amount choice
  if (message === 'back' || message.includes('change')) {
    const minTerm = session.state_data.matched_product_min_term ?? 6;
    const maxTerm = session.state_data.matched_product_max_term ?? 12;
    const allowedTerms = getAllowedTermsForProduct(minTerm, maxTerm);

    await updateSession(context.from, {
      current_state: 'term_selection',
      state_data: {
        ...session.state_data,
        selected_term_months: undefined,
        monthly_payment: undefined,
        total_repayment: undefined,
        financed_amount: undefined,
        deposit_amount: undefined,
        allowed_terms: allowedTerms,
      }
    });

    const termList = allowedTerms
      .map((months, i) => `${i + 1}. ${months} months`)
      .join('\n');

    if (isDigital) {
      const loanAmount = session.state_data.requested_loan_amount || 0;
      return `Cash Loan: *$${loanAmount.toFixed(2)}*

How long would you like to pay?

${termList}

Reply with the number of your choice, or *Back* to change amount.`;
    }

    const deviceName = session.state_data.selected_device_name || 'Selected device';
    const devicePrice = session.state_data.selected_device_price || 0;

    return `Device: *${deviceName}* ($${devicePrice.toFixed(2)})

How long would you like to pay?

${termList}

Reply with the number of your choice, or *Back* to change device.`;
  }

  if (message.includes('yes') || message.includes('continue') || message.includes('accept')) {
    if (isDigital) {
      // Digital: go to disbursement method selection before terms acceptance
      await updateSession(context.from, {
        current_state: 'disbursement_method_selection'
      });

      const lang: SupportedLanguage = session.state_data.preferred_language || 'en';
      return t('disbursement_method_prompt', lang);
    }

    // Smartphone: go directly to terms acceptance
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
  if (isDigital) {
    const loanAmount = session.state_data.financed_amount || 0;
    const termMonths = session.state_data.selected_term_months || 6;
    const monthlyPayment = session.state_data.monthly_payment || 0;
    const totalRepayment = session.state_data.total_repayment || 0;
    const interestRate = session.state_data.interest_rate_apr || 24;

    return `*Your Loan Summary*

Cash Loan: $${loanAmount.toFixed(2)}
Term: ${termMonths} months
Interest: ${interestRate}% APR
Monthly Payment: *$${monthlyPayment.toFixed(2)}*
Total Repayment: $${totalRepayment.toFixed(2)}

Reply *Yes* to accept or *Back* to change your selection.`;
  }

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

  if (message.includes('accept') || message.includes('i accept') || message.includes('ndinobvuma') || message.includes('ngiyavuma')) {
    const isDigital = session.state_data.selected_product === 'digital_credit';

    // Log consent (schema: migration 007 - customer_consents table)
    await db.from('customer_consents').insert({
      customer_id: session.customer_id,
      purpose: 'loan_terms',
      granted: true,
      granted_at: new Date(),
      consent_method: 'whatsapp'
    }).execute();

    const depositAmount = isDigital ? 0 : (session.state_data.deposit_amount || 0);
    const deviceName = session.state_data.selected_device_name || 'your device';
    const devicePrice = session.state_data.selected_device_price || 0;
    const termMonths = session.state_data.selected_term_months || 6;
    const monthlyPayment = session.state_data.monthly_payment || 0;
    const interestRate = session.state_data.interest_rate_apr || (isDigital ? 24 : 4);
    const financedAmount = isDigital
      ? (session.state_data.requested_loan_amount || session.state_data.financed_amount || 0)
      : (session.state_data.financed_amount || (devicePrice - depositAmount));
    const totalRepayment = session.state_data.total_repayment || (monthlyPayment * termMonths);

    // Generate loan reference number
    const year = new Date().getFullYear();
    const seq = Math.random().toString(36).substring(2, 7).toUpperCase();
    const loanNumber = `LYNIA-${year}-${seq}`;

    // Resolve the loan product for this category
    const productCategory = session.state_data.selected_product === 'digital_credit' ? 'digital' : 'smartphone';
    let productId: string | null = null;
    try {
      const { data: productRows } = await query<{ id: string }>(
        `SELECT id FROM loan_products
         WHERE product_category = $1 AND status = 'active' AND deleted_at IS NULL
         ORDER BY display_order ASC LIMIT 1`,
        [productCategory]
      );
      productId = productRows?.[0]?.id ?? null;
    } catch (productLookupError) {
      logger.error('Failed to resolve loan product', {
        action: 'loan.product-lookup',
        status: 'failed',
        meta: { productCategory, error: productLookupError instanceof Error ? productLookupError.message : String(productLookupError) },
      });
    }

    // Create loan record in database
    let loanId: string | null = null;
    try {
      const { data: loan, error: loanError } = await db
        .from('loans')
        .insert({
          customer_id: session.customer_id,
          product_id: productId,
          product_category: productCategory,
          disbursement_method: productCategory === 'smartphone' ? 'device_handover' : 'ecocash',
          loan_number: loanNumber,
          loan_amount_usd: financedAmount,
          interest_rate: interestRate,
          loan_term_months: termMonths,
          deposit_amount_usd: depositAmount,
          deposit_paid: false,
          status: 'approved',
          approval_status: 'auto_approved',
          approved_at: new Date().toISOString(),
          total_amount_due_usd: totalRepayment,
          outstanding_balance_usd: totalRepayment,
          next_payment_amount_usd: monthlyPayment,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()
        .execute();

      if (loanError || !loan) {
        logger.error('Failed to create loan record', {
          action: 'loan.create',
          status: 'failed',
          meta: { customerId: session.customer_id, error: String(loanError) },
        });
      } else {
        loanId = loan.id;
      }
    } catch (loanCreateError) {
      logger.error('Loan creation threw error', {
        action: 'loan.create',
        status: 'failed',
        meta: { error: loanCreateError instanceof Error ? loanCreateError.message : String(loanCreateError) },
      });
    }

    // Non-blocking: Sync loan to Fineract (create + auto-approve)
    if (loanId && process.env.FINERACT_SECRET_NAME) {
      syncLoanToFineractAfterAcceptance(loanId, session, productId).catch((err) => {
        logger.error('Fineract loan sync failed', {
          action: 'loan.fineract-sync',
          status: 'failed',
          meta: { loanId, error: err instanceof Error ? err.message : String(err) },
        });
      });
    }

    // Queue disbursement for digital loans (push-to-wallet)
    if (isDigital && loanId) {
      try {
        const disbursementMethod = session.state_data.disbursement_method || 'ecocash';
        const queueUrl = process.env.PAYMENT_QUEUE_URL;
        if (queueUrl) {
          const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
          const sqs = new SQSClient({});
          await sqs.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              action: 'disburse',
              loan_id: loanId,
              customer_id: session.customer_id,
              amount: financedAmount,
              customer_phone: context.from,
              disbursement_method: disbursementMethod,
              currency: 'USD',
            }),
          }));
          logger.info('Queued digital loan disbursement', {
            action: 'loan.disbursement.queued',
            loanId,
            amount: financedAmount,
            method: disbursementMethod,
          });
        }
      } catch (disbError) {
        logger.error('Failed to queue disbursement', {
          action: 'loan.disbursement.queue-failed',
          loanId,
          errorMessage: disbError instanceof Error ? disbError.message : String(disbError),
        });
        // Don't fail the whole flow — admin can retry disbursement
      }
    }

    await updateSession(context.from, {
      current_state: 'completed',
      state_data: {
        ...session.state_data,
        loan_id: loanId ?? undefined,
        loan_number: loanNumber ?? undefined,
      }
    });

    if (isDigital) {
      const methodName = formatDisbursementMethod(session.state_data.disbursement_method || 'ecocash');
      const lang: SupportedLanguage = session.state_data.preferred_language || 'en';

      return t('digital_loan_approved', lang, {
        loan_number: loanNumber,
        amount: financedAmount.toFixed(2),
        method: methodName,
        term: String(termMonths),
        payment: monthlyPayment.toFixed(2),
      });
    }

    return `*Application Approved!*

Congratulations! Your loan for ${deviceName} is approved.
Loan Reference: *${loanNumber}*

*Step 1: Pay Your Deposit*
Amount: *$${depositAmount.toFixed(2)}*

*How to pay:*
- EcoCash: Dial *151*2*1# and pay to merchant code *LYNIA*
- OneMoney: Dial *111# and pay to merchant *LYNIA*
- InnBucks: Send to LYNIA in the InnBucks app

*IMPORTANT:* Use your *National ID number* as the payment reference.

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

/**
 * Non-blocking: Create loan in Fineract and auto-approve it.
 * Errors are logged but never block the WhatsApp flow.
 */
async function syncLoanToFineractAfterAcceptance(
  loanId: string,
  session: OnboardingSession,
  productId: string | null
): Promise<void> {
  // Look up customer's Fineract client ID
  const { data: customer } = await db
    .from('customers')
    .select('fineract_client_id')
    .eq('id', session.customer_id)
    .single()
    .execute();

  if (!customer?.fineract_client_id) {
    logger.warn('Customer not synced to Fineract yet, skipping loan sync', {
      action: 'loan.fineract-sync',
      meta: { customerId: session.customer_id, loanId },
    });
    return;
  }

  // Resolve Fineract product ID: prefer DB value from loan_products, fall back to env var
  let fineractProductId = 0;
  if (productId) {
    const { data: productRows } = await query<{ fineract_product_id: number | null }>(
      `SELECT fineract_product_id FROM loan_products WHERE id = $1`,
      [productId]
    );
    fineractProductId = productRows?.[0]?.fineract_product_id ?? 0;
  }
  if (!fineractProductId) {
    fineractProductId = parseInt(process.env.FINERACT_SMARTPHONE_PRODUCT_ID || '0', 10);
  }
  if (!fineractProductId) {
    logger.warn('No Fineract product ID found (DB or env), skipping loan sync', {
      action: 'loan.fineract-sync',
      meta: { loanId, productId },
    });
    return;
  }

  const interestRateApr = session.state_data.interest_rate_apr || 4;
  const financedAmount = session.state_data.financed_amount
    || (session.state_data.selected_device_price || 0) - (session.state_data.deposit_amount || 0);
  const termMonths = session.state_data.selected_term_months || 6;

  // Create loan in Fineract (submittedAndPendingApproval state)
  const fineractLoanId = await syncLoanToFineract({
    loanId,
    customerId: session.customer_id,
    fineractClientId: customer.fineract_client_id,
    fineractProductId,
    principal: financedAmount,
    numberOfRepayments: termMonths,
    repaymentEveryMonths: 1,
    interestRatePerMonth: interestRateApr / 12,
    expectedDisbursementDate: new Date(),
  });

  // Auto-approve in Fineract (no admin approval needed)
  if (fineractLoanId) {
    await approveLoanInFineract({ loanId, fineractLoanId });
  }
}
