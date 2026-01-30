# T002: Fineract Repayment Posting API - Research Summary

**Status:** ✅ Research Complete
**Date:** 2025-11-10
**GitHub Issue:** https://github.com/1terr/Lynia-finance/issues/5

---

## Executive Summary

Fineract provides a robust API for posting loan repayments. When customers make payments via EcoCash or Omari, we use this API to record the payment in Fineract's loan system.

**Key Finding:** The repayment API handles partial payments, overpayments, and automatically updates the loan balance and repayment schedule.

---

## 1. Repayment Posting API

### Endpoint
`POST /fineract-provider/api/v1/loans/{loanId}/transactions?command=repayment`

### Purpose
Record a customer payment against their active loan.

### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `transactionDate` | string | Payment date | `"10 November 2025"` |
| `transactionAmount` | decimal | Payment amount | `100.00` |
| `dateFormat` | string | Date format | `"dd MMMM yyyy"` |
| `locale` | string | Locale | `"en"` |

### Optional Fields
| Field | Type | Description | Use Case |
|-------|------|-------------|----------|
| `note` | string | Payment note | `"EcoCash payment"` |
| `paymentTypeId` | integer | Payment method | `1` (EcoCash), `2` (Omari) |
| `accountNumber` | string | Transaction reference | `"EC123456789"` |
| `checkNumber` | string | External reference | Payment gateway transaction ID |
| `routingCode` | string | Additional reference | Customer phone number |

### Example Request
```json
{
  "transactionDate": "10 November 2025",
  "transactionAmount": 100.00,
  "dateFormat": "dd MMMM yyyy",
  "locale": "en",
  "note": "Monthly repayment via EcoCash",
  "paymentTypeId": 1,
  "accountNumber": "EC123456789",
  "checkNumber": "ECOCASH_TXN_987654321"
}
```

### Example Response
```json
{
  "officeId": 1,
  "clientId": 123,
  "loanId": 456,
  "resourceId": 789,
  "changes": {
    "transactionDate": "10 November 2025",
    "transactionAmount": 100.00,
    "locale": "en",
    "dateFormat": "dd MMMM yyyy"
  }
}
```

**Key:** The `resourceId` is the **transaction ID** - store this for reconciliation!

---

## 2. Payment Scenarios & Behavior

### Scenario 1: Normal Payment (Exact Amount)
```
Loan: $500 over 8 months
Monthly payment: ~$75
Customer pays: $75

Result: Payment allocated to:
  1. Outstanding interest
  2. Outstanding principal
  3. Fees (if any)
```

### Scenario 2: Partial Payment (Less Than Due)
```
Monthly payment: $75
Customer pays: $50

Result:
  ✅ Payment accepted
  ✅ Loan balance reduced by $50
  ⚠️  Remaining $25 still due
  ⚠️  May trigger late fee if not paid by due date
```

**Key Finding:** Fineract accepts partial payments - no error thrown.

### Scenario 3: Overpayment (More Than Due)
```
Monthly payment: $75
Customer pays: $100

Result:
  ✅ Payment accepted
  ✅ Excess $25 applied to next installment
  ✅ Customer ahead of schedule
```

**Key Finding:** Overpayments automatically apply to future installments.

### Scenario 4: Early Payment (Before Due Date)
```
Due date: 30 November
Customer pays: 10 November

Result:
  ✅ Payment accepted
  ✅ Applied to current installment
  ✅ Customer marked as early payer (good for credit score)
```

### Scenario 5: Late Payment (After Due Date)
```
Due date: 30 November
Customer pays: 5 December

Result:
  ✅ Payment accepted
  ⚠️  Late fee may be charged (based on loan product config)
  ⚠️  Affects credit score
```

---

## 3. Payment Allocation Logic

### Default Strategy: Interest → Principal → Fees

Fineract allocates payments in this order:
1. **Outstanding penalties/late fees**
2. **Outstanding interest**
3. **Outstanding principal**

### Example Breakdown
```
Monthly installment: $75
  - Interest: $25
  - Principal: $50

Payment of $75 is allocated:
  ✅ $25 → Interest
  ✅ $50 → Principal
  ✅ Balance reduced by $50
```

### For Partial Payment ($40)
```
Payment of $40 is allocated:
  ✅ $25 → Interest (fully paid)
  ✅ $15 → Principal (partial)
  ⚠️  $35 principal still outstanding
```

**Key:** Interest is always paid first!

---

## 4. Integration with Payment Gateway

### Payment Flow: EcoCash/Omari → Fineract

```
1. Customer initiates payment via WhatsApp
   ↓
2. WhatsApp bot calls payment-service
   ↓
3. Payment-service calls EcoCash/Omari API
   ↓
4. Customer completes payment on phone (USSD/app)
   ↓
5. EcoCash/Omari sends callback to payment-service
   ↓
6. Payment-service posts to Fineract (THIS API)
   ↓
7. Fineract updates loan balance
   ↓
8. WhatsApp bot notifies customer: "Payment received!"
```

### Code Example for Integration
```javascript
// Callback from EcoCash
app.post('/payment-callback', async (req, res) => {
  const { transactionId, amount, customerPhone, status } = req.body;

  if (status === 'SUCCESS') {
    // 1. Get loan ID from customer phone
    const loan = await db.getLoanByPhone(customerPhone);

    // 2. Post repayment to Fineract
    const repaymentData = {
      transactionDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
      }),
      transactionAmount: amount,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      note: "EcoCash payment",
      paymentTypeId: 1, // EcoCash
      checkNumber: transactionId, // EcoCash transaction ID
      accountNumber: customerPhone
    };

    const result = await fineractAPI.postRepayment(loan.loanId, repaymentData);

    // 3. Store transaction ID for reconciliation
    await db.savePaymentRecord({
      loanId: loan.loanId,
      ecocashTxnId: transactionId,
      fineractTxnId: result.resourceId,
      amount: amount,
      status: 'COMPLETED'
    });

    // 4. Notify customer via WhatsApp
    await whatsappBot.sendMessage(customerPhone,
      `✅ Payment received: $${amount}\n` +
      `Transaction ID: ${transactionId}\n` +
      `New balance: $${await getLoanBalance(loan.loanId)}`
    );

    res.status(200).json({ success: true });
  }
});
```

---

## 5. Transaction ID Management (Critical!)

### Why Transaction IDs Matter

**Problem:** Payment gateways can send duplicate callbacks
- Network issues cause retries
- Gateway bugs cause duplicates
- Customer clicks "pay" multiple times

**Solution:** Idempotency using transaction IDs

### Idempotency Strategy
```javascript
async function processPayment(ecocashTxnId, amount, loanId) {
  // Check if already processed
  const existing = await db.getPaymentByTxnId(ecocashTxnId);
  if (existing) {
    console.log('Duplicate payment callback - already processed');
    return existing; // Return previous result
  }

  // Process payment
  const result = await fineractAPI.postRepayment(loanId, {
    transactionAmount: amount,
    checkNumber: ecocashTxnId, // Use as unique identifier
    // ... other fields
  });

  // Store for future duplicate checks
  await db.savePaymentRecord({
    ecocashTxnId: ecocashTxnId,
    fineractTxnId: result.resourceId,
    status: 'COMPLETED'
  });

  return result;
}
```

**Key:** Use `checkNumber` field to store gateway transaction ID!

---

## 6. Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `loanId not found` | Invalid loan ID | Verify loan exists before posting |
| `Invalid transaction date` | Date in future | Use current date or past date only |
| `Loan is not active` | Loan closed or pending | Check loan status first |
| `Invalid amount` | Negative or zero amount | Validate amount > 0 |
| `Transaction date before disbursement` | Date before loan start | Use date >= disbursement date |

### Example Error Response
```json
{
  "developerMessage": "The loan is closed. No further transactions are allowed.",
  "httpStatusCode": "403",
  "defaultUserMessage": "The loan is closed.",
  "userMessageGlobalisationCode": "error.msg.loan.is.closed"
}
```

### Retry Strategy for Transient Errors
```javascript
async function postRepaymentWithRetry(loanId, data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fineractAPI.postRepayment(loanId, data);
    } catch (error) {
      // Retry only on 500 errors (server issues)
      if (error.status === 500 && i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries} after 2s...`);
        await sleep(2000);
        continue;
      }

      // Don't retry on 400 errors (validation errors)
      throw error;
    }
  }
}
```

---

## 7. Reconciliation Strategy

### Two-Phase Commit Pattern

**Problem:** Payment gateway confirms, but Fineract posting fails

**Solution:** Two-phase status tracking

```javascript
// Phase 1: Payment gateway confirms
await db.savePaymentRecord({
  ecocashTxnId: txnId,
  amount: amount,
  status: 'GATEWAY_CONFIRMED', // ← Phase 1
  gatewayTimestamp: new Date()
});

// Phase 2: Post to Fineract
try {
  const result = await fineractAPI.postRepayment(loanId, data);

  await db.updatePaymentRecord(txnId, {
    status: 'FINERACT_CONFIRMED', // ← Phase 2
    fineractTxnId: result.resourceId,
    fineractTimestamp: new Date()
  });
} catch (error) {
  // Mark as failed - needs manual reconciliation
  await db.updatePaymentRecord(txnId, {
    status: 'FINERACT_FAILED',
    error: error.message
  });

  // Alert admin for manual intervention
  await alertAdmin(`Payment reconciliation failed: ${txnId}`);
}
```

### Background Reconciliation Job

Run every 6 hours to catch failures:
```javascript
// Find payments stuck in GATEWAY_CONFIRMED
const stuckPayments = await db.findPaymentsByStatus('GATEWAY_CONFIRMED', {
  olderThan: '1 hour'
});

for (const payment of stuckPayments) {
  // Retry posting to Fineract
  try {
    const result = await fineractAPI.postRepayment(payment.loanId, {
      transactionAmount: payment.amount,
      checkNumber: payment.ecocashTxnId,
      // ...
    });

    await db.updatePaymentRecord(payment.id, {
      status: 'FINERACT_CONFIRMED',
      fineractTxnId: result.resourceId
    });
  } catch (error) {
    // Escalate to admin after 3 failed retries
    if (payment.retryCount >= 3) {
      await createSupportTicket(payment);
    }
  }
}
```

---

## 8. Payment Status Query

### Get Loan Transactions
`GET /fineract-provider/api/v1/loans/{loanId}/transactions`

```javascript
// Get all transactions for a loan
const transactions = await fineractAPI.getLoanTransactions(loanId);

// Filter for repayments only
const repayments = transactions.filter(t => t.type.value === 'Repayment');

// Show last 3 payments
repayments.slice(0, 3).forEach(payment => {
  console.log(`Date: ${payment.date}`);
  console.log(`Amount: $${payment.amount}`);
  console.log(`Transaction ID: ${payment.id}`);
});
```

### Get Outstanding Balance
```javascript
// Get loan with summary
const loan = await fineractAPI.getLoan(loanId);

console.log(`Original amount: $${loan.principal}`);
console.log(`Total paid: $${loan.summary.totalRepaid}`);
console.log(`Outstanding: $${loan.summary.totalOutstanding}`);
console.log(`Next due: $${loan.summary.totalOverdue > 0 ? 'OVERDUE!' : loan.summary.principalOutstanding}`);
```

---

## 9. Key Findings for Lynia Finance

### ✅ What Works Well
1. **Accepts partial payments** - no errors if customer pays less
2. **Handles overpayments** - automatically applies to next installment
3. **Transaction IDs returned** - easy reconciliation
4. **Flexible payment tracking** - can store gateway transaction IDs
5. **Multiple payment methods** - supports payment type classification

### ⚠️ Important Considerations
1. **Payment allocation order** - Interest always paid first (can't change)
2. **No automatic reversal** - if you post wrong amount, need separate reversal API call
3. **Date validation** - payment date can't be in future
4. **Loan must be active** - can't post to pending or closed loans
5. **No built-in idempotency** - must handle duplicates yourself

### 🔧 Recommendations for Integration
1. **Store both IDs:** EcoCash transaction ID + Fineract transaction ID
2. **Implement idempotency:** Check `checkNumber` before posting
3. **Two-phase commit:** Track gateway confirmation separately from Fineract confirmation
4. **Background reconciliation:** Run every 6 hours to catch failures
5. **Alert on failures:** Create support tickets for manual intervention
6. **Test edge cases:** Partial payments, overpayments, late payments

---

## 10. Integration Checklist

### For WhatsApp Bot
- [ ] Store loan ID in conversation session
- [ ] Show current balance before payment
- [ ] Generate payment link (EcoCash/Omari)
- [ ] Poll payment status while customer completes payment
- [ ] Send confirmation message after successful payment
- [ ] Handle payment failures gracefully

### For Payment Service
- [ ] Create payment initiation endpoint
- [ ] Implement payment callback handler
- [ ] Store payment in `GATEWAY_CONFIRMED` status
- [ ] Post repayment to Fineract
- [ ] Update status to `FINERACT_CONFIRMED`
- [ ] Handle idempotency (duplicate callbacks)
- [ ] Implement retry logic with exponential backoff
- [ ] Create background reconciliation job
- [ ] Alert admin on reconciliation failures

### For Database
- [ ] Create `payment_callbacks` table
  - `id`, `ecocash_txn_id`, `fineract_txn_id`
  - `loan_id`, `amount`, `status`
  - `gateway_timestamp`, `fineract_timestamp`
  - `retry_count`, `error_message`
- [ ] Add unique constraint on `ecocash_txn_id`
- [ ] Add index on `status` for reconciliation queries

---

## 11. Code Example: Complete Integration

```javascript
/**
 * Complete payment flow integration
 */

// 1. Payment callback from EcoCash
app.post('/api/payment-callback', async (req, res) => {
  const { transactionId, amount, phone, status } = req.body;

  try {
    // Check idempotency
    const existing = await db.getPaymentByGatewayTxnId(transactionId);
    if (existing) {
      console.log('Duplicate callback - already processed');
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (status !== 'SUCCESS') {
      console.log('Payment failed at gateway');
      return res.status(200).json({ success: false });
    }

    // Get customer loan
    const loan = await db.getLoanByPhone(phone);
    if (!loan) {
      throw new Error('Loan not found for phone: ' + phone);
    }

    // Save in GATEWAY_CONFIRMED state
    await db.savePayment({
      gatewayTxnId: transactionId,
      loanId: loan.loanId,
      amount: amount,
      status: 'GATEWAY_CONFIRMED',
      gatewayTimestamp: new Date()
    });

    // Post to Fineract
    const repaymentData = {
      transactionDate: new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
      }),
      transactionAmount: parseFloat(amount),
      dateFormat: "dd MMMM yyyy",
      locale: "en",
      note: `EcoCash payment from ${phone}`,
      paymentTypeId: 1,
      checkNumber: transactionId,
      accountNumber: phone
    };

    const result = await fineractAPI.postRepayment(loan.fineractLoanId, repaymentData);

    // Update to FINERACT_CONFIRMED
    await db.updatePayment(transactionId, {
      status: 'FINERACT_CONFIRMED',
      fineractTxnId: result.resourceId,
      fineractTimestamp: new Date()
    });

    // Get updated balance
    const loanDetails = await fineractAPI.getLoan(loan.fineractLoanId);
    const newBalance = loanDetails.summary.totalOutstanding;

    // Notify customer via WhatsApp
    await whatsappBot.sendMessage(phone,
      `✅ *Payment Received*\n\n` +
      `Amount: $${amount}\n` +
      `Transaction ID: ${transactionId}\n` +
      `New Balance: $${newBalance}\n` +
      `Next Due: ${loanDetails.summary.nextPaymentDueDate || 'N/A'}\n\n` +
      `Thank you for your payment!`
    );

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Payment processing error:', error);

    // Mark as failed for reconciliation
    await db.updatePayment(transactionId, {
      status: 'FINERACT_FAILED',
      error: error.message,
      retryCount: 0
    });

    // Don't fail the callback - gateway expects 200
    res.status(200).json({ success: false, error: error.message });
  }
});

// 2. Background reconciliation job (runs every 6 hours)
async function reconcileStuckPayments() {
  console.log('Running payment reconciliation...');

  const stuckPayments = await db.findPaymentsByStatus('GATEWAY_CONFIRMED', {
    olderThan: '1 hour'
  });

  console.log(`Found ${stuckPayments.length} stuck payments`);

  for (const payment of stuckPayments) {
    try {
      // Retry posting to Fineract
      const result = await fineractAPI.postRepayment(payment.fineractLoanId, {
        transactionDate: payment.gatewayTimestamp.toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric'
        }),
        transactionAmount: payment.amount,
        checkNumber: payment.gatewayTxnId,
        // ...
      });

      await db.updatePayment(payment.gatewayTxnId, {
        status: 'FINERACT_CONFIRMED',
        fineractTxnId: result.resourceId
      });

      console.log(`✅ Reconciled: ${payment.gatewayTxnId}`);

    } catch (error) {
      await db.incrementRetryCount(payment.id);

      if (payment.retryCount >= 3) {
        // Create support ticket after 3 failed retries
        await createSupportTicket({
          type: 'PAYMENT_RECONCILIATION_FAILED',
          gatewayTxnId: payment.gatewayTxnId,
          amount: payment.amount,
          error: error.message
        });

        console.log(`❌ Failed after 3 retries: ${payment.gatewayTxnId}`);
      }
    }
  }
}

// Run every 6 hours
setInterval(reconcileStuckPayments, 6 * 60 * 60 * 1000);
```

---

## 12. Next Steps

### Related Tasks
- **T003:** Query loan balance and repayment schedule (for "Check Balance" command)
- **T013-T018:** Payment gateway integration (EcoCash, Omari)
- **T239-T245:** Implement payment callback handler (Phase 4)

### Testing Checklist
- [ ] Test normal payment (exact amount)
- [ ] Test partial payment (less than due)
- [ ] Test overpayment (more than due)
- [ ] Test early payment (before due date)
- [ ] Test late payment (after due date)
- [ ] Test duplicate callback handling
- [ ] Test Fineract posting failure
- [ ] Test reconciliation job

---

## 13. Resources

### API Documentation
- **Endpoint:** POST /loans/{loanId}/transactions?command=repayment
- **API Docs:** https://demo.fineract.dev/fineract-provider/api-docs/apiLive.htm#loans_transactions

### Related Files
- `research/T001-SUMMARY.md` - Client and loan creation
- `research/T003-SUMMARY.md` - Account queries (next task)

---

**Research completed by:** Claude
**Date:** 2025-11-10
**Next:** T003 - Account Query API Research
