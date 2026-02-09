/**
 * WhatsApp Loan Management Commands (P3-T015)
 *
 * Commands:
 *  BALANCE  - View loan balance and next payment
 *  HISTORY  - View last 5 payments
 *  SCHEDULE - View full payment schedule
 *  HELP     - List available commands
 *  UPDATE   - Update phone/email
 *  DEVICE   - View device lock status
 *
 * Features:
 *  - Fuzzy matching for typos
 *  - Rate limiting (10 commands/hour)
 *  - Clear formatted responses
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// COMMAND DEFINITIONS
// ===================================================================

export type CommandName = 'BALANCE' | 'HISTORY' | 'SCHEDULE' | 'HELP' | 'UPDATE' | 'DEVICE' | 'EXTENSION';

const COMMAND_ALIASES: Record<string, CommandName> = {
  balance: 'BALANCE', bal: 'BALANCE', check: 'BALANCE', owe: 'BALANCE',
  history: 'HISTORY', payments: 'HISTORY', paid: 'HISTORY', hist: 'HISTORY',
  schedule: 'SCHEDULE', plan: 'SCHEDULE', dates: 'SCHEDULE', sched: 'SCHEDULE',
  help: 'HELP', menu: 'HELP', commands: 'HELP', options: 'HELP', '?': 'HELP',
  update: 'UPDATE', change: 'UPDATE', edit: 'UPDATE',
  device: 'DEVICE', phone: 'DEVICE', lock: 'DEVICE', status: 'DEVICE',
  extension: 'EXTENSION', extend: 'EXTENSION', delay: 'EXTENSION',
};

// ===================================================================
// FUZZY MATCHING
// ===================================================================

/**
 * Simple Levenshtein distance for fuzzy command matching
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Parse user input to a command using exact match, alias, or fuzzy match
 */
export function parseCommand(input: string): CommandName | null {
  const normalized = input.trim().toLowerCase().split(/\s+/)[0];

  // Exact alias match
  if (COMMAND_ALIASES[normalized]) {
    return COMMAND_ALIASES[normalized];
  }

  // Fuzzy match with max distance of 2
  let bestMatch: CommandName | null = null;
  let bestDistance = 3;

  for (const [alias, command] of Object.entries(COMMAND_ALIASES)) {
    const distance = levenshtein(normalized, alias);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = command;
    }
  }

  return bestMatch;
}

// ===================================================================
// RATE LIMITING
// ===================================================================

const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(phoneNumber);

  if (!entry || now > entry.resetAt) {
    rateLimitCache.set(phoneNumber, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 10) return false;

  entry.count++;
  return true;
}

// ===================================================================
// COMMAND HANDLERS
// ===================================================================

async function handleBalance(phoneNumber: string): Promise<string> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!loan) {
    return `Hi ${customer.first_name}! You don't have any active loans.\n\nWant to apply? Reply *APPLY* to get started.`;
  }

  const outstanding = loan.total_amount_due - (loan.total_amount_paid || 0);
  const nextDue = loan.next_payment_date
    ? new Date(loan.next_payment_date).toLocaleDateString('en-ZW', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'N/A';

  return `💰 *Loan Balance*

Hi ${customer.first_name}!

Loan ID: ${loan.loan_reference || loan.id}
Device: ${loan.device_model || 'Smartphone'}

📊 *Summary:*
• Total Loan: $${loan.total_amount_due?.toFixed(2)}
• Amount Paid: $${(loan.total_amount_paid || 0).toFixed(2)}
• Outstanding: *$${outstanding.toFixed(2)}*
• Monthly Payment: $${loan.monthly_installment_amount?.toFixed(2)}

📅 Next Payment: *${nextDue}*
💵 Amount Due: *$${loan.monthly_installment_amount?.toFixed(2)}*

Reply:
1 - Pay now
2 - View schedule
3 - Request extension`;
}

async function handleHistory(phoneNumber: string): Promise<string> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!payments || payments.length === 0) {
    return `Hi ${customer.first_name}! No payment history found.\n\nYour first payment will appear here after it's processed.`;
  }

  let message = `📋 *Payment History*\n\nHi ${customer.first_name}! Last ${payments.length} payments:\n\n`;

  for (const payment of payments) {
    const date = new Date(payment.created_at).toLocaleDateString('en-ZW', {
      month: 'short', day: 'numeric', year: '2-digit',
    });
    const statusIcon = payment.status === 'completed' ? '✅' : payment.status === 'pending' ? '⏳' : '❌';
    message += `${statusIcon} ${date} - $${payment.amount?.toFixed(2)} via ${payment.payment_method || 'N/A'}\n`;
  }

  message += `\nReply *BALANCE* to check your current balance.`;
  return message;
}

async function handleSchedule(phoneNumber: string): Promise<string> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await supabase
    .from('loans')
    .select('*')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!loan) return `Hi ${customer.first_name}! No active loan found.`;

  const monthlyAmount = loan.monthly_installment_amount || 0;
  const termMonths = loan.term_months || 6;
  const startDate = new Date(loan.disbursement_date || loan.created_at);

  let message = `📅 *Payment Schedule*\n\nLoan: ${loan.loan_reference || loan.id}\nMonthly: $${monthlyAmount.toFixed(2)}\n\n`;

  for (let i = 0; i < termMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    const dateStr = dueDate.toLocaleDateString('en-ZW', { month: 'short', day: 'numeric', year: '2-digit' });
    const isPaid = i < (loan.payments_made || 0);
    message += `${isPaid ? '✅' : '⬜'} Month ${i + 1}: $${monthlyAmount.toFixed(2)} - ${dateStr}\n`;
  }

  const totalPaid = (loan.payments_made || 0) * monthlyAmount;
  const remaining = (loan.total_amount_due || 0) - totalPaid;
  message += `\n*Remaining:* $${remaining.toFixed(2)} (${termMonths - (loan.payments_made || 0)} payments)`;

  return message;
}

function handleHelp(): string {
  return `📱 *Lynia Finance Commands*

Available commands:

💰 *BALANCE* - Check your loan balance and next payment
📋 *HISTORY* - View your last 5 payments
📅 *SCHEDULE* - See your full payment schedule
📱 *DEVICE* - Check your device lock status
✏️ *UPDATE* - Update your contact details
🕐 *EXTENSION* - Request a payment extension
❓ *HELP* - Show this menu

Simply type any command to get started!

Need human help? Reply *SUPPORT* to connect with our team.`;
}

async function handleDevice(phoneNumber: string): Promise<string> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('customer_id', customer.id)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  if (!device) {
    return `Hi ${customer.first_name}! No device found on your account.`;
  }

  const lockIcon = device.lock_status === 'locked' ? '🔒' : '🔓';
  const lockStatus = device.lock_status === 'locked' ? 'LOCKED' : 'UNLOCKED';

  return `📱 *Device Status*

Hi ${customer.first_name}!

Device: *${device.brand} ${device.model}*
IMEI: ${device.imei}

${lockIcon} Status: *${lockStatus}*
${device.lock_status === 'locked' ? '\n⚠️ Your device is locked due to overdue payment.\nPay now to unlock: Reply *1*' : '\n✅ Your device is active and unlocked.'}

Last checked: ${new Date().toLocaleDateString('en-ZW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

Reply *BALANCE* to check your account.`;
}

async function handleUpdate(phoneNumber: string): Promise<string> {
  return `✏️ *Update Contact Details*

What would you like to update?

1 - Phone number
2 - Email address
3 - Home address

Reply with the number of your choice.

Note: Phone number changes require identity verification.`;
}

async function handleExtension(phoneNumber: string): Promise<string> {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single();

  if (!customer) return 'Account not found. Please contact support.';

  return `🕐 *Payment Extension Request*

Hi ${customer.first_name}!

You can request an extension of up to 7 days on your next payment.

Please note:
• Maximum 2 extensions per loan
• Late fee of $2 may apply
• Extension does not affect future payments

Would you like to request an extension?

Reply *YES* to confirm or *NO* to cancel.`;
}

// ===================================================================
// MAIN COMMAND ROUTER
// ===================================================================

/**
 * Route a loan management command
 * Returns null if the message is not a recognized command
 */
export async function routeLoanCommand(
  phoneNumber: string,
  message: string
): Promise<string | null> {
  const command = parseCommand(message);

  if (!command) return null;

  // Rate limit check
  if (!checkRateLimit(phoneNumber)) {
    return '⚠️ You\'ve sent too many commands. Please wait a few minutes before trying again.';
  }

  // Log command usage
  await supabase.from('whatsapp_messages').insert({
    phone_number: phoneNumber,
    message_type: 'command',
    direction: 'inbound',
    content: `Command: ${command}`,
    status: 'delivered',
  }).then(() => {}).catch(() => {});

  switch (command) {
    case 'BALANCE': return handleBalance(phoneNumber);
    case 'HISTORY': return handleHistory(phoneNumber);
    case 'SCHEDULE': return handleSchedule(phoneNumber);
    case 'HELP': return handleHelp();
    case 'DEVICE': return handleDevice(phoneNumber);
    case 'UPDATE': return handleUpdate(phoneNumber);
    case 'EXTENSION': return handleExtension(phoneNumber);
    default: return null;
  }
}
