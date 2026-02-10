/**
 * Payment Method Analytics (T014)
 *
 * Tracks which payment methods customers use (EcoCash, OneMoney, O'mari, etc.)
 * to inform decisions about when direct O'mari integration is justified.
 *
 * Decision rule from T014 research:
 * Pursue direct O'mari API when:
 *   (Paynow fees - Direct fees) x 12 months > Development cost + $10,000 safety margin
 *
 * This module provides the data needed to evaluate that threshold.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type TrackedPaymentMethod =
  | 'ecocash'
  | 'onemoney'
  | 'omari'
  | 'visa'
  | 'mastercard'
  | 'zimswitch'
  | 'innbucks'
  | 'bank_transfer'
  | 'cash'
  | 'unknown';

export interface PaymentMethodEvent {
  payment_id: string;
  loan_id: string;
  customer_id: string;
  payment_method: TrackedPaymentMethod;
  gateway: string;
  amount: number;
  currency: string;
  fee_amount: number;
  fee_percentage: number;
  status: 'initiated' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export interface PaymentMethodBreakdown {
  payment_method: TrackedPaymentMethod;
  transaction_count: number;
  total_amount: number;
  total_fees: number;
  average_amount: number;
  percentage_of_total: number;
}

export interface PaymentAnalyticsSummary {
  period_start: string;
  period_end: string;
  total_transactions: number;
  total_volume: number;
  total_fees: number;
  breakdown: PaymentMethodBreakdown[];
  omari_percentage: number;
  direct_integration_roi_estimate: number;
}

// ===================================================================
// FEE RATES
// ===================================================================

/**
 * Current fee structure by gateway/method.
 * Paynow charges 3.5% for all mobile money methods.
 * Direct integration estimates from T014 research.
 */
const FEE_RATES: Record<string, Record<string, number>> = {
  paynow: {
    ecocash: 0.035,
    onemoney: 0.035,
    omari: 0.035,
    visa: 0.035,
    mastercard: 0.035,
    zimswitch: 0.035,
  },
  direct: {
    ecocash: 0.02,     // Estimated direct EcoCash fee
    onemoney: 0.02,    // Estimated direct OneMoney fee
    omari: 0.01,       // Estimated direct O'mari fee (T014: 1%)
  },
};

// ===================================================================
// ANALYTICS SERVICE
// ===================================================================

export class PaymentAnalyticsService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Record a payment method event for analytics
   */
  async trackPaymentMethod(event: PaymentMethodEvent): Promise<void> {
    try {
      await this.supabase.from('payment_method_analytics').insert({
        payment_id: event.payment_id,
        loan_id: event.loan_id,
        customer_id: event.customer_id,
        payment_method: event.payment_method,
        gateway: event.gateway,
        amount: event.amount,
        currency: event.currency,
        fee_amount: event.fee_amount,
        fee_percentage: event.fee_percentage,
        status: event.status,
        created_at: event.created_at,
      });
    } catch (error) {
      // Analytics tracking should never block the payment flow
      console.error('Failed to track payment method:', error);
    }
  }

  /**
   * Detect payment method from Paynow webhook data.
   *
   * Paynow doesn't directly report which mobile money provider was used,
   * so we infer from available data (reference format, phone prefix, etc.)
   */
  detectPaymentMethod(
    paynowReference: string,
    customerPhone?: string
  ): TrackedPaymentMethod {
    const ref = paynowReference.toUpperCase();

    // O'mari references typically contain OM or 707
    if (ref.includes('OM') || ref.includes('707')) {
      return 'omari';
    }

    // EcoCash references typically start with MP or EC
    if (ref.startsWith('MP') || ref.startsWith('EC')) {
      return 'ecocash';
    }

    // OneMoney references
    if (ref.startsWith('ON') || ref.startsWith('OM1')) {
      return 'onemoney';
    }

    // Infer from phone number prefix if reference doesn't tell us
    if (customerPhone) {
      const cleaned = customerPhone.replace(/\D/g, '');
      // Econet prefixes (EcoCash): 77, 78
      if (/^263(77|78)/.test(cleaned)) return 'ecocash';
      // NetOne prefixes (OneMoney): 71
      if (/^26371/.test(cleaned)) return 'onemoney';
      // Telecel prefixes: 73
      if (/^26373/.test(cleaned)) return 'ecocash'; // Telecel users often use EcoCash
    }

    return 'unknown';
  }

  /**
   * Calculate fee amount for a given payment
   */
  calculateFee(amount: number, gateway: string, method: TrackedPaymentMethod): number {
    const gatewayRates = FEE_RATES[gateway] || FEE_RATES.paynow;
    const rate = gatewayRates[method] || 0.035; // Default to Paynow's 3.5%
    return amount * rate;
  }

  /**
   * Get payment method breakdown for a date range.
   * Used for dashboard analytics and ROI calculations.
   */
  async getBreakdown(
    startDate: string,
    endDate: string
  ): Promise<PaymentAnalyticsSummary> {
    try {
      const { data: analytics, error } = await this.supabase
        .from('payment_method_analytics')
        .select('payment_method, amount, fee_amount, status')
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error || !analytics) {
        throw new Error('Failed to fetch payment analytics');
      }

      // Aggregate by payment method
      const methodMap = new Map<TrackedPaymentMethod, {
        count: number;
        totalAmount: number;
        totalFees: number;
      }>();

      for (const record of analytics) {
        const method = record.payment_method as TrackedPaymentMethod;
        const existing = methodMap.get(method) || { count: 0, totalAmount: 0, totalFees: 0 };
        existing.count++;
        existing.totalAmount += record.amount || 0;
        existing.totalFees += record.fee_amount || 0;
        methodMap.set(method, existing);
      }

      const totalTransactions = analytics.length;
      const totalVolume = analytics.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalFees = analytics.reduce((sum, r) => sum + (r.fee_amount || 0), 0);

      const breakdown: PaymentMethodBreakdown[] = [];
      for (const [method, data] of methodMap) {
        breakdown.push({
          payment_method: method,
          transaction_count: data.count,
          total_amount: data.totalAmount,
          total_fees: data.totalFees,
          average_amount: data.count > 0 ? data.totalAmount / data.count : 0,
          percentage_of_total: totalTransactions > 0
            ? (data.count / totalTransactions) * 100
            : 0,
        });
      }

      // Sort by transaction count descending
      breakdown.sort((a, b) => b.transaction_count - a.transaction_count);

      // Calculate O'mari-specific metrics
      const omariData = methodMap.get('omari');
      const omariPercentage = totalTransactions > 0 && omariData
        ? (omariData.count / totalTransactions) * 100
        : 0;

      // ROI estimate: savings if O'mari transactions used direct API (1%) vs Paynow (3.5%)
      const omariVolume = omariData?.totalAmount || 0;
      const currentOmariFees = omariVolume * 0.035;
      const directOmariFees = omariVolume * 0.01;
      const monthlyEstimatedSavings = currentOmariFees - directOmariFees;
      const annualROI = monthlyEstimatedSavings * 12;

      return {
        period_start: startDate,
        period_end: endDate,
        total_transactions: totalTransactions,
        total_volume: totalVolume,
        total_fees: totalFees,
        breakdown,
        omari_percentage: omariPercentage,
        direct_integration_roi_estimate: annualROI,
      };
    } catch (error) {
      console.error('Error generating payment analytics:', error);
      throw error;
    }
  }

  /**
   * Check if direct O'mari integration is justified.
   * Based on T014 decision rule:
   *   annual savings > development cost ($2,750) + $10,000 safety margin
   */
  async shouldPursueDirectOmari(): Promise<{
    recommended: boolean;
    reason: string;
    metrics: {
      omari_percentage: number;
      estimated_annual_savings: number;
      threshold: number;
    };
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await this.getBreakdown(
      thirtyDaysAgo.toISOString(),
      now.toISOString()
    );

    const threshold = 12750; // $2,750 dev cost + $10,000 safety margin

    if (summary.omari_percentage >= 10 && summary.direct_integration_roi_estimate >= threshold) {
      return {
        recommended: true,
        reason: `O'mari is ${summary.omari_percentage.toFixed(1)}% of transactions with estimated annual savings of $${summary.direct_integration_roi_estimate.toFixed(0)}, exceeding the $${threshold} threshold.`,
        metrics: {
          omari_percentage: summary.omari_percentage,
          estimated_annual_savings: summary.direct_integration_roi_estimate,
          threshold,
        },
      };
    }

    return {
      recommended: false,
      reason: `O'mari is only ${summary.omari_percentage.toFixed(1)}% of transactions. Continue using Paynow gateway.`,
      metrics: {
        omari_percentage: summary.omari_percentage,
        estimated_annual_savings: summary.direct_integration_roi_estimate,
        threshold,
      },
    };
  }
}
