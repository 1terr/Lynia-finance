/**
 * Reschedule Calculator Module
 *
 * Calculation logic for new terms, rates, payment amounts,
 * maturity dates, and holiday end dates.
 */

import type { RescheduleRequest } from './reschedule-types';
import { RescheduleError } from './reschedule-types';

export interface OriginalTerms {
  term_months: number;
  interest_rate: number;
  monthly_amount: number;
  outstanding: number;
}

export interface NewTerms {
  term_months: number;
  interest_rate: number;
  monthly_amount: number;
  outstanding: number;
}

/**
 * Compute new loan terms based on the reschedule request type
 */
export function computeNewTerms(
  request: RescheduleRequest,
  original: OriginalTerms
): NewTerms {
  let newTermMonths = original.term_months;
  let newInterestRate = original.interest_rate;
  const newOutstanding = original.outstanding;

  switch (request.reschedule_type) {
    case 'term_extension': {
      const additionalMonths = (request.new_term_months || original.term_months + 3) - original.term_months;
      if (additionalMonths <= 0 || additionalMonths > 6) {
        throw new RescheduleError(
          'Term extension must be between 1-6 additional months',
          'RESCHED_TERM_001'
        );
      }
      newTermMonths = original.term_months + additionalMonths;
      break;
    }

    case 'rate_reduction': {
      const newRate = request.new_interest_rate;
      if (newRate === undefined || newRate >= original.interest_rate) {
        throw new RescheduleError(
          'New interest rate must be lower than current rate',
          'RESCHED_RATE_001'
        );
      }
      if (newRate < 0) {
        throw new RescheduleError('Interest rate cannot be negative', 'RESCHED_RATE_002');
      }
      newInterestRate = newRate;
      break;
    }

    case 'payment_holiday': {
      const holidayMonths = request.holiday_months || 1;
      if (holidayMonths < 1 || holidayMonths > 3) {
        throw new RescheduleError(
          'Payment holiday must be 1-3 months',
          'RESCHED_HOLIDAY_001'
        );
      }
      newTermMonths = original.term_months + holidayMonths;
      break;
    }

    case 'balance_restructure': {
      // For hardship: reduce outstanding by agreed settlement amount
      // The outstanding stays the same but terms are adjusted
      newTermMonths = request.new_term_months || original.term_months + 3;
      newInterestRate = request.new_interest_rate ?? 0; // 0% during hardship
      break;
    }

    case 'combined': {
      if (request.new_term_months) {
        newTermMonths = request.new_term_months;
      }
      if (request.new_interest_rate !== undefined) {
        newInterestRate = request.new_interest_rate;
      }
      if (request.holiday_months) {
        newTermMonths += request.holiday_months;
      }
      break;
    }
  }

  // Calculate new monthly amount
  const remainingMonths = newTermMonths - (original.term_months - Math.ceil(original.outstanding / (original.monthly_amount || 1)));
  const effectiveMonths = Math.max(remainingMonths, 1);
  const newMonthlyAmount = Math.round((newOutstanding / effectiveMonths) * 100) / 100;

  return {
    term_months: newTermMonths,
    interest_rate: newInterestRate,
    monthly_amount: newMonthlyAmount,
    outstanding: newOutstanding,
  };
}

/**
 * Calculate the maturity date based on a start date and term in months
 */
export function calculateMaturityDate(startDate: string, termMonths: number): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + termMonths);
  return date.toISOString().slice(0, 10);
}

/**
 * Calculate the holiday end date from a start date and number of months
 */
export function calculateHolidayEndDate(startDate: string, months: number): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}
