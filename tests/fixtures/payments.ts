/**
 * Test Fixtures: Payments
 * Sample payment data for testing
 */

export const testPayments = {
  // Completed deposit payment
  completedDeposit: {
    id: 'payment_test_001',
    loan_id: 'loan_test_001',
    customer_id: 'cust_test_001',
    amount: 70,
    payment_type: 'deposit',
    payment_method: 'onemoney',
    payment_provider: 'onemoney',
    provider_reference: 'OM123456789',
    status: 'completed',
    paid_at: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString()
  },

  // Completed installment payment
  completedInstallment: {
    id: 'payment_test_002',
    loan_id: 'loan_test_001',
    customer_id: 'cust_test_001',
    amount: 51.33,
    payment_type: 'installment',
    payment_method: 'onemoney',
    payment_provider: 'onemoney',
    provider_reference: 'OM123456790',
    status: 'completed',
    paid_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()
  },

  // Pending payment
  pendingPayment: {
    id: 'payment_test_003',
    loan_id: 'loan_test_002',
    customer_id: 'cust_test_003',
    amount: 58.67,
    payment_type: 'installment',
    payment_method: 'onemoney',
    payment_provider: 'onemoney',
    provider_reference: 'OM123456791',
    status: 'pending',
    paid_at: null,
    created_at: new Date().toISOString()
  },

  // Failed payment
  failedPayment: {
    id: 'payment_test_004',
    loan_id: 'loan_test_003',
    customer_id: 'cust_test_003',
    amount: 44,
    payment_type: 'installment',
    payment_method: 'onemoney',
    payment_provider: 'onemoney',
    provider_reference: 'OM123456792',
    status: 'failed',
    failure_reason: 'Insufficient funds',
    paid_at: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
};

export const testPaymentMethods = {
  oneMoney: {
    customer_id: 'cust_test_001',
    method_type: 'mobile_money',
    provider: 'onemoney',
    phone_number: '+263771234567',
    account_name: 'Tendai Moyo',
    is_primary: true,
    verified: true,
    created_at: new Date().toISOString()
  },

  ecoCash: {
    customer_id: 'cust_test_003',
    method_type: 'mobile_money',
    provider: 'ecocash',
    phone_number: '+263772345678',
    account_name: 'Grace Chiweshe',
    is_primary: true,
    verified: true,
    created_at: new Date().toISOString()
  }
};
