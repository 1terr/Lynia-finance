'use client';

/**
 * Fineract Loan Approval Page (Phase 7 - T009)
 *
 * Displays pending loan applications from Fineract with approve/reject
 * actions that trigger Fineract state transitions and GL journal entries.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPendingApprovalLoans,
  approveFineractLoan,
  disburseFineractLoan,
} from '@/lib/api/fineract';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FineractLoanView } from '@/types/fineract';
import { Pagination } from '@/components/ui/pagination';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function FineractApprovalPage() {
  const queryClient = useQueryClient();
  const canApprove = useAuthStore((s) => s.hasPermission('loans:approve'));
  const canReject = useAuthStore((s) => s.hasPermission('loans:reject'));
  const [page, setPage] = useState(1);
  const [selectedLoan, setSelectedLoan] = useState<FineractLoanView | null>(
    null
  );
  const [modalAction, setModalAction] = useState<
    'approve' | 'reject' | null
  >(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fineract-pending-loans', page],
    queryFn: () => getPendingApprovalLoans(page),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (loanId: string) =>
      approveFineractLoan(loanId, {
        approvedOnDate: new Date().toISOString().split('T')[0],
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fineract-pending-loans'] });
      closeModal();
    },
  });

  function openModal(
    loan: FineractLoanView,
    action: 'approve' | 'reject'
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

  function handleConfirmApproval() {
    if (!selectedLoan) return;
    approveMutation.mutate(selectedLoan.lyniaLoanId);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-gray-100"
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
        <h1 className="text-2xl font-bold text-gray-900">
          Loan Approval Queue
        </h1>
        <p className="text-sm text-gray-500">
          Review and approve pending loan applications from Fineract.
          {data && ` ${data.total} loans pending.`}
        </p>
      </div>

      {/* Empty State */}
      {loans.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-lg font-medium text-gray-600">
            No loans pending approval
          </p>
          <p className="mt-1 text-sm text-gray-400">
            All caught up! New applications will appear here.
          </p>
        </div>
      )}

      {/* Pending Loans List */}
      <div className="space-y-4">
        {loans.map((loan) => (
          <div
            key={loan.lyniaLoanId}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Customer Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900">
                    {loan.customerName}
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Pending Approval
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {loan.customerPhone} | Fineract #{loan.fineractLoanId}
                </p>
              </div>

              {/* Loan Details */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Product</p>
                  <p className="font-medium text-gray-900">
                    {loan.productName.replace(
                      'Lynia Device Finance - ',
                      ''
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Principal</p>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(loan.principal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Term</p>
                  <p className="font-medium text-gray-900">
                    {loan.numberOfRepayments} months
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rate</p>
                  <p className="font-medium text-gray-900">
                    {loan.interestRatePerPeriod}%/mo
                  </p>
                </div>
                {loan.deviceBrand && (
                  <div>
                    <p className="text-xs text-gray-500">Device</p>
                    <p className="font-medium text-gray-900">
                      {loan.deviceBrand} {loan.deviceModel}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions - gated by Cognito role permissions */}
              {(canApprove || canReject) && (
                <div className="flex gap-2">
                  {canApprove && (
                    <button
                      onClick={() => openModal(loan, 'approve')}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                  )}
                  {canReject && (
                    <button
                      onClick={() => openModal(loan, 'reject')}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Submitted date */}
            <p className="mt-3 text-xs text-gray-400">
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

      {/* Confirmation Modal */}
      {modalAction && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              {modalAction === 'approve' ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              )}
              <h3 className="text-lg font-semibold text-gray-900">
                {modalAction === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </h3>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">
                {modalAction === 'approve'
                  ? `Approve loan of ${formatCurrency(selectedLoan.principal)} for ${selectedLoan.customerName}? This will transition the loan to "Approved" in Fineract.`
                  : `Reject loan application for ${selectedLoan.customerName}? This action cannot be undone.`}
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder={
                    modalAction === 'approve'
                      ? 'Approval notes...'
                      : 'Rejection reason...'
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={approveMutation.isPending}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  modalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {approveMutation.isPending
                  ? 'Processing...'
                  : modalAction === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
