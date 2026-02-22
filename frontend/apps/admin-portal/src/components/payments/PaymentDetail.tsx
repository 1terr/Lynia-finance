'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime, formatCurrency, maskPhone } from '@lynia/utils';
import {
  confirmPayment,
  failPayment,
  refundPayment,
  reconcilePayment,
  type PaymentWithCustomer,
} from '@/lib/api/payments';

interface PaymentDetailProps {
  payment: PaymentWithCustomer;
}

const statusMap: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
  confirmed: { variant: 'green', label: 'Confirmed' },
  pending: { variant: 'yellow', label: 'Pending' },
  failed: { variant: 'red', label: 'Failed' },
  refunded: { variant: 'gray', label: 'Refunded' },
};

export function PaymentDetail({ payment }: PaymentDetailProps) {
  const [actionNotes, setActionNotes] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const queryClient = useQueryClient();
  const statusInfo = statusMap[payment.status] || statusMap.pending;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['payment', payment.id] });

  const confirmMutation = useMutation({
    mutationFn: () => confirmPayment(payment.id, actionNotes),
    onSuccess: invalidate,
  });

  const failMutation = useMutation({
    mutationFn: () => failPayment(payment.id, actionNotes),
    onSuccess: invalidate,
  });

  const refundMutation = useMutation({
    mutationFn: () => refundPayment(payment.id, actionNotes),
    onSuccess: () => {
      invalidate();
      setShowRefundForm(false);
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: () => reconcilePayment(payment.id),
    onSuccess: invalidate,
  });

  const isProcessing =
    confirmMutation.isPending ||
    failMutation.isPending ||
    refundMutation.isPending ||
    reconcileMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Payment Details
            </h2>
            <p className="mt-1 text-sm text-gray-500">ID: {payment.id}</p>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-3">
          <InfoField label="Amount" value={formatCurrency(payment.amount_usd)} />
          <InfoField
            label="Payment Type"
            value={payment.payment_type.replace(/_/g, ' ')}
          />
          <InfoField
            label="Payment Method"
            value={payment.payment_method.replace(/_/g, ' ')}
          />
          <InfoField label="Payment Date" value={formatDate(payment.payment_date)} />
          <InfoField
            label="Reference"
            value={payment.reference_number || payment.transaction_id || '-'}
          />
          <InfoField label="Currency" value={payment.currency} />
          {payment.confirmed_at && (
            <InfoField
              label="Confirmed At"
              value={formatDateTime(payment.confirmed_at)}
            />
          )}
          {payment.failed_at && (
            <InfoField
              label="Failed At"
              value={formatDateTime(payment.failed_at)}
            />
          )}
          {payment.failure_reason && (
            <InfoField
              label="Failure Reason"
              value={payment.failure_reason}
              className="col-span-2"
            />
          )}
        </div>

        {/* Payment Allocation */}
        {(payment.principal_amount || payment.interest_amount) && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">
              Payment Allocation
            </h3>
            <div className="mt-2 grid grid-cols-4 gap-4">
              <AllocField
                label="Principal"
                amount={payment.principal_amount}
              />
              <AllocField
                label="Interest"
                amount={payment.interest_amount}
              />
              <AllocField label="Penalty" amount={payment.penalty_amount} />
              <AllocField label="Fees" amount={payment.fee_amount} />
            </div>
          </div>
        )}
      </div>

      {/* Customer & Loan Info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
          {payment.customers ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                <Link
                  href={`/dashboard/customers/${payment.customer_id}`}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {payment.customers.first_name} {payment.customers.last_name}
                </Link>
              </p>
              <p className="text-sm text-gray-500">
                {maskPhone(payment.customers.phone_number)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">{payment.customer_id}</p>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-sm font-semibold text-gray-900">Loan</h3>
          {payment.loans ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-900">
                {formatCurrency((payment.loans as any).principal)} loan
              </p>
              <p className="text-sm text-gray-500">
                Status: {(payment.loans as any).status}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">{payment.loan_id}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-sm font-semibold text-gray-900">Actions</h3>

        {payment.status === 'pending' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Add notes for this action..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (confirm('Confirm this payment?'))
                    confirmMutation.mutate();
                }}
                disabled={isProcessing}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {confirmMutation.isPending
                  ? 'Confirming...'
                  : 'Confirm Payment'}
              </button>
              <button
                onClick={() => {
                  if (!actionNotes.trim()) {
                    alert('Please provide a reason for marking as failed');
                    return;
                  }
                  failMutation.mutate();
                }}
                disabled={isProcessing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {failMutation.isPending ? 'Processing...' : 'Mark as Failed'}
              </button>
            </div>
          </div>
        )}

        {payment.status === 'confirmed' && (
          <div className="mt-4 flex gap-3">
            {!payment.reconciled && (
              <button
                onClick={() => reconcileMutation.mutate()}
                disabled={isProcessing}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {reconcileMutation.isPending
                  ? 'Reconciling...'
                  : 'Mark as Reconciled'}
              </button>
            )}
            <button
              onClick={() => setShowRefundForm(!showRefundForm)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Initiate Refund
            </button>
          </div>
        )}

        {showRefundForm && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="text-sm font-medium text-red-900">
              Refund Payment
            </h4>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              rows={2}
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Reason for refund (required)..."
            />
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => {
                  if (!actionNotes.trim()) {
                    alert('Refund reason is required');
                    return;
                  }
                  if (
                    confirm(
                      `Refund ${formatCurrency(payment.amount_usd)} to customer?`
                    )
                  ) {
                    refundMutation.mutate();
                  }
                }}
                disabled={isProcessing || !actionNotes.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {refundMutation.isPending
                  ? 'Processing...'
                  : 'Confirm Refund'}
              </button>
              <button
                onClick={() => {
                  setShowRefundForm(false);
                  setActionNotes('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {payment.status === 'failed' && (
          <p className="mt-4 text-sm text-gray-500">
            This payment has failed.{' '}
            {payment.failure_reason &&
              `Reason: ${payment.failure_reason}`}
          </p>
        )}

        {payment.status === 'refunded' && (
          <p className="mt-4 text-sm text-gray-500">
            This payment has been refunded.
          </p>
        )}
      </div>

      {payment.notes && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
          <p className="mt-2 text-sm text-gray-700">{payment.notes}</p>
        </div>
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize text-gray-900">
        {value}
      </p>
    </div>
  );
}

function AllocField({
  label,
  amount,
}: {
  label: string;
  amount: number | null;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">
        {amount !== null ? formatCurrency(amount) : '-'}
      </p>
    </div>
  );
}
