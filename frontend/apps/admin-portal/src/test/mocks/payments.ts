import type { Payment } from '@/types/database';
import type {
  PaymentWithCustomer,
  PaymentSummary,
  CollectionItem,
} from '@/lib/api/payments';

export const mockPaymentWithCustomer: PaymentWithCustomer = {
  id: 'pay-001-uuid-test',
  loan_id: 'loan-001-uuid',
  customer_id: 'cust-001-uuid',
  payment_type: 'installment',
  amount_usd: 56.88,
  currency: 'USD',
  payment_method: 'ecocash',
  payment_provider: 'Econet',
  transaction_id: 'txn-001',
  reference_number: 'REF-001',
  status: 'confirmed',
  confirmed_at: '2025-11-15T10:05:00Z',
  failed_at: null,
  failure_reason: null,
  principal_amount: 43.75,
  interest_amount: 13.13,
  penalty_amount: null,
  fee_amount: null,
  payment_date: '2025-11-15',
  phone_number: '+263771234567',
  payer_name: 'John Moyo',
  notes: null,
  reconciled: false,
  reconciled_at: null,
  reconciled_by: null,
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2025-11-15T10:05:00Z',
  customers: {
    id: 'cust-001-uuid',
    first_name: 'John',
    last_name: 'Moyo',
    phone_number: '+263771234567',
  },
  loans: {
    id: 'loan-001-uuid',
    principal: 350,
    status: 'active',
  },
};

export const mockPendingPayment: PaymentWithCustomer = {
  ...mockPaymentWithCustomer,
  id: 'pay-002-uuid-test',
  status: 'pending',
  confirmed_at: null,
  reference_number: 'REF-002',
  transaction_id: 'txn-002',
  customers: {
    id: 'cust-002-uuid',
    first_name: 'Jane',
    last_name: 'Dube',
    phone_number: '+263779876543',
  },
};

export const mockFailedPayment: PaymentWithCustomer = {
  ...mockPaymentWithCustomer,
  id: 'pay-003-uuid-test',
  status: 'failed',
  confirmed_at: null,
  failed_at: '2025-11-16T08:00:00Z',
  failure_reason: 'Insufficient funds',
  reference_number: 'REF-003',
  transaction_id: 'txn-003',
};

export const mockPaymentList = [
  mockPaymentWithCustomer,
  mockPendingPayment,
  mockFailedPayment,
];

export const mockPaymentSummary: PaymentSummary = {
  total_confirmed: 1250.5,
  total_pending: 340.0,
  total_failed: 56.88,
  total_refunded: 0,
  count_confirmed: 22,
  count_pending: 6,
  count_failed: 1,
  count_refunded: 0,
};

export const mockCollectionItems: CollectionItem[] = [
  {
    id: 'loan-010',
    loan_id: 'loan-010',
    customer_id: 'cust-010',
    customer_name: 'Tendai Masara',
    customer_phone: '+263771111111',
    amount_due: 170.64,
    days_overdue: 75,
    missed_payments: 3,
    last_payment_date: '2025-09-01T00:00:00Z',
    next_payment_date: '2025-10-01T00:00:00Z',
    priority: 'critical',
  },
  {
    id: 'loan-011',
    loan_id: 'loan-011',
    customer_id: 'cust-011',
    customer_name: 'Blessing Chipo',
    customer_phone: '+263772222222',
    amount_due: 56.88,
    days_overdue: 20,
    missed_payments: 1,
    last_payment_date: '2025-11-01T00:00:00Z',
    next_payment_date: '2025-11-15T00:00:00Z',
    priority: 'medium',
  },
  {
    id: 'loan-012',
    loan_id: 'loan-012',
    customer_id: 'cust-012',
    customer_name: 'Tatenda Nyoni',
    customer_phone: '+263773333333',
    amount_due: 113.76,
    days_overdue: 45,
    missed_payments: 2,
    last_payment_date: '2025-10-01T00:00:00Z',
    next_payment_date: '2025-10-15T00:00:00Z',
    priority: 'high',
  },
];
