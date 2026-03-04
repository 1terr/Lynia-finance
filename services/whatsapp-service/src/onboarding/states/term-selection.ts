/**
 * WhatsApp Onboarding - Term Selection State Handler
 *
 * Customer picks a loan term (e.g. 6, 12, or 18 months).
 * Calculates final loan details using declining balance formula and
 * transitions to loan_summary.
 */

import { updateSession } from '../session';
import { calculateDecliningBalancePayment } from '../../../../shared/utils/loan-calculator';
import type { OnboardingSession, MessageContext } from '../types';

/**
 * Handle TERM_SELECTION state
 */
export async function handleTermSelection(
  session: OnboardingSession,
  context: MessageContext
): Promise<string> {
  const message = context.message.trim();
  const allowedTerms = session.state_data.allowed_terms;

  if (!allowedTerms || allowedTerms.length === 0) {
    return 'Something went wrong. Reply *Restart* to begin again.';
  }

  const choice = parseInt(message);

  if (isNaN(choice) || choice < 1 || choice > allowedTerms.length) {
    const termList = allowedTerms
      .map((months, i) => `${i + 1}. ${months} months`)
      .join('\n');

    return `Please reply with a number between 1 and ${allowedTerms.length}.

${termList}`;
  }

  const selectedTerm = allowedTerms[choice - 1];
  const devicePrice = session.state_data.selected_device_price || 0;
  const downPaymentPct = session.state_data.down_payment_percentage || 20;
  const interestRateApr = session.state_data.interest_rate_apr || 4;

  const depositAmount = Math.round(devicePrice * (downPaymentPct / 100) * 100) / 100;
  const financedAmount = Math.round((devicePrice - depositAmount) * 100) / 100;

  const calc = calculateDecliningBalancePayment({
    principal: financedAmount,
    annualRatePercent: interestRateApr,
    termMonths: selectedTerm,
  });

  await updateSession(context.from, {
    current_state: 'loan_summary',
    state_data: {
      ...session.state_data,
      selected_term_months: selectedTerm,
      monthly_payment: calc.monthlyPayment,
      total_repayment: calc.totalRepayment,
      financed_amount: financedAmount,
      deposit_amount: depositAmount,
      allowed_terms: undefined,
    }
  });

  const deviceName = session.state_data.selected_device_name || 'Selected device';

  return `*Your Loan Summary*

Device: ${deviceName}
Price: $${devicePrice.toFixed(2)}

Deposit: $${depositAmount.toFixed(2)} (${downPaymentPct}%)
Financed: $${financedAmount.toFixed(2)}
Term: ${selectedTerm} months
Interest: ${interestRateApr}% APR

Monthly Payment: *$${calc.monthlyPayment.toFixed(2)}*
Total Repayment: $${calc.totalRepayment.toFixed(2)}

Does this look good?
Reply *Yes* to accept these terms
Reply *Back* to change your selection`;
}
