'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPendingApprovalLoans,
  retryFineractSync,
  rejectFineractLoan,
} from '@/lib/api/fineract';
import { useMutationWithToast } from '@/hooks/use-mutation-with-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatCurrency, formatDate } from '@lynia/utils';
import type { FineractLoanView } from '@/types/fineract';
import { Pagination } from '@/components/ui/pagination';
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function FineractApprovalPage() {
  const canApprove = useAuthStore((s) => s.hasPermission('loans:approve'));
  const canReject = useAuthStore((s) => s.hasPermission('loans:reject'));
  const [page, setPage] = useState(1);
  const [selectedLoan, setSelectedLoan] = useState<FineractLoanView | null>(
    null
  );
  const [modalAction, setModalAction] = useState<
    'retry' | 'reject' | null
  >(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fineract-pending-loans', page],
    queryFn: () => getPendingApprovalLoans(page),
    refetchInterval: 30000,
  });

  const retrySyncMutation = useMutationWithToast({
    mutationFn: (loanId: string) => retryFineractSync(loanId),
    successMessage: 'Fineract sync completed successfully',
    errorMessage: 'Failed to sync loan to Fineract',
    invalidateKeys: [['fineract-pending-loans'], ['fineract-loans']],
    onSuccess: () => closeModal(),
  });

  const rejectMutation = useMutationWithToast({
    mutationFn: (loanId: string) =>
      rejectFineractLoan(loanId, {
        rejectedOnDate: new Date().toISOString().split('T')[0],
        note,
      }),
    successMessage: 'Loan rejected',
    errorMessage: 'Failed to reject loan',
    invalidateKeys: [['fineract-pending-loans'], ['fineract-loans']],
    onSuccess: () => closeModal(),
  });

  function openModal(
    loan: FineractLoanView,
    action: 'retry' | 'reject'
  ) {
    setSelectedLoan(loan);
    setModalAction(action);
    setNote('');
  }

  function closeModal() {
    setSelectedLoan(null);
    setModalAction(null);
    setNote('');
  }

  function handleConfirm() {
    if (!selectedLoan) return;
    if (modalAction === 'reject' && !note.trim()) return;
    if (modalAction === 'retry') {
      retrySyncMutation.mutate(selectedLoan.lyniaLoanId);
    } else if (modalAction === 'reject') {
      rejectMutation.mutate(selectedLoan.lyniaLoanId);
    }
  }

  const isActionPending = retrySyncMutation.isPending || rejectMutation.isPending;
  const isRejectNoteEmpty = modalAction === 'reject' && !note.trim();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  const loans = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Fineract Sync Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Loans approved in Lynia but with failed Fineract sync. Retry or reject.
          {data && ` ${data.total} loans with sync issues.`}
        </p>
      </div>

      {/* Empty State */}
      {loans.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            No sync issues
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            All loans are synced to Fineract successfully.
          </p>
        </div>
      )}

      {/* Pending Loans List */}
      <div className="space-y-4">
        {loans.map((loan) => (
          <div
            key={loan.lyniaLoanId}
            className="rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Customer Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h3 className="font-semibold text-foreground">
                    {loan.customerName}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900 px-2 py-0.5 text-xs font-medium text-orange-800 dark:text-orange-200">
                    Sync Failed
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loan.customerPhone} | Loan #{loan.fineractLoanId}
                </p>
              </div>

              {/* Loan Details */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p className="font-medium text-foreground">
                    {loan.productName.replace(
                      'Lynia Device Finance - ',
                      ''
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Principal</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(loan.principal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Term</p>
                  <p className="font-medium text-foreground">
                    {loan.numberOfRepayments} months
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-medium text-foreground">
                    {loan.interestRatePerPeriod}%/mo
                  </p>
                </div>
                {loan.deviceBrand && (
                  <div>
                    <p className="text-xs text-muted-foreground">Device</p>
                    <p className="font-medium text-foreground">
                      {loan.deviceBrand} {loan.deviceModel}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {(canApprove || canReject) && (
                <div className="flex gap-2">
                  {canApprove && (
                    <button
                      onClick={() => openModal(loan, 'retry')}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry Sync
                    </button>
                  )}
                  {canReject && (
                    <button
                      onClick={() => openModal(loan, 'reject')}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:bg-red-950 dark:text-red-400"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Submitted date */}
            <p className="mt-3 text-xs text-muted-foreground">
              Submitted{' '}
              {loan.submittedOnDate
                ? formatDate(loan.submittedOnDate)
                : 'N/A'}
            </p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          pageSize={data.limit}
          onPageChange={setPage}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={!!modalAction && !!selectedLoan}
        onClose={closeModal}
        onConfirm={handleConfirm}
        title={modalAction === 'retry' ? 'Retry Fineract Sync' : 'Reject Loan'}
        variant={modalAction === 'reject' ? 'destructive' : 'warning'}
        confirmLabel={modalAction === 'retry' ? 'Retry Sync' : 'Reject Loan'}
        isLoading={isActionPending}
        description={
          selectedLoan ? (
            <div className="space-y-3 text-left">
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd className="font-medium text-foreground">{selectedLoan.customerName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-medium text-foreground">{formatCurrency(selectedLoan.principal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Term</dt>
                    <dd className="font-medium text-foreground">{selectedLoan.numberOfRepayments} months</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="font-medium text-foreground">{selectedLoan.interestRatePerPeriod}%/mo</dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm text-muted-foreground">
                {modalAction === 'retry'
                  ? 'This will retry syncing this loan to the Fineract core banking system.'
                  : 'This action cannot be undone.'}
              </p>
              {modalAction === 'reject' && (
              <div>
                <label htmlFor="fineract-rejection-reason" className="block text-sm font-medium text-foreground">
                  Rejection reason (required)
                </label>
                <textarea
                  id="fineract-rejection-reason"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter reason for rejection..."
                />
                {isRejectNoteEmpty && (
                  <p className="mt-1 text-xs text-red-500">A rejection reason is required.</p>
                )}
              </div>
              )}
            </div>
          ) : ''
        }
      />
    </div>
  );
}
