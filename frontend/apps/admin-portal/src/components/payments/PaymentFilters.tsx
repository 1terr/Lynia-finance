'use client';

import type { PaymentListParams } from '@/lib/api/payments';

interface PaymentFiltersProps {
  filters: PaymentListParams;
  onChange: (filters: Partial<PaymentListParams>) => void;
}

export function PaymentFilters({ filters, onChange }: PaymentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={filters.status || ''}
        onChange={(e) =>
          onChange({
            status: (e.target.value || undefined) as PaymentListParams['status'],
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Statuses</option>
        <option value="confirmed">Confirmed</option>
        <option value="pending">Pending</option>
        <option value="failed">Failed</option>
        <option value="refunded">Refunded</option>
      </select>

      <select
        value={filters.payment_method || ''}
        onChange={(e) =>
          onChange({
            payment_method: (e.target.value || undefined) as PaymentListParams['payment_method'],
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Methods</option>
        <option value="ecocash">EcoCash</option>
        <option value="onemoney">OneMoney</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="cash">Cash</option>
      </select>

      <select
        value={filters.payment_type || ''}
        onChange={(e) =>
          onChange({
            payment_type: (e.target.value || undefined) as PaymentListParams['payment_type'],
          })
        }
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="">All Types</option>
        <option value="deposit">Deposit</option>
        <option value="installment">Installment</option>
        <option value="late_fee">Late Fee</option>
        <option value="early_payoff">Early Payoff</option>
      </select>

      <input
        type="date"
        value={filters.date_from || ''}
        onChange={(e) => onChange({ date_from: e.target.value || undefined })}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="From date"
      />

      <input
        type="date"
        value={filters.date_to || ''}
        onChange={(e) => onChange({ date_to: e.target.value || undefined })}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="To date"
      />
    </div>
  );
}
