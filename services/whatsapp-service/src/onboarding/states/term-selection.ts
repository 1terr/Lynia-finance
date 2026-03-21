/**
 * WhatsApp Onboarding - Term Selection State Handler
 *
 * Customer picks a loan term (e.g. 6, 12, or 18 months).
 * Calculates final loan details using declining balance formula and
 * transitions to loan_summary.
 */

import { query } from '../../../../shared/clients/database';
import { updateSession } from '../session';
import { calculateFlatRatePayment } from '../../../../shared/utils/loan-calculator';
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

  // "Back" — return to previous step
  if (message.toLowerCase() === 'back') {
    const isDigital = session.state_data.selected_product === 'digital_credit';

    if (isDigital) {
      // Digital: go back to amount selection
      const orgLimits = session.state_data.org_lending_limits;
      const maxAmount = session.state_data.credit_limit_usd || orgLimits?.max_loan_amount || 500;
      const minAmount = orgLimits?.min_loan_amount ?? 20;

      await updateSession(context.from, {
        current_state: 'amount_selection',
        state_data: {
          ...session.state_data,
          requested_loan_amount: undefined,
          allowed_terms: undefined,
        }
      });

      return `How much would you like to borrow?\nEnter an amount between $${minAmount} and $${maxAmount.toFixed(2)}`;
    }

    // Smartphone: go back to device selection
    const creditLimit = session.state_data.credit_limit_usd || 200;
    const { data: devices } = await query<{ id: string; brand: string; model_name: string; retail_price_usd: number }>(
      `SELECT id, brand, model_name, retail_price_usd
       FROM device_models
       WHERE retail_price_usd <= $1
         AND is_active = true AND deleted_at IS NULL
       ORDER BY retail_price_usd ASC`,
      [creditLimit]
    );

    await updateSession(context.from, {
      current_state: 'device_selection',
      state_data: {
        ...session.state_data,
        selected_device_id: undefined,
        selected_device_price: undefined,
        selected_device_name: undefined,
        allowed_terms: undefined,
        available_devices: devices || [],
      }
    });

    if (!devices || devices.length === 0) {
      return 'No devices currently available. Please check back later or contact support@lynia.finance.';
    }

    const brandGroups = new Map<string, Array<typeof devices[0]>>();
    for (const d of devices) {
      const group = brandGroups.get(d.brand) || [];
      group.push(d);
      brandGroups.set(d.brand, group);
    }

    let counter = 1;
    const deviceList = Array.from(brandGroups.entries())
      .map(([brand, models]) => {
        const header = `*${brand}:*`;
        const items = models.map(d =>
          `${counter++}. ${d.model_name} - $${Number(d.retail_price_usd).toFixed(2)}`
        ).join('\n');
        return `${header}\n${items}`;
      }).join('\n\n');

    return `Choose your smartphone:\n\n${deviceList}\n\nReply with the number of your choice (e.g. *1*)`;
  }

  const choice = parseInt(message);

  if (isNaN(choice) || choice < 1 || choice > allowedTerms.length) {
    const termList = allowedTerms
      .map((months, i) => `${i + 1}. ${months} months`)
      .join('\n');

    return `Please reply with a number between 1 and ${allowedTerms.length}, or *Back* to change device.

${termList}`;
  }

  const selectedTerm = allowedTerms[choice - 1];
  const isDigital = session.state_data.selected_product === 'digital_credit';

  // Digital: principal = requested amount, no deposit
  // Smartphone: principal = device price - deposit
  const devicePrice = session.state_data.selected_device_price || 0;
  const downPaymentPct = isDigital ? 0 : (session.state_data.down_payment_percentage || 20);
  const interestRateApr = session.state_data.interest_rate_apr || 4;

  const depositAmount = isDigital ? 0 : Math.round(devicePrice * (downPaymentPct / 100) * 100) / 100;
  const financedAmount = isDigital
    ? (session.state_data.requested_loan_amount || 0)
    : Math.round((devicePrice - depositAmount) * 100) / 100;

  const calc = calculateFlatRatePayment({
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

  if (isDigital) {
    return `*Your Loan Summary*

Cash Loan: $${financedAmount.toFixed(2)}
Term: ${selectedTerm} months
Interest: ${interestRateApr}% flat rate

Monthly Payment: *$${calc.monthlyPayment.toFixed(2)}*
Total Repayment: $${calc.totalRepayment.toFixed(2)}

Does this look good?
Reply *Yes* to accept these terms
Reply *Back* to change your selection`;
  }

  const deviceName = session.state_data.selected_device_name || 'Selected device';

  return `*Your Loan Summary*

Device: ${deviceName}
Price: $${devicePrice.toFixed(2)}

Deposit: $${depositAmount.toFixed(2)} (${downPaymentPct}%)
Financed: $${financedAmount.toFixed(2)}
Term: ${selectedTerm} months
Interest: ${interestRateApr}% flat rate

Monthly Payment: *$${calc.monthlyPayment.toFixed(2)}*
Total Repayment: $${calc.totalRepayment.toFixed(2)}

Does this look good?
Reply *Yes* to accept these terms
Reply *Back* to change your selection`;
}
