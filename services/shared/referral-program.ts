/**
 * Referral Program Service (P3-T026)
 *
 * Features:
 *  - Unique referral code generation per customer
 *  - Referral tracking and attribution
 *  - Reward tiers (both referrer and referee get rewards)
 *  - Referral analytics
 *  - Anti-fraud: self-referral, duplicate detection
 *
 * Reward Structure:
 *  - Referrer: $5 credit per successful referral (loan disbursed)
 *  - Referee: 2% discount on first deposit
 *  - Bonus: $10 for every 5th referral
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type ReferralStatus = 'pending' | 'onboarding' | 'converted' | 'rewarded' | 'expired' | 'fraudulent';

export interface ReferralCode {
  code: string;
  customer_id: string;
  total_referrals: number;
  successful_referrals: number;
  total_rewards_earned: number;
  created_at: Date;
}

export interface Referral {
  id?: string;
  referrer_id: string;
  referee_id?: string;
  referral_code: string;
  referee_phone: string;
  status: ReferralStatus;
  referrer_reward_amount: number;
  referee_discount_percent: number;
  converted_at?: Date;
  rewarded_at?: Date;
  created_at: Date;
}

// ===================================================================
// REFERRAL CODE GENERATION
// ===================================================================

/**
 * Generate unique 6-character referral code
 */
function generateCode(name: string): string {
  const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${suffix}`;
}

/**
 * Get or create a referral code for a customer
 */
export async function getOrCreateReferralCode(customerId: string): Promise<ReferralCode> {
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  if (existing) return existing as ReferralCode;

  const { data: customer } = await supabase
    .from('customers')
    .select('first_name')
    .eq('id', customerId)
    .single();

  const code = generateCode(customer?.first_name || 'LYN');

  const { data: created } = await supabase
    .from('referral_codes')
    .insert({
      code,
      customer_id: customerId,
      total_referrals: 0,
      successful_referrals: 0,
      total_rewards_earned: 0,
      created_at: new Date(),
    })
    .select()
    .single();

  return created as ReferralCode;
}

// ===================================================================
// REFERRAL TRACKING
// ===================================================================

/**
 * Record a new referral
 */
export async function createReferral(
  referralCode: string,
  refereePhone: string
): Promise<Referral> {
  // Look up referral code
  const { data: codeRecord } = await supabase
    .from('referral_codes')
    .select('customer_id, code')
    .eq('code', referralCode)
    .single();

  if (!codeRecord) throw new Error('Invalid referral code');

  // Anti-fraud: check self-referral
  const { data: referrer } = await supabase
    .from('customers')
    .select('phone_number')
    .eq('id', codeRecord.customer_id)
    .single();

  if (referrer?.phone_number === refereePhone) {
    throw new Error('Self-referral not allowed');
  }

  // Anti-fraud: check duplicate
  const { data: duplicate } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_phone', refereePhone)
    .not('status', 'eq', 'expired')
    .limit(1);

  if (duplicate && duplicate.length > 0) {
    throw new Error('This phone number has already been referred');
  }

  const referral: Partial<Referral> = {
    referrer_id: codeRecord.customer_id,
    referral_code: referralCode,
    referee_phone: refereePhone,
    status: 'pending',
    referrer_reward_amount: 5.00,
    referee_discount_percent: 2,
    created_at: new Date(),
  };

  const { data: created } = await supabase
    .from('referrals')
    .insert(referral)
    .select()
    .single();

  // Increment total referrals
  await supabase.rpc('increment_referral_count', {
    p_code: referralCode,
  }).then(() => {}).catch(() => {
    // Fallback: manual increment
    supabase
      .from('referral_codes')
      .update({ total_referrals: (codeRecord as Record<string, unknown>).total_referrals + 1 })
      .eq('code', referralCode);
  });

  return created as Referral;
}

/**
 * Convert referral when referee's loan is disbursed
 */
export async function convertReferral(
  refereeCustomerId: string
): Promise<{ referralFound: boolean; rewardAmount: number }> {
  const { data: customer } = await supabase
    .from('customers')
    .select('phone_number')
    .eq('id', refereeCustomerId)
    .single();

  if (!customer) return { referralFound: false, rewardAmount: 0 };

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referee_phone', customer.phone_number)
    .in('status', ['pending', 'onboarding'])
    .single();

  if (!referral) return { referralFound: false, rewardAmount: 0 };

  // Update referral
  await supabase
    .from('referrals')
    .update({
      referee_id: refereeCustomerId,
      status: 'converted',
      converted_at: new Date(),
    })
    .eq('id', referral.id);

  // Credit referrer reward
  const rewardAmount = referral.referrer_reward_amount || 5;

  // Check for milestone bonus (every 5th referral)
  const { data: codeRecord } = await supabase
    .from('referral_codes')
    .select('successful_referrals')
    .eq('customer_id', referral.referrer_id)
    .single();

  const successCount = (codeRecord?.successful_referrals || 0) + 1;
  const bonusAmount = successCount % 5 === 0 ? 10 : 0;
  const totalReward = rewardAmount + bonusAmount;

  // Update code stats
  await supabase
    .from('referral_codes')
    .update({
      successful_referrals: successCount,
      total_rewards_earned: (codeRecord as Record<string, unknown>)?.total_rewards_earned + totalReward,
    })
    .eq('customer_id', referral.referrer_id);

  return { referralFound: true, rewardAmount: totalReward };
}

/**
 * Get referral stats for a customer
 */
export async function getReferralStats(customerId: string): Promise<{
  code: string;
  total_referrals: number;
  successful_referrals: number;
  total_rewards: number;
  pending_referrals: number;
}> {
  const codeRecord = await getOrCreateReferralCode(customerId);

  const { count: pendingCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', customerId)
    .in('status', ['pending', 'onboarding']);

  return {
    code: codeRecord.code,
    total_referrals: codeRecord.total_referrals,
    successful_referrals: codeRecord.successful_referrals,
    total_rewards: codeRecord.total_rewards_earned,
    pending_referrals: pendingCount || 0,
  };
}
