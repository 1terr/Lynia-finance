/**
 * Payment Method Analytics
 *
 * Tracks which payment methods customers use (EcoCash, OneMoney, O'mari, InnBucks)
 * for fee analysis, provider performance monitoring, and business reporting.
 *
 * All providers now use direct API integrations (Paynow aggregator removed).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type TrackedPaymentMethod =
  | 'ecocash'
  | 'onemoney'
  | 'omari'
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
 * Fee structure for direct provider integrations.
 * Paynow aggregator removed - all providers use direct APIs now.
 */
const FEE_RATES: Record<string, Record<string, number>> = {
  direct: {
    ecocash: 0.02,     // Direct EcoCash fee ~2%
    onemoney: 0.02,    // Direct OneMoney fee ~2%
    omari: 0.01,       // Direct O'mari fee ~1% (0% promo on USD)
    innbucks: 0.02,    // Direct InnBucks fee ~2%
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
   * Detect payment method from phone number prefix.
   * With direct integrations, the gateway field identifies the provider.
   * This is a fallback for reconciliation scenarios.
   */
  detectPaymentMethodFromPhone(
    customerPhone: string
  ): TrackedPaymentMethod {
    const cleaned = customerPhone.replace(/\D/g, '');
    // Econet prefixes (EcoCash): 77, 78
    if (/^263(77|78)/.test(cleaned)) return 'ecocash';
    // NetOne prefixes (OneMoney): 71
    if (/^26371/.test(cleaned)) return 'onemoney';
    // Telecel prefixes: 73
    if (/^26373/.test(cleaned)) return 'ecocash';
    return 'unknown';
  }

  /**
   * Calculate fee amount for a given payment
   */
  calculateFee(amount: number, gateway: string, method: TrackedPaymentMethod): number {
    const gatewayRates = FEE_RATES[gateway] || FEE_RATES.direct;
    const rate = gatewayRates[method] || 0.02; // Default to 2% direct fee
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

      // Fee efficiency: O'mari has lowest fees at 1% (vs 2% for others)
      const omariVolume = omariData?.totalAmount || 0;
      const omariFeeSavings = omariVolume * 0.01; // 1% savings vs 2% standard
      const annualROI = omariFeeSavings * 12;

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
   * Get provider performance summary for operational monitoring.
   * All providers use direct integrations now.
   */
  async getProviderPerformance(): Promise<{
    providers: Array<{
      provider: string;
      percentage: number;
      volume: number;
      fees: number;
    }>;
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await this.getBreakdown(
      thirtyDaysAgo.toISOString(),
      now.toISOString()
    );

    return {
      providers: summary.breakdown.map(b => ({
        provider: b.payment_method,
        percentage: b.percentage_of_total,
        volume: b.total_amount,
        fees: b.total_fees,
      })),
    };
  }
}
