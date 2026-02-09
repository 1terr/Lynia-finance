/**
 * Customer Support Ticketing System (P3-T025)
 *
 * Features:
 *  - Ticket creation via WhatsApp, admin portal
 *  - Priority-based routing (P1-P4)
 *  - Auto-categorization from message content
 *  - SLA tracking
 *  - Agent assignment and escalation
 *  - Ticket lifecycle management
 *  - Customer satisfaction (CSAT) collection
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketChannel = 'whatsapp' | 'admin_portal' | 'email';

export type TicketCategory =
  | 'payment_issue'
  | 'device_problem'
  | 'account_query'
  | 'loan_question'
  | 'kyc_issue'
  | 'complaint'
  | 'general';

export interface SupportTicket {
  id?: string;
  customer_id: string;
  channel: TicketChannel;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  assigned_to?: string;
  sla_due_at: Date;
  resolved_at?: Date;
  csat_score?: number;
  messages: TicketMessage[];
  created_at: Date;
}

export interface TicketMessage {
  sender_type: 'customer' | 'agent' | 'system';
  sender_id: string;
  message: string;
  created_at: Date;
}

// SLA definitions (hours to first response)
const SLA_HOURS: Record<TicketPriority, number> = {
  P1: 1,    // Critical: payment failure, device locked incorrectly
  P2: 4,    // High: KYC issues, loan disputes
  P3: 24,   // Medium: general queries
  P4: 72,   // Low: feature requests, general feedback
};

// ===================================================================
// AUTO-CATEGORIZATION
// ===================================================================

const CATEGORY_KEYWORDS: Record<TicketCategory, string[]> = {
  payment_issue: ['payment', 'pay', 'ecocash', 'onemoney', 'innbucks', 'deposit', 'failed', 'refund', 'money'],
  device_problem: ['device', 'phone', 'locked', 'lock', 'broken', 'screen', 'unlock', 'reset'],
  account_query: ['account', 'balance', 'statement', 'profile', 'password', 'login'],
  loan_question: ['loan', 'interest', 'installment', 'schedule', 'extension', 'restructure'],
  kyc_issue: ['kyc', 'verify', 'identity', 'id', 'selfie', 'document', 'photo', 'rejected'],
  complaint: ['complaint', 'unhappy', 'poor', 'bad', 'terrible', 'wrong', 'unfair'],
  general: [],
};

/**
 * Auto-categorize a ticket from its content
 */
export function categorizeTicket(subject: string, description: string): {
  category: TicketCategory;
  priority: TicketPriority;
} {
  const text = `${subject} ${description}`.toLowerCase();

  let bestCategory: TicketCategory = 'general';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as TicketCategory;
    }
  }

  // Determine priority
  let priority: TicketPriority = 'P3';
  if (bestCategory === 'payment_issue' && (text.includes('fail') || text.includes('stuck'))) {
    priority = 'P1';
  } else if (bestCategory === 'device_problem' && text.includes('locked')) {
    priority = 'P1';
  } else if (bestCategory === 'complaint') {
    priority = 'P2';
  } else if (bestCategory === 'kyc_issue') {
    priority = 'P2';
  } else if (bestCategory === 'general') {
    priority = 'P4';
  }

  return { category: bestCategory, priority };
}

// ===================================================================
// TICKET MANAGEMENT
// ===================================================================

/**
 * Create a support ticket
 */
export async function createTicket(params: {
  customer_id: string;
  channel: TicketChannel;
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}): Promise<SupportTicket> {
  const { category, priority } = params.category && params.priority
    ? { category: params.category, priority: params.priority }
    : categorizeTicket(params.subject, params.description);

  const slaDueAt = new Date();
  slaDueAt.setHours(slaDueAt.getHours() + SLA_HOURS[priority]);

  const ticket: Partial<SupportTicket> = {
    customer_id: params.customer_id,
    channel: params.channel,
    category,
    priority,
    subject: params.subject,
    description: params.description,
    status: 'open',
    sla_due_at: slaDueAt,
    created_at: new Date(),
  };

  const { data, error } = await supabase
    .from('support_tickets')
    .insert(ticket)
    .select()
    .single();

  if (error) throw new Error(`Failed to create ticket: ${error.message}`);

  // Add initial message
  await supabase.from('ticket_messages').insert({
    ticket_id: data.id,
    sender_type: 'customer',
    sender_id: params.customer_id,
    message: params.description,
    created_at: new Date(),
  });

  return data as SupportTicket;
}

/**
 * Assign ticket to an agent
 */
export async function assignTicket(ticketId: string, agentId: string): Promise<void> {
  await supabase
    .from('support_tickets')
    .update({ status: 'assigned', assigned_to: agentId })
    .eq('id', ticketId);
}

/**
 * Add a reply to a ticket
 */
export async function addTicketReply(
  ticketId: string,
  senderType: 'customer' | 'agent',
  senderId: string,
  message: string
): Promise<void> {
  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_type: senderType,
    sender_id: senderId,
    message,
    created_at: new Date(),
  });

  const newStatus = senderType === 'agent' ? 'waiting_customer' : 'in_progress';
  await supabase
    .from('support_tickets')
    .update({ status: newStatus })
    .eq('id', ticketId);
}

/**
 * Resolve a ticket
 */
export async function resolveTicket(ticketId: string, resolution: string): Promise<void> {
  await supabase
    .from('support_tickets')
    .update({
      status: 'resolved',
      resolved_at: new Date(),
    })
    .eq('id', ticketId);

  await supabase.from('ticket_messages').insert({
    ticket_id: ticketId,
    sender_type: 'system',
    sender_id: 'system',
    message: `Ticket resolved: ${resolution}`,
    created_at: new Date(),
  });
}

/**
 * Record CSAT score after resolution
 */
export async function recordCSAT(ticketId: string, score: number): Promise<void> {
  if (score < 1 || score > 5) throw new Error('CSAT score must be 1-5');

  await supabase
    .from('support_tickets')
    .update({ csat_score: score, status: 'closed' })
    .eq('id', ticketId);
}

/**
 * Get tickets needing attention (breaching SLA)
 */
export async function getBreachingSLATickets(): Promise<SupportTicket[]> {
  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .in('status', ['open', 'assigned', 'in_progress'])
    .lt('sla_due_at', new Date().toISOString())
    .order('sla_due_at', { ascending: true });

  return (data || []) as SupportTicket[];
}
