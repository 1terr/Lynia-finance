'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatDate, formatCurrency, truncateId, maskPhone } from '@lynia/utils';
import { reconcilePayment, retryPayment, type PaymentWithCustomer } from '@/lib/api/payments';

interface ReconciliationTableProps {
  payments: PaymentWithCustomer[];
  isLoading: boolean;
}

type StatusFilter = 'all' | 'confirmed' | 'failed';

export function ReconciliationTable({
  payments,
  isLoading,
}: ReconciliationTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const reconcileMutation = useMutationWithToast({
    mutationFn: (id: string) => reconcilePayment(id),
    successMessage: 'Payment reconciled successfully',
    invalidateKeys: [['unreconciled-payments']],
    onSuccess: () => setConfirmId(null),
  });

  const retryMutation = useMutationWithToast({
    mutationFn: (id: string) => retryPayment(id, 'admin'),
    successMessage: 'Reconciliation retry initiated',
    errorMessage: 'Failed to retry reconciliation',
    invalidateKeys: [['unreconciled-payments']],
  });

  const filteredPayments = useMemo(() => {
    let result = payments;

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter((p) => {
        const ref = (p.reference_number || p.transaction_id || '').toLowerCase();
        const name = p.customers
          ? `${p.customers.first_name} ${p.customers.last_name}`.toLowerCase()
          : '';
        return ref.includes(query) || name.includes(query);
      });
    }

    return result;
  }, [payments, statusFilter, debouncedSearch]);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-gray-500">
            Loading unreconciled payments...
          </p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <div className="text-4xl">&#10003;</div>
        <p className="mt-4 text-lg font-medium text-gray-900">
          All payments reconciled
        </p>
        <p className="mt-1 text-gray-500">
          No unreconciled confirmed payments found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference or customer..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:w-72"
        />
        <div className="flex gap-2">
          {(['all', 'confirmed', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <p className="text-sm text-gray-500">
            No payments match your search criteria.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {truncateId(payment.id)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {payment.customers
                        ? `${payment.customers.first_name} ${payment.customers.last_name}`
                        : truncateId(payment.customer_id)}
                    </div>
                    {payment.customers && (
                      <div className="text-xs text-gray-500">
                        {maskPhone(payment.customers.phone_number)}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(payment.amount_usd)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="text-sm capitalize text-gray-700">
                      {payment.payment_method.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {payment.reference_number || payment.transaction_id || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Badge variant={payment.status === 'failed' ? 'red' : payment.status === 'confirmed' ? 'green' : 'yellow'}>
                      {payment.status}
                    </Badge>
                    {payment.failure_reason && (
                      <p className="mt-1 max-w-[200px] truncate text-xs text-red-500" title={payment.failure_reason}>
                        {payment.failure_reason}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {payment.status === 'failed' && (
                        <button
                          onClick={() => retryMutation.mutate(payment.id)}
                          disabled={retryMutation.isPending}
                          className="rounded-md bg-yellow-500 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                      {payment.status !== 'failed' && (
                        <button
                          onClick={() => setConfirmId(payment.id)}
                          disabled={reconcileMutation.isPending}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Reconcile
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationDialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) reconcileMutation.mutate(confirmId);
        }}
        title="Reconcile Payment"
        description="Mark this payment as reconciled? This confirms the payment has been verified against external records."
        variant="info"
        confirmLabel="Reconcile"
        isLoading={reconcileMutation.isPending}
      />
    </div>
  );
}
