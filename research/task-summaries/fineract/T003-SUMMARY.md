# T003: Fineract Account Query API - Research Summary

**Status:** ✅ Research Complete
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/6

---

## Executive Summary

Fineract provides comprehensive query APIs to retrieve loan details, balances, repayment schedules, and transaction history. These APIs power the "Check Balance" feature in the WhatsApp bot.

**Key Finding:** A single API call can retrieve complete loan information including outstanding balance, next due date, payment history, and full repayment schedule.

---

## 1. Get Loan with Repayment Schedule

### Endpoint
`GET /fineract-provider/api/v1/loans/{loanId}?associations=repaymentSchedule`

### Purpose
Retrieve complete loan information including repayment schedule for displaying in WhatsApp bot.

### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `associations` | string | Related data to include | `repaymentSchedule` |

### Other Useful Associations
```
associations=all                    // Everything
associations=repaymentSchedule      // Just repayment schedule
associations=transactions           // Just transaction history
associations=charges                // Just fees/charges
associations=guarantors             // Just guarantors
associations=collateral             // Just collateral

// Multiple associations (comma-separated)
associations=repaymentSchedule,transactions
```

### Example Request
```bash
GET /fineract-provider/api/v1/loans/456?associations=repaymentSchedule
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=
Fineract-Platform-TenantId: default
```

### Example Response (Condensed)
```json
{
  "id": 456,
  "accountNo": "000000456",
  "clientId": 123,
  "clientName": "John Doe",
  "loanProductId": 1,
  "loanProductName": "Device Financing",
  "currency": {
    "code": "USD",
    "displaySymbol": "$"
  },
  "principal": 500.00,
  "approvedPrincipal": 500.00,
  "numberOfRepayments": 8,
  "loanTermFrequency": 8,
  "repaymentEvery": 1,
  "interestRatePerPeriod": 2.5,
  "annualInterestRate": 30.0,
  "status": {
    "id": 300,
    "code": "loanStatusType.active",
    "value": "Active"
  },
  "timeline": {
    "submittedOnDate": [2025, 11, 10],
    "approvedOnDate": [2025, 11, 10],
    "expectedDisbursementDate": [2025, 11, 10],
    "actualDisbursementDate": [2025, 11, 10]
  },
  "summary": {
    "currency": {
      "code": "USD",
      "displaySymbol": "$"
    },
    "principalDisbursed": 500.00,
    "principalPaid": 150.00,
    "principalOutstanding": 350.00,
    "interestCharged": 60.00,
    "interestPaid": 30.00,
    "interestOutstanding": 30.00,
    "feeChargesCharged": 0.00,
    "totalExpectedRepayment": 560.00,
    "totalRepayment": 180.00,
    "totalOutstanding": 380.00,
    "totalOverdue": 75.00
  },
  "repaymentSchedule": {
    "currency": {
      "code": "USD",
      "displaySymbol": "$"
    },
    "loanTermInDays": 240,
    "totalPrincipalExpected": 500.00,
    "totalPrincipalPaid": 150.00,
    "totalInterestCharged": 60.00,
    "totalFeeChargesCharged": 0.00,
    "totalPenaltyChargesCharged": 0.00,
    "totalRepaymentExpected": 560.00,
    "totalRepayment": 180.00,
    "totalOutstanding": 380.00,
    "periods": [
      {
        "period": 1,
        "dueDate": [2025, 12, 10],
        "principalDue": 62.50,
        "interestDue": 12.50,
        "feeChargesDue": 0.00,
        "totalDueForPeriod": 75.00,
        "principalPaid": 62.50,
        "interestPaid": 12.50,
        "totalPaid": 75.00,
        "totalOutstanding": 0.00,
        "complete": true
      },
      {
        "period": 2,
        "dueDate": [2026, 1, 10],
        "principalDue": 62.50,
        "interestDue": 12.50,
        "totalDueForPeriod": 75.00,
        "principalPaid": 62.50,
        "interestPaid": 12.50,
        "totalPaid": 75.00,
        "totalOutstanding": 0.00,
        "complete": true
      },
      {
        "period": 3,
        "dueDate": [2026, 2, 10],
        "principalDue": 62.50,
        "interestDue": 12.50,
        "totalDueForPeriod": 75.00,
        "principalPaid": 25.00,
        "interestPaid": 5.00,
        "totalPaid": 30.00,
        "totalOutstanding": 45.00,
        "complete": false
      }
      // ... more periods
    ]
  }
}
```

---

## 2. Understanding the Response Data

### Key Summary Fields

| Field | Description | Use in WhatsApp Bot |
|-------|-------------|---------------------|
| `summary.totalOutstanding` | Total amount still owed | **"Your balance: $380"** |
| `summary.totalOverdue` | Amount past due date | **"Overdue: $75"** (if > 0) |
| `summary.principalOutstanding` | Remaining loan amount | "Principal left: $350" |
| `summary.interestOutstanding` | Remaining interest | "Interest left: $30" |

### Repayment Schedule Fields

| Field | Description | Use in WhatsApp Bot |
|-------|-------------|---------------------|
| `periods[].dueDate` | Payment due date | "Next payment: 10 Feb 2026" |
| `periods[].totalDueForPeriod` | Monthly payment amount | "Amount due: $75" |
| `periods[].totalOutstanding` | Still owed for this period | Show if partial payment |
| `periods[].complete` | Payment completed? | Show ✅ or ⏳ |

### Date Format
```javascript
// Fineract returns dates as arrays: [year, month, day]
const dueDate = [2026, 2, 10];

// Convert to readable format
const formatDate = (dateArray) => {
  const [year, month, day] = dateArray;
  return `${day} ${getMonthName(month)} ${year}`;
};

// Result: "10 February 2026"
```

---

## 3. WhatsApp Bot Integration: "Check Balance" Command

### User Flow
```
Customer sends: "Check Balance"
    ↓
WhatsApp bot: Query Fineract for loan details
    ↓
WhatsApp bot: Format and display balance info
```

### Code Example
```javascript
// Handle "Check Balance" command
async function handleCheckBalance(customerPhone) {
  // 1. Get customer's loan
  const customer = await db.getCustomerByPhone(customerPhone);
  if (!customer || !customer.fineractLoanId) {
    return whatsapp.sendMessage(customerPhone,
      "❌ No active loan found.\n\n" +
      "Type APPLY to start a new loan application."
    );
  }

  // 2. Query Fineract for loan details
  const loan = await fineractAPI.getLoan(customer.fineractLoanId, {
    associations: 'repaymentSchedule'
  });

  // 3. Find next due installment
  const nextDue = loan.repaymentSchedule.periods.find(p => !p.complete);

  // 4. Format message
  const message = formatBalanceMessage(loan, nextDue);

  // 5. Send to customer
  await whatsapp.sendMessage(customerPhone, message);
}

function formatBalanceMessage(loan, nextDue) {
  const isOverdue = loan.summary.totalOverdue > 0;

  let message = `💰 *Your Loan Balance*\n\n`;
  message += `📱 Device: ${loan.loanProductName}\n`;
  message += `💵 Original Amount: $${loan.principal}\n\n`;

  message += `--- Current Status ---\n`;
  message += `✅ Paid: $${loan.summary.totalRepayment}\n`;
  message += `⏳ Outstanding: $${loan.summary.totalOutstanding}\n`;

  if (isOverdue) {
    message += `⚠️ *OVERDUE: $${loan.summary.totalOverdue}*\n`;
  }

  if (nextDue) {
    const dueDate = formatDate(nextDue.dueDate);
    message += `\n--- Next Payment ---\n`;
    message += `📅 Due Date: ${dueDate}\n`;
    message += `💵 Amount: $${nextDue.totalDueForPeriod}\n`;

    if (nextDue.totalPaid > 0) {
      message += `✅ Paid: $${nextDue.totalPaid}\n`;
      message += `⏳ Still Due: $${nextDue.totalOutstanding}\n`;
    }
  }

  message += `\n💳 Type PAY to make a payment`;

  return message;
}
```

### Example WhatsApp Messages

#### Scenario 1: On-time payments
```
💰 Your Loan Balance

📱 Device: Samsung Galaxy A14
💵 Original Amount: $500

--- Current Status ---
✅ Paid: $180
⏳ Outstanding: $380

--- Next Payment ---
📅 Due Date: 10 February 2026
💵 Amount: $75

💳 Type PAY to make a payment
```

#### Scenario 2: Overdue payment
```
💰 Your Loan Balance

📱 Device: Samsung Galaxy A14
💵 Original Amount: $500

--- Current Status ---
✅ Paid: $180
⏳ Outstanding: $380
⚠️ OVERDUE: $75

--- Next Payment ---
📅 Due Date: 10 February 2026 (PAST DUE)
💵 Amount: $75
✅ Paid: $30
⏳ Still Due: $45

⚠️ Please pay $45 to avoid device lock
💳 Type PAY to make a payment
```

#### Scenario 3: Partial payment
```
💰 Your Loan Balance

📱 Device: Samsung Galaxy A14
💵 Original Amount: $500

--- Current Status ---
✅ Paid: $180
⏳ Outstanding: $380

--- Next Payment ---
📅 Due Date: 10 February 2026
💵 Amount: $75
✅ Paid: $30
⏳ Still Due: $45

💳 Type PAY to complete this payment
```

---

## 4. Get Transaction History

### Endpoint
`GET /fineract-provider/api/v1/loans/{loanId}/transactions`

### Purpose
Show payment history to customer.

### Example Request
```bash
GET /fineract-provider/api/v1/loans/456/transactions
Authorization: Basic bWlmb3M6cGFzc3dvcmQ=
Fineract-Platform-TenantId: default
```

### Example Response
```json
[
  {
    "id": 789,
    "type": {
      "id": 2,
      "code": "loanTransactionType.repayment",
      "value": "Repayment"
    },
    "date": [2025, 12, 10],
    "amount": 75.00,
    "principalPortion": 62.50,
    "interestPortion": 12.50,
    "feeChargesPortion": 0.00,
    "outstandingLoanBalance": 437.50,
    "submittedOnDate": [2025, 12, 10],
    "manuallyReversed": false
  },
  {
    "id": 790,
    "type": {
      "id": 2,
      "code": "loanTransactionType.repayment",
      "value": "Repayment"
    },
    "date": [2026, 1, 10],
    "amount": 75.00,
    "principalPortion": 62.50,
    "interestPortion": 12.50,
    "outstandingLoanBalance": 375.00
  }
  // ... more transactions
]
```

### WhatsApp Integration: "Payment History" Command
```javascript
async function handlePaymentHistory(customerPhone) {
  const customer = await db.getCustomerByPhone(customerPhone);
  const transactions = await fineractAPI.getLoanTransactions(customer.fineractLoanId);

  // Filter only repayments (exclude disbursement, charges, etc.)
  const payments = transactions.filter(t =>
    t.type.code === 'loanTransactionType.repayment' &&
    !t.manuallyReversed
  );

  // Show last 5 payments
  const recentPayments = payments.slice(0, 5);

  let message = `📜 *Payment History*\n\n`;

  recentPayments.forEach((payment, index) => {
    const date = formatDate(payment.date);
    message += `${index + 1}. ${date}\n`;
    message += `   Amount: $${payment.amount}\n`;
    message += `   Balance after: $${payment.outstandingLoanBalance}\n\n`;
  });

  if (payments.length > 5) {
    message += `_Showing last 5 of ${payments.length} payments_`;
  }

  await whatsapp.sendMessage(customerPhone, message);
}
```

### Example WhatsApp Message
```
📜 Payment History

1. 10 December 2025
   Amount: $75
   Balance after: $437.50

2. 10 January 2026
   Amount: $75
   Balance after: $375.00

3. 10 February 2026
   Amount: $30
   Balance after: $380.00

Showing last 3 of 3 payments
```

---

## 5. Calculate Days Overdue

### Fineract doesn't provide "days overdue" directly - you must calculate it

```javascript
function calculateDaysOverdue(loan) {
  const today = new Date();

  // Find first incomplete (overdue) period
  const overduePeriod = loan.repaymentSchedule.periods.find(p =>
    !p.complete && p.totalOutstanding > 0
  );

  if (!overduePeriod) {
    return 0; // No overdue payments
  }

  const [year, month, day] = overduePeriod.dueDate;
  const dueDate = new Date(year, month - 1, day); // month is 0-indexed in JS

  if (today <= dueDate) {
    return 0; // Not yet due
  }

  // Calculate days past due
  const diffTime = today - dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

// Usage
const daysOverdue = calculateDaysOverdue(loan);

if (daysOverdue > 0) {
  console.log(`Customer is ${daysOverdue} days overdue`);

  // Check grace period
  const gracePeriod = calculateGracePeriod(customer.paymentHistory);

  if (daysOverdue >= gracePeriod) {
    console.log('⚠️ Lock device!');
  } else {
    console.log(`${gracePeriod - daysOverdue} days left before lock`);
  }
}
```

---

## 6. Get Loan Summary Only (Lightweight)

### If you only need balance (not full schedule)

```bash
GET /fineract-provider/api/v1/loans/456
```

Response includes `summary` but not `repaymentSchedule` - faster and lighter.

### Use Case: Quick Balance Check
```javascript
// Faster - no repayment schedule
const loan = await fineractAPI.getLoan(loanId); // No associations

return {
  totalOutstanding: loan.summary.totalOutstanding,
  totalOverdue: loan.summary.totalOverdue,
  nextPaymentDue: loan.summary.nextPaymentDueDate
};
```

---

## 7. Find Specific Customer Loan

### By Client ID
```bash
GET /fineract-provider/api/v1/clients/{clientId}/loans
```

Returns all loans for a client (active, closed, pending).

### By External ID (National ID)
```bash
# First, find client by external ID
GET /fineract-provider/api/v1/clients?externalId=63-123456-A-12

# Then, get their loans
GET /fineract-provider/api/v1/clients/{clientId}/loans
```

### By Account Number
```bash
GET /fineract-provider/api/v1/loans?accountNo=000000456
```

### Best Practice: Cache Mapping
```javascript
// Store mapping in your database
await db.saveCustomerLoanMapping({
  whatsappPhone: '263771234567',
  nationalId: '63-123456-A-12',
  fineractClientId: 123,
  fineractLoanId: 456,
  loanAccountNo: '000000456'
});

// Then quick lookup:
const customer = await db.getCustomerByPhone('263771234567');
const loan = await fineractAPI.getLoan(customer.fineractLoanId);
```

---

## 8. Key Findings for Lynia Finance

### ✅ What Works Well
1. **Single API call** retrieves everything (balance, schedule, transactions)
2. **Detailed breakdown** of principal vs interest
3. **Per-period tracking** shows exactly what's paid/owed
4. **Overdue calculation** via summary.totalOverdue
5. **Date arrays** are easy to parse and format

### ⚠️ Things to Note
1. **Dates as arrays** - need conversion for display: `[2026, 2, 10]` → `"10 Feb 2026"`
2. **No "days overdue" field** - must calculate yourself
3. **No "next payment" direct field** - must find first incomplete period
4. **Large response** - use associations wisely (only request what you need)
5. **Month is 1-indexed** - February = 2 (unlike JavaScript where Feb = 1)

### 🔧 Recommendations
1. **Cache loan ID** mapping in your database (phone → loan ID)
2. **Request only needed data** - use specific associations, not `all`
3. **Calculate grace period** logic on your side (Fineract doesn't know about device locks)
4. **Format dates** consistently for WhatsApp display
5. **Show overdue warnings** prominently to encourage payment

---

## 9. Complete Integration Example

```javascript
/**
 * Complete "Check Balance" feature for WhatsApp bot
 */

class LoanBalanceService {

  /**
   * Get formatted balance for WhatsApp display
   */
  async getBalanceMessage(customerPhone) {
    try {
      // 1. Get customer from database
      const customer = await db.getCustomerByPhone(customerPhone);

      if (!customer || !customer.fineractLoanId) {
        return {
          success: false,
          message: "❌ No active loan found.\n\nType APPLY to start."
        };
      }

      // 2. Query Fineract (only get what we need)
      const loan = await fineractAPI.getLoan(customer.fineractLoanId, {
        associations: 'repaymentSchedule'
      });

      // 3. Check loan status
      if (loan.status.code !== 'loanStatusType.active') {
        return {
          success: false,
          message: `Your loan is ${loan.status.value.toLowerCase()}.`
        };
      }

      // 4. Find next payment
      const nextDue = this.findNextPayment(loan);
      const daysOverdue = this.calculateDaysOverdue(loan);
      const gracePeriod = this.calculateGracePeriod(customer);

      // 5. Format message
      const message = this.formatMessage(loan, nextDue, daysOverdue, gracePeriod);

      return {
        success: true,
        message: message,
        data: {
          outstanding: loan.summary.totalOutstanding,
          overdue: loan.summary.totalOverdue,
          daysOverdue: daysOverdue,
          gracePeriodRemaining: Math.max(0, gracePeriod - daysOverdue)
        }
      };

    } catch (error) {
      console.error('Balance query error:', error);
      return {
        success: false,
        message: "❌ Error retrieving balance. Please try again."
      };
    }
  }

  /**
   * Find next unpaid installment
   */
  findNextPayment(loan) {
    return loan.repaymentSchedule.periods.find(p =>
      p.period > 0 && !p.complete
    );
  }

  /**
   * Calculate days overdue
   */
  calculateDaysOverdue(loan) {
    const overduePeriod = loan.repaymentSchedule.periods.find(p =>
      p.period > 0 && !p.complete && p.totalOutstanding > 0
    );

    if (!overduePeriod) return 0;

    const [year, month, day] = overduePeriod.dueDate;
    const dueDate = new Date(year, month - 1, day);
    const today = new Date();

    if (today <= dueDate) return 0;

    return Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate grace period based on payment history
   */
  calculateGracePeriod(customer) {
    const latePayments = customer.latePaymentCount || 0;

    // FR-223 to FR-227: Grace period formula
    if (latePayments === 0 || latePayments === 1) return 15;
    if (latePayments === 2 || latePayments === 3) return 12;
    if (latePayments === 4 || latePayments === 5) return 10;
    return 7; // 6+ late payments
  }

  /**
   * Format balance message for WhatsApp
   */
  formatMessage(loan, nextDue, daysOverdue, gracePeriod) {
    const isOverdue = daysOverdue > 0;
    const lockImminent = daysOverdue >= gracePeriod - 2;

    let msg = `💰 *Your Loan Balance*\n\n`;
    msg += `📱 ${loan.loanProductName}\n`;
    msg += `💵 Original: $${loan.principal}\n\n`;

    msg += `--- Status ---\n`;
    msg += `✅ Paid: $${loan.summary.totalRepayment}\n`;
    msg += `⏳ Outstanding: $${loan.summary.totalOutstanding}\n`;

    if (isOverdue) {
      msg += `\n⚠️ *OVERDUE: $${loan.summary.totalOverdue}*\n`;
      msg += `📅 ${daysOverdue} days past due\n`;

      if (lockImminent) {
        const daysLeft = Math.max(0, gracePeriod - daysOverdue);
        msg += `\n🔴 *URGENT: Device will lock in ${daysLeft} days!*\n`;
      }
    }

    if (nextDue) {
      const dueDate = this.formatDate(nextDue.dueDate);
      msg += `\n--- Next Payment ---\n`;
      msg += `📅 ${isOverdue ? 'WAS DUE' : 'Due'}: ${dueDate}\n`;
      msg += `💵 Amount: $${nextDue.totalDueForPeriod}\n`;

      if (nextDue.totalPaid > 0) {
        msg += `✅ Paid: $${nextDue.totalPaid}\n`;
        msg += `⏳ Still Due: $${nextDue.totalOutstanding}\n`;
      }
    }

    msg += `\n💳 Type PAY to make payment`;

    if (isOverdue) {
      msg += `\n📞 Type HELP for assistance`;
    }

    return msg;
  }

  /**
   * Format Fineract date array to readable string
   */
  formatDate(dateArray) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month, day] = dateArray;
    return `${day} ${months[month - 1]} ${year}`;
  }
}

// Usage in WhatsApp bot
const balanceService = new LoanBalanceService();

bot.on('message', async (msg) => {
  if (msg.body.toLowerCase() === 'balance') {
    const result = await balanceService.getBalanceMessage(msg.from);
    await bot.sendMessage(msg.from, result.message);

    // Track if device lock is imminent
    if (result.data?.gracePeriodRemaining <= 2) {
      await lockService.scheduleDeviceLock(msg.from, result.data.gracePeriodRemaining);
    }
  }
});
```

---

## 10. Next Steps

### Related Tasks
- **T001:** Client and loan creation (completed)
- **T002:** Repayment posting (completed)
- **T276-T278:** WhatsApp balance check implementation (Phase 6)
- **T302:** Grace period calculation (Phase 7)

### Testing Checklist
- [ ] Query loan with repayment schedule
- [ ] Query loan transactions
- [ ] Find next due payment
- [ ] Calculate days overdue
- [ ] Format balance message for WhatsApp
- [ ] Handle closed/pending loans
- [ ] Test with partial payments
- [ ] Test with overdue payments

---

## 11. Resources

### API Documentation
- **Loan Query:** GET /loans/{loanId}
- **Transactions:** GET /loans/{loanId}/transactions
- **Client Loans:** GET /clients/{clientId}/loans
- **API Docs:** https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm#loans

### Related Files
- `research/T001-SUMMARY.md` - Loan creation
- `research/T002-SUMMARY.md` - Repayment posting

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T004 - Document Fineract Authentication
