'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLoanById, getLoanPayments, approveLoan, rejectLoan } from '@/lib/api/loans';
import { useAuth } from '@/lib/hooks/use-auth';
import { hasPermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCurrency, formatCurrencyDetailed, formatDate, formatDateTime } from '@/lib/utils';
import type { Payment } from '@/types';
import {
  ArrowLeft,
  User,
  Calendar,
  DollarSign,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: () => getLoanById(id),
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ['loan-payments', id],
    queryFn: () => getLoanPayments(id),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => approveLoan(id, user!.id, approveNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      setApproveModal(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectLoan(id, user!.id, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      setRejectModal(false);
    },
  });

  const canApprove = user && hasPermission(user.role, 'loans:approve') && loan?.loan_status === 'pending';

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'payment_date',
      header: 'Date',
      render: (row) => formatDate(row.payment_date),
    },
    {
      key: 'payment_amount_usd',
      header: 'Amount',
      render: (row) => formatCurrencyDetailed(row.payment_amount_usd),
    },
    {
      key: 'payment_type',
      header: 'Type',
      render: (row) => (
        <span className="capitalize">{row.payment_type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (row) => (
        <span className="capitalize">{row.payment_method.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'payment_status',
      header: 'Status',
      render: (row) => (
        <Badge variant="status" status={row.payment_status}>
          {row.payment_status}
        </Badge>
      ),
    },
    {
      key: 'transaction_reference',
      header: 'Reference',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">
          {row.transaction_reference || '-'}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">Loan not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/loans')}>
          Back to Loans
        </Button>
      </div>
    );
  }

  const progress = loan.total_amount_due_usd > 0
    ? ((loan.total_amount_due_usd - loan.outstanding_balance_usd) / loan.total_amount_due_usd) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/loans')} className="rounded-md p-1 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Loan Details</h1>
            <Badge variant="status" status={loan.loan_status}>
              {loan.loan_status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 font-mono">{loan.id}</p>
        </div>
        {canApprove && (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => setApproveModal(true)}>
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Approve
            </Button>
            <Button variant="danger" onClick={() => setRejectModal(true)}>
              <XCircle className="mr-1.5 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Loan Amount</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.loan_amount_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.outstanding_balance_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Payment</p>
              <p className="text-lg font-semibold">{formatCurrency(loan.monthly_installment_usd)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <Calendar className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Days Past Due</p>
              <p className={`text-lg font-semibold ${loan.days_past_due > 0 ? 'text-red-600' : ''}`}>
                {loan.days_past_due > 0 ? `${loan.days_past_due} days` : 'Current'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Repayment progress */}
      <Card>
        <CardHeader>
          <CardTitle>Repayment Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {formatCurrency(loan.total_amount_due_usd - loan.outstanding_balance_usd)} paid
              </span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full bg-brand-600 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Total: {formatCurrency(loan.total_amount_due_usd)}</span>
              <span>Remaining: {formatCurrency(loan.outstanding_balance_usd)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loan Info */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ['Interest Rate', `${loan.interest_rate}% APR`],
                ['Term', `${loan.loan_term_months} months`],
                ['Disbursement Date', loan.disbursement_date ? formatDate(loan.disbursement_date) : 'Pending'],
                ['Maturity Date', loan.maturity_date ? formatDate(loan.maturity_date) : 'N/A'],
                ['Next Payment', loan.next_payment_date ? formatDate(loan.next_payment_date) : 'N/A'],
                ['Created', formatDateTime(loan.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Customer</CardTitle>
              {loan.customer && (
                <Link href={`/customers/${loan.customer.id}`} className="text-sm text-brand-600 hover:text-brand-700">
                  View Profile
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loan.customer ? (
              <dl className="space-y-3">
                {[
                  ['Name', loan.customer.full_name],
                  ['Phone', loan.customer.phone_number],
                  ['Email', loan.customer.email || 'N/A'],
                  ['KYC Status', loan.customer.kyc_status],
                  ['Status', loan.customer.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <dt className="text-sm text-gray-500">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">Customer information unavailable</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={paymentColumns}
            data={payments || []}
            keyExtractor={(row) => row.id}
            emptyMessage="No payments recorded yet"
          />
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Approve Loan">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approve loan of {formatCurrency(loan.loan_amount_usd)} for{' '}
            <strong>{loan.customer?.full_name}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Add approval notes..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Loan">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Reject loan of {formatCurrency(loan.loan_amount_usd)} for{' '}
            <strong>{loan.customer?.full_name}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rejection Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Provide reason for rejection..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
