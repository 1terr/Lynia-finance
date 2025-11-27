# Refund Processing Design

**Task ID**: P1-T025
**Phase**: Phase 1 - Payment Processing Design
**Priority**: Low
**Estimated**: 4 hours
**Dependencies**: P1-T021

---

## Table of Contents
1. [Overview](#overview)
2. [Refund Scenarios](#refund-scenarios)
3. [Refund Workflow](#refund-workflow)
4. [Approval Process](#approval-process)
5. [Refund Tracking](#refund-tracking)
6. [Customer Communication](#customer-communication)
7. [Implementation](#implementation)

---

## 1. Overview

Refunds are rare but necessary for maintaining customer trust and handling exceptional scenarios. This document outlines the refund initiation, approval, processing, and tracking system.

### Refund Principles

- **Transparency**: Clear refund policies communicated upfront
- **Speed**: Process refunds within 5-7 business days
- **Accuracy**: Prevent incorrect refunds via approval workflow
- **Audit Trail**: Complete logging of all refund transactions

### Expected Refund Volume

- **Monthly Refunds**: < 1% of total payments
- **Common Reasons**: Duplicate payments, overpayments, service errors

---

## 2. Refund Scenarios

### 2.1 Automatic Refund (No Approval Required)

| Scenario | Trigger | Refund Amount | Approval? |
|----------|---------|---------------|-----------|
| **Duplicate Payment** | Same loan, same amount, within 24 hours | Full duplicate amount | ❌ No |
| **System Error Overcharge** | Gateway charges more than requested | Difference amount | ❌ No |
| **Failed Device Delivery** | Device not delivered within 7 days | Full loan amount + payments | ✅ Yes (Ops Manager) |

---

### 2.2 Manual Refund (Approval Required)

| Scenario | Refund Amount | Approval Required |
|----------|---------------|-------------------|
| **Customer Dispute** | Varies | ✅ Operations Manager |
| **Goodwill Refund** | Varies | ✅ Senior Manager |
| **Loan Cancellation (Early)** | Pro-rated amount | ✅ Finance Manager |
| **Incorrect Payment Applied** | Full amount | ✅ Operations Manager |

---

## 3. Refund Workflow

### 3.1 Refund Request Flow

```
┌──────────────────────────────────────────────────────────────┐
│  1. Refund Initiated                                         │
│     - Customer request (WhatsApp/Support)                    │
│     - System detection (duplicate payment)                   │
│     - Admin manual initiation                                │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Validation                                               │
│     - Verify payment exists                                  │
│     - Check payment status (completed)                       │
│     - Verify not already refunded                            │
│     - Calculate refundable amount                            │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  3. Approval (if required)                                   │
│     - Assign to approver based on amount/reason              │
│     - Approver reviews details                               │
│     - Approve or Reject with comments                        │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  4. Process Refund                                           │
│     - Call payment gateway refund API                                 │
│     - Update payment status                                  │
│     - Adjust loan balance (if applicable)                    │
└────────────────┬─────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  5. Notify Customer                                          │
│     - Send refund confirmation (WhatsApp/SMS)                │
│     - Provide refund reference                               │
│     - Explain timeline (5-7 business days)                   │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.2 Refund Initiation

```typescript
interface RefundRequest {
  payment_id: string;
  refund_amount: number;
  refund_reason: 'duplicate_payment' | 'overpayment' | 'service_error' | 'customer_dispute' | 'loan_cancellation' | 'other';
  refund_type: 'full' | 'partial';
  requested_by: string;  // Customer ID or Admin user ID
  customer_comment?: string;
  internal_notes?: string;
  requires_approval: boolean;
}

async function initiateRefund(request: RefundRequest): Promise<Refund> {

  // 1. Validate payment
  const payment = await getPayment(request.payment_id);

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }

  if (payment.status === 'refunded') {
    throw new Error('Payment already refunded');
  }

  // 2. Validate refund amount
  const maxRefundable = payment.amount - (payment.refunded_amount || 0);

  if (request.refund_amount > maxRefundable) {
    throw new Error(`Refund amount ($${request.refund_amount}) exceeds refundable amount ($${maxRefundable})`);
  }

  // 3. Determine if approval required
  const requiresApproval = determineIfApprovalRequired(request);

  // 4. Create refund record
  const { data: refund } = await supabase.from('refunds').insert({
    payment_id: request.payment_id,
    customer_id: payment.customer_id,
    loan_id: payment.loan_id,

    refund_amount: request.refund_amount,
    refund_reason: request.refund_reason,
    refund_type: request.refund_type,

    status: requiresApproval ? 'pending_approval' : 'approved',

    requested_by: request.requested_by,
    customer_comment: request.customer_comment,
    internal_notes: request.internal_notes,

    created_at: new Date()
  }).single();

  // 5. If approval required, assign to approver
  if (requiresApproval) {
    await assignRefundApprover(refund);
  } else {
    // Auto-process (e.g., duplicate payment)
    await processRefund(refund.id);
  }

  return refund;
}

// Determine if refund needs approval
function determineIfApprovalRequired(request: RefundRequest): boolean {

  // Auto-approve small duplicate payment refunds
  if (request.refund_reason === 'duplicate_payment' && request.refund_amount <= 100) {
    return false;
  }

  // Auto-approve system error overpayments
  if (request.refund_reason === 'overpayment' && request.refund_amount <= 10) {
    return false;
  }

  // All other refunds require approval
  return true;
}
```

---

## 4. Approval Process

### 4.1 Approval Hierarchy

| Refund Amount | Refund Reason | Required Approver |
|--------------|---------------|-------------------|
| **< $50** | Any | Operations Manager |
| **$50 - $200** | Customer dispute | Operations Manager |
| **$50 - $200** | Other | Finance Manager |
| **> $200** | Any | Senior Manager + Finance Manager (dual approval) |

---

### 4.2 Approval Workflow

```typescript
async function approveRefund(
  refund_id: string,
  approver_user_id: string,
  decision: 'approved' | 'rejected',
  comments?: string
): Promise<void> {

  const refund = await getRefund(refund_id);

  // Check approver has permission
  const approver = await getAdminUser(approver_user_id);
  const canApprove = checkRefundApprovalPermission(approver, refund);

  if (!canApprove) {
    throw new Error('Insufficient permissions to approve this refund');
  }

  // Update refund status
  await supabase.from('refunds').update({
    status: decision === 'approved' ? 'approved' : 'rejected',
    approved_by: approver_user_id,
    approved_at: new Date(),
    approver_comments: comments
  }).eq('id', refund_id);

  // If approved, process refund
  if (decision === 'approved') {
    await processRefund(refund_id);
  } else {
    // Notify requester of rejection
    await notifyRefundRejection(refund, comments);
  }

  // Log approval decision
  await logAuditEvent({
    action: `refund_${decision}`,
    refund_id,
    approver_user_id,
    refund_amount: refund.refund_amount,
    comments
  });
}
```

---

## 5. Refund Tracking

### 5.1 Process Refund via payment gateway

```typescript
async function processRefund(refund_id: string): Promise<void> {

  const refund = await getRefund(refund_id);
  const payment = await getPayment(refund.payment_id);

  console.log(`Processing refund ${refund_id} for payment ${payment.id}`);

  try {
    // Call payment gateway refund API
    const refundResponse = await gatewayClient.refundPayment({
      originalTransactionId: payment.gateway_transaction_id,
      refundAmount: refund.refund_amount,
      refundReason: refund.refund_reason,
      refundReference: refund.id
    });

    // Update refund record
    await supabase.from('refunds').update({
      status: 'processing',
      gateway_refund_id: refundResponse.refundId,
      gateway_status: refundResponse.status,
      processed_at: new Date()
    }).eq('id', refund_id);

    // Update payment record
    await supabase.from('payments').update({
      status: refund.refund_type === 'full' ? 'refunded' : 'partially_refunded',
      refunded_amount: supabase.raw(`COALESCE(refunded_amount, 0) + ${refund.refund_amount}`)
    }).eq('id', payment.id);

    // Adjust loan balance (if refund affects loan)
    if (refund.loan_id) {
      await adjustLoanBalance(refund.loan_id, -refund.refund_amount);
    }

    // Notify customer
    await sendRefundConfirmation(refund);

    console.log(`Refund ${refund_id} processed successfully`);

  } catch (error) {
    console.error(`Refund processing failed for ${refund_id}`, error);

    // Update refund status
    await supabase.from('refunds').update({
      status: 'failed',
      error_message: error.message,
      failed_at: new Date()
    }).eq('id', refund_id);

    // Alert admins
    await notifyAdmins({
      alert: 'Refund Processing Failed',
      refund_id,
      payment_id: payment.id,
      amount: refund.refund_amount,
      error: error.message
    });

    throw error;
  }
}
```

---

### 5.2 Refund Status Tracking

```typescript
enum RefundStatus {
  PENDING_APPROVAL = 'pending_approval',  // Awaiting manager approval
  APPROVED = 'approved',                  // Approved, ready to process
  PROCESSING = 'processing',              // Sent to payment gateway
  COMPLETED = 'completed',                // Refund successful
  FAILED = 'failed',                      // Refund failed
  REJECTED = 'rejected'                   // Refund request rejected
}
```

**Status Flow**:
```
PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED
                 → REJECTED
                              → FAILED
```

---

### 5.3 Refund Webhook Handling

When payment gateway confirms refund:

```typescript
export async function handleRefundWebhook(refundData: GatewayRefundWebhook): Promise<void> {

  const refund = await supabase
    .from('refunds')
    .select('*')
    .eq('gateway_refund_id', refundData.refundId)
    .single();

  if (!refund.data) {
    console.error('Refund not found for webhook', refundData);
    return;
  }

  // Update refund status based on webhook
  const newStatus = refundData.status === 'COMPLETED' ? 'completed' : 'failed';

  await supabase.from('refunds').update({
    status: newStatus,
    gateway_status: refundData.status,
    completed_at: newStatus === 'completed' ? new Date() : null,
    updated_at: new Date()
  }).eq('id', refund.data.id);

  // Send final confirmation to customer
  if (newStatus === 'completed') {
    const customer = await getCustomer(refund.data.customer_id);

    await whatsappService.sendMessage(customer.phone_number, {
      type: 'text',
      text: `✅ Refund Completed!

Amount: $${refund.data.refund_amount}
Refund ID: #${refund.data.id.slice(0, 8).toUpperCase()}

The refund has been processed and should appear in your account within 5-7 business days.

Thank you!`
    });
  }
}
```

---

## 6. Customer Communication

### 6.1 Refund Confirmation Message

```
✅ *Refund Request Received*

Refund Amount: *$50.00*
Payment Date: Nov 27, 2025
Reason: Duplicate payment

Your refund request has been received and is being processed.

*Expected Timeline:*
- Approval: Within 24 hours
- Processing: 5-7 business days
- Funds in account: 5-7 business days

Refund Reference: #RFD-20251127-001

You'll receive a confirmation when the refund is complete.

Questions? Reply HELP
```

---

### 6.2 Refund Completion Message

```
✅ *Refund Completed!*

Amount: *$50.00*
Refund ID: #RFD-20251127-001
Processed: Nov 27, 2025

The refund has been successfully processed and should appear in your EcoCash account within 5-7 business days.

Thank you for your patience! 💚

Questions? Reply HELP or call +263771234567
```

---

## 7. Implementation

### 7.1 Database Schema

```sql
-- Refunds table
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  payment_id UUID NOT NULL REFERENCES payments(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),

  -- Refund details
  refund_amount DECIMAL(10,2) NOT NULL,
  refund_reason VARCHAR(50) NOT NULL,
  refund_type VARCHAR(20) NOT NULL,  -- 'full', 'partial'

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',

  -- Approval
  requested_by VARCHAR(255) NOT NULL,  -- customer_id or admin_user_id
  customer_comment TEXT,
  internal_notes TEXT,

  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approver_comments TEXT,

  -- Gateway integration
  gateway_refund_id VARCHAR(255),
  gateway_status VARCHAR(50),

  -- Timestamps
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (refund_amount > 0),
  CHECK (status IN ('pending_approval', 'approved', 'processing', 'completed', 'failed', 'rejected'))
);

-- Indexes
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_customer_id ON refunds(customer_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);
```

---

### 7.2 API Endpoints

#### POST `/api/refunds`

**Description**: Initiate a refund request

**Request**:
```json
{
  "payment_id": "660e8400-e29b-41d4-a716-446655440001",
  "refund_amount": 50.00,
  "refund_reason": "duplicate_payment",
  "refund_type": "full",
  "customer_comment": "I was charged twice by mistake"
}
```

**Response**:
```json
{
  "refund_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "pending_approval",
  "refund_amount": 50.00,
  "requires_approval": true,
  "estimated_completion": "2025-12-04T00:00:00Z",
  "message": "Refund request received. Approval required."
}
```

---

#### POST `/api/refunds/:refund_id/approve`

**Description**: Approve or reject a refund (Admin only)

**Request**:
```json
{
  "decision": "approved",
  "comments": "Verified duplicate payment. Approved for refund."
}
```

**Response**:
```json
{
  "refund_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "approved",
  "approved_by": "admin-123",
  "approved_at": "2025-11-27T11:00:00Z",
  "processing_initiated": true
}
```

---

#### GET `/api/refunds/:refund_id`

**Description**: Get refund status

**Response**:
```json
{
  "refund_id": "770e8400-e29b-41d4-a716-446655440002",
  "payment_id": "660e8400-e29b-41d4-a716-446655440001",
  "refund_amount": 50.00,
  "refund_reason": "duplicate_payment",
  "status": "completed",
  "requested_at": "2025-11-27T10:00:00Z",
  "approved_at": "2025-11-27T11:00:00Z",
  "completed_at": "2025-11-27T11:30:00Z"
}
```

---

## Summary

**Refund Processing Deliverables**:
- ✅ **Refund Workflow**: Initiation → Validation → Approval → Processing → Confirmation
- ✅ **Approval Hierarchy**: Amount and reason-based approval routing
- ✅ **Gateway Integration**: payment gateway refund API integration
- ✅ **Status Tracking**: Real-time refund status updates
- ✅ **Customer Communication**: Clear notifications at each stage
- ✅ **Audit Trail**: Complete logging of all refund decisions

**Key Features**:
- Automatic refunds for duplicates < $50
- Dual approval for refunds > $200
- 5-7 business day processing timeline
- WhatsApp notifications

**Next Steps**:
1. Implement refund workflow
2. Build approval UI in admin dashboard
3. Integrate with payment gateway refund API
4. Proceed to P1-T026 (Payment Security & Fraud Prevention)

---

**References**:
- Payment Gateway Integration: payment-gateway-integration.md
- Payment Reconciliation: payment-reconciliation.md
