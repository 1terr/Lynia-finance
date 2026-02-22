'use client';

import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@lynia/utils';
import type { Payment } from '@/types/database';

interface CustomerPaymentsProps {
  payments: Payment[];
}

const paymentStatusMap: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
  confirmed: { variant: 'green', label: 'Confirmed' },
  pending: { variant: 'yellow', label: 'Pending' },
  failed: { variant: 'red', label: 'Failed' },
  refunded: { variant: 'gray', label: 'Refunded' },
};

export function CustomerPayments({ payments }: CustomerPaymentsProps) {
  if (!payments || payments.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">No payments found</p>
        </div>
      </div>
    );
  }

  const totalConfirmed = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount_usd, 0);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Payment History ({payments.length})
        </h2>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Confirmed</p>
          <p className="text-lg font-semibold text-green-600">
            {formatCurrency(totalConfirmed)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Reference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payments.map((payment) => {
              const statusInfo =
                paymentStatusMap[payment.status] || paymentStatusMap.pending;
              return (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(payment.amount_usd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-gray-900">
                    {payment.payment_type.replace(/_/g, ' ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-gray-900">
                    {payment.payment_method.replace(/_/g, ' ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {payment.reference_number || payment.transaction_id || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
