'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency, truncateId } from '@/lib/utils';
import { reconcilePayment, type PaymentWithCustomer } from '@/lib/api/payments';

interface ReconciliationTableProps {
  payments: PaymentWithCustomer[];
  isLoading: boolean;
}

export function ReconciliationTable({
  payments,
  isLoading,
}: ReconciliationTableProps) {
  const queryClient = useQueryClient();

  const reconcileMutation = useMutation({
    mutationFn: (id: string) => reconcilePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['unreconciled-payments'],
      });
    },
  });

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
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {payments.map((payment) => (
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
                    {payment.customers.phone_number}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {formatCurrency(payment.amount_usd)}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span className="text-sm capitalize text-gray-700">
                  {payment.payment_method.replace('_', ' ')}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {formatDate(payment.payment_date)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {payment.reference_number || payment.transaction_id || '-'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <button
                  onClick={() => reconcileMutation.mutate(payment.id)}
                  disabled={reconcileMutation.isPending}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Reconcile
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
