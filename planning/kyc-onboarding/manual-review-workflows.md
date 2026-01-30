# Manual Review Workflows

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T044
**Priority**: High
**Estimated Duration**: 6 hours

---

## 1. Overview

This specification defines manual review workflows for operations that require human judgment, oversight, or cannot be fully automated. Manual reviews ensure quality control, fraud prevention, compliance, and appropriate handling of edge cases while maintaining operational efficiency through well-designed queues, routing, and SLA tracking.

**Key Objectives**:
- Enable efficient human-in-the-loop decision making
- Maintain quality control and fraud prevention
- Ensure regulatory compliance
- Track and enforce Service Level Agreements (SLAs)
- Support escalation and approval hierarchies
- Provide audit trails for all manual decisions

**Review Types**:
1. **KYC Manual Verification** - Identity document verification
2. **Credit Decision Overrides** - Loan approval exceptions
3. **Payment Dispute Resolution** - Payment reconciliation issues
4. **Device Repossession Approvals** - Legal and operational approval
5. **Fraud Investigation** - Suspicious activity review
6. **Customer Appeals** - Rejected application appeals

---

## 2. Core Workflow Architecture

### 2.1 Review Queue System

```typescript
interface ReviewQueue<T> {
  queueId: string;
  queueType: ReviewType;
  displayName: string;
  description: string;

  // Queue configuration
  config: {
    autoAssignment: boolean;
    roundRobinAssignment: boolean;
    priorityBased: boolean;
    sla: {
      responseTime: number; // minutes
      resolutionTime: number; // minutes
      escalationTime: number; // minutes
    };
    maxConcurrentPerReviewer: number;
  };

  // Queue statistics
  stats: {
    totalItems: number;
    pendingItems: number;
    inProgressItems: number;
    completedToday: number;
    breachedSLA: number;
    averageResolutionTime: number;
    oldestItem: string; // ISO timestamp
  };

  // Queue items
  items: ReviewItem<T>[];
}

interface ReviewItem<T> {
  id: string;
  queueType: ReviewType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: ReviewStatus;

  // Subject of review
  resourceType: string; // 'kyc_submission', 'loan_application', etc.
  resourceId: string;
  resourceData: T;

  // Assignment
  assignedTo?: string; // Admin user ID
  assignedAt?: string;
  claimedAt?: string;

  // Timing
  createdAt: string;
  dueAt: string;
  completedAt?: string;
  slaBreached: boolean;

  // Review details
  reviewNotes?: string;
  decision?: ReviewDecision;
  decisionReason?: string;
  attachments?: string[];

  // Audit
  reviewedBy?: string;
  reviewHistory: ReviewHistoryEntry[];

  // Escalation
  escalated: boolean;
  escalatedTo?: string;
  escalationReason?: string;
}

type ReviewType =
  | 'kyc_verification'
  | 'credit_override'
  | 'payment_dispute'
  | 'device_repossession'
  | 'fraud_investigation'
  | 'customer_appeal';

type ReviewStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'escalated'
  | 'on_hold';

type ReviewDecision =
  | 'approved'
  | 'rejected'
  | 'requires_more_info'
  | 'escalated'
  | 'transferred';

interface ReviewHistoryEntry {
  timestamp: string;
  adminUserId: string;
  adminName: string;
  action: string;
  oldStatus: ReviewStatus;
  newStatus: ReviewStatus;
  notes?: string;
}
```

---

## 3. KYC Manual Verification Workflow

### 3.1 KYC Review Queue

**Trigger Conditions**:
- Smile Identity confidence score < 85%
- Document quality issues
- ID/selfie mismatch
- Suspicious patterns detected
- Customer flagged for enhanced due diligence

**Data Schema**:

```typescript
interface KYCReviewItem extends ReviewItem<KYCSubmission> {
  resourceType: 'kyc_submission';
  resourceData: {
    customerId: string;
    customerName: string;
    phoneNumber: string;
    submissionDate: string;

    // Identity documents
    nationalId: {
      idNumber: string;
      documentImage: string;
      detectedData: {
        name: string;
        dateOfBirth: string;
        idNumber: string;
        address: string;
      };
      qualityScore: number;
      tamperingDetected: boolean;
    };

    // Selfie verification
    selfie: {
      image: string;
      livenessScore: number;
      faceMatchScore: number;
      qualityScore: number;
    };

    // Smile Identity results
    smileIdentity: {
      confidenceScore: number;
      verificationStatus: string;
      flags: string[];
      raw Response: any;
    };

    // Additional data
    location: string;
    deviceInfo: any;
    previousAttempts: number;
    riskIndicators: string[];
  };
}
```

### 3.2 KYC Review UI Component

```typescript
// components/review/KYCReviewCard.tsx
interface KYCReviewCardProps {
  reviewItem: KYCReviewItem;
  onApprove: (notes: string) => Promise<void>;
  onReject: (reason: string, notes: string) => Promise<void>;
  onRequestMoreInfo: (fields: string[], message: string) => Promise<void>;
  onEscalate: (reason: string) => Promise<void>;
}

function KYCReviewCard({ reviewItem, onApprove, onReject, ... }: KYCReviewCardProps) {
  return (
    <Card>
      {/* Customer info */}
      <CustomerSummary customer={reviewItem.resourceData} />

      {/* Document viewer with zoom and quality indicators */}
      <DocumentViewer
        idDocument={reviewItem.resourceData.nationalId.documentImage}
        selfie={reviewItem.resourceData.selfie.image}
        qualityScores={{
          idQuality: reviewItem.resourceData.nationalId.qualityScore,
          selfieQuality: reviewItem.resourceData.selfie.qualityScore,
          faceMatch: reviewItem.resourceData.selfie.faceMatchScore
        }}
      />

      {/* Smile Identity results */}
      <VerificationResults results={reviewItem.resourceData.smileIdentity} />

      {/* Risk indicators */}
      {reviewItem.resourceData.riskIndicators.length > 0 && (
        <RiskIndicators indicators={reviewItem.resourceData.riskIndicators} />
      )}

      {/* Decision checklist */}
      <ReviewChecklist
        items={[
          'ID document is clear and legible',
          'Photo matches selfie',
          'ID number format is valid',
          'Document shows no signs of tampering',
          'Liveness detection passed',
          'Customer details are consistent'
        ]}
      />

      {/* Action buttons */}
      <ReviewActions
        onApprove={onApprove}
        onReject={onReject}
        onRequestMoreInfo={onRequestMoreInfo}
        onEscalate={onEscalate}
      />

      {/* Previous review history */}
      <ReviewHistory history={reviewItem.reviewHistory} />
    </Card>
  );
}
```

### 3.3 KYC Review Decision Logic

```typescript
// lib/workflows/kyc-review.ts
async function processKYCDecision(
  reviewItemId: string,
  decision: ReviewDecision,
  data: {
    notes?: string;
    reason?: string;
    requestedFields?: string[];
    escalationReason?: string;
  }
) {
  const supabase = createServerClient();

  // Get review item
  const { data: reviewItem } = await supabase
    .from('review_queue')
    .select('*')
    .eq('id', reviewItemId)
    .single();

  // Get admin user
  const { data: { user } } = await supabase.auth.getUser();

  switch (decision) {
    case 'approved':
      // Update KYC submission status
      await supabase
        .from('kyc_submissions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: data.notes
        })
        .eq('id', reviewItem.resource_id);

      // Update customer status
      await supabase
        .from('customers')
        .update({
          kyc_status: 'approved',
          kyc_approved_at: new Date().toISOString()
        })
        .eq('id', reviewItem.resourceData.customerId);

      // Send approval notification
      await sendKYCApprovalNotification(reviewItem.resourceData.customerId);

      // Trigger credit scoring
      await triggerCreditScoring(reviewItem.resourceData.customerId);

      break;

    case 'rejected':
      // Update KYC submission
      await supabase
        .from('kyc_submissions')
        .update({
          status: 'rejected',
          rejection_reason: data.reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: data.notes
        })
        .eq('id', reviewItem.resource_id);

      // Update customer status
      await supabase
        .from('customers')
        .update({ kyc_status: 'rejected' })
        .eq('id', reviewItem.resourceData.customerId);

      // Send rejection notification
      await sendKYCRejectionNotification(
        reviewItem.resourceData.customerId,
        data.reason
      );

      break;

    case 'requires_more_info':
      // Update submission status
      await supabase
        .from('kyc_submissions')
        .update({
          status: 'resubmission_required',
          requested_fields: data.requestedFields,
          resubmission_message: data.notes
        })
        .eq('id', reviewItem.resource_id);

      // Send resubmission request
      await sendKYCResubmissionRequest(
        reviewItem.resourceData.customerId,
        data.requestedFields,
        data.notes
      );

      break;

    case 'escalated':
      // Create escalation
      await supabase.from('escalations').insert({
        review_item_id: reviewItemId,
        escalated_by: user.id,
        escalation_reason: data.escalationReason,
        escalated_to_role: 'operations_manager'
      });

      // Update review item status
      await supabase
        .from('review_queue')
        .update({
          status: 'escalated',
          escalated: true,
          escalation_reason: data.escalationReason
        })
        .eq('id', reviewItemId);

      // Notify manager
      await notifyEscalation(reviewItemId, 'operations_manager');

      break;
  }

  // Mark review item as completed
  await supabase
    .from('review_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      reviewed_by: user.id,
      decision: decision,
      decision_reason: data.reason,
      review_notes: data.notes
    })
    .eq('id', reviewItemId);

  // Log audit trail
  await logAdminAction({
    action: 'kyc:review_decision',
    resourceType: 'kyc_submission',
    resourceId: reviewItem.resource_id,
    status: 'success',
    metadata: {
      decision,
      reviewItemId,
      ...data
    }
  });
}
```

### 3.4 KYC Review SLA Configuration

```typescript
const KYC_REVIEW_SLA = {
  responseTime: 60, // 1 hour to claim/assign
  resolutionTime: 4 * 60, // 4 hours to complete
  escalationTime: 8 * 60, // 8 hours before auto-escalation
  priorityMultipliers: {
    low: 1,
    medium: 0.75,
    high: 0.5,
    urgent: 0.25
  }
};
```

---

## 4. Credit Decision Override Workflow

### 4.1 Credit Override Request

**Trigger Conditions**:
- Automated credit scoring rejects application
- Customer requests higher limit than eligible
- Exceptional circumstances (repeat customer, referral, etc.)
- Credit score borderline (near threshold)

**Data Schema**:

```typescript
interface CreditOverrideReviewItem extends ReviewItem<CreditOverrideRequest> {
  resourceType: 'credit_override_request';
  resourceData: {
    customerId: string;
    customerName: string;
    phoneNumber: string;
    loanApplicationId: string;

    // Original credit decision
    originalDecision: {
      decision: 'approved' | 'rejected';
      creditScore: number;
      approvedAmount: number;
      approvedTier: string;
      rejectionReasons: string[];
    };

    // Override request
    requestedOverride: {
      requestedAmount: number;
      requestedTier: string;
      justification: string;
      requestedBy: string;
      supportingDocuments: string[];
    };

    // Customer data
    customerProfile: {
      age: number;
      occupation: string;
      location: string;
      registrationDate: string;
      previousLoans: number;
      repaymentHistory: {
        onTimePayments: number;
        latePayments: number;
        missedPayments: number;
        averageDaysLate: number;
      };
    };

    // Risk assessment
    riskFactors: Array<{
      factor: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }>;

    // Financial indicators
    financialIndicators: {
      estimatedIncome: number;
      debtToIncomeRatio: number;
      mobileMoneyActivity: string; // 'low' | 'medium' | 'high'
    };
  };
}
```

### 4.2 Credit Override Decision Process

```typescript
async function processCreditOverride(
  reviewItemId: string,
  decision: 'approve_override' | 'deny_override' | 'modify_terms',
  data: {
    approvedAmount?: number;
    approvedTier?: string;
    modifiedTerms?: {
      amount: number;
      tier: string;
      interestRate?: number;
      term?: number;
      downPayment?: number;
    };
    justification: string;
    conditions?: string[];
  }
) {
  const supabase = createServerClient();

  // Get review item
  const { data: reviewItem } = await supabase
    .from('review_queue')
    .select('*')
    .eq('id', reviewItemId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  switch (decision) {
    case 'approve_override':
      // Update loan application with override
      await supabase
        .from('loan_applications')
        .update({
          status: 'approved',
          approved_amount: data.approvedAmount,
          approved_tier: data.approvedTier,
          approval_type: 'manual_override',
          approved_by: user.id,
          approval_notes: data.justification,
          override_conditions: data.conditions,
          approved_at: new Date().toISOString()
        })
        .eq('id', reviewItem.resourceData.loanApplicationId);

      // Create override record
      await supabase.from('credit_overrides').insert({
        loan_application_id: reviewItem.resourceData.loanApplicationId,
        customer_id: reviewItem.resourceData.customerId,
        original_decision: reviewItem.resourceData.originalDecision.decision,
        original_amount: reviewItem.resourceData.originalDecision.approvedAmount,
        override_amount: data.approvedAmount,
        override_tier: data.approvedTier,
        override_by: user.id,
        justification: data.justification,
        conditions: data.conditions
      });

      // Notify customer of approval
      await sendLoanApprovalNotification(
        reviewItem.resourceData.customerId,
        data.approvedAmount,
        data.approvedTier
      );

      break;

    case 'deny_override':
      // Update loan application
      await supabase
        .from('loan_applications')
        .update({
          status: 'rejected',
          rejection_reason: 'Override request denied',
          rejected_by: user.id,
          rejection_notes: data.justification,
          rejected_at: new Date().toISOString()
        })
        .eq('id', reviewItem.resourceData.loanApplicationId);

      // Notify customer
      await sendLoanRejectionNotification(
        reviewItem.resourceData.customerId,
        data.justification
      );

      break;

    case 'modify_terms':
      // Approve with modified terms
      await supabase
        .from('loan_applications')
        .update({
          status: 'approved_with_conditions',
          approved_amount: data.modifiedTerms.amount,
          approved_tier: data.modifiedTerms.tier,
          interest_rate: data.modifiedTerms.interestRate,
          loan_term: data.modifiedTerms.term,
          down_payment_required: data.modifiedTerms.downPayment,
          approval_type: 'manual_override_modified',
          approved_by: user.id,
          approval_notes: data.justification,
          approved_at: new Date().toISOString()
        })
        .eq('id', reviewItem.resourceData.loanApplicationId);

      // Notify customer with modified terms
      await sendModifiedTermsNotification(
        reviewItem.resourceData.customerId,
        data.modifiedTerms
      );

      break;
  }

  // Complete review
  await completeReviewItem(reviewItemId, decision, data.justification);

  // Audit log
  await logAdminAction({
    action: 'credit:override_decision',
    resourceType: 'loan_application',
    resourceId: reviewItem.resourceData.loanApplicationId,
    status: 'success',
    metadata: { decision, ...data }
  });
}
```

### 4.3 Credit Override Approval Limits

```typescript
// Different roles have different override limits
const OVERRIDE_APPROVAL_LIMITS = {
  operations_manager: {
    maxAmount: 350, // USD
    maxOverridePercentage: 20, // % above recommended amount
    requiresSecondApproval: false
  },
  finance_team: {
    maxAmount: 500,
    maxOverridePercentage: 30,
    requiresSecondApproval: false
  },
  super_admin: {
    maxAmount: Infinity,
    maxOverridePercentage: Infinity,
    requiresSecondApproval: false
  }
};

// Dual approval requirement for high-value overrides
function requiresDualApproval(overrideAmount: number, increase: number): boolean {
  return overrideAmount > 500 || increase > 50;
}
```

---

## 5. Payment Dispute Resolution Workflow

### 5.1 Payment Dispute Queue

**Trigger Conditions**:
- Payment reconciliation mismatch
- Customer reports payment not reflected
- Duplicate payment detected
- Gateway callback failure
- Amount discrepancy

**Data Schema**:

```typescript
interface PaymentDisputeReviewItem extends ReviewItem<PaymentDispute> {
  resourceType: 'payment_dispute';
  resourceData: {
    disputeId: string;
    customerId: string;
    customerName: string;
    loanId: string;

    // Dispute details
    dispute: {
      type: 'payment_not_reflected' | 'wrong_amount' | 'duplicate_payment' | 'unauthorized_payment';
      claimAmount: number;
      customerStatement: string;
      reportedDate: string;
      supportingDocuments: string[];
    };

    // Transaction details
    transactions: Array<{
      transactionId: string;
      gateway: string;
      amount: number;
      timestamp: string;
      status: string;
      reference: string;
      reconciled: boolean;
      gatewayResponse: any;
    }>;

    // Loan details
    loan: {
      currentBalance: number;
      expectedPayment: number;
      lastPaymentDate: string;
      lastPaymentAmount: number;
      paymentHistory: Array<{
        date: string;
        amount: number;
        gateway: string;
      }>;
    };

    // Gateway verification
    gatewayVerification: {
      gateway: string;
      verificationStatus: 'pending' | 'verified' | 'failed';
      gatewayBalance: number;
      systemBalance: number;
      difference: number;
    };

    // Previous disputes
    previousDisputes: number;
    resolutionHistory: Array<{
      date: string;
      type: string;
      resolution: string;
    }>;
  };
}
```

### 5.2 Payment Dispute Resolution Process

```typescript
async function resolvePaymentDispute(
  reviewItemId: string,
  resolution: 'customer_correct' | 'system_correct' | 'partial_adjustment' | 'escalate_to_gateway',
  data: {
    adjustmentAmount?: number;
    creditCustomer?: boolean;
    refundAmount?: number;
    notes: string;
    actionsTaken: string[];
  }
) {
  const supabase = createServerClient();

  // Get dispute details
  const { data: reviewItem } = await supabase
    .from('review_queue')
    .select('*')
    .eq('id', reviewItemId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  switch (resolution) {
    case 'customer_correct':
      // Customer was right, apply credit
      await supabase
        .from('payments')
        .insert({
          loan_id: reviewItem.resourceData.loanId,
          customer_id: reviewItem.resourceData.customerId,
          amount: data.adjustmentAmount,
          type: 'manual_adjustment',
          reason: 'dispute_resolution',
          created_by: user.id,
          notes: data.notes
        });

      // Update loan balance
      await supabase.rpc('apply_payment', {
        p_loan_id: reviewItem.resourceData.loanId,
        p_amount: data.adjustmentAmount
      });

      // Notify customer
      await sendDisputeResolvedNotification(
        reviewItem.resourceData.customerId,
        'resolved_in_your_favor',
        data.adjustmentAmount
      );

      break;

    case 'system_correct':
      // System was correct, no adjustment needed
      // Explain to customer
      await sendDisputeResolvedNotification(
        reviewItem.resourceData.customerId,
        'no_adjustment_needed',
        0,
        data.notes
      );

      break;

    case 'partial_adjustment':
      // Partial credit/refund
      if (data.creditCustomer) {
        await applyPaymentCredit(
          reviewItem.resourceData.loanId,
          data.adjustmentAmount,
          'partial_dispute_resolution',
          data.notes
        );
      }

      if (data.refundAmount > 0) {
        await initiateRefund(
          reviewItem.resourceData.customerId,
          data.refundAmount,
          'dispute_resolution',
          data.notes
        );
      }

      await sendDisputeResolvedNotification(
        reviewItem.resourceData.customerId,
        'partial_resolution',
        data.adjustmentAmount || data.refundAmount,
        data.notes
      );

      break;

    case 'escalate_to_gateway':
      // Create gateway investigation ticket
      await supabase.from('gateway_investigations').insert({
        dispute_id: reviewItem.resourceData.disputeId,
        gateway: reviewItem.resourceData.gatewayVerification.gateway,
        investigation_type: 'payment_reconciliation',
        created_by: user.id,
        notes: data.notes
      });

      // Update review status
      await supabase
        .from('review_queue')
        .update({
          status: 'on_hold',
          hold_reason: 'escalated_to_gateway'
        })
        .eq('id', reviewItemId);

      // Notify customer of investigation
      await sendDisputeUnderInvestigationNotification(
        reviewItem.resourceData.customerId
      );

      return; // Don't complete review yet
  }

  // Update dispute record
  await supabase
    .from('payment_disputes')
    .update({
      status: 'resolved',
      resolution: resolution,
      resolution_notes: data.notes,
      resolved_by: user.id,
      resolved_at: new Date().toISOString()
    })
    .eq('id', reviewItem.resourceData.disputeId);

  // Complete review
  await completeReviewItem(reviewItemId, resolution, data.notes);

  // Audit log
  await logAdminAction({
    action: 'payment:dispute_resolution',
    resourceType: 'payment_dispute',
    resourceId: reviewItem.resourceData.disputeId,
    status: 'success',
    metadata: { resolution, ...data }
  });
}
```

---

## 6. Device Repossession Approval Workflow

### 6.1 Repossession Request Queue

**Trigger Conditions**:
- Loan 90+ days past due
- No response to collection attempts
- Device locked for 30+ days with no payment
- Legal requirement satisfied

**Data Schema**:

```typescript
interface RepossessionReviewItem extends ReviewItem<RepossessionRequest> {
  resourceType: 'repossession_request';
  resourceData: {
    customerId: string;
    customerName: string;
    phoneNumber: string;
    loanId: string;
    deviceId: string;

    // Loan status
    loan: {
      principalAmount: number;
      outstandingBalance: number;
      daysPastDue: number;
      missedPayments: number;
      lastPaymentDate: string;
      lastPaymentAmount: number;
    };

    // Device details
    device: {
      imei: string;
      model: string;
      brand: string;
      procurementCost: number;
      currentValue: number;
      lockStatus: 'locked' | 'unlocked';
      lockDate: string;
      daysLocked: number;
    };

    // Collection history
    collectionAttempts: Array<{
      date: string;
      method: 'whatsapp' | 'sms' | 'call';
      result: string;
      notes: string;
    }>;

    // Legal compliance
    legalChecklist: {
      gracePeriodExpired: boolean;
      notificationsSent: number;
      requiredNoticesPeriod: number; // days
      legalRequirementsMet: boolean;
      jurisdictionNotes: string;
    };

    // Customer circumstances
    customerNotes: string;
    hardshipClaimed: boolean;
    hardshipDetails?: string;

    // Repossession logistics
    logistics: {
      customerLocation: string;
      distributorAssignment: string;
      estimatedCost: number;
      proposedDate: string;
    };
  };
}
```

### 6.2 Repossession Decision Process

```typescript
async function processRepossessionDecision(
  reviewItemId: string,
  decision: 'approve' | 'deny' | 'defer' | 'offer_settlement',
  data: {
    notes: string;
    deferralDays?: number;
    settlementOffer?: {
      amount: number;
      deadline: string;
    };
    repossessionDate?: string;
    assignedDistributor?: string;
  }
) {
  const supabase = createServerClient();

  const { data: reviewItem } = await supabase
    .from('review_queue')
    .select('*')
    .eq('id', reviewItemId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  switch (decision) {
    case 'approve':
      // Approve repossession
      await supabase
        .from('device_repossessions')
        .insert({
          loan_id: reviewItem.resourceData.loanId,
          device_id: reviewItem.resourceData.deviceId,
          customer_id: reviewItem.resourceData.customerId,
          status: 'approved',
          scheduled_date: data.repossessionDate,
          assigned_distributor: data.assignedDistributor,
          approved_by: user.id,
          approval_notes: data.notes,
          approved_at: new Date().toISOString()
        });

      // Update loan status
      await supabase
        .from('loans')
        .update({
          status: 'repossession_approved',
          repossession_approved_at: new Date().toISOString()
        })
        .eq('id', reviewItem.resourceData.loanId);

      // Notify distributor
      await notifyDistributorOfRepossession(
        data.assignedDistributor,
        reviewItem.resourceData
      );

      // Send final notice to customer
      await sendRepossessionNotice(
        reviewItem.resourceData.customerId,
        data.repossessionDate
      );

      break;

    case 'deny':
      // Deny repossession, continue collections
      await supabase
        .from('loans')
        .update({
          repossession_denied: true,
          repossession_denial_reason: data.notes,
          status: 'collections'
        })
        .eq('id', reviewItem.resourceData.loanId);

      // Assign to collections team
      await assignToCollections(reviewItem.resourceData.loanId);

      break;

    case 'defer':
      // Defer decision, give customer more time
      const newReviewDate = new Date();
      newReviewDate.setDate(newReviewDate.getDate() + data.deferralDays);

      await supabase
        .from('review_queue')
        .update({
          status: 'pending',
          due_at: newReviewDate.toISOString(),
          assigned_to: null
        })
        .eq('id', reviewItemId);

      // Notify customer of extension
      await sendPaymentExtensionNotification(
        reviewItem.resourceData.customerId,
        data.deferralDays
      );

      return; // Don't complete review

    case 'offer_settlement':
      // Offer settlement to customer
      await supabase.from('settlement_offers').insert({
        loan_id: reviewItem.resourceData.loanId,
        customer_id: reviewItem.resourceData.customerId,
        settlement_amount: data.settlementOffer.amount,
        deadline: data.settlementOffer.deadline,
        created_by: user.id,
        notes: data.notes
      });

      // Update review to wait for customer response
      await supabase
        .from('review_queue')
        .update({
          status: 'on_hold',
          hold_reason: 'awaiting_settlement_response'
        })
        .eq('id', reviewItemId);

      // Send settlement offer to customer
      await sendSettlementOffer(
        reviewItem.resourceData.customerId,
        data.settlementOffer.amount,
        data.settlementOffer.deadline
      );

      return; // Don't complete review yet
  }

  // Complete review
  await completeReviewItem(reviewItemId, decision, data.notes);

  // Audit log
  await logAdminAction({
    action: 'device:repossession_decision',
    resourceType: 'repossession_request',
    resourceId: reviewItem.resourceData.loanId,
    status: 'success',
    metadata: { decision, ...data }
  });
}
```

---

## 7. Review Queue Management

### 7.1 Queue Assignment Logic

```typescript
// Auto-assignment to reviewers based on workload and specialization
async function assignReviewItem(reviewItemId: string) {
  const supabase = createServerClient();

  // Get review item
  const { data: item } = await supabase
    .from('review_queue')
    .select('*')
    .eq('id', reviewItemId)
    .single();

  // Find eligible reviewers for this queue type
  const { data: eligibleReviewers } = await supabase
    .from('admin_users')
    .select('id, full_name')
    .eq('status', 'active')
    .in('role', QUEUE_ROLE_MAPPING[item.queue_type]);

  // Get current workload for each reviewer
  const workloads = await Promise.all(
    eligibleReviewers.map(async (reviewer) => {
      const { count } = await supabase
        .from('review_queue')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', reviewer.id)
        .eq('status', 'in_progress');

      return { reviewerId: reviewer.id, currentLoad: count };
    })
  );

  // Assign to reviewer with lowest workload
  const assignTo = workloads.reduce((min, curr) =>
    curr.currentLoad < min.currentLoad ? curr : min
  );

  // Update assignment
  await supabase
    .from('review_queue')
    .update({
      assigned_to: assignTo.reviewerId,
      assigned_at: new Date().toISOString(),
      status: 'assigned'
    })
    .eq('id', reviewItemId);

  // Notify assigned reviewer
  await notifyReviewerAssignment(assignTo.reviewerId, reviewItemId);
}

const QUEUE_ROLE_MAPPING = {
  kyc_verification: ['kyc_reviewer', 'operations_manager', 'super_admin'],
  credit_override: ['operations_manager', 'finance_team', 'super_admin'],
  payment_dispute: ['finance_team', 'super_admin'],
  device_repossession: ['operations_manager', 'super_admin'],
  fraud_investigation: ['operations_manager', 'super_admin'],
  customer_appeal: ['customer_support', 'operations_manager', 'super_admin']
};
```

### 7.2 SLA Monitoring and Escalation

```typescript
// Monitor SLA breaches and auto-escalate
async function monitorSLAs() {
  const supabase = createServerClient();

  // Get all active review items
  const { data: items } = await supabase
    .from('review_queue')
    .select('*')
    .in('status', ['pending', 'assigned', 'in_progress']);

  const now = new Date();

  for (const item of items) {
    const dueDate = new Date(item.due_at);
    const hoursOverdue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);

    // Check if SLA breached
    if (hoursOverdue > 0 && !item.sla_breached) {
      // Mark as breached
      await supabase
        .from('review_queue')
        .update({ sla_breached: true })
        .eq('id', item.id);

      // Send alert
      await sendSLABreachAlert(item);
    }

    // Auto-escalate if severely overdue
    const escalationThreshold = getEscalationThreshold(item.queue_type);
    if (hoursOverdue > escalationThreshold && !item.escalated) {
      await autoEscalateReview(item.id, 'SLA breach - auto escalation');
    }
  }
}

function getEscalationThreshold(queueType: ReviewType): number {
  const thresholds = {
    kyc_verification: 8, // 8 hours
    credit_override: 4,
    payment_dispute: 24,
    device_repossession: 48,
    fraud_investigation: 2,
    customer_appeal: 24
  };
  return thresholds[queueType] || 24;
}
```

---

## 8. Review Analytics Dashboard

```typescript
interface ReviewAnalytics {
  period: { startDate: string; endDate: string };

  overall: {
    totalReviews: number;
    completedReviews: number;
    pendingReviews: number;
    averageResolutionTime: number;
    slaComplianceRate: number;
  };

  byQueueType: Array<{
    queueType: ReviewType;
    totalReviews: number;
    completedReviews: number;
    averageResolutionTime: number;
    slaBreaches: number;
    backlogCount: number;
  }>;

  byReviewer: Array<{
    reviewerId: string;
    reviewerName: string;
    reviewsCompleted: number;
    averageResolutionTime: number;
    slaComplianceRate: number;
    approvalRate: number;
    qualityScore: number; // Based on decision accuracy
  }>;

  decisions: {
    approved: number;
    rejected: number;
    escalated: number;
    requiresMoreInfo: number;
  };

  trends: {
    dailyVolume: TimeSeriesData[];
    resolutionTimes: TimeSeriesData[];
    backlogTrend: TimeSeriesData[];
  };
}
```

---

## 9. Implementation Checklist

- [ ] Create review_queue table with proper indexes
- [ ] Create queue-specific data tables (kyc_reviews, credit_overrides, etc.)
- [ ] Implement review item creation triggers
- [ ] Build auto-assignment logic
- [ ] Create review UI components for each queue type
- [ ] Implement decision processing functions
- [ ] Build SLA monitoring system
- [ ] Create escalation workflows
- [ ] Implement reviewer notifications
- [ ] Build review analytics dashboard
- [ ] Add review history tracking
- [ ] Create audit logging for all decisions
- [ ] Implement permission checks for reviewers
- [ ] Build review workload balancing
- [ ] Add review quality scoring
- [ ] Create review templates and checklists
- [ ] Implement bulk review actions
- [ ] Add review search and filtering
- [ ] Write integration tests for workflows

---

**Document Status**: Complete
**Last Updated**: November 27, 2025
**Next Review**: Phase 2 Planning
