'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
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

type ActionType = 'confirm' | 'fail' | 'refund' | 'reconcile' | null;

const statusMap: Record<string, { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string }> = {
  confirmed: { variant: 'green', label: 'Confirmed' },
  pending: { variant: 'yellow', label: 'Pending' },
  failed: { variant: 'red', label: 'Failed' },
  refunded: { variant: 'gray', label: 'Refunded' },
};

export function PaymentDetail({ payment }: PaymentDetailProps) {
  const [actionNotes, setActionNotes] = useState('');
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType>(null);
  const statusInfo = statusMap[payment.status] || statusMap.pending;

  const paymentQueryKey = ['payment', payment.id];

  const confirmMutation = useMutationWithToast({
    mutationFn: () => confirmPayment(payment.id, actionNotes),
    successMessage: 'Payment confirmed successfully',
    invalidateKeys: [paymentQueryKey],
    onSuccess: () => setPendingAction(null),
  });

  const failMutation = useMutationWithToast({
    mutationFn: () => failPayment(payment.id, actionNotes),
    successMessage: 'Payment marked as failed',
    invalidateKeys: [paymentQueryKey],
    onSuccess: () => setPendingAction(null),
  });

  const refundMutation = useMutationWithToast({
    mutationFn: () => refundPayment(payment.id, actionNotes),
    successMessage: 'Payment refunded successfully',
    invalidateKeys: [paymentQueryKey],
    onSuccess: () => {
      setPendingAction(null);
      setShowRefundForm(false);
    },
  });

  const reconcileMutation = useMutationWithToast({
    mutationFn: () => reconcilePayment(payment.id),
    successMessage: 'Payment reconciled successfully',
    invalidateKeys: [paymentQueryKey],
    onSuccess: () => setPendingAction(null),
  });

  const isProcessing =
    confirmMutation.isPending ||
    failMutation.isPending ||
    refundMutation.isPending ||
    reconcileMutation.isPending;

  const handleActionConfirm = () => {
    switch (pendingAction) {
      case 'confirm':
        confirmMutation.mutate(undefined);
        break;
      case 'fail':
        failMutation.mutate(undefined);
        break;
      case 'refund':
        refundMutation.mutate(undefined);
        break;
      case 'reconcile':
        reconcileMutation.mutate(undefined);
        break;
    }
  };

  const getDialogProps = (): {
    title: string;
    description: string;
    variant: 'destructive' | 'warning' | 'info';
    confirmLabel: string;
  } => {
    switch (pendingAction) {
      case 'confirm':
        return {
          title: 'Confirm Payment',
          description: `Confirm this ${formatCurrency(payment.amount_usd)} payment? This will mark it as verified and update the loan balance.`,
          variant: 'warning',
          confirmLabel: 'Confirm Payment',
        };
      case 'fail':
        return {
          title: 'Mark Payment as Failed',
          description: `Mark this ${formatCurrency(payment.amount_usd)} payment as failed? This action should only be used when the payment could not be verified. Notes: "${actionNotes}"`,
          variant: 'destructive',
          confirmLabel: 'Mark as Failed',
        };
      case 'refund':
        return {
          title: 'Refund Payment',
          description: `Refund ${formatCurrency(payment.amount_usd)} to the customer? This will reverse the payment and adjust the loan balance. Reason: "${actionNotes}"`,
          variant: 'destructive',
          confirmLabel: 'Confirm Refund',
        };
      case 'reconcile':
        return {
          title: 'Reconcile Payment',
          description: `Mark this ${formatCurrency(payment.amount_usd)} payment as reconciled?`,
          variant: 'info',
          confirmLabel: 'Reconcile',
        };
      default:
        return {
          title: '',
          description: '',
          variant: 'info',
          confirmLabel: 'Confirm',
        };
    }
  };

  const dialogProps = getDialogProps();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-card p-6 shadow">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Payment Details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">ID: {payment.id}</p>
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
            <h3 className="text-sm font-medium text-foreground">
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
        <div className="rounded-lg bg-card p-6 shadow">
          <h3 className="text-sm font-semibold text-foreground">Customer</h3>
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
              <p className="text-sm text-muted-foreground">
                {maskPhone(payment.customers.phone_number)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{payment.customer_id}</p>
          )}
        </div>

        <div className="rounded-lg bg-card p-6 shadow">
          <h3 className="text-sm font-semibold text-foreground">Loan</h3>
          {payment.loans ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {formatCurrency((payment.loans as any).principal)} loan
              </p>
              <p className="text-sm text-muted-foreground">
                Status: {(payment.loans as any).status}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{payment.loan_id}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-lg bg-card p-6 shadow">
        <h3 className="text-sm font-semibold text-foreground">Actions</h3>

        {payment.status === 'pending' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Notes <span className="text-muted-foreground">(required for fail action)</span>
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Add notes for this action..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingAction('confirm')}
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
                    setPendingAction(null);
                    return;
                  }
                  setPendingAction('fail');
                }}
                disabled={isProcessing || !actionNotes.trim()}
                title={!actionNotes.trim() ? 'Please add notes before marking as failed' : undefined}
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
                onClick={() => setPendingAction('reconcile')}
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
              disabled={isProcessing}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
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
              className="mt-2 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Reason for refund (required)..."
            />
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setPendingAction('refund')}
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
                disabled={isProcessing}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {payment.status === 'failed' && (
          <p className="mt-4 text-sm text-muted-foreground">
            This payment has failed.{' '}
            {payment.failure_reason &&
              `Reason: ${payment.failure_reason}`}
          </p>
        )}

        {payment.status === 'refunded' && (
          <p className="mt-4 text-sm text-muted-foreground">
            This payment has been refunded.
          </p>
        )}
      </div>

      <ConfirmationDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={handleActionConfirm}
        title={dialogProps.title}
        description={dialogProps.description}
        variant={dialogProps.variant}
        confirmLabel={dialogProps.confirmLabel}
        isLoading={isProcessing}
      />

      {payment.notes && (
        <div className="rounded-lg bg-card p-6 shadow">
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="mt-2 text-sm text-foreground">{payment.notes}</p>
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize text-foreground">
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
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {amount !== null ? formatCurrency(amount) : '-'}
      </p>