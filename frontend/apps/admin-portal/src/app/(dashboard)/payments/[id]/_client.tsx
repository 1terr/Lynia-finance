'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentById, reconcilePayment, retryPayment, refundPayment } from '@/lib/api/payments';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatCurrencyDetailed, formatDate, formatDateTime } from '@lynia/utils';
import {
  ArrowLeft,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => getPaymentById(id),
    enabled: !!id,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => reconcilePayment(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryPayment(id, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
    },
  });

  const refundMutation = useMutation({
    mutationFn: () => refundPayment(id, refundReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      setRefundModal(false);
      setRefundReason('');
    },
  });

  const canReconcile =
    user &&
    hasPermission(user.role, 'payments:reconcile') &&
    payment &&
    !payment.reconciled &&
    payment.payment_status === 'completed';

  const canRetry =
    user &&
    hasPermission(user.role, 'payments:reconcile') &&
    payment?.payment_status === 'failed';

  const canRefund =
    user &&
    hasPermission(user.role, 'payments:refund') &&
    payment?.payment_status === 'completed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">Payment not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/payments')}>
          Back to Payments
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/payments')} className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
            <Badge variant="status" status={payment.payment_status}>
              {payment.payment_status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 font-mono">{payment.id}</p>
        </div>
        <div className="flex gap-2">
          {canReconcile && (
            <Button
              variant="primary"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
            </Button>
          )}
          {canRetry && (
            <Button
              variant="secondary"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {retryMutation.isPending ? 'Retrying...' : 'Retry'}
            </Button>
          )}
          {canRefund && (
            <Button variant="danger" onClick={() => setRefundModal(true)}>
              <AlertTriangle className="mr-1.5 h-4 w-4" />
              Refund
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="text-lg font-semibold">{formatCurrencyDetailed(payment.payment_amount_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Method</p>
              <p className="text-lg font-semibold capitalize">{payment.payment_method.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="text-lg font-semibold capitalize">{payment.payment_type.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="text-lg font-semibold">{formatDate(payment.payment_date)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ['Status', payment.payment_status],
                ['Reference', payment.reference_number || payment.transaction_reference || 'N/A'],
                ['Reconciled', payment.reconciled ? 'Yes' : 'No'],
                ['Confirmed At', payment.confirmed_at ? formatDateTime(payment.confirmed_at) : 'N/A'],
                ['Failed At', payment.failed_at ? formatDateTime(payment.failed_at) : 'N/A'],
                ['Failure Reason', payment.failure_reason || 'N/A'],
                ['Created', formatDateTime(payment.created_at)],
                ['Updated', formatDateTime(payment.updated_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Customer & Loan */}
        <Card>
          <CardHeader>
            <CardTitle>Customer & Loan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Customer</h4>
                {payment.customer ? (
                  <dl className="space-y-2">
                    {[
                      ['Name', payment.customer.full_name],
                      ['Phone', payment.customer.phone_number],
                      ['Email', payment.customer.email || 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-sm text-gray-500">{label}</dt>
                        <dd className="text-sm font-medium text-gray-900">{value}</dd>
                      </div>
                    ))}
                    <div className="pt-1">
                      <Link
                        href={`/customers/${payment.customer.id}`}
                        className="text-sm text-brand-600 hover:text-brand-700"
                      >
                        View Customer Profile
                      </Link>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">Customer information unavailable</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Loan</h4>
                {payment.loan ? (
                  <dl className="space-y-2">
                    {[
                      ['Loan Amount', formatCurrencyDetailed(payment.loan.loan_amount_usd)],
                      ['Loan Status', payment.loan.loan_status],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <dt className="text-sm text-gray-500">{label}</dt>
                        <dd className="text-sm font-medium text-gray-900">{value}</dd>
                      </div>
                    ))}
                    <div className="pt-1">
                      <Link
                        href={`/loans/${payment.loan.id}`}
                        className="text-sm text-brand-600 hover:text-brand-700"
                      >
                        View Loan Details
                      </Link>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">Loan information unavailable</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Response */}
      {payment.provider_response && (
        <Card>
          <CardHeader>
            <CardTitle>Provider Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs text-gray-700">
              <code>{JSON.stringify(payment.provider_response, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Refund Modal */}
      <Modal open={refundModal} onClose={() => setRefundModal(false)} title="Refund Payment">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Refund payment of {formatCurrencyDetailed(payment.payment_amount_usd)} for{' '}
            <strong>{payment.customer?.full_name}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Refund Reason *</label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Provide reason for refund..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRefundModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => refundMutation.mutate()}
              disabled={!refundReason.trim() || refundMutation.isPending}
            >
              {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
