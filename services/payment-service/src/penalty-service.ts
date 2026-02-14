/**
 * Penalty Configuration & Application Service (Phase 8)
 *
 * Features:
 *  - Configurable penalty rules per product (flat, percentage, tiered)
 *  - Automatic penalty calculation based on days past due
 *  - Grace period enforcement
 *  - Penalty caps and limits (per-application and cumulative)
 *  - Penalty waiver workflow for admin/manager override
 *  - Recurrence control (once, daily, weekly, monthly)
 *  - Audit logging for all penalty operations
 */

import { db, query } from '../../shared/clients/database';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type PenaltyType = 'late_fee' | 'penalty_interest' | 'collection_fee';
export type CalculationMethod = 'flat' | 'percentage' | 'tiered';
export type PenaltyRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';
export type PenaltyStatus = 'applied' | 'paid' | 'waived' | 'reversed';

export interface TieredConfig {
  min_days: number;
  max_days: number | null;
  flat_amount?: number;
  percentage?: number;
}

export interface PenaltyConfiguration {
  id: string;
  product_id: string | null;
  penalty_type: PenaltyType;
  name: string;
  description?: string;
  calculation_method: CalculationMethod;
  flat_amount_usd?: number;
  percentage_rate?: number;
  tiered_config?: TieredConfig[];
  grace_period_days: number;
  min_days_past_due: number;
  max_days_past_due?: number;
  recurrence: PenaltyRecurrence;
  max_applications?: number;
  max_penalty_amount_usd?: number;
  max_total_penalties_usd?: number;
  max_penalty_percentage?: number;
  is_active: boolean;
  effective_from: string;
  effective_until?: string;
}

export interface LoanPenalty {
  id: string;
  loan_id: string;
  customer_id: string;
  penalty_config_id?: string;
  penalty_type: PenaltyType;
  amount_usd: number;
  currency: string;
  days_past_due_at_application: number;
  outstanding_balance_at_application: number;
  calculation_details?: Record<string, unknown>;
  status: PenaltyStatus;
  waived_by?: string;
  waived_at?: string;
  waiver_reason?: string;
  paid_at?: string;
  payment_id?: string;
  applied_by: string;
  created_at: string;
}

export interface PenaltyCalculationResult {
  amount: number;
  penalty_type: PenaltyType;
  config_id: string;
  calculation_method: CalculationMethod;
  details: Record<string, unknown>;
  capped: boolean;
  cap_reason?: string;
}

export interface ApplyPenaltyResult {
  penalties_applied: LoanPenalty[];
  total_amount: number;
  skipped_reasons: string[];
}

// ===================================================================
// PENALTY CONFIGURATION MANAGEMENT
// ===================================================================

/**
 * Create a new penalty configuration
 */
export async function createPenaltyConfiguration(
  config: Omit<PenaltyConfiguration, 'id'>,
  createdBy: string
): Promise<PenaltyConfiguration> {
  validatePenaltyConfig(config);

  const { data, error } = await db
    .from('penalty_configurations')
    .insert({
      product_id: config.product_id,
      penalty_type: config.penalty_type,
      name: config.name,
      description: config.description,
      calculation_method: config.calculation_method,
      flat_amount_usd: config.flat_amount_usd,
      percentage_rate: config.percentage_rate,
      tiered_config: config.tiered_config ? JSON.stringify(config.tiered_config) : null,
      grace_period_days: config.grace_period_days,
      min_days_past_due: config.min_days_past_due,
      max_days_past_due: config.max_days_past_due,
      recurrence: config.recurrence,
      max_applications: config.max_applications,
      max_penalty_amount_usd: config.max_penalty_amount_usd,
      max_total_penalties_usd: config.max_total_penalties_usd,
      max_penalty_percentage: config.max_penalty_percentage,
      is_active: config.is_active,
      effective_from: config.effective_from,
      effective_until: config.effective_until,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .single()
    .execute();

  if (error || !data) {
    throw new PenaltyError(
      'Failed to create penalty configuration',
      'PENALTY_CONFIG_001'
    );
  }

  await logAudit('penalty.config.created', 'penalty_configuration', data.id, createdBy, {
    penalty_type: config.penalty_type,
    calculation_method: config.calculation_method,
    name: config.name,
  });

  return data as PenaltyConfiguration;
}

/**
 * Update an existing penalty configuration
 */
export async function updatePenaltyConfiguration(
  configId: string,
  updates: Partial<PenaltyConfiguration>,
  updatedBy: string
): Promise<PenaltyConfiguration> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.flat_amount_usd !== undefined) updateData.flat_amount_usd = updates.flat_amount_usd;
  if (updates.percentage_rate !== undefined) updateData.percentage_rate = updates.percentage_rate;
  if (updates.tiered_config !== undefined) updateData.tiered_config = JSON.stringify(updates.tiered_config);
  if (updates.grace_period_days !== undefined) updateData.grace_period_days = updates.grace_period_days;
  if (updates.min_days_past_due !== undefined) updateData.min_days_past_due = updates.min_days_past_due;
  if (updates.max_days_past_due !== undefined) updateData.max_days_past_due = updates.max_days_past_due;
  if (updates.recurrence !== undefined) updateData.recurrence = updates.recurrence;
  if (updates.max_applications !== undefined) updateData.max_applications = updates.max_applications;
  if (updates.max_penalty_amount_usd !== undefined) updateData.max_penalty_amount_usd = updates.max_penalty_amount_usd;
  if (updates.max_total_penalties_usd !== undefined) updateData.max_total_penalties_usd = updates.max_total_penalties_usd;
  if (updates.max_penalty_percentage !== undefined) updateData.max_penalty_percentage = updates.max_penalty_percentage;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.effective_until !== undefined) updateData.effective_until = updates.effective_until;

  const { data, error } = await db
    .from('penalty_configurations')
    .update(updateData)
    .eq('id', configId)
    .single()
    .execute();

  if (error || !data) {
    throw new PenaltyError('Penalty configuration not found', 'PENALTY_CONFIG_002');
  }

  await logAudit('penalty.config.updated', 'penalty_configuration', configId, updatedBy, {
    updated_fields: Object.keys(updateData).filter(k => k !== 'updated_at'),
  });

  return data as PenaltyConfiguration;
}

/**
 * Get all active penalty configurations, optionally filtered by product
 */
export async function getActivePenaltyConfigurations(
  productId?: string
): Promise<PenaltyConfiguration[]> {
  // Fetch configs that are global (product_id IS NULL) or match the product
  const sqlQuery = `
    SELECT * FROM penalty_configurations
    WHERE is_active = true
      AND effective_from <= CURRENT_DATE
      AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
      AND (product_id IS NULL ${productId ? 'OR product_id = $1' : ''})
    ORDER BY penalty_type, min_days_past_due ASC
  `;

  const params = productId ? [productId] : [];
  const { data, error } = await query<PenaltyConfiguration>(sqlQuery, params);

  if (error) {
    throw new PenaltyError('Failed to fetch penalty configurations', 'PENALTY_CONFIG_003');
  }

  return data;
}

/**
 * Get a single penalty configuration by ID
 */
export async function getPenaltyConfiguration(
  configId: string
): Promise<PenaltyConfiguration> {
  const { data, error } = await db
    .from('penalty_configurations')
    .select('*')
    .eq('id', configId)
    .single()
    .execute();

  if (error || !data) {
    throw new PenaltyError('Penalty configuration not found', 'PENALTY_CONFIG_002');
  }

  return data as PenaltyConfiguration;
}

// ===================================================================
// PENALTY CALCULATION
// ===================================================================

/**
 * Calculate penalties for a given loan based on its current state.
 * Does NOT apply penalties - just computes what would be assessed.
 */
export async function calculatePenalties(
  loanId: string
): Promise<PenaltyCalculationResult[]> {
  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) throw new PenaltyError('Loan not found', 'PENALTY_LOAN_001');

  const daysPastDue = loan.days_past_due || 0;
  if (daysPastDue <= 0) return [];

  // Check if penalty accrual is suspended
  if (loan.penalty_accrual_suspended) return [];

  const configs = await getActivePenaltyConfigurations(loan.product_id);
  const results: PenaltyCalculationResult[] = [];

  for (const config of configs) {
    // Check DPD range
    if (daysPastDue < config.min_days_past_due + config.grace_period_days) continue;
    if (config.max_days_past_due && daysPastDue > config.max_days_past_due) continue;

    // Check if max applications reached
    const applicationCount = await getApplicationCount(loanId, config.id);
    if (config.max_applications && applicationCount >= config.max_applications) continue;

    // Check recurrence eligibility
    const eligible = await checkRecurrenceEligibility(
      loanId,
      config.id,
      config.recurrence
    );
    if (!eligible) continue;

    // Calculate the amount
    const outstandingBalance = loan.outstanding_balance_usd || 0;
    let amount = computeAmount(config, daysPastDue, outstandingBalance);

    // Apply caps
    let capped = false;
    let capReason: string | undefined;

    if (config.max_penalty_amount_usd && amount > config.max_penalty_amount_usd) {
      amount = config.max_penalty_amount_usd;
      capped = true;
      capReason = 'Per-application cap';
    }

    if (config.max_penalty_percentage) {
      const maxByPercentage = outstandingBalance * config.max_penalty_percentage;
      if (amount > maxByPercentage) {
        amount = maxByPercentage;
        capped = true;
        capReason = 'Percentage cap on outstanding balance';
      }
    }

    // Check cumulative cap
    if (config.max_total_penalties_usd) {
      const totalExisting = loan.total_penalties_usd || 0;
      const remainingCap = config.max_total_penalties_usd - totalExisting;
      if (remainingCap <= 0) continue;
      if (amount > remainingCap) {
        amount = remainingCap;
        capped = true;
        capReason = 'Cumulative penalty cap';
      }
    }

    amount = Math.round(amount * 100) / 100;
    if (amount <= 0) continue;

    results.push({
      amount,
      penalty_type: config.penalty_type as PenaltyType,
      config_id: config.id,
      calculation_method: config.calculation_method as CalculationMethod,
      details: {
        days_past_due: daysPastDue,
        outstanding_balance: outstandingBalance,
        grace_period_days: config.grace_period_days,
        config_name: config.name,
      },
      capped,
      cap_reason: capReason,
    });
  }

  return results;
}

/**
 * Apply penalties to a loan (calculate and record them)
 */
export async function applyPenalties(
  loanId: string,
  appliedBy: string = 'system'
): Promise<ApplyPenaltyResult> {
  const calculations = await calculatePenalties(loanId);
  const appliedPenalties: LoanPenalty[] = [];
  const skippedReasons: string[] = [];

  if (calculations.length === 0) {
    return { penalties_applied: [], total_amount: 0, skipped_reasons: ['No applicable penalties'] };
  }

  const { data: loan } = await db
    .from('loans')
    .select('customer_id, outstanding_balance_usd, total_penalties_usd')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) {
    throw new PenaltyError('Loan not found', 'PENALTY_LOAN_001');
  }

  let totalApplied = 0;

  for (const calc of calculations) {
    // Global cap check: total penalties should not exceed 25% of outstanding balance
    const currentPenalties = (loan.total_penalties_usd || 0) + totalApplied;
    const globalCap = (loan.outstanding_balance_usd || 0) * 0.25;

    if (currentPenalties >= globalCap) {
      skippedReasons.push(
        `${calc.penalty_type}: Skipped - cumulative penalties at 25% cap of outstanding balance`
      );
      continue;
    }

    const remainingCap = globalCap - currentPenalties;
    const finalAmount = Math.min(calc.amount, remainingCap);

    const { data: penalty, error } = await db
      .from('loan_penalties')
      .insert({
        loan_id: loanId,
        customer_id: loan.customer_id,
        penalty_config_id: calc.config_id,
        penalty_type: calc.penalty_type,
        amount_usd: finalAmount,
        currency: 'USD',
        days_past_due_at_application: calc.details.days_past_due,
        outstanding_balance_at_application: calc.details.outstanding_balance,
        calculation_details: JSON.stringify(calc.details),
        status: 'applied',
        applied_by: appliedBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .single()
      .execute();

    if (error || !penalty) {
      skippedReasons.push(`${calc.penalty_type}: Failed to record penalty`);
      continue;
    }

    appliedPenalties.push(penalty as LoanPenalty);
    totalApplied += finalAmount;
  }

  // Update loan totals
  if (totalApplied > 0) {
    await db
      .from('loans')
      .update({
        total_penalties_usd: (loan.total_penalties_usd || 0) + totalApplied,
        outstanding_balance_usd: (loan.outstanding_balance_usd || 0) + totalApplied,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .execute();

    await logAudit('penalty.applied', 'loan', loanId, appliedBy, {
      penalties_count: appliedPenalties.length,
      total_amount: totalApplied,
      penalty_ids: appliedPenalties.map(p => p.id),
    });
  }

  return {
    penalties_applied: appliedPenalties,
    total_amount: totalApplied,
    skipped_reasons: skippedReasons,
  };
}

// ===================================================================
// PENALTY WAIVER
// ===================================================================

/**
 * Waive a penalty (admin/manager action)
 */
export async function waivePenalty(
  penaltyId: string,
  waivedBy: string,
  reason: string
): Promise<LoanPenalty> {
  if (!reason || reason.trim().length < 5) {
    throw new PenaltyError('Waiver reason must be at least 5 characters', 'PENALTY_WAIVER_001');
  }

  const { data: penalty } = await db
    .from('loan_penalties')
    .select('*')
    .eq('id', penaltyId)
    .single()
    .execute();

  if (!penalty) {
    throw new PenaltyError('Penalty not found', 'PENALTY_WAIVER_002');
  }

  if (penalty.status !== 'applied') {
    throw new PenaltyError(
      `Cannot waive penalty with status '${penalty.status}'`,
      'PENALTY_WAIVER_003'
    );
  }

  const { data: updated, error } = await db
    .from('loan_penalties')
    .update({
      status: 'waived',
      waived_by: waivedBy,
      waived_at: new Date().toISOString(),
      waiver_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', penaltyId)
    .single()
    .execute();

  if (error || !updated) {
    throw new PenaltyError('Failed to waive penalty', 'PENALTY_WAIVER_004');
  }

  // Update loan totals: reduce penalties and outstanding balance
  await db
    .from('loans')
    .update({
      total_penalties_waived_usd: db.from('loans').select('total_penalties_waived_usd'),
      // Use raw query to do atomic update
    })
    .eq('id', penalty.loan_id)
    .execute();

  // Use raw query for atomic update
  await query(
    `UPDATE loans SET
      total_penalties_waived_usd = COALESCE(total_penalties_waived_usd, 0) + $1,
      outstanding_balance_usd = GREATEST(COALESCE(outstanding_balance_usd, 0) - $1, 0),
      updated_at = NOW()
    WHERE id = $2`,
    [penalty.amount_usd, penalty.loan_id]
  );

  await logAudit('penalty.waived', 'loan_penalty', penaltyId, waivedBy, {
    loan_id: penalty.loan_id,
    amount_waived: penalty.amount_usd,
    reason,
  });

  return updated as LoanPenalty;
}

/**
 * Get penalties for a loan
 */
export async function getLoanPenalties(
  loanId: string,
  statusFilter?: PenaltyStatus
): Promise<LoanPenalty[]> {
  let builder = db
    .from('loan_penalties')
    .select('*')
    .eq('loan_id', loanId);

  if (statusFilter) {
    builder = builder.eq('status', statusFilter);
  }

  const { data, error } = await builder
    .order('created_at', { ascending: false })
    .execute();

  if (error) {
    throw new PenaltyError('Failed to fetch loan penalties', 'PENALTY_FETCH_001');
  }

  return (data || []) as LoanPenalty[];
}

/**
 * Get penalty summary for a loan
 */
export async function getLoanPenaltySummary(loanId: string): Promise<{
  total_penalties: number;
  total_paid: number;
  total_waived: number;
  total_outstanding: number;
  penalty_count: number;
}> {
  const { data } = await query<{
    total_penalties: string;
    total_paid: string;
    total_waived: string;
    total_outstanding: string;
    penalty_count: string;
  }>(
    `SELECT
      COALESCE(SUM(amount_usd), 0) as total_penalties,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_usd ELSE 0 END), 0) as total_paid,
      COALESCE(SUM(CASE WHEN status = 'waived' THEN amount_usd ELSE 0 END), 0) as total_waived,
      COALESCE(SUM(CASE WHEN status = 'applied' THEN amount_usd ELSE 0 END), 0) as total_outstanding,
      COUNT(*) as penalty_count
    FROM loan_penalties
    WHERE loan_id = $1`,
    [loanId]
  );

  const row = data[0];
  return {
    total_penalties: parseFloat(row?.total_penalties || '0'),
    total_paid: parseFloat(row?.total_paid || '0'),
    total_waived: parseFloat(row?.total_waived || '0'),
    total_outstanding: parseFloat(row?.total_outstanding || '0'),
    penalty_count: parseInt(row?.penalty_count || '0'),
  };
}

// ===================================================================
// INTERNAL HELPERS
// ===================================================================

function computeAmount(
  config: PenaltyConfiguration,
  daysPastDue: number,
  outstandingBalance: number
): number {
  switch (config.calculation_method) {
    case 'flat':
      return config.flat_amount_usd || 0;

    case 'percentage':
      return outstandingBalance * (config.percentage_rate || 0);

    case 'tiered': {
      if (!config.tiered_config || !Array.isArray(config.tiered_config)) return 0;
      const tiers = config.tiered_config as TieredConfig[];
      for (const tier of tiers) {
        const maxDays = tier.max_days ?? Infinity;
        if (daysPastDue >= tier.min_days && daysPastDue <= maxDays) {
          if (tier.flat_amount !== undefined) return tier.flat_amount;
          if (tier.percentage !== undefined) return outstandingBalance * tier.percentage;
        }
      }
      return 0;
    }

    default:
      return 0;
  }
}

async function getApplicationCount(
  loanId: string,
  configId: string
): Promise<number> {
  const { data } = await db
    .from('loan_penalties')
    .select('id')
    .eq('loan_id', loanId)
    .eq('penalty_config_id', configId)
    .in('status', ['applied', 'paid'])
    .execute();

  return data?.length || 0;
}

async function checkRecurrenceEligibility(
  loanId: string,
  configId: string,
  recurrence: PenaltyRecurrence
): Promise<boolean> {
  if (recurrence === 'once') {
    const count = await getApplicationCount(loanId, configId);
    return count === 0;
  }

  // For recurring penalties, check the last application time
  const { data } = await db
    .from('loan_penalties')
    .select('created_at')
    .eq('loan_id', loanId)
    .eq('penalty_config_id', configId)
    .in('status', ['applied', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .execute();

  if (!data || data.length === 0) return true;

  const lastApplied = new Date(data[0].created_at);
  const now = new Date();
  const diffMs = now.getTime() - lastApplied.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (recurrence) {
    case 'daily':
      return diffDays >= 1;
    case 'weekly':
      return diffDays >= 7;
    case 'monthly':
      return diffDays >= 30;
    default:
      return false;
  }
}

function validatePenaltyConfig(config: Omit<PenaltyConfiguration, 'id'>): void {
  const validTypes: PenaltyType[] = ['late_fee', 'penalty_interest', 'collection_fee'];
  if (!validTypes.includes(config.penalty_type)) {
    throw new PenaltyError(
      `Invalid penalty type: ${config.penalty_type}`,
      'PENALTY_VAL_001'
    );
  }

  const validMethods: CalculationMethod[] = ['flat', 'percentage', 'tiered'];
  if (!validMethods.includes(config.calculation_method)) {
    throw new PenaltyError(
      `Invalid calculation method: ${config.calculation_method}`,
      'PENALTY_VAL_002'
    );
  }

  if (config.calculation_method === 'flat' && !config.flat_amount_usd) {
    throw new PenaltyError(
      'flat_amount_usd is required for flat calculation method',
      'PENALTY_VAL_003'
    );
  }

  if (config.calculation_method === 'percentage' && !config.percentage_rate) {
    throw new PenaltyError(
      'percentage_rate is required for percentage calculation method',
      'PENALTY_VAL_004'
    );
  }

  if (config.calculation_method === 'tiered' && (!config.tiered_config || !Array.isArray(config.tiered_config))) {
    throw new PenaltyError(
      'tiered_config array is required for tiered calculation method',
      'PENALTY_VAL_005'
    );
  }

  if (config.grace_period_days < 0) {
    throw new PenaltyError(
      'grace_period_days cannot be negative',
      'PENALTY_VAL_006'
    );
  }
}

async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  performedBy: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      performed_by: performedBy,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    }).execute();
  } catch {
    // Never let audit logging failure break the main flow
    console.error('Failed to write audit log', { action, entityType, entityId });
  }
}

// ===================================================================
// ERROR CLASS
// ===================================================================

export class PenaltyError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'PenaltyError';
  }
}
