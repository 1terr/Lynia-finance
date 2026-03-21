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

import { db } from '../../shared/clients/database';
import { getFineractLoanBalance, getFineractRepaymentSchedule } from '../../shared/clients/fineract-sync';
import { auditLogEntry } from '../../shared/utils/audit';

// ===================================================================
// COMMAND DEFINITIONS
// ===================================================================

export type CommandName = 'BALANCE' | 'HISTORY' | 'SCHEDULE' | 'HELP' | 'UPDATE' | 'DEVICE' | 'EXTENSION' | 'PAY' | 'SETTLE';

const COMMAND_ALIASES: Record<string, CommandName> = {
  balance: 'BALANCE', bal: 'BALANCE', check: 'BALANCE', owe: 'BALANCE',
  history: 'HISTORY', payments: 'HISTORY', paid: 'HISTORY', hist: 'HISTORY',
  schedule: 'SCHEDULE', plan: 'SCHEDULE', dates: 'SCHEDULE', sched: 'SCHEDULE',
  help: 'HELP', menu: 'HELP', commands: 'HELP', options: 'HELP', '?': 'HELP',
  update: 'UPDATE', change: 'UPDATE', edit: 'UPDATE',
  device: 'DEVICE', phone: 'DEVICE', lock: 'DEVICE', status: 'DEVICE',
  extension: 'EXTENSION', extend: 'EXTENSION', delay: 'EXTENSION',
  pay: 'PAY', repay: 'PAY', send: 'PAY', lipiri: 'PAY', bhadala: 'PAY', 'pay now': 'PAY',
  settle: 'SETTLE', payoff: 'SETTLE', 'pay off': 'SETTLE', 'early payoff': 'SETTLE',
  finish: 'SETTLE', clear: 'SETTLE', closeup: 'SETTLE',
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
 * Parse user input to a command using exact match, alias, or fuzzy match.
 * Supports multi-word aliases (e.g. "pay now", "pay off", "early payoff").
 * Returns the matched command and any remaining text as subCommand.
 */
export function parseCommand(input: string): { command: CommandName; subCommand?: string } | null {
  const trimmed = input.trim().toLowerCase();
  const words = trimmed.split(/\s+/);
  const firstWord = words[0];

  // Check multi-word exact match first (e.g. "pay now", "pay off", "early payoff")
  if (COMMAND_ALIASES[trimmed]) {
    return { command: COMMAND_ALIASES[trimmed] };
  }

  // Check two-word prefix match (e.g. "pay off immediately" → command: SETTLE, subCommand: "immediately")
  if (words.length >= 2) {
    const twoWords = `${words[0]} ${words[1]}`;
    if (COMMAND_ALIASES[twoWords]) {
      const rest = words.slice(2).join(' ').trim() || undefined;
      return { command: COMMAND_ALIASES[twoWords], subCommand: rest };
    }
  }

  // Single-word exact alias match
  if (COMMAND_ALIASES[firstWord]) {
    const rest = words.slice(1).join(' ').trim() || undefined;
    return { command: COMMAND_ALIASES[firstWord], subCommand: rest };
  }

  // Fuzzy match with max distance of 2 (single-word aliases only)
  let bestMatch: CommandName | null = null;
  let bestDistance = 3;

  for (const [alias, command] of Object.entries(COMMAND_ALIASES)) {
    // Skip multi-word aliases for fuzzy matching
    if (alias.includes(' ')) continue;
    const distance = levenshtein(firstWord, alias);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = command;
    }
  }

  if (!bestMatch) return null;

  const rest = words.slice(1).join(' ').trim() || undefined;
  return { command: bestMatch, subCommand: rest };
}

// ===================================================================
// RATE LIMITING
// ===================================================================

/**
 * Check rate limit using database (persists across Lambda cold starts).
 * Allows 10 commands per hour per phone number.
 */
export async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: messages } = await db
      .from('whatsapp_messages')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('message_type', 'command')
      .eq('direction', 'inbound')
      .gte('sent_at', oneHourAgo)
      .execute();

    return !messages || messages.length < 10;
  } catch {
    // If rate limit check fails, allow the command (fail open)
    return true;
  }
}

// ===================================================================
// COMMAND HANDLERS
// ===================================================================

async function handleBalance(phoneNumber: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (!loan) {
    return `Hi ${customer.first_name}! You don't have any active loans.\n\nWant to apply? Reply *APPLY* to get started.`;
  }

  // Default to Lynia DB data
  let outstanding = loan.total_amount_due - (loan.total_amount_paid || 0);
  let nextDue = loan.next_payment_date
    ? new Date(loan.next_payment_date).toLocaleDateString('en-ZW', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'N/A';
  let nextDueAmount = loan.monthly_installment_amount || 0;

  // Try Fineract for real-time balance (source of truth for accounting)
  if (loan.fineract_loan_id && process.env.FINERACT_SECRET_NAME) {
    try {
      const fBalance = await getFineractLoanBalance(loan.fineract_loan_id);
      if (fBalance) {
        outstanding = fBalance.totalOutstanding;
        nextDue = fBalance.nextDueDate
          ? fBalance.nextDueDate.toLocaleDateString('en-ZW', { weekday: 'short', month: 'short', day: 'numeric' })
          : 'N/A';
        nextDueAmount = fBalance.nextDueAmount;
      }
    } catch {
      // Fineract unavailable - continue with Lynia DB defaults above
    }
  }

  const isDigital = loan.product_category === 'digital';
  const productLine = isDigital
    ? 'Product: Digital Cash Loan'
    : `Device: ${loan.device_model || 'Smartphone'}`;

  return `💰 *Loan Balance*

Hi ${customer.first_name}!

Loan ID: ${loan.loan_reference || loan.id}
${productLine}

📊 *Summary:*
• Total Loan: $${loan.total_amount_due?.toFixed(2)}
• Amount Paid: $${(loan.total_amount_paid || 0).toFixed(2)}
• Outstanding: *$${outstanding.toFixed(2)}*
• Monthly Payment: $${loan.monthly_installment_amount?.toFixed(2)}

📅 Next Payment: *${nextDue}*
💵 Amount Due: *$${nextDueAmount.toFixed(2)}*

Reply:
1 - Pay now
2 - View schedule
3 - Request extension`;
}

async function handleHistory(phoneNumber: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: payments } = await db
    .from('payments')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(5)
    .execute();

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
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await db
    .from('loans')
    .select('*')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (!loan) return `Hi ${customer.first_name}! No active loan found.`;

  // Try Fineract for real-time schedule (source of truth for accounting)
  if (loan.fineract_loan_id && process.env.FINERACT_SECRET_NAME) {
    try {
      const schedule = await getFineractRepaymentSchedule(loan.fineract_loan_id);
      if (schedule && schedule.length > 0) {
        let message = `📅 *Payment Schedule*\n\nLoan: ${loan.loan_reference || loan.id}\n\n`;

        for (const period of schedule) {
          const dateStr = period.dueDate.toLocaleDateString('en-ZW', { month: 'short', day: 'numeric', year: '2-digit' });
          message += `${period.complete ? '✅' : '⬜'} Month ${period.period}: $${period.totalDue.toFixed(2)} - ${dateStr}\n`;
        }

        const totalOutstanding = schedule.reduce((sum, p) => sum + p.outstanding, 0);
        const pendingCount = schedule.filter((p) => !p.complete).length;
        message += `\n*Remaining:* $${totalOutstanding.toFixed(2)} (${pendingCount} payments)`;

        return message;
      }
    } catch {
      // Fallback to Lynia DB schedule below
    }
  }

  // Fallback: calculate schedule from Lynia DB data
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

/**
 * Handle PAY command — initiate a loan repayment via mobile money.
 * Looks up the customer's active loan, gets the next installment amount,
 * initiates payment via the payment service, and shows USSD instructions.
 */
async function handlePay(phoneNumber: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await db
    .from('loans')
    .select('id, loan_reference, next_payment_amount_usd, monthly_installment_amount, total_amount_due, total_amount_paid, outstanding_balance_usd')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (!loan) {
    return `Hi ${customer.first_name}! You don't have any active loans.\n\nWant to apply? Reply *APPLY* to get started.`;
  }

  // Get next installment amount — try Fineract first, fall back to Lynia DB
  const installmentAmount = loan.next_payment_amount_usd || loan.monthly_installment_amount;
  const outstanding = loan.outstanding_balance_usd || (loan.total_amount_due - (loan.total_amount_paid || 0));
  const merchantCode = process.env.ECOCASH_MERCHANT_CODE || '171717';

  if (!installmentAmount || installmentAmount <= 0) {
    return `Hi ${customer.first_name}! We couldn't determine your next payment amount.\n\nPlease contact support@lynia.finance for help.`;
  }

  // Initiate payment via payment service
  try {
    const paymentApiUrl = `${process.env.API_BASE_URL || ''}/api/v1/payments/initiate`;
    const paymentResponse = await fetch(paymentApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        loan_id: loan.id,
        customer_id: customer.id,
        amount: installmentAmount,
        customer_phone: phoneNumber,
        payment_type: 'repayment',
        currency: 'USD',
      }),
    });

    if (!paymentResponse.ok) {
      throw new Error(`Payment service returned ${paymentResponse.status}`);
    }
  } catch {
    // Payment initiation failed — still show USSD instructions as fallback
  }

  // Audit log: payment initiated via WhatsApp PAY command
  auditLogEntry({
    userId: customer.id,
    userType: 'customer',
    action: 'payment.initiated',
    entityType: 'loan',
    entityId: loan.id,
    description: `Customer initiated repayment of $${installmentAmount.toFixed(2)} via WhatsApp PAY command`,
    changes: { amount: installmentAmount, payment_type: 'repayment', channel: 'whatsapp' },
  }).catch(() => {});

  return `💰 *Payment for Loan ${loan.loan_reference || loan.id}*

Amount Due: *$${installmentAmount.toFixed(2)}*
Outstanding Balance: *$${outstanding.toFixed(2)}*

To pay, dial on your phone:
📱 EcoCash: *151*2*1*${merchantCode}*${installmentAmount.toFixed(2)}#
📱 OneMoney: *111*3*${merchantCode}*${installmentAmount.toFixed(2)}#

Use your National ID as the payment reference.

Your payment will be confirmed via WhatsApp within a few minutes.

Need help? Type HELP`;
}

/**
 * Handle SETTLE command — early payoff of the full outstanding loan balance.
 * Shows the total outstanding amount and asks for confirmation before
 * initiating a full balance payment.
 */
async function handleSettle(phoneNumber: string, subCommand?: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await db
    .from('loans')
    .select('id, loan_reference, total_amount_due, total_amount_paid, outstanding_balance_usd')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (!loan) {
    return `Hi ${customer.first_name}! You don't have any active loans.\n\nWant to apply? Reply *APPLY* to get started.`;
  }

  const outstandingBalance = loan.outstanding_balance_usd || (loan.total_amount_due - (loan.total_amount_paid || 0));
  const merchantCode = process.env.ECOCASH_MERCHANT_CODE || '171717';

  // Handle YES confirmation
  if (subCommand && subCommand.toLowerCase() === 'yes') {
    // Initiate full balance payment
    try {
      const paymentApiUrl = `${process.env.API_BASE_URL || ''}/api/v1/payments/initiate`;
      const paymentResponse = await fetch(paymentApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          loan_id: loan.id,
          customer_id: customer.id,
          amount: outstandingBalance,
          customer_phone: phoneNumber,
          payment_type: 'early_payoff',
          currency: 'USD',
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error(`Payment service returned ${paymentResponse.status}`);
      }
    } catch {
      // Payment initiation failed — still show USSD instructions as fallback
    }

    // Audit log: early payoff initiated via WhatsApp SETTLE command
    auditLogEntry({
      userId: customer.id,
      userType: 'customer',
      action: 'payment.early_payoff_initiated',
      entityType: 'loan',
      entityId: loan.id,
      description: `Customer initiated early payoff of $${outstandingBalance.toFixed(2)} via WhatsApp SETTLE command`,
      changes: { amount: outstandingBalance, payment_type: 'early_payoff', channel: 'whatsapp' },
    }).catch(() => {});

    return `💰 *Early Payoff — Loan ${loan.loan_reference || loan.id}*

Amount: *$${outstandingBalance.toFixed(2)}*

To pay, dial on your phone:
📱 EcoCash: *151*2*1*${merchantCode}*${outstandingBalance.toFixed(2)}#
📱 OneMoney: *111*3*${merchantCode}*${outstandingBalance.toFixed(2)}#

Use your National ID as the payment reference.

Your payment will be confirmed via WhatsApp within a few minutes.

Need help? Type HELP`;
  }

  return `💰 *Early Payoff — Loan ${loan.loan_reference || loan.id}*

Total Outstanding: *$${outstandingBalance.toFixed(2)}*

Paying this amount will close your loan completely.
No early payoff fees apply.

Reply *YES* to proceed with early payoff of $${outstandingBalance.toFixed(2)}
Reply *NO* to cancel`;
}

/**
 * Display available commands to the customer
 */
function handleHelp(): string {
  return `📱 *Lynia Finance Commands*

Available commands:

💰 *BALANCE* - Check your loan balance and next payment
💵 *PAY* - Make a loan payment
💰 *SETTLE* - Pay off your entire loan early
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
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  // Check if the customer's active loan is a digital loan (no associated device)
  const { data: activeLoan } = await db
    .from('loans')
    .select('product_category')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (activeLoan?.product_category === 'digital') {
    return `Hi ${customer.first_name}! Your digital loan has no associated device.\n\nReply *BALANCE* to check your loan balance.`;
  }

  const { data: device } = await db
    .from('devices')
    .select('*')
    .eq('customer_id', customer.id)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

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

async function handleUpdate(phoneNumber: string, subCommand?: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name, email, address_line1, city')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  // Check if this is a follow-up response to an update prompt
  if (subCommand) {
    const choice = subCommand.trim();

    // Handle email update
    if (choice.includes('@') && choice.includes('.')) {
      await db.from('customers')
        .update({ email: choice, updated_at: new Date() })
        .eq('id', customer.id)
        .execute();
      return `✅ Email updated to: ${choice}`;
    }

    // Handle address update (any text longer than 5 chars that isn't an option number)
    if (choice.length > 5 && !['1', '2', '3'].includes(choice)) {
      await db.from('customers')
        .update({ address_line1: choice, updated_at: new Date() })
        .eq('id', customer.id)
        .execute();
      return `✅ Address updated.`;
    }

    if (choice === '1') {
      return `📱 *Phone Number Change*\n\nPhone number changes require identity re-verification.\n\nPlease contact support@lynia.finance or visit your nearest distributor to update your phone number.`;
    }
    if (choice === '2') {
      return `📧 *Update Email*\n\nCurrent email: ${customer.email || 'Not set'}\n\nPlease type your new email address:`;
    }
    if (choice === '3') {
      return `🏠 *Update Address*\n\nCurrent address: ${customer.address_line1 || 'Not set'}${customer.city ? `, ${customer.city}` : ''}\n\nPlease type your new address:`;
    }
  }

  return `✏️ *Update Contact Details*

What would you like to update?

1 - Phone number
2 - Email address
3 - Home address

Reply with the number of your choice.

Note: Phone number changes require identity verification.`;
}

async function handleExtension(phoneNumber: string, subCommand?: string): Promise<string> {
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name')
    .eq('phone_number', phoneNumber)
    .single()
    .execute();

  if (!customer) return 'Account not found. Please contact support.';

  const { data: loan } = await db
    .from('loans')
    .select('id, loan_reference, next_payment_date, extension_count')
    .eq('customer_id', customer.id)
    .in('loan_status', ['active', 'delinquent'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .execute();

  if (!loan) return 'You do not have an active loan to extend.';

  // Handle YES confirmation
  if (subCommand && (subCommand.toLowerCase() === 'yes' || subCommand.toLowerCase() === 'confirm')) {
    const extensionCount = loan.extension_count || 0;

    if (extensionCount >= 2) {
      return `❌ *Extension Limit Reached*\n\nYou have already used 2 extensions on this loan.\n\nPlease make your payment or contact support@lynia.finance for assistance.`;
    }

    // Calculate new due date (7 days extension)
    const currentDue = loan.next_payment_date ? new Date(loan.next_payment_date) : new Date();
    const newDueDate = new Date(currentDue.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Update loan with extension
    await db.from('loans')
      .update({
        next_payment_date: newDueDate,
        extension_count: extensionCount + 1,
        updated_at: new Date()
      })
      .eq('id', loan.id)
      .execute();

    const formattedDate = newDueDate.toLocaleDateString('en-ZW', { weekday: 'short', month: 'short', day: 'numeric' });

    return `✅ *Extension Approved*\n\nHi ${customer.first_name}!\n\nYour payment has been extended by 7 days.\n\n📅 New due date: *${formattedDate}*\n⚠️ Extensions used: ${extensionCount + 1}/2\n\nA late fee of $2 will apply.\n\nReply *BALANCE* to see your updated account.`;
  }

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
  const parsed = parseCommand(message);

  if (!parsed) return null;

  const { command, subCommand } = parsed;

  // Rate limit check (database-backed, persists across cold starts)
  if (!(await checkRateLimit(phoneNumber))) {
    return '⚠️ You\'ve sent too many commands. Please wait a few minutes before trying again.';
  }

  // Log command usage
  await db.from('whatsapp_messages').insert({
    phone_number: phoneNumber,
    message_type: 'command',
    direction: 'inbound',
    content: `Command: ${command}`,
    status: 'delivered',
  }).execute().then(() => {}).catch(() => {});

  switch (command) {
    case 'BALANCE': return handleBalance(phoneNumber);
    case 'HISTORY': return handleHistory(phoneNumber);
    case 'SCHEDULE': return handleSchedule(phoneNumber);
    case 'HELP': return handleHelp();
    case 'DEVICE': return handleDevice(phoneNumber);
    case 'UPDATE': return handleUpdate(phoneNumber, subCommand);
    case 'EXTENSION': return handleExtension(phoneNumber, subCommand);
    case 'PAY': return handlePay(phoneNumber);
    case 'SETTLE': return handleSettle(phoneNumber, subCommand);
    default: return null;
  }
}
