/**
 * Test Fixtures: Loans
 * Sample loan data for testing
 */

export const testLoans = {
  // Active loan with upcoming payment
  activeLoan: {
    id: 'loan_test_001',
    customer_id: 'cust_test_001',
    device_id: 'device_test_001',
    distributor_id: 'dist_test_001',
    loan_amount: 350,
    deposit_amount: 70, // 20%
    deposit_paid: true,
    principal: 280, // 350 - 70
    interest_rate: 15,
    loan_term_months: 6,
    monthly_payment: 51.33,
    total_repayment: 308,
    outstanding_balance: 200,
    paid_installments: 2,
    total_installments: 6,
    status: 'active',
    next_payment_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    disbursed_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
    created_at: new Date().toISOString()
  },

  // Overdue loan (7+ days) - should trigger lock
  overdueLoan: {
    id: 'loan_test_002',
    customer_id: 'cust_test_003',
    device_id: 'device_test_002',
    distributor_id: 'dist_test_001',
    loan_amount: 400,
    deposit_amount: 80,
    deposit_paid: true,
    principal: 320,
    interest_rate: 15,
    loan_term_months: 6,
    monthly_payment: 58.67,
    total_repayment: 352,
    outstanding_balance: 294,
    paid_installments: 1,
    total_installments: 6,
    status: 'active',
    next_payment_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (overdue)
    disbursed_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  },

  // Loan application in review
  reviewLoan: {
    id: 'loan_test_003',
    customer_id: 'cust_test_003',
    device_id: null,
    distributor_id: 'dist_test_001',
    loan_amount: 300,
    deposit_amount: 60,
    deposit_paid: false,
    principal: 240,
    interest_rate: 15,
    loan_term_months: 6,
    monthly_payment: 44,
    total_repayment: 264,
    outstanding_balance: 264,
    paid_installments: 0,
    total_installments: 6,
    status: 'review',
    next_payment_date: null,
    disbursed_at: null,
    created_at: new Date().toISOString()
  },

  // Approved loan - waiting for deposit
  approvedLoan: {
    id: 'loan_test_004',
    customer_id: 'cust_test_004',
    device_id: null,
    distributor_id: 'dist_test_001',
    loan_amount: 500,
    deposit_amount: 100,
    deposit_paid: false,
    principal: 400,
    interest_rate: 12, // Lower rate for Tier 1
    loan_term_months: 6,
    monthly_payment: 70.67,
    total_repayment: 424,
    outstanding_balance: 424,
    paid_installments: 0,
    total_installments: 6,
    status: 'paid_deposit',
    next_payment_date: null,
    disbursed_at: null,
    created_at: new Date().toISOString()
  },

  // Completed loan
  completedLoan: {
    id: 'loan_test_005',
    customer_id: 'cust_test_001',
    device_id: 'device_test_003',
    distributor_id: 'dist_test_001',
    loan_amount: 300,
    deposit_amount: 60,
    deposit_paid: true,
    principal: 240,
    interest_rate: 15,
    loan_term_months: 6,
    monthly_payment: 44,
    total_repayment: 264,
    outstanding_balance: 0,
    paid_installments: 6,
    total_installments: 6,
    status: 'completed',
    next_payment_date: null,
    disbursed_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString()
  }
};

export const testCreditScores = {
  highScore: {
    customer_id: 'cust_test_001',
    score: 720,
    tier: 2,
    factors: {
      kyc_quality: 20,
      income_stability: 70,
      affordability: 90,
      employment_type: 50,
      phone_age: 30
    },
    decision: 'approved',
    loan_limit: 500,
    calculated_at: new Date().toISOString()
  },

  lowScore: {
    customer_id: 'cust_test_003',
    score: 640,
    tier: 3,
    factors: {
      kyc_quality: 20,
      income_stability: 50,
      affordability: 70,
      employment_type: 30,
      phone_age: 20
    },
    decision: 'review',
    loan_limit: 300,
    calculated_at: new Date().toISOString()
  },

  rejectedScore: {
    customer_id: 'cust_test_006',
    score: 580,
    tier: null,
    factors: {
      kyc_quality: 10,
      income_stability: 30,
      affordability: 40,
      employment_type: 20,
      phone_age: 10
    },
    decision: 'rejected',
    rejection_reason: 'Credit score below minimum threshold (600)',
    loan_limit: 0,
    calculated_at: new Date().toISOString()
  }
};
