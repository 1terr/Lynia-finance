# Reporting Requirements

**Epic**: Phase 1: Core Architecture & Platform Foundation
**Section**: 1.8 Admin Dashboard Design
**Task ID**: P1-T043
**Priority**: Medium
**Estimated Duration**: 6 hours

---

## 1. Overview

This specification defines all reporting requirements for the Lynia Finance Admin Dashboard. Reports provide business intelligence, operational insights, and financial data necessary for managing the device financing platform, making data-driven decisions, and meeting regulatory compliance requirements.

**Key Objectives**:
- Provide comprehensive business intelligence
- Enable data-driven decision making
- Support regulatory compliance and auditing
- Track key performance indicators (KPIs)
- Monitor portfolio health and risk
- Facilitate financial reconciliation

**Report Categories**:
1. **Executive Dashboard** - High-level KPIs
2. **Loan Portfolio Reports** - Portfolio health and performance
3. **Payment & Collections** - Payment tracking and collections
4. **Customer Analytics** - Customer behavior and demographics
5. **Device Inventory** - Device stock and lifecycle
6. **Financial Reports** - P&L, cash flow, reconciliation
7. **Operational Reports** - KYC, handovers, support tickets
8. **Risk & Compliance** - Delinquency, fraud, audit trails

---

## 2. Executive Dashboard Reports

### 2.1 Real-Time KPI Dashboard

**Purpose**: High-level platform health metrics for executives and managers

**Metrics**:

```typescript
interface ExecutiveDashboardMetrics {
  // Portfolio Overview
  totalLoans: {
    count: number;
    value: number;
    growth_percentage: number; // vs. last period
  };

  activeLoans: {
    count: number;
    value: number;
    average_ticket_size: number;
  };

  // Financial Health
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number; // percentage

  // Risk Metrics
  portfolioAtRisk: {
    par_0_30: number; // 0-30 days overdue
    par_31_60: number;
    par_61_90: number;
    par_90_plus: number;
  };

  // Customer Metrics
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeCustomers: number;
  customerRetentionRate: number;

  // Operational Metrics
  pendingKYC: number;
  pendingApprovals: number;
  devicesInStock: number;
  pendingHandovers: number;

  // Trends (7-day, 30-day)
  trends: {
    disbursements: TimeSeriesData[];
    collections: TimeSeriesData[];
    newCustomers: TimeSeriesData[];
    activations: TimeSeriesData[];
  };
}

interface TimeSeriesData {
  date: string; // ISO date
  value: number;
}
```

**Refresh Rate**: Real-time (updated every 5 minutes)

**Visualizations**:
- KPI cards with trend indicators
- Line charts for trends
- Donut charts for portfolio composition
- Bar charts for PAR (Portfolio at Risk)

---

## 3. Loan Portfolio Reports

### 3.1 Portfolio Performance Report

**Purpose**: Comprehensive view of loan portfolio health and performance

**Data Schema**:

```typescript
interface PortfolioPerformanceReport {
  reportDate: string;
  reportPeriod: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  // Portfolio Composition
  composition: {
    byStatus: Record<LoanStatus, { count: number; value: number }>;
    byTier: Record<LoanTier, { count: number; value: number }>;
    byDevice: Record<string, { count: number; value: number }>;
    byAge: {
      '0-30days': { count: number; value: number };
      '31-60days': { count: number; value: number };
      '61-90days': { count: number; value: number };
      '90+days': { count: number; value: number };
    };
  };

  // Performance Metrics
  performance: {
    totalDisbursed: number;
    totalRepaid: number;
    totalOutstanding: number;
    expectedCollections: number;
    actualCollections: number;
    collectionEfficiency: number; // actual / expected
  };

  // Quality Metrics
  quality: {
    approvalRate: number;
    defaultRate: number;
    writeOffRate: number;
    averageLoanTerm: number;
    averageRepaymentPeriod: number;
  };

  // Risk Metrics
  risk: {
    par30: number; // Portfolio at risk (30+ days overdue)
    par60: number;
    par90: number;
    lossRatio: number; // write-offs / disbursements
    provisionCoverage: number;
  };

  // Growth Metrics
  growth: {
    newLoansCount: number;
    newLoansValue: number;
    closedLoansCount: number;
    closedLoansValue: number;
    netPortfolioGrowth: number;
  };
}

type LoanStatus = 'pending' | 'approved' | 'disbursed' | 'active' | 'paid_off' | 'defaulted' | 'written_off';
type LoanTier = 'tier_1_200' | 'tier_2_350' | 'tier_3_500';
```

**Filters**:
- Date range (custom, last 7/30/90 days, year-to-date)
- Loan status
- Device type
- Customer tier
- Distributor

**Export Formats**: CSV, Excel, PDF

---

### 3.2 Loan Aging Report

**Purpose**: Track outstanding loan balances by aging buckets

**Data Schema**:

```typescript
interface LoanAgingReport {
  reportDate: string;

  summary: {
    current: number; // 0-30 days
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_91_120: number;
    bucket_120_plus: number;
    total: number;
  };

  details: Array<{
    loanId: string;
    customerId: string;
    customerName: string;
    phoneNumber: string;
    deviceModel: string;
    principalAmount: number;
    outstandingBalance: number;
    daysPastDue: number;
    agingBucket: string;
    lastPaymentDate: string;
    lastPaymentAmount: number;
    nextDueDate: string;
    expectedPayment: number;
    lockStatus: 'unlocked' | 'locked';
  }>;
}
```

**Sort Options**: Days past due, outstanding balance, customer name

**Actions**: Export, send to collections, lock device

---

### 3.3 Loan Cohort Analysis

**Purpose**: Analyze loan performance by origination cohort

**Data Schema**:

```typescript
interface CohortAnalysisReport {
  cohorts: Array<{
    cohortMonth: string; // e.g., '2025-11'
    loansOriginated: number;
    totalDisbursed: number;

    // Performance by month since origination
    performanceByMonth: Array<{
      monthNumber: number; // 1, 2, 3, etc.
      outstandingBalance: number;
      collectionsRate: number;
      defaultRate: number;
      par30Rate: number;
    }>;

    // Final outcomes
    outcomes: {
      paidOff: { count: number; percentage: number };
      active: { count: number; percentage: number };
      defaulted: { count: number; percentage: number };
      writtenOff: { count: number; percentage: number };
    };

    // Financial performance
    financial: {
      totalCollected: number;
      totalWrittenOff: number;
      netReturn: number;
      roi: number;
    };
  }>;
}
```

**Visualizations**: Cohort heatmaps, vintage curves

---

## 4. Payment & Collections Reports

### 4.1 Daily Collections Report

**Purpose**: Track daily payment collections and reconciliation

**Data Schema**:

```typescript
interface DailyCollectionsReport {
  reportDate: string;

  summary: {
    expectedCollections: number;
    actualCollections: number;
    collectionRate: number;
    paymentCount: number;
    uniqueCustomers: number;
  };

  byGateway: Array<{
    gateway: 'ecocash' | 'onemoney' | 'innbucks';
    expectedAmount: number;
    collectedAmount: number;
    transactionCount: number;
    failedCount: number;
    reconciliationStatus: 'matched' | 'partial' | 'pending';
  }>;

  transactions: Array<{
    transactionId: string;
    timestamp: string;
    customerId: string;
    customerName: string;
    loanId: string;
    amount: number;
    gateway: string;
    status: 'success' | 'failed' | 'pending';
    reconciled: boolean;
    reference: string;
  }>;

  reconciliation: {
    matched: number;
    unmatched: number;
    disputed: number;
    pendingReview: number;
  };
}
```

**Refresh**: Hourly during business hours

**Actions**: Reconcile payments, investigate failed transactions, export

---

### 4.2 Collections Efficiency Report

**Purpose**: Measure collections team performance and effectiveness

**Data Schema**:

```typescript
interface CollectionsEfficiencyReport {
  reportPeriod: { startDate: string; endDate: string };

  overall: {
    targetCollections: number;
    actualCollections: number;
    efficiency: number; // actual / target
    averageResponseTime: number; // minutes
    successRate: number;
  };

  byCollector: Array<{
    collectorId: string;
    collectorName: string;
    assignedAccounts: number;
    contactedAccounts: number;
    successfulCollections: number;
    amountCollected: number;
    callsMade: number;
    smssSent: number;
    whatsappMessagesSent: number;
    efficiency: number;
  }>;

  byStrategy: Array<{
    strategy: 'whatsapp_reminder' | 'sms_reminder' | 'phone_call' | 'device_lock_warning' | 'device_locked';
    accountsApplied: number;
    successfulCollections: number;
    amountCollected: number;
    averageDaysToPayment: number;
    effectiveness: number;
  }>;

  trends: {
    dailyCollections: TimeSeriesData[];
    collectionsByHour: Array<{ hour: number; amount: number; count: number }>;
  };
}
```

---

### 4.3 Delinquency Report

**Purpose**: Monitor and manage delinquent loans

**Data Schema**:

```typescript
interface DelinquencyReport {
  reportDate: string;

  summary: {
    totalDelinquent: number;
    delinquentCount: number;
    delinquencyRate: number;
    averageDaysPastDue: number;
  };

  byBucket: Array<{
    bucket: '1-30' | '31-60' | '61-90' | '90+';
    count: number;
    totalAmount: number;
    percentage: number;
  }>;

  details: Array<{
    loanId: string;
    customerId: string;
    customerName: string;
    phoneNumber: string;
    deviceModel: string;
    daysPastDue: number;
    missedPayments: number;
    outstandingBalance: number;
    lastContactDate: string;
    lastContactMethod: string;
    deviceLockStatus: 'unlocked' | 'locked' | 'lock_pending';
    assignedCollector: string;
    nextAction: string;
    nextActionDate: string;
  }>;

  trends: {
    delinquencyRateOverTime: TimeSeriesData[];
    rollRates: { // Movement between buckets
      current_to_30: number;
      '30_to_60': number;
      '60_to_90': number;
      '90_to_writeoff': number;
    };
  };
}
```

**Actions**: Assign to collector, send reminder, lock device, escalate

---

## 5. Customer Analytics Reports

### 5.1 Customer Acquisition Report

**Purpose**: Track customer acquisition, onboarding, and conversion

**Data Schema**:

```typescript
interface CustomerAcquisitionReport {
  reportPeriod: { startDate: string; endDate: string };

  funnel: {
    whatsappInitiated: number;
    kycStarted: number;
    kycCompleted: number;
    loanApplied: number;
    loanApproved: number;
    loanDisbursed: number;

    conversionRates: {
      initiated_to_kyc: number;
      kyc_to_application: number;
      application_to_approval: number;
      approval_to_disbursement: number;
      overall: number;
    };

    dropoffPoints: Array<{
      stage: string;
      dropoffCount: number;
      dropoffRate: number;
      topReasons: Array<{ reason: string; count: number }>;
    }>;
  };

  demographics: {
    byAge: Record<string, number>; // '18-25', '26-35', '36-45', '46+'
    byGender: Record<string, number>;
    byLocation: Record<string, number>; // Cities/provinces
    byOccupation: Record<string, number>;
  };

  acquisitionChannels: Array<{
    channel: string; // 'organic', 'referral', 'distributor', 'marketing'
    customersAcquired: number;
    conversionRate: number;
    averageTimeToConversion: number; // days
    costPerAcquisition: number;
  }>;

  timeToComplete: {
    averageOnboardingTime: number; // minutes
    averageKYCTime: number;
    averageApprovalTime: number;
    averageDisbursementTime: number;
  };
}
```

**Visualizations**: Funnel chart, demographic breakdowns, trend lines

---

### 5.2 Customer Behavior Report

**Purpose**: Analyze customer behavior patterns and engagement

**Data Schema**:

```typescript
interface CustomerBehaviorReport {
  reportPeriod: { startDate: string; endDate: string };

  engagement: {
    activeCustomers: number;
    dormantCustomers: number; // No activity in 30+ days
    averageSessionsPerCustomer: number;
    averageMessagesPerCustomer: number;
    mostActiveHours: Array<{ hour: number; messageCount: number }>;
    mostActiveDays: Array<{ day: string; messageCount: number }>;
  };

  paymentBehavior: {
    onTimePaymentRate: number;
    earlyPaymentRate: number;
    latePaymentRate: number;
    averageDaysEarly: number;
    averageDaysLate: number;
    preferredPaymentGateway: Record<string, number>;
    preferredPaymentTime: Array<{ hour: number; count: number }>;
  };

  deviceUsage: {
    averageDeviceAge: number; // months
    upgradeRate: number; // Customers who took 2nd+ loan
    averageTimeBetweenLoans: number; // days
    repeatCustomerRate: number;
  };

  supportInteractions: {
    totalTickets: number;
    averageTicketsPerCustomer: number;
    topIssues: Array<{ issue: string; count: number }>;
    averageResolutionTime: number; // hours
    satisfactionScore: number; // If available
  };

  churnAnalysis: {
    churnedCustomers: number;
    churnRate: number;
    topChurnReasons: Array<{ reason: string; count: number }>;
    averageLifetimeValue: number;
  };
}
```

---

### 5.3 Customer Lifetime Value (LTV) Report

**Purpose**: Calculate and track customer lifetime value

**Data Schema**:

```typescript
interface CustomerLTVReport {
  summary: {
    averageLTV: number;
    medianLTV: number;
    totalCustomerValue: number;
  };

  bySegment: Array<{
    segment: string; // 'tier_1', 'tier_2', 'tier_3', 'repeat', 'new'
    customerCount: number;
    averageLTV: number;
    totalRevenue: number;
    averageLoanCount: number;
    retentionRate: number;
    profitMargin: number;
  }>;

  topCustomers: Array<{
    customerId: string;
    customerName: string;
    ltv: number;
    loanCount: number;
    totalRevenue: number;
    totalProfit: number;
    tenure: number; // months
    status: 'active' | 'inactive';
  }>;

  cohortLTV: Array<{
    cohort: string; // Acquisition month
    month1LTV: number;
    month3LTV: number;
    month6LTV: number;
    month12LTV: number;
    projectedLTV: number;
  }>;
}
```

---

## 6. Device Inventory Reports

### 6.1 Device Inventory Report

**Purpose**: Track device stock levels, movements, and status

**Data Schema**:

```typescript
interface DeviceInventoryReport {
  reportDate: string;

  summary: {
    totalDevices: number;
    inStock: number;
    allocated: number;
    active: number;
    locked: number;
    repossessed: number;
    damaged: number;
  };

  byModel: Array<{
    model: string;
    brand: string;
    inStock: number;
    allocated: number;
    active: number;
    averageCost: number;
    totalValue: number;
    daysOfInventory: number; // Stock / avg daily sales
    reorderLevel: number;
    needsReorder: boolean;
  }>;

  movements: {
    stockIn: number;
    stockOut: number;
    transfers: number;
    returns: number;
    writeOffs: number;
  };

  byLocation: Array<{
    distributorId: string;
    distributorName: string;
    location: string;
    devicesHeld: number;
    devicesPending: number;
    devicesActive: number;
  }>;

  aging: Array<{
    ageRange: string; // '0-30', '31-60', '61-90', '90+'
    deviceCount: number;
    totalValue: number;
  }>;
}
```

**Alerts**: Low stock warnings, slow-moving inventory, reorder suggestions

---

### 6.2 Device Lifecycle Report

**Purpose**: Track device status from procurement to end-of-life

**Data Schema**:

```typescript
interface DeviceLifecycleReport {
  devices: Array<{
    imei: string;
    model: string;
    brand: string;

    lifecycle: {
      procuredDate: string;
      procurementCost: number;
      inStockDays: number;
      handoverDate: string;
      customerId: string;
      customerName: string;
      loanId: string;
      activeDays: number;
      lockCount: number;
      totalLockDays: number;
      returnDate?: string;
      repossessionDate?: string;
      conditionAtReturn?: string;
      resaleValue?: number;
      disposalDate?: string;
      disposalMethod?: string;
    };

    financialPerformance: {
      totalRevenueGenerated: number;
      totalCostIncurred: number;
      netProfit: number;
      roi: number;
    };

    status: 'in_stock' | 'allocated' | 'active' | 'locked' | 'returned' | 'repossessed' | 'resold' | 'disposed';
  }>;

  summary: {
    averageTimeToHandover: number; // days
    averageLoanDuration: number;
    averageROI: number;
    deviceUtilizationRate: number;
    repossessionRate: number;
    resaleRate: number;
  };
}
```

---

### 6.3 Device Lock/Unlock Report

**Purpose**: Track device lock/unlock operations and effectiveness

**Data Schema**:

```typescript
interface DeviceLockReport {
  reportPeriod: { startDate: string; endDate: string };

  summary: {
    totalLockedDevices: number;
    lockOperationsCount: number;
    unlockOperationsCount: number;
    currentlyLocked: number;
    averageLockDuration: number; // hours
  };

  lockReasons: Array<{
    reason: string; // 'missed_payment', 'manual_lock', 'fraud_suspicion'
    count: number;
    percentage: number;
  }>;

  effectiveness: {
    paymentAfterLockWarning: number;
    paymentAfterLock: number;
    averageTimeToPayment: number; // hours after lock
    lockConversionRate: number; // % that resulted in payment
  };

  operations: Array<{
    deviceId: string;
    imei: string;
    customerId: string;
    customerName: string;
    loanId: string;
    operation: 'lock' | 'unlock';
    timestamp: string;
    reason: string;
    performedBy: string;
    daysOverdue: number;
    amountOverdue: number;
    paymentReceived: boolean;
    paymentAmount?: number;
    timeToPayment?: number; // hours
  }>;
}
```

---

## 7. Financial Reports

### 7.1 Profit & Loss (P&L) Statement

**Purpose**: Comprehensive financial performance statement

**Data Schema**:

```typescript
interface ProfitLossReport {
  reportPeriod: { startDate: string; endDate: string };

  // Revenue
  revenue: {
    interestIncome: number;
    latePaymentFees: number;
    otherFees: number;
    totalRevenue: number;
  };

  // Direct Costs
  directCosts: {
    deviceProcurement: number;
    deviceDepreciation: number;
    paymentGatewayFees: number;
    totalDirectCosts: number;
  };

  grossProfit: number;
  grossMargin: number;

  // Operating Expenses
  operatingExpenses: {
    salaries: number;
    marketing: number;
    technology: number; // AWS, Supabase, etc.
    kycVerification: number;
    smsCosts: number;
    officeExpenses: number;
    otherExpenses: number;
    totalOperatingExpenses: number;
  };

  operatingProfit: number;
  operatingMargin: number;

  // Other Income/Expenses
  otherIncomeExpenses: {
    deviceResaleIncome: number;
    loanWriteOffs: number;
    badDebtProvision: number;
    netOtherIncomeExpenses: number;
  };

  netProfit: number;
  netMargin: number;

  // Key Metrics
  metrics: {
    customerAcquisitionCost: number;
    averageRevenuePerUser: number;
    returnOnAssets: number;
    breakEvenPoint: number;
  };
}
```

**Export Formats**: PDF (formatted statement), Excel (with formulas)

---

### 7.2 Cash Flow Report

**Purpose**: Track cash inflows and outflows

**Data Schema**:

```typescript
interface CashFlowReport {
  reportPeriod: { startDate: string; endDate: string };

  openingBalance: number;

  // Operating Activities
  operatingActivities: {
    cashInflows: {
      loanRepayments: number;
      latePaymentFees: number;
      otherIncome: number;
      total: number;
    };

    cashOutflows: {
      salaries: number;
      marketing: number;
      technologyCosts: number;
      operationalExpenses: number;
      total: number;
    };

    netOperatingCashFlow: number;
  };

  // Investing Activities
  investingActivities: {
    cashOutflows: {
      devicePurchases: number;
      equipmentPurchases: number;
      total: number;
    };

    cashInflows: {
      deviceResales: number;
      total: number;
    };

    netInvestingCashFlow: number;
  };

  // Financing Activities
  financingActivities: {
    cashInflows: {
      capitalInvestments: number;
      loans: number;
      total: number;
    };

    cashOutflows: {
      loanRepayments: number;
      dividends: number;
      total: number;
    };

    netFinancingCashFlow: number;
  };

  netCashFlow: number;
  closingBalance: number;

  // Projections (next 30 days)
  projections: {
    expectedInflows: number;
    expectedOutflows: number;
    projectedBalance: number;
  };
}
```

---

### 7.3 Financial Reconciliation Report

**Purpose**: Reconcile payments across gateways and accounting

**Data Schema**:

```typescript
interface FinancialReconciliationReport {
  reportDate: string;

  byGateway: Array<{
    gateway: string;
    gatewayBalance: number;
    systemBalance: number;
    difference: number;
    reconciled: boolean;
    unmatchedTransactions: number;
  }>;

  unmatchedTransactions: Array<{
    transactionId: string;
    source: 'gateway' | 'system';
    gateway: string;
    amount: number;
    timestamp: string;
    reference: string;
    possibleMatches: Array<{
      matchId: string;
      confidence: number;
      reason: string;
    }>;
  }>;

  accountingEntries: Array<{
    date: string;
    account: string;
    debit: number;
    credit: number;
    balance: number;
    description: string;
  }>;

  summary: {
    totalReconciled: number;
    totalUnreconciled: number;
    reconciliationRate: number;
    oldestUnreconciled: string; // Date
  };
}
```

---

## 8. Operational Reports

### 8.1 KYC Processing Report

**Purpose**: Monitor KYC verification pipeline and efficiency

**Data Schema**:

```typescript
interface KYCProcessingReport {
  reportPeriod: { startDate: string; endDate: string };

  summary: {
    totalSubmissions: number;
    autoApproved: number;
    manualReview: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
    averageProcessingTime: number; // minutes
  };

  byStatus: Record<KYCStatus, {
    count: number;
    percentage: number;
    averageAge: number; // hours
  }>;

  rejectionReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;

  processingTimes: {
    autoVerification: number; // average minutes
    manualReview: number;
    resubmission: number;
    overall: number;
  };

  reviewerPerformance: Array<{
    reviewerId: string;
    reviewerName: string;
    reviewsCompleted: number;
    averageReviewTime: number;
    approvalRate: number;
    accuracy: number; // % of reviews not overturned
  }>;

  bottlenecks: Array<{
    stage: string;
    averageWaitTime: number;
    itemsInQueue: number;
    recommendation: string;
  }>;
}

type KYCStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'resubmission_required';
```

---

### 8.2 Device Handover Report

**Purpose**: Track device handover operations and logistics

**Data Schema**:

```typescript
interface DeviceHandoverReport {
  reportPeriod: { startDate: string; endDate: string };

  summary: {
    scheduledHandovers: number;
    completedHandovers: number;
    pendingHandovers: number;
    cancelledHandovers: number;
    completionRate: number;
    averageHandoverTime: number; // minutes
  };

  byDistributor: Array<{
    distributorId: string;
    distributorName: string;
    location: string;
    scheduledHandovers: number;
    completedHandovers: number;
    averageWaitTime: number; // days from approval to handover
    customerSatisfaction: number;
  }>;

  handovers: Array<{
    handoverId: string;
    customerId: string;
    customerName: string;
    loanId: string;
    deviceModel: string;
    imei: string;
    distributorName: string;
    scheduledDate: string;
    actualDate: string;
    status: string;
    delayDays: number;
    delayReason?: string;
    completedBy: string;
  }>;

  issues: Array<{
    issueType: string;
    count: number;
    averageResolutionTime: number;
  }>;
}
```

---

### 8.3 Support Tickets Report

**Purpose**: Track customer support requests and resolution

**Data Schema**:

```typescript
interface SupportTicketsReport {
  reportPeriod: { startDate: string; endDate: string };

  summary: {
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    averageResolutionTime: number; // hours
    firstResponseTime: number; // minutes
    satisfactionScore: number;
  };

  byCategory: Array<{
    category: string; // 'payment_issue', 'device_issue', 'kyc_question', etc.
    count: number;
    percentage: number;
    averageResolutionTime: number;
  }>;

  byPriority: Record<'low' | 'medium' | 'high' | 'urgent', {
    count: number;
    resolved: number;
    averageResolutionTime: number;
  }>;

  agentPerformance: Array<{
    agentId: string;
    agentName: string;
    ticketsHandled: number;
    ticketsClosed: number;
    averageResolutionTime: number;
    averageResponseTime: number;
    satisfactionScore: number;
  }>;

  trends: {
    ticketVolumeByDay: TimeSeriesData[];
    ticketVolumeByHour: Array<{ hour: number; count: number }>;
  };
}
```

---

## 9. Risk & Compliance Reports

### 9.1 Audit Trail Report

**Purpose**: Comprehensive audit log for compliance and security

**Data Schema**:

```typescript
interface AuditTrailReport {
  reportPeriod: { startDate: string; endDate: string };

  filters: {
    adminUser?: string;
    action?: string;
    resourceType?: string;
    status?: 'success' | 'failure' | 'error';
  };

  entries: Array<{
    timestamp: string;
    adminUserId: string;
    adminEmail: string;
    adminRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    oldValues?: any;
    newValues?: any;
    status: string;
    errorMessage?: string;
  }>;

  summary: {
    totalActions: number;
    uniqueUsers: number;
    successfulActions: number;
    failedActions: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ user: string; actionCount: number }>;
  };

  securityEvents: Array<{
    timestamp: string;
    eventType: string; // 'unauthorized_access', 'suspicious_activity', etc.
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId: string;
    details: string;
    resolved: boolean;
  }>;
}
```

**Retention**: 7 years (compliance requirement)

---

### 9.2 Fraud Detection Report

**Purpose**: Identify and track potentially fraudulent activities

**Data Schema**:

```typescript
interface FraudDetectionReport {
  reportPeriod: { startDate: string; endDate: string };

  summary: {
    fraudCasesDetected: number;
    fraudCasesConfirmed: number;
    fraudCasesPending: number;
    totalFraudAmount: number;
    recoveredAmount: number;
    preventedAmount: number;
  };

  detectedCases: Array<{
    caseId: string;
    detectionDate: string;
    customerId: string;
    customerName: string;
    loanId?: string;
    fraudType: string; // 'identity_theft', 'payment_fraud', 'device_fraud', etc.
    riskScore: number;
    amount: number;
    status: 'detected' | 'investigating' | 'confirmed' | 'false_positive';
    indicators: string[];
    assignedInvestigator: string;
    resolutionDate?: string;
    outcome?: string;
  }>;

  fraudPatterns: Array<{
    pattern: string;
    occurrences: number;
    totalAmount: number;
    detectionMethod: string;
  }>;

  preventionMetrics: {
    kycRejectionsDueToPotentialFraud: number;
    transactionsBlocked: number;
    amountSaved: number;
  };
}
```

---

## 10. Report Scheduling & Distribution

### 10.1 Scheduled Reports Configuration

```typescript
interface ScheduledReport {
  id: string;
  reportType: string;
  name: string;
  description: string;

  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string; // HH:MM in UTC
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    timezone: string;
  };

  parameters: {
    dateRange: 'yesterday' | 'last_week' | 'last_month' | 'last_quarter' | 'custom';
    filters?: Record<string, any>;
  };

  distribution: {
    method: 'email' | 'slack' | 'download' | 'dashboard';
    recipients: string[]; // Email addresses or Slack channels
    format: 'pdf' | 'excel' | 'csv';
    includeCharts: boolean;
  };

  active: boolean;
  createdBy: string;
  lastRun?: string;
  nextRun: string;
}

// Example scheduled reports
const DEFAULT_SCHEDULED_REPORTS: ScheduledReport[] = [
  {
    id: 'daily-collections',
    reportType: 'daily_collections',
    name: 'Daily Collections Report',
    description: 'Daily payment collections and reconciliation',
    schedule: {
      frequency: 'daily',
      time: '08:00',
      timezone: 'Africa/Harare'
    },
    parameters: {
      dateRange: 'yesterday'
    },
    distribution: {
      method: 'email',
      recipients: ['finance@lynia.com', 'operations@lynia.com'],
      format: 'pdf',
      includeCharts: true
    },
    active: true,
    createdBy: 'system',
    nextRun: '2025-11-28T08:00:00Z'
  },
  {
    id: 'weekly-portfolio',
    reportType: 'portfolio_performance',
    name: 'Weekly Portfolio Performance',
    description: 'Comprehensive portfolio health metrics',
    schedule: {
      frequency: 'weekly',
      time: '09:00',
      dayOfWeek: 1, // Monday
      timezone: 'Africa/Harare'
    },
    parameters: {
      dateRange: 'last_week'
    },
    distribution: {
      method: 'email',
      recipients: ['executives@lynia.com'],
      format: 'pdf',
      includeCharts: true
    },
    active: true,
    createdBy: 'system',
    nextRun: '2025-12-02T09:00:00Z'
  }
];
```

---

## 11. Export Formats

### 11.1 CSV Export

```typescript
// Simple tabular data export
interface CSVExport {
  headers: string[];
  rows: string[][];
  filename: string;
}

// Usage
async function exportToCSV(data: any[], filename: string): Promise<void> {
  // Implementation
}
```

### 11.2 Excel Export

```typescript
// Excel export with formatting
interface ExcelExport {
  sheets: Array<{
    name: string;
    data: any[][];
    formatting?: {
      headerStyle?: any;
      columnWidths?: number[];
      freezeRows?: number;
    };
  }>;
  filename: string;
}

// Library: xlsx or exceljs
```

### 11.3 PDF Export

```typescript
// PDF export with charts and formatting
interface PDFExport {
  title: string;
  sections: Array<{
    heading: string;
    content: string | any[]; // Text or data
    chart?: ChartConfig;
  }>;
  filename: string;
}

// Library: pdfmake or react-pdf
```

---

## 12. Implementation Checklist

- [ ] Create Supabase views for each report type
- [ ] Implement report generation functions
- [ ] Build report API endpoints
- [ ] Create React components for report display
- [ ] Implement chart visualizations (Recharts)
- [ ] Add export functionality (CSV, Excel, PDF)
- [ ] Build report scheduling system
- [ ] Create email distribution service
- [ ] Implement report caching (Redis/Supabase)
- [ ] Add report filters and date range selectors
- [ ] Create report permission checks
- [ ] Build report dashboard UI
- [ ] Add report bookmarking/favorites
- [ ] Implement drill-down capabilities
- [ ] Create report templates
- [ ] Add report sharing functionality
- [ ] Write report generation tests
- [ ] Optimize report queries for performance
- [ ] Document all report definitions

---

## 13. Performance Optimization

### 13.1 Report Caching Strategy

```typescript
// Cache frequently accessed reports
const CACHE_DURATIONS = {
  'executive_dashboard': 5 * 60, // 5 minutes
  'daily_collections': 60 * 60, // 1 hour
  'portfolio_performance': 24 * 60 * 60, // 24 hours
  'audit_trail': 0 // No cache (always fresh)
};
```

### 13.2 Database Optimization

```sql
-- Materialized views for expensive reports
CREATE MATERIALIZED VIEW mv_daily_portfolio_summary AS
SELECT
  DATE(created_at) as report_date,
  COUNT(*) as total_loans,
  SUM(principal_amount) as total_value,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
  SUM(CASE WHEN days_overdue > 30 THEN outstanding_balance ELSE 0 END) as par_30
FROM loans
GROUP BY DATE(created_at);

-- Refresh daily
CREATE OR REPLACE FUNCTION refresh_portfolio_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_daily_portfolio_summary;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (using pg_cron or external scheduler)
```

---

**Document Status**: Complete
**Last Updated**: November 27, 2025
**Next Review**: Phase 2 Planning
