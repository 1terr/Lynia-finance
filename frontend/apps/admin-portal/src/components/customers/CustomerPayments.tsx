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
      <div className="rounded-lg bg-card p-6 shadow">
        <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
        <div className="mt-4 flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">No payments found</p>
        </div>
      </div>
    );
  }

  const totalConfirmed = payments
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount_usd, 0);

  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Payment History ({payments.length})
        </h2>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Confirmed</p>
          <p className="text-lg font-semibold text-green-600">
            {formatCurrency(totalConfirmed)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                Reference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((payment) => {
              const statusInfo =
                paymentStatusMap[payment.status] || paymentStatusMap.pending;
              return (
                <tr key={payment.id} className="hover:bg-accent">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
                    {formatCurrency(payment.amount_usd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-foreground">
                    {payment.payment_type.replace(/_/g, ' ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-foreground">
                    {payment.payment_method.replace(/_/g, ' ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
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
