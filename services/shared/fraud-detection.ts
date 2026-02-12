/**
 * Fraud Detection System (P3-T027)
 *
 * Rule-based + anomaly detection for:
 *  - Duplicate identity fraud
 *  - Velocity checks (too many applications)
 *  - Device tampering
 *  - Payment fraud patterns
 *  - Suspicious transaction patterns
 *  - Distributor collusion detection
 *
 * Risk scoring: 0-100 (0 = safe, 100 = definite fraud)
 * Actions: allow, flag, block, report
 */

import { db } from './clients/database';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type FraudCheckType =
  | 'identity_duplicate'
  | 'velocity_check'
  | 'device_tamper'
  | 'payment_anomaly'
  | 'transaction_pattern'
  | 'distributor_collusion';

export type FraudAction = 'allow' | 'flag' | 'block' | 'report';

export interface FraudCheckResult {
  check_type: FraudCheckType;
  risk_score: number;         // 0-100
  action: FraudAction;
  details: string;
  rules_triggered: string[];
  checked_at: Date;
}

export interface FraudAlert {
  id?: string;
  customer_id: string;
  check_type: FraudCheckType;
  risk_score: number;
  action: FraudAction;
  details: string;
  rules_triggered: string[];
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
  resolution?: string;
  created_at: Date;
}

// ===================================================================
// FRAUD RULES
// ===================================================================

/**
 * Check for duplicate identity (same national ID, phone, or device)
 */
export async function checkIdentityDuplicate(params: {
  national_id?: string;
  phone_number: string;
  device_imei?: string;
}): Promise<FraudCheckResult> {
  const rules: string[] = [];
  let score = 0;

  // Check duplicate national ID
  if (params.national_id) {
    const { count } = await db
      .from('customers')
      .select('*')
      .eq('national_id', params.national_id)
      .count()
      .execute();

    if ((count || 0) > 1) {
      score += 80;
      rules.push('DUPLICATE_NATIONAL_ID');
    }
  }

  // Check duplicate phone
  const { count: phoneCount } = await db
    .from('customers')
    .select('*')
    .eq('phone_number', params.phone_number)
    .count()
    .execute();

  if ((phoneCount || 0) > 1) {
    score += 60;
    rules.push('DUPLICATE_PHONE');
  }

  // Check duplicate IMEI
  if (params.device_imei) {
    const { count: imeiCount } = await db
      .from('loans')
      .select('*')
      .eq('device_imei', params.device_imei)
      .in('loan_status', ['active', 'delinquent'])
      .count()
      .execute();

    if ((imeiCount || 0) > 1) {
      score += 90;
      rules.push('DUPLICATE_DEVICE_ACTIVE_LOAN');
    }
  }

  return buildResult('identity_duplicate', score, rules);
}

/**
 * Velocity check - too many applications in short time
 */
export async function checkVelocity(params: {
  phone_number: string;
  customer_id?: string;
}): Promise<FraudCheckResult> {
  const rules: string[] = [];
  let score = 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Applications in last 24 hours from same phone
  const { count: dailyCount } = await db
    .from('whatsapp_onboarding_sessions')
    .select('*')
    .eq('phone_number', params.phone_number)
    .gte('created_at', oneDayAgo)
    .count()
    .execute();

  if ((dailyCount || 0) > 3) {
    score += 50;
    rules.push('HIGH_DAILY_APPLICATION_RATE');
  }

  // Applications in last week
  const { count: weeklyCount } = await db
    .from('whatsapp_onboarding_sessions')
    .select('*')
    .eq('phone_number', params.phone_number)
    .gte('created_at', oneWeekAgo)
    .count()
    .execute();

  if ((weeklyCount || 0) > 5) {
    score += 40;
    rules.push('HIGH_WEEKLY_APPLICATION_RATE');
  }

  // Multiple rejected applications
  if (params.customer_id) {
    const { count: rejectedCount } = await db
      .from('loans')
      .select('*')
      .eq('customer_id', params.customer_id)
      .eq('loan_status', 'rejected')
      .count()
      .execute();

    if ((rejectedCount || 0) >= 3) {
      score += 30;
      rules.push('MULTIPLE_REJECTIONS');
    }
  }

  return buildResult('velocity_check', score, rules);
}

/**
 * Check for device tampering indicators
 */
export async function checkDeviceTamper(deviceId: string): Promise<FraudCheckResult> {
  const rules: string[] = [];
  let score = 0;

  const { data: device } = await db
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single()
    .execute();

  if (!device) return buildResult('device_tamper', 0, []);

  if (device.factory_reset_detected) {
    score += 70;
    rules.push('FACTORY_RESET_DETECTED');
  }

  if (device.sim_changed) {
    score += 30;
    rules.push('SIM_CARD_CHANGED');
  }

  if (device.trustonic_enrollment_status === 'unenrolled') {
    score += 80;
    rules.push('TRUSTONIC_UNENROLLED');
  }

  // Check if device has been offline for extended period
  if (device.last_seen_at) {
    const hoursSince = (Date.now() - new Date(device.last_seen_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince > 168) { // 7 days
      score += 40;
      rules.push('EXTENDED_OFFLINE');
    }
  }

  return buildResult('device_tamper', score, rules);
}

/**
 * Check for payment fraud patterns
 */
export async function checkPaymentAnomaly(params: {
  customer_id: string;
  amount: number;
  payment_method: string;
}): Promise<FraudCheckResult> {
  const rules: string[] = [];
  let score = 0;

  // Check for rapid successive payments
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count: recentPayments } = await db
    .from('payments')
    .select('*')
    .eq('customer_id', params.customer_id)
    .gte('created_at', thirtyMinAgo)
    .count()
    .execute();

  if ((recentPayments || 0) > 3) {
    score += 50;
    rules.push('RAPID_PAYMENT_ATTEMPTS');
  }

  // Check for unusual amount (much higher than installment)
  const { data: loan } = await db
    .from('loans')
    .select('monthly_installment_amount')
    .eq('customer_id', params.customer_id)
    .in('loan_status', ['active'])
    .single()
    .execute();

  if (loan && params.amount > (loan.monthly_installment_amount || 0) * 3) {
    score += 30;
    rules.push('UNUSUAL_PAYMENT_AMOUNT');
  }

  // Multiple failed payments today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: failedToday } = await db
    .from('payments')
    .select('*')
    .eq('customer_id', params.customer_id)
    .eq('status', 'failed')
    .gte('created_at', todayStart.toISOString())
    .count()
    .execute();

  if ((failedToday || 0) >= 5) {
    score += 40;
    rules.push('MULTIPLE_FAILED_PAYMENTS');
  }

  return buildResult('payment_anomaly', score, rules);
}

// ===================================================================
// ALERT MANAGEMENT
// ===================================================================

function buildResult(
  checkType: FraudCheckType,
  score: number,
  rules: string[]
): FraudCheckResult {
  score = Math.min(100, score);

  let action: FraudAction;
  if (score >= 80) action = 'block';
  else if (score >= 50) action = 'flag';
  else if (score >= 30) action = 'flag';
  else action = 'allow';

  return {
    check_type: checkType,
    risk_score: score,
    action,
    details: rules.length > 0 ? `Triggered: ${rules.join(', ')}` : 'No fraud indicators',
    rules_triggered: rules,
    checked_at: new Date(),
  };
}

/**
 * Record a fraud alert
 */
export async function recordFraudAlert(
  customerId: string,
  result: FraudCheckResult
): Promise<void> {
  if (result.action === 'allow') return;

  await db.from('fraud_alerts').insert({
    customer_id: customerId,
    check_type: result.check_type,
    risk_score: result.risk_score,
    action: result.action,
    details: result.details,
    rules_triggered: result.rules_triggered,
    reviewed: false,
    created_at: new Date(),
  }).execute();
}

/**
 * Get unreviewed fraud alerts
 */
export async function getUnreviewedAlerts(limit: number = 50): Promise<FraudAlert[]> {
  const { data } = await db
    .from('fraud_alerts')
    .select('*')
    .eq('reviewed', false)
    .order('risk_score', { ascending: false })
    .limit(limit)
    .execute();

  return (data || []) as FraudAlert[];
}

/**
 * Review a fraud alert
 */
export async function reviewAlert(
  alertId: string,
  reviewerId: string,
  resolution: string
): Promise<void> {
  await db
    .from('fraud_alerts')
    .update({
      reviewed: true,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      resolution,
    })
    .eq('id', alertId)
    .execute();
}
