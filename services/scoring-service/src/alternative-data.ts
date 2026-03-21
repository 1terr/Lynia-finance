/**
 * Alternative Data Integration for Credit Scoring (P3-T018)
 *
 * Data Sources:
 *  - EcoCash/OneMoney transaction analysis
 *  - Mobile top-up patterns
 *  - Location stability assessment
 *  - Social network / referral quality
 *  - Device usage indicators
 *
 * Privacy:
 *  - Data minimization (only scoring-relevant features)
 *  - Explicit consent required before collection
 *  - Anonymized for model training
 *  - Retention policy: features stored 2 years, raw data 90 days
 */

import { db } from '../../shared/clients/database';
import logger from '../../shared/utils/logger';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface MobileMoneyProfile {
  account_age_months: number;
  monthly_inflow_avg: number;
  monthly_outflow_avg: number;
  transaction_count_monthly: number;
  unique_recipients: number;
  airtime_purchase_frequency: number;
  airtime_purchase_consistency: number;
  bill_payment_count: number;
  bill_payment_regularity: number;
  p2p_send_frequency: number;
  p2p_receive_frequency: number;
  average_balance: number;
  balance_trend: 'increasing' | 'stable' | 'decreasing';
  salary_deposit_detected: boolean;
  salary_deposit_regularity: number;
}

export interface LocationProfile {
  primary_location: string;
  location_stability_score: number;
  urban_rural: 'urban' | 'peri_urban' | 'rural';
  address_tenure_months: number;
  province: string;
}

export interface ReferralProfile {
  referred_by: string | null;
  referral_count: number;
  referred_customers_default_rate: number;
  referral_quality_score: number;
}

export interface DeviceProfile {
  device_model: string;
  device_age_months: number;
  device_price_usd: number;
  operating_system: string;
  storage_gb: number;
}

export interface AlternativeDataFeatures {
  customer_id: string;
  computed_at: Date;
  consent_given: boolean;

  // Mobile money derived features
  mm_account_age_months: number;
  mm_monthly_inflow: number;
  mm_monthly_outflow: number;
  mm_tx_frequency: number;
  airtime_consistency: number;
  bill_regularity: number;
  balance_trend: number;       // -1 to 1
  p2p_frequency: number;
  income_stability: number;    // 0 to 1
  savings_indicator: number;   // 0 to 1
  income_diversity: number;    // 1 to 5

  // Location features
  location_stability: number;  // 0 to 1
  urban_score: number;         // 0 to 1

  // Referral features
  referral_quality: number;    // 0 to 1

  // Device features
  device_quality: number;      // 0 to 1

  // Behavioral features
  avg_response_time: number;   // seconds
  session_count: number;
  early_payment_rate: number;
  partial_payment_rate: number;
  avg_dpd: number;
  longest_on_time_streak: number;
  comm_responsiveness: number;
}

// ===================================================================
// MOBILE MONEY ANALYSIS
// ===================================================================

/**
 * Analyze EcoCash/OneMoney transaction history
 * @deprecated Mobile money scoring removed in v2 scoring model. Retained for backward compatibility.
 */
export async function analyzeMobileMoneyTransactions(
  customerId: string,
  transactions: Array<{
    date: string;
    type: 'inflow' | 'outflow';
    amount: number;
    category: string;
    counterparty?: string;
  }>
): Promise<MobileMoneyProfile> {
  logger.warn('analyzeMobileMoneyTransactions is deprecated — mobile money scoring removed in v2', {
    action: 'scoring.deprecated_function_called',
    customerId,
  });
  if (!transactions.length) {
    return getDefaultMobileMoneyProfile();
  }

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstDate = new Date(sortedTx[0].date);
  const lastDate = new Date(sortedTx[sortedTx.length - 1].date);
  const monthsSpan = Math.max(1,
    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    (lastDate.getMonth() - firstDate.getMonth())
  );

  const inflows = transactions.filter(t => t.type === 'inflow');
  const outflows = transactions.filter(t => t.type === 'outflow');

  const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = outflows.reduce((sum, t) => sum + t.amount, 0);

  // Airtime purchases
  const airtimeTx = transactions.filter(t => t.category === 'airtime');
  const airtimeMonths = new Set(airtimeTx.map(t => t.date.substring(0, 7)));

  // Bill payments
  const billTx = transactions.filter(t => t.category === 'bill_payment');
  const billMonths = new Set(billTx.map(t => t.date.substring(0, 7)));

  // P2P transfers
  const p2pSend = transactions.filter(t => t.category === 'p2p_transfer' && t.type === 'outflow');
  const p2pReceive = transactions.filter(t => t.category === 'p2p_transfer' && t.type === 'inflow');

  // Unique recipients
  const uniqueRecipients = new Set(
    outflows.filter(t => t.counterparty).map(t => t.counterparty)
  );

  // Monthly balances for trend
  const monthlyNet: number[] = [];
  const months = new Set(transactions.map(t => t.date.substring(0, 7)));
  for (const month of months) {
    const monthTx = transactions.filter(t => t.date.startsWith(month));
    const net = monthTx.reduce(
      (sum, t) => sum + (t.type === 'inflow' ? t.amount : -t.amount),
      0
    );
    monthlyNet.push(net);
  }

  // Salary detection: regular large inflows on similar dates
  const largeInflows = inflows.filter(t => t.amount > totalInflow / inflows.length * 1.5);
  const salaryDetected = largeInflows.length >= 2;
  const salaryDays = largeInflows.map(t => new Date(t.date).getDate());
  const salaryRegularity = salaryDays.length >= 2
    ? 1 - (Math.max(...salaryDays) - Math.min(...salaryDays)) / 30
    : 0;

  // Balance trend: positive slope = increasing
  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (monthlyNet.length >= 3) {
    const avg = monthlyNet.reduce((s, v) => s + v, 0) / monthlyNet.length;
    const lastThird = monthlyNet.slice(-Math.ceil(monthlyNet.length / 3));
    const lastAvg = lastThird.reduce((s, v) => s + v, 0) / lastThird.length;
    if (lastAvg > avg * 1.1) trend = 'increasing';
    else if (lastAvg < avg * 0.9) trend = 'decreasing';
  }

  return {
    account_age_months: monthsSpan,
    monthly_inflow_avg: totalInflow / monthsSpan,
    monthly_outflow_avg: totalOutflow / monthsSpan,
    transaction_count_monthly: transactions.length / monthsSpan,
    unique_recipients: uniqueRecipients.size,
    airtime_purchase_frequency: airtimeTx.length / monthsSpan,
    airtime_purchase_consistency: airtimeMonths.size / monthsSpan,
    bill_payment_count: billTx.length,
    bill_payment_regularity: billMonths.size / monthsSpan,
    p2p_send_frequency: p2pSend.length / monthsSpan,
    p2p_receive_frequency: p2pReceive.length / monthsSpan,
    average_balance: (totalInflow - totalOutflow) / monthsSpan,
    balance_trend: trend,
    salary_deposit_detected: salaryDetected,
    salary_deposit_regularity: Math.max(0, Math.min(1, salaryRegularity)),
  };
}

/**
 * @deprecated Mobile money scoring removed in v2 scoring model. Retained for backward compatibility.
 */
function getDefaultMobileMoneyProfile(): MobileMoneyProfile {
  return {
    account_age_months: 0,
    monthly_inflow_avg: 0,
    monthly_outflow_avg: 0,
    transaction_count_monthly: 0,
    unique_recipients: 0,
    airtime_purchase_frequency: 0,
    airtime_purchase_consistency: 0,
    bill_payment_count: 0,
    bill_payment_regularity: 0,
    p2p_send_frequency: 0,
    p2p_receive_frequency: 0,
    average_balance: 0,
    balance_trend: 'stable',
    salary_deposit_detected: false,
    salary_deposit_regularity: 0,
  };
}

// ===================================================================
// LOCATION ANALYSIS
// ===================================================================

/**
 * Assess location stability from address history
 */
export function assessLocationStability(
  addressHistory: Array<{
    address: string;
    city: string;
    province: string;
    from_date: string;
    to_date?: string;
  }>
): LocationProfile {
  if (!addressHistory.length) {
    return {
      primary_location: 'Unknown',
      location_stability_score: 0.3,
      urban_rural: 'urban',
      address_tenure_months: 0,
      province: 'Unknown',
    };
  }

  const current = addressHistory[addressHistory.length - 1];
  const tenureMonths = current.from_date
    ? Math.max(0, (Date.now() - new Date(current.from_date).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  // Stability: fewer moves = more stable
  const moveCount = addressHistory.length - 1;
  const stabilityScore = Math.max(0, Math.min(1, 1 - (moveCount * 0.2)));

  // Urban classification
  const urbanCities = ['harare', 'bulawayo', 'chitungwiza', 'mutare', 'gweru', 'kwekwe', 'masvingo'];
  const periUrban = ['norton', 'ruwa', 'epworth', 'bindura', 'chinhoyi', 'marondera'];
  const cityLower = current.city.toLowerCase();
  const urbanRural = urbanCities.includes(cityLower) ? 'urban'
    : periUrban.includes(cityLower) ? 'peri_urban' : 'rural';

  return {
    primary_location: `${current.city}, ${current.province}`,
    location_stability_score: stabilityScore,
    urban_rural: urbanRural,
    address_tenure_months: Math.round(tenureMonths),
    province: current.province,
  };
}

// ===================================================================
// REFERRAL ANALYSIS
// ===================================================================

/**
 * Assess referral network quality
 */
export async function analyzeReferralNetwork(customerId: string): Promise<ReferralProfile> {
  // Check if customer was referred
  const { data: customer } = await db
    .from('customers')
    .select('referred_by')
    .eq('id', customerId)
    .single()
    .execute();

  // Count customers this person referred
  const { data: referrals, count } = await db
    .from('customers')
    .select('id')
    .eq('referred_by', customerId)
    .execute();

  // Check default rate of referred customers
  let defaultRate = 0;
  if (referrals && referrals.length > 0) {
    const referralIds = referrals.map((r: Record<string, unknown>) => r.id);
    const { data: defaultedLoans } = await db
      .from('loans')
      .select('id')
      .in('customer_id', referralIds)
      .eq('loan_status', 'defaulted')
      .execute();

    defaultRate = (defaultedLoans?.length || 0) / referrals.length;
  }

  // Quality score: more referrals with low default rate = high quality
  const referralCount = count || 0;
  const qualityScore = referralCount > 0
    ? Math.min(1, (referralCount * 0.1) * (1 - defaultRate))
    : 0;

  return {
    referred_by: customer?.referred_by || null,
    referral_count: referralCount,
    referred_customers_default_rate: defaultRate,
    referral_quality_score: qualityScore,
  };
}

// ===================================================================
// AGGREGATE FEATURES
// ===================================================================

/**
 * Compute all alternative data features for a customer
 */
export async function computeAlternativeFeatures(
  customerId: string,
  mobileMoneyData?: MobileMoneyProfile,
  locationData?: LocationProfile
): Promise<AlternativeDataFeatures> {
  // Check consent
  const { data: consent } = await db
    .from('customer_preferences')
    .select('*')
    .eq('customer_id', customerId)
    .single()
    .execute();

  const referral = await analyzeReferralNetwork(customerId);
  const mm = mobileMoneyData || getDefaultMobileMoneyProfile();
  const loc = locationData || { location_stability_score: 0.5, urban_rural: 'urban' as const };

  // Income stability from salary regularity and inflow consistency
  const incomeStability = mm.salary_deposit_detected
    ? 0.5 + (mm.salary_deposit_regularity * 0.5)
    : mm.monthly_inflow_avg > 0 ? 0.3 : 0.1;

  // Savings indicator from balance trend and amount
  const savingsIndicator = mm.balance_trend === 'increasing' ? 0.8
    : mm.balance_trend === 'stable' ? 0.5 : 0.2;

  // Balance trend as numeric
  const balanceTrendNum = mm.balance_trend === 'increasing' ? 1
    : mm.balance_trend === 'stable' ? 0 : -1;

  // Urban score
  const urbanScore = loc.urban_rural === 'urban' ? 0.8
    : loc.urban_rural === 'peri_urban' ? 0.5 : 0.3;

  const features: AlternativeDataFeatures = {
    customer_id: customerId,
    computed_at: new Date(),
    consent_given: !!consent,

    mm_account_age_months: mm.account_age_months,
    mm_monthly_inflow: mm.monthly_inflow_avg,
    mm_monthly_outflow: mm.monthly_outflow_avg,
    mm_tx_frequency: mm.transaction_count_monthly,
    airtime_consistency: mm.airtime_purchase_consistency,
    bill_regularity: mm.bill_payment_regularity,
    balance_trend: balanceTrendNum,
    p2p_frequency: mm.p2p_send_frequency + mm.p2p_receive_frequency,
    income_stability: incomeStability,
    savings_indicator: savingsIndicator,
    income_diversity: mm.salary_deposit_detected ? 2 : 1,

    location_stability: loc.location_stability_score,
    urban_score: urbanScore,

    referral_quality: referral.referral_quality_score,

    device_quality: 0.5,

    avg_response_time: 120,
    session_count: 1,
    early_payment_rate: 0,
    partial_payment_rate: 0,
    avg_dpd: 0,
    longest_on_time_streak: 0,
    comm_responsiveness: 0.5,
  };

  // Persist to feature store
  await db.from('customer_features').upsert({
    ...features,
  }).execute();

  return features;
}
