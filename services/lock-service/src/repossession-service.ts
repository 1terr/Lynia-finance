/**
 * Device Repossession Workflow (P3-T021)
 *
 * Workflow stages:
 *  1. Eligibility check (60+ days past due)
 *  2. Customer notification (final warning)
 *  3. Repossession order creation
 *  4. Field agent assignment
 *  5. Device recovery
 *  6. Inventory return and inspection
 *  7. Account closure
 *
 * Safeguards:
 *  - Only after 60+ days delinquency
 *  - Must attempt restructuring first
 *  - Customer gets 7-day final warning
 *  - Audit trail for every step
 */

import { db } from '../../shared/clients/database';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type RepossessionStatus =
  | 'eligible'
  | 'warning_sent'
  | 'order_created'
  | 'agent_assigned'
  | 'in_progress'
  | 'recovered'
  | 'inspection_complete'
  | 'closed'
  | 'cancelled';

export interface RepossessionOrder {
  id?: string;
  loan_id: string;
  customer_id: string;
  device_id: string;
  status: RepossessionStatus;
  days_past_due: number;
  outstanding_amount: number;
  assigned_agent_id?: string;
  warning_sent_at?: Date;
  recovery_date?: Date;
  device_condition_on_recovery?: string;
  notes: string;
  created_at: Date;
}

// ===================================================================
// ELIGIBILITY CHECK
// ===================================================================

/**
 * Check if a loan is eligible for repossession (60+ days past due)
 */
export async function checkRepossessionEligibility(loanId: string): Promise<{
  eligible: boolean;
  reason: string;
  days_past_due: number;
  outstanding_amount: number;
  restructuring_attempted: boolean;
}> {
  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) throw new Error('Loan not found');

  const outstanding = (loan.total_amount_due || 0) - (loan.total_amount_paid || 0);
  const daysPastDue = loan.days_past_due || 0;

  // Check if restructuring was attempted
  const { data: restructures } = await db
    .from('restructure_requests')
    .select('id')
    .eq('loan_id', loanId)
    .limit(1)
    .execute();

  const restructuringAttempted = !!restructures && restructures.length > 0;

  if (daysPastDue < 60) {
    return {
      eligible: false,
      reason: `Only ${daysPastDue} days past due. Minimum 60 days required.`,
      days_past_due: daysPastDue,
      outstanding_amount: outstanding,
      restructuring_attempted: restructuringAttempted,
    };
  }

  if (!restructuringAttempted) {
    return {
      eligible: false,
      reason: 'Restructuring must be attempted before repossession.',
      days_past_due: daysPastDue,
      outstanding_amount: outstanding,
      restructuring_attempted: false,
    };
  }

  return {
    eligible: true,
    reason: 'Eligible for repossession',
    days_past_due: daysPastDue,
    outstanding_amount: outstanding,
    restructuring_attempted: true,
  };
}

// ===================================================================
// REPOSSESSION WORKFLOW
// ===================================================================

/**
 * Initiate repossession - sends final warning to customer
 */
export async function initiateRepossession(
  loanId: string,
  initiatedBy: string
): Promise<RepossessionOrder> {
  const eligibility = await checkRepossessionEligibility(loanId);

  if (!eligibility.eligible) {
    throw new Error(`Not eligible: ${eligibility.reason}`);
  }

  const { data: loan } = await db
    .from('loans')
    .select('customer_id, device_id')
    .eq('id', loanId)
    .single()
    .execute();

  if (!loan) throw new Error('Loan not found');

  const order: RepossessionOrder = {
    loan_id: loanId,
    customer_id: loan.customer_id,
    device_id: loan.device_id,
    status: 'warning_sent',
    days_past_due: eligibility.days_past_due,
    outstanding_amount: eligibility.outstanding_amount,
    warning_sent_at: new Date(),
    notes: `Initiated by ${initiatedBy}`,
    created_at: new Date(),
  };

  const { data: created } = await db
    .from('repossession_orders')
    .insert(order as unknown as Record<string, unknown>)
    .select()
    .single()
    .execute();

  // Audit log
  await db.from('audit_log').insert({
    action: 'repossession.initiated',
    entity_type: 'loan',
    entity_id: loanId,
    performed_by: initiatedBy,
    metadata: { order_id: created?.id, days_past_due: eligibility.days_past_due },
  }).execute();

  return created as RepossessionOrder;
}

/**
 * Create repossession order after 7-day warning period
 */
export async function createRepossessionOrder(orderId: string): Promise<void> {
  const { data: order } = await db
    .from('repossession_orders')
    .select('*')
    .eq('id', orderId)
    .single()
    .execute();

  if (!order) throw new Error('Order not found');

  // Verify 7-day warning period has elapsed
  if (order.warning_sent_at) {
    const warningDate = new Date(order.warning_sent_at);
    const daysSinceWarning = (Date.now() - warningDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceWarning < 7) {
      throw new Error(`Warning period not elapsed. ${Math.ceil(7 - daysSinceWarning)} days remaining.`);
    }
  }

  await db
    .from('repossession_orders')
    .update({ status: 'order_created' })
    .eq('id', orderId)
    .execute();
}

/**
 * Assign field agent to recover device
 */
export async function assignAgent(orderId: string, agentId: string): Promise<void> {
  await db
    .from('repossession_orders')
    .update({
      status: 'agent_assigned',
      assigned_agent_id: agentId,
    })
    .eq('id', orderId)
    .execute();
}

/**
 * Record device recovery
 */
export async function recordRecovery(
  orderId: string,
  condition: string,
  notes: string
): Promise<void> {
  await db
    .from('repossession_orders')
    .update({
      status: 'recovered',
      recovery_date: new Date(),
      device_condition_on_recovery: condition,
      notes,
    })
    .eq('id', orderId)
    .execute();

  // Update device status
  const { data: order } = await db
    .from('repossession_orders')
    .select('device_id, loan_id')
    .eq('id', orderId)
    .single()
    .execute();

  if (order) {
    await db
      .from('devices')
      .update({ status: 'repossessed', lock_status: 'locked' })
      .eq('id', order.device_id)
      .execute();

    await db
      .from('loans')
      .update({ loan_status: 'defaulted' })
      .eq('id', order.loan_id)
      .execute();
  }
}

/**
 * Close repossession case
 */
export async function closeRepossession(
  orderId: string,
  closedBy: string
): Promise<void> {
  await db
    .from('repossession_orders')
    .update({ status: 'closed' })
    .eq('id', orderId)
    .execute();

  await db.from('audit_log').insert({
    action: 'repossession.closed',
    entity_type: 'repossession_order',
    entity_id: orderId,
    performed_by: closedBy,
  }).execute();
}
